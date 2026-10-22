// L'écran d'import ciblé #/recipes/<id>/importer (lot A « Importer une recette repérée », spec docs/superpowers/specs/2026-10-18-import-cible-design.md :
// § 4.1 entrées, § 4.2 l'écran, § 4.3 extraction et enregistrement, § 4.4 cas et textes ; invariants I-2, I-3, I-4, I-7, I-9, I-10 ; Review Focus 2 et 4).
// Une référence « Repérée dans ton livre » (ou une recette partielle) s'ouvre déjà rattachée : la personne ajoute ses pages (persistées AVANT tout
// appel, dans le journal `imports`), les remet dans l'ordre, pose la photo du plat si le livre en a une, puis « Extraire et enregistrer ».
// Tout ce que l'écran écrit passe par repo.transitionner (une seule primitive, I-10) ; rien n'est inventé ; la sortie du modèle est une DONNÉE
// HOSTILE (validée par validateParsedRecipe, revalidée quand elle revient du journal, rendue en nœuds texte). L'état du VOL vit au niveau du
// module (I-7 : un seul import en vol par document, tenu par DOCUMENT_ID) ; tout le reste est relu dans la base à chaque redessin.
// Dépendances injectables { repo, navigate, toast, fetch, pickFiles, maintenant, battementMs, veilleMs } : la suite n'ouvre ni sélecteur ni réseau.
import { el, toast as toastDom, pickFiles as pickDom, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate as naviguerDom } from '../core/router.js';
import { logError } from '../core/log.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { sha256Hex } from '../core/hash.js';
import { preparerPhotoLocale } from '../core/image.js';
import { TransitionRefusee } from '../core/db.js';
import { typeAffichage, displayUrl } from '../sync/mime.js';
import * as repoModule from '../model/repo.js';
import { PasserelleProvider, extraireRecette, validateParsedRecipe, ErreurExtraction, pagePourEnvoi, MAX_TOKENS_EXTRACTION } from '../domain/llm.js';
import { discordance, deplacerPage, retirerPage, fabriquerExtraction, pagesNonRelues, RAISONS_ECHEC, importOuvert, dateReception, cleLecture, modeleBorne, issueDUneSeance, statutSeanceApres } from '../domain/import-cible.js';
import { executerIndex, revaliderResultatIndex } from '../domain/table-matieres.js';
import { getConvention } from '../domain/units.js';
import { currentVersion } from '../domain/search.js';
import { section, sessionAssistant, carteConnexion, texteEchecAssistant, TEXTE_CONNEXION } from './components.js';
import { demarrerConnexion } from './settings.js';
import { messageErreurImage } from '../core/image.js';
import { DOCUMENT_ID, BATTEMENT_MS, prendreVol, libererVol as libererTenue, volEnCours, volTenu, reinitialiserVol } from './vol.js';
import { renderImportWeb, texteEchecLecture } from './import-web.js'; // sens unique (D-B13) : import-web.js n'importe jamais ce module

// --- État du module (I-7) ----------------------------------------------------------------------------------------------------------------------
// Le vol (DOCUMENT_ID, BATTEMENT_MS, la tenue) vit dans ./vol.js depuis le lot B (D-B13) : UN vol par document, partagé avec la lecture de page
// web ; ré-exportés ici pour que l'API de l'écran ne change pas (tests/import-cible.js).
// Le battement du vol (spec § 3.1) : toutes les 15 s, une ligne interne de sync_state est réécrite (repo.battre, origine device : jamais en file, la
// ligne imports ne bouge pas — vague finale) ; au démarrage, une ligne en_cours dont le battement a plus de 90 s passe interrompu (tâche 6).
export { DOCUMENT_ID, BATTEMENT_MS, volEnCours };
const ATTENDUS_PAGES = ['a_lancer', 'a_verifier', 'echec']; // les statuts qui acceptent des pages et une photo (spec § 3.6)
const horloge = () => new Date().toISOString();
const vues = new Set(); // { root, redessiner, majEnLigne } : les instances de l'écran, purgées par isConnected
// En ligne / hors ligne (spec § 4.2.4) : le bouton suit les événements de la fenêtre, pas seulement navigator.onLine au rendu.
let enLigneFlag = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { enLigneFlag = true; majEnLigneToutes(); });
  window.addEventListener('offline', () => { enLigneFlag = false; majEnLigneToutes(); });
}
export const estEnLigne = () => enLigneFlag; // l'état réseau que le vol lit (lot C : le panneau d'index ne pose pas la question de la relecture hors ligne)
// Vague finale du lot C (constat 1) : les abonnés au vol de CE document — le panneau d'index (src/ui/import.js) : une instance recréée pendant le vol de sa
// ligne, ou ouverte pendant un vol lancé hors d'elle, se redessine à la pose et à la fin du vol (jamais figée sur « Lecture des pages… »). Appelés à
// chaque notifier() (prise du vol, ligne posée, fin, « Annuler », tenirVol / libererVol) ; l'abonné gère lui-même son démontage. Rend le désabonnement.
// Les vols de la lecture web (src/ui/import-web.js) ne passent pas par ce notifier (dette « notification croisée » du lot B, inchangée).
const ecouteurs = new Set();
export function ecouterVol(fn) { ecouteurs.add(fn); return () => { ecouteurs.delete(fn); }; }
export function reinitialiserImportCible() { reinitialiserVol(); vues.clear(); ecouteurs.clear(); enLigneFlag = typeof navigator === 'undefined' ? true : navigator.onLine !== false; } // tests seulement
function notifier() {
  for (const v of [...vues]) { if (!v.root.isConnected) { vues.delete(v); continue; } v.redessiner(); }
  for (const fn of [...ecouteurs]) { try { fn(); } catch (e) { logError('import_cible.ecouteur', { error: e }); } }
}
// Vague finale (I-7 dans les deux sens) : une lecture HORS journal (« Extraire » de « Corriger », recette existante) tient le vol du document le temps
// de son appel — sans ligne (importId null : aucun « Annuler » dans la section), mais lancerExtraction la voit et rend vol_tenu. Rend le jeton, ou
// null quand un vol est déjà tenu ; libererVol(jeton) en finally. Lot B (D-B13) : le jeton est une tenue de ./vol.js — LE vol du document, celui
// d'une lecture web compris (une lecture web tenue refuse tenirVol, et l'inverse).
export function tenirVol() { const jeton = { importId: null, controller: new AbortController(), repo: repoModule }; if (!prendreVol(jeton)) return null; notifier(); return jeton; }
export function libererVol(jeton) { if (jeton && volTenu(jeton.importId) === jeton) { libererTenue(jeton); notifier(); } }
function majEnLigneToutes() { for (const v of [...vues]) { if (!v.root.isConnected) { vues.delete(v); continue; } v.majEnLigne(); } }

const refus = (raison) => ({ issue: 'refuse', raison });
// La réponse brute vient d'extraireRecette DÉJÀ coupée à REPONSE_BRUTE_MAX (contexteDe, llm.js), sur une réponse comme sur une ErreurExtraction :
// l'écran l'écrit telle quelle (T4-R1 : une seule borne, un seul lieu) ; pas une chaîne → null.
const brute = (s) => (typeof s === 'string' ? s : null);
// La raison d'un échec de l'appel : celle d'une ErreurExtraction (coupe, illisible, hors_bornes, vide), sinon le message de l'Error de la
// passerelle quand c'est une raison connue (le classement des écrans, echecDomaine) ; tout le reste est `interne` — jamais un texte libre.
const raisonDe = (e) => { const r = e instanceof ErreurExtraction ? e.raison : (typeof e?.message === 'string' ? e.message : ''); return RAISONS_ECHEC.includes(r) ? r : 'interne'; };
const extraDe = (e) => ({ ...(Number.isInteger(e?.quota) || e?.quota === null ? { quota: e.quota } : {}), ...(e?.trop_lourd === true ? { trop_lourd: true } : {}) });
const estRefus = (e) => e instanceof TransitionRefusee;
// « Rattacher » (D-6) et « Remplacer » (I-5) valent pour LA lecture pour laquelle la question a été POSÉE : la ligne, le départ de son vol et son
// résultat (etat.cleQuestion). Une lecture arrivée d'un autre onglet entre-temps (même id, même statut a_verifier) a une autre clé → la réponse est
// ignorée et la question redemandée pour la nouvelle lecture (T4-R1, puis T4-R2 : jamais la clé de la ligne RELUE au clic). Exportée (tâche 6, ronde 1) :
// la clôture d'une lecture par l'éditeur ou le panneau d'index, « Ignorer » de la section et la revalidation ne valent que pour LA lecture affichée.
export { cleLecture }; // définie dans src/domain/import-cible.js depuis le lot B (la variante web la partage sans importer cet écran)
// Deux champs relus du journal, bornés avant d'entrer dans la fiche (T4-R1) : le modèle ≤ 80 points de code (la borne de PasserelleProvider), la
// photo du plat = une empreinte hexadécimale de 64 (la clé de files) ; tout le reste vaut null. Une seule définition du modèle borné (ronde 1 de la
// tâche 6 : l'éditeur et le panneau la partagent ; une chaîne vide vaut null) — dans le domaine depuis le lot B (modeleBorne, la variante web la partage).
const photoBornee = (L) => (typeof L?.photo_sha256 === 'string' && /^[0-9a-f]{64}$/.test(L.photo_sha256) ? { sha256: L.photo_sha256, origin: L.photo_origin ?? null } : null);
// La question à poser avant d'écrire (pure) : la discordance tant que « Rattacher » n'a pas été répondu pour CETTE lecture, puis « Remplacer par
// cette lecture ? » (I-5) tant qu'elle n'a pas de réponse ; null = écrire.
const questionAPoser = ({ ok, rattachee, remplacement, remplacer }) => (!ok && !rattachee ? 'discordance' : (remplacement && remplacer === null ? 'remplacer' : null));

