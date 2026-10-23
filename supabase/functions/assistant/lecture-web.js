// Lecture d'une page web de recette (lot B « Recette web complète », spec docs/superpowers/specs/2026-10-19-recette-web-design.md § 6.2).
// Module PUR et FEUILLE : aucun import, Node (tests) et Deno (index.ts, logique.js). La page, son JSON-LD et tout ce qui en sort sont des
// DONNÉES HOSTILES : chaque propriété d'un objet JSON-LD est lue par Object.hasOwn (jamais Object.assign ni une boucle « in » depuis lui, S-11) ;
// aucune fonction ne lève (une entrée hostile rend null, [] ou '') ; l'analyse du HTML se fait par balayages LINÉAIRES (indexOf / lastIndexOf,
// une copie en minuscules ASCII de même longueur) — aucune expression régulière n'est appliquée au HTML entier, hormis la passe à motif borné
// de decoderEntites et les normalisations d'espaces (D-B12, S-4).
export const LIMITES_LECTURE = Object.freeze({
  url: 2048, redirections: 3, delaiSautMs: 15000, delaiTotalMs: 30000, page: 2 * 1024 * 1024, blocJsonLd: 512 * 1024, texte: 40000, texteMin: 40,
  maxTokens: 6000, titrePage: 300, auteur: 200, site: 200,
  // Les six bornes de recette recopient BORNES_EXTRACTION de src/domain/llm.js (épinglées en littéral des deux côtés ; la spec est la vérité commune).
  notes: 2000, titre: 200, ligne: 300, etape: 2000, lignes: 80, etapes: 60,
});

const propre = (o, k) => (o !== null && typeof o === 'object' && Object.hasOwn(o, k) ? o[k] : undefined);
const objetNu = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

// --- Adresse (D-B1, D-B19, S-8, S-12) -----------------------------------------------------------------------------------------------------------
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const SUFFIXES_REFUSES = ['.local', '.internal', '.localhost'];
const sansPointFinal = (h) => (h.endsWith('.') ? h.slice(0, -1) : h).toLowerCase();
// La règle d'hôte seule : un nom de domaine public (au moins un point), jamais localhost ni un suffixe interne, jamais une adresse IP littérale
// (IPv4, ou IPv6 entre crochets), jamais un hôte de `hotesRefuses` NI un de ses sous-domaines (l'hôte du projet : la fonction ne se rappelle
// jamais elle-même).
export function hoteAdmis(hostname, hotesRefuses = []) {
  if (typeof hostname !== 'string') return false;
  const h = sansPointFinal(hostname);
  if (!h || !h.includes('.') || h === 'localhost' || h.startsWith('[') || IPV4.test(h)) return false;
  if (SUFFIXES_REFUSES.some((s) => h.endsWith(s))) return false;
  const refuses = (Array.isArray(hotesRefuses) ? hotesRefuses : []).filter((x) => typeof x === 'string').map(sansPointFinal).filter(Boolean);
  return !refuses.some((x) => h === x || h.endsWith('.' + x));
}
// Une adresse lisible par la fonction : ASCII visible seulement (refusé AVANT new URL : un U+2028 ou un caractère de format ne passe jamais),
// au plus 2 048 points de code AVANT et APRÈS normalisation (`href` encode « " » en %22 : ce qui est rendu se relit admis), https, sans
// identifiants, sans port explicite, hôte admis. `href` sans fragment.
export function valideAdresse(url, { hotesRefuses = [] } = {}) {
  const refus = { ok: false, raison: 'interdit' };
  if (typeof url !== 'string' || url.length > LIMITES_LECTURE.url || !/^[\x21-\x7e]+$/.test(url)) return refus;
  let u;
  try { u = new URL(url); } catch { return refus; }
  if (u.protocol !== 'https:' || u.username !== '' || u.password !== '' || u.port !== '') return refus;
  if (!hoteAdmis(u.hostname, hotesRefuses)) return refus;
  u.hash = '';
  if (u.href.length > LIMITES_LECTURE.url) return refus;
  return { ok: true, href: u.href, hote: sansPointFinal(u.hostname) };
}

