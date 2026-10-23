// « Ajouter un livre » en deux pas (spec UX § 5) : identifier (ISBN scanné, tapé, ou saisie à la main), puis compléter.
// Ce qui vient d'Open Library / Google Books est ÉTIQUETÉ et borné (I-A, I-G) ; l'écriture passe par repo.saveBatch (I-D).
import { el, toast, pickFiles } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { logError } from '../core/log.js';
import { navigate } from '../core/router.js';
import * as repo from '../model/repo.js';
import { sha256Hex } from '../core/hash.js';
import { COVER_INPUT_MIME } from '../sync/mime.js';
import { LIMITES_COUVERTURE, dimensionsImage, reduireImage, preparerPhotoLocale, ErreurImage, messageErreurImage } from '../core/image.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, field, select, sessionAssistant, carteConnexion } from './components.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes, motsClesExistants, suggestionsModel, renderSuggestions, normaliser, LIMITES_PUCES } from './puces.js';
import { GOOGLE_BOOKS } from '../sync/config.js';
import { nettoyerIsbn, validerIsbn, codeBarresVersIsbn } from '../core/isbn.js';
import { TransitionRefusee } from '../core/db.js';
import { demarrerConnexion } from './settings.js';
import { lancerLectureCouverture, annulerVol, volEnCours, DOCUMENT_ID, texteEchec, cleLecture } from './import-cible.js';
import { RAISONS_ECHEC } from '../domain/import-cible.js';
import { validerLectureCouverture } from '../domain/llm.js';
import { isbnUnique, shaBornee, fabriquerImportCouverture, champsDepuisLecture, ficheDepuisProposition, ficheSelonIsbn, choisirProposition } from '../domain/couverture.js';
import { IMPORTS_TERMINES } from '../model/schema.js';
export { messageErreurImage }; // déplacée dans core/image.js (lot E) : book.js et regroupement.js (lot D) l'importent toujours d'ici

export const LIMITES_ISBN = { champ: 300, corps: 256 * 1024, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 };
import { borner as bornerCore, lireBornee, signalDelai, OPTIONS_FETCH } from '../core/bornes.js';
export { lireBornee, signalDelai, OPTIONS_FETCH }; // ré-exportés : tests/ajouter.js les lit ici
// Les champs qu'une fiche distante peut remplir : ce qu'`identifier` doit pouvoir REPRENDRE à l'ISBN suivant (C3).
export const CHAMPS_DISTANTS = ['title', 'author', 'publisher', 'year', 'language'];
const CHAMPS_VIDES = () => ({ title: '', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [], tags: [] });

export { nettoyerIsbn };
// S3/S6 : une chaîne seulement, sans caractères de contrôle (Cc) ni de format (Cf : bidi…), ni les séparateurs de
// ligne U+2028/U+2029 (catégories Zl/Zp, nommés à part — R-ISBN-1), tronquée à 300. Tout ce qui n'est pas une
// chaîne vaut ''. Troncature par POINTS DE CODE : une paire de substitution coupée laisserait une demi-paire que le
// jsonb refuse (quarantaine de synchro).
const borner = (s) => bornerCore(s, LIMITES_ISBN.champ);
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

// --- Lot E (spec couverture § 3.4) : Open Library par titre ET auteur. Mêmes `tentative`, délais, reprise et lecteurs que lookupIsbn ; une fiche
// d'ŒUVRE ne dit rien de l'édition photographiée tant que l'œuvre a plusieurs éditions (§ 3.4 : éditeur — s'il est seul —, année et langue seulement si
// edition_count === 1 ; l'ISBN de plus seulement s'il est le SEUL ISBN-13 distinct, isbnUnique. R-E-1 et D-E4 écrivent « et un seul ISBN-13 » pour les
// quatre : la lecture du § 3.4 est retenue, ronde 1, à aligner à la clôture). L'auteur est le PREMIER lu (une liste jointe cacherait la bonne fiche).
// ligneOL : borner (Cc, Cf, U+2028/2029, 300 points de code) APRÈS le retrait des demi-paires de substitution (Cs : encodeURIComponent lèverait une
// URIError, le jsonb refuserait la fiche ; ronde 1) — ici seulement, lookupIsbn ne change pas (§ 3.6).
const sansCs = (s) => (typeof s === 'string' ? s.replace(/\p{Cs}/gu, '') : s);
const ligneOL = (s) => borner(sansCs(s)).trim();
export const URL_OL_TITRE_AUTEUR = (titre, auteur) => `https://openlibrary.org/search.json?title=${encodeURIComponent(titre)}&author=${encodeURIComponent(auteur)}&fields=title,author_name,publisher,first_publish_year,language,subject,isbn,edition_count&limit=3`;
export function lireSearchListe(json) {
  const docs = json?.docs;
  if (!Array.isArray(docs)) return { repondu: false };
  const fiches = [];
  for (const d of docs) {
    if (fiches.length >= 3) break;
    if (!d || typeof d !== 'object' || typeof d.title !== 'string' || !ligneOL(d.title)) continue;
    const authors = chaines(d.author_name).map(ligneOL).filter(Boolean);
    const editionUnique = d.edition_count === 1;
    const editeurs = chaines(d.publisher);
    fiches.push({ title: ligneOL(d.title), authors, author: borner(authors.join(', ')),
      publisher: editionUnique && editeurs.length === 1 ? ligneOL(editeurs[0]) : '', year: editionUnique ? (annee(d.first_publish_year) ?? '') : '',
      language: editionUnique ? langueDe(d.language) : null, motsCles: motsClesDe(chaines(d.subject).map(sansCs)), isbn13: editionUnique ? isbnUnique(d.isbn) : null, editionUnique });
  }
  return { repondu: true, fiches };
}
export async function chercherParTitreAuteur(titre, auteur, { fetch = globalThis.fetch, signal, attendre = attenteReelle, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = {}) {
  const t0 = ligneOL(titre); // pas une chaîne → '' (borner)
  const a0 = ligneOL(auteur);
  if (!t0 || !a0) throw new TypeError('chercherParTitreAuteur : un titre et un auteur sont attendus'); // l'appelant ne lance ni sans titre ni sans auteur (D-E4)
  const bilan = { statut: 'indisponible', fiches: [], motif: null, appels: 0 };
  let r = null;
  for (let essai = 0; essai < 2; essai += 1) {
    if (signal?.aborted) return { ...bilan, motif: 'delai' };
    if (essai === 1) { await attendre(repriseMs, signal); if (signal?.aborted) return { ...bilan, motif: 'delai' }; }
    bilan.appels += 1;
    r = await tentative(fetch, URL_OL_TITRE_AUTEUR(t0, a0), OPTIONS_FETCH, { tentativeMs, signal });
    if (r.ok) break;
    if (!((r.motif === 'reseau' || r.motif === 'delai') && !signal?.aborted)) break; // une reprise sur un échec MUET seulement (I-R)
  }
  if (!r.ok) return { ...bilan, motif: r.motif };
  const lu = lireSearchListe(r.json);
  if (!lu.repondu) return { ...bilan, motif: 'serveur' };
  return lu.fiches.length ? { ...bilan, statut: 'trouve', fiches: lu.fiches } : { ...bilan, statut: 'rien' };
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
// Une couverture choisie ICI passe par preparerPhotoLocale (src/core/image.js) : le mur commun des photos locales — 25 Mo, liste blanche des
// types, 16 Mpx lus dans l'en-tête AVANT tout décodage (S2), JPEG 1 200 px —, partagé avec la photo du plat de l'import ciblé (spec
// import-cible § 4.2.3). Une couverture REÇUE (recupererCouvertureParIsbn a déjà posé son type et son mur de pixels) garde sa borne de 5 Mo.
export async function poserCouverture(blob, { origine = 'locale', repo: r = repo, sha256 = sha256Hex } = {}) {
  let jpeg;
  if (origine === 'locale') jpeg = await preparerPhotoLocale(blob);
  else {
    if (blob.size > LIMITES_COUVERTURE.octetsDistants) throw new ErreurImage('trop_lourde');
    jpeg = await reduireImage(blob);
  }
  const empreinte = await sha256(jpeg);
  await r.putFile(empreinte, jpeg, { mime: 'image/jpeg' });
  return { sha256: empreinte, taille: jpeg.size };
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
          etat.telechargeable ? el('button', { type: 'button', class: 'btn primary', disabled: !!etat.telechargement, onClick: g('telecharger') }, etat.telechargement ? t('Téléchargement…') : t('Télécharger')) : null,
          etat.reessayable ? el('button', { type: 'button', class: 'btn', disabled: !!etat.telechargement, onClick: g('reessayer') }, t('Réessayer')) : null,
          el('button', { type: 'button', class: 'btn', disabled: !!etat.enCours, onClick: g('photographier') }, t('Photographier')),
          el('button', { type: 'button', class: 'btn', disabled: !!etat.enCours, onClick: g('choisir') }, t('Choisir une image')),
          etat.sha256 ? el('button', { type: 'button', class: 'btn link', disabled: !!etat.enCours, onClick: g('retirer') }, t('Retirer')) : null))));
}

