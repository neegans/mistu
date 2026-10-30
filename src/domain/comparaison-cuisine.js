// Comparer les copies réellement reçues, sans transformer un refus en nouveau geste de cuisine.
import {creerServiceBrouillons} from './brouillons-editeur.js';
import {CLE_EPOQUE_EDITEUR} from './brouillons-format.js';
import {CLE_SOURCE_CONFIRMEE} from '../sync/commandes-sources.js';
import {newId as idDefaut,nowIso} from '../core/ids.js';
import {identifiantSource,comparerUtf8} from './sources-format.js';
import {ErreurCuisine,egalesCuisine,estLigneCuisine,validerMinuteurCuisine,validerSessionCuisine,verifierCommandeCuisine,projectionIdentiteMinuteur} from './cuisine-format.js';
const clone=structuredClone,fail=raison=>{throw new ErreurCuisine(raison);},cle=(s,id)=>s+':'+id;
export const MAGASINS_COMPARAISON_CUISINE=Object.freeze(['cook_sessions','timer_launches','outbox','sync_conflicts','sync_state','recipes','recipe_versions','book_editions']);
function decrireSeance(row,snapshot){
 if(!row)return null;
 const versions=(row.selected_version_ids||[]).map(id=>{
  const v=(snapshot.recipe_versions||[]).find(x=>x.id===id),r=(snapshot.recipes||[]).find(x=>x.id===v?.recipe_id),p=row.progress?.by_version?.[id],steps=Array.isArray(v?.steps)?v.steps:[];
  const numero=steps.findIndex(s=>s.id===p?.current_step_id),step=numero<0?null:steps[numero],coches=steps.flatMap((s,i)=>p?.done_step_ids?.includes(s.id)?[i+1]:[]);
  return{active:row.active_version_id===id,titre:r?.display_title||r?.original_title||null,kind:v?.kind??null,created_at:v?.created_at??null,disponible:!!v&&!!r,
   etape:step?{numero:numero+1,texte:typeof step.title==='string'&&step.title?step.title:typeof step.text==='string'?step.text:''}:null,pointeur_present:p?.current_step_id!=null,
   coches,coches_inconnues:(p?.done_step_ids?.length||0)-coches.length};
 });
 return{versions};
}
// CAS de copies IndexedDB : garder les propriétés historiques undefined et les trous d'un tableau.
// Ce comparateur n'entre jamais dans les empreintes des commandes, dont le format reste strict.
export function egalesCopiesCuisine(a,b){
 if(Object.is(a,b))return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 if(Array.isArray(a)){if(a.length!==b.length)return false;}
 else if(![Object.prototype,null].includes(Object.getPrototypeOf(a))||![Object.prototype,null].includes(Object.getPrototypeOf(b)))return false;
 const keys=Object.keys(a),other=Object.keys(b);return keys.length===other.length&&keys.every(k=>Object.hasOwn(b,k)&&egalesCopiesCuisine(a[k],b[k]));
}
export function snapshotComparaisonCuisine(snapshot){
 const result=Object.fromEntries(MAGASINS_COMPARAISON_CUISINE.map(s=>[s,clone(snapshot[s]||[])]));
 result.sync_state=result.sync_state.filter(r=>r.key==='user_id'||r.key===CLE_EPOQUE_EDITEUR||r.key?.startsWith('source_confirmed:cook_sessions:')||r.key?.startsWith('source_confirmed:timer_launches:'));
 return result;
}
// Le dépôt recalcule cette fermeture. L'appelant ne fournit jamais de puts/deletes ni de fusion.
export function deriverComparaisonCuisine({snapshot,cible,owner_id}){
 if(!['cook_sessions','timer_launches'].includes(cible?.store)||!identifiantSource(cible?.id))fail('forme_invalide');
 const rows=new Map(['cook_sessions','timer_launches'].flatMap(s=>(snapshot[s]||[]).map(r=>[cle(s,r.id),r]))),targets=new Map([[cle(cible.store,cible.id),clone(cible)]]),queue=snapshot.outbox||[],conflicts=snapshot.sync_conflicts||[];
 const racine=conflicts.filter(c=>c.kind==='cooking'&&!c.resolution&&c.store===cible.store&&c.record_id===cible.id);
 if(!racine.length)fail('conflit_absent');if(racine.some(c=>c.user_id!==owner_id))fail('compte_change');
 let changed=true;
 while(changed){changed=false;const ajouter=(store,id)=>{const k=cle(store,id);if(!targets.has(k)){targets.set(k,{store,id});changed=true;}};
  for(const e of queue){const c=e.payload,row=rows.get(cle(e.store,e.id));
   const parents=[row?.cook_session_id,c?.change?.timer?.cook_session_id,c?.change?.target?.cook_session_id];
   const depend=parents.some(id=>targets.has(cle('cook_sessions',id))&&(['create','anchor'].includes(c?.action)||c?.action==='restore'&&queue.some(q=>q.payload?.action==='restore'&&q.store==='cook_sessions'&&q.id===id)));
   if(e.store==='timer_launches'&&depend)ajouter('timer_launches',e.id);
  }
  for(const row of snapshot.timer_launches||[])if(row.legacy_launch_id&&targets.has(cle('timer_launches',row.legacy_launch_id)))ajouter('timer_launches',row.id);
  for(const e of queue)if(e.store==='timer_launches'){
   const row=e.payload?.change?.timer||e.payload?.change?.target;
   if(row?.legacy_launch_id&&targets.has(cle('timer_launches',row.legacy_launch_id)))ajouter('timer_launches',e.id);
  }
 }
 const commandes=queue.filter(e=>targets.has(cle(e.store,e.id)));
 if(!commandes.length)fail('conflit_absent');
 if(commandes.some(e=>e.op!=='cooking_apply'||e.payload?.op!=='cooking_apply'||e.store!==e.payload.store||e.id!==e.payload.id))fail('operations_dependantes');
 // Première liaison : le refus nommé prouve que cette intention anonyme a bien été envoyée par ce compte.
 // L'exception ne s'étend qu'à la chaîne fermée, relue sous le même propriétaire et la même époque.
 const liaisonInitiale=owner_id!==null&&racine.some(c=>commandes.some(e=>e.user_id===null&&e.payload.operation_id===c.operation_id&&egalesCuisine(e.payload,c.local)));
 if(commandes.some(e=>e.user_id!==owner_id&&!(e.user_id===null&&liaisonInitiale)))fail('compte_change');
 const conflits=conflicts.filter(c=>!c.resolution&&targets.has(cle(c.store,c.record_id)));
 if(conflits.some(c=>c.kind!=='cooking'))fail('operations_dependantes');if(conflits.some(c=>c.user_id!==owner_id))fail('compte_change');
 for(const c of conflits)if(!commandes.some(e=>e.payload.operation_id===c.operation_id&&egalesCuisine(e.payload,c.local)))fail('operations_dependantes');
 const confirmations=new Map((snapshot.sync_state||[]).map(r=>[r.key,r])),cibles=[];
 for(const target of [...targets.values()].sort((a,b)=>comparerUtf8(cle(a.store,a.id),cle(b.store,b.id)))){
  const locale=rows.get(cle(target.store,target.id))||null,confirmation=confirmations.get(CLE_SOURCE_CONFIRMEE(target.store,target.id))||null;
  if(confirmation){const v=confirmation.value;if(v?.user_id!==owner_id)fail('compte_change');if(!Number.isSafeInteger(v.server_seq)||v.server_seq<0||v.deleted_at==null&&(!v.data||v.data.id!==target.id))fail('confirmation_incomplete');
   if(v.deleted_at==null&&estLigneCuisine(target.store,v.data)&&!(target.store==='cook_sessions'?validerSessionCuisine(v.data):validerMinuteurCuisine(v.data)).ok)fail('confirmation_incomplete');
  }
  const confirmee=confirmation?.value?.deleted_at==null?clone(confirmation?.value?.data??null):null;
  cibles.push({...target,locale:clone(locale),confirmation:clone(confirmation),confirmee,...(target.store==='cook_sessions'?{lectureLocale:decrireSeance(locale,snapshot),lectureConfirmee:decrireSeance(confirmee,snapshot)}:{})});
 }
 // Aucune commande protégée étrangère ne peut garder un pointeur vers une cible retirée ici.
 const independantes=[];
 for(const e of queue)if(!commandes.includes(e)){
  const c=e.payload,locale=rows.get(cle(e.store,e.id));
  const concerne=e.store==='timer_launches'&&[locale?.cook_session_id,e.snapshot?.cook_session_id,c?.change?.timer?.cook_session_id,c?.change?.target?.cook_session_id].some(id=>targets.has(cle('cook_sessions',id)));
  if(concerne){const conf=confirmations.get(CLE_SOURCE_CONFIRMEE(e.store,e.id))?.value;
   if(e.op!=='cooking_apply'||c?.op!=='cooking_apply'||c.action!=='handoff'||c.store!==e.store||c.id!==e.id||e.user_id!==owner_id||conf?.user_id!==owner_id||conf.deleted_at!=null||!conf.data||!Number.isSafeInteger(conf.server_seq)||conf.server_seq<0||!locale||!egalesCuisine(projectionIdentiteMinuteur(locale),projectionIdentiteMinuteur(conf.data)))fail('operations_dependantes');
   independantes.push(e);
  }
  if((c?.contexts?.recipes||[]).some(r=>(r.records||[]).some(x=>targets.has(cle(x.store,x.id)))))fail('operations_dependantes');
 }
 const root=cibles.find(x=>x.store===cible.store&&x.id===cible.id),session_id=cible.store==='cook_sessions'?cible.id:root.locale?.cook_session_id??root.confirmee?.cook_session_id??null;
 return{cible:clone(cible),session_id,cibles,commandes:clone(commandes),independantes:clone(independantes),conflits:clone(conflits),locale:root.locale,confirmee:root.confirmee,dependantes:cibles.filter(x=>x!==root)};
}
export async function verifierCommandesComparaisonCuisine(derive){for(const e of [...derive.commandes,...derive.independantes])await verifierCommandeCuisine(e.payload);}
const erreur=e=>typeof e?.code==='string'?{issue:'refuse',raison:e.code,reessayable:false}:{issue:'echec',raison:e?.name==='QuotaExceededError'?'quota_stockage':'stockage_indisponible',reessayable:true};
export function creerComparaisonCuisine({repo,getGeneration,maintenant=nowIso,newId=idDefaut}={}){
 if(!repo||typeof getGeneration!=='function')throw new TypeError('Dépôt et génération requis');
 const portees=new WeakMap(),comparaisons=new WeakMap(),brouillons=creerServiceBrouillons({repo,getGeneration,maintenant,newId}),encadrer=fn=>async(...args)=>{try{return await fn(...args);}catch(e){return erreur(e);}};
 const garde=p=>{const d=portees.get(p);if(!d)fail('contexte_change');const verifier=()=>{if(repo.db!==d.base||getGeneration()!==d.generation||!d.estCourante())fail('contexte_change');};verifier();return{...d,verifier};};
 async function scope(p){const d=garde(p),[owner,epoque]=await Promise.all([d.base.get('sync_state','user_id'),d.base.get('sync_state',CLE_EPOQUE_EDITEUR)]);d.verifier();if((owner?.value??null)!==p.owner_id)fail('compte_change');if(epoque?.value!==p.library_epoch)fail('bibliotheque_remplacee');return d;}
 async function capturerPortee({owner_id,estCourante=()=>true}={}){const base=repo.db,generation=getGeneration(),r=await brouillons.capturerPortee({owner_id,estCourante});if(r.issue!=='ok')return r;if(base!==repo.db||generation!==getGeneration()||!estCourante())fail('contexte_change');portees.set(r.portee,{base,generation,estCourante});return r;}
 async function lireConflitsCuisine({portee,sessionId}){const d=await scope(portee),snapshot=snapshotComparaisonCuisine(await d.base.getSnapshot(MAGASINS_COMPARAISON_CUISINE));await scope(portee);const timers=new Set(snapshot.timer_launches.filter(r=>r.cook_session_id===sessionId).map(r=>r.id));
  const seen=new Set(),conflits=[];for(const c of snapshot.sync_conflicts)if(c.kind==='cooking'&&!c.resolution&&c.user_id===portee.owner_id&&(c.store==='cook_sessions'&&c.record_id===sessionId||c.store==='timer_launches'&&timers.has(c.record_id))){const k=cle(c.store,c.record_id);if(!seen.has(k)){seen.add(k);conflits.push({store:c.store,id:c.record_id,raison:c.reason});}}return{issue:'ok',conflits};}
 async function capturerComparaisonCuisine({portee,store,id}){const d=await scope(portee),snapshot=snapshotComparaisonCuisine(await d.base.getSnapshot(MAGASINS_COMPARAISON_CUISINE)),cible={store,id},derive=deriverComparaisonCuisine({snapshot,cible,owner_id:portee.owner_id});await verifierCommandesComparaisonCuisine(derive);await scope(portee);const comparaison={};comparaisons.set(comparaison,{portee,snapshot,cible,recovery_id:newId('cooking-recovery'),at:maintenant()});return{issue:'ok',comparaison,affiche:clone(derive)};}
 async function garderCuisineConfirmee({comparaison}){const p=comparaisons.get(comparaison);if(!p)fail('contexte_change');const d=await scope(p.portee);if(p.resultat)return clone({...p.resultat,issue:'deja_conserve'});
  if(p.enCours)return p.enCours;
  p.enCours=(async()=>{const r=await repo.reconcilierCuisine({...p,owner_id:p.portee.owner_id,library_epoch:p.portee.library_epoch},{baseAttendue:d.base,contexteValide:()=>{d.verifier();return true;}});p.resultat={issue:'conserve',...r};return clone(p.resultat);})().finally(()=>{p.enCours=null;});return p.enCours;}
 async function lireRecuperationsCuisine({portee,sessionId}){const d=await scope(portee),rows=await d.base.getAll('sync_conflicts');await scope(portee);return{issue:'ok',recuperations:clone(rows.filter(r=>r.kind==='cooking'&&r.user_id===portee.owner_id&&r.resolution?.choix==='confirmation'&&r.recovery?.format===1&&r.recovery.session_id===sessionId))};}
 return{capturerPortee:encadrer(capturerPortee),lireConflitsCuisine:encadrer(lireConflitsCuisine),capturerComparaisonCuisine:encadrer(capturerComparaisonCuisine),garderCuisineConfirmee:encadrer(garderCuisineConfirmee),lireRecuperationsCuisine:encadrer(lireRecuperationsCuisine)};
}
