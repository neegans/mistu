import {validateParsedRecipe} from '../src/domain/llm.js';
import {creerModeleRecette,poserLectureRecette,validerModeleRecette,decrireChangementsRecette,construireContenuRecette,retirerElement,deplacerElement} from '../src/domain/editeur-recette.js';
import {fabriquerExtraction} from '../src/domain/import-cible.js';
import {fabriquerLectureWeb} from '../src/domain/lecture-web.js';
import {validerRecetteIA,fabriquerRecetteIA} from '../src/domain/creation-ia.js';
export async function runL6ExtractionGroupesTests({eq,ok}){
  const raw={title:'Pain',ingredients:[{source_text:'50 g de levain'},{source_text:'200 g de farine'}],steps:[{text:'Mélanger.\nLaisser reposer.'}],ingredient_blocks:[{kind:'heading',text:'La pâte'},{kind:'ingredient',index:0},{kind:'ingredient',index:1}]};
  const r=validateParsedRecipe(raw);eq(r.ingredient_blocks,raw.ingredient_blocks,'L6 extraction : groupes admis sans IDs assistant');
  const legacy=validateParsedRecipe({...raw,ingredient_blocks:undefined});ok(!Object.hasOwn(legacy,'ingredient_blocks'),'L6 extraction : absence reste legacy');
  const mauvais=validateParsedRecipe({...raw,ingredient_blocks:[{kind:'heading',text:'La pâte'},{kind:'ingredient',index:99}]});eq(mauvais.ingredients.length,2,'L6 extraction : structure refusée conserve aliments');eq(mauvais.ingredient_blocks_issue?.candidates,['La pâte'],'L6 extraction : titres rejetés récupérables séparément');ok(!Object.hasOwn(mauvais,'ingredient_blocks'),'L6 extraction : structure invalide non publiée');
  eq(validateParsedRecipe(mauvais).ingredient_blocks_issue,mauvais.ingredient_blocks_issue,'L6 extraction : relecture du journal garde l’anomalie et les titres récupérables');
  const filtre=validateParsedRecipe({...raw,ingredients:[{source_text:''},...raw.ingredients]});ok(!!filtre.ingredient_blocks_issue,'L6 extraction : indices bruts ne glissent pas après filtrage');
  const base={id:'v',recipe_id:'r',ingredients:[{id:'i1',source_text:'50 g de levain',name_text:'levain'}],steps:[{id:'s',text:'Cuire.\nPuis servir.'}],ingredient_structure:{format:1,blocks:[{kind:'heading',id:'h',text:'Pâte'},{kind:'ingredient',ingredient_id:'i1'}]}};
  const m=creerModeleRecette({recipe:{id:'r',original_title:'Pain'},version:base});eq(m.contenu.ingredient_structure,base.ingredient_structure,'L6 modèle : structure source conservée');
  ok(validerModeleRecette(m,{publication:true}).ok,'L6 modèle : contenu structuré publiable');
  const mod=structuredClone(m);mod.contenu.ingredient_structure={format:1,blocks:[{kind:'ingredient',ingredient_id:'i1'}]};
  eq(decrireChangementsRecette(mod,m).contenu,['ingredient_structure'],'L6 modèle : retrait titres est contenu, pas metadata');
  eq(construireContenuRecette(mod,{base})?.ingredient_structure,mod.contenu.ingredient_structure,'L6 modèle : tous titres retirés garde structure alimentaire');
  const baseDerivee={...base,provenance:{derived_from:'grand-parent'}};eq(construireContenuRecette(m,{base:baseDerivee})?.provenance.derived_from,base.id,'L6 modèle : nouvelle provenance cite parent immédiat, jamais son grand-parent');
  const transitoire=structuredClone(m);transitoire.contenu.ingredient_structure={format:1,blocks:[{kind:'heading',id:'h',text:''},{kind:'ingredient',ingredient_id:'i1'}]};
  ok(validerModeleRecette(transitoire).ok,'L6 modèle : brouillon conserve titre en cours vide');ok(!validerModeleRecette(transitoire,{publication:true}).ok,'L6 modèle : titre vide non publiable');
  eq(retirerElement(m,'ingredients','i1').contenu.ingredient_structure.blocks,[{kind:'heading',id:'h',text:'Pâte'}],'L6 modèle : retrait aliment retire seulement référence');
  let n=0;const id=p=>p+'-'+(++n);const lecture=poserLectureRecette(creerModeleRecette(),r,{newId:id});ok(validerModeleRecette(lecture).ok,'L6 modèle : réponse groupée ouvre brouillon');eq(lecture.contenu.ingredient_structure?.blocks[0].text,'La pâte','L6 modèle : titres réponse attribués par app');eq(lecture.contenu.steps[0].text,raw.steps[0].text,'L6 modèle : paragraphe exact');
  const fabrication=fabriquerExtraction(r,{reference:{id:'rc',original_title:'Pain',edition_id:null,source_page_ids:[]},importId:'imp'});eq(fabrication.version.ingredient_structure?.blocks[0].text,'La pâte','L6 photo : fabricant conserve groupes');
  const web=fabriquerLectureWeb(r,{signet:{id:'rw',original_title:'Pain',edition_id:null,source_page_ids:[],web:{url:'https://example.org/r'}}});eq(web.version.ingredient_structure?.blocks[0].text,'La pâte','L6 web : fabricant conserve groupes');
  const reference={id:'r',original_title:'Pain',edition_id:null,source_page_ids:[],current_version_id:base.id,availability:'partial'};
  for(const[canal,fab]of[['photo',opt=>fabriquerExtraction(legacy,{reference,versions:[base],...opt})],['web',opt=>fabriquerLectureWeb(legacy,{signet:reference,versions:[base],...opt})]]){
    let bloque=false;try{fab({});}catch(e){bloque=e.code==='groupes_a_revoir';}ok(bloque,'L6 '+canal+' : complément structuré sans groupes exige geste explicite');
    const garde=fab({sansTitresConfirme:true});eq(garde.version.ingredient_structure?.blocks,garde.version.ingredients.map(i=>({kind:'ingredient',ingredient_id:i.id})),'L6 '+canal+' : retrait titres confirmé garde structure valide');
    eq(base.ingredient_structure.blocks[0].text,'Pâte','L6 '+canal+' : titres du parent restent consultables intacts');
  }
  const iaRaw={title:'Pain',description:'Pain de table.',servings:4,estimated_minutes:30,ingredients:[{name:'farine',quantity:200,unit:'g'}],steps:['Mélanger la pâte.','Cuire la pâte.'],tips:[],restrictions_notes:[],ingredient_blocks:[{kind:'heading',text:'Pâte'},{kind:'ingredient',index:0}]};
  const ia=validerRecetteIA(iaRaw);eq(ia.recette?.ingredient_blocks,iaRaw.ingredient_blocks,'L6 création : extension admise');
  if(ia.ok){const f=fabriquerRecetteIA({recette:ia.recette,demande:'Pain',newId:id,maintenant:'2026-10-29T00:00:00Z'});eq(f.version.ingredient_structure?.blocks[0].text,'Pâte','L6 création : fabrication groupée');}
  const iaBad=validerRecetteIA({...iaRaw,ingredient_blocks:[{kind:'ingredient',index:5}]});ok(iaBad.ok&&!!iaBad.recette.ingredient_blocks_issue,'L6 création : mauvais groupes ne jettent pas appel');
  let refuse=false;try{fabriquerRecetteIA({recette:{...ia.recette,ingredient_blocks:undefined},parente:base,newId:id});}catch(e){refuse=e.code==='groupes_a_revoir';}ok(refuse,'L6 création : dérivation structurée ne perd pas titres silencieusement');
  const sansTitres=fabriquerRecetteIA({recette:{...ia.recette,ingredient_blocks:undefined},parente:base,newId:id,sansTitresConfirme:true});eq(sansTitres.version.ingredient_structure?.blocks,sansTitres.version.ingredients.map(i=>({kind:'ingredient',ingredient_id:i.id})),'L6 création : retrait explicitement confirmé reste structuré');
}
