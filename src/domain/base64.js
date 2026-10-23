// Relire le base64 d'une image reçue (lot F « Les plats en images », spec § 3.4) : module FEUILLE, sans aucun import — la suite navigateur ET les tests
// Node l'importent (chaînage avec versBase64 du serveur, tools/assistant-lecture-web.test.mjs). Ne lève jamais : toute forme inattendue rend null.
// Règle : une chaîne de l'alphabet base64 standard avec remplissage, de longueur EXACTE 4 × ceil(taille / 3), qui se décode en `taille` octets.
const ALPHABET = /^[A-Za-z0-9+/]*={0,2}$/;
export function lireOctetsBase64(texte, taille) {
  try {
    if (typeof texte !== 'string' || !Number.isSafeInteger(taille) || taille < 0) return null;
    if (texte.length !== 4 * Math.ceil(taille / 3) || !ALPHABET.test(texte)) return null;
    const binaire = atob(texte);
    if (binaire.length !== taille) return null;
    const octets = new Uint8Array(taille);
    for (let i = 0; i < taille; i += 1) octets[i] = binaire.charCodeAt(i);
    return octets;
  } catch { return null; }
}
