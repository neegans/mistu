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
