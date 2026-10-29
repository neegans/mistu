// Le cycle d'une lecture reste celui de son départ, même après fermeture et restauration.
import { lireCycleRecette, ErreurCycleRecette } from './cycle-recette.js';

export function verifierCycleImport(recipe, row) {
  const cycle = lireCycleRecette(recipe);
  if (cycle.etat !== 'active' || cycle.id !== (row?.expected_cycle_id ?? null)
    || (recipe?.edition_id ?? null) !== (row?.expected_edition_id ?? row?.edition_id ?? null)) throw new ErreurCycleRecette('cycle_change', recipe?.id);
}

export const memeCaptureImport = (row, contexte) => (row?.expected_cycle_id ?? null) === (contexte?.expected_cycle_id ?? null)
  && (row?.expected_edition_id ?? row?.edition_id ?? null) === (contexte?.expected_edition_id ?? null)
  && (row?.expected_edition_cycle_id ?? null) === (contexte?.expected_edition_cycle_id ?? null);

export function verifierCaptureImport(row, contexte) {
  if (!contexte) return;
  if (row.recipe_id !== contexte.recipe_id || !memeCaptureImport(row, contexte)) throw new ErreurCycleRecette('cycle_change', row.recipe_id);
  if ((Object.hasOwn(row, 'owner_id') && row.owner_id !== contexte.owner_id) || (contexte.contexteValide && !contexte.contexteValide())) throw new ErreurCycleRecette('compte_change', row.recipe_id);
}

export async function contexteRecetteImport(repo, recipe, row = null, { historique = false, contexte: capture = null } = {}) {
  if (capture) { if (row) verifierCaptureImport(row, capture); return {...capture,historique}; }
  const edition = recipe.edition_id == null ? null : await repo.get('book_editions', recipe.edition_id);
  const options = { historique, edition, ...(row && Object.hasOwn(row, 'owner_id') ? { owner_id: row.owner_id } : {}) };
  const contexte = repo.capturerContexteRecette ? await repo.capturerContexteRecette(recipe, options)
    : { recipe_id: recipe.id, expected_cycle_id: recipe.lifecycle_id ?? null, expected_edition_id: recipe.edition_id ?? null,
      expected_edition_cycle_id: edition?.lifecycle_id ?? null, owner_id: null, historique };
  return row ? { ...contexte, expected_cycle_id: row.expected_cycle_id ?? null,
    expected_edition_id: row.expected_edition_id ?? row.edition_id ?? null, expected_edition_cycle_id: row.expected_edition_cycle_id ?? null } : contexte;
}

export const memoireCycleImport = contexte => ({ expected_cycle_id: contexte.expected_cycle_id,
  expected_edition_id: contexte.expected_edition_id ?? null, expected_edition_cycle_id: contexte.expected_edition_cycle_id ?? null,
  owner_id: contexte.owner_id });

// Un index ou un classement n'a pas encore de recette : sa base est celle du livre affiché.
export const memoireEditionImport = contexte => ({ expected_edition_id: contexte.edition_id,
  expected_edition_cycle_id: contexte.expected_cycle_id ?? null, owner_id: contexte.owner_id ?? null });
export function verifierCaptureEditionImport(row, contexte) {
  if (!row || !contexte?.edition_id) throw new ErreurCycleRecette('contexte_change');
  if ((row.expected_edition_id ?? row.edition_id ?? null) !== contexte.edition_id
    || (row.expected_edition_cycle_id ?? null) !== (contexte.expected_cycle_id ?? null)) throw new ErreurCycleRecette('cycle_change');
  if ((row.owner_id ?? null) !== (contexte.owner_id ?? null)
    || (contexte.contexteValide && !contexte.contexteValide())) throw new ErreurCycleRecette('compte_change');
}

// Geste distinct de « Garder » : autorise une nouvelle relecture du résultat déjà payé.
export async function revoirLectureImport(importId, { repo, contexte } = {}) {
  const row = await repo.get('imports', importId);
  if (!row || row.status !== 'a_verifier' || !row.resultat || row.recipe_id !== contexte?.recipe_id) throw new ErreurCycleRecette('relecture_absente', contexte?.recipe_id);
  if (Object.hasOwn(row, 'owner_id') && row.owner_id !== contexte.owner_id) throw new ErreurCycleRecette('compte_change', row.recipe_id);
  const signature = r => JSON.stringify([r.resultat, r.expected_cycle_id ?? null, r.expected_edition_id ?? r.edition_id ?? null,
    r.expected_edition_cycle_id ?? null, r.source_version_id ?? null]);
  const empreinte = signature(row);
  return repo.transitionner('imports', importId, { attendus: ['a_verifier'], recettes: [contexte], patch: current => {
    if (signature(current) !== empreinte) throw new ErreurCycleRecette('lecture_changee', row.recipe_id);
    return { ...memoireCycleImport(contexte), relecture_cycle_at: new Date().toISOString() };
  } });
}
