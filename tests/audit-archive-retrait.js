import {withDatabase} from './backup.js';
import {withRepo} from './sync-fixture.js';
import {createArchive,inspectArchive,applyArchive,verifyRestored} from '../src/domain/backup.js';
import {sha256Hex} from '../src/core/hash.js';
import {renderSettings,archiveEnCours} from '../src/ui/settings.js';
import {setUiLocale} from '../src/core/i18n.js';
import {Database} from '../src/core/db.js';
import {empreinteSources,projectionIdentitePage,projectionAnnotationPage} from '../src/domain/sources-format.js';
import {preparerStockageIndex} from '../src/domain/index-stockage.js';
import {validerPageIndex} from '../src/domain/index-livre.js';

const AT='2026-10-28T12:00:00.000Z',RETRAIT='2026-10-30T12:00:00.000Z';
const copie=structuredClone,code=async fn=>{try{await fn();return null;}catch(e){return e.code??e.message;}};
const recette=id=>({id,original_title:'Archive '+id,current_version_id:'v-'+id,updated_at:AT});
const version=id=>({id:'v-'+id,recipe_id:id,ingredients:[],steps:[{id:'s-'+id,text:'Préparation '+id}],updated_at:AT});
async function fixture({sources=false}={}){
 const blob=new Blob(['Photo récupérable même si la recette reste retirée'],{type:'image/png'}),sha=await sha256Hex(blob);
 const stores={recipes:['retiree','autre','neuve'].map(recette),recipe_versions:['retiree','autre','neuve'].map(version),files:[{sha256:sha,mime:blob.type,size:blob.size,blob}]};
 if(sources){
  Object.assign(stores,{books:[{id:'b'}],book_editions:[{id:'e',book_id:'b'}],scan_sessions:[{id:'ss',edition_id:'e',status:'open',page_ids:['p'],document_ids:['d'],recipe_ids:['retiree','autre'],source_state:{format:1,revision:'selection-locale',active_page_ids:['p']}}],source_documents:[{id:'d',edition_id:'e',scan_session_id:'ss',sha256:sha,source_type:'photo'}],source_pages:[{id:'p',edition_id:'e',document_id:'d',sha256:sha,rotation:0,position:1,source_revision:{format:1,family_id:'p',parent_page_id:null,operation_id:'capture',reason:'capture'}}]});
  for(const r of stores.recipes.filter(r=>r.id!=='neuve'))Object.assign(r,{edition_id:'e',source_page_ids:['p']});
 }
 let archive;await withDatabase(async db=>{await db.mutate({origin:'remote',puts:stores});archive=await createArchive(db);});
 return{stores,archive,sha,blob};
}
async function cible(db,f,{restauree=false}={}){
 const stores=copie(f.stores);stores.recipes=stores.recipes.filter(r=>r.id!=='neuve').map(r=>r.id==='retiree'?{...r,lifecycle_id:'retrait-local',trashed_at:restauree?null:RETRAIT,original_title:'Titre gardé ici'}:{...r,original_title:'Avant fusion'});
 stores.recipe_versions=stores.recipe_versions.filter(v=>v.recipe_id!=='neuve').map(v=>v.recipe_id==='retiree'?{...v,steps:[{id:'s-locale',text:'Correction conservée ici'}]}:v);
 if(!f.stores.source_pages)stores.files=[];
 await db.mutate({origin:'remote',puts:stores});return stores;
}
const attendre=async predicate=>{for(let i=0;i<200&&!predicate();i++)await new Promise(r=>setTimeout(r,5));};
async function indexPartage(f,{fragments,liensInverses}){
 const stores=copie(f.stores),page=stores.source_pages[0];
 if(!liensInverses)stores.scan_sessions[0].recipe_ids=[];
 const journal={id:'index',kind:'index',status:'enregistre',edition_id:'e',scan_session_id:'ss',page_ids:['p'],owner_id:null,index_call:{format:1,series_id:'serie',page_id:'p',kind:'full',parent_call_id:null},source_capture:{format:2,session_id:'ss',source_state_revision:'selection-locale',selected_page_ids:['p'],pages:[{id:'p',identity_sha256:await empreinteSources(projectionIdentitePage(page)),annotation_sha256:await empreinteSources(projectionAnnotationPage(page)),preparation_version:'index-image-v1',zone:{kind:'full',x:0,y:0,width:100,height:100,source_width:100,source_height:100},sent_image_sha256:'c'.repeat(64)}]}};
 const resultat={format:2,pages:[{page_id:'p',etat:'lue',moities:0,modele:'modele-test',...validerPageIndex({sorte_page:'table',entrees:fragments?Array.from({length:600},(_,i)=>['🍞'.repeat(196)+String(i).padStart(4,'0'),'🍐'.repeat(80),'🍎'.repeat(120),'recette',false]):[['Pain','12',null,'recette',false]],incertain:[]})}]};
 let n=0;const stockage=fragments?await preparerStockageIndex({journal,resultat},{newId:()=>`fragment-${++n}`}):{journal:{...journal,resultat},fragments:[]};
 stores.imports=[stockage.journal,...stockage.fragments];
 stores.recipes=stores.recipes.map(r=>r.id==='neuve'?r:{...r,availability:'reference_only',current_version_id:null,index_page_id:'p',index_import_id:'index'});
 return stores;
}

