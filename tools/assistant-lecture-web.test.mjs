// Tests Node du module pur supabase/functions/assistant/lecture-web.js (lot B « Recette web complète », spec § 6.2, § 7.1). Aucun réseau.
// LECTURE_WEB_JS (variable d'environnement) désigne une COPIE du module : c'est ainsi que les mutants de la tâche 1 sont rejoués.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MODULE = process.env.LECTURE_WEB_JS || path.join(ICI, '..', 'supabase', 'functions', 'assistant', 'lecture-web.js');
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
});
test('hoteAdmis : point final et casse', () => {
  assert.equal(L.hoteAdmis('A.TEST.'), true);
  assert.equal(L.hoteAdmis('LOCALHOST'), false);
  assert.equal(L.hoteAdmis('A.Supabase.CO', ['a.supabase.co']), false);
  assert.equal(L.hoteAdmis('a.supabase.co', ['A.SUPABASE.CO.']), false, 'la liste refusée est normalisée elle aussi');
  for (const h of [null, 7, '', '.', '[::1]', '10.0.0.1']) assert.equal(L.hoteAdmis(h), false, String(h));
});
test('typeAdmis', () => {
  for (const t of ['text/html', 'TEXT/HTML; charset=utf-8', 'application/xhtml+xml']) assert.equal(L.typeAdmis(t), true, t);
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
  assert.ok(!source.includes('Object.assign('), 'aucun Object.assign');
  assert.doesNotMatch(source, /for\s*\(\s*(const|let|var)\s+[^)]*\bin\b/, 'aucune boucle for…in');
  assert.doesNotMatch(source, /^\s*import\b/m, 'feuille : aucun import');
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
});
test('dureeIsoEnMinutes', () => {
  assert.deepEqual(['PT1H30M', 'PT45M', 'P0DT1H', 'PT0S', 'PT90S', 'PT', '1h30', null].map(L.dureeIsoEnMinutes), [90, 45, 60, 0, 1, null, null, null]);
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
});
test('lirePageHtml : assemblage', () => {
  const autre = { '@type': 'Recipe', name: 'Autre', recipeIngredient: ['x'] };
  const avec = L.lirePageHtml({ html: '<title>Titre</title>' + script(RICARDO) + script(autre), urlFinale: 'https://www.ricardo.test/r/1', contentType: 'text/html' });
  assert.deepEqual(avec, {
    jsonld: { recette: L.recetteDepuisJsonLd(RICARDO).recette, autres: 1 }, texte: null, texte_coupe: false,
    page: { url_finale: 'https://www.ricardo.test/r/1', hote: 'www.ricardo.test', titre_page: 'Titre', auteur: 'Ricardo', site: null, lue_le: null, autres_recettes: 1, texte_coupe: false },
  });
  const sans = L.lirePageHtml({ html: '<main><p>Une recette racontée.</p></main>', urlFinale: 'https://blogue.test/x' });
  assert.deepEqual([sans.jsonld, sans.texte, sans.page.hote, sans.page.autres_recettes], [null, 'Une recette racontée.', 'blogue.test', 0]);
  const illisible = { '@type': 'Recipe', name: 'Vide', image: 'x' };
  const deux = L.lirePageHtml({ html: script(illisible) + script(RICARDO), urlFinale: 'https://a.test/' });
  assert.deepEqual([deux.jsonld.recette.title, deux.jsonld.autres], ['Pâtes puttanesca', 0], 'B-2 : la première illisible est sautée et non comptée');
  const seule = L.lirePageHtml({ html: script(illisible) + '<main><p>Texte de la recette.</p></main>', urlFinale: 'https://a.test/' });
  assert.deepEqual([seule.jsonld, seule.texte], [null, 'Texte de la recette.'], 'une seule Recipe illisible : le texte');
});
