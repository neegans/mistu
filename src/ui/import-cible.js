// L'écran d'import ciblé #/recipes/<id>/importer (lot A « Importer une recette repérée », spec docs/superpowers/specs/2026-10-18-import-cible-design.md :
// § 4.1 entrées, § 4.2 l'écran, § 4.3 extraction et enregistrement, § 4.4 cas et textes ; invariants I-2, I-3, I-4, I-7, I-9, I-10 ; Review Focus 2 et 4).
// Une référence « Repérée dans ton livre » (ou une recette partielle) s'ouvre déjà rattachée : la personne ajoute ses pages (persistées AVANT tout
// appel, dans le journal `imports`), les remet dans l'ordre, pose la photo du plat si le livre en a une, puis « Extraire et enregistrer ».
// Tout ce que l'écran écrit passe par repo.transitionner (une seule primitive, I-10) ; rien n'est inventé ; la sortie du modèle est une DONNÉE
// HOSTILE (validée par validateParsedRecipe, revalidée quand elle revient du journal, rendue en nœuds texte). L'état du VOL vit au niveau du
// module (I-7 : un seul import en vol par document, tenu par DOCUMENT_ID) ; tout le reste est relu dans la base à chaque redessin.
// Dépendances injectables { repo, navigate, toast, fetch, pickFiles, maintenant, battementMs } : la suite n'ouvre ni sélecteur ni réseau.
import { el, toast as toastDom, pickFiles as pickDom, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate as naviguerDom } from '../core/router.js';
import { logError } from '../core/log.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { sha256Hex } from '../core/hash.js';
import { preparerPhotoLocale } from '../core/image.js';
import { TransitionRefusee } from '../core/db.js';
import { safeDisplayType } from '../sync/mime.js';
import * as repoModule from '../model/repo.js';
import { IMPORTS_TERMINES } from '../model/schema.js';
import { PasserelleProvider, extraireRecette, validateParsedRecipe, ErreurExtraction, pagePourEnvoi, MAX_TOKENS_EXTRACTION } from '../domain/llm.js';
import { discordance, deplacerPage, retirerPage, fabriquerExtraction, RAISONS_ECHEC } from '../domain/import-cible.js';
import { getConvention } from '../domain/units.js';
import { section, sessionAssistant, carteConnexion, texteEchecAssistant } from './components.js';
import { demarrerConnexion } from './settings.js';
import { messageErreurImage } from './livre-ajout.js';

// --- État du module (I-7) ----------------------------------------------------------------------------------------------------------------------
// Le document (onglet) : tiré à l'import du module, écrit dans imports.document_id_vol pendant un vol ; « Annuler » n'est offert que par lui.
export const DOCUMENT_ID = crypto.randomUUID();
// Le battement du vol (spec § 3.1) : toutes les 15 s, battement_at est réécrit (origine device : jamais en file) ; au démarrage, une ligne en_cours
// dont le battement a plus de 90 s passe interrompu (tâche 6).
export const BATTEMENT_MS = 15000;
const ATTENDUS_PAGES = ['a_lancer', 'a_verifier', 'echec']; // les statuts qui acceptent des pages et une photo (spec § 3.6)
const horloge = () => new Date().toISOString();
let vol = null; // { importId, controller, repo } — UN vol par document ; posé AVANT tout await (double tape), libéré en finally
const vues = new Set(); // { root, redessiner, majEnLigne } : les instances de l'écran, purgées par isConnected
// En ligne / hors ligne (spec § 4.2.4) : le bouton suit les événements de la fenêtre, pas seulement navigator.onLine au rendu.
let enLigneFlag = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { enLigneFlag = true; majEnLigneToutes(); });
  window.addEventListener('offline', () => { enLigneFlag = false; majEnLigneToutes(); });
}
export const volEnCours = () => (vol ? { importId: vol.importId } : null);
export function reinitialiserImportCible() { vol?.controller.abort(); vol = null; vues.clear(); enLigneFlag = typeof navigator === 'undefined' ? true : navigator.onLine !== false; } // tests seulement
function notifier() { for (const v of [...vues]) { if (!v.root.isConnected) { vues.delete(v); continue; } v.redessiner(); } }
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
// « Rattacher » (D-6) vaut pour LA lecture à laquelle il a été répondu : la ligne, le départ de son vol et son résultat. Une lecture arrivée d'un
// autre onglet entre-temps (même id, même statut a_verifier) a une autre clé → la discordance est redemandée (T4-R1).
const cleLecture = (L) => JSON.stringify([L.id, L.started_at ?? null, L.resultat ?? null]);
// Deux champs relus du journal, bornés avant d'entrer dans la fiche (T4-R1) : le modèle ≤ 80 points de code (la borne de PasserelleProvider), la
// photo du plat = une empreinte hexadécimale de 64 (la clé de files) ; tout le reste vaut null.
const modeleBorne = (m) => (typeof m === 'string' && Array.from(m).length <= 80 ? m : null);
const photoBornee = (L) => (typeof L?.photo_sha256 === 'string' && /^[0-9a-f]{64}$/.test(L.photo_sha256) ? { sha256: L.photo_sha256, origin: L.photo_origin ?? null } : null);
// La question à poser avant d'écrire (pure) : la discordance tant que « Rattacher » n'a pas été répondu pour CETTE lecture, puis « Remplacer par
// cette lecture ? » (I-5) tant qu'elle n'a pas de réponse ; null = écrire.
const questionAPoser = ({ ok, rattachee, remplacement, remplacer }) => (!ok && !rattachee ? 'discordance' : (remplacement && remplacer === null ? 'remplacer' : null));

