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
    return { ok: true, href: u.href, hote: u.host };
  } catch { return { ok: false, href: null, hote: null }; }
}
