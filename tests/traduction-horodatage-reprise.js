import {withRepo} from './sync-fixture.js';
import {withDatabase} from './backup.js';
import {creerDepotTraductions} from '../src/domain/depot-traductions.js';
import {capturerSourceTraduction,validerLigneTraductionV2,validerJournalTraduction,lireTraductionV2} from '../src/domain/traductions-format.js';

const DATE='2026-10-31T17:17:48.168346+00:00',ISO='2026-10-31T17:17:48.168Z',EPOCH='editor_library_epoch:v1';
const motif=async f=>{try{await f();return null;}catch(e){return e.code||e.name;}};
async function fixture(repo,db){
 const recipe={id:'reprise-date-r',original_title:'Bread',original_language:'en',availability:'available',current_version_id:'reprise-date-v'},version={id:recipe.current_version_id,recipe_id:recipe.id,servings:2,ingredients:Array.from({length:31},(_,i)=>({id:'ingredient-'+i,name_text:'flour',source_text:'200 g flour',quantity:{value:200,raw:'200'},unit_id:'g'})),steps:[{id:'step-1',text:'Mix.'},{id:'step-2',text:'Rest 20 min.'}]};
 await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version],sync_state:[{key:'user_id',value:'u1'}]}});
 const source=await capturerSourceTraduction({recipe,version}),tr={id:'reprise-date-tr',recipe_version_id:version.id,locale:'fr',alignment_format:2,source_signature:source.source_signature,source_locale:source.source_locale,revision:'tr_op_'+'a'.repeat(64),translated_content:{format:2,segments:source.segments.map(s=>({kind:s.kind,source_id:s.source_id,field:s.field,source_sha256:s.source_sha256,text:'Traduction : '+s.text,origin:'manual',journal_id:null}))},verification_state:'unverified',publication_receipts:[],publication_receipt_floor:0,created_at:ISO,updated_at:ISO};
 const depot=creerDepotTraductions({repo,getGeneration:()=>0}),p=await depot.capturerPortee({owner_id:'u1'}),o=await depot.ouvrirTraduction({portee:p.portee,affiche:{recipe,version,traductions:[]},locale:'fr'}),plan=await depot.preparerLectureTraduction({session:o.session,selection:[source.segments[0].ref]}),reservation=await depot.reserverPortionTraduction({plan:plan.plan,ordinal:0}),depart=await depot.commencerPortionTraduction({reservation:reservation.reservation});
 const text=JSON.stringify({format:1,segments:[{ref:source.segments[0].ref,text:'Pain'}]});
 const recu=await depot.conserverReponseTraduction({vol:depart.vol,reponse:{text,stopReason:'end_turn',model:null,raison:null,reponseBrute:new TextEncoder().encode(text)}});if(recu.issue!=='conserve')throw Error('Fixture réponse non conservée');
 const journal=await db.get('imports',reservation.journalId),bruts=await db.getSnapshot(['sync_state']);
 await db.mutate({origin:'device',clearStores:['outbox'],puts:{recipe_translations:[{...tr,updated_at:DATE}],imports:[{...journal,updated_at:DATE}]}});
 return{recipe,version,source,tr,journal,bruts};
}

