// Évaluation alimentaire d'une version précise (spec §26.5) : compatible / adaptation / à vérifier / incompatible.
// Une information manquante n'est jamais assimilée à une absence d'allergène. Aucune certification de produit ni de préparation.
import { DIET_RULES } from '../model/seed.js';

export const DIET_RULE_VERSION = 1;

export function assessVersion(version, ingredientsById, dietTag) {
  const rule = DIET_RULES[dietTag];
  if (!rule) return { state: 'to_verify', reason: 'Règle inconnue', examined: 0, unknown: [], blocking: [], rule_version: DIET_RULE_VERSION };
  const blocking = [];
  const unknown = [];
  const examined = [];
  for (const ri of version.ingredients || []) {
    const ing = ri.ingredient_id ? ingredientsById.get(ri.ingredient_id) : null;
    if (!ing) { unknown.push(ri.source_text || ri.name_text || '?'); continue; }
    if (!Array.isArray(ing.contains)) { unknown.push(ri.source_text || ing.labels?.fr?.label || ing.id); continue; }
    const hit = ing.contains.filter((c) => rule.blocked.includes(c));
    // N-8 (règle asymétrique, R-CRE-1) : une identité proposée par le parseur n'est pas une identité vérifiée. Sans correspondance
    // bloquante, une ligne non vérifiée ne certifie rien : elle est inconnue (le libellé « selon les ingrédients vérifiés » reste vrai).
    // Avec une correspondance bloquante, elle bloque TOUJOURS (jamais assoupli : un faux positif prudent vaut mieux qu'un faux « compatible »).
    if (!hit.length && ri.verification_state !== 'verified') { unknown.push(ri.source_text || ri.name_text || '?'); continue; }
    examined.push(ing.id);
    if (hit.length) blocking.push({ ingredient_id: ing.id, label: ing.labels?.fr?.label || ing.id, categories: hit, optional: !!ri.optional, source_text: ri.source_text, proposed: ri.verification_state !== 'verified' });
  }
  let state;
  if (blocking.some((b) => !b.optional)) state = 'incompatible';
  // Seuls des ingrédients facultatifs bloquent : retirable explicitement — mais jamais en masquant une ligne inconnue (R-CRE-9 : une information
  // manquante n'est pas assimilée à une absence ; retirer le facultatif ne suffit pas à conclure tant qu'une ligne reste à vérifier).
  else if (blocking.length) state = unknown.length ? 'to_verify' : 'adaptation';
  else if (unknown.length) state = 'to_verify';
  else state = 'compatible';
  if (!(version.ingredients || []).length) state = 'to_verify';
  return { state, diet: dietTag, examined: examined.length, unknown, blocking, rule_version: DIET_RULE_VERSION, version_id: version.id };
}

export function assessMany(version, ingredientsById, dietTags) {
  return (dietTags || []).map((d) => assessVersion(version, ingredientsById, d));
}

// Périmètre d'un repas : le repas entier n'est déclaré compatible que si chaque élément l'est (spec §28 « pâtes au blé + salade sans gluten »).
export function assessMeal(items, ingredientsById, dietTag) {
  const per = items.map((it) => ({ item: it, assessment: assessVersion(it.version, ingredientsById, dietTag) }));
  const states = per.map((p) => p.assessment.state);
  let state = 'compatible';
  if (states.includes('incompatible')) state = 'incompatible';
  else if (states.includes('adaptation')) state = 'adaptation';
  else if (states.includes('to_verify')) state = 'to_verify';
  return { state, per };
}
