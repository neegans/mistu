// Composition des lots d'envoi (spec § 5.3) : pur, sans base ni réseau. L'ordre est celui de la file (seq), chaque
// (store, id) part une fois (la version la plus récente), un put est RELU au moment de l'envoi (la file ne garde
// pas la fiche), une suppression part avec son payload. Bornes du serveur appliquées avec une marge pour le lot ;
// la dichotomie de l'envoi reste le filet.
export const LIMITES = { elements: 500, lot: 921600, element: 524288 };
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const encodeur = new TextEncoder();

// PostgreSQL refuse \u0000 dans un jsonb ; les autres caractères de contrôle ne portent aucun sens dans une fiche.
export function nettoyerChaines(valeur) {
  if (typeof valeur === 'string') return valeur.replace(CONTROLE, '');
  if (Array.isArray(valeur)) return valeur.map(nettoyerChaines);
  if (valeur && typeof valeur === 'object' && !(valeur instanceof Blob)) {
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) sortie[k] = nettoyerChaines(v);
    return sortie;
  }
  return valeur;
}

export const tailleJson = (valeur) => encodeur.encode(JSON.stringify(valeur)).length;

// Une clé de synchronisation, nommée ici une fois pour toutes : reponses.js et push.js la reprennent telle quelle.
export const cleDe = (e) => `${e.store}:${e.id}`;

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
  },
});

async function elementDe(entree, relire) {
  // Garde-fou désormais INATTEIGNABLE depuis la capture (R-L3-22 : les lignes `files` n'entrent plus en file en L3,
  // et celles déjà présentes sont retirées une fois par `repo.init()`). Il reste : c'est la seule barrière si une
  // entrée `files` revient par un chemin qu'on n'a pas prévu, et L4 lui donnera son vrai travail (confirmer
  // l'empreinte distante avant d'envoyer la ligne). Sa retenue reste donc testée sur `composerLots`, pas sur la file.
  if (entree.store === 'files') return { retenue: true };
  if (entree.op === 'delete') return tombaleDe(entree);
  const fiche = await relire(entree.store, entree.id);
  if (fiche === undefined || fiche === null) {
    // Disparue entre la capture et l'envoi : elle est partie, on le dit au serveur avec ce qu'on sait.
    return tombaleDe(entree);
  }
  const data = nettoyerChaines(fiche);
  return { element: { store: entree.store, id: entree.id, data, updated_at: data.updated_at || entree.updated_at, deleted: false } };
}

export async function composerLots(entrees, relire) {
  const lots = [];
  const retenues = [];
  let courant = { elements: [], seqs: [], octets: 2 }; // « [] »
  const fermer = () => { if (courant.elements.length) lots.push({ elements: courant.elements, seqs: courant.seqs }); courant = { elements: [], seqs: [], octets: 2 }; };
  for (const { entree, seqs } of dedoublonner(entrees)) {
    const r = await elementDe(entree, relire);
    if (r.retenue) { retenues.push({ seq: entree.seq, seqs, raison: 'fichier en attente' }); continue; }
    const taille = tailleJson(r.element) + 1;
    const seul = tailleJson(r.element.data ?? {}) > LIMITES.element;
    if (seul) { fermer(); lots.push({ elements: [r.element], seqs }); continue; }
    if (courant.elements.length >= LIMITES.elements || courant.octets + taille > LIMITES.lot) fermer();
    courant.elements.push(r.element); courant.seqs.push(...seqs); courant.octets += taille;
  }
  fermer();
  return { lots, retenues };
}
