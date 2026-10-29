// Schéma logique (spec §14). Les identifiants sont stables ; les contenus sources restent traçables.
// Chaque magasin correspond à une entité ; les libellés FR/EN des plats et ingrédients sont embarqués dans leur document.

export const DB_NAME = 'cuisine-os';
export const DB_VERSION = 6;
export const APP_VERSION = '0.25.0';

export const ARCHIVE_FORMAT = 'cuisine-os-archive';
export const ARCHIVE_FORMAT_VERSION = 3;
export const SUPPORTED_ARCHIVE_VERSIONS = [1, 2, 3];

export const STORES = {
  books:               { keyPath: 'id', indexes: [] },
  book_editions:       { keyPath: 'id', indexes: [['book_id', 'book_id'], ['isbn', 'isbn'], ['trashed_at', 'trashed_at']] },
  source_documents:    { keyPath: 'id', indexes: [['edition_id', 'edition_id'], ['sha256', 'sha256'], ['scan_session_id', 'scan_session_id']] },
  source_pages:        { keyPath: 'id', indexes: [['document_id', 'document_id'], ['edition_id', 'edition_id']] },
  scan_sessions:       { keyPath: 'id', indexes: [] },
  dishes:              { keyPath: 'id', indexes: [] },
  dish_recipe_links:   { keyPath: 'id', indexes: [['dish_id', 'dish_id'], ['recipe_id', 'recipe_id']] },
  recipes:             { keyPath: 'id', indexes: [['edition_id', 'edition_id'], ['trashed_at', 'trashed_at']] },
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
  // Configuration de l'assistant IA : une ligne 'llm', synchronisée sur les hôtes de production (spec
  // 2026-10-17-assistant-par-le-compte § 4). noDelete : jamais de suppression d'origine locale (K-6, lue par db.mutate).
  // (capture, envoi initial et réception le filtrent par le prédicat injecté configSuitLeCompte, faux par défaut : R-CPT-1)
  assistant_config:    { keyPath: 'id', indexes: [], noDelete: true },
  // Journal des imports (lot A « Importer une recette repérée », spec import-cible § 3.1) : DERNIER magasin synchronisé, déclaré après
  // assistant_config et avant settings pour garder l'ordre de réception (K-9). recipe_id et page_ids[] sont des pointeurs souples
  // (hors RELATIONS, comme cover_sha256) : une recette supprimée ou une page retirée ne bloquent pas une archive.
  imports:             { keyPath: 'id', indexes: [['edition_id', 'edition_id'], ['recipe_id', 'recipe_id'], ['status', 'status']] },
  settings:            { keyPath: 'key', indexes: [] },
  // Magasins internes de la synchronisation (spec § 5.1) — jamais archivés.
  outbox:              { keyPath: 'seq', autoIncrement: true, indexes: [['store_id', ['store', 'id']]] },
  sync_state:          { keyPath: 'key', indexes: [] },
  sync_conflicts:      { keyPath: 'id', indexes: [] },
};

// Magasins internes du lot « compte et stockage distant » (spec § 5.1) : jamais archivés, jamais synchronisés.
export const SYNC_INTERNAL_STORES = ['outbox', 'sync_state', 'sync_conflicts'];
// Magasins de données inclus dans l'archive complète. « files » est exporté sous forme de fichiers (files/<sha256>).
// assistant_config : porte une clé, jamais archivée (K-7).
export const ARCHIVE_DATA_STORES = Object.keys(STORES).filter((s) => s !== 'files' && s !== 'settings' && s !== 'assistant_config' && !SYNC_INTERNAL_STORES.includes(s));
// Réglages exclus de la sauvegarde : secrets d'accès (spec §31.1).
export const SECRET_SETTING_KEYS = ['llm'];
// Magasins ajoutés APRÈS le format d'archive 1 (spec import-cible § 3.7, C1) : une archive plus ancienne ne les porte pas. À l'inspection
// et à la restauration, un magasin de cette liste absent de l'archive vaut [] ; décomptes et empreintes ne l'exigent pas. Un client plus
// ancien qui lit une archive plus récente la refuse déjà (« Description de magasin absente ou inconnue »).
export const MAGASINS_AJOUTES_APRES_V1 = ['imports'];

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
  ['recipes', 'restored_from_edition.edition_id', 'book_editions'],

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

  // Journal des imports (spec import-cible § 3.1) : recipe_id et page_ids[] sont VOLONTAIREMENT absents (pointeurs souples).
  ['imports', 'edition_id', 'book_editions'],
  ['imports', 'scan_session_id', 'scan_sessions'],
];

