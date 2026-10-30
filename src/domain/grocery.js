// Liste de courses : consolidation des ingrédients identiques aux unités compatibles ; quantités par recette conservées (spec §26.6).
// Bouillon et eau ne sont pas fusionnés (identités distinctes) ; aucune addition entre dimensions sans conversion justifiée.
import { scaleVersion } from './scaling.js';
import { unitFactor, dimensionOf, unitLabel, getUnit } from './units.js';
import { formatNumber, formatQuantity, isNumeric } from './quantity.js';
import { normalizeText } from './units.js';
import { snapshotConvention } from './repas-courses.js';

// items: [{ version, servings, title, convention_id }]
export function buildShoppingList(items, ingredientsById, { locale = 'fr' } = {}) {
  const groups = new Map(); // clé : ingredient_id ou name:<texte normalisé>
  for (const it of items) {
    const scaled = scaleVersion(it.version, Object.hasOwn(it,'servings') ? it.servings : it.version.servings);
    for (const ri of scaled.ingredients) {
      // N-9 : seule une ligne vérifiée se regroupe par identité ; une ligne non vérifiée, par le texte écrit (l'identité n'est que proposée).
      const identite = ri.ingredient_id && ri.verification_state === 'verified' ? ri.ingredient_id : null;
      const key = identite ? `ing:${identite}` : `name:${normalizeText(ri.name_text || ri.source_text)}`;
      if (!groups.has(key)) {
        const ing = identite ? ingredientsById.get(identite) : null;
        groups.set(key, {
          key, ingredient_id: identite,
          label: ing ? (ing.labels?.[locale]?.label || ing.labels?.fr?.label) : (ri.name_text || ri.source_text),
          entries: [], totals: [], notes: [], checked: false,
        });
      }
      const g = groups.get(key);
      g.entries.push({
        recipe_title: it.title, source_text: ri.source_text, quantity: ri.quantity, unit_id: ri.unit_id, optional: !!ri.optional,
        display: `${formatQuantity(ri.quantity, { locale })} ${ri.unit_id ? unitLabel(ri.unit_id, locale) : ri.unit_text || ''}`.trim(),
        scaled: !!ri.scaled, documentaire: !scaled.ok, recipe_id:it.version.recipe_id, recipe_version_id:it.version.id, servings:it.servings??null, convention_id: it.convention_id || null, ...(Object.hasOwn(it,'convention_snapshot')?{convention_snapshot:snapshotConvention(it.convention_snapshot)}:{}),
      });
    }
  }
  for (const g of groups.values()) consolidate(g, locale);
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
}

function consolidate(group, locale) {
  const buckets = new Map(); // dimension|unit -> { value, unit_id, entries }
  for (const e of group.entries) {
    if (e.documentaire) { group.notes.push(`${e.recipe_title} : ${e.display || e.source_text} — Quantités d’origine, portions non ajustées`); continue; }
    if (!isNumeric(e.quantity) || !e.unit_id) { group.notes.push(`${e.recipe_title} : ${e.display || e.source_text} (non additionnable)`); continue; }
    const dim = dimensionOf(e.unit_id);
    const value = typeof e.quantity.value === 'number' ? e.quantity.value : e.quantity.max; // plage : borne haute pour les achats
    if (dim === 'mass' || dim === 'volume') {
      const unit=getUnit(e.unit_id),snapshot=e.convention_snapshot;
      const f = unit?.convention_dependent&&Object.hasOwn(e,'convention_snapshot') ? snapshot?.values?.[e.unit_id] ? {factor:snapshot.values[e.unit_id]} : {error:'convention_required'} : unitFactor(e.unit_id, e.convention_id);
      if (f.error) { group.notes.push(`${e.recipe_title} : ${e.display} — ${f.error === 'convention_required' ? 'convention de mesure non confirmée' : 'unité non convertible'}`); continue; }
      const key = dim;
      const b = buckets.get(key) || { value: 0, unit_id: dim === 'mass' ? 'g' : 'ml', dim, n: 0 };
      b.value += value * f.factor; b.n += 1;
      buckets.set(key, b);
    } else {
      const key = `count:${e.unit_id}`;
      const b = buckets.get(key) || { value: 0, unit_id: e.unit_id, dim: 'count', n: 0 };
      b.value += value; b.n += 1;
      buckets.set(key, b);
    }
  }
  for (const b of buckets.values()) {
    let value = b.value, unit_id = b.unit_id;
    if (unit_id === 'g' && value >= 1000) { value /= 1000; unit_id = 'kg'; }
    if (unit_id === 'ml' && value >= 1000) { value /= 1000; unit_id = 'l'; }
    group.totals.push({ value, unit_id, text: `${formatNumber(value, { locale, fractions: b.dim === 'count' })} ${unitLabel(unit_id, locale)}`, dimension: b.dim });
  }
  if (buckets.size > 1) group.notes.push('Quantités de dimensions différentes conservées séparément.');
}

export function shoppingListToText(list, locale = 'fr') {
  const lines = [];
  for (const g of list) {
    const totals = g.totals.map((t) => t.text).join(' + ');
    lines.push(`${g.checked ? '[x]' : '[ ]'} ${g.label}${totals ? ` — ${totals}` : ''}`);
    for (const n of g.notes) lines.push(`    · ${n}`);
  }
  return lines.join('\n');
}

// Copier et Partager utilisent les mêmes cases et le même choix, sans modifier la liste métier.
export function preparerSortieCourses(rows, checked = {}, mode = 'restants') {
  const toutes = rows.map(row => ({ ...row, checked: !!checked?.[row.key] }));
  const retenues = mode === 'complet' ? toutes : toutes.filter(row => !row.checked);
  return { nombre: retenues.length, texte: shoppingListToText(retenues) };
}

export { getUnit };
