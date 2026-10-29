import { withDatabase } from './backup.js';
import { installCapture } from '../src/sync/outbox.js';
import { preparerLotSources, octetsLotSources, LIMITES_LOT_SOURCES } from '../src/sync/lot-sources.js';
import { createPush } from '../src/sync/push.js';
import { creerTransportFactice } from './transport-factice.js';

const at = '2026-10-29T12:00:00.000Z';
const recipe = { id: 'source-r', edition_id: 'source-ed', updated_at: at };
const edition = { id: 'source-ed', book_id: 'source-book', lifecycle_id: 'source-trash', trashed_at: at, trash_mode: 'keep_recipes', updated_at: at };
const session = { id: 'source-ss', edition_id: edition.id, recipe_ids: [recipe.id], document_ids: ['source-doc'], page_ids: ['source-page'], updated_at: at };
const doc = { id: 'source-doc', edition_id: edition.id, scan_session_id: session.id, sha256: 'a'.repeat(64), updated_at: at };
const page = { id: 'source-page', edition_id: edition.id, document_id: doc.id, sha256: doc.sha256, updated_at: at };
const puts = { scan_sessions: [session], source_documents: [doc], source_pages: [page] };
const records = Object.entries(puts).flatMap(([store, rows]) => rows.map(r => ({ store, id: r.id })));
const recettes = [{ recipe_id: recipe.id, expected_cycle_id: null, expected_edition_id: edition.id, expected_edition_cycle_id: edition.lifecycle_id, records }];
const editions = [{ edition_id: edition.id, expected_cycle_id: edition.lifecycle_id, recipe_id: recipe.id, records }];
const source_batch = { operation_id: 'source-operation', session_id: session.id, base_session: null };

