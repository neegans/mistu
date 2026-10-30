import { el, pickFiles, confirmDialog, downloadBlob } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { contexteFichiers, vignettesDePages, boutonTelechargerPages } from './components.js';
import { getSyncGeneration } from './state.js';

export function texteErreurSources(resultat) {
  const raison=resultat?.raison??resultat?.code;
  if(['owner_changed','compte_change','epoch_changed','epoque_changee','database_changed','contexte_change','bibliotheque_remplacee'].includes(raison))return t('Le compte ou la bibliothèque a changé. Rouvre la séance avant de continuer.');
  if(['edition_cycle','edition_retiree','cycle_change','cycle_changee'].includes(raison))return t('Le livre a changé. Tes photos sont conservées ; revois le livre avant de continuer.');
  if(['source_changed','session_changed','source_modifiee','source_changee','session_modifiee'].includes(raison))return t('Les sources ont changé. Compare les images avant de continuer.');
  if(raison==='reception_incomplete')return t('La confirmation des sources n’est pas encore complète. Synchronise puis reviens comparer.');
  if(raison==='operations_dependantes')return t('Une autre modification dépend de ce choix. Les photos restent conservées ; cette suite doit être revue séparément.');
  if(['too_large','limite_depassee'].includes(raison))return t('Ces sources dépassent la taille permise pour ce geste. Choisis moins de pages.');
  if(['invalid_shape','format_invalide'].includes(raison))return t('Ces sources ne peuvent pas être utilisées dans cet état.');
  return t('L’enregistrement n’a pas abouti. Réessaie sans reprendre la photo.');
}

