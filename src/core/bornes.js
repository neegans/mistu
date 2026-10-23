// Bornes communes aux appels distants (lot ISBN : R-ISBN-1, S1, C9/S11, S12 ; lot Web : spec § 7.2). Module PUR,
// sans import, sans DOM : le domaine (recherche-web.js) comme l'interface (livre-ajout.js) le lisent. Les corps des
// fonctions sont ceux du lot ISBN, déplacés tels quels ; seul `borner` reçoit sa borne en paramètre.
export const OPTIONS_FETCH = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };

// Une chaîne seulement, sans caractères de contrôle (Cc) ni de format (Cf : bidi, largeur nulle…), ni les séparateurs
// de ligne U+2028/U+2029 (Zl/Zp, nommés à part), tronquée à `max` POINTS DE CODE : une paire de substitution coupée
// laisserait une demi-paire que le jsonb refuse. Tout ce qui n'est pas une chaîne vaut ''.
export function borner(s, max) {
  if (typeof s !== 'string') return '';
  return Array.from(s.replace(/[\p{Cc}\p{Cf}\u{2028}\u{2029}]/gu, '')).slice(0, max).join('');
}

// Comme `borner` (même nettoyage), mais pour un texte LU par une personne : la coupe se fait AU MOT et se dit par « … ».
// D'abord les fins de ligne (LF, CR, VT, FF, NEL, U+2028, U+2029) et tabulations deviennent UNE espace (borner les retirerait et collerait « rôti.Le »), puis le
// nettoyage de `borner`, puis le texte est ROGNÉ : on mesure ce qui sera lu. Un texte qui tient en `max` points de code est
// rendu tel quel. Sinon on garde `max - 1` points de code ; s'il y a un point de coupe dans la moitié droite de ce qui reste
// (index ≥ floor((max - 1) / 2)), on coupe à la DERNIÈRE ; sans point de coupe là (un seul très long mot), on coupe net.
// Une insécable (U+00A0, U+2007, U+202F) n'est jamais un point de coupe : « 15 min » ne se sépare pas. Le résultat tient toujours
// en `max` points de code, « … » (U+2026) compris. Une borne qui n'est pas un entier ≥ 1, ou autre chose qu'une chaîne : ''.
const POINT_DE_COUPE = /[^\S\u{00A0}\u{2007}\u{202F}]/u; // toute espace Unicode SAUF les insécables (U+00A0, U+2007 tabulaire, U+202F)
export function bornerAuMot(s, max) {
  if (typeof s !== 'string' || !Number.isInteger(max) || max < 1) return '';
  const texte = Array.from(borner(s.replace(/[\t\n\v\f\r\u{0085}\u{2028}\u{2029} ]+/gu, ' '), Infinity).trim());
  if (texte.length <= max) return texte.join('');
  const coupe = texte.slice(0, max - 1);
  const seuil = Math.floor((max - 1) / 2);
  let i = coupe.length - 1;
  while (i >= seuil && !POINT_DE_COUPE.test(coupe[i])) i -= 1;
  return (i >= seuil ? coupe.slice(0, i) : coupe).join('').trimEnd() + '…';
}

// Un corps distant est lu EN FLUX et la lecture est COUPÉE (reader.cancel()) dès que le cumul dépasse la borne —
// rien de ce qui a été lu n'est conservé, et le reste du corps n'est jamais tiré. Une réponse sans `body` (vieux
// navigateur, réponse factice d'un test) rend `false` : l'appelant replie alors sur r.text() / r.blob() et contrôle
// la taille réelle.
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

// Délai borné : AbortSignal.timeout n'existe pas partout (Safari < 16) et peut lever. Repli sur un AbortController +
// setTimeout, qui abandonne à la même seconde.
export function signalDelai(ms) {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  } catch { /* repli ci-dessous */ }
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), ms);
  return ctl.signal;
}

