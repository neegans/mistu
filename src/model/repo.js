// Accès aux données : base unique, amorçage des références, réglages et journal d'activité.
import { Database, TransitionRefusee } from '../core/db.js';
import { DB_NAME, DB_VERSION, STORES, SYNC_STORES, SECRET_SETTING_KEYS, STATUTS_IMPORT, IMPORTS_TERMINES } from './schema.js';
import { UNIT_DEFINITIONS, UNIT_CONVENTIONS, INGREDIENTS } from './seed.js';
import { newId, nowIso } from '../core/ids.js';
import { emit } from '../core/bus.js';
import { syncNow } from '../sync/clock.js';
import { nettoyerChaines, porteDesCaracteresDeControle } from '../sync/lots.js';
import { resolveMime } from '../sync/mime.js';
import { normaliserConfigAssistant, LIGNE_ASSISTANT } from '../domain/assistant-config.js';
import { assertVocabulaire } from '../domain/vocabulaire.js';
import { sha256Hex } from '../core/hash.js';
import { t } from '../core/i18n.js';

// Base de l'application. Liaison vivante : bindDatabase ne sert qu'aux tests, pour travailler sur une base jetable.
export let db = new Database(DB_NAME, DB_VERSION, STORES);
export function bindDatabase(database) { db = database; }

// --- Identité de l'appareil (spec § 5.1, § 4.2) ----------------------------
// Une seule identité, gardée dans sync_state : elle survit au vidage (clearDevice), jamais capturée, jamais envoyée.
// Migration unique : l'identité d'avant le lot vivait dans localStorage. Elle est reprise si la base n'en a pas,
// et la clé est retirée dans tous les cas — plus aucune identité ne vit hors de la base (src/ui/import.js lit
// maintenant deviceId()). C'est le seul endroit du code qui nomme encore l'ancienne clé.
const LEGACY_DEVICE_KEY = 'cuisineos.device';
let deviceIdValue = null;

// Lit et retire l'ancienne clé d'un seul geste : rien ne doit rester à lire une seconde fois.
function takeLegacyDevice() {
  try {
    const value = localStorage.getItem(LEGACY_DEVICE_KEY);
    if (value !== null) localStorage.removeItem(LEGACY_DEVICE_KEY);
    return value || null;
  } catch { return null; } // stockage indisponible : aucune migration à faire
}

async function ensureDeviceId() {
  const row = await db.get('sync_state', 'device_id');
  let value = row?.value || null;
  const ancienne = takeLegacyDevice();
  if (!value) {
    value = ancienne || newId('dev'); // reprise de l'identité d'avant le lot, sinon une neuve
    await db.mutate({ puts: { sync_state: [{ key: 'device_id', value }] }, origin: 'device' });
  }
  deviceIdValue = value;
  return value;
}

// Synchrone : utilisable au moment de créer une fiche. Vaut null avant init().
export function deviceId() { return deviceIdValue; }

export async function init() {
  await db.open();
  await ensureDeviceId();
  // Références : ajoutées seulement si absentes (jamais écrasées, pour préserver les corrections de l'utilisateur).
  const [units, conventions, ingredients] = await Promise.all([
    db.getAll('unit_definitions'), db.getAll('unit_conventions'), db.getAll('ingredients'),
  ]);
  const have = (rows) => new Set(rows.map((r) => r.id));
  const batch = {
    unit_definitions: UNIT_DEFINITIONS.filter((u) => !have(units).has(u.id)),
    unit_conventions: UNIT_CONVENTIONS.filter((c) => !have(conventions).has(c.id)),
    ingredients: INGREDIENTS.filter((i) => !have(ingredients).has(i.id)),
  };
  // Horodatées à l'insertion (R26) : ces trois magasins sont dans SYNC_STORES, et sync_push rejette une fiche sans
  // updated_at — les 96 références seraient parties en quarantaine au premier envoi initial (spec § 5.2, § 5.3).
  // Seuls les magasins qui ont réellement quelque chose à écrire sont touchés : rien à faire au démarrage ordinaire.
  // Origine 'device' : comme la passe d'horodatage, l'amorçage n'est pas une écriture de la personne et n'a rien à
  // envoyer. La capture est posée AVANT init() depuis le lot Passerelle (la passe d'effacement de la clé locale écrit en 'local'), donc
  // l'origine 'device' compte ici : un rappel d'init() sur une base amputée d'une référence (restauration partielle, référence
  // corrigée puis supprimée) mettrait sinon jusqu'à 96 fiches en file.
  const aPoser = Object.fromEntries(Object.entries(batch).filter(([, rows]) => rows.length));
  if (Object.keys(aPoser).length) await saveBatch(aPoser, { origin: 'device' });
  await horodaterAnciennesFiches();
  await nettoyerAnciennesFiches();
  await migrerConfigAssistant();
  await effacerCleLocale();
  await purgerFilesEnFile();
  await marquerInterrompus();
  await purgerImportsAnciens();
}