// Les images qui PARTENT, dans l'ordre de page_ids (seule source de vérité de l'ordre), réduites par pagePourEnvoi (F-3). Une page absente
// est ignorée (pointeur souple, § 3.1) ; une page dont les octets ne sont pas sur cet appareil fait refuser l'envoi (rien n'est lu à moitié).
async function imagesDe(repo, pageIds) {
  const images = [];
  for (const id of pageIds) {
    const page = await repo.get('source_pages', id);
    if (!page?.sha256) continue;
    const fichier = await repo.getFile(page.sha256);
    if (!(fichier?.blob instanceof Blob)) { const e = new Error('octets_absents'); e.code = 'octets_absents'; throw e; }
    images.push(await pagePourEnvoi(fichier.blob));
  }
  return images;
}

// --- Le vol (spec § 4.3.1-2, I-3, I-4, I-7 ; exporté pour la section « Imports », tâche 6) -------------------------------------------------------
// Gardes dans l'ordre : vol tenu par ce document, import inconnu, hors ligne, session, au moins une page avec ses octets ; puis la transition
// a_lancer | echec → en_cours (started_at, document_id_vol, battement_at) ; `appels + 1` AU MOMENT où le fetch part (pas avant) ; UN appel ;
// la réponse validée est écrite dans le journal (a_verifier) AVANT tout rendu ou toute écriture de recette (I-3). Rend { issue, raison } :
// 'refuse' (vol_tenu | inconnu | hors_ligne | non_connecte | sans_page | image | octets_absents | transition), 'echec' (raison § 4.4),
// 'a_verifier'. Ne lève jamais vers l'écran pour une raison attendue. `vol` est libéré en finally, quoi qu'il arrive.
export async function lancerExtraction(importId, { ctx, repo = repoModule, fetch: fetchInjecte = undefined, maintenant = horloge, enLigne = () => enLigneFlag, battementMs = BATTEMENT_MS } = {}) {
  if (vol) return refus('vol_tenu');
  const tenue = { importId, controller: new AbortController(), repo };
  vol = tenue; // AVANT tout await : une seconde tape pendant les gardes voit le vol (double clic → un POST)
  const liberer = () => { if (vol === tenue) vol = null; };
  let battement = null;
  try {
    const ligne = await repo.get('imports', importId);
    if (!ligne) { liberer(); return refus('inconnu'); }
    if (!enLigne()) { liberer(); return refus('hors_ligne'); }
    const session = await sessionAssistant(ctx);
    if (!session) { liberer(); return refus('non_connecte'); }
    const pageIds = Array.isArray(ligne.page_ids) ? ligne.page_ids : [];
    if (!pageIds.length) { liberer(); return refus('sans_page'); }
    let images;
    try { images = await imagesDe(repo, pageIds); }
    catch (e) { liberer(); return { issue: 'refuse', raison: e?.code === 'octets_absents' ? 'octets_absents' : 'image', code: e?.code ?? null }; }
    if (!images.length) { liberer(); return refus('sans_page'); }
    const depart = maintenant();
    try {
      await repo.transitionner('imports', importId, { attendus: ['a_lancer', 'echec'], patch: { status: 'en_cours', started_at: depart, document_id_vol: DOCUMENT_ID, battement_at: depart, erreur: null } });
    } catch (e) {
      liberer();
      if (estRefus(e)) return { issue: 'refuse', raison: 'transition', statut: e.statut }; // un autre onglet a enregistré ou ignoré entre-temps (I-10)
      throw e;
    }
    notifier();
    // Battement (spec § 3.1, m2) : même statut, origine device — hors file de synchro ; refusé sans bruit dès que le vol est fini.
    battement = setInterval(() => { repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { battement_at: maintenant() }, origin: 'device' }).catch(() => {}); }, battementMs);
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
      reponse = await extraireRecette(provider, images, { signal: tenue.controller.signal, maxTokens: MAX_TOKENS_EXTRACTION });
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
      await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { status: 'a_verifier', resultat: reponse.recette, reponse_brute: brute(reponse.texteBrut), model: reponse.modele ?? null, duree_ms, document_id_vol: null, erreur: null } });
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
    if (battement) clearInterval(battement);
    liberer();
    notifier();
  }
}

