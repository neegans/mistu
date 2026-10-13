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

  // --- Horloge corrigée (spec § 5.3) : monotone, strictement croissante, décalage mémorisé
  const { syncNow, setClockOffset, getClockOffset } = await import('../src/sync/clock.js');
  const t0 = syncNow();
  setClockOffset(-7200000); // horloge locale qui recule de 2 h
  const t1 = syncNow(); const t2 = syncNow();
  ok(t1 > t0 && t2 > t1, 'syncNow : jamais en arrière, jamais deux fois la même valeur sous une horloge reculée');
  eq(getClockOffset(), -7200000, 'décalage mémorisé');
  setClockOffset(undefined);
  eq(getClockOffset(), 0, 'décalage non finie : ramené à 0');

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
  // Test statique : aucune écriture directe hors repo.js, src/sync/ et backup.js (spec § 5.2)
  const swText = await (await fetch('../sw.js')).text();
  const shell = [...swText.matchAll(/'(\.\/src\/[^']+\.js)'/g)].map((m) => m[1]);
  const forbidden = new RegExp('\\bdb\\.(' + [...MUTATING_METHODS].join('|') + ')\\s*\\(');
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
  const { SUPABASE, currentConfig } = await import('../src/sync/config.js');
  ok('url' in SUPABASE.prod && 'anonKey' in SUPABASE.prod && 'url' in SUPABASE.dev && 'anonKey' in SUPABASE.dev, 'config : deux entrées publiques déclarées');
  eq(currentConfig('cuisine.exemple.test'), SUPABASE.prod.url && SUPABASE.prod.anonKey ? SUPABASE.prod : null, 'config : origine publique → prod, null si vide');
  eq(currentConfig('localhost'), SUPABASE.dev.url && SUPABASE.dev.anonKey ? SUPABASE.dev : null, 'config : localhost → dev, null si vide');
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
    eq(await auth.handleReturn(), { error: null, codeSansSession: false }, 'retour normal : aucun refus, session obtenue');
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
    eq(retour, { error: 'Cette adresse n’est pas autorisée.', codeSansSession: false }, 'handleReturn : le refus lu est rendu, sans code à échanger');
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
    eq([await lent.handleReturn(), ordre], [{ error: null, codeSansSession: false }, ['apres-echange']], 'handleReturn attend l’échange avant de nettoyer l’URL');

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
    eq(retourMuet, { error: null, codeSansSession: true }, 'code sans session : retour muet signalé');
    ok(JSON.stringify(journal).includes('auth.retour') && JSON.stringify(journal).includes('sans_session'), 'retour muet journalisé');
    eq(fakeHistory.at(-1), '/#/settings', 'et l’URL est nettoyée malgré l’échec');
    const sansWin = { location: { origin: 'https://c.test', pathname: '/mistu/', hash: '#/settings', search: '?code=abc' }, history: { replaceState: (a, b, url) => fakeHistory.push(url) } };
    const sansLib = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: undefined, win: sansWin });
    eq(await sansLib.handleReturn(), { error: null, codeSansSession: false }, 'sans client : rien n’a été tenté, donc aucun retour muet');
    eq(fakeHistory.at(-1), '/mistu/#/settings', 'sans client : l’URL est nettoyée quand même');

    // Mineur (b) : un refus porté par le fragment en sort aussi.
    const fragWin = { location: { origin: 'https://c.test', pathname: '/', hash: '#/settings?error=access_denied', search: '' }, history: { replaceState: (a, b, url) => fakeHistory.push(url) } };
    const frag = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: muetFactory, win: fragWin });
    eq((await frag.handleReturn()).error, 'Cette adresse n’est pas autorisée.', 'refus dans le fragment : reconnu sans requête');
    eq(fakeHistory.at(-1), '/#/settings', 'refus retiré du fragment, route conservée');
    fragWin.location.hash = '#error=server_error&error_code=unexpected_failure';
    await frag.handleReturn();
    eq(fakeHistory.at(-1), '/', 'refus occupant tout le fragment : fragment vidé');

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
  eq(syncSectionModel({ available: true, guard: { ok: false, message: 'Cet appareil a été synchronisé avec a@exemple.test.' }, pending: 2 }),
    { title: 'Synchronisation', lines: ['Cet appareil a été synchronisé avec a@exemple.test.'], buttons: [{ action: 'changeAccount', label: 'Changer de compte sur cet appareil', tone: 'danger' }] },
    'garde refusée : son message et le geste exécutable');
  eq(syncSectionModel({ available: true, retour: { error: null, codeSansSession: true } }).lines,
    ['Tes données restent sur cet appareil.', 'La connexion n’a pas abouti.'],
    'retour muet : la connexion n’a pas abouti, dit sans deviner pourquoi');
  eq(syncSectionModel({ available: true, retour: { error: 'Cette adresse n’est pas autorisée.', codeSansSession: false } }).lines,
    ['Tes données restent sur cet appareil.', 'Cette adresse n’est pas autorisée.'],
    'refus du fournisseur : la phrase fixe, jamais son texte brut');
  eq(syncSectionModel({ available: true, user: { id: 'uid-A', email: '' }, guard: { ok: true } }).lines,
    ['Connectée : ', 'À envoyer : 0'],
    'sans adresse connue : aucune valeur inventée, file à zéro');

  // --- R21 : la route mémorisée avant signIn() est restaurée à TOUT retour du fournisseur
  // Décision pure, hors du démarrage : elle rend la route à appliquer, ou null, et n'écrit jamais rien.
  const { routeApresRetour } = await import('../src/ui/state.js');
  eq(routeApresRetour({ retour: { error: 'Cette adresse n’est pas autorisée.', codeSansSession: false }, memorisee: '#/settings', hashActuel: '' }),
    '#/settings', 'refus du fournisseur : la route est restaurée, là où le message s’affiche');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: true }, memorisee: '#/settings', hashActuel: '' }),
    '#/settings', 'retour muet : restaurée aussi');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false }, memorisee: '#/settings', hashActuel: '' }),
    '#/settings', 'session obtenue : restaurée');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false }, memorisee: '#/settings', hashActuel: '#/library' }),
    null, 'fragment déjà porteur d’une route : jamais écrasé');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false }, memorisee: '#/settings', hashActuel: '#' }),
    '#/settings', 'fragment vide « # » : la route mémorisée s’applique');
  eq(routeApresRetour({ retour: { error: null, codeSansSession: false }, memorisee: '', hashActuel: '' }),
    null, 'aucune route mémorisée : rien à restaurer');
  eq(routeApresRetour({ retour: null, memorisee: '#/settings', hashActuel: '' }),
    null, 'aucun retour traité : rien à restaurer');
}
