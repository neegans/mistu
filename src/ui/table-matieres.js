// Le tableau d'une table des matières lue sur plusieurs photos (lot C, spec docs/superpowers/specs/2026-10-19-table-des-matieres-design.md, § 4.3,
// § 4.4) : creerReferences (sans DOM, testable seule) ; panneauLecture, la séquence proposée des photos (tâche 3) et le tableau d'entrées (tâche 4) ;
// les textes du panneau d'index (texteEchecIndex, ligneEtatLecture, ligneIncertain, texteQuota). Rendu PAR
// indexEntriesPanel (src/ui/import.js), qui reste la porte. Tout texte par t() avec son entrée en.js (MODULES_NEUFS) ; toute donnée du modèle en nœuds
// texte ; écritures par repo.transitionner seulement (I-C1). Aucun texte ne nomme le fournisseur ni la base.
import { el, toast as toastDom } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { TransitionRefusee } from '../core/db.js';
import { logError } from '../core/log.js';
import { borner } from '../core/bornes.js';
import * as repoModule from '../model/repo.js';
import { displayUrl } from '../sync/mime.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { ordrePropose, positionsProposees, reordonnerSeance, memeOrdre, lignesTableau, trierLignes, recalculer, planCreation, compteur, fabriquerReferences, revaliderResultatIndex, pageIndexee } from '../domain/table-matieres.js';
import { deplacerPage } from '../domain/import-cible.js';
import { cleLecture, texteEchec } from './import-cible.js';
import { texteDesChamps } from './components.js';

const horloge = () => new Date().toISOString();
const estRefus = (e) => e instanceof TransitionRefusee;
const liste = (v) => (Array.isArray(v) ? v : []);

