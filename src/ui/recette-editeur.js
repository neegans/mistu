import { el, toast, confirmDialog, promptDialog } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate, parseHash, remplacerAdresse } from '../core/router.js';
import * as repo from '../model/repo.js';
import { RECIPE_TYPES } from '../model/schema.js';
import { currentVersion } from '../domain/search.js';
import { estThermomix } from '../domain/thermomix.js';
import { lireSourceSansThermomix } from '../domain/version-personnelle.js';
import { parseIngredientBlock, parseIngredientLine } from '../domain/lines.js';
import { parseQuantity } from '../domain/quantity.js';
import { matchUnit } from '../domain/units.js';
import { creerModeleRecette, decrireChangementsRecette, modifierIngredient, confirmerIngredient, modifierEtape, deplacerElement, retirerElement } from '../domain/editeur-recette.js';
import { capturerProprietaire, conditionProprietaire } from './recette-garde.js';
import { demarrerConnexion } from './settings.js';
import { displayUrl } from '../sync/mime.js';
import { getSyncGeneration, recetteActiveDansContexte } from './state.js';
import { mentionCycleRecette } from './corbeille.js';
import { retourConnu, porteeNavigation, lienAvecOrigine } from './navigation-contexte.js';
import { destinationApresRecette } from './actions-contenu.js';
import { pageHeader, field, select, pdfFrame, sessionAssistant, carteConnexion } from './components.js';
import { lireDansLeJournal, relireDuJournal, cleLecture, phraseEchec } from './import-cible.js';
import { blocApparierLecture } from './regroupement.js';
import { creerControleurEditeur, statutBrouillon, texteErreurBrouillon, panneauRepriseBrouillon, panneauComparaisonBrouillon, boutonsRecuperationTexte } from './brouillon-editeur.js';
import { protegerSortieEditeur } from './sortie-editeur.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';

