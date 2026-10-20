// Lire une recette web (lot B « Recette web complète », spec docs/superpowers/specs/2026-10-19-recette-web-design.md, § 4.1, § 4.3) : démarrer une
// lecture (depuis la fiche d'un signet, ou « Garder et lire » de l'onglet Web), la lancer, l'annuler. Le vol est celui du DOCUMENT (./vol.js,
// partagé avec l'extraction de pages : I-B3) ; toute écriture passe par repo.saveBatch conditionné (création, I-2 du lot A) ou repo.transitionner
// (I-10) ; l'adresse lue est celle du signet RELU en base, jamais celle de l'écran (D-B4). Sens unique : ce module n'importe jamais
// ./import-cible.js (D-B13). Gestes injectables { repo, fetch, maintenant, enLigne, battementMs, langue } : la suite n'ouvre aucun réseau.
import { getUiLocale } from '../core/i18n.js';
import { logError } from '../core/log.js';
import { borner } from '../core/bornes.js';
import { lienSignet, doublonDAdresse } from '../core/lien.js';
import { TransitionRefusee } from '../core/db.js';
import * as repoModule from '../model/repo.js';
import { LIMITES_PASSERELLE } from '../domain/passerelle.js';
import { RAISONS_ECHEC, IMPORTS_OUVERTS, importOuvert } from '../domain/import-cible.js';
import { lireRecetteWeb, fabriquerImportWeb } from '../domain/lecture-web.js';
import { sessionAssistant } from './components.js';
import { signetModel, fabriquerSignet, LIMITES_SIGNET } from './signet.js';
import { DOCUMENT_ID, BATTEMENT_MS, prendreVol, libererVol, volTenu } from './vol.js';

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

// R-B-18 : « ouvert » a UNE définition, importOuvert (src/domain/import-cible.js, m10 / VF-11 du lot A), APPELÉE ici (ronde 1 : plus de copie de sa
// règle) — jamais la négation des statuts terminés : une ligne reçue au statut inconnu ou nul ne masque pas la fiche. importOuvert ne liste la sorte
// 'web' qu'à la tâche 6 (KINDS_IMPORT + 'web', P-1) : d'ici là, une ligne déjà reconnue web lui est présentée sous une sorte qu'elle liste (seule la
// sorte est substituée) ; à la tâche 6, ce prédicat devient importOuvert(i) && i.kind === 'web' && i.recipe_id === recipeId (même résultat).
const ouvertDe = (imports, recipeId) => (Array.isArray(imports) ? imports : []).find((i) => i?.kind === 'web' && i.recipe_id === recipeId && importOuvert({ ...i, kind: 'recette' })) || null;

// --- Lancer (§ 4.3.2) -----------------------------------------------------------------------------------------------------------------------------
// MÊME forme de retour que lancerExtraction (lot A, F-8) : { issue: 'refuse', raison } (vol_tenu, inconnu, statut, hors_ligne, non_connecte,
// interdit, transition), { issue: 'echec', raison, ecrit? }, { issue: 'a_verifier' }. Le vol est pris AVANT tout await et libéré en finally ;
// `appels + 1` au moment où le fetch part ; la réponse lue est écrite dans le journal (a_verifier) avant tout rendu (I-B4). `relire` : un
// import a_verifier repart (a_verifier → en_cours en UNE transaction, « Relire la page »). Le battement vit HORS de la ligne synchronisée (R-B-17).
export async function lancerLecture(importId, { ctx, repo = repoModule, fetch: fetchInjecte = undefined, maintenant = horloge, enLigne = () => enLigneFlag, battementMs = BATTEMENT_MS, relire = false } = {}) {
  const tenue = { importId, controller: new AbortController(), repo };
  if (!prendreVol(tenue)) return refus('vol_tenu'); // y compris quand c'est une extraction de pages qui tient le document
  const liberer = () => libererVol(tenue);
  let battement = null;
  try {
    const ligne = await repo.get('imports', importId);
    if (!ligne || ligne.kind !== 'web') { liberer(); return refus('inconnu'); }
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
    try {
      await repo.transitionner('imports', importId, { attendus: relire ? ['a_lancer', 'echec', 'a_verifier'] : ['a_lancer', 'echec'], patch: { status: 'en_cours', started_at: depart, document_id_vol: DOCUMENT_ID, battement_at: depart, erreur: null, resultat: null, reponse_brute: null, model: null, duree_ms: null } });
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
    ligne = ouvertDe(ctx?.imports, recipe.id);
    if (!ligne) {
      const neuve = fabriquerImportWeb({ id: repo.newId('imp'), signet: recipe, deviceId: repo.deviceId() });
      try {
        await repo.saveBatch({ imports: [neuve] }, { conditions: { imports: [{ key: neuve.id, absente: true }, { index: 'recipe_id', valeur: recipe.id, exclus: IMPORTS_OUVERTS }] } });
        ligne = neuve;
      } catch (e) {
        if (!estRefus(e)) throw e;
        ligne = ouvertDe(await repo.byIndex('imports', 'recipe_id', recipe.id), recipe.id); // créé entre le rendu et la tape : repris, zéro appel de trop
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
