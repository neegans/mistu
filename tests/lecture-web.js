// Tests du lot B « Recette web complète » (spec docs/superpowers/specs/2026-10-19-recette-web-design.md, § 7.4). Bases jetables, fetch factice,
// gestes injectés ; aucun réseau ; aucune écriture dans la bibliothèque de la personne ; jamais le navigateur partagé.
import { t } from '../src/core/i18n.js';
import { withRepo } from './sync-fixture.js';

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
      // Vague finale (sécurité, déni de service) : une fiche REÇUE (synchro, archive) peut porter un source_url de 100 000 barres. Le retrait de la
      // barre finale par /\/+$/ était quadratique (≈ 6 s pour UN appel sous Node, rejoué à chaque frappe du signet et à chaque « Garder et lire ») :
      // retrait linéaire ; et un source_url plus long qu'ADRESSE_MAX (= LIMITES_SIGNET.adresse : signetModel n'écrit jamais plus long) n'est jamais un
      // doublon. La DURÉE n'est pas affirmée ici : Chrome bascule sur un moteur linéaire quand une regex revient trop en arrière (le défaut y est
      // invisible, mesuré : vert sur l'ancien code) — elle l'est sous Node, sans ce repli (tools/lien.test.mjs).
      const { ADRESSE_MAX } = await import('../src/core/lien.js');
      const { LIMITES_SIGNET } = await import('../src/ui/signet.js');
      const barres = 'https://a.test/' + '/'.repeat(100000) + 'a';
      eq([adresseNormalisee(barres) === barres, adresseNormalisee('https://a.test/x' + '/'.repeat(100000))], [true, 'https://a.test/x'], 'adresseNormalisee (vague finale) : 100 000 barres suivies d’un caractère → intactes ; 100 000 barres finales → retirées');
      eq(doublonDAdresse([{ id: 'rc_barres', source_url: barres }], 'https://b.test/recette'), null, 'doublonDAdresse (vague finale, sécurité) : une fiche reçue de 100 000 barres n’est le doublon de rien');
      eq([ADRESSE_MAX,doublonDAdresse([{ id: 'court', source_url: 'https://a.test/r' + '/'.repeat(10) }], 'https://a.test/r')?.id, doublonDAdresse([{ id: 'long', source_url: 'https://a.test/r' + '/'.repeat(ADRESSE_MAX) }], 'https://a.test/r'), doublonDAdresse([{ id: 'court', source_url: 'https://a.test/r' }], 'https://a.test/r' + '/'.repeat(ADRESSE_MAX))], [LIMITES_SIGNET.adresse, 'court', null, null], 'doublonDAdresse (vague finale) : ADRESSE_MAX = LIMITES_SIGNET.adresse ; un source_url plus long est ignoré (aucun signet ne peut le porter), en deçà la même page reste un doublon ; une adresse cherchée plus longue n’a pas de doublon (signetModel la refuse)');
    });

    await run('page', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const { page } = W.lirePage({ page: { url_finale: 'https://www.ricardo.test/r/1', hote: 'evil.test', titre_page: 't'.repeat(1000), auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 2, texte_coupe: true } });
      eq(page, { url_finale: 'https://www.ricardo.test/r/1', hote: 'www.ricardo.test', titre_page: 't'.repeat(300), auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 2, texte_coupe: true, image_url: null }, 'lirePage : hôte RECALCULÉ (jamais celui du serveur, evil.test), titre borné à 300');
      const hostile = W.lirePage({ page: { url_finale: 'pas une adresse', lue_le: 'hier', autres_recettes: '2', texte_coupe: 'oui', titre_page: 7 }, stop_reason: 'x'.repeat(100), model: { m: 1 } });
      eq(hostile, { page: { url_finale: null, hote: null, titre_page: null, auteur: null, site: null, lue_le: null, autres_recettes: 0, texte_coupe: false, image_url: null }, stopReason: 'x'.repeat(40), modele: null }, 'lirePage : url_finale non URL → null, lue_le illisible → null, autres_recettes « 2 » → 0, texte_coupe « oui » → false, stop_reason borné à 40, model non chaîne → null');
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
      eq([r.resultat.page, r.reponseBrute, r.modele], [{ ...PAGE, image_url: null }, JSON.stringify(ok200.recette), null], 'lireRecetteWeb : le succès porte la page RELUE (celle que le journal et la fiche diront), la réponse brute (la recette reçue, en JSON) et le modèle (null pour un JSON-LD)');
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
      eq((sansCommentaires(await lire('../src/domain/lecture-web.js')).match(/assertVocabulaire\(/g) || []).length, 3, 'vocabulaire : lecture-web.js (sixième fabricant) appelle assertVocabulaire( exactement trois fois hors commentaire — le source_kind de la version, le signet gardé, la fiche recomposée ; la ligne imports passe par ligneImportNeuve, qui l’appelle (lot D, D-D12, I-D11 : amendée, quatre → trois) (test de source, admis)');
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

    // =================================================================================================================================
    // Tâche 4 — le vol partagé, démarrer, lancer, annuler (spec § 4.3.0-4.3.2, § 4.3.5, D-B13, D-B21, I-B3, I-B4, I-B7)
    await run('vol partagé', async () => {
      const V = await import('../src/ui/vol.js');
      const IC = await import('../src/ui/import-cible.js');
      V.reinitialiserVol();
      const a = { importId: 'a', controller: new AbortController() }; const b = { importId: 'b', controller: new AbortController() };
      eq([V.prendreVol(a), V.prendreVol(b), V.volEnCours(), V.volTenu('a') === a, V.volTenu('b')], [true, false, { importId: 'a' }, true, null], 'vol.js : prendreVol deux fois → la seconde rend false ; volTenu rend la tenue de CE document pour cet import');
      V.libererVol(b);
      eq(V.volEnCours(), { importId: 'a' }, 'vol.js : libererVol d’une autre tenue ne libère pas');
      V.libererVol(a);
      eq(V.volEnCours(), null, 'vol.js : libererVol de SA tenue libère');
      eq([IC.DOCUMENT_ID === V.DOCUMENT_ID, /^[0-9a-f-]{36}$/.test(V.DOCUMENT_ID), IC.BATTEMENT_MS, V.BATTEMENT_MS, IC.volEnCours === V.volEnCours], [true, true, 15000, 15000, true], 'vol.js : DOCUMENT_ID, BATTEMENT_MS et volEnCours d’import-cible.js sont ceux de vol.js (ré-exports : tests/import-cible.js inchangé)');
      const [srcVol, srcWeb, srcCible] = await Promise.all(['../src/ui/vol.js', '../src/ui/import-web.js', '../src/ui/import-cible.js'].map(lire));
      eq([/^\s*import\b/m.test(srcVol), /from '\.\/import-cible\.js'/.test(srcWeb), /\blet vol\w*\s*=/.test(srcCible), /\blet vol\w*\s*=/.test(srcWeb)], [false, false, false, false], 'sens unique (D-B13, test de source) : vol.js n’importe rien, import-web.js n’importe pas import-cible.js, et aucun des deux écrans n’a sa propre variable de vol');
      // Ronde 1 : l'aide de test du lot A (reinitialiserImportCible, appelée dans les finally de tests/import-cible.js) libère LE vol de vol.js et
      // l'abandonne : un vol laissé tenu par un test interrompu ne fuit pas dans les suites suivantes (mutant « reinitialiserVol retiré » : rouge).
      const laisse = { importId: 'laisse', controller: new AbortController() };
      V.prendreVol(laisse); IC.reinitialiserImportCible();
      eq([V.volEnCours(), laisse.controller.signal.aborted], [null, true], 'reinitialiserImportCible (lot A) appelle reinitialiserVol : le vol tenu est abandonné et libéré');
    });

    await run('démarrer, lancer, annuler', () => withRepo(async (repo, db) => {
      const W = await import('../src/ui/import-web.js');
      const IC = await import('../src/ui/import-cible.js');
      const V = await import('../src/ui/vol.js');
      V.reinitialiserVol(); W.reinitialiserLectureWeb();
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      try {
        const NOW = '2026-10-19T12:00:00.000Z'; const DATE = '2026-10-19T00:00:00.000Z';
        const SESSION = { access_token: 'jeton-web-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
        const signet = (id, url) => ({ id, edition_id: null, original_title: 'Signet ' + id, original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: url, source_label: 'a.test', created_at: DATE, updated_at: DATE });
        const ids = ['rc_w1', 'rc_w2', 'rc_w3', 'rc_w4', 'rc_w5', 'rc_w6', 'rc_w7', 'rc_w8', 'rc_w9', 'rc_w10', 'rc_w12', 'rc_w13', 'rc_w14', 'rc_w15', 'rc_w16'];
        await db.mutate({ puts: { recipes: [...ids.map((id) => signet(id, `https://a.test/${id}`)), signet('rc_http', 'http://a.test/h')] }, origin: 'device' });
        const ctxDe = async (session = SESSION, { imports } = {}) => ({ recipes: await db.getAll('recipes'), imports: imports ?? await db.getAll('imports'), sync: { user: session ? { id: 'u1' } : null, auth: { jeton: async () => session } } });
        const fiche = async (id) => db.get('recipes', id);
        const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
        const PAGE = { url_finale: 'https://a.test/r', hote: 'a.test', titre_page: 'T', auteur: null, site: null, lue_le: NOW, autres_recettes: 0, texte_coupe: false };
        const LD = { source_kind: 'jsonld', page: PAGE, recette: { title: 'Pâtes', ingredients: [{ source_text: '250 g de pâtes' }], steps: [{ text: 'Cuire.' }], total_minutes: 30 }, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null };
        const fauxFetch = () => {
          const a = { appels: [], rendre: [] };
          a.fetch = (url, options) => new Promise((resolve, reject) => {
            a.appels.push({ url, options });
            const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
            if (options?.signal?.aborted) { abandon(); return; }
            options?.signal?.addEventListener('abort', abandon, { once: true });
            a.rendre.push((s, c) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(s, c)); });
          });
          return a;
        };
        const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
        const ligneDe = async (recipeId) => (await db.byIndex('imports', 'recipe_id', recipeId)).find((i) => !['enregistre', 'ignore'].includes(i.status)) || null;
        const LW = await import('../src/domain/lecture-web.js');
        // Une ligne `imports` web à la forme § 3.1 (fabriquerImportWeb : device_id de CET appareil, edition_id nul…), horodatée, puis ses surcharges.
        const importWeb = (id, recipeId, sur = {}) => ({ ...LW.fabriquerImportWeb({ id, signet: { id: recipeId }, deviceId: repo.deviceId() }), created_at: NOW, updated_at: NOW, ...sur });
        // La capture d'outbox de withRepo (db.onMutate) reste VIVANTE tout le bloc : l'espion l'enveloppe et la rend, jamais null (sans elle,
        // « aucune entrée de plus en file », au cas 9, serait vrai quoi que fasse le code).
        ok(typeof db.onMutate === 'function', 'précondition du montage (pas une garde du code) : withRepo pose la capture d’outbox, que le bloc garde vivante');
        const touches = [];
        // R-B-17 : l'espion compte les magasins ÉCRITS ET EFFACÉS (en fin de vol, la ligne interne du battement est une suppression dans sync_state).
        const espionner = () => { const avant = db.onMutate; db.onMutate = (x) => { touches.push([...Object.keys(x.puts || {}), ...Object.keys(x.deletes || {})].sort().join('+')); return avant ? avant(x) : {}; }; return () => { db.onMutate = avant; }; };

        // (1) La fiche d'un signet : l'import naît a_lancer, part en_cours (started_at, document_id_vol), appels 1 AU DÉPART du fetch, UN POST exact.
        const ff = fauxFetch();
        const finEspion = espionner();
        const r1 = await W.demarrerLectureWeb({ recipe: await fiche('rc_w1'), ctx: await ctxDe() }, { repo, fetch: ff.fetch, maintenant: () => NOW });
        await attendre(() => ff.appels.length === 1, 'le POST est parti');
        const enVol = await db.get('imports', r1.importId);
        eq([r1.issue, r1.recipeId, enVol.kind, enVol.status, enVol.appels, enVol.document_id_vol, enVol.started_at, enVol.battement_at, enVol.edition_id, enVol.erreur], ['ok', 'rc_w1', 'web', 'en_cours', 1, V.DOCUMENT_ID, NOW, NOW, null, null], 'lancer : import créé puis en_cours (started_at, document_id_vol = DOCUMENT_ID), appels 1 au départ du fetch, edition_id nul (D-B17)');
        eq([JSON.parse(ff.appels[0].options.body), ff.appels[0].url.endsWith('/functions/v1/assistant'), V.volEnCours()], [{ outil: 'lecture-web', corps: { url: 'https://a.test/rc_w1' } }, true, { importId: r1.importId }], 'lancer : UN POST { outil: lecture-web, corps: { url } } avec l’adresse du signet RELU ; le vol est tenu');
        // I-B3 (D-B13) : un vol WEB tenu → une extraction de pages dans le même document est refusée.
        eq(await IC.lancerExtraction('imp_photo', { ctx: await ctxDe(), repo }), { issue: 'refuse', raison: 'vol_tenu' }, 'vol partagé : un vol web tenu → lancerExtraction (photo) rend vol_tenu');
        ff.rendre[0](200, LD);
        eq(await r1.lancement, { issue: 'a_verifier' }, 'lancer : la réponse lue → a_verifier');
        finEspion();
        const lue = await db.get('imports', r1.importId);
        eq([lue.status, lue.resultat?.source_kind, lue.resultat?.recette?.title, lue.resultat?.recette?.total_minutes, typeof lue.reponse_brute, lue.reponse_brute === JSON.stringify(LD.recette), lue.document_id_vol, Number.isInteger(lue.duree_ms), lue.model], ['a_verifier', 'jsonld', 'Pâtes', 30, 'string', true, null, true, null], 'lancer (I-B4) : le résultat relu vit dans le journal (a_verifier, resultat, reponse_brute = la recette reçue telle quelle — sa borne : cas 16), vol libéré');
        eq([[...new Set(touches)], (await fiche('rc_w1')).availability], [['imports', 'sync_state'], 'reference_only'], 'lancer (I-B9) : seul le journal est écrit pendant une lecture, plus l’effacement de la ligne interne du battement en fin de vol (sync_state, origine device, R-B-17) — le signet reste reference_only');
        eq(V.volEnCours(), null, 'lancer : le vol est libéré en finally');

        // (2) Les refus de lancerLecture (F-8) : rien d'écrit, rien d'appelé.
        const ffR = fauxFetch();
        const tenue = { importId: 'autre', controller: new AbortController() }; V.prendreVol(tenue);
        const tenu = await W.lancerLecture(r1.importId, { ctx: await ctxDe(), repo, fetch: ffR.fetch });
        V.libererVol(tenue);
        const r2 = await W.demarrerLectureWeb({ recipe: await fiche('rc_w2'), ctx: await ctxDe() }, { repo, fetch: ffR.fetch, enLigne: () => false });
        const horsLigne = await r2.lancement;
        const sansSession = await W.lancerLecture(r2.importId, { ctx: await ctxDe(null), repo, fetch: ffR.fetch });
        const inconnu = await W.lancerLecture('imp_absent', { ctx: await ctxDe(), repo, fetch: ffR.fetch });
        const statut = await W.lancerLecture(r1.importId, { ctx: await ctxDe(), repo, fetch: ffR.fetch }); // a_verifier sans relire
        await db.mutate({ puts: { imports: [importWeb('imp_http', 'rc_http')] }, origin: 'device' });
        const interdit = await W.lancerLecture('imp_http', { ctx: await ctxDe(), repo, fetch: ffR.fetch });
        eq([tenu, horsLigne, sansSession, inconnu, statut, interdit].map((x) => x.raison), ['vol_tenu', 'hors_ligne', 'non_connecte', 'inconnu', 'statut', 'interdit'], 'lancerLecture : refuse vol_tenu, hors_ligne, non_connecte, inconnu, statut (a_verifier sans relire), interdit (signet relu en http:)');
        eq([ffR.appels.length, (await db.get('imports', r2.importId)).status, (await db.get('imports', r2.importId)).appels, (await db.get('imports', 'imp_http')).status, (await db.get('imports', r1.importId)).status], [0, 'a_lancer', 0, 'a_lancer', 'a_verifier'], 'lancerLecture : aucun refus n’écrit ni n’appelle (hors ligne : l’import reste a_lancer, appels 0)');
        eq(await W.demarrerLectureWeb({ recipe: await fiche('rc_http'), ctx: await ctxDe() }, { repo, fetch: ffR.fetch }), { issue: 'refuse', raison: 'interdit' }, 'demarrerLectureWeb (B-20) : un signet en http: → refus interdit, rien d’écrit, zéro réseau');
        // Ronde 1 du lot A (volUnique) : une lecture SANS référence (éditeur, panneau d'index) tient le vol pendant ses gardes, AVANT d'avoir une ligne :
        // volEnCours() rend { importId: null } et une lecture web demandée à cet instant est refusée (vol_tenu) ; rien n'est écrit.
        const ctxGardes = await ctxDe(); const nGardes = await db.count('imports'); const pendant = [];
        const sansRef = await IC.lancerExtraction(null, { ctx: ctxGardes, repo, lecture: { kind: 'recette', importId: null, pageIds: ['pg_x'] }, enLigne: () => { pendant.push(V.volEnCours(), W.lancerLecture(r2.importId, { ctx: ctxGardes, repo, fetch: ffR.fetch })); return false; } });
        eq([pendant[0], await pendant[1], sansRef, await db.count('imports'), ffR.appels.length, V.volEnCours()], [{ importId: null }, { issue: 'refuse', raison: 'vol_tenu' }, { issue: 'refuse', raison: 'hors_ligne', importId: null }, nGardes, 0, null], 'vol partagé (ronde 1 du lot A) : pendant les gardes d’une lecture sans référence, volEnCours() rend importId null et lancerLecture rend vol_tenu ; rien d’écrit, zéro réseau');

        // (3) Deux démarrages entrelacés sur le même signet, ctx.imports périmé (B-5, S-3, F-4) : UNE ligne, UN POST — le mur est la transaction.
        const ff3 = fauxFetch();
        const ctx3 = await ctxDe();
        const [x, y] = await Promise.all([W.demarrerLectureWeb({ recipe: await fiche('rc_w3'), ctx: ctx3 }, { repo, fetch: ff3.fetch }), W.demarrerLectureWeb({ recipe: await fiche('rc_w3'), ctx: ctx3 }, { repo, fetch: ff3.fetch })]);
        await attendre(() => ff3.appels.length === 1, 'un POST');
        await new Promise((r) => setTimeout(r, 30));
        eq([(await db.byIndex('imports', 'recipe_id', 'rc_w3')).length, ff3.appels.length, x.importId === y.importId], [1, 1, true], 'création conditionnée : deux démarrages entrelacés → UNE ligne imports, UN POST, le second reprend l’import du premier (mutant « conditions retirées » : deux lignes → rouge)');
        ff3.rendre[0](502, { erreur: 'inaccessible' });
        await x.lancement;
        eq([(await ligneDe('rc_w3')).status, (await ligneDe('rc_w3')).erreur, (await ligneDe('rc_w3')).reponse_brute ?? null], ['echec', { raison: 'inaccessible', extra: {} }, null], 'lancer : 502 inaccessible → echec(inaccessible), aucune réponse brute (le site n’a rien rendu)');

        // (4) TransitionRefusee à la création : l'import ouvert (créé entre le rendu et la tape) est relu par repo.byIndex et REPRIS, zéro appel.
        await db.mutate({ puts: { imports: [importWeb('imp_deja', 'rc_w4', { status: 'a_verifier', appels: 1, resultat: { source_kind: LD.source_kind, page: LD.page, recette: LD.recette } })] }, origin: 'device' });
        const ff4 = fauxFetch();
        const repris = await W.demarrerLectureWeb({ recipe: await fiche('rc_w4'), ctx: await ctxDe(SESSION, { imports: [] }) }, { repo, fetch: ff4.fetch });
        eq([repris.issue, repris.importId, repris.lancement, (await db.byIndex('imports', 'recipe_id', 'rc_w4')).length, ff4.appels.length], ['ok', 'imp_deja', null, 1, 0], 'création refusée (TransitionRefusee) → l’import ouvert relu par byIndex et repris ; un a_verifier ne relance rien (B-12), zéro appel');
        const encore = await W.demarrerLectureWeb({ recipe: await fiche('rc_w2'), ctx: await ctxDe() }, { repo, fetch: ffR.fetch, enLigne: () => false });
        eq([encore.importId, (await db.byIndex('imports', 'recipe_id', 'rc_w2')).length], [r2.importId, 1], 'second passage sur le même signet → l’import ouvert (a_lancer) est repris, un seul');
        // R-B-18 (une définition d’« ouvert », celle d’importOuvert : statut dans IMPORTS_OUVERTS) : une ligne web au statut hors vocabulaire ou nul
        // (reçue d’ailleurs) n’est PAS un import ouvert — elle ne masque pas la fiche, un import neuf naît (mutant « !IMPORTS_TERMINES » : rouge).
        await db.mutate({ puts: { imports: [importWeb('imp_zzz', 'rc_w10', { status: 'zzz' }), importWeb('imp_nul', 'rc_w10', { status: null })] }, origin: 'device' });
        const ffZ = fauxFetch();
        const rZ = await W.demarrerLectureWeb({ recipe: await fiche('rc_w10'), ctx: await ctxDe() }, { repo, fetch: ffZ.fetch, enLigne: () => false });
        eq([rZ.issue, ['imp_zzz', 'imp_nul'].includes(rZ.importId), (await db.get('imports', rZ.importId))?.status, (await rZ.lancement)?.raison, (await db.byIndex('imports', 'recipe_id', 'rc_w10')).length, ffZ.appels.length], ['ok', false, 'a_lancer', 'hors_ligne', 3, 0], 'R-B-18 : une ligne web au statut inconnu (« zzz ») ou nul n’est pas un import ouvert — un import neuf naît (a_lancer ; ici hors ligne : rien ne part)');

        // (5) « Relire la page » (ronde 1) : a_verifier → en_cours en UNE transaction (comme T6-R1-a du lot A) — jamais un a_lancer intermédiaire qui
        // effacerait la lecture payée avant que le départ soit acquis ; la lecture précédente (résultat, réponse brute, modèle, durée) est effacée AU
        // départ, pour qu'un échec de ce vol ne porte jamais le diagnostic d'un autre. Un POST.
        await db.mutate({ puts: { imports: [{ ...(await db.get('imports', r1.importId)), model: 'modele-ancien' }] }, origin: 'device' });
        const ff5 = fauxFetch(); const ecritures5 = [];
        const espion5 = { ...repo, transitionner: async (store, key, opts) => { ecritures5.push([opts?.attendus, opts?.patch?.status ?? null]); return repo.transitionner(store, key, opts); } };
        const relire = W.lancerLecture(r1.importId, { ctx: await ctxDe(), repo: espion5, fetch: ff5.fetch, relire: true });
        await attendre(() => ff5.appels.length === 1, 'relecture partie');
        const l5 = await db.get('imports', r1.importId);
        eq([l5.status, l5.resultat, l5.reponse_brute, l5.model, l5.duree_ms, l5.appels, ecritures5[0]?.[1], !!ecritures5[0]?.[0]?.includes('a_verifier'), ecritures5.filter(([, s]) => s === 'a_lancer').length], ['en_cours', null, null, null, null, 2, 'en_cours', true, 0], 'relire : a_verifier → en_cours en UNE transition (aucun a_lancer intermédiaire), résultat, réponse brute, modèle et durée effacés au départ, un appel de plus');
        ff5.rendre[0](200, LD); await relire;

        // (6) « Annuler » : le fetch est abandonné, en_cours → echec(annule), le vol libéré ; un document qui ne tient pas le vol ne peut rien.
        const ff6 = fauxFetch();
        const r6 = await W.demarrerLectureWeb({ recipe: await fiche('rc_w6'), ctx: await ctxDe() }, { repo, fetch: ff6.fetch });
        await attendre(() => ff6.appels.length === 1, 'parti');
        eq(await W.annulerLecture('imp_inconnu'), false, 'annulerLecture : sans la tenue de ce document → false, rien d’écrit');
        eq(await W.annulerLecture(r6.importId), true, 'annulerLecture : true');
        await r6.lancement;
        const annulee = await db.get('imports', r6.importId);
        eq([ff6.appels[0].options.signal.aborted, annulee.status, annulee.erreur?.raison, annulee.document_id_vol, annulee.appels, V.volEnCours()], [true, 'echec', 'annule', null, 1, null], 'Annuler : fetch abandonné, echec(annule), document_id_vol libéré, l’appel reste compté, plus de vol');

        // (6 bis) `appels + 1` au DÉPART du fetch, jamais avant (mutant « appels incrémenté avant le fetch ») : « Annuler » juste après la transition
        // en_cours, avant que le fetch ne parte → aucun POST, appels 0.
        const ffAvant = fauxFetch(); let idAvant = null;
        const coupeAvant = { ...repo, transitionner: async (store, key, opts) => { const r = await repo.transitionner(store, key, opts); if (opts?.patch?.status === 'en_cours') { idAvant = key; await W.annulerLecture(key); } return r; } };
        await db.mutate({ puts: { imports: [importWeb('imp_avant', 'rc_w5')] }, origin: 'device' });
        const issueAvant = await W.lancerLecture('imp_avant', { ctx: await ctxDe(), repo: coupeAvant, fetch: ffAvant.fetch });
        const lAvant = await db.get('imports', 'imp_avant');
        eq([issueAvant.raison, idAvant, ffAvant.appels.length, lAvant.appels, lAvant.status, lAvant.erreur?.raison], ['annule', 'imp_avant', 0, 0, 'echec', 'annule'], 'appels : « Annuler » avant le départ du fetch → aucun POST et appels 0 (compté au départ du fetch, jamais à la transition)');
        await db.mutate({ puts: { imports: [{ ...lAvant, status: 'ignore' }] }, origin: 'device' }); // rangement : plus d'import ouvert sur rc_w5

        // (7) Réponse tardive (I-B7) : l'écriture a_verifier attend une porte ; « Annuler » passe entre la réponse lue et l'écriture → reponse_brute seule.
        let ouvrir; const porte = new Promise((r) => { ouvrir = r; });
        let arrivee; const arrive = new Promise((r) => { arrivee = r; }); // ronde 1 : un FAIT (la réponse est lue, l'écriture a_verifier attend), jamais un délai
        const espion = { ...repo, transitionner: async (store, key, opts) => { if (opts?.patch?.status === 'a_verifier') { arrivee(); await porte; } return repo.transitionner(store, key, opts); } };
        const ff7 = fauxFetch();
        const r7 = await W.demarrerLectureWeb({ recipe: await fiche('rc_w7'), ctx: await ctxDe() }, { repo: espion, fetch: ff7.fetch });
        await attendre(() => ff7.appels.length === 1, 'parti');
        ff7.rendre[0](200, LD);
        await arrive;
        await W.annulerLecture(r7.importId);
        ouvrir();
        eq(await r7.lancement, { issue: 'echec', raison: 'annule' }, 'réponse tardive : l’issue reste annule');
        const tard = await db.get('imports', r7.importId);
        eq([tard.status, tard.erreur?.raison, typeof tard.reponse_brute, tard.resultat, (await fiche('rc_w7')).availability], ['echec', 'annule', 'string', null, 'reference_only'], 'réponse tardive : aucune recette, reponse_brute seule gardée, l’état reste echec(annule)');

        // (8) incertain : l'écriture a_verifier rejette une fois → echec(incertain) ; deux écritures rejetées → la ligne reste en_cours (interrompu au démarrage).
        const rejette = (aussiIncertain) => ({ ...repo, transitionner: async (store, key, opts) => { if (opts?.patch?.status === 'a_verifier' || (aussiIncertain && opts?.patch?.erreur?.raison === 'incertain')) throw new Error('disque plein'); return repo.transitionner(store, key, opts); } });
        const ff8 = fauxFetch();
        const r8 = await W.demarrerLectureWeb({ recipe: await fiche('rc_w8'), ctx: await ctxDe() }, { repo: rejette(false), fetch: ff8.fetch });
        await attendre(() => ff8.appels.length === 1, 'parti'); ff8.rendre[0](200, LD);
        eq([await r8.lancement, (await db.get('imports', r8.importId)).erreur?.raison], [{ issue: 'echec', raison: 'incertain' }, 'incertain'], 'incertain : une écriture rejetée → echec(incertain)');
        const l8 = await db.get('imports', r8.importId);
        eq([l8.status, l8.document_id_vol, Number.isInteger(l8.duree_ms)], ['echec', null, true], 'incertain : la ligne echec(incertain) libère le vol (document_id_vol nul) et porte la durée');
        const ff9 = fauxFetch();
        const erreurs = []; const vraiErreur = console.error; console.error = (...a) => { erreurs.push(String(a[0])); }; // l'incident est journalisé (attendu)
        let r9, issue9;
        try {
          r9 = await W.demarrerLectureWeb({ recipe: await fiche('rc_w9'), ctx: await ctxDe() }, { repo: rejette(true), fetch: ff9.fetch });
          await attendre(() => ff9.appels.length === 1, 'parti'); ff9.rendre[0](200, LD);
          issue9 = await r9.lancement;
        } finally { console.error = vraiErreur; }
        eq([issue9, (await db.get('imports', r9.importId)).status, erreurs.some((e) => e.includes('import_web.incertain'))], [{ issue: 'echec', raison: 'incertain', ecrit: false }, 'en_cours', true], 'incertain : deux écritures rejetées → la ligne reste en_cours (deviendra interrompu), l’incident est journalisé');

        // (9) Battement (R-B-17, vague finale du lot A) : HORS de la ligne synchronisée — repo.battre réécrit la ligne interne `battement:<id>` de
        // sync_state (origine device) ; la ligne imports ne bouge pas (battement_at et updated_at du départ), rien de plus en file ; la ligne interne
        // est effacée en fin de vol (repo.oublierBattement).
        const enFile = async () => (await db.getAll('outbox')).length;
        const ff10 = fauxFetch();
        const r10 = await W.demarrerLectureWeb({ recipe: await fiche('rc_w5'), ctx: await ctxDe() }, { repo, fetch: ff10.fetch, battementMs: 20 });
        await attendre(() => ff10.appels.length === 1, 'parti');
        const cleHb = 'battement:' + r10.importId;
        const l0 = await db.get('imports', r10.importId); const n0 = await enFile();
        await attendre(async () => typeof (await db.get('sync_state', cleHb))?.value === 'string', 'un battement écrit');
        const hb0 = (await db.get('sync_state', cleHb)).value;
        await attendre(async () => (await db.get('sync_state', cleHb))?.value !== hb0, 'un second battement');
        const l1 = await db.get('imports', r10.importId); const hb1 = await db.get('sync_state', cleHb);
        eq([hb1?.status, l1.status, l1.battement_at, l1.updated_at, await enFile()], ['vol', 'en_cours', l0.battement_at, l0.updated_at, n0], 'battement (R-B-17) : la ligne interne battement:<id> de sync_state est réécrite pendant le vol ; la ligne imports ne bouge pas (battement_at et updated_at du départ), rien de plus en file');
        await repo.transitionner('imports', r10.importId, { attendus: ['en_cours'], patch: { erreur: null } });
        eq(await enFile(), n0 + 1, 'battement (témoin) : une transition LOCALE de la même ligne entre en file — la capture est vivante, l’assertion précédente n’est pas creuse');
        ff10.rendre[0](200, LD); await r10.lancement;
        eq(await attendre(async () => !(await db.get('sync_state', cleHb)), 'la ligne interne effacée'), true, 'battement (R-B-17) : la ligne interne est effacée en fin de vol (repo.oublierBattement)');
        // --- Ronde 1 de la tâche 4 ---------------------------------------------------------------------------------------------------------------------
        let postsImmediats = 0; const fetchImmediat = async () => { postsImmediats += 1; return reponse(502, { erreur: 'inaccessible' }); };

        // (10) D-B4 : l'adresse lue est celle du signet RELU en base au lancement, jamais celle de l'écran. La fiche passée et ctx.recipes portent une
        // adresse ancienne (changée entre le rendu et la tape, dans un autre onglet ou par la synchronisation), la base la neuve : le POST porte la
        // neuve (mutant « adresse lue dans l'instantané de l'écran d'abord » : rouge).
        const ancienne = signet('rc_w11', 'https://a.test/ancienne');
        await db.mutate({ puts: { recipes: [signet('rc_w11', 'https://a.test/neuve')] }, origin: 'device' });
        const ctxAncien = { ...(await ctxDe()), recipes: [...(await db.getAll('recipes')).filter((r) => r.id !== 'rc_w11'), ancienne] };
        const ffAdr = fauxFetch();
        const rAdr = await W.demarrerLectureWeb({ recipe: ancienne, ctx: ctxAncien }, { repo, fetch: ffAdr.fetch });
        await attendre(() => ffAdr.appels.length === 1, 'parti');
        eq(JSON.parse(ffAdr.appels[0].options.body), { outil: 'lecture-web', corps: { url: 'https://a.test/neuve' } }, 'D-B4 : la fiche affichée et ctx.recipes portent l’adresse ancienne, la base la neuve → le POST porte l’adresse du signet RELU en base');
        ffAdr.rendre[0](502, { erreur: 'inaccessible' }); await rAdr.lancement;

        // (11) Le doublon a UNE porte, demarrerLectureWeb (§ 4.3.1) ; « Garder et lire » (search.js) lui délègue : une adresse déjà gardée, sous une autre
        // forme (hôte en capitales, utm_*), → { issue: 'doublon', recette }, rien d'écrit, zéro appel.
        const nRec = await db.count('recipes'); const nImp = await db.count('imports'); const ffDbl = fauxFetch();
        const dbl = await W.demarrerLectureWeb({ adresse: 'https://A.test/rc_w1?utm_source=x', titre: 'T', ctx: await ctxDe() }, { repo, fetch: ffDbl.fetch });
        eq([dbl.issue, dbl.recette?.id, await db.count('recipes') - nRec, await db.count('imports') - nImp, ffDbl.appels.length], ['doublon', 'rc_w1', 0, 0, 0], 'demarrerLectureWeb({ adresse }) : une adresse déjà gardée → doublon (la fiche existante), rien d’écrit, zéro appel');

        // (12) I-2 du lot A tient par STATUT, toutes sortes confondues : un import ouvert d'une AUTRE sorte (« recette », a_lancer) sur la fiche du signet
        // n'est pas repris (R-B-18 : « ouvert » ici = une ligne web) et le mur refuse la création → un refus NOMMÉ (transition), jamais une exception
        // non gérée ; rien d'écrit, zéro appel. lancerLecture sur cette ligne → inconnu (ce n'est pas une lecture web).
        await db.mutate({ puts: { imports: [{ ...importWeb('imp_rec', 'rc_w12'), kind: 'recette' }] }, origin: 'device' });
        const rSorte = await W.demarrerLectureWeb({ recipe: await fiche('rc_w12'), ctx: await ctxDe() }, { repo, fetch: fetchImmediat }).catch((e) => ({ leve: e?.name ?? String(e) }));
        eq([rSorte, (await db.byIndex('imports', 'recipe_id', 'rc_w12')).map((i) => i.id), postsImmediats], [{ issue: 'refuse', raison: 'transition', statut: 'a_lancer' }, ['imp_rec'], 0], 'demarrerLectureWeb : un import ouvert d’une autre sorte tient la fiche → refus nommé (transition), aucune ligne web, zéro appel (mutant « ouvertDe toutes sortes » : rouge)');
        eq([(await W.lancerLecture('imp_rec', { ctx: await ctxDe(), repo, fetch: fetchImmediat })).raison, (await db.get('imports', 'imp_rec')).status, postsImmediats], ['inconnu', 'a_lancer', 0], 'lancerLecture : une ligne d’une autre sorte (recette) → inconnu, rien d’écrit, zéro appel (mutant « sorte non vérifiée » : rouge)');

        // (13) Le signet effacé entre le démarrage et le lancement (fiche supprimée ailleurs, tombale reçue) → inconnu : la fiche n'existe plus — jamais
        // « interdit », qui dirait qu'une adresse a été refusée. Rien d'écrit, zéro appel.
        await db.mutate({ puts: { imports: [importWeb('imp_orphelin', 'rc_efface')] }, origin: 'device' });
        eq([(await W.lancerLecture('imp_orphelin', { ctx: await ctxDe(), repo, fetch: fetchImmediat })).raison, (await db.get('imports', 'imp_orphelin')).status, postsImmediats], ['inconnu', 'a_lancer', 0], 'lancerLecture : signet effacé (aucune fiche) → inconnu, pas interdit ; rien d’écrit, zéro appel');

        // (14) Une erreur qui n'est pas un refus pendant le lancement non attendu (base indisponible à la transition en_cours) : la promesse `lancement`
        // ne rejette jamais (aucun rejet sans gestionnaire) — l'incident est journalisé (import_web.lancer), l'issue est echec(interne) ; la ligne
        // reste a_lancer, zéro appel, le vol libéré.
        const panne = { ...repo, transitionner: async (store, key, opts) => { if (opts?.patch?.status === 'en_cours') throw new Error('base fermée'); return repo.transitionner(store, key, opts); } };
        const erreurs14 = []; const vraiErreur14 = console.error; console.error = (...a) => { erreurs14.push(String(a[0])); };
        let r14, issue14;
        try {
          r14 = await W.demarrerLectureWeb({ recipe: await fiche('rc_w13'), ctx: await ctxDe() }, { repo: panne, fetch: fetchImmediat });
          issue14 = await r14.lancement.catch((e) => ({ rejet: e?.message ?? String(e) }));
        } finally { console.error = vraiErreur14; }
        eq([issue14, (await db.get('imports', r14.importId)).status, postsImmediats, erreurs14.some((e) => e.includes('import_web.lancer')), V.volEnCours()], [{ issue: 'echec', raison: 'interne' }, 'a_lancer', 0, true, null], 'lancement non attendu : une erreur de base → echec(interne) journalisé, jamais un rejet sans gestionnaire ; la ligne reste a_lancer, zéro appel, vol libéré');

        // (15) Un refus de LECTURE (le serveur a répondu, § 4.3.3 : coupe, illisible, hors_bornes, vide, lien) garde la réponse brute et le modèle sur
        // la ligne echec — diagnostic, jamais rendu ; le vol est libéré (document_id_vol nul) et la durée écrite. (Un refus de la passerelle n'en a pas :
        // cas 3.)
        const ffIll = fauxFetch();
        const rIll = await W.demarrerLectureWeb({ recipe: await fiche('rc_w14'), ctx: await ctxDe() }, { repo, fetch: ffIll.fetch });
        await attendre(() => ffIll.appels.length === 1, 'parti');
        ffIll.rendre[0](200, { source_kind: 'modele', page: PAGE, recette: 'pas de recette ici', usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn', model: 'modele-test' });
        const issueIll = await rIll.lancement; const lIll = await db.get('imports', rIll.importId);
        eq([issueIll, lIll.status, lIll.erreur?.raison, lIll.reponse_brute, lIll.model, lIll.document_id_vol, Number.isInteger(lIll.duree_ms)], [{ issue: 'echec', raison: 'illisible' }, 'echec', 'illisible', 'pas de recette ici', 'modele-test', null, true], 'echec(illisible) : la réponse brute et le modèle sont gardés sur la ligne (§ 4.3.3), document_id_vol nul, durée écrite');

        // (16) La réponse brute gardée est bornée à 16 000 points de code (REPONSE_BRUTE_MAX) : une lecture admise dont le texte du modèle est plus long
        // est gardée coupée à 16 000 exactement ; la recette lue reste entière.
        const ffLong = fauxFetch();
        const rLong = await W.demarrerLectureWeb({ recipe: await fiche('rc_w15'), ctx: await ctxDe() }, { repo, fetch: ffLong.fetch });
        await attendre(() => ffLong.appels.length === 1, 'parti');
        ffLong.rendre[0](200, { source_kind: 'modele', page: PAGE, recette: JSON.stringify({ title: 'Pâtes', ingredients: [{ source_text: '250 g de pâtes' }], steps: [{ text: 'Cuire.' }] }) + ' '.repeat(17000), usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn', model: 'modele-test' });
        await rLong.lancement; const lLong = await db.get('imports', rLong.importId);
        eq([lLong.status, Array.from(lLong.reponse_brute ?? '').length, lLong.resultat?.recette?.title, lLong.model], ['a_verifier', 16000, 'Pâtes', 'modele-test'], 'réponse brute d’une lecture admise : coupée à 16 000 points de code exactement, la recette lue entière');

        // (17) Les abonnés (les écrans) : rappelés au départ du vol (en_cours) puis à sa fin ; un abonné désabonné ne l'est plus ; un VRAI événement
        // `offline` de la fenêtre éteint enLigneLecture() et rappelle les abonnés, `online` le rallume (mutants « notifier muet », « notifier du départ
        // retiré », « désabonnement inopérant », « écouteur offline retiré » : rouges).
        let vus = 0; const desabonner = W.ecouterLecture(() => { vus += 1; });
        const ffAb = fauxFetch();
        const rAb = await W.demarrerLectureWeb({ recipe: await fiche('rc_w16'), ctx: await ctxDe() }, { repo, fetch: ffAb.fetch });
        await attendre(() => ffAb.appels.length === 1, 'parti');
        const auDepart = vus;
        ffAb.rendre[0](502, { erreur: 'inaccessible' }); await rAb.lancement;
        const aLaFin = vus;
        desabonner();
        let vus2 = 0; const desabonner2 = W.ecouterLecture(() => { vus2 += 1; });
        let pendantOffline;
        try {
          window.dispatchEvent(new Event('offline'));
          pendantOffline = W.enLigneLecture();
        } finally { window.dispatchEvent(new Event('online')); desabonner2(); }
        eq([auDepart, aLaFin, vus, vus2, pendantOffline, W.enLigneLecture()], [1, 2, 2, 2, false, true], 'ecouterLecture : un abonné rappelé au départ (en_cours) puis à la fin du vol ; désabonné, plus rien ; offline → enLigneLecture() faux et abonnés rappelés, online → vrai');

        // (18) Le titre d'un « Garder et lire » est borné à LIMITES_SIGNET.titre (300 points de code) par demarrerLectureWeb, désormais la seule porte :
        // un titre de résultat plus long donne un signet au titre coupé, jamais une adresse refusée (mutant « titre non borné » : rouge).
        const rTitre = await W.demarrerLectureWeb({ adresse: 'https://a.test/titre-long', titre: 'é'.repeat(400), ctx: await ctxDe() }, { repo, fetch: fetchImmediat, enLigne: () => false });
        const sTitre = typeof rTitre.recipeId === 'string' ? await fiche(rTitre.recipeId) : null; // un refus n'a pas de fiche : l'assertion rougit, sans lever
        eq([rTitre.issue, Array.from(sTitre?.original_title ?? '').length, await rTitre.lancement, postsImmediats], ['ok', 300, { issue: 'refuse', raison: 'hors_ligne' }, 0], 'demarrerLectureWeb({ adresse, titre }) : un titre de 400 points de code → signet au titre borné à 300, l’import créé (hors ligne : rien ne part)');

        eq(reseau, 0, 'aucun réseau réel');
      } finally { globalThis.fetch = vraiFetch; V.reinitialiserVol(); }
    }));

    // =================================================================================================================================
    // Tâche 5 — l'écran #/recipes/<id>/importer en variante web, « Enregistrer », la fiche (spec § 4.1 a/c, § 4.2, § 4.3.4, § 4.4, § 4.5)
    await run('écran et fiche', () => withRepo(async (repo, db) => {
      const IC = await import('../src/ui/import-cible.js');
      const W = await import('../src/ui/import-web.js');
      const V = await import('../src/ui/vol.js');
      const { renderRecipe, blocSignet } = await import('../src/ui/recipe.js');
      V.reinitialiserVol(); W.reinitialiserLectureWeb();
      const [srcRecette, srcEn, srcWeb, srcVol, srcDomaine] = await Promise.all(['../src/ui/recipe.js', '../src/i18n/en.js', '../src/ui/import-web.js', '../src/ui/vol.js', '../src/domain/lecture-web.js'].map(lire)); // lus AVANT de couper le réseau
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
      try {
        const NOW = '2026-10-19T12:00:00.000Z'; const DATE = '2026-10-19T00:00:00.000Z';
        const SESSION = { access_token: 'jeton-ecran-web-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
        const signet = (id, url, over = {}) => ({ id, edition_id: null, original_title: 'ricardocuisine.com', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: url, source_label: 'x', created_at: DATE, updated_at: DATE, ...over });
        const versionDe = (id, recipe_id, provenance, over = {}) => ({ id, recipe_id, kind: 'extraction', status: null, servings: 4, ingredients: [{ id: 'ri_' + id, source_text: '1 pomme', name_text: 'pomme', verification_state: 'verified' }], steps: [{ id: 'st_' + id, position: 1, text: 'Cuire.' }], provenance, verification_state: 'to_verify', created_at: DATE, updated_at: DATE, ...over });
        const fiches = ['rc_e1', 'rc_e2', 'rc_e3', 'rc_e4', 'rc_e5', 'rc_e6', 'rc_e7', 'rc_e8', 'rc_e9', 'rc_f1', 'rc_f2', 'rc_f3', 'rc_f4', 'rc_f5'].map((id) => signet(id, `https://ricardocuisine.com/${id}`));
        fiches.push(signet('rc_http', 'http://ricardocuisine.com/h'), signet('rc_hostile', 'javascript:alert(1)'),
          signet('rc_main', 'https://ricardocuisine.com/main', { availability: 'available', verification_state: 'verified', current_version_id: 'rv_main', original_title: 'Pâtes de Mamie' }),
          signet('rc_ia', 'https://ricardocuisine.com/ia', { availability: 'available', verification_state: 'to_verify', current_version_id: 'rv_ia', original_title: 'Pâtes lues' }),
          signet('rc_corr', 'https://ricardocuisine.com/corr', { availability: 'available', verification_state: 'to_verify', current_version_id: 'rv_corr', original_title: 'Pâtes corrigées' }),
          signet('rc_rep', 'https://ricardocuisine.com/rep', { web_reperes: { presentation: '<b>Un classique</b> du garde-manger.', temps_min: 30, difficulte: 'facile', ingredients: 7 } }));
        const versions = [versionDe('rv_main', 'rc_main', { generated_by: 'manual' }, { verification_state: 'verified' }),
          versionDe('rv_ia', 'rc_ia', { generated_by: 'ai', source_url: 'https://ricardocuisine.com/ia', url_finale: 'https://www.ricardocuisine.com/ia', source_kind: 'jsonld', lue_le: DATE, auteur: 'Auteur Ancien', site: 'Ricardo', import_id: 'imp_ancien' }),
          versionDe('rv_corr', 'rc_corr', { generated_by: 'ai' }, { kind: 'correction' })];
        await db.mutate({ puts: { recipes: fiches, recipe_versions: versions }, origin: 'device' });
        const ctxDe = async (session = SESSION) => {
          const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
          return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])), editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(), imports: await db.getAll('imports'), settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' }, sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } }, conventionFor: () => null,
            dishesById: new Map(), cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: [], ingredientsById: new Map(), dishes: [], source_documents: [], source_pages: [], rediscovery_prefs: [], docsByRecipe: new Map(), scan_sessions: [] };
        };
        const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
        const PAGE = { url_finale: 'https://www.ricardocuisine.com/r', hote: 'evil.test', titre_page: 'P', auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: NOW, autres_recettes: 0, texte_coupe: false };
        const RECETTE = { title: 'Pâtes puttanesca', servings: 4, prep_minutes: 20, cook_minutes: 60, total_minutes: 80, ingredients: ['250 g de spaghettis', '30 ml d’huile', '2 gousses d’ail', '1 boîte de tomates', '60 ml d’olives', '15 ml de câpres', '4 filets d’anchois'].map((x, i) => ({ source_text: x, uncertain: i === 2 })), steps: [{ text: 'Cuire.' }, { text: 'Chauffer.' }, { text: 'Ajouter.\nRemuer.' }, { text: 'Servir.' }], notes: 'Un classique.', incomplete: false };
        const ld = (page = {}, recette = {}) => ({ source_kind: 'jsonld', page: { ...PAGE, ...page }, recette: { ...RECETTE, ...recette }, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null });
        const fauxFetch = (auto = null) => {
          const a = { appels: [], rendre: [] };
          a.fetch = (url, options) => new Promise((resolve, reject) => {
            a.appels.push({ url, options });
            const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
            if (options?.signal?.aborted) { abandon(); return; }
            options?.signal?.addEventListener('abort', abandon, { once: true });
            const fin = (st, c) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(st, c)); };
            if (auto) fin(auto[0], auto[1]); else a.rendre.push(fin);
          });
          return a;
        };
        const navs = []; const dits = []; const choix = { suivant: [], appels: 0, vus: [] };
        const choisir = async (message, options) => {
          choix.appels += 1; choix.vus.push({ message, options: (options || []).map((o) => [o.value, o.label]) });
          const r = choix.suivant.length ? choix.suivant.shift() : null;
          return typeof r === 'function' ? r(message, options) : r;
        };
        const parLibelle = (libelle) => (message, options) => options.find((o) => o.label === libelle)?.value ?? null; // le choix d'une personne : ce qu'elle LIT
        let enLigneTest = true;
        const gestes = (deps = {}) => ({ repo, navigate: (x) => navs.push(x), toast: (m) => dits.push(m), fetch: async () => { throw new Error('aucun fetch attendu'); }, maintenant: () => NOW, enLigne: () => enLigneTest, choisir, ...deps });
        const monter = async (id, { session = SESSION, deps = {} } = {}) => { const root = await IC.renderImportCible({ id }, {}, await ctxDe(session), gestes(deps)); scene.append(root); return root; };
        const bouton = (root, texte) => [...root.querySelectorAll('button')].find((b) => b.textContent === texte) || null;
        const lien = (root, texte) => [...root.querySelectorAll('a')].find((a) => a.textContent === texte) || null;
        const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
        // Ronde 1 : la même attente, qui REND son verdict au lieu de lever — l'assertion qui suit le dit (un rouge nommé, jamais un bloc interrompu).
        const fini = async (cond) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } return false; };
        const ligneDe = async (recipeId) => (await db.byIndex('imports', 'recipe_id', recipeId)).find((i) => !['enregistre', 'ignore'].includes(i.status)) || null;
        const LW = await import('../src/domain/lecture-web.js');
        const importWeb = (id, recipeId, sur = {}) => ({ ...LW.fabriquerImportWeb({ id, signet: { id: recipeId }, deviceId: repo.deviceId() }), created_at: NOW, updated_at: NOW, ...sur }); // forme § 3.1
        const lireEtAttendre = async (root, ff, corps, recipeId) => { bouton(root, 'Lire la recette avec l’assistant').click(); await attendre(() => ff.appels.length > 0, 'POST parti'); ff.rendre.at(-1)(200, corps); await attendre(async () => (await ligneDe(recipeId))?.status === 'a_verifier' && root.etatRouteWeb().status === 'a_verifier', 'lecture reçue et rendue'); };

        // --- Ouverture
        let root = await monter('rc_e1');
        eq([root.textContent.includes('Lire une recette web'), bouton(root, 'Choisir des photos'), lien(root, 'Ouvrir le lien')?.getAttribute('href'), root.querySelector('[data-role="hote"]').textContent, root.etatRouteWeb()], [true, null, 'https://ricardocuisine.com/rc_e1', 'ricardocuisine.com', { importId: null, status: null, vol: false, remplacement: null }], 'écran : la route d’un signet ouvre la variante web — aucun « Choisir des photos », « Ouvrir le lien », sous-titre = hôte recalculé');
        eq([bouton(root, 'Lire la recette avec l’assistant').disabled, root.textContent.includes('Une lecture = un appel à l’assistant, compté dans ton quota du jour.'), await db.count('imports'), root.querySelector('[data-role="remplacement"]')], [false, true, 0, null], 'écran : « Lire la recette avec l’assistant » allumé ; la phrase du quota ; rien d’écrit à l’ouverture ; un signet jamais lu (aucune version) ne dit rien d’un remplacement (vague finale)');
        root = await monter('rc_e1', { session: null });
        eq([root.querySelector('[data-role="connexion-ia"]')?.textContent.includes('Connecte-toi pour utiliser l’assistant.'), bouton(root, 'Lire la recette avec l’assistant').disabled, reseau], [true, true, 0], 'écran : sans session → carte « Connecte-toi », bouton éteint, zéro POST');
        root = await monter('rc_http');
        eq([bouton(root, 'Lire la recette avec l’assistant').disabled, root.querySelector('[data-role="interdit"]')?.textContent, await db.count('imports')], [true, 'Cette adresse ne peut pas être lue par l’assistant : seule une page publique en https est admise. Ouvre-la toi-même.', 0], 'écran (B-20) : signet en http: → bouton éteint, texte interdit, zéro écriture');
        eq(lien(root, 'Ouvrir le lien')?.getAttribute('rel'), 'noopener noreferrer', 'écran (I-B5, ronde 1) : « Ouvrir le lien » de l’écran porte rel="noopener noreferrer"');
        // Ronde 1 (I-B3) : un vol PHOTO tient le document (vol.js) → « Lire la recette avec l’assistant » éteint.
        const tenuePhoto = { importId: 'imp_photo_r1', controller: new AbortController(), repo };
        V.prendreVol(tenuePhoto);
        try { root = await monter('rc_e1'); eq(bouton(root, 'Lire la recette avec l’assistant').disabled, true, 'écran (I-B3, ronde 1) : un vol photo tient le document → bouton de lecture éteint'); }
        finally { V.libererVol(tenuePhoto); }
        // Ronde 1 (abonnement, comme l'écran du lot A) : abonnée une fois MONTÉE ; montée puis retirée SANS notification entre les deux, la racine se
        // désabonne à la première notification qui la trouve détachée (la fuite ne grandit pas à chaque visite).
        await new Promise((r) => setTimeout(r, 0)); // les abonnements en attente des montages précédents sont pris
        window.dispatchEvent(new Event('online')); // les racines détachées des cas précédents se désabonnent ici
        const abonnes0 = W.abonnesLecture();
        const passage = await monter('rc_e1');
        const abonneMonte = await fini(() => W.abonnesLecture() === abonnes0 + 1);
        passage.remove();
        window.dispatchEvent(new Event('online'));
        eq([abonneMonte, W.abonnesLecture()], [true, abonnes0], 'écran (ronde 1) : abonnée une fois montée ; montée puis retirée sans notification → désabonnée à la notification suivante');
        // Ronde 1 (rattrapage après montage, lot A import-cible.js) : une transition notifiée PENDANT le rendu, avant que le routeur insère la racine (au
        // tour même de la fin de la route, app.js), est redessinée une fois la racine montée — « Ignorer » d'un autre onglet ne laisse pas « Enregistrer » figé.
        // L'autre onglet agit juste après la lecture de la ligne par l'écran (repo espion : la ligne relue est déjà périmée).
        await db.mutate({ puts: { recipes: [signet('rc_r1', 'https://ricardocuisine.com/rc_r1')], imports: [importWeb('imp_r1', 'rc_r1', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: LW.relireResultat(ld()) })] }, origin: 'device' });
        let pendantRendu = false;
        const ignoreApresLecture = { ...repo, byIndex: async (store, index, valeur) => {
          const lus = await repo.byIndex(store, index, valeur);
          if (!pendantRendu && store === 'imports') { pendantRendu = true; await repo.transitionner('imports', 'imp_r1', { attendus: ['a_verifier'], patch: { status: 'ignore' } }); window.dispatchEvent(new Event('online')); }
          return lus;
        } };
        const avantMontage = await IC.renderImportCible({ id: 'rc_r1' }, {}, await ctxDe(), gestes({ repo: ignoreApresLecture }));
        scene.append(avantMontage); // comme le routeur : au même tour que la fin de la route
        const figee = avantMontage.etatRouteWeb().status;
        eq([figee, await fini(() => avantMontage.etatRouteWeb().status === null), !!avantMontage.querySelector('[data-role="lire-web"]')], ['a_verifier', true, true], 'écran (ronde 1, rattrapage) : une transition notifiée pendant le rendu (ligne relue déjà périmée) est redessinée après le montage — l’écran offre la lecture, plus « Enregistrer »');
        avantMontage.remove();

        // --- Lire : vol, puis aperçu
        let ff = fauxFetch();
        root = await monter('rc_e1', { deps: { fetch: ff.fetch } });
        bouton(root, 'Lire la recette avec l’assistant').click();
        await attendre(() => ff.appels.length === 1 && !!bouton(root, 'Annuler'), 'vol affiché');
        const statut = root.querySelector('.status[role="status"]');
        eq([statut?.textContent, statut?.nextElementSibling?.classList.contains('row'), !!statut?.nextElementSibling?.querySelector('button[data-role="annuler"]'), root.etatRouteWeb().vol], ['Lecture de la page par l’assistant…', true, true, true], 'écran : pendant le vol, .status[role=status] puis une .row avec « Annuler » (R-VIS-8)');
        await db.mutate({ puts: { imports: [importWeb('imp_ailleurs', 'rc_e7', { status: 'en_cours', document_id_vol: 'un-autre-document', appels: 1, started_at: NOW, battement_at: NOW })] }, origin: 'device' });
        const ailleurs = await monter('rc_e7');
        eq([ailleurs.textContent.includes('En cours sur un autre écran'), bouton(ailleurs, 'Annuler'), ailleurs.etatRouteWeb().vol], [true, null, false], 'écran : en_cours tenu par un autre document → « En cours sur un autre écran », sans « Annuler » (I-B3)');
        ailleurs.remove();
        ff.rendre[0](200, ld({ autres_recettes: 1 }));
        await attendre(async () => (await ligneDe('rc_e1'))?.status === 'a_verifier', 'a_verifier écrit');
        root = await monter('rc_e1');
        const txt = root.textContent;
        eq([root.querySelector('[data-role="bandeau-web"]').textContent, root.querySelector('[data-role="selon-la-page"]').textContent.startsWith('Selon la page : Ricardo Cuisine · Ricardo · '), root.querySelector('[data-role="mode"]').textContent], ['Lue sur www.ricardocuisine.com — vérifie avant d’enregistrer.', true, 'Lue dans les données de la page : aucun jeton dépensé.'], 'aperçu : « Lue sur {hôte} — vérifie… » (un page.hote STOCKÉ menteur : cas de la ronde 1 plus bas), « Selon la page : Site · Auteur · {d} », « Lue dans les données… » (B-4)');
        eq([root.querySelectorAll('ul.list.plain li').length, root.querySelectorAll('ol.list.steps li').length, root.querySelector('[data-role="portions-temps"]').textContent, [...root.querySelectorAll('ul.list.plain li')].map((li) => !!li.querySelector('.chip.warn'))], [7, 4, '4 portions · préparation 20 min · cuisson 60 min · total 80 min', [false, false, true, false, false, false, false]], 'aperçu : 7 lignes, 4 étapes, « total 80 min » (B-8), la puce « incertain » sur la ligne incertaine seulement');
        eq([root.querySelector('[data-role="titre-lu"]')?.textContent, txt.includes('D’autres recettes étaient sur cette page : ouvre-la.'), txt.includes('La page était longue')], ['Titre lu : Pâtes puttanesca — ce sera le titre de la fiche.', true, false], 'aperçu : « Titre lu : … — ce sera le titre de la fiche. » (première lecture, titre différent, D-B24) ; « D’autres recettes… » (autres_recettes > 0) ; pas de « La page était longue » sans coupe');
        eq([bouton(root, 'Enregistrer')?.classList.contains('primary'), !!bouton(root, 'Relire la page'), !!bouton(root, 'Ignorer'), txt.includes('Toutes les lignes restent à vérifier : « Corriger » sur la fiche.')], [true, true, true, true], 'aperçu : « Enregistrer » (primaire), « Relire la page », « Ignorer », et la phrase « Toutes les lignes restent à vérifier »');

        // --- Enregistrer (première lecture) : UNE transaction, fiche recomposée, navigation et toast.
        const appels = []; const mutate = db.mutate.bind(db);
        db.mutate = (o) => { appels.push(Object.keys(o.puts || {}).concat(Object.keys(o.conditions || {})).sort()); return mutate(o); };
        try { bouton(root, 'Enregistrer').click(); await attendre(() => navs.length > 0, 'navigation'); } finally { db.mutate = mutate; }
        const e1 = await db.get('recipes', 'rc_e1'); const v1 = await db.get('recipe_versions', e1.current_version_id); const i1 = (await db.byIndex('imports', 'recipe_id', 'rc_e1'))[0];
        eq(appels, [['imports', 'recipe_versions', 'recipes']], 'Enregistrer : UNE transaction — la condition sur imports (a_verifier → enregistre), les puts recipes et recipe_versions');
        eq([e1.availability, e1.verification_state, e1.original_title, e1.source_author, e1.source_site, e1.source_fetched_at, e1.source_kind, e1.source_url], ['available', 'to_verify', 'Pâtes puttanesca', 'Ricardo', 'Ricardo Cuisine', NOW, 'jsonld', 'https://ricardocuisine.com/rc_e1'], 'Enregistrer : fiche available, to_verify, titre lu (D-B24), source_* ; source_url du signet jamais retapée depuis url_finale');
        eq([v1.kind, v1.provenance.url_finale, v1.provenance.titre_signet, i1.status, i1.reponse_brute, i1.finished_at, navs.at(-1), dits.at(-1)], ['extraction', 'https://www.ricardocuisine.com/r', 'ricardocuisine.com', 'enregistre', null, NOW, `/recipes/rc_e1?v=${v1.id}`, 'Recette enregistrée'], 'Enregistrer : version et provenance, import enregistre (reponse_brute null, finished_at), navigation vers la version, toast « Recette enregistrée »');

        // --- La fiche après « Enregistrer » : bandeau web (hôte réel d'abord, S-2), « Ouvrir le lien » dans les actions, « Relire la page avec l’assistant ».
        let fiche = await renderRecipe({ id: 'rc_e1' }, { v: v1.id }, await ctxDe(), gestes()); scene.append(fiche);
        const bw = fiche.querySelector('[data-role="bandeau-web"]');
        eq([bw?.firstChild.textContent.startsWith('Lue sur www.ricardocuisine.com le '), bw?.firstChild.textContent.endsWith(' · données de la page — vérifie.'), bw?.querySelector('[data-role="selon-la-page"]')?.textContent], [true, true, 'Selon la page : Ricardo Cuisine · Ricardo'], 'fiche : « Lue sur {hôte réel} le {d} · données de la page — vérifie. » puis « Selon la page : Site · Auteur » (S-2 ; mutant « site à la place de l’hôte » : rouge)');
        eq([fiche.querySelector('[data-role="ouvrir-lien"]')?.getAttribute('href'), fiche.querySelector('[data-role="ouvrir-lien"]')?.getAttribute('rel'), !!fiche.querySelector('[data-role="relire-web"]')], ['https://ricardocuisine.com/rc_e1', 'noopener noreferrer', true], 'fiche (I-B5, D-B18) : « Ouvrir le lien » dans les actions d’une fiche lue, et « Relire la page avec l’assistant »');
        fiche.remove();
        fiche = await renderRecipe({ id: 'rc_e1' }, {}, await ctxDe(null), gestes()); scene.append(fiche);
        eq([!!fiche.querySelector('[data-role="relire-web"]'), !!fiche.querySelector('[data-role="ouvrir-lien"]')], [false, true], 'fiche : sans session, « Relire la page avec l’assistant » est absent ; « Ouvrir le lien » reste');
        fiche.remove();
        fiche = await renderRecipe({ id: 'rc_corr' }, {}, await ctxDe(), gestes()); scene.append(fiche);
        eq([fiche.querySelector('[data-role="bandeau-web"]'), !!fiche.querySelector('[data-role="ouvrir-lien"]')], [null, true], 'fiche : aucun bandeau web sur une correction (la provenance de la version n’a pas d’adresse) ; « Ouvrir le lien » reste');
        fiche.remove();

        // --- Relecture d'une fiche déjà lue par l'assistant (D-B8) : pas de dialogue, nouvelle version courante, l'ancienne reste, titre conservé ;
        //     l'ANCIENNE version garde SON auteur (B-25).
        ff = fauxFetch();
        root = await monter('rc_ia', { deps: { fetch: ff.fetch } });
        eq([root.etatRouteWeb().remplacement, root.querySelector('[data-role="remplacement"]')?.textContent], [false, 'La lecture remplacera la version lue par l’assistant.'], 'relecture (B-14) : fiche lue par l’assistant → « La lecture remplacera la version lue par l’assistant. »');
        await lireEtAttendre(root, ff, ld({ auteur: 'Auteur Nouveau' }), 'rc_ia');
        eq(root.querySelector('[data-role="titre-lu"]')?.textContent, 'Titre lu : Pâtes puttanesca', 'relecture (D-B24) : « Titre lu : … » sans « ce sera le titre de la fiche » (la fiche garde le sien)');
        choix.appels = 0;
        bouton(root, 'Enregistrer').click();
        await attendre(async () => (await db.get('recipes', 'rc_ia')).current_version_id !== 'rv_ia', 'nouvelle version courante');
        const ia = await db.get('recipes', 'rc_ia');
        eq([choix.appels, ia.original_title, !!(await db.get('recipe_versions', 'rv_ia')), (await db.get('recipe_versions', ia.current_version_id)).parent_version_id, root.isConnected], [0, 'Pâtes lues', true, 'rv_ia', true], 'relecture : pas de dialogue, nouvelle version courante (parent = l’ancienne, qui reste), titre conservé');
        fiche = await renderRecipe({ id: 'rc_ia' }, { v: 'rv_ia' }, await ctxDe(), gestes()); scene.append(fiche);
        eq(fiche.querySelector('[data-role="selon-la-page"]')?.textContent, 'Selon la page : Ricardo · Auteur Ancien', 'fiche (B-25) : l’ANCIENNE version affichée (?v=) montre SON auteur, jamais celui de la fiche');
        fiche.remove();

        // --- Version humaine (D-B8, B-13, B-24) : dialogue ; fermé → rien ; « Ajouter sans remplacer » → aucun put recipes ; « Remplacer » → courante.
        root = await monter('rc_main', { deps: { fetch: (ff = fauxFetch()).fetch } });
        eq([root.etatRouteWeb().remplacement, root.querySelector('[data-role="remplacement"]')?.textContent], [true, 'Ta version écrite à la main n’est jamais remplacée sans question.'], 'remplacement (B-14) : une version écrite à la main → « Ta version écrite à la main n’est jamais remplacée sans question. »');
        await lireEtAttendre(root, ff, ld(), 'rc_main');
        const avantMain = await db.get('recipes', 'rc_main');
        choix.suivant.push(null);
        bouton(root, 'Enregistrer').click();
        await attendre(() => choix.appels > 0 && !!bouton(root, 'Enregistrer') && !bouton(root, 'Enregistrer').disabled, 'dialogue fermé');
        eq([(await ligneDe('rc_main')).status, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_main')).length, await db.get('recipes', 'rc_main')], ['a_verifier', 1, avantMain], 'remplacement (B-13) : dialogue fermé (null) → rien d’écrit, import a_verifier, écran inchangé');
        eq(choix.vus.at(-1), { message: 'Remplacer par cette lecture ?', options: [['ajouter', 'Ajouter sans remplacer'], ['remplacer', 'Remplacer']] }, 'remplacement (D-B8) : « Remplacer par cette lecture ? », options « Ajouter sans remplacer » (la première, présélectionnée : la sûre) puis « Remplacer »');
        choix.suivant.push(parLibelle('Ajouter sans remplacer'));
        const puts = []; db.mutate = (o) => { puts.push(Object.keys(o.puts || {}).sort()); return mutate(o); };
        try { bouton(root, 'Enregistrer').click(); await attendre(async () => (await db.byIndex('recipe_versions', 'recipe_id', 'rc_main')).length === 2, 'version ajoutée'); } finally { db.mutate = mutate; }
        const apresMain = await db.get('recipes', 'rc_main');
        eq([puts, apresMain.current_version_id, apresMain.updated_at, apresMain.source_kind], [[['recipe_versions']], 'rv_main', avantMain.updated_at, undefined], '« Ajouter sans remplacer » (B-24, F-3) : la version est écrite NON courante, aucun put recipes (seuls imports, en condition, et recipe_versions), updated_at de la fiche inchangé (mutant « remplacer: false ignoré » : rouge)');
        ff = fauxFetch();
        root = await monter('rc_main', { deps: { fetch: ff.fetch } });
        await lireEtAttendre(root, ff, ld(), 'rc_main');
        const avantCourse = await db.get('recipes', 'rc_main'); const idCourse = (await ligneDe('rc_main')).id;
        choix.suivant.push(async () => { await repo.transitionner('imports', idCourse, { attendus: ['a_verifier'], patch: { status: 'enregistre' } }); return 'remplacer'; }); // l'autre onglet, pendant la question
        const ditsCourse = dits.length;
        bouton(root, 'Enregistrer').click();
        await attendre(() => root.etatRouteWeb().status === null, 'redessiné');
        eq([(await db.byIndex('recipe_versions', 'recipe_id', 'rc_main')).length, await db.get('recipes', 'rc_main'), (await db.get('imports', idCourse)).status, dits.slice(ditsCourse)], [2, avantCourse, 'enregistre', []], 'Enregistrer (I-10, § 4.3.4) : un autre onglet enregistre PENDANT le dialogue → « Remplacer » n’écrit rien (aucune version de plus, fiche intacte), écran redessiné, rien n’est dit (un refus, jamais « …n’a pas pu être enregistrée »)');
        ff = fauxFetch();
        root = await monter('rc_main', { deps: { fetch: ff.fetch } });
        await lireEtAttendre(root, ff, ld(), 'rc_main');
        choix.suivant.push('remplacer');
        bouton(root, 'Enregistrer').click();
        await attendre(async () => (await db.get('recipes', 'rc_main')).current_version_id !== 'rv_main', 'remplacée');
        eq([(await db.get('recipes', 'rc_main')).source_kind, (await db.get('recipes', 'rc_main')).original_title], ['jsonld', 'Pâtes de Mamie'], '« Remplacer » : la lecture devient courante (titre conservé : la fiche avait déjà une version)');

        // --- Ronde 1 (§ 4.3.4, T4-R1-c du lot A) : la fiche et ses versions sont RELUES après le dialogue « Remplacer par cette lecture ? ».
        const avecMain = async (id) => {
          await db.mutate({ puts: { recipes: [signet(id, `https://ricardocuisine.com/${id}`, { availability: 'available', verification_state: 'verified', current_version_id: 'rv_' + id, original_title: 'Pâtes de Mamie' })], recipe_versions: [versionDe('rv_' + id, id, { generated_by: 'manual' }, { verification_state: 'verified' })], imports: [importWeb('imp_' + id, id, { status: 'a_verifier', appels: 1, started_at: NOW, resultat: LW.relireResultat(ld()) })] }, origin: 'device' });
          return 'imp_' + id;
        };
        const puisRepondre = (geste, reponse) => async () => { await geste(); return reponse; };
        let impK = await avecMain('rc_k1');
        let rK = await W.enregistrerLecture(impK, { repo, maintenant: () => NOW, choisir: puisRepondre(async () => { const f = await db.get('recipes', 'rc_k1'); await db.mutate({ puts: { recipes: [{ ...f, favorite: true, tags: ['ajoute-ailleurs'], cuisines: ['italienne'], updated_at: '2026-10-19T13:00:00.000Z' }] }, origin: 'remote' }); }, 'remplacer') });
        const k1 = await db.get('recipes', 'rc_k1');
        eq([rK.issue, k1.favorite, k1.tags, k1.cuisines, k1.current_version_id === rK.versionId], ['enregistre', true, ['ajoute-ailleurs'], ['italienne'], true], 'Enregistrer (ronde 1) : la fiche reçue modifiée PENDANT le dialogue (favori, mots-clés, cuisines) est relue après la réponse — ses champs survivent, la lecture devient courante');
        const supprimees = [];
        for (const [id, reponse] of [['rc_k2', 'remplacer'], ['rc_k3', 'ajouter']]) {
          impK = await avecMain(id);
          rK = await W.enregistrerLecture(impK, { repo, maintenant: () => NOW, choisir: puisRepondre(() => db.mutate({ deletes: { recipes: [id] }, origin: 'remote' }), reponse) });
          supprimees.push([rK, (await db.get('recipes', id)) ?? null, (await db.byIndex('recipe_versions', 'recipe_id', id)).length, (await db.get('imports', impK)).status]);
        }
        eq(supprimees, [[{ issue: 'refuse', raison: 'inconnu' }, null, 1, 'a_verifier'], [{ issue: 'refuse', raison: 'inconnu' }, null, 1, 'a_verifier']], 'Enregistrer (ronde 1, T4-R1-c du lot A) : la fiche supprimée PENDANT le dialogue → refus inconnu — « Remplacer » ne la ressuscite pas, « Ajouter sans remplacer » n’écrit aucune version orpheline ; l’import reste a_verifier');
        impK = await avecMain('rc_k5');
        let questions = 0;
        rK = await W.enregistrerLecture(impK, { repo, maintenant: () => NOW, choisir: async () => {
          questions += 1;
          if (questions > 1) return 'ajouter';
          const f = await db.get('recipes', 'rc_k5'); // pendant la première question, une autre version devient courante (reçue)
          await db.mutate({ puts: { recipe_versions: [versionDe('rv_k5b', 'rc_k5', { generated_by: 'manual' }, { kind: 'correction' })], recipes: [{ ...f, current_version_id: 'rv_k5b', updated_at: '2026-10-19T13:00:00.000Z' }] }, origin: 'remote' });
          return 'remplacer';
        } });
        eq([questions, rK.issue, (await db.get('recipes', 'rc_k5')).current_version_id, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_k5')).length], [2, 'enregistre', 'rv_k5b', 3], 'Enregistrer (ronde 1) : une autre version devenue courante PENDANT le dialogue → la question est reposée ; la seconde réponse (« Ajouter sans remplacer ») vaut, la courante reçue reste');
        // Une AUTRE lecture écrite pendant la question (un autre onglet a relu : autre départ, autre résultat) → « Remplacer » n'enregistre pas une lecture
        // jamais affichée : la garde cleLecture de la clôture (§ 4.3.4), seule à l'arrêter ici.
        impK = await avecMain('rc_k4');
        root = await monter('rc_k4');
        choix.suivant.push(async () => { await repo.transitionner('imports', impK, { attendus: ['a_verifier'], patch: { started_at: '2026-10-19T12:30:00.000Z', resultat: LW.relireResultat(ld({}, { title: 'Lecture jamais vue' })) } }); return 'remplacer'; });
        bouton(root, 'Enregistrer').click();
        const vueK4 = await fini(() => (root.querySelector('[data-role="titre-lu"]')?.textContent || '').includes('Lecture jamais vue'));
        const k4 = await db.get('recipes', 'rc_k4');
        eq([vueK4, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_k4')).length, k4.current_version_id, (await db.get('imports', impK)).status], [true, 1, 'rv_rc_k4', 'a_verifier'], 'Enregistrer (§ 4.3.4, ronde 1) : une autre lecture écrite PENDANT le dialogue → « Remplacer » n’écrit rien (garde cleLecture de la clôture), la nouvelle reste a_verifier et l’écran la montre');
        root.remove();
        // Écran retiré avant la fin d'« Enregistrer » (pendant le dialogue) ou d'« Ignorer » : l'écriture a lieu, ni toast ni navigation (T4-R1-f du lot A).
        impK = await avecMain('rc_k6');
        const racine6 = await monter('rc_k6');
        const navs6 = navs.length; const dits6 = dits.length;
        choix.suivant.push(async () => { racine6.remove(); return 'remplacer'; });
        bouton(racine6, 'Enregistrer').click();
        const enregistre6 = await fini(async () => (await db.get('imports', impK)).status === 'enregistre');
        await db.mutate({ puts: { recipes: [signet('rc_k7', 'https://ricardocuisine.com/rc_k7')], imports: [importWeb('imp_rc_k7', 'rc_k7', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: LW.relireResultat(ld()) })] }, origin: 'device' });
        let racine7 = null;
        const retireAvant = { ...repo, transitionner: async (...a) => { racine7?.remove(); return repo.transitionner(...a); } };
        racine7 = await monter('rc_k7', { deps: { repo: retireAvant } });
        bouton(racine7, 'Ignorer').click();
        const ignore7 = await fini(async () => (await db.get('imports', 'imp_rc_k7')).status === 'ignore');
        eq([enregistre6, ignore7, navs.slice(navs6), dits.slice(dits6)], [true, true, [], []], 'écran retiré avant la fin (ronde 1) : « Enregistrer » et « Ignorer » écrivent, sans toast ni navigation sur un écran démonté');

        // --- Annuler, Réessayer, Relire la page, Ignorer
        ff = fauxFetch();
        root = await monter('rc_e2', { deps: { fetch: ff.fetch } });
        bouton(root, 'Lire la recette avec l’assistant').click();
        await attendre(() => ff.appels.length === 1 && !!bouton(root, 'Annuler'), 'vol');
        bouton(root, 'Annuler').click();
        await attendre(async () => (await ligneDe('rc_e2'))?.status === 'echec' && root.etatRouteWeb().status === 'echec', 'echec(annule) rendu');
        eq([ff.appels[0].options.signal.aborted, root.querySelector('[data-role="echec"]').textContent, root.querySelector('[data-role="action"] a')?.classList.contains('primary'), !!bouton(root, 'Réessayer'), !!bouton(root, 'Ignorer'), !!lien(root, 'Retour à la fiche')], [true, 'Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.', true, true, true, true], 'Annuler : fetch abandonné, echec(annule), texte I-B7 ; « Ouvrir le lien » (primaire), « Réessayer », « Ignorer », « Retour à la fiche »');
        bouton(root, 'Réessayer').click();
        await attendre(() => ff.appels.length === 2, 'un POST de plus');
        eq((await ligneDe('rc_e2')).status, 'en_cours', '« Réessayer » : echec → en_cours, un POST');
        ff.rendre[1](200, ld());
        await attendre(async () => root.etatRouteWeb().status === 'a_verifier', 'lue');
        bouton(root, 'Relire la page').click();
        await attendre(() => ff.appels.length === 3, 'relecture');
        eq([(await ligneDe('rc_e2')).status, (await ligneDe('rc_e2')).appels], ['en_cours', 3], '« Relire la page » : a_verifier → en_cours en UNE transition (depuis T4-R1), un POST');
        ff.rendre[2](200, ld());
        await attendre(async () => root.etatRouteWeb().status === 'a_verifier', 'relue');
        const navsAvant = navs.length;
        bouton(root, 'Ignorer').click();
        await attendre(() => navs.length > navsAvant, 'retour');
        eq([(await db.byIndex('imports', 'recipe_id', 'rc_e2'))[0].status, navs.at(-1), (await db.get('recipes', 'rc_e2')).availability], ['ignore', '/recipes/rc_e2', 'reference_only'], '« Ignorer » : ignore, retour à la fiche, le signet reste un lien (I-B9)');
        // Ronde 1 (P-12) : « Relire la page » vaut pour LA lecture affichée — une autre lecture arrivée d'un autre onglet entre le rendu et la tape n'est
        // pas effacée sans avoir été vue : rien d'écrit, aucun POST, l'écran la montre.
        await db.mutate({ puts: { recipes: [signet('rc_rel', 'https://ricardocuisine.com/rc_rel')], imports: [importWeb('imp_rel', 'rc_rel', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: LW.relireResultat(ld()) })] }, origin: 'device' });
        ff = fauxFetch();
        root = await monter('rc_rel', { deps: { fetch: ff.fetch } });
        await repo.transitionner('imports', 'imp_rel', { attendus: ['a_verifier'], patch: { started_at: '2026-10-19T12:40:00.000Z', resultat: LW.relireResultat(ld({}, { title: 'Lecture d’un autre onglet' })) } });
        bouton(root, 'Relire la page').click();
        const vueRel = await fini(() => (root.querySelector('[data-role="titre-lu"]')?.textContent || '').includes('Lecture d’un autre onglet'));
        const rel = await db.get('imports', 'imp_rel');
        eq([vueRel, ff.appels.length, rel.status, rel.resultat?.recette?.title], [true, 0, 'a_verifier', 'Lecture d’un autre onglet'], '« Relire la page » (P-12, ronde 1) : une autre lecture arrivée entre le rendu et la tape → rien d’écrit, aucun POST, l’écran montre la nouvelle');
        for (const r of ff.rendre) r(200, ld());
        await fini(() => !V.volEnCours());
        root.remove();
        // Vague finale : « Ignorer » depuis la zone d'ÉCHEC (echec → ignore), pas seulement depuis l'aperçu — retour à la fiche, le signet reste un lien.
        await db.mutate({ puts: { recipes: [signet('rc_ign', 'https://ricardocuisine.com/rc_ign')], imports: [importWeb('imp_ign', 'rc_ign', { status: 'echec', appels: 1, erreur: { raison: 'inaccessible', extra: {} } })] }, origin: 'device' });
        root = await monter('rc_ign');
        const navsIgn = navs.length;
        root.querySelector('[data-role="echec"]')?.closest('[data-role="action"]')?.querySelector('[data-role="ignorer"]')?.click();
        const ignoreEchec = await fini(() => navs.length > navsIgn);
        eq([ignoreEchec, (await db.get('imports', 'imp_ign')).status, navs.at(-1), (await db.get('recipes', 'rc_ign')).availability], [true, 'ignore', '/recipes/rc_ign', 'reference_only'], '« Ignorer » depuis la zone d’échec (vague finale) : echec → ignore, retour à la fiche, le signet reste un lien');
        root.remove();

        // --- Vague finale (VF-15 du lot A transposé) : une ligne en_cours de CET appareil dont le document est mort (onglet rechargé, PWA tuée puis
        //     rouverte) n'attend plus un redémarrage : la passe `interrompu` (repo.marquerInterrompus, horloge de l'écran) est rejouée à l'affichage,
        //     puis toutes les BATTEMENT_MORT_MS + 1 s (veilleMs injecté) tant que l'écran est monté et que la ligne vole ailleurs.
        const vieux = new Date(Date.parse(NOW) - 120000).toISOString();
        await db.mutate({ puts: { recipes: [signet('rc_mort', 'https://ricardocuisine.com/rc_mort'), signet('rc_mort2', 'https://ricardocuisine.com/rc_mort2')], imports: [importWeb('imp_mort', 'rc_mort', { status: 'en_cours', document_id_vol: 'document-mort', appels: 1, started_at: vieux, battement_at: vieux })] }, origin: 'device' });
        root = await monter('rc_mort');
        const leveMort = await fini(async () => (await db.get('imports', 'imp_mort')).status === 'echec' && root.etatRouteWeb().status === 'echec');
        eq([leveMort, (await db.get('imports', 'imp_mort')).erreur, root.querySelector('[data-role="echec"]')?.textContent, !!bouton(root, 'Réessayer'), root.textContent.includes('En cours sur un autre écran')], [true, { raison: 'interrompu', extra: {} }, 'La lecture a été interrompue. L’appel a peut-être été compté ; relancer en coûtera un autre.', true, false], 'écran web (vague finale, VF-15) : une lecture en_cours de CET appareil au battement mort (120 s, aucune ligne battement:<id>) est levée dès l’affichage — echec(interrompu), texte I-B7, « Réessayer » ; plus de « En cours sur un autre écran » sans geste');
        root.remove();
        await db.mutate({ puts: { imports: [importWeb('imp_mort2', 'rc_mort2', { status: 'en_cours', document_id_vol: 'document-mort', appels: 1, started_at: vieux, battement_at: new Date(Date.parse(NOW) - 30000).toISOString() })] }, origin: 'device' });
        let passes = 0; // espion : les passes réellement jouées (une ligne vivante n'est jamais levée, quel que soit leur nombre)
        const repoVeille = { ...repo, marquerInterrompus: (m) => { passes += 1; return repo.marquerInterrompus(m); } };
        root = await monter('rc_mort2', { deps: { repo: repoVeille, veilleMs: 40 } });
        const plusieursPasses = await fini(() => passes >= 3);
        const attendMort2 = [plusieursPasses, (await db.get('imports', 'imp_mort2')).status, root.textContent.includes('En cours sur un autre écran')];
        await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'imp_mort2')), battement_at: vieux }] }, origin: 'device' }); // le temps passe : plus aucun battement
        const leveMort2 = await fini(async () => (await db.get('imports', 'imp_mort2')).status === 'echec' && root.etatRouteWeb().status === 'echec' && !!bouton(root, 'Réessayer'));
        const passesALaLevee = passes;
        await new Promise((r) => setTimeout(r, 200));
        eq([...attendMort2, leveMort2, (await db.get('imports', 'imp_mort2')).erreur, passes === passesALaLevee], [true, 'en_cours', true, true, { raison: 'interrompu', extra: {} }, true], 'écran web (vague finale, VF-15) : battement de 30 s à l’affichage → la ligne attend (« En cours sur un autre écran »), même après plusieurs passes ; la VEILLE rejoue la passe tant que l’écran est monté — levée sans quitter l’écran, « Réessayer » — puis s’arrête (plus aucune passe une fois la ligne levée)');
        root.remove();

        // --- Hors ligne après le rendu : bouton éteint, « Tu es hors ligne. », zéro POST.
        ff = fauxFetch();
        root = await monter('rc_e3', { deps: { fetch: ff.fetch } });
        enLigneTest = false; window.dispatchEvent(new Event('offline'));
        await attendre(() => bouton(root, 'Lire la recette avec l’assistant')?.disabled === true, 'bouton éteint');
        eq([root.querySelector('[data-role="hors-ligne"]')?.textContent, ff.appels.length], ['Tu es hors ligne.', 0], 'hors ligne (événement après le rendu) : bouton éteint (attendu ci-dessus), « Tu es hors ligne. », aucun POST parti');
        enLigneTest = true; window.dispatchEvent(new Event('online'));

        // --- Un résultat hostile revenu du journal est REVALIDÉ au montage → echec(illisible), jamais rendu (I-B2).
        await db.mutate({ puts: { imports: [importWeb('imp_hostile', 'rc_e4', { status: 'a_verifier', appels: 1, resultat: { source_kind: 'jsonld', page: PAGE, recette: { title: 'x'.repeat(500), ingredients: [], steps: [] } } })] }, origin: 'device' });
        root = await monter('rc_e4');
        eq([(await db.get('imports', 'imp_hostile')).status, (await db.get('imports', 'imp_hostile')).erreur?.raison, root.querySelector('[data-role="echec"] small')?.textContent], ['echec', 'illisible', 'Code : illisible'], 'revalidation : un resultat hostile → echec(illisible), rendu comme un échec');

        // --- Relecture préalable d'« Enregistrer » (statut) : l'import a été ignoré par un autre onglet AVANT la tape → refus `statut`, rien d'écrit, redessin.
        ff = fauxFetch();
        root = await monter('rc_e5', { deps: { fetch: ff.fetch } });
        await lireEtAttendre(root, ff, ld(), 'rc_e5');
        await repo.transitionner('imports', (await ligneDe('rc_e5')).id, { attendus: ['a_verifier'], patch: { status: 'ignore' } });
        bouton(root, 'Enregistrer').click();
        await attendre(() => root.etatRouteWeb().status === null, 'redessiné');
        eq([(await db.get('recipes', 'rc_e5')).availability, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_e5')).length], ['reference_only', 0], 'Enregistrer, relecture préalable (statut) : import déjà ignoré (un autre onglet) avant la tape → rien d’écrit, écran redessiné');
        // Ronde 1 : la TRANSACTION elle-même (attendus a_verifier, I-10) — un autre onglet ignore la ligne ENTRE la relecture et l'écriture (même lecture,
        // même clé : seule la condition de statut l'arrête) → TransitionRefusee, refus `transition`, rien d'écrit.
        await db.mutate({ puts: { recipes: [signet('rc_tx', 'https://ricardocuisine.com/rc_tx')], imports: [importWeb('imp_tx', 'rc_tx', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: LW.relireResultat(ld()) })] }, origin: 'device' });
        const ignoreEntreDeux = { ...repo, transitionner: async (store, key, opts) => { if (store === 'imports' && opts?.puts?.recipe_versions) await repo.transitionner('imports', key, { attendus: ['a_verifier'], patch: { status: 'ignore' } }); return repo.transitionner(store, key, opts); } };
        const rTx = await W.enregistrerLecture('imp_tx', { repo: ignoreEntreDeux, maintenant: () => NOW, choisir });
        eq([rTx, (await db.get('imports', 'imp_tx')).status, (await db.get('recipes', 'rc_tx')).availability, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_tx')).length], [{ issue: 'refuse', raison: 'transition' }, 'ignore', 'reference_only', 0], 'Enregistrer, la transaction (I-10, ronde 1) : ligne ignorée entre la relecture et l’écriture → refus transition, ni fiche ni version écrite');
        // Ronde 1 : un modèle VIDE reçu vaut null dans la provenance (une seule définition du modèle borné, comme le chemin photo du lot A).
        await db.mutate({ puts: { recipes: [signet('rc_mod', 'https://ricardocuisine.com/rc_mod')], imports: [importWeb('imp_mod', 'rc_mod', { status: 'a_verifier', appels: 1, started_at: NOW, model: '', resultat: LW.relireResultat(ld()) })] }, origin: 'device' });
        const rMod = await W.enregistrerLecture('imp_mod', { repo, maintenant: () => NOW, choisir });
        eq([rMod.issue, (await db.get('recipe_versions', rMod.versionId))?.provenance?.model], ['enregistre', null], 'Enregistrer (ronde 1) : un modèle vide reçu vaut null dans la provenance de la version');

        // --- Lecture par le MODÈLE (B-4 : ce que la lecture a coûté se dit) : ni site ni auteur → « Lue le … » ; lecture incomplète ; une adresse dans
        //     une ligne retirée et dite (R-B-2) ; « Notes » ; puis la fiche dit « texte lu par l’assistant ».
        ff = fauxFetch();
        root = await monter('rc_e9', { deps: { fetch: ff.fetch } });
        const MODELE = { ...RECETTE, incomplete: true, ingredients: [{ source_text: '250 g de spaghettis (voir https://evil.test/x)', uncertain: false }, ...RECETTE.ingredients.slice(1)] };
        await lireEtAttendre(root, ff, { source_kind: 'modele', page: { ...PAGE, auteur: null, site: null }, recette: JSON.stringify(MODELE), usage: { input_tokens: 10, output_tokens: 20 }, stop_reason: 'end_turn', model: 'claude-x' }, 'rc_e9');
        const notes = [...root.querySelectorAll('h2, h3')].find((h) => h.textContent === 'Notes');
        eq([root.querySelector('[data-role="mode"]')?.textContent, root.querySelector('[data-role="selon-la-page"]')?.textContent.startsWith('Lue le '), [...root.querySelectorAll('.chip.warn')].some((c) => c.textContent === 'lecture incomplète'), root.querySelector('[data-role="incertain"]')?.textContent, root.querySelector('ul.list.plain li')?.firstChild?.textContent, !!notes, root.textContent.includes('Un classique.')],
          ['Texte de la page lu par l’assistant.', true, true, 'Incertain : adresse retirée dans la ligne 1', '250 g de spaghettis (voir [adresse retirée])', true, true], 'aperçu, lecture par le modèle : « Texte de la page lu par l’assistant. », « Lue le … » (ni site ni auteur), « lecture incomplète », « Incertain : adresse retirée dans la ligne 1 » et le marqueur dans la ligne (R-B-2), « Notes »');
        const navsModele = navs.length;
        bouton(root, 'Enregistrer').click();
        await attendre(() => navs.length > navsModele, 'enregistrée');
        const e9 = await db.get('recipes', 'rc_e9');
        fiche = await renderRecipe({ id: 'rc_e9' }, { v: e9.current_version_id }, await ctxDe(), gestes()); scene.append(fiche);
        eq([e9.source_kind, e9.availability, fiche.querySelector('[data-role="bandeau-web"]')?.firstChild.textContent.endsWith(' · texte lu par l’assistant — vérifie.')], ['modele', 'partial', true], 'fiche d’une lecture par le modèle : source_kind modele, partial (lecture incomplète), « … · texte lu par l’assistant — vérifie. »');
        // Vague finale (§ 4.5) : sur une fiche lue sur le web, la bannière du lot A (« Lue par l’assistant le … · lecture incomplète ») COEXISTE avec le
        // bandeau web, et le bandeau web vient D'ABORD.
        const bandeauE9 = fiche.querySelector('[data-role="bandeau-web"]'); const banniereE9 = fiche.querySelector('[data-role="bandeau-lecture"]');
        eq([banniereE9?.querySelector('[data-role="ligne-lecture"]')?.textContent.startsWith('Lue par l’assistant le '), banniereE9?.textContent.includes('lecture incomplète'), !!(bandeauE9 && banniereE9 && (bandeauE9.compareDocumentPosition(banniereE9) & Node.DOCUMENT_POSITION_FOLLOWING))], [true, true, true], 'fiche (§ 4.5, vague finale) : la bannière du lot A est là (« Lue par l’assistant le … », « lecture incomplète ») et suit le bandeau web');
        fiche.remove();

        // --- Ronde 1 (I-B2, I-B5) : une lecture relue du journal telle qu'elle a été REÇUE (synchro, archive : rien n'est passé par relireResultat) —
        //     balisage dans le titre, une ligne, une étape, les notes, le site et l'auteur ; page.hote stocké menteur ; page coupée ; « Incertain » long.
        const BAL = '<img src=x onerror=alert(1)>';
        const recue = { source_kind: 'jsonld', page: { ...PAGE, url_finale: 'https://evil.test/r', hote: 'ricardocuisine.com', site: '<b>Site</b>', auteur: BAL + 'Ricardo', texte_coupe: true },
          recette: { ...RECETTE, title: '<i>Pâtes</i> <script>alert(1)</script>', ingredients: [{ source_text: '250 g ' + BAL + ' spaghettis', uncertain: false }, ...RECETTE.ingredients.slice(1)], steps: [{ text: 'Cuire <script>alert(2)</script>.' }, ...RECETTE.steps.slice(1)], notes: '<b>Bon</b> appétit', uncertain_fields: ['a', 'b', 'c'].map((x) => x.repeat(150)) } };
        await db.mutate({ puts: { recipes: [signet('rc_bal', 'https://ricardocuisine.com/rc_bal')], imports: [importWeb('imp_bal', 'rc_bal', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: recue })] }, origin: 'device' });
        root = await monter('rc_bal');
        const lecture = root.querySelector('[data-role="lecture"]');
        const bandeauBal = root.querySelector('[data-role="bandeau-web"]'); const selonBal = root.querySelector('[data-role="selon-la-page"]');
        eq([root.etatRouteWeb().status, bandeauBal?.textContent, !!(bandeauBal && selonBal && (bandeauBal.compareDocumentPosition(selonBal) & Node.DOCUMENT_POSITION_FOLLOWING))], ['a_verifier', 'Lue sur evil.test — vérifie avant d’enregistrer.', true], 'aperçu (I-B5, ronde 1) : l’hôte RECALCULÉ depuis url_finale (jamais le page.hote stocké, « ricardocuisine.com »), dit AVANT « Selon la page : »');
        eq([lecture?.querySelectorAll('img,script,b,i').length, root.querySelectorAll('img,script').length, lecture?.querySelector('ul.list.plain li')?.firstChild?.textContent, lecture?.querySelector('ol.list.steps li')?.textContent, [...(lecture?.querySelectorAll('p') || [])].some((p) => p.textContent === '<b>Bon</b> appétit'), selonBal?.textContent.startsWith('Selon la page : <b>Site</b> · ' + BAL + 'Ricardo · '), root.querySelector('[data-role="titre-lu"]')?.textContent],
          [0, 0, '250 g ' + BAL + ' spaghettis', 'Cuire <script>alert(2)</script>.', true, true, 'Titre lu : <i>Pâtes</i> <script>alert(1)</script> — ce sera le titre de la fiche.'], 'aperçu (I-B2, ronde 1) : le balisage d’une ligne, d’une étape, des notes, du site, de l’auteur et du titre lu reste du TEXTE — aucun img, script, b ni i rendu');
        const incertainBal = lecture?.querySelector('[data-role="incertain"]')?.textContent || '';
        eq([lecture?.textContent.includes('La page était longue : la fin n’a pas été lue.'), Array.from(incertainBal).length, incertainBal.endsWith('…')], [true, Array.from('Incertain : ').length + 300, true], 'aperçu (ronde 1) : page coupée → « La page était longue : la fin n’a pas été lue. » ; « Incertain : … » borné à 300 points de code');
        root.remove();
        await db.mutate({ puts: { recipes: [signet('rc_meme', 'https://ricardocuisine.com/rc_meme', { original_title: 'Pâtes puttanesca' })], imports: [importWeb('imp_meme', 'rc_meme', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: LW.relireResultat(ld()) })] }, origin: 'device' });
        root = await monter('rc_meme');
        eq([root.etatRouteWeb().status, root.querySelector('[data-role="titre-lu"]')], ['a_verifier', null], 'aperçu (D-B24, ronde 1) : un titre lu identique au titre de la fiche → pas de « Titre lu »');
        root.remove();
        // Vague finale (faux-verts) : les avertissements de l'aperçu ne s'affichent que quand ils le doivent — une lecture SANS drapeau (autres_recettes 0,
        // incomplete faux, uncertain_fields vides, notes nulles) ne montre ni « D’autres recettes… », ni « lecture incomplète », ni « Incertain : », ni « Notes ».
        await db.mutate({ puts: { recipes: [signet('rc_sans', 'https://ricardocuisine.com/rc_sans')], imports: [importWeb('imp_sans', 'rc_sans', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: LW.relireResultat(ld({ autres_recettes: 0, texte_coupe: false }, { notes: null, incomplete: false, uncertain_fields: [] })) })] }, origin: 'device' });
        root = await monter('rc_sans');
        eq([root.etatRouteWeb().status, root.textContent.includes('D’autres recettes'), [...root.querySelectorAll('.chip.warn')].some((c) => c.textContent === 'lecture incomplète'), root.querySelector('[data-role="incertain"]'), [...root.querySelectorAll('h2, h3')].some((h) => h.textContent === 'Notes')], ['a_verifier', false, false, null, false], 'aperçu (vague finale, § 7.4) : une lecture sans drapeau → ni « D’autres recettes… » (autres_recettes 0), ni « lecture incomplète », ni « Incertain : », ni section « Notes » (notes nulles)');
        root.remove();

        // --- Deux onglets (T4-R2 du lot A) : la lecture AFFICHÉE a été remplacée par une autre (même id, même statut, autre départ, autre résultat) entre
        //     le rendu et le clic → ni « Enregistrer » ni « Ignorer » ne valent pour elle : rien d'écrit, l'écran montre la nouvelle.
        ff = fauxFetch();
        root = await monter('rc_e8', { deps: { fetch: ff.fetch } });
        await lireEtAttendre(root, ff, ld(), 'rc_e8');
        const ailleurs8 = async (titre, minute) => { const l = await ligneDe('rc_e8'); await repo.transitionner('imports', l.id, { attendus: ['a_verifier'], patch: { started_at: `2026-10-19T12:${minute}:00.000Z`, resultat: { ...l.resultat, recette: { ...l.resultat.recette, title: titre } } } }); };
        await ailleurs8('Autre lecture', '05');
        bouton(root, 'Enregistrer').click();
        await attendre(() => (root.querySelector('[data-role="titre-lu"]')?.textContent || '').includes('Autre lecture'), 'redessiné sur la nouvelle lecture');
        eq([(await db.get('recipes', 'rc_e8')).availability, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_e8')).length, (await ligneDe('rc_e8'))?.status], ['reference_only', 0, 'a_verifier'], 'deux onglets : « Enregistrer » d’une lecture remplacée entre le rendu et le clic → rien d’écrit, l’écran montre la nouvelle');
        await ailleurs8('Troisième lecture', '06');
        const navsIgnorer = navs.length;
        bouton(root, 'Ignorer').click();
        await attendre(() => (root.querySelector('[data-role="titre-lu"]')?.textContent || '').includes('Troisième lecture'), 'redessiné');
        eq([(await ligneDe('rc_e8'))?.status, navs.length], ['a_verifier', navsIgnorer], 'deux onglets : « Ignorer » d’une lecture remplacée → rien d’écrit, aucun retour, l’écran montre la nouvelle');

        // --- Deux onglets sur « Illisible » (R-B-10, P-12) : marquerIllisible de la variante web ne vaut que pour LA lecture relue illisible (cleLecture).
        //     Un autre onglet écrit SA lecture (lisible) entre la relecture et la transition : rien n'est marqué, la nouvelle reste a_verifier. Deux chemins :
        //     le montage de l'écran (charger) et « Enregistrer » (enregistrerLecture relit la ligne). L'autre onglet passe par un repo espion, une seule fois.
        const autreOnglet = (titre, minute) => {
          let fait = false;
          return { ...repo, transitionner: async (store, key, opts) => {
            if (!fait && store === 'imports' && typeof opts?.patch === 'function' && opts?.attendus?.join() === 'a_verifier') {
              fait = true;
              await repo.transitionner('imports', key, { attendus: ['a_verifier'], patch: { started_at: `2026-10-19T12:${minute}:00.000Z`, resultat: LW.relireResultat({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, title: titre } }) } });
            }
            return repo.transitionner(store, key, opts);
          } };
        };
        const illisible = { source_kind: 'jsonld', page: PAGE, recette: { title: 'x'.repeat(500), ingredients: [], steps: [] } };
        await db.mutate({ puts: { imports: [importWeb('imp_ill1', 'rc_f3', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: illisible }), importWeb('imp_ill2', 'rc_f4', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: illisible })] }, origin: 'device' });
        root = await monter('rc_f3', { deps: { repo: autreOnglet('Lecture d’un autre onglet', '07') } });
        const ill1 = await db.get('imports', 'imp_ill1');
        eq([ill1.status, ill1.erreur, ill1.resultat?.recette?.title, root.etatRouteWeb().status, root.querySelector('[data-role="titre-lu"]')?.textContent], ['a_verifier', null, 'Lecture d’un autre onglet', 'a_verifier', 'Titre lu : Lecture d’un autre onglet — ce sera le titre de la fiche.'], 'deux onglets sur « Illisible » (R-B-10) : la lecture relue illisible au montage, une autre écrite entre-temps par un autre onglet → marquerIllisible n’écrit rien (garde cleLecture), la nouvelle reste a_verifier et l’écran la montre (mutant « garde retirée sur marquerIllisible » : rouge)');
        await W.enregistrerLecture('imp_ill2', { repo: autreOnglet('Lecture arrivée pendant Enregistrer', '08'), maintenant: () => NOW, choisir });
        const ill2 = await db.get('imports', 'imp_ill2');
        eq([ill2.status, ill2.erreur, ill2.resultat?.recette?.title, (await db.get('recipes', 'rc_f4')).availability, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_f4')).length], ['a_verifier', null, 'Lecture arrivée pendant Enregistrer', 'reference_only', 0], 'deux onglets sur « Illisible » (R-B-10) : « Enregistrer » relit une lecture illisible, une autre arrive avant l’écriture → rien n’est marqué ni enregistré, la nouvelle reste a_verifier');

        // Hors brief (I-B2, données hostiles) : la lecture relue illisible au montage est remplacée entre-temps par une AUTRE lecture, ELLE AUSSI illisible
        // (un autre onglet, une réception). (a) une fois : la seconde est relue et marquée à son tour → echec(illisible), rendu comme un échec ; (b) à
        // chaque écriture : rien n'est marqué (cleLecture), et l'écran ne la rend JAMAIS comme une lecture ni ne lève — il dit l'échec sans l'écrire.
        const illisibleAilleurs = (toujours) => {
          let n = 0;
          return { ...repo, transitionner: async (store, key, opts) => {
            if ((toujours || n === 0) && store === 'imports' && typeof opts?.patch === 'function' && opts?.attendus?.join() === 'a_verifier') {
              n += 1;
              await repo.transitionner('imports', key, { attendus: ['a_verifier'], patch: { started_at: `2026-10-19T12:1${n}:00.000Z`, resultat: { ...illisible, recette: { ...illisible.recette, title: 'y'.repeat(400 + n) } } } });
            }
            return repo.transitionner(store, key, opts);
          } };
        };
        await db.mutate({ puts: { recipes: [signet('rc_g1', 'https://ricardocuisine.com/rc_g1'), signet('rc_g2', 'https://ricardocuisine.com/rc_g2')], imports: [importWeb('imp_ill3', 'rc_g1', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: illisible }), importWeb('imp_ill4', 'rc_g2', { status: 'a_verifier', appels: 1, started_at: NOW, resultat: illisible })] }, origin: 'device' });
        const monterSans = async (id, r, deps = {}) => { try { return { root: await IC.renderImportCible({ id }, {}, await ctxDe(), gestes({ repo: r, ...deps })) }; } catch (e) { return { leve: String(e?.name) }; } };
        const g1 = await monterSans('rc_g1', illisibleAilleurs(false)); const ill3 = await db.get('imports', 'imp_ill3');
        eq([g1.leve ?? null, ill3.status, ill3.erreur?.raison, ill3.resultat, g1.root?.etatRouteWeb().status, g1.root?.querySelector('[data-role="echec"] small')?.textContent], [null, 'echec', 'illisible', null, 'echec', 'Code : illisible'], 'hors brief (I-B2) : une seconde lecture illisible arrivée pendant la revalidation est relue et marquée à son tour (echec(illisible)), rendue comme un échec');
        const g2 = await monterSans('rc_g2', illisibleAilleurs(true)); const ill4 = await db.get('imports', 'imp_ill4');
        eq([g2.leve ?? null, ill4.status, g2.root?.etatRouteWeb().status, g2.root?.querySelector('[data-role="echec"] small')?.textContent, !!g2.root?.querySelector('[data-role="enregistrer-lecture"]')], [null, 'a_verifier', 'a_verifier', 'Code : illisible', false], 'hors brief (I-B2) : des lectures illisibles écrites sans cesse par un autre onglet → rien n’est marqué, l’écran ne lève pas et ne rend jamais une lecture illisible (l’échec est dit, pas écrit ; aucun « Enregistrer »)');
        ff = fauxFetch();
        const g2b = await monterSans('rc_g2', illisibleAilleurs(true), { fetch: ff.fetch });
        g2b.root?.querySelector('[data-role="reessayer"]')?.click();
        eq([await fini(() => ff.appels.length === 1), (await db.get('imports', 'imp_ill4')).status], [true, 'en_cours'], 'hors brief (ronde 1) : « Réessayer » sur une lecture illisible restée a_verifier relance la lecture (« Relire la page » : a_verifier → en_cours, un POST) — jamais un geste muet');
        for (const r of ff.rendre) r(200, ld());
        await fini(() => !V.volEnCours());

        // --- Raison → texte (§ 4.4) : une table complète, chaque raison posée sur une ligne echec et rendue.
        const TEXTES = [['interdit', {}, 'Cette adresse ne peut pas être lue par l’assistant : seule une page publique en https est admise. Ouvre-la toi-même.'],
          ['inaccessible', {}, 'La page n’a pas pu être téléchargée (site injoignable, trop lent, ou qui refuse les robots). Ouvre-la toi-même.'],
          ['pas_une_page', {}, 'Cette adresse n’est pas une page web (PDF, image…) : l’assistant ne la lit pas.'],
          ['page_trop_lourde', {}, 'Cette page est trop lourde pour être lue.'], ['page_vide', {}, 'Aucun texte lisible sur cette page. Ouvre-la toi-même.'],
          ['annule', {}, 'Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.'],
          ['interrompu', {}, 'La lecture a été interrompue. L’appel a peut-être été compté ; relancer en coûtera un autre.'],
          ['incertain', {}, 'L’appel a peut-être été compté ; relancer en coûtera un autre.'],
          ['coupe', {}, 'La lecture a été coupée : la page est trop longue pour l’assistant.'],
          ['hors_bornes', { source_kind: 'jsonld' }, 'La recette de cette page dépasse ce que l’app peut lire (plus de 80 ingrédients ou 60 étapes, ou une ligne trop longue). Ouvre la page.'],
          ['hors_bornes', { source_kind: 'modele' }, 'L’assistant n’a pas répondu lisiblement. Réessaie.Code : hors_bornes'],
          ['illisible', {}, 'L’assistant n’a pas répondu lisiblement. Réessaie.Code : illisible'],
          ['vide', {}, 'Aucun ingrédient ni étape lus sur cette page.'], ['lien', {}, 'Le titre lu contenait une adresse web : lecture refusée. Ouvre la page.'],
          ['non_admis', {}, 'Ce compte n’a pas accès à l’assistant.'], ['quota', { quota: 60 }, 'Tu as atteint la limite du jour pour l’assistant (60 appels).'],
          ['trop_de_demandes', {}, 'Trop de demandes pour l’instant. Réessaie dans une minute.'], ['requete', {}, 'L’assistant n’a pas répondu. Réessaie. Code : requete'],
          ['serveur', {}, 'L’assistant n’a pas répondu. Réessaie. Code : serveur'], ['delai', {}, 'L’assistant n’a pas répondu. Réessaie. Code : delai'],
          ['reseau', {}, 'L’assistant n’a pas répondu. Réessaie. Code : reseau'], ['interne', {}, 'L’assistant n’a pas répondu. Réessaie. Code : interne'],
          ['reponse_illisible', {}, 'L’assistant n’a pas répondu. Réessaie. Code : reponse_illisible'], ['non_connecte', {}, 'Connecte-toi pour utiliser l’assistant.']];
        const obtenus = [];
        for (const [raison, extra] of TEXTES) {
          await db.mutate({ puts: { imports: [importWeb('imp_txt', 'rc_e6', { status: 'echec', appels: 1, erreur: { raison, extra } })] }, origin: 'device' });
          const r = await monter('rc_e6'); obtenus.push(r.querySelector('[data-role="echec"]').textContent); r.remove();
        }
        eq(obtenus, TEXTES.map(([, , texte]) => texte), 'raison → texte : la table § 4.4 complète (les six raisons web, coupe, illisible, hors_bornes jsonld ET modele, vide, lien, interrompu, incertain, et les raisons de la passerelle) — mutant « vide serveur mappé sur vide client » : rouge');
        // Ronde 1 (§ 4.2, points 5 et 6) : sans session ou hors ligne, « Réessayer » (echec) et « Relire la page » (a_verifier) sont éteints ; en echec,
        // sans session, la carte « Connecte-toi » est là ; hors ligne, « Tu es hors ligne. ».
        const eteints = [];
        for (const [id, role] of [['rc_e6', 'reessayer'], ['rc_e8', 'relire-page']]) {
          const sans = await monter(id, { session: null }); eteints.push(sans.querySelector(`[data-role="${role}"]`)?.disabled, !!sans.querySelector('[data-role="connexion-ia"]')); sans.remove();
          enLigneTest = false; const hors = await monter(id); eteints.push(hors.querySelector(`[data-role="${role}"]`)?.disabled, !!hors.querySelector('[data-role="hors-ligne"]')); hors.remove(); enLigneTest = true;
        }
        eq(eteints, [true, true, true, true, true, false, true, false], 'écran (ronde 1) : sans session ou hors ligne, « Réessayer » et « Relire la page » sont éteints ; en echec, la carte « Connecte-toi » (sans session) et « Tu es hors ligne. » (hors ligne)');

        // --- R-B-20 (VF-6 du lot A) : après synchro, une fiche peut avoir un import web ouvert par appareil (I-2 ne vaut que par appareil) — l'écran prend
        //     la ligne AFFICHÉE (un redessin la garde), puis ?import= (« Reprendre » de la section), puis une lecture reçue (a_verifier), puis celle de cet appareil.
        // R-B-18 : « ouvert » = importOuvert (une définition) — une ligne web reçue au statut inconnu (« zzz ») ou nul n'est pas l'import de l'écran.
        await db.mutate({ puts: { imports: [importWeb('imp_r20_a', 'rc_f5', { status: 'zzz' }), importWeb('imp_r20_b', 'rc_f5', { status: null })] }, origin: 'device' });
        const r18 = await IC.renderImportCible({ id: 'rc_f5' }, {}, await ctxDe(), gestes());
        eq([r18.etatRouteWeb(), !!r18.querySelector('[data-role="lire-web"]')], [{ importId: null, status: null, vol: false, remplacement: null }, true], 'R-B-18 (écran) : une ligne web au statut inconnu (« zzz ») ou nul n’est pas un import ouvert — l’écran offre la lecture, sans ligne');
        await db.mutate({ puts: { imports: [importWeb('imp_r20_ici', 'rc_f5', { status: 'echec', appels: 1, erreur: { raison: 'inaccessible', extra: {} } }), importWeb('imp_r20_ailleurs', 'rc_f5', { status: 'echec', appels: 1, device_id: 'un-autre-appareil', erreur: { raison: 'pas_une_page', extra: {} } })] }, origin: 'device' });
        const monterAvec = async (id, query) => { const r = await IC.renderImportCible({ id }, query, await ctxDe(), gestes()); scene.append(r); return r; };
        const r20 = await monterAvec('rc_f5', {});
        const r20b = await monterAvec('rc_f5', { import: 'imp_r20_ailleurs' });
        const vus20 = [r20.etatRouteWeb().importId, r20b.etatRouteWeb().importId];
        r20b.remove();
        await db.mutate({ puts: { imports: [importWeb('imp_r20_lue', 'rc_f5', { status: 'a_verifier', appels: 1, device_id: 'un-autre-appareil', started_at: NOW, resultat: LW.relireResultat(ld()) })] }, origin: 'device' });
        const avant20 = r20.querySelector('[data-role="action"]');
        window.dispatchEvent(new Event('online')); // un redessin par ecouterLecture : la ligne AFFICHÉE reste, la lecture reçue entre-temps ne la remplace pas
        await attendre(() => r20.querySelector('[data-role="action"]') !== avant20, 'redessiné (R-B-20)');
        vus20.push(r20.etatRouteWeb().importId);
        r20.remove();
        const r20c = await monterAvec('rc_f5', {}); vus20.push(r20c.etatRouteWeb().importId); r20c.remove();
        const r20d = await monterAvec('rc_f5', { import: 'imp_r20_ici' }); vus20.push(r20d.etatRouteWeb().importId); r20d.remove();
        eq(vus20, ['imp_r20_ici', 'imp_r20_ailleurs', 'imp_r20_ici', 'imp_r20_lue', 'imp_r20_ici'], 'R-B-20 (VF-6 du lot A) : plusieurs imports web ouverts sur une fiche (un par appareil) → l’écran prend la ligne affichée (un redessin la garde), puis ?import=, puis une lecture reçue, puis celle de cet appareil');

        // --- La fiche d'un signet : états, bascule de session (F-9), lire, http, hostile, repères.
        const seul = blocSignet((await ctxDe()).recipesById.get('rc_f1'), await ctxDe());
        eq([seul.querySelector('[data-role="lire-web"]').disabled, seul.querySelector('[data-role="connexion-ia"]').hidden, seul.querySelector('a').textContent], [true, true, 'Ouvrir le lien'], 'blocSignet (F-9) : rendu synchrone — bouton éteint, carte cachée, « Ouvrir le lien »');
        fiche = await renderRecipe({ id: 'rc_f1' }, {}, await ctxDe(), gestes({ fetch: (ff = fauxFetch()).fetch })); scene.append(fiche);
        eq([fiche.querySelector('[data-role="lire-web"]').disabled, fiche.querySelector('[data-role="connexion-ia"]').hidden, fiche.textContent.includes('L’app n’a pas encore lu la page.')], [false, true, true], 'fiche : avec session, le bouton s’allume et la carte reste cachée (aucun flash « Connecte-toi »)');
        const sansSession = await renderRecipe({ id: 'rc_f1' }, {}, await ctxDe(null), gestes()); scene.append(sansSession);
        eq([sansSession.querySelector('[data-role="lire-web"]').disabled, sansSession.querySelector('[data-role="connexion-ia"]').hidden, !!lien(sansSession, 'Ouvrir le lien')], [true, false, true], 'fiche : sans session, la carte est montrée, le bouton reste éteint, « Ouvrir le lien » reste');
        sansSession.remove();
        fiche.querySelector('[data-role="lire-web"]').click();
        await attendre(() => ff.appels.length === 1 && navs.at(-1) === '/recipes/rc_f1/importer', 'lu et navigué');
        eq([(await ligneDe('rc_f1')).status, JSON.parse(ff.appels[0].options.body).corps.url], ['en_cours', 'https://ricardocuisine.com/rc_f1'], 'fiche : « Lire la recette avec l’assistant » crée l’import, lance (un POST) et navigue vers l’écran');
        fiche.remove();
        const ctxEnCours = await ctxDe();
        const enCours = blocSignet(ctxEnCours.recipesById.get('rc_f1'), ctxEnCours);
        eq([enCours.textContent.includes('Lecture de la page en cours…'), lien(enCours, 'Voir')?.getAttribute('href'), enCours.querySelector('[data-role="lire-web"]')], [true, '#/recipes/rc_f1/importer', null], 'blocSignet : en_cours → « Lecture de la page en cours… » + « Voir », sans bouton de lecture');
        ff.rendre[0](200, ld()); await attendre(async () => (await ligneDe('rc_f1'))?.status === 'a_verifier', 'lu');
        const ctxLu = await ctxDe();
        const aVerifier = blocSignet(ctxLu.recipesById.get('rc_f1'), ctxLu);
        eq([aVerifier.textContent.includes('Lecture reçue : vérifie-la et enregistre.'), lien(aVerifier, 'Vérifier et enregistrer')?.classList.contains('primary')], [true, true], 'blocSignet : a_verifier → « Lecture reçue… » + « Vérifier et enregistrer » (primaire)');
        await db.mutate({ puts: { imports: [importWeb('imp_ech', 'rc_f2', { status: 'echec', appels: 1, erreur: { raison: 'inaccessible', extra: {} } })] }, origin: 'device' });
        const ctxE = await ctxDe();
        const echec = blocSignet(ctxE.recipesById.get('rc_f2'), ctxE);
        eq([echec.textContent.includes('Contenu non récupéré : ouvre la page.'), lien(echec, 'Ouvrir le lien').classList.contains('primary'), echec.querySelector('[data-role="lire-web"]')?.textContent, echec.querySelector('[data-role="raison"]').textContent], [true, true, 'Réessayer', 'La page n’a pas pu être téléchargée (site injoignable, trop lent, ou qui refuse les robots). Ouvre-la toi-même.'], 'blocSignet : echec → « Contenu non récupéré… », « Ouvrir le lien » (primaire), « Réessayer », la phrase du cas dessous');
        const http = blocSignet((await ctxDe()).recipesById.get('rc_http'), await ctxDe());
        eq([http.querySelector('[data-role="lire-web"]'), http.querySelector('[data-role="interdit"]')?.textContent.startsWith('Cette adresse ne peut pas être lue'), !!lien(http, 'Ouvrir le lien')], [null, true, true], 'blocSignet (B-20) : signet en http: → aucun bouton de lecture, texte interdit, « Ouvrir le lien »');
        const hostile = blocSignet((await ctxDe()).recipesById.get('rc_hostile'), await ctxDe());
        eq([hostile.querySelectorAll('a').length, hostile.querySelector('[data-role="lire-web"]'), hostile.textContent.includes('javascript:alert(1)')], [0, null, true], 'blocSignet : adresse hostile → adresseInerte, aucun lien, aucun bouton de lecture');
        const rep = blocSignet((await ctxDe()).recipesById.get('rc_rep'), await ctxDe());
        eq([rep.querySelectorAll('b').length, rep.querySelector('[data-role="presentation-web"]').textContent, rep.querySelector('[data-role="reperes-web"]').textContent], [0, 'Lors de la recherche, l’assistant disait : <b>Un classique</b> du garde-manger.', 'Estimé par l’assistant : ≈ 30 min · facile · 7 ingrédients'], 'blocSignet : web_reperes rendus en TEXTE (une présentation à <b> reste du texte), avec la ligne de repères (ligneReperes)');

        // --- Ronde 1 (fiche) : R-B-18 à plusieurs lignes, web_reperes et provenance REVALIDÉS au rendu (I-B2, S-2, S6), date illisible, http, hors ligne,
        //     panne, refus d'une autre sorte, a_lancer, correction écrite à la main.
        const RLO = String.fromCodePoint(0x202e);
        const provWeb = (id, over) => ({ generated_by: 'ai', source_url: `https://ricardocuisine.com/${id}`, url_finale: `https://www.ricardocuisine.com/${id}`, source_kind: 'jsonld', lue_le: DATE, import_id: null, ...over });
        const dispo = (id, url) => signet(id, url, { availability: 'available', verification_state: 'to_verify', current_version_id: 'rv_' + id, original_title: 'Pâtes lues' });
        await db.mutate({ puts: {
          recipes: [signet('rc_m1', 'https://ricardocuisine.com/m1'),
            signet('rc_m2', 'https://ricardocuisine.com/m2', { web_reperes: { presentation: 'Commande sur https://evil.example/phish ' + RLO + 'x'.repeat(5000), temps_min: 30, difficulte: null, ingredients: null } }),
            signet('rc_m3', 'https://ricardocuisine.com/m3', { web_reperes: { presentation: RLO + 'Un plat ' + 'tout simple '.repeat(60), temps_min: null, difficulte: 'facile', ingredients: null } }),
            dispo('rc_m4', 'https://ricardocuisine.com/m4'), dispo('rc_m5', 'https://ricardocuisine.com/m5'), dispo('rc_m6', 'https://ricardocuisine.com/m6'), dispo('rc_m7', 'http://ricardocuisine.com/m7'),
            signet('rc_m8', 'https://ricardocuisine.com/m8'), signet('rc_m9', 'https://ricardocuisine.com/m9'), signet('rc_m10', 'https://ricardocuisine.com/m10'), signet('rc_m11', 'https://ricardocuisine.com/m11'),
            dispo('rc_m12', 'https://ricardocuisine.com/m12')],
          recipe_versions: [versionDe('rv_rc_m4', 'rc_m4', provWeb('m4', { auteur: 'https://evil.example/' + RLO + 'y'.repeat(3000), site: 'www.evil.example/connexion' })),
            versionDe('rv_rc_m5', 'rc_m5', provWeb('m5', { auteur: BAL + 'Ricardo', site: '<b>Site</b>' + RLO + 'z'.repeat(300) })),
            versionDe('rv_rc_m6', 'rc_m6', provWeb('m6', { auteur: 'Ricardo', site: null, lue_le: 'hier' })),
            versionDe('rv_rc_m7', 'rc_m7', { generated_by: 'manual' }), versionDe('rv_rc_m12', 'rc_m12', { generated_by: 'manual' }, { kind: 'correction' })],
          imports: [importWeb('imp_a_m1', 'rc_m1', { status: 'zzz' }), importWeb('imp_b_m1', 'rc_m1', { status: 'echec', appels: 1, erreur: { raison: 'inaccessible', extra: {} } }),
            { ...importWeb('imp_photo_m10', 'rc_m10'), kind: 'recette' }, importWeb('imp_m11', 'rc_m11')] }, origin: 'device' });
        const ctxM = await ctxDe();
        const m1 = blocSignet(ctxM.recipesById.get('rc_m1'), ctxM);
        eq([m1.textContent.includes('Contenu non récupéré : ouvre la page.'), m1.querySelector('[data-role="lire-web"]')?.textContent, m1.querySelector('[data-role="raison"]')?.textContent], [true, 'Réessayer', 'La page n’a pas pu être téléchargée (site injoignable, trop lent, ou qui refuse les robots). Ouvre-la toi-même.'], 'blocSignet (R-B-18, ronde 1) : deux lignes web, « zzz » (triée avant) puis echec → l’état echec, jamais masqué par la ligne au statut inconnu');
        const m2 = blocSignet(ctxM.recipesById.get('rc_m2'), ctxM); const m3 = blocSignet(ctxM.recipesById.get('rc_m3'), ctxM);
        const pres3 = m3.querySelector('[data-role="presentation-web"]')?.textContent || ''; const avantPres = 'Lors de la recherche, l’assistant disait : ';
        eq([m2.querySelector('[data-role="presentation-web"]'), m2.querySelector('[data-role="reperes-web"]')?.textContent, pres3.startsWith(avantPres + 'Un plat tout simple'), pres3.includes(RLO), Array.from(pres3).length <= Array.from(avantPres).length + 400, pres3.endsWith('…')],
          [null, 'Estimé par l’assistant : ≈ 30 min', true, false, true, true], 'blocSignet (I-B2, S6, ronde 1) : web_reperes relus au rendu par reperesDe — une présentation qui porte une adresse est écartée, une autre bornée au mot à 400 (« … »), Cc/Cf retirés');
        const fichesM = {};
        for (const id of ['rc_m4', 'rc_m5', 'rc_m6', 'rc_m7']) { fichesM[id] = await renderRecipe({ id }, {}, await ctxDe(), gestes()); scene.append(fichesM[id]); }
        const bandeauM = (id) => fichesM[id].querySelector('[data-role="bandeau-web"]');
        eq([bandeauM('rc_m4')?.firstChild?.textContent.startsWith('Lue sur www.ricardocuisine.com le '), bandeauM('rc_m4')?.querySelector('[data-role="selon-la-page"]') ?? null, bandeauM('rc_m5')?.querySelector('[data-role="selon-la-page"]')?.textContent, bandeauM('rc_m5')?.querySelectorAll('img,b,script').length, bandeauM('rc_m6')?.firstChild?.textContent],
          [true, null, 'Selon la page : <b>Site</b>' + 'z'.repeat(189) + ' · ' + BAL + 'Ricardo', 0, 'Lue sur www.ricardocuisine.com · données de la page — vérifie.'], 'fiche (I-B2, S-2, ronde 1) : la provenance relue au rendu par lirePage — site et auteur porteurs d’adresse écartés, bornés à 200, Cc/Cf retirés, balisage en TEXTE ; date illisible → « Lue sur {h} · {m} — vérifie. » (jamais un « le » orphelin)');
        eq([fichesM.rc_m7.querySelector('[data-role="relire-web"]'), fichesM.rc_m7.querySelector('[data-role="ouvrir-lien"]')?.getAttribute('href')], [null, 'http://ricardocuisine.com/m7'], 'fiche (§ 4.1 c, I-B5, ronde 1) : une fiche http: à version n’offre pas « Relire la page avec l’assistant » ; « Ouvrir le lien » reste');
        for (const f of Object.values(fichesM)) f.remove();
        const horsLigneFiche = await renderRecipe({ id: 'rc_m8' }, {}, await ctxDe(), gestes({ enLigne: () => false })); scene.append(horsLigneFiche);
        const etatHL = [horsLigneFiche.querySelector('[data-role="lire-web"]')?.disabled, horsLigneFiche.textContent.includes('Tu es hors ligne.')];
        horsLigneFiche.remove();
        ff = fauxFetch(); const navsHL = navs.length;
        const bascule = await renderRecipe({ id: 'rc_m8' }, {}, await ctxDe(), gestes({ fetch: ff.fetch })); scene.append(bascule);
        enLigneTest = false; // l'appareil passe hors ligne APRÈS le rendu : la tape relit l'état
        bascule.querySelector('[data-role="lire-web"]')?.click();
        etatHL.push(await fini(() => dits.at(-1) === 'Tu es hors ligne.'), (await db.byIndex('imports', 'recipe_id', 'rc_m8')).length, ff.appels.length, navs.length - navsHL);
        enLigneTest = true; bascule.remove();
        eq(etatHL, [true, true, true, 0, 0, 0], 'fiche (§ 4.1 a, § 4.4, ronde 1) : hors ligne au rendu → bouton éteint et « Tu es hors ligne. » ; hors ligne APRÈS le rendu → la tape le dit et n’écrit RIEN (journal : rien), aucun POST, aucune navigation');
        const erreursM = []; const vraiErreurM = console.error; console.error = (...a) => { erreursM.push(String(a[0])); }; // l'incident est journalisé (attendu)
        try {
          const panne = await renderRecipe({ id: 'rc_m9' }, {}, await ctxDe(), gestes({ repo: { ...repo, saveBatch: async () => { throw new Error('quota'); } } })); scene.append(panne);
          panne.querySelector('[data-role="lire-web"]')?.click();
          const ditPanne = await fini(() => dits.at(-1) === 'L’assistant n’a pas répondu. Réessaie. Code : interne');
          eq([ditPanne, erreursM.some((e) => e.includes('recipe.lire_web')), (await db.byIndex('imports', 'recipe_id', 'rc_m9')).length], [true, true, 0], 'fiche (ronde 1) : une écriture impossible à la tape (base indisponible, quota) est journalisée et dite (« … Code : interne »), jamais un rejet sans gestionnaire ; rien d’écrit');
          panne.remove();
        } finally { console.error = vraiErreurM; }
        const autreSorte = await renderRecipe({ id: 'rc_m10' }, {}, await ctxDe(), gestes()); scene.append(autreSorte);
        autreSorte.querySelector('[data-role="lire-web"]')?.click();
        const ditSorte = await fini(() => dits.at(-1) === 'Une lecture est déjà en cours : annule-la d’abord.');
        eq([ditSorte, (await db.byIndex('imports', 'recipe_id', 'rc_m10')).filter((i) => i.kind === 'web').length], [true, 0], 'fiche (ronde 1) : un import ouvert d’une autre sorte tient la fiche (refus transition) → « Une lecture est déjà en cours : annule-la d’abord. », jamais une fausse panne de l’assistant ; rien d’écrit');
        autreSorte.remove();
        const m11 = blocSignet(ctxM.recipesById.get('rc_m11'), ctxM);
        eq([m11.textContent.includes('L’app n’a pas encore lu la page.'), m11.querySelector('[data-role="lire-web"]')?.textContent], [true, 'Lire la recette avec l’assistant'], 'blocSignet (§ 7.4, ronde 1) : a_lancer → la rangée de « aucun import » (« Lire la recette avec l’assistant »)');
        const corrMain = await monter('rc_m12');
        eq([corrMain.etatRouteWeb().remplacement, corrMain.querySelector('[data-role="remplacement"]')?.textContent], [true, 'Ta version écrite à la main n’est jamais remplacée sans question.'], 'remplacement (B-14, § 7.4, ronde 1) : une correction écrite à la main → « Ta version écrite à la main n’est jamais remplacée sans question. »');
        corrMain.remove();
        // Vague finale (I-B2, S-7) : la fiche lit le « Incertain : » d'une lecture web dans le résultat RELU de la ligne du journal (relireResultat, comme
        // l'écran) — une entrée qui porte une adresse est écartée — et ce sont les champs de la LIGNE (« b »), pas ceux de la provenance (« a »).
        // Puis la garde « hôte illisible » du bandeau web : une provenance dont l'adresse ne se lit pas ne rend aucun bandeau « Lue sur … ».
        await db.mutate({ puts: {
          recipes: [dispo('rc_s7', 'https://ricardocuisine.com/s7'), dispo('rc_sh', 'https://ricardocuisine.com/sh')],
          recipe_versions: [versionDe('rv_rc_s7', 'rc_s7', provWeb('s7', { import_id: 'imp_s7', uncertain_fields: ['a'] })), versionDe('rv_rc_sh', 'rc_sh', { generated_by: 'ai', source_url: 'pas une adresse', source_kind: 'jsonld' })],
          imports: [importWeb('imp_s7', 'rc_s7', { status: 'enregistre', appels: 1, started_at: NOW, resultat: { ...ld(), recette: { ...RECETTE, uncertain_fields: ['voir https://evil.test/promo', 'b'] } } })] }, origin: 'device' });
        const ficheS7 = await renderRecipe({ id: 'rc_s7' }, {}, await ctxDe(), gestes()); scene.append(ficheS7);
        eq([ficheS7.querySelector('[data-role="incertain-lecture"]')?.textContent, ficheS7.textContent.includes('https://evil.test/promo')], ['Incertain : b', false], 'fiche (vague finale, I-B2, S-7) : « Incertain : » lu dans le résultat RELU de la ligne web — l’entrée à adresse écartée, les champs de la ligne et non ceux de la provenance');
        ficheS7.remove();
        const ficheSH = await renderRecipe({ id: 'rc_sh' }, {}, await ctxDe(), gestes()); scene.append(ficheSH);
        eq([ficheSH.querySelector('[data-role="bandeau-web"]'), !!ficheSH.querySelector('[data-role="ouvrir-lien"]')], [null, true], 'fiche (vague finale) : une provenance web dont l’adresse ne se lit pas (« pas une adresse », sans url_finale) → aucun bandeau « Lue sur … » ; la fiche est rendue (« Ouvrir le lien »)');
        ficheSH.remove();
        eq([srcRecette.includes('L’app n’a pas lu la page'), srcEn.includes('L’app n’a pas lu la page'), srcEn.includes('lot suivant')], [false, false, false], 'B-27 : « L’app n’a pas lu la page » ni dans recipe.js ni dans en.js ; le toast « lot suivant » retiré du dictionnaire');
        eq([/anthropic|supabase/i.test(srcWeb), /anthropic|supabase/i.test(srcVol), /anthropic|supabase/i.test(srcDomaine), /\bconst TEXTES_/.test(srcWeb)], [false, false, false, false], 'I-B6 (test de source ; sans égard à la casse, X8, vague finale du lot C) : aucun texte ne nomme le fournisseur ni la base ; aucune table TEXTES_ dans import-web.js (F-11)');
        eq(reseau, 0, 'aucun réseau réel');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); V.reinitialiserVol(); W.reinitialiserLectureWeb(); IC.reinitialiserImportCible(); }
    }));

    // === Lot F (spec plats-en-images § 3.3, § 4.3 point 2, D-F18, D-F19) : l'image de la page, relue ; la provenance n'est écrite qu'avec la photo
    await run('lot F — lirePage : image_url', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const p = (image_url) => W.lirePage({ page: { url_finale: 'https://a.test/r', image_url } }).page.image_url;
      eq([p('https://cdn.test/i.jpg'), p('http://cdn.test/i.jpg'), p(undefined), p('https://cdn.test/i' + String.fromCodePoint(0x2028) + '.jpg'), p(7)], ['https://cdn.test/i.jpg', null, null, null, null],
        'lirePage : image_url admise gardée ; http, absente, hostile (U+2028), non chaîne → null');
      eq(Object.keys(W.lirePage({ page: {} }).page).at(-1), 'image_url', 'lirePage : image_url est la dernière clé de page');
      const source = await lire('../src/domain/lecture-web.js');
      const debut = source.indexOf('export function lirePage(');
      const corps = source.slice(debut, source.indexOf('\n}\n', debut));
      ok(corps.includes("adresseImageAdmise(propre(p, 'image_url'))"), 'lirePage (test de source) : image_url passe par adresseImageAdmise( — jamais par borner (une adresse tronquée n’est pas une adresse)');
    });

    await run('lot F — fabriquerLectureWeb : photoWeb et photo_source_url (D-F18, D-F19)', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const H = (c) => c.repeat(64);
      const IMG = 'https://cdn.site.test/p.jpg';
      const SIGNET = { id: 'rc_s', edition_id: null, original_title: 'site.test', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: 'https://site.test/r/1', source_label: 'site.test' };
      const PAGE = { url_finale: 'https://site.test/r/1', hote: 'site.test', titre_page: 'P', auteur: null, site: null, lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 0, texte_coupe: false, image_url: IMG };
      const RECETTE = { title: 'Pâtes', servings: 2, prep_minutes: null, cook_minutes: null, total_minutes: null, ingredients: [{ source_text: '1 pomme', uncertain: false }], steps: [{ text: 'Cuire.' }], printed_page: null, sub_recipes: [], uncertain_fields: [], notes: null, incomplete: false, missing_page: false };
      const fab = (signet, over = {}) => W.fabriquerLectureWeb(RECETTE, { signet, versions: [], page: PAGE, sourceKind: 'jsonld', photoAnnoncee: IMG, ...over });
      const a = fab(SIGNET);
      eq([a.photoWeb, a.recipe.photo_source_url, 'photo_sha256' in a.recipe, 'photo_origin' in a.recipe], [IMG, IMG, false, false], 'fiche sans photo + image annoncée → photo_source_url = l’adresse (le rapatriement attendu), photoWeb = l’adresse ; photo_sha256 jamais touché ; aucune clé photo_origin ajoutée');
      const b = fab({ ...SIGNET, photo_sha256: H('a'), photo_origin: 'image', photo_source_url: null });
      eq([b.photoWeb, b.recipe.photo_source_url, b.recipe.photo_sha256, b.recipe.photo_origin], [null, null, H('a'), 'image'], 'fiche à photo de la personne → photoWeb null, rien de la photo changé');
      const c = fab({ ...SIGNET, photo_sha256: H('a'), photo_origin: 'web', photo_source_url: 'https://cdn.site.test/ancienne.jpg' });
      eq([c.photoWeb, c.recipe.photo_source_url, c.recipe.photo_sha256], [IMG, 'https://cdn.site.test/ancienne.jpg', H('a')], 'photo web + autre image annoncée → photoWeb = l’adresse, photo_source_url INCHANGÉ (la provenance de la photo en place reste vraie)');
      const sig = { ...SIGNET, current_version_id: 'rv_m' };
      const d = fab(sig, { versions: [{ id: 'rv_m', kind: 'extraction', provenance: { generated_by: 'manual' }, verification_state: 'verified' }], remplacer: false });
      eq([d.recipe, d.photoWeb], [sig, IMG], 'remplacer: false → le signet INTACT (aucune clé changée, B-24), photoWeb = l’adresse (la descente partira après la transaction, R-F-2)');
      eq([fab(SIGNET, { photoAnnoncee: null }).photoWeb, fab(SIGNET, { photoAnnoncee: 'https://cdn.site.test/autre.jpg' }).photoWeb, 'photo_source_url' in fab(SIGNET, { photoAnnoncee: null }).recipe], [null, null, false], 'photoAnnoncee nulle ou différente → photoWeb null, aucun photo_source_url posé (S-12)');
      // Ronde 1 : la moitié « pointeur VALIDE » de la règle (D-F18 : une fiche SANS pointeur valide reçoit photo_source_url) — un pointeur hostile vaut
      // « pas de photo », quelle que soit l'origine, et l'ancienne adresse est remplacée (sinon « Réessayer » relancerait l'ANCIENNE image).
      const hw = fab({ ...SIGNET, photo_sha256: '../x', photo_origin: 'web', photo_source_url: 'https://cdn.site.test/ancienne.jpg' });
      const hi = fab({ ...SIGNET, photo_sha256: '../x', photo_origin: 'image' });
      eq([hw.photoWeb, hw.recipe.photo_source_url, hi.photoWeb, hi.recipe.photo_source_url], [IMG, IMG, IMG, IMG], 'pointeur hostile (« ../x », origine web ou image) = sans photo → photoWeb et photo_source_url = l’adresse annoncée');
      // Ronde 1 : la comparaison à l'annonce passe par memeAdresseImage (S-10) — l'annonce sous une autre forme est la même adresse.
      const af = fab(SIGNET, { photoAnnoncee: 'HTTPS://CDN.SITE.TEST:443/p.jpg' });
      eq([af.photoWeb, af.recipe.photo_source_url], [IMG, IMG], 'photoAnnoncee « HTTPS://CDN.SITE.TEST:443/p.jpg » = la même adresse → photoWeb = l’href normalisé');
      let e = null; let ap = null;
      try { ap = fab({ ...SIGNET, photo_origin: 'appareil' }); } catch (x) { e = x; }
      eq([e?.name ?? null, ap?.recipe.photo_origin], [null, null], 'D-F19 : signet relu avec photo_origin « appareil » → aucune levée, photo_origin null');
      let e2 = null; let ap2 = null;
      try { ap2 = fab({ ...SIGNET, photo_origin: 'appareil' }, { remplacer: false }); } catch (x) { e2 = x; }
      eq([e2?.name ?? null, ap2?.recipe.photo_origin], [null, 'appareil'], 'P-5 : « Ajouter sans remplacer » sur une origine hors liste ne lève pas ; le signet rendu reste intact (il n’est pas écrit)');
    });

    // === Lot F (spec plats-en-images § 4.3) : l'écran a_verifier ANNONCE l'essai, « Enregistrer » le déclenche APRÈS la transaction ; le texte ne
    // dépend jamais de l'image (I-F4) ; un appel ne part que pour l'adresse annoncée (S-12) ; « Ajouter sans remplacer » descend aussi (R-F-2).
    await run('lot F — import web : annonce, ordre, déclenchement, « Ajouter sans remplacer », échec, relecture (§ 4.3, I-F4, S-12, R-F-2)', () => withRepo(async (repo, db) => {
      const IC = await import('../src/ui/import-cible.js');
      const W = await import('../src/ui/import-web.js');
      const V = await import('../src/ui/vol.js');
      const PP = await import('../src/ui/photo-plat.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      const srcWeb = await lire('../src/ui/import-web.js'); // lu AVANT de couper le réseau
      V.reinitialiserVol(); W.reinitialiserLectureWeb(); PP.reinitialiserPhotoPlat();
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      const vraiErreur = console.error; const journal = [];
      console.error = (...a) => { journal.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
      const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
      const mutate = db.mutate.bind(db);
      let lacher = () => {}; // ronde 1 : relâche une réponse image-web retenue (aussi en finally : jamais une descente laissée suspendue)
      try {
        const NOW = '2026-10-19T12:00:00.000Z'; const DATE = '2026-10-19T00:00:00.000Z';
        const H = (c) => c.repeat(64);
        const IMG = 'https://cdn.site.test/puttanesca.jpg'; const IMG2 = 'https://cdn.site.test/autre.jpg';
        const SESSION = { access_token: 'jeton-photo-web-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
        const signet = (id, over = {}) => ({ id, edition_id: null, original_title: 'site.test', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: `https://site.test/${id}`, source_label: 'site.test', created_at: DATE, updated_at: DATE, ...over });
        const humaine = (rid) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }], provenance: { generated_by: 'manual' }, verification_state: 'verified', created_at: DATE, updated_at: DATE });
        const ctxDe = async () => {
          const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
          return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])), editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(), imports: await db.getAll('imports'), settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' }, sync: { user: { id: 'u1', email: 'a@exemple.invalid' }, auth: { jeton: async () => SESSION } }, conventionFor: () => null,
            dishesById: new Map(), cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: [], ingredientsById: new Map(), dishes: [], source_documents: [], source_pages: [], rediscovery_prefs: [], docsByRecipe: new Map(), scan_sessions: [] };
        };
        const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
        const PAGE = { url_finale: 'https://site.test/r', hote: 'site.test', titre_page: 'P', auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: NOW, autres_recettes: 0, texte_coupe: false };
        const RECETTE = { title: 'Pâtes puttanesca', servings: 4, prep_minutes: 20, cook_minutes: 20, total_minutes: 40, ingredients: [{ source_text: '250 g de spaghettis', uncertain: false }, { source_text: '1 boîte de tomates', uncertain: false }], steps: [{ text: 'Cuire.' }, { text: 'Servir.' }], notes: 'Un classique.', incomplete: false };
        const ld = (page = {}) => ({ source_kind: 'jsonld', page: { ...PAGE, ...page }, recette: RECETTE, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null });
        // L'image que la fonction rend : une PNG 800 × 600 en base64 (un seul btoa sur la chaîne binaire entière : la même chaîne que la tranche de 3 du serveur).
        const corpsPng = async (couleur) => {
          const toile = new OffscreenCanvas(800, 600); const cx = toile.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, 800, 600);
          const u8 = new Uint8Array(await (await toile.convertToBlob({ type: 'image/png' })).arrayBuffer());
          let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
          return { type: 'image/png', taille: u8.length, url_finale: IMG, octets: btoa(s) };
        };
        const IMAGE_A = await corpsPng('#3a7'); const IMAGE_B = await corpsPng('#a37');
        // Le fetch factice : chaque appel est noté { outil, url } et dans `evenements` ; une lecture répond par la file `lectures`, une image par la file
        // `images` (file vide : IMAGE_A).
        const appels = []; const evenements = []; const lectures = []; const images = [];
        // Ronde 1 : une réponse image-web RETENUE derrière un verrou (retenir / lacher) — « SANS await » (§ 4.3 point 2) s'observe pendant la descente.
        let retenue = null;
        const retenir = () => { retenue = new Promise((r) => { lacher = () => { retenue = null; r(); }; }); };
        const ff = async (url, options) => {
          const corps = JSON.parse(options.body);
          appels.push({ outil: corps.outil, url: corps.corps?.url }); evenements.push('fetch:' + corps.outil);
          if (corps.outil === 'lecture-web') return reponse(...(lectures.shift() || [200, ld()]));
          if (retenue) await retenue;
          return reponse(...(images.shift() || [200, IMAGE_A]));
        };
        const postsImage = () => appels.filter((a) => a.outil === 'image-web');
        const espionner = () => { db.mutate = (o) => { evenements.push('mutate:' + [...Object.keys(o.puts || {}), ...Object.keys(o.conditions || {})].sort().join('+')); return mutate(o); }; };
        const navs = []; const dits = []; const choix = { suivant: [], appels: 0 };
        const choisir = async () => { choix.appels += 1; return choix.suivant.length ? choix.suivant.shift() : null; };
        const gestes = (deps = {}) => ({ repo, navigate: (x) => navs.push(x), toast: (m) => dits.push(m), fetch: ff, maintenant: () => NOW, enLigne: () => true, choisir, ...deps });
        const monter = async (id, deps = {}) => { const root = await IC.renderImportCible({ id }, {}, await ctxDe(), gestes(deps)); scene.append(root); return root; };
        const bouton = (root, texte) => [...root.querySelectorAll('button')].find((x) => x.textContent === texte) || null;
        const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
        const ligneDe = async (recipeId) => (await db.byIndex('imports', 'recipe_id', recipeId)).find((i) => !['enregistre', 'ignore'].includes(i.status)) || null;
        // Lire une fiche (la lecture rend `page`), puis attendre l'aperçu a_verifier rendu. `apresMontage` (ronde 1) : un geste joué entre le montage (le ctx
        // de l'écran est pris) et la lecture. Ronde 1 (D-F11 par le DOM) : chaque aperçu d'une page à image est relevé — ni IMG, ni IMG2, ni l'hôte de l'image.
        const ecransImage = []; const fuitesImage = [];
        const fuiteImage = (n) => [IMG, IMG2, 'cdn.site.test'].some((x) => n.textContent.includes(x) || n.innerHTML.includes(x));
        const lireAvec = async (id, page = {}, deps = {}, apresMontage = async () => {}) => {
          scene.replaceChildren(); // l'écran précédent est détaché (B : il se désabonne à la notification suivante)
          lectures.push([200, ld(page)]);
          const root = await monter(id, deps);
          await apresMontage();
          bouton(root, 'Lire la recette avec l’assistant').click();
          await attendre(async () => (await ligneDe(id))?.status === 'a_verifier' && root.etatRouteWeb().status === 'a_verifier', 'aperçu de ' + id);
          if (page.image_url) { ecransImage.push(id); if (fuiteImage(root)) fuitesImage.push(id); }
          return root;
        };
        // « Enregistrer » qui navigue ; la descente éventuelle est attendue avant de continuer (aucune descente ne survit à la base jetable).
        const enregistrer = async (root, id) => { const n = navs.length; bouton(root, 'Enregistrer').click(); await attendre(() => navs.length > n, 'enregistré : ' + id); await PP.attendreRecuperation(id); };
        const ANNONCE = 'Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour.';
        const annonce = (root) => root.querySelector('[data-role="photo-web-annonce"]');
        const enFiche = async (id) => { const p = await renderRecipe({ id }, {}, await ctxDe(), { pickFiles: async () => [], toast: () => {}, fetch: ff, enLigne: () => true }); scene.append(p); return p; };

        // 1. Ordre (Review Focus 2, I-F4) : la transaction AVANT le premier POST image-web, puis UN POST, puis files, puis la photo sur la fiche.
        await db.mutate({ puts: { recipes: [signet('rc_o')] }, origin: 'device' });
        let root = await lireAvec('rc_o', { image_url: IMG });
        const ligneAnnonce = annonce(root);
        const mode = root.querySelector('[data-role="mode"]');
        eq([ligneAnnonce?.tagName, ligneAnnonce?.className, ligneAnnonce?.textContent, !!mode && !!ligneAnnonce && mode.nextElementSibling === ligneAnnonce], ['SMALL', 'muted', ANNONCE, true],
          'écran a_verifier : small.muted « Après l’enregistrement, l’app essaiera de récupérer… » (un ESSAI et son coût), JUSTE sous la ligne du mode (son élément suivant, ronde 1)');
        evenements.length = 0; espionner();
        try { await enregistrer(root, 'rc_o'); } finally { db.mutate = mutate; }
        const iTx = evenements.indexOf('mutate:imports+recipe_versions+recipes'); const iImg = evenements.indexOf('fetch:image-web');
        const iFiles = evenements.findIndex((e, i) => i > iImg && e === 'mutate:files');
        const iPhoto = evenements.findIndex((e, i) => i > iFiles && e === 'mutate:recipes');
        eq([iTx >= 0, iTx < iImg, iFiles > iImg, iPhoto > iFiles, evenements.filter((e) => e === 'fetch:image-web').length], [true, true, true, true, 1],
          'ordre : la transaction (recipes, recipe_versions, imports enregistre) est écrite AVANT le premier POST image-web, puis UN POST, puis files, puis la photo sur la fiche');
        const o = await db.get('recipes', 'rc_o');
        eq([o.availability, o.photo_origin, o.photo_source_url, /^[0-9a-f]{64}$/.test(o.photo_sha256 ?? ''), (await db.byIndex('imports', 'recipe_id', 'rc_o'))[0].status, postsImage().at(-1).url],
          ['available', 'web', IMG, true, 'enregistre', IMG], 'Enregistrer : la recette enregistrée, puis la photo web posée avec sa provenance ; l’import reste enregistre ; l’adresse demandée est l’annoncée');

        // 2. Sans candidat, aucune annonce et aucun POST : pas d'image, une photo de la personne, la même image web déjà là.
        await db.mutate({ puts: { recipes: [signet('rc_sans'), signet('rc_perso', { photo_sha256: H('a'), photo_origin: 'image' }), signet('rc_meme', { photo_sha256: H('b'), photo_origin: 'web', photo_source_url: IMG })] }, origin: 'device' });
        for (const [id, page, nom] of [['rc_sans', {}, 'sans image'], ['rc_perso', { image_url: IMG }, 'photo de la personne'], ['rc_meme', { image_url: IMG }, 'même image web déjà là']]) {
          const n = postsImage().length;
          root = await lireAvec(id, page);
          eq(annonce(root), null, `annonce absente (${nom})`);
          await enregistrer(root, id);
          eq(postsImage().length - n, 0, `${nom} : zéro POST image-web à l’enregistrement`);
        }
        const perso = await db.get('recipes', 'rc_perso');
        eq([perso.photo_sha256, perso.photo_origin], [H('a'), 'image'], 'une photo de la personne reste après l’enregistrement d’une lecture (I-F5)');

        // 3. S-12, les deux sens : un appel ne part que pour une adresse ANNONCÉE et encore candidate.
        await db.mutate({ puts: { recipes: [signet('rc_s1'), signet('rc_s2', { photo_sha256: H('c'), photo_origin: 'image' })] }, origin: 'device' });
        root = await lireAvec('rc_s1', { image_url: IMG });
        ok(!!annonce(root), 'S-12 : annonce affichée (rc_s1)');
        await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_s1')), photo_sha256: H('d'), photo_origin: 'image' }] }, origin: 'device' });
        let n = postsImage().length;
        await enregistrer(root, 'rc_s1');
        eq([postsImage().length - n, (await db.get('recipes', 'rc_s1')).photo_sha256], [0, H('d')], 'S-12 : annonce affichée, puis une photo posée dans un autre onglet avant « Enregistrer » → zéro POST, la photo reste');
        root = await lireAvec('rc_s2', { image_url: IMG });
        eq(annonce(root), null, 'S-12 : aucune annonce au rendu (fiche avec une photo de la personne)');
        await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_s2')), photo_sha256: null, photo_origin: null }] }, origin: 'device' });
        n = postsImage().length;
        await enregistrer(root, 'rc_s2');
        eq(postsImage().length - n, 0, 'S-12 : aucune annonce, puis photo retirée avant « Enregistrer » → zéro POST (rien n’a été annoncé)');

        // 4. TransitionRefusee : un autre onglet a enregistré juste avant → aucun POST image-web.
        await db.mutate({ puts: { recipes: [signet('rc_tr')] }, origin: 'device' });
        // La transition d'« Enregistrer » est la SEULE qui écrit une version (`puts.recipe_versions`) ; son `patch` est une FONCTION (`cloture`, plan B
        // rév. 2), jamais lue ici. L'autre onglet écrit `enregistre` juste avant ; la vraie transition refuse alors (TransitionRefusee). `courses`
        // prouve que la course a bien été simulée (sans lui, un faux repo qui ne se déclenche jamais laisserait l'enregistrement réussir).
        let courses = 0;
        const repoCourse = { ...repo, transitionner: async (store, key, opts) => {
          if (store === 'imports' && opts?.puts?.recipe_versions) { courses += 1; const l = await db.get('imports', key); await db.mutate({ puts: { imports: [{ ...l, status: 'enregistre' }] }, origin: 'device' }); }
          return repo.transitionner(store, key, opts);
        } };
        root = await lireAvec('rc_tr', { image_url: IMG }, { repo: repoCourse });
        ok(!!annonce(root), 'annonce affichée (rc_tr)');
        n = postsImage().length;
        bouton(root, 'Enregistrer').click();
        await attendre(() => root.etatRouteWeb().status !== 'a_verifier', 'écran redessiné après le refus');
        await PP.attendreRecuperation('rc_tr');
        eq([courses, postsImage().length - n, (await db.get('recipes', 'rc_tr')).photo_source_url ?? null, navs.some((x) => x.startsWith('/recipes/rc_tr'))], [1, 0, null, false],
          'TransitionRefusee à l’enregistrement (la course simulée UNE fois) → aucun POST image-web, rien d’écrit sur la fiche, aucune navigation');

        // 5. « Ajouter sans remplacer » (R-F-2, B-24) : la transaction sans put recipes, PUIS un POST ; réussite → les trois champs ; échec → fiche intacte.
        await db.mutate({ puts: { recipes: [signet('rc_aj', { availability: 'available', verification_state: 'verified', current_version_id: 'rv_rc_aj', original_title: 'Pâtes de Mamie' }),
          signet('rc_aj2', { availability: 'available', verification_state: 'verified', current_version_id: 'rv_rc_aj2', original_title: 'Pâtes de Papi' })], recipe_versions: [humaine('rc_aj'), humaine('rc_aj2')] }, origin: 'device' });
        root = await lireAvec('rc_aj', { image_url: IMG });
        ok(!!annonce(root), 'annonce affichée (rc_aj : une version écrite à la main)');
        const avantAj = await db.get('recipes', 'rc_aj');
        choix.suivant.push('ajouter'); evenements.length = 0; espionner();
        try { await enregistrer(root, 'rc_aj'); } finally { db.mutate = mutate; }
        const aj = await db.get('recipes', 'rc_aj');
        eq([evenements[0], evenements.indexOf('mutate:imports+recipe_versions') < evenements.indexOf('fetch:image-web'), evenements.filter((e) => e === 'fetch:image-web').length], ['mutate:imports+recipe_versions', true, 1],
          '« Ajouter sans remplacer » : la transaction n’a AUCUN put recipes (imports en condition, recipe_versions : B-24 inchangé), PUIS un POST image-web');
        eq([aj.current_version_id, aj.original_title, aj.photo_origin, aj.photo_source_url, /^[0-9a-f]{64}$/.test(aj.photo_sha256 ?? '')], [avantAj.current_version_id, 'Pâtes de Mamie', 'web', IMG, true],
          '« Ajouter sans remplacer », réussite : la version courante et le titre intacts, les trois champs de la photo écrits ENSEMBLE');
        root = await lireAvec('rc_aj2', { image_url: IMG });
        const avantAj2 = await db.get('recipes', 'rc_aj2');
        choix.suivant.push('ajouter'); images.push([502, { erreur: 'inaccessible' }]);
        n = postsImage().length;
        await enregistrer(root, 'rc_aj2');
        const pAj2 = await enFiche('rc_aj2');
        eq([postsImage().length - n, await db.get('recipes', 'rc_aj2'), pAj2.querySelector('[data-role="photo-web-etat"]')], [1, avantAj2, null],
          '« Ajouter sans remplacer », échec : un POST, puis la fiche INTACTE (aucune clé changée) et aucune ligne « non récupérée » (aucun candidat écrit)');
        pAj2.remove();

        // 6. « Annuler » du dialogue (B-13) : rien d'écrit, rien ne part.
        await db.mutate({ puts: { recipes: [signet('rc_an', { availability: 'available', verification_state: 'verified', current_version_id: 'rv_rc_an', original_title: 'Pâtes de Tata' })], recipe_versions: [humaine('rc_an')] }, origin: 'device' });
        root = await lireAvec('rc_an', { image_url: IMG });
        choix.suivant.push(null); choix.appels = 0; n = postsImage().length;
        bouton(root, 'Enregistrer').click();
        await attendre(() => choix.appels > 0 && !!bouton(root, 'Enregistrer') && !bouton(root, 'Enregistrer').disabled, 'dialogue fermé');
        await PP.attendreRecuperation('rc_an');
        eq([postsImage().length - n, (await ligneDe('rc_an')).status, PP.recuperationEnCours('rc_an')], [0, 'a_verifier', false], '« Annuler » du dialogue → zéro POST, l’import reste a_verifier');

        // 7. Échec du rapatriement (I-F4) : l'import reste enregistre, la version et availability intactes, la fiche dit « non récupérée ».
        await db.mutate({ puts: { recipes: [signet('rc_ec')] }, origin: 'device' });
        root = await lireAvec('rc_ec', { image_url: IMG });
        // Ronde 1 : le journal des cas 1 à 6 est EXACTEMENT l'échec de rc_aj2 (aucune autre erreur avalée par le collecteur) ; il est vidé ensuite.
        eq([...journal], ['[cuisine-os] photo_web.echec {"id":"rc_aj2","reason":"inaccessible"}'],'console (cas 1 à 6) : une seule erreur journalisée, l’échec du rapatriement de rc_aj2 — rien d’autre (import_web.*, photo_plat.*)');
        images.push([502, { erreur: 'inaccessible' }]); journal.length = 0; dits.length = 0;
        await enregistrer(root, 'rc_ec');
        const ec = await db.get('recipes', 'rc_ec');
        eq([(await db.byIndex('imports', 'recipe_id', 'rc_ec'))[0].status, ec.availability, ec.verification_state, !!(await db.get('recipe_versions', ec.current_version_id)), ec.photo_sha256 ?? null, ec.photo_source_url, journal.some((l) => l.includes('photo_web.echec'))],
          ['enregistre', 'available', 'to_verify', true, null, IMG, true], 'échec du rapatriement : import enregistre, version et availability intactes, photo_source_url gardé (rapatriement attendu), logError photo_web.echec');
        const pEc = await enFiche('rc_ec');
        eq([pEc.querySelector('[data-role="zone-photo-plat"]')?.textContent.includes('Photo du plat non récupérée.'), pEc.querySelector('[data-role="raison-photo-web"]'), dits], [true, null, ['Recette enregistrée']],
          'échec du rapatriement : la zone de la fiche dit « Photo du plat non récupérée. », AUCUNE raison (départ automatique) ; le seul toast est celui de l’enregistrement (aucun toast de l’image)');
        eq(fuiteImage(pEc), false, 'D-F11 (DOM, ronde 1) : la fiche enregistrée (photo_source_url posé) ne rend nulle part l’adresse de l’image ni son hôte (texte et balisage)');
        pEc.remove();

        // 8. Relecture (§ 4.3 point 4) : même image → rien ; autre image → un POST et la photo remplacée ; photo choisie à la main → rien (B-10, P-12).
        root = await lireAvec('rc_o', { image_url: IMG });
        eq(annonce(root), null, 'relecture, même image_url → aucune annonce');
        n = postsImage().length;
        await enregistrer(root, 'rc_o');
        eq(postsImage().length - n, 0, 'relecture, même image_url → aucun POST');
        const shaAvant = (await db.get('recipes', 'rc_o')).photo_sha256;
        root = await lireAvec('rc_o', { image_url: IMG2 });
        ok(!!annonce(root), 'relecture, autre image_url → annonce');
        images.push([200, IMAGE_B]); n = postsImage().length;
        await enregistrer(root, 'rc_o');
        const rel = await db.get('recipes', 'rc_o');
        eq([postsImage().length - n, postsImage().at(-1).url, rel.photo_sha256 !== shaAvant, rel.photo_origin, rel.photo_source_url], [1, IMG2, true, 'web', IMG2], 'relecture, autre image_url → un POST et la photo remplacée, avec SA provenance');
        const toile = new OffscreenCanvas(640, 480); const cx = toile.getContext('2d'); cx.fillStyle = '#36c'; cx.fillRect(0, 0, 640, 480);
        const mienne = new File([await toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], 'mienne.jpg', { type: 'image/jpeg' });
        eq((await PP.poserPhotoPlat('rc_o', mienne, { repo, origin: 'image' })).issue, 'ok', 'photo choisie à la main sur la photo web');
        const shaMienne = (await db.get('recipes', 'rc_o')).photo_sha256;
        root = await lireAvec('rc_o', { image_url: IMG2 });
        eq(annonce(root), null, 'B-10 : relecture de la même page après une photo choisie à la main → aucune annonce');
        n = postsImage().length;
        await enregistrer(root, 'rc_o');
        const apresMain = await db.get('recipes', 'rc_o');
        eq([postsImage().length - n, apresMain.photo_sha256, apresMain.photo_origin, apresMain.photo_source_url], [0, shaMienne, 'image', null], 'B-10 : zéro POST image-web, la photo de la personne intacte (I-F5)');

        // 10. SANS await (ronde 1, § 4.3 point 2, I-F4) : la réponse image-web RETENUE, « Enregistrer » a déjà navigué et dit « Recette enregistrée » ; la
        //     descente est en vol et la fiche montée s'ouvre sur « Récupération de la photo du plat… » ; relâchée, la photo est posée.
        await db.mutate({ puts: { recipes: [signet('rc_sa')] }, origin: 'device' });
        root = await lireAvec('rc_sa', { image_url: IMG });
        retenir(); n = postsImage().length; const navAvant = navs.length; dits.length = 0;
        bouton(root, 'Enregistrer').click();
        await attendre(() => navs.length > navAvant && postsImage().length > n, 'navigation pendant la descente retenue');
        const pSa = await enFiche('rc_sa');
        eq([PP.recuperationEnCours('rc_sa'), dits, pSa.querySelector('[data-role="photo-web-etat"]')?.textContent ?? null, (await db.get('recipes', 'rc_sa')).photo_sha256 ?? null, (await db.byIndex('imports', 'recipe_id', 'rc_sa'))[0].status],
          [true, ['Recette enregistrée'], 'Récupération de la photo du plat…', null, 'enregistre'], 'SANS await : réponse image-web retenue → « Enregistrer » a navigué et dit « Recette enregistrée » PENDANT la descente ; la fiche dit « Récupération de la photo du plat… » ; import enregistre, aucune photo encore');
        lacher(); await PP.attendreRecuperation('rc_sa'); pSa.remove();
        const sa = await db.get('recipes', 'rc_sa');
        eq([postsImage().length - n, sa.photo_origin, sa.photo_source_url, /^[0-9a-f]{64}$/.test(sa.photo_sha256 ?? '')], [1, 'web', IMG, true], 'SANS await : la réponse relâchée, UN POST et la photo web posée');

        // 11. L'annonce suit la fiche RELUE par charger(), jamais la copie du montage (ctx) (ronde 1) : une photo de la personne posée entre le montage et la
        //     lecture → aucune annonce, aucun POST ; une photo retirée entre-temps → l'annonce, et l'appel annoncé part.
        await db.mutate({ puts: { recipes: [signet('rc_b1'), signet('rc_b2', { photo_sha256: H('e'), photo_origin: 'image' })] }, origin: 'device' });
        root = await lireAvec('rc_b1', { image_url: IMG }, {}, async () => { await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_b1')), photo_sha256: H('f'), photo_origin: 'image' }] }, origin: 'device' }); });
        const annonceB1 = annonce(root); n = postsImage().length;
        await enregistrer(root, 'rc_b1');
        eq([annonceB1, postsImage().length - n, (await db.get('recipes', 'rc_b1')).photo_sha256], [null, 0, H('f')], 'annonce sur la fiche RELUE : une photo de la personne posée APRÈS le montage (ctx sans photo) → aucune annonce, zéro POST, la photo reste');
        root = await lireAvec('rc_b2', { image_url: IMG }, {}, async () => { await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_b2')), photo_sha256: null, photo_origin: null }] }, origin: 'device' }); });
        const annonceB2 = annonce(root)?.textContent ?? null; n = postsImage().length;
        await enregistrer(root, 'rc_b2');
        const b2 = await db.get('recipes', 'rc_b2');
        eq([annonceB2, postsImage().length - n, b2.photo_origin, b2.photo_source_url], [ANNONCE, 1, 'web', IMG], 'annonce sur la fiche RELUE : une photo retirée APRÈS le montage (ctx avec photo) → l’annonce, puis UN POST et la photo web posée');

        // 12. Hors ligne à « Enregistrer » (ronde 1, P-7 : enLigne transmis de l'écran jusqu'à la descente) : l'import et la version écrits, ZÉRO POST
        //     image-web, photo_source_url posé (rapatriement attendu, la fiche au cas 5), photo_sha256 nul.
        let horsLigne = false;
        await db.mutate({ puts: { recipes: [signet('rc_hl')] }, origin: 'device' });
        root = await lireAvec('rc_hl', { image_url: IMG }, { enLigne: () => !horsLigne });
        ok(!!annonce(root), 'annonce affichée (rc_hl, en ligne)');
        horsLigne = true; n = postsImage().length;
        await enregistrer(root, 'rc_hl');
        const hl = await db.get('recipes', 'rc_hl');
        eq([(await db.byIndex('imports', 'recipe_id', 'rc_hl'))[0].status, !!(await db.get('recipe_versions', hl.current_version_id)), postsImage().length - n, hl.photo_source_url, hl.photo_sha256 ?? null], ['enregistre', true, 0, IMG, null],
          'hors ligne à « Enregistrer » : import enregistre et version écrite, ZÉRO POST image-web, photo_source_url posé (rapatriement attendu), photo_sha256 nul');

        // 9. Filets : aucun réseau ; image_url n'est jamais rendue (D-F11, test de source sur import-web.js, puis le DOM de chaque aperçu à image — ronde 1) ;
        //    la console ne porte que l'échec attendu (ronde 1) ; le jeton de la session n'est écrit nulle part (ronde 1).
        eq([reseau, appels.every((a) => a.outil === 'lecture-web' || a.outil === 'image-web')], [0, true], 'aucun appel réseau hors du fetch injecté ; seuls lecture-web et image-web');
        eq(srcWeb.split('\n').filter((l) => l.includes('image_url') && /textContent|\bt\(|\bel\(/.test(l)), [], 'D-F11 : image_url n’entre dans aucune ligne d’import-web.js qui porte textContent, t( ou el(');
        eq([ecransImage.length, fuitesImage], [17, []], 'D-F11 (DOM, ronde 1) : aucun des 17 aperçus a_verifier d’une page à image ne rend IMG, IMG2 ni l’hôte cdn.site.test (texte ni balisage)');
        eq([...journal], ['[cuisine-os] photo_web.echec {"id":"rc_ec","reason":"inaccessible"}'],'console (cas 7 à 12) : une seule erreur journalisée, l’échec du rapatriement de rc_ec — rien d’autre');
        const SENTINELLE = SESSION.access_token;
        eq([JSON.stringify(await db.getAll('recipes')), JSON.stringify(await db.getAll('imports')), JSON.stringify(journal), scene.innerHTML].map((s) => s.includes(SENTINELLE)), [false, false, false, false],
          'le jeton de la session (sentinelle) n’est ni dans recipes, ni dans imports, ni au journal, ni dans le DOM');
      } finally {
        lacher(); db.mutate = mutate; console.error = vraiErreur; globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); V.reinitialiserVol(); W.reinitialiserLectureWeb();
        (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
      }
    }));
  } finally { setUiLocale(localeAvant); }
}
