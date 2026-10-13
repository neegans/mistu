// Accès aux données : base unique, amorçage des références, réglages et journal d'activité.
import { Database } from '../core/db.js';
import { DB_NAME, DB_VERSION, STORES, SYNC_STORES } from './schema.js';
import { UNIT_DEFINITIONS, UNIT_CONVENTIONS, INGREDIENTS } from './seed.js';
import { newId, nowIso } from '../core/ids.js';
import { emit } from '../core/bus.js';
import { syncNow } from '../sync/clock.js';
import { resolveMime } from '../sync/mime.js';

// Base de l'application. Liaison vivante : bindDatabase ne sert qu'aux tests, pour travailler sur une base jetable.
export let db = new Database(DB_NAME, DB_VERSION, STORES);
export function bindDatabase(database) { db = database; }

// --- Identité de l'appareil (spec § 5.1, § 4.2) ----------------------------
// Une seule identité, gardée dans sync_state : elle survit au vidage (clearDevice), jamais capturée, jamais envoyée.
// Migration unique : l'identité d'avant le lot vivait dans localStorage. Elle est reprise si la base n'en a pas,
// et la clé est retirée dans tous les cas — plus aucune identité ne vit hors de la base (src/ui/import.js lit
// maintenant deviceId()). C'est le seul endroit du code qui nomme encore l'ancienne clé.
const LEGACY_DEVICE_KEY = 'cuisineos.device';
let deviceIdValue = null;

// Lit et retire l'ancienne clé d'un seul geste : rien ne doit rester à lire une seconde fois.
function takeLegacyDevice() {
  try {
    const value = localStorage.getItem(LEGACY_DEVICE_KEY);
    if (value !== null) localStorage.removeItem(LEGACY_DEVICE_KEY);
    return value || null;
  } catch { return null; } // stockage indisponible : aucune migration à faire
}

async function ensureDeviceId() {
  const row = await db.get('sync_state', 'device_id');
  let value = row?.value || null;
  const ancienne = takeLegacyDevice();
  if (!value) {
    value = ancienne || newId('dev'); // reprise de l'identité d'avant le lot, sinon une neuve
    await db.mutate({ puts: { sync_state: [{ key: 'device_id', value }] }, origin: 'device' });
  }
  deviceIdValue = value;
  return value;
}

// Synchrone : utilisable au moment de créer une fiche. Vaut null avant init().
export function deviceId() { return deviceIdValue; }

export async function init() {
  await db.open();
  await ensureDeviceId();
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
  // Horodatées à l'insertion (R26) : ces trois magasins sont dans SYNC_STORES, et sync_push rejette une fiche sans
  // updated_at — les 96 références seraient parties en quarantaine au premier envoi initial (spec § 5.2, § 5.3).
  // Seuls les magasins qui ont réellement quelque chose à écrire sont touchés : rien à faire au démarrage ordinaire.
  // Origine 'device' : comme la passe d'horodatage, l'amorçage n'est pas une écriture de la personne et n'a rien à
  // envoyer. init() précède installCapture au démarrage, mais un rappel d'init() sur une base amputée d'une
  // référence (restauration partielle, référence corrigée puis supprimée) mettrait sinon jusqu'à 96 fiches en file.
  const aPoser = Object.fromEntries(Object.entries(batch).filter(([, rows]) => rows.length));
  if (Object.keys(aPoser).length) await saveBatch(aPoser, { origin: 'device' });
  await horodaterAnciennesFiches();
}

// Rattrapage unique (R26) : les fiches écrites AVANT ce lot n'ont pas d'updated_at ; sans lui, chacune serait
// rejetée par sync_push et mise en quarantaine immédiate (spec § 5.3). Elles sont horodatées une fois, à la montée.
// Origine 'device' : la capture ne retient que 'local' (src/sync/outbox.js) — un rattrapage n'est pas une écriture
// de la personne et n'a rien à envoyer. La garde évite de relire les 25 magasins à chaque démarrage.
const STAMP_GUARD = 'stamp_updated_at';
async function horodaterAnciennesFiches() {
  const fait = await db.get('sync_state', STAMP_GUARD);
  if (fait?.value === DB_VERSION) return 0;
  const now = syncNow();
  const puts = {};
  let n = 0;
  for (const store of SYNC_STORES) {
    const rows = (await db.getAll(store)).filter((r) => r && !r.updated_at);
    if (!rows.length) continue;
    puts[store] = rows.map((r) => ({ ...r, updated_at: now }));
    n += rows.length;
  }
  // La garde part dans la MÊME transaction que l'horodatage : une passe à moitié faite serait rejouée en entier.
  puts.sync_state = [{ key: STAMP_GUARD, value: DB_VERSION }];
  await db.mutate({ puts, origin: 'device' });
  return n;
}

