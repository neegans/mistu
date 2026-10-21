// Recherche universelle FR/EN (spec §4) : filtres compris affichés en pastilles, ingrédients résolus vers une identité
// commune, contraintes strictes jamais assouplies, source active toujours visible, aucun élargissement silencieux au Web.
import { normalizeText } from './units.js';
import { assessVersion } from './diet.js';
import { sectionLisible } from './llm.js';

const STOP = new Set(['de', 'la', 'le', 'les', 'du', 'des', 'un', 'une', 'et', 'a', 'au', 'aux', 'the', 'an', 'of', 'with', 'and', 'avec', 'pour', 'en', 'dans', 'sur', 'mes', 'mon', 'ma', 'my', 'some', 'quelque', 'quelques', 'd', 'l', 'que', 'qui', 'quelque', 'chose', 'something', 'recette', 'recettes', 'recipe', 'recipes', 'trouve', 'find', 'moi', 'me', 'livres', 'books', 'in', 'to', 'pret', 'prete', 'ready', 'minutes', 'minute', 'min']);

// S2 (vague /verify) : les mots-clés d'un livre, tolérants — une archive restaurée ou une ligne reçue peut porter
// autre chose qu'un tableau de chaînes (`tags: 1` faisait tomber toute la recherche). Pur, sans DOM ni t() : vit ici
// (domaine) et non dans src/ui/puces.js, pour qu'aucune dépendance domaine → ui n'existe ; puces.js et book.js l'importent.
export const tagsDe = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

export function tokenize(s) {
  return normalizeText(s).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
}

const TYPE_WORDS = [
  [/\b(salades?|salads?)\b/, 'salade'], [/\b(soupes?|soups?|potages?|veloutes?)\b/, 'soupe'], [/\b(legumes?|vegetables?|veggies?)\b/, 'legumes'],
  [/\b(feculents?|starch|starches)\b/, 'feculent'], [/\b(desserts?)\b/, 'dessert'], [/\b(entrees?|starters?|appetizers?)\b/, 'entree'],
  [/\b(plat principal|plats principaux|main course|main dish|mains?)\b/, 'plat_principal'], [/\b(sauces?|condiments?|vinaigrettes?|dressings?)\b/, 'sauce'],
];
// Mots FR/EN d'un type, pour retrouver une référence d'index par son titre quand le type a été consommé comme filtre.
const TYPE_TOKENS = {
  salade: ['salade', 'salades', 'salad', 'salads'], soupe: ['soupe', 'soupes', 'soup', 'soups', 'potage', 'veloute'], legumes: ['legumes', 'legume', 'vegetables', 'vegetable'],
  feculent: ['feculent', 'feculents', 'starch'], dessert: ['dessert', 'desserts'], entree: ['entree', 'entrees', 'starter', 'starters'], plat_principal: ['plat', 'principal', 'main'], sauce: ['sauce', 'sauces', 'vinaigrette', 'dressing', 'condiment'],
};
const DIET_WORDS = [
  [/\bsans gluten\b|\bgluten[- ]free\b/, 'sans_gluten'], [/\bvegetarien(?:ne)?s?\b|\bvegetarian\b|\bvegetarien\b/, 'vegetarien'], [/\bvegetalien(?:ne)?s?\b|\bvegan\b|\bvegane\b/, 'vegetalien'],
  [/\bsans lactose\b|\bsans produits? laitiers?\b|\bdairy[- ]free\b|\blactose[- ]free\b/, 'sans_lactose'], [/\bsans noix\b|\bnut[- ]free\b/, 'sans_noix'],
  [/\bsans (?:oeufs?|œufs?)\b|\begg[- ]free\b/, 'sans_oeufs'], [/\bsans fruits de mer\b|\bsans poisson\b|\bseafood[- ]free\b/, 'sans_fruits_de_mer'],
  [/\bsans porc\b|\bpork[- ]free\b/, 'sans_porc'], [/\bsans alcool\b|\balcohol[- ]free\b/, 'sans_alcool'],
];

let labelIndex = null;
export function buildLabelIndex(ingredients) {
  labelIndex = [];
  for (const ing of ingredients) {
    for (const [locale, lab] of Object.entries(ing.labels || {})) {
      if (lab?.label) labelIndex.push({ alias: normalizeText(lab.label), id: ing.id, locale });
      for (const a of lab?.aliases || []) labelIndex.push({ alias: normalizeText(a), id: ing.id, locale });
    }
  }
  labelIndex.sort((a, b) => b.alias.length - a.alias.length);
  return labelIndex;
}

