import {withRepo} from './sync-fixture.js';
import {getData} from '../src/ui/state.js';
import {enregistrerLecture} from '../src/ui/import-web.js';
import {renderImportCible} from '../src/ui/import-cible.js';
import {memoireCycleImport} from '../src/domain/contexte-import.js';
import {capturerRecette} from '../src/ui/recette-garde.js';
import {validateParsedRecipe} from '../src/domain/llm.js';
const attendre=async fn=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Attente complément dépassée');};
export async function runL6ComplementsGroupesTests({eq,ok}){
 for(const canal of ['web','photo'])for(const course of [false,true])await withRepo(async(repo,db)=>{
  const recipe={id:'l6-complement-r',original_title:'Pain',original_language:'fr',availability:'partial',current_version_id:'l6-complement-v',edition_id:null,source_page_ids:[],...(canal==='web'?{source_url:'https://example.org/pain'}:{})};
  const version={id:recipe.current_version_id,recipe_id:recipe.id,kind:'extraction',ingredients:[{id:'l6-c-i',source_text:'Farine'}],steps:[],ingredient_structure:{format:1,blocks:[{kind:'heading',id:'l6-c-h',text:'Pâte'},{kind:'ingredient',ingredient_id:'l6-c-i'}]},provenance:{generated_by:'ai',source_page_ids:[]}};
  await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});const ctx={...await getData(true),sync:{}},capture=await capturerRecette(repo,recipe,{ctx});
  const resultat=validateParsedRecipe({title:'Pain',ingredients:[{source_text:'200 g de farine'}],steps:[{text:'Cuire.'}]});
  const journal={id:'l6-c-j',kind:canal==='web'?'web':'recette',recipe_id:recipe.id,status:'a_verifier',edition_id:null,page_ids:[],scan_session_id:null,resultat:canal==='web'?{source_kind:'jsonld',page:{url_finale:recipe.source_url},recette:resultat}:resultat,reponse_brute:'copie payée exacte',appels:1,...memoireCycleImport(capture)};
  await db.mutate({origin:'remote',puts:{imports:[journal]}});let confirmations=0,posts=0,node=null;
  const confirmer=async()=>{confirmations++;if(course)await db.mutate({origin:'remote',puts:{recipe_versions:[{...version,notes:'Autre source arrivée'}]}});return true;};
  try{
   if(canal==='web')await enregistrerLecture(journal.id,{repo,ctx,remplacer:true,confirmer,fetch:async()=>{posts++;throw Error('Pas de POST attendu');}});
   else{node=await renderImportCible({id:recipe.id},{import:journal.id},ctx,{repo,confirmer,navigate:()=>{},toast:()=>{},fetch:async()=>{posts++;throw Error('Pas de POST attendu');}});document.body.append(node);node.querySelector('[data-role=enregistrer]').click();await attendre(()=>confirmations>0);await attendre(async()=>course?node.querySelector('[data-role=enregistrer]')&&!node.querySelector('[data-role=enregistrer]').disabled:(await repo.get('imports',journal.id)).status==='enregistre');}
  }catch(e){ok(false,'L6 complément '+canal+' : geste aboutit sans exception — '+e.message);}finally{node?.dispose?.();node?.remove();}
  eq(confirmations,1,'L6 complément '+canal+' : retrait des titres confirmé explicitement');eq(posts,0,'L6 complément '+canal+' : réponse payée réutilisée sans nouvel appel');
  const versions=await repo.byIndex('recipe_versions','recipe_id',recipe.id),lu=await repo.get('imports',journal.id);
  if(course){eq(versions.length,1,'L6 complément '+canal+' : source changée refuse publication');eq([lu.status,lu.resultat,lu.reponse_brute],['a_verifier',journal.resultat,journal.reponse_brute],'L6 complément '+canal+' : conflit conserve lecture et brut payés');}
  else{const enfant=versions.find(v=>v.id!==version.id);eq([versions.length,lu.status],[2,'enregistre'],'L6 complément '+canal+' : nouvelle version et clôture payée atomiques');ok(!!enfant?.ingredient_structure,'L6 complément '+canal+' : structure jamais absente après confirmation');eq(enfant?.ingredient_structure?.blocks,enfant?.ingredients.map(i=>({kind:'ingredient',ingredient_id:i.id})),'L6 complément '+canal+' : enfant demeure structuré');eq((await repo.get('recipe_versions',version.id)).ingredient_structure,version.ingredient_structure,'L6 complément '+canal+' : parent original conserve ses titres');}
 });
 await withRepo(async(repo,db)=>{
  const recipe={id:'l6-c-rendu',original_title:'Pain',original_language:'fr',availability:'reference_only',current_version_id:null,edition_id:null,source_page_ids:[]};await db.mutate({origin:'remote',puts:{recipes:[recipe]}});
  const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;const blob=await new Promise(r=>canvas.toBlob(r,'image/png')),file=new File([blob],'photo.png',{type:'image/png'});let bloque=false,entre,liberer;const entree=new Promise(r=>entre=r),porte=new Promise(r=>liberer=r);
  const facade={...repo,ajouterPages:async(...args)=>{const r=await repo.ajouterPages(...args);bloque=true;return r;},byIndex:async(...args)=>{if(bloque&&args[0]==='imports'){entre();await porte;}return repo.byIndex(...args);}};
  const node=await renderImportCible({id:recipe.id},{},{...await getData(true),sync:{}},{repo:facade,pickFiles:async()=>[file],navigate:()=>{},toast:()=>{}});document.body.append(node);
  try{[...node.querySelectorAll('button')].find(b=>b.textContent==='Photographier').click();await entree;eq(node.etatRoute().pageIds,[],'L6 complément : état exposé reste celui du rendu pendant relecture asynchrone');liberer();await attendre(()=>node.textContent.includes('1 photo ajoutée'));eq(node.etatRoute().pageIds.length,1,'L6 complément : pages exposées et bouton correspondent au rendu terminé');}finally{liberer();node.dispose?.();node.remove();}
 });
}
