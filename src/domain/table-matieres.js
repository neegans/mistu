// Table des matières sur plusieurs photos (lot C, spec docs/superpowers/specs/2026-10-19-table-des-matieres-design.md, § 3.5) : domaine PUR — aucun
// DOM, aucun t(), aucune base. La lecture du modèle est une DONNÉE HOSTILE déjà validée par validerLectureIndex (llm.js) ; ici : la correspondance
// photo ↔ page ENVOYÉE, la revalidation d'un résultat revenu du journal (synchro, archive), l'ordre proposé, le tableau d'entrées, le plan de création
// et la fabrication des références. Une seule direction d'import : table-matieres.js → llm.js, jamais l'inverse (F-6). Aucun objet du modèle n'est
// recopié tel quel : chaque objet rendu est construit champ par champ (I-C2).
import { validerLectureIndex, extraireTableMatieres, ErreurExtraction, BORNES_INDEX, MAX_TOKENS_INDEX, uneLigne } from './llm.js';
import { normalizeText } from './units.js';
import { assertVocabulaire } from './vocabulaire.js';
import { borner } from '../core/bornes.js';
import { importOuvert } from './import-cible.js';

const objetNu = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const liste = (v) => (Array.isArray(v) ? v : []);
const copieEntree = (e) => ({ title: e.title, printed_page: e.printed_page, section: e.section, uncertain: e.uncertain });
const copiePlage = (p) => (Array.isArray(p) ? [p[0], p[1]] : null);

// --- Correspondance photo ↔ page (§ 3.2, D-C21) : `pageIds` = les pages ENVOYÉES par lancerVol, dans l'ordre ; page_id = pageIds[photo − 1] ;
// blocs rendus dans l'ordre 1..N, un numéro sans bloc → bloc vide, deux blocs du même numéro → entrées concaténées (première plage non nulle).
export function resultatIndex(lecture, pageIds) {
  const ids = liste(pageIds);
  const blocs = liste(lecture?.photos);
  const photos = ids.map((pageId, i) => {
    const miens = blocs.filter((b) => b && b.photo === i + 1);
    const plage = miens.map((b) => b.printed_page_range).find((p) => Array.isArray(p)) ?? null;
    return { page_id: typeof pageId === 'string' ? pageId : null, printed_page_range: copiePlage(plage), entries: miens.flatMap((b) => liste(b.entries).map(copieEntree)) };
  });
  const e = objetNu(lecture?.ecartees) ? lecture.ecartees : {};
  return { photos, ecartees: { trop_longues: Number.isInteger(e.trop_longues) ? e.trop_longues : 0, adresse: Number.isInteger(e.adresse) ? e.adresse : 0 }, uncertain: liste(lecture?.uncertain).filter((u) => typeof u === 'string') };
}

