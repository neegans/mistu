import {withRepo} from './sync-fixture.js';
import {withDatabase} from './backup.js';
import {createPull} from '../src/sync/pull.js';
import {creerTransportFactice} from './transport-factice.js';
import {preparerStockageIndex,reconstruireResultatIndex} from '../src/domain/index-stockage.js';
import {validerPageIndex} from '../src/domain/index-livre.js';
import {canoniqueSources} from '../src/domain/sources-format.js';

const CLE='reparation_imports_geres',EPOCH='editor_library_epoch:v1',ancien='2010-01-01T00:00:00.000Z';
const ligne=(id,extra={})=>({id,kind:'recette',status:'enregistre',created_at:ancien,updated_at:ancien,...extra});
const motif=async f=>{try{await f();return null;}catch(e){return e?.code??e?.message;}};
async function ancienneInstallation(db){await db.mutate({origin:'device',deletes:{sync_state:[CLE]},puts:{sync_state:[{key:'user_id',value:'u1'},{key:EPOCH,value:'ancienne-bibliotheque'},{key:'cursor:imports',value:50}]}});}
async function suppressionCapturee(db,row,{quarantaine=false,user='u1'}={}){
 await db.mutate({origin:'remote',puts:{imports:[row]}});
 await db.mutate({origin:'local',deletes:{imports:[row.id]},payloads:{imports:{[row.id]:row}}});
 const entree=(await db.getAll('outbox')).find(e=>e.store==='imports'&&e.id===row.id&&e.op==='delete');
 await db.mutate({origin:'device',puts:{outbox:[{...entree,user_id:user,...(quarantaine?{quarantined_at:'2026-10-30T00:00:00.000Z',last_error:'forme'}:{})}]}});
 return await db.get('outbox',entree.seq);
}

