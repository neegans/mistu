// « Ajouter un livre » en deux pas (spec UX § 5) : identifier (ISBN scanné, tapé, ou saisie à la main), puis compléter.
// Ce qui vient d'Open Library / Google Books est ÉTIQUETÉ et borné (I-A, I-G) ; l'écriture passe par repo.saveBatch (I-D).
import { el, toast, pickFiles } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { logError } from '../core/log.js';
import { navigate } from '../core/router.js';
import * as repo from '../model/repo.js';
import { sha256Hex } from '../core/hash.js';
import { COVER_INPUT_MIME, ALLOWED_MIME } from '../sync/mime.js';
import { LIMITES_COUVERTURE, dimensionsImage, reduireImage, ErreurImage } from '../core/image.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, field, select } from './components.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';

export const LIMITES_ISBN = { champ: 300, corps: 256 * 1024, delaiMs: 10000 };
export const OPTIONS_FETCH = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };
// Les champs qu'une fiche distante peut remplir : ce qu'`identifier` doit pouvoir REPRENDRE à l'ISBN suivant (C3).
export const CHAMPS_DISTANTS = ['title', 'author', 'publisher', 'year', 'language'];
const CHAMPS_VIDES = () => ({ title: '', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] });

export const nettoyerIsbn = (s) => String(s || '').replace(/[^0-9Xx]/g, '');
const borner = (s) => (s == null ? '' : String(s).slice(0, LIMITES_ISBN.champ));
const annee = (s) => { const m = String(s || '').match(/\b(\d{4})\b/); return m ? parseInt(m[1], 10) : null; };

// S1 : un corps distant est lu EN FLUX et la lecture est COUPÉE (reader.cancel()) dès que le cumul dépasse la borne —
// rien de ce qui a été lu n'est conservé, et le reste du corps n'est jamais tiré. Une réponse sans `body` (vieux
// navigateur, réponse factice d'un test) rend `false` : l'appelant replie alors sur r.text() / r.blob() et contrôle
// la taille réelle. Une seule fonction pour les deux corps distants du lot (métadonnées JSON et octets d'image).
export async function lireBornee(r, maxOctets) {
  if (!r?.body || typeof r.body.getReader !== 'function') return false;
  const lecteur = r.body.getReader();
  const morceaux = [];
  let octets = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    octets += value?.byteLength || 0;
    if (octets > maxOctets) { await lecteur.cancel(); return null; } // le morceau fautif n'est même pas gardé
    morceaux.push(value);
  }
  return morceaux;
}

// Délai borné (C9/S11) : AbortSignal.timeout n'existe pas partout (Safari < 16) et peut lever. Son absence ne doit
// pas emporter l'identification : repli sur un AbortController + setTimeout, qui abandonne à la même seconde.
export function signalDelai(ms) {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  } catch { /* repli ci-dessous */ }
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), ms);
  return ctl.signal;
}

async function lireJson(fetchFn, url, signal) {
  const r = await fetchFn(url, { ...OPTIONS_FETCH, signal });
  if (!r.ok) return null;
  const morceaux = await lireBornee(r, LIMITES_ISBN.corps);
  if (morceaux === null) return null; // S1 : borne dépassée, corps abandonné AVANT JSON.parse
  const texte = morceaux === false ? await r.text() : await new Blob(morceaux).text();
  if (texte.length > LIMITES_ISBN.corps) return null;
  return JSON.parse(texte);
}

// Les deux appels sont dans un try : un échec réseau, un 404, un 429 ou le délai donnent { fiche: null, source: null }.
export async function lookupIsbn(isbn, { fetch = globalThis.fetch, signal } = {}) {
  const cle = encodeURIComponent(isbn); // RF-m6 : défense en profondeur (nettoyerIsbn ne laisse que chiffres et X)
  try {
    const data = await lireJson(fetch, `https://openlibrary.org/api/books?bibkeys=ISBN:${cle}&format=json&jscmd=data`, signal);
    const b = data?.[`ISBN:${isbn}`];
    if (b) return { source: 'openlibrary', fiche: { title: borner(b.title), author: borner((b.authors || []).map((a) => a.name).join(', ')), publisher: borner((b.publishers || []).map((p) => p.name).join(', ')), year: annee(b.publish_date), language: null } };
  } catch { /* continuer */ }
  try {
    const gd = await lireJson(fetch, `https://www.googleapis.com/books/v1/volumes?q=isbn:${cle}`, signal);
    const v = gd?.items?.[0]?.volumeInfo;
    if (v) return { source: 'googlebooks', fiche: { title: borner(v.title), author: borner((v.authors || []).join(', ')), publisher: borner(v.publisher), year: annee(v.publishedDate), language: v.language === 'fr' || v.language === 'en' ? v.language : null } };
  } catch { /* continuer */ }
  return { fiche: null, source: null };
}

