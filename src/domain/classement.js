// Un lot de recettes photographiées (lot D, spec docs/superpowers/specs/2026-10-19-recettes-en-lot-design.md, § 3.6) : domaine PUR — aucun DOM, aucun
// t(), aucune base. La sortie du classement est une DONNÉE HOSTILE déjà validée par validerClassement (llm.js) : ici la correspondance photo ↔ page
// ENVOYÉE, la revalidation d'un résultat revenu du journal (synchro, archive), l'état de regroupement et son brouillon, l'appariement proposé à une
// référence (la règle de D-D5, écrite ICI et nulle part ailleurs), le plan de lecture du lot, sa progression et sa suite. Directions d'import uniques :
// classement.js → llm.js et classement.js → import-cible.js, jamais l'inverse. Chaque objet rendu est construit champ par champ (I-D2).
import { BORNES_CLASSEMENT } from './llm.js';
import { estTitreUneLigne } from '../core/bornes.js';
import { normalizeText } from './units.js';
import { motsDistinctifs, deplacerPage, importOuvert, IMPORTS_OUVERTS, lotDeRecette, ligneImportNeuve } from './import-cible.js';

export const PROCHE_PAGE = 2;
const liste = (v) => (Array.isArray(v) ? v : []);
const objetNu = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sien = (o, k) => (Object.hasOwn(o, k) ? o[k] : undefined);
const pageValide = (v) => Number.isInteger(v) && v >= 1 && v <= BORNES_CLASSEMENT.page;

// --- La clé du classement rendu (D-D23) : le gabarit de cleLecture (src/ui/import-cible.js). Elle change avec started_at ou resultat, jamais avec le
// brouillon ni updated_at : un « Reclasser » d'ailleurs entre le rendu et le clic n'est jamais consommé sans avoir été vu.
export const cleClassement = (ligne) => JSON.stringify([ligne?.id ?? null, ligne?.started_at ?? null, ligne?.resultat ?? null]);

// --- Correspondance numéro ↔ page (§ 3.2) : `pageIds` = les pages ENVOYÉES par lancerVol (C, D-C21), dans l'ordre ; n → pageIds[n − 1].
export function resultatClassement(classement, pageIds) {
  const ids = liste(pageIds);
  const id = (n) => (Number.isInteger(n) && n >= 1 && n <= ids.length && typeof ids[n - 1] === 'string' ? ids[n - 1] : null);
  const traduire = (xs) => liste(xs).map(id).filter((x) => x !== null);
  return {
    groupes: liste(classement?.groupes).map((g) => ({ page_ids: traduire(g?.photos), title: typeof g?.title === 'string' ? g.title : null, printed_page: pageValide(g?.printed_page) ? g.printed_page : null, uncertain: g?.uncertain === true })).filter((g) => g.page_ids.length),
    orphelines: traduire(classement?.orphelines), non_classees: traduire(classement?.non_classees), partagees: traduire(classement?.partagees),
    uncertain: liste(classement?.uncertain).filter((u) => typeof u === 'string'),
  };
}