// --- Journal des imports au démarrage (spec import-cible § 3.1, Review Focus 3 ; tâche 6) ----------------------------------------------------
// Passe `interrompu` : une ligne en_cours DE CET APPAREIL (le battement, d'origine device, n'est visible nulle part ailleurs) dont le battement a
// plus de 90 s n'a plus de vol vivant (l'app a été fermée en route, ou deux écritures ont échoué) : en_cours → echec(interrompu), vol libéré
// (I-4 : « L'appel a peut-être été compté… »). Le battement est RELU DANS LA TRANSACTION (patch qui refuse) : un autre onglet qui l'a rafraîchi
// entre la lecture et l'écriture garde son vol (deux onglets, Review Focus 3). Un battement illisible ne prouve aucun vol vivant : il compte comme
// vieux. Origine 'local' (une transition du journal part en file, comme les autres). Rejouable : une ligne passée echec n'est plus en_cours.
export const BATTEMENT_MORT_MS = 90 * 1000;
const battementFrais = (iso, maintenant) => { const quand = Date.parse(typeof iso === 'string' ? iso : ''); return Number.isFinite(quand) && maintenant - quand <= BATTEMENT_MORT_MS; };
async function marquerInterrompus(maintenant = Date.now()) {
  const moi = deviceId();
  if (!moi) return 0;
  let n = 0;
  for (const ligne of await db.byIndex('imports', 'status', 'en_cours')) {
    if (!ligne || ligne.device_id !== moi || battementFrais(ligne.battement_at, maintenant)) continue;
    const patch = (c) => {
      if (c.device_id !== moi || battementFrais(c.battement_at, maintenant)) throw new TransitionRefusee('imports', ligne.id, c.status); // relu dans la transaction
      return { status: 'echec', erreur: { raison: 'interrompu', extra: {} }, document_id_vol: null };
    };
    try { await transitionner('imports', ligne.id, { attendus: ['en_cours'], patch }); n += 1; }
    catch (e) { if (!(e instanceof TransitionRefusee)) throw e; }
  }
  return n;
}

// Purge à 30 jours : les lignes enregistre et ignore dont la dernière écriture a plus de 30 jours sont SUPPRIMÉES par une suppression d'origine
// 'local' (tombale synchronisée, R57 : elles disparaissent aussi du serveur et des autres appareils ; « À envoyer » monte d'autant ce jour-là,
// assumé, m1). Conditionnée (I-10) : une ligne qui ne serait plus terminée annule la purge entière, retentée au démarrage suivant. Un echec n'est
// jamais purgé (il attend un geste) ; une date illisible ne l'est pas non plus (rien d'inventé). provenance.import_id est un pointeur souple : les
// versions qui nomment une ligne purgée restent intactes.
export const RETENTION_IMPORTS_MS = 30 * 24 * 3600 * 1000;
async function purgerImportsAnciens(maintenant = Date.now()) {
  const vieilles = [];
  for (const statut of IMPORTS_TERMINES) for (const ligne of await db.byIndex('imports', 'status', statut)) {
    const quand = Date.parse(typeof ligne?.updated_at === 'string' ? ligne.updated_at : '');
    if (Number.isFinite(quand) && maintenant - quand > RETENTION_IMPORTS_MS) vieilles.push(ligne);
  }
  if (!vieilles.length) return 0;
  const copies = Object.create(null); // une clé homonyme d'une propriété native reste une clé (comme removeMany)
  for (const ligne of vieilles) copies[ligne.id] = ligne;
  try {
    await db.mutate({ deletes: { imports: vieilles.map((l) => l.id) }, payloads: { imports: copies }, origin: 'local', conditions: { imports: vieilles.map((l) => ({ key: l.id, attendus: [...IMPORTS_TERMINES] })) } });
  } catch (e) { if (e instanceof TransitionRefusee) return 0; throw e; }
  emit('change', { store: 'imports' });
  return vieilles.length;
}

// Passe unique (spec assistant-par-le-compte § 5.6, S1/F3/F4) : l'ancien réglage settings.llm devient la ligne
// assistant_config, UNE transaction d'origine 'device'. L'horodatage est celui de l'ancienne ligne (repli 1970) —
// JAMAIS « maintenant » : une vieille clé restée sur une autre origine battrait une clé tournée depuis. Rien n'entre
// en file ici (origine 'device', jamais capturée, même si la capture précède init()) : l'envoi initial enverra la ligne au premier passage
// avec un compte.
// Placée après le nettoyage des chaînes : la ligne copiée est déjà normalisée (Cc/Cf retirés), rien à y nettoyer.
const MIGRATION_ASSISTANT_GUARD = 'assistant_config_migre';
const EPOQUE = '1970-01-01T00:00:00.000Z';
export async function migrerConfigAssistant() {
  if ((await db.get('sync_state', MIGRATION_ASSISTANT_GUARD))?.value === 1) return false;
  const ancien = await db.get('settings', LIGNE_ASSISTANT);
  const existante = await db.get('assistant_config', LIGNE_ASSISTANT);
  const cfg = normaliserConfigAssistant(ancien?.value);
  const copier = !existante && cfg.provider !== 'none' && cfg.api_key !== '';
  const puts = { sync_state: [{ key: MIGRATION_ASSISTANT_GUARD, value: 1 }] };
  if (copier) {
    const quand = typeof ancien.updated_at === 'string' && Number.isFinite(Date.parse(ancien.updated_at)) ? ancien.updated_at : EPOQUE;
    puts.assistant_config = [{ id: LIGNE_ASSISTANT, ...cfg, created_at: quand, updated_at: quand }];
  }
  // La garde, la copie et l'effacement de settings.llm partent dans la MÊME transaction : une passe à moitié faite
  // serait rejouée en entier, et la clé ne vit jamais à deux endroits après la passe.
  await db.mutate({ puts, deletes: ancien ? { settings: [LIGNE_ASSISTANT] } : {}, origin: 'device' });
  return copier;
}

