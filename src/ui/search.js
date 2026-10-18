// Recherche universelle et accompagnements (spec §4, §26) : source active visible, pastilles modifiables, groupes distincts.
import { el } from '../core/dom.js';
import { t, label, getUiLocale } from '../core/i18n.js';
import { navigate, buildQuery, remplacerAdresse } from '../core/router.js';
import { borner } from '../core/bornes.js';
import { lienSignet } from '../core/lien.js';
import { parseQuery, searchDocs, chipsFor } from '../domain/search.js';
import { findAccompaniments } from '../domain/pairing.js';
import { providerFrom } from '../domain/llm.js';
import { chercherRecettesWeb, construireDemande, dateLisible } from '../domain/recherche-web.js';
import { RECIPE_TYPES, DIET_TAGS } from '../model/schema.js';
import { recipeCard, filterChips, libellePuce, segmented, emptyState, section, availabilityBadge, provenanceText, select } from './components.js';
import { addToMealFlow } from './meals.js';

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
export function reinitialiserWeb() { vol?.controller.abort(); vol = null; memoire = null; vues.clear(); } // tests seulement
function notifier() { for (const v of [...vues]) { if (!v.root.isConnected) { vues.delete(v); continue; } v.redessiner(); } }
const ISSUE_INTERNE = Object.freeze({ etat: 'indisponible', raison: 'interne', liens: Object.freeze([]), autres: Object.freeze([]), repli: false, recherches: null, modele: null }); // rangée telle quelle dans `memoire`
// § 5.6 : textes des raisons connues (lus par Object.hasOwn : une raison « constructor » ou « toString » n'est pas connue).
const TEXTES_INDISPONIBLE = {
  hors_ligne: 'Tu es hors ligne.',
  cle_refusee: 'Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.',
  recherche_desactivee: 'La recherche web n’est pas activée sur ton compte Anthropic.',
  trop_de_demandes: 'Trop de demandes pour l’instant. Réessaie dans une minute.',
  refus: 'L’assistant a refusé cette demande.',
  pas_cherche: 'L’assistant n’a pas cherché sur le web. Réessaie.',
};
const SANS_REESSAI = ['cle_refusee', 'recherche_desactivee', 'refus'];
const AVEC_REGLAGES = ['cle_refusee', 'recherche_desactivee'];
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

