// Images de couverture (spec UX § 6, I-G) : les dimensions sont lues dans l'EN-TÊTE du fichier avant tout décodage (une
// image hostile de 20 000 × 20 000 ne doit jamais atteindre createImageBitmap), puis TOUTE couverture est ré-encodée par
// canvas en JPEG : le type est prouvé par le décodage, les métadonnées (dont la position GPS d'une photo) disparaissent.
// Le mur de pixels vaut pour les DEUX sources : une couverture reçue (recupererCouvertureParIsbn) et une image choisie
// ici (poserCouverture, chemin local — S2). Il ne s'applique qu'aux conteneurs que `dimensionsImage` sait lire (JPEG,
// PNG, WebP) : un en-tête illisible (HEIC, que Safari décode) passe, et c'est le ré-encodage qui tranche.
// 16 Mpx (S6) = 4 000 × 4 000 : au-delà, aucune couverture de livre n'a de raison d'être, et le canvas d'un téléphone
// renonce bien avant (une photo de 48 Mpx est un cas réel, pas une couverture).
import { COVER_INPUT_MIME } from '../sync/mime.js';
import { t } from './i18n.js';

// Types acceptés pour une photo choisie ICI : les images de la liste blanche des couvertures plus HEIC (que Safari décode). Jamais ALLOWED_MIME :
// un PDF ou un EPUB « photo du plat » doit être refusé par `type` (ce que l'écran dit), pas par le décodage (ronde 1).
export const MIME_PHOTO_LOCALE = Object.freeze([...COVER_INPUT_MIME, 'image/heic']);

export const LIMITES_COUVERTURE = { octetsDistants: 5 * 1024 * 1024, octetsLocaux: 25 * 1024 * 1024, pixels: 16_000_000, maxCote: 1200, qualite: 0.85 };

export class ErreurImage extends Error {
  constructor(code) { super(code); this.name = 'ErreurImage'; this.code = code; }
}

const TETE_MAX = 256 * 1024; // un SOF JPEG peut suivre de gros segments EXIF ; au-delà, on renonce (null)

export async function dimensionsImage(blob) {
  if (!(blob instanceof Blob)) return null;
  const b = new Uint8Array(await blob.slice(0, TETE_MAX).arrayBuffer());
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16be = (o) => dv.getUint16(o, false), u32be = (o) => dv.getUint32(o, false), u16le = (o) => dv.getUint16(o, true);
  const u24le = (o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  try {
    if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52) {
      return { largeur: u32be(16), hauteur: u32be(20), type: 'image/png' };
    }
    if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
      let o = 2;
      while (o + 9 < b.length) {
        if (b[o] !== 0xff) return null;
        const m = b[o + 1];
        // Revue finale du lot F : lu comme libjpeg le lit (next_marker). Un FF de remplissage avant un marqueur est sauté (la norme l'admet) : « FF FF E0 00 »
        // se lisait comme un segment de 57 344 octets, et un faux SOF caché dans un COM passait le mur distant. FF 00 (que libjpeg écarte avant de chercher le
        // marqueur suivant), EOI ou SOS avant le SOF : un flux qu'on ne lirait pas comme le décodeur → null (une image distante est refusée, jamais décodée).
        if (m === 0xff) { o += 1; continue; }
        if (m === 0x00 || m === 0xd9 || m === 0xda) return null;
        if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { o += 2; continue; }
        const taille = u16be(o + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { largeur: u16be(o + 7), hauteur: u16be(o + 5), type: 'image/jpeg' };
        o += 2 + taille;
      }
      return null;
    }
    if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
      const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (chunk === 'VP8X') return { largeur: 1 + u24le(24), hauteur: 1 + u24le(27), type: 'image/webp' };
      if (chunk === 'VP8 ') return { largeur: u16le(26) & 0x3fff, hauteur: u16le(28) & 0x3fff, type: 'image/webp' };
      if (chunk === 'VP8L') { const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24]; return { largeur: 1 + (((b1 & 0x3f) << 8) | b0), hauteur: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)), type: 'image/webp' }; }
    }
  } catch { return null; }
  return null;
}

async function decoder(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch (e) {
    // Option refusée par un vieux Safari : repli sans orientation. Un blob indécodable échoue aussi au repli.
    try { return await createImageBitmap(blob); } catch { throw new ErreurImage('indecodable'); }
  }
}