// --- Revalidation (§ 3.5, I-C2, m5, Q1, D-C11) : un `resultat` relu du journal passe les MÊMES règles que la lecture. Forme C : chaque bloc stocké
// (page_id) est traduit en bloc numéroté (photo = rang + 1), validé, puis son page_id reposé ; un page_id doit être null ou une chaîne de `pageIds`,
// jamais deux fois ; `ecartees` stocké = deux entiers 0..9 999 lus par Object.hasOwn ; le rendu = comptes stockés + comptes de cette validation.
// Forme A ({ entries, uncertain }, lot A) : UNE photo inconnue. Tout le reste → null (l'écran écrit echec(illisible)).
export function revaliderResultatIndex(brut, pageIds) {
  const ids = liste(pageIds);
  if (!objetNu(brut)) return null;
  try {
    if (Object.hasOwn(brut, 'photos')) {
      const blocs = brut.photos;
      const stockees = Object.hasOwn(brut, 'ecartees') ? brut.ecartees : undefined;
      if (!Array.isArray(blocs) || !blocs.length || !objetNu(stockees)) return null;
      const compte = (k) => (Object.hasOwn(stockees, k) ? stockees[k] : undefined);
      const tl = compte('trop_longues'); const ad = compte('adresse');
      if (![tl, ad].every((x) => Number.isInteger(x) && x >= 0 && x <= BORNES_INDEX.ecartees)) return null;
      const pages = []; const traduits = [];
      for (const [i, b] of blocs.entries()) {
        if (!objetNu(b) || !Object.hasOwn(b, 'page_id')) return null;
        const pid = b.page_id;
        if (pid !== null && !(typeof pid === 'string' && ids.includes(pid))) return null;
        if (pid !== null && pages.includes(pid)) return null;
        pages.push(pid);
        traduits.push({ photo: i + 1, printed_page_range: Object.hasOwn(b, 'printed_page_range') ? b.printed_page_range : null, entries: Object.hasOwn(b, 'entries') ? b.entries : [] });
      }
      const lecture = validerLectureIndex({ photos: traduits, uncertain: Object.hasOwn(brut, 'uncertain') ? brut.uncertain : [] }, { nbPhotos: blocs.length });
      const somme = { trop_longues: tl + lecture.ecartees.trop_longues, adresse: ad + lecture.ecartees.adresse };
      if (somme.trop_longues > BORNES_INDEX.ecartees || somme.adresse > BORNES_INDEX.ecartees) return null;
      return { photos: lecture.photos.map((p, i) => ({ page_id: pages[i], printed_page_range: p.printed_page_range, entries: p.entries })), ecartees: somme, uncertain: lecture.uncertain };
    }
    if (Object.hasOwn(brut, 'entries') && Array.isArray(brut.entries)) {
      const lecture = validerLectureIndex({ photos: [{ photo: 1, printed_page_range: null, entries: brut.entries }], uncertain: Object.hasOwn(brut, 'uncertain') ? brut.uncertain : [] }, { nbPhotos: 1 });
      return { photos: [{ page_id: null, printed_page_range: null, entries: lecture.photos[0].entries }], ecartees: lecture.ecartees, uncertain: lecture.uncertain };
    }
    return null;
  } catch (e) { if (e instanceof ErreurExtraction) return null; throw e; }
}

// --- Ordre (D-C3, D-C15, S-19) -------------------------------------------------------------------------------------------------------------------
// Tri STABLE par la première page citée, plage nulle à la fin, égalité → rang d'envoi.
export function ordrePropose(photos) {
  const p = liste(photos).map((x, rang) => ({ id: x?.page_id ?? null, de: Array.isArray(x?.printed_page_range) ? x.printed_page_range[0] : null, rang }));
  p.sort((a, b) => (a.de === null) - (b.de === null) || (a.de ?? 0) - (b.de ?? 0) || a.rang - b.rang);
  return p.map((x) => x.id);
}
export const memeOrdre = (a, b) => { const A = liste(a); const B = liste(b); return A.length === B.length && A.every((x, i) => x === B[i]); };
// Les N pages de `ordre` reçoivent, dans l'ordre choisi, les N positions qu'elles occupaient déjà, triées par (position entière, sinon +∞) puis par
// rang dans la séance (`pageIdsSeance` : une position absente, dupliquée ou non entière peut venir d'un autre appareil ou d'une archive) ; les valeurs
// sont réassignées TELLES QUELLES (rien d'inventé). Une page absente de `pagesParId` est ignorée. Copies : la Map n'est jamais modifiée.
export function positionsProposees(ordre, pagesParId, pageIdsSeance = []) {
  const pages = pagesParId instanceof Map ? pagesParId : new Map();
  const seance = liste(pageIdsSeance);
  const rangSeance = (id) => { const k = seance.indexOf(id); return k < 0 ? Infinity : k; };
  const presents = [...new Set(liste(ordre))].filter((id) => pages.has(id));
  const cle = (id) => { const p = pages.get(id).position; return Number.isInteger(p) ? p : Infinity; };
  const creneaux = [...presents].sort((a, b) => (cle(a) - cle(b)) || (rangSeance(a) - rangSeance(b))).map((id) => pages.get(id).position);
  return { pages: presents.map((id, i) => ({ ...pages.get(id), position: creneaux[i] })), ordre: presents };
}
// Les identifiants de `ordre` remis dans LEURS propres créneaux de la séance ; les autres intacts ; un identifiant absent de la séance est ignoré.
export function reordonnerSeance(pageIdsSeance, ordre) {
  const seance = liste(pageIdsSeance);
  const voulus = [...new Set(liste(ordre))].filter((id) => seance.includes(id));
  const aRemplacer = new Set(voulus);
  let k = 0;
  return seance.map((id) => (aRemplacer.has(id) ? voulus[k++] : id));
}
// Des identifiants (cochés : un Set dans l'ordre de COCHAGE) remis dans l'ordre de la séance ; hors séance → écartés (F-9).
export function trierParSeance(ids, pageIdsSeance) {
  const seance = liste(pageIdsSeance);
  return [...new Set(liste(ids))].filter((id) => seance.includes(id)).sort((a, b) => seance.indexOf(a) - seance.indexOf(b));
}
// Les pages à lire (N-2) : les cochées présentes, triées par la séance ; sinon les page_ids de la ligne ouverte présents ET de la séance (vague finale,
// constat 13 : une ligne reçue, I-C2, peut citer la page d'une autre séance — jamais envoyée), dans leur ordre ; sinon [].
export function pagesALire(cochees, ligne, pageIdsSeance, pagesParId) {
  const present = (id) => typeof id === 'string' && pagesParId instanceof Map && pagesParId.has(id);
  const choisies = trierParSeance(liste(cochees).filter(present), pageIdsSeance);
  if (choisies.length) return choisies;
  return [...new Set(liste(ligne?.page_ids).filter(present).filter((id) => liste(pageIdsSeance).includes(id)))]; // dédoublonnés : page_ids est une donnée de synchro (I-C2), un doublon enverrait deux fois une image
}

