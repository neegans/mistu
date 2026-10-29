import { withDatabase } from './backup.js';
import { envoiInitial } from '../src/sync/backfill.js';
import { createMoteur } from '../src/sync/moteur.js';
import { createPush } from '../src/sync/push.js';
import { createPull } from '../src/sync/pull.js';
import { installCapture } from '../src/sync/outbox.js';
import { creerTransportFactice } from './transport-factice.js';
import { createArchive, inspectArchive, applyArchive } from '../src/domain/backup.js';
import { capturerContextesInitiaux } from '../src/sync/contexte-initial.js';
import { lireEtatRecette } from '../src/domain/cycle-edition.js';
import { creerStockageFactice } from './stockage-factice.js';
import { sha256Hex } from '../src/core/hash.js';
import { garderIci, garderAilleurs } from '../src/sync/conflits.js';

const at = '2026-10-29T12:00:00.000Z';
const livre = { id: 'reprise-book', title: 'Pain', updated_at: at };
const edition = { id: 'reprise-ed', book_id: livre.id, updated_at: at };
const recipe = { id: 'reprise-r', edition_id: edition.id, original_title: 'Pain', updated_at: at };
const retiree = { ...edition, lifecycle_id: 'edition-trash', trashed_at: at, trash_mode: 'with_recipes' };
const command = { entity: 'edition', edition_id: edition.id, operation_id: 'edition-trash', base_cycle_id: null, action: 'trash', at, mode: 'with_recipes', seed: edition };
const run = async (ok, nom, fn) => { try { await fn(); } catch (e) { ok(false, nom + ' : ' + (e.stack || e)); } };
const user = db => db.put('sync_state', { key: 'user_id', value: 'u' }, { origin: 'device' });

