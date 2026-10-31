import { withRepo } from './sync-fixture.js';

const at = '2026-10-29T18:00:00.000Z';
const edition = (extra = {}) => ({ id: 'l2-ed', book_id: 'l2-book', language: 'fr', ...extra });
const recette = (extra = {}) => ({ id: 'l2-r', edition_id: 'l2-ed', original_title: 'Pain', availability: 'available', current_version_id: 'l2-v', ...extra });
const version = { id: 'l2-v', recipe_id: 'l2-r', ingredients: [], steps: [] };
const retired = (mode = 'with_recipes') => edition({ lifecycle_id: 'edition-trash', trashed_at: at, trash_mode: mode });
const rc = (extra = {}) => ({ recipe_id: 'l2-r', expected_cycle_id: null, expected_edition_id: 'l2-ed', expected_edition_cycle_id: null, owner_id: null, ...extra });
const ed = (extra = {}) => ({ edition_id: 'l2-ed', expected_cycle_id: null, owner_id: null, ...extra });
const motif = async fn => { try { await fn(); return null; } catch (e) { return e.raison ?? e.code ?? e.message; } };
const seed = (db, e = edition(), r = recette()) => db.putBatch({ books: [{ id: 'l2-book', title: 'Cuisine' }], book_editions: [e], recipes: [r], recipe_versions: [version] }, { origin: 'device' });

