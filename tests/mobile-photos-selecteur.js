import {pickFiles} from '../src/core/dom.js';
import {withRepo} from './sync-fixture.js';
import {getData} from '../src/ui/state.js';
import {renderImport} from '../src/ui/import.js';
import {renderLivreSansSaisieRoute} from '../src/ui/livre-sans-saisie.js';
import {creerFormulaireCuisson} from '../src/ui/cuisson.js';
import {sha256Hex} from '../src/core/hash.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

const tick=()=>new Promise(r=>setTimeout(r,0));
const attendre=async fn=>{const fin=performance.now()+1500;while(performance.now()<fin){if(await fn())return true;await tick();}return false;};
const dernier=()=>[...document.querySelectorAll('input[type=file]')].at(-1);
const bouton=(node,texte)=>[...node.querySelectorAll('button')].find(b=>b.textContent.trim()===texte);
const changer=(input,files=[])=>{Object.defineProperty(input,'files',{value:files,configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}));};
const observer=p=>{const r={termine:false,valeur:null,erreur:null};r.promise=p.then(v=>{r.termine=true;r.valeur=v;},e=>{r.termine=true;r.erreur=e;});return r;};
const vider=async()=>{for(const i of document.querySelectorAll('input[type=file]'))changer(i);await tick();};
const image=async()=>{const c=document.createElement('canvas');c.width=40;c.height=60;c.getContext('2d').fillRect(0,0,40,60);return new File([await new Promise(r=>c.toBlob(r,'image/jpeg'))],'page.jpg',{type:'image/jpeg'});};
const magasins=['books','book_editions','recipes','recipe_versions','imports','scan_sessions','source_documents','source_pages','files','cook_history','outbox'];

