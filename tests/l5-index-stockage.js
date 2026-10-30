export async function runL5IndexStockageTests({ eq, ok }) {
  let M; try { M = await import('../src/domain/index-stockage.js'); }
  catch (e) { ok(false, `L5 stockage : module indisponible (${e.message})`); return; }
  const F = await import('../src/domain/sources-format.js'), { validerPageIndex } = await import('../src/domain/index-livre.js');
  const bloc = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, `L5 stockage ${nom} : ${e.stack || e}`); } };
  const hash = s => s.repeat(64), clone = x => structuredClone(x);
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
    for (const [nom, changer] of [
      ['texte modifié', r => { r[1].index_storage.text += 'x'; }],
      ['propriétaire différent', r => { r[1].owner_id = 'autre'; }],
      ['ordinal dupliqué', r => { r[2].index_storage.ordinal = r[1].index_storage.ordinal; }],
      ['hash manifeste différent', r => { r[0].index_storage.logical_result_sha256 = hash('f'); }],
      ['fragment absent', r => { r.pop(); }],
    ]) {
      const bad = clone(rows); changer(bad); let refused = false;
      try { await M.validerStockageIndex(bad); } catch { refused = true; }
      ok(refused, `L5 : archive refuse ${nom}, sans reconstruire un index amputé`);
    }
    const partial = await M.validerStockageIndex(rows.slice(0, -1), { autoriserIncomplets: true });
    eq([partial.complet, partial.incomplets], [false, ['j']], 'L5 : réception partielle signalée explicitement, jamais convertie en résultat vide');
    let refused = false;
    try { await M.validerStockageIndex(packed.fragments); } catch { refused = true; }
    ok(refused, 'L5 : archive refuse les fragments sans leur manifeste');
    const invalid = result(1); invalid.pages[0].invente = 'texte non admis';
    refused = false; try { await M.preparerStockageIndex({ journal, resultat: invalid }); } catch { refused = true; }
    ok(refused, 'L5 : format logique fermé, pas de champs inconnus cachés dans les fragments');
  });
}
