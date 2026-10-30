import {el,confirmDialog,downloadBlob,toast} from '../core/dom.js';
import {t} from '../core/i18n.js';
import {navigate,parseHash,remplacerAdresse} from '../core/router.js';
import * as repo from '../model/repo.js';
import {currentVersion} from '../domain/search.js';
import {providerFrom} from '../domain/llm.js';
import {creerLectureTraduction} from '../domain/lecture-traduction.js';
import {getSyncGeneration} from './state.js';
import {pageHeader,field,sessionAssistant,carteConnexion} from './components.js';
import {retourConnu,porteeNavigation} from './navigation-contexte.js';
import {destinationApresRecette} from './actions-contenu.js';
import {creerControleurEditeur,statutBrouillon,texteErreurBrouillon,panneauRepriseBrouillon,panneauComparaisonBrouillon,boutonsRecuperationTexte} from './brouillon-editeur.js';
import {protegerSortieEditeur} from './sortie-editeur.js';
import {demarrerConnexion} from './settings.js';

const libelle=s=>s.kind==='title'?t('Titre'):s.kind==='heading'?t('Titre du groupe'):s.kind==='step'?t('Étape'):s.kind==='notes'?t('Notes de cette version'):s.kind==='yield'?t('Rendement (facultatif)'):s.field==='name'?t('Ingrédient'):s.field==='preparation'?t('Préparation'):t('Texte source');
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
  const root=el('div',{class:'stack editeur-traduction'},pageHeader(t('Traduire — {l}',{l:locale==='fr'?'Français':'English'}),{back:{...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:`/recipes/${encodeURIComponent(params.id)}`}),label:t('Retour')}}));
  const hote=el('div',{class:'stack'});root.append(hote);
  root.dispose=()=>{dispose=true;vol?.detruire();retirerGarde?.();controleur?.detruire();};root.flushEditeur=()=>controleurSortie?.flush()||Promise.resolve({issue:'ok'});root.etatEditeur=()=>controleurSortie?.etat();
  const p=await depot.capturerPortee({owner_id:ctx.proprietaireDonnees??null,estCourante});if(p.issue!=='ok'){hote.append(el('p',{role:'status'},erreurTraduction(p)));return root;}const portee=p.portee;
  const lectures=new Map();let erreurs,comparaison,propositions,actionsLecture,etatLecture,selection,actualiserCommandesVol=()=>{};
  const afficherErreur=r=>{if(erreurs){erreurs.textContent=erreurTraduction(r);erreurs.hidden=false;}};
  const comparer=async()=>{const r=await controleur.flush();if(r.issue!=='ok'){afficherErreur(r);return;}const e=controleur.etat(),c=await depot.comparerBrouillon({id:e.id,portee,expectedRevision:e.revision});if(!estCourante())return;if(c.issue!=='ok'){afficherErreur(c);return;}comparaison.replaceChildren(panneauComparaisonBrouillon({service,id:e.id,portee,revision:e.revision,session:sessionActive,resultat:c,estCourante,onReprendre:monter}));};
  async function montrerLecture(journalId){
    const r=await depot.lireLectureTraduction({journalId,portee});if(!estCourante())return;if(r.issue!=='ok'){afficherErreur(r);return;}lectures.set(journalId,r);dessinerLectures();
  }
  function dessinerLectures(){
    if(!propositions)return;propositions.replaceChildren();
    for(const[journalId,r]of lectures){
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
    sessionActive=ouverture.session;modele=structuredClone(ouverture.modele||ouverture.brouillon?.payload);source=ouverture.source||source;
    if(!modele||!source){hote.replaceChildren(el('p',{role:'status'},t('La source de cette traduction n’est plus disponible. Le brouillon reste récupérable.')));return;}
    controleur=creerControleurEditeur({service:depot,session:sessionActive,revision:ouverture.revision??ouverture.brouillon?.revision??null,id:ouverture.id??ouverture.brouillon?.id??null,lirePayload:()=>structuredClone(modele)});
    controleurSortie={...controleur,etat:()=>{const e=controleur.etat(),v=vol?.etat();return{...e,sale:e.sale||!!v?.reponseAConserver,enCours:e.enCours||v?.statut==='en_cours'};},flush:async()=>{const v=vol?.etat();if(v?.reponseAConserver){const r=await vol.reessayerConservation();if(r.issue!=='conserve')return r;}else if(v?.statut==='en_cours')return{issue:'refuse',raison:'lecture_en_cours'};return controleur.flush();}};
    retirerGarde=protegerSortieEditeur({racine:root,controleur:controleurSortie});
    controleur.souscrire(e=>{if(!e.id||e.sale||e.enCours||e.publie||!estCourante())return;const a=parseHash();if(a.path!==`/recipes/${encodeURIComponent(params.id)}/edit`)return;const q=new URLSearchParams(a.query);q.set('draft',e.id);q.set('kind','translation');q.set('format','2');q.set('locale',locale);remplacerAdresse(`${a.path}?${q}`);});
    erreurs=el('p',{class:'status warn',role:'status',hidden:true});comparaison=el('div',{class:'stack'});propositions=el('div',{class:'stack'});actionsLecture=el('div',{class:'stack'});etatLecture=el('p',{class:'status',role:'status','aria-live':'polite'});selection=new Set();
    const champs=el('div',{class:'stack traduction-segments'}),garder=el('button',{class:'btn primary',type:'button',dataset:{role:'publier-traduction'},onClick:publier});
    const actualiserGarder=()=>{garder.textContent=modele.segments.every(s=>typeof s.text==='string'&&s.text.length)?t('Garder cette traduction'):t('Garder la traduction partielle');garder.disabled=publication;};
    for(const s of source.segments){
      const texte=modele.segments.find(x=>x.ref===s.ref),coche=el('input',{type:'checkbox',checked:texte?.text==null,onChange:e=>{if(e.target.checked)selection.add(s.ref);else selection.delete(s.ref);actionsLecture.replaceChildren();}});if(coche.checked)selection.add(s.ref);
      const input=el('textarea',{rows:s.kind==='step'||s.kind==='notes'?4:2,value:texte?.text??'',dataset:{role:'traduction-segment',ref:s.ref},onInput:e=>{const v=modele.segments.find(x=>x.ref===s.ref);if(!v)return;v.text=e.target.value||null;controleur.modifier();actualiserGarder();}});
      const original=el('p',{class:'traduction-source',style:{whiteSpace:'pre-wrap'}},s.text);if(source.source_locale)original.lang=source.source_locale;
      champs.append(el('section',{class:'card stack traduction-segment',dataset:{role:'segment-traduction',ref:s.ref}},el('h2',null,libelle(s)),original,field(t('Traduction'),input),el('label',{class:'row'},coche,t('Inclure dans la demande à l’assistant'))));
    }
    actualiserGarder();const provider=deps.provider||providerFrom(ctx.settings,{session:await sessionAssistant(ctx)});if(!estCourante())return;
    const preparer=el('button',{class:'btn',type:'button',disabled:locale!=='fr'||!provider.configured,dataset:{role:'preparer-traduction'},onClick:async()=>{
      const f=await controleur.flush();if(f.issue!=='ok'){afficherErreur(f);return;}const r=await depot.preparerLectureTraduction({session:sessionActive,selection:[...selection],limiteAppels:32});if(!estCourante())return;if(r.issue!=='ok'){afficherErreur(r);return;}
      actionsLecture.replaceChildren(el('p',null,t('Cette sélection demande au maximum {n} appels à l’assistant.',{n:r.bilan.appelsMax})),el('p',{class:'muted'},t('La série se met en pause si la réserve de 8 réponses ou de 8 Mio est pleine. Aucune réponse conservée ne sera relancée automatiquement.')),el('button',{class:'btn primary',type:'button',dataset:{role:'lancer-traduction'},onClick:async()=>{
        actionsLecture.querySelector('button').disabled=true;
        if(!vol)vol=creerLectureTraduction({depot,provider,repo,estCourante,onEtat:e=>{etatLecture.textContent=e.statut==='en_cours'?t('Traduction en cours…'):e.statut==='a_conserver'?t('La réponse est reçue, mais sa conservation a échoué. Réessaie de la conserver sans nouvel appel.'):e.statut==='termine'?t('Les réponses reçues sont conservées et prêtes à relire.'):e.raison?erreurTraduction(e):'';actualiserCommandesVol(e);},onLecture:r=>montrerLecture(r.journalId)});
        const result=await vol.lancer({plan:r.plan,ordinals:r.portions.map((p,i)=>p.ordinal??i)});if(estCourante()&&!['termine','pause'].includes(result.issue))afficherErreur(result);
      }},t('Lancer cette traduction')));
    }},t('Préparer la traduction avec l’assistant'));
    let conservationEnCours=false;
    const annuler=el('button',{class:'btn',type:'button',onClick:()=>vol?.annuler()},t('Annuler l’appel'));
    const conserver=el('button',{class:'btn',type:'button',onClick:async()=>{if(conservationEnCours||!vol?.etat().reponseAConserver)return;conservationEnCours=true;actualiserCommandesVol();try{const r=await vol.reessayerConservation();if(r.issue!=='conserve')afficherErreur(r);}finally{conservationEnCours=false;actualiserCommandesVol();}}},t('Réessayer de conserver la réponse'));
    const recuperer=el('button',{class:'btn',type:'button',onClick:()=>{const bytes=vol?.reponseEnAttente();if(bytes)downloadBlob(new Blob([bytes],{type:'application/octet-stream'}),'reponse-traduction-non-conservee.bin');}},t('Récupérer la réponse non conservée'));
    const commandesVol=el('div',{class:'row'},annuler,conserver,recuperer);
    actualiserCommandesVol=(e=vol?.etat())=>{
      annuler.hidden=e?.statut!=='en_cours';annuler.disabled=annuler.hidden;
      conserver.hidden=!e?.reponseAConserver;conserver.disabled=conserver.hidden||conservationEnCours;
      recuperer.hidden=!e?.reponseAConserver||!vol?.reponseEnAttente();recuperer.disabled=recuperer.hidden;
      commandesVol.hidden=[annuler,conserver,recuperer].every(b=>b.hidden);
    };
    actualiserCommandesVol();
    const panneauAssistant=el('div',{class:'stack',dataset:{role:'assistant-traduction'}},preparer,actionsLecture,etatLecture,commandesVol);
    if(!provider.configured)panneauAssistant.append(carteConnexion(()=>demarrerConnexion(ctx),ctx));
    const contenu=query.assistant==='1'?[panneauAssistant,champs]:[champs,panneauAssistant];
    hote.replaceChildren(statutBrouillon(controleur),el('p',{class:'muted'},t('Cette traduction reste liée à cette version. Les quantités, les réglages et la recette originale ne seront pas modifiés.')),...contenu,propositions,erreurs,comparaison,
      el('div',{class:'row'},garder,el('button',{class:'btn',type:'button',onClick:comparer},t('Comparer les valeurs')),el('button',{class:'btn',type:'button',onClick:async()=>{const r=await depot.copierBrouillon({session:sessionActive,payload:structuredClone(modele)});if(r.issue==='ok')await monter({...r,source,aConserver:true});else afficherErreur(r);}},t('Conserver une copie séparée'))),boutonsRecuperationTexte(()=>modele.segments.map(s=>s.text||'').join('\n\n')));
    dessinerLectures();if(ouverture.aConserver)controleur.modifier();
  }
  async function publier(){
    if(publication)return;publication=true;
    try{const f=await controleur.flush();if(f.issue!=='ok'){afficherErreur(f);return;}const prep=await depot.preparerPublicationTraduction({session:sessionActive,expectedRevision:controleur.etat().revision,payload:structuredClone(modele)});if(!estCourante())return;if(prep.issue!=='ok'){afficherErreur(prep);return;}const r=await depot.publierTraduction({plan:prep.plan});if(!estCourante())return;if(['publie','deja_publie'].includes(r.issue)){controleur.confirmerPublication(r);toast(t('Traduction enregistrée'));naviguer(destinationApresRecette(params.id,query,ctx,{v:version?.id,lang:locale}));}else afficherErreur(r);}catch{afficherErreur({raison:'stockage_indisponible'});}finally{publication=false;}
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
  }await monter(ouvre);
  if(query.import)await montrerLecture(query.import);
  return root;
  }
}
