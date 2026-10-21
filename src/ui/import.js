// Séance de scan continue (spec §16) : photos et fichiers conservés sur l'appareil, miniatures numérotées, regroupement,
// remplacement d'une page, entrées d'index, états fondés sur des événements réels. Aucune page n'est annoncée « sur le serveur » sans un remote
// de ce compte sur sa ligne files (lot G, § 4.3, I5).
import { el, toast, toast as toastDom, pickFiles, confirmDialog, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh, remplacerAdresse, parseHash } from '../core/router.js';
import { logError } from '../core/log.js';
import { TransitionRefusee } from '../core/db.js';
import { borner } from '../core/bornes.js';
import * as repo from '../model/repo.js';
import * as repoModule from '../model/repo.js';
import { remoteDeCeCompte } from '../sync/tables.js';
import { sha256Hex } from '../core/hash.js';
import { assertVocabulaire } from '../domain/vocabulaire.js';
import { providerFrom, uneLigne } from '../domain/llm.js';
import { seanceDUnImportCible, importOuvert } from '../domain/import-cible.js';
import { cleReference, BORNE_RAW_ENTRY, ligneOuverteDeSeance, pagesALire, revaliderResultatIndex, planCreation, executerIndex } from '../domain/table-matieres.js';
import { pageHeader, section, emptyState, select, field, carteConnexion, pdfFrame, libelleLivre, sessionAssistant, contexteFichiers, vignettesDePages, boutonTelechargerPages, gesteTelechargement } from './components.js';
import { demarrerConnexion } from './settings.js';
import { lancerVol, annulerVol, volEnCours, estEnLigne, texteRefus, relireDuJournal, cleLecture, ecouterVol, BATTEMENT_MS } from './import-cible.js';
import { panneauLecture, texteEchecIndex, ligneEtatLecture, ligneIncertain, texteQuota } from './table-matieres.js';
import { panneauClassement } from './regroupement.js';

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
export async function startScanSession(files, { edition_id = null, session_id = null, intention = null, naviguer = navigate, notifier = toast } = {}) {
  const { session } = await repo.ajouterPages(files, { edition_id, session_id });
  notifier(t('{n} fichier(s) conservé(s) sur cet appareil', { n: files.length }));
  naviguer(adresseSeance(session.id, intention));
  return session;
}

// Identité de l'appareil : une seule, celle de la base (spec § 4.2). Posée par repo.init() au démarrage.
export function deviceId() { return repo.deviceId(); }

// Le panneau d'index lit par le journal : le vol partagé (lancerVol, option lecture) et relireDuJournal vivent à côté du vol, dans
// src/ui/import-cible.js (tâche 6 du lot A et sa ronde 1 ; lot C, tâche 4).

export async function renderImport(params, query, ctx, deps = {}) {
  if (!query.session) return sessionsList(ctx);
  const session = ctx.scan_sessions.find((s) => s.id === query.session);
  if (!session) return el('div', { class: 'card' }, t('Séance introuvable.'));
  return sessionView(session, ctx, query, { deps }); // deps (lot C, D-C20) : les injectables du panneau d'index — le routeur n'en passe aucun
}

function sessionsList(ctx) {
  // Import ciblé (spec § 4.1, N3) : la séance d'un import CIBLÉ non terminé se reprend par la section « Imports » (de retour après ignore).
  const open = ctx.scan_sessions.filter((s) => s.status === 'open' && !seanceDUnImportCible(s, ctx.imports)).sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
  const root = el('div', null, pageHeader(t('Importer'), { back: { href: '/add', label: t('Ajouter') } }));
  root.append(el('div', { class: 'row', style: { marginBottom: '1rem' } },
    el('button', { class: 'btn primary', onClick: async () => { const f = await pickFiles({ accept: 'image/*', capture: 'environment' }); if (f.length) startScanSession(f); } }, t('Photographier des pages')),
    el('button', { class: 'btn', onClick: async () => { const f = await pickFiles({ accept: 'image/*,application/pdf,application/epub+zip' }); if (f.length) startScanSession(f); } }, t('Choisir des fichiers'))));
  if (!open.length) root.append(emptyState('📷', t('Aucune séance en cours.')));
  else root.append(section(t('Séances à reprendre'), ...open.map((s) => el('a', { class: 'item-link card flat', href: `#/import?session=${s.id}` },
    el('div', { class: 'row between' }, el('strong', null, `${t('Séance du')} ${formatDate(s.started_at, { withTime: true })}`), el('span', { class: 'muted' }, t('{n} page(s)', { n: s.page_ids.length }))),
    el('div', { class: 'muted', style: { fontSize: '.85rem' } }, s.edition_id ? ctx.editionLabel(ctx.editionsById.get(s.edition_id)) : t('Livre non associé'))))));
  return root;
}

