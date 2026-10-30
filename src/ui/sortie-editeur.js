import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { enregistrerGardeSortie } from '../core/router.js';
import { protegerSaisie } from './state.js';
import { boutonsRecuperationTexte, texteErreurBrouillon } from './brouillon-editeur.js';

function demanderSortie(controleur,resultat){
 return new Promise(resolve=>{
  const avant=document.activeElement;let termine=false;
  const finir=choix=>{if(termine)return;termine=true;dlg.close();dlg.remove();avant?.isConnected&&avant.focus();resolve(choix);};
  const dlg=el('dialog',{class:'dialogue-sortie-editeur',dataset:{role:'sortie-editeur'}},el('h2',null,t('Ta saisie n’est pas encore conservée')),el('p',null,texteErreurBrouillon(resultat)),
   boutonsRecuperationTexte(()=>controleur.lireTexte()),el('div',{class:'row'},el('button',{type:'button',class:'btn primary',onClick:()=>finir(false)},t('Rester')),
    el('button',{type:'button',class:'btn',onClick:()=>finir(true)},t('Quitter sans la conserver'))));
  dlg.addEventListener('cancel',e=>{e.preventDefault();finir(false);});dlg.addEventListener('click',e=>{if(e.target===dlg){const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finir(false);}});
  document.body.append(dlg);dlg.showModal();
 });
}
export function protegerSortieEditeur({racine,controleur,demander=resultat=>demanderSortie(controleur,resultat),fenetre=window}){
 let decision=null,libererSync=null,detruit=false;
 const stopEtat=controleur.souscrire(e=>{const active=!e.publie&&(e.sale||e.enCours||e.id);if(active&&!libererSync)libererSync=protegerSaisie(racine);if(!active&&libererSync){libererSync();libererSync=null;}});
 const autoriser=demande=>{
  if(detruit||!racine.isConnected||controleur.etat().publie)return true;
  const e=controleur.etat();if(demande.event==='cuisineos:refresh'&&(e.sale||e.enCours||e.id))return false;
  if(decision)return decision;
  decision=(async()=>{const result=await controleur.flush();if(result.issue==='ok')return true;return await demander(result)===true;})().finally(()=>{decision=null;});return decision;
 };
 const stopGarde=enregistrerGardeSortie(autoriser);
 const before=e=>{if(!detruit&&racine.isConnected&&(controleur.etat().sale||controleur.etat().enCours)){e.preventDefault();e.returnValue='';}};
 fenetre.addEventListener('beforeunload',before);
 return()=>{detruit=true;stopEtat();stopGarde();libererSync?.();fenetre.removeEventListener('beforeunload',before);};
}
