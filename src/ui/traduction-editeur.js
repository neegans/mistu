import {el,confirmDialog,downloadBlob,toast} from '../core/dom.js';
import {t} from '../core/i18n.js';
import {navigate,parseHash,remplacerAdresse} from '../core/router.js';
import * as repo from '../model/repo.js';
import {currentVersion} from '../domain/search.js';
import {providerFrom} from '../domain/llm.js';
import {creerLectureTraduction} from '../domain/lecture-traduction.js';
import {preparerLectureRecette,projeterLectureRecette} from '../domain/lecture-recette.js';
import {getSyncGeneration} from './state.js';
import {pageHeader,field,sessionAssistant,carteConnexion} from './components.js';
import {retourConnu,porteeNavigation} from './navigation-contexte.js';
import {destinationApresRecette} from './actions-contenu.js';
import {creerControleurEditeur,statutBrouillon,texteErreurBrouillon,panneauRepriseBrouillon,panneauComparaisonBrouillon,boutonsRecuperationTexte} from './brouillon-editeur.js';
import {protegerSortieEditeur} from './sortie-editeur.js';
import {demarrerConnexion} from './settings.js';

const libelle=s=>s.kind==='title'?t('Titre'):s.kind==='heading'?t('Titre du groupe'):s.kind==='step'?t('Étape'):s.kind==='notes'?t('Notes de cette version'):s.kind==='yield'?t('Rendement (facultatif)'):s.field==='name'?t('Ingrédient'):s.field==='preparation'?t('Préparation'):t('Texte source');
async function lectureDeLaCapture(source){
  const recipe={id:source.recipe_id,original_language:source.source_locale},version={id:source.recipe_version_id,recipe_id:source.recipe_id};
  for(const[cible,champs]of [[recipe,source.title_capture.fields],[version,source.projection.fields]])for(const[chemin,presence]of champs){if(!presence[0])continue;const morceaux=chemin.split('.');let objet=cible;for(const cle of morceaux.slice(0,-1))objet=objet[cle]??={};objet[morceaux.at(-1)]=structuredClone(presence[1]);}
  return preparerLectureRecette({recipe,version,traductions:[]});
}
const erreurTraduction=r=>{
  if(['budget_sortie','limite_appels','segments_non_eligibles','bornes'].includes(r?.raison))return t('Cette sélection dépasse les limites de traduction. Choisis moins de segments ou corrige-les à la main. Aucun appel n’a été lancé.');
  if(['reserve_pleine','limite_reserve','quota_stockage'].includes(r?.raison))return t('La lecture est en pause : conserve ou récupère les réponses présentes avant de libérer de la place.');
  if(r?.raison==='vol_en_cours')return t('Un autre appel de l’assistant est en cours. Attends sa fin.');
  if(r?.raison==='non_connecte')return t('Connecte-toi pour utiliser l’assistant.');
  if(['reseau','serveur','delai','quota','trop_de_demandes'].includes(r?.raison))return t('L’assistant est indisponible pour le moment. Les réponses déjà reçues sont conservées.');
  return texteErreurBrouillon(r);
};

