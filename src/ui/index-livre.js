// Lot I1 « index fiable » (spec docs/superpowers/specs/2026-10-28-index-fiable-design.md, rév. 2) : le panneau d'index d'une séance de scan.
// L'IA lit chaque page (une lecture par page, D-I1), regroupe et classe ; à la fin de la lecture, les recettes CERTAINES deviennent des références
// « À importer » du livre, sans geste de plus (D-I15) ; la personne ne tranche que les ambiguïtés (« À vérifier ») et peut remettre une entrée écartée.
// Toute écriture passe par repo (transitionner : la ligne du journal et ses fiches en UNE transaction) ; le vol est celui du document (lancerVol).
import { el, toast as toastDom, confirmDialog, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { on } from '../core/bus.js';
import { logError } from '../core/log.js';
import * as repoModule from '../model/repo.js';
import { TransitionRefusee } from '../core/db.js';
import { sessionAssistant, carteConnexion } from './components.js';
import { newId as nouvelId } from '../core/ids.js';
import { lancerVol, annulerVol, volEnCours, ecouterVol, estEnLigne, texteRefus, cleLecture, BATTEMENT_MS } from './import-cible.js';
import { texteEchecIndex } from './table-matieres.js';
import { executantIndexParPage, relireResultatIndex, consolider, modelesValides, MODELES_INDEX, fabriquerReferenceIndex, completerExistante, referenceIntacte, renvoisDe, textePlages, cleTitre } from '../domain/index-livre.js';
import { importOuvert } from '../domain/import-cible.js';
import { capturerProprietaire, conditionProprietaire } from './recette-garde.js';

const horloge = () => new Date().toISOString();
const liste = (v) => (Array.isArray(v) ? v : []);

// Les lignes d'index d'une séance, et pour chaque page la lecture la plus RÉCENTE qui l'a lue (une page relue plus tard l'emporte ; une page en échec
// ne remplace pas une page lue). Rend { lignes, pages (format 2, une par page_id), decisions (fusion de toutes les lignes), modeleValide }.
export function lectureDeSeance(imports, sessionId, pageIdsSeance = null) {
  // Rangées par l'heure de DÉPART de la lecture (started_at, sinon created_at) : updated_at bouge quand une décision s'écrit dans la ligne, et une
  // vieille lecture repasserait alors devant une relecture plus récente de la même page.
  const quand = (L) => String(L.started_at || L.created_at || L.updated_at || '');
  const lignes = liste(imports).filter((i) => i?.kind === 'index' && i.scan_session_id === sessionId).sort((a, b) => quand(a).localeCompare(quand(b)));
  const parPage = new Map();
  const decisions = {};
  for (const L of lignes) {
    Object.assign(decisions, L.decisions && typeof L.decisions === 'object' ? L.decisions : {});
    if (L.status !== 'a_verifier' && L.status !== 'enregistre') continue;
    let r;
    try { r = relireResultatIndex(L.resultat, L.page_ids, { modeleLigne: L.model ?? null }); } catch { continue; }
    for (const p of r.pages) {
      const avant = parPage.get(p.page_id);
      if (p.etat === 'echec' && avant && avant.etat !== 'echec') continue;
      parPage.set(p.page_id, { ...p, ligne_id: L.id });
    }
  }
  const permis = Array.isArray(pageIdsSeance) ? new Set(pageIdsSeance) : null;
  const pages = [...parPage.values()].filter((p) => !permis || permis.has(p.page_id));
  return { lignes, pages, decisions, modeleValide: modelesValides(pages) };
}

// L'enregistrement automatique (D-I15) d'une ligne a_verifier pas encore enregistrée : consolider toutes les pages lues de la séance contre les fiches
// du livre, créer les certaines et compléter les existantes « À importer », en UNE transaction conditionnée à la lecture montrée (cleLecture) et à
// `auto_enregistre_at` encore vide (deux onglets : un seul enregistre). Rend { cree, aVerifier } ou null (rien à faire, ou refusé).
export async function enregistrerAuto(ligneId, { ctx, session, repo = repoModule, maintenant = horloge, newId = nouvelId, compte = null } = {}) {
  const proprietaire = await (compte || capturerProprietaire(repo, ctx));
  const L = await repo.get('imports', ligneId);
  if (!L || L.kind !== 'index' || L.status !== 'a_verifier' || L.auto_enregistre_at) return null;
  const edition = session?.edition_id ? (ctx?.editionsById?.get(session.edition_id) ?? await repo.get('book_editions', session.edition_id)) : null;
  if (!edition) return null;
  const imports = await repo.all('imports');
  const lecture = lectureDeSeance(imports, session.id, session.page_ids);
  const recettes = (await repo.all('recipes')).filter((r) => r.edition_id === edition.id);
  const c = consolider(lecture.pages, { existantes: recettes, modeleValide: lecture.modeleValide });
  const nouvelles = c.certaines.map((x) => fabriquerReferenceIndex(x, { edition, newId, importId: ligneId }));
  const completees = [];
  for (const d of c.dejaDans) {
    const ex = recettes.find((r) => r.id === d.existanteId);
    const patch = completerExistante(ex, d);
    if (patch) completees.push({ ...ex, ...patch });
  }
  const restantes = c.aVerifier.filter((x) => !lecture.decisions[x.cle]);
  const cle = cleLecture(L);
  const quand = maintenant();
  try {
    await repo.transitionner('imports', ligneId, {
      attendus: ['a_verifier'],
      patch: (cur) => {
        if (cur.auto_enregistre_at || cleLecture(cur) !== cle) throw new TransitionRefusee('imports', ligneId, cur.status);
        return { auto_enregistre_at: quand, enregistrees: nouvelles.map((r) => r.id), ...(restantes.length ? {} : { status: 'enregistre', finished_at: quand }) };
      },
      puts: { recipes: [...nouvelles, ...completees] },
      conditions: { recipes: nouvelles.map(r => ({ key: r.id, absente: true })), sync_state: [conditionProprietaire(proprietaire)] },
    });
  } catch (e) { if (e instanceof TransitionRefusee) return null; throw e; }
  repo.oublierProgressionIndex?.(ligneId).catch?.(() => {});
  return { cree: nouvelles.length, aVerifier: restantes.length };
}

// Une décision sur une entrée « À vérifier » ou écartée : `fiches` (0, 1 ou 2 références à créer) et la décision écrite dans la ligne, en UNE
// transaction ; la ligne passe enregistre quand plus rien n'attend. `cle` : la clé de l'entrée (cleTitre), préfixée « ecartee: » pour une écartée.
export async function decider(ligneId, cle, choix, fiches, { repo = repoModule, maintenant = horloge, resteApres = 0, compte = null, ctx = null } = {}) {
  const proprietaire = await (compte || capturerProprietaire(repo, ctx));
  const quand = maintenant();
  await repo.transitionner('imports', ligneId, {
    attendus: ['a_verifier', 'enregistre'],
    patch: (cur) => {
      const avant = cur.decisions && typeof cur.decisions === 'object' ? cur.decisions : {};
      // Une entrée déjà décidée (double tape, second onglet) ne l'est jamais deux fois : ses fiches seraient créées deux fois.
      if (Object.hasOwn(avant, cle)) throw new TransitionRefusee('imports', ligneId, cur.status);
      return { decisions: { ...avant, [cle]: choix }, ...(cur.status === 'a_verifier' && resteApres === 0 ? { status: 'enregistre', finished_at: quand } : {}) };
    },
    puts: fiches.length ? { recipes: fiches } : undefined,
    conditions: { ...(fiches.length ? { recipes: fiches.map(r => ({ key: r.id, absente: true })) } : {}), sync_state: [conditionProprietaire(proprietaire)] },
  });
}

const RAISONS = () => ({
  contradiction: t('Pages contradictoires dans l’index : choisis.'),
  contradiction_existante: t('Déjà dans le livre à une autre page.'),
  page_inconnue: t('Page illisible ou absente.'),
  incertain: t('Lecture incertaine : vérifie le titre et la page.'),
  modele: t('Lue par un modèle non validé pour les index.'),
});
// Une ligne tapée à la main → { titre, renvois } : les renvois sont le plus long SUFFIXE fait de numéros (« 116–19 », « 34, 112 »), précédé d'un
// séparateur (espace, tiret, virgule, points de conduite) et éventuellement de « p. » ; sinon un numéro en tête (« 212 Pâtes puttanesca ») ; sinon le
// titre seul, sans page (il ira « à vérifier » à la fin du livre). Pure ; 500 lignes au plus, chacune ramenée à UNE ligne.
const SUFFIXE_RENVOIS = /^[\s\u2014\u2013\-,;:.]*(?:(?:pp?|pages?)\.?\s*)?(\d[\d\s,;\u2013\u2014-]*)$/i;
export function lireSaisieIndex(texte) {
  // Chaque ligne bornée à 300 points de code AVANT l'analyse (la recherche du suffixe est quadratique sur une ligne démesurée).
  const lignes = String(texte ?? '').split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/).slice(0, 2000).map((l) => [...l.replace(/\s+/g, ' ').trim()].slice(0, 300).join('').trim())
    .filter(Boolean).slice(0, 500);
  return lignes.map((l) => {
    for (let i = 1; i < l.length; i += 1) {
      const m = SUFFIXE_RENVOIS.exec(l.slice(i));
      if (!m) continue;
      const titre = l.slice(0, i).replace(/[\s\u2014\u2013\-,;:.]+$/, '').trim();
      if (/\p{L}/u.test(titre)) return { titre, renvois: m[1].trim() };
    }
    const tete = /^(\d{1,4})\s+(\D.*)$/.exec(l);
    if (tete) return { titre: tete[2].trim(), renvois: tete[1] };
    return { titre: l, renvois: '' };
  });
}

