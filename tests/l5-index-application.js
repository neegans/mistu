// Plans fermés d’application index : copies exactes et écritures atomiques injectées.
export async function runL5IndexApplicationTests({ eq, ok }) {
  let M;
  try { M = await import('../src/domain/index-application.js'); }
  catch (e) { ok(false, `L5 application : module indisponible (${e.message})`); return; }
  const F = await import('../src/domain/sources-format.js');
  const bloc = async (nom, f) => { try { await f(); } catch (e) { ok(false, `L5 application ${nom} : ${e.stack || e}`); } };
  const hash = s => s.repeat(64), edition = { id: 'ed', book_id: 'book', language: 'fr' };
  const session={id:'ss',edition_id:'ed',status:'open',page_ids:['p1','p2'],document_ids:[],recipe_ids:[]};
  const capture = id => ({ format: 2, session_id: 'ss', source_state_revision: 'rev', selected_page_ids: [id], pages: [{ id, identity_sha256: hash('a'), annotation_sha256: hash('b'), preparation_version: 'index-image-v1', zone: { kind: 'full', x: 0, y: 0, width: 100, height: 100, source_width: 100, source_height: 100 }, sent_image_sha256: hash('c') }] });
  const row = (id, p) => ({ id, kind: 'index', status: 'a_verifier', edition_id: 'ed', scan_session_id: 'ss', page_ids: [p], owner_id: null, expected_edition_cycle_id: null, started_at: '2026-10-29T23:00:00.000Z', source_capture: capture(p), index_call: { format: 1, series_id: 's', page_id: p, kind: 'full', parent_call_id: null }, resultat: { format: 2, pages: [{ page_id: p, etat: 'lue', sorte_page: 'table', page_imprimee: 10, modele: 'claude-sonnet-5-5', entrees: [], incertain: [] }] } });
  const journals = () => {const a=row('j1','p1');a.resultat.pages[0].entrees=Array.from({length:600},(_,i)=>({titre:`Recette ${i}`,renvois:String(i+1),rubrique:null,sorte:'recette',incertain:false}));return[a,row('j2','p2')];};
  const recipe = n => ({ id: `r${String(n).padStart(4, '0')}`, edition_id: 'ed', original_title: `Recette ${n}`, original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: n + 1, printed_pages: [{ debut: n + 1, fin: n + 1 }], current_version_id: null, favorite: false, source_page_ids: ['p1'], index_import_id: 'j1' });
  const units = async n => {const result_sha256=await F.empreinteSources(F.projectionLectureIndex(journals()[0]));return Promise.all(Array.from({length:n},async(_,i)=>{const occurrences=[{journal_id:'j1',ordinal:i,result_sha256}];return{journal_id:'j1',occurrence_ordinal:i,occurrences,unit_sha256:await F.empreinteSources({projection:'index-unit-v1',edition_id:'ed',occurrences}),action:'auto',option_sha256:null,creates:[recipe(i)],patches:[]};}));};
  const deps = () => { let n = 0; return { newId: prefix => `${prefix}_${++n}` }; };
  let prepared;
  await bloc('moteur existant et décisions exactes', async () => {
    const source = journals();
    source[0].resultat.pages[0].entrees = [
      { titre: 'Pain', renvois: '12', rubrique: null, sorte: 'recette', incertain: false },
      { titre: 'Soupe', renvois: '', rubrique: null, sorte: 'recette', incertain: true },
    ];
    source[1].resultat.pages[0].entrees = [{ titre: 'Pain', renvois: '12', rubrique: 'Classiques', sorte: 'recette', incertain: false }];
    const lecture = { lignes: source, pages: source.map(r => ({ ...r.resultat.pages[0], ligne_id: r.id, lecture_ids: [r.id] })), modeleValide: true };
    const projection = await M.projeterIndexAffiche({ lecture, edition, recettes: [] });
    eq(projection.groupes.map(g => [g.candidate.titre, g.categorie, g.journal_id, g.occurrence_ordinal]), [['Pain', 'certaine', 'j1', 0], ['Soupe', 'a_verifier', 'j1', 1]], 'L5 : moteur existant regroupe les occurrences, home fixé par journal/ordinal');
    const auto = await M.unitesApplicationIndex({ projection }, deps());
    eq([auto.length, auto[0].creates[0].original_title, auto[0].creates[0].source_page_ids], [1, 'Pain', ['p1', 'p2']], 'L5 : automatique ne crée que la référence certaine, sources exactes conservées');
    eq(auto[0].occurrences?.map(o=>[o.journal_id,o.ordinal]),[['j1',0],['j2',0]],'L5 : une décision porte la preuve des occurrences de chaque page');
    const portions=await M.preparerPortionsIndex({edition,journaux:source,recettes:[],unites:auto,session,session_id:'ss',application_id:'coverage'},deps());
    eq(portions.commands[0].decisions.map(d=>d.journal_id),['j1','j2'],'L5 : journal secondaire couvert inclus dans CAS et nombre de lignes');
    const soupe = projection.groupes.find(g => g.candidate.titre === 'Soupe');
    const choix = await M.unitesApplicationIndex({ projection, automatique: false, decisions: [{ unit_sha256: soupe.unit_sha256, action: 'ecarter', option_sha256: null }] }, deps());
    eq([choix.length, choix[0].creates.length, choix[0].action], [1, 0, 'ecarter'], 'L5 : choix explicite lié à cette unité, sans référence inventée');
    const resolue=structuredClone(source);resolue[0].index_resolved_occurrences=[0];
    const suivante=await M.projeterIndexAffiche({lecture:{...lecture,lignes:resolue},edition,recettes:auto[0].creates});
    const painSuivant=suivante.groupes.find(g=>g.candidate.titre==='Pain');
    eq([painSuivant.journal_id,painSuivant.occurrences.map(o=>[o.journal_id,o.ordinal])],['j2',[['j2',0]]],'L5 : nouvelle occurrence doublon conserve décision précédente et choisit home non résolu');
    source[0].index_decisions = [{ occurrence_ordinal: 1, unit_sha256: 'f'.repeat(64), action: 'ecarter', option_sha256: null, applied_ids_sha256: 'e'.repeat(64) }];
    const autre = await M.projeterIndexAffiche({ lecture: { ...lecture, lignes: source }, edition, recettes: [] });
    eq(autre.groupes.find(g => g.candidate.titre === 'Soupe').decidee, false, 'L5 : décision d’un groupe différent dans la même place non réutilisée');
  });
  await bloc('600 références par portions', async () => {
    const sources = journals(), unites = await units(600), avant = JSON.stringify([sources, unites]);
    prepared = await M.preparerPortionsIndex({ edition, journaux: sources, recettes: [], unites, session,session_id: 'ss', application_id: 'app' }, deps());
    eq(prepared.commands.map(c => c.creates.length), [498, 102], 'L5 :600 références réparties498+102, deux journaux touchés comptés dans500 écritures');
    ok(prepared.commands.every(c => F.octetsJsonbSources(c) <= 786432 && c.creates.length + c.patches.length + c.decisions.length <= 500), 'L5 : chaque portion respecte octets JSONB et nombre réel de lignes');
    const [a, b] = prepared.commands;
    eq([a.read_set.map(x => x.journal_id), b.read_set.map(x => x.journal_id)], [['j1', 'j2'], ['j1', 'j2']], 'L5 : chaque portion contrôle toutes les lectures, même un journal sans référence nouvelle');
    eq([a.predecessor_operation_id, b.predecessor_operation_id, b.base_decision_revision, a.terminal, b.terminal], [null, a.operation_id, a.operation_id, false, true], 'L5 : chaîne ordonnée et révision de décision issue de sa seule portion précédente');
    eq(b.recipe_scope_sha256, await M.empreintePerimetreIndex(a.creates, 'ed'), 'L5 : base suivante calculée uniquement depuis effets autorisés de la première portion');
    eq(JSON.stringify([sources, unites]), avant, 'L5 : préparation ne modifie ni résultats ni choix affichés');
    ok(await Promise.all(prepared.commands.map(c => F.verifierEmpreinteCommandeSources(c))).then(() => true), 'L5 : les commandes préparées passent le format partagé et leur signature');
  });
  await bloc('exactitude et absence de doublon', async () => {
    const command = prepared.commands[0], sources = journals();
    eq(await M.verifierPortionIndex(command, { journaux: sources, recettes: [] }), true, 'L5 : capture exacte reste admissible');
    sources[1].resultat.pages[0].incertain = ['réponse arrivée ailleurs'];
    let code = null; try { await M.verifierPortionIndex(command, { journaux: sources, recettes: [] }); } catch (e) { code = e.code; }
    eq(code, 'result_changed', 'L5 : résultat du second journal changé sous mêmes ID/date refuse toute la portion');
    code = null; try { await M.verifierPortionIndex(command, { journaux: journals(), recettes: [recipe(999)] }); } catch (e) { code = e.code; }
    eq(code, 'index_changed', 'L5 : recette concurrente invalide le périmètre, même si ses IDs ne sont pas écrits par la portion');
    const a = recipe(900), b = { ...a, favorite: true, notes: 'ma note', photo_sha256: hash('d'), updated_at: 'autre' };
    eq(await M.empreintePerimetreIndex([a], 'ed'), await M.empreintePerimetreIndex([b], 'ed'), 'L5 : favori/note/photo et dates techniques ne créent pas un conflit d’index');
    ok(await M.empreintePerimetreIndex([a], 'ed') !== await M.empreintePerimetreIndex([{ ...a, display_title: 'Mon titre' }], 'ed'), 'L5 : titre personnel utilisé par la détection des doublons appartient au périmètre');
  });
  await bloc('groupe indivisible et choix', async () => {
    const u = (await units(1))[0]; u.creates = Array.from({ length: 500 }, (_, i) => recipe(i));
    let code = null; try { await M.preparerPortionsIndex({ edition, journaux: journals(), recettes: [], unites: [u], session,session_id: 'ss', application_id: 'gros' }, deps()); } catch (e) { code = e.code; }
    eq(code, 'too_large', 'L5 : groupe de500 références plus journal refuse entier, sans découpe au milieu du choix');
    eq(u.creates.length, 500, 'L5 : refus de transport ne tronque pas le groupe payé');
    const ambiguous = await units(2); ambiguous[1].creates[0] = structuredClone(ambiguous[0].creates[0]);
    code = null; try { await M.preparerPortionsIndex({ edition, journaux: journals(), recettes: [], unites: ambiguous, session,session_id: 'ss', application_id: 'double' }, deps()); } catch (e) { code = e.code; }
    eq(code, 'invalid_shape', 'L5 : deux unités revendiquant le même ID refusées avant application');
  });
  await bloc('interruption et reprise exacte', async () => {
    let confirmed = structuredClone(prepared), count = 0;
    const first = await M.executerApplicationIndex({ application: prepared, commettre: async ({ commande, progression }) => { count++; if (count === 2) throw new DOMException('fixture', 'QuotaExceededError'); confirmed = structuredClone(progression); return { issue: 'applied', operation_id: commande.operation_id }; } });
    eq([first.issue, first.application.next_portion, confirmed.next_portion, first.application.local_counts.creates], ['interrompu', 1, 1, 498], 'L5 : panne portion2 garde bilan498 et la progression confirmée dans le même commit');
    eq(confirmed.commands[1].creates.map(r => r.id), prepared.commands[1].creates.map(r => r.id), 'L5 : IDs restants conservés sans réservation nouvelle après recharge');
    const calls = [];
    const second = await M.executerApplicationIndex({ application: confirmed, commettre: async ({ commande }) => { calls.push(commande.operation_id); return { issue: 'applied', operation_id: commande.operation_id }; } });
    eq([second.issue, calls, second.application.local_counts.creates], ['complete', [prepared.commands[1].operation_id], 600], 'L5 : reprise uniquement de la portion non confirmée, aucun appel fournisseur');
    const stopped = await M.executerApplicationIndex({ application: prepared, commettre: async () => { throw Object.assign(Error('fixture'), { code: 'result_changed' }); } });
    eq([stopped.issue, stopped.application.next_portion, stopped.raison], ['bloque', 0, 'result_changed'], 'L5 : conflit conserve plan et bloque la chaîne sans adopter une lecture récente');
  });
}