// § 4.5 : le texte d'une ligne `echec` d'une COUVERTURE — rend { texte, code } comme texteEchec (P-1). `vide` : la couverture a été vue et rien n'y a été
// lu → la saisie ; `illisible | coupe | hors_bornes` : c'est la RÉPONSE qui a déraillé (D-E10, R-E-3) → « Réessaie » + « Code : {c} » ; un 413 dit « trop
// lourde » sans « choisis moins de pages » (faux pour une couverture) ; tout le reste est le texte du lot A. Une raison hors RAISONS_ECHEC est `interne`.
export function texteEchecCouverture(erreur) {
  const raison = typeof erreur?.raison === 'string' && RAISONS_ECHEC.includes(erreur.raison) ? erreur.raison : 'interne';
  const extra = erreur?.extra && typeof erreur.extra === 'object' ? erreur.extra : {};
  if (raison === 'vide') return { texte: t('La couverture ne se lit pas : saisis le titre.'), code: null };
  if (raison === 'illisible' || raison === 'coupe' || raison === 'hors_bornes') return { texte: t('L’assistant n’a pas répondu lisiblement. Réessaie.'), code: t('Code : {c}', { c: raison }) };
  if (raison === 'requete' && extra.trop_lourd === true) return { texte: t('La demande est trop lourde.'), code: null };
  return texteEchec({ raison, extra });
}

