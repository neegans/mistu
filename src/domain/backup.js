// Sauvegarde complète et restauration (spec §31.1). Archive ZIP documentée : manifeste, données par magasin,
// fichiers sources avec empreinte SHA-256. Validation en mémoire avant toute écriture ; réimport idempotent (upsert par identifiant).
import { createZip, readZip, textOf } from '../core/zip.js';
import { sha256Hex } from '../core/hash.js';
import { ARCHIVE_FORMAT, ARCHIVE_FORMAT_VERSION, SUPPORTED_ARCHIVE_VERSIONS, ARCHIVE_DATA_STORES, SECRET_SETTING_KEYS, RELATIONS, STORES, APP_VERSION, SYNC_INTERNAL_STORES, SYNC_STORES, MAGASINS_AJOUTES_APRES_V1 } from '../model/schema.js';
import { nettoyerChaines } from '../sync/lots.js';
import { syncNow } from '../sync/clock.js';
import { remoteValide, HASH_FICHIER } from '../sync/tables.js';
import { estOriginalIci } from '../sync/fichiers.js';

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf', 'application/epub+zip': 'epub', 'text/plain': 'txt' };
export const extFor = (mime) => MIME_EXT[mime] || 'bin';

const README_TXT = `Archive Cuisine OS
==================
manifest.json  : format, version du format, date, décomptes, liste des fichiers avec empreinte SHA-256.
data/*.json    : un tableau JSON par magasin (identifiants stables, relations par identifiant).
files/<sha256>.<ext> : scans, photos et PDF originaux, nommés par leur empreinte.
Le manifeste peut porter l'identifiant technique du compte qui a envoyé un fichier (un uuid, pas un secret).
Aucun secret d'accès n'est inclus. Cette archive est privée ; sa création ne publie rien.
`;

const DATA_STORES = [...ARCHIVE_DATA_STORES, 'settings'];
const HASH = HASH_FICHIER; // I-G10 : une définition (src/sync/tables.js)
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validKey = (value) => typeof value === 'string' && value.trim().length > 0;
const validCount = (value) => Number.isSafeInteger(value) && value >= 0;
const publicSettings = (rows) => rows.filter((r) => !SECRET_SETTING_KEYS.includes(r.key));

function validateRows(stores) {
  const errors = [];
  if (!record(stores)) return ['Données par magasin absentes ou invalides'];
  for (const name of Object.keys(stores)) {
    if (!DATA_STORES.includes(name)) errors.push('Magasin inattendu : ' + name);
  }
  for (const name of DATA_STORES) {
    // C1 (spec import-cible § 3.7) : une archive faite avant qu'un magasin existe ne le porte pas ; absent, il vaut [] — présent, il
    // doit être un tableau comme les autres.
    if (!own(stores, name) && MAGASINS_AJOUTES_APRES_V1.includes(name)) continue;
    if (!own(stores, name) || !Array.isArray(stores[name])) {
      errors.push('Magasin absent ou invalide : ' + name);
      continue;
    }
    const key = STORES[name].keyPath;
    const ids = new Set();
    for (const row of stores[name]) {
      if (!record(row) || !validKey(row[key])) {
        errors.push(name + ' : chaque fiche doit avoir une clé ' + key + ' non vide');
        continue;
      }
      if (ids.has(row[key])) errors.push(name + ' : clé répétée ' + row[key]);
      ids.add(row[key]);
    }
  }
  return errors;
}

// Les points traversent des objets ; [] traverse un tableau de références ou d’objets.
// Une relation absente/nulle reste optionnelle ; une structure présente mais invalide est refusée.
function relationValues(value, parts) {
  if (!parts.length) return [value];
  if (value == null) return [];
  if (!record(value)) throw new Error('objet attendu');
  const [part, ...rest] = parts;
  const many = part.endsWith('[]');
  const key = many ? part.slice(0, -2) : part;
  if (!own(value, key) || value[key] == null) return [];
  const next = value[key];
  if (!many) return relationValues(next, rest);
  if (!Array.isArray(next)) throw new Error('tableau attendu');
  if (rest.length && next.some((item) => !record(item))) throw new Error('liste d’objets attendue');
  return next.flatMap((item) => relationValues(item, rest));
}

