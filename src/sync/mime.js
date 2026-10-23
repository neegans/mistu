// Liste blanche des types de fichiers synchronisés (spec § 3.6) et résolution locale sans refus (spec § 5.4).
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/epub+zip'];
// Couvertures reçues du réseau (recherche ISBN, spec § 6) : liste fermée, plus stricte que ALLOWED_MIME (pas de HEIC/PDF/EPUB).
export const COVER_INPUT_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const EXT_TO_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf', epub: 'application/epub+zip' };
const MIME_TO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf', 'application/epub+zip': 'epub' };
export const UNKNOWN = 'application/octet-stream';

export const isAllowed = (mime) => ALLOWED_MIME.includes(mime);

// Le type déclaré par le navigateur gagne s'il est dans la liste ; sinon l'extension du nom d'origine, une seule fois.
export function resolveMime(type, filename = '') {
  const declared = String(type || '').toLowerCase().split(';')[0].trim();
  if (isAllowed(declared)) return { mime: declared, syncable: true };
  const ext = String(filename).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const byExt = ext && Object.hasOwn(EXT_TO_MIME, ext) ? EXT_TO_MIME[ext] : null;
  if (byExt) return { mime: byExt, syncable: true };
  return { mime: UNKNOWN, syncable: false };
}

// À l'affichage : jamais un type hors liste (un blob text/html ou image/svg+xml exécuterait du script sur notre origine).
export const safeDisplayType = (mime) => (isAllowed(mime) ? mime : null);
export const extensionFor = (mime) => (Object.hasOwn(MIME_TO_EXT, mime) ? MIME_TO_EXT[mime] : 'bin');

// Lot G (F-9) : le type du BLOB, s'il est dans la liste blanche, gagne — une copie JPEG reçue sous une ligne image/heic s'affiche image/jpeg ;
// un type hors liste n'est jamais servi (S3 du lot UX) : repli sur le type de la ligne, sinon rien.
export function typeAffichage(fileRow) {
  if (!(fileRow?.blob instanceof Blob)) return null;
  return safeDisplayType(String(fileRow.blob.type || '').toLowerCase().split(';')[0].trim()) ?? safeDisplayType(fileRow?.mime);
}

// URL d'affichage d'une ligne files : le blob est retypé avec le type de typeAffichage (liste blanche), ou rien n'est affiché. `creerUrl` : qui
// crée l'URL (par défaut URL.createObjectURL ; une vue qui suit ses URL passe urlDeBlob de core/blob-urls.js — une seule copie de la règle S3 ;
// ronde 1 de la tâche 5 du lot A, `f8cfafa`). Signature gardée.
export function displayUrl(fileRow, creerUrl = (b) => URL.createObjectURL(b)) {
  const type = typeAffichage(fileRow);
  if (!type) return null;
  return creerUrl(fileRow.blob.type === type ? fileRow.blob : new Blob([fileRow.blob], { type }));
}