// --- Revalidation (§ 3.6, I-D2) : un `resultat` relu du journal a été produit par NOTRE validation — un écart est une altération → null (l'écran écrit
// echec(illisible)). Mêmes règles que validerClassement, sur les identifiants : chaque page est une chaîne de `pageIds` (ligne.page_ids), une fois dans
// groupes ∪ orphelines ∪ non_classees ; partagees ⊂ les groupes, distinctes, ≤ 10 ; 1 à 10 groupes, aucun vide ; titres et incertitudes par
// estTitreUneLigne. Un résultat valide revient À L'IDENTIQUE (objet construit, même ordre des clés).
export function revaliderResultatClassement(brut, pageIds) {
  const B = BORNES_CLASSEMENT;
  const ids = new Set(liste(pageIds));
  if (!objetNu(brut)) return null;
  const groupes = sien(brut, 'groupes'), orphelines = sien(brut, 'orphelines'), nonClassees = sien(brut, 'non_classees'), partagees = sien(brut, 'partagees'), uncertain = sien(brut, 'uncertain');
  if (!Array.isArray(groupes) || groupes.length < 1 || groupes.length > B.groupes) return null;
  if (![orphelines, nonClassees, partagees, uncertain].every(Array.isArray)) return null;
  const vues = new Set();
  const prendre = (p) => { if (typeof p !== 'string' || !ids.has(p) || vues.has(p)) return false; vues.add(p); return true; };
  const gs = [];
  for (const g of groupes) {
    if (!objetNu(g)) return null;
    const pids = sien(g, 'page_ids'), title = sien(g, 'title'), page = sien(g, 'printed_page'), unc = sien(g, 'uncertain');
    if (!Array.isArray(pids) || !pids.length || pids.length > B.photos || !pids.every(prendre)) return null;
    if (!(title === null || estTitreUneLigne(title, B.titre))) return null;
    if (!(page === null || pageValide(page))) return null;
    if (typeof unc !== 'boolean') return null;
    gs.push({ page_ids: [...pids], title, printed_page: page, uncertain: unc });
  }
  if (![...orphelines, ...nonClassees].every(prendre)) return null;
  const dansUnGroupe = new Set(gs.flatMap((g) => g.page_ids));
  if (partagees.length > B.photos || new Set(partagees).size !== partagees.length || !partagees.every((p) => dansUnGroupe.has(p))) return null;
  if (uncertain.length > B.incertitudes || !uncertain.every((u) => estTitreUneLigne(u, B.incertitude))) return null;
  return { groupes: gs, orphelines: [...orphelines], non_classees: [...nonClassees], partagees: [...partagees], uncertain: [...uncertain] };
}

// --- L'état de regroupement (§ 3.6) : { groupes: [{ cle, page_ids, title, printed_page, uncertain, origine }], aPart: [{ page_id, motif }], prochain }.
// g{k} = le groupe k du RÉSULTAT ; n{k} = un groupe de la personne. Une page absente de `pagesParId` est écartée (pointeur souple) ; un groupe vidé est
// retiré. Aucune fonction ne modifie son entrée : un nouvel objet à chaque fois (M37).
export function regroupementInitial(resultat, pagesParId) {
  const present = (p) => pagesParId instanceof Map && pagesParId.has(p);
  const groupes = liste(resultat?.groupes).map((g, i) => ({ cle: `g${i + 1}`, page_ids: liste(g?.page_ids).filter(present), title: g?.title ?? null, printed_page: g?.printed_page ?? null, uncertain: g?.uncertain === true, origine: 'classement' })).filter((g) => g.page_ids.length);
  const aPart = [...liste(resultat?.orphelines).filter(present).map((p) => ({ page_id: p, motif: 'orpheline' })), ...liste(resultat?.non_classees).filter(present).map((p) => ({ page_id: p, motif: 'non_classee' }))];
  return { groupes, aPart, prochain: 1 };
}
const copierEtat = (e) => ({ groupes: liste(e?.groupes).map((g) => ({ ...g, page_ids: [...liste(g.page_ids)] })), aPart: liste(e?.aPart).map((a) => ({ ...a })), prochain: Number.isInteger(e?.prochain) ? e.prochain : 1 });
// `cible` : la cle d'un groupe (la page va EN FIN), 'nouveau' (un groupe n{prochain} après les autres) ou 'a_part' (motif retiree). Page ou cible
// inconnue, ou cible = sa place actuelle → état égal. Au-delà de n999, plus de groupe neuf (la clé ne se relirait plus : /^[gn][1-9][0-9]{0,2}$/).
export function deplacerVers(etat, pageId, cible) {
  const copie = copierEtat(etat);
  const source = copie.groupes.find((g) => g.page_ids.includes(pageId)) ?? null;
  const iAPart = copie.aPart.findIndex((a) => a.page_id === pageId);
  if (!source && iAPart < 0) return copie;
  const destination = cible === 'nouveau' || cible === 'a_part' ? null : (copie.groupes.find((g) => g.cle === cible) ?? null);
  if (cible !== 'nouveau' && cible !== 'a_part' && !destination) return copie;
  if ((source && destination === source) || (!source && cible === 'a_part')) return copie;
  if (cible === 'nouveau' && copie.prochain > 999) return copie;
  if (source) source.page_ids = source.page_ids.filter((p) => p !== pageId); else copie.aPart.splice(iAPart, 1);
  if (cible === 'a_part') copie.aPart.push({ page_id: pageId, motif: 'retiree' });
  else if (cible === 'nouveau') { copie.groupes.push({ cle: `n${copie.prochain}`, page_ids: [pageId], title: null, printed_page: null, uncertain: false, origine: 'personne' }); copie.prochain += 1; }
  else destination.page_ids.push(pageId);
  copie.groupes = copie.groupes.filter((g) => g.page_ids.length);
  return copie;
}
export function bougerDansGroupe(etat, cle, pageId, sens) {
  const copie = copierEtat(etat);
  const g = copie.groupes.find((x) => x.cle === cle);
  if (g) g.page_ids = deplacerPage(g.page_ids, pageId, sens);
  return copie;
}
export const retirerDuGroupe = (etat, pageId) => deplacerVers(etat, pageId, 'a_part');

