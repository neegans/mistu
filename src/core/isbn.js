// ISBN : nettoyage, validation par chiffre de contrôle, conversion 10 ↔ 13, filtre d'un code-barres lu
// (spec « Identifier un livre, fiable » § 4). Module PUR : aucune dépendance, aucun DOM, aucune chaîne t().
// C3 (vague /verify) : une étiquette collée (« ISBN », « ISBN-13: », « isbn 10 : ») est retirée AVANT de garder les
// chiffres — sinon le 13 de l'étiquette devient le début de l'ISBN. Le 10/13 n'est pris pour une étiquette que s'il
// n'est pas suivi d'un chiffre (« ISBN 1302345678 » est un ISBN-10 qui commence par 13).
const ETIQUETTE = /^\s*ISBN(?:[-\s]?1[03](?!\d))?\s*:?\s*/i;
export const nettoyerIsbn = (s) => String(s || '').replace(ETIQUETTE, '').replace(/[^0-9Xx]/g, '').toUpperCase();

// ISBN-10 : somme pondérée 10→1 ≡ 0 (mod 11), X = 10 en dernière position.
const controle10Ok = (s) => { let t = 0; for (let i = 0; i < 10; i += 1) t += (10 - i) * (s[i] === 'X' ? 10 : Number(s[i])); return t % 11 === 0; };
const controle10 = (neuf) => { let t = 0; for (let i = 0; i < 9; i += 1) t += (10 - i) * Number(neuf[i]); const r = (11 - (t % 11)) % 11; return r === 10 ? 'X' : String(r); };
// EAN-13 : poids 1,3 alternés sur douze chiffres.
const controleEan = (douze) => { let t = 0; for (let i = 0; i < 12; i += 1) t += Number(douze[i]) * (i % 2 === 0 ? 1 : 3); return String((10 - (t % 10)) % 10); };

export function validerIsbn(texte) {
  const s = nettoyerIsbn(texte);
  if (!s) return { ok: false, motif: 'vide' };
  if (s.length === 10) {
    if (!/^\d{9}[\dX]$/.test(s)) return { ok: false, motif: 'longueur' };
    if (!controle10Ok(s)) return { ok: false, motif: 'controle' };
    const douze = `978${s.slice(0, 9)}`;
    return { ok: true, isbn13: douze + controleEan(douze), isbn10: s };
  }
  if (s.length === 13) {
    if (!/^\d{13}$/.test(s)) return { ok: false, motif: 'longueur' };
    if (!/^97[89]/.test(s)) return { ok: false, motif: 'pas_isbn' }; // le préfixe AVANT le contrôle : un EAN de prix est valide et n'est pas un livre
    if (controleEan(s.slice(0, 12)) !== s[12]) return { ok: false, motif: 'controle' };
    return { ok: true, isbn13: s, isbn10: s.startsWith('978') ? s.slice(3, 12) + controle10(s.slice(3, 12)) : null };
  }
  return { ok: false, motif: 'longueur' };
}

// Le premier code lu qui a la forme d'un ISBN-13 (le lecteur peut voir aussi l'EAN-5 du prix).
export const codeBarresVersIsbn = (codes) => (Array.isArray(codes) ? codes : []).map((c) => String(c?.rawValue ?? '')).find((v) => /^97[89]\d{10}$/.test(v)) || null;
