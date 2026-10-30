import { start, CLE_ENTREE_NAV } from '../src/core/router.js';
import { routeInterne } from '../src/ui/navigation-contexte.js';
const tour=()=>new Promise(r=>setTimeout(r,0));
const differe=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function navigateur(){
 const w=new EventTarget(),entries=[{state:{externe:7},hash:'#/library'}];let index=0;
 const installer=(event=true)=>{w.location.hash=entries[index].hash;if(event){w.dispatchEvent(new Event('popstate'));w.dispatchEvent(new Event('hashchange'));}};
 w.location={hash:'#/library'};w.history={get state(){return entries[index].state;},get length(){return entries.length;},replaceState(state,_,hash){entries[index]={state,hash};installer(false);},go(delta){index=Math.max(0,Math.min(entries.length-1,index+delta));installer();}};
 w.ouvrir=(hash,state=structuredClone(w.history.state))=>{entries.splice(index+1);entries.push({state,hash});index++;installer();};return w;
}
export async function runL4SortiesTests({eq,ok}){
 const run=async(nom,fn)=>{try{await fn();}catch(e){ok(false,`L4 ${nom}: ${e.stack||e}`);}};
 eq(routeInterne('/books/e?panel=modifier&draft=d'),'/books/e?panel=modifier&draft=d','L4 navigation : identité brouillon conservée dans vrai lien');
 eq(routeInterne('/add?section=brouillons'),'/add?section=brouillons','L4 navigation : liste brouillons adressable');
 await run('route attend et reste',async()=>{
  const w=navigateur(),rendus=[],attente=differe();let gardes=0;
  const stop=start(r=>rendus.push(r),{fenetre:w,avantRoute:()=>{gardes++;return attente.promise;}});
  const entree=w.history.state[CLE_ENTREE_NAV];w.ouvrir('#/books/b?panel=modifier');
  eq(rendus.length,1,'L4 sortie : ancien formulaire reste rendu pendant attente');
  eq(gardes,1,'L4 sortie : popstate/hashchange appellent une seule garde');
  attente.resolve(false);await tour();
  eq(w.location.hash,'#/library','L4 sortie : refus retrouve adresse exacte');
  eq(w.history.state[CLE_ENTREE_NAV].cle,entree.cle,'L4 sortie : refus retrouve entrée exacte');
  eq(rendus.length,1,'L4 sortie : compensation sans rerendu ni boucle');
  eq(w.history.state.externe,7,'L4 sortie : clés étrangères de history.state gardées');stop();
 });
 await run('route accepte une fois',async()=>{
  const w=navigateur(),rendus=[],attente=differe();const stop=start(r=>rendus.push(r),{fenetre:w,avantRoute:()=>attente.promise});
  w.ouvrir('#/books/b');attente.resolve(true);await tour();
  eq(rendus.map(r=>r.path),['/library','/books/b'],'L4 sortie : accord rend destination une seule fois');stop();
 });
 await run('destinations rapides',async()=>{
  const w=navigateur(),rendus=[],attentes=[];const stop=start(r=>rendus.push(r),{fenetre:w,avantRoute:()=>{const d=differe();attentes.push(d);return d.promise;}});
  const initial=w.history.state[CLE_ENTREE_NAV].cle;w.ouvrir('#/books/b');w.ouvrir('#/recipes/r');
  attentes[0].resolve(true);await tour();eq(rendus.length,1,'L4 sortie : accord ancien ne rend pas destination périmée');
  attentes[1].resolve(false);await tour();eq([w.location.hash,w.history.state[CLE_ENTREE_NAV].cle],['#/library',initial],'L4 sortie : deux demandes refusées retrouvent la bonne entrée');stop();
 });
 await run('retour pendant garde',async()=>{
  const w=navigateur(),rendus=[],attente=differe();const stop=start(r=>rendus.push(r),{fenetre:w,avantRoute:()=>attente.promise});
  w.ouvrir('#/books/b');w.history.go(-1);attente.resolve(true);await tour();
  eq([rendus.length,w.location.hash],[1,'#/library'],'L4 sortie : retour à entrée initiale annule ancienne permission');stop();
 });
 await run('entrée étrangère sans Navigation',async()=>{
  const w=navigateur(),rendus=[],stop=start(r=>rendus.push(r),{fenetre:w,avantRoute:()=>false});
  w.ouvrir('#/books/ancien',{externe:99,[CLE_ENTREE_NAV]:{cle:'etrangere',position:83,chaine:'ancienne-session',href:'#/books/ancien'}});
  eq([w.location.hash,w.history.state.externe],['#/library',7],'L4 ancien historique : adresse et état capturés rétablis sans Navigation');
  eq([w.history.length,rendus.length],[2,1],'L4 ancien historique : aucune entrée ajoutée, DOM conservé');stop();
 });
 let U;try{U=await import('../src/ui/brouillon-editeur.js');}catch(e){ok(false,'L4 contrôleur partagé absent : '+e.message);return;}
 await run('garde détachée',async()=>{
  const {protegerSortieEditeur}=await import('../src/ui/sortie-editeur.js'),root=document.createElement('section');
  const c=U.creerControleurEditeur({service:{},session:{},lirePayload:()=>({}),delai:10000});
  const nettoyer=protegerSortieEditeur({racine:root,controleur:c}),w=navigateur(),rendus=[],stop=start(r=>rendus.push(r),{fenetre:w});
  try{w.ouvrir('#/books/b');eq(rendus.map(r=>r.path),['/library','/books/b'],'L4 garde détachée : aucune attente fictive pour une ancienne vue');
   w.dispatchEvent(new Event('cuisineos:refresh'));eq(rendus.at(-1)?.navigation.type,'refresh','L4 garde détachée : actualisation ordinaire reste immédiate');
  }finally{stop();nettoyer();c.detruire();}
 });
 await run('conservation sérialisée',async()=>{
  let payload={title:'A'};const calls=[],attentes=[];
  const service={conserverBrouillon:args=>{calls.push(structuredClone(args));const d=differe();attentes.push(d);return d.promise;}};
  const c=U.creerControleurEditeur({service,session:{},lirePayload:()=>payload,delai:10000});
  c.modifier();const fin=c.flush();await tour();payload={title:'AB'};c.modifier();
  attentes[0].resolve({issue:'ok',id:'d',revision:1,saved_at:'date1'});await tour();
  eq(c.etat().sale,true,'L4 conservation : première réponse ne confirme pas la nouvelle frappe');
  eq(calls.map(x=>[x.expectedRevision,x.payload.title]),[[null,'A'],[1,'AB']],'L4 conservation : seconde écriture sérialisée avec révision confirmée');
  attentes[1].resolve({issue:'ok',id:'d',revision:2,saved_at:'date2'});const result=await fin;
  eq([result.revision,c.etat().sale,c.etat().revision],[2,false,2],'L4 conservation : flush attend dernière saisie durable');
  c.confirmerPublication({issue:'publie',recu:{}});c.detruire();
 });
 await run('échec relançable',async()=>{
  let n=0;const c=U.creerControleurEditeur({service:{conserverBrouillon:async()=>++n===1?{issue:'echec',raison:'quota_stockage',reessayable:true}:{issue:'ok',id:'d',revision:1,saved_at:'date'}},session:{},lirePayload:()=>({title:'Texte conservable'}),delai:10000});
  c.modifier();const premier=await c.flush();eq([premier.issue,c.etat().sale],['echec',true],'L4 quota : saisie non confirmée reste sale');
  const second=await c.flush();eq([second.issue,c.etat().sale,n],['ok',false,2],'L4 quota : relance explicite conserve réellement');c.detruire();
 });
 await run('garde montée',async()=>{
  const {protegerSortieEditeur}=await import('../src/ui/sortie-editeur.js'),root=document.createElement('section');document.body.append(root);
  const c=U.creerControleurEditeur({service:{conserverBrouillon:async()=>({issue:'echec',raison:'quota_stockage'})},session:{},lirePayload:()=>({title:'Saisie'}),delai:10000});c.modifier();let demandes=0;
  const nettoyer=protegerSortieEditeur({racine:root,controleur:c,demander:async()=>{demandes++;return false;}}),w=navigateur(),rendus=[],stop=start(r=>rendus.push(r),{fenetre:w});
  try{w.dispatchEvent(new Event('cuisineos:refresh'));await tour();eq([rendus.length,demandes],[1,0],'L4 refresh : saisie montée conservée sans dialogue intempestif');
   w.ouvrir('#/books/b');await tour();await tour();eq([rendus.length,demandes,c.etat().sale],[1,1,true],'L4 sortie : échec et Rester préservent saisie sans dispose');
  }finally{stop();nettoyer();c.detruire();root.remove();}
 });
 await run('frappes continues',async()=>{
  let sauvegardes=0;const c=U.creerControleurEditeur({service:{conserverBrouillon:async()=>({issue:'ok',id:'continu',revision:++sauvegardes,saved_at:'date'})},session:{},lirePayload:()=>({title:'Suite'}),delai:25});
  try{for(let i=0;i<6;i++){c.modifier();await new Promise(r=>setTimeout(r,8));}ok(sauvegardes>0,'L4 conservation : frappes continues ne repoussent pas le délai maximal');await c.flush();eq(c.etat().sale,false,'L4 conservation : dernières touches confirmées après flush');}finally{c.detruire();}
 });
 await run('reprise périmée',async()=>{
  let lectures=0,reprises=0;const draft={id:'d',revision:1,payload:{book:{title:'Saisie'}}};
  const service={lireBrouillon:async()=>++lectures===1?{issue:'ok',etat:'reprenable',brouillon:draft,session:{}}:{issue:'ok',etat:'bloque',brouillon:draft,raisons:['cycle_change']}};
  const n=await U.panneauRepriseBrouillon({service,id:'d',portee:{},onReprendre:()=>reprises++});document.body.append(n);
  try{[...n.querySelectorAll('button')].find(b=>b.textContent==='Reprendre').click();await tour();eq(reprises,0,'L4 reprise : source changée après affichage ne reprend pas silencieusement');}finally{n.remove();}
 });
 await run('écarter confirmé',async()=>{
  let ecart=0;const fin=differe(),service={lireBrouillon:async()=>({issue:'ok',etat:'reprenable',brouillon:{id:'d',revision:9,payload:{}}}),ecarterBrouillon:async args=>{ecart++;eq(args.expectedRevision,9,'L4 écarter : révision affichée transmise');return fin.promise;}};
  const n=await U.panneauRepriseBrouillon({service,id:'d',portee:{}});document.body.append(n);
  try{const bouton=[...n.querySelectorAll('button')].find(b=>b.textContent==='Écarter ce brouillon');bouton.click();await tour();eq(ecart,0,'L4 écarter : aucune suppression avant confirmation');
   const dlg=[...document.querySelectorAll('dialog[open]')].at(-1);[...dlg.querySelectorAll('button')].find(b=>b.textContent==='Écarter le brouillon').click();await tour();
   eq([bouton.disabled,ecart],[true,1],'L4 écarter : doubleclic bloqué pendant transaction');fin.resolve({issue:'ok'});await tour();eq(n.isConnected,false,'L4 écarter : panneau retiré seulement après commit');
  }finally{n.remove();document.querySelectorAll('dialog').forEach(d=>d.remove());}
 });
 await run('récupération en échec',async()=>{
  const n=U.boutonsRecuperationTexte(async()=>{throw Error('lecture refusée');});document.body.append(n);
  try{for(const b of n.querySelectorAll('button')){b.click();await tour();ok(n.textContent.includes('n’a pas pu être récupéré'),'L4 récupération : échec affiché sans promesse non gérée');}}finally{n.remove();}
 });
 await run('format inconnu récupérable',async()=>{
  const attendu={},service={lireBrouillon:async()=>({issue:'ok',etat:'invalide',revision:2,attendu,raisons:['format_inconnu']}),exporterTexteBrouillon:async()=>({issue:'ok',texte:'Texte sûr'})};
  const n=await U.panneauRepriseBrouillon({service,id:'inconnu',portee:{}});document.body.append(n);
  try{ok(![...n.querySelectorAll('button')].some(b=>b.textContent==='Reprendre'),'L4 inconnu : aucune reprise de format hostile');ok([...n.querySelectorAll('button')].some(b=>b.textContent==='Télécharger mon texte'),'L4 inconnu : récupération sûre toujours accessible');}finally{n.remove();}
 });
 await run('reprise anonyme volontaire',async()=>{
  let compares=0,args=null,repris=null;const resultat={issue:'ok',anonyme:true,comparaison:{},conflits:[{champ:'current_version_id',raison:'pointeur_change'}],courantAffichable:{champs:[{champ:'book.title',saisie:'Saisie sans compte',actuel:'Titre actuel'}]}};
  const service={lireBrouillon:async()=>({issue:'ok',etat:'anonyme',brouillon:{revision:1,payload:{book:{title:'Saisie sans compte'}}}}),comparerBrouillon:async()=>resultat,reprendreSurBaseCourante:async a=>{args=a;return{issue:'ok',session:{},modele:{book:{title:'Saisie sans compte'}},revision:null};}};
  const n=await U.panneauRepriseBrouillon({service,id:'anonyme',portee:{},onComparer:()=>compares++});document.body.append(n);
  try{ok(![...n.querySelectorAll('button')].some(b=>b.textContent==='Reprendre'),'L4 anonyme : aucune reprise directe sous le compte');
   const comparer=[...n.querySelectorAll('button')].find(b=>b.textContent==='Comparer les valeurs');ok(!!comparer,'L4 anonyme : comparaison volontaire accessible');comparer?.click();await tour();eq(compares,1,'L4 anonyme : seul le clic ouvre la comparaison');
  }finally{n.remove();}
  const p=U.panneauComparaisonBrouillon({service,id:'anonyme',portee:{},revision:1,resultat,onReprendre:r=>repris=r});document.body.append(p);
  try{ok(![...p.querySelectorAll('button')].some(b=>b.textContent.includes('version courante')),'L4 anonyme : aucune décision directe de pointeur sans session');
   const check=p.querySelector('input[type=checkbox]');check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));eq(args,null,'L4 anonyme : choisir un champ ne crée pas de brouillon');
   [...p.querySelectorAll('button')].find(b=>b.textContent==='Créer un brouillon avec mes choix').click();await tour();eq([args?.reprendreAnonyme,args?.choixRepris,repris?.aConserver],[true,['book.title'],true],'L4 anonyme : intention explicite transmise, nouvelle copie à conserver');
  }finally{p.remove();}
 });
}
