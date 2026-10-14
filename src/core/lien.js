// Lire une adresse gardée (spec UX § 11, R-UX-11) : une fonction pure, SANS aucune dépendance, pour que tout écran
// qui montre un lien puisse la revalider AU RENDU (S6) sans tirer une vue derrière lui — components.js en a besoin, et
// signet.js importe components.js : la fonction vit donc ici, sous les deux.
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
export function libelleSource(recipe) {
  if (recipe?.source_url) { const lien = lienSignet(recipe.source_url); return lien.ok ? lien.hote : ''; }
  return recipe?.source_label || '';
}
