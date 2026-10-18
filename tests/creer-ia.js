// Tests du lot « Créer une recette avec l'assistant IA » (spec 2026-10-18-creer-avec-l-ia). Aucun réseau ; clés factices.
import { INGREDIENTS, UNIT_DEFINITIONS } from '../src/model/seed.js';
import { buildIngredientIndex, parseIngredientLine } from '../src/domain/lines.js';
import { checkRelations } from '../src/domain/backup.js';
import { APP_VERSION } from '../src/model/schema.js';
import { EN } from '../src/i18n/en.js';

export async function runCreerIaTests({ eq, ok }) {
  const C = await import('../src/domain/creation-ia.js');
  buildIngredientIndex(INGREDIENTS); // l'index des lignes est global (lines.js:6) : la suite le pose elle-même (F10)
  eq(APP_VERSION, '0.7.0', 'T1 : APP_VERSION 0.7.0');

  // --- estCreationIA (C-2, F6)
  const synth = { kind: 'synthesis', provenance: { generated_by: 'ai', creation: { demande: 'x' } } };
  eq([C.estCreationIA(synth), C.estCreationIA({ kind: 'adaptation', provenance: { generated_by: 'ai', derived_from: 'rv_1', creation: {} } }), C.estCreationIA({ kind: 'extraction', provenance: { generated_by: 'ai' } }), C.estCreationIA({ kind: 'adaptation', provenance: { generated_by: 'ai' } }), C.estCreationIA({ kind: 'synthesis', provenance: { generated_by: 'manual', creation: {} } }), C.estCreationIA(null)],
    [true, true, false, false, false, false], 'estCreationIA : synthèse IA et adaptation IA dérivée seulement — jamais une extraction IA de livre (F6)');
  eq(C.estCreationIA({ kind: 'synthesis', provenance: { generated_by: 'ai', creation: 'x' } }), false, 'estCreationIA : « creation » doit être un objet (une chaîne ne suffit pas)');
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
  for (const k of ['source', 'url', 'href', 'link', 'author', 'chef', 'image', 'photo', 'citation']) refus({ ...VALIDE, [k]: 'x' }, 'lien', 'clé refusée « ' + k + ' »');
  refus({ ...VALIDE, image: null }, 'lien', 'clé « image » refusée même nulle (décision de spec)');
  eq(V({ ...VALIDE, note_interne: 'x' }).ok, true, 'valider : une clé inconnue hors liste fermée est ignorée (F20)');
  for (const cle of ['name', 'quantity', 'unit']) {
    const base = { name: 'x', quantity: 1, unit: 'g' };
    const herite = Object.assign(Object.create({ [cle]: base[cle] }), Object.fromEntries(Object.entries(base).filter(([k]) => k !== cle)));
    refus({ ...VALIDE, ingredients: [herite] }, 'forme', 'ingrédient : « ' + cle + ' » hérité non lu');
  }
  eq(V({ ...VALIDE, estimated_minutes: 30 }).avertissements, [], 'valider : une durée égale au maximum demandé n’avertit pas (> et non >=)');
  ok(!('note_interne' in V({ ...VALIDE, note_interne: 'x' }).recette), 'valider : … et jamais rendue');
  refus({ ...VALIDE, title: 'Saumon sans lactose' }, 'affirmation', 'restriction dans le titre'); refus({ ...VALIDE, title: 'Soupe garantie sans gluten' }, 'affirmation', 'certitude'); refus({ ...VALIDE, title: 'Gluten-free bread' }, 'affirmation', 'anglais');
  refus({ ...VALIDE, steps: ['Cuire 999999 min.', 'b'] }, 'caracteres', '\\d{5,} dans une étape'); refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 1, unit: 'g (facultatif)' }] }, 'caracteres', 'unité avec parenthèse'); refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 1, unit: '- 3' }] }, 'caracteres', 'unité avec chiffre'); refus({ ...VALIDE, ingredients: [{ name: '123', quantity: 1, unit: 'g' }] }, 'caracteres', 'nom sans lettre');
  refus({ ...VALIDE, title: 'x\u0301\u0301\u0301b' }, 'caracteres', 'marques combinantes empilées (S14 ; P4 : « a » + U+0301 se recomposerait en « á » sous NFC — « x » ne se recompose pas)');
  for (const q of [1.005, 4.015, 0.05, 10000]) eq(V({ ...VALIDE, ingredients: [{ name: 'x', quantity: q, unit: 'g' }] }).ok, true, 'valider : quantité ' + q + ' acceptée (P8)');
  refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 10000.001, unit: 'g' }] }, 'bornes', '10000.001 (hors borne haute)');
  refus({ ...VALIDE, ingredients: [{ name: 'x', quantity: 0.049, unit: 'g' }] }, 'bornes', '0.049 (sous la borne basse, 3 décimales)');
  // Bornes de la spec, en NOMBRES LITTÉRAUX (jamais lus dans LIMITES_CREATION : une borne changée changerait aussi son test). Maximum accepté,
  // maximum + 1 → bornes, minimum accepté, minimum − 1 → bornes (null = pas de minimum à franchir).
  eq(C.LIMITES_CREATION, { demande: 500, changement: 500, titre: 120, description: 400, portions: [1, 12], minutes: [5, 240], ingredients: [1, 40], nom: 100, unite: 30, quantite: [0.05, 10000], etapes: [2, 20], etape: 500, conseils: [0, 6], conseil: 250, notes: [0, 8], note: 250, tentativeMs: 120000, corps: 1024 * 1024, maxTokens: 16000 }, 'LIMITES_CREATION : valeurs de la spec § 4.1-4.2 épinglées');
  {
    const T = (n) => 'a'.repeat(n);
    const ing = (n) => Array.from({ length: n }, () => ({ name: 'x', quantity: 1, unit: 'g' }));
    const etapes = (n) => Array.from({ length: n }, () => 'Mélanger');
    const conseils = (n) => Array.from({ length: n }, () => 'Servir chaud.');
    const un = (patch) => [{ name: 'x', quantity: 1, unit: 'g', ...patch }];
    const bornes = [
      ['titre', (n) => ({ title: T(n) }), 120, 1], ['description', (n) => ({ description: T(n) }), 400, 1],
      ['portions', (n) => ({ servings: n }), 12, 1], ['minutes estimées', (n) => ({ estimated_minutes: n }), 240, 5],
      ['ingrédients', (n) => ({ ingredients: ing(n) }), 40, 1], ['nom', (n) => ({ ingredients: un({ name: T(n) }) }), 100, 1], ['unité', (n) => ({ ingredients: un({ unit: T(n) }) }), 30, 1],
      ['étapes', (n) => ({ steps: etapes(n) }), 20, 2], ['étape', (n) => ({ steps: [T(n), 'b'] }), 500, 1],
      ['conseils', (n) => ({ tips: conseils(n) }), 6, null], ['conseil', (n) => ({ tips: [T(n)] }), 250, 1],
      ['notes', (n) => ({ restrictions_notes: conseils(n) }), 8, null], ['note', (n) => ({ restrictions_notes: [T(n)] }), 250, 1],
    ];
    for (const [nom, fabrique, max, min] of bornes) {
      eq(V({ ...VALIDE, ...fabrique(max) }).ok, true, 'borne ' + nom + ' : ' + max + ' accepté');
      refus({ ...VALIDE, ...fabrique(max + 1) }, 'bornes', 'borne ' + nom + ' : ' + (max + 1) + ' refusé');
      if (min !== null) {
        eq(V({ ...VALIDE, ...fabrique(min) }).ok, true, 'borne ' + nom + ' : ' + min + ' accepté');
        refus({ ...VALIDE, ...fabrique(min - 1) }, 'bornes', 'borne ' + nom + ' : ' + (min - 1) + ' refusé');
      }
    }
    eq(V({ ...VALIDE, tips: [], restrictions_notes: [] }).ok, true, 'borne conseils et notes : 0 accepté');
  }
  eq(V({ ...VALIDE, title: '  Saumon\u200b  au fenouil ' }).recette.title, 'Saumon au fenouil', 'valider : invisibles retirés PUIS espaces repliés, avant le test de longueur (F8, P22)');
  eq(V({ ...VALIDE, description: 'a\u200b b' }).recette.description, 'a b', 'valider : un invisible entre deux espaces ne laisse qu’une espace (P22)');
  eq(V({ ...VALIDE, description: 'a \u200b b' }).recette.description, 'a b', 'valider : un invisible ENTRE deux espaces ne laisse qu’une espace — retiré avant le repli (P22)');
  eq(V({ ...VALIDE, steps: ['Mélanger.\nCuire.', 'b'] }).recette.steps, ['Mélanger. Cuire.', 'b'], 'valider : une fin de ligne dans une étape devient une espace — l’étape reste UNE étape, les mots ne se collent pas');
  refus({ ...VALIDE, title: 'Gâteau sans œufs' }, 'affirmation', 'restriction à ligature œ (non décomposée par NFD)');
  {
    const LIB = { fr: ['Sans gluten', 'Végétarien', 'Végétalien', 'Sans lactose', 'Sans noix', 'Sans œufs', 'Sans fruits de mer', 'Sans porc', 'Sans alcool'], en: ['Gluten-free', 'Vegetarian', 'Vegan', 'Dairy-free', 'Nut-free', 'Egg-free', 'Seafood-free', 'Pork-free', 'Alcohol-free'] };
    const TOUS = ['sans_gluten', 'vegetarien', 'vegetalien', 'sans_lactose', 'sans_noix', 'sans_oeufs', 'sans_fruits_de_mer', 'sans_porc', 'sans_alcool'];
    for (const lg of ['fr', 'en']) {
      const envoye = C.construireDemandeCreation({ demande: 'x', filtres: { diets: TOUS }, langue: lg }).user;
      eq(LIB[lg].filter((l) => !envoye.includes(l)), [], 'C-9 : la liste de test ' + lg + ' est bien celle que le module envoie au modèle');
    }
    eq(LIB.fr.map((l) => EN[l]), LIB.en, 'C-9 : les libellés anglais envoyés suivent src/i18n/en.js');
    for (const l of [...LIB.fr, ...LIB.en]) {
      refus({ ...VALIDE, title: 'Muffins ' + l.toLowerCase() }, 'affirmation', 'C-9 : « ' + l + ' » en fin de titre');
      refus({ ...VALIDE, title: l + ' muffins' }, 'affirmation', 'C-9 : « ' + l + ' » en tête de titre');
    }
    for (const t of ['Gâteau sans œuf', 'Gâteau sans oeuf', 'Brownies sans-gluten', 'Brownies sans–gluten', 'Brownies sans' + String.fromCharCode(0x2011) + 'gluten', 'Pâtes sans\u200bgluten', 'Pâtes sans\u00adgluten', 'Egg-free banana bread', 'Soupe sans-danger', 'Egg free banana bread', 'Eggless cake', 'Plant-based chili', 'Lactose-free pudding', 'Vegan chili', 'Vegetarian chili', 'Végane', 'Nut free cookies'])
      refus({ ...VALIDE, title: t }, 'affirmation', 'C-9 : variante « ' + t + ' »');
    for (const t of ['Végé-burger', 'Salade sans prétention', 'Saumon au fenouil', 'Poulet sans os'])
      eq(V({ ...VALIDE, title: t }).ok, true, 'C-9 : un titre ordinaire reste accepté (« ' + t + ' »)');
  }
  { const { title: _t, ...sans } = VALIDE; eq(V(Object.assign(Object.create({ title: 'Hérité' }), sans)), { ok: false, motif: 'forme' }, 'valider : une propriété HÉRITÉE n’est pas lue (S11, P10)'); }
  eq(V(JSON.parse('{"__proto__":{"title":"x"},' + JSON.stringify(VALIDE).slice(1))).ok, true, 'valider : un __proto__ dans le JSON ne pollue rien (S11)');
  eq(V({ ...VALIDE, tips: undefined, restrictions_notes: undefined }).ok, true, 'valider : conseils et notes absents valent [] (P26)');
  eq(C.construireDemandeCreation({ demande: 'base', parente: { id: 'rv_p', recipe_id: 'rc_p', servings: 2, ingredients: [], steps: [{ text: 'a' }] }, changement: ' ' }).erreur, 'requete', 'adaptation : sans changement demandé → requete, aucun appel (P15)');
  eq(C.construireDemandeCreation({ demande: 'x', filtres: { type: 'inconnu', servings: 99, maxMinutes: 2 } }).filtres, { diets: [], type: null, servings: 4, maxMinutes: null }, 'demande : liste blanche du type, portions et temps hors bornes → défauts (P26)');
  {
    const e = String.fromCharCode(0xe9);
    eq(C.construireDemandeCreation({ demande: 'Cafe\u200b\u0301 au lait' }).demande, 'Caf' + e + ' au lait', 'demande : NFC APRÈS le retrait des invisibles (Cafe + U+200B + U+0301 → Café)');
    for (const x of ['Cafe\u200b\u0301 au lait', 'e\u0301\u200b\u0301 x', ' a \u200b b ']) {
      const un = C.construireDemandeCreation({ demande: x }).demande;
      eq(C.construireDemandeCreation({ demande: un }).demande, un, 'demande : le nettoyage est idempotent (' + JSON.stringify(un) + ')');
    }
    eq(V({ ...VALIDE, title: 'Cafe\u200b\u0301 noir' }).recette?.title, 'Caf' + e + ' noir', 'valider : NFC après retrait des invisibles dans un titre');
  }
  {
    const d2 = C.construireDemandeCreation({ demande: 'x', filtres: { diets: ['sans_gluten', 'sans_gluten', 'vegetarien'] } });
    eq([d2.filtres.diets, JSON.parse(d2.cle)[1], d2.user.split('Sans gluten').length - 1], [['sans_gluten', 'vegetarien'], ['sans_gluten', 'vegetarien'], 1], 'demande : restrictions dédoublonnées (filtres, clé, invite)');
    eq([C.construireDemandeCreation({ demande: 'x', langue: 'fr-CA' }), C.construireDemandeCreation({ demande: 'x', langue: 'en' })].map((r) => JSON.parse(r.cle)[5]), ['fr', 'en'], 'demande : la clé porte la langue normalisée (fr-CA → fr)');
    eq(C.construireDemandeCreation({ demande: 'x', langue: 'fr-CA' }).cle, C.construireDemandeCreation({ demande: 'x' }).cle, 'demande : deux écritures de la même langue donnent la même clé');
    ok(d.user.includes('Type : plat_principal'), 'demande : la ligne « Type : » est dans le user');
    const sf = C.construireDemandeCreation({ demande: 'x', filtres: { servings: 3, maxMinutes: 45 } }).system;
    const se = C.construireDemandeCreation({ demande: 'x', filtres: { servings: 3, maxMinutes: 45 }, langue: 'en' }).system;
    eq(["au moins 2 étapes", "entre 5 et 240 minutes", "Aucune analyse nutritionnelle chiffrée", "n'est jamais une garantie de sécurité", "ne certifient pas l'absence de traces", "aucun nombre de 5 chiffres", "exactement 3", "45 minutes", "métriques canadiennes"].filter((x) => !sf.includes(x)), [], 'invite FR : bornes de validation et règles du kit');
    eq(['at least 2 steps', 'between 5 and 240 minutes', 'No nutritional analysis with figures', 'never a safety guarantee', 'do not certify the absence of traces', 'no number of 5 digits', 'Servings are exactly 3', 'does not exceed 45 minutes', 'Canadian metric measures'].filter((x) => !se.includes(x)), [], 'invite EN : bornes de validation et règles du kit (l’invite anglaise est exercée)');
    ok(!se.includes('métriques canadiennes') && !sf.includes('Canadian metric'), 'invites : chaque langue a la sienne');
    ok(C.construireDemandeCreation({ demande: 'x', filtres: { diets: ['sans_lactose'] }, langue: 'en' }).user.includes('Requested restrictions : Dairy-free'), 'demande EN : restrictions lues dans le libellé anglais du dictionnaire');
    eq(C.construireDemandeCreation({ demande: 'x', parente: { id: 'rv_p', ingredients: [], steps: [] }, changement: 'y'.repeat(600) }).changement.length, 500, 'adaptation : changement borné à 500');
  }
  {
    const base = { id: 'rv_p', recipe_id: 'rc_p', servings: 2, ingredients: [{ source_text: '200 g saumon' }], steps: [{ text: 'Cuire.' }] };
    const pb = (ov) => C.construireDemandeCreation({ demande: 'base', parente: { ...base, ...ov }, changement: 'x' }).erreur ?? 'ok';
    const etapes = (n, len = 5) => Array.from({ length: n }, () => ({ text: 'x'.repeat(len) }));
    const lignes = (n, len = 5) => Array.from({ length: n }, () => ({ source_text: 'x'.repeat(len) }));
    eq([pb({ steps: etapes(20, 500) }), pb({ steps: etapes(21) }), pb({ steps: etapes(1, 501) }), pb({ ingredients: lignes(40, 150) }), pb({ ingredients: lignes(41) }), pb({ ingredients: lignes(1, 151) })],
      ['ok', 'requete', 'requete', 'ok', 'requete', 'requete'], 'parente C-7/C-15 : nombre d’étapes, longueur d’étape, nombre de lignes, longueur de ligne — chacun seul, à la borne et au-delà');
    eq([pb({ title: 'x'.repeat(120) }), pb({ title: 'x'.repeat(121) }), pb({ title: 'x'.repeat(5000) }), pb({ provenance: { creation: { description: 'x'.repeat(400) } } }), pb({ provenance: { creation: { description: 'x'.repeat(401) } } })],
      ['ok', 'requete', 'requete', 'ok', 'requete'], 'parente C-15 : titre (120) et description (400) bornés aussi');
    const essai = (parente) => { try { return C.construireDemandeCreation({ demande: 'base', parente, changement: 'x' }); } catch (e) { return { leve: e.message }; } };
    eq([essai({ ...base, ingredients: 'abc' }).erreur, essai({ ...base, steps: null }).erreur, essai('abc').erreur, essai([]).erreur], ['requete', 'requete', 'requete', 'requete'], 'parente de forme inattendue (ingredients chaîne, steps nul, chaîne, tableau) → requete, sans exception');
    const bizarre = essai({ ...base, ingredients: [null, 5, {}, { source_text: 7 }, { source_text: '1 oignon' }], steps: [null, { text: 3 }, { text: 'Cuire.' }] });
    eq([bizarre.leve, bizarre.erreur, bizarre.user?.includes('"ingredients":["1 oignon"]'), bizarre.user?.includes('"steps":["Cuire."]')], [undefined, undefined, true, true], 'parente : entrées nulles ou mal typées ignorées, sans exception');
    eq(C.construireDemandeCreation({ demande: 'base', parente: { ...base, title: 'Un titre' }, changement: 'x' }).user.includes('"title":"Un titre"'), true, 'parente : le titre est transmis');
  }
  {
    const essais = [() => C.validerRecetteIA(VALIDE, null), () => C.validerRecetteIA(VALIDE), () => C.validerRecetteIA(VALIDE, 'x'), () => C.construireDemandeCreation(null), () => C.construireDemandeCreation(), () => C.construireDemandeCreation('x'), () => C.construireDemandeCreation({ demande: 'x', filtres: null })];
    eq(essais.map((f) => { try { f(); return 'ok'; } catch (e) { return 'LEVE ' + e.message; } }), essais.map(() => 'ok'), 'robustesse : options nulles ou absentes, entrée nulle ou non objet ne lèvent pas');
    eq([C.validerRecetteIA(VALIDE, null).ok, C.validerRecetteIA(VALIDE).avertissements, C.construireDemandeCreation(null).erreur, C.construireDemandeCreation().erreur], [true, [], 'requete', 'requete'], 'robustesse : valeurs rendues');
    refus({ ...VALIDE, steps: ['Saumon ' + String.fromCharCode(0xd800) + ' grillé', 'b'] }, 'caracteres', 'demi-paire de substitution (le jsonb la refuserait à la synchro)');
    eq(V({ ...VALIDE, steps: ['Saumon ' + String.fromCodePoint(0x1f41f) + ' grillé', 'b'] }).ok, true, 'valider : une paire de substitution valide (emoji) reste acceptée');
  }

  // --- texteLigne et fabrication (§ 4.3, N-4, F9, F10, S8b)
  eq([C.texteLigne({ quantity: 1 / 3, unit: 'c. à thé', name: 'sel' }), C.texteLigne({ quantity: 2, unit: 'unité', name: 'œufs' }), C.texteLigne({ quantity: 0.5, unit: 'c. à soupe', name: 'huile d’olive' }), C.texteLigne({ quantity: 200, unit: 'g', name: 'farine' })],
    ['⅓ c. à thé sel', '2 œufs', '½ c. à soupe huile d’olive', '200 g farine'], 'texteLigne : fractions françaises, « unité » omise');
  let compteur = 0; const newId = (p) => `${p}_${++compteur}`;
  const convention = C.conventionCreation('metric_ca'); // P25 : la vraie convention du module des unités
  eq([convention?.id, typeof convention?.revision, convention?.values?.tbsp], ['metric_ca', 'number', 15], 'convention : metric_ca lue du module des unités');
  eq([C.texteLigne({ quantity: 150.5, unit: 'g', name: 'x' }), C.texteLigne({ quantity: 1.005, unit: 'g', name: 'x' })], ['150,5 g x', '1,005 g x'], 'texteLigne : R-CRE-7 : décimale exacte quand formatNumber ne relit pas la même valeur');
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
  eq(L.detectTimers('Cuire 99999 h.'), {}, 'minuteurs : au-delà de 24 h, aucun minuteur (R-CRE-8 : jamais une durée inventée, pas de plafonnement)');
  eq(L.detectTimers('Cuire ' + '9'.repeat(400) + ' h'), {}, 'minuteurs : un nombre qui déborde ne produit rien (ni Infinity ni NaN)');
  eq(L.detectTimers('Laisser reposer 8 min, puis cuire 1 h 30.').timers.map((x) => x.seconds), [480, 5400], 'minuteurs : le cas ordinaire est inchangé');
  eq(L.detectTimers('À réfrigérer 48 h.'), {}, 'minuteurs : 48 h → aucun minuteur (R-CRE-8)');
  eq(L.detectTimers('Cuire 24 h.').timers.map((x) => x.seconds), [86400], 'minuteurs : 24 h exactement est gardé (borne incluse)');
  eq(L.detectTimers('Cuire 24 h 1 min.').timers?.length ?? 0, 0, 'minuteurs : 24 h 1 min → aucun minuteur');
  eq(L.detectTimers('Réfrigérer de 720 à 1800 min.').timers.map((x) => [x.seconds, x.seconds_max]), [[43200, null]], 'minuteurs : seconds_max de 30 h avec seconds de 12 h → seconds_max null, seconds gardé (R-CRE-8)');
  eq(L.detectTimers('Mijoter 5 à 20 min.').timers.map((x) => [x.seconds, x.seconds_max]), [[300, 1200]], 'minuteurs : une plage ordinaire est inchangée');
  eq(L.detectTimers('Cuire 9 min, puis ' + '9'.repeat(400) + ' h.').timers.map((x) => x.seconds), [540], 'minuteurs : un nombre qui déborde n’efface pas les minuteurs valides de l’étape');
  ok(!('seconds_max' in L.detectTimers('Cuire 2 h.').timers[0]), 'minuteurs : une durée en heures n’acquiert pas de clé seconds_max');
  eq(L.detectTimers('Cuire 0 min.'), {}, 'minuteurs : une durée nulle ne produit rien');
}
