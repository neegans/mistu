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
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes, motsClesExistants, suggestionsModel, renderSuggestions, normaliser, LIMITES_PUCES } from './puces.js';
import { GOOGLE_BOOKS } from '../sync/config.js';
import { nettoyerIsbn, validerIsbn, codeBarresVersIsbn } from '../core/isbn.js';

export const LIMITES_ISBN = { champ: 300, corps: 256 * 1024, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 };
export const OPTIONS_FETCH = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };
// Les champs qu'une fiche distante peut remplir : ce qu'`identifier` doit pouvoir REPRENDRE à l'ISBN suivant (C3).
export const CHAMPS_DISTANTS = ['title', 'author', 'publisher', 'year', 'language'];
const CHAMPS_VIDES = () => ({ title: '', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [], tags: [] });

export { nettoyerIsbn };
// S3/S6 : une chaîne seulement, sans caractères de contrôle (Cc) ni de format (Cf : bidi…), ni les séparateurs de
// ligne U+2028/U+2029 (catégories Zl/Zp, nommés à part — R-ISBN-1), tronquée à 300. Tout ce qui n'est pas une
// chaîne vaut ''. Troncature par POINTS DE CODE : une paire de substitution coupée laisserait une demi-paire que le
// jsonb refuse (quarantaine de synchro).
const borner = (s) => (typeof s === 'string' ? Array.from(s.replace(/[\p{Cc}\p{Cf}\u{2028}\u{2029}]/gu, '')).slice(0, LIMITES_ISBN.champ).join('') : '');
const chaines = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
// S1 (vague /verify) : jamais String() sur une valeur reçue — un objet au toString hostile ({"toString":1}) lève
// « Cannot convert object to primitive value ». Un nombre doit être un entier de quatre chiffres ; une chaîne est lue.
const annee = (s) => {
  if (typeof s === 'number') return Number.isInteger(s) && s >= 1000 && s <= 9999 ? s : null;
  if (typeof s !== 'string') return null;
  const m = s.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1], 10) : null;
};
const langueDe = (liste) => (!Array.isArray(liste) ? null : liste.includes('fre') ? 'fr' : liste.includes('eng') ? 'en' : null);
const ficheOk = (f) => (f && f.title ? f : null);
// § 12.2 : des PROPOSITIONS de mots-clés — 10 au plus, tronquées à la borne des puces, dédoublonnées par normaliser.
// Jamais posées sans la tape de la personne : fusionnerFiche ne les lit pas.
export const MOTS_CLES_MAX = 10;
const motsClesDe = (liste) => {
  const vus = new Map();
  for (const v of chaines(liste)) {
    // R-ISBN-6 : les sujets techniques d'Open Library (« series:Harry_Potter », « nyt:hardcover_nonfiction=… »)
    // ne sont pas des mots-clés — écartés AVANT le plafond, pour ne pas manger les dix places.
    if (/[:=]/.test(borner(v).trim())) continue;
    const valeur = Array.from(borner(v)).slice(0, LIMITES_PUCES.longueur).join('').trim();
    const cle = normaliser(valeur);
    if (cle && !vus.has(cle)) vus.set(cle, valeur);
    if (vus.size >= MOTS_CLES_MAX) break;
  }
  return [...vus.values()];
};

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

// Attente abandonnable : rend tout de suite si le signal est déjà abandonné, et dès qu'il l'est.
export const attenteReelle = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) { resolve(); return; }
  const fin = () => { clearTimeout(id); signal?.removeEventListener('abort', fin); resolve(); };
  const id = setTimeout(fin, ms);
  signal?.addEventListener('abort', fin, { once: true });
});

