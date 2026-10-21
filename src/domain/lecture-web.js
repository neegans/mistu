// Lire une recette web (lot B « Recette web complète », spec docs/superpowers/specs/2026-10-19-recette-web-design.md, § 3, § 4.3) : le domaine,
// PUR sauf l'appel `lireRecetteWeb` (par la passerelle, avec la session : aucune clé ici). La réponse de la fonction — la page, le JSON-LD, la
// sortie du modèle — est une DONNÉE HOSTILE (I-B2) : `page` est relue par lirePage (chaque champ par `borner` : Cc / Cf retirés, borné ; l'hôte
// RECALCULÉ par lienSignet, jamais celui du serveur ; auteur et site mis à null s'ils portent une adresse) ; la recette par validateParsedRecipe
// (un dépassement REFUSE, jamais de troncature) ; une adresse dans le TITRE refuse (`lien`), dans une ligne, une étape ou les notes elle est
// RETIRÉE et dite (R-B-2). Aucune fonction ne lève vers l'écran pour une raison attendue : les refus sont des ErreurExtraction nommées.
import { appelerAssistant, echecDomaine, LIMITES_PASSERELLE } from './passerelle.js';
import { validateParsedRecipe, parseJsonLoose, ErreurExtraction, BORNES_EXTRACTION, BORNES_NOMBRES, REPONSE_BRUTE_MAX } from './llm.js';
import { MOTIF_ADRESSE, porteUneAdresse, normaliserPourAdresse } from './recherche-web.js';
import { parseIngredientLine, detectTimers } from './lines.js';
import { assertVocabulaire } from './vocabulaire.js';
import { versionEcrite, ligneImportNeuve } from './import-cible.js';
import { newId } from '../core/ids.js';
import { lienSignet } from '../core/lien.js';
import { borner } from '../core/bornes.js';
import { t } from '../core/i18n.js';
import { SOURCE_KINDS } from '../model/schema.js';

// Les bornes de la page relue (§ 3.5) ; TITRE_FICHE_MAX = LIMITES_SIGNET.titre (src/ui/signet.js : un module de vue, que le domaine n'importe
// pas — l'égalité est épinglée par la suite).
export const LIMITES_PAGE = Object.freeze({ url: 2048, titrePage: 300, auteur: 200, site: 200, date: 40, stopReason: 40 });
export const TITRE_FICHE_MAX = 300;
const propre = (o, k) => (o !== null && typeof o === 'object' && Object.hasOwn(o, k) ? o[k] : undefined);
const tronquer = (s, max) => Array.from(s).slice(0, max).join('');
// Une adresse au sens de MOTIF_ADRESSE (schéma, « www. », hôte suivi d'un chemin ; jamais MOTIF_HOTE) sur le texte NFKC : la convention de porteUneAdresse.
const adresseStricte = (texte) => MOTIF_ADRESSE.test(normaliserPourAdresse(texte));
// lue_le (ronde 1) : la forme que pose le serveur (toISOString) seulement — Date.parse lit « 1 » ou une date RFC selon le moteur.
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

// --- La page (§ 3.5) ------------------------------------------------------------------------------------------------------------------------------
// `corps` : la réponse 200 de la fonction ({ page, stop_reason, model, … }) ou un `resultat` relu du journal ({ page, … }). Rend { page, stopReason,
// modele }. Chacun des sept champs lus passe par borner (S-1 : épinglé par un test de source). autres_recettes : un entier SÛR ≥ 0 (ronde 1 :
// 1e300 → 0) ; l'écran n'en lit que « > 0 » — aucun plafond qui ferait d'une vraie page de 150 recettes une page sans autre recette.
export function lirePage(corps) {
  const p = propre(corps, 'page');
  const url = borner(propre(p, 'url_finale'), LIMITES_PAGE.url + 1);
  const lien = url && Array.from(url).length <= LIMITES_PAGE.url ? lienSignet(url) : { ok: false };
  const titre = borner(propre(p, 'titre_page'), LIMITES_PAGE.titrePage).trim();
  const auteur = borner(propre(p, 'auteur'), LIMITES_PAGE.auteur).trim();
  const site = borner(propre(p, 'site'), LIMITES_PAGE.site).trim();
  const lue = borner(propre(p, 'lue_le'), LIMITES_PAGE.date).trim();
  const stop = borner(propre(corps, 'stop_reason'), LIMITES_PAGE.stopReason).trim();
  const modele = borner(propre(corps, 'model'), LIMITES_PASSERELLE.modele).trim();
  const autres = propre(p, 'autres_recettes');
  return {
    page: {
      url_finale: lien.ok ? lien.href : null, hote: lien.ok ? lien.hote : null, titre_page: titre || null,
      auteur: auteur && !porteUneAdresse(auteur) ? auteur : null, site: site && !porteUneAdresse(site) ? site : null, // S-2
      lue_le: ISO_UTC.test(lue) && Number.isFinite(Date.parse(lue)) ? lue : null,
      autres_recettes: Number.isSafeInteger(autres) && autres >= 0 ? autres : 0, texte_coupe: propre(p, 'texte_coupe') === true,
    },
    stopReason: stop || null, modele: modele || null,
  };
}

