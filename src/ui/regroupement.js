// Un lot de recettes photographiées (lot D, spec docs/superpowers/specs/2026-10-19-recettes-en-lot-design.md, § 4.2 à 4.6, § 4.8.3) : le panneau
// « Classement » d'une séance de scan — classer les photos cochées en UN appel (le vol partagé lancerVol de C, outil extraction), montrer le vol, l'échec et
// la ligne à lancer, l'écran de regroupement (groupes corrigeables, brouillon gardé dans la ligne), l'appariement proposé à une référence, « Lire ces
// recettes » (une transaction gardée par la clé du classement rendu) et la lecture du lot (une à la fois) ; et (tâche 5) la proposition de référence de
// l'éditeur. Tout ce que le module écrit passe par repo.transitionner ou repo.ouvrirImport (I-D1) ; la sortie du modèle est une DONNÉE HOSTILE revalidée
// avant tout usage et rendue en nœuds texte (I-D2). Le paramètre s'appelle `repo` partout (le test statique le lit). Ce module n'importe jamais
// src/ui/import.js ni src/ui/recipe-edit.js, qui l'importent (pas de cycle). Tous les textes neufs du lot vivent ici (filet i18n : MODULES_NEUFS).
// Dépendances injectables { repo, toast, confirmer, navigate, fetch, maintenant, battementMs, enLigne } : la suite n'ouvre ni dialogue, ni réseau, ni routeur.
import { el, toast as toastDom, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate as naviguerDom } from '../core/router.js';
import { logError } from '../core/log.js';
import { on, emit } from '../core/bus.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { borner } from '../core/bornes.js';
import { TransitionRefusee } from '../core/db.js';
import { typeAffichage, displayUrl } from '../sync/mime.js';
import * as repoModule from '../model/repo.js';
import { classerPhotos, MAX_TOKENS_CLASSER, MAX_PHOTOS_CLASSEMENT } from '../domain/llm.js';
import { IMPORTS_OUVERTS, lotDeRecette, importOuvert } from '../domain/import-cible.js';
import { cleClassement, resultatClassement, revaliderResultatClassement, regroupementInitial, deplacerVers, bougerDansGroupe, retirerDuGroupe, brouillonDe, restaurerBrouillon, candidatsReference, referencesOccupees, proposerAppariements, filtrerReferences, lecturesDuLot, suiteDuLot, pagesEnCours, referenceALire } from '../domain/classement.js';
import { trierParSeance, pagesALire, ligneOuverteDeSeance } from '../domain/table-matieres.js';
import { lancerVol, lancerExtraction, annulerVol, volEnCours, estEnLigne, texteEchec, BATTEMENT_MS, cleLecture } from './import-cible.js';
import { sessionAssistant, carteConnexion, messageGardeRefusee, texteDesChamps, TEXTE_CONNEXION } from './components.js';
import { demarrerConnexion } from './settings.js';
import { messageErreurImage } from './livre-ajout.js';
import { capturerProprietaire, conditionProprietaire } from './recette-garde.js';

const horloge = () => new Date().toISOString();
const liste = (v) => (Array.isArray(v) ? v : []);
const memeListe = (a, b) => { const A = liste(a); const B = liste(b); return A.length === B.length && A.every((x, i) => x === B[i]); };
let instances = 0; // les identifiants d'aria-labelledby : un compteur, jamais un identifiant de la base
// UN lot en lecture par document (I-D5) : posé avant tout await, libéré en finally (lireLeLot). Les tests seuls le réinitialisent.
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
const titre60 = (r) => borner(typeof r?.original_title === 'string' ? r.original_title : '', 60);
const libelleReference = (r) => (Number.isInteger(r?.printed_page) ? `${titre60(r)} — ${t('p.')} ${r.printed_page}` : titre60(r));
// Les octets d'une page sont-ils ICI (ronde 1 de T3, constat 23 : UNE règle pour trois appelants — verifierOctets, octetsPresents, creerLesLectures) : une
// empreinte, une ligne files lisible, un Blob ; une erreur de lecture compte pour « absents ». Chaque appelant garde sa règle pour une page sans empreinte.
async function octetsIci(repo, sha256) {
  if (!sha256) return false;
  try { return (await repo.getFile(sha256))?.blob instanceof Blob; } catch { return false; }
}
const texteRefusLire = (raison) => (raison === 'pages' ? t('Rien n’a été lancé : une photo est déjà en cours d’import ailleurs.')
  : raison === 'octets_absents' ? t('Les photos de cette séance ne sont pas sur cet appareil.')
    : t('Rien n’a été lancé : ce classement, le livre de la séance ou une référence choisie a changé entre-temps.'));
// La raison dite sous une proposition incertaine (§ 4.4, § 4.8.3) : une définition pour l'écran de regroupement et l'éditeur.
const MOTIFS = { titre: () => t('Titre semblable, page différente ou inconnue.'), page: () => t('Même page, titre différent.'), conflit: () => t('Une autre recette du lot vise aussi cette référence.') };

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

// La note de séance (D-D18, § 4.2) : quand des lignes de LOT de cette séance sont ouvertes, « {n} recette(s) de cette séance dans Imports » et le lien
// « Voir les imports » (#/add?section=imports : la section y reçoit le focus) ; sinon null. Rendue au montage de la séance (sessionView).
export function noteLotsDeSeance(session, ctx) {
  const n = liste(ctx?.imports).filter((i) => importOuvert(i) && lotDeRecette(i) !== null && i.scan_session_id === session?.id).length; // ronde 1 : lignes `recette` seules
  if (!n) return null;
  return el('div', { class: 'row', dataset: { role: 'note-lots' } },
    el('div', { class: 'status info' }, t('{n} recette(s) de cette séance dans Imports', { n })),
    el('a', { class: 'btn small', href: '#/add?section=imports' }, t('Voir les imports')));
}

// Le sélecteur de repli « Choisir une référence… » (§ 4.4 ; aussi pour la proposition de l'éditeur, D-D19) : un champ de recherche (la saisie ne
// redessine QUE la liste : le focus reste dans le champ), les 20 premières candidates de filtrerReferences (précédées de `enTete` sans saisie), sans
// celles de `exclus` (cochées par un autre groupe) ; les occupées ÉTEINTES avec « Import en cours — voir Imports » ; « Nouvelle recette » en bas si
// `nouvelle`. Libellé : « titre — p. N » composé avec la clé existante « p. ». `surChoix(id | null)`, `surSaisie(texte)`.
export function selecteurReferences({ candidats = [], occupees = [], exclus = new Set(), enTete = [], saisie = '', surSaisie = null, surChoix, nouvelle = true } = {}) {
  const racine = el('div', { class: 'stack', dataset: { role: 'selecteur' } });
  const champ = el('input', { type: 'search', 'aria-label': t('Chercher dans les références de ce livre'), placeholder: t('Chercher dans les références de ce livre'), value: saisie });
  const zoneListe = el('div', { class: 'stack' });
  const dessinerListe = () => {
    const q = champ.value;
    const libres = liste(candidats).filter((r) => !exclus.has(r.id));
    const tete = q.trim() ? [] : liste(enTete).map((id) => libres.find((r) => r.id === id)).filter(Boolean);
    const tous = [...tete, ...filtrerReferences(libres, q).filter((r) => !tete.includes(r))];
    const visibles = tous.slice(0, 20);
    const prises = filtrerReferences(occupees, q);
    const enfants = [];
    if (visibles.length) enfants.push(el('ul', { class: 'list' }, ...visibles.map((r) => el('li', null, el('button', { type: 'button', class: 'btn', dataset: { role: 'reference', id: r.id }, onClick: () => surChoix(r.id) }, libelleReference(r))))));
    if (prises.length) enfants.push(el('ul', { class: 'list' }, ...prises.map((r) => el('li', null, el('button', { type: 'button', class: 'btn', disabled: true, dataset: { role: 'reference-occupee', id: r.id } }, libelleReference(r)), el('small', { class: 'muted' }, t('Import en cours — voir Imports'))))));
    if (tous.length > 20) enfants.push(el('p', { class: 'muted' }, t('{n} autres : affine la recherche.', { n: tous.length - 20 })));
    if (!visibles.length && !prises.length) enfants.push(el('p', { class: 'muted' }, t('Aucune référence ne correspond.')));
    if (nouvelle) enfants.push(el('button', { type: 'button', class: 'btn', dataset: { role: 'nouvelle-recette' }, onClick: () => surChoix(null) }, t('Nouvelle recette')));
    zoneListe.replaceChildren(...enfants);
  };
  champ.addEventListener('input', () => { if (typeof surSaisie === 'function') surSaisie(champ.value); dessinerListe(); });
  racine.append(champ, zoneListe);
  dessinerListe();
  return racine;
}

