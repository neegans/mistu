import * as depot from '../model/repo.js';
import { ErreurCycleRecette } from './cycle-recette.js';
import { MAGASINS_BILAN_LIVRE, calculerBilanLivre, lireCycleEdition } from './cycle-edition.js';

async function capable(repo, contexte) {
  if (contexte.owner_id == null) return;
  const { capaciteEditionConnue } = await import('../sync/cycle-edition.js');
  if (!(await capaciteEditionConnue(repo.db, contexte.owner_id))) throw new ErreurCycleRecette('serveur_incompatible');
}
export async function preparerRetraitLivre(edition, { repo = depot, contexte = null } = {}) {
  const capture = contexte || await repo.capturerContexteEdition(edition);
  const lignes = Object.fromEntries(await Promise.all(MAGASINS_BILAN_LIVRE.map(async s => [s, await repo.all(s)])));
  return { edition, contexte: capture, ...calculerBilanLivre(edition, lignes) };
}
async function commander(action, edition, { repo = depot, contexte = null, mode = null, bilan = null, operationId = null, maintenant = () => new Date().toISOString() } = {}) {
  const capture = contexte || await repo.capturerContexteEdition(edition);
  await capable(repo, capture);
  const preview = action === 'trash' ? bilan || await preparerRetraitLivre(edition, { repo, contexte: capture }) : null;
  return repo.commanderCycleEdition({ entity: 'edition', action, edition_id: edition.id, operation_id: operationId || repo.newId('cycle'), base_cycle_id: capture.expected_cycle_id, at: maintenant(), ...(action === 'trash' ? { mode } : {}) }, capture, { bilan: preview });
}
export const mettreLivreALaCorbeille = (edition, options = {}) => commander('trash', edition, options);
export const restaurerLivre = (edition, options = {}) => commander('restore', edition, options);
export async function restaurerRecetteDuLivre(recipe, { repo = depot, contexte = null, edition, operationId = null, maintenant = () => new Date().toISOString() } = {}) {
  const capture = contexte || await repo.capturerContexteRecette(recipe, { edition });
  await capable(repo, capture);
  return repo.commanderCycleRecette({ entity: 'recipe', action: 'restore_from_edition', recipe_id: recipe.id, edition_id: capture.expected_edition_id, operation_id: operationId || repo.newId('cycle'), base_cycle_id: capture.expected_cycle_id, base_edition_cycle_id: capture.expected_edition_cycle_id, at: maintenant() }, capture);
}
export async function chargerCorbeilleLivres({ repo = depot } = {}) {
  const [indexees, toutes] = await Promise.all([repo.byIndex('book_editions', 'trashed_at'), repo.all('book_editions')]);
  return { retirees: indexees.filter(e => lireCycleEdition(e).etat === 'retiree').sort((a, b) => b.trashed_at.localeCompare(a.trashed_at) || a.id.localeCompare(b.id)), invalides: toutes.filter(e => lireCycleEdition(e).etat === 'invalide') };
}