// --- Le brouillon (§ 3.1.1, D-D20) : groupes réduits à { cle, page_ids }, les choix FAITS par la personne (au plus un par groupe présent), aucun titre.
export function brouillonDe(etat, choixFaits, startedAt) {
  const groupes = liste(etat?.groupes).map((g) => ({ cle: g.cle, page_ids: [...liste(g.page_ids)] }));
  const presents = new Set(groupes.map((g) => g.cle));
  const choix = [];
  if (choixFaits instanceof Map) for (const [cle, id] of choixFaits) if (presents.has(cle)) choix.push([cle, id ?? null]);
  return { cle: startedAt, groupes, a_part: liste(etat?.aPart).map((a) => ({ page_id: a.page_id, motif: a.motif })), choix, prochain: Number.isInteger(etat?.prochain) ? etat.prochain : 1 };
}
// Relu au montage (D-D20) : DONNÉE HOSTILE — toute violation → null (l'écran repart de regroupementInitial, rien n'est écrit). Le brouillon n'apporte
// JAMAIS de texte : un g{k} reprend title, printed_page et uncertain de resultat.groupes[k − 1] ; un n{k} est « personne ». Les pages absentes de
// `pagesParId` sont ensuite écartées comme dans regroupementInitial (un choix dont le groupe a disparu est oublié).
export function restaurerBrouillon(brut, { resultat, pageIds, startedAt, pagesParId } = {}) {
  if (!objetNu(brut)) return null;
  const cle = sien(brut, 'cle'), groupes = sien(brut, 'groupes'), aPart = sien(brut, 'a_part'), choix = sien(brut, 'choix'), prochain = sien(brut, 'prochain');
  if (typeof cle !== 'string' || cle !== startedAt) return null;
  if (!Array.isArray(groupes) || groupes.length > BORNES_CLASSEMENT.groupes || !Array.isArray(aPart) || !Array.isArray(choix) || choix.length > BORNES_CLASSEMENT.groupes) return null;
  if (!Number.isInteger(prochain) || prochain < 1 || prochain > 1000) return null;
  const ids = new Set(liste(pageIds));
  const sources = liste(resultat?.groupes);
  const attendues = new Set([...sources.flatMap((g) => liste(g?.page_ids)), ...liste(resultat?.orphelines), ...liste(resultat?.non_classees)]);
  const vues = new Set();
  const cles = new Set();
  const gs = [];
  for (const g of groupes) {
    if (!objetNu(g)) return null;
    const c = sien(g, 'cle'), p = sien(g, 'page_ids');
    if (typeof c !== 'string' || !/^[gn][1-9][0-9]{0,2}$/.test(c) || cles.has(c)) return null;
    const k = Number(c.slice(1));
    if (c[0] === 'g' && !sources[k - 1]) return null;
    if (c[0] === 'n' && k >= prochain) return null;
    if (!Array.isArray(p) || !p.length) return null;
    for (const x of p) { if (typeof x !== 'string' || !ids.has(x) || vues.has(x)) return null; vues.add(x); }
    cles.add(c);
    const source = c[0] === 'g' ? sources[k - 1] : null;
    gs.push({ cle: c, page_ids: [...p], title: source ? (source.title ?? null) : null, printed_page: source ? (source.printed_page ?? null) : null, uncertain: source ? source.uncertain === true : false, origine: source ? 'classement' : 'personne' });
  }
  const ap = [];
  for (const a of aPart) {
    if (!objetNu(a)) return null;
    const pid = sien(a, 'page_id'), motif = sien(a, 'motif');
    if (typeof pid !== 'string' || !ids.has(pid) || vues.has(pid) || !['orpheline', 'non_classee', 'retiree'].includes(motif)) return null;
    vues.add(pid); ap.push({ page_id: pid, motif });
  }
  if (vues.size !== attendues.size || [...attendues].some((x) => !vues.has(x))) return null;
  const choixFaits = new Map();
  const refs = new Set();
  for (const paire of choix) {
    if (!Array.isArray(paire) || paire.length !== 2) return null;
    const [c, id] = paire;
    if (typeof c !== 'string' || !cles.has(c) || choixFaits.has(c)) return null;
    if (!(id === null || (typeof id === 'string' && Array.from(id).length >= 1 && Array.from(id).length <= 80))) return null;
    if (id !== null) { if (refs.has(id)) return null; refs.add(id); }
    choixFaits.set(c, id);
  }
  const present = (x) => pagesParId instanceof Map && pagesParId.has(x);
  const etat = { groupes: gs.map((g) => ({ ...g, page_ids: g.page_ids.filter(present) })).filter((g) => g.page_ids.length), aPart: ap.filter((a) => present(a.page_id)), prochain };
  for (const c of [...choixFaits.keys()]) if (!etat.groupes.some((g) => g.cle === c)) choixFaits.delete(c);
  return { etat, choixFaits };
}