export function checkRelations(stores, fileHashes) {
  const errors = [];
  const ids = new Map();
  for (const [name, rows] of Object.entries(stores)) {
    if (!own(STORES, name) || !Array.isArray(rows)) continue;
    const key = STORES[name].keyPath;
    ids.set(name, new Set(rows.filter(record).map((row) => row[key])));
  }
  for (const [child, field, parent] of RELATIONS) {
    const rows = stores[child];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      let values;
      try { values = relationValues(row, field.split('.')); }
      catch (e) { errors.push(child + '.' + field + ' : ' + e.message); continue; }
      for (const value of values) {
        if (value == null || value === '') continue;
        if (!validKey(value)) {
          errors.push(child + '.' + field + ' : identifiant invalide');
        } else if (parent === 'files' ? !fileHashes.has(value) : !ids.get(parent)?.has(value)) {
          errors.push(child + '.' + field + ' → ' + parent + ' ' + value + ' introuvable');
        }
      }
    }
  }
  return errors;
}

// Une seule lecture IndexedDB cohérente ; le hachage et le ZIP se font après la transaction.
export async function createArchive(db, { deviceName = '' } = {}) {
  // Les magasins internes (spec § 5.1) n'existent pas forcément sur une base plus ancienne : lire ceux de la base, pas du schéma courant.
  const snapshot = await db.getSnapshot(Object.keys(db.stores));
  // Une base plus ancienne (ouverte avec un STORES d'avant) n'a pas forcément un magasin ajouté après le format 1 : il vaut [] (C1).
  const lignes = (name) => (MAGASINS_AJOUTES_APRES_V1.includes(name) ? (snapshot[name] ?? []) : snapshot[name]);
  const stores = Object.fromEntries(DATA_STORES.map((name) => [
    name, JSON.parse(JSON.stringify(name === 'settings' ? publicSettings(lignes(name)) : lignes(name))),
  ]));
  const errors = validateRows(stores);
  // Une incohérence déjà présente ne doit pas empêcher de conserver une copie.
  // Elle est signalée à l’export et restera bloquante à l’inspection avant restauration.
  const warnings = checkRelations(stores, new Set(snapshot.files.map((f) => f.sha256)));
  if (errors.length) throw new Error('Bibliothèque incohérente : ' + errors.slice(0, 10).join(' · '));
  const entries = [], dataFiles = [], files = [];
  const counts = {};
  const enc = new TextEncoder();
  for (const name of DATA_STORES) {
    const data = enc.encode(JSON.stringify(stores[name]));
    const path = 'data/' + name + '.json';
    counts[name] = stores[name].length;
    entries.push({ path, data });
    dataFiles.push({ path, store: name, count: counts[name], sha256: await sha256Hex(data) });
  }
  let bytesTotal = 0;
  const manquantes = [];
  const copies = { serveur: 0, inconnues: 0 };
  for (const file of snapshot.files) {
    if (!HASH.test(file.sha256)) throw new Error('Fichier source invalide : ' + file.sha256);
    const remote = remoteValide(file.remote) ? file.remote : undefined;
    const mime = validKey(file.mime) ? file.mime : (validKey(file.blob?.type) ? file.blob.type : 'application/octet-stream');
    if (!(file.blob instanceof Blob)) {
      // D-G7 (R18) : une ligne sans octets ici entre dans missing_files, QUELLE QUE SOIT la valeur de remote (D-G12).
      manquantes.push({ sha256: file.sha256, mime, size: validCount(file.size) ? file.size : 0, ...(remote ? { remote } : {}) });
      continue;
    }
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const h = await sha256Hex(data);
    const entree = { sha256: file.sha256, size: h === file.sha256 ? data.length : (validCount(file.size) ? file.size : data.length), mime };
    if (h !== file.sha256) {
      // S-1 : des octets qui ne sont pas l'original sont décrits par bytes_*, quel que soit remote — jamais une levée (« Fichier source endommagé »
      // reste à l'inspection, pour un ZIP abîmé). Copie du serveur connue, ou autre chose (octets abîmés, copie périmée) : archivée telle quelle.
      Object.assign(entree, { bytes_sha256: h, bytes_size: data.length, bytes_mime: validKey(file.blob.type) ? file.blob.type : mime });
      if (remote && remote.sha256 === h) copies.serveur += 1; else copies.inconnues += 1;
    }
    if (remote) entree.remote = remote;
    const path = 'files/' + file.sha256 + '.' + extFor(entree.bytes_mime ?? mime);
    entries.push({ path, data });
    files.push({ path, ...entree });
    bytesTotal += data.length;
  }
  counts.files = files.length; // missing_files n'entre PAS dans counts : un client plus ancien refuse tout décompte de magasin inconnu
  const manifest = {
    format: ARCHIVE_FORMAT, format_version: ARCHIVE_FORMAT_VERSION, app_version: APP_VERSION,
    created_at: new Date().toISOString(), device_name: deviceName || null, counts, data_files: dataFiles, files, missing_files: manquantes,
  };
  entries.unshift({ path: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
  entries.push({ path: 'README.txt', data: README_TXT });
  const zip = createZip(entries);
  return { blob: new Blob([zip], { type: 'application/zip' }), manifest, bytes: zip.length, filesBytes: bytesTotal, warnings, missingFiles: manquantes.length, copies };
}

// Inspection isolée : aucune écriture. Les archives v1 complètes existantes restent acceptées.
export async function inspectArchive(arrayBuffer) {
  const errors = [], warnings = [];
  let manifest = null;
  const payload = { stores: Object.create(null), files: [], missing: [] };
  const fail = () => ({ ok: false, errors, warnings, manifest });
  try {
    const zip = readZip(arrayBuffer);
    const entry = zip.get('manifest.json');
    if (!entry) { errors.push('manifest.json absent : ce n’est pas une archive Cuisine OS'); return fail(); }
    if (!entry.crcOk) { errors.push('CRC invalide : manifest.json'); return fail(); }
    const parsed = JSON.parse(textOf(entry));
    if (!record(parsed)) { errors.push('Manifeste invalide : objet attendu'); return fail(); }
    manifest = parsed;
    if (manifest.format !== ARCHIVE_FORMAT) errors.push('Format inconnu : ' + manifest.format);
    if (!SUPPORTED_ARCHIVE_VERSIONS.includes(manifest.format_version)) errors.push('Version de format non prise en charge : ' + manifest.format_version);
    if (!Array.isArray(manifest.data_files) || !Array.isArray(manifest.files) || !record(manifest.counts)) errors.push('Manifeste incomplet : listes de données, fichiers et décomptes requis');
    if (errors.length) return fail();
    const paths = new Set(['manifest.json', 'README.txt']);
    const seenStores = new Set();
    for (const df of manifest.data_files) {
      if (!record(df) || !DATA_STORES.includes(df.store)) { errors.push('Description de magasin absente ou inconnue'); continue; }
      if (seenStores.has(df.store)) { errors.push('Magasin répété : ' + df.store); continue; }
      seenStores.add(df.store);
      if (df.path !== 'data/' + df.store + '.json' || paths.has(df.path)) { errors.push('Chemin de données invalide : ' + df.path); continue; }
      paths.add(df.path);
      if (!HASH.test(df.sha256) || !validCount(df.count)) { errors.push('Empreinte ou décompte invalide : ' + df.store); continue; }
      const dataEntry = zip.get(df.path);
      if (!dataEntry) { errors.push('Fichier de données manquant : ' + df.path); continue; }
      if (!dataEntry.crcOk || await sha256Hex(dataEntry.data) !== df.sha256) { errors.push('Données endommagées : ' + df.path); continue; }
      const rows = JSON.parse(textOf(dataEntry));
      if (!Array.isArray(rows)) { errors.push(df.path + ' ne contient pas un tableau'); continue; }
      payload.stores[df.store] = rows;
      if (rows.length !== df.count || !validCount(manifest.counts[df.store]) || rows.length !== manifest.counts[df.store]) errors.push('Décompte différent : ' + df.store);
    }
    errors.push(...validateRows(payload.stores));
    const hashes = new Set();
    let missing = 0, hashMismatch = 0;
    const bytesValides = (f) => {
      const n = ['bytes_sha256', 'bytes_size', 'bytes_mime'].filter((k) => own(f, k)).length;
      return n === 0 || (n === 3 && HASH.test(f.bytes_sha256) && validCount(f.bytes_size) && validKey(f.bytes_mime));
    };
    for (const f of manifest.files) {
      if (!record(f) || !HASH.test(f.sha256) || !validCount(f.size) || !validKey(f.mime) || !bytesValides(f) || (own(f, 'remote') && !remoteValide(f.remote))) { errors.push('Description de fichier invalide'); continue; }
      if (hashes.has(f.sha256)) { errors.push('Empreinte de fichier répétée : ' + f.sha256); continue; }
      hashes.add(f.sha256);
      const copie = own(f, 'bytes_sha256');
      if (f.path !== 'files/' + f.sha256 + '.' + extFor(copie ? f.bytes_mime : f.mime) || paths.has(f.path)) { errors.push('Chemin de fichier invalide : ' + f.path); continue; }
      paths.add(f.path);
      const fileEntry = zip.get(f.path);
      if (!fileEntry) { missing++; errors.push('Fichier source manquant : ' + f.path); continue; }
      if (!fileEntry.crcOk || await sha256Hex(fileEntry.data) !== (copie ? f.bytes_sha256 : f.sha256)) { hashMismatch++; errors.push('Fichier source endommagé : ' + f.path); continue; }
      if (fileEntry.data.length !== (copie ? f.bytes_size : f.size)) { errors.push('Taille différente : ' + f.path); continue; }
      payload.files.push({ sha256: f.sha256, bytes: fileEntry.data, mime: f.mime, size: f.size,
        ...(copie ? { bytes_sha256: f.bytes_sha256, bytes_size: f.bytes_size, bytes_mime: f.bytes_mime } : {}), ...(own(f, 'remote') ? { remote: f.remote } : {}) });
    }
    const listeManquantes = own(manifest, 'missing_files') ? manifest.missing_files : []; // archive d'avant le lot : absente = []
    if (!Array.isArray(listeManquantes)) errors.push('Description de fichier invalide');
    else for (const mf of listeManquantes) {
      if (!record(mf) || !HASH.test(mf.sha256) || !validKey(mf.mime) || !validCount(mf.size) || (own(mf, 'remote') && !remoteValide(mf.remote))) { errors.push('Description de fichier invalide'); continue; }
      if (hashes.has(mf.sha256)) { errors.push('Empreinte de fichier répétée : ' + mf.sha256); continue; }
      hashes.add(mf.sha256);
      payload.missing.push({ sha256: mf.sha256, mime: mf.mime, size: mf.size, ...(own(mf, 'remote') ? { remote: mf.remote } : {}) });
    }
    if (!validCount(manifest.counts.files) || manifest.counts.files !== manifest.files.length) errors.push('Décompte différent : files');
    for (const name of Object.keys(manifest.counts)) if (!own(STORES, name)) errors.push('Décompte de magasin inconnu : ' + name);
    for (const path of zip.keys()) if (!paths.has(path)) errors.push('Entrée non déclarée dans le manifeste : ' + path);
    const relationErrors = checkRelations(payload.stores, new Set([...payload.files.map((f) => f.sha256), ...payload.missing.map((m) => m.sha256)]));
    errors.push(...relationErrors);
    if (payload.stores.settings?.some((r) => record(r) && SECRET_SETTING_KEYS.includes(r.key))) warnings.push('Les réglages secrets présents dans cette archive seront ignorés.');
    return {
      ok: errors.length === 0, errors, warnings, manifest, payload,
      summary: { counts: Object.fromEntries(Object.entries(payload.stores).map(([name, rows]) => [name, rows.length])),
        files_ok: payload.files.length, files_missing: missing, hash_mismatches: hashMismatch, relation_errors: relationErrors.length,
        files_distants: payload.missing.length, files_copies: payload.files.filter((f) => own(f, 'bytes_sha256')).length },
    };
  } catch (e) {
    errors.push('Archive illisible : ' + e.message);
    return fail();
  }
}

function requireInspection(inspection, mode) {
  if (!['merge', 'replace'].includes(mode)) throw new Error('Mode de restauration inconnu');
  if (!inspection?.ok || !record(inspection.payload) || !Array.isArray(inspection.payload.files)) throw new Error('Archive non validée');
  const errors = validateRows(inspection.payload.stores);
  const hashes = new Set();
  for (const file of inspection.payload.files) {
    if (!record(file)) { errors.push('Fichier de restauration invalide'); continue; }
    const attendu = own(file, 'bytes_sha256') ? file.bytes_sha256 : file.sha256;
    const taille = own(file, 'bytes_size') ? file.bytes_size : file.size; // F-8 : (bytes_size ?? size) === bytes.length
    if (!HASH.test(file.sha256) || !HASH.test(attendu) || hashes.has(file.sha256) || !(file.bytes instanceof Uint8Array) || taille !== file.bytes.length || !validKey(file.mime)) errors.push('Fichier de restauration invalide');
    else hashes.add(file.sha256);
  }
  for (const mf of Array.isArray(inspection.payload.missing) ? inspection.payload.missing : []) {
    if (!record(mf) || !HASH.test(mf.sha256) || !validKey(mf.mime) || !validCount(mf.size) || (own(mf, 'remote') && !remoteValide(mf.remote)) || hashes.has(mf.sha256)) errors.push('Fichier de restauration invalide');
    else hashes.add(mf.sha256);
  }
  errors.push(...checkRelations(inspection.payload.stores, hashes)); // B-6 : files ∪ missing
  if (errors.length) throw new Error('Archive non validée : ' + errors.slice(0, 10).join(' · '));
}

// C1 (spec import-cible § 3.7) : SEUL un magasin ajouté après le format 1 peut manquer à l'archive (validateRows, par requireInspection,
// exige tous les autres) ; absent, il vaut [] — en remplacement, il est donc vidé.
function restoredStores(inspection) {
  return Object.fromEntries(DATA_STORES.map((name) => [name,
    name === 'settings' ? publicSettings(inspection.payload.stores[name]) : (MAGASINS_AJOUTES_APRES_V1.includes(name) ? (inspection.payload.stores[name] ?? []) : inspection.payload.stores[name]),
  ]));
}

// Fiches d'une archive qui relèvent de la synchronisation (spec § 5.2) : celles-là repartiront au serveur après
// une restauration, et c'est ce nombre que le bilan annonce avant le geste. Les réglages n'en sont pas ; les
// fichiers sources comptent pour une fiche chacun (ils voyagent dans le manifeste, pas dans data/*.json).
// Pure : aucune lecture de base, aucun DOM.
export function compterFichesSynchronisees(inspection) {
  const stores = inspection?.payload?.stores;
  if (!stores) return 0;
  let total = 0;
  for (const name of SYNC_STORES) {
    if (name === 'files') total += (inspection.payload.files?.length || 0) + (inspection.payload.missing?.length || 0);
    else total += stores[name]?.length || 0;
  }
  return total;
}

// R61 (complément) : ce qu'une fiche restaurée doit devenir, pour un magasin synchronisé. Nommé une fois, et relu
// par `verifyRestored` : le bilan de restauration doit comparer la base à ce que la restauration PROMET d'écrire,
// sinon un nettoyage voulu serait annoncé comme un écart et toute restauration d'une vieille archive finirait en
// rouge. Raison du nettoyage : R61 retire les caractères de contrôle à l'écriture (`repo.save`/`saveBatch`), mais
// `applyArchive` écrit par `db.putBatch` sans passer par `repo` — une archive d'avant cette vague ramenait donc des
// fiches sales, et la fiche locale (sale) différait de la copie du serveur (que `lots.js` nettoie à l'envoi) à
// instants ÉGAUX : le conflit perpétuel revenait par la porte de l'archive. Un `Blob` traverse intact.
const ficheRestauree = (name, row) => (SYNC_STORES.includes(name) && record(row) ? nettoyerChaines(row) : row);

// Normalisation des fiches restaurées (spec § 5.2, § 5.3) — trois règles, sur les magasins synchronisés, dans la
// même boucle :
//  1. NETTOYAGE (R61), dans tous les modes, avec ou sans compte : les caractères de contrôle sont retirés, pour que
//     la fiche écrite ici soit identique, octet pour octet, à celle que le serveur recevra.
//  2. COMPLÉTUDE (R-L3-10), dans tous les modes, avec ou sans compte : une fiche sans `updated_at` en reçoit un.
//     Les fiches d'avant ce lot et toutes les lignes « files » (dont les métadonnées sont reconstruites ici) en
//     sont dépourvues ; sync_push les rejetterait pour le motif « updated_at » et elles partiraient en quarantaine.
//  3. RENVOI VOULU (R-L3-18) : avec un compte connecté, `horodater` est fourni et TOUTES les fiches en reçoivent
//     un neuf — en fusion comme en remplacement. Sans cela le serveur garderait sa version (I7 : updated_at
//     strictement supérieur gagne) et la restauration ne se verrait sur aucun autre appareil. Un remplacement ne
//     supprime rien chez le fournisseur pour autant : ce qui n'est pas dans l'archive y reste (dit par Réglages).
function normaliserFiches(batch, { horodater }) {
  const renvoi = typeof horodater === 'function';
  for (const name of SYNC_STORES) {
    const rows = batch[name];
    if (!Array.isArray(rows)) continue;
    for (const [i, row] of rows.entries()) {
      if (!record(row)) continue;
      const fiche = ficheRestauree(name, row);
      if (renvoi) fiche.updated_at = horodater();
      else if (!fiche.updated_at) fiche.updated_at = syncNow();
      rows[i] = fiche;
    }
  }
}

// R-G-6 (C-1) : ce que la restauration écrit pour une entrée `files`, NOMMÉ UNE FOIS et relu par applyArchive ET verifyRestored (le gabarit de
// ficheRestauree, R61 : le bilan compare la base à ce que la restauration a PROMIS). Un blob local ORIGINAL n'est jamais remplacé par une copie
// venue d'une archive, ni en fusion ni en remplacement ; une copie locale cède à ce que l'archive porte (l'original, ou une autre copie).
export function octetsRestaures(entry, ligne) {
  const entreeOriginale = (entry.bytes_sha256 ?? entry.sha256) === entry.sha256;
  const originalIci = ligne?.blob instanceof Blob && estOriginalIci(ligne);
  if (originalIci && !entreeOriginale) return { garder: true, blob: ligne.blob, attendu: { sha256: entry.sha256, size: entry.size } };
  return { garder: false, blob: new Blob([entry.bytes], { type: entry.bytes_mime ?? entry.mime }), attendu: { sha256: entry.bytes_sha256 ?? entry.sha256, size: entry.bytes_size ?? entry.size } };
}

// Tout préparer AVANT la transaction. Effacement et écritures sont validés ou annulés ensemble.
export async function applyArchive(db, inspection, { mode = 'merge', horodater = null } = {}) {
  requireInspection(inspection, mode);
  const batch = structuredClone(restoredStores(inspection));
  // R-G-6 : la ligne locale est lue DANS LES DEUX MODES — sans elle, un original ne peut ni être reconnu ni survivre à clearStores (il ne survit
  // que porté dans le batch). En remplacement, elle ne sert QU'À octetsRestaures : ni ...existing, ni son remote, ni son created_at.
  const existingFiles = new Map((await db.getSnapshot(['files'])).files.map((row) => [row.sha256, row]));
  const fusion = mode === 'merge';
  const maintenant = new Date().toISOString();
  let originauxConserves = 0;
  batch.files = [];
  for (const file of inspection.payload.files) {
    const existing = existingFiles.get(file.sha256);
    const o = octetsRestaures(file, existing);
    if (!o.garder && await sha256Hex(o.blob) !== o.attendu.sha256) throw new Error('Fichier modifié depuis la validation : ' + file.sha256);
    if (o.garder) originauxConserves += 1;
    batch.files.push({ ...(fusion ? existing : {}), sha256: file.sha256, blob: o.blob, mime: file.mime, size: file.size,
      remote: file.remote ?? (fusion ? existing?.remote ?? null : null), created_at: (fusion ? existing?.created_at : null) || maintenant });
  }
  for (const mf of inspection.payload.missing || []) {
    const existing = existingFiles.get(mf.sha256);
    // D-G7 : restaurée SANS blob ; en fusion, un blob local déjà là est gardé (porté par ...existing).
    batch.files.push({ ...(fusion ? existing : {}), sha256: mf.sha256, mime: mf.mime, size: mf.size,
      remote: mf.remote ?? (fusion ? existing?.remote ?? null : null), created_at: (fusion ? existing?.created_at : null) || maintenant });
  }
  normaliserFiches(batch, { horodater });
  // K-7 (spec assistant-par-le-compte) : la configuration de l'assistant n'est pas de la bibliothèque — une
  // restauration en remplacement ne la vide pas (elle n'est dans aucune archive : il n'y aurait rien pour la réécrire).
  await db.putBatch(batch, { clearStores: mode === 'replace' ? Object.keys(STORES).filter((s) => !SYNC_INTERNAL_STORES.includes(s) && s !== 'assistant_config') : [] });
  return { ...Object.fromEntries(Object.entries(batch).map(([name, rows]) => [name, rows.length])), originauxConserves };
}

// Comparaison JSON indépendante de l’ordre des propriétés, sensible à l’ordre des tableaux.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

// Comparaison sans l’heure de modification : une fiche réhorodatée par la restauration elle-même n’est pas une
// fiche différente. Tout le reste du contenu est comparé strictement (quantités, étapes, relations).
function canonicalSansHeure(value) {
  const { updated_at: _heure, ...reste } = value;
  return canonical(reste);
}

// Vérifie un instantané cohérent après écriture : contenu complet, clés, relations et fichiers.
// En fusion, les autres fiches sont conservées ; en remplacement, aucun surplus n’est attendu.
// `horodate` : la restauration a réhorodaté les magasins synchronisés (compte connecté, cf. applyArchive).
// La SEULE différence tolérée est alors l’heure de modification, et seulement sur un magasin synchronisé — sans
// cette tolérance, chaque restauration d’un compte connecté serait annoncée comme une restauration en écart.
export async function verifyRestored(db, inspection, { mode = 'merge', horodate = false } = {}) {
  requireInspection(inspection, mode);
  const synchronises = new Set(SYNC_STORES);
  const diffs = [];
  const snapshot = await db.getSnapshot(Object.keys(STORES));
  const expected = restoredStores(inspection);
  const currentStores = Object.fromEntries(DATA_STORES.map((name) => [name, snapshot[name]]));
  diffs.push(...validateRows(currentStores));
  for (const name of DATA_STORES) {
    const key = STORES[name].keyPath;
    const rows = snapshot[name];
    const byId = new Map(rows.map((row) => [row[key], row]));
    if (mode === 'replace' && rows.length !== expected[name].length) diffs.push(name + ' : décompte différent après restauration');
    for (const brute of expected[name]) {
      // R61 : la fiche attendue est celle que la restauration a PROMIS d'écrire — nettoyée pour un magasin
      // synchronisé. Comparer la fiche brute de l'archive annoncerait un écart pour chaque caractère de contrôle
      // délibérément retiré, et toute restauration d'une vieille archive finirait en rouge.
      const row = ficheRestauree(name, brute);
      const current = byId.get(row[key]);
      if (!current) { diffs.push(name + ' : ' + row[key] + ' absent après restauration'); continue; }
      if (canonical(current) === canonical(row)) continue;
      // Une heure posée par la restauration (renvoi voulu, ou complétude d’une fiche d’avant le lot) est la seule
      // différence admise, et seulement là où elle a pu être posée : un magasin synchronisé, une heure présente.
      const heurePosee = synchronises.has(name) && (horodate || !row.updated_at) && !!current.updated_at;
      if (heurePosee && canonicalSansHeure(current) === canonicalSansHeure(row)) continue;
      diffs.push(name + ' : contenu différent pour ' + row[key]);
    }
  }
  const filesBySha = new Map(snapshot.files.map((row) => [row.sha256, row]));
  // Une ligne sans octets (missing_files, ou reçue sans être téléchargée) n'entre pas dans le décompte (spec § 3.4).
  const comparableFiles = snapshot.files.filter((row) => row.blob instanceof Blob);
  if (mode === 'replace' && comparableFiles.length !== inspection.payload.files.length) diffs.push('files : décompte différent après restauration');
  // N-1 : un remote n'est comparé que si l'entrée en porte un (en fusion, une entrée sans remote laisse celui de la ligne locale).
  const memeRemote = (row, entree) => !own(entree, 'remote') || canonical(row.remote ?? null) === canonical(entree.remote);
  for (const file of inspection.payload.files) {
    const row = filesBySha.get(file.sha256);
    if (!row) { diffs.push('Fichier absent : ' + file.sha256); continue; }
    if (!(row.blob instanceof Blob)) { diffs.push('Fichier illisible : ' + file.sha256); continue; }
    const { attendu } = octetsRestaures(file, row); // R-G-6 : la même décision qu'à l'application, jamais bytes_sha256 ?? sha256 en brut
    if (row.size !== file.size || row.mime !== file.mime || row.blob.size !== attendu.size) diffs.push('Métadonnées de fichier différentes : ' + file.sha256);
    if (await sha256Hex(row.blob) !== attendu.sha256) diffs.push('Empreinte différente : ' + file.sha256);
    if (!memeRemote(row, file)) diffs.push('Copie serveur différente : ' + file.sha256);
  }
  for (const mf of inspection.payload.missing || []) {
    const row = filesBySha.get(mf.sha256);
    if (!row) { diffs.push('Fichier absent : ' + mf.sha256); continue; }
    if (!memeRemote(row, mf)) diffs.push('Copie serveur différente : ' + mf.sha256);
  }
  diffs.push(...checkRelations(currentStores, new Set(filesBySha.keys())));
  return { ok: diffs.length === 0, diffs };
}
