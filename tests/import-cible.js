// Tests du lot A « Importer une recette repérée », tâche 1 (spec docs/superpowers/specs/2026-10-18-import-cible-design.md, rév. 3.1) :
// schéma (DB_VERSION 4, magasin imports, K-9), primitives (db.mutate à conditions, repo.transitionner, saveBatch conditionné), archives
// tolérantes aux magasins ajoutés après le format 1 (Review Focus 1), vocabulaire fermé des fabricants (D-12), test statique « transitionner( ».
// Bases jetables seulement ; aucun réseau ; aucune écriture dans la bibliothèque de la personne.
import { withDatabase, rewriteArchive } from './backup.js';
import { withRepo } from './sync-fixture.js';
import { on } from '../src/core/bus.js';

const DATE = '2026-10-18T00:00:00.000Z';
// Bibliothèque minimale et cohérente (relations vérifiées par inspectArchive) pour fabriquer des archives au vol.
const BIBLIO_MIN = {
  books: [{ id: 'b1', title: 'Livre', author: 'A', updated_at: DATE }],
  book_editions: [{ id: 'ed1', book_id: 'b1', language: 'fr', updated_at: DATE }],
  recipes: [{ id: 'rc1', edition_id: 'ed1', original_title: 'Tarte aux pommes', availability: 'reference_only', verification_state: 'unverified', updated_at: DATE }],
};

