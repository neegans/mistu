// Une capture des correspondances, puis une projection pure commune aux écrans et exports.
import {capturerSourceTraduction,lireTraductionV2,normaliserLocaleSource} from './traductions-format.js';
import {lireTraduction} from './traductions.js';
import {lireStructureIngredients} from './structure-ingredients.js';
import {scaleVersion} from './scaling.js';
import {displayQuantity} from './units.js';
import {estThermomix,gardeThermomix,formaterBlocThermomix} from './thermomix.js';
import {EN} from '../i18n/en.js';
const copie=x=>structuredClone(x);
const langue=l=>l?.split('-')[0]||null;
export const texteLecture=(fr,locale)=>langue(locale)==='en'&&Object.hasOwn(EN,fr)?EN[fr]:fr;
const cle=(kind,id,field)=>JSON.stringify([kind,id,field]);
export async function preparerLectureRecette({recipe,version,traductions=[]}={}){
 const r=copie(recipe||{}),v=copie(version||{});let source=null,raisonSource=null;
 try{source=await capturerSourceTraduction({recipe:r,version:v});}catch(e){raisonSource=e?.code||'source_invalide';}
 const candidates=traductions.filter(x=>x?.recipe_version_id===v.id).map(copie);
 const lectures=candidates.map(row=>({row,lecture:row.alignment_format===2?(source?lireTraductionV2(row,source):{etat:'invalide',raison:raisonSource,segments:[]}):lireTraduction(row,v)}));
 return{recipe:r,version:v,source,raisonSource,originalLocale:source?.source_locale??normaliserLocaleSource(r.original_language),structure:lireStructureIngredients(v),lectures};
}
// Sans capture, seuls l'original et ses groupes validés sont consultables ; aucune traduction supposée.
export function lectureOriginale({recipe={},version={}}={}){
 return{recipe,version,source:null,originalLocale:normaliserLocaleSource(recipe.original_language),structure:lireStructureIngredients(version),lectures:[]};
}
export function projeterLectureRecette(lecture,{locale='original',servings,system='original',convention_id=null,ingredientsById=new Map(),translationId=null}={}){
 const {recipe,version}=lecture,originalLocale=lecture.originalLocale,localeRendue=locale==='original'?(originalLocale||null):locale;
 const selection=locale==='original'?[]:lecture.lectures.filter(x=>x.row.locale===locale);
 const choisie=translationId?selection.find(x=>x.row.id===translationId):selection.length===1?selection[0]:null;
 const conflit=selection.length>1&&!choisie,lu=choisie?.lecture,tr=choisie?.row,legacy=tr?.alignment_format===1&&lu?.etat==='courante'?lu.contenu:null;
 const segments=new Map((lu?.segments||[]).map(s=>[cle(s.kind,s.source_id,s.field),s]));
 const veut=locale!=='original'&&langue(locale)!==langue(originalLocale);
 const projeter=(kind,id,field,text,ancien)=>{
  const s=segments.get(cle(kind,id,field));
  const traduit=s?.etat==='traduit'&&typeof s.translation_text==='string';
  const ancienTraduit=!!legacy&&typeof ancien==='string'&&ancien.length>0;
  return{texte:traduit?s.translation_text:ancienTraduit?ancien:String(text??''),original:String(text??''),originalLang:originalLocale,langReelle:traduit||ancienTraduit?locale:originalLocale,traduit:traduit||ancienTraduit,etat:traduit||ancienTraduit?'traduit':s?.etat==='perime'?'perime':veut?'manquant':'original',ref:s?.ref||null};
 };
 const cible=servings===undefined?version.servings:servings,scaled=scaleVersion(version,cible),unchanged=(scaled.factor===1||(!scaled.ok&&cible===version.servings))&&system==='original';
 const foods=scaled.ingredients.map((ri,i)=>{
  const ing=ri.ingredient_id&&ri.verification_state==='verified'?ingredientsById.get(ri.ingredient_id):null;
  const q=displayQuantity(ri.quantity,ri.unit_id,{system,locale:langue(localeRendue)||'fr',convention_id,ingredient:ing});
  const nom=projeter('ingredient',ri.id,'name',ri.name_text||'',null),preparation=projeter('ingredient',ri.id,'preparation',ri.preparation||'',null),source=projeter('ingredient',ri.id,'source',ri.source_text||'',null);
  const entierLegacy=legacy?.ingredients?.[i]||null;
  const entier=entierLegacy&&unchanged?{texte:entierLegacy,original:ri.source_text||'',originalLang:originalLocale,langReelle:locale,traduit:true,etat:'traduit'}:null;
  const sansNom=!nom.texte;
  const principal=entier||(!sansNom?nom:source);
  // Une ligne libre sans nom ni quantité structurée reste documentaire ; elle ne devient pas une quantité recalculée.
  const sansQuantiteCalculee=!!entier||sansNom;
  const quantite=sansQuantiteCalculee?'':q.text||(ri.quantity?.raw??'');
  const texte=[quantite,principal.texte,!entier&&preparation.texte?`, ${preparation.texte}`:'',ri.optional?`(${texteLecture('facultatif',localeRendue)})`:''].filter(Boolean).join(' ').replace(/ , /g,', ');
  return{kind:'ingredient',id:ri.id,ordinal:i,ingredient:ri,nom,preparation,source,principal,quantite,quantiteDetail:q,sansQuantiteCalculee,texte,
   documentaire:entierLegacy&&!unchanged?{texte:entierLegacy,langReelle:locale,original:ri.source_text||'',traduit:true}:null,
   verification_state:ri.verification_state,optional:!!ri.optional,locale:localeRendue};
 });
 const byId=new Map(foods.map(x=>[x.id,x]));
 const blocks=lecture.structure.etat==='courante'?lecture.structure.blocks.map(b=>b.kind==='heading'?{kind:'heading',id:b.id,...projeter('heading',b.id,'text',b.text,null)}:byId.get(b.ingredient_id)).filter(Boolean):foods;
 const tm=estThermomix(version)&&gardeThermomix(version,cible).ok?version.provenance?.thermomix:null;
 const steps=(version.steps||[]).map((s,i)=>{
  let segment=projeter('step',s.id,'text',s.text,legacy?.steps?.[i]);
  const originalStep=tm?.correspondance?.find(x=>x.step_id===s.id)?.source_step_id;
  const bloc=tm?.blocs?.find(x=>x.source_step_id===originalStep);
  if(bloc){const l=locale==='original'?(tm.contexte?.langue||'fr'):locale,citationSource=veut&&bloc.actions.some(a=>a.type==='preparation'&&a.ingredients?.length);segment={...segment,texte:formaterBlocThermomix(bloc,tm.contexte,{locale:l}),langReelle:citationSource&&!originalLocale?null:l,traduit:false,etat:'deterministe',operationnelle:true,citationSource};}
  return{id:s.id,position:s.position??i+1,...segment,timers:copie(s.timers||[])};
 });
 const titre=projeter('title',version.id,'text',recipe.display_title||recipe.original_title||'',legacy?.title),notes=projeter('notes',version.id,'text',typeof version.notes==='string'?version.notes:'',null),rendement=projeter('yield',version.id,'text',typeof version.yield_text==='string'?version.yield_text:'',null);
 const all=[titre,notes,rendement,...blocks.filter(x=>x.kind==='heading'),...foods.flatMap(x=>[x.principal,...(!x.sansQuantiteCalculee?[x.preparation]:[])]),...steps].filter(s=>s.original);
 return{recipe_id:recipe.id,version_id:version.id,locale:localeRendue,originalLocale,
  titre,notes,rendement,
  blocs:blocks,ingredients:foods,etapes:steps,scaled,structure:lecture.structure.etat,
  etat:conflit?'conflit':lu?.etat||'absente',traductionId:tr?.id||null,candidates:selection.map(x=>({id:x.row.id,etat:x.lecture.etat})),
  manque:veut&&all.some(s=>s.etat==='manquant'||s.etat==='perime'||s.citationSource),traductionDemandee:veut,
  contenuAncien:lu?.etat==='ancienne'||lu?.etat==='invalide'?tr?.translated_content:null};
}
