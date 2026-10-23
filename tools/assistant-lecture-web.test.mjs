// Tests Node du module pur supabase/functions/assistant/lecture-web.js (lot B « Recette web complète », spec § 6.2, § 7.1). Aucun réseau.
// LECTURE_WEB_JS (variable d'environnement) désigne une COPIE du module : c'est ainsi que les mutants de la tâche 1 sont rejoués.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
// Filet best-effort : une copie n'est éprouvée que par un chemin ABSOLU HORS du dépôt (jamais un module muté en place), et le chemin éprouvé est
// imprimé — une variable restée exportée dans un shell ne fait jamais éprouver une copie en silence.
const COPIE = process.env.LECTURE_WEB_JS;
if (COPIE !== undefined) {
  if (!path.isAbsolute(COPIE) || !path.relative(path.join(ICI, '..'), COPIE).startsWith('..')) throw new Error('LECTURE_WEB_JS : chemin absolu hors du dépôt seulement : ' + COPIE);
  console.log('# LECTURE_WEB_JS : module éprouvé = ' + COPIE);
}
const MODULE = COPIE || path.join(ICI, '..', 'supabase', 'functions', 'assistant', 'lecture-web.js');
const L = await import(pathToFileURL(MODULE).href);
const MIO = 1024 * 1024;
const script = (json, attributs = 'type="application/ld+json"') => `<script ${attributs}>${typeof json === 'string' ? json : JSON.stringify(json)}</script>`;
const RICARDO = {
  '@context': 'https://schema.org', '@type': 'Recipe', name: 'Pâtes puttanesca',
  recipeIngredient: ['250 g de spaghettis', '30 ml d’huile d’olive', '2 gousses d’ail hachées', '1 boîte de tomates', '60 ml d’olives noires', '15 ml de câpres', '4 filets d’anchois'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Cuire les pâtes.' }, { '@type': 'HowToStep', text: 'Chauffer l’huile.' }, { '@type': 'HowToStep', text: 'Ajouter les tomates.' }, { '@type': 'HowToStep', text: 'Mélanger et servir.' }],
  recipeYield: '4 portions', prepTime: 'PT20M', cookTime: 'PT1H', totalTime: 'PT1H20M',
  description: 'Un classique du garde-manger.', author: { '@type': 'Person', name: 'Ricardo' }, image: ['https://ricardo.test/a.jpg'],
};

test('valideAdresse : table', () => {
  const admis = ['https://ricardocuisine.com/recettes/1', 'https://www.exemple.test/a?b=1#c', 'https://xn--caf-dma.test/', 'https://a.b.c.test/', 'https://a.test/' + 'x'.repeat(2048 - 15)];
  for (const u of admis) assert.equal(L.valideAdresse(u).ok, true, 'admis : ' + u.slice(0, 60));
  assert.equal('https://a.test/'.length, 15);
  assert.deepEqual(L.valideAdresse('https://www.exemple.test/a?b=1#c'), { ok: true, href: 'https://www.exemple.test/a?b=1', hote: 'www.exemple.test' }, 'fragment retiré de href');
  const refuses = ['http://a.test/', 'ftp://a.test/', 'javascript:alert(1)', '', null, 7, 'https://a.test/' + 'x'.repeat(2048 - 15 + 1), 'https://127.0.0.1/', 'https://2130706433/', 'https://[::1]/',
    'https://localhost/', 'https://localhost./', 'https://intranet/', 'https://x.local/', 'https://metadata.google.internal/', 'https://a.localhost/', 'https://u:p@a.test/', 'https://a.test:8443/',
    'https://a.test/' + String.fromCodePoint(0x2028) + 'x', 'https://café.test/', 'https://a.test/ x'];
  for (const u of refuses) assert.deepEqual(L.valideAdresse(u), { ok: false, raison: 'interdit' }, 'refusé : ' + JSON.stringify(u).slice(0, 60));
  assert.equal(L.valideAdresse('https://projet.supabase.co/', { hotesRefuses: ['projet.supabase.co'] }).ok, false, 'S-12 : l hote du projet est refusé');
  assert.equal(L.valideAdresse('https://projet.supabase.co/').ok, true, 'S-12 : admis sans hotesRefuses');
  assert.equal(L.valideAdresse('https://x.projet.supabase.co/', { hotesRefuses: ['projet.supabase.co'] }).ok, false, 'S-12 : un sous-domaine de l hote refusé l est aussi');
  assert.equal(L.valideAdresse('https://autreprojet.supabase.co/', { hotesRefuses: ['projet.supabase.co'] }).ok, true, 'S-12 : même fin de texte sans point : pas un sous-domaine');
  assert.equal(L.valideAdresse('https://A.Test./x').hote, 'a.test', 'hote sans point final, en minuscules');
  // La borne vaut aussi pour l'adresse NORMALISÉE : 2 000 « " » tiennent en 2 048 points de code, mais href les écrit %22 (6 015) ; et ce qui est
  // admis le reste une fois relu (idempotence : url_finale ne dépasse jamais la borne).
  assert.deepEqual(L.valideAdresse('https://a.test/' + '"'.repeat(2000)), { ok: false, raison: 'interdit' }, 'href normalisé de plus de 2 048 : refusé');
  for (const u of admis) assert.equal(L.valideAdresse(L.valideAdresse(u).href).ok, true, 'relu admis : ' + u.slice(0, 60));
});
test('hoteAdmis : point final et casse', () => {
  assert.equal(L.hoteAdmis('A.TEST.'), true);
  assert.equal(L.hoteAdmis('LOCALHOST'), false);
  assert.equal(L.hoteAdmis('A.Supabase.CO', ['a.supabase.co']), false);
  assert.equal(L.hoteAdmis('a.supabase.co', ['A.SUPABASE.CO.']), false, 'la liste refusée est normalisée elle aussi');
  // '[::1]', 'localhost' et 'localhost.' n'ont aucun point : la règle du point les refuse. La règle du crochet n'est tenue que par un IPv6 qui porte
  // des points ; celle de localhost est redondante avec la règle du point (gardée, la spec la nomme).
  for (const h of [null, 7, '', '.', '[::1]', '10.0.0.1']) assert.equal(L.hoteAdmis(h), false, String(h));
  assert.equal(L.hoteAdmis('[::ffff:1.2.3.4]'), false, 'IPv6 entre crochets AVEC des points : la règle du crochet');
  assert.equal(L.hoteAdmis('x.a.supabase.co', ['a.supabase.co']), false, 'sous-domaine d un hote refusé');
});
test('typeAdmis', () => {
  for (const t of ['text/html', 'TEXT/HTML; charset=utf-8', 'application/xhtml+xml', 'text/html ; charset=utf-8']) assert.equal(L.typeAdmis(t), true, t);
  for (const t of ['application/pdf', 'image/jpeg', 'text/plain', 'application/json', '', null]) assert.equal(L.typeAdmis(t), false, String(t));
});
test('lireCharset : table', () => {
  const o = (s) => new TextEncoder().encode(s);
  assert.equal(L.lireCharset('text/html; charset=ISO-8859-1', o('')), 'iso-8859-1');
  assert.equal(L.lireCharset('text/html', o("<meta charset='windows-1252'>")), 'windows-1252');
  assert.equal(L.lireCharset('text/html', o('<meta http-equiv="Content-Type" content="text/html; charset=utf-8">')), 'utf-8');
  assert.equal(L.lireCharset('text/html', o(' '.repeat(5000) + "<meta charset='windows-1252'>")), 'utf-8', 'au-delà de 4 096 octets : non lu');
  assert.equal(L.lireCharset('text/html; charset=x-bidon', o('')), 'utf-8', 'label inconnu');
  assert.equal(L.lireCharset(null, null), 'utf-8');
});
test('extraireBlocsJsonLd : formes', () => {
  const r = { '@type': 'Recipe', name: 'A' };
  assert.deepEqual(L.extraireBlocsJsonLd(script(r)), [r], 'un bloc');
  assert.deepEqual(L.extraireBlocsJsonLd(script(r) + '<p>x</p>' + script({ '@type': 'Person', name: 'B' })).map((o) => o.name), ['A', 'B'], 'deux blocs');
  assert.deepEqual(L.extraireBlocsJsonLd(script(r, "data-x='1' TYPE='application/ld+json' id=\"y\"")), [r], 'type en majuscules, guillemets simples, attributs avant et après');
  assert.deepEqual(L.extraireBlocsJsonLd(script([r, { '@type': 'Thing' }])).length, 2, 'tableau de premier niveau aplati');
  assert.deepEqual(L.extraireBlocsJsonLd(script({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, r] })).map((o) => o['@type']), ['WebPage', 'Recipe'], '@graph aplati');
  assert.deepEqual(L.extraireBlocsJsonLd(script('<!--' + JSON.stringify(r) + '-->')), [r], 'commentaire retiré');
  assert.deepEqual(L.extraireBlocsJsonLd(script('<![CDATA[' + JSON.stringify(r) + ']]>')), [r], 'CDATA retiré');
  assert.deepEqual(L.extraireBlocsJsonLd(script('{pas du json')), [], 'JSON invalide ignoré sans lever');
  assert.deepEqual(L.extraireBlocsJsonLd(script({ '@type': 'Recipe', name: 'x'.repeat(513 * 1024) })), [], 'bloc > 512 Kio ignoré');
  assert.deepEqual(L.extraireBlocsJsonLd(script(r, 'type="text/javascript"')), [], 'un autre type jamais lu');
  assert.deepEqual(L.extraireBlocsJsonLd('<script type="application/ld+json">' + JSON.stringify(r)), [], 'jamais fermé : rien, sans lever');
  assert.deepEqual(L.extraireBlocsJsonLd(null), []);
  assert.deepEqual(L.extraireBlocsJsonLd(script(r, 'type="application/ld+json" data-x="' + 'x'.repeat(3000) + '"')), [], 'balise ouvrante de plus de 2 048 caractères : jamais lue (S-4)');
  assert.deepEqual(L.extraireBlocsJsonLd(script({ '@type': 'Recipe', name: 'a</scriptx>b' })), [{ '@type': 'Recipe', name: 'a</scriptx>b' }], '« </scriptx » ne ferme pas le bloc');
});
test('trouverRecettes', () => {
  const objets = [{ '@type': 'Recipe', n: 1 }, { '@type': ['Recipe', 'Thing'], n: 2 }, { '@type': ['Thing'], n: 3 }, { n: 4 }, { '@type': 'Recipe', n: 5 }];
  assert.deepEqual(L.trouverRecettes(objets).map((o) => o.n), [1, 2, 5]);
  assert.deepEqual(L.trouverRecettes('x'), []);
});
test('prototype : aucune pollution (S-11)', () => {
  try {
    const [objet] = L.extraireBlocsJsonLd(script('{"@type":"Recipe","__proto__":{"pollue":1},"name":"x","recipeIngredient":["a"]}'));
    const { recette, lisible } = L.recetteDepuisJsonLd(objet);
    assert.equal(lisible, true); assert.equal(recette.title, 'x');
    assert.equal(({}).pollue, undefined); assert.equal(Object.prototype.pollue, undefined); assert.equal(recette.pollue, undefined);
  } finally { delete Object.prototype.pollue; }
  const source = readFileSync(MODULE, 'utf8');
  // Filets de source best-effort (S-11, F-1) : ils attrapent les formes usuelles, pas toutes les écritures possibles.
  assert.ok(!source.includes('Object.assign(') && !/\bObject\s*\[/.test(source), 'aucun Object.assign, ni par Object[…] (best-effort)');
  assert.doesNotMatch(source, /\bfor\s*\([^)]*\bin\b/, 'aucune boucle for…in, variable déclarée ou non (best-effort)');
  assert.doesNotMatch(source, /^\s*import\b/m, 'feuille : aucun import');
  assert.doesNotMatch(source, /^\s*export\b[^;]*\bfrom\b/m, 'feuille : aucun ré-export d un autre module (best-effort)');
  assert.doesNotMatch(source, /\bimport\s*\(/, 'feuille : aucun import dynamique');
});
test('recetteDepuisJsonLd : table', () => {
  const { recette, lisible } = L.recetteDepuisJsonLd(RICARDO);
  assert.equal(lisible, true);
  assert.deepEqual(recette, {
    title: 'Pâtes puttanesca', servings: 4, prep_minutes: 20, cook_minutes: 60, total_minutes: 80,
    ingredients: RICARDO.recipeIngredient.map((s) => ({ source_text: s, uncertain: false })),
    steps: [{ text: 'Cuire les pâtes.' }, { text: 'Chauffer l’huile.' }, { text: 'Ajouter les tomates.' }, { text: 'Mélanger et servir.' }],
    printed_page: null, sub_recipes: [], uncertain_fields: [], notes: 'Un classique du garde-manger.', incomplete: false, missing_page: false,
  }, 'objet § 3.4 exact, image absente');
  const r = (champs) => L.recetteDepuisJsonLd({ '@type': 'Recipe', name: 'T', recipeIngredient: ['a'], recipeInstructions: 'Faire.', ...champs }).recette;
  assert.deepEqual([r({ totalTime: 'PT45M' }).total_minutes, r({ totalTime: 'PT45M' }).prep_minutes, r({ totalTime: 'PT45M' }).cook_minutes], [45, null, null], 'B-8 : totalTime seul');
  assert.deepEqual(r({ recipeInstructions: 'Première.\nDeuxième.\n\nTroisième.' }).steps, [{ text: 'Première.' }, { text: 'Deuxième.' }, { text: 'Troisième.' }], 'chaîne : une étape par ligne non vide');
  assert.deepEqual(r({ recipeInstructions: [{ '@type': 'HowToSection', name: 'Sauce', itemListElement: [{ '@type': 'HowToStep', text: 'Un.' }, { '@type': 'HowToStep', text: 'Deux.' }] }] }).steps, [{ text: 'Un.' }, { text: 'Deux.' }], 'HowToSection à deux HowToStep');
  assert.deepEqual(r({ recipeInstructions: [{ '@type': 'HowToStep', name: 'Par le nom' }] }).steps, [{ text: 'Par le nom' }], 'HowToStep sans text → name');
  assert.equal(L.auteurDe({ author: 'Jean' }), 'Jean');
  assert.equal(L.auteurDe({ author: [{ '@type': 'Person', name: '' }, { '@type': 'Person', name: 'Marie' }] }), 'Marie', 'tableau d objets : le premier lisible');
  assert.equal(L.auteurDe({ author: 7 }), null);
  assert.deepEqual([4, '4-6', 'Pour 6', '', ['4', '4 portions'], []].map((y) => r({ recipeYield: y }).servings), [4, 4, 6, null, 4, null], 'recipeYield : nombre, chaîne, tableau (WPRM)');
  const notes = r({ description: 'mot '.repeat(1250) }).notes;
  assert.ok(Array.from(notes).length <= 2000 && notes.endsWith('…'), 'description de 5 000 → notes ≤ 2 000 finissant par …');
  assert.deepEqual(r({ recipeIngredient: ['1 &frac12; tasse de farine', '<strong>2</strong> &oelig;ufs'] }).ingredients.map((i) => i.source_text), ['1 ½ tasse de farine', '2 œufs'], 'WPRM : entités et balises');
  assert.equal(r({ name: 'P&acirc;tes &amp; sauce' }).title, 'Pâtes & sauce');
  assert.deepEqual(r({ recipeInstructions: '<p>Faire ceci.</p><p>Puis cela.</p>' }).steps, [{ text: 'Faire ceci.' }, { text: 'Puis cela.' }], 'deux étapes propres');
  const phrases = Array.from({ length: 125 }, (_, i) => `Phrase numéro ${String(i).padStart(3, '0')} de la recette, assez longue pour compter.`).join(' ');
  assert.ok(Array.from(phrases).length >= 5000);
  const decoupees = r({ recipeInstructions: phrases }).steps.map((s) => s.text);
  assert.ok(decoupees.length >= 3 && decoupees.every((s) => Array.from(s).length <= 2000 && s.endsWith('.')), 'une chaîne de 5 000 : étapes ≤ 2 000, coupées aux fins de phrase');
  assert.equal(decoupees.join(' '), phrases, 'rien de perdu (D-B25)');
  const sansIng = L.recetteDepuisJsonLd({ '@type': 'Recipe', name: 'T', recipeInstructions: 'Faire.' });
  assert.deepEqual([sansIng.recette.incomplete, sansIng.lisible], [true, true], 'sans ingrédients : incomplete, lisible');
  assert.equal(L.recetteDepuisJsonLd({ '@type': 'Recipe', name: 'Nom', image: 'x', description: 'note', author: 'A' }).lisible, false, 'B-2 : ni ligne ni étape → illisible');
  assert.deepEqual(r({ recipeIngredient: 'une seule' }).ingredients, [{ source_text: 'une seule', uncertain: false }], 'chaîne seule → une ligne');
  assert.deepEqual(r({ recipeIngredient: ['a', 7, null, { x: 1 }, '  ', 'b'] }).ingredients.map((i) => i.source_text), ['a', 'b'], 'entrées non chaînes et blanches écartées');
  assert.equal(r({ recipeIngredient: Array.from({ length: 100 }, (_, i) => 'l' + i) }).ingredients.length, 81, 'S-16 : 100 lignes → 81 relayées');
  assert.equal(r({ recipeInstructions: Array.from({ length: 70 }, (_, i) => 'Étape ' + i + '.') }).steps.length, 61, 'S-16 : 70 étapes → 61');
  assert.equal(r({ recipeYield: -4 }).servings, null, 'recipeYield négatif → null');
  assert.equal(r({ description: 'a'.repeat(1990) + ' ' + 'motlong'.repeat(5) }).notes, 'a'.repeat(1990) + '…', 'I-B2 : coupée AU MOT (le dernier mot entier, puis …), jamais en plein mot');
  // Vague finale : la borne exacte de 2 000 POINTS DE CODE (le client refuse notes > 2 000 → hors_bornes, et la recette JSON-LD entière avec elle).
  const [n2000, n2001, astral] = ['a'.repeat(2000), 'a'.repeat(2001), '😀'.repeat(2001)].map((d) => r({ description: d }).notes);
  assert.deepEqual([n2000 === 'a'.repeat(2000), Array.from(n2001).length, n2001.endsWith('…'), Array.from(astral).length, astral.endsWith('…')], [true, 2000, true, 2000, true], 'description de 2 000 → identique ; 2 001 → coupée (≤ 2 000, « … ») ; 2 001 caractères astraux → coupée aussi');
  // Les blancs de contrôle, littéraux ou en entités, deviennent une espace (un saut de ligne coupe une étape) : jamais deux mots collés, jamais
  // « 2<tab>1/2 » lu « 21/2 ».
  const [TAB, VT, FF, CR] = [9, 11, 12, 13].map((c) => String.fromCharCode(c));
  assert.deepEqual(r({ recipeIngredient: ['2' + TAB + '1/2 tasses de farine', '2&#9;1/2 tasses de lait', '250 g beurre&#10;2 oeufs', '1' + VT + FF + CR + 'pincée'] }).ingredients.map((i) => i.source_text), ['2 1/2 tasses de farine', '2 1/2 tasses de lait', '250 g beurre 2 oeufs', '1 pincée'], 'blancs de contrôle → une espace');
  assert.deepEqual(r({ recipeInstructions: 'Un.&#10;Deux.&#13;&#10;Trois.' + CR + 'Quatre.' }).steps, [{ text: 'Un.' }, { text: 'Deux.' }, { text: 'Trois.' }, { text: 'Quatre.' }], 'saut de ligne en entité, CR LF ou CR seul : une étape chacun');
  assert.deepEqual(r({ recipeInstructions: ['Cuire' + TAB + '20 min.', { '@type': 'HowToStep', text: 'Faire' + TAB + 'ceci.' }] }).steps, [{ text: 'Cuire 20 min.' }, { text: 'Faire ceci.' }], 'tabulation dans une étape');
  // Un « < » ou un « > » de texte (littéral, ou &lt; &gt; décodés) n'ouvre pas de balise : une balise commence par « < » suivi d'une lettre, de « / »,
  // de « ! » ou de « ? », comme dans un navigateur ; rien n'est avalé entre les deux.
  assert.deepEqual(r({ recipeIngredient: ['1 tasse (< 250 ml) de lait (> 3 %)', 'Eau &lt; 40 °C, pas &gt; 45 °C', 'Four &lt; 180 &deg;C, cuire &gt; 10 min'] }).ingredients.map((i) => i.source_text), ['1 tasse (< 250 ml) de lait (> 3 %)', 'Eau < 40 °C, pas > 45 °C', 'Four < 180 °C, cuire > 10 min'], '< et > de texte gardés');
  assert.deepEqual(r({ recipeInstructions: 'Cuire a < 180 degres pendant 20 min, jusqu a > 70 degres a coeur.' }).steps, [{ text: 'Cuire a < 180 degres pendant 20 min, jusqu a > 70 degres a coeur.' }], 'étape entière');
  // S-10 / I-B2 : Cc, Cf, surrogates isolés et U+2028 retirés champ par champ (titre, ligne, étape), littéraux ou en entités.
  const C = String.fromCodePoint;
  const sale = L.recetteDepuisJsonLd({ '@type': 'Recipe', name: 'Tarte' + C(0x202e) + ' aux' + C(0x200b) + ' pommes&#x202E;' + String.fromCharCode(0xd800), recipeIngredient: ['1' + C(0x200b) + ' pomme', '2 œufs' + C(0x2060)], recipeInstructions: ['Peler.' + C(0x2028) + ' Cui' + C(0x200b) + 're' + C(0x202e) + '.', { '@type': 'HowToStep', text: 'Servir' + C(0xfeff) + '.' }] }).recette;
  assert.deepEqual([sale.title, sale.ingredients.map((i) => i.source_text), sale.steps.map((s) => s.text)], ['Tarte aux pommes', ['1 pomme', '2 œufs'], ['Peler. Cuire.', 'Servir.']], 'invisibles retirés');
  // HowToSection : deux niveaux de sections lus (une section dans une section) ; au-delà, rien n'est lu et rien ne lève : la profondeur est bornée
  // pour les objets comme pour les tableaux (une chaîne de sections imbriquées en OBJETS ne remplit plus la pile).
  const section = (...items) => ({ '@type': 'HowToSection', itemListElement: items });
  const pas = (t) => ({ '@type': 'HowToStep', text: t });
  assert.deepEqual(r({ recipeInstructions: [section(pas('Un.'), section(pas('Deux.')))] }).steps, [{ text: 'Un.' }, { text: 'Deux.' }], 'une section dans une section : lue');
  assert.deepEqual(r({ recipeInstructions: [pas('Un.'), section(section(section(pas('Trop profond.'))))] }).steps, [{ text: 'Un.' }], 'trois niveaux de sections : le troisième n est pas lu');
  assert.deepEqual(r({ recipeInstructions: [[[[['Cinq.']]]], [[[[['Six.']]]]]] }).steps, [{ text: 'Cinq.' }], 'tableaux imbriqués : bornés eux aussi (cinq niveaux lus, six non)');
  const chaine = '{"@type":"HowToSection","itemListElement":'.repeat(5000) + '{"@type":"HowToStep","text":"Profond."}' + '}'.repeat(5000);
  const profonde = JSON.parse('{"@type":"Recipe","name":"T","recipeIngredient":["a"],"recipeInstructions":' + chaine + '}');
  assert.deepEqual(L.recetteDepuisJsonLd(profonde).recette.steps, [], '5 000 sections imbriquées en objets : rien de lu, aucune levée');
});
// R-B-22 (ronde finale 2, invariant « rien d'inventé ») : `portionsDe` ne prend un entier que d'un nombre nu, d'un intervalle (borne basse) ou d'un
// nombre accompagné d'un mot de portion ; sinon null. Éprouvé par recetteDepuisJsonLd (portionsDe n'est pas exportée : le module garde son contrat).
const portionsLues = (y) => L.recetteDepuisJsonLd({ '@type': 'Recipe', name: 'T', recipeIngredient: ['a'], recipeInstructions: 'Faire.', recipeYield: y }).recette.servings;
test('portionsDe (R-B-22) : table du chef d orchestre', () => {
  const table = [['750 ml', null], ['2 litres', null], ['9x13 pan', null], ['4 portions', 4], ['Pour 6', 6], ['4-6', 4], ['4 à 6 personnes', 4],
    [['4', '4 portions'], 4], [['750 ml', '6 parts'], 6], ['', null], [0, null], [-3, null], [12, 12], ['Serves 8', 8], ['4.5', null]];
  for (const [y, attendu] of table) assert.equal(portionsLues(y), attendu, JSON.stringify(y));
});
test('portionsDe (R-B-22) : formes admises, casse, blancs, intervalles, tableaux, bornes', () => {
  const admis = [['12', 12], [' 4 ', 4], ['4–6', 4], ['4 – 6', 4], ['4 - 6 servings', 4], ['4 a 6', 4], ['4 A 6 PERSONNES', 4], ['Pour 4 à 6 personnes', 4],
    ['  POUR   4   PERSONNES  ', 4], ['4\t\nportions', 4], ['1 portion', 1], ['1 personne', 1], ['1 part', 1], ['2 parts', 2], ['1 serving', 1], ['4 Servings', 4],
    ['serves 2', 2], ['Makes 12', 12], ['yield 4', 4], ['Yields 6', 6], ['6-4', 4], ['04', 4], ['00012 portions', 12], ['9999', 9999], [9999, 9999], [1, 1], ['4&nbsp;portions', 4],
    ['<b>4</b> portions', 4], ['4 &agrave; 6 personnes', 4], ['4 a' + String.fromCodePoint(0x300) + ' 6 personnes', 4]];
  for (const [y, attendu] of admis) assert.equal(portionsLues(y), attendu, 'admis : ' + JSON.stringify(y));
  const refuses = ['Pour 4 gourmands', '12 cookies', '1 loaf', '4 portions (2 tasses)', '4,5', '4.5 portions', '4 1/2', '0', '0 portions', '-3', '-3 portions',
    '4-0', '0-6', '4-', '-', 'portions', 'pour', '4 portions 6', 'pour pour 4', '4 portions portions', '4 to 6', '4—6', '4 à', '10000', '12345 portions', 'quatre',
    '4x', '½', '٤', '４', '4 ml', ' ', null, undefined, true, {}, { value: 4 }, 0, -3, 4.5, NaN, Infinity, -Infinity, 10000, 1e300, [], ['', 0, '750 ml'],
    [['4']], [[4], 'x']];
  for (const y of refuses) assert.equal(portionsLues(y), null, 'refusé : ' + (typeof y === 'string' ? JSON.stringify(y) : String(y)));
  assert.equal(portionsLues([null, '', 'Serves 3', '5']), 3, 'tableau : la PREMIÈRE valeur qui donne un entier');
  assert.equal(portionsLues([0, '4']), 4, 'tableau : zéro ne compte pas, la suivante est prise');
});
test('portionsDe (R-B-22) : une portion inconnue ne rejette pas la recette JSON-LD (servings null, le reste gardé)', () => {
  const attendu = L.recetteDepuisJsonLd(RICARDO).recette;
  const lu = L.recetteDepuisJsonLd({ ...RICARDO, recipeYield: '750 ml' });
  assert.equal(lu.lisible, true);
  assert.deepEqual(lu.recette, { ...attendu, servings: null }, 'seul servings change');
  assert.equal(attendu.servings, 4, 'témoin : « 4 portions » → 4');
  const page = L.lirePageHtml({ html: script({ ...RICARDO, recipeYield: '750 ml' }), urlFinale: 'https://a.test/' });
  assert.deepEqual([page.jsonld?.recette.title, page.jsonld?.recette.servings, page.jsonld?.recette.ingredients.length, page.texte], ['Pâtes puttanesca', null, 7, null], 'lirePageHtml : lecture jsonld gardée, aucun texte confié au modèle');
});
test('portionsDe (R-B-22) : linéaire — 100 000 chiffres, 100 000 espaces et autres formes hostiles, chacune sous 50 ms', () => {
  const hostiles = { chiffres: '7'.repeat(100000), espaces: ' '.repeat(100000), chiffresPortions: '7'.repeat(100000) + ' portions', tirets: '4-'.repeat(50000),
    mots: 'pour '.repeat(20000), alternes: '1 '.repeat(50000), entites: '&nbsp;'.repeat(20000) + '4' };
  portionsLues('4 portions'); // une passe à blanc : le premier appel ne compte pas la compilation
  for (const [nom, y] of Object.entries(hostiles)) {
    const t0 = performance.now();
    const n = portionsLues(y);
    const duree = performance.now() - t0;
    assert.equal(n, nom === 'entites' ? 4 : null, nom);
    assert.ok(duree < 50, `${nom} : ${duree.toFixed(1)} ms`);
  }
});
test('decouperEtape', () => {
  const t1500 = 'a'.repeat(1500);
  assert.deepEqual(L.decouperEtape(t1500, 2000), [t1500]);
  const ponctue = L.decouperEtape('A. '.repeat(1000), 2000);
  assert.ok(ponctue.length === 2 && ponctue.every((m) => m.length <= 2000 && m.endsWith('.')), 'aux fins de phrase');
  const espaces = L.decouperEtape('mot '.repeat(750), 2000);
  assert.ok(espaces.length === 2 && espaces.every((m) => m.length <= 2000 && m.endsWith('mot')), 'à la dernière espace');
  assert.deepEqual(L.decouperEtape('x'.repeat(2500), 2000).map((m) => m.length), [2000, 500], 'sans espace : net');
  assert.deepEqual(L.decouperEtape('  ', 2000), [], 'aucun morceau vide');
  assert.deepEqual(L.decouperEtape(null, 2000), []);
  assert.deepEqual(L.decouperEtape('aaaa; bbbb cccc', 12), ['aaaa;', 'bbbb cccc'], '« ; » est une fin de phrase');
  // max invalide : [] sans boucler. Joué dans un processus fils borné à 10 s : une boucle infinie y rougit au lieu de figer la suite.
  const code = `const L = await import(${JSON.stringify(pathToFileURL(MODULE).href)}); console.log(JSON.stringify([0, -1, null, NaN, 1.5, '10'].map((m) => L.decouperEtape('abc', m)).concat([L.decouperEtape('abc')])));`;
  const fils = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 10000 });
  assert.equal(fils.stdout.trim(), JSON.stringify(Array(7).fill([])), 'max 0, -1, null, NaN, 1.5, « 10 » ou absent → [] (signal : ' + fils.signal + ')');
});
test('dureeIsoEnMinutes', () => {
  assert.deepEqual(['PT1H30M', 'PT45M', 'P0DT1H', 'PT0S', 'PT90S', 'PT', '1h30', null, 'P1D', 'P1DT1H'].map(L.dureeIsoEnMinutes), [90, 45, 60, 0, 1, null, null, null, 1440, 1500]);
});
test('textePrincipal : table', () => {
  const page = '<html><body><header>Entête du site</header><nav>Menu</nav><main><h1>Pâtes</h1><p>Un plat rapide.</p><ul><li>200 g de pâtes</li><li>1 oignon</li></ul><script>var fuite = 1;</script></main><aside>Publicité</aside><footer>Pied</footer></body></html>';
  const lu = L.textePrincipal(page);
  assert.deepEqual([lu.texte.split('\n').filter(Boolean), lu.coupe], [['Pâtes', 'Un plat rapide.', '200 g de pâtes', '1 oignon'], false], 'seul le texte de <main>, dans l ordre');
  assert.equal(L.textePrincipal('<body><nav>Menu</nav><article><p>Article.</p></article></body>').texte, 'Article.', 'sans <main> : l article');
  assert.equal(L.textePrincipal('<body><header>H</header><nav>N</nav><p>Corps.</p><footer>F</footer></body>').texte, 'Corps.', 'ni main ni article : le body sans nav/header/footer');
  assert.equal(L.textePrincipal('<body><div>Inscris-toi à l’infolettre</div><main><p>Recette.</p></main><div>12 commentaires</div></body>').texte, 'Recette.', '<main> l emporte : le reste du body (infolettre, commentaires) n est pas lu');
  assert.equal(L.textePrincipal('<p>&eacute; &#233; &#xE9; &amp; a&nbsp;b &oelig; &frac13; &bidon;</p>').texte, 'é é é & a b œ ⅓ &bidon;', 'entités décodées (l insécable devient une espace), &bidon; conservée');
  const invisibles = L.textePrincipal('<p>a&#x202E;b&#x200B;c&#x7F;d&#x2028;e' + String.fromCodePoint(0x202e) + 'f</p>').texte;
  assert.equal(invisibles, 'abcdef', 'S-10 : &#x202E;, &#x200B;, &#x7F;, &#x2028; et un U+202E littéral retirés');
  assert.equal(L.textePrincipal('<p>un<br>deux</p><ul><li>trois</li></ul>').texte.split('\n').filter(Boolean).join('|'), 'un|deux|trois', '<br> et </li> → sauts');
  assert.equal(L.textePrincipal('<p>a  \t b</p>').texte, 'a b', 'espaces normalisés');
  const long = L.textePrincipal('<p>' + 'é'.repeat(50000) + '</p>');
  assert.deepEqual([Array.from(long.texte).length, long.coupe], [40000, true], 't3bis : 50 000 → 40 000, coupe dite');
  assert.equal(L.textePrincipal('<html><body></body></html>').texte, '', 'page sans texte');
  assert.equal(L.textePrincipal('<p>a<!-- caché -->b<![CDATA[ caché ]]>c</p>').texte, 'abc', 'commentaires et CDATA retirés');
  assert.deepEqual(L.textePrincipal(null), { texte: '', coupe: false });
  // decoderEntites, contrat direct (S-10, B-19) : un point de code valide seulement (ni au-delà de U+10FFFF, ni surrogate, ni Cc, ni Cf, ni U+2028),
  // table FERMÉE lue par Object.hasOwn ; les blancs de contrôle (&#9; &#10; &#13;) sont rendus tels quels, la normalisation en fait un blanc.
  for (const e of ['&#x110000;', '&#9999999;', '&#xD800;', '&#xDFFF;', '&#x202E;', '&#x200B;', '&#x7F;', '&#0;', '&#x2028;']) assert.equal(L.decoderEntites('a' + e + 'b'), 'ab', 'retirée : ' + e);
  for (const e of ['&toString;', '&valueOf;', '&constructor;', '&bidon;', '&EACUTE;']) assert.equal(L.decoderEntites(e), e, 'gardée telle quelle : ' + e);
  assert.deepEqual(['&#9;', '&#10;', '&#13;', '&#x41;', '&eacute;', '&Eacute;'].map(L.decoderEntites), [9, 10, 13, 65, 0xe9, 0xc9].map((c) => String.fromCharCode(c)), 'blancs de contrôle rendus, jamais retirés');
  const TAB = String.fromCharCode(9);
  assert.deepEqual(['<p>2&#9;1/2 tasses</p>', '<p>2' + TAB + '1/2 tasses</p>'].map((h) => L.textePrincipal(h).texte), ['2 1/2 tasses', '2 1/2 tasses'], 'tabulation littérale ou &#9; → une espace');
  assert.deepEqual(['<p>mot&#13;&#10;suivant</p>', '<p>mot&#13;suivant</p>', '<p>mot&#10;suivant</p>'].map((h) => L.textePrincipal(h).texte), ['mot\nsuivant', 'mot\nsuivant', 'mot\nsuivant'], 'CR LF, CR seul ou LF : un saut, jamais deux mots collés');
  assert.equal(L.textePrincipal('<p>a</p><p></p><p></p><p></p><p>b</p>').texte, 'a\n\nb', 'trois sauts et plus → deux');
  assert.equal(L.textePrincipal('<p>Cuire à < 180 °C, puis 3 < 4 et 5 > 2.</p>').texte, 'Cuire à < 180 °C, puis 3 < 4 et 5 > 2.', 'un « < » de texte n ouvre pas de balise');
  // Dans <main> : chaque élément sauté (style, noscript, svg, template), commentaire et CDATA (avec « > » ou une balise dedans), et chaque tranche
  // hors texte (aside, form, un nav dans un header) sont retirés ; seul le texte de la recette reste.
  const riche = '<html><body><main><header>Entête <nav>Menu</nav> fin</header><h1>Tarte</h1><style>.x{color:red} p > b {}</style><noscript><p>Active JavaScript</p></noscript>'
    + '<svg viewBox="0 0 1 1"><text>Icône</text></svg><template><p>Gabarit</p></template><!-- <b>caché</b> --><![CDATA[ x > y ]]><aside>Publicité</aside>'
    + '<form class="note"><label>Ta note</label></form><ul><li>3 pommes</li></ul><p>Cuire 30 minutes au four à 180 °C.</p></main></body></html>';
  assert.equal(L.textePrincipal(riche).texte, 'Tarte\n3 pommes\nCuire 30 minutes au four à 180 °C.', 'seul le texte de la recette');
  assert.equal(L.textePrincipal('<body><header><div>Site</div><main><p>' + 'Recette. '.repeat(5) + '</p></main></header></body>').texte, 'Recette. '.repeat(5).trim(), 'une tranche commencée AVANT la zone ne l efface pas');
  // <form> : retiré dans un <main> ou un <article> (infolettre, commentaires) ; jamais quand il enveloppe la page d'un vieux site (zone <body>), ni
  // jamais fermé, ni quand son retrait viderait la zone.
  const recette = '<h1>Tourtière</h1><ul><li>500 g de porc haché</li><li>1 oignon</li></ul><p>Cuire une heure au four.</p>';
  const lue = 'Tourtière\n500 g de porc haché\n1 oignon\nCuire une heure au four.';
  assert.equal(L.textePrincipal('<html><body><form id="form1"><div>Mon site</div><div class="recette">' + recette + '</div></form></body></html>').texte, 'Mon site\n' + lue, '<body><form> d un vieux site : rien d effacé');
  const entete = 'Mon site de recettes familiales, depuis 2004'; // 44 points de code : sans la règle de zone, le repli ne jouerait pas
  assert.equal(L.textePrincipal('<html><body><div>' + entete + '</div><form id="form1"><div class="recette">' + recette + '</div></form></body></html>').texte, entete + '\n' + lue, 'zone <body> : un <form> n est jamais retiré, même après assez de texte');
  assert.equal(L.textePrincipal('<main>' + recette + '<form class="infolettre"><label>Ton courriel</label><button>Envoyer</button></form></main>').texte, lue, '<form> fermé dans <main> : retiré');
  const titre = 'Pâtes au beurre noisette et à la sauge fraîche'; // 46 points de code : le repli des <form> ne joue pas
  assert.equal(L.textePrincipal('<main><h1>' + titre + '</h1><form class="note"><input name="n"><ul><li>200 g de pâtes</li></ul><p>Cuire 10 minutes.</p></main>').texte, titre + '\n200 g de pâtes\nCuire 10 minutes.', '<form> jamais fermé : rien de retiré');
  assert.equal(L.textePrincipal('<main><h1>Pâtes</h1><aside class="astuce"><ul><li>200 g de pâtes</li></ul><p>Cuire 10 minutes.</p></main>').texte, 'Pâtes\n200 g de pâtes\nCuire 10 minutes.', '<aside> jamais fermé : rien de retiré');
  assert.equal(L.textePrincipal('<main><form id="aspnetForm">' + recette + '</form></main>').texte, lue, '<form> dont le retrait viderait la zone : gardé');
  // Un nom de balise finit sur une espace, « / » ou « > » : <main-banner>, <article-card>, <svg:rect/> et </scriptx> sont d'autres balises.
  assert.equal(L.textePrincipal('<body><main-banner>Promo du jour</main-banner><main><h1>Pâtes</h1></main></body>').texte, 'Pâtes', '<main-banner> n est pas <main>');
  assert.equal(L.textePrincipal('<body><article-card>Carte voisine</article-card><article><p>La recette.</p></article></body>').texte, 'La recette.', '<article-card> n est pas <article>');
  assert.equal(L.textePrincipal('<main><p>Un</p><svg:rect/><p>Deux</p></main>').texte, 'Un\nDeux', '<svg:rect/> n est pas <svg>');
  assert.equal(L.textePrincipal('<main><p>Un</p><script>var s = "</scriptx>"; fuite()</script><p>Deux</p></main>').texte, 'Un\nDeux', '</scriptx> ne ferme pas <script>');
  assert.equal(L.textePrincipal('<main><p>Un</p><svg class="i" viewBox="0 0 1 1"/><p>Deux</p></main>').texte, 'Un\nDeux', '<svg …/> auto-fermant : fermé sur place');
  assert.equal(L.textePrincipal('<body><article><h1>Tarte</h1><article><p>Lié</p></article><ul><li>3 pommes</li></ul></article><p>Hors zone</p></body>').texte, 'Tarte\nLié\n3 pommes', 'la zone se ferme au </article> qui équilibre son ouvrant');
});
test('borne temporelle (S-4) : trois pages hostiles de 2 Mio, lues en moins de 500 ms chacune, sans lever', () => {
  const ouvrante = '<script type="application/ld+json">{';
  const pages = { scripts: ouvrante.repeat(Math.ceil(2 * MIO / ouvrante.length)).slice(0, 2 * MIO), chevrons: '<'.repeat(2 * MIO), esperluettes: '&'.repeat(2 * MIO) };
  for (const [nom, html] of Object.entries(pages)) {
    const t0 = performance.now();
    const lu = L.lirePageHtml({ html, urlFinale: 'https://a.test/', contentType: 'text/html' });
    const duree = performance.now() - t0;
    assert.equal(lu.jsonld, null, nom);
    assert.ok(duree < 500, `${nom} : ${Math.round(duree)} ms`);
  }
});
test('titreDe / siteDe / auteurDe : bornes et replis', () => {
  assert.equal(L.titreDe('<title>' + 't'.repeat(1000) + '</title>').length, 300);
  assert.equal(L.titreDe('<p>x</p>'), null);
  assert.equal(L.siteDe(null, '<meta property="og:site_name" content="Le &amp; Site">'), 'Le & Site');
  assert.equal(L.siteDe({ publisher: { '@type': 'Organization', name: 'Éditeur' } }, '<meta property="og:site_name" content="Autre">'), 'Éditeur', 'publisher.name d abord');
  assert.equal(L.siteDe({ publisher: [{ name: 'Premier' }] }, ''), 'Premier', 'publisher en tableau');
  assert.equal(L.siteDe(null, '<meta property="og:site_name" content="' + 's'.repeat(400) + '">').length, 200);
  assert.equal(L.siteDe(null, '<p>rien</p>'), null);
  assert.equal(L.lirePageHtml({ html: '<meta name="author" content="Auteur Meta"><main>' + 'texte '.repeat(20) + '</main>', urlFinale: 'https://a.test/' }).page.auteur, 'Auteur Meta', 'meta author en repli');
  assert.equal(L.auteurDe({ author: 'a'.repeat(400) }).length, 200);
  assert.equal(L.titreDe('<title>Premier</title><title>Second</title>'), 'Premier', 'le premier <title>');
  assert.equal(L.siteDe(null, '<meta property="og:site_name" content="Premier"><meta property="og:site_name" content="Second">'), 'Premier', 'la première meta');
});
test('lirePageHtml : assemblage', () => {
  const autre = { '@type': 'Recipe', name: 'Autre', recipeIngredient: ['x'] };
  const avec = L.lirePageHtml({ html: '<title>Titre</title>' + script(RICARDO) + script(autre), urlFinale: 'https://www.ricardo.test/r/1', contentType: 'text/html' });
  assert.deepEqual(avec, {
    jsonld: { recette: L.recetteDepuisJsonLd(RICARDO).recette, autres: 1 }, texte: null, texte_coupe: false,
    page: { url_finale: 'https://www.ricardo.test/r/1', hote: 'www.ricardo.test', titre_page: 'Titre', auteur: 'Ricardo', site: null, lue_le: null, autres_recettes: 1, texte_coupe: false, image_url: 'https://ricardo.test/a.jpg' },
  });
  const sans = L.lirePageHtml({ html: '<main><p>Une recette racontée.</p></main>', urlFinale: 'https://blogue.test/x' });
  assert.deepEqual([sans.jsonld, sans.texte, sans.page.hote, sans.page.autres_recettes], [null, 'Une recette racontée.', 'blogue.test', 0]);
  const illisible = { '@type': 'Recipe', name: 'Vide', image: 'x' };
  const deux = L.lirePageHtml({ html: script(illisible) + script(RICARDO), urlFinale: 'https://a.test/' });
  assert.deepEqual([deux.jsonld.recette.title, deux.jsonld.autres], ['Pâtes puttanesca', 0], 'B-2 : la première illisible est sautée et non comptée');
  const seule = L.lirePageHtml({ html: script(illisible) + '<main><p>Texte de la recette.</p></main>', urlFinale: 'https://a.test/' });
  assert.deepEqual([seule.jsonld, seule.texte], [null, 'Texte de la recette.'], 'une seule Recipe illisible : le texte');
  const long = L.lirePageHtml({ html: '<main><p>' + 'é'.repeat(50000) + '</p></main>', urlFinale: 'https://a.test/' });
  assert.deepEqual([long.jsonld, Array.from(long.texte).length, long.texte_coupe, long.page.texte_coupe], [null, 40000, true, true], 'sans JSON-LD, page longue : la coupe est dite aux deux places');
  const metas = '<meta property="og:site_name" content="Site Meta"><meta name="author" content="Auteur Meta">';
  const ld = { ...RICARDO, author: { '@type': 'Person', name: 'Auteur LD' }, publisher: { '@type': 'Organization', name: 'Éditeur LD' } };
  const prec = L.lirePageHtml({ html: metas + script(ld), urlFinale: 'https://A.Test./r' }).page;
  assert.deepEqual([prec.auteur, prec.site, prec.hote], ['Auteur LD', 'Éditeur LD', 'a.test'], 'le JSON-LD l emporte sur les metas ; hote sans point final, en minuscules');
  const parMetas = L.lirePageHtml({ html: metas + '<main><p>' + 'Texte de recette. '.repeat(5) + '</p></main>', urlFinale: 'https://a.test/' }).page;
  assert.deepEqual([parMetas.auteur, parMetas.site], ['Auteur Meta', 'Site Meta'], 'sans JSON-LD : les metas');
  const turc = L.lirePageHtml({ html: '<title>' + String.fromCodePoint(0x130).repeat(4) + ' Izmir</title>' + script(RICARDO), urlFinale: 'https://a.test/' });
  assert.equal(turc.jsonld?.recette.title, 'Pâtes puttanesca', 'copie en minuscules de MÊME longueur : des « İ » avant le bloc ne décalent rien');
  const icone = L.lirePageHtml({ html: '<svg class="i" viewBox="0 0 1 1"/>' + script(RICARDO), urlFinale: 'https://a.test/' });
  assert.equal(icone.jsonld?.recette.title, 'Pâtes puttanesca', '<svg …/> auto-fermant avant le bloc : le bloc est lu');
  const niveaux = 11000;
  const profond = '{"@type":"Recipe","name":"T","recipeIngredient":["a"],"recipeInstructions":' + '{"@type":"HowToSection","itemListElement":'.repeat(niveaux) + '{"@type":"HowToStep","text":"Profond."}' + '}'.repeat(niveaux) + '}';
  assert.ok(profond.length < 512 * 1024, 'sous la borne d un bloc');
  const lu = L.lirePageHtml({ html: script(profond), urlFinale: 'https://a.test/' });
  assert.deepEqual([lu.jsonld?.recette.title, lu.jsonld?.recette.steps], ['T', []], '11 000 sections imbriquées en objets : aucune levée (« aucune fonction ne lève »)');
});

