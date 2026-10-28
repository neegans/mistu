// Recherche universelle et accompagnements (spec §4, §26) : source active visible, pastilles modifiables, groupes distincts.
import { el, toast as toastDom } from '../core/dom.js';
import { t, label, getUiLocale } from '../core/i18n.js';
import { navigate, buildQuery, remplacerAdresse, currentPath } from '../core/router.js';
import { borner } from '../core/bornes.js';
import { lienSignet } from '../core/lien.js';
import { logError } from '../core/log.js';
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';
import { parseQuery, searchDocs, chipsFor } from '../domain/search.js';
import { findAccompaniments } from '../domain/pairing.js';
import { providerFrom } from '../domain/llm.js';
import { chercherRecettesWeb, construireDemande, dateLisible, reperesDe } from '../domain/recherche-web.js';
import { lireApercusWeb, LIMITES_APERCU_WEB } from '../domain/apercu-web.js';
import { RECIPE_TYPES, DIET_TAGS } from '../model/schema.js';
import { COVER_INPUT_MIME } from '../sync/mime.js';
import { recipeCard, filterChips, libellePuce, segmented, emptyState, section, availabilityBadge, provenanceText, select, sessionAssistant, carteConnexion, texteRefusAssistant, ligneReperes, remplacerEnRevoquant } from './components.js';
import { demarrerLectureWeb } from './import-web.js';
import { addToMealFlow } from './meals.js';
import { demarrerConnexion } from './settings.js';

const MODES = [['recipes', 'Mes recettes'], ['books', 'Mes livres'], ['web', 'Web'], ['all', 'Tout']];

// --- Recherche web : état AU NIVEAU DU MODULE (spec Web § 5.1). run() navigue en `replace`, donc chaque Entrée,
// changement de mode ou de case ré-instancie la route : un état d'instance ne survit pas (la tape web, elle, ne fait que
// remplacer l'adresse sans re-rendu — R-WEB-9 ; ce qu'elle garde du champ : R-WEB-10). Ici vivent la dernière issue
// (mémoire VIVE, jamais en base — I-G), sous la clé exacte de la demande qui l'a produite, et l'UNIQUE appel en vol de
// l'app (I-I). Les instances sont des vues : elles s'abonnent, et sont oubliées dès que leur racine quitte le document.
let memoire = null; // { cle, issue, q, filtres }
let vol = null;     // { cle, controller, promesse }
const vues = new Set(); // { root, redessiner }
export function etatWeb() { return { cle: vol?.cle ?? null, enCours: !!vol, memoire: memoire ? { cle: memoire.cle, etat: memoire.issue.etat } : null }; }
// Lot UI-2 (D-UI-12, § 4.6) : les aperçus des résultats, mémoire VIVE par ADRESSE à côté de `memoire` — `href` du lien → { blob, type } (l'image contrôlée par
// le mur de F, Blob typé dans la liste des couvertures) ou { raison } (échec PAR ADRESSE mémorisé : une adresse sans image n'est pas redemandée). La Map SURVIT
// à une nouvelle issue (elle est indexée par href, pas par demande) : après chaque « trouvé » reçu, les entrées dont le href a quitté ses liens sont lâchées,
// Blob compris ; reinitialiserWeb() seule la vide entière. L'UNIQUE vol d'aperçus de l'app : posé par une vue CONNECTÉE qui rend un « trouvé » aux adresses
// encore absentes (ou au montage d'une vue rendue détachée, R-UI2-7), jamais pendant une recherche en vol (revue finale) ; abandonné par lancer(),
// « Annuler », reinitialiserWeb() et quand plus aucune vue n'est connectée ET que la route a quitté /search (un observateur du document, le temps du
// vol ; ronde 1 : app.js remplace l'écran par « Chargement… » AVANT de
// rendre la nouvelle instance de /search — run(), cuisineos:refresh —, et cette instance ADOPTE le vol au lieu d'en payer un second) ; un vol abandonné est
// MUET (rien d'écrit : ses adresses restent absentes et se redemandent au prochain « trouvé » rendu connecté). R-UI2-6 : un échec de l'appel ENTIER (reseau,
// serveur, interne, delai, quota, un annule arrivé sans abandon) n'apprend
// rien sur les adresses — il n'entre pas dans la Map ; il est mémorisé pour l'ISSUE courante (`echecApercus`), lu par la ligne d'état : un redessin de la même
// issue ne redemande rien, une nouvelle issue (tape, « Chercher à nouveau ») redemande les adresses absentes. Les URL blob: sont recréées à chaque rendu depuis
// les Blob et révoquées par remplacerEnRevoquant (img.plat-vignette) et au changement de route (app.js).
const apercus = new Map();
let volApercus = null; // { controller, promesse, hrefs, garde }
let echecApercus = null; // { issue, raison } — l'échec de l'appel entier, pour l'issue qui l'a demandé (R-UI2-6)
const montages = new Set(); // les observateurs de montage des vues rendues détachées (R-UI2-7), retirés au montage, à la purge ou par reinitialiserWeb()
export function etatApercus() { return { hrefs: [...apercus.keys()], blobs: [...apercus.values()].filter((a) => a.blob instanceof Blob).length, enVol: volApercus ? [...volApercus.hrefs] : null }; } // tests seulement
function abandonnerApercus() { if (!volApercus) return; volApercus.garde.disconnect(); volApercus.controller.abort(); volApercus = null; }
function elaguerApercus(issue) {
  const gardes = new Set((Array.isArray(issue?.liens) ? issue.liens : []).map((l) => l?.href));
  for (const href of [...apercus.keys()]) if (!gardes.has(href)) apercus.delete(href);
}
export function reinitialiserWeb() { vol?.controller.abort(); vol = null; memoire = null; vues.clear(); abandonnerApercus(); apercus.clear(); echecApercus = null; for (const m of montages) m.disconnect(); montages.clear(); } // tests seulement
function notifier() { for (const v of [...vues]) { if (!v.root.isConnected) { vues.delete(v); continue; } v.redessiner(); } }
const ISSUE_INTERNE = Object.freeze({ etat: 'indisponible', raison: 'interne', liens: Object.freeze([]), autres: Object.freeze([]), repli: false, recherches: null, modele: null }); // rangée telle quelle dans `memoire`
// § 5.6 : textes des raisons connues (lus par Object.hasOwn : une raison « constructor » ou « toString » n'est pas connue). Les refus de la
// passerelle (non_admis, quota, trop lourd) ont leur texte dans components.js (texteRefusAssistant, R-T4-4) ; non_connecte (la session a
// disparu pendant le vol) a sa carte « Connecte-toi » : ni l'un ni l'autre n'offre « Réessayer » — la même demande échouerait pareil.
const TEXTES_INDISPONIBLE = {
  hors_ligne: 'Tu es hors ligne.',
  trop_de_demandes: 'Trop de demandes pour l’instant. Réessaie dans une minute.',
  refus: 'L’assistant a refusé cette demande.',
  pas_cherche: 'L’assistant n’a pas cherché sur le web. Réessaie.',
};
const SANS_REESSAI = ['refus', 'non_admis', 'quota'];
// R-WEB-10 (corrige R-WEB-9, amende § 5.4.1) : à la TAPE, un champ changé est relu ; ne survivent que les puces que les
// LISTES « + type » / « + restriction » ont ajoutées = affichées MOINS ce que l'analyse de l'ancien texte avait donné
// (régimes, et le type si le nouveau texte n'en dit pas). Une puce retirée à la main n'est plus affichée : elle ne revient
// pas. Exclusions, ingrédients et durées viennent du NOUVEAU texte seul : une demande neuve n'hérite pas des contraintes
// de l'ancienne. Ainsi « Entrée puis tape » et « tape seule » envoient la même demande quand aucune liste n'a servi.
// Entrée, changement de mode ou de case (run(), préexistant) réanalysent le champ sans rien garder.
function garderAjoutsDesListes(affiches, ancienTexte, analyse) {
  const f = analyse.filters;
  const duTexte = Array.isArray(ancienTexte?.diets) ? ancienTexte.diets : [];
  const ajouts = (Array.isArray(affiches?.diets) ? affiches.diets : []).filter((d) => !duTexte.includes(d));
  f.diets = [...new Set([...f.diets, ...ajouts])];
  if (f.type == null && affiches?.type && affiches.type !== ancienTexte?.type) f.type = affiches.type;
  f.include = f.include.filter((id) => !f.exclude.includes(id)); // même règle que parseQuery
  return analyse;
}

