// Lot G « Les photos voyagent entre appareils » (spec § 3, § 4.7, § 4.8) : UNE définition de ce qu'est un fichier référencé, une ligne à
// envoyer, la fusion d'une ligne venue du serveur, l'écriture d'octets reçus et la garde de relecture (I-G10) — relues par la passe, la
// capture, les lots, la réception, les ajustements, les conflits, l'archive, repo.putFile et Réglages. Contrainte Node (F-12) : aucun global
// du navigateur au niveau du module (tools/fichiers-node.test.mjs l'importe sous Node). Les modules de src/sync/ n'importent jamais repo.
import { remoteValide, remoteDeCeCompte, HASH_FICHIER, CHAMPS_FILES_SERVEUR } from './tables.js';
import { isAllowed } from './mime.js';
import { t } from '../core/i18n.js';
import { reduireImage, dimensionsImage, LIMITES_COUVERTURE, ErreurImage } from '../core/image.js';
import { sha256Hex } from '../core/hash.js';
import { dejaPresent, introuvable, erreurNommee } from './transport.js';
import { nettoyerChaines } from './lots.js';
import { syncNow, reculMs } from './clock.js'; // reculMs vit dans clock.js (feuille) depuis la ronde 1 de la tâche 3 : plus aucun cycle avec push.js
import { logError } from '../core/log.js';

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
const parDate = (a, b) => (dateDe(a) < dateDe(b) ? -1 : dateDe(a) > dateDe(b) ? 1 : 0); // un tri, deux appelants (envoi et téléchargement global)
export function candidatsEnvoi(snapshot, { uid = null, renvoi = false, erreurs = new Set() } = {}) {
  const refs = referencesFichiers(snapshot);
  return (snapshot?.files || [])
    .filter((row) => row && estOriginalIci(row) && row.syncable !== false && refs.has(row.sha256) && !erreurs.has(row.sha256)
      && (!remoteDeCeCompte(row.remote, uid) || (renvoi && row.remote.sha256 !== row.sha256)))
    .sort(parDate);
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

export const LIMITES_FICHIERS = Object.freeze({
  parPasse: 20, dureeMs: 60000, octetsMax: 52428800,
  pixelsMax: LIMITES_COUVERTURE.pixels, // 16 Mpx : une seule borne dans l'app (R-G-4 : hauteur à relever après mesure, § 10 geste 8)
  reduite: Object.freeze({ maxCote: 2000, qualite: 0.8, octetsTelQuel: 614400 }),
});
// Le snapshot de la passe : pris UNE fois (S-12) et relu par envoyer, telechargerTout et compterFichiers.
export const MAGASINS_FICHIERS = Object.freeze(['source_pages', 'source_documents', 'book_editions', 'recipes', 'imports', 'files', 'books']);
const PREFIXE_ERREUR = 'file_error:';

export async function lireErreursFichiers(db) {
  return new Map((await db.getAll('sync_state')).filter((l) => String(l?.key).startsWith(PREFIXE_ERREUR)).map((l) => [l.key.slice(PREFIXE_ERREUR.length), l.value]));
}

// Les compteurs de Réglages (§ 3.6, § 4.1) : des lignes RÉFÉRENCÉES seulement ; un remote d'un autre compte n'est jamais « à télécharger ».
export function compterFichiers(snapshot, { uid = null, erreurs = new Map() } = {}) {
  const refs = referencesFichiers(snapshot);
  const c = { aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0, aRenvoyer: 0 };
  for (const row of snapshot?.files || []) {
    if (!row || !refs.has(row.sha256)) continue;
    if (erreurs.has(row.sha256)) { c.enErreur += 1; continue; }
    if (row.syncable === false) { c.typeInconnu += 1; continue; }
    const deCeCompte = remoteDeCeCompte(row.remote, uid);
    if (estOriginalIci(row)) {
      if (!deCeCompte) c.aEnvoyer += 1;
      else if (row.remote.sha256 !== row.sha256) c.aRenvoyer += 1;
    } else if (row.blob instanceof Blob) {
      if (!deCeCompte) c.copiesSansServeur += 1;
      else if (copiePerimee(row)) c.copiesPerimees += 1;
    } else if (deCeCompte) { c.aTelecharger += 1; c.octetsATelecharger += row.remote.size; }
  }
  return c;
}

// Les octets qui partent (§ 4.7 a, D-G3, R-G-4) : Originale ou non-image → tels quels ; au-dessus du mur de pixels → tels quels SANS décodage ;
// petite et légère → telle quelle ; sinon réduite en JPEG — indécodable (HEIC hors Safari) ou plus grosse que l'original → l'original.
// Ronde 1 : TOUTE levée de `reduire` donne l'original (journalisée si ce n'est pas une ErreurImage : EncodingError de convertToBlob, contexte
// 2D nul sous pression mémoire) — la réduction est une économie, jamais un mur : un fichier ne bloque plus la passe ni ceux qui le suivent.
export async function octetsAEnvoyer(row, { qualite = 'reduite', reduire = reduireImage, limites = LIMITES_FICHIERS } = {}) {
  const telQuel = { blob: row.blob, mime: row.mime, tropGrande: false, pixels: null };
  if (qualite === 'originale' || !String(row.mime).startsWith('image/')) return telQuel;
  const dims = await dimensionsImage(row.blob);
  const pixels = dims ? dims.largeur * dims.hauteur : null;
  if (pixels !== null && pixels > limites.pixelsMax) return { ...telQuel, tropGrande: true, pixels };
  if (dims && Math.max(dims.largeur, dims.hauteur) <= limites.reduite.maxCote && row.blob.size <= limites.reduite.octetsTelQuel) return telQuel;
  let reduite;
  try { reduite = await reduire(row.blob, { maxCote: limites.reduite.maxCote, qualite: limites.reduite.qualite }); }
  catch (error) {
    if (!(error instanceof ErreurImage)) logError('sync.fichiers.reduction', { reason: String(error?.name || 'Error').slice(0, 40) });
    return telQuel;
  }
  if (!(reduite instanceof Blob) || reduite.size > row.blob.size) return telQuel;
  return { blob: reduite, mime: 'image/jpeg', tropGrande: false, pixels };
}

export function createFichiers({ db, stockage, getUserId, qualite = () => 'reduite', reduire = reduireImage, hacher = sha256Hex, maintenant = Date.now, limites = LIMITES_FICHIERS }) {
  let tentatives = 0; // échecs passagers consécutifs de l'envoi (recul), remis à zéro à la première confirmation
  const enVol = new Set(); // une seule descente à la fois par clé
  const iso = () => new Date(maintenant()).toISOString();
  // Une clé file_error n'est posée que sur une empreinte de forme valide (S-13) : une clé venue du serveur ne devient jamais une clé sync_state.
  async function poserErreur(sha256, motif, sens) {
    if (!HASH_FICHIER.test(String(sha256))) { logError('sync.fichiers.forme', { reason: motif }); return; }
    await db.mutate({ puts: { sync_state: [{ key: PREFIXE_ERREUR + sha256, value: { motif, sens, at: iso() } }] }, origin: 'device' });
  }
  const remplacer = (snapshot, ligne) => {
    const liste = snapshot?.files;
    const i = Array.isArray(liste) ? liste.findIndex((r) => r?.sha256 === ligne.sha256) : -1;
    if (i >= 0) liste[i] = ligne;
  };
  // Les bornes d'une passe (§ 4.7, 3.) : `parPasse` fichiers, `dureeMs`, et `stop()` relu avant chaque fichier — envoi et téléchargement global.
  const dansLaBorne = (i, debut, stop) => i < limites.parPasse && maintenant() - debut < limites.dureeMs && !stop();
  // « Déjà présent » vérifié par la taille (D-G2) : list(search = h), l'objet nommé h, metadata.size égale. Ronde 1 : une liste qui échoue
  // rend son erreur, jamais « taille différente » — rien d'un upsert ni d'une « vérification » sur une liste qui n'a pas répondu (§ 4.10).
  async function verifierDistant(uid, h, taille) {
    const r = await stockage.lister(uid, { search: h, limit: 1 });
    if (r.erreur) return { erreur: r.erreur };
    const objet = r.objets.find((o) => o?.name === h);
    return { confirme: !!objet && Number(objet.metadata?.size) === taille };
  }
  // Une liste n'est qu'une lecture : seul `auth` y garde son sens ; tout autre échec (reseau, refus, quota, inconnu) est passager — recul,
  // jamais un fichier marqué ni une pause des photos sur la foi d'une lecture.
  const erreurDeListe = (e) => (e.type === 'auth' || e.type === 'reseau' ? e : { ...e, type: 'inconnu' });
  // Un envoi vérifié (§ 4.7 c-d) : { confirme: true } | { verification: true } (déjà présent, deux tailles différentes) | { erreur } (classée,
  // celle de l'envoi, de l'upsert ou de la liste) — un seul chemin de sortie par issue.
  async function envoyerVerifie(uid, h, corps) {
    const chemin = `${uid}/${h}`;
    const r = await stockage.envoyer(chemin, corps, { upsert: false });
    if (!r.erreur) return { confirme: true };
    if (!dejaPresent(r.erreur)) return { erreur: r.erreur };
    const v = await verifierDistant(uid, h, corps.size);
    if (v.erreur) return { erreur: erreurDeListe(v.erreur) };
    if (v.confirme) return { confirme: true };
    const r2 = await stockage.envoyer(chemin, corps, { upsert: true });
    if (r2.erreur) return { erreur: r2.erreur };
    const v2 = await verifierDistant(uid, h, corps.size);
    if (v2.erreur) return { erreur: erreurDeListe(v2.erreur) };
    return v2.confirme ? { confirme: true } : { verification: true };
  }

  async function envoyer({ stop = () => false, surProgression = () => {}, snapshot } = {}) {
    const bilan = { confirmes: 0, erreurs: 0, restants: 0, attenteConnexion: false, pauseFichiers: false, erreur: null, recul: null };
    const uid = getUserId();
    if (!uid) return { ...bilan, rien: true };
    if ((await db.get('sync_state', 'pause_fichiers'))?.value) return { ...bilan, pause: true };
    const renvoi = !!(await db.get('sync_state', 'renvoi_originale'))?.value;
    const candidats = candidatsEnvoi(snapshot, { uid, renvoi, erreurs: await lireErreursFichiers(db) });
    if (renvoi && !candidats.some((r) => remoteDeCeCompte(r.remote, uid))) await db.mutate({ deletes: { sync_state: ['renvoi_originale'] }, origin: 'device' });
    const debut = maintenant();
    let tropGrandeDite = false;
    let i = 0;
    for (; i < candidats.length; i += 1) {
      if (!dansLaBorne(i, debut, stop)) break;
      const row = candidats[i];
      surProgression({ sens: 'envoi', n: i + 1, total: candidats.length });
      const choisie = qualite(); // relue à CHAQUE fichier : le réglage peut changer pendant la passe (B-16)
      // Ronde 1 de la tâche 4 (REVUE B) : les deux lectures du blob local — l'en-tête (dimensionsImage) puis l'empreinte — peuvent lever (un
      // blob IndexedDB que WebKit ne relit plus : NotReadableError). Sans filet, la ligne restait première candidate (tri par date) et bloquait à
      // vie celles qui la suivent : elle est marquée UNE fois (`illisible`, envoi ; « Réessayer » la retente), la passe continue.
      let octets = null; let h = null;
      try {
        // Un renvoi (la ligne porte déjà un remote de ce compte) part toujours en originale : c'est ce que le geste demande.
        octets = await octetsAEnvoyer(row, { qualite: remoteDeCeCompte(row.remote, uid) ? 'originale' : choisie, reduire, limites });
        if (octets.blob.size <= limites.octetsMax) h = await hacher(octets.blob);
      } catch (error) {
        logError('sync.fichiers.illisible', { error });
        await poserErreur(row.sha256, 'illisible', 'envoi'); bilan.erreurs += 1; continue;
      }
      if (octets.tropGrande && !tropGrandeDite) { tropGrandeDite = true; logError('sync.fichiers.trop_grande', { count: octets.pixels }); }
      if (octets.blob.size > limites.octetsMax) { await poserErreur(row.sha256, 'trop_gros', 'envoi'); bilan.erreurs += 1; continue; }
      // Vague finale (chef d'orchestre, revue finale sécurité) : des octets partis TELS QUELS dont l'empreinte n'est pas celle de la ligne ne sont pas
      // l'original (copie de même taille, § 11 ; archive fabriquée) : rien ne part, la ligne est marquée une fois (forme, envoi : sans « Réessayer »).
      if (octets.blob === row.blob && h !== row.sha256) { await poserErreur(row.sha256, 'forme', 'envoi'); bilan.erreurs += 1; continue; }
      const corps = new Blob([octets.blob], { type: octets.mime }); // la copie retypée est la règle (S-2)
      // `quality` est le FAIT, jamais le réglage (D-G3, S-3). Ronde 1 : le remote est validé AVANT l'envoi — un fichier vide ou d'un type hors
      // liste ne peut porter aucun remote valide (il repartirait à chaque passe, à vie) : rien ne part, la ligne est marquée une fois.
      const remote = { sha256: h, size: corps.size, mime: octets.mime, quality: h === row.sha256 ? 'originale' : 'reduite', uploaded_at: iso(), owner: uid };
      if (!remoteValide(remote)) { await poserErreur(row.sha256, 'forme', 'envoi'); bilan.erreurs += 1; continue; }
      const envoi = await envoyerVerifie(uid, h, corps);
      if (envoi.verification) { await poserErreur(row.sha256, 'verification', 'envoi'); bilan.erreurs += 1; continue; }
      if (envoi.erreur) {
        const e = envoi.erreur;
        if (e.type === 'auth') { bilan.attenteConnexion = true; bilan.erreur = e; break; }
        if (e.type === 'quota') {
          await db.mutate({ puts: { sync_state: [{ key: 'pause_fichiers', value: { raison: 'stockage', at: iso() } }] }, origin: 'device' }); // jamais `pause` (D-G4)
          bilan.pauseFichiers = true; bilan.erreur = e; break;
        }
        if (e.type === 'refus') { await poserErreur(row.sha256, 'type', 'envoi'); bilan.erreurs += 1; continue; }
        logError('sync.fichiers.envoi', { reason: e.type, status: e.status });
        bilan.erreur = e; bilan.recul = reculMs(tentatives); tentatives += 1; break;
      }
      tentatives = 0;
      remote.uploaded_at = syncNow();
      const updated_at = syncNow();
      // Garde de relecture (N-2, S-10) relue DANS la transaction d'écriture (condition `fusion` de db.mutate, I-G3 ; décision de la tâche 3,
      // épinglée à la ronde 1 par une écriture glissée juste avant celle-ci) : une réception arrivée pendant l'envoi n'est jamais écrasée.
      const ecrireRemote = (relue) => (peutEcrireRemote(row, relue, { h, uid }) ? nettoyerChaines({ ...relue, remote, updated_at }) : null);
      const ecrites = await db.mutate({ conditions: { files: [{ key: row.sha256, fusion: ecrireRemote }] }, origin: 'local' }); // capturée (D-G8)
      const ecrite = ecrites?.files?.[0];
      if (!ecrite) continue; // null : rien d'écrit, rien de confirmé — la passe suivante tranche
      remplacer(snapshot, ecrite);
      bilan.confirmes += 1;
    }
    bilan.restants = candidats.length - i;
    return bilan;
  }

  // Une issue par fichier : { issue: 'recu', ligne } (la ligne ÉCRITE, rendue par la transaction) | 'rien' | 'erreur' (file_error posée) |
  // { issue: 'arret', erreur } (passagère : auth, quota, reseau, inconnu — rien de marqué).
  const RIEN = Object.freeze({ issue: 'rien' });
  const ERREUR = Object.freeze({ issue: 'erreur' });
  async function telechargerUn(sha256, uid) {
    const ligne = await db.get('files', sha256);
    if (!ligne || ligne.blob instanceof Blob) return RIEN;
    if (await db.get('sync_state', PREFIXE_ERREUR + sha256)) return RIEN; // « Réessayer » retire la clé d'abord
    if (!remoteValide(ligne.remote)) { await poserErreur(sha256, 'forme', 'reception'); return ERREUR; }
    if (ligne.remote.owner !== uid) return RIEN; // ses octets ne sont pas dans ce dossier (B-4) : aucun appel, aucune erreur
    const r = await stockage.recevoir(`${uid}/${ligne.remote.sha256}`);
    if (r.erreur) {
      if (introuvable(r.erreur) || r.erreur.type === 'refus') { await poserErreur(sha256, 'introuvable', 'reception'); return ERREUR; }
      logError('sync.fichiers.reception', { reason: r.erreur.type, status: r.erreur.status });
      return { issue: 'arret', erreur: r.erreur };
    }
    // I-G7 : ce qui s'écrit est vérifié contre remote — taille, empreinte, type de la liste blanche (défense en profondeur : remoteValide l'a déjà lu).
    if (r.blob.size !== ligne.remote.size) { await poserErreur(sha256, 'taille', 'reception'); return ERREUR; }
    if (await hacher(r.blob) !== ligne.remote.sha256) { await poserErreur(sha256, 'empreinte', 'reception'); return ERREUR; }
    if (!isAllowed(ligne.remote.mime)) { await poserErreur(sha256, 'type', 'reception'); return ERREUR; }
    // Même garde, relue DANS la transaction (condition `fusion`) : rien si un blob est arrivé ou si la ligne a bougé pendant la descente.
    const blob = new Blob([r.blob], { type: ligne.remote.mime });
    const ecrireOctets = (relue) => (peutEcrireOctets(ligne, relue) ? fusionnerOctetsRecus(relue, blob) : null);
    const ecrite = (await db.mutate({ conditions: { files: [{ key: sha256, fusion: ecrireOctets }] }, origin: 'remote' }))?.files?.[0];
    return ecrite ? { issue: 'recu', ligne: ecrite } : RIEN;
  }

  // `ecrites` (interne, telechargerTout) reçoit les lignes écrites : jamais relues dans une autre transaction.
  async function telecharger(shas, { stop = () => false } = {}, ecrites = null) {
    const bilan = { recus: 0, erreurs: 0, erreur: null };
    const uid = getUserId();
    if (!uid) return { ...bilan, rien: true };
    for (const sha256 of shas) {
      if (stop()) break;
      if (enVol.has(sha256)) continue;
      enVol.add(sha256);
      try {
        const r = await telechargerUn(sha256, uid);
        if (r.issue === 'recu') { bilan.recus += 1; ecrites?.push(r.ligne); }
        else if (r.issue === 'erreur') bilan.erreurs += 1;
        else if (r.issue === 'arret') { bilan.erreur = r.erreur; break; }
      } finally { enVol.delete(sha256); }
    }
    return bilan;
  }

  async function telechargerTout({ stop = () => false, surProgression = () => {}, snapshot } = {}) {
    const uid = getUserId();
    if (!uid) return { recus: 0, restants: 0, erreur: null, rien: true };
    const erreurs = await lireErreursFichiers(db);
    const refs = referencesFichiers(snapshot);
    const candidats = (snapshot?.files || [])
      .filter((row) => row && refs.has(row.sha256) && !(row.blob instanceof Blob) && remoteDeCeCompte(row.remote, uid) && !erreurs.has(row.sha256))
      .sort(parDate);
    const bilan = { recus: 0, restants: 0, erreur: null };
    const debut = maintenant();
    let i = 0;
    let manquent = 0; // tentées sans issue : en vol pour une tape, arrêt, garde N-2 — elles manquent ENCORE (ronde 1)
    for (; i < candidats.length; i += 1) {
      if (!dansLaBorne(i, debut, stop)) break;
      surProgression({ sens: 'reception', n: i + 1, total: candidats.length });
      const ecrites = [];
      const r = await telecharger([candidats[i].sha256], { stop }, ecrites);
      for (const ligne of ecrites) remplacer(snapshot, ligne); // le snapshot de la passe reste juste pour compterFichiers (S-12)
      bilan.recus += r.recus;
      if (r.erreur) { bilan.erreur = r.erreur; break; }
      if (!r.recus && !r.erreurs) manquent += 1;
    }
    // « Télécharger toutes les pages » ne s'éteint que quand plus rien ne manque : ni candidate non tentée, ni candidate tentée sans issue.
    bilan.restants = candidats.length - i + manquent;
    if (!bilan.restants && !bilan.erreur) await db.mutate({ deletes: { sync_state: ['telecharger_tout'] }, origin: 'device' });
    return bilan;
  }

  // L'espace du dossier de CE compte (D-G6, R-G-5) : une mesure, jamais un plafond ; ESPACE.pages pages de ESPACE.parPage au plus (tronque).
  async function mesurerEspace() {
    const uid = getUserId();
    if (!uid) return { erreur: erreurNommee('auth', 'sans compte') };
    let offset = 0; let octets = 0; let objets = 0; let tronque = true;
    for (let page = 0; page < ESPACE.pages; page += 1) {
      const r = await stockage.lister(uid, { limit: ESPACE.parPage, offset });
      if (r.erreur) return { erreur: r.erreur };
      objets += r.objets.length;
      for (const o of r.objets) octets += Number(o?.metadata?.size) || 0;
      if (r.objets.length < ESPACE.parPage) { tronque = false; break; }
      offset += ESPACE.parPage;
    }
    return { octets, objets, at: syncNow(), tronque };
  }

  // `telecharger` est exposé sans son troisième paramètre (interne).
  return { envoyer, telecharger: (shas, opts) => telecharger(shas, opts), telechargerTout, mesurerEspace };
}
// § 4.9 : 20 pages de 1 000 objets au plus (les littéraux de la spec ; hors LIMITES_FICHIERS, dont la forme est celle de § 4.7).
const ESPACE = Object.freeze({ pages: 20, parPage: 1000 });
