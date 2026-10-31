import {withDatabase} from './backup.js';
import {SYNC_STORES} from '../src/model/schema.js';
import {envoiInitial} from '../src/sync/backfill.js';

const MODIFIE='Données initiales modifiées pendant la capture';
const DATE='2026-10-30T10:00:00.000Z';
const version=(id,recipe_id)=>({id,recipe_id,steps:[],ingredients:[],updated_at:DATE});
async function semer(db,table,puts={}){
 await db.mutate({origin:'remote',puts:{...puts,sync_state:[
  {key:'user_id',value:'u1'},...SYNC_STORES.filter(s=>s!==table).map(s=>({key:'backfill:'+s,value:'fait'}))
 ]}});
}
function observer(db,table,avant=async()=>{}){
 const mutate=db.mutate.bind(db),morceaux=[];
 db.mutate=async args=>{
  if(args.puts?.outbox?.some(r=>r.store===table)||args.puts?.sync_state?.some(r=>r.key==='backfill:'+table)){
   morceaux.push(args);await avant(args,morceaux.length,mutate);
  }
  return mutate(args);
 };
 return{morceaux,restaurer:()=>{db.mutate=mutate;}};
}
async function issue(db,options={}){
 try{return{ok:true,resultat:await envoiInitial({db,getUserId:()=> 'u1',...options})};}
 catch(error){return{ok:false,motif:error.message};}
}
const cles=cs=>Object.entries(cs).flatMap(([store,conditions])=>conditions.map(c=>store+':'+(c.key??'#'+c.index+'='+c.valeur)));

