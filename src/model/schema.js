// Schéma logique (spec §14). Les identifiants sont stables ; les contenus sources restent traçables.
// Chaque magasin correspond à une entité ; les libellés FR/EN des plats et ingrédients sont embarqués dans leur document.

export const DB_NAME = 'cuisine-os';
export const DB_VERSION = 1;
export const APP_VERSION = '0.1.0';

export const ARCHIVE_FORMAT = 'cuisine-os-archive';
export const ARCHIVE_FORMAT_VERSION = 1;
export const SUPPORTED_ARCHIVE_VERSIONS = [1];

export const STORES = {
  books:               { keyPath: 'id', indexes: [] },
  book_editions:       { keyPath: 'id', indexes: [['book_id', 'book_id'], ['isbn', 'isbn']] },
  source_documents:    { keyPath: 'id', indexes: [['edition_id', 'edition_id'], ['sha256', 'sha256'], ['scan_session_id', 'scan_session_id']] },
  source_pages:        { keyPath: 'id', indexes: [['document_id', 'document_id'], ['edition_id', 'edition_id']] },
  scan_sessions:       { keyPath: 'id', indexes: [] },
  dishes:              { keyPath: 'id', indexes: [] },
  dish_recipe_links:   { keyPath: 'id', indexes: [['dish_id', 'dish_id'], ['recipe_id', 'recipe_id']] },
  recipes:             { keyPath: 'id', indexes: [['edition_id', 'edition_id']] },
  recipe_versions:     { keyPath: 'id', indexes: [['recipe_id', 'recipe_id']] },
  recipe_translations: { keyPath: 'id', indexes: [['recipe_version_id', 'recipe_version_id']] },
  ingredients:         { keyPath: 'id', indexes: [] },
  unit_definitions:    { keyPath: 'id', indexes: [] },
  unit_conventions:    { keyPath: 'id', indexes: [] },
  substitutions:       { keyPath: 'id', indexes: [['recipe_version_id', 'recipe_version_id']] },
  appliances:          { keyPath: 'id', indexes: [] },
  cook_history:        { keyPath: 'id', indexes: [['recipe_version_id', 'recipe_version_id'], ['recipe_id', 'recipe_id']] },
  cook_sessions:       { keyPath: 'id', indexes: [['recipe_id', 'recipe_id']] },
  inventory:           { keyPath: 'id', indexes: [] },
  meals:               { keyPath: 'id', indexes: [] },
  meal_feedback:       { keyPath: 'id', indexes: [['meal_id', 'meal_id']] },
  shopping_lists:      { keyPath: 'id', indexes: [] },
  library_activity:    { keyPath: 'id', indexes: [['edition_id', 'edition_id']] },
  rediscovery_prefs:   { keyPath: 'edition_id', indexes: [] },
  timer_launches:      { keyPath: 'id', indexes: [['cook_session_id', 'cook_session_id']] },
  files:               { keyPath: 'sha256', indexes: [] },
  settings:            { keyPath: 'key', indexes: [] },
};

// Magasins de données inclus dans l'archive complète. « files » est exporté sous forme de fichiers (files/<sha256>).
export const ARCHIVE_DATA_STORES = Object.keys(STORES).filter((s) => s !== 'files' && s !== 'settings');
// Réglages exclus de la sauvegarde : secrets d'accès (spec §31.1).
export const SECRET_SETTING_KEYS = ['llm'];

// Magasins internes du lot « compte et stockage distant » (spec § 5.1) : jamais archivés, jamais synchronisés.
export const SYNC_INTERNAL_STORES = ['outbox', 'sync_state', 'sync_conflicts'];
// Magasins miroirs d'une table serveur (spec § 3.1) : tout sauf les réglages et les internes.
export const SYNC_STORES = Object.keys(STORES).filter((s) => s !== 'settings' && !SYNC_INTERNAL_STORES.includes(s));