// Formulaire unique ; le service décide si la publication modifie les informations ou crée une version.
export async function renderEditeurRecette(params,query,ctx,deps={}) {
  const {creerServiceBrouillons}=await import('../domain/brouillons-editeur.js');
  const service=deps.service||creerServiceBrouillons({repo,getGeneration:getSyncGeneration});
  const baseDB=repo.db,generation=getSyncGeneration();let dispose=false,monte=false,controleur=null,retirerGarde=null;
  const racine=el('div',{class:'stack editeur-recette'});
  const estCourante=()=>!dispose&&repo.db===baseDB&&getSyncGeneration()===generation&&(!monte||racine.isConnected);
  const porteeResultat=await service.capturerPortee({owner_id:ctx.proprietaireDonnees??null,estCourante});
  if(porteeResultat.issue!=='ok')return el('p',{class:'status warn',role:'status'},texteErreurBrouillon(porteeResultat));
  const portee=porteeResultat.portee,compte=capturerProprietaire(repo,ctx);
  let recipe=params.id?ctx.recipesById.get(params.id):null;
  const versions=recipe?(ctx.versionsByRecipe.get(recipe.id)||[]):[];
  let version=recipe?(query.v&&ctx.versionsById.get(query.v)?.recipe_id===recipe.id?ctx.versionsById.get(query.v):currentVersion(recipe,versions)):null;
  let intention=['adaptation','extraction','correction'].includes(query.kind)?query.kind:recipe?'correction':'extraction';
  const repli=recipe?`/recipes/${encodeURIComponent(recipe.id)}`:'/add';
  const tete=pageHeader(recipe?t('Modifier la recette'):t('Nouvelle recette'),{back:{...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli}),label:t('Retour')}});
  const hote=el('div',{class:'stack'});racine.append(tete);
  if(recipe)racine.append(el('p',{class:'muted'},recipe.display_title||recipe.original_title||'', ' · ',intention==='adaptation'?t('Ma version'):t('Correction'),version&&Number.isFinite(Date.parse(version.created_at))?' · '+t('Version du {date}',{date:new Date(version.created_at).toLocaleString()}):''));
  racine.append(hote);
  racine.dispose=()=>{dispose=true;retirerGarde?.();controleur?.detruire();};
  racine.flushEditeur=()=>controleur?.flush()||Promise.resolve({issue:'ok'});
  racine.etatEditeur=()=>controleur?.etat();
  const reprise=query.import?await relireDuJournal(query.import,'recette',{recipeId:recipe?.id??null,baseVersionId:version?.id??null}):null;
  let journal=null,journalPropose=reprise?.resultat?reprise.ligne:null;
  if(recipe&&!query.import){
    const enAttente=(await repo.byIndex('imports','recipe_id',recipe.id)).find(i=>i.kind==='recette'&&i.editor_base_version_id===version?.id&&i.status==='a_verifier');
    if(enAttente){const lu=await relireDuJournal(enAttente.id,'recette',{recipeId:recipe.id,baseVersionId:version.id});if(lu?.resultat)journalPropose=lu.ligne;}
  }
  // L’entrée de création existante est déjà une proposition à relire ; une relecture de correction demande son adoption.
  if(!recipe)journal=journalPropose;
  const editionId=query.edition||recipe?.edition_id||journalPropose?.edition_id||null;
  const edition=editionId?ctx.editionsById.get(editionId):null,book=edition?ctx.booksById.get(edition.book_id):null;
  const pageIds=query.pages?query.pages.split(',').filter(Boolean):recipe?.source_page_ids||journalPropose?.page_ids||[];
  const pages=pageIds.map(id=>ctx.pagesById.get(id)).filter(Boolean);
  const documentSource=query.doc?ctx.source_documents.find(d=>d.id===query.doc):null;
  const sessionId=query.session||journalPropose?.scan_session_id||null;
  const sessionScan=sessionId?(ctx.scan_sessions||[]).find(s=>s.id===sessionId):null;
  const sourceTM=estThermomix(version)?await lireSourceSansThermomix(version,{lire:id=>repo.get('recipe_versions',id)}):null;
  const affiche=()=>({...(recipe?{recipe}:{}),...(version?{version}:{}),...(edition?{edition}:{}),...(book?{book}:{}),pages,...(documentSource?{document:documentSource}:{}),...(sessionScan?{sessionScan}:{}),...(journal?{journal}:{}),...(sourceTM?.ok?{ancetres:sourceTM.ancetres}:{})});

  async function comparer() {
    const f=await controleur.flush();if(f.issue!=='ok'){erreur(f);return;}
    const e=controleur.etat(),resultat=await service.comparerBrouillon({id:e.id,portee,expectedRevision:e.revision});
    if(resultat.issue!=='ok'){erreur(resultat);return;}
    const panneau=panneauComparaisonBrouillon({service,id:e.id,portee,revision:e.revision,session:sessionActive,resultat,estCourante,onReprendre:r=>monter(r),onDecision:r=>{controleur.reprendre({session:sessionActive,id:e.id,revision:r.revision});comparaisonHote.replaceChildren();}});
    comparaisonHote.replaceChildren(panneau);
  }
  let erreurNoeud,comparaisonHote,sessionActive,copierSaisie;
  const erreur=r=>{if(erreurNoeud){erreurNoeud.textContent=texteErreurBrouillon(r);erreurNoeud.hidden=false;if(r?.raison==='revision_changee'&&copierSaisie)comparaisonHote.replaceChildren(el('button',{class:'btn',type:'button',onClick:copierSaisie},t('Conserver une copie séparée')));}};

  // Un brouillon reste consultable avant toute garde sur la cible disparue ou retirée.
  if(query.draft) {
    hote.append(await panneauRepriseBrouillon({service,id:query.draft,portee,estCourante,onReprendre:r=>monter(r),onComparer:async resultat=>{
      const lu=await service.lireBrouillon({id:query.draft,portee});
      hote.append(panneauComparaisonBrouillon({service,id:query.draft,portee,revision:lu.brouillon?.revision,session:lu.session,resultat,estCourante,onReprendre:r=>monter(r),onDecision:()=>{}}));
    }}));
    return racine;
  }
  if(params.id&&!recipe){hote.append(el('p',null,t('Recette introuvable.')));return racine;}
  if(recipe&&!recetteActiveDansContexte(recipe,ctx)){hote.append(mentionCycleRecette(recipe,edition));return racine;}
  const ouvrirNeuf=async()=>{const ouverture=await service.ouvrirBrouillon({kind:recipe?'recipe_version':'recipe_new',intention,portee,affiche:affiche()});if(ouverture.issue!=='ok'){hote.append(el('p',{class:'status warn'},texteErreurBrouillon(ouverture)));return;}await monter(ouverture);};
  if(recipe&&!query.import){
    const liste=await service.listerBrouillons({portee}),existants=liste.issue==='ok'?liste.brouillons.filter(d=>d.entity_id===recipe.id&&['recipe_metadata','recipe_version'].includes(d.kind)):[];
    if(existants.length){
      hote.append(el('h2',null,t('Brouillons de cette recette')));
      for(const d of existants){const q=new URLSearchParams(query);q.set('draft',d.id);hote.append(el('a',{class:'btn',href:`#/recipes/${encodeURIComponent(recipe.id)}/edit?${q}`},t('Reprendre le brouillon du {date}',{date:new Date(d.saved_at).toLocaleString()})));}
      hote.append(el('button',{class:'btn',type:'button',onClick:ouvrirNeuf},t('Commencer une autre modification')));return racine;
    }
  }
  await ouvrirNeuf();
  return racine;

  async function monter(ouverture) {
    if(!estCourante())return;
    retirerGarde?.();controleur?.detruire();
    sessionActive=ouverture.session;
    let modele=structuredClone(ouverture.modele||ouverture.brouillon?.payload),initial=structuredClone(modele);
    if(!modele)return;
    const brouillon=ouverture.brouillon;
    if(brouillon){intention=brouillon.intention||intention;recipe=ctx.recipesById.get(brouillon.entity_id)||recipe;version=ctx.versionsById.get(brouillon.base_version_id)||version;}
    let sectionActive='informations',publication=false;
    controleur=creerControleurEditeur({service,session:sessionActive,revision:ouverture.revision??brouillon?.revision??null,id:brouillon?.id??null,lirePayload:()=>structuredClone(modele)});
    copierSaisie=async()=>{const r=await service.copierBrouillon({session:sessionActive,payload:structuredClone(modele)});if(!estCourante())return;if(r.issue==='ok')await monter({...r,aConserver:true});else erreur(r);};
    controleur.souscrire(e=>{
      if(!e.id||e.sale||e.enCours||e.publie||!estCourante())return;
      const actuel=parseHash(),route=recipe?`/recipes/${encodeURIComponent(recipe.id)}/edit`:'/recipes/new';
      if(actuel.path!==route)return;
      const q=new URLSearchParams(actuel.query);q.set('draft',e.id);remplacerAdresse(`${actuel.path}?${q}`);
    });
    erreurNoeud=el('p',{class:'status warn',role:'status',hidden:true,dataset:{role:'erreur-enregistrement'}});comparaisonHote=el('div',{class:'stack'});
    const statut=statutBrouillon(controleur),source=el('section',{class:'editeur-source stack'}),formulaire=el('div',{class:'editeur-formulaire stack'});
    const informations=el('section',{class:'stack',dataset:{section:'informations'}}),ingredients=el('section',{class:'stack',dataset:{section:'ingredients'},hidden:true}),preparation=el('section',{class:'stack',dataset:{section:'preparation'},hidden:true});
    const avecLecture=!!journal||!!brouillon?.import_id;
    const sansChangement=()=>!avecLecture&&decrireChangementsRecette(modele,initial).sansChangement;
    const enregistrer=el('button',{class:'btn primary big',type:'button',disabled:sansChangement(),dataset:{role:'enregistrer-editeur'},onClick:publier},t('Enregistrer les modifications'));
    const modifier=()=>{controleur.modifier();enregistrer.disabled=publication||sansChangement();};
    const mettre=(part,k,v)=>{modele[part][k]=v;modifier();};
    const entree=(part,k,options={})=>el('input',{type:'text',value:modele[part][k]??'',dataset:{role:'editeur-'+k},...options,onInput:e=>mettre(part,k,e.target.value)});
    const titre=entree('metadata',recipe?'display_title':'original_title');
    if(recipe&&!Object.hasOwn(modele.metadata,'display_title'))titre.value=recipe.original_title||'';
    informations.append(field(recipe?t('Titre affiché'):t('Titre original *'),titre));
    if(recipe)informations.append(el('p',{class:'muted'},t('Titre original : {titre}',{titre:recipe.original_title||''})));
    informations.append(
      field(t('Langue du texte'),select([{value:'fr',label:'Français'},{value:'en',label:'English'},...(!['fr','en',null,undefined].includes(modele.metadata.original_language)?[{value:modele.metadata.original_language,label:modele.metadata.original_language}]:[])],modele.metadata.original_language||'fr',v=>mettre('metadata','original_language',v))),
      field(t('Type'),select([{value:'',label:t('— à préciser —')},...RECIPE_TYPES.map(v=>({value:v,label:label('recipe_type',v)}))],modele.metadata.type||'',v=>mettre('metadata','type',v||null))),
      field(t('Page imprimée'),entree('metadata','printed_page',{inputMode:'numeric'})));
    const cuisines=el('div',{class:'field'},el('span',null,t('Cuisines / régions'))),puces=el('div');cuisines.append(puces);
    const dessinerPuces=()=>puces.replaceChildren(renderPuces(pucesModel({choisies:modele.metadata.cuisines||[],existantes:cuisinesExistantes(ctx)}),{basculer:v=>{mettre('metadata','cuisines',basculerPuce(modele.metadata.cuisines||[],v));dessinerPuces();},ajouter:v=>{mettre('metadata','cuisines',ajouterPuce(modele.metadata.cuisines||[],v));dessinerPuces();}}));dessinerPuces();informations.append(cuisines);
    informations.append(field(t('Mots-clés'),el('input',{value:(modele.metadata.tags||[]).join(', '),onInput:e=>mettre('metadata','tags',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))})));
    if(!edition)informations.append(field(t('Source (si pas un livre)'),entree('metadata','source_label')));
    const temps=el('div',{class:'editeur-ligne-champs'});
    for(const [k,texte] of [['servings',t('Portions')],['prep_minutes',t('Préparation (min)')],['cook_minutes',t('Cuisson (min)')],['active_minutes',t('Actif (min)')],['total_minutes',t('Total (min)')]])temps.append(field(texte,entree('contenu',k,{inputMode:'decimal'})));
    informations.append(temps,field(t('Rendement (facultatif)'),entree('contenu','yield_text',{placeholder:t('Ex. : 2 pains de 450 g')})));
    const notes=el('textarea',{rows:3,value:modele.contenu.notes||'',dataset:{role:'editeur-notes'},onInput:e=>mettre('contenu','notes',e.target.value)});informations.append(field(t('Notes de cette version'),notes));
    if(intention==='adaptation')informations.append(field(t('Résumé des changements, raisons et compromis *'),el('textarea',{rows:3,value:modele.contenu.changes||'',dataset:{role:'editeur-changes'},onInput:e=>mettre('contenu','changes',e.target.value)})),field(t('Statut'),select([{value:'proposed',label:t('Proposée')},{value:'tested',label:t('Testée par Neegan')}],modele.contenu.status||'proposed',v=>mettre('contenu','status',v))));
    const hoteIngredients=el('div',{class:'stack'}),hoteEtapes=el('div',{class:'stack'});
    const avecId=(liste,index)=>{const ligne=modele.contenu[liste][index];if(!ligne.id)ligne.id=repo.newId(liste==='steps'?'st':'ri');return ligne.id;};
    const gestes=(liste,index,redessiner)=>el('div',{class:'row'},...[-1,1].map(sens=>el('button',{class:'btn small',type:'button',disabled:sens===-1?index===0:index===modele.contenu[liste].length-1,onClick:()=>{modele=deplacerElement(modele,liste,avecId(liste,index),sens);modifier();redessiner();}},sens===-1?t('Monter'):t('Descendre'))),el('button',{class:'btn small danger',type:'button',onClick:()=>{modele=retirerElement(modele,liste,avecId(liste,index));modifier();redessiner();}},t('Retirer')));
    const dessinerIngredients=()=>{hoteIngredients.replaceChildren();modele.contenu.ingredients.forEach((ligne,index)=>{
      const boite=el('div',{class:'card stack editeur-ingredient',dataset:{role:'editeur-ingredient',id:ligne.id||'ligne-'+index}}),champs=el('div',{class:'editeur-ligne-champs'});
      const mod=(patch)=>{modele=modifierIngredient(modele,avecId('ingredients',index),patch);modifier();verifie.checked=false;};
      champs.append(field(t('Quantité'),el('input',{value:ligne.quantity?.raw??'',inputMode:'decimal',dataset:{role:'ingredient-quantite'},onInput:e=>mod({quantity:parseQuantity(e.target.value)})})),field(t('Unité'),el('input',{value:ligne.unit_text||ligne.unit_id||'',dataset:{role:'ingredient-unite'},onInput:e=>{const u=matchUnit(e.target.value);mod({unit_text:e.target.value,unit_id:u.unit_id||null,unit_candidates:u.candidates||null});}})),field(t('Ingrédient'),el('input',{value:ligne.name_text??'',dataset:{role:'ingredient-nom'},onInput:e=>mod({name_text:e.target.value,ingredient_id:null})})),field(t('Préparation'),el('input',{value:ligne.preparation||'',dataset:{role:'ingredient-preparation'},onInput:e=>mod({preparation:e.target.value})})));
      const verifie=el('input',{type:'checkbox',checked:ligne.verification_state==='verified',onChange:e=>{modele=confirmerIngredient(modele,avecId('ingredients',index),e.target.checked);modifier();}});
      const sourceTexte=el('details',null,el('summary',null,t('Texte source')),el('p',{style:{whiteSpace:'pre-wrap'}},ligne.source_text||''));
      const identites=[{value:'',label:t('— non identifié —')},...(ctx.ingredients||[]).map(i=>({value:i.id,label:i.labels?.fr?.label||i.labels?.en?.label||i.id})),{value:'__new__',label:t('+ Créer un ingrédient…')}];
      boite.append(champs,field(t('Ingrédient reconnu'),select(identites,ligne.ingredient_id||'',async v=>{
        if(v!=='__new__'){mod({ingredient_id:v||null});return;}
        try{
          const langue=modele.metadata.original_language||'fr',nom=await promptDialog(t('Nom de l’ingrédient ({l})',{l:langue}),{value:ligne.name_text||''});
          if(!nom?.trim()||!estCourante()){dessinerIngredients();return;}
          const autre=await promptDialog(t('Nom dans l’autre langue (facultatif)'),{value:''});if(!estCourante())return;
          const labels=langue==='en'?{en:{label:nom.trim(),aliases:[]},fr:{label:autre?.trim()||nom.trim(),aliases:[]}}:{fr:{label:nom.trim(),aliases:[]},en:{label:autre?.trim()||nom.trim(),aliases:[]}};
          const ing={id:repo.newId('ing'),category:'autre',contains:null,labels,equivalences:[]};
          await repo.save('ingredients',ing,{conditions:{sync_state:[conditionProprietaire(await compte)]}});if(!estCourante())return;
          ctx.ingredients.push(ing);ctx.ingredientsById?.set(ing.id,ing);mod({ingredient_id:ing.id,name_text:nom.trim()});dessinerIngredients();
        }catch{erreur({raison:'stockage_indisponible'});dessinerIngredients();}
      })),el('label',{class:'row'},verifie,t('Ligne vérifiée')),sourceTexte,gestes('ingredients',index,dessinerIngredients));hoteIngredients.append(boite);
    });};
    const dessinerEtapes=()=>{hoteEtapes.replaceChildren();modele.contenu.steps.forEach((etape,index)=>{const textarea=el('textarea',{rows:5,value:etape.text,dataset:{role:'editeur-etape-texte'},onInput:e=>{modele=modifierEtape(modele,avecId('steps',index),e.target.value);modifier();}});hoteEtapes.append(el('div',{class:'card stack editeur-etape',dataset:{role:'editeur-etape',id:etape.id||'etape-'+index}},field(t('Étape {n}',{n:index+1}),textarea),gestes('steps',index,dessinerEtapes)));});};
    const analyse=el('details',{class:'card'},el('summary',null,t('Ajouter des ingrédients depuis un texte'))),texteAnalyse=el('textarea',{rows:4,dataset:{role:'texte-analyse-ingredients'}});
    analyse.append(field(t('Une ligne par ingrédient'),texteAnalyse),el('button',{class:'btn',type:'button',onClick:()=>{const lignes=parseIngredientBlock(texteAnalyse.value);if(!lignes.length)return;modele.contenu.ingredients.push(...lignes);texteAnalyse.value='';modifier();dessinerIngredients();}},t('Analyser les lignes')));
    ingredients.append(el('h2',null,t('Ingrédients')),hoteIngredients,el('button',{class:'btn',type:'button',onClick:()=>{modele.contenu.ingredients.push(parseIngredientLine(''));modifier();dessinerIngredients();hoteIngredients.lastElementChild?.querySelector('input')?.focus();}},t('Ajouter un ingrédient')),analyse);
    preparation.append(el('h2',null,t('Préparation')),hoteEtapes,el('button',{class:'btn',type:'button',onClick:()=>{modele.contenu.steps.push({id:repo.newId('st'),position:modele.contenu.steps.length+1,text:''});modifier();dessinerEtapes();hoteEtapes.lastElementChild?.querySelector('textarea')?.focus();}},t('Ajouter une étape')));
    if(sourceTM){preparation.prepend(el('div',{class:'status warn stack',dataset:{role:'correction-thermomix'}},el('p',null,t('Une correction manuelle invalide les réglages TM7. Tu peux conserver ce document ou repartir des étapes source pour créer une version personnelle.')),sourceTM.ok?el('button',{class:'btn',type:'button',disabled:modele.source_sans_thermomix,dataset:{role:'reprendre-source-sans-thermomix'},onClick:e=>{modele.contenu.steps=structuredClone(sourceTM.source.steps);modele.source_sans_thermomix=true;modele.contenu.changes=[modele.contenu.changes||'',t('Étapes source reprises sans les réglages Thermomix générés.')].filter(Boolean).join('\n\n');const resume=racine.querySelector('[data-role=editeur-changes]');if(resume)resume.value=modele.contenu.changes;modifier();dessinerEtapes();e.currentTarget.disabled=true;}},t('Repartir des étapes source sans réglages TM7')):el('p',null,t('La version source est absente ou a changé. Le document reste conservé ; aucun ancien réglage n’est réutilisé.'))));}
    const photos=el('section',{class:'stack',hidden:true,dataset:{section:'photos'}},el('h2',null,t('Photos')));
    const sources=el('section',{class:'stack',hidden:true,dataset:{section:'sources'}},el('h2',null,t('Sources')));
    const ouvrirGestion=(cible,texte)=>{
      const [chemin,parametres='']=cible.split('?'),q=new URLSearchParams(parametres);if(version)q.set('v',version.id);
      const href=lienAvecOrigine(chemin+(q.size?'?'+q:''),{cleEntree:ctx.navigation?.cleEntree});
      return el('a',{class:'btn',href,dataset:{role:'gestion-editeur'},onClick:async e=>{
        if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
        e.preventDefault();const r=await controleur.flush();if(!estCourante())return;if(r.issue!=='ok'){erreur(r);return;}navigate(href.slice(1));
      }},texte);
    };
    if(recipe){
      photos.append(ouvrirGestion(`/recipes/${encodeURIComponent(recipe.id)}/photo`,t('Gérer la photo')));
      if(['reference_only','partial'].includes(recipe.availability))sources.append(ouvrirGestion(`/recipes/${encodeURIComponent(recipe.id)}/importer`,t('Gérer les pages source')));
      else{
        const seances=(ctx.scan_sessions||[]).filter(s=>s.page_ids?.some(id=>pages.some(p=>p.id===id)));
        for(const seance of seances)sources.append(ouvrirGestion(`/import?session=${encodeURIComponent(seance.id)}`,t('Ouvrir la séance de ces pages')));
        if(edition)sources.append(ouvrirGestion(`/books/${encodeURIComponent(edition.id)}?onglet=sources`,t('Voir les sources du livre')));
        if(!edition&&!seances.length)sources.append(el('p',{class:'muted'},t('Cette recette complète n’a pas de séance ni de livre à gérer. Ses sources restent consultables ici.')));
      }
    }
    else for(const bloc of [photos,sources])bloc.append(el('p',{class:'muted'},t('La gestion des photos et des sources sera disponible après l’enregistrement de cette recette.')));
    sources.append(el('p',{class:'muted'},t('La source jointe reste consultable dans la vue Source.')));
    const sections={informations,ingredients,preparation,photos,sources},onglets=el('div',{class:'segmented editeur-sections'});
    for(const [nom,texte] of [['informations',t('Informations')],['ingredients',t('Ingrédients')],['preparation',t('Préparation')],['photos',t('Photos')],['sources',t('Sources')]])onglets.append(el('button',{type:'button',class:nom===sectionActive?'active':'','aria-pressed':String(nom===sectionActive),dataset:{section:nom},onClick:async e=>{const bouton=e.currentTarget,r=await controleur.flush();if(r.issue!=='ok'){erreur(r);return;}sectionActive=nom;Object.entries(sections).forEach(([k,n])=>n.hidden=k!==nom);for(const b of onglets.children){b.classList.toggle('active',b===bouton);b.setAttribute('aria-pressed',String(b===bouton));}}},texte));
    source.append(el('h2',null,t('Source')));
    const chargementsSources=[];
    if(pages.length){for(const p of pages){const img=el('img',{class:'page-view',alt:t('Page originale'),loading:'lazy'});let rotation=0,zoom=1;const appliquer=()=>{img.style.transform=`rotate(${rotation}deg) scale(${zoom})`;};source.append(el('figure',null,el('div',{class:'editeur-image-source'},img),el('figcaption',null,p.printed_page?t('p. {n}',{n:p.printed_page}):t('page non numérotée')),el('div',{class:'row'},el('button',{type:'button',class:'btn small',onClick:()=>{rotation=(rotation+90)%360;appliquer();}},t('Pivoter la vue')),el('button',{type:'button',class:'btn small',onClick:()=>{zoom=zoom===1?1.5:1;appliquer();}},t('Zoom')))));const indisponible=()=>{if(estCourante())img.replaceWith(el('p',{class:'muted',dataset:{role:'source-indisponible'}},t('Cette page source n’est pas disponible sur cet appareil.')));};chargementsSources.push(repo.getFile(p.sha256).then(f=>{if(estCourante()){const u=displayUrl(f);if(u)img.src=u;else indisponible();}}).catch(indisponible));}}
    else if(documentSource?.source_type==='pdf')source.append(pdfFrame({sha256:documentSource.sha256,filename:documentSource.original_filename}));
    else if(version){source.append(el('h3',null,recipe?.original_title||''),...version.ingredients.map(i=>el('p',{style:{whiteSpace:'pre-wrap'}},i.source_text||i.name_text||'')),...version.steps.map((s,i)=>el('p',{style:{whiteSpace:'pre-wrap'}},`${i+1}. ${s.text}`)));}
    else source.append(el('p',{class:'muted'},t('Aucune page source jointe. Tu peux saisir la recette et rattacher des pages plus tard.')));
    await Promise.allSettled(chargementsSources);
    const actionsLecture=el('div',{class:'stack'});
    let connecte=!!await sessionAssistant(ctx);
    const connexion=carteConnexion(()=>demarrerConnexion(ctx.sync?.auth),ctx);
    const montrerConnexion=()=>{if(!connecte&&!connexion.isConnected)actionsLecture.prepend(connexion);};
    montrerConnexion();
    const propositionHote=el('div',{class:'stack'});
    const montrerLecture=()=>{
      propositionHote.replaceChildren();if(!journalPropose?.resultat||journal&&cleLecture(journalPropose)===cleLecture(journal))return;
      const lue=structuredClone(journalPropose),r=lue.resultat;
      const panneau=el('details',{class:'card',open:true,dataset:{role:'lecture-editeur-proposee'}},el('summary',null,t('Lecture conservée à relire')),el('p',null,r.title||''),...r.ingredients.map(i=>el('p',{style:{whiteSpace:'pre-wrap'}},i.source_text)),...r.steps.map(s=>el('p',{style:{whiteSpace:'pre-wrap'}},s.text)));
      panneau.append(el('button',{class:'btn primary',type:'button',dataset:{role:'adopter-lecture-editeur'},onClick:async()=>{
        const f=await controleur.flush();if(f.issue!=='ok'){erreur(f);return;}
        if(!await confirmDialog(t('Remplacer les ingrédients et les étapes de ce formulaire par cette lecture ? Le brouillon déjà conservé reste disponible.'),{okLabel:t('Utiliser cette lecture')}))return;
        const actuelle=await repo.get('imports',lue.id);if(!estCourante())return;
        if(actuelle?.status!=='a_verifier'||cleLecture(actuelle)!==cleLecture(lue)){erreur({raison:'journal_change'});return;}
        const ancien=journal;journal=lue;
        const o=await service.ouvrirBrouillon({kind:recipe?'recipe_version':'recipe_new',intention,portee,affiche:affiche()});
        if(o.issue==='ok'){
          const changements=decrireChangementsRecette(modele,initial);
          for(const k of changements.metadata)o.modele.metadata[k]=structuredClone(modele.metadata[k]);
          for(const k of changements.contenu.filter(k=>!['ingredients','steps','source_sans_thermomix'].includes(k)))o.modele.contenu[k]=structuredClone(modele.contenu[k]);
          await monter({...o,aConserver:!changements.sansChangement});
        }else{journal=ancien;erreur(o);}
      }},t('Utiliser cette lecture')));propositionHote.append(panneau);
      if(!recipe)proposerReference(lue);
    };
    async function proposerReference(lue){
      const actuelle=await repo.get('imports',lue.id);if(!estCourante()||actuelle?.status!=='a_verifier'||actuelle.recipe_id!=null||cleLecture(actuelle)!==cleLecture(lue))return;
      const bloc=blocApparierLecture({ligne:actuelle,resultat:actuelle.resultat,ctx,repo,navigate,toast});if(bloc)propositionHote.append(bloc);
    }
    if(pages.length)actionsLecture.append(el('button',{class:'btn',type:'button',disabled:!connecte,dataset:{role:'extraire-editeur'},onClick:async e=>{
      const bouton=e.currentTarget;if(bouton.disabled||!bouton.isConnected)return;
      bouton.disabled=true;
      try{
        const f=await controleur.flush();if(f.issue!=='ok'){erreur(f);return;}
        const precedente=journalPropose||journal;
        if(precedente?.status==='a_verifier'&&!await confirmDialog(t('Une lecture est déjà conservée. Relire les pages utilisera un nouvel appel.'),{okLabel:t('Relire les pages')}))return;
        const r=await lireDansLeJournal({kind:'recette',importId:precedente?.id||null,cle:precedente?cleLecture(precedente):null,pageIds:pages.map(p=>p.id),editionId,sessionId,recipeId:recipe?.id??null,versionAffichee:version,ctx});
        if(!estCourante())return;
        if(!r.connecte){connecte=false;montrerConnexion();}
        if(!r.resultat){erreurNoeud.textContent=r.texte;erreurNoeud.hidden=false;return;}
        const relue=await repo.get('imports',r.importId);
        if(cleLecture(relue)!==r.cle){erreur({raison:'journal_change'});return;}
        journalPropose=relue;montrerLecture();
      }catch{erreur({raison:'stockage_indisponible'});}finally{bouton.disabled=!connecte;}
    }},journalPropose||journal?t('Relire les pages avec l’assistant IA'):t('Extraire avec l’assistant IA')));
    montrerLecture();actionsLecture.append(propositionHote);
    if(journal?.resultat){actionsLecture.append(el('p',{class:'status warn'},t('Extraction proposée par l’assistant — toutes les lignes sont à vérifier.'),journal.resultat.missing_page?' '+t('page possiblement manquante'):'',journal.resultat.incomplete?' '+t('lecture incomplète'):'',journal.resultat.uncertain_fields?.length?' '+t('Incertain')+' : '+journal.resultat.uncertain_fields.join(' ; '):''));if(!recipe)await proposerReference(journal);}
    if(reprise?.ligne?.status==='echec')actionsLecture.append(el('p',{class:'status warn'},phraseEchec(reprise.ligne.erreur)));
    formulaire.append(actionsLecture,onglets,informations,ingredients,preparation,photos,sources,erreurNoeud,comparaisonHote,el('div',{class:'row'},enregistrer,el('a',{class:'btn',href:'#'+retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli}).href},t('Annuler'))));
    const vueMobile=el('div',{class:'segmented editeur-vue-mobile'});let dernierChamp=null,positionModification=0;
    formulaire.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select'))dernierChamp=e.target;});
    for(const [vue,texte] of [['modification',t('Modification')],['source',t('Source')]])vueMobile.append(el('button',{class:vue==='modification'?'active':'',type:'button','aria-pressed':String(vue==='modification'),onClick:e=>{if(vue==='source')positionModification=window.scrollY;racine.dataset.vue=vue;for(const b of vueMobile.children){b.classList.toggle('active',b===e.currentTarget);b.setAttribute('aria-pressed',String(b===e.currentTarget));}if(vue==='modification'){window.scrollTo(0,positionModification);dernierChamp?.focus({preventScroll:true});}}},texte));
    racine.dataset.vue='modification';hote.replaceChildren(statut,vueMobile,el('div',{class:'editeur-colonnes'},source,formulaire),boutonsRecuperationTexte(()=>texteModele(modele)));
    dessinerIngredients();dessinerEtapes();retirerGarde=protegerSortieEditeur({racine,controleur});monte=true;
    if(brouillon){initial=creerModeleRecette({recipe,version},{intention});enregistrer.disabled=sansChangement();}
    if(ouverture.aConserver){controleur.modifier();enregistrer.disabled=false;}

    async function publier() {
      if(publication||enregistrer.disabled)return;
      if(intention==='adaptation'&&!modele.contenu.changes?.trim()){erreurNoeud.textContent=t('Décris les changements de ta version');erreurNoeud.hidden=false;return;}
      publication=true;enregistrer.disabled=true;erreurNoeud.hidden=true;
      try {
        if(!controleur.etat().id)controleur.modifier();
        const f=await controleur.flush();if(f.issue!=='ok'){erreur(f);return;}
        const e=controleur.etat(),p=await service.preparerPublication({id:e.id,portee,expectedRevision:e.revision});
        if(!['ok','deja_publie'].includes(p.issue)){erreur(p);if(p.issue==='refuse')comparaisonHote.replaceChildren(el('button',{class:'btn',type:'button',onClick:comparer},t('Comparer avec la version actuelle')));return;}
        if(!recipe&&editionId){const titre=modele.metadata.original_title||'',doublon=(ctx.recipes||[]).find(r=>r.edition_id===editionId&&r.original_title?.trim().toLowerCase()===titre.trim().toLowerCase()&&String(r.printed_page??'')===String(modele.metadata.printed_page??''));if(doublon&&!await confirmDialog(t('Une recette « {t} » existe déjà dans ce livre à la même page. Créer quand même ?',{t:doublon.original_title}),{okLabel:t('Créer un doublon')}))return;}
        const r=p.issue==='deja_publie'?p:await service.publierBrouillon({plan:p.plan});
        if(!['publie','deja_publie'].includes(r.issue)){erreur(r);return;}
        controleur.confirmerPublication(r);toast(intention==='adaptation'?t('Ma version enregistrée'):t('Recette enregistrée'));
        const recu=r.recu?.publication||r.recu||{},id=recu.recipe_id||recipe?.id;
        if(id)navigate(destinationApresRecette(id,query,ctx,recu.version_id?{v:recu.version_id}:{}));else if(typeof r.destination==='string')navigate(r.destination);
      } catch(e) {erreur({issue:'echec',raison:e?.name==='QuotaExceededError'?'quota_stockage':'stockage_indisponible'});}
      finally{publication=false;enregistrer.disabled=sansChangement();}
    }
  }
}

function texteModele(p){return [p.metadata.display_title||p.metadata.original_title||'',...p.contenu.ingredients.map(i=>[i.quantity?.raw,i.unit_text,i.name_text||i.source_text,i.preparation].filter(Boolean).join(' ')),...p.contenu.steps.map((s,i)=>`${i+1}. ${s.text}`),p.contenu.notes||''].join('\n\n');}
