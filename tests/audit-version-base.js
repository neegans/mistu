import {Database} from '../src/core/db.js';
import {DB_VERSION,STORES} from '../src/model/schema.js';
import {on} from '../src/core/bus.js';
import {remplacerRacineApplication} from '../src/core/racine-application.js';

const FR='Une version plus récente est ouverte dans un autre onglet. Recharge cette page.';
const EN='A newer version is open in another tab. Reload this page.';
const nom=()=>`audit-version-${crypto.randomUUID()}`;
const requete=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
function borner(p,raison){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(raison)),15000)})]).finally(()=>clearTimeout(timer))}
const effacer=name=>borner(requete(indexedDB.deleteDatabase(name)),'Nettoyage de la base jetable bloqué');
function attendreDOM(doc,predicate){
 let observer;
 return borner(new Promise(resolve=>{observer=new MutationObserver(()=>{const value=predicate();if(value)resolve(value)});const value=predicate();if(value)return resolve(value);observer.observe(doc,{childList:true,subtree:true,attributes:true});}), 'La vraie vue attendue ne s’est pas montée').finally(()=>observer?.disconnect());
}
async function preparer(name,version=DB_VERSION,langue='fr'){
 const db=new Database(name,version,STORES);await db.open();
 await db.mutate({origin:'device',puts:{books:[{id:'sentinelle',title:'Livre intact'}],settings:[{key:'ui_locale',value:langue}],sync_state:[{key:'porte_entree',value:{choix:'sans_compte',at:'2026-10-30T10:00:00.000Z'}}]}});
 db.idb.close();db.idb=null;
}
async function lireLivre(connection){return requete(connection.transaction('books').objectStore('books').get('sentinelle'))}
function ferme(connection){try{connection.transaction('books');return false}catch(e){return e.name==='InvalidStateError'}}
function attendrePreparation(frame,name){
 let verifier;
 const attente=new Promise((resolve,reject)=>{
  verifier=()=>{
   const win=frame.contentWindow,doc=win?.document,f=win?.fixture,erreur=win?.fixtureErreur;
   if(erreur?.name===name)return reject(Error('Préparation du cadre refusée : '+erreur.message));
   if(f?.name===name&&f.documentInitial===doc&&doc.readyState==='complete')resolve({win,doc,f});
  };
  for(const event of ['load','audit-pret','audit-echec'])frame.addEventListener(event,verifier);
  verifier();
 });
 return borner(attente,'Préparation du cadre non terminée').finally(()=>{for(const event of ['load','audit-pret','audit-echec'])frame.removeEventListener(event,verifier)});
}

// Le module métier est importé DANS le cadre, après bindDatabase : jamais sur la base personnelle.
async function cadre({langue='fr-CA',preference='fr',plusRecente=false}={}){
 const name=nom();await preparer(name,DB_VERSION+(plusRecente?1:0),preference);
 const url=new URL('./fixtures/version-base.html',import.meta.url),frame=document.createElement('iframe');
 url.searchParams.set('base',name);url.searchParams.set('langue',langue);
 frame.title='Démarrage isolé pour la version de la base';frame.style.cssText='width:700px;height:500px;border:0';
 frame.src=url.href;
 let chargements=0;frame.addEventListener('load',()=>chargements++);
 const pret=attendrePreparation(frame,name);document.body.append(frame);
 try{
  const {win,doc,f}=await pret;
  await attendreDOM(doc,()=>doc.querySelector('#app > .danger')||doc.querySelector('#main input[type=search]')&&!doc.querySelector('#main[aria-busy]'));
  if(!plusRecente&&doc.querySelector('#app > .danger'))throw Error('Échec du boot sain : '+JSON.stringify(f.erreurs));
  if(!plusRecente){
   // Le routeur finit réellement son premier montage en focalisant le titre, après ses mesures.
   const titre=doc.querySelector('#main h1');let focalise;
   await borner(new Promise(resolve=>{focalise=()=>{if(doc.activeElement===titre)resolve()};doc.addEventListener('focusin',focalise);focalise()}),'Présentation initiale sans focus').finally(()=>doc.removeEventListener('focusin',focalise));
  }
  return{frame,win,doc,f,name,chargements:()=>chargements,async fermer(){f.db.idb?.close();frame.remove();await borner(requete(indexedDB.deleteDatabase(name)),'Suppression du cadre bloquée')}};
 }catch(error){const f=frame.contentWindow?.fixture,detail=JSON.stringify({erreurs:f?.erreurs,exceptions:f?.exceptions,texte:frame.contentDocument?.body.textContent.slice(0,300)});f?.db.idb?.close();frame.remove();await borner(requete(indexedDB.deleteDatabase(name)),'Nettoyage du cadre bloqué');throw Error(error.message+' '+detail)}
}

