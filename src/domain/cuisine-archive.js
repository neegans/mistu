// Restaurer les preuves de cuisine garde les heures, mais crée une nouvelle incarnation.
import {newId as idDefaut} from '../core/ids.js';
import {empreinteSources,comparerUtf8} from './sources-format.js';
import {estLigneCuisine,validerMinuteurCuisine,validerSessionCuisine,projectionSeedCuisine,egalesCuisine,signerCommandeCuisine,ErreurCuisine} from './cuisine-format.js';
import {appliquerTransitionCuisine} from './cuisine-mutations.js';
const fail=c=>{throw new ErreurCuisine(c);},map=xs=>new Map((xs||[]).map(r=>[r.id,r])),clone=structuredClone;
export const contientCuisineExacte=stores=>['cook_sessions','timer_launches'].some(s=>(stores[s]||[]).some(r=>estLigneCuisine(s,r)));
export const estLigneCuisineReservee=estLigneCuisine;
export function validerFormesCuisineArchive(stores){for(const store of ['cook_sessions','timer_launches'])for(const r of stores[store]||[])if(estLigneCuisine(store,r)){const v=store==='cook_sessions'?validerSessionCuisine(r):validerMinuteurCuisine(r);if(!v.ok)fail(v.raison);}}
export function verifierIdentitesCuisineArchive(batch,snapshot={}){validerFormesCuisineArchive(batch);for(const store of ['cook_sessions','timer_launches']){const before=map(snapshot[store]);for(const r of batch[store]||[]){const old=before.get(r.id);if(old&&(estLigneCuisine(store,r)||estLigneCuisine(store,old))&&!egalesCuisine(projectionSeedCuisine(old),projectionSeedCuisine(r)))fail('restauration_changee');}}}
export async function preparerCuisineArchive({batch,snapshot={},owner_id,purpose='archive',newId=idDefaut}={}){
 if(!['archive','bootstrap'].includes(purpose))fail('forme_invalide');const normalise=clone(batch),avant=clone(snapshot);verifierIdentitesCuisineArchive(normalise,avant);
 const versions=map([...(avant.recipe_versions||[]),...(normalise.recipe_versions||[])]),recipes=map([...(avant.recipes||[]),...(normalise.recipes||[])]),editions=map([...(avant.book_editions||[]),...(normalise.book_editions||[])]),cooking_commands=[],couvertes=new Set();
 for(const store of ['cook_sessions','timer_launches']){const previous=map(avant[store]);for(const [i,row]of (normalise[store]||[]).entries())if(estLigneCuisine(store,row)){
  const ids=new Set([row.recipe_id,...[row.recipe_version_id,...(row.selected_version_ids||[])].filter(Boolean).map(id=>versions.get(id)?.recipe_id)].filter(Boolean)),rs=[],es=new Map();
  for(const id of ids){const recipe=recipes.get(id);if(!recipe)continue;const edition=editions.get(recipe.edition_id);rs.push({recipe_id:id,expected_cycle_id:recipe.lifecycle_id??null,expected_edition_id:recipe.edition_id??null,expected_edition_cycle_id:edition?.lifecycle_id??null,historique:true});if(edition)es.set(edition.id,{edition_id:edition.id,expected_cycle_id:edition.lifecycle_id??null,historique:true});}
  const old=previous.get(row.id)||null,c=await signerCommandeCuisine({protocol:1,op:'cooking_apply',store,id:row.id,action:'restore',nonce:newId('cuisine-restore'),base:{expected_target_sha256:old?await empreinteSources(projectionSeedCuisine(old)):null},change:{purpose,target:clone(row)},contexts:{recipes:rs.sort((a,b)=>comparerUtf8(a.recipe_id,b.recipe_id)),editions:[...es.values()].sort((a,b)=>comparerUtf8(a.edition_id,b.edition_id))}});
  normalise[store][i]=appliquerTransitionCuisine(c,old,{attendue:old});cooking_commands.push(c);couvertes.add(store+':'+row.id);
 }}return{batch:normalise,cooking_commands,couvertes};
}
