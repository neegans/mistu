import { lireCycleRecette, identifiantCycleValide, dateCycleValide } from './cycle-recette.js';

export function lireCycleEdition(edition) {
  if (!edition || typeof edition !== 'object' || Array.isArray(edition)) return { etat: 'invalide', id: null, trashed_at: null, mode: null };
  const id = edition.lifecycle_id ?? null, date = edition.trashed_at ?? null, mode = edition.trash_mode ?? null;
  if (id === null && date === null && mode === null) return { etat: 'active', id: null, trashed_at: null, mode: null };
  const valide = identifiantCycleValide(id) && Object.hasOwn(edition, 'trashed_at') && Object.hasOwn(edition, 'trash_mode') &&
    (edition.trashed_at === null ? edition.trash_mode === null : dateCycleValide(date) && ['keep_recipes', 'with_recipes'].includes(mode));
  return { etat: valide ? date === null ? 'active' : 'retiree' : 'invalide', id, trashed_at: date, mode };
}

export function exceptionEditionValide(recipe) {
  const x = recipe?.restored_from_edition;
  return x == null || (!!x && typeof x === 'object' && !Array.isArray(x) && typeof x.edition_id === 'string' && !!x.edition_id.trim() &&
    x.edition_id === recipe.edition_id && identifiantCycleValide(x.lifecycle_id) && Object.keys(x).every(k => ['edition_id', 'lifecycle_id'].includes(k)));
}
export const memeExceptionEdition = (a, b) => exceptionEditionValide(a) && exceptionEditionValide(b) &&
  (a?.restored_from_edition?.edition_id ?? null) === (b?.restored_from_edition?.edition_id ?? null) &&
  (a?.restored_from_edition?.lifecycle_id ?? null) === (b?.restored_from_edition?.lifecycle_id ?? null);
export const memeCycleEdition = (a, b) => {
  const x = lireCycleEdition(a), y = lireCycleEdition(b);
  return x.etat !== 'invalide' && y.etat !== 'invalide' && x.id === y.id && x.trashed_at === y.trashed_at && x.mode === y.mode;
};
export function lireEtatRecette(recipe, edition = null) {
  const propre = lireCycleRecette(recipe), parent = recipe?.edition_id == null ? null : lireCycleEdition(edition);
  const base = { etat: 'active', origine: null, recipe_cycle_id: propre.id, edition_cycle_id: parent?.id ?? null, exception: false };
  if (propre.etat === 'invalide' || !exceptionEditionValide(recipe)) return { ...base, etat: 'invalide', origine: 'recette' };
  if (propre.etat === 'retiree') return { ...base, etat: 'retiree', origine: 'recette' };
  if (recipe.edition_id == null) return base;
  if (!edition || edition.id !== recipe.edition_id) return { ...base, etat: 'incomplete', origine: 'edition' };
  if (parent.etat === 'invalide') return { ...base, etat: 'invalide', origine: 'edition' };
  if (parent.etat === 'active' || parent.mode === 'keep_recipes') return base;
  const exception = recipe.restored_from_edition?.lifecycle_id === parent.id;
  return { ...base, etat: exception ? 'active' : 'retiree', origine: exception ? null : 'edition', exception };
}
export const recetteActiveEffective = (recipe, edition) => lireEtatRecette(recipe, edition).etat === 'active';

export const MAGASINS_BILAN_LIVRE = ['recipes', 'recipe_versions', 'source_documents', 'source_pages', 'scan_sessions', 'imports'];
export function calculerBilanLivre(edition, lignes) {
  const recettes = (lignes.recipes || []).filter(r => r.edition_id === edition.id), ids = new Set(recettes.map(r => r.id));
  const selection = Object.fromEntries(MAGASINS_BILAN_LIVRE.map(store => [store, (lignes[store] || []).filter(r => store === 'recipe_versions' ? ids.has(r.recipe_id) : r.edition_id === edition.id || (store === 'imports' && ids.has(r.recipe_id))).sort((a, b) => String(a.id).localeCompare(String(b.id)))]));
  const versions = new Map(selection.recipe_versions.map(v => [v.id, v]));
  const compteurs = { disponibles: 0, partielles: 0, references: 0, dejaRetirees: 0, pages: selection.source_pages.length, importsOuverts: 0, importsEnCours: 0, importsInconnus: 0, totalRecettes: recettes.length };
  for (const r of recettes) {
    if (lireCycleRecette(r).etat !== 'active') compteurs.dejaRetirees++;
    else if (r.availability === 'reference_only') compteurs.references++;
    else if (r.availability === 'available' && versions.get(r.current_version_id)?.steps?.length) compteurs.disponibles++;
    else compteurs.partielles++;
  }
  for (const i of selection.imports) {
    if (i.status === 'en_cours') compteurs.importsEnCours++;
    else if (['a_lancer', 'a_verifier', 'echec'].includes(i.status)) compteurs.importsOuverts++;
    else if (!['enregistre', 'ignore'].includes(i.status)) compteurs.importsInconnus++;
  }
  return { compteurs, vide: Object.values(selection).every(rows => rows.length === 0), signature: JSON.stringify(selection) };
}
