// La photo du plat (lot F « Les plats en images », spec docs/superpowers/specs/2026-10-19-plats-en-images-design.md § 4.1, § 4.3) : la figure de
// tête de la fiche (le photoDuPlat du lot G, déplacé ici), la zone « Photo du plat » (le composant de la couverture d'un livre), ses gestes (poser,
// retirer) et le rapatriement de l'image d'une page web par la fonction de l'assistant (outil image-web). Règles : toute pose ou tout retrait
// RELIT la fiche et n'écrit que les trois champs de la photo (I-F1) ; un seul rapatriement par fiche et par document, hors du vol partagé (D-F7) ;
// monter une fiche n'appelle rien (I-F11) ; le redessin est LOCAL, jamais refresh() (D-F15) ; l'état web est DÉRIVÉ de la fiche, ses raisons vivent
// dans ce document (D-F17). Textes par t() littéral (I-F8).
import { el, toast as toastDom, pickFiles as pickDom } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { logError } from '../core/log.js';
import { sha256Hex } from '../core/hash.js';
import { lienSignet } from '../core/lien.js';
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';
import { preparerPhotoLocale, preparerPhotoDistante, ErreurImage, messageErreurImage } from '../core/image.js';
import * as repoModule from '../model/repo.js';
import { assertVocabulaire } from '../domain/vocabulaire.js';
import { adresseImageAdmise, memeAdresseImage, lireImageWeb, pointeurValide, RAISONS_DEFINITIVES } from '../domain/photo-web.js';
import { displayUrl, typeAffichage, safeDisplayType } from '../sync/mime.js';
import { section, sessionAssistant, texteRefusAssistant, texteEchecAssistant, messageGardeRefusee, vignettePage, gesteTelechargement, relireErreurs, renderZoneCouverture } from './components.js';

// Ronde 1 : UNE définition du pointeur valide (pointeurValide, photo-web.js) — la zone, le rapatriement et le domaine (candidatPhotoWeb) jugent le même.
const pointeur = (f) => (pointeurValide(f) ? f.photo_sha256 : null);
const lireEnLigne = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
let enLigneFlag = lireEnLigne();
const enVol = new Map();          // recipe_id → { controller, promesse, depart } : un rapatriement par fiche et par document (D-F7) ; depart = les trois champs lus au départ
const derniersEchecs = new Map(); // recipe_id → { raison, extra, tape, url } : la raison du dernier échec, pour l'adresse tentée (D-F17)
// Les zones montées : { root (la section), entete, recipeId, redessiner, inseree, montee }. Ronde 1 : le routeur insère la racine APRÈS la fin de la route,
// parfois bien après le montage (une fiche à pages attend encore ses vignettes) — une vue jamais vue dans le document est REDESSINÉE (ses nœuds y
// entreront à jour), jamais purgée par notifier ; seule une vue vue insérée puis détachée l'est. Une vue jamais insérée (route abandonnée, fiche sans
// version : D-F8) est purgée par un montage suivant, deux minutes au moins après le sien (enregistrerVue, revue finale) : l'ensemble reste borné en
// permanence (motif de search.js), sans attendre une notification (sur le Mac, toujours en ligne, il n'en vient parfois aucune).
const vues = new Set();
const dansLeDocument = (v) => v.root.isConnected || v.entete.isConnected;
function notifier(recipeId = null) {
  for (const v of [...vues]) {
    if (dansLeDocument(v)) v.inseree = true;
    else if (v.inseree) { vues.delete(v); continue; }
    if (recipeId === null || v.recipeId === recipeId) v.redessiner();
  }
}
// Revue finale : l'ordre des montages n'est pas celui des rendus — deux rendus de la même fiche qui se chevauchent, le plus ancien peut monter APRÈS le
// plus récent, que le routeur insérera ; purger « tout ce qui n'est pas dans le document » le privait de toute notification. Une vue vue insérée puis
// détachée est purgée tout de suite ; une vue jamais insérée, seulement VIE_SANS_INSERTION_MS après son montage (l'ensemble reste borné).
const VIE_SANS_INSERTION_MS = 2 * 60 * 1000;
function enregistrerVue(vue) {
  for (const v of [...vues]) {
    if (dansLeDocument(v)) v.inseree = true;
    else if (v.inseree || vue.montee - v.montee > VIE_SANS_INSERTION_MS) vues.delete(v);
  }
  vues.add(vue);
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { enLigneFlag = true; notifier(); });
  window.addEventListener('offline', () => { enLigneFlag = false; notifier(); });
}
// Revue finale (I-F6) : avec la fiche relue, une descente n'est « en cours » que si les trois champs n'ont pas bougé depuis son départ — une photo choisie
// ou retirée pendant la descente la condamne (fiche_changee, I-F5) : la zone ne dit plus « Récupération… » sous la photo de la personne.
const inchangeeDepuis = (depart, relue) => !!relue && relue.photo_sha256 === depart.photo_sha256 && relue.photo_origin === depart.photo_origin && adressesEgalesOuNulles(relue.photo_source_url, depart.photo_source_url);
export const recuperationEnCours = (recipeId, relue = undefined) => { const e = enVol.get(recipeId); return !!e && (relue === undefined || !e.depart || inchangeeDepuis(e.depart, relue)); };
export const attendreRecuperation = (recipeId) => enVol.get(recipeId)?.promesse ?? Promise.resolve();
export function reinitialiserPhotoPlat() { for (const e of enVol.values()) e.controller.abort(); enVol.clear(); vues.clear(); derniersEchecs.clear(); enLigneFlag = lireEnLigne(); } // tests seulement
export const vuesPhotoPlat = () => vues.size; // tests seulement (ronde 1 : l'ensemble des vues reste borné)

