import { withRepo } from './sync-fixture.js';

export async function runL5ComplementsRecetteUiTests({eq,ok}) {
 const U=await import('../src/ui/import-cible.js');
 const resultat={title:'Pain',servings:4,prep_minutes:null,cook_minutes:null,ingredients:[{source_text:'500 g de farine',uncertain:false}],steps:[{text:'Pétrir.'}],printed_page:null,sub_recipes:[],uncertain_fields:[],notes:null,incomplete:false,missing_page:true};
 const attendre=async f=>{for(let i=0;i<150;i++){if(await f())return;await new Promise(r=>setTimeout(r,10));}throw Error('attente complément expirée');};
 async function fixture(repo,db,deps={}) {
  const recipe={id:'r',edition_id:null,original_title:'Pain',availability:'reference_only'},session={id:'s',edition_id:null,status:'open',page_ids:['p'],document_ids:[],recipe_ids:['r'],source_state:{format:1,revision:'choix',active_page_ids:['p']}};
  const page={id:'p',edition_id:null,document_id:null,sha256:'a'.repeat(64),rotation:0},journal={id:'ancien',kind:'recette',recipe_id:'r',edition_id:null,scan_session_id:'s',page_ids:['p'],status:'a_verifier',resultat,owner_id:null,started_at:'2026-10-29T12:00:00.000Z'};
  await db.mutate({origin:'remote',puts:{recipes:[recipe],scan_sessions:[session],source_pages:[page],imports:[journal]}});
  const root=await U.renderImportCible({id:'r'},{},{recipesById:new Map([['r',recipe]]),editionsById:new Map(),booksById:new Map(),proprietaireDonnees:null},{repo,toast:()=>{},navigate:()=>{},fetch:()=>{throw Error('aucun appel autorisé');},...deps});document.body.append(root);
  return {root,session,journal,button:()=>[...root.querySelectorAll('button')].find(b=>b.textContent==='Choisir des photos')};
 }
 const run=async(n,f)=>{try{await withRepo(async(repo,db)=>{U.reinitialiserImportCible();try{await f(repo,db);}finally{U.reinitialiserImportCible();}});}catch(e){ok(false,'L5 complément UI '+n+' : '+(e.stack||e));}};
 await run('annulation',async(repo,db)=>{let confirmations=0,pickers=0;const f=await fixture(repo,db,{confirmer:async()=>{confirmations++;return false;},pickFiles:async()=>{pickers++;return[];}});try{
  ok(!!f.button(),'L5 complément UI : accès photos disponible pour une nouvelle lecture explicite');
  eq(f.root.querySelectorAll('[data-role=retirer],[data-role=monter],[data-role=descendre]').length,0,'L5 complément UI : pages payées restent en consultation');
  f.button()?.click();await attendre(()=>confirmations===1);eq(pickers,0,'L5 complément UI : annuler confirme avant tout sélecteur');eq(await repo.get('imports','ancien'),f.journal,'L5 complément UI : annulation préserve toute la lecture');
 }finally{f.root.remove();}});
 await run('quota puis même geste',async(repo,db)=>{let confirmations=0,pickers=0,calls=0;const args=[],files=[new File(['page suivante'],'suite.jpg',{type:'image/jpeg'})];const port={...repo,get db(){return repo.db;},ajouterPages:async(fs,options)=>{args.push({files:fs,args:structuredClone({...options,recettes:[]})});calls++;if(calls===1)throw new DOMException('plein','QuotaExceededError');return repo.ajouterPages(fs,options);}};const f=await fixture(port,db,{confirmer:async()=>{confirmations++;return true;},pickFiles:async()=>{pickers++;return files;}});try{
  f.button()?.click();await attendre(()=>f.root.querySelector('[data-role=reessayer-ajout-photos]'));
  eq(await repo.get('imports','ancien'),f.journal,'L5 complément UI : quota ne termine pas la réponse payée');
  f.root.querySelector('[data-role=reessayer-ajout-photos]').click();await attendre(async()=>f.root.etatRoute().importId!=='ancien'&&calls===2);
  eq([confirmations,pickers,calls],[1,1,2],'L5 complément UI : réessai conserve confirmation et fichiers sans nouveau sélecteur');
  eq([args[0].args.intention_id,args[0].args.nouvelleLecture],[args[1].args.intention_id,args[1].args.nouvelleLecture],'L5 complément UI : intention et journal réservés identiques au réessai');
  ok(args[0].files===args[1].files,'L5 complément UI : mêmes objets fichiers au réessai');
  const ancien=await repo.get('imports','ancien'),nouveau=await repo.get('imports',f.root.etatRoute().importId);
  eq([ancien.status,ancien.resultat,ancien.page_ids,ancien.scan_session_id],['ignore',resultat,['p'],'s'],'L5 complément UI : réponse et sources historiques exactes après remplacement explicite');
  eq([nouveau.status,nouveau.page_ids.length,(await repo.all('imports')).length],['a_lancer',2,2],'L5 complément UI : nouvelle lecture préparée, aucun appel automatique');
  eq(await repo.get('scan_sessions','s'),f.session,'L5 complément UI : sélection source d’origine inchangée');
 }finally{f.root.remove();}});
 await run('confirmation concurrente',async(repo,db)=>{let picker=0;const f=await fixture(repo,db,{confirmer:async()=>{await db.mutate({origin:'remote',puts:{imports:[{...(await repo.get('imports','ancien')),resultat:{...resultat,title:'Pain concurrent'}}]}});return true;},pickFiles:async()=>{picker++;return[new File(['suite'],'suite.jpg',{type:'image/jpeg'})];}});try{
  f.button()?.click();await attendre(()=>picker===1&&f.root.querySelector('[data-role=erreur-ajout-photos]'));
  eq([(await repo.all('imports')).length,(await repo.all('files')).length], [1,0],'L5 complément UI : réponse remplacée pendant confirmation refuse tous les effets');
  eq((await repo.get('imports','ancien')).resultat.title,'Pain concurrent','L5 complément UI : refus préserve la nouvelle réponse concurrente');
 }finally{f.root.remove();}});
}
