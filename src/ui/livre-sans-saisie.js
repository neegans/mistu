// I2 : parcours réel d'identification. Les anciens imports couverture gardent leur lecteur de journal.
import { el, toast, pickFiles, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, remplacerAdresse } from '../core/router.js';
import * as depot from '../model/repo.js';
import { validerIsbn, codeBarresVersIsbn } from '../core/isbn.js';
import { reduireImage } from '../core/image.js';
import { sha256Hex } from '../core/hash.js';
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';
import { typeAffichage, displayUrl } from '../sync/mime.js';
import { GOOGLE_BOOKS } from '../sync/config.js';
import { pageHeader, field, sessionAssistant, carteConnexion, select } from './components.js';
import { demarrerConnexion } from './settings.js';
import { prendreVol, libererVol, volEnCours, volTenu, DOCUMENT_ID, BATTEMENT_MS } from './vol.js';
import { renderLivreAjoutRoute, poserCouverture, recupererCouvertureParIsbn, messageErreurImage } from './livre-ajout.js';
import { texteEchec } from './import-cible.js';
import { PasserelleProvider, extraireIndicesLivre, validerIndicesLivre, blobToBase64 } from '../domain/llm.js';
import { listConventions } from '../domain/units.js';
import { brouillonLivre, modifierChampLivre, appliquerCandidateLivre, candidateDepuisPhoto, chercherCatalogueLivre, rechercherLivreWeb, relireRechercheLivre, cleCandidateLivre, sourceLivre, listeLivre, shaLivre } from '../domain/livre-bibliographie.js';
import { fabriquerImportLivre, garderBrouillonLivre, trouverEditionsLivre, enregistrerLivreI2, brouillonDepuisEdition, ConflitLivre } from '../domain/livre-parcours.js';

