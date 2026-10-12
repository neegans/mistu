// Recherche universelle et accompagnements (spec §4, §26) : source active visible, pastilles modifiables, groupes distincts.
import { el } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate, buildQuery } from '../core/router.js';
import { parseQuery, searchDocs, chipsFor } from '../domain/search.js';
import { findAccompaniments } from '../domain/pairing.js';
import { RECIPE_TYPES, DIET_TAGS } from '../model/schema.js';
import { recipeCard, filterChips, segmented, emptyState, section, availabilityBadge, provenanceText, select } from './components.js';
import { addToMealFlow } from './meals.js';

const MODES = [['recipes', 'Mes recettes'], ['books', 'Mes livres'], ['web', 'Web'], ['all', 'Tout']];

export async function renderSearch(params, query, ctx) {
  const root = el('div', null);
  const state = { q: query.q || '', mode: query.mode || 'all', favorites: query.fav === '1', cooked: query.cooked === '1', requireAll: query.any !== '1', parsed: parseQuery(query.q || '') };
  const forRecipe = query.for ? ctx.docsByRecipe.get(query.for) : null; // Avec quoi on mange ça ?
  const role = query.role || (forRecipe ? 'salade' : null);
  if (forRecipe && role) state.parsed.filters.type = role;

  const input = el('input', { type: 'search', value: state.q, placeholder: forRecipe ? t('Préciser : concombre, sans gluten, 15 minutes…') : t('Ex. : une salade avec du concombre, sans gluten, en quinze minutes'), enterkeyhint: 'search' });
  const run = () => { state.q = input.value.trim(); state.parsed = parseQuery(state.q); if (forRecipe && role) state.parsed.filters.type = role; navigate('/search' + buildQuery({ q: state.q, mode: state.mode, fav: state.favorites ? 1 : '', cooked: state.cooked ? 1 : '', any: state.requireAll ? '' : 1, for: query.for || '', role: role || '' }), { replace: true }); render(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

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

    if (state.mode === 'web') {
      results.append(el('div', { class: 'status warn' }, t('Le Web n’est pas activé : aucune source externe n’est configurée. Aucune recherche extérieure n’a été faite.')));
      return;
    }
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
  render();
  return root;
}

export { availabilityBadge };