// La saisie à la main d'une table (filet : un PDF, une page que l'assistant ne lit pas, ou la fiche du livre) : chaque ligne devient une référence du livre,
// sauf celles déjà dans le livre (même titre et mêmes pages). Écrit par repo.saveBatch, en UNE fois ; `apres` est appelé après l'écriture.
export function saisieIndexManuelle(ed, { repo = repoModule, toast = toastDom, newId = nouvelId, apres = null, ctx = null, compte = null } = {}) {
  const capture = compte || capturerProprietaire(repo, ctx);
  const zone = el('textarea', { rows: 5, placeholder: t('Une recette par ligne : Titre — 116–19'), 'aria-label': t('Recettes à ajouter à la main') });
  const bouton = el('button', { class: 'btn', type: 'button', dataset: { role: 'ajouter-saisie' }, onClick: async () => {
    if (bouton.disabled) return;
    const saisies = lireSaisieIndex(zone.value).filter((s) => s.titre);
    if (!saisies.length) { toast(t('Rien de nouveau à ajouter.')); return; }
    bouton.disabled = true;
    try {
      const pages = [{ page_id: 'saisie', etat: 'lue', sorte_page: 'table', page_imprimee: null, modele: MODELES_INDEX[0],
        entrees: saisies.map((s) => ({ titre: s.titre, renvois: s.renvois, rubrique: null, sorte: 'recette', incertain: false })) }];
      const recettes = (await repo.all('recipes')).filter((r) => r.edition_id === ed.id);
      const c = consolider(pages, { existantes: recettes });
      const fiches = [];
      for (const x of c.certaines) fiches.push(fabriquerReferenceIndex({ ...x, sources: [] }, { edition: ed, newId, plages: x.plages }));
      for (const x of c.aVerifier) {
        if (x.options) { for (const o of x.options) if (!o.existanteId) fiches.push(fabriquerReferenceIndex({ ...x, sources: [] }, { edition: ed, newId, plages: o.plages })); }
        else fiches.push(fabriquerReferenceIndex({ ...x, sources: [] }, { edition: ed, newId, plages: x.plages }));
      }
      if (!fiches.length) { toast(t('Rien de nouveau à ajouter.')); return; }
      const proprietaire = await capture;
      await repo.saveBatch({ recipes: fiches }, { conditions: { recipes: fiches.map(r => ({ key: r.id, absente: true })), sync_state: [conditionProprietaire(proprietaire)] } });
      zone.value = '';
      toast(t('{n} recettes ajoutées', { n: fiches.length }));
      if (typeof apres === 'function') await apres(fiches);
    } catch (e) { logError('index_livre.saisie', { error: e }); toast(t('L’ajout n’a pas pu se faire. Réessaie.')); }
    finally { bouton.disabled = false; }
  } }, t('Ajouter ces recettes'));
  return el('div', { class: 'stack', dataset: { role: 'zone-saisie' } }, zone, el('div', { class: 'row' }, bouton));
}

