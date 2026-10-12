// Moteur d'unités déterministe (spec §29.2). Aucune conversion sans convention ou équivalence documentée.
import { UNIT_DEFINITIONS, UNIT_CONVENTIONS } from '../model/seed.js';
import { formatNumber, formatQuantity, isNumeric } from './quantity.js';

let unitsById = new Map(UNIT_DEFINITIONS.map((u) => [u.id, u]));
let conventionsById = new Map(UNIT_CONVENTIONS.map((c) => [c.id, c]));
let aliasIndex = null;

export function loadUnits(defs, conventions) {
  if (defs?.length) unitsById = new Map(defs.map((u) => [u.id, u]));
  if (conventions?.length) conventionsById = new Map(conventions.map((c) => [c.id, c]));
  aliasIndex = null;
}

// Repli des accents : décomposition NFD puis retrait des marques combinantes (\p{M}).
export const normalizeText = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

function buildAliasIndex() {
  aliasIndex = [];
  for (const u of unitsById.values()) {
    for (const a of u.aliases) aliasIndex.push({ alias: normalizeText(a), unit_id: u.id });
  }
  aliasIndex.sort((a, b) => b.alias.length - a.alias.length); // les alias longs d'abord
}

export const getUnit = (id) => unitsById.get(id) || null;
export const getConvention = (id) => conventionsById.get(id) || null;
export const listConventions = () => [...conventionsById.values()];
export const listUnits = () => [...unitsById.values()];

const AMBIGUOUS_OZ = new Set(['oz', 'once', 'onces', 'ounce', 'ounces']);

// Repli sans changement de longueur (pas de trim ni de fusion d'espaces) pour retrouver les positions dans le texte source.
const foldKeepLength = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/’/g, "'");

// Reconnaît une unité au début de « rest ». Retourne { unit_id, unit_text, candidates?, rest }.
export function matchUnit(rest) {
  if (!aliasIndex) buildAliasIndex();
  const input = (rest || '').trimStart();
  const norm = foldKeepLength(input);
  for (const { alias, unit_id } of aliasIndex) {
    if (!norm.startsWith(alias)) continue;
    const after = norm.slice(alias.length);
    if (after && !/^[\s.,)]/.test(after)) continue; // frontière de mot
    let consumed = alias.length;
    if (input[consumed] === '.') consumed += 1;
    const tail = input.slice(consumed);
    if (AMBIGUOUS_OZ.has(alias) && !/^\s*(fl|liq)/i.test(tail)) {
      return { unit_id: null, unit_text: input.slice(0, consumed), candidates: ['oz_mass', 'fl_oz'], rest: tail.trim() };
    }
    return { unit_id, unit_text: input.slice(0, consumed), rest: tail.trim() };
  }
  return { unit_id: null, unit_text: '', rest: input };
}

export function unitLabel(unitId, locale = 'fr') {
  const u = getUnit(unitId);
  if (!u) return unitId || '';
  return u.labels?.[locale] || u.labels?.fr || u.id;
}

// Valeur d'une unité dans son unité de référence (g ou ml). Retourne { factor, source, convention? } ou { error }.
export function unitFactor(unitId, conventionId) {
  const u = getUnit(unitId);
  if (!u) return { error: 'unit_unknown' };
  if (u.dimension === 'temperature' || u.dimension === 'count') return { error: 'not_convertible' };
  if (!u.convention_dependent) return { factor: u.factor, source: u.source };
  const c = conventionId ? getConvention(conventionId) : null;
  if (!c) return { error: 'convention_required', missing: 'convention' };
  const v = c.values[unitId];
  if (!v) return { error: 'convention_incomplete' };
  return { factor: v, source: c.source, convention: { id: c.id, revision: c.revision } };
}

export function dimensionOf(unitId) { return getUnit(unitId)?.dimension || null; }

