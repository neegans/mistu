// L6 : protection du contenu publié. Aucune lecture de dépôt ni opération asynchrone dans une condition.
import {validerStructureIngredients} from './structure-ingredients.js';
import {canoniqueSources,identifiantSource,comparerUtf8} from './sources-format.js';
const own=(r,k)=>Object.hasOwn(r||{},k),clone=structuredClone;
const refus=(code='version_immuable')=>{const e=new Error(code);e.name='ErreurVersionStructuree';e.code=code;throw e;};
const egal=(a,b)=>canoniqueSources(a)===canoniqueSources(b);
export function projectionVersionStructuree(row){const data=clone(row);delete data.updated_at;delete data.created_at;delete data.status;return{projection:'published-version-v1',data};}
const parentIds=v=>[v?.parent_version_id,v?.provenance?.derived_from].filter(x=>x!==null&&x!==undefined);
const parentsMap=parents=>parents instanceof Map?parents:new Map((parents||[]).map(p=>[p.id,p]));
export function validerTransitionVersionStructuree(avant,apres,{parents=[],protegee=false}={}){
 if(!apres||typeof apres!=='object'||Array.isArray(apres))refus('version_invalide');
 const structure=own(apres,'ingredient_structure'),figee=own(avant,'ingredient_structure')||!!protegee,ps=parentsMap(parents),ids=parentIds(apres),parentStructure=ids.some(id=>own(ps.get(id),'ingredient_structure'));
 if(avant&&!own(avant,'ingredient_structure')&&structure)refus('version_immuable');
 if(structure&&!validerStructureIngredients(apres.ingredient_structure,apres.ingredients).ok)refus('structure_invalide');
 if(parentStructure&&!structure)refus('structure_requise');
 if(structure||parentStructure||!avant&&ids.length){
  if(!identifiantSource(apres.id)||!identifiantSource(apres.recipe_id)||ids.some(id=>!identifiantSource(id)||id===apres.id)||new Set(ids).size>1)refus('parent_invalide');
  const termines=new Map(),suivre=(id,chemin,profondeur)=>{if(profondeur>256||chemin.has(id))refus('parent_cycle');if(termines.has(id)){const hauteur=termines.get(id);if(profondeur+hauteur-1>256)refus('parent_cycle');return hauteur;}const p=ps.get(id);if(!p||p.recipe_id!==apres.recipe_id)refus('parent_invalide');const suite=new Set(chemin);suite.add(id);let hauteur=1;for(const parent of parentIds(p)){if(!identifiantSource(parent))refus('parent_invalide');hauteur=Math.max(hauteur,1+suivre(parent,suite,profondeur+1));}termines.set(id,hauteur);return hauteur;};for(const id of ids)suivre(id,new Set([apres.id]),1);
 }
 if(avant&&figee){
  if(!egal(projectionVersionStructuree(avant),projectionVersionStructuree(apres)))refus();
  if(apres.status!==avant.status&&apres.status!=='tested')refus('statut_invalide');
  if(avant.created_at!==undefined&&avant.created_at!==null&&apres.created_at!==avant.created_at)refus('version_immuable');
 }
 return true;
}
function lireCondition(c,row,lecture){if(!c)return null;if(c.absente){if(row)refus('version_changee');return null;}if(c.fusion)return c.fusion(row,lecture);if(!row||!c.attendus?.includes(row.status))refus('version_changee');return c.patch==null?null:{...row,...(typeof c.patch==='function'?c.patch(row):c.patch)};}
const references=(id,{traductions=[],journaux=[]}={})=>({traductions:traductions.filter(r=>r?.recipe_version_id===id&&r.alignment_format===2).map(r=>({id:r.id,recipe_version_id:r.recipe_version_id,alignment_format:2})).sort((a,b)=>comparerUtf8(a.id,b.id)),journaux:journaux.filter(r=>r?.kind==='traduction'&&r.source_version_id===id).map(r=>({id:r.id,kind:r.kind,source_version_id:r.source_version_id})).sort((a,b)=>comparerUtf8(a.id,b.id))});
const parentSignature=p=>p==null?null:own(p,'ingredient_structure')?projectionVersionStructuree(p):{id:p.id,recipe_id:p.recipe_id,structure:[false]};
export async function preparerGardesVersionsStructurees({puts={},deletes={},conditions={},lire,lireReferencesVersion=null,versionsProtegees=[]}={}){
 const finales=Object.fromEntries(Object.entries(conditions||{}).map(([s,cs])=>[s,cs.map(c=>({...c}))]));
 const retirees=new Set(deletes.recipe_versions||[]);
 const entrantes=new Map((puts.recipe_versions||[]).map(v=>[v.id,clone(v)])),touchees=new Set([...retirees,...entrantes.keys(),...(finales.recipe_versions||[]).filter(c=>c.key!=null).map(c=>c.key)]);
 if(!touchees.size)return finales;
 const rows=new Map(),parents=new Set(),refs=new Map(),protegees=new Set(versionsProtegees);
 for(const id of touchees){rows.set(id,clone(await lire('recipe_versions',id)||null));for(const p of [...parentIds(rows.get(id)),...parentIds(entrantes.get(id))])if(typeof p==='string')parents.add(p);if(lireReferencesVersion){const r=references(id,await lireReferencesVersion(id));refs.set(id,r);if(r.traductions.length||r.journaux.length)protegees.add(id);}}
 for(const id of parents){if(!rows.has(id))rows.set(id,clone(await lire('recipe_versions',id)||null));for(const p of parentIds(entrantes.get(id)||rows.get(id)))if(typeof p==='string')parents.add(p);}
 for(const id of retirees)if(own(rows.get(id),'ingredient_structure')||protegees.has(id))refus('version_immuable');
 const planParents=new Map([...rows,...entrantes]);
 for(const [id,row]of entrantes)validerTransitionVersionStructuree(rows.get(id),row,{parents:planParents,protegee:protegees.has(id)});
 const mutations=new Set();
 const anciennes=new Map((finales.recipe_versions||[]).filter(c=>c.key!=null).map(c=>[c.key,c]));
 finales.recipe_versions=(finales.recipe_versions||[]).filter(c=>c.key==null);
 for(const id of new Set([...touchees,...parents])){
  const avant=rows.get(id),entree=entrantes.get(id),ancienne=anciennes.get(id),baseParent=parentSignature(avant);
  finales.recipe_versions.push({key:id,fusion:(courant,lecture)=>{
   if(parents.has(id)&&!egal(parentSignature(courant),baseParent))refus('parent_change');
   mutations.delete(id);if(retirees.has(id)){mutations.add(id);if(own(courant,'ingredient_structure')||protegees.has(id))refus('version_immuable');}const fusion=lireCondition(ancienne,courant,lecture);if(fusion?.then)refus('condition_asynchrone');
   if(fusion&&!courant&&!entree)refus('creation_fusion_interdite');
   const final=fusion||entree;
   if(final){mutations.add(id);const ps=new Map([...rows].map(([pid,r])=>[pid,entrantes.get(pid)||lecture?.('recipe_versions',pid)||r]));for(const pid of parentIds(final))if(!rows.has(pid)&&!entrantes.has(pid))refus('parent_change');validerTransitionVersionStructuree(courant,final,{parents:ps,protegee:protegees.has(id)});}
   return fusion;
  }});
 }
 if(refs.size){
  for(const[id,r]of refs){const avant=(finales.recipe_translations||[]).find(c=>c.index==='recipe_version_id'&&c.valeur===id);finales.recipe_translations=[...(finales.recipe_translations||[]).filter(c=>c!==avant),{index:'recipe_version_id',valeur:id,verifier:rows=>{if(avant?.verifier)avant.verifier(rows);else if(avant&&(avant.absente?rows.length:rows.some(x=>avant.exclus?.includes(x.status))))refus('references_changees');if(mutations.has(id)&&!egal(references(id,{traductions:rows}).traductions,r.traductions))refus('references_changees');}}];}
  const avant=(finales.imports||[]).find(c=>c.toutes===true);finales.imports=[...(finales.imports||[]).filter(c=>c!==avant),{toutes:true,verifier:rows=>{avant?.verifier(rows);for(const[id,r]of refs)if(mutations.has(id)&&!egal(references(id,{journaux:rows}).journaux,r.journaux))refus('references_changees');}}];
 }
 // Les contrôles de références suivent les fusions de versions ; une simple lecture ne devient pas une mutation.
 const tr=finales.recipe_translations,im=finales.imports;delete finales.recipe_translations;delete finales.imports;if(tr)finales.recipe_translations=tr;if(im)finales.imports=im;
 return finales;
}