// --- La figure de tête (lot A D-4 ; lot G § 4.4) : le photoDuPlat de G DÉPLACÉ, avec deux différences — le pointeur doit passer HASH, et une image
// web porte sa légende (D-F11 : l'hôte RECALCULÉ depuis l'adresse de la recette, jamais celle de l'image). Aucune ligne files : null (rien, pas
// même un cadre) ; octets d'un type que typeAffichage ne rend pas image/ : null ; sans octets : la vignette d'état de G et son « Télécharger »,
// redessinée sur place. La légende est calculée DANS le redessin : elle suit l'image après un téléchargement. Ronde 1 : `fichier` (facultatif) =
// la ligne files déjà lue par l'appelant (la zone la lit pour `present`) — une seule lecture par redessin ; absent (undefined), elle est lue ici.
export async function figurePhotoPlat(recipe, { repo = repoModule, ctxF = {}, fichier: dejaLu = undefined } = {}) {
  const sha = pointeur(recipe);
  if (!sha) return null;
  let fichier = dejaLu ?? null;
  if (dejaLu === undefined) { try { fichier = await repo.getFile(sha); } catch { fichier = null; } }
  if (!fichier) return null;
  // Lot G (ronde 1 de sa tâche 6, recopiée) : sans octets, rien n'est offert si ce qui arrivera ne s'affichera pas — le type que portera le blob reçu (remote.mime), sinon celui
  // de la ligne (typeAffichage) ; une ligne distante application/pdf réussissait chaque tape sans que rien ne change (boucle muette).
  if (!(fichier.blob instanceof Blob) && !(safeDisplayType(fichier.remote?.mime) ?? safeDisplayType(fichier.mime))?.startsWith('image/')) return null;
  const figure = el('figure', { class: 'photo-plat', dataset: { role: 'photo-plat' }, style: { margin: '0 0 .8rem' } });
  const legende = () => {
    if (recipe.photo_origin !== 'web') return null;
    const l = lienSignet(recipe.source_url);
    return el('figcaption', { class: 'muted', dataset: { role: 'legende-photo-plat' } }, l.ok ? t('Image de la page {hote}', { hote: l.hote }) : t('Image de la page web'));
  };
  const dessiner = (f) => {
    if (f?.blob instanceof Blob) {
      const src = typeAffichage(f)?.startsWith('image/') ? displayUrl(f, urlDeBlob) : null;
      if (!src) return false;
      figure.replaceChildren(el('img', { alt: t('Photo du plat'), src, loading: 'lazy', style: { display: 'block', width: '320px', maxWidth: '100%', borderRadius: 'var(--radius)' } }), ...[legende()].filter(Boolean));
      return true;
    }
    figure.replaceChildren(vignettePage({ id: 'photo', sha256: sha }, f, { ...ctxF, telecharger }));
    return true;
  };
  const telecharger = gesteTelechargement({ moteur: ctxF?.moteur ?? null, redessiner: async () => {
    await relireErreurs(ctxF);
    dessiner(await repo.getFile(sha));
  } });
  return dessiner(fichier) ? figure : null;
}