// --- Lot F « Les plats en images » (spec § 6.1, § 7.1) : l'image de la page et son transport en base64 ------------------------------------------
const octetsDe = (...morceaux) => Uint8Array.from(morceaux.flat());
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
// Octets pseudo-aléatoires à graine fixe (reproductibles d'un passage à l'autre).
const pseudo = (n, graine = 7) => { const u = new Uint8Array(n); let x = graine >>> 0; for (let i = 0; i < n; i += 1) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; u[i] = x >>> 24; } return u; };

test('LIMITES_IMAGE : forme (R-F-4)', () => {
  assert.ok(Object.isFrozen(L.LIMITES_IMAGE) && Object.isFrozen(L.LIMITES_IMAGE.types), 'gelees');
  assert.deepEqual([L.LIMITES_IMAGE.url, L.LIMITES_IMAGE.redirections, L.LIMITES_IMAGE.delaiSautMs, L.LIMITES_IMAGE.delaiTotalMs],
    [L.LIMITES_LECTURE.url, L.LIMITES_LECTURE.redirections, L.LIMITES_LECTURE.delaiSautMs, L.LIMITES_LECTURE.delaiTotalMs], 'url, redirections et delais recopient LIMITES_LECTURE');
  assert.equal(L.LIMITES_IMAGE.octets, 2097152, '2 Mio en litteral : le meme que LIMITES_IMAGE_WEB.octets du client (les deux suites ne partagent aucun module)');
  assert.deepEqual([...L.LIMITES_IMAGE.types], ['image/jpeg', 'image/png', 'image/webp'], 'exactement trois types');
});

