// Composition des lots d'envoi (spec § 5.3) : pur, sans base ni réseau. L'ordre est celui de la file (seq), chaque
// (store, id) part une fois (la version la plus récente), un put est RELU au moment de l'envoi (la file ne garde
// pas la fiche), une suppression part avec son payload. Bornes du serveur appliquées avec une marge pour le lot ;
// la dichotomie de l'envoi reste le filet.
import { projectionFichier, remoteDeCeCompte } from './tables.js';
import { commandeCycle, recettesDe } from './cycle.js';

export const LIMITES = { elements: 500, lot: 921600, element: 524288 };
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const encodeur = new TextEncoder();

// PostgreSQL refuse \u0000 dans un jsonb ; les autres caractères de contrôle ne portent aucun sens dans une fiche.
export function nettoyerChaines(valeur) {
  if (typeof valeur === 'string') return valeur.replace(CONTROLE, '');
  if (Array.isArray(valeur)) return valeur.map(nettoyerChaines);
  // Un `Blob` et une `Date` ne sont pas des objets nus : parcourus comme tels, ils ressortaient en `{}` — les
  // octets d'une photo perdus, une date devenue vide. Ce ne sont pas des chaînes : ils traversent intacts.
  if (valeur && typeof valeur === 'object' && !(valeur instanceof Blob) && !(valeur instanceof Date)) {
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) sortie[k] = nettoyerChaines(v);
    return sortie;
  }
  return valeur;
}

// R-L3-27 : « est-ce que nettoyer changerait quelque chose ? » — la question posée par la passe unique de
// `repo.init()`, qui ne réécrit une fiche QUE si la réponse est oui. La classe de caractères n'est pas redéfinie
// ici : la question est posée à `nettoyerChaines` lui-même, donc il n'y a toujours qu'une seule définition de ce
// qu'est un caractère de contrôle. Un `Blob` n'est jamais parcouru (ses octets ne sont pas du texte).
export function porteDesCaracteresDeControle(valeur) {
  if (typeof valeur === 'string') return nettoyerChaines(valeur) !== valeur;
  if (Array.isArray(valeur)) return valeur.some(porteDesCaracteresDeControle);
  if (valeur && typeof valeur === 'object' && !(valeur instanceof Blob) && !(valeur instanceof Date)) return Object.values(valeur).some(porteDesCaracteresDeControle);
  return false;
}

export const tailleJson = (valeur) => encodeur.encode(JSON.stringify(valeur)).length;

// Une clé de synchronisation, nommée ici une fois pour toutes : reponses.js et push.js la reprennent telle quelle.
export const cleDe = (e) => `${e.store}:${e.id}`;
const contexteCycle = entree => ({
  ...(Object.hasOwn(entree,'expected_cycle_id')?{recipe_id:entree.recipe_id,expected_cycle_id:entree.expected_cycle_id,historique:entree.historique===true}:{}),
  ...(entree.recipe_contexts?{recipe_contexts:entree.recipe_contexts}:{}),
  ...(entree.archive_import?{archive_import:true}:{})
});

// Une clé par (store, id) : l'entrée la plus récente (seq le plus haut) représente la clé, tous les seq la suivent
// pour être retirés ensemble à l'accusé. L'ordre des clés est celui de leur PREMIÈRE apparition dans la file.
export function dedoublonner(entrees) {
  const parCle = new Map();
  for (const e of [...entrees].sort((a, b) => a.seq - b.seq)) {
    const cle = cleDe(e);
    const actuel = parCle.get(cle);
    if (!actuel) parCle.set(cle, { cle, entree: e, seqs: [e.seq] });
    else { actuel.seqs.push(e.seq); if (e.seq > actuel.entree.seq) actuel.entree = e; }
  }
  return [...parCle.values()];
}

// Une entrée → un élément de sync_push, ou une retenue (ligne files : L4 confirme l'empreinte avant l'envoi).
// R-L3-21 : pour une TOMBALE, l'heure envoyée est celle de l'ENTRÉE (l'instant du geste, posé par la capture), et
// jamais celle du payload — qui est l'heure de la dernière écriture de la fiche, donc exactement celle que le
// serveur possède déjà. Le payload part quand même avec son heure : il est la copie de la fiche (spec § 5.1).
const tombaleDe = (entree) => ({
  element: {
    store: entree.store,
    id: entree.id,
    data: entree.payload ? nettoyerChaines(entree.payload) : null,
    updated_at: entree.updated_at,
    deleted: true,
    ...contexteCycle(entree),
  },
});

