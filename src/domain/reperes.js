// Présentation liée à une source culinaire, jamais écrite dans une RecipeVersion.
// Module pur : aucun appel assistant, stockage, DOM ou effet à l'ouverture d'une fiche.
import { estCreationIA } from './creation-ia.js';
import { estThermomix } from './thermomix.js';
export const LIMITES_REPERES = Object.freeze({ description: 400, raison: 300, explication: 800, minutes: 43200,
  ingredients: 100, etapes: 80, ingredient: 2000, etape: 8000, references: 16, extrait: 300,
  sourceOctets: 32 * 1024, contexteOctets: 80 * 1024, enveloppeOctets: 192 * 1024 });
export const NIVEAUX_REPERES = Object.freeze(['facile', 'intermediaire', 'avance', 'chef']);
const CHAMPS = ['description_fr', 'difficulte', 'temps'];
export const CHAMPS_TEMPS_REPERES = Object.freeze(['total', 'actif', 'cuisson', 'attentes', 'attentes_incluses', 'explication']);
const DUREES = ['prep_minutes', 'cook_minutes', 'active_minutes', 'total_minutes'];
const own = (v, k) => !!v && Object.hasOwn(v, k);
const objet = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function erreur(raison) { const e = new Error(raison); e.name = 'ErreurReperes'; e.raison = raison; throw e; }
function ferme(v, cles, requis = cles) {
  if (!objet(v) || Object.keys(v).some(k => !cles.includes(k)) || requis.some(k => !own(v, k))) erreur('structure');
}
function liste(v, max) {
  if (!Array.isArray(v) || v.length > max || Array.from({ length: v.length }, (_, i) => i).some(i => !own(v, i))) erreur('limite');
  return v;
}
function texte(v, max, { vide = false, hostile = false } = {}) {
  if (typeof v !== 'string' || Array.from(v).length > max || (!vide && !v.trim())) erreur('texte');
  const s = v.normalize('NFC').replace(/[\t\r\n\p{Zl}\p{Zp}]/gu, ' ').replace(/ +/g, ' ').trim();
  if (/[\p{Cc}\p{Cf}]/u.test(s)) erreur('texte');
  const compare = s.normalize('NFKC');
  if (hostile && (/[<>]|(?:[a-z][a-z0-9+.-]*:)?\/\/|https?:|www\.|(?:javascript|data|vbscript):|\b[\p{L}\d-]+\.[\p{L}]{2,24}\b|```|\beval\s*\(/iu.test(compare)
    || /(?:sans[ -](?:gluten|lactose|noix|allerg[eè]nes?)|gluten.free|dairy.free|allergen.free|v[eé]g[eé]tari|v[eé]g[eé]tali|\bvegan\b|garanti|sans danger)/iu.test(compare))) erreur('texte_interdit');
  return s;
}
function id(v) { const s = texte(v, 160); if (['__proto__', 'constructor', 'prototype'].includes(s)) erreur('identifiant'); return s; }
function clone(v, depth = 0, budget = { n: 0 }) {
  if (++budget.n > 12000 || depth > 12) erreur('limite');
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') { if (!Number.isFinite(v)) erreur('nombre'); return v; }
  if (Array.isArray(v)) return liste(v, 500).map(x => clone(x, depth + 1, budget));
  if (!objet(v)) erreur('structure');
  const out = {};
  for (const k of Object.keys(v).sort()) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) erreur('structure');
    if (v[k] !== undefined) out[k] = clone(v[k], depth + 1, budget);
  }
  return out;
}
const canon = (v) => JSON.stringify(clone(v));
function borne(v, max, raison = 'limite') { if (new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v)).byteLength > max) erreur(raison); return v; }
function minute(v) { if (!Number.isInteger(v) || v < 0 || v > LIMITES_REPERES.minutes) erreur('minutes'); return v; }
function date(v) { if (typeof v !== 'string' || v.length > 32 || !Number.isFinite(Date.parse(v))) erreur('date'); return new Date(v).toISOString(); }
function projeterIngredient(i) {
  if (!objet(i)) erreur('ingredient');
  const out = {};
  for (const k of ['quantity', 'unit_id', 'unit_text', 'name_text', 'preparation', 'optional', 'group']) if (i[k] != null) out[k] = clone(i[k]);
  return out;
}
function sourceValide(source) {
  ferme(source, ['titre', 'disponibilite', 'incomplete', 'estimation_ia', 'portions', 'ingredients', 'details_ingredients', 'etapes', 'minuteries', 'durees']);
  texte(source.titre, 500); if (!['reference_only', 'partial', 'available'].includes(source.disponibilite) || typeof source.incomplete !== 'boolean') erreur('source');
  if (typeof source.estimation_ia !== 'boolean') erreur('source');
  if (source.portions !== null && (typeof source.portions !== 'number' || !Number.isFinite(source.portions) || source.portions <= 0 || source.portions > 10000)) erreur('portions');
  liste(source.ingredients, LIMITES_REPERES.ingredients).forEach(x => texte(x, LIMITES_REPERES.ingredient, { vide: true }));
  liste(source.etapes, LIMITES_REPERES.etapes).forEach(x => texte(x, LIMITES_REPERES.etape, { vide: true }));
  liste(source.details_ingredients, LIMITES_REPERES.ingredients).forEach(i => { ferme(i, ['quantity', 'unit_id', 'unit_text', 'name_text', 'preparation', 'optional', 'group'], []); clone(i); });
  liste(source.minuteries, LIMITES_REPERES.etapes).forEach(t => liste(t, 30).forEach(x => { ferme(x, ['seconds', 'label'], []); clone(x); }));
  if (source.details_ingredients.length !== source.ingredients.length || source.minuteries.length !== source.etapes.length) erreur('source');
  ferme(source.durees, DUREES); DUREES.forEach(k => { if (source.durees[k] !== null) minute(source.durees[k]); });
  return borne(source, LIMITES_REPERES.sourceOctets, 'contexte_trop_grand');
}
// Représentation canonique complète, bornée et relisible, sans collision de hachage.
export function construireContexteReperes({ recipe, version = null } = {}) {
  if (!objet(recipe)) erreur('source_absente');
  const recipe_id = id(recipe.id), version_id = version == null ? null : id(version.id);
  if (version && version.recipe_id !== recipe_id) erreur('source_etrangere');
  const ingredients = liste(version?.ingredients ?? [], LIMITES_REPERES.ingredients);
  const etapes = liste(version?.steps ?? [], LIMITES_REPERES.etapes);
  const estimation_ia = estCreationIA(version) || estThermomix(version);
  const source = sourceValide({ titre: texte(recipe.original_title || recipe.display_title, 500),
    disponibilite: recipe.availability ?? (version ? 'available' : 'reference_only'),
    incomplete: recipe.availability === 'partial' || recipe.incomplete === true || version?.incomplete === true || version?.provenance?.incomplete === true || version?.provenance?.missing_page === true,
    estimation_ia,
    portions: version?.servings ?? null,
    ingredients: ingredients.map(i => texte(i.source_text || i.name_text || '', LIMITES_REPERES.ingredient, { vide: true })),
    details_ingredients: ingredients.map(projeterIngredient),
    etapes: etapes.map(s => texte(s.text ?? '', LIMITES_REPERES.etape, { vide: true })),
    minuteries: etapes.map(s => liste(s.timers ?? [], 30).map(t => { const out = {}; for (const k of ['seconds', 'label']) if (t[k] != null) out[k] = clone(t[k]); return out; })),
    durees: Object.fromEntries(DUREES.map(k => [k, estimation_ia ? null : version?.[k] ?? null])) });
  const signature = canon({ recipe_id, version_id, source });
  return borne({ revision: 1, recipe_id, version_id, signature, source }, LIMITES_REPERES.contexteOctets, 'contexte_trop_grand');
}
function verifierContexte(contexte) {
  ferme(contexte, ['revision', 'recipe_id', 'version_id', 'signature', 'source']);
  if (contexte.revision !== 1) erreur('revision');
  id(contexte.recipe_id); if (contexte.version_id !== null) id(contexte.version_id);
  sourceValide(contexte.source);
  if (contexte.signature !== canon({ recipe_id: contexte.recipe_id, version_id: contexte.version_id, source: contexte.source })) erreur('signature');
  return borne(contexte, LIMITES_REPERES.contexteOctets, 'contexte_trop_grand');
}
function contexteLiaison(source) {
  ferme(source, ['version_id', 'signature']);
  if (typeof source.signature !== 'string') erreur('signature');
  borne(source.signature, LIMITES_REPERES.contexteOctets);
  let parsed; try { parsed = JSON.parse(source.signature); } catch { erreur('signature'); }
  ferme(parsed, ['recipe_id', 'version_id', 'source']);
  const contexte = verifierContexte({ revision: 1, ...parsed, signature: source.signature });
  if (source.version_id !== contexte.version_id) erreur('signature');
  return contexte;
}
function references(refs, contexte, manuel = false) {
  const arr = liste(refs ?? (manuel ? [] : null), LIMITES_REPERES.references);
  if (!manuel && !arr.length) erreur('references');
  return arr.map(r => {
    ferme(r, ['type', 'index', 'champ', 'extrait'], ['type', 'extrait']);
    const extrait = texte(r.extrait, LIMITES_REPERES.extrait);
    let cible;
    if (r.type === 'titre' && !own(r, 'index') && !own(r, 'champ')) cible = contexte.source.titre;
    else if (['ingredient', 'etape'].includes(r.type) && !own(r, 'champ') && Number.isInteger(r.index) && r.index >= 0) cible = contexte.source[r.type === 'ingredient' ? 'ingredients' : 'etapes'][r.index];
    else if (r.type === 'duree' && !own(r, 'index') && DUREES.includes(r.champ) && contexte.source.durees[r.champ] !== null) cible = String(contexte.source.durees[r.champ]);
    if (typeof cible !== 'string' || !cible.includes(extrait)) erreur('reference_inventee');
    return { type: r.type, ...(own(r, 'index') ? { index: r.index } : {}), ...(own(r, 'champ') ? { champ: r.champ } : {}), extrait };
  });
}
function explicite(duree, nom, refs, contexte) {
  if (contexte.source.estimation_ia) return false;
  const champ = { total: 'total_minutes', actif: 'active_minutes', cuisson: 'cook_minutes' }[nom];
  if (duree.min === duree.max && champ && contexte.source.durees[champ] === duree.min && refs.some(r => r.type === 'duree' && r.champ === champ && r.extrait === String(duree.min))) return true;
  // Une durée citée dans une étape ne prouve pas à elle seule un total ou du travail actif.
  if (!['cuisson', 'attentes'].includes(nom)) return false;
  return refs.some(r => {
    if (r.type !== 'etape') return false;
    const indicateur = nom === 'cuisson' ? /cuire|cuisson|cook|bake|r[oô]tir/i : /repos|reposer|lev[eé]e|lever|marin|refroid|rest|rise|cool/i;
    if (!indicateur.test(r.extrait)) return false;
    // Une plage est consommée entière : sa borne haute ne devient pas une durée exacte.
    const unite = '(?:minutes?|mins?|heures?|hours?|h|jours?|days?)';
    const re = new RegExp('(?<![\\d.,])\\b(\\d+)(?:\\s*(' + unite + ')?\\s*(?:à|a|to|[-–—])\\s*(\\d+))?\\s*(' + unite + ')\\b', 'gi');
    const facteur = u => /^(h|heure|hour)/i.test(u) ? 60 : /^(jour|day)/i.test(u) ? 1440 : 1;
    let m; while ((m = re.exec(r.extrait))) { const min = +m[1] * facteur(m[2] || m[4]), max = m[3] == null ? min : +m[3] * facteur(m[4]); if (min === duree.min && max === duree.max) return true; }
    return false;
  });
}
function duree(v, nom, refs, contexte, manuel) {
  if (v === null) return null;
  ferme(v, ['min', 'max', 'origine', ...(nom === 'total' ? ['complet'] : [])]);
  const min = minute(v.min), max = minute(v.max); if (min > max) erreur('plage');
  if (!['source', 'estimation_ia', ...(manuel ? ['manuel'] : [])].includes(v.origine)) erreur('origine');
  if (nom === 'total' && typeof v.complet !== 'boolean') erreur('complet');
  const corrigee = manuel === true || (Array.isArray(manuel) && manuel.includes(nom));
  if (!corrigee && ((v.origine === 'source' && !explicite(v, nom, refs, contexte)) || (min === 0 && v.origine !== 'manuel' && !explicite(v, nom, refs, contexte)))) erreur('duree_non_sourcee');
  return { min, max, origine: manuel === true || (Array.isArray(manuel) && manuel.includes(nom)) ? 'manuel' : v.origine, ...(nom === 'total' ? { complet: v.complet } : {}) };
}
function champValide(nom, valeur, contexte, manuel = false) {
  if (valeur === null) return null;
  if (nom !== 'description_fr' && !contexte.version_id) erreur('etapes_absentes');
  if (nom === 'description_fr') {
    ferme(valeur, ['texte', 'references'], manuel ? ['texte'] : ['texte', 'references']);
    return { texte: texte(valeur.texte, LIMITES_REPERES.description, { hostile: true }), references: references(valeur.references, contexte, manuel) };
  }
  if (nom === 'difficulte') {
    ferme(valeur, ['niveau', 'raison', 'references'], manuel ? ['niveau', 'raison'] : ['niveau', 'raison', 'references']);
    if (!NIVEAUX_REPERES.includes(valeur.niveau)) erreur('niveau');
    const refs = references(valeur.references, contexte, manuel);
    if (!manuel && (!contexte.version_id || !contexte.source.etapes.some(Boolean) || !refs.some(r => r.type === 'etape'))) erreur('etapes_absentes');
    return { niveau: valeur.niveau, raison: texte(valeur.raison, LIMITES_REPERES.raison, { hostile: true }), references: refs };
  }
  ferme(valeur, ['total', 'actif', 'cuisson', 'attentes', 'attentes_incluses', 'explication', 'references'], ['total', 'actif', 'cuisson', 'attentes', 'attentes_incluses', 'explication', ...(manuel ? [] : ['references'])]);
  if (!manuel && (!contexte.version_id || !contexte.source.etapes.some(Boolean))) erreur('etapes_absentes');
  const refs = references(valeur.references, contexte, manuel);
  const out = Object.fromEntries(['total', 'actif', 'cuisson', 'attentes'].map(k => [k, duree(valeur[k], k, refs, contexte, manuel)]));
  if (![true, false, null].includes(valeur.attentes_incluses)) erreur('attentes');
  if (out.total?.complet && valeur.attentes_incluses !== true) erreur('attentes');
  if (out.total && out.actif && (out.actif.min > out.total.min || out.actif.max > out.total.max)) erreur('actif_incompatible');
  if (out.total?.complet && [out.cuisson, out.attentes].some(d => d && (d.min > out.total.min || d.max > out.total.max))) erreur('total_incompatible');
  if (out.total?.complet && !manuel && contexte.source.incomplete) erreur('source_incomplete');
  const explication = texte(valeur.explication, LIMITES_REPERES.explication, { vide: true, hostile: true });
  if (!manuel && Object.values(out).some(d => d?.origine === 'estimation_ia') && !explication) erreur('explication_absente');
  return { ...out, attentes_incluses: valeur.attentes_incluses, explication, references: refs };
}
export function validerReponseReperes(raw, contexte) {
  verifierContexte(contexte); ferme(raw, CHAMPS);
  return Object.fromEntries(CHAMPS.map(k => [k, champValide(k, raw[k], contexte)]));
}
const liaison = (contexte) => ({ version_id: contexte.version_id, signature: contexte.signature });
export function fabriquerPropositionReperes({ contexte, resultat, modele, maintenant = new Date().toISOString() } = {}) {
  return { source: liaison(verifierContexte(contexte)), ...validerReponseReperes(resultat, contexte), modele: texte(modele, 160), calcule_le: date(maintenant) };
}
export function fabriquerCorrectionsReperes(corrections, contexte, maintenant = new Date().toISOString(), { champsTempsModifies = null, baseTemps = null } = {}) {
  verifierContexte(contexte); ferme(corrections, CHAMPS, []);
  if (champsTempsModifies !== null && (!Array.isArray(champsTempsModifies) || champsTempsModifies.some(k => !CHAMPS_TEMPS_REPERES.includes(k)) || new Set(champsTempsModifies).size !== champsTempsModifies.length)) erreur('structure');
  return Object.fromEntries(Object.keys(corrections).map(k => {
    let valeur = corrections[k], selection = k === 'temps' ? champsTempsModifies : null;
    if (selection !== null) {
      valeur = { total: null, actif: null, cuisson: null, attentes: null, attentes_incluses: null, explication: '', references: [], ...(baseTemps || {}), ...Object.fromEntries(selection.map(champ => [champ, valeur?.[champ] ?? (champ === 'explication' ? '' : null)])) };
    }
    return [k, { valeur: champValide(k, valeur, contexte, selection ?? true), source: liaison(contexte), modifie_le: date(maintenant), ...(selection === null ? {} : { champs_modifies: [...selection] }) }];
  }));
}
function entreeValide(enveloppe) {
  ferme(enveloppe, ['proposition', 'corrections']);
  let proposition = null;
  if (enveloppe.proposition !== null) {
    const p = enveloppe.proposition; ferme(p, ['source', ...CHAMPS, 'modele', 'calcule_le']);
    proposition = fabriquerPropositionReperes({ contexte: contexteLiaison(p.source), resultat: Object.fromEntries(CHAMPS.map(k => [k, p[k]])), modele: p.modele, maintenant: p.calcule_le });
  }
  ferme(enveloppe.corrections, CHAMPS, []); const corrections = {};
  for (const k of Object.keys(enveloppe.corrections)) {
    const c = enveloppe.corrections[k]; ferme(c, ['valeur', 'source', 'modifie_le', ...(k === 'temps' ? ['champs_modifies'] : [])], ['valeur', 'source', 'modifie_le']);
    corrections[k] = fabriquerCorrectionsReperes({ [k]: c.valeur }, contexteLiaison(c.source), c.modifie_le, { champsTempsModifies: c.champs_modifies ?? null, baseTemps: c.valeur })[k];
  }
  const temps = corrections.temps;
  if (temps?.champs_modifies && temps.valeur && proposition?.temps && proposition.source.signature === temps.source.signature) {
    const fusion = { ...proposition.temps, ...Object.fromEntries(temps.champs_modifies.map(k => [k, temps.valeur[k]])) };
    champValide('temps', fusion, contexteLiaison(temps.source), temps.champs_modifies);
  }
  return { proposition, corrections };
}
function enveloppeValide(enveloppe) {
  if (![1, 2].includes(enveloppe?.revision)) erreur('revision');
  ferme(enveloppe, ['revision', 'proposition', 'corrections', ...(enveloppe.revision === 2 ? ['historiques'] : [])]);
  borne(enveloppe, LIMITES_REPERES.enveloppeOctets);
  const courant = entreeValide({ proposition: enveloppe.proposition, corrections: enveloppe.corrections });
  const historiques = enveloppe.revision === 2 ? liste(enveloppe.historiques, 100).map(entreeValide) : [];
  return { revision: enveloppe.revision, ...courant, historiques };
}
function repartirSources(enveloppe) {
  const sources = new Map();
  const cible = source => { const cle = source.signature; if (!sources.has(cle)) sources.set(cle, { proposition: null, corrections: {} }); return sources.get(cle); };
  for (const e of [...enveloppe.historiques, enveloppe]) {
    if (e.proposition) cible(e.proposition.source).proposition = e.proposition;
    for (const [k, c] of Object.entries(e.corrections)) cible(c.source).corrections[k] = c;
  }
  return sources;
}
export function fusionnerReperes(enveloppe, changements = {}) {
  ferme(changements, ['proposition', 'corrections'], []);
  const avant = enveloppe == null ? { revision: 2, proposition: null, corrections: {}, historiques: [] } : enveloppeValide(enveloppe), sources = repartirSources(avant);
  const nouveaux = entreeValide({ proposition: changements.proposition ?? null, corrections: changements.corrections || {} });
  const signatures = new Set([nouveaux.proposition?.source.signature, ...Object.values(nouveaux.corrections).map(c => c.source.signature)].filter(Boolean));
  if (signatures.size > 1) erreur('source_etrangere');
  const signature = [...signatures][0] || avant.proposition?.source.signature || Object.values(avant.corrections)[0]?.source.signature;
  const precedent = sources.get(signature) || { proposition: null, corrections: {} }, corrections = { ...precedent.corrections, ...nouveaux.corrections };
  if (precedent.corrections.temps && nouveaux.corrections.temps?.champs_modifies) {
    const precedents = precedent.corrections.temps.champs_modifies ?? CHAMPS_TEMPS_REPERES, nouveauxChamps = nouveaux.corrections.temps.champs_modifies;
    corrections.temps = { ...nouveaux.corrections.temps,
      valeur: { ...nouveaux.corrections.temps.valeur, ...Object.fromEntries(precedents.filter(k => !nouveauxChamps.includes(k)).map(k => [k, precedent.corrections.temps.valeur?.[k] ?? (k === 'explication' ? '' : null)])) },
      champs_modifies: [...new Set([...precedents, ...nouveauxChamps])] };
  }
  const courant = { proposition: own(changements, 'proposition') ? nouveaux.proposition : precedent.proposition, corrections };
  sources.delete(signature);
  if (sources.size > 100) erreur('reperes_trop_grands');
  return enveloppeValide(borne({ revision: 2, ...courant, historiques: [...sources.values()] }, LIMITES_REPERES.enveloppeOctets, 'reperes_trop_grands'));
}
export function propositionReperesPourSource(enveloppe, signature) {
  if (enveloppe == null) return null;
  return repartirSources(enveloppeValide(enveloppe)).get(signature)?.proposition || null;
}
export function lireReperes(recipe, version = null) {
  let contexte = null; try { contexte = construireContexteReperes({ recipe, version }); } catch { /* source trop longue/invalide : aucune valeur courante */ }
  const resultat = { source: contexte ? liaison(contexte) : null, description_fr: null, difficulte: null, temps: null, champs: {}, rapide: false,
    disponible: !!(contexte && version && contexte.source.disponibilite === 'available' && !contexte.source.incomplete && contexte.source.ingredients.some(Boolean) && contexte.source.etapes.some(Boolean)) };
  let enveloppe = null, invalide = false;
  if (recipe?.reperes != null) { try { enveloppe = enveloppeValide(recipe.reperes); } catch { invalide = true; } }
  if (enveloppe) {
    const sources = repartirSources(enveloppe);
    enveloppe = sources.get(contexte?.signature) || [...sources.values()].reverse().find(e => (e.proposition?.source || Object.values(e.corrections)[0]?.source)?.version_id === contexte?.version_id) || enveloppe;
  }
  for (const k of CHAMPS) {
    const manuel = own(enveloppe?.corrections, k), p = manuel ? enveloppe.corrections[k] : enveloppe?.proposition;
    let valeur = p ? (manuel ? p.valeur : p[k]) : null;
    if (k === 'temps' && manuel && p.champs_modifies && valeur && enveloppe.proposition?.source.signature === p.source.signature && enveloppe.proposition.temps) {
      valeur = { ...enveloppe.proposition.temps, ...Object.fromEntries(p.champs_modifies.map(champ => [champ, valeur[champ]])) };
    }
    const courant = !!p && !!contexte && p.source.version_id === contexte.version_id && p.source.signature === contexte.signature;
    resultat.champs[k] = { valeur, origine: p ? (manuel ? 'manuel' : 'estimation_ia') : null, etat: invalide ? 'invalide' : !p ? 'absent' : courant ? 'courant' : 'perime', ...(k === 'temps' && manuel ? { champs_modifies: p.champs_modifies ?? [...CHAMPS_TEMPS_REPERES] } : {}) };
    if (courant) resultat[k] = k === 'description_fr' ? valeur?.texte ?? null : valeur;
  }
  resultat.rapide = !!(resultat.disponible && resultat.temps?.total?.complet && resultat.temps.attentes_incluses === true && resultat.temps.total.max <= 30);
  return resultat;
}
// Les quatre champs historiques restent une source distincte. Ni somme, ni actif = préparation.
// Une correction nulle/périmée/invalide empêche tout repli qui la ferait réapparaître.
export function lireTemps(recipe, version = null) {
  const lu = lireReperes(recipe, version), vide = { total: null, actif: null, cuisson: null, attentes: null, attentes_incluses: null, explication: '', references: [], rapide: lu.rapide, disponible: lu.disponible };
  if (lu.champs.temps.etat !== 'absent') return { ...vide, ...(lu.temps || {}), rapide: lu.rapide };
  if (estCreationIA(version) || estThermomix(version)) return vide;
  const ancien = (champ, total = false) => {
    const n = version?.[champ]; if (!Number.isInteger(n) || n < 0 || n > LIMITES_REPERES.minutes) return null;
    return { min: n, max: n, origine: 'source', ...(total ? { complet: false } : {}) };
  };
  return { ...vide, total: ancien('total_minutes', true), actif: ancien('active_minutes'), cuisson: ancien('cook_minutes') };
}
export function formaterDureeReperes(duree) {
  if (!duree) return null;
  return `${duree.origine === 'estimation_ia' ? '≈ ' : ''}${duree.min === duree.max ? duree.min : `${duree.min}–${duree.max}`} min`;
}
