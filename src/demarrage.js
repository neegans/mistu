import {creerControleLivraison,installerControleLivraison} from './core/livraison.js';
import {normaliserPorteeLivraison,releaseValide} from './core/livraison-format.js';

// Frontière avant application : pas de DB, de traduction, de fournisseur ou de données métier.
function attendreInstallation(registration,delai){
 if(registration.active?.state==='activated')return Promise.resolve();
 return new Promise(resolve=>{const ecoutes=new Set();let fini=false,timer;
  const fin=()=>{if(fini)return;fini=true;clearTimeout(timer);registration.removeEventListener('updatefound',voir);for(const w of ecoutes)w.removeEventListener('statechange',voir);resolve()};
  const voir=()=>{for(const w of [registration.active,registration.installing,registration.waiting])if(w&&!ecoutes.has(w)){ecoutes.add(w);w.addEventListener('statechange',voir)}if(registration.active?.state==='activated'||ecoutes.size&&[...ecoutes].every(w=>w.state==='redundant'))fin()};
  registration.addEventListener('updatefound',voir);timer=setTimeout(fin,delai);voir();
 });
}
function element(doc,tag,texte){const n=doc.createElement(tag);if(texte)n.textContent=texte;return n}
function borner(promesse,delai){return new Promise(resolve=>{const timer=setTimeout(()=>resolve(null),delai);Promise.resolve(promesse).then(x=>{clearTimeout(timer);resolve(x)},()=>{clearTimeout(timer);resolve(null)})})}
async function chargerMetierParDefaut({document:doc,baseURL,avantImport}){
 const charger=(tag,attributs)=>new Promise((resolve,reject)=>{const node=doc.createElement(tag);Object.assign(node,attributs);node.onload=resolve;node.onerror=()=>reject(Error('ressource_indisponible'));doc.head.append(node)});
 for(const[rel,href,type]of [['manifest','manifest.webmanifest'],['icon','icons/icon.svg','image/svg+xml'],['apple-touch-icon','icons/apple-touch-icon.png']]){const lien=doc.createElement('link');Object.assign(lien,{rel,href:new URL(href,baseURL).href});if(type)lien.type=type;doc.head.append(lien)}
 await Promise.all([charger('link',{rel:'stylesheet',href:new URL('styles.css',baseURL).href}),charger('script',{src:new URL('src/vendor/supabase-2.117.3.umd.js',baseURL).href})]);
 await avantImport();await import('./app.js');
}
export async function demarrerApplication({document:doc=globalThis.document,baseURL=new URL('../',import.meta.url).href,location=globalThis.location,sessionStorage,serviceWorker=globalThis.navigator?.serviceWorker,langue=globalThis.navigator?.language,MessageChannel=globalThis.MessageChannel,delaiMs,delaiInstallation=15000,chargerMetier=chargerMetierParDefaut}={}){
 const base=normaliserPorteeLivraison(baseURL),release=doc?.querySelector('meta[name="mistu-release"]')?.content;
 if(!releaseValide(release))throw Error('livraison_incompatible');
 if(sessionStorage===undefined){try{sessionStorage=globalThis.sessionStorage}catch{sessionStorage=null}}
 const app=doc.getElementById('app'),cle='mistu-demarrage-v1:'+base;
 const controle=creerControleLivraison({releasePage:release,baseURL:base,serviceWorker,MessageChannel,delaiMs});
 let monte=false,enCours=false,admis=null,registration=null;
 // t() dépend du métier, encore interdit à cette frontière : seules les deux langues de démarrage sont locales.
 const texte=(fr,en)=>String(langue||'').toLowerCase().startsWith('en')?en:fr;
 const resultat={etat:'verification',controle,reprendre,continuerEnLigne:()=>monter('en_ligne_non_verifiee')};
 const presenter=(message,choix=false)=>{if(!app)return;const titre=element(doc,'h1',texte('Démarrage de Mistu','Starting Mistu')),paragraphe=element(doc,'p',message);app.replaceChildren(titre,paragraphe);app.setAttribute('aria-busy',choix?'false':'true');if(choix){const reprendreBouton=element(doc,'button',texte('Reprendre le démarrage','Restart Mistu')),ligneBouton=element(doc,'button',texte('Continuer en ligne','Continue online'));reprendreBouton.type=ligneBouton.type='button';reprendreBouton.onclick=reprendre;ligneBouton.onclick=()=>void resultat.continuerEnLigne();app.append(reprendreBouton);if(admis!=='controlee')app.append(ligneBouton)}};
 function reprendre(){if(resultat.etat==='montee'||enCours)return;try{sessionStorage?.setItem(cle,'1')}catch{}location.reload()}
 function autoReprise(){try{if(!sessionStorage||sessionStorage.getItem(cle)==='1')return false;sessionStorage.setItem(cle,'1')}catch{return false}resultat.etat='reprise';presenter(texte('La livraison est prête. Reprise du démarrage…','The release is ready. Restarting Mistu…'));location.reload();return true}
 async function verifierStable(){
  let observation=await controle.verifier();
  if(observation.etat==='inconnue'&&observation.raison==='worker_change'){
   if(registration)await attendreInstallation(registration,delai);
   observation=await controle.verifier();
  }
  return observation;
 }
 async function monter(mode,preuve){
  if(monte||enCours)return resultat;enCours=true;
  try{
   if(admis&&admis!==mode)throw Error('execution_incompatible');
   if(mode==='controlee'){
    if(!controle.estCourante(preuve))throw Error('worker_change');
    installerControleLivraison(controle,{mode,manifest_sha256:preuve.controleur.manifest_sha256});
   }else installerControleLivraison(controle,{mode,manifest_sha256:null});
   admis=mode;await controle.verifier();
   if(mode==='en_ligne_non_verifiee'&&app){const avis=element(doc,'p',texte('Mistu s’ouvre en ligne. L’installation hors ligne sera réessayée au prochain lancement.','Mistu opens online. Offline installation will be retried at the next launch.'));avis.dataset.role='demarrage-non-verifie';avis.className='muted';app.replaceChildren(avis)}
   await chargerMetier({document:doc,baseURL:base,avantImport:async()=>{if(mode==='controlee'){const actuel=await verifierStable();if(actuel.etat!=='verifiee'||!controle.estCourante(actuel))throw Error('worker_change');try{sessionStorage?.removeItem(cle)}catch{}}monte=true;app?.removeAttribute('aria-busy');}});
   resultat.etat='montee';return resultat;
  }catch{resultat.etat='choix';presenter(admis==='controlee'?texte('Cette livraison ne peut pas être ouverte pour le moment. Reprenez le démarrage.','This release cannot be opened right now. Restart Mistu.'):texte('Le démarrage n’a pas pu terminer. Vous pouvez reprendre ou continuer en ligne.','Mistu could not finish starting. You can restart or continue online.'),true);return resultat}
  finally{enCours=false}
 }
 presenter(texte('Vérification de la livraison de l’application…','Checking the application release…'));
 const delai=Number.isFinite(delaiInstallation)?Math.max(1,Math.min(30000,delaiInstallation)):15000;
 if(!serviceWorker?.register)return monter('en_ligne_non_verifiee');
 let refuse=false;
 try{registration=await borner(Promise.resolve(serviceWorker.register(new URL('sw.js',base).href,{scope:base,updateViaCache:'none'})).catch(()=>{refuse=true;return null}),delai);if(registration)await attendreInstallation(registration,delai)}catch{refuse=true}
 if(refuse)return monter('en_ligne_non_verifiee');
 const observation=await verifierStable();
 if(controle.estCourante(observation)&&observation.controleur?.complete&&observation.controleur.release===release){await monter('controlee',observation);return resultat}
 if(controle.estCourante(observation)&&((!observation.controleur&&observation.actif?.complete&&observation.actif.release===release)||(observation.controleur?.complete&&observation.controleur.release!==release))&&autoReprise())return resultat;
 resultat.etat='choix';presenter(texte('La livraison hors ligne n’est pas vérifiée. Fermez les anciens onglets puis reprenez le démarrage, ou continuez en ligne sans cette garantie.','The offline release is not verified. Close older tabs and restart Mistu, or continue online without this guarantee.'),true);return resultat;
}
if(globalThis.document?.querySelector('meta[name="mistu-release"]'))void demarrerApplication().catch(()=>{const app=document.getElementById('app');if(app){app.textContent='Le démarrage est indisponible. Rechargez cette page pour réessayer.';app.setAttribute('aria-busy','false')}});