export async function runTraductionHorodatageRepriseTests({eq,ok}){
 const cas=async(nom,fn)=>{try{await withRepo(fn);}catch(e){ok(false,'Horodatage reprise '+nom+' : '+(e.stack||e));}};
 await cas('init réel',async(repo,db)=>{
  const f=await fixture(repo,db),conf={key:'source_confirmed:recipe_translations:'+f.tr.id,value:{data:{...f.tr,updated_at:DATE},updated_at:DATE,server_seq:31,user_id:'u1',deleted_at:null}},conflit={id:'documentation-traduction',kind:'translation',store:'recipe_translations',record_id:f.tr.id,local:{...f.tr,updated_at:DATE},resolution:{choix:'documentaire'}};
  await db.mutate({origin:'device',puts:{sync_state:[conf],sync_conflicts:[conflit]}});
  eq(lireTraductionV2(await db.get('recipe_translations',f.tr.id),f.source).etat,'invalide','Horodatage : défaut de date reproduit avant init');
  eq(f.tr.translated_content.segments.length,65,'Horodatage : témoin synthétique de 65 passages distincts');
  const avant=await db.getSnapshot(['recipes','recipe_versions','sync_state','sync_conflicts','outbox']);
  await repo.init();
  eq(await db.get('recipe_translations',f.tr.id),f.tr,'Horodatage : init répare uniquement la date de traduction');
  eq(await db.get('imports',f.journal.id),{...f.journal,updated_at:ISO},'Horodatage : init répare uniquement la date du journal reçu');
  eq(lireTraductionV2(await db.get('recipe_translations',f.tr.id),f.source).couverture,{attendus:65,traduits:65,manquants:0,perimes:0},'Horodatage : 65 traductions relisibles sans nouvel appel');
  eq(await db.getSnapshot(['recipes','recipe_versions','sync_state','sync_conflicts','outbox']),avant,'Horodatage : sources, bruts, confirmation, conflit et file strictement inchangés');
  const apres=await db.getSnapshot();await repo.init();eq(await db.getSnapshot(),apres,'Horodatage : deuxième init sans mutation');
 });
 let helper;try{helper=await import('../src/domain/traduction-horodatage.js');}catch{ok(false,'Horodatage : helper ciblé disponible');return;}
 await cas('format strict',async(repo,db)=>{
  const f=await fixture(repo,db),reparer=helper.reparerHorodatageTraduction;
  for(const[store,row,valider]of [['recipe_translations',f.tr,validerLigneTraductionV2],['imports',f.journal,validerJournalTraduction]]){
   eq(reparer(store,row),null,'Horodatage : ligne valide inchangée '+store);
   for(const date of [DATE,'2026-10-31T17:17:48.168346Z','2026-10-31T17:17:48+00:00','2026-10-31T17:17:48.1+00:00']){
    const mauvaise={...row,updated_at:date},avant=JSON.stringify(mauvaise),corrigee=reparer(store,mauvaise);
    eq(corrigee,{...row,updated_at:new Date(date).toISOString()},'Horodatage : seul updated_at normalisé '+store+' '+date);
    ok(valider(corrigee).ok,'Horodatage : résultat passe le valideur strict '+store+' '+date);
    eq(JSON.stringify(mauvaise),avant,'Horodatage : entrée du helper intacte '+store+' '+date);
   }
   for(const date of ['2026-02-30T17:17:48.168346+00:00','2026-10-31T24:00:00+00:00','2026-10-31T17:17:48.168346+01:00',DATE+'\n','2026-10-31','2026-10-31T17:17:48.1683467Z'])eq(reparer(store,{...row,updated_at:date}),null,'Horodatage : date hors format refusée '+store+' '+JSON.stringify(date));
   eq(reparer(store,{...row,created_at:DATE,updated_at:DATE}),null,'Horodatage : ne corrige aucune autre date '+store);
   eq(reparer(store,{...row,updated_at:DATE,champ_inconnu:true}),null,'Horodatage : autre défaut de forme non réparé '+store);
  }
  eq(reparer('recipe_translations',{...f.tr,alignment_format:1,updated_at:DATE}),null,'Horodatage : traduction legacy exclue');
  eq(reparer('imports',{...f.journal,kind:'recette',updated_at:DATE}),null,'Horodatage : autre import exclu');
 });
 for(const mode of ['cible','version','journal','quarantaine'])await cas('file '+mode,async(repo,db)=>{
  const f=await fixture(repo,db),entree=mode==='cible'?{seq:901,user_id:'u1',store:'recipe_translations',id:f.tr.id,op:'put',snapshot:f.tr}:mode==='journal'?{seq:901,user_id:'u1',store:'imports',id:'autre',op:'translation_apply',payload:{journal_read_set:[{journal_id:f.journal.id}]}}:{seq:901,user_id:'u1',store:'recipe_translations',id:'autre-candidate',op:'translation_apply',payload:{recipe_version_id:f.tr.recipe_version_id},...(mode==='quarantaine'?{quarantined_at:ISO,last_error:'forme'}:{})};
  await db.mutate({origin:'device',puts:{outbox:[entree]}});const cible=mode==='journal'?'imports':'recipe_translations',id=cible==='imports'?f.journal.id:f.tr.id,avant=await db.get(cible,id);await repo.reparerHorodatagesTraduction();
  eq(await db.get(cible,id),avant,'Horodatage : intention pendante préserve sa ligne '+mode);
  eq(await db.get('outbox',901),entree,'Horodatage : intention exacte préservée '+mode);
  await db.mutate({origin:'device',deletes:{outbox:[901]}});await repo.reparerHorodatagesTraduction();eq((await db.get(cible,id)).updated_at,ISO,'Horodatage : réparable après résolution explicite de la file '+mode);
 });
 for(const type of ['compte','epoque','ligne','file','liaison','connexion'])await cas('course '+type,async(repo,db)=>{
  const f=await fixture(repo,db),muter=db.mutate.bind(db),avant={tr:await db.get('recipe_translations',f.tr.id),journal:await db.get('imports',f.journal.id)};let injecte=false;
  db.mutate=async options=>{if(!injecte&&options.origin==='device'&&options.conditions?.recipe_translations){injecte=true;
   if(type==='compte')await muter({origin:'device',puts:{sync_state:[{key:'user_id',value:'u2'}]}});
   if(type==='epoque')await muter({origin:'device',puts:{sync_state:[{key:EPOCH,value:'autre-epoque'}]}});
   if(type==='ligne')await muter({origin:'device',puts:{recipe_translations:[{...avant.tr,verification_state:'changee-ailleurs'}]}});
   if(type==='file')await muter({origin:'device',puts:{outbox:[{seq:902,user_id:'u1',store:'recipe_translations',id:f.tr.id,op:'put'}]}});
   if(type==='liaison')repo.bindDatabase(db);
   if(type==='connexion'){db.idb.close();db.idb=null;await db.open();}
  }return muter(options);};
  let code;try{code=await motif(()=>repo.reparerHorodatagesTraduction());}finally{db.mutate=muter;}
  const codes={compte:'TRANSLATION_REPAIR_ACCOUNT_CHANGED',epoque:'TRANSLATION_REPAIR_LIBRARY_CHANGED',ligne:'TRANSLATION_REPAIR_ROW_CHANGED',file:'TRANSLATION_REPAIR_OUTBOX_CHANGED',liaison:'TRANSLATION_REPAIR_BASE_CHANGED',connexion:'TRANSLATION_REPAIR_BASE_CHANGED'};
  ok(injecte,'Horodatage : course effectivement atteinte '+type);eq(code,codes[type],'Horodatage : motif exact de la course '+type);
  eq(await db.get('recipe_translations',f.tr.id),type==='ligne'?{...avant.tr,verification_state:'changee-ailleurs'}:avant.tr,'Horodatage : traduction préservée après course '+type);
  eq(await db.get('imports',f.journal.id),avant.journal,'Horodatage : rollback du journal après course '+type);
 });
 await cas('autre base',async(repo,db)=>withDatabase(async autre=>{
  const f=await fixture(repo,db),muter=db.mutate.bind(db);db.mutate=async options=>{if(options.conditions?.recipe_translations)repo.bindDatabase(autre);return muter(options);};let code;try{code=await motif(()=>repo.reparerHorodatagesTraduction());}finally{db.mutate=muter;repo.bindDatabase(db);}
  eq(code,'TRANSLATION_REPAIR_BASE_CHANGED','Horodatage : nouvelle base refusée avant écriture');eq((await db.get('recipe_translations',f.tr.id)).updated_at,DATE,'Horodatage : ancienne base intacte');eq(await autre.count('recipe_translations'),0,'Horodatage : aucune écriture dans la nouvelle base');
 }));
}
