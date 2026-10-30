import {preparerGardesVersionsStructurees} from '../domain/versions-structurees.js';
import {estCleReponseTraduction,validerReponseLocaleTraduction,verifierQuotaReponsesTraduction} from '../domain/traductions-locales-format.js';
import {verifierCommandeTraduction,ErreurTraduction} from '../domain/traductions-format.js';
import {selectionRepriseConfirmee} from '../domain/comparaison-sources.js';
import {canoniqueSources,empreinteSources,projectionSessionSources,projectionIdentitePage,projectionIdentiteDocument,verifierEmpreinteCommandeSources,octetsJsonbSources,LIMITES_SOURCES,validerCaptureSources,validerAppelIndex,ErreurSources} from '../domain/sources-format.js';
import {estCleSources,validerLigneSources,verifierQuotaSources} from '../domain/sources-locaux.js';
// Accès aux données : base unique, amorçage des références, réglages et journal d'activité.
import { Database, TransitionRefusee } from '../core/db.js';
import { DB_NAME, DB_VERSION, STORES, SYNC_STORES, SECRET_SETTING_KEYS, IMPORTS_TERMINES } from './schema.js';
import { UNIT_DEFINITIONS, UNIT_CONVENTIONS, INGREDIENTS } from './seed.js';
import { newId, nowIso } from '../core/ids.js';
import { emit } from '../core/bus.js';
import { syncNow, getClockOffset } from '../sync/clock.js';
import { nettoyerChaines, porteDesCaracteresDeControle, LIMITES as LIMITES_SYNC_EDITEUR } from '../sync/lots.js';
import { resolveMime } from '../sync/mime.js';
import { fusionnerOctetsRecus } from '../sync/fichiers.js';
import { normaliserConfigAssistant, LIGNE_ASSISTANT } from '../domain/assistant-config.js';
import { IMPORTS_OUVERTS, KINDS_PAGES, ligneImportNeuve } from '../domain/import-cible.js'; // une définition (lot A, tâche 6, ronde 1) : I-2 et les sortes que le chemin photo écrit (lot B : « web » exclue, P-1)
import { sha256Hex } from '../core/hash.js';
import { t } from '../core/i18n.js';
import { comparerCuissons } from '../domain/cuisine-personnelle.js';
import { lireCycleRecette, memeCycleRecette, estRecetteAutonome, identifiantCycleValide, dateCycleValide, ErreurCycleRecette } from '../domain/cycle-recette.js';
import { lireCycleEdition, lireEtatRecette, memeCycleEdition, memeExceptionEdition, exceptionEditionValide, MAGASINS_BILAN_LIVRE, calculerBilanLivre } from '../domain/cycle-edition.js';
import { preparerLotSources } from '../sync/lot-sources.js';
import { estCleEditeur, validerLigneEditeur, verifierQuotaEditeur, estRecuEditeur, LIMITES_BROUILLONS, ErreurBrouillon } from '../domain/brouillons-format.js';

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
  await convertirRemoteBooleen();
  await marquerInterrompus();
  await purgerImportsAnciens();
}

// --- Journal des imports au démarrage (spec import-cible § 3.1, Review Focus 3 ; tâche 6) ----------------------------------------------------
// Passe `interrompu` : une ligne en_cours DE CET APPAREIL (le battement, interne et d'origine device, n'est visible nulle part ailleurs) dont le
// battement — la ligne interne `battement:<id>` de sync_state, ou à défaut `battement_at` posé au départ du vol — a plus de 90 s n'a plus de vol
// vivant (l'app a été fermée en route, ou deux écritures ont échoué) : en_cours → echec(interrompu), vol libéré (I-4 : « L'appel a peut-être été
// compté… »). Le battement est RELU DANS LA TRANSACTION (conditions qui refusent) : un autre onglet qui l'a rafraîchi entre la lecture et l'écriture
// garde son vol (deux onglets, Review Focus 3). Un battement illisible ne prouve aucun vol vivant : il compte comme vieux. Origine 'local' (une
// transition du journal part en file, comme les autres). Rejouable : une ligne passée echec n'est plus en_cours.
// Ronde 1 de la tâche 6 : une ligne en_cours d'un AUTRE appareil (ou d'un appareil perdu, d'une PWA réinstallée, d'une archive restaurée ailleurs)
// n'avait aucune issue : son battement n'est jamais vu ici. Au-delà de VOL_MORT_MS depuis le départ du vol tel qu'il a été synchronisé
// (battement_at posé au départ, ou started_at), bien au-delà du délai client de 135 s, aucun vol ne vit plus nulle part : elle est interrompue
// sur n'importe quel appareil (une réponse tardive n'écrit que reponse_brute, § 3.1). Exportée : la section « Imports » la rejoue à l'affichage
// (un rechargement dans les 90 s ne laisse plus la ligne bloquée jusqu'au démarrage suivant).
export const BATTEMENT_MORT_MS = 90 * 1000;
export const VOL_MORT_MS = 10 * 60 * 1000;
// Vague finale (horloges) : un horodatage trop loin dans le FUTUR (au-delà de VOL_MORT_MS : horloge avancée, ligne hostile datée de 9999) ne prouve
// aucun vol vivant — sinon la ligne restait « vivante » pour toujours, sans geste. En deçà, une horloge un peu reculée garde son vol (décision 6).
const recent = (iso, maintenant, borne) => { const quand = Date.parse(typeof iso === 'string' ? iso : ''); return Number.isFinite(quand) && maintenant - quand <= borne && quand - maintenant <= VOL_MORT_MS; };
// Le battement de CET appareil (`hb`, ligne interne de sync_state) ou celui posé au départ sur la ligne ; une ligne d'un AUTRE appareil se juge sur ses
// horodatages synchronisés, comparés à l'heure corrigée par le décalage serveur (getClockOffset : un Mac en avance n'interrompt pas un vol vivant ailleurs).
const volVivant = (l, hb, moi, maintenant) => recent(hb?.value, maintenant, BATTEMENT_MORT_MS) || (l.device_id === moi
  ? recent(l.battement_at, maintenant, BATTEMENT_MORT_MS)
  : recent(l.battement_at, maintenant + getClockOffset(), VOL_MORT_MS) || recent(l.started_at, maintenant + getClockOffset(), VOL_MORT_MS));