export async function runMobilePhotosSelecteurTests({eq,ok}){
 const langue=getUiLocale(),click=HTMLInputElement.prototype.click,scene=document.createElement('main'),href=location.href,state=history.state;let ouvertures=0,erreurClick=null;
 setUiLocale('fr');document.body.append(scene);
 // Seule la présentation système est interceptée : le helper, ses inputs, événements et consommateurs sont réels.
 HTMLInputElement.prototype.click=function(){if(this.type!=='file')return click.call(this);ouvertures++;if(erreurClick)throw erreurClick;};
 const cas=async(nom,fn)=>{try{await fn();}catch(e){ok(false,'Photos sélecteur '+nom+' : '+(e.stack||e));}finally{await vider();for(const n of scene.children)n.dispose?.();scene.replaceChildren();}};
 try{
  await cas('change et options',async()=>{
   const file=new File(['octets exacts'],'même photo.jpg',{type:'image/jpeg'}),avant=ouvertures,r=observer(pickFiles({accept:'image/*',multiple:false,capture:'environment'})),i=dernier();
   eq(ouvertures,avant+1,'Photos : ouverture synchrone sans attente ajoutée');eq([i.accept,i.multiple,i.getAttribute('capture'),i.isConnected,i.disabled],['image/*',false,'environment',true,false],'Photos : options et input connecté conservés');
   changer(i,[file]);i.dispatchEvent(new Event('cancel'));changer(i,[]);await tick();
   ok(r.termine&&r.valeur?.[0]===file,'Photos : change conserve le vrai fichier malgré cancel tardif');eq(await r.valeur[0].text(),'octets exacts','Photos : octets choisis inchangés');eq(i.isConnected,false,'Photos : input retiré après sélection');
   const second=observer(pickFiles());const j=dernier();changer(j,[file]);await tick();ok(second.valeur?.[0]===file,'Photos : même fichier sélectionnable dans un input neuf');eq(r.valeur,[file],'Photos : ouverture suivante ne modifie pas le résultat remis');
  });
  await cas('cancel et courses',async()=>{
   const r=observer(pickFiles()),i=dernier();i.dispatchEvent(new Event('cancel',{bubbles:true}));await tick();
   eq([r.termine,r.valeur],[true,[]],'Photos : annulation explicite rend un tableau vide');eq(i.isConnected,false,'Photos : input annulé retiré');changer(i,[new File(['tardif'],'tardif.jpg')]);await tick();eq(r.valeur,[],'Photos : change tardif ne ressuscite pas un choix annulé');
   const a=observer(pickFiles()),ancien=dernier(),b=observer(pickFiles()),courant=dernier();await tick();
   eq([a.termine,a.valeur,ancien.isConnected],[true,[],false],'Photos : nouvelle ouverture règle et nettoie la précédente encore pendante');eq([b.termine,courant.isConnected],[false,true],'Photos : ancienne annulation ne termine pas la nouvelle ouverture');
   ancien.dispatchEvent(new Event('cancel'));changer(ancien);await tick();eq(b.termine,false,'Photos : anciens événements ignorés par le choix courant');courant.dispatchEvent(new Event('cancel'));await tick();eq([b.termine,b.valeur],[true,[]],'Photos : nouvelle ouverture annulable séparément');
  });
  await cas('erreur ouverture',async()=>{
   erreurClick=new DOMException('ouverture refusée','NotAllowedError');const r=observer(pickFiles());await tick();
   ok(r.termine&&r.erreur===erreurClick,'Photos : erreur de déclenchement rejetée sans la masquer');eq(document.querySelectorAll('input[type=file]').length,0,'Photos : erreur de déclenchement nettoie l’input');erreurClick=null;
   const suivant=observer(pickFiles()),i=dernier();changer(i);await tick();eq([suivant.termine,suivant.valeur],[true,[]],'Photos : ouverture suivante possible après une erreur');
  });
  for(const action of ['close','retrait-dialogue','retrait-declencheur'])await cas(action,async()=>{
   const dlg=document.createElement('dialog'),b=document.createElement('button');b.textContent='Choisir';dlg.append(b);scene.append(dlg);dlg.showModal();b.focus();const r=observer(pickFiles()),i=dernier();
   if(action==='close')dlg.close();else if(action==='retrait-dialogue')dlg.remove();else b.remove();await tick();await tick();
   eq([r.termine,r.valeur],[true,[]],'Photos : '+action+' termine le choix de cette origine');eq(i.isConnected,false,'Photos : '+action+' nettoie l’input');dlg.remove();
  });
  await cas('dialogue conservé et suspension',async()=>{
   const dlg=document.createElement('dialog'),b=document.createElement('button');dlg.append(b);scene.append(dlg);dlg.showModal();b.focus();const r=observer(pickFiles()),i=dernier();
   dlg.addEventListener('cancel',e=>e.preventDefault());dlg.dispatchEvent(new Event('cancel',{cancelable:true}));
   window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));await tick();
   eq([r.termine,i.isConnected],[false,true],'Photos : focus, arrière-plan, pagehide et fermeture refusée ne jettent pas une photo en attente');
   const ajout=document.createElement('p');scene.append(ajout);await tick();eq(r.termine,false,'Photos : mutation DOM sans retrait de l’origine ne termine rien');
   changer(i);await tick();eq([r.termine,r.valeur],[true,[]],'Photos : sélection vide reste une fin normale après suspension');dlg.close();dlg.remove();
  });
  for(const event of ['hashchange','popstate','cuisineos:replace'])await cas(event,async()=>{
   const r=observer(pickFiles()),i=dernier();window.dispatchEvent(new Event(event));await tick();eq(r.termine,false,'Photos : '+event+' sans adresse différente conserve le choix');
   history.replaceState(history.state,'','#/test-photo-'+event);window.dispatchEvent(new Event(event));await tick();
   eq([r.termine,r.valeur,i.isConnected],[true,[],false],'Photos : navigation '+event+' annule et nettoie le choix abandonné');history.replaceState(state,'',href);
  });
  await cas('bilan cuisson',async()=>withRepo(async(repo,db)=>{
   const f=creerFormulaireCuisson({recipe:{id:'photo-r',original_title:'Pain'},version:{id:'photo-v'},servings:2},{repo});scene.append(f.root);const before=await db.getSnapshot(magasins),b=bouton(f.root,'Ajouter une photo de mon plat');b.focus();b.click();const i=dernier();
   ok(f.occupe(),'Photos cuisson : préparation effectivement réservée avant annulation');i.dispatchEvent(new Event('cancel'));await tick();
   eq([f.occupe(),b.disabled],[false,false],'Photos cuisson : annulation libère la préparation et le bouton');const n=ouvertures;b.click();eq(ouvertures,n+1,'Photos cuisson : second geste ouvre réellement le helper');if(dernier())changer(dernier());await tick();
   eq(await db.getSnapshot(magasins),before,'Photos cuisson : aucune écriture ni outbox sur annulation');f.detruire();
  }));
  await cas('livre',async()=>withRepo(async(repo,db)=>{
   let appels=0;const root=await renderLivreSansSaisieRoute({}, {}, {books:[]}, {repo,enLigne:()=>false,fetch:async()=>{appels++;throw Error('interdit');},remplacerAdresse:()=>{},toast:()=>{}});scene.append(root);const before=await db.getSnapshot(magasins),b=root.querySelector('[data-role=photo-livre]');b.focus();b.click();await attendre(()=>dernier());const i=dernier();i.dispatchEvent(new Event('cancel'));await tick();await tick();
   eq(i.isConnected,false,'Photos livre : input annulé nettoyé');const n=ouvertures;b.click();await tick();await tick();eq(ouvertures,n+1,'Photos livre : bouton actif ouvre de nouveau après annulation');if(dernier())changer(dernier());await tick();
   eq([await db.getSnapshot(magasins),appels],[before,0],'Photos livre : aucun brouillon, fichier, envoi ou appel créé par annulation');root.dispose();
  }));
  await cas('séance réelle',async()=>withRepo(async(repo,db)=>{
   const file=await image(),sha=await sha256Hex(file),page={id:'photo-page',edition_id:null,document_id:'photo-doc',sha256:sha,rotation:0,position:1,printed_page:1,kind:'recette'},doc={id:'photo-doc',edition_id:null,scan_session_id:'photo-session',source_type:'photo',sha256:sha,size:file.size,mime:file.type,original_filename:file.name,captured_at:'2026-10-31T12:00:00.000Z'},session={id:'photo-session',edition_id:null,status:'open',page_ids:[page.id],document_ids:[doc.id],recipe_ids:[],started_at:'2026-10-31T12:00:00.000Z',device_id:repo.deviceId()};
   await db.mutate({origin:'remote',puts:{source_pages:[page],source_documents:[doc],scan_sessions:[session],files:[{sha256:sha,blob:file,mime:file.type}]}});
   const root=await renderImport({}, {session:session.id},await getData(true));scene.append(root);const before=await db.getSnapshot(magasins),b=bouton(root,'+ Photographier');b.focus();b.click();await attendre(()=>dernier());const i=dernier();
   ok(b.disabled,'Photos séance : vraie garde occupée atteinte');i.dispatchEvent(new Event('cancel'));await tick();await tick();eq([b.disabled,bouton(root,'Terminer la séance').disabled],[false,false],'Photos séance : annulation rend les gestes de séance');
   const n=ouvertures;b.click();await attendre(()=>ouvertures>n);eq(ouvertures,n+1,'Photos séance : nouveau choix après annulation');if(dernier())changer(dernier());await tick();await tick();
   eq(await db.getSnapshot(magasins),before,'Photos séance : pages, séance, fichiers et file conservés exactement');root.dispose();
  }));
 }finally{erreurClick=null;await vider();history.replaceState(state,'',href);scene.remove();HTMLInputElement.prototype.click=click;setUiLocale(langue);}
}
