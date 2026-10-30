export async function runL5SourcesFormatTests({eq,ok}){
 let m;try{m=await import('../src/domain/sources-format.js');}catch{ok(false,'L5 formats : module commun disponible');return;}
 const refus=fn=>{try{fn();return null;}catch(e){return e.code||e.name;}};
 eq(m.canoniqueSources({'\u{10000}':1,'\ue000':2,z:[null,true,1e-7,1e21,-0]}),'{'+'"z":[null,true,0.0000001,1000000000000000000000,0],"\ue000":2,"\u{10000}":1}','L5 canon : ordre UTF8 et nombres décimaux exacts');
 ok(m.canoniqueSources({x:'é'})!==m.canoniqueSources({x:'e\u0301'}),'L5 canon : aucune normalisation Unicode de preuve');
 for(const value of ['\ud800','\udfff','\u0000',NaN,Infinity,undefined])eq(refus(()=>m.canoniqueSources(value)),'invalid_shape','L5 canon : valeur non représentable refusée');
 eq(await m.empreinteSources({b:2,a:1}),await m.empreinteSources({a:1,b:2}),'L5 canon : ordre des clés sans influence');
 eq(m.pagesActivesSeance({page_ids:['a','b']}),['a','b'],'L5 sélection : ancienne séance conservée');
 eq(m.pagesActivesSeance({page_ids:['a','b'],source_state:{format:1,revision:'r',active_page_ids:['b']}}),['b'],'L5 sélection : historique distinct des pages actives');
 for(const active_page_ids of [['x'],['a','a']])eq(refus(()=>m.pagesActivesSeance({page_ids:['a'],source_state:{format:1,revision:'r',active_page_ids}})),'invalid_shape','L5 sélection : actif absent/doublon refusé sans repli');
 const a={id:'a',edition_id:null,document_id:'d',sha256:'a'.repeat(64)},b={...a,id:'b',rotation:90,source_revision:{format:1,family_id:'a',parent_page_id:'a',operation_id:'o',reason:'rotate'}};
 eq(m.historiquePage('b',new Map([['a',a],['b',b]])).map(x=>x.id),['a','b'],'L5 révisions : chaîne ancienne et nouvelle résolue');
 eq(refus(()=>m.historiquePage('b',new Map([['a',{...a,source_revision:{...b.source_revision,parent_page_id:'b'}}],['b',b]]))),'invalid_shape','L5 révisions : boucle refusée');
 eq(m.projectionIdentitePage({...a,updated_at:'x'}),m.projectionIdentitePage({...a,updated_at:'y'}),'L5 identité : date technique exclue');
 ok(m.canoniqueSources(m.projectionIdentitePage(a))!==m.canoniqueSources(m.projectionIdentitePage({...a,sha256:'b'.repeat(64)})),'L5 identité : nouvelle image distincte');
 ok(m.canoniqueSources(m.projectionAnnotationPage(a))!==m.canoniqueSources(m.projectionAnnotationPage({...a,printed_page:null})),'L5 annotation : absence différente de null');
 const c={protocol:1,op:'source_revision',operation_id:'op',store:'scan_sessions',id:'s',edition_id:null,base_edition_cycle_id:null,payload_sha256:'a'.repeat(64),action:'hide',base_session_sha256:'b'.repeat(64),base_source_revision:null,base_sources:[],new_documents:[],new_pages:[],active_page_ids:[]};
 eq(m.validerCommandeSources(c),c,'L5 commande : séance sans livre admise');
 eq(refus(()=>m.validerCommandeSources({...c,owner_id:'libre'})),'invalid_shape','L5 commande : propriétaire libre interdit');
 eq(refus(()=>m.validerCommandeSources({...c,action:'déplacer'})),'invalid_shape','L5 commande : enum fermé');
 eq(m.octetsJsonbSources({x:'é',n:1e-7}),new TextEncoder().encode('{"x": "é", "n": 0.0000001}').length,'L5 borne : vraie mesure JSONB espaces et exposant');
 eq(refus(()=>m.validerRevisionSource({...a,source_revision:{format:1,family_id:a.id,parent_page_id:null,operation_id:'o',reason:'rotate'}})),'invalid_shape','L5 révision : racine ne peut pas prétendre être une rotation');
 eq(refus(()=>m.validerRevisionSource({...b,source_revision:{...b.source_revision,reason:'capture'}})),'invalid_shape','L5 révision : enfant ne peut pas prétendre être une capture racine');
 const h='a'.repeat(64),entry=(ordinal,occurrences)=>({occurrence_ordinal:ordinal,unit_sha256:h,action:'ecarter',option_sha256:null,applied_ids_sha256:h,applied_ids:[],occurrences:occurrences.map(ordinal=>({journal_id:'j',ordinal,result_sha256:h}))});
 const command={protocol:1,op:'index_apply',operation_id:'op',store:'imports',id:'j',edition_id:'e',base_edition_cycle_id:null,payload_sha256:h,application_id:'a',portion_id:'op',predecessor_operation_id:null,terminal:true,read_set:[{journal_id:'j',result_sha256:h,source_capture_sha256:h}],read_set_sha256:h,source_capture_sha256:h,displayed_result_sha256:h,base_session_sha256:h,base_decision_revision:null,recipe_scope_sha256:h,creates:[],patches:[],decisions:[{journal_id:'j',expected_decision_revision:null,entries:[entry(0,[0,2]),entry(1,[1,2])]}]};
 eq(refus(()=>m.validerCommandeSources(command)),'invalid_shape','L5 index : une occurrence ne peut être résolue par deux unités différentes');

}