// --- L'appariement (D-D5 ; la règle est écrite ICI et nulle part ailleurs) ------------------------------------------------------------------------
// Candidates : les recettes de l'édition, reference_only, sans source_url (un signet est le lot B), sans import OUVERT à leur identifiant (toute sorte :
// la même règle que la condition d'index d'I-2 du lot A). Occupées : les mêmes AVEC un import ouvert (montrées éteintes, jamais proposées).
const ouvertesParRecette = (imports) => new Set(liste(imports).filter((i) => i && IMPORTS_OUVERTS.includes(i.status) && typeof i.recipe_id === 'string' && i.recipe_id).map((i) => i.recipe_id));
const deLEdition = (recipes, editionId) => (editionId ? liste(recipes).filter((r) => r && r.edition_id === editionId && r.availability === 'reference_only' && !r.source_url) : []);
export function candidatsReference(recipes, { editionId = null, imports = [] } = {}) { const o = ouvertesParRecette(imports); return deLEdition(recipes, editionId).filter((r) => !o.has(r.id)); }
export function referencesOccupees(recipes, { editionId = null, imports = [] } = {}) { const o = ouvertesParRecette(imports); return deLEdition(recipes, editionId).filter((r) => o.has(r.id)); }
// Titre : la règle de `discordance` du lot A (chaque mot distinctif de la référence apparaît dans le titre lu ; une référence sans mot distinctif ne
// concorde jamais par le titre) ; page : les deux connues et |écart| ≤ PROCHE_PAGE.
export function concordance(groupe, reference) {
  const lus = new Set(motsDistinctifs(typeof groupe?.title === 'string' ? groupe.title : ''));
  const attendus = motsDistinctifs(typeof reference?.original_title === 'string' ? reference.original_title : '');
  const titre = attendus.length > 0 && attendus.every((m) => lus.has(m));
  const pg = Number.isInteger(groupe?.printed_page) ? groupe.printed_page : null;
  const pr = Number.isInteger(reference?.printed_page) ? reference.printed_page : null;
  const ecart = pg !== null && pr !== null ? Math.abs(pg - pr) : null;
  return { titre, page: ecart !== null && ecart <= PROCHE_PAGE, ecart };
}
// Départage (il n'ORDONNE que le sélecteur, il ne choisit jamais) : plus petit écart, écart inconnu en dernier, puis titre de référence le plus long en
// mots distinctifs, puis page, puis identifiant.
const pageOuInfini = (r) => (Number.isInteger(r?.printed_page) ? r.printed_page : Infinity);
const ordonner = (xs) => [...xs].sort((a, b) => ((a.ecart === null) - (b.ecart === null)) || ((a.ecart ?? 0) - (b.ecart ?? 0))
  || (motsDistinctifs(b.r.original_title).length - motsDistinctifs(a.r.original_title).length)
  || ((pageOuInfini(a.r) - pageOuInfini(b.r)) || 0) || String(a.r.id).localeCompare(String(b.r.id))).map((x) => x.r.id);
