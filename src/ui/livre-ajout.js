// « Ajouter un livre » en deux pas (spec UX § 5) : identifier (ISBN scanné, tapé, ou saisie à la main), puis compléter.
// Ce qui vient d'Open Library / Google Books est ÉTIQUETÉ et borné (I-A, I-G) ; l'écriture passe par repo.saveBatch (I-D).
import { el, toast, pickFiles } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate } from '../core/router.js';
import * as repo from '../model/repo.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, field, select } from './components.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';

export const LIMITES_ISBN = { champ: 300, corps: 256 * 1024, delaiMs: 10000 };
export const OPTIONS_FETCH = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };
const CHAMPS_VIDES = () => ({ title: '', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] });

export const nettoyerIsbn = (s) => String(s || '').replace(/[^0-9Xx]/g, '');
const borner = (s) => (s == null ? '' : String(s).slice(0, LIMITES_ISBN.champ));
const annee = (s) => { const m = String(s || '').match(/\b(\d{4})\b/); return m ? parseInt(m[1], 10) : null; };

async function lireJson(fetchFn, url, signal) {
  const r = await fetchFn(url, { ...OPTIONS_FETCH, signal });
  if (!r.ok) return null;
  const texte = await r.text();
  if (texte.length > LIMITES_ISBN.corps) return null; // S3 : abandonné avant JSON.parse
  return JSON.parse(texte);
}

// Les deux appels sont dans un try : un échec réseau, un 404, un 429 ou le délai donnent { fiche: null, source: null }.
export async function lookupIsbn(isbn, { fetch = globalThis.fetch, signal } = {}) {
  try {
    const data = await lireJson(fetch, `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, signal);
    const b = data?.[`ISBN:${isbn}`];
    if (b) return { source: 'openlibrary', fiche: { title: borner(b.title), author: borner((b.authors || []).map((a) => a.name).join(', ')), publisher: borner((b.publishers || []).map((p) => p.name).join(', ')), year: annee(b.publish_date), language: null } };
  } catch { /* continuer */ }
  try {
    const gd = await lireJson(fetch, `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, signal);
    const v = gd?.items?.[0]?.volumeInfo;
    if (v) return { source: 'googlebooks', fiche: { title: borner(v.title), author: borner((v.authors || []).join(', ')), publisher: borner(v.publisher), year: annee(v.publishedDate), language: v.language === 'fr' || v.language === 'en' ? v.language : null } };
  } catch { /* continuer */ }
  return { fiche: null, source: null };
}

export function fusionnerFiche(champs, fiche) {
  const out = { ...champs };
  for (const k of ['title', 'author', 'publisher', 'language']) if (fiche?.[k] && !out[k]) out[k] = fiche[k];
  if (fiche?.year && !out.year) out.year = String(fiche.year);
  return out;
}

export function livreAjoutModel({ pas = 1, isbn = '', champs = {}, provenance = null, recherche = false, lecteurDisponible = true } = {}) {
  const c = { ...CHAMPS_VIDES(), ...champs };
  const provenanceMessage = provenance === 'openlibrary' ? t('Renseigné par Open Library — vérifie et corrige.')
    : provenance === 'googlebooks' ? t('Renseigné par Google Books — vérifie et corrige.')
    : provenance === 'aucune' ? t('Aucune fiche trouvée pour cet ISBN. Complète à la main.') : null;
  return { pas, isbn, champs: c, provenance, recherche, lecteurDisponible, peutEnregistrer: pas === 2 && !!c.title.trim() && !recherche,
    messages: { provenance: provenanceMessage, recherche: recherche ? t('Recherche…') : null, lecteur: lecteurDisponible ? null : t('Le lecteur de code-barres n’est pas offert dans ce navigateur.') } };
}

export function fabriquerLivre({ champs, isbn, coverSha256 = null }, { newId }) {
  const c = { ...CHAMPS_VIDES(), ...champs };
  const book = { id: newId('bk'), title: c.title.trim(), author: c.author.trim(), cuisines: [...c.cuisines], tags: [] };
  const edition = { id: newId('ed'), book_id: book.id, isbn: nettoyerIsbn(isbn) || null, publisher: c.publisher.trim() || null, year: c.year ? parseInt(c.year, 10) || null : null, language: c.language || null, unit_convention_id: c.convention || null, convention_evidence: c.convention ? 'confirmed_by_user' : null, owned: true, cover_sha256: coverSha256 || null };
  return { book, edition };
}

export async function enregistrerLivre(args, { repo: r = repo } = {}) {
  const { book, edition } = fabriquerLivre(args, { newId: r.newId });
  await r.saveBatch({ books: [book], book_editions: [edition] });
  return edition;
}