// « Créer {n} références » (§ 4.4, D-C5, R-C-2, I-C7, I-C11) : l'édition RELUE, la ligne RELUE (la même lecture : cleLecture, T4-R2), puis tout se lit dans
// la ligne RELUE (ronde 1 : cleLecture ne couvre pas page_ids, qu'« Appliquer cet ordre » réécrit) — son résultat REVALIDÉ (I-C2), les références existantes
// RELUES et un dernier recalculer (un autre onglet a pu créer entre-temps), les pages relues dans une Map, fabriquerReferences —, puis UNE transaction : la
// ligne a_verifier → enregistre (reponse_brute effacée, finished_at posé), les fiches neuves, et chaque page réécrite sur sa fiche RELUE DANS la transaction
// (condition de fusion, ronde 1 : une « p. imprimée », une position ou une réception arrivée depuis la relecture survit ; une page retirée n'est jamais
// ressuscitée, et si une fiche la cite, la transaction refuse : I-C11). Rend { issue: 'enregistre', n, doublons } | { issue: 'refuse' } (un autre chemin
// l'a enregistrée : rien d'écrit, le toast le dit) | { issue: 'sans_livre' } (l'écran le dit : sa phrase n'a pas d'entrée en.js, elle reste dans import.js)
// | { issue: 'illisible' } (résultat relu invalide : rien d'écrit, l'appelant relit) | { issue: 'change' } (T4-R2 du lot A : la ligne porte une autre
// lecture ou n'existe plus — relue avant, sans toast ; ou la clé, le statut ou une page citée a changé entre la relecture et l'écriture, vérifiés DANS la
// transaction : « Les références n’ont pas pu être créées. Réessaie. », décision 4 de la ronde 1 de T6 — rien d'écrit, l'appelant relit) | { issue: 'vide' }
// (ronde 1 de T4 : le tableau de l'écran n'a RIEN à créer — tout décoché ou en double — : rien d'écrit, jamais une lecture payée close sur zéro référence).
export async function creerReferences(ligne, lignes, { repo = repoModule, ctx = null, editionId = null, toast = toastDom, maintenant = horloge } = {}) {
  void ctx; // gardé dans la signature (spec § 4.4) : les relectures se font dans la base, jamais dans le contexte du rendu
  if (!planCreation(liste(lignes)).aCreer.length) return { issue: 'vide' };
  const edId = editionId || ligne?.edition_id || null;
  const edition = edId ? await repo.get('book_editions', edId) : null;
  if (!edition) return { issue: 'sans_livre' };
  const lue = ligne?.id ? await repo.get('imports', ligne.id) : null;
  if (lue?.status === 'enregistre') { toast(t('La lecture a déjà été enregistrée.')); return { issue: 'refuse' }; }
  const cle = cleLecture(ligne);
  if (!lue || cleLecture(lue) !== cle) return { issue: 'change' };
  const resultat = revaliderResultatIndex(lue.resultat, lue.page_ids);
  if (!resultat) return { issue: 'illisible' };
  const existantes = await repo.byIndex('recipes', 'edition_id', edition.id);
  const plan = planCreation(recalculer(liste(lignes), existantes));
  const ids = [...new Set([...resultat.photos.map((p) => p.page_id), ...liste(lue.page_ids)].filter((id) => typeof id === 'string'))];
  // Vague finale (constat 13, défense en profondeur, I-C2) : seules les pages de la SÉANCE de la ligne (relue) sont liées ou réécrites — une ligne reçue
  // qui cite la page d'une autre séance (un autre livre) ne la modifie jamais ; ses entrées sont créées sans elle (comme une page absente).
  const seanceL = typeof lue.scan_session_id === 'string' ? await repo.get('scan_sessions', lue.scan_session_id) : null;
  const pagesParId = new Map();
  for (const id of ids) { if (!liste(seanceL?.page_ids).includes(id)) continue; const p = await repo.get('source_pages', id); if (p) pagesParId.set(id, p); }
  const { recipes, pageUpdates } = fabriquerReferences(plan, { edition, pagesParId, resultat, pageIdsLigne: lue.page_ids, newId: repo.newId });
  const plages = new Map(pageUpdates.map((p) => [p.id, p.printed_page_range]));
  const citees = new Set(recipes.flatMap((r) => [r.index_page_id, ...liste(r.source_page_ids)]).filter((id) => typeof id === 'string'));
  const pages = [...new Set([...plages.keys(), ...citees])].map((id) => ({ key: id, fusion: (courant) => {
    if (!courant) { if (citees.has(id)) throw new TransitionRefusee('source_pages', id, null); return null; } // I-C11 : jamais une fiche vers une page absente
    return plages.has(id) ? pageIndexee(courant, plages.get(id)) : null; // citée sans plage à poser : vérifiée seulement
  } }));
  const fin = maintenant();
  const cloture = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', ligne.id, c.status); return { status: 'enregistre', reponse_brute: null, finished_at: fin }; };
  try {
    await repo.transitionner('imports', ligne.id, { attendus: ['a_verifier'], patch: cloture, puts: { recipes }, conditions: pages.length ? { source_pages: pages } : {} });
  } catch (e) {
    if (!estRefus(e)) throw e;
    if ((await repo.get('imports', ligne.id))?.status === 'enregistre') { toast(t('La lecture a déjà été enregistrée.')); return { issue: 'refuse' }; }
    toast(t('Les références n’ont pas pu être créées. Réessaie.'));
    return { issue: 'change' };
  }
  const doublons = plan.ecartees.dejaReperees + plan.ecartees.enDouble;
  toast(t('{n} référence(s) créée(s){d}', { n: recipes.length, d: doublons ? `, ${t('{n} doublon(s) ignoré(s)', { n: doublons })}` : '' }));
  return { issue: 'enregistre', n: recipes.length, doublons };
}

let instances = 0; // les datalist d'une instance : un compteur, jamais l'identifiant de la ligne (S-14 : il peut porter une espace ou un guillemet)

