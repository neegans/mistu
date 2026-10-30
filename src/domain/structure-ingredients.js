// Une structure ne classe jamais les aliments : elle référence leurs identités exactes.
import { identifiantSource } from './sources-format.js';
import { porteUneAdresse } from '../core/bornes.js';

const objet=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const ferme=(x,cles)=>objet(x)&&Object.keys(x).length===cles.length&&cles.every(k=>Object.hasOwn(x,k));
const refus=raison=>({ok:false,raison});
const unicode=x=>typeof x==='string'&&!/[\u0000\ud800-\udfff]/u.test(x);
const idBloc=x=>x.kind==='heading'?x.id:x.ingredient_id;

export function validerStructureIngredients(structure,ingredients) {
  if(!ferme(structure,['format','blocks'])||structure.format!==1||!Array.isArray(structure.blocks)||!Array.isArray(ingredients))return refus('structure_invalide');
  if(structure.blocks.length>300||ingredients.length>200)return refus('bornes');
  const ids=ingredients.map(x=>x?.id);
  if(!ids.every(identifiantSource)||new Set(ids).size!==ids.length)return refus('identites_invalides');
  const titres=new Set(),aliments=[],connus=new Set(ids);
  for(const block of structure.blocks){
    if(block?.kind==='heading'){
      if(!ferme(block,['kind','id','text']))return refus('structure_invalide');
      if(!identifiantSource(block.id)||titres.has(block.id)||connus.has(block.id))return refus('identites_invalides');
      if(!unicode(block.text)||!block.text.trim())return refus('titre_invalide');
      if([...block.text].length>300)return refus('bornes');
      titres.add(block.id);
    }else if(block?.kind==='ingredient'){
      if(!ferme(block,['kind','ingredient_id']))return refus('structure_invalide');
      if(!identifiantSource(block.ingredient_id))return refus('identites_invalides');
      aliments.push(block.ingredient_id);
    }else return refus('structure_invalide');
  }
  if(titres.size>100)return refus('bornes');
  if(aliments.length!==ids.length||new Set(aliments).size!==aliments.length||aliments.some(id=>!connus.has(id)))return refus('couverture_invalide');
  if(aliments.some((id,i)=>id!==ids[i]))return refus('ordre_invalide');
  return{ok:true,structure:structuredClone(structure)};
}

export function lireStructureIngredients(version){
  if(!Object.hasOwn(version||{},'ingredient_structure'))return{etat:'legacy',blocks:null,raison:null};
  const v=validerStructureIngredients(version.ingredient_structure,version.ingredients);
  return v.ok?{etat:'courante',blocks:v.structure.blocks,raison:null}:{etat:'invalide',blocks:null,raison:v.raison};
}

export function remapperStructureIngredients(structure,ingredientsAvant,ingredientsApres,correspondances){
  const v=validerStructureIngredients(structure,ingredientsAvant);if(!v.ok)return v;
  if(!Array.isArray(correspondances)||correspondances.length!==ingredientsAvant.length||!Array.isArray(ingredientsApres))return refus('couverture_invalide');
  const map=new Map(),dest=new Set(),anciens=new Set(ingredientsAvant.map(x=>x.id));
  for(const c of correspondances){
    if(!ferme(c,['avant','apres'])||!identifiantSource(c.avant)||!identifiantSource(c.apres)||!anciens.has(c.avant)||map.has(c.avant)||dest.has(c.apres))return refus('identites_invalides');
    map.set(c.avant,c.apres);dest.add(c.apres);
  }
  return validerStructureIngredients({format:1,blocks:v.structure.blocks.map(b=>b.kind==='heading'?b:{kind:'ingredient',ingredient_id:map.get(b.ingredient_id)})},ingredientsApres);
}

