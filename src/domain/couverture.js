// Règles PURES du lot E « Un livre reconnu depuis sa couverture » (spec docs/superpowers/specs/2026-10-19-couverture-lue-design.md, § 3.1, § 3.5).
// Aucun accès à la base, aucun réseau, aucun texte d'écran : la route (src/ui/livre-ajout.js) écrit et traduit. Une fiche d'Open Library par titre est une
// fiche d'ŒUVRE (elle agrège ISBN, éditeurs et langues de toutes les éditions, mesuré § 3.4) : un ISBN n'est proposé que s'il est le SEUL de l'œuvre
// (isbnUnique, jamais isbn[0]) ; une correspondance exige le titre ET un auteur (B1 : jamais le seul titre).
import { validerIsbn } from '../core/isbn.js';
import { ligneImportNeuve } from './import-cible.js';

// Une empreinte de files : 64 caractères hexadécimaux minuscules, sinon null (même règle que photoBornee, T4-R1-d). Une valeur relue du journal (synchro,
// archive, reprise) n'atteint jamais getFile sans passer ici (I-E1).
export const shaBornee = (s) => (typeof s === 'string' && /^[0-9a-f]{64}$/.test(s) ? s : null);

// § 3.1 : la ligne du journal d'une couverture — mêmes statuts, transitions et battement que le lot A ; cover_sha256 NEUF, pointeur souple vers files
// (hors RELATIONS) ; aucune page, aucune recette, aucune édition avant la fermeture (D-E12). Créée a_lancer, dans son vocabulaire fermé (D-12 du lot A) :
// par ligneImportNeuve, LA fabrique des lignes neuves du journal (lot D, D-D12, R-D-15 : une définition des 19 champs, statut ET sorte gardés par
// assertVocabulaire) ; cover_sha256 est posé sur la ligne qu'elle rend.
export function fabriquerImportCouverture({ id, coverSha256, deviceId = null } = {}) {
  const sha = shaBornee(coverSha256);
  if (!sha) throw new TypeError('fabriquerImportCouverture : empreinte de couverture attendue (64 caractères hexadécimaux)');
  const ligne = { ...ligneImportNeuve({ id, kind: 'couverture', device_id: deviceId ?? null }), cover_sha256: sha };
  return ligne;
}

// Exactement UN ISBN-13 distinct dans la liste (un ISBN-10 valide est converti, le reste écarté) → lui ; zéro ou plusieurs → null (R-E-1).
export function isbnUnique(liste) {
  if (!Array.isArray(liste)) return null;
  const vus = new Set();
  for (const v of liste) { if (typeof v !== 'string') continue; const r = validerIsbn(v); if (r.ok) vus.add(r.isbn13); }
  return vus.size === 1 ? [...vus][0] : null;
}

