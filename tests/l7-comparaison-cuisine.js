import {withRepo} from './sync-fixture.js';
import {creerServiceCuisine} from '../src/domain/cuisine-persistance.js';
import {adopterProgressionCuisine} from '../src/domain/cuisine-format.js';
import {CLE_SOURCE_CONFIRMEE} from '../src/sync/commandes-sources.js';
const clone=structuredClone,at='2026-10-30T10:00:00.000Z';
export async function fixtureComparaisonCuisine(repo,db,{channel='mirror'}={}){
 await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'u1'}]}});
 const version={id:'cv',recipe_id:'cr',ingredients:[],steps:[{id:'cs',text:'Attendre.',timers:[{seconds:90}]}],servings:2},recipe={id:'cr',original_title:'Pain',current_version_id:'cv'},legacy={id:'cc',recipe_id:'cr',selected_version_ids:['cv'],active_version_id:'cv',status:'active',lang:'fr',servings:2,progress:{done_step_ids:[]}};
 await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version],cook_sessions:[legacy],cook_history:[{id:'ch',recipe_id:'cr',recipe_version_id:'cv',cook_session_id:'cc',notes:'À garder.'}]}});
 let seq=0;const service=creerServiceCuisine({repo,getGeneration:()=>0,maintenant:()=>at,newId:p=>p+'-compare-'+(++seq)}),{portee}=await service.capturerPortee({owner_id:'u1'}),lu=await service.lireSession({portee,sessionId:'cc'}),p=await service.preparerLancement({portee,lecture:lu.lecture,versionId:'cv',stepId:'cs',ordinal:0,choix:'min',channel,snapshots:{recipe_title:'Pain',task_label:'Repos'}}),r=await service.conserverLancement({intention:p.intention});
 if(r.issue!=='conserve')throw Error('fixture cuisine '+JSON.stringify(r));
 const queue=await db.getAll('outbox'),first=queue.find(e=>e.store==='cook_sessions'),timer=await db.get('timer_launches',r.affiche.ligne.id),confirmee={...adopterProgressionCuisine(legacy,[version],'ck_op_'+'e'.repeat(64)),lang:'original'};
 const confirmation={key:CLE_SOURCE_CONFIRMEE('cook_sessions','cc'),value:{user_id:'u1',data:confirmee,server_seq:8,updated_at:at,deleted_at:null}},conflit={id:'cooking:'+first.payload.operation_id,kind:'cooking',store:'cook_sessions',record_id:'cc',user_id:'u1',local:clone(first.payload),operation_id:first.payload.operation_id,server:{data:confirmee,server_seq:8,updated_at:at,deleted_at:null},reason:'progression_changee',at};
 await db.mutate({origin:'remote',puts:{sync_state:[confirmation],sync_conflicts:[conflit],outbox:[{...first,lifecycle_blocked:true,last_error:'progression_changee'}]}});
 return{timer,confirmee,confirmation,conflit,legacy};
}
export async function runL7ComparaisonCuisineTests({eq,ok}){
 let creer;try{({creerComparaisonCuisine:creer}=await import('../src/domain/comparaison-cuisine.js'));}catch{ok(false,'L7 comparaison : service explicite disponible');return;}
 const {egalesCopiesCuisine}=await import('../src/domain/comparaison-cuisine.js');
 ok(!egalesCopiesCuisine({a:undefined},{}),'L7 comparaison : propriété undefined distinguée de son absence');ok(!egalesCopiesCuisine([undefined],Array(1)),'L7 comparaison : trou de tableau distingué de valeur undefined');ok(!egalesCopiesCuisine(JSON.parse('{"__proto__":{"a":1}}'),JSON.parse('{"__proto__":{"a":2}}')),'L7 comparaison : clé hostile comparée comme donnée propre');
 const ouvrir=async(repo,db,options)=>{const f=await fixtureComparaisonCuisine(repo,db,options),s=creer({repo,getGeneration:()=>0,maintenant:()=>at}),p=await s.capturerPortee({owner_id:'u1'}),c=await s.capturerComparaisonCuisine({portee:p.portee,store:'cook_sessions',id:'cc'});return{...f,s,portee:p.portee,c};};
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db);eq(f.c.issue,'ok','L7 comparaison : état exact affichable');eq(f.c.affiche.commandes.length,2,'L7 comparaison : adoption et création dépendante annoncées');eq(f.c.affiche.cibles.length,2,'L7 comparaison : deux cibles montrées avant geste');
  eq((await f.s.garderCuisineConfirmee({comparaison:{...f.c.comparaison}})).issue,'refuse','L7 comparaison : capacité recopiée refusée');
  const r=await f.s.garderCuisineConfirmee({comparaison:f.c.comparaison});eq(r.issue,'conserve','L7 comparaison : choix explicite commité');eq(await db.get('cook_sessions','cc'),f.confirmee,'L7 comparaison : seule confirmation exacte adoptée');eq(await db.get('timer_launches',f.timer.id),undefined,'L7 comparaison : suivi sans confirmation retiré de la vue active');eq((await db.get('cook_history','ch')).notes,'À garder.','L7 comparaison : mémoire de cuisson intacte');eq((await db.getAll('outbox')).length,0,'L7 comparaison : aucune tombale ni écho');
  const autre=creer({repo,getGeneration:()=>0}),p=await autre.capturerPortee({owner_id:'u1'}),recovery=await autre.lireRecuperationsCuisine({portee:p.portee,sessionId:'cc'});eq(recovery.issue,'ok','L7 comparaison : récupération après nouvelle instance');eq(recovery.recuperations.length,1,'L7 comparaison : une copie durable retrouvée');eq(recovery.recuperations[0].recovery.lignes.find(x=>x.store==='timer_launches').data,f.timer,'L7 comparaison : ligne entière et ancre récupérables');eq((await f.s.garderCuisineConfirmee({comparaison:f.c.comparaison})).issue,'deja_conserve','L7 comparaison : réessai exact sans nouvelle réconciliation');
 });
 for(const nom of ['confirmation','commande','compte','epoque','quota','source'])await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db),muter=db.mutate.bind(db);let atteint=false,apres;
  db.mutate=async args=>{if(args.origin==='remote'&&args.puts?.sync_conflicts?.some(x=>x.recovery)&&!atteint){atteint=true;
   if(nom==='quota')throw new DOMException('quota injecté','QuotaExceededError');
   if(nom==='confirmation')await muter({origin:'remote',puts:{sync_state:[{...f.confirmation,value:{...f.confirmation.value,server_seq:9}}]}});
   if(nom==='commande'){const e=(await db.getAll('outbox'))[0];await muter({origin:'device',puts:{outbox:[{...e,seq:999,tries:1}]}});}
   if(nom==='compte')await muter({origin:'device',puts:{sync_state:[{key:'user_id',value:'u2'}]}});
   if(nom==='epoque')await muter({origin:'device',puts:{sync_state:[{key:'editor_library_epoch:v1',value:'autre-epoque'}]}});
   if(nom==='source'){const v=await db.get('recipe_versions','cv');await muter({origin:'remote',puts:{recipe_versions:[{...v,steps:[{...v.steps[0],text:'Autre instruction.'}]}]}});}
   apres=await db.getSnapshot();
  }return muter(args);};
  const avant=await db.getSnapshot();try{const r=await f.s.garderCuisineConfirmee({comparaison:f.c.comparaison});ok(['refuse','echec'].includes(r.issue),'L7 comparaison : '+nom+' concurrent refuse');ok(atteint,'L7 comparaison : '+nom+' atteint la transaction');eq(await db.getSnapshot(),apres||avant,'L7 comparaison : '+nom+' sans perte partielle');}finally{db.mutate=muter;}
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db);await db.mutate({origin:'device',puts:{outbox:[{seq:999,op:'put',store:'timer_launches',id:f.timer.id,user_id:'u1',tries:0}]}});
  const r=await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'});eq(r.raison,'operations_dependantes','L7 comparaison : protocole étranger dépendant jamais absorbé');
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db),tiers={id:'timer-tiers',cook_session_id:'cc',duration_seconds:30,channel:'siri'};
  await db.mutate({origin:'remote',puts:{timer_launches:[tiers],outbox:[{seq:999,op:'put',store:'timer_launches',id:tiers.id,user_id:'u1',snapshot:tiers,tries:0}]}});
  eq((await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'})).raison,'operations_dependantes','L7 comparaison : ancien put tiers de la séance refuse sans indépendance démontrée');
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db),ailleurs={...clone(f.timer),mirror:{format:1,started_at:'2026-10-30T11:00:00.000Z',deadline_at:'2026-10-30T11:01:30.000Z'}};
  await db.mutate({origin:'remote',puts:{sync_state:[{key:CLE_SOURCE_CONFIRMEE('timer_launches',f.timer.id),value:{user_id:'u1',server_seq:9,data:ailleurs,updated_at:at,deleted_at:null}}]}});
  const c=await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'});eq(c.affiche.cibles.find(x=>x.id===f.timer.id).confirmee.mirror,ailleurs.mirror,'L7 comparaison : confirmation de chaque enfant réellement affichée');
  const r=await f.s.garderCuisineConfirmee({comparaison:c.comparaison});eq(r.issue,'conserve','L7 comparaison : chaîne avec enfant confirmé acceptée');eq(await db.get('timer_launches',f.timer.id),ailleurs,'L7 comparaison : ancre enfant confirmée exacte, sans déplacement');
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db),enfant={...clone(f.timer),id:'enfant-historique',legacy_launch_id:f.timer.id,source_timer:null,step_id:null};
  await db.mutate({origin:'remote',puts:{timer_launches:[enfant]}});
  const c=await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'});eq(c.affiche.cibles.length,3,'L7 comparaison : enfant historique inclus dans aperçu');
  const r=await f.s.garderCuisineConfirmee({comparaison:c.comparaison});eq(r.issue,'conserve','L7 comparaison : fermeture des enfants historiques');eq(await db.get('timer_launches',enfant.id),undefined,'L7 comparaison : enfant sans confirmation retiré de la vue active');
  const reprises=await f.s.lireRecuperationsCuisine({portee:f.portee,sessionId:'cc'});eq(reprises.recuperations[0].recovery.lignes.find(x=>x.id===enfant.id).data,enfant,'L7 comparaison : enfant historique intégralement récupérable');
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db),a=f.s.garderCuisineConfirmee({comparaison:f.c.comparaison}),b=f.s.garderCuisineConfirmee({comparaison:f.c.comparaison});
  const rs=await Promise.all([a,b]);ok(rs.every(r=>['conserve','deja_conserve'].includes(r.issue)),'L7 comparaison : double geste rejoint la même réconciliation');eq((await f.s.lireRecuperationsCuisine({portee:f.portee,sessionId:'cc'})).recuperations.length,1,'L7 comparaison : aucune copie supplémentaire sur double geste');
 });
 for(const owner of [null,'autre-compte'])await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db),file=(await db.getAll('outbox')).map(e=>({...e,user_id:owner}));await db.mutate({origin:'device',puts:{outbox:file}});
  const c=await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'});
  if(owner===null){eq(c.issue,'ok','L7 comparaison : première liaison prouvée par conflit nommé admise');if(c.issue==='ok'){eq((await f.s.garderCuisineConfirmee({comparaison:c.comparaison})).issue,'conserve','L7 comparaison : dépendantes anonymes exactes récupérées avec la chaîne');}}
  else eq(c.raison,'compte_change','L7 comparaison : intention d’un autre compte nommé refusée');
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db);await db.mutate({origin:'remote',puts:{outbox:(await db.getAll('outbox')).map(e=>({...e,user_id:null})),sync_conflicts:[{...f.conflit,user_id:null}]}});
  eq((await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'})).raison,'compte_change','L7 comparaison : absence de conflit nommé ne permet aucune adoption anonyme');
 });
 for(const seq of [8.5,Number.MAX_SAFE_INTEGER+1])await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db);await db.mutate({origin:'remote',puts:{sync_state:[{...f.confirmation,value:{...f.confirmation.value,server_seq:seq}}]}});
  eq((await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'})).raison,'confirmation_incomplete','L7 comparaison : séquence serveur non entière ou imprécise refusée');
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db),{signerCommandeCuisine,projectionIdentiteMinuteur}=await import('../src/domain/cuisine-format.js'),{empreinteSources}=await import('../src/domain/sources-format.js'),{appliquerTransitionCuisine}=await import('../src/domain/cuisine-mutations.js');
  const row={...clone(f.timer),id:'demande-independante',channel:'shortcut',requested_at:at,handoff_state:'requested',mirror:null};
  await db.mutate({origin:'remote',puts:{timer_launches:[row],sync_state:[{key:CLE_SOURCE_CONFIRMEE('timer_launches',row.id),value:{user_id:'u1',data:row,server_seq:4,updated_at:at,deleted_at:null}}]}});
  const c=await signerCommandeCuisine({protocol:1,op:'cooking_apply',store:'timer_launches',id:row.id,action:'handoff',nonce:'handoff-independant',base:{identity_sha256:await empreinteSources(projectionIdentiteMinuteur(row)),handoff_state:'requested'},change:{handoff_state:'failed'},contexts:{recipes:[],editions:[]}}),next=appliquerTransitionCuisine(c,row,{attendue:row});
  await db.mutate({origin:'local',puts:{timer_launches:[next]},cooking_commands:[c],conditions:{timer_launches:[{key:row.id,fusion:()=>null}]}});
  const p=await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'});eq(p.affiche.cibles.length,2,'L7 comparaison : déclaration indépendante exclue de la fermeture de séance');
  eq((await f.s.garderCuisineConfirmee({comparaison:p.comparaison})).issue,'conserve','L7 comparaison : séance résolue sans absorber déclaration');
  eq(await db.get('timer_launches',row.id),next,'L7 comparaison : déclaration indépendante locale intacte');eq((await db.getAll('outbox')).map(e=>e.payload.operation_id),[c.operation_id],'L7 comparaison : demande indépendante reste à synchroniser');
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db,{channel:'shortcut'}),service=creerServiceCuisine({repo,getGeneration:()=>0}),{portee}=await service.capturerPortee({owner_id:'u1'}),lu=await service.lireMinuteurs({portee,sessionId:'cc'}),p=await service.preparerSignalement({portee,lancement:lu.demandes[0].lancement,etat:'opening'});
  eq((await service.signalerDemande({intention:p.intention})).issue,'conserve','L7 comparaison : déclaration suivant création préparée');
  const c=await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'});eq(c.affiche.commandes.length,3,'L7 comparaison : déclaration suivant création incluse dans chaîne exacte');
  eq((await f.s.garderCuisineConfirmee({comparaison:c.comparaison})).issue,'conserve','L7 comparaison : chaîne création puis déclaration résolue explicitement');eq((await db.getAll('outbox')).length,0,'L7 comparaison : aucune déclaration orpheline laissée après création récupérée');
 });
 await withRepo(async(repo,db)=>{
  const f=await ouvrir(repo,db);await db.mutate({origin:'remote',puts:{recipes:[{id:'recette-historique',display_title:undefined}]}});
  const c=await f.s.capturerComparaisonCuisine({portee:f.portee,store:'cook_sessions',id:'cc'});eq((await f.s.garderCuisineConfirmee({comparaison:c.comparaison})).issue,'conserve','L7 comparaison : champ undefined historique n’interdit pas un choix indépendant');ok(Object.hasOwn(await db.get('recipes','recette-historique'),'display_title'),'L7 comparaison : aucune normalisation de la recette historique');
 });
}