// --- Adresses dans le contenu lu (§ 3.5 bis, R-B-2) ---------------------------------------------------------------------------------------------
// Le fragment d'adresse à retirer : un des trois départs de MOTIF_ADRESSE (le départ hôte étendu aux sous-domaines), puis tout caractère qui n'est
// ni une espace, ni < > " ' ’ « » ( ) [ ] ; la ponctuation de fin de phrase qui termine le fragment reste au texte. Appliqué au texte d'ORIGINE.
// Ronde 1 : le départ hôte n'est tenté ni au milieu d'une suite de [a-z0-9-], ni juste après « x. » (lookbehind) — mêmes fragments (un départ plus
// tôt les couvre), mais linéaire : « www. » suivi de « a.a.a… » coûtait un temps quadratique. Drapeau g : `.replace` seulement (lastIndex remis à
// zéro) ; un appel de .test / .exec sur l'objet exporté aurait un état (vrai puis faux sur le même texte) — en construire un local pour tester.
export const MOTIF_FRAGMENT_ADRESSE = /(?:https?:\/\/|www\.|(?<![a-z0-9-]|[a-z0-9-]\.)(?:[a-z0-9-]+\.)+[a-z]{2,}\/)[^\s<>"'’«»()\[\]]*/giu;
const PONCTUATION_FINALE = /[.,;:!?]+$/u;
function sansAdresse(texte) {
  if (typeof texte !== 'string' || !texte || !adresseStricte(texte)) return { texte, touche: false };
  const marqueur = t('[adresse retirée]');
  const remplace = texte.replace(MOTIF_FRAGMENT_ADRESSE, (m) => marqueur + (PONCTUATION_FINALE.exec(m)?.[0] ?? ''));
  // Une adresse que la détection NFKC voit ENCORE après le remplacement — aucun fragment isolable (points pleine chasse), ou un fragment pleine
  // chasse à côté d'un autre qui s'isole (ronde 1) — : le champ entier devient le marqueur. Aucune adresse ne reste dans le texte stocké, et la
  // relecture (relireResultat) rend le même texte : l'objet du journal est celui qu'« Enregistrer » écrira.
  return { texte: adresseStricte(remplace) ? marqueur : remplace, touche: true };
}
// Sur la recette VALIDÉE : chaque ligne, étape et notes touchées reçoivent le marqueur ; une ligne passe uncertain ; UNE entrée d'uncertain_fields
// par champ touché, jamais deux fois la même (au plus BORNES_EXTRACTION.champsIncertains au total) ; un texte qui dépasse sa borne après
// remplacement → hors_bornes.
export function retirerAdresses(recette) {
  const B = BORNES_EXTRACTION; const retraits = []; const entrees = [];
  const borne = (s, max) => { if (Array.from(s).length > max) throw new ErreurExtraction('hors_bornes'); return s; };
  const ingredients = recette.ingredients.map((l, i) => {
    const r = sansAdresse(l.source_text);
    if (!r.touche) return l;
    retraits.push({ champ: 'ligne', position: i + 1 }); entrees.push(t('adresse retirée dans la ligne {n}', { n: i + 1 }));
    return { ...l, source_text: borne(r.texte, B.ligne), uncertain: true };
  });
  const steps = recette.steps.map((s, i) => {
    const r = sansAdresse(s.text);
    if (!r.touche) return s;
    retraits.push({ champ: 'etape', position: i + 1 }); entrees.push(t('adresse retirée dans l’étape {n}', { n: i + 1 }));
    return { ...s, text: borne(r.texte, B.etape) };
  });
  let notes = recette.notes;
  const n = sansAdresse(notes);
  if (n.touche) { retraits.push({ champ: 'notes', position: 1 }); entrees.push(t('adresse retirée dans les notes')); notes = borne(n.texte, B.notes); }
  const uncertain_fields = [...recette.uncertain_fields];
  for (const e of entrees) if (!uncertain_fields.includes(e) && uncertain_fields.length < B.champsIncertains) uncertain_fields.push(e);
  return { recette: { ...recette, ingredients, steps, notes, uncertain_fields }, retraits };
}

// --- La lecture (§ 3.4, § 3.5) ------------------------------------------------------------------------------------------------------------------
// La recette d'une lecture : validée (bornes), total_minutes lu à part (0..1440) pour un JSON-LD SEULEMENT (§ 3.3, B-8 : null par le modèle — la
// consigne ne le demande pas ; une durée qu'une page injecterait dans la sortie du modèle serait une durée inventée, ronde 1), printed_page et
// missing_page forcés (rien d'une page web n'est une page de livre), titre à adresse → lien, entrées d'uncertain_fields à adresse écartées (S-7), la
// coupe de la page dite (B-9, au plus 40 entrées, jamais deux fois), puis les adresses du contenu retirées. `erreur(raison)` fabrique le refus avec
// le contexte de l'appel.
function validerRecette(data, page, erreur, genre) {
  let recette;
  try { recette = validateParsedRecipe(data); } catch (e) { throw erreur(e instanceof ErreurExtraction ? e.raison : 'illisible'); }
  const tm = propre(data, 'total_minutes');
  recette.total_minutes = genre === 'jsonld' && Number.isInteger(tm) && tm >= 0 && tm <= BORNES_NOMBRES.minutes ? tm : null;
  recette.printed_page = null; recette.missing_page = false;
  if (typeof recette.title === 'string' && adresseStricte(recette.title)) throw erreur('lien');
  recette.uncertain_fields = recette.uncertain_fields.filter((u) => !porteUneAdresse(u));
  const coupee = t('La page était longue : la fin n’a pas été lue.');
  if (page.texte_coupe && !recette.uncertain_fields.includes(coupee) && recette.uncertain_fields.length < BORNES_EXTRACTION.champsIncertains) recette.uncertain_fields.push(coupee);
  try { return retirerAdresses(recette); } catch (e) { throw erreur(e instanceof ErreurExtraction ? e.raison : 'illisible'); }
}
const usageDe = (u) => {
  const n = (k) => { const v = propre(u, k); return Number.isSafeInteger(v) && v >= 0 ? v : null; };
  return { input_tokens: n('input_tokens'), output_tokens: n('output_tokens') };
};
// La réponse 200 de la fonction → { source_kind, page, recette, retraits, stopReason, modele, usage, texteBrut } ; refus : ErreurExtraction(coupe |
// illisible | hors_bornes | vide | lien) portant texteBrut (≤ REPONSE_BRUTE_MAX), stopReason, modele et sourceKind.
export function lireLecture(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) throw new ErreurExtraction('illisible');
  const sourceKind = propre(corps, 'source_kind');
  const { page, stopReason, modele } = lirePage(corps);
  const brut = propre(corps, 'recette');
  let texteBrut = null;
  try { texteBrut = tronquer(typeof brut === 'string' ? brut : JSON.stringify(brut ?? null), REPONSE_BRUTE_MAX); } catch { texteBrut = null; }
  const contexte = { texteBrut, stopReason, modele };
  const genre = SOURCE_KINDS.includes(sourceKind) ? sourceKind : null;
  const erreur = (raison) => { const e = new ErreurExtraction(raison, contexte); e.sourceKind = genre; return e; };
  if (!genre) throw erreur('illisible');
  if (stopReason === 'max_tokens') throw erreur('coupe');
  let data = brut;
  if (genre === 'modele') {
    if (typeof brut !== 'string') throw erreur('illisible');
    try { data = parseJsonLoose(brut); } catch { throw erreur('illisible'); }
  }
  const { recette, retraits } = validerRecette(data, page, erreur, genre);
  return { source_kind: genre, page, recette, retraits, stopReason, modele, usage: usageDe(propre(corps, 'usage')), texteBrut };
}
// Un `resultat` relu du journal (rendu, synchro, archive, « Reprendre ») : REVALIDÉ avant tout usage (I-B2, I-1 du lot A) ; la recette stockée est
// un objet (jamais le texte brut du modèle). Illisible → null.
export function relireResultat(resultat) {
  try {
    const genre = propre(resultat, 'source_kind');
    if (!SOURCE_KINDS.includes(genre)) return null;
    const { page } = lirePage(resultat);
    const { recette } = validerRecette(propre(resultat, 'recette'), page, (raison) => new ErreurExtraction(raison), genre);
    return { source_kind: genre, page, recette };
  } catch { return null; }
}