export async function runL2CorbeilleDomaineTests({ eq, ok }) {
  let C, D;
  try { C = await import('../src/domain/cycle-edition.js'); D = await import('../src/domain/corbeille-livres.js'); }
  catch { ok(false, 'L2 : lecteurs et domaine disponibles'); }
  const bloc = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, 'L2 ' + nom + ' : ' + (e.stack || e)); } };
  if (C) {
    eq(C.lireCycleEdition(edition()), { etat: 'active', id: null, trashed_at: null, mode: null }, 'L2 : ancienne édition active');
    for (const extra of [{ lifecycle_id: 'op' }, { trashed_at: at }, { lifecycle_id: 'op', trashed_at: at }, { lifecycle_id: 'op', trashed_at: null, trash_mode: 'with_recipes' }, { lifecycle_id: 'op', trashed_at: at, trash_mode: 'inconnu' }]) {
      eq(C.lireCycleEdition(edition(extra)).etat, 'invalide', 'L2 : cycle édition malformé non actif');
    }
    for (const [r, e, attendu] of [
      [recette({ edition_id: null }), null, 'active'], [recette(), edition(), 'active'], [recette(), retired('keep_recipes'), 'active'],
      [recette(), retired(), 'retiree'], [recette(), null, 'incomplete'],
      [recette({ restored_from_edition: { edition_id: 'l2-ed', lifecycle_id: 'edition-trash' } }), retired(), 'active'],
      [recette({ restored_from_edition: { edition_id: 'l2-ed', lifecycle_id: 'ancien' } }), retired(), 'retiree'],
      [recette({ lifecycle_id: 'own-trash', trashed_at: at, restored_from_edition: { edition_id: 'l2-ed', lifecycle_id: 'edition-trash' } }), retired(), 'retiree'],
      [recette({ restored_from_edition: { edition_id: 'autre', lifecycle_id: 'edition-trash' } }), retired(), 'invalide'],
    ]) eq(C.lireEtatRecette(r, e).etat, attendu, 'L2 : état effectif propre/édition/exception');
  }
  await bloc('garde tardive de membre', async (repo, db) => {
    await seed(db, retired()); const avant = await db.getSnapshot(['recipes', 'recipe_versions', 'outbox']);
    eq(await motif(() => repo.saveBatch({ recipe_versions: [{ ...version, id: 'l2-tardive' }] }, { recettes: [rc()] })), 'edition_retiree', 'L2 : enfant refusé quand son livre a été retiré');
    eq(await db.getSnapshot(['recipes', 'recipe_versions', 'outbox']), avant, 'L2 : garde édition atomique sans enfant ni capture');
    await db.put('book_editions', edition({ lifecycle_id: 'edition-restored', trashed_at: null, trash_mode: null }), { origin: 'device' });
    eq(await motif(() => repo.save('recipes', recette({ favorite: true }), { recettes: [rc()] })), 'cycle_change', 'L2 : ancien geste refuse aussi après retour du livre');
  });
  await bloc('garder les membres et interdire les nouveaux', async (repo, db) => {
    await seed(db, retired('keep_recipes'));
    await repo.save('recipes', recette({ favorite: true }), { recettes: [rc({ expected_edition_cycle_id: 'edition-trash' })] });
    eq((await db.get('recipes', 'l2-r')).favorite, true, 'L2 : contenu du membre gardé modifiable avec la base exacte');
    eq(await motif(() => repo.saveBatch({ recipes: [recette({ id: 'l2-neuve', current_version_id: null })] }, { conditions: { recipes: [{ key: 'l2-neuve', absente: true }] }, editions: [ed({ expected_cycle_id: 'edition-trash' })] })), 'cycle_change', 'L2 : nouveau membre avec contextes de cycles incohérents refusé avant la création');
    eq(await motif(() => repo.saveBatch({ recipes: [recette({ id: 'l2-neuve', current_version_id: null })] }, { conditions: { recipes: [{ key: 'l2-neuve', absente: true }] }, recettes: [rc({ recipe_id: 'l2-neuve', expected_edition_cycle_id: 'edition-trash', creation: true })], editions: [ed({ expected_cycle_id: 'edition-trash' })] })), 'creation_refusee', 'L2 : nouveau membre refusé sous livre retiré keep_recipes avec contextes alignés');
    eq(await motif(() => repo.save('recipes', recette({ restored_from_edition: { edition_id: 'l2-ed', lifecycle_id: 'edition-trash' } }), { recettes: [rc({ expected_edition_cycle_id: 'edition-trash' })] })), 'cycle_reserve', 'L2 : exception réservée ne passe pas par put');
  });
  await bloc('garde compte et C09', async (repo, db) => {
    await seed(db, retired()); const avant = await db.getSnapshot(['books', 'book_editions', 'recipes']);
    eq(await motif(() => repo.removeBatch({ book_editions: ['l2-ed'], books: ['l2-book'] })), 'suppression_interdite', 'L2 : ancien C09 ne purge plus édition ni parent');
    eq(await motif(() => repo.remove('books', 'l2-book')), 'suppression_interdite', 'L2 : suppression isolée de book référencé refusée');
    eq(await db.getSnapshot(['books', 'book_editions', 'recipes']), avant, 'L2 : suppression refusée conserve toutes les relations');
    await db.put('sync_state', { key: 'user_id', value: 'nouveau' }, { origin: 'device' });
    eq(await motif(() => repo.capturerContexteEdition(retired(), { owner_id: 'ancien' })), 'compte_change', 'L2 : capture édition refuse nouveau propriétaire');
  });
  for (const [store, id] of [['recipes', 'l2-r'], ['recipe_versions', 'l2-v']]) for (const chemin of ['suppression', 'transition']) await bloc('contenu conservé après restauration ' + store + chemin, async (repo, db) => {
    const retour = edition({ lifecycle_id: 'edition-revenue', trashed_at: null, trash_mode: null });
    await seed(db, retour);
    await db.put('imports', { id: 'journal-suppression', status: 'a_verifier', kind: 'recette', recipe_id: 'l2-r', edition_id: retour.id }, { origin: 'remote' });
    const recettes = [await repo.capturerContexteRecette(recette(), { edition: retour })];
    const avant = await db.getSnapshot(['recipes', 'recipe_versions', 'imports', 'outbox']);
    let code = null;
    try {
      if (chemin === 'suppression') await repo.remove(store, id, { recettes });
      else await repo.transitionner('imports', 'journal-suppression', { attendus: ['a_verifier'], patch: { status: 'ignore' }, deletes: { [store]: [id] }, recettes });
    } catch (e) { code = e.code; }
    eq(code, 'suppression_interdite', `L2 ${chemin} : ${store} reste protégé après retour du livre, même sans cycle propre`);
    eq(await db.getSnapshot(['recipes', 'recipe_versions', 'imports', 'outbox']), avant, 'L2 suppression : aucun contenu, journal ou envoi perdu');
  });
  await bloc('nouvelles pages exclusives', async (repo, db) => {
    await seed(db, retired('keep_recipes'));
    const contexte = rc({ expected_edition_cycle_id: 'edition-trash' }), parent = ed({ expected_cycle_id: 'edition-trash', recipe_id: 'l2-r' });
    const ajout = await repo.ajouterPages([new File(['nouvelle page'], 'page.jpg', { type: 'image/jpeg' })], { edition_id: 'l2-ed', import: { id: 'l2-photo-import', kind: 'recette', recipe_id: 'l2-r', edition_id: 'l2-ed' }, recettes: [contexte], editions: [parent] });
    eq(ajout.session.recipe_ids, ['l2-r'], 'L2 : complément source rattaché exclusivement au membre');
    eq((await db.get('imports', 'l2-photo-import')).expected_edition_cycle_id, 'edition-trash', 'L2 : première page persiste base édition du journal');
    const avant = await db.getSnapshot(['source_pages', 'source_documents', 'files', 'outbox']);
    eq(await motif(() => repo.save('source_pages', { ...ajout.pages[0], printed_page: 8 }, { recettes: [contexte], editions: [parent] })), 'edition_retiree', 'L2 : page existante ne se modifie pas sous livre retiré');
    eq(await db.getSnapshot(['source_pages', 'source_documents', 'files', 'outbox']), avant, 'L2 : source conservée après refus');
    eq(await motif(() => repo.saveBatch({ source_pages: [{ ...ajout.pages[0], id: 'page-detour' }] }, { recettes: [contexte], editions: [parent] })), 'source_modifiee', 'L2 : pas de page nouvelle sous document existant par détour');
  });
  await bloc('métadonnées bibliographiques et rattachement', async (repo, db) => {
    await seed(db, retired('keep_recipes'));
    eq(await motif(() => repo.save('books', { id: 'l2-book', title: 'Ancien formulaire' })), 'edition_retiree', 'L2 : ancien éditeur book ne passe pas autour du cycle édition');
    await db.put('book_editions', edition({ id: 'l2-autre' }), { origin: 'device' });
    const cible = { edition_id: 'l2-autre', expected_cycle_id: null, owner_id: null };
    await repo.save('books', { id: 'l2-book', title: 'Autre édition active' }, { editions: [cible] });
    eq((await db.get('books', 'l2-book')).title, 'Autre édition active', 'L2 : bibliographie partagée reste modifiable depuis autre édition active');
    await repo.saveBatch({}, { recettes: [rc({ expected_edition_cycle_id: 'edition-trash' })], editions: [ed({ expected_cycle_id: 'edition-trash' }), cible], conditions: { recipes: [{ key: 'l2-r', fusion: r => ({ ...r, edition_id: 'l2-autre' }) }] } });
    const capture = (await db.getAll('outbox')).filter(e => e.store === 'recipes').at(-1);
    eq(capture.edition_contexts?.map(c => c.edition_id).sort(), ['l2-autre', 'l2-ed'], 'L2 : rattachement capture source et cible sur la même recette');
  });
  if (D) await bloc('commande et restauration individuelle', async (repo, db) => {
    await seed(db);
    await db.put('recipes', recette({ id: 'l2-deja', lifecycle_id: 'propre', trashed_at: at, current_version_id: null }), { origin: 'device' });
    const contexte = await repo.capturerContexteEdition(edition());
    const bilan = await D.preparerRetraitLivre(edition(), { repo, contexte });
    const trash = await D.mettreLivreALaCorbeille(edition(), { repo, contexte, bilan, mode: 'with_recipes', operationId: 'groupe-1', maintenant: () => at });
    eq([trash.edition.lifecycle_id, trash.edition.trash_mode], ['groupe-1', 'with_recipes'], 'L2 : commande retire édition seule avec son mode');
    eq((await db.get('recipes', 'l2-r')).lifecycle_id, undefined, 'L2 : aucun marqueur propre réécrit en cascade');
    const contextRecipe = await repo.capturerContexteRecette(recette(), { edition: trash.edition });
    const one = await D.restaurerRecetteDuLivre(recette(), { repo, contexte: contextRecipe, edition: trash.edition, operationId: 'membre-1', maintenant: () => at });
    eq(one.recipe.restored_from_edition, { edition_id: 'l2-ed', lifecycle_id: 'groupe-1' }, 'L2 : membre restauré conserve provenance et exception exacte');
    eq((await db.get('book_editions', 'l2-ed')).lifecycle_id, 'groupe-1', 'L2 : restauration individuelle ne restaure pas le parent');
    const restored = await D.restaurerLivre(trash.edition, { repo, contexte: await repo.capturerContexteEdition(trash.edition), operationId: 'groupe-2', maintenant: () => at });
    eq([restored.edition.trashed_at, restored.edition.trash_mode], [null, null], 'L2 : restauration garde jeton mais retire date et mode');
    eq((await db.get('recipes', 'l2-deja')).lifecycle_id, 'propre', 'L2 : retrait propre antérieur intact');
    const commands = (await db.getAll('outbox')).filter(e => e.op === 'lifecycle').map(e => [e.payload.entity, e.payload.action]);
    eq(commands, [['edition', 'trash'], ['recipe', 'restore_from_edition'], ['edition', 'restore']], 'L2 : trois commandes explicites capturées');
  });
  if (D) await bloc('bilan relu atomiquement', async (repo, db) => {
    await seed(db); const contexte = await repo.capturerContexteEdition(edition());
    const bilan = await D.preparerRetraitLivre(edition(), { repo, contexte });
    await db.put('imports', { id: 'l2-arrive', edition_id: 'l2-ed', status: 'inconnu' }, { origin: 'device' });
    eq(await motif(() => D.mettreLivreALaCorbeille(edition(), { repo, contexte, bilan, mode: 'with_recipes', operationId: 'refuse', maintenant: () => at })), 'bilan_change', 'L2 : import apparu impose nouveau bilan');
    eq((await db.get('book_editions', 'l2-ed')).lifecycle_id, undefined, 'L2 : bilan périmé ne retire rien');
    eq((await db.get('imports', 'l2-arrive')).edition_id, 'l2-ed', 'L2 : journal inconnu conservé sans détachement');
  });
}