const URL_OL_SEARCH = (isbn) => `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=title,author_name,publisher,first_publish_year,language,subject&limit=1`;
const URL_OL_LEGACY = (isbn) => `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
const URL_GOOGLE = (isbn, cle) => `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1&key=${encodeURIComponent(cle)}`;
// § 7 : une clé restreinte par référent exige un Referer ; strict-origin envoie l'ORIGINE seule (jamais le chemin ni
// le #), et rien sur un déclassement HTTPS → HTTP. Google Books est le seul appel qui s'écarte de no-referrer (S12).
const OPTIONS_GOOGLE = { ...OPTIONS_FETCH, referrerPolicy: 'strict-origin' };
function lireGoogle(json) {
  if (!json || typeof json !== 'object') return { repondu: false };
  const items = json.items;
  const v = Array.isArray(items) && items[0] && typeof items[0] === 'object' ? items[0].volumeInfo : null;
  if (!v || typeof v !== 'object') return { repondu: true, fiche: null };
  return { repondu: true, fiche: ficheOk({ title: borner(v.title).trim(), author: borner(chaines(v.authors).join(', ')), publisher: borner(v.publisher), year: annee(v.publishedDate), language: v.language === 'fr' || v.language === 'en' ? v.language : null, motsCles: motsClesDe(v.categories) }) };
}

// Une tentative = un budget (S4) : son AbortController couvre le fetch ET la lecture du corps ; il est relié au signal
// extérieur par un écouteur retiré en finally. Rend { ok: true, json } ou { ok: false, motif }. Ordre du classement
// (F14) : signal de la tentative abandonné → delai ; rejet → reseau ; 429 → limite ; autre non-2xx → serveur ;
// corps trop gros (lireBornee, S1) ou non JSON → serveur.
async function tentative(fetchFn, url, options, { tentativeMs, signal }) {
  const ctl = new AbortController();
  const chrono = setTimeout(() => ctl.abort(), tentativeMs);
  const relais = () => ctl.abort();
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', relais, { once: true }); }
  const echec = () => ({ ok: false, motif: ctl.signal.aborted ? 'delai' : 'reseau' });
  try {
    let r;
    try { r = await fetchFn(url, { ...options, signal: ctl.signal }); } catch { return echec(); }
    if (r.status === 429) return { ok: false, motif: 'limite' };
    if (!r.ok) return { ok: false, motif: 'serveur' };
    let texte;
    try {
      const morceaux = await lireBornee(r, LIMITES_ISBN.corps);
      if (morceaux === null) return { ok: false, motif: 'serveur' };
      texte = morceaux === false ? await r.text() : await new Blob(morceaux).text();
    } catch { return echec(); }
    if (typeof texte !== 'string' || texte.length > LIMITES_ISBN.corps) return { ok: false, motif: 'serveur' };
    try { return { ok: true, json: JSON.parse(texte) }; } catch { return { ok: false, motif: 'serveur' }; }
  } finally { clearTimeout(chrono); signal?.removeEventListener('abort', relais); }
}

// Lecteurs : { repondu: true, fiche | null } si la forme est celle attendue, { repondu: false } sinon (→ serveur).
function lireSearch(json) {
  const docs = json?.docs;
  if (!Array.isArray(docs)) return { repondu: false };
  const d = docs[0];
  if (!d || typeof d !== 'object') return { repondu: true, fiche: null };
  return { repondu: true, fiche: ficheOk({ title: borner(d.title).trim(), author: borner(chaines(d.author_name).join(', ')), publisher: borner(chaines(d.publisher)[0]), year: annee(d.first_publish_year), language: langueDe(d.language), motsCles: motsClesDe(d.subject) }) };
}
const noms = (liste) => (Array.isArray(liste) ? liste.map((x) => (typeof x?.name === 'string' ? x.name : '')).filter(Boolean) : []);
function lireLegacy(json, isbn) {
  if (!json || typeof json !== 'object') return { repondu: false };
  const b = json[`ISBN:${isbn}`];
  if (!b || typeof b !== 'object') return { repondu: true, fiche: null };
  return { repondu: true, fiche: ficheOk({ title: borner(b.title).trim(), author: borner(noms(b.authors).join(', ')), publisher: borner(noms(b.publishers).join(', ')), year: annee(b.publish_date), language: null, motsCles: motsClesDe(noms(b.subjects)) }) };
}

// Trois issues (spec § 5) : trouve / introuvable (Open Library a répondu « rien ») / indisponible (motif). Étape 1 :
// search.json, une reprise sur échec muet (I-R). Étape 2 : legacy api/books, seulement après un « rien ». Étape 3
// (tâche 3) : Google Books, seulement avec une clé et après un « rien ». Jamais d'exception pour un échec de source ;
// une TypeError seulement pour un appelant qui ne passe pas un ISBN-13 (S9).
export async function lookupIsbn(isbn13, { fetch = globalThis.fetch, signal, cle = '', attendre = attenteReelle, surReprise = null, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = {}) {
  if (!/^97[89]\d{10}$/.test(String(isbn13))) throw new TypeError('lookupIsbn : ISBN-13 attendu');
  const bilan = { statut: 'indisponible', fiche: null, source: null, motif: null, google: 'non_appele', appels: 0 };
  const appel = async (url, options) => { bilan.appels += 1; return tentative(fetch, url, options, { tentativeMs, signal }); };
  const trouve = (fiche, source) => ({ ...bilan, statut: 'trouve', fiche, source });
  const abandonne = () => ({ ...bilan, motif: 'delai' });
  let r1 = null;
  for (let essai = 0; essai < 2; essai += 1) {
    if (signal?.aborted) return abandonne();
    if (essai === 1) {
      if (typeof surReprise === 'function') surReprise();
      await attendre(repriseMs, signal);
      if (signal?.aborted) return abandonne();
    }
    r1 = await appel(URL_OL_SEARCH(isbn13), OPTIONS_FETCH);
    if (r1.ok) break;
    const muet = (r1.motif === 'reseau' || r1.motif === 'delai') && !signal?.aborted;
    if (!muet) break;
  }
  if (!r1.ok) return { ...bilan, motif: r1.motif };
  const lu1 = lireSearch(r1.json);
  if (!lu1.repondu) return { ...bilan, motif: 'serveur' };
  if (lu1.fiche) return trouve(lu1.fiche, 'openlibrary');
  // Étape 2 : Open Library a répondu « rien » → le statut est acquis ; le legacy ne peut que trouver.
  if (signal?.aborted) return { ...bilan, statut: 'introuvable' };
  const r2 = await appel(URL_OL_LEGACY(isbn13), OPTIONS_FETCH);
  const lu2 = r2.ok ? lireLegacy(r2.json, isbn13) : null;
  if (lu2?.fiche) return trouve(lu2.fiche, 'openlibrary');
  // Étape 3 : Google Books, avec clé seulement, et seulement après un « rien » d'Open Library (jamais après un échec).
  if (!cle) return { ...bilan, statut: 'introuvable' };
  if (signal?.aborted) return { ...bilan, statut: 'introuvable', google: 'echec' };
  const r3 = await appel(URL_GOOGLE(isbn13, cle), OPTIONS_GOOGLE);
  const lu3 = r3.ok ? lireGoogle(r3.json) : null;
  if (lu3?.fiche) return { ...trouve(lu3.fiche, 'googlebooks'), google: 'trouve' }; // C4 : Google a donné la fiche
  return { ...bilan, statut: 'introuvable', google: lu3?.repondu ? 'rien' : 'echec' };
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
  if (!/^97[89]\d{10}$/.test(String(isbn))) return null; // S5 : comme lookupIsbn (S9), rien ne part sans un ISBN-13
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

export function livreAjoutModel({ pas = 1, isbn = '', champs = {}, provenance = null, recherche = false, reprise = false, validation = null, resultat = null, suggestions = null, cleGoogle = false, lecteurDisponible = true, enCours = false } = {}) {
  const c = { ...CHAMPS_VIDES(), ...champs };
  const google = resultat?.google || 'non_appele';
  const provenanceMessage = provenance === 'openlibrary' ? t('Renseigné par Open Library — vérifie et corrige.')
    : provenance === 'googlebooks' ? t('Renseigné par Google Books — vérifie et corrige.')
    : provenance === 'aucune' ? (google === 'rien' ? t('Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main.')
      : google === 'echec' ? t('Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la main.')
      : t('Aucune fiche chez Open Library pour cet ISBN. Complète à la main.')) : null;
  // Tables fermées, lues par hasOwn : un motif inconnu (ou hostile, « __proto__ ») retombe sur un texte sûr (S12).
  const INDISPONIBLE = { delai: t('Open Library n’a pas répondu à temps.'), reseau: t('Impossible de joindre Open Library. Vérifie ta connexion.'), limite: t('Open Library reçoit trop de demandes en ce moment. Attends quelques secondes.'), serveur: t('Open Library est en panne pour le moment.'), horsligne: t('Tu es hors ligne.') };
  const VALIDATION = { longueur: t('Cet ISBN n’est pas valide, vérifie les chiffres.'), controle: t('Cet ISBN n’est pas valide, vérifie les chiffres.'), pas_isbn: t('Ce numéro n’est pas un ISBN : il doit commencer par 978 ou 979.') }; // C2 : seul le clavier produit ce motif
  const lire = (table, cle, repli) => (typeof cle === 'string' && Object.hasOwn(table, cle) ? table[cle] : repli);
  const isbnValide = !isbn || validerIsbn(isbn).ok;
  const indisponible = resultat?.statut === 'indisponible' && !recherche;
  return { pas, isbn, champs: c, provenance, recherche, reprise, validation, resultat, suggestions, cleGoogle, lecteurDisponible, enCours, isbnValide,
    peutEnregistrer: pas === 2 && !!c.title.trim() && !recherche && !enCours,
    peutReessayer: indisponible,
    messages: {
      provenance: provenanceMessage,
      recherche: recherche ? (reprise ? t('Nouvel essai…') : t('Recherche…')) : null,
      lecteur: lecteurDisponible ? null : t('Le lecteur de code-barres n’est pas offert dans ce navigateur.'),
      validation: validation ? lire(VALIDATION, validation, VALIDATION.longueur) : null,
      indisponible: indisponible ? lire(INDISPONIBLE, resultat.motif, INDISPONIBLE.serveur) : null,
      sources: cleGoogle ? t('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.') : t('L’ISBN est envoyé à Open Library.'),
      rappelIsbn: isbn ? (isbnValide ? `${t('ISBN')} ${isbn}` : t('ISBN {i} — non valide, ne sera pas enregistré', { i: isbn })) : null,
    } };
}

export function fabriquerLivre({ champs, isbn, coverSha256 = null }, { newId }) {
  const v = validerIsbn(isbn);
  const c = { ...CHAMPS_VIDES(), ...champs };
  const book = { id: newId('bk'), title: c.title.trim(), author: c.author.trim(), cuisines: [...c.cuisines], tags: [...c.tags] };
  const edition = { id: newId('ed'), book_id: book.id, isbn: v.ok ? v.isbn13 : null, publisher: c.publisher.trim() || null, year: c.year ? parseInt(c.year, 10) || null : null, language: c.language || null, unit_convention_id: c.convention || null, convention_evidence: c.convention ? 'confirmed_by_user' : null, owned: true, cover_sha256: coverSha256 || null };
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
    // Entrée = Identifier (pas de <form> : un submit natif ferait naviguer le #). Répétition de touche et composition
    // IME ne déclenchent pas (S3) ; la garde d'une seule identification vit dans la route (I-G).
    const surTouche = (e) => { if (e.key !== 'Enter') return; e.preventDefault(); if (!e.repeat && !e.isComposing) g('identifier')(); };
    return el('section', { class: 'card stack livre-ajout' },
      el('p', null, t('Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.')),
      // RF-m8 : pendant « Recherche… », le champ est fermé comme les boutons — taper un autre ISBN dans un champ
      // actif pendant qu'un appel est en vol ferait croire que la réponse qui arrive est celle du nouvel ISBN.
      // R-ISBN-7 : pas d'inputmode numérique — un ISBN-10 sur onze finit par X, introuvable sur le pavé de l'iPhone.
      // C3 : maxlength 32 laisse tenir un « ISBN-13: 978-… » collé ; ce qui est GARDÉ reste borné (validerIsbn, saisirMain : 20).
      field(t('ISBN'), el('input', { type: 'text', name: 'isbn', maxlength: '32', placeholder: '978…', value: model.isbn, disabled: !!model.recherche, onInput: (e) => g('changerIsbn')(e.target.value), onKeydown: surTouche })),
      model.messages.validation ? el('small', { class: 'muted', dataset: { role: 'validation' } }, model.messages.validation) : null,
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', disabled: !model.lecteurDisponible || model.recherche, onClick: g('scanner') }, t('Scanner le code-barres')),
        el('button', { type: 'button', class: 'btn primary', disabled: model.recherche, onClick: g('identifier') }, t('Identifier')),
        el('button', { type: 'button', class: 'btn link', onClick: g('saisirMain') }, t('Saisir à la main'))),
      model.messages.lecteur ? el('small', { class: 'muted' }, model.messages.lecteur) : null,
      model.messages.recherche ? el('div', { class: 'muted' }, model.messages.recherche) : null,
      // Indisponible : le message vrai, puis UN bouton Réessayer (F17 : pas de second « Saisir à la main »).
      model.messages.indisponible ? el('div', { class: 'stack', dataset: { role: 'indisponible' } },
        el('div', { class: 'muted' }, model.messages.indisponible),
        model.peutReessayer ? el('button', { type: 'button', class: 'btn primary', dataset: { role: 'reessayer' }, onClick: g('reessayer') }, t('Réessayer')) : null) : null,
      el('small', { class: 'muted' }, model.messages.sources));
  }
  const c = model.champs;
  const inp = (k, type = 'text') => el('input', { type, value: c[k], onInput: (e) => g('changerChamp')(k, e.target.value) });
  const puces = renderPuces(pucesModel({ choisies: c.cuisines, existantes: model.existantes || [] }), { basculer: g('basculerCuisine'), ajouter: g('ajouterCuisine') });
  return el('section', { class: 'card stack livre-ajout' },
    el('p', null, t('Vérifie la fiche, puis ajoute le livre.')),
    model.messages.provenance ? el('div', { class: 'status info' }, model.messages.provenance) : null,
    model.isbn ? el('div', { class: 'row' }, el('span', { class: 'muted' }, model.messages.rappelIsbn), el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN'))) : el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN')),
    field(t('Titre *'), inp('title')),
    field(t('Auteur / chef'), inp('author')),
    field(t('Langue du livre'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'other', label: t('Autre') }], c.language, (v) => g('changerChamp')('language', v))),
    // R-UX-8 : les puces ne vont JAMAIS dans un label — field() rend un <label>, et un clic sur « Cuisines »
    // cocherait alors la première puce. Même habillage, sans l'enveloppe qui vole le clic.
    el('div', { class: 'field' }, el('span', null, t('Cuisines')), puces),
    // § 12 : mots-clés du livre — mêmes puces que les cuisines, graine vide, puis les propositions reçues (étiquetées).
    el('div', { class: 'field', dataset: { role: 'mots-cles' } }, el('span', null, t('Mots-clés')),
      renderPuces(pucesModel({ choisies: c.tags, existantes: model.existantesMotsCles || [], graine: [] }), { basculer: g('basculerMotCle'), ajouter: g('ajouterMotCle') }, { libelleAutre: t('Autre mot-clé') }),
      (() => { const s = suggestionsModel({ proposees: model.suggestions?.valeurs || [], source: model.suggestions?.source || null, choisies: c.tags }); return s ? renderSuggestions(s, { ajouter: g('ajouterMotCle') }) : null; })()),
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
export async function renderLivreAjoutRoute(params, query, ctx, { repo: r = repo, navigate: nav = navigate, toast: dire = toast, fetch = globalThis.fetch, enLigne = () => navigator.onLine !== false, attendre = attenteReelle, cle = GOOGLE_BOOKS.key, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = {}) {
  // `touchee` (R-UX-13) : la personne a agi sur la couverture (choisi une image, ou retiré). Une réponse distante
  // tardive ne défait jamais un geste — même si l'ISBN, lui, n'a pas changé.
  const COUVERTURE_VIDE = () => ({ sha256: null, apercu: null, message: null, enCours: false, touchee: false });
  const etat = { pas: 1, isbn: '', champs: CHAMPS_VIDES(), champsDistants: null, isbnDistant: null, sourceDistante: null, langueTouchee: false, provenance: null, recherche: false, enCours: false, lecteurDisponible: 'BarcodeDetector' in window, existantes: cuisinesExistantes(ctx), couverture: COUVERTURE_VIDE(), generation: 0, passagesCouverture: 0, couverturesAppliquees: 0, reprise: false, validation: null, resultat: null, suggestions: null, existantesMotsCles: motsClesExistants(ctx), reponsesRecues: 0, ctl: null };
  const root = el('div', null, pageHeader(t('Ajouter un livre'), { back: { href: '/add', label: t('Ajouter') } }));
  const zone = el('div', null);
  root.append(zone);
  // C1 : chaque geste qui change ce que l'écran raconte fait avancer la GÉNÉRATION. Une demande de couverture
  // capture la sienne au départ et la revérifie après chaque `await` : « ← Changer d'ISBN » puis « Saisir à la
  // main » pendant le ré-encodage ne pouvaient pas être vus par la garde d'avant (évaluée une seule fois).
  const avancer = () => { etat.generation += 1; };
  // Le modèle de la route : la phrase des sources suit la clé RÉELLEMENT passée (cleGoogle), et les puces lisent
  // les cuisines et mots-clés déjà employés. Toute lecture du modèle passe par ici (jamais le modèle nu de l'état).
  const modele = () => ({ ...livreAjoutModel({ ...etat, cleGoogle: !!cle }), existantes: etat.existantes, existantesMotsCles: etat.existantesMotsCles });
  const dessiner = () => zone.replaceChildren(renderLivreAjout(modele(), gestes));
  // C3 : une seconde identification ne doit pas fusionner par-dessus les champs du PREMIER ISBN (titre A + ISBN B).
  // Tout champ encore ÉGAL à ce que le distant y avait mis est rendu : la personne ne l'a pas touché, il n'est pas
  // à elle. Ce qu'elle a corrigé reste (c'est sa saisie). `retourIsbn` ne vide rien (F23).
  const oublierDistants = () => {
    const d = etat.champsDistants;
    etat.champsDistants = null; etat.isbnDistant = null; etat.sourceDistante = null;
    if (!d) return;
    const vides = CHAMPS_VIDES();
    for (const k of CHAMPS_DISTANTS) {
      if (d[k] === undefined) continue;
      if (k === 'language' && etat.langueTouchee) continue; // son choix de langue lui appartient (C2)
      if (String(etat.champs[k] ?? '') !== String(d[k] ?? '')) continue;
      etat.champs[k] = vides[k];
    }
  };
  // I-G : tout geste qui change l'ISBN ou le pas ferme la porte aux réponses en vol (avancer, C1) ET libère la recherche.
  // R-ISBN-8 : la requête en vol est aussi ABANDONNÉE (le réseau est libéré, pas seulement la réponse rendue muette).
  // `depuisFichier` et `retirer` appellent avancer() seul et ne touchent pas `recherche` : la zone de couverture
  // n'existe qu'au pas 2, et `recherche` n'est vraie qu'au pas 1.
  const nouvelleGeneration = () => { etat.ctl?.abort(); etat.ctl = null; avancer(); etat.recherche = false; etat.reprise = false; etat.validation = null; etat.resultat = null; etat.suggestions = null; };
  const identifier = async ({ forcer = false } = {}) => {
    if (etat.recherche) return; // I-G : une identification à la fois (Entrée, Réessayer et le clic passent tous ici)
    const v = validerIsbn(etat.isbn);
    if (!v.ok) {
      if (v.motif === 'vide') { dire(t('Saisis un ISBN d’abord.')); return; }
      etat.validation = v.motif; etat.resultat = null; dessiner(); return; // aucun appel (R-ISBN-2) ; un « indisponible » d'avant ne reste pas affiché
    }
    etat.validation = null; etat.isbn = v.isbn13;
    if (!forcer && !enLigne()) { etat.resultat = { statut: 'indisponible', motif: 'horsligne', google: 'non_appele' }; dessiner(); return; } // S13 : Réessayer force
    // Une provenance ne survit pas à l'ISBN qui l'a produite (I-B) : la précédente tombe avant le nouvel appel.
    // R-UX-13 : la COUVERTURE non plus — c'est l'image d'un autre livre. Elle tombe ici, pas quand la réponse arrive.
    // C3 (oublierDistants) avant C1 (avancer).
    etat.provenance = null; etat.couverture = COUVERTURE_VIDE(); etat.suggestions = null;
    oublierDistants();
    avancer();
    const generation = etat.generation;
    etat.recherche = true; etat.reprise = false; etat.resultat = null;
    dessiner();
    const ctl = new AbortController();
    etat.ctl = ctl; // R-ISBN-8 : nouvelleGeneration() l'abandonne
    const chrono = setTimeout(() => ctl.abort(), LIMITES_ISBN.totalMs);
    try {
      const res = await lookupIsbn(v.isbn13, { fetch, signal: ctl.signal, cle, attendre, tentativeMs, repriseMs, surReprise: () => { if (etat.generation === generation) { etat.reprise = true; dessiner(); } } });
      etat.reponsesRecues += 1; // le FAIT que les tests attendent (une réponse est arrivée), posé avant la garde de génération
      // C1/F3 : « Saisir à la main » n'est PAS fermé pendant « Recherche… » (c'est la sortie de secours). Si la
      // personne l'a prise, cette réponse n'appartient plus à l'écran : ni ses champs, ni son étiquette, ni la
      // couverture qu'elle aurait demandée. La génération le dit (I-G).
      if (etat.generation !== generation) return;
      if (res.statut === 'trouve') {
        const avantFusion = { ...etat.champs };
        etat.champs = fusionnerFiche(etat.champs, res.fiche, { langueTouchee: etat.langueTouchee });
        // C3 : ne sont « distants » que les champs que la fusion a RÉELLEMENT repris de la fiche — mesurés avant et
        // après. Mémoriser l'état d'après fusion faisait passer pour distant un titre tapé AVANT la première
        // identification (`fusionnerFiche` le garde parce qu'il n'est pas vide), et l'identification suivante le
        // vidait. Une valeur identique à ce que la personne avait déjà tapé n'est pas reprise non plus : c'est aussi
        // la sienne.
        const reprises = CHAMPS_DISTANTS.filter((k) => String(avantFusion[k] ?? '') !== String(etat.champs[k] ?? ''));
        etat.champsDistants = reprises.length ? Object.fromEntries(reprises.map((k) => [k, etat.champs[k]])) : null;
        // C1 (vague /verify) : l'ISBN et la source de ces champs, pour que « Saisir à la main » sache s'ils lui appartiennent encore.
        etat.isbnDistant = etat.champsDistants ? v.isbn13 : null; etat.sourceDistante = etat.champsDistants ? res.source : null;
        etat.provenance = res.source; etat.pas = 2;
        etat.suggestions = res.fiche.motsCles?.length ? { source: res.source, valeurs: res.fiche.motsCles } : null; // § 12.2 : propositions, jamais posées
        const isbn = v.isbn13;
        const source = res.source;
        // La couverture suit l'identification, sans la retenir : la fiche s'affiche tout de suite, l'image arrive après
        // (ou pas). Open Library seulement — Google Books n'a pas donné cette fiche, et une image d'ailleurs ne serait
        // pas étiquetable (I-A). Même fenêtre de 10 s que l'identification (C9 : délai avec repli, jamais fatal).
        if (source === 'openlibrary') {
          const isbnDemande = isbn;
          // R-UX-13 + C1 : cette réponse appartient à SA demande. Elle n'écrit rien si la génération a avancé depuis
          // (un geste a eu lieu), si l'ISBN affiché a changé, si une couverture est déjà posée, ou si la personne a
          // agi sur la zone. Relue APRÈS chaque `await` : le ré-encodage dure, et un geste peut tomber pendant.
          const pertinent = () => etat.generation === generation && etat.isbn === isbnDemande && !etat.couverture.sha256 && !etat.couverture.touchee;
          recupererCouvertureParIsbn(v.isbn13, { fetch, signal: signalDelai(LIMITES_ISBN.delaiMs) }).then(async (blob) => {
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
      } else if (res.statut === 'introuvable') { etat.provenance = 'aucune'; etat.resultat = res; etat.pas = 2; }
      else { etat.resultat = res; } // indisponible : on reste au pas 1, ISBN conservé, Réessayer offert
    } catch (e) {
      // S1 (vague /verify) : filet — lookupIsbn ne doit jamais lever, mais si elle le fait l'écran ne reste pas muet.
      if (etat.generation === generation) { etat.resultat = { statut: 'indisponible', motif: 'serveur', google: 'non_appele' }; logError('livre.identifier', { error: e }); }
    } finally {
      clearTimeout(chrono);
      // Une génération plus récente a sa propre recherche : seule la génération courante la libère et redessine.
      if (etat.generation === generation) { etat.ctl = null; etat.recherche = false; etat.reprise = false; dessiner(); }
    }
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
    identifier: () => identifier(),
    reessayer: () => identifier({ forcer: true }),
    scanner: async () => {
      // C5 (vague /verify) : la photo et la lecture prennent du temps ; un geste pendant ce temps (« Saisir à la main »,
      // « ← Changer d'ISBN », une identification tapée) l'emporte sur le code lu après coup (I-G).
      const gen = etat.generation, pas = etat.pas;
      const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
      if (!files.length) return;
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
        const bmp = await createImageBitmap(files[0]);
        const code = codeBarresVersIsbn(await detector.detect(bmp));
        if (etat.generation !== gen || etat.pas !== pas || etat.recherche) return; // I-G : génération, pas et recherche relus après detect
        if (!code) { dire(t('Aucun ISBN lu sur cette photo.')); return; }
        etat.isbn = code; await identifier();
      } catch { dire(t('Lecture du code-barres impossible.')); }
    },
    // R-UX-13 : une fiche saisie à la main n'a JAMAIS de couverture reçue — `touchee` ferme la porte à une réponse
    // encore en vol pour cet ISBN (le pas 1 ne montre pas la zone : elle s'y reposerait sans que personne le voie).
    // C1 (vague /verify) : « ← Changer d'ISBN » garde les champs reçus (F23). S'ils ont été reçus pour CET ISBN, ils sont
    // encore ceux d'Open Library / Google Books : les champs ET leur étiquette restent. Sous un autre ISBN (ou un ISBN
    // invalide), ils appartiennent à un autre livre : oublierDistants() rend ce qui n'a pas été touché, et rien n'est étiqueté.
    saisirMain: () => {
      nouvelleGeneration();
      const v = validerIsbn(etat.isbn);
      const memeIsbn = !!etat.champsDistants && v.ok && v.isbn13 === etat.isbnDistant;
      if (memeIsbn) etat.provenance = etat.sourceDistante;
      else { oublierDistants(); etat.provenance = null; }
      etat.isbn = v.ok ? v.isbn13 : nettoyerIsbn(etat.isbn).slice(0, 20); // affiché = enregistré quand valide ; borné sinon (S8/F22)
      etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; etat.pas = 2; dessiner();
    },
    changerChamp: (k, v) => { etat.champs[k] = v; if (k === 'language') etat.langueTouchee = true; majBoutonEnregistrer(zone, modele()); },
    basculerCuisine: (v) => { etat.champs.cuisines = basculerPuce(etat.champs.cuisines, v); dessiner(); },
    ajouterCuisine: (v) => { const apres = ajouterPuce(etat.champs.cuisines, v); if (apres !== etat.champs.cuisines) { etat.champs.cuisines = apres; dessiner(); } },
    // R-UX-13 : revenir changer l'ISBN abandonne la couverture de l'ancien — et `touchee` empêche la réponse encore
    // en vol de la reposer en coulisse (le pas 1 ne montre pas la zone). L'`identifier` suivant repart d'un
    // COUVERTURE_VIDE() neuf, donc `touchee` retombe et la couverture du nouvel ISBN est bien demandée.
    retourIsbn: () => { nouvelleGeneration(); etat.pas = 1; etat.provenance = null; etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; dessiner(); },
    basculerMotCle: (v) => { etat.champs.tags = basculerPuce(etat.champs.tags, v); dessiner(); },
    ajouterMotCle: (v) => { const apres = ajouterPuce(etat.champs.tags, v); if (apres !== etat.champs.tags) { etat.champs.tags = apres; dessiner(); } },
    // Une écriture refusée ne s'annonce pas (I-B) : on reste au pas 2, la saisie est intacte, et c'est dit.
    // `enCours` ferme le bouton pendant l'écriture : deux tapes pressées ne font pas deux livres.
    enregistrer: async () => {
      if (!modele().peutEnregistrer) return;
      etat.enCours = true;
      majBoutonEnregistrer(zone, modele());
      let edition;
      try {
        edition = await enregistrerLivre({ champs: etat.champs, isbn: etat.isbn, coverSha256: etat.couverture?.sha256 || null }, { repo: r });
      } catch (e) {
        etat.enCours = false;
        majBoutonEnregistrer(zone, modele());
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