// La règle de proposition (D-D5) : la meilleure classe non vide dans l'ordre sûre > titre > page ; deux candidates ou plus → `plusieurs` (rien de coché,
// recipe_id nul, `ordre` = elles) ; une seule : sûre → cochée, sauf si elle est aussi la sûre UNIQUE d'un autre groupe → `conflit` pour chacun,
// décochée ; titre ou page → proposée décochée ; aucune → `aucune`. Un groupe de la personne → `aucune`. Rend Map(cle → { recipe_id, certitude,
// motif, cochee, ordre }).
export function proposerAppariements(groupes, candidats) {
  const cands = liste(candidats);
  const brutes = new Map();
  for (const g of liste(groupes)) {
    if (!g || typeof g.cle !== 'string') continue;
    if (g.origine === 'personne') { brutes.set(g.cle, { classe: null, ordre: [] }); continue; }
    const par = { sure: [], titre: [], page: [] };
    for (const r of cands) {
      const c = concordance(g, r);
      const classe = c.titre && c.page ? 'sure' : c.titre ? 'titre' : c.page ? 'page' : null;
      if (classe) par[classe].push({ r, ecart: c.ecart });
    }
    const classe = ['sure', 'titre', 'page'].find((k) => par[k].length) ?? null;
    brutes.set(g.cle, { classe, ordre: classe ? ordonner(par[classe]) : [] });
  }
  const suresUniques = new Map();
  for (const b of brutes.values()) if (b.classe === 'sure' && b.ordre.length === 1) suresUniques.set(b.ordre[0], (suresUniques.get(b.ordre[0]) || 0) + 1);
  const sortie = new Map();
  for (const [cle, b] of brutes) {
    if (!b.classe) sortie.set(cle, { recipe_id: null, certitude: 'aucune', motif: null, cochee: false, ordre: [] });
    else if (b.ordre.length >= 2) sortie.set(cle, { recipe_id: null, certitude: 'incertaine', motif: 'plusieurs', cochee: false, ordre: b.ordre });
    else if (b.classe === 'sure' && suresUniques.get(b.ordre[0]) > 1) sortie.set(cle, { recipe_id: b.ordre[0], certitude: 'incertaine', motif: 'conflit', cochee: false, ordre: b.ordre });
    else if (b.classe === 'sure') sortie.set(cle, { recipe_id: b.ordre[0], certitude: 'sure', motif: 'titre_et_page', cochee: true, ordre: b.ordre });
    else sortie.set(cle, { recipe_id: b.ordre[0], certitude: 'incertaine', motif: b.classe, cochee: false, ordre: b.ordre });
  }
  return sortie;
}
// Le sélecteur de repli : par page croissante (inconnues à la fin) puis titre normalisé ; requête vide → toutes ; faite de chiffres → page égale OU titre
// qui la contient ; sinon le titre normalisé contient la requête normalisée (casse et accents ignorés).
export function filtrerReferences(candidats, requete) {
  const q = typeof requete === 'string' ? requete.trim() : '';
  const tries = [...liste(candidats)].sort((a, b) => ((pageOuInfini(a) - pageOuInfini(b)) || 0) || normalizeText(a?.original_title).localeCompare(normalizeText(b?.original_title)));
  if (!q) return tries;
  if (/^\d+$/.test(q)) return tries.filter((r) => (Number.isInteger(r?.printed_page) && r.printed_page === Number(q)) || String(r?.original_title ?? '').includes(q));
  const n = normalizeText(q);
  return tries.filter((r) => normalizeText(r?.original_title).includes(n));
}