// --- Tableau d'entrées (D-C4, D-C12, D-C18, R-C-3) -----------------------------------------------------------------------------------------------
export const cleReference = (titre, page) => `${normalizeText(titre)}|${page ?? ''}`;
export const coherencePagePlage = (page, plage) => Number.isInteger(page) && Array.isArray(plage) && (page < plage[0] || page > plage[1]);
const clesDe = (existantes) => new Set(liste(existantes).filter(Boolean).map((r) => cleReference(r.original_title, r.printed_page)));
// Lignes dans l'ordre COURANT des photos (rang de leur page_id dans `ordre`), entrées dans leur ordre ; le rang de la photo est réécrit.
export function trierLignes(lignes, ordre) {
  const rang = new Map(liste(ordre).map((id, k) => [id, k + 1]));
  return liste(lignes).map((l, k) => ({ l, k, r: rang.has(l.photo?.page_id) ? rang.get(l.photo.page_id) : Infinity }))
    .sort((a, b) => (a.r - b.r) || (a.k - b.k))
    .map(({ l, r }) => ({ ...l, photo: { ...l.photo, rang: Number.isFinite(r) ? r : l.photo.rang } }));
}
// La forme que le fabricant ÉCRIT (vague finale, constat 2) : une ligne (uneLigne), bornée à 200 points de code. La clé d'une ligne du tableau se calcule
// sur elle, comme celle des fiches existantes (original_title) : une relecture reconnaît ce qui a été créé (D-C5).
const titreEcrit = (l) => borner(uneLigne(l?.title) ?? '', BORNES_INDEX.titre);
// Recalcul après une édition : déjà repérée (clé dans `existantes`, les recettes de l'ÉDITION), en double (clé déjà PRISE plus haut par une ligne créable
// que la personne n'a pas décochée — vague finale, constat 7 : décocher une occurrence libère la suivante), créable, hors plage ; cochée = créable et
// non décochée par la personne (une ligne qui cesse d'être déjà repérée est recochée, sauf décochée à la main).
export function recalculer(lignes, existantes = []) {
  const deja = clesDe(existantes);
  const vues = new Set();
  return liste(lignes).map((l) => {
    const cle = cleReference(titreEcrit(l), l.printed_page);
    const dejaReperee = deja.has(cle);
    const enDouble = !dejaReperee && vues.has(cle);
    const creable = !dejaReperee && !enDouble;
    if (creable && !l.decocheeParLaPersonne) vues.add(cle);
    return { ...l, horsPlage: coherencePagePlage(l.printed_page, l.photo?.plage ?? null), dejaReperee, enDouble, creable, cochee: creable && !l.decocheeParLaPersonne };
  });
}
// Une ligne par entrée ; clé stable « l{i} » dans l'ordre du résultat STOCKÉ (elle survit aux ↑/↓) ; photo { page_id, rang, plage }.
export function lignesTableau(resultat, { ordre = null, existantes = [] } = {}) {
  const photos = liste(resultat?.photos);
  let i = 0;
  const lignes = [];
  photos.forEach((p, rangEnvoi) => {
    for (const e of liste(p?.entries)) {
      lignes.push({ cle: `l${i++}`, photo: { page_id: p.page_id ?? null, rang: rangEnvoi + 1, plage: copiePlage(p.printed_page_range) }, titreLu: e.title, pageLue: e.printed_page ?? null, title: e.title, printed_page: e.printed_page ?? null, section: e.section ?? null, uncertain: e.uncertain === true, horsPlage: false, dejaReperee: false, enDouble: false, cochee: true, creable: true, decocheeParLaPersonne: false });
    }
  });
  return recalculer(trierLignes(lignes, ordre ?? photos.map((p) => p?.page_id ?? null)), existantes);
}
export function planCreation(lignes) {
  const ls = liste(lignes);
  return {
    aCreer: ls.filter((l) => l.creable && l.cochee && titreEcrit(l)),
    ecartees: { dejaReperees: ls.filter((l) => l.dejaReperee).length, enDouble: ls.filter((l) => l.enDouble).length, decochees: ls.filter((l) => l.creable && !l.cochee).length, sansTitre: ls.filter((l) => l.creable && l.cochee && !titreEcrit(l)).length },
  };
}
export const compteur = (lignes) => ({ lues: liste(lignes).length, dejaDans: liste(lignes).filter((l) => l.dejaReperee).length });

