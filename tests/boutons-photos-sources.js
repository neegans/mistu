import {withRepo} from './sync-fixture.js';
import {withDatabase} from './backup.js';
import {getData} from '../src/ui/state.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
import {creerCommandesSources} from '../src/ui/revisions-source.js';
import {creerServiceRevisionsSource} from '../src/domain/revisions-source.js';
import {renderImportCible} from '../src/ui/import-cible.js';
import {capturerRecette} from '../src/ui/recette-garde.js';
import {memoireCycleImport} from '../src/domain/contexte-import.js';
import {validateParsedRecipe} from '../src/domain/llm.js';
import {sha256Hex} from '../src/core/hash.js';

const porte=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const attendre=async fn=>{for(let i=0;i<300;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Geste photo non terminé');};
const bouton=(root,texte)=>[...root.querySelectorAll('button')].find(b=>b.textContent===texte);
const magasins=['books','book_editions','recipes','recipe_versions','scan_sessions','source_documents','source_pages','imports','files','outbox'];
const image=async()=>{const c=new OffscreenCanvas(32,48);c.getContext('2d').fillRect(0,0,32,48);return new File([await c.convertToBlob({type:'image/jpeg'})],'page.jpg',{type:'image/jpeg'});};
async function fixture(repo,db){
 const fichier=await image(),sha256=await sha256Hex(fichier),edition={id:'source-ed',book_id:'source-book'},page={id:'source-page',edition_id:edition.id,document_id:'source-doc',sha256,rotation:0,position:1,kind:'recipe'},document={id:'source-doc',edition_id:edition.id,scan_session_id:'source-session',source_type:'photo',sha256,size:fichier.size,mime:fichier.type,original_filename:fichier.name,captured_at:'2026-11-01T12:00:00.000Z'},session={id:'source-session',edition_id:edition.id,status:'open',page_ids:[page.id],document_ids:[document.id],recipe_ids:[]},recipe={id:'source-recipe',edition_id:edition.id,original_title:'Pain',availability:'reference_only',source_page_ids:[page.id]};
 await db.mutate({origin:'remote',puts:{books:[{id:edition.book_id,title:'Livre'}],book_editions:[edition],source_pages:[page],source_documents:[document],scan_sessions:[session],recipes:[recipe],files:[{sha256,blob:fichier,mime:fichier.type}]}});
 return{fichier,page,document,session,edition,recipe,ctx:await getData(true)};
}
const affiche=f=>({session:f.session,pages:[f.page],documents:[f.document],edition:f.edition});

export async function runBoutonsPhotosSourcesTests({eq,ok}){
 const locale=getUiLocale();setUiLocale('fr');
 try{
  for(const action of ['append','replace'])await withRepo(async(repo,db)=>{
   const f=await fixture(repo,db),gate=porte(),service=creerServiceRevisionsSource({repo,getGeneration:()=>0}),demandes=[];let captureFinie=false,selection=[];
   const g=await creerCommandesSources({repo,ctx:f.ctx,compte:Promise.resolve({owner_id:null}),lire:()=>affiche(f),estCourante:()=>true,onResultat:()=>{},deps:{serviceRevisions:{...service,capturerSources:async a=>{const r=await service.capturerSources(a);await gate.promise;captureFinie=true;return r;}},pickFiles:o=>{demandes.push(o);return Promise.resolve(selection);}}});document.body.append(g.racine);
   try{const avant=await db.getSnapshot(magasins),p=g.modifier({action,pageId:f.page.id});
    eq([demandes.length,captureFinie],[1,false],`Sources ${action} : sélecteur demandé avant la capture asynchrone`);gate.resolve();await p;
    eq(demandes[0]?.capture,action==='replace'?'environment':undefined,`Sources ${action} : options de capture conservées`);
    eq(await db.getSnapshot(magasins),avant,`Sources ${action} : annuler conserve octets, sources et file`);
    await g.modifier({action,pageId:f.page.id});eq([demandes.length,g.occupe()],[2,false],`Sources ${action} : réouverture après annulation`);
    selection=[f.fichier];const r=await g.modifier({action,pageId:f.page.id});eq(r.issue,'applique',`Sources ${action} : JPEG réellement conservé après un nouveau choix`);
    eq(await db.get('source_pages',f.page.id),f.page,`Sources ${action} : ancienne page source intacte`);
    eq((await db.getAll('source_pages')).length,2,`Sources ${action} : une seule nouvelle page sans écraser l’ancienne`);
   }finally{gate.resolve();g.dispose();g.racine.remove();}
  });
  for(const changement of ['compte','base','cycle','source','navigation'])await withRepo(async(repo,db)=>{
   const f=await fixture(repo,db),choix=porte(),capture=porte(),service=creerServiceRevisionsSource({repo,getGeneration:()=>0});let vivant=true,appels=0;
   const g=await creerCommandesSources({repo,ctx:f.ctx,compte:Promise.resolve({owner_id:null}),lire:()=>affiche(f),estCourante:()=>vivant,onResultat:()=>{appels++;},deps:{serviceRevisions:{...service,capturerSources:async a=>{const r=await service.capturerSources(a);capture.resolve();return r;}},pickFiles:()=>choix.promise}});document.body.append(g.racine);
   try{const operation=g.modifier({action:'replace',pageId:f.page.id});await capture.promise;
    const finir=async autre=>{if(changement==='compte')await db.put('sync_state',{key:'user_id',value:'autre'},{origin:'remote'});if(changement==='cycle')await db.put('book_editions',{...f.edition,lifecycle_id:'cycle-retire',trashed_at:'2026-11-01T12:00:00.000Z'},{origin:'remote'});if(changement==='source')await db.put('source_pages',{...f.page,rotation:90},{origin:'remote'});if(changement==='navigation')vivant=false;
     const avant=await db.getSnapshot(magasins),ailleurs=autre?await autre.getSnapshot(magasins):null;choix.resolve([f.fichier]);await operation;
     eq(await db.getSnapshot(magasins),avant,`Sources ${changement} : ancien geste ne modifie plus les données`);
     if(autre)eq(await autre.getSnapshot(magasins),ailleurs,'Sources base : aucune adoption dans la nouvelle base');
     eq(appels,0,`Sources ${changement} : aucun faux résultat conservé`);
    };
    if(changement==='base')await withDatabase(async autre=>{repo.bindDatabase(autre);try{await finir(autre);}finally{repo.bindDatabase(db);}});else await finir();
   }finally{choix.resolve([]);g.dispose();g.racine.remove();}
  });
  await withRepo(async(repo,db)=>{
   const f=await fixture(repo,db),choix=porte(),compte=porte(),service=creerServiceRevisionsSource({repo,getGeneration:()=>0});let ouvertures=0,resultats=0,captures=0;
   const g=await creerCommandesSources({repo,ctx:f.ctx,compte:compte.promise,lire:()=>affiche(f),estCourante:()=>true,onResultat:()=>resultats++,deps:{serviceRevisions:{...service,capturerSources:a=>{captures++;return service.capturerSources(a);}},pickFiles:()=>{ouvertures++;return choix.promise;}}});document.body.append(g.racine);
   try{const operation=g.modifier({action:'append'});eq(ouvertures,1,'Sources compte en attente : ouverture immédiate avant toute résolution');
    await withDatabase(async autre=>{repo.bindDatabase(autre);try{const avant=await db.getSnapshot(magasins),ailleurs=await autre.getSnapshot(magasins);compte.resolve({owner_id:null});choix.resolve([f.fichier]);await operation;eq([await db.getSnapshot(magasins),await autre.getSnapshot(magasins),resultats],[avant,ailleurs,0],'Sources compte en attente : capture ne rebascule pas sur une autre base');eq(captures,0,'Sources compte en attente : aucune recapture dans la base devenue courante');}finally{repo.bindDatabase(db);}});
   }finally{compte.resolve({owner_id:null});choix.resolve([]);g.dispose();g.racine.remove();}
  });
  await withRepo(async(repo,db)=>{
   const f=await fixture(repo,db),choix=porte(),capture=porte();let ouvertures=0;
   const g=await creerCommandesSources({repo,ctx:f.ctx,compte:Promise.resolve({owner_id:null}),lire:()=>affiche(f),estCourante:()=>true,onResultat:()=>{},deps:{serviceRevisions:{capturerSources:()=>capture.promise},pickFiles:()=>{ouvertures++;return choix.promise;}}});document.body.append(g.racine);
   try{const avant=await db.getSnapshot(magasins),p=g.modifier({action:'replace',pageId:f.page.id});eq(ouvertures,1,'Sources rejet : choix ouvert avant le rejet de capture');capture.reject(Error('Capture refusée simulée'));await new Promise(r=>setTimeout(r,0));choix.resolve([f.fichier]);await p;
    eq(await db.getSnapshot(magasins),avant,'Sources rejet : aucun rattachement après capture refusée');ok(g.racine.textContent.includes('L’enregistrement n’a pas abouti'),'Sources rejet : échec visible sans promesse non gérée');
   }finally{choix.resolve([]);g.dispose();g.racine.remove();}
  });
  await withRepo(async(repo,db)=>{
   const f=await fixture(repo,db),gate=porte();let suspendre=false,ouvertures=0;
   const facade={...repo,getFile:async(...a)=>{if(suspendre)await gate.promise;return repo.getFile(...a);}};
   const root=await renderImportCible({id:f.recipe.id},{},f.ctx,{repo:facade,pickFiles:()=>{ouvertures++;return Promise.resolve([]);},toast:()=>{}});document.body.append(root);
   try{const avant=await db.getSnapshot(magasins);suspendre=true;bouton(root,'Photographier').click();eq(ouvertures,1,'Import pages : ouverture avant la lecture des octets déjà liés');gate.resolve();await attendre(()=>!bouton(root,'Photographier').disabled);eq(await db.getSnapshot(magasins),avant,'Import pages : annuler ne crée aucun journal ni aucune photo');}
   finally{gate.resolve();root.dispose?.();root.remove();}
  });
  for(const accord of [false,true,'navigation','annulation'])await withRepo(async(repo,db)=>{
   const f=await fixture(repo,db),capture=await capturerRecette(repo,f.recipe,{ctx:f.ctx}),resultat=validateParsedRecipe({title:'Pain',ingredients:[{source_text:'Farine'}],steps:[{text:'Mélanger.'}]}),journal={id:'source-paye',kind:'recette',recipe_id:f.recipe.id,edition_id:f.edition.id,status:'a_verifier',page_ids:[f.page.id],resultat,reponse_brute:'Réponse payée exacte',appels:1,...memoireCycleImport(capture)};
   await db.put('imports',journal,{origin:'remote'});const choix=porte(),confirmation=porte();let ouvertures=0,confirmations=0,posts=0;
   const root=await renderImportCible({id:f.recipe.id},{},await getData(true),{repo,pickFiles:()=>{ouvertures++;return choix.promise;},confirmer:()=>{confirmations++;return confirmation.promise;},fetch:async()=>{posts++;throw Error('Appel interdit');},toast:()=>{}});document.body.append(root);
   try{const avant=await db.getSnapshot(magasins);bouton(root,'Photographier').click();eq([ouvertures,confirmations],[1,0],`Import payé ${accord} : ouvrir les fichiers avant le dialogue de confirmation`);
    choix.resolve(accord==='annulation'?[]:[f.fichier]);
    if(accord==='annulation'){confirmation.resolve(false);await attendre(()=>!bouton(root,'Photographier').disabled);eq(confirmations,0,'Import payé annulé : aucun dialogue ni décision sur la réponse reçue');}
    else{await attendre(()=>confirmations===1);eq(await db.getSnapshot(magasins),avant,`Import payé ${accord} : aucune écriture avant accord`);if(accord==='navigation'){root.dispose?.();root.remove();}confirmation.resolve(accord===true||accord==='navigation');}
    await attendre(()=>!bouton(root,'Photographier').disabled||!!root.querySelector('[data-role=erreur-ajout-photos]'));
    const ancien=await db.get('imports',journal.id);
    if(accord!==true)eq(ancien,journal,`Import payé ${accord} : journal reçu entièrement inchangé`);
    else eq([ancien.status,ancien.resultat,ancien.reponse_brute,ancien.page_ids,ancien.appels,typeof ancien.replaced_by_import_id],['ignore',journal.resultat,journal.reponse_brute,journal.page_ids,1,'string'],'Import payé accepté : ancienne réponse conservée à part et reliée à la nouvelle lecture');
    eq((await db.getAll('imports')).length,accord===true?2:1,`Import payé ${accord} : nouvelle lecture seulement après accord courant`);eq(posts,0,`Import payé ${accord} : aucun appel assistant`);
   }finally{choix.resolve([]);confirmation.resolve(false);root.dispose?.();root.remove();}
  });
  for(const changement of ['compte','base','cycle','navigation','navigation-transaction'])await withRepo(async(repo,db)=>{
   const f=await fixture(repo,db),choix=porte(),mutate=db.mutate;let entre=false,injections=0;
   const root=await renderImportCible({id:f.recipe.id},{},f.ctx,{repo,pickFiles:()=>{entre=true;return choix.promise;},toast:()=>{}});document.body.append(root);
   try{bouton(root,'Photographier').click();await attendre(()=>entre);
    const finir=async autre=>{if(changement==='compte')await db.put('sync_state',{key:'user_id',value:'autre'},{origin:'remote'});if(changement==='cycle')await db.put('book_editions',{...f.edition,lifecycle_id:'retire',trashed_at:'2026-11-01T12:00:00.000Z'},{origin:'remote'});if(changement==='navigation'){root.dispose?.();root.remove();}
     if(changement==='navigation-transaction')db.mutate=function(args){if(args.puts?.source_pages?.length){injections++;root.dispose?.();root.remove();}return mutate.call(this,args);};
     const avant=await db.getSnapshot(magasins),ailleurs=autre?await autre.getSnapshot(magasins):null;choix.resolve([f.fichier]);await attendre(()=>!bouton(root,'Photographier').disabled||!!root.querySelector('[data-role=erreur-ajout-photos]'));
     eq(await db.getSnapshot(magasins),avant,`Import ${changement} : photos tardives sans écriture dans l’ancienne portée`);if(autre)eq(await autre.getSnapshot(magasins),ailleurs,'Import base : aucun fichier ni journal dans la nouvelle portée');
     if(changement==='navigation-transaction')eq(injections,1,'Import navigation : vraie transaction atteinte avant invalidation de la vue');
    };if(changement==='base')await withDatabase(async autre=>{repo.bindDatabase(autre);try{await finir(autre);}finally{repo.bindDatabase(db);}});else await finir();
   }finally{db.mutate=mutate;choix.resolve([]);root.dispose?.();root.remove();}
  });
 }finally{setUiLocale(locale);}
}