// --- Le plan de lecture (§ 3.3, D-D4) : une ligne `recette` par groupe qui garde au moins une page PRÉSENTE, fabriquée par ligneImportNeuve, dans
// l'ordre des groupes ; rang 1..n et total n sur les seules lignes créées ; recipe_id = le choix ou null ; lot avec le titre et la page du CLASSEMENT
// (estTitreUneLigne, 1..9999). Deux groupes sur la même référence, une page hors classement.page_ids ou dans deux groupes → TypeError : l'écran
// l'empêche, c'est un défaut de programme, jamais un état de la personne. `deviceId` est OBLIGATOIRE (ronde 1, comme fabriquerImportWeb du lot B) :
// oublié (undefined) → TypeError, jamais N lignes nées sans appareil (progressionLots ne les compterait pas « ici », un vol y serait jugé d'un autre
// appareil) ; un null explicite reste admis (repo pas encore initialisé).
export function lecturesDuLot(etat, choix, { classement, editionId = null, sessionId = null, deviceId, newId, pagesParId } = {}) {
  if (deviceId === undefined) throw new TypeError('lecturesDuLot : deviceId requis (repo.deviceId())');
  const autorisees = new Set(liste(classement?.page_ids));
  const vues = new Set();
  const refs = new Set();
  const gardes = [];
  for (const g of liste(etat?.groupes)) {
    for (const p of liste(g.page_ids)) {
      if (!autorisees.has(p) || vues.has(p)) throw new TypeError('lecturesDuLot : page hors du classement ou dans deux groupes (' + String(p) + ')');
      vues.add(p);
    }
    const presentes = liste(g.page_ids).filter((p) => pagesParId instanceof Map && pagesParId.has(p));
    if (!presentes.length) continue;
    const rid = choix instanceof Map && typeof choix.get(g.cle) === 'string' ? choix.get(g.cle) : null;
    if (rid) { if (refs.has(rid)) throw new TypeError('lecturesDuLot : deux groupes sur la même référence (' + rid + ')'); refs.add(rid); }
    gardes.push({ g, presentes, rid });
  }
  const total = gardes.length;
  const lignes = gardes.map(({ g, presentes, rid }, i) => ({
    ...ligneImportNeuve({ id: newId('imp'), kind: 'recette', recipe_id: rid, edition_id: editionId, scan_session_id: sessionId, page_ids: presentes, device_id: deviceId }),
    lot: { classement_id: classement.id, rang: i + 1, total, titre: estTitreUneLigne(g.title, BORNES_CLASSEMENT.titre) ? g.title : null, page: pageValide(g.printed_page) ? g.printed_page : null },
  }));
  return { lignes, references: [...refs] };
}
// Ronde 1 de la tâche 4 (revue : constats 1 et 3 ; décision à ratifier) : une ligne de lot n'est à LIRE que si sa référence l'est encore — sans
// référence (recipe_id nul : la lecture ira à « Regrouper en recette »), ou une référence PRÉSENTE ici qui n'est pas `available`. Une référence complétée
// entre-temps (saisie à la main, reçue par la synchro) ou absente (pas encore reçue, supprimée) : un POST ne servirait à rien — lignesImports n'offre
// alors qu'« Ignorer » (ou aucun geste), l'écran ciblé refuse une recette qui a son texte. UNE règle, pour le compte de « Continuer »
// (progressionLots → restantesIci) et pour lireLeLot (la référence relue juste avant chaque lancement : sautée sans écriture ni POST).
export function referenceALire(ligne, recette) {
  if (typeof ligne?.recipe_id !== 'string' || !ligne.recipe_id) return true; // comme lignesImports (chaine) : pas de référence
  return !!recette && typeof recette === 'object' && recette.availability !== 'available';
}
// La progression des lots (§ 4.7), sur TOUTES les lignes relues (enregistre et ignore comprises) à lot valide : Map(classement_id → { total, lues
// (a_verifier + enregistre), echecs, ignorees, restantes (a_lancer), restantesIci (a_lancer de cet appareil, À LIRE : referenceALire sur recipesById —
// sans Map, une référence est inconnue, donc jamais comptée), ouvertes (statut non terminal), edition_id }). Ronde 1 : les lignes `recette` seules.
export function progressionLots(imports, { deviceId = null, recipesById = null } = {}) {
  const m = new Map();
  const recettes = recipesById instanceof Map ? recipesById : new Map();
  for (const i of liste(imports)) {
    const lot = lotDeRecette(i);
    if (!lot) continue;
    const p = m.get(lot.classement_id) ?? { total: 0, lues: 0, echecs: 0, ignorees: 0, restantes: 0, restantesIci: 0, ouvertes: 0, edition_id: i.edition_id ?? null };
    p.total = Math.max(p.total, lot.total);
    if (i.status === 'a_verifier' || i.status === 'enregistre') p.lues += 1;
    if (i.status === 'echec') p.echecs += 1;
    if (i.status === 'ignore') p.ignorees += 1;
    if (i.status === 'a_lancer') { p.restantes += 1; if (deviceId && i.device_id === deviceId && referenceALire(i, recettes.get(i.recipe_id))) p.restantesIci += 1; }
    if (IMPORTS_OUVERTS.includes(i.status)) p.ouvertes += 1;
    m.set(lot.classement_id, p);
  }
  return m;
}
// Les blocs de la section « Imports » : les lignes d'un même lot réunies en un bloc, placé où apparaît la plus récente (la première rencontrée : lignesImports
// rend la plus récente d'abord), triées par rang ; les autres gardent leur place.
export function blocsImports(lignes) {
  const sortie = [];
  const blocs = new Map();
  for (const l of liste(lignes)) {
    const id = l?.lot?.classement_id;
    if (typeof id !== 'string') { sortie.push({ type: 'ligne', ligne: l }); continue; }
    if (!blocs.has(id)) { const b = { type: 'lot', classementId: id, lignes: [] }; blocs.set(id, b); sortie.push(b); }
    blocs.get(id).lignes.push(l);
  }
  for (const b of blocs.values()) b.lignes.sort((x, y) => x.lot.rang - y.lot.rang);
  return sortie;
}