// Une adresse web dans un texte du modèle (déménagés de domain/recherche-web.js au lot C, spec D-C13 : la présentation du serveur, la lecture d'une
// page web du lot B ET la table des matières les emploient ; corps inchangés : ceux du code COMMIS du lot B, R-B-26). MOTIF_ADRESSE : schéma,
// « www. » ou hôte suivi d'un chemin, le départ hôte tenté au DÉBUT d'une suite de [a-z0-9-] seulement (lookbehind du lot B, ronde 1 de sa
// tâche 3 : mêmes verdicts, linéaire). MOTIF_HOTE : l'HÔTE NU dont le dernier
// segment est dans une liste FERMÉE de domaines de premier niveau, ni précédé d'une lettre, d'un chiffre, de « @ », « . », « _ » ou « - », ni suivi
// d'une lettre, d'un chiffre ou d'un tiret (faux positif CONNU et assumé : « Le sel.Ca y est »). normaliserPourAdresse (exporté au lot B) normalise le
// texte POUR LE TEST seulement (NFKC, puis « 。 » U+3002 et « ｡ » U+FF61 → « . », « ∕ » U+2215 et « ⁄ » U+2044 → « / ») : le texte n'est jamais modifié ;
// porteUneAdresse : MOTIF_ADRESSE ou MOTIF_HOTE sur ce texte normalisé.
export const MOTIF_ADRESSE = /(https?:\/\/|www\.|(?<![a-z0-9-])[a-z0-9-]+\.[a-z]{2,}\/)/iu;
export const MOTIF_HOTE = /(?<![\p{L}\p{N}@._-])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|net|org|ca|quebec|fr|be|ch|io|co|info|app|blog|xyz|site|online|shop|me|tv|us|uk|ly|gl)(?![\p{L}\p{N}-])/iu;
export const normaliserPourAdresse = (texte) => texte.normalize('NFKC').replace(/[\u{3002}\u{FF61}]/gu, '.').replace(/[\u{2215}\u{2044}]/gu, '/');
export function porteUneAdresse(texte) {
  const n = normaliserPourAdresse(texte);
  return MOTIF_ADRESSE.test(n) || MOTIF_HOTE.test(n);
}

// Les titres et les incertitudes d'un classement (lot D « Un lot de recettes photographiées », spec D-D11) : UNE règle partagée par la validation
// (domain/llm.js), la revalidation d'un résultat relu du journal (domain/classement.js) et le champ `lot` d'une ligne (domain/import-cible.js) — un
// titre accepté par l'un l'est par les autres. plierUneLigne : tout blanc (sauts de ligne, U+2028/2029 et tabulations compris) devient UNE espace, puis
// trim ; pas une chaîne → ''. estTitreUneLigne : une chaîne sur UNE ligne (aucun Cc — sauts de ligne compris —, Cf, Cs, U+2028 ni U+2029), égale à
// sa forme PLIÉE (plierUneLigne : trim, ni suite de blancs ni blanc autre que l'espace — ronde 1 de la tâche 1 : un titre relu du journal ou d'une
// ligne `lot` que la validation ne produirait jamais, double espace ou insécable, est refusé par les trois lecteurs), de 1 à `max` points de code, que
// porteUneAdresse ne reconnaît pas. Le prédicat ne modifie jamais le texte.
const HORS_D_UNE_LIGNE = /[\p{Cc}\p{Cf}\p{Cs}\u{2028}\u{2029}]/u;
export const plierUneLigne = (s) => (typeof s === 'string' ? s.replace(/\s+/gu, ' ').trim() : '');
export function estTitreUneLigne(s, max) {
  if (typeof s !== 'string' || !Number.isInteger(max) || max < 1) return false;
  if (HORS_D_UNE_LIGNE.test(s) || s !== plierUneLigne(s)) return false;
  const n = Array.from(s).length;
  return n >= 1 && n <= max && !porteUneAdresse(s);
}
