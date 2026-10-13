// Réception (spec § 5.5) : par table, pages par server_seq croissant ; le curseur n'avance qu'avec l'écriture de la
// page (même transaction). Règle I7, la même qu'à l'envoi : le plus récent gagne ; égal + identique = rien ;
// égal + différent = conflit. Tout ce qui s'écrit ici porte origin 'remote' : jamais recapturé.
import { SYNC_STORES, STORES } from '../model/schema.js';
import { logError } from '../core/log.js';

// jsonb RÉORDONNE les clés d'un objet : la copie du serveur revient presque toujours dans un autre ordre que la
// fiche locale. Comparées par JSON brut, deux fiches identiques feraient un conflit à chaque égalité d'updated_at.
// Les clés sont donc triées récursivement ; l'ordre d'un TABLEAU, lui, est du contenu (une liste d'étapes a un ordre).
function stable(valeur) {
  if (Array.isArray(valeur)) return valeur.map(stable);
  if (valeur && typeof valeur === 'object') {
    const trie = {};
    for (const cle of Object.keys(valeur).sort()) trie[cle] = stable(valeur[cle]);
    return trie;
  }
  return valeur;
}

export const identiques = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

export function decider({ locale, distante }) {
  if (distante.deleted_at) return locale === undefined || locale === null ? 'ignorer' : 'supprimer';
  if (locale === undefined || locale === null) return 'ecrire';
  const l = String(locale.updated_at || ''), d = String(distante.updated_at || '');
  if (d > l) return 'ecrire';
  if (l > d) return 'conflit_renvoyer';
  return identiques(locale, distante.data) ? 'ignorer' : 'conflit';
}

// Une version est l'ancêtre d'une autre si on la retrouve en remontant parent_version_id (elle-même comprise).
export function estAncetre(versions, candidatId, cibleId) {
  const parId = new Map(versions.map((v) => [v.id, v]));
  let courant = cibleId;
  const vus = new Set();
  while (courant && !vus.has(courant)) {
    if (courant === candidatId) return true;
    vus.add(courant);
    courant = parId.get(courant)?.parent_version_id || null;
  }
  return false;
}

// Forme d'une ligne reçue (R9, jeton « forme »). Une seule ligne douteuse fait refuser la PAGE ENTIÈRE : écrire la
// moitié d'une page puis avancer le curseur perdrait le reste pour toujours. `Object.hasOwn` : la clé doit être
// portée par l'objet nu, jamais héritée d'un prototype. Le server_seq est vérifié sur TOUTES les lignes, tombales
// comprises — c'est lui qui devient le curseur, et un curseur illisible ferait reprendre la table à zéro.
function refusDeForme(table, ligne, clePrimaire) {
  if (!Number.isFinite(ligne?.server_seq)) return { type: 'forme', status: null, message: 'server_seq ' + table };
  if (ligne.deleted_at) return null;
  const data = ligne.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { type: 'forme', status: null, message: 'data ' + table };
  if (!Object.hasOwn(data, clePrimaire) || data[clePrimaire] !== ligne.id) return { type: 'forme', status: null, message: 'cle ' + table };
  return null;
}

