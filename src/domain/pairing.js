// Accompagnements et accords (spec §26–27) : vraies recettes de la bibliothèque, contraintes strictes appliquées avant
// le classement, explication tirée des données disponibles. Règles éditoriales versionnées et présentées comme propositions.
import { searchDocs } from './search.js';
import { lireTemps, formaterDureeReperes } from './reperes.js';
import { t } from '../core/i18n.js';

export const PAIRING_RULES_VERSION = 1;

// Profils simples par identifiants d'ingrédients (ensemble fermé, versionné).
const SALTY_ACID = new Set(['ing_black_olive', 'ing_caper', 'ing_anchovy', 'ing_canned_tomato', 'ing_feta', 'ing_soy_sauce']);
const FRESH_CRUNCH = new Set(['ing_cucumber', 'ing_lettuce', 'ing_arugula', 'ing_fennel_bulb', 'ing_celery', 'ing_carrot', 'ing_red_onion', 'ing_mint', 'ing_parsley', 'ing_dill', 'ing_coriander_leaves']);
const CITRUS = new Set(['ing_lemon', 'ing_lime', 'ing_wine_vinegar']);
const RICH = new Set(['ing_cream', 'ing_butter', 'ing_parmesan', 'ing_egg']);

function has(doc, set) { for (const id of doc.ingredientIds) if (set.has(id)) return true; return false; }
function count(doc, set) { let n = 0; for (const id of doc.ingredientIds) if (set.has(id)) n++; return n; }

// Candidats : rôle demandé (type), même catalogue et mêmes filtres que la recherche libre.
export function findAccompaniments({ mainDoc, docs, type, parsed, ingredientsById, mode = 'all', feedback = [] }) {
  const p = { ...parsed, filters: { ...parsed.filters, type } };
  const groups = searchDocs(docs.filter((d) => d.recipe.id !== mainDoc?.recipe.id), p, { mode, ingredientsById });
  const likedPairs = new Map();
  for (const f of feedback) if (f.kind === 'pair' && f.liked && mainDoc && f.recipe_ids?.includes(mainDoc.recipe.id)) {
    for (const rid of f.recipe_ids) if (rid !== mainDoc.recipe.id) likedPairs.set(rid, f);
  }
  const rank = (hit) => {
    const d = hit.doc;
    let s = hit.score;
    const why = [];
    if (mainDoc) {
      const mainSalty = count(mainDoc, SALTY_ACID);
      if (mainSalty >= 2 && has(d, FRESH_CRUNCH) && !has(d, SALTY_ACID)) { s += 3; why.push({ text: 'Apporte du croquant et de la fraîcheur sans accumuler le sel et l’acidité déjà présents dans le plat.', origin: 'principe culinaire proposé' }); }
      else if (mainSalty >= 2 && has(d, SALTY_ACID)) { s -= 2; why.push({ text: 'Ajoute encore des ingrédients salés ou acides : à doser si tu la choisis.', origin: 'principe culinaire proposé' }); }
      if (has(mainDoc, RICH) && has(d, CITRUS) && !has(mainDoc, CITRUS)) { s += 2; why.push({ text: 'Une note acidulée qui allège un plat riche.', origin: 'principe culinaire proposé' }); }
      if (has(mainDoc, CITRUS) && count(d, CITRUS) >= 1 && has(d, FRESH_CRUNCH)) why.push({ text: 'Le plat est déjà citronné : privilégie une vinaigrette douce.', origin: 'principe culinaire proposé' });
    }
    const active = lireTemps(d.recipe, d.version).actif;
    if (active && active.max <= 15) { s += 1; why.push({ text: t('Temps actif : {d}.', { d: formaterDureeReperes(active) }), origin: active.origine === 'estimation_ia' ? t('Estimation IA') : active.origine === 'manuel' ? t('Corrigé par toi') : t('Indiqué dans la source') }); }
    if (d.cooked) { s += 0.5; why.push({ text: `Déjà cuisinée ${d.cooked} fois.`, origin: 'ton historique' }); }
    const liked = likedPairs.get(d.recipe.id);
    if (liked) { s += 4; why.push({ text: `Tu as aimé ce duo le ${new Date(liked.created_at).toLocaleDateString('fr-CA')}.`, origin: 'essai personnel' }); }
    if (!why.length) why.push({ text: 'Aucun élément probant enregistré : suggestion à essayer.', origin: 'aucune preuve' });
    return { ...hit, rank: s, why };
  };
  const ranked = (list) => diversify(list.map(rank).sort((a, b) => b.rank - a.rank));
  return { admissible: ranked(groups.admissible), to_verify: ranked(groups.to_verify), adaptation: ranked(groups.adaptation), time_unknown: ranked(groups.time_unknown), references: groups.references, incompatible: groups.incompatible, excluded_by_time: groups.excluded_by_time };
}

