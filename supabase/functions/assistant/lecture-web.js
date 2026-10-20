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
// (IPv4, ou IPv6 entre crochets), jamais un hôte de `hotesRefuses` (l'hôte du projet : la fonction ne se rappelle jamais elle-même).
export function hoteAdmis(hostname, hotesRefuses = []) {
  if (typeof hostname !== 'string') return false;
  const h = sansPointFinal(hostname);
  if (!h || !h.includes('.') || h === 'localhost' || h.startsWith('[') || IPV4.test(h)) return false;
  if (SUFFIXES_REFUSES.some((s) => h.endsWith(s))) return false;
  const refuses = (Array.isArray(hotesRefuses) ? hotesRefuses : []).filter((x) => typeof x === 'string').map(sansPointFinal);
  return !refuses.includes(h);
}
// Une adresse lisible par la fonction : ASCII visible seulement (refusé AVANT new URL : un U+2028 ou un caractère de format ne passe jamais),
// au plus 2 048 points de code, https, sans identifiants, sans port explicite, hôte admis. `href` sans fragment.
export function valideAdresse(url, { hotesRefuses = [] } = {}) {
  const refus = { ok: false, raison: 'interdit' };
  if (typeof url !== 'string' || url.length > LIMITES_LECTURE.url || !/^[\x21-\x7e]+$/.test(url)) return refus;
  let u;
  try { u = new URL(url); } catch { return refus; }
  if (u.protocol !== 'https:' || u.username !== '' || u.password !== '' || u.port !== '') return refus;
  if (!hoteAdmis(u.hostname, hotesRefuses)) return refus;
  u.hash = '';
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
// hors surrogates, hors Cc, hors Cf, hors U+2028 / U+2029 (S-10) : sinon l'entité est retirée.
const ENTITES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u{00A0}', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç',
  ugrave: 'ù', ucirc: 'û', ocirc: 'ô', icirc: 'î', iuml: 'ï', euml: 'ë', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔',
  hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', times: '×', oelig: 'œ', auml: 'ä',
  ouml: 'ö', uuml: 'ü', szlig: 'ß', copy: '©', reg: '®', euro: '€', middot: '·', bull: '•', trade: '™',
  Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Acirc: 'Â', Ccedil: 'Ç', Ugrave: 'Ù', Ucirc: 'Û', Ocirc: 'Ô', Icirc: 'Î', OElig: 'Œ',
  Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
});
const INVISIBLE = /[\p{Cc}\p{Cf}\u{2028}\u{2029}]/u;
const caractereAdmis = (cp) => Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) && !INVISIBLE.test(String.fromCodePoint(cp));
export function decoderEntites(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,8});/gi, (m, corps) => {
    if (corps[0] === '#') {
      const cp = corps[1] === 'x' || corps[1] === 'X' ? parseInt(corps.slice(2), 16) : parseInt(corps.slice(1), 10);
      return caractereAdmis(cp) ? String.fromCodePoint(cp) : '';
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
// Le nom d'une balise `<…>` (sa tranche, bornée par ses deux chevrons) et si elle ferme : « </p> » → { nom: 'p', fermante: true }.
const balise = (tranche) => { const m = /^<(\/?)\s*([a-z0-9]+)/i.exec(tranche); return m ? { nom: m[2].toLowerCase(), fermante: m[1] === '/' } : null; };
// Retire les balises en une passe (indexOf '<' puis '>') : `<br>` et la FIN d'un bloc (p, li, div, section, tr, h1-h6) deviennent `separateur`,
// toute autre balise disparaît ; un « < » sans « > » reste du texte (et arrête la passe).
function sansBalises(s, separateur) {
  const sortie = []; let i = 0;
  for (;;) {
    const a = s.indexOf('<', i);
    if (a === -1) { sortie.push(s.slice(i)); break; }
    const b = s.indexOf('>', a + 1);
    if (b === -1) { sortie.push(s.slice(i)); break; }
    sortie.push(s.slice(i, a));
    const x = balise(s.slice(a, Math.min(b + 1, a + 64)));
    if (x && BLOCS.has(x.nom) && (x.fermante || x.nom === 'br')) sortie.push(separateur);
    i = b + 1;
  }
  return sortie.join('');
}
const espaces = (s) => s.replace(/[\s\u{00A0}]+/gu, ' ').trim();
// Pour TOUTE chaîne lue d'un JSON-LD (B-7) : entités décodées, balises retirées, espaces normalisés, rognée ; pas une chaîne → ''.
export function nettoyerChaineJsonLd(s) {
  if (typeof s !== 'string') return '';
  return espaces(sansBalises(decoderEntites(s), ' ').replace(/(?!\n)[\p{Cc}\p{Cf}\u{2028}\u{2029}]/gu, ''));
}
// Les lignes d'une chaîne d'instructions : la fin d'un bloc HTML et un saut de ligne coupent ; chaque ligne nettoyée ; les vides écartées.
function lignesDe(s) {
  if (typeof s !== 'string') return [];
  return sansBalises(decoderEntites(s), '\n').split('\n').map((l) => espaces(l.replace(/[\p{Cc}\p{Cf}\u{2028}\u{2029}]/gu, ''))).filter(Boolean);
}
const couperPoints = (s, max) => { let i = 0; for (let k = 0; k < max && i < s.length; k += 1) i += s.codePointAt(i) > 0xffff ? 2 : 1; return i; };
const borne = (s, max) => (s ? s.slice(0, couperPoints(s, max)) : '');
// Coupé AU MOT (la seule troncature d'un contenu, dite par « … ») : la description d'une recette (I-B2).
function auMot(s, max) {
  if (s.length <= max || couperPoints(s, max + 1) >= s.length) return s;
  const garde = s.slice(0, couperPoints(s, max - 1));
  const espace = garde.lastIndexOf(' ');
  return (espace >= Math.floor(garde.length / 2) ? garde.slice(0, espace) : garde).trimEnd() + '…';
}

// --- Étapes et durées (D-B25, B-8) ---------------------------------------------------------------------------------------------------------------
const FINS_DE_PHRASE = ['. ', '! ', '? ', '; '];
// Une étape de plus de `max` points de code est DÉCOUPÉE, rien n'est perdu : à la dernière fin de phrase avant `max`, sinon à la dernière espace,
// sinon net à `max` ; chaque morceau rogné, les vides écartés.
export function decouperEtape(texte, max) {
  const sortie = [];
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
// (itemListElement aplatis, profondeur 2) ; chaque étape découpée à `etape` ; la liste coupée à `etapes + 1` (assez pour un refus côté client).
function etapesDe(v) {
  const L = LIMITES_LECTURE; const sortie = [];
  const pousser = (texte) => { for (const morceau of decouperEtape(texte, L.etape)) if (sortie.length <= L.etapes) sortie.push(morceau); };
  const visiter = (x, profondeur) => {
    if (sortie.length > L.etapes) return;
    if (typeof x === 'string') { for (const l of lignesDe(x)) pousser(l); return; }
    if (Array.isArray(x)) { if (profondeur <= 2) for (const y of x) visiter(y, profondeur + 1); return; }
    if (!objetNu(x)) return;
    if (aType(x, 'HowToSection')) { visiter(propre(x, 'itemListElement'), profondeur + 1); return; }
    const texte = nettoyerChaineJsonLd(propre(x, 'text')) || nettoyerChaineJsonLd(propre(x, 'name'));
    if (texte) pousser(texte);
  };
  visiter(v, 0);
  return sortie;
}
function portionsDe(v, profondeur = 0) {
  if (Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string') { const m = /\d{1,4}/.exec(v); return m ? Number(m[0]) : null; }
  if (Array.isArray(v) && profondeur === 0) for (const x of v) { const n = portionsDe(x, 1); if (n !== null) return n; }
  return null;
}

// --- Le balayage du HTML (D-B12, S-4) ---------------------------------------------------------------------------------------------------------------
// UNE passe linéaire : chaque balise est trouvée par indexOf('<') puis indexOf('>') et son nom lu sur place (au plus 16 caractères, minuscules ASCII) ;
// la copie en minuscules (même longueur) sert aux recherches insensibles à la casse. Un « < » sans « > » est du texte et ARRÊTE le balayage ;
// un commentaire, un CDATA ou un élément sauté (script, style, noscript, svg, template) sans fermeture aussi. Rien n'est relu deux fois : la seule
// recherche en avant (la fermeture d'un élément sauté) reprend après elle. Rend :
//   texte : le HTML sans balises (la fin d'un bloc et <br> → \n), entités NON décodées ; zones : main / article / body → [début, fin] dans `texte`
//   (le premier de chaque nom ; fin nulle = jusqu'au bout) ; horsTexte : les tranches de `texte` couvertes par nav, header, footer, aside, form
//   (profondeur 1 par nom : un élément imbriqué dans un autre du même nom est coupé au premier « </nom ») ; blocs : le contenu brut de chaque
//   <script type="application/ld+json"> fermé (≤ 512 Kio) ; titre : le contenu brut du premier <title> ; metas : og:site_name et author → content brut.
const SAUTES = new Set(['script', 'style', 'noscript', 'svg', 'template']);
const HORS_TEXTE = new Set(['nav', 'header', 'footer', 'aside', 'form']);
const ZONES = new Set(['main', 'article', 'body']);
const TYPE_JSONLD = /\btype\s*=\s*["']?\s*application\/ld\+json/;
function nomEn(bas, a) {
  let j = a + 1; const fermante = bas.charCodeAt(j) === 47;
  if (fermante) j += 1;
  const debut = j;
  while (j < bas.length && j - debut < 16) { const c = bas.charCodeAt(j); if ((c >= 97 && c <= 122) || (c >= 48 && c <= 57)) j += 1; else break; }
  return { nom: bas.slice(debut, j), fermante };
}
function lireMetaTranche(html, bas, a, b, metas) {
  if (b - a > 2048) return;
  const tranche = bas.slice(a, b + 1);
  const cle = /\b(?:property|name)\s*=\s*["']?\s*(og:site_name|author)["'\s/>]/.exec(tranche);
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
  const zones = new Map(); const ouverts = new Map(); const horsTexte = []; const blocs = []; const metas = new Map();
  let titre = null; let i = 0;
  for (;;) {
    const a = html.indexOf('<', i);
    if (a === -1) { emettre(html.slice(i)); break; }
    emettre(html.slice(i, a));
    if (bas.charCodeAt(a + 1) === 33) { // « <! » : commentaire, CDATA (sautés jusqu'à leur fin), ou doctype (une balise ordinaire)
      if (bas.startsWith('<!--', a)) { const f = bas.indexOf('-->', a + 4); if (f === -1) break; i = f + 3; continue; }
      if (bas.startsWith('<![cdata[', a)) { const f = bas.indexOf(']]>', a + 9); if (f === -1) break; i = f + 3; continue; }
    }
    const b = html.indexOf('>', a + 1);
    if (b === -1) { emettre(html.slice(a)); break; }
    const { nom, fermante } = nomEn(bas, a);
    i = b + 1;
    if (!fermante && SAUTES.has(nom)) {
      const f = bas.indexOf('</' + nom, b + 1);
      if (f === -1) break;
      if (nom === 'script' && b - a <= 2048 && f - (b + 1) <= LIMITES_LECTURE.blocJsonLd && TYPE_JSONLD.test(bas.slice(a, b + 1))) blocs.push(html.slice(b + 1, f));
      const g = bas.indexOf('>', f);
      if (g === -1) break;
      i = g + 1; continue;
    }
    if (!fermante && nom === 'title' && titre === null) { const f = bas.indexOf('</title', b + 1); titre = html.slice(b + 1, f === -1 ? Math.min(html.length, b + 1 + 4096) : f); }
    if (!fermante && nom === 'meta') lireMetaTranche(html, bas, a, b, metas);
    if (ZONES.has(nom)) { if (!fermante && !zones.has(nom)) zones.set(nom, [n, null]); else if (fermante && zones.get(nom)?.[1] === null) zones.get(nom)[1] = n; }
    if (HORS_TEXTE.has(nom)) { if (!fermante && !ouverts.has(nom)) ouverts.set(nom, n); else if (fermante && ouverts.has(nom)) { horsTexte.push([ouverts.get(nom), n]); ouverts.delete(nom); } }
    if (fermante ? BLOCS.has(nom) : nom === 'br') emettre('\n');
  }
  for (const d of ouverts.values()) horsTexte.push([d, n]);
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

// --- Texte principal (D-B2, B-9, S-10) ------------------------------------------------------------------------------------------------------------
// La zone : le premier <main>, sinon le premier <article>, sinon <body>, sinon tout ; les tranches nav / header / footer / aside / form qui
// COMMENCENT dans la zone en sont retirées (un <form> qui enveloppe toute la page, comme sur un vieux site, ne l'efface donc pas).
function texteDuBalayage({ texte, zones, horsTexte }, max) {
  const z = zones.get('main') ?? zones.get('article') ?? zones.get('body') ?? [0, null];
  const debut = z[0]; const fin = z[1] ?? texte.length;
  const morceaux = []; let k = debut;
  for (const [d, f] of [...horsTexte].sort((x, y) => x[0] - y[0])) {
    if (d < debut || d >= fin) continue;
    if (d > k) morceaux.push(texte.slice(k, d));
    k = Math.max(k, Math.min(f, fin));
  }
  if (k < fin) morceaux.push(texte.slice(k, fin));
  const brut = decoderEntites(morceaux.join(''))
    .replace(/\r/g, '')
    .replace(/[ \t\f\v\u{00A0}]+/gu, ' ')
    .split('\n').map((l) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(?!\n)[\p{Cc}\p{Cf}\u{2028}\u{2029}]/gu, '')
    .trim();
  const n = couperPoints(brut, max);
  return n >= brut.length ? { texte: brut, coupe: false } : { texte: brut.slice(0, n), coupe: true };
}
export function textePrincipal(html, max = LIMITES_LECTURE.texte) {
  return typeof html === 'string' ? texteDuBalayage(balayer(html), max) : { texte: '', coupe: false };
}

// --- Assemblage (§ 6.2) -----------------------------------------------------------------------------------------------------------------------------
// UN balayage ; les Recipe → la PREMIÈRE LISIBLE (les illisibles sautées et non comptées) ; `autres` = les lisibles au-delà. `texte` et
// `texte_coupe` seulement sans JSON-LD lisible. `lue_le` est posé par index.ts. `contentType` est gardé pour la forme (le décodage est fait avant).
export function lirePageHtml({ html, urlFinale, contentType } = {}) {
  void contentType;
  const scan = balayer(typeof html === 'string' ? html : '');
  let premiere = null; let objetRecette = null; let autres = 0;
  for (const o of trouverRecettes(objetsDesBlocs(scan.blocs))) {
    const r = recetteDepuisJsonLd(o);
    if (!r.lisible) continue;
    if (premiere === null) { premiere = r.recette; objetRecette = o; } else autres += 1;
  }
  let hote = null;
  try { hote = sansPointFinal(new URL(urlFinale).hostname); } catch { hote = null; }
  const commun = { url_finale: typeof urlFinale === 'string' ? urlFinale : null, hote, titre_page: titreDuBalayage(scan.titre), auteur: (objetRecette ? auteurDe(objetRecette) : null) ?? auteurDuBalayage(scan.metas), site: siteDuBalayage(objetRecette, scan.metas), lue_le: null };
  if (premiere) return { jsonld: { recette: premiere, autres }, texte: null, texte_coupe: false, page: { ...commun, autres_recettes: autres, texte_coupe: false } };
  const { texte, coupe } = texteDuBalayage(scan, LIMITES_LECTURE.texte);
  return { jsonld: null, texte, texte_coupe: coupe, page: { ...commun, autres_recettes: 0, texte_coupe: coupe } };
}
