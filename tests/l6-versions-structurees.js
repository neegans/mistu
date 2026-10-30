import {preparerGardesVersionsStructurees} from '../src/domain/versions-structurees.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
const clone=structuredClone;
export async function runL6VersionsStructureesTests({eq,ok}){
 const base=()=>({...fixtureLectureL6().version,status:'proposed',created_at:'2026-10-29T12:00:00Z',updated_at:'2026-10-29T12:00:00Z'});
 const executer=async(avant,apres,{parents=[],conditions={},concurrent=null}={})=>{const rows=new Map([...(avant?[[avant.id,clone(avant)]]:[]),...parents.map(x=>[x.id,clone(x)])]),puts=apres?{recipe_versions:[apres]}:{};const finales=await preparerGardesVersionsStructurees({puts,conditions,lire:async(s,id)=>clone(rows.get(id)||null)});concurrent?.(rows);const ecrits=[];for(const c of finales.recipe_versions||[])if(c.fusion){const out=c.fusion(rows.get(c.key)||null,(s,id)=>rows.get(id)||null);if(out)ecrits.push(out);}return{ecrits,finales};};
 const refuse=async(fn,msg)=>{let e;try{await fn();}catch(x){e=x;}ok(!!e?.code,'L6 garde : '+msg);};
 let v=base();await executer(v,{...v,status:'tested',updated_at:'2026-10-30T00:00:00Z'});ok(true,'L6 garde : seul statut testé et date technique admis');
 for(const [nom,muter]of [['contenu',x=>x.ingredients[0].name_text='autre'],['structure retirée',x=>delete x.ingredient_structure],['verification',x=>x.verification_state='verified'],['provenance',x=>x.provenance={generated_by:'manual'}],['création horodatée',x=>x.created_at='2026-10-30T00:00:00Z'],['titre de groupe',x=>x.ingredient_structure.blocks[0].text='Autre']]){v=base();const next=clone(v);muter(next);await refuse(()=>executer(v,next),nom+' refusé');}
 v=base();await refuse(()=>executer({...v,status:'tested'},{...v,status:'proposed'}),'retour depuis testé refusé');
 const parent=base(),child={...clone(parent),id:'child',parent_version_id:parent.id,provenance:{derived_from:parent.id}};delete child.ingredient_structure;await refuse(()=>executer(null,child,{parents:[parent]}),'parent structuré exige structure');child.ingredient_structure={format:1,blocks:child.ingredients.map(i=>({kind:'ingredient',ingredient_id:i.id}))};await executer(null,child,{parents:[parent]});ok(true,'L6 garde : tous titres retirés explicitement conserve structure aliments seuls');
 await refuse(()=>executer(null,{...child,provenance:{derived_from:'autre-parent'}},{parents:[parent,{...parent,id:'autre-parent'}]}),'deux parents contradictoires');
 await refuse(()=>executer(null,child,{parents:[{...parent,recipe_id:'autre'}]}),'parent autre recette');
 await refuse(()=>executer(null,child,{parents:[parent],concurrent:rows=>{const p=rows.get(parent.id);p.ingredients[0].name_text='changé pendant transaction';}}),'parent source changé avant transaction');
 const invalid=clone(child);invalid.ingredient_structure.blocks.pop();await refuse(()=>executer(null,invalid,{parents:[parent]}),'structure entrante incomplète');
 const legacy={...base()};delete legacy.ingredient_structure;await executer(legacy,{...legacy,ingredients:[],extension_historique:{a:1}});ok(true,'L6 garde : legacy sans structure garde opérations historiques');
 await refuse(()=>executer(v,null,{conditions:{recipe_versions:[{key:v.id,fusion:r=>({...r,ingredients:[]})}]}}),'fusion existante ne contourne pas immutabilité');
 await refuse(()=>executer(null,null,{conditions:{recipe_versions:[{key:'fusion-child',fusion:()=>({...child,id:'fusion-child'})}]}}),'création par fusion sans put refusée');
 let calls=0;v=base();await executer(v,null,{conditions:{recipe_versions:[{key:v.id,fusion:r=>{calls++;return{...r,status:'tested'};}}]}});eq(calls,1,'L6 garde : ancienne fusion évaluée une seule fois sous transaction');
 const sansStructure=base();delete sansStructure.ingredient_structure;
 const refs={traductions:[{id:'tr2',alignment_format:2,recipe_version_id:sansStructure.id}],journaux:[]};let erreur;try{await preparerGardesVersionsStructurees({puts:{recipe_versions:[{...sansStructure,notes:'autre'}]},lire:async()=>sansStructure,lireReferencesVersion:async()=>refs});}catch(e){erreur=e;}eq(erreur?.code,'version_immuable','L6 garde : legacy cité par format2 protégé');
 const cond=await preparerGardesVersionsStructurees({puts:{recipe_versions:[{...sansStructure,notes:'legacy libre'}]},lire:async()=>sansStructure,lireReferencesVersion:async()=>({traductions:[],journaux:[]})});for(const c of cond.recipe_versions)c.fusion(sansStructure,()=>null);await refuse(()=>cond.recipe_translations.find(c=>c.index).verifier(refs.traductions),'traduction arrivée pendant préparation refuse ancien put');await refuse(()=>cond.imports.find(c=>c.toutes).verifier([{id:'journal',kind:'traduction',source_version_id:sansStructure.id}]),'journal arrivé pendant préparation refuse ancien put');
 let compte=0;const fusionnees=await preparerGardesVersionsStructurees({puts:{recipe_versions:[sansStructure]},conditions:{recipe_translations:[{index:'recipe_version_id',valeur:sansStructure.id,verifier:()=>compte++}]},lire:async()=>sansStructure,lireReferencesVersion:async()=>({traductions:[],journaux:[]})});eq(fusionnees.recipe_translations.length,1,'L6 garde : index préexistant composé sans doublon');fusionnees.recipe_translations[0].verifier([]);eq(compte,1,'L6 garde : vérification index conservée une seule fois');

 const a={...clone(child),id:'cycle-a',parent_version_id:'cycle-b',provenance:{derived_from:'cycle-b'}},b={...clone(child),id:'cycle-b',parent_version_id:'cycle-a',provenance:{derived_from:'cycle-a'}};await refuse(()=>preparerGardesVersionsStructurees({puts:{recipe_versions:[a,b]},lire:async()=>null}),'cycle entre deux nouvelles versions refusé');

 await refuse(()=>preparerGardesVersionsStructurees({deletes:{recipe_versions:[base().id]},lire:async()=>base()}),'suppression ordinaire version structurée');
 await refuse(()=>preparerGardesVersionsStructurees({deletes:{recipe_versions:[sansStructure.id]},lire:async()=>sansStructure,lireReferencesVersion:async()=>refs}),'suppression legacy citée refusée');

 await refuse(()=>executer(sansStructure,{...sansStructure,ingredient_structure:base().ingredient_structure}),'introduction structure sur ID legacy publié refusée');
 await refuse(()=>executer(null,{...sansStructure,id:'nouveau-legacy',parent_version_id:'absent'}),'nouvel enfant legacy de parent absent refusé');

}