export async function runL2SourcesSyncTests({ eq, ok }) {
  const bord = structuredClone({ puts, recettes, editions, source_batch });
  bord.puts.source_documents[0].texte = '';
  const libre = LIMITES_LOT_SOURCES.octets - octetsLotSources(preparerLotSources(bord));
  bord.puts.source_documents[0].texte = 'x'.repeat(libre);
  eq(octetsLotSources(preparerLotSources(bord)), 524288, 'L2 sources : borne JSONB exacte acceptée avant écriture');
  bord.puts.source_documents[0].texte += 'x';
  let refuse = false; try { preparerLotSources(bord); } catch { refuse = true; }
  ok(refuse, 'L2 sources : un octet au-delà de la borne refuse avant écriture');
  eq(octetsLotSources({ a: 1e21, b: 1e-7, c: ['é', 'a\"b'] }), new TextEncoder().encode('{"a": 1000000000000000000000, "b": 0.0000001, "c": ["é", "a\\\"b"]}').length, 'L2 sources : exposants, espaces et UTF8 mesurés comme JSONB');

  await withDatabase(async db => {
    await db.put('sync_state', { key: 'user_id', value: 'u' }, { origin: 'device' });
    installCapture(db, { getUserId: () => 'u' });
    await db.mutate({ puts, recettes, editions, source_batch });
    const file = await db.getAll('outbox');
    eq(file.length, 1, 'L2 sources : une intention atomique pour session, document et page');
    eq(file[0]?.op, 'source_batch', 'L2 sources : événement distinct des puts ordinaires');
    eq(file[0]?.payload?.rows?.length, 3, 'L2 sources : contenu complet figé dans l’intention');
    eq(file[0]?.payload?.base_edition_cycle_id, edition.lifecycle_id, 'L2 sources : base du livre conservée');
  });
  await withDatabase(async db => {
    await db.putBatch({ book_editions: [edition], recipes: [recipe], sync_state: [{ key: 'user_id', value: 'u' }] }, { origin: 'remote' });
    installCapture(db, { getUserId: () => 'u' });
    const serveur = creerTransportFactice({ serveur: true });
    await serveur.pousser([{ store: 'books', id: 'source-book', data: { id: 'source-book' }, updated_at: at },
      { store: 'book_editions', id: edition.id, data: edition, archive_import: true, updated_at: at },
      { store: 'recipes', id: recipe.id, data: recipe, archive_import: true, edition_contexts: [{ edition_id: edition.id, expected_cycle_id: edition.lifecycle_id }], updated_at: at }]);
    await db.mutate({ puts, recettes, editions, source_batch });
    const at2 = '2026-10-29T12:00:02.000Z', ss2 = { ...session, document_ids: [doc.id, 'source-doc2'], page_ids: [page.id, 'source-page2'], updated_at: at2 };
    const puts2 = { scan_sessions: [ss2], source_documents: [{ ...doc, id: 'source-doc2', updated_at: at2 }], source_pages: [{ ...page, id: 'source-page2', document_id: 'source-doc2', updated_at: at2 }] };
    await db.mutate({ puts: puts2, recettes, editions, source_batch: { ...source_batch, operation_id: 'source-operation2', base_session: session } });
    eq((await db.getAll('outbox')).length, 2, 'L2 sources : deux ajouts hors ligne gardent deux événements ordonnés');
    let perdre = true, horloge = Date.now();
    const transport = { async pousser(rows) {
      const normalises = rows.map(r => r.operation_id !== 'source-operation' ? r : { ...r, rows: r.rows.map(x => ({ ...x, updated_at: '2026-10-29T12:00:01.000Z', data: { ...x.data, updated_at: '2026-10-29T12:00:01.000Z' } })) });
      const resultat = await serveur.pousser(normalises);
      if (perdre) { perdre = false; return { erreur: { type: 'reseau' } }; } return resultat;
    } };
    const push = createPush({ db, transport, getUserId: () => 'u', maintenant: () => horloge });
    await push.envoyer();
    eq(serveur.ligne('scan_sessions', session.id)?.data.page_ids, [page.id], 'L2 sources : seul le premier groupe parti avant accusé perdu');
    eq((await db.getAll('outbox')).length, 2, 'L2 sources : accusé perdu conserve les deux événements');
    const seq = serveur.ligne('source_pages', page.id)?.server_seq;
    horloge += 3000; await push.envoyer();
    eq((await db.getAll('outbox')).map(e => e.payload.operation_id), ['source-operation2'], 'L2 sources : réessai accuse seulement la première opération');
    eq(serveur.ligne('source_pages', page.id)?.server_seq, seq, 'L2 sources : réessai ne double pas les sources');
    eq((await db.get('scan_sessions', session.id)).page_ids, [page.id, 'source-page2'], 'L2 sources : premier accusé ne remplace pas la séance plus récente');
    eq((await db.get('source_pages', page.id)).updated_at, '2026-10-29T12:00:01.000Z', 'L2 sources : heure serveur ajustée adoptée pour la page inchangée');
    await push.envoyer();
    eq((await db.getAll('outbox')).length, 0, 'L2 sources : deuxième opération acceptée malgré heure serveur de sa base');
    eq(serveur.ligne('scan_sessions', session.id)?.data.page_ids, [page.id, 'source-page2'], 'L2 sources : deux ajouts complets sur la même séance');
    eq((await db.getAll('sync_conflicts')).length, 0, 'L2 sources : aucun faux conflit après deux ajouts et accusé perdu');
  });
  await withDatabase(async db => {
    await db.putBatch({ book_editions: [edition], recipes: [recipe], sync_state: [{ key: 'user_id', value: 'u' }] }, { origin: 'remote' });
    installCapture(db, { getUserId: () => 'u' }); await db.mutate({ puts, recettes, editions, source_batch });
    const serveur = creerTransportFactice({ serveur: true });
    // Le parent divergent suffit à refuser : aucune partie du groupe n'est acceptée.
    await serveur.pousser([{ store: 'book_editions', id: edition.id, data: { ...edition, lifecycle_id: 'nouveau-retrait' }, archive_import: true, updated_at: at },
      { store: 'recipes', id: recipe.id, data: recipe, archive_import: true, edition_contexts: [{ edition_id: edition.id, expected_cycle_id: 'nouveau-retrait' }], updated_at: at }]);
    await createPush({ db, transport: serveur, getUserId: () => 'u' }).envoyer();
    eq([serveur.ligne('source_pages', page.id), serveur.ligne('source_documents', doc.id), serveur.ligne('scan_sessions', session.id)], [null, null, null], 'L2 sources : refus parent sans session, page ou document partiels');
    ok((await db.getAll('outbox'))[0]?.lifecycle_blocked, 'L2 sources : groupe refusé conservé pour relecture');
    eq((await db.getAll('sync_conflicts'))[0]?.local?.rows?.length, 3, 'L2 sources : copie complète du groupe disponible après refus');
  });

}
