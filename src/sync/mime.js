// Liste blanche des types de fichiers synchronisés (spec § 3.6) et résolution locale sans refus (spec § 5.4).
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/epub+zip'];
export const EXT_TO_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf', epub: 'application/epub+zip' };
const MIME_TO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf', 'application/epub+zip': 'epub' };
export const UNKNOWN = 'application/octet-stream';

export const isAllowed = (mime) => ALLOWED_MIME.includes(mime);

// Le type déclaré par le navigateur gagne s'il est dans la liste ; sinon l'extension du nom d'origine, une seule fois.
export function resolveMime(type, filename = '') {
  const declared = String(type || '').toLowerCase().split(';')[0].trim();
  if (isAllowed(declared)) return { mime: declared, syncable: true };
  const ext = String(filename).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const byExt = ext ? EXT_TO_MIME[ext] : null;
  if (byExt) return { mime: byExt, syncable: true };
  return { mime: UNKNOWN, syncable: false };
}

// À l'affichage : jamais un type hors liste (un blob text/html ou image/svg+xml exécuterait du script sur notre origine).
export const safeDisplayType = (mime) => (isAllowed(mime) ? mime : null);
export const extensionFor = (mime) => MIME_TO_EXT[mime] || 'bin';
