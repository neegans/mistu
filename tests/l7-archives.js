import {withDatabase} from './backup.js';
import {withRepo} from './sync-fixture.js';
import {createArchive,inspectArchive,applyArchive,verifyRestored} from '../src/domain/backup.js';
import {createZip,readZip,textOf} from '../src/core/zip.js';
import {sha256Hex} from '../src/core/hash.js';
import {adopterProgressionCuisine,lireRecuCuisine} from '../src/domain/cuisine-format.js';
const clone=structuredClone,erreur=async f=>{try{await f();return null;}catch(e){return e;}};
const op='ck_op_'+'a'.repeat(64),at='2026-10-30T10:00:00.000Z';
async function fixture(db){
 const version={id:'l7-version',recipe_id:'l7-recette',kind:'original',ingredients:[],steps:[{id:'etape',text:'Attendre.\u0001',timers:[{seconds:90}]}]},recipe={id:'l7-recette',original_title:'Pain',current_version_id:version.id};
 const session=adopterProgressionCuisine({id:'l7-seance',recipe_id:recipe.id,status:'active',selected_version_ids:[version.id],active_version_id:version.id,lang:'fr',progress:{current_step_id:'etape',done_step_ids:[]},commentaire:'Garder\u0001 ce texte.',created_at:at,updated_at:at},[version],op);
 const timer={id:'l7-minuteur',timer_format:1,cook_session_id:session.id,recipe_version_id:version.id,step_id:'etape',device_id:'appareil-historique',duration_seconds:90,channel:'shortcut',requested_at:at,handoff_state:'opening',source_timer:{ordinal:0,seconds:90,seconds_max:null,sha256:'b'.repeat(64)},legacy_launch_id:null,recipe_title_snapshot:'Pain\u0001 ancien',task_label_snapshot:'Repos\nà couvert',mirror:{format:1,started_at:at,deadline_at:'2026-10-30T10:01:30.000Z'},cooking_incarnation:op,cooking_revision:op,cooking_receipts:[{operation_id:op,payload_sha256:'c'.repeat(64)}],cooking_receipt_floor:0,created_at:at,updated_at:at};
 const siri={...clone(timer),id:'l7-siri',channel:'siri',handoff_state:'siri',mirror:null};
 const legacy={id:'l7-ancien',cook_session_id:session.id,recipe_version_id:version.id,channel:'siri',duration_seconds:30,requested_at:at,created_at:at,updated_at:at};
 const history={id:'l7-bilan',cook_session_id:session.id,recipe_id:recipe.id,recipe_version_id:version.id,notes:'Fin de cuisson.',quantities_snapshot:[{ingredient_id:'farine',source_text:'Farine\u0001 complète'}]};
 await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version],cook_sessions:[session],timer_launches:[timer,siri,legacy],cook_history:[history]}});return{session,timer,siri,legacy,history};
}
async function transformer(archive,changer){
 const zip=readZip(await archive.blob.arrayBuffer()),manifest=JSON.parse(textOf(zip.get('manifest.json'))),stores={};
 for(const f of manifest.data_files)stores[f.store]=JSON.parse(textOf(zip.get(f.path)));changer(stores,manifest);
 const data=new Map();for(const f of manifest.data_files){const bytes=new TextEncoder().encode(JSON.stringify(stores[f.store]));f.sha256=await sha256Hex(bytes);f.count=stores[f.store].length;manifest.counts[f.store]=f.count;data.set(f.path,bytes);}
 return inspectArchive(createZip([...zip].map(([path,e])=>({path,data:path==='manifest.json'?JSON.stringify(manifest):data.get(path)||e.data}))));
}
export async function runL7ArchivesTests({eq,ok}){
 let archive,source;await withDatabase(async db=>{source=await fixture(db);archive=await createArchive(db);});
 eq(archive.manifest.format_version,7,'L7 archive : format7 annoncé pour les échéances persistantes');
 const inspection=await inspectArchive(await archive.blob.arrayBuffer());eq(inspection.errors,[],'L7 archive : forme valide inspectée');
 await withDatabase(async db=>{
  const alteree=clone(inspection);alteree.payload.stores.timer_launches.find(x=>x.id===source.timer.id).mirror.deadline_at=at;
  eq((await erreur(()=>applyArchive(db,alteree)))?.message, "Archive non validée : Séance ou minuteur invalide : ancre_invalide",'L7 archive : preuve altérée après inspection refusée avant écriture');eq((await db.getAll('timer_launches')).length,0,'L7 archive : refus avant écriture sans minuteur partiel');
  const ancien=clone(inspection);ancien.manifest.format_version=5;
  eq((await erreur(()=>applyArchive(db,ancien)))?.message, "Archive non validée : Les séances et minuteurs persistants exigent le format 6.",'L7 archive : format abaissé après inspection encore refusé');
 });
 for(const format of[1,2,3,4,5])ok(!(await transformer(archive,(s,m)=>m.format_version=format)).ok,'L7 archive : formes réservées refusées sous format'+format);
 ok(!(await transformer(archive,s=>s.timer_launches.find(x=>x.id===source.timer.id).mirror.deadline_at=at)).ok,'L7 archive : échéance incohérente refusée à inspection');
 for(const mode of['merge','replace'])await withRepo(async(repo,db)=>{
  let result;try{result=await applyArchive(db,inspection,{mode});}catch(e){ok(false,'L7 archive '+mode+' : restauration possible — '+e.message);return;}
  const timer=await db.get('timer_launches',source.timer.id),session=await db.get('cook_sessions',source.session.id),outbox=await db.getAll('outbox');
  eq(timer.mirror,source.timer.mirror,'L7 archive '+mode+' : départ et échéance exacts');eq(timer.recipe_title_snapshot,source.timer.recipe_title_snapshot,'L7 archive '+mode+' : texte documentaire non nettoyé');eq(session.commentaire,source.session.commentaire,'L7 archive '+mode+' : extension historique exacte');
  eq((await db.get('recipe_versions','l7-version')).steps[0].text,'Attendre.\u0001','L7 archive '+mode+' : texte de version référencée exact même sans traduction');
  eq((await db.get('cook_history',source.history.id)).quantities_snapshot,source.history.quantities_snapshot,'L7 archive '+mode+' : photographie des quantités du bilan conservée exactement');
  eq((await db.get('timer_launches',source.siri.id)).mirror,null,'L7 archive '+mode+' : demande Siri sans alarme ou ancre fabriquée');eq(await db.get('timer_launches',source.legacy.id),source.legacy,'L7 archive '+mode+' : demande ancienne sans migration implicite');
  ok(timer.cooking_incarnation!==source.timer.cooking_incarnation,'L7 archive '+mode+' : incarnation neuve du minuteur');ok(session.cooking_state.incarnation!==source.session.cooking_state.incarnation,'L7 archive '+mode+' : incarnation neuve de séance');eq(timer.cooking_receipt_floor,1,'L7 archive '+mode+' : ancien reçu hors zone fiable');eq(lireRecuCuisine(timer,{store:'timer_launches',...source.timer.cooking_receipts[0]}),null,'L7 archive '+mode+' : ancien reçu ne prouve aucun geste actuel');
  const commands=outbox.filter(x=>x.op==='cooking_apply');eq(commands.length,3,'L7 archive '+mode+' : une commande fermée par ligne protégée');eq(outbox.filter(x=>x.op==='put'&&[source.timer.id,source.siri.id,source.session.id].includes(x.id)).length,0,'L7 archive '+mode+' : aucun put ordinaire des nouvelles formes');
  ok((await verifyRestored(db,inspection,{mode,normalisationsCuisine:result.normalisationsCuisine})).ok,'L7 archive '+mode+' : normalisations effectivement relues');
  const avant=await db.getSnapshot();eq((await erreur(()=>applyArchive(db,inspection,{mode})))?.code, "restauration_changee",'L7 archive '+mode+' : ancien ZIP divergent refusé au nouveau geste');eq(await db.getSnapshot(),avant,'L7 archive '+mode+' : refus sans perte partielle');
  await db.mutate({origin:'remote',puts:{cook_sessions:[{...session,progress:{...session.progress,by_version:{...session.progress.by_version,'l7-version':{...session.progress.by_version['l7-version'],done_step_ids:['etape']}}}}]}});
  ok(!(await verifyRestored(db,inspection,{mode,normalisationsCuisine:result.normalisationsCuisine})).ok,'L7 archive '+mode+' : les normalisations ne masquent pas une progression différente');
 });
 await withDatabase(async db=>{
  await fixture(db);let atteinte=false,apres;
  const facade=Object.assign(Object.create(db),{mutate:async opts=>{if(opts.archive_import&&!atteinte){atteinte=true;const row=await db.get('timer_launches',source.timer.id);await db.mutate({origin:'remote',puts:{timer_launches:[{...row,handoff_state:'failed'}]}});apres=await db.getSnapshot();}return db.mutate(opts);}});
  eq((await erreur(()=>applyArchive(facade,inspection)))?.code, "sources_divergentes",'L7 archive : minuteur changé après préparation : snapshot divergent refuse le commit');ok(atteinte,'L7 archive : course atteint la transaction');eq(await db.getSnapshot(),apres,'L7 archive : nouvelle preuve concurrente et bibliothèque intactes');
 });
 await withRepo(async(repo,db)=>{
  const avant=await db.getSnapshot(),hook=db.onMutate;let atteint=false;
  db.onMutate=args=>{if(args.archive_import&&args.cooking_commands?.length){atteint=true;throw new DOMException('quota injecté','QuotaExceededError');}return hook?.(args);};
  try{eq((await erreur(()=>applyArchive(db,inspection)))?.name, "QuotaExceededError",'L7 archive : quota transactionnel signalé');ok(atteint,'L7 archive : quota atteint les commandes de restauration');eq(await db.getSnapshot(),avant,'L7 archive : quota ne laisse ni livre ni minuteur ni file partiels');}
  finally{db.onMutate=hook;}
 });
 for(const format of[1,2,3,4,5])await withDatabase(async db=>{await db.mutate({origin:'remote',puts:{timer_launches:[{id:'ancien',channel:'siri'}]}});ok((await transformer(await createArchive(db),(s,m)=>m.format_version=format)).ok,'L7 archive : ancien format'+format+' documentaire encore admis');});
}
