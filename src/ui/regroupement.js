// Un lot de recettes photographiées (lot D, spec docs/superpowers/specs/2026-10-19-recettes-en-lot-design.md, § 4.2 à 4.6, § 4.8.3) : le panneau
// « Classement » d'une séance de scan — classer les photos cochées en UN appel (le vol partagé lancerVol de C, outil extraction), montrer le vol, l'échec et
// la ligne à lancer, puis (tâche 3) l'écran de regroupement, l'appariement proposé, « Lire ces recettes » et la lecture du lot ; et (tâche 5) la
// proposition de référence de l'éditeur. Tout ce que le module écrit passe par repo.transitionner ou repo.ouvrirImport (I-D1) ; la sortie du modèle est une
// DONNÉE HOSTILE revalidée avant tout usage et rendue en nœuds texte (I-D2). Le paramètre s'appelle `repo` partout (le test statique le lit). Ce module
// n'importe jamais src/ui/import.js ni src/ui/recipe-edit.js, qui l'importent (pas de cycle). Tous les textes neufs du lot vivent ici (filet i18n :
// MODULES_NEUFS). Dépendances injectables { repo, toast, confirmer, fetch, maintenant, battementMs, enLigne } : la suite n'ouvre ni dialogue ni réseau.
import { el, toast as toastDom, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { logError } from '../core/log.js';
import { on } from '../core/bus.js';
import { TransitionRefusee } from '../core/db.js';
import * as repoModule from '../model/repo.js';
import { classerPhotos, MAX_TOKENS_CLASSER, MAX_PHOTOS_CLASSEMENT } from '../domain/llm.js';
import { IMPORTS_OUVERTS } from '../domain/import-cible.js';
import { cleClassement, resultatClassement, revaliderResultatClassement, pagesEnCours } from '../domain/classement.js';
import { trierParSeance, pagesALire, ligneOuverteDeSeance } from '../domain/table-matieres.js';
import { lancerVol, annulerVol, volEnCours, estEnLigne, texteEchec, BATTEMENT_MS } from './import-cible.js';
import { sessionAssistant, carteConnexion } from './components.js';
import { demarrerConnexion } from './settings.js';
import { messageErreurImage } from './livre-ajout.js';

const horloge = () => new Date().toISOString();
const liste = (v) => (Array.isArray(v) ? v : []);
const memeListe = (a, b) => { const A = liste(a); const B = liste(b); return A.length === B.length && A.every((x, i) => x === B[i]); };
// UN lot en lecture par document (I-D5) : posé avant tout await, libéré en finally (lireLeLot, tâche 3). Les tests seuls le réinitialisent.
let lot = null;
export const lotEnCours = () => (lot ? { classementId: lot.classementId } : null);
export function reinitialiserLot() { lot = null; }
// Les panneaux montés : un passage en ligne / hors ligne les redessine (le vol, lui, lit l'état réseau d'import-cible.js, mis à jour AVANT : son écouteur
// est posé à l'import de ce module-là, donc avant celui-ci).
const vues = new Set();
if (typeof window !== 'undefined') {
  const reseau = () => { for (const v of [...vues]) { if (!v.racine.isConnected) { vues.delete(v); continue; } v.redessiner(); } };
  window.addEventListener('online', reseau);
  window.addEventListener('offline', reseau);
}

// L'exécutant du classement pour lancerVol (D-D1) : UN appel classerPhotos, puis la correspondance sur les pages ENVOYÉES (C, D-C21).
export async function executerClassement({ provider, images, pageIds, signal }) {
  const r = await classerPhotos(provider, images, { signal, maxTokens: MAX_TOKENS_CLASSER });
  return { resultat: resultatClassement(r.classement, pageIds), texteBrut: r.texteBrut, modele: r.modele };
}

// Le texte d'un classement en échec (§ 4.2 état 4) : coupe, vide et le 413 ont leur phrase ; tout le reste dit ce que dit l'écran ciblé (texteEchec du
// lot A : « Code : … » pour illisible / hors_bornes, I-4 pour annule / interrompu / incertain, la passerelle sinon). Rend { texte, code }.
export function texteEchecClassement(erreur) {
  const raison = typeof erreur?.raison === 'string' ? erreur.raison : 'interne';
  if (raison === 'coupe') return { texte: t('Le classement a été coupé : classe moins de photos à la fois.'), code: null };
  if (raison === 'vide') return { texte: t('Aucune recette reconnue sur ces photos.'), code: null };
  if (raison === 'requete' && erreur?.extra?.trop_lourd === true) return { texte: t('La demande est trop lourde : choisis moins de pages.'), code: null };
  return texteEchec(erreur);
}

// Le panneau « Classement » (§ 4.2) : monté par sessionView SOUS les miniatures. `getSelection()` rend les identifiants cochés ; `importId` = la ligne de
// classement désignée (?import=) — sinon la plus récente ouverte de la séance. États : 1) aucun classement ouvert → panneau caché, « Classer… » dans la
// barre (actionsSelection) ; 2) en vol ; 3) reçu ; 4) échec ; 5) à lancer. La ligne est lue au rendu dans ctx.imports, RELUE (repo.get) avant toute
// écriture ; le panneau suit le bus (D-D22) et ne se redessine que si sa signature change. `surChangement()` : la barre de sélection se redessine aussi.
export function panneauClassement(session, ctx, getSelection, { repo = repoModule, toast = toastDom, confirmer = confirmDialog, fetch: fetchInjecte = undefined, maintenant = horloge, battementMs = BATTEMENT_MS, enLigne = estEnLigne, importId = null, surChangement = null } = {}) {
  const racine = el('div', { class: 'card stack', dataset: { role: 'classement' } });
  const pagesSeance = () => liste(session?.page_ids);
  const presentes = (ids) => liste(ids).filter((id) => typeof id === 'string' && ctx?.pagesById instanceof Map && ctx.pagesById.has(id));
  // ligne : le classement ouvert de la séance ; imports : le journal relu ; session : celle de l'assistant (undefined tant qu'elle n'est pas lue) ;
  // occupe : un geste écrit (verrou d'instance, posé avant tout await) ; illisibles : les clés déjà marquées illisibles (jamais deux fois).
  const etat = { ligne: ligneOuverteDeSeance(ctx?.imports, session?.id, { importId, kind: 'classement' }), imports: liste(ctx?.imports), session: undefined, occupe: false, signature: null, illisibles: new Set() };
  const ouverte = () => !!etat.ligne && IMPORTS_OUVERTS.includes(etat.ligne.status);
  const signatureDe = (L) => JSON.stringify([L?.status ?? null, L?.document_id_vol ?? null, L ? cleClassement(L) : null, volEnCours()?.importId ?? null, lotEnCours()?.classementId ?? null]);
  const connecter = () => demarrerConnexion(ctx?.sync?.auth);
  const prevenir = () => { if (typeof surChangement === 'function') surChangement(); };

  // La PREMIÈRE raison qui éteint « Classer » / « Reclasser » (§ 4.2 état 1, I-D4), dans cet ordre ; null = allumé ; { attente } = la session n'est pas
  // encore lue (éteint, sans texte : jamais un flash « Connecte-toi » pour une personne connectée), son seul sens depuis la ronde 1 ; moins de deux
  // pages (états 4 et 5 ; l'état 1 ne rend aucun bouton sous deux cochées) est une raison DITE, en dernier, après les raisons ordonnées (I-D4).
  function raisonEteint(pages, sauf) {
    if (!enLigne()) return { texte: t('Tu es hors ligne.') };
    if (etat.session === undefined) return { attente: true };
    if (!etat.session) return { carte: true };
    if (volEnCours() || lotEnCours()) return { texte: t('Une lecture est en cours : attends sa fin ou annule-la.') };
    if (pages.length > MAX_PHOTOS_CLASSEMENT) return { texte: t('Classe au plus 10 photos à la fois : décoche-en {k}.', { k: pages.length - MAX_PHOTOS_CLASSEMENT }) };
    const prises = pagesEnCours(etat.imports, session?.id, { sauf });
    const k = pages.filter((p) => prises.has(p)).length;
    if (k) return { texte: t('Décoche les photos déjà en cours d’import ({k}).', { k }) };
    if (pages.length < 2) return { texte: t('Coche au moins deux photos de cette séance.') };
    return null;
  }
  const ligneSousBouton = (r) => (r?.carte ? carteConnexion(connecter, ctx) : r?.attente ? null
    : el('small', { class: 'muted', dataset: { role: 'raison-classer' } }, r ? r.texte : t('Un classement = un appel à l’assistant ; lire les recettes coûtera ensuite un appel par recette.')));

  // État 1 : ce que la barre de sélection place AVANT « Regrouper en recette » (rien à moins de deux cochées) ; aux états 4 et 5, le panneau dépend de
  // la sélection : il se redessine à chaque redessin de la barre.
  racine.actionsSelection = () => {
    if (ouverte()) { if (['a_lancer', 'echec'].includes(etat.ligne.status)) dessiner(); return []; }
    const coches = trierParSeance(presentes(getSelection()), pagesSeance());
    if (coches.length < 2) return [];
    const r = raisonEteint(coches, null);
    return [el('button', { type: 'button', class: 'btn primary', dataset: { role: 'classer' }, disabled: !!r || etat.occupe, onClick: () => classer() }, t('Classer ces photos avec l’assistant')), ligneSousBouton(r)].filter(Boolean);
  };
  // « Regrouper en recette » n'est retiré que si un classement EN VOL ou REÇU de la séance touche la sélection (D-D3, B-13).
  racine.regrouperPermis = (selection) => {
    const L = etat.ligne;
    if (!L || !['en_cours', 'a_verifier'].includes(L.status)) return true;
    const siennes = new Set(liste(L.page_ids));
    return !liste(selection).some((p) => siennes.has(p));
  };
  racine.etatClassement = () => ({ importId: etat.ligne?.id ?? null, status: etat.ligne?.status ?? null, groupes: [], aPart: [], appels: Number.isInteger(etat.ligne?.appels) ? etat.ligne.appels : 0, lot: lotEnCours()?.classementId ?? null, brouillon: etat.ligne?.brouillon ?? null });

  // --- Dessin -------------------------------------------------------------------------------------------------------------------------------------
  const blocEnVol = (L) => (volEnCours()?.importId === L.id
    // R-VIS-8 : la .status[role=status] puis la .row — « Annuler » se range à droite ; le primaire reste, éteint, à sa place.
    ? [el('div', { class: 'status', role: 'status' }, t('Classement des photos par l’assistant…')), el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', disabled: true }, t('Classer ces photos avec l’assistant')), el('button', { type: 'button', class: 'btn', dataset: { role: 'annuler' }, onClick: () => annulerVol(L.id) }, t('Annuler')))]
    : [el('div', { class: 'status warn' }, t('En cours sur un autre écran'))]); // I-7 : sans « Annuler »
  function blocALancer(L) { // états 4 (echec) et 5 (a_lancer)
    const pages = pagesALire(presentes(getSelection()), L, pagesSeance(), ctx?.pagesById);
    const r = raisonEteint(pages, L.id); // ronde 1 : moins de deux pages est une raison dite (raisonEteint), jamais une attente muette
    const blocs = [];
    if (L.status === 'echec') { const { texte, code } = texteEchecClassement(L.erreur); blocs.push(el('div', { class: 'status warn', dataset: { role: 'echec' } }, el('span', null, texte), code ? el('small', { class: 'muted' }, code) : null)); }
    blocs.push(el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn primary', dataset: { role: L.status === 'echec' ? 'reclasser' : 'classer' }, disabled: !!r || etat.occupe, onClick: () => classer() }, L.status === 'echec' ? t('Reclasser') : t('Classer ces photos avec l’assistant')),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'ignorer-classement' }, disabled: etat.occupe, onClick: ignorerClassement }, t('Ignorer ce classement'))));
    const sous = ligneSousBouton(r);
    if (sous) blocs.push(sous);
    return blocs;
  }
  // État 3 (tâche 2) : la lecture reçue est REVALIDÉE (I-D2) ; hostile → echec(illisible), brouillon effacé, au montage (T4-R1 du lot A). L'écran de
  // regroupement complet vient en tâche 3.
  function blocRecu(L) {
    const resultat = revaliderResultatClassement(L.resultat, L.page_ids);
    // Ronde 1 : pendant le marquage, un nœud NEUTRE — jamais le rôle de l'écran de regroupement (un test qui attend cet écran ne lit pas un écran vide).
    if (!resultat) { marquerIllisible(L); return el('div', { class: 'stack', dataset: { role: 'revalidation' } }); }
    const n = resultat.groupes.length;
    return el('div', { class: 'stack', dataset: { role: 'regroupement' } },
      el('h2', null, t('Recettes trouvées')),
      el('p', { class: 'muted' }, n === 1 ? t('1 recette proposée par l’assistant — vérifie le groupe avant de lire.') : t('{n} recettes proposées par l’assistant — vérifie les groupes avant de lire.', { n })),
      el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', dataset: { role: 'ignorer-classement' }, disabled: etat.occupe, onClick: ignorerClassement }, t('Ignorer ce classement'))));
  }
  function dessiner() {
    const L = ouverte() ? etat.ligne : null;
    racine.hidden = !L;
    if (!L) { racine.replaceChildren(); return; }
    if (L.status === 'en_cours') racine.replaceChildren(...blocEnVol(L));
    else if (L.status === 'a_verifier') racine.replaceChildren(blocRecu(L));
    else racine.replaceChildren(...blocALancer(L));
  }

  // --- Relecture (D-D22) : le journal relu ; la ligne suivie (ou, terminée, la plus récente ouverte de la séance) ; redessin si la signature change. ----
  let file = Promise.resolve();
  function synchroniser({ forcer = false } = {}) {
    file = file.then(async () => {
      etat.imports = liste(await repo.all('imports'));
      const relue = etat.ligne ? etat.imports.find((i) => i && i.id === etat.ligne.id) ?? null : null;
      etat.ligne = relue && IMPORTS_OUVERTS.includes(relue.status) ? relue : (ligneOuverteDeSeance(etat.imports, session?.id, { kind: 'classement' }) ?? relue);
      const sig = signatureDe(etat.ligne);
      if (forcer || sig !== etat.signature) { etat.signature = sig; dessiner(); prevenir(); }
    }).catch((e) => logError('regroupement.relecture', { error: e }));
    return file;
  }

  // --- Gestes -------------------------------------------------------------------------------------------------------------------------------------
  // a_verifier → echec(illisible) pour LA lecture relue (clé gardée dans la transaction), une fois par clé.
  async function marquerIllisible(L) {
    const cle = cleClassement(L);
    if (etat.illisibles.has(cle)) return;
    etat.illisibles.add(cle);
    try { await repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch: (c) => { if (cleClassement(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return { status: 'echec', erreur: { raison: 'illisible', extra: {} }, resultat: null, brouillon: null }; } }); }
    catch (e) { if (!(e instanceof TransitionRefusee)) logError('regroupement.revalidation', { error: e, id: L.id }); }
    await synchroniser({ forcer: true });
  }
  async function octetsPresents(pageIds) {
    for (const id of pageIds) {
      const p = await repo.get('source_pages', id);
      if (!p?.sha256) continue;
      let f = null;
      try { f = await repo.getFile(p.sha256); } catch { f = null; }
      if (!(f?.blob instanceof Blob)) return false;
    }
    return true;
  }
  const remiseAZero = (pages) => ({ status: 'a_lancer', page_ids: [...pages], resultat: null, reponse_brute: null, erreur: null, duree_ms: null, model: null, finished_at: null, brouillon: null });
  function direRefus(r) {
    if (r.raison === 'octets_absents') toast(t('Les photos de cette séance ne sont pas sur cet appareil.'));
    else if (r.raison === 'image') toast(messageErreurImage({ code: r.code }));
    else if (r.raison === 'hors_ligne') toast(t('Tu es hors ligne.'));
    else if (r.raison === 'vol_tenu') toast(t('Une lecture est déjà en cours : annule-la d’abord.'));
    else if (r.raison === 'non_connecte') etat.session = null; // la carte revient au redessin ; inconnu, transition, sans_page, sorte : redessin silencieux
  }
  // « Classer » (état 1), « Reclasser » (états 3 et 4), « Classer » d'une ligne à lancer (état 5) : le verrou d'instance AVANT tout await ; les pages
  // COMPTÉES (2 à 10) avant tout décodage (D-D1, S-10) ; réseau, session, photos déjà en cours d'import et octets vérifiés AVANT toute écriture (un clic
  // refusé n'écrit rien, ronde 1 de T6 du lot A) ; « Reclasser » d'un classement reçu est confirmé et gardé par la clé (D-D23) ; puis lancerVol.
  async function classer() {
    if (etat.occupe) return;
    etat.occupe = true;
    try {
      if (volEnCours() || lotEnCours()) { toast(t('Une lecture est déjà en cours : annule-la d’abord.')); return; } // filet de la course
      const vue = ouverte() ? etat.ligne : null;
      const L = vue ? await repo.get('imports', vue.id) : null;
      if (vue && (!L || !['a_lancer', 'a_verifier', 'echec'].includes(L.status) || cleClassement(L) !== cleClassement(vue))) return; // changée ailleurs : le redessin le montre
      const pages = L ? pagesALire(presentes(getSelection()), L, pagesSeance(), ctx?.pagesById) : trierParSeance(presentes(getSelection()), pagesSeance());
      if (pages.length < 2 || pages.length > MAX_PHOTOS_CLASSEMENT) return;
      if (!enLigne()) { toast(t('Tu es hors ligne.')); return; }
      etat.session = await sessionAssistant(ctx);
      if (!etat.session) return;
      etat.imports = liste(await repo.all('imports'));
      if (!L && ligneOuverteDeSeance(etat.imports, session?.id, { kind: 'classement' })) return; // un classement ouvert existe (un autre onglet) : rien de créé
      const prises = pagesEnCours(etat.imports, session?.id, { sauf: L?.id ?? null });
      if (pages.some((p) => prises.has(p))) return;
      if (!(await octetsPresents(pages))) { toast(t('Les photos de cette séance ne sont pas sur cet appareil.')); return; }
      let id = L?.id ?? null;
      if (L?.status === 'a_verifier') {
        if (!(await confirmer(t('Reclasser remplace ce classement et tes changements de groupes, et coûte un appel. Continuer ?'), { okLabel: t('Reclasser') }))) return;
        const cle = cleClassement(L);
        await repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch: (c) => { if (cleClassement(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return remiseAZero(pages); } });
      } else if (L && !memeListe(pages, L.page_ids)) {
        await repo.transitionner('imports', L.id, L.status === 'echec' ? { attendus: ['echec'], patch: remiseAZero(pages) } : { attendus: ['a_lancer'], patch: { page_ids: [...pages] } });
      } else if (!L) {
        const ligne = await repo.ouvrirImport({ kind: 'classement', edition_id: session?.edition_id ?? null, scan_session_id: session?.id ?? null, page_ids: pages });
        id = ligne.id; etat.ligne = ligne;
      }
      const r = await lancerVol(id, executerClassement, { ctx, repo, fetch: fetchInjecte, maintenant, enLigne, battementMs, accepte: (l) => l?.kind === 'classement' });
      if (r.issue === 'refuse') direRefus(r);
    } catch (e) { if (!(e instanceof TransitionRefusee)) logError('regroupement.classer', { error: e }); }
    finally { etat.occupe = false; await synchroniser({ forcer: true }); }
  }
  // « Ignorer ce classement » : confirmé sur un classement REÇU (il a coûté un appel) ; à lancer ou en échec, sans confirmation.
  // Ronde 1 (§ 4.2 « relue par repo.get avant toute écriture », D-D23) : le verrou d'instance avant tout await ; la ligne RELUE — changée depuis le rendu
  // (statut ou clé : un autre onglet ou appareil l'a reclassée ou relancée), rien n'est demandé ni écrit, le redessin la montre ; la question se décide sur
  // la ligne relue ; la transition part de SON statut et garde sa clé DANS la transaction : un classement reçu pendant la question n'est jamais ignoré.
  async function ignorerClassement() {
    const vue = ouverte() ? etat.ligne : null;
    if (!vue || etat.occupe || vue.status === 'en_cours') return;
    etat.occupe = true;
    try {
      const L = await repo.get('imports', vue.id);
      if (!L || L.status !== vue.status || cleClassement(L) !== cleClassement(vue) || !['a_lancer', 'a_verifier', 'echec'].includes(L.status)) return;
      if (L.status === 'a_verifier' && !(await confirmer(t('Ignorer ce classement ? Il a coûté un appel ; le refaire en coûtera un autre.'), { okLabel: t('Ignorer') }))) return;
      const cle = cleClassement(L);
      await repo.transitionner('imports', L.id, { attendus: [L.status], patch: (c) => { if (cleClassement(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return { status: 'ignore', finished_at: maintenant(), brouillon: null }; } });
    } catch (e) { if (!(e instanceof TransitionRefusee)) logError('regroupement.ignorer', { error: e, id: vue.id }); }
    finally { etat.occupe = false; await synchroniser({ forcer: true }); }
  }

  // --- Montage : le bus tant que le panneau est monté (désabonné au premier événement où il ne l'est plus, ou s'il ne l'a jamais été — modèle d'add.js).
  let montee = false;
  const vue = { racine, redessiner: () => synchroniser({ forcer: true }) };
  const desabonner = on('change', ({ store } = {}) => {
    if (!racine.isConnected) { if (montee) { desabonner(); vues.delete(vue); } return; }
    montee = true;
    if (store === 'imports' || store === '*') synchroniser();
  });
  vues.add(vue);
  setTimeout(() => { if (!racine.isConnected) { desabonner(); vues.delete(vue); return; } montee = true; }, 0);
  sessionAssistant(ctx).then((s) => { etat.session = s; dessiner(); prevenir(); });
  etat.signature = signatureDe(etat.ligne);
  dessiner();
  return racine;
}
