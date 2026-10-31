// I3 : la quantité demandée reste distincte d'une valeur absente, notamment pour les portions inconnues.
import { estThermomix, gardeThermomix } from './thermomix.js';
import { gardesAscendanceThermomix } from './thermomix-reprise.js';

export function portionsSession(session, version) {
  if (session.servings_by_version && Object.hasOwn(session.servings_by_version, version.id)) return session.servings_by_version[version.id];
  if (Object.hasOwn(session, 'servings')) return session.servings;
  return version.servings ?? null;
}

export function portionsRepas(item, meal) {
  if (item.servings_custom === false) return meal.servings ?? null;
  if (Object.hasOwn(item, 'servings')) return item.servings ?? null;
  return meal.servings ?? null;
}

// Validation sur les versions relues ; les conditions empêchent une mutation entre la garde et l'écriture locale.
export async function enregistrerSessionCuisine(session, { repo, recettes = [], versionsAffichees, repasAffiche = null, ancetresThermomix = [] }) {
  session = structuredClone(session);
  const sources = versionsAffichees === undefined ? null : new Map(structuredClone(versionsAffichees).map(v => [v.id, v]));
  const repas = repasAffiche ? structuredClone(repasAffiche) : null;
  const ascendance = gardesAscendanceThermomix(ancetresThermomix);
  const conditions = [];
  for (const id of new Set(session.selected_version_ids)) {
    const version = await repo.get('recipe_versions', id);
    if (!version) throw new Error('version_absente');
    if (sources && (!sources.has(id) || JSON.stringify(version) !== JSON.stringify(sources.get(id)))) throw new Error('version_modifiee');
    const garde = gardeThermomix(version, portionsSession(session, version));
    if (!garde.ok) throw new Error('thermomix_invalide');
    const relue = JSON.stringify(version);
    conditions.push({ key: id, verifier: c => {
      if (JSON.stringify(c) !== relue) throw new Error(estThermomix(version) ? 'thermomix_modifie' : 'version_modifiee');
    } });
  }
  // Les conditions de repo sont des fusions sans modification : aucun écrasement de la version.
  const gardes = conditions.map(({ key, verifier }) => ({ key, fusion: c => { verifier(c); return null; } }));
  for (const garde of ascendance) {
    const precedente = gardes.find(c => c.key === garde.key);
    if (!precedente) gardes.push(garde);
    else {
      const fusion = precedente.fusion;
      precedente.fusion = c => { fusion(c); return garde.fusion(c); };
    }
  }
  await repo.saveBatch({ cook_sessions: [session] }, { recettes, conditions: { recipe_versions: gardes,
    ...(repas ? { meals: [{ key: repas.id, fusion: courant => { if (JSON.stringify(courant) !== JSON.stringify(repas)) throw new Error('repas_modifie'); return null; } }] } : {}) } });
  return session;
}
