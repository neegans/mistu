// Plats : rapprochement proposé par similarité de titre, confirmation réversible, comparaison sans données inventées (spec §30).
import { tokenize } from './search.js';
import { formatQuantity, isNumeric } from './quantity.js';
import { unitLabel } from './units.js';
import { scaleVersion } from './scaling.js';

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
function containment(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

export function dishTokens(dish) {
  const parts = [];
  for (const lab of Object.values(dish.labels || {})) { if (lab?.label) parts.push(lab.label); parts.push(...(lab?.aliases || [])); }
  return new Set(parts.flatMap((p) => tokenize(p)));
}

// Propose des plats pour une recette : score ≥ 0.5 ; exclut les rattachements refusés (mémorisés).
export function proposeDishesForRecipe(recipe, dishes, links) {
  const refused = new Set(links.filter((l) => l.recipe_id === recipe.id && l.state === 'refused').map((l) => l.dish_id));
  const linked = new Set(links.filter((l) => l.recipe_id === recipe.id && l.state !== 'refused').map((l) => l.dish_id));
  const title = new Set(tokenize(`${recipe.original_title || ''} ${recipe.display_title || ''}`));
  const out = [];
  for (const dish of dishes) {
    if (refused.has(dish.id) || linked.has(dish.id)) continue;
    const dt = dishTokens(dish);
    const score = Math.max(jaccard(title, dt), containment(title, dt) * 0.9);
    if (score >= 0.5) out.push({ dish, score, evidence: `Similarité de titre ${(score * 100).toFixed(0)} % — à confirmer` });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function proposeRecipesForDish(dish, recipes, links) {
  const states = new Map(links.filter((l) => l.dish_id === dish.id).map((l) => [l.recipe_id, l.state]));
  const dt = dishTokens(dish);
  const out = [];
  for (const r of recipes) {
    if (states.has(r.id)) continue;
    const title = new Set(tokenize(`${r.original_title || ''} ${r.display_title || ''}`));
    const score = Math.max(jaccard(title, dt), containment(title, dt) * 0.9);
    if (score >= 0.5) out.push({ recipe: r, score, evidence: `Similarité de titre ${(score * 100).toFixed(0)} % — à confirmer` });
  }
  return out.sort((a, b) => b.score - a.score);
}

// Comparaison de 2–3 recettes : bundles = [{ recipe, version, book, edition, history }]
export function compareBundles(bundles, ingredientsById, { normalizeServings = null, locale = 'fr' } = {}) {
  const cols = bundles.map((b) => {
    const v = b.version;
    const scaled = normalizeServings && v?.servings ? scaleVersion(v, normalizeServings) : null;
    return { ...b, ingredients: scaled?.ok ? scaled.ingredients : (v?.ingredients || []), normalized: !!scaled?.ok };
  });
  const idSets = cols.map((c) => new Set(c.ingredients.map((i) => i.ingredient_id).filter(Boolean)));
  const allIds = new Set(idSets.flatMap((s) => [...s]));
  const common = [...allIds].filter((id) => idSets.every((s) => s.has(id)));
  const only = cols.map((c, i) => [...idSets[i]].filter((id) => !common.includes(id)));
  const label = (id) => ingredientsById.get(id)?.labels?.[locale]?.label || ingredientsById.get(id)?.labels?.fr?.label || id;
  const qtyRows = [...allIds].map((id) => ({
    ingredient_id: id, label: label(id),
    cells: cols.map((c) => {
      const ri = c.ingredients.find((i) => i.ingredient_id === id);
      if (!ri) return { text: '—' };
      const q = ri.quantity;
      const t = `${formatQuantity(q, { locale })} ${ri.unit_id ? unitLabel(ri.unit_id, locale) : ri.unit_text || ''}`.trim();
      return { text: t || ri.source_text, source_text: ri.source_text, preparation: ri.preparation, optional: ri.optional, numeric: isNumeric(q) };
    }),
  })).sort((a, b) => a.label.localeCompare(b.label));
  const unresolved = cols.map((c) => c.ingredients.filter((i) => !i.ingredient_id).map((i) => i.source_text));
  const technique = cols.map((c) => ({
    steps: c.version?.steps?.length ?? null,
    prep: c.version?.prep_minutes ?? null, cook: c.version?.cook_minutes ?? null, total: c.version?.total_minutes ?? null, active: c.version?.active_minutes ?? null,
    appliances: c.version?.appliances || [], servings: c.version?.servings ?? null,
  }));
  const experience = cols.map((c) => {
    const last = (c.history || [])[0];
    return { cooked: (c.history || []).length, last_at: last?.cooked_at || null, rating: last?.rating ?? null, notes: last?.notes || '', preferred: !!c.recipe.favorite };
  });
  return { cols, common: common.map((id) => ({ id, label: label(id) })), only: only.map((ids) => ids.map((id) => ({ id, label: label(id) }))), unresolved, qtyRows, technique, experience };
}