// Le texte d'une ligne echec d'un index (§ 4.2 état 3) : coupe et vide ont LEUR phrase (elles remplacent celles du lot A pour un index) ; tout le reste
// — illisible / hors_bornes et « Code : … », les phrases I-4 (annule, interrompu, incertain), les raisons de la passerelle — est texteEchec du lot A
// (ronde 1 de T4 : une définition, jamais une copie qui divergerait). Rend { texte, code }.
export function texteEchecIndex(erreur) {
  const raison = typeof erreur?.raison === 'string' ? erreur.raison : 'interne';
  if (raison === 'coupe') return { texte: t('Lecture coupée : lis moins de photos à la fois.'), code: null };
  if (raison === 'vide') return { texte: t('Aucune entrée lue sur ces photos.'), code: null };
  return texteEchec(erreur);
}
// « Lue en {s} s · {n} photo(s) » (§ 4.2 état 2, Q5) : n = les blocs du TABLEAU (resultat.photos), jamais page_ids ; sans durée lisible, « {n} photo(s) ».
// Ronde 1 : duree_ms est relue d'une ligne reçue ou restaurée — au-delà de DUREE_LISIBLE_MS (10 min, bien au-delà du délai client de 135 s), elle n'est
// pas dite.
const DUREE_LISIBLE_MS = 600000;
export function ligneEtatLecture(ligne, resultat) {
  const n = Array.isArray(resultat?.photos) ? resultat.photos.length : 0;
  const d = ligne?.duree_ms;
  return Number.isFinite(d) && d >= 0 && d <= DUREE_LISIBLE_MS ? t('Lue en {s} s · {n} photo(s)', { s: Math.round(d / 1000), n }) : t('{n} photo(s)', { n });
}
// « Incertain : … » (§ 4.2 état 2, Q1, P3) : les COMPTES d'entrées écartées EN TÊTE (par t()), puis les chaînes du modèle, par texteDesChamps
// (src/ui/components.js, vague finale du lot A, m8 : la règle de texteIncertain sur une liste, UNE définition) — chaînes seulement, Cc/Cf retirés,
// espaces repliées, jointes par « ; », bornées à INCERTAIN_MAX points de code (coupées avec « … ») ; null s'il n'y a rien.
export function ligneIncertain(resultat) {
  const e = resultat?.ecartees && typeof resultat.ecartees === 'object' ? resultat.ecartees : {};
  const parts = [];
  if (Number.isInteger(e.trop_longues) && e.trop_longues > 0) parts.push(t('{k} entrées écartées (trop longues)', { k: e.trop_longues }));
  if (Number.isInteger(e.adresse) && e.adresse > 0) parts.push(t('{k} entrées écartées (adresse)', { k: e.adresse }));
  const texte = texteDesChamps([...parts, ...(Array.isArray(resultat?.uncertain) ? resultat.uncertain : [])]);
  return texte ? t('Incertain : {t}', { t: texte }) : null;
}
export const texteQuota = () => t('Une lecture = un appel à l’assistant, compté dans ton quota du jour.');

