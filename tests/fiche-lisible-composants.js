import {segmentLectureEl,ingredientLectureEl,timerBlock} from '../src/ui/components.js';
import {setUiLocale} from '../src/core/i18n.js';

const bouton=(root,texte)=>[...root.querySelectorAll('button')].find(b=>b.textContent===texte);
const attendre=async(predicat)=>{const limite=Date.now()+2000;while(!predicat()){if(Date.now()>limite)throw Error('Le geste de minuterie ne se termine pas.');await new Promise(r=>setTimeout(r,5));}};

export async function runFicheLisibleComposantsTests({eq,ok}){
 const scene=document.createElement('div'),racines=[];document.body.append(scene);setUiLocale('fr');
 const monter=node=>{scene.append(node);racines.push(node);return node;};
 try{
  for(const etat of ['manquant','perime']){
   const segment={texte:'Rest for 4–6 hours.',original:'Rest for 4–6 hours.',langReelle:'en',originalLang:'en',traduit:false,etat};
   const initial=JSON.stringify(segment),normal=monter(segmentLectureEl(segment)),sobre=monter(segmentLectureEl(segment,{signalerManque:false}));
   eq(normal.querySelectorAll('[data-role=traduction-manquante]').length,1,`Fiche lisible : ${etat} reste signalé par défaut`);
   eq(sobre.querySelectorAll('[data-role=traduction-manquante]').length,0,`Fiche lisible : ${etat} sans répétition lorsque la fiche l’annonce globalement`);
   eq([sobre.firstElementChild.textContent,sobre.firstElementChild.lang],[segment.texte,'en'],`Fiche lisible : texte et langue réelle conservés pour ${etat}`);
   eq(JSON.stringify(segment),initial,`Fiche lisible : état de traduction ${etat} inchangé`);
  }
  const traduit=monter(segmentLectureEl({texte:'Mélanger la farine.',original:'Mix the flour.',langReelle:'fr',originalLang:'en',traduit:true,etat:'traduit',citationSource:true},{signalerManque:false}));
  eq(traduit.querySelector('[data-role=citation-source-tm]')?.textContent,'Réglages traduits ; noms d’aliments cités dans la langue source.','Fiche lisible : la citation Thermomix reste signalée');
  eq([traduit.querySelector('details')?.open,traduit.querySelector('details [lang]')?.textContent,traduit.querySelector('details [lang]')?.lang],[false,'Mix the flour.','en'],'Fiche lisible : original traduit toujours consultable dans sa langue');

  const source={texte:'65 g strong white flour',original:'65 g strong white flour',langReelle:'en',traduit:false,etat:'manquant'};
  const ligne={ingredient:{id:'lisible-farine',name_text:'strong white flour',verification_state:'unverified',uncertain:true,optional:true},principal:{...source,texte:'strong white flour'},source,preparation:{texte:'sifted',original:'sifted',langReelle:'en',etat:'manquant'},quantite:'65 g',quantiteDetail:{},sansQuantiteCalculee:false,locale:'fr'};
  const avant=JSON.stringify(ligne),normal=monter(ingredientLectureEl(ligne)),compact=monter(ingredientLectureEl(ligne,{compact:true,signalerManque:false}));
  ok(normal.querySelectorAll('[data-role=traduction-manquante]').length>=2,'Fiche lisible : ingrédient et citation gardent leurs alertes par défaut');
  eq(compact.querySelectorAll('[data-role=traduction-manquante]').length,0,'Fiche lisible : aucune répétition dans la ligne ni sa citation repliée');
  const quantite=compact.querySelector('.qty'),nom=compact.querySelector('[data-role=nom-ingredient]');
  ok(quantite?.parentElement===nom?.parentElement&&quantite?.parentElement.tagName==='SPAN','Fiche lisible : quantité et nom partagent un flux de texte inline');
  ok(!!nom?.closest('.row'),'Fiche lisible : la ligne conserve son conteneur compatible');
  ok(quantite?.parentElement.textContent.includes('65 g strong white flour, sifted (facultatif)'),'Fiche lisible : quantité, espace, nom, préparation et facultatif lisibles ensemble');
  eq([nom?.lang,compact.querySelector('details [lang]')?.lang],['en','en'],'Fiche lisible : langues de l’ingrédient et de la citation conservées');
  eq([...compact.querySelectorAll('.chip')].map(n=>n.textContent),['À vérifier','incertain'],'Fiche lisible : les incertitudes restent visibles');
  eq([compact.querySelector('details')?.open,compact.querySelector('details .lecture-segment > span')?.textContent],[false,source.texte],'Fiche lisible : texte source exact toujours consultable');
  eq(JSON.stringify(ligne),avant,'Fiche lisible : aucune quantité ni donnée source réécrite');

  const demandes=[],defaut=monter(timerBlock(600,{apple:false,onRequest:async(...args)=>demandes.push(args)}));
  eq(defaut.tagName,'DIV','Fiche lisible : la minuterie du mode cuisine reste dépliée par défaut');
  ok(!defaut.querySelector('summary')&&!!bouton(defaut,'J’ai demandé à Siri'),'Fiche lisible : les commandes historiques restent directement présentes');
  const simple=monter(timerBlock(600,{apple:false,compact:true,replie:true,onRequest:async(...args)=>{demandes.push(args);return{id:'siri-conservee'};}}));
  eq([simple.tagName,simple.open],['DETAILS',false],'Fiche lisible : minuterie de fiche fermée au montage');
  eq(simple.querySelector('summary')?.textContent,'Minuterie — 10 min','Fiche lisible : durée simple toujours visible dans le résumé');
  eq([...simple.querySelectorAll('strong')].filter(n=>n.textContent==='Minuterie — 10 min').length,1,'Fiche lisible : aucun titre de minuterie doublé');
  eq(demandes.length,0,'Fiche lisible : monter les deux présentations ne lance aucune demande');
  simple.querySelector('summary')?.click();
  eq(simple.open,true,'Fiche lisible : le résumé ouvre les commandes existantes');
  eq(demandes.length,0,'Fiche lisible : ouvrir la minuterie ne démarre ni ne conserve rien');
  bouton(simple,'J’ai demandé à Siri')?.click();await attendre(()=>demandes.length===1);
  eq(demandes,[['siri',600]],'Fiche lisible : seul le geste Siri conserve la durée exacte');

  let finir;const attente=new Promise(r=>{finir=r;}),plageDemandes=[],ouvertures=[];
  const plage=monter(timerBlock(14400,{seconds_max:21600,replie:true,compact:true,apple:true,onRequest:async(channel,duree)=>{plageDemandes.push([channel,duree]);await attente;return{id:'demande-plage'};},onOpen:r=>ouvertures.push(r.id)}));
  eq(plage.querySelector('summary')?.textContent,'Minuterie — 4 heures à 6 heures','Fiche lisible : fourchette complète visible sans choisir une borne');
  eq([plage.querySelector('select')?.value,bouton(plage,'Préparer Raccourcis')?.disabled],['',true],'Fiche lisible : la fourchette reste sans choix et sans lancement possible');
  plage.querySelector('summary')?.click();
  eq(plageDemandes.length,0,'Fiche lisible : déplier une fourchette ne choisit ni ne lance rien');
  const choix=plage.querySelector('select');choix.value='21600';choix.dispatchEvent(new Event('change',{bubbles:true}));
  eq(plageDemandes.length,0,'Fiche lisible : choisir une durée ne crée pas une demande');
  bouton(plage,'Préparer Raccourcis')?.click();bouton(plage,'Préparer Raccourcis')?.click();
  eq(plageDemandes,[['shortcut',21600]],'Fiche lisible : deux clics pendant la conservation gardent une demande exacte');
  eq(plage.querySelectorAll('a[href]').length,0,'Fiche lisible : aucun raccourci avant conservation achevée');
  finir();await attendre(()=>plage.querySelectorAll('a[href]').length===1);
  eq(ouvertures.length,0,'Fiche lisible : la fin de conservation ne lance pas Raccourcis');
  const lien=plage.querySelector('a[href]');lien.addEventListener('click',e=>e.preventDefault());lien.click();
  eq(ouvertures,['demande-plage'],'Fiche lisible : le clic séparé utilise la demande conservée');
  eq(plageDemandes.length,1,'Fiche lisible : ouvrir Raccourcis ne redemande pas la conservation');
  plage.dispose();eq(plage.querySelectorAll('a[href]').length,0,'Fiche lisible : détruire le volet rend le raccourci inactif');
 }finally{for(const node of racines)node.dispose?.();scene.remove();setUiLocale('fr');}
}
