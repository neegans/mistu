// Lire une recette web (lot B « Recette web complète », spec docs/superpowers/specs/2026-10-19-recette-web-design.md, § 4.1, § 4.3) : démarrer une
// lecture (depuis la fiche d'un signet, ou « Garder et lire » de l'onglet Web), la lancer, l'annuler. Le vol est celui du DOCUMENT (./vol.js,
// partagé avec l'extraction de pages : I-B3) ; toute écriture passe par repo.saveBatch conditionné (création, I-2 du lot A) ou repo.transitionner
// (I-10) ; l'adresse lue est celle du signet RELU en base, jamais celle de l'écran (D-B4). Sens unique : ce module n'importe jamais
// ./import-cible.js (D-B13). Gestes injectables { repo, fetch, maintenant, enLigne, battementMs, langue } : la suite n'ouvre aucun réseau.
import { el, toast as toastDom, chooseDialog, formatDate } from '../core/dom.js';
import { t, getUiLocale } from '../core/i18n.js';
import { navigate as naviguerDom } from '../core/router.js';
import { logError } from '../core/log.js';
import { borner } from '../core/bornes.js';
import { lienSignet, doublonDAdresse } from '../core/lien.js';
import { TransitionRefusee } from '../core/db.js';
import * as repoModule from '../model/repo.js';
import { LIMITES_PASSERELLE } from '../domain/passerelle.js';
import { RAISONS_ECHEC, IMPORTS_OUVERTS, importOuvert, motsDistinctifs, cleLecture, modeleBorne } from '../domain/import-cible.js';
import { lireRecetteWeb, fabriquerImportWeb, fabriquerLectureWeb, relireResultat, versionHumaine } from '../domain/lecture-web.js';
import { sessionAssistant, carteConnexion, texteRefusAssistant, texteEchecAssistant, availabilityBadge, section, INCERTAIN_MAX } from './components.js';
import { demarrerConnexion } from './settings.js';
import { signetModel, fabriquerSignet, LIMITES_SIGNET } from './signet.js';
import { DOCUMENT_ID, BATTEMENT_MS, prendreVol, libererVol, volTenu, volEnCours } from './vol.js';

const horloge = () => new Date().toISOString();
const estRefus = (e) => e instanceof TransitionRefusee;
const refus = (raison) => ({ issue: 'refuse', raison });
// Les raisons dont la réponse brute est gardée sur la ligne (diagnostic, jamais rendue) : celles où le serveur a répondu (§ 4.3.3).
const GARDE_BRUTE = ['coupe', 'illisible', 'hors_bornes', 'vide', 'lien'];
// En ligne / hors ligne : suivi par les événements de la fenêtre (comme l'écran du lot A) ; les écrans s'abonnent par ecouterLecture.
let enLigneFlag = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
const abonnes = new Set(); // fonctions rappelées après chaque transition d'un vol de lecture (les écrans se redessinent)
const notifier = () => { for (const f of [...abonnes]) { try { f(); } catch (e) { logError('import_web.notifier', { error: e }); } } };
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { enLigneFlag = true; notifier(); });
  window.addEventListener('offline', () => { enLigneFlag = false; notifier(); });
}
export const enLigneLecture = () => enLigneFlag;
export function ecouterLecture(f) { abonnes.add(f); return () => abonnes.delete(f); }
export function reinitialiserLectureWeb() { abonnes.clear(); enLigneFlag = typeof navigator === 'undefined' ? true : navigator.onLine !== false; } // tests seulement
export const abonnesLecture = () => abonnes.size; // tests seulement (ronde 1 de la tâche 5 : une racine retirée ne reste pas abonnée)

// R-B-18 : « ouvert » a UNE définition, importOuvert (src/domain/import-cible.js, m10 / VF-11 du lot A), APPELÉE ici (ronde 1 : plus de copie de sa
// règle) — jamais la négation des statuts terminés : une ligne reçue au statut inconnu ou nul ne masque pas la fiche. Depuis la tâche 6, importOuvert
// liste la sorte 'web' (KINDS_IMPORT + 'web', P-1) : la substitution de sorte des tâches 4 et 5 a disparu, le prédicat l'appelle tel quel.
// Ronde 1 de la tâche 5 : UN prédicat et UN choix de ligne (R-B-20, l'ordre de VF-6 du lot A), exportés et partagés par demarrerLectureWeb, l'écran et
// la fiche (recipe.js, blocSignet) — plus de seconde copie : `prefere` (la ligne affichée, puis ?import=), puis une lecture reçue (a_verifier), puis
// celle de cet appareil (`moi`), puis la première. La fiche montre ainsi la ligne que l'écran ouvrira et que « Réessayer » reprendra.
export const ouverteWeb = (i, recipeId) => importOuvert(i) && i.kind === 'web' && i.recipe_id === recipeId;
export function ligneWebOuverte(imports, recipeId, { prefere = null, moi = null } = {}) {
  const ouvertes = (Array.isArray(imports) ? imports : []).filter((i) => ouverteWeb(i, recipeId));
  return ouvertes.find((i) => prefere && i.id === prefere) || ouvertes.find((i) => i.status === 'a_verifier') || ouvertes.find((i) => moi && i.device_id === moi) || ouvertes[0] || null;
}
const moiDe = (repo) => (typeof repo?.deviceId === 'function' ? repo.deviceId() : null);
const ouvertDe = (imports, recipeId, repo) => ligneWebOuverte(imports, recipeId, { moi: moiDe(repo) });

