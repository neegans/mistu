import { withDatabase } from './backup.js';
import { createArchive, inspectArchive, applyArchive, verifyRestored } from '../src/domain/backup.js';
import { createZip, readZip, textOf } from '../src/core/zip.js';
import { lireEtatRecette } from '../src/domain/cycle-edition.js';
import { sha256Hex } from '../src/core/hash.js';

const at = '2026-10-29T18:00:00.000Z';
const edition = { id: 'l2-ed', book_id: 'l2-book', lifecycle_id: 'edition-trash', trashed_at: at, trash_mode: 'with_recipes' };
const recette = { id: 'l2-r', original_title: 'Pain', edition_id: 'l2-ed', lifecycle_id: 'restore-member', trashed_at: null, restored_from_edition: { edition_id: 'l2-ed', lifecycle_id: 'edition-trash' } };
const refuse = async fn => { try { await fn(); return false; } catch { return true; } };
const seed = db => db.putBatch({ books: [{ id: 'l2-book', title: 'Cuisine' }], book_editions: [edition], recipes: [recette] });

export async function runL2CorbeilleArchiveTests({ eq, ok }) {
  let archive;
  await withDatabase(async db => { await seed(db); archive = await createArchive(db); });
  eq(archive.manifest.format_version, 5, 'L2 archive : format5 conserve les protections des cycles et annonce les révisions de sources');
  const inspection = await inspectArchive(await archive.blob.arrayBuffer());
  ok(inspection.ok, 'L2 archive : groupe retiré et exception valides');
  await withDatabase(async db => {
    await applyArchive(db, inspection);
    eq([(await db.get('book_editions', 'l2-ed')).trash_mode, (await db.get('recipes', 'l2-r')).restored_from_edition], ['with_recipes', recette.restored_from_edition], 'L2 archive : groupe et membre restauré préservés');
    ok((await verifyRestored(db, inspection)).ok, 'L2 archive : restauration vérifiée');
  });
  for (const mode of ['merge', 'replace']) await withDatabase(async db => {
    await seed(db); await db.put('book_editions', { ...edition, lifecycle_id: 'edition-autre', trashed_at: null, trash_mode: null });
    const avant = await db.getSnapshot();
    ok(await refuse(() => applyArchive(db, inspection, { mode })), 'L2 archive : cycle édition divergent refuse ' + mode);
    eq(await db.getSnapshot(), avant, 'L2 archive : aucun graphe hybride en ' + mode);
  });
  await withDatabase(async db => {
    await seed(db); await db.put('recipes', { ...recette, restored_from_edition: null }); const avant = await db.getSnapshot();
    ok(await refuse(() => applyArchive(db, inspection)), 'L2 archive : exception différente refuse même cycle propre');
    eq(await db.getSnapshot(), avant, 'L2 archive : aucune restauration individuelle implicite');
  });
  let vide;
  await withDatabase(async db => { vide = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer()); });
  await withDatabase(async db => {
    await db.putBatch({ books: [{ id: 'l2-book', title: 'Cuisine' }], book_editions: [edition] });
    ok(await refuse(() => applyArchive(db, vide, { mode: 'replace' })), 'L2 archive : remplacement ne purge pas édition protégée omise');
    eq((await db.get('book_editions', 'l2-ed')).lifecycle_id, 'edition-trash', 'L2 archive : édition omise conservée');
  });
  await withDatabase(async db => {
    await seed(db); await db.put('book_editions', { ...edition, trash_mode: 'inconnu' });
    ok(await refuse(() => createArchive(db)), 'L2 archive : mode inconnu refuse une archive prétendue valide');
  });
  await withDatabase(async db => {
    await seed(db); const mutate = db.mutate.bind(db); let premier = true;
    db.mutate = async args => { if (premier) { premier = false; await mutate({ puts: { book_editions: [{ ...edition, lifecycle_id: 'retour-concurrent', trashed_at: null, trash_mode: null }] }, origin: 'remote' }); } return mutate(args); };
    ok(await refuse(() => applyArchive(db, inspection)), 'L2 archive : cycle parent survenu entre inspection et transaction refuse tout');
    eq((await db.get('book_editions', 'l2-ed')).lifecycle_id, 'retour-concurrent', 'L2 archive : retour concurrent conservé');
  });
  let collision;
  await withDatabase(async db => {
    await db.putBatch({ recipes: [{ id: 'autre', original_title: 'Soupe' }], recipe_versions: [{ id: 'version-partagee', recipe_id: 'autre', steps: [] }] });
    collision = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer());
  });
  await withDatabase(async db => {
    await db.putBatch({ books: [{ id: 'l2-book', title: 'Cuisine' }], book_editions: [edition], recipes: [{ id: 'l2-r', edition_id: 'l2-ed', original_title: 'Pain' }], recipe_versions: [{ id: 'version-partagee', recipe_id: 'l2-r', steps: [] }] });
    const avant = await db.getSnapshot();
    ok(await refuse(() => applyArchive(db, collision)), 'L2 archive : enfant du membre hérité protégé malgré cycle propre initial');
    eq(await db.getSnapshot(), avant, 'L2 archive : collision ne déplace pas un enfant hors du livre retiré');
  });
  for (const store of ['imports', 'cook_history', 'meals']) {
    const enfant = id => ({ id: 'enfant-partage', ...(store === 'meals' ? { items: [{ recipe_id: id }] } : { recipe_id: id }), ...(store === 'imports' ? { kind: 'thermomix', status: 'ignore' } : {}) });
    let entrante;
    await withDatabase(async db => {
      await db.putBatch({ recipes: [{ id: 'autre', original_title: 'Soupe' }], [store]: [enfant('autre')] });
      entrante = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer());
    });
    ok(entrante.ok, `L2 archive : collision ${store} issue d’une archive valide`);
    await withDatabase(async db => {
      await seed(db); await db.put(store, enfant(recette.id));
      const avant = await db.getSnapshot();
      ok(await refuse(() => applyArchive(db, entrante)), `L2 archive : ${store} ne peut quitter son membre protégé`);
      eq(await db.getSnapshot(), avant, `L2 archive : refus ${store} conserve le graphe entier`);
    });
  }
  for (const [store,champ,ancien,nouveau] of [['source_pages','document_id','doc-a','doc-b'],['source_documents','scan_session_id','session-a','session-b']]) {
    const graphe = (parent,protege=true) => ({ books:[{id:edition.book_id,title:'Cuisine'}],book_editions:[protege?edition:{id:edition.id,book_id:edition.book_id}],recipes:[{id:recette.id,edition_id:edition.id,source_page_ids:['page-source']}],
      scan_sessions:[{id:'session-a',edition_id:edition.id},{id:'session-b',edition_id:edition.id}],
      source_documents:[{id:'doc-a',edition_id:edition.id,scan_session_id:store==='source_documents'?parent:'session-a'},{id:'doc-b',edition_id:edition.id,scan_session_id:'session-b'}],
      source_pages:[{id:'page-source',edition_id:edition.id,document_id:store==='source_pages'?parent:'doc-a'}] });
    const archiveDe=async(parent,protege=true)=>{let a;await withDatabase(async db=>{await db.putBatch(graphe(parent,protege));a=await inspectArchive(await(await createArchive(db)).blob.arrayBuffer());});return a;};
    const entrante=await archiveDe(nouveau);
    for(const mode of ['merge','replace'])await withDatabase(async db=>{
      await db.putBatch(graphe(ancien));const avant=await db.getSnapshot();const {conflitsCyclesArchive}=await import('../src/domain/backup.js');
      ok((await conflitsCyclesArchive(db,entrante,{mode})).length>0,`L2 archive ${store} : collision directe ${champ} détectée avant ${mode}`);
      ok(await refuse(()=>applyArchive(db,entrante,{mode})),`L2 archive ${store} : même cycle ne permet pas de remplacer ${champ}`);
      eq(await db.getSnapshot(),avant,`L2 archive ${store} : aucun changement du groupe protégé après collision`);
    });
    const compatible=await archiveDe(ancien);
    await withDatabase(async db=>{
      await db.putBatch(graphe(ancien));const mutate=db.mutate.bind(db);let injecte=false,concurrent;
      db.mutate=async args=>{if(!injecte){injecte=true;await mutate({puts:graphe(nouveau),origin:'remote'});concurrent=await db.getSnapshot();}return mutate(args);};
      ok(await refuse(()=>applyArchive(db,compatible)),`L2 archive ${store} : parent changé entre contrôle et transaction refuse tout`);
      eq(await db.getSnapshot(),concurrent,`L2 archive ${store} : graphe concurrent intégralement conservé`);
    });
    const initiale=await archiveDe(nouveau,false);
    await withDatabase(async db=>{await db.putBatch(graphe(ancien,false));const avant=await db.getSnapshot();ok(await refuse(()=>applyArchive(db,initiale)),`L5 archive ${store} : une collision d’identité est aussi refusée sans cycle de corbeille`);eq(await db.getSnapshot(),avant,`L5 archive ${store} : l’ancien parent actif et ses données restent intacts`);});
  }
  for (const mode of ['keep_recipes', 'with_recipes']) await withDatabase(async source => {
    const parent = { ...edition, trash_mode: mode };
    const propre = { ...recette, id: 'propre', lifecycle_id: 'retrait-propre', trashed_at: at, restored_from_edition: null };
    const ancien = { ...recette, id: 'ancienne-exception', restored_from_edition: { edition_id: edition.id, lifecycle_id: 'cycle-plus-ancien' } };
    await source.putBatch({ books: [{ id: 'l2-book', title: 'Cuisine' }], book_editions: [parent], recipes: [recette, propre, ancien] });
    const inspection = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
    await withDatabase(async cible => {
      await applyArchive(cible, inspection);
      const ed = await cible.get('book_editions', edition.id);
      eq(lireEtatRecette(await cible.get('recipes', propre.id), ed).etat, 'retiree', `L2 archive ${mode} : retrait propre conservé`);
      eq(lireEtatRecette(await cible.get('recipes', ancien.id), ed).etat, mode === 'keep_recipes' ? 'active' : 'retiree', `L2 archive ${mode} : ancienne exception ne devient pas nouvelle restauration`);
      ok((await verifyRestored(cible, inspection)).ok, `L2 archive ${mode} : tous les champs inchangés`);
    });
  });
  for (const format of [1, 2]) {
    let ancienne;
    await withDatabase(async db => {
      await db.putBatch({ books: [{ id: 'ancien-livre' }], book_editions: [{ id: 'ancienne-edition', book_id: 'ancien-livre' }], recipes: [{ id: 'ancienne-recette', edition_id: 'ancienne-edition' }] });
      const zip = readZip(new Uint8Array(await (await createArchive(db)).blob.arrayBuffer()));
      const manifest = JSON.parse(textOf(zip.get('manifest.json'))); manifest.format_version = format;
      ancienne = await inspectArchive(createZip([...zip].map(([path, entry]) => ({ path, data: path === 'manifest.json' ? JSON.stringify(manifest) : entry.data }))));
    });
    ok(ancienne.ok, `L2 archive : ancien format ${format} accepté sans cycle de livre`);
    await withDatabase(async db => { await applyArchive(db, ancienne); ok((await verifyRestored(db, ancienne)).ok, `L2 archive : ancien format ${format} restauré fidèlement`); });
  }
  await withDatabase(async db => {
    await db.put('recipes', recette);
    const invalide = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer());
    ok(!invalide.ok, 'L2 archive : membre sans son édition refusé à l’inspection');
  });
  const blob = new Blob(['photo conservée'], { type: 'image/jpeg' }), sha256 = await sha256Hex(blob);
  let avecPhoto;
  await withDatabase(async db => {
    await seed(db); await db.putBatch({ files: [{ sha256, blob, size: blob.size, mime: blob.type }], cook_history: [{ id: 'cuisson', recipe_id: recette.id, photos: [sha256], notes: 'Mémoire conservée' }] });
    avecPhoto = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer());
  });
  await withDatabase(async db => {
    await applyArchive(db, avecPhoto);
    eq(await (await db.get('files', sha256)).blob.text(), 'photo conservée', 'L2 archive : octets de la photo du membre retiré intacts');
    eq((await db.get('cook_history', 'cuisson')).photos, [sha256], 'L2 archive : lien de photo conservé');
  });
}
