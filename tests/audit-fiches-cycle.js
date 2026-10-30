import {withDatabase} from './backup.js';
import {createPull} from '../src/sync/pull.js';
import {garderIci,garderAilleurs} from '../src/sync/conflits.js';
import {installCapture} from '../src/sync/outbox.js';
import {composerLots} from '../src/sync/lots.js';
import {CLE_EPOQUE_EDITEUR} from '../src/domain/brouillons-format.js';

const AT='2026-10-30T12:00:00.000Z',EGAL='2026-10-30T12:00:00+00:00',APRES='2026-10-30T13:00:00.000Z';
const owner={key:'user_id',value:'u1'},epoch={key:CLE_EPOQUE_EDITEUR,value:'bibliotheque-a'};
const copie=structuredClone,ecrire=(db,puts)=>db.mutate({origin:'remote',puts});
const fiche=(store,titre='Ici',at=AT)=>({id:'fiche',lifecycle_id:'cycle',trashed_at:null,updated_at:at,...(store==='recipes'?{original_title:titre}:{book_id:'livre',title:titre,trash_mode:null})});
const cleConfirmation=store=>(store==='recipes'?'lifecycle:':'edition-lifecycle:')+'fiche';
const distante=(data,at=data.updated_at,seq=8)=>({id:data.id,data,updated_at:at,deleted_at:null,server_seq:seq});
async function semer(db,store,row,extra={}){await ecrire(db,{books:[{id:'livre',title:'Livre'}],sync_state:[owner,epoch],[store]:[row],...extra});}
function transportPage(store,rows,avant=null){let envoyee=false;return{async lire(table){if(table!==store||envoyee)return{lignes:[],erreur:null};envoyee=true;await avant?.();return{lignes:rows,erreur:null};}};}
async function recevoir(db,store,rows,{transport=transportPage(store,rows),getUserId=()=> 'u1'}={}){
 try{return{bilan:await createPull({db,transport,getUserId}).recevoir(),erreur:null};}catch(e){return{bilan:null,erreur:e.code||e.message};}
}
async function intercaler(db,store,faire,test){
 const mutate=db.mutate.bind(db);let passages=0;
 db.mutate=async options=>{if(options.origin==='remote'&&options.puts?.sync_state?.some(r=>r.key==='cursor:'+store)){passages++;await faire(mutate,passages);}return mutate(options);};
 try{return await test(()=>passages);}finally{db.mutate=mutate;}
}

