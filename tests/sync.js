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
  eq([...MUTATING_METHODS].sort(), ['clear', 'clearAll', 'delete', 'deleteMany', 'mutate', 'put', 'putBatch', 'putMany'], 'liste des méthodes mutantes exportée');
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
    // Les balises qui portent un `src` sont retirées d'abord ; ce qui reste de `<script` est forcément inline.
    // La forme précédente ne reconnaissait que `<script>` nu : un `<script defer>` ou `<script nonce=…>` inline
    // passait sous le garde-fou (mineur m4 de la revue finale).
    ok(!/<style>/.test(html) && !/<script/.test(html.replace(/<script[^>]*\ssrc="[^"]+"[^>]*><\/script>/g, '')), page + ' : ni style ni script inline (toute balise script porte un src)');
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

  // --- Horloge corrigée (spec § 5.3) : monotone, strictement croissante, décalage mémorisé
  // Le décalage est un état de module, partagé avec tout ce qui horodate (repo.js) : il est remis à 0 en finally,
  // sinon un échec en cours de bloc laisserait l'horloge reculée de 2 h pour toute la suite des tests.
  const { syncNow, setClockOffset, getClockOffset } = await import('../src/sync/clock.js');
  try {
    const t0 = syncNow();
    setClockOffset(-7200000); // horloge locale qui recule de 2 h
    const t1 = syncNow(); const t2 = syncNow();
    ok(t1 > t0 && t2 > t1, 'syncNow : jamais en arrière, jamais deux fois la même valeur sous une horloge reculée');
    eq(getClockOffset(), -7200000, 'décalage mémorisé');
    setClockOffset(undefined);
    eq(getClockOffset(), 0, 'décalage non finie : ramené à 0');
  } finally { setClockOffset(0); }

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
    await db.mutate({ puts: { files: [{ sha256: 'f'.repeat(64), mime: 'text/plain', size: 1 }] } });
    eq((await db.getAll('outbox')).length, 2, 'ligne files d’avant le lot (type hors liste, sans champ syncable) : non capturée');
    // L'autre sens du consentement (R27) : le réglage activé, l'historique entre en file comme n'importe quoi d'autre.
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => true });
    await db.mutate({ puts: { library_activity: [{ id: 'act2', edition_id: 'e', updated_at: '2026-10-12T10:00:00Z' }] } });
    eq((await db.getAll('outbox')).map((o) => [o.store, o.id]).at(-1), ['library_activity', 'act2'], 'réglage activé : l’historique entre en file');
    uninstallCapture(db);
  });
  const { withRepo } = await import('./sync-fixture.js'); // base temporaire v2, repo lié dessus
  await withRepo(async (repo, db) => {
    const device = await db.get('sync_state', 'device_id');
    ok(device?.value && repo.deviceId() === device.value, 'init : device_id créé dans sync_state et rendu par deviceId()');
    eq(localStorage.getItem('cuisineos.device'), null, 'init : aucune identité laissée dans localStorage');
    const { deviceId: deviceIdDepuisImport } = await import('../src/ui/import.js');
    eq(deviceIdDepuisImport(), device.value, 'import.js : deviceId() vient de repo, une seule identité sur l’appareil');
    eq((await repo.getSettings()).sync_activity, false, 'réglage « historique de consultation » : désactivé par défaut');
    const row = await repo.putFile('b'.repeat(64), new Blob(['x'], { type: '' }), { original_filename: 'IMG.HEIC' });
    ok(row.updated_at && row.mime === 'image/heic' && row.syncable === true, 'putFile : updated_at, type résolu, synchronisable');
    const unknown = await repo.putFile('c'.repeat(64), new Blob(['y'], { type: '' }), { original_filename: 'notes.txt' });
    ok(unknown.syncable === false && unknown.mime === 'application/octet-stream', 'type inconnu : gardé localement, non synchronisable');
    await db.mutate({ puts: { files: [{ sha256: 'd'.repeat(64), mime: 'image/jpeg', size: 1, remote: true, updated_at: '2026-10-12T10:00:00Z' }] }, origin: 'remote' });
    const filled = await repo.putFile('d'.repeat(64), new Blob(['z']), { origin: 'remote' });
    ok(filled.blob instanceof Blob && filled.mime === 'image/jpeg' && filled.syncable === true, 'putFile remote : le blob est écrit sur une ligne qui n’en avait pas, et le type connu du serveur est gardé');
    await repo.recordActivity('ed1', 'open');
    ok((await db.getAll('library_activity'))[0].updated_at, 'recordActivity : updated_at');
    // R26 (a) : les 96 fiches de référence amorcées sont horodatées à l'insertion. Sans updated_at, elles seraient
    // toutes rejetées par sync_push et mises en quarantaine au premier envoi initial (spec § 5.2, § 5.3).
    // Qu'elles ne soient pas EN FILE est prouvé par l'assertion « ordre des captures » juste en dessous.
    const amorcees = [...(await db.getAll('unit_definitions')), ...(await db.getAll('unit_conventions')), ...(await db.getAll('ingredients'))];
    eq([amorcees.length, amorcees.filter((r) => r.updated_at).length], [96, 96], 'amorçage : les 96 fiches de référence portent un updated_at');
    await repo.save('recipes', { id: 'r1' });
    await repo.remove('recipes', 'r1');
    const out = await db.getAll('outbox');
    eq(out.map((o) => [o.store, o.id, o.op]), [['files', 'b'.repeat(64), 'put'], ['recipes', 'r1', 'put'], ['recipes', 'r1', 'delete']], 'ordre des captures : rien de plus, rien de moins');
    await repo.clearDevice({ signOut: async () => {} });
    eq([(await db.getAll('recipes')).length, (await db.getAll('outbox')).length, (await db.getAll('sync_state')).map((s) => s.key)], [0, 0, ['device_id']], 'clearDevice : tout vidé sauf device_id');
  });
  // R20 : l'identité d'avant le lot est reprise UNE fois depuis l'ancienne clé, qui est ensuite retirée.
  localStorage.setItem('cuisineos.device', 'dev-ancien');
  await withRepo(async (repo) => {
    eq([repo.deviceId(), localStorage.getItem('cuisineos.device')], ['dev-ancien', null], 'ancienne clé migrée puis retirée');
  });
  localStorage.removeItem('cuisineos.device'); // la fixture replante l'état d'origine : ne rien laisser derrière

  // --- Montée de version 1 → 2 sur une base peuplée (spec § 7.1)
  // Le seul chemin du lot capable de rendre une bibliothèque existante ILLISIBLE : si onupgradeneeded lève,
  // db.open() rejette, boot() tombe dans son catch et l'app entière ne s'ouvre plus. Il faut donc une base
  // réellement ouverte EN VERSION 1 avec les 26 magasins d'avant le lot, puis rouverte par le chemin normal du
  // démarrage (Database v2 + bindDatabase + repo.init()). Aucun test ne l'exerçait : withDatabase ouvrait toujours
  // une base NEUVE directement en v2, ce qui ne touche ni la branche « magasin déjà là » de db.js:65, ni la
  // création de l'index composé ['store','id'] au sein d'une transaction versionchange.
  {
    const repoModule = await import('../src/model/repo.js');
    const baseOrigine = repoModule.db;
    const ancienneCle = localStorage.getItem('cuisineos.device');
    const V1_SEULEMENT = Object.fromEntries(Object.entries(STORES).filter(([n]) => !SYNC_INTERNAL_STORES.includes(n)));
    const avant = {
      recipes: { id: 'r_v1', original_title: 'Avant le lot', availability: 'available', type: 'salade', created_at: '2026-01-02T03:04:05Z' },
      ingredients: { id: 'ing_corrige_a_la_main', labels: { fr: { label: 'sel fin', aliases: [] } } },
      settings: { key: 'reading_locale', value: 'fr' },
    };
    const sansHorodatage = ({ updated_at, ...reste }) => reste;
    try {
      await withDatabase(async (v1) => {
        await v1.mutate({ puts: { recipes: [avant.recipes], ingredients: [avant.ingredients], settings: [avant.settings] } });
        eq([v1.idb.version, v1.idb.objectStoreNames.contains('outbox')], [1, false], 'montée : la base de départ est bien en v1, sans magasin interne');
        v1.idb.close(); v1.idb = null; // la montée a besoin de la base libre
        localStorage.setItem('cuisineos.device', 'dev-avant-le-lot');
        const v2 = new Database(v1.name, schema.DB_VERSION, STORES);
        repoModule.bindDatabase(v2);
        try {
          await repoModule.init(); // chemin normal du démarrage : montée, identité, amorçage, horodatage
          eq(v2.idb.version, 2, 'montée : la base est passée en v2 sans rejet');
          eq(SYNC_INTERNAL_STORES.filter((n) => !v2.idb.objectStoreNames.contains(n)), [], 'les trois magasins internes sont créés par la montée');
          eq(await v2.byIndex('outbox', 'store_id', ['books', 'b1']), [], 'l’index composé store_id du magasin neuf est utilisable');
          // Aucune fiche perdue, aucun champ perdu : les objets sont comparés en entier, pas comptés.
          eq(sansHorodatage(await v2.get('recipes', 'r_v1')), avant.recipes, 'la recette d’avant le lot est intacte, champ pour champ');
          eq(sansHorodatage(await v2.get('ingredients', 'ing_corrige_a_la_main')), avant.ingredients, 'la référence corrigée à la main n’est pas écrasée par l’amorçage');
          eq(await v2.get('settings', 'reading_locale'), avant.settings, 'le réglage est intact et non horodaté (settings n’est pas synchronisé)');
          // R26 : sans updated_at, sync_push rejette (rejected{updated_at}) et la spec § 5.3 met en quarantaine
          // immédiate — une base d'avant le lot partirait donc entièrement en quarantaine au premier envoi initial.
          const sansDate = [];
          for (const store of SYNC_STORES) for (const row of await v2.getAll(store)) if (!row?.updated_at) sansDate.push(store + ':' + (row?.id ?? row?.key ?? row?.sha256 ?? row?.edition_id));
          eq(sansDate, [], 'toute ligne synchronisable porte un updated_at après la montée');
          eq((await v2.getAll('outbox')).length, 0, 'la montée ne met rien en file');
          eq([repoModule.deviceId(), localStorage.getItem('cuisineos.device')], ['dev-avant-le-lot', null], 'device_id repris de l’ancienne clé, qui est retirée');
          eq((await v2.get('sync_state', 'stamp_updated_at'))?.value, schema.DB_VERSION, 'la garde d’horodatage est posée à la version de la base');
          // La garde : une seconde init() ne réhorodate rien. La capture est posée cette fois, donc une passe qui
          // rejouerait laisserait une trace visible dans la file.
          const datesAvant = (await v2.getAll('recipes')).map((r) => r.updated_at);
          installCapture(v2, { getUserId: () => 'u1', isActivitySynced: () => false });
          await repoModule.init();
          uninstallCapture(v2);
          eq([(await v2.getAll('recipes')).map((r) => r.updated_at), (await v2.getAll('outbox')).length], [datesAvant, 0], 'seconde init() : rien n’est réhorodaté, rien n’entre en file');
          // Et la passe elle-même n'est pas capturable : garde retirée, une ligne sans date posée, capture en place.
          installCapture(v2, { getUserId: () => 'u1', isActivitySynced: () => false });
          await v2.mutate({ deletes: { sync_state: ['stamp_updated_at'] }, puts: { books: [{ id: 'b_sans_date', title: 'sans date' }] }, origin: 'device' });
          await repoModule.init();
          uninstallCapture(v2);
          eq([!!(await v2.get('books', 'b_sans_date')).updated_at, (await v2.getAll('outbox')).length], [true, 0],
            'la passe d’horodatage rattrape une ligne sans date par une origine que la capture ignore');
          // L'amorçage lui-même n'est pas capturable : init() précède installCapture au démarrage, mais un rappel
          // d'init() sur une base amputée d'une référence (restauration partielle, correction à la main) mettrait
          // sinon jusqu'à 96 fiches de référence en file d'envoi.
          installCapture(v2, { getUserId: () => 'u1', isActivitySynced: () => false });
          await v2.mutate({ deletes: { ingredients: ['ing_olive_oil'] }, origin: 'device' });
          await repoModule.init();
          uninstallCapture(v2);
          eq([!!(await v2.get('ingredients', 'ing_olive_oil')), (await v2.getAll('outbox')).length], [true, 0],
            'amorçage : la référence manquante est réécrite par une origine que la capture ignore');
        } finally {
          repoModule.bindDatabase(baseOrigine);
          if (v2.idb) { v2.idb.close(); v2.idb = null; }
        }
      }, V1_SEULEMENT, 1);
    } finally {
      if (ancienneCle === null) localStorage.removeItem('cuisineos.device');
      else localStorage.setItem('cuisineos.device', ancienneCle);
    }
  }
  // Test statique : aucune écriture directe hors repo.js, src/sync/ et backup.js (spec § 5.2)
  const swText = await (await fetch('../sw.js')).text();
  const shell = [...swText.matchAll(/'(\.\/src\/[^']+\.js)'/g)].map((m) => m[1]);
  const forbidden = new RegExp('\\bdb\\.(' + [...MUTATING_METHODS].join('|') + ')\\s*\\(');
  // Garde du garde (F2) : si SHELL devenait illisible (regex, renommage, sw.js servi depuis le cache), la boucle
  // ci-dessous ne parcourrait rien et les deux listes resteraient vides — vertes sans rien avoir vérifié.
  ok(shell.length > 30, 'SHELL lu : ' + shell.length + ' modules à relire avant de conclure');
  const offenders = [];
  const deviceKeyOffenders = []; // R20 : une seule identité d'appareil, et une seule migration qui nomme l'ancienne clé
  for (const file of shell) {
    const source = await (await fetch('../' + file.slice(2))).text();
    if (!/src\/model\/repo\.js$|src\/sync\/|src\/domain\/backup\.js$|src\/core\/db\.js$/.test(file) && forbidden.test(source)) offenders.push(file);
    if (!/src\/model\/repo\.js$/.test(file) && /cuisineos\.device/.test(source)) deviceKeyOffenders.push(file);
  }
  eq(offenders, [], 'aucune écriture IndexedDB directe hors des portes autorisées');
  eq(deviceKeyOffenders, [], 'ancienne clé d’appareil nommée seulement par la migration de repo.js');

  // --- Dépendance embarquée (spec § 6.1)
  ok(typeof globalThis.supabase?.createClient === 'function', 'supabase-js embarqué chargé par un script classique');
  ok(/^var supabase=/.test(await (await fetch('../src/vendor/supabase-2.117.3.umd.js')).text()), 'bundle IIFE autonome');

  // --- Connexion (spec § 4.1)
  // S1 : liste blanche d'hôtes. Une origine qui n'est pas nommée n'a AUCUNE configuration — elle ne retombe plus
  // sur « prod » par défaut. Sans cela, le jour où prod sera rempli, n'importe quelle origine servant ces fichiers
  // (un miroir, un sous-domaine oublié, un fichier recopié) créerait un client avec la clé du vrai projet.
  const { SUPABASE, currentConfig } = await import('../src/sync/config.js');
  ok('url' in SUPABASE.prod && 'anonKey' in SUPABASE.prod && 'hosts' in SUPABASE.prod
    && 'url' in SUPABASE.dev && 'anonKey' in SUPABASE.dev && 'hosts' in SUPABASE.dev, 'config : deux entrées publiques déclarées, avec leur liste d’hôtes');
  eq(SUPABASE.dev.hosts, ['localhost', '127.0.0.1'], 'config : seules les deux adresses locales sont en dev');
  eq(currentConfig('cuisine.exemple.test'), null, 'S1 : hôte inconnu → aucune configuration (plus de repli sur prod)');
  eq(currentConfig('localhost'), SUPABASE.dev.url && SUPABASE.dev.anonKey ? SUPABASE.dev : null, 'config : localhost → dev, null si vide');
  eq(currentConfig('LOCALHOST'), currentConfig('localhost'), 'S1 : la comparaison est faite en minuscules');
  eq(currentConfig(''), null, 'S1 : hôte vide → aucune configuration');
  {
    // Un hôte réellement listé en prod : posé le temps de l'assertion, l'entrée est remise ensuite telle quelle.
    const prodOrigine = { ...SUPABASE.prod, hosts: [...SUPABASE.prod.hosts] };
    try {
      Object.assign(SUPABASE.prod, { url: 'https://x.supabase.co', anonKey: 'k', hosts: ['cuisine.exemple.test'] });
      eq(currentConfig('cuisine.exemple.test'), SUPABASE.prod, 'S1 : un hôte listé en prod → l’entrée prod');
      eq(currentConfig('autre.exemple.test'), null, 'S1 : un hôte voisin, non listé → null');
      SUPABASE.prod.anonKey = '';
      eq(currentConfig('cuisine.exemple.test'), null, 'S1 : hôte listé mais entrée incomplète → null');
    } finally { Object.assign(SUPABASE.prod, prodOrigine); }
  }
  const { createAuth } = await import('../src/sync/auth.js');
  const fakeHistory = []; const fakeWin = { location: { origin: 'https://cuisine.exemple.test', pathname: '/', hash: '#/settings', search: '?code=abc&state=s', href: 'https://cuisine.exemple.test/?code=abc&state=s#/settings' }, history: { replaceState: (a, b, url) => fakeHistory.push(url) } };
  const calls = []; let changeCb = null;
  const factory = (url, key, options) => { calls.push({ url, key, options }); return { auth: {
    signInWithOAuth: async (o) => { calls.push({ signIn: o }); return { data: {}, error: null }; },
    signOut: async (o) => { calls.push({ signOut: o }); return { error: null }; },
    getSession: async () => ({ data: { session: { user: { id: 'uid-A', email: 'A@EXEMPLE.test' } } } }),
    onAuthStateChange: (cb) => { changeCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
  } }; };
  await withDatabase(async (db) => {
    const sans = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: undefined, win: fakeWin });
    eq([sans.available, sans.reason], [false, 'bibliotheque'], 'sans supabase-js : indisponible avec motif');
    eq([await sans.signIn(), await sans.signOut(), await sans.session(), typeof sans.onChange(() => {})], [null, null, null, 'function'], 'indisponible : les méthodes existent et ne lèvent pas');
    const sansConfig = createAuth({ db, config: null, factory, win: fakeWin });
    eq([sansConfig.available, sansConfig.reason, calls.length], [false, 'config', 0], 'config vide : indisponible, aucun client créé');
    const auth = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory, win: fakeWin });
    eq([auth.available, auth.reason, calls.length], [true, null, 1], 'client créé une seule fois');
    eq([calls[0].url, calls[0].key], ['https://x.supabase.co', 'k'], 'URL et clé publiques passées au client');
    eq(calls[0].options.auth, { flowType: 'pkce', persistSession: true, detectSessionInUrl: true }, 'options PKCE');
    await auth.signIn();
    eq(calls.at(-1).signIn.options.redirectTo, 'https://cuisine.exemple.test/', 'redirectTo sans fragment');
    eq(calls.at(-1).signIn.provider, 'google', 'fournisseur Google');
    eq(await auth.handleReturn(), { error: null, codeSansSession: false, present: true }, 'retour normal : aucun refus, session obtenue, retour reconnu');
    eq(fakeHistory.at(-1), '/#/settings', 'code retiré, fragment conservé');
    eq(auth.readError({ search: '?error=access_denied&error_description=x', hash: '' }), 'Cette adresse n’est pas autorisée.', 'refus : message fixe');
    eq(auth.readError({ search: '', hash: '#error=server_error&error_code=unexpected_failure' }), 'Cette adresse n’est pas autorisée.', 'refus dans le fragment');
    eq(auth.readError({ search: '', hash: '#/settings?error=x' }), 'Cette adresse n’est pas autorisée.', 'refus après le ? d’un fragment de route');
    eq([auth.readError({ search: '', hash: '' }), auth.readError({ search: '?code=abc&state=s', hash: '#/settings' })], [null, null], 'aucun refus : null');
    eq(await auth.guard('uid-A', 'a@exemple.test'), { ok: true }, 'premier compte : accepté et mémorisé');
    eq((await db.get('sync_state', 'user_id')).value, 'uid-A', 'user_id écrit');
    eq((await db.get('sync_state', 'user_email')).value, 'a@exemple.test', 'adresse gardée en base locale seulement');
    const other = await auth.guard('uid-B', 'b@exemple.test');
    eq(other.ok, false, 'autre compte : refusé');
    ok(/synchronisé avec/.test(other.message) && other.message.includes('a@exemple.test'), 'message nomme l’adresse connue');
    await auth.signOut();
    eq(calls.at(-1).signOut, { scope: 'local' }, 'déconnexion locale seulement');
    // Session, relais des changements, refus lu au retour et garde idempotente.
    eq(await auth.session(), { user: { id: 'uid-A', email: 'A@EXEMPLE.test' } }, 'session : identité lue chez le client');
    const { on } = await import('../src/core/bus.js');
    const vus = []; const offBus = on('sync', (p) => vus.push(p));
    const off = auth.onChange((state) => vus.push({ relais: state.user?.id || null }));
    changeCb('SIGNED_IN', { user: { id: 'uid-A', email: 'a@exemple.test' } });
    eq(vus, [{ relais: 'uid-A' }, { user: { id: 'uid-A', email: 'a@exemple.test' } }], 'onChange : relais à l’appelant puis événement sync');
    changeCb('SIGNED_OUT', null);
    eq(vus.at(-1), { user: null }, 'déconnexion relayée sans utilisateur');
    eq(typeof off, 'function', 'onChange rend la fonction de désabonnement');
    off(); offBus();
    fakeWin.location.search = '?error=access_denied&error_description=texte+brut';
    const retour = await auth.handleReturn();
    eq(retour, { error: 'Cette adresse n’est pas autorisée.', codeSansSession: false, present: true }, 'handleReturn : le refus lu est rendu, sans code à échanger');
    eq(fakeHistory.at(-1), '/#/settings', 'refus aussi retiré de l’historique');
    ok(!JSON.stringify(retour).includes('texte brut') && !JSON.stringify(retour).includes('access_denied'), 'le texte brut du refus n’est jamais rendu');
    eq(auth.readError({ search: '?error_description=texte+brut', hash: '' }), 'Cette adresse n’est pas autorisée.', 'error_description seul : refus reconnu');
    let ecritures = 0; const vraiMutate = db.mutate.bind(db);
    db.mutate = (arg) => { ecritures += 1; return vraiMutate(arg); };
    eq([await auth.guard('uid-A', 'a@exemple.test'), ecritures], [{ ok: true }, 0], 'même compte deux fois : accepté sans réécriture');
    eq([(await auth.guard('uid-B', 'b@exemple.test')).ok, ecritures], [false, 0], 'un refus n’écrit rien');
    eq([await auth.guard('uid-A', 'neuve@exemple.test'), ecritures], [{ ok: true }, 1], 'adresse réellement changée : rafraîchie une fois');
    eq((await db.get('sync_state', 'user_email')).value, 'neuve@exemple.test', 'adresse connue mise à jour');
    eq([await auth.guard('uid-A', ''), ecritures], [{ ok: true }, 1], 'adresse vide : l’adresse connue n’est jamais effacée');
    delete db.mutate;

    // Ronde 1 — I1 : l'échange du code est attendu AVANT le nettoyage de l'URL.
    let echange = false; const ordre = [];
    const lentWin = { location: { origin: 'https://c.test', pathname: '/', hash: '#/settings', search: '?code=abc&state=s' }, history: { replaceState: () => ordre.push(echange ? 'apres-echange' : 'avant-echange') } };
    const lentFactory = () => ({ auth: {
      getSession: () => new Promise((resolve) => setTimeout(() => { echange = true; resolve({ data: { session: { user: { id: 'uid-A', email: 'a@exemple.test' } } } }); }, 20)),
      signInWithOAuth: async () => ({ error: null }), signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } });
    const lent = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: lentFactory, win: lentWin });
    eq([await lent.handleReturn(), ordre], [{ error: null, codeSansSession: false, present: true }, ['apres-echange']], 'handleReturn attend l’échange avant de nettoyer l’URL');

    // I2 : un code revenu sans session est signalé à l'appelant et journalisé, et l'URL est nettoyée quand même.
    const muetWin = { location: { origin: 'https://c.test', pathname: '/', hash: '#/settings', search: '?code=abc' }, history: { replaceState: (a, b, url) => fakeHistory.push(url) } };
    const muetFactory = () => ({ auth: {
      getSession: async () => ({ data: { session: null } }),
      signInWithOAuth: async () => ({ error: null }), signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } });
    const muet = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: muetFactory, win: muetWin });
    const journal = []; let vraiLog = console.error; console.error = (...a) => journal.push(a);
    const retourMuet = await muet.handleReturn();
    console.error = vraiLog;
    eq(retourMuet, { error: null, codeSansSession: true, present: true }, 'code sans session : retour muet signalé');
    ok(JSON.stringify(journal).includes('auth.retour') && JSON.stringify(journal).includes('sans_session'), 'retour muet journalisé');
    eq(fakeHistory.at(-1), '/#/settings', 'et l’URL est nettoyée malgré l’échec');
    const sansWin = { location: { origin: 'https://c.test', pathname: '/mistu/', hash: '#/settings', search: '?code=abc' }, history: { replaceState: (a, b, url) => fakeHistory.push(url) } };
    const sansLib = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: undefined, win: sansWin });
    eq(await sansLib.handleReturn(), { error: null, codeSansSession: false, present: true }, 'sans client : rien n’a été tenté, donc aucun retour muet, mais le retour est reconnu');
    eq(fakeHistory.at(-1), '/mistu/#/settings', 'sans client : l’URL est nettoyée quand même');

    // Mineur (b) : un refus porté par le fragment en sort aussi.
    const fragWin = { location: { origin: 'https://c.test', pathname: '/', hash: '#/settings?error=access_denied', search: '' }, history: { replaceState: (a, b, url) => fakeHistory.push(url) } };
    const frag = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: muetFactory, win: fragWin });
    eq((await frag.handleReturn()).error, 'Cette adresse n’est pas autorisée.', 'refus dans le fragment : reconnu sans requête');
    eq(fakeHistory.at(-1), '/#/settings', 'refus retiré du fragment, route conservée');
    fragWin.location.hash = '#error=server_error&error_code=unexpected_failure';
    await frag.handleReturn();
    eq(fakeHistory.at(-1), '/', 'refus occupant tout le fragment : fragment vidé');

    // R23 : handleReturn dit s'il y a VRAIMENT eu un retour (un code ou un refus), pour que personne ne
    // confonde un chargement ordinaire avec le retour du fournisseur.
    const winPresence = (search, hash) => ({ location: { origin: 'https://c.test', pathname: '/', hash, search }, history: { replaceState: () => {} } });
    const presence = (search, hash) => createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: muetFactory, win: winPresence(search, hash) });
    // Le cas « un code » passe par la fabrique muette : son retour muet est journalisé, on retient la console.
    const journalPresence = []; vraiLog = console.error; console.error = (...a) => journalPresence.push(a);
    const presents = [
      (await presence('?code=abc&state=s', '#/settings').handleReturn()).present,
      (await presence('?error=access_denied', '#/settings').handleReturn()).present,
      (await presence('', '#/settings').handleReturn()).present,
    ];
    console.error = vraiLog;
    eq(presents, [true, true, false], 'présence : un code et un refus sont des retours, un chargement ordinaire non');

    // I3 : la garde échoue fermé quand la base ne répond pas.
    const dbCasse = { get: async () => { throw new Error('base indisponible'); }, mutate: async () => { throw new Error('jamais atteint'); } };
    const authCasse = createAuth({ db: dbCasse, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: muetFactory, win: fakeWin });
    const journalGarde = []; vraiLog = console.error; console.error = (...a) => journalGarde.push(a);
    const garde = await authCasse.guard('uid-A', 'a@exemple.test');
    console.error = vraiLog;
    eq(garde, { ok: false, message: 'Cet appareil ne peut pas vérifier le compte.' }, 'garde : échoue fermé, sans rejet');
    ok(JSON.stringify(journalGarde).includes('auth.garde') && !JSON.stringify(journalGarde).includes('base indisponible'), 'garde : journalisée par son code seul');

    // Mineurs (c) et (e) : erreur rendue sans lever, statut journalisé, session illisible → null.
    const fragileFactory = () => ({ auth: {
      signInWithOAuth: async () => ({ error: { message: 'x', status: 400, code: 'y' } }),
      signOut: async () => ({ error: null }),
      getSession: async () => { throw new Error('reseau coupe'); },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } });
    const fragile = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: fragileFactory, win: fakeWin });
    const journalFragile = []; vraiLog = console.error; console.error = (...a) => journalFragile.push(a);
    const essai = await fragile.signIn();
    const sessionKo = await fragile.session();
    console.error = vraiLog;
    eq([essai.error.status, essai.error.code, sessionKo], [400, 'y', null], 'erreur du client rendue sans lever ; session illisible → null');
    const texteJournal = JSON.stringify(journalFragile);
    ok(texteJournal.includes('auth.signIn') && texteJournal.includes('400') && texteJournal.includes('"reason":"y"'), 'journal : code, statut et motif');
    ok(!texteJournal.includes('reseau coupe') && !texteJournal.includes('"x"'), 'journal : jamais le texte de l’erreur');
  });

  // --- Réglages : section Synchronisation (spec § 4.2, L2)
  // Modèle pur : ce que la section dit et offre, sans DOM. Le rendu le consomme tel quel.
  const { syncSectionModel } = await import('../src/ui/settings.js');
  eq(syncSectionModel({ available: false, reason: 'config' }),
    { title: 'Synchronisation', lines: ['Synchronisation non configurée sur cette adresse.'], buttons: [] },
    'config absente : la section le dit et n’offre rien');
  eq(syncSectionModel({ available: false, reason: 'bibliotheque' }),
    { title: 'Synchronisation', lines: ['La bibliothèque de synchronisation n’a pas été chargée.'], buttons: [] },
    'bibliothèque non chargée : motif distinct');
  eq(syncSectionModel({ available: true }),
    { title: 'Synchronisation', lines: ['Tes données restent sur cet appareil.'], buttons: [{ action: 'signIn', label: 'Activer la synchronisation', tone: 'primary' }] },
    'disponible sans session : un seul libellé, Activer la synchronisation');
  eq(syncSectionModel({ available: true, user: { id: 'uid-A', email: 'a@exemple.test' }, guard: { ok: true }, pending: 3 }),
    { title: 'Synchronisation', lines: ['Connectée : a@exemple.test', 'À envoyer : 3'], buttons: [{ action: 'signOut', label: 'Se déconnecter', tone: '' }] },
    'session et garde ok : adresse, file d’envoi, déconnexion');
  // R22 : la garde refusée offre AUSSI la sortie douce — se déconnecter ne touche ni les données ni la file.
  eq(syncSectionModel({ available: true, guard: { ok: false, message: 'Cet appareil a été synchronisé avec a@exemple.test.' }, pending: 2 }),
    { title: 'Synchronisation', lines: ['Cet appareil a été synchronisé avec a@exemple.test.'], buttons: [{ action: 'signOut', label: 'Se déconnecter', tone: '' }, { action: 'changeAccount', label: 'Changer de compte sur cet appareil', tone: 'danger' }] },
    'garde refusée : la sortie douce avant le geste destructeur');
  eq(syncSectionModel({ available: true, retour: { error: null, codeSansSession: true } }).lines,
    ['Tes données restent sur cet appareil.', 'La connexion n’a pas abouti.'],
    'retour muet : la connexion n’a pas abouti, dit sans deviner pourquoi');
  eq(syncSectionModel({ available: true, retour: { error: 'Cette adresse n’est pas autorisée.', codeSansSession: false } }).lines,
    ['Tes données restent sur cet appareil.', 'Cette adresse n’est pas autorisée.'],
    'refus du fournisseur : la phrase fixe, jamais son texte brut');
  eq(syncSectionModel({ available: true, user: { id: 'uid-A', email: '' }, guard: { ok: true } }).lines,
    ['Connectée : ', 'À envoyer : 0'],
    'sans adresse connue : aucune valeur inventée, file à zéro');
  // R30 : tant que le démarrage borné (R28) n'a pas abouti, le compte n'est pas CONNU. « Tes données restent sur
  // cet appareil. » et « Activer la synchronisation » seraient un état sans événement réel (spec I5) : la section
  // dit ce qu'elle fait et n'offre rien, le temps que le résultat tardif arrive.
  eq(syncSectionModel({ available: true, enAttente: true, pending: 3 }),
    { title: 'Synchronisation', lines: ['Vérification du compte…'], buttons: [] },
    'R30 : démarrage encore en cours → une seule ligne, aucun bouton, aucun chiffre');
  eq(syncSectionModel({ available: true, enAttente: true, user: { id: 'uid-A', email: 'a@exemple.test' }, guard: { ok: true } }),
    { title: 'Synchronisation', lines: ['Vérification du compte…'], buttons: [] },
    'R30 : l’attente prime sur tout état partiel qui traînerait');

  // --- R21 : la route mémorisée avant signIn() est restaurée à TOUT retour du fournisseur
  // Décision pure, hors du démarrage : elle rend la route à appliquer, ou null, et n'écrit jamais rien.
  const { routeApresRetour } = await import('../src/ui/state.js');
  eq(routeApresRetour({ retour: { error: 'Cette adresse n’est pas autorisée.', codeSansSession: false, present: true }, memorisee: '#/settings', hashActuel: '' }),
    '#/settings', 'refus du fournisseur : la route est restaurée, là où le message s’affiche');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: true, present: true }, memorisee: '#/settings', hashActuel: '' }),
    '#/settings', 'retour muet : restaurée aussi');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false, present: true }, memorisee: '#/settings', hashActuel: '' }),
    '#/settings', 'session obtenue : restaurée');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false, present: true }, memorisee: '#/settings', hashActuel: '#/library' }),
    null, 'fragment déjà porteur d’une route : jamais écrasé');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false, present: true }, memorisee: '#/settings', hashActuel: '#' }),
    '#/settings', 'fragment vide « # » : la route mémorisée s’applique');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false, present: true }, memorisee: '', hashActuel: '' }),
    null, 'aucune route mémorisée : rien à restaurer');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false, present: false }, memorisee: '#/settings', hashActuel: '' }),
    null, 'aucun retour réel (chargement ordinaire) : rien à restaurer');

  // R23 : une route mémorisée ne survit pas à un signIn qui ne part pas — sinon elle détourne le prochain démarrage.
  const { demarrerConnexion, SYNC_ACTIONS } = await import('../src/ui/settings.js');
  const { SYNC_ROUTE_KEY: CLE_ROUTE } = await import('../src/ui/state.js');
  sessionStorage.removeItem(CLE_ROUTE);
  await demarrerConnexion({ signIn: async () => ({ error: null }) }, '#/settings');
  eq(sessionStorage.getItem(CLE_ROUTE), '#/settings', 'départ chez le fournisseur : la route est mémorisée');
  await demarrerConnexion({ signIn: async () => ({ error: { status: 400, code: 'x' } }) }, '#/settings');
  eq(sessionStorage.getItem(CLE_ROUTE), null, 'signIn en échec : aucune route fantôme ne survit');
  await demarrerConnexion({ signIn: async () => null }, '#/settings');
  eq(sessionStorage.getItem(CLE_ROUTE), null, 'sans client : rien de mémorisé non plus');
  sessionStorage.removeItem(CLE_ROUTE);

  // Chaque action du modèle doit avoir un geste câblé : la liste est la seule source, le rendu la filtre.
  eq([...SYNC_ACTIONS].sort(), ['changeAccount', 'signIn', 'signOut'], 'trois gestes nommés, pas un de plus');
  const actionsDuModele = new Set([
    ...syncSectionModel({ available: true }).buttons,
    ...syncSectionModel({ available: true, user: { id: 'u', email: 'a@exemple.test' }, guard: { ok: true } }).buttons,
    ...syncSectionModel({ available: true, guard: { ok: false, message: 'x' } }).buttons,
  ].map((b) => b.action));
  eq([...actionsDuModele].filter((a) => !SYNC_ACTIONS.includes(a)), [], 'aucune action du modèle sans geste câblé');

  // --- Les deux gestes les plus destructeurs (spec § 4.1, § 4.2) : I5b et I5c de la revue finale
  // Extraits de leurs gestionnaires DOM avec leurs dépendances injectées : aucune boîte de dialogue, aucune base,
  // aucun rechargement réel. Ce qui est éprouvé ici, c'est l'ORDRE des effets et chacun des refus — ce sont les
  // seuls gestes du lot qui détruisent des données, et ils n'étaient couverts par aucun test.
  const { changerDeCompte, effacerDonnees, reglerHistorique } = await import('../src/ui/settings.js');
  // Journal des effets : clearDevice note s'il a reçu de quoi se déconnecter, reload note seulement son passage.
  const journalGeste = () => {
    const vus = [];
    return { vus,
      toast: (m) => vus.push(['toast', m]),
      clearDevice: async (o) => { vus.push(['clearDevice', o?.signOut ? 'avec signOut' : 'sans signOut']); },
      reload: () => vus.push(['reload']) };
  };
  // Confirmations servies dans l'ordre : le test sait combien de fois on a demandé, et avec quelle phrase.
  const confirmations = (reponses) => {
    const file = [...reponses]; const demandes = [];
    return { demandes, confirm: async (message) => { demandes.push(message); return file.shift(); } };
  };

  {
    const g = journalGeste();
    await changerDeCompte({ confirm: async () => true, toast: g.toast, pending: async () => 0,
      archiveCreated: () => null, clearDevice: g.clearDevice, reload: g.reload });
    eq(g.vus, [['toast', 'Fais d’abord une archive sur cette page.']], 'changer de compte : sans archive, un toast et RIEN d’autre');
  }
  {
    const g = journalGeste();
    await changerDeCompte({ confirm: async () => true, toast: g.toast, pending: async () => 0,
      archiveCreated: () => { throw new Error('stockage indisponible'); }, clearDevice: g.clearDevice, reload: g.reload });
    eq(g.vus, [['toast', 'Le stockage de session est inaccessible : ce geste n’est pas possible ici.']],
      'changer de compte : stockage de session illisible → échec fermé, rien d’effacé');
  }
  {
    const g = journalGeste(); const c = confirmations([false]);
    await changerDeCompte({ confirm: c.confirm, toast: g.toast, pending: async () => 3,
      archiveCreated: () => '2026-10-13T00:00:00Z', clearDevice: g.clearDevice, reload: g.reload });
    eq([g.vus, c.demandes.length], [[], 1], 'changer de compte : première confirmation refusée → aucun effet, aucune seconde question');
  }
  {
    const g = journalGeste(); const c = confirmations([true, false]);
    await changerDeCompte({ confirm: c.confirm, toast: g.toast, pending: async () => 3,
      archiveCreated: () => '2026-10-13T00:00:00Z', clearDevice: g.clearDevice, reload: g.reload });
    eq([g.vus, c.demandes.length], [[], 2], 'changer de compte : seconde confirmation refusée → aucun effet');
    eq(c.demandes[1], '3 envois en attente seront perdus — ils sont dans l’archive.', 'la perte est chiffrée et nommée (pluriel)');
  }
  {
    const g = journalGeste(); const c = confirmations([true, true]);
    const signOut = async () => {};
    await changerDeCompte({ confirm: c.confirm, toast: g.toast, pending: async () => 1,
      archiveCreated: () => '2026-10-13T00:00:00Z', clearDevice: g.clearDevice, signOut, reload: g.reload });
    eq(g.vus, [['clearDevice', 'avec signOut'], ['reload']], 'changer de compte : les deux confirmations → effacement avec déconnexion, PUIS rechargement');
    eq(c.demandes[1], '1 envoi en attente sera perdu — il est dans l’archive.', 'un seul envoi : la phrase est au singulier');
  }
  {
    const g = journalGeste(); const c = confirmations([true, true]);
    await effacerDonnees({ user: { id: 'u' }, pending: async () => 2, confirm: c.confirm,
      demanderMot: async () => 'EFFACER', toast: g.toast, clearDevice: g.clearDevice, signOut: async () => {}, reload: g.reload });
    eq([g.vus, c.demandes.length], [[['toast', '2 éléments ne sont pas encore envoyés.']], 0],
      'effacer : connecté avec une file non vide → refusé, et aucune confirmation n’est même demandée');
  }
  {
    // R24 : sans compte, rien ne videra jamais la file (pas d'envoi en L2) — le refus rendrait le bouton mort.
    const g = journalGeste(); const c = confirmations([true]);
    await effacerDonnees({ user: null, pending: async () => 2, confirm: c.confirm,
      demanderMot: async () => 'EFFACER', toast: g.toast, clearDevice: g.clearDevice, reload: g.reload });
    eq([g.vus, c.demandes.length], [[['clearDevice', 'sans signOut'], ['toast', 'Données effacées'], ['reload']], 1],
      'R24 : sans compte, une file non vide ne bloque plus — le double contrôle s’applique et efface');
  }
  {
    const g = journalGeste(); const c = confirmations([false]);
    await effacerDonnees({ user: null, pending: async () => 0, confirm: c.confirm,
      demanderMot: async () => 'EFFACER', toast: g.toast, clearDevice: g.clearDevice, reload: g.reload });
    eq(g.vus, [], 'effacer : confirmation refusée → aucun effet');
  }
  {
    const g = journalGeste(); const c = confirmations([true]);
    await effacerDonnees({ user: null, pending: async () => 0, confirm: c.confirm,
      demanderMot: async () => 'effacer', toast: g.toast, clearDevice: g.clearDevice, reload: g.reload });
    eq(g.vus, [['toast', 'Annulé']], 'effacer : mot de confirmation faux → annulé, rien d’effacé');
  }
  {
    const g = journalGeste(); const c = confirmations([true]);
    const signOut = async () => {};
    await effacerDonnees({ user: { id: 'u' }, pending: async () => 0, confirm: c.confirm,
      demanderMot: async () => 'EFFACER', toast: g.toast, clearDevice: g.clearDevice, signOut, reload: g.reload });
    eq(g.vus, [['clearDevice', 'avec signOut'], ['toast', 'Données effacées'], ['reload']],
      'effacer : avec un compte, l’effacement emporte la déconnexion, PUIS le rechargement');
  }

  // --- R31 : le remplacement d'une archive est refusé dès qu'une entrée attend d'être envoyée (spec § 5.2)
  // Le refus vaut CONNECTÉ OU NON : le remplacement vide la bibliothèque, et ce qui attendait de partir ne serait
  // plus là pour être renvoyé. La fusion reste permise. La file est relue AU MOMENT du geste, pas au rendu.
  const { restaurerArchive } = await import('../src/ui/settings.js');
  const journalRestauration = () => {
    const vus = [];
    return { vus, toast: (m) => vus.push(['toast', m]), appliquer: async () => { vus.push(['appliquer']); } };
  };
  {
    const r = journalRestauration(); let lectures = 0;
    const applique = await restaurerArchive({ mode: 'replace', pending: async () => { lectures += 1; return 2; }, toast: r.toast, appliquer: r.appliquer });
    eq([applique, r.vus, lectures],
      [false, [['toast', '2 éléments sont en attente d’envoi. Restaure en fusion, ou efface d’abord les données de cet appareil.']], 1],
      'R31 : remplacement refusé avec deux entrées en file, rien n’est appliqué, et la file est relue au geste');
  }
  {
    const r = journalRestauration();
    await restaurerArchive({ mode: 'replace', pending: async () => 1, toast: r.toast, appliquer: r.appliquer });
    eq(r.vus, [['toast', '1 élément est en attente d’envoi. Restaure en fusion, ou efface d’abord les données de cet appareil.']],
      'R31 : une seule entrée en file → la phrase est au singulier');
  }
  {
    const r = journalRestauration();
    eq([await restaurerArchive({ mode: 'replace', pending: async () => 0, toast: r.toast, appliquer: r.appliquer }), r.vus],
      [true, [['appliquer']]], 'R31 : file vide → le remplacement est appliqué');
  }
  {
    const r = journalRestauration();
    eq([await restaurerArchive({ mode: 'merge', pending: async () => 5, toast: r.toast, appliquer: r.appliquer }), r.vus],
      [true, [['appliquer']]], 'R31 : la fusion reste permise, même avec une file non vide');
  }

  // R27 : retirer le consentement à l'historique retire AUSSI ce qui attendait de partir (spec § 4.2, D6).
  // Un retrait de consentement qui laisse partir la file n'est pas un retrait.
  await withRepo(async (repoTemp, db) => {
    const ligne = (store, id) => ({ user_id: 'u1', store, id, op: 'put', updated_at: '2026-10-12T10:00:00Z', tries: 0 });
    await db.mutate({ puts: { outbox: [ligne('library_activity', 'a1'), ligne('library_activity', 'a2'), ligne('recipes', 'r1')] }, origin: 'device' });
    const retires = await reglerHistorique(false);
    eq([retires, (await db.getAll('outbox')).map((o) => [o.store, o.id])], [2, [['recipes', 'r1']]],
      'R27 : décocher retire les deux entrées library_activity de la file, et seulement elles');
    eq((await repoTemp.getSettings()).sync_activity, false, 'R27 : le réglage est écrit (la capture se referme) avant la purge');
    eq(await reglerHistorique(true), 0, 'R27 : cocher n’enlève rien de la file');
    eq((await repoTemp.getSettings()).sync_activity, true, 'R27 : et le consentement est bien réécrit');
  });

  // I2 : les réglages lus par la capture suivent la base, même réécrite sans passer par setSetting
  // (restauration d'archive, écriture directe) — c'est une porte de confidentialité, pas un confort.
  const { relireReglages, isActivitySynced } = await import('../src/ui/state.js');
  const { emit } = await import('../src/core/bus.js');
  const attendre = async (predicat) => { for (let i = 0; i < 60 && !predicat(); i += 1) await new Promise((r) => setTimeout(r, 10)); return predicat(); };
  await withRepo(async (repo, db) => {
    await relireReglages();
    eq(isActivitySynced(), false, 'réglage absent : la capture n’envoie pas l’historique');
    await db.mutate({ puts: { settings: [{ key: 'sync_activity', value: true }] }, origin: 'device' });
    eq(isActivitySynced(), false, 'une écriture seule ne change rien tant que rien ne l’annonce');
    emit('change', { store: 'settings' });
    ok(await attendre(() => isActivitySynced() === true), 'magasin settings réécrit puis annoncé : la capture suit la base');
    await db.mutate({ puts: { settings: [{ key: 'sync_activity', value: false }] }, origin: 'device' });
    emit('change', { store: '*' });
    ok(await attendre(() => isActivitySynced() === false), 'réglage retiré par une restauration : la capture se referme');
  });
  await relireReglages(); // la base de l'app reprend la main après la base jetable

  // --- R28 : le démarrage de la connexion est borné dans le temps (spec § 4.1, invariant I4)
  // `getSession()` rafraîchit le jeton par le réseau quand il est périmé : hors ligne, il ne rend rien avant le
  // délai propre du navigateur, et pendant ce temps `#app` ne contient que le `<noscript>` — écran blanc. Un bloc
  // qui PEND n'est pas un bloc qui CASSE, et seul le second est couvert par un try/catch : il faut une borne.
  const { demarrerSync, getSyncState, setSyncState } = await import('../src/ui/state.js');
  {
    let resoudreRetour = null;
    const retourQuiNeVientPas = new Promise((r) => { resoudreRetour = r; });
    const authLent = {
      available: true,
      handleReturn: () => retourQuiNeVientPas,
      session: async () => ({ user: { id: 'uid-tardif', email: 'tardif@exemple.test' } }),
      guard: async () => ({ ok: true }),
      onChange: () => () => {},
    };
    const patienter = async (predicat) => { for (let i = 0; i < 100 && !predicat(); i += 1) await new Promise((r) => setTimeout(r, 10)); return predicat(); };
    // Le stub de console.error est posé en try/finally : un échec en cours de bloc ne doit pas laisser la console
    // détournée pour tout le reste de la suite (dette nommée dans CLAUDE.md, levée ici).
    const journalBorne = []; const vraiLogBorne = console.error;
    let etatBorne = null; let duree = 0;
    try {
      console.error = (...a) => journalBorne.push(a);
      const debut = Date.now();
      etatBorne = await demarrerSync({ auth: authLent, delaiMs: 50 });
      duree = Date.now() - debut;
    } finally { console.error = vraiLogBorne; }
    ok(duree < 1000, 'R28 : demarrerSync rend la main en moins d’une seconde quand le fournisseur ne répond pas (' + duree + ' ms)');
    eq([etatBorne.enAttente, etatBorne.user, etatBorne.guard, etatBorne.retour], [true, null, null, null],
      'R28 : au dépassement, l’app démarre sans compte et le dit « en attente »');
    ok(JSON.stringify(journalBorne).includes('sync_boot_timeout'), 'R28 : le dépassement est journalisé par son code seul');
    resoudreRetour({ error: null, codeSansSession: false, present: true });
    ok(await patienter(() => getSyncState().user?.id === 'uid-tardif'), 'R28 : la promesse tardive est appliquée quand elle aboutit enfin');
    eq([getSyncState().enAttente, getSyncState().guard], [false, { ok: true }], 'R28 : et l’état ne dit plus « en attente »');
    // Sans dépassement, rien ne change : l'ordre handleReturn → session → guard est le même, et l'état est complet.
    const ordre = [];
    const authRapide = {
      available: true,
      handleReturn: async () => { ordre.push('handleReturn'); return { error: null, codeSansSession: false, present: true }; },
      session: async () => { ordre.push('session'); return { user: { id: 'uid-A', email: 'a@exemple.test' } }; },
      guard: async () => { ordre.push('guard'); return { ok: true }; },
      onChange: () => () => {},
    };
    const vus = [];
    const etatRapide = await demarrerSync({ auth: authRapide, delaiMs: 5000, surEtat: (e) => vus.push(e.retour?.present) });
    eq([ordre, etatRapide.enAttente, etatRapide.user.id, vus], [['handleReturn', 'session', 'guard'], false, 'uid-A', [true]],
      'R28 : dans les temps, l’ordre est inchangé et le retour est transmis à l’appelant');
    setSyncState({ auth: null, user: null, guard: null, retour: null, enAttente: false }); // ne rien laisser derrière
  }

  // --- R32 : un résultat tardif n'écrase jamais un état plus récent (spec § 4.1 ; amende R28)
  // Le travail borné continue en arrière-plan. S'il aboutit APRÈS qu'un `auth.onChange` a posé un état (jeton
  // rafraîchi, déconnexion, connexion depuis un autre onglet), son résultat est périmé : l'appliquer ferait
  // réapparaître un compte parti, ou effacerait un compte arrivé. Un compteur de générations tranche.
  const patienterEtat = async (predicat) => { for (let i = 0; i < 100 && !predicat(); i += 1) await new Promise((r) => setTimeout(r, 10)); return predicat(); };
  {
    let resoudreTardif = null;
    const authTardif = {
      available: true,
      handleReturn: () => new Promise((r) => { resoudreTardif = r; }),
      session: async () => null, // le travail tardif conclura « aucun compte »
      guard: async () => ({ ok: true }),
      onChange: () => () => {},
    };
    const journalTardif = []; const vraiLogTardif = console.error;
    try {
      console.error = (...a) => journalTardif.push(a);
      const borne = await demarrerSync({ auth: authTardif, delaiMs: 20 });
      eq(borne.enAttente, true, 'R32 : la borne est dépassée, l’app s’ouvre en attente');
      // Un changement de session arrive AVANT que le travail tardif n'aboutisse : il est plus récent.
      setSyncState({ user: { id: 'uid-onChange', email: 'c@exemple.test' }, guard: { ok: true }, retour: null, enAttente: false });
      resoudreTardif({ error: null, codeSansSession: false, present: true });
      await new Promise((r) => setTimeout(r, 60)); // le temps que la promesse tardive aboutisse et soit écartée
      eq([getSyncState().user?.id, getSyncState().enAttente], ['uid-onChange', false],
        'R32 : le résultat tardif (aucun compte) est ignoré — l’état posé par onChange reste');
    } finally { console.error = vraiLogTardif; }
  }
  // Et si le travail tardif ÉCHOUE, l'attente est levée : sinon « Vérification du compte… » reste à l'écran sans
  // aucun bouton, pour toujours (R30 n'offre rien tant que enAttente vaut vrai).
  {
    let rejeterTardif = null;
    const authCasse = {
      available: true,
      handleReturn: () => new Promise((_, rejeter) => { rejeterTardif = rejeter; }),
      session: async () => null, guard: async () => ({ ok: true }), onChange: () => () => {},
    };
    const journalCasse = []; const vraiLogCasse = console.error;
    try {
      console.error = (...a) => journalCasse.push(a);
      const borne = await demarrerSync({ auth: authCasse, delaiMs: 20 });
      eq(borne.enAttente, true, 'R32 : borne dépassée, travail tardif qui va échouer');
      rejeterTardif(new Error('reseau coupe'));
      ok(await patienterEtat(() => getSyncState().enAttente === false),
        'R32 : un travail tardif qui échoue lève l’attente au lieu de la figer');
      const texteCasse = JSON.stringify(journalCasse);
      ok(texteCasse.includes('sync_boot_failed') && !texteCasse.includes('reseau coupe'),
        'R32 : l’échec tardif est journalisé par son code seul');
    } finally {
      console.error = vraiLogCasse;
      setSyncState({ auth: null, user: null, guard: null, retour: null, enAttente: false });
    }
  }

  // --- Clôture : SHELL complet (tâche 14)
  // Ce test LIT du source (sw.js et les modules) : c'est voulu ici, et seulement ici. Il ne vérifie pas un
  // comportement mais la COHÉRENCE D'UNE LISTE — le SHELL du service worker contre le graphe d'imports réel.
  // Un module atteignable depuis app.js et absent de SHELL fait répondre 404 à cache.addAll : l'installation du
  // service worker échoue en entier et il n'y a plus aucune consultation hors connexion. Rien de ce comportement
  // n'est observable depuis la page de tests ; la liste, elle, se compare.
  const sourceSw = await (await fetch('../sw.js', { cache: 'no-store' })).text();
  const blocShell = sourceSw.match(/const SHELL = \[([\s\S]*?)\];/);
  ok(!!blocShell, 'sw.js : le tableau SHELL est lisible');
  const listeShell = [...(blocShell?.[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  // Résolution relative à la main : aucun bundler ici, les chemins du SHELL sont ceux que le réseau sert.
  const resoudre = (depuis, specifier) => {
    const parts = depuis.split('/').slice(0, -1);
    for (const seg of specifier.split('/')) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts.join('/');
  };
  const atteints = new Set();
  const aVisiter = ['src/app.js'];
  while (aVisiter.length) {
    const chemin = aVisiter.pop();
    if (atteints.has(chemin)) continue;
    atteints.add(chemin);
    const source = await (await fetch('../' + chemin, { cache: 'no-store' })).text();
    for (const m of source.matchAll(/(?:from\s+'([^']+)'|import\s+'([^']+)')/g)) {
      const specifier = m[1] || m[2];
      if (!specifier.startsWith('.')) continue; // aucune dépendance npm à l'exécution : rien d'autre à suivre
      aVisiter.push(resoudre(chemin, specifier));
    }
  }
  // Le parcours lui-même doit avoir trouvé quelque chose : si une regex d'import cessait de reconnaître sa forme,
  // `atteints` se réduirait à `src/app.js` et la comparaison resterait verte sans rien prouver (mineur, tâche 14).
  ok(atteints.size >= 40, 'le graphe d’imports a bien été parcouru (' + atteints.size + ' modules atteints)');
  const absentsDuShell = [...atteints].map((c) => './' + c).filter((c) => !listeShell.includes(c)).sort();
  eq(absentsDuShell, [], 'tout module atteignable depuis app.js est dans SHELL');
  // Chargés hors du graphe d'imports : le bundle UMD par un <script> classique (index.html et tests/index.html),
  // sw-rules.js par importScripts du service worker et par tests/index.html.
  eq(['./src/vendor/supabase-2.117.3.umd.js', './sw-rules.js'].filter((c) => !listeShell.includes(c)), [],
    'dépendance embarquée et règles du service worker dans SHELL');
}
