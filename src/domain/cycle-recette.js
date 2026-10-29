// Contrat de cycle commun : aucune date ni forme inconnue n'est interprétée comme active.
export const identifiantCycleValide = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(x);
export const dateCycleValide = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
export function lireCycleRecette(recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return { etat: 'invalide', id: null, trashed_at: null };
  const id = recipe.lifecycle_id ?? null, date = recipe.trashed_at ?? null;
  if (id === null && date === null) return { etat: 'active', id: null, trashed_at: null };
  if (!identifiantCycleValide(id) || !Object.hasOwn(recipe, 'trashed_at') || !(recipe.trashed_at === null || dateCycleValide(recipe.trashed_at))) return { etat: 'invalide', id, trashed_at: date };
  return { etat: date === null ? 'active' : 'retiree', id, trashed_at: date };
}
export const recetteActive = recipe => lireCycleRecette(recipe).etat === 'active';
export const estRecetteAutonome = recipe => !!recipe && recipe.edition_id == null;
export const memeCycleRecette = (a, b) => { const x = lireCycleRecette(a), y = lireCycleRecette(b); return x.etat !== 'invalide' && y.etat !== 'invalide' && x.id === y.id && x.trashed_at === y.trashed_at; };
export class ErreurCycleRecette extends Error {
  constructor(code, recipe_id = null) { super(code); this.name = 'ErreurCycleRecette'; this.code = code; this.recipe_id = recipe_id; }
}
