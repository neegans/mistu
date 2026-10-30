import {withRepo} from './sync-fixture.js';
import {withDatabase} from './backup.js';
import {fixtureCommandeTraduction} from './l6-sync-traductions.js';
import {fixtureSyncCuisine} from './l7-sync.js';
import {fixtureSyncInventaire} from './l8-sync.js';
import {abandonnerEnvoi,syncSectionModel,syncSectionL3} from '../src/ui/settings.js';
import {retirerEnvoi,reprendreEnvoi} from '../src/sync/outbox.js';
import {createPush} from '../src/sync/push.js';
import {createTransport} from '../src/sync/transport.js';
import {composerLots} from '../src/sync/lots.js';

const AT='2026-10-30T12:00:00.000Z',EPOCH='editor_library_epoch:v1';
const types=[['traduction','translation_apply','recipe_translations','translation'],['journal','put','imports','translation'],['cuisine','cooking_apply','cook_sessions','cooking'],['inventaire','inventory_change','inventory','inventory']];
const capture=async db=>db.getSnapshot(['outbox','sync_conflicts','sync_state']);
const echec=async fn=>{try{await fn();return null;}catch(e){return e.name;}};

async function semer(db,type,{quarantaine=true,owner='u1'}={}){
 const [nom,op,store,kind]=type,id='audit-'+nom;
 const locale={id,notes:'Copie locale <img src=x>\u0001',updated_at:AT};
 const contenu=op==='put'?{...locale,kind:'traduction',resultat:{text:'Réponse payée\u0001'}}:{op,store,id,operation_id:'audit-operation-'+nom,change:{texte:'Intention entière\u0001'}};
 const entree={seq:10,user_id:owner,store,id,op,tries:2,...(op==='put'?{snapshot:contenu}:{payload:contenu}),...(quarantaine?{quarantined_at:AT,last_error:'forme'}:{})};
 await db.mutate({origin:'remote',puts:{[store]:[locale],outbox:[entree],sync_state:[{key:'user_id',value:'u1'}]}});
 return{nom,kind,store,id,locale,contenu,entree};
}

async function fixtureValide(repo,db,nom){
 await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u1'}]}});
 if(nom==='traduction'){
  const f=await fixtureCommandeTraduction(),e={seq:10,user_id:'u1',store:f.commande.store,id:f.commande.id,op:f.commande.op,payload:f.commande,tries:0};
  await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version],recipe_translations:[f.row],outbox:[e]}});return e;
 }
 if(nom==='journal'){
  const snapshot={id:'audit-journal-http',kind:'traduction',status:'a_verifier',recipe_id:'audit-recipe',source_version_id:'audit-version',translation_capture:{format:1},resultat:{text:'Réponse payée\u0001'},updated_at:AT};
  const e={seq:10,user_id:'u1',store:'imports',id:snapshot.id,op:'put',snapshot,tries:0};await db.mutate({origin:'remote',puts:{imports:[snapshot],outbox:[e]}});return e;
 }
 const f=nom==='cuisine'?await fixtureSyncCuisine(repo,db):await fixtureSyncInventaire(repo,db),e=f.file[0];
 await db.mutate({origin:'remote',clearStores:['outbox'],puts:{outbox:[e]}});return e;
}
const capacites={recipe_language:1,cooking_persistence:1,inventory_changes:1};

