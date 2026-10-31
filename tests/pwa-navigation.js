import {start,remplacerAdresse,navigate,refresh,CLE_ENTREE_NAV} from '../src/core/router.js';
import {protegerSortieEditeur} from '../src/ui/sortie-editeur.js';

// L'historique contrôlé émet ses retours en microtâche, comme les décisions
// asynchrones de la garde. Ce tour de boucle attend leur achèvement entier.
const stabiliser=()=>new Promise(resolve=>setTimeout(resolve,0));
function fenetreControlee(href){
 const w=new EventTarget(),entrees=[{href,state:{etranger:'conservé'}}],listeners=new Set();let index=0;
 const ajouter=w.addEventListener.bind(w),retirer=w.removeEventListener.bind(w);
 w.addEventListener=(nom,fn,...reste)=>{listeners.add(fn);ajouter(nom,fn,...reste);};
 w.removeEventListener=(nom,fn,...reste)=>{retirer(nom,fn,...reste);listeners.delete(fn);};
 w.location={get hash(){return entrees[index].href;}};
 w.navigation={get currentEntry(){return{index};}};
 w.history={get state(){return entrees[index].state;},replaceState(state,_titre,url){entrees[index]={href:url,state:structuredClone(state)};},go(delta){index+=delta;queueMicrotask(()=>w.dispatchEvent(new Event('popstate')));}};
 w.pousser=url=>{entrees.splice(index+1);entrees.push({href:url,state:structuredClone(w.history.state)});index++;w.dispatchEvent(new Event('hashchange'));};
 w.listeners=listeners;return w;
}

export async function runPwaNavigationTests({eq,ok}){
 const w=fenetreControlee('#/meals/pwa-navigation?origine=liste'),vues=[];
 const scene=document.createElement('main'),champ=document.createElement('input');champ.value='Saisie du repas à conserver';scene.append(champ);document.body.append(scene);
 let choix=false,decisions=0,conservations=0;
 const controleur={etat:()=>({sale:true,enCours:false,publie:false}),souscrire:fn=>{fn(controleur.etat());return()=>{};},lireTexte:()=>champ.value,flush:async()=>{conservations++;return{issue:'refuse',raison:'stockage_indisponible'};}};
 const liberer=protegerSortieEditeur({racine:scene,controleur,fenetre:w,demander:async()=>{decisions++;return choix;}});
 const stop=start(route=>vues.push(route),{fenetre:w});
 try{
  const entree=structuredClone(w.history.state[CLE_ENTREE_NAV]);
  const ouverte='#/meals/pwa-navigation?origine=liste&organisation=ouverte';
  remplacerAdresse(ouverte,{fenetre:w});await stabiliser();
  eq([vues.length,decisions,conservations],[1,0,0],'PWA navigation : ouvrir l’organisation ne rend ni ne demande la garde');
  eq(w.history.state[CLE_ENTREE_NAV].cle,entree.cle,'PWA navigation : présentation conserve la clé de l’entrée');
  eq(w.history.state.etranger,'conservé','PWA navigation : présentation conserve le state étranger');
  w.pousser('#/library');await stabiliser();
  eq(decisions,1,'PWA navigation : Rester ne redemande pas la décision pendant la compensation');
  eq(conservations,1,'PWA navigation : Rester ne relance pas une deuxième conservation refusée');
  eq(w.location.hash,ouverte,'PWA navigation : Rester conserve organisation et origine');
  eq(w.history.state[CLE_ENTREE_NAV].href,ouverte,'PWA navigation : métadonnée de retour égale l’adresse conservée');
  eq(w.history.state[CLE_ENTREE_NAV].cle,entree.cle,'PWA navigation : Rester retrouve la même entrée');
  eq(vues.length,1,'PWA navigation : Rester conserve la vue sans rendu supplémentaire');
  eq([champ.value,scene.isConnected],['Saisie du repas à conserver',true],'PWA navigation : refus conserve le même champ et sa saisie');
  choix=true;const avant=decisions;w.pousser('#/library');await stabiliser();
  eq(decisions-avant,1,'PWA navigation : Quitter demande une seule décision au geste suivant');
  eq([w.location.hash,vues.length],['#/library',2],'PWA navigation : Quitter atteint normalement sa destination');
  eq(vues.at(-1).navigation.precedente.href,ouverte,'PWA navigation : destination connaît l’adresse de présentation exacte');
 }finally{stop();liberer();scene.remove();}
 eq(w.listeners.size,0,'PWA navigation : arrêter retire les écouteurs du routeur et de la garde');
 const nombre=vues.length;remplacerAdresse('#/meals/apres-arret?organisation=ouverte',{fenetre:w});w.dispatchEvent(new Event('cuisineos:refresh'));await stabiliser();
 eq(vues.length,nombre,'PWA navigation : après arrêt aucune notification ne rend une ancienne vue');

 // Les API publiques navigate/refresh utilisent ici la vraie fenêtre, sans
 // ajouter d'entrée : chaque changement explicite est un replace.
 const adresse=location.href,etat=history.state;let autorise=false,appels=0;const rendus=[],demandes=[];
 history.replaceState({etranger:42},'','#/__pwa-navigation__?origine=avant');
 const arreter=start(route=>rendus.push(route),{avantRoute:async demande=>{appels++;demandes.push(demande);return autorise;}});
 try{
  navigate('/__pwa-navigation__?origine=apres',{replace:true});await stabiliser();
  eq(appels,1,'PWA navigation : replace ordinaire passe une fois dans sa garde');
  eq(demandes[0].depuis.href,'#/__pwa-navigation__?origine=avant','PWA navigation : replace ne prend pas sa destination pour origine');
  eq(location.hash,'#/__pwa-navigation__?origine=avant','PWA navigation : replace refusé restaure même chemin et ancienne query');
  eq([rendus.length,history.state.etranger],[1,42],'PWA navigation : replace refusé conserve rendu et state');
  autorise=true;navigate('/__pwa-navigation__?origine=apres',{replace:true});await stabiliser();
  eq([appels,rendus.length,rendus.at(-1).navigation.type],[2,2,'replace'],'PWA navigation : replace autorisé conserve son unique rendu et son type');
  eq(location.hash,'#/__pwa-navigation__?origine=apres','PWA navigation : replace autorisé applique la nouvelle query');
  remplacerAdresse('/__pwa-navigation__?origine=apres&organisation=ouverte');await stabiliser();
  eq([appels,rendus.length],[2,2],'PWA navigation : remplacement silencieux après navigation reste sans garde ni rendu');
  refresh();await stabiliser();
  eq([appels,rendus.length,rendus.at(-1).navigation.type],[3,3,'refresh'],'PWA navigation : refresh explicite conserve garde et rendu ordinaires');
  eq(rendus.at(-1).query,{origine:'apres',organisation:'ouverte'},'PWA navigation : refresh relit la présentation courante');
  arreter();remplacerAdresse('/__pwa-navigation__?arret=1');refresh();await stabiliser();
  eq([appels,rendus.length],[3,3],'PWA navigation : arrêt rend les appels publics suivants inertes pour ce routeur');
 }finally{arreter();history.replaceState(etat,'',adresse);}
}