// La capture précède tout choix de fichier ou dialogue ; une reprise d’écriture garde le même plan.
export async function creerCommandesSources({repo,ctx,compte,lire,estCourante,onResultat,onBusy=()=>{},deps={}}) {
  const service=deps.serviceRevisions||(await import('../domain/revisions-source.js')).creerServiceRevisionsSource({repo,getGeneration:getSyncGeneration});
  const format=await import('../domain/sources-format.js');
  const choisir=deps.pickFiles||pickFiles,confirmer=deps.confirmDialog||confirmDialog;
  const racine=el('div',{class:'source-action-status stack',dataset:{role:'etat-sources'}});
  const message=el('p',{role:'status','aria-live':'polite'}),gestes=el('div',{class:'row'});racine.append(message,gestes);
  let occupe=false,planRefuse=null,optionsRefusees={},preparationRefusee=null,demandeRefusee=null,dialogue=null,detruit=false,declencheur=null;
  const vivante=()=>!detruit&&estCourante();
  const capturer=async(affiche=structuredClone(lire()))=>{
    const proprietaire=await compte;if(!vivante()||proprietaire.contexteValide&&!proprietaire.contexteValide())return {issue:'refuse',raison:'owner_changed'};
    return service.capturerSources({...affiche,contexte:{owner_id:proprietaire.owner_id,edition:affiche.edition??null,estCourante:vivante}});
  };
  const bouton=(texte,fn,primaire=false)=>el('button',{type:'button',class:`btn${primaire?' primary':''}`,onClick:()=>lancer(fn)},texte);
  async function lancer(fn){if(occupe||!vivante())return;declencheur=document.activeElement;occupe=true;onBusy(true);for(const b of racine.querySelectorAll('button'))b.disabled=true;
    try{return await fn();}catch(e){if(vivante())afficherErreur({issue:'echec',raison:e?.code,reessayable:true});}
    finally{occupe=false;if(vivante()){onBusy(false);for(const b of racine.querySelectorAll('button'))b.disabled=false;}}
  }
  function afficherErreur(r){message.textContent=texteErreurSources(r);gestes.replaceChildren();
    if(r.issue==='echec'&&(planRefuse||preparationRefusee))gestes.append(bouton(t('Réessayer l’enregistrement'),()=>planRefuse?appliquer(planRefuse,optionsRefusees):preparerPuisAppliquer(preparationRefusee)));
    if(demandeRefusee?.fichier)gestes.append(bouton(t('Récupérer ma photo'),()=>downloadBlob(demandeRefusee.fichier,demandeRefusee.fichier.name||'photo.jpg')));
    if(demandeRefusee?.fichiers?.length)gestes.append(bouton(t('Récupérer mes fichiers'),()=>{for(const f of demandeRefusee.fichiers)downloadBlob(f,f.name||'source');}));
    if(r.issue==='refuse'&&['source_changed','session_changed','source_modifiee','source_changee','session_modifiee'].includes(r.raison))gestes.append(bouton(t('Comparer les sources'),comparer));
  }
  async function appliquer(plan,{selection=null,annuler=null,rattachement=false}={}){
    planRefuse=plan;optionsRefusees={selection,annuler,rattachement};
    const r=await (rattachement?service.appliquerRattachementSources({plan}):service.appliquerRevision({plan}));
    if(!vivante())return r;
    if(['applique','deja_applique'].includes(r.issue)){
      planRefuse=null;preparationRefusee=null;demandeRefusee=null;message.textContent=t('Sources conservées sur cet appareil');gestes.replaceChildren();
      try{await onResultat(r,{selection,rattachement});}
      catch{if(vivante())message.textContent=t('Sources conservées. L’affichage n’a pas pu être actualisé. Rouvre la séance.');}
      if(annuler)gestes.append(bouton(t('Annuler le retrait'),()=>modifier({action:'select',activePageIds:annuler})));
    }else afficherErreur(r);
    return r;
  }
  async function modifier(demande){
    const affiche=structuredClone(lire()),capture=await capturer(affiche);if(capture.issue!=='ok'){afficherErreur(capture);return capture;}
    const d={...demande};
    if(d.action==='replace'&&!d.fichier){const fichiers=await choisir({accept:'image/*',multiple:false,capture:'environment'});if(!fichiers.length||!vivante())return;d.fichier=fichiers[0];}
    if(d.action==='append'&&!d.fichiers){d.fichiers=await choisir(d.choix||{accept:'image/*,application/pdf,application/epub+zip'});delete d.choix;if(!d.fichiers.length||!vivante())return;}
    let annuler=null;
    if(d.action==='hide'){
      if(!await confirmer(t('Retirer ces photos de la séance ? Les recettes et les photos déjà conservées restent.'),{okLabel:t('Retirer de la séance')}))return;
      if(!vivante())return;annuler=format.pagesActivesSeance(affiche.session);
    }
    demandeRefusee=d;planRefuse=null;
    preparationRefusee={capture:capture.capture,demande:d,annuler};
    return preparerPuisAppliquer(preparationRefusee);
  }
  async function preparerPuisAppliquer(preparation){
    const p=await service.preparerRevision({capture:preparation.capture,...preparation.demande});if(!vivante())return;
    if(p.issue!=='ok'){afficherErreur(p);return p;}
    return appliquer(p.plan,{annuler:preparation.annuler});
  }
  function fermer(){if(dialogue){dialogue.close();dialogue=null;}}
  async function historique(pageId=null){
    const affiche=structuredClone(lire()),parId=new Map(affiche.pages.map(p=>[p.id,p]));
    const active=format.pagesActivesSeance(affiche.session),page=parId.get(pageId),famille=p=>p.source_revision?.family_id??p.id;
    const pages=page?affiche.pages.filter(p=>famille(p)===famille(page)):affiche.pages;
    const ctxF=await contexteFichiers(ctx),vues=await vignettesDePages(pages,ctxF,{alt:p=>t('Photo de la page {n}',{n:p.printed_page??p.position??''})});if(!vivante())return;
    const avant=declencheur,contenu=el('div',{class:'source-revision-list'});
    const dlg=el('dialog',{class:'source-revision-panel','aria-label':t('Historique des photos')},el('h2',null,t('Historique des photos')),el('p',{class:'muted'},t('Les anciennes photos restent liées aux recettes et aux lectures qui les utilisent.')),contenu);
    dialogue=dlg;
    for(const p of pages){const courante=active.includes(p.id),figure=el('figure',{class:'source-revision-item',dataset:{revision:p.id}},vues.places.get(p.id),el('figcaption',null,courante?t('Photo actuelle'):t('Photo conservée')));
      figure.append(bouton(courante?t('Révision utilisée'):t('Utiliser cette révision'),async()=>{
        const ids=active.filter(id=>famille(parId.get(id)||{id})!==famille(p));
        const rang=active.findIndex(id=>famille(parId.get(id)||{id})===famille(p));ids.splice(rang<0?ids.length:rang,0,p.id);
        const cap=await capturer(affiche);if(cap.issue!=='ok'){afficherErreur(cap);return;}
        const prep=await service.preparerRevision({capture:cap.capture,action:'select',activePageIds:ids});if(!vivante())return;
        if(prep.issue==='ok'){const r=await appliquer(prep.plan,{selection:ids});if(['applique','deja_applique'].includes(r?.issue))fermer();}else afficherErreur(prep);
      }));figure.querySelector('button').disabled=courante;contenu.append(figure);
    }
    const telecharger=boutonTelechargerPages(vues.distantes,{connecte:ctxF.connecte,telecharger:vues.telecharger});if(telecharger)dlg.append(telecharger);
    dlg.append(el('button',{type:'button',class:'btn',onClick:fermer},t('Fermer')));
    dlg.addEventListener('close',()=>{dlg.remove();if(dialogue===dlg)dialogue=null;if(avant?.isConnected&&avant!==document.body)avant.focus();else racine.parentElement?.querySelector('[data-role=historique-sources]')?.focus();},{once:true});document.body.append(dlg);dlg.showModal();
  }
  async function comparer(){
    const ancienne=structuredClone(lire()),session=await repo.get('scan_sessions',ancienne.session.id);if(!session||!vivante())return;
    const pages=(await Promise.all((session.page_ids||[]).map(id=>repo.get('source_pages',id)))).filter(Boolean),documents=(await Promise.all((session.document_ids||[]).map(id=>repo.get('source_documents',id)))).filter(Boolean);
    const courante={session,pages,documents,edition:session.edition_id?await repo.get('book_editions',session.edition_id):null};
    const cap=await capturer(courante);if(cap.issue!=='ok'){afficherErreur(cap);return;}
    const avant=declencheur,dlg=el('dialog',{class:'source-comparison','aria-label':t('Comparer les sources')},el('h2',null,t('Les sources ont changé')));
    dialogue=dlg;
    const ctxF=await contexteFichiers(ctx),ids=format.pagesActivesSeance(session),vues=await vignettesDePages(pages.filter(p=>ids.includes(p.id)),ctxF);if(!vivante())return;
    dlg.append(el('div',{class:'source-comparison-choice'},el('h3',null,t('Sources actuelles')),...vues.places.values()));
    if(demandeRefusee?.fichier){const url=URL.createObjectURL(demandeRefusee.fichier);dlg.append(el('div',{class:'source-comparison-choice'},el('h3',null,t('Ma photo')),el('img',{src:url,alt:t('Ma photo')})));dlg.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});}
    dlg.append(bouton(t('Garder les sources actuelles'),async()=>{const v=await capturer(courante);if(v.issue!=='ok'){afficherErreur(v);return;}planRefuse=null;preparationRefusee=null;demandeRefusee=null;await onResultat({issue:'comparaison',session},{selection:ids});message.textContent=t('Sources actuelles affichées');gestes.replaceChildren();fermer();}));
    if(planRefuse&&service.preparerRepriseRevision)dlg.append(bouton(t('Utiliser mon choix'),async()=>{const p=await service.preparerRepriseRevision({plan:planRefuse,captureCourante:cap.capture});if(!vivante())return;if(p.issue!=='ok'){afficherErreur(p);return;}const r=await appliquer(p.plan);if(['applique','deja_applique'].includes(r?.issue))fermer();},true));
    dlg.append(el('button',{type:'button',class:'btn',onClick:fermer},t('Fermer')));dlg.addEventListener('close',()=>{dlg.remove();if(dialogue===dlg)dialogue=null;if(avant?.isConnected&&avant!==document.body)avant.focus();else racine.parentElement?.querySelector('[data-role=historique-sources]')?.focus();},{once:true});document.body.append(dlg);dlg.showModal();
  }
  const etatServeur=el('div',{class:'stack'}),phraseServeur=el('p',{role:'status','aria-live':'polite'}),gestesServeur=el('div',{class:'row'});etatServeur.hidden=true;etatServeur.append(phraseServeur,gestesServeur);racine.append(etatServeur);
  let serviceComparaison=null,lectureServeur=0;
  async function lireServeur(){
    serviceComparaison ||= (await import('../domain/comparaison-sources.js')).creerServiceComparaisonSources({repo,getGeneration:getSyncGeneration});
    const proprietaire=await compte;if(!vivante()||proprietaire.contexteValide&&!proprietaire.contexteValide())return null;
    return serviceComparaison.lireComparaisonSources({sessionId:lire().session.id,contexte:{owner_id:proprietaire.owner_id,estCourante:vivante}});
  }
  async function actualiserConflits(force=false){
    if(!vivante()||occupe&&!force||dialogue)return;const numero=++lectureServeur;
    const r=await lireServeur();if(!r||!vivante()||numero!==lectureServeur)return;
    gestesServeur.replaceChildren();etatServeur.hidden=!r.comparaison&&!r.recuperations?.length&&r.issue==='ok';
    if(r.issue!=='ok'){phraseServeur.textContent=texteErreurSources(r);gestesServeur.append(bouton(t('Revoir la synchronisation'),()=>actualiserConflits(true)));return;}
    phraseServeur.textContent=r.comparaison?t('Cette modification n’a pas été acceptée par le serveur. Tes photos restent sur cet appareil.'):t('Tes anciennes photos sont conservées sur cet appareil.');
    if(r.comparaison)gestesServeur.append(bouton(t('Comparer les sources synchronisées'),comparerServeur));
    if(r.recuperations?.length)gestesServeur.append(bouton(t('Voir mes photos conservées'),()=>recupererPhotos(r.recuperations)));
  }
  function ouvrirDialogue(dlg,avant){dialogue=dlg;dlg.append(el('button',{type:'button',class:'btn',onClick:fermer},t('Fermer')));dlg.addEventListener('close',()=>{dlg.remove();if(dialogue===dlg)dialogue=null;if(avant?.isConnected&&avant!==document.body)avant.focus();else racine.parentElement?.querySelector('[data-role=historique-sources]')?.focus();},{once:true});document.body.append(dlg);dlg.showModal();}
  async function porteeAffichageValide(){const p=await compte;return vivante()&&(!p.contexteValide||p.contexteValide())&&((await repo.get('sync_state','user_id'))?.value??null)===p.owner_id;}
  async function recupererPhotos(recuperations){
    const ids=[...new Set(recuperations.flatMap(r=>r.session.page_ids))],pages=(await Promise.all(ids.map(id=>repo.get('source_pages',id)))).filter(Boolean),ctxF=await contexteFichiers(ctx),vues=await vignettesDePages(pages,ctxF);if(!vivante())return;
    const dlg=el('dialog',{class:'source-revision-panel','aria-label':t('Mes photos conservées')},el('h2',null,t('Mes photos conservées')),el('p',null,t('Ces photos restent consultables. Elles ne remplacent pas les sources actuellement choisies.')),el('div',{class:'source-revision-list'},...pages.map(p=>el('figure',{class:'source-revision-item'},vues.places.get(p.id),el('figcaption',null,t('Photo conservée'))))));
    for(const p of pages){const f=await repo.get('files',p.sha256);if(f?.blob)dlg.append(bouton(t('Récupérer ma photo'),()=>downloadBlob(f.blob,'photo-'+p.id+'.jpg')));}
    const dl=boutonTelechargerPages(vues.distantes,{connecte:ctxF.connecte,telecharger:vues.telecharger});if(dl)dlg.append(dl);if(await porteeAffichageValide())ouvrirDialogue(dlg,declencheur);
  }
  async function comparerServeur(){
    const r=await lireServeur();if(!vivante()||!r)return;if(r.issue!=='ok'){afficherErreur(r);return;}if(!r.comparaison){await actualiserConflits(true);return;}
    const ctxF=await contexteFichiers(ctx),parties=[];
    for(const [graphe,titre]of [[r.confirmee,t('Sources confirmées par le serveur')],[r.locale,t('Mon choix sur cet appareil')]]){const ids=format.pagesActivesSeance(graphe.session),vues=await vignettesDePages(graphe.pages.filter(p=>ids.includes(p.id)),ctxF);const bloc=el('div',{class:'source-comparison-choice'},el('h3',null,titre),...vues.places.values());const dl=boutonTelechargerPages(vues.distantes,{connecte:ctxF.connecte,telecharger:vues.telecharger});if(dl)bloc.append(dl);parties.push(bloc);}
    if(!vivante())return;
    const dlg=el('dialog',{class:'source-comparison','aria-label':t('Comparer les sources')},el('h2',null,t('Comparer les sources')),el('p',null,t('Choisis les sources à utiliser. Les autres photos restent récupérables.')),...parties),erreur=el('p',{role:'status'});dlg.append(erreur);
    async function terminer(resultat){resultat=await resultat;if(!vivante())return;if(!['applique','deja_applique'].includes(resultat.issue)){erreur.textContent=texteErreurSources(resultat);return;}fermer();try{await onResultat(resultat,{selection:format.pagesActivesSeance(resultat.session)});}catch{message.textContent=t('Sources conservées. L’affichage n’a pas pu être actualisé. Rouvre la séance.');}phraseServeur.textContent=t('Ton choix est conservé sur cet appareil.');gestesServeur.replaceChildren(bouton(t('Voir mes photos conservées'),()=>recupererPhotos([{session:r.locale.session}])));}
    let plan=null;
    const suite=r.operations.length>1;if(suite)dlg.append(el('p',null,t('{n} modifications sont montrées ici. Les sources confirmées deviendront actives ; tes modifications seront conservées à part.',{n:r.operations.length})));
    if(suite){const liste=el('ol',{class:'stack',dataset:{role:'suite-sources'}});for(const [i,operation]of r.operations.entries()){const c=operation.payload,ids=c.new_pages?.length?c.new_pages.map(p=>p.id):c.active_page_ids||[],photos=r.locale.pages.filter(p=>ids.includes(p.id)),vues=await vignettesDePages(photos,ctxF);liste.append(el('li',{class:'source-comparison-choice'},el('h3',null,t('Modification {n}',{n:i+1})),...vues.places.values(),photos.length?null:el('p',null,t('Aucune photo sélectionnée'))));}dlg.append(liste);}

    dlg.append(bouton(suite?t('Garder les sources confirmées et conserver mes modifications à part'):t('Garder les sources confirmées'),()=>terminer(serviceComparaison.garderConfirmation({comparaison:r.comparaison,conserverSuiteAPart:suite}))),bouton(t('Utiliser mon choix'),async()=>{if(!plan){const p=await serviceComparaison.preparerRepriseConfirmee({comparaison:r.comparaison});if(p.issue!=='ok'){erreur.textContent=texteErreurSources(p);return;}plan=p.plan;}await terminer(await serviceComparaison.appliquerRepriseConfirmee({plan}));},true));
    if(await porteeAffichageValide())ouvrirDialogue(dlg,declencheur);
  }

  return {racine,actualiserConflits,modifier:d=>lancer(()=>modifier(d)),historique:id=>lancer(()=>historique(id)),
    rattacher:edition=>lancer(async()=>{const affiche=structuredClone(lire()),cap=await capturer(affiche);if(cap.issue!=='ok'){afficherErreur(cap);return;}
      if(!await confirmer(t('Associer ces sources à ce livre ? Les recettes déjà créées restent liées à leurs sources d’origine.'),{okLabel:t('Associer les sources')}))return;if(!vivante())return;
      const p=await service.preparerRattachementSources({capture:cap.capture,editionCibleAffichee:edition});if(!vivante())return;if(p.issue!=='ok'){afficherErreur(p);return;}return appliquer(p.plan,{rattachement:true});}),
    erreur:afficherErreur,occupe:()=>occupe,dispose:()=>{detruit=true;fermer();}};
}