// Vague finale (Important) : le battement n'est PLUS écrit dans la ligne synchronisée. Réécrire `imports` toutes les 15 s posait un updated_at neuf et
// émettait `change` (une passe de synchro complète à chaque battement), et l'écho d'une version plus ancienne revenait en « conflit renvoyé » qui
// remettait le battement en file (contraire à m2). Il vit dans une ligne INTERNE de sync_state (`battement:<id>`, origine device : jamais capturée,
// jamais envoyée, aucun `change`). `status: 'vol'` est la forme qu'une condition de db.mutate sait relire dans une transaction (marquerInterrompus).
const cleBattement = (importId) => 'battement:' + importId;
export async function battre(importId, quand) {
  await db.mutate({ puts: { sync_state: [{ key: cleBattement(importId), status: 'vol', value: quand }] }, origin: 'device' });
}
export async function oublierBattement(importId) {
  await db.mutate({ deletes: { sync_state: [cleBattement(importId)] }, origin: 'device' });
}
// Lot I1 (I-I3) : la progression d'une lecture d'index page par page — chaque page lue est gardée ICI dès sa réponse (ligne INTERNE de sync_state,
// origine device : jamais envoyée, aucun `change`) ; une lecture interrompue (Annuler, app fermée) ne relit que les pages sans résultat.
const cleProgression = (importId) => 'lecture-index:' + importId;
export async function lireProgressionIndex(importId) {
  const row = await db.get('sync_state', cleProgression(importId));
  const v = row?.value;
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
export async function ecrireProgressionIndex(importId, pagesParId) {
  await db.mutate({ puts: { sync_state: [{ key: cleProgression(importId), value: pagesParId }] }, origin: 'device' });
}
export async function oublierProgressionIndex(importId) {
  await db.mutate({ deletes: { sync_state: [cleProgression(importId)] }, origin: 'device' });
}
export async function marquerInterrompus(maintenant = Date.now()) {
  const moi = deviceId();
  if (!moi) return 0;
  if (!Number.isFinite(maintenant)) maintenant = Date.now(); // une horloge illisible ne rend jamais tous les vols « morts »
  let n = 0;
  for (const ligne of await db.byIndex('imports', 'status', 'en_cours')) {
    if (!ligne) continue;
    if (['thermomix', 'reperes'].includes(ligne.kind) && ligne.device_id !== moi) continue;
    const cle = cleBattement(ligne.id);
    const hb = await db.get('sync_state', cle);
    if (volVivant(ligne, hb, moi, maintenant)) continue;
    const patch = (c) => {
      if (['thermomix', 'reperes'].includes(c.kind) && c.device_id !== moi) throw new TransitionRefusee('imports', ligne.id, c.status);
      if (volVivant(c, null, moi, maintenant)) throw new TransitionRefusee('imports', ligne.id, c.status); // relu dans la transaction
      return { status: 'echec', erreur: { raison: 'interrompu', extra: {} }, document_id_vol: null };
    };
    // Le battement est relu DANS la même transaction (deux onglets, Review Focus 3) : un battement rafraîchi entre la lecture et l'écriture garde le vol ;
    // absent à la lecture, il doit l'être encore. Le battement d'un vol interrompu est effacé avec lui.
    const vif = (h) => { if (recent(h?.value, maintenant, BATTEMENT_MORT_MS)) throw new TransitionRefusee('imports', ligne.id, 'en_cours'); return {}; };
    const autres = { sync_state: [hb ? { key: cle, attendus: ['vol'], patch: vif } : { key: cle, absente: true }] };
    try { await transitionner('imports', ligne.id, { attendus: ['en_cours'], patch, autres, deletes: hb ? { sync_state: [cle] } : {} }); n += 1; }
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

// Passe unique (lot G, D-G12) : `remote` change de nature — le booléen `true` de L3 (« ligne reçue sans octets ») est retiré des lignes files.
// Garde dans la même transaction, updated_at conservé, origine 'device' (rien en file). Une bibliothèque saine ne réécrit aucune ligne.
// Ronde 1 (#2) : un client d'avant G (code encore en mémoire pendant la mise à jour) a pu recevoir des lignes files envoyées par un appareil déjà
// en 0.11.0 — `true` posé sans blob, remote effacé avec blob — puis avancer le curseur : `cursor:files` est retiré DANS la même transaction,
// toute la table est relue à la passe suivante (decider adopte alors un remote serveur valide à instant égal). Chaque ligne est réécrite sur
// sa version RELUE dans la transaction (#4 : un blob arrivé entre la lecture et l'écriture reste).
const REMOTE_V2_GUARD = 'files_remote_v2';
export async function convertirRemoteBooleen() {
  if ((await db.get('sync_state', REMOTE_V2_GUARD))?.value === 1) return 0;
  const lignes = (await db.getAll('files')).filter((r) => r?.remote === true);
  const sansBooleen = (courant) => { if (courant?.remote !== true) return null; const { remote: _booleen, ...reste } = courant; return reste; };
  await db.mutate({
    puts: { sync_state: [{ key: REMOTE_V2_GUARD, value: 1 }] },
    deletes: { sync_state: ['cursor:files'] },
    conditions: lignes.length ? { files: lignes.map((l) => ({ key: l.sha256, fusion: sansBooleen })) } : null,
    origin: 'device',
  });
  return lignes.length;
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
  upload_quality: 'reduite', // qualité d'envoi des photos (lot G, D-G3) : par appareil, jamais synchronisée
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

export async function save(store, record, options = {}) {
  const r = { ...propre(store, record), updated_at: syncNow() };
  if (!r.created_at) r.created_at = r.updated_at;
  await saveBatch({ [store]: [r] }, options);
  return r;
}

// Le contexte vient de la fiche affichée au départ du geste, jamais d'une relecture tardive de son cycle.
export async function capturerContexteRecette(recipe, { edition = null, historique = false, creation = false, owner_id, contexteValide = null } = {}) {
  if (!recipe?.id || (contexteValide && !contexteValide())) throw new ErreurCycleRecette('contexte_change', recipe?.id);
  const recipe_id = recipe.id, cycle = lireCycleRecette(recipe), expected_edition_id = recipe.edition_id ?? null;
  if (cycle.etat === 'invalide') throw new ErreurCycleRecette('cycle_invalide', recipe_id);
  const parent = expected_edition_id === null ? null : lireCycleEdition(edition);
  if (!historique && expected_edition_id !== null && (!edition || edition.id !== expected_edition_id || parent.etat === 'invalide')) throw new ErreurCycleRecette('edition_absente', recipe_id);
  const expected_edition_cycle_id = parent?.id ?? null;
  const base = db, owner = (await base.get('sync_state', 'user_id'))?.value ?? null;
  if (base !== db || (owner_id !== undefined && owner_id !== owner) || (contexteValide && !contexteValide())) throw new ErreurCycleRecette('compte_change', recipe_id);
  return { recipe_id, expected_cycle_id: cycle.id, expected_edition_id, expected_edition_cycle_id, owner_id: owner, historique: !!historique, creation: !!creation, ...(contexteValide ? { contexteValide } : {}) };
}

export async function capturerContexteEdition(edition, { historique = false, creation = false, recipe_id = null, owner_id, contexteValide = null } = {}) {
  if (!edition?.id || (contexteValide && !contexteValide())) throw new ErreurCycleRecette('contexte_change');
  const edition_id = edition.id, cycle = lireCycleEdition(edition);
  if (cycle.etat === 'invalide') throw new ErreurCycleRecette('cycle_invalide');
  const base = db, owner = (await base.get('sync_state', 'user_id'))?.value ?? null;
  if (base !== db || (owner_id !== undefined && owner_id !== owner) || (contexteValide && !contexteValide())) throw new ErreurCycleRecette('compte_change');
  return { edition_id, expected_cycle_id: cycle.id, owner_id: owner, historique: !!historique, creation: !!creation, ...(recipe_id ? { recipe_id } : {}), ...(contexteValide ? { contexteValide } : {}) };
}

const contenuRecette = new Set(['recipes', 'recipe_versions', 'recipe_translations', 'substitutions', 'dish_recipe_links']);
const conditionUnique = (conditions, store, key, transformer) => {
  const items = conditions[store] || [], trouve = items.find(c => c.key === key && c.index == null);
  conditions[store] = [...items.filter(c => c !== trouve), transformer(trouve)];
};
function conditionMagasin(conditions, store, verifier) {
  const items = conditions[store] || [], precedente = items.find(c => c.toutes === true);
  conditions[store] = [...items.filter(c => c !== precedente), { toutes: true, verifier: rows => { precedente?.verifier(rows); verifier(rows); } }];
}
function lireCondition(c, courant, store, key, lecture) {
  if (!c) return null;
  if (c.absente === true) { if (courant) throw new TransitionRefusee(store, key, courant.status); return null; }
  if (c.fusion) return c.fusion(courant, lecture);
  if (!courant || !c.attendus?.includes(courant.status)) throw new TransitionRefusee(store, key, courant?.status);
  return c.patch == null ? null : { ...courant, ...(typeof c.patch === 'function' ? c.patch(courant) : c.patch) };
}

// Tous les chemins du dépôt passent cette garde, y compris un lot n'écrivant que des enfants.
// Les lectures préparatoires résolvent les parents ; les associations et cycles sont revalidés dans la transaction finale.
async function protegerMutationRecettes(puts, conditionsInitiales, recettesInitiales, { origin = 'local', deletes = {}, editions: editionsInitiales = [], source_commands = [] } = {}) {
  const conditions = Object.fromEntries(Object.entries(conditionsInitiales || {}).map(([s, xs]) => [s, [...xs]]));
  if (origin !== 'local') return { conditions, recettes: [], editions: [] };
  if (!Array.isArray(recettesInitiales)) throw new TypeError('Les contextes de recette sont un tableau');
  const base = db, owner = (await base.get('sync_state', 'user_id'))?.value ?? null;
  const contextes = new Map(), contextesEditions = new Map(), suppressionsRecettes = new Set();
  for (const c of editionsInitiales) {
    if (!c?.edition_id || !(c.expected_cycle_id === null || identifiantCycleValide(c.expected_cycle_id)) || !Object.hasOwn(c, 'owner_id') || contextesEditions.has(c.edition_id)) throw new ErreurCycleRecette('contexte_invalide');
    contextesEditions.set(c.edition_id, { ...c, records: [] });
  }
  const ajouterEdition = (id, source, records = [], recipeId = null) => {
    if (id == null) return;
    let c = contextesEditions.get(id);
    const cycle = source?.expected_edition_cycle_id ?? source?.expected_cycle_id ?? null;
    if (!c) { c = { edition_id: id, expected_cycle_id: cycle, owner_id: source?.owner_id ?? owner, historique: !!source?.historique, ...(recipeId ? { recipe_id: recipeId } : {}), ...(source?.contexteValide ? { contexteValide: source.contexteValide } : {}), records: [] }; contextesEditions.set(id, c); }
    else if (source && c.expected_cycle_id !== cycle) throw new ErreurCycleRecette('cycle_change', recipeId);
    for (const record of records) if (!c.records.some(x => x.store === record.store && x.id === record.id)) c.records.push(record);
    return c;
  };
  for (const c of recettesInitiales) {
    if (!c || typeof c.recipe_id !== 'string' || !(c.expected_cycle_id === null || identifiantCycleValide(c.expected_cycle_id)) || !Object.hasOwn(c, 'owner_id')) throw new ErreurCycleRecette('contexte_invalide');
    if (contextes.has(c.recipe_id)) throw new ErreurCycleRecette('contexte_duplique', c.recipe_id);
    contextes.set(c.recipe_id, { ...c, records: [] });
  }
  const nouvellesVersions = new Map((puts.recipe_versions || []).map(v => [v.id, v]));
  const parentsVersions = new Map();
  const parentVersion = async id => {
    if (!id) return null;
    if (nouvellesVersions.has(id)) return nouvellesVersions.get(id).recipe_id;
    if (!parentsVersions.has(id)) parentsVersions.set(id, (await base.get('recipe_versions', id))?.recipe_id ?? null);
    return parentsVersions.get(id);
  };
  const ajouter = (id, store, key, row = null) => {
    if (!id) throw new ErreurCycleRecette('source_absente');
    let c = contextes.get(id);
    if (!c) {
      const absence = conditions.recipes?.some(g => g.key === id && g.absente === true);
      c = { recipe_id: id, expected_cycle_id: store === 'recipes' ? (row?.lifecycle_id ?? null) : null, owner_id: owner, historique: false, creation: !!absence, records: [] };
      contextes.set(id, c);
    }
    if (!c.records.some(r => r.store === store && r.id === key)) c.records.push({ store, id: key });
  };
  for (const store of contenuRecette) {
    const rows = new Map((puts[store] || []).map(r => [r[STORES[store].keyPath], r]));
    for (const c of conditions[store] || []) if (c.key != null && !rows.has(c.key)) rows.set(c.key, null);
    for (const key of deletes[store] || []) if (!rows.has(key)) rows.set(key, null);
    for (const [key, entree] of rows) {
      const current = await base.get(store, key), row = entree || current, supprime = (deletes[store] || []).includes(key);
      if (supprime && !row) continue;
      if (store === 'recipes') { ajouter(key, store, key, row); if (supprime) suppressionsRecettes.add(key); continue; }
      const id = store === 'recipe_versions' || store === 'dish_recipe_links' ? row?.recipe_id : await parentVersion(row?.recipe_version_id);
      if (!id && !entree && !current) continue; // la condition métier refusera elle-même une fiche disparue
      ajouter(id, store, key);
      if (supprime) suppressionsRecettes.add(id);
      if (current) {
        const champ = store === 'recipe_versions' || store === 'dish_recipe_links' ? 'recipe_id' : 'recipe_version_id';
        if (entree && entree[champ] !== current[champ]) throw new ErreurCycleRecette('source_modifiee', id);
        conditionUnique(conditions, store, key, ancienne => ({ key, fusion: courant => {
          if (!courant || courant[champ] !== current[champ]) throw new ErreurCycleRecette('source_modifiee', id);
          const ecrite = lireCondition(ancienne, courant, store, key);
          if (contextes.get(id)?.historique && ecrite) throw new ErreurCycleRecette('historique_seul', id);
          return ecrite;
        } }));
      }
    }
  }
  // Les agrégats et historiques peuvent dépendre de plusieurs recettes. Chaque contexte garde la ligne concernée.
  for (const store of new Set([...Object.keys(puts), ...Object.keys(conditions), ...Object.keys(deletes)])) if (!contenuRecette.has(store)) {
    const rows = new Map((puts[store] || []).map(row => [row[STORES[store].keyPath], row]));
    for (const c of conditions[store] || []) if (c.key != null && !rows.has(c.key)) { const row = await base.get(store, c.key); if (row) rows.set(c.key, row); }
    for (const key of deletes[store] || []) if (!rows.has(key)) { const row = await base.get(store, key); if (row) rows.set(key, row); }
    for (const row of rows.values()) {
    // Une fusion peut introduire une référence absente de la copie lue. Les contextes explicites
    // protègent toute la transaction et doivent accompagner chaque écriture d’agrégat en synchronisation.
    for (const explicite of recettesInitiales) ajouter(explicite.recipe_id, store, row[STORES[store].keyPath], row);
    const ids = new Set([row.recipe_id, row.source_recipe_id, ...(Array.isArray(row.recipe_ids) ? row.recipe_ids : []), ...(Array.isArray(row.items) ? row.items.map(i => i.recipe_id) : [])].filter(Boolean));
    const versions = [row.recipe_version_id, row.source_recipe_version_id, ...(Array.isArray(row.selected_version_ids) ? row.selected_version_ids : []), ...(Array.isArray(row.items) ? row.items.map(i => i.recipe_version_id) : [])].filter(Boolean);
    for (const id of versions) { const parent = await parentVersion(id); if (parent) ids.add(parent); }
    for (const id of ids) if (!['imports', 'scan_sessions'].includes(store) || contextes.has(id)) ajouter(id, store, row[STORES[store].keyPath], row);
    }
  }
  for (const [id, parent] of parentsVersions) conditionUnique(conditions, 'recipe_versions', id, ancienne => ({ key: id, fusion: courant => {
    if (!courant || courant.recipe_id !== parent) throw new ErreurCycleRecette('source_modifiee', parent);
    return lireCondition(ancienne, courant, 'recipe_versions', id);
  } }));
  for (const c of contextes.values()) {
    const id = c.recipe_id;
    const entree = (puts.recipes || []).find(r => r.id === id);
    if (!Object.hasOwn(c, 'expected_edition_id')) c.expected_edition_id = entree?.edition_id ?? null;
    if (!Object.hasOwn(c, 'expected_edition_cycle_id')) c.expected_edition_cycle_id = null;
    const editionId = c.expected_edition_id;
    ajouterEdition(editionId, { ...c, expected_cycle_id: c.expected_edition_cycle_id }, c.records, id);
    for (const contexteEdition of editionsInitiales) ajouterEdition(contexteEdition.edition_id, contexteEdition, c.records);
    const declarerCreation = c.creation || conditions.recipes?.some(g => g.key === id && g.absente === true);
    conditionUnique(conditions, 'recipes', id, ancienne => ({ key: id, fusion: (courant, lecture) => {
      if (base !== db || (c.contexteValide && !c.contexteValide())) throw new ErreurCycleRecette('contexte_change', id);
      const cycle = lireCycleRecette(courant);
      if (declarerCreation) {
        if (courant || !entree || lireCycleRecette(entree).id !== null || lireCycleRecette(entree).etat !== 'active') throw new ErreurCycleRecette('creation_refusee', id);
      } else {
        if (!courant) throw new ErreurCycleRecette('source_absente', id);
        if (cycle.etat === 'invalide') throw new ErreurCycleRecette('cycle_invalide', id);
        if (!c.historique && (cycle.etat !== 'active' || cycle.id !== c.expected_cycle_id)) throw new ErreurCycleRecette('cycle_change', id);
        if (!c.historique && (courant.edition_id ?? null) !== editionId) throw new ErreurCycleRecette('source_modifiee', id);
        if (!c.historique && lireEtatRecette(courant, editionId == null ? null : lecture('book_editions', editionId)).etat !== 'active') throw new ErreurCycleRecette('edition_retiree', id);
      }
      if (suppressionsRecettes.has(id) && (cycle.id !== null || c.historique || (editionId !== null && lireCycleEdition(lecture('book_editions', editionId)).id !== null))) throw new ErreurCycleRecette('suppression_interdite', id);
      const fusion = lireCondition(ancienne, courant, 'recipes', id, lecture);
      const ecrite = fusion || entree;
      if (c.historique && (ecrite || c.records.some(r => contenuRecette.has(r.store) && (puts[r.store] || []).some(row => row[STORES[r.store].keyPath] === r.id)))) throw new ErreurCycleRecette('historique_seul', id);
      if (ecrite && !declarerCreation) {
        if (!memeCycleRecette(ecrite, courant)) throw new ErreurCycleRecette('cycle_reserve', id);
        if (!memeExceptionEdition(ecrite, courant) && !((ecrite.edition_id ?? null) !== editionId && ecrite.restored_from_edition == null)) throw new ErreurCycleRecette('cycle_reserve', id);
        if ((ecrite.edition_id ?? null) !== editionId) {
          const cible = ecrite.edition_id == null ? null : lecture('book_editions', ecrite.edition_id);
          if (ecrite.restored_from_edition != null || (ecrite.edition_id != null && (!contextesEditions.has(ecrite.edition_id) || lireCycleEdition(cible).etat !== 'active'))) throw new ErreurCycleRecette('source_modifiee', id);
        }
      }
      if (ecrite && declarerCreation && (ecrite.restored_from_edition != null || (ecrite.edition_id != null && lireCycleEdition(lecture('book_editions', ecrite.edition_id) || (puts.book_editions || []).find(e => e.id === ecrite.edition_id)).etat !== 'active'))) throw new ErreurCycleRecette('creation_refusee', id);
      return fusion;
    } }));
  }
  // Les écritures du livre et des sources gardent elles aussi leur parent, même sans recette écrite.
  for (const store of ['book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'library_activity', 'rediscovery_prefs', 'imports', 'books']) {
    const rows = new Map((puts[store] || []).map(row => [row[STORES[store].keyPath], row]));
    for (const c of conditions[store] || []) if (c.key != null && !rows.has(c.key)) rows.set(c.key, await base.get(store, c.key));
    for (const key of deletes[store] || []) if (!rows.has(key)) rows.set(key, await base.get(store, key));
    for (const [key, row] of rows) {
      if (!row) {
        // Une source neuve doit être déclarée dans puts pour que son parent soit gardé avant la transaction.
        if (['source_documents','source_pages','scan_sessions'].includes(store) && conditions[store]?.some(c => c.key === key && c.fusion)) throw new TypeError('Une source absente ne se crée pas par fusion seule');
        continue;
      }
      if (store === 'books') {
        for (const c of editionsInitiales) ajouterEdition(c.edition_id, c, [{ store, id: key }]);
        conditionMagasin(conditions, 'book_editions', editions => {
          const liees = editions.filter(e => e.book_id === key);
          if ((deletes.books || []).includes(key) && liees.length) throw new ErreurCycleRecette('suppression_interdite');
          if (!(deletes.books || []).includes(key) && liees.some(e => lireCycleEdition(e).id !== null || lireCycleEdition(e).etat !== 'active') && !liees.some(e => lireCycleEdition(e).etat === 'active' && contextesEditions.has(e.id))) throw new ErreurCycleRecette('edition_retiree');
        });
        continue;
      }
      // Les sources gardent leur provenance : changer le parent entrant ne peut contourner sa corbeille.
      const actuelle = await base.get(store, key);
      const parents = store === 'source_documents' ? ['edition_id', 'scan_session_id']
        : store === 'source_pages' ? ['edition_id', 'document_id'] : store === 'scan_sessions' ? ['edition_id'] : null;
      if (parents) {
        const entree = (puts[store] || []).find(r => r[STORES[store].keyPath] === key);
        const memeProvenance = (a,b) => parents.every(champ => (a?.[champ] ?? null) === (b?.[champ] ?? null));
        const sourceAutorisee=source_commands.some(c=>c.store===store&&c.id===key||c.op==='source_revision'&&(store==='source_pages'?c.new_pages:store==='source_documents'?c.new_documents:[]).some(r=>r.id===key)||c.op==='source_transfer'&&c.phase==='part'&&c.rows.some(r=>r.store===store&&r.id===key));
        const verifierIdentite=(avant,apres)=>{if(!apres)return;
          if(avant&&['source_pages','source_documents'].includes(store)&&canoniqueSources(store==='source_pages'?projectionIdentitePage(avant):projectionIdentiteDocument(avant))!==canoniqueSources(store==='source_pages'?projectionIdentitePage(apres):projectionIdentiteDocument(apres)))throw new ErreurSources('source_changed');
          if(!sourceAutorisee){for(const k of store==='scan_sessions'?['source_state','source_receipts','source_copy']:['source_revision','source_copy'])if(canoniqueSources(avant?.[k]??null)!==canoniqueSources(apres?.[k]??null))throw new ErreurSources('source_reserved');}
        };
        if (actuelle && entree && !memeProvenance(actuelle,entree)) throw new ErreurCycleRecette('source_modifiee');
        verifierIdentite(actuelle,entree);
        conditionUnique(conditions, store, key, ancienne => ({ key, fusion: (courant,lecture) => {
          if (!!courant !== !!actuelle || (courant && !memeProvenance(courant,actuelle))) throw new ErreurCycleRecette('source_modifiee');
          const fusion=lireCondition(ancienne,courant,store,key,lecture), ecrite=fusion || entree;
          if (ecrite && !memeProvenance(actuelle || entree,ecrite)) throw new ErreurCycleRecette('source_modifiee');
          verifierIdentite(courant,ecrite);
          return fusion;
        }}));
      }
      const id = store === 'book_editions' ? key : row.edition_id;
      if (id == null || (['imports', 'scan_sessions'].includes(store) && !contextesEditions.has(id))) continue;
      const c = ajouterEdition(id, null, [{ store, id: key }]);
      if (store === 'book_editions' && conditions.book_editions?.some(g => g.key === key && g.absente === true)) c.creation = true;
      if (store !== 'book_editions') conditionUnique(conditions, store, key, ancienne => ({ key, fusion: (courant, lecture) => {
        const fusion = lireCondition(ancienne, courant, store, key, lecture), written = fusion || (puts[store] || []).find(r => r[STORES[store].keyPath] === key);
        if (courant && courant.edition_id !== actuelle?.edition_id) throw new ErreurCycleRecette('source_modifiee');
        if (written && (written.edition_id ?? null) !== id) throw new ErreurCycleRecette('source_modifiee');
        const parent = lecture('book_editions', id), cycle = lireCycleEdition(parent);
        if ((deletes[store] || []).includes(key) && cycle.id !== null && ['source_documents', 'source_pages'].includes(store)) throw new ErreurCycleRecette('suppression_interdite');
        if (c.historique && written && ['source_documents', 'source_pages'].includes(store)) throw new ErreurCycleRecette('historique_seul');
        if (cycle.etat === 'retiree' && !c.historique && (written || (deletes[store] || []).includes(key))) {
          if (!['source_documents', 'source_pages', 'scan_sessions', 'imports'].includes(store) || !c.recipe_id || !contextes.has(c.recipe_id) || lireEtatRecette(lecture('recipes', c.recipe_id), parent).etat !== 'active' || (deletes[store] || []).includes(key)) throw new ErreurCycleRecette('edition_retiree');
          const exclusive = session => session && Array.isArray(session.recipe_ids) && session.recipe_ids.length === 1 && session.recipe_ids[0] === c.recipe_id;
          if (['source_documents', 'source_pages'].includes(store)) {
            if (courant) throw new ErreurCycleRecette('edition_retiree');
            const document = store === 'source_documents' ? written : (puts.source_documents || []).find(d => d.id === written.document_id);
            const session = (puts.scan_sessions || []).find(s => s.id === document?.scan_session_id);
            if (!document || !exclusive(session)) throw new ErreurCycleRecette('source_modifiee');
          } else if (store === 'imports' ? written.recipe_id !== c.recipe_id : !exclusive(written) || (courant && !exclusive(courant))) throw new ErreurCycleRecette('source_modifiee');
        }
        return fusion;
      } }));
    }
  }
  for (const c of contextesEditions.values()) {
    const id = c.edition_id, entree = (puts.book_editions || []).find(e => e.id === id);
    conditionUnique(conditions, 'book_editions', id, ancienne => ({ key: id, fusion: (courant, lecture) => {
      if (base !== db || (c.contexteValide && !c.contexteValide())) throw new ErreurCycleRecette('contexte_change');
      const creation = c.creation || ancienne?.absente;
      const cycle = lireCycleEdition(courant);
      if (creation) {
        if (courant || !entree || lireCycleEdition(entree).etat !== 'active' || lireCycleEdition(entree).id !== null) throw new ErreurCycleRecette('creation_refusee');
      } else {
        if (!courant && !c.historique) throw new ErreurCycleRecette('edition_absente');
        if (!courant && c.historique) return lireCondition(ancienne, courant, 'book_editions', id, lecture);
        if (cycle.etat === 'invalide' || (!c.historique && cycle.id !== c.expected_cycle_id)) throw new ErreurCycleRecette('cycle_change');
      }
      if ((deletes.book_editions || []).includes(id)) throw new ErreurCycleRecette('suppression_interdite');
      const fusion = lireCondition(ancienne, courant, 'book_editions', id, lecture), written = fusion || entree;
      if (written && !creation && (!memeCycleEdition(written, courant) || cycle.etat !== 'active')) throw new ErreurCycleRecette('cycle_reserve');
      return fusion;
    } }));
  }
  if (contextes.size || contextesEditions.size) conditionUnique(conditions, 'sync_state', 'user_id', ancienne => ({ key: 'user_id', fusion: courant => {
    for (const c of [...contextes.values(), ...contextesEditions.values()]) if ((courant?.value ?? null) !== c.owner_id || (c.contexteValide && !c.contexteValide())) throw new ErreurCycleRecette('compte_change', c.recipe_id);
    return lireCondition(ancienne, courant, 'sync_state', 'user_id');
  } }));
  const structurees=await preparerGardesVersionsStructurees({puts,conditions,deletes,lire:(store,id)=>base.get(store,id),lireReferencesVersion:async id=>({traductions:(await base.getAll('recipe_translations')).filter(r=>r.recipe_version_id===id),journaux:(await base.getAll('imports')).filter(r=>r.kind==='traduction'&&r.source_version_id===id)})});
  return { conditions:structurees, recettes: [...contextes.values()].map(({ contexteValide, creation, ...c }) => c), editions: [...contextesEditions.values()].map(({ contexteValide, creation, ...c }) => c) };
}

function conditionsFichiers(fichiers, conditions, now) {
  if (!Array.isArray(fichiers)) throw new TypeError('Les fichiers sont un tableau');
  for (const { sha256, blob, meta = {} } of fichiers) {
    if (!/^[a-f0-9]{64}$/.test(sha256 || '') || !(blob instanceof Blob)) throw new TypeError('Fichier invalide');
    conditionUnique(conditions, 'files', sha256, ancienne => ({ key: sha256, fusion: courant => {
      const precedent = lireCondition(ancienne, courant, 'files', sha256);
      if (courant?.blob instanceof Blob) return precedent; // ne remplace jamais des octets déjà possédés
      const { origin, ...brut } = meta, propreMeta = nettoyerChaines(brut);
      const { mime, syncable } = resolveMime(blob.type || propreMeta.mime || courant?.mime, propreMeta.original_filename || courant?.original_filename);
      return { ...(courant || {}), ...propreMeta, ...(precedent || {}), sha256, blob, mime, syncable, size: blob.size, created_at: courant?.created_at || now, updated_at: now };
    } }));
  }
}

// Porte réservée aux commandes explicites. Le contenu courant n'est jamais reconstruit depuis une copie de formulaire.
export async function commanderCycleRecette(operation, contexte, { verifierCourante = null } = {}) {
  if (verifierCourante !== null && typeof verifierCourante !== 'function') throw new TypeError('La vérification de la recette doit être une fonction');
  const { action, recipe_id, operation_id, base_cycle_id, at, edition_id = null, base_edition_cycle_id = null } = operation || {};
  if (!['trash', 'restore', 'restore_from_edition'].includes(action) || (typeof recipe_id !== 'string' || !recipe_id.trim()) || !identifiantCycleValide(operation_id) || !(base_cycle_id === null || identifiantCycleValide(base_cycle_id)) || !dateCycleValide(at)) throw new ErreurCycleRecette('commande_invalide', recipe_id);
  if (!contexte || contexte.recipe_id !== recipe_id || contexte.expected_cycle_id !== base_cycle_id || !Object.hasOwn(contexte, 'owner_id')) throw new ErreurCycleRecette('contexte_invalide', recipe_id);
  if ((contexte.expected_edition_id ?? null) !== edition_id || (edition_id !== null && contexte.expected_edition_cycle_id !== base_edition_cycle_id)) throw new ErreurCycleRecette('contexte_invalide', recipe_id);
  const base = db, cible = action === 'trash' ? 'retiree' : 'active';
  let recipe = null, commande = { action, recipe_id, operation_id, base_cycle_id, at, ...(edition_id ? { entity: 'recipe', edition_id, base_edition_cycle_id } : {}) };
  const editions = edition_id == null ? [] : [{ edition_id, expected_cycle_id: base_edition_cycle_id, owner_id: contexte.owner_id, recipe_id, records: [{ store: 'recipes', id: recipe_id }] }];
  await base.mutate({ origin: 'local', lifecycle: () => commande, recettes: [{ ...contexte, records: [{ store: 'recipes', id: recipe_id }] }], editions, conditions: {
    ...(edition_id ? { book_editions: [{ key: edition_id, fusion: () => null }] } : {}),
    sync_state: [{ key: 'user_id', fusion: courant => {
      if ((courant?.value ?? null) !== contexte.owner_id || base !== db || (contexte.contexteValide && !contexte.contexteValide())) throw new ErreurCycleRecette('compte_change', recipe_id);
      return null;
    } }],
    recipes: [{ key: recipe_id, fusion: (courant, lecture) => {
      if (!courant) throw new ErreurCycleRecette('source_absente', recipe_id);
      if ((courant.edition_id ?? null) !== edition_id) throw new ErreurCycleRecette('source_modifiee', recipe_id);
      const cycle = lireCycleRecette(courant);
      const edition = edition_id ? lecture('book_editions', edition_id) : null, parent = edition_id ? lireCycleEdition(edition) : null;
      const exception = action === 'restore_from_edition' ? { edition_id, lifecycle_id: base_edition_cycle_id } : null;
      if (cycle.id === operation_id && cycle.etat === cible && memeExceptionEdition(courant, { ...courant, restored_from_edition: exception })) { recipe = courant; commande = null; return null; }
      if (cycle.etat === 'invalide' || cycle.id !== base_cycle_id || (parent && (parent.etat === 'invalide' || parent.id !== base_edition_cycle_id))) throw new ErreurCycleRecette('cycle_change', recipe_id);
      if (action === 'restore_from_edition') {
        if (!edition_id || parent.etat !== 'retiree' || parent.mode !== 'with_recipes' || lireEtatRecette(courant, edition).etat !== 'retiree') throw new ErreurCycleRecette('cycle_change', recipe_id);
      } else if (action === 'trash' ? lireEtatRecette(courant, edition).etat !== 'active' : cycle.etat !== 'retiree' || (parent?.etat === 'retiree' && parent.mode === 'with_recipes')) throw new ErreurCycleRecette('cycle_change', recipe_id);
      if (verifierCourante) {
        const verdict = verifierCourante(courant, lecture);
        if (verdict?.then) throw new TypeError('Une vérification transactionnelle reste synchrone');
        if (verdict === false) throw new ErreurCycleRecette('source_modifiee', recipe_id);
      }
      if (action === 'trash' && base_cycle_id === null && !edition_id) commande.seed = structuredClone(courant);
      recipe = { ...courant, lifecycle_id: operation_id, trashed_at: action === 'trash' ? at : null, ...(edition_id || courant.restored_from_edition != null ? { restored_from_edition: exception } : {}), updated_at: syncNow() };
      return recipe;
    } }],
  } });
  if (commande) emit('change', { store: 'recipes', id: recipe_id });
  return { recipe, operation: { ...operation }, dejaFaite: commande === null };
}

export async function commanderCycleEdition(operation, contexte, { bilan = null } = {}) {
  const { action, edition_id, operation_id, base_cycle_id, at, mode } = operation || {};
  if (!['trash', 'restore'].includes(action) || typeof edition_id !== 'string' || !edition_id.trim() || !identifiantCycleValide(operation_id) || !(base_cycle_id === null || identifiantCycleValide(base_cycle_id)) || !dateCycleValide(at) || (action === 'trash' && !['keep_recipes', 'with_recipes'].includes(mode))) throw new ErreurCycleRecette('commande_invalide');
  if (!contexte || contexte.edition_id !== edition_id || contexte.expected_cycle_id !== base_cycle_id || !Object.hasOwn(contexte, 'owner_id')) throw new ErreurCycleRecette('contexte_invalide');
  const base = db, lignes = {}, cible = action === 'trash' ? 'retiree' : 'active';
  let edition = null, bilanRestauration = null, commande = { entity: 'edition', action, edition_id, operation_id, base_cycle_id, at, ...(action === 'trash' ? { mode } : {}) };
  const conditions = Object.fromEntries((action === 'trash' ? MAGASINS_BILAN_LIVRE : ['recipes']).map(s => [s, [{ toutes: true, verifier: rows => { lignes[s] = rows; } }]]));
  conditions.sync_state = [{ key: 'user_id', fusion: row => {
    if ((row?.value ?? null) !== contexte.owner_id || base !== db || (contexte.contexteValide && !contexte.contexteValide())) throw new ErreurCycleRecette('compte_change');
    return null;
  } }];
  conditions.book_editions = [{ key: edition_id, fusion: courant => {
    if (!courant) throw new ErreurCycleRecette('edition_absente');
    const cycle = lireCycleEdition(courant);
    if (cycle.id === operation_id && cycle.etat === cible && cycle.mode === (action === 'trash' ? mode : null)) { edition = courant; commande = null; return null; }
    if (cycle.etat === 'invalide' || cycle.id !== base_cycle_id || cycle.etat !== (action === 'trash' ? 'active' : 'retiree')) throw new ErreurCycleRecette('cycle_change');
    if (action === 'trash' && (!bilan || bilan.edition?.id !== edition_id || calculerBilanLivre(courant, lignes).signature !== bilan.signature)) throw new ErreurCycleRecette('bilan_change');
    if (action === 'trash' && base_cycle_id === null) commande.seed = structuredClone(courant);
    edition = { ...courant, lifecycle_id: operation_id, trashed_at: action === 'trash' ? at : null, trash_mode: action === 'trash' ? mode : null, updated_at: syncNow() };
    if (action === 'restore') {
      bilanRestauration = { retablies: 0, dejaActives: 0, laisseesRetirees: 0, invalides: 0 };
      for (const r of (lignes.recipes || []).filter(r => r.edition_id === edition_id)) {
        const avant = lireEtatRecette(r, courant).etat, apres = lireEtatRecette(r, edition).etat;
        if (apres === 'active') bilanRestauration[avant === 'active' ? 'dejaActives' : 'retablies']++;
        else bilanRestauration[apres === 'retiree' ? 'laisseesRetirees' : 'invalides']++;
      }
    }
    return edition;
  } }];
  await base.mutate({ origin: 'local', conditions, editions: [{ ...contexte, records: [{ store: 'book_editions', id: edition_id }] }], lifecycle: () => commande });
  if (commande) emit('change', { store: 'book_editions', id: edition_id });
  return { edition, operation: { ...operation }, dejaFaite: commande === null, bilanRestauration };
}

// Fiches prêtes à écrire : nettoyées (R-L3-25, comme save() — même raison, et un seul endroit qui en décide : `propre`), created_at
// conservé ou posé, updated_at = `now`. Les deux chemins d'écriture en lot (saveBatch, transitionner) passent ici.
const horodater = (store, rows, now) => rows.map((r) => ({ ...propre(store, r), created_at: r.created_at || now, updated_at: now }));
// Une condition de fusion `{ key, fusion }` (lot G) portée par saveBatch, ou par le sac `conditions` de transitionner, est enveloppée comme un patch (ronde 1
// de la tâche 2 du lot C) : la fiche qu'elle calcule sur la fiche RELUE dans la transaction est nettoyée (R61) et horodatée (created_at conservé, updated_at =
// now) ; null : rien d'écrit pour elle. Une forme fausse (fusion qui n'est pas une fonction) passe telle quelle : db.mutate la refuse (TypeError).
const envelopperFusion = (store, c, now) => (c && typeof c.fusion === 'function'
  ? { ...c, fusion: (courant, lecture) => { const f = c.fusion(courant, lecture); return f == null ? null : horodater(store, [f], now)[0]; } }
  : c);
const envelopperFusions = (conditions, now) => (conditions && typeof conditions === 'object' && !Array.isArray(conditions)
  ? Object.fromEntries(Object.entries(conditions).map(([store, items]) => [store, Array.isArray(items) ? items.map((c) => envelopperFusion(store, c, now)) : items]))
  : conditions);

// `origin` : 'local' par défaut (écriture de la personne, donc capturée) ; 'device' pour ce qui ne part jamais au
// serveur (amorçage des références, rattrapages) — c'est la capture qui tranche, d'après l'origine (src/sync/outbox.js).
// `conditions` (spec import-cible § 3.6) : le lot n'est écrit que si chaque fiche conditionnée porte un statut attendu, dans la même
// transaction ; condition fausse → TransitionRefusee, rien d'écrit. Une condition de statut VÉRIFIE SEULEMENT : la fiche conditionnée n'est ni
// réécrite ni recapturée (à la différence de transitionner, qui la réécrit avec un updated_at neuf) ; un `patch` ici contournerait `propre` et
// l'horodatage, il est refusé : passer par repo.transitionner. Une condition de fusion `{ key, fusion }` (lot G) écrit la fiche qu'elle calcule sur la
// fiche RELUE, enveloppée comme un patch (envelopperFusion, ronde 1 de la tâche 2 du lot C), et un `change` part aussi pour son magasin.
export async function saveBatch(batch, { origin = 'local', conditions = null, recettes = [], editions = [], fichiers = [], source_batch = null } = {}) {
  for (const [store, items] of Object.entries(conditions ?? {})) for (const c of (Array.isArray(items) ? items : [])) if (c?.patch != null) throw new TypeError('saveBatch ne porte pas de patch (' + store + ') : passer par repo.transitionner');
  const now = syncNow();
  const stamped = {};
  for (const [store, rows] of Object.entries(batch)) stamped[store] = horodater(store, rows, now);
  let ecrites = {};
  const protection = await protegerMutationRecettes(stamped, conditions, recettes, { origin, editions });
  preparerLotSources({ puts: stamped, recettes: protection.recettes, editions: protection.editions, source_batch });
  conditions = protection.conditions;
  conditionsFichiers(fichiers, conditions, now);
  if (conditions) {
    ecrites = (await db.mutate({ puts: stamped, origin, conditions: envelopperFusions(conditions, now), recettes: protection.recettes, editions: protection.editions, source_batch })) ?? {};
  } else await db.putBatch(stamped, { origin });
  for (const store of new Set([...Object.keys(stamped), ...Object.keys(ecrites)])) emit('change', { store });
  return stamped;
}

// Porte bornée L4 : gardes métier ordinaires et lignes locales brutes, dans le même commit.
export async function muterEditeur({metier={},internes={}}={}, {origin,baseAttendue,contexteValide}={}) {
  const base=db, magasins=new Set(['recipes','recipe_versions','books','book_editions','imports','source_pages','source_documents','scan_sessions']);
  const verifierContexte=()=>{if(base!==db||base!==baseAttendue||typeof contexteValide!=='function'||!contexteValide())throw new ErreurBrouillon('contexte_change');};
  verifierContexte();
  if(!['device','local'].includes(origin)||Object.keys(metier).some(k=>!['puts','conditions','recettes','editions'].includes(k))||Object.keys(internes).some(k=>!['puts','conditions','deletes'].includes(k)))throw new TypeError('Mutation éditeur invalide');
  const batch=metier.puts||{},conditions=Object.fromEntries(Object.entries(metier.conditions||{}).map(([s,cs])=>[s,[...cs]]));
  if([...Object.keys(batch),...Object.keys(conditions)].some(s=>!magasins.has(s))||origin==='device'&&(Object.keys(batch).length||Object.keys(conditions).length||metier.recettes?.length||metier.editions?.length))throw new TypeError('Magasin métier interdit');
  const locaux=structuredClone(internes.puts||[]),deletes=[...(internes.deletes||[])],fusions=new Map();
  for(const row of locaux)validerLigneEditeur(row);
  if(deletes.some(k=>!estCleEditeur(k))||new Set(locaux.map(r=>r.key)).size!==locaux.length||new Set(deletes).size!==deletes.length)throw new TypeError('Clé interne interdite');
  const vus=new Set(locaux.map(r=>r.key)),locConditions=[];
  let verifierToutes=null;
  for(const c of internes.conditions||[]){
    if(c.toutes===true){if(verifierToutes||typeof c.verifier!=='function')throw new TypeError('Condition interne invalide');verifierToutes=c.verifier;continue;}
    if(c.key!=='user_id'&&!estCleEditeur(c.key)||c.index!=null||c.patch!=null||c.attendus!=null)throw new TypeError('Condition interne interdite');
    if(c.key==='user_id'&&typeof c.fusion!=='function')throw new TypeError('Propriétaire en lecture seule');
    if(c.fusion){if(vus.has(c.key))throw new TypeError('Double écriture interne');locConditions.push({...c,fusion:(courant,lecture)=>{
      const row=c.fusion(courant,lecture);if(row?.then)throw new TypeError('Fusion synchrone requise');
      if(c.key==='user_id'&&row!=null)throw new TypeError('Propriétaire en lecture seule');
      if(row!=null){validerLigneEditeur(row);if(row.key!==c.key)throw new TypeError('Identité interne modifiée');fusions.set(row.key,row);}return row;
    }});}else locConditions.push(c);
  }
  locConditions.push({toutes:true,verifier:rows=>{verifierContexte();const r=verifierToutes?.(rows);if(r?.then)throw new TypeError('Vérification synchrone requise');
    const nouveaux=[...locaux,...fusions.values()],recus=nouveaux.filter(estRecuEditeur),proteges=new Set(nouveaux.map(r=>r.key));
    // La rétention se décide sur l'instantané de cette transaction ; seuls les reçus valides du propriétaire qui publie sont concernés.
    for(const recu of recus){const comptes=new Map(rows.filter(r=>!deletes.includes(r.key)).map(r=>[r.key,r]));for(const r of nouveaux)comptes.set(r.key,r);const lignes=[...comptes.values()].filter(r=>r.value?.owner_id===recu.value.owner_id&&r.value?.database_name===recu.value.database_name&&estRecuEditeur(r)).sort((a,b)=>a.value.publication.committed_at.localeCompare(b.value.publication.committed_at)||a.key.localeCompare(b.key));let exces=lignes.length-LIMITES_BROUILLONS.recus;for(const r of lignes)if(exces>0&&!proteges.has(r.key)){deletes.push(r.key);exces--;}}
    verifierQuotaEditeur(rows,nouveaux,deletes);
  }});
  conditions.sync_state=locConditions;
  const now=syncNow(),stamped=Object.fromEntries(Object.entries(batch).map(([s,rows])=>[s,horodater(s,rows,now)]));
  const tailleAdmise=row=>{if(new TextEncoder().encode(JSON.stringify(row)).length>LIMITES_SYNC_EDITEUR.element)throw new ErreurBrouillon('limite_publication');return row;};
  for(const rows of Object.values(stamped))for(const row of rows)tailleAdmise(row);
  const protection=await protegerMutationRecettes(stamped,conditions,metier.recettes||[],{origin,editions:metier.editions||[]});
  verifierContexte();
  // Les fusions du namespace local ne reçoivent aucun created_at/updated_at technique.
  const finales={sync_state:protection.conditions.sync_state,...Object.fromEntries(Object.entries(protection.conditions).filter(([s])=>s!=='sync_state').map(([s,cs])=>[s,cs.map(c=>{const f=envelopperFusion(s,c,now);return typeof f.fusion==='function'?{...f,fusion:(...args)=>{const row=f.fusion(...args);return row==null?null:tailleAdmise(row);}}:f;})]))};
  const ecrites=await base.mutate({origin,puts:{...stamped,...(locaux.length?{sync_state:locaux}:{})},deletes:{sync_state:deletes},conditions:finales,recettes:protection.recettes,editions:protection.editions});
  verifierContexte();
  const sorties={};for(const s of new Set([...Object.keys(stamped),...Object.keys(ecrites||{})]))if(s!=='sync_state'){sorties[s]=[...(stamped[s]||[]),...(ecrites?.[s]||[])];emit('change',{store:s});}
  return {metier:sorties,internes:[...locaux,...(ecrites?.sync_state||[])]};
}

// Porte L6 : quota local et données métier partagent une transaction, jamais de crypto dans IDB.
export async function muterTraductions({metier={},internes={},commandes=[]}={}, {origin='local',baseAttendue,contexteValide}={}){
 const base=db,verifier=()=>{if(base!==baseAttendue||base!==db||typeof contexteValide!=='function'||!contexteValide())throw new ErreurTraduction('contexte_change');};verifier();
 const fail=()=>{throw new ErreurTraduction('contenu_invalide');},clone=structuredClone;
 if(!['device','local'].includes(origin)||Object.keys(metier).some(k=>!['puts','conditions','recettes','editions'].includes(k))||Object.keys(internes).some(k=>!['puts','conditions','deletes'].includes(k)))fail();
 const cmds=clone(commandes);for(const c of cmds)await verifierCommandeTraduction(c);verifier();
 const batch=metier.puts||{},conditions=Object.fromEntries(Object.entries(metier.conditions||{}).map(([s,cs])=>[s,[...cs]]));
 if(Object.keys(batch).some(s=>!['recipe_translations','imports'].includes(s))||Object.keys(conditions).some(s=>!['recipes','recipe_versions','recipe_translations','imports','book_editions'].includes(s))||origin==='device'&&(Object.keys(batch).length||Object.keys(conditions).length||cmds.length))fail();
 const estCle=k=>estCleEditeur(k)||estCleReponseTraduction(k),valider=r=>estCleReponseTraduction(r.key)?validerReponseLocaleTraduction(r):validerLigneEditeur(r),locaux=clone(internes.puts||[]),deletes=[...(internes.deletes||[])],fusions=new Map(),cs=[];
 for(const r of locaux)valider(r);if(deletes.some(k=>!estCle(k)||k==='editor_library_epoch:v1')||new Set(locaux.map(r=>r.key)).size!==locaux.length||new Set(deletes).size!==deletes.length)fail();let toutes=null;
 for(const c of internes.conditions||[]){if(c.toutes===true){if(toutes||typeof c.verifier!=='function')fail();toutes=c.verifier;continue;}if(c.key!=='user_id'&&!estCle(c.key)||c.index!=null||c.patch!=null||c.attendus!=null||c.key==='user_id'&&typeof c.fusion!=='function')fail();cs.push(c.fusion?{...c,fusion:(r,l)=>{const next=c.fusion(r,l);if(next?.then)fail();if(next){if(next.key!==c.key||c.key==='user_id'||locaux.some(x=>x.key===c.key))fail();valider(next);fusions.set(next.key,next);}return next;}}:c);}
 cs.push({toutes:true,verifier:rows=>{verifier();const r=toutes?.(rows);if(r?.then)fail();const news=[...locaux,...fusions.values()],proteges=new Set(news.map(r=>r.key));
 for(const recu of news.filter(estRecuEditeur)){const finales=new Map(rows.filter(r=>!deletes.includes(r.key)).map(r=>[r.key,r]));for(const r of news)finales.set(r.key,r);const rs=[...finales.values()].filter(r=>r.value?.owner_id===recu.value.owner_id&&r.value?.database_name===recu.value.database_name&&estRecuEditeur(r)).sort((a,b)=>a.value.publication.committed_at.localeCompare(b.value.publication.committed_at)||a.key.localeCompare(b.key));let n=rs.length-LIMITES_BROUILLONS.recus;for(const r of rs)if(n>0&&!proteges.has(r.key)){deletes.push(r.key);n--;}}
 verifierQuotaEditeur(rows,news.filter(r=>estCleEditeur(r.key)),deletes);verifierQuotaReponsesTraduction(rows,news,deletes);}});conditions.sync_state=cs;
 const now=syncNow(),taille=r=>{if(octetsJsonbSources(r)>524288)throw new ErreurTraduction('bornes');return r;},stamped=Object.fromEntries(Object.entries(batch).map(([s,rs])=>[s,rs.map(r=>taille({...clone(r),created_at:r.created_at||now,updated_at:now}))]));
 const protection=await protegerMutationRecettes(stamped,conditions,metier.recettes||[],{origin,editions:metier.editions||[]});verifier();
 const finales=Object.fromEntries(Object.entries(protection.conditions).map(([s,xs])=>[s,s==='sync_state'?xs:xs.map(c=>c.fusion?{...c,fusion:(...a)=>{const r=c.fusion(...a);return r?taille({...r,created_at:r.created_at||now,updated_at:now}):r;}}:c)]));
 const ecrites=await base.mutate({origin,puts:{...stamped,...(locaux.length?{sync_state:locaux}:{})},deletes:{sync_state:deletes},conditions:finales,recettes:protection.recettes,editions:protection.editions,translation_commands:cmds});verifier();
 for(const s of new Set([...Object.keys(stamped),...Object.keys(ecrites||{})]))if(s!=='sync_state')emit('change',{store:s});return{metier:ecrites,internes:[...locaux,...(ecrites?.sync_state||[])]};
}

// Porte L5 : commandes immuables, fichiers et intention interne partagent le commit.
// Porte fermée de résolution L5 : aucune confirmation ne peut devenir un put ordinaire.
async function preparerReconciliationSources(r,{metier,internes,fichiers,commandes,conditions,verifier,now}){
 const fail=c=>{throw new ErreurSources(c);},egal=(a,b)=>canoniqueSources(a??null)===canoniqueSources(b??null);
 const keys=['session_id','owner_id','library_epoch','attendue','file','conflit','conflits','confirmations','locale','decision','operation_id'];
 if(!r||Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||!['reprendre','garder_serveur'].includes(r.decision)||!r.owner_id||!r.library_epoch||r.attendue?.op!=='source_revision'||r.attendue.user_id!=null&&r.attendue.user_id!==r.owner_id||r.attendue.id!==r.session_id||r.attendue.store!=='scan_sessions'||!r.attendue.lifecycle_blocked||r.conflit?.kind!=='source'||r.conflit.user_id!==r.owner_id||r.conflit.id!=='source:'+r.attendue.payload?.operation_id||r.conflit.resolution||!egal(r.conflit.local,r.attendue.payload)||r.locale?.session?.id!==r.session_id||!Array.isArray(r.file)||!r.file.length||!r.file.some(e=>egal(e,r.attendue))||r.file.some(e=>e.op!=='source_revision'||e.store!=='scan_sessions'||e.id!==r.session_id||e.user_id!=null&&e.user_id!==r.owner_id)||!Array.isArray(r.conflits)||r.conflits.length!==r.file.length||r.conflits.some((c,i)=>c.id!=='source:'+r.file[i].payload?.operation_id||c.row&&(c.row.id!==c.id||c.row.user_id!==r.owner_id||c.row.kind!=='source'||c.row.resolution))||!Array.isArray(r.confirmations)||fichiers.length||(internes.puts||[]).length||(internes.deletes||[]).length)fail('invalid_shape');
 for(const e of r.file)await verifierEmpreinteCommandeSources(e.payload);verifier();
 const confirmations=new Map();for(const c of r.confirmations){const data=c?.value?.data;if(!data?.id||c.value.user_id!==r.owner_id||c.value.deleted_at||!Number.isSafeInteger(c.value.server_seq)||c.value.server_seq<0||!['scan_sessions','source_pages','source_documents'].some(s=>c.key==='source_confirmed:'+s+':'+data.id)||confirmations.has(c.key))fail('invalid_shape');confirmations.set(c.key,c);}
 const cible=confirmations.get('source_confirmed:scan_sessions:'+r.session_id)?.value.data;if(!cible||cible.edition_id!==r.locale.session.edition_id)fail('invalid_shape');
 for(const [store,ids]of [['source_pages',cible.page_ids||[]],['source_documents',cible.document_ids||[]]])for(const id of ids)if(!confirmations.has('source_confirmed:'+store+':'+id))fail('reception_incomplete');
 const locales={scan_sessions:[r.locale.session],source_pages:r.locale.pages,source_documents:r.locale.documents,book_editions:r.locale.edition?[r.locale.edition]:[]};
 if((r.locale.edition?.id??null)!==(cible.edition_id??null)||!Array.isArray(r.locale.pages)||!Array.isArray(r.locale.documents)||!egal(r.locale.pages.map(p=>p.id),r.locale.session.page_ids)||!egal(r.locale.documents.map(p=>p.id),r.locale.session.document_ids))fail('invalid_shape');
 for(const [store,cs]of Object.entries(metier.conditions||{}))for(const c of cs)if(!locales[store]?.some(x=>x.id===c.key)||Object.keys(c).some(k=>!['key','fusion'].includes(k))||typeof c.fusion!=='function')fail('invalid_shape');
 const admet=['scan_sessions','source_pages','source_documents','book_editions'];if([...Object.keys(metier.puts||{}),...Object.keys(metier.conditions||{})].some(s=>!admet.includes(s)))fail('invalid_shape');
 if(r.decision==='garder_serveur'){if(r.operation_id!==null||commandes.length||Object.values(metier.puts||{}).some(xs=>xs.length))fail('invalid_shape');}
 else{const c=commandes[0];if(r.file.length!==1||commandes.length!==1||c.op!=='source_revision'||c.action!=='select'||c.id!==r.session_id||c.operation_id!==r.operation_id||c.edition_id!==cible.edition_id||c.base_source_revision!==(cible.source_state?.revision??null)||c.base_session_sha256!==await empreinteSources(projectionSessionSources(cible,c.base_sources))||!egal(c.active_page_ids,selectionRepriseConfirmee(r.attendue.payload,cible,new Map([...r.locale.pages,...[...confirmations.values()].filter(x=>x.key.startsWith('source_confirmed:source_pages:')).map(x=>x.value.data)].map(p=>[p.id,p])))))fail('invalid_shape');
  for(const [xs,anciens]of [[c.new_pages,r.attendue.payload.new_pages],[c.new_documents,r.attendue.payload.new_documents]])for(const x of xs){const ancien=anciens.find(a=>a.id===x.id);if(!ancien||!egal({...x.data,created_at:null,updated_at:null},{...ancien.data,created_at:null,updated_at:null}))fail('source_changed');}
 }
 const scope=[{key:'user_id',fusion:x=>{verifier();if(x?.value!==r.owner_id)fail('compte_change');return null;}},{key:'editor_library_epoch:v1',fusion:x=>{if(x?.value!==r.library_epoch)fail('bibliotheque_remplacee');return null;}}];
 for(const c of confirmations.values())scope.push({key:c.key,fusion:x=>{if(!egal(x,c))fail('source_changed');return null;}});
 conditions.sync_state.push(...scope);
 conditions.outbox=[{toutes:true,verifier:rows=>{verifier();const file=rows.filter(e=>(e.user_id==null||e.user_id===r.owner_id)&&['source_revision','source_transfer','index_apply'].includes(e.op)&&e.store==='scan_sessions'&&e.id===r.session_id).sort((a,b)=>a.seq-b.seq);if(!egal(file,r.file))fail('source_changed');}}];
 const resolution={choix:r.decision,at:now,operation_id:r.operation_id},recovery={session:structuredClone(r.locale.session)};
 conditions.sync_conflicts=r.conflits.map((c,i)=>({key:c.id,fusion:x=>{if(!egal(x,c.row))fail('source_changed');const base=x||{id:c.id,kind:'source',operation_id:r.file[i].payload.operation_id,user_id:r.owner_id,store:'scan_sessions',record_id:r.session_id,local:structuredClone(r.file[i].payload),server:null,reason:'dependency_changed',at:now};return{...base,resolution,...(c.id===r.conflit.id?{recovery}:{})};}}));
 // Vérifier les sources et le cycle même si un appelant ne fournit pas de condition métier.
 for(const [store,rows]of [['scan_sessions',[r.locale.session]],['source_pages',r.locale.pages],['source_documents',r.locale.documents],['book_editions',r.locale.edition?[r.locale.edition]:[]]]){
  if(!Array.isArray(rows))fail('invalid_shape');for(const row of rows)conditionUnique(conditions,store,row.id,ancienne=>({key:row.id,fusion:(courant,lecture)=>{if(!egal(courant,row))fail(store==='book_editions'?'edition_retiree':'source_changed');const next=lireCondition(ancienne,courant,store,row.id,lecture);if(r.decision==='garder_serveur'&&next&&(store!=='scan_sessions'||!egal(next,cible)))fail('invalid_shape');return next;}}));
 }
 for(const [store,ids,projection]of [['source_pages',cible.page_ids||[],projectionIdentitePage],['source_documents',cible.document_ids||[],projectionIdentiteDocument]])for(const id of ids){const data=confirmations.get('source_confirmed:'+store+':'+id).value.data;conditionUnique(conditions,store,id,ancienne=>({key:id,fusion:(courant,lecture)=>{if(!courant||!egal(projection(courant),projection(data)))fail('source_changed');return lireCondition(ancienne,courant,store,id,lecture);}}));}
 if(r.locale.edition&&(lireCycleEdition(r.locale.edition).etat!=='active'||(r.locale.edition.lifecycle_id??null)!==r.attendue.payload.base_edition_cycle_id))fail('edition_retiree');
 if(!r.locale.edition&&cible.edition_id!==null)fail('edition_retiree');
 return{deletes:{outbox:r.file.map(e=>e.seq)},origin:r.decision==='garder_serveur'?'remote':'local'};
}

export async function muterSources({metier={},internes={},fichiers=[],commandes=[],reconciliation=null}={}, {origin='local',baseAttendue,contexteValide}={}) {
 const base=db,verifier=()=>{if(base!==db||base!==baseAttendue||typeof contexteValide!=='function'||!contexteValide())throw new ErreurSources('contexte_change');};verifier();
 if(!['device','local'].includes(origin)||Object.keys(metier).some(k=>!['puts','conditions','recettes','editions'].includes(k))||Object.keys(internes).some(k=>!['puts','conditions','deletes'].includes(k)))throw new ErreurSources('invalid_shape');
 if(origin==='device'&&(Object.keys(metier.puts||{}).length||Object.keys(metier.conditions||{}).length||commandes.length||fichiers.length))throw new ErreurSources('invalid_shape');
 const commandesCopie=structuredClone(commandes);for(const c of commandesCopie)await verifierEmpreinteCommandeSources(c);verifier();
 const stores=new Set(['recipes','imports','source_pages','source_documents','scan_sessions','book_editions']),conditions=Object.fromEntries(Object.entries(metier.conditions||{}).map(([s,cs])=>[s,[...cs]])),batch=metier.puts||{};
 if([...Object.keys(batch),...Object.keys(conditions)].some(s=>!stores.has(s)))throw new ErreurSources('invalid_shape');
 const locaux=structuredClone(internes.puts||[]),deletes=[...(internes.deletes||[])],fusions=new Map(),locConditions=[];for(const row of locaux)validerLigneSources(row);
 if(new Set(locaux.map(r=>r.key)).size!==locaux.length||new Set(deletes).size!==deletes.length||deletes.some(k=>!estCleSources(k)||k==='editor_library_epoch:v1'))throw new ErreurSources('invalid_shape');
 let verifierToutes=null;
 for(const c of internes.conditions||[]){if(c.toutes===true){if(verifierToutes||typeof c.verifier!=='function')throw new ErreurSources('invalid_shape');verifierToutes=c.verifier;continue;}
  if(c.key!=='user_id'&&!estCleSources(c.key)||c.index!=null||c.patch!=null||c.attendus!=null||c.key==='user_id'&&typeof c.fusion!=='function')throw new ErreurSources('invalid_shape');
  locConditions.push(c.fusion?{...c,fusion:(r,l)=>{const next=c.fusion(r,l);if(next?.then)throw new ErreurSources('invalid_shape');if(next){if(c.key==='user_id'||next.key!==c.key||locaux.some(r=>r.key===c.key))throw new ErreurSources('invalid_shape');validerLigneSources(next);fusions.set(next.key,next);}return next;}}:c);
 }
 locConditions.push({toutes:true,verifier:rows=>{verifier();const v=verifierToutes?.(rows);if(v?.then)throw new ErreurSources('invalid_shape');verifierQuotaSources(rows,[...locaux,...fusions.values()],deletes);}});conditions.sync_state=locConditions;
 const now=syncNow(),taille=r=>{if(octetsJsonbSources(r)>LIMITES_SOURCES.ligne)throw new ErreurSources('too_large');return r;};
 const stamped=Object.fromEntries(Object.entries(batch).map(([s,rs])=>[s,rs.map(r=>taille({...structuredClone(r),created_at:r.created_at||now,updated_at:now}))]));
 const rapprochement=reconciliation?await preparerReconciliationSources(reconciliation,{metier,internes,fichiers,commandes:commandesCopie,conditions,verifier,now}):null;
 const protection=await protegerMutationRecettes(stamped,conditions,metier.recettes||[],{origin:rapprochement?.origin||origin,editions:metier.editions||[],source_commands:commandesCopie});verifier();conditionsFichiers(fichiers,protection.conditions,now);
 const finales=Object.fromEntries(Object.entries(protection.conditions).map(([s,cs])=>[s,s==='sync_state'||s==='files'?cs:cs.map(c=>{return c.fusion?{...c,fusion:(...a)=>{const r=c.fusion(...a);return r?taille({...r,created_at:r.created_at||now,updated_at:now}):r;}}:c;})]));
 // Les anciennes captures sans snapshot doivent garder la base antérieure, jamais relire la sélection après ce geste.
 if(commandesCopie.length){const file=await base.getAll('outbox'),keys=new Set(commandesCopie.flatMap(c=>[c.store+':'+c.id,...(c.base_sources||[]).map(r=>r.store+':'+r.id)]));
  for(const e of file)if(e.op==='put'&&!e.snapshot&&keys.has(e.store+':'+e.id)&&['source_pages','source_documents','scan_sessions'].includes(e.store)){
   const ancienne=await base.get(e.store,e.id);if(!ancienne||ancienne.updated_at!==e.updated_at)continue;
   (finales.outbox||=[]).push({key:e.seq,fusion:r=>{if(JSON.stringify(r)!==JSON.stringify(e))throw new ErreurSources('source_changed');return{...r,snapshot:structuredClone(ancienne)};}});
  }
 }

 const result=await base.mutate({origin:rapprochement?.origin||origin,puts:{...stamped,...(locaux.length?{sync_state:locaux}:{})},deletes:{sync_state:deletes,...(rapprochement?.deletes||{})},conditions:finales,recettes:protection.recettes,editions:protection.editions,source_commands:commandesCopie});verifier();
 const sorties={};for(const s of new Set([...Object.keys(stamped),...Object.keys(result||{})]))if(!['sync_state','files'].includes(s)){sorties[s]=[...(stamped[s]||[]),...(result?.[s]||[])];emit('change',{store:s});}return{metier:sorties,internes:[...locaux,...(result?.sync_state||[])]};
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
// `autres` (vague finale) : des conditions de plus, sur d'AUTRES magasins, vérifiées dans la même transaction et passées telles quelles (ni nettoyées ni
// horodatées : marquerInterrompus y relit le battement interne de sync_state) ; une condition sur le magasin de la transition est refusée (TypeError).
// `conditions` (lot C, spec § 4.5) : { [autreMagasin]: [{ key, attendus, patch? }] } — d'autres fiches vérifiées et patchées dans la MÊME transaction,
// chaque patch enveloppé comme celui de la ligne (nettoyé, horodaté : à la différence d'`autres`) ; une condition sans patch vérifie seulement ; comme
// `autres`, jamais une condition À CLÉ (statut, patch, fusion) sur le magasin de la transition (TypeError, ronde 1 ; lot D : les seules formes admises
// y sont dites ci-dessous) ; la valeur rendue reste la fiche de `store`/`key`. Le sac porte aussi
// `{ key, fusion }` (lot G) : la fiche calculée sur la fiche RELUE, enveloppée de même (envelopperFusion, ronde 1 de la tâche 2).
// Lot D (D-D17, aligné sur la garde du lot C) : sur le magasin de la transition, le sac n'admet que les formes SANS fiche à relire — `{ key,
// absente: true }` (une ligne neuve) et `{ index, valeur, exclus }` (I-2) —, passées telles quelles APRÈS la condition de la ligne, jamais à sa
// place ; toute autre forme y reste refusée, un sac MIXTE aussi (CHAQUE condition sans fiche ; `absente` vaut exactement true) — TypeError avant
// toute écriture (ronde 1 du lot C, ronde 1 de la tâche 1 du lot D).
export async function transitionner(store, key, { attendus, patch = null, puts = {}, deletes = {}, payloads = {}, origin = 'local', autres = {}, conditions = {}, recettes = [], editions = [], fichiers = [], source_batch = null } = {}) {
  if (Object.hasOwn(autres, store)) throw new TypeError('transitionner : `autres` ne porte pas de condition sur ' + store);
  const sansFiche = (c) => !!c && typeof c === 'object' && (c.absente === true || c.index != null); // lot D (D-D17) : une ligne neuve ou une condition d'index
  if (Object.hasOwn(conditions ?? {}, store) && !(Array.isArray(conditions[store]) && conditions[store].every(sansFiche))) throw new TypeError('transitionner : sur ' + store + ', `conditions` n’admet que { key, absente: true } et { index, valeur, exclus }');
  const now = syncNow();
  const stamped = {};
  for (const [s, rows] of Object.entries(puts)) stamped[s] = horodater(s, rows, now);
  // Chaque patch — celui de la ligne et ceux du sac `conditions` (lot C) — est enveloppé de la même façon : nettoyage des chaînes (R61) puis updated_at ;
  // ceux d'`autres` (vague finale du lot A) passent tels quels.
  const envelopper = (s, p) => (courant) => ({ ...propre(s, typeof p === 'function' ? p(courant) : (p || {})), updated_at: now });
  const toutes = { ...autres, [store]: [{ key, attendus, patch: envelopper(store, patch) }] };
  for (const [s, items] of Object.entries(conditions ?? {})) {
    if (!Array.isArray(items)) throw new TypeError('Les conditions de ' + s + ' doivent être un tableau');
    toutes[s] = [...(toutes[s] || []), ...items.map((c) => (c && c.patch != null ? { ...c, patch: envelopper(s, c.patch) } : envelopperFusion(s, c, now)))];
  }
  const protection = await protegerMutationRecettes(stamped, toutes, recettes, { origin, deletes, editions });
  preparerLotSources({ puts: stamped, recettes: protection.recettes, editions: protection.editions, source_batch });
  conditionsFichiers(fichiers, protection.conditions, now);
  const ecrites = await db.mutate({ puts: stamped, deletes, payloads, origin, conditions: protection.conditions, recettes: protection.recettes, editions: protection.editions, source_batch });
  emit('change', { store, id: key });
  for (const s of new Set([...Object.keys(stamped), ...Object.keys(deletes), ...Object.keys(conditions ?? {})])) if (s !== store) emit('change', { store: s });
  return ecrites[store][0]; // la première condition de `store` est toujours celle de la ligne
}

// La fiche est relue avant sa suppression : la capture a besoin de sa copie pour l'envoyer (spec § 5.1).
export async function remove(store, key, options = {}) {
  await executerSuppressions({ [store]: [key] }, options);
  emit('change', { store, id: key });
}

// Même forme pour un lot : une seule transaction, toutes les copies lues avant.
export async function removeMany(store, keys, options = {}) {
  if (!keys.length) return;
  await executerSuppressions({ [store]: keys }, options);
  emit('change', { store });
}

// Plusieurs magasins en UNE transaction (lot E, R-E-8, R-E-12) : removeMany étendue — les copies lues AVANT (la capture en a besoin, spec § 5.1), un seul
// db.mutate d'origine 'local', puis un `change` par magasin. Un magasin sans clé est ignoré ; rien à supprimer → aucun db.mutate. La capture garde son
// filtre (installCapture : library_activity seulement sous le réglage d'historique, R-E-15) — removeBatch ne le contourne jamais. `conditions` (ronde 1 de
// la tâche 3) : vérifiées par db.mutate dans la MÊME transaction (une condition d'index fausse → TransitionRefusee, rien de supprimé, aucun change) ; un
// patch ou une fusion y est refusé avant toute écriture (TypeError) : une suppression n'écrit aucune fiche, un statut ne change que par transitionner.
export async function removeBatch(deletes, { conditions = null, recettes = [], editions = [] } = {}) {
  for (const [store, items] of Object.entries(conditions ?? {})) for (const c of (Array.isArray(items) ? items : [])) if (c?.patch != null || c?.fusion != null) throw new TypeError('removeBatch ne porte ni patch ni fusion (' + store + ')');
  const entrees = await executerSuppressions(deletes, { conditions, recettes, editions });
  for (const [store] of entrees) emit('change', { store });
}

async function executerSuppressions(deletes, { conditions: initiales = null, recettes = [], editions = [] } = {}) {
  const entrees = Object.entries(deletes || {}).filter(([, keys]) => Array.isArray(keys) && keys.length);
  if (!entrees.length) return [];
  const conditions = Object.fromEntries(Object.entries(initiales || {}).map(([s, xs]) => [s, [...xs]]));
  const payloads = {};
  for (const [store, keys] of entrees) {
    const existing = await db.getMany(store, keys);
    const sac = Object.create(null); // une clé homonyme d'une propriété native reste une clé, pas un héritage
    keys.forEach((key, i) => { sac[key] = existing[i] || null; });
    payloads[store] = sac;
    if (contenuRecette.has(store)) for (const [i, key] of keys.entries()) if (existing[i]) conditionUnique(conditions, store, key, ancienne => ({ key, fusion: courant => {
      lireCondition(ancienne, courant, store, key); return null;
    } }));
  }
  const protection = await protegerMutationRecettes({}, conditions, recettes, { deletes, editions });
  if (entrees.some(([s]) => contenuRecette.has(s))) for (const c of protection.recettes) conditionUnique(protection.conditions, 'recipes', c.recipe_id, ancienne => ({ key: c.recipe_id, fusion: (courant, lecture) => {
    if (lireCycleRecette(courant).id !== null) throw new ErreurCycleRecette('suppression_interdite', c.recipe_id);
    return lireCondition(ancienne, courant, 'recipes', c.recipe_id, lecture);
  } }));
  await db.mutate({ deletes: Object.fromEntries(entrees), payloads, conditions: protection.conditions, recettes: protection.recettes, editions: protection.editions });
  return entrees;
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
export async function putFile(sha256, blob, meta = {}, options = {}) {
  if (options.recettes?.length || options.editions?.length) {
    await saveBatch({}, { ...options, fichiers: [{ sha256, blob, meta }] });
    return db.get('files', sha256);
  }
  const existing = await db.get('files', sha256);
  if (existing && existing.blob instanceof Blob) return existing;
  const { origin, ...brut } = meta;
  const rest = nettoyerChaines(brut); // B-27 : un original_filename à caractère de contrôle faisait un conflit perpétuel dès que la ligne part
  if (origin === 'remote' && existing) {
    // Lot G (§ 3.1, F-20) : des octets reçus du serveur ne touchent ni size, ni mime, ni updated_at — la règle de la passe, la même fonction.
    // Ronde 1 (I-G3) : la ligne est relue DANS la transaction — un blob arrivé depuis la lecture (original importé) n'est jamais remplacé.
    const ecrites = await db.mutate({ conditions: { files: [{ key: sha256, fusion: (courant) => (courant && !(courant.blob instanceof Blob) ? fusionnerOctetsRecus(courant, blob) : null) }] }, origin: 'remote' });
    return ecrites?.files?.[0] ?? (await db.get('files', sha256));
  }
  // Le type connu de la ligne existante compte aussi : une ligne reçue du serveur porte son mime sans octets.
  const { mime, syncable } = resolveMime(blob.type || rest.mime || existing?.mime, rest.original_filename || existing?.original_filename);
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
// Avec `recettes`, les octets sont préparés en mémoire puis écrits dans la même transaction que les pages, la séance et le journal.
// La garde de compte/cycle refuse donc aussi les octets d’un geste tardif.
// Rend { session, pages, docs, importId } ; startScanSession navigue et notifie, lui. Une image très légère garde son signalement (issues).
export const SMALL_IMAGE_BYTES = 80 * 1024;
// Le signalement d'une image très légère est une DONNÉE stockée dans `issues` (comportement antérieur à l'import ciblé) : UNE définition, lue
// par ajouterPages et par replacePage (src/ui/import.js) ; son entrée en.js existe.
export const issuesPourImage = (octets) => (octets < SMALL_IMAGE_BYTES ? [t('Image très légère : possiblement floue ou trop petite')] : []);
const estPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const estEpub = (file) => file.type === 'application/epub+zip' || /\.epub$/i.test(file.name);
const ATTENDUS_AJOUT = ['a_lancer', 'a_verifier', 'echec']; // les statuts qui acceptent des pages (spec § 3.6)
// Une ligne du journal NEUVE (a_lancer), dans son vocabulaire fermé (D-12), et la condition de sa création (I-10, I-2) : la clé est libre, et aucun
// import ouvert ne porte déjà cette recipe_id (sans recipe_id — un index, « Regrouper en recette » —, I-2 ne joue pas). Une définition pour les deux
// chemins qui ouvrent une ligne : ajouterPages (première photo de l'écran ciblé) et ouvrirImport (pages déjà là : éditeur, panneau d'index).
function nouvelleLigneImport({ id, kind, recipe_id = null, edition_id = null, scan_session_id = null, page_ids = [], device_id = null }) {
  const ligne = ligneImportNeuve({ id, kind, recipe_id, edition_id, scan_session_id, page_ids, device_id: device_id ?? deviceId() }); // lot D (D-D12) : une seule forme
  const conditions = { imports: [{ key: ligne.id, absente: true }, ...(ligne.recipe_id != null ? [{ index: 'recipe_id', valeur: ligne.recipe_id, exclus: IMPORTS_OUVERTS }] : [])] };
  return { ligne, conditions };
}

// Ouvre une ligne du journal sur des pages DÉJÀ présentes (spec import-cible § 4.6, tâche 6) : « Extraire avec l'assistant IA » de l'éditeur (kind
// recette, recipe_id null : « Regrouper en recette ») et « Lire avec l'assistant IA » du panneau d'index (kind index). Aucun octet, aucune séance
// écrite : la ligne seule, a_lancer, par un saveBatch CONDITIONNÉ (même mur que la première photo de l'écran ciblé). Rend la ligne écrite.
const reunirConditions = (a, b) => Object.fromEntries([...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])]
  .map(store => [store, [...(a?.[store] || []), ...(b?.[store] || [])]]));
function memoriserBaseImport(ligne, recettes, editions) {
  const capture = recettes.find(c => c.recipe_id === ligne.recipe_id);
  const parent = editions.find(c => c.edition_id === ligne.edition_id);
  if (capture) Object.assign(ligne, { expected_cycle_id: capture.expected_cycle_id, expected_edition_id: capture.expected_edition_id ?? null,
    expected_edition_cycle_id: capture.expected_edition_cycle_id ?? null, owner_id: capture.owner_id });
  else if (parent) Object.assign(ligne, { expected_edition_id: parent.edition_id, expected_edition_cycle_id: parent.expected_cycle_id ?? null, owner_id: parent.owner_id });
}
export async function ouvrirImport({ id = newId('imp'), kind, recipe_id = null, edition_id = null, scan_session_id = null, page_ids = [], recettes = [], editions = [], conditions = {}, editeur = null, indexLecture = null } = {}) {
  if (!KINDS_PAGES.includes(kind)) throw new TypeError('ouvrirImport : kind d’import inconnu (' + String(kind) + ')');
  if (!Array.isArray(page_ids) || page_ids.some((p) => typeof p !== 'string' || !p)) throw new TypeError('ouvrirImport : page_ids doit être une liste d’identifiants');
  const { ligne, conditions: ouverture } = nouvelleLigneImport({ id, kind, recipe_id, edition_id, scan_session_id, page_ids });
  if(editeur!==null){
    if(kind!=='recette'||typeof recipe_id!=='string'||!recipe_id||!editeur||typeof editeur!=='object'||Array.isArray(editeur)||Object.keys(editeur).some(k=>!['base_version_id','source_signature'].includes(k))||typeof editeur.base_version_id!=='string'||!editeur.base_version_id||editeur.base_version_id.length>200||typeof editeur.source_signature!=='string'||!/^[a-f0-9]{64}$/.test(editeur.source_signature))throw new TypeError('Cible éditeur invalide');
    ligne.editor_base_version_id=editeur.base_version_id;ligne.editor_source_signature=editeur.source_signature;
  }
  if(indexLecture!==null){
    if(kind!=='index'||recipe_id!==null||!indexLecture||Object.keys(indexLecture).some(k=>!['source_capture','index_call'].includes(k)))throw new ErreurSources('invalid_shape');
    const capture=validerCaptureSources(indexLecture.source_capture),appel=validerAppelIndex(indexLecture.index_call);
    if(capture.session_id!==scan_session_id||capture.pages.length!==1||page_ids.length!==1||capture.pages[0].id!==page_ids[0]||appel.page_id!==page_ids[0]||appel.kind!==capture.pages[0].zone.kind)throw new ErreurSources('invalid_shape');
    ligne.source_capture=structuredClone(capture);ligne.index_call=structuredClone(appel);
    ligne.owner_id=(await db.get('sync_state','user_id'))?.value??null;
    conditionMagasin(ouverture,'imports',rows=>{if(rows.some(r=>r.scan_session_id===scan_session_id&&r.kind==='index'&&r.status==='en_cours'&&r.source_capture&&canoniqueSources(r.source_capture)===canoniqueSources(capture)))throw new ErreurSources('appel_en_cours');});
  }
  memoriserBaseImport(ligne, recettes, editions);
  const ecrit = await saveBatch({ imports: [ligne] }, { conditions: reunirConditions(conditions, ouverture), recettes, editions });
  return ecrit.imports[0];
}
// Un complément d'une recette ne change jamais la sélection d'une séance gérée ni une réponse déjà payée.
async function ajouterComplementRecette(files,{source,lecture,nouvelImport,nouvelleLecture,intention_id,recettes,editions,conditions}){
 const contexte=recettes.length===1?recettes[0]:null,egal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null),fail=code=>{throw new ErreurSources(code);};
 if(!contexte?.recipe_id||lecture&&(lecture.recipe_id!==contexte.recipe_id||lecture.kind!=='recette')||nouvelImport&&(nouvelImport.recipe_id!==contexte.recipe_id||nouvelImport.kind!=='recette'))fail('source_revision_requise');
 const payee=!!lecture&&(lecture.status==='a_verifier'||lecture.resultat!=null||lecture.reponse_brute!=null);
 if(payee&&!nouvelleLecture)fail('nouvelle_lecture_requise');
 if(nouvelleLecture&&(!lecture||lecture.kind!=='recette'||Object.keys(nouvelleLecture).some(k=>!['id','attendue'].includes(k))||!identifiantCycleValide(nouvelleLecture.id)||nouvelleLecture.id===lecture.id||nouvelleLecture.attendue?.id!==lecture.id))fail('contexte_change');
 const op=intention_id||nouvelleLecture?.id||newId('complement');if(!identifiantCycleValide(op)||op.length>160)fail('invalid_shape');
 const edition_id=source?.edition_id??lecture?.edition_id??nouvelImport?.edition_id??contexte.expected_edition_id??null;
 if(edition_id!==(contexte.expected_edition_id??null))fail('cycle_change');
 editions=[...editions];if(edition_id&&!editions.some(c=>c.edition_id===edition_id))editions.push({edition_id,expected_cycle_id:contexte.expected_edition_cycle_id??null,owner_id:contexte.owner_id,recipe_id:contexte.recipe_id,contexteValide:contexte.contexteValide});
 const empreintes=[];for(const file of files)empreintes.push({sha256:await sha256Hex(file),mime:file.type,size:file.size,original_filename:file.name});
 const id='ss_'+op,importId=nouvelleLecture?.id||lecture?.id||nouvelImport?.id||null,marque={format:1,operation_id:op,source_session_id:source?.id??null,recipe_id:contexte.recipe_id,owner_id:contexte.owner_id??null,files:empreintes,import_id:importId,previous_import_id:nouvelleLecture?lecture.id:null};
 const existante=await db.get('scan_sessions',id),garde=attendue=>courante=>{if(!egal(courante,attendue))fail('source_changed');return null;};
 conditions=Object.fromEntries(Object.entries(conditions||{}).map(([s,cs])=>[s,[...cs]]));
 if(existante){if(!egal(existante.complement_sources,marque))fail('operation_conflict');
  conditionUnique(conditions,'scan_sessions',id,ancienne=>({key:id,fusion:(r,l)=>{garde(existante)(r);return lireCondition(ancienne,r,'scan_sessions',id,l);}}));
  await saveBatch({}, {conditions,recettes,editions});
  return{session:existante,pages:await Promise.all(existante.page_ids.map(id=>db.get('source_pages',id))),docs:await Promise.all(existante.document_ids.map(id=>db.get('source_documents',id))),importId,previousImportId:marque.previous_import_id,dejaConserve:true};
 }
 if(lecture&&!ATTENDUS_AJOUT.includes(lecture.status))throw new TransitionRefusee('imports',lecture.id,lecture.status);
 if(nouvelleLecture&&!egal(lecture,nouvelleLecture.attendue))fail('lecture_changee');
 const session={id,status:'open',edition_id,started_at:nowIso(),page_ids:[],document_ids:[],recipe_ids:[contexte.recipe_id],device_id:deviceId(),complement_sources:marque},pages=[],docs=[],fichiers=[];
 for(const [i,file]of files.entries()){const meta=empreintes[i],pdf=estPdf(file),epub=estEpub(file),doc={id:'doc_'+op+'_'+i,edition_id,source_type:pdf?'pdf':epub?'epub':'photo',...meta,blob_path:'files/'+meta.sha256,scan_session_id:id,captured_at:nowIso()};docs.push(doc);session.document_ids.push(doc.id);fichiers.push({sha256:meta.sha256,blob:file,meta:{original_filename:file.name}});if(!pdf&&!epub){const page={id:'pg_'+op+'_'+i,document_id:doc.id,edition_id,sha256:meta.sha256,printed_page:null,file_position:null,locator:null,position:pages.length+1,issues:issuesPourImage(file.size),kind:null};pages.push(page);session.page_ids.push(page.id);}}
 const lignes={scan_sessions:[session],source_documents:docs,source_pages:pages},neuves=pages.map(p=>p.id);(conditions.scan_sessions||=[]).push({key:id,absente:true});
 if(source)conditionUnique(conditions,'scan_sessions',source.id,ancienne=>({key:source.id,fusion:(r,l)=>{garde(source)(r);return lireCondition(ancienne,r,'scan_sessions',source.id,l);}}));
 if(lecture)conditionUnique(conditions,'imports',lecture.id,ancienne=>({key:lecture.id,fusion:(r,l)=>{if(!egal(r,nouvelleLecture?.attendue||lecture))fail('lecture_changee');lireCondition(ancienne,r,'imports',lecture.id,l);return nouvelleLecture?{...r,status:'ignore',replaced_by_import_id:importId}:{...r,scan_session_id:id,page_ids:[...new Set([...(r.page_ids||[]),...neuves])]};}}));
 if(nouvelleLecture||nouvelImport){const definition=nouvelleLecture?{id:importId,kind:'recette',recipe_id:contexte.recipe_id,edition_id,device_id:deviceId()}:nouvelImport;
  const {ligne}=nouvelleLigneImport({...definition,scan_session_id:id,page_ids:[...new Set([...(nouvelleLecture?lecture.page_ids||[]:nouvelImport.page_ids||[]),...neuves])]});
  if(nouvelleLecture)ligne.previous_import_id=lecture.id;memoriserBaseImport(ligne,recettes,editions);lignes.imports=[ligne];(conditions.imports||=[]).push({key:ligne.id,absente:true},{index:'recipe_id',valeur:contexte.recipe_id,verifier:rows=>{if(rows.some(r=>r.id!==lecture?.id&&['recette','web'].includes(r.kind)&&IMPORTS_OUVERTS.includes(r.status)))fail('import_ouvert');}});
 }
 const source_batch=edition_id&&docs.length?{operation_id:'sources_'+op,session_id:id,base_session:null}:null;
 const result=await saveBatch(lignes,{conditions,recettes,editions,fichiers,source_batch});
 return{session:result.scan_sessions[0],pages:result.source_pages,docs:result.source_documents,importId,previousImportId:marque.previous_import_id};
}

export async function ajouterPages(files, { edition_id = null, session_id = null, import_id = null, import: nouvelImport = null, recettes = [], editions = [], conditions = {}, intention_id = null, nouvelleLecture = null } = {}) {
  if (import_id && nouvelImport) throw new TypeError('ajouterPages : import_id et import ne se donnent pas ensemble');
  const lectureComplement=import_id?await db.get('imports',import_id):null;
  const sourceComplement=(session_id||lectureComplement?.scan_session_id)?await db.get('scan_sessions',session_id||lectureComplement.scan_session_id):null;
  if(sourceComplement?.source_state||nouvelleLecture||lectureComplement?.kind==='recette'&&(lectureComplement.status==='a_verifier'||lectureComplement.resultat!=null||lectureComplement.reponse_brute!=null)){
    if(import_id&&!lectureComplement)throw new TransitionRefusee('imports',import_id,undefined);
    if(session_id&&lectureComplement?.scan_session_id&&session_id!==lectureComplement.scan_session_id)throw new ErreurSources('source_changed');
    return ajouterComplementRecette(files,{source:sourceComplement,lecture:lectureComplement,nouvelImport,nouvelleLecture,intention_id,recettes,editions,conditions});
  }

  if (nouvelImport && !KINDS_PAGES.includes(nouvelImport.kind)) throw new TypeError('ajouterPages : kind d’import inconnu (' + String(nouvelImport.kind) + ')');
  // Vague finale (Important, « Relire les pages ») : `import.page_ids` = les pages DÉJÀ liées à la recette (celles de sa version courante), placées en
  // tête de la ligne neuve, dans leur ordre ; les photos du geste suivent. Sans elles, une relecture d'une fiche partial ne lisait que la page neuve.
  const deja = nouvelImport?.page_ids ?? [];
  if (!Array.isArray(deja) || deja.some((p) => typeof p !== 'string' || !p)) throw new TypeError('ajouterPages : import.page_ids doit être une liste d’identifiants');
  if (import_id) {
    const lue = await db.get('imports', import_id);
    if (!lue || !ATTENDUS_AJOUT.includes(lue.status)) throw new TransitionRefusee('imports', import_id, lue?.status);
    // P-1 (lot B, ronde 1 de la tâche 6) : une lecture web ne reçoit jamais de pages (page_ids: [] toujours) — refus avant tout octet, comme à l'ouverture.
    if (!KINDS_PAGES.includes(lue.kind)) throw new TypeError('ajouterPages : l’import ' + import_id + ' n’est pas une lecture de pages (' + String(lue.kind) + ')');
    if (session_id && lue.scan_session_id && lue.scan_session_id !== session_id) throw new TypeError('ajouterPages : l’import ' + import_id + ' pointe la séance ' + String(lue.scan_session_id) + ', pas ' + String(session_id));
    session_id = session_id ?? lue.scan_session_id ?? null;
  }
  if (nouvelImport) {
    const deja = await db.get('imports', nouvelImport.id);
    if (deja) throw new TransitionRefusee('imports', nouvelImport.id, deja.status);
    const ouvert = nouvelImport.recipe_id != null ? (await db.byIndex('imports', 'recipe_id', nouvelImport.recipe_id)).find((i) => ['recette','web'].includes(i?.kind)&&IMPORTS_OUVERTS.includes(i?.status)) : null;
    if (ouvert) throw new TransitionRefusee('imports', 'recipe_id=' + String(nouvelImport.recipe_id), ouvert.status);
  }
  const existante = session_id ? await db.get('scan_sessions', session_id) : null;
  const session = existante
    ? { ...existante, page_ids: [...(existante.page_ids || [])], document_ids: [...(existante.document_ids || [])] }
    : { id: newId('ss'), status: 'open', edition_id, started_at: nowIso(), page_ids: [], document_ids: [], device_id: deviceId() };
  const baseSession = JSON.stringify(existante ?? null);
  conditions = Object.fromEntries(Object.entries(conditions || {}).map(([s, cs]) => [s, [...cs]]));
  conditionUnique(conditions, 'scan_sessions', session.id, precedente => ({ key: session.id, fusion: (courante, lecture) => {
    if (JSON.stringify(courante ?? null) !== baseSession) throw new ErreurCycleRecette('source_modifiee');
    return lireCondition(precedente, courante, 'scan_sessions', session.id, lecture);
  } }));
  if (!existante && recettes.length === 1) session.recipe_ids = [recettes[0].recipe_id];
  const docs = [], pages = [], fichiers = [];
  let position = session.page_ids.length;
  for (const file of files) {
    const sha256 = await sha256Hex(file);
    fichiers.push({ sha256, blob: file, meta: { original_filename: file.name } });
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
  // Un complément exclusif reste un seul geste côté serveur, même sous un livre retiré.
  const source_batch = docs.length && editions.some(c => c.recipe_id)
    ? { operation_id: newId('sources'), session_id: session.id, base_session: structuredClone(existante ?? null) } : null;
  const neufs = pages.map((p) => p.id);
  if (import_id) {
    // Le mur (dans la transaction) : la ligne relue porte un statut attendu ET pointe cette séance (ou aucune : elle la reçoit) ; page_ids EN FIN des siens.
    const patch = (c) => {
      if (c.scan_session_id && c.scan_session_id !== session.id) throw new TypeError('ajouterPages : l’import ' + import_id + ' pointe la séance ' + String(c.scan_session_id) + ', pas ' + session.id);
      return { page_ids: [...(c.page_ids || []), ...neufs], scan_session_id: c.scan_session_id ?? session.id };
    };
    await transitionner('imports', import_id, { attendus: ATTENDUS_AJOUT, patch, puts: lignes, recettes, editions, fichiers, conditions, source_batch });
    return { session, pages, docs, importId: import_id };
  }
  if (nouvelImport) {
    // Le mur (dans la transaction, I-10 et I-2) : la ligne n'existe pas, et aucun import ouvert ne porte cette recette (sans recipe_id — un index —, I-2 ne joue pas).
    const { ligne, conditions: ouverture } = nouvelleLigneImport({ id: nouvelImport.id, kind: nouvelImport.kind, recipe_id: nouvelImport.recipe_id, edition_id: nouvelImport.edition_id ?? session.edition_id, scan_session_id: session.id, page_ids: [...new Set([...deja, ...neufs])], device_id: nouvelImport.device_id });
    memoriserBaseImport(ligne, recettes, editions);
    await saveBatch({ ...lignes, imports: [ligne] }, { conditions: reunirConditions(conditions, ouverture), recettes, editions, fichiers, source_batch });
    return { session, pages, docs, importId: ligne.id };
  }
  await saveBatch(lignes, { recettes, editions, fichiers, conditions, source_batch });
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
  history.sort(comparerCuissons);
  return {
    recipe, versions, edition, book, links, history, pages,
    translations: translations.filter((t) => versionIds.has(t.recipe_version_id)),
  };
}

export { newId, nowIso };