export async function runAuditVersionBaseTests({eq,ok}){
 // Vrai VersionError natif, pas une promesse artificiellement rejetée.
 {
  const name=nom();await preparer(name,DB_VERSION+1);const db=new Database(name,DB_VERSION,STORES),events=[];
  const stop=on('versionchange_bloquee',event=>events.push(event));let error;
  try{try{await db.open()}catch(e){error=e}
   eq(error?.name,'VersionError','9.5 : erreur native de version conservée');
   ok(error instanceof DOMException,'9.5 : exception IndexedDB originale relancée');
   eq(events.length,1,'9.5 : VersionError signalé avant rejet');ok(events[0]?.db===db,'9.5 : événement porte l’instance exacte');
   eq(db.idb,null,'9.5 : aucune connexion fictive après refus');
   const actuelle=await requete(indexedDB.open(name,DB_VERSION+1));eq(await lireLivre(actuelle),{id:'sentinelle',title:'Livre intact'},'9.5 : base plus récente intacte');actuelle.close();
  }finally{stop();db.idb?.close();await effacer(name)}
 }
 // Chaque connexion ouverte concurremment doit se fermer, même si this.idb pointe ailleurs.
 {
  const name=nom();await preparer(name);const db=new Database(name,DB_VERSION,STORES),events=[],errors=[];
  const stop=on('versionchange_bloquee',e=>events.push(e));
  const erreur=e=>{if(e.error?.name==='TypeError'&&/close/.test(e.message)){errors.push(e.error.name);e.preventDefault()}};window.addEventListener('error',erreur);
  let connexions=[],nouvelle;
  try{
   connexions=await Promise.all([db.open(),db.open()]);ok(connexions.every(c=>c.version===DB_VERSION),'9.5 : deux appels natifs ont réellement ouvert');
   const request=indexedDB.open(name,DB_VERSION+1),fin=requete(request),issue=await borner(new Promise((resolve,reject)=>{request.addEventListener('success',()=>resolve('ouverte'));request.addEventListener('blocked',()=>resolve('bloquee'));request.addEventListener('error',()=>reject(request.error))}),'Upgrade concurrent sans issue');
   eq(issue,'ouverte','9.5 : upgrade aboutit sans fermeture de secours');
   eq(connexions.map(ferme),[true,true],'9.5 : chaque handle ancien est fermé');
   eq(errors,[],'9.5 : aucune fermeture du mauvais handle nul');
   ok(events.length>0&&events.every(e=>e.db===db),'9.5 : upgrade associé à la bonne instance');
   eq(db.idb,null,'9.5 : dernière connexion invalidée retirée de l’instance');
   // Nettoyage également possible sur le rouge : ne pas laisser une requête bloquée dans la suite.
   connexions.forEach(c=>c.close());nouvelle=await borner(fin,'Upgrade non libéré');eq(await lireLivre(nouvelle),{id:'sentinelle',title:'Livre intact'},'9.5 : upgrade conserve le contenu');
  }finally{stop();window.removeEventListener('error',erreur);connexions.forEach(c=>c.close());nouvelle?.close();await effacer(name)}
 }
 // onblocked est une attente réelle. Une suppression (newVersion:null) n’annonce pas une version supérieure.
 {
  const name=nom();await preparer(name);const ancien=await requete(indexedDB.open(name,DB_VERSION)),db=new Database(name,DB_VERSION+1,STORES),events=[];
  const stop=on('versionchange_bloquee',e=>events.push(e)),open=indexedDB.open;let debloquer,ouverte,terminee=false;
  const bloquee=new Promise(resolve=>debloquer=resolve);
  try{
   indexedDB.open=function(...args){const r=open.apply(this,args);r.addEventListener('blocked',debloquer,{once:true});return r};
   const attente=db.open().then(c=>{terminee=true;return c},e=>{terminee=true;throw e});indexedDB.open=open;
   await borner(bloquee,'Le vrai blocage IndexedDB n’a pas été atteint');
   eq(terminee,false,'9.5 : onblocked ne rejette ni ne termine open');eq(events.length,0,'9.5 : attente sans faux VersionError');
   ancien.close();ouverte=await borner(attente,'Ouverture non reprise après libération');eq(ouverte.version,DB_VERSION+1,'9.5 : ouverture continue après libération');
   let newVersion='absent';ouverte.addEventListener('versionchange',event=>newVersion=event.newVersion);
   await borner(requete(indexedDB.deleteDatabase(name)),'Suppression native bloquée');
   eq(newVersion,null,'9.5 : suppression native réellement reçue');ok(ferme(ouverte),'9.5 : suppression ferme la connexion');eq(db.idb,null,'9.5 : suppression invalide le handle courant');eq(events.length,0,'9.5 : suppression sans faux avis de version supérieure');
  }finally{indexedDB.open=open;stop();ancien.close();ouverte?.close();await effacer(name)}
 }
 // Boot réel : la base est déjà trop récente, la langue vient du navigateur avant tout accès aux réglages.
 for(const langue of ['fr-CA','en-CA']){
  const s=await cadre({langue,plusRecente:true});
  try{
   const avis=s.doc.querySelector('[data-role=bandeau-version]');
   eq(avis?.textContent,langue==='en-CA'?EN:FR,`9.5 boot ${langue} : avis dans la langue du navigateur`);
   eq(s.doc.querySelectorAll('[data-role=bandeau-version]').length,1,`9.5 boot ${langue} : avis unique conservé par le catch`);
   ok(!!avis&&s.doc.getElementById('app').firstElementChild===avis,`9.5 boot ${langue} : avis avant l’erreur`);
   eq(s.f.erreurs,[{code:'[cuisine-os] boot',name:'VersionError'}],`9.5 boot ${langue} : seul journal attendu exact`);
   eq(s.f.exceptions,[],`9.5 boot ${langue} : aucune exception non gérée`);
   eq([s.win.supabase,!!s.doc.querySelector('meta[name=mistu-release]'),s.chargements()],[undefined,false,1],`9.5 boot ${langue} : sans SDK, worker ni rechargement`);
  }finally{await s.fermer()}
 }
 // Boot sain navigateur EN, préférence FR. L’upgrade arrive pendant une saisie sur la vraie route.
 {
  const s=await cadre({langue:'en-CA',preference:'fr'});let plusRecente;
  try{
   const input=s.doc.querySelector('#main input[type=search]'),original=s.doc;
   eq(s.doc.documentElement.lang,'fr-CA','9.5 : préférence FR prioritaire sur navigateur EN');
   eq(await s.f.repo.db.get('settings','ui_locale'),{key:'ui_locale',value:'fr'},'9.5 : préférence lue sans réécriture');
   eq(input.getAttribute('placeholder'),'Qu’est-ce qu’on cuisine ?','9.5 : vraie route en français');
   s.f.bus.emit('versionchange_bloquee',{db:new Database(s.name,DB_VERSION,STORES)});
   eq(s.doc.querySelectorAll('[data-role=bandeau-version]').length,0,'9.5 : autre instance de même nom ignorée');
   input.value='Ma saisie reste ici';input.focus();input.setSelectionRange(3,9);
   ok(s.doc.activeElement===input,'9.5 : témoin focalisé avant upgrade');
   plusRecente=await borner(requete(indexedDB.open(s.name,DB_VERSION+1)),'Upgrade du vrai métier bloqué');
   const avis=s.doc.querySelector('[data-role=bandeau-version]');
   eq(avis?.textContent,FR,'9.5 : vrai upgrade affiche le bandeau français');
   ok(s.doc.querySelector('#main input[type=search]')===input,'9.5 : même champ après notification');
   eq([input.value,s.doc.activeElement===input,input.selectionStart,input.selectionEnd],['Ma saisie reste ici',true,3,9],'9.5 : saisie, focus et sélection conservés');
   eq([s.chargements(),s.frame.contentDocument===original],[1,true],'9.5 : aucun document rechargé');
   s.f.bus.emit('versionchange_bloquee',{db:s.f.db});s.f.bus.emit('versionchange_bloquee',{db:s.f.db});
   eq(s.doc.querySelectorAll('[data-role=bandeau-version]').length,1,'9.5 : notifications répétées sans doublon');
   ok(!!avis&&s.doc.querySelector('[data-role=bandeau-version]')===avis,'9.5 : même nœud avis après répétition');
   eq(s.f.erreurs,[],'9.5 : upgrade sain sans erreur de démarrage');eq(s.f.exceptions,[],'9.5 : upgrade sain sans exception');
  }finally{plusRecente?.close();await s.fermer()}
 }
 // Le même chemin de remplacement est partagé par porte, coquille et erreur fatale.
 {
  const app=document.createElement('div'),demarrage=document.createElement('p'),avis=document.createElement('p');
  demarrage.dataset.role='demarrage-non-verifie';avis.dataset.role='bandeau-version';app.append(demarrage,avis);
  for(const nom of ['porte','coquille','erreur']){const contenu=document.createElement('section');contenu.dataset.test=nom;remplacerRacineApplication(app,contenu);eq([...app.children].map(n=>n.dataset.role||n.dataset.test),['demarrage-non-verifie','bandeau-version',nom],`9.5 : ${nom} conserve les deux avis en tête`);ok(app.children[0]===demarrage&&app.children[1]===avis,`9.5 : ${nom} conserve les nœuds des avis`)}
 }
}