function findIngredientMentions(norm) {
  const found = [];
  let text = ` ${norm} `;
  for (const e of labelIndex || []) {
    if (e.alias.length < 3) continue;
    const re = new RegExp(`(^|[^a-z0-9])${e.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`);
    const m = re.exec(text);
    if (m) {
      const start = m.index + m[1].length;
      found.push({ id: e.id, alias: e.alias, start, end: start + e.alias.length });
      text = text.slice(0, start) + ' '.repeat(e.alias.length) + text.slice(start + e.alias.length);
    }
  }
  return { found, remaining: text.trim() };
}

// Analyse d'une demande en langage naturel → filtres visibles. Retourne { terms, filters, chips }.
export function parseQuery(q) {
  const norm = normalizeText(q);
  const filters = { type: null, diets: [], include: [], exclude: [], max_total_minutes: null, max_active_minutes: null, quick: false };
  let text = ` ${norm} `;
  for (const [re, tag] of DIET_WORDS) if (re.test(text)) { filters.diets.push(tag); text = text.replace(re, ' '); }
  for (const [re, type] of TYPE_WORDS) { const m = re.exec(text); if (m) { filters.type = type; text = text.replace(re, ' '); break; } }
  const time = /(?:en|in|sous|under|moins de|less than|max(?:imum)?)?\s*(\d{1,3})\s*(?:min(?:utes?)?|mn)\b(\s*(?:actives?|active|de travail))?/.exec(text);
  if (time) {
    const n = parseInt(time[1], 10);
    if (time[2]) filters.max_active_minutes = n; else filters.max_total_minutes = n;
    text = text.replace(time[0], ' ');
  }
  const hours = /(?:en|in)\s*(\d)\s*h(?:eures?|ours?)?\b/.exec(text);
  if (hours) { filters.max_total_minutes = parseInt(hours[1], 10) * 60; text = text.replace(hours[0], ' '); }
  if (/\b(rapide|quick|vite|express)\b/.test(text)) { filters.quick = true; if (!filters.max_total_minutes) filters.max_total_minutes = 30; text = text.replace(/\b(rapide|quick|vite|express)\b/, ' '); }
  // Exclusions : « sans X », « without X », « no X », « pas de X »
  const exclRe = /\b(?:sans|without|no|pas de|pas d')\s+([a-z0-9' -]+?)(?=\s+(?:avec|with|et|and|pour|for|en|in)\b|,|$)/g;
  let m;
  const exclSpans = [];
  while ((m = exclRe.exec(text.trim()))) exclSpans.push(m[1].trim());
  for (const span of exclSpans) {
    const { found } = findIngredientMentions(span);
    if (found.length) { filters.exclude.push(...found.map((f) => f.id)); text = text.replace(span, ' '); }
    else filters.exclude_text = [...(filters.exclude_text || []), span];
  }
  text = text.replace(/\b(sans|without|no|pas de|pas d')\b/g, ' ');
  const { found, remaining } = findIngredientMentions(text);
  filters.include.push(...found.map((f) => f.id).filter((id) => !filters.exclude.includes(id)));
  const terms = tokenize(remaining);
  return { text: q, terms, filters, chips: chipsFor(filters) };
}

export function chipsFor(filters) {
  const chips = [];
  if (filters.type) chips.push({ kind: 'type', value: filters.type });
  for (const d of filters.diets) chips.push({ kind: 'diet', value: d });
  for (const id of filters.include) chips.push({ kind: 'include', value: id });
  for (const id of filters.exclude) chips.push({ kind: 'exclude', value: id });
  for (const t of filters.exclude_text || []) chips.push({ kind: 'exclude_text', value: t });
  if (filters.max_total_minutes) chips.push({ kind: 'max_total', value: filters.max_total_minutes });
  if (filters.max_active_minutes) chips.push({ kind: 'max_active', value: filters.max_active_minutes });
  return chips;
}

// Document de recherche par recette (version courante).
export function buildDocs({ recipes, versions, editions, books, dishes, links, translations = [], history = [] }) {
  const versionsByRecipe = new Map();
  for (const v of versions) { if (!versionsByRecipe.has(v.recipe_id)) versionsByRecipe.set(v.recipe_id, []); versionsByRecipe.get(v.recipe_id).push(v); }
  const editionsById = new Map(editions.map((e) => [e.id, e]));
  const booksById = new Map(books.map((b) => [b.id, b]));
  const dishesById = new Map(dishes.map((d) => [d.id, d]));
  const dishByRecipe = new Map();
  for (const l of links) if (l.state === 'confirmed') dishByRecipe.set(l.recipe_id, dishesById.get(l.dish_id));
  const translationByVersion = new Map(translations.map((t) => [t.recipe_version_id, t]));
  const cooked = new Map();
  for (const h of history) cooked.set(h.recipe_id, (cooked.get(h.recipe_id) || 0) + 1);
  return recipes.map((recipe) => {
    const version = currentVersion(recipe, versionsByRecipe.get(recipe.id) || []);
    const edition = recipe.edition_id ? editionsById.get(recipe.edition_id) : null;
    const book = edition ? booksById.get(edition.book_id) : null;
    const dish = dishByRecipe.get(recipe.id);
    const tr = version ? translationByVersion.get(version.id) : null;
    const section = sectionLisible(recipe.section); // lot C (D-C6) : la section lue, nettoyée et bornée (sectionLisible), sinon null
    const textParts = [recipe.original_title, recipe.display_title, tr?.translated_content?.title, book?.title, book?.author, dish?.labels?.fr?.label, dish?.labels?.en?.label, ...(recipe.tags || []), ...(recipe.cuisines || []), ...tagsDe(book?.tags), section];
    const ingredientIds = new Set((version?.ingredients || []).map((i) => i.ingredient_id).filter(Boolean));
    for (const ri of version?.ingredients || []) textParts.push(ri.name_text || ri.source_text);
    const tokens = new Set(textParts.filter(Boolean).flatMap((s) => tokenize(String(s))));
    // Les cuisines, les mots-clés du livre et la section lue (lot C, D-C6) comptent comme des mots du titre pour une recette-référence SEULEMENT : c'est
    // tout ce qu'un signet web possède pour se faire retrouver (spec § 11, F7). D12 : une référence d'index d'un livre
    // tagué remonte désormais par les mots-clés du livre — intention du brief § 12.5 ; le test F7 reste vert (`books: []`).
    const titleTokens = new Set(tokenize(`${recipe.original_title || ''} ${recipe.display_title || ''} ${tr?.translated_content?.title || ''} ${recipe.availability === 'reference_only' ? [...(recipe.cuisines || []), ...tagsDe(book?.tags), section || ''].join(' ') : ''}`));
    return { recipe, version, edition, book, dish, tokens, titleTokens, ingredientIds, cooked: cooked.get(recipe.id) || 0, translation: tr };
  });
}

export function currentVersion(recipe, versions) {
  if (!versions.length) return null;
  if (recipe.current_version_id) { const v = versions.find((x) => x.id === recipe.current_version_id); if (v) return v; }
  const sorted = [...versions].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  return sorted.find((v) => v.kind === 'correction') || sorted[0];
}

// mode : recipes | books | all | web. Retourne des groupes distincts, sans supprimer de contrainte stricte.
export function searchDocs(docs, parsed, { mode = 'all', ingredientsById, favoritesOnly = false, cookedOnly = false, editionId = null, requireAll = true } = {}) {
  const { terms, filters } = parsed;
  const groups = { admissible: [], to_verify: [], adaptation: [], references: [], incompatible: 0, time_unknown: [], excluded_by_time: 0 };
  if (mode === 'web') return groups;
  // Mots utiles pour retrouver une référence d'index par son titre : mots de la demande, libellés FR/EN des ingrédients demandés, mots du type.
  const refTerms = new Set(tokenize(parsed.text || ''));
  for (const id of filters.include) {
    const ing = ingredientsById?.get(id);
    for (const lab of Object.values(ing?.labels || {})) for (const s of [lab?.label, ...(lab?.aliases || [])]) if (s) for (const tk of tokenize(s)) refTerms.add(tk);
  }
  for (const tk of TYPE_TOKENS[filters.type] || []) refTerms.add(tk);
  for (const d of docs) {
    const { recipe, version } = d;
    if (editionId && recipe.edition_id !== editionId) continue;
    if (favoritesOnly && !recipe.favorite) continue;
    if (cookedOnly && !d.cooked) continue;
    if (recipe.availability === 'reference_only' || !version) {
      // Référence d'index : ingrédients, durées et compatibilités inconnus → groupe distinct, jamais mêlée aux admissibles.
      if (mode === 'recipes') continue;
      if (filters.type && recipe.type && recipe.type !== filters.type) continue;
      const hits = [...refTerms].filter((tk) => d.titleTokens.has(tk) || (tk.length >= 4 && [...d.titleTokens].some((tok) => tok.startsWith(tk))));
      const typeHit = !!filters.type && recipe.type === filters.type;
      if (!hits.length && !typeHit) continue;
      groups.references.push({ doc: d, score: hits.length * 2 + (typeHit ? 2 : 0) + (recipe.favorite ? 1 : 0), reasons: hits, note: 'Ingrédients inconnus : référence d’index seulement' });
      continue;
    }
    if (filters.type && recipe.type && recipe.type !== filters.type) continue;
    if (filters.type && !recipe.type) continue;
    let score = 0;
    const reasons = [];
    for (const t of terms) {
      if (d.titleTokens.has(t)) { score += 3; reasons.push(t); }
      else if (d.tokens.has(t)) { score += 1; reasons.push(t); }
      else if ([...d.tokens].some((tok) => tok.startsWith(t) && t.length >= 4)) { score += 0.5; }
    }
    if (terms.length && score === 0 && !filters.include.length && !filters.type) continue;
    if (filters.include.length) {
      const hits = filters.include.filter((id) => d.ingredientIds.has(id));
      if (requireAll ? hits.length < filters.include.length : hits.length === 0) continue;
      score += 4 * hits.length;
      reasons.push(...hits.map((id) => ingredientsById?.get(id)?.labels?.fr?.label || id));
    }
    if (filters.exclude.some((id) => d.ingredientIds.has(id))) continue;
    if (filters.exclude_text?.length) {
      const txt = normalizeText((version.ingredients || []).map((i) => i.source_text).join(' '));
      if (filters.exclude_text.some((x) => txt.includes(x))) continue;
    }
    // Temps : les inconnues restent visibles, à part.
    let timeState = 'ok';
    if (filters.max_total_minutes || filters.max_active_minutes) {
      const total = version.total_minutes ?? ((version.prep_minutes ?? 0) + (version.cook_minutes ?? 0) || null);
      const active = version.active_minutes ?? version.prep_minutes ?? null;
      if (filters.max_total_minutes) { if (total == null) timeState = 'unknown'; else if (total > filters.max_total_minutes) { groups.excluded_by_time++; continue; } }
      if (filters.max_active_minutes) { if (active == null) timeState = timeState === 'ok' ? 'unknown' : timeState; else if (active > filters.max_active_minutes) { groups.excluded_by_time++; continue; } }
    }
    // Restrictions : appliquées avant le classement gustatif, jamais assouplies.
    let dietState = 'compatible';
    const assessments = [];
    for (const diet of filters.diets) {
      const a = assessVersion(version, ingredientsById, diet);
      assessments.push(a);
      if (a.state === 'incompatible') dietState = 'incompatible';
      else if (a.state === 'adaptation' && dietState !== 'incompatible') dietState = 'adaptation';
      else if (a.state === 'to_verify' && dietState === 'compatible') dietState = 'to_verify';
    }
    if (dietState === 'incompatible') { groups.incompatible++; continue; }
    score += (recipe.favorite ? 2 : 0) + Math.min(d.cooked, 3) * 0.5 + (recipe.availability === 'available' ? 1 : 0);
    const hit = { doc: d, score, reasons, assessments, timeState };
    if (dietState === 'adaptation') groups.adaptation.push(hit);
    else if (dietState === 'to_verify') groups.to_verify.push(hit);
    else if (timeState === 'unknown') groups.time_unknown.push(hit);
    else groups.admissible.push(hit);
  }
  for (const k of ['admissible', 'to_verify', 'adaptation', 'references', 'time_unknown']) groups[k].sort((a, b) => b.score - a.score);
  return groups;
}
