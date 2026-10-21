// Tests du lot C « Table des matières sur plusieurs pages » (spec docs/superpowers/specs/2026-10-19-table-des-matieres-design.md, rév. 6 ;
// plan docs/superpowers/plans/2026-10-19-table-des-matieres.md). Fonctions pures sur des fixtures fixes, primitives sur bases jetables (withRepo),
// écrans à gestes injectés (repo, toast, confirmer, fetch, maintenant) ; aucun réseau ; chaque assertion nomme le mutant qu'elle tue.
// Les modules du lot sont importés DYNAMIQUEMENT (un module absent fait une ligne rouge nommée, jamais une page de tests blanche).
import { withRepo } from './sync-fixture.js';
import { on } from '../src/core/bus.js';
import { resetClock } from '../src/sync/clock.js';
import { setUiLocale, getUiLocale } from '../src/core/i18n.js';

const DATE = '2026-10-19T00:00:00.000Z';
const NOW = '2026-10-19T12:00:00.000Z';
const SESSION = { access_token: 'jeton-tdm-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
// LECTURE_5 (spec § 7) : cinq photos d'une table des matières (données fictives d'après la maquette), 23 entrées, plages disjointes. Les pages sont
// nommées par leur CONTENU (p1 = première page de la table) et ENVOYÉES DANS LE DÉSORDRE (ordre d'envoi 3, 1, 5, 2, 4) : l'ordre proposé diffère de
// l'envoi. Aucune entrée incertaine, aucune hors plage (0 puce « incertain » attendue).
const PAGES_TDM = {
  p1: { range: [8, 94], entries: [['Printemps', 'Velouté de petits pois', 8], ['Printemps', 'Salade de betteraves', 12], ['Printemps', 'Risotto aux champignons', 34], ['Printemps', 'Tarte aux pommes', 54], ['Printemps', 'Poire rôtie au miel', 64], ['Été', 'Salade de tomates', 72], ['Été', 'Gaspacho', 76], ['Été', 'Tian de courgettes', 88], ['Été', 'Clafoutis aux cerises', 94]] },
  p2: { range: [98, 158], entries: [['Automne', 'Soupe de courge', 98], ['Automne', 'Pâtes aux tomates confites', 116], ['Automne', 'Poulet aux champignons', 124], ['Hiver', 'Pot-au-feu', 140], ['Hiver', 'Gratin dauphinois', 148], ['Hiver', 'Bûche au chocolat', 158]] },
  p3: { range: [164, 180], entries: [['Les bases', 'Fond de volaille', 164], ['Les bases', 'Pâte brisée', 170], ['Les bases', 'Vinaigrette', 174], ['Les bases', 'Mayonnaise', 180]] },
  p4: { range: [182, 192], entries: [['Au fil des saisons', 'Confiture de fraises', 182], ['Au fil des saisons', 'Pesto', 186], ['Au fil des saisons', 'Pickles de légumes', 190], ['Au fil des saisons', 'Sirop d’érable maison', 192]] },
  p5: { range: null, entries: [] }, // page décorative
};
const ENVOI = ['p3', 'p1', 'p5', 'p2', 'p4'];
const blocDe = (id, i) => ({ photo: i + 1, printed_page_range: PAGES_TDM[id].range, entries: PAGES_TDM[id].entries.map(([section, title, printed_page]) => ({ title, printed_page, section, uncertain: false })) });
const LECTURE_5 = { photos: ENVOI.map(blocDe), uncertain: [] };
// « Risotto aux champignons » p. 34 et « Pâtes aux tomates confites » p. 116 existent déjà dans l'édition : 2 « déjà repérée », 21 créables.
const EXISTANTES = [{ original_title: 'Risotto aux champignons', printed_page: 34 }, { original_title: 'Pâtes aux tomates confites', printed_page: 116 }];
// Une lecture écrite par le lot A (D-C11, R-C-4) : l'ancienne forme { entries, uncertain }.
const LECTURE_A = { entries: [{ title: 'Tarte aux pommes', printed_page: 54, section: null, ingredients_mentioned: [] }, { title: 'Gaspacho', printed_page: 76, section: 'Été', ingredients_mentioned: ['tomate'] }], uncertain: [] };
const corpsModele = (lecture, extra = {}) => ({ model: 'claude-x', stop_reason: 'end_turn', content: [{ type: 'text', text: typeof lecture === 'string' ? lecture : JSON.stringify(lecture) }], ...extra });
const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
const SEANCE7 = ['q1', 'p3', 'p1', 'q4', 'p5', 'p2', 'p4']; // une séance de 7 pages : q1 et q4 ne sont pas des photos de la lecture
// Une ligne du journal, sorte index, sans référence, a_lancer — la forme que repo.ouvrirImport écrit (fixture posée par db.mutate, jamais par un écran).
const ligneJournal = ({ id, edition_id = null, scan_session_id = null, page_ids = [], device_id = null }) => ({ id, kind: 'index', edition_id, recipe_id: null, scan_session_id, page_ids: [...page_ids], photo_sha256: null, status: 'a_lancer', erreur: null, resultat: null, reponse_brute: null, appels: 0, model: null, duree_ms: null, device_id, document_id_vol: null, battement_at: null, started_at: null, finished_at: null });

export async function runTableMatieresTests({ eq, ok }) {
  resetClock();
  const localeAvant = getUiLocale();
  setUiLocale('fr'); // des textes français sont affirmés ; une suite antérieure a pu basculer l'interface
  // Aucun réseau réel (Global Constraints) : pendant toute la suite, globalThis.fetch lève. Un écran monté sans `fetch` injecté qui lancerait un vol
  // n'envoie donc aucun POST à la passerelle (sa lecture finit en échec, le test qui l'attendait rougit) ; seul T-C20 relit les sources par la fetch
  // réelle gardée ici, rendue en finally.
  const vraiFetch = globalThis.fetch;
  globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
  const run = async (nom, test) => {
    try { await test(); }
    catch (error) { ok(false, `Table des matières — ${nom} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };
  const raison = (fn) => { try { fn(); return 'acceptée'; } catch (e) { return [e?.name, e?.raison ?? e?.message]; } };
  // Ronde 1 : la valeur rendue, ou la levée NOMMÉE — un mutant qui fait lever n'interrompt pas le reste du bloc (une ligne rouge, pas un bloc perdu).
  const essai = (fn) => { try { return fn(); } catch (e) { return ['levée', e?.name, e?.raison ?? e?.message]; } };
  try {
    const L = await import('../src/domain/llm.js');
    const D = await import('../src/domain/table-matieres.js');
    const LU_5 = L.validerLectureIndex(LECTURE_5, { nbPhotos: 5 });
    const C = D.resultatIndex(LU_5, ENVOI); // la forme stockée (§ 3.2) de LECTURE_5

    // =================================================================================================================================
    // Tâche 1 — T-C1 validerLectureIndex (spec § 3.4, D-C17, R-C-1, Q1)
    await run('T-C1 validerLectureIndex', async () => {
      const V = (data, n = 5) => L.validerLectureIndex(data, { nbPhotos: n });
      const bloc = (photo, entries, plage = null) => ({ photo, printed_page_range: plage, entries });
      const entree = (title, printed_page = 1, section = null, uncertain = false) => ({ title, printed_page, section, uncertain });
      const un = (entries) => ({ photos: [bloc(1, entries)], uncertain: [] });
      eq(LU_5, { photos: LECTURE_5.photos, ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] }, 'T-C1 : LECTURE_5 → forme validée exacte (photos 1..5 construites, ecartees à 0, uncertain vide)');
      eq(L.BORNES_INDEX, { entrees: 400, titre: 200, section: 200, page: 9999, incertitudes: 40, incertitude: 200, ecartees: 9999, octets: 262144 }, 'T-C1 : la table BORNES_INDEX de la spec § 3.4');
      eq([Object.isFrozen(L.BORNES_INDEX), L.MAX_TOKENS_INDEX], [true, 8000], 'T-C1 : BORNES_INDEX gelée, MAX_TOKENS_INDEX 8000');
      eq([raison(() => V('x')), raison(() => V([])), raison(() => V({})), raison(() => V({ photos: 'x' }))], [['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'illisible']], 'T-C1 : racine non objet, tableau, sans photos, photos non tableau → illisible');
      eq(raison(() => V({ photos: [bloc(7, [entree('a')])] })), ['ErreurExtraction', 'hors_bornes'], 'T-C1 (M1) : un bloc « photo 7 » sur 5 photos → hors_bornes (un compte, pas une entrée)');
      eq([raison(() => V({ photos: [bloc(0, [entree('a')])] })), raison(() => V({ photos: [bloc(-1, [entree('a')])] })), raison(() => V({ photos: [bloc(6, [entree('a')])] })), raison(() => V({ photos: [bloc(5, [entree('a')])] })), raison(() => V({ photos: [bloc(0, [entree('A')]), bloc(1, [entree('B')])] }, 2))],
        [['ErreurExtraction', 'hors_bornes'], ['ErreurExtraction', 'hors_bornes'], ['ErreurExtraction', 'hors_bornes'], 'acceptée', ['ErreurExtraction', 'hors_bornes']], 'T-C1 (M1, A2, A3, ronde 1) : photo 0, photo −1 et photo N + 1 (6 sur 5) → hors_bornes ; photo N (5 sur 5) → acceptée ; des photos numérotées 0..N−1 → hors_bornes (jamais une entrée perdue sans compte ni une photo décalée)');
      eq(raison(() => V({ photos: [{ photo: '2', entries: [entree('a')] }] })), ['ErreurExtraction', 'illisible'], 'T-C1 (M2) : un numéro de photo non entier (« 2 ») → illisible');
      eq([V(un([entree('a')])).photos[0].printed_page_range, V({ photos: [bloc(1, [entree('a')], [64, 8])] }).photos[0].printed_page_range, V({ photos: [bloc(1, [entree('a')], [1, 10000])] }).photos[0].printed_page_range, V({ photos: [bloc(1, [entree('a')], [8])] }).photos[0].printed_page_range, V({ photos: [bloc(1, [entree('a')], [8, 94])] }).photos[0].printed_page_range],
        [null, null, null, null, [8, 94]], 'T-C1 (M3, M4) : plage absente, inversée [64, 8], bornée au-delà de 9 999, à un seul nombre → null ; [8, 94] gardée');
      eq([V({ photos: [bloc(1, [entree('a')], [54, 54])] }).photos[0].printed_page_range, V({ photos: [bloc(1, [entree('a')], [1, 9999])] }).photos[0].printed_page_range, V({ photos: [bloc(1, [entree('a')], [8, 94, 3])] }).photos[0].printed_page_range],
        [[54, 54], [1, 9999], null], 'T-C1 (M3, M4, A4, ronde 1) : une plage d’une seule page [54, 54] gardée (de ≤ a, bornes comprises) ; [1, 9 999] gardée ; une plage à trois nombres [8, 94, 3] → null (deux entiers exactement)');
      const long201 = 'é'.repeat(201); const long200 = 'é'.repeat(200);
      const r201 = V(un([entree(long201, 3), entree('Gaspacho', 76)]));
      eq([r201.photos[0].entries.map((e) => e.title), r201.ecartees, r201.uncertain], [['Gaspacho'], { trop_longues: 1, adresse: 0 }, []], 'T-C1 (M5, Q1) : un titre de 201 points de code → CETTE entrée écartée, les autres gardées, ecartees.trop_longues = 1, aucune chaîne de compte dans uncertain');
      ok(!r201.photos.some((p) => p.entries.some((e) => e.title.startsWith(long200))), 'T-C1 (M5b) : aucune entrée tronquée à 200 (aucun titre ne commence par les 200 premiers points de code de l’entrée longue)');
      eq(V(un([entree(long200, 3)])).photos[0].entries[0].title, long200, 'T-C1 : un titre de 200 points de code exactement est gardé');
      eq(essai(() => { const r = V(un([entree('Soupe', 3, long201), entree('Gaspacho', 76)])); return [r.photos[0].entries.map((e) => e.title), r.ecartees]; }), [['Gaspacho'], { trop_longues: 1, adresse: 0 }], 'T-C1 (M5c, A1) : une section de 201 points de code → l’entrée écartée (seule « Gaspacho » reste) ET comptée');
      eq(essai(() => { const r = V(un([entree('   '), entree(''), { title: 7, printed_page: 1 }, entree('Gaspacho', 76)])); return [r.photos[0].entries.map((e) => e.title), r.ecartees]; }), [['Gaspacho'], { trop_longues: 0, adresse: 0 }], 'T-C1 (A6, ronde 1) : un titre blanc, vide ou qui n’est pas une chaîne → entrée écartée SANS compte (rien n’était lisible : ecartees reste à 0)');
      eq(essai(() => { const r = V({ photos: [null, 'x', 7, [bloc(1, [entree('Volée')])], bloc(1, [null, 7, 'x', [entree('Volée')], entree('Gaspacho', 76)])], uncertain: [] }, 1); return [r.photos, r.ecartees]; }),
        [[{ photo: 1, printed_page_range: null, entries: [{ title: 'Gaspacho', printed_page: 76, section: null, uncertain: false }] }], { trop_longues: 0, adresse: 0 }], 'T-C1 (A18, ronde 1) : un bloc qui n’est pas un objet nu (null, « x », 7, un tableau) et une entrée qui n’en est pas un sont ÉCARTÉS sans compte — la lecture est gardée avec la seule entrée valide (jamais illisible, jamais une exception)');
      const adr = V(un([entree('voir www.exemple.test/x', 3), entree('Gaspacho', 76, 'sur evil.com/x')]));
      eq([adr.photos[0].entries, adr.ecartees], [[{ title: 'Gaspacho', printed_page: 76, section: null, uncertain: false }], { trop_longues: 0, adresse: 1 }], 'T-C1 (M6, M6b) : une adresse dans le titre → entrée écartée, ecartees.adresse = 1 ; une adresse dans la section → section null, entrée gardée');
      eq(V(un([{ title: 'Soupe', printed_page: '9', section: { a: 1 }, uncertain: 'oui' }])).photos[0].entries[0], { title: 'Soupe', printed_page: null, section: null, uncertain: false }, 'T-C1 (M7, M8) : page « 9 » (chaîne) → null ; section objet → null ; uncertain « oui » → false (vrai seulement si === true)');
      eq([V(un([entree('a', 0)])).photos[0].entries[0].printed_page, V(un([entree('a', 9999)])).photos[0].entries[0].printed_page, V(un([entree('a', 10000)])).photos[0].entries[0].printed_page, V(un([entree('a', 4.5)])).photos[0].entries[0].printed_page], [null, 9999, null, null], 'T-C1 (D-C17) : un numéro de page hors 1..9999 ou non entier → null (rien d’inventé), jamais un refus');
      const n = (k) => Array.from({ length: k }, (_, i) => entree('Recette ' + i, (i % 9999) + 1));
      eq([raison(() => V(un(n(401)))), raison(() => V(un(n(400))))], [['ErreurExtraction', 'hors_bornes'], 'acceptée'], 'T-C1 (M9) : 401 entrées gardées → hors_bornes ; 400 → acceptée');
      const dup = V({ photos: [bloc(1, [entree('A', 1)]), bloc(1, [entree('B', 2)], [1, 2]), bloc(2, [entree('C', 3)])] }, 3);
      eq([dup.photos.length, dup.photos[0].entries.map((e) => e.title), dup.photos[0].printed_page_range, dup.photos[2]], [3, ['A', 'B'], [1, 2], { photo: 3, printed_page_range: null, entries: [] }], 'T-C1 (M10, M11) : deux blocs « photo 1 » → entrées concaténées dans l’ordre, première plage non nulle gardée ; la photo 3 sans bloc → bloc vide ; photos.length = N');
      eq(V({ photos: [bloc(1, [entree('A', 8)], [8, 94]), bloc(1, [entree('B', 98)], [98, 158])] }, 1).photos[0].printed_page_range, [8, 94], 'T-C1 (M11, A5, ronde 1) : deux blocs « photo 1 » à plages non nulles DISTINCTES → la PREMIÈRE est gardée ([8, 94], jamais [98, 158])');
      const tropLongues = (k) => Array.from({ length: k }, () => entree(long201));
      const adresses = (k) => Array.from({ length: k }, () => entree('x www.a.com/b'));
      eq([raison(() => V(un([...tropLongues(10000), entree('Gaspacho', 76)]))), raison(() => V(un([...adresses(10000), entree('Gaspacho', 76)]))), essai(() => V(un([...tropLongues(9999), entree('Gaspacho', 76)])).ecartees)],
        [['ErreurExtraction', 'hors_bornes'], ['ErreurExtraction', 'hors_bornes'], { trop_longues: 9999, adresse: 0 }], 'T-C1 (A12, ronde 1) : 10 000 entrées trop longues, ou 10 000 adresses, écartées → hors_bornes (un compte ecartees > 9 999) ; 9 999 → acceptée, comptée');
      eq(V(un([entree('Tar\u202Ete\u200B aux pommes', 54)])).photos[0].entries[0].title, 'Tarte aux pommes', 'T-C1 (M12) : Cf (U+202E, U+200B) retirés d’un titre');
      eq([raison(() => V({ photos: [bloc(1, [])] })), raison(() => V(un([entree(long201), entree('x www.a.com/b')]))), raison(() => V({ photos: [] }))], [['ErreurExtraction', 'vide'], ['ErreurExtraction', 'vide'], ['ErreurExtraction', 'vide']], 'T-C1 (M13) : zéro entrée → vide ; toutes écartées → vide ; aucun bloc → vide');
      const parProto = { __proto__: { photo: 1, entries: [entree('Volée')] } }; // un LITTÉRAL : c'est le prototype qui porte photo et entries
      eq(raison(() => V({ photos: [parProto, bloc(2, [entree('Gaspacho', 76)])] })), ['ErreurExtraction', 'illisible'], 'T-C1 (M57) : un bloc dont « photo » n’est porté que par le prototype → illisible (lecture par Object.hasOwn)');
      const json = JSON.parse('{"photos":[{"__proto__":{"photo":1}},{"photo":2,"entries":[{"title":"Gaspacho","printed_page":76}]}]}');
      eq(raison(() => V(json)), ['ErreurExtraction', 'illisible'], 'T-C1 (M57) : une clé « __proto__ » rendue par JSON.parse est une clé comme une autre : ce bloc n’a pas de photo → illisible');
      eq([({}).photo, ({}).entries], [undefined, undefined], 'T-C1 (M57) : aucun prototype n’a été pollué');
      const ctor = JSON.parse('{"photos":[{"photo":1,"constructor":{"x":1},"entries":[{"title":"Gaspacho","printed_page":76,"constructor":"y"}]}],"uncertain":[]}');
      eq(V(ctor, 1).photos[0], { photo: 1, printed_page_range: null, entries: [{ title: 'Gaspacho', printed_page: 76, section: null, uncertain: false }] }, 'T-C1 : une clé « constructor » est ignorée (objets construits champ par champ)');
      eq(V(un([entree('Tar\ud800te', 54)])).photos[0].entries[0].title, 'Tarte', 'T-C1 (M58) : une demi-paire de substitution (Cs) est retirée');
      eq(V({ photos: [bloc(1, [entree('A')])], uncertain: ['x'.repeat(201), 'y'.repeat(200)] }).uncertain, ['y'.repeat(200)], 'T-C1 (M80) : une chaîne uncertain de 201 → écartée SANS compte (ce n’est pas une entrée), de 200 → gardée');
      eq(essai(() => { const r = V({ photos: [bloc(1, [entree('A')])], uncertain: ['va sur evil.com', 'https://x.y/z', 'photo floue'] }); return [r.uncertain, r.ecartees]; }), [['photo floue'], { trop_longues: 0, adresse: 0 }], 'T-C1 (ronde 1, I-C2) : une chaîne uncertain qui porte une adresse web (hôte nu ou schéma) est écartée SANS compte — elle irait en tête de « Incertain : … » ; les autres gardées');
      const u = (k) => Array.from({ length: k }, (_, i) => 'doute ' + i);
      eq([raison(() => V({ photos: [bloc(1, [entree('A')])], uncertain: u(41) })), raison(() => V({ photos: [bloc(1, [entree('A')])], uncertain: u(40) }))], [['ErreurExtraction', 'hors_bornes'], 'acceptée'], 'T-C1 : 41 chaînes uncertain → hors_bornes ; 40 → acceptée');
      const m81 = V({ photos: [bloc(1, [entree('A'), entree(long201), entree('www.x.com/y')])], uncertain: u(40) });
      eq([m81.uncertain, m81.ecartees], [u(40), { trop_longues: 1, adresse: 1 }], 'T-C1 (M81, Q1) : 40 chaînes du modèle + une entrée trop longue + une adresse → acceptée ; uncertain = les 40 chaînes du modèle SEULES ; ecartees = { 1, 1 }');
      eq(V({ photos: [bloc(1, [entree('A')])], ecartees: { trop_longues: 99, adresse: 99 }, uncertain: [] }).ecartees, { trop_longues: 0, adresse: 0 }, 'T-C1 (M101) : une clé racine « ecartees » de la réponse est IGNORÉE : les comptes sont ceux de l’app');
      // m1 : 400 entrées × (titre 200 + section 200) × caractères de 3 octets ≈ 480 Ko, au-dessus des 256 Kio ; 100 de ces entrées (≈ 120 Ko) passent.
      const lourdes = Array.from({ length: 400 }, (_, i) => entree('€'.repeat(199) + String(i % 10), (i % 9999) + 1, '€'.repeat(200)));
      eq([raison(() => V({ photos: [bloc(1, lourdes)] })), raison(() => V({ photos: [bloc(1, lourdes.slice(0, 100))] }))], [['ErreurExtraction', 'hors_bornes'], 'acceptée'], 'T-C1 (M59, m1) : une lecture de ≈ 480 Ko → hors_bornes (borne de 256 Kio) ; ≈ 120 Ko → acceptée (le refus vient bien de la taille)');
      eq([raison(() => L.texteBorne('x'.repeat(201), 200)), L.nettoyer('a\tb\u200B'), L.nettoyer(' x\r\ny '), L.nettoyer(7), L.longueur('😀é'), L.entierBorne(5, 9), L.entierBorne(10, 9)], [['ErreurExtraction', 'hors_bornes'], 'a b', 'x\ny', null, 2, 5, null], 'T-C1 (M82) : texteBorne lève toujours hors_bornes au-delà de sa borne ; nettoyer = sa partie nettoyage, à l’identique ; texteBorne, entierBorne, nettoyer et longueur exportées');
    });

    // T-C22 : INVISIBLES + \p{Cs} (S-11, partagé avec le lot A)
    await run('T-C22 INVISIBLES et Cs', async () => {
      eq([L.texteBorne('a\ud800b', 10), L.validateParsedRecipe({ title: 'T\udc00x', ingredients: [{ source_text: 'a' }], steps: [] }).title], ['ab', 'Tx'], 'T-C22 (M58) : une demi-paire de substitution est retirée par texteBorne, donc aussi d’une recette (les cas existants de validateParsedRecipe restent verts, tests/passerelle.js)');
    });

    // T-C21 : porteUneAdresse déménagée dans core/bornes.js (D-C13, B-17, F-8)
    await run('T-C21 porteUneAdresse', async () => {
      const B = await import('../src/core/bornes.js');
      const R = await import('../src/domain/recherche-web.js');
      eq([typeof B.porteUneAdresse, B.MOTIF_ADRESSE === R.MOTIF_ADRESSE, B.MOTIF_HOTE === R.MOTIF_HOTE], ['function', true, true], 'T-C21 : bornes.js exporte porteUneAdresse et les deux motifs ; recherche-web.js ré-exporte les MÊMES objets (une seule définition)');
      eq([B.porteUneAdresse === R.porteUneAdresse, B.normaliserPourAdresse === R.normaliserPourAdresse], [true, true], 'T-C21 (A15, ronde 1) : porteUneAdresse et normaliserPourAdresse de recherche-web.js sont aussi les MÊMES fonctions que celles de bornes.js (aucune copie qui pourrait diverger)');
      eq(['voir www.exemple.test/x', 'sur evil.com/x', 'la recette est sur evil.com', 'Le sel.Ca y est', 'ｗｗｗ．ｅｘｅｍｐｌｅ．ｃｏｍ', 'exemple。com', 'Soupe de courge', '15 min. Le four', 'Velouté 2.0'].map(B.porteUneAdresse), [true, true, true, true, true, true, false, false, false], 'T-C21 : porteUneAdresse (NFKC, U+3002) — les cas de la présentation du serveur, faux positif connu « sel.Ca » compris');
    });

    // T-C2 resultatIndex (§ 3.5)
    await run('T-C2 resultatIndex', async () => {
      eq(C.photos.map((p) => [p.page_id, p.printed_page_range?.[0] ?? null, p.entries.length]), [['p3', 164, 4], ['p1', 8, 9], ['p5', null, 0], ['p2', 98, 6], ['p4', 182, 4]], 'T-C2 (M14) : page_id = pageIds[photo − 1] sur l’ordre d’envoi 3,1,5,2,4');
      eq([Object.keys(C), Object.keys(C.photos[0]), C.ecartees, C.uncertain], [['photos', 'ecartees', 'uncertain'], ['page_id', 'printed_page_range', 'entries'], { trop_longues: 0, adresse: 0 }, []], 'T-C2 : la forme stockée (§ 3.2) — page_id au lieu du numéro de photo ; ecartees et uncertain repris');
      eq(D.resultatIndex({ ...LU_5, ecartees: { trop_longues: 2, adresse: 1 } }, ENVOI).ecartees, { trop_longues: 2, adresse: 1 }, 'T-C2 (A8, ronde 1) : les comptes ecartees de la lecture validée sont rendus TELS QUELS ({ 2, 1 }, jamais remis à 0 : le « {k} entrées écartées » de l’écran en dépend)');
      const melange = { photos: [LU_5.photos[2], LU_5.photos[0], LU_5.photos[4], LU_5.photos[1], LU_5.photos[3]], ecartees: LU_5.ecartees, uncertain: [] };
      eq(D.resultatIndex(melange, ENVOI).photos.map((p) => p.page_id), ENVOI, 'T-C2 (M15) : blocs rendus dans l’ordre 1..N quel que soit l’ordre de la lecture');
      const court = D.resultatIndex(L.validerLectureIndex({ photos: LECTURE_5.photos.slice(0, 2), uncertain: ['flou'] }, { nbPhotos: 2 }), ['p3', 'p1']);
      eq([court.photos.map((p) => p.page_id), court.uncertain], [['p3', 'p1'], ['flou']], 'T-C2 : autant de blocs que de pages ENVOYÉES (une page absente au vol n’a pas de bloc), aucun page_id inventé (le vol qui fournit ces pages : M83, tué par T-C25)');
    });

    // T-C3 revaliderResultatIndex (§ 3.5, m5, Q1, D-C11)
    await run('T-C3 revaliderResultatIndex', async () => {
      eq(D.revaliderResultatIndex(JSON.parse(JSON.stringify(C)), ENVOI), C, 'T-C3 (m5) : une forme C revient à l’identique (traduction page_id → photo puis retour)');
      const C40 = { ...C, ecartees: { trop_longues: 2, adresse: 1 }, uncertain: Array.from({ length: 40 }, (_, i) => 'doute ' + i) };
      eq(D.revaliderResultatIndex(C40, ENVOI), C40, 'T-C3 (M102, Q1) : 40 chaînes uncertain et ecartees {2, 1} → rendue identique (la borne de 40 ne voit que les chaînes du modèle)');
      eq([D.revaliderResultatIndex(C, ['p1', 'p2']), D.revaliderResultatIndex({ ...C, photos: [{ ...C.photos[0], page_id: 'pg_inconnue' }, ...C.photos.slice(1)] }, ENVOI), D.revaliderResultatIndex({ ...C, photos: [C.photos[0], C.photos[0]] }, ENVOI)], [null, null, null], 'T-C3 (M16) : un page_id hors des pages de la ligne, ou deux blocs pour la même page → null');
      const injecte = JSON.parse(JSON.stringify(C));
      injecte.photos[1].entries.push({ title: 'x'.repeat(201), printed_page: 3, section: null, uncertain: false });
      const rv = D.revaliderResultatIndex(injecte, ENVOI);
      eq([rv?.photos[1].entries.length, rv?.ecartees, rv?.uncertain, rv?.photos[0]], [9, { trop_longues: 1, adresse: 0 }, [], C.photos[0]], 'T-C3 (M16b) : un titre de 201 injecté en base → l’entrée perdue, ecartees.trop_longues gagne 1 SUR le compte stocké, le reste intact');
      const avecNuls = JSON.parse(JSON.stringify(C));
      avecNuls.photos[1].entries.unshift(null, 7);
      eq(essai(() => D.revaliderResultatIndex(avecNuls, ENVOI)), C, 'T-C3 (ronde 1) : une forme C relue du journal dont entries porte null et 7 → revalidée SANS ces deux entrées et sans exception (le reste identique, rien compté) — jamais une levée hors de revaliderResultatIndex');
      const plein = JSON.parse(JSON.stringify(C)); plein.ecartees = { trop_longues: 9999, adresse: 0 };
      const plusUn = JSON.parse(JSON.stringify(plein)); plusUn.photos[0].entries.push({ title: 'x'.repeat(201), printed_page: 3, section: null, uncertain: false });
      eq([D.revaliderResultatIndex(plein, ENVOI)?.ecartees, D.revaliderResultatIndex(plusUn, ENVOI)], [{ trop_longues: 9999, adresse: 0 }, null], 'T-C3 (A11, ronde 1) : un compte stocké à 9 999 est gardé ; 9 999 + une entrée trop longue injectée = 10 000 → null (la SOMME est bornée)');
      for (const [nom, e] of [['absent', undefined], ['-1', { trop_longues: -1, adresse: 0 }], ['1.5', { trop_longues: 1.5, adresse: 0 }], ['« 2 »', { trop_longues: '2', adresse: 0 }], ['10000', { trop_longues: 10000, adresse: 0 }], ['objet à clé __proto__', JSON.parse('{"__proto__":{"trop_longues":1,"adresse":0}}')]]) {
        eq(D.revaliderResultatIndex({ photos: C.photos, ...(e === undefined ? {} : { ecartees: e }), uncertain: [] }, ENVOI), null, `T-C3 (M103) : ecartees stocké ${nom} → null`);
      }
      eq(D.revaliderResultatIndex(LECTURE_A, ['pa', 'pb']), { photos: [{ page_id: null, printed_page_range: null, entries: [{ title: 'Tarte aux pommes', printed_page: 54, section: null, uncertain: false }, { title: 'Gaspacho', printed_page: 76, section: 'Été', uncertain: false }] }], ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] }, 'T-C3 (M17, D-C11) : une lecture du lot A → UNE photo inconnue, ecartees à 0');
      eq(['x', {}, [], null, JSON.parse('{"__proto__":{"photos":[]}}'), Object.create({ photos: C.photos, ecartees: C.ecartees })].map((b) => D.revaliderResultatIndex(b, ENVOI)), [null, null, null, null, null, null], 'T-C3 : « x », {}, [], null, une clé __proto__, des photos portées par le prototype → null');
    });

    // T-C4 ordrePropose (D-C3)
    await run('T-C4 ordrePropose', async () => {
      eq(D.ordrePropose(C.photos), ['p1', 'p2', 'p3', 'p4', 'p5'], 'T-C4 (M18, M19) : LECTURE_5 envoyée 3,1,5,2,4 → p1..p5 (tri par la PREMIÈRE page citée, plage nulle en queue)');
      eq(D.ordrePropose([{ page_id: 'a', printed_page_range: [8, 94] }, { page_id: 'b', printed_page_range: null }, { page_id: 'c', printed_page_range: [8, 10] }, { page_id: 'd', printed_page_range: [2, 200] }]), ['d', 'a', 'c', 'b'], 'T-C4 (M18, M20) : tri par [0] et non [1] ; deux photos à 8 gardent l’ordre d’envoi ; nulle en queue');
    });

    // T-C5 positions, séance, cochées, pages à lire (D-C15, S-19, F-9, N-2)
    await run('T-C5 positions, séance et pages à lire', async () => {
      const pp = new Map(SEANCE7.map((id, i) => [id, { id, position: i + 1 }]));
      const prop = D.positionsProposees(['p1', 'p2', 'p3', 'p4', 'p5'], pp, SEANCE7);
      eq(prop.pages.map((p) => [p.id, p.position]), [['p1', 2], ['p2', 3], ['p3', 5], ['p4', 6], ['p5', 7]], 'T-C5 (M21) : les positions déjà occupées par les 5 photos {2, 3, 5, 6, 7} réassignées dans l’ordre choisi');
      eq([prop.ordre, prop.pages.some((p) => p.id === 'q1' || p.id === 'q4'), pp.get('p1').position], [['p1', 'p2', 'p3', 'p4', 'p5'], false, 3], 'T-C5 : l’ordre rendu ; les pages hors lecture (q1, q4) ne sont pas touchées ; la Map d’entrée n’est pas modifiée (copies)');
      eq(D.reordonnerSeance(SEANCE7, ['p1', 'p2', 'p3', 'p4', 'p5']), ['q1', 'p1', 'p2', 'q4', 'p3', 'p4', 'p5'], 'T-C5 (M22) : page_ids de la séance — les 5 identifiants remis dans LEURS créneaux, q1 et q4 intacts');
      eq([D.reordonnerSeance(['a', 'b', 'c'], ['c', 'zz', 'a']), D.reordonnerSeance(['a', 'b'], ['b', 'b', 'a'])], [['c', 'b', 'a'], ['b', 'a']], 'T-C5 : un identifiant de l’ordre absent de la séance est ignoré ; un doublon de l’ordre ne duplique rien');
      const bizarres = new Map([['p1', { id: 'p1', position: 2 }], ['p2', { id: 'p2', position: 2 }], ['p3', { id: 'p3', position: null }], ['p4', { id: 'p4', position: 'x' }], ['p5', { id: 'p5', position: 6 }]]);
      eq(D.positionsProposees(['p5', 'p4', 'p3', 'p2', 'p1'], bizarres, ['p1', 'p2', 'p3', 'p4', 'p5']).pages.map((p) => [p.id, p.position]), [['p5', 2], ['p4', 2], ['p3', 6], ['p2', null], ['p1', 'x']], 'T-C5 (M60, S-19) : positions {2, 2, null, « x », 6} → créneaux triés (entiers d’abord, puis les autres par rang de séance), réassignés TELS QUELS dans l’ordre choisi');
      eq(essai(() => D.positionsProposees(['p2', 'zz', 'p1', 'p2'], new Map([['p1', { id: 'p1', position: 4 }], ['p2', { id: 'p2', position: 9 }]]), ['p1', 'p2'])), { pages: [{ id: 'p2', position: 4 }, { id: 'p1', position: 9 }], ordre: ['p2', 'p1'] }, 'T-C5 (A17, B14, ronde 1) : un identifiant de l’ordre absent de pagesParId est ignoré (jamais une exception) ; un doublon de l’ordre ne compte qu’une fois (deux pages, deux créneaux)');
      eq([D.memeOrdre(['a', 'b'], ['a', 'b']), D.memeOrdre(['a', 'b'], ['b', 'a']), D.memeOrdre(['a'], ['a', 'b']), D.memeOrdre(null, [])], [true, false, false, true], 'T-C5 : memeOrdre');
      eq([D.trierParSeance(['p5', 'p1', 'p3'], ['p1', 'p2', 'p3', 'p4', 'p5']), D.trierParSeance(['p9', 'p2'], ['p1', 'p2'])], [['p1', 'p3', 'p5'], ['p2']], 'T-C5 (M61, F-9) : les cochées remises dans l’ordre de la SÉANCE (jamais l’ordre de cochage) ; un identifiant hors séance écarté');
      const ligne = { page_ids: ['p2', 'p9', 'p1'] };
      const presentes = new Map([['p1', {}], ['p2', {}], ['p3', {}]]);
      eq([D.pagesALire([], ligne, ['p1', 'p2', 'p3'], presentes), D.pagesALire(['p3'], ligne, ['p1', 'p2', 'p3'], presentes), D.pagesALire(['p3', 'p1'], ligne, ['p1', 'p2', 'p3'], presentes), D.pagesALire(['p9'], ligne, ['p1', 'p2', 'p3', 'p9'], presentes), D.pagesALire([], null, ['p1'], presentes), D.pagesALire([], { page_ids: ['p2', 'p2', 'p1'] }, ['p1', 'p2', 'p3'], presentes)],
        [['p2', 'p1'], ['p3'], ['p1', 'p3'], ['p2', 'p1'], [], ['p2', 'p1']], 'T-C5 (M84, M85, M-C8, N-2) : rien de coché → les page_ids de la LIGNE présents, dans leur ordre, DÉDOUBLONNÉS (une donnée de synchro : un doublon enverrait deux fois la même image) ; des cochées → elles gagnent, triées par la séance ; une cochée absente de la base ne compte pas ; sans ligne ni cochée → []');
    });

    // T-C6 tableau, recalcul, plan, compteur, ligne ouverte (D-C4, D-C12, D-C16, D-C18, R-C-3)
    await run('T-C6 tableau et plan de création', async () => {
      const lt = D.lignesTableau(C, { ordre: D.ordrePropose(C.photos), existantes: EXISTANTES });
      eq([lt.length, lt.filter((l) => l.dejaReperee).map((l) => l.title), lt.filter((l) => l.dejaReperee).every((l) => !l.cochee && !l.creable)], [23, ['Risotto aux champignons', 'Pâtes aux tomates confites'], true], 'T-C6 (M23) : 23 lignes ; les deux « déjà repérée » décochées et non créables');
      eq(lt.map((l) => l.photo.page_id), [...Array(9).fill('p1'), ...Array(6).fill('p2'), ...Array(4).fill('p3'), ...Array(4).fill('p4')], 'T-C6 (D-C18) : photos dans l’ordre courant, puis entrées dans leur ordre');
      eq(lt[0], { cle: 'l4', photo: { page_id: 'p1', rang: 1, plage: [8, 94] }, titreLu: 'Velouté de petits pois', pageLue: 8, title: 'Velouté de petits pois', printed_page: 8, section: 'Printemps', uncertain: false, horsPlage: false, dejaReperee: false, enDouble: false, cochee: true, creable: true, decocheeParLaPersonne: false }, 'T-C6 : une ligne exacte (clé stable l{i} dans l’ordre du résultat STOCKÉ, rang courant de la photo, plage de la photo)');
      const deux = { photos: [{ page_id: 'pa', printed_page_range: null, entries: [{ title: 'Pesto', printed_page: 186, section: null, uncertain: false }, { title: ' pesto ', printed_page: 186, section: null, uncertain: false }] }], ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] };
      eq(D.lignesTableau(deux, { ordre: ['pa'], existantes: [] }).map((l) => [l.enDouble, l.creable, l.cochee]), [[false, true, true], [true, false, false]], 'T-C6 (M24) : deux entrées identiques (normalisées) → la seconde « en double », non créable');
      eq([D.cleReference('Tarte  aux Pommes', 54) === D.cleReference('tarte aux pommes', 54), D.cleReference('Pesto', null), D.cleReference('Pesto', null) === D.cleReference('Pesto', 186)], [true, 'pesto|', false], 'T-C6 (M25, M26) : clé normalisée (casse, espaces) ; la page, même nulle, est dans la clé');
      const editer = (lignes, i, champs) => D.recalculer(lignes.map((l, k) => (k === i ? { ...l, ...champs } : l)), EXISTANTES);
      const i = lt.findIndex((l) => l.title === 'Tarte aux pommes');
      let ls = editer(lt, i, { title: 'Risotto aux champignons', printed_page: 34 });
      eq([ls[i].dejaReperee, ls[i].cochee, ls[i].creable], [true, false, false], 'T-C6 : éditer une ligne vers un titre existant → déjà repérée, décochée, non créable');
      ls = editer(ls, i, { title: 'Tarte fine', printed_page: 54 });
      eq([ls[i].dejaReperee, ls[i].cochee, ls[i].creable], [false, true, true], 'T-C6 (M27) : rééditer vers un titre libre → recochée');
      ls = editer(editer(editer(ls, i, { cochee: false, decocheeParLaPersonne: true }), i, { title: 'Risotto aux champignons', printed_page: 34 }), i, { title: 'Tarte fine', printed_page: 54 });
      eq([ls[i].cochee, ls[i].creable], [false, true], 'T-C6 (M27) : … SAUF si la personne l’avait décochée elle-même');
      const hp = editer(lt, 0, { printed_page: 300 });
      eq([hp[0].horsPlage, hp[0].cochee, hp[0].creable], [true, true, true], 'T-C6 (D-C12, R-C-3) : une page hors de la plage lue de SA photo → horsPlage, la case RESTE cochée');
      eq(D.compteur(lt), { lues: 23, dejaDans: 2 }, 'T-C6 : compteur');
      const pl = D.planCreation(editer(editer(lt, 0, { cochee: false, decocheeParLaPersonne: true }), 1, { title: '  ' }));
      eq([pl.aCreer.length, pl.ecartees], [19, { dejaReperees: 2, enDouble: 0, decochees: 1, sansTitre: 1 }], 'T-C6 (M28) : planCreation exclut décochées, doubles, déjà repérées et titres vides');
      const imp = (id, status, updated_at, over = {}) => ({ id, kind: 'index', scan_session_id: 'ss1', status, updated_at, page_ids: [], ...over });
      const lignes = [imp('i1', 'a_verifier', '2026-10-19T10:00:00Z'), imp('i2', 'echec', '2026-10-19T11:00:00Z'), imp('i3', 'enregistre', '2026-10-19T12:00:00Z'), imp('i4', 'a_lancer', '2026-10-19T13:00:00Z', { kind: 'recette' }), imp('i5', 'a_lancer', '2026-10-19T14:00:00Z', { scan_session_id: 'ss2' }), imp('i6', 'nimporte', '2026-10-19T15:00:00Z')];
      eq([D.ligneOuverteDeSeance(lignes, 'ss1')?.id, D.ligneOuverteDeSeance(lignes, 'ss1', { importId: 'i1' })?.id, D.ligneOuverteDeSeance(lignes, 'ss1', { importId: 'i3' })?.id, D.ligneOuverteDeSeance(lignes, 'ssX'), D.ligneOuverteDeSeance(lignes, null), D.ligneOuverteDeSeance(null, 'ss1')],
        ['i2', 'i1', 'i2', null, null, null], 'T-C6 (M62, D-C16) : la ligne index OUVERTE la plus récente de la séance ; importId gagne s’il désigne une ligne ouverte de la séance ; une ligne terminale, d’une autre sorte, d’une autre séance ou au statut inconnu n’est jamais reprise');
      eq([D.ligneOuverteDeSeance(lignes, 'ss1', { importId: 'i5' })?.id, D.ligneOuverteDeSeance(lignes, 'ss1', { importId: 'i4' })?.id], ['i2', 'i2'], 'T-C6 (B4, D-C16, ronde 1) : un importId qui désigne une ligne OUVERTE d’une AUTRE séance (i5, ss2) ou d’une autre sorte (i4, recette) est ignoré : la ligne index ouverte la plus récente de CETTE séance est rendue');
    });

    // T-C7 cohérence page / plage (D-C12)
    await run('T-C7 coherencePagePlage', async () => {
      eq([D.coherencePagePlage(300, [8, 94]), D.coherencePagePlage(7, [8, 94]), D.coherencePagePlage(null, [8, 94]), D.coherencePagePlage(94, [8, 94]), D.coherencePagePlage(8, [8, 94]), D.coherencePagePlage(50, null)], [true, true, false, false, false, false], 'T-C7 (M29) : vrai seulement si page et plage sont connues et que la page sort de [de, a] (bornes comprises dedans)');
    });

    // T-C8 fabriquerReferences (D-C3, D-C5, D-C11, D-C14, R-C-2, I-C11)
    await run('T-C8 fabriquerReferences', async () => {
      let n = 0; const newId = (p) => `${p}_${++n}`;
      const edition = { id: 'ed1', language: 'fr' };
      const pagesParId = new Map(ENVOI.map((id) => [id, { id, kind: null, printed_page: null, position: 1 }]));
      const lt = D.lignesTableau(C, { ordre: D.ordrePropose(C.photos), existantes: EXISTANTES });
      const plan = D.planCreation(lt);
      const f = D.fabriquerReferences(plan, { edition, pagesParId, resultat: C, newId });
      eq(f.recipes[0], { id: 'rc_1', edition_id: 'ed1', original_title: 'Velouté de petits pois', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: 8, section: 'Printemps', type: null, tags: [], cuisines: [], favorite: false, source_page_ids: ['p1'], current_version_id: null, ingredient_ids: [], index_page_id: 'p1', raw_entry: 'Velouté de petits pois — 8', index_uncertain: false }, 'T-C8 : la fiche exacte d’une référence');
      eq([f.recipes.length, [...new Set(f.recipes.map((r) => r.index_page_id))]], [21, ['p1', 'p2', 'p3', 'p4']], 'T-C8 : 21 fiches, chacune liée à SA photo');
      const lt2 = D.lignesTableau(C, { ordre: D.ordrePropose(C.photos), existantes: [] });
      const edite = D.recalculer(lt2.map((l, k) => (k === 0 ? { ...l, title: 'Velouté de pois' } : k === 1 ? { ...l, printed_page: 300 } : l)), []);
      const f2 = D.fabriquerReferences(D.planCreation(edite), { edition, pagesParId, resultat: C, newId });
      eq([f2.recipes[0].original_title, f2.recipes[0].raw_entry, f2.recipes[1].index_uncertain, f2.recipes[1].printed_page, f2.recipes[1].raw_entry], ['Velouté de pois', 'Velouté de petits pois — 8', true, 300, 'Salade de betteraves — 12'], 'T-C8 (M30, M31) : titre édité → original_title édité, raw_entry LU ; page hors plage → index_uncertain');
      const petit = { photos: [{ page_id: 'p1', printed_page_range: [8, 94], entries: [{ title: 'Pesto', printed_page: 20, section: null, uncertain: true }, { title: 'Soupe', printed_page: null, section: null, uncertain: false }] }], ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] };
      const f4 = D.fabriquerReferences(D.planCreation(D.lignesTableau(petit, { ordre: ['p1'], existantes: [] })), { edition, pagesParId, resultat: petit, newId });
      eq(f4.recipes.map((r) => [r.original_title, r.index_uncertain, r.raw_entry, r.printed_page]), [['Pesto', true, 'Pesto — 20', 20], ['Soupe', false, 'Soupe', null]], 'T-C8 (A9, A10, ronde 1) : une entrée uncertain DANS sa plage → index_uncertain vrai (uncertain || horsPlage) ; une page lue nulle → raw_entry = le titre lu seul (jamais « Soupe — null »)');
      const cs = String.fromCharCode(0xd800); // une demi-paire de substitution seule (Cs), construite sans échappement dans le source
      const forges = D.recalculer([{ ...lt2[0], title: 'Velo' + cs + 'uté', section: 'Prin' + cs + 'temps', printed_page: -5 }, { ...lt2[1], printed_page: 123456 }, { ...lt2[2], printed_page: 9999 }, { ...lt2[3], printed_page: 4.5 }], []);
      const f5 = D.fabriquerReferences(D.planCreation(forges), { edition, pagesParId, resultat: C, newId });
      eq(f5.recipes.map((r) => [r.original_title, r.section, r.printed_page]), [['Velouté', 'Printemps', null], ['Salade de betteraves', 'Printemps', null], ['Risotto aux champignons', 'Printemps', 9999], ['Tarte aux pommes', 'Printemps', null]], 'T-C8 (S-11, § 4.4, ronde 1) : le fabricant, dernier mur avant recipes, retire une demi-paire de substitution (Cs) du titre et de la section, et ramène une printed_page hors 1..9 999 ou non entière à null (une ligne éditée ou forgée)');
      const pages2 = new Map([['p1', { id: 'p1', kind: null, printed_page: null }], ['p2', { id: 'p2', kind: 'recipe', printed_page: 9, role: null }], ['p4', { id: 'p4', kind: 'index', printed_page: 9 }], ['p5', { id: 'p5', kind: null, printed_page: null }]]); // p3 retirée entre lecture et création
      const f3 = D.fabriquerReferences(D.planCreation(lt2), { edition, pagesParId: pages2, resultat: C, newId });
      eq(f3.pageUpdates.map((p) => [p.id, p.kind, p.role, p.printed_page_range, p.printed_page]), [['p1', 'index', 'index', [8, 94], null], ['p5', 'index', 'index', null, null], ['p2', 'recipe', null, [98, 158], 9], ['p4', 'index', 'index', [182, 192], 9]], 'T-C8 (M63, M33, D-C14) : kind nul → index (+ role index) ; kind recipe GARDÉ, role non posé ; plage citée posée ; printed_page jamais écrit par C (nul reste nul, 9 reste 9)');
      const deP3 = f3.recipes.filter((r) => ['Fond de volaille', 'Pâte brisée', 'Vinaigrette', 'Mayonnaise'].includes(r.original_title));
      eq([deP3.length, deP3.every((r) => r.index_page_id === null && r.source_page_ids.length === 0), f3.pageUpdates.some((p) => p.id === 'p3')], [4, true, false], 'T-C8 (M34, I-C11) : une page retirée entre lecture et création → index_page_id null, source_page_ids [], aucune mise à jour de cette page');
      const formeA = D.revaliderResultatIndex(LECTURE_A, ['pa', 'pb', 'pz']);
      const fa = D.fabriquerReferences(D.planCreation(D.lignesTableau(formeA, { ordre: [null], existantes: [] })), { edition, pagesParId: new Map([['pa', { id: 'pa' }], ['pb', { id: 'pb' }]]), resultat: formeA, pageIdsLigne: ['pa', 'pb', 'pz'], newId });
      eq([fa.recipes.map((r) => [r.original_title, r.index_page_id, r.source_page_ids]), fa.pageUpdates], [[['Tarte aux pommes', null, ['pa', 'pb']], ['Gaspacho', null, ['pa', 'pb']]], []], 'T-C8 (M64, D-C11) : lecture du lot A → index_page_id null, source_page_ids = page_ids de la ligne filtrés sur les pages présentes ; aucune page mise à jour');
      const force = { ...lt.find((l) => l.dejaReperee), cochee: true };
      const fr = D.fabriquerReferences({ aCreer: [force, ...plan.aCreer], ecartees: plan.ecartees }, { edition, pagesParId, resultat: C, newId });
      eq([fr.recipes.length, fr.recipes.some((r) => r.original_title === force.title)], [21, false], 'T-C8 (M86, R-C-2) : une ligne « déjà repérée » forcée cochée dans le plan ne produit aucune fiche');
    });

    // executerIndex : extraireTableMatieres puis resultatIndex sur les pages ENVOYÉES (D-C21)
    await run('executerIndex', async () => {
      const prov = new L.PasserelleProvider({}, { session: SESSION, fetch: async () => reponse(200, corpsModele(LECTURE_5)) });
      const ex = await D.executerIndex({ provider: prov, images: ENVOI.map(() => ({ mime: 'image/jpeg', base64: 'AAAA' })), pageIds: ENVOI, signal: undefined });
      eq([ex.resultat, ex.modele, ex.texteBrut], [C, 'claude-x', JSON.stringify(LECTURE_5)], 'executerIndex : { resultat: resultatIndex(lecture, pageIds), texteBrut, modele }');
    });

    // T-C24 repo.transitionner : le sac conditions (§ 4.5, S-6)
    await run('T-C24 repo.transitionner et conditions', () => withRepo(async (repo, db) => {
      await db.mutate({ puts: { imports: [{ id: 'imp_c24', kind: 'index', status: 'a_verifier', page_ids: ['p1', 'p2'], created_at: DATE, updated_at: DATE }], scan_sessions: [{ id: 'ss_c24', status: 'open', page_ids: ['p0', 'p1', 'p2'], document_ids: [], created_at: DATE, updated_at: DATE }] }, origin: 'device' });
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push(Object.keys(m.puts).sort()); return capture ? capture(m) : {}; };
      const notifs = []; const off = on('change', (p) => notifs.push(p.store));
      let ecrite;
      try {
        ecrite = await repo.transitionner('imports', 'imp_c24', { attendus: ['a_verifier'], patch: { page_ids: ['p2', 'p1'] }, conditions: { scan_sessions: [{ key: 'ss_c24', attendus: ['open', 'done'], patch: (c) => ({ page_ids: [c.page_ids[0], 'p2', 'p1'], note: 'x\u0007' }) }] } });
      } finally { db.onMutate = capture; off(); }
      const s = await db.get('scan_sessions', 'ss_c24'); const i = await db.get('imports', 'imp_c24');
      eq([vus, i.page_ids, s.page_ids, s.note, s.updated_at > DATE, ecrite.id, ecrite.page_ids, notifs], [[['imports', 'scan_sessions']], ['p2', 'p1'], ['p0', 'p2', 'p1'], 'x', true, 'imp_c24', ['p2', 'p1'], ['imports', 'scan_sessions']], 'T-C24 : la ligne et la séance dans UNE transaction (un appel de db.onMutate, les deux fiches dans puts) ; le patch de la séance enveloppé comme celui de la ligne (contrôles retirés, updated_at) ; la valeur rendue reste la ligne ; un change par magasin');
      const ligneAvant = await db.get('imports', 'imp_c24');
      await db.delete('scan_sessions', 'ss_c24'); // supprimée entre la relecture et la transaction (synchro, autre onglet) : l'app n'écrit que open et done
      let refus = null;
      try { await repo.transitionner('imports', 'imp_c24', { attendus: ['a_verifier'], patch: { page_ids: ['p1'] }, conditions: { scan_sessions: [{ key: 'ss_c24', attendus: ['open', 'done'], patch: { page_ids: ['p1'] } }] } }); } catch (e) { refus = e; }
      eq([refus?.name, refus?.store, refus?.key, refus?.statut ?? null, await db.get('imports', 'imp_c24'), (await db.get('scan_sessions', 'ss_c24')) ?? null], ['TransitionRefusee', 'scan_sessions', 'ss_c24', null, ligneAvant, null], 'T-C24 (M79) : la séance absente (hors attendus) → TransitionRefusee nommée sur la séance, statut indéfini, RIEN d’écrit : la ligne relue identique, aucune séance recréée');
      let forme = null;
      try { await repo.transitionner('imports', 'imp_c24', { attendus: ['a_verifier'], patch: { page_ids: ['p9'] }, conditions: { scan_sessions: { key: 'ss_c24' } } }); } catch (e) { forme = e; }
      eq([forme?.name, await db.get('imports', 'imp_c24')], ['TypeError', ligneAvant], 'T-C24 : un sac conditions mal formé (pas un tableau) → TypeError, rien d’écrit (la ligne relue identique, son patch non posé)');
      // Ronde 1 : la forme « patch? » (vérification seule), la coexistence avec `autres` sur un même magasin, et la garde sur le magasin de la transition.
      const seanceV = { id: 'ss_v', status: 'open', page_ids: ['p1'], document_ids: [], created_at: DATE, updated_at: DATE };
      await db.mutate({ puts: { scan_sessions: [seanceV] }, origin: 'device' });
      const vus2 = []; const capture2 = db.onMutate;
      db.onMutate = (m) => { vus2.push(Object.keys(m.puts).sort()); return capture2 ? capture2(m) : {}; };
      try { await repo.transitionner('imports', 'imp_c24', { attendus: ['a_verifier'], patch: { page_ids: ['p1', 'p2'] }, conditions: { scan_sessions: [{ key: 'ss_v', attendus: ['open'] }] } }); } finally { db.onMutate = capture2; }
      eq([vus2, await db.get('scan_sessions', 'ss_v'), (await db.get('imports', 'imp_c24')).page_ids], [[['imports']], seanceV, ['p1', 'p2']], 'T-C24 (A13, ronde 1) : une condition SANS patch vérifie seulement — la séance relue identique (updated_at inchangé), un seul magasin dans puts (rien en file pour elle) ; la ligne est écrite');
      let refusAutres = null;
      try { await repo.transitionner('imports', 'imp_c24', { attendus: ['a_verifier'], patch: { page_ids: ['p9'] }, autres: { scan_sessions: [{ key: 'ss_absente', attendus: ['open'] }] }, conditions: { scan_sessions: [{ key: 'ss_v', attendus: ['open'], patch: { page_ids: ['p9'] } }] } }); } catch (e) { refusAutres = e; }
      eq([refusAutres?.name, refusAutres?.key, (await db.get('imports', 'imp_c24')).page_ids, await db.get('scan_sessions', 'ss_v')], ['TransitionRefusee', 'ss_absente', ['p1', 'p2'], seanceV], 'T-C24 (A14, ronde 1) : `autres` et `conditions` sur le MÊME magasin coexistent — la condition brute d’autres (séance absente) refuse la transition, rien d’écrit (ni la ligne ni la séance)');
      let surSoi = null;
      try { await repo.transitionner('imports', 'imp_c24', { attendus: ['a_verifier'], patch: { page_ids: ['p8'] }, conditions: { imports: [{ key: 'imp_autre', attendus: ['a_lancer'] }] } }); } catch (e) { surSoi = e; }
      eq([surSoi?.name, (await db.get('imports', 'imp_c24')).page_ids], ['TypeError', ['p1', 'p2']], 'T-C24 (ronde 1) : comme `autres`, le sac `conditions` ne porte pas de condition sur le magasin de la transition (TypeError avant toute écriture, rien d’écrit)');
    }));

    // --- (repère) les tâches suivantes ajoutent leurs blocs AU-DESSUS de cette ligne
  } catch (error) {
    ok(false, `Table des matières : suite interrompue — ${error?.name || 'Erreur'} — ${error?.message || String(error)}`);
  } finally { globalThis.fetch = vraiFetch; setUiLocale(localeAvant); }
}