// Les images qui PARTENT, dans l'ordre de page_ids (seule source de vérité de l'ordre), réduites par pagePourEnvoi (F-3), et les identifiants des
// pages EFFECTIVEMENT envoyées, dans le même ordre (lot C, D-C21 : la photo n de la réponse est pageIds[n − 1]). Une page absente est écartée des
// deux (pointeur souple, § 3.1) ; une page dont les octets ne sont pas sur cet appareil fait refuser l'envoi (rien n'est lu à moitié). Ronde 1 de la
// tâche 1 du lot C : un identifiant DOUBLÉ (page_ids est une donnée de synchro ou d'archive) ne part qu'une fois, à sa première place.
async function imagesDe(repo, pageIds) {
  const images = [];
  const envoyees = [];
  for (const id of new Set(pageIds)) {
    const page = await repo.get('source_pages', id);
    if (!page?.sha256) continue;
    const fichier = await repo.getFile(page.sha256);
    if (!(fichier?.blob instanceof Blob)) { const e = new Error('octets_absents'); e.code = 'octets_absents'; throw e; }
    images.push(await pagePourEnvoi(fichier.blob));
    envoyees.push(id);
  }
  return { images, pageIds: envoyees };
}

// --- Le vol (spec § 4.3.1-2, I-3, I-4, I-7 ; exporté pour la section « Imports », tâche 6) -------------------------------------------------------
// Gardes dans l'ordre : vol tenu par ce document, import inconnu, hors ligne, session, au moins une page avec ses octets ; puis la transition
// a_lancer | echec → en_cours (started_at, document_id_vol, battement_at) ; `appels + 1` AU MOMENT où le fetch part (pas avant) ; UN appel ;
// la réponse validée est écrite dans le journal (a_verifier) AVANT tout rendu ou toute écriture de recette (I-3). Rend { issue, raison } :
// 'refuse' (vol_tenu | inconnu | hors_ligne | non_connecte | sans_page | image | octets_absents | transition), 'echec' (raison § 4.4),
// 'a_verifier'. Ne lève jamais vers l'écran pour une raison attendue. `vol` est libéré en finally, quoi qu'il arrive.
// Tâche 6 : le même vol lit aussi une ligne `kind: 'index'` (panneau d'index, « Relancer » de la section « Imports ») — lot C : la table des
// matières par photo (executerIndex), résultat de forme C ; tout le reste (gardes, battement, appels, signal, Annuler, I-3, I-4) est commun aux deux sortes.
// Tâche 6, ronde 1 — `lecture` : une lecture SANS référence (éditeur, panneau d'index : { kind, importId, pageIds, editionId, sessionId }). Les gardes
// portent sur ses `pageIds` AVANT TOUTE ÉCRITURE (spec § 4.4 : hors ligne, session absente → journal : rien ; de même pour un vol tenu, des octets
// absents, une image refusée) ; ensuite seulement, la ligne `importId` est reprise — encore a_lancer | a_verifier | echec, de cette sorte et sans
// référence, relu dans la transaction — PAR la transition de départ (page_ids remises, l'ancien résultat effacé au départ du vol, jamais avant) ; à
// défaut, une ligne a_lancer est ouverte puis part. Le résultat porte alors `importId` : la ligne qui a volé (null si rien n'a été écrit).
// Lot C (D-C21, N-1) : la primitive est PARTAGÉE. lancerVol(importId, executer, options) fait TOUT le vol ci-dessus — mêmes gardes avant écriture, même
// `lecture`, même battement, mêmes écritures — et confie l'appel SEUL à `executer({ provider, images, pageIds, signal, kind })`, qui rend { resultat,
// texteBrut, modele } ou lève (ErreurExtraction, ou l'Error de la passerelle) ; `pageIds` = les pages EFFECTIVEMENT envoyées (imagesDe), dans l'ordre des
// images. lancerExtraction garde sa signature et son comportement : le vol avec l'exécutant de la sorte de la ligne.
// Lot D (D-D14, S-3) : `accepte(ligne)` — une liste BLANCHE de sortes, évaluée après la relecture de la ligne et avant toute écriture (refus `sorte`) ;
// `attendus` — les statuts de départ admis (défaut `['a_lancer', 'echec']`, lot A inchangé).
export async function lancerVol(importId, executer, options = {}) {
  const suivi = { importId: null };
  const r = await volUnique(importId, executer, options, suivi);
  return options.lecture ? { ...r, importId: suivi.importId } : r;
}
// Les sortes que lancerExtraction LIT (lot D, D-D14 ; liste BLANCHE) : une recette, et un index tant que C le lit par ce vol (executerExtraction, « Relancer »
// de la section Imports). Toute autre sorte — classement, couverture (lot E), web (lot B), une sorte future — est refusée `sorte`, rien d'écrit.
export const SORTES_EXTRACTION = Object.freeze(['recette', 'index']);
export async function lancerExtraction(importId, options = {}) {
  return lancerVol(importId, executerExtraction, { ...options, accepte: (l) => SORTES_EXTRACTION.includes(l?.kind) }); // lot D : attendus transmis par options
}
// La ligne d'une lecture sans référence, écrite seulement APRÈS les gardes du vol (ronde 1) : reprise dans la transition de départ (a_verifier → a_lancer
// → en_cours en une transaction, § 3.1), sinon ouverte (repo.ouvrirImport, le mur conditionné de la première photo) puis partie.
// Lot C, ronde 1 de la tâche 4 (T4-R2) : `lecture.cle` = la clé (cleLecture) de la lecture que l'écran MONTRE, ou null s'il n'en montre aucune ; une ligne
// a_verifier n'est reprise que si elle porte CETTE lecture (vérifié dans la transaction) ; une relecture CONFIRMÉE (clé posée) refusée ne part jamais sur
// une ligne neuve : la question valait pour cette lecture-là (refus `transition`, l'écran relit). Sans `cle` (l'éditeur), la règle d'avant.
async function partirLecture(repo, lecture, pageIds, enVol, suivi) {
  const { kind, importId } = lecture;
  if (importId) {
    const garde = Object.hasOwn(lecture, 'cle');
    let autreLecture = false;
    const reprise = (c) => {
      if (!sansReference(c, kind)) throw new TransitionRefusee('imports', importId, c.status);
      if (garde && c.status === 'a_verifier' && cleLecture(c) !== lecture.cle) { autreLecture = true; throw new TransitionRefusee('imports', importId, c.status); }
      return { ...enVol, page_ids: [...pageIds], resultat: null };
    };
    try { await repo.transitionner('imports', importId, { attendus: ['a_lancer', 'a_verifier', 'echec'], patch: reprise }); suivi.importId = importId; return importId; }
    catch (e) {
      if (!estRefus(e) || autreLecture || typeof lecture.cle === 'string') throw e;
      // Vague finale du lot C (constat 12 ; spec § 11 : « le second onglet qui tape Lire sur la même ligne est refusé ») : le panneau (`cle` posée, même
      // nulle) ne part sur une ligne neuve que si la sienne est TERMINÉE ou absente — relue en_cours (un autre onglet vient de la relancer) ou encore
      // ouverte d'une autre façon, le refus remonte (`transition`, l'écran relit) : jamais deux lignes ni deux appels comptés pour une séance.
      if (garde && importOuvert(await repo.get('imports', importId))) throw e;
    } // terminée, d'une autre sorte ou ciblée (l'éditeur, sans `cle`) : une ligne neuve
  }
  const ligne = await repo.ouvrirImport({ kind, edition_id: lecture.editionId ?? null, scan_session_id: lecture.sessionId ?? null, page_ids: [...pageIds] });
  suivi.importId = ligne.id;
  await repo.transitionner('imports', ligne.id, { attendus: ['a_lancer'], patch: enVol });
  return ligne.id;
}
// Lot C, ronde 1 de la tâche 4 : `signal` (facultatif) = l'« Annuler » de l'appelant AVANT que la tenue ait une ligne (gardes : session, réduction des
// photos). Levé pendant les gardes → refus `annule`, rien n'est parti ni écrit ; levé après le départ → l'appel est abandonné (comme annulerVol).
async function volUnique(importId, executer, { ctx, repo = repoModule, fetch: fetchInjecte = undefined, maintenant = horloge, enLigne = () => enLigneFlag, battementMs = BATTEMENT_MS, lecture = null, signal = null, attendus = ['a_lancer', 'echec'], accepte = null } = {}, suivi) {
  const tenue = { importId: lecture ? null : importId, controller: new AbortController(), repo };
  if (!prendreVol(tenue)) return refus('vol_tenu'); // AVANT tout await : une seconde tape (ou une lecture web) pendant les gardes voit le vol
  notifier(); // vague finale (m2) : l'écran ciblé fige ses pages dès la pose du vol (la réduction des pages peut durer), pas seulement à en_cours
  const liberer = () => libererTenue(tenue);
  const abandon = () => tenue.controller.abort();
  signal?.addEventListener?.('abort', abandon, { once: true });
  const annule = () => !!signal?.aborted;
  let battement = null;
  try {
    if (annule()) { liberer(); return refus('annule'); }
    let kind, pageIds;
    if (lecture) { kind = lecture.kind; pageIds = Array.isArray(lecture.pageIds) ? lecture.pageIds : []; } // rien n'est lu ni écrit avant les gardes
    else {
      const ligne = await repo.get('imports', importId);
      if (!ligne) { liberer(); return refus('inconnu'); }
      kind = ligne.kind; pageIds = Array.isArray(ligne.page_ids) ? ligne.page_ids : [];
      if (typeof accepte === 'function' && !accepte(ligne)) { liberer(); return refus('sorte'); } // lot D (D-D14) : la garde de sorte, APRÈS la relecture, AVANT toute écriture
    }
    if (lecture && typeof accepte === 'function' && !accepte({ kind })) { liberer(); return refus('sorte'); }
    if (!enLigne()) { liberer(); return refus('hors_ligne'); }
    const session = await sessionAssistant(ctx);
    if (annule()) { liberer(); return refus('annule'); }
    if (!session) { liberer(); return refus('non_connecte'); }
    if (!pageIds.length) { liberer(); return refus('sans_page'); }
    let envoi; // lot C : { images, pageIds } — les pages EFFECTIVEMENT envoyées, dans l'ordre des images
    try { envoi = await imagesDe(repo, pageIds); }
    catch (e) { liberer(); return { issue: 'refuse', raison: e?.code === 'octets_absents' ? 'octets_absents' : 'image', code: e?.code ?? null }; }
    if (annule()) { liberer(); return refus('annule'); } // dernier point avant la transition de départ : rien n'est encore écrit
    if (!envoi.images.length) { liberer(); return refus('sans_page'); }
    const depart = maintenant();
    // Lot C (F-18) : au départ d'un INDEX — reprise, « Relancer » de la section Imports, ligne neuve —, la lecture remplacée est effacée.
    // Lot D, ronde 1 de T2 (comme R-B-8 pour le web) : un CLASSEMENT relancé ici — une ligne venue d'un autre appareil (état 5 du panneau) — devient celle
    // de CET appareil, dont le battement est ici ; sinon son appareil d'origine la jugeait à 90 s sur battement_at et l'interrompait pendant le vol.
    const ici = kind === 'classement' && typeof repo.deviceId === 'function' ? repo.deviceId() : null;
    const enVol = { status: 'en_cours', started_at: depart, document_id_vol: DOCUMENT_ID, battement_at: depart, erreur: null, ...(ici ? { device_id: ici } : {}), ...(kind === 'index' ? { resultat: null, reponse_brute: null, model: null, duree_ms: null, finished_at: null, ordre_applique_at: null } : {}) };
    // Vague finale (m2) : le départ vaut pour les pages LUES — une page retirée, ajoutée ou déplacée pendant la réduction (autre geste, autre onglet)
    // refuse le départ (rien ne part, le redessin montre la ligne) : jamais une page envoyée qui ne serait pas liée, ni une page liée jamais lue.
    const memesPages = (c) => { if (JSON.stringify(Array.isArray(c.page_ids) ? c.page_ids : []) !== JSON.stringify(pageIds)) throw new TransitionRefusee('imports', importId, c.status); return enVol; };
    try {
      if (lecture) importId = await partirLecture(repo, lecture, pageIds, enVol, suivi);
      else await repo.transitionner('imports', importId, { attendus, patch: memesPages }); // lot D (S-3) : lireLeLot passe ['a_lancer'] — jamais une ligne passée echec ; memesPages (lot A, m2) gardé
    } catch (e) {
      liberer();
      if (estRefus(e)) return { issue: 'refuse', raison: 'transition', statut: e.statut }; // un autre onglet a enregistré ou ignoré entre-temps (I-10)
      throw e;
    }
    tenue.importId = importId;
    notifier();
    // Battement (spec § 3.1, m2 ; vague finale) : HORS de la ligne synchronisée — repo.battre écrit une ligne interne de sync_state (origine device :
    // jamais en file, aucun `change`, aucune passe de synchro, la ligne imports ne bouge pas) ; effacée en finally (repo.oublierBattement).
    battement = setInterval(() => { repo.battre(importId, maintenant()).catch(() => {}); }, battementMs);
    // `appels + 1` au départ du fetch (spec § 4.3.1) : écrit juste avant l'appel réseau, par une fonction LIBRE (jamais objet.fetch : Illegal invocation).
    const fetchReel = fetchInjecte ?? globalThis.fetch;
    const fetchCompte = async (url, options) => {
      try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: (c) => ({ appels: (Number.isInteger(c.appels) ? c.appels : 0) + 1 }) }); }
      catch (e) { if (!estRefus(e)) logError('import_cible.appels', { error: e, id: importId }); }
      return fetchReel(url, options);
    };
    const provider = new PasserelleProvider({}, { session, fetch: fetchCompte });
    const t0 = Date.now();
    let reponse;
    try {
      reponse = await executer({ provider, images: envoi.images, pageIds: envoi.pageIds, signal: tenue.controller.signal, kind }); // lot C : l'appel est celui de l'exécutant
    } catch (e) {
      // Échec de l'appel ou refus de la lecture : en_cours → echec(raison) ; une ErreurExtraction garde la réponse brute (diagnostic, bornée).
      // Un `annule` arrive aussi par annulerVol, qui écrit la même chose : la première écriture gagne, la seconde est refusée sans bruit.
      const raison = raisonDe(e);
      const patch = { status: 'echec', erreur: { raison, extra: extraDe(e) }, document_id_vol: null, duree_ms: Date.now() - t0, ...(typeof e?.texteBrut === 'string' ? { reponse_brute: e.texteBrut } : {}), ...(typeof e?.modele === 'string' ? { model: e.modele } : {}) };
      try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch }); }
      catch (err) { if (!estRefus(err)) logError('import_cible.echec', { error: err, id: importId }); }
      return { issue: 'echec', raison };
    }
    const duree_ms = Date.now() - t0;
    // I-3 : le résultat vit dans le journal AVANT tout rendu ou toute écriture de recette. Patch-OBJET (son statut est lu par les espions des tests).
    try {
      await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { status: 'a_verifier', resultat: reponse.resultat, reponse_brute: brute(reponse.texteBrut), model: reponse.modele ?? null, duree_ms, document_id_vol: null, erreur: null } });
    } catch (e) {
      if (estRefus(e)) {
        // Réponse arrivée APRÈS « Annuler » ou un interrompu (spec § 3.1, Review Focus 4) : echec → a_verifier n'existe pas ; reponse_brute seule
        // est gardée (diagnostic), rien n'est écrit sur la recette, l'état reste echec.
        try { await repo.transitionner('imports', importId, { attendus: ['echec'], patch: { reponse_brute: brute(reponse.texteBrut) } }); }
        catch (err) { if (!estRefus(err)) logError('import_cible.tardive', { error: err, id: importId }); }
        return { issue: 'echec', raison: 'annule' };
      }
      // Écriture locale impossible après une réponse (spec § 4.3.2) : tentative echec(incertain) ; si elle échoue aussi, la ligne reste en_cours et
      // deviendra interrompu au démarrage (même phrase, I-4) — c'est ici seulement que l'incident est journalisé.
      try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { status: 'echec', erreur: { raison: 'incertain', extra: {} }, document_id_vol: null, duree_ms } }); }
      catch (err) { logError('import_cible.incertain', { error: err, id: importId }); return { issue: 'echec', raison: 'incertain', ecrit: false }; }
      return { issue: 'echec', raison: 'incertain' };
    }
    return { issue: 'a_verifier' };
  } finally {
    signal?.removeEventListener?.('abort', abandon);
    if (battement) { clearInterval(battement); repo.oublierBattement(importId).catch(() => {}); }
    liberer();
    notifier();
  }
}

