import {withRepo} from './sync-fixture.js';
import {getData} from '../src/ui/state.js';
import {renderBook} from '../src/ui/book.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
const tick=()=>new Promise(r=>setTimeout(r,0));
const attendre=async fn=>{for(let i=0;i<300;i++){if(await fn())return;await tick();}throw Error('Attente photo livre dépassée');};
const dernier=()=>[...document.querySelectorAll('input[type=file]')].at(-1);
const magasins=['books','book_editions','files','scan_sessions','source_documents','source_pages','imports','outbox'];
const seed=async db=>{const book={id:'photo-livre-b',title:'Livre photo'},edition={id:'photo-livre-e',book_id:book.id};await db.mutate({origin:'remote',puts:{books:[book],book_editions:[edition]}});return{book,edition};};
const cible=(root,mode,source)=>[...root.querySelectorAll((mode==='couverture'?'.zone-couverture':'[data-role=ajout-livre]')+' button')].find(b=>b.textContent.trim()===(source==='photo'?'Photographier':mode==='couverture'?'Choisir une image':'Choisir des photos ou un PDF'));
export async function runBoutonsPhotosLivreTests({eq,ok}){
 const click=HTMLInputElement.prototype.click,langue=getUiLocale();let ouvertures=0;
 HTMLInputElement.prototype.click=function(){if(this.type!=='file')return click.call(this);ouvertures++;};setUiLocale('fr');
 try{
  for(const mode of ['index','recette','couverture'])for(const source of ['photo','fichiers'])await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),root=await renderBook({id:edition.id},{nouveau:'1',...(mode!=='couverture'?{panel:mode}:{})},await getData(true));document.body.append(root);
   const get=db.get,avant=await db.getSnapshot(magasins);let liberer,interceptee=false;const porte=new Promise(r=>liberer=r);
   db.get=async function(...args){const p=get.apply(this,args);if(args[0]==='sync_state'&&args[1]==='user_id'&&!interceptee){interceptee=true;await porte;}return p;};
   try{
    const b=cible(root,mode,source),n=ouvertures;b.focus();b.click();
    ok(interceptee,'Photo livre '+mode+'/'+source+' : vraie lecture du contexte suspendue');
    eq(ouvertures,n+1,'Photo livre '+mode+'/'+source+' : ouverture dans le geste avant résolution de la base');
    liberer();await attendre(()=>dernier());const i=dernier();
    eq([i.getAttribute('capture'),i.multiple],[source==='photo'?'environment':null,mode!=='couverture'],'Photo livre '+mode+'/'+source+' : options natives conservées');
    i.dispatchEvent(new Event('cancel'));await tick();await root.attendrePhotos?.();
    eq(await db.getSnapshot(magasins),avant,'Photo livre '+mode+'/'+source+' : annuler ne crée ni page ni séance ni fichier');
    for(let k=0;k<2;k++){const total=ouvertures;b.click();eq(ouvertures,total+1,'Photo livre '+mode+'/'+source+' : réouverture immédiate '+k);await attendre(()=>dernier());dernier().dispatchEvent(new Event('cancel'));await tick();await root.attendrePhotos?.();}
    eq(await db.getSnapshot(magasins),avant,'Photo livre '+mode+'/'+source+' : deux reprises annulées préservent la base');
   }finally{liberer();db.get=get;dernier()?.dispatchEvent(new Event('cancel'));await tick();await root.attendrePhotos?.();root.dispose?.();root.remove();}
  });
 }finally{dernier()?.dispatchEvent(new Event('cancel'));HTMLInputElement.prototype.click=click;setUiLocale(langue);}
}

