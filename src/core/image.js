// Images de couverture (spec UX § 6, I-G) : les dimensions sont lues dans l'EN-TÊTE du fichier avant tout décodage (une
// image hostile de 20 000 × 20 000 ne doit jamais atteindre createImageBitmap), puis TOUTE couverture est ré-encodée par
// canvas en JPEG : le type est prouvé par le décodage, les métadonnées (dont la position GPS d'une photo) disparaissent.
// Le mur de pixels vaut pour les DEUX sources : une couverture reçue (recupererCouvertureParIsbn) et une image choisie
// ici (poserCouverture, chemin local — S2). Il ne s'applique qu'aux conteneurs que `dimensionsImage` sait lire (JPEG,
// PNG, WebP) : un en-tête illisible (HEIC, que Safari décode) passe, et c'est le ré-encodage qui tranche.
// 16 Mpx (S6) = 4 000 × 4 000 : au-delà, aucune couverture de livre n'a de raison d'être, et le canvas d'un téléphone
// renonce bien avant (une photo de 48 Mpx est un cas réel, pas une couverture).
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

export async function reduireImage(blob, { maxCote = LIMITES_COUVERTURE.maxCote, qualite = LIMITES_COUVERTURE.qualite } = {}) {
  const bmp = await decoder(blob);
  try {
    const ratio = Math.min(1, maxCote / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * ratio)), h = Math.max(1, Math.round(bmp.height * ratio));
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const cx = canvas.getContext('2d');
    cx.drawImage(bmp, 0, 0, w, h);
    const sortie = canvas.convertToBlob ? await canvas.convertToBlob({ type: 'image/jpeg', quality: qualite }) : await new Promise((r) => canvas.toBlob(r, 'image/jpeg', qualite));
    if (!sortie || sortie.type !== 'image/jpeg') throw new ErreurImage('indecodable');
    return sortie;
  } finally { bmp.close?.(); }
}
