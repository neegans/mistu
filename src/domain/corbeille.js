import * as depot from '../model/repo.js';
import { lireCycleRecette, estRecetteAutonome, ErreurCycleRecette } from './cycle-recette.js';

async function commander(action, recipe, { repo = depot, contexte = null, edition = null, operationId = null, maintenant = () => new Date().toISOString(), verifierCourante = null } = {}) {
  if (!recipe?.id) throw new ErreurCycleRecette('source_absente');
  const ctx = contexte || await repo.capturerContexteRecette(recipe, { edition });
  if (action === 'restore' && edition?.trashed_at && edition.trash_mode === 'with_recipes') {
    const { restaurerRecetteDuLivre } = await import('./corbeille-livres.js');
    return restaurerRecetteDuLivre(recipe, { repo, contexte: ctx, edition, operationId, maintenant });
  }
  if (ctx.owner_id != null) {
    const { capaciteCycleConnue } = await import('../sync/cycle.js');
    if (!(await capaciteCycleConnue(repo.db, ctx.owner_id))) throw new ErreurCycleRecette('serveur_incompatible', recipe.id);
  }
  if (ctx.owner_id != null && ctx.expected_edition_id != null) {
    const { capaciteEditionConnue } = await import('../sync/cycle-edition.js');
    if (!(await capaciteEditionConnue(repo.db, ctx.owner_id))) throw new ErreurCycleRecette('serveur_incompatible', recipe.id);
  }
  return repo.commanderCycleRecette({ action, recipe_id: recipe.id, operation_id: operationId || repo.newId('cycle'), base_cycle_id: ctx.expected_cycle_id, at: maintenant(), ...(ctx.expected_edition_id != null ? { entity: 'recipe', edition_id: ctx.expected_edition_id, base_edition_cycle_id: ctx.expected_edition_cycle_id } : {}) }, ctx, { verifierCourante });
}
export const mettreALaCorbeille = (recipe, options = {}) => commander('trash', recipe, options);
export const restaurerRecette = (recipe, options = {}) => commander('restore', recipe, options);
export { estRecetteAutonome };

export async function chargerCorbeille({ repo = depot } = {}) {
  // Index réellement utilisé pour les retraits ; les états mal formés restent retrouvables même hors index.
  const [indexees, toutes] = await Promise.all([repo.byIndex('recipes', 'trashed_at'), repo.all('recipes')]);
  return {
    retirees: indexees.filter(r => lireCycleRecette(r).etat === 'retiree').sort((a, b) => b.trashed_at.localeCompare(a.trashed_at) || String(a.original_title || '').localeCompare(String(b.original_title || ''))),
    invalides: toutes.filter(r => lireCycleRecette(r).etat === 'invalide'),
  };
}