const jpeg=async()=>{const c=document.createElement('canvas');c.width=40;c.height=60;c.getContext('2d').fillRect(0,0,40,60);return new File([await new Promise(r=>c.toBlob(r,'image/jpeg'))],'photo.jpg',{type:'image/jpeg'});};
const remettre=(input,files)=>{Object.defineProperty(input,'files',{value:files,configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}));};
export async function runBoutonsPhotosLivreConservationTests({eq,ok}){
 const click=HTMLInputElement.prototype.click,langue=getUiLocale(),href=location.href,state=history.state;let refus=null;
 HTMLInputElement.prototype.click=function(){if(this.type!=='file')return click.call(this);if(refus)throw refus;};setUiLocale('fr');
 try{
  for(const mode of ['index','recette','couverture'])await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),liens=[],messages=[],root=await renderBook({id:edition.id},{nouveau:'1',panel:mode},await getData(true),{navigate:u=>liens.push(u),refresh:()=>{},toast:s=>messages.push(s)});document.body.append(root);
   try{cible(root,mode,'photo').click();await attendre(()=>dernier());remettre(dernier(),[await jpeg()]);await root.attendrePhotos?.();await tick();
    if(mode==='couverture'){const ed=await repo.get('book_editions',edition.id),f=await repo.getFile(ed.cover_sha256);ok(!!f?.blob&&f.blob.size>0,'Photo couverture : image et pointeur réellement conservés');eq((await repo.all('scan_sessions')).length,0,'Photo couverture : aucune séance de pages créée');}
    else{const seances=await repo.all('scan_sessions'),pages=await repo.all('source_pages');eq([seances.length,pages.length,pages[0]?.edition_id],[1,1,edition.id],'Photo '+mode+' : fichier conservé dans la bonne édition');ok(liens[0]?.includes('intention='+mode),'Photo '+mode+' : navigation garde l’intention choisie');ok(!!(await repo.getFile(pages[0]?.sha256))?.blob,'Photo '+mode+' : octets relus depuis le dépôt');}
    root.dispose?.();root.remove();const relue=await renderBook({id:edition.id},{nouveau:'1'},await getData(true),{refresh:()=>{}});document.body.append(relue);
    try{ok(mode==='couverture'?!!relue.querySelector('.zone-couverture img'):relue.textContent.includes('1 page'),'Photo '+mode+' : résultat relu dans une nouvelle fiche');}finally{relue.dispose?.();relue.remove();}
   }finally{dernier()?.dispatchEvent(new Event('cancel'));await root.attendrePhotos?.();root.dispose?.();root.remove();}
  });
  for(const mode of ['recette','couverture'])await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),messages=[],root=await renderBook({id:edition.id},{nouveau:'1',panel:mode},await getData(true),{navigate:()=>{},refresh:()=>{},toast:s=>messages.push(s)});document.body.append(root);
   const mutate=db.mutate;let quota=true;db.mutate=function(o,...reste){if(quota&&o.origin==='local'){quota=false;return Promise.reject(new DOMException('plein','QuotaExceededError'));}return mutate.call(this,o,...reste);};
   try{const avant=await db.getSnapshot(magasins);cible(root,mode,'photo').click();await attendre(()=>dernier());remettre(dernier(),[await jpeg()]);await root.attendrePhotos?.();await tick();
    eq(quota,false,'Photo '+mode+' : panne de conservation réellement atteinte');eq(await db.getSnapshot(magasins),avant,'Photo '+mode+' : refus ne conserve aucun morceau');
    const retry=root.querySelector('[data-role=reessayer-photo-livre]');ok(!!retry,'Photo '+mode+' : réessai proposé sans reprendre la photo');
    ok(root.querySelector('[data-role=etat-photo-livre]')?.textContent.includes('conserv'),'Photo '+mode+' : échec de conservation dit près des commandes');
    cible(root,mode,'photo').click();await attendre(()=>dernier());dernier().dispatchEvent(new Event('cancel'));await root.attendrePhotos?.();
    ok(!!root.querySelector('[data-role=reessayer-photo-livre]'),'Photo '+mode+' : nouveau choix annulé garde le réessai précédent');
    if(retry){retry.click();await root.attendrePhotos();}
    ok(mode==='couverture'?!!(await repo.get('book_editions',edition.id)).cover_sha256:(await repo.all('scan_sessions')).length===1,'Photo '+mode+' : réessai conserve la sélection une seule fois');
   }finally{db.mutate=mutate;dernier()?.dispatchEvent(new Event('cancel'));await root.attendrePhotos?.();root.dispose?.();root.remove();}
  });
  for(const changement of ['compte','cycle','navigation','demontage'])await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),liens=[],root=await renderBook({id:edition.id},{nouveau:'1',panel:'recette'},await getData(true),{navigate:u=>liens.push(u),toast:()=>{}});document.body.append(root);
   try{cible(root,'recette','photo').click();await attendre(()=>dernier());const input=dernier();await tick();
    if(changement==='compte')await db.put('sync_state',{key:'user_id',value:'autre'},{origin:'remote'});
    if(changement==='cycle')await db.put('book_editions',{...edition,lifecycle_id:'restaure',trashed_at:null,trash_mode:null},{origin:'remote'});
    if(changement==='navigation')history.replaceState(state,'','#/library?photo-test=1');
    if(changement==='demontage'){root.dispose?.();root.remove();}
    const avant=await db.getSnapshot(magasins);remettre(input,[await jpeg()]);await root.attendrePhotos?.();await tick();
    eq(await db.getSnapshot(magasins),avant,'Photo livre : '+changement+' pendant le choix ne rattache aucun fichier');eq(liens,[],'Photo livre : '+changement+' ne ramène pas sur une ancienne séance');
   }finally{history.replaceState(state,'',href);dernier()?.dispatchEvent(new Event('cancel'));await root.attendrePhotos?.();root.dispose?.();root.remove();}
  });
  await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),root=await renderBook({id:edition.id},{nouveau:'1',panel:'index'},await getData(true),{toast:()=>{}});document.body.append(root);
   try{refus=new DOMException('refus','NotAllowedError');cible(root,'index','photo').click();await root.attendrePhotos?.();await tick();refus=null;
    ok(root.querySelector('[data-role=etat-photo-livre]')?.textContent.includes('choix des photos'),'Photo livre : refus du sélecteur expliqué sans accuser le livre');
    eq(document.querySelectorAll('input[type=file]').length,0,'Photo livre : refus du sélecteur nettoie son input');
   }finally{refus=null;root.dispose?.();root.remove();}
  });
 }finally{refus=null;dernier()?.dispatchEvent(new Event('cancel'));HTMLInputElement.prototype.click=click;setUiLocale(langue);history.replaceState(state,'',href);}
}