// --- L'appel (§ 4.3.2) ----------------------------------------------------------------------------------------------------------------------------
// UN POST { outil: 'lecture-web', corps: { url } } par la passerelle. Rend { etat: 'lue', resultat: { source_kind, page, recette }, reponseBrute, modele }
// ou { etat: 'echec', raison, extra, reponseBrute, modele } — raisons de la passerelle (echecDomaine, dont les cinq raisons web) ou de la lecture
// (coupe, illisible, hors_bornes — `extra.source_kind` dit lequel des deux textes —, vide, lien). Ne lève jamais.
export async function lireRecetteWeb({ url, session } = {}, { fetch, signal, tentativeMs = LIMITES_PASSERELLE.tentativeMs, config } = {}) {
  const r = await appelerAssistant('lecture-web', { url }, { fetch, session, config, signal, tentativeMs });
  if (r.raison) { const d = echecDomaine(r); return { etat: 'echec', raison: d.raison, extra: d.extra, reponseBrute: null, modele: null }; }
  try {
    const lu = lireLecture(r.corps);
    return { etat: 'lue', resultat: { source_kind: lu.source_kind, page: lu.page, recette: lu.recette }, reponseBrute: lu.texteBrut, modele: lu.modele };
  } catch (e) {
    if (!(e instanceof ErreurExtraction)) return { etat: 'echec', raison: 'interne', extra: {}, reponseBrute: null, modele: null };
    return { etat: 'echec', raison: e.raison, extra: e.sourceKind ? { source_kind: e.sourceKind } : {}, reponseBrute: e.texteBrut ?? null, modele: e.modele ?? null };
  }
}

