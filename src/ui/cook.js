import {preparerLectureRecette,projeterLectureRecette} from '../domain/lecture-recette.js';
import {projectionCandidateTraduction} from '../domain/traductions-format.js';
import {canoniqueSources} from '../domain/sources-format.js';
import {creerServiceCuisine} from '../domain/cuisine-persistance.js';
import {el} from '../core/dom.js';
import {t} from '../core/i18n.js';
import {navigate,refresh} from '../core/router.js';
import * as repo from '../model/repo.js';
import {scaleVersion} from '../domain/scaling.js';
import {describeDuration} from '../domain/timers.js';
import {section,field,select,segmented,ingredientLectureEl,segmentLectureEl,etiquetteIA,estExtractionNonRelue,contexteFichiers,empreintesPhotos,fichierPhoto} from './components.js';
import {estCreationIA,AVERTISSEMENT_CREATION_IA} from '../domain/creation-ia.js';
import {panneauGardeThermomix,rappelThermomix} from './thermomix-garde.js';
import {mentionCycleRecette} from './corbeille.js';
import {photosPersonnellesParRecette,photoPrincipale} from '../domain/cuisine-personnelle.js';
import {photoVisible} from './photos-visibles.js';
import {ouvrirCuissons,noteEnCuisine} from './cuisson.js';
import {getSyncGeneration} from './state.js';
import {creerPanneauMinuteurs,commandesMinuteurEtape} from './minuteurs-session.js';
import {creerControleurEcran,creerCommandeEcranAllume} from './ecran-allume.js';
import {creerControleurVoix,texteEtatVoix} from './voix-cuisine.js';
import {creerPanneauComparaisonCuisine} from './comparaison-cuisine.js';

