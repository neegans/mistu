// Lot G « Les photos voyagent entre appareils » (spec § 3, § 4.7, § 4.8) : UNE définition de ce qu'est un fichier référencé, une ligne à
// envoyer, la fusion d'une ligne venue du serveur, l'écriture d'octets reçus et la garde de relecture (I-G10) — relues par la passe, la
// capture, les lots, la réception, les ajustements, les conflits, l'archive, repo.putFile et Réglages. Contrainte Node (F-12) : aucun global
// du navigateur au niveau du module (tools/fichiers-node.test.mjs l'importe sous Node). Les modules de src/sync/ n'importent jamais repo.
import { remoteValide, remoteDeCeCompte } from './tables.js';
import { isAllowed } from './mime.js';
import { t } from '../core/i18n.js';

export { remoteValide, remoteDeCeCompte };
export const HASH_FICHIER = /^[a-f0-9]{64}$/;

// L'original est ICI quand la taille du blob est celle de la ligne (sans hachage ; limite dite § 11 : une copie de la même taille passerait).
export const estOriginalIci = (row) => row?.blob instanceof Blob && row.blob.size === row.size;
// Une copie dont la taille n'est plus celle que le serveur porte (renvoi en originale fait ailleurs) : `present`, comptée, jamais retéléchargée.
export const copiePerimee = (row) => row?.blob instanceof Blob && !estOriginalIci(row) && remoteValide(row.remote) && row.blob.size !== row.remote.size;

// § 3.5 : les cinq pointeurs vers `files` ; une ligne hors de cet ensemble est un orphelin (ni envoyé, ni compté, ni effacé — D-G1).
const POINTEURS = [['source_pages', 'sha256'], ['source_documents', 'sha256'], ['book_editions', 'cover_sha256'], ['recipes', 'photo_sha256'], ['imports', 'photo_sha256']];
export function referencesFichiers(snapshot) {
  const refs = new Set();
  for (const [store, champ] of POINTEURS) {
    for (const r of snapshot?.[store] || []) { const v = r?.[champ]; if (typeof v === 'string' && HASH_FICHIER.test(v)) refs.add(v); }
  }
  return refs;
}

// Quatre états (§ 3.1) ; `erreur` prime : une clé posée est un fait qu'un geste retire.
export function etatFichier(row, { uid = null, erreurs = new Set() } = {}) {
  if (row && erreurs.has(row.sha256)) return 'erreur';
  if (row?.blob instanceof Blob) return 'present';
  if (row && remoteDeCeCompte(row.remote, uid)) return 'distant';
  return 'absent';
}

// Le nom que la personne reconnaît (B-23, I-G8), par l'inverse de referencesFichiers ; repli : l'empreinte tronquée à 12.
export function nomFichier(sha256, snapshot = {}) {
  const parId = (store) => new Map((snapshot?.[store] || []).filter(Boolean).map((r) => [r.id, r]));
  const documents = parId('source_documents'), editions = parId('book_editions'), livres = parId('books');
  const titreLivre = (editionId) => { const ed = editionId ? editions.get(editionId) : null; return (ed && livres.get(ed.book_id)?.title) || null; };
  const page = (snapshot?.source_pages || []).find((p) => p?.sha256 === sha256);
  if (page) {
    const livre = titreLivre(documents.get(page.document_id)?.edition_id ?? page.edition_id);
    const p = page.printed_page ?? null;
    if (livre) return p != null ? t('Page {p} · {livre}', { p, livre }) : t('page non numérotée · {livre}', { livre });
    return p != null ? t('Page {p}', { p }) : t('page non numérotée');
  }
  const doc = (snapshot?.source_documents || []).find((d) => d?.sha256 === sha256);
  if (doc?.original_filename) return String(doc.original_filename);
  const edition = (snapshot?.book_editions || []).find((e) => e?.cover_sha256 === sha256);
  if (edition) return t('Couverture · {livre}', { livre: titreLivre(edition.id) || t('Sans titre') });
  const recette = (snapshot?.recipes || []).find((r) => r?.photo_sha256 === sha256);
  if (recette) return t('Photo du plat · {titre}', { titre: recette.original_title || t('Sans titre') }); // les versions ne portent pas de titre (doute 7)
  const imp = (snapshot?.imports || []).find((i) => i?.photo_sha256 === sha256);
  if (imp) return t('Photo importée · {date}', { date: String(imp.created_at || '').slice(0, 10) });
  return String(sha256).slice(0, 12);
}

// Les lignes à envoyer (§ 4.7, 2.) : un ORIGINAL ici (jamais une copie du serveur, S-3), syncable, référencé, sans file_error, et sans remote de
// ce compte — ou, seulement sur « Renvoyer en originale », une ligne partie réduite (B-21). Triées par created_at ?? updated_at (B-20).
const dateDe = (row) => String(row?.created_at ?? row?.updated_at ?? '');
export function candidatsEnvoi(snapshot, { uid = null, renvoi = false, erreurs = new Set() } = {}) {
  const refs = referencesFichiers(snapshot);
  return (snapshot?.files || [])
    .filter((row) => row && estOriginalIci(row) && row.syncable !== false && refs.has(row.sha256) && !erreurs.has(row.sha256)
      && (!remoteDeCeCompte(row.remote, uid) || (renvoi && row.remote.sha256 !== row.sha256)))
    .sort((a, b) => (dateDe(a) < dateDe(b) ? -1 : dateDe(a) > dateDe(b) ? 1 : 0));
}

// D-G16 : UNE règle pour toute écriture d'une ligne files depuis une copie serveur (réception, adjusted, garderAilleurs, tombale) :
// { ...métadonnées locales sans blob ni remote, ...data, updated_at } + le blob local s'il existe. `remote` est celui de data — jamais
// effacé quand data le porte, jamais `true`, jamais gardé du local quand data ne le porte pas.
export function fusionnerFichier(locale, data, updated_at) {
  const { blob, remote: _ancien, ...meta } = locale || {};
  const fiche = { ...meta, ...(data || {}), updated_at };
  if (blob instanceof Blob) fiche.blob = blob;
  return fiche;
}

// Octets reçus du serveur (§ 3.1) : ni size, ni mime, ni updated_at ne bougent (sinon chaque écho ferait un conflit) ; une règle, deux appelants
// (repo.putFile d'origine remote et la passe, F-20).
export const fusionnerOctetsRecus = (existing, blob) => ({ ...existing, blob, syncable: isAllowed(existing?.mime) });

// Garde de relecture à l'envoi (N-2) : rien si la ligne a bougé depuis la lecture (réception pendant l'envoi : S-10) ou si ce remote est
// DÉJÀ posé pour cette empreinte sous ce compte ; un renvoi en originale et un ré-envoi sous un autre compte passent.
export function peutEcrireRemote(avant, relue, { h, uid } = {}) {
  if (!relue || !(relue.blob instanceof Blob)) return false;
  if ((relue.updated_at ?? null) !== (avant?.updated_at ?? null)) return false;
  return !(remoteDeCeCompte(relue.remote, uid) && relue.remote.sha256 === h);
}

// Même forme à la réception (§ 4.8) : rien si un blob est déjà là ou si la ligne a bougé pendant la descente.
export const peutEcrireOctets = (avant, relue) => !!relue && !(relue.blob instanceof Blob) && (relue.updated_at ?? null) === (avant?.updated_at ?? null);