async function sessionView(session, ctx, query = {}, { historique = { remplacer: remplacerAdresse }, deps = {} } = {}) {
  const ctxF = await contexteFichiers(ctx);
  const pages = session.page_ids.map((id) => ctx.pagesById.get(id)).filter(Boolean);
  const docs = session.document_ids.map((id) => ctx.source_documents.find((d) => d.id === id)).filter(Boolean);
  const fileDocs = docs.filter((d) => d.source_type !== 'photo');
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
  const root = el('div', null);
  root.append(pageHeader(t('Séance de scan'), { subtitle: `${t('Débutée le')} ${formatDate(session.started_at, { withTime: true })}`, back: { href: '/import', label: t('Séances') } }));

  // Lot G (§ 4.3, I5, F-21) : la phrase de séance dit un FAIT — les pages dont la ligne a un remote de ce compte. /import est une route de saisie :
  // doitRendreApresPasse refuse le rendu, donc cette ligne SEULE se redessine sur onEtat (jusqu'à ce que l'écran soit quitté).
  const phraseSeance = el('span', { class: 'status info', dataset: { role: 'phrase-seance' } });
  const majPhrase = async () => {
    if (!ctx.sync?.user) { phraseSeance.textContent = t('Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages'); return; }
    if (!pages.length) { phraseSeance.hidden = true; return; } // ronde 1 : une séance de documents seuls n'a pas de phrase « 0/0 photos »
    const fs = await repo.getFiles(pages.map((p) => p.sha256));
    const n = pages.filter((p) => remoteDeCeCompte(fs.get(p.sha256)?.remote, ctxF.uid)).length;
    phraseSeance.textContent = t('{n}/{m} photos de cette séance envoyées au serveur', { n, m: pages.length });
  };
  await majPhrase(); // l'abonnement à onEtat est pris en fin de rendu (ronde 1, plus bas)
  // États fondés sur des événements réels : ce qui est effectivement écrit dans la base locale.
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('span', { class: 'status ok' }, t('{n} page(s) conservée(s) sur cet appareil', { n: pages.length })),
    fileDocs.length ? el('span', { class: 'status info' }, t('{n} fichier(s) PDF/EPUB', { n: fileDocs.length })) : null,
    phraseSeance));

  // Livre associé
  const editionOptions = [{ value: '', label: t('— Aucun livre (à associer plus tard) —') }, ...ctx.book_editions.map((e) => ({ value: e.id, label: libelleLivre(e, ctx.booksById.get(e.book_id)) }))];
  root.append(el('div', { class: 'card flat row between' },
    field(t('Livre de cette séance'), select(editionOptions, session.edition_id || '', async (v) => {
      session.edition_id = v || null;
      const upd = { scan_sessions: [session], source_pages: pages.map((p) => ({ ...p, edition_id: session.edition_id })), source_documents: docs.map((d) => ({ ...d, edition_id: session.edition_id })) };
      await repo.saveBatch(upd); refresh();
    })),
    el('a', { class: 'btn small', href: '#/add' }, t('Nouveau livre'))));

  // Ajouter des pages
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('button', { class: 'btn primary', onClick: async () => { const f = await pickFiles({ accept: 'image/*', capture: 'environment' }); if (f.length) startScanSession(f, { session_id: session.id }); } }, t('+ Photographier')),
    el('button', { class: 'btn', onClick: async () => { const f = await pickFiles({ accept: 'image/*,application/pdf' }); if (f.length) startScanSession(f, { session_id: session.id }); } }, t('+ Fichiers'))));

  // Miniatures
  const thumbs = el('div', { class: 'thumbs' });
  const actions = el('div', { class: 'row', style: { margin: '.8rem 0' } });
  const drawActions = () => {
    actions.replaceChildren();
    const n = selected.size;
    actions.append(el('span', { class: 'muted' }, n ? t('{n} page(s) sélectionnée(s)', { n }) : t('Sélectionne des pages pour les regrouper.')));
    if (n) {
      const ids = [...selected].join(',');
      actions.append(...[
        ...panneau.actionsSelection(),
        panneau.regrouperPermis([...selected]) ? el('a', { class: n >= 2 ? 'btn' : 'btn primary', href: `#/recipes/new${buildQuery({ pages: ids, edition: session.edition_id || '', session: session.id })}` }, t('Regrouper en recette')) : null,
        el('button', { class: 'btn', onClick: () => { indexPanel.hidden = false; indexPanel.scrollIntoView({ behavior: 'smooth' }); } }, t('Index / table des matières')),
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
  const panneau = panneauClassement(session, ctx, () => [...selected], { ...deps, importId: ligneClassement?.id ?? null, surChangement: () => drawActions() });
  for (const p of pages) {
    const check = el('input', { type: 'checkbox', checked: selected.has(p.id), onChange: (e) => { if (e.target.checked) selected.add(p.id); else selected.delete(p.id); drawActions(); } });
    const pageInput = el('input', { type: 'number', placeholder: t('p. imprimée'), value: p.printed_page ?? '', style: { minHeight: '30px', padding: '.2rem .4rem', fontSize: '.8rem' }, onChange: async (e) => { p.printed_page = e.target.value ? parseInt(e.target.value, 10) : null; await repo.save('source_pages', p); } });
    thumbs.append(el('figure', { dataset: { page: p.id } }, el('span', { class: 'num' }, String(p.position)), vignettes.places.get(p.id),
      el('figcaption', null, el('label', { class: 'check' }, check, p.kind ? t(p.kind === 'index' ? 'Index' : 'Recette') : t('Sélectionner')), pageInput,
        ...(p.issues || []).map((i) => el('div', { class: 'chip warn' }, i)))));
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
          el('button', { class: 'btn', onClick: () => { indexPanel.hidden = false; indexPanel.dataset.doc = d.id; indexPanel.scrollIntoView({ behavior: 'smooth' }); } }, t('Indexer le livre'))));
      if (d.source_type === 'pdf') {
        box.append(pdfFrame({ sha256: d.sha256, filename: d.original_filename, connecte: ctxF.connecte, uid: ctxF.uid, telecharger: gesteTelechargement({ moteur: ctxF.moteur }) }));
      } else box.append(el('p', { class: 'muted' }, t('EPUB conservé. La lecture intégrée n’est pas encore disponible : indexe les recettes à la main ou exporte les pages en images.')));
      return box;
    })));
  }

  // Entrées d'index (lot C) : le panneau est visible au rendu dès qu'une ligne index OUVERTE existe pour cette séance (§ 4.1) — par n'importe quel
  // chemin, pas seulement Imports → Reprendre ; « Appliquer cet ordre » réordonne les vignettes EN PLACE par apresOrdre (D-C15 : aucun refresh(),
  // les éditions du tableau survivent).
  const indexPanel = indexEntriesPanel(session, ctx, () => [...selected], { ...deps, importId: ligneImport?.id ?? null, apresOrdre: (maj) => reordonnerVignettes(thumbs, maj, { ctx, session }) });
  indexPanel.hidden = !(applique.ouvrirIndex || !!ligneIndex);
  root.append(indexPanel);
  // consommée : un refresh() ne la réappliquera pas — mais seulement si l'adresse est encore celle-ci (C7).
  if (applique.consommee && peutRetirerIntention(applique, session.id, parseHash().query)) historique.remplacer(adresseSeance(session.id, null));

  root.append(el('div', { class: 'row', style: { marginTop: '1rem' } },
    el('button', { class: 'btn', onClick: async () => { session.status = 'done'; await repo.save('scan_sessions', session); toast(t('Séance terminée')); navigate(session.edition_id ? `/books/${session.edition_id}` : '/library'); } }, t('Terminer la séance')),
    el('span', { class: 'muted' }, t('Une séance interrompue reste disponible dans Importer.'))));

  async function replacePage(pageId) {
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
    if (!files.length) return;
    const p = ctx.pagesById.get(pageId);
    const file = files[0];
    const sha256 = await sha256Hex(file);
    await repo.putFile(sha256, file, { original_filename: file.name });
    const doc = { id: repo.newId('doc'), edition_id: p.edition_id, source_type: 'photo', original_filename: file.name, blob_path: `files/${sha256}`, sha256, size: file.size, mime: file.type, scan_session_id: session.id, captured_at: repo.nowIso(), replaces_document_id: p.document_id };
    await repo.saveBatch({ source_documents: [doc], source_pages: [{ ...p, document_id: doc.id, sha256, issues: repo.issuesPourImage(file.size), replaced_at: repo.nowIso() }] }); // une seule définition du signalement (repo.issuesPourImage)
    toast(t('Page remplacée')); refresh();
  }
  async function removePages(ids) {
    const used = ids.filter((id) => ctx.recipes.some((r) => (r.source_page_ids || []).includes(id)));
    if (used.length) { toast(t('{n} page(s) déjà liée(s) à une recette : retire d’abord la recette.', { n: used.length })); return; }
    if (!(await confirmDialog(t('Retirer {n} page(s) de la séance ? Les fichiers restent dans la base tant qu’une autre référence existe.', { n: ids.length }), { danger: true, okLabel: t('Retirer') }))) return;
    session.page_ids = session.page_ids.filter((id) => !ids.includes(id));
    await repo.removeMany('source_pages', ids);
    await repo.save('scan_sessions', session);
    refresh();
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

// D-C15 (lot C) : après « Appliquer cet ordre », l'écran de séance suit SANS reconstruction — les MÊMES figures réordonnées dans `thumbs` selon
// seance.page_ids RELUE, .num réécrits, session.page_ids posé, et les MÊMES objets de ctx.pagesById mis à jour (le champ « p. imprimée » d'une
// vignette réécrit ensuite une fiche à jour, leçon C4).
export function reordonnerVignettes(thumbs, { pages = [], seance = null } = {}, { ctx, session }) {
  for (const maj of Array.isArray(pages) ? pages : []) { const p = ctx?.pagesById?.get(maj?.id); if (p) p.position = maj.position; }
  if (Array.isArray(seance?.page_ids)) session.page_ids = [...seance.page_ids];
  const parPage = new Map([...thumbs.children].map((f) => [f.dataset.page, f]));
  for (const id of session.page_ids) { const f = parPage.get(id); if (f) thumbs.append(f); }
  for (const f of thumbs.children) {
    const p = ctx?.pagesById?.get(f.dataset.page);
    if (!p) continue;
    const num = f.querySelector('.num'); if (num) num.textContent = String(p.position);
    const img = f.querySelector('img'); if (img) img.alt = `${t('Page')} ${p.position}`;
  }
}

// Panneau d'entrées d'index (lot C, spec § 4.2) : quatre états et un état « en vol », lus sur la ligne du journal `kind: 'index'` OUVERTE de la séance
// (ligneOuverteDeSeance : ctx.imports au rendu, aucun flash ; relue dans la base avant tout geste, leçon C4).
//   1) sans lecture : la zone de texte et « Lire avec l’assistant IA » ;   2) lecture reçue (a_verifier, résultat REVALIDÉ) : panneauLecture (ordre +
//   tableau), « Lue en … », « Incertain : … », « Saisir à la main » ;   3) échec : la raison, « Relancer », la zone de texte ;   4) à lancer : « Lire »,
//   « Ignorer », la zone de texte ;   en vol : « Lecture des pages par l’assistant… » puis une .row avec le primaire éteint et « Annuler » (R-VIS-8).
// L'appel entier est confié à lancerVol (D-C21) AVEC l'option `lecture` du lot A (ronde 1 de T6 : les gardes du vol — session, réseau, octets, image —
// passent AVANT toute écriture ; puis la ligne ouverte est reprise par la transition de départ, ou une ligne naît par repo.ouvrirImport) : le panneau
// n'écrit jamais a_lancer, page_ids, en_cours, appels, document_id_vol ni battement_at, et un « Lire » refusé n'écrit rien. Une lecture reçue est relue
// par relireDuJournal (I-1 : revalidée, forme C ; hostile → echec(illisible) conditionné à CETTE lecture, T4-R2). Dépendances injectées (D-C20) : repo,
// toast, confirmer, apresOrdre (D-C15), fetch, maintenant, battementMs, enLigne (par défaut l'état réseau que le vol lit) ; importId = la ligne désignée
// par ?import= (elle gagne). Sans séance (fiche livre) : état 1 toujours, et « Lire » dit « Sélectionne les pages d’index à lire ».
export function indexEntriesPanel(session, ctx, getSelectedPageIds, { editionId = null, importId = null, repo = repoModule, toast = toastDom, confirmer = confirmDialog, apresOrdre = null, fetch: fetchInjecte = undefined, maintenant = horloge, battementMs = BATTEMENT_MS, enLigne = estEnLigne, veilleMs = repoModule.BATTEMENT_MORT_MS + 1000 } = {}) {
  const panel = el('div', { class: 'card stack', dataset: { role: 'panneau-index' } }, el('h2', null, t('Entrées d’index ou de table des matières')));
  const edId = () => editionId || session?.edition_id || null;
  const etat = { ligne: null, resultat: null, cle: null, vue: null, saisie: false, occupe: false, lisant: false, abandon: null };
  const zoneEtat = el('div', { class: 'stack', dataset: { role: 'etat-lecture' } });
  const zoneVol = el('div', { class: 'stack', dataset: { role: 'vol' } });
  const zoneLecture = el('div', { dataset: { role: 'zone-lecture' } });
  const ta = el('textarea', { placeholder: 'Magret de canard aux cerises — 132\nSalade de fenouil, p. 58\n212 Pâtes puttanesca', rows: 8 });
  const preview = el('div', null);
  const draw = () => {
    const entries = parseIndexLines(ta.value);
    preview.replaceChildren(entries.length ? el('ul', { class: 'list plain' }, ...entries.map((e) => el('li', null, el('strong', null, e.title), e.printed_page ? el('span', { class: 'muted' }, ` — ${t('page')} ${e.printed_page}`) : el('span', { class: 'chip warn' }, t('page inconnue'))))) : null);
  };
  ta.addEventListener('input', draw);
  const createBtn = el('button', { type: 'button', class: 'btn primary', onClick: () => create() }, t('Créer les références'));
  const zoneSaisie = el('div', { class: 'stack', dataset: { role: 'zone-saisie' } },
    el('p', { class: 'muted' }, t('Une ligne par recette : titre puis numéro de page. Un titre ne suffit pas à déduire des ingrédients : ces entrées deviennent des références « Repérée dans ton livre ».')),
    ta, el('div', { class: 'row' }, createBtn), preview);
  // La passerelle (R-T3-1) : la session arrive de façon asynchrone ; la carte « Connecte-toi… » reste dans le document, cachée ou montrée (F-8).
  let provider = providerFrom(ctx.settings);
  const connexion = carteConnexion(() => demarrerConnexion(ctx.sync?.auth), ctx);
  connexion.hidden = true;
  const aiBtn = el('button', { type: 'button', class: 'btn', disabled: true, dataset: { role: 'lire-index' }, onClick: () => lire() }, t('Lire avec l’assistant IA'));
  const saisirBtn = el('button', { type: 'button', class: 'btn', hidden: true, dataset: { role: 'saisir' }, onClick: () => { etat.saisie = !etat.saisie; dessiner(); } }, t('Saisir à la main'));
  const ignorerBtn = el('button', { type: 'button', class: 'btn', hidden: true, dataset: { role: 'ignorer' }, onClick: () => ignorer() }, t('Ignorer'));
  const actions = el('div', { class: 'row', dataset: { role: 'actions-index' } }, aiBtn, saisirBtn, ignorerBtn);
  const quota = el('small', { class: 'muted', hidden: true, dataset: { role: 'quota' } }, texteQuota());
  panel.append(zoneEtat, zoneVol, zoneLecture, connexion, zoneSaisie, actions, quota);

  const lierAssistant = async () => {
    provider = providerFrom(ctx.settings, { session: await sessionAssistant(ctx) });
    connexion.hidden = provider.configured;
    dessiner();
  };
  // La ligne adoptée par le panneau : OUVERTE et d'index, ou rien ; `resultat` = sa lecture REVALIDÉE (null hors d'un a_verifier valide). Une NOUVELLE
  // lecture (cleLecture : autre ligne, autre départ, autre résultat) reconstruit panneauLecture — jamais un geste du panneau (D-C15 : « Appliquer » ne
  // change ni le départ ni le résultat, les éditions locales survivent).
  function poser(L, resultat) {
    const ouverte = importOuvert(L) && L.kind === 'index' ? L : null;
    const cle = ouverte?.status === 'a_verifier' && resultat ? cleLecture(ouverte) : null;
    if (cle !== etat.cle) {
      etat.cle = cle; etat.saisie = false;
      etat.resultat = cle ? resultat : null;
      etat.vue = etat.resultat ? panneauLecture({ ligne: ouverte, resultat: etat.resultat, session, ctx, repo, toast, apresOrdre, maintenant, editionId: edId(), surCree: async () => { refresh(); await redessiner(); }, surChangement: () => redessiner(), surSansLivre: () => toast(t('Associe d’abord un livre à cette séance')) }) : null;
    }
    etat.ligne = ouverte;
  }
  async function charger() {
    if (!session) { poser(null, null); return; }
    const L = ligneOuverteDeSeance(await repo.all('imports'), session.id, { importId: etat.ligne?.id ?? importId });
    if (L?.status !== 'a_verifier') { poser(L, null); return; }
    const relue = await relireDuJournal(L.id, 'index', { repo }); // I-1 : revalidée ; hostile → echec(illisible), conditionné à cette lecture (T4-R2)
    poser(relue?.ligne ?? null, relue?.resultat ?? null);
  }
  let file = Promise.resolve(); // les redessins sont enchaînés : jamais deux lectures concurrentes qui se dépassent
  const redessiner = () => { file = file.then(charger).then(() => dessiner()).catch((e) => logError('table_matieres.rendu', { error: e })); return file; };

  function dessiner() {
    const L = etat.ligne;
    const statut = L?.status ?? null;
    const enVol = etat.lisant || (!!L && volEnCours()?.importId === L.id);
    const lecture = !enVol && statut === 'a_verifier' && !!etat.vue;
    zoneEtat.replaceChildren(); zoneVol.replaceChildren();
    if (enVol) {
      // R-VIS-8 : la .status[role=status] puis la .row — « Annuler » se range à droite ; le primaire reste, éteint, à sa place.
      zoneVol.append(el('div', { class: 'status', role: 'status' }, t('Lecture des pages par l’assistant…')),
        el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', disabled: true }, t('Lire avec l’assistant IA')), el('button', { type: 'button', class: 'btn', dataset: { role: 'annuler' }, onClick: () => annuler() }, t('Annuler'))));
    } else if (statut === 'en_cours') zoneEtat.append(el('div', { class: 'status warn' }, t('En cours sur un autre écran'))); // I-7 du lot A : sans « Annuler »
    else if (lecture) {
      zoneEtat.append(el('p', { class: 'muted', style: { margin: 0 }, dataset: { role: 'etat' } }, ligneEtatLecture(L, etat.resultat)));
      const incertain = ligneIncertain(etat.resultat);
      if (incertain) zoneEtat.append(el('p', { class: 'muted', style: { margin: 0 }, dataset: { role: 'incertain' } }, incertain));
    } else if (statut === 'echec') {
      const { texte, code } = texteEchecIndex(L.erreur);
      zoneEtat.append(el('div', { class: 'status warn', dataset: { role: 'echec' } }, el('span', null, texte), code ? el('small', { class: 'muted' }, ` ${code}`) : null));
    }
    zoneVol.hidden = !enVol;
    if (lecture) { if (zoneLecture.firstChild !== etat.vue) zoneLecture.replaceChildren(etat.vue); } else zoneLecture.replaceChildren();
    zoneLecture.hidden = !lecture || etat.saisie;
    zoneSaisie.hidden = lecture && !etat.saisie;
    ta.disabled = enVol; createBtn.disabled = enVol || etat.occupe;
    actions.hidden = enVol;
    aiBtn.textContent = statut === 'echec' ? t('Relancer') : t('Lire avec l’assistant IA');
    aiBtn.disabled = !provider.configured || etat.occupe || enVol || statut === 'en_cours';
    saisirBtn.hidden = !lecture;
    saisirBtn.textContent = etat.saisie ? t('Revenir à la lecture') : t('Saisir à la main');
    ignorerBtn.hidden = enVol || statut !== 'a_lancer';
    quota.hidden = enVol || !['a_verifier', 'echec', 'a_lancer'].includes(statut);
    veiller();
  }
  // Ronde 1 de T4 (VF-15 du lot A, comme l'écran ciblé et l'écran web) : une ligne en_cours que CE document ne tient pas (onglet rechargé, PWA tuée) n'attend
  // plus le démarrage — la passe `interrompu` (repo.marquerInterrompus, mêmes règles, horloge du panneau) est rejouée à l'affichage, puis toutes les
  // BATTEMENT_MORT_MS + 1 s tant que la ligne vole ailleurs et que le panneau est monté ; une passe qui interrompt redessine (phrase I-4, « Relancer »).
  let veille = null;
  function veiller(maintenantAussi = true) {
    const L = etat.ligne;
    if (veille || L?.status !== 'en_cours' || etat.lisant || volEnCours()?.importId === L.id || typeof repo.marquerInterrompus !== 'function') return;
    const passe = () => { const m = Date.parse(maintenant()); return repo.marquerInterrompus(Number.isFinite(m) ? m : undefined).then((n) => (n ? redessiner() : null)).catch((e) => logError('table_matieres.interrompus', { error: e })); };
    if (maintenantAussi) passe();
    veille = setTimeout(() => { veille = null; if (panel.isConnected) passe().then(() => veiller(false)); }, veilleMs);
  }

  // « Lire » / « Relancer » (D-C16, N-2, Q3, Q4) : la ligne ouverte de la séance RELUE (« au mieux », D-C7), puis la garde des pages (P2 : sur pagesALire,
  // jamais sur la sélection seule) ; depuis une lecture reçue, la question de la relecture — posée seulement si l'appel PEUT partir (hors ligne : rien
  // n'est demandé ni écrit) ; puis lancerVol avec `lecture` : la ligne reprise par la transition de départ (a_verifier | echec | a_lancer → en_cours, ses
  // page_ids remises) ou une ligne neuve, APRÈS les gardes du vol.
  async function lire() {
    const tenu = volEnCours();
    if (tenu) { if (!tenu.importId || tenu.importId !== etat.ligne?.id) toast(t('Une lecture est déjà en cours : annule-la d’abord.')); return; } // ce vol-ci : muet
    if (etat.occupe || etat.vue?.occupe?.()) return; // ronde 1 : jamais pendant « Créer {n} références » ou « Appliquer cet ordre » de la lecture montrée
    etat.occupe = true; aiBtn.disabled = true; // le verrou du bouton (T6) : double clic → un POST
    try {
      const ligne = session ? ligneOuverteDeSeance(await repo.all('imports'), session.id, { importId: etat.ligne?.id ?? importId }) : null;
      const pages = session ? pagesALire(getSelectedPageIds(), ligne, session.page_ids, ctx.pagesById) : [];
      if (!session || !pages.length) { toast(t('Sélectionne les pages d’index à lire')); return; }
      if (ligne?.status === 'en_cours') return; // tenue par un autre document : rien à lancer (I-7) — le redessin le dit
      if (ligne?.status === 'a_verifier') {
        if (!enLigne()) { toast(t('Tu es hors ligne.')); return; }
        if (cleLecture(ligne) !== etat.cle) return; // ronde 1 (T4-R2) : une lecture que l'écran n'a pas MONTRÉE — aucune question sur elle ; le redessin la montre
        if (!(await sessionAssistant(ctx))) { await refusDe({ raison: 'non_connecte' }); return; } // ronde 1 : la question n'est posée que si l'appel PEUT partir
        const n = etat.vue && etat.ligne?.id === ligne.id ? planCreation(etat.vue.etatLecture().lignes).aCreer.length : 0;
        if (!(await confirmer(t('Relire remplace la lecture reçue ({n} entrées non créées) et coûte un appel. Continuer ?', { n }), { okLabel: t('Relire') }))) return; // « non » : rien
      }
      etat.lisant = true; etat.abandon = new AbortController();
      // `cle` (ronde 1, T4-R2) : la lecture MONTRÉE, revérifiée dans la transaction de départ ; `signal` : « Annuler » pendant les gardes (aucune ligne encore).
      const vol = lancerVol(ligne?.id ?? null, executerIndex, { ctx, repo, fetch: fetchInjecte, maintenant, battementMs, enLigne, signal: etat.abandon.signal, lecture: { kind: 'index', importId: ligne?.id ?? null, pageIds: pages, editionId: edId(), sessionId: session.id, cle: etat.cle } });
      dessiner(); // le vol est tenu dès l'appel : l'état « en vol » et « Annuler »
      const r = await vol;
      if (r.importId && r.importId !== etat.ligne?.id) etat.ligne = await repo.get('imports', r.importId); // la ligne qui a volé : c'est elle que le redessin relit
      if (r.issue === 'refuse') await refusDe(r);
    } catch (e) {
      logError('table_matieres.lire', { error: e });
    } finally {
      etat.lisant = false; etat.occupe = false; etat.abandon = null;
      await redessiner();
    }
  }
  // Un vol refusé n'a rien écrit : le dire. Les phrases sont celles du vol (texteRefus, une définition) sauf les octets absents, que C dit pour la SÉANCE.
  async function refusDe(r) {
    if (r.raison === 'non_connecte') { await lierAssistant(); return; } // la carte « Connecte-toi… » revient
    const tenu = volEnCours();
    if (r.raison === 'vol_tenu' && tenu?.importId && tenu.importId === etat.ligne?.id) return; // ce panneau tient déjà ce vol : muet
    const texte = r.raison === 'octets_absents' ? t('Les photos de cette séance ne sont pas sur cet appareil.') : texteRefus(r);
    if (texte) toast(texte); // sans_page, inconnu, transition : un autre onglet a tranché — le redessin suffit
  }
  // « Annuler » (§ 4.2) : la ligne en vol (annulerVol : fetch abandonné, echec(annule)) ; pendant les gardes, la tenue n'a pas encore de ligne — le
  // signal du panneau l'abandonne : rien ne part, rien n'est écrit (ronde 1 de T4, constats 4 et 6). Vague finale (constat 1) : seulement le vol de CE
  // panneau ou de SA ligne ; sans vol à annuler (fini entre-temps), le panneau relit et montre l'état réel — jamais un bouton sans effet.
  async function annuler() {
    const id = volEnCours()?.importId;
    if (id && (etat.lisant || id === etat.ligne?.id)) await annulerVol(id); else if (etat.lisant) etat.abandon?.abort();
    await redessiner();
  }
  // « Ignorer » (état 4) : la ligne a_lancer MONTRÉE (T4-R2 : sa clé revérifiée dans la transaction), finished_at posé.
  async function ignorer() {
    const L = etat.ligne; if (!L || etat.occupe) return;
    etat.occupe = true;
    const cle = cleLecture(L);
    const patch = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return { status: 'ignore', finished_at: maintenant() }; };
    try { await repo.transitionner('imports', L.id, { attendus: ['a_lancer'], patch }); }
    catch (e) { if (!(e instanceof TransitionRefusee)) logError('table_matieres.ignorer', { error: e, id: L.id }); }
    finally { etat.occupe = false; }
    await redessiner();
  }
  async function create() {
    if (etat.occupe) return;
    etat.occupe = true;
    try {
      const L = etat.ligne;
      const r = await creerDepuisSaisie(ta.value, { session, ctx, editionId: edId(), pageIds: getSelectedPageIds(), repo, toast, maintenant, importId: L?.id ?? null, cle: L ? cleLecture(L) : null });
      if (r.issue === 'cree') { ta.value = ''; draw(); refresh(); }
    } catch (e) { logError('table_matieres.saisie', { error: e }); }
    finally { etat.occupe = false; }
    await redessiner();
  }

  const L0 = session ? ligneOuverteDeSeance(ctx.imports, session.id, { importId }) : null;
  poser(L0, L0?.status === 'a_verifier' ? revaliderResultatIndex(L0.resultat, L0.page_ids) : null); // synchrone : aucun flash de l'état 1
  dessiner();
  lierAssistant();
  if (session) redessiner();
  // Vague finale (constat 1) : le panneau suit le vol de CE document (ecouterVol) tant qu'il est monté — une instance recréée pendant le vol de sa ligne
  // (retour arrière, « + Photographier », « Retirer », livre changé), ou ouverte pendant un vol lancé hors d'elle, se redessine à la pose et à la fin du
  // vol, sans geste. Comme la phrase de séance (lot G) : un panneau jamais monté se désabonne au tour suivant, un panneau monté puis quitté au premier
  // avis qui le trouve détaché.
  if (session) {
    let vu = false;
    const desabonner = ecouterVol(() => { if (!panel.isConnected) { if (vu) desabonner(); return; } redessiner(); });
    setTimeout(() => { vu = true; if (!panel.isConnected) desabonner(); }, 0);
  }
  panel.etatPanneau = () => ({ importId: etat.ligne?.id ?? null, status: etat.ligne?.status ?? null, saisie: etat.saisie, vol: etat.lisant || (!!etat.ligne && volEnCours()?.importId === etat.ligne.id) });
  return panel;
}

const horloge = () => new Date().toISOString();
const STATUTS_FERMABLES = ['a_verifier', 'echec', 'a_lancer']; // D-C19 : en_cours n'est jamais fermé par la zone de texte

// « Créer les références » depuis la zone de texte (spec C § 4.4, D-C19 ; sans DOM, testable seule) : une ligne tapée = une référence ; titre et
// raw_entry nettoyés (Cc, Cf, Cs, comme fabriquerReferences — ronde 1 : un titre vide une fois nettoyé ne fait pas de fiche) et bornés (données de la
// personne : troncature acceptable, S-10) ; index_page_id null, section null, index_uncertain faux ; source_page_ids = les pages cochées PRÉSENTES, RELUES en
// base (ronde 1 : l'instantané du rendu peut dater de tout le temps où la route de saisie reste ouverte) ; une page cochée n'est réécrite que si son kind est
// nul (kind 'index' ; M63), sur sa fiche RELUE dans la transaction (condition de fusion) — absente alors qu'une fiche la cite : refus (I-C11). La ligne
// d'index que le panneau MONTRE (`importId`, sa clé `cle` = cleLecture : T4-R2 du lot A) est fermée dans la MÊME transaction que les fiches (a_verifier →
// enregistre : la lecture a servi ; echec | a_lancer → ignore), finished_at posé, la clé revérifiée DANS la transaction. Refusée (close, ignorée ou relue
// ailleurs entre-temps, ou une page citée retirée) : RIEN n'est écrit et c'est dit (décision 4 de la ronde 1 de T6 ; l'appelant se détache de la ligne).
// Sans clé, ou la ligne relue porte une autre lecture : les fiches par saveBatch, la ligne reste à reprendre. Sans ligne (fiche livre, séance sans lecture) :
// le chemin d'avant. Ronde de clôture (R-C-24, T2-R1) : les doublons sont lus dans les références de l'édition RELUES en base (repo.byIndex, comme
// creerReferences), jamais dans l'instantané ctx.recipes du rendu — une référence créée par un autre onglet entre-temps n'est pas dupliquée.
export async function creerDepuisSaisie(texte, { session = null, ctx, editionId = null, pageIds = [], repo = repoModule, toast = toastDom, maintenant = horloge, importId = null, cle = null } = {}) {
  const edId = editionId || session?.edition_id || null;
  if (!edId) { toast(t('Associe d’abord un livre à cette séance')); return { issue: 'sans_livre' }; }
  const entries = parseIndexLines(texte);
  if (!entries.length) return { issue: 'vide' };
  const edition = ctx.editionsById.get(edId);
  const seen = new Set((await repo.byIndex('recipes', 'edition_id', edId)).filter(Boolean).map((r) => cleReference(r.original_title, r.printed_page)));
  const presentes = [];
  for (const id of new Set(Array.isArray(pageIds) ? pageIds : [])) if (typeof id === 'string' && await repo.get('source_pages', id)) presentes.push(id);
  const created = [];
  let dupes = 0;
  for (const e of entries) {
    const titre = borner(uneLigne(e.title) ?? '', 200); // vague finale (constat 2) : une ligne (une fin de ligne collée vaut une espace), comme fabriquerReferences
    if (!titre) continue; // fait seulement d'invisibles (collé d'un PDF) : pas de fiche, comme fabriquerReferences
    const k = cleReference(titre, e.printed_page);
    if (seen.has(k)) { dupes++; continue; }
    seen.add(k);
    const fiche = { id: repo.newId('rc'), edition_id: edId, original_title: titre, original_language: edition?.language || null, availability: 'reference_only', verification_state: 'unverified', printed_page: e.printed_page, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: presentes, current_version_id: null, ingredient_ids: [], index_page_id: null, raw_entry: borner(uneLigne(e.raw) ?? '', BORNE_RAW_ENTRY), index_uncertain: false };
    assertVocabulaire(fiche, 'recipes'); // D-12 : « Créer les références » est un fabricant de recipes comme les autres (spec import-cible § 3.3)
    created.push(fiche);
  }
  const puts = created.length ? { recipes: created } : {};
  const pages = presentes.map((id) => ({ key: id, fusion: (courant) => {
    if (!courant) { if (created.length) throw new TransitionRefusee('source_pages', id, null); return null; } // I-C11 : jamais une fiche vers une page absente
    return courant.kind == null ? { ...courant, kind: 'index' } : null; // M63 : un kind posé (recette…) est gardé, la page n'est pas réécrite
  } }));
  const ligne = importId && cle ? await repo.get('imports', importId) : null;
  let ferme = false;
  try {
    // Vague finale (constat 8, la garde de creerReferences) : la ligne n'est fermée que si au moins une fiche est créée — jamais une lecture payée close
    // sur zéro référence (toutes les lignes tapées en double ou vides) ; sinon les pages seules, et la lecture reste à reprendre.
    if (created.length && ligne?.kind === 'index' && STATUTS_FERMABLES.includes(ligne.status) && cleLecture(ligne) === cle) {
      const vers = ligne.status === 'a_verifier' ? 'enregistre' : 'ignore';
      const fin = maintenant();
      const fermer = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', ligne.id, c.status); return { status: vers, reponse_brute: null, finished_at: fin }; };
      await repo.transitionner('imports', ligne.id, { attendus: [ligne.status], patch: fermer, puts, conditions: pages.length ? { source_pages: pages } : {} });
      ferme = true;
    } else if (created.length || pages.length) await repo.saveBatch(puts, { conditions: pages.length ? { source_pages: pages } : null });
  } catch (e) {
    if (!(e instanceof TransitionRefusee)) throw e;
    toast(t('Les références n’ont pas pu être créées. Réessaie.'));
    return { issue: 'refuse' };
  }
  toast(t('{n} référence(s) créée(s){d}', { n: created.length, d: dupes ? `, ${t('{n} doublon(s) ignoré(s)', { n: dupes })}` : '' }));
  return { issue: 'cree', n: created.length, doublons: dupes, ferme };
}

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
