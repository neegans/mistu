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
