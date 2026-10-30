import { withRepo } from './sync-fixture.js';
export async function runL5IndexTransactionTests({ eq, ok }) {
  const M = await import('../src/domain/index-application.js'), F = await import('../src/domain/sources-format.js'), S = await import('../src/domain/revisions-source.js');
  const run = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `L5 index transaction ${nom} : ${e.stack || e}`); } };
  const fixture = async (repo, db, count = 2) => {
    const edition = { id: 'ed', book_id: 'book', language: 'fr' }, session = { id: 'ss', edition_id: 'ed', status: 'open', page_ids: ['p'], document_ids: ['doc'], recipe_ids: [] };
    const page = { id: 'p', edition_id: 'ed', document_id: 'doc', sha256: 'a'.repeat(64), rotation: 0, printed_page: 10, position: 1 };
    const document = { id: 'doc', edition_id: 'ed', scan_session_id: 'ss', source_type: 'photo', sha256: page.sha256 };
    const source_capture = { format: 2, session_id: 'ss', source_state_revision: null, selected_page_ids: ['p'], pages: [{ id: 'p', identity_sha256: await F.empreinteSources(F.projectionIdentitePage(page)), annotation_sha256: await F.empreinteSources(F.projectionAnnotationPage(page)), preparation_version: 'index-image-v1', zone: { kind: 'full', x: 0, y: 0, width: 10, height: 10, source_width: 10, source_height: 10 }, sent_image_sha256: 'b'.repeat(64) }] };
    const journal = { id: 'j', kind: 'index', status: 'a_verifier', recipe_id: null, edition_id: 'ed', expected_edition_id: 'ed', expected_edition_cycle_id: null, owner_id: null, scan_session_id: 'ss', page_ids: ['p'], started_at: '2026-10-29T23:00:00.000Z', source_capture, index_call: { format: 1, series_id: 'serie', page_id: 'p', kind: 'full', parent_call_id: null }, resultat: { format: 2, pages: [{ page_id: 'p', etat: 'lue', sorte_page: 'table', modele: 'claude-sonnet-5-5', incertain: [], entrees: Array.from({ length: count }, (_, i) => ({ titre: `Recette ${i}`, renvois: String(i + 1), rubrique: null, sorte: 'recette', incertain: false })) }] } };
    await db.mutate({ origin: 'remote', puts: { books: [{ id: 'book', title: 'Livre' }], book_editions: [edition], scan_sessions: [session], source_pages: [page], source_documents: [document], imports: [journal] } });
    const result_sha256=await F.empreinteSources(F.projectionLectureIndex(journal));
    const unites=await Promise.all(Array.from({length:count},async(_,i)=>{const occurrences=[{journal_id:'j',ordinal:i,result_sha256}];return{journal_id:'j',occurrence_ordinal:i,occurrences,unit_sha256:await F.empreinteSources({projection:'index-unit-v1',edition_id:'ed',occurrences}),action:'auto',option_sha256:null,patches:[],creates:[{id:`r${i}`,edition_id:'ed',original_title:`Recette ${i}`,availability:'reference_only',verification_state:'unverified',printed_page:i+1,printed_pages:[{debut:i+1,fin:i+1}],index_rubriques:[],current_version_id:null,favorite:false,source_page_ids:['p'],index_import_id:'j'}]};}));
    const sourceService = S.creerServiceRevisionsSource({ repo, getGeneration: () => 0 }), capture = await sourceService.capturerSources({ session, pages: [page], documents: [document], contexte: { owner_id: null, edition } });
    return { edition, session, pages: [page], journaux: [journal], recettes: [], unites, sourceService, captureSources: capture.capture };
  };
  await run('600 et reçu', async (repo, db) => {
    const f = await fixture(repo, db, 600), service = M.creerServiceApplicationIndex({ repo, serviceSources: f.sourceService });
    const p = await service.preparerApplicationIndex(f);
    eq(p.issue, 'ok', 'L5 index : plan préparé depuis les sources affichées');
    const r = await service.appliquerIndex({ plan: p.plan });
    eq([r.issue, r.application.local_counts.creates, (await repo.all('recipes')).length], ['complete', 600, 600], 'L5 index :600 références réellement commises dans IndexedDB');
    eq((await repo.all('outbox')).map(x => x.op), ['index_apply', 'index_apply'], 'L5 index :2 portions complètes en file, aucun put individuel');
    const row = await repo.get('sync_state', `index_application:v1:${p.id}`);
    eq([row.value.state, row.value.payload.next_portion, row.value.payload.local_counts.creates], ['complete', 2, 600], 'L5 index : progression durable du même commit');
    const journal = await repo.get('imports', 'j');
    eq([journal.index_decisions.length, journal.index_application_receipts.length], [600, 2], 'L5 index : décisions et reçus durables avec les références');
    eq([journal.status,journal.index_resolved_occurrences?.length],['enregistre',600],'L5 index : clôture prouvée par couverture des600 occurrences après toutes portions');
    ok(journal.index_decisions.every(x => !Object.hasOwn(x, 'applied_ids')), 'L5 index : listes d’IDs transport non dupliquées dans le journal');
    const out = await repo.all('outbox');
    eq((await service.appliquerIndex({ plan: p.plan })).issue, 'complete', 'L5 index : double geste reconnaît progression terminée');
    eq(await repo.all('outbox'), out, 'L5 index : aucune référence ni outbox supplémentaire au double geste');
  });
  await run('course après prélecture', async (repo, db) => {
    const f = await fixture(repo, db), port = { ...repo, get db() { return repo.db; }, muterSources: async (args, options) => {
      if (args.commandes?.some(c => c.op === 'index_apply')) await db.mutate({ origin: 'remote', puts: { imports: [{ ...f.journaux[0], resultat: { ...f.journaux[0].resultat, pages: [{ ...f.journaux[0].resultat.pages[0], incertain: ['autre réponse'] }] } }] } });
      return repo.muterSources(args, options);
    } };
    const service = M.creerServiceApplicationIndex({ repo: port, serviceSources: f.sourceService }), p = await service.preparerApplicationIndex(f), r = await service.appliquerIndex({ plan: p.plan });
    eq([r.issue, r.raison], ['bloque', 'result_changed'], 'L5 index : journal changé après prélecture refuse dans la vraie transaction');
    eq([(await repo.all('recipes')).length, (await repo.all('outbox')).length], [0, 0], 'L5 index : aucun effet partiel de la portion refusée');
    eq((await repo.get('sync_state', `index_application:v1:${p.id}`)).value.payload.next_portion, 0, 'L5 index : choix/IDs non appliqués restent conservés pour comparaison');
  });
  await run('source puis compte', async (repo, db) => {
    const f = await fixture(repo, db), service = M.creerServiceApplicationIndex({ repo, serviceSources: f.sourceService }), p = await service.preparerApplicationIndex(f);
    await db.mutate({ origin: 'remote', puts: { source_pages: [{ ...f.pages[0], rotation: 90 }] } });
    const r = await service.appliquerIndex({ plan: p.plan });
    eq([r.issue, r.raison, (await repo.all('recipes')).length], ['bloque', 'source_changed', 0], 'L5 index : autre image refusée, résultat payé intact');
    await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'autre' }] } });
    eq((await service.appliquerIndex({ plan: p.plan })).raison, 'owner_changed', 'L5 index : ancien plan non réattribué au nouveau propriétaire');
  });
  await run('parent coupé et moitiés', async (repo, db) => {
    const f=await fixture(repo,db,1), L=await import('../src/domain/index-lecture.js');
    const parent={...f.journaux[0],status:'echec',resultat:null,erreur:{raison:'coupe'}};
    const half=(id,kind,titre)=>({...structuredClone(f.journaux[0]),id,index_call:{...parent.index_call,kind,parent_call_id:parent.id},source_capture:{...structuredClone(parent.source_capture),pages:parent.source_capture.pages.map(p=>({...p,zone:{...p.zone,kind,x:kind==='right_half'?4:0,width:6},sent_image_sha256:kind==='right_half'?'d'.repeat(64):'c'.repeat(64)}))},resultat:{format:2,pages:[{...f.journaux[0].resultat.pages[0],entrees:[{titre,renvois:'12',rubrique:null,sorte:'recette',incertain:false}]}]}});
    const left=half('left','left_half','Gauche'),right=half('right','right_half','Droite');
    await db.mutate({origin:'remote',puts:{imports:[parent,left]}});
    const service=M.creerServiceApplicationIndex({repo,serviceSources:f.sourceService});
    async function preparer(rows){const vue={format:1,page_id:'p',full_call_id:'j',left_call_id:'left',right_call_id:rows.some(r=>r.id==='right')?'right':null};const lecture={lignes:rows,pages:[L.reconstruirePageIndex(vue,rows)],modeleValide:true};const recettes=await repo.all('recipes'),projection=await M.projeterIndexAffiche({lecture,edition:f.edition,recettes}),unites=await M.unitesApplicationIndex({projection});return service.preparerApplicationIndex({...f,journaux:projection.lecture.lignes,recettes,unites});}
    const p=await preparer([parent,left]);eq((await service.appliquerIndex({plan:p.plan})).issue,'complete','L5 moitié gauche : application indépendante conservée');
    eq([(await repo.get('imports','j')).status,(await repo.get('imports','left')).status],['echec','enregistre'],'L5 : absence droite laisse parent ouvert malgré terminal de la gauche');
    await db.mutate({origin:'remote',puts:{imports:[right]}});
    const next=await preparer(await repo.all('imports'));eq((await service.appliquerIndex({plan:next.plan})).issue,'complete','L5 : droite complète les obligations sans refaire gauche');
    eq((await repo.all('imports')).map(r=>r.status),['enregistre','enregistre','enregistre'],'L5 : parent clos seulement après deux moitiés exactes entièrement couvertes');
    const out=await repo.all('outbox');await service.appliquerIndex({plan:next.plan});eq(await repo.all('outbox'),out,'L5 : replay terminal ne réapplique ni ne rouvre aucun journal');
  });
  await run('lecture vide achevée',async(repo,db)=>{
    const f=await fixture(repo,db,0),service=M.creerServiceApplicationIndex({repo,serviceSources:f.sourceService}),p=await service.preparerApplicationIndex(f);
    eq(p.issue,'ok','L5 : lecture complète vide peut résoudre ses obligations sans référence artificielle');
    const r=await service.appliquerIndex({plan:p.plan});
    eq([r.issue,(await repo.get('imports','j')).status,(await repo.all('recipes')).length],['complete','enregistre',0],'L5 : lecture vide terminée sans bloquer classement ni reprise de séance');
  });
  await run('reconsolidation explicite après référence concurrente',async(repo,db)=>{
    const f=await fixture(repo,db,2),service=M.creerServiceApplicationIndex({repo,serviceSources:f.sourceService});
    const lecture={lignes:f.journaux,pages:f.journaux.map(r=>({...r.resultat.pages[0],ligne_id:r.id,lecture_ids:[r.id]})),modeleValide:true};
    const initial=await M.projeterIndexAffiche({lecture,edition:f.edition,recettes:[]}),unites=await M.unitesApplicationIndex({projection:initial});
    const p=await service.preparerApplicationIndex({...f,unites});
    await db.mutate({origin:'remote',puts:{recipes:[{...unites[0].creates[0],id:'ailleurs',favorite:true,notes:'personnelles'}]}});
    eq((await service.appliquerIndex({plan:p.plan})).raison,'index_changed','L5 : référence concurrente bloque le plan affiché');
    const projection=await M.projeterIndexAffiche({lecture,edition:f.edition,recettes:await repo.all('recipes')});
    const reprise=await service.preparerRepriseApplicationIndex({id:p.id,projection,session:f.session,pages:f.pages,captureSources:f.captureSources});
    eq(reprise.issue,'ok','L5 : geste explicite prépare chaîne restante depuis le résultat payé');
    eq((await service.appliquerIndex({plan:reprise.plan})).issue,'complete','L5 : nouvelle chaîne applique seulement ce qui manque');
    eq([(await repo.all('recipes')).length,(await repo.get('recipes','ailleurs')).notes,await repo.get('sync_state',`index_application:v1:${p.id}`)],[2,'personnelles',undefined],'L5 : aucun doublon ni perte personnelle, ancien brouillon remplacé atomiquement');
  });
  for(const changement of ['relance','ignore','token'])await run(`parent modifié ${changement}`,async(repo,db)=>{
    const f=await fixture(repo,db,1),L=await import('../src/domain/index-lecture.js'),parent={...f.journaux[0],status:'echec',resultat:null,erreur:{raison:'coupe'}};
    const enfants=['left_half','right_half'].map((kind,i)=>({...structuredClone(f.journaux[0]),id:kind,index_call:{...parent.index_call,kind,parent_call_id:'j'},source_capture:{...structuredClone(parent.source_capture),pages:parent.source_capture.pages.map(p=>({...p,zone:{...p.zone,kind,x:i?4:0,width:6},sent_image_sha256:(i?'d':'c').repeat(64)}))}}));
    const journaux=[parent,...enfants];await db.mutate({origin:'remote',puts:{imports:journaux}});
    const lecture={lignes:journaux,pages:[L.reconstruirePageIndex({format:1,page_id:'p',full_call_id:'j',left_call_id:'left_half',right_call_id:'right_half'},journaux)],modeleValide:true};
    const projection=await M.projeterIndexAffiche({lecture,edition:f.edition,recettes:[]}),unites=await M.unitesApplicationIndex({projection});
    const service=M.creerServiceApplicationIndex({repo,serviceSources:f.sourceService}),p=await service.preparerApplicationIndex({...f,journaux,unites});
    eq(p.issue,'ok',`L5 parent ${changement} : plan initial effectivement valide`);
    const changed=structuredClone(parent);if(changement==='relance')changed.started_at='2026-10-30T00:00:00.000Z';if(changement==='ignore')changed.status='ignore';if(changement==='token')changed.source_capture.source_state_revision='autre';
    await db.mutate({origin:'remote',puts:{imports:[changed]}});
    const result=await service.appliquerIndex({plan:p.plan});eq([result.issue,(await repo.all('recipes')).length],['bloque',0],`L5 parent ${changement} : refus causal sans clôture ni références`);
  });
  await run('1200 références issues des deux moitiés',async(repo,db)=>{
    const f=await fixture(repo,db,1),L=await import('../src/domain/index-lecture.js'),parent={...f.journaux[0],status:'echec',resultat:null,erreur:{raison:'coupe'}};
    const enfants=['left_half','right_half'].map((kind,i)=>({...structuredClone(f.journaux[0]),id:kind,index_call:{...parent.index_call,kind,parent_call_id:'j'},source_capture:{...structuredClone(parent.source_capture),pages:parent.source_capture.pages.map(p=>({...p,zone:{...p.zone,kind,x:i?4:0,width:6},sent_image_sha256:(i?'d':'c').repeat(64)}))},resultat:{format:2,pages:[{...f.journaux[0].resultat.pages[0],entrees:Array.from({length:600},(_,n)=>({titre:`${i?'Droite':'Gauche'} ${n}`,renvois:String(n+1),rubrique:null,sorte:'recette',incertain:false}))}]}}));
    const journaux=[parent,...enfants];await db.mutate({origin:'remote',puts:{imports:journaux}});
    const lecture={lignes:journaux,pages:[L.reconstruirePageIndex({format:1,page_id:'p',full_call_id:'j',left_call_id:'left_half',right_call_id:'right_half'},journaux)],modeleValide:true},projection=await M.projeterIndexAffiche({lecture,edition:f.edition,recettes:[]}),unites=await M.unitesApplicationIndex({projection});
    const service=M.creerServiceApplicationIndex({repo,serviceSources:f.sourceService}),p=await service.preparerApplicationIndex({...f,journaux,unites});
    eq([p.issue,p.nombrePortions],['ok',3],'L5 :1200 références et preuves complètes tiennent en trois portions bornées');
    const r=await service.appliquerIndex({plan:p.plan});
    eq([r.issue,(await repo.all('recipes')).length,(await repo.all('imports')).every(r=>r.status==='enregistre')],['complete',1200,true],'L5 :1200 références réellement conservées et les trois journaux clos sans troncature');
  });
}