function preparer(modele){
  if(!objet(modele?.contenu)||!Array.isArray(modele.contenu.ingredients))return refus('structure_invalide');
  const p=structuredClone(modele),c=p.contenu;
  // La création d’une structure est un geste explicite ; aucune ID manquante n’est inventée.
  if(!Object.hasOwn(c,'ingredient_structure'))c.ingredient_structure={format:1,blocks:c.ingredients.map(x=>({kind:'ingredient',ingredient_id:x.id}))};
  const v=validerStructureIngredients(c.ingredient_structure,c.ingredients);return v.ok?{ok:true,modele:p}:v;
}
function terminer(p){
  const c=p.contenu,parId=new Map(c.ingredients.map(x=>[x.id,x]));
  c.ingredients=c.ingredient_structure.blocks.filter(b=>b.kind==='ingredient').map(b=>parId.get(b.ingredient_id));
  const v=validerStructureIngredients(c.ingredient_structure,c.ingredients);return v.ok?{ok:true,modele:p}:v;
}
export function deplacerBlocIngredients(modele,id,sens,{groupe=false}={}){
  const r=preparer(modele);if(!r.ok)return r;if(![-1,1].includes(sens))return refus('ordre_invalide');
  const p=r.modele,blocks=p.contenu.ingredient_structure.blocks,i=blocks.findIndex(b=>idBloc(b)===id);if(i<0)return refus('identites_invalides');
  if(!groupe){const j=i+sens;if(j>=0&&j<blocks.length)[blocks[i],blocks[j]]=[blocks[j],blocks[i]];return terminer(p);}
  if(blocks[i].kind!=='heading')return refus('structure_invalide');
  const suivant=blocks.findIndex((b,k)=>k>i&&b.kind==='heading'),fin=suivant<0?blocks.length:suivant;
  if(sens<0){let avant=-1;for(let k=0;k<i;k++)if(blocks[k].kind==='heading')avant=k;if(avant>=0){const groupe=blocks.splice(i,fin-i);blocks.splice(avant,0,...groupe);}}
  else if(suivant>=0){const prochain=blocks.findIndex((b,k)=>k>suivant&&b.kind==='heading'),finSuivant=prochain<0?blocks.length:prochain;const groupe=blocks.splice(i,fin-i);blocks.splice(finSuivant-groupe.length,0,...groupe);}
  return terminer(p);
}
export function transformerIngredientEnTitre(modele,ingredientId,{headingId,texte}={}){
  const r=preparer(modele);if(!r.ok)return r;const p=r.modele,c=p.contenu,i=c.ingredient_structure.blocks.findIndex(b=>b.kind==='ingredient'&&b.ingredient_id===ingredientId);
  if(i<0||!identifiantSource(headingId)||c.ingredient_structure.blocks.some(b=>idBloc(b)===headingId))return refus('identites_invalides');
  c.ingredient_structure.blocks[i]={kind:'heading',id:headingId,text:texte};c.ingredients=c.ingredients.filter(x=>x.id!==ingredientId);return terminer(p);
}
export function transformerTitreEnIngredient(modele,headingId,{ingredientId}={}){
  const r=preparer(modele);if(!r.ok)return r;const p=r.modele,c=p.contenu,i=c.ingredient_structure.blocks.findIndex(b=>b.kind==='heading'&&b.id===headingId);
  if(i<0||!identifiantSource(ingredientId)||c.ingredient_structure.blocks.some(b=>idBloc(b)===ingredientId))return refus('identites_invalides');
  const text=c.ingredient_structure.blocks[i].text;c.ingredient_structure.blocks[i]={kind:'ingredient',ingredient_id:ingredientId};c.ingredients.push({id:ingredientId,source_text:text,name_text:text,quantity:null,unit_id:null,ingredient_id:null,verification_state:'to_verify',evidence:'manual'});return terminer(p);
}

// Les index portent sur le tableau reçu, avant tout filtrage des lignes culinaires.
export function lireBlocsIngredientsExtraits(data,indicesGardes){
  if(data?.ingredient_blocks===undefined){
    const issue=data?.ingredient_blocks_issue;if(issue===undefined)return{};
    if(ferme(issue,['raison','candidates'])&&['structure_invalide','titre_invalide','couverture_invalide','bornes'].includes(issue.raison)&&Array.isArray(issue.candidates)&&issue.candidates.length<=100&&issue.candidates.every(t=>unicode(t)&&[...t].length<=300&&!porteUneAdresse(t)))return{ingredient_blocks_issue:structuredClone(issue)};
    return{ingredient_blocks_issue:{raison:'structure_invalide',candidates:[]}};
  }
  const blocks=data.ingredient_blocks,candidates=Array.isArray(blocks)?blocks.filter(b=>b?.kind==='heading'&&unicode(b.text)&&[...b.text].length<=300&&!porteUneAdresse(b.text)).slice(0,100).map(b=>b.text):[];
  const echec=raison=>({ingredient_blocks_issue:{raison,candidates}});
  if(!Array.isArray(blocks)||blocks.length>300)return echec('structure_invalide');
  const indices=[],titres=[];
  for(const b of blocks){
    if(b?.kind==='heading'){
      if(!ferme(b,['kind','text'])||!unicode(b.text)||!b.text.trim()||[...b.text].length>300||porteUneAdresse(b.text))return echec('titre_invalide');
      titres.push(b);
    }else if(b?.kind==='ingredient'){
      if(!ferme(b,['kind','index'])||!Number.isInteger(b.index)||b.index<0)return echec('structure_invalide');
      indices.push(b.index);
    }else return echec('structure_invalide');
  }
  if(titres.length>100||indicesGardes.length>200)return echec('bornes');
  if(indices.length!==indicesGardes.length||indices.some((n,i)=>n!==indicesGardes[i]))return echec('couverture_invalide');
  const conversion=new Map(indicesGardes.map((n,i)=>[n,i]));
  return{ingredient_blocks:blocks.map(b=>b.kind==='heading'?structuredClone(b):{kind:'ingredient',index:conversion.get(b.index)})};
}

export function fabriquerStructureIngredients(resultat,ingredients,{newId}={}){
  if(!Object.hasOwn(resultat||{},'ingredient_blocks'))return null;
  const v=lireBlocsIngredientsExtraits(resultat,ingredients.map((_,i)=>i));if(!v.ingredient_blocks||typeof newId!=='function')return null;
  const structure={format:1,blocks:v.ingredient_blocks.map(b=>b.kind==='heading'?{kind:'heading',id:newId('gh'),text:b.text}:{kind:'ingredient',ingredient_id:ingredients[b.index]?.id})};
  const r=validerStructureIngredients(structure,ingredients);return r.ok?r.structure:null;
}

export function fabriquerStructureLecture(resultat,ingredients,{newId,versionSource=null,sansTitresConfirme=false}={}){
  const structure=fabriquerStructureIngredients(resultat,ingredients,{newId});
  if(structure)return structure;
  if(!Object.hasOwn(versionSource||{},'ingredient_structure'))return null;
  if(!sansTitresConfirme)throw Object.assign(new Error('groupes_a_revoir'),{code:'groupes_a_revoir'});
  const r=validerStructureIngredients({format:1,blocks:ingredients.map(i=>({kind:'ingredient',ingredient_id:i.id}))},ingredients);
  if(!r.ok)throw Object.assign(new Error(r.raison),{code:r.raison});return r.structure;
}
