// Redécouvrir (spec §32) : fondé uniquement sur les consultations observables dans Cuisine OS.
// Aucune durée inventée : sans historique suffisant, la carte dit « À explorer dans ta bibliothèque ».

const CONSULT_EVENTS = new Set(['open_book', 'open_recipe', 'open_pages']);
const MIN_HISTORY_DAYS = 30; // en dessous, l'app ne prétend pas mesurer une inactivité
const DAY = 86400000;

export function pickSuggestion({ editions, books, recipes, activity, prefs, now = new Date(), context = {} }) {
  const nowMs = now.getTime();
  const prefById = new Map(prefs.map((p) => [p.edition_id, p]));
  const booksById = new Map(books.map((b) => [b.id, b]));
  const recipesByEdition = new Map();
  for (const r of recipes) { if (!r.edition_id) continue; if (!recipesByEdition.has(r.edition_id)) recipesByEdition.set(r.edition_id, []); recipesByEdition.get(r.edition_id).push(r); }
  let oldestActivity = null;
  const lastConsult = new Map();
  for (const a of activity) {
    const t = Date.parse(a.occurred_at);
    if (!Number.isFinite(t)) continue;
    if (oldestActivity === null || t < oldestActivity) oldestActivity = t;
    if (CONSULT_EVENTS.has(a.event_type)) lastConsult.set(a.edition_id, Math.max(lastConsult.get(a.edition_id) || 0, t));
  }
  const historyOk = oldestActivity !== null && nowMs - oldestActivity >= MIN_HISTORY_DAYS * DAY;
  const candidates = [];
  for (const ed of editions) {
    const pref = prefById.get(ed.id);
    if (pref?.hidden) continue;
    if (pref?.snoozed_until && Date.parse(pref.snoozed_until) > nowMs) continue;
    const list = recipesByEdition.get(ed.id) || [];
    if (!list.length) continue;
    const last = lastConsult.get(ed.id) || null;
    const daysSince = last ? (nowMs - last) / DAY : null;
    if (daysSince !== null && daysSince < 14) continue; // consulté récemment : pas une redécouverte
    const lastSuggested = pref?.last_suggested_at ? Date.parse(pref.last_suggested_at) : 0;
    const rotation = lastSuggested ? Math.min((nowMs - lastSuggested) / DAY, 60) : 60;
    const score = (daysSince === null ? 120 : Math.min(daysSince, 365)) + rotation;
    candidates.push({ edition: ed, book: booksById.get(ed.book_id), recipes: list, daysSince, score });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 3);
  const pick = top[Math.floor(Math.random() * top.length)];
  const recipe = chooseRecipe(pick.recipes, context);
  const showDuration = historyOk && pick.daysSince !== null;
  return {
    edition: pick.edition, book: pick.book, recipe,
    mode: showDuration ? 'rediscover' : 'explore',
    months_since: showDuration ? Math.max(1, Math.round(pick.daysSince / 30)) : null,
    reason: recipeReason(recipe, context),
  };
}

function chooseRecipe(list, context) {
  const wanted = context.type || null;
  const inc = new Set(context.include || []);
  const score = (r) => {
    let s = 0;
    if (r.availability === 'available') s += 5;
    else if (r.availability === 'partial') s += 2;
    if (wanted && r.type === wanted) s += 4;
    if (inc.size && (r.ingredient_ids || []).some((id) => inc.has(id))) s += 3;
    if (r.favorite) s += 1;
    return s + Math.random();
  };
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

function recipeReason(recipe, context) {
  if (!recipe) return '';
  if (recipe.availability === 'reference_only') return recipe.printed_page ? `Repérée dans ton livre — page ${recipe.printed_page}. Recette à scanner avant de cuisiner.` : 'Repérée dans l’index de ton livre. Recette à scanner avant de cuisiner.';
  if (context.type && recipe.type === context.type) return 'Correspond au type que tu cherches aujourd’hui.';
  return 'Recette disponible dans ta bibliothèque.';
}

export function snoozeUntil(days = 14, now = new Date()) {
  return new Date(now.getTime() + days * DAY).toISOString();
}
