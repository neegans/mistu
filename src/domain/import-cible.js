// Domaine PUR de l'import ciblé (lot A « Importer une recette repérée », spec docs/superpowers/specs/2026-10-18-import-cible-design.md :
// § 3.1 transitions du journal, § 4.3.3 discordance, § 4.3.4 fabrication, § 4.4 raisons d'échec, § 4.5 âge, § 4.1 séance exclue).
// Aucun accès à la base, aucun réseau, aucun texte d'écran : l'écran (src/ui/import-cible.js, tâche 4) traduit et écrit par repo.transitionner.
// La sortie du modèle est une DONNÉE HOSTILE déjà validée et bornée par validateParsedRecipe (llm.js) : ici elle est seulement assemblée.
import { normalizeText } from './units.js';
import { parseIngredientLine, detectTimers } from './lines.js';
import { assertVocabulaire } from './vocabulaire.js';
import { newId } from '../core/ids.js';

// --- Transitions du journal (spec § 3.1) : toutes par repo.transitionner (I-10) ; aucune autre. `en_cours → echec` couvre annule,
// interrompu et incertain (la raison est dans `erreur`). Les deux états terminaux n'en permettent aucune.
export const TRANSITIONS = Object.freeze({
  a_lancer: ['en_cours', 'ignore'],
  en_cours: ['a_verifier', 'echec'],
  a_verifier: ['enregistre', 'a_lancer', 'ignore'],
  echec: ['en_cours', 'a_lancer', 'ignore'],
  enregistre: [],
  ignore: [],
});
export const transitionPermise = (de, vers) => typeof de === 'string' && Object.hasOwn(TRANSITIONS, de) && TRANSITIONS[de].includes(vers);

// --- Raisons d'échec (spec § 4.4, liste fermée) : celles que la passerelle classe (echecDomaine, llm.js : le message de l'Error), puis
// celles de l'extraction et du journal. `trop_lourd` figure pour la ligne « 413 » du tableau (le domaine l'écrit `requete` + extra).
export const RAISONS_ECHEC = Object.freeze(['non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'trop_lourd', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible',
  'annule', 'coupe', 'illisible', 'hors_bornes', 'vide', 'interrompu', 'incertain']);