export async function runAuditEnvoiInitialTests({eq,ok}){
 await withDatabase(async db=>{
  const versions=Array.from({length:500},(_,n)=>version('v'+String(n).padStart(3,'0'),'r'+n%2));
  await semer(db,'recipe_versions',{recipes:[{id:'r0'},{id:'r1'},...Array.from({length:3000},(_,n)=>({id:'etrangere-'+n}))],recipe_versions:versions});
  const vue=observer(db,'recipe_versions');let r;
  try{r=await issue(db);}finally{vue.restaurer();}
  eq(r.ok,true,'9.7 volume : cinq cents versions réellement mises en file');
  eq(vue.morceaux.length,1,'9.7 volume : un seul morceau de cinq cents lignes');
  const cs=vue.morceaux[0].conditions,nombre=Object.values(cs).reduce((n,a)=>n+a.length,0);
  ok(nombre<=503,'9.7 volume : au plus500lignes +2parents référencés +1compte');
  eq((cs.recipes||[]).map(c=>c.key).sort(),['r0','r1'],'9.7 volume : aucune recette étrangère dans les conditions');
  eq(Object.values(cs).flat().some(c=>c.toutes),false,'9.7 volume : aucun contrôle de magasin entier caché');
  eq((await db.getAll('outbox')).map(e=>e.snapshot),versions,'9.7 volume : copies des versions exactes dans la file');
  eq((await db.getAll('outbox')).map(e=>[e.recipe_id,e.expected_cycle_id,e.expected_edition_id,e.archive_import]),versions.map(v=>[v.recipe_id,null,null,true]),'9.7 volume : contextes initiaux conservés');
  eq((await db.get('sync_state','backfill:recipe_versions'))?.value,'fait','9.7 volume : marqueur dans le commit final');
 });

 for(const cas of [
  {nom:'parent référencé modifié',store:'recipes',row:{id:'r',title:'Concurrent'},refuse:true},
  {nom:'parent étranger modifié',store:'recipes',row:{id:'ailleurs',title:'Concurrent'},refuse:false},
  {nom:'ligne du morceau modifiée',store:'recipe_versions',row:{...version('v','r'),notes:'Concurrent'},refuse:true},
 ])await withDatabase(async db=>{
  await semer(db,'recipe_versions',{recipes:[{id:'r'},{id:'ailleurs'}],recipe_versions:[version('v','r')]});
  const vue=observer(db,'recipe_versions',async(_,n,mutate)=>{if(n===1)await mutate({origin:'remote',puts:{[cas.store]:[cas.row]}});});let r;
  try{r=await issue(db);}finally{vue.restaurer();}
  eq(r.ok, !cas.refuse,'9.7 concurrence : '+cas.nom+' — issue exacte');
  eq(r.motif??null,cas.refuse?MODIFIE:null,'9.7 concurrence : '+cas.nom+' — motif exact');
  eq((await db.getAll('outbox')).length,cas.refuse?0:1,'9.7 concurrence : '+cas.nom+' — atomicité de la file');
  eq((await db.get('sync_state','backfill:recipe_versions'))?.value??null,cas.refuse?null:'fait','9.7 concurrence : '+cas.nom+' — marqueur cohérent');
  eq(await db.get(cas.store,cas.row.id),cas.row,'9.7 concurrence : '+cas.nom+' — saisie concurrente intacte');
 });

 const absents=[
  {nom:'recette',table:'recipe_versions',puts:{recipe_versions:[version('v','manquant')]},store:'recipes',row:{id:'manquant'}},
  {nom:'édition',table:'recipe_versions',puts:{recipe_versions:[version('v','r')],recipes:[{id:'r',edition_id:'manquant'}]},store:'book_editions',row:{id:'manquant',book_id:'b'}},
  {nom:'version intermédiaire',table:'recipe_translations',puts:{recipe_translations:[{id:'tr',recipe_version_id:'manquant'}]},store:'recipe_versions',row:version('manquant','r')},
  {nom:'page source',table:'imports',puts:{imports:[{id:'i',kind:'recette',page_ids:['manquant']}]},store:'source_pages',row:{id:'manquant',document_id:'doc'}},
  {nom:'document source',table:'source_pages',puts:{source_pages:[{id:'p',document_id:'manquant'}]},store:'source_documents',row:{id:'manquant',edition_id:'ed'}},
  {nom:'repas',table:'meal_feedback',puts:{meal_feedback:[{id:'f',meal_id:'manquant'}]},store:'meals',row:{id:'manquant',recipe_ids:['r']}},
  {nom:'séance',table:'cook_history',puts:{cook_history:[{id:'h',cook_session_id:'manquant'}]},store:'cook_sessions',row:{id:'manquant',selected_version_ids:['v']}},
 ];
 for(const cas of absents)await withDatabase(async db=>{
  await semer(db,cas.table,cas.puts);
  const vue=observer(db,cas.table,async(_,n,mutate)=>{if(n===1)await mutate({origin:'remote',puts:{[cas.store]:[cas.row]}});});let r;
  try{r=await issue(db);}finally{vue.restaurer();}
  eq(r.motif,MODIFIE,'9.7 absence : '+cas.nom+' ajouté après capture est refusé précisément');
  eq((await db.getAll('outbox')).length,0,'9.7 absence : '+cas.nom+' ne laisse aucun envoi partiel');
  eq(await db.get('sync_state','backfill:'+cas.table),undefined,'9.7 absence : '+cas.nom+' ne pose pas le marqueur');
 });

 await withDatabase(async db=>{
  const a={id:'a',document_ids:['b']},b={id:'b',recipe_id:'r'};
  await semer(db,'source_documents',{source_documents:[a,b],recipes:[{id:'r'}]});
  const vue=observer(db,'source_documents',async(_,n,mutate)=>{if(n===1)await mutate({origin:'remote',puts:{source_documents:[{...b,title:'Concurrent'}]}});});let r;
  try{r=await issue(db,{tailleMorceau:1});}finally{vue.restaurer();}
  eq(r.motif,MODIFIE,'9.7 même magasin : parent hors morceau modifié refusé');
  eq((await db.getAll('outbox')).length,0,'9.7 même magasin : premier document non envoyé avant de découvrir son parent changé');
  eq(vue.morceaux.length,1,'9.7 même magasin : refus dès le morceau dépendant');
 });
 await withDatabase(async db=>{
  await semer(db,'imports',{imports:[{id:'i',kind:'recette',page_ids:['p']}],source_pages:[{id:'p',document_id:'doc'}],source_documents:[{id:'doc',recipe_id:'r'}],recipes:[{id:'r',edition_id:'ed'}],book_editions:[{id:'ed',book_id:'b'}]});
  const vue=observer(db,'imports',async(_,n,mutate)=>{if(n===1)await mutate({origin:'remote',puts:{source_pages:[{id:'p',document_id:'ailleurs'}]}});});let r;
  try{r=await issue(db);}finally{vue.restaurer();}
  eq(r.motif,MODIFIE,'9.7 graphe source : page réellement traversée protégée');
  eq((await db.getAll('outbox')).length,0,'9.7 graphe source : lien changé ne publie pas un ancien contexte');
  eq(cles(vue.morceaux[0].conditions).sort(),['book_editions:ed','imports:i','recipes:r','source_documents:doc','source_pages:p','sync_state:user_id'].sort(),'9.7 graphe source : uniquement les lectures du même parcours');
 });

 for(const initialVide of [false,true])for(const action of ['ajout','rattachement','étrangère'])await withDatabase(async db=>{
  const eds=[...(initialVide?[]:[{id:'ed',book_id:'b'}]),{id:'autre',book_id:'ailleurs'}];
  await semer(db,'books',{books:[{id:'b',title:'Livre'}],book_editions:eds});
  const row=action==='ajout'?{id:'nouvelle',book_id:'b'}:action==='rattachement'?{id:'autre',book_id:'b'}:{id:'autre',book_id:'ailleurs',title:'Concurrent'};
  const vue=observer(db,'books',async(_,n,mutate)=>{if(n===1)await mutate({origin:'remote',puts:{book_editions:[row]}});});let r;
  try{r=await issue(db);}finally{vue.restaurer();}
  const refuse=action!=='étrangère',nom=action+(initialVide?' depuis ensemble vide':' depuis ensemble connu');
  eq(r.motif??null,refuse?MODIFIE:null,'9.7 éditions du livre : '+nom+' — décision exacte');
  eq((await db.getAll('outbox')).length,refuse?0:1,'9.7 éditions du livre : '+nom+' — file atomique');
  eq((await db.get('sync_state','backfill:books'))?.value??null,refuse?null:'fait','9.7 éditions du livre : '+nom+' — marqueur');
 });

 await withDatabase(async db=>{
  await semer(db,'recipe_versions',{recipes:[{id:'r',edition_id:'ed'}],book_editions:[{id:'ed',book_id:'b'}],recipe_versions:[version('a','r'),version('b','r')]});
  const vue=observer(db,'recipe_versions',async(_,n,mutate)=>{if(n===2)await mutate({origin:'remote',puts:{book_editions:[{id:'ed',book_id:'b',title:'Concurrent'}]}});});let r;
  try{r=await issue(db,{tailleMorceau:1});}finally{vue.restaurer();}
  eq(r.motif,MODIFIE,'9.7 cache : édition relue même pour le second record du même parent');
  eq((await db.getAll('outbox')).map(e=>e.id),['a'],'9.7 cache : seul le premier morceau valide reste en file');
  eq(await db.get('sync_state','backfill:recipe_versions'),undefined,'9.7 cache : refus du dernier morceau sans marqueur');
  eq((vue.morceaux[1].conditions.book_editions||[]).map(c=>c.key),['ed'],'9.7 cache : garde d’édition présente sans doublon');
 });

 await withDatabase(async db=>{
  const vs=Array.from({length:501},(_,i)=>version('v'+String(i).padStart(3,'0'),'r'));
  await semer(db,'recipe_versions',{recipes:[{id:'r'}],recipe_versions:vs});
  const vue=observer(db,'recipe_versions',async(_,n)=>{if(n===2)throw Error('Interruption simulée');});let r;
  try{r=await issue(db);}finally{vue.restaurer();}
  eq(r.motif,'Interruption simulée','9.7 reprise : interruption atteint le second morceau');
  const avant=await db.getAll('outbox');eq(avant.length,500,'9.7 reprise : premier morceau entier conservé');
  eq(await db.get('sync_state','backfill:recipe_versions'),undefined,'9.7 reprise : aucun marqueur avant le dernier morceau');
  const reprise=observer(db,'recipe_versions');let termine;
  try{termine=await issue(db);}finally{reprise.restaurer();}
  eq(termine.ok,true,'9.7 reprise : second passage termine');
  eq(reprise.morceaux.map(x=>x.puts.outbox.map(e=>e.id)),[['v500']],'9.7 reprise : seule la ligne restante est ajoutée');
  const apres=await db.getAll('outbox');eq(apres.slice(0,500),avant,'9.7 reprise : intentions antérieures non rebasées');
  eq(apres.length,501,'9.7 reprise : aucune duplication');
  eq((await db.get('sync_state','backfill:recipe_versions'))?.value,'fait','9.7 reprise : marqueur avec le dernier envoi');
 });
 for(const vide of [false,true])for(const durable of [false,true])await withDatabase(async db=>{
  await semer(db,'recipe_versions',{recipes:[{id:'r'}],recipe_versions:vide?[]:[version('v','r')]});let owner='u1';
  const vue=observer(db,'recipe_versions',async(_,n,mutate)=>{if(n===1){if(durable)await mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u2'}]}});else owner='u2';}});let r;
  try{r=await issue(db,{getUserId:()=>owner});}finally{vue.restaurer();}
  const nom=(vide?'morceau vide':'morceau rempli')+(durable?' compte durable':' connexion');
  eq(r.motif,'Compte de synchronisation changé','9.7 propriétaire : '+nom+' refus exact');
  eq((await db.getAll('outbox')).length,0,'9.7 propriétaire : '+nom+' aucune file partielle');
  eq(await db.get('sync_state','backfill:recipe_versions'),undefined,'9.7 propriétaire : '+nom+' aucun marqueur');
 });
}