// Les exécutants (lot C, D-C21). Une recette : extraireRecette, 6 000 jetons, le résultat est la recette validée. Un index (panneau, « Relancer » de la
// section Imports) : la table des matières par photo (executerIndex, src/domain/table-matieres.js). Une seule primitive de vol pour les deux sortes.
const executerRecette = async ({ provider, images, signal }) => { const r = await extraireRecette(provider, images, { signal, maxTokens: MAX_TOKENS_EXTRACTION }); return { resultat: r.recette, texteBrut: r.texteBrut, modele: r.modele }; };
const executerExtraction = (args) => (args.kind === 'index' ? executerIndex(args) : executerRecette(args));

// « Annuler » (spec § 3.1, § 4.4, Review Focus 4) : seulement si CE document tient le vol de cet import — le fetch est abandonné (le serveur
// abandonne l'amont, lot passerelle F-5) et la ligne passe en_cours → echec(annule). Sinon rien n'est fait et false est rendu.
export async function annulerVol(importId) {
  const tenue = volTenu(importId);
  if (!tenue) return false;
  const { controller, repo } = tenue;
  controller.abort();
  try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { status: 'echec', erreur: { raison: 'annule', extra: {} }, document_id_vol: null } }); }
  catch (e) { if (!estRefus(e)) logError('import_cible.annuler', { error: e, id: importId }); }
  notifier();
  return true;
}

