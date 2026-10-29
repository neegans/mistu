import { retourConnu, porteeNavigation, lienAvecOrigine } from './navigation-contexte.js';
// Séance de scan continue (spec §16) : photos et fichiers conservés sur l'appareil, miniatures numérotées, regroupement,
// remplacement d'une page, entrées d'index, états fondés sur des événements réels. Aucune page n'est annoncée « sur le serveur » sans un remote
// de ce compte sur sa ligne files (lot G, § 4.3, I5).
import { el, toast, pickFiles, confirmDialog, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh, remplacerAdresse, parseHash } from '../core/router.js';
import { logError } from '../core/log.js';
import * as repo from '../model/repo.js';
import { remoteDeCeCompte } from '../sync/tables.js';
import { sha256Hex } from '../core/hash.js';
import { seanceDUnImportCible } from '../domain/import-cible.js';
import { ligneOuverteDeSeance } from '../domain/table-matieres.js';
import { pageHeader, section, emptyState, select, field, pdfFrame, libelleLivre, contexteFichiers, vignettesDePages, boutonTelechargerPages, gesteTelechargement } from './components.js';
import { demarrerConnexion } from './settings.js';
import { panneauIndex } from './index-livre.js';
import { panneauClassement, noteLotsDeSeance } from './regroupement.js';
import { capturerEdition, capturerProprietaire, conditionProprietaire } from './recette-garde.js';
import { lireCycleEdition } from '../domain/cycle-edition.js';
import { ErreurCycleRecette } from '../domain/cycle-recette.js';
import { editionsActives } from './state.js';

const signatureSeance = s => JSON.stringify([s?.id,s?.edition_id??null,s?.status,s?.page_ids??[],s?.document_ids??[]]);
const signaturePage = p => JSON.stringify([p?.id,p?.edition_id??null,p?.document_id??null,p?.sha256??null,p?.rotation??0,p?.printed_page??null,p?.position??null]);
const conditionSeance = s => ({key:s.id,fusion:c=>{if(signatureSeance(c)!==signatureSeance(s))throw new ErreurCycleRecette('source_modifiee');return null;}});
const conditionPage = p => ({key:p.id,fusion:c=>{if(signaturePage(c)!==signaturePage(p))throw new ErreurCycleRecette('source_modifiee');return null;}});

const INTENTIONS = ['index', 'recette'];
// L'intention (spec § 10) voyage dans l'adresse, pas dans la base : consommée au premier rendu, puis retirée.
// S9 : l'identifiant est encodé — il entre dans une adresse, et rien ne garantit qu'une fiche venue d'ailleurs
// (archive, serveur) en porte un sans « & » ni « = ».
export const adresseSeance = (sessionId, intention) => `/import?session=${encodeURIComponent(sessionId)}${INTENTIONS.includes(intention) ? `&intention=${intention}` : ''}`;
export function appliquerIntention({ intention, pageIds = [] } = {}) {
  if (!INTENTIONS.includes(intention)) return { selection: [], ouvrirIndex: false, consommee: false };
  return { selection: [...pageIds], ouvrirIndex: intention === 'index', consommee: true };
}

// C7 : l'intention n'est retirée de l'adresse que si l'adresse AFFICHÉE est encore celle de cette séance. Un
// `refresh()` arrivé pendant une navigation rend encore cette vue alors que l'adresse a déjà changé : réécrire
// l'adresse à ce moment-là remplacerait celle de l'écran SUIVANT par celle d'une séance qu'on vient de quitter.
export const peutRetirerIntention = (applique, sessionId, queryCourante) => !!applique?.consommee && queryCourante?.session === sessionId;

