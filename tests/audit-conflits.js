import { withDatabase } from './backup.js';
import * as conflits from '../src/sync/conflits.js';

const DATE = '2026-10-30T00:00:00.000Z';
const erreurDe = async fn => { try { await fn(); return null; } catch (e) { return e; } };

export async function runAuditConflitsTests({ eq, ok }) {
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, nom + ' : ' + (e.stack || e)); } };
  const installer = async (db, store, local, distant, id = local?.id || distant.id) => {
    const conflit = { id: store + ':' + id, store, record_id: id, kind: 'donnees', user_id: 'u1',
      local, server: { data: distant, updated_at: DATE, deleted_at: null }, at: DATE };
    await db.mutate({ origin: 'remote', puts: { sync_state: [{ key: 'user_id', value: 'u1' }],
      ...(local ? { [store]: [local] } : {}), sync_conflicts: [conflit] } });
    return conflit;
  };
  for (const ici of [true, false]) await run('audit B1 : conflit de recette ' + (ici ? 'ici' : 'ailleurs'), () => withDatabase(async db => {
    const local = { id: 'r1', title: 'Ici', edition_id: null, updated_at: DATE }, distant = { ...local, title: 'Ailleurs' };
    const c = await installer(db, 'recipes', local, distant);
    eq(await (ici ? conflits.garderIci : conflits.garderAilleurs)(db, c), true, 'audit B1 : garder' + (ici ? 'Ici' : 'Ailleurs') + ' tranche un conflit recipes');
    eq((await db.get('recipes', local.id)).title, ici ? 'Ici' : 'Ailleurs', 'audit B1 : la recette choisie est réellement écrite');
    eq(await db.get('sync_conflicts', c.id), undefined, 'audit B1 : conflit de recette résolu retiré atomiquement');
  }));
  await run('audit B1 : conflit recipes sans version locale', () => withDatabase(async db => {
    const c = await installer(db, 'recipes', null, { id: 'r1', title: 'Ailleurs', edition_id: null, updated_at: DATE });
    eq(await conflits.garderIci(db, c), true, 'audit B1 : garder la suppression locale reste possible');
    eq(await db.get('recipes', 'r1'), undefined, 'audit B1 : la fiche supprimée ici ne revient pas');
    eq(await db.get('sync_conflicts', c.id), undefined, 'audit B1 : conflit sans version locale résolu');
  }));
  for (const [store, local, distant] of [
    ['imports', { id: 'i1', kind: 'thermomix', recipe_id: 'r1', status: 'a_verifier', resultat: { texte: 'Ici' }, updated_at: DATE },
      { id: 'i1', kind: 'thermomix', recipe_id: 'r1', status: 'a_verifier', resultat: { texte: 'Ailleurs' }, updated_at: DATE }],
    ['book_editions', { id: 'e1', title: 'Ici', updated_at: DATE }, { id: 'e1', title: 'Ailleurs', updated_at: DATE }],
  ]) await run('audit B1 : conflit ' + store, () => withDatabase(async db => {
    const c = await installer(db, store, local, distant);
    eq(await conflits.garderAilleurs(db, c), true, 'audit B1 : garderAilleurs tranche le conflit ' + store);
    eq(await db.get(store, local.id), distant, 'audit B1 : la copie distante ' + store + ' est réellement écrite');
    eq(await db.get('sync_conflicts', c.id), undefined, 'audit B1 : conflit ' + store + ' retiré après écriture');
  }));
  await run('audit B1 : purge de plusieurs conflits', () => withDatabase(async db => {
    const vieux = ['b1', 'b2'].map(id => ({ id: 'books:' + id, store: 'books', record_id: id, kind: 'donnees', at: '2020-01-01T00:00:00.000Z' }));
    await db.mutate({ origin: 'remote', puts: { sync_conflicts: vieux } });
    eq(await conflits.purgerAnciens(db, Date.parse(DATE)), 2, 'audit B1 : purgerAnciens retire deux conflits ordinaires anciens');
    eq(await db.getAll('sync_conflicts'), [], 'audit B1 : les deux conflits anciens sont réellement retirés');
  }));
  await run('audit B1 : fusion de gardes', async () => {
    const { fusionnerConditions } = conflits;
    if (typeof fusionnerConditions !== 'function') throw Error('fusionnerConditions absente');
    const ordre = [], row = { key: 'user_id', value: 'u1' }, lecture = () => row;
    const premiere = { sync_state: [{ key: 'user_id', fusion: (courant, lire) => { ordre.push('a'); eq([courant, lire()], [row, row], 'audit B1 : première garde reçoit la lecture transactionnelle'); return null; } }] };
    const seconde = { sync_state: [{ key: 'user_id', fusion: (courant, lire) => { ordre.push('b'); eq([courant, lire()], [row, row], 'audit B1 : seconde garde reçoit le même instantané'); throw Error('seconde garde'); } }] };
    const fusion = fusionnerConditions(premiere, seconde);
    eq(fusion.sync_state.length, 1, 'audit B1 : une seule condition par fiche après fusion');
    eq((await erreurDe(() => fusion.sync_state[0].fusion(row, lecture)))?.message, 'seconde garde', 'audit B1 : la seconde garde reste discriminante');
    eq(ordre, ['a', 'b'], 'audit B1 : les deux gardes sont exécutées dans leur ordre');
    eq([premiere.sync_state.length, seconde.sync_state.length, premiere.sync_state[0] === fusion.sync_state[0]], [1, 1, false], 'audit B1 : les conditions d’entrée restent intactes');
    const compte = [], magasins = fusionnerConditions({ outbox: [{ toutes: true, verifier: rows => compte.push(['a', rows.length]) }] },
      { outbox: [{ toutes: true, verifier: rows => compte.push(['b', rows.length]) }] });
    eq(magasins.outbox.length, 1, 'audit B1 : deux gardes de magasin donnent une seule condition');
    magasins.outbox[0].verifier([{}]);
    eq(compte, [['a', 1], ['b', 1]], 'audit B1 : les deux vérifications du magasin sont conservées');
    const asynchrone = fusionnerConditions({ outbox: [{ toutes: true, verifier: async () => true }] }, { outbox: [{ toutes: true, verifier: () => null }] });
    eq((await erreurDe(() => asynchrone.outbox[0].verifier([])))?.message, 'Une vérification transactionnelle reste synchrone', 'audit B1 : la composition ne masque pas une vérification asynchrone refusée');
    const differentes = fusionnerConditions({ sync_state: [{ key: 'a', fusion: () => null }] }, { sync_state: [{ key: 'b', fusion: () => null }], books: [{ key: 'a', fusion: () => null }] });
    eq([differentes.sync_state.map(c => c.key), differentes.books.map(c => c.key)], [['a', 'b'], ['a']], 'audit B1 : les autres clés et magasins restent distincts');
  });
  await run('audit B1 : effets et refus atomiques des fusions', () => withDatabase(async db => {
    const { fusionnerConditions } = conflits;
    if (typeof fusionnerConditions !== 'function') throw Error('fusionnerConditions absente');
    const row = { id: 'b1', title: 'Avant' };
    await db.put('books', row, { origin: 'remote' });
    const garde = { books: [{ key: row.id, fusion: (courant, lire) => { eq(courant.title, 'Avant', 'audit B1 : une garde après une écriture voit encore le courant transactionnel'); eq(lire('books', row.id), row, 'audit B1 : callback lecture transmis à la garde composée'); return null; } }] };
    await db.mutate({ origin: 'remote', conditions: fusionnerConditions({ books: [{ key: row.id, fusion: courant => ({ ...courant, title: 'Après' }) }] }, garde) });
    eq((await db.get('books', row.id)).title, 'Après', 'audit B1 : une garde n’efface pas la première écriture calculée');
    const refuse = fusionnerConditions({ books: [{ key: row.id, fusion: courant => ({ ...courant, title: 'Perdu' }) }] },
      { books: [{ key: row.id, fusion: () => { throw Error('garde finale'); } }] });
    eq((await erreurDe(() => db.mutate({ origin: 'remote', conditions: refuse })))?.message, 'garde finale', 'audit B1 : refus exact de la seconde garde dans IndexedDB');
    eq((await db.get('books', row.id)).title, 'Après', 'audit B1 : refus tardif annule toute écriture calculée');
    await db.mutate({ origin: 'remote', conditions: fusionnerConditions({ books: [{ key: row.id, fusion: () => null }] },
      { books: [{ key: row.id, fusion: courant => ({ ...courant, title: 'Seconde' }) }] }) });
    eq((await db.get('books', row.id)).title, 'Seconde', 'audit B1 : écriture de la seconde fusion conservée après une garde');
    const deuxEcritures = fusionnerConditions({ books: [{ key: row.id, fusion: courant => ({ ...courant, title: 'Première' }) }] },
      { books: [{ key: row.id, fusion: courant => ({ ...courant, title: 'Autre' }) }] });
    eq((await erreurDe(() => db.mutate({ origin: 'remote', conditions: deuxEcritures })))?.message, 'Deux fusions écrivent la même fiche books/b1', 'audit B1 : deux écritures ambiguës ne se remplacent pas silencieusement');
    eq((await db.get('books', row.id)).title, 'Seconde', 'audit B1 : composition ambiguë n’écrit aucune des deux fiches');
  }));
}
