// Ajouter : livre (ISBN → métadonnées → confirmer), photos de pages, PDF, recette manuelle, lot au congélateur (spec §3.1, §16).
import { el, toast, pickFiles } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, field, select, section } from './components.js';
import { startScanSession } from './import.js';

export async function renderAdd(params, query, ctx) {
  const root = el('div', null, pageHeader(t('Ajouter')));
  root.append(el('div', { class: 'grid wide' },
    tile('📷', t('Photographier des pages'), t('Table des matières, index ou recette. Les photos sont conservées sur cet appareil.'), async () => {
      const files = await pickFiles({ accept: 'image/*', multiple: true, capture: 'environment' });
      if (files.length) await startScanSession(files, { edition_id: query.edition || null });
    }),
    tile('🖼', t('Choisir des photos ou un PDF'), t('Depuis Fichiers ou Photos. PDF textuel ou image accepté.'), async () => {
      const files = await pickFiles({ accept: 'image/*,application/pdf,application/epub+zip', multiple: true });
      if (files.length) await startScanSession(files, { edition_id: query.edition || null });
    }),
    tile('✍️', t('Saisir une recette'), t('Recette personnelle ou copie manuelle avec sa provenance.'), () => navigate('/recipes/new' + (query.edition ? `?edition=${query.edition}` : ''))),
    tile('🧊', t('Ajouter un lot au congélateur'), t('Portions, date, recette source et méthode de réchauffage.'), () => navigate('/kitchen?tab=inventory&add=1'))));
  root.append(bookForm(ctx));
  return root;
}

function tile(ico, title, desc, onClick) {
  return el('button', { class: 'card', style: { textAlign: 'left', cursor: 'pointer', border: '0', font: 'inherit' }, onClick },
    el('div', { style: { fontSize: '1.6rem' } }, ico), el('h3', null, title), el('p', { class: 'muted', style: { margin: 0, fontSize: '.9rem' } }, desc));
}

function bookForm(ctx) {
  const f = { title: '', author: '', isbn: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: '' };
  const inputs = {};
  const inp = (key, type = 'text', placeholder = '') => (inputs[key] = el('input', { type, placeholder, value: f[key], onInput: (e) => { f[key] = e.target.value; } }));
  const status = el('div', { class: 'muted', style: { fontSize: '.9rem' } });
  const lookup = async () => {
    const isbn = f.isbn.replace(/[^0-9Xx]/g, '');
    if (!isbn) { status.textContent = t('Saisis un ISBN d’abord.'); return; }
    status.textContent = t('Recherche des métadonnées…');
    try {
      const meta = await lookupIsbn(isbn);
      if (!meta) { status.textContent = t('Aucune métadonnée trouvée : complète à la main.'); return; }
      for (const k of ['title', 'author', 'publisher', 'year', 'language']) if (meta[k] && !f[k]) { f[k] = String(meta[k]); if (inputs[k]) inputs[k].value = f[k]; }
      if (meta.language && inputs.language) inputs.language.value = meta.language;
      status.textContent = t('Métadonnées proposées par {s} — vérifie puis confirme.', { s: meta.source });
    } catch (e) { status.textContent = t('Recherche impossible (hors connexion ?) : saisie manuelle.'); }
  };
  const scan = async () => {
    if (!('BarcodeDetector' in window)) { status.textContent = t('Lecture de code-barres non disponible dans ce navigateur : photographie le code ou saisis l’ISBN.'); return; }
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
    if (!files.length) return;
    try {
      const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
      const bmp = await createImageBitmap(files[0]);
      const codes = await detector.detect(bmp);
      const code = codes.find((c) => /^97[89]\d{10}$/.test(c.rawValue));
      if (!code) { status.textContent = t('Aucun ISBN lu sur cette photo.'); return; }
      f.isbn = code.rawValue; inputs.isbn.value = f.isbn; await lookup();
    } catch (e) { status.textContent = t('Lecture du code-barres impossible : {e}', { e: e.message }); }
  };
  const save = async () => {
    if (!f.title.trim()) { toast(t('Le titre est requis')); return; }
    const book = { id: repo.newId('bk'), title: f.title.trim(), author: f.author.trim(), cuisines: f.cuisines.split(',').map((s) => s.trim()).filter(Boolean), tags: [] };
    const edition = { id: repo.newId('ed'), book_id: book.id, isbn: f.isbn.replace(/[^0-9Xx]/g, '') || null, publisher: f.publisher.trim() || null, year: f.year ? parseInt(f.year, 10) || null : null, language: f.language || null, unit_convention_id: f.convention || null, convention_evidence: f.convention ? 'confirmed_by_user' : null, owned: true };
    await repo.saveBatch({ books: [book], book_editions: [edition] });
    toast(t('Livre ajouté'));
    navigate(`/books/${edition.id}`);
  };
  return section(t('Ajouter un livre'),
    el('p', { class: 'muted' }, t('Scanner l’ISBN → identifier → confirmer → ajouter. Saisie manuelle toujours possible.')),
    el('div', { class: 'two-col' },
      field(t('ISBN'), el('div', { class: 'row' }, inp('isbn', 'text', '978…'), el('button', { class: 'btn', onClick: lookup }, t('Identifier')), el('button', { class: 'btn', onClick: scan }, t('Scanner'))), status),
      field(t('Titre *'), inp('title')),
      field(t('Auteur / chef'), inp('author')),
      field(t('Éditeur'), inp('publisher')),
      field(t('Année'), inp('year', 'number')),
      field(t('Langue du livre'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'other', label: t('Autre') }], f.language, (v) => { f.language = v; })),
      field(t('Cuisines (séparées par des virgules)'), inp('cuisines', 'text', 'italienne, levantine')),
      field(t('Convention de mesure (tasses, cuillères)'), select([{ value: '', label: t('Non confirmée — à préciser plus tard') }, ...listConventions().map((c) => ({ value: c.id, label: c.labels.fr }))], '', (v) => { f.convention = v; }),
        t('La langue du livre ne suffit pas à choisir une convention. Sans convention, les tasses restent affichées telles quelles.'))),
    el('div', { class: 'row', style: { marginTop: '.8rem' } }, el('button', { class: 'btn primary', onClick: save }, t('Ajouter ce livre'))));
}

// Métadonnées : Open Library puis Google Books ; échec silencieux → saisie manuelle.
export async function lookupIsbn(isbn) {
  try {
    const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    if (r.ok) {
      const data = await r.json();
      const b = data[`ISBN:${isbn}`];
      if (b) return { title: b.title, author: (b.authors || []).map((a) => a.name).join(', '), publisher: (b.publishers || []).map((p) => p.name).join(', '), year: (b.publish_date || '').match(/\d{4}/)?.[0], language: null, source: 'Open Library' };
    }
  } catch { /* continuer */ }
  const g = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!g.ok) return null;
  const gd = await g.json();
  const v = gd.items?.[0]?.volumeInfo;
  if (!v) return null;
  return { title: v.title, author: (v.authors || []).join(', '), publisher: v.publisher, year: (v.publishedDate || '').match(/\d{4}/)?.[0], language: v.language === 'fr' || v.language === 'en' ? v.language : null, source: 'Google Books' };
}

export { refresh };
