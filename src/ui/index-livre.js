// Lot I1 « index fiable » (spec docs/superpowers/specs/2026-10-28-index-fiable-design.md, rév. 2) : le panneau d'index d'une séance de scan.
// L'IA lit chaque page (une lecture par page, D-I1), regroupe et classe ; à la fin de la lecture, les recettes CERTAINES deviennent des références
// « À importer » du livre, sans geste de plus (D-I15) ; la personne ne tranche que les ambiguïtés (« À vérifier ») et peut remettre une entrée écartée.
// Toute écriture passe par repo (transitionner : la ligne du journal et ses fiches en UNE transaction) ; le vol est celui du document (lancerVol).
import { el, toast as toastDom, confirmDialog, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { on } from '../core/bus.js';
import { logError } from '../core/log.js';
import * as repoModule from '../model/repo.js';
import { TransitionRefusee } from '../core/db.js';
import { sessionAssistant, carteConnexion } from './components.js';
import { newId as nouvelId } from '../core/ids.js';
import { lancerVol, annulerVol, volEnCours, ecouterVol, estEnLigne, texteRefus, cleLecture, BATTEMENT_MS } from './import-cible.js';
import { texteEchecIndex } from './table-matieres.js';
import { executantIndexParPage, relireResultatIndex, consolider, modelesValides, MODELES_INDEX, fabriquerReferenceIndex, completerExistante, referenceIntacte, renvoisDe, textePlages, cleTitre } from '../domain/index-livre.js';
import { importOuvert } from '../domain/import-cible.js';
import { capturerProprietaire, conditionProprietaire, capturerEdition, capturerRecette } from './recette-garde.js';
import { verifierCaptureEditionImport, memoireEditionImport } from '../domain/contexte-import.js';
import { mettreALaCorbeille } from '../domain/corbeille.js';
import { lireCycleRecette, ErreurCycleRecette } from '../domain/cycle-recette.js';
import { lireCycleEdition } from '../domain/cycle-edition.js';
import { conditionsSourcesImport, revoirLectureEditionImport, signaturePageImport } from '../domain/sources-import.js';
import { reconstruirePageIndex, maximumAppelsIndex } from '../domain/index-lecture.js';
import { reconstruireResultatIndex } from '../domain/index-stockage.js';
import { projeterIndexAffiche, unitesApplicationIndex, creerServiceApplicationIndex } from '../domain/index-application.js';
import { creerServiceRevisionsSource } from '../domain/revisions-source.js';
import { pagesActivesSeance, empreinteSources, projectionIdentitePage, projectionAnnotationPage } from '../domain/sources-format.js';
import { creerLectureIndexCapturee } from './index-vol.js';
import { getSyncGeneration } from './state.js';

const horloge = () => new Date().toISOString();
const liste = (v) => (Array.isArray(v) ? v : []);
const memeEdition = (ligne,capture) => {try {verifierCaptureEditionImport(ligne,capture);return ligne.edition_id===capture.edition_id;} catch {return false;}};
const memesSources = (ligne,pages) => {try {conditionsSourcesImport(ligne.sources_attendues);return ligne.sources_attendues==null || ligne.sources_attendues.every(s=>signaturePageImport(pages?.get(s.id))===s.signature);} catch {return false;}};

// Les lignes d'index d'une séance, et pour chaque page la lecture la plus RÉCENTE qui l'a lue (une page relue plus tard l'emporte ; une page en échec
// ne remplace pas une page lue). Rend { lignes, pages (format 2, une par page_id), decisions (fusion de toutes les lignes), modeleValide }.
export function lectureDeSeance(imports, sessionId, pageIdsSeance = null) {
  // Rangées par l'heure de DÉPART de la lecture (started_at, sinon created_at) : updated_at bouge quand une décision s'écrit dans la ligne, et une
  // vieille lecture repasserait alors devant une relecture plus récente de la même page.
  const quand = (L) => String(L.started_at || L.created_at || L.updated_at || '');
  const lignes = liste(imports).filter((i) => i?.kind === 'index' && i.scan_session_id === sessionId && i.index_storage?.role!=='result_fragment').sort((a, b) => quand(a).localeCompare(quand(b)));
  const parPage = new Map();
  const decisions = {};
  for (const L of lignes) {
    Object.assign(decisions, L.decisions && typeof L.decisions === 'object' ? L.decisions : {});
    if(L.index_call){
      if(L.index_call.kind!=='full')continue;
      const famille=lignes.filter(r=>r.index_call?.series_id===L.index_call.series_id&&r.index_call?.page_id===L.index_call.page_id);
      const vue={format:1,page_id:L.index_call.page_id,full_call_id:L.id,left_call_id:famille.find(r=>r.index_call.kind==='left_half')?.id??null,right_call_id:famille.find(r=>r.index_call.kind==='right_half')?.id??null};
      try{const p=reconstruirePageIndex(vue,famille),avant=parPage.get(p.page_id);if(p.etat!=='echec'||!avant||avant.etat==='echec')parPage.set(p.page_id,p);}catch{}
      continue;
    }
    if (L.status !== 'a_verifier' && L.status !== 'enregistre') continue;
    let r;
    try { r = relireResultatIndex(L.resultat, L.page_ids, { modeleLigne: L.model ?? null }); } catch { continue; }
    for (const p of r.pages) {
      const avant = parPage.get(p.page_id);
      if (p.etat === 'echec' && avant && avant.etat !== 'echec') continue;
      parPage.set(p.page_id, { ...p, ligne_id: L.id });
    }
  }
  const permis = Array.isArray(pageIdsSeance) ? new Set(pageIdsSeance) : null;
  const pages = [...parPage.values()].filter((p) => !permis || permis.has(p.page_id));
  return { lignes, pages, decisions, modeleValide: modelesValides(pages) };
}

// L'enregistrement automatique (D-I15) d'une ligne a_verifier pas encore enregistrée : consolider toutes les pages lues de la séance contre les fiches
// du livre, créer les certaines et compléter les existantes « À importer », en UNE transaction conditionnée à la lecture montrée (cleLecture) et à
// `auto_enregistre_at` encore vide (deux onglets : un seul enregistre). Rend { cree, aVerifier } ou null (rien à faire, ou refusé).
export async function enregistrerAuto(ligneId, { ctx, session, repo = repoModule, maintenant = horloge, newId = nouvelId, compte = null, contexteEdition = null } = {}) {
  const proprietaire = await (compte || capturerProprietaire(repo, ctx));
  const L = await repo.get('imports', ligneId);
  if (!L || L.index_call || L.kind !== 'index' || L.status !== 'a_verifier' || L.auto_enregistre_at) return null;
  const edition = session?.edition_id ? (ctx?.editionsById?.get(session.edition_id) ?? await repo.get('book_editions', session.edition_id)) : null;
  if (!edition) return null;
  const capture=contexteEdition || await capturerEdition(repo,edition,{ctx});
  verifierCaptureEditionImport(L,capture);
  if(lireCycleEdition(edition).etat!=='active')return null;
  const imports = await repo.all('imports');
  const lignesAdmissibles=imports.filter(row=>memeEdition(row,capture));
  const lecture = lectureDeSeance(lignesAdmissibles, session.id, session.page_ids);
  const recettes = (await repo.all('recipes')).filter((r) => r.edition_id === edition.id);
  const c = consolider(lecture.pages, { existantes: recettes, modeleValide: lecture.modeleValide });
  const nouvelles = c.certaines.map((x) => fabriquerReferenceIndex(x, { edition, newId, importId: ligneId }));
  const completees = [];
  for (const d of c.dejaDans) {
    const ex = recettes.find((r) => r.id === d.existanteId);
    const patch = completerExistante(ex, d);
    if (patch) completees.push({ ...ex, ...patch });
  }
  const restantes = c.aVerifier.filter((x) => !lecture.decisions[x.cle]);
  const cle = cleLecture(L);
  const quand = maintenant();
  const recettesCapturees=await Promise.all([...nouvelles,...completees].map(r=>capturerRecette(repo,r,{ctx,edition,creation:nouvelles.includes(r)})));
  try {
    await repo.transitionner('imports', ligneId, {
      attendus: ['a_verifier'],
      patch: (cur) => {
        verifierCaptureEditionImport(cur,capture);
        if (cur.auto_enregistre_at || cleLecture(cur) !== cle) throw new TransitionRefusee('imports', ligneId, cur.status);
        return { auto_enregistre_at: quand, enregistrees: nouvelles.map((r) => r.id), ...(restantes.length ? {} : { status: 'enregistre', finished_at: quand }) };
      },
      puts: { recipes: [...nouvelles, ...completees] },
      editions:[capture], recettes:recettesCapturees,
      conditions: { ...conditionsSourcesImport([...new Map(lecture.lignes.flatMap(row=>row.sources_attendues||[]).map(s=>[s.id,s])).values()]),recipes: nouvelles.map(r => ({ key: r.id, absente: true })), sync_state: [conditionProprietaire(proprietaire)] },
    });
  } catch (e) { if (e instanceof TransitionRefusee) return null; throw e; }
  repo.oublierProgressionIndex?.(ligneId).catch?.(() => {});
  return { cree: nouvelles.length, aVerifier: restantes.length };
}

// Une décision sur une entrée « À vérifier » ou écartée : `fiches` (0, 1 ou 2 références à créer) et la décision écrite dans la ligne, en UNE
// transaction ; la ligne passe enregistre quand plus rien n'attend. `cle` : la clé de l'entrée (cleTitre), préfixée « ecartee: » pour une écartée.
export async function decider(ligneId, cle, choix, fiches, { repo = repoModule, maintenant = horloge, resteApres = 0, compte = null, ctx = null, contexteEdition = null, attendu = null } = {}) {
  const proprietaire = await (compte || capturerProprietaire(repo, ctx));
  const ligne=await repo.get('imports',ligneId),editionId=ligne?.edition_id;
  if(ligne?.index_call)throw new TransitionRefusee('imports',ligneId,ligne.status);
  const edition=ctx?.editionsById?.get(editionId)||await repo.get('book_editions',editionId);
  const capture=contexteEdition||await capturerEdition(repo,edition,{ctx});verifierCaptureEditionImport(ligne,capture);
  const recettes=await Promise.all(fiches.map(r=>capturerRecette(repo,r,{ctx,edition,creation:true})));
  const quand = maintenant();
  await repo.transitionner('imports', ligneId, {
    attendus: ['a_verifier', 'enregistre'],
    editions:[capture],recettes,
    patch: (cur) => {
      verifierCaptureEditionImport(cur,capture);
      if(attendu&&cleLecture(cur)!==cleLecture(attendu))throw new TransitionRefusee('imports',ligneId,cur.status);
      const avant = cur.decisions && typeof cur.decisions === 'object' ? cur.decisions : {};
      // Une entrée déjà décidée (double tape, second onglet) ne l'est jamais deux fois : ses fiches seraient créées deux fois.
      if (Object.hasOwn(avant, cle)) throw new TransitionRefusee('imports', ligneId, cur.status);
      return { decisions: { ...avant, [cle]: choix }, ...(cur.status === 'a_verifier' && resteApres === 0 ? { status: 'enregistre', finished_at: quand } : {}) };
    },
    puts: fiches.length ? { recipes: fiches } : undefined,
    conditions: { ...conditionsSourcesImport(ligne.sources_attendues),...(fiches.length ? { recipes: fiches.map(r => ({ key: r.id, absente: true })) } : {}), sync_state: [conditionProprietaire(proprietaire)] },
  });
}

const RAISONS = () => ({
  contradiction: t('Pages contradictoires dans l’index : choisis.'),
  contradiction_existante: t('Déjà dans le livre à une autre page.'),
  page_inconnue: t('Page illisible ou absente.'),
  incertain: t('Lecture incertaine : vérifie le titre et la page.'),
  modele: t('Lue par un modèle non validé pour les index.'),
});
// Une ligne tapée à la main → { titre, renvois } : les renvois sont le plus long SUFFIXE fait de numéros (« 116–19 », « 34, 112 »), précédé d'un
// séparateur (espace, tiret, virgule, points de conduite) et éventuellement de « p. » ; sinon un numéro en tête (« 212 Pâtes puttanesca ») ; sinon le
// titre seul, sans page (il ira « à vérifier » à la fin du livre). Pure ; 500 lignes au plus, chacune ramenée à UNE ligne.
const SUFFIXE_RENVOIS = /^[\s\u2014\u2013\-,;:.]*(?:(?:pp?|pages?)\.?\s*)?(\d[\d\s,;\u2013\u2014-]*)$/i;
export function lireSaisieIndex(texte) {
  // Chaque ligne bornée à 300 points de code AVANT l'analyse (la recherche du suffixe est quadratique sur une ligne démesurée).
  const lignes = String(texte ?? '').split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/).slice(0, 2000).map((l) => [...l.replace(/\s+/g, ' ').trim()].slice(0, 300).join('').trim())
    .filter(Boolean).slice(0, 500);
  return lignes.map((l) => {
    for (let i = 1; i < l.length; i += 1) {
      const m = SUFFIXE_RENVOIS.exec(l.slice(i));
      if (!m) continue;
      const titre = l.slice(0, i).replace(/[\s\u2014\u2013\-,;:.]+$/, '').trim();
      if (/\p{L}/u.test(titre)) return { titre, renvois: m[1].trim() };
    }
    const tete = /^(\d{1,4})\s+(\D.*)$/.exec(l);
    if (tete) return { titre: tete[2].trim(), renvois: tete[1] };
    return { titre: l, renvois: '' };
  });
}