// --- Fabricants (§ 3.1, § 3.3, § 4.3.4) -----------------------------------------------------------------------------------------------------------
// La ligne `imports` d'une lecture web (§ 3.1) : kind web, edition_id nul (D-B17), aucune séance ni page ni photo. Ronde 1 : `deviceId` est
// OBLIGATOIRE (l'appelant passe repo.deviceId(), comme nouvelleLigneImport du lot A le fait par défaut) — une ligne née sans appareil serait jugée
// « d'un autre appareil » (VOL_MORT_MS, 10 min) au lieu de 90 s de battement ; un null explicite reste admis (repo pas encore initialisé).
// Lot D (D-D12) : la ligne est fabriquée par ligneImportNeuve (src/domain/import-cible.js), une seule définition des 19 champs et du vocabulaire.
export function fabriquerImportWeb({ id, signet, deviceId }) {
  if (deviceId === undefined) throw new TypeError('fabriquerImportWeb : deviceId requis (repo.deviceId())');
  return ligneImportNeuve({ id, kind: 'web', recipe_id: signet.id, edition_id: null, scan_session_id: null, page_ids: [], device_id: deviceId }); // lot D (D-D12) : une seule forme
}
// D-B8 (S-14), amendé par R-B-19 : la règle I-5 du lot A (VF-7) — `versionEcrite`, exportée par src/domain/import-cible.js à la ronde 1 (une seule
// définition pour les deux fabricants) : ce que la personne a ÉCRIT et qui peut être courant, une version non ai de kind extraction (saisie à la
// main) ou correction. Une adaptation ou une traduction ne devient jamais courante et n'appelle pas « Remplacer par cette lecture ? » ; une version
// ai non plus.
export function versionHumaine(versions) {
  return (Array.isArray(versions) ? versions : []).some(versionEcrite);
}
// « Enregistrer » (§ 4.3.4) : la version `extraction` (lignes par parseIngredientLine, toutes à vérifier ; étapes construites directement, sauts de
// ligne gardés, avec detectTimers) et la fiche RECOMPOSÉE dans le signet (même identifiant) — ou, `remplacer: false`, le signet relu INTACT et
// la version fabriquée quand même, non courante (F-3). D-B24 : à la première lecture, le titre lu devient le titre de la fiche (l'ancien dans
// provenance.titre_signet) ; à une relecture, le titre est gardé. La provenance d'une version porte SA source (B-25 : auteur et site lus ce jour-là).
// Ronde 1 : la provenance porte aussi `lu_le` (la date de la LECTURE, que lisent la bannière du lot A et l'héritage de « Corriger » — sinon elles
// dataient la lecture du jour d'« Enregistrer ») et `uncertain_fields` (VF-10 du lot A, ≤ 40 × 200 : « Incertain : adresse retirée… » et « La page
// était longue… » survivent à la purge à 30 jours de la ligne du journal) ; le source_kind est vérifié dans les DEUX branches.
export function fabriquerLectureWeb(recette, { signet, versions = [], page = null, sourceKind = null, importId = null, modele = null, maintenant = null, remplacer = true } = {}) {
  assertVocabulaire({ source_kind: sourceKind }, 'recipes'); // la provenance porte sourceKind même quand la fiche reste intacte
  const B = BORNES_EXTRACTION;
  const ingredients = recette.ingredients.map((l) => ({ ...parseIngredientLine(l.source_text), uncertain: l.uncertain === true, verification_state: 'to_verify' }));
  const steps = recette.steps.map((s, i) => ({ id: newId('st'), position: i + 1, text: s.text, ...detectTimers(s.text) }));
  const lu = typeof recette.title === 'string' ? borner(recette.title, TITRE_FICHE_MAX).trim() : '';
  const titreLu = lu && !adresseStricte(lu) ? lu : null;
  const premiere = !(Array.isArray(versions) && versions.length);
  const incertains = (Array.isArray(recette.uncertain_fields) ? recette.uncertain_fields : []).filter((u) => typeof u === 'string' && Array.from(u).length <= B.champIncertain).slice(0, B.champsIncertains);
  const version = {
    id: newId('rv'), recipe_id: signet.id, kind: 'extraction', parent_version_id: signet.current_version_id || null, status: null,
    servings: recette.servings ?? null, prep_minutes: recette.prep_minutes ?? null, cook_minutes: recette.cook_minutes ?? null, active_minutes: null, total_minutes: recette.total_minutes ?? null,
    ingredients, steps, constraints: {}, changes: '', notes: recette.notes ?? null,
    provenance: {
      source_url: signet.source_url, url_finale: page?.url_finale ?? null, source_kind: sourceKind, lue_le: page?.lue_le ?? null, lu_le: page?.lue_le ?? null, model: modele ?? null, generated_by: 'ai',
      auteur: page?.auteur ?? null, site: page?.site ?? null,
      import_id: importId ?? null, incomplete: recette.incomplete === true, missing_page: false, titre_lu: titreLu, titre_signet: premiere && titreLu ? (signet.original_title ?? null) : null,
      source_page_ids: [], source_document_id: null, edition_id: signet.edition_id ?? null, convention_snapshot: null, uncertain_fields: incertains,
    },
    verification_state: 'to_verify',
    ...(maintenant ? { created_at: maintenant } : {}),
  };
  const remplacement = versionHumaine(versions);
  if (remplacer === false) { const intact = { ...signet }; assertVocabulaire(intact, 'recipes'); return { recipe: intact, version, remplacement }; } // une copie, jamais la référence
  const recipe = {
    ...signet,
    original_title: premiere && titreLu ? titreLu : signet.original_title,
    availability: ingredients.length && steps.length && recette.incomplete !== true ? 'available' : 'partial',
    verification_state: 'to_verify', current_version_id: version.id, printed_page: null,
    ingredient_ids: [...new Set(ingredients.map((l) => l.ingredient_id).filter(Boolean))],
    source_author: page?.auteur ?? null, source_site: page?.site ?? null, source_fetched_at: page?.lue_le ?? null, source_kind: sourceKind ?? null,
  };
  assertVocabulaire(recipe, 'recipes'); // D-12 : le sixième fabricant vérifie le vocabulaire fermé avant toute écriture
  return { recipe, version, remplacement };
}