// Lot G (D-G8) : une entrée files part avec la PROJECTION serveur, relue au moment de l'envoi ; sans remote de ce compte (ou disparue), elle est
// retenue « fichier en attente » — la retenue PRÉCÈDE la branche « fiche disparue » (R-L3-28 : l. 99-101 de tests/sync-l3.js). Jamais une tombale.
async function elementFichier(entree, relire) {
  if (entree.op !== 'put') return { retenue: true };
  const fiche = await relire('files', entree.id);
  if (!fiche || !remoteDeCeCompte(fiche.remote, entree.user_id)) return { retenue: true };
  const data = nettoyerChaines(projectionFichier(fiche));
  return { element: { store: 'files', id: entree.id, data, updated_at: data.updated_at || entree.updated_at, deleted: false } };
}

async function elementDe(entree, relire) {
  if (commandeCycle(entree)) return {element:{store:'recipes',id:entree.id,op:'lifecycle',...nettoyerChaines(entree.payload)}};
  if (entree.store === 'files') return elementFichier(entree, relire);
  if (entree.op === 'delete') return tombaleDe(entree);
  const fiche = await relire(entree.store, entree.id);
  if (fiche === undefined || fiche === null) {
    // R-L3-28 : la fiche n'existe plus ICI, et AUCUNE entrée `delete` ne la concerne (sinon celle-là aurait gagné
    // au dédoublonnage, étant plus récente). Elle a donc disparu par un chemin que la capture ignore : une
    // RÉCEPTION (origine 'remote' — le serveur a déjà cette suppression) ou un vidage d'appareil. L'entrée est
    // ABANDONNÉE, sans aucun envoi. L'envoyer en tombale avec l'heure de sa dernière écriture écrivait au serveur
    // une ligne supprimée pour une fiche qu'il ne connaissait peut-être même pas — et si une autre copie l'avait
    // modifiée depuis, cette tombale plus ancienne revenait en conflit à trancher pour rien.
    return { abandonnee: true };
  }
  const data = nettoyerChaines(fiche);
  return { element: { store: entree.store, id: entree.id, data, updated_at: data.updated_at || entree.updated_at, deleted: false,
    ...contexteCycle(entree) } };
}

export async function composerLots(entrees, relire) {
  const lots = [];
  const retenues = [];
  const abandonnees = []; // R-L3-28 : rien à envoyer pour ces clés, et leurs entrées sont à retirer
  let courant = { elements: [], seqs: [], octets: 2 }; // « [] »
  const fermer = () => { if (courant.elements.length) lots.push({ elements: courant.elements, seqs: courant.seqs }); courant = { elements: [], seqs: [], octets: 2 }; };
  const commandes=new Map();
  for (const e of [...entrees].sort((a,b)=>a.seq-b.seq)) if(commandeCycle(e)&&!commandes.has(e.id)) commandes.set(e.id,e);
  const admissibles=[];
  for (const e of entrees) {
    const first=recettesDe(e).map(id=>commandes.get(id)).filter(Boolean).sort((a,b)=>a.seq-b.seq)[0];
    if (e.lifecycle_blocked || e.lifecycle_waiting || e.quarantined_at || (first && e.seq>first.seq)) {retenues.push({seq:e.seq,seqs:[e.seq],raison:'cycle en attente'});continue;}
    // La création non encore reçue sera portée par le seed de la première commande. Ces séquences ne sont retirées qu'avec son accusé.
    if (first?.payload?.seed && e.store==='recipes' && e.op==='put' && e.seq<first.seq && first.payload.base_cycle_id==null) continue;
    admissibles.push(e);
  }
  const groupes=dedoublonner(admissibles.filter(e=>!commandeCycle(e))).concat(admissibles.filter(commandeCycle).map(entree=>({entree,seqs:[entree.seq,...entrees.filter(e=>e.store==='recipes'&&e.id===entree.id&&e.op==='put'&&e.seq<entree.seq&&entree.payload?.seed&&entree.payload.base_cycle_id==null).map(e=>e.seq)]})));
  const ordre=g=>commandeCycle(g.entree)?g.entree.seq:Math.min(...g.seqs);
  groupes.sort((a,b)=>ordre(a)-ordre(b));
  for (const { entree, seqs } of groupes) {
    const r = await elementDe(entree, relire);
    if (r.retenue) { retenues.push({ seq: entree.seq, seqs, raison: 'fichier en attente' }); continue; }
    if (r.abandonnee) { abandonnees.push({ seq: entree.seq, seqs, raison: 'fiche disparue' }); continue; }
    if (commandeCycle(entree)) {fermer();lots.push({elements:[r.element],seqs});continue;}
    const taille = tailleJson(r.element) + 1;
    const seul = tailleJson(r.element.data ?? {}) > LIMITES.element;
    if (seul) { fermer(); lots.push({ elements: [r.element], seqs }); continue; }
    if (courant.elements.length >= LIMITES.elements || courant.octets + taille > LIMITES.lot) fermer();
    courant.elements.push(r.element); courant.seqs.push(...seqs); courant.octets += taille;
  }
  fermer();
  return { lots, retenues, abandonnees };
}
