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
  // --- T2 : creerRecetteIA (§ 4.4, C-8, C-13, C-14)
  const reponse = (status, corps, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)), body: null });
  const CLE = 'sk-factice-creation';
  const cfg = { provider: 'anthropic', api_key: CLE, model: 'modele-test' };
  // Toutes les issues rendues par `appel` et par les appels directs : aucune ne doit contenir la clé (C-8), contrôlé en fin de bloc.
  const vues = [];
  // P2 : le faux fetch reçoit `options` (dont `signal`) ; `pendante` écoute l'abandon — sans cela le test du délai bloquerait la suite.
  const appel = (rendre, deps = {}, args = {}) => { const appels = []; const f = async (url, options) => { appels.push({ url, options }); return rendre(appels.length, options); }; return C.creerRecetteIA({ demande: 'saumon fenouil', filtres: { servings: 2 }, langue: 'fr', cfg, ...args }, { fetch: f, enLigne: () => true, ...deps }).then((issue) => { vues.push(issue); return { issue, appels }; }); };
  const pendante = (n, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new DOMException('abandon', 'AbortError')), { once: true }));
  // P13 : `creerRecetteIA` ne journalise que `illisible` et `interne` ; console.error est remplacé le temps du bloc (critère « 0 erreur console »).
  const vraiError = console.error; const erreurs = []; console.error = (...a) => erreurs.push(a);
  try {
  const corpsOk = (texte) => ({ content: [{ type: 'text', text: texte }], stop_reason: 'end_turn', usage: { input_tokens: 900, output_tokens: 700 } });
  for (const [nom, c, etat] of [['absent', undefined, 'non_configure'], ['none', { provider: 'none' }, 'non_configure'], ['sans clé', { provider: 'anthropic', api_key: '', model: 'm' }, 'non_configure'], ['openai', { provider: 'openai_compatible', api_key: 'k', model: 'm', base_url: '' }, 'non_pris_en_charge']]) {
    const { issue, appels } = await appel(() => reponse(200, corpsOk('{}')), {}, { cfg: c });
    eq([issue.etat, appels.length], [etat, 0], 'garde : ' + nom + ' → aucun appel');
  }
  { const { issue, appels } = await appel(() => reponse(200, corpsOk('{}')), {}, { cfg: { ...cfg, api_key: 'clé avec espace' } }); eq([issue.etat, issue.raison, appels.length], ['indisponible', 'cle_refusee', 0], 'garde : clé hors [\\x21-\\x7e] → cle_refusee sans appel'); }
  { const { issue, appels } = await appel(() => reponse(200, corpsOk('{}')), { enLigne: () => false }); eq([issue.raison, appels.length], ['hors_ligne', 0], 'garde : hors ligne'); }
  { const { issue, appels } = await appel(() => reponse(200, corpsOk('{}')), {}, { demande: ' ' }); eq([issue.raison, appels.length], ['requete', 0], 'garde : demande vide'); }
  { const { issue, appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE)))); 
    const corps = JSON.parse(appels[0].options.body);
    eq([issue.etat, issue.recette.title, issue.usage, issue.modele, corps.max_tokens, corps.model, 'thinking' in corps, 'tools' in corps, appels[0].options.redirect, appels[0].options.credentials, appels[0].options.headers['x-api-key'] === CLE, JSON.stringify(issue).includes(CLE)],
      ['trouve', 'Saumon au fenouil', { entree: 900, sortie: 700 }, 'modele-test', 16000, 'modele-test', false, false, 'error', 'omit', true, false], 'trouve : recette validée, usage, 16 000 jetons, sans thinking ni outil, redirect error, clé dans l’en-tête et nulle part ailleurs (C-8)'); }
  { const { issue } = await appel(() => reponse(200, corpsOk('Voici la recette :\n' + JSON.stringify(VALIDE) + '\nBon appétit'))); eq(issue.etat, 'trouve', 'trouve : prose autour du JSON tolérée (parseJsonLoose)'); }
  { const { issue } = await appel(() => reponse(200, corpsOk(JSON.stringify({ ...VALIDE, title: 'Soupe sans gluten' })))); eq([issue.etat, issue.raison, issue.motif], ['indisponible', 'illisible', 'affirmation'], 'illisible : une recette invalide porte son motif (C-3)'); }
  { const { issue } = await appel(() => reponse(200, { content: [{ type: 'text', text: '{' }], stop_reason: 'max_tokens' })); eq(issue.raison, 'interrompu', 'coupure : max_tokens → interrompu (C-13)'); }
  { const { issue } = await appel(() => reponse(200, { content: [], stop_reason: 'refusal' })); eq(issue.raison, 'refus', 'refus du modèle → refus'); }
  { const { issue } = await appel(() => reponse(200, { content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: JSON.stringify(VALIDE) }], stop_reason: 'end_turn' })); eq(issue.etat, 'trouve', 'seuls les blocs text sont lus (F11)'); }
  for (const [status, raison] of [[401, 'cle_refusee'], [429, 'trop_de_demandes'], [400, 'requete'], [403, 'cle_refusee'], [500, 'serveur'], [418, 'requete'], [302, 'serveur']]) { const { issue } = await appel(() => reponse(status, 'CORPS-SENTINELLE')); eq([issue.raison, JSON.stringify(issue).includes('SENTINELLE')], [raison, false], `statut ${status} → ${raison}, corps d’erreur jamais dans l’issue`); }
  { const { issue } = await appel(() => { throw new TypeError('Failed to fetch'); }); eq(issue.raison, 'reseau', 'réseau'); }
  { const { issue } = await appel(() => reponse(200, 'pas du json')); eq(issue.raison, 'reponse_illisible', 'corps HTTP non JSON → reponse_illisible (F19)'); }
  { const { issue } = await appel(() => reponse(200, corpsOk('Je ne peux pas, désolé.'))); eq([issue.raison, issue.motif], ['illisible', 'json'], 'texte du modèle sans JSON → illisible, motif json (C-3, P13)'); }
  { const ctl = new AbortController(); ctl.abort(); const { issue, appels } = await appel(() => reponse(200, corpsOk('{}')), { signal: ctl.signal }); eq([issue.raison, appels.length], ['annule', 0], 'déjà annulé → annule sans fetch'); }
  // Une garde de 2 s : si un relais d'abandon disparaît, `pendante` ne se rejette jamais — le test ROUGIT au lieu de pendre la suite.
  const avecGarde = async (p) => { let minuterie; try { return await Promise.race([p, new Promise((fin) => { minuterie = setTimeout(() => fin({ issue: { raison: 'PENDU : le relais d’abandon n’a pas joué' } }), 2000); })]); } finally { clearTimeout(minuterie); } };
  { const { issue } = await avecGarde(appel(pendante, { tentativeMs: 5 })); eq(issue.raison, 'delai', 'délai → delai (P2)'); }
  { const c = new AbortController(); const p = appel(pendante, { signal: c.signal, tentativeMs: 60000 }); c.abort(); const { issue } = await avecGarde(p); eq(issue.raison, 'annule', 'abandon extérieur en vol → annule (P2/P18)'); }
  { const c = new AbortController(); const sourd = () => new Promise((fin) => setTimeout(() => fin(reponse(200, corpsOk(JSON.stringify(VALIDE)))), 80)); setTimeout(() => c.abort(), 20); const { issue, appels } = await appel(sourd, { signal: c.signal, tentativeMs: 60000 }); eq([issue.etat, issue.raison, issue.recette, appels.length], ['indisponible', 'annule', null, 1], 'abandon extérieur : un fetch sourd au signal qui répond après l’abandon rend annule, jamais la recette'); }
  { const { issue } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), { corpsMax: 10 }); eq(issue.raison, 'reponse_illisible', 'corps au-dessus de corpsMax → reponse_illisible'); }
  { const vraie = new Response(JSON.stringify(corpsOk(JSON.stringify(VALIDE))), { status: 200, headers: { 'content-type': 'application/json' } }); const { issue } = await appel(() => vraie); eq(issue.etat, 'trouve', 'corps lu en flux (vraie Response) → trouve (P18, V-F1)'); }
  { const { issue } = await appel(() => reponse(200, corpsOk(JSON.stringify({ ...VALIDE, title: 't'.repeat(120), ingredients: Array.from({ length: 40 }, (_, i) => ({ name: 'ing' + i, quantity: 1, unit: 'g' })), steps: Array.from({ length: 20 }, () => 'é'.repeat(500)) })))); eq(issue.etat, 'trouve', 'bornes maximales acceptées (P18)'); }

  // --- T2, compléments de l'implémenteur : ce qui part, ce qui revient, ce qui ne lève jamais
  { const { issue, appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { langue: 'en' });
    const corps = JSON.parse(appels[0].options.body);
    eq([Object.keys(corps).sort(), typeof corps.system, corps.messages.length, corps.messages[0].role, corps.messages[0].content.includes('saumon fenouil'), corps.system.includes('You design'), corps.system.includes('exactly 2'), appels[0].url, appels[0].options.method, appels[0].options.headers['anthropic-version'], appels[0].options.signal instanceof AbortSignal, issue.etat],
      [['max_tokens', 'messages', 'model', 'system'], 'string', 1, 'user', true, true, true, 'https://api.anthropic.com/v1/messages', 'POST', '2023-06-01', true, 'trouve'], 'corps : exactement model, max_tokens, system, messages ; en anglais en interface anglaise ; adresse Messages ; un signal'); }
  { const { appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE)))); ok(appels[0].options.signal.aborted === true, 'sortie : le signal du fetch est abandonné à la sortie (ctl.abort() en finally)'); }
  { const { issue } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { filtres: { servings: 4, maxMinutes: 10 } }); eq([issue.etat, issue.avertissements], ['trouve', ['L’assistant a rendu 2 portions au lieu de 4.', 'Durée estimée 25 min, au-dessus des 10 min demandées.']], 'avertissements : portions et durée comparées aux filtres normalisés de la demande'); }
  { const { issue } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { filtres: null }); eq([issue.etat, issue.avertissements], ['trouve', ['L’assistant a rendu 2 portions au lieu de 4.']], 'filtres nuls : portions par défaut 4, aucune levée'); }
  { const { issue } = await appel(() => reponse(200, { content: [{ type: 'text', text: JSON.stringify(VALIDE) }], stop_reason: 'max_tokens' })); eq(issue.raison, 'interrompu', 'coupure : un JSON complet mais stop_reason max_tokens reste interrompu (C-13)'); }
  { const { issue } = await appel(() => reponse(200, { content: [{ type: 'text', text: JSON.stringify(VALIDE) }], stop_reason: 'refusal' })); eq(issue.raison, 'refus', 'refus : stop_reason refusal l’emporte sur un texte présent'); }
  for (const [nom, usage] of [['absent', undefined], ['chaînes', { input_tokens: 'x', output_tokens: '7' }], ['négatifs', { input_tokens: -1, output_tokens: 5 }], ['partiel', { input_tokens: 9 }], ['objet nu', 7]]) {
    const { issue } = await appel(() => reponse(200, { content: [{ type: 'text', text: JSON.stringify(VALIDE) }], stop_reason: 'end_turn', ...(usage === undefined ? {} : { usage }) }));
    eq([issue.etat, issue.usage], ['trouve', null], 'usage ' + nom + ' → null, la recette est quand même rendue');
  }
  { const { issue } = await appel(() => reponse(200, { content: [{ type: 'thinking', thinking: 'brouillon {"title":"faux"}', text: '{"title":"faux"}' }, { type: 'text', text: JSON.stringify(VALIDE) }], stop_reason: 'end_turn' })); eq([issue.etat, issue.recette?.title], ['trouve', 'Saumon au fenouil'], 'blocs : un bloc non text ne contribue jamais au texte lu, même avec un champ text ou un brouillon à accolades'); }
  { const { issue } = await appel(() => reponse(200, { content: [null, 7, { type: 'text', text: 12 }, { type: 'text' }, { type: 'text', text: JSON.stringify(VALIDE) }], stop_reason: 'end_turn' })); eq(issue.etat, 'trouve', 'blocs hostiles (null, nombre, text non chaîne) ignorés, le bloc text valide est lu'); }
  { const { issue } = await appel(() => reponse(200, { content: 'x', stop_reason: 'end_turn' })); eq(issue.raison, 'reponse_illisible', 'content qui n’est pas un tableau → reponse_illisible'); }
  { const { issue } = await appel(() => reponse(200, [1, 2])); eq(issue.raison, 'reponse_illisible', 'corps JSON qui n’est pas un objet → reponse_illisible'); }
  { const { issue } = await appel(() => ({ status: 200 })); eq(issue.raison, 'interne', 'réponse sans text() ni flux → interne (V-C6), pas reseau'); }
  { const { issue } = await appel(() => ({ ok: true, status: 200, text: async () => { throw new Error('flux coupé'); } })); eq(issue.raison, 'reseau', 'lecture du corps qui échoue → reseau'); }
  { const gros = new Response(JSON.stringify(corpsOk(JSON.stringify(VALIDE))), { status: 200 }); const { issue } = await appel(() => gros, { corpsMax: 100 }); eq(issue.raison, 'reponse_illisible', 'vraie Response au-dessus de corpsMax → reponse_illisible (lecture en flux coupée)'); }
  { const { issue, appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { cfg: { ...cfg, api_key: 'a\u0000b' } }); eq([issue.raison, appels.length], ['cle_refusee', 0], 'garde : clé avec un caractère de contrôle → cle_refusee sans appel'); }
  { const { issue, appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { cfg: { ...cfg, api_key: 12345 } }); eq([issue.etat, appels.length], ['non_configure', 0], 'garde : clé qui n’est pas une chaîne → non_configure sans appel'); }
  { const { issue, appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { cfg: { ...cfg, model: '' } }); eq([issue.etat, appels.length], ['non_configure', 0], 'garde : modèle vide → non_configure sans appel'); }
  { const { issue, appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { cfg: { ...cfg, model: 42 } }); eq([issue.etat, issue.modele, appels.length], ['non_configure', null, 0], 'garde : modèle qui n’est pas une chaîne → non_configure sans appel, modèle null dans l’issue'); }
  { let lectures = 0; const { issue, appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { cfg: { provider: 'anthropic', api_key: CLE, get model() { lectures += 1; return 'modele-' + lectures; } } }); eq([issue.etat, issue.modele, JSON.parse(appels[0].options.body).model, lectures], ['trouve', 'modele-1', 'modele-1', 1], 'modèle : lu UNE seule fois, le corps et l’issue portent la même valeur'); }
  {
    const parente = { id: 'rv_p', recipe_id: 'rc_p', title: 'Saumon', servings: 2, ingredients: [{ source_text: '200 g saumon' }], steps: [{ text: 'Cuire.' }], provenance: { creation: { description: 'Un plat.' } } };
    const { issue, appels } = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { parente, changement: ' pour 4 personnes ' });
    const contenu = JSON.parse(appels[0].options.body).messages[0].content;
    eq([issue.etat, contenu.includes('<<<RECETTE_DE_DEPART'), contenu.includes('Changement demandé : pour 4 personnes')], ['trouve', true, true], 'adaptation : la parente et le changement sont transmis à la demande');
    const sans = await appel(() => reponse(200, corpsOk(JSON.stringify(VALIDE))), {}, { parente, changement: '  ' });
    eq([sans.issue.raison, sans.appels.length], ['requete', 0], 'adaptation sans changement → requete, aucun appel (P15)');
  }
  { // « ne lève jamais » : chaque entrée absurde rend une issue, avec la raison attendue
    const enLigne = () => true;
    // Aucun réseau : les entrées sans fetch propre reçoivent un espion qui enregistre puis lève ; il ne doit JAMAIS être appelé.
    const reseauTente = [];
    const espion = () => { reseauTente.push(1); throw new Error('réseau interdit dans la suite'); };
    const ENTREES = [
      ['rien', [undefined, undefined], ['non_configure', null]], ['nuls', [null, null], ['non_configure', null]], ['nombre', [42, {}], ['non_configure', null]], ['chaîne', ['x', { fetch: 3 }], ['non_configure', null]], ['cfg nul', [{ cfg: null }, {}], ['non_configure', null]],
      ['getter qui lève', [{ demande: 'saumon', cfg: { provider: 'anthropic', api_key: CLE, get model() { throw new Error('boom'); } } }, { fetch: espion, enLigne }], ['indisponible', 'interne']],
      ['enLigne qui lève', [{ demande: 'saumon', cfg }, { fetch: espion, enLigne: () => { throw new Error('boom'); } }], ['indisponible', 'interne']],
      ['fetch qui lève (sync)', [{ demande: 'saumon', cfg }, { fetch: () => { throw new RangeError('boom'); }, enLigne }], ['indisponible', 'reseau']],
      ['fetch rend null', [{ demande: 'saumon', cfg }, { fetch: async () => null, enLigne }], ['indisponible', 'interne']],
      ['signal qui n’en est pas un', [{ demande: 'saumon', cfg }, { fetch: async () => reponse(200, 'x'), enLigne, signal: { aborted: false } }], ['indisponible', 'interne']],
      ['demande non chaîne', [{ demande: { toString() { throw new Error('boom'); } }, cfg }, { fetch: espion, enLigne }], ['indisponible', 'requete']],
    ];
    const rendus = [];
    for (const [, [a, dp]] of ENTREES) { let i; try { i = await C.creerRecetteIA(a, dp); } catch (e) { i = { etat: 'LEVE', raison: String(e) }; } vues.push(i); rendus.push([i.etat, i.raison]); }
    eq(rendus, ENTREES.map((e) => e[2]), 'ne lève jamais : ' + ENTREES.map((e) => e[0]).join(', '));
    eq(reseauTente.length, 0, 'aucun réseau : l’espion des trois entrées sans fetch propre n’a jamais été appelé');
  }
  ok(vues.every((i) => !JSON.stringify(i).includes(CLE)), 'clé : aucune des issues rendues par le bloc ne la contient (C-8)');
  ok(!JSON.stringify(erreurs).includes(CLE), 'journal : la clé n’est jamais journalisée (C-8)');
  // P13 : chaque entrée du journal est EXACTEMENT { reason } ou { reason, name } (clés SAFE de log.js, jamais un corps ni un id), reason dans une liste fermée.
  const RAISON_JOURNAL = /^(interne|illisible:(json|forme|bornes|lien|affirmation|caracteres))$/;
  const cles = (a) => Object.keys(a[1] || {}).sort().join(',');
  ok(erreurs.length >= 2, 'journal : le bloc a journalisé (au moins un illisible et un interne)');
  ok(erreurs.every((a) => a.length === 2 && a[0] === '[cuisine-os] creation_ia' && /^(reason|name,reason)$/.test(cles(a))), 'journal : chaque entrée est exactement { reason } ou { reason, name }, sous le code creation_ia (P13)');
  ok(erreurs.every((a) => RAISON_JOURNAL.test(a[1].reason) && (a[1].name === undefined || (a[1].reason === 'interne' && /Error$/.test(a[1].name)))), 'journal : reason dans la liste fermée (interne | illisible:motif) ; name seulement avec interne');
  ok(erreurs.some((a) => a[1].reason === 'illisible:json') && erreurs.some((a) => a[1].reason === 'illisible:affirmation') && erreurs.some((a) => a[1].reason === 'interne'), 'journal : illisible:json, illisible:affirmation et interne ont chacun été journalisés');
  } finally { console.error = vraiError; }

  // --- T5 : N-8 « une ligne non vérifiée ne certifie rien » (règle ASYMÉTRIQUE, R-CRE-1) et N-9 « telle qu'écrite » (S1, S2, F12, P5, P11)
  {
    const { assessVersion, assessMeal } = await import('../src/domain/diet.js');
    const { buildShoppingList } = await import('../src/domain/grocery.js');
    const { ingredientLineEl } = await import('../src/ui/components.js');
    const { renderCook } = await import('../src/ui/cook.js');
    const { parseQuery, buildDocs, searchDocs } = await import('../src/domain/search.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const ING_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));
    const L1 = (txt) => ({ ...parseIngredientLine(txt), verification_state: 'to_verify' });
    const VER = (txt) => ({ ...parseIngredientLine(txt), verification_state: 'verified' });
    const version = (...lignes) => ({ id: 'v', ingredients: lignes });

    // N-8 : sans correspondance bloquante, une ligne non vérifiée est INCONNUE — jamais compatible (S1/F12).
    for (const [txt, diet] of [['60 g farine, beurre et lait', 'sans_lactose'], ['125 ml pesto au basilic', 'sans_lactose'], ['30 g beurre d’amande', 'sans_noix']]) {
      const a = assessVersion(version(L1(txt)), ING_BY_ID, diet);
      eq([a.state, a.unknown.length, a.blocking.length], ['to_verify', 1, 0], `N-8 : « ${txt} » non vérifiée, sans allergène bloquant dans l’identité proposée → à vérifier, jamais compatible (S1/F12)`);
    }
    // R-CRE-6 : « lait de coco » — le seed n'a pas d'entrée coco ; le parseur propose ing_milk (mesuré), qui porte le lactose.
    eq(parseIngredientLine('250 ml lait de coco').ingredient_id, 'ing_milk', 'R-CRE-6 (mesure) : le parseur propose ing_milk pour « lait de coco » (le seed n’a pas de coco)');
    {
      const a = assessVersion(version(L1('250 ml lait de coco')), ING_BY_ID, 'sans_lactose');
      eq([a.state, a.unknown.length, a.blocking.map((b) => [b.ingredient_id, b.proposed])], ['incompatible', 0, [['ing_milk', true]]],
        'N-8 : « lait de coco » non vérifié, identité proposée bloquante → incompatible, signalé « proposée » (faux positif prudent, F12 : jamais assouplir)');
    }
    // N-8 : l'autre côté de l'asymétrie — une ligne VÉRIFIÉE se comporte comme avant.
    eq(assessVersion(version(VER('60 g farine')), ING_BY_ID, 'sans_lactose').state, 'compatible', 'N-8 : une ligne VÉRIFIÉE sans allergène bloquant reste compatible');
    {
      const a = assessVersion(version(VER('250 ml lait')), ING_BY_ID, 'sans_lactose');
      eq([a.state, a.blocking.map((b) => b.proposed)], ['incompatible', [false]], 'N-8 : une ligne vérifiée bloquante reste incompatible, non « proposée »');
    }
    // N-8 : jamais assouplir — une correspondance bloquante sur une ligne non vérifiée bloque encore (puttanesca au blé, tests.js).
    {
      const a = assessVersion(version(L1('400 g de spaghetti')), ING_BY_ID, 'sans_gluten');
      eq([a.state, a.blocking.map((b) => [b.ingredient_id, b.proposed])], ['incompatible', [['ing_wheat_pasta', true]]], 'N-8 : spaghetti non vérifié + sans gluten → toujours incompatible (jamais assoupli)');
      eq(assessVersion(version(L1('parmesan (facultatif)')), ING_BY_ID, 'vegetalien').state, 'adaptation', 'N-8 : un bloquant facultatif non vérifié reste une adaptation');
      eq(assessVersion(version(L1('1 tasse de mystère')), ING_BY_ID, 'sans_gluten').state, 'to_verify', 'N-8 : une ligne sans identité reste à vérifier');
      // un mélange : un bloquant non vérifié l'emporte sur une ligne vérifiée sans allergène, et une inconnue ne cache pas un bloquant
      eq(assessVersion(version(VER('60 g farine'), L1('400 g de spaghetti'), L1('1 tasse de mystère')), ING_BY_ID, 'sans_gluten').state, 'incompatible', 'N-8 : un bloquant non vérifié l’emporte sur le reste');
      // une seule ligne vérifiée compatible ne rachète pas une ligne non vérifiée sans allergène : le tout reste à vérifier
      eq(assessVersion(version(VER('60 g farine'), L1('2 gousses d’ail')), ING_BY_ID, 'sans_lactose').state, 'to_verify', 'N-8 : vérifiée compatible + non vérifiée sans allergène → à vérifier (rien ne certifie la seconde)');
      eq(assessVersion(version(VER('60 g farine'), VER('2 gousses d’ail')), ING_BY_ID, 'sans_lactose').state, 'compatible', 'N-8 : toutes vérifiées, aucun allergène → compatible');
      // R-CRE-9 : un bloquant FACULTATIF ne masque jamais une ligne inconnue (« information manquante jamais assimilée à une absence »).
      {
        const a = assessVersion(version(L1('125 ml pesto au basilic'), L1('parmesan (facultatif)')), ING_BY_ID, 'sans_lactose');
        eq([a.state, a.unknown.length, a.blocking.map((b) => [b.ingredient_id, b.optional, b.proposed])], ['to_verify', 1, [['ing_parmesan', true, true]]], 'R-CRE-9 : pesto non vérifié + parmesan facultatif bloquant → à vérifier (retirer le parmesan ne suffit pas à conclure)');
        eq(assessVersion(version(L1('1 tasse de mystère'), L1('parmesan (facultatif)')), ING_BY_ID, 'sans_lactose').state, 'to_verify', 'R-CRE-9 : une ligne sans identité + un facultatif bloquant → à vérifier');
        const b = assessVersion(version(VER('60 g farine'), VER('parmesan (facultatif)')), ING_BY_ID, 'sans_lactose');
        eq([b.state, b.unknown.length, b.blocking.map((x) => [x.optional, x.proposed])], ['adaptation', 0, [[true, false]]], 'R-CRE-9 : tout vérifié + seul un facultatif bloque → adaptation (inchangé)');
      }
      // F2 : une ligne SANS verification_state (donnée ancienne) n'est pas vérifiée — l'état se lit « différent de verified », jamais « égal à to_verify ».
      {
        const SANS_ETAT = (txt) => { const { verification_state: _etat, ...ligne } = parseIngredientLine(txt); return ligne; };
        ok(!('verification_state' in SANS_ETAT('60 g farine')), 'F2 (fixture) : la ligne de test n’a pas de verification_state');
        const a = assessVersion(version(SANS_ETAT('60 g farine')), ING_BY_ID, 'sans_lactose');
        eq([a.state, a.unknown.length, a.blocking.length], ['to_verify', 1, 0], 'N-8 : une ligne sans verification_state sans allergène bloquant → à vérifier, jamais compatible');
        const b = assessVersion(version(SANS_ETAT('250 ml lait')), ING_BY_ID, 'sans_lactose');
        eq([b.state, b.blocking.map((x) => x.proposed)], ['incompatible', [true]], 'N-8 : une ligne sans verification_state bloquante bloque encore, « proposée »');
      }
    }
    // N-8 dans la recherche et dans les repas : les deux consommateurs de assessVersion héritent de la règle.
    {
      const recettes = [
        { id: 'rN', edition_id: 'e1', original_title: 'Gratin non vérifié', availability: 'available', type: 'plat_principal', current_version_id: 'vN' },
        { id: 'rV', edition_id: 'e1', original_title: 'Gratin vérifié', availability: 'available', type: 'plat_principal', current_version_id: 'vV' },
      ];
      const vN = { id: 'vN', recipe_id: 'rN', kind: 'extraction', servings: 2, total_minutes: 30, ingredients: [L1('60 g farine')], steps: [] };
      const vV = { id: 'vV', recipe_id: 'rV', kind: 'extraction', servings: 2, total_minutes: 30, ingredients: [VER('60 g farine')], steps: [] };
      const docs = buildDocs({ recipes: recettes, versions: [vN, vV], editions: [{ id: 'e1', book_id: 'b1' }], books: [{ id: 'b1', title: 'Livre', author: 'A' }], dishes: [], links: [] });
      const r = searchDocs(docs, parseQuery('plat principal sans lactose'), { mode: 'all', ingredientsById: ING_BY_ID });
      eq([r.admissible.map((h) => h.doc.recipe.id), r.to_verify.map((h) => h.doc.recipe.id), r.incompatible], [['rV'], ['rN'], 0], 'N-8 : recherche sans lactose — la recette aux lignes vérifiées est admissible, celle aux lignes non vérifiées est « à vérifier »');
      eq([assessMeal([{ version: vN, title: 'N' }], ING_BY_ID, 'sans_lactose').state, assessMeal([{ version: vV, title: 'V' }], ING_BY_ID, 'sans_lactose').state], ['to_verify', 'compatible'], 'N-8 : un repas n’est « compatible » que si ses lignes sont vérifiées');
    }

    // N-9 : l'affichage. La langue d'interface est posée et rendue (P17).
    const localeAvant = getUiLocale();
    setUiLocale('fr');
    try {
      const CTX = { system: 'original', locale: 'fr', readingLocale: 'original', originalLocale: 'fr', showSource: true };
      const textes = (li, sel) => [...li.querySelectorAll(sel)].map((n) => n.textContent);
      const nom = (li) => li.querySelector('.row').children[1];
      {
        const li = ingredientLineEl(L1('250 ml lait de coco'), CTX, ING_BY_ID);
        eq(nom(li).childNodes[0].textContent, 'lait de coco', 'N-9 : une ligne non vérifiée affiche le texte tel qu’écrit (« lait de coco »), pas le libellé du lexique');
        eq(textes(nom(li), '.muted'), [' (identité proposée : lait ?)'], 'N-9 : … et mentionne l’identité proposée, avec un point d’interrogation (S2)');
        ok(li.textContent.includes('À vérifier'), 'N-9 : la puce « À vérifier » reste');
      }
      {
        const li = ingredientLineEl(VER('250 ml lait'), CTX, ING_BY_ID);
        eq([nom(li).childNodes[0].textContent, textes(nom(li), '.muted'), li.textContent.includes('identité proposée'), li.textContent.includes('À vérifier')], ['lait', [], false, false], 'N-9 : une ligne vérifiée garde le libellé du lexique, sans mention ni puce');
      }
      {
        const li = ingredientLineEl({ ...L1('250 ml lait'), name_text: '' }, CTX, ING_BY_ID);
        eq(nom(li).childNodes[0].textContent, '250 ml lait', 'N-9 : sans name_text, une ligne non vérifiée retombe sur son texte source');
        const sans = ingredientLineEl(L1('1 tasse de mystère'), CTX, ING_BY_ID);
        eq([nom(sans).childNodes[0].textContent, textes(sans, '.muted').filter((x) => x.includes('identité proposée'))], ['mystère', []], 'N-9 : une ligne sans identité proposée n’a pas de mention');
      }
      {
        // Le badge « Traduction » dit « ce libellé est traduit » : faux pour un texte écrit (P11). Lecture en anglais d'une ligne française.
        const EN_CTX = { ...CTX, readingLocale: 'en' };
        const verif = ingredientLineEl(VER('250 ml lait'), EN_CTX, ING_BY_ID);
        const nonVerif = ingredientLineEl(L1('250 ml lait'), EN_CTX, ING_BY_ID);
        eq([textes(verif, '.badge'), nom(verif).childNodes[0].textContent], [['Traduction'], ING_BY_ID.get('ing_milk').labels.en.label], 'P11 : une ligne vérifiée lue en anglais est traduite → badge « Traduction »');
        eq([textes(nonVerif, '.badge'), nom(nonVerif).childNodes[0].textContent], [[], 'lait'], 'P11 : une ligne non vérifiée est affichée telle qu’écrite → aucun badge « Traduction »');
      }
      {
        // F2 : la puce « À vérifier » suit « n'est pas vérifiée », pas la valeur littérale 'to_verify' (ligne sans état, état inconnu).
        const sansEtat = (() => { const { verification_state: _etat, ...ligne } = parseIngredientLine('250 ml lait de coco'); return ligne; })();
        const puces = [sansEtat, { ...sansEtat, verification_state: 'unverified' }, { ...sansEtat, verification_state: 'to_verify' }].map((l) => textes(ingredientLineEl(l, CTX, ING_BY_ID), '.chip.warn'));
        eq(puces, [['À vérifier'], ['À vérifier'], ['À vérifier']], 'F2 : la puce « À vérifier » s’affiche pour toute ligne non vérifiée (sans état, « unverified », « to_verify »)');
        eq(textes(ingredientLineEl(VER('250 ml lait'), CTX, ING_BY_ID), '.chip.warn'), [], 'F2 : … et jamais pour une ligne vérifiée');
        const li = ingredientLineEl(sansEtat, CTX, ING_BY_ID);
        eq([nom(li).childNodes[0].textContent, textes(nom(li), '.muted')], ['lait de coco', [' (identité proposée : lait ?)']], 'F2 : une ligne sans état s’affiche telle qu’écrite, avec la mention');
      }
      {
        // F3 (durcissement) : l'identité PROPOSÉE n'est jamais passée à qtyEl — jamais une conversion par une identité non vérifiée. Le seed n'a aucune
        // équivalence volume↔masse et displayQuantity ne traverse pas les dimensions : aucune différence observable aujourd'hui, ce test épingle
        // l'INTENTION (quantité rendue telle quelle, équivalences de l'identité proposée jamais lues).
        const lues = [];
        const lait = new Proxy({ ...ING_BY_ID.get('ing_milk'), equivalences: [{ volume_unit_id: 'ml', volume_value: 100, mass_g: 103, source: 'x' }] }, { get(cible, cle) { if (cle === 'equivalences') lues.push(cle); return cible[cle]; } });
        const avecEquivalence = new Map(ING_BY_ID); avecEquivalence.set('ing_milk', lait);
        const METRIQUE = { ...CTX, system: 'metric', convention_id: 'metric_ca' };
        const qte = (li) => li.querySelector('.qty').textContent;
        const ligne = L1('1 tasse de lait de coco');
        const avec = ingredientLineEl(ligne, METRIQUE, avecEquivalence);
        const sans = ingredientLineEl({ ...ligne, ingredient_id: null }, METRIQUE, avecEquivalence);
        eq([qte(avec), qte(sans), lues], ['250 ml ↺', '250 ml ↺', []], 'F3 : une ligne non vérifiée rend sa quantité comme sans identité proposée, et son équivalence n’est jamais lue');
      }

      // P11 : le mode cuisine affiche aussi le texte écrit.
      {
        const session = { id: 'cs1', selected_version_ids: ['vc'], servings: 2, progress: {} };
        const vc = { id: 'vc', recipe_id: 'rc', servings: 2, ingredients: [L1('250 ml lait de coco'), VER('250 ml lait')], steps: [{ id: 'st1', position: 1, text: 'Chauffer doucement.', timers: [] }] };
        const rc = { id: 'rc', original_title: 'Soupe' };
        const ctx = { cook_sessions: [session], versionsById: new Map([['vc', vc]]), recipesById: new Map([['rc', rc]]), ingredientsById: ING_BY_ID, conventionFor: () => null };
        const racine = await renderCook({ id: 'cs1' }, {}, ctx);
        eq([...racine.querySelectorAll('ul.ingredients li > span:first-child')].map((n) => n.textContent), ['lait de coco', 'lait'], 'P11 : mode cuisine — la ligne non vérifiée est écrite telle quelle, la vérifiée porte le libellé du lexique');
      }
    } finally { setUiLocale(localeAvant); }

    // N-9 : la liste d'épicerie regroupe une ligne non vérifiée par son texte, jamais par l'identité proposée.
    {
      const liste = buildShoppingList([{ version: { id: 'v', servings: 2, ingredients: [L1('250 ml lait de coco'), VER('250 ml lait')] }, servings: 2, title: 'T' }], ING_BY_ID);
      eq(liste.map((g) => g.label).sort(), ['lait', 'lait de coco'], 'N-9 : l’épicerie regroupe une ligne non vérifiée par son texte, pas par l’identité proposée (S2)');
      const etendue = buildShoppingList([
        { version: { id: 'v', servings: 2, ingredients: [L1('250 ml lait de coco'), VER('250 ml lait'), L1('100 ml lait')] }, servings: 2, title: 'A' },
        { version: { id: 'v2', servings: 2, ingredients: [L1('250 ml lait de coco'), VER('100 ml lait')] }, servings: 2, title: 'B' },
      ], ING_BY_ID);
      eq(etendue.map((g) => [g.key, g.ingredient_id, g.label, g.entries.length, g.totals.map((x) => x.text)]).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
        [['ing:ing_milk', 'ing_milk', 'lait', 2, ['350 ml']], ['name:lait', null, 'lait', 1, ['100 ml']], ['name:lait de coco', null, 'lait de coco', 2, ['500 ml']]],
        'N-9 : la ligne vérifiée garde son groupe par identité ; une non vérifiée au même nom reste à part ; deux lignes non vérifiées de même texte s’additionnent');
    }
  }
  // --- T3 : écran #/recipes/creer (§ 3.2, § 5 ; C-1, C-4, C-8, C-9, C-10, C-14, C-15, C-16 ; P6, P7, P9, P14, P17, P18, P29).
  // Chaque assertion d'écran nomme la ligne de la table de décision P7 qu'elle atteint (« P7.n »).
  {
    const S = await import('../src/ui/creer-ia.js');
    const { withRepo } = await import('./sync-fixture.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale();
    setUiLocale('fr'); // P17 : une suite antérieure bascule 'en' ; ce bloc affirme des textes français (rendue dans le finally)
    const vraiFetch = globalThis.fetch;
    let appelsReseau = 0;
    globalThis.fetch = async (u) => { appelsReseau += 1; throw new Error(`aucun reseau attendu ici : ${u}`); };
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const bouton = (root, role) => root.querySelector(`[data-role="${role}"]`);
    const textes = (root, sel) => [...root.querySelectorAll(sel)].map((n) => n.textContent);
    const libelle = (root, role) => bouton(root, role)?.textContent ?? null;
    const statutVol = (root) => [...root.querySelectorAll('[role="status"]')].some((n) => n.textContent === 'L’assistant compose une recette…');
    const ING_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));
    const ctxDe = (llm, extra = {}) => ({ recipes: [], docs: [], docsByRecipe: new Map(), ingredientsById: ING_BY_ID, versionsById: new Map(), recipesById: new Map(), settings: { llm }, conventionFor: () => null, ...extra });
    const CLE = 'sk-factice-ecran';
    const ANTH = { provider: 'anthropic', api_key: CLE, model: 'm' };
    const trouve = { etat: 'trouve', raison: null, motif: null, recette: VALIDE, avertissements: [], modele: 'm', usage: { entree: 1, sortie: 2 } };
    const sansAppel = async () => { throw new Error('aucun appel attendu'); };
    const monter = async (query, deps = {}, ctx = ctxDe(ANTH)) => { const root = await S.renderCreerIA({}, query, ctx, { creer: sansAppel, remplacerAdresse: () => {}, navigate: () => {}, toast: () => {}, ...deps }); scene.append(root); return root; };
    // Un « creer » dont chaque appel attend qu'on le résolve à la main : a.rendre[i](issue).
    const enMain = () => { const a = { n: 0, args: [], deps: [], rendre: [] }; a.creer = (args, deps) => { a.n += 1; a.args.push(args); a.deps.push(deps); return new Promise((r) => { a.rendre.push(r); }); }; return a; };
    try {
      // P7.2 — gardes fournisseur (C-14, P29 : par fournisseur.name, pas par supportsWebSearch) : la carte et « Réglages », rien d'autre
      for (const [nom, llm, attendu] of [
        ['aucun fournisseur', { provider: 'none' }, 'Pour créer une recette, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'],
        ['Anthropic sans clé', { provider: 'anthropic', api_key: '', model: 'm' }, 'Pour créer une recette, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'],
        ['compatible OpenAI configuré', { provider: 'openai_compatible', api_key: 'k', model: 'm', base_url: '' }, 'Ce fournisseur ne crée pas de recette ici. Choisis Anthropic dans Réglages → Assistant IA.'],
      ]) {
        S.reinitialiserCreation();
        const root = await monter({ q: 'saumon' }, {}, ctxDe(llm));
        eq([textes(root, '[data-role="garde-ia"] .status > span'), !!root.querySelector('[data-role="garde-ia"] a[href="#/settings"]'), bouton(root, 'creer-ia') === null, bouton(root, 'demande-ia') === null], [[attendu], true, true, true], `P7.2 garde (${nom}) : texte exact, lien Réglages, ni formulaire ni bouton de création`);
        root.remove();
      }
      // P7.2 — garde C-15 (?adapter) ; frontière avec T7 : une parente valide donne le formulaire ORDINAIRE prérempli, sans changement ni appel
      {
        S.reinitialiserCreation();
        const fiche = { id: 'rc_ia', origine: 'ia', original_title: 'Saumon au fenouil' };
        const creation = { id: 'rv_ia', recipe_id: 'rc_ia', kind: 'synthesis', status: 'proposed', servings: 2, ingredients: [], steps: [], provenance: { generated_by: 'ai', creation: { demande: 'saumon fenouil' } } };
        const extraction = { id: 'rv_livre', recipe_id: 'rc_livre', kind: 'extraction', provenance: { generated_by: 'ai' } };
        const ctx = ctxDe(ANTH, { versionsById: new Map([['rv_ia', creation], ['rv_livre', extraction], ['rv_orpheline', { ...creation, id: 'rv_orpheline', recipe_id: 'rc_absente' }]]), recipesById: new Map([['rc_ia', fiche], ['rc_livre', { id: 'rc_livre', original_title: 'Livre' }]]) });
        for (const [nom, id] of [['version absente', 'rv_rien'], ['extraction IA de livre', 'rv_livre'], ['fiche absente', 'rv_orpheline']]) {
          const root = await monter({ adapter: id }, {}, ctx);
          eq([textes(root, '[data-role="garde-ia"] .status > span'), bouton(root, 'demande-ia') === null, bouton(root, 'creer-ia') === null], [['Cette version ne peut pas être adaptée ici.'], true, true], `P7.2 garde C-15 (${nom}) : refus, sans formulaire ni bouton`);
          root.remove();
        }
        const a = enMain();
        const root = await monter({ adapter: 'rv_ia' }, { creer: a.creer }, ctx);
        eq([bouton(root, 'demande-ia')?.value, root.querySelector('input[name="portions"]')?.value, bouton(root, 'changement-ia') === null, bouton(root, 'creer-ia')?.disabled, root.querySelector('header a')?.getAttribute('href')], ['saumon fenouil', '2', true, true, '#/recipes/rc_ia'],
          'C-15 parente valide (frontière T7) : formulaire ordinaire prérempli (demande et portions de la parente), sans champ de changement, bouton éteint, retour vers la fiche');
        bouton(root, 'creer-ia')?.click(); await tick();
        eq([a.n, S.etatCreation()], [0, { memoire: null, enCours: false }], 'C-15 parente valide : aucun appel d’adaptation tant que T7 n’a pas posé le changement');
        root.remove();
      }

      await withRepo(async (repo) => {
        // C-16 — préremplissage par liste blanche ; C-1 — aucun appel sans clic
        S.reinitialiserCreation();
        const a = enMain();
        const adresses = [];
        const dits = [];
        const brut = ' saumon' + String.fromCharCode(0x200b) + '   fenouil ';
        const root = await monter({ q: brut, diets: 'sans_lactose,inconnu,vegetalien,sans_lactose', type: 'salade', portions: '20', max: '3' }, { creer: a.creer, remplacerAdresse: (x) => adresses.push(x) });
        eq([bouton(root, 'demande-ia').value, root.querySelectorAll('.puces[role="group"] button.puce[data-diet]').length, textes(root, '.puces[role="group"] button.puce[data-diet][aria-pressed="true"]'), root.querySelector('select[name="type"]').value, root.querySelector('input[type="number"][name="portions"]').value, root.querySelector('input[type="number"][name="max"]').value, libelle(root, 'creer-ia')],
          ['saumon fenouil', 9, ['Végétalien', 'Sans lactose'], 'salade', '4', '', 'Créer ma recette'], 'C-16 : q nettoyé (invisible retiré, espaces repliés), restrictions filtrées et dédoublonnées (9 puces, 2 choisies), type gardé, portions hors bornes → 4, max hors bornes → vide');
        for (const [query, attendu, nom] of [[{ q: 'x', portions: '12', max: '240' }, ['12', '240'], 'bornes hautes acceptées'], [{ q: 'x', portions: '1', max: '5' }, ['1', '5'], 'bornes basses acceptées'], [{ q: 'x', portions: '2.5', max: '241' }, ['4', ''], 'décimale et max + 1 écartés'], [{ q: 'x', portions: '0', max: '4' }, ['4', ''], 'min − 1 écartés']]) {
          const r0 = await monter(query);
          eq([r0.querySelector('input[name="portions"]').value, r0.querySelector('input[name="max"]').value], attendu, 'C-16 : ' + nom);
          r0.remove();
        }
        {
          const r0 = await monter({ q: 'é'.repeat(600), type: 'constructor', diets: '__proto__,toString' });
          eq([Array.from(bouton(r0, 'demande-ia').value).length, r0.querySelector('select[name="type"]').value, r0.querySelectorAll('[data-diet][aria-pressed="true"]').length], [500, '', 0], 'C-16 : q borné à 500 points de code, type et restrictions hors liste ignorés');
          r0.remove();
        }
        eq(a.n, 0, 'C-1 : aucun appel sans clic');

        // P7.1 — un clic = un appel, ce qui est affiché part (C-10), l'adresse est remplacée (F2) ; toutes les instances montrent le vol (C-1, P6)
        const autre = await monter({ q: 'autre chose' }, { creer: a.creer, toast: (m) => dits.push(m) });
        const perime = bouton(autre, 'creer-ia');
        bouton(root, 'creer-ia').click(); await tick();
        eq([a.n, a.args[0].demande, a.args[0].filtres, a.args[0].cfg === ANTH, a.args[0].langue, a.args[0].parente, a.args[0].changement, typeof a.deps[0].enLigne, a.deps[0].signal instanceof AbortSignal, adresses],
          [1, 'saumon fenouil', { diets: ['sans_lactose', 'vegetalien'], type: 'salade', servings: 4, maxMinutes: null }, true, 'fr', null, null, 'function', true, ['/recipes/creer?q=saumon+fenouil&diets=sans_lactose%2Cvegetalien&type=salade&portions=4']],
          'C-10 : un clic = un appel avec ce qui est affiché ; F2 : adresse remplacée par les seuls champs de la liste blanche');
        eq([statutVol(root), !!bouton(root, 'annuler-ia'), bouton(root, 'creer-ia') === null, [...root.querySelectorAll('button')].filter((b) => b.disabled && !b.dataset.role).map((b) => b.textContent), bouton(root, 'demande-ia') === null, S.etatCreation().enCours],
          [true, true, true, ['Créer ma recette'], true, true], 'P7.1 vol : statut, « Annuler », bouton de création éteint SANS data-role, pas de formulaire');
        eq([statutVol(autre), bouton(autre, 'creer-ia') === null, !!bouton(autre, 'annuler-ia')], [true, true, true], 'C-1 / P6 : une instance montée AVANT le vol est redessinée et montre le vol');
        perime.click(); await tick();
        eq([a.n, dits, statutVol(autre), S.etatCreation().enCours], [1, ['Une création est déjà en cours : annule-la d’abord.'], true, true], 'C-1 : le bouton périmé d’une autre instance est REFUSÉ pendant le vol (garde synchrone au module) — aucun second appel, rien d’annulé');
        autre.remove();
        const r2 = await monter({ q: 'encore autre chose' }, { creer: a.creer });
        eq([statutVol(r2), bouton(r2, 'creer-ia') === null, !!bouton(r2, 'annuler-ia')], [true, true, true], 'C-1 : une instance montée PENDANT le vol (reconstruction, retour arrière) montre le vol et n’offre aucune création');
        r2.remove();

        // P7.4 — la proposition (§ 3.2, C-9, P9), texte seul
        a.rendre[0](trouve); await tick();
        const prop = root.querySelector('.proposition');
        eq([textes(prop, '[data-role="etiquette-ia"]'), prop.querySelector('h2')?.textContent, textes(prop, '[data-role="description-ia"]'), textes(prop, '[data-role="portions-ia"]'), textes(prop, '[data-role="ingredients-ia"] li'), textes(prop, '[data-role="etapes-ia"] li'), textes(prop, '[data-role="conseils-ia"] li'), textes(prop, '[data-role="notes-ia"] li')],
          [['Créée avec l’IA · non testée'], 'Saumon au fenouil', ['Selon l’assistant : Un plat simple.'], ['2 portions · environ 25 min (estimé par l’assistant)'], ['300 g saumon', '1 fenouil'], ['Préchauffer le four à 200 °C.', 'Cuire 12 min.'], ['Selon l’assistant : Servir chaud.'], ['Vérifie l’étiquette du bouillon.']],
          'P7.4 proposition : étiquette C-2, titre, description préfixée, portions et durée estimée, lignes, étapes, conseils préfixés, notes « à vérifier avant de servir »');
        eq([textes(prop, '[data-role="avertissement-ia"]'), textes(prop, '[data-role="demande-envoyee"]'), textes(prop, '[data-role="jetons-ia"]'), textes(prop, '[data-role="memoire-ia"]')],
          [['L’assistant n’a pas cuisiné cette recette : vérifie les quantités, les cuissons et les étiquettes avant de la servir.'], ['Demande envoyée : saumon fenouil · Sans lactose ; Végétalien · Salade · 4 portions'], ['3 jetons'], ['Cette proposition n’est pas enregistrée : elle sera perdue à la fermeture de l’app.']],
          'P7.4 proposition : avertissement fixe C-9, demande envoyée (C-10), jetons, mention de session (C-4)');
        eq(textes(prop, '[data-role="evaluation-ia"] li'), ['Sans lactose — À vérifier', 'Végétalien — Incompatible : 300 g saumon (identité proposée : saumon ?)'], 'P9 / S1 : chaque restriction demandée, texte exact — « À vérifier » ou « Incompatible : {ligne écrite} (identité proposée) », jamais « Compatible »');
        eq([libelle(root, 'garder-ia'), libelle(root, 'recommencer-ia'), libelle(root, 'modifier-demande'), bouton(root, 'demande-ia') === null, bouton(root, 'k1') === null, S.etatCreation().memoire.gardee, S.etatCreation().memoire.echec],
          ['Garder cette recette', 'Recommencer', 'Modifier la demande', true, true, null, null], 'P7.4 : Garder, Recommencer, Modifier la demande ; formulaire replié ; rien n’est gardé');
        eq([JSON.stringify(S.etatCreation()).includes(CLE), root.outerHTML.includes(CLE), a.args[0].cfg.api_key === CLE], [false, false, true], 'C-8 : la clé a atteint creer() mais n’est ni dans etatCreation() ni dans le DOM (texte et attributs)');
        root.remove();

        // P9 — une restriction dont seul un ingrédient FACULTATIF bloque : jamais « Compatible », le nom de la ligne reste dit (M1 de la re-revue T5)
        {
          S.reinitialiserCreation();
          const facultatif = { ...trouve, recette: { ...VALIDE, ingredients: [{ name: 'parmesan (facultatif)', quantity: 30, unit: 'g' }] } };
          const r = await monter({ q: 'pâtes', diets: 'sans_lactose' }, { creer: async () => facultatif });
          bouton(r, 'creer-ia').click(); await tick(); await tick();
          eq(textes(r, '[data-role="evaluation-ia"] li'), ['Sans lactose — À vérifier, à retirer : 30 g parmesan (facultatif) (identité proposée : parmesan ?)'], 'P9 : un bloquant facultatif → « À vérifier », avec la ligne à retirer (jamais « Adaptation » ni « Compatible »)');
          r.remove();
        }

        // I-H — texte seul : une sortie de modèle hostile ne crée aucun élément
        {
          S.reinitialiserCreation();
          const hostile = { ...trouve, recette: { ...VALIDE, title: '<b>Titre</b>', description: '<img src=x onerror=alert(1)>', steps: ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>'], tips: ['<a href="javascript:alert(1)">x</a>'] } };
          const r3 = await monter({ q: 'x' }, { creer: async () => hostile });
          bouton(r3, 'creer-ia').click(); await tick(); await tick();
          eq([r3.querySelectorAll('b, img, script, a[href^="javascript"]').length, r3.querySelector('.proposition h2')?.textContent, textes(r3, '[data-role="etapes-ia"] li'), textes(r3, '[data-role="description-ia"]')],
            [0, '<b>Titre</b>', ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>'], ['Selon l’assistant : <img src=x onerror=alert(1)>']], 'I-H : texte seul — aucun élément créé par la sortie du modèle, le balisage reste lisible tel quel');
          r3.remove();
        }

        // C-4 — Garder : gardee posé AVANT la fin de l'écriture ; le double clic n'écrit qu'une fois ; annonce et navigation APRÈS l'écriture
        S.reinitialiserCreation();
        const ecritures = []; let finir = null; const navs = []; const dits2 = [];
        const faux = { ...repo, newId: repo.newId, saveBatch: (b) => { ecritures.push(b); return new Promise((r) => { finir = () => r(b); }); } };
        const r4 = await monter({ q: 'saumon fenouil' }, { creer: async () => trouve, repo: faux, navigate: (p) => navs.push(p), toast: (m) => dits2.push(m) });
        const r4b = await monter({ q: 'saumon fenouil' }, { repo: faux, navigate: (p) => navs.push(p), toast: (m) => dits2.push(m) });
        bouton(r4, 'creer-ia').click(); await tick(); await tick();
        // Un « Garder » PÉRIMÉ d'une autre vue (détaché par un redessin, donc jamais éteint) : seule la garde gardee peut l'arrêter.
        const gPerime = bouton(r4b, 'garder-ia');
        bouton(r4b, 'modifier-demande').click(); await tick();
        const g = bouton(r4, 'garder-ia');
        g.click(); gPerime.click(); g.click();
        const pendant = [ecritures.length, !!S.etatCreation().memoire.gardee, g.disabled, bouton(r4, 'recommencer-ia')?.disabled, bouton(r4b, 'garder-ia')?.disabled, gPerime.isConnected, gPerime.disabled, navs.length, dits2.length, r4.textContent.includes('Recette gardée')];
        const rPendant = await monter({ q: 'saumon fenouil' }, { repo: faux });
        const vuePendant = [textes(rPendant, '[data-role="gardee-ia"] .status'), bouton(rPendant, 'ouvrir-fiche') === null, bouton(rPendant, 'garder-ia') === null];
        finir(); await tick();
        eq([vuePendant, textes(rPendant, '[data-role="gardee-ia"] .status'), !!bouton(rPendant, 'ouvrir-fiche')], [[['Enregistrement de la recette…'], true, true], ['Recette gardée'], true], 'C-4 : une vue montée PENDANT l’écriture dit « Enregistrement… » (jamais « gardée » sans écriture), puis « Recette gardée » une fois l’écriture faite');
        rPendant.remove();
        eq(pendant, [1, true, true, true, true, false, false, 0, 0, false], 'C-4 : au clic, gardee est posé de façon SYNCHRONE, Garder et Recommencer s’éteignent dans toutes les vues, rien n’est annoncé avant l’écriture ; ni le second clic ni un bouton périmé n’écrivent');
        const [b0] = ecritures;
        eq([ecritures.length, Object.keys(b0).sort(), b0.recipes[0].origine, b0.recipe_versions[0].kind, b0.recipe_versions[0].status, b0.recipes[0].original_title, b0.recipe_versions[0].provenance.creation.demande, b0.recipe_versions[0].provenance.model, b0.recipe_versions[0].recipe_id === b0.recipes[0].id, navs, dits2, S.etatCreation().memoire.gardee],
          [1, ['recipe_versions', 'recipes'], 'ia', 'synthesis', 'proposed', 'Saumon au fenouil', 'saumon fenouil', 'm', true, [`/recipes/${b0.recipes[0].id}?v=${b0.recipe_versions[0].id}`], ['Recette gardée'], { recipeId: b0.recipes[0].id, versionId: b0.recipe_versions[0].id, ecrite: true }],
          'C-4 : UNE écriture (fiche + version) fabriquée depuis la mémoire ; « Recette gardée » et navigation vers la fiche APRÈS l’écriture ; gardee posé');
        // P7.3 (eq) — retour arrière après Garder
        const r5 = await monter({ q: 'saumon fenouil' }, { repo: faux, navigate: (p) => navs.push(p) });
        eq([textes(r5, '[data-role="gardee-ia"] .status'), !!bouton(r5, 'ouvrir-fiche'), bouton(r5, 'garder-ia') === null, bouton(r5, 'recommencer-ia') === null, bouton(r5, 'modifier-demande') === null, bouton(r5, 'demande-ia') === null, r5.querySelector('.proposition h2')?.textContent, textes(r5, '[data-role="memoire-ia"]'), ecritures.length],
          [['Recette gardée'], true, true, true, true, true, 'Saumon au fenouil', [], 1], 'P7.3 (eq) retour arrière après Garder : « Recette gardée » + « Ouvrir la fiche », proposition inerte, ni Garder ni Recommencer (S9b/F3)');
        bouton(r5, 'ouvrir-fiche').click(); await tick();
        eq(navs, [navs[0], navs[0]], 'P7.3 : « Ouvrir la fiche » mène à la fiche gardée');
        r5.remove();
        // P7.3 (non eq) — une autre demande : formulaire + K1 + « Créer à nouveau », la proposition gardée reste inerte
        const r5b = await monter({ q: 'truite' }, { repo: faux });
        eq([!!bouton(r5b, 'demande-ia'), bouton(r5b, 'k1')?.hidden, libelle(r5b, 'creer-ia'), textes(r5b, '[data-role="gardee-ia"] .status'), bouton(r5b, 'garder-ia') === null, bouton(r5b, 'recommencer-ia') === null],
          [true, false, 'Créer à nouveau', ['Recette gardée'], true, true], 'P7.3 (non eq) : formulaire + K1 visible + « Créer à nouveau » ; jamais Garder ni Recommencer');
        r5b.remove(); r4.remove(); r4b.remove();

        // C-4 — une écriture refusée remet gardee à null : Garder redevient possible, rien n'est annoncé comme gardé
        {
          S.reinitialiserCreation();
          const journal = []; const consoleErreur = console.error; console.error = (...x) => journal.push(x);
          try {
            let essais = 0; const ecr = []; const navs3 = []; const dits3 = [];
            const fragile = { ...repo, newId: repo.newId, saveBatch: async (b) => { essais += 1; if (essais === 1) throw new Error('quota'); ecr.push(b); return b; } };
            const r = await monter({ q: 'saumon fenouil' }, { creer: async () => trouve, repo: fragile, navigate: (p) => navs3.push(p), toast: (m) => dits3.push(m) });
            bouton(r, 'creer-ia').click(); await tick(); await tick();
            bouton(r, 'garder-ia').click(); await tick();
            eq([S.etatCreation().memoire.gardee, bouton(r, 'garder-ia')?.disabled, dits3, navs3, journal.map((e) => e[0]), JSON.stringify(journal).includes('Saumon'), r.textContent.includes('Recette gardée')],
              [null, false, ['La recette n’a pas pu être gardée. Réessaie.'], [], ['[cuisine-os] creer_ia.garder'], false, false], 'C-4 : écriture refusée → gardee remis à null, Garder rallumé, l’échec est dit et journalisé (code seul, jamais la recette), aucune navigation');
            bouton(r, 'garder-ia').click(); await tick();
            eq([essais, ecr.length, navs3.length, dits3[1]], [2, 1, 1, 'Recette gardée'], 'C-4 : après un échec, Garder réessaie et écrit une fois');
            r.remove();
          } finally { console.error = consoleErreur; }
        }

        // P7.4 + F21 — « Recommencer » échoué : l'échec AU-DESSUS, la proposition reste ; « Modifier la demande » ; saisie sans redessin ; K1
        S.reinitialiserCreation();
        let fois = 0; const args6 = []; const creer2 = async (x) => { args6.push(x); return ++fois === 1 ? trouve : { etat: 'indisponible', raison: 'serveur', motif: null }; };
        const r6 = await monter({ q: 'saumon fenouil' }, { creer: creer2 });
        bouton(r6, 'creer-ia').click(); await tick(); await tick();
        bouton(r6, 'recommencer-ia').click(); await tick(); await tick();
        eq([fois, textes(r6, '[data-role="issue-ia"] .status > span'), textes(r6, '[data-role="issue-ia"] small'), !!bouton(r6, 'reessayer-ia'), r6.querySelector('.proposition h2')?.textContent, !!bouton(r6, 'garder-ia'), S.etatCreation().memoire.echec?.raison, S.etatCreation().memoire.issue.etat, r6.textContent.includes('indisponible')],
          [2, ['L’assistant n’a pas répondu. Réessaie.'], ['Code : serveur'], true, 'Saumon au fenouil', true, 'serveur', 'trouve', false], 'P7.4 + F21 : « Recommencer » échoué — l’échec est dit (texte, code, Réessayer), la proposition payée reste avec Garder');
        eq(r6.querySelector('[data-role="issue-ia"]').compareDocumentPosition(r6.querySelector('.proposition')) & Node.DOCUMENT_POSITION_FOLLOWING, Node.DOCUMENT_POSITION_FOLLOWING, 'F21 : l’échec est placé AU-DESSUS de la proposition');
        ok(bouton(r6, 'demande-ia') === null, 'P7.4 : formulaire replié tant que « Modifier la demande » n’est pas touché (le nœud n’existe pas)');
        bouton(r6, 'modifier-demande').click(); await tick();
        const ta = bouton(r6, 'demande-ia');
        eq([ta?.value, bouton(r6, 'k1')?.hidden, r6.querySelector('.proposition h2')?.textContent, !!bouton(r6, 'garder-ia'), bouton(r6, 'modifier-demande') === null, libelle(r6, 'creer-ia')], ['saumon fenouil', true, 'Saumon au fenouil', true, true, 'Créer à nouveau'], 'Modifier la demande : formulaire visible (K1 caché : rien n’a changé), proposition conservée');
        ta.value = 'truite'; ta.dispatchEvent(new Event('input'));
        ok(bouton(r6, 'demande-ia') === ta && r6.contains(ta), 'saisie : la frappe ne redessine pas (même nœud — focus iPhone)');
        eq(bouton(r6, 'k1')?.hidden, false, 'K1 : demande modifiée → « La demande a changé depuis cette proposition. » apparaît (le nœud bascule, sans redessin)');
        ta.value = ' saumon   fenouil'; ta.dispatchEvent(new Event('input'));
        eq(bouton(r6, 'k1')?.hidden, true, 'K1 : revenue à la demande envoyée (espaces repliés) → la mention se cache');
        const puce = r6.querySelector('[data-diet="sans_gluten"]');
        puce.click(); await tick();
        eq([r6.querySelector('[data-diet="sans_gluten"]') === puce, puce.getAttribute('aria-pressed'), bouton(r6, 'k1').hidden, bouton(r6, 'demande-ia') === ta], [true, 'true', false, true], 'puce : bascule sur place (aria-pressed), K1 visible, aucun redessin');
        puce.click(); await tick();
        eq([puce.getAttribute('aria-pressed'), bouton(r6, 'k1').hidden], ['false', true], 'puce : rebasculée → K1 caché');
        const typ = r6.querySelector('select[name="type"]');
        typ.value = 'soupe'; typ.dispatchEvent(new Event('change'));
        const k1Type = bouton(r6, 'k1').hidden;
        typ.value = ''; typ.dispatchEvent(new Event('change'));
        eq([k1Type, bouton(r6, 'k1').hidden, r6.querySelector('select[name="type"]') === typ], [false, true, true], 'type : changé → K1 visible ; remis → caché ; aucun redessin');
        const champ = (nom) => r6.querySelector(`input[name="${nom}"]`);
        const aide = () => [bouton(r6, 'creer-ia').disabled, bouton(r6, 'aide-ia').hidden, bouton(r6, 'aide-ia').textContent];
        champ('portions').value = '13'; champ('portions').dispatchEvent(new Event('input'));
        const p13 = aide();
        champ('portions').value = '4'; champ('portions').dispatchEvent(new Event('input'));
        const p4 = aide();
        champ('max').value = '300'; champ('max').dispatchEvent(new Event('input'));
        const m300 = aide();
        champ('max').value = ''; champ('max').dispatchEvent(new Event('input'));
        ta.value = ' '; ta.dispatchEvent(new Event('input'));
        const vide = aide();
        ta.value = 'saumon fenouil'; ta.dispatchEvent(new Event('input'));
        eq([p13, p4, m300, vide, aide()], [[true, false, 'Portions : un nombre entier de 1 à 12.'], [false, true, ''], [true, false, 'Temps maximal : de 5 à 240 minutes, ou vide.'], [true, false, 'Écris d’abord ce que tu veux cuisiner.'], [false, true, '']], 'C-10 : une valeur que la demande ne porterait pas telle quelle éteint le bouton et la raison est dite (rien ne part autrement qu’affiché)');
        ta.value = 'truite'; ta.dispatchEvent(new Event('input'));
        bouton(r6, 'recommencer-ia').click(); await tick(); await tick();
        eq([args6.length, args6[2]?.demande, S.etatCreation().memoire.demande, bouton(r6, 'demande-ia') === null, S.etatCreation().memoire.echec?.raison], [3, 'saumon fenouil', 'saumon fenouil', true, 'serveur'], '« Recommencer » relance la demande PARTIE (memoire.demande), pas la frappe en cours ; le formulaire se replie');
        ok(!JSON.stringify(S.etatCreation()).includes(CLE) && !r6.outerHTML.includes(CLE), 'C-8 : la clé n’est pas dans etatCreation() ni dans le DOM');
        r6.remove();

        // P7.5 — T, non eq, non G : une nouvelle instance avec une autre demande ; F21 élargi (« Créer à nouveau » échoué sous une autre clé)
        S.reinitialiserCreation();
        const ecr5 = [];
        const faux5 = { ...repo, newId: repo.newId, saveBatch: async (b) => { ecr5.push(b); return b; } };
        const ra = await monter({ q: 'saumon fenouil' }, { creer: async () => trouve });
        bouton(ra, 'creer-ia').click(); await tick(); await tick();
        ra.remove();
        const appels5 = [];
        const rb = await monter({ q: 'truite' }, { creer: async (x) => { appels5.push(x); return { etat: 'indisponible', raison: 'refus', motif: null }; }, repo: faux5 });
        eq([bouton(rb, 'demande-ia')?.value, bouton(rb, 'k1')?.hidden, libelle(rb, 'creer-ia'), rb.querySelector('.proposition h2')?.textContent, !!bouton(rb, 'garder-ia'), bouton(rb, 'recommencer-ia') === null, bouton(rb, 'issue-ia') === null],
          ['truite', false, 'Créer à nouveau', 'Saumon au fenouil', true, true, true], 'P7.5 : formulaire + K1 + « Créer à nouveau » + proposition avec Garder, sans Recommencer');
        bouton(rb, 'creer-ia').click(); await tick(); await tick();
        eq([appels5.map((x) => x.demande), S.etatCreation().memoire.issue.etat, S.etatCreation().memoire.demande, S.etatCreation().memoire.echec?.raison, textes(rb, '[data-role="issue-ia"] .status > span'), bouton(rb, 'reessayer-ia') === null, rb.querySelector('.proposition h2')?.textContent, !!bouton(rb, 'garder-ia'), bouton(rb, 'k1')?.hidden],
          [['truite'], 'trouve', 'saumon fenouil', 'refus', ['L’assistant a refusé cette demande.'], true, 'Saumon au fenouil', true, false], 'F21 élargi (P7) : « Créer à nouveau » refusé sous une AUTRE clé — la proposition payée reste, l’échec est dit, K1 aussi');
        bouton(rb, 'garder-ia').click(); await tick();
        eq([ecr5.length, ecr5[0]?.recipes[0].original_title, ecr5[0]?.recipe_versions[0].provenance.creation.demande], [1, 'Saumon au fenouil', 'saumon fenouil'], 'C-4 : Garder fabrique depuis la mémoire (ce qui est parti), jamais depuis le formulaire modifié');
        rb.remove();

        // P7.6 — non T et eq : l'issue et le formulaire ; P7.7 — une autre demande : le formulaire seul
        S.reinitialiserCreation();
        const r7 = await monter({ q: 'saumon' }, { creer: async () => ({ etat: 'indisponible', raison: 'illisible', motif: 'json' }) });
        bouton(r7, 'creer-ia').click(); await tick(); await tick();
        eq([textes(r7, '[data-role="issue-ia"] .status > span'), textes(r7, '[data-role="issue-ia"] small'), !!bouton(r7, 'reessayer-ia'), bouton(r7, 'demande-ia')?.value, libelle(r7, 'creer-ia'), r7.querySelector('.proposition') === null, bouton(r7, 'k1') === null],
          [['L’assistant n’a pas rendu une recette lisible. Recommence.'], ['Code : json'], true, 'saumon', 'Créer ma recette', true, true], 'P7.6 : issue illisible (C-3) — texte, « Code : {motif} », Réessayer, et le formulaire');
        r7.remove();
        const r8 = await monter({ q: 'autre' });
        eq([bouton(r8, 'issue-ia') === null, libelle(r8, 'creer-ia'), !!bouton(r8, 'demande-ia')], [true, 'Créer ma recette', true], 'P7.7 : une autre demande sans proposition → le formulaire seul (une issue ne vaut que pour SA demande)');
        r8.remove();
        for (const [issue, attendu, nom] of [
          [{ etat: 'indisponible', raison: 'cle_refusee' }, [['Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.'], [], true, false], 'clé refusée : Réglages, pas de Réessayer'],
          [{ etat: 'indisponible', raison: 'interrompu' }, [['Réponse coupée : réessaie avec une demande plus courte.'], [], false, true], 'coupure (C-13)'],
          [{ etat: 'indisponible', raison: 'trop_de_demandes' }, [['Trop de demandes pour l’instant. Réessaie dans une minute.'], [], false, true], 'limite'],
          [{ etat: 'indisponible', raison: 'constructor' }, [['L’assistant n’a pas répondu. Réessaie.'], ['Code : constructor'], false, true], 'raison inconnue (même « constructor ») : texte générique et code'],
          [{ etat: 'non_configure', raison: null }, [['Pour créer une recette, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'], [], true, false], 'non configuré rendu par l’appel'],
          [{ etat: 'non_pris_en_charge', raison: null }, [['Ce fournisseur ne crée pas de recette ici. Choisis Anthropic dans Réglages → Assistant IA.'], [], true, false], 'autre fournisseur rendu par l’appel'],
        ]) {
          S.reinitialiserCreation();
          const r = await monter({ q: 'saumon' }, { creer: async () => issue });
          bouton(r, 'creer-ia').click(); await tick(); await tick();
          eq([textes(r, '[data-role="issue-ia"] .status > span'), textes(r, '[data-role="issue-ia"] small'), !!r.querySelector('[data-role="issue-ia"] a[href="#/settings"]'), !!bouton(r, 'reessayer-ia')], attendu, 'P7.6 issue — ' + nom);
          r.remove();
        }

        // P18 — « Annuler » : vol abandonné, formulaire, aucune écriture ; la réponse du vol annulé reste muette
        S.reinitialiserCreation();
        const versionsAvant = (await repo.all('recipe_versions')).length;
        const ecrA = []; const fauxA = { ...repo, newId: repo.newId, saveBatch: async (b) => { ecrA.push(b); return b; } };
        const aA = enMain();
        const rA = await monter({ q: 'saumon fenouil' }, { creer: aA.creer, repo: fauxA });
        const rA2 = await monter({ q: 'saumon fenouil' }, { creer: aA.creer, repo: fauxA });
        bouton(rA, 'creer-ia').click(); await tick();
        bouton(rA2, 'annuler-ia').click(); await tick(); // annulé depuis une AUTRE instance : le vol est celui de l'app
        eq([aA.deps[0].signal.aborted, S.etatCreation(), statutVol(rA), statutVol(rA2), libelle(rA, 'creer-ia'), libelle(rA2, 'creer-ia')], [true, { memoire: null, enCours: false }, false, false, 'Créer ma recette', 'Créer ma recette'], 'P18 Annuler : le signal du vol est abandonné, plus de vol, les DEUX instances reviennent au formulaire');
        aA.rendre[0](trouve); await tick();
        eq([S.etatCreation().memoire, ecrA.length, (await repo.all('recipe_versions')).length - versionsAvant, rA.querySelector('.proposition') === null], [null, 0, 0, true], 'P18 Annuler : la réponse arrivée après l’annulation n’écrit rien — ni en mémoire, ni en base');
        // « Annuler » laisse une VRAIE mémoire intacte (P7 : annule → M inchangée) ; P7.1 avec T non G
        bouton(rA, 'creer-ia').click(); await tick(); aA.rendre[1](trouve); await tick();
        bouton(rA, 'recommencer-ia').click(); await tick();
        const pendantRecommencer = [statutVol(rA), rA.querySelector('.proposition h2')?.textContent, bouton(rA, 'garder-ia') === null, bouton(rA, 'recommencer-ia') === null, bouton(rA, 'modifier-demande') === null];
        bouton(rA, 'annuler-ia').click(); await tick();
        aA.rendre[2]({ etat: 'indisponible', raison: 'annule' }); await tick();
        eq([pendantRecommencer, aA.deps[2].signal.aborted, S.etatCreation().memoire?.issue?.etat, S.etatCreation().memoire?.echec, !!bouton(rA, 'garder-ia'), ecrA.length], [[true, 'Saumon au fenouil', true, true, true], true, 'trouve', null, true, 0], 'P7.1 (T non G) : pendant « Recommencer », la proposition reste en dessous, inerte ; « Annuler » laisse la mémoire intacte');
        rA.remove(); rA2.remove();

        // P18 — réponse tardive : deux vols, la promesse du premier (annulé) résout APRÈS celle du second
        S.reinitialiserCreation();
        const aL = enMain();
        const rL = await monter({ q: 'saumon fenouil' }, { creer: aL.creer });
        bouton(rL, 'creer-ia').click(); await tick();
        bouton(rL, 'annuler-ia').click(); await tick();
        bouton(rL, 'creer-ia').click(); await tick();
        aL.rendre[1]({ ...trouve, recette: { ...VALIDE, title: 'Truite aux herbes' } }); await tick();
        aL.rendre[0](trouve); await tick();
        eq([aL.n, S.etatCreation().memoire.issue.recette.title, rL.querySelector('.proposition h2')?.textContent], [2, 'Truite aux herbes', 'Truite aux herbes'], 'P18 réponse tardive : la promesse du premier vol résout après la seconde et n’écrit rien (garde de génération)');
        // … et dans l'autre ordre : pendant le second vol, la réponse tardive du premier ne le termine pas
        S.reinitialiserCreation();
        const aL2 = enMain();
        const rL2 = await monter({ q: 'saumon fenouil' }, { creer: aL2.creer });
        bouton(rL2, 'creer-ia').click(); await tick();
        bouton(rL2, 'annuler-ia').click(); await tick();
        bouton(rL2, 'creer-ia').click(); await tick();
        aL2.rendre[0](trouve); await tick();
        const pendantSecond = [S.etatCreation().enCours, statutVol(rL2), S.etatCreation().memoire];
        aL2.rendre[1]({ etat: 'indisponible', raison: 'serveur' }); await tick();
        eq([pendantSecond, S.etatCreation().memoire?.issue?.raison], [[true, true, null], 'serveur'], 'P18 réponse tardive : pendant le second vol, la réponse du premier est muette — le vol continue, la mémoire reste vide');
        rL.remove(); rL2.remove();

        // P18 — hors ligne (C-14) : dit AVANT tout appel ; « Réessayer » force l'état en ligne
        S.reinitialiserCreation();
        const aO = enMain(); const adrO = [];
        const rO = await monter({ q: 'saumon' }, { creer: aO.creer, enLigne: () => false, remplacerAdresse: (x) => adrO.push(x) });
        bouton(rO, 'creer-ia').click(); await tick();
        eq([aO.n, textes(rO, '[data-role="issue-ia"] .status > span'), !!bouton(rO, 'reessayer-ia'), S.etatCreation().enCours, S.etatCreation().memoire?.issue?.raison, !!bouton(rO, 'demande-ia')], [0, ['Tu es hors ligne.'], true, false, 'hors_ligne', true], 'P18 hors ligne : aucun appel, aucun vol, le texte, « Réessayer » et le formulaire');
        bouton(rO, 'reessayer-ia').click(); await tick();
        eq([aO.n, aO.deps[0]?.enLigne?.(), statutVol(rO), adrO.length], [1, true, true, 2], 'P18 hors ligne : « Réessayer » force l’état en ligne (navigator.onLine peut mentir) et lance UN appel');
        bouton(rO, 'annuler-ia').click(); await tick();
        rO.remove();

        // Filet : jamais d'écran figé ni de proposition illisible
        for (const [nom, creer] of [['un appel qui lève', async () => { throw new TypeError('bogue'); }], ['un trouvé sans recette', async () => ({ etat: 'trouve', recette: null })], ['un trouvé aux lignes informes', async () => ({ ...trouve, recette: { ...VALIDE, ingredients: [{}] } })], ['une issue nulle', async () => null]]) {
          S.reinitialiserCreation();
          const r = await monter({ q: 'saumon' }, { creer });
          bouton(r, 'creer-ia').click(); await tick(); await tick();
          eq([S.etatCreation().enCours, S.etatCreation().memoire?.issue?.raison, textes(r, '[data-role="issue-ia"] small'), r.querySelector('.proposition') === null], [false, 'interne', ['Code : interne'], true], 'filet (' + nom + ') : plus de vol, issue interne, aucune proposition');
          r.remove();
        }

        // P7 (résolution) — une issue « annule » venue de l'appel lui-même (signal extérieur) ne touche jamais la mémoire
        {
          S.reinitialiserCreation();
          let n = 0; const creerA = async () => (++n === 1 ? trouve : { etat: 'indisponible', raison: 'annule' });
          const r = await monter({ q: 'saumon' }, { creer: async () => ({ etat: 'indisponible', raison: 'annule' }) });
          bouton(r, 'creer-ia').click(); await tick(); await tick();
          const sansMemoire = [S.etatCreation(), bouton(r, 'issue-ia') === null, libelle(r, 'creer-ia')];
          r.remove();
          const r2b = await monter({ q: 'saumon fenouil' }, { creer: creerA });
          bouton(r2b, 'creer-ia').click(); await tick(); await tick();
          bouton(r2b, 'recommencer-ia').click(); await tick(); await tick();
          eq([sansMemoire, n, S.etatCreation().memoire?.issue?.etat, S.etatCreation().memoire?.echec, bouton(r2b, 'issue-ia') === null, !!bouton(r2b, 'garder-ia')], [[{ memoire: null, enCours: false }, true, 'Créer ma recette'], 2, 'trouve', null, true, true], 'P7 : « annule » laisse la mémoire telle quelle — sans mémoire, le formulaire ; après une proposition, ni échec affiché ni proposition perdue');
          r2b.remove();
        }

        // P6 — une racine construite pendant le vol mais montée APRÈS sa résolution (le routeur l'insère après la fin de la route) ne reste pas figée
        S.reinitialiserCreation();
        const aM = enMain();
        const rM = await monter({ q: 'saumon fenouil' }, { creer: aM.creer });
        bouton(rM, 'creer-ia').click(); await tick();
        const tardive = await S.renderCreerIA({}, { q: 'saumon fenouil' }, ctxDe(ANTH), { creer: sansAppel, remplacerAdresse: () => {}, navigate: () => {}, toast: () => {} });
        const enVolAvant = statutVol(tardive);
        aM.rendre[0](trouve);
        for (let i = 0; i < 12; i += 1) await Promise.resolve(); // la résolution passe avant le montage (notifier écarte la racine détachée)
        const resoluAvantMontage = !S.etatCreation().enCours;
        scene.append(tardive);
        await tick();
        eq([enVolAvant, resoluAvantMontage, statutVol(tardive), tardive.querySelector('.proposition h2')?.textContent, !!bouton(tardive, 'garder-ia')], [true, true, false, 'Saumon au fenouil', true], 'P6 : une racine montée après la résolution du vol se remet à jour (ni écran du vol figé, ni « Annuler » d’un vol fini)');
        rM.remove(); tardive.remove();
      });
      eq(appelsReseau, 0, 'écran de création : aucun appel réseau réel pendant ces tests');
    } finally { globalThis.fetch = vraiFetch; scene.remove(); S.reinitialiserCreation(); setUiLocale(localeAvant); }

    // F2 — ROUTES_DE_SAISIE : une passe de synchronisation ne reconstruit jamais l'écran de création (sa saisie et son vol)
    const etatUi = await import('../src/ui/state.js');
    ok(etatUi.ROUTES_DE_SAISIE.includes('/recipes/creer') && etatUi.estRouteDeSaisie('/recipes/creer') && !etatUi.estRouteDeSaisie('/recipes/rc1'), 'F2 : /recipes/creer est un écran de saisie, /recipes/rc1 ne l’est pas');

    // en.js : chaque texte de l'écran a sa traduction
    const CLES_T3 = ['Créer une recette avec l’assistant IA', 'Pour créer une recette, configure l’assistant IA : fournisseur Anthropic, modèle et clé.', 'Ce fournisseur ne crée pas de recette ici. Choisis Anthropic dans Réglages → Assistant IA.', 'Cette version ne peut pas être adaptée ici.', 'Retour à la recette',
      'Ce que tu as, ce que tu veux', 'Ex. : un souper pour deux avec du saumon et du fenouil, en 30 minutes', 'Restrictions', 'Type de recette', 'Au choix de l’assistant', 'Portions', 'Temps maximal (minutes, facultatif)', 'Créer ma recette', 'Créer à nouveau', 'Une création = un appel à ton compte Anthropic.',
      'Écris d’abord ce que tu veux cuisiner.', 'Portions : un nombre entier de 1 à 12.', 'Temps maximal : de 5 à 240 minutes, ou vide.', 'L’assistant compose une recette…', 'Annuler', 'Une création est déjà en cours : annule-la d’abord.', 'La demande a changé depuis cette proposition.',
      'Créée avec l’IA · non testée', 'Adaptée avec l’IA · non testée', 'Selon l’assistant : {texte}', '1 portion', '{n} portions', 'environ {m} min (estimé par l’assistant)', 'Ingrédients', 'Étapes', 'Conseils', 'À vérifier avant de servir', 'Restrictions demandées', 'Incompatible : {lignes}', 'À vérifier, à retirer : {lignes}', 'À vérifier', 'identité proposée',
      'L’assistant n’a pas cuisiné cette recette : vérifie les quantités, les cuissons et les étiquettes avant de la servir.', 'Demande envoyée : {q}', 'au plus {m} min', '{u} jetons', 'Cette proposition n’est pas enregistrée : elle sera perdue à la fermeture de l’app.', 'Garder cette recette', 'Recommencer', 'Modifier la demande',
      'Recette gardée', 'Ouvrir la fiche', 'Enregistrement de la recette…', 'La recette n’a pas pu être gardée. Réessaie.', 'L’assistant n’a pas rendu une recette lisible. Recommence.', 'Réponse coupée : réessaie avec une demande plus courte.', 'Tu es hors ligne.', 'Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.',
      'Trop de demandes pour l’instant. Réessaie dans une minute.', 'L’assistant a refusé cette demande.', 'L’assistant n’a pas répondu. Réessaie.', 'Réessayer', 'Réglages', 'Code : {c}'];
    eq(CLES_T3.filter((k) => typeof EN[k] !== 'string' || !EN[k]), [], 'en.js : chaque texte de l’écran de création a sa traduction');
  }
}