export async function runImportCibleTests({ eq, ok }) {
  const run = async (name, test) => {
    try { await test(); }
    catch (error) { ok(false, `Import ciblé — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };

  // --- Schéma (spec § 3.1, § 3.7, K-9)
  const S = await import('../src/model/schema.js');
  eq(S.DB_VERSION, 4, 'schéma : DB_VERSION 4');
  const noms = Object.keys(S.STORES);
  eq([noms[noms.indexOf('assistant_config') + 1], noms[noms.indexOf('imports') + 1]], ['imports', 'settings'], 'schéma : imports juste après assistant_config, avant settings');
  eq(S.STORES.imports, { keyPath: 'id', indexes: [['edition_id', 'edition_id'], ['recipe_id', 'recipe_id'], ['status', 'status']] }, 'schéma : clé et index d’imports');
  ok(S.SYNC_STORES.at(-1) === 'imports' && S.SYNC_STORES.length === 27 && S.ARCHIVE_DATA_STORES.includes('imports'), 'schéma : 27 synchronisés, imports dernier, archivé');
  eq(S.RELATIONS.filter(([c]) => c === 'imports').map(([, p, m]) => [p, m]).sort(), [['edition_id', 'book_editions'], ['scan_session_id', 'scan_sessions']], 'schéma : recipe_id et page_ids sont des pointeurs souples (hors RELATIONS)');
  eq(S.MAGASINS_AJOUTES_APRES_V1, ['imports'], 'schéma : magasins ajoutés après le format 1');
  eq(S.STATUTS_IMPORT, ['a_lancer', 'en_cours', 'a_verifier', 'enregistre', 'echec', 'ignore'], 'schéma : statuts du journal');

  // --- Montée 3 → 4 sur une base peuplée (spec § 7) : le seul chemin capable de rendre une bibliothèque illisible.
  const { Database } = await import('../src/core/db.js');
  const STORES_V3 = Object.fromEntries(Object.entries(S.STORES).filter(([n]) => n !== 'imports'));
  await run('montée 3 → 4', () => withDatabase(async (v3) => {
    const recette = { id: 'rc_v3', edition_id: null, original_title: 'Avant imports', availability: 'reference_only', updated_at: DATE };
    const livre = { id: 'b_v3', title: 'Livre v3', updated_at: DATE };
    await v3.mutate({ puts: { recipes: [recette], books: [livre] } });
    eq([v3.idb.version, v3.idb.objectStoreNames.contains('imports')], [3, false], 'montée : la base de départ est en v3, sans magasin imports');
    v3.idb.close(); v3.idb = null; // la montée a besoin de la base libre
    const v4 = new Database(v3.name, S.DB_VERSION, S.STORES);
    await v4.open();
    try {
      eq(v4.idb.version, S.DB_VERSION, 'montée : la base est passée à la version courante sans rejet');
      ok(v4.idb.objectStoreNames.contains('imports'), 'montée : le magasin imports est créé');
      eq([...v4.idb.transaction('imports').objectStore('imports').indexNames].sort(), ['edition_id', 'recipe_id', 'status'], 'montée : les trois index d’imports existent');
      eq([await v4.get('recipes', 'rc_v3'), await v4.get('books', 'b_v3')], [recette, livre], 'montée : la recette et le livre sont intacts, champ pour champ');
      eq(await v4.byIndex('imports', 'status', 'a_lancer'), [], 'montée : l’index status est utilisable');
    } finally { v4.idb.close(); v4.idb = null; }
  }, STORES_V3, 3));

  // --- db.mutate({ conditions }) : lecture, vérification, capture et écritures dans UNE transaction (spec § 3.6, I-10, Review Focus 3)
  await run('db.mutate conditions', () => withDatabase(async (db) => {
    await db.put('imports', { id: 'imp_1', status: 'a_lancer', updated_at: '2026-10-18T00:00:00.000Z' });
    await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] } });
    eq((await db.get('imports', 'imp_1')).status, 'en_cours', 'conditions : écrit quand le statut est attendu');
    let refus = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] }, puts: { recipes: [{ id: 'rc_non' }] } }); } catch (e) { refus = e; }
    eq([refus?.name, refus?.statut, await db.get('recipes', 'rc_non')], ['TransitionRefusee', 'en_cours', undefined], 'conditions : condition fausse → refus nommé, RIEN d’écrit, pas même les puts');
    eq([refus?.store, refus?.key], ['imports', 'imp_1'], 'conditions : le refus nomme le magasin et la clé');
    const entrees = []; db.onMutate = ({ puts, origin }) => { entrees.push([Object.keys(puts).sort(), origin]); return {}; };
    await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['en_cours'], patch: (c) => ({ status: 'a_verifier', appels: (c.appels || 0) + 1 }) }] }, puts: { recipes: [{ id: 'rc_x', availability: 'available' }] } });
    eq([entrees, (await db.get('recipes', 'rc_x'))?.id, (await db.get('imports', 'imp_1')).appels], [[[['imports', 'recipes'], 'local']], 'rc_x', 1], 'conditions : patch-fonction, puts et capture dans une seule transaction');
    db.onMutate = null;
    let absente = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_absente', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] } }); } catch (e) { absente = e; }
    eq([absente?.name, absente?.statut, await db.get('imports', 'imp_absente')], ['TransitionRefusee', undefined, undefined], 'conditions : fiche absente → refus nommé (statut indéfini), rien d’écrit');
    await db.put('imports', { id: 'imp_2', status: 'echec' });
    const res = await Promise.allSettled([1, 2].map(() => db.mutate({ conditions: { imports: [{ key: 'imp_2', attendus: ['echec'], patch: { status: 'en_cours' } }] } })));
    eq(res.map((x) => x.status).sort(), ['fulfilled', 'rejected'], 'conditions (Review Focus 3) : deux transitions entrelacées, une seule écrit');
    eq(res.find((x) => x.status === 'rejected')?.reason?.name, 'TransitionRefusee', 'conditions (Review Focus 3) : la seconde est refusée par son nom, pas par un rejet générique');
  }));

  // --- repo.transitionner et repo.saveBatch(…, { conditions }) : nettoyage, horodatage, change, capture (spec § 3.6)
  await run('repo.transitionner', () => withRepo(async (repo, db) => {
    await db.mutate({ puts: { imports: [{ id: 'imp_t', status: 'a_lancer', created_at: DATE, updated_at: DATE }] }, origin: 'device' }); // hors capture : seule la transition doit entrer en file
    const notifs = [];
    const off = on('change', (p) => notifs.push(p));
    try {
      await repo.transitionner('imports', 'imp_t', { attendus: ['a_lancer'], patch: { status: 'en_cours', erreur: { raison: 'x\u0007' } }, puts: { recipes: [{ id: 'rc_t', availability: 'available', original_title: 'T\u0007' }] } });
    } finally { off(); }
    const apres = await db.get('imports', 'imp_t');
    const rc = await db.get('recipes', 'rc_t');
    eq([apres.status, apres.erreur, apres.updated_at > DATE, apres.created_at], ['en_cours', { raison: 'x' }, true, DATE], 'transitionner : patch appliqué, chaînes de contrôle retirées, updated_at posé, created_at conservé');
    eq([rc?.original_title, typeof rc?.updated_at, rc?.created_at === rc?.updated_at], ['T', 'string', true], 'transitionner : les puts sont nettoyés et horodatés comme par saveBatch');
    eq(notifs.length, 1, 'transitionner : un abonné change est notifié une fois');
    eq((await db.getAll('outbox')).map((e) => [e.store, e.id, e.op]).sort(), [['imports', 'imp_t', 'put'], ['recipes', 'rc_t', 'put']], 'transitionner : la capture voit la fiche conditionnée ET les puts (même transaction)');
    let refus = null;
    try { await repo.transitionner('imports', 'imp_t', { attendus: ['a_lancer'], patch: { status: 'echec' }, puts: { recipes: [{ id: 'rc_non', availability: 'available' }] } }); } catch (e) { refus = e; }
    eq([refus?.name, refus?.store, refus?.key, refus?.statut, (await db.get('imports', 'imp_t')).status, await db.get('recipes', 'rc_non'), (await db.getAll('outbox')).length], ['TransitionRefusee', 'imports', 'imp_t', 'en_cours', 'en_cours', undefined, 2], 'transitionner : condition fausse → TransitionRefusee nommée, rien d’écrit, rien en file');
    let refus2 = null;
    try { await repo.saveBatch({ imports: [{ id: 'imp_s', status: 'a_lancer' }] }, { conditions: { imports: [{ key: 'imp_t', attendus: ['a_lancer'] }] } }); } catch (e) { refus2 = e; }
    eq([refus2?.name, await db.get('imports', 'imp_s')], ['TransitionRefusee', undefined], 'saveBatch conditionné : condition fausse → refus nommé, rien d’écrit');
    await repo.saveBatch({ imports: [{ id: 'imp_s', status: 'a_lancer' }] }, { conditions: { imports: [{ key: 'imp_t', attendus: ['en_cours'] }] } });
    const s = await db.get('imports', 'imp_s');
    eq([s?.status, typeof s?.updated_at, (await db.get('imports', 'imp_t')).updated_at === apres.updated_at], ['a_lancer', 'string', true], 'saveBatch conditionné : condition vraie → le lot est écrit et horodaté ; la fiche vérifiée sans patch n’est pas réécrite');
    eq(typeof db.transitionner, 'undefined', 'une seule primitive : db.transitionner n’existe pas');
  }));

  // --- Test statique : transitionner( n'existe que dans repo.js et, ailleurs, sous la forme repo.transitionner( (spec § 7, I-10)
  await run('statique transitionner(', async () => {
    const sw = await lire('../sw.js');
    const modules = [...sw.matchAll(/'\.\/(src\/[^']+\.js)'/g)].map((m) => m[1]);
    ok(modules.length > 30, 'statique : SHELL lu (' + modules.length + ' modules) avant de conclure');
    const fautifs = [];
    let dansRepo = 0;
    for (const m of modules) {
      const src = await lire('../' + m);
      for (const x of src.matchAll(/transitionner\(/g)) {
        if (m === 'src/model/repo.js') { dansRepo += 1; continue; }
        if (src.slice(Math.max(0, x.index - 5), x.index) !== 'repo.') fautifs.push(`${m}:${x.index}`);
      }
    }
    ok(dansRepo >= 1, 'statique : repo.js définit transitionner(');
    eq(fautifs, [], 'statique : hors repo.js, transitionner( n’apparaît que sous la forme repo.transitionner(');
  });

  // --- Archives (spec § 3.7, Review Focus 1) : une archive FAITE AVANT LE LOT (format 1, sans data/imports.json) se restaure.
  const { createArchive, inspectArchive, applyArchive, verifyRestored } = await import('../src/domain/backup.js');
  await run('archive réelle 0.8.1 sans imports', async () => {
    const r = await fetch(new URL('./fixtures/archive-0.8.1-sans-imports.zip', import.meta.url), { cache: 'no-store' });
    if (!r.ok) throw new Error('fixture : HTTP ' + r.status);
    const insp = await inspectArchive(await r.arrayBuffer());
    eq([insp.manifest?.app_version, insp.manifest?.format_version, insp.manifest?.data_files?.some((d) => d.store === 'imports'), 'imports' in (insp.manifest?.counts || {})], ['0.8.1', 1, false, false], 'fixture : archive réelle de 0.8.1, format 1, sans data/imports.json ni counts.imports');
    eq(insp.errors, [], 'fixture (Review Focus 1) : l’archive d’avant le lot passe l’inspection');
    ok(insp.ok && insp.payload?.stores.recipes?.length === 2, 'fixture : inspection ok, deux recettes (une référence, une disponible)');
    for (const mode of ['merge', 'replace']) {
      await withDatabase(async (db) => {
        if (mode === 'replace') await db.put('imports', { id: 'imp_avant', status: 'echec', updated_at: DATE }); // le remplacement vide aussi imports
        await applyArchive(db, insp, { mode });
        eq((await verifyRestored(db, insp, { mode })).diffs, [], `fixture (Review Focus 1) : restauration en ${mode} sans écart`);
        eq(await db.getAll('imports'), [], `fixture : après restauration en ${mode}, imports vaut []`);
        eq([(await db.get('recipes', 'rc_fix_ref'))?.availability, (await db.get('recipes', 'rc_fix_dispo'))?.current_version_id], ['reference_only', 'rv_fix'], `fixture : les recettes sont restaurées (${mode})`);
      });
    }
  });
  await run('archives au vol (rewriteArchive)', () => withDatabase(async (source) => {
    await source.putBatch(BIBLIO_MIN);
    const archive = await createArchive(source);
    ok(archive.manifest.data_files.some((d) => d.store === 'imports') && archive.manifest.counts.imports === 0, 'archive courante : data/imports.json et counts.imports présents (ce que la réécriture retire)');
    const sans = await rewriteArchive(archive.blob, ({ manifest, entries }) => {
      manifest.data_files = manifest.data_files.filter((d) => d.store !== 'imports');
      entries.delete('data/imports.json');
      delete manifest.counts.imports;
    });
    const insp = await inspectArchive(sans);
    eq(insp.errors, [], 'archive au vol sans imports : acceptée');
    await withDatabase(async (cible) => {
      await applyArchive(cible, insp, { mode: 'merge' });
      eq([(await verifyRestored(cible, insp, { mode: 'merge' })).ok, await cible.getAll('imports'), (await cible.get('recipes', 'rc1'))?.original_title], [true, [], 'Tarte aux pommes'], 'archive au vol sans imports : restaurée, imports vaut []');
    });
    // Aller-retour AVEC une ligne imports : archivée, comptée, retrouvée telle quelle.
    const ligne = { id: 'imp_ar', kind: 'recette', edition_id: 'ed1', recipe_id: 'rc1', scan_session_id: null, page_ids: ['pg_absente'], status: 'a_verifier', updated_at: DATE };
    await source.put('imports', ligne);
    const insp2 = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
    eq([insp2.ok, insp2.errors, insp2.manifest?.counts.imports], [true, [], 1], 'aller-retour : une ligne imports est archivée et comptée ; recipe_id et page_ids ne sont pas des relations (une page absente ne bloque pas)');
    await withDatabase(async (cible) => {
      await applyArchive(cible, insp2, { mode: 'replace' });
      eq([await cible.get('imports', 'imp_ar'), (await verifyRestored(cible, insp2, { mode: 'replace' })).ok], [ligne, true], 'aller-retour : la ligne imports est retrouvée telle quelle');
    });
    // Une ligne imports dont l'édition manque est une relation cassée : refusée comme les autres.
    await source.put('imports', { ...ligne, id: 'imp_orpheline', edition_id: 'ed_absente' });
    const insp3 = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
    ok(!insp3.ok && insp3.errors.some((e) => e.startsWith('imports.edition_id → book_editions ed_absente')), 'archive : imports.edition_id est une relation vérifiée');
    // data/recipes.json absent : toujours refusé, nommé.
    const sansRecettes = await rewriteArchive(archive.blob, ({ manifest, entries }) => {
      manifest.data_files = manifest.data_files.filter((d) => d.store !== 'recipes');
      entries.delete('data/recipes.json');
      delete manifest.counts.recipes;
    });
    const insp4 = await inspectArchive(sansRecettes);
    ok(!insp4.ok && insp4.errors.includes('Magasin absent ou invalide : recipes'), 'archive sans data/recipes.json : toujours refusée, nommée');
  }));

  // --- Vocabulaire (spec § 3.3, D-12) : une fonction pure appelée par les fabricants, jamais un mur dans db.mutate.
  await run('vocabulaire', async () => {
    const V = await import('../src/domain/vocabulaire.js');
    let e = null; try { V.assertVocabulaire({ availability: 'dispo' }, 'recipes'); } catch (x) { e = x; }
    eq([e?.name, e?.champ, e?.valeur], ['ErreurVocabulaire', 'availability', 'dispo'], 'vocabulaire : valeur hors liste refusée, nommée');
    eq(e?.magasin, 'recipes', 'vocabulaire : l’erreur nomme le magasin');
    e = null; try { V.assertVocabulaire({ verification_state: 'ok' }, 'recipes'); } catch (x) { e = x; } eq(e?.champ, 'verification_state', 'vocabulaire : état de vérification hors liste refusé');
    eq(V.assertVocabulaire({ original_title: 'x' }, 'recipes'), true, 'vocabulaire : champ absent toléré, rend true');
    eq(V.assertVocabulaire({ availability: 'available', verification_state: 'to_verify' }, 'recipes'), true, 'vocabulaire : valeurs de la liste acceptées');
    e = null; try { V.assertVocabulaire({ status: 'fini' }, 'imports'); } catch (x) { e = x; } eq(e?.champ, 'status', 'vocabulaire : statut d’import hors liste refusé');
    e = null; try { V.assertVocabulaire({ id: 'imp' }, 'imports'); } catch (x) { e = x; } eq(e?.champ, 'status', 'vocabulaire : un import sans statut est refusé (le statut est obligatoire)');
    eq(V.assertVocabulaire({ status: 'a_lancer' }, 'imports'), true, 'vocabulaire : statut d’import de la liste accepté');
    eq(V.assertVocabulaire({ status: 'nimporte' }, 'books'), true, 'vocabulaire : magasin sans vocabulaire fermé → rien à vérifier');
    const src = await lire('../src/domain/creation-ia.js') + await lire('../src/ui/signet.js') + await lire('../src/ui/recipe-edit.js');
    eq((src.match(/assertVocabulaire\(/g) || []).length >= 3, true, 'vocabulaire : les trois fabricants existants l’appellent (test de source, faible, admis)');
    // Par comportement, là où c'est pur : le fabricant du signet refuse une fiche au vocabulaire inventé avant toute écriture.
    const { fabriquerSignet, signetModel } = await import('../src/ui/signet.js');
    const m = signetModel({ adresse: 'https://exemple.test/recette', titre: 'Signet' });
    ok(fabriquerSignet(m, { newId: (p) => p + '_1', langue: 'fr' }).availability === 'reference_only', 'vocabulaire : fabriquerSignet rend une fiche au vocabulaire de la liste');
  });
}
