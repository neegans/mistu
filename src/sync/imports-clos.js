// Arbitrage ciblé des propositions payées. La clôture connue prime ; la copie perdante reste documentaire.
import { sha256Hex } from '../core/hash.js';
import { syncNow } from './clock.js';

const TYPES = ['thermomix', 'reperes'];
const rang = row => row?.status === 'enregistre' ? 2 : row?.status === 'ignore' ? 1 : 0;
const canon = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const memeIdentite = (a, b) => !!a && !!b && TYPES.includes(a.kind) && a.kind === b.kind && typeof a.id === 'string'
  && a.id === b.id && typeof a.recipe_id === 'string' && a.recipe_id.length > 0 && a.recipe_id === b.recipe_id;

export const fermetureImportProtegee = (courante, copie) => memeIdentite(courante, copie) && rang(courante) > rang(copie);
export const importConcerne = row => TYPES.includes(row?.kind);
export const gardeImportRelu = attendu => current => {
  if (canon(current ?? null) !== canon(attendu ?? null)) throw new Error('import_modifie_pendant_sync');
  return null;
};

export async function preparerFermetureImport(locale, distante, userId) {
  if (distante?.deleted_at || !memeIdentite(locale, distante?.data) || rang(locale) === rang(distante.data)) return null;
  const localGagne = rang(locale) > rang(distante.data);
  const gagnante = localGagne ? locale : { ...distante.data, updated_at: distante.updated_at };
  if (!rang(gagnante)) return null;
  const perdante = localGagne ? distante.data : locale;
  // L'heure d'enveloppe peut être normalisée par SQL ; elle ne crée pas une deuxième copie du même résultat.
  const { updated_at: _at, ...contenu } = perdante;
  const empreinte = await sha256Hex(new Blob([canon(contenu)]));
  const copie = { id: `imports:${locale.id}:cloture:${empreinte}`, store: 'imports', record_id: locale.id,
    kind: 'import_cloture', local: structuredClone(gagnante),
    server: { data: structuredClone(perdante), updated_at: localGagne ? distante.updated_at : locale.updated_at, deleted_at: null },
    at: syncNow(), user_id: userId };
  const dateDistante = Date.parse(distante.updated_at), dateLocale = Date.parse(locale.updated_at);
  // Une fermeture déjà plus récente a son envoi ou son accusé ; les anciens échos n'en fabriquent pas un autre.
  const renvoyer = localGagne && Number.isFinite(dateDistante) && (!Number.isFinite(dateLocale) || dateDistante >= dateLocale);
  const row = renvoyer ? { ...gagnante, updated_at: new Date(Math.max(Date.parse(syncNow()), dateDistante + 1)).toISOString() } : gagnante;
  return { row, copie, renvoyer, entree: renvoyer ? { user_id: userId, store: 'imports', id: locale.id, op: 'put', updated_at: row.updated_at, tries: 0 } : null };
}