// C2 : `language` a un défaut NON VIDE ('fr'), donc la règle « ne remplir que ce qui est vide » ne l'atteignait
// jamais — un livre anglais identifié restait « fr ». Une langue reconnue de la fiche gagne donc tant que la
// personne n'a pas touché au menu Langue elle-même (tout est étiqueté « Renseigné par … — vérifie et corrige »).
export function fusionnerFiche(champs, fiche, { langueTouchee = false } = {}) {
  const out = { ...champs };
  for (const k of ['title', 'author', 'publisher']) if (fiche?.[k] && !out[k]) out[k] = fiche[k];
  if (fiche?.year && !out.year) out.year = String(fiche.year);
  if (!langueTouchee && (fiche?.language === 'fr' || fiche?.language === 'en')) out.language = fiche.language;
  return out;
}

export const URL_COUVERTURE_OL = (isbn) => `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;

// R-UX-12 : Open Library n'envoie PAS de Content-Length (mesuré le 14 octobre 2026 : [200, 'image/jpeg'], en-tête
// absent). Sans cet en-tête, un contrôle « avant lecture » n'existe pas : le corps est donc lu EN FLUX par
// lireBornee (S1), coupé dès le dépassement. Sans flux, repli sur r.blob() et contrôle de la taille réelle.
async function corpsBorne(r, type) {
  const borne = LIMITES_COUVERTURE.octetsDistants;
  const morceaux = await lireBornee(r, borne);
  if (morceaux === null) return null;
  if (morceaux === false) {
    const blob = await r.blob();
    if (blob.size > borne) return null;
    return blob.type === type ? blob : new Blob([blob], { type });
  }
  return new Blob(morceaux, { type });
}

// Couverture reçue par ISBN (spec § 6) : Open Library seulement ; bornes AVANT décodage (S4) ; tout échec → null.
// L'ordre compte : type annoncé, puis taille annoncée quand elle existe (le corps n'est pas ouvert), puis la taille
// RÉELLE pendant la lecture, puis les dimensions lues dans l'en-tête — createImageBitmap n'est atteint qu'après,
// dans poserCouverture.
export async function recupererCouvertureParIsbn(isbn, { fetch = globalThis.fetch, signal } = {}) {
  try {
    const r = await fetch(URL_COUVERTURE_OL(isbn), { ...OPTIONS_FETCH, signal });
    if (!r.ok) return null;
    const type = String(r.headers.get('content-type') || '').split(';')[0].trim();
    if (!COVER_INPUT_MIME.includes(type)) return null;
    const annonce = parseInt(r.headers.get('content-length') || '0', 10);
    if (annonce > LIMITES_COUVERTURE.octetsDistants) return null;
    const blob = await corpsBorne(r, type);
    if (!blob) return null;
    const dims = await dimensionsImage(blob);
    if (!dims || dims.type !== type) return null; // le type annoncé doit être celui du conteneur réellement reçu
    if (dims.largeur * dims.hauteur > LIMITES_COUVERTURE.pixels) return null;
    return blob;
  } catch { return null; }
}

// Toute couverture est ré-encodée (S5/F11) puis écrite par putFile (idempotent, hors file : R58).
export async function poserCouverture(blob, { origine = 'locale', repo: r = repo, sha256 = sha256Hex } = {}) {
  const borne = origine === 'distante' ? LIMITES_COUVERTURE.octetsDistants : LIMITES_COUVERTURE.octetsLocaux;
  if (blob.size > borne) throw new ErreurImage('trop_lourde');
  if (origine === 'locale' && blob.type && !ALLOWED_MIME.includes(blob.type)) throw new ErreurImage('type');
  // S2 : le mur de pixels valait pour une couverture REÇUE (recupererCouvertureParIsbn le pose avant de rendre le
  // blob), pas pour une image choisie ici — une bombe de décompression de 20 000 × 20 000 allait droit à
  // createImageBitmap. Les dimensions sont lues dans l'EN-TÊTE, sans décodage. Un en-tête illisible (HEIC, que
  // Safari décode et que ce lecteur ne connaît pas) ne bloque rien : le ré-encodage tranchera.
  if (origine === 'locale') {
    const dims = await dimensionsImage(blob);
    if (dims && dims.largeur * dims.hauteur > LIMITES_COUVERTURE.pixels) throw new ErreurImage('trop_grande');
  }
  const jpeg = await reduireImage(blob);
  const empreinte = await sha256(jpeg);
  await r.putFile(empreinte, jpeg, { mime: 'image/jpeg' });
  return { sha256: empreinte, taille: jpeg.size };
}

// Un refus d'image, dit du côté de la personne (I-B) : chaque cause a sa phrase, et une cause inconnue ne se
// déguise pas en « trop lourde ».
export function messageErreurImage(e) {
  if (e?.code === 'trop_lourde') return t('Cette image est trop lourde (25 Mo au plus).');
  if (e?.code === 'trop_grande') return t('Cette image est trop grande.');
  return t('Cette image ne peut pas être lue ici. Essaie une autre photo.');
}

// R-UX-8 : aucun groupe de boutons dans un <label> — un clic sur le mot « Couverture » déclencherait « Photographier ».
// L'état est dit tel qu'il est (I-B) : le message vient d'un fait (reçue, enregistrée, refusée), jamais d'une attente.
export function renderZoneCouverture(etat, gestes = {}) {
  const g = (nom) => () => (typeof gestes[nom] === 'function' ? gestes[nom]() : undefined);
  return el('div', { class: 'field zone-couverture' }, el('span', null, t('Couverture')),
    el('div', { class: 'row' },
      etat.apercu ? el('img', { src: etat.apercu, alt: '' }) : null,
      el('div', { class: 'stack' },
        etat.message ? el('small', { class: 'muted' }, etat.message) : null,
        el('div', { class: 'row' },
          el('button', { type: 'button', class: 'btn', disabled: !!etat.enCours, onClick: g('photographier') }, t('Photographier')),
          el('button', { type: 'button', class: 'btn', disabled: !!etat.enCours, onClick: g('choisir') }, t('Choisir une image')),
          etat.sha256 ? el('button', { type: 'button', class: 'btn link', disabled: !!etat.enCours, onClick: g('retirer') }, t('Retirer')) : null))));
}

export function livreAjoutModel({ pas = 1, isbn = '', champs = {}, provenance = null, recherche = false, lecteurDisponible = true, enCours = false } = {}) {
  const c = { ...CHAMPS_VIDES(), ...champs };
  const provenanceMessage = provenance === 'openlibrary' ? t('Renseigné par Open Library — vérifie et corrige.')
    : provenance === 'googlebooks' ? t('Renseigné par Google Books — vérifie et corrige.')
    : provenance === 'aucune' ? t('Aucune fiche trouvée pour cet ISBN. Complète à la main.') : null;
  return { pas, isbn, champs: c, provenance, recherche, lecteurDisponible, enCours, peutEnregistrer: pas === 2 && !!c.title.trim() && !recherche && !enCours,
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
      // RF-m8 : pendant « Recherche… », le champ est fermé comme les boutons — taper un autre ISBN dans un champ
      // actif pendant qu'un appel est en vol ferait croire que la réponse qui arrive est celle du nouvel ISBN.
      field(t('ISBN'), el('input', { type: 'text', name: 'isbn', inputmode: 'numeric', placeholder: '978…', value: model.isbn, disabled: !!model.recherche, onInput: (e) => g('changerIsbn')(e.target.value) })),
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
    model.isbn ? el('div', { class: 'row' }, el('span', { class: 'muted' }, `${t('ISBN')} ${model.isbn}`), el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN'))) : el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN')),
    field(t('Titre *'), inp('title')),
    field(t('Auteur / chef'), inp('author')),
    field(t('Langue du livre'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'other', label: t('Autre') }], c.language, (v) => g('changerChamp')('language', v))),
    // R-UX-8 : les puces ne vont JAMAIS dans un label — field() rend un <label>, et un clic sur « Cuisines »
    // cocherait alors la première puce. Même habillage, sans l'enveloppe qui vole le clic.
    el('div', { class: 'field' }, el('span', null, t('Cuisines')), puces),
    typeof gestes.couverture === 'function' ? gestes.couverture() : null,
    el('details', null, el('summary', { class: 'btn' }, t('Plus de détails')),
      el('div', { class: 'two-col', style: { marginTop: '.8rem' } },
        field(t('Éditeur'), inp('publisher')), field(t('Année'), inp('year', 'number')),
        field(t('Convention de mesure (tasses, cuillères)'), select([{ value: '', label: t('Non confirmée — à préciser plus tard') }, ...listConventions().map((x) => ({ value: x.id, label: x.labels.fr }))], c.convention, (v) => g('changerChamp')('convention', v)),
          t('La langue du livre ne suffit pas à choisir une convention. Sans convention, les tasses restent affichées telles quelles.')))),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', dataset: { role: 'enregistrer' }, disabled: !model.peutEnregistrer, onClick: g('enregistrer') }, t('Ajouter ce livre'))));
}

// R-UX-9 : `disabled` n'est posé qu'une fois, à la construction — or le pas 2 s'ouvre souvent à champs vides et le
// titre arrive FRAPPE PAR FRAPPE. Redessiner à chaque touche ferait sauter le curseur ; on ne touche donc que le
// bouton, retrouvé par son rôle. Pur et tolérant : au pas 1 ce bouton n'existe pas, et ce n'est pas une erreur.
export function majBoutonEnregistrer(zone, model) {
  const bouton = zone?.querySelector?.('[data-role="enregistrer"]');
  if (bouton) bouton.disabled = !model.peutEnregistrer;
  return bouton || null;
}

// La route : état + gestes réels, re-rendu complet à chaque changement (le formulaire est petit).
// I-H : les trois gestes du monde extérieur (écrire, naviguer, parler) sont injectables, avec les vrais par défaut —
// la charnière § 5 → § 8 (« Ajouter ce livre » → /books/<id>?nouveau=1) devient mesurable sans toucher à l'adresse.
// Le nœud rendu porte `etatRoute()` : les tests attendent un FAIT observable (un rappel de couverture entré, une
// couverture appliquée) au lieu d'un délai (F3/F4).
export async function renderLivreAjoutRoute(params, query, ctx, { repo: r = repo, navigate: nav = navigate, toast: dire = toast } = {}) {
  // `touchee` (R-UX-13) : la personne a agi sur la couverture (choisi une image, ou retiré). Une réponse distante
  // tardive ne défait jamais un geste — même si l'ISBN, lui, n'a pas changé.
  const COUVERTURE_VIDE = () => ({ sha256: null, apercu: null, message: null, enCours: false, touchee: false });
  const etat = { pas: 1, isbn: '', champs: CHAMPS_VIDES(), champsDistants: null, langueTouchee: false, provenance: null, recherche: false, enCours: false, lecteurDisponible: 'BarcodeDetector' in window, existantes: cuisinesExistantes(ctx), couverture: COUVERTURE_VIDE(), generation: 0, passagesCouverture: 0, couverturesAppliquees: 0 };
  const root = el('div', null, pageHeader(t('Ajouter un livre'), { back: { href: '/add', label: t('Ajouter') } }));
  const zone = el('div', null);
  root.append(zone);
  // C1 : chaque geste qui change ce que l'écran raconte fait avancer la GÉNÉRATION. Une demande de couverture
  // capture la sienne au départ et la revérifie après chaque `await` : « ← Changer d'ISBN » puis « Saisir à la
  // main » pendant le ré-encodage ne pouvaient pas être vus par la garde d'avant (évaluée une seule fois).
  const avancer = () => { etat.generation += 1; };
  const dessiner = () => zone.replaceChildren(renderLivreAjout({ ...livreAjoutModel(etat), existantes: etat.existantes }, gestes));
  // C3 : une seconde identification ne doit pas fusionner par-dessus les champs du PREMIER ISBN (titre A + ISBN B).
  // Tout champ encore ÉGAL à ce que le distant y avait mis est rendu : la personne ne l'a pas touché, il n'est pas
  // à elle. Ce qu'elle a corrigé reste (c'est sa saisie). `retourIsbn` ne vide rien (F23).
  const oublierDistants = () => {
    const d = etat.champsDistants;
    etat.champsDistants = null;
    if (!d) return;
    const vides = CHAMPS_VIDES();
    for (const k of CHAMPS_DISTANTS) {
      if (d[k] === undefined) continue;
      if (k === 'language' && etat.langueTouchee) continue; // son choix de langue lui appartient (C2)
      if (String(etat.champs[k] ?? '') !== String(d[k] ?? '')) continue;
      etat.champs[k] = vides[k];
    }
  };
  const identifier = async () => {
    const isbn = nettoyerIsbn(etat.isbn);
    if (!isbn) { dire(t('Saisis un ISBN d’abord.')); return; }
    // Une provenance ne survit pas à l'ISBN qui l'a produite (I-B) : la précédente tombe avant le nouvel appel.
    // R-UX-13 : la COUVERTURE non plus — c'est l'image d'un autre livre. Elle tombe ici, pas quand la réponse arrive.
    etat.provenance = null;
    etat.couverture = COUVERTURE_VIDE();
    oublierDistants();
    avancer();
    const generation = etat.generation;
    etat.recherche = true; dessiner();
    const ctl = new AbortController();
    const chrono = setTimeout(() => ctl.abort(), LIMITES_ISBN.delaiMs);
    try {
      const { fiche, source } = await lookupIsbn(isbn, { signal: ctl.signal });
      // C1/F3 : « Saisir à la main » n'est PAS fermé pendant « Recherche… » (c'est la sortie de secours). Si la
      // personne l'a prise, cette réponse n'appartient plus à l'écran : ni ses champs, ni son étiquette, ni la
      // couverture qu'elle aurait demandée. La génération le dit, la garde d'avant ne le voyait pas.
      if (etat.generation !== generation) return;
      etat.isbn = isbn;
      etat.champs = fusionnerFiche(etat.champs, fiche, { langueTouchee: etat.langueTouchee });
      etat.champsDistants = fiche ? Object.fromEntries(CHAMPS_DISTANTS.map((k) => [k, etat.champs[k]])) : null;
      etat.provenance = source || 'aucune'; etat.pas = 2;
      // La couverture suit l'identification, sans la retenir : la fiche s'affiche tout de suite, l'image arrive après
      // (ou pas). Open Library seulement — Google Books n'a pas donné cette fiche, et une image d'ailleurs ne serait
      // pas étiquetable (I-A). Même fenêtre de 10 s que l'identification (C9 : délai avec repli, jamais fatal).
      if (source === 'openlibrary') {
        const isbnDemande = isbn;
        // R-UX-13 + C1 : cette réponse appartient à SA demande. Elle n'écrit rien si la génération a avancé depuis
        // (un geste a eu lieu), si l'ISBN affiché a changé, si une couverture est déjà posée, ou si la personne a
        // agi sur la zone. Relue APRÈS chaque `await` : le ré-encodage dure, et un geste peut tomber pendant.
        const pertinent = () => etat.generation === generation && etat.isbn === isbnDemande && !etat.couverture.sha256 && !etat.couverture.touchee;
        recupererCouvertureParIsbn(isbn, { signal: signalDelai(LIMITES_ISBN.delaiMs) }).then(async (blob) => {
          etat.passagesCouverture += 1; // F4 : le FAIT que les tests attendent, posé avant toute garde
          if (!pertinent()) return;
          if (!blob) { etat.couverture.message = t('Aucune couverture reçue. Tu peux la photographier.'); dessiner(); return; }
          // La ligne écrite est relue pour l'aperçu : c'est la MÊME image que celle qui est gardée, et elle n'est
          // ré-encodée qu'une fois. S12 : une couverture REÇUE puis refusée ne se dit pas « aucune couverture ».
          try {
            const { sha256 } = await poserCouverture(blob, { origine: 'distante', repo: r });
            if (!pertinent()) return; // C1 : un geste pendant le ré-encodage gagne (la ligne files reste, dette S13)
            const ligne = await r.getFile(sha256);
            if (!pertinent()) return;
            etat.couverture = { ...etat.couverture, sha256, apercu: urlDeBlob(ligne.blob), message: t('Couverture reçue d’Open Library.'), enCours: false };
            etat.couverturesAppliquees += 1;
          } catch { if (!pertinent()) return; etat.couverture.message = t('La couverture reçue n’a pas pu être lue.'); }
          dessiner();
        }).catch(() => { /* une couverture n'est jamais essentielle : aucun rejet non traité, aucune carte rouge */ });
      }
    } finally { clearTimeout(chrono); etat.recherche = false; dessiner(); }
  };
  // Couverture choisie ici : bornée et ré-encodée par poserCouverture, et l'état ne dit « enregistrée » qu'APRÈS
  // l'écriture réelle (I-B). Aucun blob n'est effacé (§ 2) : une image remplacée laisse sa ligne files derrière elle.
  const depuisFichier = async (capture) => {
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture });
    if (!files.length) return;
    // R-UX-13 : dès que la personne a choisi une image, une réponse distante tardive n'a plus rien à dire ici.
    avancer();
    etat.couverture = { ...etat.couverture, touchee: true, enCours: true }; dessiner();
    try { const { sha256 } = await poserCouverture(files[0], { origine: 'locale', repo: r }); const ligne = await r.getFile(sha256); etat.couverture = { sha256, apercu: urlDeBlob(ligne.blob), message: t('Couverture enregistrée.'), enCours: false, touchee: true }; }
    // Un refus ne RETIRE pas la couverture déjà posée : seul le message change (l'écran ne perd rien de vrai).
    catch (e) { etat.couverture = { ...etat.couverture, enCours: false, message: messageErreurImage(e) }; }
    dessiner();
  };
  const gestes = {
    couverture: () => renderZoneCouverture(etat.couverture, {
      photographier: () => depuisFichier('environment'),
      choisir: () => depuisFichier(null),
      retirer: () => { avancer(); etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; dessiner(); },
    }),
    changerIsbn: (v) => { etat.isbn = v; },
    identifier,
    scanner: async () => {
      const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
      if (!files.length) return;
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
        const bmp = await createImageBitmap(files[0]);
        const code = (await detector.detect(bmp)).find((x) => /^97[89]\d{10}$/.test(x.rawValue));
        if (!code) { dire(t('Aucun ISBN lu sur cette photo.')); return; }
        etat.isbn = code.rawValue; await identifier();
      } catch { dire(t('Lecture du code-barres impossible.')); }
    },
    // R-UX-13 : une fiche saisie à la main n'a JAMAIS de couverture reçue — `touchee` ferme la porte à une réponse
    // encore en vol pour cet ISBN (le pas 1 ne montre pas la zone : elle s'y reposerait sans que personne le voie).
    saisirMain: () => { avancer(); etat.isbn = nettoyerIsbn(etat.isbn); etat.provenance = null; etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; etat.pas = 2; dessiner(); },
    changerChamp: (k, v) => { etat.champs[k] = v; if (k === 'language') etat.langueTouchee = true; majBoutonEnregistrer(zone, livreAjoutModel(etat)); },
    basculerCuisine: (v) => { etat.champs.cuisines = basculerPuce(etat.champs.cuisines, v); dessiner(); },
    ajouterCuisine: (v) => { const apres = ajouterPuce(etat.champs.cuisines, v); if (apres !== etat.champs.cuisines) { etat.champs.cuisines = apres; dessiner(); } },
    // R-UX-13 : revenir changer l'ISBN abandonne la couverture de l'ancien — et `touchee` empêche la réponse encore
    // en vol de la reposer en coulisse (le pas 1 ne montre pas la zone). L'`identifier` suivant repart d'un
    // COUVERTURE_VIDE() neuf, donc `touchee` retombe et la couverture du nouvel ISBN est bien demandée.
    retourIsbn: () => { avancer(); etat.pas = 1; etat.provenance = null; etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; dessiner(); },
    // Une écriture refusée ne s'annonce pas (I-B) : on reste au pas 2, la saisie est intacte, et c'est dit.
    // `enCours` ferme le bouton pendant l'écriture : deux tapes pressées ne font pas deux livres.
    enregistrer: async () => {
      if (!livreAjoutModel(etat).peutEnregistrer) return;
      etat.enCours = true;
      majBoutonEnregistrer(zone, livreAjoutModel(etat));
      let edition;
      try {
        edition = await enregistrerLivre({ champs: etat.champs, isbn: etat.isbn, coverSha256: etat.couverture?.sha256 || null }, { repo: r });
      } catch (e) {
        etat.enCours = false;
        majBoutonEnregistrer(zone, livreAjoutModel(etat));
        logError('livre.enregistrer', { error: e });
        dire(t('Le livre n’a pas pu être enregistré. Réessaie.'));
        return;
      }
      dire(t('Livre ajouté'));
      nav(`/books/${encodeURIComponent(edition.id)}?nouveau=1`);
    },
  };
  // Les tests lisent l'état par là (F3/F4) : un fait observable, jamais un délai. Aucune vue ne s'en sert.
  root.etatRoute = () => ({ ...etat, couverture: { ...etat.couverture }, champs: { ...etat.champs } });
  dessiner();
  return root;
}
