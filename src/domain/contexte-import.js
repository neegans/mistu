// Le cycle d'une lecture reste celui de son départ, même après fermeture et restauration.
import { lireCycleRecette, ErreurCycleRecette } from './cycle-recette.js';

export function verifierCycleImport(recipe, row) {
  const cycle = lireCycleRecette(recipe);
  if (cycle.etat !== 'active' || cycle.id !== (row?.expected_cycle_id ?? null)) throw new ErreurCycleRecette('cycle_change', recipe?.id);
}

export function verifierCaptureImport(row, contexte) {
  if (!contexte) return;
  if (row.recipe_id !== contexte.recipe_id || (row.expected_cycle_id ?? null) !== contexte.expected_cycle_id) throw new ErreurCycleRecette('cycle_change', row.recipe_id);
  if ((Object.hasOwn(row, 'owner_id') && row.owner_id !== contexte.owner_id) || (contexte.contexteValide && !contexte.contexteValide())) throw new ErreurCycleRecette('compte_change', row.recipe_id);
}

export async function contexteRecetteImport(repo, recipe, row = null, { historique = false, contexte: capture = null } = {}) {
  if (capture) { if (row) verifierCaptureImport(row, capture); return {...capture,historique}; }
  const options = { historique, ...(row && Object.hasOwn(row, 'owner_id') ? { owner_id: row.owner_id } : {}) };
  const contexte = repo.capturerContexteRecette ? await repo.capturerContexteRecette(recipe, options)
    : { recipe_id: recipe.id, expected_cycle_id: recipe.lifecycle_id ?? null, owner_id: null, historique };
  return row ? { ...contexte, expected_cycle_id: row.expected_cycle_id ?? null } : contexte;
}

export const memoireCycleImport = contexte => ({ expected_cycle_id: contexte.expected_cycle_id, owner_id: contexte.owner_id });

// Geste distinct de « Garder » : autorise une nouvelle relecture du résultat déjà payé.
export async function revoirLectureImport(importId, { repo, contexte } = {}) {
  const row = await repo.get('imports', importId);
  if (!row || row.status !== 'a_verifier' || !row.resultat || row.recipe_id !== contexte?.recipe_id) throw new ErreurCycleRecette('relecture_absente', contexte?.recipe_id);
  if (Object.hasOwn(row, 'owner_id') && row.owner_id !== contexte.owner_id) throw new ErreurCycleRecette('compte_change', row.recipe_id);
  const empreinte = JSON.stringify([row.resultat, row.expected_cycle_id ?? null, row.source_version_id ?? null]);
  return repo.transitionner('imports', importId, { attendus: ['a_verifier'], recettes: [contexte], patch: current => {
    if (JSON.stringify([current.resultat, current.expected_cycle_id ?? null, current.source_version_id ?? null]) !== empreinte) throw new ErreurCycleRecette('lecture_changee', row.recipe_id);
    return { ...memoireCycleImport(contexte), relecture_cycle_at: new Date().toISOString() };
  } });
}
