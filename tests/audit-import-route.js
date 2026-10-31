import {supprimerBase} from './backup.js';
import {CLE_ENTREE_NAV} from '../src/core/router.js';
const attendre=async(fn,nom)=>{const fin=performance.now()+15000;while(!fn()){if(performance.now()>fin)throw Error('Attente dépassée : '+nom);await new Promise(r=>setTimeout(r,10));}};
const bouton=(doc,nom)=>[...doc.querySelectorAll('button')].find(b=>b.textContent===nom);
const instant=async()=>{await new Promise(r=>setTimeout(r,30));};

export async function runAuditImportRouteTests({eq,ok}){
 const avecApp=async(hash,nom,fn)=>{
  const name='audit-import-route-'+crypto.randomUUID(),frame=document.createElement('iframe');frame.title='Navigation import '+nom;frame.style.cssText='width:390px;height:800px';
  const url=new URL('./fixtures/import-route.html',import.meta.url);url.searchParams.set('base',name);url.hash=hash;frame.src=url.href;document.body.append(frame);
  try{
   await attendre(()=>frame.contentWindow?.fixtureErreur||frame.contentWindow?.fixture?.name===name&&!!frame.contentDocument.querySelector('main')&&!frame.contentDocument.querySelector('main').hasAttribute('aria-busy'),nom+' app prête');
   const w=frame.contentWindow,d=frame.contentDocument,f=w.fixture;if(w.fixtureErreur)throw Error(w.fixtureErreur.message);
   await fn({w,d,f});eq(f.exceptions,[],`Import11.6 ${nom} : aucune exception navigateur`);eq([f.posts,f.choixFichier],[0,0],`Import11.6 ${nom} : aucun POST ni choix de fichier automatique`);
  }catch(e){ok(false,`Import11.6 ${nom} : ${e.stack||e}`);}finally{frame.contentWindow?.fixture?.fermer();frame.remove();await supprimerBase(name);}
 };
 const fini=d=>!!d.querySelector('main')&&!d.querySelector('main').hasAttribute('aria-busy');
 const snapshot=f=>f.db.getSnapshot(['recipes','recipe_versions','scan_sessions','source_pages','source_documents','imports','outbox']);
 for(const hash of ['#/import','#/import?session='])await avecApp(hash,'entrée '+hash,async({w,d,f})=>{
  eq(w.location.hash,'#/add','Import11.6 : lien nu ou séance vide redirigé vers Ajouter');eq(d.querySelector('main h1')?.textContent,'Ajouter','Import11.6 : vraie vue Ajouter montée');eq(f.vueImporter,[],'Import11.6 : ancienne liste Importer jamais montée');
  eq((await f.db.getAll('scan_sessions')).map(s=>s.id),[f.sessionId],'Import11.6 : aucune séance créée par la redirection');
 });
 await avecApp('#/library','historique',async({w,d,f})=>{
  const avant=await snapshot(f),cle=w.history.state[CLE_ENTREE_NAV],cleNative=w.navigation?.currentEntry?.key,pushState=w.history.pushState;let poussees=0;
  w.history.pushState=function(...args){poussees++;return pushState.apply(this,args);};
  w.history.replaceState({...w.history.state,etranger:{garder:7}},'',w.location.href);
  // Reproduit l’entrée neuve dont le navigateur a copié le state précédent.
  w.history.pushState({...w.history.state},'', '#/import');w.dispatchEvent(new w.HashChangeEvent('hashchange'));await attendre(()=>fini(d)&&['Ajouter','Importer'].includes(d.querySelector('main h1')?.textContent),'navigation import terminée');
  const entree=w.history.state[CLE_ENTREE_NAV];eq(w.location.hash,'#/add','Import11.6 : navigation canonique');// history.length plafonne dans Chrome après de nombreux cadres : prouver
  // l’adjacence réelle des entrées, sans supposer une longueur absolue.
  const natives=w.navigation?.entries?.();
  if(natives)eq([natives.slice(-2).map(e=>e.key),w.navigation.currentEntry?.key===natives.at(-1)?.key,w.navigation.currentEntry?.key!==cleNative],[[cleNative,w.navigation.currentEntry?.key],true,true],'Import11.6 : une seule entrée, directement après la précédente');
  else eq(poussees,1,'Import11.6 : une seule insertion explicite, puis Retour et Avance exacts');
  w.history.pushState=pushState;
  ok(entree.cle!==cle.cle&&entree.position===cle.position+1,'Import11.6 : state hérité ne réutilise pas la clé précédente');eq(entree.href,'#/add','Import11.6 : métadonnée de l’entrée canonique');eq(w.history.state.etranger,{garder:7},'Import11.6 : clés étrangères de history.state conservées');
  w.history.back();await attendre(()=>w.location.hash==='#/library'&&fini(d)&&d.querySelector('main h1')?.textContent==='Bibliothèque','Retour Bibliothèque');eq(w.history.state[CLE_ENTREE_NAV].cle,cle.cle,'Import11.6 : Retour à la clé précédente exacte');
  w.history.forward();await attendre(()=>fini(d)&&['Ajouter','Importer'].includes(d.querySelector('main h1')?.textContent),'Avance import');eq(w.location.hash,'#/add','Import11.6 : Avance reste canonique sans boucle');eq(w.history.state[CLE_ENTREE_NAV].cle,entree.cle,'Import11.6 : Avance retrouve la même entrée');
  eq(await snapshot(f),avant,'Import11.6 : navigation/historique sans mutation métier');
 });
 await avecApp('#/library','séances exactes',async({w,d,f})=>{
  const avant=await snapshot(f),cible='/import?session='+encodeURIComponent(f.sessionId)+'&origine=origine-inconnue&preuve=conservee';
  f.router.navigate(cible);await attendre(()=>fini(d)&&d.querySelector('main h1')?.textContent==='Séance de scan','séance existante');
  eq(w.location.hash,'#'+cible,'Import11.6 : identifiant encodé et paramètres existants inchangés');ok(d.querySelector('main').textContent.includes('Séance de scan'),'Import11.6 : vraie séance rendue');
  f.router.navigate('/import?session='+encodeURIComponent('absente/+é'));await attendre(()=>fini(d)&&d.querySelector('main').textContent.includes('Séance introuvable.'),'séance inconnue');
  eq(w.location.hash,'#/import?session='+encodeURIComponent('absente/+é'),'Import11.6 : séance inconnue garde son adresse');ok(!d.querySelector('main').textContent.includes('Ajouter une recette'),'Import11.6 : refus de séance sans redirection silencieuse');
  eq(await snapshot(f),avant,'Import11.6 : consultation de séance sans mutation métier');
  const direct=await f.importUI.renderImport({}, {},await f.state.getData(true));
  ok(direct.textContent.includes('Séances à reprendre'),'Import11.6 : renderImport direct conserve la liste historique');direct.dispose?.();
 });
 for(const quota of [true,false])await avecApp('#/library','éditeur '+quota,async({w,d,f})=>{
  f.router.navigate('/recipes/'+encodeURIComponent(f.recipe.id)+'/edit');await attendre(()=>fini(d)&&!!d.querySelector('[data-role=editeur-display_title]'),'éditeur réel');
  const root=d.querySelector('.editeur-recette'),champ=d.querySelector('[data-role=editeur-display_title]'),adresse=w.location.hash,cle=w.history.state[CLE_ENTREE_NAV].cle,avant=await snapshot(f);
  f.quota=quota;champ.value='Saisie personnelle conservable';champ.dispatchEvent(new w.Event('input',{bubbles:true}));champ.focus();
  f.router.navigate('/import');
  if(quota){
   await attendre(()=>!!d.querySelector('[data-role=sortie-editeur]'),'dialogue de vraie conservation refusée');ok(f.refusQuota>=1,'Import11.6 : refus quota atteint la vraie écriture du brouillon');
   bouton(d,'Rester').click();await attendre(()=>w.location.hash===adresse&&!d.querySelector('[data-role=sortie-editeur]'),'Rester compensé');
   eq(w.history.state[CLE_ENTREE_NAV].cle,cle,'Import11.6 : Rester retrouve la clé exacte');ok(root.isConnected&&d.querySelector('.editeur-recette')===root,'Import11.6 : Rester conserve le même éditeur');eq(champ.value,'Saisie personnelle conservable','Import11.6 : saisie intacte après Rester');
   const essais=f.refusQuota,dialogues=f.dialogues.size;f.router.navigate('/import');await attendre(()=>!!d.querySelector('[data-role=sortie-editeur]'),'deuxième geste de sortie');bouton(d,'Quitter sans la conserver').click();
   await attendre(()=>!root.isConnected||f.dialogues.size>dialogues+1,'choix quitter appliqué');await instant();
   eq(f.refusQuota-essais,1,'Import11.6 : un seul flush refusé pour la décision de quitter');eq(f.dialogues.size-dialogues,1,'Import11.6 : un seul dialogue pour le geste vers Ajouter');eq(d.querySelector('[data-role=sortie-editeur]'),null,'Import11.6 : aucun deuxième choix imposé');
   eq((await f.db.getAll('sync_state')).filter(r=>r.key.startsWith('editor_draft:v1:')).length,0,'Import11.6 : aucune fausse conservation après abandon explicite');
  }else{
   await attendre(()=>!root.isConnected,'conservation puis sortie');eq(f.dialogues.size,0,'Import11.6 : conservation réussie sans dialogue');
   const drafts=(await f.db.getAll('sync_state')).filter(r=>r.key.startsWith('editor_draft:v1:'));eq(drafts.length,1,'Import11.6 : brouillon réellement conservé avant sortie');eq(drafts[0]?.value?.payload?.metadata?.display_title,'Saisie personnelle conservable','Import11.6 : saisie exacte relue dans le brouillon');
  }
  await attendre(()=>fini(d),'vue de destination terminée');eq(w.location.hash,'#/add','Import11.6 : sortie éditeur vers Ajouter');eq(d.querySelector('main h1')?.textContent,'Ajouter','Import11.6 : destination réelle après décision');eq(await snapshot(f),avant,'Import11.6 : originaux et file inchangés par conservation locale ou sortie explicite');
 });
}
