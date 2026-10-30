import {withRepo} from './sync-fixture.js';
import {withDatabase} from './backup.js';
import {creerServiceBrouillons} from '../src/domain/brouillons-editeur.js';
import {creerTransportFactice} from './transport-factice.js';
import {createMoteur} from '../src/sync/moteur.js';
import {installCapture} from '../src/sync/outbox.js';
import {PREFIXE_BROUILLON} from '../src/domain/brouillons-format.js';
export async function runL4BrouillonsSyncTests({eq,ok}){
 await withRepo(async(repo,a)=>withDatabase(async b=>{
  await a.put('sync_state',{key:'user_id',value:'u1'},{origin:'device'});await b.put('sync_state',{key:'user_id',value:'u1'},{origin:'device'});installCapture(b,{getUserId:()=> 'u1'});
  const r={id:'sync-ed-r',original_title:'Original',display_title:'Soupe',availability:'available',current_version_id:'sync-ed-v',source_page_ids:[]},v={id:'sync-ed-v',recipe_id:r.id,kind:'extraction',ingredients:[],steps:[{id:'s',text:'Cuire.'}],updated_at:'2026-10-29T12:00:00.000Z'};
  await a.mutate({origin:'remote',puts:{recipes:[r],recipe_versions:[v]}});
  const s=creerServiceBrouillons({repo,getGeneration:()=>0}),{portee}=await s.capturerPortee({owner_id:'u1'});
  const ouvert=()=>s.ouvrirBrouillon({kind:'recipe_version',intention:'correction',portee,affiche:{recipe:r,version:v}}),local=await ouvert();local.modele.contenu.notes='BROUILLON_LOCAL_NE_JAMAIS_ENVOYER';
  const reste=await s.conserverBrouillon({session:local.session,expectedRevision:null,payload:local.modele});
  const edition=await ouvert();edition.modele.contenu.steps[0].text='Étape publiée';const c=await s.conserverBrouillon({session:edition.session,expectedRevision:null,payload:edition.modele}),p=await s.preparerPublication({id:c.id,portee,expectedRevision:c.revision}),publication=await s.publierBrouillon({plan:p.plan});eq(publication.issue,'publie','L4 moteurs : publication locale effective');
  const serveur=creerTransportFactice({serveur:true}),ma=createMoteur({db:a,transport:serveur,getUserId:()=> 'u1'}),mb=createMoteur({db:b,transport:serveur,getUserId:()=> 'u1'});
  try{await ma.executer();await mb.executer();const version=await b.get('recipe_versions',publication.recu?.publication.version_id);
   eq(version?.steps[0].text,'Étape publiée','L4 moteurs : vraie version reçue sur second appareil');
   eq((await b.get('recipes',r.id))?.current_version_id,publication.recu.publication.version_id,'L4 moteurs : pointeur publié reçu');
   const paquets=serveur.journal.filter(x=>x.appel==='pousser').flatMap(x=>x.rows),json=JSON.stringify(paquets);
   ok(!json.includes(PREFIXE_BROUILLON)&&!json.includes('editor_library_epoch')&&!json.includes('BROUILLON_LOCAL_NE_JAMAIS_ENVOYER'),'L4 moteurs : paquets réels sans brouillon/reçu/époque');
   eq((await b.getAll('sync_state')).filter(r=>r.key.startsWith('editor_')),[],'L4 moteurs : second appareil sans texte local');
   eq((await a.get('sync_state',PREFIXE_BROUILLON+reste.id)).value.payload.contenu.notes,'BROUILLON_LOCAL_NE_JAMAIS_ENVOYER','L4 moteurs : brouillon resté sur son appareil');
   eq((await a.getAll('outbox')).length,0,'L4 moteurs : file drainée');
  }finally{await ma.arreter();await mb.arreter();}
 }));
}
