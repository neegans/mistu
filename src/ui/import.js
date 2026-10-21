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
import { providerFrom, nettoyer } from '../domain/llm.js';
import { seanceDUnImportCible, importOuvert } from '../domain/import-cible.js';
import { cleReference, BORNE_RAW_ENTRY } from '../domain/table-matieres.js';
import { pageHeader, section, emptyState, select, field, carteConnexion, texteEchecAssistant, pdfFrame, libelleLivre, sessionAssistant, contexteFichiers, vignettesDePages, boutonTelechargerPages, gesteTelechargement } from './components.js';
import { demarrerConnexion } from './settings.js';
import { lireDansLeJournal, relireDuJournal, phraseEchec, cleLecture } from './import-cible.js';

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

// Les lectures SANS référence du panneau d'index passent par le journal : lireDansLeJournal, relireDuJournal et phraseEchec vivent à côté du vol, dans
// src/ui/import-cible.js (tâche 6, ronde 1 : l'éditeur ne dépend plus de ce module de route pour son journal).

export async function renderImport(params, query, ctx) {
  if (!query.session) return sessionsList(ctx);
  const session = ctx.scan_sessions.find((s) => s.id === query.session);
  if (!session) return el('div', { class: 'card' }, t('Séance introuvable.'));
  return sessionView(session, ctx, query);
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

async function sessionView(session, ctx, query = {}, { historique = { remplacer: remplacerAdresse } } = {}) {
  const ctxF = await contexteFichiers(ctx);
  const pages = session.page_ids.map((id) => ctx.pagesById.get(id)).filter(Boolean);
  const docs = session.document_ids.map((id) => ctx.source_documents.find((d) => d.id === id)).filter(Boolean);
  const fileDocs = docs.filter((d) => d.source_type !== 'photo');
  // L'intention (spec § 10, F6) voyage dans l'adresse : présélection des pages, panneau d'index ouvert ou non.
  // C6 : la présélection porte sur les pages RÉSOLUES — `session.page_ids` peut nommer une page que cette base n'a
  // pas (fiche reçue d'ailleurs, page retirée depuis). Cocher un identifiant sans page créait une sélection qui ne
  // correspondait à aucune miniature, et « Regrouper en recette » l'emportait dans son adresse.
  const applique = appliquerIntention({ intention: query.intention, pageIds: pages.map((p) => p.id) });
  // ?import=<imp> (spec § 4.5, tâche 6) : la lecture d'index de CETTE séance se reprend dans le panneau — ouvert, prérempli, ses pages cochées.
  // Ronde 1 : seulement une lecture OUVERTE (une lecture close par « Créer les références » ne rouvre pas le panneau au refresh qui suit).
  const ligneImport = query.import ? (ctx.imports || []).find((i) => importOuvert(i) && i.id === query.import && i.kind === 'index' && i.scan_session_id === session.id) || null : null;
  const selected = new Set(ligneImport ? (Array.isArray(ligneImport.page_ids) ? ligneImport.page_ids : []).filter((id) => pages.some((p) => p.id === id)) : applique.selection);
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
      actions.append(
        el('a', { class: 'btn primary', href: `#/recipes/new${buildQuery({ pages: ids, edition: session.edition_id || '', session: session.id })}` }, t('Regrouper en recette')),
        el('button', { class: 'btn', onClick: () => { indexPanel.hidden = false; indexPanel.scrollIntoView({ behavior: 'smooth' }); } }, t('Index / table des matières')),
        n === 1 ? el('button', { class: 'btn', onClick: () => replacePage([...selected][0]) }, t('Remplacer cette page')) : null,
        el('button', { class: 'btn danger', onClick: () => removePages([...selected]) }, t('Retirer')));
    }
  };
  // Lot G (§ 4.3) : chaque miniature par vignettePage (image, ou l'état et son geste) ; « Télécharger les {n} pages » au-dessus, à partir de deux.
  const vignettes = await vignettesDePages(pages, ctxF, { alt: (p) => `${t('Page')} ${p.position}` });
  for (const p of pages) {
    const check = el('input', { type: 'checkbox', checked: selected.has(p.id), onChange: (e) => { if (e.target.checked) selected.add(p.id); else selected.delete(p.id); drawActions(); } });
    const pageInput = el('input', { type: 'number', placeholder: t('p. imprimée'), value: p.printed_page ?? '', style: { minHeight: '30px', padding: '.2rem .4rem', fontSize: '.8rem' }, onChange: async (e) => { p.printed_page = e.target.value ? parseInt(e.target.value, 10) : null; await repo.save('source_pages', p); } });
    thumbs.append(el('figure', null, el('span', { class: 'num' }, String(p.position)), vignettes.places.get(p.id),
      el('figcaption', null, el('label', { class: 'check' }, check, p.kind ? t(p.kind === 'index' ? 'Index' : 'Recette') : t('Sélectionner')), pageInput,
        ...(p.issues || []).map((i) => el('div', { class: 'chip warn' }, i)))));
  }
  const groupe = boutonTelechargerPages(vignettes.distantes, { connecte: ctxF.connecte, telecharger: vignettes.telecharger });
  if (groupe) root.append(groupe); // jamais root.append(null) : le DOM natif écrirait le nœud texte « null »
  root.append(thumbs, actions);
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

  // Entrées d'index
  const indexPanel = indexEntriesPanel(session, ctx, () => [...selected], { importId: ligneImport?.id ?? null });
  indexPanel.hidden = !ligneImport;
  root.append(indexPanel);
  if (applique.consommee) {
    if (applique.ouvrirIndex) indexPanel.hidden = false;
    // consommée : un refresh() ne la réappliquera pas — mais seulement si l'adresse est encore celle-ci (C7).
    if (peutRetirerIntention(applique, session.id, parseHash().query)) historique.remplacer(adresseSeance(session.id, null));
  }

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

