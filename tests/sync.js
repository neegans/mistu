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
  eq(resolveMime('', 'x.constructor'), { mime: 'application/octet-stream', syncable: false }, 'une extension homonyme d’une propriété native ne fuit rien');
  eq(extensionFor('constructor'), 'bin', 'extensionFor : même garde');
  eq(resolveMime('image/jpeg; charset=binary', 'a'), { mime: 'image/jpeg', syncable: true }, 'paramètre charset ignoré après le type déclaré');
  eq(resolveMime('', 'archive.zip'), { mime: 'application/octet-stream', syncable: false }, 'extension inconnue (zip) non synchronisable');

  // --- db.mutate : une transaction, crochet de capture, autoIncrement (spec § 5.1, § 5.2)
  const { Database, MUTATING_METHODS } = await import('../src/core/db.js');
  const { withDatabase } = await import('./backup.js');
  const TEST_STORES = { a: { keyPath: 'id', indexes: [] }, b: { keyPath: 'id', indexes: [] }, journal: { keyPath: 'seq', autoIncrement: true, indexes: [] } };
  eq(MUTATING_METHODS.sort(), ['clear', 'clearAll', 'delete', 'deleteMany', 'mutate', 'put', 'putBatch', 'putMany'], 'liste des méthodes mutantes exportée');
  await withDatabase(async (db) => {
    await db.mutate({ puts: { a: [{ id: 'a1' }], journal: [{ note: 'x' }, { note: 'y' }] } });
    const rows = await db.getAll('journal');
    eq(rows.map((r) => r.seq), [1, 2], 'autoIncrement : clés 1, 2');
    db.onMutate = ({ puts, deletes, origin }) => origin === 'local' ? { journal: [{ note: 'capture:' + Object.keys(puts).join(',') + '|' + Object.keys(deletes).join(',') }] } : null;
    await db.mutate({ puts: { b: [{ id: 'b1' }] } });
    eq((await db.getAll('journal')).at(-1).note, 'capture:b|', 'le crochet écrit dans la même transaction');
    await db.mutate({ puts: { a: [{ id: 'a2' }] }, origin: 'remote' });
    eq((await db.getAll('journal')).length, 3, 'origin remote : aucune capture');
    let threw = false;
    try { await db.mutate({ puts: { a: [{ pas_de_cle: true }] }, deletes: { b: ['b1'] } }); } catch { threw = true; }
    ok(threw, 'une écriture sans clé lève');
    eq((await db.get('b', 'b1'))?.id, 'b1', 'et la suppression du même lot est annulée');
    eq((await db.getAll('journal')).length, 3, 'et aucune capture n’est restée');
    await db.mutate({ deletes: { b: ['b1'] } });
    eq(await db.get('b', 'b1'), undefined, 'suppression par mutate');
    eq((await db.getAll('journal')).at(-1).note, 'capture:|b', 'la suppression est capturée avec son magasin');
  }, TEST_STORES);

  // --- Schéma v2 et archive (spec § 5.1, I3)
  const schema = await import('../src/model/schema.js');
  const { createArchive, inspectArchive, applyArchive, verifyRestored } = await import('../src/domain/backup.js');
  eq(schema.DB_VERSION, 2, 'DB_VERSION 2');
  eq(schema.STORES.outbox, { keyPath: 'seq', autoIncrement: true, indexes: [['store_id', ['store', 'id']]] }, 'outbox autoIncrement');
  ok(schema.STORES.sync_state.keyPath === 'key' && schema.STORES.sync_conflicts.keyPath === 'id', 'sync_state et sync_conflicts');
  ok(schema.SYNC_INTERNAL_STORES.every((s) => !schema.ARCHIVE_DATA_STORES.includes(s)), 'internes hors archive');
  // Archive v1 d'avant le lot : produite par une base v1 (sans magasins internes), restaurée dans une base v2.
  const V1_STORES = Object.fromEntries(Object.entries(schema.STORES).filter(([n]) => !schema.SYNC_INTERNAL_STORES.includes(n)));
  const archiveV1 = await withDatabase(async (db) => {
    await db.putBatch({ books: [{ id: 'b1', title: 'V1' }], unit_definitions: [{ id: 'g' }], unit_conventions: [{ id: 'uc' }], ingredients: [{ id: 'ing' }] });
    return (await createArchive(db)).blob.arrayBuffer();
  }, V1_STORES);
  await withDatabase(async (db) => {
    const insp = await inspectArchive(await archiveV1);
    ok(insp.ok, 'archive v1 acceptée par la v2 : ' + insp.errors.join(' · '));
    await db.mutate({ puts: { outbox: [{ store: 'books', id: 'b9', op: 'put' }], sync_state: [{ key: 'user_id', value: 'u' }] } });
    await applyArchive(db, insp, { mode: 'replace' });
    eq((await db.getAll('outbox')).length, 1, 'remplacement : outbox intacte');
    eq((await db.getAll('sync_state')).length, 1, 'remplacement : sync_state intact');
    ok((await verifyRestored(db, insp, { mode: 'replace' })).ok, 'vérification verte');
  });
  // Une ligne files reçue sans octets n'empêche ni l'archive ni la vérification (spec § 5.4).
  await withDatabase(async (db) => {
    await db.putBatch({ files: [{ sha256: 'a'.repeat(64), mime: 'image/jpeg', size: 3, remote: true, updated_at: '2026-10-12T10:00:00Z' }], unit_definitions: [{ id: 'g' }], unit_conventions: [{ id: 'uc' }], ingredients: [{ id: 'ing' }] });
    const archive = await createArchive(db);
    eq(archive.missingFiles, 1, 'archive : une page non téléchargée comptée');
    eq(archive.manifest.files.length, 0, 'et absente de l’archive');
  });

  // --- Durcissement (spec § 6.2, § 5.4, § 6.4)
  for (const page of ['../index.html', './index.html']) {
    const html = await (await fetch(page)).text();
    ok(/http-equiv="Content-Security-Policy"/.test(html) && /script-src 'self'/.test(html) && !/frame-ancestors/.test(html), page + ' : CSP présente, script-src self, sans frame-ancestors');
    ok(/name="referrer" content="no-referrer"/.test(html), page + ' : referrer no-referrer');
    ok(!/<style>/.test(html) && !/<script>(?!<)/.test(html.replace(/<script type="module" src=[^>]+><\/script>/g, '')), page + ' : ni style ni script inline');
  }
  const { displayUrl } = await import('../src/sync/mime.js');
  eq(displayUrl({ mime: 'text/html', blob: new Blob(['<script>1</script>'], { type: 'text/html' }) }), null, 'HTML : jamais d’URL d’affichage');
  const url = displayUrl({ mime: 'image/svg+xml', blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }) });
  eq(url, null, 'SVG : jamais');
  const jpg = displayUrl({ mime: 'image/jpeg', blob: new Blob([1], { type: 'text/html' }) });
  ok(typeof jpg === 'string' && jpg.startsWith('blob:'), 'JPEG : URL d’un blob retypé image/jpeg');
  const { logError } = await import('../src/core/log.js');
  const seen = []; const orig = console.error; console.error = (...a) => seen.push(a);
  logError('sync.push', { store: 'books', id: 'b1', secret: 'ne doit pas sortir', error: new Error('corps de réponse') });
  console.error = orig;
  eq(seen.length, 1, 'un seul appel console');
  ok(JSON.stringify(seen[0]).includes('books') && !JSON.stringify(seen[0]).includes('corps de réponse') && !JSON.stringify(seen[0]).includes('ne doit pas sortir'), 'console : code et identifiants seulement');

  // Ronde 1 : le bouton de repli doit exister avant toute resolution du fichier (le refus L4 n'est pas detectable a l'avance, spec I5).
  const { pdfFrame } = await import('../src/ui/components.js');
  const frame = pdfFrame({ sha256: 'z'.repeat(64), filename: 'x.pdf' });
  ok(frame.querySelector('iframe[sandbox]'), 'pdfFrame : iframe sandbox present avant resolution');
  ok([...frame.querySelectorAll('button')].some((b) => b.textContent === 'Télécharger le fichier'), 'pdfFrame : bouton Télécharger le fichier toujours present');

  // --- Service worker (spec § 5.6)
  const rules = globalThis.CuisineSwRules;
  ok(rules && typeof rules.shouldCache === 'function', 'sw-rules.js chargé');
  const origin = 'https://exemple.test';
  ok(rules.shouldCache({ url: origin + '/mistu/', method: 'GET' }, origin), 'navigation sans paramètres : cache');
  ok(!rules.shouldCache({ url: origin + '/mistu/?code=abc', method: 'GET' }, origin), 'avec ?code= : jamais en cache');
  ok(!rules.shouldCache({ url: 'https://autre.test/x.js', method: 'GET' }, origin), 'autre origine : jamais');
  ok(!rules.shouldCache({ url: origin + '/mistu/', method: 'POST' }, origin), 'POST : jamais');
  ok(rules.isSameOriginGet({ url: origin + '/mistu/?code=abc', method: 'GET' }, origin), 'isSameOriginGet : GET même origine avec paramètres');
  ok(!rules.isSameOriginGet({ url: 'https://autre.test/x.js', method: 'GET' }, origin), 'isSameOriginGet : autre origine');

  // --- Capture (spec § 5.2) et repo (spec § 5.1)
  const { installCapture, uninstallCapture } = await import('../src/sync/outbox.js');
  await withDatabase(async (db) => {
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false });
    await db.mutate({ puts: { recipes: [{ id: 'r1', updated_at: '2026-10-12T10:00:00Z' }], settings: [{ key: 'k', value: 1 }], library_activity: [{ id: 'act1', edition_id: 'e', updated_at: '2026-10-12T10:00:00Z' }] } });
    let out = await db.getAll('outbox');
    eq(out.map((o) => [o.store, o.id, o.op, o.user_id]), [['recipes', 'r1', 'put', 'u1']], 'recipes capturé ; settings et library_activity (réglage off) non');
    await db.mutate({ deletes: { recipes: ['r1'] }, payloads: { recipes: { r1: { id: 'r1', updated_at: '2026-10-12T10:00:00Z' } } } });
    out = await db.getAll('outbox');
    eq([out.at(-1).op, out.at(-1).payload?.id], ['delete', 'r1'], 'suppression capturée avec sa copie');
    await db.mutate({ puts: { recipes: [{ id: 'r2', updated_at: '2026-10-12T10:00:00Z' }] }, origin: 'remote' });
    eq((await db.getAll('outbox')).length, 2, 'réception : non capturée');
    await db.mutate({ clearStores: ['recipes'], origin: 'device' });
    eq((await db.getAll('outbox')).length, 2, 'vidage d’appareil : non capturé');
    uninstallCapture(db);
  });
  const { withRepo } = await import('./sync-fixture.js'); // base temporaire v2, repo lié dessus
  await withRepo(async (repo, db) => {
    const row = await repo.putFile('b'.repeat(64), new Blob(['x'], { type: '' }), { original_filename: 'IMG.HEIC' });
    ok(row.updated_at && row.mime === 'image/heic' && row.syncable === true, 'putFile : updated_at, type résolu, synchronisable');
    const unknown = await repo.putFile('c'.repeat(64), new Blob(['y'], { type: '' }), { original_filename: 'notes.txt' });
    ok(unknown.syncable === false && unknown.mime === 'application/octet-stream', 'type inconnu : gardé localement, non synchronisable');
    await db.mutate({ puts: { files: [{ sha256: 'd'.repeat(64), mime: 'image/jpeg', size: 1, remote: true, updated_at: '2026-10-12T10:00:00Z' }] }, origin: 'remote' });
    const filled = await repo.putFile('d'.repeat(64), new Blob(['z'], { type: 'image/jpeg' }), { origin: 'remote' });
    ok(filled.blob instanceof Blob, 'putFile remote : le blob est écrit sur une ligne qui n’en avait pas');
    await repo.recordActivity('ed1', 'open');
    ok((await db.getAll('library_activity'))[0].updated_at, 'recordActivity : updated_at');
    await repo.save('recipes', { id: 'r1' });
    await repo.remove('recipes', 'r1');
    const out = await db.getAll('outbox');
    eq(out.map((o) => o.op), ['put', 'put', 'put', 'delete'].slice(-out.length), 'ordre des captures');
    await repo.clearDevice({ signOut: async () => {} });
    eq([(await db.getAll('recipes')).length, (await db.getAll('outbox')).length, (await db.getAll('sync_state')).map((s) => s.key)], [0, 0, ['device_id']], 'clearDevice : tout vidé sauf device_id');
  });
  // Test statique : aucune écriture directe hors repo.js, src/sync/ et backup.js (spec § 5.2)
  const swText = await (await fetch('../sw.js')).text();
  const shell = [...swText.matchAll(/'(\.\/src\/[^']+\.js)'/g)].map((m) => m[1]);
  const forbidden = new RegExp('\\bdb\\.(' + MUTATING_METHODS.join('|') + ')\\s*\\(');
  const offenders = [];
  for (const file of shell) {
    if (/src\/model\/repo\.js$|src\/sync\/|src\/domain\/backup\.js$|src\/core\/db\.js$/.test(file)) continue;
    if (forbidden.test(await (await fetch('../' + file.slice(2))).text())) offenders.push(file);
  }
  eq(offenders, [], 'aucune écriture IndexedDB directe hors des portes autorisées');
}