// --- Lancer (§ 4.3.2) -----------------------------------------------------------------------------------------------------------------------------
// MÊME forme de retour que lancerExtraction (lot A, F-8) : { issue: 'refuse', raison } (vol_tenu, inconnu, statut, hors_ligne, non_connecte,
// interdit, transition), { issue: 'echec', raison, ecrit? }, { issue: 'a_verifier' }. Le vol est pris AVANT tout await et libéré en finally ;
// `appels + 1` au moment où le fetch part ; la réponse lue est écrite dans le journal (a_verifier) avant tout rendu (I-B4). `relire` : un
// import a_verifier repart (a_verifier → en_cours en UNE transaction, « Relire la page »). Le battement vit HORS de la ligne synchronisée (R-B-17).
// `cle` (ronde 1 de la tâche 5, P-12) : la cleLecture de la ligne AFFICHÉE — le départ ne vaut que pour elle ; une autre lecture arrivée entre le rendu
// et la tape (un autre onglet) n'est jamais effacée sans avoir été vue (TransitionRefusee dans la transaction de départ → refus `transition`).
export async function lancerLecture(importId, { ctx, repo = repoModule, fetch: fetchInjecte = undefined, maintenant = horloge, enLigne = () => enLigneFlag, battementMs = BATTEMENT_MS, relire = false, cle = null } = {}) {
  const tenue = { importId, controller: new AbortController(), repo };
  if (!prendreVol(tenue)) return refus('vol_tenu'); // y compris quand c'est une extraction de pages qui tient le document
  const liberer = () => libererVol(tenue);
  let battement = null;
  try {
    const ligne = await repo.get('imports', importId);
    // Ronde 1 de la tâche 6 : une ligne web sans recipe_id (forme reçue, required.imports = []) n'a aucun signet — refusée avant toute lecture de la base.
    if (!ligne || ligne.kind !== 'web' || typeof ligne.recipe_id !== 'string' || !ligne.recipe_id) { liberer(); return refus('inconnu'); }
    if (!(ligne.status === 'a_lancer' || ligne.status === 'echec' || (relire && ligne.status === 'a_verifier'))) { liberer(); return refus('statut'); }
    if (!enLigne()) { liberer(); return refus('hors_ligne'); }
    const session = await sessionAssistant(ctx);
    if (!session) { liberer(); return refus('non_connecte'); }
    const signet = await repo.get('recipes', ligne.recipe_id);
    if (!signet) { liberer(); return refus('inconnu'); } // ronde 1 : la fiche a été effacée entre-temps (tombale reçue) — elle n'existe plus, rien n'est « interdit »
    const lien = lienSignet(signet.source_url);
    if (!lien.ok || !lien.href.startsWith('https:')) { liberer(); return refus('interdit'); } // B-20 : rien ne part, zéro réseau
    const depart = maintenant();
    // Ronde 1 : le départ en UNE transaction (comme T6-R1-a du lot A) — « Relire la page » passe a_verifier → en_cours sans a_lancer intermédiaire (la
    // lecture payée n'est jamais effacée avant que le départ soit acquis) ; la lecture précédente (résultat, réponse brute, modèle, durée) est effacée
    // AU départ : un échec de ce vol ne porte jamais le diagnostic d'un autre.
    // Tâche 6 (§ 4.7, P-5 / R-B-8) : une ligne d'un AUTRE appareil relancée ici devient celle de CET appareil — son battement (la ligne interne de
    // sync_state, origine device, R-B-17) n'est visible qu'ici. Sans cela, l'appareil d'origine, qui ne voit jamais ce battement, la jugerait sienne
    // (BATTEMENT_MORT_MS, 90 s, sur le battement_at du départ) et la dirait interrompue pendant un vol vivant ; réattribuée, elle relève pour lui de
    // VOL_MORT_MS (10 min depuis le départ synchronisé, bien au-delà du délai client de 135 s ; repo.marquerInterrompus).
    const moi = moiDe(repo);
    const patchDepart = { status: 'en_cours', started_at: depart, document_id_vol: DOCUMENT_ID, battement_at: depart, erreur: null, resultat: null, reponse_brute: null, model: null, duree_ms: null, ...(moi ? { device_id: moi } : {}) };
    const patch = cle === null ? patchDepart : (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', importId, c.status); return patchDepart; };
    try {
      await repo.transitionner('imports', importId, { attendus: relire ? ['a_lancer', 'echec', 'a_verifier'] : ['a_lancer', 'echec'], patch });
    } catch (e) {
      liberer();
      if (estRefus(e)) return { issue: 'refuse', raison: 'transition', statut: e.statut }; // un autre onglet a tranché entre-temps (I-10)
      throw e;
    }
    notifier();
    // Battement (R-B-17, comme la vague finale du lot A) : HORS de la ligne synchronisée — repo.battre réécrit la ligne interne `battement:<id>` de
    // sync_state (origine device : jamais en file, aucun `change`, aucune passe de synchro) ; la ligne imports garde le battement_at de son départ
    // (posé par la transition en_cours ci-dessus, comme le lot A). La ligne interne est effacée en finally (repo.oublierBattement).
    battement = setInterval(() => { repo.battre(importId, maintenant()).catch(() => {}); }, battementMs);
    const fetchReel = fetchInjecte ?? globalThis.fetch;
    const fetchCompte = async (url, options) => {
      try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: (c) => ({ appels: (Number.isInteger(c.appels) ? c.appels : 0) + 1 }) }); }
      catch (e) { if (!estRefus(e)) logError('import_web.appels', { error: e, id: importId }); }
      return fetchReel(url, options); // fonction LIBRE (jamais objet.fetch : Illegal invocation)
    };
    const t0 = Date.now();
    const r = await lireRecetteWeb({ url: lien.href, session }, { fetch: fetchCompte, signal: tenue.controller.signal, tentativeMs: LIMITES_PASSERELLE.tentativeMs });
    const duree_ms = Date.now() - t0;
    if (r.etat !== 'lue') {
      const raison = RAISONS_ECHEC.includes(r.raison) ? r.raison : 'interne';
      const patch = { status: 'echec', erreur: { raison, extra: r.extra ?? {} }, document_id_vol: null, duree_ms, ...(GARDE_BRUTE.includes(raison) && typeof r.reponseBrute === 'string' ? { reponse_brute: r.reponseBrute } : {}), ...(typeof r.modele === 'string' ? { model: r.modele } : {}) };
      try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch }); }
      catch (err) { if (!estRefus(err)) logError('import_web.echec', { error: err, id: importId }); } // déjà echec(annule) : la première écriture gagne
      return { issue: 'echec', raison };
    }
    try {
      await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { status: 'a_verifier', resultat: r.resultat, reponse_brute: r.reponseBrute, model: r.modele ?? null, duree_ms, document_id_vol: null, erreur: null } });
    } catch (e) {
      if (estRefus(e)) {
        // Réponse arrivée après « Annuler » (ou un interrompu) : echec → a_verifier n'existe pas ; la réponse brute seule est gardée, rien d'autre.
        try { await repo.transitionner('imports', importId, { attendus: ['echec'], patch: { reponse_brute: r.reponseBrute } }); }
        catch (err) { if (!estRefus(err)) logError('import_web.tardive', { error: err, id: importId }); }
        return { issue: 'echec', raison: 'annule' };
      }
      // Écriture impossible après une réponse (I-B7) : echec(incertain) ; si elle échoue aussi, la ligne reste en_cours (interrompu au démarrage).
      try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { status: 'echec', erreur: { raison: 'incertain', extra: {} }, document_id_vol: null, duree_ms } }); }
      catch (err) { logError('import_web.incertain', { error: err, id: importId }); return { issue: 'echec', raison: 'incertain', ecrit: false }; }
      return { issue: 'echec', raison: 'incertain' };
    }
    return { issue: 'a_verifier' };
  } finally {
    if (battement) { clearInterval(battement); repo.oublierBattement(importId).catch(() => {}); }
    liberer();
    notifier();
  }
}

