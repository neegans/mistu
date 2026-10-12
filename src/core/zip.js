// Écriture et lecture d'archives ZIP « stored » (sans compression), noms UTF-8.
// Suffisant pour la sauvegarde complète (§31.1) : les photos et PDF sont déjà compressés.
// Limites : pas de ZIP64 (archive < 4 Go) ; la lecture refuse les entrées compressées avec un message précis.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date();
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
  const day = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, day };
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// entries: [{ path, data: Uint8Array | string, mtime?: Date }]
export function createZip(entries) {
  if (!Array.isArray(entries) || entries.length >= 0xffff) throw new Error('Archive trop volumineuse : ZIP64 non pris en charge');
  const names = new Set();
  let expectedSize = 22;
  for (const entry of entries) {
    if (typeof entry.path !== 'string' || !entry.path.length || names.has(entry.path)) throw new Error('Chemin ZIP vide ou répété : ' + entry.path);
    names.add(entry.path);
    const nameLength = enc.encode(entry.path).length;
    const dataLength = typeof entry.data === 'string' ? enc.encode(entry.data).length : entry.data?.byteLength;
    if (!nameLength || nameLength > 0xffff || !Number.isSafeInteger(dataLength) || dataLength < 0 || dataLength >= 0xffffffff) throw new Error('Entrée ZIP trop volumineuse ou invalide : ' + entry.path);
    expectedSize += 30 + 46 + 2 * nameLength + dataLength;
    if (expectedSize >= 0xffffffff) throw new Error('Archive trop volumineuse : ZIP64 non pris en charge');
  }
  const locals = [];
  const centrals = [];
  let offset = 0;
  const now = new Date();
  for (const entry of entries) {
    const data = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data;
    const name = enc.encode(entry.path);
    const crc = crc32(data);
    const { time, day } = dosDateTime(entry.mtime || now);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);        // version needed
    lv.setUint16(6, 0x0800, true);    // flags: UTF-8 names
    lv.setUint16(8, 0, true);         // method: stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    locals.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);
  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...locals, ...centrals, eocd]) { out.set(part, pos); pos += part.length; }
  return out;
}

// Retourne Map(path -> { data: Uint8Array, crcOk: boolean })
export function readZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bounded = (start, length, end = bytes.length) => Number.isSafeInteger(start) && Number.isSafeInteger(length) && start >= 0 && length >= 0 && start + length <= end;
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fichier ZIP invalide : fin de répertoire central introuvable');
  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('ZIP64 non pris en charge');
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0 || view.getUint16(eocd + 8, true) !== count) throw new Error('Archive ZIP multi-volume non prise en charge');
  if (!bounded(centralOffset, centralSize, eocd) || centralOffset + centralSize !== eocd) throw new Error('Répertoire central ZIP tronqué');
  const out = new Map();
  let pos = centralOffset;
  let localEnd = 0;
  for (let i = 0; i < count; i++) {
    if (!bounded(pos, 46, eocd) || view.getUint32(pos, true) !== 0x02014b50) throw new Error('Entrée ZIP de répertoire central corrompue');
    const flags = view.getUint16(pos + 8, true);
    const method = view.getUint16(pos + 10, true);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 20, true);
    const unpackedSize = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const centralLength = 46 + nameLen + extraLen + commentLen;
    if (!bounded(pos, centralLength, eocd)) throw new Error('Nom ZIP tronqué');
    const name = dec.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    if (!name.length || out.has(name)) throw new Error('Chemin ZIP vide ou répété : ' + name);
    if (method !== 0 || (flags & 9) !== 0 || view.getUint16(pos + 34, true) !== 0) throw new Error('Entrée ZIP compressée, chiffrée ou non prise en charge : ' + name);
    if (size === 0xffffffff || size !== unpackedSize) throw new Error('Taille ZIP invalide : ' + name);
    if (localOffset < localEnd || !bounded(localOffset, 30, centralOffset) || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('En-tête ZIP local corrompu : ' + name);
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const headerLength = 30 + lNameLen + lExtraLen;
    if (!bounded(localOffset, headerLength + size, centralOffset)) throw new Error('Données ZIP tronquées : ' + name);
    const localName = dec.decode(bytes.subarray(localOffset + 30, localOffset + 30 + lNameLen));
    if (localName !== name || view.getUint16(localOffset + 6, true) !== flags || view.getUint16(localOffset + 8, true) !== method ||
        view.getUint32(localOffset + 14, true) !== crc || view.getUint32(localOffset + 18, true) !== size || view.getUint32(localOffset + 22, true) !== unpackedSize) throw new Error('En-têtes ZIP incohérents : ' + name);
    const start = localOffset + headerLength;
    const data = bytes.slice(start, start + size);
    out.set(name, { data, crcOk: crc32(data) === crc });
    localEnd = start + size;
    pos += centralLength;
  }
  if (pos !== eocd) throw new Error('Décompte ZIP incohérent');
  return out;
}

export const textOf = (entry) => dec.decode(entry.data);