export async function runAuditArchiveRetraitTests({eq,ok}){
 const f=await fixture(),bytes=await f.archive.blob.arrayBuffer();
 await withDatabase(async db=>{
  const connexion=new Database(db.name,db.version,db.stores),insp=await inspectArchive(bytes);
  try{eq(await code(()=>applyArchive(connexion,insp)),null,'B1 compatibilité : connexion valide non encore ouverte');
   ok((await verifyRestored(connexion,insp)).ok,'B1 compatibilité : restauration via nouvelle connexion vérifiée');
  }finally{connexion.idb?.close();connexion.idb=null;}
 });
 for(const restauree of [false,true])await withDatabase(async db=>{
  await cible(db,f,{restauree});const avant=await db.getSnapshot(),insp=await inspectArchive(bytes,{db});
  eq([insp.ok,insp.refus,insp.recettes],[true,'retrait_posterieur',['retiree']],'B1 archive : retrait local'+(restauree?' puis restauration':'')+' détecté sans invalider le ZIP');
  eq(await db.getSnapshot(),avant,'B1 inspection : aucune écriture');
  eq(await code(()=>applyArchive(db,insp)), 'cycles_divergents','B1 archive : fusion complète toujours refusée');
  let bilan;const erreur=await code(async()=>{bilan=await applyArchive(db,insp,{mode:'merge',exclure:insp.recettes??['retiree']});});
  eq(erreur,null,'B1 fusion : le geste explicite conserve le cycle local');
  eq(await db.get('recipes','retiree'),avant.recipes.find(r=>r.id==='retiree'),'B1 fusion : recette retirée inchangée');
  eq(await db.get('recipe_versions','v-retiree'),avant.recipe_versions.find(r=>r.id==='v-retiree'),'B1 fusion : correction locale inchangée');
  eq((await db.get('recipes','autre'))?.original_title,'Archive autre','B1 fusion : autre recette restaurée');
  eq((await db.get('recipes','neuve'))?.original_title,'Archive neuve','B1 fusion : nouvelle recette restaurée');
  eq(await (await db.get('files',f.sha))?.blob?.text(),await f.blob.text(),'B1 fusion : fichier conservé même sans recette importée associée');
  ok(bilan?.ecartees?.some(r=>r.store==='recipe_versions'&&r.id==='v-retiree'),'B1 fusion : dépendances écartées annoncées');
  ok((await verifyRestored(db,insp)).ok,'B1 vérification : compare seulement ce qui a réellement été importé');
  if(!erreur)await db.mutate({origin:'remote',puts:{recipes:[{...await db.get('recipes','autre'),original_title:'Altération après import'}]}});
  ok(!(await verifyRestored(db,insp)).ok,'B1 vérification : une altération du contenu importé reste détectée');
 });
 await withDatabase(async db=>{
  await cible(db,f);const ancienne=await inspectArchive(bytes);ancienne.payload.stores.recipes.find(r=>r.id==='retiree').lifecycle_id='autre-cycle';ancienne.payload.stores.recipes.find(r=>r.id==='retiree').trashed_at=null;
  let ancienneArchive;await withDatabase(async source=>{await source.mutate({origin:'remote',puts:ancienne.payload.stores});ancienneArchive=await createArchive(source);});
  const insp=await inspectArchive(await ancienneArchive.blob.arrayBuffer(),{db});
  eq(insp.refus,'cycles_divergents','B1 inspection : deux cycles nommés ne prouvent pas une chronologie');
  eq(insp.recettes,['retiree'],'B1 inspection : divergence reste nommée');
 });
 for(const [options,motif]of [[{mode:'replace',exclure:['retiree']},'exclusion_fusion_seulement'],[{exclure:['inconnue']},'exclusion_invalide'],[{exclure:['autre']},'exclusion_invalide']])await withDatabase(async db=>{
  await cible(db,f);const avant=await db.getSnapshot(),insp=await inspectArchive(bytes,{db});
  eq(await code(()=>applyArchive(db,insp,options)),motif,'B1 exclusion : intention invalide refusée '+JSON.stringify(options));
  eq(await db.getSnapshot(),avant,'B1 exclusion invalide : aucun changement');
 });
 const partage=await fixture({sources:true});await withDatabase(async db=>{
  await cible(db,partage);const avant=await db.getSnapshot(),insp=await inspectArchive(await partage.archive.blob.arrayBuffer(),{db});
  eq(await code(()=>applyArchive(db,insp,{exclure:['retiree']})),null,'B1 sources : fusion avec pages partagées et signées');
  for(const store of ['scan_sessions','source_documents','source_pages'])eq(await db.getAll(store),avant[store],'B1 sources : '+store+' local conservé exactement');
  eq((await db.get('recipes','autre'))?.original_title,'Archive autre','B1 sources : autre recette utilisant les pages partagées restaurée');
  ok((await verifyRestored(db,insp)).ok,'B1 sources : graphe final vérifié');
 });
 for(const fragments of [false,true])for(const liensInverses of [false,true])await withDatabase(async db=>{
  const stores=await indexPartage(partage,{fragments,liensInverses});let archive;
  await withDatabase(async source=>{await source.mutate({origin:'remote',puts:stores});archive=await createArchive(source);});
  const locales=copie(stores);locales.recipes=locales.recipes.filter(r=>r.id!=='neuve').map(r=>r.id==='retiree'?{...r,lifecycle_id:'retrait-local',trashed_at:RETRAIT}:r);locales.recipe_versions=locales.recipe_versions.filter(v=>v.recipe_id!=='neuve');
  await db.mutate({origin:'remote',puts:locales});const avant=await db.getSnapshot(),insp=await inspectArchive(await archive.blob.arrayBuffer(),{db});
  const label='B1 index partagé '+(fragments?'fragmenté':'inline')+(liensInverses?' avec':' sans')+' liens inverses';
  eq([insp.ok,insp.refus],[true,'retrait_posterieur'],label+' : archive réellement valide');
  if(fragments)eq(stores.imports.length,5,label+' : manifeste et quatre fragments atteints');
  eq(await code(()=>applyArchive(db,insp,{exclure:['retiree']})),null,label+' : fusion disponible');
  for(const store of ['imports','source_pages','source_documents','scan_sessions'])eq(await db.getAll(store),avant[store],label+' : '+store+' conservé exactement');
  eq((await db.get('recipes','neuve'))?.original_title,'Archive neuve',label+' : recette indépendante importée');
  ok((await verifyRestored(db,insp)).ok,label+' : graphe effectif vérifié');
 });
 for(const mutation of ['compte','epoque','date-cycle'])await withDatabase(async db=>{
  await cible(db,f);const insp=await inspectArchive(bytes,{db});
  await db.mutate({origin:'remote',puts:mutation==='date-cycle'?{recipes:[{...await db.get('recipes','retiree'),trashed_at:'2026-10-30T13:00:00.000Z'}]}:{sync_state:[{key:mutation==='compte'?'user_id':'editor_library_epoch:v1',value:'nouveau'}]}});
  const avant=await db.getSnapshot();eq(await code(()=>applyArchive(db,insp,{exclure:['retiree']})),'contexte_archive_change','B1 intention ancienne '+mutation+' : portée relue avant application');
  eq(await db.getSnapshot(),avant,'B1 intention ancienne '+mutation+' : aucune écriture');
 });
 await withDatabase(async db=>{
  await cible(db,partage);await db.mutate({origin:'remote',puts:{book_editions:[{...await db.get('book_editions','e'),lifecycle_id:'edition-retiree',trashed_at:RETRAIT}]}});
  const insp=await inspectArchive(await partage.archive.blob.arrayBuffer(),{db}),avant=await db.getSnapshot();
  eq(insp.refus,'cycles_divergents','B1 édition protégée : la divergence reste explicite');
  eq(insp.fusionSansRecettes,undefined,'B1 édition protégée : aucun raccourci par exclusion de recette');
  eq(await code(()=>applyArchive(db,insp,{exclure:['retiree']})),'cycles_divergents','B1 édition protégée : exclusion incapable de contourner le cycle');
  eq(await db.getSnapshot(),avant,'B1 édition protégée : aucun changement');
 });
 await withDatabase(async db=>{
  await db.mutate({origin:'remote',puts:{recipes:[{...recette('retiree'),current_version_id:'v-neuve',lifecycle_id:'retrait-local',trashed_at:RETRAIT}],recipe_versions:[{...version('neuve'),recipe_id:'retiree'}]}});
  let archive;await withDatabase(async source=>{await source.mutate({origin:'remote',puts:{recipes:[recette('neuve')],recipe_versions:[version('neuve')]}});archive=await createArchive(source);});
  const insp=await inspectArchive(await archive.blob.arrayBuffer()),avant=await db.getSnapshot();
  ok(insp.ok,'B1 graphe effectif : archive de collision réellement valide');
  eq(await code(()=>applyArchive(db,insp)),'cycles_divergents','B1 graphe effectif : une vraie perte du parent protégé reste refusée');
  eq(await db.getSnapshot(),avant,'B1 graphe effectif : refus atomique du déplacement de version');
 });
 await withDatabase(async db=>{
  await cible(db,partage);const stores=await db.getSnapshot();
  stores.scan_sessions=[];stores.source_documents=stores.source_documents.map(({scan_session_id,...d})=>d);
  stores.source_pages=stores.source_pages.map(({source_revision,...p})=>({...p,position:1}));
  await db.mutate({origin:'remote',clearStores:['scan_sessions','source_documents','source_pages'],puts:{source_documents:stores.source_documents,source_pages:stores.source_pages}});
  let archive;await withDatabase(async source=>{const propres=copie(stores);propres.recipes=propres.recipes.map(r=>r.id==='retiree'?recette('retiree'):r);propres.recipes.find(r=>r.id==='retiree').source_page_ids=['p'];await source.mutate({origin:'remote',puts:propres});archive=await createArchive(source);});
  await db.mutate({origin:'remote',puts:{source_pages:[{...stores.source_pages[0],position:99}]}});
  const avant=await db.get('source_pages','p'),insp=await inspectArchive(await archive.blob.arrayBuffer(),{db});
  eq(await code(()=>applyArchive(db,insp,{exclure:['retiree']})),null,'B1 source legacy : fusion sans lien inverse de séance');
  eq(await db.get('source_pages','p'),avant,'B1 source legacy : annotations de la page de la recette exclue conservées');
 });
 await withDatabase(async db=>{
  const stores=copie(f.stores);stores.recipes.find(r=>r.id==='retiree').index_import_id='index-legacy';stores.imports=[{id:'index-legacy',kind:'index',status:'enregistre',resultat:{note:'Archive'}}];
  let archive;await withDatabase(async source=>{await source.mutate({origin:'remote',puts:stores});archive=await createArchive(source);});
  stores.recipes.find(r=>r.id==='retiree').lifecycle_id='retrait-local';stores.recipes.find(r=>r.id==='retiree').trashed_at=RETRAIT;stores.imports[0].resultat.note='Conservé ici';
  await db.mutate({origin:'remote',puts:stores});const avant=await db.get('imports','index-legacy'),insp=await inspectArchive(await archive.blob.arrayBuffer(),{db});
  ok(insp.ok,'B1 index legacy : archive valide sans lien inverse ni source_page_ids');
  eq(await code(()=>applyArchive(db,insp,{exclure:['retiree']})),null,'B1 index legacy : fusion du reste disponible');
  eq(await db.get('imports','index-legacy'),avant,'B1 index legacy : journal lié seulement par index_import_id conservé');
 });
 await withDatabase(async db=>{
  await cible(db,partage);await db.mutate({origin:'remote',clearStores:['scan_sessions','source_documents','source_pages'],puts:{recipes:(await db.getAll('recipes')).map(({source_page_ids,...r})=>r)}});
  const avant=await db.get('recipes','autre'),insp=await inspectArchive(await partage.archive.blob.arrayBuffer(),{db});let bilan;
  eq(await code(async()=>{bilan=await applyArchive(db,insp,{exclure:['retiree']});}),null,'B1 dépendance absente : fusion du reste disponible');
  eq(await db.get('recipes','autre'),avant,'B1 dépendance absente : recette locale intacte');
  ok(bilan?.ecartees.some(r=>r.store==='recipes'&&r.id==='autre'&&r.motif==='dependance_exclue'),'B1 dépendance absente : exclusion supplémentaire nommée');
  ok((await verifyRestored(db,insp)).ok,'B1 dépendance absente : aucune relation cassée après fusion');
 });
 for(const mutation of ['cycle','compte','epoque','source'])await withDatabase(async db=>{
  await cible(db,partage);const insp=await inspectArchive(await partage.archive.blob.arrayBuffer(),{db}),mutate=db.mutate.bind(db);let atteint=false,concurrent;
  db.mutate=async args=>{
   if(args.archive_import&&!atteint){atteint=true;const puts=mutation==='cycle'?{recipes:[{...await db.get('recipes','retiree'),lifecycle_id:'cycle-concurrent'}]}:mutation==='source'?{scan_sessions:[{...await db.get('scan_sessions','ss'),source_state:{format:1,revision:'autre-selection',active_page_ids:['p']}}]}:{sync_state:[{key:mutation==='compte'?'user_id':'editor_library_epoch:v1',value:'nouveau'}]};await mutate({origin:'remote',puts});concurrent=await db.getSnapshot();}
   return mutate(args);
  };
  const motif=await code(()=>applyArchive(db,insp,{exclure:['retiree']}));db.mutate=mutate;
  ok(atteint,'B1 course '+mutation+' : transaction finale atteinte');
  eq(motif,({cycle:'sources_divergentes',source:'sources_divergentes',compte:'Le compte a changé pendant la restauration.',epoque:'La bibliothèque a changé pendant la restauration.'})[mutation],'B1 course '+mutation+' : motif exact du refus');
  eq(await db.getSnapshot(),concurrent,'B1 course '+mutation+' : état concurrent intégralement conservé');
 });
 await withRepo(async(repo,db)=>{
  await cible(db,f);setUiLocale('fr');const root=await renderSettings({}, {},{settings:await repo.getSettings(),sync:{}},{pickFiles:async()=>[new File([bytes],'ancienne.zip',{type:'application/zip'})]});document.body.append(root);
  try{
   [...root.querySelectorAll('button')].find(b=>b.textContent==='Restaurer une sauvegarde…').click();await attendre(()=>!!root.querySelector('[data-role="refus-archive-cycle"]'));await attendre(()=>!archiveEnCours());
   ok(root.textContent.includes('Cette archive est antérieure à un retrait'),'B1 Réglages : motif précis avant restauration');
   ok(root.querySelector('[data-role="recettes-ecartees"]')?.textContent.includes('Titre gardé ici'),'B1 Réglages : recettes à conserver nommées par leur titre');
   const bouton=[...root.querySelectorAll('button')].find(b=>b.textContent==='Fusionner sans les recettes retirées');
   ok(bouton&&!bouton.disabled,'B1 Réglages : fusion partielle offerte');
   if(bouton){bouton.click();await attendre(()=>!!document.querySelector('dialog[open]'));const dialogue=document.querySelector('dialog[open]');[...dialogue?.querySelectorAll('button')||[]].find(b=>b.textContent==='Restaurer')?.click();await attendre(()=>!archiveEnCours());}
   eq((await db.get('recipes','neuve'))?.original_title,'Archive neuve','B1 Réglages : bouton réellement câblé vers la fusion');
   eq((await db.get('recipes','retiree'))?.original_title,'Titre gardé ici','B1 Réglages : recette retirée conservée après clic');
   ok(root.textContent.includes('Restauration vérifiée'),'B1 Réglages : succès fondé sur le lot réellement restauré');
  }finally{root.dispose?.();root.remove();document.querySelectorAll('dialog').forEach(d=>d.remove());}
 });
}