// Les écritures vivent dans repo.ajouterPages (spec import-cible § 3.6 : octets, séance, pages, documents — et la ligne du journal pour l'écran
// ciblé) ; ici seulement ce qui est propre à cet écran : le toast et la navigation vers la séance. `naviguer` et `notifier` sont injectables (tests).
export async function startScanSession(files, { edition_id = null, session_id = null, intention = null, contexteEdition = null, compte = null, sessionAttendue = null, ctx = null, naviguer = navigate, notifier = toast } = {}) {
  const proprietaire = await (compte || capturerProprietaire(repo, ctx));
  const attendue = sessionAttendue || (session_id ? await repo.get('scan_sessions',session_id) : null);
  edition_id = attendue?.edition_id ?? edition_id;
  if(edition_id&&!contexteEdition){const edition=ctx?.editionsById?.get(edition_id)??await repo.get('book_editions',edition_id);contexteEdition=await capturerEdition(repo,edition,{ctx});}
  const { session } = await repo.ajouterPages(files, { edition_id, session_id, ...(contexteEdition?{editions:[contexteEdition]}:{}), conditions:{sync_state:[conditionProprietaire(proprietaire)],...(attendue?{scan_sessions:[conditionSeance(attendue)]}:{})} });
  notifier(t('{n} fichier(s) conservé(s) sur cet appareil', { n: files.length }));
  naviguer(lienAvecOrigine(adresseSeance(session.id, intention)).slice(1));
  return session;
}

// Identité de l'appareil : une seule, celle de la base (spec § 4.2). Posée par repo.init() au démarrage.
export function deviceId() { return repo.deviceId(); }

// Le panneau d'index lit par le journal : le vol partagé (lancerVol, option lecture) et relireDuJournal vivent à côté du vol, dans
// src/ui/import-cible.js (tâche 6 du lot A et sa ronde 1 ; lot C, tâche 4).

export async function renderImport(params, query, ctx, deps = {}) {
  if (!query.session) return sessionsList(ctx,query);
  const session = ctx.scan_sessions.find((s) => s.id === query.session);
  if (!session) return el('div', { class: 'card' }, t('Séance introuvable.'));
  return sessionView(session, ctx, query, { deps }); // deps (lot C, D-C20) : les injectables du panneau d'index — le routeur n'en passe aucun
}

function sessionsList(ctx,query={}) {
  const compte = capturerProprietaire(repo,ctx);
  // Import ciblé (spec § 4.1, N3) : la séance d'un import CIBLÉ non terminé se reprend par la section « Imports » (de retour après ignore).
  const open = ctx.scan_sessions.filter((s) => s.status === 'open' && !seanceDUnImportCible(s, ctx.imports)).sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
  const root = el('div', null, pageHeader(t('Importer'), { back: {...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:'/add'}),label:t('Retour')} }));
  root.append(el('div', { class: 'row', style: { marginBottom: '1rem' } },
    el('button', { class: 'btn primary', onClick: async () => { const f = await pickFiles({ accept: 'image/*', capture: 'environment' }); if (f.length) await startScanSession(f,{compte,ctx}).catch(erreurImport); } }, t('Photographier des pages')),
    el('button', { class: 'btn', onClick: async () => { const f = await pickFiles({ accept: 'image/*,application/pdf,application/epub+zip' }); if (f.length) await startScanSession(f,{compte,ctx}).catch(erreurImport); } }, t('Choisir des fichiers'))));
  if (!open.length) root.append(emptyState('appareil-photo', t('Aucune séance en cours.')));
  else root.append(section(t('Séances à reprendre'), ...open.map((s) => el('a', { class: 'item-link card flat', href: lienAvecOrigine(`/import?session=${encodeURIComponent(s.id)}`) },
    el('div', { class: 'row between' }, el('strong', null, `${t('Séance du')} ${formatDate(s.started_at, { withTime: true })}`), el('span', { class: 'muted' }, t('{n} page(s)', { n: s.page_ids.length }))),
    el('div', { class: 'muted', style: { fontSize: '.85rem' } }, s.edition_id ? ctx.editionLabel(ctx.editionsById.get(s.edition_id)) : t('Livre non associé'))))));
  return root;
}

