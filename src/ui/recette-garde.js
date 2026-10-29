// Le contexte est pris depuis la fiche affichée, avant dialogue, image ou assistant.
import { getSyncGeneration } from './state.js';
import { ErreurCycleRecette } from '../domain/cycle-recette.js';

export async function capturerRecette(repo, recipe, { ctx = null, edition = undefined, historique = false, creation = false } = {}) {
  if (!recipe?.id) return null;
  const generation = getSyncGeneration(), base = repo.db;
  const sourceEdition = edition === undefined ? (recipe.edition_id == null ? null : ctx?.editionsById?.get(recipe.edition_id)) : edition;
  const options = { historique, creation, edition: sourceEdition ? { ...sourceEdition } : sourceEdition,
    contexteValide: () => getSyncGeneration() === generation && (!base || repo.db === base),
    ...(ctx && Object.hasOwn(ctx, 'proprietaireDonnees') ? { owner_id: ctx.proprietaireDonnees } : {}) };
  if (repo.capturerContexteRecette) return repo.capturerContexteRecette(recipe, options);
  // Dépôts injectés des suites historiques ; le dépôt de production porte toujours la capture transactionnelle.
  return { recipe_id: recipe.id, expected_cycle_id: recipe.lifecycle_id ?? null,
    expected_edition_id: recipe.edition_id ?? null, expected_edition_cycle_id: sourceEdition?.lifecycle_id ?? null,
    historique, creation, contexteValide: options.contexteValide };
}

// Le livre affiché donne la base : une attente ne doit pas adopter son nouveau cycle.
export async function capturerEdition(repo, edition, { ctx = null, historique = false, creation = false, recipe_id = null } = {}) {
  if (!edition?.id) return null;
  const generation = getSyncGeneration(), base = repo.db;
  const options = { historique, creation, recipe_id,
    contexteValide: () => getSyncGeneration() === generation && (!base || repo.db === base),
    ...(ctx && Object.hasOwn(ctx, 'proprietaireDonnees') ? { owner_id: ctx.proprietaireDonnees } : {}) };
  if (repo.capturerContexteEdition) return repo.capturerContexteEdition({ ...edition }, options);
  return { edition_id: edition.id, expected_cycle_id: edition.lifecycle_id ?? null,
    historique, creation, recipe_id, contexteValide: options.contexteValide };
}

// Les formulaires de livre peuvent écrire une décision sans créer de recette : leur propriétaire est capturé au montage.
export function capturerProprietaire(repo, ctx = null) {
  const generation = getSyncGeneration(), base = repo.db;
  const contexteValide = () => getSyncGeneration() === generation && (!base || repo.db === base);
  const promesse = (async () => {
    const owner = (await repo.get('sync_state', 'user_id'))?.value ?? null;
    if (!contexteValide() || (ctx && Object.hasOwn(ctx, 'proprietaireDonnees') && ctx.proprietaireDonnees !== owner)) throw new ErreurCycleRecette('compte_change');
    return { owner_id: owner, contexteValide };
  })();
  promesse.catch(() => {}); // un montage périmé peut ne jamais recevoir de geste ; le refus est relu au prochain geste
  return promesse;
}
export const conditionProprietaire = compte => ({ key: 'user_id', fusion: courant => {
  if (!compte?.contexteValide?.() || (courant?.value ?? null) !== compte.owner_id) throw new ErreurCycleRecette('compte_change');
  return null;
} });
