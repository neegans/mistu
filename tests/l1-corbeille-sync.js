import { composerLots } from '../src/sync/lots.js';
import { decider } from '../src/sync/pull.js';
import { creerTransportFactice } from './transport-factice.js';
import { withDatabase } from './backup.js';
import { installCapture, retirerEnvoi } from '../src/sync/outbox.js';
import { createPush } from '../src/sync/push.js';
import { createPull } from '../src/sync/pull.js';
import { garderIci, garderAilleurs, purgerAnciens, abandonnerConflitCycle } from '../src/sync/conflits.js';
import { envoiInitial } from '../src/sync/backfill.js';
import { createMoteur } from '../src/sync/moteur.js';
import { withRepo } from './sync-fixture.js';
import { creerStockageFactice } from './stockage-factice.js';
import { mettreALaCorbeille, restaurerRecette } from '../src/domain/corbeille.js';
import { createArchive, inspectArchive, applyArchive } from '../src/domain/backup.js';
import { sha256Hex } from '../src/core/hash.js';
import { capaciteCycleConnue, verifierCapaciteCycle } from '../src/sync/cycle.js';

export async function runL1CorbeilleSyncTests({eq,ok}) {
  const r={id:'l1-sync-r',original_title:'Pain',updated_at:'2026-10-29T12:00:00.000Z'};
  const command=(operation_id,base_cycle_id,action='trash')=>({store:'recipes',id:r.id,op:'lifecycle',seq:action==='trash'?1:2,user_id:'u',payload:{recipe_id:r.id,operation_id,base_cycle_id,action,at:'2026-10-29T13:00:00.000Z',...(action==='trash'?{seed:r}:{})}});
  const a=command('cycle-a',null),b=command('cycle-b','cycle-a','restore');
  const row={...r,lifecycle_id:'cycle-b',trashed_at:null};
  const composed=await composerLots([a,b],async()=>row);
  eq(composed.lots.flatMap(x=>x.elements).map(x=>x.operation_id),['cycle-a'],'L1 sync : une seule commande de cycle par recette en vol, charge immuable');
  ok(composed.retenues.some(x=>x.seq===2),'L1 sync : restauration dépendante retenue avant accusé');
  const old={...r,updated_at:'2026-10-29T15:00:00.000Z'};
  const remote={id:r.id,data:{...r,lifecycle_id:'cycle-a',trashed_at:a.payload.at},updated_at:a.payload.at,deleted_at:null,server_seq:1};
  eq(decider({locale:old,distante:remote,table:'recipes'}),'cycle','L1 sync : cycle serveur ne perd pas contre date de contenu locale');
  const server=creerTransportFactice({serveur:true});
  const sent=await server.pousser([{store:'recipes',id:r.id,...a.payload,op:'lifecycle'}]);
  eq(sent.reponse.accepted[0]?.operation_id,'cycle-a','L1 sync : accusé de commande par identifiant opération');
  eq(server.ligne('recipes',r.id)?.data.trashed_at,a.payload.at,'L1 sync : recette jamais envoyée créée directement retirée');
  const stale=await server.pousser([{store:'recipes',id:r.id,data:old,updated_at:old.updated_at,deleted:false}]);
  eq(stale.reponse.rejected[0]?.reason,'cycle','L1 sync : ancien put plus récent refuse la restauration implicite');
  const repeat=await server.pousser([{store:'recipes',id:r.id,...a.payload,op:'lifecycle'}]);
  eq(repeat.reponse.accepted[0]?.operation_id,'cycle-a','L1 sync : réessai de commande idempotent');
  const restore=await server.pousser([{store:'recipes',id:r.id,...b.payload,op:'lifecycle'}]);
  eq(restore.reponse.accepted[0]?.operation_id,'cycle-b','L1 sync : restauration explicite acceptée sur sa base');
  eq(server.ligne('recipes',r.id)?.data.lifecycle_id,'cycle-b','L1 sync : jeton conservé après restauration');
  await withDatabase(async db=>{
    const distant=creerTransportFactice({serveur:true});
    installCapture(db,{getUserId:()=> 'u'});
    await db.putBatch({recipes:[r]});
    await db.mutate({puts:{recipes:[{...r,lifecycle_id:'cycle-a',trashed_at:a.payload.at}]},lifecycle:a.payload});
    await db.mutate({puts:{recipes:[row]},lifecycle:b.payload});
    const push=createPush({db,transport:distant,getUserId:()=> 'u'});
    await push.envoyer();
    eq((await db.getAll('outbox')).filter(e=>e.op==='lifecycle').map(e=>e.payload.operation_id),['cycle-b'],'L1 sync réel : seul accusé trash retire sa commande et création couverte');
    eq((await db.get('recipes',r.id)).lifecycle_id,'cycle-b','L1 sync réel : accusé ancien ne retire pas overlay restauration');
    eq(distant.ligne('recipes',r.id).data.trashed_at,a.payload.at,'L1 sync réel : première passe crée en corbeille');
    await push.envoyer();
    eq((await db.getAll('outbox')).length,0,'L1 sync réel : seconde passe accuse restauration');
    await withDatabase(async autre=>{
      await createPull({db:autre,transport:distant,getUserId:()=> 'u'}).recevoir();
      eq([(await autre.get('recipes',r.id)).lifecycle_id,(await autre.get('recipes',r.id)).trashed_at],['cycle-b',null],'L1 deux bases : restauration convergente sans ancien état actif');
    });
    const tronquee={pousser:async()=>({reponse:{accepted:[{store:'recipes',id:r.id}],rejected:[],adjusted:[]}})};
    const c=command('cycle-c','cycle-b');
    await db.mutate({puts:{recipes:[{...row,lifecycle_id:'cycle-c',trashed_at:c.payload.at}]},lifecycle:c.payload});
    await createPush({db,transport:tronquee,getUserId:()=> 'u'}).envoyer();
    eq((await db.getAll('outbox')).filter(e=>e.op==='lifecycle').length,1,'L1 accusé tronqué : commande entière conservée');
    ok(!(await capaciteCycleConnue(db,'u')),'L1 capacité : compte inconnu bloqué');
    await verifierCapaciteCycle({db,transport:distant,userId:'u'});
    ok(await capaciteCycleConnue(db,'u'),'L1 capacité confirmée conservée');
    ok(!(await capaciteCycleConnue(db,'autre')),'L1 capacité ne voyage pas vers autre compte');
  });
  await withDatabase(async db=>{
    const distant=creerTransportFactice({serveur:true});
    await distant.pousser([{store:'recipes',id:r.id,...a.payload,op:'lifecycle'}]);
    await db.putBatch({recipes:[old],outbox:[{seq:1,user_id:'u',store:'recipes',id:r.id,op:'put',updated_at:old.updated_at}]},{origin:'remote'});
    await createPush({db,transport:distant,getUserId:()=> 'u'}).envoyer();
    await createPull({db,transport:distant,getUserId:()=> 'u'}).recevoir();
    eq((await db.get('recipes',r.id)).lifecycle_id,'cycle-a','L1 ancienne copie plus récente : cycle serveur adopté');
    const conflit=await db.get('sync_conflicts',`recipes:${r.id}`);
    eq(conflit.kind,'cycle','L1 ancienne copie récupérable dans conflit de cycle');
    eq(await garderIci(db,conflit),false,'L1 Garder ici ne restaure pas implicitement');
    await purgerAnciens(db,Date.now()+366*86400000);
    ok(!!await db.get('sync_conflicts',conflit.id),'L1 conflit de cycle conservé au-delà de trente jours');
  });
  const waiting=await composerLots([{...a,lifecycle_blocked:true},b],async()=>row);
  eq(waiting.lots.length,0,'L1 commande refusée : les commandes dépendantes ne contournent pas sa barrière');
  await withDatabase(async db=>{
    const distant=creerTransportFactice({serveur:true});
    await distant.pousser([{store:'recipes',id:r.id,data:r,updated_at:r.updated_at}]);
    installCapture(db,{getUserId:()=> 'u'});
    const texteLocal={...r,original_title:'Correction locale non envoyée'};
    await db.putBatch({recipes:[texteLocal]});
    await db.mutate({puts:{recipes:[{...texteLocal,lifecycle_id:'cycle-a',trashed_at:a.payload.at}]},lifecycle:{...a.payload,seed:texteLocal}});
    await createPush({db,transport:distant,getUserId:()=> 'u'}).envoyer();
    eq((await db.get('sync_conflicts',`recipes:${r.id}`)).local.original_title,texteLocal.original_title,'L1 seed non utilisé : contenu ancien non envoyé conservé pour comparaison');
    ok((await db.getAll('outbox')).some(e=>e.op==='put'&&e.lifecycle_blocked),'L1 seed non utilisé : autre écriture conservée, pas accusée à tort');
  });
  await withDatabase(async db=>{
    let owner='u',liberer,commencer;
    const started=new Promise(r=>commencer=r),response=new Promise(r=>liberer=r);
    await db.putBatch({recipes:[{...r,lifecycle_id:'cycle-a',trashed_at:a.payload.at}],outbox:[a]},{origin:'remote'});
    const push=createPush({db,getUserId:()=>owner,transport:{pousser:async()=>{commencer();return response;}}});
    const enVol=push.envoyer();await started;owner='autre';
    liberer({reponse:{accepted:[{store:'recipes',id:r.id,operation_id:'cycle-a',server:{data:{...r,lifecycle_id:'cycle-a',trashed_at:a.payload.at},updated_at:a.payload.at}}]}});
    const bilan=await enVol;
    eq(bilan.attenteConnexion,true,'L1 changement de compte pendant accusé : application arrêtée');
    eq((await db.getAll('outbox')).length,1,'L1 changement de compte : aucune séquence retirée sous autre propriétaire');
  });
  await withDatabase(async db=>{
    installCapture(db,{getUserId:()=> 'u'});
    await db.mutate({puts:{meals:[{id:'l1-m',items:[]}]},recettes:[
      {recipe_id:'a',expected_cycle_id:'a-cycle',records:[{store:'meals',id:'l1-m'}]},
      {recipe_id:'b',expected_cycle_id:'b-cycle',records:[{store:'meals',id:'l1-m'}]},
    ]});
    eq((await db.getAll('outbox'))[0].recipe_contexts.map(c=>c.recipe_id),['a','b'],'L1 multi-recettes : toutes les bases capturées, pas seulement la première');
  });
  for(const retenue of [{next_try_at:'2099-01-01T00:00:00.000Z'},{quarantined_at:r.updated_at,last_error:'refus'}]) await withDatabase(async db=>{
    let appels=0;
    await db.putBatch({recipes:[row],outbox:[{...a,...retenue},b]},{origin:'remote'});
    const push=createPush({db,getUserId:()=> 'u',transport:{pousser:async()=>{appels++;throw Error('Barrière contournée');}}});
    await push.envoyer();await push.envoyer();
    eq(appels,0,`L1 barrière durable : ${retenue.next_try_at?'recul':'quarantaine'} bloque aussi la restauration lors des passes suivantes`);
  });
  const suppression=await composerLots([{seq:1,store:'inventory',id:'portion',op:'delete',recipe_id:r.id,expected_cycle_id:'cycle-a',historique:true,payload:{id:'portion',source_recipe_id:r.id},updated_at:r.updated_at}],async()=>null);
  eq([suppression.lots[0].elements[0].expected_cycle_id,suppression.lots[0].elements[0].historique],['cycle-a',true],'L1 portion consommée : suppression garde son contexte historique jusqu’au serveur');
  await withDatabase(async db=>{
    await db.putBatch({recipes:[r],outbox:[{seq:1,user_id:'u',store:'recipes',id:r.id,op:'put',updated_at:r.updated_at,recipe_id:r.id,expected_cycle_id:null}]},{origin:'remote'});
    const transport={pousser:async()=>{
      await db.putBatch({recipes:[{...r,lifecycle_id:'cycle-a',trashed_at:a.payload.at}]},{origin:'remote'});
      return {reponse:{accepted:[],adjusted:[{store:'recipes',id:r.id,updated_at:a.payload.at}],rejected:[]}};
    }};
    await createPush({db,getUserId:()=> 'u',transport}).envoyer();
    eq((await db.get('recipes',r.id)).lifecycle_id,'cycle-a','L1 accusé ordinaire tardif : ajustement d’heure ne retire jamais un cycle posé pendant le réseau');
  });
  await withDatabase(async db=>{
    const ancienne={seq:1,user_id:'u',store:'recipe_versions',id:'v',op:'put',recipe_id:r.id,expected_cycle_id:null};
    await db.putBatch({recipes:[row],recipe_versions:[{id:'v',recipe_id:r.id}],outbox:[ancienne]},{origin:'remote'});
    await envoiInitial({db,getUserId:()=> 'u'});
    eq((await db.getAll('outbox')).filter(e=>e.store==='recipe_versions').map(e=>e.expected_cycle_id),[null],'L1 envoi initial ne réattribue jamais le nouveau cycle à une écriture déjà capturée');
  });
  await withDatabase(async db=>{
    const conflit={id:`recipes:${r.id}`,store:'recipes',record_id:r.id,kind:'cycle',local:old,server:remote};
    await db.putBatch({recipes:[old],sync_conflicts:[conflit],sync_state:[{key:'user_id',value:'u'}],outbox:[a,b]},{origin:'remote'});
    eq(await abandonnerConflitCycle(db,conflit),false,'L1 abandon refuse une intention sans état confirmé');
    await db.putBatch({sync_state:[{key:`lifecycle:${r.id}`,value:{data:remote.data,user_id:'u'}}]},{origin:'remote'});
    eq(await abandonnerConflitCycle(db,conflit),true,'L1 abandon explicite réconcilie la copie confirmée');
    eq([(await db.get('recipes',r.id)).lifecycle_id,(await db.getAll('outbox')).length,(await db.getAll('sync_conflicts')).length],['cycle-a',0,0],'L1 abandon atomique retire les intentions et le conflit seulement après réconciliation');
  });
  await withDatabase(async db=>{
    const ancien={id:`recipes:${r.id}`,store:'recipes',record_id:r.id,kind:'donnees',local:r,server:{data:r,updated_at:r.updated_at}};
    await db.putBatch({recipes:[row],sync_conflicts:[ancien]},{origin:'remote'});
    eq(await garderIci(db,ancien),false,'L1 ancien conflit ordinaire : Garder ici ne remet pas une copie de cycle antérieur');
    eq(await garderAilleurs(db,ancien),false,'L1 ancien conflit ordinaire : Garder ailleurs ne contourne pas le cycle courant');
    eq((await db.get('recipes',r.id)).lifecycle_id,'cycle-b','L1 refus des résolutions tardives conserve le cycle restauré');
  });
  await withDatabase(async db=>{
    const distant=creerTransportFactice({serveur:true});let premiere=true,heure=Date.now();
    installCapture(db,{getUserId:()=> 'u'});await db.putBatch({recipes:[r]});
    await db.mutate({puts:{recipes:[{...r,lifecycle_id:'cycle-a',trashed_at:a.payload.at}]},lifecycle:a.payload});
    const transport={pousser:async rows=>{const reponse=await distant.pousser(rows);if(premiere){premiere=false;return {erreur:{type:'reseau'}};}return reponse;}};
    const push=createPush({db,transport,getUserId:()=> 'u',maintenant:()=>heure});
    await push.envoyer();heure+=10000;await push.envoyer();
    eq([(await db.getAll('outbox')).length,(await db.getAll('sync_conflicts')).length],[0,0],'L1 accusé de création perdu : réessai confirme le contenu couvert sans faux conflit');
  });
  await withDatabase(async db=>{
    await db.putBatch({recipes:[row],outbox:[a],sync_state:[{key:'user_id',value:'autre'}]},{origin:'remote'});
    eq(await retirerEnvoi(db,a.seq),false,'L1 abandon d’envoi : aucune intention ni marqueur modifié depuis un autre compte');
    eq([(await db.getAll('outbox')).length,(await db.get('recipes',r.id)).lifecycle_id],[1,'cycle-b'],'L1 abandon refusé conserve file et recette');
  });
  // Trois bases réelles, capture de production, commandes du domaine et moteurs complets avec stockage en mémoire.
  await withRepo(async (repo,dbA)=>withDatabase(async dbB=>withDatabase(async dbC=>{
    const serveur=creerTransportFactice({serveur:true}),stockage=creerStockageFactice(),moteurs=[];
    let onlineA=true,horloge=Date.now();
    const transportA={
      capacites:()=>onlineA?serveur.capacites():Promise.resolve({erreur:{type:'reseau'}}),
      pousser:rows=>onlineA?serveur.pousser(rows):Promise.resolve({erreur:{type:'reseau'}}),
      lire:(...args)=>onlineA?serveur.lire(...args):Promise.resolve({erreur:{type:'reseau'},lignes:[]})
    };
    const moteur=(db,transport=serveur)=>{const m=createMoteur({db,transport,stockage,getUserId:()=> 'u1',qualite:()=> 'originale',maintenant:()=>horloge});moteurs.push(m);return m;};
    const agir=async(db,fn)=>{repo.bindDatabase(db);try{return await fn();}finally{repo.bindDatabase(dbA);}};
    try {
      for(const db of [dbA,dbB]) await db.putBatch({sync_state:[{key:'user_id',value:'u1'}]},{origin:'device'});
      installCapture(dbB,{getUserId:()=> 'u1'});
      const photo=new Blob(['Photo personnelle L1 intacte'],{type:'image/jpeg'}),sha=await sha256Hex(photo);
      const recipe={id:'l1-engine-r',original_title:'Pain des trois appareils',current_version_id:'l1-engine-v',photo_sha256:sha};
      await repo.saveBatch({recipes:[recipe],recipe_versions:[{id:'l1-engine-v',recipe_id:recipe.id,kind:'extraction',ingredients:[],steps:[]}]},{conditions:{recipes:[{key:recipe.id,absente:true}]},fichiers:[{sha256:sha,blob:photo}]});
      const a=moteur(dbA,transportA),b=moteur(dbB);
      await a.executer();await a.executer();await b.executer();await b.telecharger([sha]);
      eq(await (await dbB.get('files',sha)).blob.text(),await photo.text(),'L1 moteurs : photo réellement reçue sur le deuxième appareil avant retrait');
      onlineA=false;
      await mettreALaCorbeille(await dbA.get('recipes',recipe.id),{repo,operationId:'engine-a-trash'});
      const archive=await inspectArchive(await (await createArchive(dbA)).blob.arrayBuffer());
      ok(archive.ok,'L1 moteurs : archive de commande hors ligne valide sans embarquer sa file');
      await restaurerRecette(await dbA.get('recipes',recipe.id),{repo,operationId:'engine-a-restore'});
      const horsLigne=await a.executer();
      eq(horsLigne.derniereErreur?.type,'reseau','L1 moteur hors ligne : intention annoncée en attente avec erreur réseau');
      await agir(dbB,async()=>mettreALaCorbeille(await dbB.get('recipes',recipe.id),{repo,operationId:'engine-b-trash'}));
      await b.executer();
      onlineA=true;horloge+=10000;
      await a.executer();
      eq((await dbA.get('recipes',recipe.id)).lifecycle_id,'engine-b-trash','L1 moteurs concurrents : retrait confirmé B gagne sur retrait/restauration restés hors ligne A');
      const commandesA=(await dbA.getAll('outbox')).filter(e=>e.op==='lifecycle');
      ok(commandesA.length===2&&commandesA.every(e=>e.lifecycle_blocked),'L1 moteurs : les deux commandes perdantes restent conservées et bloquées');
      await agir(dbB,async()=>restaurerRecette(await dbB.get('recipes',recipe.id),{repo,operationId:'engine-b-restore'}));
      await b.executer();await a.executer();
      eq([(await dbA.get('recipes',recipe.id)).lifecycle_id,(await dbB.get('recipes',recipe.id)).lifecycle_id],['engine-b-restore','engine-b-restore'],'L1 deux moteurs : restauration explicite B converge sans rejouer la restauration périmée A');
      ok(!serveur.journal.some(x=>x.rows?.some(e=>e.operation_id==='engine-a-restore')),'L1 moteurs : commande dépendante périmée jamais envoyée');
      installCapture(dbC,{getUserId:()=>null});
      await applyArchive(dbC,archive);
      eq([(await dbC.get('recipes',recipe.id)).lifecycle_id,(await dbC.getAll('outbox')).filter(e=>e.op==='lifecycle').length],['engine-a-trash',0],'L1 troisième base : archive garde son état mais ne recrée pas une commande autorisée');
      await dbC.putBatch({sync_state:[{key:'user_id',value:'u1'}]},{origin:'device'});installCapture(dbC,{getUserId:()=> 'u1'});
      const c=moteur(dbC);await c.executer();
      eq((await dbC.get('recipes',recipe.id)).lifecycle_id,'engine-b-restore','L1 moteur après archive : connexion adopte le cycle serveur et conserve le conflit');
      eq((await dbC.get('sync_conflicts',`recipes:${recipe.id}`)).kind,'cycle','L1 archive divergente : copie antérieure reste consultable après connexion');
      for(const [nom,db] of [['A',dbA],['B',dbB],['C',dbC]]) {
        eq(await (await db.get('files',sha)).blob.text(),await photo.text(),`L1 moteurs ${nom} : octets photo inchangés après retrait, concurrence, restauration et archive`);
        eq((await db.get('recipes',recipe.id)).photo_sha256,sha,`L1 moteurs ${nom} : pointeur photo conservé`);
      }
    } finally {await Promise.all(moteurs.map(m=>m.arreter()));repo.bindDatabase(dbA);}
  })));
}
