import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderRecipe } from '../src/ui/recipe.js';
import { resumeReperes } from '../src/ui/reperes-affichage.js';
import { recipeCard, provenanceText } from '../src/ui/components.js';
import { mettreALaCorbeille, restaurerRecette } from '../src/domain/corbeille.js';

const recette=id=>({id,original_title:id,availability:'available',current_version_id:'v-'+id,source_page_ids:[]});
const version=r=>({id:r.current_version_id,recipe_id:r.id,kind:'extraction',verification_state:'verified',servings:2,ingredients:[],steps:[{id:'s',text:'Remuer',timers:[]}]});
async function base(db,rs){await db.mutate({origin:'remote',puts:{recipes:rs,recipe_versions:rs.map(version)}});return getData(true);}
export async function runL3ActionsTests({eq,ok}){
 const run=async(nom,fn)=>{try{await fn();}catch(e){ok(false,`L3 actions ${nom}: ${e.stack||e}`);}};
 await run('Modifier vérifiée',()=>withRepo(async(repo,db)=>{
  const r=recette('verifiee'),ctx=await base(db,[r]);
  const root=await renderRecipe({id:r.id},{v:r.current_version_id},ctx,{repo});
  const a=root.querySelector('[data-role=corriger-tete]');
  ok(a,'L3 fiche : Modifier toujours visible sur version vérifiée');
  eq(a?.textContent,'Modifier','L3 fiche : libellé Modifier');
  ok(a?.getAttribute('href').includes('v=v-verifiee'),'L3 fiche : Modifier cible exactement la version affichée');
  ok(root.querySelector('[data-role=geste-principal] [data-role=actions-contenu]'),'L3 fiche : Actions rejoint Cuisiner et Modifier');
  eq(root.querySelectorAll('[data-role=retirer-recette]').length,0,'L3 fiche active : retrait ordinaire dans Actions');
 }));
 await run('repères compacts',async()=>{
  const r=recette('vide'),node=resumeReperes(r,version(r),{compact:true});
  ok(!/Description à compléter|Niveau à estimer|Temps à estimer/.test(node.textContent),'L3 cartes : champs facultatifs vides omis');
  ok(resumeReperes(r,version(r),{detail:true}).textContent.includes('Non renseigné'),'L3 fiche : détails inconnus restent explicites');
 });
 let C;try{C=await import('../src/ui/actions-contenu.js');}catch(e){ok(false,'L3 API actions : '+e.message);return;}
 await run('versions et état effectif',()=>withRepo(async(repo,db)=>{
  const r=recette('r'),ctx=await base(db,[r]),v=version(r),actions=C.actionsRecette({recipe:r,version:v,ctx},{repo});
  const modifier=actions.find(a=>a.id==='modifier');ok(modifier?.href.includes('v=v-r'),'L3 actions : éditeur exact');
  eq(C.actionsRecette({recipe:r,version:{...v,recipe_id:'autre'},ctx},{repo}).find(a=>a.id==='modifier')?.href.includes('v=v-r'),false,'L3 actions : version étrangère écartée');
  const retired={...r,lifecycle_id:'retiree',trashed_at:'2026-10-29T12:00:00.000Z'};
  eq(C.actionsRecette({recipe:retired,version:v,ctx},{repo}).map(a=>a.id),['restaurer'],'L3 retirée : aucune écriture ordinaire');
  eq(C.actionsRecette({recipe:{...r,edition_id:'absente'},version:v,ctx},{repo}),[],'L3 édition manquante : consultation seulement');
  const card=recipeCard({recipe:r,version:v},{ctx});
  ok(card.querySelector('[data-action=modifier]'),'L3 carte compacte : Modifier direct');
  ok(card.querySelector('[data-role=actions-contenu]'),'L3 carte compacte : Actions toujours visible');
  eq(provenanceText({...r,printed_page:'x'.repeat(5000)},{title:'Livre'},{}),'Livre','L3 provenance : page hostile non rendue');
 }));
 await run('favori fusion et cycle',()=>withRepo(async(repo,db)=>{
  const r=recette('favori'),ctx=await base(db,[r]),caps=await C.capturerSelectionRecettes([r],ctx,{repo});
  await db.mutate({origin:'remote',puts:{recipes:[{...r,personal_notes:'Note concurrente',photo_sha256:'photo'}]}});
  eq((await C.executerSelectionRecettes(caps,{action:'favori',valeur:true},{repo}))[0].issue,'succes','L3 favori : succès après transaction');
  const after=await repo.get('recipes',r.id);eq([after.favorite,after.personal_notes,after.photo_sha256],[true,'Note concurrente','photo'],'L3 favori : seule valeur voulue changée');
  const old=await C.capturerSelectionRecettes([after],await getData(true),{repo});
  const trashed=(await mettreALaCorbeille(after,{repo})).recipe;await restaurerRecette(trashed,{repo});
  eq((await C.executerSelectionRecettes(old,{action:'favori',valeur:false},{repo}))[0].issue,'refuse','L3 favori : menu ouvert avant retrait/restauration périmé');
  eq((await repo.get('recipes',r.id)).favorite,true,'L3 favori : valeur conservée au refus');
 }));
 await run('sélection partielle et doubleclic',()=>withRepo(async(repo,db)=>{
  const rs=['a','b','c'].map(recette),ctx=await base(db,rs),caps=await C.capturerSelectionRecettes(rs,ctx,{repo});
  await mettreALaCorbeille(rs[1],{repo});
  const result=await C.executerSelectionRecettes(caps,{action:'retirer'},{repo});
  eq(result.map(r=>r.issue),['succes','refuse','succes'],'L3 sélection : bilan partiel réel par membre');
  const file=await repo.all('outbox');await C.executerSelectionRecettes(caps,{action:'retirer'},{repo});
  eq(await repo.all('outbox'),file,'L3 sélection : deuxième clic ne recrée aucune commande confirmée');
 }));
 await run('interruption et plat disparu',()=>withRepo(async(repo,db)=>{
  const rs=['x','y'].map(recette),ctx=await base(db,rs),caps=await C.capturerSelectionRecettes(rs,ctx,{repo});let n=0;
  const result=await C.executerSelectionRecettes(caps,{action:'retirer',estCourante:()=>++n===1},{repo});
  eq(result.map(r=>r.issue),['succes','non_traite'],'L3 sélection : interruption conserve succès et indique non traité');
  const more=await C.capturerSelectionRecettes([rs[1]],await getData(true),{repo});
  eq((await C.executerSelectionRecettes(more,{action:'rattacher',platId:'absent'},{repo}))[0].issue,'refuse','L3 rattachement : Plat absent refusé');
  eq(await repo.all('dish_recipe_links'),[],'L3 rattachement : aucun lien orphelin');
 }));
 await run('source version changée',()=>withRepo(async(repo,db)=>{
  const r=recette('source'),ctx=await base(db,[r]),v=version(r),a=C.actionsRecette({recipe:r,version:v,ctx},{repo}).find(a=>a.id==='modifier');
  await db.mutate({origin:'remote',puts:{recipe_versions:[{...v,steps:[{id:'s',text:'Autre résultat reçu',timers:[]}]}]}});
  let refuse=false;try{await a.verifier();}catch{refuse=true;}ok(refuse,'L3 entrée éditeur : source modifiée après affichage refusée');
 }));
 await run('compte changé pendant sélection',()=>withRepo(async(repo,db)=>{
  const rs=['compte-a','compte-b'].map(recette),ctx=await base(db,rs),caps=await C.capturerSelectionRecettes(rs,ctx,{repo});
  await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'autre-compte'}]}});
  const result=await C.executerSelectionRecettes(caps,{action:'retirer'},{repo});
  eq(result.map(r=>r.issue),['refuse','non_traite'],'L3 portée : compte refusé puis arrêt des membres restants');
  eq((await repo.all('recipes')).map(r=>r.trashed_at??null),[null,null],'L3 portée : aucune mutation autre compte');
 }));
 await run('menu vrai et clavier',()=>withRepo(async(repo,db)=>{
  const r=recette('menu'),ctx=await base(db,[r]);let result=null;
  const node=C.menuActions(C.actionsRecette({recipe:r,version:version(r),ctx},{repo}),{titre:r.original_title,onResultat:r=>{result=r;}});document.body.append(node);
  try{
   node.click();let dlg=document.querySelector('[data-role=dialogue-actions]');
   ok(dlg?.open,'L3 menu : vrai dialogue ouvert');eq(node.getAttribute('aria-expanded'),'true','L3 menu : ouverture annoncée');
   ok(dlg.querySelector('[data-action=modifier]')?.tagName==='A','L3 menu : Modifier reste un vrai lien');
   eq(dlg.querySelectorAll('a button,a a').length,0,'L3 menu : aucun contrôle dans un lien');
   dlg.dispatchEvent(new Event('cancel',{cancelable:true}));eq(document.activeElement,node,'L3 menu : Échap rend focus au bouton');
   node.click();dlg=document.querySelector('[data-role=dialogue-actions]');dlg.querySelector('[data-action=favori]').click();
   for(let i=0;i<80&&!result;i++)await new Promise(r=>setTimeout(r,5));
   eq(result?.issue,'succes','L3 menu : callback seulement après écriture');eq((await repo.get('recipes',r.id)).favorite,true,'L3 menu : favori durable');
   ok(!document.querySelector('[data-role=dialogue-actions]'),'L3 menu : dialogue fermé après succès');
  }finally{node.remove();document.querySelector('[data-role=dialogue-actions]')?.remove();}
 }));
 await run('livre même flux L2',()=>withRepo(async(repo,db)=>{
  const ed={id:'ed-l3',book_id:'book-l3'};await db.mutate({origin:'remote',puts:{books:[{id:'book-l3',title:'Livre L3'}],book_editions:[ed]}});
  const actions=C.actionsLivre({edition:ed,ctx:await getData(true)},{repo});eq(actions.map(a=>a.id),['modifier-livre','ajouter-index','ajouter-recette','retirer-livre'],'L3 livre : actions directes et retrait réversible');
  const action=actions.find(a=>a.id==='retirer-livre');await action.pret;eq((await action.executer()).issue,'succes','L3 livre vide : réutilise commande L2');
  const after=await repo.get('book_editions',ed.id);ok(!!after.trashed_at,'L3 livre : conservé en corbeille');
  const restore=C.actionsLivre({edition:after,ctx:await getData(true)},{repo})[0];await restore.pret;await restore.executer();
  eq((await repo.get('book_editions',ed.id)).trashed_at,null,'L3 livre : restauration complète');
 }));
 ok(!C.texteErreurAction('ecriture_refusee','Ajouter aux favoris').includes('changé'),'L3 message : panne écriture ne prétend pas un conflit');
 for(const nom of ['QuotaExceededError','AbortError'])await run('relance écriture '+nom,()=>withRepo(async(repo,db)=>{
  const r=recette('relance-'+nom),ctx=await base(db,[r]);let essais=0;
  const depot={...repo,saveBatch:async(...args)=>{if(++essais===1)throw new DOMException('Écriture interrompue',nom);return repo.saveBatch(...args);}};
  const captures=await C.capturerSelectionRecettes([r],ctx,{repo:depot});
  const premier=(await C.executerSelectionRecettes(captures,{action:'favori',valeur:true},{repo:depot}))[0];
  eq(premier.raison,'ecriture_refusee',`L3 ${nom} : échec de stockage reconnu sans faux conflit`);
  eq((await repo.get('recipes',r.id)).favorite??false,false,`L3 ${nom} : échec sans mutation`);
  const suivant=(await C.executerSelectionRecettes(captures,{action:'favori',valeur:true},{repo:depot}))[0];
  eq([suivant.issue,essais,(await repo.get('recipes',r.id)).favorite],['succes',2,true],`L3 ${nom} : relance explicite écrit réellement`);
  await C.executerSelectionRecettes(captures,{action:'favori',valeur:true},{repo:depot});
  eq(essais,2,`L3 ${nom} : succès reste protégé du doubleclic`);
 }));
 await run('export documentaire fiche TM invalidée',()=>withRepo(async(repo,db)=>{
  const r=recette('document-tm'),texte='ANCIEN REGLAGE TM7 A NE PAS EXECUTER';
  const v={...version(r),kind:'correction',steps:[{id:'s',text:texte,timers:[]}],provenance:{generated_by:'manual',thermomix:{corrompu:true},thermomix_invalide:true}};
  await db.mutate({origin:'remote',puts:{recipes:[r],recipe_versions:[v]}});
  const blobs=[],navigations=[],liens=[],creer=URL.createObjectURL,cliquer=HTMLAnchorElement.prototype.click;
  URL.createObjectURL=blob=>{blobs.push(blob);return creer.call(URL,blob);};
  HTMLAnchorElement.prototype.click=function(){liens.push(this.download);};
  let root;
  try{
   root=await renderRecipe({id:r.id},{v:v.id},await getData(true),{repo,navigate:p=>navigations.push(p),toast:()=>{}});document.body.append(root);
   [...root.querySelectorAll('button')].find(b=>b.textContent==='Exporter JSON-LD').click();
   root.querySelector('[data-role=actions-contenu]').click();
   const dialogue=document.querySelector('[data-role=dialogue-actions]');dialogue.querySelector('[data-action=export-yaml]').click();
   for(let i=0;i<80&&document.querySelector('[data-role=dialogue-actions]');i++)await new Promise(r=>setTimeout(r,5));
   eq(liens.map(n=>n.split('.').pop()),['jsonld','yml'],'L3 document TM : téléchargements depuis fiche et menu');
   const json=JSON.parse(await blobs.find(b=>b.type==='application/ld+json')?.text()||'{}');
   ok(json.description?.includes('Document à revoir'),'L3 document TM : JSON-LD annonce le document à revoir');
   eq(json.recipeInstructions,undefined,'L3 document TM : anciens réglages absents des instructions JSON-LD');
   ok(JSON.stringify(json['cuisineos:document_conserve'])?.includes(texte),'L3 document TM : texte conservé dans le document balisé');
   const yaml=await blobs.find(b=>b.type.startsWith('text/yaml'))?.text()||'';
   ok(yaml.includes('Document à revoir')&&yaml.split('  directions:')[0].includes(texte),'L3 document TM : YAML conserve le texte dans les notes');
   ok(!yaml.split('  directions:')[1]?.includes(texte),'L3 document TM : anciens réglages absents des directions YAML');
   [...root.querySelectorAll('button')].find(b=>b.textContent==='Commencer à cuisiner').click();
   eq(await repo.all('cook_sessions'),[],'L3 document TM : aucune session de cuisson ouverte');
   eq(navigations,[],'L3 document TM : garde cuisson conservée');
   eq(root.querySelectorAll('[data-role=copie-cookidoo] button').length,0,'L3 document TM : aucune copie Cookidoo autorisée');
  }finally{root?.remove();document.querySelector('[data-role=dialogue-actions]')?.remove();URL.createObjectURL=creer;HTMLAnchorElement.prototype.click=cliquer;}
 }));
 await run('capacité résolue avant ouverture',()=>withRepo(async(repo,db)=>{
  const r=recette('capacite'),ctx=await base(db,[r]),ed={id:'capacite-livre',book_id:'book'};
  for(const [nom,actions,id] of [
   ['recette',C.actionsRecette({recipe:r,version:version(r),ctx},{repo}),'retirer'],
   ['restauration recette',C.actionsRecette({recipe:{...r,lifecycle_id:'retire',trashed_at:'2026-10-29T12:00:00.000Z'},version:version(r),ctx},{repo}),'restaurer'],
   ['livre',C.actionsLivre({edition:ed,ctx},{repo}),'retirer-livre'],
   ['restauration livre',C.actionsLivre({edition:{...ed,lifecycle_id:'retire',trashed_at:'2026-10-29T12:00:00.000Z',trash_mode:'keep_recipes'},ctx},{repo}),'restaurer-livre'],
  ]){
   await actions.find(a=>a.id===id).pret;
   const node=C.menuActions(actions,{titre:nom,onResultat:()=>{}});document.body.append(node);
   try{for(let i=0;i<2;i++){
    node.click();await Promise.resolve();const dlg=document.querySelector('[data-role=dialogue-actions]');
    eq(dlg.querySelector(`[data-action=${id}]`).disabled,false,`L3 capacité ${nom} : ouverture ${i+1} après résolution reste active`);
    dlg.dispatchEvent(new Event('cancel',{cancelable:true}));
   }}finally{node.remove();document.querySelector('[data-role=dialogue-actions]')?.remove();}
  }
 }));
}
