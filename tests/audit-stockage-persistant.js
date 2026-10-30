import {withRepo} from './sync-fixture.js';
import {withDatabase} from './backup.js';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const attendre=async predicate=>{for(let n=0;n<100;n++){if(await predicate())return;await pause()}throw Error('Demande persistante attendue absente');};
const retenir=()=>{let terminer;return{promesse:new Promise(resolve=>{terminer=resolve}),terminer:value=>terminer(value)};};

export async function runAuditStockagePersistantTests({eq,ok}){
 let api;try{api=await import('../src/domain/stockage-persistant.js')}catch{ok(false,'audit I3 : service de stockage persistant disponible');return}
 const {demanderStockagePersistant:demander,CLE_STOCKAGE_PERSISTANT:cle}=api,at='2026-10-30T18:00:00.000Z';
 await withRepo(async(repo,db)=>{
  let appels=0;const stockage={persist:async function(){appels++;ok(this===stockage,'audit I3 : persist garde son objet navigateur');return true}};
  eq(await demander({depot:repo,stockage,maintenant:()=>at}),true,'audit I3 : demande accordée');
  const ligne=await db.get('sync_state',cle);eq([ligne.value,ligne.at],[true,at],'audit I3 : résultat et date conservés sur cet appareil');ok(typeof ligne.demande_id==='string'&&ligne.demande_id.length>0,'audit I3 : réservation identifiée');
  eq(await demander({depot:repo,stockage}),true,'audit I3 : second démarrage relit le résultat');eq(appels,1,'audit I3 : persist demandé une fois');eq(await db.count('outbox'),0,'audit I3 : réservation et résultat ne partent pas en synchronisation');
 });
 await withRepo(async(repo,db)=>{
  const onglet=await import('../src/domain/stockage-persistant.js?second-onglet'),attente=retenir();let appels=0;
  const stockage={persist(){appels++;return attente.promesse}};
  const premier=demander({depot:repo,stockage});await attendre(()=>appels===1);
  const ligne=await db.get('sync_state',cle);eq(ligne.value,null,'audit I3 : demande pendante reste inconnue');
  eq(await onglet.demanderStockagePersistant({depot:repo,stockage}),null,'audit I3 : second onglet ne bloque pas sur la demande pendante');eq(appels,1,'audit I3 : deux modules indépendants partagent la réservation atomique');
  attente.terminer(true);eq(await premier,true,'audit I3 : seul le demandeur finalise');eq((await db.get('sync_state',cle)).demande_id,ligne.demande_id,'audit I3 : finalisation garde son identifiant');
 });
 await withRepo(async(repo,db)=>{
  eq(await demander({depot:repo,stockage:{}}),null,'audit I3 : navigateur sans API reste inconnu');eq(await db.get('sync_state',cle),undefined,'audit I3 : sans API aucune réservation');
  eq(await demander({depot:repo,stockage:{persist:async()=>false}}),false,'audit I3 : refus du navigateur reste faux');eq((await db.get('sync_state',cle)).value,false,'audit I3 : refus enregistré sans faux succès');
 });
 await withRepo(async(repo,db)=>{
  let appels=0;const stockage={persist:async()=>{appels++;throw Error('refus navigateur')}};
  eq(await demander({depot:repo,stockage}),null,'audit I3 : rejet de l’API reste inconnu');eq((await db.get('sync_state',cle)).value,null,'audit I3 : rejet ne se transforme pas en false');
  await demander({depot:repo,stockage});eq(appels,1,'audit I3 : un rejet déjà enregistré ne relance pas la demande');
 });
 await withRepo(async(repo,db)=>{
  eq(await demander({depot:repo,stockage:{persist:async()=> 'true'}}),null,'audit I3 : réponse non booléenne reste inconnue');eq((await db.get('sync_state',cle)).value,null,'audit I3 : chaîne true jamais certifiée');
 });
 await withRepo(async(repo,db)=>{
  let appels=0;const mutation=db.mutate.bind(db);db.mutate=async options=>{if(options.puts?.sync_state?.some(r=>r.key===cle))throw new DOMException('quota','QuotaExceededError');return mutation(options)};
  try{let erreur;try{await demander({depot:repo,stockage:{persist:async()=>{appels++;return true}}})}catch(e){erreur=e}
   eq(erreur?.name,'QuotaExceededError','audit I3 : quota de réservation remonte au caller');eq(appels,0,'audit I3 : réservation impossible n’appelle pas l’API');eq(await db.get('sync_state',cle),undefined,'audit I3 : réservation refusée sans marqueur');
  }finally{db.mutate=mutation}
 });
 await withRepo(async(repo,db)=>{
  const attente=retenir();let appels=0;const demande=demander({depot:repo,stockage:{persist(){appels++;return attente.promesse}}});await attendre(()=>appels===1);
  await repo.clearDevice();attente.terminer(true);let erreur;try{await demande}catch(e){erreur=e}
  eq(erreur?.code,'STORAGE_CONTEXT_CHANGED','audit I3 : effacement pendant l’API refuse la finalisation');eq(await db.get('sync_state',cle),undefined,'audit I3 : ancienne réponse ne repeuple pas la base vidée');
 });
 await withRepo(async(repo,db)=>{
  const attente=retenir();let appels=0;const demande=demander({depot:repo,stockage:{persist(){appels++;return attente.promesse}}});await attendre(()=>appels===1);
  await repo.clearDevice();await demander({depot:repo,stockage:{persist:async()=>false}});const nouvelle=await db.get('sync_state',cle);
  attente.terminer(true);let erreur;try{await demande}catch(e){erreur=e}
  eq(erreur?.code,'STORAGE_CONTEXT_CHANGED','audit I3 : ancienne demande refuse le marqueur créé après effacement');eq(await db.get('sync_state',cle),nouvelle,'audit I3 : résultat du nouveau lancement conservé entier');
 });
 await withRepo(async(repo,db)=>{
  const attente=retenir();let appels=0;const demande=demander({depot:repo,stockage:{persist(){appels++;return attente.promesse}}});await attendre(()=>appels===1);
  await repo.saveBatch({sync_state:[{key:'editor_library_epoch:v1',value:'epoque-apres'}]},{origin:'device'});
  attente.terminer(true);let erreur;try{await demande}catch(e){erreur=e}
  eq(erreur?.code,'STORAGE_CONTEXT_CHANGED','audit I3 : changement d’époque refuse la finalisation');eq((await db.get('sync_state',cle)).value,null,'audit I3 : aucune affirmation après remplacement de bibliothèque');
 });
 await withRepo(async(repo,db)=>withDatabase(async autre=>{
  const attente=retenir();let appels=0;const demande=demander({depot:repo,stockage:{persist(){appels++;return attente.promesse}}});await attendre(()=>appels===1);
  try{repo.bindDatabase(autre);attente.terminer(true);let erreur;try{await demande}catch(e){erreur=e}
   eq(erreur?.code,'STORAGE_CONTEXT_CHANGED','audit I3 : changement de liaison refuse la finalisation');eq(await autre.get('sync_state',cle),undefined,'audit I3 : aucune écriture dans la nouvelle base');eq((await db.get('sync_state',cle)).value,null,'audit I3 : ancienne base conserve son état inconnu');
  }finally{repo.bindDatabase(db);attente.terminer(null)}
 }));
 await withRepo(async(repo,db)=>withDatabase(async autre=>{
  let appels=0;const mutation=db.mutate.bind(db);db.mutate=async options=>{if(options.puts?.sync_state?.some(r=>r.key===cle))repo.bindDatabase(autre);return mutation(options)};
  try{let erreur;try{await demander({depot:repo,stockage:{persist:async()=>{appels++;return true}}})}catch(e){erreur=e}
   eq(erreur?.code,'STORAGE_CONTEXT_CHANGED','audit I3 : liaison changée juste avant transaction refusée');eq(appels,0,'audit I3 : changement avant réservation n’appelle pas l’API');eq(await db.get('sync_state',cle),undefined,'audit I3 : réservation annulée dans la base d’origine');eq(await autre.get('sync_state',cle),undefined,'audit I3 : réservation absente de la base étrangère');
  }finally{repo.bindDatabase(db);db.mutate=mutation}
 }));
 await withRepo(async(repo,db)=>{
  const onglet=await import('../src/domain/stockage-persistant.js?concurrence'),lecture=db.get.bind(db),barriere=retenir();let lectures=0,appels=0;
  db.get=async(store,key)=>{const ligne=await lecture(store,key);if(store==='sync_state'&&key===cle&&lectures<2){lectures++;if(lectures===2)barriere.terminer();await barriere.promesse}return ligne};
  try{const stockage={persist:async()=>{appels++;return true}},origines=[],depot={get db(){return repo.db},saveBatch:(lignes,options)=>{origines.push(options.origin);return repo.saveBatch(lignes,options)}};
   const issues=await Promise.allSettled([demander({depot,stockage}),onglet.demanderStockagePersistant({depot,stockage})]);
   eq(lectures,2,'audit I3 : deux onglets lisent la réservation absente simultanément');eq(appels,1,'audit I3 : seule une réservation concurrente appelle persist');eq(issues.filter(r=>r.status==='rejected').length,0,'audit I3 : le perdant concurrent relit sans erreur');eq((await lecture('sync_state',cle)).value,true,'audit I3 : résultat concurrent final conservé');ok(origines.length>=2&&origines.every(o=>o==='device'),'audit I3 : toutes les écritures restent sur cet appareil');
  }finally{barriere.terminer();db.get=lecture}
 });
 await withRepo(async(repo,db)=>withDatabase(async autre=>{
  let ecritures=0;const mutation=db.mutate.bind(db);db.mutate=async options=>{if(options.puts?.sync_state?.some(r=>r.key===cle)&&++ecritures===2)repo.bindDatabase(autre);return mutation(options)};
  try{let erreur;try{await demander({depot:repo,stockage:{persist:async()=>true}})}catch(e){erreur=e}
   eq(erreur?.code,'STORAGE_CONTEXT_CHANGED','audit I3 : liaison changée au commit de finalisation refusée');eq((await db.get('sync_state',cle)).value,null,'audit I3 : transaction tardive annulée dans la base d’origine');eq(await autre.get('sync_state',cle),undefined,'audit I3 : finalisation absente de la base étrangère');
  }finally{repo.bindDatabase(db);db.mutate=mutation}
 }));
 await withRepo(async(repo,db)=>{
  let appels=0;const mutation=db.mutate.bind(db);db.mutate=async options=>{if(options.puts?.sync_state?.some(r=>r.key===cle))await mutation({origin:'device',puts:{sync_state:[{key:'editor_library_epoch:v1',value:'epoque-concurrente'}]}});return mutation(options)};
  try{let erreur;try{await demander({depot:repo,stockage:{persist:async()=>{appels++;return true}}})}catch(e){erreur=e}
   eq(erreur?.code,'STORAGE_CONTEXT_CHANGED','audit I3 : époque changée au commit de réservation refusée');eq(appels,0,'audit I3 : bibliothèque remplacée avant réservation sans appel API');eq(await db.get('sync_state',cle),undefined,'audit I3 : aucune réservation dans la nouvelle époque');
  }finally{db.mutate=mutation}
 });

 await withRepo(async(repo,db)=>{
  let appels=0,ecritures=0;const mutation=db.mutate.bind(db);db.mutate=async options=>{if(options.puts?.sync_state?.some(r=>r.key===cle)&&++ecritures===2)throw new DOMException('quota final','QuotaExceededError');return mutation(options)};
  try{const stockage={persist:async()=>{appels++;return true}};let erreur;try{await demander({depot:repo,stockage})}catch(e){erreur=e}
   eq(erreur?.name,'QuotaExceededError','audit I3 : quota en finalisation ne prétend pas avoir conservé le résultat');eq(appels,1,'audit I3 : quota final atteint après accord de l’API');eq((await db.get('sync_state',cle)).value,null,'audit I3 : quota final laisse le marqueur inconnu');eq(await demander({depot:repo,stockage}),null,'audit I3 : lancement suivant relit le marqueur inconnu');eq(appels,1,'audit I3 : quota final ne relance pas l’API');
  }finally{db.mutate=mutation}
 });

}