// Panneau d'entrées d'index : « Titre — 132 » par ligne ; création de références (reference_only) sans inventer d'ingrédients.
// Tâche 6 (spec § 4.6) : « Lire avec l'assistant IA » écrit dans le journal (kind index) et relit sa ligne ; le bouton est verrouillé pendant
// l'appel (double clic → un POST) ; `importId` (?import=) reprend une lecture déjà reçue, sans appel ; « Créer les références » la clôt.
export function indexEntriesPanel(session, ctx, getSelectedPageIds, { editionId = null, importId = null, repo = repoModule, toast = toastDom, maintenant = horloge } = {}) {
  const panel = el('div', { class: 'card stack' }, el('h2', null, t('Entrées d’index ou de table des matières')));
  const ta = el('textarea', { placeholder: 'Magret de canard aux cerises — 132\nSalade de fenouil, p. 58\n212 Pâtes puttanesca', rows: 8 });
  const preview = el('div', null);
  const status = el('div', { class: 'muted' });
  // La passerelle (R-T3-1) : la session arrive de façon asynchrone — le bouton reste éteint jusqu'à sa lecture, et elle est relue au
  // clic (un jeton expiré se rafraîchit). `indexEntriesPanel` reste synchrone : c'est le fournisseur qui se met à jour. La phrase
  // « Connecte-toi… » attend la même lecture (cachée au départ : une personne connectée ne la voit jamais en flash) ; avec une
  // session elle est retirée, sans session elle se montre (R-T4-4).
  let provider = providerFrom(ctx.settings);
  const connexion = carteConnexion(() => demarrerConnexion(ctx.sync?.auth), ctx);
  connexion.hidden = true;
  // F-8 : la carte reste dans le document, cachée ou montrée — jamais retirée (un `hidden = false` sur un nœud détaché ne montre rien : la
  // session disparue au clic laissait un bouton éteint et aucune explication) ; le bouton suit la session dans les deux sens.
  const lierAssistant = async () => {
    provider = providerFrom(ctx.settings, { session: await sessionAssistant(ctx) });
    aiBtn.disabled = !provider.configured;
    connexion.hidden = provider.configured;
  };
  const parse = () => parseIndexLines(ta.value);
  const draw = () => {
    const entries = parse();
    preview.replaceChildren(entries.length ? el('ul', { class: 'list plain' }, ...entries.map((e) => el('li', null, el('strong', null, e.title), e.printed_page ? el('span', { class: 'muted' }, ` — ${t('page')} ${e.printed_page}`) : el('span', { class: 'chip warn' }, t('page inconnue'))))) : null);
  };
  ta.addEventListener('input', draw);
  // La lecture (revalidée) posée dans la zone : toujours du texte (valeur d'un textarea, textContent), jamais du balisage.
  const remplir = (res) => {
    ta.value = res.entries.map((e) => `${e.title} — ${e.printed_page ?? ''}`).join('\n');
    status.textContent = t('{n} entrée(s) proposée(s) par l’assistant — vérifie avant de créer.', { n: res.entries.length }) + (res.uncertain.length ? ` ${t('Incertain')} : ${res.uncertain.join('; ')}` : '');
    draw();
  };
  let importCourant = importId; // la ligne du journal de ce panneau : reprise par ?import=, ouverte au premier clic, close par « Créer les références »
  let cleZone = null; // la clé (cleLecture) de LA lecture posée dans la zone : « Créer les références » ne clôt qu'elle (T4-R2, ronde 1)
  let occupe = false;
  const aiBtn = el('button', { class: 'btn', disabled: true, onClick: async () => {
    if (occupe) return;
    const ids = getSelectedPageIds();
    if (!ids.length) { toast(t('Sélectionne les pages d’index à lire')); return; }
    occupe = true; aiBtn.disabled = true; // verrou AVANT tout await : un double clic ne fait qu'un POST
    status.textContent = t('Lecture des pages par l’assistant…');
    let connecte = true;
    try {
      const r = await lireDansLeJournal({ kind: 'index', importId: importCourant, pageIds: ids, editionId: editionId || session?.edition_id || null, sessionId: session?.id ?? null, ctx, repo });
      importCourant = r.importId; connecte = r.connecte;
      if (r.resultat) { remplir(r.resultat); cleZone = r.cle; } else status.textContent = r.texte;
    } catch (e) { logError('import.index_lecture', { error: e }); status.textContent = texteEchecAssistant(e); }
    finally {
      occupe = false;
      if (!connecte) { provider = providerFrom(ctx.settings); connexion.hidden = false; } // la session a disparu au clic (F-8) : la carte, le bouton éteint
      aiBtn.disabled = !provider.configured;
    }
  } }, t('Lire avec l’assistant IA'));
  lierAssistant();
  // ?import= : la lecture déjà reçue est relue et REVALIDÉE (I-1), puis posée dans la zone — aucun appel ; une ligne en échec dit sa raison.
  if (importId) relireDuJournal(importId, 'index', { repo }).then((relue) => {
    if (!relue) { importCourant = null; return; }
    if (relue.resultat) { remplir(relue.resultat); cleZone = cleLecture(relue.ligne); }
    else if (relue.ligne?.status === 'echec') status.textContent = phraseEchec(relue.ligne.erreur);
  }).catch((e) => logError('import.index_relu', { error: e }));
  // Ronde 1 de la tâche 2 : un verrou, comme `occupe` pour « Lire » — une double tape ne crée qu'une fois (les doublons se lisent dans l'instantané du rendu :
  // deux appels en vol écriraient chaque fiche deux fois).
  let creation = false;
  const create = async () => {
    if (creation) return;
    creation = true;
    try {
      // Lot C, tâche 2 : creerDepuisSaisie (raw_entry, bornes, kind gardé) ; la lecture POSÉE DANS LA ZONE (importCourant, sa clé cleZone) est close dans la
      // transaction des fiches ; refusée, rien n'est écrit et le panneau se détache de la ligne (décision 4 de la ronde 1 de T6) — un second clic écrit sans elle.
      const r = await creerDepuisSaisie(ta.value, { session, ctx, editionId, pageIds: getSelectedPageIds(), repo, toast, maintenant, importId: importCourant, cle: cleZone });
      if (r.issue === 'refuse' || r.ferme) { importCourant = null; cleZone = null; }
      if (r.issue === 'cree') { ta.value = ''; draw(); refresh(); }
    } finally { creation = false; }
  };
  panel.append(el('p', { class: 'muted' }, t('Une ligne par recette : titre puis numéro de page. Un titre ne suffit pas à déduire des ingrédients : ces entrées deviennent des références « Repérée dans ton livre ».')),
    connexion, ta, el('div', { class: 'row' }, aiBtn, el('button', { class: 'btn primary', onClick: create }, t('Créer les références'))), status, preview);
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
// le chemin d'avant.
export async function creerDepuisSaisie(texte, { session = null, ctx, editionId = null, pageIds = [], repo = repoModule, toast = toastDom, maintenant = horloge, importId = null, cle = null } = {}) {
  const edId = editionId || session?.edition_id || null;
  if (!edId) { toast(t('Associe d’abord un livre à cette séance')); return { issue: 'sans_livre' }; }
  const entries = parseIndexLines(texte);
  if (!entries.length) return { issue: 'vide' };
  const edition = ctx.editionsById.get(edId);
  const seen = new Set(ctx.recipes.filter((r) => r.edition_id === edId).map((r) => cleReference(r.original_title, r.printed_page)));
  const presentes = [];
  for (const id of new Set(Array.isArray(pageIds) ? pageIds : [])) if (typeof id === 'string' && await repo.get('source_pages', id)) presentes.push(id);
  const created = [];
  let dupes = 0;
  for (const e of entries) {
    const titre = borner(nettoyer(e.title) ?? '', 200);
    if (!titre) continue; // fait seulement d'invisibles (collé d'un PDF) : pas de fiche, comme fabriquerReferences
    const k = cleReference(titre, e.printed_page);
    if (seen.has(k)) { dupes++; continue; }
    seen.add(k);
    const fiche = { id: repo.newId('rc'), edition_id: edId, original_title: titre, original_language: edition?.language || null, availability: 'reference_only', verification_state: 'unverified', printed_page: e.printed_page, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: presentes, current_version_id: null, ingredient_ids: [], index_page_id: null, raw_entry: borner(nettoyer(e.raw) ?? '', BORNE_RAW_ENTRY), index_uncertain: false };
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
    if (ligne?.kind === 'index' && STATUTS_FERMABLES.includes(ligne.status) && cleLecture(ligne) === cle) {
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

export function parseIndexLines(text) {
  const out = [];
  for (const raw of (text || '').split(/\r?\n/)) {
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
