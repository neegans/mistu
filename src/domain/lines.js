// Analyse d'une ligne d'ingrédient : texte source conservé, quantité/unité interprétées, ingrédient proposé (à vérifier).
import { extractLeadingQuantity } from './quantity.js';
import { matchUnit, normalizeText } from './units.js';
import { newId } from '../core/ids.js';

let ingredientIndex = null; // [{ alias, ingredient_id, locale, kind }]

export function buildIngredientIndex(ingredients) {
  ingredientIndex = [];
  for (const ing of ingredients) {
    for (const [locale, lab] of Object.entries(ing.labels || {})) {
      if (lab?.label) ingredientIndex.push({ alias: normalizeText(lab.label), ingredient_id: ing.id, locale, kind: 'label' });
      for (const a of lab?.aliases || []) ingredientIndex.push({ alias: normalizeText(a), ingredient_id: ing.id, locale, kind: 'alias' });
    }
  }
  ingredientIndex.sort((a, b) => b.alias.length - a.alias.length);
  return ingredientIndex;
}

function wordBoundaryIncludes(hay, needle) {
  const i = hay.indexOf(needle);
  if (i < 0) return false;
  const before = i === 0 ? ' ' : hay[i - 1];
  const after = i + needle.length >= hay.length ? ' ' : hay[i + needle.length];
  return /[^a-z0-9]/.test(before) && /[^a-z0-9]/.test(after);
}

// Retourne { ingredient_id, matched_alias, locale } ou null. Le plus long alias contenu gagne ; égalité → aucun choix silencieux.
export function matchIngredient(nameText) {
  if (!ingredientIndex) return null;
  const norm = normalizeText(nameText);
  if (!norm) return null;
  let best = null;
  const tied = [];
  for (const entry of ingredientIndex) {
    if (entry.alias.length < 2) continue;
    if (!wordBoundaryIncludes(norm, entry.alias)) continue;
    if (!best) { best = entry; continue; }
    if (entry.alias.length === best.alias.length && entry.ingredient_id !== best.ingredient_id) tied.push(entry);
    else break; // trié par longueur décroissante : le premier match est le plus long
  }
  if (!best) return null;
  if (tied.length) return { ambiguous: true, candidates: [best.ingredient_id, ...tied.map((t) => t.ingredient_id)] };
  return { ingredient_id: best.ingredient_id, matched_alias: best.alias, locale: best.locale };
}

const OPTIONAL_RE = /\((?:facultatif|optionnel|optional|au choix)\)|\bfacultatif\b|\boptional\b/i;

export function parseIngredientLine(text) {
  const source_text = (text || '').trim();
  const out = {
    id: newId('ri'), source_text, quantity: null, unit_id: null, unit_text: '', unit_candidates: null,
    name_text: '', preparation: '', optional: false, ingredient_id: null, verification_state: 'to_verify', evidence: 'parser',
  };
  if (!source_text) return out;
  let { quantity, rest } = extractLeadingQuantity(source_text);
  out.quantity = quantity;
  if (quantity && !quantity.qualitative) {
    const um = matchUnit(rest);
    out.unit_id = um.unit_id;
    out.unit_text = um.unit_text;
    out.unit_candidates = um.candidates || null;
    rest = um.rest;
  }
  if (OPTIONAL_RE.test(rest)) { out.optional = true; rest = rest.replace(OPTIONAL_RE, '').trim(); }
  // Précision entre parenthèses (ex. « (400 g) ») conservée comme préparation/précision
  const paren = /\(([^)]*)\)/.exec(rest);
  if (paren) { out.preparation = paren[1].trim(); rest = rest.replace(paren[0], '').replace(/\s+/g, ' ').trim(); }
  rest = rest.replace(/^(?:de\s+la\s+|de\s+l'|de\s+l’|des\s+|du\s+|de\s+|d'|d’|of\s+)/i, '').trim();
  // « au goût » en fin de ligne → quantité qualitative si aucune quantité numérique
  const tasteMatch = /,?\s*(au goût|au gout|to taste)\s*$/i.exec(rest);
  if (tasteMatch) { rest = rest.slice(0, tasteMatch.index).trim(); if (!out.quantity) out.quantity = { raw: tasteMatch[1], qualitative: true }; }
  const comma = rest.indexOf(',');
  if (comma > 0) { out.preparation = [rest.slice(comma + 1).trim(), out.preparation].filter(Boolean).join('; '); rest = rest.slice(0, comma).trim(); }
  out.name_text = rest.replace(/[.;:]+$/, '').trim();
  const match = matchIngredient(out.name_text || source_text);
  if (match && !match.ambiguous) { out.ingredient_id = match.ingredient_id; out.match_locale = match.locale; }
  else if (match?.ambiguous) out.ingredient_candidates = match.candidates;
  return out;
}

export function parseIngredientBlock(text) {
  return (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(parseIngredientLine);
}

// Étapes : une par ligne ou par paragraphe ; numérotation initiale retirée ; identifiant stable par étape.
// `parParagraphe` (spec import-cible § 4.3.7, N5) : une étape par PARAGRAPHE seulement (ligne vide entre deux étapes), les sauts de ligne
// internes gardés — l'éditeur y passe quand la version de départ a une étape sur plusieurs lignes. Sans l'option, comme avant.
export function parseStepsBlock(text, { parParagraphe = false } = {}) {
  const brut = (text || '').replace(/\r\n?/g, '\n');
  const parts = brut.split(parParagraphe ? /\n\s*\n/ : /\n\s*\n|\n/).map((s) => s.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean);
  return parts.map((body, i) => ({ id: newId('st'), position: i + 1, text: body, ...detectTimers(body) }));
}

// Détection prudente de durées dans une étape (pour proposer une minuterie) : « 8 min », « 1 h 30 », « 10 minutes ».
export function detectTimers(text) {
  const timers = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(?:h(?:eures?|ours?)?|hr)\s*(?:(\d{1,2})\s*(?:min(?:utes?)?)?)?|(\d+(?:[.,]\d+)?)\s*(?:à|-|–|to)?\s*(\d+)?\s*(min(?:utes?)?|minutes?|s(?:ec(?:ondes?)?)?\b)/gi;
  let m;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) {
      const h = parseFloat(m[1].replace(',', '.'));
      const mins = m[2] ? parseInt(m[2], 10) : 0;
      timers.push({ label: m[0].trim(), seconds: Math.round(h * 3600 + mins * 60) });
    } else if (m[3] !== undefined) {
      const a = parseFloat(m[3].replace(',', '.'));
      const b = m[4] ? parseFloat(m[4]) : null;
      const unit = m[5].toLowerCase();
      const mult = unit.startsWith('s') ? 1 : 60;
      timers.push({ label: m[0].trim(), seconds: Math.round(a * mult), seconds_max: b ? Math.round(b * mult) : null });
    }
  }
  // Bornes (S13, R-CRE-8) : une durée absurde n'est jamais « corrigée » : un nombre qui déborde (Infinity), nul ou de plus de 24 h
  // ne produit AUCUN minuteur (aucune durée inventée) ; un `seconds_max` de plus de 24 h devient null (le minuteur garde `seconds`) ;
  // 4 minuteurs au plus par étape.
  const bornes = timers
    .filter((tm) => tm.seconds > 0 && tm.seconds <= 86400) // Infinity et NaN échouent ces comparaisons
    .map((tm) => (tm.seconds_max == null || tm.seconds_max <= 86400 ? tm : { ...tm, seconds_max: null }))
    .slice(0, 4);
  return bornes.length ? { timers: bornes } : {};
}
