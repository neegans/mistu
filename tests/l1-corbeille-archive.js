import { withDatabase, rewriteArchive } from './backup.js';
import { createArchive, inspectArchive, applyArchive, verifyRestored } from '../src/domain/backup.js';
import { createZip, readZip, textOf } from '../src/core/zip.js';

const refuse = async fn => { try { await fn(); return false; } catch { return true; } };
const recette = (id = null, date = null) => ({ id: 'l1-r', original_title: 'Pain', current_version_id: 'l1-v', ...(id ? { lifecycle_id: id, trashed_at: date } : {}) });
const version = { id: 'l1-v', recipe_id: 'l1-r', ingredients: [], steps: [] };
export async function runL1CorbeilleArchiveTests({ eq, ok }) {
  let archive, ancienne;
  await withDatabase(async db => {
    await db.putBatch({ recipes: [recette('trash-1', '2026-10-29T12:00:00.000Z')], recipe_versions: [version] });
    archive = await createArchive(db);
    eq(archive.manifest.format_version, 7, 'L1 archive : format courant protège aussi les cycles des livres');
    await db.putBatch({ recipes: [recette()] }); ancienne = await createArchive(db);
  });
  const inspection = await inspectArchive(await archive.blob.arrayBuffer());
  ok(inspection.ok, 'L1 archive : inspection du cycle retiré');
  await withDatabase(async db => {
    await applyArchive(db, inspection);
    eq([(await db.get('recipes', 'l1-r')).lifecycle_id, (await db.get('recipes', 'l1-r')).trashed_at], ['trash-1', '2026-10-29T12:00:00.000Z'], 'L1 archive : cycle et date conservés sur base vide');
    ok((await verifyRestored(db, inspection)).ok, 'L1 archive : vérification fidèle après conservation');
  });
  for (const mode of ['merge', 'replace']) await withDatabase(async db => {
    await db.putBatch({ recipes: [recette('restore-2', null)], recipe_versions: [{ ...version, steps: [{ text: 'Correction locale' }] }] });
    const avant = await db.getSnapshot();
    ok(await refuse(() => applyArchive(db, inspection, { mode })), 'L1 archive : cycle divergent refuse tout en ' + mode);
    eq(await db.getSnapshot(), avant, 'L1 archive : aucun contenu hybride ni effacement en ' + mode);
  });
  await withDatabase(async db => {
    await db.putBatch({ recipes: [recette('trash-1', '2026-10-29T12:00:00.000Z')], recipe_versions: [version] });
    const mutate = db.mutate.bind(db); let injecte = false;
    db.mutate = async args => {
      if (!injecte) { injecte = true; await mutate({ puts: { recipes: [recette('restore-concurrent', null)] }, origin: 'remote' }); }
      return mutate(args);
    };
    ok(await refuse(() => applyArchive(db, inspection)), 'L1 archive : changement après inspection refusé dans transaction');
    eq((await db.get('recipes', 'l1-r')).lifecycle_id, 'restore-concurrent', 'L1 archive : cycle concurrent intact');
  });
  // B3 filtre cet orphelin à l'export : fabriquer le ZIP hostile conserve ici la preuve
  // que l'inspection, puis applyArchive, refusent toujours un enfant sans parent.
  const partielle = await inspectArchive(await rewriteArchive(ancienne.blob,async({rewriteRows})=>{
    await rewriteRows('recipes',rows=>{rows.length=0;});
  }));
  eq(partielle.ok, false, 'L1 archive : enfant sans parent refusé dès inspection');
  await withDatabase(async db => {
    await db.putBatch({ recipes: [recette('restore-2', null)], recipe_versions: [version] });
    const avant = await db.getSnapshot();
    ok(await refuse(() => applyArchive(db, partielle)), 'L1 archive : inspection invalide ne contourne pas les liens obligatoires');
    eq(await db.getSnapshot(), avant, 'L1 archive : archive partielle refusée sans contenu hybride');
  });
  let vide;
  await withDatabase(async db => { vide = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer()); });
  await withDatabase(async db => {
    await db.putBatch({ recipes: [recette('restore-2', null)], recipe_versions: [version] });
    const avant = await db.getSnapshot();
    ok(await refuse(() => applyArchive(db, vide, { mode: 'replace' })), 'L1 archive : remplacement ne purge pas une recette protégée absente de l’archive');
    eq(await db.getSnapshot(), avant, 'L1 archive : recette omise et enfants conservés');
  });
  await withDatabase(async db => {
    const mutate = db.mutate.bind(db); let injecte = false;
    db.mutate = async args => { if (!injecte) { injecte = true; await mutate({ puts: { sync_state: [{ key: 'user_id', value: 'nouveau-compte' }] }, origin: 'device' }); } return mutate(args); };
    ok(await refuse(() => applyArchive(db, inspection)), 'L1 archive : changement de compte avant commit refuse tout');
    eq([await db.count('recipes'), await db.count('recipe_versions')], [0, 0], 'L1 archive : aucune recette importée sous le nouveau compte');
  });
  let collision;
  await withDatabase(async db => {
    await db.putBatch({ recipes: [{ id: 'autre-recette', original_title: 'Soupe' }], recipe_versions: [{ ...version, recipe_id: 'autre-recette' }] });
    collision = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer());
  });
  ok(collision.ok, 'L1 archive : collision de clé enfant testée sur archive valide');
  await withDatabase(async db => {
    await db.putBatch({ recipes: [recette('restore-2', null)], recipe_versions: [version] });
    const avant = await db.getSnapshot();
    ok(await refuse(() => applyArchive(db, collision)), 'L1 archive : une clé de version ne peut quitter sa recette protégée omise');
    eq(await db.getSnapshot(), avant, 'L1 archive : collision enfant refuse tout, sans parent hybride');
  });
  await withDatabase(async db => {
    await db.putBatch({ recipes: [recette()], recipe_versions: [version] });
    const mutate = db.mutate.bind(db); let injecte = false;
    db.mutate = async args => { if (!injecte) { injecte = true; await mutate({ puts: { recipes: [recette('restore-survenu', null)] }, origin: 'remote' }); } return mutate(args); };
    ok(await refuse(() => applyArchive(db, collision)), 'L1 archive : collision recontrôlée si le cycle arrive après inspection');
    eq([(await db.get('recipe_versions', version.id)).recipe_id, (await db.get('recipes', 'l1-r')).lifecycle_id, await db.get('recipes', 'autre-recette')], ['l1-r', 'restore-survenu', undefined], 'L1 archive : course conserve le lien ancien et le cycle arrivé');
  });
  const zip = readZip(new Uint8Array(await ancienne.blob.arrayBuffer()));
  const manifest = JSON.parse(textOf(zip.get('manifest.json'))); manifest.format_version = 1;
  const v1 = createZip([...zip].map(([path, entry]) => ({ path, data: path === 'manifest.json' ? JSON.stringify(manifest) : entry.data })));
  const inspectionV1 = await inspectArchive(v1);
  ok(inspectionV1.ok, 'L1 archive : ancien format1 reste accepté');
  await withDatabase(async db => {
    await applyArchive(db, inspectionV1);
    eq((await db.get('recipes', 'l1-r')).lifecycle_id ?? null, null, 'L1 archive : ancien format crée cycle initial actif');
  });
}