// --- La suite du lot (D-D10, R-D-4 ; défaut FERMÉ) : une seule liste fermée dit ce qui laisse continuer — ces pages-ci, lues, ont donné une réponse
// inutilisable — plus `requete` quand la ligne RELUE porte erreur.extra.trop_lourd (le 413 : la suivante peut passer). Toute autre raison arrête, y
// compris toute raison future ou inconnue : il n'y a pas de liste « arrêt » à tenir. Refus de lancerExtraction : les six de REFUS_SAUT_LOT sautent ce
// groupe ; tout autre refus arrête. REFUS_ARRET_LOT (nommée par la spec § 3.6) est DOCUMENTAIRE pour suiteDuLot, qui ne la lit pas (c'est son défaut
// fermé qui arrête ; valeur épinglée par T-D7, ronde 1) ; la section « Imports » la lit pour DIRE un arrêt de « Continuer » (ronde 1 de la tâche 4).
export const RAISONS_SUITE_LOT = Object.freeze(['coupe', 'illisible', 'hors_bornes', 'vide']);
export const REFUS_ARRET_LOT = Object.freeze(['vol_tenu', 'hors_ligne', 'non_connecte']);
export const REFUS_SAUT_LOT = Object.freeze(['inconnu', 'transition', 'sans_page', 'image', 'octets_absents', 'sorte']);
export function suiteDuLot(retour, ligne) {
  if (retour?.issue === 'a_verifier') return 'continuer';
  if (retour?.issue === 'echec') {
    if (RAISONS_SUITE_LOT.includes(retour.raison)) return 'continuer';
    if (retour.raison === 'requete' && ligne?.erreur?.extra?.trop_lourd === true) return 'continuer';
    return 'arreter';
  }
  if (retour?.issue === 'refuse') return REFUS_SAUT_LOT.includes(retour.raison) ? 'sauter' : 'arreter';
  return 'arreter';
}
// Ne pas payer deux fois les mêmes photos (D-D15) : les page_ids des imports OUVERTS (importOuvert) de cette séance, toute sorte listée, hors la ligne `sauf`.
export function pagesEnCours(imports, sessionId, { sauf = null } = {}) {
  const s = new Set();
  for (const i of liste(imports)) if (importOuvert(i) && i.scan_session_id === sessionId && i.id !== sauf) for (const p of liste(i.page_ids)) s.add(p);
  return s;
}
