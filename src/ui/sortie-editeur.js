import { el, ouvrirDialogue } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { enregistrerGardeSortie } from '../core/router.js';
import { protegerSaisie } from './state.js';
import { boutonsRecuperationTexte, texteErreurBrouillon } from './brouillon-editeur.js';

function demanderSortie(controleur,resultat,{estCourante=()=>true}={}){
 return new Promise(resolve=>{
  let termine=false,presentation;
  const finir=choix=>{if(termine)return;termine=true;presentation?.fermer();dlg.remove();resolve(choix);};
  const dlg=el('dialog',{class:'dialogue-sortie-editeur',dataset:{role:'sortie-editeur'}},el('h2',null,t('Ta saisie n’est pas encore conservée')),el('p',null,texteErreurBrouillon(resultat)),
   boutonsRecuperationTexte(()=>controleur.lireTexte()),el('div',{class:'row'},el('button',{type:'button',class:'btn primary',onClick:()=>finir(false)},t('Rester')),
    el('button',{type:'button',class:'btn',onClick:()=>finir(true)},t('Quitter sans la conserver'))));
  dlg.addEventListener('cancel',e=>{e.preventDefault();finir(false);});dlg.addEventListener('click',e=>{if(e.target===dlg){const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finir(false);}});
  presentation=ouvrirDialogue(dlg,{focusInitial:dlg.querySelector('button.btn.primary'),estCourante});
 });
}
export function protegerSortieEditeur({racine,controleur,demander=(resultat,options)=>demanderSortie(controleur,resultat,options),fenetre=window}){
 let decision=null,decisionExplicite=false,libererSync=null,detruit=false;
 const stopEtat=controleur.souscrire(e=>{const active=!e.publie&&(e.sale||e.enCours||e.id);if(active&&!libererSync)libererSync=protegerSaisie(racine);if(!active&&libererSync){libererSync();libererSync=null;}});
 const autoriser=demande=>{
  if(detruit||!racine.isConnected||controleur.etat().publie)return true;
  // Une décision déjà ouverte garde sa vue et son unique dialogue ; le retour pourra être redemandé ensuite.
  if(decisionExplicite)return false;
  const e=controleur.etat();if(demande.event==='cuisineos:refresh'&&(e.sale||e.enCours||e.id))return false;
  if(decision)return decision;
  decision=(async()=>{const result=await controleur.flush();if(result.issue==='ok')return true;return await demander(result)===true;})().finally(()=>{decision=null;});return decision;
 };
 const explicite=async({intention,estCourante})=>{
  if(decision||decisionExplicite)return{issue:'refuse',raison:'conservation_echouee'};
  decisionExplicite=true;
  try{
  const courante=()=>!detruit&&racine.isConnected&&estCourante();
  if(!courante())return{issue:'refuse',raison:'contexte_change'};
  const avant=controleur.etat();
  if(!avant||typeof avant.sale!=='boolean'||typeof avant.enCours!=='boolean')return{issue:'refuse',raison:'contrat_incomplet'};
  const result=await controleur.flush(),etat=controleur.etat();
  if(!courante())return{issue:'refuse',raison:'contexte_change'};
  if(result?.issue==='ok'&&etat&&!etat.sale&&!etat.enCours)return{issue:'conserve'};
  if(intention==='conserver')return{issue:'refuse',raison:etat?.enCours?'lecture_en_cours':result?.raison||'conservation_echouee'};
  return await demander(result,{estCourante:courante})===true?{issue:'quitter_sans_conserver'}:{issue:'refuse',raison:'rester'};
  }finally{decisionExplicite=false;}
 };
 const stopGarde=enregistrerGardeSortie(autoriser,{racine,demanderExplicite:explicite});
 const before=e=>{if(!detruit&&racine.isConnected&&(controleur.etat().sale||controleur.etat().enCours)){e.preventDefault();e.returnValue='';}};
 fenetre.addEventListener('beforeunload',before);
 return()=>{detruit=true;stopEtat();stopGarde();libererSync?.();fenetre.removeEventListener('beforeunload',before);};
}