export async function runAuditPurgeImportsTests({eq,ok}){
 const bloc=async(nom,f)=>{try{await f();}catch(e){ok(false,'audit B2 '+nom+' : '+(e.stack||e));}};
 await bloc('marqueurs',async()=>{
  const {estImportGere}=await import('../src/domain/imports-geres.js');
  for(const cle of ['index_storage','source_capture','index_call','translation_call','translation_capture','source_revision','source_state','source_copy','translation_resolutions']){
   eq(estImportGere({[cle]:{}}),true,'audit B2 : marqueur '+cle+' protège la ligne');
   eq(estImportGere({[cle]:null}),true,'audit B2 : présence '+cle+' à null protège aussi la ligne');
  }
  eq(estImportGere({kind:'traduction'}),true,'audit B2 : journal traduction sans autre marqueur conservé');
  for(const r of [{kind:'recette'},{kind:'index'},null,[],Object.create({index_storage:{}})])eq(estImportGere(r),false,'audit B2 : ligne ordinaire ou marqueur hérité non géré');
 });
 const journal=ligne('audit-index',{kind:'index',edition_id:'ed',scan_session_id:'ss',page_ids:['p'],owner_id:'u1',index_call:{format:1,series_id:'serie',page_id:'p',kind:'full',parent_call_id:null},source_capture:{format:2,session_id:'ss',source_state_revision:null,selected_page_ids:['p'],pages:[{id:'p',identity_sha256:'a'.repeat(64),annotation_sha256:'b'.repeat(64),preparation_version:'index-image-v1',zone:{kind:'full',x:0,y:0,width:100,height:100,source_width:100,source_height:100},sent_image_sha256:'c'.repeat(64)}]}});
 const resultat={format:2,pages:[{page_id:'p',etat:'lue',moities:0,modele:null,...validerPageIndex({sorte_page:'table',entrees:Array.from({length:200},(_,i)=>['🍞'.repeat(196)+String(i).padStart(4,'0'),'🍐'.repeat(80),'🍎'.repeat(120),'recette',false]),incertain:[]})}]};
 const packed=await preparerStockageIndex({journal,resultat},{newId:(()=>{let n=0;return()=> 'audit-fragment-'+(++n);})()});
 const index=[packed.journal,...packed.fragments].map(r=>({...r,created_at:ancien,updated_at:ancien,status:'enregistre'}));
 await bloc('purge réelle',()=>withRepo(async(repo,db)=>{
  await ancienneInstallation(db);const traduction=ligne('audit-traduction',{kind:'traduction'}),ordinaire=ligne('audit-ordinaire',{status:'ignore'});
  await db.mutate({origin:'remote',puts:{imports:[...index,traduction,ordinaire]}});await repo.init();
  eq((await db.getAll('imports')).map(r=>r.id).sort(),[...index,traduction].map(r=>r.id).sort(),'audit B2 : manifeste, fragments et traduction de plus de 30 jours restent, import ordinaire purgé');
  eq((await db.getAll('outbox')).filter(e=>e.op==='delete').map(e=>e.id),[ordinaire.id],'audit B2 : aucune tombale émise pour une ligne gérée');
  eq(canoniqueSources(await reconstruireResultatIndex({journal:await db.get('imports',journal.id),imports:await db.getAll('imports')})),canoniqueSources(resultat),'audit B2 : index payé encore reconstructible après la purge');
 }));
 for(const [nom,patch]of [['marqueur',{index_storage:null}],['date',{updated_at:'2099-01-01T00:00:00.000Z'}]])await bloc('course purge '+nom,()=>withRepo(async(repo,db)=>{
  const row=ligne('audit-course-'+nom);await db.mutate({origin:'remote',puts:{imports:[row]}});const lire=db.byIndex.bind(db);let fait=false;
  db.byIndex=async(...args)=>{const rows=await lire(...args);if(!fait&&args[0]==='imports'&&args[2]==='enregistre'){fait=true;await db.mutate({origin:'remote',puts:{imports:[{...row,...patch}]}});}return rows;};
  try{await repo.init();}finally{db.byIndex=lire;}
  eq(await db.get('imports',row.id),{...row,...patch},'audit B2 : '+nom+' changé après sélection annule la purge');
  eq((await db.getAll('outbox')).filter(e=>e.id===row.id).length,0,'audit B2 : course '+nom+' ne produit aucune tombale');
 }));
 await bloc('réparation et réception',()=>withRepo(async(repo,db)=>{
  await ancienneInstallation(db);
  const retire=await suppressionCapturee(db,index[1],{quarantaine:true});
  const pending=await suppressionCapturee(db,ligne('audit-pending',{translation_capture:null}));
  const autre=await suppressionCapturee(db,ligne('audit-autre-compte',{kind:'traduction'}),{quarantaine:true,user:'u2'});
  const ownerPayload=await suppressionCapturee(db,ligne('audit-autre-payload',{kind:'traduction',owner_id:'u2'}),{quarantaine:true});
  const ordinaire=await suppressionCapturee(db,ligne('audit-delete-ordinaire'),{quarantaine:true});
  const brut={key:'translation_response:v1:audit-paid',value:{body:'réponse déjà payée',state:'received'}},progression={key:'lecture-index:audit-paid',value:{p:'index déjà reçu'}};
  await db.mutate({origin:'device',puts:{outbox:[{seq:1000,user_id:'u1',store:'imports',id:'audit-put',op:'put',payload:{kind:'traduction'},tries:0}],sync_state:[brut,progression]}});
  await db.mutate({origin:'remote',puts:{imports:[index[0],...index.slice(2)]}});
  eq(await motif(()=>reconstruireResultatIndex({journal:index[0],imports:index.filter(r=>r.id!==retire.id)})),'result_incomplete','audit B2 : témoin appareil déjà amputé avant réparation');
  await repo.init();
  eq(await db.get('outbox',retire.seq),undefined,'audit B2 : tombale gérée en quarantaine retirée');
  eq(await db.get('outbox',pending.seq),undefined,'audit B2 : tombale gérée encore en attente retirée avant son futur refus');
  eq(await db.get('outbox',autre.seq),autre,'audit B2 : file d’un autre compte intacte');
  eq(await db.get('outbox',ownerPayload.seq),ownerPayload,'audit B2 : copie liée à un autre propriétaire intacte');
  eq(await db.get('outbox',ordinaire.seq),ordinaire,'audit B2 : intention de suppression ordinaire intacte');
  eq((await db.get('outbox',1000)).op,'put','audit B2 : autre opération gérée intacte');
  eq((await db.get('sync_state','cursor:imports')).value,0,'audit B2 : curseur imports remis à zéro');
  eq((await db.get('sync_state',CLE)).value,1,'audit B2 : réparation marquée dans la même transaction');
  eq(await db.get('sync_state',brut.key),brut,'audit B2 : réponse brute déjà payée conservée');
  eq(await db.get('sync_state',progression.key),progression,'audit B2 : progression de lecture locale conservée');
  const recent=ligne('audit-plus-recent',{status:'echec',updated_at:'2099-01-01T00:00:00.000Z',note:'garder ici'});await db.mutate({origin:'remote',puts:{imports:[recent]}});
  const rows=[...index,ligne(recent.id,{status:'echec',note:'ancienne copie'})].map((data,i)=>({id:data.id,data,updated_at:data.updated_at,deleted_at:null,server_seq:i+1}));
  const transport=creerTransportFactice({lire:{imports:[rows,[]]}}),bilan=await createPull({db,transport,getUserId:()=> 'u1'}).recevoir();
  eq(bilan.erreur,null,'audit B2 : réception réelle après réparation réussie');
  eq(transport.journal.find(x=>x.appel==='lire'&&x.table==='imports').apres,0,'audit B2 : serveur relu depuis le début des imports');
  eq(canoniqueSources(await reconstruireResultatIndex({journal:await db.get('imports',journal.id),imports:await db.getAll('imports')})),canoniqueSources(resultat),'audit B2 : fragment reçu rétablit exactement l’index payé');
  eq(await db.get('imports',recent.id),recent,'audit B2 : réception de réparation conserve la fiche locale plus récente selon I7');
  const avant=await db.getSnapshot(['outbox','sync_state']);await repo.init();eq(await db.getSnapshot(['outbox','sync_state']),avant,'audit B2 : second init ne retire plus d’entrée et ne recule plus le curseur');
 }));
 for(const [nom,code,changer]of [
  ['compte','IMPORTS_REPAIR_ACCOUNT_CHANGED',async(db,m)=>m({origin:'device',puts:{sync_state:[{key:'user_id',value:'u2'}]}})],
  ['bibliothèque','IMPORTS_REPAIR_LIBRARY_CHANGED',async(db,m)=>m({origin:'device',puts:{sync_state:[{key:EPOCH,value:'nouvelle-bibliotheque'}]}})],
  ['curseur','IMPORTS_REPAIR_CURSOR_CHANGED',async(db,m)=>m({origin:'device',puts:{sync_state:[{key:'cursor:imports',value:51}]}})],
  ['file','IMPORTS_REPAIR_OUTBOX_CHANGED',async(db,m)=>{const e=(await db.getAll('outbox'))[0];return m({origin:'device',puts:{outbox:[{...e,tries:8}]}});}],
 ])await bloc('garde '+nom,()=>withRepo(async(repo,db)=>{
  await ancienneInstallation(db);const entree=await suppressionCapturee(db,ligne('audit-garde',{kind:'traduction'}),{quarantaine:true});const muter=db.mutate.bind(db);let fait=false;
  db.mutate=async options=>{if(!fait&&options.puts?.sync_state?.some(r=>r.key===CLE)){fait=true;await changer(db,muter);}return muter(options);};
  let raison;try{raison=await motif(()=>repo.reparerImportsGeres());}finally{db.mutate=muter;}
  eq(raison,code,'audit B2 : refus exact de la course '+nom);ok(!!await db.get('outbox',entree.seq),'audit B2 : course '+nom+' conserve la tombale');eq(await db.get('sync_state',CLE),undefined,'audit B2 : course '+nom+' ne consomme pas la réparation');
 }));
 await bloc('base changée',()=>withRepo(async(repo,db)=>withDatabase(async autre=>{
  await ancienneInstallation(db);const entree=await suppressionCapturee(db,ligne('audit-base',{kind:'traduction'}),{quarantaine:true});const muter=db.mutate.bind(db);
  db.mutate=async options=>{if(options.puts?.sync_state?.some(r=>r.key===CLE))repo.bindDatabase(autre);return muter(options);};
  let raison;try{raison=await motif(()=>repo.reparerImportsGeres());}finally{repo.bindDatabase(db);db.mutate=muter;}
  eq(raison,'IMPORTS_REPAIR_BASE_CHANGED','audit B2 : changement de liaison refuse exactement la réparation');ok(!!await db.get('outbox',entree.seq),'audit B2 : ancienne base intacte après changement de liaison');eq(await autre.get('sync_state',CLE),undefined,'audit B2 : aucune garde écrite dans la nouvelle base');
 })));
 await bloc('garde posée ailleurs',()=>withRepo(async(repo,db)=>{
  await ancienneInstallation(db);const entree=await suppressionCapturee(db,ligne('audit-garde-concurrente',{kind:'traduction'}),{quarantaine:true});const muter=db.mutate.bind(db);let fait=false;
  db.mutate=async options=>{if(!fait&&options.puts?.sync_state?.some(r=>r.key===CLE)){fait=true;await muter({origin:'device',puts:{sync_state:[{key:CLE,value:1}]}});}return muter(options);};
  let raison;try{raison=await motif(()=>repo.reparerImportsGeres());}finally{db.mutate=muter;}
  eq(raison,'IMPORTS_REPAIR_GUARD_CHANGED','audit B2 : réparation commencée ailleurs refuse le plan périmé');eq(await db.get('outbox',entree.seq),entree,'audit B2 : plan périmé ne retire pas la file');eq((await db.get('sync_state','cursor:imports')).value,50,'audit B2 : plan périmé ne recule pas le curseur');
 }));
 await bloc('init concurrence et erreur réelle',()=>withRepo(async(repo,db)=>{
  await ancienneInstallation(db);const muter=db.mutate.bind(db);let fait=false;
  db.mutate=async options=>{if(!fait&&options.puts?.sync_state?.some(r=>r.key===CLE)){fait=true;throw Object.assign(Error('course simulée'),{code:'IMPORTS_REPAIR_OUTBOX_CHANGED'});}return muter(options);};
  try{eq(await motif(()=>repo.init()),null,'audit B2 : init continue seulement sur un refus de concurrence nommé');}finally{db.mutate=muter;}
  eq(await db.get('sync_state',CLE),undefined,'audit B2 : init concurrent laisse la réparation rejouable');
  db.mutate=async options=>{if(options.puts?.sync_state?.some(r=>r.key===CLE))throw new DOMException('quota simulé','QuotaExceededError');return muter(options);};
  try{let nom=null;try{await repo.init();}catch(e){nom=e.name;}eq(nom,'QuotaExceededError','audit B2 : une panne de stockage n’est jamais absorbée comme concurrence');}finally{db.mutate=muter;}
 }));
 await bloc('passe unique légère',()=>withRepo(async(repo,db)=>{
  const lire=db.getSnapshot.bind(db);let captures=0;
  db.getSnapshot=async magasins=>{if(magasins?.length===2&&magasins.includes('sync_state')&&magasins.includes('outbox'))captures++;return lire(magasins);};
  try{await repo.init();}finally{db.getSnapshot=lire;}
  eq(captures,0,'audit B2 : réparation terminée ne recharge plus les réponses brutes et brouillons au démarrage');
 }));
 await bloc('réception en vol',()=>withRepo(async(repo,db)=>{
  await ancienneInstallation(db);const fragment=ligne('audit-fragment-retour',{index_storage:null}),suivant=ligne('audit-suivant',{status:'echec'}),page=(data,server_seq)=>({id:data.id,data,updated_at:data.updated_at,deleted_at:null,server_seq});
  const transport=creerTransportFactice({lire:{imports:[[page(suivant,60)],[page(fragment,10),page(suivant,60)],[]]}});const lire=transport.lire.bind(transport);let annoncer,liberer;const parti=new Promise(r=>annoncer=r),attente=new Promise(r=>liberer=r);let n=0;
  transport.lire=async(...args)=>{if(args[0]==='imports'&&n++===0){annoncer();await attente;}return lire(...args);};
  const enVol=createPull({db,transport,getUserId:()=> 'u1'}).recevoir();await parti;
  try{await repo.init();}finally{liberer();}
  const bilan=await enVol;eq(bilan.erreur,null,'audit B2 : réception déjà en vol reprend après réparation');
  eq(transport.journal.filter(x=>x.appel==='lire'&&x.table==='imports').map(x=>x.apres),[50,0,60],'audit B2 : réponse partie de50 ne saute pas la remise à zéro');
  eq(await db.get('imports',fragment.id),fragment,'audit B2 : fragment antérieur au vieux curseur effectivement reçu');
  eq((await db.get('sync_state','cursor:imports')).value,60,'audit B2 : curseur avance après la reprise complète');
 }));
 await bloc('réparation entre contrôle et transaction de page',()=>withRepo(async(repo,db)=>{
  await ancienneInstallation(db);const fragment=ligne('audit-fragment-transaction',{index_storage:null}),suivant=ligne('audit-suivant-transaction',{status:'echec'}),page=(data,server_seq)=>({id:data.id,data,updated_at:data.updated_at,deleted_at:null,server_seq});
  const transport=creerTransportFactice({lire:{imports:[[page(suivant,60)],[page(fragment,10),page(suivant,60)],[]]}}),muter=db.mutate.bind(db);let fait=false;
  db.mutate=async options=>{if(!fait&&options.origin==='remote'&&options.puts?.sync_state?.some(r=>r.key==='cursor:imports')){fait=true;await repo.reparerImportsGeres();}return muter(options);};
  let bilan;try{bilan=await createPull({db,transport,getUserId:()=> 'u1'}).recevoir();}finally{db.mutate=muter;}
  eq(bilan.erreur,null,'audit B2 : garde transactionnelle reprend une page invalidée après son précontrôle');
  eq(transport.journal.filter(x=>x.table==='imports').map(x=>x.apres),[50,0,60],'audit B2 : remise à zéro atomique ne peut être écrasée par une page périmée');
  eq(await db.get('imports',fragment.id),fragment,'audit B2 : fenêtre transactionnelle conserve le fragment à récupérer');
 }));
 await bloc('reprises bornées',()=>withRepo(async(repo,db)=>{
  await ancienneInstallation(db);let appels=0;const data=ligne('audit-borne',{status:'echec'});
  const transport={async lire(table){if(table!=='imports')return{lignes:[],erreur:null};appels++;await db.mutate({origin:'device',puts:{sync_state:[{key:CLE,value:appels}]}});return{lignes:[{id:data.id,data,updated_at:data.updated_at,deleted_at:null,server_seq:60}],erreur:null};}};
  eq(await motif(()=>createPull({db,transport,getUserId:()=> 'u1'}).recevoir()),'SYNC_IMPORTS_REPAIR_CHANGED','audit B2 : changements répétés refusés avec le motif exact');
  eq(appels,3,'audit B2 : au maximum deux reprises de la réception des imports');
  eq(await db.get('imports',data.id),undefined,'audit B2 : aucune page invalidée écrite malgré les reprises');
  eq((await db.get('sync_state','cursor:imports')).value,50,'audit B2 : refus final ne consomme aucun curseur');
 }));
 await bloc('compte changé après le transport',()=>withRepo(async(repo,db)=>{
  let owner='u1',recu=false,fait=false;await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:owner}]}});
  const data=ligne('audit-ancien-compte',{status:'echec'}),transport=creerTransportFactice({lire:{imports:[[{id:data.id,data,updated_at:data.updated_at,deleted_at:null,server_seq:60}],[]]}}),lire=transport.lire.bind(transport),get=db.get.bind(db);
  transport.lire=async(...args)=>{const r=await lire(...args);if(args[0]==='imports')recu=true;return r;};
  db.get=async(...args)=>{const r=await get(...args);if(recu&&!fait&&args[0]==='sync_state'&&args[1]===CLE){fait=true;owner='u2';await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:owner}]}});}return r;};
  let bilan;try{bilan=await createPull({db,transport,getUserId:()=>owner}).recevoir();}finally{db.get=get;}
  eq(bilan.erreur?.type,'auth','audit B2 : changement de compte après contrôle transport reste un refus authentification');
  eq(await db.get('imports',data.id),undefined,'audit B2 : ancienne réponse ne devient pas une fiche du nouveau compte');
  eq((await db.get('sync_state','cursor:imports')).value,0,'audit B2 : ancienne réponse ne fait pas avancer le curseur du nouveau compte');
 }));
 await bloc('compte changé pendant une reprise de page',()=>withRepo(async(repo,db)=>{
  let owner='u1',fait=false;await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:owner}]}});
  const data=ligne('audit-ancien-compte-reprise',{status:'echec'}),transport=creerTransportFactice({lire:{imports:[[{id:data.id,data,updated_at:data.updated_at,deleted_at:null,server_seq:60}],[]]}}),muter=db.mutate.bind(db);
  db.mutate=async options=>{if(!fait&&options.origin==='remote'&&options.puts?.sync_state?.some(r=>r.key==='cursor:imports')){fait=true;owner='u2';await muter({origin:'device',puts:{sync_state:[{key:'user_id',value:owner}],outbox:[{seq:1,user_id:'u1',store:'imports',id:'audit-intention',op:'put',snapshot:{kind:'traduction'}}]}});}return muter(options);};
  let raison;try{raison=await motif(()=>createPull({db,transport,getUserId:()=>owner}).recevoir());}finally{db.mutate=muter;}
  eq(raison,'Compte de synchronisation changé','audit B2 : reprise interne conserve le propriétaire de la requête initiale');
  eq(await db.get('imports',data.id),undefined,'audit B2 : reprise interne ne réattribue pas une ancienne réponse');
  eq((await db.get('sync_state','cursor:imports')).value,0,'audit B2 : reprise interne ne consomme pas le curseur après changement de compte');
 }));
}
