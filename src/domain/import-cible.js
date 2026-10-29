// Domaine PUR de l'import ciblé (lot A « Importer une recette repérée », spec docs/superpowers/specs/2026-10-18-import-cible-design.md :
// § 3.1 transitions du journal, § 4.3.3 discordance, § 4.3.4 fabrication, § 4.4 raisons d'échec, § 4.5 âge et section « Imports », § 4.1 séance exclue).
// Aucun accès à la base, aucun réseau, aucun texte d'écran : l'écran (src/ui/import-cible.js, tâche 4) traduit et écrit par repo.transitionner.
// La sortie du modèle est une DONNÉE HOSTILE déjà validée et bornée par validateParsedRecipe (llm.js) : ici elle est seulement assemblée.
import { normalizeText } from './units.js';
import { parseIngredientLine, detectTimers } from './lines.js';
import { assertVocabulaire, originePhotoAdmise } from './vocabulaire.js';
import { newId } from '../core/ids.js';
import { lienSignet } from '../core/lien.js';
import { IMPORTS_TERMINES, STATUTS_IMPORT } from '../model/schema.js';
import { estTitreUneLigne } from '../core/bornes.js';
import { validerLectureCouverture, BORNES_CLASSEMENT } from './llm.js'; // lot E, ronde 1 de T5 : le titre lu d'une couverture (section « Imports ») est celui de la lecture REVALIDÉE ; vague finale : les bornes de lotDe

// --- Transitions du journal (spec § 3.1) : toutes par repo.transitionner (I-10) ; aucune autre. `en_cours → echec` couvre annule,
// interrompu et incertain (la raison est dans `erreur`). `a_verifier → echec` (T4-R1, ratifiée) couvre UN seul cas : un `resultat` relu du
// journal (synchro, archive) qui ne passe plus sa validation — validateParsedRecipe pour une recette, revaliderResultatIndex (forme C, lot C) pour un index — → echec(illisible),
// résultat effacé (I-1, § 4.5), conditionné à la lecture relue (tâche 6, ronde 1) ; c'est la seule écriture que le simple MONTAGE d'un écran peut
// faire, et trois écrans la font : l'écran ciblé, l'éditeur (?import=) et le panneau d'index (?import=). Une lecture SANS référence relancée sur
// d'autres pages (éditeur, panneau) passe `a_verifier → a_lancer → en_cours` en UNE transaction, après les gardes du vol (tâche 6, ronde 1 : un
// clic refusé n'écrit rien). Les deux états terminaux n'en permettent aucune. Gelée en PROFONDEUR (ronde 1) :
// un module qui pousserait dans un tableau lèverait au lieu de changer les transitions de toute l'app.
export const TRANSITIONS = Object.freeze({
  a_lancer: Object.freeze(['en_cours', 'ignore']),
  en_cours: Object.freeze(['a_verifier', 'echec']),
  a_verifier: Object.freeze(['enregistre', 'a_lancer', 'ignore', 'echec']),
  echec: Object.freeze(['en_cours', 'a_lancer', 'ignore']),
  enregistre: Object.freeze([]),
  ignore: Object.freeze([]),
});
export const transitionPermise = (de, vers) => typeof de === 'string' && Object.hasOwn(TRANSITIONS, de) && TRANSITIONS[de].includes(vers);

// --- Raisons d'échec (spec § 4.4, liste fermée) : celles que la passerelle classe (echecDomaine, llm.js : le message de l'Error), puis
// celles de l'extraction et du journal. Un 413 n'est PAS une raison : echecDomaine l'écrit `requete` + extra `trop_lourd` (ronde 1 : plus de valeur
// morte dans la liste). `non_connecte` y figure (la session peut disparaître entre le rendu et le clic : complete() le lève).
export const RAISONS_ECHEC = Object.freeze(['non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible',
  'annule', 'coupe', 'illisible', 'hors_bornes', 'vide', 'interrompu', 'incertain',
  // Lot B (D-B14) : les refus d'une lecture web (passerelle) et `lien` (une adresse dans le TITRE lu, R-B-2).
  'interdit', 'inaccessible', 'pas_une_page', 'page_trop_lourde', 'page_vide', 'lien']);