// « Lire ces recettes » (§ 4.5, D-D4, D-D17, D-D23, I-D7, I-D9) — sans DOM. `cle` et `editionId` : ceux du RENDU ; `choix` : Map(cle → recipe_id | null),
// les choix effectifs (faits, à défaut les propositions cochées). Toutes les relectures AVANT la transaction ; AUCUNE écriture avant elle ; puis UNE
// transaction : le classement a_verifier → enregistre (clé rejouée DANS la transaction), les lignes neuves (absente) et une condition d'index par
// référence cochée. Rend { issue: 'cree', importIds } ou { issue: 'refuse', raison }.
export async function creerLesLectures(classementId, { cle, editionId = null, etat, choix, ctx = null, repo = repoModule, maintenant = horloge, newId = repoModule.newId, deviceId = repoModule.deviceId() } = {}) {
  const refuse = (raison) => ({ issue: 'refuse', raison });
  const ligne = await repo.get('imports', classementId);
  if (!ligne || ligne.status !== 'a_verifier' || cleClassement(ligne) !== cle) return refuse('classement');
  if (!revaliderResultatClassement(ligne.resultat, ligne.page_ids)) return refuse('classement');
  const seance = typeof ligne.scan_session_id === 'string' ? await repo.get('scan_sessions', ligne.scan_session_id) : null;
  if ((seance?.edition_id ?? null) !== (editionId ?? null)) return refuse('edition');
  const recettes = editionId ? liste(await repo.byIndex('recipes', 'edition_id', editionId)) : []; // jamais l'index interrogé avec null
  const imports = liste(await repo.all('imports'));
  const candidats = new Set(candidatsReference(recettes, { editionId, imports }).map((r) => r.id));
  for (const id of (choix instanceof Map ? choix.values() : [])) if (id != null && !candidats.has(id)) return refuse('reference');
  const prises = pagesEnCours(imports, ligne.scan_session_id, { sauf: classementId });
  const pagesGroupes = liste(etat?.groupes).flatMap((g) => liste(g.page_ids));
  if (pagesGroupes.some((p) => prises.has(p))) return refuse('pages');
  const pagesParId = new Map();
  for (const id of pagesGroupes) { const p = await repo.get('source_pages', id); if (p) pagesParId.set(id, p); }
  for (const p of pagesParId.values()) if (!(await octetsIci(repo, p.sha256))) return refuse('octets_absents');
  const { lignes, references } = lecturesDuLot(etat, choix, { classement: ligne, editionId, sessionId: ligne.scan_session_id ?? null, deviceId, newId, pagesParId });
  // Ronde 1 (constats 17 et 27) : AUCUNE ligne à créer — aucun groupe (n = 0 : le bouton est éteint, un rendu périmé peut le rallumer), ou toutes les
  // photos des groupes supprimées ailleurs — → refus, rien d'écrit : le classement payé n'est jamais enregistré pour rien (D-D21) ; la fonction derrière
  // un bouton éteint a sa propre garde.
  if (!lignes.length) return refuse('classement');
  try {
    await repo.transitionner('imports', classementId, {
      attendus: ['a_verifier'],
      patch: (c) => { if (cleClassement(c) !== cle) throw new TransitionRefusee('imports', classementId, c.status); return { status: 'enregistre', reponse_brute: null, brouillon: null, finished_at: maintenant() }; },
      puts: { imports: lignes },
      conditions: { imports: [...lignes.map((l) => ({ key: l.id, absente: true })), ...references.map((r) => ({ index: 'recipe_id', valeur: r, exclus: IMPORTS_OUVERTS }))] },
    });
  } catch (e) { if (e instanceof TransitionRefusee) return refuse('transition'); throw e; }
  return { issue: 'cree', importIds: lignes.map((l) => l.id) };
}

// La lecture du lot (§ 4.6, D-D4, D-D10, D-D22, S-3) : UN lot par document, posé avant tout await ; la prise et la libération émettent chacune un change
// « imports » (la libération n'écrit rien). Liste FIGÉE au départ : les a_lancer de CET appareil du lot, par rang ; chacune tentée une fois, une à la fois,
// par lancerExtraction avec attendus [a_lancer] (une ligne passée echec ou prise ailleurs depuis le gel est refusée AVANT tout POST) ; sur un echec, la
// ligne est RELUE pour son erreur.extra ; suiteDuLot décide (défaut fermé). Rien n'est écrit sur une recette par le lot (I-3 du lot A).
export async function lireLeLot(classementId, { ctx, repo = repoModule, fetch: fetchInjecte = undefined, maintenant = horloge, battementMs = BATTEMENT_MS, enLigne = estEnLigne } = {}) {
  if (lot) return { issue: 'refuse', raison: 'lot_tenu' };
  const tenue = { classementId };
  lot = tenue;
  emit('change', { store: 'imports' });
  let lues = 0, echecs = 0, sautees = 0, arret = null;
  try {
    const moi = repo.deviceId();
    const lignes = liste(await repo.byIndex('imports', 'status', 'a_lancer')).filter((l) => l && l.device_id === moi && lotDeRecette(l)?.classement_id === classementId).sort((a, b) => lotDeRecette(a).rang - lotDeRecette(b).rang);
    for (const l of lignes) {
      // Ronde 1 de la tâche 4 : la référence RELUE juste avant le lancement — complétée ou absente (referenceALire, la règle du compte de « Continuer ») →
      // sautée comme un refus de REFUS_SAUT_LOT, avant toute écriture et tout POST.
      if (!referenceALire(l, typeof l.recipe_id === 'string' && l.recipe_id ? await repo.get('recipes', l.recipe_id) : null)) { sautees += 1; continue; }
      const retour = await lancerExtraction(l.id, { ctx, repo, fetch: fetchInjecte, maintenant, enLigne, battementMs, attendus: ['a_lancer'] });
      const relue = retour?.issue === 'echec' ? await repo.get('imports', l.id) : l;
      const suite = suiteDuLot(retour, relue);
      if (retour?.issue === 'a_verifier') lues += 1;
      else if (retour?.issue === 'echec') echecs += 1;
      else if (suite === 'sauter') sautees += 1;
      if (suite === 'arreter') { arret = retour?.raison ?? retour?.issue ?? 'inconnu'; break; }
    }
    return { issue: 'fini', lues, echecs, sautees, arret };
  } finally {
    if (lot === tenue) lot = null;
    emit('change', { store: 'imports' });
  }
}

