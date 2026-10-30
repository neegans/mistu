import {el} from '../core/dom.js';
import {t} from '../core/i18n.js';
import * as repoModule from '../model/repo.js';
import {getSyncGeneration} from './state.js';
import {select,emptyState} from './components.js';
import {ouvrirFormulaireLot,ouvrirMouvementLot} from './inventaire-formulaire.js';
import {creerComparaisonInventaire} from './inventaire-comparaison.js';
import {resumeLotInventaire,dateLotInventaire,texteErreurInventaire} from './inventaire-texte.js';
export async function creerInventaire({ctx,query={},repo=repoModule,getGeneration=getSyncGeneration,service,estCourante=()=>true}){
 let detruit=false,occupe=false,vol=null,actualisationDemandee=false;const base=repo.db,generation=getGeneration(),vivante=()=>!detruit&&estCourante()&&repo.db===base&&getGeneration()===generation;
 service??=(await import('../domain/inventaire-persistance.js')).creerServiceInventaire({repo,getGeneration});
 const root=el('section',{class:'inventaire-lots stack'}),statut=el('p',{role:'status',hidden:true}),liste=el('div',{class:'stack'});root.append(statut);
 const scope=await service.capturerPortee({owner_id:ctx.proprietaireDonnees??null,estCourante:vivante});if(scope.issue!=='ok'){statut.hidden=false;statut.textContent=texteErreurInventaire(scope);return root;}const portee=scope.portee;
 const filtre=select([{value:'disponibles',label:t('Lots disponibles')},{value:'termines',label:t('Lots terminés')},{value:'tous',label:t('Tous les lots')}],'disponibles',()=>{void actualiser();});filtre.setAttribute('aria-label',t('Afficher les lots'));
 const emplacement=select([{value:'',label:t('Tous les emplacements')},{value:'frigo',label:t('Frigo')},{value:'congelateur',label:t('Congélateur')},{value:'garde_manger',label:t('Garde-manger')}],'',()=>{void actualiser();});emplacement.setAttribute('aria-label',t('Emplacement'));
 const annoncer=r=>{if(!vivante())return;statut.hidden=false;statut.textContent=['conserve','deja_conserve'].includes(r?.issue)?t('Conservé sur cet appareil.'):r?.issue==='sans_changement'?t('Aucun changement à enregistrer.'):texteErreurInventaire(r);};
 async function geste(fn){if(occupe||!vivante())return;occupe=true;ajouter.disabled=true;try{const r=await fn();if(!vivante()||!r)return;annoncer(r);if(['conserve','deja_conserve','sans_changement'].includes(r.issue))await actualiser();}catch{annoncer({});}finally{occupe=false;ajouter.disabled=false;}}
 const ajouter=el('button',{class:'btn primary',type:'button',dataset:{role:'ajouter-lot'},onClick:()=>{void geste(()=>ouvrirFormulaireLot({service,portee,ctx,estCourante:vivante}));}},t('Ajouter un lot'));
 root.append(el('div',{class:'row'},ajouter,filtre,emplacement),el('p',{class:'muted'},t('Les dates sont celles que tu indiques. Aucune durée de conservation n’est calculée.')),liste);
 const comparaison=creerComparaisonInventaire({service,portee,estCourante:vivante,onConserve:()=>actualiser()});root.append(comparaison);
 async function dessiner(){const r=await service.listerLots({portee,filtre:filtre.value});if(!vivante())return;if(r.issue!=='ok'){annoncer(r);return;}const rows=r.lots.filter(x=>!emplacement.value||x.projection.location===emplacement.value);liste.replaceChildren();if(!rows.length)liste.append(emptyState('flocon',t('Aucun lot dans cette liste.')));
  for(const lu of rows){const p=lu.projection,lot=lu.affiche.lot,carte=el('article',{class:'inventaire-lot card stack',dataset:{lotId:p.id}},resumeLotInventaire(p));
   if(p.adoption_requise)carte.append(el('p',{class:'status warn'},t('Ancien lot : quantité à confirmer avec Modifier.')));
   if(p.etat==='invalid')carte.append(el('p',{class:'status warn'},t('Les informations de ce lot ne permettent pas de modifier le stock. Sa copie reste consultable.')));
   carte.append(el('p',{class:'muted'},({congelateur:t('Congélateur'),frigo:t('Frigo'),garde_manger:t('Garde-manger')})[p.location]||t('Emplacement non indiqué')));
   const details=el('details',null,el('summary',null,t('Détails du lot')),el('div',{class:'stack'},p.quantite.mention_origine?el('p',null,t('Mention d’origine : {texte}',{texte:p.quantite.mention_origine})):null,p.quantite.initial!=null?el('p',null,t('Quantité initiale : {n}',{n:p.quantite.initial})):null,el('p',null,t('Préparé le : {date}',{date:dateLotInventaire(p.dates.prepared)})),el('p',null,t('À utiliser avant : {date}',{date:dateLotInventaire(p.dates.use_by)})),lot.notes?el('p',{style:{whiteSpace:'pre-wrap'}},lot.notes):null));
   if(p.source.recipe_id)details.append(el('a',{href:'#/recipes/'+encodeURIComponent(p.source.recipe_id)+(p.source.version_id?'?v='+encodeURIComponent(p.source.version_id):'')},lu.affiche.recipe?.display_title||lu.affiche.recipe?.original_title||t('Recette source indisponible')));carte.append(details);
   const commandes=el('div',{class:'row'}),bouton=(role,texte,action)=>el('button',{class:'btn',type:'button',dataset:{role},onClick:()=>{void geste(action);}},texte);
   if(p.actions.modifier||p.actions.adopter)commandes.append(bouton('modifier-lot',t('Modifier'),()=>ouvrirFormulaireLot({service,portee,lu,ctx,estCourante:vivante})));
   if(p.actions.consommer)commandes.append(bouton('consommer-lot',t('Utiliser une quantité'),()=>ouvrirMouvementLot({service,portee,lu,action:'consume',estCourante:vivante})));
   if(p.actions.terminer)commandes.append(bouton('terminer-lot',t('Tout consommé'),()=>ouvrirMouvementLot({service,portee,lu,action:'finish',estCourante:vivante})));
   if(p.actions.annuler)commandes.append(bouton('annuler-consommation',t('Annuler cette consommation'),()=>ouvrirMouvementLot({service,portee,lu,action:'undo',estCourante:vivante})));
   carte.append(commandes,el('p',{class:'muted'},({locale:t('Conservé sur cet appareil.'),en_attente:t('Conservé ici, en attente d’envoi.'),confirmee:t('Synchronisé.'),conflit:t('Modification à comparer.')})[p.synchronisation?.etat]||t('Conservé sur cet appareil.')));liste.append(carte);
  }
  await comparaison.actualiser();
 }
 function actualiser(){if(!vivante())return Promise.resolve();actualisationDemandee=true;if(vol)return vol;vol=(async()=>{while(actualisationDemandee&&vivante()){actualisationDemandee=false;await dessiner();}})().catch(()=>annoncer({})).finally(()=>{vol=null;});return vol;}
 root.actualiser=actualiser;root.dispose=()=>{detruit=true;comparaison.dispose();};await actualiser();if(query.add==='1'&&vivante())queueMicrotask(()=>ajouter.click());return root;
}
