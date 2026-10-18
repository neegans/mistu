// Tests du lot « Créer une recette avec l'assistant IA » (spec 2026-10-18-creer-avec-l-ia). Aucun réseau ; clés factices.
import { INGREDIENTS, UNIT_DEFINITIONS } from '../src/model/seed.js';
import { buildIngredientIndex, parseIngredientLine } from '../src/domain/lines.js';
import { checkRelations } from '../src/domain/backup.js';
import { APP_VERSION } from '../src/model/schema.js';

export async function runCreerIaTests({ eq, ok }) {
  const C = await import('../src/domain/creation-ia.js');
  buildIngredientIndex(INGREDIENTS); // l'index des lignes est global (lines.js:6) : la suite le pose elle-même (F10)
  eq(APP_VERSION, '0.7.0', 'T1 : APP_VERSION 0.7.0');

  // --- estCreationIA (C-2, F6)
  const synth = { kind: 'synthesis', provenance: { generated_by: 'ai', creation: { demande: 'x' } } };
  eq([C.estCreationIA(synth), C.estCreationIA({ kind: 'adaptation', provenance: { generated_by: 'ai', derived_from: 'rv_1', creation: {} } }), C.estCreationIA({ kind: 'extraction', provenance: { generated_by: 'ai' } }), C.estCreationIA({ kind: 'adaptation', provenance: { generated_by: 'ai' } }), C.estCreationIA({ kind: 'synthesis', provenance: { generated_by: 'manual', creation: {} } }), C.estCreationIA(null)],
    [true, true, false, false, false, false], 'estCreationIA : synthèse IA et adaptation IA dérivée seulement — jamais une extraction IA de livre (F6)');
  eq(C.estCreationIA({ kind: 'adaptation', provenance: { generated_by: 'ai', creation: {} } }), false, 'estCreationIA : une adaptation IA avec création mais SANS derived_from n’en est pas une (la condition derived_from compte seule)');
  {
    const E = C.etiquetteCreationIA;
    const ad = (status) => ({ kind: 'adaptation', status, provenance: { generated_by: 'ai', derived_from: 'rv_1', creation: {} } });
    eq([E(null), E({ ...synth, status: 'tested' }), E({ ...synth, status: 'proposed' }), E(ad('proposed')), E(ad('tested')), E({ kind: 'correction', provenance: { generated_by: 'manual' } }, { origine: 'ia' }), E({ kind: 'adaptation', provenance: { generated_by: 'manual' } }, { origine: 'ia' }), E(null, { origine: 'ia' }), E({ kind: 'extraction', provenance: {} }, { origine: null })],
      [null, 'Créée avec l’IA · testée', 'Créée avec l’IA · non testée', 'Adaptée avec l’IA · non testée', 'Adaptée avec l’IA · testée', 'Corrigée par toi — d’après une création IA', 'Ma version — d’après une création IA', 'Créée avec l’IA', null], 'etiquetteCreationIA : une seule fonction pour l’étiquette (création, adaptation, correction ou version manuelle d’une fiche IA, fiche seule, rien)');
  }

  // --- construireDemandeCreation (§ 4.1, C-10)
  const d = C.construireDemandeCreation({ demande: '  Souper\u200b pour deux   saumon fenouil ', filtres: { diets: ['sans_lactose'], type: 'plat_principal', servings: 2, maxMinutes: 30 }, langue: 'fr' });
  eq(d.demande, 'Souper pour deux saumon fenouil', 'demande : NFC, invisibles retirés, espaces repliés');
  ok(d.system.includes('UNIQUEMENT un objet JSON') && d.system.includes('exactement 2') && d.system.includes('30 minutes') && d.system.includes('métriques canadiennes') && d.system.includes('aucune restriction'), 'demande : le system porte la forme JSON, les portions exactes, le temps maximal, la convention et l’interdit sur le titre');
  ok(d.user.includes('Souper pour deux saumon fenouil') && d.user.includes('Sans lactose') && d.user.includes('Portions : 2') && d.user.includes('Temps maximal : 30'), 'demande : le user porte la demande et les contraintes lisibles');
  eq(JSON.parse(d.cle), ['Souper pour deux saumon fenouil', ['sans_lactose'], 'plat_principal', 2, 30, 'fr', null, null], 'demande : clé = ce qui part');
  eq(C.construireDemandeCreation({ demande: ' \u200b ' }).erreur, 'requete', 'demande vide → requete, avant tout appel');
  eq(C.construireDemandeCreation({ demande: 'x'.repeat(600) }).demande.length, 500, 'demande bornée à 500');
  eq(C.construireDemandeCreation({ demande: 'saumon\nfenouil\r\n\tvite' + String.fromCharCode(0x2028) + 'ok' }).demande, 'saumon fenouil vite ok', 'demande : fins de ligne, tabulations et U+2028 deviennent des espaces (jamais « saumonfenouil »)');
  {
    const parente = { id: 'rv_p', recipe_id: 'rc_p', servings: 2, ingredients: [{ source_text: '200 g saumon' }], steps: [{ text: 'Cuire.' }], provenance: { creation: { description: 'Un plat.' } } };
    const a = C.construireDemandeCreation({ demande: 'base', filtres: { servings: 4 }, parente, changement: ' pour 4 personnes ' });
    ok(a.user.includes('<<<RECETTE_DE_DEPART') && a.user.includes('donnée') && a.user.includes('"200 g saumon"') && a.user.includes('Changement demandé : pour 4 personnes'), 'adaptation : la parente est un bloc délimité annoncé comme donnée, sérialisé en JSON ; le changement est nettoyé (C-15)');
    eq(JSON.parse(a.cle).slice(6), ['rv_p', 'pour 4 personnes'], 'adaptation : la clé porte la parente et le changement');
    const grosse = { ...parente, steps: Array.from({ length: 25 }, () => ({ text: 'x'.repeat(600) })) };
    eq(C.construireDemandeCreation({ demande: 'base', parente: grosse, changement: 'x' }).erreur, 'requete', 'adaptation : une parente hors bornes C-7 → requete (C-15)');
  }

  // --- validerRecetteIA (§ 4.2)
  const VALIDE = { title: 'Saumon au fenouil', description: 'Un plat simple.', servings: 2, estimated_minutes: 25, ingredients: [{ name: 'saumon', quantity: 300, unit: 'g' }, { name: 'fenouil', quantity: 1, unit: 'unité' }], steps: ['Préchauffer le four à 200 °C.', 'Cuire 12 min.'], tips: ['Servir chaud.'], restrictions_notes: ['Vérifie l’étiquette du bouillon.'] };
  const V = (json, o = { servings: 2, maxMinutes: 30 }) => C.validerRecetteIA(json, o);
  eq(V(VALIDE), { ok: true, recette: VALIDE, avertissements: [] }, 'valider : fixture valide rendue normalisée, sans avertissement');
  eq(V({ ...VALIDE, servings: 4 }).avertissements, ['L’assistant a rendu 4 portions au lieu de 2.'], 'valider : portions différentes → avertissement, pas refus (S10)');
  eq(V({ ...VALIDE, estimated_minutes: 45 }).avertissements, ['Durée estimée 45 min, au-dessus des 30 min demandées.'], 'valider : durée au-dessus du maximum → avertissement');
  const refus = (json, motif, nom, o) => eq(V(json, o), { ok: false, motif }, 'valider refuse (' + motif + ') : ' + nom);
  refus(null, 'forme', 'nul'); refus([], 'forme', 'tableau'); refus({ ...VALIDE, title: undefined }, 'forme', 'titre absent'); refus({ ...VALIDE, servings: '2' }, 'forme', 'portions chaîne'); refus({ ...VALIDE, ingredients: 'x' }, 'forme', 'ingrédients chaîne'); refus({ ...VALIDE, steps: ['une seule'] }, 'bornes', 'une étape'); refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 0, unit: 'g' }] }, 'bornes', 'quantité nulle');
  refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 0.0001, unit: 'g' }] }, 'bornes', 'quantité < 0,05'); refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 1.2345, unit: 'g' }] }, 'bornes', '4 décimales'); refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 1e-7, unit: 'g' }] }, 'bornes', 'exposant');
  refus({ ...VALIDE, title: 'x'.repeat(121) }, 'bornes', 'titre 121'); refus({ ...VALIDE, steps: ['a'.repeat(501), 'b'] }, 'bornes', 'étape 501'); refus({ ...VALIDE, ingredients: Array.from({ length: 41 }, () => ({ name: 'x', quantity: 1, unit: 'g' })) }, 'bornes', '41 ingrédients');
  refus({ ...VALIDE, estimated_minutes: 3 }, 'bornes', '3 minutes'); refus({ ...VALIDE, servings: 13 }, 'bornes', '13 portions');
  refus({ ...VALIDE, description: 'Voir https://x.ca' }, 'lien', 'https'); refus({ ...VALIDE, tips: ['www.x.ca'] }, 'lien', 'www'); refus({ ...VALIDE, steps: ['Voir ricardocuisine.com', 'b'] }, 'lien', 'domaine nu'); refus({ ...VALIDE, steps: ['ＨＴＴＰＳ://x.ca', 'b'] }, 'lien', 'pleine chasse (NFKC)');
  refus({ ...VALIDE, steps: ['ＨＴＴＰＳ：／／ｅｘａｍｐｌｅ', 'b'] }, 'lien', 'pleine chasse sans domaine : seul NFKC révèle « https:// »');
  refus({ ...VALIDE, source: 'Ricardo' }, 'lien', 'clé source'); refus({ ...VALIDE, author: 'X' }, 'lien', 'clé author');
  eq(V({ ...VALIDE, note_interne: 'x' }).ok, true, 'valider : une clé inconnue hors liste fermée est ignorée (F20)');
  ok(!('note_interne' in V({ ...VALIDE, note_interne: 'x' }).recette), 'valider : … et jamais rendue');
  refus({ ...VALIDE, title: 'Saumon sans lactose' }, 'affirmation', 'restriction dans le titre'); refus({ ...VALIDE, title: 'Soupe garantie sans gluten' }, 'affirmation', 'certitude'); refus({ ...VALIDE, title: 'Gluten-free bread' }, 'affirmation', 'anglais');
  refus({ ...VALIDE, steps: ['Cuire 999999 min.', 'b'] }, 'caracteres', '\\d{5,} dans une étape'); refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 1, unit: 'g (facultatif)' }] }, 'caracteres', 'unité avec parenthèse'); refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 1, unit: '- 3' }] }, 'caracteres', 'unité avec chiffre'); refus({ ...VALIDE, ingredients: [{ name: '123', quantity: 1, unit: 'g' }] }, 'caracteres', 'nom sans lettre');
  refus({ ...VALIDE, title: 'x\u0301\u0301\u0301b' }, 'caracteres', 'marques combinantes empilées (S14 ; P4 : « a » + U+0301 se recomposerait en « á » sous NFC — « x » ne se recompose pas)');
  for (const q of [1.005, 4.015, 0.05, 10000]) eq(V({ ...VALIDE, ingredients: [{ name: 'x', quantity: q, unit: 'g' }] }).ok, true, 'valider : quantité ' + q + ' acceptée (P8)');
  refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 10000.001, unit: 'g' }] }, 'bornes', '10000.001 (hors borne haute)');
  eq(V({ ...VALIDE, title: '  Saumon\u200b  au fenouil ' }).recette.title, 'Saumon au fenouil', 'valider : invisibles retirés PUIS espaces repliés, avant le test de longueur (F8, P22)');
  eq(V({ ...VALIDE, description: 'a\u200b b' }).recette.description, 'a b', 'valider : un invisible entre deux espaces ne laisse qu’une espace (P22)');
  eq(V({ ...VALIDE, description: 'a \u200b b' }).recette.description, 'a b', 'valider : un invisible ENTRE deux espaces ne laisse qu’une espace — retiré avant le repli (P22)');
  eq(V({ ...VALIDE, steps: ['Mélanger.\nCuire.', 'b'] }).recette.steps, ['Mélanger. Cuire.', 'b'], 'valider : une fin de ligne dans une étape devient une espace — l’étape reste UNE étape, les mots ne se collent pas');
  refus({ ...VALIDE, title: 'Gâteau sans œufs' }, 'affirmation', 'restriction à ligature œ (non décomposée par NFD)');
  { const { title: _t, ...sans } = VALIDE; eq(V(Object.assign(Object.create({ title: 'Hérité' }), sans)), { ok: false, motif: 'forme' }, 'valider : une propriété HÉRITÉE n’est pas lue (S11, P10)'); }
  eq(V(JSON.parse('{"__proto__":{"title":"x"},' + JSON.stringify(VALIDE).slice(1))).ok, true, 'valider : un __proto__ dans le JSON ne pollue rien (S11)');
  eq(V({ ...VALIDE, tips: undefined, restrictions_notes: undefined }).ok, true, 'valider : conseils et notes absents valent [] (P26)');
  eq(C.construireDemandeCreation({ demande: 'base', parente: { id: 'rv_p', recipe_id: 'rc_p', servings: 2, ingredients: [], steps: [{ text: 'a' }] }, changement: ' ' }).erreur, 'requete', 'adaptation : sans changement demandé → requete, aucun appel (P15)');
  eq(C.construireDemandeCreation({ demande: 'x', filtres: { type: 'inconnu', servings: 99, maxMinutes: 2 } }).filtres, { diets: [], type: null, servings: 4, maxMinutes: null }, 'demande : liste blanche du type, portions et temps hors bornes → défauts (P26)');

  // --- texteLigne et fabrication (§ 4.3, N-4, F9, F10, S8b)
  eq([C.texteLigne({ quantity: 1 / 3, unit: 'c. à thé', name: 'sel' }), C.texteLigne({ quantity: 2, unit: 'unité', name: 'œufs' }), C.texteLigne({ quantity: 0.5, unit: 'c. à soupe', name: 'huile d’olive' }), C.texteLigne({ quantity: 200, unit: 'g', name: 'farine' })],
    ['⅓ c. à thé sel', '2 œufs', '½ c. à soupe huile d’olive', '200 g farine'], 'texteLigne : fractions françaises, « unité » omise');
  let compteur = 0; const newId = (p) => `${p}_${++compteur}`;
  const convention = C.conventionCreation('metric_ca'); // P25 : la vraie convention du module des unités
  eq([convention?.id, typeof convention?.revision, convention?.values?.tbsp], ['metric_ca', 'number', 15], 'convention : metric_ca lue du module des unités');
  eq([C.texteLigne({ quantity: 150.5, unit: 'g', name: 'x' }), C.texteLigne({ quantity: 1.005, unit: 'g', name: 'x' })], ['150,5 g x', '1,005 g x'], 'texteLigne : décimale exacte quand l’arrondi dépasse 2 % (P21)');
  eq([0.35, 0.33, 2.5, 0.05].map((quantity) => C.texteLigne({ quantity, unit: 'g', name: 'x' })).concat(C.texteLigne({ quantity: 150.5, unit: 'g', name: 'x' }, 'en')), ['0,35 g x', '⅓ g x', '2½ g x', '0,05 g x', '150.5 g x'], 'texteLigne : une fraction n’est gardée qu’à 2 % près (0,33 → ⅓, 0,35 → 0,35), 2,5 → 2½, décimale à la locale');
  {
    const qs = [1 / 3, 0.5, 2.5, 200, 150.5, 1.005, 0.35, 4.015];
    const relues = qs.map((quantity) => parseIngredientLine(C.texteLigne({ quantity, unit: 'g', name: 'sel' })));
    eq(relues.map((l) => l.quantity?.value), qs, 'texteLigne : le parseur de l’app relit la quantité écrite (aller-retour, N-4)');
    eq([...new Set(relues.map((l) => [l.unit_id, l.name_text].join('|')))], ['g|sel'], 'texteLigne : … et son unité et son nom');
  }
  const fab = C.fabriquerRecetteIA({ recette: VALIDE, demande: 'saumon fenouil', filtres: { diets: ['sans_lactose'], type: 'plat_principal', servings: 2, maxMinutes: 30 }, langue: 'fr', modele: 'claude-sonnet-5-5', usage: { entree: 900, sortie: 700 }, convention, newId, maintenant: '2026-10-18T03:00:00.000Z' });
  eq(fab.recipe, { id: 'rc_1', origine: 'ia', edition_id: null, original_title: 'Saumon au fenouil', original_language: 'fr', type: 'plat_principal', cuisines: [], tags: [], favorite: false, source_page_ids: [], ingredient_ids: ['ing_salmon', 'ing_fennel_bulb'], source_label: 'Créée avec l’IA', unit_convention_id: 'metric_ca', availability: 'available', verification_state: 'to_verify', current_version_id: 'rv_2' }, 'fabrication : fiche exacte (origine ia, convention metric_ca, identités reconnues)');
  const v = fab.version;
  eq([v.id, v.recipe_id, v.kind, v.parent_version_id, v.status, v.servings, v.total_minutes, v.prep_minutes, v.changes, v.notes, v.verification_state], ['rv_2', 'rc_1', 'synthesis', null, 'proposed', 2, null, null, null, null, 'to_verify'], 'fabrication : version synthèse proposée, total_minutes NUL (S6)');
  eq(v.ingredients.map((l) => [l.id, l.source_text, l.ingredient_id, l.unit_id, l.verification_state]), [['ri_3', '300 g saumon', 'ing_salmon', 'g', 'to_verify'], ['ri_4', '1 fenouil', 'ing_fennel_bulb', null, 'to_verify']], 'fabrication : lignes par le parseur, identifiants réattribués par le newId injecté, toutes à vérifier');
  eq(v.steps.map((s) => [s.id, s.position, s.text, (s.timers || []).length]), [['st_5', 1, 'Préchauffer le four à 200 °C.', 0], ['st_6', 2, 'Cuire 12 min.', 1]], 'fabrication : étapes avec minuteurs détectés, identifiants réattribués');
  eq(v.provenance, { source_page_ids: [], source_document_id: null, generated_by: 'ai', model: 'claude-sonnet-5-5', edition_id: null, convention_snapshot: convention, creation: { demande: 'saumon fenouil', filtres: { diets: ['sans_lactose'], type: 'plat_principal', servings: 2, maxMinutes: 30 }, description: 'Un plat simple.', conseils: ['Servir chaud.'], notes_restrictions: ['Vérifie l’étiquette du bouillon.'], minutes_estimees: 25, cree_le: '2026-10-18T03:00:00.000Z', usage: { entree: 900, sortie: 700 } } }, 'fabrication : provenance fidèle (C-11)');
  ok(C.estCreationIA(v), 'fabrication : la version fabriquée satisfait estCreationIA');
  eq(checkRelations({ recipes: [fab.recipe], recipe_versions: [v], ingredients: INGREDIENTS, unit_definitions: UNIT_DEFINITIONS }), [], 'fabrication : aucune relation cassée (I3, S8b)');
  {
    const ad = C.fabriquerRecetteIA({ recette: { ...VALIDE, servings: 4 }, demande: 'saumon fenouil', filtres: { servings: 4 }, langue: 'fr', modele: 'm', usage: null, convention, parente: v, changement: 'pour 4 personnes', newId, maintenant: '2026-10-18T03:05:00.000Z' });
    eq([ad.recipe, ad.version.kind, ad.version.recipe_id, ad.version.parent_version_id, ad.version.provenance.derived_from, ad.version.changes], [null, 'adaptation', 'rc_1', 'rv_2', 'rv_2', 'pour 4 personnes'], 'adaptation : version seule, recipe_id de la parente, derived_from, changes (C-11, C-12, S8b)');
    eq(checkRelations({ recipes: [fab.recipe], recipe_versions: [v, ad.version], ingredients: INGREDIENTS, unit_definitions: UNIT_DEFINITIONS }), [], 'adaptation : relations intactes');
  }

  // --- detectTimers borné (S13, § 3.5)
  const L = await import('../src/domain/lines.js');
  eq((L.detectTimers(Array.from({ length: 175 }, () => '1 s').join(' ')).timers || []).length, 4, 'minuteurs : au plus 4 par étape');
  eq(L.detectTimers('Cuire 99999 h.').timers?.[0]?.seconds, 86400, 'minuteurs : plafonnés à 24 h');
  eq(L.detectTimers('Cuire ' + '9'.repeat(400) + ' h'), {}, 'minuteurs : un nombre qui déborde ne produit rien (ni Infinity ni NaN)');
  eq(L.detectTimers('Laisser reposer 8 min, puis cuire 1 h 30.').timers.map((x) => x.seconds), [480, 5400], 'minuteurs : le cas ordinaire est inchangé');
  eq(L.detectTimers('Mijoter 5 à 99999 min.').timers.map((x) => [x.seconds, x.seconds_max]), [[300, 86400]], 'minuteurs : seconds_max plafonné à 24 h lui aussi');
  ok(!('seconds_max' in L.detectTimers('Cuire 2 h.').timers[0]), 'minuteurs : une durée en heures n’acquiert pas de clé seconds_max');
  eq(L.detectTimers('Cuire 0 min.'), {}, 'minuteurs : une durée nulle ne produit rien');
}