// Ronde 1 (#24) : deux phrases dites à plusieurs endroits, et le bloc du vol tenu ici (pas 1 et pas 2) — une seule source chacun ; t() lu à l'appel.
const phraseVolTenu = () => t('Une lecture est déjà en cours : annule-la d’abord.');
const phraseEnregistrementBloque = () => t('La couverture est en cours de lecture : attends la réponse ou annule-la.');
// R-VIS-8 : la .status[role=status] puis la .row — « Annuler » se range à droite.
const blocVolTenu = (g) => [el('div', { class: 'status', role: 'status' }, t('Lecture de la couverture par l’assistant…')),
  el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', dataset: { role: 'annuler-lecture' }, onClick: g('annulerLecture') }, t('Annuler')))];

// § 4.1 : le troisième chemin du pas 1, SOUS la phrase des sources. Pur : la carte de connexion vient de gestes.carteConnexion (le rendu tolère son absence,
// les tests purs du pas 1 rendent sans gestes). Aucun état « sélecteur ouvert » (N1) : pendant le choix d'une photo, les deux boutons restent actifs.
export function renderBlocCouverture(model, gestes = {}) {
  const g = (nom) => (...a) => (typeof gestes[nom] === 'function' ? gestes[nom](...a) : undefined);
  const L = model.lecture;
  let corps = null;
  if (model.session === 'verification') corps = el('div', { class: 'status', role: 'status' }, t('Vérification de l’assistant…'));
  else if (model.session !== 'prete') corps = typeof gestes.carteConnexion === 'function' ? gestes.carteConnexion() : null;
  else if (L?.statut === 'preparation') corps = el('div', { class: 'status', role: 'status' }, t('Préparation de la photo…'));
  else if (L?.statut === 'en_cours' && model.volTenu) corps = blocVolTenu(g);
  else {
    const eteint = !!model.volAilleurs || !!model.recherche; // un vol d'une autre route tient le document, ou une identification par ISBN est en vol
    corps = el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn', dataset: { role: 'photographier-couverture' }, disabled: eteint, onClick: () => g('photographierCouverture')('environment') }, t('Photographier la couverture')),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'choisir-couverture' }, disabled: eteint, onClick: () => g('photographierCouverture')(null) }, t('Choisir une image')));
  }
  return el('div', { class: 'stack', dataset: { role: 'couverture-pas1' } },
    el('p', { class: 'muted' }, t('Ou photographie la couverture : l’assistant lit le titre et l’auteur.')),
    corps,
    el('small', { class: 'muted' }, t('Une photo de la couverture = un appel à l’assistant, compté dans ton quota du jour.')),
    model.messages?.lectureMessage ? el('small', { class: 'muted', dataset: { role: 'lecture-message' } }, model.messages.lectureMessage) : null);
}
// Remplace le SEUL bloc du pas 1 (replaceWith) : la résolution de la session (D-E8) et une lecture reçue après un geste (N2-a) passent par ici, jamais par
// dessiner() — qui reconstruirait le champ ISBN et ferait perdre sa saisie et son focus (R-UX-9). Tolérant : sans bloc (pas 2), rien.
export function majBlocCouverture(zone, model, gestes = {}) {
  const ancien = zone?.querySelector?.('[data-role="couverture-pas1"]');
  if (!ancien) return null;
  const neuf = renderBlocCouverture(model, gestes);
  ancien.replaceWith(neuf);
  return neuf;
}

// § 4.3.6 : le bloc lecture du pas 2 (P-5 : un enveloppant .stack, puis la .status, puis la .row — R-VIS-8), quand la ligne n'est ni lue, ni reçue, ni
// terminée. « Lire » (a_lancer) / « Relire la couverture » (echec, sauf `vide` : D-E10) éteints hors ligne, sans session, pendant un vol, sans les octets.
export function renderBlocLecture(model, gestes = {}) {
  const g = (nom) => (...a) => (typeof gestes[nom] === 'function' ? gestes[nom](...a) : undefined);
  const L = model.lecture;
  if (model.pas !== 2 || !L || !['a_lancer', 'echec', 'en_cours'].includes(L.statut)) return null;
  if (L.statut === 'en_cours') {
    if (model.volTenu) return el('div', { class: 'stack', dataset: { role: 'lecture' } }, ...blocVolTenu(g));
    return el('div', { class: 'stack', dataset: { role: 'lecture' } }, el('div', { class: 'status warn' }, t('En cours sur un autre écran'))); // I-7 : sans « Annuler »
  }
  let texte, code = null, offrir = true;
  if (L.statut === 'a_lancer') texte = model.horsLigne ? t('Tu es hors ligne.') : (typeof L.message === 'string' && L.message ? L.message : t('La couverture n’a pas encore été lue.'));
  else { ({ texte, code } = texteEchecCouverture(L.erreur)); offrir = L.erreur?.raison !== 'vide'; }
  const peut = model.session === 'prete' && !model.horsLigne && !model.volAilleurs && !model.volTenu && !model.octetsAbsents;
  return el('div', { class: 'stack', dataset: { role: 'lecture' } },
    el('div', { class: 'status warn' }, el('span', null, texte), code ? el('small', { class: 'muted' }, ` ${code}`) : null),
    model.session === null && typeof gestes.carteConnexion === 'function' ? gestes.carteConnexion() : null,
    offrir ? el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', dataset: { role: 'relire' }, disabled: !peut, onClick: g('relire') }, L.statut === 'a_lancer' ? t('Lire la couverture') : t('Relire la couverture'))) : null);
}
export function majBlocLecture(zone, model, gestes = {}) {
  const ancien = zone?.querySelector?.('[data-role="lecture"]');
  if (!ancien) return null;
  const neuf = renderBlocLecture(model, gestes);
  if (neuf) ancien.replaceWith(neuf); else ancien.remove();
  return neuf;
}

// § 4.3.4-5 : la proposition d'Open Library — la mention pendant la recherche (le tiers est nommé, I-C), puis le bandeau. Ses parties sont lues sur
// ficheSelonIsbn (R-E-9 : sous un autre ISBN valide, ni éditeur, ni année) ; « ISBN … » seulement sans ISBN valide déjà là (N3) ; chaque partie en texte,
// bornée. Une œuvre à plusieurs éditions renvoie au code-barres (sauf ISBN déjà là).
export function renderProposition(model, gestes = {}) {
  const g = (nom) => (...a) => (typeof gestes[nom] === 'function' ? gestes[nom](...a) : undefined);
  const p = model.proposition;
  if (p?.statut === 'recherche') return el('small', { class: 'muted', dataset: { role: 'proposition-ol' } }, t('Recherche d’une fiche chez Open Library…'));
  if (p?.statut !== 'trouvee' || !p.fiche) return null;
  const isbnValide = validerIsbn(model.isbn).ok;
  const f = ficheSelonIsbn(p.fiche, model.isbn);
  const parties = [f.title, f.author, f.publisher, f.year, !isbnValide && f.isbn13 ? `${t('ISBN')} ${f.isbn13}` : null].map((x) => (x === null || x === undefined ? '' : borner(String(x)).trim())).filter(Boolean);
  return el('div', { class: 'card flat stack', dataset: { role: 'proposition-ol' } },
    el('p', null, t('Proposé par Open Library : {f}', { f: parties.join(', ') })),
    !p.fiche.editionUnique && !isbnValide ? el('small', { class: 'muted', dataset: { role: 'plusieurs-editions' } }, t('Plusieurs éditions chez Open Library : scanne le code-barres pour l’ISBN exact.')) : null,
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn', dataset: { role: 'utiliser-ol' }, onClick: g('utiliserOl') }, t('Utiliser ces renseignements')),
      el('button', { type: 'button', class: 'btn link', dataset: { role: 'ignorer-ol' }, onClick: g('ignorerOl') }, t('Ignorer'))));
}

export function livreAjoutModel({ pas = 1, isbn = '', champs = {}, provenance = null, recherche = false, reprise = false, validation = null, resultat = null, suggestions = null, cleGoogle = false, lecteurDisponible = true, enCours = false, session = null, lecture = null, proposition = null, importId = null, volAilleurs = false, horsLigne = false, octetsAbsents = false } = {}) {
  const c = { ...CHAMPS_VIDES(), ...champs };
  const google = resultat?.google || 'non_appele';
  const provenanceMessage = provenance === 'openlibrary' ? t('Renseigné par Open Library — vérifie et corrige.')
    : provenance === 'googlebooks' ? t('Renseigné par Google Books — vérifie et corrige.')
    : provenance === 'couverture' ? t('Lu sur la couverture — vérifie.')
    : provenance === 'aucune' ? (google === 'rien' ? t('Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main.')
      : google === 'echec' ? t('Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la main.')
      : t('Aucune fiche chez Open Library pour cet ISBN. Complète à la main.')) : null;
  // Tables fermées, lues par hasOwn : un motif inconnu (ou hostile, « __proto__ ») retombe sur un texte sûr (S12).
  const INDISPONIBLE = { delai: t('Open Library n’a pas répondu à temps.'), reseau: t('Impossible de joindre Open Library. Vérifie ta connexion.'), limite: t('Open Library reçoit trop de demandes en ce moment. Attends quelques secondes.'), serveur: t('Open Library est en panne pour le moment.'), horsligne: t('Tu es hors ligne.') };
  const VALIDATION = { longueur: t('Cet ISBN n’est pas valide, vérifie les chiffres.'), controle: t('Cet ISBN n’est pas valide, vérifie les chiffres.'), pas_isbn: t('Ce numéro n’est pas un ISBN : il doit commencer par 978 ou 979.') }; // C2 : seul le clavier produit ce motif
  const lire = (table, cle, repli) => (typeof cle === 'string' && Object.hasOwn(table, cle) ? table[cle] : repli);
  const isbnValide = !isbn || validerIsbn(isbn).ok;
  const indisponible = resultat?.statut === 'indisponible' && !recherche;
  // Lot E (§ 4.1, § 4.4, § 4.7) : `volTenu` = la lecture de CETTE route est en vol (`ici`, posé au rendu qui précède l'appel : N2) ; « Ajouter ce livre »
  // attend la fin d'une préparation ou d'un vol (D-E9) — jamais un livre écrit pendant qu'un import ne peut pas être fermé (D-E12).
  const volTenu = lecture?.statut === 'en_cours' && lecture.ici === true;
  const enregistrementBloque = lecture?.statut === 'preparation' || lecture?.statut === 'en_cours';
  return { pas, isbn, champs: c, provenance, recherche, reprise, validation, resultat, suggestions, cleGoogle, lecteurDisponible, enCours, isbnValide,
    session, lecture, proposition, importId, volTenu, volAilleurs: !!volAilleurs, horsLigne: !!horsLigne, octetsAbsents: !!octetsAbsents, enregistrementBloque,
    peutEnregistrer: pas === 2 && !!c.title.trim() && !recherche && !enCours && !enregistrementBloque,
    peutReessayer: indisponible,
    messages: {
      provenance: provenanceMessage,
      recherche: recherche ? (reprise ? t('Nouvel essai…') : t('Recherche…')) : null,
      lecteur: lecteurDisponible ? null : t('Le lecteur de code-barres n’est pas offert dans ce navigateur.'),
      validation: validation ? lire(VALIDATION, validation, VALIDATION.longueur) : null,
      indisponible: indisponible ? lire(INDISPONIBLE, resultat.motif, INDISPONIBLE.serveur) : null,
      sources: cleGoogle ? t('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.') : t('L’ISBN est envoyé à Open Library.'),
      rappelIsbn: isbn ? (isbnValide ? `${t('ISBN')} ${isbn}` : t('ISBN {i} — non valide, ne sera pas enregistré', { i: isbn })) : null,
      lectureMessage: lecture?.statut === 'refus_image' && typeof lecture.message === 'string' ? lecture.message : null,
    } };
}

export function fabriquerLivre({ champs, isbn, coverSha256 = null }, { newId }) {
  const v = validerIsbn(isbn);
  const c = { ...CHAMPS_VIDES(), ...champs };
  const book = { id: newId('bk'), title: c.title.trim(), author: c.author.trim(), cuisines: [...c.cuisines], tags: [...c.tags] };
  const edition = { id: newId('ed'), book_id: book.id, isbn: v.ok ? v.isbn13 : null, publisher: c.publisher.trim() || null, year: c.year ? parseInt(c.year, 10) || null : null, language: c.language || null, unit_convention_id: c.convention || null, convention_evidence: c.convention ? 'confirmed_by_user' : null, owned: true, cover_sha256: coverSha256 || null };
  return { book, edition };
}

// § 4.4, D-E12, I-E5 : avec un import de couverture, le livre et la FERMETURE du journal sont écrits dans UNE transaction, le statut relu DANS la transaction
// (patch fonction du courant) : a_verifier → enregistre (une lecture a été reçue), echec | a_lancer → ignore ; edition_id posé dans les deux cas. Refusée :
// la ligne est relue — en_cours → Error('lecture_en_cours'), rien d'écrit ; enregistre avec une édition présente → { dejaAjoute } (deux onglets sur le même
// ?import= : pas de doublon) ; absente, ignore, ou édition supprimée → le livre seul (le journal n'est plus à nous).
export async function enregistrerLivre(args, { repo: r = repo, importId = null, maintenant = () => new Date().toISOString() } = {}) {
  const repo = r; // le dépôt injecté sous le nom littéral que le test statique du lot A exige (contrainte globale) ; le défaut ci-dessus lit le module
  const { book, edition } = fabriquerLivre({ ...args, coverSha256: shaBornee(args?.coverSha256) }, { newId: repo.newId });
  if (!importId) { await repo.saveBatch({ books: [book], book_editions: [edition] }); return edition; }
  const ATTENDUS = ['a_verifier', 'echec', 'a_lancer'];
  const fermer = () => repo.transitionner('imports', importId, { attendus: ATTENDUS, patch: (c) => ({ status: c.status === 'a_verifier' ? 'enregistre' : 'ignore', edition_id: edition.id, reponse_brute: null, finished_at: maintenant() }), puts: { books: [book], book_editions: [edition] } });
  try {
    await fermer();
    return edition;
  } catch (e) {
    if (!(e instanceof TransitionRefusee)) throw e;
    const ligne = await repo.get('imports', importId);
    if (ligne?.status === 'en_cours') throw new Error('lecture_en_cours');
    if (ligne?.status === 'enregistre' && typeof ligne.edition_id === 'string' && ligne.edition_id && await repo.get('book_editions', ligne.edition_id)) return { dejaAjoute: ligne.edition_id };
    // Ronde 1 (#27) : la ligne a été ROUVERTE entre la transaction et cette relecture (deux routes sur le même ?import=, tâche 5) — la fermeture est rejouée
    // une fois, avec le livre ; jamais un livre écrit seul à côté d'une ligne ouverte (une reprise en écrirait un second). Un second refus remonte.
    if (ATTENDUS.includes(ligne?.status)) { await fermer(); return edition; }
    await repo.saveBatch({ books: [book], book_editions: [edition] });
    return edition;
  }
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
      el('small', { class: 'muted' }, model.messages.sources),
      // Lot E (§ 4.1) : le troisième chemin, SOUS la phrase des sources — le pas 1 ne l'attend jamais (D-E8)
      renderBlocCouverture(model, gestes));
  }
  const c = model.champs;
  // Lot E (§ 4.3.3, D-E16) : une lecture APPLIQUÉE dit ses champs incertains — vides, l'indice « Lu : {v} ? », le geste « Utiliser « {v} » ».
  const L = model.lecture?.statut === 'lue' ? model.lecture : null;
  const incertain = (k) => !!L && Array.isArray(L.incertains) && L.incertains.includes(k);
  const valeurLue = (k) => (L?.placeholders && Object.hasOwn(L.placeholders, k) && typeof L.placeholders[k] === 'string' && L.placeholders[k] ? L.placeholders[k] : null);
  const inp = (k, type = 'text') => el('input', { type, value: c[k], placeholder: incertain(k) && valeurLue(k) ? t('Lu : {v} ?', { v: valeurLue(k) }) : null, onInput: (e) => g('changerChamp')(k, e.target.value) });
  // R-UX-8 : la mention et le geste vivent HORS du <label> du champ (un bouton dans un label volerait le clic du libellé). La langue : la mention seule.
  const mentions = (k) => (incertain(k) ? el('div', { class: 'row' },
    el('small', { class: 'muted', dataset: { role: `incertain-${k}` } }, t('illisible sur la couverture')),
    k !== 'language' && valeurLue(k) ? el('button', { type: 'button', class: 'btn link', dataset: { role: `utiliser-lu-${k}` }, onClick: () => g('utiliserLu')(k) }, t('Utiliser « {v} »', { v: valeurLue(k) })) : null) : null);
  const puces = renderPuces(pucesModel({ choisies: c.cuisines, existantes: model.existantes || [] }), { basculer: g('basculerCuisine'), ajouter: g('ajouterCuisine') });
  return el('section', { class: 'card stack livre-ajout' },
    el('p', null, t('Vérifie la fiche, puis ajoute le livre.')),
    model.messages.provenance ? el('div', { class: 'status info' }, model.messages.provenance) : null,
    renderProposition(model, gestes),
    model.isbn ? el('div', { class: 'row' }, el('span', { class: 'muted' }, model.messages.rappelIsbn), el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN'))) : el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN')),
    renderBlocLecture(model, gestes),
    field(t('Titre *'), inp('title')),
    mentions('title'),
    L?.sousTitre ? el('small', { class: 'muted', dataset: { role: 'sous-titre' } }, t('Sous-titre lu : {s}', { s: L.sousTitre })) : null,
    field(t('Auteur / chef'), inp('author')),
    mentions('author'),
    field(t('Langue du livre'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'other', label: t('Autre') }], c.language, (v) => g('changerChamp')('language', v))),
    mentions('language'),
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
          t('La langue du livre ne suffit pas à choisir une convention. Sans convention, les tasses restent affichées telles quelles.'))),
      mentions('publisher')),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', dataset: { role: 'enregistrer' }, disabled: !model.peutEnregistrer, onClick: g('enregistrer') }, t('Ajouter ce livre'))),
    // D-E9 : la phrase est toujours rendue au pas 2, cachée quand rien ne bloque ; majBoutonEnregistrer la montre et la cache sans dessiner().
    el('small', { class: 'muted', dataset: { role: 'enregistrer-bloque' }, hidden: !model.enregistrementBloque }, phraseEnregistrementBloque()));
}

