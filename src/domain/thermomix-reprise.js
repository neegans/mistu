// Un ancien plan reste documentaire. Les usages repartent uniquement d'une version réelle relue.
import { empreinteThermomix, lireThermomix } from './thermomix.js';
import { lireSourceSansThermomix } from './version-personnelle.js';

export async function resoudreVersionThermomix(version, { lire }) {
  const affichee = structuredClone(version);
  const courante = await lire(affichee?.id);
  if (!courante || courante.id !== affichee?.id || courante.recipe_id !== affichee.recipe_id) return { ok: false, raison: 'source_absente' };
  if (JSON.stringify(courante) !== JSON.stringify(affichee)) return { ok: false, raison: 'source_modifiee' };
  const lu = lireThermomix(courante);
  if (!lu || lu.ok) return { ok: true, version: structuredClone(courante), repli: null, ancetres: [structuredClone(courante)] };
  if (lu.etat !== 'a_revoir') return { ok: false, raison: lu.raison };
  let invalide = null, enfant = null;
  const source = await lireSourceSansThermomix(courante, { lire: async id => {
    const row = await lire(id), plan = lireThermomix(row);
    if (plan && !plan.ok && plan.etat !== 'a_revoir') { invalide = plan.raison; return null; }
    if (enfant && row?.id === id && row.recipe_id === courante.recipe_id) {
      try {
        if (empreinteThermomix(row, { incomplete: enfant.source.incomplete }) !== enfant.source_signature) { invalide = 'source_modifiee'; return null; }
      } catch { invalide = 'source_modifiee'; return null; }
    }
    enfant = plan?.ok ? plan.contexte : plan?.document?.contexte;
    return row;
  } });
  if (invalide) return { ok: false, raison: invalide };
  if (!source.ok) return source;
  return { ok: true, version: source.source, repli: { version_id: courante.id, motifs: [...lu.motifs] }, ancetres: source.ancetres };
}

export function gardesAscendanceThermomix(ancetres = []) {
  const captures = new Map();
  for (const row of ancetres) {
    if (typeof row?.id !== 'string' || !row.id) throw new Error('source_modifiee');
    const valeur = JSON.stringify(row);
    if (captures.has(row.id) && captures.get(row.id) !== valeur) throw new Error('source_modifiee');
    captures.set(row.id, valeur);
  }
  return [...captures].map(([key, valeur]) => ({ key, fusion: courante => {
    if (JSON.stringify(courante) !== valeur) throw new Error('source_modifiee');
    return null;
  } }));
}
