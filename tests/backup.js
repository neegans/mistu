// Régressions sauvegarde/restauration, à exécuter dans le navigateur.
// Chaque scénario IndexedDB utilise un nom unique cuisine-os-backup-test-*.
// Aucun import de repo.js, aucun accès à la base de l'utilisateur, aucun appel réseau.
import { Database } from '../src/core/db.js';
import { STORES, DB_VERSION, ARCHIVE_FORMAT, ARCHIVE_FORMAT_VERSION, SECRET_SETTING_KEYS } from '../src/model/schema.js';
import { createArchive, inspectArchive, applyArchive, verifyRestored } from '../src/domain/backup.js';
import { createZip, readZip, textOf } from '../src/core/zip.js';
import { sha256Hex } from '../src/core/hash.js';

const STORE_NAMES = Object.keys(STORES);
const SECRET = 'cle-secrete-fictive-test-a-exclure';
const enc = new TextEncoder();

// `version` sert au seul test de montée 1 → 2 (tests/sync.js) : partout ailleurs la base jetable naît directement
// à DB_VERSION. Une base ouverte en v1 puis rouverte en v2 est le seul moyen d'exercer le vrai onupgradeneeded.
export async function withDatabase(test, stores = STORES, version = DB_VERSION) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const name = `cuisine-os-backup-test-${suffix}`;
  const db = new Database(name, version, stores);
  try {
    await db.open();
    return await test(db);
  } finally {
    if (db.idb) { db.idb.close(); db.idb = null; }
    await supprimerBase(name);
  }
}

// Borne d'attente du nettoyage. Généreuse : une connexion gênante se ferme en quelques millisecondes dès qu'elle
// reçoit `versionchange` ; dix secondes ne se dépassent que si quelque chose garde VRAIMENT la base ouverte.
const DELAI_NETTOYAGE_MS = 10000;

// R-L3-17 : `onblocked` d'un `deleteDatabase` est INFORMATIF, jamais terminal — la requête reste en attente et
// aboutit dès que la dernière connexion gênante se ferme (ce même `deleteDatabase` leur envoie `versionchange`, et
// `src/core/db.js` referme la sienne sur cet événement). Le traiter comme un échec faisait échouer la suite au
// hasard, toujours loin de son vrai coupable : une lecture flottante (un `relireReglages()` lancé par le bus, par
// exemple) rouvre la base dès que `idb` est nul, et la connexion qu'elle crée bloque le nettoyage le temps de sa
// transaction. On attend donc `onsuccess`, et on ne rejette qu'au dépassement de la borne — le signal reste, nommé,
// et il dit cette fois qu'une connexion ne s'est jamais fermée.
export function supprimerBase(name, delaiMs = DELAI_NETTOYAGE_MS) {
  return new Promise((resolve, reject) => {
    let bloque = false;
    const request = indexedDB.deleteDatabase(name);
    const minuterie = setTimeout(() => {
      reject(new Error(`Nettoyage de la base temporaire ${bloque ? 'bloqué' : 'sans réponse'} après ${delaiMs} ms : ${name}`));
    }, delaiMs);
    request.onsuccess = () => { clearTimeout(minuterie); resolve(); };
    request.onerror = () => { clearTimeout(minuterie); reject(request.error || new Error(`Nettoyage de la base temporaire refusé : ${name}`)); };
    request.onblocked = () => { bloque = true; }; // informatif : une connexion est encore ouverte, elle va se fermer
  });
}

// Chaque fiche d'un magasin synchronisé porte un `updated_at`, comme toute fiche réellement écrite par
// repo.save() : sans lui, la restauration lui en poserait un (complétude R-L3-10) et les comparaisons strictes
// ci-dessous opposeraient une fiche horodatée à une fiche qui ne l'était pas. Les réglages n'en portent pas :
// « settings » n'est pas un magasin synchronisé.
const DATE_FIXTURE = '2026-09-01T00:00:00.000Z';

