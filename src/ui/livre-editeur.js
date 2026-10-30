import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { refresh, parseHash, buildQuery, remplacerAdresse } from '../core/router.js';
import * as depot from '../model/repo.js';
import { getSyncGeneration, invalidate } from './state.js';
import { field, select } from './components.js';
import { listConventions } from '../domain/units.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes, motsClesExistants } from './puces.js';
import { creerControleurEditeur, statutBrouillon, panneauRepriseBrouillon, panneauComparaisonBrouillon, texteErreurBrouillon, boutonsRecuperationTexte } from './brouillon-editeur.js';
import { protegerSortieEditeur } from './sortie-editeur.js';

export async function renderLivreEditeur({book,edition,ctx={},query={},deps={}}){
 const repo=deps.repo||depot,service=deps.serviceBrouillons||(await import('../domain/brouillons-editeur.js')).creerServiceBrouillons({repo,getGeneration:getSyncGeneration});
 const root=el('details',{class:'card livre-editeur',open:query.panel==='modifier'||!!query.draft,dataset:{role:'modifier-livre'}},el('summary',null,el('strong',null,t('Métadonnées et convention'))));
 const hote=el('div',{class:'stack'});root.append(hote);
 let detruit=false,controleur=null,nettoyerGarde=null,stopConservation=null,statut=null,modele=null,session=null,portee=null;
 const vivante=()=>!detruit;
 const nettoyer=()=>{nettoyerGarde?.();nettoyerGarde=null;stopConservation?.();stopConservation=null;statut?.dispose?.();controleur?.detruire();};
 const adresseBrouillon=id=>{const actuelle=parseHash();if(root.isConnected&&edition?.id&&actuelle.path===`/books/${encodeURIComponent(edition.id)}`)remplacerAdresse(actuelle.path+buildQuery({...actuelle.query,draft:id||undefined}));};
 root.dispose=()=>{detruit=true;nettoyer();};root.flushEditeur=()=>controleur?.flush();root.etatEditeur=()=>controleur?.etat();
 const capture=await service.capturerPortee({owner_id:Object.hasOwn(ctx,'proprietaireDonnees')?ctx.proprietaireDonnees:(await repo.get('sync_state','user_id'))?.value??null,estCourante:vivante});
 if(capture.issue!=='ok'){hote.append(el('p',{role:'status'},texteErreurBrouillon(capture)));return root;}portee=capture.portee;
 const comparer=async(resultat)=>{
  const e=controleur?.etat(),r=resultat||await service.comparerBrouillon({id:e.id,portee,expectedRevision:e.revision});
  if(!vivante())return;
  if(r.issue!=='ok'){erreur.textContent=texteErreurBrouillon(r);return;}
  comparaison.replaceChildren(panneauComparaisonBrouillon({service,id:e?.id||query.draft,portee,revision:e?.revision,session,resultat:r,onReprendre:monter,estCourante:vivante,onDecision:decision=>{controleur.reprendre({session,id:e.id,revision:decision.revision});comparaison.replaceChildren();}}));
 };
 const erreur=el('p',{role:'status','aria-live':'polite',dataset:{role:'erreur-editeur-livre'}}),comparaison=el('div');
 async function monter(ouverture){
  if(!vivante())return;nettoyer();modele=structuredClone(ouverture.modele??ouverture.brouillon?.payload);session=ouverture.session;
  erreur.textContent='';comparaison.replaceChildren();
  controleur=creerControleurEditeur({service,session,id:ouverture.id??ouverture.brouillon?.id??null,revision:ouverture.revision??ouverture.brouillon?.revision??null,lirePayload:()=>modele});
  const changer=(g,k,v)=>{modele[g][k]=v;controleur.modifier();};
  const input=(g,k,type='text')=>el('input',{type,value:modele[g][k],name:k,...(k==='title'&&query.panel==='modifier'?{dataset:{navOuverture:'focus'}}:{}),onInput:e=>changer(g,k,e.target.value)});
  const puces=k=>{const box=el('div');const dessiner=()=>box.replaceChildren(renderPuces(pucesModel({choisies:modele.book[k],existantes:k==='tags'?motsClesExistants(ctx):cuisinesExistantes(ctx),...(k==='tags'?{graine:[]}: {})}),{
   basculer:v=>{changer('book',k,basculerPuce(modele.book[k],v));dessiner();},ajouter:v=>{const prochain=ajouterPuce(modele.book[k],v);if(prochain!==modele.book[k]){changer('book',k,prochain);dessiner();}}},k==='tags'?{libelleAutre:t('Autre mot-clé')}:{}));dessiner();return box;};
  const champs=el('fieldset',{class:'editeur-champs'},el('legend',null,t('Informations du livre')),
   el('p',{class:'muted'},t('Le titre, l’auteur, les cuisines et les mots-clés concernent toutes les éditions de ce livre.')),
   field(t('Titre'),input('book','title')),field(t('Auteur / chef'),input('book','author')),field(t('ISBN'),input('edition','isbn')),field(t('Éditeur'),input('edition','publisher')),field(t('Année'),input('edition','year')),
   field(t('Langue'),select([{value:'',label:t('Non renseigné')},{value:'fr',label:'Français'},{value:'en',label:'English'},{value:'other',label:t('Autre')}],modele.edition.language,v=>changer('edition','language',v))),
   el('div',{class:'field'},el('span',null,t('Cuisines')),puces('cuisines')),el('div',{class:'field'},el('span',null,t('Mots-clés')),puces('tags')),
   field(t('Convention de mesure'),select([{value:'',label:t('Non confirmée')},...listConventions().map(c=>({value:c.id,label:c.labels.fr}))],modele.edition.unit_convention_id,v=>changer('edition','unit_convention_id',v)),t('Ordre de décision : équivalences imprimées → convention décrite dans le livre → convention confirmée ici.')));
  let publishing=false,copieEnCours=false;
  const copie=el('button',{type:'button',class:'btn',hidden:true,onClick:async()=>{if(copieEnCours)return;copieEnCours=true;copie.disabled=true;try{const payload=structuredClone(modele),r=await service.copierBrouillon({session,payload});if(!vivante())return;if(r.issue==='ok'){await monter({...r,aConserver:true});await controleur.flush();}else erreur.textContent=texteErreurBrouillon(r);}catch{erreur.textContent=texteErreurBrouillon('stockage_indisponible');}finally{copieEnCours=false;copie.disabled=false;}}},t('Conserver une copie séparée'));
  const recuperation=el('div',{class:'stack',hidden:true},boutonsRecuperationTexte(()=>controleur.lireTexte()),copie);
  const direErreur=r=>{erreur.textContent=texteErreurBrouillon(r);recuperation.hidden=false;copie.hidden=r.raison!=='revision_changee';};
  const save=el('button',{type:'button',class:'btn primary',onClick:async()=>{
   if(publishing)return;publishing=true;champs.disabled=true;save.disabled=true;erreur.textContent='';
   try{const conservé=await controleur.flush();if(conservé.issue!=='ok'){direErreur(conservé);return;}
    if(!conservé.id){erreur.textContent=t('Aucune modification à enregistrer');return;}
    const p=await service.preparerPublication({id:conservé.id,portee,expectedRevision:conservé.revision});
    if(!vivante())return;
    if(p.issue==='sans_changement'){erreur.textContent=t('Aucune modification à enregistrer');return;}
    if(!['ok','deja_publie'].includes(p.issue)){erreur.textContent=texteErreurBrouillon(p);if(p.issue==='refuse')await comparer();return;}
    const r=p.issue==='deja_publie'?p:await service.publierBrouillon({plan:p.plan});if(!vivante())return;
    if(['publie','deja_publie'].includes(r.issue)){controleur.confirmerPublication(r);adresseBrouillon(null);invalidate();(deps.apresPublication||refresh)(r);}
    else{erreur.textContent=texteErreurBrouillon(r);if(r.issue==='refuse')await comparer();}
   }catch{erreur.textContent=texteErreurBrouillon('stockage_indisponible');}finally{publishing=false;champs.disabled=false;save.disabled=false;}
  }},t('Enregistrer'));
  statut=statutBrouillon(controleur);hote.replaceChildren(champs,statut,save,erreur,recuperation,comparaison);nettoyerGarde=protegerSortieEditeur({racine:root,controleur});
  stopConservation=controleur.souscrire(e=>{if(e.id&&e.revision&&!e.publie)adresseBrouillon(e.id);if(e.dernierResultat&&e.dernierResultat.issue!=='ok')direErreur(e.dernierResultat);save.disabled=publishing||e.publie||(!e.sale&&!e.id);});
  if(ouverture.aConserver)controleur.modifier();
 }
 const ouvrirNeuf=async()=>{const ouverture=await service.ouvrirBrouillon({kind:'book_metadata',intention:'metadata',portee,affiche:{book,edition}});if(!vivante())return;if(ouverture.issue==='ok')await monter(ouverture);else hote.append(el('p',{role:'status'},texteErreurBrouillon(ouverture)));};
 const reprise=id=>panneauRepriseBrouillon({service,id,portee,onReprendre:monter,onComparer:r=>{hote.append(comparaison,erreur);return comparer(r);},onEcarter:query.draft?async()=>{adresseBrouillon(null);await ouvrirNeuf();}:undefined,estCourante:vivante});
 if(query.draft)hote.append(await reprise(query.draft));
 else{
  const liste=service.listerBrouillons?await service.listerBrouillons({portee}):null;
  const anciens=liste?.issue==='ok'?liste.brouillons.filter(d=>d.kind==='book_metadata'&&d.entity_id===edition?.id):[];
  if(anciens.length){for(const ancien of anciens)hote.append(await reprise(ancien.id));hote.append(el('button',{type:'button',class:'btn',onClick:ouvrirNeuf},t('Commencer une autre modification')));}
  else await ouvrirNeuf();
 }
 return root;
}
