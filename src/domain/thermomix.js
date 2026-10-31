// I3 : contrat logiciel TM7 NA 120 V. Aucun réseau, stockage ou commande du robot.
// Une réponse IA est hostile ; seules les valeurs typées produisent des instructions.
import {validerStructureIngredients} from './structure-ingredients.js';
import { formatQuantity } from './quantity.js';
import { unitLabel, dimensionOf, convertValue } from './units.js';
import { EN } from '../i18n/en.js';
import { getUiLocale, t } from '../core/i18n.js';
import { extraireObjetJson } from './reponse-json.js';

export const PROFIL_TM7 = Object.freeze({ id: 'tm7-na-120v-v1', revision: 1, modele: 'TM7', tension: 120,
  modes: Object.freeze(['manuel', 'vapeur']), temperatures: Object.freeze([null, 100]),
  accessoires: Object.freeze(['couteau', 'fouet', 'panier', 'varoma', 'panier_varoma']), bolLitres: 2.2, panierLitres: 1.4 });
export const LIMITES_THERMOMIX = Object.freeze({ ingredients: 60, etapes: 40, etape: 2000, selection: 20, demande: 500,
  actionsParBloc: 6, actions: 80, raison: 300, questions: 4, question: 300, reponse: 500, contexteOctets: 128 * 1024,
  corps: 1024 * 1024, maxTokens: 16000, tentativeMs: 135000, secondes: 1800, vapeurCumulee: 1800, fouetCumule: 7200 });
export const AVERTISSEMENT_TM7 = 'Réglages proposés, non vérifiés sur le robot. Vérifie les quantités, la cuisson, le montage et les repères de remplissage avant de cuisiner.';
export const OPERATIONS_THERMOMIX = Object.freeze(['ajouter', 'reserver', 'transvaser', 'racler', 'repartir_varoma', 'verifier_texture']);
const CONTENANTS = ['bol', 'panier', 'varoma', 'recipient'];
const own = (v, k) => !!v && Object.hasOwn(v, k);
const objet = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function erreur(raison) { const e = new Error(raison); e.name = 'ErreurThermomix'; e.raison = raison; throw e; }
function ferme(v, cles, requis = cles) {
  if (!objet(v) || Object.keys(v).some(k => !cles.includes(k)) || requis.some(k => !own(v, k))) erreur('structure');
}
function liste(v, max, min = 0) {
  if (!Array.isArray(v) || v.length > max || v.length < min) erreur('limite');
  for (let i = 0; i < v.length; i++) if (!own(v, i)) erreur('structure');
  return v;
}
const codepoints = (s) => Array.from(s).length;
// Exemption étroite pour quelques formulations de refus : une négation ne couvre
// jamais une autre phrase/clause. Ce filtre ne prétend pas analyser toute la prose.
function refusPrudent(phrase) {
  const directe = /^(?:(?:je|nous|i|we)\s+)?(?:ne\s+(?:peux|peut|pouvons|pouvez|peuvent)\s+(?:pas|jamais)|(?:il\s+est\s+)?impossible\s+de|cannot|can['’]t|unable\s+to)\s+(?:vous\s+)?(?:garantir|certifier|proposer|adapter|guarantee|certify|propose|adapt)\b/iu;
  if (directe.test(phrase)) return true;
  const inverse = /^(.{1,100}?)\s+(?:ne\s+peut\s+pas\s+[eê]tre\s+(?:garanti(?:e|es|s)?|certifi[eé](?:e|es|s)?)|cannot\s+be\s+(?:guaranteed|certified))(?:\s+(?:sans risque|sans danger|safe))?$/iu.exec(phrase);
  // Le sujet d'un refus passif n'est pas lui-même une affirmation indépendante.
  return !!inverse && !/\b(?:est|sont|sera|seront|is|are|will)\b/iu.test(inverse[1]);
}
const allegations = phrase => phrase.match(/\b(?:garanti(?:e|es|s)?|certifi[eé](?:e|es|s)?|sans danger|sans risque|safe)\b|(?:gluten|dairy|nut|allergen).free|sans[\s-]*(?:gluten|lactose|noix|allerg[eè]ne)/giu) || [];
function texte(v, max, { vide = false, hostile = false, affiche = true, refus = false } = {}) {
  if (typeof v !== 'string' || codepoints(v) > max || (!vide && !v.trim())) erreur('texte');
  if (!hostile) return v;
  const s = v.replace(/[\t\n\r\p{Zl}\p{Zp}]/gu, ' ').normalize('NFC').replace(/ +/g, ' ').trim();
  const compare = s.normalize('NFKC').toLowerCase();
  // Seuls les angles d'un comparateur numérique sont admis ; tout reste ferme
  // notamment les balises, commentaires HTML et faux « <2> ».
  const sansComparateurs = compare.replace(/[<>]=?\s*\d+(?:[.,]\d+)?(?![\p{L}\p{N}_]|[.,]\d)/gu, '');
  if (/[\p{Cc}\p{Cf}]/u.test(s) || /[<>]/u.test(sansComparateurs) || /https?:|www\.|\b[\p{L}\d-]+\.(?:com|ca|fr|net|org|test)\b/iu.test(compare)) erreur('texte_interdit');
  if (affiche) {
    if (/(?:retir(?:er|ez|e)|ouvr(?:ir|ez)|enlev(?:er|ez)|[oô]t(?:er|ez|e)|remove|open).{0,50}(?<![\p{L}\p{N}_])(?:couvercles?|gobelets?|bouchons?|lids?|caps?)(?![\p{L}\p{N}_])|(?:mix(?:er|ez)|blend).{0,80}(?:chaud|hot|vitesse\s*(?:[3-9]|10|[<>]=?\s*\d))|contourner.{0,25}s[eé]curit|bypass/iu.test(compare)
      // Décision explicite du plan10.4, distincte du faux positif « cap ».
      || compare.includes('retirer du liquide pour respecter la capacité du bol')) erreur('instruction_libre');
    // Les retours à la ligne bornent la négation même si le texte rendu les replie.
    const clauses = v.normalize('NFKC').toLowerCase().split(/[\r\n\p{Zl}\p{Zp}.!?;,:—–]|\s-\s|\b(?:et|mais|ou|car|donc|pourtant|cependant|and|but|or|because|however|yet)\b/iu);
    if (/^\s*(?:vegan|v[eé]g[eé]tarien(?:ne)?|celiac|cœliaque)[.!]?\s*$/iu.test(compare)) erreur('texte_interdit');
    let allegationsLocalisees = 0;
    for (const fragment of clauses) {
      const clause = fragment.replace(/\s+/gu, ' ').trim(), nombre = allegations(clause).length;
      allegationsLocalisees += nombre;
      if (nombre && !(refus && refusPrudent(clause))) erreur('texte_interdit');
    }
    // Une coupure ne doit pas faire disparaître « sans\nrisque » ou « sans - gluten ».
    if (allegationsLocalisees !== allegations(compare).length) erreur('texte_interdit');
  }
  if (!s && !vide) erreur('texte');
  return s;
}
function identifiant(v) { const id = texte(v, 160); if (['__proto__', 'constructor', 'prototype'].includes(id)) erreur('identifiant'); return id; }
function cloneJson(v, depth = 0, budget = { n: 0 }, tri = false) {
  if (++budget.n > 20000 || depth > 20) erreur('limite');
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
  if (typeof v === 'number') { if (!Number.isFinite(v)) erreur('nombre'); return v; }
  if (Array.isArray(v)) return liste(v, 1000).map(x => cloneJson(x, depth + 1, budget, tri));
  if (!objet(v)) erreur('structure');
  const out = {};
  for (const k of tri ? Object.keys(v).sort() : Object.keys(v)) {
    if (['__proto__', 'prototype', 'constructor'].includes(k)) erreur('structure');
    if (v[k] === undefined) continue; // les champs optionnels locaux n'entrent pas dans JSON.
    out[k] = cloneJson(v[k], depth + 1, budget, tri);
  }
  return out;
}
const canon = (v) => JSON.stringify(cloneJson(v, 0, { n: 0 }, true));
const octets = (v) => new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v)).byteLength;
function borneContexte(v) { if (octets(v) > LIMITES_THERMOMIX.contexteOctets) erreur('contexte_trop_grand'); return v; }
function nombreOuNull(v, max, min = 0) {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) erreur('nombre');
  return v;
}
function portions(v) { return v == null ? null : nombreOuNull(v, 10000, Number.MIN_VALUE); }