// « Annuler » (§ 4.3.5) : seulement si CE document tient le vol de cet import — le fetch est abandonné, en_cours → echec(annule). Sinon false.
export async function annulerLecture(importId) {
  const tenue = volTenu(importId);
  if (!tenue) return false;
  tenue.controller.abort();
  try { await tenue.repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { status: 'echec', erreur: { raison: 'annule', extra: {} }, document_id_vol: null } }); }
  catch (e) { if (!estRefus(e)) logError('import_web.annuler', { error: e, id: importId }); }
  notifier();
  return true;
}

// --- Démarrer (§ 4.3.1) ---------------------------------------------------------------------------------------------------------------------------
// Deux entrées : `recipe` (la fiche d'un signet, ou une relecture) ou `adresse` + `titre` + `reperes` (« Garder et lire » : le signet et l'import
// en UNE transaction conditionnée, D-B21). L'adresse doit être lisible ET en https (sinon refus, rien d'écrit, zéro réseau). Un import ouvert de
// la fiche est REPRIS (un a_verifier ou un en_cours ne relance rien, B-12) ; la création est un mur EN TRANSACTION (I-2 : absente + aucun import
// ouvert sur cette recipe_id) ; refusée (un autre onglet, une réception synchro), l'import ouvert est relu et repris. Puis lancerLecture SANS
// l'attendre quand la ligne est a_lancer ou echec. Rend { issue: 'ok', recipeId, importId, lancement } (lancement : la promesse du vol, ou null ;
// elle ne rejette jamais, ronde 1), { issue: 'doublon', recette } ou { issue: 'refuse', raison: 'adresse' | 'interdit' | 'transition', statut? }.
export async function demarrerLectureWeb({ recipe = null, adresse = null, titre = null, reperes = null, ctx } = {}, { repo = repoModule, fetch, maintenant = horloge, enLigne = () => enLigneFlag, battementMs = BATTEMENT_MS, langue = getUiLocale() } = {}) {
  const brute = recipe ? recipe.source_url : adresse;
  const lien = lienSignet(typeof brute === 'string' ? brute.trim() : '');
  if (!lien.ok) return refus('adresse');
  if (!lien.href.startsWith('https:')) return refus('interdit');
  let ligne = null; let recipeId = null;
  if (recipe) {
    recipeId = recipe.id;
    ligne = ouvertDe(ctx?.imports, recipe.id, repo);
    if (!ligne) {
      const neuve = fabriquerImportWeb({ id: repo.newId('imp'), signet: recipe, deviceId: repo.deviceId() });
      try {
        await repo.saveBatch({ imports: [neuve] }, { conditions: { imports: [{ key: neuve.id, absente: true }, { index: 'recipe_id', valeur: recipe.id, exclus: IMPORTS_OUVERTS }] } });
        ligne = neuve;
      } catch (e) {
        if (!estRefus(e)) throw e;
        ligne = ouvertDe(await repo.byIndex('imports', 'recipe_id', recipe.id), recipe.id, repo); // créé entre le rendu et la tape : repris, zéro appel de trop
        // Ronde 1 : aucun import WEB ouvert, et le mur a refusé — un import ouvert d'une AUTRE sorte tient la fiche (I-2 du lot A tient par statut,
        // toutes sortes confondues ; passation « à trancher par B ») : un refus NOMMÉ, jamais une exception non gérée ; rien d'écrit.
        if (!ligne) return { issue: 'refuse', raison: 'transition', statut: e.statut };
      }
    }
  } else {
    const m = signetModel({ adresse: lien.href, titre: borner(typeof titre === 'string' && titre.trim() ? titre : lien.hote, LIMITES_SIGNET.titre) });
    if (!m.valide) return refus('adresse');
    const doublon = doublonDAdresse(ctx?.recipes, m.href);
    if (doublon) return { issue: 'doublon', recette: doublon };
    const signet = fabriquerSignet(m, { newId: repo.newId, langue, reperes });
    const neuve = fabriquerImportWeb({ id: repo.newId('imp'), signet, deviceId: repo.deviceId() });
    await repo.saveBatch({ recipes: [signet], imports: [neuve] }, { conditions: { recipes: [{ key: signet.id, absente: true }], imports: [{ key: neuve.id, absente: true }, { index: 'recipe_id', valeur: signet.id, exclus: IMPORTS_OUVERTS }] } });
    recipeId = signet.id; ligne = neuve;
  }
  // Ronde 1 : la promesse rendue ne rejette jamais — une erreur qui n'est pas un refus (base indisponible, quota) est journalisée et devient
  // echec(interne) : l'appelant qui ne l'attend pas (« Garder et lire », la fiche) ne laisse aucun rejet sans gestionnaire.
  const importId = ligne.id;
  const lancement = ligne.status === 'a_lancer' || ligne.status === 'echec'
    ? lancerLecture(importId, { ctx, repo, fetch, maintenant, enLigne, battementMs }).catch((e) => { logError('import_web.lancer', { error: e, id: importId }); return { issue: 'echec', raison: 'interne' }; })
    : null;
  return { issue: 'ok', recipeId, importId, lancement };
}

