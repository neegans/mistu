// Tests du lot « compte et stockage distant » : constantes, tables, types, base, capture, connexion.
// Bases IndexedDB temporaires cuisine-os-sync-test-* seulement ; aucun réseau.
import { STORES, SYNC_STORES, SYNC_INTERNAL_STORES } from '../src/model/schema.js';
import { TABLES, keyOf } from '../src/sync/tables.js';

export async function runSyncTests({ eq, ok }) {
  // --- Constantes et tables (spec § 3.1, § 7.1)
  eq(SYNC_INTERNAL_STORES, ['outbox', 'sync_state', 'sync_conflicts'], 'trois magasins internes');
  eq(SYNC_STORES.length, 25, '25 magasins synchronisables');
  ok(!SYNC_STORES.includes('settings') && SYNC_INTERNAL_STORES.every((s) => !SYNC_STORES.includes(s)), 'settings et internes exclus');
  eq(Object.keys(TABLES).sort(), [...SYNC_STORES].sort(), 'une table par magasin synchronisable');
  for (const store of SYNC_STORES) {
    const table = TABLES[store];
    eq(table.key, STORES[store].keyPath, `${store} : clé = keyPath`);
    const indexNames = (STORES[store].indexes || []).map(([name]) => name).sort();
    const generated = table.generated.map((g) => g.name).filter((n) => !['size', 'mime'].includes(n) || store !== 'files').sort();
    eq(generated, indexNames, `${store} : colonnes générées = index de STORES`);
  }
  eq(TABLES.files.generated.map((g) => `${g.name}:${g.type}`).sort(), ['mime:text', 'size:bigint'], 'files : size bigint et mime text en plus');
  ok(TABLES.recipe_versions.required.includes('recipe_id') && TABLES.source_pages.required.includes('document_id'), 'champs de relation obligatoires déclarés');
  eq(keyOf('files', { sha256: 'abc' }), 'abc', 'keyOf files');
  eq(keyOf('rediscovery_prefs', { edition_id: 'ed1' }), 'ed1', 'keyOf rediscovery_prefs');
  eq(keyOf('settings', { key: 'ui_locale' }), 'ui_locale', 'keyOf settings');
  eq(keyOf('recipes', { id: 'rc1' }), 'rc1', 'keyOf recipes');
}