// Lot I1 (D-I12, D-I2) : `rotation` (0, 90, 180, 270 : quart de tour dans le sens horaire) puis `recadrage` ({ debut, fin } : la bande VERTICALE
// gardée, en fractions de la largeur APRÈS rotation — une moitié de page d'index). I2 : rectangle 2D après rotation, indépendant des bandes I1.
export function rectangleValide(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  if (!['x', 'y', 'largeur', 'hauteur'].every((k) => Object.hasOwn(r, k) && Number.isFinite(r[k]))) return false;
  return r.x >= 0 && r.y >= 0 && r.largeur > 0 && r.hauteur > 0 && r.x + r.largeur <= 1 && r.y + r.hauteur <= 1;
}
export async function reduireImage(blob, { maxCote = LIMITES_COUVERTURE.maxCote, qualite = LIMITES_COUVERTURE.qualite, rotation = 0, recadrage = null, rectangle = null } = {}) {
  if (rectangle !== null && (!rectangleValide(rectangle) || recadrage !== null)) throw new ErreurImage('recadrage');
  const bmp = await decoder(blob);
  try {
    const q = (((Number.isInteger(rotation) ? rotation : 0) % 360) + 360) % 360;
    const tourne = q === 90 || q === 270;
    const W0 = tourne ? bmp.height : bmp.width, H0 = tourne ? bmp.width : bmp.height;
    const x0 = rectangle ? Math.round(W0 * rectangle.x) : recadrage ? Math.max(0, Math.min(W0 - 1, Math.round(W0 * recadrage.debut))) : 0;
    const x1 = rectangle ? Math.round(W0 * (rectangle.x + rectangle.largeur)) : recadrage ? Math.max(x0 + 1, Math.min(W0, Math.round(W0 * recadrage.fin))) : W0;
    const y0 = rectangle ? Math.round(H0 * rectangle.y) : 0;
    const y1 = rectangle ? Math.round(H0 * (rectangle.y + rectangle.hauteur)) : H0;
    if (rectangle && (x1 - x0 < 16 || y1 - y0 < 16)) throw new ErreurImage('trop_petite');
    const ratio = Math.min(1, maxCote / Math.max(x1 - x0, y1 - y0));
    const w = Math.max(1, Math.round((x1 - x0) * ratio)), h = Math.max(1, Math.round((y1 - y0) * ratio));
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const cx = canvas.getContext('2d');
    cx.scale(ratio, ratio);
    cx.translate(-x0, -y0);
    if (q === 90) { cx.translate(W0, 0); cx.rotate(Math.PI / 2); } else if (q === 180) { cx.translate(W0, H0); cx.rotate(Math.PI); } else if (q === 270) { cx.translate(0, H0); cx.rotate(-Math.PI / 2); }
    cx.drawImage(bmp, 0, 0);
    const sortie = canvas.convertToBlob ? await canvas.convertToBlob({ type: 'image/jpeg', quality: qualite }) : await new Promise((r) => canvas.toBlob(r, 'image/jpeg', qualite));
    if (!sortie || sortie.type !== 'image/jpeg') throw new ErreurImage('indecodable');
    return sortie;
  } finally { bmp.close?.(); }
}

// Une photo choisie ou prise ICI (une couverture : poserCouverture ; la photo du plat : spec import-cible § 4.2.3), passée au MÊME mur,
// dans cet ordre : ≤ 25 Mo avant toute lecture ; type de la liste blanche quand le navigateur en déclare un ; ≤ 16 Mpx lus dans l'EN-TÊTE
// avant tout décodage (S2 : une bombe de décompression n'atteint jamais createImageBitmap ; un en-tête illisible, HEIC, passe et c'est le
// ré-encodage qui tranche) ; puis ré-encodage en JPEG de 1 200 px de grand côté au plus (type prouvé par le décodage, métadonnées retirées).
// Rend le Blob JPEG ; lève ErreurImage('trop_lourde' | 'type' | 'trop_grande' | 'indecodable'). N'écrit rien : l'appelant pose les octets.
export async function preparerPhotoLocale(blob) {
  if (!(blob instanceof Blob)) throw new ErreurImage('indecodable');
  if (blob.size > LIMITES_COUVERTURE.octetsLocaux) throw new ErreurImage('trop_lourde');
  if (blob.type && !MIME_PHOTO_LOCALE.includes(blob.type)) throw new ErreurImage('type');
  const dims = await dimensionsImage(blob);
  if (dims && dims.largeur * dims.hauteur > LIMITES_COUVERTURE.pixels) throw new ErreurImage('trop_grande');
  return reduireImage(blob);
}