async function fixture() {
  const data = Object.fromEntries(STORE_NAMES.map((name) => [name, []]));
  const bytes = new Uint8Array([0, 255, 1, 128, 13, 10, 42, 0]);
  const text = enc.encode('Page originale : crème, café et œufs.\n');
  for (const [value, mime] of [[bytes, 'application/octet-stream'], [text, 'text/plain']]) {
    data.files.push({ sha256: await sha256Hex(value), mime, size: value.length, blob: new Blob([value], { type: mime }), updated_at: DATE_FIXTURE });
  }
  data.books = [{ id: 'b_test', title: 'Cuisine été — original', author: 'Auteur test', updated_at: DATE_FIXTURE }];
  data.unit_definitions = [{ id: 'g', dimension: 'mass', factor: 1, updated_at: DATE_FIXTURE }];
  data.unit_conventions = [{ id: 'uc_test', revision: 1, values: { cup_ml: 250 }, updated_at: DATE_FIXTURE }];
  data.ingredients = [{ id: 'ing_test', labels: { fr: { label: 'carotte', aliases: [] }, en: { label: 'carrot', aliases: [] } }, contains: null, updated_at: DATE_FIXTURE }];
  data.book_editions = [{ id: 'ed_test', book_id: 'b_test', language: 'fr', unit_convention_id: 'uc_test', updated_at: DATE_FIXTURE }];
  data.scan_sessions = [{ id: 'ss_test', edition_id: 'ed_test', status: 'done', page_ids: ['pg_test'], document_ids: ['doc_test', 'doc_text'], recipe_ids: ['rc_test'], updated_at: DATE_FIXTURE }];
  data.source_documents = data.files.map((f, i) => ({
    id: i ? 'doc_text' : 'doc_test', edition_id: 'ed_test', scan_session_id: 'ss_test',
    source_type: 'photo', sha256: f.sha256, blob_path: `files/${f.sha256}`, size: f.size, mime: f.mime, updated_at: DATE_FIXTURE,
  }));
  data.source_pages = [{ id: 'pg_test', document_id: 'doc_test', edition_id: 'ed_test', sha256: data.files[0].sha256, printed_page: 12, position: 1, updated_at: DATE_FIXTURE }];
  data.recipes = [{
    id: 'rc_test', edition_id: 'ed_test', original_title: 'Carottes', availability: 'available',
    current_version_id: 'rv_test', source_page_ids: ['pg_test'], ingredient_ids: ['ing_test'], updated_at: DATE_FIXTURE,
  }];
  data.recipe_versions = [{
    id: 'rv_test', recipe_id: 'rc_test', parent_version_id: null, kind: 'extraction', servings: 2,
    ingredients: [{ id: 'ri_test', ingredient_id: 'ing_test', unit_id: 'g', source_text: '125 g de carottes', quantity: { value: 125, raw: '125' } }],
    steps: [{ id: 'st_test', position: 1, text: 'Couper les carottes.' }],
    provenance: { source_page_ids: ['pg_test'], source_document_id: 'doc_test', edition_id: 'ed_test', generated_by: 'manual' },
    updated_at: DATE_FIXTURE,
  }];
  data.rediscovery_prefs = [{ edition_id: 'ed_test', hidden: false, updated_at: DATE_FIXTURE }];
  data.settings = [{ key: 'ui_locale', value: 'fr' }, { key: 'llm', value: { api_key: SECRET, provider: 'none' } }];
  return data;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

async function snapshotValue(db) {
  const snapshot = await db.getSnapshot();
  const out = {};
  for (const name of STORE_NAMES) {
    const rows = [];
    for (const row of snapshot[name]) {
      rows.push(name === 'files' ? { ...row, blob: [...new Uint8Array(await row.blob.arrayBuffer())] } : row);
    }
    const keyPath = STORES[name].keyPath;
    out[name] = rows.sort((a, b) => String(a[keyPath]).localeCompare(String(b[keyPath])));
  }
  return canonical(out);
}

async function prepared(db) {
  const data = await fixture();
  await db.putBatch(data);
  const archive = await createArchive(db, { deviceName: 'Appareil de test' });
  const inspection = await inspectArchive(await archive.blob.arrayBuffer());
  if (!inspection.ok) throw new Error(`La fixture valide est refusée : ${inspection.errors.join(' · ')}`);
  return { data, archive, inspection };
}

// Recalcule CRC et SHA des JSON modifiés : les cas de validation ci-dessous
// isolent les clés, décomptes et relations plutôt qu'une simple corruption ZIP.
async function rewriteArchive(blob, edit) {
  const entries = new Map([...readZip(await blob.arrayBuffer())].map(([path, entry]) => [path, entry.data]));
  const manifest = JSON.parse(textOf({ data: entries.get('manifest.json') }));
  const rewriteRows = async (store, change) => {
    const df = manifest.data_files.find((item) => item.store === store);
    const rows = JSON.parse(textOf({ data: entries.get(df.path) }));
    change(rows);
    const bytes = enc.encode(JSON.stringify(rows));
    entries.set(df.path, bytes);
    df.sha256 = await sha256Hex(bytes);
    df.count = rows.length;
    manifest.counts[store] = rows.length;
  };
  await edit({ manifest, entries, rewriteRows });
  entries.set('manifest.json', enc.encode(JSON.stringify(manifest)));
  return createZip([...entries].map(([path, data]) => ({ path, data }))).buffer;
}

export async function runBackupTests({ eq, ok }) {
  const run = async (name, test) => {
    try { await test(); }
    catch (error) { ok(false, `Sauvegarde — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };

  await run('aller-retour en base vide', () => withDatabase(async (source) => {
    const { data, inspection } = await prepared(source);
    await withDatabase(async (target) => {
      ok(await target.isEmpty(), 'Restauration : destination temporaire réellement vide');
      await applyArchive(target, inspection, { mode: 'replace' });
      const check = await verifyRestored(target, inspection, { mode: 'replace' });
      eq(check.diffs, [], 'Restauration : zéro écart après le véritable aller-retour IndexedDB');
      ok(check.ok, 'Restauration : vérification complète réussie');
      const actual = await target.getSnapshot();
      eq(Object.keys(actual).sort(), STORE_NAMES.slice().sort(), 'Instantané : tous les magasins présents');
      for (const [store, expected] of Object.entries(inspection.payload.stores)) {
        eq(canonical(actual[store]), canonical(expected), `Restauration : contenu JSON identique dans ${store}`);
      }
      for (const file of data.files) {
        const restored = await target.get('files', file.sha256);
        eq([...new Uint8Array(await restored.blob.arrayBuffer())], [...new Uint8Array(await file.blob.arrayBuffer())], 'Restauration : octets originaux identiques');
        eq(await sha256Hex(restored.blob), file.sha256, 'Restauration : empreinte du Blob relu identique');
      }
      eq((await target.get('recipes', 'rc_test')).source_page_ids, ['pg_test'], 'Restauration : relation vers la page originale conservée');
    });
  }));

  await run('secrets exclus', () => withDatabase(async (db) => {
    const { archive, inspection } = await prepared(db);
    eq(inspection.payload.stores.settings, [{ key: 'ui_locale', value: 'fr' }], 'Sauvegarde : seuls les réglages non secrets sont exportés');
    ok(!inspection.payload.stores.settings.some((row) => SECRET_SETTING_KEYS.includes(row.key)), 'Sauvegarde : aucune clé de réglage secrète');
    ok(!new TextDecoder().decode(await archive.blob.arrayBuffer()).includes(SECRET), 'Sauvegarde : valeur secrète absente des octets ZIP');
    eq((await db.get('settings', 'llm')).value.api_key, SECRET, 'Sauvegarde : le réglage secret local reste intact');
  }));

  await run('double import', () => withDatabase(async (source) => {
    const { inspection } = await prepared(source);
    await withDatabase(async (target) => {
      await target.put('settings', { key: 'llm', value: { api_key: 'secret-local-cible' } });
      const file = inspection.payload.files[0];
      const createdAt = '2020-01-02T03:04:05.000Z';
      const filename = 'original-local-a-conserver.bin';
      await target.put('files', {
        sha256: file.sha256, blob: new Blob([file.bytes], { type: file.mime }), mime: file.mime, size: file.size,
        created_at: createdAt, original_filename: filename,
      });
      await applyArchive(target, inspection, { mode: 'merge' });
      const preserved = await target.get('files', file.sha256);
      eq([preserved.created_at, preserved.original_filename], [createdAt, filename], 'Fusion : date et nom du fichier local existant conservés');
      const firstSnapshot = await snapshotValue(target);
      await applyArchive(target, inspection, { mode: 'merge' });
      eq(await snapshotValue(target), firstSnapshot, 'Restauration : deuxième import identique, contenus, métadonnées, fichiers et décomptes');
      ok((await verifyRestored(target, inspection, { mode: 'merge' })).ok, 'Restauration : double import vérifié');
      eq((await target.get('settings', 'llm')).value.api_key, 'secret-local-cible', 'Fusion : le secret de la destination reste intact');
    });
  }));

  await run('copie avec relation déjà cassée', () => withDatabase(async (db) => {
    await prepared(db);
    const activity = { id: 'la_orpheline', edition_id: 'ed_absente', event_type: 'open_book', occurred_at: '2026-01-01T00:00:00.000Z' };
    await db.put('library_activity', activity);
    const before = await snapshotValue(db);
    const archive = await createArchive(db);
    ok(archive.blob instanceof Blob && archive.blob.size > 0, 'Sauvegarde : copie ZIP générée malgré une ancienne relation cassée');
    ok(Array.isArray(archive.warnings) && archive.warnings.length > 0, 'Sauvegarde : relation cassée signalée dans les avertissements');
    const bytes = await archive.blob.arrayBuffer();
    const entries = readZip(bytes);
    eq(JSON.parse(textOf(entries.get('data/library_activity.json'))), [activity], 'Sauvegarde : la fiche orpheline est conservée dans la copie');
    const inspection = await inspectArchive(bytes);
    ok(!inspection.ok && inspection.errors.length > 0, 'Restauration : copie aux relations cassées refusée avant écriture');
    eq(await snapshotValue(db), before, 'Sauvegarde avec avertissement : source intégralement inchangée');
  }));

  await run('archives refusées', () => withDatabase(async (db) => {
    const { archive } = await prepared(db);
    const before = await snapshotValue(db);
    const malformed = [
      ['magasin obligatoire absent', ({ manifest }) => { manifest.data_files = manifest.data_files.filter((df) => df.store !== 'books'); }],
      ['clé primaire absente', ({ rewriteRows }) => rewriteRows('books', (rows) => { delete rows[0].id; })],
      ['clé primaire de mauvais type', ({ rewriteRows }) => rewriteRows('books', (rows) => { rows[0].id = 42; })],
      ['clé primaire dupliquée', ({ rewriteRows }) => rewriteRows('books', (rows) => { rows.push({ ...rows[0] }); })],
      ['ligne nulle', ({ rewriteRows }) => rewriteRows('books', (rows) => { rows[0] = null; })],
      ['SHA JSON absent', ({ manifest }) => { delete manifest.data_files[0].sha256; }],
      ['SHA JSON différent', ({ manifest }) => { manifest.data_files[0].sha256 = '0'.repeat(64); }],
      ['décompte du fichier JSON erroné', ({ manifest }) => { manifest.data_files[0].count++; }],
      ['décompte global erroné', ({ manifest }) => { manifest.counts.books++; }],
      ['décompte des fichiers sources erroné', ({ manifest }) => { manifest.counts.files++; }],
      ['fichier source absent', ({ manifest, entries }) => { entries.delete(manifest.files[0].path); }],
      ['fichier source altéré', ({ manifest, entries }) => { entries.set(manifest.files[0].path, new Uint8Array([9, 8, 7])); }],
      ['version courante absente', ({ rewriteRows }) => rewriteRows('recipes', (rows) => { rows[0].current_version_id = 'rv_absente'; })],
      ['page source absente dans un tableau', ({ rewriteRows }) => rewriteRows('recipes', (rows) => { rows[0].source_page_ids = ['pg_absente']; })],
      ['ingrédient absent dans une relation imbriquée', ({ rewriteRows }) => rewriteRows('recipe_versions', (rows) => { rows[0].ingredients[0].ingredient_id = 'ing_absent'; })],
      ['document de provenance absent', ({ rewriteRows }) => rewriteRows('recipe_versions', (rows) => { rows[0].provenance.source_document_id = 'doc_absent'; })],
    ];
    await run('manifeste minimal refusé', async () => {
      const bytes = createZip([{ path: 'manifest.json', data: JSON.stringify({ format: ARCHIVE_FORMAT, format_version: ARCHIVE_FORMAT_VERSION }) }]);
      const inspection = await inspectArchive(bytes.buffer);
      ok(!inspection.ok && inspection.errors.length > 0, 'Inspection : manifeste minimal refusé');
    });
    for (const [name, edit] of malformed) {
      await run(name, async () => {
        const inspection = await inspectArchive(await rewriteArchive(archive.blob, edit));
        ok(!inspection.ok && inspection.errors.length > 0, `Inspection : ${name} refusé`);
      });
    }
    eq(await snapshotValue(db), before, 'Inspection : aucune donnée locale modifiée par les archives invalides');
  }));

  await run('application refusée sans écriture', () => withDatabase(async (db) => {
    const { archive } = await prepared(db);
    const before = await snapshotValue(db);
    const invalid = await inspectArchive(await rewriteArchive(archive.blob, ({ manifest }) => { manifest.counts.books++; }));
    if (invalid.ok) throw new Error('Le décompte invalide aurait dû être refusé avant application');
    let rejected = false;
    try { await applyArchive(db, invalid, { mode: 'replace' }); } catch { rejected = true; }
    ok(rejected, 'Restauration : archive non validée refusée avant remplacement');
    eq(await snapshotValue(db), before, 'Restauration refusée : tous les contenus locaux restent identiques');
  }));

  await run('rollback après effacement et écriture', () => withDatabase(async (db) => {
    await prepared(db);
    const before = await snapshotValue(db);
    let failure = null;
    try {
      await db.putBatch({
        books: [{ id: 'b_nouveau', title: 'Écriture à annuler' }],
        recipes: [{ id: 'rc_non_clonable', callback: () => {} }],
      }, { clearStores: STORE_NAMES });
    } catch (error) { failure = error; }
    eq(failure?.name, 'DataCloneError', 'Transaction : vraie erreur IndexedDB sur une fonction non clonable');
    eq(await snapshotValue(db), before, 'Transaction : effacements et premières écritures entièrement annulés');
  }));

  await run('rollback après erreur asynchrone', () => withDatabase(async (db) => {
    await prepared(db);
    const before = await snapshotValue(db);
    let failure = null;
    try {
      // Les deux put sont clonables ; le deuxième viole l'index UNIQUE lorsque
      // ses requêtes sont exécutées par IndexedDB, après leur mise en file.
      await db.putBatch({
        books: [{ id: 'b_doublon_a', title: 'Même titre' }, { id: 'b_doublon_b', title: 'Même titre' }],
      }, { clearStores: STORE_NAMES });
    } catch (error) { failure = error; }
    eq(failure?.name, 'ConstraintError', 'Transaction : vraie erreur asynchrone de contrainte UNIQUE');
    eq(await snapshotValue(db), before, 'Transaction : rollback asynchrone terminé, tous les contenus originaux conservés');
  }, {
    ...STORES,
    books: { ...STORES.books, indexes: [...STORES.books.indexes, ['test_unique_title', 'title', { unique: true }]] },
  }));

  await run('vérification du contenu JSON', () => withDatabase(async (db) => {
    const { inspection } = await prepared(db);
    await applyArchive(db, inspection, { mode: 'replace' });
    const row = await db.get('recipe_versions', 'rv_test');
    row.ingredients[0].quantity.value = 999;
    await db.put('recipe_versions', row);
    const check = await verifyRestored(db, inspection, { mode: 'replace' });
    ok(!check.ok && check.diffs.length > 0, 'Vérification : quantité modifiée détectée malgré des identifiants identiques');
  }));

  await run('vérification des octets relus', () => withDatabase(async (db) => {
    const { inspection } = await prepared(db);
    await applyArchive(db, inspection, { mode: 'replace' });
    const row = await db.get('files', inspection.payload.files[0].sha256);
    row.blob = new Blob([new Uint8Array([6, 6, 6])], { type: row.mime });
    await db.put('files', row);
    const check = await verifyRestored(db, inspection, { mode: 'replace' });
    ok(!check.ok && check.diffs.length > 0, 'Vérification : Blob corrompu détecté sous la même clé SHA');
  }));

  await run('différence entre fusion et remplacement', () => withDatabase(async (db) => {
    const { inspection } = await prepared(db);
    await applyArchive(db, inspection, { mode: 'replace' });
    await db.put('books', { id: 'b_supplementaire', title: 'Autre livre local valide' });
    ok((await verifyRestored(db, inspection, { mode: 'merge' })).ok, 'Fusion : un livre local supplémentaire valide est accepté');
    const check = await verifyRestored(db, inspection, { mode: 'replace' });
    ok(!check.ok && check.diffs.length > 0, 'Remplacement : un livre supplémentaire est signalé');
    await applyArchive(db, inspection, { mode: 'replace' });
    eq(await db.get('books', 'b_supplementaire'), undefined, 'Remplacement : les anciennes lignes supplémentaires sont supprimées');
    ok((await verifyRestored(db, inspection, { mode: 'replace' })).ok, 'Remplacement : résultat exact vérifié après suppression');
  }));

  await run('noms ZIP dupliqués', async () => {
    const bytes = createZip([{ path: 'duplicate-a', data: 'A' }, { path: 'duplicate-b', data: 'B' }]);
    const previousName = enc.encode('duplicate-b');
    const duplicateName = enc.encode('duplicate-a');
    let changed = 0;
    // Renomme le deuxième fichier dans ses deux en-têtes sans modifier son
    // contenu ni son CRC. Le doublon ne dépend pas du générateur ZIP testé.
    for (let offset = 0; offset <= bytes.length - previousName.length; offset++) {
      if (previousName.every((value, index) => bytes[offset + index] === value)) {
        bytes.set(duplicateName, offset);
        changed++;
        offset += previousName.length - 1;
      }
    }
    if (changed !== 2) throw new Error('Préparation du ZIP dupliqué impossible');
    let rejected = false;
    try { readZip(bytes); } catch { rejected = true; }
    ok(rejected, 'ZIP : chemins dupliqués refusés à la lecture');
  });

  // Ces deux rollbacks exercent de véritables abandons de transaction, sans
  // remplir le stockage. Un quota réellement épuisé reste à valider séparément
  // sur appareil : cette suite ne provoque volontairement aucun manque d'espace.
}