// --- Réglages -------------------------------------------------------------
const DEFAULT_SETTINGS = {
  ui_locale: 'fr',            // langue de l'interface
  reading_locale: 'original', // langue de lecture : original | fr | en
  units: 'original',          // unités souhaitées : original | metric | us
  rediscover_enabled: true,
  sync_activity: false,       // historique de consultation envoyé au serveur : jamais sans ce geste (spec § 4.2)
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
// Les fiches synchronisées sont horodatées par l'horloge corrigée (spec § 5.3), jamais par l'heure brute de l'appareil.
export function stamp(record) {
  const now = syncNow();
  return { created_at: now, updated_at: now, ...record };
}

export async function save(store, record) {
  const r = { ...record, updated_at: syncNow() };
  if (!r.created_at) r.created_at = r.updated_at;
  await db.put(store, r);
  emit('change', { store, id: r.id ?? r.key ?? r.edition_id ?? r.sha256 });
  return r;
}

// `origin` : 'local' par défaut (écriture de la personne, donc capturée) ; 'device' pour ce qui ne part jamais au
// serveur (amorçage des références, rattrapages) — c'est la capture qui tranche, d'après l'origine (src/sync/outbox.js).
export async function saveBatch(batch, { origin = 'local' } = {}) {
  const now = syncNow();
  const stamped = {};
  for (const [store, rows] of Object.entries(batch)) {
    stamped[store] = rows.map((r) => ({ ...r, created_at: r.created_at || now, updated_at: now }));
  }
  await db.putBatch(stamped, { origin });
  for (const store of Object.keys(stamped)) emit('change', { store });
  return stamped;
}

// La fiche est relue avant sa suppression : la capture a besoin de sa copie pour l'envoyer (spec § 5.1).
export async function remove(store, key) {
  const existing = await db.get(store, key);
  await db.mutate({ deletes: { [store]: [key] }, payloads: { [store]: { [key]: existing || null } } });
  emit('change', { store, id: key });
}

// Même forme pour un lot : une seule transaction, toutes les copies lues avant.
export async function removeMany(store, keys) {
  if (!keys.length) return;
  const existing = await db.getMany(store, keys);
  const payloads = Object.create(null); // une clé homonyme d'une propriété native reste une clé, pas un héritage
  keys.forEach((key, i) => { payloads[key] = existing[i] || null; });
  await db.mutate({ deletes: { [store]: keys }, payloads: { [store]: payloads } });
  emit('change', { store });
}

// Efface tout ce qui est à cet appareil sauf son identité ; jamais capturé (spec § 5.1).
export async function clearDevice({ signOut } = {}) {
  const device = await db.get('sync_state', 'device_id');
  // mutate vide avant d'écrire : device_id est remis dans la même transaction.
  await db.mutate({ clearStores: Object.keys(STORES), puts: device ? { sync_state: [device] } : {}, origin: 'device' });
  // Les données sont déjà parties : un échec de déconnexion ne doit pas faire croire que l'effacement a échoué
  // (l'appareil se retrouverait connecté sur une base vide, que la garde de compte ne peut plus détecter).
  if (signOut) { try { await signOut(); } catch { /* session laissée ouverte : visible dans Réglages */ } }
  emit('change', { store: '*' });
}

// Retrait d'un consentement (spec § 4.2, R27) : ce qui attendait de partir pour ce magasin est retiré de la file.
// L'outbox est interne et n'est dans aucun SYNC_STORES ; l'origine 'device' n'est de toute façon jamais capturée.
export async function oublierEnvois(store) {
  const seqs = (await db.getAll('outbox')).filter((r) => r?.store === store).map((r) => r.seq);
  if (!seqs.length) return 0;
  await db.mutate({ deletes: { outbox: seqs }, origin: 'device' });
  return seqs.length;
}

// --- Porte d'entrée (spec § 11, R34) -------------------------------------
// Le choix « Continuer sans compte » vit EN BASE, dans sync_state, comme l'identité de l'appareil (R19/R20) :
// localStorage est partagé par toutes les pages de l'origine et ne survit pas au même nettoyage. Origine 'device' :
// la capture ne retient que 'local' — ce choix ne part jamais au serveur et n'entre jamais en file.
// clearDevice() vide sync_state sauf device_id : après « Effacer les données de cet appareil », la porte revient.
// C'est voulu : l'appareil est vierge.
const PORTE_KEY = 'porte_entree';

export async function lirePorteEntree() {
  const row = await db.get('sync_state', PORTE_KEY);
  return row?.value?.choix === 'sans_compte' ? 'sans_compte' : null;
}

export async function choisirSansCompte() {
  await db.mutate({ puts: { sync_state: [{ key: PORTE_KEY, value: { choix: 'sans_compte', at: nowIso() } }] }, origin: 'device' });
  return 'sans_compte';
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
// Une ligne reçue du serveur arrive sans octets : le blob est écrit même si la ligne existe déjà (spec § 5.4).
// Aucun refus local : un type hors liste est gardé, visible, marqué non synchronisable.
export async function putFile(sha256, blob, meta = {}) {
  const existing = await db.get('files', sha256);
  if (existing && existing.blob instanceof Blob) return existing;
  const { origin, ...rest } = meta;
  // Le type connu de la ligne existante compte aussi : une ligne reçue du serveur porte son mime sans octets.
  const { mime, syncable } = resolveMime(blob.type || meta.mime || existing?.mime, meta.original_filename || existing?.original_filename);
  const now = syncNow();
  // Les champs calculés passent après meta : ni le type résolu ni la taille réelle ne se font écraser.
  const row = { ...(existing || {}), ...rest, sha256, blob, mime, syncable, size: blob.size, created_at: existing?.created_at || now, updated_at: now };
  await db.mutate({ puts: { files: [row] }, origin: origin === 'remote' ? 'remote' : 'local' });
  return row;
}

export const getFile = (sha256) => db.get('files', sha256);

// --- Journal de consultation (spec §32) : seules les ouvertures volontaires comptent ------------
export async function recordActivity(edition_id, event_type, extra = {}) {
  if (!edition_id) return;
  const now = syncNow();
  await db.mutate({ puts: { library_activity: [{ id: newId('act'), edition_id, event_type, occurred_at: now, updated_at: now, ...extra }] } });
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