// --- Le texte d'un échec (§ 4.1.2) : les textes existants d'abord ; deux neufs (inaccessible, définitives) ; un refus AVANT l'appel → null.
const REFUS_AVANT_APPEL = ['adresse', 'fiche_absente', 'fiche_changee', 'photo_manuelle', 'deja_la', 'vol_tenu', 'hors_ligne'];
export function texteEchecPhotoWeb({ raison, extra = {} } = {}) {
  if (raison === 'quota' || raison === 'non_admis') return texteRefusAssistant({ raison, quota: extra?.quota });
  if (raison === 'non_connecte') return t('Connecte-toi pour utiliser l’assistant.');
  if (raison === 'trop_de_demandes') return t('Trop de demandes pour l’instant. Réessaie dans une minute.');
  if (raison === 'delai' || raison === 'reseau' || raison === 'annule') return t('L’appel a peut-être été compté ; relancer en coûtera un autre.');
  if (raison === 'inaccessible') return t('Le site de la page n’a pas donné son image.');
  if (RAISONS_DEFINITIVES.includes(raison)) return t('L’image de cette page ne peut pas être utilisée.');
  if (raison === 'ecriture') return t('La photo du plat n’a pas pu être changée. Réessaie.');
  if (REFUS_AVANT_APPEL.includes(raison)) return null;
  return texteEchecAssistant({ message: typeof raison === 'string' ? raison : 'interne' });
}

// --- L'état de la zone (§ 4.1.2) : PUR (sauf t()). `motifEteint` (P-2) : la ligne sous un « Réessayer » éteint, jamais quand la raison la dit déjà.
export function etatZonePlat(recipe, { present = false, enVol = false, enLigne = true, connecte = false, occupe = false, echec = null } = {}) {
  const sha = pointeur(recipe);
  const candidat = !sha ? adresseImageAdmise(recipe?.photo_source_url) : null;
  const echecVu = echec && candidat && memeAdresseImage(echec.url, candidat) ? echec : null;
  const definitif = !!echecVu && RAISONS_DEFINITIVES.includes(echecVu.raison);
  const web = enVol ? 'en_cours' : candidat ? 'echouee' : null;
  const etat = { sha256: sha, message: null, web, raison: null, offreReessayer: false, peutReessayer: false, motifEteint: null, absente: !!sha && !present, enCours: !!occupe };
  if (!sha && !web) etat.message = t('Ajoute une photo du plat : elle illustre la recette dans tes listes.');
  if (web === 'echouee') {
    etat.raison = echecVu && (echecVu.tape || definitif) ? texteEchecPhotoWeb(echecVu) : null;
    etat.offreReessayer = !definitif;
    etat.peutReessayer = !definitif && !!enLigne && !!connecte;
    const motif = etat.offreReessayer && !etat.peutReessayer ? (!enLigne ? 'hors_ligne' : 'sans_compte') : null;
    etat.motifEteint = motif === 'sans_compte' && echecVu?.raison === 'non_connecte' && etat.raison ? null : motif;
  }
  return etat;
}

