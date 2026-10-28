// Lot I2 : dates, textes et photos personnels. Aucun DOM, aucune écriture, aucune déduction culinaire.
import { HASH } from '../model/schema.js';

export const LIMITES_CUISSON = Object.freeze({ photos: 6, texte: 10000, portions: 1000, minutes: 10080 });
const chaine = (v) => typeof v === 'string' ? v : '';
const controles = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}]/gu;
const pad = (n) => String(n).padStart(2, '0');
const civil = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const aujourdHui = (instant = new Date()) => {
  const d = instant instanceof Date ? instant : new Date(instant);
  return Number.isFinite(d.getTime()) ? civil(d) : null;
};

export function dateCivileValide(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, j] = v.split('-').map(Number);
  if (a < 1000 || a > 9999) return false;
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

// Une date civile ne passe jamais par Date.parse (qui la traite comme minuit UTC).
export function dateCuisson(v) {
  if (dateCivileValide(v)) return v;
  if (typeof v !== 'string' || v.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !dateCivileValide(v.slice(0, 10))) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? civil(d) : null;
}

export function comparerCuissons(a, b) {
  for (const [x, y] of [[dateCuisson(a?.cooked_at) || '', dateCuisson(b?.cooked_at) || ''], [chaine(a?.created_at), chaine(b?.created_at)], [chaine(a?.id), chaine(b?.id)]]) {
    if (x !== y) return x > y ? -1 : 1;
  }
  return 0;
}

export function photosDeCuisson(h) {
  return Array.isArray(h?.photos) ? [...new Set(h.photos.filter(s => typeof s === 'string' && HASH.test(s)))].slice(0, LIMITES_CUISSON.photos) : [];
}

export function photosPersonnellesParRecette(history = []) {
  const choix = new Map();
  for (const h of (Array.isArray(history) ? history : [])) {
    if (typeof h?.recipe_id !== 'string' || !dateCuisson(h.cooked_at)) continue;
    const photos = photosDeCuisson(h);
    if (!photos.length) continue;
    const ancienne = choix.get(h.recipe_id);
    if (!ancienne || comparerCuissons(h, ancienne.cuisson) < 0) choix.set(h.recipe_id, { sha256: photos[photos.length - 1], cuisson_id: h.id, cooked_at: h.cooked_at, cuisson: h });
  }
  return choix;
}

export function photoPrincipale(recipe, historyOuMap = []) {
  const index = historyOuMap instanceof Map ? historyOuMap : photosPersonnellesParRecette(historyOuMap);
  const personnelle = index.get(recipe?.id);
  if (personnelle && typeof personnelle.sha256 === 'string' && HASH.test(personnelle.sha256)) return { sha256: personnelle.sha256, personnelle: true, cuisson_id: personnelle.cuisson_id };
  return typeof recipe?.photo_sha256 === 'string' && HASH.test(recipe.photo_sha256) ? { sha256: recipe.photo_sha256, personnelle: false, cuisson_id: null } : null;
}

export class ErreurCuisson extends Error {
  constructor(code, champ = null, courant = null) { super(code); this.name = 'ErreurCuisson'; this.code = code; this.champ = champ; this.courant = courant; }
}
export const textePersonnel = (v) => [...chaine(v).replace(controles, '')].slice(0, LIMITES_CUISSON.texte).join('');
export function validerTextePersonnel(v) {
  if (typeof v !== 'string' || [...v].length > LIMITES_CUISSON.texte) throw new ErreurCuisson('texte', 'notes');
  return v.replace(controles, '').trim();
}

function nombreOptionnel(v, max, entier, champ) {
  if (v === '' || v == null) return null;
  if (typeof v !== 'number' && (typeof v !== 'string' || !/^\d+(?:\.\d+)?$/.test(v))) throw new ErreurCuisson('nombre', champ);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max || (entier && !Number.isInteger(n)) || (champ === 'servings' && n === 0)) throw new ErreurCuisson('nombre', champ);
  return n;
}
export function validerCuisson(f, { aujourdHui: jour = aujourdHui() } = {}) {
  if (!f || !dateCivileValide(f.date) || !dateCivileValide(jour) || f.date > jour) throw new ErreurCuisson('date', 'date');
  const photos = f.photos ?? [];
  if (!Array.isArray(photos) || photos.length > LIMITES_CUISSON.photos || photos.some(s => typeof s !== 'string' || !HASH.test(s))) throw new ErreurCuisson('photos', 'photos');
  const rating = f.rating === '' || f.rating === 0 || f.rating == null ? null : f.rating;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new ErreurCuisson('note', 'rating');
  if (f.redo != null && typeof f.redo !== 'boolean') throw new ErreurCuisson('note', 'redo');
  return {
    cooked_at: f.date, notes: validerTextePersonnel(f.notes ?? ''), photos: [...new Set(photos)],
    servings: nombreOptionnel(f.servings, LIMITES_CUISSON.portions, false, 'servings'),
    actual_minutes: nombreOptionnel(f.actual, LIMITES_CUISSON.minutes, true, 'actual'), rating, redo: f.redo ?? null,
  };
}
