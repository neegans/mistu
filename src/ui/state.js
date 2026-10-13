// Cache de lecture : charge la bibliothèque en mémoire, construit les index de recherche ; invalidé à chaque écriture.
import * as repo from '../model/repo.js';
import { on } from '../core/bus.js';
import { buildDocs, buildLabelIndex } from '../domain/search.js';
import { buildIngredientIndex } from '../domain/lines.js';
import { loadUnits } from '../domain/units.js';

let cache = null;
on('change', () => { cache = null; });
on('settings', () => { cache = null; });

// --- État de la connexion (spec § 4.1) -------------------------------------
// Une seule source : posée au démarrage par app.js, lue par les vues sous ctx.sync. Rien n'est gardé ailleurs.
// « auth » est le module de connexion ; « user » vaut null tant que la garde de compte n'a pas accepté.
let sync = { auth: null, user: null, guard: null, retour: null };

// Clé de la route mémorisée avant un départ chez le fournisseur (redirectTo est sans fragment : la route serait
// perdue au retour). Écrite par Réglages, consommée une seule fois au démarrage.
export const SYNC_ROUTE_KEY = 'cuisineos.route';

export function setSyncState(next) {
  sync = { ...sync, ...next };
  cache = null; // le contexte des vues porte une copie de cet état : il doit être reconstruit
  return sync;
}

export const getSyncState = () => sync;

// Route à appliquer après un retour du fournisseur (R21). Pure : elle décide, elle n'écrit rien.
// La route mémorisée est restaurée à TOUT retour — session obtenue, retour muet ou refus de l'adresse : le bouton
// « Activer la synchronisation » vit dans Réglages, et c'est là que les lignes du retour s'affichent.
// Deux garde-fous gardés : la mémoire n'est lue qu'une fois (l'appelant la retire avant d'appeler ici), et une route
// déjà portée par l'URL n'est jamais écrasée. Sans retour traité, rien n'est restauré.
export function routeApresRetour({ retour = null, memorisee = null, hashActuel = '' } = {}) {
  if (!retour || !memorisee) return null;
  if (String(hashActuel || '').replace(/^#/, '')) return null;
  return memorisee;
}

export async function getData(force = false) {
  if (cache && !force) return cache;
  const names = ['recipes', 'recipe_versions', 'book_editions', 'books', 'dishes', 'dish_recipe_links', 'ingredients', 'recipe_translations', 'cook_history', 'unit_definitions', 'unit_conventions', 'library_activity', 'rediscovery_prefs', 'meals', 'meal_feedback', 'inventory', 'appliances', 'cook_sessions', 'source_pages', 'source_documents', 'shopping_lists', 'scan_sessions', 'substitutions'];
  const rows = await Promise.all(names.map((n) => repo.all(n)));
  const d = Object.fromEntries(names.map((n, i) => [n, rows[i]]));
  loadUnits(d.unit_definitions, d.unit_conventions);
  buildLabelIndex(d.ingredients);
  buildIngredientIndex(d.ingredients);
  const settings = await repo.getSettings();
  const ingredientsById = repo.indexBy(d.ingredients);
  const editionsById = repo.indexBy(d.book_editions);
  const booksById = repo.indexBy(d.books);
  const dishesById = repo.indexBy(d.dishes);
  const recipesById = repo.indexBy(d.recipes);
  const versionsById = repo.indexBy(d.recipe_versions);
  const versionsByRecipe = repo.groupBy(d.recipe_versions, 'recipe_id');
  const pagesById = repo.indexBy(d.source_pages);
  const docs = buildDocs({ recipes: d.recipes, versions: d.recipe_versions, editions: d.book_editions, books: d.books, dishes: d.dishes, links: d.dish_recipe_links, translations: d.recipe_translations, history: d.cook_history });
  const docsByRecipe = new Map(docs.map((x) => [x.recipe.id, x]));
  cache = {
    ...d, settings, sync, ingredientsById, editionsById, booksById, dishesById, recipesById, versionsById, versionsByRecipe, pagesById, docs, docsByRecipe,
    editionLabel(edition) {
      if (!edition) return '';
      const book = booksById.get(edition.book_id);
      return book ? book.title : '';
    },
    conventionFor(recipe) {
      const ed = recipe?.edition_id ? editionsById.get(recipe.edition_id) : null;
      return recipe?.unit_convention_id || ed?.unit_convention_id || null;
    },
  };
  return cache;
}

export function invalidate() { cache = null; }