// La lecture reçue (§ 4.3, § 4.4). Options : ligne (a_verifier), resultat (REVALIDÉ par l'appelant), session (la séance du contexte), ctx, repo, toast,
// apresOrdre({ pages, seance }) (D-C15), maintenant, editionId, surCree(r) (création réussie : l'appelant rafraîchit), surChangement() (un autre chemin a
// tranché : l'appelant relit), surSansLivre() (l'appelant le dit). Rend la racine ; racine.etatLecture() → { ordre, enregistre, lignes }.
// En haut, « Ordre des photos » (N ≥ 2, aucune photo inconnue) ; en bas, « Entrées lues » : les modifications sont LOCALES (mémoire de l'instance)
// jusqu'à « Créer {n} références » ; aucun geste ne redessine un champ en cours de saisie (le focus iPhone reste) ; ↑/↓ réordonnent les `li` sans les recréer.
// Ordre COURANT au premier rendu : la projection de la séance sur les N photos si l'ordre a été appliqué (ordre_applique_at), sinon ordrePropose.
// ↑/↓ n'écrivent RIEN (I-C6) ; « Appliquer cet ordre » écrit l'ordre SEUL, en une transaction conditionnée sur la ligne ET la séance (§ 4.3).
export function panneauLecture({ ligne, resultat, session = null, ctx = null, repo = repoModule, toast = toastDom, apresOrdre = null, maintenant = horloge, editionId = null, surCree = null, surChangement = null, surSansLivre = null } = {}) {
  const k = ++instances;
  const edId = editionId || session?.edition_id || ligne?.edition_id || null;
  const existantes = () => (Array.isArray(ctx?.recipes) ? ctx.recipes.filter((r) => r && r.edition_id === edId) : []);
  const photos = Array.isArray(resultat?.photos) ? resultat.photos : [];
  const ids = photos.map((p) => p.page_id);
  const avecOrdre = photos.length >= 2 && photos.every((p) => typeof p.page_id === 'string'); // N ≥ 2 et aucune photo inconnue
  const projection = (seance) => { const s = Array.isArray(seance) ? seance : []; return [...s.filter((id) => ids.includes(id)), ...ids.filter((id) => !s.includes(id))]; };
  const etat = { ligne, seance: Array.isArray(session?.page_ids) ? [...session.page_ids] : [], ordre: null, lignes: null, occupe: false, focus: null };
  etat.ordre = avecOrdre ? (ligne?.ordre_applique_at ? projection(etat.seance) : ordrePropose(photos)) : ids;
  const racine = el('div', { class: 'stack', dataset: { role: 'lecture' } });
  const zoneOrdre = el('div', { class: 'stack', dataset: { role: 'ordre-photos' } });
  // Ronde 1 : UNE image par page pour toute l'instance (une lecture des octets, une URL blob:) ; un redessin déplace les MÊMES nœuds, seul l'alt suit le rang.
  const images = new Map();
  const imageDe = (id) => {
    if (images.has(id)) return images.get(id);
    const img = el('img', { loading: 'lazy' });
    const page = ctx?.pagesById instanceof Map ? ctx.pagesById.get(id) : null;
    // Vague finale (constat 14) : l'URL blob: est créée par urlDeBlob (suivie, révoquée au changement de route par app.js, comme recipe.js et book.js).
    if (page?.sha256) Promise.resolve(repo.getFile(page.sha256)).then((f) => { const u = displayUrl(f, urlDeBlob); if (u) img.src = u; }).catch(() => {});
    images.set(id, img);
    return img;
  };

  // --- Ordre des photos (§ 4.3) — identique à la tâche 3, plus le réordonnancement du tableau après ↑/↓ (D-C18).
  function dessinerOrdre() {
    if (!avecOrdre) { zoneOrdre.hidden = true; zoneOrdre.replaceChildren(); return; }
    const meme = memeOrdre(etat.ordre, projection(etat.seance));
    const phrase = !meme ? el('p', { class: 'muted', style: { margin: 0 }, dataset: { role: 'etat-ordre' } }, t('Ordre proposé d’après les numéros de page lus — vérifie.'))
      : etat.ligne?.ordre_applique_at ? el('div', { class: 'status ok', dataset: { role: 'etat-ordre' } }, t('Ordre enregistré.'))
        : el('p', { class: 'muted', style: { margin: 0 }, dataset: { role: 'etat-ordre' } }, t('L’ordre des photos suit les numéros lus.'));
    const vignettes = el('div', { class: 'thumbs' });
    etat.ordre.forEach((id, i) => {
      const photo = photos.find((p) => p.page_id === id);
      const img = imageDe(id);
      img.alt = t('Page {n}', { n: i + 1 });
      const plage = Array.isArray(photo?.printed_page_range) ? photo.printed_page_range : null;
      const bouton = (role, libelle, sens) => el('button', { type: 'button', class: 'btn', dataset: { role, page: id }, disabled: etat.occupe, onClick: () => bouger(id, sens, role) }, libelle);
      vignettes.append(el('figure', { dataset: { page: id } }, el('span', { class: 'num' }, String(i + 1)), img,
        el('figcaption', { class: 'stack' },
          plage ? el('span', null, t('p. {a}-{b}', { a: plage[0], b: plage[1] })) : el('span', { class: 'chip warn' }, t('page inconnue')),
          el('div', { class: 'row' }, bouton('monter', t('Monter la page {n}', { n: i + 1 }), -1), bouton('descendre', t('Descendre la page {n}', { n: i + 1 }), 1)))));
    });
    zoneOrdre.hidden = false;
    zoneOrdre.replaceChildren(el('h3', null, t('Ordre des photos')), phrase, vignettes,
      el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', dataset: { role: 'appliquer-ordre' }, hidden: meme, disabled: etat.occupe, onClick: appliquer }, t('Appliquer cet ordre'))));
    if (etat.focus) { const { role, page } = etat.focus; etat.focus = null; zoneOrdre.querySelector(`button[data-role="${role}"][data-page="${CSS.escape(page)}"]`)?.focus(); }
  }
  // ↑/↓ (D-C3) : l'ordre courant est une donnée de l'instance ; en tête ou en queue, sans effet (le bouton reste) ; le focus suit la page déplacée ;
  // le tableau suit l'ordre courant (D-C18 : ses `li` sont déplacés, jamais recréés).
  function bouger(id, sens, role) {
    const nouvel = deplacerPage(etat.ordre, id, sens);
    if (memeOrdre(nouvel, etat.ordre)) return; // en tête ou en queue : sans effet, le bouton reste
    etat.ordre = nouvel;
    etat.focus = { role, page: id };
    dessinerOrdre();
    ordonnerTableau();
  }
  // « Appliquer cet ordre » (§ 4.3, D-C15) : l'ordre figé AU CLIC, la ligne et les pages RELUES, puis UNE transaction — la ligne (page_ids,
  // ordre_applique_at) sous attendus a_verifier, la POSITION seule de chaque page posée sur sa fiche RELUE dans la transaction (condition de fusion,
  // ronde 1 : une page retirée entre-temps n'est jamais ressuscitée, une « p. imprimée » posée entre-temps survit), la séance patchée PAR FONCTION dans la
  // transaction (une page ajoutée par un autre onglet n'est pas écrasée). La ligne doit porter la MÊME lecture (cleLecture, T4-R2 du lot A) à la
  // relecture ET dans la transaction (patch-fonction) ; dans la transaction, elle doit aussi appartenir à CETTE séance et l'ordre être une permutation des
  // photos de SA lecture revalidée (ronde 1, défense en profondeur contre un appelant qui passerait une autre séance ou un autre résultat). Refus ou autre
  // lecture → rien d'écrit, l'appelant relit. Une écriture qui échoue SANS être un refus (base pleine ou fermée) → rien d'écrit, journalisée ET dite par
  // le toast (ronde de clôture, R-C-24) ; le bouton revient. Succès → séance relue, apresOrdre.
  async function appliquer() {
    if (etat.occupe || !session) return;
    const ordre = [...etat.ordre]; // figé AU CLIC (ronde 1) : les N photos dans l'ordre que la personne avait devant elle, quoi qu'il arrive pendant les relectures
    etat.occupe = true; dessinerOrdre(); majCompteurs();
    try {
      const cle = cleLecture(etat.ligne);
      const L = await repo.get('imports', etat.ligne.id);
      if (!L || cleLecture(L) !== cle) { if (typeof surChangement === 'function') await surChangement(); return; } // jamais l'ordre de R1 sur une autre lecture
      const seanceLue = await repo.get('scan_sessions', session.id);
      const deLaSeance = Array.isArray(seanceLue?.page_ids) ? seanceLue.page_ids : etat.seance;
      const relues = new Map();
      // Vague finale (constat 13, défense en profondeur) : une position n'est posée que sur une page de la SÉANCE — jamais sur la page d'une autre séance
      // qu'une ligne reçue citerait (sa numérotation resterait intacte) ; page_ids de la ligne = l'ordre choisi, inchangé (E-24, M-C7).
      for (const id of ordre) { if (!deLaSeance.includes(id)) continue; const p = await repo.get('source_pages', id); if (p) relues.set(id, p); }
      const prop = positionsProposees(ordre, relues, deLaSeance);
      const quand = maintenant();
      const sesPhotos = (c) => { const r = revaliderResultatIndex(c.resultat, c.page_ids); const a = r ? r.photos.map((p) => p.page_id) : []; return new Set(ordre).size === ordre.length && a.length === ordre.length && ordre.every((id) => a.includes(id)); };
      const ecrite = await repo.transitionner('imports', L.id, {
        attendus: ['a_verifier'],
        // § 4.3 : page_ids = les N photos dans l'ordre choisi, jamais les seules pages relues (prop.ordre) — une photo retirée de la base entre-temps
        // sortirait de page_ids et revaliderResultatIndex rendrait la lecture payée illisible (M-C7). Positions et séance : sur prop (pages présentes).
        patch: (c) => { if (cleLecture(c) !== cle || c.scan_session_id !== session.id || !sesPhotos(c)) throw new TransitionRefusee('imports', L.id, c.status); return { page_ids: ordre, ordre_applique_at: quand }; },
        conditions: {
          source_pages: prop.pages.map((p) => ({ key: p.id, fusion: (c) => (c ? { ...c, position: p.position } : null) })),
          scan_sessions: [{ key: session.id, attendus: ['open', 'done'], patch: (c) => ({ page_ids: reordonnerSeance(Array.isArray(c.page_ids) ? c.page_ids : [], prop.ordre) }) }],
        },
      });
      const seance = await repo.get('scan_sessions', session.id);
      etat.ligne = ecrite;
      if (Array.isArray(seance?.page_ids)) etat.seance = [...seance.page_ids];
      if (typeof apresOrdre === 'function') apresOrdre({ pages: prop.pages, seance });
    } catch (e) {
      if (!estRefus(e)) { logError('table_matieres.ordre', { error: e }); toast(t('L’ordre n’a pas pu être enregistré. Réessaie.')); }
      else if (typeof surChangement === 'function') await surChangement();
    } finally { etat.occupe = false; dessinerOrdre(); majCompteurs(); }
  }

  // --- Entrées lues (§ 4.4, D-C4, D-C12, D-C18, R-C-3, I-C5)
  const zoneEntrees = el('div', { class: 'stack', dataset: { role: 'entrees-lues' } });
  const compteurEl = el('p', { class: 'muted', style: { margin: 0 }, dataset: { role: 'compteur' } });
  const ulEntrees = el('ul', { class: 'list' }); // ronde 1 : jamais `liste`, l'utilitaire du module (liste(v))
  const items = new Map(); // cle → { li, caseCoche, titre, page, section, photoEl, puces }
  etat.lignes = lignesTableau(resultat, { ordre: etat.ordre, existantes: existantes() });
  const idListe = `sections-lues-${k}`;
  const sections = [...new Set(etat.lignes.map((l) => l.section).filter((s) => typeof s === 'string' && s))];
  const datalist = el('datalist', { id: idListe }, ...sections.map((s) => el('option', { value: s })));
  const boutonCreer = el('button', { type: 'button', class: 'btn primary', dataset: { role: 'creer-references' }, onClick: () => creer() });
  const pageSaisie = (v) => { const s = String(v ?? '').trim(); return /^[1-9]\d{0,3}$/.test(s) ? parseInt(s, 10) : null; };
  function construireLi(l) {
    const caseCoche = el('input', { type: 'checkbox', onChange: (e) => modifier(l.cle, { cochee: e.target.checked, decocheeParLaPersonne: !e.target.checked }) });
    const titre = el('input', { type: 'text', maxlength: 200, 'aria-label': t('Titre'), value: l.title, onInput: (e) => modifier(l.cle, { title: e.target.value }) });
    const page = el('input', { type: 'number', min: 1, max: 9999, 'aria-label': t('p. imprimée'), value: l.printed_page ?? '', onInput: (e) => modifier(l.cle, { printed_page: pageSaisie(e.target.value) }) });
    const section = el('input', { type: 'text', maxlength: 200, list: idListe, 'aria-label': t('Section'), value: l.section ?? '', onInput: (e) => modifier(l.cle, { section: e.target.value.trim() || null }) });
    const photoEl = el('span', { class: 'muted', dataset: { role: 'photo' } });
    const puces = el('span', { class: 'chips', dataset: { role: 'puces' } });
    const li = el('li', { dataset: { cle: l.cle } }, el('div', { class: 'row top' }, caseCoche, titre), el('div', { class: 'row' }, page, section, photoEl, puces));
    return { li, caseCoche, titre, page, section, photoEl, puces };
  }
  // Ce qu'une édition met à jour : la case (cochée, désactivée, son aria-label), le rang de la photo et les puces — JAMAIS la valeur d'un champ.
  function majLi(l) {
    const it = items.get(l.cle);
    it.caseCoche.checked = l.cochee;
    it.caseCoche.disabled = !l.creable;
    it.caseCoche.setAttribute('aria-label', l.dejaReperee ? t('Déjà repérée dans ce livre') : l.enDouble ? t('En double dans cette lecture') : t('Créer une référence pour « {t} »', { t: borner(typeof l.title === 'string' ? l.title : '', 60) }));
    it.photoEl.textContent = l.photo.page_id === null ? t('photo inconnue') : t('photo {n}', { n: l.photo.rang });
    it.puces.replaceChildren(...[
      l.uncertain || l.horsPlage ? el('span', { class: 'chip warn' }, t('incertain')) : null,
      l.dejaReperee ? el('span', { class: 'chip neutral' }, t('déjà repérée')) : null,
      l.enDouble ? el('span', { class: 'chip neutral' }, t('en double')) : null,
    ].filter(Boolean));
  }
  function majCompteurs() {
    if (!etat.lignes) return;
    const c = compteur(etat.lignes);
    compteurEl.textContent = t('{n} entrées lues · {m} déjà dans ce livre', { n: c.lues, m: c.dejaDans });
    const n = planCreation(etat.lignes).aCreer.length;
    boutonCreer.textContent = n === 1 ? t('Créer 1 référence') : t('Créer {n} références', { n });
    boutonCreer.disabled = n === 0 || etat.occupe;
  }
  function modifier(cle, champs) {
    etat.lignes = recalculer(etat.lignes.map((l) => (l.cle === cle ? { ...l, ...champs } : l)), existantes());
    for (const l of etat.lignes) majLi(l);
    majCompteurs();
  }
  // D-C18 : après ↑/↓, les lignes suivent l'ordre COURANT des photos ; les `li` sont DÉPLACÉS (jamais recréés : éditions et focus restent).
  function ordonnerTableau() {
    etat.lignes = recalculer(trierLignes(etat.lignes, etat.ordre), existantes());
    for (const l of etat.lignes) { ulEntrees.append(items.get(l.cle).li); majLi(l); }
    majCompteurs();
  }
  async function creer() {
    if (etat.occupe || !planCreation(etat.lignes).aCreer.length) return; // ronde 1 : un plan vide ne clôt jamais la lecture (le bouton est éteint ; forcé, rien)
    etat.occupe = true; majCompteurs();
    let r = null;
    try { r = await creerReferences(etat.ligne, etat.lignes, { repo, ctx, editionId: edId, toast, maintenant }); }
    catch (e) { logError('table_matieres.creer', { error: e }); }
    finally { etat.occupe = false; majCompteurs(); }
    if (r?.issue === 'enregistre' && typeof surCree === 'function') await surCree(r);
    else if (r?.issue === 'sans_livre' && typeof surSansLivre === 'function') surSansLivre();
    else if (['refuse', 'illisible', 'change'].includes(r?.issue) && typeof surChangement === 'function') await surChangement();
  }
  for (const l of etat.lignes) { const it = construireLi(l); items.set(l.cle, it); ulEntrees.append(it.li); majLi(l); }
  zoneEntrees.append(el('h3', null, t('Entrées lues')), compteurEl, datalist, ulEntrees, el('div', { class: 'row' }, boutonCreer));
  majCompteurs();
  dessinerOrdre();
  racine.append(zoneOrdre, zoneEntrees);
  racine.etatLecture = () => ({ ordre: [...etat.ordre], enregistre: projection(etat.seance), lignes: etat.lignes.map((l) => ({ ...l, photo: { ...l.photo } })) });
  racine.occupe = () => etat.occupe; // ronde 1 : « Créer {n} références » ou « Appliquer cet ordre » en cours — le panneau ne relance pas une lecture pendant ce temps
  return racine;
}