export async function renderTraductionEditeur(params,query,ctx,deps={}){
  let dispose=false,controleur=null,controleurSortie=null,retirerGarde=null,vol=null,sessionActive=null,modele=null,source=null,publication=false;
  const baseRepo=repo.db,generation=getSyncGeneration(),estCourante=()=>!dispose&&repo.db===baseRepo&&getSyncGeneration()===generation;
  const depot=deps.depot||(await import('../domain/depot-traductions.js')).creerDepotTraductions({repo,getGeneration:getSyncGeneration});
  const service={...depot,reprendreSurBaseCourante:({comparaison,choixRepris,portee,reprendreAnonyme})=>depot.reprendreBrouillon({comparaison,choix:choixRepris,portee,reprendreAnonyme})};
  const confirmer=deps.confirmer||confirmDialog,naviguer=deps.naviguer||navigate;
  const recipe=ctx.recipesById.get(params.id),versions=ctx.versionsByRecipe.get(params.id)||[],demandee=query.v?ctx.versionsById.get(query.v):null;
  const version=demandee?.recipe_id===recipe?.id?demandee:recipe?currentVersion(recipe,versions):null,locale=['fr','en'].includes(query.locale)?query.locale:'fr';
  const guide=query.assistant==='1'&&locale==='fr';
  let lectureEnCours=false,guidePerime=false,reponsesEnCours=false,reponsesRelues=false,revisionGuide=0,actualiserGuide=()=>{},preparerGuide=async()=>{};
  const root=el('div',{class:'stack editeur-traduction'},pageHeader(t('Traduire — {l}',{l:locale==='fr'?'Français':'English'}),{back:{...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:`/recipes/${encodeURIComponent(params.id)}`}),label:t('Retour')}}));
  const hote=el('div',{class:'stack'});root.append(hote);
  root.dispose=()=>{dispose=true;vol?.detruire();retirerGarde?.();controleur?.detruire();};root.flushEditeur=()=>controleurSortie?.flush()||Promise.resolve({issue:'ok'});root.etatEditeur=()=>controleurSortie?.etat();
  const p=await depot.capturerPortee({owner_id:ctx.proprietaireDonnees??null,estCourante});if(p.issue!=='ok'){hote.append(el('p',{role:'status'},erreurTraduction(p)));return root;}const portee=p.portee;
  const lectures=new Map();let erreurs,comparaison,propositions,actionsLecture,etatLecture,selection,actualiserCommandesVol=()=>{};
  const afficherErreur=r=>{if(erreurs){erreurs.textContent=erreurTraduction(r);erreurs.hidden=false;}};
  const comparer=async()=>{const r=await controleur.flush();if(r.issue!=='ok'){afficherErreur(r);return;}const e=controleur.etat(),c=await depot.comparerBrouillon({id:e.id,portee,expectedRevision:e.revision});if(!estCourante())return;if(c.issue!=='ok'){afficherErreur(c);return;}comparaison.replaceChildren(panneauComparaisonBrouillon({service,id:e.id,portee,revision:e.revision,session:sessionActive,resultat:c,estCourante,onReprendre:monter}));};
  async function montrerLecture(journalId){
    const r=await depot.lireLectureTraduction({journalId,portee});if(!estCourante())return;if(r.issue!=='ok'){afficherErreur(r);return;}lectures.set(journalId,r);revisionGuide++;dessinerLectures();actualiserGuide();
  }
  function projectionGuide(){
    const valeurs=new Map((modele?.segments||[]).map(s=>[s.ref,s.text])),proposees=new Map(),ambigues=new Set();
    for(const r of lectures.values())for(const segment of r.lecture?.resultat?.segments||[]){
      const original=source?.segments.find(s=>s.ref===segment.ref),capture=r.lecture.segment_refs?.find(s=>s.ref===segment.ref);
      if(!original||capture&&capture.source_sha256!==original.source_sha256||!r.lecture.remaining_refs?.includes(segment.ref)||segment.issue!=='admis'||typeof segment.text!=='string'||!segment.text.trim()||valeurs.get(segment.ref)?.trim())continue;
      const ancienne=proposees.get(segment.ref);if(ancienne&&ancienne.text!==segment.text)ambigues.add(segment.ref);else proposees.set(segment.ref,{text:segment.text,lecture:r.lecture});
    }
    for(const ref of ambigues)proposees.delete(ref);
    const segments=(source?.segments||[]).map(s=>({...s,traduction:valeurs.get(s.ref)?.trim()?valeurs.get(s.ref):proposees.get(s.ref)?.text??null}));
    return{segments,proposees,ambigues,coupee:[...proposees.values()].some(p=>p.lecture.raison==='coupe'),manquants:segments.filter(s=>s.text.trim()&&!s.traduction?.trim()).map(s=>s.ref)};
  }
  async function relireReponsesGuide(){
    if(!guide||!depot.listerLecturesTraduction){reponsesRelues=true;return true;}
    const r=await depot.listerLecturesTraduction({session:sessionActive});if(!estCourante())return false;
    if(r.issue!=='ok'){reponsesRelues=false;afficherErreur(r);return false;}
    reponsesEnCours=r.enCours===true;reponsesRelues=true;lectures.clear();for(const x of r.lectures)if(x.issue==='ok')lectures.set(x.lecture.journalId,x);revisionGuide++;dessinerLectures();actualiserGuide();return true;
  }
  function dessinerLectures(){
    if(!propositions)return;propositions.replaceChildren();
    for(const[journalId,r]of lectures){
      if(r.reservationSansReponse){
        const liberer=el('button',{class:'btn',type:'button',dataset:{role:'liberer-reservation-traduction'},onClick:async()=>{
          if(publication||lectureEnCours)return;liberer.disabled=true;
          try{const p=await depot.preparerLiberationReservationTraduction({session:sessionActive,journalId});if(!estCourante())return;if(p.issue!=='ok'){afficherErreur(p);return;}
            if(!await confirmer(t('Libérer cette réservation sans réponse ?'),{body:el('p',null,t('Aucune réponse n’a été conservée pour cet appel interrompu. Le journal restera disponible. Aucun nouvel appel ne sera lancé.'))})||!estCourante())return;
            const rr=await depot.libererReponseTraduction({attendu:p.attendu,portee});if(!estCourante())return;if(rr.issue!=='ok'){afficherErreur(rr);return;}await relireReponsesGuide();await preparerGuide();
          }finally{if(estCourante())liberer.disabled=false;}
        }},t('Libérer la réservation sans réponse'));
        propositions.append(el('section',{class:'card stack'},el('h2',null,t('Traduction interrompue')),el('p',null,t('Cet appel interrompu n’a pas de réponse conservée. Sa place réservée peut être libérée avant un nouvel essai.')),liberer));continue;
      }
      const lecture=r.lecture,segments=lecture?.resultat?.segments||[],restants=new Set(lecture?.remaining_refs||[]);
      const acceptes=segments.filter(s=>restants.has(s.ref)&&s.issue==='admis'&&typeof s.text==='string'),boite=el('section',{class:'card stack traduction-proposition'},el('h2',null,t('Proposition à relire')));
      for(const s of segments){const original=source?.segments.find(x=>x.ref===s.ref),bloc=el('div',{class:'stack'},el('strong',null,original?libelle(original):t('Texte conservé')),el('p',{style:{whiteSpace:'pre-wrap'}},s.text??t('Ce segment reste à traduire.')));if(acceptes.includes(s))bloc.append(el('label',{class:'row'},el('input',{type:'checkbox',checked:true,dataset:{role:'adopter-segment',ref:s.ref}}),t('Utiliser ce segment')));boite.append(bloc);}
      boite.append(el('button',{class:'btn',type:'button',disabled:!acceptes.length||!controleur,onClick:async()=>{
        const refs=[...boite.querySelectorAll('[data-role=adopter-segment]:checked')].map(n=>n.dataset.ref).filter(ref=>acceptes.some(s=>s.ref===ref));if(!refs.length)return;
        const f=await controleur.flush();if(f.issue!=='ok'){afficherErreur(f);return;}
        if(!await confirmer(t('Utiliser ces segments proposés ?'),{body:el('p',null,t('Les segments choisis remplaceront leur traduction dans ce brouillon. Les autres valeurs seront conservées.'))})||!estCourante())return;
        const adoption=await depot.adopterLectureTraduction({session:sessionActive,lecture,refs});if(!estCourante())return;if(adoption.issue==='ok')await monter({...adoption,source:source,aConserver:true});else afficherErreur(adoption);
      }},t('Utiliser cette proposition')));
      if(r.recuperationDisponible)boite.append(el('button',{class:'btn',type:'button',onClick:async()=>{const ex=await depot.exporterReponseTraduction({journalId,portee});if(!estCourante())return;if(ex.issue==='ok')downloadBlob(new Blob([ex.octets],{type:'application/octet-stream'}),ex.nomFichier||'reponse-traduction.bin');else afficherErreur(ex);}},t('Récupérer la réponse reçue')));
      if(r.recuperationDisponible)boite.append(el('button',{class:'btn',type:'button',onClick:async()=>{
        const p=await depot.preparerLiberationReponseTraduction({journalId,portee});if(!estCourante())return;if(p.issue!=='ok'){afficherErreur(p);return;}
        const texte=p.resultatConserve?t('Les segments admis resteront dans la réponse conservée. La copie brute locale sera supprimée ; elle ne fait partie ni de la synchronisation ni de l’archive. Récupère-la avant de continuer.'):t('Cette réponse ne contient aucun résultat publiable. Sa copie brute locale sera supprimée. Récupère-la avant de continuer.');
        if(!await confirmer(t('Libérer cette copie brute sur cet appareil ?'),{body:el('p',null,texte),danger:true})||!estCourante())return;
        const r=await depot.libererReponseTraduction({attendu:p.attendu,portee});if(!estCourante())return;if(r.issue==='ok')await montrerLecture(journalId);else afficherErreur(r);
      }},t('Libérer la copie brute locale')));
      boite.append(el('button',{class:'btn',type:'button',disabled:!restants.size,onClick:async()=>{const refs=[...restants];if(!refs.length||!await confirmer(t('Écarter explicitement les segments restants de cette réponse ?'))||!estCourante())return;const rr=await depot.resoudreTraduction({lectures:[lecture],refsParJournal:{[journalId]:refs}});if(['resolu','deja_resolu'].includes(rr.issue))await montrerLecture(journalId);else afficherErreur(rr);}},t('Écarter les segments restants')));
      propositions.append(boite);
    }
  }
  async function monter(ouverture){
    if(!estCourante())return;retirerGarde?.();controleur?.detruire();
    guidePerime=ouverture.traductionPerimee===true;
    const precedente=source;sessionActive=ouverture.session;modele=structuredClone(ouverture.modele||ouverture.brouillon?.payload);source=ouverture.source||source;
    if(precedente&&source&&(precedente.source_signature!==source.source_signature||precedente.title_sha256!==source.title_sha256))lectures.clear();
    if(!modele||!source){hote.replaceChildren(el('p',{role:'status'},t('La source de cette traduction n’est plus disponible. Le brouillon reste récupérable.')));return;}
    const lectureApercu=guide?await lectureDeLaCapture(source):null;if(!estCourante())return;
    controleur=creerControleurEditeur({service:depot,session:sessionActive,revision:ouverture.revision??ouverture.brouillon?.revision??null,id:ouverture.id??ouverture.brouillon?.id??null,lirePayload:()=>structuredClone(modele)});
    controleurSortie={...controleur,etat:()=>{const e=controleur.etat(),v=vol?.etat();return{...e,sale:e.sale||!!v?.reponseAConserver,enCours:e.enCours||lectureEnCours||publication||v?.statut==='en_cours'};},flush:async()=>{const v=vol?.etat();if(v?.reponseAConserver){const r=await vol.reessayerConservation();if(r.issue!=='conserve')return r;}else if(lectureEnCours||publication||v?.statut==='en_cours')return{issue:'refuse',raison:'lecture_en_cours'};return controleur.flush();}};
    retirerGarde=protegerSortieEditeur({racine:root,controleur:controleurSortie});
    controleur.souscrire(e=>{if(!e.id||e.sale||e.enCours||e.publie||!estCourante())return;const a=parseHash();if(a.path!==`/recipes/${encodeURIComponent(params.id)}/edit`)return;const q=new URLSearchParams(a.query);q.set('draft',e.id);q.set('kind','translation');q.set('format','2');q.set('locale',locale);remplacerAdresse(`${a.path}?${q}`);});
    erreurs=el('p',{class:'status warn',role:'status',hidden:true});comparaison=el('div',{class:'stack'});propositions=el('div',{class:'stack'});actionsLecture=el('div',{class:'stack'});etatLecture=el('p',{class:'status',role:'status','aria-live':'polite'});selection=new Set();
    const champs=el('div',{class:'stack traduction-segments'}),garder=el('button',{class:'btn primary',type:'button',dataset:{role:guide?'enregistrer-version-francaise':'publier-traduction'},onClick:guide?publierGuide:publier});
    const actualiserGarder=()=>{garder.textContent=modele.segments.every(s=>typeof s.text==='string'&&s.text.length)?t('Garder cette traduction'):t('Garder la traduction partielle');garder.disabled=publication;};
    for(const s of source.segments){
      const texte=modele.segments.find(x=>x.ref===s.ref),coche=el('input',{type:'checkbox',checked:texte?.text==null,onChange:e=>{if(e.target.checked)selection.add(s.ref);else selection.delete(s.ref);actionsLecture.replaceChildren();}});if(coche.checked)selection.add(s.ref);
      const input=el('textarea',{rows:s.kind==='step'||s.kind==='notes'?4:2,value:texte?.text??'',dataset:{role:'traduction-segment',ref:s.ref},onInput:e=>{const v=modele.segments.find(x=>x.ref===s.ref);if(!v)return;v.text=e.target.value||null;controleur.modifier();revisionGuide++;if(guide){actionsLecture.replaceChildren();actualiserGuide();void preparerGuide();}else actualiserGarder();}});
      const original=el('p',{class:'traduction-source',style:{whiteSpace:'pre-wrap'}},s.text);if(source.source_locale)original.lang=source.source_locale;
      champs.append(el('section',{class:'card stack traduction-segment',dataset:{role:'segment-traduction',ref:s.ref}},el('h2',null,libelle(s)),original,field(t('Traduction'),input),...(!guide?[el('label',{class:'row'},coche,t('Inclure dans la demande à l’assistant'))]:[])));
    }
    actualiserGarder();const provider=deps.provider||providerFrom(ctx.settings,{session:await sessionAssistant(ctx)});if(!estCourante())return;
    async function lancerPlan(r){
      if(lectureEnCours||publication||vol?.etat().reponseAConserver)return;
      lectureEnCours=true;actualiserGuide();
      try{
        if(guide){if(!await relireReponsesGuide()||reponsesEnCours)return;const maintenant=projectionGuide(),attendus=r.portions.flatMap(p=>p.segment_refs.map(s=>s.ref));if(attendus.length!==maintenant.manquants.length||attendus.some(ref=>!maintenant.manquants.includes(ref)))return;}
        actionsLecture.querySelectorAll('button').forEach(b=>b.disabled=true);
        if(!vol)vol=creerLectureTraduction({depot,provider,repo,estCourante,onEtat:e=>{etatLecture.textContent=e.statut==='en_cours'?t('Traduction en cours…'):e.statut==='a_conserver'?t('La réponse est reçue, mais sa conservation a échoué. Réessaie de la conserver sans nouvel appel.'):e.statut==='termine'?t('Les réponses reçues sont conservées et prêtes à relire.'):e.raison?erreurTraduction(e):'';actualiserCommandesVol(e);actualiserGuide();},onLecture:r=>montrerLecture(r.journalId)});
        const result=await vol.lancer({plan:r.plan,ordinals:r.portions.map((p,i)=>p.ordinal??i)});if(estCourante()&&!['termine','pause'].includes(result.issue))afficherErreur(result);
      }finally{lectureEnCours=false;actualiserGuide();if(guide&&estCourante())await preparerGuide();}
    }
    const preparer=el('button',{class:'btn',type:'button',disabled:locale!=='fr'||!provider.configured,dataset:{role:'preparer-traduction'},onClick:async()=>{
      const f=await controleur.flush();if(f.issue!=='ok'){afficherErreur(f);return;}const r=await depot.preparerLectureTraduction({session:sessionActive,selection:[...selection],limiteAppels:32});if(!estCourante())return;if(r.issue!=='ok'){afficherErreur(r);return;}
      actionsLecture.replaceChildren(el('p',null,t('Cette sélection demande au maximum {n} appels à l’assistant.',{n:r.bilan.appelsMax})),el('p',{class:'muted'},t('La série se met en pause si la réserve de 8 réponses ou de 8 Mio est pleine. Aucune réponse conservée ne sera relancée automatiquement.')),el('button',{class:'btn primary',type:'button',dataset:{role:'lancer-traduction'},onClick:async()=>{
        await lancerPlan(r);
      }},t('Lancer cette traduction')));
    }},t('Préparer la traduction avec l’assistant'));
    let conservationEnCours=false;
    const annuler=el('button',{class:'btn',type:'button',onClick:()=>vol?.annuler()},t('Annuler l’appel'));
    const conserver=el('button',{class:'btn',type:'button',onClick:async()=>{if(conservationEnCours||!vol?.etat().reponseAConserver)return;conservationEnCours=true;actualiserCommandesVol();try{const r=await vol.reessayerConservation();if(r.issue!=='conserve')afficherErreur(r);}finally{conservationEnCours=false;actualiserCommandesVol();actualiserGuide();if(guide)await preparerGuide();}}},t('Réessayer de conserver la réponse'));
    const recuperer=el('button',{class:'btn',type:'button',onClick:()=>{const bytes=vol?.reponseEnAttente();if(bytes)downloadBlob(new Blob([bytes],{type:'application/octet-stream'}),'reponse-traduction-non-conservee.bin');}},t('Récupérer la réponse non conservée'));
    const commandesVol=el('div',{class:'row'},annuler,conserver,recuperer);
    actualiserCommandesVol=(e=vol?.etat())=>{
      annuler.hidden=e?.statut!=='en_cours';annuler.disabled=annuler.hidden;
      conserver.hidden=!e?.reponseAConserver;conserver.disabled=conserver.hidden||conservationEnCours;
      recuperer.hidden=!e?.reponseAConserver||!vol?.reponseEnAttente();recuperer.disabled=recuperer.hidden;
      commandesVol.hidden=[annuler,conserver,recuperer].every(b=>b.hidden);
    };
    actualiserCommandesVol();
    const actualiserReponses=el('button',{type:'button',class:'btn',dataset:{role:'actualiser-reponses-traduction'},onClick:async()=>{if(lectureEnCours||publication||!estCourante())return;actualiserReponses.disabled=true;try{await repo.marquerInterrompus();if(!estCourante())return;await relireReponsesGuide();await preparerGuide();}finally{if(estCourante())actualiserReponses.disabled=false;}}},t('Actualiser les réponses conservées'));
    const panneauAssistant=el('div',{class:'stack',dataset:{role:'assistant-traduction'}},...(!guide?[preparer]:[actualiserReponses]),actionsLecture,etatLecture,commandesVol);
    if(!provider.configured)panneauAssistant.append(carteConnexion(()=>demarrerConnexion(ctx.sync?.auth),ctx));
    const apercu=el('section',{class:'card stack',dataset:{role:'apercu-traduction-guidee'}}),couverture=el('p',{role:'status'});
    let numeroPlan=0;
    actualiserGuide=()=>{
      if(!guide||!modele||dispose)return;const projection=projectionGuide(),occupes=lectureEnCours||publication||!!vol?.etat().reponseAConserver;
      garder.textContent=t('Enregistrer la version française');garder.disabled=occupes||guidePerime||reponsesEnCours||!reponsesRelues||projection.coupee||projection.manquants.length>0;
      actualiserReponses.hidden=!reponsesEnCours;actualiserReponses.disabled=occupes;
      const n=projection.manquants.length;couverture.textContent=guidePerime?t('La source de cette traduction a changé. Compare les valeurs avant de continuer.'):reponsesEnCours?t('Une traduction de cette recette est encore en cours. Retrouve sa réponse avant de lancer un autre appel.'):projection.coupee?t('La réponse a été interrompue. Relis les passages dans « Réponses conservées et récupération » avant de les utiliser.'):n===0?t('Tous les passages disponibles sont traduits. Relis la proposition avant de l’enregistrer.'):n===1?t('1 passage reste à traduire.'):t('{n} passages restent à traduire.',{n});
      apercu.replaceChildren(el('h2',null,t('Aperçu de la version française')),couverture);
      if(projection.ambigues.size)apercu.append(el('p',null,t('Plusieurs propositions diffèrent pour un passage. Choisis son texte dans les corrections avant de continuer.')));
      const lecture={etat:n?'partielle':'courante',segments:projection.segments.map(s=>({...s,source_text:s.text,translation_text:s.traduction,etat:s.traduction===null?'manquant':'traduit'}))};
      const recette=projeterLectureRecette({...lectureApercu,lectures:[{row:{id:'apercu',locale:'fr',alignment_format:2},lecture}]},{locale:'fr',system:'original',translationId:'apercu'});
      const texte=s=>el('p',{lang:s.langReelle||'',style:{whiteSpace:'pre-wrap'}},s.texte,...(s.etat==='manquant'?[el('small',{class:'muted'},' · '+t('Ce segment reste à traduire.'))]:[]));
      apercu.append(el('h3',null,recette.titre.texte));
      if(recette.rendement.texte)apercu.append(texte(recette.rendement));
      apercu.append(el('h3',null,t('Ingrédients')));
      const ingredients=el('ul',{class:'stack'});for(const bloc of recette.blocs)ingredients.append(el('li',null,bloc.kind==='heading'?el('strong',null,bloc.texte):el('span',{lang:bloc.principal.langReelle||''},bloc.texte,...(bloc.principal.etat==='manquant'?[el('small',{class:'muted'},' · '+t('Ce segment reste à traduire.'))]:[]))));apercu.append(ingredients);
      apercu.append(el('h3',null,t('Préparation')),el('ol',{class:'stack'},...recette.etapes.map(etape=>el('li',null,texte(etape)))));
      if(recette.notes.texte)apercu.append(el('h3',null,t('Notes de cette version')),texte(recette.notes));
      for(const input of champs.querySelectorAll('textarea'))if(input!==document.activeElement)input.value=projection.segments.find(s=>s.ref===input.dataset.ref)?.traduction??'';
      for(const input of champs.querySelectorAll('textarea'))input.disabled=publication;
    };
    preparerGuide=async()=>{
      if(!guide||!estCourante()||lectureEnCours||publication||vol?.etat().reponseAConserver)return;
      const numero=++numeroPlan,revision=revisionGuide,projection=projectionGuide();actionsLecture.replaceChildren();
      if(!provider.configured||!reponsesRelues||reponsesEnCours||guidePerime||!projection.manquants.length||projection.ambigues.size)return;
      const f=await controleur.flush();if(f.issue!=='ok'){afficherErreur(f);return;}
      const r=await depot.preparerLectureTraduction({session:sessionActive,selection:projection.manquants,limiteAppels:32});if(!estCourante()||numero!==numeroPlan||revision!==revisionGuide)return;
      if(r.issue!=='ok'){afficherErreur(r);return;}
      actionsLecture.replaceChildren(el('p',null,t('Cette sélection demande au maximum {n} appels à l’assistant.',{n:r.bilan.appelsMax})),el('p',{class:'muted'},t('Seul le contenu présent dans la recette sera traduit. Les passages déjà reçus ne seront pas redemandés.')),el('button',{class:'btn primary',type:'button',dataset:{role:'lancer-traduction'},onClick:()=>lancerPlan(r)},projection.manquants.length===source.segments.filter(s=>s.text.trim()).length?t('Traduire toute la recette'):t('Traduire les passages manquants')));
    };
    const corrections=el('details',{class:'stack',dataset:{role:'corrections-traduction'}},el('summary',null,t('Corriger la traduction')),champs);
    const reponses=guide?el('details',{class:'stack'},el('summary',null,t('Réponses conservées et récupération')),propositions):propositions;
    const dessinerGuide=actualiserGuide;actualiserGuide=()=>{dessinerGuide();if(guide&&[...lectures.values()].some(x=>x.reservationSansReponse))reponses.open=true;};
    const contenu=guide?[panneauAssistant,reponses,apercu,corrections]:[champs,panneauAssistant];
    hote.replaceChildren(statutBrouillon(controleur),el('p',{class:'muted'},t('Cette traduction reste liée à cette version. Les quantités, les réglages et la recette originale ne seront pas modifiés.')),...contenu,erreurs,comparaison,
      el('div',{class:'row'},garder,el('button',{class:'btn',type:'button',onClick:comparer},t('Comparer les valeurs')),el('button',{class:'btn',type:'button',onClick:async()=>{const r=await depot.copierBrouillon({session:sessionActive,payload:structuredClone(modele)});if(r.issue==='ok')await monter({...r,source,aConserver:true});else afficherErreur(r);}},t('Conserver une copie séparée'))),...(!guide?[reponses]:[]),boutonsRecuperationTexte(()=>modele.segments.map(s=>s.text||'').join('\n\n')));
    dessinerLectures();if(ouverture.aConserver||guidePerime)controleur.modifier();
    if(guide){actualiserGuide();await relireReponsesGuide();actualiserGuide();await preparerGuide();}
  }
  async function publierGuide(){
    if(publication||lectureEnCours||vol?.etat().reponseAConserver||guidePerime||reponsesEnCours||!reponsesRelues)return;
    const projection=projectionGuide();if(projection.manquants.length||projection.ambigues.size||projection.coupee)return;
    publication=true;hote.inert=true;actualiserGuide();
    try{
      let f=await controleur.flush();if(f.issue!=='ok'){afficherErreur(f);return;}
      const groupes=new Map();for(const[ref,p]of projection.proposees){if(!groupes.has(p.lecture))groupes.set(p.lecture,[]);groupes.get(p.lecture).push(ref);}
      for(const[lecture,refs]of groupes){
        const adoption=await depot.adopterLectureTraduction({session:sessionActive,lecture,refs});if(!estCourante())return;if(adoption.issue!=='ok'){afficherErreur(adoption);return;}
        modele=structuredClone(adoption.modele);controleur.modifier();f=await controleur.flush();if(!estCourante())return;if(f.issue!=='ok'){afficherErreur(f);return;}
      }
      const prep=await depot.preparerPublicationTraduction({session:sessionActive,expectedRevision:controleur.etat().revision,payload:structuredClone(modele)});if(!estCourante())return;if(prep.issue!=='ok'){afficherErreur(prep);return;}
      const r=await depot.publierTraduction({plan:prep.plan});if(!estCourante())return;
      if(['publie','deja_publie'].includes(r.issue)){controleur.confirmerPublication(r);publication=false;toast(t('Traduction enregistrée'));naviguer(destinationApresRecette(params.id,query,ctx,{v:version?.id,lang:locale,translation:r.translation_id}));}else afficherErreur(r);
    }catch{afficherErreur({raison:'stockage_indisponible'});}finally{publication=false;hote.inert=false;actualiserGuide();}
  }
  async function publier(){
    if(publication)return;publication=true;
    try{const f=await controleur.flush();if(f.issue!=='ok'){afficherErreur(f);return;}const prep=await depot.preparerPublicationTraduction({session:sessionActive,expectedRevision:controleur.etat().revision,payload:structuredClone(modele)});if(!estCourante())return;if(prep.issue!=='ok'){afficherErreur(prep);return;}const r=await depot.publierTraduction({plan:prep.plan});if(!estCourante())return;if(['publie','deja_publie'].includes(r.issue)){controleur.confirmerPublication(r);publication=false;toast(t('Traduction enregistrée'));naviguer(destinationApresRecette(params.id,query,ctx,{v:version?.id,lang:locale,translation:r.translation_id}));}else afficherErreur(r);}catch{afficherErreur({raison:'stockage_indisponible'});}finally{publication=false;}
  }
  if(query.draft){hote.append(await panneauRepriseBrouillon({service,id:query.draft,portee,estCourante,onReprendre:monter,onComparer:async r=>{const lu=await depot.lireBrouillon({id:query.draft,portee});if(estCourante())hote.append(panneauComparaisonBrouillon({service,id:query.draft,portee,revision:lu.revision??lu.brouillon?.revision,session:lu.session,resultat:r,estCourante,onReprendre:monter}));}}));return root;}
  if(!recipe||!version){hote.append(el('p',null,t('Aucune version à traduire.')));if(query.import){erreurs=el('p',{role:'status',hidden:true});propositions=el('div',{class:'stack'});hote.append(propositions,erreurs);await montrerLecture(query.import);}return root;}
  if(!query.import&&depot.listerBrouillons){const liste=await depot.listerBrouillons({portee});if(!estCourante())return root;const existants=liste.issue==='ok'?liste.brouillons.filter(d=>d.entity_id===recipe.id&&(d.recipe_version_id||d.base_version_id)===version.id&&d.locale===locale):[];
    if(existants.length){hote.append(el('h2',null,t('Brouillons de cette recette')));for(const d of existants){const q=new URLSearchParams(query);q.set('draft',d.id);hote.append(el('a',{class:'btn',href:`#/recipes/${encodeURIComponent(recipe.id)}/edit?${q}`},t('Reprendre le brouillon du {date}',{date:new Date(d.saved_at).toLocaleString()})));}hote.append(el('button',{class:'btn',type:'button',onClick:async()=>{hote.replaceChildren();await ouvrirNeuf();}},t('Commencer une autre modification')));return root;}
  }
  await ouvrirNeuf();return root;
  async function ouvrirNeuf(){
  const traductions=(ctx.recipe_translations||[]).filter(x=>x.recipe_version_id===version.id&&x.locale===locale);
  if(traductions.length>1&&!query.translation){hote.append(el('h2',null,t('Plusieurs traductions existent pour cette version. Choisis celle à comparer.')));for(const tr of traductions){const q=new URLSearchParams(query);q.set('translation',tr.id);hote.append(el('details',{class:'card'},el('summary',null,t('Traduction conservée : {id}',{id:tr.id})),el('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},JSON.stringify(tr.translated_content,null,2)),el('a',{class:'btn',href:`#/recipes/${encodeURIComponent(params.id)}/edit?${q}`},t('Comparer cette traduction'))));}return root;}
  const args={portee,affiche:{recipe,version,traductions},locale,...(query.translation?{traductionId:query.translation}:{})};
  const ouvre=await depot.ouvrirTraduction(args);if(!estCourante())return root;
  if(ouvre.issue!=='ok'){
    if(ouvre.raison==='conversion_requise'){
      const q=new URLSearchParams(query);q.delete('format');q.delete('assistant');
      hote.append(el('p',null,t('Cette traduction utilise l’ancien format. Ses lignes entières resteront documentaires ; aucun nom d’aliment ne sera déduit.')),el('a',{class:'btn',href:`#/recipes/${encodeURIComponent(params.id)}/edit?${q}`},t('Modifier dans l’ancien éditeur')),el('button',{class:'btn',type:'button',onClick:async()=>{if(!await confirmer(t('Convertir cette traduction pour cette version exacte ?'))||!estCourante())return;const r=await depot.ouvrirTraduction({...args,convertirLegacy:true});if(r.issue==='ok')await monter({...r,aConserver:true});else hote.append(el('p',{role:'status'},erreurTraduction(r)));}},t('Préparer la conversion')));
    }else hote.append(el('p',{role:'status'},erreurTraduction(ouvre)));
    if(query.import){erreurs=el('p',{role:'status',hidden:true});propositions=el('div',{class:'stack'});hote.append(propositions,erreurs);await montrerLecture(query.import);}
    return root;
  }
  await monter(ouvre);
  if(query.import)await montrerLecture(query.import);
  return root;
  }
}