export function renderLivreAjout(model, gestes = {}) {
  const g = (nom) => (...a) => (typeof gestes[nom] === 'function' ? gestes[nom](...a) : undefined);
  if (model.pas === 1) {
    return el('section', { class: 'card stack livre-ajout' },
      el('p', null, t('Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.')),
      field(t('ISBN'), el('input', { type: 'text', name: 'isbn', inputmode: 'numeric', placeholder: '978…', value: model.isbn, onInput: (e) => g('changerIsbn')(e.target.value) })),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', disabled: !model.lecteurDisponible || model.recherche, onClick: g('scanner') }, t('Scanner le code-barres')),
        el('button', { type: 'button', class: 'btn primary', disabled: model.recherche, onClick: g('identifier') }, t('Identifier')),
        el('button', { type: 'button', class: 'btn link', onClick: g('saisirMain') }, t('Saisir à la main'))),
      model.messages.lecteur ? el('small', { class: 'muted' }, model.messages.lecteur) : null,
      model.messages.recherche ? el('div', { class: 'muted' }, model.messages.recherche) : null,
      model.messages.provenance ? el('div', { class: 'muted' }, model.messages.provenance) : null,
      el('small', { class: 'muted' }, t('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.')));
  }
  const c = model.champs;
  const inp = (k, type = 'text') => el('input', { type, value: c[k], onInput: (e) => g('changerChamp')(k, e.target.value) });
  const puces = renderPuces(pucesModel({ choisies: c.cuisines, existantes: model.existantes || [] }), { basculer: g('basculerCuisine'), ajouter: g('ajouterCuisine') });
  return el('section', { class: 'card stack livre-ajout' },
    el('p', null, t('Vérifie la fiche, puis ajoute le livre.')),
    model.messages.provenance ? el('div', { class: 'status info' }, model.messages.provenance) : null,
    model.isbn ? el('div', { class: 'row' }, el('span', { class: 'muted' }, `ISBN ${model.isbn}`), el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN'))) : el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN')),
    field(t('Titre *'), inp('title')),
    field(t('Auteur / chef'), inp('author')),
    field(t('Langue du livre'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'other', label: t('Autre') }], c.language, (v) => g('changerChamp')('language', v))),
    field(t('Cuisines'), puces),
    typeof gestes.couverture === 'function' ? gestes.couverture() : null,
    el('details', null, el('summary', { class: 'btn' }, t('Plus de détails')),
      el('div', { class: 'two-col', style: { marginTop: '.8rem' } },
        field(t('Éditeur'), inp('publisher')), field(t('Année'), inp('year', 'number')),
        field(t('Convention de mesure (tasses, cuillères)'), select([{ value: '', label: t('Non confirmée — à préciser plus tard') }, ...listConventions().map((x) => ({ value: x.id, label: x.labels.fr }))], c.convention, (v) => g('changerChamp')('convention', v)),
          t('La langue du livre ne suffit pas à choisir une convention. Sans convention, les tasses restent affichées telles quelles.')))),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', disabled: !model.peutEnregistrer, onClick: g('enregistrer') }, t('Ajouter ce livre'))));
}

// La route : état + gestes réels, re-rendu complet à chaque changement (le formulaire est petit).
export async function renderLivreAjoutRoute(params, query, ctx) {
  const etat = { pas: 1, isbn: '', champs: CHAMPS_VIDES(), provenance: null, recherche: false, lecteurDisponible: 'BarcodeDetector' in window, existantes: cuisinesExistantes(ctx), couverture: null };
  const root = el('div', null, pageHeader(t('Ajouter un livre'), { back: { href: '/add', label: t('Ajouter') } }));
  const zone = el('div', null);
  root.append(zone);
  const dessiner = () => zone.replaceChildren(renderLivreAjout({ ...livreAjoutModel(etat), existantes: etat.existantes }, gestes));
  const identifier = async () => {
    const isbn = nettoyerIsbn(etat.isbn);
    if (!isbn) { toast(t('Saisis un ISBN d’abord.')); return; }
    etat.recherche = true; dessiner();
    const ctl = new AbortController();
    const chrono = setTimeout(() => ctl.abort(), LIMITES_ISBN.delaiMs);
    try {
      const { fiche, source } = await lookupIsbn(isbn, { signal: ctl.signal });
      etat.isbn = isbn; etat.champs = fusionnerFiche(etat.champs, fiche); etat.provenance = source || 'aucune'; etat.pas = 2;
    } finally { clearTimeout(chrono); etat.recherche = false; dessiner(); }
  };
  const gestes = {
    changerIsbn: (v) => { etat.isbn = v; },
    identifier,
    scanner: async () => {
      const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
      if (!files.length) return;
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
        const bmp = await createImageBitmap(files[0]);
        const code = (await detector.detect(bmp)).find((x) => /^97[89]\d{10}$/.test(x.rawValue));
        if (!code) { toast(t('Aucun ISBN lu sur cette photo.')); return; }
        etat.isbn = code.rawValue; await identifier();
      } catch { toast(t('Lecture du code-barres impossible.')); }
    },
    saisirMain: () => { etat.isbn = nettoyerIsbn(etat.isbn); etat.provenance = null; etat.pas = 2; dessiner(); },
    changerChamp: (k, v) => { etat.champs[k] = v; },
    basculerCuisine: (v) => { etat.champs.cuisines = basculerPuce(etat.champs.cuisines, v); dessiner(); },
    ajouterCuisine: (v) => { const apres = ajouterPuce(etat.champs.cuisines, v); if (apres !== etat.champs.cuisines) { etat.champs.cuisines = apres; dessiner(); } },
    retourIsbn: () => { etat.pas = 1; dessiner(); },
    enregistrer: async () => {
      if (!livreAjoutModel(etat).peutEnregistrer) return;
      const edition = await enregistrerLivre({ champs: etat.champs, isbn: etat.isbn, coverSha256: etat.couverture?.sha256 || null }, { repo });
      toast(t('Livre ajouté'));
      navigate(`/books/${edition.id}?nouveau=1`);
    },
  };
  dessiner();
  return root;
}