// Le texte d'une ligne echec (spec § 4.4) : les raisons de l'extraction et du journal ont leur phrase ici ; les raisons de la passerelle gardent
// les textes existants (texteEchecAssistant : refus en clair avec son nombre, texte générique + « Code : … » sinon). I-4 : interrompu, annule et
// incertain disent la même phrase. Rend { texte, code } ; `code` n'est posé que pour illisible / hors_bornes. Exportée (tâche 6) : la section
// « Imports », l'éditeur et le panneau d'index disent la même phrase pour la même raison.
export function texteEchec(erreur) {
  const raison = typeof erreur?.raison === 'string' ? erreur.raison : 'interne';
  const extra = erreur?.extra && typeof erreur.extra === 'object' ? erreur.extra : {};
  if (raison === 'annule') return { texte: t('Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.'), code: null };
  if (raison === 'interrompu') return { texte: t('La lecture a été interrompue. L’appel a peut-être été compté ; relancer en coûtera un autre.'), code: null };
  if (raison === 'incertain') return { texte: t('L’appel a peut-être été compté ; relancer en coûtera un autre.'), code: null };
  if (raison === 'coupe') return { texte: t('La lecture a été coupée : essaie avec moins de pages.'), code: null };
  if (raison === 'illisible' || raison === 'hors_bornes') return { texte: t('L’assistant n’a pas répondu lisiblement. Réessaie.'), code: t('Code : {c}', { c: raison }) };
  if (raison === 'vide') return { texte: t('Aucun ingrédient ni étape lus sur ces pages.'), code: null };
  return { texte: texteEchecAssistant({ message: raison, quota: extra.quota, trop_lourd: extra.trop_lourd }), code: null };
}
// La même phrase en une ligne (le code à la suite) : la section « Imports » et l'éditeur (ronde 1 : une définition). Le panneau d'index dit texteEchecIndex
// (src/ui/table-matieres.js, lot C) : ses phrases `coupe` et `vide`, et texteEchec pour tout le reste.
export const phraseEchec = (erreur) => { const { texte, code } = texteEchec(erreur); return code ? `${texte} ${code}` : texte; };

// Ce qu'un vol REFUSÉ dit (rien n'est parti, rien n'est écrit) : une définition pour la section « Imports », l'éditeur et le panneau d'index (tâche 6,
// ronde 1). null pour un refus sans phrase : inconnu et transition (la ligne a changé ailleurs, le redessin le montre), sans_page (« Relancer » n'est
// pas offert sans page). Une image refusée dit le texte de l'image (T4-R1) ; l'éditeur et le panneau gardent leur « Code : … » (F-3 du lot passerelle).
export function texteRefus(r) {
  if (r?.raison === 'vol_tenu') return t('Une lecture est déjà en cours : annule-la d’abord.');
  if (r?.raison === 'hors_ligne') return t('Tu es hors ligne.');
  if (r?.raison === 'non_connecte') return t(TEXTE_CONNEXION);
  if (r?.raison === 'octets_absents') return t('Les photos de cette recette ne sont pas sur cet appareil.');
  if (r?.raison === 'image') return messageErreurImage({ code: r.code });
  if (r?.raison === 'interdit') return texteEchecLecture({ raison: 'interdit' }).texte; // lot B : « Réessayer » d'un signet relu hors https, rien n'est parti
  return null;
}

// --- Lectures SANS référence écrites dans le journal (spec § 4.6, tâche 6 ; ronde 1 : à côté du vol, hors du module de la séance de scan) --------------
// « Extraire avec l'assistant IA » de l'éditeur (kind recette, recipe_id null : « Regrouper en recette ») et « Lire avec l'assistant IA » du panneau
// d'index (kind index) passent par le journal, comme l'écran ciblé : la section « Imports » les montre, les reprend (?import=), les relance ou les
// annule. Le résultat d'une ligne est REVALIDÉ avant tout usage (I-1), par sorte ; le modèle relu est borné (80 points de code).
const VALIDEURS = { recette: (r) => validateParsedRecipe(r), index: (r, L) => revaliderResultatIndex(r, L?.page_ids) }; // lot C : un index est de forme C, relu sur les pages de SA ligne
const validerSelon = (kind, resultat, ligne = null) => { try { return Object.hasOwn(VALIDEURS, kind) ? VALIDEURS[kind](resultat, ligne) : null; } catch { return null; } };
const sansReference = (ligne, kind) => !!ligne && ligne.kind === kind && ligne.recipe_id == null; // une ligne CIBLÉE se reprend par son écran

// a_verifier → echec(illisible), résultat effacé (T4-R1) — pour LA lecture relue et jugée illisible, jamais pour une autre arrivée entre-temps (ronde 1 :
// conditionnée à sa clé, T4-R2). Rend la ligne écrite, ou null quand la ligne a changé (rien n'est écrit) ; une autre erreur remonte.
async function marquerIllisible(repo, L) {
  const cle = cleLecture(L);
  const patch = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return { status: 'echec', erreur: { raison: 'illisible', extra: {} }, resultat: null }; };
  try { return await repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch }); }
  catch (e) { if (!estRefus(e)) throw e; return null; }
}

// Une ligne relue pour un écran qui la REPREND (?import=) : seulement une ligne de cette sorte, sans référence. a_verifier → son résultat revalidé ;
// hostile → echec(illisible) (marquerIllisible), rien n'atteint l'écran ; une lecture arrivée entre la lecture et la transaction est relue une fois.
// Rend { ligne, resultat, modele } (resultat nul hors d'un a_verifier valide), ou null (absente, d'une autre sorte, ciblée).
export async function relireDuJournal(importId, kind, { repo = repoModule } = {}, essai = 0) {
  if (typeof importId !== 'string' || !importId) return null;
  const ligne = await repo.get('imports', importId);
  if (!sansReference(ligne, kind)) return null;
  if (ligne.status !== 'a_verifier') return { ligne, resultat: null, modele: null };
  const resultat = validerSelon(kind, ligne.resultat, ligne);
  if (resultat) return { ligne, resultat, modele: modeleBorne(ligne.model) };
  const ecrite = await marquerIllisible(repo, ligne);
  if (ecrite) return { ligne: ecrite, resultat: null, modele: null };
  return essai < 1 ? relireDuJournal(importId, kind, { repo }, essai + 1) : { ligne: (await repo.get('imports', importId)) ?? ligne, resultat: null, modele: null };
}

// Une lecture par l'assistant écrite dans le journal : LE vol de l'écran ciblé (un seul par document, battement, appels comptés, signal, « Annuler »
// depuis la section), dont les gardes passent AVANT toute écriture (ronde 1) ; la réponse validée est écrite dans le journal AVANT d'atteindre l'écran
// (I-3), qui la relit et la REVALIDE (I-1). Rend { importId, resultat, modele, cle, texte, connecte } : `resultat` non nul = la lecture à poser et `cle`
// sa clé (la clôture ne vaudra que pour elle, T4-R2) ; sinon `texte` dit pourquoi ; `connecte` faux = la session manquait au clic. Un refus rend
// l'`importId` demandé : la ligne n'a pas bougé.
export async function lireDansLeJournal({ kind, importId = null, pageIds = [], editionId = null, sessionId = null, ctx, repo = repoModule }) {
  const r = await lancerExtraction(importId, { ctx, repo, lecture: { kind, importId, pageIds, editionId, sessionId } });
  const rien = (id, texte, extra = {}) => ({ importId: id, resultat: null, modele: null, cle: null, texte, connecte: true, ...extra });
  if (r.issue === 'a_verifier') {
    const relue = await relireDuJournal(r.importId, kind, { repo });
    return relue?.resultat ? { importId: r.importId, resultat: relue.resultat, modele: relue.modele, cle: cleLecture(relue.ligne), texte: null, connecte: true } : rien(r.importId, phraseEchec(relue?.ligne?.erreur ?? { raison: 'illisible' }));
  }
  if (r.issue === 'echec') return rien(r.importId, phraseEchec((await repo.get('imports', r.importId))?.erreur ?? { raison: r.raison }));
  // Refusé. Une page indécodable garde ici le texte de F-3 (lot passerelle : « … Code : indecodable ») ; les autres refus disent texteRefus.
  const texte = r.raison === 'image' ? texteEchecAssistant({ message: r.code || 'image' }) : (texteRefus(r) ?? texteEchecAssistant({ message: r.raison }));
  return rien(r.importId ?? importId, texte, { connecte: r.raison !== 'non_connecte' });
}