// § 3.5 : sans accents, sans casse ; toute ponctuation (\p{P} : « & », tirets, deux-points…) et toute espace → une espace.
export const normaliserTitre = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\p{P}\s]+/gu, ' ').trim();
// Le titre BRUT d'un candidat coupé au premier séparateur de sous-titre qu'Open Library colle au titre (deux-points, point-virgule, parenthèse, tirets
// cadratin et demi-cadratin, trait d'union ENTOURÉ d'espaces) ; sans séparateur, le candidat entier.
const SEPARATEUR_SOUS_TITRE = /\s*[:;(—–]\s*|\s-\s/u;
export function troncTitre(candidat) { const s = String(candidat ?? ''); const m = s.match(SEPARATEUR_SOUS_TITRE); return m ? s.slice(0, m.index) : s; }
// Égalité normalisée avec le candidat ou avec son tronc — JAMAIS un préfixe libre (« À la di Stasio » ↔ « À LA DI STASIO 3 » est faux).
export function titreCorrespond(lu, candidat) { const n = normaliserTitre(lu); return !!n && (n === normaliserTitre(candidat) || n === normaliserTitre(troncTitre(candidat))); }
const mots = (s) => normaliserTitre(s).split(' ').filter(Boolean);
export const motsDistinctifsAuteur = (s) => mots(s).filter((m) => Array.from(m).length >= 3);
// Un mot distinctif (3 lettres ou plus) d'UN auteur lu figure parmi les mots de L'UN des auteurs de la fiche ; sans auteur lu → faux.
export function auteurCorrespond(auteursLus, auteursFiche) {
  const fiche = (Array.isArray(auteursFiche) ? auteursFiche : []).filter((a) => typeof a === 'string').map(mots);
  return (Array.isArray(auteursLus) ? auteursLus : []).filter((a) => typeof a === 'string').some((a) => motsDistinctifsAuteur(a).some((m) => fiche.some((f) => f.includes(m))));
}
// La PREMIÈRE fiche au titre ET à l'auteur concordants (« Pâtisserie » ou « Jerusalem » existent chez plusieurs auteurs) ; null sinon.
export function choisirProposition(lecture, fiches) {
  return (Array.isArray(fiches) ? fiches : []).find((f) => f && titreCorrespond(lecture?.title, f.title) && auteurCorrespond(lecture?.authors, f.authors)) ?? null;
}

// Les champs du pas 2 depuis une lecture validée (règle de fusionnerFiche : ne remplir que ce qui est vide). Un champ nommé incertain n'est PAS posé :
// son nom va dans `incertains` (title, author, publisher, language) et sa valeur lue, si elle existe, dans `placeholders` (D-E16 ; jamais pour la langue,
// un <select>). La langue lue est posée sauf langueTouchee (C2). Le sous-titre est une mention (D-E15), nulle s'il est incertain.
const LANGUES = Object.freeze({ fr: 'fr', fre: 'fr', fra: 'fr', en: 'en', eng: 'en' });
const SOURCE = Object.freeze({ title: 'title', author: 'authors', publisher: 'publisher' });
export function champsDepuisLecture(champs, lecture, { langueTouchee = false } = {}) {
  const out = { ...champs };
  const unc = new Set(Array.isArray(lecture?.uncertain) ? lecture.uncertain : []);
  const lus = { title: typeof lecture?.title === 'string' ? lecture.title : null, author: Array.isArray(lecture?.authors) && lecture.authors.length ? lecture.authors.join(', ') : null, publisher: typeof lecture?.publisher === 'string' ? lecture.publisher : null };
  const incertains = [];
  const placeholders = {};
  for (const k of ['title', 'author', 'publisher']) {
    if (unc.has(SOURCE[k])) { incertains.push(k); if (lus[k]) placeholders[k] = lus[k]; continue; }
    if (lus[k] && !String(out[k] ?? '').trim()) out[k] = lus[k];
  }
  if (unc.has('language')) incertains.push('language');
  else if (!langueTouchee && typeof lecture?.language === 'string') out.language = Object.hasOwn(LANGUES, lecture.language) ? LANGUES[lecture.language] : 'other';
  return { champs: out, incertains, placeholders, sousTitre: !unc.has('subtitle') && typeof lecture?.subtitle === 'string' ? lecture.subtitle : null };
}

// « Utiliser ces renseignements » : titre, auteur, éditeur et année REMPLACÉS par la valeur de la fiche quand elle est non vide, CONSERVÉS sinon (I-E9 :
// un champ que la fiche ne porte pas n'est jamais vidé) ; la langue si la fiche dit fr ou en et que la personne n'a pas touché au menu.
export function ficheDepuisProposition(champs, fiche, { langueTouchee = false } = {}) {
  const out = { ...champs };
  for (const k of ['title', 'author', 'publisher']) if (typeof fiche?.[k] === 'string' && fiche[k].trim()) out[k] = fiche[k];
  if (Number.isInteger(fiche?.year) || (typeof fiche?.year === 'string' && fiche.year.trim())) out.year = String(fiche.year);
  if (!langueTouchee && (fiche?.language === 'fr' || fiche?.language === 'en')) out.language = fiche.language;
  return out;
}

// R-E-9 : un ISBN VALIDE déjà là qui n'est pas celui de la fiche (un ISBN-10 comparé converti), ou une fiche sans ISBN → l'éditeur, l'année et la langue
// décrivent probablement une autre édition : omis. La fiche reçue n'est jamais modifiée sur place.
export function ficheSelonIsbn(fiche, isbn) {
  const v = validerIsbn(isbn);
  if (!v.ok || fiche?.isbn13 === v.isbn13) return fiche;
  return { ...fiche, publisher: '', year: '', language: null };
}