// Vocabulaire fermé des états (libellés visibles dans src/i18n).
export const AVAILABILITY = ['reference_only', 'partial', 'available'];
// D-B6 (lot B) : d'où vient le texte d'une recette lue sur le web — les données publiées par la page (JSON-LD) ou le texte lu par le modèle.
export const SOURCE_KINDS = Object.freeze(['jsonld', 'modele']);
export const VERIFICATION = ['unverified', 'to_verify', 'verified'];
// Lot F « Les plats en images » (spec § 3.1, D-F1) : l'origine d'une photo du plat — prise ici (photo), choisie ici (image) ou rapatriée d'une page
// web par la fonction de l'assistant (web). Liste FERMÉE, lue par assertVocabulaire ; l'écran ciblé du lot A n'admet que les deux premières.
export const PHOTO_ORIGINS = Object.freeze(['photo', 'image', 'web']);
// L'empreinte d'une ligne files (sa clé) : 64 chiffres hexadécimaux en minuscules. UNE définition pour les lecteurs du lot F (un pointeur
// venu d'ailleurs n'est lu que s'il la passe, règle T4-R1-d du lot A).
export const HASH = /^[0-9a-f]{64}$/;
export const VERSION_KIND = ['extraction', 'correction', 'adaptation', 'translation', 'synthesis'];
export const VERSION_STATUS = ['proposed', 'tested'];
// États du journal des imports (spec import-cible § 3.1) ; les transitions permises vivent dans src/domain/import-cible.js (tâche 3).
export const STATUTS_IMPORT = ['a_lancer', 'en_cours', 'a_verifier', 'enregistre', 'echec', 'ignore'];
// Les sortes du journal (lot D, spec D-D12, § 3.4) : vocabulaire FERMÉ de imports.kind — les cinq sortes de l'audit § 2, `web` (lot B) et `couverture`
// (lot E) comprises, pour qu'aucun lot ne rougisse l'autre. Les sortes qu'un chemin OUVRE ou LISTE vivent dans KINDS_IMPORT (src/domain/import-cible.js).
export const SORTES_IMPORT = ['recette', 'index', 'web', 'couverture', 'classement', 'livre', 'thermomix', 'reperes'];
// Les deux états TERMINAUX (aucune transition n'en sort) ; les autres sont « ouverts » : un seul import ouvert par recette (I-2), et seule la
// séance d'un import ouvert est exclue des rappels génériques (§ 4.1). Une seule définition, lue par le domaine (import-cible.js) et par repo.ajouterPages.
export const IMPORTS_TERMINES = ['enregistre', 'ignore'];
export const LINK_STATE = ['proposed', 'confirmed', 'refused'];
export const RECIPE_TYPES = ['plat_principal', 'entree', 'salade', 'soupe', 'legumes', 'feculent', 'sauce', 'dessert', 'boulangerie', 'boisson', 'autre'];
export const MEAL_ROLES = ['plat_principal', 'entree', 'accompagnement', 'dessert', 'autre'];
export const DIET_TAGS = ['sans_gluten', 'vegetarien', 'vegetalien', 'sans_lactose', 'sans_noix', 'sans_oeufs', 'sans_fruits_de_mer', 'sans_porc', 'sans_alcool'];
export const CAPABILITIES = ['weigh', 'chop', 'blend', 'emulsify', 'steam', 'slow_cook', 'sous_vide', 'controlled_heating', 'knead', 'bake', 'convection', 'broil', 'grill', 'smoke', 'fry', 'air_fry', 'pressure_cook', 'rice_cook', 'vacuum_seal', 'stir_fry', 'boil', 'simmer', 'ferment', 'dehydrate'];