// Les contrôleurs restent montés ; les seuls champs confirmés par le service deviennent la vue courante.
export async function renderCook(params,query,ctx,deps={}){
 const depot=deps.repo??repo,base=depot.db,generation=getSyncGeneration();
 let dispose=false,lecture=null,affiche=null,projection=null,items=[],occupe=false,bilanOuvert=false,planOuvert=false,numeroLecture=0,lectureEnCours=null,relireEnsuite=false,vueConfirmee=null,selectionEnAttente=null;
 const root=el('div',{class:'mode-cuisine'}),estCourante=()=>!dispose&&getSyncGeneration()===generation&&(!base||depot.db===base);
 const service=deps.service??creerServiceCuisine({repo:depot,getGeneration:getSyncGeneration,maintenant:deps.maintenant??(()=>new Date().toISOString()),newId:depot.newId});
 const ouvertures=new Map(),traductionsChoisies=new Map(),traductionsPerimees=new Map();
 const nettoyages=[],permanents=[];
 const nettoyer=()=>{for(const fn of nettoyages.splice(0))fn();};
 let panneau=null,comparaisons=null,commandeEcran=null,voix=null,ecran=null;
 root.dispose=()=>{if(dispose)return;dispose=true;numeroLecture++;nettoyer();permanents.splice(0).forEach(fn=>fn());panneau?.dispose?.();comparaisons?.dispose?.();commandeEcran?.dispose?.();ecran?.detruire();voix?.detruire();};
 root.actualiserCuisine=actualiser;
 const capture=await service.capturerPortee({owner_id:ctx.proprietaireDonnees??null,estCourante});
 if(capture.issue!=='ok'||!estCourante()){root.append(el('p',{class:'status warn'},t('La bibliothèque a changé. Rouvre la séance de cuisine.')));return root;}
 const portee=capture.portee;
 const titre=el('h1',null,t('Cuisine')),fiche=el('a',{class:'btn',dataset:{role:'fiche-cuisine'}},t('Fiche'));
 const etat=el('p',{class:'status warn',role:'status',hidden:true,dataset:{role:'etat-cuisine'}});
 const terminer=el('button',{class:'btn',type:'button',onClick:()=>finir([])},t('Terminer'));
 const langues=[{value:'original',label:t('Original')},{value:'fr',label:t('Français')},{value:'en',label:t('Anglais')}];
 const langueChoix=segmented(langues,'original',lang=>geste('langue',{lang}));langueChoix.dataset.role='langue-cuisine';langueChoix.setAttribute('role','group');langueChoix.setAttribute('aria-label',t('Langue de lecture'));
 const entete=el('div',{class:'cuisine-entete'},titre,el('div',{class:'row'},terminer,fiche));
 const avertissements=el('div',{class:'stack',dataset:{role:'avertissements-cuisine'}}),onglets=el('div',{class:'row cuisine-recettes',role:'group','aria-label':t('Recette active')});
 const outils=el('div',{class:'row cuisine-outils'},langueChoix),contenu=el('div',{class:'cuisine-contenu'}),navigation=el('div',{class:'controls cuisine-navigation navigation-cuisine'}),photoHote=el('div');
 panneau=(deps.creerPanneauMinuteurs??creerPanneauMinuteurs)({sessionId:params.id,ctx,service,portee,estCourante});panneau.classList.add('cuisine-minuteurs');
 comparaisons=creerPanneauComparaisonCuisine({sessionId:params.id,ctx,repo:depot,getGeneration:getSyncGeneration,estCourante,onConserve:actualiser});
 ecran=(deps.creerControleurEcran??creerControleurEcran)({document:deps.document??document,wakeLock:deps.wakeLock??globalThis.navigator?.wakeLock,estCourante});
 commandeEcran=(deps.creerCommandeEcranAllume??creerCommandeEcranAllume)({controleur:ecran});outils.append(commandeEcran);
 voix=(deps.creerControleurVoix??creerControleurVoix)({speechSynthesis:deps.speechSynthesis??globalThis.speechSynthesis,SpeechSynthesisUtterance:deps.SpeechSynthesisUtterance??globalThis.SpeechSynthesisUtterance,estCourante});
 root.append(entete,onglets,outils,etat,avertissements,contenu,navigation,panneau,comparaisons,photoHote);
 const ctxF=await contexteFichiers(ctx),photos=photosPersonnellesParRecette(ctx.cook_history||[]);let fichiers=new Map();
 const initiale=await service.lireSession({portee,sessionId:params.id});
 if(initiale.issue!=='ok'||!estCourante()){signaler(initiale);terminer.disabled=true;fiche.hidden=true;return root;}
 await recevoir(initiale);await panneau.actualiser?.();
 const revenir=()=>actualiser();for(const event of ['focus','pageshow']){window.addEventListener(event,revenir);permanents.push(()=>window.removeEventListener(event,revenir));}
 const visible=()=>{if(document.visibilityState==='visible')actualiser();};document.addEventListener('visibilitychange',visible);permanents.push(()=>document.removeEventListener('visibilitychange',visible));
 return root;

 function signaler(resultat,type){etat.hidden=false;etat.textContent=resultat?.raison==='session_terminee'?t('Cette séance est terminée. Les suivis de durée restent consultables.'):!estCourante()?t('La bibliothèque a changé. Rouvre la séance de cuisine.'):type==='langue'?t('La langue de lecture n’a pas pu être enregistrée. Réessaie.'):type==='selection'?t('La sélection n’a pas été enregistrée. La session ou la recette a changé ; réessaie après rechargement.'):type==='progression'?t('La progression n’a pas été enregistrée. La session ou la recette a changé ; réessaie après rechargement.'):t('Le changement n’a pas été conservé. Ta séance reste disponible ; relis son état avant de réessayer.');}
 async function recevoir(resultat){
  const n=++numeroLecture;if(!resultat.affiche||!resultat.projection)return false;
  const nouvelles=resultat.affiche,proj=resultat.projection;
  for(const [key,choix]of traductionsChoisies){if(!choix.id)continue;const row=nouvelles.traductions.find(r=>r.id===choix.id);if((row?cleRendu(projectionCandidateTraduction(row)):null)!==choix.exact){traductionsPerimees.set(key,choix.id);traductionsChoisies.delete(key);}}
  const sansDates=row=>{if(!row)return null;const copie=structuredClone(row);delete copie.created_at;delete copie.updated_at;return copie;};
  const signature=cleRendu({projection:proj,units:nouvelles.session.units??null,versions:nouvelles.versions.map(r=>({version_id:r.version_id,version:sansDates(r.version),recipe:sansDates(r.recipe),edition:sansDates(r.edition)})),traductions:nouvelles.traductions.map(projectionCandidateTraduction)});
  if(signature===vueConfirmee){lecture=resultat.lecture;affiche=nouvelles;projection=proj;return true;}
  const prochains=await Promise.all(nouvelles.versions.map(async entree=>{
   const p=proj.versions.find(v=>v.version_id===entree.version_id),version=entree.version,recipe=entree.recipe;
   if(!version||!recipe)return{...entree,projection:p};
   const bloquees=new Set(traductionsPerimees.values()),traductions=nouvelles.traductions.filter(tr=>!bloquees.has(tr.id));
   const preparee=await preparerLectureRecette({recipe,version,traductions});
   return{...entree,projection:p,servings:p?.servings??null,scaled:scaleVersion(version,p?.servings??null),convention_id:ctx.conventionFor?.(recipe)??null,lecture:preparee};
  }));
  const images=empreintesPhotos(prochains.filter(x=>x.recipe).map(x=>x.recipe),photos);
  let lus=new Map();try{lus=images.length?await depot.getFiles(images):new Map();}catch{}
  if(!estCourante()||n!==numeroLecture)return false;
  voix.arreter();lecture=resultat.lecture;affiche=nouvelles;projection=proj;items=prochains;fichiers=lus;vueConfirmee=signature;dessiner();return true;
 }
 async function actualiser(){
  if(!estCourante()){voix?.arreter();if(lecture)signaler({});return false;}
  if(occupe||bilanOuvert){relireEnsuite=true;return false;}
  if(lectureEnCours){relireEnsuite=true;return lectureEnCours;}
  lectureEnCours=(async()=>{const r=await service.lireSession({portee,sessionId:params.id});if(!estCourante())return false;await Promise.all([panneau.actualiser?.(),comparaisons.actualiser?.()]);if(r.issue!=='ok'){signaler(r);terminer.disabled=true;return false;}return recevoir(r);})().catch(()=>{if(estCourante())signaler({});return false;}).finally(()=>{lectureEnCours=null;if(relireEnsuite&&estCourante()&&!occupe&&!bilanOuvert){relireEnsuite=false;actualiser();}});
  return lectureEnCours;
 }
 async function geste(type,valeurs,{focus=false}={}){
  if(type==='selection'&&occupe&&!bilanOuvert&&estCourante()){selectionEnAttente={...valeurs};return;}
  if(occupe||bilanOuvert||!estCourante()||projection?.etat!=='active')return;
  const avant=lecture,versionCapturee=projection.active_version_id;occupe=true;etat.hidden=true;verrouiller();voix.arreter();
  try{
   const methode=type==='selection'?'preparerSelection':type==='langue'?'preparerLangue':'preparerProgression';
   const preparation=await service[methode]({portee,lecture:avant,...valeurs});
   if(preparation.issue!=='ok'){signaler(preparation,type);return;}
   const resultat=await service.appliquerSession({intention:preparation.intention});
   if(!estCourante())return;
   if(!['conserve','deja_conserve'].includes(resultat.issue)){signaler(resultat,type);return;}
   if(type==='selection')planOuvert=false;
   await recevoir(resultat);
   if(focus&&(type==='selection'||projection.active_version_id===versionCapturee))contenu.querySelector('[data-role=titre-etape]')?.focus({preventScroll:true});
  }catch{if(estCourante())signaler({},type);}
  finally{occupe=false;if(estCourante()){verrouiller();if(selectionEnAttente){const suivante=selectionEnAttente;selectionEnAttente=null;geste('selection',suivante,{focus:true});}else if(relireEnsuite){relireEnsuite=false;actualiser();}}}
 }
 function verrouiller(){const ferme=bilanOuvert||!estCourante()||projection?.etat!=='active',bloque=occupe||ferme;for(const b of root.querySelectorAll('[data-mutation-cuisine]'))b.disabled=(b.dataset.actionCuisine==='selection'?ferme:bloque)||b.dataset.interdit==='true';terminer.disabled=bloque||items.some(it=>!it.version||!it.recipe||!it.projection?.execution_autorisee);for(const b of langueChoix.querySelectorAll('button'))b.disabled=bloque;}
 // Clé d’affichage seulement : les valeurs héritées undefined ne sont jamais réécrites.
 function cleRendu(value){return canoniqueSources(JSON.parse(JSON.stringify(value)));}
 function cleTraduction(vid){return vid+':'+projection.lang;}
 function lectureDe(it){const choix=traductionsChoisies.get(cleTraduction(it.version.id));return projeterLectureRecette(it.lecture,{locale:projection.lang,servings:it.servings,system:affiche.session.units||'original',convention_id:it.convention_id,ingredientsById:ctx.ingredientsById,translationId:choix?.id??(choix?'__original__':null)});}
 function mutation(label,fn,{interdit=false,classe='btn',role=null}={}){return el('button',{class:classe,type:'button',disabled:interdit,dataset:{mutationCuisine:'',interdit:String(interdit),...(role?{role}:{})},onClick:fn},label);}
 function dessiner(){
  nettoyer();voix.arreter();contenu.replaceChildren();navigation.replaceChildren();photoHote.replaceChildren();avertissements.replaceChildren();onglets.replaceChildren();
  const active=items.find(it=>it.version_id===projection.active_version_id),session=affiche.session;
  const pr=active?.lecture?lectureDe(active):null;
  if(pr?.traductionId){const row=affiche.traductions.find(r=>r.id===pr.traductionId);if(row)traductionsChoisies.set(cleTraduction(active.version.id),{id:row.id,exact:cleRendu(projectionCandidateTraduction(row))});}
  titre.textContent=items.length>1?t('Repas — {n} recettes',{n:items.length})+(pr?' · '+pr.titre.texte:''):pr?.titre.texte||t('Cuisine');
  fiche.hidden=!active?.recipe||!active?.version;if(!fiche.hidden)fiche.href=`#/recipes/${encodeURIComponent(active.recipe.id)}?v=${encodeURIComponent(active.version.id)}`;
  for(const [i,b]of [...langueChoix.children].entries()){b.classList.toggle('active',langues[i].value===projection.lang);b.setAttribute('aria-pressed',String(langues[i].value===projection.lang));}
  for(const it of items){const b=mutation(it.recipe?.display_title||it.recipe?.original_title||t('Version indisponible'),()=>geste('selection',{versionId:it.version_id}),{interdit:!it.version||!it.recipe,classe:'btn small'});b.dataset.versionId=it.version_id;b.dataset.actionCuisine='selection';b.classList.toggle('active',it.version_id===projection.active_version_id);b.setAttribute('aria-pressed',String(it.version_id===projection.active_version_id));onglets.append(b);}
  if(items.length>1)onglets.append(el('button',{type:'button',class:'btn small','aria-pressed':String(planOuvert),onClick:()=>{planOuvert=!planOuvert;dessiner();}},t('Plan commun')));
  for(const it of items.filter(x=>x.recipe&&x.version)){
   const mention=mentionCycleRecette(it.recipe,it.edition);if(mention)avertissements.append(mention);
   const nom=items.length>1?(it.recipe.display_title||it.recipe.original_title)+' · ':'';
   const etiquette=etiquetteIA(it.version,it.recipe);if(etiquette)avertissements.append(el('div',{dataset:{role:'cuisine-ia'}},el('span',null,nom,etiquette),...(estCreationIA(it.version)?[el('p',{class:'status warn',dataset:{role:'avertissement-ia'}},t(AVERTISSEMENT_CREATION_IA))]:[])));
   if(estExtractionNonRelue(it.version))avertissements.append(el('p',{class:'status warn',dataset:{role:'bandeau-non-relue'}},nom,t('Lue par l’assistant, non relue')));
   const rappel=rappelThermomix(it.version);if(rappel)avertissements.append(rappel);
  }
  if(projection.etat==='terminee')avertissements.append(el('p',{class:'status'},t('Cette séance est terminée. Les suivis de durée restent consultables.')));
  if(projection.absents.length)avertissements.append(el('p',{class:'status warn'},t('Une version de cette séance est indisponible. Les autres contenus et les suivis restent conservés.')));
  if(projection.ambigus.length)avertissements.append(el('p',{class:'status warn'},t('Certaines étapes anciennes ne peuvent pas être attribuées à une seule recette. Leur historique est conservé.')));
  if(planOuvert){contenu.append(planCommun());verrouiller();return;}
  if(!active?.version||!active?.recipe||!pr){const garde=panneauGardeThermomix(items.filter(it=>it.version&&it.recipe));contenu.append(garde||el('p',{class:'status warn'},t('La version active est indisponible. Choisis une autre recette de cette séance.')));verrouiller();return;}
  const gardeActive=panneauGardeThermomix([active]);if(gardeActive){contenu.append(gardeActive);verrouiller();return;}
  const ingredients=el('details',{class:'cuisine-ingredients ingredients-cuisine',role:'region','aria-label':t('Ingrédients de la recette'),dataset:{role:'ingredients-cuisine',versionId:active.version.id}},el('summary',null,t('Ingrédients de la recette')));
  const ingCorps=el('div',{class:'cuisine-ingredients-corps'},el('p',{class:'muted'},active.servings===null?t('Portions inconnues'):t('{n} portions',{n:active.servings})),el('ul',{class:'ingredients list plain'},...pr.blocs.map(l=>l.kind==='heading'?el('li',{class:'ingredient-heading',dataset:{role:'ingredient-heading'}},segmentLectureEl(l)):ingredientLectureEl(l))),...active.scaled.notes.map(n=>el('p',{class:'muted'},n)));
  const region=el('section',{class:'cuisine-etape stack',role:'region','aria-label':t('Étape de la recette'),tabindex:'-1',dataset:{role:'cuisine-etape',versionId:active.version.id}});
  const steps=pr.etapes,idx=steps.findIndex(s=>s.id===active.projection.display_step_id),step=idx>=0?steps[idx]:null;
  const titreEtape=el('h2',{tabindex:'-1',dataset:{role:'titre-etape'}},step?t('Étape {n} sur {total}',{n:idx+1,total:steps.length}):t('Préparation'));
  ingCorps.append(el('button',{class:'btn small cuisine-retour-etape',type:'button',onClick:()=>{titreEtape.focus({preventScroll:true});titreEtape.scrollIntoView?.({block:'nearest'});}},t('Revenir à l’étape')));ingredients.append(ingCorps);
  let large=false,largeurObservee=null,rafLargeur=null,regionDetruite=false;
  const programmerLargeur=()=>{if(regionDetruite||dispose||rafLargeur!==null)return;rafLargeur=requestAnimationFrame(()=>{rafLargeur=null;if(regionDetruite||dispose)return;large=largeurObservee>=900;const ouvrir=large||!!ouvertures.get(active.version.id);if(ingredients.open!==ouvrir)ingredients.open=ouvrir;});};
  // Observer la largeur seulement : ouvrir details modifie sa hauteur et ne doit
  // jamais produire une seconde écriture géométrique dans ResizeObserver.
  const mesurerLargeur=()=>{if(regionDetruite||dispose)return;const largeur=root.getBoundingClientRect().width;if(largeur===largeurObservee)return;largeurObservee=largeur;programmerLargeur();};
  const basculer=()=>{if(regionDetruite||dispose)return;if(!large)ouvertures.set(active.version.id,ingredients.open);else if(!ingredients.open)programmerLargeur();};
  ingredients.open=!!ouvertures.get(active.version.id);ingredients.addEventListener('toggle',basculer);
  nettoyages.push(()=>{regionDetruite=true;if(rafLargeur!==null)cancelAnimationFrame(rafLargeur);ingredients.removeEventListener('toggle',basculer);});
  if(globalThis.ResizeObserver){const obs=new ResizeObserver(mesurerLargeur);obs.observe(root);nettoyages.push(()=>obs.disconnect());}else{window.addEventListener('resize',mesurerLargeur);nettoyages.push(()=>window.removeEventListener('resize',mesurerLargeur));}
  mesurerLargeur();
  const cle=cleTraduction(active.version.id);
  if(traductionsPerimees.has(cle))region.append(el('p',{class:'status warn'},t('La traduction choisie a changé. L’original reste affiché jusqu’à ta relecture.')),el('button',{class:'btn',type:'button',onClick:async()=>{traductionsPerimees.delete(cle);vueConfirmee=null;await recevoir({lecture,affiche,projection});}},t('Relire la traduction mise à jour')));
  if(pr.candidates.length>1){const choix=select([{value:'',label:t('Original')},...pr.candidates.map((x,i)=>({value:x.id,label:t('Traduction {n}',{n:i+1})}))],traductionsChoisies.get(cle)?.id||'',id=>{const row=affiche.traductions.find(r=>r.id===id);traductionsChoisies.set(cle,row?{id,exact:cleRendu(projectionCandidateTraduction(row))}:{id:null});dessiner();});choix.dataset.role='choix-traduction';region.append(field(t('Plusieurs traductions existent. Choisis celle à lire.'),choix));}
  const note=noteEnCuisine(active.recipe);if(note)region.append(note);
  const n=active.projection.done_step_ids.length,total=active.projection.total_steps;region.append(el('p',{class:'muted',dataset:{role:'progression-cuisine'}},total===null?t('Progression partielle'):t('{d}/{n} étapes',{d:n,n:total})),titreEtape);
  const garde=panneauGardeThermomix([active]);if(garde)region.append(garde);
  if(step)region.append(el('div',{class:'step-big'},segmentLectureEl(step,{role:'texte-etape'})));
  else region.append(el('p',{class:'status warn'},steps.length?t('L’étape conservée est indisponible. Choisis une étape de cette version.'):t('Aucune étape numérisée pour cette version.')));
  if(!step&&steps.length&&active.projection.execution_autorisee)region.append(select([{value:'',label:t('Choisir une étape')},...steps.map((s,i)=>({value:s.id,label:t('Étape {n}',{n:i+1})}))],'',id=>{if(id)geste('progression',{versionId:active.version.id,currentStepId:id,doneAdd:[]},{focus:true});}));
  if(step&&active.projection.execution_autorisee&&projection.etat==='active')for(let ordinal=0;ordinal<(step.timers||[]).length;ordinal++){
   const commande=(deps.commandesMinuteurEtape??commandesMinuteurEtape)({service,portee,lecture,version:active.version,recipe:active.recipe,step,ordinal,recipeTitle:pr.titre.texte,estCourante,onConserve:()=>{panneau.actualiser?.();relireEnsuite=true;if(!occupe&&!bilanOuvert)actualiser();},locale:ctx.settings?.ui_locale||'fr',deps});region.append(commande);nettoyages.push(()=>commande.dispose?.());
  }
  if(pr.manque)region.append(el('p',{class:'status warn',dataset:{role:'traduction-manquante'}},t('Les passages non traduits restent dans leur langue d’origine.')));
  const etatVoix=el('span',{class:'muted',role:'status',dataset:{role:'etat-voix'}});const stop=voix.souscrire(e=>{etatVoix.textContent=texteEtatVoix(e);});nettoyages.push(stop);
  if(step)region.append(el('div',{class:'row'},el('button',{class:'btn',type:'button',onClick:()=>voix.lire({texte:step.texte,langReelle:step.langReelle})},t('Lire à voix haute')),etatVoix));
  const avancer=delta=>{if(!step)return;const cible=steps[idx+delta];if(!cible)return;return geste('progression',{versionId:active.version.id,currentStepId:cible.id,doneAdd:delta>0?[step.id]:[]},{focus:true});};
  const bloque=!active.projection.execution_autorisee||projection.etat!=='active';
  navigation.append(mutation('← '+t('Précédent'),()=>avancer(-1),{interdit:bloque||idx<=0,role:'precedent-cuisine'}),idx>=0&&idx<steps.length-1?mutation(t('Suivant')+' →',()=>avancer(1),{interdit:bloque,classe:'btn primary',role:'suivant-cuisine'}):mutation(t('Terminer'),()=>finir(step?[{version_id:active.version.id,step_ids:[step.id]}]:[]),{interdit:bloque,classe:'btn primary',role:'terminer-cuisine'}));
  region.addEventListener('keydown',event=>{if(event.defaultPrevented||event.repeat||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||document.querySelector('dialog[open]')||event.target.closest('button,a,input,textarea,select,summary,[contenteditable]:not([contenteditable="false"])'))return;if(!['ArrowLeft','ArrowRight'].includes(event.key)||bloque)return;event.preventDefault();avancer(event.key==='ArrowRight'?1:-1);});
  contenu.append(ingredients,region);const sha=photoPrincipale(active.recipe,photos)?.sha256;const photo=el('details',{class:'photo-cuisine',dataset:{role:'photo-cuisine'}},el('summary',null,t('Voir la photo du plat')));const image=photoVisible(sha,{fichier:fichierPhoto(active.recipe,photos,fichiers),ctxF,classe:'photo-cuisine-image',personnelle:!!photos.get(active.recipe.id)});photo.append(image||el('p',{class:'muted'},t('Aucune photo pour cette recette.')));if(image)nettoyages.push(()=>image.dispose?.());photoHote.append(photo);verrouiller();
 }
 function planCommun(){
  const lignes=items.flatMap(it=>{
   if(!it.lecture)return[el('li',null,t('Version indisponible'))];
   return lectureDe(it).etapes.map(step=>el('li',null,
    el('strong',null,it.recipe.display_title||it.recipe.original_title),' · ',
    el('span',{style:{textDecoration:it.projection.done_step_ids.includes(step.id)?'line-through':'none'}},step.texte),
    ...(step.timers||[]).map(tm=>el('span',{class:'chip'},t('Durée indiquée : {d}',{d:describeDuration(tm.seconds,ctx.settings?.ui_locale||'fr')+(tm.seconds_max!=null&&tm.seconds_max!==tm.seconds?' – '+describeDuration(tm.seconds_max,ctx.settings?.ui_locale||'fr'):'')})))));
  });
  return section(t('Plan commun'),
   el('p',{class:'muted'},t('Durées indiquées dans chaque recette. Vérifie leur déroulement avant de les combiner.')),
   el('ul',{class:'list'},...lignes),
   el('button',{class:'btn',type:'button',onClick:()=>{planOuvert=false;dessiner();}},t('Retour aux étapes')));
 }
 async function finir(doneAdd){
  if(occupe||bilanOuvert||!estCourante()||terminer.disabled)return;bilanOuvert=true;verrouiller();voix.arreter();
  const lectureBilan=lecture,sessionBilan=structuredClone(affiche.session),active=items.find(it=>it.version_id===projection.active_version_id);
  try{const minuteurs=await service.lireMinuteurs({portee,sessionId:params.id});if(!estCourante())return;if(minuteurs.issue!=='ok'){signaler(minuteurs);return;}
   const confirmer=deps.ouvrirCuissons??ouvrirCuissons;const ok=await confirmer(items.map(it=>({recipe:it.recipe,version:it.version,servings:it.servings,scaled:it.scaled})),{...deps,ctx,repo:depot,session:sessionBilan,cuisine:{service,portee,lecture:lectureBilan,doneAdd},suivisActifs:minuteurs.actifs.length});
   if(ok&&estCourante())(deps.navigate??navigate)(sessionBilan.meal_id?`/meals/${encodeURIComponent(sessionBilan.meal_id)}`:`/recipes/${encodeURIComponent(active.recipe.id)}`);
  }catch{if(estCourante())signaler({});}finally{bilanOuvert=false;if(estCourante()){verrouiller();if(relireEnsuite){relireEnsuite=false;actualiser();}}}
 }
}
export {refresh};