// --- Textes (§ 4.4) : UNE définition, un switch d'appels t() à chaîne littérale (I-B6, F-11 : le filet i18n ne lit que ceux-là). Rend { texte, code } ;
// `code` n'est posé que pour une réponse illisible du modèle. annule, interrompu et incertain disent que l'appel a peut-être été compté (I-B7).
export function texteEchecLecture(erreur) {
  const raison = typeof erreur?.raison === 'string' ? erreur.raison : 'interne';
  const extra = erreur?.extra && typeof erreur.extra === 'object' ? erreur.extra : {};
  switch (raison) {
    case 'interdit': return { texte: t('Cette adresse ne peut pas être lue par l’assistant : seule une page publique en https est admise. Ouvre-la toi-même.'), code: null };
    case 'inaccessible': return { texte: t('La page n’a pas pu être téléchargée (site injoignable, trop lent, ou qui refuse les robots). Ouvre-la toi-même.'), code: null };
    case 'pas_une_page': return { texte: t('Cette adresse n’est pas une page web (PDF, image…) : l’assistant ne la lit pas.'), code: null };
    case 'page_trop_lourde': return { texte: t('Cette page est trop lourde pour être lue.'), code: null };
    case 'page_vide': return { texte: t('Aucun texte lisible sur cette page. Ouvre-la toi-même.'), code: null };
    case 'annule': return { texte: t('Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.'), code: null };
    case 'interrompu': return { texte: t('La lecture a été interrompue. L’appel a peut-être été compté ; relancer en coûtera un autre.'), code: null };
    case 'incertain': return { texte: t('L’appel a peut-être été compté ; relancer en coûtera un autre.'), code: null };
    case 'coupe': return { texte: t('La lecture a été coupée : la page est trop longue pour l’assistant.'), code: null };
    case 'hors_bornes':
      if (extra.source_kind === 'jsonld') return { texte: t('La recette de cette page dépasse ce que l’app peut lire (plus de 80 ingrédients ou 60 étapes, ou une ligne trop longue). Ouvre la page.'), code: null };
      return { texte: t('L’assistant n’a pas répondu lisiblement. Réessaie.'), code: t('Code : {c}', { c: raison }) };
    case 'illisible': return { texte: t('L’assistant n’a pas répondu lisiblement. Réessaie.'), code: t('Code : {c}', { c: raison }) };
    case 'vide': return { texte: t('Aucun ingrédient ni étape lus sur cette page.'), code: null };
    case 'lien': return { texte: t('Le titre lu contenait une adresse web : lecture refusée. Ouvre la page.'), code: null };
    // Ronde 1 : un REFUS (jamais une raison du journal) — un import ouvert d'une autre sorte tient la fiche (demarrerLectureWeb, I-2 du lot A) ; la
    // phrase du lot A pour un vol tenu, jamais « L’assistant n’a pas répondu » (aucun appel n'est parti).
    case 'transition': return { texte: t('Une lecture est déjà en cours : annule-la d’abord.'), code: null };
    default: return { texte: texteRefusAssistant({ raison, quota: extra.quota, trop_lourd: extra.trop_lourd }) ?? texteEchecAssistant({ message: raison, quota: extra.quota, trop_lourd: extra.trop_lourd }), code: null };
  }
}

