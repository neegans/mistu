// La file de cuisine conserve les actes ; une ligne protégée ne devient jamais un put ordinaire.
import {validerCommandeCuisine,validerMinuteurCuisine,validerSessionCuisine,estLigneCuisine,lireRecuCuisine,ErreurCuisine,egalesCuisine,projectionSeedCuisine} from '../domain/cuisine-format.js';
import {appliquerTransitionCuisine} from '../domain/cuisine-mutations.js';
export {CLE_SOURCE_CONFIRMEE as CLE_CUISINE_CONFIRMEE} from './commandes-sources.js';
export const estCommandeCuisine=c=>c?.op==='cooking_apply';
export const ciblesCommandeCuisine=c=>estCommandeCuisine(c)?[{store:c.store,id:c.id}]:[];
export function lecturesCommandeCuisine(c){if(!estCommandeCuisine(c))return[];const rows=[...(c.contexts?.recipes||[]).map(r=>({store:'recipes',id:r.recipe_id})),...(c.contexts?.editions||[]).map(r=>({store:'book_editions',id:r.edition_id}))];const r=c.change?.timer||c.change?.target;if(c.store==='timer_launches'){if(r?.cook_session_id)rows.push({store:'cook_sessions',id:r.cook_session_id});if(r?.recipe_version_id)rows.push({store:'recipe_versions',id:r.recipe_version_id});if(r?.legacy_launch_id)rows.push({store:'timer_launches',id:r.legacy_launch_id});}for(const id of r?.selected_version_ids||[])rows.push({store:'recipe_versions',id});for(const v of c.base?.versions||[])rows.push({store:'recipe_versions',id:v.id});if(c.base?.version_id)rows.push({store:'recipe_versions',id:c.base.version_id});if(c.change?.active_version_id)rows.push({store:'recipe_versions',id:c.change.active_version_id});for(const v of c.base?.history||[])rows.push({store:'cook_history',id:v.id});return rows;}
export function idsVersionsSourcesCuisine(stores={},entrees=[]){const ids=new Set();for(const r of stores.cook_sessions||[])for(const id of r.selected_version_ids||[])ids.add(id);for(const r of stores.timer_launches||[])if(r.recipe_version_id)ids.add(r.recipe_version_id);for(const e of entrees)for(const r of lecturesCommandeCuisine(e.payload))if(r.store==='recipe_versions')ids.add(r.id);return ids;}
export function idsHistoriquesSourcesCuisine(stores={},entrees=[]){const sessions=new Set((stores.cook_sessions||[]).filter(r=>estLigneCuisine('cook_sessions',r)).map(r=>r.id)),ids=new Set((stores.cook_history||[]).filter(r=>sessions.has(r.cook_session_id)).map(r=>r.id));for(const e of entrees)for(const r of lecturesCommandeCuisine(e.payload))if(r.store==='cook_history')ids.add(r.id);return ids;}
export function preparerCommandesCuisine({puts={},commandes=[],lecture}={}){
 const fail=()=>{throw new ErreurCuisine('commande_non_couverte');};if(!Array.isArray(commandes)||commandes.length&&typeof lecture!=='function')fail();const covered=new Set(),ops=new Set(),attendues=new Map();
 for(const c of commandes){if(!validerCommandeCuisine(c).ok||ops.has(c.operation_id))fail();ops.add(c.operation_id);const key=c.store+':'+c.id,rs=(puts[c.store]||[]).filter(r=>r.id===c.id);if(rs.length!==1)fail();const r=rs[0];if(!(c.store==='timer_launches'?validerMinuteurCuisine(r):validerSessionCuisine(r)).ok||!lireRecuCuisine(r,c))fail();covered.add(key);
  const avant=attendues.has(key)?attendues.get(key):lecture(c.store,c.id)??null;
  const versionIds=new Set([...(avant?.selected_version_ids||[]),...(c.base?.versions||[]).map(v=>v.id),c.base?.version_id].filter(Boolean));
  const versions=[...versionIds].map(id=>lecture('recipe_versions',id)).filter(Boolean);
  attendues.set(key,appliquerTransitionCuisine(c,avant,{versions,attendue:avant}));
 }
 for(const [key,attendue]of attendues){const c=commandes.find(x=>x.store+':'+x.id===key),row=puts[c.store].find(r=>r.id===c.id);if(!egalesCuisine(projectionSeedCuisine(row),projectionSeedCuisine(attendue)))fail();}
 for(const store of ['timer_launches','cook_sessions'])for(const r of puts[store]||[])if(estLigneCuisine(store,r)&&!covered.has(store+':'+r.id))fail();return covered;
}