export async function runL2SyncRepriseTests({ eq, ok }) {
  await run(ok, 'Contextes premier envoi', () => withDatabase(async db => {
    await user(db);
    await db.putBatch({ books: [livre], book_editions: [retiree], recipes: [recipe], recipe_versions: [{ id: 'reprise-v', recipe_id: recipe.id, updated_at: at }],
      meals: [{ id: 'reprise-m', items: [{ recipe_version_id: 'reprise-v' }], updated_at: at }],
      source_documents: [{ id: 'reprise-d', edition_id: edition.id, updated_at: at }], source_pages: [{ id: 'reprise-p', document_id: 'reprise-d', updated_at: at }] }, { origin: 'remote' });
    await envoiInitial({ db, getUserId: () => 'u' });
    const file = await db.getAll('outbox'), pour = store => file.find(e => e.store === store);
    eq(pour('book_editions')?.edition_contexts, [{ edition_id: edition.id, expected_cycle_id: 'edition-trash' }], 'L2 initial : base exacte de l’édition archivée');
    eq(pour('recipes')?.expected_edition_id, edition.id, 'L2 initial : association de la recette capturée');
    eq(pour('recipe_versions')?.edition_contexts?.[0]?.expected_cycle_id, 'edition-trash', 'L2 initial : enfant soumis au cycle parent');
    eq(pour('meals')?.recipe_id, recipe.id, 'L2 initial : recette déduite de la version du repas');
    eq(pour('source_pages')?.edition_contexts?.[0]?.edition_id, edition.id, 'L2 initial : édition déduite du document de la page');
    ok(file.filter(e => ['book_editions', 'recipes', 'recipe_versions', 'meals', 'source_pages'].includes(e.store)).every(e => e.snapshot && e.archive_import), 'L2 initial : instantanés immuables et origine archive explicites');
    await db.put('recipes', { ...recipe, original_title: 'Après capture' }, { origin: 'remote' });
    eq((await db.getAll('outbox')).find(e => e.store === 'recipes')?.snapshot?.original_title, 'Pain', 'L2 initial : contenu capturé inchangé après modification locale');
  }));
  await run(ok, 'Anciennes entrées sans base', () => withDatabase(async db => {
    await user(db);
    const old = { user_id: 'u', store: 'recipes', id: recipe.id, op: 'put', updated_at: at, tries: 0 };
    await db.putBatch({ books: [livre], book_editions: [edition], recipes: [recipe], outbox: [old] }, { origin: 'remote' });
    await envoiInitial({ db, getUserId: () => 'u' });
    const entries = (await db.getAll('outbox')).filter(e => e.store === 'recipes');
    eq(entries.length, 1, 'L2 ancien : aucune seconde intention ajoutée à la même recette');
    eq(entries[0].expected_edition_id, edition.id, 'L2 ancien initial : association enrichie sur parent jamais cyclé');
    eq(entries[0].edition_contexts?.[0]?.expected_cycle_id, null, 'L2 ancien initial : base parent initiale explicite');
    eq(entries[0].snapshot?.original_title, 'Pain', 'L2 ancien initial : instantané figé avant envoi');
  }));
  await run(ok, 'Ancienne intention après retrait', () => withDatabase(async db => {
    await user(db);
    const old = { user_id: 'u', store: 'recipes', id: recipe.id, op: 'put', updated_at: at, tries: 0 };
    await db.putBatch({ books: [livre], book_editions: [retiree], recipes: [recipe], outbox: [old] }, { origin: 'remote' });
    await envoiInitial({ db, getUserId: () => 'u' });
    const entries = (await db.getAll('outbox')).filter(e => e.store === 'recipes');
    eq(entries.length, 1, 'L2 ancien périmé : une seule intention conservée');
    eq(entries[0].lifecycle_blocked, true, 'L2 ancien périmé : aucune adoption du cycle parent actuel');
    ok(!entries[0].edition_contexts, 'L2 ancien périmé : pas de base inventée pour réessayer');
    eq((await db.getAll('sync_conflicts')).find(c => c.record_id === recipe.id)?.kind, 'cycle', 'L2 ancien périmé : copie disponible pour relecture');
  }));
  await run(ok, 'Seed prouvant le premier parent', () => withDatabase(async db => {
    await user(db);
    await db.putBatch({ books: [livre], book_editions: [retiree], recipes: [recipe], outbox: [
      { seq: 1, user_id: 'u', store: 'book_editions', id: edition.id, op: 'put', updated_at: at, tries: 0 },
      { seq: 2, user_id: 'u', store: 'recipes', id: recipe.id, op: 'put', updated_at: at, tries: 0 },
      { seq: 3, user_id: 'u', store: 'book_editions', id: edition.id, op: 'lifecycle', payload: command }
    ] }, { origin: 'remote' });
    await envoiInitial({ db, getUserId: () => 'u' });
    const entries = await db.getAll('outbox'), parent = entries.find(e => e.store === 'book_editions' && e.op === 'put'), enfant = entries.find(e => e.store === 'recipes');
    eq(parent?.snapshot?.lifecycle_id ?? null, null, 'L2 seed : premier parent conserve son état initial');
    eq(parent?.edition_contexts?.[0]?.expected_cycle_id, null, 'L2 seed : cycle parent initial prouvé');
    eq(enfant?.edition_contexts?.[0]?.expected_cycle_id, null, 'L2 seed : membre précommande garde la base initiale');
    eq(entries.find(e => e.op === 'lifecycle')?.payload, command, 'L2 seed : commande originale inchangée');
  }));
  await run(ok, 'Drainage des dépendances', () => withDatabase(async db => {
    await user(db); installCapture(db, { getUserId: () => 'u' });
    await db.mutate({ puts: { books: [livre], book_editions: [edition], recipes: [recipe] }, origin: 'local',
      recettes: [{ recipe_id: recipe.id, expected_cycle_id: null, expected_edition_id: edition.id, records: [{ store: 'recipes', id: recipe.id }] }],
      editions: [{ edition_id: edition.id, expected_cycle_id: null, records: [{ store: 'book_editions', id: edition.id }, { store: 'recipes', id: recipe.id }] }] });
    await db.mutate({ puts: { book_editions: [retiree] }, lifecycle: command, origin: 'local' });
    const transport = creerTransportFactice({ serveur: true });
    const moteur = createMoteur({ db, transport, getUserId: () => 'u', delaiRegroupementMs: 1 });
    try {
      await moteur.executer();
      eq((await db.getAll('outbox')).length, 0, 'L2 moteur : un déclenchement draine les dépendances acceptées');
      eq(transport.ligne('book_editions', edition.id)?.data?.lifecycle_id, command.operation_id, 'L2 moteur : commande finale effectivement acceptée');
      eq(transport.ligne('recipes', recipe.id)?.data?.original_title, 'Pain', 'L2 moteur : membre initial envoyé avant retrait');
      const seq = transport.ligne('book_editions', edition.id)?.server_seq;
      await moteur.executer();
      eq(transport.ligne('book_editions', edition.id)?.server_seq, seq, 'L2 moteur : passe suivante sans renvoi du groupe');
    } finally { await moteur.arreter(); }
  }));
  await run(ok, 'Ancien conflit d’enfant', () => withDatabase(async db => {
    await user(db);
    const version = { id: 'reprise-v', recipe_id: recipe.id, updated_at: at, steps: ['Conservée'] };
    await db.putBatch({ books: [livre], book_editions: [retiree], recipes: [recipe], recipe_versions: [version] }, { origin: 'remote' });
    const c = { id: 'recipe_versions:reprise-v', store: 'recipe_versions', record_id: version.id, kind: 'donnees', local: { ...version, steps: ['Ancienne modification'] }, server: { data: version, updated_at: at }, recipe_contexts: [{ recipe_id: recipe.id, expected_cycle_id: null }] };
    await db.put('sync_conflicts', c, { origin: 'remote' });
    eq(await garderIci(db, c), false, 'L2 conflit : ancien enfant ne contourne pas le retrait du livre');
    eq(await garderAilleurs(db, c), false, 'L2 conflit : ancienne copie distante ne contourne pas le retrait du livre');
    eq((await db.get('recipe_versions', version.id)).steps, ['Conservée'], 'L2 conflit : contenu et copie préservés');
  }));
  await run(ok, 'Écho antérieur à un état confirmé', () => withDatabase(async db => {
    await user(db);
    const revenu = { ...edition, lifecycle_id: 'retour-confirme', trashed_at: null, trash_mode: null, updated_at: '2026-10-29T13:00:00.000Z' };
    await db.putBatch({ book_editions: [revenu], sync_state: [{ key: 'edition-lifecycle:' + edition.id, value: { user_id: 'u', data: revenu, server_seq: 20 } }] }, { origin: 'remote' });
    const transport = creerTransportFactice({ lire: { book_editions: [[{ id: edition.id, data: retiree, updated_at: at, deleted_at: null, server_seq: 10 }], []] } });
    await createPull({ db, transport, getUserId: () => 'u' }).recevoir();
    eq((await db.get('book_editions', edition.id)).lifecycle_id, 'retour-confirme', 'L2 confirmation : ancien écho ne défait pas le retour déjà confirmé');
    eq((await db.get('sync_state', 'edition-lifecycle:' + edition.id)).value.server_seq, 20, 'L2 confirmation : ancien écho ne recule pas la base confirmée');
    eq((await db.getAll('sync_conflicts')).length, 0, 'L2 confirmation : ancien écho ne crée pas de conflit fictif');
  }));
  await run(ok, 'Confirmation concurrente avec réception et accusé', () => withDatabase(async db => {
    await user(db);
    const cle = 'edition-lifecycle:' + edition.id, revenu = { ...edition, lifecycle_id: 'retour-concurrent', trashed_at: null, trash_mode: null, updated_at: '2026-10-29T13:00:00.000Z' };
    await db.putBatch({ book_editions: [retiree], sync_state: [{ key: cle, value: { user_id: 'u', data: retiree, server_seq: 10 } }] }, { origin: 'remote' });
    const mutate = db.mutate.bind(db); let injecter = true;
    db.mutate = async options => {
      if (injecter && options.origin === 'remote' && options.conditions?.sync_state?.some(c => c.key === cle)) {
        injecter = false;
        await mutate({ puts: { book_editions: [revenu], sync_state: [{ key: cle, value: { user_id: 'u', data: revenu, server_seq: 30 } }] }, origin: 'remote' });
      }
      return mutate(options);
    };
    const ligne = { id: edition.id, data: retiree, updated_at: at, deleted_at: null, server_seq: 20 };
    await createPull({ db, transport: creerTransportFactice({ lire: { book_editions: [[ligne], []] } }), getUserId: () => 'u' }).recevoir();
    eq([(await db.get('book_editions', edition.id)).lifecycle_id, (await db.get('sync_state', cle)).value.server_seq], ['retour-concurrent', 30], 'L2 réception : confirmation arrivée entre lecture et transaction préservée ensemble');
    eq((await db.getAll('sync_conflicts')).length, 0, 'L2 réception : relecture transactionnelle sans conflit artificiel');
    await mutate({ puts: { book_editions: [retiree], outbox: [{ user_id: 'u', store: 'book_editions', id: edition.id, op: 'lifecycle', payload: command }], sync_state: [{ key: cle, value: { user_id: 'u', data: retiree, server_seq: 10 } }] }, origin: 'remote' });
    injecter = true;
    const transport = { async pousser() { return { reponse: { accepted: [{ store: 'book_editions', id: edition.id, operation_id: command.operation_id, server: ligne }], rejected: [], adjusted: [], server_time: at }, erreur: null }; } };
    await createPush({ db, transport, getUserId: () => 'u' }).envoyer();
    eq([(await db.get('book_editions', edition.id)).lifecycle_id, (await db.get('sync_state', cle)).value.server_seq], ['retour-concurrent', 30], 'L2 accusé : confirmation concurrente ne régresse ni fiche ni base');
    eq((await db.getAll('outbox')).length, 0, 'L2 accusé : seule opération exactement accusée retirée après relecture');
  }));
  await run(ok, 'Trois moteurs et plus de 500 membres', () => withDatabase(async a => withDatabase(async b => withDatabase(async c => {
    const serveur = creerTransportFactice({ serveur: true }), stockage = creerStockageFactice(), moteurs = [];
    const moteur = db => { const m = createMoteur({ db, transport: serveur, stockage, getUserId: () => 'u', qualite: () => 'originale' }); moteurs.push(m); return m; };
    const photo = new Blob(['Photo de pain L2 conservée sur trois appareils'], { type: 'image/jpeg' }), sha = await sha256Hex(photo);
    const membres = Array.from({ length: 501 }, (_, i) => ({ id: 'volume-r-' + i, edition_id: edition.id, original_title: 'Pain ' + i, current_version_id: 'volume-v-' + i, updated_at: at, ...(i === 0 ? { photo_sha256: sha } : {}) }));
    const versions = membres.map((r, i) => ({ id: r.current_version_id, recipe_id: r.id, kind: 'extraction', status: 'accepted', ingredients: [], steps: [], updated_at: at }));
    const batch = { books: [livre], book_editions: [edition], recipes: membres, recipe_versions: versions };
    const poser = async (db, operation_id, action, mode = 'with_recipes') => {
      const courant = await db.get('book_editions', edition.id), payload = { entity: 'edition', edition_id: edition.id, operation_id, base_cycle_id: courant.lifecycle_id ?? null, action, at,
        ...(action === 'trash' ? { mode, seed: courant } : {}) };
      await db.mutate({ puts: { book_editions: [{ ...courant, lifecycle_id: operation_id, trashed_at: action === 'trash' ? at : null, trash_mode: action === 'trash' ? mode : null }] }, lifecycle: payload, origin: 'local' });
    };
    try {
      for (const db of [a, b]) { await user(db); installCapture(db, { getUserId: () => 'u' }); }
      await a.mutate({ puts: batch, ...capturerContextesInitiaux(batch, { owner_id: 'u' }), origin: 'local' });
      await a.put('files', { sha256: sha, blob: photo, mime: photo.type, size: photo.size, updated_at: at, syncable: true }, { origin: 'remote' });
      await poser(a, 'volume-initial-trash', 'trash');
      const ma = moteur(a), mb = moteur(b);
      await ma.executer(); await ma.executer(); await mb.executer(); await mb.telecharger([sha]);
      eq(serveur.ligne('book_editions', edition.id)?.data.lifecycle_id, 'volume-initial-trash', 'L2 volume : retrait initial accusé après publication des membres');
      eq((await b.getAll('recipes')).length, 501, 'L2 volume : 501 membres reçus au second appareil');
      ok((await b.getAll('recipes')).every(r => lireEtatRecette(r, retiree).etat === 'retiree'), 'L2 volume : réception du parent exclut tous ses membres sans cascade');
      const lots = serveur.journal.filter(x => x.appel === 'pousser');
      ok(lots.every(x => x.rows.length <= 500) && lots.filter(x => x.rows.some(r => r.store === 'recipes')).length >= 2, 'L2 volume : découpage réel en plusieurs lots bornés');
      eq(lots.flatMap(x => x.rows).filter(r => r.op === 'lifecycle' && r.store === 'recipes').length, 0, 'L2 volume : aucune commande de cycle enfant en cascade');
      eq(await (await b.get('files', sha)).blob.text(), await photo.text(), 'L2 volume : photo réellement transférée au second appareil');
      const archive = await inspectArchive(await (await createArchive(a)).blob.arrayBuffer());
      ok(archive.ok && archive.manifest.format_version === 3, 'L2 volume : archive3 du groupe entier valide');
      await poser(b, 'volume-restore-b', 'restore'); await mb.executer();
      installCapture(c, { getUserId: () => null }); await applyArchive(c, archive); await user(c); installCapture(c, { getUserId: () => 'u' });
      const mc = moteur(c); await mc.executer(); await ma.executer();
      eq([(await a.get('book_editions', edition.id)).lifecycle_id, (await b.get('book_editions', edition.id)).lifecycle_id, (await c.get('book_editions', edition.id)).lifecycle_id], ['volume-restore-b', 'volume-restore-b', 'volume-restore-b'], 'L2 trois moteurs : archive divergente adopte la restauration confirmée sans la remplacer');
      ok((await c.getAll('sync_conflicts')).some(x => x.store === 'book_editions' && x.kind === 'cycle'), 'L2 archive connectée : ancienne copie parent conservée en conflit');
      ok(!(await c.getAll('outbox')).some(e => e.op === 'lifecycle'), 'L2 archive connectée : aucune commande reconstituée depuis les marqueurs');
      for (const [nom, db] of [['A', a], ['B', b], ['C', c]]) eq(await (await db.get('files', sha)).blob.text(), await photo.text(), 'L2 photo ' + nom + ' intacte après archive et convergence');
    } finally { await Promise.all(moteurs.map(m => m.arreter())); }
  }))));

}
