// Accès aux données : base unique, amorçage des références, réglages et journal d'activité.
import { Database } from '../core/db.js';
import { DB_NAME, DB_VERSION, STORES } from './schema.js';
import { UNIT_DEFINITIONS, UNIT_CONVENTIONS, INGREDIENTS } from './seed.js';
import { newId, nowIso } from '../core/ids.js';
import { emit } from '../core/bus.js';

export const db = new Database(DB_NAME, DB_VERSION, STORES);

export async function init() {
  await db.open();
  // Références : ajoutées seulement si absentes (jamais écrasées, pour préserver les corrections de l'utilisateur).
  const [units, conventions, ingredients] = await Promise.all([
    db.getAll('unit_definitions'), db.getAll('unit_conventions'), db.getAll('ingredients'),
  ]);
  const have = (rows) => new Set(rows.map((r) => r.id));
  const batch = {
    unit_definitions: UNIT_DEFINITIONS.filter((u) => !have(units).has(u.id)),
    unit_conventions: UNIT_CONVENTIONS.filter((c) => !have(conventions).has(c.id)),
    ingredients: INGREDIENTS.filter((i) => !have(ingredients).has(i.id)),
  };
  await db.putBatch(batch);
}

// --- Réglages -------------------------------------------------------------
const DEFAULT_SETTINGS = {
  ui_locale: 'fr',            // langue de l'interface
  reading_locale: 'original', // langue de lecture : original | fr | en
  units: 'original',          // unités souhaitées : original | metric | us
  rediscover_enabled: true,
  last_backup: null,          // { at, counts, files, bytes }
  device_name: '',
  llm: { provider: 'none' },  // exclu de la sauvegarde
};

export async function getSetting(key) {
  const row = await db.get('settings', key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

export async function getSettings() {
  const rows = await db.getAll('settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key, value) {
  await db.put('settings', { key, value, updated_at: nowIso() });
  emit('settings', { key, value });
}

// --- Aides génériques ------------------------------------------------------
export function stamp(record) {
  const now = nowIso();
  return { created_at: now, updated_at: now, ...record };
}

export async function save(store, record) {
  const r = { ...record, updated_at: nowIso() };
  if (!r.created_at) r.created_at = r.updated_at;
  await db.put(store, r);
  emit('change', { store, id: r.id ?? r.key ?? r.edition_id ?? r.sha256 });
  return r;
}

export async function saveBatch(batch) {
  const now = nowIso();
  const stamped = {};
  for (const [store, rows] of Object.entries(batch)) {
    stamped[store] = rows.map((r) => ({ ...r, created_at: r.created_at || now, updated_at: now }));
  }
  await db.putBatch(stamped);
  for (const store of Object.keys(stamped)) emit('change', { store });
  return stamped;
}

export async function remove(store, key) {
  await db.delete(store, key);
  emit('change', { store, id: key });
}

export const all = (store) => db.getAll(store);
export const get = (store, key) => db.get(store, key);
export const byIndex = (store, index, value) => db.byIndex(store, index, value);

export function indexBy(rows, key = 'id') {
  const m = new Map();
  for (const r of rows) m.set(r[key], r);
  return m;
}

export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = typeof key === 'function' ? key(r) : r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

// --- Fichiers (stockage d'objets local, dédupliqué par empreinte) --------
export async function putFile(sha256, blob, meta = {}) {
  const existing = await db.get('files', sha256);
  if (existing) return existing;
  const row = { sha256, blob, mime: blob.type || meta.mime || 'application/octet-stream', size: blob.size, created_at: nowIso(), ...meta };
  await db.put('files', row);
  return row;
}

export const getFile = (sha256) => db.get('files', sha256);

// --- Journal de consultation (spec §32) : seules les ouvertures volontaires comptent ------------
export async function recordActivity(edition_id, event_type, extra = {}) {
  if (!edition_id) return;
  await db.put('library_activity', { id: newId('act'), edition_id, event_type, occurred_at: nowIso(), ...extra });
  emit('change', { store: 'library_activity' });
}

// --- Chargement groupé d'une recette avec ses versions et sa provenance ---
export async function loadRecipeBundle(recipeId) {
  const recipe = await db.get('recipes', recipeId);
  if (!recipe) return null;
  const [versions, edition, links, history, translations] = await Promise.all([
    db.byIndex('recipe_versions', 'recipe_id', recipeId),
    recipe.edition_id ? db.get('book_editions', recipe.edition_id) : null,
    db.byIndex('dish_recipe_links', 'recipe_id', recipeId),
    db.byIndex('cook_history', 'recipe_id', recipeId),
    db.getAll('recipe_translations'),
  ]);
  const book = edition ? await db.get('books', edition.book_id) : null;
  versions.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const versionIds = new Set(versions.map((v) => v.id));
  const pageIds = new Set(recipe.source_page_ids || []);
  const pages = pageIds.size ? (await db.getMany('source_pages', [...pageIds])).filter(Boolean) : [];
  history.sort((a, b) => (b.cooked_at || '').localeCompare(a.cooked_at || ''));
  return {
    recipe, versions, edition, book, links, history, pages,
    translations: translations.filter((t) => versionIds.has(t.recipe_version_id)),
  };
}

export { newId, nowIso };
