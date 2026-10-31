import {withRepo} from './sync-fixture.js';
import {fixtureThermomixHistorique} from './fixtures/thermomix-0.23.1.js';
import {fixtureSoeursThermomixHistorique} from './fixtures/thermomix-0.23.1-soeurs.js';
import {lireThermomix,construireContexteThermomix,fabriquerVersionThermomix} from '../src/domain/thermomix.js';
import {panneauGardeThermomix,BLOCAGE_THERMOMIX} from '../src/ui/thermomix-garde.js';
import {renderRecipe} from '../src/ui/recipe.js';
import {renderMeal} from '../src/ui/meals.js';
import {renderShoppingList} from '../src/ui/grocery.js';
import {getData} from '../src/ui/state.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

const copie=structuredClone;
const bouton=(vue,texte)=>[...vue.querySelectorAll('button')].find(b=>b.textContent===texte);
async function attendre(fn){const fin=performance.now()+15000;while(performance.now()<fin){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Résultat du geste Thermomix absent');}

async function semer(db,{double=false,portions=6,secondesPortions=portions,liste=false,autonome=false,muter=null}={}){
 const f=double?fixtureSoeursThermomixHistorique():fixtureThermomixHistorique();f.autre=f.soeur;
 f.meal={id:'repas-reprise',title:'Souper',servings:4,serve_at:null,planned_on:null,items:[{id:'plat',recipe_id:f.recipe.id,recipe_version_id:f.version.id,servings:portions,servings_custom:true,role:'plat_principal'},...(double?[{id:'autre',recipe_id:f.recipe.id,recipe_version_id:f.autre.id,servings:secondesPortions,servings_custom:true,role:'accompagnement'}]:[])]};
 f.list={id:'courses-reprise',title:'Courses',meal_id:autonome?null:f.meal.id,items:f.meal.items.map(it=>({recipe_id:it.recipe_id,recipe_version_id:it.recipe_version_id,servings:it.servings,title:f.recipe.original_title,convention_snapshot:{id:'metric_ca',revision:1,values:{cup:250,tbsp:15,tsp:5,fl_oz:30}}})),checked:{'manual:papier':true},manual_lines:[{id:'papier',label:'Papier',quantity_text:'1',aisle:'Maison'}],row_overrides:{'manual:papier':{aisle:'Maison'}}};
 muter?.(f);
 await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[...(f.original?[f.original]:[]),f.version,...(double?[f.autre]:[])],meals:[f.meal],...(liste?{shopping_lists:[f.list]}:{})}});
 return f;
}
async function ouvrir(type,repo,f,extra={}){
 const nav=[],messages=[],deps={repo,navigate:p=>nav.push(p),toast:m=>messages.push(m),refresh:()=>{},...extra},ctx=await getData(true);
 const vue=type==='recette'?await renderRecipe({id:f.recipe.id},{v:f.version.id,servings:String(f.meal.items[0].servings??'')},ctx,deps):type==='repas'?await renderMeal({id:f.meal.id},{},ctx,deps):await renderShoppingList({id:f.list.id},{},ctx,deps);
 document.body.append(vue);for(const panel of vue.querySelectorAll('[data-role=copie-cookidoo]'))await panel.attendreLecture?.();return{vue,nav,messages,fermer(){vue.dispose?.();vue.remove();}};
}
async function agir(e,texte){const b=bouton(e.vue,texte);if(!b)throw Error('Bouton absent : '+texte);b.click();await attendre(()=>e.nav.length||e.messages.length);}
async function comparer(e){const b=bouton(e.vue,'Revoir les courses');if(!b)return null;b.click();await attendre(()=>e.vue.querySelector('[data-role=conserver-courses]')||e.vue.textContent.includes('Ta saisie est conservée.'));return e.vue.querySelector('[data-role=conserver-courses]');}
async function conserver(e,b){b.click();await attendre(()=>!e.vue.querySelector('[data-role=conserver-courses]')||e.vue.textContent.includes('Ta saisie est conservée.'));}