export function afficherProvenanceLivre(p) {
  if (p?.origin === 'manual') return t('Modifié par moi');
  if (p?.origin === 'photo') return t('Lu sur la photo');
  if (p?.origin === 'suggestion') return t('Suggestion de classement');
  const source = sourceLivre(p?.sources?.[0]);
  if (p?.origin === 'catalogue') return t('Proposé par {catalogue}', { catalogue: source?.hote || t('Catalogue') });
  if (p?.origin === 'web') return t('Trouvé sur Internet · {hote}', { hote: source?.hote || '' });
  return '';
}
export function sourcesLivre(provenance = {}) {
  const sources = new Map();
  for (const p of Object.values(provenance && typeof provenance === 'object' ? provenance : {})) for (const raw of Array.isArray(p?.sources) ? p.sources : []) {
    const s = sourceLivre(raw); if (s && sources.size < 10) sources.set(s.href, { ...s, date: typeof p.retrieved_at === 'string' ? p.retrieved_at.slice(0, 10) : '' });
  }
  return [...sources.values()];
}
export function renderSourcesLivre(provenance) {
  return el('div', { class: 'stack', dataset: { role: 'sources-livre' } }, ...sourcesLivre(provenance).map((s) => el('div', null,
    el('a', { href: s.href, target: '_blank', rel: 'noopener noreferrer' }, s.hote), s.date ? ` · ${s.date}` : '')));
}
export async function annulerIdentificationLivre(id) {
  const tenue = volTenu(id); if (!tenue) return false;
  tenue.controller.abort(); return true;
}
const RAISONS_LIVRE = ['annule', 'coupe', 'illisible', 'hors_bornes', 'vide', 'quota', 'non_connecte', 'non_admis', 'hors_ligne', 'interrompu', 'refus', 'pas_cherche', 'outil', 'reponse_illisible', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau'];
export function texteEchecLivre(erreur) {
  if (erreur?.raison === 'pas_cherche') return t('Aucune recherche Internet effective. Aucun résultat n’a été appliqué.');
  if (erreur?.raison === 'refus') return t('L’assistant a refusé cette recherche. Ton brouillon est conservé.');
  if (erreur?.raison === 'outil') return t('La recherche Internet a échoué. Ton brouillon est conservé.');
  if (erreur?.raison === 'vide') return t('Aucun indice de livre lisible sur cette photo.');
  return texteEchec(erreur).texte;
}

export async function renderLivreSansSaisieRoute(params, query = {}, ctx = {}, deps = {}) {
  const repo = deps.repo || depot; const nav = deps.navigate || navigate; const dire = deps.toast || toast;
  const fetch = deps.fetch || globalThis.fetch; const choisir = deps.pickFiles || pickFiles;
  const maintenant = deps.maintenant || (() => new Date().toISOString()); const enLigne = deps.enLigne || (() => navigator.onLine !== false);
  const sessionDe = deps.sessionAssistant || (() => sessionAssistant(ctx));
  const cleGoogle = deps.cle ?? GOOGLE_BOOKS.key;
  let row = typeof query.import === 'string' ? await repo.get('imports', query.import) : null;
  if (row?.kind === 'couverture') return renderLivreAjoutRoute(params, query, ctx, deps);
  if (query.import && (!row || row.kind !== 'livre')) return el('div', { class: 'status warn' }, t('Import introuvable.'));
  if (row && ['enregistre', 'ignore'].includes(row.status)) return el('div', { class: 'stack' }, el('p', null, t('Cet import est terminé.')),
    row.edition_id ? el('a', { class: 'btn', href: `#/books/${encodeURIComponent(row.edition_id)}` }, t('Ouvrir le livre')) : null);
  let draft = brouillonLivre(row?.brouillon); let initial = row?.initial ? brouillonLivre(row.initial) : null;
  if (!row && typeof query.edition === 'string') {
    const edition = await repo.get('book_editions', query.edition); const book = edition ? await repo.get('books', edition.book_id) : null;
    if (!book || !edition) return el('p', null, t('Livre introuvable.'));
    draft = brouillonDepuisEdition(book, edition); initial = brouillonLivre(draft);
  }
  let importId = row?.id || null, creation = null, queue = Promise.resolve(), busy = false, preparing = false, saving = false, generation = 0, controller = null;
  let mounted = false, everConnected = false, closed = false, previewUrl = null;
  const ownId = ctx.sync?.user?.id || null;
  const root = el('div', { class: 'stack', dataset: { role: 'livre-i2' } });
  root.append(pageHeader(draft.edition_id ? t('Compléter les informations') : t('Ajouter un livre'), { back: { href: draft.edition_id ? `/books/${encodeURIComponent(draft.edition_id)}` : '/add', label: draft.edition_id ? t('Livre') : t('Ajouter') } }));
  const status = el('div', { class: 'status', role: 'status', dataset: { role: 'etat-livre' } });
  const feedback = el('div', { class: 'stack' }); const candidatesZone = el('div', { class: 'stack' });
  const duplicateZone = el('div', { class: 'stack' }); const conflictsZone = el('div', { class: 'stack' });
  const fieldsZone = el('section', { class: 'card stack livre-ajout', hidden: !row && !draft.edition_id });
  const coverZone = el('section', { class: 'card stack' });
  const sourcesZone = el('details', null, el('summary', null, t('Sources'))); const sourceList = el('div', null); sourcesZone.append(sourceList);
  const inputs = new Map(), provenanceNodes = new Map(), listViews = [];
  const action = (label, role, fn, primary = false) => el('button', { type: 'button', class: primary ? 'btn primary' : 'btn', dataset: { role }, onClick: () => Promise.resolve(fn()).catch(() => dire(t('L’action n’a pas pu être terminée. Réessaie.'))) }, label);
  const message = (s) => { status.textContent = s; };
  const alive = () => !closed && (!mounted || !everConnected || root.isConnected);
  function dispose() { if (closed) return; closed = true; generation++; controller?.abort(); observer.disconnect(); window.removeEventListener('hashchange', dispose); unsubscribe?.(); if (previewUrl) revoquerUrlDeBlob(previewUrl); }
  const observer = new MutationObserver(() => { if (root.isConnected) everConnected = true; else if (everConnected) dispose(); });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', dispose);
  const unsubscribe = ctx.sync?.auth?.onChange?.((state) => { const id = state?.user?.id ?? null; if (id !== ownId) dispose(); });
  root.dispose = dispose;
  const ensure = async () => {
    if (importId) return importId;
    if (!creation) creation = (async () => {
      const id = repo.newId('imp'); const fresh = { ...fabriquerImportLivre({ id, deviceId: repo.deviceId(), brouillon: draft }), ...(initial ? { initial } : {}) };
      await repo.save('imports', fresh); importId = id; row = fresh;
      if (alive() && typeof deps.remplacerAdresse === 'function') deps.remplacerAdresse(`#/add/livre?import=${encodeURIComponent(id)}`);
      else if (alive() && location.hash.startsWith('#/add/livre')) remplacerAdresse(`#/add/livre?import=${encodeURIComponent(id)}`);
      return id;
    })().catch((e) => { creation = null; throw e; });
    return creation;
  };
  const persist = () => {
    const snapshot = brouillonLivre(draft);
    queue = queue.catch(() => {}).then(async () => { const id = await ensure(); await garderBrouillonLivre(id, snapshot, { repo }); });
    queue.catch(() => { if (alive()) message(t('Le brouillon n’a pas pu être sauvegardé. Réessaie.')); });
    return queue;
  };
  function changed(k, value) { draft = modifierChampLivre(draft, k, value); syncPanels(); persist(); }
  const isbnInput = el('input', { type: 'text', maxlength: 32, name: 'isbn', value: draft.fields.isbn, placeholder: '978…', onInput: (e) => {
    if (busy) { generation++; controller?.abort(); }
    draft.candidate_choisie = null;
    changed('isbn', e.target.value);
  }, onKeydown: (e) => { if (e.key === 'Enter' && !e.repeat && !e.isComposing) { e.preventDefault(); identifier(); } } });
  inputs.set('isbn', isbnInput);
  const isbnProvenance = el('small', { class: 'muted' }); provenanceNodes.set('isbn', isbnProvenance);
  const start = el('section', { class: 'card stack' }, field(t('ISBN'), isbnInput), isbnProvenance,
    el('p', { class: 'muted' }, t('Si le catalogue ne trouve pas l’édition, la recherche Internet utilise 1 appel de ton quota.')),
    el('div', { class: 'row' }, action(t('Identifier'), 'identifier-livre', () => identifier(), true), action(t('Scanner le code-barres'), 'scanner-livre', () => scanner()),
      action(t('Saisir à la main'), 'saisir-livre', async () => { fieldsZone.hidden = false; await persist(); })),
    el('p', { class: 'muted' }, t('Couverture, quatrième de couverture ou page de titre : jusqu’à 2 appels de ton quota.')),
    el('div', { class: 'row' }, action(t('Photographier la couverture'), 'photo-livre', () => choisirPhoto('environment', true)), action(t('Choisir une image'), 'image-livre', () => choisirPhoto(null, true))));
  const cancel = action(t('Annuler'), 'annuler-livre', () => { generation++; controller?.abort(); message(t('Recherche annulée. Ton brouillon est conservé.')); });
  cancel.hidden = true;
  root.append(start, status, cancel, feedback, duplicateZone, candidatesZone, fieldsZone, coverZone);
  const labels = { title: t('Titre'), subtitle: t('Sous-titre'), author: t('Auteur ou chef'), publisher: t('Éditeur'), year: t('Année'), description: t('Description courte') };
  for (const [k, label] of Object.entries(labels)) {
    const input = el(k === 'description' ? 'textarea' : 'input', { type: k === 'year' ? 'number' : 'text', name: k, rows: k === 'description' ? 3 : undefined,
      value: draft.fields[k], min: k === 'year' ? 1000 : undefined, max: k === 'year' ? new Date(maintenant()).getFullYear() + 2 : undefined,
      maxlength: k === 'description' ? 1200 : k === 'author' ? 1500 : 300, onInput: (e) => changed(k, e.target.value) });
    const p = el('small', { class: 'muted', dataset: { source: k } }); inputs.set(k, input); provenanceNodes.set(k, p); fieldsZone.append(field(label, input), p);
  }
  const language = select([{ value: '', label: t('À préciser') }, { value: 'fr', label: t('Français') }, { value: 'en', label: t('Anglais') }, { value: 'other', label: t('Autre') }], draft.fields.language, (v) => changed('language', v));
  inputs.set('language', language); const lp = el('small', { class: 'muted' }); provenanceNodes.set('language', lp); fieldsZone.append(field(t('Langue'), language), lp);
  const conventions = select([{ value: '', label: t('À préciser') }, ...listConventions().map((c) => ({ value: c.id, label: c.labels?.fr || c.id }))], draft.fields.convention, (v) => changed('convention', v));
  inputs.set('convention', conventions); fieldsZone.append(field(t('Convention de mesures'), conventions));
  function listeChamp(label, key, facet = null) {
    const chips = el('div', { class: 'row' }); const input = el('input', { type: 'text', maxlength: 80, 'aria-label': label });
    const get = () => facet ? draft.fields.cuisine_facets[facet] : draft.fields[key];
    const set = (values) => facet ? changed('cuisine_facets', { ...draft.fields.cuisine_facets, [facet]: values }) : changed(key, values);
    const add = () => { if (input.value.trim()) { set(listeLivre([...get(), input.value])); input.value = ''; } };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    const view = () => chips.replaceChildren(...get().map((v) => {
      const p = draft.provenance[key]?.values?.[v] || draft.provenance[key];
      return el('span', { class: 'stack', style: { gap: '.15rem', maxWidth: '100%' } },
        el('button', { type: 'button', class: 'chip removable', 'aria-label': t('Retirer {texte}', { texte: v }), onClick: () => set(get().filter((x) => x !== v)) }, v, ' ×'),
        p ? el('small', { class: 'muted' }, afficherProvenanceLivre(p), p.justification ? ` · ${p.justification}` : '') : null);
    }));
    listViews.push(view); fieldsZone.append(el('div', { class: 'stack' }, el('strong', null, label), chips, el('div', { class: 'row' }, input, action(t('Ajouter'), `ajouter-${facet || key}`, add))));
  }
  listeChamp(t('Origines et traditions'), 'cuisine_facets', 'origines'); listeChamp(t('Styles de cuisine'), 'cuisine_facets', 'styles'); listeChamp(t('Familles de préparations'), 'cuisine_facets', 'preparations');
  listeChamp(t('Autres cuisines'), 'cuisines'); listeChamp(t('Mots-clés'), 'tags');
  const attach = select([{ value: '', label: t('Nouveau livre') }, ...(ctx.books || []).filter((b) => typeof b.id === 'string').map((b) => ({ value: b.id, label: typeof b.title === 'string' ? b.title : t('Sans titre') }))], draft.book_id || '', (id) => { draft.book_id = id || null; persist(); });
  const attachZone = field(t('Rattacher cette édition'), attach); attachZone.hidden = !!draft.edition_id; fieldsZone.append(attachZone);
  const save = action(draft.edition_id ? t('Enregistrer les compléments') : t('Ajouter ce livre'), 'enregistrer-livre', () => enregistrer(), true);
  fieldsZone.append(conflictsZone, sourcesZone, el('div', { class: 'row' }, action(t('Compléter avec Internet (1 appel)'), 'completer-web', () => web()), save));
  function syncPanels() {
    for (const [k, input] of inputs) { const value = draft.fields[k]; if (input.value !== value && document.activeElement !== input) input.value = value; }
    for (const [k, p] of provenanceNodes) p.textContent = afficherProvenanceLivre(draft.provenance[k]);
    sourceList.replaceChildren(renderSourcesLivre(draft.provenance));
    conflictsZone.replaceChildren(...Object.entries(draft.proposals).map(([k, p]) => el('div', { class: 'card flat' },
      el('p', null, t('Autre proposition pour {champ} : {valeur}', { champ: labels[k] || k, valeur: typeof p.value === 'string' ? p.value : JSON.stringify(p.value) })),
      action(t('Utiliser cette proposition'), `utiliser-${k}`, () => { draft = appliquerCandidateLivre(draft, { fields: { [k]: p.value }, provenance: { [k]: p.provenance } }, { forceFields: [k] }); syncPanels(); persist(); }),
      action(t('Garder ma valeur'), `garder-${k}`, () => { delete draft.proposals[k]; syncPanels(); persist(); }))));
    for (const render of listViews) render();
    save.disabled = busy || preparing || saving || !draft.fields.title.trim(); cancel.hidden = !busy;
  }
  async function showCover() {
    if (previewUrl) { revoquerUrlDeBlob(previewUrl); previewUrl = null; }
    const file = draft.cover_sha256 ? await repo.getFile(draft.cover_sha256) : null;
    if (!alive()) return;
    if (file && typeAffichage(file)?.startsWith('image/')) previewUrl = displayUrl(file, urlDeBlob);
    coverZone.replaceChildren(el('h2', null, t('Couverture')),
      previewUrl ? el('img', { src: previewUrl, alt: t('Couverture'), style: { maxWidth: '180px', maxHeight: '240px', objectFit: 'contain' } }) : el('p', { class: 'muted' }, draft.cover_sha256 ? t('La couverture n’est pas sur cet appareil.') : t('Aucune couverture')),
      el('div', { class: 'row' }, action(t('Choisir une image'), 'changer-couverture', () => choisirPhoto(null, false)),
        action(t('Retirer'), 'retirer-couverture', () => { draft.cover_sha256 = null; persist(); showCover(); }),
        action(t('Pivoter'), 'pivoter-couverture', () => pivoter()),
        action(t('Chercher la couverture du catalogue'), 'couverture-catalogue', () => couvertureCatalogue())));
    if (draft.source_photo_sha256) coverZone.append(action(t('Revoir la photo source'), 'photo-source', () => revoirSource()), action(t('Relire la photo (1 appel)'), 'relire-photo', () => photoLecture(false)));
  }
  async function revoirSource() {
    const f = await repo.getFile(draft.source_photo_sha256);
    if (!typeAffichage(f)?.startsWith('image/')) { message(t('La couverture n’est pas sur cet appareil.')); return; }
    const u = displayUrl(f, urlDeBlob);
    await confirmDialog(t('Photo source'), { body: el('img', { src: u, alt: t('Photo source'), style: { maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' } }), okLabel: t('Fermer') }); revoquerUrlDeBlob(u);
  }
  async function pivoter() {
    if (busy) return;
    const sha = draft.source_photo_sha256 || draft.cover_sha256; const f = sha ? await repo.getFile(sha) : null;
    if (!f?.blob) { message(t('La couverture n’est pas sur cet appareil.')); return; }
    draft.rotation = (draft.rotation + 90) % 360;
    const blob = await reduireImage(f.blob, { rotation: draft.rotation }); const hash = await sha256Hex(blob);
    await repo.putFile(hash, blob, { mime: 'image/jpeg' }); draft.cover_sha256 = hash; await persist(); await showCover();
  }
  async function couvertureCatalogue() {
    const isbn = validerIsbn(draft.fields.isbn); if (!isbn.ok) { message(t('Saisis un ISBN valide d’abord.')); return; }
    const snapshot = draft.cover_sha256;
    const blob = await recupererCouvertureParIsbn(isbn.isbn13, { fetch }); if (!blob) { message(t('Aucune couverture reçue. Tu peux la photographier.')); return; }
    const u = urlDeBlob(blob); const yes = await confirmDialog(t('Utiliser la couverture du catalogue ?'), { body: el('img', { src: u, alt: t('Couverture'), style: { maxHeight: '45vh', maxWidth: '100%' } }), okLabel: t('Utiliser cette image') }); revoquerUrlDeBlob(u);
    if (!yes || !alive() || snapshot !== draft.cover_sha256) return;
    const p = await poserCouverture(blob, { origine: 'distante', repo }); draft.cover_sha256 = p.sha256; await persist(); await showCover();
  }
  async function choisirPhoto(capture, identify) {
    if (busy || preparing) return;
    preparing = true; syncPanels();
    const g = generation;
    try {
      const files = await choisir({ accept: 'image/*', multiple: false, capture }); if (!files.length || g !== generation || !alive()) return;
      const p = await poserCouverture(files[0], { origine: 'locale', repo }); if (!alive() || g !== generation) return;
      draft.cover_sha256 = p.sha256;
      if (identify) {
        const blank = brouillonLivre();
        for (const key of Object.keys(draft.fields)) if (!draft.touched[key]) { draft.fields[key] = blank.fields[key]; delete draft.provenance[key]; delete draft.proposals[key]; }
        draft.source_photo_sha256 = p.sha256; draft.rotation = 0; draft.candidate_choisie = null; generation++; candidatesZone.replaceChildren(); syncPanels();
      }
      fieldsZone.hidden = false; await persist(); await showCover(); preparing = false; if (identify) await photoLecture(true);
    } catch (e) { message(messageErreurImage(e)); } finally { preparing = false; syncPanels(); }
  }
  async function scanner() {
    if (busy) return;
    if (!window.BarcodeDetector) { message(t('Le lecteur de code-barres n’est pas offert dans ce navigateur.')); return; }
    const files = await choisir({ accept: 'image/*', capture: 'environment', multiple: false }); if (!files.length) return;
    let bmp;
    try { bmp = await createImageBitmap(files[0]); const code = codeBarresVersIsbn(await new window.BarcodeDetector({ formats: ['ean_13'] }).detect(bmp));
      if (!code) { message(t('Aucun ISBN lu sur cette photo.')); return; } changed('isbn', code); syncPanels(); await identifier();
    } catch { message(t('Lecture du code-barres impossible.')); } finally { bmp?.close?.(); }
  }
  async function existantes() {
    message(t('Recherche dans ta bibliothèque…'));
    const list = await trouverEditionsLivre(draft.fields.isbn, repo);
    if (!list.length || (draft.edition_id && list.length === 1 && list[0].id === draft.edition_id)) { duplicateZone.replaceChildren(); return false; }
    duplicateZone.replaceChildren(el('p', null, t('Ce livre est déjà dans ta bibliothèque')), ...list.map((e) => el('div', { class: 'row' },
      el('a', { class: 'btn', href: `#/books/${encodeURIComponent(e.id)}` }, t('Ouvrir le livre')),
      action(t('Compléter les informations'), `completer-${e.id}`, async () => {
        const b = await repo.get('books', e.book_id); if (!b) return;
        draft = brouillonDepuisEdition(b, e); initial = brouillonLivre(draft); await persist();
        await repo.saveBatch({}, { conditions: { imports: [{ key: importId, fusion: (c) => ({ ...c, initial }) }] } });
        fieldsZone.hidden = false; save.textContent = t('Enregistrer les compléments'); duplicateZone.replaceChildren(); syncPanels(); showCover();
      }))));
    message(t('Ce livre est déjà dans ta bibliothèque')); return true;
  }
  function apply(c, explicit = false) {
    const request = validerIsbn(draft.fields.isbn), candidate = validerIsbn(c.fields.isbn);
    if (request.ok && candidate.ok && request.isbn13 !== candidate.isbn13) {
      message(t('Cette candidate porte un autre ISBN. Modifie l’ISBN explicitement pour choisir cette édition.')); return;
    }
    draft = appliquerCandidateLivre(draft, c); draft.candidate_choisie = cleCandidateLivre(c); fieldsZone.hidden = false;
    candidatesZone.replaceChildren(); message(t('Livre identifié — vérifie les informations.'));
    if (c.uncertain?.length) feedback.replaceChildren(el('p', { class: 'muted' }, t('À vérifier : {texte}', { texte: c.uncertain.join(', ') })));
    syncPanels(); persist();
  }
  function receive(candidates) {
    if (candidates.length === 1 && !candidates[0].conflict) { apply(candidates[0]); return; }
    fieldsZone.hidden = false;
    if (!candidates.length) { message(t('Aucun résultat fiable. Tu peux compléter la fiche manuellement.')); return; }
    message(t('Plusieurs éditions possibles.'));
    candidatesZone.replaceChildren(...candidates.map((c, i) => el('div', { class: 'card stack' },
      el('strong', null, c.fields.title), el('p', null, [c.fields.author, c.fields.isbn, c.fields.publisher, c.fields.year, c.fields.language].filter(Boolean).join(' · ')),
      c.conflict ? el('p', { class: 'status warn' }, t('Ces informations contredisent les indices saisis. Vérifie l’édition.')) : null,
      renderSourcesLivre(c.provenance), action(t('Choisir cette édition'), `candidate-${i}`, () => apply(c, true)))));
  }
  async function phaseAssistant(phase, fn) {
    if (busy || volEnCours()) { message(t('Une lecture est déjà en cours : annule-la d’abord.')); return null; }
    if (!enLigne()) { message(t('Tu es hors ligne. Ton brouillon est conservé.')); return null; }
    busy = true; controller = new AbortController(); const localController = controller;
    const tenue = { importId: importId || 'livre-en-preparation', controller, repo }; const g = generation;
    if (!prendreVol(tenue)) { busy = false; return null; }
    syncPanels(); let beat = null, started = false;
    try {
      const session = await sessionDe(); if (!session) { message(t('Connecte-toi pour utiliser l’assistant.')); feedback.replaceChildren(carteConnexion(() => demarrerConnexion(ctx.sync?.auth), ctx)); return null; }
      await persist(); await queue; const id = await ensure(); tenue.importId = id;
      if (!alive() || g !== generation) return null;
      await repo.transitionner('imports', id, { attendus: ['a_lancer', 'echec', 'a_verifier'], patch: (c) => ({ status: 'en_cours', phase, erreur: null, document_id_vol: DOCUMENT_ID,
        started_at: maintenant(), brouillon: brouillonLivre(draft) }) });
      started = true; await repo.battre?.(id, maintenant()); beat = setInterval(() => repo.battre?.(id, maintenant()).catch(() => {}), deps.battementMs || BATTEMENT_MS);
      message(phase === 'web' ? t('Recherche sur Internet…') : t('Lecture de la photo…'));
      let compte = false;
      const fetchCompte = async (...args) => {
        if (!compte) {
          if (localController.signal.aborted || !alive() || g !== generation) throw new Error('annule');
          await repo.transitionner('imports', id, { attendus: ['en_cours'], patch: (c) => {
            if (c.document_id_vol !== DOCUMENT_ID) throw new Error('vol_perdu');
            return { appels: (Number.isInteger(c.appels) ? c.appels : 0) + 1 };
          } });
          compte = true;
        }
        return fetch(...args);
      };
      const entree = { isbn: draft.fields.isbn, source_photo_sha256: draft.source_photo_sha256, generation };
      const result = await fn(session, localController.signal, fetchCompte);
      const currentSession = await sessionDe();
      if (!alive() || g !== generation || localController.signal.aborted || currentSession?.user?.id !== session.user?.id) throw new Error('annule');
      if (result?.etat === 'indisponible') throw Object.assign(new Error(result.raison), { raison: result.raison, quota: result.quota, trop_lourd: result.trop_lourd });
      await queue;
      await repo.transitionner('imports', id, { attendus: ['en_cours'], patch: (c) => {
        if (c.document_id_vol !== DOCUMENT_ID) throw new Error('vol_perdu');
        return { status: 'a_verifier', phase: 'relecture', resultat: { format: 1, ...(c.resultat || {}), [phase]: { ...result, entree } }, model: result?.model || result?.modele || null, document_id_vol: null, finished_at: maintenant() };
      } });
      return result;
    } catch (e) {
      const reason = localController.signal.aborted || g !== generation ? 'annule' : (e.raison || e.message || 'interne');
      if (started) { try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: (c) => {
        if (c.document_id_vol !== DOCUMENT_ID) throw new Error('vol_perdu');
        return { status: 'echec', phase, erreur: { raison: RAISONS_LIVRE.includes(reason) ? reason : 'reseau', extra: { quota: Number.isFinite(e.quota) ? e.quota : null, trop_lourd: e.trop_lourd === true } }, document_id_vol: null, finished_at: maintenant() };
      } }); } catch { /* la ligne a été close ailleurs : aucune réécriture */ } }
      if (alive()) { message(reason === 'annule' ? t('Recherche annulée. Ton brouillon est conservé.') : texteEchecLivre({ raison: reason, extra: { quota: e.quota, trop_lourd: e.trop_lourd } }));
        feedback.replaceChildren(action(t('Réessayer (1 appel)'), 'reessayer-livre', () => phase === 'web' ? web() : photoLecture(false))); }
      return null;
    } finally { if (beat) clearInterval(beat); libererVol(tenue); busy = false; if (controller === localController) controller = null; if (alive()) syncPanels(); }
  }
  async function web() {
    if (!validerIsbn(draft.fields.isbn).ok && !(draft.fields.title && draft.fields.author)) { message(t('Indique un ISBN valide ou le titre et l’auteur.')); return; }
    const result = await phaseAssistant('web', (session, signal, fetchCompte) => rechercherLivreWeb({ ...draft.fields, session }, { fetch: fetchCompte, signal, config: deps.config, enLigne, maintenant }));
    if (result && alive()) receive(result.candidates);
  }
  async function photoLecture(enchainement) {
    const sha = draft.source_photo_sha256; const file = sha ? await repo.getFile(sha) : null;
    if (!file?.blob) { message(t('La couverture n’est pas sur cet appareil.')); return; }
    const result = await phaseAssistant('lecture_photo', async (session, signal, fetchCompte) => {
      const blob = await reduireImage(file.blob, { rotation: draft.rotation });
      const provider = deps.provider?.(session) || new PasserelleProvider(deps.config, { session, fetch: fetchCompte });
      return extraireIndicesLivre(provider, { mime: 'image/jpeg', base64: await blobToBase64(blob) }, { signal });
    });
    if (!result || !alive()) return;
    const c = candidateDepuisPhoto(result.lecture, maintenant());
    const iv = validerIsbn(c.fields.isbn); if (c.fields.isbn && !iv.ok) { c.fields.isbn = ''; delete c.provenance.isbn; c.uncertain.push('isbn'); }
    else if (iv.ok) c.fields.isbn = iv.isbn13;
    draft = appliquerCandidateLivre(draft, c); fieldsZone.hidden = false; syncPanels(); await persist();
    if (result.lecture.related_titles?.length) feedback.replaceChildren(el('p', { class: 'muted' }, t('Autres ouvrages cités : {titres}', { titres: result.lecture.related_titles.join(', ') })));
    if (result.lecture.rotation && !result.lecture.uncertain.includes('rotation')) {
      draft.rotation = (draft.rotation + result.lecture.rotation) % 360; const blob = await reduireImage(file.blob, { rotation: draft.rotation }); const hash = await sha256Hex(blob);
      await repo.putFile(hash, blob, { mime: 'image/jpeg' }); draft.cover_sha256 = hash; await persist(); await showCover();
    }
    if (await existantes()) return;
    if (enchainement) await web(); else message(t('Photo lue — vérifie les informations.'));
  }
  async function identifier() {
    if (busy) return;
    const v = validerIsbn(draft.fields.isbn); if (!v.ok) { message(t('Cet ISBN n’est pas valide, vérifie les chiffres.')); return; }
    busy = true; const g = generation; controller = new AbortController(); syncPanels(); message(t('Recherche dans le catalogue…'));
    try {
      draft.fields.isbn = v.isbn13; await persist(); if (await existantes()) return;
      if (!enLigne()) { fieldsZone.hidden = false; message(t('Tu es hors ligne. Ton brouillon est conservé.')); return; }
      await garderBrouillonLivre(importId, draft, { repo, phase: 'catalogue' });
      const result = await chercherCatalogueLivre(v.isbn13, { fetch, signal: controller.signal, cleGoogle, maintenant });
      if (!alive() || generation !== g || controller.signal.aborted) return;
      if (result.etat === 'trouve') { receive(result.candidates); return; }
      message(result.etat === 'indisponible' ? t('Catalogue indisponible. Recherche sur Internet…') : t('Livre non trouvé dans le catalogue. Recherche sur Internet…'));
      fieldsZone.hidden = false;
      busy = false; controller = null; await web();
    } finally { busy = false; controller = null; syncPanels(); }
  }
  async function enregistrer(resolutions = []) {
    if (saving || busy || !draft.fields.title.trim()) return;
    saving = true; syncPanels();
    try {
      await persist(); await queue;
      const ed = await enregistrerLivreI2({ importId, brouillon: draft, base: initial, resolutions }, { repo, maintenant });
      if (ed.dejaAjoute) { message(t('Ce livre a déjà été ajouté.')); duplicateZone.replaceChildren(el('a', { class: 'btn', href: `#/books/${encodeURIComponent(ed.id)}` }, t('Ouvrir le livre'))); return; }
      dire(draft.edition_id ? t('Compléments enregistrés') : t('Livre ajouté')); nav(`/books/${encodeURIComponent(ed.id)}${draft.edition_id ? '' : '?nouveau=1'}`);
    } catch (e) {
      if (e instanceof ConflitLivre) { message(t('Ces informations ont changé sur un autre écran.'));
        feedback.replaceChildren(el('p', null, t('Ta saisie est conservée. Tu peux garder explicitement tes changements.')),
          ...e.fields.map((k) => el('p', null, t('Valeur enregistrée pour {champ} : {valeur}', { champ: labels[k] || (k === 'convention' ? t('Convention de mesures') : k), valeur: (typeof e.valeurs[k] === 'string' ? e.valeurs[k] : JSON.stringify(e.valeurs[k] ?? '')).slice(0, 1200) }))),
          action(t('Garder mes changements'), 'resoudre-conflit-livre', () => enregistrer(e.fields)));
      } else message(e.message === 'isbn_invalide' ? t('Cet ISBN n’est pas valide, vérifie les chiffres.') : e.message === 'annee_invalide' ? t('Cette année n’est pas valide.') : t('Le livre n’a pas pu être enregistré. Réessaie.'));
    } finally { saving = false; syncPanels(); }
  }
  root.etatRoute = () => ({ importId, busy, saving, brouillon: brouillonLivre(draft) });
  root.attendreEcritures = () => queue;
  async function reprendreResultats(ligne) {
    const correspond = (result) => {
      if (!result?.entree) return true;
      const entree = result.entree, saisi = validerIsbn(draft.fields.isbn), ancien = validerIsbn(entree.isbn);
      return (entree.source_photo_sha256 || null) === draft.source_photo_sha256 && !(ancien.ok && saisi.ok && ancien.isbn13 !== saisi.isbn13);
    };
    const photo = ligne?.resultat?.lecture_photo;
    if (photo?.lecture && correspond(photo)) {
      try { draft = appliquerCandidateLivre(draft, candidateDepuisPhoto(validerIndicesLivre(photo.lecture), photo.date || ligne.finished_at || maintenant())); syncPanels(); }
      catch { /* une lecture reçue mal formée ne remplit jamais le formulaire */ }
    }
    const raw = ligne?.resultat?.web;
    const saved = correspond(raw) ? relireRechercheLivre(raw, { isbn: draft.fields.isbn, maintenant: maintenant() }) : { candidates: [] };
    const choisie = saved.candidates.find((c) => cleCandidateLivre(c) === draft.candidate_choisie);
    if (choisie) apply(choisie, true); else if (saved.candidates.length) receive(saved.candidates);
    else if (photo?.lecture) await persist();
  }
  async function reprendreEtat(ligne) {
    if (ligne?.status === 'en_cours') {
      message(t('En cours sur un autre écran')); busy = true; syncPanels();
      feedback.replaceChildren(action(t('Actualiser'), 'actualiser-livre', async () => { await repo.marquerInterrompus?.(); const current = await repo.get('imports', importId); busy = false; feedback.replaceChildren(); await reprendreEtat(current); syncPanels(); }));
      return;
    }
    if (ligne && ['enregistre', 'ignore'].includes(ligne.status)) { busy = true; message(t('Cet import est terminé.')); if (ligne.edition_id) feedback.replaceChildren(el('a', { class: 'btn', href: `#/books/${encodeURIComponent(ligne.edition_id)}` }, t('Ouvrir le livre'))); return; }
    if (ligne) {
      message(t('Brouillon repris. Vérifie les informations.')); await reprendreResultats(ligne);
      if (ligne.status === 'echec') { message(texteEchecLivre(ligne.erreur)); feedback.append(action(t('Réessayer (1 appel)'), 'reessayer-livre', () => ligne.phase === 'lecture_photo' ? photoLecture(false) : web())); }
    }
  }
  syncPanels(); await showCover();
  if (row?.status === 'en_cours') { await repo.marquerInterrompus?.(); row = await repo.get('imports', importId); }
  await reprendreEtat(row);
  mounted = true; everConnected = root.isConnected;
  return root;
}
