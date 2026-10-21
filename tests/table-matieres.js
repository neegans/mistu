// Tests du lot C « Table des matières sur plusieurs pages » (spec docs/superpowers/specs/2026-10-19-table-des-matieres-design.md, rév. 6 ;
// plan docs/superpowers/plans/2026-10-19-table-des-matieres.md). Fonctions pures sur des fixtures fixes, primitives sur bases jetables (withRepo),
// écrans à gestes injectés (repo, toast, confirmer, fetch, maintenant) ; aucun réseau ; chaque assertion nomme le mutant qu'elle tue.
// Les modules du lot sont importés DYNAMIQUEMENT (un module absent fait une ligne rouge nommée, jamais une page de tests blanche).
import { withRepo } from './sync-fixture.js';
import { on } from '../src/core/bus.js';
import { resetClock } from '../src/sync/clock.js';
import { setUiLocale, getUiLocale } from '../src/core/i18n.js';
import { sha256Hex } from '../src/core/hash.js';

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
const COULEURS = ['#811', '#181', '#118', '#881', '#188', '#818', '#444', '#a50'];
// Une vraie image (pagePourEnvoi la décode) : couleur différente → octets et empreinte différents.
async function imageDe(nom, couleur) {
  const c = new OffscreenCanvas(320, 240); const cx = c.getContext('2d');
  cx.fillStyle = couleur; cx.fillRect(0, 0, 320, 240); cx.fillStyle = '#fff'; cx.fillRect(10, 10, 160, 120);
  return new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' });
}
// Une bibliothèque minimale sur la base jetable : un livre « Saisons », son édition ed1, les références EXISTANTES, les pages nommées dans `seances`
// (position = rang dans la première séance qui les nomme ; octets réels seulement si `octets`), une séance ouverte par entrée de `seances`.
async function poserBibliotheque(repo, db, { seances = { ss1: ENVOI }, octets = false, existantes = EXISTANTES, kinds = {} } = {}) {
  const ids = [...new Set(Object.values(seances).flat())];
  const posDe = (id) => { for (const s of Object.values(seances)) { const k = s.indexOf(id); if (k >= 0) return k + 1; } return null; };
  const pages = [];
  for (const [i, id] of ids.entries()) {
    let sha256 = 'sha-' + id;
    if (octets) { const f = await imageDe(id + '.jpg', COULEURS[i % COULEURS.length]); sha256 = await sha256Hex(f); await repo.putFile(sha256, f, { original_filename: f.name }); }
    pages.push({ id, document_id: null, edition_id: 'ed1', sha256, printed_page: null, file_position: null, locator: null, position: posDe(id), issues: [], kind: kinds[id] ?? null, created_at: DATE, updated_at: DATE });
  }
  const recettes = existantes.map((e, i) => ({ id: 'rc_ex' + i, edition_id: 'ed1', original_title: e.original_title, original_language: 'fr', availability: e.availability ?? 'reference_only', verification_state: 'unverified', printed_page: e.printed_page, section: e.section ?? null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], created_at: DATE, updated_at: DATE }));
  const sessions = Object.entries(seances).map(([id, page_ids]) => ({ id, status: 'open', edition_id: 'ed1', started_at: DATE, page_ids: [...page_ids], document_ids: [], device_id: repo.deviceId(), created_at: DATE, updated_at: DATE }));
  await db.mutate({ puts: { books: [{ id: 'b1', title: 'Saisons', author: 'A. B.', created_at: DATE, updated_at: DATE }], book_editions: [{ id: 'ed1', book_id: 'b1', language: 'fr', created_at: DATE, updated_at: DATE }], recipes: recettes, source_pages: pages, scan_sessions: sessions }, origin: 'device' });
}
// Le contexte d'un écran (comme getData), relu dans la base jetable ; la session de l'assistant par ctx.sync (sessionAssistant).
async function ctxDe(repo, db, { session = SESSION } = {}) {
  const [recipes, books, book_editions, source_pages, scan_sessions, imports] = await Promise.all(['recipes', 'books', 'book_editions', 'source_pages', 'scan_sessions', 'imports'].map((s) => db.getAll(s)));
  return {
    recipes, books, book_editions, source_pages, scan_sessions, imports, source_documents: [], recipe_versions: [], rediscovery_prefs: [], cook_history: [], dish_recipe_links: [], recipe_translations: [], dishes: [], ingredients: [],
    recipesById: repo.indexBy(recipes), editionsById: repo.indexBy(book_editions), booksById: repo.indexBy(books), pagesById: repo.indexBy(source_pages),
    versionsByRecipe: new Map(), versionsById: new Map(), dishesById: new Map(), ingredientsById: new Map(), docsByRecipe: new Map(),
    settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' },
    sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } },
    editionLabel: () => 'Saisons', conventionFor: () => null,
  };
}
// La ligne index la plus récente d'une séance, relue dans la base.
const ligneDe = async (db, sessionId) => (await db.getAll('imports')).filter((i) => i.kind === 'index' && i.scan_session_id === sessionId).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0] ?? null;
// Une ligne a_verifier portant un résultat (forme C ou A), prête à poser dans la base.
const ligneAVerifier = ({ id, sessionId = 'ss1', page_ids = ENVOI, resultat, over = {} }) => ({ ...ligneJournal({ id, edition_id: 'ed1', scan_session_id: sessionId, page_ids }), status: 'a_verifier', resultat, model: 'claude-x', duree_ms: 1200, started_at: DATE, ...over });
// Attendre un FAIT, jamais un délai : true dès que la condition tient, sinon une erreur nommée au bout de 3 s.
const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
const tick = () => new Promise((r) => setTimeout(r, 0));
// Une scène HORS ÉCRAN mais visible : le focus ne se pose pas dans un conteneur caché.
const nouvelleScene = () => { const s = document.createElement('div'); s.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(s); return s; };
const boutonTexte = (racine, texte) => (racine ? [...racine.querySelectorAll('button')].find((b) => b.textContent === texte) || null : null);
// Une fausse fetch qui HONORE le signal (rejet AbortError) et se résout à la main (a.rendre[i](statut, corps)) ou toute seule (a.auto : [statut, corps]).
function fauxFetch(auto = null) {
  const a = { appels: [], rendre: [], auto };
  a.fetch = (url, options) => new Promise((resolve, reject) => {
    const appel = { url, options }; a.appels.push(appel);
    const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
    if (options?.signal?.aborted) { abandon(); return; }
    options?.signal?.addEventListener('abort', abandon, { once: true });
    const fin = (status, corps) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(status, corps)); };
    if (a.auto) fin(a.auto[0], a.auto[1]); else a.rendre.push(fin);
  });
  return a;
}
const imagesEnvoyees = (appel) => JSON.parse(appel.options.body).corps.messages[0].content.filter((c) => c.type === 'image').length;
const lireIndex = (panneau) => panneau.querySelector('button[data-role="lire-index"]');
// La réponse du modèle pour une liste de pages (nommées par leur contenu), dans l'ordre d'envoi.
const blocsDe = (ids) => ({ photos: ids.map(blocDe), uncertain: [] });

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

    // =================================================================================================================================
    // Tâche 2 — création enrichie et fusion, sans écran (§ 4.4, D-C5, D-C19, R-C-2, I-C7, I-C11)
    await run('T-C14 creerReferences : 21 fiches et la ligne en UNE transaction', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db);
      const ligne = ligneAVerifier({ id: 'imp_c14', resultat: C, over: { reponse_brute: 'texte brut du modèle' } }); // ronde 1 (K1) : une ligne a_verifier porte la réponse brute du modèle — son effacement est affirmé, pas hérité de la fixture
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const dits = []; const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push([Object.keys(m.puts).sort(), m.puts.recipes?.length ?? 0, m.puts.imports?.[0]?.status ?? null]); return capture ? capture(m) : {}; };
      let r;
      try { r = await T.creerReferences(ligne, D.lignesTableau(C, { ordre: D.ordrePropose(C.photos), existantes: ctx.recipes }), { repo, ctx, editionId: 'ed1', toast: (m) => dits.push(m), maintenant: () => NOW }); }
      finally { db.onMutate = capture; }
      eq(vus, [[['imports', 'recipes', 'source_pages'], 21, 'enregistre']], 'T-C14 (M50) : les 21 fiches, les 5 pages et la ligne enregistre dans UNE transaction (un seul appel de db.onMutate)');
      const lu = await db.get('imports', 'imp_c14');
      eq([r, lu.status, lu.reponse_brute, lu.finished_at], [{ issue: 'enregistre', n: 21, doublons: 2 }, 'enregistre', null, NOW], 'T-C14 (K1, ronde 1) : { issue, n, doublons } ; la ligne enregistre, reponse_brute (posée par la fixture) effacée, finished_at posé');
      const toutes = await db.byIndex('recipes', 'edition_id', 'ed1');
      const par = (titre) => toutes.find((x) => x.original_title === titre);
      eq([toutes.length, par('Velouté de petits pois').index_page_id, par('Soupe de courge').index_page_id, par('Fond de volaille').index_page_id, par('Pesto').index_page_id, par('Pesto').section, par('Pesto').raw_entry, par('Pesto').source_page_ids, par('Pesto').availability, par('Pesto').verification_state],
        [23, 'p1', 'p2', 'p3', 'p4', 'Au fil des saisons', 'Pesto — 186', ['p4'], 'reference_only', 'unverified'], 'T-C14 : en base 21 fiches neuves + 2 existantes ; chacune liée à SA photo, section et raw_entry posés, toujours reference_only / unverified');
      eq((await db.getMany('source_pages', ENVOI)).map((p) => [p.id, p.kind, p.role, p.printed_page_range, p.printed_page]), [['p3', 'index', 'index', [164, 180], null], ['p1', 'index', 'index', [8, 94], null], ['p5', 'index', 'index', null, null], ['p2', 'index', 'index', [98, 158], null], ['p4', 'index', 'index', [182, 192], null]], 'T-C14 : pages kind et role index, plage CITÉE posée (nulle sur la page décorative), printed_page jamais écrit');
      eq([...dits], ['21 référence(s) créée(s), 2 doublon(s) ignoré(s)'], 'T-C14 : le toast de succès par le toast injecté (les deux déjà repérées sont des doublons ignorés)');
    }));
    await run('T-C14 creerReferences : ligne décochée, refus, sans livre', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db);
      const ligne = ligneAVerifier({ id: 'imp_c14b', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const lignes = D.lignesTableau(C, { ordre: D.ordrePropose(C.photos), existantes: ctx.recipes });
      const decochee = D.recalculer(lignes.map((l) => (l.title === 'Gaspacho' ? { ...l, cochee: false, decocheeParLaPersonne: true } : l)), ctx.recipes);
      const r = await T.creerReferences(ligne, decochee, { repo, ctx, editionId: 'ed1', toast: () => {}, maintenant: () => NOW });
      const toutes = await db.byIndex('recipes', 'edition_id', 'ed1');
      eq([r.n, r.doublons, toutes.length, toutes.some((x) => x.original_title === 'Gaspacho')], [20, 2, 22, false], 'T-C14 (M28, A6b, ronde 1) : une ligne décochée → 20 fiches ; elle est absente de la base, et n’est pas comptée parmi les doublons (les 2 déjà repérées)');
      const nb = async () => (await db.getAll('recipes')).length; // ronde 1 : « avant » remesuré à chaque scénario (un scénario fautif ne rougit pas les suivants)
      const ligne2 = ligneAVerifier({ id: 'imp_c14c', resultat: C });
      await db.mutate({ puts: { imports: [{ ...ligne2, status: 'enregistre' }] }, origin: 'device' }); // un autre chemin a tranché
      const dits = []; let avant = await nb();
      const r2 = await T.creerReferences(ligne2, lignes, { repo, ctx, editionId: 'ed1', toast: (m) => dits.push(m), maintenant: () => NOW });
      eq([r2, (await db.getAll('recipes')).length, [...dits]], [{ issue: 'refuse' }, avant, ['La lecture a déjà été enregistrée.']], 'T-C14 (m2) : la ligne relue déjà enregistrée par un autre chemin → { issue: refuse }, 0 fiche, toast injecté « La lecture a déjà été enregistrée. »');
      // Ronde 1 (A10) : la garde AVANT la transaction se distingue du refus de la transaction — une ligne déjà enregistrée au résultat illisible rend refuse
      // et la phrase (la garde), jamais illisible (sans la garde, la revalidation passerait avant tout refus).
      const ligne7 = ligneAVerifier({ id: 'imp_c14h', resultat: { x: 1 }, over: { status: 'enregistre' } });
      await db.mutate({ puts: { imports: [ligne7] }, origin: 'device' });
      const dits7 = []; avant = await nb();
      eq([await T.creerReferences(ligne7, lignes, { repo, ctx, editionId: 'ed1', toast: (m) => dits7.push(m) }), await nb(), [...dits7]], [{ issue: 'refuse' }, avant, ['La lecture a déjà été enregistrée.']], 'T-C14 (m2, garde avant la transaction, A10, ronde 1) : la ligne relue déjà enregistrée, au résultat illisible → { issue: refuse } et « La lecture a déjà été enregistrée. », jamais illisible ; rien d’écrit');
      const ligne3 = ligneAVerifier({ id: 'imp_c14d', resultat: C, over: { started_at: 'R2' } }); // une AUTRE lecture (R2) arrivée sur la ligne
      await db.mutate({ puts: { imports: [ligne3] }, origin: 'device' });
      const dits3 = []; avant = await nb();
      eq([await T.creerReferences({ ...ligne3, started_at: 'R1' }, lignes, { repo, ctx, editionId: 'ed1', toast: (m) => dits3.push(m) }), (await db.get('imports', 'imp_c14d')).status, [...dits3], (await db.getAll('recipes')).length], [{ issue: 'change' }, 'a_verifier', [], avant], 'T-C14 (T4-R2 du lot A) : la ligne relue porte une autre lecture (R2) → { issue: change }, rien d’écrit, aucun toast, R2 reste à reprendre');
      const ligne4 = ligneAVerifier({ id: 'imp_c14e', resultat: { x: 1 } });
      await db.mutate({ puts: { imports: [ligne4] }, origin: 'device' }); avant = await nb();
      eq([(await T.creerReferences({ ...ligne2, edition_id: null }, lignes, { repo, ctx, editionId: null, toast: () => {} })).issue, (await T.creerReferences(ligne4, lignes, { repo, ctx, editionId: 'ed1', toast: () => {} })).issue, (await db.getAll('recipes')).length], ['sans_livre', 'illisible', avant], 'T-C14 : sans livre → sans_livre ; résultat relu illisible → illisible ; rien d’écrit');
      // T4-R2 DANS la transaction : une autre lecture (R2) arrive entre la relecture et l'écriture → la clé revérifiée refuse, rien d'écrit, la phrase est dite.
      const ligne5 = ligneAVerifier({ id: 'imp_c14f', resultat: C });
      await db.mutate({ puts: { imports: [ligne5] }, origin: 'device' });
      const dits5 = []; avant = await nb();
      const r2tx = { ...repo, transitionner: async (s, k, o) => { await db.put('imports', { ...(await db.get('imports', k)), started_at: 'R2' }); return repo.transitionner(s, k, o); } };
      eq([await T.creerReferences(ligne5, lignes, { repo: r2tx, ctx, editionId: 'ed1', toast: (m) => dits5.push(m) }), (await db.get('imports', 'imp_c14f')).status, (await db.get('imports', 'imp_c14f')).started_at, (await db.getAll('recipes')).length, [...dits5]], [{ issue: 'change' }, 'a_verifier', 'R2', avant, ['Les références n’ont pas pu être créées. Réessaie.']], 'T-C14 (T4-R2 dans la transaction, M-C2) : R2 arrivée entre la relecture et l’écriture → { issue: change }, rien d’écrit (ni fiche ni ligne), R2 reste à reprendre, la phrase est dite');
      // m2 DANS la transaction (M-C9) : un autre chemin enregistre la ligne entre la relecture et l'écriture → la transition refuse ; la relecture du catch
      // le voit : « La lecture a déjà été enregistrée. », { issue: refuse }, rien d'écrit.
      const ligne6 = ligneAVerifier({ id: 'imp_c14g', resultat: C });
      await db.mutate({ puts: { imports: [ligne6] }, origin: 'device' });
      const dits6 = []; avant = await nb();
      const enregistreeTx = { ...repo, transitionner: async (s, k, o) => { await db.put('imports', { ...(await db.get('imports', k)), status: 'enregistre' }); return repo.transitionner(s, k, o); } };
      eq([await T.creerReferences(ligne6, lignes, { repo: enregistreeTx, ctx, editionId: 'ed1', toast: (m) => dits6.push(m) }), (await db.getAll('recipes')).length, [...dits6]], [{ issue: 'refuse' }, avant, ['La lecture a déjà été enregistrée.']], 'T-C14 (m2 dans la transaction, M-C9) : la ligne enregistrée ailleurs ENTRE la relecture et l’écriture → la transition refuse, { issue: refuse }, aucune fiche, « La lecture a déjà été enregistrée. »');
      // Ronde 1 (A9) : la ligne passe echec à clé CONSTANTE entre la relecture et l'écriture (interrompue ailleurs) → seule a_verifier se ferme.
      const ligne8 = ligneAVerifier({ id: 'imp_c14i', resultat: C });
      await db.mutate({ puts: { imports: [ligne8] }, origin: 'device' });
      const dits8 = []; avant = await nb();
      const echecTx = { ...repo, transitionner: async (s, k, o) => { await db.put('imports', { ...(await db.get('imports', k)), status: 'echec', erreur: { raison: 'interrompu', extra: {} } }); return repo.transitionner(s, k, o); } };
      eq([await T.creerReferences(ligne8, lignes, { repo: echecTx, ctx, editionId: 'ed1', toast: (m) => dits8.push(m) }), (await db.get('imports', 'imp_c14i')).status, await nb(), [...dits8]], [{ issue: 'change' }, 'echec', avant, ['Les références n’ont pas pu être créées. Réessaie.']], 'T-C14 (A9, ronde 1) : la ligne passée echec à clé constante entre la relecture et l’écriture → la transition (attendus a_verifier) refuse : { issue: change }, rien d’écrit, la ligne reste echec, la phrase est dite');
      // Ronde 1 (A8) : une ligne absente de la base (retirée, ou pas encore reçue) → { issue: change }, rien d'écrit, aucun toast.
      const dits9 = []; avant = await nb();
      eq([await T.creerReferences(ligneAVerifier({ id: 'imp_jamais_posee', resultat: C }), lignes, { repo, ctx, editionId: 'ed1', toast: (m) => dits9.push(m) }), await nb(), [...dits9]], [{ issue: 'change' }, avant, []], 'T-C14 (A8, ronde 1) : la ligne absente de la base → { issue: change }, rien d’écrit, aucun toast');
    }));

    await run('T-C15 fusion : une seconde lecture ne réécrit ni n’enrichit rien', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { existantes: [{ original_title: 'Risotto aux champignons', printed_page: 34 }, { original_title: 'Pâtes aux tomates confites', printed_page: 116, section: 'Automne' }] });
      const avant = await db.getAll('recipes');
      const resultat = { photos: [{ page_id: 'p2', printed_page_range: [34, 120], entries: [
        { title: 'Risotto aux champignons', printed_page: 34, section: 'Printemps', uncertain: false },
        { title: 'Pâtes aux tomates confites', printed_page: 116, section: 'Automne', uncertain: false },
        { title: 'Gnocchi', printed_page: 40, section: 'Printemps', uncertain: false },
        { title: 'Gnocchi', printed_page: 40, section: 'Printemps', uncertain: false }, // ronde 1 : une entrée en double DANS la lecture (enDouble)
        { title: 'Pain perdu', printed_page: 120, section: 'Desserts', uncertain: false }] }], ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] };
      const ligne = ligneAVerifier({ id: 'imp_c15', page_ids: ['p2'], resultat });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const lignes = D.lignesTableau(resultat, { ordre: ['p2'], existantes: ctx.recipes }).map((l) => (l.dejaReperee ? { ...l, cochee: true } : l)); // forcées cochées
      const dits = [];
      const r = await T.creerReferences(ligne, lignes, { repo, ctx, editionId: 'ed1', toast: (m) => dits.push(m), maintenant: () => NOW });
      const apres = await db.getAll('recipes');
      eq([r.n, apres.length - avant.length, apres.filter((x) => !avant.some((a) => a.id === x.id)).map((x) => x.original_title).sort()], [2, 2, ['Gnocchi', 'Pain perdu']], 'T-C15 : 5 entrées dont 2 existantes et 1 en double → 2 fiches créées, jamais de doublon par titre et page');
      eq(avant.map((a) => apres.find((x) => x.id === a.id)), avant, 'T-C15 (M51, R-C-2, I-C7) : les existantes sont intactes champ pour champ (updated_at compris) — celle sans section ni index_page_id le reste');
      eq([r.doublons, [...dits]], [3, ['2 référence(s) créée(s), 3 doublon(s) ignoré(s)']], 'T-C15 (A6, ronde 1) : doublons = déjà repérées (2) + en double dans la lecture (1), dans la valeur rendue et dans le toast');
    }));

    await run('T-C16 saisie à la main : création et fermeture de la ligne (D-C19)', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const { cleLecture } = await import('../src/ui/import-cible.js');
      await poserBibliotheque(repo, db, { seances: { ss1: ['p1', 'p2'] }, kinds: { p2: 'recipe' } });
      await db.mutate({ puts: { book_editions: [{ id: 'ed2', book_id: 'b1', language: 'fr', created_at: DATE, updated_at: DATE }], recipes: [{ id: 'rc_ed2', edition_id: 'ed2', original_title: 'Autre', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: 7, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], created_at: DATE, updated_at: DATE }] }, origin: 'device' }); // ronde 1 : un homonyme dans une AUTRE édition
      const session = (await ctxDe(repo, db)).scan_sessions[0];
      const dits = [];
      const saisir = async (texte, deps = {}) => I.creerDepuisSaisie(texte, { session, ctx: await ctxDe(repo, db), pageIds: ['p2', 'p9'], repo, toast: (m) => dits.push(m), maintenant: () => NOW, ...deps });
      const montree = (L) => ({ importId: L.id, cle: cleLecture(L) }); // la lecture que le panneau MONTRE
      const UNE_P1 = D.resultatIndex(L.validerLectureIndex({ photos: [blocDe('p1', 0)], uncertain: [] }, { nbPhotos: 1 }), ['p1']); // le résultat d'UNE page : la seule forme qu'une ligne de page_ids ['p1'] porte en base
      const r0 = await saisir(`Gnocchi — 40\n${'x'.repeat(1000)} — 41`);
      const toutes = await db.byIndex('recipes', 'edition_id', 'ed1');
      const g = toutes.find((x) => x.original_title === 'Gnocchi'); const lg = toutes.find((x) => x.printed_page === 41);
      eq([r0.issue, r0.n, g.raw_entry, g.index_page_id, g.index_uncertain, g.section, g.source_page_ids], ['cree', 2, 'Gnocchi — 40', null, false, null, ['p2']], 'T-C16 (M52) : sans ligne, la zone de texte crée comme avant — raw_entry = la ligne tapée, index_page_id null, section null, source_page_ids = pages cochées PRÉSENTES');
      eq([Array.from(lg.raw_entry).length, Array.from(lg.original_title).length], [300, 200], 'T-C16 (M75, S-10) : une ligne de 1 000 caractères → raw_entry borné à 300, titre à 200 points de code');
      eq([(await db.get('source_pages', 'p2')).kind, (await db.get('source_pages', 'p1')).kind], ['recipe', null], 'T-C16 (M63) : kind recipe d’une page cochée GARDÉ ; une page non cochée intouchée');
      // La ligne a_verifier MONTRÉE par le panneau : enregistre dans la MÊME transaction que les fiches (M53)
      const s1 = ligneAVerifier({ id: 'imp_s1', page_ids: ['p1'], resultat: UNE_P1, over: { reponse_brute: 'texte brut du modèle' } });
      await db.mutate({ puts: { imports: [s1] }, origin: 'device' });
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push([Object.keys(m.puts).sort(), m.puts.imports?.[0]?.status ?? null]); return capture ? capture(m) : {}; };
      let r1;
      try { r1 = await saisir('Tartiflette — 61', { pageIds: ['p1'], ...montree(s1) }); } finally { db.onMutate = capture; }
      const s1lu = await db.get('imports', 'imp_s1');
      eq([vus, s1lu.status, s1lu.finished_at, s1lu.reponse_brute, r1.ferme], [[[['imports', 'recipes', 'source_pages'], 'enregistre']], 'enregistre', NOW, null, true], 'T-C16 / T-C23 (M53, D-C19, B8, K1, ronde 1) : ferme rendu, reponse_brute (posée par la fixture) effacée ; la ligne a_verifier montrée passe enregistre DANS la transaction des fiches, finished_at posé');
      // echec et a_lancer montrées → ignore, finished_at posé (Q2, Q3)
      for (const statut of ['echec', 'a_lancer']) {
        const l0 = { ...ligneJournal({ id: 'imp_' + statut, edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p1'] }), status: statut, erreur: statut === 'echec' ? { raison: 'coupe', extra: {} } : null, reponse_brute: 'texte brut du modèle' };
        await db.mutate({ puts: { imports: [l0] }, origin: 'device' });
        await saisir(`Recette ${statut} — 7${statut.length}`, montree(l0));
        const l = await db.get('imports', 'imp_' + statut);
        eq([l.status, l.finished_at, l.reponse_brute], ['ignore', NOW, null], `T-C16 (D-C19, Q2, Q3, K1, ronde 1) : une ligne ${statut} montrée passe ignore, finished_at posé, reponse_brute effacée`);
      }
      // Clôture refusée (décision 4 de la ronde 1 de T6) : la ligne est close ailleurs ENTRE la relecture et la transaction → RIEN d'écrit, la phrase est dite
      const s4 = ligneAVerifier({ id: 'imp_s4', page_ids: ['p1'], resultat: UNE_P1 });
      await db.mutate({ puts: { imports: [s4] }, origin: 'device' });
      const espion = { ...repo, transitionner: async (s, k, o) => { await db.put('imports', { ...(await db.get('imports', k)), status: 'ignore' }); return repo.transitionner(s, k, o); } };
      dits.length = 0;
      const r4 = await saisir('Crêpes — 90', { repo: espion, ...montree(s4) });
      eq([r4, (await db.byIndex('recipes', 'edition_id', 'ed1')).some((x) => x.original_title === 'Crêpes'), (await db.get('imports', 'imp_s4')).status, [...dits]], [{ issue: 'refuse' }, false, 'ignore', ['Les références n’ont pas pu être créées. Réessaie.']], 'T-C16 (D-C19, ronde 1 de T6) : la ligne close ailleurs entre la relecture et la transaction → RIEN d’écrit (ni fiche, ni ligne), « Les références n’ont pas pu être créées. Réessaie. »');
      const r4b = await saisir('Crêpes — 90');
      eq([r4b.issue, r4b.ferme, (await db.byIndex('recipes', 'edition_id', 'ed1')).some((x) => x.original_title === 'Crêpes')], ['cree', false, true], 'T-C16 (ronde 1 de T6) : le second « Créer les références », sans ligne montrée, écrit les fiches sans elle');
      // T4-R2 du lot A : la ligne a reçu une AUTRE lecture (R2) depuis celle que le panneau montre → R2 n'est pas close, les fiches sont créées sans elle
      const s5 = ligneAVerifier({ id: 'imp_s5', page_ids: ['p1'], resultat: UNE_P1, over: { started_at: 'R2' } });
      await db.mutate({ puts: { imports: [s5] }, origin: 'device' });
      const r5 = await saisir('Clafoutis — 94', montree({ ...s5, started_at: 'R1' }));
      eq([r5.ferme, (await db.get('imports', 'imp_s5')).status, (await db.byIndex('recipes', 'edition_id', 'ed1')).some((x) => x.original_title === 'Clafoutis')], [false, 'a_verifier', true], 'T-C16 (T4-R2 du lot A, M-C3) : une autre lecture (R2) n’est jamais close par la zone de texte ; la fiche est créée');
      await db.put('imports', { ...(await db.get('imports', 'imp_s5')), status: 'ignore' }); // rangement
      // Ronde 1 (B1, pendant de M-C2) : la clé revérifiée DANS la transaction — une autre lecture (R2), même statut, arrive entre la relecture et l'écriture.
      const s6 = ligneAVerifier({ id: 'imp_s6', page_ids: ['p1'], resultat: UNE_P1 });
      await db.mutate({ puts: { imports: [s6] }, origin: 'device' });
      const r2Tx = { ...repo, transitionner: async (s, k, o) => { await db.put('imports', { ...(await db.get('imports', k)), started_at: 'R2' }); return repo.transitionner(s, k, o); } };
      dits.length = 0;
      const r6 = await saisir('Crumble — 95', { repo: r2Tx, ...montree(s6) });
      const s6lu = await db.get('imports', 'imp_s6');
      eq([r6, (await db.byIndex('recipes', 'edition_id', 'ed1')).some((x) => x.original_title === 'Crumble'), s6lu.status, s6lu.started_at, [...dits]], [{ issue: 'refuse' }, false, 'a_verifier', 'R2', ['Les références n’ont pas pu être créées. Réessaie.']], 'T-C16 (B1, ronde 1) : R2 arrivée entre la relecture et la transaction, statut inchangé → la clé revérifiée DANS la transaction refuse : aucune fiche, R2 reste à reprendre, la phrase est dite');
      await db.put('imports', { ...s6lu, status: 'ignore' }); // rangement
      // Ronde 1 (B3) : la ligne montrée passe echec à clé CONSTANTE (interrompue ailleurs) → seule la transition du statut relu (a_verifier → enregistre) est permise.
      const s7 = ligneAVerifier({ id: 'imp_s7', page_ids: ['p1'], resultat: UNE_P1 });
      await db.mutate({ puts: { imports: [s7] }, origin: 'device' });
      const echecTx = { ...repo, transitionner: async (s, k, o) => { await db.put('imports', { ...(await db.get('imports', k)), status: 'echec', erreur: { raison: 'interrompu', extra: {} } }); return repo.transitionner(s, k, o); } };
      dits.length = 0;
      const r7 = await saisir('Flan — 96', { repo: echecTx, ...montree(s7) });
      eq([r7, (await db.byIndex('recipes', 'edition_id', 'ed1')).some((x) => x.original_title === 'Flan'), (await db.get('imports', 'imp_s7')).status, [...dits]], [{ issue: 'refuse' }, false, 'echec', ['Les références n’ont pas pu être créées. Réessaie.']], 'T-C16 (B3, ronde 1) : la ligne montrée a_verifier passée echec à clé constante → refus (attendus = le statut relu), aucune fiche, la ligne reste echec');
      await db.put('imports', { ...(await db.get('imports', 'imp_s7')), status: 'ignore' }); // rangement
      // Ronde 1 (B2, B10, Q) : une ligne en_cours, ou d'une autre sorte, n'est jamais fermée par la zone de texte, même montrée avec sa clé ; les fiches sont créées.
      const s8 = { ...ligneJournal({ id: 'imp_s8', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p1'] }), status: 'en_cours', started_at: DATE };
      const s9 = { ...ligneAVerifier({ id: 'imp_s9', page_ids: ['p1'], resultat: UNE_P1 }), kind: 'recette' };
      await db.mutate({ puts: { imports: [s8, s9] }, origin: 'device' });
      const r8 = await saisir('Gratin — 97', montree(s8));
      const r9 = await saisir('Potage — 98', montree(s9));
      eq([r8.issue, r8.ferme, (await db.get('imports', 'imp_s8')).status, r9.issue, r9.ferme, (await db.get('imports', 'imp_s9')).status], ['cree', false, 'en_cours', 'cree', false, 'a_verifier'], 'T-C16 (B2, B10, Q, D-C19, ronde 1) : une ligne en_cours montrée avec sa clé n’est jamais fermée par la zone ; une ligne d’une autre sorte (recette) non plus ; les fiches sont créées sans elles');
      // Ronde 1 (B4, B12, B5) : le dédoublonnage de la zone — une ligne déjà créée, une référence existante tapée autrement (casse, espaces), un doublon DANS la
      // saisie : ignorés et comptés ; l'homonyme d'une AUTRE édition ne compte pas.
      dits.length = 0;
      const rd = await saisir('Gnocchi — 40\nrisotto  aux Champignons — 34\nAutre — 7\nAutre — 7');
      const ed1 = await db.byIndex('recipes', 'edition_id', 'ed1');
      const compte = (titre, page) => ed1.filter((x) => D.cleReference(x.original_title, x.printed_page) === D.cleReference(titre, page)).length;
      eq([rd, compte('Gnocchi', 40), compte('Risotto aux champignons', 34), compte('Autre', 7), (await db.get('recipes', 'rc_ed2'))?.edition_id, [...dits]], [{ issue: 'cree', n: 1, doublons: 3, ferme: false }, 1, 1, 1, 'ed2', ['1 référence(s) créée(s), 3 doublon(s) ignoré(s)']], 'T-C16 (B4, B12, B5, ronde 1) : une ligne déjà créée, une référence existante tapée autrement et un doublon dans la saisie → 1 fiche, 3 doublons, aucun doublon en base ; l’homonyme d’une autre édition ne compte pas ; le toast de succès le dit');
      // Ronde 1 (B9) : une séance sans livre → rien d'écrit, la phrase est dite.
      dits.length = 0; const avantSL = (await db.getAll('recipes')).length;
      eq([await saisir('Soupe — 1', { session: { ...session, edition_id: null } }), (await db.getAll('recipes')).length, [...dits]], [{ issue: 'sans_livre' }, avantSL, ['Associe d’abord un livre à cette séance']], 'T-C16 (B9, ronde 1) : une séance sans livre → { issue: sans_livre }, rien d’écrit, la phrase est dite');
      // Ronde 1 (B11 ; constat de sécurité) : une page cochée deux fois n'est citée qu'une fois ; un titre fait seulement d'invisibles ne fait pas de fiche ; une
      // demi-paire (Cs) est retirée du titre et de raw_entry (nettoyer, comme fabriquerReferences).
      const rp = await saisir('Velouté — 3\n\u200B — 12\nTa\ud800rte — 13', { pageIds: ['p2', 'p2'] });
      const ed1b = await db.byIndex('recipes', 'edition_id', 'ed1');
      const velo = ed1b.find((x) => x.original_title === 'Velouté'); const tarte = ed1b.find((x) => x.printed_page === 13);
      eq([rp.n, velo?.source_page_ids, ed1b.some((x) => x.printed_page === 12), tarte?.original_title, tarte?.raw_entry], [2, ['p2'], false, 'Tarte', 'Tarte — 13'], 'T-C16 (B11, ronde 1) : une page cochée deux fois n’est citée qu’une fois ; un titre fait seulement d’invisibles (Cf collé d’un PDF) ne fait pas de fiche ; une demi-paire (Cs) est retirée du titre et de raw_entry');
      eq(I.parseIndexLines('  Soupe — 12  \n\n\t7 Pain \nOignons '), [{ title: 'Soupe', printed_page: 12, raw: 'Soupe — 12' }, { title: 'Pain', printed_page: 7, raw: '7 Pain' }, { title: 'Oignons', printed_page: null, raw: 'Oignons' }], 'T-C16 (B7, ronde 1) : parseIndexLines rend aussi la ligne tapée (raw), sans ses espaces de bord, pour les trois formes');
      eq((await saisir('', {})).issue, 'vide', 'T-C16 : une zone vide ne crée rien');
    }));

    // =================================================================================================================================
    // Tâche 2, ronde 1 — constats de la revue adverse : relectures en base, pages réécrites dans la transaction, faux verts fermés
    await run('T-C8 (ronde 1 de T2) fabriquerReferences : raw_entry nettoyé et borné', async () => {
      const f = D.fabriquerReferences({ aCreer: [
        { creable: true, cochee: true, title: 'Tarte', titreLu: 'Tar\u202Ete' + 'x'.repeat(400), pageLue: 12, photo: { page_id: null } },
        { creable: true, cochee: true, title: 'Soupe', photo: { page_id: null } }] }, { edition: { id: 'ed1', language: 'fr' }, pagesParId: new Map(), resultat: { photos: [] }, newId: (p) => p + '_x' });
      eq([Array.from(f.recipes[0].raw_entry).length, f.recipes[0].raw_entry.includes('\u202E'), f.recipes[0].raw_entry.startsWith('Tartexxx'), f.recipes[1].raw_entry], [300, false, true, ''], 'T-C8 (ronde 1 de T2) : raw_entry passe le dernier mur, comme le titre — Cf retirés, borné à 300 points de code ; un titre lu absent ne s’écrit jamais « undefined »');
    });
    await run('T-C14 (ronde 1) creerReferences : références relues, résultat revalidé, édition de la ligne', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db);
      // Un résultat HOSTILE mais bien formé (I-C2) : la plage de p3 dépasse 9 999 — la revalidation la ramène à null, et c'est le résultat revalidé qui s'écrit.
      const HOSTILE = { ...C, photos: C.photos.map((p) => (p.page_id === 'p3' ? { ...p, printed_page_range: [164, 99999] } : p)) };
      const ligne = ligneAVerifier({ id: 'imp_r1a', resultat: HOSTILE });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const lignes = D.lignesTableau(C, { ordre: D.ordrePropose(C.photos), existantes: ctx.recipes }); // le tableau calculé au rendu : 21 créables
      // Un autre onglet crée « Gaspacho » p. 76 APRÈS le rendu, AVANT le clic : le dernier recalculer, sur les références RELUES en base, l'écarte.
      await db.mutate({ puts: { recipes: [{ id: 'rc_autre_onglet', edition_id: 'ed1', original_title: 'Gaspacho', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: 76, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], created_at: DATE, updated_at: DATE }] }, origin: 'device' });
      const dits = [];
      const r = await T.creerReferences(ligne, lignes, { repo, ctx, toast: (m) => dits.push(m), maintenant: () => NOW }); // sans editionId : l'édition de la ligne
      const toutes = await db.byIndex('recipes', 'edition_id', 'ed1');
      eq([r, toutes.length, toutes.filter((x) => x.original_title === 'Gaspacho').length, [...dits]], [{ issue: 'enregistre', n: 20, doublons: 3 }, 23, 1, ['20 référence(s) créée(s), 3 doublon(s) ignoré(s)']], 'T-C14 (O, A2, A7, ronde 1) : une référence créée ailleurs après le calcul du tableau est relue en base et recalculée → 20 fiches, 3 doublons, un seul « Gaspacho » ; sans editionId, l’édition de la ligne sert');
      eq((await db.getMany('source_pages', ['p3', 'p1'])).map((p) => p.printed_page_range), [null, [8, 94]], 'T-C14 (A5, A12, ronde 1) : le résultat relu est REVALIDÉ et c’est lui qui s’écrit — la plage hostile [164, 99 999] de p3 devient null, celle de p1 reste [8, 94]');
    }));
    await run('T-C14 (ronde 1) creerReferences : pages réécrites sur leur fiche RELUE dans la transaction, page_ids de la ligne relue', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db);
      const ligne = ligneAVerifier({ id: 'imp_r1b', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const lignes = D.lignesTableau(C, { ordre: D.ordrePropose(C.photos), existantes: ctx.recipes });
      // L'écran ciblé pose « p. imprimée » 164 sur p3, et « Appliquer cet ordre » d'un autre onglet déplace p1, ENTRE la relecture des pages et la transaction.
      const ailleurs = { ...repo, transitionner: async (s, k, o) => {
        await db.put('source_pages', { ...(await db.get('source_pages', 'p3')), printed_page: 164 });
        await db.put('source_pages', { ...(await db.get('source_pages', 'p1')), position: 42 });
        return repo.transitionner(s, k, o);
      } };
      const r = await T.creerReferences(ligne, lignes, { repo: ailleurs, ctx, editionId: 'ed1', toast: () => {}, maintenant: () => NOW });
      const [p3, p1] = await db.getMany('source_pages', ['p3', 'p1']);
      eq([r.issue, r.n, [p3.printed_page, p3.kind, p3.role, p3.printed_page_range, p3.updated_at > DATE], [p1.position, p1.kind, p1.printed_page_range]], ['enregistre', 21, [164, 'index', 'index', [164, 180], true], [42, 'index', [8, 94]]], 'T-C14 (constat 23 de T1, ronde 1) : chaque page est réécrite sur sa fiche RELUE dans la transaction (fusion) — la « p. imprimée » et la position posées ailleurs entre-temps survivent ; kind, role et plage posés ; updated_at neuf');
      // Forme A (D-C11) : une photo inconnue — les fiches prennent les pages de la ligne présentes, dans l'ordre de la ligne RELUE (cleLecture ne couvre pas
      // page_ids, qu'« Appliquer cet ordre » réécrit sans changer la clé) ; l'appelant tient un page_ids périmé.
      const FORME_A = { entries: [{ title: 'Crumble', printed_page: 300, section: null, ingredients_mentioned: [] }, { title: 'Flan', printed_page: 301, section: null, ingredients_mentioned: [] }], uncertain: [] };
      const ligneA = ligneAVerifier({ id: 'imp_r1d', page_ids: ['p2', 'p1'], resultat: FORME_A });
      await db.mutate({ puts: { imports: [ligneA] }, origin: 'device' });
      const lignesA = D.lignesTableau(D.revaliderResultatIndex(FORME_A, ['p2', 'p1']), { existantes: await db.byIndex('recipes', 'edition_id', 'ed1') });
      const rA = await T.creerReferences({ ...ligneA, page_ids: ['p1', 'p2'] }, lignesA, { repo, ctx, editionId: 'ed1', toast: () => {}, maintenant: () => NOW });
      const crumble = (await db.byIndex('recipes', 'edition_id', 'ed1')).find((x) => x.original_title === 'Crumble');
      eq([rA.issue, rA.n, crumble?.index_page_id, crumble?.source_page_ids], ['enregistre', 2, null, ['p2', 'p1']], 'T-C14 (A4, ronde 1) : forme A — index_page_id null, source_page_ids = les pages de la ligne RELUE présentes, dans son ordre (jamais celui, périmé, de l’appelant)');
    }));
    await run('T-C14 (ronde 1) creerReferences : une page citée retirée pendant la transaction', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db);
      const ligne = ligneAVerifier({ id: 'imp_r1c', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db); // le contexte du rendu connaît p3
      const lignes = D.lignesTableau(C, { ordre: D.ordrePropose(C.photos), existantes: ctx.recipes });
      const nb = async () => (await db.getAll('recipes')).length;
      const avant = await nb(); const dits = [];
      // p3 est retirée (« Retirer » sur un autre appareil, reçu par la synchro) entre la relecture des pages et la transaction : aucune fiche ne doit la citer (I-C11).
      const retiree = { ...repo, transitionner: async (s, k, o) => { await db.delete('source_pages', 'p3'); return repo.transitionner(s, k, o); } };
      eq([await T.creerReferences(ligne, lignes, { repo: retiree, ctx, editionId: 'ed1', toast: (m) => dits.push(m), maintenant: () => NOW }), await nb(), (await db.get('imports', 'imp_r1c')).status, (await db.get('source_pages', 'p3')) ?? null, [...dits]], [{ issue: 'change' }, avant, 'a_verifier', null, ['Les références n’ont pas pu être créées. Réessaie.']], 'T-C14 (I-C11, ronde 1) : une page citée retirée entre la relecture et la transaction → la transaction refuse : rien d’écrit (ni fiche, ni ligne, ni page ressuscitée), la phrase est dite');
      // « Réessayer » : p3 est relue ABSENTE (le contexte du rendu la connaît encore) → ses entrées sont créées sans elle, et elle n'est pas réécrite.
      const r = await T.creerReferences(ligne, lignes, { repo, ctx, editionId: 'ed1', toast: () => {}, maintenant: () => NOW });
      const fond = (await db.byIndex('recipes', 'edition_id', 'ed1')).find((x) => x.original_title === 'Fond de volaille');
      eq([r.issue, r.n, fond?.index_page_id, fond?.source_page_ids, (await db.get('source_pages', 'p3')) ?? null], ['enregistre', 21, null, [], null], 'T-C14 (A3, P, I-C11, ronde 1) : une page absente de la base (présente dans le contexte du rendu) n’est jamais citée — index_page_id null, source_page_ids [] — ni écrite');
    }));
    await run('T-C16 (ronde 1) saisie à la main : pages cochées relues en base et réécrites dans la transaction', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      await poserBibliotheque(repo, db, { seances: { ss1: ['p1', 'p2', 'p3', 'p4'] } });
      const ctx = await ctxDe(repo, db); // l'instantané du rendu : les quatre pages présentes, kind nul
      const session = ctx.scan_sessions[0];
      const dits = [];
      const saisir = (texte, deps = {}) => I.creerDepuisSaisie(texte, { session, ctx, repo, toast: (m) => dits.push(m), maintenant: () => NOW, ...deps });
      // Après le rendu : p2 reçoit sa « p. imprimée » et devient une page de recette (synchro, autre onglet) ; p1 est retirée sur un autre appareil.
      await db.put('source_pages', { ...(await db.get('source_pages', 'p2')), printed_page: 58, kind: 'recipe' });
      await db.delete('source_pages', 'p1');
      const r = await saisir('Salade — 58', { pageIds: ['p1', 'p2'] });
      const salade = (await db.byIndex('recipes', 'edition_id', 'ed1')).find((x) => x.original_title === 'Salade');
      const p2 = await db.get('source_pages', 'p2');
      eq([r.issue, p2.printed_page, p2.kind, p2.updated_at, (await db.get('source_pages', 'p1')) ?? null, salade?.source_page_ids], ['cree', 58, 'recipe', DATE, null, ['p2']], 'T-C16 (M63, I-C3, ronde 1) : les pages cochées sont RELUES en base, jamais prises dans l’instantané du rendu — p2, devenue recette ailleurs, n’est pas réécrite (ni printed_page ni kind écrasés) ; p1, retirée, n’est ni citée ni ressuscitée');
      // Entre la relecture et la transaction, p3 (kind nul) reçoit sa « p. imprimée » ailleurs → la page est réécrite sur sa fiche RELUE (kind posé, numéro gardé).
      const pose = { ...repo, saveBatch: async (b, o) => { await db.put('source_pages', { ...(await db.get('source_pages', 'p3')), printed_page: 99 }); return repo.saveBatch(b, o); } };
      await saisir('Velouté — 99', { pageIds: ['p3'], repo: pose });
      const p3 = await db.get('source_pages', 'p3');
      eq([p3.kind, p3.printed_page, p3.updated_at > DATE], ['index', 99, true], 'T-C16 (ronde 1) : une page de kind nul est réécrite sur sa fiche RELUE dans la transaction (fusion) — kind index posé, la « p. imprimée » posée ailleurs entre-temps survit, updated_at neuf');
      // Une page cochée retirée entre la relecture et la transaction, alors qu'une fiche la cite → refus : rien d'écrit, la phrase est dite.
      const retire = { ...repo, saveBatch: async (b, o) => { await db.delete('source_pages', 'p4'); return repo.saveBatch(b, o); } };
      dits.length = 0; const avant = (await db.getAll('recipes')).length;
      eq([await saisir('Tian — 88', { pageIds: ['p4'], repo: retire }), (await db.getAll('recipes')).length, (await db.get('source_pages', 'p4')) ?? null, [...dits]], [{ issue: 'refuse' }, avant, null, ['Les références n’ont pas pu être créées. Réessaie.']], 'T-C16 (I-C11, ronde 1) : une page citée retirée entre la relecture et la transaction → refus : aucune fiche, la page n’est pas ressuscitée, la phrase est dite');
    }));
    await run('T-C16 (ronde 1) panneau : une double tape sur « Créer les références » ne crée qu’une fois', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      await poserBibliotheque(repo, db, { seances: { ss1: ['p1'] } });
      const ctx = await ctxDe(repo, db);
      const dits = []; const lots = [];
      const espion = { ...repo, saveBatch: (b, o) => { lots.push(Object.keys(b).sort()); return repo.saveBatch(b, o); } };
      const panneau = I.indexEntriesPanel(ctx.scan_sessions[0], ctx, () => ['p1'], { repo: espion, toast: (m) => dits.push(m), maintenant: () => NOW });
      const ta = panneau.querySelector('textarea');
      ta.value = 'Soupe — 12';
      const creer = [...panneau.querySelectorAll('button')].find((b) => b.textContent === 'Créer les références');
      creer.click(); creer.click();
      for (let i = 0; i < 300 && ta.value !== ''; i += 1) await new Promise((r) => setTimeout(r, 10));
      for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 10)); // laisse finir un second appel éventuel
      eq([(await db.byIndex('recipes', 'edition_id', 'ed1')).filter((x) => x.original_title === 'Soupe').length, lots, [...dits]], [1, [['recipes']], ['1 référence(s) créée(s)']], 'T-C16 (ronde 1) : une double tape sur « Créer les références » → UNE création (verrou local, comme « Lire avec l’assistant IA ») : une fiche, un lot écrit par le repo INJECTÉ, un toast par le toast INJECTÉ');
    }));
    await run('T-C24 (ronde 1 de T2) repo : une condition de fusion est enveloppée comme un patch', () => withRepo(async (repo, db) => {
      const page = (id) => ({ id, document_id: null, edition_id: 'ed1', sha256: 'sha-' + id, printed_page: null, position: 1, issues: [], kind: null, created_at: DATE, updated_at: DATE });
      await db.mutate({ puts: { imports: [{ ...ligneJournal({ id: 'imp_f' }), created_at: DATE, updated_at: DATE }], source_pages: ['f1', 'f2', 'f3', 'f4'].map(page) }, origin: 'device' });
      await repo.transitionner('imports', 'imp_f', { attendus: ['a_lancer'], patch: { status: 'ignore' }, conditions: { source_pages: [{ key: 'f1', fusion: (c) => ({ ...c, kind: 'index', locator: 'a\u0007b' }) }, { key: 'f2', fusion: () => null }] } });
      const notifs = []; const off = on('change', (p) => notifs.push(p.store));
      try {
        await repo.saveBatch({}, { conditions: { source_pages: [{ key: 'f3', fusion: (c) => ({ ...c, kind: 'index', locator: 'c\u0007d' }) }, { key: 'f4', fusion: () => null }] } });
      } finally { off(); }
      const [f1, f2, f3, f4] = await db.getMany('source_pages', ['f1', 'f2', 'f3', 'f4']);
      eq([[f1.kind, f1.locator, f1.created_at, f1.updated_at > DATE], f2, [f3.kind, f3.locator, f3.created_at, f3.updated_at > DATE], f4], [['index', 'ab', DATE, true], page('f2'), ['index', 'cd', DATE, true], page('f4')], 'T-C24 (ronde 1 de T2) : une condition { key, fusion } portée par transitionner (sac conditions) ou par saveBatch est enveloppée comme un patch — contrôles retirés (R61), created_at gardé, updated_at neuf ; null : rien d’écrit');
      eq([...notifs], ['source_pages'], 'T-C24 (ronde 1 de T2) : saveBatch émet un change pour le magasin qu’une condition de fusion a écrit (rien dans puts), comme transitionner');
    }));

    // =================================================================================================================================
    // Tâche 3 — séquence proposée (§ 4.3, D-C3, D-C15, D-C22, I-C6, I-C10)
    await run('T-C12 ordre des photos : rendu, ↑/↓ sans écriture, Appliquer en une transaction, reprise, conflit', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7 } });
      const ligne = ligneAVerifier({ id: 'imp_o1', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const session = ctx.scan_sessions.find((s) => s.id === 'ss1');
      const scene = nouvelleScene();
      const dits = []; const apres = []; const changements = [];
      let opts = null;
      const espion = { ...repo, transitionner: async (s, k, o) => { if (s === 'imports') opts = o; return repo.transitionner(s, k, o); } };
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push({ ...m.puts }); return capture ? capture(m) : {}; }; // copie AVANT la capture (qui ajoute outbox au même objet)
      let refreshs = 0; const compter = () => { refreshs += 1; };
      window.addEventListener('cuisineos:refresh', compter);
      try {
        const vue = T.panneauLecture({ ligne, resultat: C, session, ctx, repo: espion, toast: (m) => dits.push(m), apresOrdre: (x) => apres.push(x), maintenant: () => NOW, surChangement: () => changements.push(1) });
        scene.append(vue);
        const zone = () => vue.querySelector('[data-role="ordre-photos"]');
        const figures = () => [...zone().querySelectorAll('.thumbs figure')];
        const appliquer = () => zone().querySelector('[data-role="appliquer-ordre"]');
        eq([zone().hidden, zone().querySelector('h3')?.textContent, zone().querySelector('[data-role="etat-ordre"]')?.textContent, figures().map((f) => f.dataset.page), figures().map((f) => f.querySelector('.num').textContent), figures().map((f) => f.querySelector('figcaption > span').textContent), appliquer().hidden],
          [false, 'Ordre des photos', 'Ordre proposé d’après les numéros de page lus — vérifie.', ['p1', 'p2', 'p3', 'p4', 'p5'], ['1', '2', '3', '4', '5'], ['p. 8-94', 'p. 98-158', 'p. 164-180', 'p. 182-192', 'page inconnue'], false],
          'T-C12 (D-C3) : « Ordre des photos », la phrase d’état (proposé ≠ séance), les vignettes dans l’ordre PROPOSÉ (rang, plage citée ou « page inconnue »), « Appliquer cet ordre » rendu');
        eq(figures().map((f) => f.querySelector('figcaption > span').className), ['', '', '', '', 'chip warn'], 'T-C12 (ronde 1, P18, § 4.3) : « page inconnue » est une puce d’avertissement (.chip.warn) ; une plage citée, un texte nu');
        vus.length = 0;
        boutonTexte(zone(), 'Descendre la page 1').click();
        eq([vue.etatLecture().ordre, figures().map((f) => f.dataset.page), document.activeElement?.dataset.role, document.activeElement?.dataset.page, vus.length, appliquer().hidden], [['p2', 'p1', 'p3', 'p4', 'p5'], ['p2', 'p1', 'p3', 'p4', 'p5'], 'descendre', 'p1', 0, false], 'T-C12 (M45, I-C6) : « Descendre la page 1 » change l’ordre affiché, le focus suit la page déplacée, AUCUNE écriture');
        boutonTexte(zone(), 'Monter la page 1').click();
        eq([vue.etatLecture().ordre, vus.length], [['p2', 'p1', 'p3', 'p4', 'p5'], 0], 'T-C12 : monter la page en tête ne change rien (le bouton reste, sans effet)');
        appliquer().click(); appliquer().click(); // ronde 1 (P04) : deux tapes dans le même tour — la seconde tombe sur le bouton redessiné, éteint
        eq([...zone().querySelectorAll('button[data-role="monter"], button[data-role="descendre"]')].map((b) => b.disabled), Array(10).fill(true), 'T-C12 (ronde 1, ↑/↓ actifs pendant l’écriture) : dès la tape sur « Appliquer », les dix ↑/↓ sont éteints jusqu’à la fin de l’écriture');
        await attendre(() => zone().querySelector('[data-role="etat-ordre"]')?.textContent === 'Ordre enregistré.', 'ordre enregistré');
        for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 10)); // laisse finir une seconde transaction éventuelle (P04)
        eq(vus.length, 1, 'T-C12 (M46, ronde 1 P04) : « Appliquer cet ordre », même tapé deux fois dans le même tour, = UNE transaction (un seul appel de db.onMutate)');
        const m = vus[0];
        eq([Object.keys(m).sort(), m.source_pages.map((p) => [p.id, p.position]), m.source_pages.some((p) => 'role' in p || 'printed_page_range' in p), m.source_pages.map((p) => [p.kind, p.printed_page]), m.imports.map((i) => [i.id, i.status, i.page_ids, i.ordre_applique_at]), m.scan_sessions.map((s) => s.page_ids)],
          [['imports', 'scan_sessions', 'source_pages'], [['p2', 2], ['p1', 3], ['p3', 5], ['p4', 6], ['p5', 7]], false, [[null, null], [null, null], [null, null], [null, null], [null, null]], [['imp_o1', 'a_verifier', ['p2', 'p1', 'p3', 'p4', 'p5'], NOW]], [['q1', 'p2', 'p1', 'q4', 'p3', 'p4', 'p5']]],
          'T-C12 (M46, M47, M69, D-C15) : dans ce seul appel — les positions déjà occupées {2,3,5,6,7} réassignées (q1, q4 intactes), RIEN d’autre sur les pages (ni role, ni plage, ni kind, ni printed_page), la ligne (page_ids, ordre_applique_at, statut inchangé) et la séance réordonnée');
        const patchLigne = typeof opts?.patch === 'function' ? opts.patch(ligne) : null; // la ligne posée : même lecture (même clé)
        eq([opts?.attendus, typeof opts?.patch, Object.keys(patchLigne ?? {}).sort(), patchLigne?.page_ids, opts?.conditions?.scan_sessions?.map((c) => [c.key, c.attendus, typeof c.patch])], [['a_verifier'], 'function', ['ordre_applique_at', 'page_ids'], ['p2', 'p1', 'p3', 'p4', 'p5'], [['ss1', ['open', 'done'], 'function']]], 'T-C12 (V2, § 4.3, T4-R2) : « Appliquer » passe par la transition du repo injecté — attendus a_verifier, patch FONCTION (la clé de la lecture revérifiée dans la transaction) qui rend { page_ids, ordre_applique_at }, conditions.scan_sessions = [{ key, attendus open/done, patch FONCTION }] : la séance relue DANS la transaction');
        eq([appliquer().hidden, zone().querySelector('[data-role="etat-ordre"]').classList.contains('ok'), refreshs, apres.length, apres[0]?.pages.map((p) => [p.id, p.position]), apres[0]?.seance?.page_ids, dits, changements.length], [true, true, 0, 1, [['p2', 2], ['p1', 3], ['p3', 5], ['p4', 6], ['p5', 7]], ['q1', 'p2', 'p1', 'q4', 'p3', 'p4', 'p5'], [], 0], 'T-C12 (M70 en partie, D-C15) : « Ordre enregistré. » (.status ok), bouton caché, AUCUN refresh() (l’écran n’est pas reconstruit), apresOrdre reçoit une fois { pages, seance RELUE } ; aucun toast (sans effet en tâche 3 : l’option toast de panneauLecture naît en tâche 4, où la même assertion porte)');
        eq([(await db.get('scan_sessions', 'ss1')).page_ids, (await db.get('source_pages', 'p2')).position, (await db.get('imports', 'imp_o1')).ordre_applique_at], [['q1', 'p2', 'p1', 'q4', 'p3', 'p4', 'p5'], 2, NOW], 'T-C12 (M47) : en base, la séance réordonnée, la position neuve, ordre_applique_at posé');
        boutonTexte(zone(), 'Descendre la page 1').click();
        eq([vue.etatLecture().ordre, appliquer().hidden, appliquer().disabled, vus.length], [['p1', 'p2', 'p3', 'p4', 'p5'], false, false, 1], 'T-C12 (ronde 1, P03, § 4.3) : après un « Appliquer » réussi, la MÊME instance reste vivante — « Descendre la page 1 » change l’ordre, « Appliquer cet ordre » revient, allumé (une seconde correction est possible), rien d’écrit');
        const ctx2 = await ctxDe(repo, db);
        const vue2 = T.panneauLecture({ ligne: await db.get('imports', 'imp_o1'), resultat: C, session: ctx2.scan_sessions.find((s) => s.id === 'ss1'), ctx: ctx2, repo, maintenant: () => NOW, surChangement: () => changements.push(1) });
        scene.append(vue2);
        const z2 = vue2.querySelector('[data-role="ordre-photos"]');
        eq([vue2.etatLecture().ordre, z2.querySelector('[data-role="etat-ordre"]')?.textContent, z2.querySelector('[data-role="etat-ordre"]')?.classList.contains('ok'), z2.querySelector('[data-role="appliquer-ordre"]').hidden], [['p2', 'p1', 'p3', 'p4', 'p5'], 'Ordre enregistré.', true, true], 'T-C12 (M74, B-3) : reprise après un ordre corrigé appliqué → l’ordre de la séance (pas la proposition p1..p5), « Ordre enregistré. », bouton caché');
        await db.put('imports', { ...(await db.get('imports', 'imp_o1')), status: 'enregistre' }); // un autre chemin a tranché
        boutonTexte(z2, 'Monter la page 2').click();
        vus.length = 0;
        z2.querySelector('[data-role="appliquer-ordre"]').click();
        await attendre(() => changements.length === 1, 'conflit signalé à l’appelant');
        eq([vus.length, dits, (await db.get('scan_sessions', 'ss1')).page_ids], [0, [], ['q1', 'p2', 'p1', 'q4', 'p3', 'p4', 'p5']], 'T-C12 : conflit (la ligne a été enregistrée ailleurs) → rien d’écrit, aucun toast bruyant, surChangement appelé (l’appelant relit)');
        boutonTexte(z2, 'Descendre la page 2').click();
        eq([vue2.etatLecture().ordre, z2.querySelector('[data-role="appliquer-ordre"]').hidden, z2.querySelector('[data-role="appliquer-ordre"]').disabled], [['p1', 'p3', 'p2', 'p4', 'p5'], false, false], 'T-C12 (ronde 1, P03) : après un conflit, la même instance reste vivante (↑/↓ et « Appliquer cet ordre » rallumés)');
      } finally { db.onMutate = capture; window.removeEventListener('cuisineos:refresh', compter); scene.remove(); }
    }));
    await run('T-C12 ordre : même ordre que la séance, une photo, photo inconnue', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: ['p1', 'p2', 'p3', 'p4', 'p5'] } });
      const ctx = await ctxDe(repo, db); const session = ctx.scan_sessions[0];
      const meme = T.panneauLecture({ ligne: ligneAVerifier({ id: 'imp_o2', resultat: C }), resultat: C, session, ctx, repo });
      const zm = meme.querySelector('[data-role="ordre-photos"]');
      eq([zm.querySelector('[data-role="etat-ordre"]')?.textContent, zm.querySelector('[data-role="appliquer-ordre"]').hidden], ['L’ordre des photos suit les numéros lus.', true], 'T-C12 (M68, B-15) : ordre proposé = ordre de la séance, jamais appliqué → « L’ordre des photos suit les numéros lus. », bouton NON rendu');
      const une = { photos: [C.photos[1]], ecartees: C.ecartees, uncertain: [] };
      const v1 = T.panneauLecture({ ligne: ligneAVerifier({ id: 'imp_o3', page_ids: ['p1'], resultat: une }), resultat: une, session, ctx, repo });
      const formeA = D.revaliderResultatIndex(LECTURE_A, ['p1']);
      const vA = T.panneauLecture({ ligne: ligneAVerifier({ id: 'imp_o4', page_ids: ['p1'], resultat: LECTURE_A }), resultat: formeA, session, ctx, repo });
      eq([v1.querySelector('[data-role="ordre-photos"]')?.hidden ?? true, vA.querySelector('[data-role="ordre-photos"]')?.hidden ?? true], [true, true], 'T-C12 (M44, M43) : une seule photo, ou une photo inconnue (lecture du lot A) → aucune section d’ordre');
      // Ronde 1 (M43) : la forme A n'a qu'une photo, N ≥ 2 la cachait déjà — ici DEUX photos, dont une inconnue (forme C revalidée : page_id null admis).
      const deuxDontInconnue = D.revaliderResultatIndex({ photos: [C.photos[1], { ...C.photos[3], page_id: null }], ecartees: C.ecartees, uncertain: [] }, ['p1']);
      const vI = T.panneauLecture({ ligne: ligneAVerifier({ id: 'imp_o4b', page_ids: ['p1'], resultat: deuxDontInconnue }), resultat: deuxDontInconnue, session, ctx, repo });
      eq([deuxDontInconnue?.photos.map((p) => p.page_id), vI.querySelector('[data-role="ordre-photos"]')?.hidden ?? true, vI.querySelector('[data-role="appliquer-ordre"]'), vI.querySelectorAll('figure').length], [['p1', null], true, null, 0], 'T-C12 (ronde 1, M43) : deux photos dont une INCONNUE (page_id null) → aucune section d’ordre (N ≥ 2 ne suffit pas : jamais une vignette sans page, ni un ↑/↓ ou un « Appliquer » sur null)');
    }));
    await run('T-C12 ordre : une page ajoutée par un autre onglet reste dans la séance', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7 } });
      const ligne = ligneAVerifier({ id: 'imp_o5', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db); const session = ctx.scan_sessions[0];
      // La porte : entre la relecture de la séance par l'écran et l'écriture, un autre onglet ajoute une page à la séance.
      const espion = { ...repo, transitionner: async (s, k, o) => { if (s === 'imports' && o?.conditions?.scan_sessions) { const ss = await repo.get('scan_sessions', 'ss1'); await repo.save('scan_sessions', { ...ss, page_ids: [...ss.page_ids, 'pg_neuve'] }); } return repo.transitionner(s, k, o); } };
      const vue = T.panneauLecture({ ligne, resultat: C, session, ctx, repo: espion, maintenant: () => NOW });
      vue.querySelector('[data-role="appliquer-ordre"]').click();
      await attendre(async () => (await db.get('imports', 'imp_o5')).ordre_applique_at === NOW, 'ordre appliqué');
      eq((await db.get('scan_sessions', 'ss1')).page_ids, ['q1', 'p1', 'p2', 'q4', 'p3', 'p4', 'p5', 'pg_neuve'], 'T-C12 (M73, S-6) : la page ajoutée entre la relecture et l’écriture reste dans page_ids (la séance est patchée DANS la transaction, jamais précalculée)');
    }));
    await run('T-C12 ordre : une autre lecture arrivée pendant « Appliquer » n’est jamais réordonnée', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7 } });
      const ligne = ligneAVerifier({ id: 'imp_o6', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db); const session = ctx.scan_sessions[0];
      const changements = [];
      // Entre la relecture de l'écran et l'écriture, une AUTRE lecture (R2) arrive sur la ligne (autre onglet, synchro).
      const espion = { ...repo, transitionner: async (s, k, o) => { if (s === 'imports') await db.put('imports', { ...(await db.get('imports', k)), started_at: 'R2' }); return repo.transitionner(s, k, o); } };
      const vue = T.panneauLecture({ ligne, resultat: C, session, ctx, repo: espion, maintenant: () => NOW, surChangement: () => changements.push(1) });
      vue.querySelector('[data-role="appliquer-ordre"]').click();
      await attendre(() => changements.length === 1, 'conflit signalé');
      const l6 = await db.get('imports', 'imp_o6');
      eq([l6.ordre_applique_at ?? null, l6.page_ids, (await db.get('scan_sessions', 'ss1')).page_ids, (await db.get('source_pages', 'p1')).position], [null, ENVOI, SEANCE7, 3], 'T-C12 (T4-R2 du lot A, M-C4) : R2 arrivée entre la relecture et la transaction → la clé revérifiée DANS la transaction refuse : rien d’écrit (ni la ligne, ni la séance, ni les positions), l’appelant relit');
    }));
    await run('T-C12 ordre : une photo retirée de la base avant « Appliquer » reste dans la ligne', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7 } });
      const ligne = ligneAVerifier({ id: 'imp_o7', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db); const session = ctx.scan_sessions[0];
      const vue = T.panneauLecture({ ligne, resultat: C, session, ctx, repo, maintenant: () => NOW });
      await db.delete('source_pages', 'p3'); // retirée (autre onglet, synchro) APRÈS le rendu, AVANT « Appliquer » : permis tant qu'aucune recette ne la cite
      vue.querySelector('[data-role="appliquer-ordre"]').click();
      await attendre(async () => (await db.get('imports', 'imp_o7')).ordre_applique_at === NOW, 'ordre appliqué');
      const l7 = await db.get('imports', 'imp_o7');
      eq([l7.status, l7.page_ids, D.revaliderResultatIndex(l7.resultat, l7.page_ids) !== null, (await db.get('scan_sessions', 'ss1')).page_ids, (await db.get('source_pages', 'p3')) ?? null],
        ['a_verifier', ['p1', 'p2', 'p3', 'p4', 'p5'], true, ['q1', 'p3', 'p1', 'q4', 'p2', 'p4', 'p5'], null], 'T-C12 (M-C7, § 4.3) : une photo retirée de la base avant « Appliquer » → la ligne garde les N photos dans l’ordre choisi (page_ids = l’ordre, jamais les seules pages relues) : la lecture payée reste lisible (revaliderResultatIndex non nul) ; positions et séance pour les pages présentes seulement, p3 garde son créneau et n’est pas recréée');
    }));
    await run('T-C12 (ronde 1) ordre : une page retirée entre la relecture et la transaction n’est jamais ressuscitée', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7 } });
      const ligne = ligneAVerifier({ id: 'imp_o8', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db); const session = ctx.scan_sessions[0];
      // La porte : APRÈS la relecture des pages par l'écran et AVANT la transaction, p3 est retirée (« Retirer » d'un autre onglet, tombale reçue) et une
      // « p. imprimée » est posée sur p1 (champ de la vignette de séance, autre onglet).
      const espion = { ...repo, transitionner: async (s, k, o) => { if (s === 'imports') { await repo.remove('source_pages', 'p3'); await repo.save('source_pages', { ...(await repo.get('source_pages', 'p1')), printed_page: 12 }); } return repo.transitionner(s, k, o); } };
      const vue = T.panneauLecture({ ligne, resultat: C, session, ctx, repo: espion, maintenant: () => NOW });
      vue.querySelector('[data-role="appliquer-ordre"]').click();
      await attendre(async () => (await db.get('imports', 'imp_o8')).ordre_applique_at === NOW, 'ordre appliqué');
      const p1 = await db.get('source_pages', 'p1');
      eq([(await db.get('source_pages', 'p3')) ?? null, (await db.getAll('outbox')).filter((o) => o.store === 'source_pages' && o.id === 'p3').map((o) => o.op), [p1.position, p1.printed_page], (await db.get('source_pages', 'p2')).position],
        [null, ['delete'], [2, 12], 3], 'T-C12 (ronde 1, § 4.3 : fusion au lieu de puts) : chaque page ne reçoit QUE sa position, sur sa fiche RELUE dans la transaction — une page retirée entre la relecture et l’écriture n’est jamais ressuscitée (aucun put après sa suppression en file), une « p. imprimée » posée dans la fenêtre survit');
    }));
    await run('T-C12 (ronde 1) ordre : une photo retirée de la séance après un « Appliquer », puis reprise', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7 } });
      const ligne = ligneAVerifier({ id: 'imp_o9', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const vue = T.panneauLecture({ ligne, resultat: C, session: ctx.scan_sessions[0], ctx, repo, maintenant: () => NOW });
      vue.querySelector('[data-role="appliquer-ordre"]').click();
      await attendre(async () => (await db.get('imports', 'imp_o9')).ordre_applique_at === NOW, 'premier ordre appliqué');
      // p5 (la page décorative) retirée de la séance et de la base : « Retirer » ne refuse que les pages citées par une recette.
      const ss = await db.get('scan_sessions', 'ss1');
      await db.put('scan_sessions', { ...ss, page_ids: ss.page_ids.filter((id) => id !== 'p5') });
      await db.delete('source_pages', 'p5');
      const ctx2 = await ctxDe(repo, db);
      const NOW2 = '2026-10-19T13:00:00.000Z';
      const reprise = T.panneauLecture({ ligne: await db.get('imports', 'imp_o9'), resultat: C, session: ctx2.scan_sessions[0], ctx: ctx2, repo, maintenant: () => NOW2 });
      const ordreReprise = reprise.etatLecture().ordre;
      boutonTexte(reprise, 'Descendre la page 1').click();
      reprise.querySelector('[data-role="appliquer-ordre"]').click();
      await attendre(async () => (await db.get('imports', 'imp_o9')).ordre_applique_at === NOW2, 'second ordre appliqué');
      const l9 = await db.get('imports', 'imp_o9');
      eq([ordreReprise, l9.page_ids, D.revaliderResultatIndex(l9.resultat, l9.page_ids) !== null], [['p1', 'p2', 'p3', 'p4', 'p5'], ['p2', 'p1', 'p3', 'p4', 'p5'], true], 'T-C12 (ronde 1, P17, M-C7) : reprise après un « Appliquer » puis une photo retirée de la séance → l’ordre courant garde les N photos (projection de la séance + la photo absente en queue) ; un second « Appliquer » écrit N page_ids et la lecture payée reste lisible');
    }));
    await run('T-C12 (ronde 1) ordre : refus à la relecture, autre séance, résultat qui n’est pas celui de la ligne', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7, ss2: ['q7'] } });
      await db.mutate({ puts: { imports: ['imp_o10', 'imp_o11', 'imp_o12'].map((id) => ligneAVerifier({ id, resultat: C })) }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const [ss1, ss2] = ['ss1', 'ss2'].map((id) => ctx.scan_sessions.find((s) => s.id === id));
      const changements = []; let transitions = 0;
      const espion = { ...repo, transitionner: async (...a) => { transitions += 1; return repo.transitionner(...a); } };
      const essaiApplique = async (id, opts) => {
        const n = changements.length;
        const vue = T.panneauLecture({ ligne: await db.get('imports', id), resultat: C, session: ss1, ctx, repo: espion, maintenant: () => NOW, surChangement: () => changements.push(id), ...opts });
        if (id === 'imp_o10') await db.put('imports', { ...(await db.get('imports', id)), started_at: 'R2' }); // une autre lecture arrivée AVANT le clic
        vue.querySelector('[data-role="appliquer-ordre"]').click();
        await attendre(() => changements.length === n + 1, 'refus signalé (' + id + ')');
        const l = await db.get('imports', id);
        return [l.ordre_applique_at ?? null, l.page_ids];
      };
      const relecture = await essaiApplique('imp_o10', {});
      eq([relecture, transitions], [[null, ENVOI], 0], 'T-C12 (ronde 1, refus à la relecture) : la ligne porte une autre lecture AVANT le clic → refus à la relecture, AUCUNE transition, surChangement appelé (l’appelant relit), rien d’écrit');
      const autreSeance = await essaiApplique('imp_o11', { session: ss2 });
      const deux = D.revaliderResultatIndex({ photos: [C.photos[0], C.photos[1]], ecartees: C.ecartees, uncertain: [] }, ['p3', 'p1']);
      const autreResultat = await essaiApplique('imp_o12', { resultat: deux });
      eq([autreSeance, autreResultat, (await db.get('scan_sessions', 'ss1')).page_ids, (await db.get('source_pages', 'p1')).position, [...changements]], [[null, ENVOI], [null, ENVOI], SEANCE7, 3, ['imp_o10', 'imp_o11', 'imp_o12']], 'T-C12 (ronde 1, défense en profondeur) : une séance qui n’est pas celle de la ligne, ou un résultat qui n’est pas celui de la ligne (l’ordre n’est pas une permutation de ses photos) → la transaction refuse : rien d’écrit (ni la ligne, ni la séance, ni les positions), surChangement appelé');
    }));
    await run('T-C12 (ronde 1) ordre : positions absentes ou non entières départagées par le rang de la séance relue', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: ['p2', 'p1'] } });
      // Venues d'un autre appareil ou d'une archive (S-19) : p2 à 4,5, p1 sans position — réassignées TELLES QUELLES, départagées par le rang de la séance.
      await db.put('source_pages', { ...(await db.get('source_pages', 'p2')), position: 4.5 });
      await db.put('source_pages', { ...(await db.get('source_pages', 'p1')), position: null });
      const deux = D.revaliderResultatIndex({ photos: [C.photos[1], C.photos[3]], ecartees: C.ecartees, uncertain: [] }, ['p1', 'p2']);
      const ligne = ligneAVerifier({ id: 'imp_o13', page_ids: ['p1', 'p2'], resultat: deux });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const vue = T.panneauLecture({ ligne, resultat: deux, session: ctx.scan_sessions[0], ctx, repo, maintenant: () => NOW });
      vue.querySelector('[data-role="appliquer-ordre"]').click();
      await attendre(async () => (await db.get('imports', 'imp_o13')).ordre_applique_at === NOW, 'ordre appliqué');
      eq([(await db.get('source_pages', 'p1')).position, (await db.get('source_pages', 'p2')).position, (await db.get('scan_sessions', 'ss1')).page_ids], [4.5, null, ['p1', 'p2']], 'T-C12 (ronde 1, P09, S-19) : deux positions non entières → les créneaux sont rangés par le rang de la SÉANCE RELUE (p2 avant p1 : 4,5 puis aucune) et réassignés dans l’ordre choisi (p1, p2) : p1 reçoit 4,5, p2 aucune');
    }));
    await run('T-C12 (ronde 1) ordre : les vignettes montrent les photos, une image par page pour toute l’instance', () => withRepo(async (repo, db) => {
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7 }, octets: true });
      const ligne = ligneAVerifier({ id: 'imp_o14', resultat: C });
      await db.mutate({ puts: { imports: [ligne] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      let lectures = 0;
      const espion = { ...repo, getFile: async (sha) => { lectures += 1; return repo.getFile(sha); } };
      const scene = nouvelleScene();
      try {
        const vue = T.panneauLecture({ ligne, resultat: C, session: ctx.scan_sessions[0], ctx, repo: espion, maintenant: () => NOW });
        scene.append(vue);
        const imgs = () => [...vue.querySelectorAll('[data-role="ordre-photos"] .thumbs figure img')];
        await attendre(() => imgs().length === 5 && imgs().every((i) => i.src.startsWith('blob:')), 'cinq photos affichées');
        const avant = new Map(imgs().map((i) => [i.closest('figure').dataset.page, i]));
        const srcAvant = imgs().map((i) => i.src);
        boutonTexte(vue, 'Descendre la page 1').click();
        boutonTexte(vue, 'Monter la page 3').click();
        await tick();
        eq([imgs().map((i) => i.closest('figure').dataset.page), imgs().every((i) => i === avant.get(i.closest('figure').dataset.page)), imgs().map((i) => i.alt), [...imgs().map((i) => i.src)].sort(), lectures],
          [['p2', 'p3', 'p1', 'p4', 'p5'], true, ['Page 1', 'Page 2', 'Page 3', 'Page 4', 'Page 5'], [...srcAvant].sort(), 5], 'T-C12 (ronde 1, P02, § 4.3) : chaque vignette montre la photo de sa page (src blob:) ; ↑/↓ déplacent les MÊMES images (aucune relecture, aucune URL neuve : 5 lectures pour l’instance), l’alt suit le rang');
      } finally { scene.remove(); }
    }));
    await run('T-C12 reordonnerVignettes : l’écran de séance suit sans reconstruction', async () => {
      const I = await import('../src/ui/import.js');
      const ctx = { pagesById: new Map([['a', { id: 'a', position: 1 }], ['b', { id: 'b', position: 2 }], ['c', { id: 'c', position: 3 }]]) };
      const session = { id: 's', page_ids: ['a', 'b', 'c'] };
      const thumbs = document.createElement('div');
      for (const id of ['a', 'b', 'c']) { const f = document.createElement('figure'); f.dataset.page = id; const n = document.createElement('span'); n.className = 'num'; n.textContent = String(ctx.pagesById.get(id).position); f.append(n, document.createElement('img')); thumbs.append(f); }
      const noeuds = [...thumbs.children]; const objetC = ctx.pagesById.get('c');
      I.reordonnerVignettes(thumbs, { pages: [{ id: 'c', position: 1 }, { id: 'a', position: 3 }], seance: { id: 's', page_ids: ['c', 'b', 'a'] } }, { ctx, session });
      eq([[...thumbs.children].map((f) => f.dataset.page), [...thumbs.children].map((f) => f.querySelector('.num').textContent), session.page_ids, objetC.position, ctx.pagesById.get('c') === objetC, [...thumbs.children].every((f) => noeuds.includes(f))], [['c', 'b', 'a'], ['1', '2', '3'], ['c', 'b', 'a'], 1, true, true], 'T-C12 (M71, M72, D-C15) : les MÊMES figures réordonnées en place, .num réécrits, session.page_ids posé, les MÊMES objets de ctx.pagesById mis à jour (le champ « p. imprimée » réécrira la position neuve)');
      eq([...thumbs.children].map((f) => f.querySelector('img').alt), ['Page 1', 'Page 2', 'Page 3'], 'T-C12 (ronde 1, V40) : l’alt de chaque vignette de séance dit sa position NEUVE (« Page {position} »)');
    });

    await run('T-C11 reprise : présélection des pages de la lecture (cases cochées)', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      await poserBibliotheque(repo, db, { seances: { ss1: ['p1', 'p2', 'p3'], ss2: ['p4', 'p5'], ss3: ['q1', 'q4'], ss4: ['q5'] } });
      await db.mutate({ puts: { imports: [
        { ...ligneJournal({ id: 'imp_r1', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p1', 'p3'] }), status: 'echec', erreur: { raison: 'coupe', extra: {} } },
        { ...ligneJournal({ id: 'imp_r2', edition_id: 'ed1', scan_session_id: 'ss2', page_ids: ['p4', 'pg_absente'] }), status: 'a_lancer' },
        { ...ligneJournal({ id: 'imp_r3', edition_id: 'ed1', scan_session_id: 'ss3', page_ids: ['q1'] }), status: 'echec', erreur: { raison: 'coupe', extra: {} } },
        // Ronde 1 (I30) : dans ss1, une lecture d'index CLOSE et une lecture d'une AUTRE SORTE (recette sans référence), chacune sur p2.
        { ...ligneJournal({ id: 'imp_c1', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p2'] }), status: 'enregistre', finished_at: DATE },
        { ...ligneJournal({ id: 'imp_k1', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p2'] }), kind: 'recette', status: 'echec', erreur: { raison: 'coupe', extra: {} } },
      ] }, origin: 'device' });
      const ctx = await ctxDe(repo, db);
      const cases = (root) => Object.fromEntries([...root.querySelectorAll(':scope > .thumbs > figure')].map((f) => [f.dataset.page, f.querySelector('input[type=checkbox]').checked]));
      const pagesDuLien = (root) => { const a = [...root.querySelectorAll('a')].find((x) => x.textContent === 'Regrouper en recette'); return a ? new URLSearchParams(a.getAttribute('href').split('?')[1]).get('pages') : null; };
      const panneau = (root) => root.querySelector('[data-role="panneau-index"]');
      const r1 = await I.renderImport({}, { session: 'ss1', import: 'imp_r1' }, ctx);
      eq([cases(r1), panneau(r1)?.hidden], [{ p1: true, p2: false, p3: true }, false], 'T-C11 (M96, D-C22) : ?import= d’une ligne index OUVERTE de la séance (sans intention) → ses page_ids cochés, le panneau visible');
      const r2 = await I.renderImport({}, { session: 'ss2', import: 'imp_r2' }, ctx);
      eq([cases(r2), pagesDuLien(r2)], [{ p4: true, p5: false }, 'p4'], 'T-C11 (M97, C6) : un identifiant de la ligne sans vignette (page absente) n’est JAMAIS sélectionné');
      eq(cases(await I.renderImport({}, { session: 'ss1', import: 'imp_r1', intention: 'index' }, ctx)), { p1: true, p2: true, p3: true }, 'T-C11 (D-C22) : avec ?intention=index, la sélection de l’intention gagne (toutes les pages) — ronde 1 : la garde « !applique.consommee » est équivalente tant que l’intention coche TOUTES les pages résolues, un sur-ensemble de celles de la ligne (ce cas ne la tue pas)');
      const r4 = await I.renderImport({}, { session: 'ss3' }, ctx);
      eq([cases(r4), panneau(r4)?.hidden], [{ q1: false, q4: false }, false], 'T-C11 (M67, § 4.1) : sans ?import= mais avec une ligne ouverte → le panneau est VISIBLE au rendu, rien de coché');
      eq(cases(await I.renderImport({}, { session: 'ss1', import: 'imp_inconnu' }, ctx)), { p1: false, p2: false, p3: false }, 'T-C11 : un ?import= qui ne désigne aucune ligne ouverte de la séance → aucune présélection');
      // Ronde 1 (I30) : la ligne que ?import= désigne n'est reprise (cases, importId du panneau) que si elle est OUVERTE, d'index, de CETTE séance. L'importId
      // passé au panneau se lit par le repo injecté (deps). Lot C, tâche 4 (D-C16 ; constats 21 et 25 renvoyés par la ronde 1 de T3) : le panneau lit sa
      // ligne dans le journal de SA séance (repo.all('imports') ; relireDuJournal, donc repo.get, pour une lecture reçue seulement) — le témoin de l'espion
      // devient cette lecture du journal par le repo INJECTÉ, et l'importId effectivement REPRIS est affirmé : imp_r1, la lecture d'index OUVERTE de ss1.
      // Ronde 1 de T4 (constats 2 et 24) : `lus` est lu APRÈS le redessin — le témoin compte les lectures du journal RENDUES (pas commencées), puis un tour
      // de boucle laisse finir ce que charger() enchaîne après elles (une relecture de la ligne désignée faite après repo.all est vue, mutants M1 et N60).
      const lus = []; let journal = 0;
      const deps = { repo: { ...repo, get: async (s, k) => { if (s === 'imports') lus.push(k); return repo.get(s, k); }, all: async (s) => { const r = await repo.all(s); if (s === 'imports') journal += 1; return r; } } };
      const reprise = async (importId) => { lus.length = 0; journal = 0; const r = await I.renderImport({}, { session: 'ss1', import: importId }, ctx, deps); await attendre(() => journal > 0, 'journal relu par le repo injecté'); await tick(); return [cases(r), lus.includes(importId), panneau(r).etatPanneau().importId]; };
      const aucune = { p1: false, p2: false, p3: false };
      eq([await reprise('imp_r1'), await reprise('imp_c1'), await reprise('imp_k1'), await reprise('imp_r2')], [[{ p1: true, p2: false, p3: true }, false, 'imp_r1'], [aucune, false, 'imp_r1'], [aucune, false, 'imp_r1'], [aucune, false, 'imp_r1']], 'T-C11 (ronde 1, I30) : ?import= d’une lecture CLOSE, d’une AUTRE SORTE (recette) ou d’une AUTRE SÉANCE (imp_r2 de ss2) → aucune case cochée, et le panneau ne relit jamais la ligne désignée (aucun repo.get, mesuré après le redessin) ; dans les quatre cas, le panneau, qui lit le journal par le repo INJECTÉ (témoin), reprend la lecture d’index OUVERTE de la séance (imp_r1, D-C16) (forme C, lot C)');
      const r5 = await I.renderImport({}, { session: 'ss4', intention: 'index' }, ctx);
      const r6 = await I.renderImport({}, { session: 'ss4' }, ctx);
      eq([panneau(r5)?.hidden, panneau(r6)?.hidden], [false, true], 'T-C11 (ronde 1, I34) : séance SANS ligne ouverte — avec ?intention=index (fiche livre → « + Pages d’index ») le panneau d’index est visible ; sans intention ni ligne ouverte, il est caché');
    }));

    // =================================================================================================================================
    // Tâche 4 — tableau d'entrées, vol, reprise, relecture (§ 4.2, § 4.4, D-C16, D-C19, D-C21, N-1, N-2, Q1-Q5)
    await run('T-C10 lecture reçue : un POST, le vol, Annuler, le tableau', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const UI = await import('../src/ui/import-cible.js');
      await poserBibliotheque(repo, db, { octets: true });
      const ctx = await ctxDe(repo, db);
      const session = ctx.scan_sessions.find((s) => s.id === 'ss1');
      const scene = nouvelleScene(); const dits = []; const ff = fauxFetch();
      let coches = ['p5', 'p1', 'p3'];
      let tableauAuMoment = null; let panneau = null; const capture = db.onMutate;
      db.onMutate = (m) => { if (m.puts.imports?.[0]?.status === 'a_verifier') tableauAuMoment = !!panneau?.querySelector('[data-role="entrees-lues"]'); return capture ? capture(m) : {}; };
      try {
        panneau = I.indexEntriesPanel(session, ctx, () => coches, { repo, toast: (m) => dits.push(m), confirmer: async () => true, fetch: ff.fetch, maintenant: () => NOW, battementMs: 60000 });
        scene.append(panneau);
        await attendre(() => !lireIndex(panneau).disabled, 'session lue, bouton allumé');
        lireIndex(panneau).click(); lireIndex(panneau).click(); // double clic
        await attendre(() => ff.appels.length === 1 && !!panneau.querySelector('.status[role="status"]'), 'fetch parti, état en vol');
        await tick();
        const enVol = await ligneDe(db, 'ss1');
        eq([ff.appels.length, dits.filter((d) => d.startsWith('Une lecture est déjà en cours')), enVol.page_ids, enVol.status, enVol.document_id_vol, typeof enVol.battement_at, enVol.appels, imagesEnvoyees(ff.appels[0])], [1, [], ['p3', 'p1', 'p5'], 'en_cours', UI.DOCUMENT_ID, 'string', 1, 3], 'T-C10 (M39, M61, M93) : UN POST au double clic, et AUCUN refus « vol tenu » dit (le second clic n’atteint pas lire() : le bouton est éteint) ; page_ids dans l’ordre de la SÉANCE bien que coché 5,1,3 ; en_cours tenu par ce document, battement posé, appels 1 au départ du fetch');
        const st = panneau.querySelector('.status[role="status"]');
        eq([st?.textContent, st?.nextElementSibling?.classList.contains('row'), lireIndex(panneau).closest('[data-role="actions-index"]')?.hidden, !!boutonTexte(st?.nextElementSibling, 'Annuler')], ['Lecture des pages par l’assistant…', true, true, true], 'T-C10 (M94, R-VIS-8) : pendant le vol, .status[role=status] « Lecture des pages par l’assistant… » puis une .row avec « Annuler » ; le vrai bouton « Lire » est caché avec sa rangée (actions-index : le primaire éteint de la .row n’est qu’une place)');
        eq([panneau.querySelector('textarea')?.disabled, boutonTexte(panneau, 'Créer les références')?.disabled], [true, true], 'T-C10 (ronde 1, N08, § 4.2) : pendant le vol, la zone de texte et « Créer les références » sont éteintes');
        boutonTexte(panneau, 'Annuler').click();
        await attendre(async () => (await ligneDe(db, 'ss1')).status === 'echec' && !UI.volEnCours() && panneau.textContent.includes('Lecture annulée.'), 'annulée');
        eq([(await ligneDe(db, 'ss1')).erreur?.raison, lireIndex(panneau).textContent, (await db.byIndex('recipes', 'edition_id', 'ed1')).length, ff.appels[0].options.signal.aborted], ['annule', 'Relancer', 2, true], 'T-C10 : « Annuler » → fetch abandonné, echec(annule), « Lecture annulée… », « Relancer » offert, aucune fiche');
        coches = [...ENVOI]; ff.auto = [200, corpsModele(LECTURE_5)];
        lireIndex(panneau).click();
        await attendre(async () => (await ligneDe(db, 'ss1'))?.status === 'a_verifier' && !!panneau.querySelector('[data-role="entrees-lues"]'), 'lecture reçue, tableau rendu');
        const lu = await ligneDe(db, 'ss1');
        eq([lu.page_ids, lu.resultat?.photos?.map((p) => p.page_id), typeof lu.duree_ms, lu.model, lu.started_at, lu.finished_at ?? null, lu.appels, tableauAuMoment, (await db.getAll('imports')).filter((i) => i.kind === 'index').length],
          [ENVOI, ENVOI, 'number', 'claude-x', NOW, null, 2, false, 1], 'T-C10 (M40, P1, M76) : la MÊME ligne (echec → en_cours → a_verifier) porte le résultat de forme C, duree_ms, model et started_at — PAS de finished_at — écrits AVANT le rendu du tableau ; appels 2');
        const etat = panneau.querySelector('[data-role="etat"]')?.textContent ?? '';
        const lis = [...panneau.querySelectorAll('[data-role="entrees-lues"] li')];
        const deja = lis.filter((li) => li.querySelector('[data-role="puces"]').textContent.includes('déjà repérée'));
        eq([/^Lue en \d+ s · 5 photo\(s\)$/.test(etat), !!panneau.querySelector('[data-role="ordre-photos"]:not([hidden])'), lis.length, deja.length, deja.every((li) => { const c = li.querySelector('input[type=checkbox]'); return !c.checked && c.disabled; }), panneau.querySelectorAll('[data-role="entrees-lues"] .chip.warn').length, panneau.querySelector('[data-role="compteur"]')?.textContent, panneau.querySelector('[data-role="creer-references"]')?.textContent, panneau.querySelector('[data-role="quota"]')?.hidden, panneau.querySelector('[data-role="quota"]')?.textContent, panneau.querySelector('[data-role="zone-saisie"]')?.hidden, panneau.querySelector('[data-role="incertain"]')],
          [true, true, 23, 2, true, 0, '23 entrées lues · 2 déjà dans ce livre', 'Créer 21 références', false, 'Une lecture = un appel à l’assistant, compté dans ton quota du jour.', true, null],
          'T-C10 (M66, Q5) : « Lue en {s} s · 5 photo(s) », « Ordre des photos », 23 lignes, 2 « déjà repérée » décochées ET désactivées, 0 puce « incertain », le compteur, « Créer 21 références », le texte du quota, la zone de texte cachée, aucune ligne « Incertain »');
      } finally { db.onMutate = capture; UI.reinitialiserImportCible(); scene.remove(); }
    }));
    await run('T-C10 entrées écartées en tête de « Incertain », reprise, photos comptées sur le tableau', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const UI = await import('../src/ui/import-cible.js');
      await poserBibliotheque(repo, db, { octets: true, seances: { ss1: ENVOI, ss2: ENVOI } });
      const L201 = { photos: LECTURE_5.photos.map((p) => (p.photo === 2 ? { ...p, entries: p.entries.map((e) => (e.title === 'Gaspacho' ? { ...e, title: 'é'.repeat(201) } : e.title === 'Tian de courgettes' ? { ...e, title: 'è'.repeat(201) } : e)) } : p)), uncertain: ['a'.repeat(200), 'b'.repeat(200)] };
      const scene = nouvelleScene(); const ff = fauxFetch([200, corpsModele(L201)]);
      try {
        const ctx = await ctxDe(repo, db);
        const p1 = I.indexEntriesPanel(ctx.scan_sessions.find((s) => s.id === 'ss1'), ctx, () => [...ENVOI], { repo, toast: () => {}, confirmer: async () => false, fetch: ff.fetch, maintenant: () => NOW });
        scene.append(p1);
        await attendre(() => !lireIndex(p1).disabled, 'bouton allumé');
        lireIndex(p1).click();
        await attendre(() => !!p1.querySelector('[data-role="entrees-lues"]'), 'tableau rendu');
        const lu = await ligneDe(db, 'ss1');
        const inc = p1.querySelector('[data-role="incertain"]')?.textContent ?? '';
        eq([lu.resultat.ecartees, lu.resultat.uncertain, inc.startsWith('Incertain : 2 entrées écartées (trop longues) ; '), Array.from(inc.slice('Incertain : '.length)).length <= 300, inc.endsWith('…'), p1.querySelectorAll('[data-role="entrees-lues"] li').length],
          [{ trop_longues: 2, adresse: 0 }, ['a'.repeat(200), 'b'.repeat(200)], true, true, true, 21], 'T-C10 (M95, M95b, Q1, P3) : en base ecartees.trop_longues = 2 et uncertain = les deux chaînes du MODÈLE seules ; à l’écran « Incertain : » COMMENCE par « 2 entrées écartées (trop longues) ; » (lu sous la borne de 300, coupée avec « … »), 21 lignes (jamais une entrée tronquée)');
        const ctxR = await ctxDe(repo, db);
        const questions2 = [];
        const p2 = I.indexEntriesPanel(ctxR.scan_sessions.find((s) => s.id === 'ss1'), ctxR, () => [], { repo, toast: () => {}, confirmer: async (q) => { questions2.push(q); return false; }, fetch: ff.fetch, maintenant: () => NOW, importId: lu.id });
        scene.append(p2);
        // Ronde 1 : un FAIT d'abord (la session lue, le bouton allumé), PUIS la borne : une relecture lancée au montage, même après la session (jusqu'à 2 s
        // sur un jeton qui se rafraîchit), aurait posé sa question pendant ces 100 ms.
        await attendre(() => !lireIndex(p2).disabled, 'session lue, bouton allumé (reprise)');
        await new Promise((r) => setTimeout(r, 100));
        eq([p2.querySelector('[data-role="incertain"]')?.textContent, ff.appels.length, questions2], [inc, 1, []], 'T-C10 (M104, M41) : la même ligne REPRISE (nouvelle instance, résultat revalidé) rend le même texte, sans appel ni question de relecture (confirmer injecté)');
        const ctx2 = await ctxDe(repo, db);
        await db.delete('source_pages', 'p4'); // retirée de la base APRÈS la lecture du contexte, AVANT le vol
        const ff2 = fauxFetch([200, corpsModele({ photos: LECTURE_5.photos.slice(0, 4), uncertain: [] })]);
        const p3 = I.indexEntriesPanel(ctx2.scan_sessions.find((s) => s.id === 'ss2'), ctx2, () => [...ENVOI], { repo, toast: () => {}, confirmer: async () => false, fetch: ff2.fetch, maintenant: () => NOW });
        scene.append(p3);
        await attendre(() => !lireIndex(p3).disabled, 'bouton allumé');
        lireIndex(p3).click();
        await attendre(() => !!p3.querySelector('[data-role="entrees-lues"]'), 'tableau rendu');
        const l3 = await ligneDe(db, 'ss2');
        eq([l3.page_ids.length, l3.resultat.photos.length, imagesEnvoyees(ff2.appels[0]), /· 4 photo\(s\)$/.test(p3.querySelector('[data-role="etat"]')?.textContent ?? '')], [5, 4, 4, true], 'T-C10 (M108, Q5) : une page de la ligne absente au vol → 4 images, 4 blocs ; « 4 photo(s) » compte le TABLEAU, pas page_ids (5)');
      } finally { UI.reinitialiserImportCible(); scene.remove(); }
    }));

    await run('T-C11 reprise sans appel, relecture sur les photos de la lecture, deux lignes, résultat hostile, lecture du lot A', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const UI = await import('../src/ui/import-cible.js');
      await poserBibliotheque(repo, db, { octets: true, seances: { ss1: ENVOI, ss2: ['p1', 'p2'], ss3: ['p3', 'p4'], ss4: ['q1', 'q4'], ss5: ['p2'] } });
      const resultatDe = (ids) => D.resultatIndex(L.validerLectureIndex(blocsDe(ids), { nbPhotos: ids.length }), ids);
      await db.mutate({ puts: { imports: [
        ligneAVerifier({ id: 'imp_a', resultat: C }),
        ligneAVerifier({ id: 'imp_old', sessionId: 'ss2', page_ids: ['p1'], resultat: resultatDe(['p1']), over: { updated_at: '2026-10-19T08:00:00.000Z' } }),
        { ...ligneJournal({ id: 'imp_new', edition_id: 'ed1', scan_session_id: 'ss2', page_ids: ['p2'] }), status: 'echec', erreur: { raison: 'coupe', extra: {} }, updated_at: '2026-10-19T09:00:00.000Z' },
        ligneAVerifier({ id: 'imp_c', sessionId: 'ss3', page_ids: ['p3', 'p4'], resultat: resultatDe(['p3', 'p4']) }),
        ligneAVerifier({ id: 'imp_h', sessionId: 'ss4', page_ids: ['q1'], resultat: { photos: 'x', ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] } }),
        ligneAVerifier({ id: 'imp_la', sessionId: 'ss5', page_ids: ['p2'], resultat: LECTURE_A }),
      ] }, origin: 'device' });
      const ff = fauxFetch([200, corpsModele(LECTURE_5)]);
      const dits = []; const questions = [];
      const deps = { repo, toast: (m) => dits.push(m), confirmer: async (q) => { questions.push(q); return true; }, fetch: ff.fetch, maintenant: () => NOW };
      const cochees = (root) => [...root.querySelectorAll(':scope > .thumbs > figure')].filter((f) => f.querySelector('input[type=checkbox]').checked).map((f) => f.dataset.page);
      const scene = nouvelleScene();
      try {
        const r1 = await I.renderImport({}, { session: 'ss1', import: 'imp_a' }, await ctxDe(repo, db), deps);
        scene.append(r1);
        const p = r1.querySelector('[data-role="panneau-index"]');
        eq([cochees(r1), p.hidden, !!p.querySelector('[data-role="entrees-lues"]'), ff.appels.length], [ENVOI, false, true, 0], 'T-C11 (M41, M96) : #/import?session=…&import=<imp> sur une ligne a_verifier → le tableau SANS appel, les pages de la lecture cochées');
        await attendre(() => !lireIndex(p).disabled, 'bouton allumé');
        lireIndex(p).click();
        await attendre(async () => ff.appels.length === 1 && (await db.get('imports', 'imp_a')).status === 'a_verifier' && UI.volEnCours() === null, 'relecture faite');
        eq([questions.length, (await db.get('imports', 'imp_a')).page_ids, imagesEnvoyees(ff.appels[0]), dits.filter((d) => d.startsWith('Sélectionne'))], [1, ENVOI, 5, []], 'T-C11 (M98, N-2) : « Lire » après « Reprendre » → confirmation, puis UN POST sur les photos de la lecture, page_ids inchangés, JAMAIS le toast « Sélectionne les pages d’index à lire »');
        const ff3 = fauxFetch([200, corpsModele(blocsDe(['p3', 'p4']))]);
        const r3 = await I.renderImport({}, { session: 'ss3' }, await ctxDe(repo, db), { ...deps, fetch: ff3.fetch });
        scene.append(r3);
        const p3 = r3.querySelector('[data-role="panneau-index"]');
        eq([p3.hidden, cochees(r3)], [false, []], 'T-C11 (M67) : sans ?import=, une ligne ouverte → panneau visible au rendu, rien de coché');
        await attendre(() => !lireIndex(p3).disabled, 'bouton allumé');
        lireIndex(p3).click();
        await attendre(() => ff3.appels.length === 1, 'un POST');
        eq([imagesEnvoyees(ff3.appels[0]), (await db.get('imports', 'imp_c')).page_ids, dits.filter((d) => d.startsWith('Sélectionne'))], [2, ['p3', 'p4'], []], 'T-C11 (M84) : rien de coché → « Lire » (relecture confirmée) part sur ligne.page_ids');
        await attendre(() => UI.volEnCours() === null, 'vol fini');
        const avecImport = await I.renderImport({}, { session: 'ss2', import: 'imp_old' }, await ctxDe(repo, db), deps);
        const sansImport = await I.renderImport({}, { session: 'ss2' }, await ctxDe(repo, db), deps);
        eq([avecImport.querySelector('[data-role="panneau-index"]').etatPanneau().importId, sansImport.querySelector('[data-role="panneau-index"]').etatPanneau().importId], ['imp_old', 'imp_new'], 'T-C11 (B-18) : deux lignes ouvertes pour la séance → ?import= gagne, sinon la plus récente (updated_at)');
        const rh = await I.renderImport({}, { session: 'ss4' }, await ctxDe(repo, db), deps);
        scene.append(rh);
        const ph = rh.querySelector('[data-role="panneau-index"]');
        await attendre(async () => (await db.get('imports', 'imp_h')).status === 'echec' && ph.textContent.includes('Code : illisible'), 'echec(illisible) au montage');
        const lh = await db.get('imports', 'imp_h');
        eq([lh.erreur?.raison, lh.resultat, ph.querySelector('[data-role="zone-saisie"]').hidden, ph.textContent.includes('L’assistant n’a pas répondu lisiblement. Réessaie.'), !!ph.querySelector('[data-role="entrees-lues"]')], ['illisible', null, false, true, false], 'T-C11 (M42, I-1) : un résultat hostile en base → a_verifier → echec(illisible) AU MONTAGE, résultat effacé, zone de texte, texte générique + « Code : illisible », aucun tableau');
        const ra = await I.renderImport({}, { session: 'ss5' }, await ctxDe(repo, db), deps);
        const pa = ra.querySelector('[data-role="panneau-index"]');
        eq([[...pa.querySelectorAll('[data-role="entrees-lues"] li [data-role="photo"]')].map((s) => s.textContent), pa.querySelector('[data-role="ordre-photos"]')?.hidden ?? true], [['photo inconnue', 'photo inconnue'], true], 'T-C11 (M43, D-C11) : une lecture du lot A en base → le tableau avec « photo inconnue », aucune section d’ordre');
      } finally { UI.reinitialiserImportCible(); scene.remove(); }
    }));

    await run('T-C12 Appliquer avec une édition locale du tableau, bout en bout dans la séance', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      await poserBibliotheque(repo, db, { seances: { ss1: SEANCE7 } });
      await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_t', resultat: C })] }, origin: 'device' });
      const scene = nouvelleScene();
      let refreshs = 0; const compter = () => { refreshs += 1; };
      window.addEventListener('cuisineos:refresh', compter);
      try {
        const root = await I.renderImport({}, { session: 'ss1', import: 'imp_t' }, await ctxDe(repo, db), { repo, toast: () => {}, confirmer: async () => false, maintenant: () => NOW });
        scene.append(root);
        const p = root.querySelector('[data-role="panneau-index"]');
        const champ = p.querySelector('[data-role="entrees-lues"] li input[type=text]');
        champ.focus(); champ.value = 'Velouté de pois'; champ.dispatchEvent(new Event('input', { bubbles: true }));
        p.querySelector('[data-role="appliquer-ordre"]').click();
        await attendre(() => p.querySelector('[data-role="etat-ordre"]')?.textContent === 'Ordre enregistré.', 'ordre enregistré');
        const seance = [...root.querySelectorAll(':scope > .thumbs > figure')];
        eq([p.querySelector('[data-role="entrees-lues"] li input[type=text]') === champ, champ.value, refreshs, seance.map((f) => f.dataset.page), seance.map((f) => f.querySelector('.num').textContent)], [true, 'Velouté de pois', 0, ['q1', 'p1', 'p2', 'q4', 'p3', 'p4', 'p5'], ['1', '2', '3', '4', '5', '6', '7']], 'T-C12 (M70, M71, I-C10) : après « Appliquer », le MÊME nœud porte encore le titre édité (aucun refresh()) ; les vignettes de la séance réordonnées en place, .num réécrits');
        const champPage = seance.find((f) => f.dataset.page === 'p3').querySelector('input[type=number]');
        champPage.value = '4'; champPage.dispatchEvent(new Event('change', { bubbles: true }));
        await attendre(async () => (await db.get('source_pages', 'p3')).printed_page === 4, 'p. imprimée écrite');
        eq((await db.get('source_pages', 'p3')).position, 5, 'T-C12 (M72) : le champ « p. imprimée » d’une vignette, changé après « Appliquer », écrit la position NEUVE');
      } finally { window.removeEventListener('cuisineos:refresh', compter); scene.remove(); }
    }));

    await run('T-C13 tableau : décocher, déjà repérée, hors plage, focus, datalist, ↑/↓', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      await poserBibliotheque(repo, db);
      await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_t13', resultat: C })] }, origin: 'device' });
      const scene = nouvelleScene();
      try {
        const ctx = await ctxDe(repo, db);
        const p = I.indexEntriesPanel(ctx.scan_sessions[0], ctx, () => [], { repo, toast: () => {}, confirmer: async () => false, importId: 'imp_t13' });
        scene.append(p);
        const li = (titre) => [...p.querySelectorAll('[data-role="entrees-lues"] li')].find((x) => x.querySelector('input[type=text]').value === titre);
        const caseDe = (x) => x.querySelector('input[type=checkbox]');
        const saisir = (champ, valeur) => { champ.focus(); champ.value = valeur; champ.dispatchEvent(new Event('input', { bubbles: true })); };
        const gasp = li('Gaspacho');
        caseDe(gasp).click();
        eq([p.querySelector('[data-role="creer-references"]').textContent, caseDe(gasp).checked], ['Créer 20 références', false], 'T-C13 : décocher une ligne → « Créer 20 références »');
        const tarte = li('Tarte aux pommes'); const titre = tarte.querySelector('input[type=text]'); const page = tarte.querySelector('input[type=number]');
        saisir(page, '34'); saisir(titre, 'Risotto aux champignons');
        eq([tarte.querySelector('[data-role="puces"]').textContent.includes('déjà repérée'), caseDe(tarte).checked, caseDe(tarte).disabled, caseDe(tarte).getAttribute('aria-label'), p.querySelector('[data-role="compteur"]').textContent, document.activeElement === titre],
          [true, false, true, 'Déjà repérée dans ce livre', '23 entrées lues · 3 déjà dans ce livre', true], 'T-C13 (M49, B-12) : un titre existant tapé (p. 34) → « déjà repérée », décochée, case désactivée (aria-label qui le dit), compteur 3 ; le champ tapé garde le focus (activeElement : un champ recréé le perdrait)');
        saisir(titre, 'Tarte aux pommes'); saisir(page, '54');
        eq([tarte.querySelector('[data-role="puces"]').textContent.includes('déjà repérée'), caseDe(tarte).checked, caseDe(tarte).disabled, caseDe(tarte).getAttribute('aria-label')], [false, true, false, 'Créer une référence pour « Tarte aux pommes »'], 'T-C13 : retaper un titre libre → recochée, réactivée');
        saisir(page, '300');
        eq([tarte.querySelector('[data-role="puces"]').textContent.includes('incertain'), caseDe(tarte).checked], [true, true], 'T-C13 (M99, R-C-3) : une page hors de la plage de sa photo → « incertain », la case RESTE cochée');
        const dl = p.querySelector('datalist');
        eq([/^sections-lues-\d+$/.test(dl.id), dl.id.includes('imp_t13'), [...dl.options].map((o) => o.value), tarte.querySelectorAll('input')[3]?.getAttribute('list') === dl.id], [true, false, ['Printemps', 'Été', 'Automne', 'Hiver', 'Les bases', 'Au fil des saisons'], true], 'T-C13 (S-14) : datalist des sections distinctes, identifiée par un compteur d’instances, jamais par l’identifiant de la ligne');
        boutonTexte(p.querySelector('[data-role="ordre-photos"]'), 'Descendre la page 1').click();
        const apres = [...p.querySelectorAll('[data-role="entrees-lues"] li')];
        eq([apres[0].querySelector('input[type=text]').value, li('Tarte aux pommes') === tarte, tarte.querySelector('input[type=number]').value, tarte.querySelector('[data-role="photo"]').textContent], ['Soupe de courge', true, '300', 'photo 2'], 'T-C13 (D-C18) : ↑/↓ réordonnent le tableau (photos dans l’ordre courant) sans recréer les lignes : la ligne éditée est intacte, « photo n » suit le rang courant');
      } finally { scene.remove(); }
    }));

    await run('T-C14 création depuis le tableau (écran)', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      await poserBibliotheque(repo, db);
      await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_t14', resultat: C })] }, origin: 'device' });
      const scene = nouvelleScene(); const dits = [];
      let refreshs = 0; const compter = () => { refreshs += 1; };
      window.addEventListener('cuisineos:refresh', compter);
      try {
        const ctx = await ctxDe(repo, db);
        const p = I.indexEntriesPanel(ctx.scan_sessions[0], ctx, () => [], { repo, toast: (m) => dits.push(m), confirmer: async () => false, maintenant: () => NOW, importId: 'imp_t14' });
        scene.append(p);
        const gasp = [...p.querySelectorAll('[data-role="entrees-lues"] li')].find((x) => x.querySelector('input[type=text]').value === 'Gaspacho');
        gasp.querySelector('input[type=checkbox]').click();
        const bouton = p.querySelector('[data-role="creer-references"]');
        eq(bouton.textContent, 'Créer 20 références', 'T-C14 (écran) : une ligne décochée → « Créer 20 références »');
        bouton.click(); bouton.click(); // double clic : une seule création
        await attendre(async () => (await db.get('imports', 'imp_t14')).status === 'enregistre' && p.etatPanneau().status === null, 'enregistrée, panneau revenu à l’état 1');
        const toutes = await db.byIndex('recipes', 'edition_id', 'ed1');
        eq([toutes.length, toutes.some((x) => x.original_title === 'Gaspacho'), dits, refreshs, !!p.querySelector('[data-role="entrees-lues"]'), p.querySelector('[data-role="zone-saisie"]').hidden, (await db.get('imports', 'imp_t14')).finished_at],
          [22, false, ['20 référence(s) créée(s), 2 doublon(s) ignoré(s)'], 1, false, false, NOW], 'T-C14 (écran) : 20 fiches (la décochée absente), le toast (les déjà repérées sont les doublons, la décochée n’en est pas un), UN refresh() voulu, le panneau revenu à l’état 1');
      } finally { window.removeEventListener('cuisineos:refresh', compter); scene.remove(); }
    }));

    await run('T-C16 « Saisir à la main » / « Revenir à la lecture » et fermeture (écran)', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const DI = await import('../src/domain/import-cible.js');
      await poserBibliotheque(repo, db);
      await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_t16', resultat: C })] }, origin: 'device' });
      const scene = nouvelleScene();
      try {
        const ctx = await ctxDe(repo, db);
        const p = I.indexEntriesPanel(ctx.scan_sessions[0], ctx, () => [], { repo, toast: () => {}, confirmer: async () => false, maintenant: () => NOW, importId: 'imp_t16' });
        scene.append(p);
        const champ = p.querySelector('[data-role="entrees-lues"] li input[type=text]');
        champ.value = 'Velouté de pois'; champ.dispatchEvent(new Event('input', { bubbles: true }));
        boutonTexte(p, 'Saisir à la main').click();
        eq([p.querySelector('[data-role="zone-saisie"]').hidden, p.querySelector('[data-role="zone-lecture"]').hidden, !!boutonTexte(p, 'Revenir à la lecture')], [false, true, true], 'T-C16 (écran) : « Saisir à la main » → la zone de texte visible, le tableau caché, « Revenir à la lecture » offert');
        boutonTexte(p, 'Revenir à la lecture').click();
        eq([p.querySelector('[data-role="zone-lecture"]').hidden, p.querySelector('[data-role="entrees-lues"] li input[type=text]') === champ, champ.value], [false, true, 'Velouté de pois'], 'T-C16 (écran) : « Revenir à la lecture » → le tableau intact, éditions locales conservées (va-et-vient sans écriture)');
        boutonTexte(p, 'Saisir à la main').click();
        const ta = p.querySelector('textarea'); ta.value = 'Tartiflette — 61'; ta.dispatchEvent(new Event('input', { bubbles: true }));
        boutonTexte(p, 'Créer les références').click();
        await attendre(async () => (await db.get('imports', 'imp_t16')).status === 'enregistre', 'ligne fermée');
        const lignes = DI.lignesImports({ imports: await db.getAll('imports'), scan_sessions: [], recipesById: new Map(), editionsById: new Map(), booksById: new Map() }, { documentId: 'doc', deviceId: repo.deviceId(), maintenant: NOW });
        eq([lignes.some((l) => l.id === 'imp_t16'), (await db.byIndex('recipes', 'edition_id', 'ed1')).some((x) => x.original_title === 'Tartiflette')], [false, true], 'T-C16 (écran, D-C19) : après création depuis la zone de texte, la ligne n’est plus dans la section Imports ; la fiche est créée');
      } finally { scene.remove(); }
    }));

    await run('T-C17 coupe, vide, reprise d’un échec, relecture confirmée, hors ligne, création conditionnée, état à lancer', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const UI = await import('../src/ui/import-cible.js');
      await poserBibliotheque(repo, db, { octets: true, seances: { ss1: ENVOI, ss2: ['p1', 'p2'], ss3: ['p3', 'p4'], ss4: ENVOI, ss5: ['p4', 'p5'], ss6: ['p4', 'p5'], ss7: ['q1'], ss8: ['p1'], ss9: ['p3'], ss10: ['p2'], ss11: ['p1'] } });
      const scene = nouvelleScene(); const dits = []; const questions = [];
      let reponseConfirmer = true;
      const base = { toast: (m) => dits.push(m), confirmer: async (q) => { questions.push(q); return reponseConfirmer; }, maintenant: () => NOW };
      const capture = db.onMutate;
      const suivreStatuts = () => { const vus = []; db.onMutate = (m) => { const s = m.puts.imports?.[0]?.status; if (s && s !== vus.at(-1)) vus.push(s); return capture ? capture(m) : {}; }; return vus; };
      const panneauDe = async (sessionId, coches, deps) => { const ctx = await ctxDe(repo, db); const p = I.indexEntriesPanel(ctx.scan_sessions.find((s) => s.id === sessionId), ctx, () => (typeof coches === 'function' ? coches() : coches), { ...base, repo, ...deps }); scene.append(p); return p; };
      try {
        // 1) Coupe sur 5 photos, puis 2 décochées et « Relancer » : la MÊME ligne, un POST de 3 images (M54, M76)
        let coches = [...ENVOI];
        const ff = fauxFetch([200, corpsModele(LECTURE_5, { stop_reason: 'max_tokens' })]);
        const p = await panneauDe('ss1', () => coches, { fetch: ff.fetch });
        await attendre(() => !lireIndex(p).disabled, 'bouton allumé');
        lireIndex(p).click();
        await attendre(async () => (await ligneDe(db, 'ss1'))?.status === 'echec' && p.textContent.includes('Lecture coupée'), 'coupe');
        eq([(await ligneDe(db, 'ss1')).erreur.raison, p.querySelector('[data-role="echec"]')?.textContent, p.textContent.includes('La lecture a été coupée'), lireIndex(p).textContent, p.querySelector('[data-role="quota"]').hidden, p.querySelector('[data-role="zone-saisie"]').hidden], ['coupe', 'Lecture coupée : lis moins de photos à la fois.', false, 'Relancer', false, false], 'T-C17 (M54) : coupure → echec(coupe), « Lecture coupée : lis moins de photos à la fois. » (jamais le texte du lot A), « Relancer », le quota, la zone de texte');
        coches = ['p3', 'p1', 'p5']; ff.auto = [200, corpsModele({ photos: LECTURE_5.photos.slice(0, 3), uncertain: [] })];
        const st1 = suivreStatuts();
        lireIndex(p).click();
        await attendre(async () => (await ligneDe(db, 'ss1'))?.status === 'a_verifier', 'relue sur 3 photos');
        db.onMutate = capture;
        eq([(await db.getAll('imports')).filter((i) => i.kind === 'index' && i.scan_session_id === 'ss1').length, ff.appels.length, imagesEnvoyees(ff.appels[1]), (await ligneDe(db, 'ss1')).page_ids, st1], [1, 2, 3, ['p3', 'p1', 'p5'], ['en_cours', 'a_verifier']], 'T-C17 (M76, B-5) : décocher 2 photos puis « Relancer » → la MÊME ligne (echec → en_cours en UNE transaction avec les 3 pages, puis a_verifier), un POST de 3 images, page_ids à 3');
        // 2) Reprise d'une ligne echec(coupe) par ?import= : cases cochées, « Relancer » → echec → en_cours directement, UN POST (M96, M98, M100)
        await db.mutate({ puts: { imports: [{ ...ligneJournal({ id: 'imp_c2', edition_id: 'ed1', scan_session_id: 'ss2', page_ids: ['p1', 'p2'] }), status: 'echec', erreur: { raison: 'coupe', extra: {} } }] }, origin: 'device' });
        const ff2 = fauxFetch([200, corpsModele(blocsDe(['p1', 'p2']))]);
        const r2 = await I.renderImport({}, { session: 'ss2', import: 'imp_c2' }, await ctxDe(repo, db), { ...base, repo, fetch: ff2.fetch });
        scene.append(r2);
        const p2 = r2.querySelector('[data-role="panneau-index"]');
        const cochees2 = [...r2.querySelectorAll(':scope > .thumbs > figure')].filter((f) => f.querySelector('input[type=checkbox]').checked).map((f) => f.dataset.page);
        await attendre(() => !lireIndex(p2).disabled, 'bouton allumé');
        const libelle2 = lireIndex(p2).textContent;
        const st2 = suivreStatuts();
        lireIndex(p2).click();
        await attendre(async () => (await db.get('imports', 'imp_c2')).status === 'a_verifier', 'relancée');
        db.onMutate = capture;
        eq([cochees2, libelle2, ff2.appels.length, imagesEnvoyees(ff2.appels[0]), (await db.get('imports', 'imp_c2')).page_ids, st2, dits.filter((d) => d.startsWith('Sélectionne'))], [['p1', 'p2'], 'Relancer', 1, 2, ['p1', 'p2'], ['en_cours', 'a_verifier'], []], 'T-C17 (M96, M98, M100, N-2) : reprise d’une ligne echec par ?import= → les cases cochées ; « Relancer » → UN POST de ces photos, page_ids inchangés, echec → en_cours DIRECTEMENT (aucun a_lancer intercalé), jamais « Sélectionne… »');
        // 3) Relecture depuis a_verifier (un ordre appliqué) : la question nomme les entrées non créées ; « non » → rien ; « oui » → le départ du vol efface
        //    résultat, ordre appliqué et diagnostic de la lecture remplacée, puis UN POST (M77, M78, M90) ; un autre panneau dit le vol tenu (M-C10)
        await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_c4', sessionId: 'ss4', resultat: C, over: { ordre_applique_at: DATE, reponse_brute: 'brut R1' } })] }, origin: 'device' });
        const ff4 = fauxFetch();
        const p4 = await panneauDe('ss4', [], { fetch: ff4.fetch, importId: 'imp_c4' });
        await attendre(() => !lireIndex(p4).disabled, 'bouton allumé');
        const avant4 = await db.get('imports', 'imp_c4');
        const p4h = await panneauDe('ss4', [], { fetch: ff4.fetch, importId: 'imp_c4', enLigne: () => false });
        await attendre(() => !lireIndex(p4h).disabled, 'bouton allumé (hors ligne)');
        dits.length = 0;
        lireIndex(p4h).click();
        await attendre(() => dits.length === 1, 'hors ligne dit');
        eq([dits[0], questions.length, ff4.appels.length, await db.get('imports', 'imp_c4')], ['Tu es hors ligne.', 0, 0, avant4], 'T-C17 (alignement T6, spec A § 4.4) : hors ligne, « Lire » depuis une lecture reçue → « Tu es hors ligne. », AUCUNE question, la lecture reçue intacte (ni a_lancer, ni résultat effacé), aucun POST');
        reponseConfirmer = false;
        lireIndex(p4).click();
        await attendre(() => questions.length === 1, 'question posée');
        await attendre(() => !lireIndex(p4).disabled, 'bouton rallumé après « non »'); // un FAIT, jamais deux ticks : le redessin relit la base
        eq([questions[0], ff4.appels.length, await db.get('imports', 'imp_c4'), !!p4.querySelector('[data-role="entrees-lues"]')], ['Relire remplace la lecture reçue (21 entrées non créées) et coûte un appel. Continuer ?', 0, avant4, true], 'T-C17 (M77, B-1) : « Lire » depuis une lecture reçue → la question nomme les 21 entrées non créées et le coût ; « non » → 0 POST, 0 écriture, le tableau intact, le bouton rallumé (attendu juste avant)');
        reponseConfirmer = true;
        let depart = null; const st4 = suivreStatuts(); const suivant = db.onMutate;
        db.onMutate = (m) => { const l = m.puts.imports?.[0]; if (l?.status === 'en_cours' && !depart) depart = { ...l }; return suivant(m); };
        lireIndex(p4).click();
        await attendre(() => ff4.appels.length === 1, 'un POST');
        eq([depart && [depart.id, depart.resultat, depart.ordre_applique_at, depart.reponse_brute, depart.model, depart.duree_ms, depart.finished_at ?? null, depart.page_ids, depart.erreur], st4.slice(0, 1)], [['imp_c4', null, null, null, null, null, null, ENVOI, null], ['en_cours']], 'T-C17 (M78, F-18) : « oui » → a_verifier → en_cours en UNE transaction (les gardes du vol passées) : resultat, ordre_applique_at et le diagnostic de la lecture remplacée (reponse_brute, model, duree_ms) effacés, ni finished_at ni erreur, les pages de la lecture ; puis UN POST — jamais un a_lancer intercalé');
        const recette = await repo.ajouterPages([await imageDe('r.jpg', '#357')], { import: { id: 'imp_rec', kind: 'recette', recipe_id: 'rc_vol' } });
        eq(await UI.lancerExtraction(recette.importId, { ctx: await ctxDe(repo, db), repo, fetch: ff4.fetch }), { issue: 'refuse', raison: 'vol_tenu' }, 'T-C17 (M90, I-C4) : pendant la lecture d’index, l’extraction d’une recette est refusée (un vol par document)');
        // Pendant ce vol, un AUTRE panneau sur une lecture reçue : « Lire » dit le vol tenu SANS poser la question de la relecture (M-C10 : la garde
        // volEnCours() de lire() passe avant la confirmation), aucun POST.
        await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_c10', sessionId: 'ss10', page_ids: ['p2'], resultat: D.resultatIndex(L.validerLectureIndex(blocsDe(['p2']), { nbPhotos: 1 }), ['p2']) })] }, origin: 'device' });
        const p10 = await panneauDe('ss10', [], { fetch: ff4.fetch, importId: 'imp_c10' });
        await attendre(() => !lireIndex(p10).disabled, 'bouton allumé (second panneau)');
        const q10 = questions.length; dits.length = 0;
        lireIndex(p10).click();
        await attendre(() => dits.length === 1, 'vol tenu dit');
        eq([[...dits], questions.length - q10, ff4.appels.length], [['Une lecture est déjà en cours : annule-la d’abord.'], 0, 1], 'T-C17 (M-C10, I-C4) : pendant la lecture d’un autre panneau, « Lire » sur une lecture reçue dit le vol tenu SANS poser la question de la relecture, aucun POST');
        boutonTexte(p4, 'Annuler').click();
        await attendre(() => UI.volEnCours() === null, 'vol libéré');
        db.onMutate = capture;
        // 4) La ligne neuve naît DANS le vol par repo.ouvrirImport (M107, Q4) ; octets absents → rien dans le journal (alignement T6) ; une ligne a_lancer
        //    venue d'ailleurs → état 4, « Lire » → la MÊME ligne (M105, Q3)
        let ouverture = null;
        const espion = { ...repo, ouvrirImport: async (o) => { ouverture = o; return repo.ouvrirImport(o); } };
        const ff5 = fauxFetch([200, corpsModele(blocsDe(['p3', 'p4']))]);
        const p5 = await panneauDe('ss3', ['p3', 'p4'], { repo: espion, fetch: ff5.fetch });
        await attendre(() => !lireIndex(p5).disabled, 'bouton allumé');
        lireIndex(p5).click();
        await attendre(async () => (await ligneDe(db, 'ss3'))?.status === 'a_verifier', 'ligne créée et lue');
        eq([ouverture && [ouverture.kind, ouverture.scan_session_id, ouverture.edition_id, ouverture.page_ids], (await db.getAll('imports')).filter((i) => i.kind === 'index' && i.scan_session_id === 'ss3').length, ff5.appels.length], [['index', 'ss3', 'ed1', ['p3', 'p4']], 1, 1], 'T-C17 (M107, Q4) : sans ligne, la ligne naît par repo.ouvrirImport du repo INJECTÉ (le mur absente: true du lot A), dans le vol, sur les pages de la séance ; une ligne, un POST');
        const fichierP3 = await db.get('files', (await db.get('source_pages', 'p3')).sha256);
        await db.delete('files', fichierP3.sha256);
        const ff9 = fauxFetch([200, corpsModele(blocsDe(['p3']))]);
        const p9 = await panneauDe('ss9', ['p3'], { fetch: ff9.fetch });
        await attendre(() => !lireIndex(p9).disabled, 'bouton allumé');
        dits.length = 0;
        lireIndex(p9).click();
        await attendre(() => dits.length === 1, 'refus dit');
        await tick(); await tick();
        eq([dits[0], ff9.appels.length, await ligneDe(db, 'ss9'), p9.etatPanneau().status], ['Les photos de cette séance ne sont pas sur cet appareil.', 0, null, null], 'T-C17 (alignement T6, spec A § 4.4) : octets absents → toast « Les photos de cette séance ne sont pas sur cet appareil. », AUCUNE ligne créée, aucun POST, le panneau reste à l’état 1');
        await db.put('files', fichierP3);
        await db.mutate({ puts: { imports: [ligneJournal({ id: 'imp_c5', edition_id: 'ed1', scan_session_id: 'ss5', page_ids: ['p4', 'p5'], device_id: 'dev_ailleurs' })] }, origin: 'device' });
        const ff55 = fauxFetch([200, corpsModele(blocsDe(['p4', 'p5']))]);
        const p55 = await panneauDe('ss5', [], { fetch: ff55.fetch });
        eq([lireIndex(p55).textContent, p55.querySelector('[data-role="ignorer"]').hidden, p55.querySelector('[data-role="zone-saisie"]').hidden, p55.querySelector('[data-role="quota"]').hidden], ['Lire avec l’assistant IA', false, false, false], 'T-C17 (Q3) : une ligne a_lancer venue d’ailleurs → état 4 au rendu (« Lire avec l’assistant IA », « Ignorer », zone de texte, quota)');
        await attendre(() => !lireIndex(p55).disabled, 'bouton allumé');
        const st5 = suivreStatuts();
        lireIndex(p55).click();
        await attendre(async () => (await db.get('imports', 'imp_c5')).status === 'a_verifier', 'lue');
        db.onMutate = capture;
        eq([(await db.getAll('imports')).filter((i) => i.kind === 'index' && i.scan_session_id === 'ss5').length, ff55.appels.length, imagesEnvoyees(ff55.appels[0]), st5[0]], [1, 1, 2, 'en_cours'], 'T-C17 (M105) : « Lire » sur la ligne a_lancer (rien de coché : ses page_ids) → la MÊME ligne a_lancer → en_cours, un POST, aucune seconde ligne');
        // 5) Depuis a_lancer, une page décochée : le départ du vol remet page_ids (a_lancer → en_cours en une transaction)
        await db.mutate({ puts: { imports: [ligneJournal({ id: 'imp_c6', edition_id: 'ed1', scan_session_id: 'ss6', page_ids: ['p4', 'p5'] })] }, origin: 'device' });
        const ff6 = fauxFetch([200, corpsModele(blocsDe(['p4']))]);
        const p6 = await panneauDe('ss6', ['p4'], { fetch: ff6.fetch });
        await attendre(() => !lireIndex(p6).disabled, 'bouton allumé');
        const st6 = suivreStatuts();
        lireIndex(p6).click();
        await attendre(async () => (await db.get('imports', 'imp_c6')).status === 'a_verifier', 'lue');
        db.onMutate = capture;
        eq([st6, (await db.get('imports', 'imp_c6')).page_ids, imagesEnvoyees(ff6.appels[0])], [['en_cours', 'a_verifier'], ['p4'], 1], 'T-C17 (Q3) : depuis a_lancer, une page décochée → a_lancer → en_cours avec page_ids remises en UNE transaction (le départ du vol), UN POST');
        // 6) « Ignorer » une ligne a_lancer (M106)
        await db.mutate({ puts: { imports: [ligneJournal({ id: 'imp_c7', edition_id: 'ed1', scan_session_id: 'ss7', page_ids: ['q1'] })] }, origin: 'device' });
        const p7 = await panneauDe('ss7', [], {});
        boutonTexte(p7, 'Ignorer').click();
        await attendre(async () => (await db.get('imports', 'imp_c7')).status === 'ignore' && p7.etatPanneau().status === null, 'ignorée');
        eq([(await db.get('imports', 'imp_c7')).finished_at, p7.querySelector('[data-role="ignorer"]').hidden, lireIndex(p7).textContent], [NOW, true, 'Lire avec l’assistant IA'], 'T-C17 (M106, Q3) : « Ignorer » → ignore avec finished_at posé, panneau revenu à l’état 1');
        // 7) Une lecture sans entrée : vide
        const ff8 = fauxFetch([200, corpsModele({ photos: [], uncertain: [] })]);
        const p8 = await panneauDe('ss8', ['p1'], { fetch: ff8.fetch });
        await attendre(() => !lireIndex(p8).disabled, 'bouton allumé');
        lireIndex(p8).click();
        await attendre(() => p8.textContent.includes('Aucune entrée lue sur ces photos.'), 'vide dit');
        eq([(await ligneDe(db, 'ss8')).erreur.raison, (await db.byIndex('recipes', 'edition_id', 'ed1')).length], ['vide', 2], 'T-C17 : une lecture sans entrée → echec(vide), « Aucune entrée lue sur ces photos. », aucune fiche');
        // 8) « Relancer » d'un index depuis la section Imports (lancerExtraction, SANS `lecture`) : le départ efface AUSSI l'ordre appliqué et le diagnostic
        //    de la lecture remplacée (F-18 : le bloc index d'enVol, une définition pour les trois départs ; M78b le placerait dans la seule reprise)
        await db.mutate({ puts: { imports: [{ ...ligneJournal({ id: 'imp_c8', edition_id: 'ed1', scan_session_id: 'ss11', page_ids: ['p1'] }), status: 'echec', erreur: { raison: 'illisible', extra: {} }, ordre_applique_at: DATE, reponse_brute: 'brut R1', model: 'claude-x', duree_ms: 900 }] }, origin: 'device' });
        let depart8 = null;
        db.onMutate = (m) => { const l = m.puts.imports?.[0]; if (l?.id === 'imp_c8' && l.status === 'en_cours' && !depart8) depart8 = { ...l }; return capture ? capture(m) : {}; };
        const ff10 = fauxFetch([200, corpsModele(blocsDe(['p1']))]);
        let r8 = null;
        try { r8 = await UI.lancerExtraction('imp_c8', { ctx: await ctxDe(repo, db), repo, fetch: ff10.fetch }); } finally { db.onMutate = capture; }
        eq([r8, depart8 && [depart8.ordre_applique_at, depart8.reponse_brute, depart8.model, depart8.duree_ms, depart8.page_ids], (await db.get('imports', 'imp_c8')).ordre_applique_at ?? null, ff10.appels.length], [{ issue: 'a_verifier' }, [null, null, null, null, ['p1']], null, 1], 'T-C17 (M78, M78b, F-18) : « Relancer » d’un index depuis la section Imports (sans lecture) → le départ efface aussi l’ordre appliqué et le diagnostic de la lecture remplacée ; un POST, a_verifier');
      } finally { db.onMutate = capture; UI.reinitialiserImportCible(); scene.remove(); }
    }));

    // --- Ronde 1 de la tâche 4 : faux verts fermés et comportements promis par la spec § 4.2 / § 4.4 (un bloc par constat : une levée n'en cache aucun autre)
    await run('T-C10 (ronde 1) textes du panneau : texteEchecIndex, ligneEtatLecture, ligneIncertain', async () => {
      const T = await import('../src/ui/table-matieres.js');
      const UI = await import('../src/ui/import-cible.js');
      const I4 = 'L’appel a peut-être été compté ; relancer en coûtera un autre.';
      const table = [
        [{ raison: 'coupe' }, { texte: 'Lecture coupée : lis moins de photos à la fois.', code: null }],
        [{ raison: 'vide' }, { texte: 'Aucune entrée lue sur ces photos.', code: null }],
        [{ raison: 'illisible' }, { texte: 'L’assistant n’a pas répondu lisiblement. Réessaie.', code: 'Code : illisible' }],
        [{ raison: 'hors_bornes' }, { texte: 'L’assistant n’a pas répondu lisiblement. Réessaie.', code: 'Code : hors_bornes' }],
        [{ raison: 'annule' }, { texte: 'Lecture annulée. ' + I4, code: null }],
        [{ raison: 'interrompu' }, { texte: 'La lecture a été interrompue. ' + I4, code: null }],
        [{ raison: 'incertain' }, { texte: I4, code: null }],
        [{ raison: 'quota', extra: { quota: 60 } }, { texte: 'Tu as atteint la limite du jour pour l’assistant (60 appels).', code: null }],
        [{ raison: 'requete', extra: { trop_lourd: true } }, { texte: 'La demande est trop lourde : choisis moins de pages.', code: null }],
        [{ raison: 'serveur' }, { texte: 'L’assistant n’a pas répondu. Réessaie. Code : serveur', code: null }],
      ];
      eq(table.map(([e]) => T.texteEchecIndex(e)), table.map(([, x]) => x), 'T-C10 (ronde 1 ; N28, N29, N30, N31, § 4.2 état 3) : texteEchecIndex — coupe et vide ont leur phrase ; illisible / hors_bornes la phrase générique + « Code : … » ; annule, interrompu, incertain les phrases I-4 ; quota, demande trop lourde et toute autre raison de la passerelle, le texte de texteEchecAssistant');
      const communes = table.filter(([e]) => !['coupe', 'vide'].includes(e.raison)).map(([e]) => e);
      eq(communes.map((e) => T.texteEchecIndex(e)), communes.map((e) => UI.texteEchec(e)), 'T-C10 (ronde 1, une définition) : hors coupe et vide, texteEchecIndex rend exactement texteEchec (lot A) — une phrase corrigée là change aussi le panneau d’index');
      const blocs = (n) => ({ photos: Array.from({ length: n }, () => ({ entries: [] })) });
      eq([T.ligneEtatLecture({ duree_ms: 1200 }, blocs(1)), T.ligneEtatLecture({ duree_ms: 2600 }, blocs(5)), T.ligneEtatLecture({}, blocs(3)), T.ligneEtatLecture({ duree_ms: null }, blocs(2)), T.ligneEtatLecture({ duree_ms: -5 }, blocs(2)), T.ligneEtatLecture({ duree_ms: 1e21 }, blocs(2)), T.ligneEtatLecture({ duree_ms: 600001 }, blocs(2)), T.ligneEtatLecture({ duree_ms: 600000 }, blocs(2))],
        ['Lue en 1 s · 1 photo(s)', 'Lue en 3 s · 5 photo(s)', '3 photo(s)', '2 photo(s)', '2 photo(s)', '2 photo(s)', '2 photo(s)', 'Lue en 600 s · 2 photo(s)'], 'T-C10 (ronde 1 ; N32, Q5) : ligneEtatLecture — « Lue en {s} s · {n} photo(s) » (arrondi à la seconde), sans durée lisible « {n} photo(s) » ; une durée relue négative, absurde ou au-delà de 10 min (ligne reçue, archive) n’est jamais dite');
      const cf = String.fromCharCode(0x202E);
      eq([T.ligneIncertain({ ecartees: { trop_longues: 0, adresse: 1 }, uncertain: [] }), T.ligneIncertain({ ecartees: { trop_longues: 2, adresse: 1 }, uncertain: ['p. 41 ?'] }), T.ligneIncertain({ ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] }), T.ligneIncertain({ uncertain: ['x' + cf] })],
        ['Incertain : 1 entrées écartées (adresse)', 'Incertain : 2 entrées écartées (trop longues) ; 1 entrées écartées (adresse) ; p. 41 ?', null, 'Incertain : x'], 'T-C10 (ronde 1 ; N27, Q1, P3) : ligneIncertain — le compte « (adresse) » est dit, après « (trop longues) » et avant les chaînes du modèle ; rien à dire → null ; Cf retirés');
    });

    await run('T-C13 (ronde 1) puces « incertain » et « en double », doublon après ↑/↓, homonyme d’un autre livre, adresse écartée, « Créer 1 référence », plan vide', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const T = await import('../src/ui/table-matieres.js');
      await poserBibliotheque(repo, db, { seances: { ss1: ['p1', 'p2'] } });
      // Une recette HOMONYME (même titre, même page) dans un AUTRE livre (ed2) : elle ne rend jamais une entrée de ed1 « déjà repérée » (N26).
      await db.mutate({ puts: { book_editions: [{ id: 'ed2', book_id: 'b1', language: 'fr', created_at: DATE, updated_at: DATE }], recipes: [{ id: 'rc_ed2', edition_id: 'ed2', original_title: 'Gratin', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: 20, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], created_at: DATE, updated_at: DATE }] }, origin: 'device' });
      // Photo 1 : « Gratin » que le MODÈLE dit incertain, « Tarte », et une entrée porteuse d'une adresse (écartée et comptée) ; photo 2 : « Tarte » p. 30 encore (doublon).
      const LU = L.validerLectureIndex({ photos: [
        { photo: 1, printed_page_range: [8, 94], entries: [{ title: 'Gratin', printed_page: 20, section: null, uncertain: true }, { title: 'Tarte', printed_page: 30, section: null, uncertain: false }, { title: 'Voir https://exemple.com/tarte', printed_page: 40, section: null, uncertain: false }] },
        { photo: 2, printed_page_range: null, entries: [{ title: 'Tarte', printed_page: 30, section: null, uncertain: false }] },
      ], uncertain: [] }, { nbPhotos: 2 });
      const resultat = D.resultatIndex(LU, ['p1', 'p2']);
      await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_p13', page_ids: ['p1', 'p2'], resultat })] }, origin: 'device' });
      const scene = nouvelleScene(); const dits = [];
      try {
        const ctx = await ctxDe(repo, db);
        const p = I.indexEntriesPanel(ctx.scan_sessions.find((s) => s.id === 'ss1'), ctx, () => [], { repo, toast: (m) => dits.push(m), confirmer: async () => false, importId: 'imp_p13', maintenant: () => NOW });
        scene.append(p);
        const liDe = (cle) => p.querySelector(`[data-role="entrees-lues"] li[data-cle="${cle}"]`);
        const caseDe = (x) => x.querySelector('input[type=checkbox]');
        const etatLi = (x) => [x.querySelector('[data-role="puces"]').textContent, caseDe(x).checked, caseDe(x).disabled, caseDe(x).getAttribute('aria-label')];
        eq([resultat.ecartees, etatLi(liDe('l0')), etatLi(liDe('l1')), etatLi(liDe('l2')), p.querySelector('[data-role="compteur"]').textContent, p.querySelector('[data-role="creer-references"]').textContent, p.querySelector('[data-role="incertain"]')?.textContent],
          [{ trop_longues: 0, adresse: 1 }, ['incertain', true, false, 'Créer une référence pour « Gratin »'], ['', true, false, 'Créer une référence pour « Tarte »'], ['en double', false, true, 'En double dans cette lecture'], '3 entrées lues · 0 déjà dans ce livre', 'Créer 2 références', 'Incertain : 1 entrées écartées (adresse)'],
          'T-C13 (ronde 1 ; N21, N20, N20b, N26, N27, R-C-3, § 4.4) : une entrée que le MODÈLE dit incertaine → puce « incertain », la case RESTE cochée ; un doublon de la lecture → « en double », décoché, désactivé, aria-label « En double dans cette lecture » ; une recette homonyme d’un AUTRE livre ne rend rien « déjà repérée » ; l’entrée porteuse d’une adresse est écartée, comptée en base ET dite en tête de « Incertain : »');
        caseDe(liDe('l0')).click();
        eq(p.querySelector('[data-role="creer-references"]').textContent, 'Créer 1 référence', 'T-C13 (ronde 1, N22) : une seule entrée à créer → « Créer 1 référence » (singulier)');
        boutonTexte(p.querySelector('[data-role="ordre-photos"]'), 'Monter la page 2').click();
        eq([[...p.querySelectorAll('[data-role="entrees-lues"] li')].map((x) => x.dataset.cle), etatLi(liDe('l2')), etatLi(liDe('l1')), p.querySelector('[data-role="creer-references"]').textContent], [['l2', 'l0', 'l1'], ['', true, false, 'Créer une référence pour « Tarte »'], ['en double', false, true, 'En double dans cette lecture'], 'Créer 1 référence'], 'T-C13 (ronde 1, N46, D-C18) : après ↑/↓, « en double » suit l’ordre COURANT — la première « Tarte » rencontrée est créable, la suivante en double (recalculer après trierLignes)');
        // Plan vide (constat 8) : tout décoché → bouton ÉTEINT (N23) ; même forcé, « Créer 0 références » ne clôt pas la lecture payée (creer() ET creerReferences).
        caseDe(liDe('l2')).click();
        const bouton = p.querySelector('[data-role="creer-references"]');
        const vue = p.querySelector('[data-role="lecture"]');
        const avant = await db.get('imports', 'imp_p13'); const nAvant = (await db.getAll('recipes')).length;
        const etatBouton = [bouton.textContent, bouton.disabled];
        bouton.disabled = false; bouton.click();
        const occupeAuClic = vue.occupe();
        const lignesVides = vue.etatLecture().lignes;
        const direct = await T.creerReferences(avant, lignesVides, { repo, ctx, editionId: 'ed1', toast: (m) => dits.push(m), maintenant: () => NOW });
        eq([etatBouton, occupeAuClic, direct, await db.get('imports', 'imp_p13'), (await db.getAll('recipes')).length, [...dits]], [['Créer 0 références', true], false, { issue: 'vide' }, avant, nAvant, []], 'T-C13 (ronde 1 ; N23, constat 8) : tout décoché → « Créer 0 références » éteint ; forcé, le clic ne lance rien et creerReferences refuse un plan vide ({ issue: vide }) : la lecture payée reste a_verifier, aucune fiche, aucun toast');
      } finally { scene.remove(); }
    }));

    await run('T-C13 (ronde 1) séance sans livre : « Créer {n} références » le dit', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      await poserBibliotheque(repo, db, { seances: { ss1: ['p1'] } });
      await db.mutate({ puts: { scan_sessions: [{ id: 'ss_sans', status: 'open', edition_id: null, started_at: DATE, page_ids: ['p1'], document_ids: [], device_id: repo.deviceId(), created_at: DATE, updated_at: DATE }], imports: [ligneAVerifier({ id: 'imp_sans', sessionId: 'ss_sans', page_ids: ['p1'], resultat: D.resultatIndex(L.validerLectureIndex(blocsDe(['p1']), { nbPhotos: 1 }), ['p1']), over: { edition_id: null } })] }, origin: 'device' });
      const scene = nouvelleScene(); const dits = [];
      try {
        const ctx = await ctxDe(repo, db);
        const p = I.indexEntriesPanel(ctx.scan_sessions.find((s) => s.id === 'ss_sans'), ctx, () => [], { repo, toast: (m) => dits.push(m), confirmer: async () => false, importId: 'imp_sans', maintenant: () => NOW });
        scene.append(p);
        p.querySelector('[data-role="creer-references"]').click();
        await attendre(() => dits.length === 1, 'sans livre dit');
        eq([[...dits], (await db.get('imports', 'imp_sans')).status, (await db.getAll('recipes')).length], [['Associe d’abord un livre à cette séance'], 'a_verifier', 2], 'T-C13 (ronde 1, N25) : une séance sans livre → « Créer {n} références » dit « Associe d’abord un livre à cette séance », rien d’écrit');
      } finally { scene.remove(); }
    }));

    await run('T-C17 (ronde 1) « Annuler » pendant les gardes du vol : aucun POST, rien d’écrit', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const UI = await import('../src/ui/import-cible.js');
      await poserBibliotheque(repo, db, { octets: true, seances: { ss1: ENVOI } });
      await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_g', resultat: C })] }, origin: 'device' });
      const scene = nouvelleScene(); const dits = [];
      let porte = null; let ouvrir = () => {}; let lectures = 0;
      // La réduction des photos (pagePourEnvoi, après la session) est RETENUE : la tenue du panneau n'a pas encore de ligne (importId nul).
      const retenu = { ...repo, getFile: async (sha) => { lectures += 1; if (porte) await porte; return repo.getFile(sha); } };
      const ff = fauxFetch([200, corpsModele(LECTURE_5)]);
      try {
        const ctx = await ctxDe(repo, db);
        const p = I.indexEntriesPanel(ctx.scan_sessions.find((s) => s.id === 'ss1'), ctx, () => [], { repo: retenu, toast: (m) => dits.push(m), confirmer: async () => true, fetch: ff.fetch, maintenant: () => NOW, importId: 'imp_g' });
        scene.append(p);
        await attendre(() => !lireIndex(p).disabled && !!p.querySelector('[data-role="entrees-lues"]'), 'lecture reçue posée, bouton allumé');
        const avant = await db.get('imports', 'imp_g');
        porte = new Promise((r) => { ouvrir = r; }); const l0 = lectures;
        lireIndex(p).click();
        await attendre(() => lectures > l0 && !!p.querySelector('[data-role="annuler"]'), 'gardes du vol en cours (photos retenues), « Annuler » offert');
        const tenue = UI.volEnCours();
        p.querySelector('[data-role="annuler"]').click();
        ouvrir(); porte = null;
        await attendre(() => UI.volEnCours() === null && !p.etatPanneau().vol, 'vol relâché');
        await tick();
        eq([tenue, ff.appels.length, await db.get('imports', 'imp_g'), (await db.getAll('imports')).length, !!p.querySelector('[data-role="entrees-lues"]'), lireIndex(p).disabled, [...dits]], [{ importId: null }, 0, avant, 1, true, false, []], 'T-C17 (ronde 1 ; constats 4 et 6, § 4.2) : « Annuler » pendant les gardes du vol (réduction des photos : la tenue n’a pas encore de ligne) → AUCUN POST, rien d’écrit (la lecture reçue intacte, aucune ligne neuve), le tableau toujours là, « Lire » rallumé, aucun toast');
      } finally { UI.reinitialiserImportCible(); scene.remove(); }
    }));

    await run('T-C17 (ronde 1) relecture : jamais d’une lecture que l’écran n’a pas montrée', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const UI = await import('../src/ui/import-cible.js');
      await poserBibliotheque(repo, db, { octets: true, seances: { ss1: ENVOI, ss2: ENVOI, ss3: ENVOI, ss4: ENVOI } });
      const r2De = (L1) => ({ ...L1, page_ids: ['p2'], started_at: '2026-10-19T11:00:00.000Z', resultat: D.resultatIndex(L.validerLectureIndex(blocsDe(['p2']), { nbPhotos: 1 }), ['p2']) });
      await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_s1', sessionId: 'ss1', resultat: C }), ligneAVerifier({ id: 'imp_s2', sessionId: 'ss2', resultat: C }), ligneAVerifier({ id: 'imp_s3', sessionId: 'ss3', resultat: C })] }, origin: 'device' });
      const scene = nouvelleScene(); const questions = [];
      const ff = fauxFetch([200, corpsModele(LECTURE_5)]);
      const panneauDe = async (sessionId, importId, confirmer) => { const ctx = await ctxDe(repo, db); const p = I.indexEntriesPanel(ctx.scan_sessions.find((s) => s.id === sessionId), ctx, () => [], { repo, toast: () => {}, confirmer, fetch: ff.fetch, maintenant: () => NOW, importId }); scene.append(p); await attendre(() => !lireIndex(p).disabled && p.querySelectorAll('[data-role="entrees-lues"] li').length === 23, 'R1 montrée'); return p; };
      try {
        // (a) R2 arrivée AVANT la tape (autre onglet, réception) : la question portait sur R1 → aucune question, rien ne part, R2 intacte et montrée.
        const p1 = await panneauDe('ss1', 'imp_s1', async (q) => { questions.push(q); return true; });
        const r2a = r2De(await db.get('imports', 'imp_s1')); await db.put('imports', r2a);
        lireIndex(p1).click();
        await attendre(() => p1.querySelectorAll('[data-role="entrees-lues"] li').length === 6, 'R2 montrée');
        eq([questions.length, ff.appels.length, await db.get('imports', 'imp_s1')], [0, 0, r2a], 'T-C17 (ronde 1, constat 5, T4-R2) : la ligne porte une AUTRE lecture (R2, jamais montrée) au moment de « Lire » → aucune question (elle aurait parlé de R1), aucun POST, R2 intacte ; le panneau relit et montre R2');
        // (b) R2 arrivée PENDANT la question : « oui » valait pour R1 → la reprise refuse DANS la transaction (cleLecture) ; aucune ligne neuve, aucun POST.
        const p2 = await panneauDe('ss2', 'imp_s2', async (q) => { questions.push(q); await db.put('imports', r2De(await db.get('imports', 'imp_s2'))); return true; });
        lireIndex(p2).click();
        await attendre(() => questions.length === 1 && UI.volEnCours() === null && !p2.etatPanneau().vol && p2.querySelectorAll('[data-role="entrees-lues"] li').length === 6, 'refus relu, R2 montrée');
        const l2 = await db.get('imports', 'imp_s2');
        eq([ff.appels.length, l2.status, l2.started_at, (await db.getAll('imports')).filter((i) => i.scan_session_id === 'ss2').length], [0, 'a_verifier', '2026-10-19T11:00:00.000Z', 1], 'T-C17 (ronde 1, constat 5, T4-R2 dans la transaction) : R2 arrivée pendant la question → « oui » ne vaut que pour R1 : la reprise refuse, R2 n’est pas écrasée, aucune ligne neuve, aucun POST');
        // (c) La lecture montrée est ENREGISTRÉE pendant la question (« Créer {n} références » d'un autre geste) : rien ne repart sur une ligne neuve.
        const p3 = await panneauDe('ss3', 'imp_s3', async (q) => { questions.push(q); await db.put('imports', { ...(await db.get('imports', 'imp_s3')), status: 'enregistre', finished_at: NOW }); return true; });
        lireIndex(p3).click();
        await attendre(() => questions.length === 2 && UI.volEnCours() === null && !p3.etatPanneau().vol && p3.etatPanneau().status === null, 'refus relu (enregistrée)');
        eq([ff.appels.length, (await db.get('imports', 'imp_s3')).status, (await db.getAll('imports')).filter((i) => i.scan_session_id === 'ss3').length], [0, 'enregistre', 1], 'T-C17 (ronde 1, constat 18) : la lecture montrée close pendant la question → la relecture confirmée ne part pas sur une ligne neuve (aucun appel payé sur la foi d’une question devenue fausse)');
        // (d) « Lire » pendant « Créer {n} références » (sa transaction retenue) : aucune question, rien ne part ; la création aboutit.
        await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_s4', sessionId: 'ss4', resultat: C })] }, origin: 'device' });
        let porte = null; let ouvrir = () => {}; let retenues = 0;
        const lent = { ...repo, transitionner: async (...a) => { retenues += 1; if (porte) await porte; return repo.transitionner(...a); } };
        porte = new Promise((r) => { ouvrir = r; });
        const ctx4 = await ctxDe(repo, db);
        const p4 = I.indexEntriesPanel(ctx4.scan_sessions.find((s) => s.id === 'ss4'), ctx4, () => [], { repo: lent, toast: () => {}, confirmer: async (q) => { questions.push(q); return true; }, fetch: ff.fetch, maintenant: () => NOW, importId: 'imp_s4' });
        scene.append(p4);
        await attendre(() => !lireIndex(p4).disabled && !!p4.querySelector('[data-role="entrees-lues"]'), 'lecture posée (d)');
        const q4 = questions.length;
        p4.querySelector('[data-role="creer-references"]').click();
        await attendre(() => retenues > 0 && p4.querySelector('[data-role="lecture"]').occupe(), 'création en cours (transaction retenue)');
        lireIndex(p4).click();
        await tick(); await tick();
        const pendant = [questions.length - q4, ff.appels.length];
        ouvrir(); porte = null;
        await attendre(async () => (await db.get('imports', 'imp_s4')).status === 'enregistre', 'création aboutie');
        eq([pendant, questions.length - q4, ff.appels.length], [[0, 0], 0, 0], 'T-C17 (ronde 1, constat 18) : « Lire » pendant « Créer {n} références » de la lecture montrée → aucune question (elle dirait « non créées » des entrées en train d’être créées), aucun POST ; la création aboutit');
      } finally { UI.reinitialiserImportCible(); scene.remove(); }
    }));

    await run('T-C17 (ronde 1) relecture sans session : aucune question', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      await poserBibliotheque(repo, db, { octets: true, seances: { ss1: ENVOI } });
      await db.mutate({ puts: { imports: [ligneAVerifier({ id: 'imp_q', resultat: C })] }, origin: 'device' });
      const scene = nouvelleScene(); const questions = [];
      const ff = fauxFetch([200, corpsModele(LECTURE_5)]);
      try {
        const ctx = await ctxDe(repo, db);
        let n = 0; ctx.sync = { ...ctx.sync, auth: { jeton: async () => (n++ === 0 ? SESSION : null) } }; // la session expire après le rendu
        const p = I.indexEntriesPanel(ctx.scan_sessions.find((s) => s.id === 'ss1'), ctx, () => [], { repo, toast: () => {}, confirmer: async (q) => { questions.push(q); return true; }, fetch: ff.fetch, maintenant: () => NOW, importId: 'imp_q' });
        scene.append(p);
        await attendre(() => !lireIndex(p).disabled && !!p.querySelector('[data-role="entrees-lues"]'), 'lecture posée, bouton allumé');
        const avant = await db.get('imports', 'imp_q');
        lireIndex(p).click();
        await attendre(() => p.querySelector('[data-role="connexion-ia"]')?.hidden === false, 'carte « Connecte-toi »');
        eq([questions, ff.appels.length, await db.get('imports', 'imp_q')], [[], 0, avant], 'T-C17 (ronde 1, constat 19) : sans session au moment de « Lire », la question de la relecture n’est pas posée (l’appel ne peut pas partir) : la carte « Connecte-toi » revient, rien n’est écrit, aucun POST');
      } finally { scene.remove(); }
    }));

    await run('T-C17 (ronde 1) ligne en_cours tenue par un autre document, « Ignorer » d’une autre lecture, veille', () => withRepo(async (repo, db) => {
      const I = await import('../src/ui/import.js');
      const UI = await import('../src/ui/import-cible.js');
      await poserBibliotheque(repo, db, { octets: true, seances: { ss_x: ['p4'], ss_k: ['p1'], ss_m: ['p2'] } });
      const VIVANT = '2026-10-19T11:59:00.000Z'; const MORT = '2026-10-19T11:58:00.000Z'; // NOW − 60 s ; NOW − 120 s
      await db.mutate({ puts: { imports: [
        { ...ligneJournal({ id: 'imp_x', edition_id: 'ed1', scan_session_id: 'ss_x', page_ids: ['p4'], device_id: 'dev_ailleurs' }), status: 'en_cours', document_id_vol: 'doc_ailleurs', started_at: VIVANT, battement_at: VIVANT },
        ligneJournal({ id: 'imp_k', edition_id: 'ed1', scan_session_id: 'ss_k', page_ids: ['p1'] }),
      ] }, origin: 'device' });
      const scene = nouvelleScene(); const dits = [];
      let alls = 0;
      const espion = { ...repo, all: async (s) => { const r = await repo.all(s); if (s === 'imports') alls += 1; return r; } };
      const ff = fauxFetch([200, corpsModele(blocsDe(['p4']))]);
      const panneauDe = async (sessionId) => { const ctx = await ctxDe(repo, db); let jetons = 0; ctx.sync = { ...ctx.sync, auth: { jeton: async () => { jetons += 1; return SESSION; } } }; const a = alls; const p = I.indexEntriesPanel(ctx.scan_sessions.find((s) => s.id === sessionId), ctx, () => [], { repo: espion, toast: (m) => dits.push(m), confirmer: async () => true, fetch: ff.fetch, maintenant: () => NOW }); scene.append(p); await attendre(() => jetons > 0 && alls > a, 'session et journal lus (ce panneau)'); await tick(); return p; };
      try {
        // (a) en_cours tenue ailleurs (vol vivant) : le texte, « Lire » éteint, aucun « Annuler » ; même forcé, lire() ne lance rien (I-7).
        const px = await panneauDe('ss_x');
        eq([px.querySelector('[data-role="etat-lecture"]').textContent, lireIndex(px).disabled, px.querySelector('[data-role="annuler"]'), px.etatPanneau()], ['En cours sur un autre écran', true, null, { importId: 'imp_x', status: 'en_cours', saisie: false, vol: false }], 'T-C17 (ronde 1 ; N06, N07, I-7 du lot A, § 4.2 état 3) : une ligne en_cours tenue par un AUTRE document → « En cours sur un autre écran », « Lire » éteint, aucun « Annuler »');
        const nX = (await db.getAll('imports')).filter((i) => i.scan_session_id === 'ss_x').length; const a0 = alls;
        lireIndex(px).disabled = false; lireIndex(px).click(); // forcé : la garde de lire() elle-même, pas seulement l'attribut du bouton
        await attendre(() => alls >= a0 + 2, 'lire() rendu, panneau relu'); await tick();
        eq([ff.appels.length, (await db.getAll('imports')).filter((i) => i.scan_session_id === 'ss_x').length, (await db.get('imports', 'imp_x')).status, lireIndex(px).disabled, UI.volEnCours()], [0, nX, 'en_cours', true, null], 'T-C17 (ronde 1 ; N11, I-7) : même forcé, « Lire » sur une ligne en_cours tenue ailleurs ne lance rien — aucun POST, aucune seconde ligne pour la séance (jamais une double lecture payée), la ligne intacte, le bouton re-éteint');
        // (b) « Ignorer » ne vaut que pour la lecture MONTRÉE (T4-R2) : la ligne a_lancer relancée ailleurs puis revenue à lancer (autre départ) n'est pas ignorée.
        const pk = await panneauDe('ss_k');
        const k2 = { ...(await db.get('imports', 'imp_k')), started_at: '2026-10-19T11:30:00.000Z' };
        await db.put('imports', k2);
        const b0 = alls;
        boutonTexte(pk, 'Ignorer').click();
        await attendre(() => alls >= b0 + 1, 'Ignorer refusé, panneau relu'); await tick();
        eq([await db.get('imports', 'imp_k'), pk.etatPanneau().status, pk.querySelector('[data-role="ignorer"]').hidden], [k2, 'a_lancer', false], 'T-C17 (ronde 1 ; N17, T4-R2) : la ligne a_lancer porte une autre lecture (autre départ) que celle montrée → « Ignorer » n’écrit rien, la ligne reste intacte, le panneau relu l’offre pour la ligne réelle');
        // (c) Veille (VF-15 du lot A) : une ligne en_cours de CET appareil dont le document est mort (battement de 120 s) est levée dès l'affichage.
        await db.mutate({ puts: { imports: [{ ...ligneJournal({ id: 'imp_mort', edition_id: 'ed1', scan_session_id: 'ss_m', page_ids: ['p2'], device_id: repo.deviceId() }), status: 'en_cours', document_id_vol: 'doc_mort', started_at: MORT, battement_at: MORT }] }, origin: 'device' });
        const pm = await panneauDe('ss_m');
        await attendre(async () => (await db.get('imports', 'imp_mort')).status === 'echec' && pm.textContent.includes('La lecture a été interrompue.'), 'levée à l’affichage');
        eq([(await db.get('imports', 'imp_mort')).erreur, lireIndex(pm).textContent, pm.textContent.includes('En cours sur un autre écran'), (await db.get('imports', 'imp_x')).status], [{ raison: 'interrompu', extra: {} }, 'Relancer', false, 'en_cours'], 'T-C17 (ronde 1 ; constat 20, VF-15 du lot A) : une ligne en_cours de CET appareil au document mort (battement de 120 s) est levée dès l’affichage du panneau — phrase I-4, « Relancer » ; plus d’impasse « En cours sur un autre écran » jusqu’au redémarrage ; le vol vivant d’un autre appareil reste en_cours');
      } finally { UI.reinitialiserImportCible(); scene.remove(); }
    }));

    // =================================================================================================================================
    // Tâche 5 — fiche livre et recherche (D-C6)
    await run('T-C18 section sur la fiche livre et la fiche référence', () => withRepo(async (repo, db) => {
      const { renderBook } = await import('../src/ui/book.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      // Ronde 1 : « Soupes » entre espaces (la section est ROGNÉE) ; puis des sections qu'une fiche reçue (synchronisation) ou restaurée (archive) peut porter :
      // un tableau, un nombre, des espaces seuls, un caractère invisible (Cf), un U+202E devant le texte, une chaîne au-delà de la borne ; et une `partial`.
      await poserBibliotheque(repo, db, { existantes: [{ original_title: 'Soupe de courge', printed_page: 98, section: '  Soupes  ' }, { original_title: 'Gaspacho', printed_page: 76 },
        { original_title: 'Pot-au-feu', printed_page: 140, section: ['Soupes'] }, { original_title: 'Fond de volaille', printed_page: 164, section: 5 }, { original_title: 'Vinaigrette', printed_page: 174, section: '   ' },
        { original_title: 'Mayonnaise', printed_page: 180, section: '\u200B' }, { original_title: 'Pesto', printed_page: 186, section: '\u202ESauces' }, { original_title: 'Pickles de légumes', printed_page: 190, section: 'x'.repeat(250) },
        { original_title: 'Tian de courgettes', printed_page: 88, section: 'Soupes', availability: 'partial' }] });
      const ctx = await ctxDe(repo, db);
      const fiche = await renderBook({ id: 'ed1' }, { nouveau: '1' }, ctx);
      const rangee = (titre) => { const carte = [...fiche.querySelectorAll('a.item-link')].find((a) => a.querySelector('h3')?.textContent === titre); return carte?.nextElementSibling ?? null; };
      const puces = (titre) => { const r = rangee(titre); return r ? [...r.querySelectorAll('.chip.neutral')].map((c) => c.textContent) : 'sans rangée'; };
      eq([puces('Soupe de courge'), puces('Gaspacho'), fiche.querySelectorAll('a [data-role="section"]').length], [['Soupes'], [], 0], 'T-C18 (M55, M-livre-sans-trim) : une référence avec section → une puce .chip.neutral « Soupes » (rognée) dans SA rangée, jamais dans un lien ; sans section → aucune');
      eq(['Pot-au-feu', 'Fond de volaille', 'Vinaigrette', 'Mayonnaise', 'Tian de courgettes'].map(puces), [[], [], [], [], []], 'T-C18 (ronde 1 ; M-livre-sans-typeof, M-livre-partial) : une section tableau ou nombre ne fait pas tomber la liste et n’a pas de puce ; une section blanche ou invisible non plus ; une partial sans lien web garde sa rangée « Importer » sans puce');
      eq([puces('Pesto'), puces('Pickles de légumes')], [['Sauces'], ['x'.repeat(200)]], 'T-C18 (ronde 1 ; M-section-brute, M-section-sans-borne) : la puce d’une section reçue est nettoyée (le U+202E est retiré) et bornée comme à la fabrication (BORNES_INDEX.section, 200 points de code)');
      const ficheDe = (titre) => renderRecipe({ id: ctx.recipes.find((r) => r.original_title === titre).id }, {}, ctx);
      const sousTitre = (p) => p.querySelector('.card.warn > h2 + p.muted')?.textContent ?? null;
      const page = await ficheDe('Soupe de courge');
      const sansSection = await ficheDe('Gaspacho');
      eq([sousTitre(page), sansSection.textContent.includes('Section :')], ['Section : Soupes', false], 'T-C18 (M-recette-classe, M-recette-place) : la fiche d’une référence dit « Section : Soupes » (rognée) dans un p.muted juste sous le h2 ; sans section, rien');
      const autres = [];
      for (const titre of ['Pot-au-feu', 'Fond de volaille', 'Vinaigrette', 'Mayonnaise', 'Pesto']) { const p = await ficheDe(titre); autres.push([!!p.querySelector('.card.warn > h2'), sousTitre(p)]); }
      eq(autres, [[true, null], [true, null], [true, null], [true, null], [true, 'Section : Sauces']], 'T-C18 (ronde 1 ; M-recette-sans-typeof, M-recette-sans-trim, M-recette-brute) : une section tableau, nombre, blanche ou invisible → la fiche se rend, sans « Section : » ; une section à U+202E est dite nettoyée');
      const rc = ctx.recipes.find((r) => r.original_title === 'Soupe de courge');
      const hostile = '<img src=x onerror="void 0"><a href="https://exemple.test/">Reconnecte-toi</a>';
      await db.mutate({ puts: { recipes: [{ ...rc, section: hostile }] }, origin: 'device' });
      const ctxH = await ctxDe(repo, db);
      const ficheH = await renderBook({ id: 'ed1' }, { nouveau: '1' }, ctxH);
      const pageH = await renderRecipe({ id: rc.id }, {}, ctxH);
      const elements = (racine) => [racine.querySelectorAll('img[src="x"]').length, racine.querySelectorAll('a[href="https://exemple.test/"]').length];
      eq([...elements(ficheH), ficheH.textContent.includes(hostile)], [0, 0, true], 'T-C18 (I-C2 ; M-html) : une section hostile reste du TEXTE sur la fiche livre (aucune image, aucun lien créés)');
      eq([...elements(pageH), pageH.textContent.includes('Section : ' + hostile)], [0, 0, true], 'T-C18 (I-C2, ronde 1 ; M-recette-html) : sur la fiche référence aussi, « Section : » suivi du texte hostile, aucune image ni aucun lien créés');
    }));
    await run('T-C19 recherche par section', async () => {
      const S = await import('../src/domain/search.js');
      const editions = [{ id: 'ed1', book_id: 'b1' }]; const books = [{ id: 'b1', title: 'Saisons' }];
      const ref = { id: 'rc_s', edition_id: 'ed1', original_title: 'Soupe de courge', availability: 'reference_only', section: 'Entrées', cuisines: [], tags: [] };
      const sans = { ...ref, id: 'rc_n', section: null };
      const dispo = { id: 'rc_d', edition_id: 'ed1', original_title: 'Gratin dauphinois', availability: 'available', section: 'Entrées', cuisines: [], tags: [], current_version_id: 'v1' };
      const poisson = { ...dispo, id: 'rc_p', original_title: 'Plat du vendredi', section: 'Poissons', current_version_id: 'v2' };
      const versions = [{ id: 'v1', recipe_id: 'rc_d', kind: 'extraction', ingredients: [], steps: [] }, { id: 'v2', recipe_id: 'rc_p', kind: 'extraction', ingredients: [], steps: [] }];
      // Ronde 1 : la section qui n'est pas une chaîne est un TABLEAU ['Entrées'], dont String() donne « Entrées » (un objet { x: 1 } donnait « [object Object] » : vert sans garde).
      const docs = S.buildDocs({ recipes: [ref, sans, dispo, { ...ref, id: 'rc_o', section: ['Entrées'] }, poisson], versions, editions, books, dishes: [], links: [] });
      const trouves = S.searchDocs(docs, S.parseQuery('entrée'), {}).references.map((r) => r.doc.recipe.id);
      eq([trouves.includes('rc_s'), trouves.includes('rc_n'), trouves.includes('rc_o')], [true, false, false], 'T-C19 (M56, M-recherche-sans-typeof) : une référence « Soupe de courge » rangée sous « Entrées » remonte sur « entrée » (section dans les titleTokens) ; sans section — ou une section qui n’est pas une chaîne, même un tableau [« Entrées »] — rien');
      eq(essai(() => S.buildDocs({ recipes: [{ ...ref, id: 'rc_t', section: JSON.parse('{"toString":0}') }], versions: [], editions, books, dishes: [], links: [] }).length), 1, 'T-C19 (ronde 1 ; M-recherche-sans-typeof) : une section reçue au toString hostile (du JSON valide) ne fait pas lever buildDocs — getData, donc toutes les routes, tomberaient');
      const d = docs.find((x) => x.recipe.id === 'rc_d');
      eq([d.tokens.has('entrees'), d.titleTokens.has('entrees')], [true, false], 'T-C19 : une recette available avec section → dans tokens, pas dans titleTokens');
      eq(S.searchDocs(docs, S.parseQuery('poisson'), {}).admissible.map((h) => h.doc.recipe.id), ['rc_p'], 'T-C19 (ronde 1 ; M-textParts) : une recette available rangée sous « Poissons » est TROUVÉE par « poisson » (la section entre dans ses tokens) ; limite : un mot de section qui est aussi un mot de type (« entrée ») ne trouve pas une recette sans type');
    });

    // =================================================================================================================================
    // Tâche 6 — filets du lot (T-C20, I-C8) : chaque texte neuf de la spec § 5 avec SON anglais ; modules dans SHELL et dans le filet i18n ; aucun texte
    // ne nomme le fournisseur ni la base (test de source admis, comme pour src/ui/import-cible.js).
    await run('T-C20 filets du lot', async () => {
      const { EN } = await import('../src/i18n/en.js');
      const { MODULES_NEUFS, CHAINES_NEUVES_AILLEURS } = await import('./ajouter.js');
      const lireSource = async (chemin) => { const r = await vraiFetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); }; // la fetch réelle gardée en tête de la suite (globalThis.fetch y lève)
      const ATTENDU = {
        'Ordre des photos': 'Photo order', 'Ordre proposé d’après les numéros de page lus — vérifie.': 'Order suggested from the page numbers read — check it.',
        'L’ordre des photos suit les numéros lus.': 'The photo order follows the page numbers read.', 'Appliquer cet ordre': 'Apply this order', 'Ordre enregistré.': 'Order saved.',
        'p. {a}-{b}': 'pp. {a}-{b}', 'Entrées lues': 'Entries read', '{n} entrées lues · {m} déjà dans ce livre': '{n} entries read · {m} already in this book',
        'Créer {n} références': 'Create {n} references', 'Créer 1 référence': 'Create 1 reference', 'déjà repérée': 'already spotted', 'en double': 'duplicate',
        'photo {n}': 'photo {n}', 'photo inconnue': 'unknown photo', 'Créer une référence pour « {t} »': 'Create a reference for “{t}”',
        'Déjà repérée dans ce livre': 'Already spotted in this book', 'En double dans cette lecture': 'Duplicate in this reading', 'Revenir à la lecture': 'Back to the reading',
        'Lecture coupée : lis moins de photos à la fois.': 'Reading cut off: read fewer photos at a time.', 'Aucune entrée lue sur ces photos.': 'No entry was read on these photos.',
        'Lue en {s} s · {n} photo(s)': 'Read in {s} s · {n} photo(s)', '{n} photo(s)': '{n} photo(s)', 'La lecture a déjà été enregistrée.': 'This reading has already been saved.',
        'Relire remplace la lecture reçue ({n} entrées non créées) et coûte un appel. Continuer ?': 'Reading again replaces the reading received ({n} entries not created) and costs one call. Continue?',
        'Relire': 'Read again', 'Une lecture = un appel à l’assistant, compté dans ton quota du jour.': 'One reading = one call to the assistant, counted in your daily quota.',
        'Les photos de cette séance ne sont pas sur cet appareil.': 'The photos of this session are not on this device.',
        '{k} entrées écartées (trop longues)': '{k} entries left out (too long)', '{k} entrées écartées (adresse)': '{k} entries left out (web address)',
        'page inconnue': 'unknown page', 'Incertain': 'Uncertain', '{n} référence(s) créée(s){d}': '{n} reference(s) created{d}', '{n} doublon(s) ignoré(s)': '{n} duplicate(s) skipped',
        'Titre': 'Title', 'Section': 'Section', 'Section : {s}': 'Section: {s}',
      };
      eq(Object.entries(ATTENDU).filter(([fr, en]) => EN[fr] !== en).map(([fr]) => fr), [], 'T-C20 (I-C8, § 5) : chaque texte neuf du lot a son entrée en.js, avec l’anglais de la spec');
      eq(['Saisir à la main', 'Monter la page {n}', 'Descendre la page {n}', 'p. imprimée', 'Lecture des pages par l’assistant…', 'Relancer', 'Annuler', 'L’assistant n’a pas répondu lisiblement. Réessaie.', 'Code : {c}', 'Une lecture est déjà en cours : annule-la d’abord.', 'Tu es hors ligne.', 'En cours sur un autre écran', 'incertain', 'Incertain : {t}', 'Ignorer', 'Page {n}'].filter((k) => typeof EN[k] !== 'string'), [], 'T-C20 : les clés existantes que le lot réemploie sont toujours là');
      const sw = await lireSource('../sw.js');
      ok(sw.includes("'./src/domain/table-matieres.js'") && sw.includes("'./src/ui/table-matieres.js'"), 'T-C20 : SHELL contient les deux modules neufs du lot');
      eq([MODULES_NEUFS.includes('../src/ui/table-matieres.js'), ['Relire remplace la lecture reçue ({n} entrées non créées) et coûte un appel. Continuer ?', 'Relire', 'Les photos de cette séance ne sont pas sur cet appareil.', 'Revenir à la lecture'].every((c) => CHAINES_NEUVES_AILLEURS['../src/ui/import.js']?.includes(c)), CHAINES_NEUVES_AILLEURS['../src/ui/recipe.js']?.includes('Section : {s}')], [true, true, true], 'T-C20 : le filet i18n couvre le module neuf (MODULES_NEUFS) et les chaînes neuves d’import.js et de recipe.js (CHAINES_NEUVES_AILLEURS)');
      const src = await lireSource('../src/ui/table-matieres.js');
      ok(src.length > 1000 && /export function panneauLecture/.test(src) && /export async function creerReferences/.test(src), 'T-C20 : src/ui/table-matieres.js est lu (garde contre un source vide)');
      eq(/Anthropic|Supabase/.test(src), false, 'T-C20 (I-C8) : aucun texte ne nomme le fournisseur ni la base dans src/ui/table-matieres.js');
    });

    // --- (repère) les tâches suivantes ajoutent leurs blocs AU-DESSUS de cette ligne
  } catch (error) {
    ok(false, `Table des matières : suite interrompue — ${error?.name || 'Erreur'} — ${error?.message || String(error)}`);
  } finally { globalThis.fetch = vraiFetch; setUiLocale(localeAvant); }
}