// --- Le rendu de la zone : le composant de la couverture (libellé et nom accessible de la photo du plat), puis la ligne web. Ronde 1 : les gestes du
// composant lui sont passés tels quels (renderZoneCouverture porte déjà la garde `typeof`) ; `gardeRefusee` (messageGardeRefusee(ctx.sync), F-7) : la
// garde de compte a refusé l'adresse — sous un « Réessayer » éteint faute de compte, son message remplace « Connecte-toi… » (se connecter y ramènerait).
export function renderZonePhotoPlat(etat, gestes = {}, { gardeRefusee = null } = {}) {
  const g = (nom) => () => (typeof gestes[nom] === 'function' ? gestes[nom]() : undefined);
  const composant = renderZoneCouverture({ sha256: etat.sha256, apercu: null, message: etat.message, enCours: etat.enCours },
    { photographier: gestes.photographier, choisir: gestes.choisir, retirer: gestes.retirer },
    { libelle: t('Photo du plat'), nomRetirer: t('Retirer la photo du plat') });
  let ligne = null;
  if (etat.web === 'en_cours') ligne = el('p', { class: 'status', role: 'status', dataset: { role: 'photo-web-etat' } }, t('Récupération de la photo du plat…'));
  else if (etat.web === 'echouee') {
    const motif = etat.motifEteint === 'hors_ligne' ? el('small', { class: 'muted' }, t('Tu es hors ligne.'))
      : etat.motifEteint === 'sans_compte' ? el('small', { class: 'muted' }, gardeRefusee ?? t('Connecte-toi pour utiliser l’assistant.')) : null;
    ligne = el('div', { class: 'stack', dataset: { role: 'photo-web-etat' } },
      el('small', { class: 'muted' }, t('Photo du plat non récupérée.')),
      etat.raison ? el('small', { class: 'muted', dataset: { role: 'raison-photo-web' } }, etat.raison) : null,
      etat.offreReessayer ? el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn', dataset: { role: 'reessayer-photo' }, disabled: !etat.peutReessayer || etat.enCours, onClick: g('reessayer') }, t('Réessayer')),
        el('small', { class: 'muted', dataset: { role: 'cout-photo-web' } }, t('Un appel de plus, compté dans ton quota du jour.')),
        motif) : null,
      el('button', { type: 'button', class: 'btn link', dataset: { role: 'abandonner-photo-web' }, disabled: etat.enCours, onClick: g('abandonner') }, t('Ne pas récupérer')));
  }
  return el('div', { class: 'stack' }, composant, ligne);
}

// L'annonce de l'écran a_verifier de la lecture web (§ 4.3 point 1) : un ESSAI et son coût, jamais un résultat. Ici pour que le filet i18n la voie.
export function ligneAnnoncePhotoWeb() {
  return el('small', { class: 'muted', dataset: { role: 'photo-web-annonce' } }, t('Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour.'));
}

// --- Écrire les champs de la photo (ronde 1 : I-F5 sans fenêtre d'await, C4, D-F16) : sur la fiche RELUE DANS la transaction d'écriture — la condition
// { key, fusion } du lot G (src/core/db.js), par repo.saveBatch (fiche nettoyée, horodatée, capturée ; le motif de regroupement.js). Une écriture d'ailleurs
// engagée depuis la dernière lecture du geste n'est jamais défaite. `champs(courante)` rend les champs à poser, ou null (refus : rien d'écrit). Seul ce
// qui est écrit passe le vocabulaire : une fiche reçue d'une version plus récente garde ses autres champs tels quels (D-F19). → 'ecrite' | 'absente' | 'changee'.
async function ecrireChamps(repo, recipeId, champs) {
  let issue = 'ecrite';
  await repo.saveBatch({}, { conditions: { recipes: [{ key: recipeId, fusion: (courante) => {
    if (!courante) { issue = 'absente'; return null; }
    const pose = champs(courante);
    if (!pose) { issue = 'changee'; return null; }
    assertVocabulaire(pose, 'recipes');
    return { ...courante, ...pose };
  } }] } });
  return issue;
}

// --- Poser (§ 4.1.3) : le mur local, la fiche relue AVANT putFile (une fiche absente n'entraîne aucune ligne files), puis relue encore (C4) — ronde 1 :
// DANS la transaction d'écriture ; les trois champs ENSEMBLE ; une photo choisie efface le candidat web (D-F10). Ne lève jamais (sauf une origine hors
// liste : erreur de programmation).
export async function poserPhotoPlat(recipeId, file, { repo = repoModule, origin } = {}) {
  if (origin !== 'photo' && origin !== 'image') throw new TypeError('poserPhotoPlat : origine ' + String(origin));
  let jpeg;
  try { jpeg = await preparerPhotoLocale(file); }
  catch (e) { return { issue: 'refuse', raison: 'image', code: e instanceof ErreurImage ? e.code : 'indecodable' }; } // P-16
  try {
    if (!(await repo.get('recipes', recipeId))) return { issue: 'refuse', raison: 'fiche_absente' };
    const sha = await sha256Hex(jpeg);
    await repo.putFile(sha, jpeg, { mime: 'image/jpeg' });
    const issue = await ecrireChamps(repo, recipeId, () => ({ photo_sha256: sha, photo_origin: origin, photo_source_url: null }));
    if (issue === 'absente') return { issue: 'refuse', raison: 'fiche_absente' }; // la ligne files reste : orphelin L5
    derniersEchecs.delete(recipeId);
    return { issue: 'ok', sha256: sha };
  } catch (e) {
    logError('photo_plat.pose', { error: e, id: recipeId });
    return { issue: 'echec', raison: 'ecriture' };
  }
}