export async function runAuditThermomixUsagesTests({eq,ok}){
 const langue=getUiLocale();setUiLocale('fr');
 const cas=async(nom,fn)=>{try{await withRepo((repo,db)=>fn(repo,db));}catch(e){ok(false,'10.1 usages '+nom+' : '+(e.stack||e));}};
 try{
  await cas('message ancien plan et portions',async()=>{
   const f=fixtureThermomixHistorique(),texte='Ces anciens réglages Thermomix doivent être revus. Ouvre la fiche pour les corriger ou utilise la recette d’origine.';
   const ancien=panneauGardeThermomix([{recipe:f.recipe,version:f.version,servings:4}]);
   ok(ancien.textContent.includes(texte),'10.1 avis cuisine : ancien plan propose correction ou original');
   ok(!ancien.textContent.includes('Reviens aux quantités adaptées'),'10.1 avis cuisine : ancien plan sans conseil de portions inefficace');
   eq(ancien.querySelector('a').getAttribute('href'),'#/recipes/'+f.recipe.id+'?v='+f.version.id,'10.1 avis cuisine : retour à l’adaptation historique exacte');
   const contexte=construireContexteThermomix({version:f.original,selection:['s1'],precisions:{eau_vapeur_g:500}});
   const actuelle=fabriquerVersionThermomix({source:f.original,contexte,resultat:f.version.provenance.thermomix.resultat,id:'avis-tm7-actuelle',newId:()=>crypto.randomUUID(),maintenant:'2026-10-30T12:00:00Z'});
   eq(lireThermomix(actuelle).ok,true,'10.1 avis cuisine : témoin de portions sur plan actuel valide');
   const portions=panneauGardeThermomix([{recipe:f.recipe,version:actuelle,servings:8}]);
   ok(portions.textContent.includes(BLOCAGE_THERMOMIX),'10.1 avis cuisine : différence de portions garde son conseil actuel');
   ok(!portions.textContent.includes(texte),'10.1 avis cuisine : différence de portions ne devient pas ancien plan');
   eq(panneauGardeThermomix([{recipe:f.recipe,version:f.original,servings:8}]),null,'10.1 avis cuisine : version ordinaire sans blocage TM7');
  });
  for(const type of ['recette','repas'])for(const action of ['cuisson','courses'])await cas(type+' '+action,async(repo,db)=>{
   const f=await semer(db),avant=await db.getSnapshot(['recipes','recipe_versions','meals']),e=await ouvrir(type,repo,f);
   try{
    ok(!!e.vue.querySelector('[data-role=thermomix-reprise]'),'10.1 '+type+' : annonce le recours à la recette d’origine');
    const lien=[...e.vue.querySelectorAll('a')].find(a=>a.textContent==='Revoir les réglages Thermomix');
    ok(!!lien&&lien.getAttribute('href').includes('v='+f.version.id)&&lien.getAttribute('href').includes('servings=6'),'10.1 '+type+' : réparation vise enfant exact et portions du geste');
    await agir(e,type==='recette'?(action==='cuisson'?'Commencer à cuisiner':'Liste d’épicerie'):(action==='cuisson'?'Cuisiner ensemble':'Voir mes courses'));
    const rows=await repo.all(action==='cuisson'?'cook_sessions':'shopping_lists'),row=rows[0];
    eq(rows.length,1,'10.1 '+type+' '+action+' : geste crée réellement un nouvel usage');
    eq(action==='cuisson'?row?.selected_version_ids:row?.items.map(it=>it.recipe_version_id),[f.original.id],'10.1 '+type+' '+action+' : seul le vrai parent est utilisé');
    eq(action==='cuisson'?(type==='recette'?row?.servings:row?.servings_by_version?.[f.original.id]):row?.items[0].servings,6,'10.1 '+type+' '+action+' : portions demandées conservées');
    if(action==='cuisson')eq([row?.progress.total_steps,row?.progress.done_step_ids],[3,[]],'10.1 '+type+' : départ original sans progrès hérité');
    eq(await db.getSnapshot(['recipes','recipe_versions','meals']),avant,'10.1 '+type+' '+action+' : aucune réécriture du repas, enfant ou parent');
    ok(e.nav[0]?.startsWith(action==='cuisson'?'/cook/':'/lists/'),'10.1 '+type+' '+action+' : navigation seulement après écriture');
   }finally{e.fermer();}
  });
  for(const differentes of [false,true])await cas('parent commun '+differentes,async(repo,db)=>{
   const f=await semer(db,{double:true,secondesPortions:differentes?8:6}),avant=await repo.get('meals',f.meal.id),e=await ouvrir('repas',repo,f);
   eq([lireThermomix(f.version)?.etat,lireThermomix(f.autre)?.etat],['a_revoir','a_revoir'],'10.1 parent commun : deux vraies sœurs historiques intactes atteignent le repli');
   try{
    await agir(e,'Cuisiner ensemble');const sessions=await repo.all('cook_sessions');
    eq(sessions.length,differentes?0:1,'10.1 parent commun : portions différentes refusées, mêmes portions admises');
    if(differentes)ok(e.messages.some(m=>m.includes('portions différentes')&&m.includes('séparément')),'10.1 parent commun : refus expliqué sans écraser une quantité');
    else eq([sessions[0]?.selected_version_ids,sessions[0]?.servings_by_version,sessions[0]?.progress.total_steps],[[f.original.id],{[f.original.id]:6},3],'10.1 parent commun : mêmes portions dédupliquées sans doubler les étapes');
    e.messages.length=0;e.nav.length=0;await agir(e,'Voir mes courses');const liste=(await repo.all('shopping_lists'))[0];
    eq(liste?.items.map(it=>[it.recipe_version_id,it.servings]),[[f.original.id,6],[f.original.id,differentes?8:6]],'10.1 parent commun : courses gardent les deux entrées et leurs portions');
    eq(await repo.get('meals',f.meal.id),avant,'10.1 parent commun : repas intact après les deux gestes');
   }finally{e.fermer();}
  });
  for(const autonome of [false,true])await cas('liste existante '+autonome,async(repo,db)=>{
   const f=await semer(db,{liste:true,autonome}),avant=await db.getSnapshot(['shopping_lists','recipes','recipe_versions','meals']),e=await ouvrir('courses',repo,f);
   try{
    eq(await db.getSnapshot(['shopping_lists','recipes','recipe_versions','meals']),avant,'10.1 courses : ouvrir une liste ne la réécrit pas');
    ok(!!e.vue.querySelector('[data-role=thermomix-reprise]'),'10.1 courses : ancienne adaptation annoncée sans remplacer les lignes');
    const b=await comparer(e);ok(!!b,'10.1 courses : comparaison explicite disponible même pour liste autonome');
    eq(await repo.get('shopping_lists',f.list.id),f.list,'10.1 courses : voir la comparaison ne conserve rien');
    if(b)await conserver(e,b);const row=await repo.get('shopping_lists',f.list.id);
    eq(row.items.map(it=>[it.recipe_version_id,it.servings]),[[f.original.id,6]],'10.1 courses : seule confirmation bascule sur vrai parent et garde portions');
    eq([row.manual_lines,row.checked['manual:papier'],row.row_overrides],[f.list.manual_lines,true,f.list.row_overrides],'10.1 courses : lignes libres, case et rayon conservés');
    eq(await db.getSnapshot(['recipes','recipe_versions','meals']),{recipes:avant.recipes,recipe_versions:avant.recipe_versions,meals:avant.meals},'10.1 courses : confirmation ne modifie pas la recette ou le repas');
   }finally{e.fermer();}
  });
  for(const cible of ['enfant','parent'])for(const type of ['recette','repas','courses'])await cas('CAS '+type+' '+cible,async(repo,db)=>{
   const f=await semer(db,{liste:type==='courses'});let atteint=0,erreur;
   const R={...repo,saveBatch:async(...args)=>{if(type==='recette'&&!args[0]?.cook_sessions)return repo.saveBatch(...args);atteint++;const id=cible==='enfant'?f.version.id:f.original.id,v=await db.get('recipe_versions',id);await db.put('recipe_versions',{...v,updated_at:'2026-10-31T01:00:00.000Z'},{origin:'remote'});try{return await repo.saveBatch(...args);}catch(e){erreur=e;throw e;}}};
   const e=await ouvrir(type,R,f);
   try{
    if(type==='courses'){const b=await comparer(e);if(b)await conserver(e,b);}else await agir(e,type==='recette'?'Commencer à cuisiner':'Voir mes courses');
    eq(atteint,1,'10.1 CAS '+type+' : concurrence injectée après résolution et avant transaction');
    eq(erreur?.message,type==='recette'&&cible==='parent'?'version_modifiee':'source_modifiee','10.1 CAS '+type+' : '+cible+' modifié refuse au motif exact');
    eq((await repo.all(type==='recette'?'cook_sessions':'shopping_lists')).length,type==='courses'?1:0,'10.1 CAS '+type+' : aucun nouvel usage partiel');
    if(type==='courses')eq(await repo.get('shopping_lists',f.list.id),f.list,'10.1 CAS courses : liste existante intégralement intacte');
   }finally{e.fermer();}
  });
  for(const mutation of ['absent','etranger','corrompu','portions'])await cas('refus '+mutation,async(repo,db)=>{
   const f=await semer(db,{portions:mutation==='portions'?-1:6,muter:f=>{if(mutation==='absent')f.original=null;if(mutation==='etranger')f.original.recipe_id='autre-recette';if(mutation==='corrompu')f.version.steps[0].text+=' Texte altéré.';}}),e=await ouvrir('recette',repo,f);
   try{await agir(e,'Commencer à cuisiner');eq(await repo.all('cook_sessions'),[],'10.1 refus '+mutation+' : aucun recours inventé');ok(e.messages.length===1&&!e.nav.length,'10.1 refus '+mutation+' : refus visible sans fausse navigation');}finally{e.fermer();}
  });
  for(const key of ['user_id','editor_library_epoch:v1'])await cas('portée '+key,async(repo,db)=>{
   const f=await semer(db);let atteint=0;
   const R={...repo,saveBatch:async(...args)=>{atteint++;await db.put('sync_state',{key,value:'autre'},{origin:'device'});return repo.saveBatch(...args);}},e=await ouvrir('repas',R,f);
   try{await agir(e,'Voir mes courses');eq(atteint,1,'10.1 portée : changement '+key+' atteint la transaction');eq(await repo.all('shopping_lists'),[],'10.1 portée : changement '+key+' refuse le nouvel usage');ok(e.messages.length===1&&!e.nav.length,'10.1 portée : refus sans navigation après changement '+key);}finally{e.fermer();}
  });
 }finally{setUiLocale(langue);}
}
