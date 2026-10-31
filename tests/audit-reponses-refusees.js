import {withRepo} from './sync-fixture.js';
import {withDatabase} from './backup.js';
import {sha256Hex} from '../src/core/hash.js';
import {octetsJsonbSources} from '../src/domain/sources-format.js';
import {validerLigneEditeur} from '../src/domain/brouillons-format.js';
import {creerServiceBrouillons} from '../src/domain/brouillons-editeur.js';
const CLE='assistant_rejected:v1:',EPOQUE='editor_library_epoch:v1',DATE='2026-10-30T16:00:00.000Z';
const bytes=text=>new TextEncoder().encode(text),copy=structuredClone;
async function semer(repo,kind='thermomix'){
 const journal={id:'imp-refuse',kind,recipe_id:'recette-refus',source_version_id:'version-refus',owner_id:'u1',device_id:repo.deviceId(),status:'a_lancer',revision_brouillon:0,tentative_id:null,resultat:null,reponse_refusee:null,contexte:{source:'fixture'}};
 await repo.db.mutate({origin:'remote',puts:{imports:[journal],sync_state:[{key:'user_id',value:'u1'},{key:EPOQUE,value:'epoque-refus'}]}});return journal;
}
async function depart(repo,controle,journal){
 const c=await controle.capturer({journal});if(c.issue!=='ok')throw Error('Capture refusée '+JSON.stringify(c));
 const row=await repo.transitionner('imports',journal.id,{attendus:['a_lancer','echec','a_verifier'],patch:{status:'en_cours',tentative_id:repo.newId('tentative'),resultat:null}});
 return{capture:c.capture,journal:row};
}
const options=(v,octets=bytes('Réponse <script> inerte'),motif='capacite')=>({...v,octets,motif,transition:{attendus:['en_cours'],recettes:[],patch:r=>({status:'echec',resultat:null,erreur:{raison:motif},finished_at:DATE})}});
export async function runAuditReponsesRefuseesTests({eq,ok}){
 let api;try{api=await import('../src/domain/reponses-refusees.js')}catch{ok(false,'10.2 reçus : dépôt local disponible');return;}
 const creer=repo=>api.creerConservationReponseRefusee({repo,maintenant:()=>DATE});
 const run=async(nom,fn)=>{try{await withRepo(fn)}catch(e){ok(false,'10.2 reçus '+nom+' : '+(e.stack||e.message))}};
 await run('mémoire avant SHA',async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial),digest=crypto.subtle.digest;let liberer,signaler,premier=true;
  const attente=new Promise(r=>{liberer=r}),atteint=new Promise(r=>{signaler=r});crypto.subtle.digest=async function(...args){if(premier){premier=false;signaler();await attente;}return digest.apply(this,args)};
  try{const reception=c.conserver(options(v));await atteint;eq(c.presenceEnAttente({importId:initial.id}),true,'10.2 SHA : corps déjà en mémoire avant fin du hash');eq(await db.get('imports',initial.id),v.journal,'10.2 SHA : pas de référence avant hash');liberer();eq((await reception).issue,'conserve','10.2 SHA : même réception finit après libération du hash');}
  finally{liberer();crypto.subtle.digest=digest;}
 });
 await run('époque absente',async(repo,db)=>{
  const journal=await semer(repo);await db.delete('sync_state',EPOQUE,{origin:'device'});const c=creer(repo);eq((await c.capturer({journal})).issue,'ok','10.2 époque : capture crée la portée manquante');
  const e=await db.get('sync_state',EPOQUE);eq(Object.keys(e).sort(),['key','value'],'10.2 époque : ligne réservée sans dates métier');let valide=true;try{validerLigneEditeur(e)}catch{valide=false}eq(valide,true,'10.2 époque : format L4 reste valide');
  const editeur=creerServiceBrouillons({repo,getGeneration:()=>0});eq((await editeur.capturerPortee({owner_id:'u1'})).issue,'ok','10.2 époque : ouverture des éditeurs reste possible');
 });
 await run('repères sans version',async(repo,db)=>{
  const initial={...await semer(repo,'reperes'),source_version_id:null};await db.mutate({origin:'remote',puts:{imports:[initial]}});
  const c=creer(repo),capture=await c.capturer({journal:initial});eq(capture.issue,'ok','10.2 repères : référence sans version admise pour conservation');
  if(capture.issue!=='ok')return;const journal=await repo.transitionner('imports',initial.id,{attendus:['a_lancer'],patch:{status:'en_cours',tentative_id:'tentative-sans-version'}});
  eq((await c.conserver(options({capture:capture.capture,journal}))).issue,'conserve','10.2 repères : reçu conservé sans fabriquer de version');eq((await c.lire({importId:initial.id})).etat,'disponible','10.2 repères : reçu relu avec source null');
 });
 for(const kind of ['thermomix','reperes'])await run(kind,async(repo,db)=>{
  const initial=await semer(repo,kind),c=creer(repo),v=await depart(repo,c,initial),brut=new Uint8Array([0,255,128,60,62,10,195,169]);
  eq((await c.lire({importId:initial.id})).etat,'aucune',`10.2 ${kind} : aucune référence avant réception`);
  const r=await c.conserver(options(v,brut));eq(r.issue,'conserve',`10.2 ${kind} : référence et reçu réellement conservés`);
  const row=await db.get('imports',initial.id),local=await db.get('sync_state',CLE+initial.id),ref=row.reponse_refusee;
  eq([row.status,row.resultat,row.erreur.raison],['echec',null,'capacite'],`10.2 ${kind} : brut jamais présenté comme proposition`);
  eq(Object.keys(ref).sort(),['format','reference','tentative_id','motif','byte_length','sha256','saved_at'].sort(),`10.2 ${kind} : référence de forme fermée`);
  eq([ref.byte_length,ref.sha256,ref.tentative_id,ref.saved_at],[brut.length,await sha256Hex(brut),v.journal.tentative_id,DATE],`10.2 ${kind} : référence exacte du corps reçu`);
  ok(!JSON.stringify(row).includes('base64')&&!Object.hasOwn(ref,'data'),`10.2 ${kind} : aucun corps dans l’import`);
  eq([local.value.body.encoding,local.value.body.byte_length,local.value.body.sha256],['base64',brut.length,ref.sha256],`10.2 ${kind} : enveloppe locale vérifiable`);
  const lu=await c.lire({importId:initial.id});eq([lu.issue,lu.etat,lu.motif],['ok','disponible','capacite'],`10.2 ${kind} : reçu consultable sans source culinaire`);
  eq([...lu.octets],[...brut],`10.2 ${kind} : octets UTF8 invalides récupérables sans transformation`);
  lu.octets[0]=9;eq([...(await c.lire({importId:initial.id})).octets],[...brut],`10.2 ${kind} : consultation rend une copie`);
  eq((await db.getAll('outbox')).every(e=>e.store==='imports'&&!JSON.stringify(e).includes('base64')),true,`10.2 ${kind} : corps local absent de chaque envoi`);
  eq(c.presenceEnAttente({importId:initial.id}),false,`10.2 ${kind} : réussite vide seulement le pending conservé`);
  const controleNeuf=creer(repo);eq([...(await controleNeuf.lire({importId:initial.id})).octets],[...brut],`10.2 ${kind} : réouverture retrouve les octets`);
 });
 for(const [kind,limite] of [['thermomix',1024*1024],['reperes',128*1024]])await run('bornes '+kind,async(repo,db)=>{
  const initial=await semer(repo,kind),c=creer(repo),v=await depart(repo,c,initial),corps=new Uint8Array(limite).fill(97),r=await c.conserver(options(v,corps,'reponse_illisible'));
  eq(r.issue,'conserve',`10.2 ${kind} : plafond exact reçu entier`);const lu=await c.lire({importId:initial.id});eq([lu.octets.length,await sha256Hex(lu.octets)],[limite,await sha256Hex(corps)],`10.2 ${kind} : plafond exact longueur et SHA`);
  const row=await db.get('imports',initial.id);ok(octetsJsonbSources(row)<524288,`10.2 ${kind} : import synchronisé reste sous512Kio`);
  const v2=await depart(repo,c,row),avant=await db.get('sync_state',CLE+initial.id),trop=await c.conserver(options(v2,new Uint8Array(limite+1)));
  eq(trop.raison,'limite_reponse',`10.2 ${kind} : un octet de trop refusé précisément`);eq(await db.get('sync_state',CLE+initial.id),avant,`10.2 ${kind} : refus de borne conserve le reçu précédent`);
 });
 await run('quota et réessai',async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial);await c.conserver(options(v,bytes('ancien refus')));
  const ancien=await db.get('imports',initial.id),ancienLocal=await db.get('sync_state',CLE+initial.id),luAncien=await c.lire({importId:initial.id}),v2=await depart(repo,c,ancien),file=await db.getAll('outbox');
  const mutation=db.mutate.bind(db);let quota=true,commits=0;db.mutate=async a=>{if(a.conditions?.sync_state?.some(x=>x.key===CLE+initial.id)){commits++;if(quota)throw new DOMException('quota simulé','QuotaExceededError')}return mutation(a)};
  try{const brut=bytes('nouveau refus payé'),r=await c.conserver(options(v2,brut));eq([r.issue,r.raison,r.reessayable],['a_conserver','quota_stockage',true],'10.2 quota : annonce attente, jamais conservation');
   eq(await db.get('imports',initial.id),v2.journal,'10.2 quota : aucune référence partielle');eq(await db.get('sync_state',CLE+initial.id),ancienLocal,'10.2 quota : ancien reçu entier intact');eq(await db.getAll('outbox'),file,'10.2 quota : aucun envoi partiel');
   eq(c.presenceEnAttente({importId:initial.id}),true,'10.2 quota : attente mémoire signalée');const p=await c.reponseEnAttente({importId:initial.id});eq([p.etat,p.motif,...p.octets],['en_attente','capacite',...brut],'10.2 quota : récupération exacte depuis mémoire');
   const ref=copy(p.reference);p.octets[0]=0;eq([...(await c.reponseEnAttente({importId:initial.id})).octets],[...brut],'10.2 quota : mémoire privée non modifiable par UI');
   eq((await c.abandonner({attendu:luAncien.attendu})).raison,'conservation_en_attente','10.2 quota : abandon durable interdit pendant attente');
   eq((await c.capturer({journal:v2.journal})).raison,'conservation_en_attente','10.2 quota : autre départ interdit pendant attente');
   quota=false;const avant=commits,rs=await Promise.all([c.reessayerConservation({importId:initial.id}),c.reessayerConservation({importId:initial.id})]);
   eq(rs.map(x=>x.issue),['conserve','conserve'],'10.2 quota : deux réessais partagent le commit');eq(commits-avant,1,'10.2 quota : une seule transaction de réessai');eq((await db.get('imports',initial.id)).reponse_refusee,ref,'10.2 quota : même référence date hash après réessai');eq(c.presenceEnAttente({importId:initial.id}),false,'10.2 quota : seule réussite libère mémoire');
  }finally{db.mutate=mutation;}
 });
 for(const cible of ['owner','epoque','tentative','reference','recu','connexion'])await run('course '+cible,async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial),mutation=db.mutate.bind(db);let atteint=false,concurrent;
  db.mutate=async a=>{if(!atteint&&a.conditions?.sync_state?.some(x=>x.key===CLE+initial.id)){
   atteint=true;
   if(cible==='connexion'){db.idb.close();db.idb=null;await db.open();}
   else{const puts=cible==='owner'?{sync_state:[{key:'user_id',value:'u2'}]}:cible==='epoque'?{sync_state:[{key:EPOQUE,value:'epoque-neuve'}]}:cible==='tentative'?{imports:[{...v.journal,tentative_id:'tentative-autre'}]}:cible==='reference'?{imports:[{...v.journal,reponse_refusee:{reference:'autre'}}]}:{sync_state:[{key:CLE+initial.id,value:{concurrent:true}}]};concurrent=puts;await mutation({origin:'remote',puts});}
  }return mutation(a)};
  try{const r=await c.conserver(options(v));eq(atteint,true,`10.2 ${cible} : course atteint la transaction du reçu`);eq([r.issue,r.raison,r.reessayable],['a_conserver',{owner:'compte_change',epoque:'bibliotheque_remplacee',tentative:'tentative_perimee',reference:'reponse_changee',recu:'reponse_changee',connexion:'contexte_change'}[cible],false],`10.2 ${cible} : refus exact sans adoption de nouvelle portée`);
   eq((await db.get('imports',initial.id)).status,'en_cours',`10.2 ${cible} : tentative ne prétend pas conservation`);eq(await db.get('sync_state',CLE+initial.id),cible==='recu'?concurrent.sync_state[0]:undefined,`10.2 ${cible} : reçu absent ou concurrent préservé`);
   if(cible==='owner'||cible==='epoque'||cible==='connexion'){const p=await c.reponseEnAttente({importId:initial.id});eq(p.issue,'refuse',`10.2 ${cible} : corps mémoire inaccessible sous portée changée`);eq(p.octets,undefined,`10.2 ${cible} : aucun octet divulgué à la nouvelle portée`);}
  }finally{db.mutate=mutation;}
 });
 await run('liaison',async(repo,db)=>withDatabase(async autre=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial),mutation=db.mutate.bind(db);let atteint=false;
  db.mutate=async a=>{if(!atteint&&a.conditions?.sync_state?.some(x=>x.key===CLE+initial.id)){atteint=true;repo.bindDatabase(autre);}return mutation(a)};
  try{const r=await c.conserver(options(v));eq([atteint,r.raison],[true,'contexte_change'],'10.2 liaison : base changée en transaction refusée');eq(await db.get('sync_state',CLE+initial.id),undefined,'10.2 liaison : aucune écriture ancienne base');eq(await autre.get('sync_state',CLE+initial.id),undefined,'10.2 liaison : aucune écriture nouvelle base');}
  finally{repo.bindDatabase(db);db.mutate=mutation;}
 }));
 await run('portée avant départ',async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),capt=await c.capturer({journal:initial});await db.mutate({origin:'remote',puts:{sync_state:[{key:EPOQUE,value:'epoque-apres-depart'}]}});
  const journal=await repo.transitionner('imports',initial.id,{attendus:['a_lancer'],patch:{status:'en_cours',tentative_id:'nouvelle-tentative'}});
  const r=await c.conserver(options({capture:capt.capture,journal}));eq(r.raison,'bibliotheque_remplacee','10.2 portée : nouvelle époque entre capture et départ jamais adoptée');eq(await db.get('sync_state',CLE+initial.id),undefined,'10.2 portée : aucun reçu dans bibliothèque remplacée');
 });
 for(const champ of ['sha256','byte_length','base64','contenu','reference','motif'])await run('altération '+champ,async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial);await c.conserver(options(v));const local=await db.get('sync_state',CLE+initial.id),row=await db.get('imports',initial.id);
  if(champ==='sha256')local.value.body.sha256='0'.repeat(64);if(champ==='byte_length')local.value.body.byte_length++;if(champ==='base64')local.value.body.data='!';if(champ==='contenu')local.value.body.data=btoa('A'+atob(local.value.body.data).slice(1));if(champ==='reference')row.reponse_refusee.reference='autre';if(champ==='motif')row.reponse_refusee.motif='<script>';
  await db.mutate({origin:'remote',puts:{sync_state:[local],imports:[row]}});const lu=await c.lire({importId:initial.id});eq([lu.issue,lu.raison,lu.octets],['refuse','reponse_changee',undefined],`10.2 ${champ} : référence/corps hostile ne se lit pas`);
 });
 await run('autre appareil et abandon',async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial);await c.conserver(options(v));const row=await db.get('imports',initial.id),local=await db.get('sync_state',CLE+initial.id);
  await db.delete('sync_state',local.key,{origin:'remote'});eq((await c.lire({importId:initial.id})).etat,'absente','10.2 autre appareil : référence seule signifie reçu absent');
  await db.mutate({origin:'remote',puts:{sync_state:[local]}});const lu=await c.lire({importId:initial.id}),r=await c.abandonner({attendu:lu.attendu});eq(r.issue,'abandonne','10.2 abandon : geste durable réellement exécuté');eq(await db.get('sync_state',local.key),undefined,'10.2 abandon : reçu exact supprimé');eq((await db.get('imports',initial.id)).reponse_refusee,null,'10.2 abandon : référence effacée atomiquement');eq((await db.get('imports',initial.id)).erreur,row.erreur,'10.2 abandon : motif métier conservé');eq(r.journal,await db.get('imports',initial.id),'10.2 abandon : journal exact retourné au prochain geste de l’écran');
 });
 await run('ordre JSONB',async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial);await c.conserver(options(v));const row=await db.get('imports',initial.id);
  row.reponse_refusee=Object.fromEntries(Object.entries(row.reponse_refusee).reverse());await db.mutate({origin:'remote',puts:{imports:[row]}});
  const lu=await c.lire({importId:initial.id});eq(lu.etat,'disponible','10.2 JSONB : ordre des clés de référence ne change pas le reçu');if(lu.issue==='ok'&&lu.attendu)eq((await c.abandonner({attendu:lu.attendu})).issue,'abandonne','10.2 JSONB : abandon de la référence relue réordonnée');
 });
 for(const champ of ['recipe_id','source_version_id'])await run('liaison journal '+champ,async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial);await c.conserver(options(v));const row=await db.get('imports',initial.id);
  await db.mutate({origin:'remote',puts:{imports:[{...row,[champ]:'identite-etrangere'}]}});const lu=await c.lire({importId:initial.id});eq([lu.issue,lu.raison,lu.octets],['refuse','reponse_changee',undefined],`10.2 liaison ${champ} : reçu refusé après réassociation du journal`);
 });
 await run('accusé perdu et réassociation',async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial),mutation=db.mutate.bind(db);let perdu=false;
  db.mutate=async a=>{const r=await mutation(a);if(!perdu&&a.conditions?.sync_state?.some(x=>x.key===CLE+initial.id)){perdu=true;throw new DOMException('accusé local perdu simulé','UnknownError')}return r};
  try{eq((await c.conserver(options(v))).issue,'a_conserver','10.2 accusé : mémoire conservée après issue locale inconnue');const row=await db.get('imports',initial.id),autre={...row,recipe_id:'recette-etrangere'};await mutation({origin:'remote',puts:{imports:[autre]}});
   eq((await c.reessayerConservation({importId:initial.id})).raison,'reponse_changee','10.2 accusé : même référence ne valide pas un journal réassocié');eq(await db.get('imports',initial.id),autre,'10.2 accusé : réessai ne réécrit pas la liaison concurrente');
  }finally{db.mutate=mutation;}
 });
 for(const cible of ['recu','reference'])await run('abandon concurrent '+cible,async(repo,db)=>{
  const initial=await semer(repo),c=creer(repo),v=await depart(repo,c,initial);await c.conserver(options(v));const lu=await c.lire({importId:initial.id}),row=await db.get('imports',initial.id),local=await db.get('sync_state',CLE+initial.id),mutation=db.mutate.bind(db);let atteint=false;
  const concurrent=cible==='recu'?{...local,value:{...local.value,saved_at:'2026-10-30T17:00:00.000Z'}}:{...row,reponse_refusee:{...row.reponse_refusee,reference:'autre'}};
  db.mutate=async a=>{if(!atteint&&a.deletes?.sync_state?.includes(local.key)){atteint=true;await mutation({origin:'remote',puts:{[cible==='recu'?'sync_state':'imports']:[concurrent]}});}return mutation(a)};
  try{const r=await c.abandonner({attendu:lu.attendu});eq([atteint,r.issue,r.raison],[true,'refuse','reponse_changee'],`10.2 abandon ${cible} : CAS exact en transaction`);eq(await db.get('sync_state',local.key),cible==='recu'?concurrent:local,`10.2 abandon ${cible} : reçu concurrent jamais effacé`);eq(await db.get('imports',row.id),cible==='reference'?concurrent:row,`10.2 abandon ${cible} : journal concurrent intact`);}finally{db.mutate=mutation;}
 });
}