async function sessionView(session, ctx, query = {}, { historique = { remplacer: remplacerAdresse }, deps = {} } = {}) {
  const compte = capturerProprietaire(repo,ctx), editionAffichee = session.edition_id ? ctx.editionsById.get(session.edition_id) : null;
  const captureEdition = editionAffichee ? capturerEdition(repo,editionAffichee,{ctx}) : null;
  const baseSeance = structuredClone(session);
  const conditions = async (pages=[]) => ({sync_state:[conditionProprietaire(await compte)],scan_sessions:[conditionSeance(baseSeance)],...(pages.length?{source_pages:pages.map(conditionPage)}:{})});
  const options = async (pages=[]) => ({editions:captureEdition?[await captureEdition]:[],conditions:await conditions(pages)});
  const ajouter = async accept => {
    try { const files=await pickFiles(accept);if(files.length)await startScanSession(files,{session_id:session.id,sessionAttendue:baseSeance,contexteEdition:await captureEdition,compte,ctx}); }
    catch(e){erreurImport(e);}
  };
  const ctxF = await contexteFichiers(ctx);
  const pages = session.page_ids.map((id) => ctx.pagesById.get(id)).filter(Boolean);
  const docs = session.document_ids.map((id) => ctx.source_documents.find((d) => d.id === id)).filter(Boolean);
  const fileDocs = docs.filter((d) => d.source_type !== 'photo');
  if(session.edition_id && lireCycleEdition(editionAffichee).etat!=='active') {
    const root=el('div',{class:'stack'},pageHeader(t('Séance de scan'),{back:{...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:'/import'}),label:t('Retour')}}),el('p',{class:'status warn'},t('Livre dans la corbeille')),el('a',{class:'btn',href:`#/books/${encodeURIComponent(session.edition_id)}`},t('Livre')));
    const vues=await vignettesDePages(pages,ctxF);
    root.append(el('div',{class:'thumbs'},...pages.map(p=>el('figure',null,vues.places.get(p.id),el('figcaption',null,p.printed_page??p.position)))));
    const telecharger=boutonTelechargerPages(vues.distantes,{connecte:ctxF.connecte,telecharger:vues.telecharger});if(telecharger)root.append(telecharger);
    for(const d of fileDocs)root.append(el('p',null,d.original_filename),d.source_type==='pdf'?pdfFrame({sha256:d.sha256,filename:d.original_filename,connecte:ctxF.connecte,uid:ctxF.uid,telecharger:gesteTelechargement({moteur:ctxF.moteur})}):el('p',null,t('EPUB conservé. La lecture intégrée n’est pas encore disponible : indexe les recettes à la main ou exporte les pages en images.')));
    return root;
  }
  // L'intention (spec § 10, F6) voyage dans l'adresse : présélection des pages, panneau d'index ouvert ou non.
  // C6 : la présélection porte sur les pages RÉSOLUES — `session.page_ids` peut nommer une page que cette base n'a
  // pas (fiche reçue d'ailleurs, page retirée depuis). Cocher un identifiant sans page créait une sélection qui ne
  // correspondait à aucune miniature, et « Regrouper en recette » l'emportait dans son adresse.
  const applique = appliquerIntention({ intention: query.intention, pageIds: pages.map((p) => p.id) });
  // ?import=<imp> (spec § 4.5, tâche 6 ; lot C, D-C22) : la lecture d'index OUVERTE de cette séance — désignée par ?import=, sinon la plus récente
  // (ligneOuverteDeSeance) — rend le panneau visible ; à la reprise par ?import= (sans intention), ses pages RÉSOLUES sont présélectionnées (C6 : jamais un
  // identifiant sans vignette). Seules la présélection et l'importId du panneau suivent la ligne DÉSIGNÉE : une lecture close, d'une autre sorte ou d'une
  // autre séance n'est ni cochée ni relue ; la visibilité du panneau, elle, suit TOUTE ligne d'index ouverte de la séance (M67). Une intention a posé sa
  // sélection : elle gagne (garde équivalente tant que l'intention coche toutes les pages résolues, ronde 1).
  // Lot D (§ 4.1) : un ?import= qui désigne un classement OUVERT de cette séance l'emporte — ses pages présentes sont cochées sur a_lancer ou echec (rien
  // d'office sur a_verifier : l'écran de regroupement se rend), et le panneau d'index reste fermé (le repli de ligneOuverteDeSeance sur l'index le plus
  // récent ne vaut que pour un ?import= absent ou d'index). Sans ?import=, le classement ouvert le plus récent de la séance est montré aussi.
  const ligneClassement = ligneOuverteDeSeance(ctx.imports, session.id, { importId: query.import ?? null, kind: 'classement' });
  const classementDesigne = query.import && ligneClassement?.id === query.import ? ligneClassement : null;
  const ligneIndex = classementDesigne ? null : ligneOuverteDeSeance(ctx.imports, session.id, { importId: query.import ?? null });
  const ligneImport = query.import && ligneIndex?.id === query.import ? ligneIndex : null;
  const selected = new Set(applique.selection);
  if (!applique.consommee && ligneImport) {
    for (const id of Array.isArray(ligneImport.page_ids) ? ligneImport.page_ids : []) if (pages.some((p) => p.id === id)) selected.add(id);
  }
  if (!applique.consommee && classementDesigne && ['a_lancer', 'echec'].includes(classementDesigne.status)) {
    for (const id of Array.isArray(classementDesigne.page_ids) ? classementDesigne.page_ids : []) if (pages.some((p) => p.id === id)) selected.add(id);
  }
  const edition = session.edition_id ? ctx.editionsById.get(session.edition_id) : null;
  // Lot I1 (D-I11) : la séance est un index si on y est arrivé par « Ajouter des pages de sommaire » (intention index, gardée sur la séance : `but`),
  // si elle a déjà une lecture d'index, ou si ses pages sont déjà rangées en index.
  // Un ?import= qui désigne un classement l'emporte (lot D, § 4.1) : le panneau d'index reste fermé.
  const seanceIndex = !classementDesigne && (session.but === 'index' || applique.ouvrirIndex || !!ligneIndex
    || (ctx.imports || []).some((i) => i?.kind === 'index' && i.scan_session_id === session.id) || (pages.length > 0 && pages.every((p) => p.kind === 'index')));
  if (applique.ouvrirIndex && session.but !== 'index') { await repo.save('scan_sessions', { ...session,but:'index' },await options()).then(()=>{session.but='index';}).catch(erreurImport); }
  const root = el('div', null);
  root.append(pageHeader(t('Séance de scan'), { subtitle: `${t('Débutée le')} ${formatDate(session.started_at, { withTime: true })}`, back: {...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:'/import'}),label:t('Retour')} }));
  const noteLots = noteLotsDeSeance(session, ctx); if (noteLots) root.append(noteLots); // lot D (D-D18)

  // Lot G (§ 4.3, I5, F-21) : la phrase de séance dit un FAIT — les pages dont la ligne a un remote de ce compte. /import est une route de saisie :
  // doitRendreApresPasse refuse le rendu, donc cette ligne SEULE se redessine sur onEtat (jusqu'à ce que l'écran soit quitté).
  const phraseSeance = el('span', { class: 'status info', dataset: { role: 'phrase-seance' } });
  const majPhrase = async () => {
    if (!ctx.sync?.user) { phraseSeance.textContent = t('Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages'); return; }
    if (!pages.length) { phraseSeance.hidden = true; return; } // ronde 1 : une séance de documents seuls n'a pas de phrase « 0/0 photos »
    const fs = await repo.getFiles(pages.map((p) => p.sha256));
    const n = pages.filter((p) => remoteDeCeCompte(fs.get(p.sha256)?.remote, ctxF.uid)).length;
    // B04 (lot I1, D-I14) : la phrase ne dit QUE les photos ; la lecture de l'index a sa propre ligne, dans le panneau (« Lecture : … »).
    phraseSeance.textContent = t('Photos : {n}/{m} sauvegardées sur le serveur', { n, m: pages.length });
  };
  await majPhrase(); // l'abonnement à onEtat est pris en fin de rendu (ronde 1, plus bas)
  // États fondés sur des événements réels : ce qui est effectivement écrit dans la base locale.
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('span', { class: 'status ok' }, t('{n} page(s) conservée(s) sur cet appareil', { n: pages.length })),
    fileDocs.length ? el('span', { class: 'status info' }, t('{n} fichier(s) PDF/EPUB', { n: fileDocs.length })) : null,
    phraseSeance));

  // Livre associé
  const editionOptions = [{ value: '', label: t('— Aucun livre (à associer plus tard) —') }, ...editionsActives(ctx).map((e) => ({ value: e.id, label: libelleLivre(e, ctx.booksById.get(e.book_id)) }))];
  root.append(el('div', { class: 'card flat row between' },
    field(t('Livre de cette séance'), select(editionOptions, session.edition_id || '', async (v) => {
      try {
        const cible=v?ctx.editionsById.get(v):null,captureCible=cible?await capturerEdition(repo,cible,{ctx}):null,opts=await options(pages);
        const captures=[...opts.editions,...(captureCible&&captureCible.edition_id!==editionAffichee?.id?[captureCible]:[])];
        const upd = { scan_sessions: [{...session,edition_id:v||null}], source_pages: pages.map((p) => ({ ...p, edition_id:v||null })), source_documents: docs.map((d) => ({ ...d, edition_id:v||null })) };
        await repo.saveBatch(upd,{...opts,editions:captures}); refresh();
      }catch(e){erreurImport(e);}
    })),
    el('a', { class: 'btn small', href: '#/add' }, t('Nouveau livre'))));

  // Ajouter des pages
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('button', { class: 'btn primary', onClick: () => ajouter({ accept: 'image/*', capture: 'environment' }) }, t('+ Photographier')),
    el('button', { class: 'btn', onClick: () => ajouter({ accept: 'image/*,application/pdf' }) }, t('+ Fichiers'))));

  // Miniatures
  const thumbs = el('div', { class: 'thumbs' });
  const actions = el('div', { class: 'row', style: { margin: '.8rem 0' } });
  const drawActions = () => {
    actions.replaceChildren();
    const n = selected.size;
    // Lot D, ronde 1 de T2 : lue à CHAQUE redessin de la barre, sélection vide comprise — le panneau des états 4 et 5 suit la sélection (vide :
    // pagesALire retombe sur les pages de la ligne, la raison et le bouton changent aussi).
    const classement = panneau.actionsSelection();
    actions.append(el('span', { class: 'muted' }, n ? t('{n} page(s) sélectionnée(s)', { n }) : t('Sélectionne des pages pour les regrouper.')));
    if (n) {
      const ids = [...selected].join(',');
      actions.append(...[
        ...classement,
        panneau.regrouperPermis([...selected]) ? el('a', { class: n >= 2 ? 'btn' : 'btn primary', href: `#/recipes/new${buildQuery({ pages: ids, edition: session.edition_id || '', session: session.id })}` }, t('Regrouper en recette')) : null,
        seanceIndex ? null : el('button', { class: 'btn', onClick: () => { indexPanel.hidden = false; indexPanel.dessiner?.(); indexPanel.scrollIntoView({ behavior: 'smooth' }); } }, t('Index / table des matières')),
        n === 1 ? el('button', { class: 'btn', onClick: () => replacePage([...selected][0]) }, t('Remplacer cette page')) : null,
        el('button', { class: 'btn danger', onClick: () => removePages([...selected]) }, t('Retirer')),
      ].filter(Boolean));
    }
  };
  // Lot G (§ 4.3) : chaque miniature par vignettePage (image, ou l'état et son geste) ; « Télécharger les {n} pages » au-dessus, à partir de deux.
  const vignettes = await vignettesDePages(pages, ctxF, { alt: (p) => `${t('Page')} ${p.position}` });
  // Lot D (§ 4.2) : le panneau « Classement » (sous les miniatures, avant le panneau d'index) ; ses actions de sélection (« Classer ces photos avec
  // l’assistant ») se placent dans la barre AVANT « Regrouper en recette », qui n'est rendu que si la sélection ne touche pas un classement en vol ou reçu
  // (secondaire dès deux cochées, D-D2) ; chaque redessin du panneau redessine la barre.
  // Créé APRÈS le dernier await du rendu (vignettesDePages, lot G) : comme l'abonné de la phrase de séance (lot G, ronde 1), il n'est monté qu'au
  // tour qui suit la fin du rendu — créé avant, il se désabonnerait du bus sans avoir été monté ; drawActions ne le lit qu'après.
  const panneau = panneauClassement(session, ctx, () => [...selected], { ...deps,contexteEdition:await captureEdition, importId: ligneClassement?.id ?? null, surChangement: () => drawActions() });
  for (const p of pages) {
    const check = el('input', { type: 'checkbox', checked: selected.has(p.id), onChange: (e) => { if (e.target.checked) selected.add(p.id); else selected.delete(p.id); drawActions(); } });
    const pageInput = el('input', { type: 'number', placeholder: seanceIndex ? t('Page de l’index') : t('p. imprimée'), 'aria-label': seanceIndex ? t('Page de l’index') : t('p. imprimée'), value: p.printed_page ?? '', style: { minHeight: '30px', padding: '.2rem .4rem', fontSize: '.8rem' }, onChange: async (e) => { const valeur=e.target.value?parseInt(e.target.value,10):null;try{await repo.save('source_pages',{...p,printed_page:valeur},await options([p]));p.printed_page=valeur;}catch(error){erreurImport(error);} } });
    // Lot I1 (D-I12) : « Pivoter » (quart de tour), gardé sur la page (source_pages.rotation) : la miniature ET l'image envoyée à l'assistant le suivent.
    const fig = el('figure', { dataset: { page: p.id, rotation: String([90, 180, 270].includes(p.rotation) ? p.rotation : 0) } });
    const pivoter = el('button', { class: 'btn small', type: 'button', 'aria-label': t('Pivoter la page {n}', { n: p.position }), onClick: async () => {
      const r = (([90, 180, 270].includes(p.rotation) ? p.rotation : 0) + 90) % 360;
      try { await repo.save('source_pages', { ...p, rotation: r },await options([p])); p.rotation = r; fig.dataset.rotation = String(r); }
      catch (e) { logError('import.pivoter', { error: e, id: p.id }); toast(t('La page n’a pas pu être pivotée. Réessaie.')); }
    } }, `↻ ${t('Pivoter')}`);
    fig.append(el('span', { class: 'num' }, String(p.position)), vignettes.places.get(p.id),
      el('figcaption', null, el('label', { class: 'check' }, check, p.kind ? t(p.kind === 'index' ? 'Index' : 'Recette') : t('Sélectionner')), pageInput, pivoter,
        ...(p.issues || []).map((i) => el('div', { class: 'chip warn' }, i))));
    thumbs.append(fig);
  }
  const groupe = boutonTelechargerPages(vignettes.distantes, { connecte: ctxF.connecte, telecharger: vignettes.telecharger });
  if (groupe) root.append(groupe); // jamais root.append(null) : le DOM natif écrirait le nœud texte « null »
  root.append(thumbs, actions, panneau);
  drawActions();

  // Fichiers PDF / EPUB
  if (fileDocs.length) {
    root.append(section(t('Fichiers'), ...fileDocs.map((d) => {
      const box = el('div', { class: 'card flat stack' },
        el('div', { class: 'row between' }, el('strong', null, d.original_filename), el('span', { class: 'badge' }, d.source_type.toUpperCase())),
        el('div', { class: 'row' },
          el('a', { class: 'btn primary', href: `#/recipes/new${buildQuery({ doc: d.id, edition: session.edition_id || '', session: session.id })}` }, t('Créer une recette depuis ce fichier')),
          el('button', { class: 'btn', onClick: () => { indexPanel.hidden = false; indexPanel.dataset.doc = d.id; indexPanel.dessiner?.(); indexPanel.scrollIntoView({ behavior: 'smooth' }); } }, t('Indexer le livre'))));
      if (d.source_type === 'pdf') {
        box.append(pdfFrame({ sha256: d.sha256, filename: d.original_filename, connecte: ctxF.connecte, uid: ctxF.uid, telecharger: gesteTelechargement({ moteur: ctxF.moteur }) }));
      } else box.append(el('p', { class: 'muted' }, t('EPUB conservé. La lecture intégrée n’est pas encore disponible : indexe les recettes à la main ou exporte les pages en images.')));
      return box;
    })));
  }

  // Entrées d'index (lot C) : le panneau est visible au rendu dès qu'une ligne index OUVERTE existe pour cette séance (§ 4.1) — par n'importe quel
  // chemin, pas seulement Imports → Reprendre ; « Appliquer cet ordre » réordonne les vignettes EN PLACE par apresOrdre (D-C15 : aucun refresh(),
  // les éditions du tableau survivent).
  // Lot I1 (D-I11) : une séance d'INDEX (ouverte par « Ajouter des pages de sommaire », ou qui a déjà une lecture d'index) lit TOUTES ses pages, sans
  // cocher ; une séance générique lit la sélection, par « Index / table des matières ». Le panneau (src/ui/index-livre.js) lit page par page et enregistre.
  const indexPanel = panneauIndex(session, ctx, () => (seanceIndex ? pages.map((p) => p.id) : [...selected]), { ...deps, seanceIndex, connecter: () => demarrerConnexion(ctx.sync?.auth),
    contexteEdition:await captureEdition, ajouterPage: () => ajouter({ accept: 'image/*', capture: 'environment' }) });
  indexPanel.hidden = !seanceIndex;
  root.append(indexPanel);
  // consommée : un refresh() ne la réappliquera pas — mais seulement si l'adresse est encore celle-ci (C7).
  if (applique.consommee && peutRetirerIntention(applique, session.id, parseHash().query)) historique.remplacer(adresseSeance(session.id, null)+(query.origine?'&origine='+encodeURIComponent(query.origine):''));

  root.append(el('div', { class: 'row', style: { marginTop: '1rem' } },
    el('button', { class: 'btn', onClick: async () => { try{await repo.save('scan_sessions',{...session,status:'done'},await options());toast(t('Séance terminée'));navigate(retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:session.edition_id?`/books/${encodeURIComponent(session.edition_id)}`:'/library'}).href);}catch(e){erreurImport(e);} } }, t('Terminer la séance')),
    el('span', { class: 'muted' }, t('Une séance interrompue reste disponible dans Importer.'))));

  async function replacePage(pageId) {
    try {
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
    if (!files.length) return;
    const p = ctx.pagesById.get(pageId);
    const file = files[0];
    const sha256 = await sha256Hex(file);
    const doc = { id: repo.newId('doc'), edition_id: p.edition_id, source_type: 'photo', original_filename: file.name, blob_path: `files/${sha256}`, sha256, size: file.size, mime: file.type, scan_session_id: session.id, captured_at: repo.nowIso(), replaces_document_id: p.document_id };
    await repo.saveBatch({ source_documents: [doc], source_pages: [{ ...p, document_id: doc.id, sha256, issues: repo.issuesPourImage(file.size), replaced_at: repo.nowIso() }] },{...await options([p]),fichiers:[{sha256,blob:file,meta:{original_filename:file.name}}]});
    toast(t('Page remplacée')); refresh();
    }catch(e){erreurImport(e);}
  }
  async function removePages(ids) {
    try {
    // Lot D, ronde 1 : une page est liée dès qu'une fiche la nomme — source_page_ids, ou index_page_id (B-7 retire la photo d'index de l'union d'une fiche
    // lue) — ou qu'une version la cite (provenance.source_page_ids, relation d'archive dure) : la retirer casserait la fiche et la restauration.
    const liees = new Set();
    for (const r of await repo.all('recipes')) { for (const id of r.source_page_ids || []) liees.add(id); if (r.index_page_id) liees.add(r.index_page_id); }
    for (const v of await repo.all('recipe_versions')) for (const id of (Array.isArray(v?.provenance?.source_page_ids) ? v.provenance.source_page_ids : [])) liees.add(id);
    const used = ids.filter((id) => liees.has(id));
    if (used.length) { toast(t('{n} page(s) déjà liée(s) à une recette : retire d’abord la recette.', { n: used.length })); return; }
    if (!(await confirmDialog(t('Retirer {n} page(s) de la séance ? Les fichiers restent dans la base tant qu’une autre référence existe.', { n: ids.length }), { danger: true, okLabel: t('Retirer') }))) return;
    const selection=pages.filter(p=>ids.includes(p.id)),opts=await options(selection);delete opts.conditions.scan_sessions;
    const refuserLiens=(rows,extraire)=>{if(rows.some(r=>extraire(r).some(id=>ids.includes(id))))throw new ErreurCycleRecette('source_modifiee');};
    opts.conditions.recipes=[{toutes:true,verifier:rows=>refuserLiens(rows,r=>[...(r.source_page_ids||[]),r.index_page_id].filter(Boolean))}];
    opts.conditions.recipe_versions=[{toutes:true,verifier:rows=>refuserLiens(rows,r=>r.provenance?.source_page_ids||[])}];
    await repo.transitionner('scan_sessions',session.id,{...opts,attendus:['open','done'],patch:c=>{if(signatureSeance(c)!==signatureSeance(baseSeance))throw new ErreurCycleRecette('source_modifiee');return {page_ids:c.page_ids.filter(id=>!ids.includes(id))};}});
    refresh();
    }catch(e){erreurImport(e);}
  }
  // Lot G (§ 4.3, F-21) : la phrase SEULE suit onEtat. Ronde 1 : l'abonné ne survit jamais à l'écran. Il est pris en FIN de rendu ; au tour qui
  // suit (app.js insère le nœud dans la même suite de micro-tâches que la fin du rendu), un rendu jamais monté — dépassé par une navigation —
  // se désabonne aussitôt ; un écran monté puis quitté se désabonne au premier onEtat qui le trouve détaché, même s'il n'en a reçu aucun monté.
  if (typeof ctxF.moteur?.onEtat === 'function') {
    let vu = false;
    const retirer = ctxF.moteur.onEtat(() => {
      if (!phraseSeance.isConnected) { if (vu) retirer(); return; }
      majPhrase().catch((error) => logError('seance.phrase', { error }));
    });
    setTimeout(() => { vu = true; if (!phraseSeance.isConnected) retirer(); }, 0);
  }
  return root;
}