// Passe d'effacement de la clé locale (Passerelle T4, R-T4-3) : l'assistant passe par la passerelle (la clé vit côté serveur), donc une clé
// restée dans assistant_config ne sert plus à rien — et ne doit plus traîner dans IndexedDB. La ligne `llm` qui porte une clé OU un fournisseur
// devient la configuration vide. L'écriture est d'origine 'local', comme une décision de la personne : capturée dans l'outbox (sur un hôte de
// production seulement, K-3), la ligne vide PART au compte et efface la clé du serveur et des autres appareils. Cela suppose que la capture
// soit posée AVANT init() — app.js la pose en premier, c'est pourquoi installCapture précède repo.init() au démarrage.
// F-9 : la passe tourne à CHAQUE init(), sans garde à usage unique. Une garde « une fois » laissait passer une clé arrivée APRÈS le premier
// démarrage (un appareil resté en ancienne version qui réécrit sa clé et la renvoie au compte ; une réception tardive) : elle traînait pour
// toujours. L'idempotence tient à la ligne elle-même : une fois vide, le démarrage suivant ne trouve rien à effacer et N'ÉCRIT RIEN (ni garde,
// ni horodatage neuf, ni entrée de file) ; sans ligne, rien non plus.
// La ligne est lue BRUTE : une ligne reçue abîmée (fournisseur inconnu, clé gardée) se normaliserait en « vide » à la lecture, sa clé
// resterait pourtant stockée. Est effacée toute ligne qui porte une clé OU un fournisseur — un champ ABSENT vaut vide (une ligne incomplète
// sans clé ni fournisseur n'est pas réécrite à chaque démarrage). Rejouable : une passe à moitié faite ne trouve plus rien à effacer. Après la
// migration `assistant_config_migre` : la clé d'un ancien settings.llm copiée par elle est effacée dans la foulée.
export async function effacerCleLocale() {
  const ligne = await db.get('assistant_config', LIGNE_ASSISTANT);
  const porteUneCle = ligne?.api_key != null && ligne.api_key !== '';
  const porteUnFournisseur = ligne?.provider != null && ligne.provider !== 'none';
  const efface = !!ligne && (porteUneCle || porteUnFournisseur);
  if (efface) await saveAssistantConfig({ provider: 'none', model: '', base_url: '', api_key: '' });
  return efface;
}

// Passe unique (R-L3-27) : les fiches écrites AVANT cette vague portent peut-être des caractères de contrôle —
// R61 ne nettoie que ce qui s'écrit depuis (`save`, `saveBatch`, `applyArchive`). Laissées telles quelles, elles
// font un conflit à instants égaux au premier écho (le serveur reçoit ce que `lots.js` nettoie), et le conflit
// revient à chaque passe. Elles sont donc nettoyées une fois, à la montée.
// Trois précautions : une fiche n'est RÉÉCRITE que si le nettoyage la change (une bibliothèque saine n'écrit rien) ;
// son `updated_at` est CONSERVÉ — ce n'est pas une modification de la personne, et une heure neuve la ferait gagner
// contre le serveur alors que personne n'a rien demandé ; et l'origine est 'device', donc rien n'entre en file (la
// fiche repartira à sa prochaine écriture, ou par son écho). Les `Blob` ne sont jamais parcourus.
const NETTOYAGE_GUARD = 'nettoyage_chaines';
async function nettoyerAnciennesFiches() {
  const fait = await db.get('sync_state', NETTOYAGE_GUARD);
  if (fait?.value === 1) return 0;
  const puts = {};
  let n = 0;
  for (const store of SYNC_STORES) {
    const sales = (await db.getAll(store)).filter((r) => r && porteDesCaracteresDeControle(r));
    if (!sales.length) continue;
    puts[store] = sales.map((r) => nettoyerChaines(r));
    n += sales.length;
  }
  // La garde part dans la MÊME transaction que le nettoyage : une passe à moitié faite serait rejouée en entier.
  puts.sync_state = [{ key: NETTOYAGE_GUARD, value: 1 }];
  await db.mutate({ puts, origin: 'device' });
  return n;
}

// Migration unique (R-L3-22) : L2 capturait les lignes « files », et rien ne peut les envoyer avant L4 (leurs
// octets sont L4, R55). Les entrées déjà en file sur un appareil qui a tourné sous L2 y resteraient donc pour
// toujours, et « À envoyer : N » ne redescendrait jamais à zéro — exactement le compteur que le parcours § 7.3
// demande de regarder. Elles sont retirées UNE fois, à la montée ; les fichiers eux-mêmes ne sont pas touchés.
// Origine 'device' : ce n'est pas un geste de la personne, et un retrait de file ne part jamais au serveur.
const PURGE_FILES_GUARD = 'purge_files_outbox';
async function purgerFilesEnFile() {
  const fait = await db.get('sync_state', PURGE_FILES_GUARD);
  if (fait?.value === 1) return 0;
  const seqs = (await db.getAll('outbox')).filter((e) => e?.store === 'files').map((e) => e.seq);
  // La garde part dans la MÊME transaction que le retrait : une purge à moitié faite serait rejouée en entier.
  await db.mutate({
    deletes: seqs.length ? { outbox: seqs } : {},
    puts: { sync_state: [{ key: PURGE_FILES_GUARD, value: 1 }] },
    origin: 'device',
  });
  return seqs.length;
}