// « Annuler » (spec § 3.1, § 4.4, Review Focus 4) : seulement si CE document tient le vol de cet import — le fetch est abandonné (le serveur
// abandonne l'amont, lot passerelle F-5) et la ligne passe en_cours → echec(annule). Sinon rien n'est fait et false est rendu.
export async function annulerVol(importId) {
  if (!vol || vol.importId !== importId) return false;
  const { controller, repo } = vol;
  controller.abort();
  try { await repo.transitionner('imports', importId, { attendus: ['en_cours'], patch: { status: 'echec', erreur: { raison: 'annule', extra: {} }, document_id_vol: null } }); }
  catch (e) { if (!estRefus(e)) logError('import_cible.annuler', { error: e, id: importId }); }
  notifier();
  return true;
}

// Le texte d'une ligne echec (spec § 4.4) : les raisons de l'extraction et du journal ont leur phrase ici ; les raisons de la passerelle gardent
// les textes existants (texteEchecAssistant : refus en clair avec son nombre, texte générique + « Code : … » sinon). I-4 : interrompu, annule et
// incertain disent la même phrase. Rend { texte, code } ; `code` n'est posé que pour illisible / hors_bornes.
function texteEchec(erreur) {
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

// --- L'écran ------------------------------------------------------------------------------------------------------------------------------------
export async function renderImportCible(params, query, ctx, { repo = repoModule, navigate = naviguerDom, toast = toastDom, fetch: fetchInjecte = undefined, pickFiles = pickDom, maintenant = horloge, battementMs = BATTEMENT_MS } = {}) {
  const recipe = ctx?.recipesById?.get(params?.id);
  const root = el('div', null);
  // ligne : l'import NON TERMINÉ de cette recette (un seul, I-2) ; pages : ses source_pages par id ; question : 'discordance' | 'remplacer' | null ;
  // rattache : la clé (cleLecture) de LA lecture pour laquelle « Rattacher » a été répondu, sinon null ; verdict : la discordance calculée par
  // decider() ; focus : le bouton à focaliser après un déplacement ; occupe : une écriture est en cours (aucune double pose).
  const etat = { ligne: null, pages: new Map(), question: null, rattache: null, verdict: null, focus: null, occupe: false };
  root.etatRoute = () => ({ importId: etat.ligne?.id ?? null, status: etat.ligne?.status ?? null, pageIds: [...(Array.isArray(etat.ligne?.page_ids) ? etat.ligne.page_ids : [])], vol: !!vol && !!etat.ligne && vol.importId === etat.ligne.id, discordance: etat.verdict });
  if (!recipe) { root.append(el('div', { class: 'card' }, t('Recette introuvable.'))); return root; }
  // D-11 : un signet web ou une recette qui a déjà son texte n'a pas d'entrée ici — le dire, revenir à la fiche.
  if (recipe.source_url) { toast(t('Un lien web s’importe au lot suivant.')); navigate(`/recipes/${encodeURIComponent(recipe.id)}`); return root; }
  if (recipe.availability === 'available') { toast(t('Cette recette a déjà son texte.')); navigate(`/recipes/${encodeURIComponent(recipe.id)}`); return root; }

  const edition = recipe.edition_id ? ctx.editionsById?.get(recipe.edition_id) ?? null : null;
  const book = edition ? ctx.booksById?.get(edition.book_id) ?? null : null;
  const connecter = () => demarrerConnexion(ctx?.sync?.auth);
  const urls = new Map(); // sha256 → URL blob: de cette instance (révoquées par app.js au changement de route)
  let session = await sessionAssistant(ctx); // relue au clic par lancerExtraction ; ici pour l'état du bouton et la carte « Connecte-toi »

  // --- Lecture de l'état dans la base (jamais dans un cache) ----------------------------------------------------------------------------------
  const ligneOuverte = async () => (await repo.byIndex('imports', 'recipe_id', recipe.id)).find((i) => i && !IMPORTS_TERMINES.includes(i.status)) || null;
  const resultatValide = (ligne) => { try { return validateParsedRecipe(ligne?.resultat); } catch { return null; } };
  async function charger() {
    let ouverte = await ligneOuverte();
    // I-1 : un résultat revenu du journal (synchro, archive) est REVALIDÉ avant tout usage ; hostile → a_verifier → echec(illisible) (transition ratifiée
    // T4-R1, § 3.1), rien n'atteint l'écran (spec § 4.5). C'est la seule écriture que le simple montage de l'écran peut faire (origine local : en file).
    if (ouverte?.status === 'a_verifier' && !resultatValide(ouverte)) { await illisible(ouverte); ouverte = await ligneOuverte(); }
    if (ouverte?.id !== etat.ligne?.id || ouverte?.status !== 'a_verifier') { etat.question = null; etat.rattache = null; etat.verdict = null; }
    const ids = Array.isArray(ouverte?.page_ids) ? ouverte.page_ids : [];
    const manquantes = ids.filter((id) => !etat.pages.has(id));
    if (manquantes.length) for (const p of await Promise.all(manquantes.map((id) => repo.get('source_pages', id)))) if (p) etat.pages.set(p.id, p);
    etat.ligne = ouverte;
  }
  let file = Promise.resolve(); // les redessins sont enchaînés : jamais deux lectures concurrentes qui se dépassent
  const redessiner = () => { file = file.then(async () => { await charger(); dessiner(); }).catch((e) => logError('import_cible.rendu', { error: e })); return file; };
  async function illisible(ligne) {
    try { await repo.transitionner('imports', ligne.id, { attendus: ['a_verifier'], patch: { status: 'echec', erreur: { raison: 'illisible', extra: {} }, resultat: null } }); }
    catch (e) { if (!estRefus(e)) logError('import_cible.revalidation', { error: e, id: ligne.id }); }
  }
  // Une transition SUR PLACE (même statut, sous ATTENDUS_PAGES) : l'ordre des pages, le retrait d'une page, le pointeur de la photo du plat.
  const transitionSurPlace = async (patch) => {
    try { await repo.transitionner('imports', etat.ligne.id, { attendus: ATTENDUS_PAGES, patch }); }
    catch (e) { if (!estRefus(e)) logError('import_cible.pages', { error: e, id: etat.ligne?.id }); }
  };

  // --- Gestes : pages ---------------------------------------------------------------------------------------------------------------------------
  // Chaque ajout passe par repo.ajouterPages : persistant AVANT tout appel (spec § 4.2.2). Première photo → la ligne a_lancer naît (une visite sans
  // photo n'écrit rien, § 4.1) ; ensuite les pages s'ajoutent EN FIN de la même ligne (un seul import ouvert par recette, I-2).
  async function ajouterPhotos(options) {
    if (etat.occupe) return;
    const files = await pickFiles(options);
    if (!files?.length) return;
    etat.occupe = true;
    try {
      if (etat.ligne) await repo.ajouterPages(files, { import_id: etat.ligne.id });
      else await repo.ajouterPages(files, { edition_id: recipe.edition_id ?? null, import: { id: repo.newId('imp'), kind: 'recette', recipe_id: recipe.id, edition_id: recipe.edition_id ?? null } });
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
      const type = safeDisplayType(f?.mime); // S3 : type d'affichage par la liste blanche, blob retypé avec lui
      if (!(f?.blob instanceof Blob) || !type || !type.startsWith('image/')) return;
      const u = urlDeBlob(f.blob.type === type ? f.blob : new Blob([f.blob], { type }));
      urls.set(sha, u); img.src = u;
    }).catch(() => {});
  }

  // --- Gestes : extraire, annuler, décider, enregistrer -------------------------------------------------------------------------------------------
  async function lancer() {
    if (vol) { if (vol.importId !== etat.ligne?.id) toast(t('Une lecture est déjà en cours : annule-la d’abord.')); return; } // double tape : muette
    const L = etat.ligne; if (!L) return;
    etat.question = null; etat.rattache = null;
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
    etat.question = null; etat.rattache = null;
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
      const L = await ligneOuverte();
      if (!L || L.status !== 'a_verifier') { etat.question = null; apres = 'redessiner'; return; } // un autre onglet a tranché entre-temps
      etat.ligne = L;
      const resultat = resultatValide(L);
      if (!resultat) { await illisible(L); etat.question = null; apres = 'redessiner'; return; }
      // T4-R1 : la fiche supprimée entre le rendu et le clic (tombale d'un autre appareil, R57) n'est jamais ressuscitée par la copie du ctx : rien n'est écrit.
      const reference = await repo.get('recipes', recipe.id);
      if (!reference) { etat.question = null; apres = 'redessiner'; if (root.isConnected) { toast(t('Recette introuvable.')); navigate('/library'); } return; }
      const cle = cleLecture(L);
      if (rattache) etat.rattache = cle;
      const rattachee = etat.rattache === cle; // « Rattacher » répondu pour CETTE lecture, pas pour une autre arrivée entre-temps (D-6)
      const verdict = discordance(resultat, reference);
      etat.verdict = verdict;
      const versions = await repo.byIndex('recipe_versions', 'recipe_id', recipe.id);
      const pageIds = Array.isArray(L.page_ids) ? L.page_ids : [];
      const pages = (await Promise.all(pageIds.map((id) => repo.get('source_pages', id)))).filter(Boolean);
      const ed = reference.edition_id ? (ctx.editionsById?.get(reference.edition_id) ?? (await repo.get('book_editions', reference.edition_id)) ?? null) : null;
      const conventionId = typeof ctx.conventionFor === 'function' ? ctx.conventionFor(reference) : (ed?.unit_convention_id ?? null);
      const options = { reference, versions, pages, pageIds, edition: ed, convention: conventionId ? getConvention(conventionId) : null, importId: L.id, modele: modeleBorne(L.model), photo: photoBornee(L), maintenant: maintenant() };
      const sonde = fabriquerExtraction(resultat, options); // pur : lu pour `remplacement` (I-5) avant la décision
      etat.question = questionAPoser({ ok: verdict.ok, rattachee, remplacement: sonde.remplacement, remplacer });
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
    const seance = L.scan_session_id ? await repo.get('scan_sessions', L.scan_session_id) : null;
    const puts = { recipes: [fab.recipe], recipe_versions: [fab.version], source_pages: fab.pageUpdates };
    if (seance) puts.scan_sessions = [{ ...seance, status: 'done', recipe_ids: [...new Set([...(Array.isArray(seance.recipe_ids) ? seance.recipe_ids : []), recipe.id])] }];
    try {
      await repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch: { status: 'enregistre', reponse_brute: null, finished_at: maintenant() }, puts });
    } catch (e) {
      if (!estRefus(e)) { logError('import_cible.enregistrer', { error: e, id: L.id }); toast(t('La recette n’a pas pu être enregistrée. Réessaie.')); }
      return;
    }
    if (!root.isConnected) return;
    toast(t('Recette importée'));
    navigate(`/recipes/${encodeURIComponent(recipe.id)}?v=${encodeURIComponent(fab.version.id)}`);
  }

  // --- Dessin -----------------------------------------------------------------------------------------------------------------------------------
  const pretALancer = () => !!etat.ligne && (Array.isArray(etat.ligne.page_ids) && etat.ligne.page_ids.length > 0) && !!session && enLigneFlag && !vol && !etat.occupe;
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
        el('button', { type: 'button', class: 'btn', onClick: () => { etat.question = null; etat.rattache = null; dessiner(); } }, t('Garder la lecture sans l’enregistrer')),
        el('button', { type: 'button', class: 'btn', onClick: changerLesPages }, t('Changer les pages'))));
  }
  const panneauRemplacer = () => el('div', { class: 'card warn stack', dataset: { role: 'remplacer' } },
    el('p', { style: { margin: 0 } }, t('Remplacer par cette lecture ?')),
    el('small', { class: 'muted' }, t('Une version écrite à la main existe. « Garder ma version » ajoute la lecture sans la mettre en avant ; les pages et la photo sont liées quand même.')),
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
      bloc.append(el('p', { class: 'muted', style: { margin: 0 } }, t('Lecture reçue le {d}', { d: formatDate(L.updated_at, { withTime: true }) })));
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

  function dessiner() {
    const L = etat.ligne;
    const statut = L?.status ?? null;
    const pageIds = Array.isArray(L?.page_ids) ? L.page_ids : [];
    const enVol = !!vol && !!L && vol.importId === L.id;
    root.replaceChildren(enTete(), sectionPages(pageIds, statut === 'en_cours' || statut === 'a_verifier'), sectionPhoto(L, statut === 'en_cours'), zoneAction(L, statut, enVol));
    majEnLigne();
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