// Empreinte = représentation canonique complète, sans collision de hachage ni dépendance asynchrone.
// Les notes, photos, données de compte et provenance libre ne font jamais partie de la demande.
function instantane(version, { incomplete } = {}) {
  if (!objet(version)) erreur('source_absente');
  const ingredients = cloneJson(liste(version.ingredients, LIMITES_THERMOMIX.ingredients, 1));
  ingredients.forEach(i => {
    if (!objet(i)) erreur('ingredient');
    if (i.source_text != null) texte(i.source_text, 2000, { vide: true });
    if (i.name_text != null) texte(i.name_text, 500, { vide: true });
  });
  const steps = liste(version.steps, LIMITES_THERMOMIX.etapes, 1).map(s => {
    if (!objet(s)) erreur('etape');
    return { id: identifiant(s.id), text: texte(s.text, LIMITES_THERMOMIX.etape),
      ...(own(s, 'position') ? { position: cloneJson(s.position) } : {}),
      ...(own(s, 'timers') ? { timers: cloneJson(s.timers) } : {}) };
  });
  if (new Set(steps.map(s => s.id)).size !== steps.length) erreur('etapes_dupliquees');
  const p = version.provenance || {};
  return borneContexte({ id: identifiant(version.id), recipe_id: identifiant(version.recipe_id), servings: portions(version.servings),
    ingredients, steps, constraints: cloneJson(version.constraints || {}), convention_snapshot: cloneJson(p.convention_snapshot ?? version.convention_snapshot ?? null),
    prep_minutes: nombreOuNull(version.prep_minutes, 100000), cook_minutes: nombreOuNull(version.cook_minutes, 100000),
    active_minutes: nombreOuNull(version.active_minutes, 100000), total_minutes: nombreOuNull(version.total_minutes, 100000),
    incomplete: incomplete === true || version.incomplete === true || p.incomplete === true || p.missing_page === true,
    plan_invalide: p.thermomix_invalide === true || version.plan_invalide === true });
}
export function empreinteThermomix(version, options = {}) { return canon(instantane(version, options)); }
function precisionsDe(value = {}, source, securite = erreur) {
  ferme(value, ['eau_vapeur_g', 'volume_bol_l', 'volume_panier_l', 'froid_confirme', 'reponses'], []);
  const froid = liste(value.froid_confirme || [], LIMITES_THERMOMIX.etapes).map(identifiant);
  if (new Set(froid).size !== froid.length || froid.some(id => !source.steps.some(s => s.id === id))) erreur('froid_invalide');
  // La borne historique de forme reste contrôlée même lors d'une lecture documentaire.
  if (value.eau_vapeur_g != null && (typeof value.eau_vapeur_g !== 'number' || !Number.isFinite(value.eau_vapeur_g) || value.eau_vapeur_g < 0 || value.eau_vapeur_g > 10000)) erreur('eau_vapeur');
  if (value.eau_vapeur_g > PROFIL_TM7.bolLitres * 1000) securite('eau_vapeur');
  return { eau_vapeur_g: value.eau_vapeur_g ?? null, volume_bol_l: nombreOuNull(value.volume_bol_l, PROFIL_TM7.bolLitres),
    volume_panier_l: nombreOuNull(value.volume_panier_l, PROFIL_TM7.panierLitres),
    froid_confirme: source.steps.filter(s => froid.includes(s.id)).map(s => s.id),
    reponses: liste(value.reponses || [], LIMITES_THERMOMIX.questions).map(s => texte(s, LIMITES_THERMOMIX.reponse, { vide: true })) };
}
export function construireContexteThermomix({ version, selection = [], demande = '', precisions = {}, langue = 'fr', incomplete } = {}) {
  const source = instantane(version, { incomplete });
  const ids = liste(selection, LIMITES_THERMOMIX.selection).map(identifiant);
  if (new Set(ids).size !== ids.length || ids.some(id => !source.steps.some(s => s.id === id))) erreur('selection');
  let anciens = [], anciennesPrecisions = {}, anciennesLangues = {};
  if (estThermomix(version) && !source.plan_invalide) {
    const lu = lireThermomix(version);
    if (!lu?.ok) erreur('plan_invalide');
    const correspondance = lu.plan.correspondance;
    const courant = (id) => correspondance.find(x => x.source_step_id === id)?.step_id;
    anciens = lu.plan.blocs.map(b => ({ ...cloneJson(b), source_step_id: courant(b.source_step_id) }));
    for (const bloc of lu.plan.blocs) {
      const p = lu.contexte.selection.includes(bloc.source_step_id) ? lu.contexte.precisions : lu.contexte.anciennes_precisions[bloc.source_step_id];
      if (!p) erreur('precisions');
      anciennesPrecisions[courant(bloc.source_step_id)] = { ...cloneJson(p), froid_confirme: p.froid_confirme.map(courant).filter(Boolean) };
      anciennesLangues[courant(bloc.source_step_id)] = lu.contexte.selection.includes(bloc.source_step_id) ? lu.contexte.langue : lu.contexte.anciennes_langues[bloc.source_step_id];
    }
  }
  const contexte = { revision: 1, profil: PROFIL_TM7.id, langue: langue === 'en' ? 'en' : 'fr', source,
    source_signature: canon(source), selection: source.steps.filter(s => ids.includes(s.id)).map(s => s.id),
    demande: texte(demande, LIMITES_THERMOMIX.demande, { vide: true }), precisions: precisionsDe(precisions, source),
    anciens_blocs: anciens, anciennes_precisions: anciennesPrecisions, anciennes_langues: anciennesLangues };
  return borneContexte(contexte);
}