// Le panneau « Classement » (§ 4.2) : monté par sessionView SOUS les miniatures. `getSelection()` rend les identifiants cochés ; `importId` = la ligne de
// classement désignée (?import=) — sinon la plus récente ouverte de la séance. États : 1) aucun classement ouvert → panneau caché, « Classer… » dans la
// barre (actionsSelection) ; 2) en vol ; 3) reçu : l'écran de regroupement ; 4) échec ; 5) à lancer. La ligne est lue au rendu dans ctx.imports, RELUE
// (repo.get) avant toute écriture ; le panneau suit le bus (D-D22) et ne se redessine que si sa signature change ; `surChangement()` redessine la barre.
export function panneauClassement(session, ctx, getSelection, { repo = repoModule, toast = toastDom, confirmer = confirmDialog, navigate = naviguerDom, fetch: fetchInjecte = undefined, maintenant = horloge, battementMs = BATTEMENT_MS, enLigne = estEnLigne, importId = null, surChangement = null, veilleMs = repoModule.BATTEMENT_MORT_MS + 1000 } = {}) {
  const racine = el('div', { class: 'card stack', dataset: { role: 'classement' } });
  const pagesSeance = () => liste(session?.page_ids);
  const presentes = (ids) => liste(ids).filter((id) => typeof id === 'string' && ctx?.pagesById instanceof Map && ctx.pagesById.has(id));
  // ligne : le classement ouvert de la séance ; imports, recettes, edition : relus ; session : celle de l'assistant (undefined tant qu'elle n'est pas
  // lue) ; occupe : un geste écrit (verrou d'instance) ; regroupement : l'état de l'écran 3 (R) ; ecriture / aEcrire : le brouillon en vol et celui qui
  // attend ; focus : { role, page } à focaliser au prochain dessin ; illisibles : les clés déjà marquées illisibles (jamais deux fois).
  const etat = { ligne: ligneOuverteDeSeance(ctx?.imports, session?.id, { importId, kind: 'classement' }), imports: liste(ctx?.imports), recettes: liste(ctx?.recipes), edition: session?.edition_id ?? null,
    session: undefined, occupe: false, signature: null, regroupement: null, ecriture: null, aEcrire: false, focus: null, illisibles: new Set(), instance: ++instances };
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

  // État 1 : ce que la barre de sélection place AVANT « Regrouper en recette » (rien à moins de deux cochées) ; aux états 3, 4 et 5, le panneau dépend de
  // la sélection : il se redessine à chaque redessin de la barre.
  racine.actionsSelection = () => {
    // Ronde 1 de T3 (constat 19) : l'état 3 aussi — « Reclasser » y lit la sélection (pagesALire) : il suit chaque case cochée, jamais un clic muet.
    if (ouverte()) { if (['a_lancer', 'echec', 'a_verifier'].includes(etat.ligne.status)) dessiner(); return []; }
    const coches = trierParSeance(presentes(getSelection()), pagesSeance());
    if (coches.length < 2) return [];
    const r = raisonEteint(coches, null);
    return [el('button', { type: 'button', class: 'btn primary', dataset: { role: 'classer' }, disabled: !!r || etat.occupe, onClick: () => classer() }, t('Classer ces photos avec l’assistant')), ligneSousBouton(r)].filter(Boolean);
  };
  // « Regrouper en recette » n'est retiré que si un classement EN VOL ou REÇU de la séance touche la sélection (D-D3, B-13).
  // Vague finale (revue de branche, constat 4 ; D-D15 « ne pas payer deux fois les mêmes photos ») : ni si la sélection touche une photo d'une LECTURE DE
  // RECETTE ouverte de la séance (ligne de lot pas encore lue, lecture ciblée, autre « Regrouper ») — l'éditeur la relirait comme recette, un appel de
  // plus ; une ligne d'index ou de classement garde sa règle (C : les pages d'un index repris restent regroupables ; D-D3 ci-dessus).
  racine.regrouperPermis = (selection) => {
    const L = etat.ligne;
    const prises = pagesEnCours(etat.imports.filter((i) => i?.kind === 'recette'), session?.id);
    if (liste(selection).some((p) => prises.has(p))) return false;
    if (!L || !['en_cours', 'a_verifier'].includes(L.status)) return true;
    const siennes = new Set(liste(L.page_ids));
    return !liste(selection).some((p) => siennes.has(p));
  };
  racine.etatClassement = () => {
    const R = etat.regroupement && etat.ligne?.status === 'a_verifier' ? etat.regroupement : null;
    return { importId: etat.ligne?.id ?? null, status: etat.ligne?.status ?? null,
      groupes: R ? R.etat.groupes.map((g) => ({ cle: g.cle, page_ids: [...g.page_ids], recipe_id: R.affiches.get(g.cle) ?? null })) : [],
      aPart: R ? R.etat.aPart.map((a) => ({ page_id: a.page_id, motif: a.motif })) : [],
      appels: Number.isInteger(etat.ligne?.appels) ? etat.ligne.appels : 0, lot: lotEnCours()?.classementId ?? null, brouillon: etat.ligne?.brouillon ?? null };
  };

  // --- États 2, 4 et 5 ------------------------------------------------------------------------------------------------------------------------------
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

  // --- État 3 : l'écran de regroupement (§ 4.3, § 4.4, D-D20, D-D23, D-D24) ----------------------------------------------------------------------
  // R = { cle, editionId, resultat, etat, choix (les choix FAITS), octets (Map page → octets présents, null tant que non vérifiés), ouverture (sélecteurs
  // ouverts), saisies (texte de chaque sélecteur), affiches (les choix EFFECTIFS du dernier rendu) }. Préparé une fois par clé de classement.
  const urls = new Map(); // sha256 → URL blob: de CETTE instance, réutilisée à chaque redessin (révoquées par app.js au changement de route)
  function poserImage(img, sha) {
    if (!sha) return;
    if (urls.has(sha)) { img.src = urls.get(sha); return; }
    Promise.resolve(repo.getFile(sha)).then((f) => {
      // Ronde 1 (constat 18) : une miniature est une IMAGE de la liste blanche (typeAffichage, F-9 du lot G : le type du blob gagne) ; l'URL vient de
      // displayUrl — la seule copie de la règle de retypage (f8cfafa) —, créée par urlDeBlob (suivie, révoquée par app.js) et gardée par empreinte.
      if (!typeAffichage(f)?.startsWith('image/')) return;
      if (!urls.has(sha)) urls.set(sha, displayUrl(f, urlDeBlob));
      img.src = urls.get(sha);
    }).catch(() => {});
  }
  async function verifierOctets(R) {
    const m = new Map();
    for (const pid of [...R.etat.groupes.flatMap((g) => g.page_ids), ...R.etat.aPart.map((a) => a.page_id)].slice(0, MAX_PHOTOS_CLASSEMENT)) {
      m.set(pid, await octetsIci(repo, ctx?.pagesById?.get(pid)?.sha256));
    }
    R.octets = m;
    if ([...m.values()].includes(false)) suivreMoteur();
    if (etat.regroupement === R) dessiner();
  }
  // Vague finale (revue de branche, constat 5 ; D-D24 après G) : des octets arrivés pendant que l'écran est monté (« Télécharger » du lot G, passe du
  // moteur : rien sur le bus) — dès qu'une photo manque, le panneau suit les états publiés par le moteur et revérifie tant qu'il en manque une : « Lire »
  // et « Reclasser » se rallument, leur raison se tait, sans quitter la séance. Pris seulement par un panneau MONTÉ (jamais par un rendu dépassé) ;
  // rendu au premier état qui le trouve détaché, ou avec le bus.
  let suiviMoteur = null;
  function suivreMoteur() {
    if (suiviMoteur || !racine.isConnected || typeof ctx?.sync?.moteur?.onEtat !== 'function') return;
    suiviMoteur = ctx.sync.moteur.onEtat(() => {
      if (!racine.isConnected) { quitterMoteur(); return; }
      const R = etat.regroupement;
      if (R?.octets && [...R.octets.values()].includes(false)) verifierOctets(R);
    });
  }
  function quitterMoteur() { if (suiviMoteur) { suiviMoteur(); suiviMoteur = null; } }
  function preparer(L) {
    const resultat = revaliderResultatClassement(L.resultat, L.page_ids);
    if (!resultat) return null;
    const pagesParId = ctx?.pagesById instanceof Map ? ctx.pagesById : new Map();
    const restaure = restaurerBrouillon(L.brouillon ?? null, { resultat, pageIds: L.page_ids, startedAt: L.started_at, pagesParId });
    const base = restaure ?? { etat: regroupementInitial(resultat, pagesParId), choixFaits: new Map() };
    const R = { cle: cleClassement(L), editionId: etat.edition, resultat, etat: base.etat, choix: base.choixFaits, octets: null, ouverture: new Map(), saisies: new Map(), affiches: new Map() };
    verifierOctets(R);
    return R;
  }
  // Les choix EFFECTIFS : le choix fait (revalidé contre les candidates du moment : une référence qui n'est plus candidate retombe sur la proposition),
  // sinon la proposition cochée ; jamais deux groupes sur la même référence (le second perd).
  function choixEffectifs(R, propositions, candidats) {
    const ids = new Set(candidats.map((r) => r.id));
    const m = new Map();
    for (const g of R.etat.groupes) {
      const fait = R.choix.has(g.cle) ? R.choix.get(g.cle) : undefined;
      if (fait === null) m.set(g.cle, null);
      else if (typeof fait === 'string' && ids.has(fait)) m.set(g.cle, fait);
      else { const p = propositions.get(g.cle); m.set(g.cle, p?.cochee ? p.recipe_id : null); }
    }
    const vus = new Set();
    for (const [c, id] of m) { if (id && vus.has(id)) m.set(c, null); else if (id) vus.add(id); }
    return m;
  }
  function figurePage(pid, rang, cle, x) {
    const R = etat.regroupement;
    const p = ctx?.pagesById?.get(pid) ?? null;
    const img = el('img', { alt: t('Page {n}', { n: rang }), loading: 'lazy' });
    poserImage(img, p?.sha256);
    const puces = [];
    if (cle) { if (x.partagees.has(pid)) puces.push(el('span', { class: 'chip warn' }, t('porte peut-être deux recettes'))); }
    else {
      const a = R.etat.aPart.find((y) => y.page_id === pid);
      puces.push(a?.motif === 'orpheline' ? el('span', { class: 'chip warn' }, t('sans début de recette')) : el('span', { class: 'chip neutral' }, a?.motif === 'retiree' ? t('retirée') : t('non classée')));
    }
    if (x.prises.has(pid)) puces.push(el('span', { class: 'chip warn' }, t('déjà en cours d’import')));
    if (p?.kind === 'recipe') puces.push(el('span', { class: 'chip neutral' }, t('déjà liée à une recette')));
    const bouton = (role, libelle, calcul, focus) => el('button', { type: 'button', class: 'btn', dataset: { role, page: pid }, onClick: () => geste(calcul(), focus) }, libelle);
    const rangee = cle ? el('div', { class: 'row' },
      bouton('monter', t('Monter la page {n}', { n: rang }), () => bougerDansGroupe(R.etat, cle, pid, -1), { role: 'monter', page: pid }),
      bouton('descendre', t('Descendre la page {n}', { n: rang }), () => bougerDansGroupe(R.etat, cle, pid, 1), { role: 'descendre', page: pid }),
      bouton('retirer', t('Retirer la page {n}', { n: rang }), () => retirerDuGroupe(R.etat, pid), { role: 'deplacer', page: pid })) : null;
    const options = [el('option', { value: '' }, t('Déplacer vers…')),
      ...R.etat.groupes.filter((g) => g.cle !== cle).map((g) => el('option', { value: g.cle }, g.title ? t('Recette {k} — {t}', { k: x.rangs.get(g.cle), t: g.title }) : t('Recette {k}', { k: x.rangs.get(g.cle) }))),
      el('option', { value: 'nouveau' }, t('Nouvelle recette'))];
    const deplacer = el('select', { 'aria-label': t('Déplacer la page {n} vers…', { n: rang }), dataset: { role: 'deplacer', page: pid }, onChange: (e) => { const v = e.target.value; if (v) geste(deplacerVers(R.etat, pid, v), { role: 'deplacer', page: pid }); } }, ...options);
    return el('figure', { dataset: { page: pid } }, el('span', { class: 'num' }, String(rang)), img, el('figcaption', { class: 'stack' }, ...puces, rangee, deplacer));
  }
  function blocAppariement(g, x) {
    const R = etat.regroupement;
    const zone = el('div', { class: 'stack', dataset: { role: 'appariement' } });
    if (!R.editionId) return zone; // D-D16 : séance sans livre, aucun appariement
    const prop = x.propositions.get(g.cle) ?? { recipe_id: null, certitude: 'aucune', motif: null, cochee: false, ordre: [] };
    const choisi = x.choix.get(g.cle) ?? null;
    const parId = new Map(x.candidats.map((r) => [r.id, r]));
    const autreDe = (id) => [...x.choix].find(([c, v]) => c !== g.cle && v === id)?.[0] ?? null;
    const cible = choisi ?? (prop.motif === 'plusieurs' ? null : prop.recipe_id);
    if (cible && parId.has(cible)) {
      const r = parId.get(cible);
      const question = choisi !== cible && prop.certitude !== 'sure';
      const texte = Number.isInteger(r.printed_page)
        ? (question ? t('Complète “{t}”, p. {p} ?', { t: titre60(r), p: r.printed_page }) : t('Complète “{t}”, p. {p}', { t: titre60(r), p: r.printed_page }))
        : (question ? t('Complète “{t}” ?', { t: titre60(r) }) : t('Complète “{t}”', { t: titre60(r) }));
      const autre = autreDe(cible);
      const caseRef = el('input', { type: 'checkbox', checked: choisi === cible, disabled: !!autre, ...(autre ? { 'aria-label': t('Déjà choisie pour la recette {k}', { k: x.rangs.get(autre) }) } : {}), onChange: (e) => choisir(g.cle, e.target.checked ? cible : null) });
      zone.append(el('label', { class: 'check' }, caseRef, ' ', texte));
      if (question && Object.hasOwn(MOTIFS, prop.motif ?? '')) zone.append(el('small', { class: 'muted' }, MOTIFS[prop.motif]()));
      if (choisi !== cible) zone.append(el('p', { class: 'muted' }, t('Nouvelle recette — “{t}” restera repérée.', { t: titre60(r) })));
    } else if (prop.motif === 'plusieurs') zone.append(el('p', { class: 'muted' }, t('Plusieurs références possibles.')), el('p', { class: 'muted' }, t('Nouvelle recette')));
    else zone.append(el('p', { class: 'muted' }, t('Nouvelle recette')));
    const ouvert = R.ouverture.has(g.cle) ? R.ouverture.get(g.cle) : (prop.motif === 'plusieurs' && !choisi);
    const exclus = new Set([...x.choix].filter(([c, v]) => c !== g.cle && v).map(([, v]) => v));
    const selecteur = selecteurReferences({ candidats: x.candidats, occupees: x.occupees, exclus, enTete: prop.motif === 'plusieurs' ? prop.ordre : [], saisie: R.saisies.get(g.cle) ?? '', surSaisie: (v) => R.saisies.set(g.cle, v), surChoix: (id) => choisir(g.cle, id), nouvelle: true });
    selecteur.hidden = !ouvert;
    const bascule = el('button', { type: 'button', class: 'btn', dataset: { role: 'choisir-reference' }, 'aria-expanded': ouvert ? 'true' : 'false', onClick: () => { const o = selecteur.hidden; R.ouverture.set(g.cle, o); selecteur.hidden = !o; bascule.setAttribute('aria-expanded', o ? 'true' : 'false'); } }, t('Choisir une référence…'));
    zone.append(bascule, selecteur);
    return zone;
  }
  function blocGroupe(g, rang, x) {
    const idTitre = `classement-${etat.instance}-${g.cle}`;
    const vignettes = el('div', { class: 'thumbs' });
    g.page_ids.forEach((pid, j) => vignettes.append(figurePage(pid, j + 1, g.cle, x)));
    return el('section', { class: 'card flat stack', 'aria-labelledby': idTitre, dataset: { role: 'groupe', cle: g.cle } },
      el('h3', { id: idTitre }, t('Recette {k}', { k: rang })),
      el('div', { class: 'row' }, g.title ? el('span', null, g.title) : el('span', { class: 'muted' }, t('(titre non lu)')), Number.isInteger(g.printed_page) ? el('span', { class: 'muted' }, `${t('p.')} ${g.printed_page}`) : null, g.uncertain ? el('span', { class: 'chip warn' }, t('incertain')) : null),
      vignettes, blocAppariement(g, x));
  }
  function blocAPart(x) {
    const vignettes = el('div', { class: 'thumbs' });
    etat.regroupement.etat.aPart.forEach((a, j) => vignettes.append(figurePage(a.page_id, j + 1, null, x)));
    return el('section', { class: 'card flat stack', dataset: { role: 'a-part' } }, el('h3', null, t('Photos qui ne seront pas lues')), el('p', { class: 'muted' }, t('Déplace-les vers une recette si elles en font partie.')), vignettes);
  }
  function pied(L, x) {
    const R = etat.regroupement;
    const n = R.etat.groupes.length;
    const pagesGroupes = R.etat.groupes.flatMap((g) => g.page_ids);
    const manquent = R.octets ? pagesGroupes.some((p) => R.octets.get(p) === false) : false;
    const prisesDe = (pages) => pages.filter((p) => x.prises.has(p)).length;
    const commune = !enLigne() ? { texte: t('Tu es hors ligne.') }
      : (etat.session === undefined || R.octets === null) ? { attente: true }
        // Ronde 1 (constat 29, F-7 du lot passerelle) : la garde de compte a refusé l'adresse → la carte dit son message, la ligne n'invite pas à se connecter.
        : !etat.session ? (messageGardeRefusee(ctx?.sync) ? { attente: true } : { texte: t(TEXTE_CONNEXION) })
          : (volEnCours() || lotEnCours()) ? { texte: t('Une lecture est en cours : attends sa fin ou annule-la.') }
            : manquent ? { texte: t('Les photos de cette séance ne sont pas sur cet appareil.') } : null;
    const kLire = prisesDe(pagesGroupes);
    const raisonLire = commune ?? (kLire ? { texte: t('{k} photo(s) déjà en cours d’import ailleurs : retire-les de leur recette, ou termine l’autre import.', { k: kLire }) } : null);
    const aReclasser = pagesALire(presentes(getSelection()), L, pagesSeance(), ctx?.pagesById);
    // Ronde 1 (constat 19) : la raison qui éteint « Reclasser » pour la SÉLECTION est dite (les textes de raisonEteint, I-D4) — jamais un bouton éteint en
    // silence ; elle va sur sa propre ligne (raison-reclasser) : la ligne de « Lire » reste la seule de § 4.3.
    const kReclasser = prisesDe(aReclasser);
    const raisonReclasser = commune ?? (aReclasser.length > MAX_PHOTOS_CLASSEMENT ? { texte: t('Classe au plus 10 photos à la fois : décoche-en {k}.', { k: aReclasser.length - MAX_PHOTOS_CLASSEMENT }) }
      : kReclasser ? { texte: t('Décoche les photos déjà en cours d’import ({k}).', { k: kReclasser }) }
        : aReclasser.length < 2 ? { texte: t('Coche au moins deux photos de cette séance.') } : null);
    const blocs = [el('div', { dataset: { role: 'hors-ligne' } }, ...(enLigne() ? [] : [el('div', { class: 'status warn' }, t('Tu es hors ligne.'))]))];
    if (etat.session === null) blocs.push(carteConnexion(connecter, ctx));
    if (n === 0) blocs.push(el('p', { class: 'muted' }, t('Aucune recette à lire : déplace des photos vers une recette, ou ignore ce classement.')));
    blocs.push(el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn primary', dataset: { role: 'lire-recettes' }, disabled: !!raisonLire || n === 0 || etat.occupe, onClick: lireRecettes }, n === 1 ? t('Lire cette recette (1 appel)') : t('Lire ces recettes ({n} appels)', { n })),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'reclasser' }, disabled: !!raisonReclasser || etat.occupe, onClick: () => classer() }, t('Reclasser')),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'ignorer-classement' }, disabled: etat.occupe, onClick: ignorerClassement }, t('Ignorer ce classement'))));
    if (!raisonLire) blocs.push(el('small', { class: 'muted', dataset: { role: 'raison-lire' } }, t('Une lecture = un appel à l’assistant, compté dans ton quota du jour.')));
    else if (raisonLire.texte) blocs.push(el('small', { class: 'muted', dataset: { role: 'raison-lire' } }, raisonLire.texte));
    if (raisonReclasser && raisonReclasser !== commune && raisonReclasser.texte) blocs.push(el('small', { class: 'muted', dataset: { role: 'raison-reclasser' } }, raisonReclasser.texte));
    return blocs;
  }
  function ecranRegroupement(L) {
    if (etat.regroupement?.cle !== cleClassement(L)) {
      const R = preparer(L);
      // Ronde 1 de T2 : pendant le marquage, un nœud NEUTRE — jamais le rôle de l'écran de regroupement (un test qui attend cet écran ne lit pas un écran vide).
      if (!R) { etat.regroupement = null; marquerIllisible(L); return el('div', { class: 'stack', dataset: { role: 'revalidation' } }); }
      etat.regroupement = R;
    }
    const R = etat.regroupement;
    // Ronde 1 (constat 22) : ecranRegroupement est un RENDU qui écrit R.editionId et R.affiches (l'édition et les choix RENDUS) ; une action ne relit
    // JAMAIS R.* après un dessiner() — elle prend ce qui est rendu AVANT (lireRecettes : `rendu`), sinon elle agirait sur un rendu que personne n'a vu.
    R.editionId = etat.edition; // l'édition de la séance RELUE (D-D23) : brouillon gardé quand le livre change
    const candidats = candidatsReference(etat.recettes, { editionId: R.editionId, imports: etat.imports });
    const occupees = referencesOccupees(etat.recettes, { editionId: R.editionId, imports: etat.imports });
    const propositions = proposerAppariements(R.etat.groupes, candidats);
    const choix = choixEffectifs(R, propositions, candidats);
    R.affiches = choix;
    const x = { candidats, occupees, propositions, choix, rangs: new Map(R.etat.groupes.map((g, i) => [g.cle, i + 1])), prises: pagesEnCours(etat.imports, session?.id, { sauf: L.id }), partagees: new Set(R.resultat.partagees) };
    const n = R.resultat.groupes.length;
    const box = el('div', { class: 'stack', dataset: { role: 'regroupement' } },
      el('h2', null, t('Recettes trouvées')),
      el('p', { class: 'muted' }, n === 1 ? t('1 recette proposée par l’assistant — vérifie le groupe avant de lire.') : t('{n} recettes proposées par l’assistant — vérifie les groupes avant de lire.', { n })));
    // « Incertain : … » (§ 4.3, R-D-19) : texteDesChamps (src/ui/components.js, m8 du lot A, la règle de texteIncertain sur une liste, UNE définition,
    // comme C) — chaînes seulement, Cc/Cf retirés, espaces repliées, jointes par « ; », bornées à INCERTAIN_MAX points de code (« … ») ; null s'il ne
    // reste rien ; rendue en nœud texte.
    const incertain = texteDesChamps(R.resultat.uncertain);
    if (incertain) box.append(el('p', { class: 'muted', dataset: { role: 'incertain' } }, t('Incertain : {t}', { t: incertain })));
    if (!R.editionId) box.append(el('p', { class: 'status info' }, t('Aucun livre associé à cette séance : chaque recette sera une nouvelle recette.')));
    R.etat.groupes.forEach((g, i) => box.append(blocGroupe(g, i + 1, x)));
    if (R.etat.aPart.length) box.append(blocAPart(x));
    box.append(...pied(L, x));
    return box;
  }
  // Vague finale (revue de branche, constat 7 ; VF-15 du lot A, comme l'écran ciblé, l'écran web et le panneau d'index) : un classement en vol AILLEURS dont
  // le document est mort (app rechargée moins de 90 s après le départ, onglet tué) n'attend plus le démarrage — la passe `interrompu` (repo.marquerInterrompus,
  // mêmes règles, horloge du panneau) à l'affichage, puis toutes les BATTEMENT_MORT_MS + 1 s tant qu'il vole ailleurs et que le panneau est monté.
  let veille = null;
  function veiller(maintenantAussi = true) {
    const L = etat.ligne;
    if (veille || L?.status !== 'en_cours' || volEnCours()?.importId === L.id || typeof repo.marquerInterrompus !== 'function') return;
    const passe = () => { const m = Date.parse(maintenant()); return repo.marquerInterrompus(Number.isFinite(m) ? m : undefined).then((n) => (n ? synchroniser({ forcer: true }) : null)).catch((e) => logError('regroupement.interrompus', { error: e })); };
    if (maintenantAussi) passe();
    veille = setTimeout(() => { veille = null; if (racine.isConnected) passe().then(() => veiller(false)); }, veilleMs);
  }
  function dessiner() {
    const L = ouverte() ? etat.ligne : null;
    racine.hidden = !L;
    if (!L) { racine.replaceChildren(); return; }
    if (L.status === 'en_cours') { racine.replaceChildren(...blocEnVol(L)); veiller(); }
    else if (L.status === 'a_verifier') racine.replaceChildren(ecranRegroupement(L));
    else racine.replaceChildren(...blocALancer(L));
    if (etat.focus) { const { role, page } = etat.focus; etat.focus = null; racine.querySelector(`[data-role="${role}"][data-page="${CSS.escape(page)}"]`)?.focus(); }
  }

  // --- Relecture (D-D22) : le journal, la séance (son livre) et les recettes relus ; la ligne suivie (ou, terminée, la plus récente ouverte de la
  // séance) ; redessin si la signature change.
  let file = Promise.resolve();
  function synchroniser({ forcer = false } = {}) {
    file = file.then(async () => {
      const [imports, seance, recettes] = await Promise.all([repo.all('imports'), session?.id ? repo.get('scan_sessions', session.id) : null, repo.all('recipes')]);
      etat.imports = liste(imports); etat.recettes = liste(recettes);
      if (seance) etat.edition = seance.edition_id ?? null;
      const relue = etat.ligne ? etat.imports.find((i) => i && i.id === etat.ligne.id) ?? null : null;
      etat.ligne = relue && IMPORTS_OUVERTS.includes(relue.status) ? relue : (ligneOuverteDeSeance(etat.imports, session?.id, { kind: 'classement' }) ?? relue);
      const sig = signatureDe(etat.ligne);
      if (forcer || sig !== etat.signature) { etat.signature = sig; dessiner(); prevenir(); }
    }).catch((e) => logError('regroupement.relecture', { error: e }));
    return file;
  }

  // --- Gestes de l'écran de regroupement : chacun écrit le BROUILLON (D-D20) puis redessine le panneau SEUL (jamais la route) ; aucun appel, aucune ligne.
  function ecrireBrouillon() {
    if (etat.ecriture) { etat.aEcrire = true; return etat.ecriture; } // une écriture à la fois ; la suivante portera l'état le plus récent
    const R = etat.regroupement; const L = etat.ligne;
    if (!R || !L || L.status !== 'a_verifier') return Promise.resolve();
    const cle = R.cle;
    const brouillon = brouillonDe(R.etat, R.choix, L.started_at);
    // Ronde 1 (constat 25) : un brouillon REFUSÉ (la clé ou le statut ont changé ailleurs) n'est jamais gardé en silence — le panneau relit la ligne et
    // montre l'état réel ; l'écriture en attente tombe avec lui (elle serait refusée de même).
    etat.ecriture = repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch: (c) => { if (cleClassement(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return { brouillon }; } })
      .then(() => false, (e) => { if (e instanceof TransitionRefusee) return true; logError('regroupement.brouillon', { error: e, id: L.id }); return false; })
      .then((refuse) => { etat.ecriture = null; if (refuse) { etat.aEcrire = false; synchroniser({ forcer: true }); } else if (etat.aEcrire) { etat.aEcrire = false; ecrireBrouillon(); } });
    return etat.ecriture;
  }
  function geste(nouvelEtat, focus = null) {
    const R = etat.regroupement;
    if (!R || etat.ligne?.status !== 'a_verifier') return;
    if (JSON.stringify(nouvelEtat) === JSON.stringify(R.etat)) return; // en tête, en queue, même place : sans effet, rien d'écrit
    R.etat = nouvelEtat;
    for (const c of [...R.choix.keys()]) if (!R.etat.groupes.some((g) => g.cle === c)) R.choix.delete(c); // un groupe vidé emporte son choix
    etat.focus = focus;
    ecrireBrouillon();
    dessiner();
  }
  function choisir(cle, id) {
    const R = etat.regroupement;
    if (!R || etat.ligne?.status !== 'a_verifier') return;
    R.choix.set(cle, id);
    R.ouverture.set(cle, false);
    ecrireBrouillon();
    dessiner();
  }

  // --- Gestes qui écrivent le journal -------------------------------------------------------------------------------------------------------------
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
      if (p?.sha256 && !(await octetsIci(repo, p.sha256))) return false; // une page sans empreinte ne bloque pas ici (lancerVol la juge)
    }
    return true;
  }
  const remiseAZero = (pages) => ({ status: 'a_lancer', page_ids: [...pages], resultat: null, reponse_brute: null, erreur: null, duree_ms: null, model: null, finished_at: null, brouillon: null });
  function direRefus(r) {
    if (r.raison === 'octets_absents') toast(t('Les photos de cette séance ne sont pas sur cet appareil.'));
    else if (r.raison === 'image') toast(messageErreurImage({ code: r.code }));
    else if (r.raison === 'hors_ligne') toast(t('Tu es hors ligne.'));
    else if (r.raison === 'vol_tenu') toast(t('Une lecture est déjà en cours : annule-la d’abord.'));
    // non_connecte (classer() pose la session : la carte revient au redessin ; ronde 1, constat 24 — direRefus ne fait que DIRE), inconnu, transition,
    // sans_page, sorte : redessin silencieux.
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
        // Ronde 1 (constat 26) : le dialogue a pu durer — réseau et session revérifiés AVANT d'effacer le classement payé et le brouillon (sinon la remise à
        // zéro serait écrite, puis lancerVol refuserait : un classement jeté sans appel) ; rien d'écrit, le redessin le montre.
        if (!enLigne()) { toast(t('Tu es hors ligne.')); return; }
        etat.session = await sessionAssistant(ctx);
        if (!etat.session) return;
        const cle = cleClassement(L);
        await repo.transitionner('imports', L.id, { attendus: ['a_verifier'], patch: (c) => { if (cleClassement(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return remiseAZero(pages); } });
      } else if (L && !memeListe(pages, L.page_ids)) {
        await repo.transitionner('imports', L.id, L.status === 'echec' ? { attendus: ['echec'], patch: remiseAZero(pages) } : { attendus: ['a_lancer'], patch: { page_ids: [...pages] } });
      } else if (!L) {
        const ligne = await repo.ouvrirImport({ kind: 'classement', edition_id: session?.edition_id ?? null, scan_session_id: session?.id ?? null, page_ids: pages });
        id = ligne.id; etat.ligne = ligne;
      }
      // Vague finale (revue de branche, constat 9 ; D-D1) : le vol est lié aux pages COMPTÉES — une ligne dont page_ids a été réécrite entre ces relectures et
      // celle du vol (réception, autre onglet) est refusée (sorte) avant toute écriture et tout décodage ; le redessin montre la ligne réelle.
      const r = await lancerVol(id, executerClassement, { ctx, repo, fetch: fetchInjecte, maintenant, enLigne, battementMs, accepte: (l) => l?.kind === 'classement' && memeListe(l.page_ids, pages) });
      if (r.issue === 'refuse') { if (r.raison === 'non_connecte') etat.session = null; direRefus(r); }
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
  // « Lire ces recettes » (§ 4.5) : le verrou d'instance ; le brouillon en vol d'abord ; creerLesLectures avec la clé et l'édition RENDUES et les choix
  // EFFECTIFS ; refus → le toast, puis le panneau relu (propositions recalculées sur la base relue) ; créé → lireLeLot lancé SANS être attendu (ses erreurs
  // au journal), le toast, puis Imports si le panneau est encore monté (D-D18).
  async function lireRecettes() {
    const R = etat.regroupement; const L = etat.ligne;
    if (!R || !L || etat.occupe) return;
    // Ronde 1 (constat 28) : revérifiés AU CLIC, avant toute écriture (un rendu périmé : l'événement offline relu en différé, un vol posé sans événement) —
    // le réseau, la session, un vol ou un lot tenus ; le refus est dit, rien n'est écrit, le panneau relu.
    const refus = !enLigne() ? t('Tu es hors ligne.') : (volEnCours() || lotEnCours()) ? t('Une lecture est déjà en cours : annule-la d’abord.') : null;
    if (refus || !etat.session) { if (refus) toast(refus); await synchroniser({ forcer: true }); return; }
    // Vérification de la tâche 3 (D-D23, § 4.5) : la clé, l'édition, l'état et les choix RENDUS, pris AVANT le redessin qui éteint le bouton — ce
    // redessin relit etat.edition et les recettes que le bus a pu changer sans redessiner (la signature ne les porte pas) : la personne ne l'a pas vu.
    const rendu = { cle: R.cle, editionId: R.editionId, etat: R.etat, choix: R.affiches };
    etat.occupe = true; dessiner();
    let cree = null;
    try {
      if (etat.ecriture) await etat.ecriture;
      const r = await creerLesLectures(L.id, { ...rendu, ctx, repo, maintenant, newId: repo.newId, deviceId: repo.deviceId() });
      if (r.issue === 'refuse') toast(texteRefusLire(r.raison)); else cree = r;
    } catch (e) { logError('regroupement.lire', { error: e }); toast(t('Une erreur est survenue')); } // ronde 1 (constat 28) : jamais un clic sans retour
    finally { etat.occupe = false; }
    if (cree) {
      // Ronde 1 (constat 28) : un lot refusé (lot_tenu : un autre lot pris pendant la création) est DIT ; les lectures restent à lancer depuis Imports.
      lireLeLot(L.id, { ctx, repo, fetch: fetchInjecte, maintenant, battementMs, enLigne })
        .then((r) => { if (r?.issue === 'refuse') toast(t('Une lecture est déjà en cours : annule-la d’abord.')); })
        .catch((e) => logError('regroupement.lot', { error: e }));
      const n = cree.importIds.length;
      toast(n === 1 ? t('1 recette à lire : suis-la dans Imports.') : t('{n} recettes à lire : suis-les dans Imports.', { n }));
      if (racine.isConnected) navigate('/add?section=imports');
    }
    await synchroniser({ forcer: true });
  }

  // --- Montage : le bus tant que le panneau est monté (désabonné au premier événement où il ne l'est plus, ou s'il ne l'a jamais été — modèle d'add.js).
  let montee = false;
  const vue = { racine, redessiner: () => synchroniser({ forcer: true }) };
  const desabonner = on('change', ({ store } = {}) => {
    if (!racine.isConnected) { if (montee) { desabonner(); quitterMoteur(); vues.delete(vue); } return; }
    montee = true;
    if (store === 'imports' || store === 'recipes' || store === 'scan_sessions' || store === '*') synchroniser();
  });
  vues.add(vue);
  setTimeout(() => { if (!racine.isConnected) { desabonner(); quitterMoteur(); vues.delete(vue); return; } montee = true; }, 0);
  sessionAssistant(ctx).then((s) => { etat.session = s; dessiner(); prevenir(); });
  etat.signature = signatureDe(etat.ligne);
  dessiner();
  return racine;
}

// « Enregistrer dans cette référence » (§ 4.8.3, D-D19) — sans DOM : la lecture du journal de la clé RENDUE (`cle`), a_verifier, de sorte recette, sans
// référence, reçoit `recipeId` — la référence relue, encore candidate de l'édition de la ligne (reference_only, sans lien web, sans import ouvert) ; dans la
// transaction, la clé, la sorte et l'absence de référence regardées, la candidature rejouée (ronde 1) et la condition d'index d'I-2. Aucun appel. Rend { issue: 'rattache' } ou
// { issue: 'refuse', raison: 'lecture' | 'reference' | 'transition' }.
export async function rattacherLecture(importId, recipeId, { cle, repo = repoModule, compte = null, ctx = null } = {}) {
  const capture = compte || capturerProprietaire(repo, ctx);
  const refuse = (raison) => ({ issue: 'refuse', raison });
  const ligne = await repo.get('imports', importId);
  const proprietaire = await capture;
  if (!ligne || ligne.status !== 'a_verifier' || ligne.kind !== 'recette' || ligne.recipe_id != null || cleLecture(ligne) !== cle) return refuse('lecture');
  const reference = typeof recipeId === 'string' ? await repo.get('recipes', recipeId) : null;
  const contexte = reference && repo.capturerContexteRecette ? await repo.capturerContexteRecette(reference) : null;
  const editionId = typeof ligne.edition_id === 'string' ? ligne.edition_id : null;
  if (!reference || !candidatsReference([reference], { editionId, imports: liste(await repo.all('imports')) }).length) return refuse('reference');
  try {
    await repo.transitionner('imports', importId, {
      ...(contexte ? { recettes: [contexte] } : {}),
      attendus: ['a_verifier'],
      patch: (c) => { if (cleLecture(c) !== cle || c.kind !== 'recette' || c.recipe_id != null) throw new TransitionRefusee('imports', importId, c.status); return { recipe_id: recipeId }; },
      conditions: { imports: [{ index: 'recipe_id', valeur: recipeId, exclus: IMPORTS_OUVERTS }], sync_state: [conditionProprietaire(proprietaire)] },
      // Ronde 1 : la candidature de la référence rejouée DANS la transaction (une lecture reçue a pu la rendre available entre-temps) ; vérification
      // seule, par le sac `autres` du lot A : la fusion ne rend jamais de fiche, rien n'est écrit sur `recipes`.
      autres: { recipes: [{ key: recipeId, fusion: (r) => { if (!candidatsReference(r ? [r] : [], { editionId }).length) throw new TransitionRefusee('recipes', recipeId, null); return null; } }] },
    });
  } catch (e) { if (e instanceof TransitionRefusee) return refuse('transition'); throw e; }
  return { issue: 'rattache' };
}

// La proposition de l'éditeur (§ 4.8.3, D-D19) : la règle de D-D5 (proposerAppariements, une définition) appliquée au titre et à la page LUS par
// l'extraction ; sans candidate dans l'édition de la ligne, null. Sûre : « Ces pages complètent “{t}”, p. {p}. » et le primaire ; titre ou page : la
// question, sa raison et un bouton secondaire ; plusieurs : le sélecteur ouvert, ces candidates en tête ; aucune : le seul « Choisir une référence… ».
// Toujours : ce que le geste fait. Ne rien choisir EST la nouvelle recette (le sélecteur n'offre pas « Nouvelle recette »). Refus → le toast, puis le
// bloc relu et redessiné (une référence prise entre-temps n'est plus proposée ; une autre lecture le retire). Tout est rendu en nœuds texte (I-D2).
export function blocApparierLecture({ ligne, resultat, ctx, repo = repoModule, navigate = naviguerDom, toast = toastDom } = {}) {
  const editionId = typeof ligne?.edition_id === 'string' ? ligne.edition_id : null;
  if (!editionId || !resultat || typeof resultat !== 'object') return null;
  const candidats = candidatsReference(liste(ctx?.recipes), { editionId, imports: liste(ctx?.imports) });
  if (!candidats.length) return null;
  const occupees = referencesOccupees(liste(ctx?.recipes), { editionId, imports: liste(ctx?.imports) });
  const lu = { cle: 'lu', title: typeof resultat.title === 'string' ? resultat.title : null, printed_page: Number.isInteger(resultat.printed_page) ? resultat.printed_page : null, origine: 'classement' };
  const prop = proposerAppariements([lu], candidats).get('lu');
  const compte = capturerProprietaire(repo, ctx);
  const cle = cleLecture(ligne);
  const racine = el('div', { class: 'card flat stack', dataset: { role: 'apparier-lecture' } });
  let occupe = false;
  async function rattacher(recipeId) {
    if (occupe) return;
    occupe = true;
    try {
      const r = await rattacherLecture(ligne.id, recipeId, { cle, repo, compte });
      if (r.issue === 'rattache') { if (racine.isConnected) navigate('/recipes/' + encodeURIComponent(recipeId) + '/importer'); return; }
      toast(t('Rien n’a été rattaché : cette lecture ou cette référence a changé entre-temps.'));
      const [L, recipes, imports] = await Promise.all([repo.get('imports', ligne.id), repo.all('recipes'), repo.all('imports')]);
      const tenue = !!L && L.status === 'a_verifier' && L.kind === 'recette' && L.recipe_id == null && cleLecture(L) === cle;
      const frais = tenue ? blocApparierLecture({ ligne: L, resultat, ctx: { ...ctx, recipes, imports }, repo, navigate, toast }) : null;
      racine.replaceWith(frais ?? el('div', { hidden: true }));
    } catch (e) { logError('regroupement.rattacher', { error: e, id: ligne.id }); toast(t('Une erreur est survenue')); } // ronde 1 : un échec est dit
    finally { occupe = false; }
  }
  const r = prop?.recipe_id ? candidats.find((x) => x.id === prop.recipe_id) ?? null : null;
  const avecPage = (sure) => (Number.isInteger(r.printed_page)
    ? (sure ? t('Ces pages complètent “{t}”, p. {p}.', { t: titre60(r), p: r.printed_page }) : t('Ces pages complètent peut-être “{t}”, p. {p} ?', { t: titre60(r), p: r.printed_page }))
    : (sure ? t('Ces pages complètent “{t}”.', { t: titre60(r) }) : t('Ces pages complètent peut-être “{t}” ?', { t: titre60(r) })));
  if (r) {
    const sure = prop.certitude === 'sure';
    racine.append(el('p', { dataset: { role: 'proposition' } }, avecPage(sure)));
    if (!sure && Object.hasOwn(MOTIFS, prop.motif ?? '')) racine.append(el('small', { class: 'muted', dataset: { role: 'motif' } }, MOTIFS[prop.motif]()));
    racine.append(el('button', { type: 'button', class: sure ? 'btn primary' : 'btn', dataset: { role: 'enregistrer-reference' }, onClick: () => rattacher(r.id) }, t('Enregistrer dans cette référence')));
  } else if (prop?.motif === 'plusieurs') racine.append(el('p', { class: 'muted' }, t('Plusieurs références possibles.')));
  racine.append(el('small', { class: 'muted', dataset: { role: 'avertissement' } }, t('La lecture sera enregistrée telle que lue dans la référence ; tes changements ici ne la suivent pas.')));
  const ouvert = prop?.motif === 'plusieurs';
  const selecteur = selecteurReferences({ candidats, occupees, enTete: ouvert ? prop.ordre : [], surChoix: (id) => { if (id) rattacher(id); }, nouvelle: false });
  selecteur.hidden = !ouvert;
  const bascule = el('button', { type: 'button', class: 'btn', dataset: { role: 'choisir-reference' }, 'aria-expanded': ouvert ? 'true' : 'false', onClick: () => { const o = selecteur.hidden; selecteur.hidden = !o; bascule.setAttribute('aria-expanded', o ? 'true' : 'false'); } }, t('Choisir une référence…'));
  racine.append(bascule, selecteur);
  return racine;
}