// --- « Enregistrer » (§ 4.3.4) : UNE transaction conditionnée (a_verifier → enregistre) avec la version — et la fiche, sauf « Ajouter sans
// remplacer » (B-24 : la fiche ne change pas, aucun put recipes). Le résultat stocké est REVALIDÉ (I-B2) ; le signet et ses versions sont RELUS
// juste avant. Une version humaine existante (D-B8) → « Remplacer par cette lecture ? » ; fermer le dialogue n'écrit rien (B-13). Rend
// { issue: 'enregistre', recipeId, versionId } | { issue: 'annule' } | { issue: 'refuse', raison } | { issue: 'echec', raison: 'illisible' }. `cle` (cleLecture
// de la ligne AFFICHÉE) : une autre lecture arrivée entre le rendu et le clic, ou pendant le dialogue, n'est jamais enregistrée sans avoir été vue
// (refus `lecture` avant, TransitionRefusee dans la transaction). Ronde 1 : le signet et ses versions sont RELUS APRÈS le dialogue — la fiche reçue
// modifiée pendant la question (favori, mots-clés, cuisines, titre) est celle qu'on recompose ; supprimée, elle n'est jamais ressuscitée et aucune
// version orpheline n'est écrite (refus `inconnu`, T4-R1-c du lot A) ; si ce qui fonde la question a changé (version courante, version écrite à la
// main), la question est reposée. Il reste la fenêtre sans dialogue entre la dernière relecture et la transaction (celle de decider() du lot A) :
// db.mutate ne sait conditionner qu'un statut, et une fiche n'en a pas.
// a_verifier → echec(illisible), pour LA lecture relue et jugée illisible, jamais pour une autre arrivée entre-temps (cleLecture, T4-R2 du lot A).
async function marquerIllisible(repo, ligne) {
  const cle = cleLecture(ligne);
  const patch = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', ligne.id, c.status); return { status: 'echec', erreur: { raison: 'illisible', extra: {} }, resultat: null }; };
  try { await repo.transitionner('imports', ligne.id, { attendus: ['a_verifier'], patch }); }
  catch (e) { if (!estRefus(e)) logError('import_web.revalidation', { error: e, id: ligne.id }); }
}
export async function enregistrerLecture(importId, { repo = repoModule, remplacer = null, maintenant = horloge, choisir = chooseDialog, cle = null } = {}) {
  const ligne = await repo.get('imports', importId);
  if (!ligne || ligne.kind !== 'web' || ligne.status !== 'a_verifier') return refus('statut');
  if (cle !== null && cleLecture(ligne) !== cle) return refus('lecture'); // la lecture affichée a été remplacée : rien d'écrit, l'écran se redessine
  const lu = relireResultat(ligne.resultat);
  if (!lu) { await marquerIllisible(repo, ligne); return { issue: 'echec', raison: 'illisible' }; }
  const relire = async () => {
    const signet = await repo.get('recipes', ligne.recipe_id);
    return signet ? { signet, versions: await repo.byIndex('recipe_versions', 'recipe_id', signet.id) } : null; // supprimé : jamais ressuscité
  };
  const fondement = (f) => JSON.stringify([f.signet.current_version_id ?? null, versionHumaine(f.versions)]);
  let fiche = await relire();
  if (!fiche) return refus('inconnu');
  let choix = remplacer;
  while (choix === null && versionHumaine(fiche.versions)) {
    // Défaut « non » (comme I-5 du lot A) : la première option est « Ajouter sans remplacer ».
    const avant = fondement(fiche);
    const r = await choisir(t('Remplacer par cette lecture ?'), [{ value: 'ajouter', label: t('Ajouter sans remplacer') }, { value: 'remplacer', label: t('Remplacer') }]);
    if (r !== 'ajouter' && r !== 'remplacer') return { issue: 'annule' };
    fiche = await relire();
    if (!fiche) return refus('inconnu');
    if (fondement(fiche) === avant) choix = r === 'remplacer'; // sinon la question est reposée (ou n'a plus lieu d'être)
  }
  const fab = fabriquerLectureWeb(lu.recette, { signet: fiche.signet, versions: fiche.versions, page: lu.page, sourceKind: lu.source_kind, importId: ligne.id, modele: modeleBorne(ligne.model), maintenant: maintenant(), ...(choix === false ? { remplacer: false } : {}) });
  const cleLue = cleLecture(ligne);
  const cloture = (c) => { if (cleLecture(c) !== cleLue) throw new TransitionRefusee('imports', ligne.id, c.status); return { status: 'enregistre', reponse_brute: null, finished_at: maintenant() }; };
  try {
    await repo.transitionner('imports', ligne.id, { attendus: ['a_verifier'], patch: cloture, puts: { recipe_versions: [fab.version], ...(choix === false ? {} : { recipes: [fab.recipe] }) } });
  } catch (e) {
    if (estRefus(e)) return refus('transition'); // enregistré, ignoré ou relu par un autre onglet juste avant : rien d'écrit
    throw e;
  }
  return { issue: 'enregistre', recipeId: fiche.signet.id, versionId: fab.version.id };
}