export function createPull({ db, transport, isActivitySynced = () => false, getUserId = () => null, surProgression = () => {}, limite = 1000 }) {
  const tables = () => SYNC_STORES.filter((t) => t !== 'library_activity' || isActivitySynced());

  // Pointeur de version (spec § 5.5) : si la version locale pointée n'est pas un ancêtre de celle qu'on reçoit, les
  // deux appareils ont adapté la recette en parallèle. La fiche reçue (plus récente) est écrite — l'original n'est
  // jamais réécrit et AUCUNE version n'est masquée : seul le pointeur est signalé, la personne tranchera.
  async function conflitDePointeur(ligne, locale) {
    const ici = locale?.current_version_id;
    const ailleurs = ligne.data?.current_version_id;
    if (!ici || !ailleurs || ici === ailleurs) return null;
    const versions = (await db.getAll('recipe_versions')).filter((v) => v.recipe_id === ligne.id);
    if (estAncetre(versions, ici, ailleurs)) return null;
    return { id: `recipes:${ligne.id}`, store: 'recipes', record_id: ligne.id, local: locale, server: { data: ligne.data, updated_at: ligne.updated_at, deleted_at: null }, at: new Date().toISOString(), kind: 'version' };
  }

  async function appliquerPage(table, lignes, bilan) {
    const puts = {}; const deletes = {}; const conflits = []; const refile = [];
    const clePrimaire = STORES[table].keyPath;
    let supprimees = 0; let recues = 0;
    for (const ligne of lignes) {
      const refus = refusDeForme(table, ligne, clePrimaire);
      if (refus) return { erreur: refus };
      const locale = await db.get(table, ligne.id);
      const decision = decider({ locale, distante: ligne });
      if (decision === 'supprimer') { (deletes[table] ||= []).push(ligne.id); supprimees += 1; continue; }
      if (decision === 'ignorer') continue;
      if (decision === 'ecrire') {
        // L'updated_at du serveur fait foi : il a pu être ajusté à l'écriture (R25, tombales figées).
        let fiche = { ...ligne.data, updated_at: ligne.updated_at };
        // Une ligne files n'apporte JAMAIS d'octets ici (L4 les téléchargera) : le blob local est conservé s'il
        // existe, sinon la ligne est marquée « remote » et reste sans blob — jamais un blob effacé par une réception.
        if (table === 'files') fiche = locale?.blob instanceof Blob ? { ...fiche, blob: locale.blob } : { ...fiche, remote: true };
        (puts[table] ||= []).push(fiche); recues += 1;
        if (table === 'recipes') {
          const pointeur = await conflitDePointeur(ligne, locale);
          if (pointeur) conflits.push(pointeur);
        }
        continue;
      }
      conflits.push({ id: `${table}:${ligne.id}`, store: table, record_id: ligne.id, local: locale, server: { data: ligne.data, updated_at: ligne.updated_at, deleted_at: null }, at: new Date().toISOString(), kind: 'donnees' });
      // conflit_renvoyer : la fiche d'ici est plus récente, elle est conservée ET remise en file — le serveur
      // l'acceptera. L'entrée est écrite EXPLICITEMENT : l'origine 'remote' de la transaction fait que la capture
      // ne la verrait pas (c'est voulu : rien d'autre dans cette page ne doit repartir).
      if (decision === 'conflit_renvoyer') refile.push({ user_id: getUserId(), store: table, id: ligne.id, op: 'put', updated_at: locale.updated_at || null, tries: 0 });
    }
    if (conflits.length) puts.sync_conflicts = conflits;
    if (refile.length) puts.outbox = refile;
    // Curseur atomique : il part dans la MÊME transaction que les écritures de sa page. Une page refusée plus haut
    // n'arrive jamais ici, donc rien n'est écrit et le curseur ne bouge pas : la page sera relue telle quelle.
    const dernier = Math.max(...lignes.map((l) => l.server_seq));
    puts.sync_state = [{ key: `cursor:${table}`, value: dernier }];
    await db.mutate({ puts, deletes, origin: 'remote' });
    bilan.recues += recues;
    bilan.supprimees += supprimees;
    bilan.conflits += conflits.length;
    return { erreur: null, dernier };
  }

  async function recevoir() {
    const bilan = { recues: 0, supprimees: 0, conflits: 0, erreur: null };
    const liste = tables();
    for (const [i, table] of liste.entries()) {
      surProgression({ phase: 'reception', table, n: i + 1, total: liste.length });
      let curseur = (await db.get('sync_state', `cursor:${table}`))?.value || 0;
      for (;;) {
        const { lignes, erreur } = await transport.lire(table, curseur, limite);
        if (erreur) { bilan.erreur = erreur; logError('sync.pull', { table, reason: erreur.type, status: erreur.status }); return bilan; }
        if (!lignes.length) break;
        const r = await appliquerPage(table, lignes, bilan);
        if (r.erreur) { bilan.erreur = r.erreur; logError('sync.pull.forme', { table }); return bilan; }
        // Une page courte ne clôt PAS la table : la suivante est demandée, et c'est une page vide qui arrête. Et le
        // curseur doit avancer — un serveur qui renverrait la même page ferait tourner cette boucle sans fin.
        if (!(r.dernier > curseur)) break;
        curseur = r.dernier;
      }
    }
    return bilan;
  }

  return { recevoir };
}
