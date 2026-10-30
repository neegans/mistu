import {withRepo} from './sync-fixture.js';
import {ouvrirCuissons} from '../src/ui/cuisson.js';
const attendre=async f=>{for(let i=0;i<150;i++){if(await f())return;await new Promise(r=>setTimeout(r,10));}throw Error('Dialogue cuisson attendu absent');};
export async function runL8RestesTests({eq,ok}){
 await withRepo(async(repo,db)=>{
  const recipe={id:'reste-r',original_title:'Soupe',current_version_id:'reste-v'},version={id:'reste-v',recipe_id:recipe.id,ingredients:[],steps:[]};await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});
  const recu=[],ordre=[];const promesse=ouvrirCuissons([{id:'reste-h',recipe,version}],{repo,maintenant:()=> '2026-10-30T12:00:00.000Z',toast:()=>{},onEnregistre:r=>{ordre.push('recu');recu.push(r);}}).then(x=>{ordre.push('retour');return x;});
  const dlg=document.querySelector('[data-role=dialogue-cuissons]');const bouton=[...dlg.querySelectorAll('button')].find(x=>x.textContent==='Enregistrer');bouton.click();bouton.click();eq(await promesse,true,'L8 restes : retour booléen cuisson conservé');
  eq(ordre,['recu','retour'],'L8 restes : reçu capturé avant résolution du dialogue');
  await attendre(()=>recu.length===1);eq(recu[0].rows,[await db.get('cook_history','reste-h')],'L8 restes : reçu contient lignes réellement conservées et horodatées');
  eq((await db.getAll('inventory')).length,0,'L8 restes : reçu seul ne crée aucun stock');
  eq(recu.length,1,'L8 restes : double clic ne transmet qu’un reçu');eq((await db.getAll('cook_history')).length,1,'L8 restes : double clic ne duplique pas la cuisson');
 });
 await withRepo(async(repo,db)=>{
  const recipe={id:'reste-scope-r',original_title:'Soupe',current_version_id:'reste-scope-v'},version={id:'reste-scope-v',recipe_id:recipe.id,ingredients:[],steps:[]};await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});let rappels=0;
  const depot={...repo,saveBatch:async(...args)=>{const r=await repo.saveBatch(...args);await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'autre-compte'}]}});return r;}};
  const p=ouvrirCuissons([{id:'reste-scope-h',recipe,version}],{repo:depot,toast:()=>{},onEnregistre:()=>{rappels++;}});const d=document.querySelector('[data-role=dialogue-cuissons]');[...d.querySelectorAll('button')].find(b=>b.textContent==='Enregistrer').click();eq(await p,true,'L8 reçu : cuisson déjà commise reste réussie après changement de compte');eq(rappels,0,'L8 reçu : changement de compte après commit supprime le callback tardif');eq((await db.getAll('inventory')).length,0,'L8 reçu : changement de compte ne crée aucun reste');
 });
 await verifierRestesDepot({eq,ok});
 const {ouvrirCuissonsAvecRestes}=await import('../src/ui/inventaire-restes.js');
 {
  const depot={db:{}},ordre=[],rows=[{id:'h',recipe_id:'r',recipe_version_id:'v'}];
  const resultat=await ouvrirCuissonsAvecRestes([],{repo:depot,ouvrirCuissons:async(items,options)=>{ordre.push('cuisson');options.onEnregistre({deja:false,rows});return true;},ouvrirRestes:async r=>{ordre.push('restes');eq(r.recu.rows,rows,'L8 façade : reçu exact transmis au geste Restes');}});
  eq(resultat,true,'L8 façade : retour booléen conservé');eq(ordre,['cuisson','restes'],'L8 façade : Restes seulement après reçu et await cuisson');
  let ouverts=0;await ouvrirCuissonsAvecRestes([],{repo:depot,ouvrirCuissons:async()=>true,ouvrirRestes:async()=>{ouverts++;}});eq(ouverts,0,'L8 façade : session terminée sans reçu ne fabrique aucune cuisson');
  let courante=true;await ouvrirCuissonsAvecRestes([],{repo:depot,estCourante:()=>courante,ouvrirCuissons:async(i,o)=>{o.onEnregistre({deja:false,rows});courante=false;return true;},ouvrirRestes:async()=>{ouverts++;}});eq(ouverts,0,'L8 façade : vue quittée ne monte aucun formulaire tardif');
  let r;try{r=await ouvrirCuissonsAvecRestes([],{repo:depot,toast:()=>{},ouvrirCuissons:async(i,o)=>{o.onEnregistre({deja:false,rows});return true;},ouvrirRestes:async()=>{throw Error('panne de présentation');}});}catch{r='exception';}eq(r,true,'L8 façade : panne Restes ne transforme pas la cuisson conservée en échec');
 }
}

