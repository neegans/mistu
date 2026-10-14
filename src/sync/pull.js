// Réception (spec § 5.5) : par table, pages par server_seq croissant ; le curseur n'avance qu'avec l'écriture de la
// page (même transaction). Règle I7, la même qu'à l'envoi : le plus récent gagne ; égal + identique = rien ;
// égal + différent = conflit. Tout ce qui s'écrit ici porte origin 'remote' : jamais recapturé.
import { SYNC_STORES, STORES } from '../model/schema.js';
import { logError } from '../core/log.js';

// R-L3-12 : les versions AVANT les recettes. Le pointeur d'une recette reçue désigne presque toujours une version
// créée par le même geste, sur l'autre appareil : lue après la recette, elle serait encore inconnue ici et chaque
// adaptation venue d'ailleurs ressortirait en faux conflit de pointeur.
const ORDRE_PRIORITAIRE = ['recipe_versions'];

// jsonb RÉORDONNE les clés d'un objet : la copie du serveur revient presque toujours dans un autre ordre que la
// fiche locale. Comparées par JSON brut, deux fiches identiques feraient un conflit à chaque égalité d'instant.
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

// Les deux fiches sont comparées SANS leur updated_at (R-L3-11) : l'égalité d'instant est déjà établie avant
// l'appel, et les deux chaînes qui portent ce même instant ne s'écrivent pas pareil ('.000Z' ici, '+00:00' là).
// Un champ `undefined` équivaut à son absence (JSON les confond) ; un champ `null`, non : c'est une valeur.
export function identiques(a, b) {
  const sansHeure = (fiche) => { const { updated_at: _heure, ...reste } = fiche || {}; return stable(reste); };
  return JSON.stringify(sansHeure(a)) === JSON.stringify(sansHeure(b));
}

// R-L3-11 : PostgREST rend « 2026-10-13T11:00:00+00:00 », et des microsecondes quand il y en a ; le local porte
// « …:00.000Z ». Comparées comme des CHAÎNES, ces deux écritures du MÊME instant donnent `l > d` ('.' > '+',
// 'Z' > un chiffre) : l'écho de nos propres envois revenait en conflit à chaque réception. On compare des instants.
const instant = (valeur) => {
  const ms = Date.parse(valeur);
  return Number.isFinite(ms) ? ms : null;
};

export function decider({ locale, distante }) {
  if (locale === undefined || locale === null) return distante.deleted_at ? 'ignorer' : 'ecrire';
  // Les deux heures, comparées comme des INSTANTS ; repli sur la chaîne si l'une est illisible, pour rester
  // déterministe. C'est la seule question que I7 pose — et elle se pose aussi à une tombale.
  const ici = instant(locale.updated_at), ailleurs = instant(distante.updated_at);
  const lisibles = ici !== null && ailleurs !== null;
  const l = String(locale.updated_at || ''), d = String(distante.updated_at || '');
  const plusRecentIci = lisibles ? ici > ailleurs : l > d;
  const plusRecentAilleurs = lisibles ? ailleurs > ici : d > l;
  // R-L3-26 (amende § 5.5) : une tombale aussi obéit à I7. La lettre de § 5.5 (« ligne reçue avec deleted_at →
  // suppression locale ») faisait gagner une tombale du 10 octobre contre une version locale du 12, sans conflit et
  // sans trace — une perte muette, et atteignable : `lireFile` écarte les entrées en quarantaine SANS produire
  // d'erreur, donc l'envoi « réussit », la réception se poursuit, et la tombale efface la fiche locale plus récente
  // dont l'envoi était justement bloqué (une fiche grossie au-delà de 512 Ko, par exemple). À instant ÉGAL la
  // tombale gagne : une suppression est le dernier mot sur cette heure. Plus ancienne, c'est la personne qui
  // tranche (« Garder celle d'ailleurs » applique alors la suppression) — jamais une suppression silencieuse.
  if (distante.deleted_at) return plusRecentIci ? 'conflit_renvoyer' : 'supprimer';
  if (plusRecentAilleurs) return 'ecrire';
  if (plusRecentIci) return 'conflit_renvoyer';
  return identiques(locale, distante.data) ? 'ignorer' : 'conflit';
}

