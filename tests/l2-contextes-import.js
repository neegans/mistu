import { withRepo } from './sync-fixture.js';

export async function runL2ContextesImportTests({ eq, ok }) {
  const I = await import('../src/domain/contexte-import.js');
  const motif = fn => { try { fn(); return null; } catch (e) { return e.code || e.message; } };
  const capture = { edition_id: 'livre-source', expected_cycle_id: 'retour-1', owner_id: 'a', contexteValide: () => true };
  const row = { edition_id: 'livre-source', expected_edition_id: 'livre-source', expected_edition_cycle_id: 'retour-1', owner_id: 'a' };
  eq(motif(() => I.verifierCaptureEditionImport(row, capture)), null, 'L2 journal livre : même édition, même cycle et même compte acceptés');
  for (const [patch, code] of [
    [{ edition_id: 'autre' }, 'cycle_change'],
    [{ expected_cycle_id: 'retour-2' }, 'cycle_change'],
    [{ owner_id: 'b' }, 'compte_change'],
    [{ contexteValide: () => false }, 'compte_change'],
  ]) eq(motif(() => I.verifierCaptureEditionImport(row, { ...capture, ...patch })), code, 'L2 journal livre : nouvelle base refusée sans reprise silencieuse');
  eq(motif(() => I.verifierCaptureEditionImport(row, null)), 'contexte_change', 'L2 journal livre : absence de capture ne vaut pas autorisation');
  await withRepo(async (repo, db) => {
    const livre = { id: 'livre-restaure', lifecycle_id: 'cycle-restaure', trashed_at: null, trash_mode: null };
    await db.mutate({ puts: { book_editions: [livre] }, origin: 'remote' });
    const contexte = await repo.capturerContexteEdition(livre);
    const journal = await repo.ouvrirImport({ kind: 'index', edition_id: livre.id, editions: [contexte] });
    eq(motif(() => I.verifierCaptureEditionImport(journal, contexte)), null, 'L2 journal livre : ouverture mémorise la base du livre restauré');
  });
  await withRepo(async (repo, db) => {
    const avant = await db.getSnapshot(['imports', 'outbox']); let refuse = false;
    try { await repo.ouvrirImport({ kind: 'index', conditions: { sync_state: [{ key: 'user_id', fusion: () => { throw Error('compte changé'); } }] } }); } catch { refuse = true; }
    ok(refuse, 'L2 journal libre : propriétaire capturé contrôlé à l’ouverture');
    eq(await db.getSnapshot(['imports', 'outbox']), avant, 'L2 journal libre : refus sans journal ni capture au nouveau compte');
  });
  for (const mode of ['seance', 'nouvel_import', 'import_existant']) await withRepo(async (repo, db) => {
    const session = { id: 'seance-test', edition_id: null, status: 'open', page_ids: [], document_ids: [] };
    const journal = { id: 'journal-test', kind: 'recette', status: 'a_lancer', page_ids: [], scan_session_id: session.id };
    await db.mutate({ puts: { scan_sessions: [session], ...(mode === 'import_existant' ? { imports: [journal] } : {}) }, origin: 'remote' });
    const avant = await db.getSnapshot(['files', 'source_documents', 'source_pages', 'scan_sessions', 'imports', 'outbox']);
    let refuse = false;
    try {
      await repo.ajouterPages([new File(['image témoin'], 'photo.jpg', { type: 'image/jpeg' })], {
        session_id: session.id,
        ...(mode === 'nouvel_import' ? { import: { id: journal.id, kind: journal.kind } } : mode === 'import_existant' ? { import_id: journal.id } : {}),
        conditions: { scan_sessions: [{ key: session.id, fusion: () => { throw Error('séance modifiée pendant le choix des photos'); } }] },
      });
    } catch { refuse = true; }
    ok(refuse, `L2 pages ${mode} : la condition de séance est appliquée`);
    eq(await db.getSnapshot(['files', 'source_documents', 'source_pages', 'scan_sessions', 'imports', 'outbox']), avant, `L2 pages ${mode} : refus atomique sans octet orphelin ni envoi`);
  });
  await withRepo(async (repo, db) => {
    const ajout = await repo.ajouterPages([new File(['photo acceptée'], 'photo.jpg', { type: 'image/jpeg' })]);
    const file = await repo.getFile(ajout.pages[0].sha256);
    eq(await file.blob.text(), 'photo acceptée', 'L2 pages : témoin sans édition conserve les octets');
    eq((await db.get('scan_sessions', ajout.session.id)).page_ids, [ajout.pages[0].id], 'L2 pages : témoin conserve les liens atomiques');
  });
  for (const limite of ['lignes', 'octets']) await withRepo(async (repo, db) => {
    const edition = { id: 'livre-limite', lifecycle_id: 'livre-retire', trashed_at: '2026-10-29T12:00:00.000Z', trash_mode: 'keep_recipes' };
    const recipe = { id: 'recette-limite', edition_id: edition.id, original_title: 'Pain' };
    await db.mutate({ puts: { book_editions: [edition], recipes: [recipe] }, origin: 'remote' });
    const recettes = [await repo.capturerContexteRecette(recipe, { edition })];
    const editions = [await repo.capturerContexteEdition(edition, { recipe_id: recipe.id })];
    // Le refus doit précéder l’écriture même quand le crochet de synchronisation n’est pas installé.
    db.onMutate = null;
    const magasins = ['files', 'source_documents', 'source_pages', 'scan_sessions', 'imports', 'outbox'];
    const avant = await db.getSnapshot(magasins);
    const fichiers = limite === 'lignes' ? Array.from({ length: 250 }, (_, i) => new File(['page'], `page-${i}.jpg`, { type: 'image/jpeg' }))
      : [new File(['page'], 'a'.repeat(524288) + '.jpg', { type: 'image/jpeg' })];
    let erreur = null;
    try { await repo.ajouterPages(fichiers, { edition_id: edition.id, recettes, editions }); } catch (e) { erreur = e; }
    eq(erreur?.message, 'Lot de sources incomplet, modifié ou trop volumineux', `L2 pages : limite ${limite} refusée au motif exact sans capture`);
    eq(await db.getSnapshot(magasins), avant, `L2 pages : limite ${limite} sans fichier, lien ni journal partiel`);
  });
  for (const exclusif of [false, true]) await withRepo(async (repo, db) => {
    const edition = { id: 'livre-concurrent' }, recipe = { id: 'recette-concurrente', edition_id: edition.id };
    const session = { id: 'seance-concurrente', edition_id: edition.id, document_ids: [], page_ids: [], ...(exclusif ? { recipe_ids: [recipe.id] } : {}) };
    await db.mutate({ puts: { book_editions: [edition], recipes: [recipe], scan_sessions: [session] }, origin: 'remote' });
    const recettes = exclusif ? [await repo.capturerContexteRecette(recipe, { edition })] : [];
    const editions = [await repo.capturerContexteEdition(edition, { recipe_id: exclusif ? recipe.id : null })];
    const mutate = db.mutate.bind(db); let suspendu = true, concurrent = null;
    const magasins = ['scan_sessions', 'source_pages', 'source_documents', 'files', 'outbox'];
    db.mutate = async args => {
      if (suspendu && args.origin === 'local') {
        suspendu = false;
        await mutate({ puts: { scan_sessions: [{ ...session, page_ids: ['page-arrivee'], document_ids: ['doc-arrive'] }],
          source_documents: [{ id: 'doc-arrive', edition_id: edition.id, scan_session_id: session.id }],
          source_pages: [{ id: 'page-arrivee', document_id: 'doc-arrive', edition_id: edition.id }] }, origin: 'remote' });
        concurrent = await db.getSnapshot(magasins);
      }
      return mutate(args);
    };
    let erreur = null;
    try { await repo.ajouterPages([new File(['ma page'], 'page.jpg', { type: 'image/jpeg' })], { session_id: session.id, edition_id: edition.id, recettes, editions }); } catch (e) { erreur = e.code; }
    eq(erreur, 'source_modifiee', `L2 séance ${exclusif ? 'exclusive' : 'partagée'} : ajout concurrent détecté à l’écriture`);
    eq(await db.getSnapshot(magasins), concurrent, 'L2 séance : pages concurrentes toujours liées, aucun octet ni envoi du geste refusé');
  });
}
