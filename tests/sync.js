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

  // --- Types de fichiers (spec § 3.6, § 5.4)
  const { ALLOWED_MIME, resolveMime, isAllowed, safeDisplayType, extensionFor } = await import('../src/sync/mime.js');
  eq(ALLOWED_MIME, ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/epub+zip'], 'liste blanche fermée');
  eq(resolveMime('image/jpeg', 'x.jpg'), { mime: 'image/jpeg', syncable: true }, 'type connu conservé');
  eq(resolveMime('', 'IMG_0012.HEIC'), { mime: 'image/heic', syncable: true }, 'type vide résolu par l’extension, insensible à la casse');
  eq(resolveMime('application/octet-stream', 'scan.pdf'), { mime: 'application/pdf', syncable: true }, 'octet-stream résolu par l’extension');
  eq(resolveMime('', 'notes.txt'), { mime: 'application/octet-stream', syncable: false }, 'inconnu : conservé localement, non synchronisable');
  eq(resolveMime('text/html', 'page.html'), { mime: 'application/octet-stream', syncable: false }, 'HTML : jamais un type affichable');
  ok(isAllowed('image/png') && !isAllowed('image/svg+xml') && !isAllowed('text/html'), 'isAllowed');
  eq(safeDisplayType('image/svg+xml'), null, 'SVG jamais affiché comme image');
  eq(safeDisplayType('application/pdf'), 'application/pdf', 'PDF affichable');
  eq(extensionFor('image/heic'), 'heic', 'extension de la liste');
}
