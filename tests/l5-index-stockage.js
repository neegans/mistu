export async function runL5IndexStockageTests({ eq, ok }) {
  let M; try { M = await import('../src/domain/index-stockage.js'); }
  catch (e) { ok(false, `L5 stockage : module indisponible (${e.message})`); return; }
  const F = await import('../src/domain/sources-format.js'), { validerPageIndex } = await import('../src/domain/index-livre.js');
  const bloc = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, `L5 stockage ${nom} : ${e.stack || e}`); } };
  const hash = s => s.repeat(64), clone = x => structuredClone(x);
  const motif = async fn => { try { await fn(); return null; } catch (e) { return e.raison ?? e.code ?? e.message; } };
  const octetsCanoniques = row => new TextEncoder().encode(F.canoniqueSources(row)).length;
  const journal = { id: 'j', kind: 'index', status: 'a_verifier', edition_id: 'ed', scan_session_id: 'ss', page_ids: ['p'], owner_id: null,
    index_call: { format: 1, series_id: 'serie', page_id: 'p', kind: 'full', parent_call_id: null },
    source_capture: { format: 2, session_id: 'ss', source_state_revision: null, selected_page_ids: ['p'], pages: [{ id: 'p', identity_sha256: hash('a'), annotation_sha256: hash('b'), preparation_version: 'index-image-v1', zone: { kind: 'full', x: 0, y: 0, width: 100, height: 100, source_width: 100, source_height: 100 }, sent_image_sha256: hash('c') }] } };
  const result = n => ({ format: 2, pages: [{ page_id: 'p', etat: 'lue', moities: 0, modele: 'claude-sonnet-5-5', ...validerPageIndex({ sorte_page: 'table', entrees: Array.from({ length: n }, (_, i) => ['🍞'.repeat(196) + String(i).padStart(4, '0'), '🍐'.repeat(80), '🍎'.repeat(120), 'recette', false]), incertain: [] }) }] });
  let packed, original;
  await bloc('conservation et reconstruction', async () => {
    const small = await M.preparerStockageIndex({ journal, resultat: result(1) });
    eq([small.fragments.length, small.journal.index_storage ?? null, small.journal.resultat.pages[0].entrees.length], [0, null, 1], 'L5 : réponse ordinaire conservée inline sans fragment superflu');
    const moyenne=await M.preparerStockageIndex({journal,resultat:result(200)});
    ok(F.octetsJsonbSources({...journal,resultat:result(200)})<524288&&moyenne.fragments.length>0,'L5 : réponse moyenne fragmentée avant succès pour réserver décisions et reçus futurs');
    original = result(600); const before = JSON.stringify([journal, original]); let n = 0;
    packed = await M.preparerStockageIndex({ journal, resultat: original }, { newId: () => `fragment_${++n}` });
    ok(packed.fragments.length > 1 && packed.fragments.length <= 64, 'L5 : résultat valide trop gros conservé en fragments bornés');
    eq(packed.journal.resultat, null, 'L5 : manifeste ne duplique pas le résultat entier');
    ok(packed.fragments.every(r => F.octetsJsonbSources(r) <= 262144) && F.octetsJsonbSources(packed.journal) <= 524288, 'L5 : bornes mesurées sur chaque ligne complète, avec enveloppe JSONB');
    const restored = await M.reconstruireResultatIndex({ journal: packed.journal, imports: [...packed.fragments].reverse() });
    ok(F.canoniqueSources(restored) === F.canoniqueSources(original), 'L5 : reconstruction exacte des600 entrées Unicode malgré réception désordonnée (ordre des clés sans effet)');
    eq(JSON.stringify([journal, original]), before, 'L5 : préparation ne normalise ni ne modifie la réponse ni sa provenance');
    eq((await M.validerStockageIndex([packed.journal, ...packed.fragments])).complet, true, 'L5 : archive avec fermeture complète validée');
    const dates={created_at:'2026-10-29T23:59:59.999Z',updated_at:'2026-10-30T00:00:00.000Z'};
    ok(packed.fragments.every(r=>F.octetsJsonbSources({...r,...dates})<=262144),'L5 : le découpage réserve les horodatages ajoutés par repo et restauration');
    const dated=[packed.journal,...packed.fragments].map(r=>({...r,...dates}));
    eq((await M.validerStockageIndex(dated)).complet,true,'L5 : archive horodatée reste entièrement reconstructible');
  });
  await bloc('intégrité et réception partielle', async () => {
    const rows = [packed.journal, ...packed.fragments];
    for (const [nom, changer, code] of [
      ['texte modifié', r => { r[1].index_storage.text += 'x'; }, 'invalid_shape'],
      ['propriétaire différent', r => { r[1].owner_id = 'autre'; }, 'result_changed'],
      ['ordinal dupliqué', r => { r[2].index_storage.ordinal = r[1].index_storage.ordinal; }, 'result_changed'],
      ['hash manifeste différent', r => { r[0].index_storage.logical_result_sha256 = hash('f'); }, 'result_changed'],
      ['fragment absent', r => { r.pop(); }, 'result_incomplete'],
    ]) {
      const bad = clone(rows); changer(bad);
      eq(await motif(() => M.validerStockageIndex(bad)), code, `L5 : archive refuse ${nom}, sans reconstruire un index amputé`);
    }
    const partial = await M.validerStockageIndex(rows.slice(0, -1), { autoriserIncomplets: true });
    eq([partial.complet, partial.incomplets], [false, ['j']], 'L5 : réception partielle signalée explicitement, jamais convertie en résultat vide');
    eq(await motif(() => M.validerStockageIndex(packed.fragments)), 'result_incomplete', 'L5 : archive refuse les fragments sans leur manifeste');
    const invalid = result(1); invalid.pages[0].invente = 'texte non admis';
    eq(await motif(() => M.preparerStockageIndex({ journal, resultat: invalid })), 'invalid_shape', 'L5 : format logique fermé, pas de champs inconnus cachés dans les fragments');
  });
  await bloc('borne des fragments réellement atteinte', async () => {
    // Capture volumineuse conforme au format (ce n’est pas une lecture assistant publique de542 pages).
    // Le contexte répété laisse une place positive dans chaque fragment ; IDs de longueur constante.
    const ample = clone(journal);
    ample.source_capture.selected_page_ids = Array.from({ length: 542 }, (_, i) => i === 0 ? 'p' : 'page_' + String(i).padStart(4, '0'));
    ample.source_capture.pages = ample.source_capture.selected_page_ids.map(id => ({ ...clone(journal.source_capture.pages[0]), id }));
    eq(F.validerCaptureSources(ample.source_capture).pages.length, 542, 'L5 borne : capture volumineuse valide avant tout découpage');
    const accepte = result(586), refuse = result(587), avant = JSON.stringify([ample, accepte, refuse]);
    let crees = 0;
    const prepare = await M.preparerStockageIndex({ journal: ample, resultat: accepte }, { newId: () => 'fragment_' + String(++crees).padStart(3, '0') });
    eq([prepare.fragments.length, crees], [64, 64], 'L5 borne : exactement64 fragments admis et fabriqués');
    const dates = { created_at: '2026-10-29T23:59:59.999Z', updated_at: '2026-10-30T00:00:00.000Z' };
    ok(prepare.fragments.every(r => F.octetsJsonbSources({ ...r, ...dates }) <= 262144), 'L5 borne : les64 fragments réservent les horodatages dans262144 octets');
    ok(F.octetsJsonbSources({ ...prepare.journal, ...dates }) < 524288, 'L5 borne : manifeste64 sous sa limite avec marge réelle');
    ok(octetsCanoniques(accepte) < 4194304 && octetsCanoniques(refuse) < 4194304, 'L5 borne : les deux résultats culinaires restent sous4Mio');
    eq(F.canoniqueSources(await M.reconstruireResultatIndex({ journal: prepare.journal, imports: [...prepare.fragments].reverse() })), F.canoniqueSources(accepte), 'L5 borne : les64 fragments reconstruisent exactement le résultat malgré ordre inversé');
    crees = 0;
    eq(await motif(() => M.preparerStockageIndex({ journal: ample, resultat: refuse }, { newId: () => 'fragment_' + String(++crees).padStart(3, '0') })), 'too_large', 'L5 borne : le65e fragment nécessaire est refusé par la borne du découpeur');
    eq(crees, 64, 'L5 borne : le65e identifiant n’est jamais fabriqué avant le refus');
    eq(JSON.stringify([ample, accepte, refuse]), avant, 'L5 borne : succès et refus gardent les résultats et la capture intacts');
  });
  await bloc('borne logique défensive hors format public', async () => {
    // Le validateur défensif reçoit un page_id synthétique long, hors des bornes publiques.
    // Les champs culinaires sont normaux ; la mesure porte sur UTF-8 canonique, pas JSONB.
    const exact = result(0); exact.pages[0].page_id = '';
    const disponibles = 4194304 - octetsCanoniques(exact);
    exact.pages[0].page_id = '🍞'.repeat(Math.floor(disponibles / 4)) + 'p'.repeat(disponibles % 4);
    const trop = clone(exact); trop.pages[0].page_id += 'p';
    eq([octetsCanoniques(exact), octetsCanoniques(trop)], [4194304, 4194305], 'L5 borne : témoins défensifs à4Mio exacts et un octet de plus');
    eq(await motif(() => M.validerResultatStockeIndex(exact, exact.pages[0].page_id)), null, 'L5 borne : validateur défensif accepte exactement4Mio');
    eq(await motif(() => M.validerResultatStockeIndex(trop, trop.pages[0].page_id)), 'too_large', 'L5 borne : validateur défensif refuse4Mio plus un octet');
    const horsPublic = { ...journal, page_ids: [exact.pages[0].page_id], index_call: { ...journal.index_call, page_id: exact.pages[0].page_id } };
    eq(await motif(() => M.preparerStockageIndex({ journal: horsPublic, resultat: exact })), 'invalid_shape', 'L5 borne : ce témoin synthétique n’élargit pas les identifiants du chemin public');
  });
}