test('typeImageAdmis : table', () => {
  const table = [['image/jpeg', 'image/jpeg'], ['IMAGE/PNG; charset=binary', 'image/png'], ['image/webp', 'image/webp'], ['image/gif', null], ['image/svg+xml', null],
    ['image/heic', null], ['text/html', null], ['application/octet-stream', null], ['', null], [null, null], [undefined, null], [7, null]];
  for (const [entree, attendu] of table) assert.equal(L.typeImageAdmis(entree), attendu, String(entree));
});

test('signatureImage : table (les premiers octets doivent dire le type)', () => {
  assert.equal(L.signatureImage(octetsDe([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])), 'image/jpeg');
  assert.equal(L.signatureImage(octetsDe([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), 'image/png');
  assert.equal(L.signatureImage(octetsDe(ascii('RIFF'), [1, 2, 3, 4], ascii('WEBP'), ascii('VP8 '))), 'image/webp');
  assert.equal(L.signatureImage(octetsDe(ascii('RIFF'), [1, 2, 3, 4], ascii('AVI '), [0, 0])), null, 'RIFF sans WEBP aux octets 8-11 : null');
  assert.equal(L.signatureImage(octetsDe(ascii('<!doctype html>'))), null, 'un HTML');
  assert.equal(L.signatureImage(octetsDe(ascii('%PDF-1.4'))), null, 'un PDF');
  assert.equal(L.signatureImage(octetsDe([0xff, 0xd8])), null, 'deux octets');
  assert.equal(L.signatureImage(new Uint8Array(0)), null, 'vide');
  assert.equal(L.signatureImage('pas des octets'), null, 'ne leve jamais');
});

test('imageDe : formes (S-11 : jamais Object.assign ni for…in)', () => {
  assert.equal(L.imageDe({ image: 'https://a.test/i.jpg' }), 'https://a.test/i.jpg', 'chaine');
  assert.equal(L.imageDe({ image: { url: 'https://a.test/u.jpg' } }), 'https://a.test/u.jpg', '{ url }');
  assert.equal(L.imageDe({ image: { contentUrl: 'https://a.test/c.jpg' } }), 'https://a.test/c.jpg', '{ contentUrl }');
  assert.equal(L.imageDe({ image: { url: 'https://a.test/u.jpg', contentUrl: 'https://a.test/c.jpg' } }), 'https://a.test/u.jpg', 'ronde 1 : url, SINON contentUrl (l ordre du contrat)');
  assert.equal(L.imageDe({ image: ['https://a.test/1.jpg', 'https://a.test/2.jpg'] }), 'https://a.test/1.jpg', 'tableau de chaines : la premiere');
  assert.equal(L.imageDe({ image: [{ '@type': 'ImageObject' }, { url: 'https://a.test/o.jpg' }] }), 'https://a.test/o.jpg', 'tableau d ImageObject : le premier qui rend une adresse');
  assert.equal(L.imageDe({ image: [] }), null, 'tableau vide');
  // Ronde 1 : la borne de récursion (PROFONDEUR_IMAGE = 2) — un tableau, ou un tableau de tableaux, au plus.
  assert.equal(L.imageDe({ image: [['https://a.test/x.jpg']] }), 'https://a.test/x.jpg', 'tableau de tableaux : admis');
  assert.equal(L.imageDe({ image: [[{ url: 'https://a.test/y.jpg' }]] }), 'https://a.test/y.jpg', 'tableau de tableaux d ImageObject : admis');
  assert.equal(L.imageDe({ image: [[['https://a.test/x.jpg']]] }), null, 'trois niveaux de tableaux : null');
  assert.equal(L.imageDe({ image: { '@type': 'ImageObject' } }), null, 'ImageObject sans adresse');
  assert.equal(L.imageDe({ image: '<b>https://a.test/i.jpg</b>' }), 'https://a.test/i.jpg', 'balises retirees');
  assert.equal(L.imageDe({ image: 'https://a.test/i.jpg?a=1&amp;b=2' }), 'https://a.test/i.jpg?a=1&b=2', 'entites decodees');
  assert.equal(L.imageDe({ image: 7 }), null);
  assert.equal(L.imageDe(null), null);
  // S-11 : un champ HÉRITÉ du prototype n'est jamais lu (Object.hasOwn) — le prototype est pollué le temps des appels, rendu en finally. Un
  // JSON.parse de « __proto__ » crée une clé PROPRE et ne prouverait rien (un accès direct x.url y rendrait aussi null).
  try {
    Object.prototype.url = 'https://evil.test/u.jpg'; Object.prototype.image = 'https://evil.test/i.jpg';
    assert.deepEqual([L.imageDe({ image: {} }), L.imageDe({}), L.imageDe({ image: [{}] })], [null, null, null], 'url et image heritees du prototype : jamais lues');
  } finally { delete Object.prototype.url; delete Object.prototype.image; }
});

test('imageOgDe : la balise lue dans sa tranche, lineaire (S-4)', () => {
  assert.equal(L.imageOgDe('<head><meta property="og:image" content="https://a.test/i.jpg"></head>'), 'https://a.test/i.jpg');
  assert.equal(L.imageOgDe('<meta name="og:image" content="https://a.test/n.jpg">'), 'https://a.test/n.jpg', 'name=');
  assert.equal(L.imageOgDe('<meta content="https://a.test/o.jpg" property="og:image">'), 'https://a.test/o.jpg', 'ordre des attributs libre');
  assert.equal(L.imageOgDe("<META PROPERTY='og:image' CONTENT='https://a.test/q.jpg'>"), 'https://a.test/q.jpg', 'casse libre, guillemets simples');
  assert.equal(L.imageOgDe('<meta property="og:image" content="https://a.test/i.jpg?a=1&amp;b=2">'), 'https://a.test/i.jpg?a=1&b=2', 'entites decodees');
  assert.equal(L.imageOgDe('<meta property="og:image" content="https://a.test/1.jpg"><meta property="og:image" content="https://a.test/2.jpg">'), 'https://a.test/1.jpg', 'la premiere');
  assert.equal(L.imageOgDe('<meta property="og:image:secure_url" content="https://a.test/s.jpg">'), null, 'og:image:secure_url seul : ignore');
  assert.equal(L.imageOgDe('<meta property="og:image:url" content="https://a.test/u.jpg">'), null, 'og:image:url seul : ignore');
  assert.equal(L.imageOgDe('<html><head><title>x</title></head></html>'), null, 'absente');
  assert.equal(L.imageOgDe('<meta property="og:image" content="https://a.test/i.jpg"'), null, 'balise jamais fermee : null, sans lever');
  assert.equal(L.imageOgDe(42), null);
  // Ronde 1 : le contrat « rognée » (spec § 6.1) — des blancs autour de l'adresse sont retirés ; un content de blancs seuls vaut null.
  assert.equal(L.imageOgDe('<meta property="og:image" content="  https://a.test/i.jpg  ">'), 'https://a.test/i.jpg', 'rognee');
  assert.equal(L.imageOgDe('<meta property="og:image" content="   ">'), null, 'blancs seuls : null');
  const t0 = performance.now();
  assert.equal(L.imageOgDe('<meta'.repeat(Math.ceil((2 * MIO) / 5))), null);
  assert.ok(performance.now() - t0 < 500, '2 Mio de <meta sans > : sous 500 ms');
});

// Ronde 1 (S-4) : l'essai ci-dessus arrête le balayage à la première balise sans « > » et n'entre jamais dans lireMetaTranche. Ici, 2 Mio de
// balises meta FERMÉES, chacune sous la borne de 2 048 caractères de la tranche : la clé et le content y sont cherchés pour de bon. Les deux
// premières pages (une longue suite de blancs après « name= » ou « property= ») faisaient revenir en arrière le motif de la clé de façon
// quadratique (≈ 3,4 s mesurées) ; la troisième compte les tranches (≈ 36 000 balises og:image courtes) ; la quatrième lit une og:image longue.
test('imageOgDe et lirePageHtml : 2 Mio de balises meta FERMEES lues dans leur tranche, en moins de 500 ms chacune (S-4)', () => {
  const remplir = (motif) => motif.repeat(Math.ceil((2 * MIO) / motif.length));
  const longue = 'https://a.test/' + 'x'.repeat(1950);
  const pages = [
    ['name= puis 2 030 blancs', remplir('<meta name=' + ' '.repeat(2030) + 'z>'), null],
    ['property= puis 2 026 blancs', remplir('<meta property=' + ' '.repeat(2026) + 'z>'), null],
    ['og:image courtes', remplir('<meta property="og:image" content="https://a.test/i.jpg">'), 'https://a.test/i.jpg'],
    ['og:image de 2 002 caracteres', remplir('<meta property="og:image" content="' + longue + '">'), longue],
  ];
  for (const [nom, html, attendu] of pages) {
    assert.ok(html.length >= 2 * MIO, nom + ' : 2 Mio');
    let t0 = performance.now();
    assert.equal(L.imageOgDe(html), attendu, nom + ' : imageOgDe');
    const og = performance.now() - t0;
    t0 = performance.now();
    const lue = L.lirePageHtml({ html, urlFinale: 'https://a.test/' });
    const lp = performance.now() - t0;
    assert.equal(lue.page.image_url, attendu, nom + ' : lirePageHtml');
    assert.ok(og < 500 && lp < 500, `${nom} : imageOgDe ${og.toFixed(0)} ms, lirePageHtml ${lp.toFixed(0)} ms (borne : 500 ms chacune)`);
  }
});

test('imageUrlDe : priorite, resolution, validation, pages de liste (D-F3)', () => {
  const OG = '<meta property="og:image" content="https://og.test/og.jpg">';
  const base = { urlFinale: 'https://site.test/r/x' };
  assert.equal(L.imageUrlDe({ image: 'https://site.test/ld.jpg' }, OG, base), 'https://site.test/ld.jpg', 'l image du JSON-LD avant og:image');
  assert.equal(L.imageUrlDe({ name: 'x' }, OG, base), 'https://og.test/og.jpg', 'JSON-LD sans image : og:image');
  assert.equal(L.imageUrlDe({ name: 'x' }, OG, { ...base, autresRecettes: 2 }), null, 'page de liste : og:image ecartee');
  assert.equal(L.imageUrlDe({ image: 'https://site.test/ld.jpg' }, OG, { ...base, autresRecettes: 2 }), 'https://site.test/ld.jpg', 'page de liste : l image du Recipe retenu reste');
  assert.equal(L.imageUrlDe(null, OG, base), 'https://og.test/og.jpg', 'sans objet : og:image');
  assert.equal(L.imageUrlDe({ image: '/img/i.jpg' }, '', base), 'https://site.test/img/i.jpg', 'relative resolue contre urlFinale');
  assert.equal(L.imageUrlDe({ image: '//cdn.test/i.jpg' }, '', base), 'https://cdn.test/i.jpg', 'sans schema resolue');
  for (const refusee of ['http://a.test/i.jpg', 'https://127.0.0.1/i.jpg', 'https://a.test:8443/i.jpg', 'https://localhost/i.jpg', 'https://u:p@a.test/i.jpg']) assert.equal(L.imageUrlDe({ image: refusee }, '', base), null, refusee);
  assert.equal(L.imageUrlDe({ image: 'https://projet.test/i.jpg' }, '', { ...base, hotesRefuses: ['projet.test'] }), null, 'hote du projet');
  assert.equal(L.imageUrlDe({ image: 'https://a.test/i.jpg#frag' }, '', base), 'https://a.test/i.jpg', 'fragment retire');
  assert.equal(L.imageUrlDe({ image: 'https://a.test/' + 'x'.repeat(2049 - 15) }, '', base), null, '2 049 points de code');
  assert.equal(L.imageUrlDe({ image: '/i.jpg' }, '', {}), null, 'relative sans urlFinale : null, sans lever');
  assert.equal(L.imageUrlDe(null, '', base), null);
});

test('versBase64 : base64 valide a toute taille (TRANCHE_BASE64 multiple de 3)', () => {
  assert.equal(L.TRANCHE_BASE64, 24576);
  assert.equal(L.TRANCHE_BASE64 % 3, 0, 'une tranche multiple de 3 n a jamais de remplissage');
  assert.deepEqual([L.versBase64(Uint8Array.of(0)), L.versBase64(Uint8Array.of(0, 0)), L.versBase64(new Uint8Array(0))], ['AA==', 'AAA=', '']);
  for (const n of [100000, L.TRANCHE_BASE64 + 1, 2 * L.TRANCHE_BASE64 + 2]) {
    const entree = pseudo(n);
    const sortie = L.versBase64(entree);
    assert.equal(sortie.length, 4 * Math.ceil(n / 3), 'longueur pour ' + n);
    assert.ok(!sortie.slice(0, -2).includes('='), 'aucun = ailleurs que dans les deux derniers caracteres (' + n + ')');
    assert.ok(Buffer.from(sortie, 'base64').equals(Buffer.from(entree)), 'Buffer relit les memes octets (' + n + ')');
    const binaire = atob(sortie);
    assert.ok(binaire.length === n && entree.every((o, i) => binaire.charCodeAt(i) === o), 'atob relit les memes octets (' + n + ')');
  }
});

test('lirePageHtml : page.image_url (le Recipe RETENU, og:image, pages de liste)', () => {
  const ld = (o) => script(o);
  const lisible = (nom, image) => ({ '@type': 'Recipe', name: nom, recipeIngredient: ['1 pomme'], recipeInstructions: ['Cuire.'], ...(image ? { image } : {}) });
  const urlFinale = 'https://site.test/r/1';
  const deux = ld({ '@type': 'Recipe', name: 'Vide', image: 'https://site.test/a.jpg' }) + ld(lisible('Bonne', 'https://site.test/b.jpg'));
  assert.equal(L.lirePageHtml({ html: deux, urlFinale }).page.image_url, 'https://site.test/b.jpg', 'l image du Recipe RETENU (le premier lisible), jamais du premier trouve');
  const texte = '<main><p>' + 'Texte de recette assez long pour le modele. '.repeat(3) + '</p></main>';
  assert.equal(L.lirePageHtml({ html: '<meta property="og:image" content="/og.jpg">' + texte, urlFinale }).page.image_url, 'https://site.test/og.jpg', 'sans JSON-LD : og:image, relative resolue');
  assert.equal(L.lirePageHtml({ html: texte, urlFinale }).page.image_url, null, 'ni l un ni l autre : null');
  assert.equal(L.lirePageHtml({ html: '<meta property="og:image" content="   ">' + texte, urlFinale }).page.image_url, null, 'ronde 1 : og:image de blancs seuls → null (jamais l adresse de la page elle-meme)');
  assert.equal(L.lirePageHtml({ html: ld(lisible('X', 'https://projet.test/i.jpg')), urlFinale, hotesRefuses: ['projet.test'] }).page.image_url, null, 'hotesRefuses relaye');
  assert.equal(L.lirePageHtml({ html: ld(lisible('X', '/i/x.jpg')), urlFinale }).page.image_url, 'https://site.test/i/x.jpg', 'relative resolue contre urlFinale');
  const liste = L.lirePageHtml({ html: ld(lisible('Un')) + ld(lisible('Deux')) + '<meta property="og:image" content="https://site.test/og.jpg">', urlFinale });
  assert.deepEqual([liste.page.autres_recettes, liste.page.image_url], [1, null], 'deux Recipe lisibles sans image et une og:image : null (page de liste)');
  assert.equal(Object.keys(L.lirePageHtml({ html: texte, urlFinale }).page).at(-1), 'image_url', 'image_url est la derniere cle de page');
});

test('chainage serveur → client : lireOctetsBase64(versBase64(octets), n) rend les memes octets a toute taille ; base64.js sans import', async () => {
  const chemin = path.join(ICI, '..', 'src', 'domain', 'base64.js');
  assert.doesNotMatch(readFileSync(chemin, 'utf8'), /^\s*import\b/m, 'module feuille, sans import (importable par Node)');
  const { lireOctetsBase64 } = await import(pathToFileURL(chemin).href);
  for (const n of [1, 2, 3, 100000, L.TRANCHE_BASE64 + 1, 2 * L.TRANCHE_BASE64 + 2]) {
    const entree = pseudo(n);
    const relus = lireOctetsBase64(L.versBase64(entree), n);
    assert.ok(relus instanceof Uint8Array && relus.length === n && relus.every((o, i) => o === entree[i]), 'n = ' + n);
  }
  const b = L.versBase64(pseudo(100000)); const milieu = Math.floor(b.length / 2);
  assert.equal(lireOctetsBase64(b.slice(0, milieu) + '=' + b.slice(milieu + 1), 100000), null, 'un = au milieu → null');
  assert.equal(lireOctetsBase64(b, 99999), null, 'longueur ≠ 4 × ceil(taille / 3) → null');
  // Ronde 1 : la regle de longueur EXACTE, isolee — sans remplissage, 7 caracteres pour 5 octets passent l alphabet et atob les decode en 5 octets.
  const cinq = L.versBase64(pseudo(5)); const nu = cinq.replace(/=+$/, '');
  assert.deepEqual([cinq.length, nu.length, atob(nu).length], [8, 7, 5], 'fixture : 8 caracteres avec remplissage, 7 sans, decodables en 5 octets');
  assert.equal(lireOctetsBase64(nu, 5), null, 'sans remplissage : seule la regle de longueur exacte la refuse');
  assert.deepEqual([lireOctetsBase64(42, 1), lireOctetsBase64('@@@@', 3), lireOctetsBase64('', 0)?.length], [null, null, 0]);
  assert.equal(lireOctetsBase64('AAA AAAA', 5), null, 'une espace, longueur exacte : atob l ignorerait, seule la regle ALPHABET la refuse');
});