// La saisie à la main d'une table (filet : un PDF, une page que l'assistant ne lit pas, ou la fiche du livre) : chaque ligne devient une référence du livre,
// sauf celles déjà dans le livre (même titre et mêmes pages). Écrit par repo.saveBatch, en UNE fois ; `apres` est appelé après l'écriture.
export function saisieIndexManuelle(ed, { repo = repoModule, toast = toastDom, newId = nouvelId, apres = null, ctx = null, compte = null } = {}) {
  const capture = compte || capturerProprietaire(repo, ctx);
  const captureEdition=capturerEdition(repo,ed,{ctx});captureEdition.catch(()=>{});
  const zone = el('textarea', { rows: 5, placeholder: t('Une recette par ligne : Titre — 116–19'), 'aria-label': t('Recettes à ajouter à la main') });
  const bouton = el('button', { class: 'btn', type: 'button', dataset: { role: 'ajouter-saisie' }, onClick: async () => {
    if (bouton.disabled) return;
    const saisies = lireSaisieIndex(zone.value).filter((s) => s.titre);
    if (!saisies.length) { toast(t('Rien de nouveau à ajouter.')); return; }
    bouton.disabled = true;
    try {
      const pages = [{ page_id: 'saisie', etat: 'lue', sorte_page: 'table', page_imprimee: null, modele: MODELES_INDEX[0],
        entrees: saisies.map((s) => ({ titre: s.titre, renvois: s.renvois, rubrique: null, sorte: 'recette', incertain: false })) }];
      const recettes = (await repo.all('recipes')).filter((r) => r.edition_id === ed.id);
      const c = consolider(pages, { existantes: recettes });
      const fiches = [];
      for (const x of c.certaines) fiches.push(fabriquerReferenceIndex({ ...x, sources: [] }, { edition: ed, newId, plages: x.plages }));
      for (const x of c.aVerifier) {
        if (x.options) { for (const o of x.options) if (!o.existanteId) fiches.push(fabriquerReferenceIndex({ ...x, sources: [] }, { edition: ed, newId, plages: o.plages })); }
        else fiches.push(fabriquerReferenceIndex({ ...x, sources: [] }, { edition: ed, newId, plages: x.plages }));
      }
      if (!fiches.length) { toast(t('Rien de nouveau à ajouter.')); return; }
      const proprietaire = await capture;
      const contexteEdition=await captureEdition,contextesRecettes=await Promise.all(fiches.map(r=>capturerRecette(repo,r,{ctx,edition:ed,creation:true})));
      await repo.saveBatch({ recipes: fiches }, { editions:[contexteEdition],recettes:contextesRecettes,conditions: { recipes: fiches.map(r => ({ key: r.id, absente: true })), sync_state: [conditionProprietaire(proprietaire)] } });
      zone.value = '';
      toast(t('{n} recettes ajoutées', { n: fiches.length }));
      if (typeof apres === 'function') await apres(fiches);
    } catch (e) { logError('index_livre.saisie', { error: e }); toast(t('L’ajout n’a pas pu se faire. Réessaie.')); }
    finally { bouton.disabled = false; }
  } }, t('Ajouter ces recettes'));
  return el('div', { class: 'stack', dataset: { role: 'zone-saisie' } }, zone, el('div', { class: 'row' }, bouton));
}