// --- Discordance (spec D-6, § 4.3.3, Review Focus 2). Mots vides : la liste FERMÉE fr/en de la spec, possessifs compris.
export const MOTS_VIDES = Object.freeze(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'au', 'aux', 'à', 'et', 'en', 'un', 'une', 'ma', 'mon', 'mes', 'ta', 'ton', 'tes', 'sa', 'son', 'ses',
  'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'the', 'of', 'and', 'with', 'a', 'an', 'my', 'your', 'our']);
const VIDES_NORMALISES = new Set(MOTS_VIDES.map((m) => normalizeText(m)));
// Découpage sur espaces, apostrophes (normalizeText ramène ’ à '), traits d'union (et tirets Unicode) et points ; accents et casse aplatis.
const SEPARATEURS = /[\s'.\-‐-―]+/u;
export function motsDistinctifs(titre) {
  return normalizeText(titre).split(SEPARATEURS).filter((m) => m && !VIDES_NORMALISES.has(m));
}

// { ok, raison: null | 'titre_nul' | 'titre' | 'page', titreLu, pageLue }. Le titre est jugé avant la page : CHAQUE mot distinctif de la
// référence doit apparaître dans les mots du titre lu (un titre plus long qui les contient tous est concordant) ; la page ne joue que si
// les deux sont connues (entiers), à ± 3 ; un titre lu nul, blanc ou non chaîne est une discordance (rien d'inventé).
export function discordance(resultat, reference) {
  const titreLu = typeof resultat?.title === 'string' && resultat.title.trim() ? resultat.title.trim() : null;
  const pageLue = Number.isInteger(resultat?.printed_page) ? resultat.printed_page : null;
  const verdict = (ok, raison) => ({ ok, raison, titreLu, pageLue });
  if (titreLu === null) return verdict(false, 'titre_nul');
  const lus = new Set(motsDistinctifs(titreLu));
  if (!motsDistinctifs(reference?.original_title).every((m) => lus.has(m))) return verdict(false, 'titre');
  const pageRef = Number.isInteger(reference?.printed_page) ? reference.printed_page : null;
  if (pageLue !== null && pageRef !== null && Math.abs(pageLue - pageRef) > 3) return verdict(false, 'page');
  return verdict(true, null);
}

// --- Ordre des pages (spec § 4.2.2) : `page_ids` est la seule source de vérité de l'ordre. Un NOUVEAU tableau à chaque fois ; monter en
// tête, descendre en queue ou nommer une page inconnue ne change rien. `sens` : -1 monter, +1 descendre.
export function deplacerPage(pageIds, id, sens) {
  const liste = [...pageIds];
  const i = liste.indexOf(id);
  const j = i + (sens < 0 ? -1 : 1);
  if (i < 0 || !sens || j < 0 || j >= liste.length) return liste;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  return liste;
}
export const retirerPage = (pageIds, id) => pageIds.filter((p) => p !== id);

// --- Fabrication (spec § 4.3.4, I-5, I-6) : la version `extraction` et la fiche écrites DANS la référence (même identifiant, I-2), les pages
// à réécrire (kind recipe, position = ordre choisi, printed_page) et le drapeau `remplacement` (I-5, N4 : une version non produite par
// l'assistant existe → l'écran demande « Remplacer par cette lecture ? »). La fiche rendue fait TOUJOURS de la nouvelle version la
// courante ; sur « non », c'est l'écran qui n'écrit que l'union des pages, `kind: 'recipe'` et la photo du plat (ce qu'il a promis).
//   resultat : la sortie validée de validateParsedRecipe ; reference : la fiche RELUE juste avant la transaction (leçon C4) ;
//   versions : ses versions ; pages : lignes source_pages (tableau ou Map par id) ; pageIds : l'ordre de lecture (une page absente de
//   `pages` est ignorée : pointeur souple, § 3.1) ; edition, convention (figée en snapshot) ; importId (souple) ; modele (celui du
//   serveur) ; photo : { sha256, origin } | null (origin ∈ photo | image, sinon null) ; maintenant : created_at de la version.
// Les lignes passent par parseIngredientLine (identité proposée, jamais vérifiée : N-8) ; les étapes sont construites DIRECTEMENT, une par
// entrée du modèle, sauts de ligne gardés (jamais parseStepsBlock, I5), avec les clés de detectTimers. assertVocabulaire garde la fiche (D-12).
const ORIGINES_PHOTO = ['photo', 'image'];
export function fabriquerExtraction(resultat, { reference, versions = [], pages = [], pageIds = [], edition = null, convention = null, importId = null, modele = null, photo = null, maintenant = null } = {}) {
  const parId = pages instanceof Map ? pages : new Map((pages || []).map((p) => [p.id, p]));
  const presentes = pageIds.filter((id) => parId.has(id));
  const ingredients = (resultat.ingredients || []).map((l) => ({ ...parseIngredientLine(l.source_text), uncertain: l.uncertain === true, verification_state: 'to_verify' }));
  const steps = (resultat.steps || []).map((s, i) => ({ id: newId('st'), position: i + 1, text: s.text, ...detectTimers(s.text) }));
  const incomplete = resultat.incomplete === true;
  const missing_page = resultat.missing_page === true;
  const version = {
    id: newId('rv'), recipe_id: reference.id, kind: 'extraction', parent_version_id: reference.current_version_id || null, status: null,
    servings: resultat.servings ?? null, prep_minutes: resultat.prep_minutes ?? null, cook_minutes: resultat.cook_minutes ?? null, active_minutes: null, total_minutes: null,
    ingredients, steps, constraints: {}, changes: '', notes: resultat.notes ?? null,
    provenance: {
      source_page_ids: presentes, source_document_id: presentes.length ? (parId.get(presentes[0]).document_id ?? null) : null, generated_by: 'ai', model: modele ?? null,
      edition_id: edition?.id ?? reference.edition_id ?? null, convention_snapshot: convention ? { id: convention.id, revision: convention.revision, values: convention.values } : null,
      import_id: importId ?? null, incomplete, missing_page, titre_lu: typeof resultat.title === 'string' ? resultat.title : null,
    },
    verification_state: 'to_verify',
    ...(maintenant ? { created_at: maintenant } : {}),
  };
  const availability = ingredients.length && steps.length && !incomplete && !missing_page ? 'available' : 'partial';
  const recipe = {
    ...reference,
    printed_page: reference.printed_page ?? resultat.printed_page ?? null,
    source_page_ids: [...new Set([...(reference.source_page_ids || []), ...presentes])],
    photo_sha256: photo ? photo.sha256 : (reference.photo_sha256 ?? null),
    photo_origin: photo ? (ORIGINES_PHOTO.includes(photo.origin) ? photo.origin : null) : (reference.photo_origin ?? null),
    ingredient_ids: [...new Set(ingredients.map((l) => l.ingredient_id).filter(Boolean))],
    availability, verification_state: version.verification_state, current_version_id: version.id,
  };
  assertVocabulaire(recipe, 'recipes'); // D-12 : le fabricant vérifie le vocabulaire fermé avant toute écriture
  const pageUpdates = presentes.map((id, i) => ({ ...parId.get(id), kind: 'recipe', position: i + 1, printed_page: parId.get(id).printed_page ?? recipe.printed_page ?? null }));
  const remplacement = versions.some((v) => v?.provenance?.generated_by !== 'ai');
  return { recipe, version, pageUpdates, remplacement };
}

// --- Âge d'une ligne (spec § 4.5) : { n, unite: 'min' | 'h' | 'j' }, arrondi vers le bas ; l'écran traduit (« il y a {n} min / h / j »).
// Une horloge en avance ou une date illisible vaut 0 min : jamais négatif, jamais NaN. `maintenant` : ISO, Date ou millisecondes.
const enMs = (x) => (x instanceof Date ? x.getTime() : typeof x === 'number' ? x : Date.parse(x));
export function ageDepuis(iso, maintenant) {
  const a = enMs(iso), b = enMs(maintenant);
  const minutes = Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / 60000)) : 0;
  if (minutes < 60) return { n: minutes, unite: 'min' };
  if (minutes < 1440) return { n: Math.floor(minutes / 60), unite: 'h' };
  return { n: Math.floor(minutes / 1440), unite: 'j' };
}

// --- Séance de l'écran ciblé (spec § 4.1, N3) : SEULE la séance d'un import `kind: 'recette'` AVEC `recipe_id`, non terminé, est exclue des
// rappels génériques (« Séances à reprendre », « Séance en cours », « Photos conservées ») ; elle y réapparaît sur enregistre / ignore.
const TERMINES = ['enregistre', 'ignore'];
export function seanceDUnImportCible(seance, imports) {
  return (Array.isArray(imports) ? imports : []).some((i) => i && i.kind === 'recette' && !!i.recipe_id && i.scan_session_id === seance?.id && !TERMINES.includes(i.status));
}