export async function runAuditFichesCycleTests({eq,ok}){
 for(const store of ['recipes','book_editions'])for(const at of [AT,EGAL])await withDatabase(async db=>{
  const local=fiche(store),remote=fiche(store,'Ailleurs',at),ligne=distante(remote);await semer(db,store,local);
  const r=await recevoir(db,store,[ligne]),conflit=await db.get('sync_conflicts',store+':fiche');
  eq(r.erreur,null,`B4 ${store} égal : page reçue (${at})`);
  eq(await db.get(store,'fiche'),local,`B4 ${store} égal : copie locale conservée`);
  eq([conflit?.kind,conflit?.local,conflit?.server.data],['donnees',local,remote],`B4 ${store} égal : deux copies exactes journalisées`);
  eq(await db.count('outbox'),0,`B4 ${store} égal : aucun renvoi sans choix`);
  eq((await db.get('sync_state',cleConfirmation(store)))?.value,{data:remote,server_seq:8,user_id:'u1'},`B4 ${store} égal : confirmation du serveur conservée`);
  eq((await db.get('sync_state','cursor:'+store))?.value,8,`B4 ${store} égal : curseur atomique`);
 });
 for(const store of ['recipes','book_editions'])await withDatabase(async db=>{
  const local={...fiche(store),meta:{z:1,a:[{b:2,a:1}]}},remote={meta:{a:[{a:1,b:2}],z:1},...fiche(store,'Ici',EGAL)};await semer(db,store,local);
  await recevoir(db,store,[distante(remote)]);
  eq(await db.count('sync_conflicts'),0,`B4 ${store} : ordre JSON et écriture de date ne font pas de conflit`);
  eq(await db.get(store,'fiche'),local,`B4 ${store} : écho identique ne réécrit pas la copie locale`);
 });
 for(const store of ['recipes','book_editions'])await withDatabase(async db=>{
  const local=fiche(store,'Plus récent ici',APRES),remote=fiche(store,'Ancien serveur');await semer(db,store,local);
  await recevoir(db,store,[distante(remote)]);const conflit=await db.get('sync_conflicts',store+':fiche'),file=await db.getAll('outbox');
  eq(await db.get(store,'fiche'),local,`B4 ${store} récent : contenu local conservé`);
  eq([conflit?.kind,conflit?.renvoye,conflit?.local],['donnees',true,local],`B4 ${store} récent : conflit informatif porte la copie renvoyée`);
  eq(file.length,1,`B4 ${store} récent : une seule remise en file`);
  eq([file[0]?.user_id,file[0]?.snapshot],['u1',local],`B4 ${store} récent : propriétaire et instantané exacts`);
  const lots=await composerLots(file,async(s,id)=>db.get(s,id)),element=lots.lots[0]?.elements[0];
  eq(store==='recipes'?[element?.recipe_id,element?.expected_cycle_id,element?.expected_edition_id]:element?.edition_contexts,store==='recipes'?['fiche','cycle',null]:[{edition_id:'fiche',expected_cycle_id:'cycle'}],`B4 ${store} récent : cycle porté par le véritable lot d’envoi`);
 });
 for(const variante of ['paralleles','ancetre','absente','etrangere','egal'])await withDatabase(async db=>{
  const local={...fiche('recipes'),current_version_id:'ici'},remote={...fiche('recipes','Ailleurs',variante==='egal'?EGAL:APRES),current_version_id:'ailleurs'};
  const versions=[{id:'racine',recipe_id:'fiche'},{id:'ici',recipe_id:'fiche',parent_version_id:'racine'},...(variante==='absente'?[]:[{id:'ailleurs',recipe_id:variante==='etrangere'?'autre':'fiche',parent_version_id:variante==='ancetre'?'ici':'racine'}])];
  await semer(db,'recipes',local,{recipe_versions:versions});await recevoir(db,'recipes',[distante(remote)]);const conflit=await db.get('sync_conflicts','recipes:fiche');
  eq(conflit?.kind??null,variante==='paralleles'?'version':variante==='egal'?'donnees':null,`B4 pointeur ${variante} : bon arbitrage`);
  eq((await db.get('recipes','fiche')).current_version_id,variante==='egal'?'ici':'ailleurs',`B4 pointeur ${variante} : pointeur attendu`);
  eq(await db.getAll('recipe_versions'),versions.sort((a,b)=>a.id.localeCompare(b.id)),`B4 pointeur ${variante} : aucune version effacée`);
 });
 for(const store of ['recipes','book_editions'])for(const concurrent of [false,true])await withDatabase(async db=>{
  const local=fiche(store),remote=fiche(store,'Ailleurs',APRES),premier={id:store+':fiche',store,record_id:'fiche',kind:'cycle',local:{...local,note:'Première copie hors ligne'},server:{data:remote},at:AT};
  await semer(db,store,local,concurrent?{}:{sync_conflicts:[premier]});
  await intercaler(db,store,async(m,n)=>{if(concurrent&&n===1)await m({origin:'remote',puts:{sync_conflicts:[premier]}});},async n=>{
   await recevoir(db,store,[distante(remote)]);eq(n(),1,`B4 ${store} : transaction atteinte avec conflit cycle ${concurrent?'concurrent':'antérieur'}`);
  });
  eq(await db.get('sync_conflicts',premier.id),premier,`B4 ${store} : premier conflit cycle reste entier`);
  eq(await db.get(store,'fiche'),remote,`B4 ${store} : contenu plus récent converge malgré le conflit documentaire`);
 });
 for(const store of ['recipes','book_editions'])for(const action of ['trash','restore'])await withDatabase(async db=>{
  const serveur=fiche(store,'Même contenu'),local={...serveur,lifecycle_id:'operation',trashed_at:action==='trash'?AT:null,...(store==='book_editions'?{trash_mode:action==='trash'?'keep_recipes':null}:{})};
  if(action==='restore'){serveur.trashed_at=AT;if(store==='book_editions')serveur.trash_mode='keep_recipes';}
  const cmd={seq:1,user_id:'u1',store,id:'fiche',op:'lifecycle',payload:{operation_id:'operation',base_cycle_id:'cycle',action,at:AT,seed:serveur,...(store==='recipes'?{recipe_id:'fiche'}:{entity:'edition',edition_id:'fiche',mode:'keep_recipes'})}};
  await semer(db,store,local,{outbox:[cmd]});await recevoir(db,store,[distante(serveur)]);
  eq(await db.get(store,'fiche'),local,`B4 overlay ${store}/${action} : geste local reste appliqué`);
  eq(await db.count('sync_conflicts'),0,`B4 overlay ${store}/${action} : pas de conflit contre le cycle serveur brut`);
  eq(await db.get('outbox',1),cmd,`B4 overlay ${store}/${action} : commande inchangée`);
  eq(await db.count('outbox'),1,`B4 overlay ${store}/${action} : aucun put ordinaire ajouté`);
 });
 for(const store of ['recipes','book_editions'])await withDatabase(async db=>{
  const serveur=fiche(store,'Serveur'),local={...fiche(store,'Contenu local plus récent',APRES),lifecycle_id:'operation',trashed_at:AT,...(store==='book_editions'?{trash_mode:'keep_recipes'}:{})};
  const cmd={seq:1,user_id:'u1',store,id:'fiche',op:'lifecycle',payload:{operation_id:'operation',base_cycle_id:'cycle',action:'trash',at:AT,seed:serveur,...(store==='recipes'?{recipe_id:'fiche'}:{entity:'edition',edition_id:'fiche',mode:'keep_recipes'})}};
  await semer(db,store,local,{outbox:[cmd]});await recevoir(db,store,[distante(serveur)]);
  eq(await db.get(store,'fiche'),local,`B4 overlay récent ${store} : contenu et geste local conservés`);
  eq(await db.getAll('outbox'),[cmd],`B4 overlay récent ${store} : aucune intention ordinaire rebâtie`);
  eq(await db.count('sync_conflicts'),0,`B4 overlay récent ${store} : pas de faux conflit de contenu`);
 });
 await withDatabase(async db=>{
  const serveur={...fiche('recipes','Serveur'),trashed_at:AT},local={...serveur,lifecycle_id:'operation',trashed_at:null};
  const cmd={seq:1,user_id:'u1',store:'recipes',id:'fiche',op:'lifecycle',payload:{recipe_id:'fiche',operation_id:'operation',base_cycle_id:'cycle',action:'restore',at:AT,seed:serveur}};
  await semer(db,'recipes',local,{outbox:[cmd]});
  await intercaler(db,'recipes',async(m,n)=>{if(n===1)await m({origin:'remote',puts:{outbox:[{...cmd,quarantined_at:APRES}]}});},async n=>{
   const r=await recevoir(db,'recipes',[distante(serveur)]);eq(r.erreur,null,'B4 commande concurrente : reprise reçoit la vraie intention');eq(n(),2,'B4 commande concurrente : la file lifecycle est réellement gardée');
  });
  eq((await db.get('sync_conflicts','recipes:fiche'))?.local,local,'B4 commande concurrente : copie avant blocage récupérable');
  eq((await db.get('sync_conflicts','recipes:fiche'))?.kind,'cycle','B4 commande concurrente : blocage traité comme cycle');
  eq((await db.get('outbox',1)).lifecycle_blocked,true,'B4 commande concurrente : quarantaine relue, commande bloquée');
 });
 for(const variation of ['contenu','heure','pointeur'])await withDatabase(async db=>{
  const local={...fiche('recipes'),current_version_id:'ici'},remote={...fiche('recipes','Serveur',EGAL),current_version_id:'ailleurs'},nouvelle={...local,...(variation==='heure'?{updated_at:APRES}:variation==='pointeur'?{current_version_id:'nouvelle'}:{original_title:'Autre onglet'})};
  await semer(db,'recipes',local,{recipe_versions:['ici','ailleurs','nouvelle'].map(id=>({id,recipe_id:'fiche'}))});
  await intercaler(db,'recipes',async(m,n)=>{if(n===1)await m({origin:'remote',puts:{recipes:[nouvelle]}});},async n=>{
   const r=await recevoir(db,'recipes',[distante(remote)]);eq(r.erreur,null,`B4 course ${variation} : réception reprise`);eq(n(),2,`B4 course ${variation} : CAS a réellement invalidé le premier plan`);
  });
  eq(await db.get('recipes','fiche'),nouvelle,`B4 course ${variation} : modification concurrente conservée`);
  eq((await db.get('sync_conflicts','recipes:fiche'))?.local,nouvelle,`B4 course ${variation} : conflit reconstruit sur la bonne copie`);
  eq(await db.count('outbox'),variation==='heure'?1:0,`B4 course ${variation} : seul le contenu plus récent repart`);
 });
 for(const simultane of [false,true])await withDatabase(async db=>{
  const local={...fiche('recipes','Modification ancienne',APRES),edition_id:'edition'},remote={...fiche('recipes','Serveur'),edition_id:'edition'};
  const parent={id:'edition',book_id:'livre',lifecycle_id:'parent-initial',trashed_at:null,trash_mode:null};await semer(db,'recipes',local,{book_editions:[parent]});let apres;
  const label='B4 parent concurrent'+(simultane?' et nouvelle date recette':'');
  await intercaler(db,'recipes',async(m,n)=>{if(n===1){await m({origin:'remote',puts:{book_editions:[{...parent,lifecycle_id:'parent-concurrent'}],...(simultane?{recipes:[{...local,updated_at:'2026-10-30T14:00:00.000Z'}]}:{})}});apres=await db.getSnapshot();}},async n=>{
   const r=await recevoir(db,'recipes',[distante(remote)]);eq(r.erreur,'SYNC_PARENT_CHANGED',label+' : refus exact du renvoi préparé pour un autre contexte');
   eq(n(),1,label+' : aucune reprise ne rebâtit l’intention sur le nouveau cycle');
  });
  eq(await db.getSnapshot(),apres,label+' : aucune confirmation ni curseur ni écriture après la course');
  eq(await db.count('outbox'),0,label+' : aucun put avec un nouveau contexte implicite');
 });
 await withDatabase(async db=>{
  const local={...fiche('recipes','Modification ancienne',APRES),edition_id:'edition'},seconde={...local,id:'fiche-2'};
  const parent={id:'edition',book_id:'livre',lifecycle_id:'parent-initial',trashed_at:null,trash_mode:null};
  await semer(db,'recipes',local,{recipes:[local,seconde],book_editions:[parent]});
  const get=db.get.bind(db);let lectures=0,apres;
  db.get=async(store,id)=>{
   if(store==='book_editions'&&id==='edition'&&++lectures===2){await ecrire(db,{book_editions:[{...parent,lifecycle_id:'parent-concurrent'}]});apres=await db.getSnapshot();}
   return get(store,id);
  };
  try{await intercaler(db,'recipes',async()=>{},async n=>{
   const r=await recevoir(db,'recipes',[distante({...local,updated_at:AT}),distante({...seconde,updated_at:AT},AT,9)]);
   eq(lectures,2,'B4 parent partagé : changement réellement intercalé entre les deux recettes');
   eq(r.erreur,'SYNC_PARENT_CHANGED','B4 parent partagé : le second renvoi ne remplace pas la première lecture du parent');
   eq(n(),0,'B4 parent partagé : refus avant la transaction de page');
  });}finally{db.get=get;}
  eq(await db.getSnapshot(),apres,'B4 parent partagé : copies, file, confirmations et curseur conservés après la course');
 });
 await withDatabase(async db=>{
  const local=fiche('recipes'),remote=fiche('recipes','Serveur');await semer(db,'recipes',local);let derniere;
  await intercaler(db,'recipes',async(m,n)=>{derniere={...local,original_title:'Course '+n};await m({origin:'remote',puts:{recipes:[derniere]}});},async n=>{
   const r=await recevoir(db,'recipes',[distante(remote)]);eq(r.erreur,'SYNC_SOURCE_CHANGED','B4 course répétée : refus exact après reprises bornées');eq(n(),4,'B4 course répétée : une tentative et trois reprises');
  });
  eq(await db.get('recipes','fiche'),derniere,'B4 course répétée : dernière modification préservée');
  eq([await db.get('sync_state','cursor:recipes'),await db.get('sync_state',cleConfirmation('recipes')),await db.count('sync_conflicts')],[undefined,undefined,0],'B4 course répétée : ni curseur ni confirmation ni conflit partiel');
 });
 for(const moment of ['transport','commit','reprise','vide'])for(const changement of ['epoque','compte','connexion'])await withDatabase(async db=>{
  const local=fiche('recipes'),remote=fiche('recipes','Ailleurs',APRES);await semer(db,'recipes',local);let user='u1',apres=null,fait=0;
  const changer=async m=>{fait++;if(changement==='compte'){user='u2';await m({origin:'remote',puts:{sync_state:[{...owner,value:user}]}});}else if(changement==='epoque')await m({origin:'remote',puts:{sync_state:[{...epoch,value:'bibliotheque-b'}]}});else{db.idb.close();db.idb=null;await db.open();}apres=await db.getSnapshot();};
  const transport=transportPage('recipes',moment==='vide'?[]:[distante(remote)],['transport','vide'].includes(moment)?()=>changer(db.mutate.bind(db)):null);
  await intercaler(db,'recipes',async(m,n)=>{if(moment==='commit'&&n===1)await changer(m);if(moment==='reprise'&&n===1){await m({origin:'remote',puts:{recipes:[{...local,original_title:'Course avant changement'}]}});await changer(m);}},async()=>{
   const r=await recevoir(db,'recipes',[distante(remote)],{transport,getUserId:()=>user});
   eq(fait,1,`B4 portée ${changement}/${moment} : fenêtre exercée`);
   eq(changement==='compte'?r.bilan?.erreur?.type??r.erreur:r.erreur,changement==='compte'&&['transport','vide'].includes(moment)?'auth':changement==='compte'?'Compte de synchronisation changé':'SYNC_LIBRARY_CHANGED',`B4 portée ${changement}/${moment} : page ancienne refusée`);
  });
  eq(await db.getSnapshot(),apres,`B4 portée ${changement}/${moment} : aucune écriture dans le nouveau contexte`);
 });
 for(const garder of [garderIci,garderAilleurs])await withDatabase(async db=>{
  const local=fiche('recipes'),remote=fiche('recipes','Ailleurs',EGAL);await semer(db,'recipes',local);installCapture(db,{getUserId:()=> 'u1'});
  await recevoir(db,'recipes',[distante(remote)]);const conflit=await db.get('sync_conflicts','recipes:fiche');
  const applique=conflit?await garder(db,conflit):false;eq(applique,true,`B4 résolution ${garder.name} : vrai geste appliqué`);
  const row=await db.get('recipes','fiche');eq([row.original_title,row.lifecycle_id],[garder===garderIci?'Ici':'Ailleurs','cycle'],`B4 résolution ${garder.name} : copie choisie et cycle conservés`);
  eq(await db.count('sync_conflicts'),0,`B4 résolution ${garder.name} : conflit retiré`);
  eq(await db.count('outbox'),garder===garderIci?1:0,`B4 résolution ${garder.name} : seul le choix local repart`);
 });
}