// « Garder et lire » (lot B, D-B5 b, § 4.1 b) : le signet SANS formulaire — l'adresse et le titre du résultat (ceux que « Garder ce lien » préremplit),
// les repères de la carte revalidés — et l'import, en UNE transaction, puis la lecture. Une adresse déjà gardée ne réécrit rien (D-B7). Ronde 1 : UNE
// porte — l'adresse (lisible, en https), le titre (borné, l'hôte à défaut) et le doublon sont vérifiés par demarrerLectureWeb seule, à qui cette
// fonction délègue. `deps` : les gestes de demarrerLectureWeb (repo, fetch, maintenant, enLigne). Rend son issue (ok, doublon ou refuse).
export async function garderEtLire(lien, { ctx, ...deps } = {}) {
  return demarrerLectureWeb({ adresse: lien?.href, titre: lien?.titre, reperes: reperesDe(lien), ctx }, deps);
}

export async function renderSearch(params, query, ctx, deps = {}) {
  const root = el('div', null);
  // UI-2 (F-10) : deps.apercus vaut lireApercusWeb par défaut, et null quand deps.chercher est injecté sans deps.apercus — les tests de route des lots web et B,
  // qui comptent leurs appels réseau, ne demandent aucun aperçu (P-UI2-11).
  // deps.routeCourante (ronde 1) : la route lue par la garde du vol d'aperçus quand la dernière vue se déconnecte (par défaut celle du routeur ; injectée par les tests).
  const { chercher = chercherRecettesWeb, apercus: apercusFn = (deps.chercher === undefined ? lireApercusWeb : null), enLigne, navigate: nav = navigate, remplacerAdresse: remplacer = remplacerAdresse, routeCourante = currentPath, toast = toastDom, lecture = {} } = deps;
  const state = { q: query.q || '', mode: query.mode || 'all', favorites: query.fav === '1', cooked: query.cooked === '1', requireAll: query.any !== '1', parsed: parseQuery(query.q || '') };
  // La session de l'assistant (R-T3-1) : lue ICI pour les gardes de l'écran, relue à chaque appel (un jeton expiré se rafraîchit).
  // Attendue en mode web SEULEMENT : jeton() peut rafraîchir le jeton par le réseau, et les autres modes de recherche n'en ont pas
  // besoin. Quand la personne bascule vers « Web » dans cette MÊME instance (run() → render(), sans ré-instanciation), elle est lue avant
  // de rendre (R-T4-10) : une personne connectée ne voit jamais « Connecte-toi » en flash.
  let session = state.mode === 'web' ? await sessionAssistant(ctx) : null;
  let sessionLue = state.mode === 'web';
  const connecter = () => demarrerConnexion(ctx.sync?.auth);
  const forRecipe = query.for ? ctx.docsByRecipe.get(query.for) : null; // Avec quoi on mange ça ?
  const role = query.role || (forRecipe ? 'salade' : null);
  if (forRecipe && role) state.parsed.filters.type = role;

  const input = el('input', { type: 'search', value: state.q, placeholder: forRecipe ? t('Préciser : concombre, sans gluten, 15 minutes…') : t('Ex. : une salade avec du concombre, sans gluten, en quinze minutes'), enterkeyhint: 'search' });
  // L'adresse de la recherche n'a qu'UNE définition : run() (Entrée, mode, cases) et lancer() (la tape web) la rejouent
  // en replace par le `navigate` injecté (par défaut celui du routeur).
  const requeteRoute = () => '/search' + buildQuery({ q: state.q, mode: state.mode, fav: state.favorites ? 1 : '', cooked: state.cooked ? 1 : '', any: state.requireAll ? '' : 1, for: query.for || '', role: role || '' });
  const run = async () => {
    state.q = input.value.trim(); state.parsed = parseQuery(state.q); if (forRecipe && role) state.parsed.filters.type = role;
    nav(requeteRoute(), { replace: true });
    if (state.mode === 'web' && !sessionLue) { sessionLue = true; session = await sessionAssistant(ctx); } // R-T4-10 ; sessionAssistant ne lève jamais
    render();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  input.addEventListener('input', () => {
    const vide = !borner(input.value, 500).trim(); // même règle que construireDemande
    const b = root.querySelector('[data-role="chercher-web"]'); if (b) b.disabled = vide;
    const aide = root.querySelector('[data-role="aide-web"]'); if (aide) aide.hidden = !vide;
  });

  const results = el('div', null);
  const header = el('div', { class: 'card sage stack' },
    forRecipe ? el('div', { class: 'card flat' },
      el('div', { class: 'muted', style: { fontSize: '.8rem' } }, t('Avec quoi on mange ça ?')),
      el('div', { class: 'row between' }, el('strong', null, forRecipe.recipe.display_title || forRecipe.recipe.original_title), el('a', { class: 'btn small', href: `#/recipes/${forRecipe.recipe.id}` }, t('Retour au plat'))),
      el('div', { class: 'muted', style: { fontSize: '.85rem' } }, provenanceText(forRecipe.recipe, forRecipe.book, forRecipe.edition)),
      el('div', { class: 'row', style: { marginTop: '.4rem' } }, ...['salade', 'soupe', 'legumes', 'feculent', 'autre'].map((r) => el('a', { class: `btn small ${r === role ? 'active' : ''}`, href: `#/search${buildQuery({ ...query, role: r })}` }, label('recipe_type', r))))) : null,
    el('div', { class: 'search-bar' }, input, el('button', { class: 'btn primary', onClick: run }, t('Chercher'))),
    el('div', { class: 'row between' },
      segmented(MODES.map(([v, l]) => ({ value: v, label: t(l) })), state.mode, (v) => { state.mode = v; run(); }),
      el('div', { class: 'row' },
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: state.favorites, onChange: (e) => { state.favorites = e.target.checked; run(); } }), t('Favoris')),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: state.cooked, onChange: (e) => { state.cooked = e.target.checked; run(); } }), t('Déjà cuisinées')))));
  root.append(header, results);

  function render() {
    affiche = null; // UI-2 (R-UI2-7) : ce que cette vue montre est reposé par renderIssue (un « trouvé »), ou rien
    // Lot F (§ 4.2, D-T9) : les URL des vignettes de la génération précédente, relevées AVANT le vidage, révoquées APRÈS (remplacerEnRevoquant).
    remplacerEnRevoquant(results);
    const { parsed } = state;
    const chips = chipsFor(parsed.filters);
    const removeChip = (c) => {
      const f = parsed.filters;
      if (c.kind === 'type') f.type = null; if (c.kind === 'diet') f.diets = f.diets.filter((x) => x !== c.value);
      if (c.kind === 'include') f.include = f.include.filter((x) => x !== c.value); if (c.kind === 'exclude') f.exclude = f.exclude.filter((x) => x !== c.value);
      if (c.kind === 'exclude_text') f.exclude_text = (f.exclude_text || []).filter((x) => x !== c.value);
      if (c.kind === 'max_total') f.max_total_minutes = null; if (c.kind === 'max_active') f.max_active_minutes = null;
      render();
    };
    const addFilter = el('div', { class: 'row' },
      select([{ value: '', label: t('+ type') }, ...RECIPE_TYPES.map((v) => ({ value: v, label: label('recipe_type', v) }))], '', (v) => { if (v) { parsed.filters.type = v; render(); } }),
      select([{ value: '', label: t('+ restriction') }, ...DIET_TAGS.map((v) => ({ value: v, label: label('diet', v) }))], '', (v) => { if (v && !parsed.filters.diets.includes(v)) { parsed.filters.diets.push(v); render(); } }),
      parsed.filters.include.length > 1 ? el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !state.requireAll, onChange: (e) => { state.requireAll = !e.target.checked; render(); } }), t('au moins un ingrédient')) : null);
    results.append(el('div', { class: 'card flat stack' },
      el('div', { class: 'row between' }, el('span', { class: 'muted' }, `${t('Source active')} : ${t(MODES.find((m) => m[0] === state.mode)[1])}`), addFilter),
      chips.length ? filterChips(chips, ctx.ingredientsById, removeChip) : el('small', { class: 'muted' }, t('Aucun filtre compris : recherche sur les titres, ingrédients et livres.'))));

    if (state.mode === 'web') { results.append(renderWeb()); return; }
    const opts = { mode: state.mode, ingredientsById: ctx.ingredientsById, favoritesOnly: state.favorites, cookedOnly: state.cooked, requireAll: state.requireAll };
    const groups = forRecipe
      ? findAccompaniments({ mainDoc: forRecipe, docs: ctx.docs, type: role, parsed, ingredientsById: ctx.ingredientsById, mode: state.mode, feedback: ctx.meal_feedback })
      : searchDocs(ctx.docs, parsed, opts);
    const card = (hit) => {
      const extra = el('div', { class: 'stack', style: { marginTop: '.4rem' } },
        hit.assessments?.length ? el('div', { class: 'chips' }, ...hit.assessments.map((a) => el('span', { class: `chip ${a.state === 'compatible' ? 'ok' : 'warn'}` }, `${label('diet', a.diet)} — ${label('diet_assessment', a.state)}`))) : null,
        hit.timeState === 'unknown' ? el('span', { class: 'chip neutral' }, t('Durée inconnue')) : null,
        hit.why ? el('div', null, el('div', { class: 'muted', style: { fontSize: '.8rem' } }, t('Pourquoi cet accord ?')), ...hit.why.map((w) => el('div', { style: { fontSize: '.9rem' } }, w.text, ' ', el('span', { class: 'badge' }, w.origin)))) : null,
        forRecipe ? el('button', { class: 'btn small sage', onClick: (e) => { e.preventDefault(); e.stopPropagation(); addToMealFlow(ctx, hit.doc, { role: role === 'soupe' ? 'entree' : 'accompagnement', mainDoc: forRecipe, mealId: query.meal || null }); } }, t('Ajouter à mon repas')) : null);
      return recipeCard(hit.doc, { extra, reasons: hit.reasons });
    };
    const total = groups.admissible.length + groups.to_verify.length + groups.adaptation.length + groups.time_unknown.length;
    if (groups.admissible.length) results.append(section(forRecipe ? t('Propositions') : t('Recettes admissibles'), ...groups.admissible.slice(0, forRecipe ? 3 : 50).map(card),
      forRecipe && groups.admissible.length > 3 ? el('details', null, el('summary', { class: 'btn' }, t('Voir toutes les propositions ({n})', { n: groups.admissible.length })), ...groups.admissible.slice(3).map(card)) : null));
    if (groups.time_unknown.length) results.append(section(t('Durée inconnue — à vérifier'), ...groups.time_unknown.map(card)));
    if (groups.to_verify.length) results.append(section(t('À vérifier (ingrédients inconnus pour la restriction)'), ...groups.to_verify.map(card)));
    if (groups.adaptation.length) results.append(section(t('Adaptation nécessaire (ingrédient facultatif à retirer)'), ...groups.adaptation.map(card)));
    if (groups.references.length && state.mode !== 'recipes') results.append(section(t('Repérées dans tes livres — recettes incomplètes'),
      el('p', { class: 'muted' }, t('Références d’index : ingrédients, durées et compatibilités inconnus tant que la recette n’est pas scannée.')),
      ...groups.references.slice(0, 30).map((h) => recipeCard(h.doc, { reasons: h.reasons }))));
    if (!total && !groups.references.length) {
      const opts = [];
      if (parsed.filters.max_total_minutes) opts.push(el('button', { class: 'btn', onClick: () => { parsed.filters.max_total_minutes += 15; render(); } }, t('Allonger à {n} min', { n: parsed.filters.max_total_minutes + 15 })));
      if (parsed.filters.type) opts.push(el('button', { class: 'btn', onClick: () => { parsed.filters.type = null; render(); } }, t('Tout type de recette')));
      if (state.mode === 'recipes') opts.push(el('button', { class: 'btn', onClick: () => { state.mode = 'all'; run(); } }, t('Inclure les références de mes livres')));
      opts.push(el('a', { class: 'btn', href: '#/add' }, t('Scanner une recette')));
      results.append(emptyState('loupe', t('Aucune recette admissible.') + (groups.incompatible ? ` ${t('{n} écartée(s) par une restriction alimentaire — jamais assouplie.', { n: groups.incompatible })}` : '') + (groups.excluded_by_time ? ` ${t('{n} écartée(s) par la durée.', { n: groups.excluded_by_time })}` : ''),
        el('div', { class: 'row', style: { justifyContent: 'center' } }, ...opts)));
    } else if (groups.incompatible || groups.excluded_by_time) {
      results.append(el('p', { class: 'muted' }, [groups.incompatible ? t('{n} recette(s) écartée(s) par une restriction alimentaire.', { n: groups.incompatible }) : '', groups.excluded_by_time ? t('{n} écartée(s) par la durée.', { n: groups.excluded_by_time }) : ''].filter(Boolean).join(' ')));
    }
  }
  // --- Recherche web (spec Web § 5)
  const textesDesPuces = () => chipsFor(state.parsed.filters).map((c) => libellePuce(c, ctx.ingredientsById));
  const demandeCourante = () => construireDemande({ q: state.q, filtres: textesDesPuces(), langue: getUiLocale() });
  // La relecture du champ (§ 5.4, R-WEB-10), seule : la tape (lancer) et la porte « Créer une recette avec ces critères » s'en servent,
  // pour que ce qui part — ou ce qui est porté à l'écran de création — soit ce qui est AFFICHÉ, y compris un champ tapé sans Entrée.
  const relireChamp = () => {
    const champ = input.value.trim();
    if (champ !== state.q) { const affiches = state.parsed.filters; const ancienTexte = parseQuery(state.q).filters; state.q = champ; state.parsed = garderAjoutsDesListes(affiches, ancienTexte, parseQuery(champ)); if (forRecipe && role) state.parsed.filters.type = role; }
  };
  // § 5.4 : le champ est RELU s'il a changé depuis la dernière analyse (I-J) — s'il n'a pas changé, les puces ajoutées
  // par les listes « + type » / « + restriction » ou retirées à la main RESTENT ce qu'elles sont à l'écran (R-WEB-2 : une
  // relecture inconditionnelle les écrasait) ; s'il a changé, il est relu et seules les puces de LISTE survivent
  // (R-WEB-10 : la frappe sans Entrée effaçait la restriction choisie, R-WEB-9 portait aussi celles de l'ancien texte).
  // Puis le vol précédent est abandonné (I-I), le nouveau posé au module, et l'adresse mise à jour SANS re-rendu
  // (remplacerAdresse, aucun hashchange) : l'instance courante garde ses puces et son vol — une ré-instanciation
  // repartirait de l'adresse, qui ne porte pas les puces des listes, et perdrait le vol (autre clé). « Réessayer » passe
  // { enLigne: () => true }.
  const lancer = (depsForces = {}) => {
    relireChamp();
    const demande = demandeCourante();
    if (!demande.cle) { render(); return; }
    vol?.controller.abort();
    abandonnerApercus(); // UI-2 : une nouvelle recherche rend le vol d'aperçus caduc (ses liens changent)
    const controller = new AbortController();
    const cle = demande.cle; const q = demande.q; const filtres = demande.filtres; // nettoyés : ce qui part (R-WEB-1)
    const promesse = Promise.resolve()
      .then(async () => chercher({ q, filtres, langue: getUiLocale(), session: await sessionAssistant(ctx) }, { enLigne, signal: controller.signal, ...depsForces }))
      .catch(() => ISSUE_INTERNE)
      .then((issue) => {
        if (vol?.promesse !== promesse) return;           // abandonné ou remplacé : muet
        vol = null;
        if (issue?.raison !== 'annule') { memoire = { cle, issue: issue && typeof issue === 'object' ? issue : ISSUE_INTERNE, q, filtres }; if (memoire.issue.etat === 'trouve') elaguerApercus(memoire.issue); } // UI-2 (K-1) : les entrées des liens disparus sont lâchées à chaque « trouvé » reçu
        notifier();
      });
    vol = { cle, controller, promesse };
    remplacer(requeteRoute());
    render();
  };
  const annuler = () => { vol?.controller.abort(); vol = null; abandonnerApercus(); render(); }; // UI-2 : le vol d'aperçus aussi (S-4)
  // La porte vers #/recipes/creer (création sur critères, spec de création § 3.1) : elle ne lance AUCUNE recherche web et ne touche pas
  // au vol. L'adresse porte les puces AFFICHÉES (R-WEB-10) — texte du champ relu d'abord, puis régimes, type et durée totale ; buildQuery
  // omet les vides et encode. Les exclusions, les ingrédients et la durée active ne passent pas (l'écran de création ne les lit pas).
  const creerDepuisWeb = () => el('button', { type: 'button', class: 'btn', dataset: { role: 'creer-depuis-web' }, onClick: () => {
    relireChamp();
    const f = state.parsed.filters;
    nav('/recipes/creer' + buildQuery({ q: state.q, diets: (f.diets || []).join(',') || '', type: f.type || '', max: f.max_total_minutes || '' }));
  } }, t('Créer une recette avec ces critères'));
  function renderWeb() {
    for (const v of [...vues]) if (!v.root.isConnected) vues.delete(v); // borné en permanence, pas seulement à la résolution d'un vol
    if (![...vues].some((v) => v.root === root)) vues.add({ root, redessiner: render });
    // Sans session : « Connecte-toi… » + « Se connecter », aucun appel (R-T4-4). La passerelle cherche toujours sur le web.
    if (!providerFrom(ctx.settings, { session }).configured) return carteConnexion(connecter, ctx);
    const cle = demandeCourante().cle;
    const boutonChercher = (eteint) => el('button', { class: 'btn primary', dataset: { role: 'chercher-web' }, disabled: eteint, onClick: () => lancer() }, t('Chercher sur le web avec l’assistant')); // data-role : rouvert par la frappe (§ 5.3)
    if (vol && vol.cle === cle) {
      return el('div', { class: 'card flat stack' },
        el('div', { class: 'status', role: 'status' }, t('L’assistant cherche sur le web…')),
        // Sans data-role : l'écouteur de frappe ne doit PAS rouvrir ce bouton pendant le vol.
        el('div', { class: 'row' }, el('button', { class: 'btn primary', disabled: true }, t('Chercher sur le web avec l’assistant')), el('button', { class: 'btn', onClick: annuler }, t('Annuler'))));
    }
    // K1 : les liens d'un « trouvé » restent quand la demande change, et la différence est dite. Toute autre issue ne vaut
    // que pour SA demande (R-WEB-7) : une demande changée revient à l'écran du bouton — sinon un refus ou un quota atteint
    // resteraient affichés sans issue après la correction de la demande.
    if (memoire && (memoire.issue.etat === 'trouve' || memoire.cle === cle)) return renderIssue(memoire.issue, { demandeDiffere: memoire.cle !== cle, demandePrete: cle != null });
    const demandeVide = !borner(input.value, 500).trim();
    return el('div', { class: 'card flat stack' },
      boutonChercher(demandeVide),
      el('small', { class: 'muted' }, t('Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.')), // UI-2 (D-UI-13, I-UI-1) : le nombre d'appels, dit AVANT la tape
      el('small', { class: 'muted', dataset: { role: 'aide-web' }, hidden: !demandeVide }, t('Écris d’abord ce que tu cherches.'))); // toujours là : la frappe la montre ou la cache
  }
  // UI-2 (D-UI-13, S-4, S-5) : le vol d'aperçus — demandé par CETTE vue si elle est connectée, pour les adresses encore absentes de la Map (0 appel quand
  // tout est connu : « Chercher à nouveau » ne repaie que les adresses neuves), jamais pendant un autre vol d'aperçus, jamais pendant une RECHERCHE en vol
  // (revue finale : le « trouvé » affiché — K1, après un geste de filtre — va être remplacé ; « Annuler » et la réception remettent `vol` à null avant de
  // redessiner), jamais sans deps.apercus, jamais une
  // seconde fois pour la MÊME issue après un échec de l'appel entier (R-UI2-6). Un abandon (lancer, « Annuler », dernière vue déconnectée, reinitialiserWeb)
  // rend le résultat MUET ; une Map reçue est écrite PAR ADRESSE (une adresse demandée absente de la Map reçue vaut `illisible`) ; un échec de l'appel ENTIER,
  // ou une réponse sans forme, est mémorisé pour l'issue (`echecApercus`), jamais écrit par adresse : jamais une boucle de demandes. Rend vrai quand un vol
  // vient d'être posé.
  let affiche = null; // { issue, hrefs } : le « trouvé » que CETTE vue montre, relu au montage (R-UI2-7)
  const demanderApercus = (hrefs, issue) => {
    const manquants = [...new Set(hrefs.filter((h) => !apercus.has(h)))].slice(0, LIMITES_APERCU_WEB.adresses);
    if (!apercusFn || vol || volApercus || !manquants.length || !root.isConnected) return false;
    if (echecApercus && echecApercus.issue === issue) return false;
    const controller = new AbortController();
    const promesse = Promise.resolve()
      .then(async () => apercusFn({ urls: manquants, session: await sessionAssistant(ctx) }, { signal: controller.signal }))
      .catch(() => ({ etat: 'echec', raison: 'interne' }))
      .then((r) => {
        if (volApercus?.promesse !== promesse) return; // abandonné : muet, rien d'écrit
        volApercus.garde.disconnect(); volApercus = null;
        if (r?.etat === 'recus' && r.apercus instanceof Map) {
          for (const h of manquants) { const a = r.apercus.get(h); apercus.set(h, a?.blob instanceof Blob && COVER_INPUT_MIME.includes(a.blob.type) ? { blob: a.blob, type: a.blob.type } : { raison: typeof a?.raison === 'string' ? a.raison : 'illisible' }); }
          if (memoire?.issue?.etat === 'trouve') elaguerApercus(memoire.issue); // défense en profondeur (revue finale) : jamais un Blob hors des liens du « trouvé » courant
        } else { echecApercus = { issue, raison: typeof r?.raison === 'string' ? r.raison : 'interne' }; } // R-UI2-6 : l'appel a échoué, pas les adresses
        notifier(); // les figures de TOUTE la liste en un seul redessin (B-I-12)
      });
    // La dernière vue déconnectée abandonne le vol (S-4) : un observateur du document, le temps du vol seulement (déconnecté à la fin ou à l'abandon) —
    // SAUF si la route est encore /search (ronde 1) : app.js remplace `main` par « Chargement… » avant de rendre la nouvelle instance (Entrée, mode, case,
    // cuisineos:refresh après une passe qui écrit) ; abandonner là ferait un 499 compté puis une seconde demande des mêmes adresses au montage (R-UI2-7) :
    // trois appels pour une recherche annoncée « 2 appels », dont un sans geste. Le vol reste au module ; l'instance qui se monte le retrouve (« en cours »,
    // puis notifier() pose ses figures). Quitter la recherche (la route a changé quand la vue part) abandonne toujours — et le retour sur /search repaie les
    // adresses abandonnées (la réservation était faite : 499 compté, puis un appel de plus au montage) : limite nommée par la revue finale (spec § 11).
    const garde = new MutationObserver(() => { if (![...vues].some((v) => v.root.isConnected) && routeCourante() !== '/search') abandonnerApercus(); });
    garde.observe(document.body, { childList: true, subtree: true });
    volApercus = { controller, promesse, hrefs: manquants, garde };
    return true;
  };
  // § 4.6 : la figure d'une carte — depuis le Blob de la Map, une URL blob: NEUVE à chaque rendu (révoquée par remplacerEnRevoquant au redessin : la classe
  // plat-vignette est celle que urlsDesVignettes relève ; par app.js au changement de route) ; décorative (alt vide : la carte porte le titre) ; habillée par
  // styles.css (.plat-vignette.grande 4:3 et figure.apercu, R-UI2-9 : aucun style en ligne). I-UI-5 : la liste blanche d'un aperçu est COVER_INPUT_MIME
  // (mime.js), le sous-ensemble gelé d'ALLOWED_MIME que typeAffichage applique aux lignes `files` — ni HEIC, ni PDF, ni EPUB pour une image de page web ;
  // la même liste borne LIMITES_IMAGE_WEB.types et le mur distant (P-UI2-22, R-UI2-15). Une image que le navigateur ne décode pas (error) retire la figure,
  // révoque son URL et remplace l'entrée par un refus : plus jamais de cadre vide. Mais une `error` dont l'URL est DÉJÀ révoquée — par remplacerEnRevoquant
  // à un redessin pendant le chargement (chaque touche du filtre redessine), ou par app.js au changement de route, qui révoque AVANT de remplacer l'écran —
  // vient de la révocation, pas du décodage : la figure part, le Blob RESTE (revoquerUrlDeBlob rend false pour une URL déjà révoquée ; P-UI2-8).
  const figureApercu = (lien) => {
    const a = apercus.get(lien.href);
    if (!(a?.blob instanceof Blob) || !COVER_INPUT_MIME.includes(a.blob.type)) return null;
    const u = urlDeBlob(a.blob);
    // decoding async (ronde 1) : cinq images décodées à leur taille pleine (H-7 : pas de ré-encodage) ne bloquent pas le fil au redessin ; la BORNE de pixels
    // d'un aperçu (plus basse que le mur de F ?) reste une décision du chef, à mesurer à la sonde sur l'iPhone.
    const img = el('img', { class: 'plat-vignette grande', alt: '', src: u, decoding: 'async' });
    const fig = el('figure', { class: 'apercu' }, img);
    // Revue finale (D-UI-13) : quand la DERNIÈRE figure de la liste tombe ainsi, un redessin (un seul : l'entrée est désormais un refus, sans figure) pose
    // « Photos indisponibles pour cette recherche. » sans attendre un geste.
    img.addEventListener('error', () => { fig.remove(); if (revoquerUrlDeBlob(u)) { apercus.set(lien.href, { raison: 'image_refusee' }); if (!root.querySelector('figure.apercu')) notifier(); } }, { once: true });
    return fig;
  };
  // D-UI-13 : la ligne d'état, sous « Demande envoyée » — « en cours » pendant le vol de ces adresses ; rien dès qu'une image est posée ; sinon l'échec de
  // l'appel entier mémorisé pour CETTE issue (R-UI2-6) : « Quota… » s'il est `quota` (429 écrit, S-15), « indisponibles » autrement ; sinon, quand toutes les
  // adresses ont leur entrée (raisons par adresse), « indisponibles » ; rien tant que rien n'a été demandé.
  const ligneEtatApercus = (hrefs, issue) => {
    const ligne = (contenu) => el('p', { class: 'muted', dataset: { role: 'etat-apercus' } }, contenu);
    if (volApercus && hrefs.some((h) => volApercus.hrefs.includes(h))) return ligne(t('Photos en cours de récupération…'));
    const entrees = hrefs.map((h) => apercus.get(h));
    if (!entrees.length || entrees.some((a) => a?.blob instanceof Blob)) return null;
    if (echecApercus && echecApercus.issue === issue) return ligne(echecApercus.raison === 'quota' ? t('Quota du jour atteint : photos indisponibles.') : t('Photos indisponibles pour cette recherche.'));
    if (!entrees.every(Boolean)) return null;
    return ligne(t('Photos indisponibles pour cette recherche.'));
  };
  // § 5.5-5.6 : chaque issue a son écran ; les liens sont revalidés AU RENDU par lienSignet (I-H) ; l'avertissement
  // I-K accompagne toujours les liens ; aucun texte de l'API n'est rendu hors la présentation du plat (bornée en amont).
  function renderIssue(issue, { demandeDiffere = false, demandePrete = true } = {}) {
    const reessayer = () => el('button', { class: 'btn', onClick: () => lancer({ enLigne: () => true }) }, t('Réessayer'));
    // R-WEB-7 : les issues sans « Réessayer » gardent une sortie — la même demande, relancée sans forcer enLigne (un compte
    // admis entre-temps, ou le quota du lendemain, servent alors tout de suite).
    const chercherANouveau = () => el('button', { class: 'btn', onClick: () => lancer() }, t('Chercher à nouveau'));
    if (issue.etat === 'rien') return el('div', { class: 'card flat stack' }, el('div', { class: 'status', role: 'status' }, t('Aucune page trouvée pour cette demande. Reformule ou cherche autrement.')), reessayer(), creerDepuisWeb());
    if (issue.etat === 'indisponible') {
      // La session a disparu pendant le vol : la carte « Connecte-toi » ; la relancer sans session ne mènerait à rien (R-T4-4).
      if (issue.raison === 'non_connecte') return el('div', { class: 'card flat stack' }, carteConnexion(connecter, ctx));
      const refus = texteRefusAssistant(issue); // non_admis, quota (avec ou sans nombre), demande trop lourde (R-T4-4, R-T4-9)
      const demandeVide = !refus && issue.raison === 'requete' && !state.q;
      const connue = Object.hasOwn(TEXTES_INDISPONIBLE, issue.raison);
      const generique = !refus && !demandeVide && !connue; // K3 : le code reste lisible sous le texte générique
      const texte = refus ?? t(demandeVide ? 'Écris d’abord ce que tu cherches.' : (connue ? TEXTES_INDISPONIBLE[issue.raison] : 'L’assistant n’a pas répondu. Réessaie.'));
      return el('div', { class: 'card flat stack' },
        el('div', { class: 'status warn', role: 'status' }, texte),
        generique ? el('small', { class: 'muted' }, t('Code : {c}', { c: String(issue.raison || 'inconnu') })) : null,
        SANS_REESSAI.includes(issue.raison) || issue.trop_lourd === true ? chercherANouveau() : reessayer());
    }
    // trouve
    const carte = (lien) => {
      const l = lienSignet(lien.href);
      if (!l.ok) return null; // revalidé AU RENDU (I-H) : une adresse refusée ici n'a pas de carte
      const titre = lien.titre || l.hote;
      const date = dateLisible(lien.date, getUiLocale()); // lisible et mise en forme, sinon masquée (confort après preuve)
      const presentation = typeof lien.presentation === 'string' && lien.presentation ? lien.presentation : null; // un NŒUD TEXTE, jamais du HTML
      const reperes = ligneReperes(lien);
      return el('div', { class: 'card flat stack' },
        figureApercu(lien), // UI-2 (§ 4.6) : la figure en TÊTE, quand l'image est là ; null sinon (el l'ignore : la carte d'avant le lot)
        el('a', { class: 'btn', href: l.href, target: '_blank', rel: 'noopener noreferrer' }, titre),
        el('div', { class: 'muted', style: { fontSize: '.85rem' } }, date ? `${l.hote} · ${date}` : l.hote),
        presentation ? el('div', null, presentation) : null,
        // C'est une ESTIMATION de l'assistant, pas une donnée de la page : la ligne le dit (I1).
        reperes ? el('div', { class: 'muted', style: { fontSize: '.9rem' } }, t('Estimé par l’assistant : {r}', { r: reperes })) : null,
        el('div', { class: 'row' },
          el('a', { class: 'btn small', href: l.href, target: '_blank', rel: 'noopener noreferrer' }, t('Voir la recette')),
          el('button', { class: 'btn small', onClick: () => nav('/add/signet' + buildQuery({ adresse: l.href, titre })) }, t('Garder ce lien'))),
        // Lot B (D-B5 b, B-29) : une rangée DÉDIÉE, un primaire de 44 px ; jamais pour une adresse en http (la fonction ne la lirait pas, B-20).
        l.href.startsWith('https:') ? el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', dataset: { role: 'garder-et-lire' }, onClick: (e) => garderEtLireCarte(e.currentTarget, lien) }, t('Garder et lire'))) : null);
    };
    const cartes = (Array.isArray(issue.liens) ? issue.liens : []).map(carte).filter(Boolean);
    const autres = (Array.isArray(issue.autres) ? issue.autres : []).map(carte).filter(Boolean); // K2 : repliées, jamais mêlées aux choix
    // R-WEB-3 : un « trouvé » dont aucune carte ne survit à la revalidation ne montre pas un titre sans rien dessous.
    if (!cartes.length) return renderIssue({ ...issue, etat: 'rien' });
    // UI-2 (D-UI-13) : les adresses des cartes affichées (les liens CHOISIS, jamais « autres »), telles que l'issue les porte — la clé de la Map et l'`url` de la
    // réponse (le serveur rend la chaîne reçue, S-9) ; demandées AVANT la ligne d'état, qui dit le vol posé ici ; retenues pour le montage (R-UI2-7).
    // Ronde 1 : seules partent les adresses en https SANS identifiants — une adresse en http: (la carte la garde, la fonction la refuserait `interdit` : une
    // entrée gaspillée) ou à user:pass@ (D-T7 : l'identifiant ne part ni au serveur ; la carte affiche l'href épuré) n'est pas demandée. Toute adresse qui
    // passe ici a sa carte (https lisible ⊂ lienSignet.ok).
    const adresseApercu = (href) => { if (typeof href !== 'string') return false; try { const u = new URL(href); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
    const hrefsApercus = (Array.isArray(issue.liens) ? issue.liens : []).filter((lien) => adresseApercu(lien?.href)).map((lien) => lien.href);
    affiche = { issue, hrefs: hrefsApercus };
    demanderApercus(hrefsApercus, issue);
    const demande = memoire?.filtres?.length ? `${memoire.q} · ${memoire.filtres.join(' ; ')}` : (memoire?.q ?? state.q);
    return section(t('Trouvé sur le web'),
      el('div', { class: 'muted' }, t('Demande envoyée : {q}', { q: demande })),
      ligneEtatApercus(hrefsApercus, issue), // UI-2 : « Photos en cours… » | « Photos indisponibles… » | « Quota du jour atteint… » | rien
      // K1 ; la relance est AUSSI sur la ligne de la mention, avant les liens (confort après preuve, 17 octobre) — le
      // bouton du bas reste. chercherANouveau() est une fabrique : un bouton neuf à chaque appel. Sans demande (champ vidé
      // puis Entrée : clé nulle), la mention reste mais sans relance en haut, qui ne ferait rien (ronde 3, M1).
      demandeDiffere ? el('div', { class: 'status row between' }, el('span', null, t('La demande a changé depuis cette recherche.')), demandePrete ? chercherANouveau() : null) : null,
      ...cartes,
      autres.length ? el('details', null, el('summary', { class: 'btn' }, t('Autres pages trouvées ({n})', { n: autres.length })), ...autres) : null, // K2
      // I-K : sur un repli l'assistant n'a rien présenté ni estimé (les liens sont les résultats bruts) — l'ancienne phrase, sans estimation.
      el('div', { class: 'status' }, issue.repli
        ? t('L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.')
        : t('L’assistant présente les plats et estime le temps d’après les pages : il ne vérifie ni le temps, ni les ingrédients, ni les restrictions. Relis la page avant de cuisiner.')),
      creerDepuisWeb(),
      issue.recherches != null ? el('small', { class: 'muted' }, t('Recherches faites par l’assistant : {n}', { n: issue.recherches })) : null,
      issue.repli ? el('small', { class: 'muted' }, t('Liens tels que trouvés, sans tri de l’assistant.')) : null,
      chercherANouveau());
  }
  // La tape « Garder et lire » : le bouton s'éteint pendant l'écriture (deux tapes = un signet) ; un doublon remplace les deux rangées par la phrase et
  // « Ouvrir la fiche » (rien d'écrit, zéro appel) ; sinon la route de lecture (l'écran y dit « Tu es hors ligne. » si la lecture n'a pas pu partir).
  async function garderEtLireCarte(bouton, lien) {
    if (bouton.disabled) return;
    bouton.disabled = true;
    let r;
    try { r = await garderEtLire(lien, { ctx, ...lecture }); }
    catch (e) { logError('search.garder_et_lire', { error: e }); r = null; } // ronde 1 : une écriture impossible (quota, base fermée) laisse une trace
    if (r?.issue === 'ok') { nav(`/recipes/${encodeURIComponent(r.recipeId)}/importer`); return; }
    if (r?.issue === 'doublon') {
      const carteNoeud = bouton.closest('.card');
      for (const rangee of [...carteNoeud.querySelectorAll(':scope > .row')]) rangee.remove();
      carteNoeud.append(el('div', { class: 'status', dataset: { role: 'doublon-adresse' } }, el('span', null, t('Tu as déjà gardé cette adresse.')), ' ',
        el('a', { class: 'btn small', href: `#/recipes/${encodeURIComponent(r.recette.id)}` }, t('Ouvrir la fiche'))));
      return;
    }
    bouton.disabled = false;
    // Ronde 1 : « Adresse non reconnue. » pour une adresse refusée seulement ; toute autre issue (écriture impossible, refus de transition) dit que le
    // lien n'a pas été gardé — une adresse valide n'est jamais accusée.
    toast(r?.issue === 'refuse' && (r.raison === 'adresse' || r.raison === 'interdit') ? t('Adresse non reconnue.') : t('Le lien n’a pas pu être gardé. Réessaie.'));
  }
  render();
  // R-UI2-7 : une vue rendue DÉTACHÉE (nouvelle instance de la route — app.js monte le nœud après le rendu —, retour arrière, reconstruction par cuisineos:refresh)
  // vérifie UNE fois, au montage (première fois que root.isConnected devient vrai, dans la microtâche de l'observateur), si le « trouvé » qu'elle montre a des
  // adresses absentes de la Map, et les demande alors — même règle que le redessin connecté (demanderApercus) ; un vol posé redessine, pour dire « en cours ».
  // L'observateur se retire au montage, ou quand la vue a été purgée de `vues` sans avoir été montée (jamais un observateur qui survit à sa vue). Borne de fuite
  // (ronde 1) : app.js monte la vue dans la microtâche qui suit son rendu, ou JAMAIS (`seq !== renderSeq` : une navigation plus récente l'a devancée) — au tour
  // de boucle suivant, une vue encore détachée est morte : son observateur et son entrée de `vues` partent avec elle (plus d'observateur qui écoute le document
  // toute la session pour une vue que personne ne montera).
  if (state.mode === 'web' && !root.isConnected) {
    const purger = () => { montage.disconnect(); montages.delete(montage); };
    const montage = new MutationObserver(() => {
      if (root.isConnected) { purger(); if (affiche && demanderApercus(affiche.hrefs, affiche.issue)) render(); return; }
      if (![...vues].some((v) => v.root === root)) purger();
    });
    montage.observe(document.body, { childList: true, subtree: true });
    montages.add(montage);
    setTimeout(() => { if (root.isConnected || !montages.has(montage)) return; purger(); for (const v of [...vues]) if (v.root === root) vues.delete(v); }, 0);
  }
  return root;
}

export { availabilityBadge };