// --- Type et décodage (D-B20) --------------------------------------------------------------------------------------------------------------------
export function typeAdmis(contentType) {
  if (typeof contentType !== 'string') return false;
  const t = contentType.split(';')[0].trim().toLowerCase();
  return t === 'text/html' || t === 'application/xhtml+xml';
}
const labelValide = (label) => {
  const l = typeof label === 'string' ? label.trim().toLowerCase() : '';
  if (!l) return null;
  try { new TextDecoder(l); return l; } catch { return null; }
};
// Le charset du content-type, sinon celui d'un <meta> dans les 4 096 premiers octets (lus en ASCII), sinon utf-8 ; un label que TextDecoder
// refuse vaut utf-8.
export function lireCharset(contentType, octets) {
  const ct = typeof contentType === 'string' ? contentType : '';
  const m = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(ct);
  if (m) return labelValide(m[1]) ?? 'utf-8';
  let tete = '';
  if (octets && typeof octets.length === 'number') {
    const n = Math.min(octets.length, 4096);
    for (let i = 0; i < n; i += 1) tete += String.fromCharCode(octets[i] & 0xff);
  }
  const meta = /<meta\b[^>]{0,512}?charset\s*=\s*["']?\s*([a-z0-9_:.-]+)/i.exec(tete);
  return meta ? (labelValide(meta[1]) ?? 'utf-8') : 'utf-8';
}

// --- Texte : entités, balises, espaces -----------------------------------------------------------------------------------------------------------
// Table FERMÉE d'entités nommées (B-19) ; une entité inconnue reste telle quelle. Les entités numériques ne rendent qu'un point de code valide,
// hors surrogates, hors Cc, hors Cf, hors U+2028 / U+2029 (S-10) : sinon l'entité est retirée. Exception : les blancs de contrôle (&#9; &#10;
// &#11; &#12; &#13;) sont rendus tels quels, et la normalisation qui suit en fait une espace ou un saut de ligne — jamais deux mots collés.
const ENTITES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u{00A0}', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç',
  ugrave: 'ù', ucirc: 'û', ocirc: 'ô', icirc: 'î', iuml: 'ï', euml: 'ë', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔',
  hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', times: '×', oelig: 'œ', auml: 'ä',
  ouml: 'ö', uuml: 'ü', szlig: 'ß', copy: '©', reg: '®', euro: '€', middot: '·', bull: '•', trade: '™',
  Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Acirc: 'Â', Ccedil: 'Ç', Ugrave: 'Ù', Ucirc: 'Û', Ocirc: 'Ô', Icirc: 'Î', OElig: 'Œ',
  Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
});
// La classe des invisibles retirés (S-10), écrite UNE fois : Cc, Cf, surrogates isolés (Cs : jsonb les refuse), U+2028 / U+2029. Toujours
// employée APRÈS que les blancs de contrôle (\t \n \v \f \r) sont devenus une espace ou un saut de ligne.
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Cs}\u{2028}\u{2029}]/gu;
const BLANCS_DE_CONTROLE = new Set([9, 10, 11, 12, 13]);
// Hors surrogates : \p{Cs} de INVISIBLES les refuse (String.fromCodePoint rend le surrogate isolé).
const caractereAdmis = (cp) => Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff && String.fromCodePoint(cp).search(INVISIBLES) === -1;
export function decoderEntites(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,8});/gi, (m, corps) => {
    if (corps[0] === '#') {
      const cp = corps[1] === 'x' || corps[1] === 'X' ? parseInt(corps.slice(2), 16) : parseInt(corps.slice(1), 10);
      return BLANCS_DE_CONTROLE.has(cp) || caractereAdmis(cp) ? String.fromCodePoint(cp) : '';
    }
    return Object.hasOwn(ENTITES, corps) ? ENTITES[corps] : m;
  });
}
// Une copie en minuscules ASCII, de MÊME longueur (toLowerCase peut allonger une chaîne : « İ ») : les positions trouvées dans la copie valent
// dans l'original.
function minusculesAscii(s) {
  const morceaux = []; let debut = 0;
  for (let j = 0; j < s.length; j += 1) {
    const c = s.charCodeAt(j);
    if (c >= 65 && c <= 90) { if (j > debut) morceaux.push(s.slice(debut, j)); morceaux.push(String.fromCharCode(c + 32)); debut = j + 1; }
  }
  morceaux.push(s.slice(debut));
  return morceaux.join('');
}
const BLOCS = new Set(['br', 'p', 'li', 'div', 'section', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
// LE lecteur de balise (sansBalises et balayer), comme un navigateur : une balise commence par « < » suivi d'une lettre ASCII, de « / », de « ! »
// ou de « ? » (« a < b », « 3 <4 » sont du texte) ; son nom (au plus 16 lettres ou chiffres, minuscules) ne compte que s'il finit sur une espace,
// « / » ou « > » : `<main-banner>`, `<article-card>` et `<svg:rect/>` ne sont pas `main`, `article` ni `svg` (nom vide : balise inconnue).
const lettre = (c) => (c >= 97 && c <= 122) || (c >= 65 && c <= 90);
const finDeNom = (c) => Number.isNaN(c) || c === 32 || c === 9 || c === 10 || c === 12 || c === 13 || c === 47 || c === 62;
const debutDeBalise = (s, a) => { const c = s.charCodeAt(a + 1); return lettre(c) || c === 47 || c === 33 || c === 63; };
function nomEn(s, a) {
  let j = a + 1; const fermante = s.charCodeAt(j) === 47;
  if (fermante) j += 1;
  const debut = j;
  while (j < s.length && j - debut < 16) { const c = s.charCodeAt(j); if (lettre(c) || (c >= 48 && c <= 57)) j += 1; else break; }
  return { nom: j > debut && lettre(s.charCodeAt(debut)) && finDeNom(s.charCodeAt(j)) ? s.slice(debut, j).toLowerCase() : '', fermante };
}
// Retire les balises en une passe (indexOf '<' puis '>') : `<br>` et la FIN d'un bloc (p, li, div, section, tr, h1-h6) deviennent `separateur`,
// toute autre balise disparaît ; un « < » qui n'ouvre pas de balise reste du texte ; une balise sans « > » reste du texte (et arrête la passe).
function sansBalises(s, separateur) {
  const sortie = []; let i = 0; let j = 0;
  for (;;) {
    const a = s.indexOf('<', j);
    if (a === -1) break;
    if (!debutDeBalise(s, a)) { j = a + 1; continue; }
    const b = s.indexOf('>', a + 1);
    if (b === -1) break;
    sortie.push(s.slice(i, a));
    const { nom, fermante } = nomEn(s, a);
    if (BLOCS.has(nom) && (fermante || nom === 'br')) sortie.push(separateur);
    i = b + 1; j = i;
  }
  sortie.push(s.slice(i));
  return sortie.join('');
}
const espaces = (s) => s.replace(/[\s\u{00A0}]+/gu, ' ').trim();
// Pour TOUTE chaîne lue d'un JSON-LD (B-7) : entités décodées, balises retirées, blancs de contrôle → espace, invisibles retirés, espaces
// normalisés, rognée ; pas une chaîne → ''.
export function nettoyerChaineJsonLd(s) {
  if (typeof s !== 'string') return '';
  return espaces(sansBalises(decoderEntites(s), ' ').replace(/[\t\n\v\f\r]/g, ' ').replace(INVISIBLES, ''));
}
// Les lignes d'une chaîne d'instructions : la fin d'un bloc HTML et un saut de ligne (LF, CR LF ou CR seul) coupent ; chaque ligne nettoyée
// (\t \v \f → espace, invisibles retirés) ; les vides écartées.
function lignesDe(s) {
  if (typeof s !== 'string') return [];
  return sansBalises(decoderEntites(s), '\n').replace(/\r\n?/g, '\n').split('\n').map((l) => espaces(l.replace(/[\t\v\f]/g, ' ').replace(INVISIBLES, ''))).filter(Boolean);
}
const couperPoints = (s, max) => { let i = 0; for (let k = 0; k < max && i < s.length; k += 1) i += s.codePointAt(i) > 0xffff ? 2 : 1; return i; };
const borne = (s, max) => (s ? s.slice(0, couperPoints(s, max)) : '');
// Coupé AU MOT (la seule troncature d'un contenu, dite par « … ») : la description d'une recette (I-B2). Vague finale : la garde laissait passer
// max + 1 points de code (le client refuse notes > 2 000 : la recette JSON-LD entière était perdue) ; gardée telle quelle à max points au plus.
function auMot(s, max) {
  if (couperPoints(s, max) >= s.length) return s;
  const garde = s.slice(0, couperPoints(s, max - 1));
  const espace = garde.lastIndexOf(' ');
  return (espace >= Math.floor(garde.length / 2) ? garde.slice(0, espace) : garde).trimEnd() + '…';
}

// --- Étapes et durées (D-B25, B-8) ---------------------------------------------------------------------------------------------------------------
const FINS_DE_PHRASE = ['. ', '! ', '? ', '; '];
// Une étape de plus de `max` points de code est DÉCOUPÉE, rien n'est perdu : à la dernière fin de phrase avant `max`, sinon à la dernière espace,
// sinon net à `max` ; chaque morceau rogné, les vides écartés. Un `max` qui n'est pas un entier ≥ 1 rend [] (jamais de boucle sans fin).
export function decouperEtape(texte, max) {
  const sortie = [];
  if (!Number.isInteger(max) || max < 1) return sortie;
  let reste = typeof texte === 'string' ? texte.trim() : '';
  while (reste) {
    const limite = couperPoints(reste, max);
    if (limite >= reste.length) { sortie.push(reste); break; }
    const tranche = reste.slice(0, limite);
    let fin = Math.max(...FINS_DE_PHRASE.map((f) => tranche.lastIndexOf(f)));
    if (fin > 0) fin += 1; // la ponctuation reste dans le morceau
    else { const espace = tranche.lastIndexOf(' '); fin = espace > 0 ? espace : limite; }
    const morceau = reste.slice(0, fin).trim();
    if (morceau) sortie.push(morceau);
    reste = reste.slice(fin).trim();
  }
  return sortie;
}
export function dureeIsoEnMinutes(s) {
  if (typeof s !== 'string') return null;
  const m = /^P(?:(\d{1,4})D)?(?:T(?:(\d{1,4})H)?(?:(\d{1,5})M)?(?:(\d{1,6})S)?)?$/i.exec(s.trim());
  if (!m || m.slice(1).every((x) => x === undefined)) return null;
  return Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0) + Math.floor(Number(m[4] || 0) / 60);
}
const aType = (o, type) => { const t = propre(o, '@type'); return t === type || (Array.isArray(t) && t.includes(type)); };
// Les étapes d'un recipeInstructions : une chaîne (une étape par ligne), un tableau de chaînes, de HowToStep (text, sinon name) ou de HowToSection
// (itemListElement aplatis, sur DEUX niveaux de sections : une section dans une section est lue, pas une troisième) ; chaque étape découpée à
// `etape` ; la liste coupée à `etapes + 1` (assez pour un refus côté client). La profondeur compte chaque tableau ET chaque section, et elle est
// bornée pour TOUS (au-delà de PROFONDEUR_ETAPES, rien n'est lu) : une chaîne de sections imbriquées en objets ne remplit jamais la pile.
const PROFONDEUR_ETAPES = 5;
function etapesDe(v) {
  const L = LIMITES_LECTURE; const sortie = [];
  const pousser = (texte) => { for (const morceau of decouperEtape(texte, L.etape)) if (sortie.length <= L.etapes) sortie.push(morceau); };
  const visiter = (x, profondeur) => {
    if (sortie.length > L.etapes || profondeur > PROFONDEUR_ETAPES) return;
    if (typeof x === 'string') { for (const l of lignesDe(x)) pousser(l); return; }
    if (Array.isArray(x)) { for (const y of x) visiter(y, profondeur + 1); return; }
    if (!objetNu(x)) return;
    if (aType(x, 'HowToSection')) { visiter(propre(x, 'itemListElement'), profondeur + 1); return; }
    const texte = nettoyerChaineJsonLd(propre(x, 'text')) || nettoyerChaineJsonLd(propre(x, 'name'));
    if (texte) pousser(texte);
  };
  visiter(v, 0);
  return sortie;
}
// Portions (R-B-22, « rien d'inventé ») : un entier n'est pris que d'un nombre nu (`4`, nombre JSON `12`), d'un intervalle (`4-6`, `4–6`, `4 à 6`,
// `4 a 6` → la borne basse) ou d'un nombre accompagné d'UN mot de portion avant et / ou après (`portion(s)`, `personne(s)`, `part(s)`, `serving(s)`,
// `serves`, `pour`, `makes`, `yield(s)`), casse libre, blancs multiples admis ; toute autre forme → null (`750 ml`, `9x13 pan`, `Pour 4 gourmands`).
// Entier de 1 à 9 999 (la borne haute des quatre chiffres d'avant) ; zéro, négatif, non fini, non entier (`4.5`) → null. Un tableau : la première
// valeur qui donne un entier. Lecture LINÉAIRE : la chaîne nettoyée (nettoyerChaineJsonLd : entités, balises, blancs) est découpée en mots d'un seul
// balayage (« - » et « – » sont des mots à eux seuls), puis la grammaire [mot] nombre [séparateur nombre] [mot] est lue mot à mot : aucune regex de
// plus que celles, linéaires, de nettoyerChaineJsonLd (mesuré : 100 000 chiffres ou espaces en quelques millisecondes).
const MOTS_DE_PORTION = new Set(['portion', 'portions', 'personne', 'personnes', 'part', 'parts', 'serving', 'servings', 'serves', 'pour', 'makes', 'yield', 'yields']);
const SEPARATEURS_INTERVALLE = new Set(['-', '\u{2013}', 'à', 'a']);
const PORTIONS_MAX = 9999;
const portionsAdmises = (n) => (Number.isInteger(n) && n >= 1 && n <= PORTIONS_MAX ? n : null);
function motsDe(s) {
  const mots = []; let debut = 0;
  for (let k = 0; k <= s.length; k += 1) {
    const c = k < s.length ? s.charCodeAt(k) : 32;
    const tiret = c === 45 || c === 0x2013;
    if (c === 32 || tiret) { if (k > debut) mots.push(s.slice(debut, k)); if (tiret) mots.push(s[k]); debut = k + 1; }
  }
  return mots;
}
function nombreNu(mot) {
  if (typeof mot !== 'string' || mot.length < 1) return null;
  for (let k = 0; k < mot.length; k += 1) { const c = mot.charCodeAt(k); if (c < 48 || c > 57) return null; }
  return portionsAdmises(Number(mot));
}
function portionsDeTexte(s) {
  const mots = motsDe(nettoyerChaineJsonLd(s).normalize('NFC').toLowerCase());
  let i = 0;
  if (MOTS_DE_PORTION.has(mots[i])) i += 1;
  let n = nombreNu(mots[i]);
  if (n === null) return null;
  i += 1;
  if (SEPARATEURS_INTERVALLE.has(mots[i])) {
    const haut = nombreNu(mots[i + 1]);
    if (haut === null) return null;
    n = Math.min(n, haut); i += 2;
  }
  if (MOTS_DE_PORTION.has(mots[i])) i += 1;
  return i === mots.length ? n : null;
}
function portionsDe(v, profondeur = 0) {
  if (typeof v === 'number') return portionsAdmises(v);
  if (typeof v === 'string') return portionsDeTexte(v);
  if (Array.isArray(v) && profondeur === 0) for (const x of v) { const n = portionsDe(x, 1); if (n !== null) return n; }
  return null;
}

// --- Le balayage du HTML (D-B12, S-4) ---------------------------------------------------------------------------------------------------------------
// UNE passe linéaire : chaque balise est trouvée par indexOf('<') puis indexOf('>') et son nom lu sur place par `nomEn` (le lecteur commun) ;
// la copie en minuscules (même longueur) sert aux recherches insensibles à la casse. Un « < » qui n'ouvre pas de balise est du texte ; une balise
// sans « > » est du texte et ARRÊTE le balayage ; un commentaire, un CDATA ou un élément sauté (script, style, noscript, svg, template) sans
// fermeture aussi. Rien n'est relu deux fois. Deux recherches en avant, chacune linéaire : la fermeture d'un élément sauté (le balayage reprend
// après elle) et celle du premier <title> (faite une seule fois, sa lecture est bornée à 4 096 caractères sans fermeture). Rend :
//   texte : le HTML sans balises (la fin d'un bloc et <br> → \n), entités NON décodées ; zones : main / article / body → [début, fin] dans `texte`
//   (le premier de chaque nom, fermé au « </nom> » qui équilibre son ouvrant ; fin nulle = jusqu'au bout) ; horsTexte : [début, fin, nom], les
//   tranches de `texte` couvertes par un nav, header, footer, aside ou form FERMÉ (profondeur 1 par nom : un élément imbriqué dans un autre du même
//   nom est coupé au premier « </nom » ; un élément jamais fermé n'est pas une tranche, son étendue est inconnue) ; blocs : le contenu brut de chaque
//   <script type="application/ld+json"> fermé (≤ 512 Kio) ; titre : le contenu brut du premier <title> ; metas : og:site_name, author et og:image (lot F) → content brut.
const SAUTES = new Set(['script', 'style', 'noscript', 'svg', 'template']);
const HORS_TEXTE = new Set(['nav', 'header', 'footer', 'aside', 'form']);
const ZONES = new Set(['main', 'article', 'body']);
const TYPE_JSONLD = /\btype\s*=\s*["']?\s*application\/ld\+json/;
// La fermeture « </nom » d'un élément, suivie d'une espace, de « / » ou de « > » (« </scriptx » n'en est pas une), à partir de `depuis` ; -1 sinon.
// Linéaire : chaque candidat écarté fait repartir la recherche après lui.
function fermetureEn(bas, nom, depuis) {
  const motif = '</' + nom;
  for (let f = bas.indexOf(motif, depuis); f !== -1; f = bas.indexOf(motif, f + motif.length)) if (finDeNom(bas.charCodeAt(f + motif.length))) return f;
  return -1;
}
function lireMetaTranche(html, bas, a, b, metas) {
  if (b - a > 2048) return;
  const tranche = bas.slice(a, b + 1);
  // Ronde 1 du lot F (S-4) : « =\s* » puis, au plus, un guillemet suivi de blancs — le même langage que « =\s*["']?\s* », sans ses deux suites
  // de blancs adjacentes, qui revenaient en arrière de façon quadratique sur une longue suite de blancs (≈ 3,4 s pour 2 Mio de balises fermées).
  const cle = /\b(?:property|name)\s*=\s*(?:["']\s*)?(og:site_name|author|og:image)["'\s/>]/.exec(tranche);
  if (!cle || metas.has(cle[1])) return;
  const c = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/d.exec(tranche);
  if (!c) return;
  const [d, f] = c.indices[c[1] !== undefined ? 1 : c[2] !== undefined ? 2 : 3];
  metas.set(cle[1], html.slice(a + d, a + f)); // la même tranche dans l'original (la copie a la même longueur)
}
function balayer(html) {
  const bas = minusculesAscii(html);
  const sortie = []; let n = 0;
  const emettre = (x) => { if (x) { sortie.push(x); n += x.length; } };
  const zones = new Map(); const profondeurs = new Map(); const ouverts = new Map(); const horsTexte = []; const blocs = []; const metas = new Map();
  let titre = null; let i = 0; let j = 0; // i : début du texte pas encore émis ; j : où chercher le prochain « < »
  for (;;) {
    const a = html.indexOf('<', j);
    if (a === -1) { emettre(html.slice(i)); break; }
    if (!debutDeBalise(bas, a)) { j = a + 1; continue; } // « a < b » : du texte
    emettre(html.slice(i, a));
    if (bas.charCodeAt(a + 1) === 33) { // « <! » : commentaire, CDATA (sautés jusqu'à leur fin), ou doctype (une balise ordinaire)
      if (bas.startsWith('<!--', a)) { const f = bas.indexOf('-->', a + 4); if (f === -1) break; i = j = f + 3; continue; }
      if (bas.startsWith('<![cdata[', a)) { const f = bas.indexOf(']]>', a + 9); if (f === -1) break; i = j = f + 3; continue; }
    }
    const b = html.indexOf('>', a + 1);
    if (b === -1) { emettre(html.slice(a)); break; }
    const { nom, fermante } = nomEn(bas, a);
    i = j = b + 1;
    // Un élément sauté est lu jusqu'à sa fermeture ; `<svg …/>` auto-fermant (honoré par HTML pour svg seulement) est fermé sur place.
    if (!fermante && SAUTES.has(nom) && !(nom === 'svg' && bas.charCodeAt(b - 1) === 47)) {
      const f = fermetureEn(bas, nom, b + 1);
      if (f === -1) break;
      if (nom === 'script' && b - a <= 2048 && f - (b + 1) <= LIMITES_LECTURE.blocJsonLd && TYPE_JSONLD.test(bas.slice(a, b + 1))) blocs.push(html.slice(b + 1, f));
      const g = bas.indexOf('>', f);
      if (g === -1) break;
      i = j = g + 1; continue;
    }
    if (!fermante && nom === 'title' && titre === null) { const f = fermetureEn(bas, 'title', b + 1); titre = html.slice(b + 1, f === -1 ? Math.min(html.length, b + 1 + 4096) : f); }
    if (!fermante && nom === 'meta') lireMetaTranche(html, bas, a, b, metas);
    if (ZONES.has(nom)) { // la zone se ferme au « </nom> » qui équilibre son ouvrant (un <article> imbriqué ne la coupe pas)
      const z = zones.get(nom);
      if (!fermante) { if (!z) { zones.set(nom, [n, null]); profondeurs.set(nom, 1); } else if (z[1] === null) profondeurs.set(nom, profondeurs.get(nom) + 1); }
      else if (z && z[1] === null) { profondeurs.set(nom, profondeurs.get(nom) - 1); if (profondeurs.get(nom) === 0) z[1] = n; }
    }
    if (HORS_TEXTE.has(nom)) { if (!fermante && !ouverts.has(nom)) ouverts.set(nom, n); else if (fermante && ouverts.has(nom)) { horsTexte.push([ouverts.get(nom), n, nom]); ouverts.delete(nom); } }
    if (fermante ? BLOCS.has(nom) : nom === 'br') emettre('\n');
  }
  return { texte: sortie.join(''), zones, horsTexte, blocs, titre, metas };
}

// --- JSON-LD (D-B2, D-B25) -------------------------------------------------------------------------------------------------------------------------
// Les blocs <script type="application/ld+json"> du balayage (casse et ordre des attributs libres, guillemets simples ou doubles) : commentaires et
// CDATA retirés, JSON.parse sous try (illisible → ignoré), un tableau de premier niveau et un @graph aplatis ; rend les objets nus.
function objetsDesBlocs(blocs) {
  const objets = [];
  const ajouter = (o) => {
    if (!objetNu(o)) return;
    if (propre(o, '@type') !== undefined) objets.push(o);
    const g = propre(o, '@graph');
    if (Array.isArray(g)) for (const x of g) if (objetNu(x)) objets.push(x);
  };
  for (const brut of blocs) {
    let lu;
    try { lu = JSON.parse(brut.replace(/<!--|-->|<!\[CDATA\[|\]\]>/gi, '').trim()); } catch { continue; }
    if (Array.isArray(lu)) { for (const o of lu) ajouter(o); } else ajouter(lu);
  }
  return objets;
}
export function extraireBlocsJsonLd(html) {
  return typeof html === 'string' ? objetsDesBlocs(balayer(html).blocs) : [];
}
export function trouverRecettes(objets) {
  return (Array.isArray(objets) ? objets : []).filter((o) => aType(o, 'Recipe'));
}
const nomDe = (x) => (typeof x === 'string' ? nettoyerChaineJsonLd(x) : objetNu(x) ? nettoyerChaineJsonLd(propre(x, 'name')) : '');
export function auteurDe(objet) {
  const a = propre(objet, 'author');
  const liste = Array.isArray(a) ? a : [a];
  for (const x of liste) { const n = nomDe(x); if (n) return borne(n, LIMITES_LECTURE.auteur); }
  return null;
}
// L'objet Recipe → la sortie du contrat § 3.4 (plus total_minutes) et `lisible` (au moins une ligne OU une étape, D-B25).
export function recetteDepuisJsonLd(objet) {
  const L = LIMITES_LECTURE;
  let bruts = propre(objet, 'recipeIngredient');
  if (typeof bruts === 'string') bruts = [bruts];
  const ingredients = [];
  for (const x of Array.isArray(bruts) ? bruts : []) {
    if (ingredients.length > L.lignes) break; // coupée à lignes + 1 (S-16)
    const t = typeof x === 'string' ? nettoyerChaineJsonLd(x) : '';
    if (t) ingredients.push({ source_text: t, uncertain: false });
  }
  const steps = etapesDe(propre(objet, 'recipeInstructions')).map((text) => ({ text }));
  const description = nettoyerChaineJsonLd(propre(objet, 'description'));
  const recette = {
    title: nettoyerChaineJsonLd(propre(objet, 'name')) || null,
    servings: portionsDe(propre(objet, 'recipeYield')),
    prep_minutes: dureeIsoEnMinutes(propre(objet, 'prepTime')), cook_minutes: dureeIsoEnMinutes(propre(objet, 'cookTime')), total_minutes: dureeIsoEnMinutes(propre(objet, 'totalTime')),
    ingredients, steps, printed_page: null, sub_recipes: [], uncertain_fields: [],
    notes: description ? auMot(description, L.notes) : null,
    incomplete: !ingredients.length || !steps.length, missing_page: false,
  };
  return { recette, lisible: ingredients.length > 0 || steps.length > 0 };
}

// --- Métadonnées de page (titre, site, auteur) ------------------------------------------------------------------------------------------------------
const siteDuBalayage = (objet, metas) => {
  const p = propre(objet, 'publisher');
  for (const x of Array.isArray(p) ? p : [p]) { const n = objetNu(x) ? nettoyerChaineJsonLd(propre(x, 'name')) : ''; if (n) return borne(n, LIMITES_LECTURE.site); }
  const m = nettoyerChaineJsonLd(metas.get('og:site_name'));
  return m ? borne(m, LIMITES_LECTURE.site) : null;
};
const auteurDuBalayage = (metas) => { const m = nettoyerChaineJsonLd(metas.get('author')); return m ? borne(m, LIMITES_LECTURE.auteur) : null; };
const titreDuBalayage = (brut) => { const t = nettoyerChaineJsonLd(brut); return t ? borne(t, LIMITES_LECTURE.titrePage) : null; };
// publisher.name (objet ou tableau) sinon <meta property="og:site_name" content="…">.
export function siteDe(objet, html) {
  return siteDuBalayage(objet, typeof html === 'string' ? balayer(html).metas : new Map());
}
export function titreDe(html) {
  return typeof html === 'string' ? titreDuBalayage(balayer(html).titre) : null;
}

// --- Lot F « Les plats en images » (spec § 6.1) : l'image de la page et son transport ----------------------------------------------------------
// L'image d'une page est une DONNÉE HOSTILE comme le reste : lue par Object.hasOwn, nettoyée, résolue contre l'adresse finale (une adresse
// relative ou sans schéma), puis revalidée par valideAdresse (https, hôte public, ni IP, ni port, ni identifiants, ≤ 2 048, hôte du projet refusé).
export const LIMITES_IMAGE = Object.freeze({
  url: LIMITES_LECTURE.url, octets: 2 * 1024 * 1024, redirections: LIMITES_LECTURE.redirections, delaiSautMs: LIMITES_LECTURE.delaiSautMs,
  delaiTotalMs: LIMITES_LECTURE.delaiTotalMs, types: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
});
export function typeImageAdmis(contentType) {
  if (typeof contentType !== 'string') return null;
  const t = contentType.split(';')[0].trim().toLowerCase();
  return LIMITES_IMAGE.types.includes(t) ? t : null;
}
// Les premiers octets doivent dire le type annoncé (S-7) : un HTML, un PDF ou une PNG annoncés image/jpeg ne sont jamais relayés.
export function signatureImage(octets) {
  try {
    if (!(octets instanceof Uint8Array)) return null;
    const a = (i, liste) => octets.length >= i + liste.length && liste.every((x, k) => octets[i + k] === x);
    if (a(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (a(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
    if (a(0, [0x52, 0x49, 0x46, 0x46]) && a(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
    return null;
  } catch { return null; }
}
// `image` d'un objet Recipe : une chaîne ; un objet nu → url, sinon contentUrl ; un tableau → le premier élément qui rend une adresse — un tableau,
// ou un tableau de tableaux, au plus (PROFONDEUR_IMAGE = 2 : trois niveaux de tableaux → null). Jamais Object.assign ni une boucle « in » (S-11 de B).
const PROFONDEUR_IMAGE = 2;
function adresseDe(x, profondeur) {
  if (typeof x === 'string') return nettoyerChaineJsonLd(x) || null;
  if (Array.isArray(x)) {
    if (profondeur >= PROFONDEUR_IMAGE) return null;
    for (const y of x) { const a = adresseDe(y, profondeur + 1); if (a) return a; }
    return null;
  }
  if (objetNu(x)) {
    const u = propre(x, 'url'); const c = propre(x, 'contentUrl');
    return (typeof u === 'string' && nettoyerChaineJsonLd(u)) || (typeof c === 'string' && nettoyerChaineJsonLd(c)) || null;
  }
  return null;
}
export function imageDe(objet) {
  try { return adresseDe(propre(objet, 'image'), 0); } catch { return null; }
}
// <meta property|name="og:image" content="…"> : capturée par le balayage UNIQUE de la page (lireMetaTranche, la première), décodée, rognée (P-4).
const ogDesMetas = (metas) => { const b = metas.get('og:image'); const v = typeof b === 'string' ? decoderEntites(b).trim() : ''; return v || null; };
export function imageOgDe(html) {
  return typeof html === 'string' ? ogDesMetas(balayer(html).metas) : null;
}
// D-F3 : l'image du Recipe RETENU, sinon og:image — sauf sur une page de liste (autresRecettes > 0 : l'image de partage serait celle d'une autre recette).
function imageUrlDesMetas(objet, metas, { urlFinale, hotesRefuses = [], autresRecettes = 0 } = {}) {
  try {
    const candidat = (objet ? imageDe(objet) : null) ?? (autresRecettes > 0 ? null : ogDesMetas(metas));
    if (!candidat) return null;
    let abs;
    try { abs = new URL(candidat, urlFinale); } catch { return null; }
    const v = valideAdresse(abs.href, { hotesRefuses });
    return v.ok ? v.href : null;
  } catch { return null; }
}
export function imageUrlDe(objet, html, { urlFinale, hotesRefuses = [], autresRecettes = 0 } = {}) {
  return imageUrlDesMetas(objet, typeof html === 'string' ? balayer(html).metas : new Map(), { urlFinale, hotesRefuses, autresRecettes });
}
// Le base64 d'une image (avec remplissage) : par tranches de 24 576 octets, un MULTIPLE DE 3 — une tranche multiple de 3 n'a jamais de
// remplissage, donc seul le DERNIER morceau peut finir par « = » (rév. 1 de la spec : 32 Kio plaçaient des « = » au milieu). Node et Deno.
export const TRANCHE_BASE64 = 24576;
export function versBase64(octets) {
  const morceaux = [];
  for (let i = 0; i < octets.length; i += TRANCHE_BASE64) morceaux.push(btoa(String.fromCharCode(...octets.subarray(i, i + TRANCHE_BASE64))));
  return morceaux.join('');
}

// --- Texte principal (D-B2, B-9, S-10) ------------------------------------------------------------------------------------------------------------
// La zone : le premier <main>, sinon le premier <article>, sinon <body>, sinon tout ; les tranches nav / header / footer / aside / form qui
// COMMENCENT dans la zone en sont retirées (une tranche ouverte avant la zone, comme un <form> qui enveloppe un <main>, ne l'efface donc pas).
// Un <form> n'est retiré que d'une zone <main> ou <article> (infolettre, commentaires) : sur un vieux site sans eux, il enveloppe souvent tout le
// <body> (ASP.NET). Et si le retrait des <form> laisse moins de `texteMin` points de code, ils restent : un <form> ne vide jamais la zone.
const peuDeTexte = (s) => couperPoints(s, LIMITES_LECTURE.texteMin - 1) >= s.length;
function zoneSans(texte, debut, fin, tranches) {
  const morceaux = []; let k = debut;
  for (const [d, f] of tranches) {
    if (d < debut || d >= fin) continue;
    if (d > k) morceaux.push(texte.slice(k, d));
    k = Math.max(k, Math.min(f, fin));
  }
  if (k < fin) morceaux.push(texte.slice(k, fin));
  // Entités décodées ; CR LF et CR seul → saut ; \t \v \f et insécable → espace ; invisibles retirés ; lignes rognées ; trois sauts et plus → deux.
  return decoderEntites(morceaux.join(''))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v\u{00A0}]+/gu, ' ')
    .replace(INVISIBLES, (c) => (c === '\n' ? c : ''))
    .split('\n').map((l) => l.replace(/ {2,}/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function texteDuBalayage({ texte, zones, horsTexte }, max) {
  const z = zones.get('main') ?? zones.get('article') ?? zones.get('body') ?? [0, null];
  const debut = z[0]; const fin = z[1] ?? texte.length;
  const tranches = [...horsTexte].sort((x, y) => x[0] - y[0]);
  const sansForm = tranches.filter((t) => t[2] !== 'form');
  const formRetire = zones.has('main') || zones.has('article');
  let brut = zoneSans(texte, debut, fin, formRetire ? tranches : sansForm);
  if (formRetire && sansForm.length < tranches.length && peuDeTexte(brut)) brut = zoneSans(texte, debut, fin, sansForm);
  const n = couperPoints(brut, max);
  return n >= brut.length ? { texte: brut, coupe: false } : { texte: brut.slice(0, n), coupe: true };
}
export function textePrincipal(html, max = LIMITES_LECTURE.texte) {
  return typeof html === 'string' ? texteDuBalayage(balayer(html), max) : { texte: '', coupe: false };
}

// --- Assemblage (§ 6.2) -----------------------------------------------------------------------------------------------------------------------------
// UN balayage ; les Recipe → la PREMIÈRE LISIBLE (les illisibles sautées et non comptées) ; `autres` = les lisibles au-delà. `texte` et
// `texte_coupe` seulement sans JSON-LD lisible. `lue_le` est posé par index.ts. `contentType` est gardé pour la forme (le décodage est fait avant).
export function lirePageHtml({ html, urlFinale, contentType, hotesRefuses = [] } = {}) {
  void contentType;
  const scan = balayer(typeof html === 'string' ? html : '');
  let premiere = null; let objetRecette = null; let autres = 0;
  for (const o of trouverRecettes(objetsDesBlocs(scan.blocs))) {
    const r = recetteDepuisJsonLd(o);
    if (!r.lisible) continue;
    if (premiere === null) { premiere = r.recette; objetRecette = o; } else autres += 1;
  }
  // Lot F (D-F3) : l'image de l'objet Recipe RETENU (brut), sinon og:image — écartée d'une page de liste ; null sans l'un ni l'autre. `autres`
  // ne compte que les Recipe lisibles APRÈS la première : il vaut 0 sans Recipe lisible (chemin modele).
  const image_url = imageUrlDesMetas(objetRecette, scan.metas, { urlFinale, hotesRefuses, autresRecettes: autres });
  let hote = null;
  try { hote = sansPointFinal(new URL(urlFinale).hostname); } catch { hote = null; }
  const commun = { url_finale: typeof urlFinale === 'string' ? urlFinale : null, hote, titre_page: titreDuBalayage(scan.titre), auteur: (objetRecette ? auteurDe(objetRecette) : null) ?? auteurDuBalayage(scan.metas), site: siteDuBalayage(objetRecette, scan.metas), lue_le: null };
  if (premiere) return { jsonld: { recette: premiere, autres }, texte: null, texte_coupe: false, page: { ...commun, autres_recettes: autres, texte_coupe: false, image_url } };
  const { texte, coupe } = texteDuBalayage(scan, LIMITES_LECTURE.texte);
  return { jsonld: null, texte, texte_coupe: coupe, page: { ...commun, autres_recettes: 0, texte_coupe: coupe, image_url } };
}
