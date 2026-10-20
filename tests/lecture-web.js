// Tests du lot B « Recette web complète » (spec docs/superpowers/specs/2026-10-19-recette-web-design.md, § 7.4). Bases jetables, fetch factice,
// gestes injectés ; aucun réseau ; aucune écriture dans la bibliothèque de la personne ; jamais le navigateur partagé.
import { t } from '../src/core/i18n.js';

export async function runLectureWebTests({ eq, ok }) {
  const run = async (name, test) => {
    try { await test(); }
    catch (error) { ok(false, `Lecture web — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
  const localeAvant = getUiLocale();
  setUiLocale('fr'); // des textes français sont affirmés ; une suite antérieure a pu basculer l'interface (rendue à la fin)
  try {
    // =================================================================================================================================
    // Tâche 3 — le domaine client (spec § 3.2, § 3.5, § 3.5 bis, § 3.6, § 4.3.4)
    await run('lien', async () => {
      const { adresseNormalisee, doublonDAdresse } = await import('../src/core/lien.js');
      eq(adresseNormalisee('https://A.Test/Recettes/?utm_source=x&b=1#frag'), 'https://a.test/Recettes?b=1', 'adresseNormalisee : hôte en minuscules, chemin gardé en casse, utm_* retiré, autres paramètres gardés, fragment retiré, barre finale retirée');
      eq([adresseNormalisee('https://a.test/'), adresseNormalisee('https://a.test')], ['https://a.test', 'https://a.test'], 'adresseNormalisee : la racine « / » et l’adresse nue sont la même');
      eq([adresseNormalisee('https://a.test/r?fbclid=1&gclid=2'), adresseNormalisee('https://a.test/r?UTM_Campaign=&x=1')], ['https://a.test/r', 'https://a.test/r?x=1'], 'adresseNormalisee : fbclid, gclid et UTM_* (casse libre) retirés');
      eq([adresseNormalisee('https://u:p@a.test/x'), adresseNormalisee('https://a.test:8443/'), adresseNormalisee('http://a.test/x/')], ['https://a.test/x', 'https://a.test:8443', 'http://a.test/x'], 'adresseNormalisee : identifiants retirés, port explicite gardé, http admis');
      eq([adresseNormalisee('javascript:x'), adresseNormalisee(''), adresseNormalisee(null)], [null, null, null], 'adresseNormalisee : autre chose qu’une adresse http(s) → null');
      eq([adresseNormalisee('https://a.test/r?a=b%20c&utm_x=1'), adresseNormalisee('https://a.test/r?flag&utm_x=1'), adresseNormalisee('https://a.test/r?u%74m_x=1&a=1'), adresseNormalisee('https://a.test/r?a=1&&b=2&')], ['https://a.test/r?a=b%20c', 'https://a.test/r?flag', 'https://a.test/r?a=1', 'https://a.test/r?a=1&b=2'], 'adresseNormalisee (ronde 1) : la requête est filtrée telle quelle, jamais resérialisée (« %20 » reste, « ?flag » ne devient pas « ?flag= ») ; une clé encodée est lue décodée ; une paire vide tombe');
      const fiches = [{ id: 'sans' }, { id: 'hostile', source_url: 'pas une adresse' }, { id: 'vide', source_url: '' }, { id: 'rc_1', source_url: 'https://a.test/r/?utm_medium=y' }, { id: 'rc_2', source_url: 'https://a.test/r' }];
      eq(doublonDAdresse(fiches, 'https://A.test/r#haut')?.id, 'rc_1', 'doublonDAdresse : la première fiche à la même adresse normalisée');
      eq([doublonDAdresse(fiches, 'https://a.test/autre'), doublonDAdresse(fiches, 'pas une adresse'), doublonDAdresse(null, 'https://a.test/r')], [null, null, null], 'doublonDAdresse : null sans doublon, pour une adresse illisible ou sans liste ; une fiche sans source_url ou à adresse hostile est ignorée');
    });

    await run('page', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const { page } = W.lirePage({ page: { url_finale: 'https://www.ricardo.test/r/1', hote: 'evil.test', titre_page: 't'.repeat(1000), auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 2, texte_coupe: true } });
      eq(page, { url_finale: 'https://www.ricardo.test/r/1', hote: 'www.ricardo.test', titre_page: 't'.repeat(300), auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 2, texte_coupe: true }, 'lirePage : hôte RECALCULÉ (jamais celui du serveur, evil.test), titre borné à 300');
      const hostile = W.lirePage({ page: { url_finale: 'pas une adresse', lue_le: 'hier', autres_recettes: '2', texte_coupe: 'oui', titre_page: 7 }, stop_reason: 'x'.repeat(100), model: { m: 1 } });
      eq(hostile, { page: { url_finale: null, hote: null, titre_page: null, auteur: null, site: null, lue_le: null, autres_recettes: 0, texte_coupe: false }, stopReason: 'x'.repeat(40), modele: null }, 'lirePage : url_finale non URL → null, lue_le illisible → null, autres_recettes « 2 » → 0, texte_coupe « oui » → false, stop_reason borné à 40, model non chaîne → null');
      eq([W.lirePage({ page: { auteur: 'A' + String.fromCodePoint(0x202e, 0x200b) + 'b' } }).page.auteur, W.lirePage({ page: { site: 'R' + String.fromCodePoint(0x202e) + 'icardo' + String.fromCodePoint(0x200b) } }).page.site], ['Ab', 'Ricardo'], 'lirePage (S-1) : Cc / Cf retirés de l’auteur et du site');
      const u2048 = 'https://a.test/' + 'x'.repeat(2048 - 15);
      const [p2048, p2049] = [u2048, u2048 + 'y'].map((u) => W.lirePage({ page: { url_finale: u } }).page);
      eq([Array.from(u2048).length, p2048.url_finale === u2048, p2048.hote, p2049.url_finale, p2049.hote], [2048, true, 'a.test', null, null], 'lirePage : url_finale de 2 048 points de code gardée ; 2 049 → null, hôte null (jamais tronquée : une adresse coupée désignerait une autre page)');
      const longueur = (s) => (typeof s === 'string' ? Array.from(s).length : s);
      const champ = (k, v) => W.lirePage({ page: { [k]: v } }).page[k];
      eq([champ('auteur', 'b'.repeat(200)), champ('auteur', 'b'.repeat(201)), champ('site', 'c'.repeat(200)), champ('site', 'c'.repeat(201)), W.lirePage({ model: 'm'.repeat(80) }).modele, W.lirePage({ model: 'm'.repeat(81) }).modele, W.lirePage({ stop_reason: 's'.repeat(41) }).stopReason].map(longueur), [200, 200, 200, 200, 80, 80, 40], 'lirePage : bornes du tableau § 3.5 — auteur et site 200, model 80 (LIMITES_PASSERELLE.modele), stop_reason 40 : la borne gardée, borne + 1 coupée à la borne');
      eq([['1', '2026-10-19', '2026-10-19T12:00:00Z', '2026-13-45T12:00:00.000Z', 'Mon, 19 Oct 2026 12:00:00 GMT'].map((d) => champ('lue_le', d)), [1e300, -1, 150, 2.5].map((a) => champ('autres_recettes', a))], [[null, null, '2026-10-19T12:00:00Z', null, null], [0, 0, 150, 0]], 'lirePage (ronde 1) : lue_le admise en ISO 8601 UTC seulement (« 1 », une date seule, une date impossible, la forme RFC → null : Date.parse les lit selon le moteur) ; autres_recettes entier sûr ≥ 0 (1e300 → 0)');
      const menteur = W.lirePage({ page: { url_finale: 'https://evil.test/', site: 'ricardocuisine.com', auteur: 'voir evil.com' } }).page;
      eq([menteur.site, menteur.auteur, menteur.hote], [null, null, 'evil.test'], 'lirePage (S-2) : un site ou un auteur qui porte une adresse → null ; l’hôte reste celui de l’adresse réelle');
      eq([W.lirePage(null).page.url_finale, W.lirePage({ page: [] }).page.autres_recettes], [null, 0], 'lirePage : une forme hostile ne lève pas');
      const source = await lire('../src/domain/lecture-web.js');
      const corps = source.slice(source.indexOf('export function lirePage('), source.indexOf('\n}\n', source.indexOf('export function lirePage('))).replace(/\/\/.*$/gm, ''); // ronde 1 : hors commentaires
      eq(['url_finale', 'titre_page', 'auteur', 'site', 'lue_le'].map((k) => corps.includes(`borner(propre(p, '${k}')`)).concat(['stop_reason', 'model'].map((k) => corps.includes(`borner(propre(corps, '${k}')`))), [true, true, true, true, true, true, true], 'lirePage (S-1, test de source) : chacune des sept lectures passe par borner(');
    });

    await run('lecture', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const R = await import('../src/domain/recherche-web.js');
      const { BORNES_EXTRACTION, ErreurExtraction } = await import('../src/domain/llm.js');
      const PAGE = { url_finale: 'https://a.test/r', hote: 'a.test', titre_page: 'T', auteur: null, site: null, lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 0, texte_coupe: false };
      const RECETTE = { title: 'Pâtes puttanesca', servings: 4, prep_minutes: 20, cook_minutes: 60, total_minutes: 80, ingredients: [{ source_text: '250 g de spaghettis', uncertain: false }, { source_text: '2 gousses d’ail', uncertain: true }], steps: [{ text: 'Cuire.' }, { text: 'Mélanger.\nServir.' }], printed_page: 12, sub_recipes: [], uncertain_fields: [], notes: null, incomplete: false, missing_page: true };
      const refus = (corps) => { try { W.lireLecture(corps); return 'lu'; } catch (e) { return e instanceof ErreurExtraction ? e.raison : 'autre:' + e?.message; } };
      const jsonld = W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: RECETTE, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null });
      eq([jsonld.source_kind, jsonld.recette.title, jsonld.recette.ingredients.length, jsonld.recette.steps[1].text, jsonld.recette.total_minutes, jsonld.usage], ['jsonld', 'Pâtes puttanesca', 2, 'Mélanger.\nServir.', 80, { input_tokens: 0, output_tokens: 0 }], 'lireLecture : jsonld objet → recette validée, étape multi-ligne intacte, total_minutes lu (B-8)');
      eq([jsonld.recette.printed_page, jsonld.recette.missing_page], [null, false], 'lireLecture : printed_page et missing_page forcés à null / false (rien d’une page web n’est une page de livre)');
      eq(JSON.parse(jsonld.texteBrut).title, 'Pâtes puttanesca', 'lireLecture : la réponse brute d’un JSON-LD est la recette reçue, en JSON');
      const modele = W.lireLecture({ source_kind: 'modele', page: PAGE, recette: 'Voici :\n' + JSON.stringify({ ...RECETTE, total_minutes: 80 }) + '\nBon appétit.', stop_reason: 'end_turn', model: 'claude-x' });
      eq([modele.source_kind, modele.recette.title, modele.recette.total_minutes, modele.modele, modele.stopReason], ['modele', 'Pâtes puttanesca', null, 'claude-x', 'end_turn'], 'lireLecture : modele texte → parseJsonLoose → recette ; total_minutes null par le modèle (§ 3.3, B-8 : la consigne ne le demande pas — aucune durée inventée)');
      eq(W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: RECETTE, usage: { input_tokens: '5', output_tokens: -1 } }).usage, { input_tokens: null, output_tokens: null }, 'lireLecture : un usage hostile (« 5 » en texte, −1) → null, null');
      { let e = null; try { W.lireLecture({ source_kind: 'modele', page: PAGE, recette: 'y'.repeat(20000), stop_reason: 'max_tokens' }); } catch (x) { e = x; }
        eq([e?.raison, Array.from(e?.texteBrut ?? '').length], ['coupe', 16000], 'lireLecture : la réponse brute portée par un refus est coupée à REPONSE_BRUTE_MAX (16 000 points de code)'); }
      eq([refus({ source_kind: 'modele', page: PAGE, recette: '{}', stop_reason: 'max_tokens' }), refus({ source_kind: 'modele', page: PAGE, recette: 'pas de JSON ici' }), refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, title: 'x'.repeat(201) } }), refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, ingredients: [], steps: [] } }), refus({ source_kind: 'autre', page: PAGE, recette: RECETTE }), refus({ source_kind: 'modele', page: PAGE, recette: RECETTE })],
        ['coupe', 'illisible', 'hors_bornes', 'vide', 'illisible', 'illisible'], 'lireLecture : max_tokens → coupe ; prose sans JSON → illisible ; titre de 201 → hors_bornes ; zéro ligne et zéro étape → vide ; source_kind « autre » → illisible ; modele non texte → illisible');
      { let e = null; try { W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, ingredients: Array.from({ length: 81 }, (_, i) => ({ source_text: 'l' + i })) } }); } catch (x) { e = x; }
        eq([e?.raison, e?.sourceKind, typeof e?.texteBrut], ['hors_bornes', 'jsonld', 'string'], 'lireLecture : un refus porte la nature de la source (deux textes pour hors_bornes, F-16) et la réponse brute'); }
      eq([80, '80', 2000, -1, 1.5, 0, 1440, 1441].map((tm) => W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, total_minutes: tm } }).recette.total_minutes), [80, null, null, null, null, 0, 1440, null], 'lireLecture : total_minutes entier 0..1440 (bornes comprises), sinon null');
      const COUPE = 'La page était longue : la fin n’a pas été lue.';
      const coupee = W.lireLecture({ source_kind: 'modele', page: { ...PAGE, texte_coupe: true }, recette: JSON.stringify(RECETTE) });
      ok(coupee.recette.uncertain_fields.includes(COUPE), 'lireLecture : texte_coupe → uncertain_fields contient « La page était longue : la fin n’a pas été lue. » (B-9)');
      const pleine = W.lireLecture({ source_kind: 'modele', page: { ...PAGE, texte_coupe: true }, recette: JSON.stringify({ ...RECETTE, uncertain_fields: Array.from({ length: 40 }, (_, i) => 'champ ' + i) }) });
      eq(pleine.recette.uncertain_fields.length, 40, 'lireLecture : 40 entrées du modèle → l’entrée de la coupe est écartée (le plafond vaut aussi pour elle)');
      eq(W.relireResultat({ source_kind: 'modele', page: { ...PAGE, texte_coupe: true }, recette: pleine.recette })?.recette.uncertain_fields.length, 40, 'relireResultat : une lecture stockée au plafond se relit sans refus, toujours 40 entrées');
      const coupee3 = W.lireLecture({ source_kind: 'jsonld', page: { ...PAGE, texte_coupe: true }, recette: { ...RECETTE, uncertain_fields: ['quantité illisible'] } });
      eq([coupee3.recette.uncertain_fields, W.relireResultat({ source_kind: 'jsonld', page: coupee3.page, recette: coupee3.recette })?.recette.uncertain_fields], [['quantité illisible', COUPE], ['quantité illisible', COUPE]], 'relireResultat : une lecture coupée relue SOUS le plafond porte exactement une entrée de coupe (jamais ajoutée deux fois)');
      // Revalidation d'un résultat relu du journal (I-B2, I-1 du lot A) : la page est RELUE, la recette REVALIDÉE — jamais rendue telle que stockée.
      const stocke = { source_kind: 'jsonld', page: { ...PAGE, hote: 'evil.test', auteur: 'voir evil.com', site: 'S' + String.fromCodePoint(0x202e) + 'ite' }, recette: { ...RECETTE, uncertain_fields: [], steps: [{ text: 'Cuire' + String.fromCodePoint(0x200b) + '.' }, { text: 'voir https://evil.test/x' }] } };
      const relu = W.relireResultat(stocke);
      eq([relu?.page.hote, relu?.page.auteur, relu?.page.site, relu?.recette.steps.map((s) => s.text), relu?.recette.uncertain_fields, relu?.recette.total_minutes, W.relireResultat({ ...stocke, source_kind: 'modele' })?.recette.total_minutes], ['a.test', null, 'Site', ['Cuire.', 'voir [adresse retirée]'], ['adresse retirée dans l’étape 2'], 80, null], 'relireResultat : page RELUE (hôte recalculé, jamais evil.test ; auteur à adresse → null ; Cc/Cf retirés) et recette REVALIDÉE (Cc/Cf retirés, adresse d’une étape → marqueur et entrée ; total_minutes gardé pour un JSON-LD, null pour le modèle)');
      eq([{ ...stocke, source_kind: 'autre' }, { ...stocke, recette: { ...RECETTE, title: 'x'.repeat(201) } }, { ...stocke, recette: { ...RECETTE, title: 'voir https://evil.test' } }, { ...stocke, recette: JSON.stringify(RECETTE) }, { ...stocke, recette: { ...RECETTE, ingredients: [], steps: [] } }].map((r) => W.relireResultat(r)), [null, null, null, null, null], 'relireResultat : illisible → null — source_kind « autre », titre de 201, titre à adresse, recette en texte (jamais la sortie brute), recette vide');

      // R-B-2 / § 3.5 bis : une adresse dans le TITRE refuse (lien) ; ailleurs elle est RETIRÉE et dite, la lecture est ADMISE.
      const lu = (champs) => W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, uncertain_fields: [], ...champs } }).recette;
      eq(refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, title: 'voir https://evil.test' } }), 'lien', 'adresses : titre « voir https://evil.test » → lien (le seul refus)');
      const ligne = lu({ ingredients: [{ source_text: 'voir https://evil.test/x', uncertain: false }, { source_text: '1 oignon', uncertain: false }, { source_text: '2 gousses d’ail', uncertain: true }] });
      eq([ligne.ingredients.map((i) => [i.source_text, i.uncertain]), ligne.uncertain_fields], [[['voir [adresse retirée]', true], ['1 oignon', false], ['2 gousses d’ail', true]], ['adresse retirée dans la ligne 1']], 'adresses : une ligne → fragment remplacé, ligne incertaine, une entrée « adresse retirée dans la ligne 1 » ; une ligne sans adresse garde son uncertain tel que lu (faux comme vrai) ; lecture ADMISE (mutant « lecture refusée pour une adresse dans une ligne » : rouge)');
      const etape = lu({ steps: [{ text: 'voir www.evil.test' }, { text: 'Servir (recette sur blog.ricardocuisine.com/x).' }, { text: 'a https://a.test/1 et https://b.test/2 fin' }] });
      eq([etape.steps.map((s) => s.text), etape.uncertain_fields], [['voir [adresse retirée]', 'Servir (recette sur [adresse retirée]).', 'a [adresse retirée] et [adresse retirée] fin'], ['adresse retirée dans l’étape 1', 'adresse retirée dans l’étape 2', 'adresse retirée dans l’étape 3']], 'adresses : étapes — www., sous-domaine (le fragment s’arrête à la parenthèse ; elle et le point qui la suit restent), deux adresses → deux marqueurs et UNE entrée (mutant « adresse gardée dans une étape » : rouge)');
      const ponctuation = lu({ ingredients: [{ source_text: '1 oignon (voir https://a.test/o!)', uncertain: false }], steps: [{ text: 'Voir https://a.test/x. Puis servir.' }, { text: 'Lire www.a.test/y, puis cuire ; voir https://b.test/z?' }] });
      eq([ponctuation.ingredients[0].source_text, ponctuation.steps.map((s) => s.text)], ['1 oignon (voir [adresse retirée]!)', ['Voir [adresse retirée]. Puis servir.', 'Lire [adresse retirée], puis cuire ; voir [adresse retirée]?']], 'adresses (§ 3.5 bis) : la ponctuation de fin de phrase qui TERMINE le fragment (. , ! ?) reste au texte, après le marqueur');
      const PLEINE = String.fromCodePoint(0xff0e); // « ． » point pleine chasse
      const mixte = lu({ uncertain_fields: ['adresse retirée dans l’étape 1'], steps: [{ text: 'voir www' + PLEINE + 'evil' + PLEINE + 'test et www.a.test' }] });
      eq([mixte.steps[0].text, R.MOTIF_ADRESSE.test(R.normaliserPourAdresse(mixte.steps[0].text)), mixte.uncertain_fields], ['[adresse retirée]', false, ['adresse retirée dans l’étape 1']], 'adresses (ronde 1) : une adresse pleine chasse À CÔTÉ d’une adresse isolable → le champ entier devient le marqueur (aucune adresse ne reste, même en NFKC) ; une entrée déjà présente n’est jamais ajoutée deux fois');
      const trois = ['voir ' + String.fromCodePoint(0xff57, 0xff57, 0xff57) + '.evil.test et https://b.test/', 'https://a.test/x et www' + PLEINE + 'evil' + PLEINE + 'test', 'https://a.test/x puis evil.test' + String.fromCodePoint(0x2215) + 'y'];
      const lus3 = trois.map((text) => W.lireLecture({ source_kind: 'jsonld', page: { ...PAGE, texte_coupe: true }, recette: { ...RECETTE, uncertain_fields: [], steps: [{ text }] } }));
      eq([lus3.map((l) => l.recette.steps[0].text), lus3.map((l) => { const s = { source_kind: l.source_kind, page: l.page, recette: l.recette }; return JSON.stringify(W.relireResultat(s)) === JSON.stringify(s); })], [['[adresse retirée]', '[adresse retirée]', '[adresse retirée]'], [true, true, true]], 'adresses (ronde 1) : ｗｗｗ pleine chasse, points U+FF0E, barre U+2215 à côté d’une adresse isolable → champ entier = marqueur ; lireLecture → relireResultat est IDEMPOTENT (même texte, aucune entrée doublée : l’objet stocké est celui qu’« Enregistrer » écrira)');
      const notes = lu({ notes: 'Recette tirée de https://a.test/x' });
      eq([notes.notes, notes.uncertain_fields], ['Recette tirée de [adresse retirée]', ['adresse retirée dans les notes']], 'adresses : notes → fragment remplacé, entrée « adresse retirée dans les notes », lecture ADMISE');
      const pleineChasse = lu({ steps: [{ text: 'voir www' + String.fromCodePoint(0xff0e) + 'evil' + String.fromCodePoint(0xff0e) + 'test' }] });
      eq(pleineChasse.steps[0].text, '[adresse retirée]', 'adresses : points pleine chasse (détectés en NFKC, non isolables) → le texte entier devient le marqueur');
      eq(refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, ingredients: [{ source_text: 'x'.repeat(295) + 'www.a' }] } }), 'hors_bornes', 'adresses : une ligne de 300 qui finit par www.a → le marqueur (17) déborde → hors_bornes, jamais tronquée');
      eq([refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, steps: [{ text: 'x'.repeat(1995) + 'www.a' }] } }), refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, notes: 'x'.repeat(1995) + 'www.a' } })], ['hors_bornes', 'hors_bornes'], 'adresses : une étape et des notes de 2 000 qui finissent par www.a → hors_bornes après remplacement, jamais tronquées');
      eq(lu({ steps: Array.from({ length: 41 }, (_, i) => ({ text: `Étape ${i} : voir https://e${i}.test/x` })) }).uncertain_fields.length, BORNES_EXTRACTION.champsIncertains, 'adresses : 41 étapes à adresse → 40 entrées au plus');
      eq(lu({ uncertain_fields: ['voir evil.com', 'quantité illisible'] }).uncertain_fields, ['quantité illisible'], 'adresses (S-7) : une entrée d’uncertain_fields qui porte une adresse est écartée, sans refuser');
      eq(lu({ steps: [{ text: 'Couper en dés de 2.5 cm.' }, { text: 'Four à 180°C/350°F, env. 10 min.' }, { text: 'Comme sur ricardocuisine.com, saler.' }] }).steps.map((s) => s.text), ['Couper en dés de 2.5 cm.', 'Four à 180°C/350°F, env. 10 min.', 'Comme sur ricardocuisine.com, saler.'], 'adresses : « 2.5 cm », « 180°C/350°F », « env. 10 min » passent ; MOTIF_HOTE jamais appliqué au contenu (un hôte nu passe)');
      eq(lu({ title: 'Poulet façon ricardocuisine.com' }).title, 'Poulet façon ricardocuisine.com', 'adresses : un hôte nu dans le TITRE passe (MOTIF_HOTE jamais appliqué au titre, § 3.5 bis)');
      eq(t('[adresse retirée]').length, 17, 'adresses : le marqueur fait 17 points de code');
      eq(W.retirerAdresses({ title: 'T', ingredients: [{ source_text: '1 oignon', uncertain: false }, { source_text: 'voir https://a.test/l', uncertain: false }], steps: [{ text: 'Cuire.' }, { text: 'https://a.test/x' }], notes: 'Voir www.a.test', uncertain_fields: [] }).retraits, [{ champ: 'ligne', position: 2 }, { champ: 'etape', position: 2 }, { champ: 'notes', position: 1 }], 'retirerAdresses : rend les retraits (champ, position 1-based) — ligne, étape et notes');
      // Borne temporelle (ronde 1, R-B-15 : un rouge sur une machine chargée se rejoue) : la détection (MOTIF_ADRESSE) et le fragment (MOTIF_FRAGMENT_ADRESSE)
      // sont LINÉAIRES — avant la ronde, une longue suite de [a-z0-9-] sans point, ou « a.a.a… » derrière « www. », coûtaient un temps quadratique.
      const ms = (() => {
        const t0 = performance.now();
        for (let i = 0; i < 2; i += 1) {
          W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, ingredients: Array.from({ length: 80 }, () => ({ source_text: 'a'.repeat(300) })), steps: Array.from({ length: 60 }, () => ({ text: 'a'.repeat(2000) })), notes: 'a'.repeat(2000) } });
          W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, steps: Array.from({ length: 60 }, () => ({ text: 'www. ' + 'a.'.repeat(987) })) } });
        }
        return performance.now() - t0;
      })();
      ok(ms < 200, `adresses (ronde 1, borne temporelle) : des lectures hostiles admises par les bornes (60 étapes de 2 000 « a » ; 60 étapes « www. a.a.a… » ; deux fois chacune) se lisent en moins de 200 ms (${Math.round(ms)} ms)`);
    });

    await run('appel', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const SESSION = { access_token: 'jeton-lecture-sentinelle', user: { id: 'u1' } };
      const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
      const PAGE = { url_finale: 'https://a.test/r', hote: 'a.test', titre_page: 'T', auteur: null, site: null, lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 0, texte_coupe: false };
      const appels = [];
      const f = (statut, corps) => async (url, options) => { appels.push({ url, options }); return reponse(statut, corps); };
      const ok200 = { source_kind: 'jsonld', page: PAGE, recette: { title: 'T', ingredients: [{ source_text: 'a' }], steps: [{ text: 'b' }] }, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null };
      const r = await W.lireRecetteWeb({ url: 'https://a.test/r', session: SESSION }, { fetch: f(200, ok200), config: SUPABASE.prod });
      eq([appels.length, JSON.parse(appels[0].options.body), Object.keys(appels[0].options.headers).sort(), appels[0].options.redirect], [1, { outil: 'lecture-web', corps: { url: 'https://a.test/r' } }, ['apikey', 'authorization', 'content-type'], 'error'], 'lireRecetteWeb : UN POST { outil: lecture-web, corps: { url } } exact, trois en-têtes, redirect error');
      eq([r.etat, r.resultat.source_kind, r.resultat.recette.title, JSON.stringify(r).includes('jeton-lecture-sentinelle')], ['lue', 'jsonld', 'T', false], 'lireRecetteWeb : lue, résultat relu ; le jeton n’est dans aucun résultat');
      eq([r.resultat.page, r.reponseBrute, r.modele], [PAGE, JSON.stringify(ok200.recette), null], 'lireRecetteWeb : le succès porte la page RELUE (celle que le journal et la fiche diront), la réponse brute (la recette reçue, en JSON) et le modèle (null pour un JSON-LD)');
      const parModele = await W.lireRecetteWeb({ url: 'https://a.test/r', session: SESSION }, { fetch: f(200, { ...ok200, source_kind: 'modele', recette: JSON.stringify(ok200.recette), stop_reason: 'end_turn', model: 'claude-x' }), config: SUPABASE.prod });
      eq([parModele.etat, parModele.resultat.source_kind, parModele.modele, parModele.reponseBrute], ['lue', 'modele', 'claude-x', JSON.stringify(ok200.recette)], 'lireRecetteWeb (modele) : le modèle de la réponse et le texte reçu tel quel');
      const longue = await W.lireRecetteWeb({ url: 'https://a.test/r', session: SESSION }, { fetch: f(200, { ...ok200, source_kind: 'modele', recette: 'y'.repeat(20000), stop_reason: 'max_tokens' }), config: SUPABASE.prod });
      eq([longue.etat, longue.raison, Array.from(longue.reponseBrute ?? '').length], ['echec', 'coupe', 16000], 'lireRecetteWeb : la réponse brute d’un refus est coupée à 16 000 points de code (REPONSE_BRUTE_MAX) avant d’être rendue au journal');
      { // tentativeMs RELAYÉ à la passerelle : un fetch sourd n'est abandonné qu'au délai donné ; la course à 2 s dit un délai ignoré, le signal libère le fetch.
        const sourd = (url, o) => new Promise((_, rejeter) => o.signal.addEventListener('abort', () => rejeter(new DOMException('abandon', 'AbortError')), { once: true }));
        const liberer = new AbortController();
        try {
          const d = await Promise.race([W.lireRecetteWeb({ url: 'https://a.test/r', session: SESSION }, { fetch: sourd, config: SUPABASE.prod, tentativeMs: 30, signal: liberer.signal }), new Promise((rendre) => setTimeout(() => rendre({ raison: 'tentativeMs ignoré' }), 2000))]);
          eq(d.raison, 'delai', 'lireRecetteWeb : tentativeMs relayé à la passerelle (un fetch sourd abandonné après 30 ms → delai)');
        } finally { liberer.abort(); }
      }
      appels.length = 0;
      eq([(await W.lireRecetteWeb({ url: 'https://a.test/r', session: null }, { fetch: f(200, ok200), config: SUPABASE.prod })).raison, appels.length], ['non_connecte', 0], 'lireRecetteWeb : sans session → non_connecte, zéro fetch');
      const ctl = new AbortController(); ctl.abort();
      eq((await W.lireRecetteWeb({ url: 'https://a.test/r', session: SESSION }, { fetch: f(200, ok200), config: SUPABASE.prod, signal: ctl.signal })).raison, 'annule', 'lireRecetteWeb : signal levé → annule');
      const table = [[422, { erreur: 'interdit' }, 'interdit', {}], [502, { erreur: 'inaccessible' }, 'inaccessible', {}], [422, { erreur: 'pas_une_page' }, 'pas_une_page', {}], [413, { erreur: 'trop_lourde' }, 'page_trop_lourde', {}], [422, { erreur: 'vide' }, 'page_vide', {}],
        [429, { erreur: 'quota', quota: 60 }, 'quota', { quota: 60 }], [429, { type: 'error' }, 'trop_de_demandes', {}], [413, { erreur: 'trop_lourd' }, 'requete', { trop_lourd: true }], [504, { erreur: 'delai' }, 'delai', {}]];
      const obtenus = [];
      for (const [statut, corps] of table) { const x = await W.lireRecetteWeb({ url: 'https://a.test/r', session: SESSION }, { fetch: f(statut, corps), config: SUPABASE.prod }); obtenus.push([x.etat, x.raison, x.extra]); }
      eq(obtenus, table.map(([, , raison, extra]) => ['echec', raison, extra]), 'table serveur → client (D-B14) : interdit, inaccessible, pas_une_page, trop_lourde → page_trop_lourde, vide → page_vide, quota 60, 429 sans champ → trop_de_demandes, trop_lourd → requete + trop_lourd, delai');
      const coupe = await W.lireRecetteWeb({ url: 'https://a.test/r', session: SESSION }, { fetch: f(200, { ...ok200, source_kind: 'modele', recette: '{"title"', stop_reason: 'max_tokens' }), config: SUPABASE.prod });
      eq([coupe.etat, coupe.raison, coupe.extra, coupe.reponseBrute], ['echec', 'coupe', { source_kind: 'modele' }, '{"title"'], 'lireRecetteWeb : un refus de lecture garde la réponse brute (diagnostic) et la nature de la source');
    });

    await run('fabricants', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const V = await import('../src/domain/vocabulaire.js');
      const { LIMITES_SIGNET } = await import('../src/ui/signet.js');
      const { BORNES_EXTRACTION } = await import('../src/domain/llm.js');
      const { buildIngredientIndex } = await import('../src/domain/lines.js');
      const { INGREDIENTS } = await import('../src/model/seed.js');
      buildIngredientIndex(INGREDIENTS); // l'index des lignes est global (lines.js:6) : posé ici, comme tests/creer-ia.js:10
      eq(W.TITRE_FICHE_MAX, LIMITES_SIGNET.titre, 'TITRE_FICHE_MAX = LIMITES_SIGNET.titre (le domaine n’importe pas la vue)');
      eq([BORNES_EXTRACTION.titre, BORNES_EXTRACTION.ligne, BORNES_EXTRACTION.etape, BORNES_EXTRACTION.notes, BORNES_EXTRACTION.lignes, BORNES_EXTRACTION.etapes], [200, 300, 2000, 2000, 80, 60], 'BORNES_EXTRACTION vaut 200 / 300 / 2000 / 2000 / 80 / 60 (le miroir de LIMITES_LECTURE du serveur)');
      const SIGNET = { id: 'rc_s', edition_id: 'ed1', original_title: 'ricardocuisine.com', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null, tags: [], cuisines: ['italienne'], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: 'https://ricardocuisine.com/r/1', source_label: 'ricardocuisine.com', web_reperes: { presentation: 'Un classique.', temps_min: 30, difficulte: 'facile', ingredients: 7 } };
      const PAGE = { url_finale: 'https://www.ricardocuisine.com/r/1', hote: 'www.ricardocuisine.com', titre_page: 'P', auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 0, texte_coupe: false };
      const RECETTE = { title: 'Pâtes puttanesca', servings: 4, prep_minutes: 20, cook_minutes: 60, total_minutes: 80, ingredients: [{ source_text: '250 g de spaghettis', uncertain: false }, { source_text: '2 gousses d’ail', uncertain: true }], steps: [{ text: 'Cuire 10 minutes.' }, { text: 'Mélanger.\nServir.' }], printed_page: null, sub_recipes: [], uncertain_fields: [], notes: 'Classique.', incomplete: false, missing_page: false };
      const { recipe, version, remplacement } = W.fabriquerLectureWeb(RECETTE, { signet: SIGNET, versions: [], page: PAGE, sourceKind: 'jsonld', importId: 'imp_1', modele: null, maintenant: '2026-10-19T12:00:01.000Z' });
      eq({ ...recipe, current_version_id: recipe.current_version_id === version.id }, { ...SIGNET, original_title: 'Pâtes puttanesca', availability: 'available', verification_state: 'to_verify', current_version_id: true, printed_page: null, ingredient_ids: ['ing_wheat_pasta', 'ing_garlic'], source_author: 'Ricardo', source_site: 'Ricardo Cuisine', source_fetched_at: '2026-10-19T12:00:00.000Z', source_kind: 'jsonld' }, 'fabriquerLectureWeb : la fiche est le signet (id, source_url, source_label, edition_id, cuisines, web_reperes intacts) recomposé — titre lu (première lecture), available, to_verify, courante, source_*, ingredient_ids = l’union des identités proposées (recherche par ingrédient, § 4.3.4)');
      eq(version.provenance, { source_url: 'https://ricardocuisine.com/r/1', url_finale: 'https://www.ricardocuisine.com/r/1', source_kind: 'jsonld', lue_le: '2026-10-19T12:00:00.000Z', lu_le: '2026-10-19T12:00:00.000Z', model: null, generated_by: 'ai', auteur: 'Ricardo', site: 'Ricardo Cuisine', import_id: 'imp_1', incomplete: false, missing_page: false, titre_lu: 'Pâtes puttanesca', titre_signet: 'ricardocuisine.com', source_page_ids: [], source_document_id: null, edition_id: 'ed1', convention_snapshot: null, uncertain_fields: [] }, 'fabriquerLectureWeb : provenance exacte (§ 3.3, amendée à la ronde 1) — source_url du signet, url_finale de la page, auteur et site de CE jour (B-25), titre_signet (D-B24) ; lu_le (la date que lit la bannière du lot A) et uncertain_fields (VF-10 du lot A)');
      eq([version.kind, version.recipe_id, version.parent_version_id, version.constraints, version.changes, version.servings, version.prep_minutes, version.cook_minutes, version.total_minutes, version.notes, version.verification_state, version.created_at], ['extraction', 'rc_s', null, {}, '', 4, 20, 60, 80, 'Classique.', 'to_verify', '2026-10-19T12:00:01.000Z'], 'fabriquerLectureWeb : version extraction, constraints {} et changes \'\' (F-13), portions et durées recopiées, total_minutes (B-8)');
      const incomplete = W.fabriquerLectureWeb({ ...RECETTE, incomplete: true, uncertain_fields: ['quantité illisible', 'adresse retirée dans la ligne 1'] }, { signet: SIGNET, page: { ...PAGE, lue_le: null }, sourceKind: 'modele', modele: 'claude-x' });
      eq([incomplete.version.provenance.incomplete, incomplete.version.provenance.model, incomplete.version.provenance.uncertain_fields, incomplete.version.provenance.lu_le, incomplete.recipe.availability], [true, 'claude-x', ['quantité illisible', 'adresse retirée dans la ligne 1'], null, 'partial'], 'fabriquerLectureWeb : provenance.incomplete et model posés ; uncertain_fields gardés dans la version (VF-10 : « Incertain » survit à la purge à 30 jours du journal) ; lu_le null sans date lisible (jamais la date de l’enregistrement)');
      eq(version.ingredients.map((l) => [l.source_text, l.uncertain, l.verification_state]), [['250 g de spaghettis', false, 'to_verify'], ['2 gousses d’ail', true, 'to_verify']], 'fabriquerLectureWeb : lignes à vérifier, uncertain recopié');
      eq([version.steps.map((s) => [s.position, s.text]), version.steps[0].timers?.[0]?.seconds], [[[1, 'Cuire 10 minutes.'], [2, 'Mélanger.\nServir.']], 600], 'fabriquerLectureWeb : étapes multi-lignes intactes, detectTimers posé');
      eq([W.fabriquerLectureWeb({ ...RECETTE, incomplete: true }, { signet: SIGNET, page: PAGE, sourceKind: 'modele' }).recipe.availability, W.fabriquerLectureWeb({ ...RECETTE, steps: [] }, { signet: SIGNET, page: PAGE, sourceKind: 'modele' }).recipe.availability, W.fabriquerLectureWeb({ ...RECETTE, ingredients: [] }, { signet: SIGNET, page: PAGE, sourceKind: 'modele' }).recipe.availability], ['partial', 'partial', 'partial'], 'fabriquerLectureWeb : partial si incomplete, sans étape ou sans ligne');
      const adresse = W.fabriquerLectureWeb({ ...RECETTE, title: 'voir https://evil.test' }, { signet: SIGNET, page: PAGE, sourceKind: 'jsonld' });
      eq([adresse.recipe.original_title, adresse.version.provenance.titre_lu, adresse.version.provenance.titre_signet], ['ricardocuisine.com', null, null], 'fabriquerLectureWeb (défense en profondeur) : un titre à adresse reçu directement n’est jamais posé — titre du signet gardé, titre_lu null');
      const avant = { id: 'rv_0', recipe_id: 'rc_s', kind: 'extraction', provenance: { generated_by: 'ai' }, verification_state: 'to_verify' };
      const relu = W.fabriquerLectureWeb(RECETTE, { signet: { ...SIGNET, original_title: 'Mes pâtes', current_version_id: 'rv_0' }, versions: [avant], page: PAGE, sourceKind: 'jsonld' });
      eq([relu.recipe.original_title, relu.version.provenance.titre_lu, relu.version.provenance.titre_signet, relu.version.parent_version_id, relu.remplacement], ['Mes pâtes', 'Pâtes puttanesca', null, 'rv_0', false], 'titre (D-B24) : avec une version (relecture), le titre est conservé, titre_lu posé ; une version ai seule ne demande pas de remplacement');
      eq(W.fabriquerLectureWeb({ ...RECETTE, title: 'é'.repeat(400) }, { signet: SIGNET, page: PAGE, sourceKind: 'modele' }).recipe.original_title, 'é'.repeat(300), 'titre (D-B24) : un titre lu de 400 est borné à LIMITES_SIGNET.titre');
      const v = (kind, generated_by, verification_state) => ({ id: 'v', kind, provenance: { generated_by }, verification_state });
      // R-B-19 (amendement du chef d'orchestre) : la règle I-5 de VF-7 du lot A (src/domain/import-cible.js, `remplacement` de fabriquerExtraction, non
      // exportée) — seules les versions non ai de kind extraction | correction comptent ; une adaptation ou une traduction ne devient jamais courante.
      eq([W.versionHumaine([v('extraction', 'manual', 'to_verify')]), W.versionHumaine([v('correction', 'manual', 'to_verify')]), W.versionHumaine([v('correction', 'ai', 'to_verify')]), W.versionHumaine([v('extraction', 'ai', 'verified')]), W.versionHumaine([v('extraction', 'ai', 'to_verify')]), W.versionHumaine([v('adaptation', 'manual', 'verified')]), W.versionHumaine([v('translation', 'manual', 'to_verify')]), W.versionHumaine([v('extraction', 'ai', 'to_verify'), v('correction', 'manual', 'verified')]), W.versionHumaine([]), W.versionHumaine(null)], [true, true, false, false, false, false, false, true, false, false], 'remplacement (R-B-19, VF-7 du lot A) : vrai avec une extraction ou une correction non ai ; faux avec une version ai (même vérifiée), une adaptation ou une traduction, aucune version');
      const signetGarde = { ...SIGNET, current_version_id: 'rv_m' };
      const garde = W.fabriquerLectureWeb(RECETTE, { signet: signetGarde, versions: [v('extraction', 'manual', 'verified')], page: PAGE, sourceKind: 'jsonld', remplacer: false });
      eq([garde.recipe, garde.version.kind, garde.version.id !== garde.recipe.current_version_id, garde.remplacement], [{ ...SIGNET, current_version_id: 'rv_m' }, 'extraction', true, true], 'remplacer: false (F-3) : la fiche est le signet relu INTACT (aucun source_*, availability et courante inchangées) ; la version est fabriquée quand même');
      let e = null; try { W.fabriquerLectureWeb(RECETTE, { signet: SIGNET, page: PAGE, sourceKind: 'bidon' }); } catch (x) { e = x; }
      eq([e?.name, e?.champ], ['ErreurVocabulaire', 'source_kind'], 'fabriquerLectureWeb : source_kind hors SOURCE_KINDS → ErreurVocabulaire');
      const refusGarde = (opts) => { try { W.fabriquerLectureWeb(RECETTE, { signet: SIGNET, page: PAGE, sourceKind: 'jsonld', remplacer: false, ...opts }); return null; } catch (x) { return [x?.name, x?.champ]; } };
      eq([garde.recipe !== signetGarde, refusGarde({ sourceKind: 'bidon' }), refusGarde({ signet: { ...SIGNET, availability: 'perdue' } })], [true, ['ErreurVocabulaire', 'source_kind'], ['ErreurVocabulaire', 'availability']], 'remplacer: false (ronde 1) : une COPIE du signet, jamais la référence ; le vocabulaire est vérifié dans cette branche aussi (source_kind de la version, signet hors liste)');
      const sansCommentaires = (s) => s.replace(/\/\/.*$/gm, '');
      eq((sansCommentaires(await lire('../src/domain/lecture-web.js')).match(/assertVocabulaire\(/g) || []).length, 4, 'vocabulaire : lecture-web.js (sixième fabricant) appelle assertVocabulaire( exactement quatre fois hors commentaire — la ligne imports, le source_kind de la version, le signet gardé, la fiche recomposée (test de source, admis)');
      let sansAppareil = null; try { W.fabriquerImportWeb({ id: 'imp_x', signet: SIGNET }); } catch (x) { sansAppareil = x?.name; }
      eq([sansAppareil, W.fabriquerImportWeb({ id: 'imp_y', signet: SIGNET, deviceId: null }).device_id], ['TypeError', null], 'fabriquerImportWeb (ronde 1) : deviceId OUBLIÉ → TypeError (l’appelant passe repo.deviceId(), comme nouvelleLigneImport du lot A) ; un null explicite reste admis');
      const ligne = W.fabriquerImportWeb({ id: 'imp_w', signet: SIGNET, deviceId: 'dev_1' });
      eq(ligne, { id: 'imp_w', kind: 'web', edition_id: null, recipe_id: 'rc_s', scan_session_id: null, page_ids: [], photo_sha256: null, status: 'a_lancer', erreur: null, resultat: null, reponse_brute: null, appels: 0, model: null, duree_ms: null, device_id: 'dev_1', document_id_vol: null, battement_at: null, started_at: null, finished_at: null }, 'fabriquerImportWeb : la ligne § 3.1 exacte, edition_id nul même pour un signet rangé dans un livre (D-B17)');
      eq([V.assertVocabulaire({ source_kind: 'jsonld' }, 'recipes'), V.assertVocabulaire({ source_kind: null }, 'recipes'), V.assertVocabulaire({}, 'recipes')], [true, true, true], 'vocabulaire : source_kind de la liste, nul ou absent → accepté');
      const S = await import('../src/model/schema.js');
      eq([S.SOURCE_KINDS, Object.isFrozen(S.SOURCE_KINDS)], [['jsonld', 'modele'], true], 'vocabulaire : SOURCE_KINDS = [jsonld, modele], gelée');
      const R = await import('../src/domain/recherche-web.js');
      eq(R.reperesDe({ href: 'https://a.test/', presentation: 'Un plat simple.', temps_min: 15, difficulte: 'facile', ingredients: 7 }), { presentation: 'Un plat simple.', temps_min: 15, difficulte: 'facile', ingredients: 7 }, 'reperesDe : les quatre champs de la carte, revalidés');
      eq([R.reperesDe({ presentation: null, temps_min: null, difficulte: null, ingredients: null }), R.reperesDe(null), R.reperesDe({ presentation: 'Voir evil.com', temps_min: 2000, difficulte: 'extrême', ingredients: 0 })], [null, null, null], 'reperesDe : null si tout est nul (ou devient nul à la revalidation : adresse, bornes)');
      eq(R.reperesDe({ presentation: 'Voir https://evil.test/', temps_min: 20 }), { presentation: null, temps_min: 20, difficulte: null, ingredients: null }, 'reperesDe : une présentation avec adresse → presentation: null, le reste gardé');
    });

  } finally { setUiLocale(localeAvant); }
}