function erreurImport(error) { logError('import.source', {error});toast(t('Le livre ou ses pages ont changé. Rouvre la séance avant de continuer.')); }


// Une ligne tapée ou collée = une entrée. Ronde de clôture (R-C-24) : toute fin de ligne coupe (LF, CRLF compté une fois, CR seul, VT, FF, NEL U+0085,
// U+2028, U+2029 : les fins de ligne d'uneLigne) ; collée d'un PDF ou d'une page, une ligne qui en porte une n'est plus lue d'un bloc (le « . » des motifs
// ne les traverse pas : son numéro de page n'était pas lu).
const FIN_DE_LIGNE = /\r\n|[\n\r\v\f\u{0085}\u{2028}\u{2029}]/u;
export function parseIndexLines(text) {
  const out = [];
  for (const raw of (text || '').split(FIN_DE_LIGNE)) {
    const line = raw.trim();
    if (!line) continue;
    let m = /^(.*?)\s*(?:[—–-]|,|\.{2,}|\s+p\.?|\s+page)\s*p?\.?\s*(\d{1,4})\s*$/i.exec(line);
    if (m && m[1].trim()) { out.push({ title: m[1].trim().replace(/[,.]+$/, ''), printed_page: parseInt(m[2], 10), raw: line }); continue; }
    m = /^(\d{1,4})\s+(.+)$/.exec(line);
    if (m) { out.push({ title: m[2].trim(), printed_page: parseInt(m[1], 10), raw: line }); continue; }
    out.push({ title: line, printed_page: null, raw: line });
  }
  return out;
}