// --- Discordance (spec D-6, § 4.3.3, Review Focus 2). Mots vides : la liste FERMÉE fr/en de la spec, possessifs compris.
export const MOTS_VIDES = Object.freeze(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'au', 'aux', 'à', 'et', 'en', 'un', 'une', 'ma', 'mon', 'mes', 'ta', 'ton', 'tes', 'sa', 'son', 'ses',
  'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'the', 'of', 'and', 'with', 'a', 'an', 'my', 'your', 'our']);
const VIDES_NORMALISES = new Set(MOTS_VIDES.map((m) => normalizeText(m)));
// Découpage sur les espaces et sur TOUTE ponctuation (\p{P} : apostrophes — normalizeText ramène ’ à ' —, traits d'union et tirets Unicode,
// points, virgules, parenthèses, guillemets…) ; accents et casse aplatis. Ronde 1 : les quatre classes de la spec § 4.3.3 étendues à \p{P} —
// « Tarte, aux pommes » lu pour « Tarte aux pommes » ne fait plus un faux dialogue ; jamais une fausse concordance (un séparateur de plus ne
// fait que couper des mots, il n'en ajoute à la référence que ce que le titre lu doit aussi contenir).
const SEPARATEURS = /[\s\p{P}]+/u;
export function motsDistinctifs(titre) {
  return normalizeText(titre).split(SEPARATEURS).filter((m) => m && !VIDES_NORMALISES.has(m));
}

// { ok, raison: null | 'titre_nul' | 'titre' | 'page', titreLu, pageLue }. Le titre est jugé avant la page : CHAQUE mot distinctif de la
// référence doit apparaître dans les mots du titre lu (un titre plus long qui les contient tous est concordant) ; la page ne joue que si
// les deux sont connues (entiers), à ± 3 ; un titre lu nul, blanc ou non chaîne est une discordance (rien d'inventé). Une référence SANS
// mot distinctif (titre vide, fait de mots vides, absente) est une discordance de titre aussi (ronde 1) : `every` sur un ensemble vide
// dirait « concordant » et rattacherait n'importe quelle lecture sans question.
export function discordance(resultat, reference) {
  const titreLu = typeof resultat?.title === 'string' && resultat.title.trim() ? resultat.title.trim() : null;
  const pageLue = Number.isInteger(resultat?.printed_page) ? resultat.printed_page : null;
  const verdict = (ok, raison) => ({ ok, raison, titreLu, pageLue });
  if (titreLu === null) return verdict(false, 'titre_nul');
  const lus = new Set(motsDistinctifs(titreLu));
  const attendus = motsDistinctifs(reference?.original_title);
  if (!attendus.length || !attendus.every((m) => lus.has(m))) return verdict(false, 'titre');
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
// l'assistant existe → l'écran demande « Remplacer par cette lecture ? »). `remplacer` (ronde 1, défaut vrai) : la réponse à cette question.
//   - vrai : la fiche est RECOMPOSÉE (current_version_id → la nouvelle, availability, verification_state, ingredient_ids, printed_page posé si vide) ;
//   - faux (« non », I-5 : « rien d'autre ») : la fiche ne reçoit QUE l'union des pages et la photo du plat ; courante, availability,
//     verification_state, ingredient_ids et printed_page restent ceux de la référence ; la version est fabriquée quand même (ajoutée sans
//     devenir courante) et les pages reçoivent `kind: 'recipe'` et leur position. L'écran écrit ce que le fabricant rend : la recomposition
//     n'est jamais refaite à l'écran.
//   resultat : la sortie validée de validateParsedRecipe ; reference : la fiche RELUE juste avant la transaction (leçon C4) ;
//   versions : ses versions ; pages : lignes source_pages (tableau ou Map par id) ; pageIds : l'ordre de lecture (une page absente de
//   `pages` est ignorée : pointeur souple, § 3.1) ; edition, convention (figée en snapshot) ; importId (souple) ; modele (celui du
//   serveur) ; photo : { sha256, origin } | null (origin ∈ photo | image, sinon null) ; maintenant : created_at de la version.
// Les lignes passent par parseIngredientLine (identité proposée, jamais vérifiée : N-8) ; les étapes sont construites DIRECTEMENT, une par
// entrée du modèle, sauts de ligne gardés (jamais parseStepsBlock, I5), avec les clés de detectTimers. assertVocabulaire garde la fiche (D-12).
// Pages : `printed_page` de la page gardé ; une page SANS numéro ne reçoit celui de la fiche que si elle est la PREMIÈRE de l'ordre (ronde 1 :
// la deuxième photo d'une recette p. 132 est la p. 133, pas la 132 — rien d'inventé, I-1) ; les suivantes restent nulles.
// Lot D : `reecrirePositions` (défaut vrai, lot A inchangé), `role: 'recette'`, union sans `reference.index_page_id`.
// Lot D, ronde 1 (I-D3, B-7) : la photo d'index de LA référence n'est jamais une page de la recette, même quand la lecture la porte (classée dans le
// groupe, cochée par « Regrouper en recette ») : écartée des pages lues — ni dans la version, ni dans l'union, ni réécrite (elle garde kind et position).
const ORIGINES_PHOTO = ['photo', 'image'];
export function fabriquerExtraction(resultat, { reference, versions = [], pages = [], pageIds = [], edition = null, convention = null, importId = null, modele = null, photo = null, maintenant = null, remplacer = true, reecrirePositions = true } = {}) {
  const parId = pages instanceof Map ? pages : new Map((pages || []).map((p) => [p.id, p]));
  const presentes = pageIds.filter((id) => parId.has(id) && id !== reference.index_page_id);
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
      // Vague finale (m8) : les incertitudes dites par le modèle (déjà bornées par validateParsedRecipe : ≤ 40 × 200 points de code) vivent AUSSI dans la
      // version — la purge à 30 jours de la ligne du journal n'efface plus « Incertain : … » d'une fiche toujours à vérifier.
      uncertain_fields: Array.isArray(resultat.uncertain_fields) ? resultat.uncertain_fields.filter((u) => typeof u === 'string') : [],
    },
    verification_state: 'to_verify',
    ...(maintenant ? { created_at: maintenant } : {}),
  };
  const availability = ingredients.length && steps.length && !incomplete && !missing_page ? 'available' : 'partial';
  const recipe = {
    ...reference,
    source_page_ids: [...new Set([...(reference.source_page_ids || []).filter((id) => id !== reference.index_page_id), ...presentes])], // lot D (B-7) : la photo d'index de la référence n'est pas une page de la recette
    photo_sha256: photo ? photo.sha256 : (reference.photo_sha256 ?? null),
    photo_origin: photo ? (ORIGINES_PHOTO.includes(photo.origin) ? photo.origin : null) : originePhotoAdmise(reference.photo_origin), // lot F (D-F19)
    ...(photo ? { photo_provenance: null, photo_source_url: null } : {}),
    ...(remplacer === false ? {} : {
      printed_page: reference.printed_page ?? resultat.printed_page ?? null,
      ingredient_ids: [...new Set(ingredients.map((l) => l.ingredient_id).filter(Boolean))],
      availability, verification_state: version.verification_state, current_version_id: version.id,
    }),
  };
  assertVocabulaire(recipe, 'recipes'); // D-12 : le fabricant vérifie le vocabulaire fermé avant toute écriture
  // Lot D (§ 4.8.1, N-1) : role recette avec kind recipe ; une lecture issue d'une séance garde les positions de la séance (reecrirePositions faux :
  // seul « Appliquer cet ordre » les réécrit, C I-C10) — l'ordre de la RECETTE reste celui de la lecture (source_page_ids).
  const pageUpdates = presentes.map((id, i) => ({ ...parId.get(id), kind: 'recipe', role: 'recette', ...(reecrirePositions ? { position: i + 1 } : {}), printed_page: parId.get(id).printed_page ?? (i === 0 ? recipe.printed_page ?? null : null) }));
  const remplacement = versions.some(versionEcrite);
  return { recipe, version, pageUpdates, remplacement };
}
// I-5 (vague finale, m5) : ce que la personne a ÉCRIT et qui peut être courant — une saisie à la main (extraction) ou une correction — jamais une
// adaptation (« Ma version », un remplacement d'ingrédient) ni une traduction, qui ne deviennent pas courantes : sinon « Garder ma version » gardait
// courante l'ancienne lecture partielle de l'assistant. Exportée (lot B, ronde 1 de la tâche 3) : la lecture web (versionHumaine, R-B-19) lit la même.
export const versionEcrite = (v) => v?.provenance?.generated_by !== 'ai' && (v?.kind === 'extraction' || v?.kind === 'correction');

