// Lectures payées L5 : fournisseur et conservation injectés, aucun appel extérieur.
export async function runL5IndexLectureTests({ eq, ok }) {
  let M;
  try { M = await import('../src/domain/index-lecture.js'); }
  catch (e) { ok(false, `L5 lectures : module indisponible (${e.message})`); return; }
  const bloc = async (nom, f) => { try { await f(); } catch (e) { ok(false, `L5 lectures ${nom} : ${e.stack || e}`); } };
  const clone = x => structuredClone(x), hash = n => n.repeat(64);
  const capture = (kind = 'full', revision = 'r1') => ({ format: 2, session_id: 'ss', source_state_revision: revision, selected_page_ids: ['p'], pages: [{ id: 'p', identity_sha256: hash('a'), annotation_sha256: hash('b'), preparation_version: 'index-image-v1', zone: { kind, x: kind === 'right_half' ? 45 : 0, y: 0, width: kind === 'full' ? 100 : 55, height: 100, source_width: 100, source_height: 100 }, sent_image_sha256: hash(kind === 'left_half' ? 'c' : kind === 'right_half' ? 'd' : 'e') }] });
  const page = (prefix, count = 600) => ({ page_id: 'p', etat: 'lue', sorte_page: 'table', page_imprimee: 10, suite_rubrique: false, modele: 'claude-sonnet-5-5', entrees: Array.from({ length: count }, (_, i) => ({ titre: `${prefix} ${i}`, renvois: String(i + 1), rubrique: null, sorte: 'recette', incertain: false })), incertain: [], ecartees: { adresse: 0, longueur: 0, forme: 0 } });
  const call = (id, kind, state, prefix = kind, count = 600) => ({ id, kind: 'index', scan_session_id: 'ss', edition_id: 'ed', owner_id: null, status: state === 'ok' ? 'a_verifier' : 'echec', started_at: '2026-10-29T23:00:00.000Z', index_call: { format: 1, series_id: 'serie', page_id: 'p', kind, parent_call_id: kind === 'full' ? null : 'full' }, source_capture: capture(kind), resultat: state === 'ok' ? { format: 2, pages: [page(prefix, count)] } : null, erreur: state === 'ok' ? null : { raison: state } });
  const base = () => [call('full', 'full', 'coupe'), call('left', 'left_half', 'ok', 'G'), call('right', 'right_half', 'ok', 'D')];
  const view = { format: 1, page_id: 'p', full_call_id: 'full', left_call_id: 'left', right_call_id: 'right' };

  await bloc('capture de zone et octets envoyés', async () => {
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
    canvas.getContext('2d').fillRect(0, 0, 120, 80);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const { sha256Hex } = await import('../src/core/hash.js');
    const source = { id: 'p', edition_id: 'ed', document_id: 'doc', sha256: await sha256Hex(blob), rotation: 90, printed_page: 12 };
    const session = { id: 'ss', edition_id: 'ed', page_ids: ['p'], source_state: { format: 1, revision: 'rev', active_page_ids: ['p'] } };
    const full = await M.preparerImageAppelIndex({ page: source, session, blob, kind: 'full' });
    const left = await M.preparerImageAppelIndex({ page: source, session, blob, kind: 'left_half' });
    const right = await M.preparerImageAppelIndex({ page: source, session, blob, kind: 'right_half' });
    eq([full.capture.pages[0].zone, left.capture.pages[0].zone, right.capture.pages[0].zone], [
      { kind: 'full', x: 0, y: 0, width: 80, height: 120, source_width: 80, source_height: 120 },
      { kind: 'left_half', x: 0, y: 0, width: 44, height: 120, source_width: 80, source_height: 120 },
      { kind: 'right_half', x: 36, y: 0, width: 44, height: 120, source_width: 80, source_height: 120 },
    ], 'L5 : zones en pixels dans l’image orientée, avant compression, chevauchement10% exact');
    const sent = Uint8Array.from(atob(left.image.base64), c => c.charCodeAt(0));
    eq(left.capture.pages[0].sent_image_sha256, await sha256Hex(sent), 'L5 : capture hash des octets effectivement envoyés, pas de l’image pleine');
    eq(left.capture.source_state_revision, 'rev', 'L5 : la révision de sélection affichée est capturée');
    let code = null;
    try { await M.preparerImageAppelIndex({ page: { ...source, sha256: hash('f') }, session, blob, kind: 'full' }); } catch (e) { code = e.code; }
    eq(code, 'source_changed', 'L5 : octets différents de la page affichée refusés avant appel');
    code = null;
    try { await M.preparerImageAppelIndex({ page: source, session: { ...session, source_state: { ...session.source_state, active_page_ids: [] } }, blob, kind: 'full' }); } catch (e) { code = e.code; }
    eq(code, 'source_changed', 'L5 : page historique hors sélection active ne devient pas une nouvelle capture');
  });

  await bloc('fusion et identité', async () => {
    const rows = base(), avant = JSON.stringify(rows);
    const result = M.reconstruirePageIndex(view, rows);
    eq([result.etat, result.entrees.length, result.entrees[0].titre, result.entrees.at(-1).titre], ['lue', 1200, 'G 0', 'D 599'], 'L5 : les deux réponses de600 sont conservées jusqu’à1200 dans la vue dérivée');
    eq(JSON.stringify(rows), avant, 'L5 : fusion ne modifie aucun journal ou résultat source');
    const {lectureDeSeance}=await import('../src/ui/index-livre.js');
    eq(lectureDeSeance(rows,'ss',['p']).pages[0]?.entrees.length,1200,'L5 panneau : fusion1200 ne repasse jamais dans le lecteur limité à600');
    const partial = M.reconstruirePageIndex({ ...view, right_call_id: null }, rows);
    eq([partial.etat, partial.entrees.length], ['partielle', 600], 'L5 : une moitié absente laisse les600 autres consultables, page partielle');
    const full = call('full', 'full', 'ok', 'Entière', 2);
    eq(M.reconstruirePageIndex(view, [full, ...rows.slice(1)]).entrees.map(e => e.titre), ['Entière 0', 'Entière 1'], 'L5 : plein format réussi est la seule lecture employée');
    for (const [nom, modifier] of [
      ['parent', x => { x.index_call.parent_call_id = 'autre'; }],
      ['série', x => { x.index_call.series_id = 'autre'; }],
      ['révision', x => { x.source_capture.source_state_revision = 'r2'; }],
      ['identité image', x => { x.source_capture.pages[0].identity_sha256 = hash('f'); }],
      ['propriétaire', x => { x.owner_id = 'autre'; }],
    ]) {
      const changed = base(); modifier(changed[2]); let refused = false;
      try { M.reconstruirePageIndex(view, changed); } catch { refused = true; }
      ok(refused, `L5 : moitié de ${nom} différent refusée, jamais fusionnée`);
    }
  });

  await bloc('conservation avant prochain appel et reprise', async () => {
    const journal = [], events = [];
    let liberer; const attente = new Promise(r => { liberer = r; });
    let entreeGauche; const gaucheArrivee = new Promise(r => { entreeGauche = r; });
    const effectuer = async ({ kind }) => {
      events.push(`appel:${kind}`);
      return kind === 'full' ? { issue: 'echec', raison: 'coupe', journal: call('full', kind, 'coupe') } : { issue: 'a_verifier', journal: call(kind === 'left_half' ? 'left' : 'right', kind, 'ok') };
    };
    const conserver = async result => {
      if (result.journal.index_call.kind === 'left_half') { entreeGauche(); await attente; }
      journal.push(clone(result.journal)); events.push(`conserve:${result.journal.index_call.kind}`);
    };
    const work = M.executerAppelsIndex({ page_id: 'p', series_id: 'serie', appels: [], effectuer, conserver });
    await gaucheArrivee;
    eq(events, ['appel:full', 'conserve:full', 'appel:left_half'], 'L5 : le fournisseur droit ne part pas tant que la conservation gauche attend');
    liberer(); const result = await work;
    eq(events, ['appel:full', 'conserve:full', 'appel:left_half', 'conserve:left_half', 'appel:right_half', 'conserve:right_half'], 'L5 : chaque réponse conservée avant la prochaine dépense');
    eq([result.issue, result.appelsEffectues, journal.length], ['termine', 3, 3], 'L5 : maximum3 appels et3 journaux distincts, réponse de coupure comprise');
    let count = 0;
    const resumed = await M.executerAppelsIndex({ page_id: 'p', series_id: 'serie', appels: journal, effectuer: async () => { count++; }, conserver: async () => {} });
    eq([resumed.issue, count], ['termine', 0], 'L5 : affichage/reprise d’une page entièrement conservée ne rappelle pas le fournisseur');
  });

  await bloc('pannes de droite et de stockage', async () => {
    const saved = [];
    let paid = 0;
    const effectuer = async ({ kind }) => { paid++; if (kind === 'right_half') throw Error('reseau'); return kind === 'full' ? { issue: 'echec', raison: 'coupe', journal: call('full', kind, 'coupe') } : { issue: 'a_verifier', journal: call('left', kind, 'ok') }; };
    const first = await M.executerAppelsIndex({ page_id: 'p', series_id: 'serie', appels: [], effectuer, conserver: async r => saved.push(clone(r.journal)) });
    eq([first.issue, paid, saved.map(x => x.id)], ['interrompu', 3, ['full', 'left']], 'L5 : panne droite conserve exactement plein coupé et gauche payée');
    eq(M.maximumAppelsIndex({ page_id: 'p', series_id: 'serie', appels: saved }), 1, 'L5 : reprise annonce seulement l’appel droit manquant');
    const resume = await M.executerAppelsIndex({ page_id: 'p', series_id: 'serie', appels: saved, effectuer: async ({ kind }) => { eq(kind, 'right_half', 'L5 : reprise ne relit ni plein ni gauche'); return { issue: 'a_verifier', journal: call('right', kind, 'ok') }; }, conserver: async r => saved.push(clone(r.journal)) });
    eq([resume.issue, resume.appelsEffectues, saved.length], ['termine', 1, 3], 'L5 : reprise durable complète la même série sans nouvelle lecture gauche');
    let calls = 0;
    const quota = await M.executerAppelsIndex({ page_id: 'p', series_id: 'serie', appels: [call('full', 'full', 'coupe')], effectuer: async ({ kind }) => { calls++; return { issue: 'a_verifier', journal: call('left', kind, 'ok') }; }, conserver: async () => { throw new DOMException('fixture', 'QuotaExceededError'); } });
    eq([quota.issue, calls, quota.reponseNonConservee?.journal.id], ['conservation_echec', 1, 'left'], 'L5 : quota garde réponse récupérable en mémoire et arrête tout appel suivant');
    eq(M.maximumAppelsIndex({ page_id: 'p', series_id: 'serie', appels: [] }), 3, 'L5 : le maximum d’une page neuve vaut3 avant le premier appel');
  });
}