function relireContexte(c, securite = erreur) {
  ferme(c, ['revision', 'profil', 'langue', 'source', 'source_signature', 'selection', 'demande', 'precisions', 'anciens_blocs', 'anciennes_precisions', 'anciennes_langues']);
  if (c.revision !== 1 || c.profil !== PROFIL_TM7.id || !['fr', 'en'].includes(c.langue)) erreur('profil');
  const source = instantane(c.source, { incomplete: c.source?.incomplete });
  if (canon(source) !== c.source_signature) erreur('source_modifiee');
  const selection = liste(c.selection, LIMITES_THERMOMIX.selection).map(identifiant);
  if (new Set(selection).size !== selection.length || selection.some(id => !source.steps.some(s => s.id === id))
    || canon(selection) !== canon(source.steps.filter(s => selection.includes(s.id)).map(s => s.id))) erreur('selection');
  const p = precisionsDe(c.precisions, source, securite);
  if (canon(p) !== canon(c.precisions)) erreur('precisions');
  if (!objet(c.anciennes_precisions)) erreur('precisions');
  for (const [id, value] of Object.entries(c.anciennes_precisions)) {
    if (!source.steps.some(s => s.id === id) || canon(precisionsDe(value, source, securite)) !== canon(value)) erreur('precisions');
  }
  if (!objet(c.anciennes_langues) || Object.entries(c.anciennes_langues).some(([id, lg]) => !source.steps.some(s => s.id === id) || !['fr', 'en'].includes(lg))) erreur('langue');
  texte(c.demande, LIMITES_THERMOMIX.demande, { vide: true });
  liste(c.anciens_blocs, LIMITES_THERMOMIX.etapes);
  return borneContexte({ ...cloneJson(c), source });
}
export function ingredientsContexteThermomix(contexte) {
  return (contexte?.source?.ingredients || []).map((ingredient, i) => ({ ...cloneJson(ingredient), ref: `i${i + 1}` }));
}
function refsIngredients(v, c, min = 0) {
  const refs = liste(v, LIMITES_THERMOMIX.ingredients, min).map(identifiant);
  const autorises = ingredientsContexteThermomix(c).map(i => i.ref);
  if (new Set(refs).size !== refs.length || refs.some(id => !autorises.includes(id))) erreur('ingredient');
  return refs;
}
function quantiteConnue(i) {
  const q = i?.quantity;
  if (!objet(q)) return false;
  if (q.min != null || q.max != null) return q.value == null && Number.isFinite(q.min) && q.min > 0 && Number.isFinite(q.max) && q.max >= q.min;
  if (q.value != null) return Number.isFinite(q.value) && q.value > 0;
  return q.qualitative === true;
}
function validerAction(a, c) {
  if (!objet(a)) erreur('action');
  if (a.type === 'preparation') {
    ferme(a, ['type', 'operation', 'ingredients', 'contenant']);
    if (!OPERATIONS_THERMOMIX.includes(a.operation) || !CONTENANTS.includes(a.contenant)) erreur('preparation');
    const refs = refsIngredients(a.ingredients, c, ['ajouter', 'reserver', 'repartir_varoma'].includes(a.operation) ? 1 : 0);
    if (a.operation === 'racler' && (a.contenant !== 'bol' || refs.length)) erreur('preparation');
    if (['transvaser', 'verifier_texture'].includes(a.operation) && refs.length) erreur('preparation');
    if (a.operation === 'repartir_varoma' && a.contenant !== 'varoma') erreur('preparation');
    if (a.operation === 'ajouter' && refs.some(ref => !quantiteConnue(ingredientsContexteThermomix(c).find(i => i.ref === ref)))) erreur('quantite_inconnue');
    return { type: 'preparation', operation: a.operation, ingredients: refs, contenant: a.contenant };
  }
  ferme(a, ['type', 'mode', 'secondes', 'temperature', 'vitesse', 'sens', 'accessoire', 'ingredients']);
  if (a.type !== 'reglage' || !PROFIL_TM7.modes.includes(a.mode) || !PROFIL_TM7.accessoires.includes(a.accessoire)
    || !['normal', 'inverse'].includes(a.sens) || !Number.isInteger(a.secondes) || a.secondes < 1 || a.secondes > LIMITES_THERMOMIX.secondes
    || !(a.vitesse === 'mijotage' || Number.isInteger(a.vitesse) && a.vitesse >= 1 && a.vitesse <= 10)) erreur('reglage');
  const vitesse = a.vitesse === 'mijotage' ? 0 : a.vitesse;
  if (!PROFIL_TM7.temperatures.includes(a.temperature) || a.mode === 'vapeur' && a.temperature !== null) erreur('temperature');
  if ((a.temperature !== null || a.mode === 'vapeur') && vitesse > 2 || a.sens === 'inverse' && vitesse > 2) erreur('vitesse');
  const panier = ['panier', 'panier_varoma'].includes(a.accessoire);
  const varoma = ['varoma', 'panier_varoma'].includes(a.accessoire);
  if (panier && vitesse > 1 || varoma && a.mode !== 'vapeur'
    || a.accessoire === 'fouet' && (a.mode !== 'manuel' || a.sens !== 'normal' || vitesse > 4)
    || a.mode === 'vapeur' && !['panier', 'varoma', 'panier_varoma'].includes(a.accessoire)) erreur('accessoire');
  const refs = refsIngredients(a.ingredients, c, 1);
  if (refs.some(ref => !quantiteConnue(ingredientsContexteThermomix(c).find(i => i.ref === ref)))) erreur('quantite_inconnue');
  return { type: 'reglage', mode: a.mode, secondes: a.secondes, temperature: a.temperature, vitesse: a.vitesse,
    sens: a.sens, accessoire: a.accessoire, ingredients: refs };
}
function validerBloc(b, c) {
  ferme(b, ['source_step_id', 'raison', 'actions']);
  const id = identifiant(b.source_step_id);
  if (!c.source.steps.some(s => s.id === id)) erreur('selection');
  // La justification libre reste une donnée de provenance ; elle n'est jamais une consigne affichée.
  return { source_step_id: id, raison: texte(b.raison, LIMITES_THERMOMIX.raison, { hostile: true, affiche: false }),
    actions: liste(b.actions, LIMITES_THERMOMIX.actionsParBloc, 1).map(a => validerAction(a, c)) };
}
const chauffeDansTexte = (text) => /cuir|cuit|cuisson|chauff|bouill|mijot|fr[eé]mi|rissol|r[oô]ti|po[eê]l|four|hot|heat|cook|boil|simmer|bake|fry/iu.test(text);
const graisse = (i) => /(?:^|[\s’'])huile|beurre|graisse|\boil\b|\bbutter\b|\bfat\b/iu.test(`${i.name_text || ''} ${i.source_text || ''}`);
const graisseChaude = (i) => graisse(i) && /chaud|chauff|br[uû]lant|\bhot\b|heated/iu.test(`${i.name_text || ''} ${i.source_text || ''} ${i.preparation || ''}`);
const DEPART_VIDE = 'Commencer cette partie avec le bol, le panier et le Varoma vides. Vérifier les ingrédients et quantités indiqués avant tout ajout.';
function ancienDepartVide(step, c) { return step.text.startsWith(tr(DEPART_VIDE, null, c.anciennes_langues[step.id])); }
function verifierSequence(blocs, c, securite = erreur) {
  const map = new Map(blocs.map(b => [b.source_step_id, b]));
  if (map.size !== blocs.length) erreur('blocs_dupliques');
  let chaude = false, inconnue = false, vapeur = 0, fouet = 0, actions = 0;
  const ingredients = ingredientsContexteThermomix(c);
  const contenu = Object.fromEntries(CONTENANTS.map(n => [n, new Set()]));
  const eau = Object.fromEntries(CONTENANTS.map(n => [n, 0]));
  let eauVapeur = null;
  const connu = Object.fromEntries(CONTENANTS.map(n => [n, true]));
  let commence = false;
  const dejaPlaces = new Set();
  const verifierVolume = (cible) => {
    const capacite = cible === 'bol' ? 2200 : cible === 'panier' ? 1400 : null;
    if (capacite === null) return;
    let total = eau[cible];
    for (const ref of contenu[cible]) {
      const i = ingredients.find(x => x.ref === ref);
      if (dimensionOf(i?.unit_id) !== 'volume') continue;
      const enMl = convertValue(i.quantity?.max ?? i.quantity?.value, i.unit_id, 'ml', { convention_id: c.source.convention_snapshot?.id });
      // Somme des volumes déjà mesurés, jamais de densité alimentaire supposée.
      if (enMl.ok && !enMl.estimate) total += enMl.value;
    }
    if (total > capacite + 1e-9) securite('capacite');
  };
  const placer = (refs, cible) => {
    if (!connu[cible]) erreur('contenu_non_etabli');
    for (const ref of refs) {
      const ancien = CONTENANTS.find(n => contenu[n].has(ref));
      if (ancien === cible) erreur('double_ajout');
      if (!ancien && dejaPlaces.has(ref)) erreur('double_ajout');
      if (ancien && !connu[ancien]) erreur('contenu_non_etabli');
      if (ancien) contenu[ancien].delete(ref);
      contenu[cible].add(ref);
      dejaPlaces.add(ref);
    }
    verifierVolume(cible);
  };
  for (const step of c.source.steps) {
    const b = map.get(step.id);
    if (!b) {
      if (chauffeDansTexte(step.text)) chaude = true;
      inconnue = true; // aucune prose source n'est une preuve d'état thermique.
      if (commence) for (const n of CONTENANTS) connu[n] = false;
      continue;
    }
    const p = c.selection.includes(step.id) ? c.precisions : c.anciennes_precisions[step.id];
    if (!p) erreur('precisions');
    if (!c.selection.includes(step.id) && ancienDepartVide(step, c)) {
      // Un ancien bloc garde sa consigne littérale, même lorsqu'une adaptation est insérée avant lui.
      for (const n of ['bol', 'panier', 'varoma']) { contenu[n].clear(); connu[n] = true; eau[n] = 0; }
      eauVapeur = null;
    }
    commence = true; // le premier bloc impose explicitement des contenants vides.
    for (const a of b.actions) {
      if (++actions > LIMITES_THERMOMIX.actions) erreur('limite');
      if (a.type === 'preparation') {
        if (['ajouter', 'reserver', 'repartir_varoma'].includes(a.operation)) {
          if (a.ingredients.some(ref => !quantiteConnue(ingredients.find(i => i.ref === ref)))) erreur('quantite_inconnue');
          if (a.contenant === 'bol' && a.ingredients.some(ref => graisseChaude(ingredients.find(i => i.ref === ref)))) erreur('graisse_chaude');
          placer(a.ingredients, a.contenant);
        }
        if (a.operation === 'transvaser') {
          if (a.contenant === 'bol') erreur('preparation');
          for (const ref of contenu.bol) contenu[a.contenant].add(ref);
          eau[a.contenant] += eau.bol; eau.bol = 0;
          // Une eau déjà utilisée puis vidée ne réapparaît pas au prochain réglage.
          // Le contrat ne possède pas d'action structurée de réapprovisionnement.
          if (eauVapeur !== null) eauVapeur = 0;
          verifierVolume(a.contenant);
          connu[a.contenant] = connu[a.contenant] && connu.bol;
          contenu.bol.clear(); connu.bol = true;
        }
        // Un transfert ne déclare jamais froid un contenu d'origine inconnue.
        if (a.operation === 'transvaser' && (inconnue || chaude)) inconnue = true;
        continue;
      }
      const vitesse = a.vitesse === 'mijotage' ? 0 : a.vitesse;
      const chauffe = a.mode === 'vapeur' || a.temperature !== null;
      // Le contenu du panier reste présent même si le réglage ne cite que le bol.
      if (['couteau', 'fouet'].includes(a.accessoire) && (contenu.panier.size || eau.panier > 0)) securite('capacite');
      const recipients = a.accessoire === 'panier_varoma' ? ['bol', 'panier', 'varoma'] :
        a.accessoire === 'panier' ? ['bol', 'panier'] : a.accessoire === 'varoma' ? ['bol', 'varoma'] : ['bol'];
      if (recipients.some(n => !connu[n])) erreur('contenu_non_etabli');
      const presents = [...new Set(recipients.flatMap(n => [...contenu[n]]))].sort();
      if (canon(presents) !== canon([...a.ingredients].sort())) erreur('contenu_incoherent');
      if (vitesse > 2 && (chaude || inconnue || !p.froid_confirme.includes(step.id))) erreur('froid_non_etabli');
      if (chauffe && a.mode !== 'vapeur') {
        if (!contenu.bol.size) erreur('contenu_non_etabli');
        if ([...contenu.bol].every(ref => graisse(ingredients.find(i => i.ref === ref)))) erreur('huile_seule');
      }
      if (a.mode === 'vapeur') {
        if (!(p.eau_vapeur_g >= 500)) erreur('eau_vapeur');
        // Eau de service distincte des ingrédients. Une suite de réglages ne la rajoute pas.
        if (eauVapeur === null) { eau.bol = p.eau_vapeur_g; eauVapeur = p.eau_vapeur_g; }
        else if (eauVapeur !== p.eau_vapeur_g) securite('eau_vapeur');
        verifierVolume('bol');
        vapeur += a.secondes; if (vapeur > LIMITES_THERMOMIX.vapeurCumulee) erreur('vapeur_cumulee');
      }
      if (a.accessoire === 'fouet') { fouet += a.secondes; if (fouet > LIMITES_THERMOMIX.fouetCumule) erreur('fouet_cumule'); }
      if (chauffe) chaude = true;
    }
  }
}
function reponseDe(raw, c, securite = erreur) {
  if (typeof raw === 'string') {
    if (octets(raw) > LIMITES_THERMOMIX.corps) erreur('reponse_trop_grande');
    try { raw = extraireObjetJson(raw, { maxOctets: LIMITES_THERMOMIX.corps }); } catch (_) { erreur('json'); }
  } else if (octets(cloneJson(raw)) > LIMITES_THERMOMIX.corps) erreur('reponse_trop_grande');
  if (!objet(raw)) erreur('structure');
  if (raw.type === 'questions') {
    ferme(raw, ['type', 'questions']);
    return { type: 'questions', questions: liste(raw.questions, LIMITES_THERMOMIX.questions, 1).map(q => texte(q, LIMITES_THERMOMIX.question, { hostile: true })) };
  }
  if (raw.type === 'refus') { ferme(raw, ['type', 'raison']); return { type: 'refus', raison: texte(raw.raison, LIMITES_THERMOMIX.raison, { hostile: true, refus: true }) }; }
  ferme(raw, ['type', 'blocs']);
  if (raw.type !== 'proposition' || c.selection.length < 1) erreur('selection');
  if (c.source.plan_invalide && c.selection.length !== c.source.steps.length) erreur('plan_invalide');
  const blocs = liste(raw.blocs, LIMITES_THERMOMIX.selection, 1).map(b => validerBloc(b, c));
  if (blocs.length !== c.selection.length || new Set(blocs.map(b => b.source_step_id)).size !== blocs.length
    || blocs.some(b => !c.selection.includes(b.source_step_id))) erreur('selection');
  const ordered = c.selection.map(id => blocs.find(b => b.source_step_id === id));
  const anciensTous = c.anciens_blocs.map(b => validerBloc(b, c));
  for (const b of anciensTous) {
    const source = c.source.steps.find(s => s.id === b.source_step_id), lg = c.anciennes_langues[b.source_step_id], precisions = c.anciennes_precisions[b.source_step_id];
    if (!lg || !precisions) erreur('precisions');
    const ancienContexte = { ...c, precisions };
    if (source.text !== formaterBlocThermomix(b, ancienContexte, { locale: lg, initialisation: ancienDepartVide(source, c) }) || canon(source.timers || []) !== canon(minuteursBloc(b, lg))) erreur('ancien_bloc_modifie');
  }
  const anciens = anciensTous.filter(b => !c.selection.includes(b.source_step_id));
  verifierSequence([...anciens, ...ordered], c, securite);
  return { type: 'proposition', blocs: ordered };
}
export function validerReponseThermomix(raw, contexte) { return reponseDe(raw, relireContexte(contexte)); }

// Les chaînes de format sont des clés françaises du dictionnaire commun ; les exports choisissent leur langue explicitement.
const tr = (fr, vars, locale) => {
  if (locale === getUiLocale()) return t(fr, vars);
  const s = locale === 'en' && own(EN, fr) ? EN[fr] : fr;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => own(vars, k) ? String(vars[k]) : m) : s;
};
const EXPLICATIONS_BLOC = [
  'Cuisson à la vapeur proposée. Vérifie l’eau et le montage indiqué avant de commencer.',
  'Chauffe proposée à 100 °C, avec mélange lent. Vérifie le remplissage avant de commencer.',
  'Mixage rapide proposé uniquement avec un départ à froid confirmé.',
  'Mélange sans chauffe proposé. Les quantités restent celles de la version source.',
  'Préparation proposée avec les ingrédients de la version source.',
];
export function explicationBlocThermomix(bloc, contexte, { locale = 'fr' } = {}) {
  const reglages = validerBloc(bloc, contexte).actions.filter(a => a.type === 'reglage');
  const choix = reglages.some(a => a.mode === 'vapeur') ? 0 : reglages.some(a => a.temperature !== null) ? 1
    : reglages.some(a => a.vitesse > 2) ? 2 : reglages.length ? 3 : 4;
  return tr(EXPLICATIONS_BLOC[choix], null, locale);
}
export function ligneIngredientThermomix(i, { locale = 'fr' } = {}) {
  if (typeof i?.source_text === 'string' && i.source_text.trim()) return i.source_text;
  return [formatQuantity(i?.quantity, { locale }), i?.unit_id ? unitLabel(i.unit_id, locale) : i?.unit_text,
    i?.name_text, i?.preparation].filter(Boolean).join(' ');
}
const contenantFr = { bol: 'le bol', panier: 'le panier', varoma: 'le Varoma', recipient: 'un récipient' };
const accessoireFr = { couteau: 'couteau', fouet: 'fouet', panier: 'panier', varoma: 'Varoma', panier_varoma: 'panier et Varoma' };
const operationsFr = { ajouter: 'Ajouter {ingredients} dans {contenant}.', reserver: 'Réserver {ingredients} dans {contenant}.',
  transvaser: 'Transvaser la préparation dans {contenant}.', racler: 'À l’arrêt, racler les parois du bol avec la spatule.',
  repartir_varoma: 'Répartir {ingredients} dans le Varoma en laissant des passages de vapeur libres.', verifier_texture: 'À l’arrêt, vérifier la texture de la préparation.' };
export const TEXTES_THERMOMIX = Object.freeze([...Object.values(contenantFr), ...Object.values(accessoireFr), ...Object.values(operationsFr), ...EXPLICATIONS_BLOC,
  DEPART_VIDE,
  AVERTISSEMENT_TM7, 'mode Vapeur', 'sans chauffe', 'sens inverse', 'sens normal', 'vitesse {v}', 'mijotage',
  'Installer {accessoire} selon le manuel ; passages de vapeur libres. Eau du bol renseignée : {eau} g.',
  'Couvercle en place ; accessoire : {accessoire}.', 'Réglages proposés', 'Durée proposée : {d}', 'Adaptation au TM7 des étapes sélectionnées.',
  'Version personnelle — d’après une adaptation TM7 avec l’IA', 'Adaptée au TM7 avec l’IA · testée', 'Adaptée au TM7 avec l’IA · non testée',
  'Page {p}', 'Portions inconnues : quantités de la version source.', '{n} portions', 'Ingrédients', 'Préparation']);
function duree(secondes) { const m = Math.floor(secondes / 60), s = secondes % 60; return [m ? `${m} min` : '', s ? `${s} s` : ''].filter(Boolean).join(' '); }
export function formaterActionThermomix(action, contexte, { locale = 'fr' } = {}) {
  const a = validerAction(action, contexte);
  const ingredients = ingredientsContexteThermomix(contexte);
  const noms = a.ingredients.map(ref => ligneIngredientThermomix(ingredients.find(i => i.ref === ref), { locale })).join(', ');
  if (a.type === 'preparation') {
    const contenant = tr(contenantFr[a.contenant], null, locale);
    return tr(operationsFr[a.operation], { ingredients: noms, contenant }, locale);
  }
  const reglages = [duree(a.secondes), a.mode === 'vapeur' ? tr('mode Vapeur', null, locale) : a.temperature === null ? tr('sans chauffe', null, locale) : '100 °C',
    tr(a.sens === 'inverse' ? 'sens inverse' : 'sens normal', null, locale), tr('vitesse {v}', { v: a.vitesse === 'mijotage' ? tr('mijotage', null, locale) : a.vitesse }, locale)];
  const montage = a.mode === 'vapeur'
    ? tr('Installer {accessoire} selon le manuel ; passages de vapeur libres. Eau du bol renseignée : {eau} g.', { accessoire: tr(accessoireFr[a.accessoire], null, locale), eau: contexte.precisions.eau_vapeur_g ?? '—' }, locale)
    : tr('Couvercle en place ; accessoire : {accessoire}.', { accessoire: tr(accessoireFr[a.accessoire], null, locale) }, locale);
  return `${tr('Réglages proposés', null, locale)} : ${reglages.join(' / ')}. ${montage}`;
}
export function formaterBlocThermomix(bloc, contexte, { locale = 'fr', initialisation } = {}) {
  const b = validerBloc(bloc, contexte);
  const adaptees = new Set([...contexte.selection, ...contexte.anciens_blocs.map(x => x.source_step_id)]);
  const premier = contexte.source.steps.find(s => adaptees.has(s.id))?.id;
  const lignes = b.actions.map((a, i) => `${i + 1}. ${formaterActionThermomix(a, contexte, { locale })}`);
  if (initialisation ?? b.source_step_id === premier) lignes.unshift(tr(DEPART_VIDE, null, locale));
  return lignes.join('\n');
}
function minuteursBloc(bloc, locale) {
  return bloc.actions.filter(a => a.type === 'reglage').map(a => ({ seconds: a.secondes,
    label: tr('Durée proposée : {d}', { d: duree(a.secondes) }, locale), estimated: true }));
}
function signatureVersion(version) {
  return canon({ source: instantane(version), kind: version.kind, parent_version_id: version.parent_version_id,
    generated_by: version.provenance?.generated_by, invalidated: version.provenance?.thermomix_invalide === true });
}
function fabriquerEtapes(source, blocs, contexte, correspondance) {
  const byId = new Map(blocs.map(b => [b.source_step_id, b]));
  return source.steps.map((s, i) => {
    const id = correspondance.find(x => x.source_step_id === s.id)?.step_id;
    if (!id) erreur('correspondance');
    const b = byId.get(s.id);
    if (!b || !contexte.selection.includes(s.id)) return { ...cloneJson(s), id, position: i + 1 };
    return { id, position: i + 1, text: formaterBlocThermomix(b, contexte, { locale: contexte.langue }),
      timers: minuteursBloc(b, contexte.langue) };
  });
}
export function fabriquerVersionThermomix({ source, contexte, resultat, id, newId, maintenant, modele } = {}) {
  const c = relireContexte(contexte), r = reponseDe(resultat, c);
  if(Object.hasOwn(source,'ingredient_structure')&&!validerStructureIngredients(source.ingredient_structure,source.ingredients).ok)erreur('structure_invalide');
  if (r.type !== 'proposition') erreur('pas_proposition');
  if (empreinteThermomix(source, { incomplete: c.source.incomplete }) !== c.source_signature) erreur('source_modifiee');
  identifiant(id); if (id === source.id || typeof newId !== 'function') erreur('identifiant');
  const date = typeof maintenant === 'function' ? maintenant() : maintenant;
  if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) erreur('date');
  const model = texte(modele || '', 160, { vide: true });
  const anciens = c.anciens_blocs.filter(b => !c.selection.includes(b.source_step_id));
  const blocs = c.source.steps.map(s => [...anciens, ...r.blocs].find(b => b.source_step_id === s.id)).filter(Boolean);
  verifierSequence(blocs, c);
  const correspondance = source.steps.map(s => ({ source_step_id: s.id, step_id: identifiant(newId('st')) }));
  if (new Set(correspondance.map(x => x.step_id)).size !== correspondance.length || correspondance.some(x => source.steps.some(s => s.id === x.step_id))) erreur('identifiant');
  const provenance = cloneJson(source.provenance || {});
  delete provenance.thermomix; delete provenance.thermomix_invalide;
  const version = { ...cloneJson(source), id, kind: 'adaptation', status: 'proposed', parent_version_id: source.id,
    servings: c.source.servings, ingredients: cloneJson(source.ingredients), steps: fabriquerEtapes(c.source, blocs, c, correspondance),
    prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: null,
    changes: tr('Adaptation au TM7 des étapes sélectionnées.', null, c.langue),
    provenance: { ...provenance, derived_from: source.id, generated_by: 'ai', model, incomplete: c.source.incomplete }, created_at: date, updated_at: date };
  delete version.translations; delete version.translation; delete version.plan_invalide; delete version.incomplete;
  version.provenance.thermomix = { revision: 1, profil: PROFIL_TM7.id, contexte: c, resultat: r, blocs,
    correspondance, version_signature: signatureVersion(version), reviewed_at: date, modele: model };
  return version;
}
export function estThermomix(version) { return !!version?.provenance && (own(version.provenance, 'thermomix') || version.provenance.thermomix_invalide === true); }
export function lireThermomix(version) {
  if (!estThermomix(version)) return null;
  try {
    if (version?.provenance?.thermomix_invalide === true) erreur('plan_invalide');
    const p = version.provenance.thermomix;
    ferme(p, ['revision', 'profil', 'contexte', 'resultat', 'blocs', 'correspondance', 'version_signature', 'reviewed_at', 'modele']);
    if (p.revision !== 1 || p.profil !== PROFIL_TM7.id || version.kind !== 'adaptation' || version.provenance.generated_by !== 'ai') erreur('profil');
    if (!['proposed', 'tested'].includes(version.status) || !Number.isFinite(Date.parse(p.reviewed_at))) erreur('statut');
    texte(p.modele, 160, { vide: true });
    if (version.provenance.model !== p.modele) erreur('modele');
    // Reporter les seuls contrôles durcis depuis les premières versions conservées.
    // Toute erreur d'intégrité ultérieure prime : eau/capacité ne prouvent jamais un document intact.
    let motif = null;
    const securite = raison => { motif ??= raison; };
    const c = relireContexte(p.contexte, securite), r = reponseDe(p.resultat, c, securite);
    if (r.type !== 'proposition' || version.parent_version_id !== c.source.id || version.recipe_id !== c.source.recipe_id) erreur('source_modifiee');
    const blocs = c.source.steps.map(s => [...c.anciens_blocs.filter(b => !c.selection.includes(b.source_step_id)), ...r.blocs].find(b => b.source_step_id === s.id)).filter(Boolean);
    if (canon(blocs) !== canon(p.blocs)) erreur('plan_modifie');
    const correspondance = liste(p.correspondance, LIMITES_THERMOMIX.etapes, 1);
    correspondance.forEach(x => { ferme(x, ['source_step_id', 'step_id']); identifiant(x.source_step_id); identifiant(x.step_id); });
    if (correspondance.length !== c.source.steps.length || new Set(correspondance.map(x => x.step_id)).size !== correspondance.length
      || canon(correspondance.map(x => x.source_step_id)) !== canon(c.source.steps.map(s => s.id))
      || correspondance.some(x => c.source.steps.some(s => s.id === x.step_id))) erreur('correspondance');
    const etapes = fabriquerEtapes(c.source, blocs, c, correspondance);
    if (canon(etapes) !== canon(version.steps) || canon(version.ingredients) !== canon(c.source.ingredients) || version.servings !== c.source.servings
      || [version.prep_minutes, version.cook_minutes, version.active_minutes, version.total_minutes].some(x => x !== null)
      || signatureVersion(version) !== p.version_signature) erreur('version_modifiee');
    const document = { plan: cloneJson(p), contexte: c, resultat: r, blocs: cloneJson(blocs) };
    return motif ? { ok: false, etat: 'a_revoir', raison: motif, motifs: [motif], document } : { ok: true, ...document };
  } catch (e) { return { ok: false, raison: e?.raison || 'plan_invalide' }; }
}
export function gardeThermomix(version, portionsDemandees = version?.servings ?? null) {
  const lu = lireThermomix(version);
  if (!lu) return { ok: true };
  if (!lu.ok) return { ok: false, raison: lu.raison };
  if (portionsDemandees !== lu.contexte.source.servings) return { ok: false, raison: 'portions' };
  return { ok: true };
}
export function etiquetteThermomix(version) {
  if (!estThermomix(version)) return null;
  if (version.provenance.thermomix_invalide === true) return 'Version personnelle — d’après une adaptation TM7 avec l’IA';
  return version.status === 'tested' ? 'Adaptée au TM7 avec l’IA · testée' : 'Adaptée au TM7 avec l’IA · non testée';
}
export function copieCookidooThermomix({ recipe, version, book, edition } = {}, { portions: n = version?.servings ?? null, locale = 'fr' } = {}) {
  const garde = gardeThermomix(version, n), lu = lireThermomix(version);
  if (!garde.ok || !lu?.ok) erreur(garde.raison || 'plan_invalide');
  if (recipe?.availability !== 'available' || lu.contexte.source.incomplete) erreur('recette_incomplete');
  const titre = texte(recipe.display_title || recipe.original_title, 500);
  const ingredients = version.ingredients.map(i => ligneIngredientThermomix(i, { locale }));
  const etapes = version.steps.map(s => s.text);
  const mention = tr(etiquetteThermomix(version), null, locale);
  const origine = [book?.title, book?.author, recipe?.printed_page ? tr('Page {p}', { p: recipe.printed_page }, locale) : null,
    edition?.isbn ? `ISBN ${edition.isbn}` : null].filter(x => typeof x === 'string' && x).join(' · ');
  const texteCopie = [titre, mention, tr(AVERTISSEMENT_TM7, null, locale), origine,
    n == null ? tr('Portions inconnues : quantités de la version source.', null, locale) : tr('{n} portions', { n }, locale),
    tr('Ingrédients', null, locale), ...ingredients, tr('Préparation', null, locale), ...etapes.map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join('\n\n');
  return { titre, portions: n, ingredients, etapes, mention, texte: texteCopie };
}