// « Retirer » et « Ne pas récupérer » (D-F4) : les trois champs à null sur la fiche relue dans la transaction ; la ligne files reste (orphelins = L5).
// Aucun appel. Ronde 1 : `attendu` = ce que la zone MONTRAIT ({ sha256, candidat }) — « Retirer » n'enlève que la photo vue, « Ne pas récupérer » que le
// candidat vu, sans photo ; une fiche changée depuis (un autre onglet a posé une photo, aucune notification d'un document à l'autre) n'est pas touchée :
// refuse(fiche_changee). Sans `attendu` (appel direct) : aucune condition.
export async function retirerPhotoPlat(recipeId, { repo = repoModule, attendu = null } = {}) {
  const conforme = (c) => attendu == null || (attendu.sha256 ? pointeur(c) === attendu.sha256 : pointeur(c) === null && memeAdresseImage(c.photo_source_url, attendu.candidat));
  try {
    const issue = await ecrireChamps(repo, recipeId, (c) => (conforme(c) ? { photo_sha256: null, photo_origin: null, photo_source_url: null } : null));
    if (issue === 'absente') return { issue: 'refuse', raison: 'fiche_absente' };
    if (issue === 'changee') return { issue: 'refuse', raison: 'fiche_changee' };
    derniersEchecs.delete(recipeId);
    return { issue: 'ok' };
  } catch (e) {
    logError('photo_plat.retrait', { error: e, id: recipeId });
    return { issue: 'echec', raison: 'ecriture' };
  }
}

// --- Le rapatriement (§ 4.3 point 3) : non async — le vol est posé AVANT tout await (une seconde demande sur la même fiche est refusée vol_tenu),
// la zone passe en « Récupération… » par notifier, puis la descente ; la fin retire le vol et redessine. Ne lève jamais.
const adressesEgalesOuNulles = (a, b) => (adresseImageAdmise(a) === null && adresseImageAdmise(b) === null) || memeAdresseImage(a, b);
export function rapatrierPhotoWeb(recipeId, options = {}) {
  if (enVol.has(recipeId)) return Promise.resolve({ issue: 'refuse', raison: 'vol_tenu' });
  const entree = { controller: new AbortController(), promesse: null, depart: null };
  enVol.set(recipeId, entree);
  notifier(recipeId);
  entree.promesse = descendre(recipeId, entree, options).finally(() => { if (enVol.get(recipeId) === entree) enVol.delete(recipeId); notifier(recipeId); });
  return entree.promesse;
}
async function descendre(recipeId, entree, { candidat = null, tape = false, ctx = null, repo = repoModule, fetch = undefined, enLigne = () => enLigneFlag } = {}) {
  let url = null;
  const refuser = (raison) => {
    if (raison === 'fiche_changee' || raison === 'fiche_absente') derniersEchecs.delete(recipeId);
    if (raison === 'non_connecte' && tape) derniersEchecs.set(recipeId, { raison: 'non_connecte', extra: {}, tape: true, url });
    return { issue: 'refuse', raison };
  };
  const echouer = (raison, extra = {}) => {
    logError('photo_web.echec', { reason: raison, id: recipeId }); // P-1 : log.js ne garde que reason
    derniersEchecs.set(recipeId, { raison, extra, tape, url });
    return { issue: 'echec', raison };
  };
  try {
    const fiche = await repo.get('recipes', recipeId);
    if (!fiche) return refuser('fiche_absente');
    const depart = { photo_sha256: fiche.photo_sha256, photo_origin: fiche.photo_origin, photo_source_url: fiche.photo_source_url };
    entree.depart = depart;
    const sha = pointeur(fiche);
    // Les deux refus de D-F10 (photo_manuelle, deja_la) sont ceux de candidatPhotoWeb (photo-web.js), ici pour NOMMER la raison : une règle changée là se
    // change ici (ronde 1 : le pointeur, lui, a une seule définition, pointeurValide).
    if (sha && fiche.photo_origin !== 'web') return refuser('photo_manuelle'); // D-F10 : une origine nulle avec un pointeur compte comme celle de la personne
    url = candidat !== null ? adresseImageAdmise(candidat) : adresseImageAdmise(fiche.photo_source_url);
    if (!url) return refuser('adresse');
    if (sha && memeAdresseImage(url, fiche.photo_source_url)) return refuser('deja_la');
    if (!enLigne()) return refuser('hors_ligne');
    const session = await sessionAssistant(ctx);
    if (!session) return refuser('non_connecte');
    const r = await lireImageWeb({ url, session }, { fetch: fetch ?? globalThis.fetch, signal: entree.controller.signal });
    if (r.etat === 'echec') return echouer(r.raison, r.extra ?? {});
    let jpeg;
    try { jpeg = await preparerPhotoDistante(r.blob); } catch (e) { return echouer(e instanceof ErreurImage ? e.code : 'indecodable'); }
    const sha2 = await sha256Hex(jpeg);
    // Garde des trois champs (I-F1, I-F5, D-F18), AVANT putFile puis encore à l'écriture — ronde 1 : rejouée DANS la transaction (ecrireChamps), une
    // photo choisie qui s'engage juste avant n'est jamais écrasée : la personne a pu choisir une photo, retirer, refuser le rapatriement, ou une
    // relecture changer l'adresse — rien n'est alors écrasé.
    const inchangee = (relue) => inchangeeDepuis(depart, relue);
    const relue = await repo.get('recipes', recipeId);
    if (!relue) return refuser('fiche_absente');
    if (!inchangee(relue)) return refuser('fiche_changee');
    try { await repo.putFile(sha2, jpeg, { mime: 'image/jpeg' }); } catch { return echouer('ecriture'); }
    let issue;
    // les trois ENSEMBLE : la provenance de CETTE image
    try { issue = await ecrireChamps(repo, recipeId, (c) => (inchangee(c) ? { photo_sha256: sha2, photo_origin: 'web', photo_source_url: url } : null)); }
    catch { return echouer('ecriture'); }
    if (issue === 'absente') return refuser('fiche_absente');
    if (issue === 'changee') return refuser('fiche_changee'); // la ligne files reste : orphelin L5
    derniersEchecs.delete(recipeId);
    return { issue: 'ok', sha256: sha2 };
  } catch {
    return echouer('interne'); // P-17 : jamais une levée vers l'écran (I-F4)
  }
}

