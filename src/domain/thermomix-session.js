// I3 : la quantité demandée reste distincte d'une valeur absente, notamment pour les portions inconnues.
import { estThermomix, gardeThermomix } from './thermomix.js';

export function portionsSession(session, version) {
  if (session.servings_by_version && Object.hasOwn(session.servings_by_version, version.id)) return session.servings_by_version[version.id];
  if (Object.hasOwn(session, 'servings')) return session.servings;
  return version.servings ?? null;
}

export function portionsRepas(item, meal) {
  if (estThermomix(item.version) && item.servings_custom) return item.servings ?? null;
  return item.servings ?? meal.servings ?? null;
}

// Validation sur les versions relues ; les conditions empêchent une mutation entre la garde et l'écriture locale.
export async function enregistrerSessionCuisine(session, { repo, recettes = [] }) {
  const conditions = [];
  for (const id of new Set(session.selected_version_ids)) {
    const version = await repo.get('recipe_versions', id);
    if (!version) throw new Error('version_absente');
    const garde = gardeThermomix(version, portionsSession(session, version));
    if (!garde.ok) throw new Error('thermomix_invalide');
    if (estThermomix(version)) {
      const relue = JSON.stringify(version);
      conditions.push({ key: id, verifier: c => {
        if (JSON.stringify(c) !== relue) throw new Error('thermomix_modifie');
      } });
    }
  }
  // Les conditions de repo sont des fusions sans modification : aucun écrasement de la version.
  const gardes = conditions.map(({ key, verifier }) => ({ key, fusion: c => { verifier(c); return null; } }));
  await repo.saveBatch({ cook_sessions: [session] }, { recettes, conditions: { recipe_versions: gardes } });
  return session;
}
