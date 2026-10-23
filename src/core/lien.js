// Lire une adresse gardée (spec UX § 11, R-UX-11) : des fonctions pures, sans aucune VUE derrière elles, pour que tout
// écran qui montre un lien puisse la revalider AU RENDU (S6) — components.js en a besoin, et signet.js importe
// components.js : elles vivent donc ici, sous les deux. Seule dépendance : le module pur de création IA (étiquette C-2).
import { etiquetteCreationIA } from '../domain/creation-ia.js';

// Seuls http: et https: s'ouvrent. L'hôte rendu est RECALCULÉ depuis l'adresse — jamais lu dans source_label, qu'une
// archive ou le serveur peut avoir rempli avec n'importe quoi (S7) — et reste en punycode, pour qu'un nom
// internationalisé ne puisse pas se déguiser en un autre à l'écran.
export function lienSignet(sourceUrl) {
  try {
    const u = new URL(String(sourceUrl ?? ''));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, href: null, hote: null };
    // D-T7 : on ne garde JAMAIS un mot de passe collé dans une adresse. `username` et `password` sont retirés de
    // l'href rendu — et comme c'est cet href qui est écrit dans la fiche, l'identifiant ne part ni dans la base, ni
    // dans l'archive, ni au serveur. La page reste joignable : seule la partie « qui se connecte » disparaît.
    u.username = ''; u.password = '';
    return { ok: true, href: u.href, hote: u.host };
  } catch { return { ok: false, href: null, hote: null }; }
}

// Libellé de source d'une fiche, pour les surfaces qui n'affichent qu'un texte (le repas, les exports — S8) :
// l'hôte RECALCULÉ dès qu'une adresse existe, jamais `source_label`, qu'une archive ou le serveur peut avoir rempli
// avec n'importe quoi (S7). Une adresse illisible ne laisse pas le libellé stocké prendre sa place : rien du tout.
// Sans adresse, le libellé libre d'une recette saisie à la main est, lui, de la personne : il est rendu tel quel.
// C-2 : une fiche origine 'ia' est « Créée avec l’IA » EN TÊTE, texte BRUT (les exports ne passent pas par t()) — jamais
// son source_label ni l'hôte d'une adresse qu'une ligne reçue porterait.
export function libelleSource(recipe) {
  if (recipe?.origine === 'ia') return etiquetteCreationIA(null, recipe);
  if (recipe?.source_url) { const lien = lienSignet(recipe.source_url); return lien.ok ? lien.hote : ''; }
  return recipe?.source_label || '';
}

// Doublon d'adresse (lot B, D-B7) : deux adresses désignent la même page quand elles sont égales une fois NORMALISÉES — schéma et hôte en
// minuscules (URL le fait), identifiants et fragment retirés, paramètres de suivi retirés (utm_*, fbclid, gclid, casse libre ; l'ordre des
// autres est gardé), barre finale indifférente (la racine « / » devient vide), port gardé s'il est explicite. http: et https: seulement ;
// autre chose → null. Pur. Jamais une fusion : l'écran le dit et n'écrit rien. Identifiants et fragment ne sont jamais dans origin + pathname +
// search : rien à vider. Ronde 1 : la requête est filtrée TELLE QUELLE, paire par paire (clé décodée comparée en minuscules ; une paire vide tombe) —
// jamais resérialisée par URLSearchParams, qui réécrivait « %20 » en « + » et « ?flag » en « ?flag= » dès qu'un paramètre de suivi partait.
const SUIVI = (paire) => {
  let cle = paire.split('=')[0];
  try { cle = decodeURIComponent(cle.replace(/\+/g, ' ')); } catch { /* clé mal encodée : comparée telle quelle */ }
  cle = cle.toLowerCase();
  return cle.startsWith('utm_') || cle === 'fbclid' || cle === 'gclid';
};
// Vague finale (sécurité) : les barres finales sont retirées par une boucle LINÉAIRE — /\/+$/ était quadratique sur « //…//a » (≈ 6 s pour
// 100 000 barres sous Node), et une fiche reçue peut en porter autant.
const sansBarresFinales = (s) => { let k = s.length; while (k > 0 && s.charCodeAt(k - 1) === 47) k -= 1; return s.slice(0, k); };
export function adresseNormalisee(href) {
  let u;
  try { u = new URL(String(href ?? '')); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const paires = u.search.slice(1).split('&').filter((p) => p !== '' && !SUIVI(p));
  return u.origin + sansBarresFinales(u.pathname) + (paires.length ? '?' + paires.join('&') : '');
}
// ADRESSE_MAX = LIMITES_SIGNET.adresse (src/ui/signet.js : un module de vue, sous lequel lien.js vit — égalité épinglée par tests/lecture-web.js).
// signetModel n'écrit jamais une adresse plus longue : un source_url au-delà (fiche reçue, archive) ne peut être le doublon d'aucun signet, et il
// n'est même pas analysé (vague finale, sécurité).
export const ADRESSE_MAX = 2048;
// La première fiche dont l'adresse normalisée égale celle de `href` (une fiche sans source_url, ou à adresse illisible ou trop longue, est
// ignorée), sinon null.
export function doublonDAdresse(recipes, href) {
  if (typeof href === 'string' && href.length > ADRESSE_MAX) return null;
  const cible = adresseNormalisee(href);
  if (!cible) return null;
  return (Array.isArray(recipes) ? recipes : []).find((r) => typeof r?.source_url === 'string' && r.source_url !== '' && r.source_url.length <= ADRESSE_MAX && adresseNormalisee(r.source_url) === cible) || null;
}
