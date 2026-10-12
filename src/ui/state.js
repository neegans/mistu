// Cache de lecture : charge la bibliothèque en mémoire, construit les index de recherche ; invalidé à chaque écriture.
import * as repo from '../model/repo.js';
import { on } from '../core/bus.js';
import { buildDocs, buildLabelIndex } from '../domain/search.js';
import { buildIngredientIndex } from '../domain/lines.js';
import { loadUnits } from '../domain/units.js';

let cache = null;
on('change', () => { cache = null; });
on('settings', () => { cache = null; });

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
    ...d, settings, ingredientsById, editionsById, booksById, dishesById, recipesById, versionsById, versionsByRecipe, pagesById, docs, docsByRecipe,
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
