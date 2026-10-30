import {ErreurInventaire,projectionSourceInventaire,egalesInventaire} from './inventaire-format.js';
import {empreinteSources} from './sources-format.js';
import {lireCycleRecette} from './cycle-recette.js';
import {lireCycleEdition,lireEtatRecette,exceptionEditionValide} from './cycle-edition.js';
export const MAGASINS_SOURCES_INVENTAIRE=Object.freeze({recipe:'recipes',edition:'book_editions',version:'recipe_versions',history:'cook_history'});
const fail=code=>{throw new ErreurInventaire(code);};
export function referencesInventaire(lot,stores){const lookup=(s,id)=>(stores[s]||[]).find(r=>r.id===id)??null,version=lookup('recipe_versions',lot.source_recipe_version_id),recipe=lookup('recipes',lot.source_recipe_id??version?.recipe_id),edition=lookup('book_editions',recipe?.edition_id),history=lookup('cook_history',lot.source_cook_history_id);return{recipe,version,edition,history};}
export function idsSourcesInventaire(lot,refs){return{recipe:lot.source_recipe_id??refs.version?.recipe_id??null,version:lot.source_recipe_version_id??null,edition:refs.recipe?.edition_id??null,history:lot.source_cook_history_id??null};}
export async function capturerSourceInventaire(lot,refs,action){const ids=idsSourcesInventaire(lot,refs),s={mode:Object.values(ids).every(x=>x===null)?'none':action==='restore'?'restore':action==='create'&&ids.history===null?'active':'historical'};for(const[k,id]of Object.entries(ids)){if(refs[k]&&refs[k].id!==id)fail('source_changee');s[k]=id===null?null:{id,sha256:refs[k]?await empreinteSources(projectionSourceInventaire(k,refs[k])):null};}verifierLiensInventaire(lot,refs,s,action);return s;}
export function verifierLiensInventaire(lot,refs,source,action){
 const ids=idsSourcesInventaire(lot,refs);for(const[k,id]of Object.entries(ids))if((source[k]?.id??null)!==id)fail('source_changee');
 const attendu=Object.values(ids).every(x=>x===null)?'none':action==='restore'?'restore':action==='create'&&ids.history===null?'active':'historical';if(source.mode!==attendu)fail('source_changee');
 if(refs.version&&ids.recipe!==refs.version.recipe_id||refs.history&&(refs.history.recipe_id!==ids.recipe||refs.history.recipe_version_id!==ids.version)||refs.edition&&refs.edition.id!==refs.recipe?.edition_id)fail('source_changee');
 if(refs.recipe&&(lireCycleRecette(refs.recipe).etat==='invalide'||!exceptionEditionValide(refs.recipe))||refs.edition&&lireCycleEdition(refs.edition).etat==='invalide')fail('cycle_change');
 if(action==='create'&&source.mode!=='none'){
  if(!refs.recipe||!refs.version)fail('source_changee');
  if(source.mode==='active'&&lireEtatRecette(refs.recipe,refs.edition).etat!=='active')fail('cycle_change');
  if(source.mode==='historical'&&!refs.history)fail('source_changee');
 }
}
export async function verifierSourceInventaire(c,lot,refs){verifierLiensInventaire(lot,refs,c.source,c.action);for(const k of Object.keys(MAGASINS_SOURCES_INVENTAIRE)){const sha=refs[k]?await empreinteSources(projectionSourceInventaire(k,refs[k])):null;if(sha!==(c.source[k]?.sha256??null))fail('source_changee');}}
export const memeReferenceInventaire=(type,a,b)=>a==null||b==null?a==null&&b==null:egalesInventaire(projectionSourceInventaire(type,a),projectionSourceInventaire(type,b));