const sourcesTexte = (sources) => liste(sources).map((s) => [s.rubrique, Number.isInteger(s.page_imprimee) ? t('index p. {p}', { p: s.page_imprimee }) : null].filter(Boolean).join(', ')).filter(Boolean).join(' ; ');

// Le panneau. `getPageIds()` : les pages à lire (toutes les pages d'une séance d'index, sinon la sélection). `seanceIndex` : la séance est un index.
export function panneauIndex(session, ctx, getPageIds, {
  seanceIndex = false, repo = repoModule, toast = toastDom, confirmer = confirmDialog, fetch: fetchInjecte = undefined, maintenant = horloge,
  battementMs = BATTEMENT_MS, enLigne = estEnLigne, newId = nouvelId, executant = null, connecter = null, ajouterPage = null, contexteEdition = null, lirePage = undefined, getGeneration = getSyncGeneration,
} = {}) {
  const compte = capturerProprietaire(repo, ctx);
  const captureEdition=contexteEdition?Promise.resolve(contexteEdition):session.edition_id?capturerEdition(repo,ctx.editionsById?.get(session.edition_id),{ctx}):Promise.resolve(null);captureEdition.catch(()=>{});
  const racine = el('section', { class: 'card stack', dataset: { role: 'panneau-index' } });
  const lecturesRelues=new Set();
  let detruit=false, sourcesEnAttente=null, pagesAffichees=liste(session.page_ids).map(id=>ctx.pagesById?.get(id)).filter(Boolean);
  const etat = { progression: null, occupe: false, retrait:false, abandon: null, seq: 0, sourcesChangees:false, reception:null, application:null, erreur:null };
  const serviceSources=creerServiceRevisionsSource({repo,getGeneration,maintenant,newId});
  const applications=creerServiceApplicationIndex({repo,serviceSources,maintenant,newId});
  const edition = () => (session.edition_id ? ctx.editionsById?.get(session.edition_id) ?? null : null);
  const capturerSources=async()=>serviceSources.capturerSources({session,pages:pagesAffichees,documents:liste(ctx.source_documents).filter(d=>liste(session.document_ids).includes(d.id)),contexte:{owner_id:(await compte).owner_id,edition:edition()}});
  let captureSources=capturerSources();captureSources.catch(()=>{});
  let importsLogiques=null, applicationChargee=false;
  const lecture = () => lectureDeSeance(importsLogiques??ctx.imports, session.id, session.page_ids);
  const relireImports = async () => {
    ctx.imports = await repo.all('imports'); ctx.recipes = await repo.all('recipes');
    importsLogiques=await Promise.all(ctx.imports.filter(r=>r.index_storage?.role!=='result_fragment').map(async r=>{
      if(!r.index_storage)return r;
      try{return{...r,resultat:await reconstruireResultatIndex({journal:r,imports:ctx.imports})};}catch(e){return{...r,resultat:null,lecture_incomplete:e.code||'result_incomplete'};}
    }));
    if(!applicationChargee){applicationChargee=true;const owner=(await compte).owner_id;
      const row=(await repo.all('sync_state')).find(r=>r.key?.startsWith('index_application:v1:')&&r.value?.owner_id===owner&&r.value.payload?.session_id===session.id&&r.value.state!=='complete');
      if(row)etat.application={id:row.value.id,plan:null,resultat:{issue:'interrompu',application:row.value.payload}};
    }
  };
  const pagesPositions = () => new Map(liste(session.page_ids).map((id, i) => [id, ctx.pagesById?.get(id)?.position ?? i + 1]));
  async function lectureAdmissible(lu,capture){
    const admis=[];
    for(const L of lu.lignes){
      if(!memeEdition(L,capture)||!memesSources(L,ctx.pagesById))continue;
      if(L.source_capture){if((L.source_capture.source_state_revision??null)!==(session.source_state?.revision??null)&&!lecturesRelues.has(L.id))continue;let valide=true;for(const p of L.source_capture.pages){const current=pagesAffichees.find(x=>x.id===p.id);if(!current||!pagesActivesSeance(session).includes(p.id)||await empreinteSources(projectionIdentitePage(current))!==p.identity_sha256||await empreinteSources(projectionAnnotationPage(current))!==p.annotation_sha256){valide=false;break;}}if(!valide)continue;}
      admis.push(L);
    }
    return lectureDeSeance(admis,session.id,session.page_ids);
  }
  async function appliquerProjection(projection,decisions=[],automatique=true){
    if(etat.sourcesChangees||etat.reception||etat.application)return null;
    const cap=await captureSources;if(cap.issue!=='ok'){etat.erreur=cap.raison;return null;}
    const unites=await unitesApplicationIndex({projection,decisions,automatique},{newId});if(!unites.length&&!projection.lecture.lignes.some(r=>r.status==='a_verifier'&&r.resultat?.pages?.[0]?.etat==='lue'&&r.resultat.pages[0].entrees.every((e,i)=>e.sorte==='autre'||r.index_resolved_occurrences?.includes(i))))return null;
    const p=await applications.preparerApplicationIndex({edition:projection.edition,journaux:projection.lecture.lignes,recettes:projection.recettes,unites,session,pages:pagesAffichees,captureSources:cap.capture});
    if(p.issue!=='ok'){etat.erreur=p.raison;return p;}
    etat.application={id:p.id,plan:p.plan,resultat:null};
    const result=await applications.appliquerIndex({plan:p.plan});etat.application.resultat=result;
    if(result.issue==='complete')etat.application=null;else etat.erreur=result.raison;
    await relireImports();return result;
  }
  async function comparerApplication(){
    if(etat.occupe||etat.sourcesChangees||!etat.application)return;
    etat.occupe=true;
    try{
      if(!etat.comparaison){await relireImports();const lu=await lectureAdmissible(lecture(),await captureEdition);etat.comparaison={projection:await projeterIndexAffiche({lecture:lu,edition:edition(),recettes:liste(ctx.recipes).filter(r=>r.edition_id===session.edition_id)}),decisions:[],conflits:[]};}
      const cap=await captureSources,result=await applications.preparerRepriseApplicationIndex({id:etat.application.id,projection:etat.comparaison.projection,session,pages:pagesAffichees,captureSources:cap.capture,decisions:etat.comparaison.decisions});
      if(result.issue==='a_comparer'){etat.comparaison.conflits=result.conflits;return;}
      if(result.issue!=='ok'){etat.erreur=result.raison;return;}
      etat.application={id:result.id,plan:result.plan,resultat:null};
      const r=await applications.appliquerIndex({plan:result.plan});etat.application.resultat=r;
      if(r.issue==='complete'){etat.application=null;etat.comparaison=null;etat.erreur=null;}else etat.erreur=r.raison;
      await relireImports();
    }catch(e){etat.erreur=e.code||'ecriture';}finally{etat.occupe=false;await dessiner();}
  }
  function retenirDecision(projection,x,decision){
    const g=projection.groupes.find(g=>g.candidate===x),d={unit_sha256:g.unit_sha256,...decision};
    if(!etat.comparaison)return appliquerProjection(projection,[d],false);
    etat.comparaison.decisions=etat.comparaison.decisions.filter(v=>v.unit_sha256!==d.unit_sha256);etat.comparaison.decisions.push(d);
    etat.comparaison.conflits=etat.comparaison.conflits.filter(v=>v.unit_sha256!==d.unit_sha256);
  }
  async function appliquerCertaines(){
    const lu=await lectureAdmissible(lecture(),await captureEdition);
    const projection=await projeterIndexAffiche({lecture:lu,edition:edition(),recettes:liste(ctx.recipes).filter(r=>r.edition_id===session.edition_id)});
    return appliquerProjection(projection);
  }
  async function lire(pageIds, { importId = null } = {}) {
    if (etat.occupe || !pageIds.length || etat.sourcesChangees || etat.reception || etat.application) return;
    etat.occupe = true; etat.autoInterrompu=false;etat.erreur=null;etat.abandon = new AbortController(); etat.progression = { page: 0, total: pageIds.length };
    try {
      const cap=await captureSources;if(cap.issue!=='ok'){etat.erreur=cap.raison;return;}
      await relireImports();
      for(const [i,id] of pageIds.entries()){
        if(etat.abandon.signal.aborted)break;
        const source=pagesAffichees.find(p=>p.id===id);if(!source||!pagesActivesSeance(session).includes(id)){etat.erreur='source_changed';break;}
        const lu=lecture(),vue=lu.pages.find(p=>p.page_id===id)?.vue;
        const demande=importId?lu.lignes.find(r=>r.id===importId):null;
        const full=vue?lu.lignes.find(r=>r.id===vue.full_call_id):demande?.index_call?lu.lignes.find(r=>r.index_call?.series_id===demande.index_call.series_id&&r.index_call.kind==='full'):null;
        const series_id=full?.index_call.series_id??newId('index'),appels=full?lu.lignes.filter(r=>r.index_call?.series_id===series_id):[];
        const service=creerLectureIndexCapturee({repo,ctx,edition:edition(),session,page:source,serviceSources,captureSources:cap.capture,lire:lirePage,fetch:fetchInjecte,maintenant,enLigne,battementMs,contexteEdition:await captureEdition,estCourante:()=>!detruit});
        etat.progression={page:i+1,total:pageIds.length};await dessiner();
        const result=await service.lire({series_id,appels,signal:etat.abandon.signal});
        if(result.issue==='conservation_echec'){etat.reception=service;etat.erreur=result.raison;break;}
        await relireImports();
        if(result.issue!=='termine'){etat.erreur=result.raison||'interne';if(!['illisible','hors_bornes','coupe'].includes(result.raison))break;}
      }
      if(etat.abandon.signal.aborted)etat.autoInterrompu=true;
      if(!etat.reception&&!etat.autoInterrompu)await appliquerCertaines();
    } catch (e) { etat.erreur=e.code||'ecriture';logError('index_livre.lire', { error: e }); }
    finally { etat.occupe = false; etat.abandon = null; etat.progression = null; await dessiner(); }
  }

  async function dessiner() {
    const seq = ++etat.seq;
    const pageIds = liste(getPageIds());
    const capture=await captureEdition;
    const toutes=lecture();
    const admissible=await lectureAdmissible(toutes,capture),idsAdmis=new Set(admissible.lignes.map(L=>L.id));
    const anciennes=toutes.lignes.filter(L=>['a_verifier','enregistre'].includes(L.status)&&L.resultat&&!idsAdmis.has(L.id));
    const lu=etat.sourcesChangees?toutes:admissible;
    // Une ligne a_verifier pas encore enregistrée (app fermée entre la réponse et l'enregistrement, autre onglet) : l'enregistrement se fait au rendu.
    const enAttente = lu.lignes.find((L) => !L.index_call && L.status === 'a_verifier' && !L.auto_enregistre_at);
    if (enAttente && !etat.occupe && !etat.sourcesChangees && edition()) {
      try { const fait = await enregistrerAuto(enAttente.id, { ctx, session, repo, maintenant, newId, compte,contexteEdition:await captureEdition }); if (fait) { await relireImports(); return dessiner(); } }
      catch (e) { logError('index_livre.enregistrer', { error: e, id: enAttente.id }); }
    }
    if(!etat.occupe&&!etat.autoInterrompu&&!etat.sourcesChangees&&!etat.application&&!etat.reception&&edition()&&lu.lignes.some(L=>L.index_call&&L.resultat)){
      const key=JSON.stringify(lu.lignes.map(L=>[L.id,L.started_at,L.index_decision_revision??null]));
      if(etat.autoCle!==key){etat.autoCle=key;try{const fait=await appliquerCertaines();if(fait?.issue==='complete')return dessiner();}catch(e){etat.erreur=e.code||'ecriture';}}
    }
    if (seq !== etat.seq) return;
    const vol = volEnCours();
    const ligneVol = vol && lu.lignes.some((L) => L.id === vol.importId) ? vol.importId : null;
    const echec = lu.lignes.filter((L) => L.status === 'echec' && importOuvert(L)).at(-1) ?? null;
    const parPage = new Map(lu.pages.map((p) => [p.page_id, p]));
    const nonLues = pageIds.filter((id) => !parPage.has(id));
    const incompletes = pageIds.filter((id) => ['partielle', 'echec'].includes(parPage.get(id)?.etat));
    const ed = edition();
    const livre = ed ? ctx.booksById?.get(ed.book_id) : null;
    const contenu = [];
    if(etat.sourcesChangees)contenu.push(el('div',{class:'status warn'},el('p',null,t('Les pages ont changé. Les lectures et tes choix sont conservés.')),el('button',{class:'btn',type:'button',dataset:{role:'revoir-sources'},onClick:async()=>{if(etat.occupe)return;session=structuredClone(sourcesEnAttente.session);pagesAffichees=structuredClone(sourcesEnAttente.pages);ctx.source_documents=await repo.all('source_documents');for(const p of pagesAffichees)ctx.pagesById.set(p.id,p);etat.sourcesChangees=false;lecturesRelues.clear();captureSources=capturerSources();await relireImports();await dessiner();}},t('Revoir les pages sélectionnées'))));
    if(etat.reception)contenu.push(el('div',{class:'status warn',dataset:{role:'reponse-non-conservee'}},el('p',null,t('La réponse est arrivée mais cet appareil ne l’a pas conservée. Garde cet écran ouvert.')),el('button',{class:'btn',type:'button',onClick:async()=>{const r=await etat.reception.reessayerConservation();if(r.issue==='conserve'){etat.reception=null;etat.erreur=null;await relireImports();await appliquerCertaines();}else etat.erreur=r.raison;await dessiner();}},t('Réessayer de conserver sans nouvel appel')),el('details',null,el('summary',null,t('Voir et copier la réponse')),el('textarea',{readOnly:true,rows:6,'aria-label':t('Réponse à conserver')},JSON.stringify(etat.reception.reponseNonConservee(),null,2)))));
    if(etat.application){const compte=etat.application.resultat?.application?.local_counts;contenu.push(el('div',{class:'status warn',dataset:{role:'application-index'}},el('p',null,t('{n} recettes conservées sur cet appareil. Les décisions restantes sont gardées.',{n:compte?.creates??0})),el('button',{class:'btn',type:'button',disabled:etat.occupe||etat.sourcesChangees,onClick:async()=>{if(etat.occupe)return;etat.occupe=true;try{const cap=await captureSources;if(!etat.application.plan){const p=await applications.reprendreApplicationIndex({id:etat.application.id,captureSources:cap.capture,session,pages:pagesAffichees,edition:edition()});if(p.issue!=='ok'){etat.erreur=p.raison;return;}etat.application.plan=p.plan;}const r=await applications.appliquerIndex({plan:etat.application.plan});etat.application.resultat=r;if(r.issue==='complete'){etat.application=null;etat.erreur=null;}else etat.erreur=r.raison;await relireImports();}finally{etat.occupe=false;await dessiner();}}},t('Reprendre l’enregistrement sans nouvel appel')),el('button',{class:'btn',type:'button',disabled:etat.occupe||etat.sourcesChangees,onClick:comparerApplication},t('Comparer et reprendre sans nouvel appel'))));}
    if(etat.comparaison)contenu.push(el('div',{class:'status warn',dataset:{role:'comparaison-index'}},el('p',null,t('Les choix encore valables sont conservés. Revois les autres décisions ci-dessous.')),...etat.comparaison.conflits.map(c=>el('p',null,c.titre||t('Le résultat de cette décision a changé. La décision précédente reste conservée.')))));
    if(etat.erreur)contenu.push(el('p',{class:'status warn',dataset:{role:'erreur-index'}},['source_changed','session_changed','capture_changee','result_changed','index_changed','owner_changed','compte_change','contexte_change'].includes(etat.erreur)?t('Le livre ou ses pages ont changé. Rouvre la séance avant de continuer.'):t('L’enregistrement ou la lecture a été interrompu. Tes réponses déjà conservées restent disponibles.')));
    for(const L of anciennes) {
      const zone=el('div',{class:'card stack',dataset:{role:'relecture-index'}},el('p',null,t('Ce résultat a été conservé. Relis-le avant de l’utiliser sur ce livre.')));
      try { const r=relireResultatIndex(L.resultat,L.page_ids,{modeleLigne:L.model??null});
        zone.append(el('ul',null,...r.pages.flatMap(p=>p.entrees.map(e=>el('li',null,`${e.titre} · ${e.renvois}`))))); } catch {}
      // Le journal historique L2 peut adopter un cycle restauré par ce geste explicite.
      // Les nouveaux appels capturés L5 restent liés à leurs cycles exacts.
      const relecturePermise=L.index_call?memeEdition(L,capture):L.status==='a_verifier'&&L.recipe_id==null&&!!capture
        &&L.edition_id===capture.edition_id&&(L.owner_id??null)===(capture.owner_id??null)&&(!capture.contexteValide||capture.contexteValide());
      zone.append(el('button',{class:'btn',type:'button',disabled:etat.occupe||etat.sourcesChangees||!relecturePermise,onClick:async ev=>{
        const bouton=ev.currentTarget;if(bouton.disabled)return;bouton.disabled=true;
        try { if(L.index_call){const famille=toutes.lignes.filter(r=>r.index_call?.series_id===L.index_call.series_id);for(const row of famille){for(const p of row.source_capture.pages){const current=pagesAffichees.find(x=>x.id===p.id);if(!current||!pagesActivesSeance(session).includes(p.id)||await empreinteSources(projectionIdentitePage(current))!==p.identity_sha256||await empreinteSources(projectionAnnotationPage(current))!==p.annotation_sha256)throw Error('source_changed');}}for(const row of famille)lecturesRelues.add(row.id);await appliquerCertaines();}else await revoirLectureEditionImport(L.id,{repo,contexte:capture,attendu:L});await relireImports();await dessiner(); }
        catch(e){logError('index_livre.relecture',{error:e});toast(t('Le livre ou ses pages ont changé. Rouvre la séance avant de continuer.'));bouton.disabled=false;}
      }},t('Réutiliser ce résultat après relecture')));contenu.push(zone);
    }
    contenu.push(el('h2', null, seanceIndex ? (livre?.title ? t('Index de {t}', { t: livre.title }) : t('Index du livre')) : t('Index / table des matières')));
    contenu.push(el('p', { class: 'muted', dataset: { role: 'compte-pages' } }, seanceIndex ? (pageIds.length === 1 ? t('1 page d’index') : t('{n} pages d’index', { n: pageIds.length })) : t('{n} page(s) sélectionnée(s)', { n: pageIds.length })));
    // B04 (D-I14) : l'état de la LECTURE, séparé de la phrase des photos de la séance (« Photos : k/n sauvegardées sur le serveur »). En vol, la ligne de
    // progression le dit (« Lecture de la page {i} sur {n}… »).
    if (!ligneVol && !etat.occupe) {
      const lues = lu.pages.filter((p) => pageIds.includes(p.page_id));
      const fin = lu.lignes.filter((L) => L.status === 'a_verifier' || L.status === 'enregistre').map((L) => L.finished_at || L.updated_at).filter(Boolean).sort().at(-1);
      const texte = !lues.length ? t('Lecture : à faire')
        : incompletes.length ? (incompletes.length === 1 ? t('Lecture : 1 page à relire') : t('Lecture : {m} pages à relire', { m: incompletes.length }))
          : nonLues.length ? (nonLues.length === 1 ? t('Lecture : 1 page à lire') : t('Lecture : {m} pages à lire', { m: nonLues.length }))
            : fin ? t('Lecture : faite le {d}', { d: formatDate(fin) }) : t('Lecture : faite');
      contenu.push(el('p', { class: 'muted', dataset: { role: 'etat-lecture' } }, texte));
    }
    if (lu.pages.length) contenu.push(el('p', { class: 'muted', dataset: { role: 'pages-lues' } }, pageIds.map((id) => {
      const p = parPage.get(id); const pos = pagesPositions().get(id);
      const nom = Number.isInteger(p?.page_imprimee) ? t('p. {p}', { p: p.page_imprimee }) : t('photo {n}', { n: pos ?? '?' });
      return `${nom} ${!p ? t('à lire') : p.etat === 'lue' ? '✓' : p.etat === 'partielle' ? t('incomplète') : t('échec')}`;
    }).join(' · ')));
    if (!ed) contenu.push(el('p', { class: 'status warn', dataset: { role: 'sans-livre' } }, t('Associe cette séance à un livre : les recettes lues y seront ajoutées.')));
    const session_ = await sessionAssistant(ctx);
    if (seq !== etat.seq) return;
    if (ligneVol || etat.occupe) {
      const pr = etat.progression;
      contenu.push(el('p', { class: 'status', role: 'status', dataset: { role: 'progression' } }, pr && pr.page ? t('Lecture de la page {i} sur {n}…', { i: pr.page, n: pr.total }) : t('Lecture de l’index par l’assistant…')),
        el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onClick: async () => { etat.abandon?.abort(); if (ligneVol) await annulerVol(ligneVol); } }, t('Annuler'))));
    } else {
      if (!session_) contenu.push(carteConnexion(connecter, ctx));
      const gestes = el('div', { class: 'row' });
      const bouton = (texte, ids, opts = {}) => el('button', { class: opts.primaire ? 'btn primary' : 'btn', type: 'button', disabled: !session_ || !enLigne() || !ed || etat.sourcesChangees || !!etat.reception || !!etat.application, dataset: { role: opts.role || 'lire' }, onClick: () => lire(ids, opts) }, texte);
      const cout=ids=>ids.reduce((n,id)=>{const vue=parPage.get(id)?.vue,full=vue&&lu.lignes.find(r=>r.id===vue.full_call_id);try{return n+(full?maximumAppelsIndex({page_id:id,series_id:full.index_call.series_id,appels:lu.lignes}):3);}catch{return n+3;}},0);
      const coutTexte=(verbe,ids)=>t('{action} ({n} appels au plus)',{action:verbe,n:cout(ids)});
      if (echec) {
        const { texte } = texteEchecIndex(echec.erreur);
        contenu.push(el('p', { class: 'status warn', dataset: { role: 'echec' } }, texte));
        const reste = liste(echec.page_ids).filter((id) => pageIds.includes(id));
        gestes.append(bouton(coutTexte(t('Reprendre la lecture'),reste), reste, { primaire: true, importId: echec.id, role: 'reprendre' }));
      } else if (nonLues.length) {
        const toutes = nonLues.length === pageIds.length;
        const texte = coutTexte(nonLues.length===1?t('Lire la page'):t('Lire les {n} pages',{n:nonLues.length}),nonLues);
        gestes.append(bouton(texte, nonLues, { primaire: true }));
      }
      if (!echec && incompletes.length) gestes.append(bouton(coutTexte(t('Reprendre les pages incomplètes'),incompletes), incompletes, { role: 'relire' }));
      if (seanceIndex && typeof ajouterPage === 'function') gestes.append(el('button', { class: 'btn', type: 'button', dataset: { role: 'ajouter-page' }, onClick: () => ajouterPage() }, t('Ajouter une page d’index')));
      if (gestes.querySelector('[data-role="lire"], [data-role="reprendre"], [data-role="relire"]')) {
        contenu.push(gestes, el('p', { class: 'muted' }, t('Une page trop dense est relue en deux moitiés : jusqu’à 2 appels de plus pour cette page. Chaque appel compte dans ton quota du jour.')));
      } else if (gestes.childElementCount) contenu.push(gestes);
    }
    if (lu.pages.length && ed) contenu.push(await resultat(lu, ed));
    if (seq !== etat.seq) return;
    contenu.push(saisieManuelle(ed));
    racine.replaceChildren(...contenu.filter(Boolean));
  }

  async function resultat(lu, ed) {
    const recettes = liste(ctx.recipes).filter((r) => r.edition_id === ed.id);
    const projection=etat.comparaison?.projection??(lu.lignes.some(L=>L.index_call)?await projeterIndexAffiche({lecture:lu,edition:ed,recettes}):null);
    const c = projection?projection.consolidation:consolider(lu.pages, { existantes: recettes, modeleValide: lu.modeleValide });
    const ids = new Set(lu.lignes.map((L) => L.id));
    const ajoutees = recettes.filter((r) => ids.has(r.index_import_id));
    const restantes = projection?projection.groupes.filter(g=>g.categorie==='a_verifier'&&!g.decidee).map(g=>g.candidate):c.aVerifier.filter((x) => !lu.decisions[x.cle]);
    const ecartees = projection?projection.groupes.filter(g=>g.categorie==='ecartee'&&!g.decidee).map(g=>g.candidate):c.ecartees.filter((x) => !lu.decisions[`ecartee:${cleTitre(x.titre)}`]);
    const ligneDecision = lu.lignes.filter((L) => L.status === 'a_verifier' || L.status === 'enregistre').at(-1);
    const bloc = el('div', { class: 'stack', dataset: { role: 'resultat-index' } });
    bloc.append(el('p', { class: 'status ok', dataset: { role: 'bilan' } }, t('{n} recettes dans le livre · {m} à vérifier · {k} écartées', { n: ajoutees.length, m: restantes.length, k: ecartees.length })));
    if (!lu.modeleValide) bloc.append(el('p', { class: 'status warn' }, t('Une page a été lue par un modèle non validé pour les index : rien n’a été ajouté d’office.')));
    if (c.chapitres.length) bloc.append(el('p', { class: 'status warn', dataset: { role: 'chapitres' } }, t('Cette page ne liste que des chapitres : photographie l’index ou la table détaillée pour retrouver les recettes.')));
    if (ed) bloc.append(el('a', { class: 'btn link', href: `#/books/${encodeURIComponent(ed.id)}` }, t('Voir les recettes du livre')));
    if (restantes.length && ligneDecision) {
      const raisons = RAISONS();
      const ul = el('ul', { class: 'list plain', dataset: { role: 'a-verifier' } });
      for (const x of restantes) {
        const li = el('li', { class: 'stack', dataset: { cle: x.cle } }, el('strong', null, x.titre), el('span', { class: 'muted' }, raisons[x.raison] || ''));
        const row = el('div', { class: 'row' });
        const creer = (plages) => fabriquerReferenceIndex(x, { edition: ed, newId, importId: ligneDecision.id, plages });
        const geste = (texte, choix, fiches, decision=null) => el('button', { class: 'btn small', type: 'button', disabled:etat.sourcesChangees||!!etat.application&&!etat.comparaison||!!etat.reception, onClick: async (ev) => {
          if (ev.currentTarget.disabled) return;
          for (const b of row.querySelectorAll('button')) b.disabled = true; // une décision à la fois, jamais deux fiches pour une tape doublée
          try { if(projection){await retenirDecision(projection,x,decision);}else await decider(ligneDecision.id, x.cle, choix, fiches(), { repo, maintenant, resteApres: restantes.length - 1, compte,ctx,contexteEdition:await captureEdition,attendu:ligneDecision }); }
          catch (e) { if (!(e instanceof TransitionRefusee)) { logError('index_livre.decider', { error: e }); toast(t('La décision n’a pas pu être enregistrée. Réessaie.')); } }
          await relireImports(); await dessiner();
        } }, texte);
        if (x.options) {
          for (const o of x.options) {
            li.append(el('span', { class: 'muted' }, `${textePlages(o.plages)} · ${o.existanteId ? t('déjà dans le livre') : sourcesTexte(o.sources)}`));
            if (!o.existanteId) row.append(geste(t('Garder {p}', { p: textePlages(o.plages) }), `garder:${textePlages(o.plages)}`, () => [creer(o.plages)],{action:'garder_option',option_sha256:o.option_sha256}));
          }
          if (x.raison === 'contradiction') row.append(geste(t('Les deux'), 'les_deux', () => x.options.filter((o) => !o.existanteId).map((o) => creer(o.plages)),{action:'garder_toutes',option_sha256:null}));
        } else {
          li.append(el('span', { class: 'muted' }, `${x.plages.length ? textePlages(x.plages) : t('page inconnue')} · ${sourcesTexte(x.sources)}`));
          row.append(geste(t('Ajouter au livre'), 'ajoutee', () => [creer(x.plages)],{action:'ajouter',option_sha256:null}));
        }
        row.append(geste(t('Écarter'), 'ecartee', () => [],{action:'ecarter',option_sha256:null}));
        li.append(row); ul.append(li);
      }
      bloc.append(el('h3', null, t('À vérifier')), ul);
    }
    if (ecartees.length && ligneDecision) {
      const d = el('details', { dataset: { role: 'ecartees' } }, el('summary', null, t('Écartées ({n})', { n: ecartees.length })));
      for (const x of ecartees) {
        d.append(el('div', { class: 'row' }, el('span', null, `${x.titre} · ${x.renvois}`), el('button', { class: 'btn small', type: 'button',disabled:etat.sourcesChangees||!!etat.application&&!etat.comparaison||!!etat.reception, onClick: async (ev) => {
          if (ev.currentTarget.disabled) return;
          ev.currentTarget.disabled = true;
          const { plages } = renvoisDe(x.renvois);
          const fiche = fabriquerReferenceIndex({ titre: x.titre, renvois: x.renvois, rubriques: x.rubrique ? [x.rubrique] : [], section: null, sources: [{ page_id: x.page_id, page_imprimee: x.page_imprimee, rubrique: x.rubrique }] }, { edition: ed, newId, importId: ligneDecision.id, plages });
          try { if(projection){await retenirDecision(projection,x,{action:'est_recette',option_sha256:null});}else await decider(ligneDecision.id, `ecartee:${cleTitre(x.titre)}`, 'recette', [fiche], { repo, maintenant, resteApres: restantes.length, compte,ctx,contexteEdition:await captureEdition,attendu:ligneDecision }); }
          catch (e) { if (!(e instanceof TransitionRefusee)) { logError('index_livre.ecartee', { error: e }); toast(t('La décision n’a pas pu être enregistrée. Réessaie.')); } }
          await relireImports(); await dessiner();
        } }, t('C’est une recette'))));
      }
      bloc.append(d);
    }
    const intactes = ajoutees.filter((r) => lireCycleRecette(r).etat==='active' && referenceIntacte(r, r.index_import_id));
    const capturesRetrait=new Map(intactes.map(r=>[r.id,capturerRecette(repo,r,{ctx,edition:ed})]));for(const p of capturesRetrait.values())p.catch(()=>{});
    if (intactes.length) {
      bloc.append(el('button', { class: 'btn link', type: 'button', disabled:etat.retrait,dataset: { role: 'retirer' }, onClick: async () => {
        if(etat.retrait)return;etat.retrait=true;let retires=0;
        try {
          if (!(await confirmer(t('Retirer ces {n} recettes ajoutées par la lecture ? Celles que tu as modifiées restent.', { n: intactes.length }), { okLabel: t('Retirer') }))) return;
          for(const r of intactes) {
            const actuelle=await repo.get('recipes',r.id);
            if(!referenceIntacte(actuelle,r.index_import_id))continue;
            await mettreALaCorbeille(r,{repo,edition:ed,contexte:await capturesRetrait.get(r.id),verifierCourante:current=>{
              if(JSON.stringify(current)!==JSON.stringify(r)||!referenceIntacte(current,r.index_import_id))throw new ErreurCycleRecette('source_modifiee',r.id);
            }});retires++;
          }
          toast(t('{n} recettes retirées', { n: retires }));
        } catch (e) { logError('index_livre.retirer', { error: e }); toast(retires?t('{n} sur {total} recettes retirées. Les autres sont restées.',{n:retires,total:intactes.length}):t('Le retrait n’a pas pu se faire. Réessaie.')); }
        finally {etat.retrait=false;await relireImports();await dessiner();}
      } }, t('Retirer ces {n} recettes', { n: intactes.length })));
    }
    return bloc;
  }

  function saisieManuelle(ed) {
    return el('details', { dataset: { role: 'saisie-manuelle' } }, el('summary', null, t('Saisir à la main')),
      ed ? saisieIndexManuelle(ed, { repo, toast, newId, ctx, compte, apres: async () => { await relireImports(); await dessiner(); } }) : null);
  }

  // Abonnements pris au montage, rendus au démontage : le bus (une autre écriture : synchronisation, autre onglet) et le vol du document.
  const offs = [];
  const redessinerSiMonte = async () => { if (!racine.isConnected) { offs.splice(0).forEach((f) => f()); return; } await relireImports(); await dessiner(); };
  const observer = new MutationObserver(() => { if (racine.isConnected && !offs.length) { offs.push(on('change', (d) => { if (['imports', 'recipes'].includes(d?.store)) redessinerSiMonte(); }), ecouterVol(() => { if (!etat.occupe) redessinerSiMonte(); })); observer.disconnect(); } });
  observer.observe(document, { childList: true, subtree: true });
  setTimeout(() => { if (!offs.length) observer.disconnect(); }, 30000); // un panneau jamais monté ne garde pas l'observateur du document
  racine.actualiserSources=({session:suivante,pages,selectedPageIds})=>{sourcesEnAttente={session:structuredClone(suivante),pages:structuredClone(pages),selectedPageIds:[...(selectedPageIds||[])]};etat.sourcesChangees=true;dessiner();};
  racine.dispose=()=>{detruit=true;etat.abandon?.abort();observer.disconnect();offs.splice(0).forEach(f=>f());};
  racine.dessiner = dessiner;
  racine.etatPanneau = () => ({ ...etat, abandon: !!etat.abandon });
  relireImports().then(dessiner).catch(e=>{logError('index_livre.monter',{error:e});etat.erreur='ecriture';dessiner();});
  return racine;
}