// --- Couverture d'une relecture (ronde finale 2, I-5) : les pages de la version COURANTE (provenance.source_page_ids, identifiants seulement,
// dédoublonnés, dans leur ordre) qu'une lecture ne relit pas (`lues` : les pages de la nouvelle version). Tant qu'il en reste, l'écran demande
// « Remplacer par cette lecture ? » au lieu de rendre courante une version qui perdrait en silence les lignes de ces pages (une page dont les octets
// ne sont pas sur cet appareil, une page retirée de la ligne). Sans courante ou sans pages : rien (une première lecture n'a rien à couvrir).
const estIdPage = (id) => typeof id === 'string' && !!id;
export function pagesNonRelues(courante, lues) {
  const attendues = Array.isArray(courante?.provenance?.source_page_ids) ? [...new Set(courante.provenance.source_page_ids.filter(estIdPage))] : [];
  const relues = new Set(Array.isArray(lues) ? lues.filter(estIdPage) : []);
  return attendues.filter((id) => !relues.has(id));
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

// --- Date de réception d'une lecture (« Lecture reçue le {d} », spec § 4.2.6 et § 4.5 ; vague finale, m7) : le départ du vol plus sa durée — jamais
// updated_at, qui bouge à chaque transition sur place (photo du plat posée ou retirée en a_verifier). Sans départ ni durée lisibles (ligne d'avant, ou
// reçue), updated_at comme avant. Une durée hors 0..24 h n'est pas une durée de vol (rien d'inventé : repli).
export function dateReception(ligne) {
  const depart = Date.parse(typeof ligne?.started_at === 'string' ? ligne.started_at : '');
  const duree = ligne?.duree_ms;
  return Number.isFinite(depart) && Number.isInteger(duree) && duree >= 0 && duree <= 86400000 ? new Date(depart + duree).toISOString() : (ligne?.updated_at ?? null);
}

// --- Séance de l'écran ciblé (spec § 4.1, N3) : SEULE la séance d'un import `kind: 'recette'` AVEC `recipe_id`, non terminé, est exclue des
// rappels génériques (« Séances à reprendre », « Séance en cours », « Photos conservées ») ; elle y réapparaît sur enregistre / ignore.
// Vague finale (m10) : « non terminé » = importOuvert (une seule définition) — une ligne reçue hors vocabulaire (statut inconnu ou nul) ne masque plus
// sa séance, comme elle n'est ni listée, ni reprise, ni bloquante (I-2 ne couvre que le vocabulaire connu).
// Lot D (D-D11) : une ligne d'un LOT ne cache pas sa séance (ses autres photos — l'orpheline, une recette qui attend — restent rappelées).
export function seanceDUnImportCible(seance, imports) {
  return (Array.isArray(imports) ? imports : []).some((i) => importOuvert(i) && i.kind === 'recette' && !!i.recipe_id && i.scan_session_id === seance?.id && lotDe(i) === null);
}

// La clé d'UNE lecture (T4-R2 du lot A) : la ligne, le départ de son vol et son résultat. Une clôture (Ignorer, Enregistrer, echec(illisible)) ne
// vaut que pour la lecture AFFICHÉE : une lecture arrivée d'un autre onglet entre-temps (même id, même statut) a une autre clé. Une définition, ici
// (pure) : l'écran ciblé, l'éditeur, le panneau d'index et la section « Imports » (lot A, par src/ui/import-cible.js) et la variante web (lot B).
export const cleLecture = (L) => JSON.stringify([L?.id ?? null, L?.started_at ?? null, L?.resultat ?? null]);
// Le modèle relu du journal, borné avant d'entrer dans une provenance (T4-R1 du lot A) : ≤ 80 points de code (LIMITES_PASSERELLE.modele, la borne de
// PasserelleProvider) ; une chaîne vide, ou autre chose qu'une chaîne, vaut null. UNE définition (ronde 1 de la tâche 5 du lot B) : l'écran ciblé, l'éditeur
// et le panneau d'index (lot A) et la variante web la partagent.
export const modeleBorne = (m) => (typeof m === 'string' && m && Array.from(m).length <= 80 ? m : null);

// --- Section « Imports » d'Ajouter (spec § 4.5, tâche 6) ---------------------------------------------------------------------------------------
// Les sortes écrites aujourd'hui (« couverture » est le lot E, R-E-13 : elle se reprend par #/add/livre?import= ; une ligne d'une autre sorte n'est pas listée, rien d'inventé ; « web »
// arrive avec le lot B, spec recette-web § 4.7) et les statuts NON terminés. `importOuvert` : une ligne que la section liste (et que la fiche du
// livre compte — un import web n'y compte jamais : son edition_id est nul, D-B17).
// `classement` (lot D) : la ligne d'un classement de photos, reprise dans sa séance ; jamais « Relancer » depuis la section.
export const KINDS_IMPORT = Object.freeze(['recette', 'index', 'web', 'classement', 'couverture', 'livre', 'thermomix']);
// Les sortes qui portent des PAGES (photos) : les seules que le chemin photo ouvre (repo.ouvrirImport, repo.ajouterPages). Une lecture web naît par
// demarrerLectureWeb (src/ui/import-web.js), jamais par ce chemin (lot B, P-1).
// `classement` (lot D) : une ligne de classement porte des photos — `repo.ouvrirImport({ kind: 'classement' })` l'ouvre ; `web` reste hors de cette liste.
// `couverture` (lot E, spec couverture § 3.6, P-2) : une couverture ne reçoit jamais de page — hors de cette liste, les murs de repo.ajouterPages et
// repo.ouvrirImport la refusent.
export const KINDS_PAGES = Object.freeze(['recette', 'index', 'classement']);
// Le titre lu d'une couverture : celui de la lecture du journal REVALIDÉE (I-E1 : une ligne reçue est une donnée hostile, elle peut porter 16 000 points
// de code) par la règle de la route, validerLectureCouverture — une ligne (surUneLigne, R-E-22), 300 points de code au plus, aucune adresse. Une lecture
// refusée n'a pas de titre : l'écran dit « Couverture photographiée » seul, comme la route refuse ce résultat (ronde 1 de T5).
const titreCouverture = (resultat) => { try { return validerLectureCouverture(resultat).title; } catch { return null; } };
export const IMPORTS_OUVERTS = Object.freeze(STATUTS_IMPORT.filter((s) => !IMPORTS_TERMINES.includes(s)));
export const importOuvert = (i) => !!i && typeof i === 'object' && typeof i.id === 'string' && !!i.id && KINDS_IMPORT.includes(i.kind) && IMPORTS_OUVERTS.includes(i.status);

// Où « Reprendre » mène, par sorte (spec § 4.5) : une recette ciblée → son écran (#/recipes/<id>/importer, photos en place) ; une recette sans
// référence (« Regrouper en recette ») → l'éditeur prérempli (#/recipes/new?import=) ; un index → le panneau d'index de sa séance
// (#/import?session=…&import=) ; une lecture web (lot B) → l'écran de sa fiche avec LA ligne (#/recipes/<id>/importer?import=, variante web ;
// R-B-20, comme m4 / VF-6 du lot A : après synchro, une fiche peut avoir une lecture ouverte par appareil). Identifiants encodés
// (une fiche reçue d'ailleurs peut porter « & » ou « / ») ; un index sans séance, une sorte inconnue ou une ligne sans identifiant → null.
const chaine = (v) => (typeof v === 'string' && v ? v : null);
export function cibleReprise(ligne) {
  const id = chaine(ligne?.id);
  if (!id) return null;
  // Vague finale (m4) : l'écran ciblé reçoit aussi LA ligne (?import=) — après synchro, une recette peut avoir un import ouvert par appareil.
  if (ligne.kind === 'thermomix') return chaine(ligne.recipe_id) ? `/recipes/${encodeURIComponent(ligne.recipe_id)}/thermomix?import=${encodeURIComponent(id)}` : null;
  if (ligne.kind === 'recette') return chaine(ligne.recipe_id) ? `/recipes/${encodeURIComponent(ligne.recipe_id)}/importer?import=${encodeURIComponent(id)}` : `/recipes/new?import=${encodeURIComponent(id)}`;
  if (ligne.kind === 'index') return chaine(ligne.scan_session_id) ? `/import?session=${encodeURIComponent(ligne.scan_session_id)}&import=${encodeURIComponent(id)}` : null;
  if (ligne.kind === 'web') return chaine(ligne.recipe_id) ? `/recipes/${encodeURIComponent(ligne.recipe_id)}/importer?import=${encodeURIComponent(id)}` : null;
  if (ligne.kind === 'classement') return chaine(ligne.scan_session_id) ? `/import?session=${encodeURIComponent(ligne.scan_session_id)}&import=${encodeURIComponent(id)}` : null; // lot D : la séance du classement
  if (ligne.kind === 'couverture' || ligne.kind === 'livre') return `/add/livre?import=${encodeURIComponent(id)}`;
  return null;
}

// Les lignes de la section (PURE ; l'écran traduit par t()) : une par import OUVERT, la plus récente d'abord, puis une par séance OUVERTE qui
// n'est pas celle d'un import ciblé non terminé (« Photos conservées », N3 : les séances de « Regrouper en recette » et du panneau d'index
// restent listées). ctx : { imports, scan_sessions, recipesById, editionsById, booksById } ; documentId : le document (onglet) courant ;
// deviceId : cet appareil. Gestes (spec § 4.5) :
//   a_lancer → reprendre, ignorer · en_cours → annuler si CE document tient le vol (document_id_vol), sinon aucun (« ailleurs ») ·
//   a_verifier → reprendre, ignorer · echec → relancer, ignorer (un index : reprendre, ignorer — lot C, vague finale, D-C16) ;
//   ligne d'un AUTRE appareil (« Photos sur un autre appareil ») : reprendre seulement si un résultat est là, jamais relancer → ignorer seul sinon ;
//   référence pas encore reçue (recipe_id inconnu ici) → aucun geste ; rien où reprendre (index sans séance) → pas de « reprendre » ;
//   (ronde 1) référence devenue `available` (complétée ailleurs : l'écran ciblé la refuse) → ignorer seul ; echec sans page → pas de « relancer ».
// Une lecture web (lot B, spec recette-web § 4.7, ruling P-10) : mêmes états, trois différences — « relancer » (« Réessayer » à l'écran)
// est offert AUSSI pour une ligne d'un autre appareil (aucune photo requise : l'adresse est dans le signet) et SANS page (une lecture web n'en
// porte jamais) ; « reprendre » sur a_verifier exige un résultat, d'où qu'elle vienne ; une fiche déjà `available` garde ces gestes (la
// relecture D-B18 vise justement une fiche lue, et la variante web de l'écran l'admet). Son titre est { type: 'web', texte: titre du signet,
// livre: l'hôte RECALCULÉ de son adresse }.
// Lot E (D-E14, R-E-13) : une ligne `couverture` — Reprendre (#/add/livre?import=) et Ignorer, jamais Relancer ; en vol : Annuler si CE document la
// tient ; d'un autre appareil : Ignorer seul, sauf un a_verifier qui porte sa lecture (ronde 1 : LA règle du classement, une seule branche) ; son titre
// est celui de la lecture revalidée (titreCouverture : une ligne, 300 points de code, aucune adresse ; sinon null).
// Rend [{ id, kind, titre: { type: reference | index | regrouper | web | classement | couverture | seance, texte, livre }, etat, age: { n, unite }, raison, gestes, cible,
// ailleurs, autreAppareil, referenceAbsente, pages }].
// Lot D : une ligne `classement` (Reprendre → la séance ; jamais Relancer) ; chaque ligne porte `lot` (lotDe, revalidé) ; une ligne de lot sans référence garde le type `regrouper`.
const parRecence = (champ) => (a, b) => String(b[champ] || '').localeCompare(String(a[champ] || ''));
export function lignesImports(ctx, { maintenant = null, documentId = null, deviceId = null } = {}) {
  const imports = Array.isArray(ctx?.imports) ? ctx.imports : [];
  const seances = Array.isArray(ctx?.scan_sessions) ? ctx.scan_sessions : [];
  const carte = (m) => (m instanceof Map ? m : new Map());
  const recettes = carte(ctx?.recipesById), editions = carte(ctx?.editionsById), livres = carte(ctx?.booksById);
  const livreDe = (editionId) => { const ed = editionId ? editions.get(editionId) : null; return chaine(ed ? livres.get(ed.book_id)?.title : null); };
  const nbPages = (x) => (Array.isArray(x?.page_ids) ? x.page_ids.length : 0);
  const autre = (x) => !!deviceId && typeof x?.device_id === 'string' && x.device_id !== deviceId;
  const lignes = imports.filter(importOuvert).sort(parRecence('updated_at')).map((i) => {
    const autreAppareil = autre(i);
    const tenu = i.status === 'en_cours' && !!documentId && i.document_id_vol === documentId;
    const ailleurs = i.status === 'en_cours' && !tenu;
    const web = i.kind === 'web';
    const couverture = i.kind === 'couverture';
    const livre = i.kind === 'livre';
    const recetteId = i.kind === 'recette' || i.kind === 'thermomix' || web ? chaine(i.recipe_id) : null;
    const recette = recetteId ? recettes.get(recetteId) ?? null : null;
    const referenceAbsente = !!recetteId && !recette;
    const type = i.kind === 'thermomix' ? 'thermomix' : livre ? 'livre' : couverture ? 'couverture' : i.kind === 'classement' ? 'classement' : i.kind === 'index' ? 'index' : web ? 'web' : recetteId ? 'reference' : 'regrouper';
    const cible = cibleReprise(i);
    let gestes;
    if (referenceAbsente) gestes = [];
    else if (i.kind === 'thermomix') gestes = ['reprendre']; // son écran contrôle appareil, vol, annulation et clôture
    else if (i.status === 'en_cours') gestes = tenu ? ['annuler'] : [];
    else if (livre) gestes = ['reprendre', 'ignorer']; // aucun appel au montage ; la route contrôle disponibilité des octets
    // Lot D (D-D14) : un classement ne se RELANCE jamais depuis Imports. Lot E (D-E14, R-E-13 ; ronde 1 : la même règle, une seule branche) : une couverture
    // non plus — « Reprendre » ouvre sa route, qui offre « Lire / Relire la couverture » (sa référence n'est jamais absente : elle n'a pas de recipe_id).
    else if (i.kind === 'classement' || couverture) gestes = autreAppareil && !(i.status === 'a_verifier' && i.resultat != null) ? ['ignorer'] : ['reprendre', 'ignorer'];
    else if (web) gestes = i.status === 'echec' ? ['relancer', 'ignorer'] : i.status === 'a_verifier' && i.resultat == null ? ['ignorer'] : ['reprendre', 'ignorer'];
    else if (recette?.availability === 'available') gestes = ['ignorer']; // un POST ne servirait à rien : l'écran ciblé refuse une recette qui a son texte
    else if (autreAppareil) gestes = i.status === 'a_verifier' && i.resultat != null ? ['reprendre', 'ignorer'] : ['ignorer'];
    // Lot C, vague finale (constat 3 ; D-C16, § 10 pas 6) : un INDEX en échec se REPREND (le panneau de sa séance, ses pages cochées) — son « Relancer »
    // est lire() du panneau (décocher pour lire moins), jamais un second appel sur les mêmes photos depuis la section.
    else gestes = i.status === 'echec' && i.kind !== 'index' ? ['relancer', 'ignorer'] : ['reprendre', 'ignorer'];
    if (!cible) gestes = gestes.filter((g) => g !== 'reprendre');
    // Un vol sans page serait refusé (sans_page) sans rien dire ; une lecture web n'a jamais de page (P-10), mais sans recipe_id (forme reçue) elle
    // n'a aucun signet à relire : « Réessayer » ne pourrait jamais aboutir (ronde 1 ; lancerLecture la refuse `inconnu`) — « Ignorer » seul reste.
    if (web ? !recetteId : !nbPages(i)) gestes = gestes.filter((g) => g !== 'relancer');
    return {
      id: i.id, kind: i.kind, titre: livre ? { type, texte: estTitreUneLigne(i.brouillon?.fields?.title, 300) ? i.brouillon.fields.title : null, livre: null } : couverture ? { type, texte: titreCouverture(i.resultat), livre: null } : { type, texte: recette ? chaine(recette.original_title) : null, livre: web ? (recette ? lienSignet(recette.source_url).hote : null) : livreDe(recette?.edition_id ?? i.edition_id) },
      etat: i.status, age: ageDepuis(i.updated_at, maintenant), raison: i.status === 'echec' ? chaine(i.erreur?.raison) : null,
      gestes, cible, ailleurs, autreAppareil, referenceAbsente, pages: nbPages(i), lot: lotDeRecette(i),
    };
  });
  const photos = seances.filter((s) => s && typeof s === 'object' && chaine(s.id) && s.status === 'open' && !seanceDUnImportCible(s, imports)).sort(parRecence('started_at')).map((s) => ({
    id: s.id, kind: 'seance', titre: { type: 'seance', texte: null, livre: livreDe(s.edition_id) }, etat: 'open', age: ageDepuis(s.updated_at ?? s.started_at, maintenant), raison: null,
    gestes: ['ouvrir_seance'], cible: `/import?session=${encodeURIComponent(s.id)}`, ailleurs: false, autreAppareil: autre(s), referenceAbsente: false, pages: nbPages(s), lot: null,
  }));
  return [...lignes, ...photos];
}

// --- Lot D « Un lot de recettes photographiées » (spec § 3.3, § 3.4, § 3.6, D-D11, D-D12, N-1) -------------------------------------------------------
// La fabrique des lignes NEUVES du journal (D-D12) : la forme qui vivait dans nouvelleLigneImport (src/model/repo.js), extraite À L'IDENTIQUE — les 19
// champs, mêmes valeurs — et gardée par le vocabulaire fermé (statut ET sorte). Une seule définition : nouvelleLigneImport, lecturesDuLot (classement.js)
// et les fabricants des autres lots l'appellent. `device_id` est fourni par l'appelant (repo.deviceId() chez nouvelleLigneImport).
export function ligneImportNeuve({ id, kind, recipe_id = null, edition_id = null, scan_session_id = null, page_ids = [], device_id = null } = {}) {
  const ligne = {
    id, kind, edition_id: edition_id ?? null, recipe_id: recipe_id ?? null, scan_session_id: scan_session_id ?? null, page_ids: [...page_ids], photo_sha256: null, status: 'a_lancer', erreur: null,
    resultat: null, reponse_brute: null, appels: 0, model: null, duree_ms: null, device_id: device_id ?? null, document_id_vol: null, battement_at: null, started_at: null, finished_at: null,
  };
  assertVocabulaire(ligne, 'imports'); // D-12 du lot A, D-D12 : la ligne naît dans son vocabulaire fermé
  return ligne;
}
// Le champ `lot` d'une ligne de recette (§ 3.3), DONNÉE reçue ou restaurée : revalidé à chaque lecture. classement_id (1 à 80 points de code), rang et
// total (entiers 1..10, rang ≤ total) sont STRUCTURANTS : fautifs → null, la ligne se comporte comme une ligne du lot A. titre (estTitreUneLigne, 200) et
// page (1..9999) ne servent qu'à l'affichage : fautifs → null SANS jeter le lot. Objet construit, lu par Object.hasOwn. Les bornes 10, 200 et 9999 sont
// celles de BORNES_CLASSEMENT (src/domain/llm.js : groupes, titre, page), LUES là depuis la vague finale du lot E — la copie d'avant venait de ce que
// import-cible.js n'importait pas llm.js ; l'arc existe depuis la ronde 1 de la tâche 5 du lot E (validerLectureCouverture) : une seule source.
export function lotDe(ligne) {
  const brut = ligne && typeof ligne === 'object' && Object.hasOwn(ligne, 'lot') ? ligne.lot : null;
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const champ = (k) => (Object.hasOwn(brut, k) ? brut[k] : undefined);
  const id = champ('classement_id'), rang = champ('rang'), total = champ('total'), titre = champ('titre'), page = champ('page');
  const n = typeof id === 'string' ? Array.from(id).length : 0;
  if (n < 1 || n > 80) return null;
  const B = BORNES_CLASSEMENT;
  if (!Number.isInteger(rang) || !Number.isInteger(total) || rang < 1 || total < 1 || rang > B.groupes || total > B.groupes || rang > total) return null;
  return { classement_id: id, rang, total, titre: estTitreUneLigne(titre, B.titre) ? titre : null, page: Number.isInteger(page) && page >= 1 && page <= B.page ? page : null };
}
// Ronde 1 de la tâche 4 (revue, lentille sécurité) : `lot` n'existe que sur une ligne `recette` (§ 3.3). Une ligne d'une autre sorte qui en porte un
// (reçue, restaurée) n'est d'AUCUN lot : ni bloc, ni progression, ni « Continuer », ni note de séance. lotDe reste la revalidation du champ seul (T-D7) ;
// toute ligne du JOURNAL se lit par lotDeRecette (lignesImports, progressionLots, lireLeLot, noteLotsDeSeance).
export const lotDeRecette = (ligne) => (ligne?.kind === 'recette' ? lotDe(ligne) : null);
// N-1 (§ 3.6) : une lecture ISSUE D'UNE SÉANCE — ligne de lot, « Regrouper en recette », photo seule, lecture rattachée (D-D19) ET ligne ciblée du lot A
// (sa séance naît avec la première photo, RV-1). Seul critère des amendements d'enregistrement : jamais `lot`.
export const issueDUneSeance = (ligne) => typeof ligne?.scan_session_id === 'string' && ligne.scan_session_id.length > 0;
// N-1 : le statut d'une séance APRÈS l'enregistrement d'une de ses lectures — 'done' si CHAQUE photo de seance.page_ids est écrite par la transaction
// (`ecrites`, avec kind recipe et role recette) ou porte déjà un role ou un kind (chaîne non vide) dans `pagesParId` (les pages relues juste avant) ;
// sinon le statut INCHANGÉ. Une page absente de la Map (ajoutée entre-temps) compte comme sans rôle : jamais fermée trop tôt. `seance` = la séance
// relue DANS la transaction (patch-fonction du sac conditions) ; page_ids absent → [] → 'done'.
export function statutSeanceApres(seance, pagesParId, ecrites) {
  const ids = Array.isArray(seance?.page_ids) ? seance.page_ids : [];
  const pages = pagesParId instanceof Map ? pagesParId : new Map();
  const ecr = ecrites instanceof Set ? ecrites : new Set(Array.isArray(ecrites) ? ecrites : []);
  const nonVide = (v) => typeof v === 'string' && v !== '';
  const aUnRole = (id) => ecr.has(id) || (pages.has(id) && (nonVide(pages.get(id)?.role) || nonVide(pages.get(id)?.kind)));
  return ids.every(aUnRole) ? 'done' : seance?.status;
}