// Une version est l'ancêtre d'une autre si on la retrouve en remontant parent_version_id (elle-même comprise).
// `vus` arrête une chaîne bouclée (fiche bricolée, archive incohérente) au lieu de tourner sans fin.
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
  // SYNC_STORES n'est pas modifié : seule la liste de réception est réordonnée (R-L3-12).
  function tables() {
    const retenues = SYNC_STORES.filter((t) => t !== 'library_activity' || isActivitySynced());
    const prioritaires = ORDRE_PRIORITAIRE.filter((t) => retenues.includes(t));
    return [...prioritaires, ...retenues.filter((t) => !prioritaires.includes(t))];
  }

  // Pointeur de version (spec § 5.5) : si la version locale pointée n'est pas un ancêtre de celle qu'on reçoit, les
  // deux appareils ont adapté la recette en parallèle. La fiche reçue (plus récente) est écrite — l'original n'est
  // jamais réécrit et AUCUNE version n'est masquée : seul le pointeur est signalé, la personne tranchera.
  async function conflitDePointeur(ligne, locale) {
    const ici = locale?.current_version_id;
    const ailleurs = ligne.data?.current_version_id;
    if (!ici || !ailleurs || ici === ailleurs) return null;
    const versions = (await db.getAll('recipe_versions')).filter((v) => v.recipe_id === ligne.id);
    // R-L3-12 : la version pointée par la fiche reçue n'est pas encore arrivée ici (table retardée, page suivante,
    // passe interrompue). Rien à comparer, donc rien à signaler : un conflit annoncé sur une chaîne qu'on ne
    // connaît pas encore serait faux, et il masquerait le vrai quand elle arriverait.
    if (!versions.some((v) => v.id === ailleurs)) return null;
    if (estAncetre(versions, ici, ailleurs)) return null;
    return { id: `recipes:${ligne.id}`, store: 'recipes', record_id: ligne.id, local: locale, server: { data: ligne.data, updated_at: ligne.updated_at, deleted_at: null }, at: new Date().toISOString(), kind: 'version' };
  }

  // Une ligne files n'apporte JAMAIS d'octets ici (L4 les téléchargera). Les métadonnées LOCALES (syncable,
  // created_at, original_filename) survivent sous les champs du serveur ; le blob local est conservé s'il existe,
  // sinon la ligne est marquée « remote » et reste sans octets. Jamais un blob effacé par une réception.
  function ficheFichier(ligne, locale) {
    const blob = locale?.blob instanceof Blob ? locale.blob : null;
    const { blob: _octets, ...metaLocale } = locale || {};
    const fiche = { ...metaLocale, ...ligne.data, updated_at: ligne.updated_at };
    if (blob) { fiche.blob = blob; delete fiche.remote; } else fiche.remote = true;
    return fiche;
  }

  async function appliquerPage(table, lignes, bilan, curseur) {
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
        // L'updated_at du serveur est stocké VERBATIM (R-L3-11) : microsecondes et décalage compris. Un renvoi doit
        // être égal, côté serveur, à la microseconde — et le serveur a pu ajuster l'heure à l'écriture (R25).
        (puts[table] ||= []).push(table === 'files' ? ficheFichier(ligne, locale) : { ...ligne.data, updated_at: ligne.updated_at });
        recues += 1;
        if (table === 'recipes') {
          const pointeur = await conflitDePointeur(ligne, locale);
          if (pointeur) conflits.push(pointeur);
        }
        continue;
      }
      // R-L3-26 : la version du serveur, telle qu'il la porte VRAIMENT. Pour une tombale, `data` est nul — le
      // serveur garde bien le corps de la ligne supprimée, mais le journal ne doit pas offrir à la personne une
      // fiche qui n'existe plus là-bas, et c'est `deleted_at` qui dit à `garderAilleurs` d'appliquer la suppression.
      const versionServeur = ligne.deleted_at
        ? { data: null, updated_at: ligne.updated_at, deleted_at: ligne.deleted_at }
        : { data: ligne.data, updated_at: ligne.updated_at, deleted_at: null };
      conflits.push({ id: `${table}:${ligne.id}`, store: table, record_id: ligne.id, local: locale, server: versionServeur, at: new Date().toISOString(), kind: 'donnees' });
      // conflit_renvoyer : la fiche d'ici est plus récente, elle est conservée ET remise en file — le serveur
      // l'acceptera. L'entrée est écrite EXPLICITEMENT : l'origine 'remote' de la transaction fait que la capture
      // ne la verrait pas (c'est voulu : rien d'autre dans cette page ne doit repartir).
      if (decision === 'conflit_renvoyer') refile.push({ user_id: getUserId(), store: table, id: ligne.id, op: 'put', updated_at: locale.updated_at || null, tries: 0 });
    }
    if (conflits.length) puts.sync_conflicts = conflits;
    if (refile.length) puts.outbox = refile;
    // Curseur atomique : il part dans la MÊME transaction que les écritures de sa page. Une page refusée plus haut
    // n'arrive jamais ici, donc rien n'est écrit et le curseur ne bouge pas : la page sera relue telle quelle. Et il
    // ne RECULE jamais — une page dont les server_seq sont sous le curseur est écrite, mais sans le ramener en
    // arrière, sinon tout ce qui est déjà reçu repartirait en boucle.
    const dernier = Math.max(...lignes.map((l) => l.server_seq));
    puts.sync_state = [{ key: `cursor:${table}`, value: Math.max(curseur, dernier) }];
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
        const r = await appliquerPage(table, lignes, bilan, curseur);
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