export async function runAuditCommandesProtegeesTests({eq,ok}){
 const bloc=async(nom,fn)=>{try{await withRepo(fn);}catch(e){ok(false,'audit synchro B2 '+nom+' : '+(e.stack||e));}};
 for(const type of types)await bloc('abandon '+type[0],async(repo,db)=>{
  const f=await semer(db,type),avant=await capture(db);let confirmations=0;
  eq(await abandonnerEnvoi({db,seq:10,confirm:async()=>{confirmations++;return false;}}),false,'B2 '+f.nom+' : annulation sans abandon');
  eq(await capture(db),avant,'B2 '+f.nom+' : annulation conserve file et journal');
  eq(await retirerEnvoi(db,10),false,'B2 '+f.nom+' : retrait direct sans confirmation refusé');
  eq(await abandonnerEnvoi({db,seq:10,confirm:async message=>{confirmations++;ok(message.includes('copie'),'B2 '+f.nom+' : confirmation annonce la copie conservée');return true;}}),true,'audit synchro B2 : abandonner une commande protegee en quarantaine '+f.nom);
  eq(await db.get('outbox',10),undefined,'B2 '+f.nom+' : seule intention abandonnée retirée');
  eq(await db.get(f.store,f.id),f.locale,'B2 '+f.nom+' : fiche locale inchangée');
  const copie=(await db.getAll('sync_conflicts')).find(c=>c.kind===f.kind);
  eq(copie?.local,f.contenu,'B2 '+f.nom+' : commande ou réponse entière conservée');
  eq(copie?.copie_locale,f.locale,'B2 '+f.nom+' : copie de la fiche conservée');
  eq(copie?.entree,f.entree,'B2 '+f.nom+' : enveloppe entière conservée');
  eq(copie?.resolution?.choix,'abandon','B2 '+f.nom+' : copie documentaire résolue explicitement');
  eq(confirmations,2,'B2 '+f.nom+' : chaque geste demandé une fois');
 });
 for(const variante of ['pendante','autre-compte'])await bloc(variante,async(repo,db)=>{
  const f=await semer(db,types[2],{quarantaine:variante!=='pendante',owner:variante==='autre-compte'?'u2':'u1'}),avant=await capture(db);
  eq(await abandonnerEnvoi({db,seq:10,confirm:async()=>true}),false,'B2 '+variante+' : abandon protégé refusé');
  eq(await capture(db),avant,'B2 '+variante+' : aucune mutation');
  eq(await db.get(f.store,f.id),f.locale,'B2 '+variante+' : fiche conservée');
 });
 for(const changement of ['entree','compte','epoque'])await bloc('confirmation '+changement,async(repo,db)=>{
  await semer(db,types[2]);let attendu;
  const result=await abandonnerEnvoi({db,seq:10,confirm:async()=>{
   if(changement==='entree')await db.mutate({origin:'remote',puts:{outbox:[{...await db.get('outbox',10),tries:99}]}});
   else await db.mutate({origin:'device',puts:{sync_state:[{key:changement==='compte'?'user_id':EPOCH,value:'nouveau'}]}});
   attendu=await capture(db);return true;
  }});
  eq(result,false,'B2 '+changement+' : décision périmée refusée');eq(await capture(db),attendu,'B2 '+changement+' : état concurrent conservé');
 });
 await bloc('base remplacée',async(repo,db)=>{
  await semer(db,types[2]);const avant=await capture(db);
  await withDatabase(async autre=>{try{
   eq(await abandonnerEnvoi({db,seq:10,confirm:async()=>{repo.bindDatabase(autre);return true;}}),false,'B2 base : abandon refusé après changement du dépôt courant');
   eq(await capture(db),avant,'B2 base : ancienne base entièrement conservée');
  }finally{repo.bindDatabase(db);}});
 });
 await bloc('quota',async(repo,db)=>{
  await semer(db,types[3]);const avant=await capture(db),mutate=db.mutate.bind(db);let atteint=false;
  db.mutate=async opts=>{if(opts.puts?.sync_conflicts?.length&&opts.deletes?.outbox?.includes(10)){atteint=true;throw new DOMException('quota factice','QuotaExceededError');}return mutate(opts);};
  eq(await echec(()=>abandonnerEnvoi({db,seq:10,confirm:async()=>true})),'QuotaExceededError','B2 quota : erreur réelle remontée');
  ok(atteint,'B2 quota : transaction documentaire réellement atteinte');db.mutate=mutate;eq(await capture(db),avant,'B2 quota : aucun retrait ni journal partiel');
 });
 await bloc('retenues',async(repo,db)=>{
  const f=await semer(db,types[0]),suite={seq:11,user_id:'u1',op:'put',store:f.store,id:f.id,snapshot:{id:f.id,locale:'fr',updated_at:AT},last_error:'cycle en attente'},bloquee={...suite,seq:12,id:'autre',snapshot:{id:'autre'},lifecycle_blocked:true,last_error:'cycle'};
  await db.mutate({origin:'remote',puts:{outbox:[suite,bloquee]}});
  const avant=await composerLots(await db.getAll('outbox'),(s,id)=>db.get(s,id));ok(avant.retenues.some(r=>r.seq===11),'B2 retenue : la commande bloque réellement la suite');
  await abandonnerEnvoi({db,seq:10,confirm:async()=>true});
  const apres=await composerLots(await db.getAll('outbox'),(s,id)=>db.get(s,id));eq(apres.lots.flatMap(l=>l.seqs),[11],'B2 retenue : suite recomposée après abandon');
  eq(await db.get('outbox',12),bloquee,'B2 retenue : autre blocage inchangé');
  const envoyes=[];await createPush({db,getUserId:()=> 'u1',transport:{pousser:async rows=>{envoyes.push(...rows);return{reponse:{accepted:rows.map(r=>({store:r.store,id:r.id})),rejected:[]},erreur:null};}}}).envoyer();
  eq(envoyes.map(r=>r.id),[f.id],'B2 retenue : la passe transmet réellement la suite libérée');eq(await db.get('outbox',12),bloquee,'B2 retenue : protection indépendante encore intacte après la passe');
 });
 for(const changement of ['entree','locale','conflit'])await bloc('transaction '+changement,async(repo,db)=>{
  const f=await semer(db,types[2]),mutate=db.mutate.bind(db);let atteint=false,attendu;
  db.mutate=async opts=>{
   if(!atteint&&opts.puts?.sync_conflicts?.length&&opts.deletes?.outbox?.includes(10)){
    atteint=true;
    if(changement==='entree')await mutate({origin:'remote',puts:{outbox:[{...f.entree,tries:7}]}});
    if(changement==='locale')await mutate({origin:'remote',puts:{[f.store]:[{...f.locale,notes:'Saisie concurrente'}]}});
    if(changement==='conflit')await mutate({origin:'remote',puts:{sync_conflicts:[{...opts.puts.sync_conflicts[0],local:{texte:'Autre copie à conserver'}}]}});
    attendu=await capture(db);
   }
   return mutate(opts);
  };
  eq(await abandonnerEnvoi({db,seq:10,confirm:async()=>true}),false,'B2 transaction '+changement+' : abandon périmé refusé');
  db.mutate=mutate;ok(atteint,'B2 transaction '+changement+' : fenêtre réellement exercée');eq(await capture(db),attendu,'B2 transaction '+changement+' : mutation concurrente intacte');
 });
 for(const [status,typeErreur]of [[401,'auth'],[413,'quota'],[503,'reseau'],[404,'inconnu']])await bloc('HTTP '+status,async(repo,db)=>{
  const entree=await fixtureValide(repo,db,'journal'),transport=createTransport({rpc:async name=>name==='sync_capabilities'?{data:capacites,error:null}:{status,error:{message:'preuve réseau'}}});
  const bilan=await createPush({db,transport,getUserId:()=> 'u1'}).envoyer(),apres=await db.get('outbox',entree.seq);
  eq(bilan.erreur?.type,typeErreur,'B2 HTTP '+status+' : classement historique conservé');
  ok(apres&&!apres.quarantined_at,'B2 HTTP '+status+' : intention gardée sans quarantaine');eq(await db.getAll('sync_conflicts'),[],'B2 HTTP '+status+' : aucun conflit documentaire de refus');
 });
 for(const status of [503,413])await bloc('HTTP tardif '+status,async(repo,db)=>{
  await fixtureValide(repo,db,'journal');let attendu;
  const transport=createTransport({rpc:async name=>{
   if(name==='sync_capabilities')return{data:capacites,error:null};
   await db.mutate({origin:'remote',clearStores:['outbox'],puts:{sync_state:[{key:EPOCH,value:'apres-transport'}]}});attendu=await capture(db);
   return{status,error:{message:'réponse ancienne'}};
  }});
  eq(await echec(()=>createPush({db,transport,getUserId:()=> 'u1'}).envoyer()),'Error','B2 HTTP tardif '+status+' : réponse de bibliothèque périmée refusée');
  eq(await capture(db),attendu,'B2 HTTP tardif '+status+' : aucune ancienne intention ou pause réintroduite');
 });
 for(const type of types)await bloc('HTTP '+type[0],async(repo,db)=>{
  const entree=await fixtureValide(repo,db,type[0]),locale=await db.get(entree.store,entree.id);let statut=400,malforme=false;
  const transport=createTransport({rpc:async(name,args)=>{
   if(name==='sync_capabilities')return{data:capacites,error:null};
   if(statut===400)return{error:{message:'refus de preuve'},status:400};
   const c=args.rows[0],accuse=entree.op==='put'?{store:c.store,id:c.id}:{store:c.store,id:c.id,operation_id:c.operation_id,payload_sha256:malforme?'f'.repeat(64):c.payload_sha256,server_rows:[{store:c.store,id:c.id,data:locale,updated_at:AT,deleted_at:null,server_seq:3}]};
   return{data:{accepted:[accuse],rejected:[]},error:null};
  }}),push=createPush({db,transport,getUserId:()=> 'u1'});
  const bilan=await push.envoyer(),quarantaine=await db.get('outbox',entree.seq),copies=await db.getAll('sync_conflicts'),copie=copies.find(c=>c.kind===type[3]);
  eq(quarantaine?.last_error,'refus','B2 HTTP '+type[0]+' : quarantaine nommée');
  eq(copie?.local,entree.payload??entree.snapshot,'B2 HTTP '+type[0]+' : copie entière dès le refus');
  eq(copie?.copie_locale,locale,'B2 HTTP '+type[0]+' : état local conservé');
  ok(!!copie&&!copie.resolution,'B2 HTTP '+type[0]+' : conflit actif avant décision');
  eq([bilan.envoyes,bilan.conflits],[0,1],'B2 HTTP '+type[0]+' : aucun faux accusé');
  statut=200;
  if(entree.op!=='put'){
   malforme=true;await reprendreEnvoi(db,quarantaine);await push.envoyer();
   ok((await db.get('outbox',entree.seq))&&!((copie&&await db.get('sync_conflicts',copie.id))?.resolution),'B2 HTTP '+type[0]+' : mauvais reçu ne résout rien');malforme=false;
  }else await reprendreEnvoi(db,quarantaine);
  await push.envoyer();eq(await db.get('outbox',entree.seq),undefined,'B2 HTTP '+type[0]+' : accusé exact retire la commande');
  const resolue=copie&&await db.get('sync_conflicts',copie.id);eq(resolue?.resolution?.choix,'envoye','B2 HTTP '+type[0]+' : seul accusé exact résout la copie HTTP');
  eq(resolue?.local,entree.payload??entree.snapshot,'B2 HTTP '+type[0]+' : copie reçue toujours conservée');
 });
 for(const concurrence of [false,true])await bloc('ACK documentaire '+concurrence,async(repo,db)=>{
  const entree=await fixtureValide(repo,db,'journal');let refuse=true;
  const push=createPush({db,getUserId:()=> 'u1',transport:{capacites:async()=>({capacites}),pousser:async rows=>refuse?{erreur:{type:'refus',status:400}}:{reponse:{accepted:rows.map(r=>({store:r.store,id:r.id})),rejected:[]}}}});
  await push.envoyer();const copie=(await db.getAll('sync_conflicts'))[0];
  const autre={...copie,id:'autre-copie-HTTP',entree:{...entree,seq:999},local:{texte:'Une autre intention'}};
  await db.mutate({origin:'remote',puts:{sync_conflicts:[autre]}});await reprendreEnvoi(db,await db.get('outbox',entree.seq));refuse=false;
  const mutate=db.mutate.bind(db);let atteint=false,modifiee;
  if(concurrence)db.mutate=async opts=>{if(!atteint&&opts.deletes?.outbox?.includes(entree.seq)&&opts.puts?.sync_conflicts?.some(c=>c.id===copie.id)){
   atteint=true;modifiee={...copie,copie_locale:{notes:'Autre copie concurrente'}};await mutate({origin:'remote',puts:{sync_conflicts:[modifiee]}});
  }return mutate(opts);};
  const erreur=await echec(()=>push.envoyer());db.mutate=mutate;
  if(concurrence){ok(atteint,'B2 ACK concurrent : fenêtre avant transaction atteinte');eq(erreur,'Error','B2 ACK concurrent : conflit changé refuse le commit');ok(await db.get('outbox',entree.seq),'B2 ACK concurrent : entrée non retirée sur décision périmée');eq(await db.get('sync_conflicts',copie.id),modifiee,'B2 ACK concurrent : nouvelle copie intacte');}
  else{eq(erreur,null,'B2 ACK sélectif : accusé écrit');eq((await db.get('sync_conflicts',copie.id))?.resolution?.choix,'envoye','B2 ACK sélectif : sa copie exacte résolue');}
  eq(await db.get('sync_conflicts',autre.id),autre,'B2 ACK : aucune autre copie résolue ni écrasée');
 });
 await bloc('interface',async(repo,db)=>{
  const f=await semer(db,types[2]),ctx={available:true,user:{id:'u1'},guard:{ok:true},moteur:{enCours:false}},root=document.createElement('div'),actions=[];
  root.append(...syncSectionL3(syncSectionModel({...ctx,quarantaine:[f.entree]}),{abandonner:seq=>actions.push(seq),reessayer:()=>{}}));
  const abandon=[...root.querySelectorAll('button')].find(b=>b.textContent==='Abandonner cet envoi');ok(abandon,'B2 interface : abandon visible pour quarantaine protégée admissible');abandon?.click();eq(actions,[10],'B2 interface : bouton câblé sur la bonne entrée');
  await abandonnerEnvoi({db,seq:10,confirm:async()=>true});const conflits=await db.getAll('sync_conflicts'),modele=syncSectionModel({...ctx,conflits});root.replaceChildren(...syncSectionL3(modele,{}));
  ok(modele.lines.includes('Conflits : 0'),'B2 interface : copie documentaire résolue ne compte plus comme conflit');
  ok(!root.textContent.includes('Conflits à trancher'),'B2 interface : aucun arbitrage demandé pour la copie résolue');
  ok(root.querySelector('pre')?.textContent.includes('Copie locale <img src=x>'),'B2 interface : copie résolue consultable');eq(root.querySelector('img'),null,'B2 interface : copie rendue uniquement en texte');
 });
}
