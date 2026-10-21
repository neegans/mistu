// Le tableau d'une table des matières lue sur plusieurs photos (lot C, spec docs/superpowers/specs/2026-10-19-table-des-matieres-design.md, § 4.3,
// § 4.4) : creerReferences (sans DOM, testable seule) ; la séquence proposée des photos et le tableau d'entrées arrivent aux tâches 3 et 4. Rendu PAR
// indexEntriesPanel (src/ui/import.js), qui reste la porte. Tout texte par t() avec son entrée en.js (MODULES_NEUFS) ; toute donnée du modèle en nœuds
// texte ; écritures par repo.transitionner seulement (I-C1). Aucun texte ne nomme le fournisseur ni la base.
import { el, toast as toastDom } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { TransitionRefusee } from '../core/db.js';
import { logError } from '../core/log.js';
import * as repoModule from '../model/repo.js';
import { displayUrl } from '../sync/mime.js';
import { ordrePropose, positionsProposees, reordonnerSeance, memeOrdre, recalculer, planCreation, fabriquerReferences, revaliderResultatIndex, pageIndexee } from '../domain/table-matieres.js';
import { deplacerPage } from '../domain/import-cible.js';
import { cleLecture } from './import-cible.js';

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
// transaction : « Les références n’ont pas pu être créées. Réessaie. », décision 4 de la ronde 1 de T6 — rien d'écrit, l'appelant relit).
export async function creerReferences(ligne, lignes, { repo = repoModule, ctx = null, editionId = null, toast = toastDom, maintenant = horloge } = {}) {
  void ctx; // gardé dans la signature (spec § 4.4) : les relectures se font dans la base, jamais dans le contexte du rendu
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
  const pagesParId = new Map();
  for (const id of ids) { const p = await repo.get('source_pages', id); if (p) pagesParId.set(id, p); }
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

// La lecture reçue (§ 4.3 ; le tableau d'entrées s'ajoute en tâche 4). Options : ligne (a_verifier), resultat (REVALIDÉ par l'appelant), session (la
// séance du contexte), ctx, repo, apresOrdre({ pages, seance }) (D-C15 : l'écran de séance se met à jour EN PLACE), maintenant, surChangement() (un
// autre chemin a tranché : l'appelant relit). Rend la racine ; racine.etatLecture() → { ordre, enregistre, lignes }.
// Ordre COURANT au premier rendu : la projection de la séance sur les N photos si l'ordre a été appliqué (ordre_applique_at), sinon ordrePropose.
// ↑/↓ n'écrivent RIEN (I-C6) ; « Appliquer cet ordre » écrit l'ordre SEUL, en une transaction conditionnée sur la ligne ET la séance (§ 4.3).
export function panneauLecture({ ligne, resultat, session = null, ctx = null, repo = repoModule, apresOrdre = null, maintenant = horloge, surChangement = null } = {}) {
  const photos = Array.isArray(resultat?.photos) ? resultat.photos : [];
  const ids = photos.map((p) => p.page_id);
  const avecOrdre = photos.length >= 2 && photos.every((p) => typeof p.page_id === 'string'); // N ≥ 2 et aucune photo inconnue
  const projection = (seance) => { const s = Array.isArray(seance) ? seance : []; return [...s.filter((id) => ids.includes(id)), ...ids.filter((id) => !s.includes(id))]; };
  const etat = { ligne, seance: Array.isArray(session?.page_ids) ? [...session.page_ids] : [], ordre: null, lignes: null, occupe: false, focus: null };
  etat.ordre = avecOrdre ? (ligne?.ordre_applique_at ? projection(etat.seance) : ordrePropose(photos)) : ids;
  const racine = el('div', { class: 'stack', dataset: { role: 'lecture' } });
  const zoneOrdre = el('div', { class: 'stack', dataset: { role: 'ordre-photos' } });

  function dessinerOrdre() {
    if (!avecOrdre) { zoneOrdre.hidden = true; zoneOrdre.replaceChildren(); return; }
    const meme = memeOrdre(etat.ordre, projection(etat.seance));
    const phrase = !meme ? el('p', { class: 'muted', style: { margin: 0 }, dataset: { role: 'etat-ordre' } }, t('Ordre proposé d’après les numéros de page lus — vérifie.'))
      : etat.ligne?.ordre_applique_at ? el('div', { class: 'status ok', dataset: { role: 'etat-ordre' } }, t('Ordre enregistré.'))
        : el('p', { class: 'muted', style: { margin: 0 }, dataset: { role: 'etat-ordre' } }, t('L’ordre des photos suit les numéros lus.'));
    const vignettes = el('div', { class: 'thumbs' });
    etat.ordre.forEach((id, i) => {
      const photo = photos.find((p) => p.page_id === id);
      const page = ctx?.pagesById instanceof Map ? ctx.pagesById.get(id) : null;
      const img = el('img', { alt: t('Page {n}', { n: i + 1 }), loading: 'lazy' });
      if (page?.sha256) Promise.resolve(repo.getFile(page.sha256)).then((f) => { const u = displayUrl(f); if (u) img.src = u; }).catch(() => {});
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
  // ↑/↓ (D-C3) : l'ordre courant est une donnée de l'instance ; en tête ou en queue, sans effet (le bouton reste) ; le focus suit la page déplacée.
  function bouger(id, sens, role) {
    const nouvel = deplacerPage(etat.ordre, id, sens);
    if (memeOrdre(nouvel, etat.ordre)) return;
    etat.ordre = nouvel;
    etat.focus = { role, page: id };
    dessinerOrdre();
  }
  // « Appliquer cet ordre » (§ 4.3, D-C15) : la ligne et les pages RELUES, puis UNE transaction — la ligne (page_ids, ordre_applique_at) sous
  // attendus a_verifier, les positions des N pages (précalculées sur les pages relues : fenêtre nommée en § 11), la séance patchée PAR FONCTION dans la
  // transaction (une page ajoutée par un autre onglet n'est pas écrasée). La ligne doit porter la MÊME lecture (cleLecture, T4-R2 du lot A) à la
  // relecture ET dans la transaction (patch-fonction). Refus ou autre lecture → rien d'écrit, l'appelant relit. Succès → séance relue, apresOrdre.
  async function appliquer() {
    if (etat.occupe || !session) return;
    etat.occupe = true; dessinerOrdre();
    try {
      const cle = cleLecture(etat.ligne);
      const L = await repo.get('imports', etat.ligne.id);
      if (!L || cleLecture(L) !== cle) { if (typeof surChangement === 'function') await surChangement(); return; } // jamais l'ordre de R1 sur une autre lecture
      const seanceLue = await repo.get('scan_sessions', session.id);
      const ordre = [...etat.ordre]; // les N photos dans l'ordre choisi (les boutons sont éteints pendant l'écriture)
      const relues = new Map();
      for (const id of ordre) { const p = await repo.get('source_pages', id); if (p) relues.set(id, p); }
      const prop = positionsProposees(ordre, relues, Array.isArray(seanceLue?.page_ids) ? seanceLue.page_ids : etat.seance);
      const quand = maintenant();
      const ecrite = await repo.transitionner('imports', L.id, {
        attendus: ['a_verifier'],
        // § 4.3 : page_ids = les N photos dans l'ordre choisi, jamais les seules pages relues (prop.ordre) — une photo retirée de la base entre-temps
        // sortirait de page_ids et revaliderResultatIndex rendrait la lecture payée illisible (M-C7). Positions et séance : sur prop (pages présentes).
        patch: (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', L.id, c.status); return { page_ids: ordre, ordre_applique_at: quand }; },
        puts: { source_pages: prop.pages },
        conditions: { scan_sessions: [{ key: session.id, attendus: ['open', 'done'], patch: (c) => ({ page_ids: reordonnerSeance(Array.isArray(c.page_ids) ? c.page_ids : [], prop.ordre) }) }] },
      });
      const seance = await repo.get('scan_sessions', session.id);
      etat.ligne = ecrite;
      if (Array.isArray(seance?.page_ids)) etat.seance = [...seance.page_ids];
      if (typeof apresOrdre === 'function') apresOrdre({ pages: prop.pages, seance });
    } catch (e) {
      if (!estRefus(e)) logError('table_matieres.ordre', { error: e });
      else if (typeof surChangement === 'function') await surChangement();
    } finally { etat.occupe = false; dessinerOrdre(); }
  }

  dessinerOrdre();
  racine.append(zoneOrdre);
  racine.etatLecture = () => ({ ordre: [...etat.ordre], enregistre: projection(etat.seance), lignes: etat.lignes ? etat.lignes.map((l) => ({ ...l, photo: { ...l.photo } })) : null });
  return racine;
}
