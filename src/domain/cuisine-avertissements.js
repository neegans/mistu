import { t } from '../core/i18n.js';

// Rappels documentaires : uniquement les attentes écrites et les durées de la version choisie.
// Aucun temps n'est estimé ; une étape produit au plus une ligne, même avec plusieurs minuteries.
export function avertissementsAvantCuisson(items) {
  const lignes = [];
  const attente = /\bla\s+veille\b|\bovernight\b|\btoute\s+une\s+nuit\b|\b\d+\s*h(?:eures?)?\s+de\s+(?:repos|marinade)\b|\bréfrigérer\s+\d+\s*h(?:eures?)?\b/i;
  for (const { recipe, version } of (Array.isArray(items) ? items : []).filter(item => item?.recipe && item?.version)) {
    const titre = recipe.display_title || recipe.original_title || t('Recette');
    for (const [index, step] of (Array.isArray(version.steps) ? version.steps : []).entries()) {
      if (!step) continue;
      const texte = typeof step.text === 'string' ? step.text : '';
      const longues = (Array.isArray(step.timers) ? step.timers : []).filter(tm => Number.isFinite(tm?.seconds) && tm.seconds >= 3600);
      const ecrite = attente.test(texte);
      if (!ecrite && !longues.length) continue;
      const labels = longues.map(tm => tm.label).filter(label => typeof label === 'string' && label.trim());
      lignes.push(t('{titre} — étape {n} : {texte}', { titre, n: step.position ?? index + 1, texte: ecrite ? texte : labels.join(' ; ') || texte }));
    }
  }
  return lignes;
}
