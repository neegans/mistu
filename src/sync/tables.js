// Déclaration du schéma serveur, dérivée du schéma local (spec § 3.1). Source de vérité du générateur de migrations.
// generated : une colonne par index de STORES (même nom, texte), plus les colonnes listées ici ; required : champs de
// relation que l'app pose toujours (vérifié dans le code : un champ qui peut être nul n'est PAS listé).
import { STORES, SYNC_STORES } from '../model/schema.js';

const EXTRA_GENERATED = {
  files: [{ name: 'size', sql: "((data->>'size')::bigint)", type: 'bigint' }, { name: 'mime', sql: "(data->>'mime')", type: 'text' }],
};
// Champs de relation toujours posés à la création (grep -n des créations de fiches dans src/ui et src/domain).
// timer_launches.cook_session_id est exclu : src/ui/recipe.js (minuterie d'une étape, hors séance de cuisson) appelle
// createTimerLaunch sans cook_session_id, et src/domain/timers.js lui donne alors la valeur null (champ réellement nul).
const REQUIRED = {
  book_editions: ['book_id'],
  source_pages: ['document_id'],
  recipe_versions: ['recipe_id'],
  recipe_translations: ['recipe_version_id'],
  dish_recipe_links: ['dish_id', 'recipe_id'],
  cook_history: ['recipe_id', 'recipe_version_id'],
  cook_sessions: ['recipe_id'],
  meal_feedback: ['meal_id'],
  library_activity: ['edition_id'],
  substitutions: ['recipe_version_id'],
};

export const TABLES = Object.fromEntries(SYNC_STORES.map((store) => [store, {
  key: STORES[store].keyPath,
  generated: [
    ...(STORES[store].indexes || []).map(([name, keyPath]) => ({ name, sql: `(data->>'${keyPath}')`, type: 'text' })),
    ...(EXTRA_GENERATED[store] || []),
  ],
  required: REQUIRED[store] || [],
}]));

export const keyOf = (store, record) => record[STORES[store].keyPath];

// Les 25 magasins de la migration 0001, FIGÉS : 0001 est appliquée sur mitsu et doit rester identique octet pour octet
// (spec assistant-par-le-compte § 6.1). Toute table neuve va dans une migration à ajout seul (0003, …).
export const SYNC_STORES_0001 = Object.freeze(['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files']);