// Relations vérifiées avant restauration (magasin enfant, chemin, magasin parent).
// Un champ absent ou nul est optionnel. « . » descend dans un objet ; « [] » parcourt un tableau.
// Les instantanés historiques restent autonomes : ni *_snapshot, ni appareils supprimables,
// ni identifiants d'appareil local ne deviennent des clés étrangères. Les identifiants d'étape
// sont internes à une RecipeVersion et ne ciblent aucun magasin de ce schéma.
export const RELATIONS = [
  ['book_editions', 'book_id', 'books'],
  ['book_editions', 'unit_convention_id', 'unit_conventions'],

  ['source_documents', 'edition_id', 'book_editions'],
  ['source_documents', 'sha256', 'files'],
  ['source_documents', 'scan_session_id', 'scan_sessions'],
  ['source_documents', 'replaces_document_id', 'source_documents'],
  ['source_pages', 'document_id', 'source_documents'],
  ['source_pages', 'edition_id', 'book_editions'],
  ['source_pages', 'sha256', 'files'],
  ['scan_sessions', 'edition_id', 'book_editions'],
  ['scan_sessions', 'page_ids[]', 'source_pages'],
  ['scan_sessions', 'document_ids[]', 'source_documents'],
  ['scan_sessions', 'recipe_ids[]', 'recipes'],

  ['dish_recipe_links', 'dish_id', 'dishes'],
  ['dish_recipe_links', 'recipe_id', 'recipes'],
  ['recipes', 'edition_id', 'book_editions'],
  ['recipes', 'current_version_id', 'recipe_versions'],
  ['recipes', 'source_page_ids[]', 'source_pages'],
  ['recipes', 'ingredient_ids[]', 'ingredients'],
  ['recipe_versions', 'recipe_id', 'recipes'],
  ['recipe_versions', 'parent_version_id', 'recipe_versions'],
  ['recipe_versions', 'provenance.edition_id', 'book_editions'],
  ['recipe_versions', 'provenance.source_page_ids[]', 'source_pages'],
  ['recipe_versions', 'provenance.source_document_id', 'source_documents'],
  ['recipe_versions', 'provenance.derived_from', 'recipe_versions'],
  ['recipe_versions', 'ingredients[].ingredient_id', 'ingredients'],
  ['recipe_versions', 'ingredients[].ingredient_candidates[]', 'ingredients'],
  ['recipe_versions', 'ingredients[].unit_id', 'unit_definitions'],
  ['recipe_versions', 'ingredients[].unit_candidates[]', 'unit_definitions'],
  ['recipe_translations', 'recipe_version_id', 'recipe_versions'],
  ['ingredients', 'equivalences[].volume_unit_id', 'unit_definitions'],
  ['ingredients', 'equivalences[].convention_id', 'unit_conventions'],
  ['unit_definitions', 'reference_unit', 'unit_definitions'],
  ['unit_definitions', 'ambiguous_with', 'unit_definitions'],
  ['substitutions', 'recipe_version_id', 'recipe_versions'],
  ['substitutions', 'parent_version_id', 'recipe_versions'],
  ['substitutions', 'ingredient_id', 'ingredients'],
  ['substitutions', 'replacement_ingredient_id', 'ingredients'],

  ['cook_history', 'recipe_version_id', 'recipe_versions'],
  ['cook_history', 'recipe_id', 'recipes'],
  ['cook_history', 'cook_session_id', 'cook_sessions'],
  ['cook_history', 'meal_id', 'meals'],
  ['cook_sessions', 'recipe_id', 'recipes'],
  ['cook_sessions', 'meal_id', 'meals'],
  ['cook_sessions', 'selected_version_ids[]', 'recipe_versions'],
  ['cook_sessions', 'active_version_id', 'recipe_versions'],
  ['inventory', 'ingredient_id', 'ingredients'],
  ['inventory', 'source_recipe_version_id', 'recipe_versions'],
  ['inventory', 'source_recipe_id', 'recipes'],
  ['meals', 'items[].recipe_id', 'recipes'],
  ['meals', 'items[].recipe_version_id', 'recipe_versions'],
  ['meal_feedback', 'meal_id', 'meals'],
  ['meal_feedback', 'recipe_ids[]', 'recipes'],
  ['meal_feedback', 'version_ids[]', 'recipe_versions'],
  ['shopping_lists', 'meal_id', 'meals'],
  ['shopping_lists', 'items[].recipe_id', 'recipes'],
  ['shopping_lists', 'items[].recipe_version_id', 'recipe_versions'],
  ['library_activity', 'edition_id', 'book_editions'],
  ['library_activity', 'recipe_id', 'recipes'],
  ['rediscovery_prefs', 'edition_id', 'book_editions'],
  ['timer_launches', 'cook_session_id', 'cook_sessions'],
  ['timer_launches', 'recipe_version_id', 'recipe_versions'],
];

// Vocabulaire fermé des états (libellés visibles dans src/i18n).
export const AVAILABILITY = ['reference_only', 'partial', 'available'];
export const VERIFICATION = ['unverified', 'to_verify', 'verified'];
export const VERSION_KIND = ['extraction', 'correction', 'adaptation', 'translation', 'synthesis'];
export const VERSION_STATUS = ['proposed', 'tested'];
export const LINK_STATE = ['proposed', 'confirmed', 'refused'];
export const RECIPE_TYPES = ['plat_principal', 'entree', 'salade', 'soupe', 'legumes', 'feculent', 'sauce', 'dessert', 'boulangerie', 'boisson', 'autre'];
export const MEAL_ROLES = ['plat_principal', 'entree', 'accompagnement', 'dessert', 'autre'];
export const DIET_TAGS = ['sans_gluten', 'vegetarien', 'vegetalien', 'sans_lactose', 'sans_noix', 'sans_oeufs', 'sans_fruits_de_mer', 'sans_porc', 'sans_alcool'];
export const CAPABILITIES = ['weigh', 'chop', 'blend', 'emulsify', 'steam', 'slow_cook', 'sous_vide', 'controlled_heating', 'knead', 'bake', 'convection', 'broil', 'grill', 'smoke', 'fry', 'air_fry', 'pressure_cook', 'rice_cook', 'vacuum_seal', 'stir_fry', 'boil', 'simmer', 'ferment', 'dehydrate'];