// --- L'écran #/recipes/<id>/importer, variante web (§ 4.2) ---------------------------------------------------------------------------------------
// Ouvert par renderImportCible quand la fiche porte une adresse (sens unique). Gestes injectables { repo, navigate, toast, fetch, maintenant,
// enLigne, battementMs, choisir, veilleMs }. L'état est relu dans la base à chaque redessin ; le résultat d'une lecture est revalidé à chaque rendu (I-B2) ;
// tout texte lu est rendu en nœud texte ; l'hôte RECALCULÉ est toujours dit en premier (I-B5).
export async function renderImportWeb(params, query, ctx, { repo = repoModule, navigate = naviguerDom, toast = toastDom, fetch: fetchInjecte = undefined, maintenant = horloge, enLigne = () => enLigneFlag, battementMs = BATTEMENT_MS, choisir = chooseDialog, veilleMs = repoModule.BATTEMENT_MORT_MS + 1000 } = {}) {
  const recipe = ctx?.recipesById?.get(params?.id);
  const root = el('div', null);
  // lu : la lecture relue (relireResultat) de la ligne a_verifier, calculée UNE fois par chargement (ronde 1) — null = illisible ou pas de lecture.
  const etat = { ligne: null, lu: null, versions: [], occupe: false };
  root.etatRouteWeb = () => ({ importId: etat.ligne?.id ?? null, status: etat.ligne?.status ?? null, vol: !!etat.ligne && volEnCours()?.importId === etat.ligne.id, remplacement: etat.versions.length ? versionHumaine(etat.versions) : null });
  if (!recipe) { root.append(el('div', { class: 'card' }, t('Recette introuvable.'))); return root; }
  const lien = lienSignet(recipe.source_url);
  const https = lien.ok && lien.href.startsWith('https:');
  const connecter = () => demarrerConnexion(ctx?.sync?.auth);
  const gestes = { repo, fetch: fetchInjecte, maintenant, enLigne, battementMs };
  let session = await sessionAssistant(ctx);
  // L'import web OUVERT de cette fiche : « ouvert » = importOuvert (R-B-18, par ouverteWeb). Après synchro, plusieurs appareils peuvent en avoir chacun
  // un (I-2 ne vaut que par appareil) : R-B-20, comme VF-6 du lot A — `prefere` (la ligne affichée, puis ?import= de « Reprendre ») d'abord, puis une
  // lecture reçue (a_verifier), puis celle de cet appareil.
  const ligneOuverte = async (prefere = null) => ligneWebOuverte(await repo.byIndex('imports', 'recipe_id', recipe.id), recipe.id, { prefere, moi: moiDe(repo) });
  const lecture = (L) => (L?.status === 'a_verifier' ? relireResultat(L.resultat) : null);
  // L'état est posé d'UN coup, après la dernière lecture : etatRouteWeb() ne montre jamais une ligne que l'écran n'a pas encore dessinée.
  async function charger() {
    const prefere = etat.ligne?.id ?? (typeof query?.import === 'string' ? query.import : null);
    let L = await ligneOuverte(prefere);
    let lu = lecture(L);
    // I-B2 : un résultat illisible n'est jamais rendu comme une lecture ; il est marqué echec(illisible) pour LA lecture relue (cleLecture, R-B-10).
    // Une autre lecture arrivée entre-temps (un autre onglet, une réception) est relue et jugée à son tour : deux passes au plus — au-delà, dessiner()
    // la montre comme un échec sans l'écrire (hors brief : jamais une levée sur une donnée hostile ; status reste celui de la base, a_verifier).
    // Ronde 1 : jamais pendant que CE document relance cette ligne (« Réessayer » d'une lecture illisible, relire) — le départ du vol l'efface déjà.
    for (let passe = 0; passe < 2 && L?.status === 'a_verifier' && !lu && volEnCours()?.importId !== L.id; passe += 1) { await marquerIllisible(repo, L); L = await ligneOuverte(prefere); lu = lecture(L); }
    const versions = await repo.byIndex('recipe_versions', 'recipe_id', recipe.id);
    etat.ligne = L; etat.lu = lu; etat.versions = versions;
  }
  let file = Promise.resolve();
  const redessiner = () => { file = file.then(async () => { await charger(); dessiner(); }).catch((e) => logError('import_web.rendu', { error: e })); return file; };
  // Redessinée à chaque transition d'un vol de lecture (et au passage en ligne / hors ligne) — une fois MONTÉE (ronde 1, comme l'écran du lot A) : le
  // routeur insère la racine APRÈS la fin de la route ; au tour suivant, une racine dans le document s'abonne et se redessine (une transition notifiée
  // avant le montage n'est pas perdue), une racine jamais montée ne s'abonne pas ; une racine retirée se désabonne à la première notification qui la
  // trouve détachée.
  let desabonner = null;
  const rappel = () => { if (root.isConnected) redessiner(); else if (desabonner) { desabonner(); desabonner = null; } };

  // --- Gestes
  async function lire() {
    if (etat.occupe || volEnCours()) return;
    etat.occupe = true;
    try {
      const relu = (await repo.get('recipes', recipe.id)) ?? recipe;
      const r = await demarrerLectureWeb({ recipe: relu, ctx: { ...ctx, imports: etat.ligne ? [etat.ligne] : [] } }, gestes);
      if (r.issue === 'refuse') toast(texteEchecLecture({ raison: r.raison === 'adresse' ? 'interdit' : r.raison }).texte);
      else if (r.lancement) { etat.occupe = false; await redessiner(); const issue = await r.lancement; if (issue.raison === 'non_connecte') session = null; }
    } catch (e) { logError('import_web.lire', { error: e }); }
    finally { etat.occupe = false; }
    await redessiner();
  }
  async function relancer({ relire = false } = {}) {
    const L = etat.ligne; if (!L || etat.occupe || volEnCours()) return;
    // « Relire la page » ne vaut que pour LA lecture affichée (P-12, ronde 1) : une autre arrivée entre-temps → refus, redessin.
    const promesse = lancerLecture(L.id, { ctx, ...gestes, relire, cle: relire ? cleLecture(L) : null });
    await redessiner();
    const issue = await promesse;
    if (issue.raison === 'non_connecte') session = null;
    await redessiner();
  }
  async function annuler() { const L = etat.ligne; if (!L) return; await annulerLecture(L.id); await redessiner(); }
  async function ignorer() {
    const L = etat.ligne; if (!L || etat.occupe) return;
    // « Ignorer » vaut pour LA lecture affichée (T4-R2 du lot A) : une lecture relancée ailleurs depuis le dessin n'est pas ignorée sans avoir été vue —
    // le redessin la montre.
    const cle = cleLecture(L);
    const patch = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return { status: 'ignore', finished_at: maintenant() }; };
    try { await repo.transitionner('imports', L.id, { attendus: ['a_lancer', 'a_verifier', 'echec'], patch }); }
    catch (e) { if (!estRefus(e)) logError('import_web.ignorer', { error: e, id: L.id }); await redessiner(); return; }
    if (root.isConnected) navigate(`/recipes/${encodeURIComponent(recipe.id)}`);
  }
  async function enregistrer() {
    const L = etat.ligne; if (!L || etat.occupe) return;
    etat.occupe = true; dessiner();
    let r = null;
    try { r = await enregistrerLecture(L.id, { repo, maintenant, choisir, cle: cleLecture(L) }); }
    catch (e) { logError('import_web.enregistrer', { error: e, id: L.id }); toast(t('La recette n’a pas pu être enregistrée. Réessaie.')); }
    finally { etat.occupe = false; }
    if (r?.issue === 'enregistre' && root.isConnected) { toast(t('Recette enregistrée')); navigate(`/recipes/${encodeURIComponent(recipe.id)}?v=${encodeURIComponent(r.versionId)}`); return; }
    await redessiner(); // annulé (rien d'écrit), refusé (un autre onglet, ou une autre lecture arrivée), illisible (echec écrit)
  }

  // --- Dessin
  const peutLire = () => !!session && enLigne() && !volEnCours() && https && !etat.occupe;
  const retour = () => el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(recipe.id)}` }, t('Retour à la fiche'));
  const ouvrir = (classe = 'btn') => (lien.ok ? el('a', { class: classe, href: lien.href, target: '_blank', rel: 'noopener noreferrer' }, t('Ouvrir le lien')) : null);
  const enTete = () => el('header', { class: 'stack', style: { marginBottom: '1rem' } },
    el('a', { href: `#/recipes/${encodeURIComponent(recipe.id)}`, class: 'muted', style: { textDecoration: 'none', fontSize: '.9rem' } }, `← ${t('Fiche recette')}`),
    el('p', { class: 'muted', style: { margin: 0 } }, t('Lire une recette web')),
    el('div', { class: 'row between top' },
      el('div', null, el('h1', null, recipe.original_title), el('p', { class: 'muted', dataset: { role: 'hote' } }, lien.ok ? lien.hote : t('Adresse non reconnue'))),
      availabilityBadge(recipe)),
    el('div', { class: 'row' }, ouvrir()));
  const horsLigne = () => (enLigne() ? null : el('div', { class: 'status warn', dataset: { role: 'hors-ligne' } }, t('Tu es hors ligne.')));
  function zoneLancer() {
    const bloc = el('div', { class: 'card stack', dataset: { role: 'action' } });
    if (!session) bloc.append(carteConnexion(connecter, ctx));
    bloc.append(...[horsLigne()].filter(Boolean),
      el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', dataset: { role: 'lire-web' }, disabled: !peutLire(), onClick: lire }, t('Lire la recette avec l’assistant')), retour()),
      el('small', { class: 'muted' }, t('Une lecture = un appel à l’assistant, compté dans ton quota du jour.')));
    if (!https && lien.ok) bloc.append(el('div', { class: 'status warn', dataset: { role: 'interdit' } }, texteEchecLecture({ raison: 'interdit' }).texte));
    if (etat.versions.length) bloc.append(el('small', { class: 'muted', dataset: { role: 'remplacement' } }, versionHumaine(etat.versions) ? t('Ta version écrite à la main n’est jamais remplacée sans question.') : t('La lecture remplacera la version lue par l’assistant.')));
    return bloc;
  }
  function zoneVol(L) {
    const bloc = el('div', { class: 'card stack', dataset: { role: 'action' } });
    if (volEnCours()?.importId === L.id) bloc.append(el('div', { class: 'status', role: 'status' }, t('Lecture de la page par l’assistant…')), el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', dataset: { role: 'annuler' }, onClick: annuler }, t('Annuler'))));
    else bloc.append(el('div', { class: 'status warn' }, t('En cours sur un autre écran')), el('div', { class: 'row' }, retour())); // I-B3 : sans « Annuler »
    return bloc;
  }
  function zoneLue(lu) {
    const { page, recette } = lu;
    const hote = page.hote ?? (lien.ok ? lien.hote : '');
    const quand = page.lue_le ? formatDate(page.lue_le, { withTime: true }) : null;
    const declares = [page.site, page.auteur].filter(Boolean).join(' · ');
    const bloc = el('div', { class: 'stack', dataset: { role: 'lecture' } },
      el('div', { class: 'status', dataset: { role: 'bandeau-web' } }, t('Lue sur {hote} — vérifie avant d’enregistrer.', { hote })),
      declares ? el('div', { class: 'muted', dataset: { role: 'selon-la-page' } }, t('Selon la page : {s}', { s: quand ? `${declares} · ${quand}` : declares })) : (quand ? el('div', { class: 'muted', dataset: { role: 'selon-la-page' } }, t('Lue le {d}', { d: quand })) : null),
      el('div', { class: 'muted', dataset: { role: 'mode' } }, lu.source_kind === 'jsonld' ? t('Lue dans les données de la page : aucun jeton dépensé.') : t('Texte de la page lu par l’assistant.')));
    if (page.texte_coupe) bloc.append(el('div', { class: 'status warn' }, t('La page était longue : la fin n’a pas été lue.')));
    if (page.autres_recettes > 0) bloc.append(el('div', { class: 'status warn' }, t('D’autres recettes étaient sur cette page : ouvre-la.')));
    if (recette.incomplete) bloc.append(el('span', { class: 'chip warn' }, t('lecture incomplète')));
    if (recette.uncertain_fields.length) { const joint = recette.uncertain_fields.join(' ; '); bloc.append(el('div', { class: 'muted', dataset: { role: 'incertain' } }, t('Incertain : {t}', { t: Array.from(joint).length <= INCERTAIN_MAX ? joint : Array.from(joint).slice(0, INCERTAIN_MAX - 1).join('') + '…' }))); }
    const lus = new Set(motsDistinctifs(recette.title)); const signes = new Set(motsDistinctifs(recipe.original_title));
    if (recette.title && (lus.size !== signes.size || [...lus].some((m) => !signes.has(m)))) bloc.append(el('div', { dataset: { role: 'titre-lu' } }, etat.versions.length ? t('Titre lu : {t}', { t: recette.title }) : t('Titre lu : {t} — ce sera le titre de la fiche.', { t: recette.title })));
    const temps = [recette.prep_minutes != null ? t('préparation {p} min', { p: recette.prep_minutes }) : null, recette.cook_minutes != null ? t('cuisson {c} min', { c: recette.cook_minutes }) : null, recette.total_minutes != null ? t('total {m} min', { m: recette.total_minutes }) : null].filter(Boolean);
    if (recette.servings != null || temps.length) bloc.append(el('div', { class: 'muted', dataset: { role: 'portions-temps' } }, [recette.servings != null ? t('{n} portions', { n: recette.servings }) : null, ...temps].filter(Boolean).join(' · ')));
    bloc.append(section(t('Ingrédients'), el('ul', { class: 'list plain' }, ...recette.ingredients.map((l) => el('li', null, l.source_text, l.uncertain ? el('span', { class: 'chip warn', style: { marginLeft: '.4rem' } }, t('incertain')) : null)))));
    bloc.append(section(t('Étapes'), el('ol', { class: 'list steps' }, ...recette.steps.map((s) => el('li', null, el('div', { style: { whiteSpace: 'pre-line' } }, s.text))))));
    if (recette.notes) bloc.append(section(t('Notes'), el('p', null, recette.notes)));
    bloc.append(el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn primary', dataset: { role: 'enregistrer-lecture' }, disabled: etat.occupe, onClick: enregistrer }, t('Enregistrer')),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'relire-page' }, disabled: !peutLire(), onClick: () => relancer({ relire: true }) }, t('Relire la page')),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'ignorer' }, disabled: etat.occupe, onClick: ignorer }, t('Ignorer'))),
      el('small', { class: 'muted' }, t('Toutes les lignes restent à vérifier : « Corriger » sur la fiche.')));
    return bloc;
  }
  function zoneEchec(L, erreur = L.erreur) {
    const { texte, code } = texteEchecLecture(erreur);
    const bloc = el('div', { class: 'card stack', dataset: { role: 'action' } },
      el('div', { class: 'status warn', role: 'status', dataset: { role: 'echec' } }, el('span', null, texte), code ? el('small', { class: 'muted' }, code) : null));
    if (!session) bloc.append(carteConnexion(connecter, ctx));
    // Ronde 1 : une lecture illisible restée a_verifier (dessiner(), cas non écrit) se relance comme « Relire la page » — jamais un geste refusé en silence.
    const relire = L.status === 'a_verifier';
    bloc.append(...[horsLigne()].filter(Boolean), el('div', { class: 'row' }, ouvrir('btn primary'),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'reessayer' }, disabled: !peutLire(), onClick: () => relancer({ relire }) }, t('Réessayer')),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'ignorer' }, onClick: ignorer }, t('Ignorer')), retour()));
    return bloc;
  }
  // Vague finale (VF-15 du lot A, transposé) : une ligne en_cours que CE document ne tient pas (onglet rechargé, PWA tuée puis rouverte dans les 90 s)
  // n'attend plus un redémarrage : la passe `interrompu` (repo.marquerInterrompus, mêmes règles, horloge de l'écran) est rejouée à l'affichage, puis
  // toutes les BATTEMENT_MORT_MS + 1 s tant que la ligne reste en vol ailleurs et l'écran monté ; une passe qui interrompt redessine (I-B7, « Réessayer »).
  let veille = null;
  function veiller(maintenantAussi = true) {
    const L = etat.ligne;
    if (veille || L?.status !== 'en_cours' || volEnCours()?.importId === L.id || typeof repo.marquerInterrompus !== 'function') return;
    const passe = () => { const m = Date.parse(maintenant()); return repo.marquerInterrompus(Number.isFinite(m) ? m : undefined).then((n) => (n ? redessiner() : null)).catch((e) => logError('import_web.interrompus', { error: e })); };
    if (maintenantAussi) passe();
    veille = setTimeout(() => { veille = null; if (root.isConnected) passe().then(() => veiller(false)); }, veilleMs);
  }
  function dessiner() {
    const L = etat.ligne; const statut = L?.status ?? null;
    const illisible = statut === 'a_verifier' && !etat.lu; // voir charger() : jamais rendue comme une lecture, jamais une levée
    const zone = statut === 'en_cours' ? zoneVol(L) : illisible ? zoneEchec(L, { raison: 'illisible', extra: {} }) : statut === 'a_verifier' ? zoneLue(etat.lu) : statut === 'echec' ? zoneEchec(L) : zoneLancer();
    root.replaceChildren(enTete(), zone);
    veiller();
  }
  await charger();
  dessiner();
  setTimeout(() => { if (root.isConnected && !desabonner) { desabonner = ecouterLecture(rappel); redessiner(); } }, 0); // abonnement après le montage
  return root;
}