// Lot F (spec plats-en-images § 3.4, D-F12) : une image DISTANTE (l'image d'une page web, rapatriée par la fonction de l'assistant) passe un mur plus
// strict qu'une photo locale : type annoncé de la liste des couvertures (jamais HEIC), en-tête LU et du MÊME type que l'annonce, petit côté ≥ 200 px
// (une icône, un logo carré ou un pixel de suivi n'illustre pas un plat), ≤ 16 Mpx, ≤ 5 Mio ; puis le même ré-encodage JPEG 1 200 px. N'écrit rien.
// Lot UI-2 (spec expérience carnet § 6, H-7, I-UI-2) : `reencoder: false` rend le Blob CONTRÔLÉ tel quel, sans reduireImage — un aperçu de résultat web
// n'est pas ré-encodé (cinq décodages canvas par recherche évités). Les murs de l'en-tête sont les mêmes ; mais le ré-encodage tranchait aussi ce que
// l'en-tête ne dit pas (il aplatissait une image ANIMÉE en JPEG fixe, il refusait un fichier TRONQUÉ) : sans lui, `structureRefusee` le tranche, sans
// décodage (revue finale du lot UI-2 ; spec § 11 et § 12).
export const COTE_MIN_DISTANT = 200;
export async function preparerPhotoDistante(blob, { coteMin = COTE_MIN_DISTANT, reencoder = true } = {}) {
  if (!(blob instanceof Blob)) throw new ErreurImage('indecodable');
  if (blob.size > LIMITES_COUVERTURE.octetsDistants) throw new ErreurImage('trop_lourde');
  if (!COVER_INPUT_MIME.includes(blob.type)) throw new ErreurImage('type');
  const dims = await dimensionsImage(blob);
  if (!dims || dims.type !== blob.type) throw new ErreurImage('indecodable');
  if (Math.min(dims.largeur, dims.hauteur) < coteMin) throw new ErreurImage('trop_petite');
  if (dims.largeur * dims.hauteur > LIMITES_COUVERTURE.pixels) throw new ErreurImage('trop_grande');
  if (reencoder) return reduireImage(blob);
  const refus = await structureRefusee(blob, dims.type);
  if (refus) throw new ErreurImage(refus);
  return blob;
}

// Revue finale du lot UI-2 : la structure d'une image distante NON ré-encodée, lue sans décodage (le type est déjà prouvé par l'en-tête). ANIMÉE → 'animee' :
// PNG dont un chunk acTL précède le premier IDAT (APNG ; un acTL après lui est ignoré des navigateurs), ou dont le premier IDAT n'est pas atteint dans la
// tranche TETE_MAX (l'animation ne se prouve pas : refus) ; WebP VP8X au drapeau d'animation (0x02). TRONQUÉE → 'tronquee' : PNG sans le chunk IEND final ;
// JPEG sans FF D9 dans ses 16 derniers octets ; WebP dont la taille RIFF dépasse le fichier. Sinon null. Une taille de chunk hostile saute hors de la tranche.
async function structureRefusee(blob, type) {
  const fin = new Uint8Array(await blob.slice(Math.max(0, blob.size - 16)).arrayBuffer());
  const b = new Uint8Array(await blob.slice(0, TETE_MAX).arrayBuffer());
  const u32 = (o, le) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(o, le);
  if (type === 'image/png') {
    const IEND = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
    if (fin.length < 12 || IEND.some((o, i) => fin[fin.length - 12 + i] !== o)) return 'tronquee';
    for (let o = 8; o + 8 <= b.length; o += 12 + u32(o, false)) {
      const nom = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
      if (nom === 'acTL') return 'animee';
      if (nom === 'IDAT') return null;
    }
    return 'animee';
  }
  if (type === 'image/webp') return u32(4, true) + 8 > blob.size ? 'tronquee' : (String.fromCharCode(b[12], b[13], b[14], b[15]) === 'VP8X' && (b[20] & 0x02) ? 'animee' : null);
  if (type === 'image/jpeg') { for (let i = fin.length - 2; i >= 0; i -= 1) if (fin[i] === 0xff && fin[i + 1] === 0xd9) return null; return 'tronquee'; }
  return null;
}

// Un refus d'image, dit du côté de la personne (I-B) : chaque cause a sa phrase, et une cause inconnue ne se déguise pas en « trop lourde ». Déplacée de
// src/ui/livre-ajout.js (lot E, D-E20) : livre-ajout.js va importer import-cible.js, qui l'importait de livre-ajout.js — un cycle ; ré-exportée là-bas.
export function messageErreurImage(e) {
  if (e?.code === 'trop_lourde') return t('Cette image est trop lourde (25 Mo au plus).');
  if (e?.code === 'trop_grande') return t('Cette image est trop grande.');
  return t('Cette image ne peut pas être lue ici. Essaie une autre photo.');
}
