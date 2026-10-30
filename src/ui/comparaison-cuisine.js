import {el,downloadBlob} from '../core/dom.js';
import {t,label} from '../core/i18n.js';
import {creerComparaisonCuisine} from '../domain/comparaison-cuisine.js';

function texteErreur(resultat){
 if(resultat?.raison==='quota_stockage')return t('La copie ne peut pas être conservée faute de place. Rien n’a été remplacé.');
 if(['contexte_change','compte_change','bibliotheque_remplacee'].includes(resultat?.raison))return t('Le contexte a changé. Rouvre cette séance avant de comparer.');
 if(resultat?.raison==='operations_dependantes')return t('D’autres modifications dépendent de cette copie. Rien n’a été remplacé.');
 if(['comparaison_changee','conflit_absent','confirmation_incomplete'].includes(resultat?.raison))return t('Les données ont changé depuis la comparaison. Revois les copies avant de choisir.');
 return t('La comparaison n’a pas pu être conservée sur cet appareil. Réessaie.');
}
function copieLisible(store,row,lecture){
 if(!row)return el('p',{class:'muted'},t('Aucune copie reçue pour cette ligne.'));
 if(store==='timer_launches')return el('div',{class:'stack'},el('p',null,[row.recipe_title_snapshot,row.task_label_snapshot].filter(Boolean).join(' · ')||t('Minuteur')),
  row.mirror?el('div',null,el('p',null,t('Départ conservé : {date}',{date:row.mirror.started_at})),el('p',null,t('Échéance conservée : {date}',{date:row.mirror.deadline_at}))):el('p',null,t('Aucun suivi démarré.')));
 const done=Object.values(row.progress?.by_version||{}).reduce((n,p)=>n+(p.done_step_ids?.length||0),0);
 const vue=el('div',{class:'stack'},el('p',null,t('Séance de cuisine')),el('p',null,row.status==='done'?t('Séance terminée'):t('Séance en cours')),
  el('p',null,t('Étapes cochées dans cette copie : {n}',{n:done})),el('p',null,t('Langue de lecture : {langue}',{langue:row.lang==='fr'?t('Français'):row.lang==='en'?t('Anglais'):t('Original')})));
 const versions=lecture?.versions||[],active=versions.find(v=>v.active);
 vue.append(el('p',null,t('Recette active : {titre}',{titre:active?.titre||t('Source indisponible')})));
 for(const v of versions){
  const bloc=el('div',{class:'stack'},el('strong',null,v.titre||t('Source indisponible')));
  if(v.kind)bloc.append(el('span',{class:'muted'},label('version_kind',v.kind)));
  if(v.created_at)bloc.append(el('span',{class:'muted'},t('Version créée le {date}',{date:v.created_at})));
  if(!v.disponible)bloc.append(el('p',null,t('Source indisponible')));
  bloc.append(el('p',null,v.etape?t('Étape {n} : {texte}',{n:v.etape.numero,texte:v.etape.texte}):v.pointeur_present?t('Étape conservée introuvable dans la source.'):t('Aucune étape courante choisie.')),
   el('p',null,v.coches.length?t('Étapes cochées : {numeros}',{numeros:v.coches.join(', ')}):t('Aucune étape cochée.')));
  if(v.coches_inconnues)bloc.append(el('p',{class:'muted'},t('{n} étapes cochées ne sont plus disponibles dans la source.',{n:v.coches_inconnues})));
  vue.append(bloc);
 }
 return vue;
}
export function creerPanneauComparaisonCuisine({sessionId,ctx={},repo,getGeneration,estCourante=()=>true,onConserve}){
 let detruit=false,portee=null,vol=null,relire=false,numero=0,occupe=false;
 const vivante=()=>!detruit&&estCourante(),service=creerComparaisonCuisine({repo,getGeneration});
 const statut=el('p',{role:'status',hidden:true}),liste=el('div',{class:'stack'}),details=el('div',{class:'stack'}),recuperations=el('div',{class:'stack'});
 const node=el('section',{class:'cuisine-comparaison stack',hidden:true,'aria-label':t('Copies de cette séance')},el('h2',null,t('Copies de cette séance')),statut,liste,details,recuperations);
 const annoncer=r=>{if(vivante()){statut.textContent=texteErreur(r);statut.hidden=false;node.hidden=false;}};
 async function comparer(cible){
  if(!vivante()||occupe)return;occupe=true;const n=++numero;
  try{const r=await service.capturerComparaisonCuisine({portee,...cible});if(!vivante()||n!==numero)return;if(r.issue!=='ok'){annoncer(r);return;}
   const a=r.affiche,confirmer=el('button',{class:'btn primary',type:'button',dataset:{role:'confirmer-cuisine'}},t('Utiliser les états confirmés'));
   const annuler=el('button',{class:'btn',type:'button',dataset:{role:'annuler-comparaison-cuisine'},onClick:()=>{if(!occupe){numero++;details.replaceChildren();}}},t('Annuler'));
   const panneau=el('div',{class:'card stack',dataset:{role:'comparaison-cuisine-detail'}},el('h3',null,t('Revoir avant de remplacer')),
    el('p',null,t('{n} modifications en attente sont concernées.',{n:a.commandes.length})),
    el('p',null,t('Les états confirmés seront utilisés. Les modifications locales resteront consultables dans une copie conservée sur cet appareil.')),
    el('p',null,t('Les suivis sans confirmation seront retirés de la vue active et conservés dans cette copie. Cela n’arrête aucune alarme dans Horloge.')));
   for(const c of a.cibles)panneau.append(el('div',{class:'stack'},el('h4',null,t('Copie sur cet appareil')),el('div',{dataset:{role:'copie-cuisine-locale'}},copieLisible(c.store,c.locale,c.lectureLocale)),el('h4',null,t('État confirmé reçu')),el('div',{dataset:{role:'copie-cuisine-confirmee'}},copieLisible(c.store,c.confirmee,c.lectureConfirmee))));
   confirmer.addEventListener('click',()=>{void (async()=>{
    if(!vivante()||occupe||n!==numero)return;occupe=true;confirmer.disabled=true;annuler.disabled=true;
    try{const result=await service.garderCuisineConfirmee({comparaison:r.comparaison});if(!vivante())return;
     if(!['conserve','deja_conserve'].includes(result.issue)){annoncer(result);return;}
     details.replaceChildren();statut.textContent=t('États confirmés utilisés. La copie locale reste récupérable ici.');statut.hidden=false;
     try{await actualiser();if(vivante())await onConserve?.(result);}catch{if(vivante()){statut.textContent=t('Ton choix est conservé. Rouvre cette séance pour actualiser son affichage.');statut.hidden=false;}}
    }catch{annoncer({raison:'stockage_indisponible'});}finally{occupe=false;if(vivante()){confirmer.disabled=false;annuler.disabled=false;}}
   })();});panneau.append(el('div',{class:'row'},confirmer,annuler));details.replaceChildren(panneau);
  }catch{annoncer({raison:'stockage_indisponible'});}finally{occupe=false;}
 }
 async function dessiner(){
  if(!portee){const p=await service.capturerPortee({owner_id:ctx.proprietaireDonnees??null,estCourante:vivante});if(!vivante())return;if(p.issue!=='ok'){annoncer(p);return;}portee=p.portee;}
  const [a,b]=await Promise.all([service.lireConflitsCuisine({portee,sessionId}),service.lireRecuperationsCuisine({portee,sessionId})]);if(!vivante())return;
  if(a.issue!=='ok'||b.issue!=='ok'){annoncer(a.issue!=='ok'?a:b);return;}
  liste.replaceChildren(...a.conflits.map(c=>el('div',{class:'status warn stack'},el('p',null,t('Une modification de cette séance n’a pas été acceptée. Revois les copies avant de continuer.')),
   el('button',{class:'btn',type:'button',dataset:{role:'comparer-cuisine'},onClick:()=>{void comparer({store:c.store,id:c.id});}},t('Comparer les copies de cuisine')))));
  recuperations.replaceChildren(...b.recuperations.map(r=>{
   const copie=el('details',{class:'card stack',dataset:{role:'recuperation-cuisine'}},el('summary',null,t('Consulter la copie locale conservée')),
    el('p',{class:'muted'},t('Ces heures décrivent les suivis conservés avant ton choix. Elles ne confirment pas une alarme système.')));
   for(const ligne of r.recovery.lignes)copie.append(copieLisible(ligne.store,ligne.data,ligne.lecture));
   copie.append(el('button',{class:'btn',type:'button',onClick:()=>{try{downloadBlob(new Blob([JSON.stringify(r.recovery,null,2)],{type:'application/json'}),'mistu-copie-cuisine.json');}catch{annoncer({raison:'stockage_indisponible'});}}},t('Télécharger la copie locale')));return copie;
  }));
  node.hidden=!a.conflits.length&&!b.recuperations.length&&!details.childElementCount&&statut.hidden;
 }
 function actualiser(){if(!vivante())return Promise.resolve();if(vol){relire=true;return vol;}vol=(async()=>{do{relire=false;try{await dessiner();}catch{annoncer({raison:'stockage_indisponible'});}}while(relire&&vivante());})().finally(()=>{vol=null;});return vol;}
 node.actualiser=actualiser;node.dispose=()=>{detruit=true;numero++;};void actualiser();return node;
}
