// Séance de scan continue (spec §16) : photos et fichiers conservés sur l'appareil, miniatures numérotées, regroupement,
// remplacement d'une page, entrées d'index, états fondés sur des événements réels. Aucune page n'est annoncée « sur le serveur ».
import { el, toast, pickFiles, confirmDialog, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh, remplacerAdresse, parseHash } from '../core/router.js';
import { logError } from '../core/log.js';
import { TransitionRefusee } from '../core/db.js';
import * as repo from '../model/repo.js';
import { displayUrl } from '../sync/mime.js';
import { sha256Hex } from '../core/hash.js';
import { normalizeText } from '../domain/units.js';
import { assertVocabulaire } from '../domain/vocabulaire.js';
import { providerFrom } from '../domain/llm.js';
import { seanceDUnImportCible, importOuvert } from '../domain/import-cible.js';
import { pageHeader, section, emptyState, select, field, carteConnexion, texteEchecAssistant, pdfFrame, libelleLivre, sessionAssistant } from './components.js';
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

function sessionView(session, ctx, query = {}, { historique = { remplacer: remplacerAdresse } } = {}) {
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

  // États fondés sur des événements réels : ce qui est effectivement écrit dans la base locale.
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('span', { class: 'status ok' }, t('{n} page(s) conservée(s) sur cet appareil', { n: pages.length })),
    fileDocs.length ? el('span', { class: 'status info' }, t('{n} fichier(s) PDF/EPUB', { n: fileDocs.length })) : null,
    el('span', { class: 'status info' }, t('Aucune synchronisation serveur configurée : sauvegarde via Réglages'))));

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
  for (const p of pages) {
    const img = el('img', { alt: `${t('Page')} ${p.position}`, loading: 'lazy' });
    repo.getFile(p.sha256).then((f) => { const u = displayUrl(f); if (u) img.src = u; });
    const check = el('input', { type: 'checkbox', checked: selected.has(p.id), onChange: (e) => { if (e.target.checked) selected.add(p.id); else selected.delete(p.id); drawActions(); } });
    const pageInput = el('input', { type: 'number', placeholder: t('p. imprimée'), value: p.printed_page ?? '', style: { minHeight: '30px', padding: '.2rem .4rem', fontSize: '.8rem' }, onChange: async (e) => { p.printed_page = e.target.value ? parseInt(e.target.value, 10) : null; await repo.save('source_pages', p); } });
    thumbs.append(el('figure', null, el('span', { class: 'num' }, String(p.position)), img,
      el('figcaption', null, el('label', { class: 'check' }, check, p.kind ? t(p.kind === 'index' ? 'Index' : 'Recette') : t('Sélectionner')), pageInput,
        ...(p.issues || []).map((i) => el('div', { class: 'chip warn' }, i)))));
  }
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
        box.append(pdfFrame({ sha256: d.sha256, filename: d.original_filename }));
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
  return root;
}