// R-UX-9 : `disabled` n'est posé qu'une fois, à la construction — or le pas 2 s'ouvre souvent à champs vides et le
// titre arrive FRAPPE PAR FRAPPE. Redessiner à chaque touche ferait sauter le curseur ; on ne touche donc que le
// bouton, retrouvé par son rôle. Pur et tolérant : au pas 1 ce bouton n'existe pas, et ce n'est pas une erreur.
export function majBoutonEnregistrer(zone, model) {
  const bouton = zone?.querySelector?.('[data-role="enregistrer"]');
  if (bouton) bouton.disabled = !model.peutEnregistrer;
  // Lot E (D-E9) : c'est aussi elle qui rallume le bouton à l'état `recue`, et qui cache la phrase quand plus rien ne bloque — sans dessiner().
  const phrase = zone?.querySelector?.('[data-role="enregistrer-bloque"]');
  if (phrase) phrase.hidden = !model.enregistrementBloque;
  return bouton || null;
}

// La route : état + gestes réels, re-rendu complet à chaque changement (le formulaire est petit).
// I-H : les trois gestes du monde extérieur (écrire, naviguer, parler) sont injectables, avec les vrais par défaut —
// la charnière § 5 → § 8 (« Ajouter ce livre » → /books/<id>?nouveau=1) devient mesurable sans toucher à l'adresse.
// Le nœud rendu porte `etatRoute()` : les tests attendent un FAIT observable (un rappel de couverture entré, une
// couverture appliquée) au lieu d'un délai (F3/F4).
export async function renderLivreAjoutRoute(params, query, ctx, { repo: r = repo, navigate: nav = navigate, toast: dire = toast, fetch = globalThis.fetch, enLigne = () => navigator.onLine !== false, attendre = attenteReelle, cle = GOOGLE_BOOKS.key, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs, pickFiles: choisirFichiers = pickFiles, maintenant = () => new Date().toISOString(), battementMs = undefined } = {}) {
  // Lot E : le dépôt injecté sous le nom littéral `repo`, pour les SEULS appels qui transitionnent (contrainte globale : le test statique du lot A
  // n'admet hors repo.js que `repo.transitionner(`) ; le reste du corps garde `r`, comme aujourd'hui. Le défaut `repo: r = repo` lit le module.
  const repo = r;
  // `touchee` (R-UX-13) : la personne a agi sur la couverture (choisi une image, ou retiré). Une réponse distante
  // tardive ne défait jamais un geste — même si l'ISBN, lui, n'a pas changé.
  const COUVERTURE_VIDE = () => ({ sha256: null, apercu: null, message: null, enCours: false, touchee: false });
  const etat = { pas: 1, isbn: '', champs: CHAMPS_VIDES(), champsDistants: null, isbnDistant: null, sourceDistante: null, langueTouchee: false, provenance: null, recherche: false, enCours: false, lecteurDisponible: 'BarcodeDetector' in window, existantes: cuisinesExistantes(ctx), couverture: COUVERTURE_VIDE(), generation: 0, passagesCouverture: 0, couverturesAppliquees: 0, reprise: false, validation: null, resultat: null, suggestions: null, existantesMotsCles: motsClesExistants(ctx), reponsesRecues: 0, ctl: null,
    // Lot E (§ 4.7) : l'import de couverture de la route, la génération de sa lecture, la clé de la lecture appliquée (idempotence), la session de
    // l'assistant ('verification' | 'prete' | null, D-E8), l'état de la lecture à l'écran, la proposition d'Open Library et son abandon, deux FAITS pour
    // les tests, ce que la lecture et ses « Utiliser » ont posé (N4), et l'absence des octets de la couverture sur cet appareil.
    importId: null, generationLecture: null, lectureAppliquee: null, session: ctx?.sync?.user ? 'verification' : null, lecture: null, proposition: null, ctlOl: null,
    lecturesRecues: 0, propositionsRecues: 0, champsLus: null, octetsAbsents: false };
  const root = el('div', null, pageHeader(t('Ajouter un livre'), { back: { href: '/add', label: t('Ajouter') } }));
  const zone = el('div', null);
  root.append(zone);
  // C1 : chaque geste qui change ce que l'écran raconte fait avancer la GÉNÉRATION. Une demande de couverture
  // capture la sienne au départ et la revérifie après chaque `await` : « ← Changer d'ISBN » puis « Saisir à la
  // main » pendant le ré-encodage ne pouvaient pas être vus par la garde d'avant (évaluée une seule fois).
  const avancer = () => { etat.generation += 1; };
  // Lot E : un vol d'une AUTRE ligne tient le document (le verrou de import-cible.js est unique, I-E3).
  const volAilleurs = () => { const v = volEnCours(); return !!v && v.importId !== etat.importId; };
  // Le modèle de la route : la phrase des sources suit la clé RÉELLEMENT passée (cleGoogle), et les puces lisent
  // les cuisines et mots-clés déjà employés. Toute lecture du modèle passe par ici (jamais le modèle nu de l'état).
  const modele = () => ({ ...livreAjoutModel({ ...etat, cleGoogle: !!cle, horsLigne: !enLigne(), volAilleurs: volAilleurs() }), existantes: etat.existantes, existantesMotsCles: etat.existantesMotsCles });
  // Lot E, ronde 1 (I-E4) : une route DÉMONTÉE n'applique plus rien et ne parle plus à Open Library. Elle l'est dès qu'elle a été RENDUE à l'appelant (posé
  // juste avant `return root` : app.js l'attache sans autre await, ou ne l'attache jamais si une navigation plus récente a eu lieu) et qu'elle n'est pas
  // dans le document ; pendant le montage (relire() d'un ?import=, tâche 5), elle est vivante.
  let rendue = false;
  const demontee = () => rendue && !root.isConnected;
  const dessiner = () => zone.replaceChildren(renderLivreAjout(modele(), gestes));
  // Lot E, ronde 1 (R-UX-9) : après une relecture du journal, si ni le pas ni la FORME du pas (bloc lecture, champs lus) ni la couverture n'ont changé, seuls
  // les blocs sont remplacés — un événement réseau ou un échec reçu après un geste ne reconstruit pas le formulaire pendant la saisie ; sinon dessiner().
  const forme = () => (etat.pas === 1 ? 'pas1' : etat.lecture?.statut === 'lue' ? 'lue' : ['a_lancer', 'echec', 'en_cours'].includes(etat.lecture?.statut) ? 'bloc' : 'nu');
  const avantRelecture = () => ({ forme: forme(), couverture: etat.couverture });
  const rendreApres = (avant) => {
    if (avant.forme !== forme() || avant.couverture !== etat.couverture) { dessiner(); return; }
    const m = modele();
    majBlocCouverture(zone, m, gestes); majBlocLecture(zone, m, gestes); majBoutonEnregistrer(zone, m);
  };
  // C3 et N4 (une seule remise, ronde 1) : chaque champ de `valeurs` encore ÉGAL à ce qu'une source (fiche d'ISBN, lecture de la couverture) y avait mis
  // est rendu à CHAMPS_VIDES() — la personne ne l'a pas touché, il n'est pas à elle ; ce qu'elle a corrigé reste ; sa langue touchée lui appartient (C2).
  const rendreChamps = (valeurs) => {
    if (!valeurs) return;
    const vides = CHAMPS_VIDES();
    for (const k of CHAMPS_DISTANTS) {
      if (!Object.hasOwn(valeurs, k) || (k === 'language' && etat.langueTouchee)) continue;
      if (String(etat.champs[k] ?? '') === String(valeurs[k] ?? '')) etat.champs[k] = vides[k];
    }
  };
  // C3 : une seconde identification ne doit pas fusionner par-dessus les champs du PREMIER ISBN (titre A + ISBN B). `retourIsbn` ne vide rien (F23).
  const oublierDistants = () => { const d = etat.champsDistants; etat.champsDistants = null; etat.isbnDistant = null; etat.sourceDistante = null; rendreChamps(d); };
  // Lot E (N4, I-E10) : ce qu'une lecture précédente de cette route et ses « Utiliser » ont posé, et que la personne n'a pas touché, est rendu ; l'ISBN posé
  // par « Utiliser ces renseignements » aussi, sauf `{ isbn: false }` (« Identifier » : l'ISBN tapé est celui qu'on identifie).
  const remettreChampsLus = ({ isbn = true } = {}) => {
    const lus = etat.champsLus;
    rendreChamps(lus);
    if (isbn && lus && Object.hasOwn(lus, 'isbn') && etat.isbn === lus.isbn) etat.isbn = '';
  };
  // D-E18, ronde 1 : une photo de CETTE route — posée, ou en préparation (importId est encore nul pendant le ré-encodage) — garde la couverture de l'écran.
  const photoDeLaRoute = () => !!etat.importId || etat.lecture?.statut === 'preparation';
  // I-G : tout geste qui change l'ISBN ou le pas ferme la porte aux réponses en vol (avancer, C1) ET libère la recherche.
  // R-ISBN-8 : la requête en vol est aussi ABANDONNÉE (le réseau est libéré, pas seulement la réponse rendue muette).
  // `depuisFichier` et `retirer` appellent avancer() seul et ne touchent pas `recherche` : la zone de couverture
  // n'existe qu'au pas 2, et `recherche` n'est vraie qu'au pas 1.
  // Lot E : nouvelleGeneration() abandonne aussi le rattrapage d'Open Library (etat.ctlOl) — JAMAIS le vol, qui vit dans import-cible.js (D-E9).
  const nouvelleGeneration = () => { etat.ctl?.abort(); etat.ctl = null; etat.ctlOl?.abort(); etat.ctlOl = null; etat.proposition = null; avancer(); etat.recherche = false; etat.reprise = false; etat.validation = null; etat.resultat = null; etat.suggestions = null; };
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
    // Lot E (D-E18) : une couverture PHOTOGRAPHIÉE dans cette route (posée ou en préparation, ronde 1) survit à « Identifier » ; sans photo, comme aujourd'hui.
    etat.provenance = null; if (!photoDeLaRoute()) etat.couverture = COUVERTURE_VIDE(); etat.suggestions = null;
    oublierDistants();
    // Lot E, ronde 1 (C3, I-E10, I-B ; choix à ratifier) : une lecture APPLIQUÉE n'est pas la fiche de cet ISBN — ses champs non touchés sont rendus avant la
    // fusion (l'ISBN tapé reste), ses mentions quittent l'écran ; le journal la garde (état `recue`), « Ajouter ce livre » la fermera avec le livre.
    if (etat.lecture?.statut === 'lue') { remettreChampsLus({ isbn: false }); etat.champsLus = null; etat.lecture = { statut: 'recue' }; }
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
        // Lot E (D-E18, F-4) : la demande covers.openlibrary.org est SAUTÉE AVANT de partir quand une couverture est posée ou touchée (pré-garde égale à pertinent()).
        if (source === 'openlibrary' && !etat.couverture.sha256 && !etat.couverture.touchee) {
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
    const files = await choisirFichiers({ accept: 'image/*', multiple: false, capture }); // lot E : par deps.pickFiles (défaut : celui de core/dom.js)
    if (!files.length) return;
    // R-UX-13 : dès que la personne a choisi une image, une réponse distante tardive n'a plus rien à dire ici.
    avancer();
    etat.couverture = { ...etat.couverture, touchee: true, enCours: true }; dessiner();
    try { const { sha256 } = await poserCouverture(files[0], { origine: 'locale', repo: r }); const ligne = await r.getFile(sha256); etat.couverture = { sha256, apercu: urlDeBlob(ligne.blob), message: t('Couverture enregistrée.'), enCours: false, touchee: true }; }
    // Un refus ne RETIRE pas la couverture déjà posée : seul le message change (l'écran ne perd rien de vrai).
    catch (e) { etat.couverture = { ...etat.couverture, enCours: false, message: messageErreurImage(e) }; }
    dessiner();
  };
  // --- Lot E : la lecture de la couverture -------------------------------------------------------------------------------------------------------
  // relire() est la SEULE fonction qui lit le journal pour l'écran (§ 4.3.1) ; dessiner() ne l'appelle jamais. File de promesses : jamais deux relectures
  // qui se dépassent. Déclenchée au montage avec ?import= (tâche 4), à la fin d'un vol, après « Annuler », après « Lire / Relire », sur `online`.
  let file = Promise.resolve();
  const relire = () => { file = file.then(relireMaintenant).catch((e) => logError('livre.couverture.relire', { error: e })); return file; };
  // N2-a : une lecture reçue après un geste (état `recue`) ne redessine pas — le bloc lecture du pas 2 est RETIRÉ, le bloc du pas 1 est rendu à ses deux
  // boutons, le bouton « Ajouter ce livre » est rallumé et sa phrase cachée : la saisie et le focus survivent.
  const transitionsRecue = () => {
    for (const n of zone.querySelectorAll('[data-role="lecture"]')) n.remove();
    majBlocCouverture(zone, modele(), gestes);
    majBoutonEnregistrer(zone, modele());
  };
  async function relireMaintenant() {
    if (!etat.importId) return; // R-E-10 : rien n'est lu (db.get(null) lève DataError), rien n'est redessiné
    const id = etat.importId;
    const ligne = await r.get('imports', id);
    if (etat.importId !== id) return; // une nouvelle photo a pris la route pendant la lecture
    const sha = ligne ? shaBornee(ligne.cover_sha256) : null;
    const fichier = sha ? await r.getFile(sha) : null;
    if (etat.importId !== id) return; // ronde 1 : … ou pendant la lecture des octets
    // Ronde 1 (I-E4) : route démontée — rien n'est appliqué ni rendu ; une lecture non appliquée reste au journal (état `recue`), « Reprendre » la retrouve.
    if (demontee()) { if (ligne?.status === 'a_verifier' && etat.lectureAppliquee !== cleLecture(ligne)) etat.lecture = { statut: 'recue' }; return; }
    const avant = avantRelecture();
    if (!ligne) { etat.lecture = null; etat.importId = null; rendreApres(avant); return; }
    etat.octetsAbsents = !(fichier?.blob instanceof Blob);
    if (etat.octetsAbsents && (!etat.couverture.sha256 || etat.couverture.sha256 === sha)) etat.couverture = { ...etat.couverture, apercu: null, message: t('La couverture n’est pas sur cet appareil.') };
    const memeVol = etat.generation === etat.generationLecture; // P-6 : aucun geste depuis le vol (ou la reprise)
    if (ligne.status === 'a_verifier') {
      const cleLue = cleLecture(ligne);
      if (etat.lectureAppliquee === cleLue) return; // déjà appliquée : idempotence (un second relire() ne remplit plus rien)
      if (!memeVol || etat.importId !== ligne.id) { etat.lecture = { statut: 'recue' }; transitionsRecue(); return; } // I-E4 : le journal la garde
      await appliquerLecture(ligne, cleLue);
      return;
    }
    if (ligne.status === 'a_lancer') etat.lecture = { statut: 'a_lancer', message: etat.lecture?.statut === 'a_lancer' ? etat.lecture.message ?? null : null };
    else if (ligne.status === 'en_cours') etat.lecture = { statut: 'en_cours', ici: ligne.document_id_vol === DOCUMENT_ID };
    else if (ligne.status === 'echec') etat.lecture = { statut: 'echec', erreur: ligne.erreur ?? null };
    else etat.lecture = { statut: 'termine' }; // fermée ailleurs : « Ajouter ce livre » décide (§ 4.4)
    if (memeVol && etat.lecture.statut !== 'termine') etat.pas = 2;
    rendreApres(avant);
  }
  // § 4.3.2 : la lecture REVALIDÉE (I-E1 : un résultat revenu du journal est une donnée hostile) est appliquée UNE fois ; un résultat hostile → a_verifier →
  // echec(illisible) pour CETTE lecture (T4-R1). Puis le rattrapage, si en ligne, avec un titre ET un premier auteur lus, ni l'un ni l'autre incertains (D-E4).
  async function appliquerLecture(ligne, cleLue) {
    let lecture;
    try { lecture = validerLectureCouverture(ligne.resultat); }
    catch {
      const patch = (c) => { if (cleLecture(c) !== cleLue) throw new TransitionRefusee('imports', ligne.id, c.status); return { status: 'echec', erreur: { raison: 'illisible', extra: {} }, resultat: null }; };
      try { await repo.transitionner('imports', ligne.id, { attendus: ['a_verifier'], patch }); }
      catch (e) { if (!(e instanceof TransitionRefusee)) logError('livre.couverture.revalidation', { error: e }); }
      if (etat.importId !== ligne.id) return; // ronde 1 (#20, #26) : une nouvelle photo a pris la route pendant l'écriture
      const avantEchec = avantRelecture();
      etat.lecture = { statut: 'echec', erreur: { raison: 'illisible', extra: {} } };
      if (etat.generation === etat.generationLecture) etat.pas = 2; // P-6 : un geste fait pendant l'écriture garde son pas
      rendreApres(avantEchec);
      return;
    }
    oublierDistants(); // ronde 1 (C3, I-B) : les champs d'une fiche d'ISBN non touchés ne restent pas sous l'étiquette « Lu sur la couverture »
    const avant = { ...etat.champs };
    const { champs, incertains, placeholders, sousTitre } = champsDepuisLecture(etat.champs, lecture, { langueTouchee: etat.langueTouchee });
    etat.champs = champs;
    etat.lecture = { statut: 'lue', incertains, placeholders, sousTitre, lecture };
    etat.lectureAppliquee = cleLue;
    const poses = CHAMPS_DISTANTS.filter((k) => String(avant[k] ?? '') !== String(champs[k] ?? '')); // ce que la lecture a RÉELLEMENT posé (N4)
    etat.champsLus = poses.length ? Object.fromEntries(poses.map((k) => [k, champs[k]])) : null;
    etat.provenance = 'couverture';
    etat.champsDistants = null; // une lecture n'est pas une fiche d'ISBN : C3 ne la reprend pas
    etat.pas = 2;
    const rattrapage = !demontee() && enLigne() && !!lecture.title && !!lecture.authors[0] && !lecture.uncertain.includes('title') && !lecture.uncertain.includes('authors');
    etat.proposition = rattrapage ? { statut: 'recherche' } : null;
    dessiner();
    if (rattrapage) rattraper(lecture).catch((e) => logError('livre.couverture.rattrapage', { error: e })); // jamais attendu : une file de relire() n'attend pas Open Library
  }
  // § 4.3.4 : Open Library par titre et PREMIER auteur — silencieux (aucune carte, aucun journal) ; la réponse n'appartient qu'à la lecture qui l'a demandée.
  async function rattraper(lecture) {
    const ctl = new AbortController();
    etat.ctlOl = ctl;
    const chrono = setTimeout(() => ctl.abort(), LIMITES_ISBN.totalMs);
    const importId = etat.importId, cleLue = etat.lectureAppliquee;
    let res = null;
    try { res = await chercherParTitreAuteur(lecture.title, lecture.authors[0], { fetch, signal: ctl.signal, attendre, tentativeMs, repriseMs }); }
    catch { res = null; }
    finally { clearTimeout(chrono); }
    etat.propositionsRecues += 1; // le FAIT que les tests attendent, posé avant la garde
    if (etat.ctlOl !== ctl || etat.importId !== importId || etat.lectureAppliquee !== cleLue || etat.pas !== 2) return;
    etat.ctlOl = null;
    const fiche = res?.statut === 'trouve' ? choisirProposition(lecture, res.fiches) : null;
    etat.proposition = fiche ? { statut: 'trouvee', fiche } : null;
    majProposition();
  }
  // P-7 : la proposition arrive après le rendu du pas 2 ; elle est posée, remplacée ou retirée SANS dessiner() (la saisie et le focus survivent).
  function majProposition() {
    const ancien = zone.querySelector('[data-role="proposition-ol"]');
    const neuf = renderProposition(modele(), gestes);
    if (ancien && neuf) ancien.replaceWith(neuf);
    else if (ancien) ancien.remove();
    else if (neuf) { const repere = zone.querySelector('.status.info'); if (repere) repere.after(neuf); else dessiner(); }
  }
  // Ce qu'un vol REFUSÉ laisse à l'écran (§ 4.2, pas 5) : la ligne reste a_lancer (relire() la relit), avec la phrase de la raison ; la session disparue
  // ramène la carte ; un vol tenu ailleurs est dit par un toast.
  function apresVol(r1) {
    etat.lecturesRecues += 1; // le FAIT que les tests attendent
    if (r1?.issue !== 'refuse') return;
    if (r1.raison === 'non_connecte') etat.session = null;
    if (r1.raison === 'vol_tenu') dire(phraseVolTenu());
    const message = r1.raison === 'octets_absents' ? t('La couverture n’est pas sur cet appareil.') : r1.raison === 'image' ? messageErreurImage({ code: r1.code }) : null;
    if (['hors_ligne', 'non_connecte', 'vol_tenu', 'octets_absents', 'image', 'sans_page'].includes(r1.raison)) etat.lecture = { statut: 'a_lancer', message };
  }
  // § 4.2 : de la photo à la lecture. N1 : AUCUN verrou pendant le sélecteur (une annulation ne résout jamais pickFiles) ; après le choix, relecture
  // SYNCHRONE puis `preparation` sans aucun await entre les deux — deux choix résolus au même tour font une ligne. I-E2 : octets, puis la ligne a_lancer,
  // puis seulement l'appel. D-E22 : la ligne précédente est fermée APRÈS la création de la nouvelle ; M3 / R-E-10 : un refus d'image ou une écriture du
  // journal impossible rendent la précédente à la route.
  async function photographierCouverture(capture) {
    if (etat.lecture?.statut === 'preparation') return;
    if (volEnCours()) { dire(phraseVolTenu()); return; }
    const files = await choisirFichiers(capture ? { accept: 'image/*', multiple: false, capture } : { accept: 'image/*', multiple: false });
    if (!files?.length) return;
    if (etat.lecture?.statut === 'preparation') return; // un autre choix de cette route a gagné
    if (volEnCours()) { dire(phraseVolTenu()); return; } // vol pris pendant le choix : rien n'est posé
    // Ronde 1 (C1) : la ligne précédente ET la clé de sa lecture appliquée, rendues ensemble à la route sur un refus.
    const precedent = etat.importId, appliqueePrecedente = etat.lectureAppliquee;
    nouvelleGeneration();
    oublierDistants();
    remettreChampsLus();
    etat.champsLus = null; etat.provenance = null; etat.importId = null; etat.lectureAppliquee = null; etat.octetsAbsents = false;
    etat.couverture = { ...COUVERTURE_VIDE(), touchee: true, enCours: true };
    etat.lecture = { statut: 'preparation' };
    dessiner();
    const gen = etat.generation;
    etat.generationLecture = gen;
    // M3 / R-E-10 : rien n'est créé, rien n'est détaché, la ligne précédente reste celle de la route (« Ajouter ce livre » la fermera avec le livre). Ronde 1
    // (C1, I-E4) : sa lecture garde sa clé et n'appartient plus à la génération de l'écran (generationLecture nulle) — un relire() suivant (un `online`) ne la
    // réapplique jamais sans geste ; les champs, eux, ont été remis au pas 2 (N4, § 11).
    const refuser = (message, couverture) => {
      etat.lecture = { statut: 'refus_image', message }; etat.couverture = couverture;
      etat.importId = precedent; etat.lectureAppliquee = appliqueePrecedente; etat.generationLecture = null;
      dessiner();
    };
    let sha256;
    try { ({ sha256 } = await poserCouverture(files[0], { origine: 'locale', repo: r })); }
    catch (e) {
      // Ronde 1 (#21) : seule une ErreurImage est un refus d'image ; un stockage plein (putFile) est dit comme le journal impossible, et journalisé.
      if (!(e instanceof ErreurImage)) logError('livre.couverture.pose', { error: e });
      refuser(e instanceof ErreurImage ? messageErreurImage(e) : t('Le livre n’a pas pu être enregistré. Réessaie.'), { ...COUVERTURE_VIDE(), touchee: true });
      return;
    }
    let posee = null, ligne;
    try { // ronde 1 (#29) : la relecture des octets posés est dans le même filet que l'écriture du journal
      const fichier = await r.getFile(sha256);
      posee = { sha256, apercu: urlDeBlob(fichier.blob), message: t('Couverture enregistrée.'), enCours: false, touchee: true };
      ligne = fabriquerImportCouverture({ id: r.newId('imp'), coverSha256: sha256, deviceId: r.deviceId() });
      await r.saveBatch({ imports: [ligne] }, { conditions: { imports: [{ key: ligne.id, absente: true }] } });
    } catch (e) {
      logError('livre.couverture.journal', { error: e });
      refuser(t('Le livre n’a pas pu être enregistré. Réessaie.'), posee ?? { ...COUVERTURE_VIDE(), touchee: true }); // la couverture reste posée (ligne files écrite)
      return;
    }
    etat.importId = ligne.id;
    etat.generationLecture = gen;
    if (precedent) {
      try { await repo.transitionner('imports', precedent, { attendus: ['a_lancer', 'a_verifier', 'echec'], patch: { status: 'ignore', finished_at: maintenant() } }); }
      catch (e) { if (!(e instanceof TransitionRefusee)) logError('livre.couverture.precedente', { error: e }); } // fermée ailleurs entre-temps : muette
    }
    etat.couverture = posee;
    etat.couverturesAppliquees += 1; // le FAIT que les tests attendent
    etat.lecture = { statut: 'en_cours', ici: true }; // N2 : rendu AVANT l'appel (`vol` n'est posé que par lancerLectureCouverture)
    dessiner();
    await voler(ligne.id);
  }
  // N2-b : « Lire / Relire la couverture » — un vol de cette route comme un autre, sur la MÊME ligne (echec | a_lancer → en_cours), rendu avant l'appel.
  async function lireCouverture() {
    if (!etat.importId || volEnCours()) return;
    const id = etat.importId;
    etat.generationLecture = etat.generation;
    etat.lecture = { statut: 'en_cours', ici: true };
    dessiner();
    await voler(id);
  }
  // Le vol puis la relecture. Ronde 1 (#29) : un rejet imprévu du vol (IndexedDB) est journalisé, et l'écran suit la ligne relue — jamais figé.
  async function voler(id) {
    let r1 = null;
    try { r1 = await lancerLectureCouverture(id, { ctx, repo: r, fetch, maintenant, enLigne, battementMs }); }
    catch (e) { logError('livre.couverture.vol', { error: e }); }
    apresVol(r1);
    await relire();
  }
  // D-E16 : « Utiliser « {v} » » — un geste = une saisie ; la valeur reste une valeur de CETTE couverture (N4).
  function utiliserLu(k) {
    const L = etat.lecture;
    const v = L?.statut === 'lue' && L.placeholders && Object.hasOwn(L.placeholders, k) ? L.placeholders[k] : null;
    if (typeof v !== 'string' || !v) return;
    etat.champs[k] = v;
    etat.champsLus = { ...(etat.champsLus || {}), [k]: v };
    const placeholders = { ...L.placeholders };
    delete placeholders[k];
    etat.lecture = { ...L, incertains: L.incertains.filter((x) => x !== k), placeholders };
    dessiner();
  }
  // § 4.3.5 : « Utiliser ces renseignements » — ne remplace que ce que la fiche porte ; sous un autre ISBN valide, ni éditeur, ni année, ni langue (R-E-9,
  // lu AVANT que l'ISBN bouge) ; l'ISBN de la fiche n'est posé que si aucun ISBN valide n'est là, jamais vidé (N3) ; la photo reste la couverture.
  function utiliserOl() {
    const fiche = etat.proposition?.statut === 'trouvee' ? etat.proposition.fiche : null;
    if (!fiche) return;
    const avant = { ...etat.champs };
    etat.champs = ficheDepuisProposition(etat.champs, ficheSelonIsbn(fiche, etat.isbn), { langueTouchee: etat.langueTouchee });
    let isbnPose = null;
    if (!validerIsbn(etat.isbn).ok && fiche.isbn13) { etat.isbn = fiche.isbn13; isbnPose = fiche.isbn13; }
    etat.provenance = 'openlibrary';
    etat.suggestions = fiche.motsCles?.length ? { source: 'openlibrary', valeurs: fiche.motsCles } : null;
    const repris = CHAMPS_DISTANTS.filter((k) => String(avant[k] ?? '') !== String(etat.champs[k] ?? ''));
    if (etat.lecture?.statut === 'lue') {
      const placeholders = { ...etat.lecture.placeholders };
      for (const k of repris) delete placeholders[k];
      etat.lecture = { ...etat.lecture, incertains: etat.lecture.incertains.filter((k) => !repris.includes(k)), placeholders };
    }
    etat.champsDistants = repris.length ? Object.fromEntries(repris.map((k) => [k, etat.champs[k]])) : null;
    const v = validerIsbn(etat.isbn);
    etat.isbnDistant = v.ok ? v.isbn13 : null;
    etat.sourceDistante = 'openlibrary';
    etat.champsLus = { ...(etat.champsLus || {}), ...Object.fromEntries(repris.map((k) => [k, etat.champs[k]])), ...(isbnPose ? { isbn: isbnPose } : {}) };
    etat.proposition = null;
    dessiner();
  }

  const connecter = () => demarrerConnexion(ctx?.sync?.auth);
  const gestes = {
    couverture: () => renderZoneCouverture(etat.couverture, {
      photographier: () => depuisFichier('environment'),
      choisir: () => depuisFichier(null),
      retirer: () => { avancer(); etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; dessiner(); },
    }),
    // Lot E
    carteConnexion: () => carteConnexion(connecter, ctx),
    photographierCouverture: (capture) => photographierCouverture(capture),
    annulerLecture: async () => { if (etat.importId) await annulerVol(etat.importId); await relire(); },
    relire: () => lireCouverture(),
    utiliserLu: (k) => utiliserLu(k),
    utiliserOl: () => utiliserOl(),
    ignorerOl: () => { etat.proposition = null; dessiner(); },
    changerIsbn: (v) => { etat.isbn = v; },
    identifier: () => identifier(),
    reessayer: () => identifier({ forcer: true }),
    scanner: async () => {
      // C5 (vague /verify) : la photo et la lecture prennent du temps ; un geste pendant ce temps (« Saisir à la main »,
      // « ← Changer d'ISBN », une identification tapée) l'emporte sur le code lu après coup (I-G).
      const gen = etat.generation, pas = etat.pas;
      const files = await choisirFichiers({ accept: 'image/*', multiple: false, capture: 'environment' }); // ronde 1 (#22) : par deps.pickFiles, comme les deux autres gestes
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
      // Lot E (D-E18) : la couverture photographiée dans cette route (posée ou en préparation, ronde 1) survit ; R-UX-13 ne vise que la couverture REÇUE.
      etat.couverture = photoDeLaRoute() ? etat.couverture : { ...COUVERTURE_VIDE(), touchee: true }; etat.pas = 2; dessiner();
    },
    changerChamp: (k, v) => { etat.champs[k] = v; if (k === 'language') etat.langueTouchee = true; majBoutonEnregistrer(zone, modele()); },
    basculerCuisine: (v) => { etat.champs.cuisines = basculerPuce(etat.champs.cuisines, v); dessiner(); },
    ajouterCuisine: (v) => { const apres = ajouterPuce(etat.champs.cuisines, v); if (apres !== etat.champs.cuisines) { etat.champs.cuisines = apres; dessiner(); } },
    // R-UX-13 : revenir changer l'ISBN abandonne la couverture de l'ancien — et `touchee` empêche la réponse encore
    // en vol de la reposer en coulisse (le pas 1 ne montre pas la zone). L'`identifier` suivant repart d'un
    // COUVERTURE_VIDE() neuf, donc `touchee` retombe et la couverture du nouvel ISBN est bien demandée.
    retourIsbn: () => { nouvelleGeneration(); etat.pas = 1; etat.provenance = null; etat.couverture = photoDeLaRoute() ? etat.couverture : { ...COUVERTURE_VIDE(), touchee: true }; dessiner(); },
    basculerMotCle: (v) => { etat.champs.tags = basculerPuce(etat.champs.tags, v); dessiner(); },
    ajouterMotCle: (v) => { const apres = ajouterPuce(etat.champs.tags, v); if (apres !== etat.champs.tags) { etat.champs.tags = apres; dessiner(); } },
    // Une écriture refusée ne s'annonce pas (I-B) : on reste au pas 2, la saisie est intacte, et c'est dit.
    // `enCours` ferme le bouton pendant l'écriture : deux tapes pressées ne font pas deux livres.
    enregistrer: async () => {
      if (!modele().peutEnregistrer) return;
      etat.enCours = true;
      majBoutonEnregistrer(zone, modele());
      let res;
      try {
        res = await enregistrerLivre({ champs: etat.champs, isbn: etat.isbn, coverSha256: shaBornee(etat.couverture?.sha256) }, { repo: r, importId: etat.importId, maintenant });
      } catch (e) {
        etat.enCours = false;
        majBoutonEnregistrer(zone, modele());
        if (e?.message === 'lecture_en_cours') { dire(phraseEnregistrementBloque()); relire(); return; }
        logError('livre.enregistrer', { error: e });
        dire(t('Le livre n’a pas pu être enregistré. Réessaie.'));
        return;
      }
      if (res?.dejaAjoute) { dire(t('Ce livre a déjà été ajouté.')); nav(`/books/${encodeURIComponent(res.dejaAjoute)}`); return; }
      dire(t('Livre ajouté'));
      nav(`/books/${encodeURIComponent(res.id)}?nouveau=1`);
    },
  };
  // Lot E (§ 4.7, F-17) : en ligne / hors ligne — posés au montage, retirés par le gestionnaire lui-même dès que la route est démontée (motif des `vues`
  // d'import-cible.js ; avant son premier attachement, la route écoute) ; `online` relit le journal (R-E-10 : rien sans import). Ronde 1 (R-UX-9) :
  // `offline` ne redessine plus — sans import de couverture rien n'en dépend ; sinon les SEULS blocs sont remplacés (« Lire » s'éteint, « Tu es hors ligne. »).
  const surReseau = (e) => {
    if (demontee()) { window.removeEventListener('online', surReseau); window.removeEventListener('offline', surReseau); return; }
    if (e.type === 'online') { relire(); return; }
    if (!etat.importId) return;
    const m = modele();
    majBlocLecture(zone, m, gestes); majBlocCouverture(zone, m, gestes);
  };
  window.addEventListener('online', surReseau);
  window.addEventListener('offline', surReseau);
  // Lot E (D-E8) : la session est lue SANS retenir l'écran ; à la résolution, le bloc du pas 1 (et le bloc lecture du pas 2) SEULS sont remplacés.
  if (etat.session === 'verification') {
    sessionAssistant(ctx).then((s) => { etat.session = s ? 'prete' : null; const m = modele(); majBlocCouverture(zone, m, gestes); majBlocLecture(zone, m, gestes); }).catch(() => {});
  }
  // Lot E (§ 4.6) : la reprise d'une couverture (#/add/livre?import=<imp>) — la ligne est RELUE (jamais un état mémorisé), sa couverture revalidée
  // (shaBornee) ; aucun appel à l'assistant ici (D-E13 : le rattrapage d'Open Library, lui, repart si en ligne). Le rendu suit relire(), comme après un vol.
  const demande = typeof query?.import === 'string' && query.import ? query.import : null;
  if (demande) {
    const ligne = await r.get('imports', demande);
    if (!ligne || ligne.kind !== 'couverture') dire(t('Import introuvable.'));
    else if (IMPORTS_TERMINES.includes(ligne.status)) dire(t('Cet import est terminé.'));
    else {
      etat.importId = ligne.id;
      etat.generationLecture = etat.generation;
      const sha = shaBornee(ligne.cover_sha256);
      const fichier = sha ? await r.getFile(sha) : null;
      etat.couverture = fichier?.blob instanceof Blob
        ? { sha256: sha, apercu: urlDeBlob(fichier.blob), message: t('Couverture enregistrée.'), enCours: false, touchee: true }
        : { ...COUVERTURE_VIDE(), sha256: sha, message: t('La couverture n’est pas sur cet appareil.'), touchee: true };
      etat.pas = 2;
    }
  }
  // Les tests lisent l'état par là (F3/F4) : un fait observable, jamais un délai. Aucune vue ne s'en sert.
  root.etatRoute = () => ({ ...etat, couverture: { ...etat.couverture }, champs: { ...etat.champs } });
  dessiner();
  if (etat.importId) await relire();
  rendue = true; // ronde 1 : à partir d'ici, une route hors du document est démontée (demontee()) — à garder juste avant le `return`
  return root;
}
