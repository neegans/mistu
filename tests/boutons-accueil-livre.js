import {accueilLivreModel,renderAccueilLivre} from '../src/ui/accueil-livre.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

export async function runBoutonsAccueilLivreTests({eq,ok}){
 const locale=getUiLocale();setUiLocale('fr');const appels=[];
 const root=renderAccueilLivre(accueilLivreModel({nouveau:'1'}),{photographier:i=>appels.push(['photo',i]),choisir:i=>appels.push(['fichiers',i]),plusTard:()=>appels.push(['plusTard']),fermer:()=>appels.push(['fermer'])});
 document.body.append(root);
 try{
  const cartes=[...root.querySelectorAll('button.carte')],[index,recette,tard]=cartes;
  eq(cartes.length,3,'Accueil boutons : trois choix natifs conservés');
  eq(root.querySelectorAll('.sources button').length,0,'Accueil boutons : aucun choix de source avant sélection');
  eq([index.getAttribute('aria-pressed'),recette.getAttribute('aria-pressed')],['false','false'],'Accueil boutons : aucun choix annoncé sélectionné au départ');
  index.focus();index.click();
  const sources=root.querySelector('.sources'),photo=sources.querySelectorAll('button')[0],fichiers=sources.querySelectorAll('button')[1];
  eq([index.getAttribute('aria-pressed'),recette.getAttribute('aria-pressed')],['true','false'],'Accueil boutons : choix index explicite et exclusif');
  ok(sources.parentElement===index.parentElement&&sources.previousElementSibling===index,'Accueil boutons : commandes immédiatement après la carte index dans son groupe');
  ok(!!(sources.compareDocumentPosition(recette)&Node.DOCUMENT_POSITION_FOLLOWING),'Accueil boutons : sources index avant la carte suivante dans l’ordre de lecture');
  eq(sources.querySelector('[data-role=choix-selectionne]')?.textContent,'Choix sélectionné','Accueil boutons : état sélectionné visible sans dépendre de la couleur');
  eq(sources.getAttribute('role'),'group','Accueil boutons : commandes de source forment un groupe accessible');
  const titreIndex=index.querySelector('h3');
  ok(!!titreIndex.id&&sources.getAttribute('aria-labelledby')===titreIndex.id,'Accueil boutons : groupe nommé par le choix index réel');
  ok(!!sources.id&&index.getAttribute('aria-controls')===sources.id&&recette.getAttribute('aria-controls')===sources.id,'Accueil boutons : les deux choix désignent la vraie zone de commandes');
  eq(document.activeElement===index,true,'Accueil boutons : sélectionner conserve le focus sur le choix');
  eq([photo.textContent,fichiers.textContent],['Photographier','Choisir des photos ou un PDF'],'Accueil boutons : caméra et fichiers conservés');
  eq([photo.type,fichiers.type],['button','button'],'Accueil boutons : commandes natives sans soumission implicite');
  eq(appels,[],'Accueil boutons : sélection seule ne lance ni capture ni lecture');
  photo.click();eq(appels,[['photo','index']],'Accueil boutons : caméra appelle immédiatement la bonne intention');
  fichiers.click();eq(appels.at(-1),['fichiers','index'],'Accueil boutons : photos ou PDF gardent l’intention index');
  index.click();eq([sources.querySelectorAll('button')[0]===photo,sources.querySelectorAll('button')[1]===fichiers],[true,true],'Accueil boutons : sélectionner encore le même choix conserve les commandes');
  recette.focus();recette.click();
  eq([index.getAttribute('aria-pressed'),recette.getAttribute('aria-pressed')],['false','true'],'Accueil boutons : recette remplace la sélection index');
  ok(sources.parentElement===recette.parentElement&&sources.previousElementSibling===recette,'Accueil boutons : mêmes commandes déplacées auprès de la recette');
  eq(root.querySelectorAll('.sources').length,1,'Accueil boutons : aucune deuxième zone de commandes concurrente');
  ok(!!recette.querySelector('h3').id&&sources.getAttribute('aria-labelledby')===recette.querySelector('h3').id,'Accueil boutons : nom accessible actualisé sur le choix recette');
  eq([sources.querySelectorAll('button')[0]===photo,sources.querySelectorAll('button')[1]===fichiers],[true,true],'Accueil boutons : changement de choix conserve les nœuds des commandes');
  eq(document.activeElement===recette,true,'Accueil boutons : changement de choix conserve le focus du clavier');
  photo.click();fichiers.click();eq(appels.slice(-2),[['photo','recette'],['fichiers','recette']],'Accueil boutons : caméra et fichiers utilisent la nouvelle intention sans ancien choix');
  eq(root.querySelectorAll('button button').length,0,'Accueil boutons : aucune commande imbriquée dans un autre bouton');
  const autre=renderAccueilLivre(accueilLivreModel({nouveau:'1'}));root.append(autre);const autreIndex=autre.querySelector('button.carte');autreIndex.click();
  ok(!!autre.querySelector('.sources').id&&autre.querySelector('.sources').id!==sources.id,'Accueil boutons : deux accueils ne partagent pas leurs identifiants accessibles');
  eq(root.querySelectorAll('[aria-pressed=true]').length,2,'Accueil boutons : une autre instance ne modifie pas le choix courant');
  autre.remove();tard.click();eq(appels.at(-1),['plusTard'],'Accueil boutons : Plus tard conserve sa destination');
  root.querySelector('button.fermer').click();eq([!!root.querySelector('.accueil-livre'),appels.at(-1)],[false,['fermer']],'Accueil boutons : fermeture enlève le panneau et appelle son geste');
  const sans=renderAccueilLivre(accueilLivreModel({}));eq(sans.querySelectorAll('button').length,0,'Accueil boutons : pas de panneau ni commande hors accueil');
 }finally{root.remove();setUiLocale(locale);}
}
