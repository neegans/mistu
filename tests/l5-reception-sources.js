import { withDatabase } from './backup.js';
import { createPull } from '../src/sync/pull.js';
import { garderIci, garderAilleurs, ignorerRenvoye, purgerAnciens } from '../src/sync/conflits.js';
import { creerTransportFactice } from './transport-factice.js';
import { signerCommandeSources } from '../src/domain/sources-format.js';
import { CLE_SOURCE_CONFIRMEE } from '../src/sync/commandes-sources.js';
const at='2026-10-29T12:00:00.000Z',apres='2026-10-29T13:00:00.000Z';
const locale={id:'source-session',edition_id:null,status:'open',page_ids:['p1','p2'],document_ids:['d1'],source_state:{format:1,revision:'choix-local',active_page_ids:['p2']},updated_at:at};
const distante={...locale,source_state:{format:1,revision:'choix-serveur',active_page_ids:['p1']},updated_at:apres};
const commande=()=>signerCommandeSources({protocol:1,op:'source_revision',operation_id:'choix-local',store:'scan_sessions',id:locale.id,edition_id:null,base_edition_cycle_id:null,payload_sha256:'a'.repeat(64),action:'select',base_session_sha256:'a'.repeat(64),base_source_revision:'base',base_sources:[],new_documents:[],new_pages:[],active_page_ids:['p2']});
const ligne=(data=distante,seq=10)=>({id:locale.id,data,updated_at:data?.updated_at||apres,deleted_at:null,server_seq:seq});
const lire=async(db,row,extra={})=>createPull({db,getUserId:()=> 'u',transport:creerTransportFactice({lire:{scan_sessions:[[row],[]]}}),...extra}).recevoir();
async function seed(db,pending=true){const command=await commande();await db.putBatch({sync_state:[{key:'user_id',value:'u'}],scan_sessions:[locale],...(pending?{outbox:[{seq:1,user_id:'u',store:'scan_sessions',id:locale.id,op:command.op,payload:command,tries:0}]}:{})},{origin:'remote'});return command;}
export async function runL5ReceptionSourcesTests({eq,ok}){
 const run=async(nom,fn)=>{try{await withDatabase(fn);}catch(e){ok(false,'L5 réception '+nom+' : '+(e.stack||e));}};
 await run('overlay',async db=>{const c=await seed(db);await lire(db,ligne());
  eq(await db.get('scan_sessions',locale.id),locale,'L5 pull : sélection locale en file protégée de l’écho serveur');
  eq((await db.get('sync_state',CLE_SOURCE_CONFIRMEE('scan_sessions',locale.id)))?.value,{user_id:'u',data:distante,server_seq:10,updated_at:apres,deleted_at:null},'L5 pull : copie exacte serveur conservée séparément avec propriétaire et séquence');
  eq((await db.getAll('outbox')).map(e=>e.payload),[c],'L5 pull : aucune conversion de commande en put ni mutation de payload');
  eq((await db.get('sync_state','cursor:scan_sessions'))?.value,10,'L5 pull : curseur et confirmation avancent ensemble');
 });
 await run('tombale',async db=>{await seed(db);await lire(db,{...ligne(null),deleted_at:apres});
  eq(await db.get('scan_sessions',locale.id),locale,'L5 pull : tombale ne supprime pas une intention locale');
  eq((await db.get('sync_state',CLE_SOURCE_CONFIRMEE('scan_sessions',locale.id)))?.value.deleted_at,apres,'L5 pull : tombale confirmée reste récupérable pour comparaison');
 });
 await run('ancien écho',async db=>{await seed(db,false);const cle=CLE_SOURCE_CONFIRMEE('scan_sessions',locale.id),conf={user_id:'u',data:locale,server_seq:30,updated_at:at,deleted_at:null};await db.put('sync_state',{key:cle,value:conf},{origin:'remote'});await lire(db,ligne(distante,20));
  eq(await db.get('scan_sessions',locale.id),locale,'L5 pull : ancien écho ne remplace pas une confirmation plus récente');eq((await db.get('sync_state',cle)).value,conf,'L5 pull : séquence confirmée ne régresse pas');
 });
 await run('confirmation concurrente',async db=>{await seed(db,false);const cle=CLE_SOURCE_CONFIRMEE('scan_sessions',locale.id),mutation=db.mutate.bind(db);let injecter=true;
  db.mutate=async opts=>{if(injecter&&opts.conditions?.sync_state?.some(c=>c.key===cle)){injecter=false;await mutation({origin:'remote',puts:{scan_sessions:[locale],sync_state:[{key:cle,value:{user_id:'u',data:locale,server_seq:40,updated_at:at,deleted_at:null}}]}});}return mutation(opts);};
  await lire(db,ligne(distante,20));ok(!injecter,'L5 pull : confirmation gardée dans transaction');eq((await db.get('scan_sessions',locale.id)).source_state.revision,'choix-local','L5 pull : confirmation arrivée entre lecture et commit préservée');eq((await db.get('sync_state',cle))?.value.server_seq,40,'L5 pull : état confirmé concurrent inchangé');
 });
 await run('commande apparue avant transaction',async db=>{const c=await seed(db,false),mutation=db.mutate.bind(db);let injecter=true;
  db.mutate=async opts=>{if(injecter&&opts.origin==='remote'&&opts.puts?.sync_state?.some(r=>r.key==='cursor:scan_sessions')){injecter=false;await mutation({origin:'remote',puts:{scan_sessions:[locale],outbox:[{seq:1,user_id:'u',store:'scan_sessions',id:locale.id,op:c.op,payload:c,tries:0}]}});}return mutation(opts);};
  await lire(db,ligne());eq(await db.get('scan_sessions',locale.id),locale,'L5 pull : commande ajoutée juste avant commit garde sélection locale');eq((await db.getAll('outbox')).length,1,'L5 pull : nouvelle intention ni supprimée ni convertie');
 });
 await run('confirmation autre propriétaire',async db=>{await seed(db);const cle=CLE_SOURCE_CONFIRMEE('scan_sessions',locale.id);await db.put('sync_state',{key:cle,value:{user_id:'autre',data:{...distante,titre_prive:'secret autre compte'},server_seq:999,updated_at:apres,deleted_at:null}},{origin:'remote'});await lire(db,ligne());
  eq((await db.get('sync_state',cle)).value.user_id,'u','L5 pull : confirmation étrangère ne devient pas base du compte courant');eq((await db.get('sync_state',cle)).value.server_seq,10,'L5 pull : séquence étrangère ne masque pas la réception autorisée');
 });
 await run('compte changé au commit',async db=>{await seed(db);const mutation=db.mutate.bind(db);let injecter=true,refuse=false;
  db.mutate=async opts=>{if(injecter&&opts.origin==='remote'&&opts.puts?.sync_state?.some(r=>r.key==='cursor:scan_sessions')){injecter=false;await mutation({origin:'remote',puts:{sync_state:[{key:'user_id',value:'autre'}]}});}return mutation(opts);};
  try{await lire(db,ligne());}catch{refuse=true;}
  ok(refuse,'L5 pull : compte changé pendant la page refuse toute la transaction');eq(await db.get('scan_sessions',locale.id),locale,'L5 pull : changement de compte garde copie locale');
  eq(await db.get('sync_state',CLE_SOURCE_CONFIRMEE('scan_sessions',locale.id)),undefined,'L5 pull : aucune confirmation du compte précédent inscrite');eq(await db.get('sync_state','cursor:scan_sessions'),undefined,'L5 pull : aucun curseur avancé pour autre compte');
 });
 await run('page dans commande',async db=>{const c=await seed(db),p={id:'nouvelle-page',document_id:'document-local',edition_id:null,rotation:90,sha256:'b'.repeat(64),updated_at:at};
  await db.putBatch({source_pages:[p],outbox:[{seq:1,user_id:'u',store:c.store,id:c.id,op:c.op,payload:{...c,new_pages:[{id:p.id,data:p}]},tries:0}]},{origin:'remote'});
  const row={id:p.id,data:{...p,rotation:0},updated_at:apres,deleted_at:null,server_seq:5};await createPull({db,getUserId:()=> 'u',transport:creerTransportFactice({lire:{source_pages:[[row],[]]}})}).recevoir();
  eq(await db.get('source_pages',p.id),p,'L5 pull : page couverte par commande de séance garde sa branche locale');eq((await db.get('sync_state',CLE_SOURCE_CONFIRMEE('source_pages',p.id)))?.value.server_seq,5,'L5 pull : confirmation de page reçue séparément');
 });
 for(const [nom,geste] of [['ici',garderIci],['ailleurs',garderAilleurs],['ignorer',ignorerRenvoye]])await run('conflit '+nom,async db=>{
  const c=await seed(db),conflit={id:'source:'+c.operation_id,kind:'source',operation_id:c.operation_id,user_id:'u',store:'scan_sessions',record_id:locale.id,local:c,server:ligne(),reason:'source_changed',renvoye:nom==='ignorer',at:'2020-01-01T00:00:00.000Z'};await db.put('sync_conflicts',conflit,{origin:'remote'});
  eq(await geste(db,conflit),false,'L5 conflit : geste générique '+nom+' interdit');eq(await db.get('scan_sessions',locale.id),locale,'L5 conflit : '+nom+' garde la copie locale');eq(await db.get('sync_conflicts',conflit.id),conflit,'L5 conflit : '+nom+' garde l’intention à comparer');
 });
 await run('purge',async db=>{const c=await seed(db),conflit={id:'source:'+c.operation_id,kind:'source',store:'scan_sessions',record_id:locale.id,local:c,user_id:'u',at:'2020-01-01T00:00:00.000Z'};await db.put('sync_conflicts',conflit,{origin:'remote'});
  eq(await purgerAnciens(db,Date.parse(apres)),0,'L5 conflit : pas de purge automatique de l’intention ancienne');eq(await db.get('sync_conflicts',conflit.id),conflit,'L5 conflit : ancienne copie toujours récupérable');
 });
 await run('ancien bouton générique',async db=>{await seed(db);const ancien={id:'scan_sessions:'+locale.id,kind:'donnees',store:'scan_sessions',record_id:locale.id,local:locale,server:ligne(),at};await db.put('sync_conflicts',ancien,{origin:'remote'});
  eq(await garderAilleurs(db,ancien),false,'L5 conflit : ancien bouton ne contourne pas une commande maintenant en file');eq(await db.get('scan_sessions',locale.id),locale,'L5 conflit : ancienne comparaison ne remplace pas l’overlay');
 });
 await run('commande pendant résolution générique',async db=>{const c=await seed(db,false),ancien={id:'scan_sessions:'+locale.id,kind:'donnees',store:'scan_sessions',record_id:locale.id,local:locale,server:ligne(),at};await db.put('sync_conflicts',ancien,{origin:'remote'});const mutation=db.mutate.bind(db);let injecter=true;
  db.mutate=async opts=>{if(injecter&&opts.deletes?.sync_conflicts?.includes(ancien.id)){injecter=false;await mutation({origin:'remote',puts:{outbox:[{seq:1,user_id:'u',store:c.store,id:c.id,op:c.op,payload:c,tries:0}]}});}return mutation(opts);};
  eq(await garderAilleurs(db,ancien),false,'L5 conflit : commande ajoutée juste avant résolution bloque ancien bouton');eq(await db.get('scan_sessions',locale.id),locale,'L5 conflit : CAS du geste générique conserve sélection');eq(await db.get('sync_conflicts',ancien.id),ancien,'L5 conflit : copie concurrente reste disponible');
 });

}