// raw_entry (§ 3.3, S-10) : « titre — page » tels que lus, ou la ligne tapée — au plus 300 points de code.
export const BORNE_RAW_ENTRY = 300;
// La page d'index mise à jour (D-C14) : kind posé s'il est nul, role 'index' si le kind résultant est index, plage CITÉE ; printed_page jamais écrit. Une
// fonction de la PAGE (ronde 1 de la tâche 2) : creerReferences l'applique à la page RELUE dans la transaction (condition de fusion), jamais à une copie lue
// avant (constat 23 de la ronde 1 de T1 : une « p. imprimée » ou une position posée entre-temps survit).
export const pageIndexee = (page, plage) => {
  const kind = page.kind ?? 'index';
  return { ...page, kind, role: kind === 'index' ? 'index' : (page.role ?? null), printed_page_range: copiePlage(plage), printed_page: page.printed_page ?? null };
};

// --- Fabrication (D-C3, D-C5, D-C11, D-C14, R-C-2, I-C11) : des fiches NEUVES seulement (une ligne non créable, même forcée dans le plan, ne produit
// rien) ; index_page_id = la photo si sa page est dans `pagesParId` (pointeur souple), sinon null ; source_page_ids jamais vers une page absente ;
// raw_entry = « titre — page » TELS QUE LUS ; pages : kind posé s'il est nul, role 'index' si le kind résultant est index, plage citée ; printed_page
// jamais écrit (D-C14). assertVocabulaire sur chaque fiche (D-12 du lot A). Ronde 1 : dernier mur avant `recipes`, le fabricant nettoie titre et section
// par `nettoyer` (Cc, Cf ET Cs : une demi-paire de substitution ferait refuser la fiche par le jsonb, S-11) avant de les borner, et ramène une
// printed_page hors 1..9 999 ou non entière à null (§ 4.4) — une ligne éditée dans le tableau ou forgée passe les MÊMES bornes que la lecture. Ronde 1 de
// T2 : raw_entry passe le même mur (nettoyer puis borner à BORNE_RAW_ENTRY) ; un titre lu absent n'y écrit jamais « undefined ». Vague finale (constats 2
// et 4) : titre, section et raw_entry passent d'abord par `uneLigne` (une fin de ligne vaut une espace, puis `nettoyer`) — jamais des mots collés.
export function fabriquerReferences(plan, { edition, pagesParId, resultat, pageIdsLigne = [], newId }) {
  const pages = pagesParId instanceof Map ? pagesParId : new Map();
  const recipes = [];
  for (const l of liste(plan?.aCreer)) {
    if (!l || !l.creable || l.dejaReperee || l.enDouble) continue; // R-C-2 : jamais une référence qui existe déjà
    const titre = titreEcrit(l); // vague finale (constats 2 et 4) : une ligne, jamais des mots collés par borner
    if (!titre) continue;
    const inconnue = l.photo?.page_id == null;
    const indexPageId = !inconnue && pages.has(l.photo.page_id) ? l.photo.page_id : null;
    const sectionLue = uneLigne(l.section);
    const section = sectionLue ? (borner(sectionLue, BORNES_INDEX.section) || null) : null;
    const page = Number.isInteger(l.printed_page) && l.printed_page >= 1 && l.printed_page <= BORNES_INDEX.page ? l.printed_page : null;
    const titreLu = typeof l.titreLu === 'string' ? l.titreLu : '';
    const fiche = {
      id: newId('rc'), edition_id: edition?.id ?? null, original_title: titre, original_language: edition?.language || null,
      availability: 'reference_only', verification_state: 'unverified', printed_page: page, section,
      type: null, tags: [], cuisines: [], favorite: false,
      source_page_ids: inconnue ? liste(pageIdsLigne).filter((id) => pages.has(id)) : (indexPageId ? [indexPageId] : []),
      current_version_id: null, ingredient_ids: [], index_page_id: indexPageId,
      raw_entry: borner(uneLigne(l.pageLue != null ? `${titreLu} — ${l.pageLue}` : titreLu) ?? '', BORNE_RAW_ENTRY),
      index_uncertain: l.uncertain === true || l.horsPlage === true,
    };
    assertVocabulaire(fiche, 'recipes'); // D-12 : « Créer les références » est un fabricant de recipes comme les autres
    recipes.push(fiche);
  }
  const pageUpdates = [];
  for (const p of liste(resultat?.photos)) {
    if (typeof p?.page_id !== 'string' || !pages.has(p.page_id)) continue;
    pageUpdates.push(pageIndexee(pages.get(p.page_id), p.printed_page_range));
  }
  return { recipes, pageUpdates };
}

// --- La ligne du journal (D-C16, D-C22) ------------------------------------------------------------------------------------------------------
// La ligne `kind: 'index'` OUVERTE de la séance (importOuvert du lot A : une définition) : `importId` s'il en désigne une ; sinon la plus récente
// (updated_at) ; sinon null.
export function ligneOuverteDeSeance(imports, sessionId, { importId = null } = {}) {
  if (!sessionId) return null;
  const ouvertes = liste(imports).filter((i) => importOuvert(i) && i.kind === 'index' && i.scan_session_id === sessionId);
  if (importId) { const l = ouvertes.find((i) => i.id === importId); if (l) return l; }
  return [...ouvertes].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0] ?? null;
}
// L'exécutant d'un index pour lancerVol (D-C21) : UN appel extraireTableMatieres, puis la correspondance sur les pages ENVOYÉES.
export async function executerIndex({ provider, images, pageIds, signal }) {
  const r = await extraireTableMatieres(provider, images, { signal, maxTokens: MAX_TOKENS_INDEX });
  return { resultat: resultatIndex(r.lecture, pageIds), texteBrut: r.texteBrut, modele: r.modele };
}