// Contexte : { convention_id, ingredient, edition, system: 'metric'|'us' }
// Résultat : { ok: true, value, unit_id, rule, assumptions: [], estimate: bool, source } ou { ok: false, reason, missing? }
export function convertValue(value, fromUnitId, toUnitId, ctx = {}) {
  if (!Number.isFinite(value)) return { ok: false, reason: 'no_numeric_value' };
  if (fromUnitId === toUnitId) return { ok: true, value, unit_id: toUnitId, rule: 'identity', assumptions: [], estimate: false };
  const from = getUnit(fromUnitId), to = getUnit(toUnitId);
  if (!from || !to) return { ok: false, reason: 'unit_unknown' };
  if (from.dimension === 'temperature' && to.dimension === 'temperature') {
    const out = fromUnitId === 'celsius' ? value * 9 / 5 + 32 : (value - 32) * 5 / 9;
    return { ok: true, value: out, unit_id: toUnitId, rule: 'temperature', assumptions: ['L’ajustement pour convection est une adaptation distincte'], estimate: false };
  }
  if (from.dimension === 'count' || to.dimension === 'count') return { ok: false, reason: 'not_convertible' };
  if (from.dimension === to.dimension) {
    const f = unitFactor(fromUnitId, ctx.convention_id);
    const t = unitFactor(toUnitId, ctx.target_convention_id || ctx.convention_id);
    if (f.error) return { ok: false, reason: f.error, missing: f.missing };
    if (t.error) return { ok: false, reason: t.error, missing: t.missing };
    const assumptions = [];
    if (f.convention) assumptions.push(`Convention source : ${getConvention(f.convention.id).labels.fr}`);
    if (t.convention) assumptions.push(`Convention cible : ${getConvention(t.convention.id).labels.fr}`);
    return { ok: true, value: value * f.factor / t.factor, unit_id: toUnitId, rule: 'same_dimension', assumptions, estimate: false, source: f.source };
  }
  // Volume <-> masse : uniquement par équivalence documentée pour cet ingrédient (état pertinent), jamais universelle.
  const ing = ctx.ingredient;
  if (!ing) return { ok: false, reason: 'ingredient_required', missing: 'ingredient' };
  const eq = pickEquivalence(ing, ctx.state);
  if (!eq) return { ok: false, reason: 'equivalence_required', missing: 'equivalence' };
  // eq : { volume_unit_id, volume_value, mass_g, state?, source, convention_id? }
  const volFactor = unitFactor(eq.volume_unit_id, eq.convention_id || ctx.convention_id);
  if (volFactor.error) return { ok: false, reason: volFactor.error, missing: volFactor.missing };
  const gPerMl = eq.mass_g / (eq.volume_value * volFactor.factor);
  const assumptions = [`Équivalence documentée : ${eq.volume_value} ${unitLabel(eq.volume_unit_id)} = ${eq.mass_g} g${eq.state ? ` (${eq.state})` : ''} — ${eq.source}`];
  if (volFactor.convention) assumptions.push(`Convention : ${getConvention(volFactor.convention.id).labels.fr}`);
  if (from.dimension === 'volume' && to.dimension === 'mass') {
    const f = unitFactor(fromUnitId, ctx.convention_id);
    if (f.error) return { ok: false, reason: f.error, missing: f.missing };
    const ml = value * f.factor;
    const g = ml * gPerMl;
    const t = unitFactor(toUnitId);
    return { ok: true, value: g / t.factor, unit_id: toUnitId, rule: 'volume_to_mass', assumptions, estimate: true, source: eq.source };
  }
  if (from.dimension === 'mass' && to.dimension === 'volume') {
    const f = unitFactor(fromUnitId);
    const g = value * f.factor;
    const ml = g / gPerMl;
    const t = unitFactor(toUnitId, ctx.target_convention_id || ctx.convention_id);
    if (t.error) return { ok: false, reason: t.error, missing: t.missing };
    return { ok: true, value: ml / t.factor, unit_id: toUnitId, rule: 'mass_to_volume', assumptions, estimate: true, source: eq.source };
  }
  return { ok: false, reason: 'not_convertible' };
}

function pickEquivalence(ing, state) {
  const list = ing?.equivalences || [];
  if (!list.length) return null;
  if (state) {
    const exact = list.find((e) => e.state && normalizeText(e.state) === normalizeText(state));
    if (exact) return exact;
  }
  return list.find((e) => !e.state) || (list.length === 1 ? list[0] : null);
}

