// Portions : recalcul déterministe des quantités compatibles ; les durées, températures et capacités ne sont jamais multipliées (spec §6, §29.2).
import { scaleQuantity, isNumeric } from './quantity.js';

export function scaleVersion(version, targetServings) {
  const base = Number(version?.servings);
  const target = Number(targetServings);
  if (!base || !target || base <= 0 || target <= 0) {
    return { ok: false, reason: 'servings_unknown', factor: null, servings: targetServings, ingredients: version?.ingredients || [], notes: ['Portions d’origine inconnues : quantités affichées telles quelles'] };
  }
  const factor = target / base;
  const ingredients = (version.ingredients || []).map((ri) => ({
    ...ri,
    quantity: isNumeric(ri.quantity) ? scaleQuantity(ri.quantity, factor) : ri.quantity,
    scaled: isNumeric(ri.quantity) && factor !== 1,
  }));
  const notes = [];
  if (factor !== 1) {
    notes.push('Durées, températures et temps de repos inchangés : ils ne se multiplient pas avec les portions.');
    const qualitative = ingredients.filter((i) => i.quantity && i.quantity.qualitative).length;
    if (qualitative) notes.push(`${qualitative} quantité(s) qualitative(s) (« au goût ») laissée(s) à ton appréciation.`);
    if (factor > 1.5) notes.push('Vérifie la capacité des appareils et des contenants pour cette quantité.');
  }
  return { ok: true, factor, servings: target, base_servings: base, ingredients, notes };
}
