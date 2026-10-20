// Lot G « Les photos voyagent entre appareils » (spec § 3, § 4.7, § 4.8) : UNE définition de ce qu'est un fichier référencé, une ligne à
// envoyer, la fusion d'une ligne venue du serveur, l'écriture d'octets reçus et la garde de relecture (I-G10) — relues par la passe, la
// capture, les lots, la réception, les ajustements, les conflits, l'archive, repo.putFile et Réglages. Contrainte Node (F-12) : aucun global
// du navigateur au niveau du module (tools/fichiers-node.test.mjs l'importe sous Node). Les modules de src/sync/ n'importent jamais repo.
import { remoteValide, remoteDeCeCompte, HASH_FICHIER, CHAMPS_FILES_SERVEUR } from './tables.js';
import { isAllowed } from './mime.js';
import { t } from '../core/i18n.js';

export { remoteValide, remoteDeCeCompte, HASH_FICHIER };

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

// Le nom que la personne reconnaît (B-23, I-G8), par l'inverse de referencesFichiers ; repli : l'empreinte tronquée à 12. Ronde 1 : le snapshot
// est indexé UNE fois (WeakMap ; un snapshot de db.getSnapshot est neuf à chaque lecture et n'est pas modifié ensuite) — nommer N fichiers ne
// relit plus M lignes par appel ; la première ligne d'une empreinte la nomme, comme le `find` d'avant.
const INDEX_NOMS = new WeakMap();
function indexNoms(snapshot) {
  if (INDEX_NOMS.has(snapshot)) return INDEX_NOMS.get(snapshot);
  const par = (store, champ) => { const m = new Map(); for (const r of snapshot[store] || []) { const v = r?.[champ]; if (v != null && !m.has(v)) m.set(v, r); } return m; };
  const ix = { documents: par('source_documents', 'id'), editions: par('book_editions', 'id'), livres: par('books', 'id'), pages: par('source_pages', 'sha256'),
    docs: par('source_documents', 'sha256'), couvertures: par('book_editions', 'cover_sha256'), plats: par('recipes', 'photo_sha256'), imports: par('imports', 'photo_sha256') };
  INDEX_NOMS.set(snapshot, ix);
  return ix;
}
export function nomFichier(sha256, snapshot = {}) {
  const ix = indexNoms(snapshot && typeof snapshot === 'object' ? snapshot : {});
  const titreLivre = (editionId) => { const ed = editionId ? ix.editions.get(editionId) : null; return (ed && ix.livres.get(ed.book_id)?.title) || null; };
  const page = ix.pages.get(sha256);
  if (page) {
    const livre = titreLivre(ix.documents.get(page.document_id)?.edition_id ?? page.edition_id);
    const p = page.printed_page ?? null;
    if (livre) return p != null ? t('Page {p} · {livre}', { p, livre }) : t('page non numérotée · {livre}', { livre });
    return p != null ? t('Page {p}', { p }) : t('page non numérotée');
  }
  const doc = ix.docs.get(sha256);
  if (doc?.original_filename) return String(doc.original_filename);
  const edition = ix.couvertures.get(sha256);
  if (edition) return t('Couverture · {livre}', { livre: titreLivre(edition.id) || t('Sans titre') });
  const recette = ix.plats.get(sha256);
  if (recette) return t('Photo du plat · {titre}', { titre: recette.original_title || t('Sans titre') }); // les versions ne portent pas de titre (doute 7)
  const imp = ix.imports.get(sha256);
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
// { ...métadonnées locales sans blob ni remote, champs serveur de data, updated_at } + le blob local s'il existe. Ronde 1 (I-G3) : `data` est
// une donnée hostile — seuls les champs du serveur en sont pris (`mime`, `size`, `original_filename`, et `sha256` pour une ligne neuve : la clé
// d'ici ne change jamais), jamais `blob`, `syncable` ni `created_at` ; avec un blob local, la taille et le type locaux restent (ceux des octets
// d'ici : un original ne devient jamais une « copie » par une ligne reçue). `remote` est celui de data — l'objet s'il est valide, `null`
// sinon (jamais `true`), absent si data ne le porte pas (jamais gardé du local).
const PRIS_DU_SERVEUR = CHAMPS_FILES_SERVEUR.filter((c) => c !== 'remote' && c !== 'updated_at');
export function fusionnerFichier(locale, data, updated_at) {
  const { blob, remote: _ancien, ...meta } = locale || {};
  const recue = data && typeof data === 'object' ? data : {};
  const fiche = { ...meta };
  for (const champ of PRIS_DU_SERVEUR) {
    if (!Object.hasOwn(recue, champ) || recue[champ] === undefined) continue;
    const garde = champ === 'sha256' || (blob instanceof Blob && (champ === 'size' || champ === 'mime'));
    if (!(garde && fiche[champ] !== undefined)) fiche[champ] = recue[champ];
  }
  if (Object.hasOwn(recue, 'remote')) fiche.remote = remoteValide(recue.remote) ? recue.remote : null;
  fiche.updated_at = updated_at;
  if (blob instanceof Blob) fiche.blob = blob;
  return fiche;
}

// F-7 (§ 3.2, ronde 1) : deux remotes sont-ils la même copie serveur ? Comparés validés (true, absent, invalide → aucun), clés triées (jsonb
// réordonne). Une définition pour la réception, la tombale et « Garder celle d'ailleurs ».
const canonique = (r) => (remoteValide(r) ? JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]])) : 'null');
export const memeRemote = (a, b) => canonique(a) === canonique(b);

// La même règle, refaite DANS la transaction d'écriture (db.mutate, condition `fusion` ; ronde 1, I-G3) : la fusion porte sur la ligne RELUE,
// et un blob arrivé depuis la lecture de l'appelant (copie téléchargée, original importé) n'est jamais effacé. `avant` : la ligne lue (null si
// absente). Disparue depuis : rien. Bougée depuis (updated_at changé : une version d'ici plus récente, qui a sa propre entrée de file — I7) :
// rien. Apparue depuis : la fusion se fait sur elle. Absente avant comme après : la ligne reçue est créée (si elle porte la clé).
export function conditionFichier(sha256, avant, data, updated_at) {
  return { key: sha256, fusion: (courant) => {
    if (!courant) { if (avant) return null; const neuve = fusionnerFichier(null, data, updated_at); return neuve.sha256 === sha256 ? neuve : null; }
    if (avant && (courant.updated_at ?? null) !== (avant.updated_at ?? null)) return null;
    return fusionnerFichier(courant, data, updated_at);
  } };
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
