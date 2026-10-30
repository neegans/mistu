// Transformations synchrones L7. Les lectures/CAS de source sont posées par le dépôt avant cette fusion.
import {ErreurCuisine,egalesCuisine,adopterProgressionCuisine,ajouterRecuCuisine,lireRecuCuisine,validerMinuteurCuisine,validerSessionCuisine,projectionIdentiteMinuteur,projectionContexteSession,projectionSessionCuisine} from './cuisine-format.js';
import {comparerUtf8} from './sources-format.js';
const fail=c=>{throw new ErreurCuisine(c);},copy=structuredClone,union=(a,b)=>[...new Set([...(a||[]),...(b||[])])].sort(comparerUtf8);
export function appliquerTransitionCuisine(c,avant,{versions=[],attendue=null}={}){
 if(lireRecuCuisine(avant,c))return copy(avant);const x=c.change,b=c.base;let next;
 if(c.action==='restore'){
  if(avant&&(!attendue||!egalesCuisine(avant,attendue)))fail('restauration_changee');next=copy(x.target);
  if(c.store==='timer_launches'){next.cooking_incarnation=c.operation_id;next.cooking_revision=c.operation_id;}else{next.cooking_state.incarnation=c.operation_id;next.cooking_state.active_revision=c.operation_id;next.cooking_state.lang_revision=c.operation_id;for(const entry of Object.values(next.progress.by_version))entry.revision=c.operation_id;}
  next=ajouterRecuCuisine(next,c,{restore:true});
 }else if(c.store==='timer_launches'){
  if(c.action==='create'){if(avant)fail('identite_changee');next={...copy(x.timer),cooking_incarnation:c.operation_id,cooking_revision:c.operation_id,cooking_receipts:[],cooking_receipt_floor:0};}
  else{if(!avant||!attendue||!egalesCuisine(projectionIdentiteMinuteur(avant),projectionIdentiteMinuteur(attendue)))fail('ancre_changee');next=copy(avant);if(c.action==='anchor'){if(avant.mirror!==null)fail('ancre_changee');next.mirror=copy(x.mirror);}else{if(avant.handoff_state!==b.handoff_state)fail('handoff_change');const allowed={requested:['opening','failed'],opening:['unconfirmed','failed'],unconfirmed:['failed'],siri:['failed'],failed:[]};if(!allowed[b.handoff_state]?.includes(x.handoff_state))fail('handoff_change');next.handoff_state=x.handoff_state;}}
  next=ajouterRecuCuisine(next,c);
 }else{
  if(!avant||avant.status!=='active')fail('session_terminee');
  if(c.action==='adopt_progress'){if(!attendue||!egalesCuisine(projectionSessionCuisine(avant),projectionSessionCuisine(attendue)))fail('progression_changee');next=adopterProgressionCuisine(avant,versions,c.operation_id);}
  else{
   if(!attendue||!egalesCuisine(projectionContexteSession(avant),projectionContexteSession(attendue)))fail('session_changee');next=copy(avant);
   if(c.action==='progress'){const e=avant.progress?.by_version?.[b.version_id];if(!e||e.revision!==b.progress_revision)fail('progression_changee');const version=versions.find(v=>v?.id===b.version_id),ids=version?.steps?.map(s=>s.id)||[];if(x.current_step_id!==null&&!ids.includes(x.current_step_id)||x.done_add.some(id=>!ids.includes(id)))fail('source_changee');next.progress.by_version[b.version_id]={...e,current_step_id:x.current_step_id,done_step_ids:union(e.done_step_ids,x.done_add),revision:c.operation_id};}
   else if(c.action==='active'){if(avant.cooking_state.active_revision!==b.active_revision||!avant.selected_version_ids.includes(x.active_version_id))fail('progression_changee');next.active_version_id=x.active_version_id;next.cooking_state.active_revision=c.operation_id;}
   else if(c.action==='language'){if(avant.cooking_state.lang_revision!==b.lang_revision)fail('progression_changee');next.lang=x.lang;next.cooking_state.lang_revision=c.operation_id;}
   else if(c.action==='finish'){for(const r of b.progress)if(avant.progress.by_version[r.version_id]?.revision!==r.revision)fail('progression_changee');for(const r of x.done_add){const e=next.progress.by_version[r.version_id],ids=versions.find(v=>v?.id===r.version_id)?.steps?.map(s=>s.id)||[];if(!e||r.step_ids.some(id=>!ids.includes(id)))fail('source_changee');next.progress.by_version[r.version_id]={...e,done_step_ids:union(e.done_step_ids,r.step_ids),revision:c.operation_id};}next.status='done';next.ended_at=x.ended_at;}
   else fail('forme_invalide');
  }
  next=ajouterRecuCuisine(next,c);
 }
 const valid=c.store==='timer_launches'?validerMinuteurCuisine(next):validerSessionCuisine(next);if(!valid.ok)fail(valid.raison);return next;
}