export async function runBoutonsPhotosLivreGardesTests({eq,ok}){
 const click=HTMLInputElement.prototype.click,langue=getUiLocale(),href=location.href,state=history.state;
 HTMLInputElement.prototype.click=function(){if(this.type!=='file')return click.call(this);};setUiLocale('fr');
 try{
  // Changer la base pendant le choix ne doit adopter ni écrire dans la nouvelle.
  await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),root=await renderBook({id:edition.id},{nouveau:'1',panel:'index'},await getData(true),{navigate:()=>{},toast:()=>{}});document.body.append(root);
   try{cible(root,'index','photo').click();await attendre(()=>dernier());const input=dernier();await tick();const avant=await db.getSnapshot(magasins);
    await withRepo(async(_r,autre)=>{await seed(autre);const neuf=await autre.getSnapshot(magasins);remettre(input,[await jpeg()]);await root.attendrePhotos();eq(await autre.getSnapshot(magasins),neuf,'Photo livre : autre base jamais adoptée après choix');});
    eq(await db.getSnapshot(magasins),avant,'Photo livre : ancienne base intacte après changement');
   }finally{root.dispose();root.remove();}
  });
  // Un refus de capture est observé même si le sélecteur reste ouvert puis est annulé.
  await withRepo(async(repo,db)=>{
   const {edition}=await seed(db);let rejeter,appels=0;const capture=new Promise((_r,j)=>rejeter=j);
   const root=await renderBook({id:edition.id},{nouveau:'1',panel:'index'},await getData(true),{capturerEdition:()=>{appels++;return capture;},toast:()=>{}});document.body.append(root);
   try{const avant=await db.getSnapshot(magasins);cible(root,'index','photo').click();ok(!!dernier(),'Photo livre : sélecteur ouvert malgré capture en attente');rejeter(Error('lecture refusée'));await tick();dernier().dispatchEvent(new Event('cancel'));await root.attendrePhotos();eq(appels,1,'Photo livre : aucune recapture après annulation');eq(await db.getSnapshot(magasins),avant,'Photo livre : capture refusée annulée sans écriture');}
   finally{root.dispose();root.remove();}
  });
  // Une sélection ancienne ne revient pas après une nouvelle tentative annulée.
  for(const phase of ['capture','image'])await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),{capturerEdition}=await import('../src/ui/recette-garde.js'),{poserCouverture}=await import('../src/ui/livre-ajout.js');let liberer,atteinte=false,appels=0;const porte=new Promise(r=>liberer=r);
   const deps={refresh:()=>{},toast:()=>{},...(phase==='capture'?{capturerEdition:async(...args)=>{const c=await capturerEdition(...args);appels++;if(appels===1){atteinte=true;await porte;}return c;}}:{poserCouverture:async(...args)=>{const image=await poserCouverture(...args);atteinte=true;await porte;return image;}})};
   const root=await renderBook({id:edition.id},{nouveau:'1',panel:'index'},await getData(true),deps);document.body.append(root);
   try{const avant=await db.getSnapshot(magasins);cible(root,'couverture','photo').click();await attendre(()=>dernier());remettre(dernier(),[await jpeg()]);await attendre(()=>atteinte);
    // Pendant la préparation de couverture, les autres entrées de pages restent disponibles.
    cible(root,'index','photo').click();await attendre(()=>dernier());dernier().dispatchEvent(new Event('cancel'));liberer();await root.attendrePhotos();
    eq(await db.getSnapshot(magasins),avant,'Photo livre : tentative '+phase+' ancienne invalidée même si le choix suivant est annulé');
   }finally{liberer();await root.attendrePhotos();root.dispose();root.remove();}
  });
  await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),{poserCouverture}=await import('../src/ui/livre-ajout.js');let liberer,atteinte=false;const porte=new Promise(r=>liberer=r);
   const root=await renderBook({id:edition.id},{nouveau:'1'},await getData(true),{refresh:()=>{},toast:()=>{},poserCouverture:async(...args)=>{const image=await poserCouverture(...args);atteinte=true;await porte;return image;}});document.body.append(root);
   try{const avant=await db.getSnapshot(magasins);cible(root,'couverture','photo').click();await attendre(()=>dernier());remettre(dernier(),[await jpeg()]);await attendre(()=>atteinte);history.replaceState(state,'','#/library?photo-garde=1');liberer();await root.attendrePhotos();eq(await db.getSnapshot(magasins),avant,'Photo livre : navigation après préparation mais avant transaction refuse image et pointeur');}
   finally{liberer();await root.attendrePhotos();history.replaceState(state,'',href);root.dispose();root.remove();}
  });
  await withRepo(async(repo,db)=>{
   const {edition}=await seed(db),root=await renderBook({id:edition.id},{nouveau:'1'},await getData(true),{toast:()=>{}});document.body.append(root);
   try{const avant=await db.getSnapshot(magasins);cible(root,'couverture','photo').click();await attendre(()=>dernier());remettre(dernier(),[new File(['invalide'],'invalide.jpg',{type:'image/jpeg'})]);await root.attendrePhotos();
    ok(root.querySelector('[data-role=etat-photo-livre]')?.textContent.includes('image'),'Photo livre : image refusée expliquée comme image');eq(root.querySelector('[data-role=reessayer-photo-livre]'),null,'Photo livre : image refusée ne propose pas une fausse réparation de stockage');eq(await db.getSnapshot(magasins),avant,'Photo livre : image refusée sans pointeur ni fichier');
   }finally{root.dispose();root.remove();}
  });
 }finally{dernier()?.dispatchEvent(new Event('cancel'));HTMLInputElement.prototype.click=click;setUiLocale(langue);history.replaceState(state,'',href);}
}
