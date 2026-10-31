// L1 : transactions réelles et deux connexions, aucune donnée utilisateur.
import { withRepo } from './sync-fixture.js';
import { Database } from '../src/core/db.js';
import { STORES, DB_VERSION } from '../src/model/schema.js';

const recipe = () => ({ id: 'l1-r', original_title: 'Pain', availability: 'available', current_version_id: 'l1-v', favorite: false });
const version = () => ({ id: 'l1-v', recipe_id: 'l1-r', ingredients: [], steps: [] });
const contexte = (id = null, extra = {}) => ({ recipe_id: 'l1-r', expected_cycle_id: id, owner_id: null, ...extra });
const motif = async fn => { try { await fn(); return null; } catch (e) { return e.raison ?? e.code ?? e.message; } };

export async function runL1CorbeilleDomaineTests({ eq, ok }) {
  const bloc = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, 'L1 ' + nom + ' : ' + (e.stack || e)); } };
  let cycle, corbeille;
  try { cycle = await import('../src/domain/cycle-recette.js'); corbeille = await import('../src/domain/corbeille.js'); }
  catch { ok(false, 'L1 : domaines cycle et corbeille disponibles'); }
  if (cycle) {
    eq(cycle.lireCycleRecette(recipe()), { etat: 'active', id: null, trashed_at: null }, 'L1 : ancienne recette active');
    eq(cycle.lireCycleRecette({ ...recipe(), lifecycle_id: 'op-1', trashed_at: null }).etat, 'active', 'L1 : jeton conservé après restauration');
    for (const invalide of [{ trashed_at: '2026-10-29T12:00:00.000Z' }, { lifecycle_id: 'op' }, { lifecycle_id: 'op', trashed_at: undefined }, { lifecycle_id: '', trashed_at: null }, { lifecycle_id: 'op', trashed_at: 'demain' }, { lifecycle_id: 2, trashed_at: null }]) {
      eq(cycle.lireCycleRecette({ ...recipe(), ...invalide }).etat, 'invalide', 'L1 : paire de cycle invalide conservée sans supposition');
    }
  }
  await bloc('écritures tardives', async (repo, db) => {
    await db.putBatch({ recipes: [{ ...recipe(), lifecycle_id: 'trash-1', trashed_at: '2026-10-29T12:00:00.000Z' }], recipe_versions: [version()] }, { origin: 'device' });
    const avant = await db.getSnapshot(['recipes', 'recipe_versions', 'recipe_translations', 'outbox']);
    eq(await motif(() => repo.save('recipes', { ...recipe(), favorite: true }, { recettes: [contexte()] })), 'cycle_change', 'L1 : vieille fiche ne remet pas active');
    eq(await motif(() => repo.saveBatch({ recipe_versions: [{ ...version(), id: 'l1-v2' }] }, { recettes: [contexte()] })), 'cycle_change', 'L1 : enfant seul refusé après corbeille');
    eq(await motif(() => repo.saveBatch({ recipe_translations: [{ id: 'l1-tr', recipe_version_id: 'l1-v', locale: 'fr' }] })), 'cycle_change', 'L1 : chemin sans contexte ne contourne pas la corbeille');
    eq(await db.getSnapshot(['recipes', 'recipe_versions', 'recipe_translations', 'outbox']), avant, 'L1 : refus atomiques sans capture');
  });
  await bloc('restauration et contexte périmé', async (repo, db) => {
    await db.putBatch({ recipes: [{ ...recipe(), lifecycle_id: 'restore-2', trashed_at: null }], recipe_versions: [version()] }, { origin: 'device' });
    eq(await motif(() => repo.saveBatch({ recipe_versions: [{ ...version(), id: 'l1-v2' }] }, { recettes: [contexte()] })), 'cycle_change', 'L1 : ancien résultat refusé après restauration');
    await repo.saveBatch({ recipe_versions: [{ ...version(), id: 'l1-v3' }] }, { recettes: [contexte('restore-2')] });
    ok(!!await db.get('recipe_versions', 'l1-v3'), 'L1 : contexte courant actif accepté');
    eq(await motif(() => repo.save('recipes', { ...recipe(), lifecycle_id: 'autre', trashed_at: null }, { recettes: [contexte('restore-2')] })), 'cycle_reserve', 'L1 : put ordinaire ne change pas le cycle');
  });
  await bloc('création et disparition', async (repo, db) => {
    eq(await motif(() => repo.save('recipes', recipe())), 'source_absente', 'L1 : création doit être explicitement déclarée');
    await repo.saveBatch({ recipes: [recipe()], recipe_versions: [version()] }, { conditions: { recipes: [{ key: 'l1-r', absente: true }] } });
    ok(!!await db.get('recipes', 'l1-r'), 'L1 : condition absence vaut création explicite');
    await db.delete('recipes', 'l1-r');
    eq(await motif(() => repo.saveBatch({ recipe_versions: [{ ...version(), id: 'l1-v2' }] }, { recettes: [contexte()] })), 'source_absente', 'L1 : disparition ne crée pas un enfant orphelin');
  });
  await bloc('propriétaire et fichiers', async (repo, db) => {
    await db.putBatch({ recipes: [recipe()], recipe_versions: [version()], sync_state: [{ key: 'user_id', value: 'compte-b' }] }, { origin: 'device' });
    const sha = 'a'.repeat(64), avant = await db.getSnapshot(['recipes', 'files', 'outbox']);
    eq(await motif(() => repo.saveBatch({}, { recettes: [contexte(null, { owner_id: 'compte-a' })], fichiers: [{ sha256: sha, blob: new Blob(['photo'], { type: 'image/jpeg' }) }], conditions: { recipes: [{ key: 'l1-r', fusion: r => ({ ...r, photo_sha256: sha }) }] } })), 'compte_change', 'L1 : changement de compte refuse octets et lien');
    eq(await db.getSnapshot(['recipes', 'files', 'outbox']), avant, 'L1 : aucun octet ou marqueur sous le nouveau compte');
    await db.putBatch({ sync_state: [{ key: 'user_id', value: null }] }, { origin: 'device' });
    await repo.saveBatch({}, { recettes: [contexte()], fichiers: [{ sha256: sha, blob: new Blob(['photo'], { type: 'image/jpeg' }) }], conditions: { recipes: [{ key: 'l1-r', fusion: r => ({ ...r, photo_sha256: sha }) }] } });
    eq([await (await db.get('files', sha)).blob.text(), (await db.get('recipes', 'l1-r')).photo_sha256], ['photo', sha], 'L1 : octets et lien conservés ensemble');
  });
  await bloc('suppression physique protégée', async (repo, db) => {
    await db.putBatch({ recipes: [{ ...recipe(), lifecycle_id: 'restore-2', trashed_at: null }], recipe_versions: [version()] }, { origin: 'device' });
    const avant = await db.getSnapshot(['recipes', 'recipe_versions', 'outbox']);
    eq(await motif(() => repo.remove('recipes', 'l1-r', { recettes: [contexte('restore-2')] })), 'suppression_interdite', 'L1 : suppression générique ne purge pas une recette protégée');
    eq(await motif(() => repo.removeBatch({ recipe_versions: ['l1-v'] })), 'suppression_interdite', 'L1 : suppression générique des enfants ne contourne pas le cycle');
    eq(await db.getSnapshot(['recipes', 'recipe_versions', 'outbox']), avant, 'L1 : suppression refusée conserve parents enfants et file');
  });
  await bloc('garde des suppressions dans une transition', async (repo, db) => {
    await db.putBatch({ recipes: [{ ...recipe(), lifecycle_id: 'restore-2', trashed_at: null }], recipe_versions: [version()], imports: [{ id: 'l1-i', status: 'a_lancer' }] }, { origin: 'device' });
    const avant = await db.getSnapshot(['recipes', 'recipe_versions', 'imports', 'outbox']);
    eq(await motif(() => repo.transitionner('imports', 'l1-i', { attendus: ['a_lancer'], patch: { status: 'abandonne' }, deletes: { recipe_versions: ['l1-v'] }, recettes: [contexte('restore-2')] })), 'suppression_interdite', 'L1 : transition avec suppression enfant refuse la purge');
    eq(await db.getSnapshot(['recipes', 'recipe_versions', 'imports', 'outbox']), avant, 'L1 : suppression conditionnelle refusée conserve aussi le journal');
  });
  await bloc('capture avant la première attente', async (repo, db) => {
    const affichee = recipe(), capture = repo.capturerContexteRecette(affichee);
    affichee.lifecycle_id = 'restore-tardif'; affichee.trashed_at = null;
    eq((await capture).expected_cycle_id, null, 'L1 : une mutation de la copie affichée pendant la lecture du propriétaire ne change pas le cycle capturé');
    await db.putBatch({ recipes: [recipe()], sync_state: [{ key: 'user_id', value: 'nouveau-compte' }] }, { origin: 'device' });
    eq(await motif(() => repo.capturerContexteRecette(recipe(), { owner_id: 'ancien-compte' })), 'compte_change', 'L1 : capture depuis un ancien écran refuse le nouveau propriétaire');
  });
  await bloc('métadonnées des fusions d’agrégats', async (repo, db) => {
    await db.putBatch({ recipes: [recipe(), { id: 'l1-r2', original_title: 'Soupe', lifecycle_id: 'restauration-2', trashed_at: null }], meals: [{ id: 'l1-m', items: [{ recipe_id: 'l1-r' }] }] }, { origin: 'device' });
    await repo.saveBatch({}, { recettes: [contexte(), { recipe_id: 'l1-r2', expected_cycle_id: 'restauration-2', owner_id: null }], conditions: { meals: [{ key: 'l1-m', fusion: m => ({ ...m, items: [{ recipe_id: 'l1-r2' }] }) }] } });
    const envoi = (await db.getAll('outbox')).find(e => e.store === 'meals');
    eq(envoi?.recipe_contexts?.map(c => [c.recipe_id, c.expected_cycle_id]).sort(), [['l1-r', null], ['l1-r2', 'restauration-2']], 'L1 : la capture d’une fusion repas garde aussi le cycle de la nouvelle recette');
  });
  await bloc('journal de sources aux références historiques', async (repo, db) => {
    await db.putBatch({ recipes: [recipe()] }, { origin: 'device' });
    await repo.saveBatch({ scan_sessions: [{ id: 'l1-sources', recipe_ids: ['ancienne-recette-absente', 'l1-r'], status: 'open' }] }, { recettes: [contexte()] });
    eq((await db.get('scan_sessions', 'l1-sources')).recipe_ids, ['ancienne-recette-absente', 'l1-r'], 'L1 : journal de sources conserve ses pointeurs historiques souples');
  });
  await bloc('pages et octets liés au contexte du geste', async (repo, db) => {
    await db.putBatch({ recipes: [recipe()] }, { origin: 'device' });
    const capt = await repo.capturerContexteRecette(recipe()), photo = new File(['photo de page'], 'page.jpg', { type: 'image/jpeg' });
    await db.putBatch({ recipes: [{ ...recipe(), lifecycle_id: 'trash-page', trashed_at: '2026-10-29T12:00:00.000Z' }] }, { origin: 'device' });
    const magasins = ['files', 'source_pages', 'source_documents', 'scan_sessions', 'imports', 'outbox'];
    const avant = await db.getSnapshot(magasins);
    eq(await motif(() => repo.ajouterPages([photo], { import: { id: 'l1-pages', kind: 'recette', recipe_id: 'l1-r' }, recettes: [capt] })), 'cycle_change', 'L1 : ajout de pages sur ancienne fiche refuse après retrait');
    eq(await db.getSnapshot(magasins), avant, 'L1 : ajout de pages refusé sans octets orphelins ni journal');
    await db.putBatch({ recipes: [recipe()], sync_state: [{ key: 'user_id', value: 'autre-compte' }] }, { origin: 'device' });
    eq(await motif(() => repo.ajouterPages([photo], { recettes: [capt] })), 'compte_change', 'L1 : ajout de pages refuse sous un autre compte');
    eq(await db.getSnapshot(magasins), avant, 'L1 : changement de compte conserve les magasins sans aucune page');
    await db.putBatch({ sync_state: [{ key: 'user_id', value: null }] }, { origin: 'device' });
    const ajout = await repo.ajouterPages([photo], { import: { id: 'l1-pages', kind: 'recette', recipe_id: 'l1-r' }, recettes: [capt] });
    ok(!!(await db.get('files', ajout.pages[0].sha256))?.blob && (await db.get('imports', 'l1-pages')).page_ids.includes(ajout.pages[0].id), 'L1 : ajout accepté conserve ensemble octets page et journal');
    const journal = await db.get('imports', 'l1-pages');
    eq([journal.expected_cycle_id, journal.owner_id, Object.hasOwn(journal, 'owner_id')], [null, null, true], 'L1 : première page conserve le cycle et le propriétaire du brouillon');
  });
  await bloc('suppression historique d’un reste', async (repo, db) => {
    await db.putBatch({ recipes: [{ ...recipe(), lifecycle_id: 'trash-reste', trashed_at: '2026-10-29T12:00:00.000Z' }], inventory: [{ id: 'l1-reste', source_recipe_id: 'l1-r' }] }, { origin: 'device' });
    await repo.removeBatch({ inventory: ['l1-reste'] }, { recettes: [contexte('trash-reste', { historique: true })] });
    const entree = (await db.getAll('outbox')).find(e => e.store === 'inventory');
    eq([entree?.op, entree?.recipe_id, entree?.expected_cycle_id, entree?.historique], ['delete', 'l1-r', 'trash-reste', true], 'L1 : reste consommé porte le contexte historique jusque dans la capture du DELETE');
  });
  await bloc('rattachement depuis un autre compte', async (repo, db) => {
    const G = await import('../src/ui/regroupement.js'), UI = await import('../src/ui/import-cible.js');
    const { capturerProprietaire } = await import('../src/ui/recette-garde.js');
    const ligne = { id: 'l1-association', kind: 'recette', status: 'a_verifier', recipe_id: null, edition_id: 'edition-l1', resultat: { title: 'Pain' } };
    await db.putBatch({ recipes: [{ ...recipe(), edition_id: 'edition-l1', availability: 'reference_only' }], imports: [ligne] }, { origin: 'device' });
    const compte = await capturerProprietaire(repo, { proprietaireDonnees: null });
    await db.put('sync_state', { key: 'user_id', value: 'autre-compte' }, { origin: 'device' });
    eq(await motif(() => G.rattacherLecture(ligne.id, 'l1-r', { cle: UI.cleLecture(ligne), repo, compte })), 'edition_absente', 'L1 : rattachement sans édition présente refuse avant le contrôle du compte');
    const edition = { id: 'edition-l1', book_id: 'livre-l1', language: 'fr' };
    await db.putBatch({ book_editions: [edition], sync_state: [{ key: 'user_id', value: null }] }, { origin: 'device' });
    const contexteRecette = await repo.capturerContexteRecette(await db.get('recipes', 'l1-r'), { edition });
    const contexteEdition = await repo.capturerContexteEdition(edition);
    await db.put('sync_state', { key: 'user_id', value: 'autre-compte' }, { origin: 'device' });
    eq(await motif(() => G.rattacherLecture(ligne.id, 'l1-r', { cle: UI.cleLecture(ligne), repo, compte, contexteRecette, contexteEdition })), 'compte_change', 'L1 : rattachement avec édition présente garde le propriétaire capturé au montage');
    eq((await db.get('imports', ligne.id)).recipe_id, null, 'L1 : refus de compte ne rattache aucune lecture');
  });
  await bloc('contrat saveBatch sans patch', async (repo, db) => {
    await db.putBatch({ recipes: [{ ...recipe(), status: 'active' }] }, { origin: 'device' });
    eq(await motif(() => repo.saveBatch({}, { conditions: { recipes: [{ key: 'l1-r', attendus: ['active'], patch: { favorite: true } }] } })), 'saveBatch ne porte pas de patch (recipes) : passer par repo.transitionner', 'L1 : envelopper une garde ne rend pas un patch saveBatch autorisé');
    eq((await db.get('recipes', 'l1-r')).favorite, false, 'L1 : patch saveBatch interdit sans écriture');
  });
  await bloc('historique sans modification de recette', async (repo, db) => {
    await db.putBatch({ recipes: [{ ...recipe(), lifecycle_id: 'trash-1', trashed_at: '2026-10-29T12:00:00.000Z' }], recipe_versions: [version()] }, { origin: 'device' });
    await repo.saveBatch({ cook_history: [{ id: 'l1-h', recipe_id: 'l1-r', recipe_version_id: 'l1-v', notes: 'Mon souvenir' }] }, { recettes: [contexte(null, { historique: true })], conditions: { recipe_versions: [{ key: 'l1-v', fusion: () => null }] } });
    ok(!!await db.get('cook_history', 'l1-h'), 'L1 : historique autorisé avec condition de lecture de version');
    eq(await motif(() => repo.saveBatch({}, { recettes: [contexte(null, { historique: true })], conditions: { recipe_versions: [{ key: 'l1-v', fusion: v => ({ ...v, status: 'tested' }) }] } })), 'historique_seul', 'L1 : historique ne permet pas une fusion qui change une version');
    eq((await db.get('recipes', 'l1-r')).lifecycle_id, 'trash-1', 'L1 : historique ne restaure jamais');
  });
  await bloc('concurrence dans la transaction finale', async (repo, db) => {
    await db.putBatch({ recipes: [recipe()], recipe_versions: [version()] }, { origin: 'device' });
    const mutate = db.mutate.bind(db); let injecte = false;
    db.mutate = async args => {
      if (!injecte) { injecte = true; await mutate({ puts: { recipes: [{ ...recipe(), lifecycle_id: 'trash-concurrent', trashed_at: '2026-10-29T12:00:00.000Z' }] }, origin: 'remote' }); }
      return mutate(args);
    };
    eq(await motif(() => repo.saveBatch({ recipe_versions: [{ ...version(), id: 'l1-v2' }] }, { recettes: [contexte()] })), 'cycle_change', 'L1 : retrait entre préparation et écriture refuse le lot');
    eq(await db.get('recipe_versions', 'l1-v2'), undefined, 'L1 : aucun enfant de la transaction refusée');
  });
  if (corbeille) await bloc('commande durable', async (repo, db) => {
    await db.putBatch({ recipes: [recipe()], recipe_versions: [version()] }, { origin: 'device' });
    const ctx = await repo.capturerContexteRecette(recipe());
    const r = await corbeille.mettreALaCorbeille(recipe(), { repo, contexte: ctx, operationId: 'trash-l1' });
    eq([r.recipe.lifecycle_id, !!r.recipe.trashed_at], ['trash-l1', true], 'L1 : marqueur local écrit');
    const file = await db.getAll('outbox');
    eq(file.filter(x => x.op === 'lifecycle').map(x => x.payload.operation_id), ['trash-l1'], 'L1 : commande immuable capturée');
    const autre = new Database(db.name, DB_VERSION, STORES);
    try { eq((await autre.get('recipes', 'l1-r')).lifecycle_id, 'trash-l1', 'L1 : autre connexion voit le retrait durable'); } finally { autre.idb?.close(); }
    const idem = await corbeille.mettreALaCorbeille(recipe(), { repo, contexte: ctx, operationId: 'trash-l1' });
    eq(idem.recipe.lifecycle_id, 'trash-l1', 'L1 : réessai reconnu sans nouvel effet');
    eq((await db.getAll('outbox')).length, file.length, 'L1 : réessai sans double capture');
    const retour = await corbeille.restaurerRecette(r.recipe, { repo, contexte: await repo.capturerContexteRecette(r.recipe), operationId: 'restore-l1' });
    eq([retour.recipe.lifecycle_id, retour.recipe.trashed_at], ['restore-l1', null], 'L1 : restauration garde le nouveau jeton');
    eq((await db.getAll('outbox')).filter(x => x.op === 'lifecycle').map(x => x.payload.action), ['trash', 'restore'], 'L1 : deux commandes durables ordonnées');
    eq(await motif(async () => corbeille.restaurerRecette(r.recipe, { repo, contexte: await repo.capturerContexteRecette(r.recipe), operationId: 'restore-trop-tard' })), 'cycle_change', 'L1 : Annuler périmé refusé');
    const liste = await corbeille.chargerCorbeille({ repo });
    eq(liste.retirees.length, 0, 'L1 : index corbeille utilisé et vide après restauration');
  });
  if (corbeille) await bloc('éligibilité et états illisibles', async (repo, db) => {
    await db.putBatch({ recipes: [{ ...recipe(), edition_id: 'livre' }, { id: 'invalide', original_title: 'À vérifier', lifecycle_id: 'op-sans-date' }] }, { origin: 'device' });
    eq(await motif(() => corbeille.mettreALaCorbeille(recipe(), { repo, contexte: contexte(), operationId: 'non' })), 'source_modifiee', 'L1 : rattachement concurrent à une édition fait refuser');
    const liste = await corbeille.chargerCorbeille({ repo });
    eq(liste.invalides.map(r => r.id), ['invalide'], 'L1 : état invalide retrouvé hors index');
  });
  const nom = 'l1-migration-' + Math.random(), ancienStores = { recipes: { keyPath: 'id', indexes: [] } };
  const ancien = new Database(nom, 4, ancienStores), nouveau = new Database(nom, DB_VERSION, STORES);
  try {
    await ancien.put('recipes', recipe()); await nouveau.open();
    eq(ancien.idb, null, 'L1 : migration ferme la connexion ancienne');
    ok(nouveau.idb.transaction('recipes').objectStore('recipes').indexNames.contains('trashed_at'), 'L1 : index réel de corbeille installé');
    let erreurVersion; try { await ancien.put('recipes', { ...recipe(), favorite: true }); } catch (e) { erreurVersion = e; }
    eq(erreurVersion?.name, 'VersionError', 'L1 : ancien code DB4 ne réouvre pas la base DB5');
    eq((await nouveau.get('recipes', 'l1-r')).favorite, false, 'L1 : migration conserve les données sans réécriture');
  } finally { ancien.idb?.close(); nouveau.idb?.close(); await new Promise((resolve, reject) => { const q = indexedDB.deleteDatabase(nom); q.onsuccess = resolve; q.onerror = reject; }); }
}