const sourcesTexte = (sources) => liste(sources).map((s) => [s.rubrique, Number.isInteger(s.page_imprimee) ? t('index p. {p}', { p: s.page_imprimee }) : null].filter(Boolean).join(', ')).filter(Boolean).join(' ; ');

// Le panneau. `getPageIds()` : les pages à lire (toutes les pages d'une séance d'index, sinon la sélection). `seanceIndex` : la séance est un index.
export function panneauIndex(session, ctx, getPageIds, {
  seanceIndex = false, repo = repoModule, toast = toastDom, confirmer = confirmDialog, fetch: fetchInjecte = undefined, maintenant = horloge,
  battementMs = BATTEMENT_MS, enLigne = estEnLigne, newId = nouvelId, executant = null, connecter = null, ajouterPage = null,
} = {}) {
  const compte = capturerProprietaire(repo, ctx);
  const racine = el('section', { class: 'card stack', dataset: { role: 'panneau-index' } });
  const etat = { progression: null, occupe: false, abandon: null, seq: 0 };
  const lecture = () => lectureDeSeance(ctx.imports, session.id, session.page_ids);
  const relireImports = async () => { ctx.imports = await repo.all('imports'); ctx.recipes = await repo.all('recipes'); };
  const edition = () => (session.edition_id ? ctx.editionsById?.get(session.edition_id) ?? null : null);
  const pagesPositions = () => new Map(liste(session.page_ids).map((id, i) => [id, ctx.pagesById?.get(id)?.position ?? i + 1]));

  async function lire(pageIds, { importId = null } = {}) {
    if (etat.occupe || !pageIds.length) return;
    etat.occupe = true; etat.abandon = new AbortController(); etat.progression = { page: 0, total: pageIds.length };
    const L = importId ? await repo.get('imports', importId) : null;
    const exec = executant || executantIndexParPage({ onPage: (p) => { etat.progression = p; dessiner(); } });
    try {
      const r = await lancerVol(importId, exec, { ctx, repo, fetch: fetchInjecte, maintenant, battementMs, enLigne, signal: etat.abandon.signal,
        lecture: { kind: 'index', importId, pageIds, editionId: session.edition_id ?? null, sessionId: session.id, cle: L ? cleLecture(L) : null } });
      if (r.issue === 'refuse') toast(texteRefus(r));
      await relireImports();
      const id = r.importId ?? importId;
      if (r.issue === 'a_verifier' && id) { await enregistrerAuto(id, { ctx, session, repo, maintenant, newId, compte }); await relireImports(); }
    } catch (e) { logError('index_livre.lire', { error: e }); }
    finally { etat.occupe = false; etat.abandon = null; etat.progression = null; await dessiner(); }
  }

  async function dessiner() {
    const seq = ++etat.seq;
    const pageIds = liste(getPageIds());
    const lu = lecture();
    // Une ligne a_verifier pas encore enregistrée (app fermée entre la réponse et l'enregistrement, autre onglet) : l'enregistrement se fait au rendu.
    const enAttente = lu.lignes.find((L) => L.status === 'a_verifier' && !L.auto_enregistre_at);
    if (enAttente && !etat.occupe && edition()) {
      try { const fait = await enregistrerAuto(enAttente.id, { ctx, session, repo, maintenant, newId, compte }); if (fait) { await relireImports(); return dessiner(); } }
      catch (e) { logError('index_livre.enregistrer', { error: e, id: enAttente.id }); }
    }
    if (seq !== etat.seq) return;
    const vol = volEnCours();
    const ligneVol = vol && lu.lignes.some((L) => L.id === vol.importId) ? vol.importId : null;
    const echec = lu.lignes.filter((L) => L.status === 'echec' && importOuvert(L)).at(-1) ?? null;
    const parPage = new Map(lu.pages.map((p) => [p.page_id, p]));
    const nonLues = pageIds.filter((id) => !parPage.has(id));
    const incompletes = pageIds.filter((id) => ['partielle', 'echec'].includes(parPage.get(id)?.etat));
    const ed = edition();
    const livre = ed ? ctx.booksById?.get(ed.book_id) : null;
    const contenu = [];
    contenu.push(el('h2', null, seanceIndex ? (livre?.title ? t('Index de {t}', { t: livre.title }) : t('Index du livre')) : t('Index / table des matières')));
    contenu.push(el('p', { class: 'muted', dataset: { role: 'compte-pages' } }, seanceIndex ? (pageIds.length === 1 ? t('1 page d’index') : t('{n} pages d’index', { n: pageIds.length })) : t('{n} page(s) sélectionnée(s)', { n: pageIds.length })));
    // B04 (D-I14) : l'état de la LECTURE, séparé de la phrase des photos de la séance (« Photos : k/n sauvegardées sur le serveur »). En vol, la ligne de
    // progression le dit (« Lecture de la page {i} sur {n}… »).
    if (!ligneVol && !etat.occupe) {
      const lues = lu.pages.filter((p) => pageIds.includes(p.page_id));
      const fin = lu.lignes.filter((L) => L.status === 'a_verifier' || L.status === 'enregistre').map((L) => L.finished_at || L.updated_at).filter(Boolean).sort().at(-1);
      const texte = !lues.length ? t('Lecture : à faire')
        : incompletes.length ? (incompletes.length === 1 ? t('Lecture : 1 page à relire') : t('Lecture : {m} pages à relire', { m: incompletes.length }))
          : nonLues.length ? (nonLues.length === 1 ? t('Lecture : 1 page à lire') : t('Lecture : {m} pages à lire', { m: nonLues.length }))
            : fin ? t('Lecture : faite le {d}', { d: formatDate(fin) }) : t('Lecture : faite');
      contenu.push(el('p', { class: 'muted', dataset: { role: 'etat-lecture' } }, texte));
    }
    if (lu.pages.length) contenu.push(el('p', { class: 'muted', dataset: { role: 'pages-lues' } }, pageIds.map((id) => {
      const p = parPage.get(id); const pos = pagesPositions().get(id);
      const nom = Number.isInteger(p?.page_imprimee) ? t('p. {p}', { p: p.page_imprimee }) : t('photo {n}', { n: pos ?? '?' });
      return `${nom} ${!p ? t('à lire') : p.etat === 'lue' ? '✓' : p.etat === 'partielle' ? t('incomplète') : t('échec')}`;
    }).join(' · ')));
    if (!ed) contenu.push(el('p', { class: 'status warn', dataset: { role: 'sans-livre' } }, t('Associe cette séance à un livre : les recettes lues y seront ajoutées.')));
    const session_ = await sessionAssistant(ctx);
    if (seq !== etat.seq) return;
    if (ligneVol || etat.occupe) {
      const pr = etat.progression;
      contenu.push(el('p', { class: 'status', role: 'status', dataset: { role: 'progression' } }, pr && pr.page ? t('Lecture de la page {i} sur {n}…', { i: pr.page, n: pr.total }) : t('Lecture de l’index par l’assistant…')),
        el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onClick: async () => { etat.abandon?.abort(); if (ligneVol) await annulerVol(ligneVol); } }, t('Annuler'))));
    } else {
      if (!session_) contenu.push(carteConnexion(connecter, ctx));
      const gestes = el('div', { class: 'row' });
      const bouton = (texte, ids, opts = {}) => el('button', { class: opts.primaire ? 'btn primary' : 'btn', type: 'button', disabled: !session_ || !enLigne() || !ed, dataset: { role: opts.role || 'lire' }, onClick: () => lire(ids, opts) }, texte);
      if (echec) {
        const { texte } = texteEchecIndex(echec.erreur);
        contenu.push(el('p', { class: 'status warn', dataset: { role: 'echec' } }, texte));
        const reste = liste(echec.page_ids).filter((id) => pageIds.includes(id));
        gestes.append(bouton(reste.length === 1 ? t('Reprendre la lecture (1 appel au plus)') : t('Reprendre la lecture ({n} appels au plus)', { n: reste.length }), reste, { primaire: true, importId: echec.id, role: 'reprendre' }));
      } else if (nonLues.length) {
        const toutes = nonLues.length === pageIds.length;
        const texte = nonLues.length === 1 ? (toutes ? t('Lire la page (1 appel)') : t('Lire la page non lue (1 appel)'))
          : (toutes ? t('Lire les {n} pages ({n} appels)', { n: nonLues.length }) : t('Lire les {n} pages non lues ({n} appels)', { n: nonLues.length }));
        gestes.append(bouton(texte, nonLues, { primaire: true }));
      }
      if (!echec && incompletes.length) gestes.append(bouton(incompletes.length === 1 ? t('Relire la page incomplète (1 appel)') : t('Relire les {n} pages incomplètes ({n} appels)', { n: incompletes.length }), incompletes, { role: 'relire' }));
      if (seanceIndex && typeof ajouterPage === 'function') gestes.append(el('button', { class: 'btn', type: 'button', dataset: { role: 'ajouter-page' }, onClick: () => ajouterPage() }, t('Ajouter une page d’index')));
      if (gestes.querySelector('[data-role="lire"], [data-role="reprendre"], [data-role="relire"]')) {
        contenu.push(gestes, el('p', { class: 'muted' }, t('Une page trop dense est relue en deux moitiés : jusqu’à 2 appels de plus pour cette page. Chaque appel compte dans ton quota du jour.')));
      } else if (gestes.childElementCount) contenu.push(gestes);
    }
    if (lu.pages.length && ed) contenu.push(await resultat(lu, ed));
    if (seq !== etat.seq) return;
    contenu.push(saisieManuelle(ed));
    racine.replaceChildren(...contenu.filter(Boolean));
  }

  async function resultat(lu, ed) {
    const recettes = liste(ctx.recipes).filter((r) => r.edition_id === ed.id);
    const c = consolider(lu.pages, { existantes: recettes, modeleValide: lu.modeleValide });
    const ids = new Set(lu.lignes.map((L) => L.id));
    const ajoutees = recettes.filter((r) => ids.has(r.index_import_id));
    const restantes = c.aVerifier.filter((x) => !lu.decisions[x.cle]);
    const ecartees = c.ecartees.filter((x) => !lu.decisions[`ecartee:${cleTitre(x.titre)}`]);
    const ligneDecision = lu.lignes.filter((L) => L.status === 'a_verifier' || L.status === 'enregistre').at(-1);
    const bloc = el('div', { class: 'stack', dataset: { role: 'resultat-index' } });
    bloc.append(el('p', { class: 'status ok', dataset: { role: 'bilan' } }, t('{n} recettes dans le livre · {m} à vérifier · {k} écartées', { n: ajoutees.length, m: restantes.length, k: ecartees.length })));
    if (!lu.modeleValide) bloc.append(el('p', { class: 'status warn' }, t('Une page a été lue par un modèle non validé pour les index : rien n’a été ajouté d’office.')));
    if (c.chapitres.length) bloc.append(el('p', { class: 'status warn', dataset: { role: 'chapitres' } }, t('Cette page ne liste que des chapitres : photographie l’index ou la table détaillée pour retrouver les recettes.')));
    if (ed) bloc.append(el('a', { class: 'btn link', href: `#/books/${encodeURIComponent(ed.id)}` }, t('Voir les recettes du livre')));
    if (restantes.length && ligneDecision) {
      const raisons = RAISONS();
      const ul = el('ul', { class: 'list plain', dataset: { role: 'a-verifier' } });
      for (const x of restantes) {
        const li = el('li', { class: 'stack', dataset: { cle: x.cle } }, el('strong', null, x.titre), el('span', { class: 'muted' }, raisons[x.raison] || ''));
        const row = el('div', { class: 'row' });
        const creer = (plages) => fabriquerReferenceIndex(x, { edition: ed, newId, importId: ligneDecision.id, plages });
        const geste = (texte, choix, fiches) => el('button', { class: 'btn small', type: 'button', onClick: async (ev) => {
          if (ev.currentTarget.disabled) return;
          for (const b of row.querySelectorAll('button')) b.disabled = true; // une décision à la fois, jamais deux fiches pour une tape doublée
          try { await decider(ligneDecision.id, x.cle, choix, fiches(), { repo, maintenant, resteApres: restantes.length - 1, compte }); }
          catch (e) { if (!(e instanceof TransitionRefusee)) { logError('index_livre.decider', { error: e }); toast(t('La décision n’a pas pu être enregistrée. Réessaie.')); } }
          await relireImports(); await dessiner();
        } }, texte);
        if (x.options) {
          for (const o of x.options) {
            li.append(el('span', { class: 'muted' }, `${textePlages(o.plages)} · ${o.existanteId ? t('déjà dans le livre') : sourcesTexte(o.sources)}`));
            if (!o.existanteId) row.append(geste(t('Garder {p}', { p: textePlages(o.plages) }), `garder:${textePlages(o.plages)}`, () => [creer(o.plages)]));
          }
          if (x.raison === 'contradiction') row.append(geste(t('Les deux'), 'les_deux', () => x.options.filter((o) => !o.existanteId).map((o) => creer(o.plages))));
        } else {
          li.append(el('span', { class: 'muted' }, `${x.plages.length ? textePlages(x.plages) : t('page inconnue')} · ${sourcesTexte(x.sources)}`));
          row.append(geste(t('Ajouter au livre'), 'ajoutee', () => [creer(x.plages)]));
        }
        row.append(geste(t('Écarter'), 'ecartee', () => []));
        li.append(row); ul.append(li);
      }
      bloc.append(el('h3', null, t('À vérifier')), ul);
    }
    if (ecartees.length && ligneDecision) {
      const d = el('details', { dataset: { role: 'ecartees' } }, el('summary', null, t('Écartées ({n})', { n: ecartees.length })));
      for (const x of ecartees) {
        d.append(el('div', { class: 'row' }, el('span', null, `${x.titre} · ${x.renvois}`), el('button', { class: 'btn small', type: 'button', onClick: async (ev) => {
          if (ev.currentTarget.disabled) return;
          ev.currentTarget.disabled = true;
          const { plages } = renvoisDe(x.renvois);
          const fiche = fabriquerReferenceIndex({ titre: x.titre, renvois: x.renvois, rubriques: x.rubrique ? [x.rubrique] : [], section: null, sources: [{ page_id: x.page_id, page_imprimee: x.page_imprimee, rubrique: x.rubrique }] }, { edition: ed, newId, importId: ligneDecision.id, plages });
          try { await decider(ligneDecision.id, `ecartee:${cleTitre(x.titre)}`, 'recette', [fiche], { repo, maintenant, resteApres: restantes.length, compte }); }
          catch (e) { if (!(e instanceof TransitionRefusee)) { logError('index_livre.ecartee', { error: e }); toast(t('La décision n’a pas pu être enregistrée. Réessaie.')); } }
          await relireImports(); await dessiner();
        } }, t('C’est une recette'))));
      }
      bloc.append(d);
    }
    const intactes = ajoutees.filter((r) => referenceIntacte(r, r.index_import_id));
    if (intactes.length) {
      bloc.append(el('button', { class: 'btn link', type: 'button', dataset: { role: 'retirer' }, onClick: async () => {
        if (!(await confirmer(t('Retirer ces {n} recettes ajoutées par la lecture ? Celles que tu as modifiées restent.', { n: intactes.length }), { okLabel: t('Retirer') }))) return;
        const actuelles = (await repo.all('recipes')).filter((r) => intactes.some((x) => x.id === r.id) && referenceIntacte(r, r.index_import_id));
        try { await repo.removeBatch({ recipes: actuelles.map((r) => r.id) }); await relireImports(); toast(t('{n} recettes retirées', { n: actuelles.length })); await dessiner(); }
        catch (e) { logError('index_livre.retirer', { error: e }); toast(t('Le retrait n’a pas pu se faire. Réessaie.')); }
      } }, t('Retirer ces {n} recettes', { n: intactes.length })));
    }
    return bloc;
  }

  function saisieManuelle(ed) {
    return el('details', { dataset: { role: 'saisie-manuelle' } }, el('summary', null, t('Saisir à la main')),
      ed ? saisieIndexManuelle(ed, { repo, toast, newId, ctx, compte, apres: async () => { await relireImports(); await dessiner(); } }) : null);
  }

  // Abonnements pris au montage, rendus au démontage : le bus (une autre écriture : synchronisation, autre onglet) et le vol du document.
  const offs = [];
  const redessinerSiMonte = async () => { if (!racine.isConnected) { offs.splice(0).forEach((f) => f()); return; } await relireImports(); await dessiner(); };
  const observer = new MutationObserver(() => { if (racine.isConnected && !offs.length) { offs.push(on('change', (d) => { if (['imports', 'recipes'].includes(d?.store)) redessinerSiMonte(); }), ecouterVol(() => { if (!etat.occupe) redessinerSiMonte(); })); observer.disconnect(); } });
  observer.observe(document, { childList: true, subtree: true });
  setTimeout(() => { if (!offs.length) observer.disconnect(); }, 30000); // un panneau jamais monté ne garde pas l'observateur du document
  racine.dessiner = dessiner;
  racine.etatPanneau = () => ({ ...etat, abandon: !!etat.abandon });
  dessiner();
  return racine;
}