// Panneau d'entrées d'index : « Titre — 132 » par ligne ; création de références (reference_only) sans inventer d'ingrédients.
// Tâche 6 (spec § 4.6) : « Lire avec l'assistant IA » écrit dans le journal (kind index) et relit sa ligne ; le bouton est verrouillé pendant
// l'appel (double clic → un POST) ; `importId` (?import=) reprend une lecture déjà reçue, sans appel ; « Créer les références » la clôt.
export function indexEntriesPanel(session, ctx, getSelectedPageIds, { editionId = null, importId = null } = {}) {
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
      const r = await lireDansLeJournal({ kind: 'index', importId: importCourant, pageIds: ids, editionId: editionId || session?.edition_id || null, sessionId: session?.id ?? null, ctx });
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
  if (importId) relireDuJournal(importId, 'index').then((relue) => {
    if (!relue) { importCourant = null; return; }
    if (relue.resultat) { remplir(relue.resultat); cleZone = cleLecture(relue.ligne); }
    else if (relue.ligne?.status === 'echec') status.textContent = phraseEchec(relue.ligne.erreur);
  }).catch((e) => logError('import.index_relu', { error: e }));
  const create = async () => {
    const edId = editionId || session?.edition_id;
    if (!edId) { toast(t('Associe d’abord un livre à cette séance')); return; }
    const entries = parse();
    if (!entries.length) return;
    const edition = ctx.editionsById.get(edId);
    const existing = ctx.recipes.filter((r) => r.edition_id === edId);
    const key = (title, page) => `${normalizeText(title)}|${page ?? ''}`;
    const seen = new Set(existing.map((r) => key(r.original_title, r.printed_page)));
    const pageIds = getSelectedPageIds().filter((id) => ctx.pagesById.get(id));
    const created = [];
    let dupes = 0;
    for (const e of entries) {
      const k = key(e.title, e.printed_page);
      if (seen.has(k)) { dupes++; continue; }
      seen.add(k);
      const fiche = { id: repo.newId('rc'), edition_id: edId, original_title: e.title, original_language: edition?.language || null, availability: 'reference_only', verification_state: 'unverified', printed_page: e.printed_page, section: e.section || null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: pageIds, current_version_id: null, ingredient_ids: [] };
      assertVocabulaire(fiche, 'recipes'); // D-12 : « Créer les références » est un fabricant de recipes comme les autres (spec import-cible § 3.3)
      created.push(fiche);
    }
    const pagesIndex = pageIds.map((id) => ({ ...ctx.pagesById.get(id), kind: 'index' }));
    // Tâche 6 : la lecture du journal POSÉE DANS LA ZONE (a_verifier, sa clé) est CLOSE avec ce qu'elle a produit — références et pages d'index —, dans UNE
    // transaction conditionnée (I-10) à cette même lecture (T4-R2, ronde 1 : une lecture plus récente, arrivée d'un autre onglet, n'est jamais close sans
    // avoir été vue ; les références de la zone s'écrivent alors sans elle). Refusée (close ou ignorée entre-temps) : rien n'est écrit ; le panneau se
    // détache de la ligne, et « Créer les références » écrira à nouveau sans elle.
    const ouverte = importCourant && cleZone ? await repo.get('imports', importCourant) : null;
    if (ouverte?.status === 'a_verifier' && ouverte.kind === 'index' && cleLecture(ouverte) === cleZone) {
      const cle = cleZone;
      const cloture = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', ouverte.id, c.status); return { status: 'enregistre', reponse_brute: null, finished_at: repo.nowIso() }; };
      try {
        await repo.transitionner('imports', ouverte.id, { attendus: ['a_verifier'], patch: cloture, puts: { ...(pagesIndex.length ? { source_pages: pagesIndex } : {}), ...(created.length ? { recipes: created } : {}) } });
      } catch (e) {
        if (!(e instanceof TransitionRefusee)) throw e;
        importCourant = null; cleZone = null;
        toast(t('Les références n’ont pas pu être créées. Réessaie.'));
        return;
      }
      importCourant = null; cleZone = null;
    } else {
      if (pagesIndex.length) await repo.saveBatch({ source_pages: pagesIndex });
      if (created.length) await repo.saveBatch({ recipes: created });
    }
    toast(t('{n} référence(s) créée(s){d}', { n: created.length, d: dupes ? `, ${t('{n} doublon(s) ignoré(s)', { n: dupes })}` : '' }));
    ta.value = ''; draw(); refresh();
  };
  panel.append(el('p', { class: 'muted' }, t('Une ligne par recette : titre puis numéro de page. Un titre ne suffit pas à déduire des ingrédients : ces entrées deviennent des références « Repérée dans ton livre ».')),
    connexion, ta, el('div', { class: 'row' }, aiBtn, el('button', { class: 'btn primary', onClick: create }, t('Créer les références'))), status, preview);
  return panel;
}

export function parseIndexLines(text) {
  const out = [];
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m = /^(.*?)\s*(?:[—–-]|,|\.{2,}|\s+p\.?|\s+page)\s*p?\.?\s*(\d{1,4})\s*$/i.exec(line);
    if (m && m[1].trim()) { out.push({ title: m[1].trim().replace(/[,.]+$/, ''), printed_page: parseInt(m[2], 10) }); continue; }
    m = /^(\d{1,4})\s+(.+)$/.exec(line);
    if (m) { out.push({ title: m[2].trim(), printed_page: parseInt(m[1], 10) }); continue; }
    out.push({ title: line, printed_page: null });
  }
  return out;
}