// --- Le montage (§ 4.1.1) : l'emplacement de tête (un div, jamais null), la section « Photo du plat », les gestes. Monter n'appelle RIEN (I-F11).
// Les redessins sont sérialisés (P-15) ; les URL blob: d'avant sont relevées juste avant le remplacement et révoquées APRÈS (D-T9).
export async function monterPhotoPlat(recipe, ctx, { repo = repoModule, pickFiles = pickDom, toast = toastDom, fetch = undefined, enLigne = () => enLigneFlag, ctxF = {}, instant = Date.now } = {}) {
  const entete = el('div', { dataset: { role: 'emplacement-photo-plat' } });
  const conteneur = el('div', { dataset: { role: 'zone-photo-plat' } });
  const zone = section(t('Photo du plat'), conteneur);
  let occupe = false;
  // Ronde 1 : ce que la zone MONTRE (le dernier dessin) — « Retirer » et « Ne pas récupérer » n'écrivent que sur cet état ; et la clé de l'image de tête,
  // gardée telle quelle tant que ce qu'elle montre n'a pas changé (ni URL blob: neuve, ni second décodage à chaque redessin : occupe, online, offline).
  let rendu = null;
  let cleImage = null;
  async function dessiner() {
    let relue = recipe;
    try { relue = (await repo.get('recipes', recipe.id)) || recipe; } catch { relue = recipe; }
    const sha = pointeur(relue);
    let fichier = null;
    if (sha) { try { fichier = (await repo.getFile(sha)) ?? null; } catch { fichier = null; } }
    // `connecte` relu à chaque dessin (ronde 1) ; le jeton lui-même n'est lu qu'au geste (sessionAssistant). `absente` (cas 3) ne sert que de témoin à
    // I-F10 : l'état du fichier vit en tête, la zone ne le rend pas.
    const etat = etatZonePlat(relue, { present: !!typeAffichage(fichier)?.startsWith('image/'), enVol: recuperationEnCours(relue.id, relue), enLigne: enLigne(), connecte: !!ctx?.sync?.user, occupe, echec: derniersEchecs.get(relue.id) ?? null });
    const cle = fichier?.blob instanceof Blob ? JSON.stringify([sha, typeAffichage(fichier), relue.photo_origin === 'web' ? String(relue.source_url ?? '') : null]) : null;
    const garder = cle !== null && cle === cleImage && entete.firstElementChild !== null;
    const figure = garder ? null : await figurePhotoPlat(relue, { repo, ctxF, fichier });
    const anciennes = [...(garder ? [] : entete.querySelectorAll('img')), ...conteneur.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((u) => typeof u === 'string' && u.startsWith('blob:'));
    if (!garder) { entete.replaceChildren(...[figure].filter(Boolean)); cleImage = figure ? cle : null; }
    conteneur.replaceChildren(renderZonePhotoPlat(etat, gestes, { gardeRefusee: messageGardeRefusee(ctx?.sync) }));
    rendu = { sha256: etat.sha256, candidat: etat.sha256 ? null : adresseImageAdmise(relue.photo_source_url) };
    for (const u of anciennes) revoquerUrlDeBlob(u);
  }
  let file = Promise.resolve();
  const redessiner = () => { file = file.then(dessiner).catch((e) => logError('photo_plat.rendu', { error: e, id: recipe.id })); return file; };
  // Garde `occupe` AVANT pickFiles, mais `occupe = true` seulement APRÈS le choix (pickFiles ne se résout jamais sur une annulation : poser
  // `occupe` avant figerait la zone) — le motif d'import-cible.js.
  async function poserDepuis(options, origin) {
    if (occupe) return;
    const fichiers = await pickFiles(options);
    if (!fichiers?.length) return;
    occupe = true; await redessiner();
    try {
      const r = await poserPhotoPlat(recipe.id, fichiers[0], { repo, origin });
      if (r.issue === 'ok') toast(t('Photo du plat enregistrée.'));
      else if (r.raison === 'image') toast(messageErreurImage({ code: r.code }));
      else if (r.raison === 'fiche_absente') toast(t('Recette introuvable.'));
      else toast(t('La photo du plat n’a pas pu être changée. Réessaie.'));
    } finally { occupe = false; await redessiner(); }
  }
  async function retirerAvec({ dire }) {
    if (occupe) return;
    const attendu = rendu; // relevé AVANT le redessin « occupe » : l'état que la personne a vu en touchant (ronde 1)
    occupe = true; await redessiner();
    try {
      const r = await retirerPhotoPlat(recipe.id, { repo, attendu });
      if (r.issue === 'ok') { if (dire) toast(t('Photo du plat retirée.')); }
      else if (r.raison === 'fiche_absente') toast(t('Recette introuvable.'));
      else if (r.raison !== 'fiche_changee') toast(t('La photo du plat n’a pas pu être changée. Réessaie.')); // fiche_changee : le redessin dit l'état vrai
    } finally { occupe = false; await redessiner(); }
  }
  const gestes = {
    photographier: () => poserDepuis({ accept: 'image/*', multiple: false, capture: 'environment' }, 'photo'),
    choisir: () => poserDepuis({ accept: 'image/*', multiple: false }, 'image'),
    retirer: () => retirerAvec({ dire: true }),
    abandonner: () => retirerAvec({ dire: false }),
    // Sans await dans le gestionnaire : le vol est posé avant tout await, la zone passe en « Récupération… » par notifier (§ 4.1.3).
    reessayer: () => (occupe ? Promise.resolve(null) : rapatrierPhotoWeb(recipe.id, { tape: true, ctx, repo, fetch, enLigne })),
  };
  // Ronde 1 : la vue est enregistrée AVANT le premier dessin et n'est jamais purgée avant d'avoir été vue dans le document (notifier) — une descente finie
  // entre le montage et l'insertion par le routeur la redessine, quel que soit le moment où renderRecipe finit (la garde « setTimeout 0 » d'import-cible.js,
  // qui tirait avant l'insertion d'une fiche à pages, est retirée).
  enregistrerVue({ root: zone, entete, recipeId: recipe.id, redessiner, inseree: false, montee: instant() });
  await redessiner();
  return { entete, zone, gestes };
}