// Rattrapage unique (R26) : les fiches écrites AVANT ce lot n'ont pas d'updated_at ; sans lui, chacune serait
// rejetée par sync_push et mise en quarantaine immédiate (spec § 5.3). Elles sont horodatées une fois, à la montée.
// Origine 'device' : la capture ne retient que 'local' (src/sync/outbox.js) — un rattrapage n'est pas une écriture
// de la personne et n'a rien à envoyer. La garde évite de relire les 25 magasins à chaque démarrage.
const STAMP_GUARD = 'stamp_updated_at';
async function horodaterAnciennesFiches() {
  const fait = await db.get('sync_state', STAMP_GUARD);
  if (fait?.value === DB_VERSION) return 0;
  const now = syncNow();
  const puts = {};
  let n = 0;
  for (const store of SYNC_STORES) {
    const rows = (await db.getAll(store)).filter((r) => r && !r.updated_at);
    if (!rows.length) continue;
    puts[store] = rows.map((r) => ({ ...r, updated_at: now }));
    n += rows.length;
  }
  // La garde part dans la MÊME transaction que l'horodatage : une passe à moitié faite serait rejouée en entier.
  puts.sync_state = [{ key: STAMP_GUARD, value: DB_VERSION }];
  await db.mutate({ puts, origin: 'device' });
  return n;
}

// --- Réglages -------------------------------------------------------------
const DEFAULT_SETTINGS = {
  ui_locale: 'fr',            // langue de l'interface
  reading_locale: 'original', // langue de lecture : original | fr | en
  units: 'original',          // unités souhaitées : original | metric | us
  rediscover_enabled: true,
  sync_activity: false,       // historique de consultation envoyé au serveur : jamais sans ce geste (spec § 4.2)
  last_backup: null,          // { at, counts, files, bytes }
  device_name: '',
  // `llm` n'est plus un réglage (K-1) : la configuration de l'assistant vit dans assistant_config, composée par getSettings.
};

const estSecret = (key) => SECRET_SETTING_KEYS.includes(key);

