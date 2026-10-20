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
// autre chose → null. Pur. Jamais une fusion : l'écran le dit et n'écrit rien.
export function adresseNormalisee(href) {
  let u;
  try { u = new URL(String(href ?? '')); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.username = ''; u.password = ''; u.hash = '';
  for (const cle of [...u.searchParams.keys()]) { const c = cle.toLowerCase(); if (c.startsWith('utm_') || c === 'fbclid' || c === 'gclid') u.searchParams.delete(cle); }
  return u.origin + u.pathname.replace(/\/+$/, '') + u.search;
}
// La première fiche dont l'adresse normalisée égale celle de `href` (une fiche sans source_url, ou à adresse illisible, est ignorée), sinon null.
export function doublonDAdresse(recipes, href) {
  const cible = adresseNormalisee(href);
  if (!cible) return null;
  return (Array.isArray(recipes) ? recipes : []).find((r) => typeof r?.source_url === 'string' && r.source_url !== '' && adresseNormalisee(r.source_url) === cible) || null;
}