// --- L'écran ------------------------------------------------------------------------------------------------------------------------------------
export async function renderImportCible(params, query, ctx, deps = {}) {
  const { repo = repoModule, navigate = naviguerDom, toast = toastDom, fetch: fetchInjecte = undefined, pickFiles = pickDom, maintenant = horloge, battementMs = BATTEMENT_MS, veilleMs = repoModule.BATTEMENT_MORT_MS + 1000 } = deps;
  const recipe = ctx?.recipesById?.get(params?.id);
  // Lot B (§ 4.1, D-B13) : une fiche qui porte une adresse (signet, recette lue sur le web) s'ouvre dans la variante web de l'écran — mêmes gestes
  // injectés. Une fiche disponible à adresse y est admise (relecture, D-B18).
  if (typeof recipe?.source_url === 'string' && recipe.source_url) return renderImportWeb(params, query, ctx, deps);
  const root = el('div', null);
  // ligne : l'import NON TERMINÉ de cette recette (un seul, I-2) ; pages : ses source_pages par id ; question : 'discordance' | 'remplacer' | null ;
  // cleQuestion : la clé (cleLecture) de LA lecture pour laquelle `question` a été posée (T4-R2 : toute réponse s'y rapporte) ; rattache : la clé de
  // la lecture pour laquelle « Rattacher » a été répondu, sinon null ; verdict : la discordance calculée par decider() ; focus : le bouton à focaliser
  // après un déplacement ; occupe : une écriture est en cours (aucune double pose) ; ecriteMain : la question « Remplacer ? » vient d'une version écrite à
  // la main (I-5), et non de la seule couverture des pages (ronde finale 2) — la phrase qui le dit n'est montrée que dans ce cas.
  const etat = { ligne: null, pages: new Map(), question: null, cleQuestion: null, rattache: null, verdict: null, focus: null, occupe: false, ecriteMain: false, seanceRefusee: null };
  const oublierQuestion = () => { etat.question = null; etat.cleQuestion = null; etat.rattache = null; etat.verdict = null; etat.ecriteMain = false; };
  root.etatRoute = () => ({ importId: etat.ligne?.id ?? null, status: etat.ligne?.status ?? null, pageIds: [...(Array.isArray(etat.ligne?.page_ids) ? etat.ligne.page_ids : [])], vol: !!etat.ligne && volEnCours()?.importId === etat.ligne.id, discordance: etat.verdict });
  if (!recipe) { root.append(el('div', { class: 'card' }, t('Recette introuvable.'))); return root; }
  // D-11 : une recette qui a déjà son texte (et pas d'adresse : voir plus haut) n'a pas d'entrée ici — le dire, revenir à la fiche.
  if (recipe.availability === 'available') { toast(t('Cette recette a déjà son texte.')); navigate(`/recipes/${encodeURIComponent(recipe.id)}`); return root; }

  const edition = recipe.edition_id ? ctx.editionsById?.get(recipe.edition_id) ?? null : null;
  const book = edition ? ctx.booksById?.get(edition.book_id) ?? null : null;
  const connecter = () => demarrerConnexion(ctx?.sync?.auth);
  const urls = new Map(); // sha256 → URL blob: de cette instance (révoquées par app.js au changement de route)
  let session = await sessionAssistant(ctx); // relue au clic par lancerExtraction ; ici pour l'état du bouton et la carte « Connecte-toi »

  // --- Lecture de l'état dans la base (jamais dans un cache) ----------------------------------------------------------------------------------
  // L'import OUVERT de cette recette : une seule définition d'« ouvert » (importOuvert : vocabulaire connu, sorte connue — une ligne reçue hors vocabulaire
  // n'est ni reprise ni bloquante, vague finale) et de la sorte recette. Après synchro, plusieurs appareils peuvent en avoir chacun une (I-2 ne vaut que
  // par appareil, spec § 11) : `prefere` (la ligne affichée, ou ?import= de « Reprendre ») d'abord, puis une lecture reçue (a_verifier), puis celle de
  // cet appareil.
  const ligneOuverte = async (prefere = null) => {
    const ouvertes = (await repo.byIndex('imports', 'recipe_id', recipe.id)).filter((i) => importOuvert(i) && i.kind === 'recette');
    const moi = typeof repo.deviceId === 'function' ? repo.deviceId() : null;
    return ouvertes.find((i) => prefere && i.id === prefere) || ouvertes.find((i) => i.status === 'a_verifier') || ouvertes.find((i) => moi && i.device_id === moi) || ouvertes[0] || null;
  };
  const resultatValide = (ligne) => { try { return validateParsedRecipe(ligne?.resultat); } catch { return null; } };
  async function charger() {
    const prefere = etat.ligne?.id ?? (typeof query?.import === 'string' ? query.import : null);
    let ouverte = await ligneOuverte(prefere);
    // I-1 : un résultat revenu du journal (synchro, archive) est REVALIDÉ avant tout usage ; hostile → a_verifier → echec(illisible) (transition ratifiée
    // T4-R1, § 3.1), rien n'atteint l'écran (spec § 4.5). C'est la seule écriture que le simple montage de l'écran peut faire (origine local : en file).
    if (ouverte?.status === 'a_verifier' && !resultatValide(ouverte)) { await illisible(ouverte); ouverte = await ligneOuverte(prefere); }
    // Une question posée ne survit ni à un changement de ligne ou de statut, ni à une NOUVELLE lecture sur la même ligne (T4-R2 : un redessin ne
    // montre jamais l'ancien titre pour une lecture arrivée entre-temps ; « Enregistrer cette lecture » la redemandera).
    if (ouverte?.id !== etat.ligne?.id || ouverte?.status !== 'a_verifier' || (etat.cleQuestion !== null && cleLecture(ouverte) !== etat.cleQuestion)) oublierQuestion();
    const ids = Array.isArray(ouverte?.page_ids) ? ouverte.page_ids : [];
    const manquantes = ids.filter((id) => !etat.pages.has(id));
    if (manquantes.length) for (const p of await Promise.all(manquantes.map((id) => repo.get('source_pages', id)))) if (p) etat.pages.set(p.id, p);
    etat.ligne = ouverte;
  }
  let file = Promise.resolve(); // les redessins sont enchaînés : jamais deux lectures concurrentes qui se dépassent
  const redessiner = () => { file = file.then(async () => { await charger(); dessiner(); }).catch((e) => logError('import_cible.rendu', { error: e })); return file; };
  async function illisible(ligne) {
    try { await marquerIllisible(repo, ligne); } // conditionnée à la lecture relue (ronde 1 de la tâche 6, T4-R2)
    catch (e) { logError('import_cible.revalidation', { error: e, id: ligne.id }); }
  }
  // Une transition SUR PLACE (même statut, sous ATTENDUS_PAGES) : l'ordre des pages, le retrait d'une page, le pointeur de la photo du plat.
  const transitionSurPlace = async (patch) => {
    try { await repo.transitionner('imports', etat.ligne.id, { attendus: ATTENDUS_PAGES, patch }); }
    catch (e) { if (!estRefus(e)) logError('import_cible.pages', { error: e, id: etat.ligne?.id }); }
  };

  // --- Gestes : pages ---------------------------------------------------------------------------------------------------------------------------
  // Vague finale (Important, « Relire les pages ») : les pages DÉJÀ liées à la fiche — celles de sa version courante, `kind: 'recipe'`, présentes ici, dans
  // leur ordre — sont placées en tête de la ligne que la première photo ouvre : la relecture d'une fiche partial lit la recette ENTIÈRE (la nouvelle
  // version ne perd jamais en silence les lignes d'une page déjà lue) ; « Retirer » reste offert sur chacune.
  // Ronde finale 2 : seulement celles dont les OCTETS sont sur cet appareil (repo.getFile rend un Blob) — sur un second appareil ou une PWA réinstallée,
  // la ligne source_pages arrive par la synchro sans ses octets (R58, L4) : placée, elle ferait refuser l'envoi (octets_absents) et ne laisserait que
  // « Retirer ». La ligne ne porte que ce qui peut partir ; une lecture qui ne couvre plus la courante pose la question I-5 (decider, pagesNonRelues).
  async function pagesDejaLiees() {
    const ref = (await repo.get('recipes', recipe.id)) ?? recipe;
    const courante = currentVersion(ref, await repo.byIndex('recipe_versions', 'recipe_id', recipe.id));
    const ids = [...new Set((Array.isArray(courante?.provenance?.source_page_ids) ? courante.provenance.source_page_ids : []).filter((id) => typeof id === 'string' && id))];
    const pages = await Promise.all(ids.map((id) => repo.get('source_pages', id)));
    const octetsIci = async (p) => {
      if (p?.kind !== 'recipe' || typeof p.sha256 !== 'string' || !p.sha256) return false;
      try { return (await repo.getFile(p.sha256))?.blob instanceof Blob; } catch { return false; }
    };
    const ici = await Promise.all(pages.map(octetsIci));
    return ids.filter((_, i) => ici[i]);
  }
  // Chaque ajout passe par repo.ajouterPages : persistant AVANT tout appel (spec § 4.2.2). Première photo → la ligne a_lancer naît (une visite sans
  // photo n'écrit rien, § 4.1) ; ensuite les pages s'ajoutent EN FIN de la même ligne (un seul import ouvert par recette, I-2).
  async function ajouterPhotos(options) {
    if (etat.occupe) return;
    const files = await pickFiles(options);
    if (!files?.length) return;
    etat.occupe = true;
    try {
      if (etat.ligne) await repo.ajouterPages(files, { import_id: etat.ligne.id });
      else await repo.ajouterPages(files, { edition_id: recipe.edition_id ?? null, import: { id: repo.newId('imp'), kind: 'recette', recipe_id: recipe.id, edition_id: recipe.edition_id ?? null, page_ids: await pagesDejaLiees() } });
    } catch (e) {
      if (!estRefus(e)) { logError('import_cible.ajout', { error: e }); toast(t('Ces photos n’ont pas pu être ajoutées. Réessaie.')); }
    } finally { etat.occupe = false; }
    await redessiner();
  }
  async function bougerPage(id, sens, role) {
    const L = etat.ligne; if (!L) return;
    const ids = Array.isArray(L.page_ids) ? L.page_ids : [];
    if (JSON.stringify(deplacerPage(ids, id, sens)) === JSON.stringify(ids)) return; // en tête ou en queue : sans effet, le bouton reste
    etat.focus = { role, page: id }; // le focus suit la page déplacée (spec § 4.2.2)
    await transitionSurPlace((c) => ({ page_ids: deplacerPage(Array.isArray(c.page_ids) ? c.page_ids : [], id, sens) }));
    await redessiner();
  }
  async function retirerLaPage(id) {
    if (!etat.ligne) return;
    await transitionSurPlace((c) => ({ page_ids: retirerPage(Array.isArray(c.page_ids) ? c.page_ids : [], id) })); // la ligne source_pages et l'octet restent (règle actuelle)
    await redessiner();
  }
  // Le champ « p. imprimée » d'une vignette écrit source_pages.printed_page (relue avant d'écrire, leçon C4) ; sans redessin : la saisie garde le focus.
  // Une saisie illisible (vide — ce qu'un champ nombre rend pour « 13a » —, « 0 », hors 1..9999) n'écrit RIEN et le champ reprend la valeur courante
  // (T4-R1 : jamais un numéro effacé sans le dire).
  async function ecrirePageImprimee(pageId, champ) {
    const s = String(champ.value ?? '').trim();
    const p = etat.pages.get(pageId);
    if (!/^[1-9]\d{0,3}$/.test(s)) { champ.value = p?.printed_page ?? ''; return; }
    const n = parseInt(s, 10);
    try { const courante = await repo.get('source_pages', pageId); if (courante) await repo.save('source_pages', { ...courante, printed_page: n }); }
    catch (e) { logError('import_cible.page_imprimee', { error: e, id: pageId }); }
    if (p) p.printed_page = n;
  }

  // --- Gestes : photo du plat (spec § 4.2.3, D-4, I-6) : le MÊME mur qu'une couverture (preparerPhotoLocale), octets dans files, pointeur sur la ligne.
  async function poserPhoto(options, origin) {
    if (etat.occupe || !etat.ligne) return;
    const files = await pickFiles(options);
    if (!files?.length) return;
    etat.occupe = true; dessiner();
    let blob;
    try { blob = await preparerPhotoLocale(files[0]); }
    catch (e) { etat.occupe = false; toast(messageErreurImage(e)); dessiner(); return; } // une image refusée n'est pas une écriture refusée
    try {
      const sha256 = await sha256Hex(blob);
      await repo.putFile(sha256, blob, { original_filename: files[0].name });
      await repo.transitionner('imports', etat.ligne.id, { attendus: ATTENDUS_PAGES, patch: { photo_sha256: sha256, photo_origin: origin } });
    } catch (e) {
      if (!estRefus(e)) { logError('import_cible.photo', { error: e }); toast(t('La photo n’a pas pu être enregistrée. Réessaie.')); }
    } finally { etat.occupe = false; }
    await redessiner();
  }
  async function retirerPhoto() {
    if (etat.occupe || !etat.ligne) return;
    etat.occupe = true;
    try { await transitionSurPlace({ photo_sha256: null, photo_origin: null }); } // le pointeur seul : les octets restent dans files
    finally { etat.occupe = false; }
    await redessiner();
  }
  function poserImage(img, sha) {
    if (!sha) return;
    if (urls.has(sha)) { img.src = urls.get(sha); return; }
    repo.getFile(sha).then((f) => {
      const type = typeAffichage(f); // F-9 (lot G) : le type du blob, dans la liste blanche, gagne — la règle de displayUrl
      if (!type || !type.startsWith('image/')) return;
      const u = displayUrl(f, urlDeBlob); // le retypage : une copie de la règle (displayUrl), ronde 1
      urls.set(sha, u); img.src = u;
    }).catch(() => {});
  }

  // --- Gestes : extraire, annuler, décider, enregistrer -------------------------------------------------------------------------------------------
  async function lancer() {
    const enVol = volEnCours();
    if (enVol) { if (enVol.importId !== etat.ligne?.id) toast(t('Une lecture est déjà en cours : annule-la d’abord.')); return; } // double tape : muette
    const L = etat.ligne; if (!L) return;
    oublierQuestion();
    const r = await lancerExtraction(L.id, { ctx, repo, fetch: fetchInjecte, maintenant, enLigne: () => enLigneFlag, battementMs });
    if (r.issue === 'refuse') {
      if (r.raison === 'image') toast(messageErreurImage({ code: r.code }));
      else if (r.raison === 'octets_absents') toast(t('Les photos de cette recette ne sont pas sur cet appareil.'));
      else if (r.raison === 'non_connecte') session = null; // la session a disparu entre le rendu et le clic : la carte revient
    }
    await redessiner();
    if (r.issue === 'a_verifier') await decider();
  }
  async function annuler() { const L = etat.ligne; if (!L) return; await annulerVol(L.id); await redessiner(); }
  async function changerLesPages() {
    const L = etat.ligne; if (!L || etat.occupe) return;
    oublierQuestion();
    try { await repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch: { status: 'a_lancer', resultat: null } }); }
    catch (e) { if (!estRefus(e)) logError('import_cible.changer_pages', { error: e, id: L.id }); }
    await redessiner();
  }
  // Après une lecture reçue (par le vol, ou en reprise sur une ligne a_verifier) : la discordance (spec § 4.3.3, D-6 : jamais de rattachement
  // silencieux) → question ; une version non produite par l'assistant (I-5, N4) → « Remplacer par cette lecture ? » ; sinon l'enregistrement en
  // UNE transaction (§ 4.3.5), référence RELUE juste avant (leçon C4). Les questions sont dessinées de façon SYNCHRONE avec le verdict.
  async function decider({ rattache = false, remplacer = null } = {}) {
    if (etat.occupe) return;
    etat.occupe = true;
    let apres = null; // ce qu'il reste à faire après la décision : 'redessiner' (une écriture a eu lieu) ou rien (une question est posée)
    try {
      const affichee = etat.ligne?.id ?? null;
      const L = await ligneOuverte(affichee);
      // Un autre onglet a tranché entre-temps — ou la ligne affichée n'est plus ouverte et une AUTRE l'est (autre appareil) : jamais enregistrée sans
      // avoir été montrée, le redessin la montre.
      if (!L || L.status !== 'a_verifier' || (affichee && L.id !== affichee)) { etat.question = null; apres = 'redessiner'; return; }
      etat.ligne = L;
      const resultat = resultatValide(L);
      if (!resultat) { await illisible(L); etat.question = null; apres = 'redessiner'; return; }
      // T4-R1 : la fiche supprimée entre le rendu et le clic (tombale d'un autre appareil, R57) n'est jamais ressuscitée par la copie du ctx : rien n'est écrit.
      const reference = await repo.get('recipes', recipe.id);
      if (!reference) { etat.question = null; apres = 'redessiner'; if (root.isConnected) { toast(t('Recette introuvable.')); navigate('/library'); } return; }
      const cle = cleLecture(L);
      // T4-R2 : la réponse vaut pour la lecture pour laquelle la question a été POSÉE (etat.cleQuestion), jamais pour la ligne relue au clic : « Rattacher »
      // lie cette clé-là (une autre lecture arrivée entre-temps redemande la discordance, D-6) ; « Remplacer » / « Garder ma version » sont ignorés et la
      // question reposée si la ligne relue n'est plus cette lecture (I-5 : rien ne devient courant sans avoir été vu).
      if (rattache) etat.rattache = etat.cleQuestion;
      if (remplacer !== null && cle !== etat.cleQuestion) remplacer = null;
      const rattachee = etat.rattache === cle; // « Rattacher » répondu pour CETTE lecture, pas pour une autre arrivée entre-temps (D-6)
      const verdict = discordance(resultat, reference);
      etat.verdict = verdict;
      const versions = await repo.byIndex('recipe_versions', 'recipe_id', recipe.id);
      const pageIds = Array.isArray(L.page_ids) ? L.page_ids : [];
      const pages = (await Promise.all(pageIds.map((id) => repo.get('source_pages', id)))).filter(Boolean);
      const ed = reference.edition_id ? (ctx.editionsById?.get(reference.edition_id) ?? (await repo.get('book_editions', reference.edition_id)) ?? null) : null;
      const conventionId = typeof ctx.conventionFor === 'function' ? ctx.conventionFor(reference) : (ed?.unit_convention_id ?? null);
      const options = { reference, versions, pages, pageIds, edition: ed, convention: conventionId ? getConvention(conventionId) : null, importId: L.id, modele: modeleBorne(L.model), photo: photoBornee(L), maintenant: maintenant(), reecrirePositions: !issueDUneSeance(L) }; // lot D (§ 4.8.1 point 1, N-1)
      const sonde = fabriquerExtraction(resultat, options); // pur : lu pour `remplacement` (I-5) avant la décision
      // Ronde finale 2 (garde de couverture) : une lecture qui ne relit pas TOUTES les pages de la version courante (octets absents ici, page retirée de la
      // ligne) ne la remplace jamais d'office — elle perdrait en silence les lignes de ces pages. « Remplacer par cette lecture ? » (I-5) est posée ;
      // current_version_id ne change pas tant que la question n'est pas tranchée (« Garder ma version » ajoute la version sans la rendre courante).
      const nonRelues = pagesNonRelues(currentVersion(reference, versions), sonde.version.provenance.source_page_ids);
      etat.question = questionAPoser({ ok: verdict.ok, rattachee, remplacement: sonde.remplacement || nonRelues.length > 0, remplacer });
      etat.ecriteMain = etat.question === 'remplacer' && sonde.remplacement;
      etat.cleQuestion = etat.question ? cle : null; // la question posée est celle de CETTE lecture (T4-R2)
      if (etat.question) return;
      apres = 'redessiner';
      await enregistrer(L, remplacer === false ? fabriquerExtraction(resultat, { ...options, remplacer: false }) : sonde);
    } catch (e) {
      logError('import_cible.decider', { error: e });
      apres = 'redessiner';
    } finally {
      etat.occupe = false;
      if (apres === 'redessiner') await redessiner(); else dessiner(); // une question posée se dessine tout de suite, avec son verdict
    }
  }
  // L'enregistrement (§ 4.3.5) : UNE transaction conditionnée a_verifier → enregistre avec la fiche, la version, les pages et la séance. Refusée (un
  // autre onglet a tranché juste avant, I-10) → rien n'est écrit et rien n'est dit « importé » ; réussie → toast et navigation SEULEMENT si l'écran est
  // encore monté (T4-R1 : une lecture qui arrive après avoir quitté l'écran n'arrache pas la personne à sa saisie ; la fiche montre la version).
  async function enregistrer(L, fab) {
    // Ronde 1 : une séance refusée dans la transaction (disparue, ou d'un statut hors open/done) n'est plus relue — le geste suivant écrit sans elle (§ 4.8.1 point 2).
    const seance = L.scan_session_id && etat.seanceRefusee !== L.scan_session_id ? await repo.get('scan_sessions', L.scan_session_id) : null;
    const puts = { recipes: [fab.recipe], recipe_versions: [fab.version], source_pages: fab.pageUpdates };
    // Lot D (§ 4.8.1 point 2, N-1) : la séance n'est plus écrite par une copie lue hors transaction — elle entre dans LA transaction par le sac
    // `conditions`, relue dedans (deux enregistrements concurrents gardent leurs deux recipe_ids) ; done seulement quand plus aucune de ses photos n'est
    // sans rôle (statutSeanceApres, sur ses pages relues juste avant : une page arrivée entre-temps compte comme sans rôle) ; disparue → refus.
    let conditions = null;
    if (seance) {
      const pagesSeance = new Map();
      for (const id of Array.isArray(seance.page_ids) ? seance.page_ids : []) { const p = await repo.get('source_pages', id); if (p) pagesSeance.set(id, p); }
      const ecrites = new Set(fab.pageUpdates.map((p) => p.id));
      conditions = { scan_sessions: [{ key: seance.id, attendus: ['open', 'done'], patch: (c) => ({ recipe_ids: [...new Set([...(Array.isArray(c.recipe_ids) ? c.recipe_ids : []), recipe.id])], status: statutSeanceApres(c, pagesSeance, ecrites) }) }] };
    }
    // Vague finale (T6-R1-d ici aussi) : la clôture vaut pour LA lecture dont la recette a été fabriquée — une autre lecture arrivée sur la ligne entre
    // la relecture et la transaction (autre onglet, autre appareil) n'est jamais close sans avoir été vue ; rien n'est écrit, le redessin la montre.
    const cle = cleLecture(L);
    const cloture = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return { status: 'enregistre', reponse_brute: null, finished_at: maintenant() }; };
    try {
      await repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch: cloture, puts, ...(conditions ? { conditions } : {}) });
    } catch (e) {
      if (estRefus(e) && e.store === 'scan_sessions') { etat.seanceRefusee = L.scan_session_id; toast(t('La recette n’a pas pu être enregistrée. Réessaie.')); } // lot D : la séance a disparu (ou porte un statut inconnu) ; le geste suivant écrit sans elle
      else if (!estRefus(e)) { logError('import_cible.enregistrer', { error: e, id: L.id }); toast(t('La recette n’a pas pu être enregistrée. Réessaie.')); }
      return;
    }
    if (!root.isConnected) return;
    toast(t('Recette importée'));
    navigate(`/recipes/${encodeURIComponent(recipe.id)}?v=${encodeURIComponent(fab.version.id)}`);
  }

  // --- Dessin -----------------------------------------------------------------------------------------------------------------------------------
  const pretALancer = () => !!etat.ligne && (Array.isArray(etat.ligne.page_ids) && etat.ligne.page_ids.length > 0) && !!session && enLigneFlag && !volEnCours() && !etat.occupe;
  function majEnLigne() {
    const zone = root.querySelector('[data-role="hors-ligne"]');
    if (zone) zone.replaceChildren(...(enLigneFlag ? [] : [el('div', { class: 'status warn' }, t('Tu es hors ligne.'))]));
    const b = root.querySelector('button[data-role="extraire"]');
    if (b) b.disabled = !pretALancer();
  }
  const sousTitre = () => [book?.title, Number.isInteger(recipe.printed_page) ? `${t('p.')} ${recipe.printed_page}` : null].filter(Boolean).join(' · ');
  const enTete = () => el('header', { class: 'stack', style: { marginBottom: '1rem' } },
    el('p', { class: 'muted', style: { margin: 0 } }, t('Importer une recette')),
    el('div', { class: 'row between top' },
      el('div', null, el('h1', null, recipe.original_title), sousTitre() ? el('p', { class: 'muted' }, sousTitre()) : null),
      recipe.availability === 'partial' ? el('span', { class: 'badge partial' }, t('Partiellement disponible')) : el('span', { class: 'badge reference' }, t('Repérée dans ton livre'))));

  function sectionPages(pageIds, figees) {
    const n = pageIds.length;
    const vignettes = el('div', { class: 'thumbs' });
    pageIds.forEach((id, i) => {
      const p = etat.pages.get(id);
      if (!p) return; // pointeur souple : une page absente n'est pas rendue
      const rang = i + 1;
      const img = el('img', { alt: t('Page {n}', { n: rang }), loading: 'lazy' });
      poserImage(img, p.sha256);
      const champ = el('input', { type: 'number', min: 1, max: 9999, placeholder: t('p. imprimée'), 'aria-label': t('p. imprimée'), value: p.printed_page ?? '', onChange: (e) => ecrirePageImprimee(p.id, e.target) });
      const bouton = (role, libelle, onClick) => el('button', { type: 'button', class: 'btn', dataset: { role, page: id }, onClick }, libelle);
      vignettes.append(el('figure', null, el('span', { class: 'num' }, String(rang)), img,
        el('figcaption', { class: 'stack' }, champ,
          figees ? null : el('div', { class: 'row' },
            bouton('monter', t('Monter la page {n}', { n: rang }), () => bougerPage(id, -1, 'monter')),
            bouton('descendre', t('Descendre la page {n}', { n: rang }), () => bougerPage(id, 1, 'descendre')),
            bouton('retirer', t('Retirer la page {n}', { n: rang }), () => retirerLaPage(id))))));
    });
    return section(t('Pages de la recette'),
      el('p', { class: 'muted', style: { margin: 0 } }, n <= 1 ? t('{n} photo ajoutée', { n }) : t('{n} photos ajoutées', { n })),
      n ? vignettes : null,
      figees ? null : el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn', disabled: etat.occupe, onClick: () => ajouterPhotos({ accept: 'image/*', capture: 'environment', multiple: true }) }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', disabled: etat.occupe, onClick: () => ajouterPhotos({ accept: 'image/*', multiple: true }) }, t('Choisir des photos'))));
  }

  function sectionPhoto(L, figee) {
    const sha = L?.photo_sha256 || null;
    const zone = el('div', { class: 'row top' });
    if (sha) {
      const img = el('img', { dataset: { role: 'apercu-plat' }, alt: '', style: { width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px' } });
      poserImage(img, sha);
      zone.append(img, el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn', disabled: figee || etat.occupe, onClick: () => poserPhoto({ accept: 'image/*', multiple: false }, 'image') }, t('Remplacer')),
        el('button', { type: 'button', class: 'btn', disabled: figee || etat.occupe, onClick: retirerPhoto }, t('Retirer'))));
    } else {
      // Sans ligne du journal (aucune page encore), il n'y a rien où poser le pointeur : une visite sans photo n'écrit rien (§ 4.1).
      const attend = !L || figee || etat.occupe;
      zone.append(
        el('button', { type: 'button', class: 'btn', disabled: attend, onClick: () => poserPhoto({ accept: 'image/*', capture: 'environment', multiple: false }, 'photo') }, t('Prendre une photo')),
        el('button', { type: 'button', class: 'btn', disabled: attend, onClick: () => poserPhoto({ accept: 'image/*', multiple: false }, 'image') }, t('Choisir une image')));
    }
    return section(t('Photo du plat'), el('p', { class: 'muted', style: { margin: 0 } }, `${t('Facultatif')} · ${t('Ajoute la photo du livre, s’il y en a une.')}`), zone);
  }

  const retour = () => el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(recipe.id)}` }, t('Retour à la fiche'));
  // Lot D (§ 4.8.1 point 3, D-D9, R-D-3) : sur TOUT panneau de discordance, la lecture devient une recette neuve, SANS appel — la ligne perd sa référence
  // (recipe_id null), gardée dans la transaction par la clé de LA lecture questionnée et par la sorte ; puis l'éditeur prérempli (?import=) si l'écran est
  // encore monté. Refusé (une autre lecture est arrivée) → reposer() : rien n'est détaché, la question est reposée pour la lecture courante.
  async function enFaireUneNouvelle() {
    const L = etat.ligne;
    if (!L || etat.occupe) return;
    const cle = etat.cleQuestion;
    etat.occupe = true;
    let fait = false;
    try {
      await repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch: (c) => { if (cleLecture(c) !== cle || c.kind !== 'recette') throw new TransitionRefusee('imports', L.id, c.status); return { recipe_id: null }; } });
      fait = true;
    } catch (e) { if (!estRefus(e)) { logError('import_cible.nouvelle_recette', { error: e, id: L.id }); toast(t('Une erreur est survenue')); } } // ronde 1 : un échec qui n'est pas un refus est dit
    finally { etat.occupe = false; }
    if (fait) { oublierQuestion(); if (root.isConnected) navigate('/recipes/new?import=' + encodeURIComponent(L.id)); return; }
    await reposer();
  }
  // La question pour la lecture COURANTE, sans rien écrire : discordante → le panneau reposé (avec son verdict) ; sinon la question est oubliée et l'écran
  // offre « Enregistrer cette lecture » (jamais une lecture enregistrée sans avoir été vue).
  async function reposer() {
    const L = await ligneOuverte(etat.ligne?.id ?? null);
    const resultat = L?.status === 'a_verifier' ? resultatValide(L) : null;
    const reference = resultat ? await repo.get('recipes', recipe.id) : null;
    const verdict = reference ? discordance(resultat, reference) : null;
    if (verdict && !verdict.ok) { etat.ligne = L; etat.verdict = verdict; etat.question = 'discordance'; etat.cleQuestion = cleLecture(L); dessiner(); return; }
    oublierQuestion();
    await redessiner();
  }
  function panneauDiscordance() {
    const v = etat.verdict || {};
    const x = typeof v.titreLu === 'string' && v.titreLu ? v.titreLu : t('(sans titre)');
    const y = recipe.original_title;
    const texte = Number.isInteger(recipe.printed_page)
      ? t('Le texte lu s’intitule “{x}” ; la référence est “{y}” (p. {n}). Rattacher quand même ?', { x, y, n: recipe.printed_page })
      : t('Le texte lu s’intitule “{x}” ; la référence est “{y}”. Rattacher quand même ?', { x, y });
    return el('div', { class: 'card warn stack', dataset: { role: 'discordance' } },
      el('p', { style: { margin: 0 } }, texte),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', onClick: () => decider({ rattache: true }) }, t('Rattacher')),
        el('button', { type: 'button', class: 'btn', onClick: () => { oublierQuestion(); dessiner(); } }, t('Garder la lecture sans l’enregistrer')),
        el('button', { type: 'button', class: 'btn', onClick: changerLesPages }, t('Changer les pages')),
        el('button', { type: 'button', class: 'btn', dataset: { role: 'nouvelle-recette' }, onClick: enFaireUneNouvelle }, t('En faire une nouvelle recette'))));
  }
  const panneauRemplacer = () => el('div', { class: 'card warn stack', dataset: { role: 'remplacer' } },
    el('p', { style: { margin: 0 } }, t('Remplacer par cette lecture ?')),
    // Ronde finale 2 : la phrase « version écrite à la main » n'est dite que si c'est vrai — posée par la seule couverture des pages, la question vient sans
    // elle (aucun texte neuf : spec § 5 ; rien d'inventé).
    etat.ecriteMain ? el('small', { class: 'muted' }, t('Une version écrite à la main existe. « Garder ma version » ajoute la lecture sans la mettre en avant ; les pages et la photo sont liées quand même.')) : null,
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn primary', onClick: () => decider({ remplacer: false }) }, t('Garder ma version')), // défaut non (I-5)
      el('button', { type: 'button', class: 'btn', onClick: () => decider({ remplacer: true }) }, t('Remplacer'))));
  function blocEchec(erreur) {
    const { texte, code } = texteEchec(erreur);
    return el('div', { class: 'status warn', dataset: { role: 'echec' } }, el('span', null, texte), code ? el('small', { class: 'muted' }, code) : null);
  }

  function zoneAction(L, statut, enVol) {
    const bloc = el('div', { class: 'card stack', dataset: { role: 'action' } });
    if (statut === 'en_cours') {
      if (enVol) {
        // R-VIS-8 : la .status[role=status] puis la .row — « Annuler » se range à droite ; le primaire reste, éteint, à sa place.
        bloc.append(el('div', { class: 'status', role: 'status' }, t('Lecture des pages par l’assistant…')),
          el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', disabled: true }, t('Extraire et enregistrer')), el('button', { type: 'button', class: 'btn', dataset: { role: 'annuler' }, onClick: annuler }, t('Annuler'))));
      } else bloc.append(el('div', { class: 'status warn' }, t('En cours sur un autre écran')), el('div', { class: 'row' }, retour())); // I-7 : sans « Annuler »
      return bloc;
    }
    if (statut === 'a_verifier') {
      bloc.append(el('p', { class: 'muted', style: { margin: 0 } }, t('Lecture reçue le {d}', { d: formatDate(dateReception(L), { withTime: true }) })));
      if (etat.question === 'discordance') bloc.append(panneauDiscordance());
      else if (etat.question === 'remplacer') bloc.append(panneauRemplacer());
      else bloc.append(el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', dataset: { role: 'enregistrer' }, disabled: etat.occupe, onClick: () => decider() }, t('Enregistrer cette lecture')), // sans appel
        el('button', { type: 'button', class: 'btn', dataset: { role: 'changer-pages' }, disabled: etat.occupe, onClick: changerLesPages }, t('Changer les pages')),
        retour()));
      return bloc;
    }
    if (statut === 'echec') bloc.append(blocEchec(L.erreur));
    // R-T4-4 : sans session, la phrase et le geste — ici seulement, où le primaire appelle l'assistant (T4-R1 : « Enregistrer cette lecture » n'appelle
    // rien, la carte y annoncerait un faux besoin) ; les photos s'ajoutent quand même.
    if (!session) bloc.append(carteConnexion(connecter, ctx));
    bloc.append(el('div', { dataset: { role: 'hors-ligne' } }), // rempli par majEnLigne (écoute online/offline)
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', dataset: { role: 'extraire' }, disabled: !pretALancer(), onClick: lancer }, statut === 'echec' ? t('Relancer') : t('Extraire et enregistrer')),
        retour()), // jamais seul (spec § 4.2.4)
      el('small', { class: 'muted' }, t('Les pages et la photo seront liées à cette recette.')));
    return bloc;
  }

  // Vague finale (m1) : une ligne en_cours que CE document ne tient pas (onglet fermé, PWA tuée par iOS, rechargement) n'attend plus le prochain
  // démarrage : la passe `interrompu` (repo.marquerInterrompus, mêmes règles, horloge de l'écran) est rejouée à l'affichage, puis après
  // BATTEMENT_MORT_MS tant que la ligne reste en vol ailleurs et l'écran monté ; une passe qui interrompt redessine (la phrase I-4, « Relancer »).
  let veille = null;
  function veiller(maintenantAussi = true) {
    const L = etat.ligne;
    if (veille || L?.status !== 'en_cours' || volEnCours()?.importId === L.id || typeof repo.marquerInterrompus !== 'function') return;
    const passe = () => { const m = Date.parse(maintenant()); return repo.marquerInterrompus(Number.isFinite(m) ? m : undefined).then((n) => (n ? redessiner() : null)).catch((e) => logError('import_cible.interrompus', { error: e })); };
    if (maintenantAussi) passe();
    veille = setTimeout(() => { veille = null; if (root.isConnected) passe().then(() => veiller(false)); }, veilleMs);
  }
  function dessiner() {
    const L = etat.ligne;
    const statut = L?.status ?? null;
    const pageIds = Array.isArray(L?.page_ids) ? L.page_ids : [];
    const enVol = !!L && volEnCours()?.importId === L.id;
    // Vague finale (m2) : figées dès que CE document tient le vol de cette ligne, avant même en_cours (gardes et réduction des pages).
    root.replaceChildren(enTete(), sectionPages(pageIds, enVol || statut === 'en_cours' || statut === 'a_verifier'), sectionPhoto(L, enVol || statut === 'en_cours'), zoneAction(L, statut, enVol));
    majEnLigne();
    veiller();
    if (etat.focus) { const { role, page } = etat.focus; etat.focus = null; root.querySelector(`button[data-role="${role}"][data-page="${CSS.escape(page)}"]`)?.focus(); }
  }

  await charger();
  dessiner();
  const vue = { root, redessiner, majEnLigne };
  vues.add(vue);
  // Le routeur insère la racine APRÈS la fin de la route : si un redessin est demandé dans cet intervalle, notifier() écarte la racine encore détachée.
  // Une fois montée, elle se réabonne et se redessine (sinon elle resterait figée).
  setTimeout(() => { if (root.isConnected && !vues.has(vue)) { vues.add(vue); redessiner(); } }, 0);
  return root;
}