export async function getSetting(key) {
  if (estSecret(key)) throw new Error(`Réglage secret « ${key} » : lire getSettings().llm (K-1)`);
  const row = await db.get('settings', key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

export async function getSettings() {
  const rows = await db.getAll('settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (!estSecret(r.key)) out[r.key] = r.value; // une ligne settings.llm résiduelle est ignorée
  // K-1 / K-11 : la configuration de l'assistant vit dans assistant_config, composée ici sous `llm`. Plus aucun écran ne la lit depuis la
  // passerelle (Passerelle T4 : providerFrom ignore les réglages) ; elle reste, avec le magasin, jusqu'au lot qui le retirera (dette nommée).
  out.llm = normaliserConfigAssistant(await db.get('assistant_config', LIGNE_ASSISTANT));
  return out;
}

export async function setSetting(key, value) {
  if (estSecret(key)) throw new Error(`Réglage secret « ${key} » : passer par saveAssistantConfig (K-1)`);
  await db.put('settings', { key, value, updated_at: nowIso() });
  emit('settings', { key, value });
}

// K-6 / § 5.2 : normalisée, horodatée par syncNow (save), capturée si l'origine et l'hôte le permettent (outbox.js),
// `change` émis par save ; `settings` sans la valeur (K-2 : aucun événement ne porte la clé).
export async function saveAssistantConfig(brut) {
  const cfg = normaliserConfigAssistant(brut);
  const ligne = await save('assistant_config', { id: LIGNE_ASSISTANT, ...cfg });
  emit('settings', { key: LIGNE_ASSISTANT });
  return ligne;
}

// --- Aides génériques ------------------------------------------------------
// Les fiches synchronisées sont horodatées par l'horloge corrigée (spec § 5.3), jamais par l'heure brute de l'appareil.
export function stamp(record) {
  const now = syncNow();
  return { created_at: now, updated_at: now, ...record };
}

// R-L3-25 : les caractères de contrôle (fréquents dans du texte collé d'un PDF ou d'une sortie d'OCR) sont retirés
// À L'ÉCRITURE, pour les magasins qui vont au serveur. Nettoyés seulement dans la copie envoyée (`lots.js`), ils
// faisaient un conflit PERPÉTUEL : au prochain écho les instants sont égaux, `identiques` voit deux contenus
// différents → conflit ; « Garder celle d'ici » renvoyait la version sale, que le serveur renettoyait, et le
// conflit revenait à chaque passe — seule « Garder celle d'ailleurs » en sortait. Nettoyer ici rend la fiche locale
// et la copie du serveur identiques octet pour octet, et il n'y a plus rien à trancher. Un `Blob` traverse intact
// (`nettoyerChaines` ne le parcourt jamais : ses octets ne sont pas du texte), et les magasins hors `SYNC_STORES`
// ne sont pas touchés — rien n'en part, donc rien n'y fait conflit.
const propre = (store, record) => (SYNC_STORES.includes(store) ? nettoyerChaines(record) : record);

export async function save(store, record) {
  const r = { ...propre(store, record), updated_at: syncNow() };
  if (!r.created_at) r.created_at = r.updated_at;
  await db.put(store, r);
  emit('change', { store, id: r.id ?? r.key ?? r.edition_id ?? r.sha256 });
  return r;
}

// Fiches prêtes à écrire : nettoyées (R-L3-25, comme save() — même raison, et un seul endroit qui en décide : `propre`), created_at
// conservé ou posé, updated_at = `now`. Les deux chemins d'écriture en lot (saveBatch, transitionner) passent ici.
const horodater = (store, rows, now) => rows.map((r) => ({ ...propre(store, r), created_at: r.created_at || now, updated_at: now }));

// `origin` : 'local' par défaut (écriture de la personne, donc capturée) ; 'device' pour ce qui ne part jamais au
// serveur (amorçage des références, rattrapages) — c'est la capture qui tranche, d'après l'origine (src/sync/outbox.js).
// `conditions` (spec import-cible § 3.6) : le lot n'est écrit que si chaque fiche conditionnée porte un statut attendu, dans la même
// transaction ; condition fausse → TransitionRefusee, rien d'écrit. VÉRIFICATION SEULE : la fiche conditionnée n'est ni réécrite ni
// recapturée (à la différence de transitionner, qui la réécrit avec un updated_at neuf) ; un `patch` ici contournerait `propre` et
// l'horodatage, il est refusé : passer par repo.transitionner.
export async function saveBatch(batch, { origin = 'local', conditions = null } = {}) {
  const now = syncNow();
  const stamped = {};
  for (const [store, rows] of Object.entries(batch)) stamped[store] = horodater(store, rows, now);
  if (conditions) {
    for (const [store, items] of Object.entries(conditions)) for (const c of (Array.isArray(items) ? items : [])) if (c?.patch != null) throw new TypeError('saveBatch ne porte pas de patch (' + store + ') : passer par repo.transitionner');
    await db.mutate({ puts: stamped, origin, conditions });
  } else await db.putBatch(stamped, { origin });
  for (const store of Object.keys(stamped)) emit('change', { store });
  return stamped;
}

// Transition conditionnée (spec import-cible § 3.6, I-10) : la fiche `key` de `store` est lue, son statut vérifié parmi `attendus`,
// le patch (objet, ou fonction du courant) fusionné, puis TOUT — la fiche, les puts, les deletes et la capture — est écrit dans UNE
// transaction par db.mutate({ conditions }). Condition fausse : TransitionRefusee { store, key, statut }, rien d'écrit. Enveloppe de
// repo : nettoyage des chaînes (R61 : un `resultat` ou une `reponse_brute` du modèle porte des caractères de contrôle), `updated_at =
// syncNow()` sur chaque fiche écrite (created_at conservé), puis un `change` pour la fiche conditionnée et un par autre magasin touché
// (puts, deletes), comme saveBatch. `payloads` ({ [store]: { [key]: copie } }) accompagne `deletes` : la capture a besoin de la copie
// d'une fiche supprimée (spec § 5.1), et c'est l'appelant qui l'a lue. Rend la fiche ÉCRITE (fusionnée, nettoyée, horodatée) : l'écran
// n'a pas à relire la base dans une seconde transaction. Tous les écrans passent par elle, jamais par db.mutate (test statique :
// « transitionner( » n'existe que sous la forme repo.transitionner( hors de ce fichier).
export async function transitionner(store, key, { attendus, patch = null, puts = {}, deletes = {}, payloads = {}, origin = 'local' } = {}) {
  const now = syncNow();
  const stamped = {};
  for (const [s, rows] of Object.entries(puts)) stamped[s] = horodater(s, rows, now);
  const modif = (courant) => ({ ...propre(store, typeof patch === 'function' ? patch(courant) : (patch || {})), updated_at: now });
  const ecrites = await db.mutate({ puts: stamped, deletes, payloads, origin, conditions: { [store]: [{ key, attendus, patch: modif }] } });
  emit('change', { store, id: key });
  for (const s of new Set([...Object.keys(stamped), ...Object.keys(deletes)])) if (s !== store) emit('change', { store: s });
  return ecrites[store][0]; // une seule condition ici : la fiche de store/key
}

// La fiche est relue avant sa suppression : la capture a besoin de sa copie pour l'envoyer (spec § 5.1).
export async function remove(store, key) {
  const existing = await db.get(store, key);
  await db.mutate({ deletes: { [store]: [key] }, payloads: { [store]: { [key]: existing || null } } });
  emit('change', { store, id: key });
}

// Même forme pour un lot : une seule transaction, toutes les copies lues avant.
export async function removeMany(store, keys) {
  if (!keys.length) return;
  const existing = await db.getMany(store, keys);
  const payloads = Object.create(null); // une clé homonyme d'une propriété native reste une clé, pas un héritage
  keys.forEach((key, i) => { payloads[key] = existing[i] || null; });
  await db.mutate({ deletes: { [store]: keys }, payloads: { [store]: payloads } });
  emit('change', { store });
}

// Efface tout ce qui est à cet appareil sauf son identité ; jamais capturé (spec § 5.1).
export async function clearDevice({ signOut } = {}) {
  const device = await db.get('sync_state', 'device_id');
  // mutate vide avant d'écrire : device_id est remis dans la même transaction.
  await db.mutate({ clearStores: Object.keys(STORES), puts: device ? { sync_state: [device] } : {}, origin: 'device' });
  // Les données sont déjà parties : un échec de déconnexion ne doit pas faire croire que l'effacement a échoué
  // (l'appareil se retrouverait connecté sur une base vide, que la garde de compte ne peut plus détecter).
  if (signOut) { try { await signOut(); } catch { /* session laissée ouverte : visible dans Réglages */ } }
  emit('change', { store: '*' });
}

// Retrait d'un consentement (spec § 4.2, R27) : ce qui attendait de partir pour ce magasin est retiré de la file.
// L'outbox est interne et n'est dans aucun SYNC_STORES ; l'origine 'device' n'est de toute façon jamais capturée.
export async function oublierEnvois(store) {
  const seqs = (await db.getAll('outbox')).filter((r) => r?.store === store).map((r) => r.seq);
  if (!seqs.length) return 0;
  await db.mutate({ deletes: { outbox: seqs }, origin: 'device' });
  return seqs.length;
}

// --- Porte d'entrée (spec § 11, R34) -------------------------------------
// Le choix « Continuer sans compte » vit EN BASE, dans sync_state, comme l'identité de l'appareil (R19/R20) :
// localStorage est partagé par toutes les pages de l'origine et ne survit pas au même nettoyage. Origine 'device' :
// la capture ne retient que 'local' — ce choix ne part jamais au serveur et n'entre jamais en file.
// clearDevice() vide sync_state sauf device_id : après « Effacer les données de cet appareil », la porte revient.
// C'est voulu : l'appareil est vierge.
const PORTE_KEY = 'porte_entree';

export async function lirePorteEntree() {
  const row = await db.get('sync_state', PORTE_KEY);
  return row?.value?.choix === 'sans_compte' ? 'sans_compte' : null;
}

export async function choisirSansCompte() {
  await db.mutate({ puts: { sync_state: [{ key: PORTE_KEY, value: { choix: 'sans_compte', at: nowIso() } }] }, origin: 'device' });
  return 'sans_compte';
}

export const all = (store) => db.getAll(store);
export const get = (store, key) => db.get(store, key);
export const byIndex = (store, index, value) => db.byIndex(store, index, value);

export function indexBy(rows, key = 'id') {
  const m = new Map();
  for (const r of rows) m.set(r[key], r);
  return m;
}

export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = typeof key === 'function' ? key(r) : r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

// --- Fichiers (stockage d'objets local, dédupliqué par empreinte) --------
// Une ligne reçue du serveur arrive sans octets : le blob est écrit même si la ligne existe déjà (spec § 5.4).
// Aucun refus local : un type hors liste est gardé, visible, marqué non synchronisable.
export async function putFile(sha256, blob, meta = {}) {
  const existing = await db.get('files', sha256);
  if (existing && existing.blob instanceof Blob) return existing;
  const { origin, ...rest } = meta;
  // Le type connu de la ligne existante compte aussi : une ligne reçue du serveur porte son mime sans octets.
  const { mime, syncable } = resolveMime(blob.type || meta.mime || existing?.mime, meta.original_filename || existing?.original_filename);
  const now = syncNow();
  // Les champs calculés passent après meta : ni le type résolu ni la taille réelle ne se font écraser.
  const row = { ...(existing || {}), ...rest, sha256, blob, mime, syncable, size: blob.size, created_at: existing?.created_at || now, updated_at: now };
  await db.mutate({ puts: { files: [row] }, origin: origin === 'remote' ? 'remote' : 'local' });
  return row;
}

export const getFile = (sha256) => db.get('files', sha256);

// Lecture groupée (une transaction) des lignes files d'une liste d'empreintes ; les absentes ne figurent pas.
// db.getMany rend un tableau ALIGNÉ sur les clés, avec `undefined` pour les absentes : le filter(Boolean) suffit.
export async function getFiles(sha256s) {
  const rows = await db.getMany('files', [...new Set(sha256s.filter(Boolean))]);
  return new Map(rows.filter(Boolean).map((r) => [r.sha256, r]));
}

// --- Pages d'une séance de scan (spec import-cible § 3.6) ------------------------------------------------------
// Comme startScanSession (src/ui/import.js) SANS navigation ni toast : les octets de chaque fichier par putFile d'abord (idempotent, hors
// file : R58), puis les lignes de séance (source_documents, source_pages, scan_sessions) en UN lot. Trois chemins :
// - `import_id` : UN repo.transitionner sur la ligne du journal (attendus a_lancer | a_verifier | echec ; patch-FONCTION : les page_ids neufs
//   s'ajoutent EN FIN de ceux LUS DANS LA TRANSACTION, jamais d'une copie périmée), les lignes de séance dans la même transaction. Un import
//   terminé (enregistre, ignore) ou en vol refuse (TransitionRefusee) et RIEN de la séance n'est écrit. Sans `session_id`, la séance est celle de
//   la ligne (scan_session_id) ; une séance qui n'est pas la sienne refuse (TypeError) : journal et séance ne divergent jamais (ronde 1).
// - `import: { id, kind, recipe_id, edition_id, device_id }` (première photo : la ligne n'existe pas encore, spec § 4.1 — une visite sans photo
//   n'écrit rien) : un saveBatch CONDITIONNÉ (ronde 1, I-10 et I-2) qui écrit la ligne a_lancer (scan_session_id, page_ids) AVEC les lignes de
//   séance, si et seulement si aucune ligne de cet id n'existe (jamais d'écrasement, quel que soit son statut) et qu'aucun import OUVERT ne porte
//   déjà cette recipe_id (un seul import non terminé par recette).
// - ni l'un ni l'autre : le saveBatch existant.
// Vérification RAPIDE d'abord (ronde 1) : la ligne du journal est lue AVANT le premier putFile, et un import terminé, en vol, inconnu, déjà créé ou
// doublé refuse tout de suite — sinon N blobs (jusqu'à 25 Mo chacun) resteraient orphelins dans `files` ; la condition en transaction reste le mur.
// Rend { session, pages, docs, importId } ; startScanSession navigue et notifie, lui. Une image très légère garde son signalement (issues).
export const SMALL_IMAGE_BYTES = 80 * 1024;
// Le signalement d'une image très légère est une DONNÉE stockée dans `issues` (comportement antérieur à l'import ciblé) : UNE définition, lue
// par ajouterPages et par replacePage (src/ui/import.js) ; son entrée en.js existe.
export const issuesPourImage = (octets) => (octets < SMALL_IMAGE_BYTES ? [t('Image très légère : possiblement floue ou trop petite')] : []);
const estPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const estEpub = (file) => file.type === 'application/epub+zip' || /\.epub$/i.test(file.name);
const ATTENDUS_AJOUT = ['a_lancer', 'a_verifier', 'echec']; // les statuts qui acceptent des pages (spec § 3.6)
const IMPORTS_OUVERTS = STATUTS_IMPORT.filter((s) => !IMPORTS_TERMINES.includes(s)); // I-2 : un seul import ouvert par recette
const KINDS_IMPORT = ['recette', 'index'];
// Une ligne du journal NEUVE (a_lancer), dans son vocabulaire fermé (D-12), et la condition de sa création (I-10, I-2) : la clé est libre, et aucun
// import ouvert ne porte déjà cette recipe_id (sans recipe_id — un index, « Regrouper en recette » —, I-2 ne joue pas). Une définition pour les deux
// chemins qui ouvrent une ligne : ajouterPages (première photo de l'écran ciblé) et ouvrirImport (pages déjà là : éditeur, panneau d'index).
function nouvelleLigneImport({ id, kind, recipe_id = null, edition_id = null, scan_session_id = null, page_ids = [], device_id = null }) {
  const ligne = {
    id, kind, edition_id: edition_id ?? null, recipe_id: recipe_id ?? null, scan_session_id: scan_session_id ?? null, page_ids: [...page_ids], photo_sha256: null, status: 'a_lancer', erreur: null,
    resultat: null, reponse_brute: null, appels: 0, model: null, duree_ms: null, device_id: device_id ?? deviceId(), document_id_vol: null, battement_at: null, started_at: null, finished_at: null,
  };
  assertVocabulaire(ligne, 'imports'); // D-12 : la ligne du journal naît dans son vocabulaire fermé
  const conditions = { imports: [{ key: ligne.id, absente: true }, ...(ligne.recipe_id != null ? [{ index: 'recipe_id', valeur: ligne.recipe_id, exclus: IMPORTS_OUVERTS }] : [])] };
  return { ligne, conditions };
}

// Ouvre une ligne du journal sur des pages DÉJÀ présentes (spec import-cible § 4.6, tâche 6) : « Extraire avec l'assistant IA » de l'éditeur (kind
// recette, recipe_id null : « Regrouper en recette ») et « Lire avec l'assistant IA » du panneau d'index (kind index). Aucun octet, aucune séance
// écrite : la ligne seule, a_lancer, par un saveBatch CONDITIONNÉ (même mur que la première photo de l'écran ciblé). Rend la ligne écrite.
export async function ouvrirImport({ id = newId('imp'), kind, recipe_id = null, edition_id = null, scan_session_id = null, page_ids = [] } = {}) {
  if (!KINDS_IMPORT.includes(kind)) throw new TypeError('ouvrirImport : kind d’import inconnu (' + String(kind) + ')');
  if (!Array.isArray(page_ids) || page_ids.some((p) => typeof p !== 'string' || !p)) throw new TypeError('ouvrirImport : page_ids doit être une liste d’identifiants');
  const { ligne, conditions } = nouvelleLigneImport({ id, kind, recipe_id, edition_id, scan_session_id, page_ids });
  const ecrit = await saveBatch({ imports: [ligne] }, { conditions });
  return ecrit.imports[0];
}
export async function ajouterPages(files, { edition_id = null, session_id = null, import_id = null, import: nouvelImport = null } = {}) {
  if (import_id && nouvelImport) throw new TypeError('ajouterPages : import_id et import ne se donnent pas ensemble');
  if (nouvelImport && !KINDS_IMPORT.includes(nouvelImport.kind)) throw new TypeError('ajouterPages : kind d’import inconnu (' + String(nouvelImport.kind) + ')');
  if (import_id) {
    const lue = await db.get('imports', import_id);
    if (!lue || !ATTENDUS_AJOUT.includes(lue.status)) throw new TransitionRefusee('imports', import_id, lue?.status);
    if (session_id && lue.scan_session_id && lue.scan_session_id !== session_id) throw new TypeError('ajouterPages : l’import ' + import_id + ' pointe la séance ' + String(lue.scan_session_id) + ', pas ' + String(session_id));
    session_id = session_id ?? lue.scan_session_id ?? null;
  }
  if (nouvelImport) {
    const deja = await db.get('imports', nouvelImport.id);
    if (deja) throw new TransitionRefusee('imports', nouvelImport.id, deja.status);
    const ouvert = nouvelImport.recipe_id != null ? (await db.byIndex('imports', 'recipe_id', nouvelImport.recipe_id)).find((i) => IMPORTS_OUVERTS.includes(i?.status)) : null;
    if (ouvert) throw new TransitionRefusee('imports', 'recipe_id=' + String(nouvelImport.recipe_id), ouvert.status);
  }
  const existante = session_id ? await db.get('scan_sessions', session_id) : null;
  const session = existante
    ? { ...existante, page_ids: [...(existante.page_ids || [])], document_ids: [...(existante.document_ids || [])] }
    : { id: newId('ss'), status: 'open', edition_id, started_at: nowIso(), page_ids: [], document_ids: [], device_id: deviceId() };
  const docs = [], pages = [];
  let position = session.page_ids.length;
  for (const file of files) {
    const sha256 = await sha256Hex(file);
    await putFile(sha256, file, { original_filename: file.name });
    const pdf = estPdf(file), epub = estEpub(file);
    const doc = { id: newId('doc'), edition_id: session.edition_id || edition_id || null, source_type: pdf ? 'pdf' : epub ? 'epub' : 'photo', original_filename: file.name, blob_path: `files/${sha256}`, sha256, size: file.size, mime: file.type, scan_session_id: session.id, captured_at: nowIso() };
    docs.push(doc);
    session.document_ids.push(doc.id);
    if (!pdf && !epub) {
      const page = { id: newId('pg'), document_id: doc.id, edition_id: doc.edition_id, sha256, printed_page: null, file_position: null, locator: null, position: ++position, issues: issuesPourImage(file.size), kind: null };
      pages.push(page);
      session.page_ids.push(page.id);
    }
  }
  session.status = 'open';
  const lignes = { source_documents: docs, source_pages: pages, scan_sessions: [session] };
  const neufs = pages.map((p) => p.id);
  if (import_id) {
    // Le mur (dans la transaction) : la ligne relue porte un statut attendu ET pointe cette séance (ou aucune : elle la reçoit) ; page_ids EN FIN des siens.
    const patch = (c) => {
      if (c.scan_session_id && c.scan_session_id !== session.id) throw new TypeError('ajouterPages : l’import ' + import_id + ' pointe la séance ' + String(c.scan_session_id) + ', pas ' + session.id);
      return { page_ids: [...(c.page_ids || []), ...neufs], scan_session_id: c.scan_session_id ?? session.id };
    };
    await transitionner('imports', import_id, { attendus: ATTENDUS_AJOUT, patch, puts: lignes });
    return { session, pages, docs, importId: import_id };
  }
  if (nouvelImport) {
    // Le mur (dans la transaction, I-10 et I-2) : la ligne n'existe pas, et aucun import ouvert ne porte cette recette (sans recipe_id — un index —, I-2 ne joue pas).
    const { ligne, conditions } = nouvelleLigneImport({ id: nouvelImport.id, kind: nouvelImport.kind, recipe_id: nouvelImport.recipe_id, edition_id: nouvelImport.edition_id ?? session.edition_id, scan_session_id: session.id, page_ids: neufs, device_id: nouvelImport.device_id });
    await saveBatch({ ...lignes, imports: [ligne] }, { conditions });
    return { session, pages, docs, importId: ligne.id };
  }
  await saveBatch(lignes);
  return { session, pages, docs, importId: null };
}

// --- Journal de consultation (spec §32) : seules les ouvertures volontaires comptent ------------
export async function recordActivity(edition_id, event_type, extra = {}) {
  if (!edition_id) return;
  const now = syncNow();
  await db.mutate({ puts: { library_activity: [{ id: newId('act'), edition_id, event_type, occurred_at: now, updated_at: now, ...extra }] } });
  emit('change', { store: 'library_activity' });
}

// --- Chargement groupé d'une recette avec ses versions et sa provenance ---
export async function loadRecipeBundle(recipeId) {
  const recipe = await db.get('recipes', recipeId);
  if (!recipe) return null;
  const [versions, edition, links, history, translations] = await Promise.all([
    db.byIndex('recipe_versions', 'recipe_id', recipeId),
    recipe.edition_id ? db.get('book_editions', recipe.edition_id) : null,
    db.byIndex('dish_recipe_links', 'recipe_id', recipeId),
    db.byIndex('cook_history', 'recipe_id', recipeId),
    db.getAll('recipe_translations'),
  ]);
  const book = edition ? await db.get('books', edition.book_id) : null;
  versions.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const versionIds = new Set(versions.map((v) => v.id));
  const pageIds = new Set(recipe.source_page_ids || []);
  const pages = pageIds.size ? (await db.getMany('source_pages', [...pageIds])).filter(Boolean) : [];
  history.sort((a, b) => (b.cooked_at || '').localeCompare(a.cooked_at || ''));
  return {
    recipe, versions, edition, book, links, history, pages,
    translations: translations.filter((t) => versionIds.has(t.recipe_version_id)),
  };
}

export { newId, nowIso };