// Évite trois propositions quasi identiques (même ingrédient dominant) dans le trio de tête.
function diversify(list) {
  const out = [];
  const seen = new Set();
  const rest = [];
  for (const hit of list) {
    const key = [...hit.doc.ingredientIds].filter((id) => FRESH_CRUNCH.has(id) || RICH.has(id)).sort().slice(0, 2).join('+');
    if (out.length < 3 && key && seen.has(key)) { rest.push(hit); continue; }
    seen.add(key);
    out.push(hit);
  }
  return [...out, ...rest];
}

export function ovenTemps(version) {
  const temps = [];
  const re = /(\d{3})\s*°?\s*([CF])\b/gi;
  for (const s of version?.steps || []) { let m; while ((m = re.exec(s.text))) temps.push({ value: +m[1], unit: m[2].toUpperCase(), step_id: s.id }); }
  return temps;
}

// Résumé d'un repas : temps actif cumulé, durée totale bornée, conflits d'appareils. Aucune addition ou parallélisation aveugle.
export function summarizeMeal(items) {
  const known = items.filter((it) => it.version);
  const times = items.map(it => lireTemps(it.recipe, it.version));
  const actives = times.map((t, i) => items[i].version ? t.actif : null);
  const totals = times.map(t => t.disponible && t.total?.complet && t.attentes_incluses === true ? t.total : null);
  const unknown = items.filter((it, i) => !it.version || totals[i] == null).map((it) => it.title);
  const activeRange = actives.length && actives.every(Boolean) ? { low: actives.reduce((s, a) => s + a.min, 0), high: actives.reduce((s, a) => s + a.max, 0) } : null;
  const activeSum = activeRange?.high ?? null;
  const totalMax = totals.some(Boolean) ? Math.max(...totals.filter(Boolean).map(t => t.max)) : null;
  let estimate = null;
  if (activeRange && totals.length && !unknown.length) {
    const low = Math.max(...totals.map(t => t.min), activeRange.low);
    const high = totals.reduce((s, t) => s + t.max, 0);
    estimate = { low, high: Math.max(high, low) };
  }
  const conflicts = [];
  const temps = known.map((it) => ({ title: it.title, temps: ovenTemps(it.version) })).filter((x) => x.temps.length);
  for (let i = 0; i < temps.length; i++) for (let j = i + 1; j < temps.length; j++) {
    const a = temps[i].temps[0], b = temps[j].temps[0];
    if (a.unit === b.unit && a.value !== b.value) conflicts.push(`Four : ${temps[i].title} à ${a.value} °${a.unit} et ${temps[j].title} à ${b.value} °${b.unit}. Prévoir un ordre ou un autre accompagnement.`);
  }
  const notes = [];
  if (estimate) notes.push(t('Durée estimée : entre {min} et {max} min selon l’organisation. Chevauchement des tâches à vérifier ({actif} min actives au total).', { min: estimate.low, max: estimate.high, actif: activeRange.low === activeRange.high ? activeSum : `${activeRange.low}–${activeRange.high}` }));
  if (unknown.length) notes.push(t('Durée inconnue pour : {plats}.', { plats: unknown.join(', ') }));
  if (items.length && !activeRange) notes.push(t('Temps actif total inconnu.'));
  return { estimate, activeSum, activeRange, totalMax, unknown, conflicts, notes, estimated: !!estimate };
}
