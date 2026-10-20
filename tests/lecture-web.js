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
      eq(W.lirePage({ page: { auteur: 'A' + String.fromCodePoint(0x202e, 0x200b) + 'b' } }).page.auteur, 'Ab', 'lirePage (S-1) : Cc / Cf retirés de l’auteur');
      const menteur = W.lirePage({ page: { url_finale: 'https://evil.test/', site: 'ricardocuisine.com', auteur: 'voir evil.com' } }).page;
      eq([menteur.site, menteur.auteur, menteur.hote], [null, null, 'evil.test'], 'lirePage (S-2) : un site ou un auteur qui porte une adresse → null ; l’hôte reste celui de l’adresse réelle');
      eq([W.lirePage(null).page.url_finale, W.lirePage({ page: [] }).page.autres_recettes], [null, 0], 'lirePage : une forme hostile ne lève pas');
      const source = await lire('../src/domain/lecture-web.js');
      const corps = source.slice(source.indexOf('export function lirePage('), source.indexOf('\n}\n', source.indexOf('export function lirePage(')));
      eq(['url_finale', 'titre_page', 'auteur', 'site', 'lue_le'].map((k) => corps.includes(`borner(propre(p, '${k}')`)).concat(['stop_reason', 'model'].map((k) => corps.includes(`borner(propre(corps, '${k}')`))), [true, true, true, true, true, true, true], 'lirePage (S-1, test de source) : chacune des sept lectures passe par borner(');
    });

    await run('lecture', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const { BORNES_EXTRACTION, ErreurExtraction } = await import('../src/domain/llm.js');
      const PAGE = { url_finale: 'https://a.test/r', hote: 'a.test', titre_page: 'T', auteur: null, site: null, lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 0, texte_coupe: false };
      const RECETTE = { title: 'Pâtes puttanesca', servings: 4, prep_minutes: 20, cook_minutes: 60, total_minutes: 80, ingredients: [{ source_text: '250 g de spaghettis', uncertain: false }, { source_text: '2 gousses d’ail', uncertain: true }], steps: [{ text: 'Cuire.' }, { text: 'Mélanger.\nServir.' }], printed_page: 12, sub_recipes: [], uncertain_fields: [], notes: null, incomplete: false, missing_page: true };
      const refus = (corps) => { try { W.lireLecture(corps); return 'lu'; } catch (e) { return e instanceof ErreurExtraction ? e.raison : 'autre:' + e?.message; } };
      const jsonld = W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: RECETTE, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null });
      eq([jsonld.source_kind, jsonld.recette.title, jsonld.recette.ingredients.length, jsonld.recette.steps[1].text, jsonld.recette.total_minutes, jsonld.usage], ['jsonld', 'Pâtes puttanesca', 2, 'Mélanger.\nServir.', 80, { input_tokens: 0, output_tokens: 0 }], 'lireLecture : jsonld objet → recette validée, étape multi-ligne intacte, total_minutes lu (B-8)');
      eq([jsonld.recette.printed_page, jsonld.recette.missing_page], [null, false], 'lireLecture : printed_page et missing_page forcés à null / false (rien d’une page web n’est une page de livre)');
      eq(JSON.parse(jsonld.texteBrut).title, 'Pâtes puttanesca', 'lireLecture : la réponse brute d’un JSON-LD est la recette reçue, en JSON');
      const modele = W.lireLecture({ source_kind: 'modele', page: PAGE, recette: 'Voici :\n' + JSON.stringify({ ...RECETTE, total_minutes: 80 }) + '\nBon appétit.', stop_reason: 'end_turn', model: 'claude-x' });
      eq([modele.source_kind, modele.recette.title, modele.recette.total_minutes, modele.modele, modele.stopReason], ['modele', 'Pâtes puttanesca', 80, 'claude-x', 'end_turn'], 'lireLecture : modele texte → parseJsonLoose → recette');
      eq([refus({ source_kind: 'modele', page: PAGE, recette: '{}', stop_reason: 'max_tokens' }), refus({ source_kind: 'modele', page: PAGE, recette: 'pas de JSON ici' }), refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, title: 'x'.repeat(201) } }), refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, ingredients: [], steps: [] } }), refus({ source_kind: 'autre', page: PAGE, recette: RECETTE }), refus({ source_kind: 'modele', page: PAGE, recette: RECETTE })],
        ['coupe', 'illisible', 'hors_bornes', 'vide', 'illisible', 'illisible'], 'lireLecture : max_tokens → coupe ; prose sans JSON → illisible ; titre de 201 → hors_bornes ; zéro ligne et zéro étape → vide ; source_kind « autre » → illisible ; modele non texte → illisible');
      { let e = null; try { W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, ingredients: Array.from({ length: 81 }, (_, i) => ({ source_text: 'l' + i })) } }); } catch (x) { e = x; }
        eq([e?.raison, e?.sourceKind, typeof e?.texteBrut], ['hors_bornes', 'jsonld', 'string'], 'lireLecture : un refus porte la nature de la source (deux textes pour hors_bornes, F-16) et la réponse brute'); }
      eq([80, '80', 2000, -1, 1.5].map((tm) => W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, total_minutes: tm } }).recette.total_minutes), [80, null, null, null, null], 'lireLecture : total_minutes entier 0..1440, sinon null');
      const coupee = W.lireLecture({ source_kind: 'modele', page: { ...PAGE, texte_coupe: true }, recette: JSON.stringify(RECETTE) });
      ok(coupee.recette.uncertain_fields.includes('La page était longue : la fin n’a pas été lue.'), 'lireLecture : texte_coupe → uncertain_fields contient « La page était longue : la fin n’a pas été lue. » (B-9)');
      const pleine = W.lireLecture({ source_kind: 'modele', page: { ...PAGE, texte_coupe: true }, recette: JSON.stringify({ ...RECETTE, uncertain_fields: Array.from({ length: 40 }, (_, i) => 'champ ' + i) }) });
      eq(pleine.recette.uncertain_fields.length, 40, 'lireLecture : 40 entrées du modèle → l’entrée de la coupe est écartée (le plafond vaut aussi pour elle)');
      ok(W.relireResultat({ source_kind: 'modele', page: { ...PAGE, texte_coupe: true }, recette: pleine.recette }) !== null, 'relireResultat : une lecture stockée au plafond se relit sans refus (aucune entrée ajoutée deux fois)');

      // R-B-2 / § 3.5 bis : une adresse dans le TITRE refuse (lien) ; ailleurs elle est RETIRÉE et dite, la lecture est ADMISE.
      const lu = (champs) => W.lireLecture({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, uncertain_fields: [], ...champs } }).recette;
      eq(refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, title: 'voir https://evil.test' } }), 'lien', 'adresses : titre « voir https://evil.test » → lien (le seul refus)');
      const ligne = lu({ ingredients: [{ source_text: 'voir https://evil.test/x', uncertain: false }, { source_text: '1 oignon', uncertain: false }] });
      eq([ligne.ingredients.map((i) => [i.source_text, i.uncertain]), ligne.uncertain_fields], [[['voir [adresse retirée]', true], ['1 oignon', false]], ['adresse retirée dans la ligne 1']], 'adresses : une ligne → fragment remplacé, ligne incertaine, une entrée « adresse retirée dans la ligne 1 » ; lecture ADMISE (mutant « lecture refusée pour une adresse dans une ligne » : rouge)');
      const etape = lu({ steps: [{ text: 'voir www.evil.test' }, { text: 'Servir (recette sur blog.ricardocuisine.com/x).' }, { text: 'a https://a.test/1 et https://b.test/2 fin' }] });
      eq([etape.steps.map((s) => s.text), etape.uncertain_fields], [['voir [adresse retirée]', 'Servir (recette sur [adresse retirée]).', 'a [adresse retirée] et [adresse retirée] fin'], ['adresse retirée dans l’étape 1', 'adresse retirée dans l’étape 2', 'adresse retirée dans l’étape 3']], 'adresses : étapes — www., sous-domaine (parenthèse et point gardés), deux adresses → deux marqueurs et UNE entrée (mutant « adresse gardée dans une étape » : rouge)');
      const notes = lu({ notes: 'Recette tirée de https://a.test/x' });
      eq([notes.notes, notes.uncertain_fields], ['Recette tirée de [adresse retirée]', ['adresse retirée dans les notes']], 'adresses : notes → fragment remplacé, entrée « adresse retirée dans les notes », lecture ADMISE');
      const pleineChasse = lu({ steps: [{ text: 'voir www' + String.fromCodePoint(0xff0e) + 'evil' + String.fromCodePoint(0xff0e) + 'test' }] });
      eq(pleineChasse.steps[0].text, '[adresse retirée]', 'adresses : points pleine chasse (détectés en NFKC, non isolables) → le texte entier devient le marqueur');
      eq(refus({ source_kind: 'jsonld', page: PAGE, recette: { ...RECETTE, ingredients: [{ source_text: 'x'.repeat(295) + 'www.a' }] } }), 'hors_bornes', 'adresses : une ligne de 300 qui finit par www.a → le marqueur (17) déborde → hors_bornes, jamais tronquée');
      eq(lu({ steps: Array.from({ length: 41 }, (_, i) => ({ text: `Étape ${i} : voir https://e${i}.test/x` })) }).uncertain_fields.length, BORNES_EXTRACTION.champsIncertains, 'adresses : 41 étapes à adresse → 40 entrées au plus');
      eq(lu({ uncertain_fields: ['voir evil.com', 'quantité illisible'] }).uncertain_fields, ['quantité illisible'], 'adresses (S-7) : une entrée d’uncertain_fields qui porte une adresse est écartée, sans refuser');
      eq(lu({ steps: [{ text: 'Couper en dés de 2.5 cm.' }, { text: 'Four à 180°C/350°F, env. 10 min.' }, { text: 'Comme sur ricardocuisine.com, saler.' }] }).steps.map((s) => s.text), ['Couper en dés de 2.5 cm.', 'Four à 180°C/350°F, env. 10 min.', 'Comme sur ricardocuisine.com, saler.'], 'adresses : « 2.5 cm », « 180°C/350°F », « env. 10 min » passent ; MOTIF_HOTE jamais appliqué au contenu (un hôte nu passe)');
      eq(t('[adresse retirée]').length, 17, 'adresses : le marqueur fait 17 points de code');
      eq(W.retirerAdresses({ title: 'T', ingredients: [], steps: [{ text: 'https://a.test/x' }], notes: null, uncertain_fields: [] }).retraits, [{ champ: 'etape', position: 1 }], 'retirerAdresses : rend les retraits (champ, position 1-based)');
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
      eq(version.provenance, { source_url: 'https://ricardocuisine.com/r/1', url_finale: 'https://www.ricardocuisine.com/r/1', source_kind: 'jsonld', lue_le: '2026-10-19T12:00:00.000Z', model: null, generated_by: 'ai', auteur: 'Ricardo', site: 'Ricardo Cuisine', import_id: 'imp_1', incomplete: false, missing_page: false, titre_lu: 'Pâtes puttanesca', titre_signet: 'ricardocuisine.com', source_page_ids: [], source_document_id: null, edition_id: 'ed1', convention_snapshot: null }, 'fabriquerLectureWeb : provenance exacte (§ 3.3) — source_url du signet, url_finale de la page, auteur et site de CE jour (B-25), titre_signet (D-B24)');
      eq([version.kind, version.recipe_id, version.parent_version_id, version.constraints, version.changes, version.total_minutes, version.notes, version.verification_state, version.created_at], ['extraction', 'rc_s', null, {}, '', 80, 'Classique.', 'to_verify', '2026-10-19T12:00:01.000Z'], 'fabriquerLectureWeb : version extraction, constraints {} et changes \'\' (F-13), total_minutes (B-8)');
      eq(version.ingredients.map((l) => [l.source_text, l.uncertain, l.verification_state]), [['250 g de spaghettis', false, 'to_verify'], ['2 gousses d’ail', true, 'to_verify']], 'fabriquerLectureWeb : lignes à vérifier, uncertain recopié');
      eq([version.steps.map((s) => [s.position, s.text]), version.steps[0].timers?.[0]?.seconds], [[[1, 'Cuire 10 minutes.'], [2, 'Mélanger.\nServir.']], 600], 'fabriquerLectureWeb : étapes multi-lignes intactes, detectTimers posé');
      eq([W.fabriquerLectureWeb({ ...RECETTE, incomplete: true }, { signet: SIGNET, page: PAGE, sourceKind: 'modele' }).recipe.availability, W.fabriquerLectureWeb({ ...RECETTE, steps: [] }, { signet: SIGNET, page: PAGE, sourceKind: 'modele' }).recipe.availability], ['partial', 'partial'], 'fabriquerLectureWeb : partial si incomplete ou sans étape');
      const avant = { id: 'rv_0', recipe_id: 'rc_s', kind: 'extraction', provenance: { generated_by: 'ai' }, verification_state: 'to_verify' };
      const relu = W.fabriquerLectureWeb(RECETTE, { signet: { ...SIGNET, original_title: 'Mes pâtes', current_version_id: 'rv_0' }, versions: [avant], page: PAGE, sourceKind: 'jsonld' });
      eq([relu.recipe.original_title, relu.version.provenance.titre_lu, relu.version.provenance.titre_signet, relu.version.parent_version_id, relu.remplacement], ['Mes pâtes', 'Pâtes puttanesca', null, 'rv_0', false], 'titre (D-B24) : avec une version (relecture), le titre est conservé, titre_lu posé ; une version ai seule ne demande pas de remplacement');
      eq(W.fabriquerLectureWeb({ ...RECETTE, title: 'é'.repeat(400) }, { signet: SIGNET, page: PAGE, sourceKind: 'modele' }).recipe.original_title, 'é'.repeat(300), 'titre (D-B24) : un titre lu de 400 est borné à LIMITES_SIGNET.titre');
      const v = (kind, generated_by, verification_state) => ({ id: 'v', kind, provenance: { generated_by }, verification_state });
      // R-B-19 (amendement du chef d'orchestre) : la règle I-5 de VF-7 du lot A (src/domain/import-cible.js, `remplacement` de fabriquerExtraction, non
      // exportée) — seules les versions non ai de kind extraction | correction comptent ; une adaptation ou une traduction ne devient jamais courante.
      eq([W.versionHumaine([v('extraction', 'manual', 'to_verify')]), W.versionHumaine([v('correction', 'manual', 'to_verify')]), W.versionHumaine([v('correction', 'ai', 'to_verify')]), W.versionHumaine([v('extraction', 'ai', 'verified')]), W.versionHumaine([v('extraction', 'ai', 'to_verify')]), W.versionHumaine([v('adaptation', 'manual', 'verified')]), W.versionHumaine([v('translation', 'manual', 'to_verify')]), W.versionHumaine([v('extraction', 'ai', 'to_verify'), v('correction', 'manual', 'verified')]), W.versionHumaine([]), W.versionHumaine(null)], [true, true, false, false, false, false, false, true, false, false], 'remplacement (R-B-19, VF-7 du lot A) : vrai avec une extraction ou une correction non ai ; faux avec une version ai (même vérifiée), une adaptation ou une traduction, aucune version');
      const garde = W.fabriquerLectureWeb(RECETTE, { signet: { ...SIGNET, current_version_id: 'rv_m' }, versions: [v('extraction', 'manual', 'verified')], page: PAGE, sourceKind: 'jsonld', remplacer: false });
      eq([garde.recipe, garde.version.kind, garde.version.id !== garde.recipe.current_version_id, garde.remplacement], [{ ...SIGNET, current_version_id: 'rv_m' }, 'extraction', true, true], 'remplacer: false (F-3) : la fiche est le signet relu INTACT (aucun source_*, availability et courante inchangées) ; la version est fabriquée quand même');
      let e = null; try { W.fabriquerLectureWeb(RECETTE, { signet: SIGNET, page: PAGE, sourceKind: 'bidon' }); } catch (x) { e = x; }
      eq([e?.name, e?.champ], ['ErreurVocabulaire', 'source_kind'], 'fabriquerLectureWeb : source_kind hors SOURCE_KINDS → ErreurVocabulaire');
      const sansCommentaires = (s) => s.replace(/\/\/.*$/gm, '');
      ok((sansCommentaires(await lire('../src/domain/lecture-web.js')).match(/assertVocabulaire\(/g) || []).length >= 2, 'vocabulaire : lecture-web.js (sixième fabricant) appelle assertVocabulaire( hors commentaire (test de source, faible, admis)');
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