export async function renderSearch(params, query, ctx, deps = {}) {
  const root = el('div', null);
  const { chercher = chercherRecettesWeb, enLigne, navigate: nav = navigate, remplacerAdresse: remplacer = remplacerAdresse } = deps;
  const state = { q: query.q || '', mode: query.mode || 'all', favorites: query.fav === '1', cooked: query.cooked === '1', requireAll: query.any !== '1', parsed: parseQuery(query.q || '') };
  const forRecipe = query.for ? ctx.docsByRecipe.get(query.for) : null; // Avec quoi on mange ça ?
  const role = query.role || (forRecipe ? 'salade' : null);
  if (forRecipe && role) state.parsed.filters.type = role;

  const input = el('input', { type: 'search', value: state.q, placeholder: forRecipe ? t('Préciser : concombre, sans gluten, 15 minutes…') : t('Ex. : une salade avec du concombre, sans gluten, en quinze minutes'), enterkeyhint: 'search' });
  // L'adresse de la recherche n'a qu'UNE définition : run() (Entrée, mode, cases) et lancer() (la tape web) la rejouent
  // en replace par le `navigate` injecté (par défaut celui du routeur).
  const requeteRoute = () => '/search' + buildQuery({ q: state.q, mode: state.mode, fav: state.favorites ? 1 : '', cooked: state.cooked ? 1 : '', any: state.requireAll ? '' : 1, for: query.for || '', role: role || '' });
  const run = () => { state.q = input.value.trim(); state.parsed = parseQuery(state.q); if (forRecipe && role) state.parsed.filters.type = role; nav(requeteRoute(), { replace: true }); render(); };
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
    results.replaceChildren();
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
      results.append(emptyState('🔍', t('Aucune recette admissible.') + (groups.incompatible ? ` ${t('{n} écartée(s) par une restriction alimentaire — jamais assouplie.', { n: groups.incompatible })}` : '') + (groups.excluded_by_time ? ` ${t('{n} écartée(s) par la durée.', { n: groups.excluded_by_time })}` : ''),
        el('div', { class: 'row', style: { justifyContent: 'center' } }, ...opts)));
    } else if (groups.incompatible || groups.excluded_by_time) {
      results.append(el('p', { class: 'muted' }, [groups.incompatible ? t('{n} recette(s) écartée(s) par une restriction alimentaire.', { n: groups.incompatible }) : '', groups.excluded_by_time ? t('{n} écartée(s) par la durée.', { n: groups.excluded_by_time }) : ''].filter(Boolean).join(' ')));
    }
  }
  // --- Recherche web (spec Web § 5)
  const textesDesPuces = () => chipsFor(state.parsed.filters).map((c) => libellePuce(c, ctx.ingredientsById));
  const demandeCourante = () => construireDemande({ q: state.q, filtres: textesDesPuces(), langue: getUiLocale() });
  // § 5.4 : le champ est RELU s'il a changé depuis la dernière analyse (I-J) — s'il n'a pas changé, les puces ajoutées
  // par les listes « + type » / « + restriction » ou retirées à la main RESTENT ce qu'elles sont à l'écran (R-WEB-2 : une
  // relecture inconditionnelle les écrasait) ; s'il a changé, il est relu et seules les puces de LISTE survivent
  // (R-WEB-10 : la frappe sans Entrée effaçait la restriction choisie, R-WEB-9 portait aussi celles de l'ancien texte).
  // Puis le vol précédent est abandonné (I-I), le nouveau posé au module, et l'adresse mise à jour SANS re-rendu
  // (remplacerAdresse, aucun hashchange) : l'instance courante garde ses puces et son vol — une ré-instanciation
  // repartirait de l'adresse, qui ne porte pas les puces des listes, et perdrait le vol (autre clé). « Réessayer » passe
  // { enLigne: () => true }.
  const lancer = (depsForces = {}) => {
    const champ = input.value.trim();
    if (champ !== state.q) { const affiches = state.parsed.filters; const ancienTexte = parseQuery(state.q).filters; state.q = champ; state.parsed = garderAjoutsDesListes(affiches, ancienTexte, parseQuery(champ)); if (forRecipe && role) state.parsed.filters.type = role; }
    const demande = demandeCourante();
    if (!demande.cle) { render(); return; }
    vol?.controller.abort();
    const controller = new AbortController();
    const cle = demande.cle; const q = demande.q; const filtres = demande.filtres; // nettoyés : ce qui part (R-WEB-1)
    const promesse = Promise.resolve()
      .then(() => chercher({ q, filtres, langue: getUiLocale(), cfg: ctx.settings?.llm }, { enLigne, signal: controller.signal, ...depsForces }))
      .catch(() => ISSUE_INTERNE)
      .then((issue) => {
        if (vol?.promesse !== promesse) return;           // abandonné ou remplacé : muet
        vol = null;
        if (issue?.raison !== 'annule') memoire = { cle, issue: issue && typeof issue === 'object' ? issue : ISSUE_INTERNE, q, filtres };
        notifier();
      });
    vol = { cle, controller, promesse };
    remplacer(requeteRoute());
    render();
  };
  const annuler = () => { vol?.controller.abort(); vol = null; render(); };
  function renderWeb() {
    for (const v of [...vues]) if (!v.root.isConnected) vues.delete(v); // borné en permanence, pas seulement à la résolution d'un vol
    if (![...vues].some((v) => v.root === root)) vues.add({ root, redessiner: render });
    const fournisseur = providerFrom(ctx.settings);
    const reglages = () => el('a', { class: 'btn small', href: '#/settings' }, t('Réglages'));
    if (!fournisseur.configured) return el('div', { class: 'status warn' }, t('Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'), ' ', reglages());
    if (!fournisseur.supportsWebSearch) return el('div', { class: 'status warn' }, t('Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.'), ' ', reglages());
    const cle = demandeCourante().cle;
    const boutonChercher = (eteint) => el('button', { class: 'btn primary', dataset: { role: 'chercher-web' }, disabled: eteint, onClick: () => lancer() }, t('Chercher sur le web avec l’assistant')); // data-role : rouvert par la frappe (§ 5.3)
    if (vol && vol.cle === cle) {
      return el('div', { class: 'card flat stack' },
        el('div', { class: 'status', role: 'status' }, t('L’assistant cherche sur le web…')),
        // Sans data-role : l'écouteur de frappe ne doit PAS rouvrir ce bouton pendant le vol.
        el('div', { class: 'row' }, el('button', { class: 'btn primary', disabled: true }, t('Chercher sur le web avec l’assistant')), el('button', { class: 'btn', onClick: annuler }, t('Annuler'))));
    }
    // K1 : les liens d'un « trouvé » restent quand la demande change, et la différence est dite. Toute autre issue ne vaut
    // que pour SA demande (R-WEB-7) : une demande changée revient à l'écran du bouton — sinon un refus ou une clé refusée
    // resteraient affichés sans issue après la correction de la demande ou des réglages.
    if (memoire && (memoire.issue.etat === 'trouve' || memoire.cle === cle)) return renderIssue(memoire.issue, reglages, { demandeDiffere: memoire.cle !== cle, demandePrete: cle != null });
    const demandeVide = !borner(input.value, 500).trim();
    return el('div', { class: 'card flat stack' },
      boutonChercher(demandeVide),
      el('small', { class: 'muted' }, t('Une recherche = un appel à ton compte Anthropic.')),
      el('small', { class: 'muted', dataset: { role: 'aide-web' }, hidden: !demandeVide }, t('Écris d’abord ce que tu cherches.'))); // toujours là : la frappe la montre ou la cache
  }
  // § 5.5-5.6 : chaque issue a son écran ; les liens sont revalidés AU RENDU par lienSignet (I-H) ; l'avertissement
  // I-K accompagne toujours les liens ; aucun texte de l'API n'est rendu hors « pourquoi » (borné en amont).
  function renderIssue(issue, reglages, { demandeDiffere = false, demandePrete = true } = {}) {
    const reessayer = () => el('button', { class: 'btn', onClick: () => lancer({ enLigne: () => true }) }, t('Réessayer'));
    // R-WEB-7 : les issues sans « Réessayer » gardent une sortie — la même demande, relancée sans forcer enLigne (une clé
    // corrigée dans Réglages sert alors tout de suite).
    const chercherANouveau = () => el('button', { class: 'btn', onClick: () => lancer() }, t('Chercher à nouveau'));
    if (issue.etat === 'non_configure') return el('div', { class: 'card flat stack' }, el('div', { class: 'status warn' }, t('Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'), ' ', reglages()), chercherANouveau());
    if (issue.etat === 'non_pris_en_charge') return el('div', { class: 'card flat stack' }, el('div', { class: 'status warn' }, t('Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.'), ' ', reglages()), chercherANouveau());
    if (issue.etat === 'rien') return el('div', { class: 'card flat stack' }, el('div', { class: 'status', role: 'status' }, t('Aucune page trouvée pour cette demande. Reformule ou cherche autrement.')), reessayer());
    if (issue.etat === 'indisponible') {
      const demandeVide = issue.raison === 'requete' && !state.q;
      const connue = Object.hasOwn(TEXTES_INDISPONIBLE, issue.raison);
      const cle = demandeVide ? 'Écris d’abord ce que tu cherches.' : (connue ? TEXTES_INDISPONIBLE[issue.raison] : 'L’assistant n’a pas répondu. Réessaie.');
      const generique = !demandeVide && !connue; // K3 : le code reste lisible sous le texte générique
      return el('div', { class: 'card flat stack' },
        el('div', { class: 'status warn', role: 'status' }, t(cle), AVEC_REGLAGES.includes(issue.raison) ? [' ', reglages()] : null),
        generique ? el('small', { class: 'muted' }, t('Code : {c}', { c: String(issue.raison || 'inconnu') })) : null,
        SANS_REESSAI.includes(issue.raison) ? chercherANouveau() : reessayer());
    }
    // trouve
    const carte = (lien) => {
      const l = lienSignet(lien.href);
      if (!l.ok) return null; // revalidé AU RENDU (I-H) : une adresse refusée ici n'a pas de carte
      const titre = lien.titre || l.hote;
      const date = dateLisible(lien.date, getUiLocale()); // lisible et mise en forme, sinon masquée (confort après preuve)
      return el('div', { class: 'card flat stack' },
        el('a', { class: 'btn', href: l.href, target: '_blank', rel: 'noopener noreferrer' }, titre),
        el('div', { class: 'muted', style: { fontSize: '.85rem' } }, date ? `${l.hote} · ${date}` : l.hote),
        lien.pourquoi ? el('div', null, lien.pourquoi) : null,
        el('button', { class: 'btn small', onClick: () => nav('/add/signet' + buildQuery({ adresse: l.href, titre })) }, t('Garder ce lien')));
    };
    const cartes = (Array.isArray(issue.liens) ? issue.liens : []).map(carte).filter(Boolean);
    const autres = (Array.isArray(issue.autres) ? issue.autres : []).map(carte).filter(Boolean); // K2 : repliées, jamais mêlées aux choix
    // R-WEB-3 : un « trouvé » dont aucune carte ne survit à la revalidation ne montre pas un titre sans rien dessous.
    if (!cartes.length) return renderIssue({ ...issue, etat: 'rien' }, reglages);
    const demande = memoire?.filtres?.length ? `${memoire.q} · ${memoire.filtres.join(' ; ')}` : (memoire?.q ?? state.q);
    return section(t('Trouvé sur le web'),
      el('div', { class: 'muted' }, t('Demande envoyée : {q}', { q: demande })),
      // K1 ; la relance est AUSSI sur la ligne de la mention, avant les liens (confort après preuve, 17 octobre) — le
      // bouton du bas reste. chercherANouveau() est une fabrique : un bouton neuf à chaque appel. Sans demande (champ vidé
      // puis Entrée : clé nulle), la mention reste mais sans relance en haut, qui ne ferait rien (ronde 3, M1).
      demandeDiffere ? el('div', { class: 'status row between' }, el('span', null, t('La demande a changé depuis cette recherche.')), demandePrete ? chercherANouveau() : null) : null,
      ...cartes,
      autres.length ? el('details', null, el('summary', { class: 'btn' }, t('Autres pages trouvées ({n})', { n: autres.length })), ...autres) : null, // K2
      el('div', { class: 'status' }, t('L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.')),
      issue.recherches != null ? el('small', { class: 'muted' }, t('Recherches faites par l’assistant : {n}', { n: issue.recherches })) : null,
      issue.repli ? el('small', { class: 'muted' }, t('Liens tels que trouvés, sans tri de l’assistant.')) : null,
      chercherANouveau());
  }
  render();
  return root;
}

export { availabilityBadge };