async function verifierRestesDepot({eq,ok}){
 const {ouvrirRestesApresCuisson}=await import('../src/ui/inventaire-restes.js');
 for(const cause of ['tuple','quota'])await withRepo(async(repo,db)=>{
  const recipe={id:'restes-reel-r',original_title:'Soupe',current_version_id:'restes-reel-v'},version={id:'restes-reel-v',recipe_id:recipe.id,ingredients:[],steps:[]},autreVersion={...version,id:'restes-reel-v2'},history={id:'restes-reel-h',recipe_id:recipe.id,recipe_version_id:version.id,cooked_at:'2026-10-30T10:00:00.000Z',photos:[]};await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version,autreVersion],cook_history:[history]}});
  const p=ouvrirRestesApresCuisson({recu:{deja:false,rows:[history]},repo,getGeneration:()=>0});let dlg,form;const muter=db.mutate.bind(db);let injection=true,atteint=0;const operations=[];
  try{
   await attendre(()=>document.querySelector('[data-role=restes-cuisson]'));dlg=document.querySelector('[data-role=restes-cuisson]');eq((await db.getAll('inventory')).length,0,'L8 restes '+cause+' : proposition seule sans stock');dlg.querySelector('[data-role=restes-lot]').click();await attendre(()=>document.querySelector('[data-role=formulaire-lot]'));form=document.querySelector('[data-role=formulaire-lot]');eq(form.querySelector('[name=remaining]').value,'','L8 restes '+cause+' : aucune quantité déduite de la cuisson');const mode=form.querySelector('[name=mode_quantite]');mode.value='connue';mode.dispatchEvent(new Event('change'));form.querySelector('[name=remaining]').value='4';
   db.mutate=async a=>{const commands=typeof a.inventory_commands==='function'?a.inventory_commands({inventory:(a.conditions?.inventory||[]).map(c=>({id:c.key}))}):a.inventory_commands;if(commands?.length){atteint++;operations.push(commands[0].operation_id);if(injection){if(cause==='quota')throw new DOMException('quota','QuotaExceededError');injection=false;await muter({origin:'remote',puts:{cook_history:[{...history,recipe_version_id:autreVersion.id}]}});}}return muter(a);};
   const save=form.querySelector('[data-role=enregistrer-lot]');save.click();save.click();await attendre(()=>!save.disabled&&!form.querySelector('[role=alert]').hidden);eq(atteint,1,'L8 restes '+cause+' : une seule tentative malgré double clic');eq((await db.getAll('inventory')).length,0,'L8 restes '+cause+' : refus avant tout lot');eq((await db.getAll('outbox')).filter(e=>e.op==='inventory_change').length,0,'L8 restes '+cause+' : aucune commande partielle');eq(form.querySelector('[name=remaining]').value,'4','L8 restes '+cause+' : saisie conservée après refus');
   if(cause==='tuple')ok(/source|changé/i.test(form.querySelector('[role=alert]').textContent),'L8 restes : tuple changé expliqué sans succès fictif');
   else{injection=false;save.click();save.click();await attendre(()=>!form.isConnected);await attendre(()=>!dlg.querySelector('[data-role=fermer-restes]').disabled);const lots=await db.getAll('inventory');eq(lots.length,1,'L8 restes quota : réessai conserve un seul lot');eq(operations[0],operations[1],'L8 restes quota : même opération réservée au réessai');eq(lots[0].stock.remaining,4,'L8 restes quota : quantité saisie conservée');eq([lots[0].source_cook_history_id,lots[0].source_recipe_id,lots[0].source_recipe_version_id],[history.id,recipe.id,version.id],'L8 restes quota : tuple cuisson exact conservé');eq((await db.getAll('cook_history')).length,1,'L8 restes quota : aucune seconde cuisson');}
  }finally{db.mutate=muter;if(form?.isConnected){form.dispatchEvent(new Event('cancel',{cancelable:true}));await attendre(()=>!dlg.querySelector('[data-role=fermer-restes]').disabled);}if(dlg?.isConnected)dlg.querySelector('[data-role=fermer-restes]').click();await p;}
 });
}
