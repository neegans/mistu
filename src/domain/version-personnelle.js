// Retour explicite à une version réellement conservée : un snapshot du plan TM7 n'est pas une source de repli.
import { estThermomix } from './thermomix.js';

export async function lireSourceSansThermomix(version, { lire }) {
  const vus = new Set(), ancetres = [];
  let id = version?.id;
  while (typeof id === 'string' && id && ancetres.length < 1000) {
    if (vus.has(id)) return { ok: false, raison: 'boucle' };
    vus.add(id);
    const row = await lire(id);
    if (!row || row.id !== id || row.recipe_id !== version.recipe_id) return { ok: false, raison: 'source_absente' };
    // La version montrée à l'ouverture doit encore être celle à laquelle l'ascendance se rattache.
    if (!ancetres.length && JSON.stringify(row) !== JSON.stringify(version)) return { ok: false, raison: 'source_modifiee' };
    ancetres.push(structuredClone(row));
    if (!estThermomix(row)) {
      if (!Array.isArray(row.steps) || !row.steps.length || row.steps.some(s => typeof s?.text !== 'string')) return { ok: false, raison: 'source_absente' };
      return { ok: true, source: structuredClone(row), ancetres };
    }
    id = row.parent_version_id;
  }
  return { ok: false, raison: 'source_absente' };
}