// Choix de l'unité cible pour un système d'affichage. Retourne null si l'unité d'origine est déjà dans le système.
export function targetUnitFor(unitId, system) {
  const u = getUnit(unitId);
  if (!u || system === 'original') return null;
  if (u.dimension === 'temperature') return system === 'us' ? (unitId === 'celsius' ? 'fahrenheit' : null) : (unitId === 'fahrenheit' ? 'celsius' : null);
  if (u.dimension === 'mass') return system === 'metric' ? (['oz_mass', 'lb'].includes(unitId) ? 'g' : null) : (['g', 'kg', 'mg'].includes(unitId) ? 'oz_mass' : null);
  if (u.dimension === 'volume') {
    if (system === 'metric') return ['cup', 'tbsp', 'tsp', 'fl_oz'].includes(unitId) ? 'ml' : null;
    if (system === 'us') return ['ml', 'l', 'dl', 'cl'].includes(unitId) ? 'cup' : null;
  }
  return null;
}

// Affiche une quantité (ingrédient) dans le système souhaité, avec hypothèses visibles.
// Retourne { text, unit_id, converted: bool, assumptions: [], estimate, blocked?: reason, source_text }
export function displayQuantity(quantity, unitId, ctx = {}) {
  const system = ctx.system || 'original';
  const locale = ctx.locale || 'fr';
  const base = (s) => (s || '').trim();
  const original = { text: `${formatQuantity(quantity, { locale })}${unitId ? ' ' + unitLabel(unitId, locale) : ''}`.trim(), unit_id: unitId, converted: false, assumptions: [], estimate: false };
  if (!isNumeric(quantity) || !unitId) return original;
  const target = targetUnitFor(unitId, system);
  if (!target) return original;
  const conv = (v) => convertValue(v, unitId, target, { ...ctx, target_convention_id: system === 'us' ? 'us_customary' : ctx.convention_id });
  let res;
  if (typeof quantity.value === 'number') res = conv(quantity.value);
  else res = conv(quantity.min);
  if (!res.ok) return { ...original, blocked: res.reason, missing: res.missing };
  let text;
  const unit = niceUnit(res.value, target);
  if (typeof quantity.value === 'number') text = `${formatNumber(unit.value, { locale, fractions: system === 'us' })} ${unitLabel(unit.unit_id, locale)}`;
  else {
    const hi = conv(quantity.max);
    const u2 = niceUnit(hi.value, target);
    text = `${formatNumber(unit.value, { locale, fractions: system === 'us' })}–${formatNumber(u2.value, { locale, fractions: system === 'us' })} ${unitLabel(unit.unit_id, locale)}`;
  }
  return { text: base(text), unit_id: unit.unit_id, converted: true, assumptions: res.assumptions, estimate: res.estimate, source_text: original.text };
}

function niceUnit(value, unitId) {
  if (unitId === 'ml' && value >= 1000) return { value: value / 1000, unit_id: 'l' };
  if (unitId === 'g' && value >= 1000) return { value: value / 1000, unit_id: 'kg' };
  if (unitId === 'cup' && value < 0.25) {
    const tbsp = value * 16; // dans la convention us_customary, 1 cup = 16 tbsp
    if (tbsp < 1) return { value: tbsp * 3, unit_id: 'tsp' };
    return { value: tbsp, unit_id: 'tbsp' };
  }
  if (unitId === 'oz_mass' && value >= 16) return { value: value / 16, unit_id: 'lb' };
  return { value, unit_id: unitId };
}

export const REASON_LABELS = {
  convention_required: 'Convention de tasses/cuillères non confirmée pour cette édition',
  convention_incomplete: 'Convention incomplète pour cette unité',
  ingredient_required: 'Ingrédient non identifié : conversion volume↔masse impossible',
  equivalence_required: 'Aucune équivalence documentée volume↔masse pour cet ingrédient',
  not_convertible: 'Mesure d’origine conservée (non convertible)',
  unit_unknown: 'Unité inconnue',
  no_numeric_value: 'Quantité non numérique',
};
