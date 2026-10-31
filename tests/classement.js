import {lireLivraison} from './livraison-fixture.js';
// Tests du lot D « Un lot de recettes photographiées » (spec docs/superpowers/specs/2026-10-19-recettes-en-lot-design.md, rév. 4 ;
// plan docs/superpowers/plans/2026-10-19-recettes-en-lot.md). Fonctions pures sur des fixtures fixes (données fictives), primitives sur bases
// jetables (withRepo), écrans à dépendances injectées (repo, fetch, confirmer, navigate, toast, maintenant) ; aucun réseau ; chaque assertion
// nomme le mutant qu'elle tue (spec § 7). Les modules du lot sont importés DYNAMIQUEMENT : un module absent fait une ligne rouge nommée, jamais une
// page de tests blanche.
import { withRepo } from './sync-fixture.js';
import { on, emit } from '../src/core/bus.js';
import { resetClock } from '../src/sync/clock.js';
import { setUiLocale, getUiLocale } from '../src/core/i18n.js';
import { sha256Hex } from '../src/core/hash.js';
import { deviceId as appareilIci } from '../src/model/repo.js'; // l'identifiant de CET appareil dans la base jetable liée par withRepo (fixtures, tâches 2 à 5)

const DATE = '2026-10-19T00:00:00.000Z';
const NOW = '2026-10-19T12:00:00.000Z';
const SESSION = { access_token: 'jeton-lot-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
const PAGES_5 = ['p1', 'p2', 'p3', 'p4', 'p5'];
// CLASSEMENT_5 (spec § 7) : la réponse du modèle pour la séance p1..p5 envoyée dans cet ordre — p1 « Soupe de courge » (début, p. 132),
// p2 « Tarte fine aux poires » (p. 140), p3 suite de la soupe (p. 133), p4 suite d'une recette absente (p. 98), p5 « Gratin dauphinois » (p. 148).
const CLASSEMENT_5 = { groupes: [{ photos: [1, 3], title: 'Soupe de courge', printed_page: 132, uncertain: false }, { photos: [2], title: 'Tarte fine aux poires', printed_page: 140, uncertain: false }, { photos: [5], title: 'Gratin dauphinois', printed_page: 148, uncertain: false }], orphelines: [4], uncertain: [] };
// Une référence de l'édition ed1 (la forme qu'écrit « Créer les références »).
const ref = (id, original_title, printed_page, over = {}) => ({ id, edition_id: 'ed1', original_title, original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], created_at: DATE, updated_at: DATE, ...over });
// REFERENCES_ED (spec § 7) : attendu g1 → rcS sûre cochée, g2 → rcT sûre cochée (rcP, page seule, hors de la meilleure classe), g3 → rcG incertaine
// « titre », décochée. rcW est un signet, rcA est available, rcO a un import ouvert (IMPORT_RCO), rcX a la forme de C (photo d'index).
const REFERENCES_ED = [ref('rcS', 'Soupe de courge', 132), ref('rcT', 'Tarte aux poires', 141), ref('rcG', 'Gratin dauphinois', 152), ref('rcP', 'Poire rôtie au miel', 140), ref('rcW', 'Soupe de courge', null, { source_url: 'https://exemple.test/soupe' }), ref('rcA', 'Gratin dauphinois', 148, { availability: 'available' }), ref('rcO', 'Pot-au-feu', 98), ref('rcX', 'Velouté de panais', 120, { index_page_id: 'pIdx', source_page_ids: ['pIdx'] })];
// Une ligne d'un autre lot, OUVERTE, sur rcO et sur une autre séance : rcO n'est jamais proposée, elle est montrée éteinte.
const IMPORT_RCO = { id: 'imp_rco', kind: 'recette', recipe_id: 'rcO', edition_id: 'ed1', scan_session_id: 'ss_autre', page_ids: ['q9'], photo_sha256: null, status: 'a_lancer', erreur: null, resultat: null, reponse_brute: null, appels: 0, model: null, duree_ms: null, device_id: 'dev_autre', document_id_vol: null, battement_at: null, started_at: null, finished_at: null, created_at: DATE, updated_at: DATE };
const HOMONYMES = [ref('rcH1', 'Tarte aux pommes', 54), ref('rcH2', 'Tarte aux pommes', 210)];
const corpsModele = (contenu, extra = {}) => ({ model: 'claude-x', stop_reason: 'end_turn', content: [{ type: 'text', text: typeof contenu === 'string' ? contenu : JSON.stringify(contenu) }], ...extra });
const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
const COULEURS = ['#811', '#181', '#118', '#881', '#188', '#818', '#444', '#a50', '#5a0', '#05a', '#a05', '#0a5'];
// Une vraie image (pagePourEnvoi la décode) : couleur différente → octets et empreinte différents.
async function imageDe(nom, couleur) {
  const c = new OffscreenCanvas(320, 240); const cx = c.getContext('2d');
  cx.fillStyle = couleur; cx.fillRect(0, 0, 320, 240); cx.fillStyle = '#fff'; cx.fillRect(10, 10, 160, 120);
  return new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' });
}
// La forme stockée (§ 3.2) de CLASSEMENT_5 — égale à R5, calculée et affirmée par T-D3.
const R5_STOCKE = { groupes: [{ page_ids: ['p1', 'p3'], title: 'Soupe de courge', printed_page: 132, uncertain: false }, { page_ids: ['p2'], title: 'Tarte fine aux poires', printed_page: 140, uncertain: false }, { page_ids: ['p5'], title: 'Gratin dauphinois', printed_page: 148, uncertain: false }], orphelines: ['p4'], non_classees: [], partagees: [], uncertain: [] };
// Une ligne de classement (la forme qu'écrivent repo.ouvrirImport puis le vol), posée directement dans la base — jamais par un écran.
// device_id : CET appareil par défaut (appareilIci, lu à l'appel, dans withRepo) — jamais null ; un autre appareil s'écrit explicitement ('dev_autre').
const ligneClassement = ({ id = 'imp_cl', sessionId = 'ss1', page_ids = PAGES_5, status = 'a_verifier', device_id = appareilIci(), over = {} } = {}) => ({ id, kind: 'classement', edition_id: 'ed1', recipe_id: null, scan_session_id: sessionId, page_ids: [...page_ids], photo_sha256: null, status, erreur: null, resultat: status === 'a_verifier' ? R5_STOCKE : null, reponse_brute: null, brouillon: null, appels: 1, model: 'claude-x', duree_ms: 900, device_id, document_id_vol: null, battement_at: null, started_at: DATE, finished_at: null, created_at: DATE, updated_at: DATE, ...over });
// Une bibliothèque minimale sur la base jetable : le livre « Saisons » (b1, édition ed1), les références, une séance `id` ouverte sur `pages`
// (position = rang ; octets réels sauf pour les pages de `sansOctets`, ou toutes si octets = false), et des lignes du journal.
async function poserSeance(repo, db, { id = 'ss1', pages = PAGES_5, octets = true, sansOctets = [], edition = 'ed1', references = REFERENCES_ED, imports = [], imprimees = {}, sortes = {} } = {}) {
  const lignes = [];
  for (const [i, pid] of pages.entries()) {
    let sha256 = 'sha-' + pid;
    if (octets && !sansOctets.includes(pid)) { const f = await imageDe(pid + '.jpg', COULEURS[i % COULEURS.length]); sha256 = await sha256Hex(f); await repo.putFile(sha256, f, { original_filename: f.name }); }
    lignes.push({ id: pid, document_id: null, edition_id: edition, sha256, printed_page: imprimees[pid] ?? null, file_position: null, locator: null, position: i + 1, issues: [], kind: sortes[pid] ?? null, created_at: DATE, updated_at: DATE });
  }
  await db.mutate({ puts: {
    books: [{ id: 'b1', title: 'Saisons', author: 'A. B.', created_at: DATE, updated_at: DATE }], book_editions: [{ id: 'ed1', book_id: 'b1', language: 'fr', created_at: DATE, updated_at: DATE }],
    recipes: references, source_pages: lignes,
    scan_sessions: [{ id, status: 'open', edition_id: edition, started_at: DATE, page_ids: [...pages], document_ids: [], recipe_ids: [], device_id: repo.deviceId(), created_at: DATE, updated_at: DATE }],
    ...(imports.length ? { imports } : {}),
  }, origin: 'device' });
}
// Le contexte d'un écran (comme getData), relu dans la base jetable ; la session de l'assistant par ctx.sync (sessionAssistant).
async function ctxDe(repo, db, { session = SESSION } = {}) {
  const noms = ['recipes', 'books', 'book_editions', 'source_pages', 'scan_sessions', 'imports', 'recipe_versions', 'source_documents'];
  const [recipes, books, book_editions, source_pages, scan_sessions, imports, recipe_versions, source_documents] = await Promise.all(noms.map((s) => db.getAll(s)));
  return {
    recipes, books, book_editions, source_pages, scan_sessions, imports, recipe_versions, source_documents, rediscovery_prefs: [], cook_history: [], dish_recipe_links: [], recipe_translations: [], dishes: [], ingredients: [], library_activity: [],
    recipesById: repo.indexBy(recipes), editionsById: repo.indexBy(book_editions), booksById: repo.indexBy(books), pagesById: repo.indexBy(source_pages),
    versionsByRecipe: repo.groupBy(recipe_versions, 'recipe_id'), versionsById: repo.indexBy(recipe_versions), dishesById: new Map(), ingredientsById: new Map(), docsByRecipe: new Map(),
    settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' },
    sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } },
    editionLabel: () => 'Saisons', conventionFor: () => null,
  };
}
// Attendre un FAIT, jamais un délai : true dès que la condition tient, sinon une erreur nommée au bout de 3 s.
const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
const tick = () => new Promise((r) => setTimeout(r, 0));
// Une scène HORS ÉCRAN mais visible : le focus ne se pose pas dans un conteneur caché.
const nouvelleScene = () => { const s = document.createElement('div'); s.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(s); return s; };
const boutonTexte = (racine, texte) => (racine ? [...racine.querySelectorAll('button')].find((b) => b.textContent === texte) || null : null);
// Une fausse fetch qui HONORE le signal (rejet AbortError) et se résout à la main (a.rendre[i](statut, corps)) ou toute seule (a.auto : [statut, corps],
// ou une fonction (appel) → [statut, corps], qui peut aussi lever pour simuler le réseau coupé).
function fauxFetch(auto = null) {
  const a = { appels: [], rendre: [], auto };
  a.fetch = (url, options) => new Promise((resolve, reject) => {
    const appel = { url, options }; a.appels.push(appel);
    const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
    if (options?.signal?.aborted) { abandon(); return; }
    options?.signal?.addEventListener('abort', abandon, { once: true });
    const fin = (status, corps) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(status, corps)); };
    if (a.auto) { let d; try { d = typeof a.auto === 'function' ? a.auto(appel) : a.auto; } catch (e) { reject(e); return; } fin(d[0], d[1]); } else a.rendre.push(fin);
  });
  return a;
}
const imagesEnvoyees = (appel) => JSON.parse(appel.options.body).corps.messages[0].content.filter((c) => c.type === 'image').map((c) => c.source.data);
// Les nœuds de la séance : une case par vignette (figure[data-page], C), le bouton « Classer » de la barre et la ligne sous lui, le lien « Regrouper ».
const cocher = (racine, ids) => { for (const id of ids) racine.querySelector(`figure[data-page="${CSS.escape(id)}"] input[type="checkbox"]`).click(); };
const cochees = (racine) => [...racine.querySelectorAll('figure[data-page] input[type="checkbox"]')].filter((c) => c.checked).map((c) => c.closest('figure').dataset.page);
const classerBtn = (racine) => racine.querySelector('button[data-role="classer"]');
const sousClasser = (racine) => classerBtn(racine)?.nextElementSibling ?? null;
const lienRegrouper = (racine) => [...racine.querySelectorAll('a')].find((a) => a.textContent === 'Regrouper en recette') || null;
const panneau = (racine) => racine.querySelector('[data-role="classement"]');
const raisonPanneau = (racine) => panneau(racine)?.querySelector('[data-role="raison-classer"]')?.textContent ?? null;
// Ronde 1 de T2 : la barre de sélection de sessionView (la rangée de son bouton « Retirer ») et ses nœuds texte NUS (un null passé à append natif s'y
// écrirait « null », écart E-7).
const barre = (racine) => [...racine.querySelectorAll('button.btn')].find((b) => b.textContent === 'Retirer de la séance')?.parentElement ?? null;
const texteNuDeBarre = (racine) => [...(barre(racine)?.childNodes ?? [])].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.data);
// Une lecture de recette (forme validée par validateParsedRecipe) que la fausse fetch rend pour une ligne du lot.
const RECETTE_LUE = (title = 'Soupe de courge', printed_page = 132, over = {}) => ({ title, servings: null, prep_minutes: null, cook_minutes: null, ingredients: [{ source_text: '1 courge', uncertain: false }], steps: [{ text: 'Cuire.' }], printed_page, sub_recipes: [], uncertain_fields: [], notes: null, incomplete: false, missing_page: false, ...over });
// Une ligne d'un lot (la forme de lecturesDuLot), posée directement dans la base ; device_id : CET appareil par défaut (jamais null).
const ligneLot = ({ id, classementId = 'imp_cl', rang = 1, total = 3, page_ids = ['p1'], recipe_id = null, device_id = appareilIci(), sessionId = 'ss1', status = 'a_lancer', over = {} }) => ({ id, kind: 'recette', edition_id: 'ed1', recipe_id, scan_session_id: sessionId, page_ids: [...page_ids], photo_sha256: null, status, erreur: null, resultat: null, reponse_brute: null, appels: 0, model: null, duree_ms: null, device_id, document_id_vol: null, battement_at: null, started_at: null, finished_at: null, lot: { classement_id: classementId, rang, total, titre: null, page: null }, created_at: DATE, updated_at: DATE, ...over });
// Une fetch qui rend, dans l'ordre, les réponses d'une liste ([statut, corps]) ; au-delà, la dernière.
const fetchSuite = (reponses) => { let k = 0; return fauxFetch(() => reponses[Math.min(k++, reponses.length - 1)]); };

export async function runClassementTests({ eq, ok }) {
  resetClock();
  const localeAvant = getUiLocale();
  setUiLocale('fr'); // des textes français sont affirmés ; une suite antérieure a pu basculer l'interface
  const run = async (nom, test) => {
    try { await test(); }
    catch (error) { ok(false, `Lot de recettes — ${nom} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };
  const raison = (fn) => { try { fn(); return 'acceptée'; } catch (e) { return [e?.name, e?.raison ?? e?.message]; } };
  // eq compare par JSON.stringify : dans un tableau, undefined devient null. Une attente « null » se lit donc par son TYPE (un `return;` tombé en fin
  // de fonction rend 'undefined', jamais 'null').
  const nul = (v) => (v === null ? 'null' : typeof v);
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  try {
    const L = await import('../src/domain/llm.js');
    const C = await import('../src/domain/classement.js');
    const I = await import('../src/domain/import-cible.js');
    const B = await import('../src/core/bornes.js');
    const R5 = C.resultatClassement(L.validerClassement(CLASSEMENT_5, { nbPhotos: 5 }), PAGES_5); // la forme stockée (§ 3.2) de CLASSEMENT_5
    const PP = new Map(PAGES_5.map((id) => [id, { id }])); // les pages présentes (pointeurs souples)

    // =================================================================================================================================
    // Tâche 1 — T-D1 validerClassement (spec § 3.5, D-D21, R-D-7)
    await run('T-D1 validerClassement', async () => {
      const V = (data, n = 5) => L.validerClassement(data, { nbPhotos: n });
      const g = (photos, title = 'A', over = {}) => ({ photos, title, printed_page: null, uncertain: false, ...over });
      const forme = (r) => [r.groupes.map((x) => [x.photos, x.uncertain]), r.partagees];
      eq(V(CLASSEMENT_5), { groupes: CLASSEMENT_5.groupes, orphelines: [4], non_classees: [], partagees: [], uncertain: [] }, 'T-D1 : CLASSEMENT_5 → la forme validée exacte (non_classees et partagees vides)');
      eq([L.BORNES_CLASSEMENT, Object.isFrozen(L.BORNES_CLASSEMENT), L.MAX_TOKENS_CLASSER, L.MAX_PHOTOS_CLASSEMENT], [{ photos: 10, groupes: 10, titre: 200, page: 9999, incertitudes: 40, incertitude: 200 }, true, 2000, 10], 'T-D1 : la table BORNES_CLASSEMENT de la spec § 3.5, gelée ; MAX_TOKENS_CLASSER 2000 ; MAX_PHOTOS_CLASSEMENT 10');
      eq([raison(() => V('x')), raison(() => V([])), raison(() => V({})), raison(() => V({ groupes: 'x' }))], [['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'illisible']], 'T-D1 : racine non objet, tableau, sans groupes, groupes non tableau → illisible');
      eq(raison(() => V({ groupes: [g([6])] })), ['ErreurExtraction', 'hors_bornes'], 'T-D1 (M1) : une photo 6 sur N = 5 → hors_bornes');
      eq([raison(() => V({ groupes: [g(['2'])] })), raison(() => V({ groupes: [g([1.5])] }))], [['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'illisible']], 'T-D1 (M2) : un numéro non entier (« 2 », 1.5) → illisible');
      eq(forme(V({ groupes: [g([1, 2], 'Soupe'), g([2, 3], 'Tarte')] })), [[[[1], true], [[2, 3], true]], [2]], 'T-D1 (M3, M3b, M158) : photo 2 en queue du premier et EN TÊTE du second → gardée dans le second, retirée du premier ; les deux groupes incertains ; partagees [2] ; le classement n’est pas jeté');
      eq(forme(V({ groupes: [g([2, 3]), g([1, 2])] })), [[[[2, 3], true], [[1], true]], [2]], 'T-D1 (R-D-7) : en tête du premier → gardée dans le premier');
      eq(forme(V({ groupes: [g([1, 2]), g([3, 2])] })), [[[[1, 2], true], [[3], true]], [2]], 'T-D1 (R-D-7) : en tête d’aucun → le premier qui la nomme');
      eq(forme(V({ groupes: [g([2]), g([2, 4])] })), [[[[2], true], [[4], true]], [2]], 'T-D1 (R-D-7) : en tête des deux → le premier ; le second devient [4]');
      eq(forme(V({ groupes: [g([2, 3]), g([2])] })), [[[[2, 3], true]], [2]], 'T-D1 (R-D-7) : le second, vidé par le départage, est écarté ; le reste gardé');
      eq(forme(V({ groupes: [g([1, 2]), g([2, 3]), g([4, 2])] })), [[[[1], true], [[2, 3], true], [[4], true]], [2]], 'T-D1 (R-D-7) : nommée par trois groupes, en tête du second seulement → le second ; partagees [2] une fois ; les trois incertains');
      eq(V({ groupes: [g([1, 2]), g([2, 3])] }).non_classees, [4, 5], 'T-D1 : non_classees = les numéros que la réponse ne nomme nulle part');
      eq(raison(() => V({ groupes: [g([3, 1, 3])] })), ['ErreurExtraction', 'hors_bornes'], 'T-D1 (M3c) : la photo 3 deux fois dans le MÊME groupe → hors_bornes');
      eq(raison(() => V({ groupes: [g([1, 4])], orphelines: [4] })), ['ErreurExtraction', 'hors_bornes'], 'T-D1 (M4) : la photo 4 dans un groupe ET dans orphelines → hors_bornes');
      const dix = Array.from({ length: 10 }, (_, i) => g([i + 1], 'R' + i));
      eq([raison(() => V({ groupes: [...dix, g([1], 'X')] }, 10)), raison(() => V({ groupes: dix }, 10))], [['ErreurExtraction', 'hors_bornes'], 'acceptée'], 'T-D1 (M5) : 11 groupes → hors_bornes ; 10 → acceptés');
      const long201 = 'é'.repeat(201); const long200 = 'é'.repeat(200);
      const t201 = V({ groupes: [g([1], long201), g([2], 'Gaspacho')] });
      eq([t201.groupes[0].title, t201.groupes[0].uncertain, t201.groupes[1]], [null, true, { photos: [2], title: 'Gaspacho', printed_page: null, uncertain: false }], 'T-D1 (M6, M6b) : un titre de 201 points de code → titre null ET groupe incertain, jamais tronqué ; le reste gardé (une lecture payée n’est jamais jetée pour un titre)');
      eq(V({ groupes: [g([1], long200)] }).groupes[0].title, long200, 'T-D1 : un titre de 200 points de code exactement est gardé');
      eq(V({ groupes: [g([1], 'Soupe de courge\nrôtie')] }).groupes[0].title, 'Soupe de courge rôtie', 'T-D1 (M104) : un titre sur deux lignes est plié sur une ligne');
      eq(V({ groupes: [g([1], 'Soupe\u{2028}de courge')] }).groupes[0].title, 'Soupe de courge', 'T-D1 (MR-colle, R-D-13) : un titre coupé par U+2028 SANS espace autour rend « Soupe de courge », jamais « Soupede courge » — la fin de ligne devient une espace AVANT le nettoyage (uneLigne du lot C, puis plierUneLigne)');
      eq([V({ groupes: [g([1], 'voir www.exemple.test/x')] }).groupes[0].title, V({ groupes: [g([1], 'voir www.exemple.test/x')] }).groupes[0].uncertain], [null, true], 'T-D1 (mur de validerClassement, porteAdresse sur la forme recollée) : une adresse dans le titre → titre null + incertain (vague finale, constat 13 : M7, la garde d’estTitreUneLigne, est tenu par T-D8 — validerClassement garde un second mur)');
      eq([V({ groupes: [g([1], 'Tar\u{202E}te\u{200B} aux pommes')] }).groupes[0].title, V({ groupes: [g([1], 'Tar\u{D800}te')] }).groupes[0].title], ['Tarte aux pommes', 'Tarte'], 'T-D1 (M8, M9) : Cf (U+202E, U+200B) et une demi-paire de substitution retirés d’un titre');
      eq([0, 10000, '132', 1.5].map((p) => V({ groupes: [g([1], 'A', { printed_page: p })] }).groupes[0].printed_page), [null, null, null, null], 'T-D1 (M10) : printed_page 0, 10000, « 132 », 1.5 → null');
      eq(V({ groupes: [g([1], 'A', { uncertain: 'oui' })] }).groupes[0].uncertain, false, 'T-D1 (M11) : uncertain « oui » → false (vrai seulement s’il vaut true)');
      eq(V({ groupes: [{ title: 'Sans photos' }, g([], 'Vide'), g([2], 'B')] }).groupes.map((x) => x.photos), [[2]], 'T-D1 (M12) : un bloc sans photos ou à photos vides est écarté (une seule règle des groupes vides : le filtre final, qui écarte aussi un groupe vidé par le départage)');
      eq(V({ groupes: [[1], null, 'x', g([2], 'B')] }).groupes.map((x) => x.photos), [[2]], 'T-D1 : un bloc tableau, null ou chaîne est écarté');
      eq(V({ groupes: [Object.create({ photos: [1] }), g([2], 'B')] }).groupes.map((x) => x.photos), [[2]], 'T-D1 (M13) : un bloc dont « photos » n’est porté que par le prototype est écarté (lecture par Object.hasOwn)');
      eq(V(JSON.parse('{"groupes":[{"__proto__":{"photos":[1]}},{"photos":[2],"title":"B"}]}')).groupes.map((x) => x.photos), [[2]], 'T-D1 : la variante JSON (clé propre « __proto__ ») est écartée aussi (cas de plus, ne compte pas comme tueuse de M13)');
      eq([({}).photos, ({}).groupes], [undefined, undefined], 'T-D1 : aucun prototype n’a été pollué');
      const u = (k) => Array.from({ length: k }, (_, i) => 'doute ' + i);
      eq([raison(() => V({ groupes: [g([1])], uncertain: u(41) })), raison(() => V({ groupes: [g([1])], uncertain: u(40) }))], [['ErreurExtraction', 'hors_bornes'], 'acceptée'], 'T-D1 (M14) : 41 chaînes uncertain → hors_bornes ; 40 → acceptées');
      eq(V({ groupes: [g([1])], uncertain: ['x'.repeat(201), 'voir exemple.test/x', 'photo\nfloue', 7, 'ok'] }).uncertain, ['photo floue', 'ok'], 'T-D1 (M14, M105) : une chaîne de 201 et une chaîne porteuse d’une adresse sont écartées sans compte ; une chaîne sur deux lignes est pliée ; une non-chaîne est écartée');
      const r41 = (() => { try { return V({ groupes: [g([1])], uncertain: [...u(40), 'voir exemple.test/x'] }).uncertain.length; } catch (e) { return [e?.name, e?.raison]; } })();
      eq(r41, 40, 'T-D1 (M14, M105) : une incertitude écartée ne compte pas dans la borne — 40 gardées et 1 écartée (adresse) → acceptées, 40 rendues');
      eq(V({ groupes: [g([1])], non_classees: [1], partagees: [1] }), { groupes: [{ photos: [1], title: 'A', printed_page: null, uncertain: false }], orphelines: [], non_classees: [2, 3, 4, 5], partagees: [], uncertain: [] }, 'T-D1 (M15, M16) : les clés non_classees et partagees de la réponse sont ignorées (calculées par l’app) ; une photo nommée nulle part est « non classée », jamais rangée d’office');
      eq(raison(() => V({ groupes: [], orphelines: [1, 2, 3, 4, 5] })), ['ErreurExtraction', 'vide'], 'T-D1 (M17) : toutes en orphelines (zéro groupe) → vide');
      const r18 = V({ ...CLASSEMENT_5, x: 1, groupes: [{ ...CLASSEMENT_5.groupes[0], y: 2 }] });
      eq([Object.keys(r18), Object.keys(r18.groupes[0])], [['groupes', 'orphelines', 'non_classees', 'partagees', 'uncertain'], ['photos', 'title', 'printed_page', 'uncertain']], 'T-D1 (M18) : une clé inconnue est absente du rendu, à la racine comme dans un groupe, et aucune clé de travail (tete) ne fuit d’un groupe (objets construits champ par champ)');
      eq([raison(() => V({ groupes: [g([1])], orphelines: 'x' })), raison(() => V({ groupes: [g([1])], orphelines: ['1'] })), raison(() => V({ groupes: [g([1])], orphelines: [9] }))], [['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'illisible'], ['ErreurExtraction', 'hors_bornes']], 'T-D1 : orphelines non tableau → illisible ; un élément non entier → illisible ; hors 1..N → hors_bornes');
      // Ronde 1 de la tâche 1 (revue à trois lentilles) : les règles de § 3.5 que la première écriture n'épinglait pas.
      const coupee = (sep) => V({ groupes: [g([1], 'Voir evil' + sep + '.com/promo'), g([2], 'B')], uncertain: ['Voir evil' + sep + '.com/promo', 'ok'] });
      eq(['\n', '\u{2028}'].map((sep) => { const r = coupee(sep); return [nul(r.groupes[0].title), r.groupes[0].uncertain, r.groupes[1], r.uncertain]; }), Array(2).fill(['null', true, { photos: [2], title: 'B', printed_page: null, uncertain: false }, ['ok']]), 'T-D1 (M-recolle, ronde 1) : une adresse COUPÉE par une fin de ligne (saut de ligne, U+2028) est cherchée aussi sur la forme recollée, comme porteAdresse du lot C — le titre devient null et le groupe incertain, l’incertitude racine est écartée ; le reste gardé');
      eq(raison(() => V({ groupes: [g([1])], orphelines: [4, 4] })), ['ErreurExtraction', 'hors_bornes'], 'T-D1 (M-d, ronde 1) : la même photo deux fois dans orphelines → hors_bornes (jamais un résultat que la revalidation rejetterait au remontage)');
      eq([1, 9999].map((p) => V({ groupes: [g([1], 'A', { printed_page: p })] }).groupes[0].printed_page), [1, 9999], 'T-D1 (M-b, M-c, ronde 1) : printed_page 1 et 9999 gardées (bornes incluses)');
      eq(V({ groupes: [g([3, 1]), g([1, 3])] }).partagees, [1, 3], 'T-D1 (M-e, ronde 1) : partagees en numéros croissants, même nommées dans l’ordre décroissant');
      const blanc = V({ groupes: [g([1], '   ')], uncertain: 'x' });
      eq([nul(blanc.groupes[0].title), blanc.groupes[0].uncertain, blanc.uncertain], ['null', false, []], 'T-D1 (M-w, M-hh, ronde 1) : un titre blanc → null SANS rendre le groupe incertain ; une racine uncertain qui n’est pas un tableau → []');
    });

    // T-D3 resultatClassement, revalidation, clé, prédicat partagé (§ 3.6, D-D11, D-D23)
    await run('T-D3 resultatClassement, revaliderResultatClassement, cleClassement', async () => {
      eq(R5, { groupes: [{ page_ids: ['p1', 'p3'], title: 'Soupe de courge', printed_page: 132, uncertain: false }, { page_ids: ['p2'], title: 'Tarte fine aux poires', printed_page: 140, uncertain: false }, { page_ids: ['p5'], title: 'Gratin dauphinois', printed_page: 148, uncertain: false }], orphelines: ['p4'], non_classees: [], partagees: [], uncertain: [] }, 'T-D3 (M25) : numéro n → pageIds[n − 1] sur l’envoi [p1..p5]');
      eq(C.resultatClassement(L.validerClassement({ groupes: [{ photos: [1, 2] }, { photos: [2, 3] }] }, { nbPhotos: 3 }), ['pa', 'pb', 'pc']).partagees, ['pb'], 'T-D3 (M25) : partagees traduites aussi');
      const court = C.resultatClassement(L.validerClassement({ groupes: [{ photos: [1, 2] }], orphelines: [3] }, { nbPhotos: 3 }), ['p1', 'p3', 'p5']);
      eq([court.groupes.map((x) => x.page_ids), court.orphelines], [[['p1', 'p3']], ['p5']], 'T-D3 (M26) : la correspondance se fait sur les pages ENVOYÉES (p2 et p4 absentes au vol), jamais sur les page_ids de la ligne');
      eq(C.revaliderResultatClassement(JSON.parse(JSON.stringify(R5)), PAGES_5), R5, 'T-D3 (M27) : un résultat valide revient à l’identique');
      const avec = (over) => ({ ...JSON.parse(JSON.stringify(R5)), ...over });
      const grp = (over) => ({ page_ids: ['p1'], title: 'A', printed_page: null, uncertain: false, ...over });
      eq([C.revaliderResultatClassement(R5, ['p1', 'p2', 'p3']), C.revaliderResultatClassement(avec({ orphelines: ['p1'] }), PAGES_5)].map(nul), ['null', 'null'], 'T-D3 (M28) : un identifiant hors des page_ids de la ligne → null ; un doublon entre groupe et orphelines → null');
      eq([C.revaliderResultatClassement(avec({ partagees: ['p4'] }), PAGES_5), C.revaliderResultatClassement(avec({ partagees: ['p1', 'p1'] }), PAGES_5)].map(nul), ['null', 'null'], 'T-D3 (M107) : partagees qui nomme une page hors groupe, ou deux fois → null');
      const onze = Array.from({ length: 11 }, (_, i) => grp({ page_ids: ['x' + i] }));
      eq([C.revaliderResultatClassement({ ...avec({}), groupes: onze, orphelines: [] }, onze.map((x) => x.page_ids[0])), C.revaliderResultatClassement(avec({ groupes: [grp({ page_ids: [] })] }), PAGES_5), C.revaliderResultatClassement(avec({ groupes: [] }), PAGES_5)].map(nul), ['null', 'null', 'null'], 'T-D3 : 11 groupes, un groupe vide, zéro groupe → null');
      eq([grp({ title: 'é'.repeat(201) }), grp({ title: 'Tar\u{202E}te' }), grp({ title: 'Soupe\nrôtie' }), grp({ printed_page: 0 }), grp({ uncertain: 'x' })].map((x) => C.revaliderResultatClassement({ groupes: [x], orphelines: [], non_classees: [], partagees: [], uncertain: [] }, ['p1'])).map(nul), Array(5).fill('null'), 'T-D3 (M29) : un titre stocké de 201, porteur d’U+202E ou d’un saut de ligne, une page 0, un uncertain non booléen → null (jamais moins strict que la validation)');
      eq(['x', {}, [], null, JSON.parse('{"__proto__":{"groupes":[]}}'), Object.create(R5)].map((b) => nul(C.revaliderResultatClassement(b, PAGES_5))), Array(6).fill('null'), 'T-D3 : « x », {}, [], null, une clé __proto__, une forme portée par le prototype → null');
      // Une règle des titres pour trois lecteurs (S-6, M108) : un titre rendu par la validation est accepté par les deux autres ; refusé par l'un, refusé par tous.
      const verdicts = [];
      for (const T of ['Soupe', 'Soupe\nrôtie', 'é'.repeat(201), 'voir www.exemple.test/x', 'So\u{200B}upe']) {
        const lu = L.validerClassement({ groupes: [{ photos: [1], title: T }] }, { nbPhotos: 1 }).groupes[0].title;
        const rev = (x) => C.revaliderResultatClassement({ groupes: [{ page_ids: ['p1'], title: x, printed_page: null, uncertain: false }], orphelines: [], non_classees: [], partagees: [], uncertain: [] }, ['p1']) !== null;
        const lot = (x) => I.lotDe({ lot: { classement_id: 'imp_c', rang: 1, total: 1, titre: x, page: null } })?.titre === x;
        verdicts.push([lu, lu === null ? null : [rev(lu), lot(lu)], [rev(T), lot(T)]]);
      }
      eq(verdicts, [['Soupe', [true, true], [true, true]], ['Soupe rôtie', [true, true], [false, false]], [null, null, [false, false]], [null, null, [false, false]], ['Soupe', [true, true], [false, false]]], 'T-D3 (M108) : table des titres jugée par validerClassement (après pliage), revaliderResultatClassement et lotDe — un seul prédicat');
      const ligne = { id: 'imp_c', started_at: DATE, resultat: R5, brouillon: null, updated_at: DATE };
      eq([C.cleClassement(ligne) === C.cleClassement({ ...ligne, brouillon: { cle: DATE }, updated_at: NOW }), C.cleClassement(ligne) === C.cleClassement({ ...ligne, started_at: NOW }), C.cleClassement(ligne) === C.cleClassement({ ...ligne, resultat: { ...R5, uncertain: ['x'] } })], [true, false, false], 'T-D3 (M109b) : la clé change avec started_at ou resultat, jamais avec le brouillon ni updated_at');
      eq(C.cleClassement(ligne), JSON.stringify(['imp_c', DATE, R5]), 'T-D3 : la clé = JSON.stringify([id, started_at, resultat]) (gabarit de cleLecture)');
      // Ronde 1 : la racine uncertain, la forme tableau des quatre listes, la borne de 10 pages par groupe et la forme pliée des titres — toute violation
      // → null ; la base `vide1` (valide) ne viole rien.
      const vide1 = { groupes: [grp({})], orphelines: [], non_classees: [], partagees: [], uncertain: [] };
      const sans = (k) => { const o = { ...vide1 }; delete o[k]; return o; };
      const P11 = Array.from({ length: 11 }, (_, i) => 'q' + (i + 1));
      const formes = [vide1, { ...vide1, uncertain: ['voir www.exemple.test/x'] }, { ...vide1, uncertain: ['x'.repeat(201)] }, { ...vide1, uncertain: ['photo\nfloue'] }, { ...vide1, uncertain: Array.from({ length: 41 }, (_, i) => 'doute ' + i) },
        sans('orphelines'), { ...vide1, partagees: 'p1' }, { ...vide1, uncertain: 'x' }, { ...vide1, groupes: [grp({ title: 'Soupe  de courge' })] }];
      // Vague finale (revue de branche, constat 8) : la borne de § 3.1 — une ligne de classement porte 2 à 10 photos ; un résultat relu sur plus de 10
      // page_ids est une altération (rendre 35 figures, et « Lire » allumé sur des octets jamais vérifiés au-delà de la dixième).
      const P35 = Array.from({ length: 35 }, (_, i) => 'r' + (i + 1));
      const trente5 = { groupes: [0, 1, 2].map((k) => grp({ page_ids: P35.slice(k * 10, k * 10 + 10) })), orphelines: P35.slice(30), non_classees: [], partagees: [], uncertain: [] };
      const dix = { groupes: [grp({ page_ids: P35.slice(0, 5) }), grp({ page_ids: P35.slice(5, 10) })], orphelines: [], non_classees: [], partagees: [], uncertain: [] };
      eq([nul(C.revaliderResultatClassement(trente5, P35)), nul(C.revaliderResultatClassement(dix, P35.slice(0, 11))), nul(C.revaliderResultatClassement(dix, P35.slice(0, 10)))], ['null', 'null', 'object'], 'T-D3 (M-borne-photos, vague finale, constat 8) : 3 groupes de 10 et 5 orphelines sur 35 page_ids → null ; 10 pages rangées sur une ligne de 11 page_ids → null (§ 3.1 : 2 à 10 photos) ; 10 page_ids → accepté');
      eq([...formes.map((b) => nul(C.revaliderResultatClassement(b, ['p1']))), nul(C.revaliderResultatClassement({ ...vide1, groupes: [grp({ page_ids: P11 })] }, P11))], ['object', ...Array(9).fill('null')], 'T-D3 (M-f, M-f2, M-f3, M-n, M-gg, ronde 1) : une incertitude racine porteuse d’une adresse, de 201 points de code ou d’un saut de ligne, 41 incertitudes, orphelines absent, partagees ou uncertain non tableau, un titre non plié (double espace), un groupe de 11 pages → null');
    });

    // T-D4 regroupement et brouillon (§ 3.1.1, § 3.6, D-D20)
    await run('T-D4 regroupement et brouillon', async () => {
      const E0 = C.regroupementInitial(R5, PP);
      eq(E0, { groupes: [{ cle: 'g1', page_ids: ['p1', 'p3'], title: 'Soupe de courge', printed_page: 132, uncertain: false, origine: 'classement' }, { cle: 'g2', page_ids: ['p2'], title: 'Tarte fine aux poires', printed_page: 140, uncertain: false, origine: 'classement' }, { cle: 'g3', page_ids: ['p5'], title: 'Gratin dauphinois', printed_page: 148, uncertain: false, origine: 'classement' }], aPart: [{ page_id: 'p4', motif: 'orpheline' }], prochain: 1 }, 'T-D4 : regroupementInitial(CLASSEMENT_5) → g1 [p1, p3], g2 [p2], g3 [p5], p4 à part (orpheline)');
      eq(C.regroupementInitial(R5, new Map(['p1', 'p2', 'p3', 'p4'].map((id) => [id, { id }]))).groupes.map((x) => x.cle), ['g1', 'g2'], 'T-D4 (M30) : une page absente de la Map est écartée, un groupe devenu vide est retiré');
      const E1 = C.deplacerVers(E0, 'p3', 'g2');
      eq([E1.groupes[0].page_ids, E1.groupes[1].page_ids], [['p1'], ['p2', 'p3']], 'T-D4 (M31) : p3 → g2 la DÉPLACE (en fin), jamais une copie');
      const E2 = C.deplacerVers(E0, 'p3', 'nouveau');
      eq([E2.groupes.map((x) => x.cle), E2.groupes.at(-1), E2.prochain], [['g1', 'g2', 'g3', 'n1'], { cle: 'n1', page_ids: ['p3'], title: null, printed_page: null, uncertain: false, origine: 'personne' }, 2], 'T-D4 (M32) : « nouveau » → un groupe n1 en dernier, titre et page nuls, origine personne, prochain + 1');
      const E3 = C.retirerDuGroupe(E0, 'p1');
      eq([E3.groupes[0].page_ids, E3.aPart], [['p3'], [{ page_id: 'p4', motif: 'orpheline' }, { page_id: 'p1', motif: 'retiree' }]], 'T-D4 (M33) : retirer → à part, motif retiree');
      eq(C.deplacerVers(E0, 'p5', 'g1').groupes.map((x) => [x.cle, x.page_ids]), [['g1', ['p1', 'p3', 'p5']], ['g2', ['p2']]], 'T-D4 (M34) : vider g3 le retire');
      const E5 = C.deplacerVers(E0, 'p4', 'g1');
      eq([E5.aPart, E5.groupes[0].page_ids], [[], ['p1', 'p3', 'p4']], 'T-D4 (M35) : de « à part » vers g1 → retirée de aPart');
      eq([C.deplacerVers(E0, 'p1', 'g9'), C.deplacerVers(E0, 'zz', 'g2'), C.deplacerVers(E0, 'p1', 'g1'), C.deplacerVers(E0, 'p4', 'a_part')], [E0, E0, E0, E0], 'T-D4 : cible inconnue, page inconnue ou cible = sa place actuelle → état égal');
      eq([C.bougerDansGroupe(E0, 'g1', 'p3', -1).groupes[0].page_ids, C.bougerDansGroupe(E0, 'g1', 'p1', -1).groupes[0].page_ids, C.bougerDansGroupe(E0, 'g1', 'p3', 1).groupes[0].page_ids, C.bougerDansGroupe(E0, 'g9', 'p3', -1)], [['p3', 'p1'], ['p1', 'p3'], ['p1', 'p3'], E0], 'T-D4 (M36) : monter ; monter en tête et descendre en queue sans effet ; groupe inconnu → égal');
      const geler = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) geler(v); return o; };
      const EG = geler(C.regroupementInitial(R5, PP));
      let leve = null;
      try { C.deplacerVers(EG, 'p3', 'g2'); C.deplacerVers(EG, 'p3', 'nouveau'); C.retirerDuGroupe(EG, 'p1'); C.deplacerVers(EG, 'p4', 'g2'); C.bougerDansGroupe(EG, 'g1', 'p3', -1); C.brouillonDe(EG, new Map([['g1', 'rcS']]), DATE); } catch (e) { leve = e; }
      eq(leve, null, 'T-D4 (M37) : entrées gelées en profondeur — aucune fonction ne modifie son entrée');
      let E = C.deplacerVers(E0, 'p3', 'g2'); E = C.deplacerVers(E, 'p4', 'nouveau'); E = C.bougerDansGroupe(E, 'g2', 'p3', -1);
      const choix = new Map([['g1', null], ['g2', 'rcT'], ['n1', 'rcP']]);
      const BR = C.brouillonDe(E, choix, DATE);
      eq(BR, { cle: DATE, groupes: [{ cle: 'g1', page_ids: ['p1'] }, { cle: 'g2', page_ids: ['p3', 'p2'] }, { cle: 'g3', page_ids: ['p5'] }, { cle: 'n1', page_ids: ['p4'] }], a_part: [], choix: [['g1', null], ['g2', 'rcT'], ['n1', 'rcP']], prochain: 2 }, 'T-D4 : brouillonDe — groupes réduits à { cle, page_ids }, les choix FAITS en paires, aucun titre');
      const ctxB = { resultat: R5, pageIds: PAGES_5, startedAt: DATE, pagesParId: PP };
      const retour = C.restaurerBrouillon(JSON.parse(JSON.stringify(BR)), ctxB);
      eq([retour?.etat, [...(retour?.choixFaits ?? [])]], [E, [...choix]], 'T-D4 (M109) : restaurerBrouillon(brouillonDe(…)) rend le même état et les mêmes choix après déplacements, groupe neuf et choix');
      // Chaque forme ne viole qu'UNE règle (une règle retirée laisse passer sa forme) ; « page hors du classement » est aussi couverte par l'exactitude
      // des pages (règle équivalente, gardée comme forme hostile).
      const sansChoix = (cle) => BR.choix.filter(([c]) => c !== cle);
      const hostiles = [
        ['cle ≠ started_at', { ...BR, cle: NOW }], ['page hors du classement', { ...BR, groupes: [...BR.groupes.slice(0, 3), { cle: 'n1', page_ids: ['pZ'] }] }],
        ['page deux fois', { ...BR, groupes: [{ cle: 'g1', page_ids: ['p1', 'p4'] }, ...BR.groupes.slice(1)] }], ['g4 sans groupe 4', { ...BR, groupes: [BR.groupes[0], BR.groupes[1], { cle: 'g4', page_ids: ['p5'] }, BR.groupes[3]] }],
        ['prochain ≤ n1', { ...BR, prochain: 1 }], ['cle x1', { ...BR, groupes: [{ cle: 'x1', page_ids: ['p1'] }, ...BR.groupes.slice(1)], choix: sansChoix('g1') }],
        ['motif inconnu', { ...BR, a_part: [{ page_id: 'p4', motif: 'x' }], groupes: BR.groupes.filter((g) => g.cle !== 'n1'), choix: sansChoix('n1') }],
        ['choix sur une cle absente', { ...BR, choix: [['g9', 'rcS']] }], ['choix de 81', { ...BR, choix: [['g2', 'x'.repeat(81)]] }], ['deux groupes sur la même référence', { ...BR, choix: [['g1', 'rcS'], ['g2', 'rcS']] }],
        // Vague finale (constat 1) : amendée, jamais retirée (I-D11) — l'oubli d'une ORPHELINE présente n'est plus une violation (elle va à part avec son
        // motif d'origine, ci-dessous) ; l'oubli d'une page présente d'un GROUPE du résultat (p5, g3) en reste une.
        ['clé __proto__', JSON.parse('{"__proto__":{"cle":"x"}}')], ['oublie une page présente d’un groupe du résultat', { ...BR, groupes: [BR.groupes[0], BR.groupes[1], BR.groupes[3]] }],
      ];
      eq(hostiles.map(([nom, b]) => [nom, nul(C.restaurerBrouillon(b, ctxB))]), hostiles.map(([nom]) => [nom, 'null']), 'T-D4 (M110) : un brouillon hostile (douze formes, une règle chacune) → null, l’écran repart du regroupement initial');
      // 11 groupes : seul un contexte de 11 pages le permet sans violer une autre règle (un résultat relu d'une ligne hostile synchronisée : une ligne
      // de l'app n'envoie jamais plus de 10 photos) ; 10 groupes y sont acceptés.
      const P11 = Array.from({ length: 11 }, (_, i) => 'q' + (i + 1));
      const ctx11 = { resultat: { groupes: [{ page_ids: ['q1'], title: 'A', printed_page: null, uncertain: false }], orphelines: P11.slice(1), non_classees: [], partagees: [], uncertain: [] }, pageIds: P11, startedAt: DATE, pagesParId: new Map(P11.map((id) => [id, { id }])) };
      const onzeGroupes = { cle: DATE, groupes: [{ cle: 'g1', page_ids: ['q1'] }, ...P11.slice(1).map((id, i) => ({ cle: 'n' + (i + 1), page_ids: [id] }))], a_part: [], choix: [], prochain: 11 };
      const dixGroupes = { ...onzeGroupes, groupes: onzeGroupes.groupes.slice(0, 10), a_part: [{ page_id: 'q11', motif: 'orpheline' }] };
      eq([nul(C.restaurerBrouillon(onzeGroupes, ctx11)), C.restaurerBrouillon(dixGroupes, ctx11)?.etat.groupes.length ?? null], ['null', 10], 'T-D4 (M110) : 11 groupes → null ; 10 → acceptés (contexte de 11 pages)');
      const titreX = C.restaurerBrouillon({ ...BR, groupes: [{ cle: 'g1', page_ids: ['p1'], title: 'X', printed_page: 999, uncertain: true }, ...BR.groupes.slice(1)] }, ctxB);
      eq([titreX?.etat.groupes[0].title, titreX?.etat.groupes[0].printed_page, titreX?.etat.groupes[0].uncertain], ['Soupe de courge', 132, false], 'T-D4 (M111) : un brouillon qui porterait un titre, une page ou « incertain » n’apporte rien — tout se relit dans resultat');
      // Ronde 1 : les pages non classées, « incertain » gardé, un choix sur un groupe vidé, la garde de n999, quatre formes hostiles de plus.
      const RNC = { ...R5, groupes: [{ ...R5.groupes[0], uncertain: true }, ...R5.groupes.slice(1)], orphelines: [], non_classees: ['p4'] };
      const ENC = C.regroupementInitial(RNC, PP);
      eq([ENC.aPart, ENC.groupes.map((x) => x.uncertain)], [[{ page_id: 'p4', motif: 'non_classee' }], [true, false, false]], 'T-D4 (M-g, M-g2, M-h, ronde 1) : une page non classée est À PART (motif non_classee), jamais perdue ; un groupe incertain le reste');
      const retourNC = C.restaurerBrouillon(JSON.parse(JSON.stringify(C.brouillonDe(ENC, new Map(), DATE))), { ...ctxB, resultat: RNC });
      eq([retourNC?.etat, retourNC ? [...retourNC.choixFaits] : 'null'], [ENC, []], 'T-D4 (M-g, ronde 1) : brouillonDe puis restaurerBrouillon sur un résultat à page non classée rendent le même état');
      const BRv = C.brouillonDe(C.deplacerVers(E0, 'p5', 'g1'), new Map([['g3', 'rcG'], ['g1', 'rcS']]), DATE); // g3 vidé, donc retiré
      eq([BRv.choix, nul(C.restaurerBrouillon(JSON.parse(JSON.stringify(BRv)), ctxB))], [[['g1', 'rcS']], 'object'], 'T-D4 (M-i, ronde 1) : brouillonDe n’écrit que les choix des groupes PRÉSENTS — un choix sur un groupe vidé est omis, et le brouillon se restaure (jamais perdu au remontage)');
      eq(C.deplacerVers({ ...E0, prochain: 1000 }, 'p3', 'nouveau'), { ...E0, prochain: 1000 }, 'T-D4 (M-o, ronde 1) : au-delà de n999, « nouveau » ne crée plus de groupe (n1000 ne se relirait pas) — état égal');
      const hostiles2 = [['prochain 1001', { ...BR, prochain: 1001 }], ['deux groupes g1', { ...BR, groupes: [{ cle: 'g1', page_ids: ['p1'] }, { cle: 'g1', page_ids: ['p3', 'p2'] }, ...BR.groupes.slice(2)], choix: sansChoix('g2') }], ['deux choix pour g1', { ...BR, choix: [['g1', 'rcS'], ['g1', 'rcT']] }]];
      eq(hostiles2.map(([nom, b]) => [nom, nul(C.restaurerBrouillon(b, ctxB))]), hostiles2.map(([nom]) => [nom, 'null']), 'T-D4 (M-p, M-q, M-r, ronde 1) : prochain 1001, deux groupes g1, deux choix pour g1 → null');
      const oubli = C.restaurerBrouillon(JSON.parse(JSON.stringify(C.brouillonDe(E0, new Map([['g3', 'rcG'], ['g1', 'rcS']]), DATE))), { ...ctxB, pagesParId: new Map(['p1', 'p2', 'p3', 'p4'].map((id) => [id, { id }])) });
      eq([oubli?.etat.groupes.map((x) => x.cle), oubli ? [...oubli.choixFaits] : 'null'], [['g1', 'g2'], [['g1', 'rcS']]], 'T-D4 (M-s, ronde 1) : les pages d’un groupe choisi absentes de l’appareil — le groupe est écarté et son choix OUBLIÉ');
      // Vague finale (revue de branche, constat 1 ; D-D20 « « Retirer » … ne perd plus les groupes ») : un brouillon ÉCRIT quand une photo manquait.
      const PP4 = new Map(['p1', 'p2', 'p3', 'p4'].map((id) => [id, { id }]));
      const sans5 = C.bougerDansGroupe(C.deplacerVers(C.regroupementInitial(R5, PP4), 'p3', 'g2'), 'g2', 'p3', -1);
      const choix5 = new Map([['g2', 'rcT']]);
      const r5 = C.restaurerBrouillon(JSON.parse(JSON.stringify(C.brouillonDe(sans5, choix5, DATE))), { ...ctxB, pagesParId: PP4 });
      eq([r5?.etat ?? 'null', r5 ? [...r5.choixFaits] : 'null'], [sans5, [...choix5]], 'T-D4 (M-couverture, vague finale, constat 1) : brouillonDe(état sans p5) puis restaurerBrouillon(pagesParId sans p5) rendent le même état et les mêmes choix — la couverture ne vaut que pour les pages du résultat PRÉSENTES');
      const PPsans4 = new Map(['p1', 'p2', 'p3', 'p5'].map((id) => [id, { id }]));
      const sans4 = C.deplacerVers(C.regroupementInitial(R5, PPsans4), 'p3', 'g2');
      const r4 = C.restaurerBrouillon(JSON.parse(JSON.stringify(C.brouillonDe(sans4, new Map(), DATE))), ctxB);
      eq(r4?.etat ?? 'null', { ...sans4, aPart: [{ page_id: 'p4', motif: 'orpheline' }] }, 'T-D4 (M-orpheline-revenue, vague finale, constat 1) : une orpheline absente à l’écriture du brouillon, présente au remontage → à part avec son motif d’origine (sa place initiale), les groupes gardés');
      const ctx6 = { ...ctxB, pageIds: [...PAGES_5, 'p6'], pagesParId: new Map([...PP, ['p6', { id: 'p6' }]]) };
      eq([nul(C.restaurerBrouillon({ ...BR, a_part: [{ page_id: 'p6', motif: 'retiree' }] }, ctx6)), nul(C.restaurerBrouillon({ ...BR, groupes: [...BR.groupes, { cle: 'n2', page_ids: ['p6'] }], prochain: 3 }, ctx6))], ['null', 'null'], 'T-D4 (M-hors-resultat, vague finale, constat 1) : une page de la ligne que le résultat ne nomme pas (p6), à part ou dans un groupe → null — la couverture relâchée ne laisse entrer aucune page hors du résultat');
    });

    // T-D5 appariement (§ 0 D-D5, § 3.6, B-1, F-2)
    await run('T-D5 appariement', async () => {
      const cand = C.candidatsReference([...REFERENCES_ED, ref('rcZ', 'Soupe de courge', 132, { edition_id: 'ed2' })], { editionId: 'ed1', imports: [IMPORT_RCO] });
      eq(cand.map((r) => r.id), ['rcS', 'rcT', 'rcG', 'rcP', 'rcX'], 'T-D5 (M38) : candidatsReference exclut le signet rcW, l’available rcA, rcO (import ouvert) et une autre édition');
      eq(C.referencesOccupees(REFERENCES_ED, { editionId: 'ed1', imports: [IMPORT_RCO] }).map((r) => r.id), ['rcO'], 'T-D5 (M113) : referencesOccupees rend rcO seule (montrée éteinte, jamais proposée)');
      eq([C.candidatsReference(REFERENCES_ED, { editionId: null, imports: [] }), C.referencesOccupees(REFERENCES_ED, { editionId: null, imports: [IMPORT_RCO] })], [[], []], 'T-D5 : sans édition → aucune candidate');
      eq(C.concordance({ title: 'Tarte fine aux poires', printed_page: 140 }, ref('x', 'Tarte aux poires', 141)), { titre: true, page: true, ecart: 1 }, 'T-D5 (M40) : « Tarte aux poires » ⊂ « Tarte fine aux poires » (une INCLUSION de mots distinctifs, que l’égalité de chaînes refuserait), écart 1 → sûre');
      eq(C.concordance({ title: 'Tarte fine aux poires', printed_page: 140 }, ref('x', 'Tarte aux poires', 143)), { titre: true, page: false, ecart: 3 }, 'T-D5 (M39) : écart 3 → page fausse (± 2, jamais ± 3)');
      eq(C.concordance({ title: 'Tarte fine aux poires', printed_page: 140 }, ref('x', 'Poire rôtie au miel', 140)), { titre: false, page: true, ecart: 0 }, 'T-D5 : « Poire rôtie au miel » contre « Tarte fine aux poires » → titre faux (le cas « titre faux » ; vague finale, constat 12 : il ne tue pas M40 — l’égalité de chaînes le dit faux aussi —, tenu par l’inclusion ci-dessus)');
      eq([C.concordance({ title: 'La Une', printed_page: 5 }, ref('x', 'La Une', 5)).titre, nul(C.concordance({ title: null, printed_page: null }, ref('x', 'Soupe', null)).ecart)], [false, 'null'], 'T-D5 (M45) : une référence sans mot distinctif ne concorde jamais par le titre ; une page inconnue → écart null');
      const G5 = C.regroupementInitial(R5, PP).groupes;
      eq([...C.proposerAppariements(G5, cand)], [['g1', { recipe_id: 'rcS', certitude: 'sure', motif: 'titre_et_page', cochee: true, ordre: ['rcS'] }], ['g2', { recipe_id: 'rcT', certitude: 'sure', motif: 'titre_et_page', cochee: true, ordre: ['rcT'] }], ['g3', { recipe_id: 'rcG', certitude: 'incertaine', motif: 'titre', cochee: false, ordre: ['rcG'] }]], 'T-D5 (M41) : g1 → rcS sûre cochée ; g2 → rcT sûre cochée (rcP, page seule, hors de la meilleure classe) ; g3 → rcG incertaine « titre », décochée');
      const un = (title, printed_page, cle = 'g1') => ({ cle, page_ids: ['p1'], title, printed_page, uncertain: false, origine: 'classement' });
      eq(C.proposerAppariements([un('Tarte aux pommes', 54)], HOMONYMES).get('g1'), { recipe_id: 'rcH1', certitude: 'sure', motif: 'titre_et_page', cochee: true, ordre: ['rcH1'] }, 'T-D5 : HOMONYMES, « Tarte aux pommes » p. 54 → rcH1 sûre cochée');
      eq(C.proposerAppariements([un('Tarte aux pommes', null)], HOMONYMES).get('g1'), { recipe_id: null, certitude: 'incertaine', motif: 'plusieurs', cochee: false, ordre: ['rcH1', 'rcH2'] }, 'T-D5 (M42) : HOMONYMES, page nulle → plusieurs, rien de coché, ordre [rcH1, rcH2] (jamais un homonyme proposé par départage)');
      const deux = C.proposerAppariements([un('Soupe de courge', 132, 'g1'), un('Soupe de courge', 133, 'g2')], cand);
      eq([deux.get('g1'), deux.get('g2')], [{ recipe_id: 'rcS', certitude: 'incertaine', motif: 'conflit', cochee: false, ordre: ['rcS'] }, { recipe_id: 'rcS', certitude: 'incertaine', motif: 'conflit', cochee: false, ordre: ['rcS'] }], 'T-D5 (M43) : deux groupes sûrs sur rcS → conflit pour les deux, décochés');
      eq(C.proposerAppariements([un('Soupe de courge', 132)], [...cand, ref('rcS2', 'Soupe de courge', 133)]).get('g1'), { recipe_id: null, certitude: 'incertaine', motif: 'plusieurs', cochee: false, ordre: ['rcS', 'rcS2'] }, 'T-D5 (M44) : deux sûres pour un groupe → plusieurs, rien de coché (l’écart n’ordonne que le sélecteur)');
      eq(C.proposerAppariements([un(null, 140)], cand).get('g1'), { recipe_id: null, certitude: 'incertaine', motif: 'plusieurs', cochee: false, ordre: ['rcP', 'rcT'] }, 'T-D5 (M112) : groupe sans titre, p. 140 → plusieurs (rcP écart 0, rcT écart 1, toutes deux « page »), ordre [rcP, rcT]');
      eq([...C.proposerAppariements(G5, [])].map(([, p]) => p.certitude), ['aucune', 'aucune', 'aucune'], 'T-D5 : sans édition (aucune candidate) → aucune partout');
      eq(C.proposerAppariements([{ cle: 'n1', page_ids: ['p1'], title: null, printed_page: null, uncertain: false, origine: 'personne' }], cand).get('n1'), { recipe_id: null, certitude: 'aucune', motif: null, cochee: false, ordre: [] }, 'T-D5 : un groupe de la personne (titre et page nuls) → aucune');
      eq([C.filtrerReferences(cand, 'courge').map((r) => r.id), C.filtrerReferences(cand, 'COURGE').map((r) => r.id), C.filtrerReferences(cand, '132').map((r) => r.id), C.filtrerReferences(cand, 'poire').map((r) => r.id), C.filtrerReferences(cand, '').map((r) => r.id)], [['rcS'], ['rcS'], ['rcS'], ['rcP', 'rcT'], ['rcX', 'rcS', 'rcP', 'rcT', 'rcG']], 'T-D5 (M46) : filtrerReferences — texte (casse et accents ignorés), chiffres → page égale ou titre qui les contient ; tri par page croissante');
      // Ronde 1 : les deux clés du départage que T-D5 n'éprouvait pas (D-D5 ; § 12.0 de la rév. 4), et la borne de ± 2.
      eq(C.proposerAppariements([un('Tarte aux poires', 140)], [ref('rA', 'Tarte aux poires', null), ref('rB', 'Tarte aux poires', 150)]).get('g1').ordre, ['rB', 'rA'], 'T-D5 (MR-ordre-inconnu-premier, ronde 1) : une classe qui mêle un écart connu (10) et un écart inconnu (page nulle) → l’inconnu en DERNIER');
      eq(C.proposerAppariements([un('Tarte fine aux poires', 140)], [ref('rL', 'Tarte aux poires', 139), ref('rM', 'Tarte fine aux poires', 141)]).get('g1').ordre, ['rM', 'rL'], 'T-D5 (MR-ordre-sans-mots, M-nn, ronde 1) : deux sûres de même écart → le titre de référence le plus long en mots distinctifs d’abord (« tarte fine poires » avant « tarte poires »), avant la page');
      eq([C.PROCHE_PAGE, C.concordance({ title: 'Tarte aux poires', printed_page: 140 }, ref('x', 'Tarte aux poires', 142))], [2, { titre: true, page: true, ecart: 2 }], 'T-D5 (M-j, CTRL-1, ronde 1) : PROCHE_PAGE = 2, et un écart de 2 exactement est « page » (± 2 inclus)');
    });

    // T-D6 lecturesDuLot et la fabrique (§ 3.3, § 3.4, D-D12)
    await run('T-D6 lecturesDuLot et la fabrique', () => withRepo(async (repo) => {
      let n = 0; const newId = (p) => `${p}_${++n}`;
      const classement = { id: 'imp_cl', page_ids: PAGES_5 };
      const E0 = C.regroupementInitial(R5, PP);
      const choix = new Map([['g1', 'rcS'], ['g2', 'rcT'], ['g3', null]]);
      const { lignes, references } = C.lecturesDuLot(E0, choix, { classement, editionId: 'ed1', sessionId: 'ss1', deviceId: 'dev1', newId, pagesParId: PP });
      eq(lignes[0], { id: 'imp_1', kind: 'recette', edition_id: 'ed1', recipe_id: 'rcS', scan_session_id: 'ss1', page_ids: ['p1', 'p3'], photo_sha256: null, status: 'a_lancer', erreur: null, resultat: null, reponse_brute: null, appels: 0, model: null, duree_ms: null, device_id: 'dev1', document_id_vol: null, battement_at: null, started_at: null, finished_at: null, lot: { classement_id: 'imp_cl', rang: 1, total: 3, titre: 'Soupe de courge', page: 132 } }, 'T-D6 : la première ligne exacte (forme du lot A + lot)');
      eq([lignes.map((l) => [l.recipe_id, l.page_ids, l.lot.rang, l.lot.total, l.lot.titre, l.lot.page]), references], [[['rcS', ['p1', 'p3'], 1, 3, 'Soupe de courge', 132], ['rcT', ['p2'], 2, 3, 'Tarte fine aux poires', 140], [null, ['p5'], 3, 3, 'Gratin dauphinois', 148]], ['rcS', 'rcT']], 'T-D6 : trois lignes dans l’ordre des groupes ; references = les recipe_id non nuls');
      const ouverte = await repo.ouvrirImport({ id: 'imp_forme', kind: 'recette', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p1'] });
      const { lot: _lot, ...sansLot } = lignes[0];
      const { created_at: _c, updated_at: _u, ...ecrite } = ouverte;
      eq(Object.keys(sansLot), Object.keys(ecrite), 'T-D6 (M114) : une ligne de lot privée de « lot » a exactement les clés de la ligne que repo.ouvrirImport écrit (une seule forme)');
      eq(I.ligneImportNeuve({ id: 'imp_forme', kind: 'recette', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p1'], device_id: repo.deviceId() }), ecrite, 'T-D6 : ligneImportNeuve et la ligne écrite par repo.ouvrirImport ont la même forme (après délégation, une seule définition : comparaison de forme commune ; l’ancrage est le littéral à 19 champs de la première ligne)');
      const sansP2 = C.lecturesDuLot(E0, choix, { classement, editionId: 'ed1', sessionId: 'ss1', deviceId: 'dev1', newId, pagesParId: new Map(['p1', 'p3', 'p4', 'p5'].map((id) => [id, { id }])) });
      eq(sansP2.lignes.map((l) => [l.recipe_id, l.lot.rang, l.lot.total]), [['rcS', 1, 2], [null, 2, 2]], 'T-D6 (M47) : un groupe dont toutes les pages ont disparu n’est pas créé ; rang et total comptés sur les seules lignes créées');
      eq(raison(() => C.lecturesDuLot(E0, new Map([['g1', 'rcS'], ['g2', 'rcS']]), { classement, editionId: 'ed1', sessionId: 'ss1', deviceId: 'dev1', newId, pagesParId: PP }))[0], 'TypeError', 'T-D6 (M48) : deux groupes sur rcS → TypeError (défaut de programme)');
      eq([raison(() => C.lecturesDuLot(E0, choix, { classement: { id: 'imp_cl', page_ids: ['p1', 'p2', 'p3', 'p4'] }, editionId: 'ed1', sessionId: 'ss1', deviceId: 'dev1', newId, pagesParId: PP }))[0], raison(() => C.lecturesDuLot({ ...E0, groupes: [E0.groupes[0], { ...E0.groupes[1], page_ids: ['p2', 'p1'] }] }, new Map(), { classement, editionId: 'ed1', sessionId: 'ss1', deviceId: 'dev1', newId, pagesParId: PP }))[0]], ['TypeError', 'TypeError'], 'T-D6 (M115) : une page hors classement.page_ids, ou une page dans deux groupes → TypeError');
      let e = null; try { I.ligneImportNeuve({ id: 'imp_x', kind: 'cover' }); } catch (x) { e = x; }
      eq([e?.name, e?.champ, e?.valeur], ['ErreurVocabulaire', 'kind', 'cover'], 'T-D6 (M49) : ligneImportNeuve d’une sorte hors liste lève (par comportement)');
      const sansCommentaires = (s) => s.replace(/\/\/.*$/gm, '');
      ok(/ligneImportNeuve\(/.test(sansCommentaires(await lire('../src/domain/classement.js'))), 'T-D6 (M49b, test de source faible, admis) : src/domain/classement.js appelle ligneImportNeuve( hors commentaire');
      // Ronde 1 : deviceId OUBLIÉ (comme fabriquerImportWeb du lot B) ; page_ids copiés par la fabrique.
      eq([raison(() => C.lecturesDuLot(E0, choix, { classement, editionId: 'ed1', sessionId: 'ss1', newId, pagesParId: PP }))[0], C.lecturesDuLot(E0, choix, { classement, editionId: 'ed1', sessionId: 'ss1', deviceId: null, newId, pagesParId: PP }).lignes.map((l) => nul(l.device_id))], ['TypeError', ['null', 'null', 'null']], 'T-D6 (M-device, ronde 1) : lecturesDuLot sans deviceId (undefined) → TypeError (jamais N lignes nées sans appareil, sans reprise) ; un null explicite reste admis');
      const pids = ['p1']; const neuveA = I.ligneImportNeuve({ id: 'imp_alias', kind: 'recette', page_ids: pids }); pids.push('p2');
      eq(neuveA.page_ids, ['p1'], 'T-D6 (M-lig, ronde 1) : ligneImportNeuve COPIE page_ids (muter l’entrée après l’appel ne change pas la ligne)');
    }));

    // T-D7 lotDe, progressionLots, suiteDuLot, pagesEnCours, statutSeanceApres, issueDUneSeance (§ 3.3, § 3.6, D-D10, N-1)
    await run('T-D7 lot, progression, suite, pages en cours, statut de séance', async () => {
      const lotOk = { classement_id: 'imp_c', rang: 1, total: 3, titre: 'Soupe', page: 132 };
      eq(I.lotDe({ lot: lotOk }), lotOk, 'T-D7 : lotDe rend l’objet construit');
      const hostiles = [{ ...lotOk, rang: 0 }, { ...lotOk, total: 11 }, { ...lotOk, rang: 3, total: 2 }, { ...lotOk, classement_id: '' }, { ...lotOk, classement_id: 'x'.repeat(81) }, [lotOk], null, 'x'];
      eq(hostiles.map((lot) => nul(I.lotDe({ lot }))), hostiles.map(() => 'null'), 'T-D7 (M50) : rang 0, total 11, rang > total, classement_id vide ou de 81, un tableau, null, une chaîne → null (la ligne se comporte comme une ligne du lot A)');
      eq([I.lotDe({ lot: { ...lotOk, titre: 'é'.repeat(201) } }), I.lotDe({ lot: { ...lotOk, titre: 'voir www.exemple.test/x' } }), I.lotDe({ lot: { ...lotOk, titre: 'a\nb' } }), I.lotDe({ lot: { ...lotOk, page: 0 } })], [{ ...lotOk, titre: null }, { ...lotOk, titre: null }, { ...lotOk, titre: null }, { ...lotOk, page: null }], 'T-D7 (M50b) : un titre de 201, porteur d’une adresse ou d’un saut de ligne, une page 0 → CE champ null, le lot gardé');
      eq([I.lotDe({}), I.lotDe(null), I.lotDe({ lot: Object.create(lotOk) })].map(nul), ['null', 'null', 'null'], 'T-D7 : sans lot, ligne nulle, lot porté par le prototype → null');
      const lig = (id, status, over = {}) => ({ id, kind: 'recette', status, device_id: 'dev1', edition_id: 'ed1', lot: { classement_id: 'imp_c', rang: 1, total: 3, titre: null, page: null }, ...over });
      eq([...C.progressionLots([lig('a', 'a_verifier'), lig('b', 'enregistre'), lig('c', 'echec'), lig('d', 'a_lancer'), lig('e', 'a_lancer', { device_id: 'dev2' }), lig('f', 'ignore'), { id: 'g', kind: 'recette', status: 'a_lancer', device_id: 'dev1' }], { deviceId: 'dev1' })], [['imp_c', { total: 3, lues: 2, echecs: 1, ignorees: 1, restantes: 2, restantesIci: 1, ouvertes: 4, edition_id: 'ed1' }]], 'T-D7 (M51, M52) : lues = a_verifier + enregistre ; restantesIci ignore un autre appareil ; ouvertes = statuts non terminaux ; une ligne sans lot ignorée');
      for (const r of I.RAISONS_ECHEC) eq(C.suiteDuLot({ issue: 'echec', raison: r }, { erreur: { raison: r, extra: {} } }), C.RAISONS_SUITE_LOT.includes(r) ? 'continuer' : 'arreter', `T-D7 (M53) : echec(${r}) — liste vivante RAISONS_ECHEC, défaut fermé`);
      eq(C.suiteDuLot({ issue: 'echec', raison: 'xyz' }, null), 'arreter', 'T-D7 (M53) : une raison inconnue arrête (défaut fermé)');
      eq([C.suiteDuLot({ issue: 'echec', raison: 'requete' }, { erreur: { raison: 'requete', extra: { trop_lourd: true } } }), C.suiteDuLot({ issue: 'echec', raison: 'requete' }, { erreur: { raison: 'requete', extra: {} } })], ['continuer', 'arreter'], 'T-D7 (M116) : requete avec trop_lourd (relue sur la ligne) → continuer ; sans → arrêter (un 400 relayé fait arrêter)');
      eq(C.suiteDuLot({ issue: 'echec', raison: 'reponse_illisible' }, { erreur: { raison: 'reponse_illisible', extra: {} } }), 'arreter', 'T-D7 (M117) : reponse_illisible → arrêter');
      eq([C.RAISONS_SUITE_LOT, C.RAISONS_SUITE_LOT.every((r) => I.RAISONS_ECHEC.includes(r))], [['coupe', 'illisible', 'hors_bornes', 'vide'], true], 'T-D7 : RAISONS_SUITE_LOT exacte et ⊂ RAISONS_ECHEC');
      eq(['vol_tenu', 'hors_ligne', 'non_connecte', 'inconnu', 'transition', 'sans_page', 'image', 'octets_absents', 'sorte', 'xyz'].map((raison) => C.suiteDuLot({ issue: 'refuse', raison }, null)), ['arreter', 'arreter', 'arreter', 'sauter', 'sauter', 'sauter', 'sauter', 'sauter', 'sauter', 'arreter'], 'T-D7 (M54) : refus — vol_tenu, hors_ligne, non_connecte arrêtent ; les six de REFUS_SAUT_LOT sautent ; un refus inconnu arrête');
      eq([C.suiteDuLot({ issue: 'a_verifier' }, null), C.suiteDuLot({ issue: 'autre' }, null), C.suiteDuLot(null, null)], ['continuer', 'arreter', 'arreter'], 'T-D7 : a_verifier continue ; toute autre issue arrête');
      const imps = [{ id: 'c', kind: 'classement', status: 'a_verifier', scan_session_id: 'ss1', page_ids: ['p1', 'p2'] }, { id: 'r', kind: 'recette', status: 'a_lancer', scan_session_id: 'ss1', page_ids: ['p3'] }, { id: 'x', kind: 'recette', status: 'a_lancer', scan_session_id: 'ss2', page_ids: ['p4'] }, { id: 'e', kind: 'recette', status: 'enregistre', scan_session_id: 'ss1', page_ids: ['p5'] }];
      eq([[...C.pagesEnCours(imps, 'ss1')].sort(), [...C.pagesEnCours(imps, 'ss1', { sauf: 'c' })]], [['p1', 'p2', 'p3'], ['p3']], 'T-D7 (M55, M118) : les page_ids des imports OUVERTS de CETTE séance, toute sorte, sans la ligne « sauf »');
      const pp = new Map([['p1', { id: 'p1', kind: 'index' }], ['p2', { id: 'p2', role: 'recette' }], ['p3', { id: 'p3', kind: null }]]);
      eq(I.statutSeanceApres({ status: 'open', page_ids: ['p1', 'p2', 'p3'] }, pp, new Set(['p3'])), 'done', 'T-D7 (M121) : toutes les photos ont un rôle (kind, role, ou écrite par la transaction) → done');
      eq([I.statutSeanceApres({ status: 'open', page_ids: ['p1', 'p2', 'p3'] }, pp, new Set()), I.statutSeanceApres({ status: 'done', page_ids: ['p1', 'p2', 'p3'] }, pp, new Set())], ['open', 'done'], 'T-D7 (M120) : une photo sans rôle → statut INCHANGÉ (open comme done), jamais forcé');
      eq(I.statutSeanceApres({ status: 'open', page_ids: ['p1', 'p2', 'p9'] }, pp, new Set()), 'open', 'T-D7 (M159) : une page absente de la Map relue (ajoutée entre-temps) compte comme sans rôle');
      eq([I.statutSeanceApres({ status: 'open', page_ids: ['p4'] }, new Map([['p4', { id: 'p4', role: '', kind: null }]]), new Set()), I.statutSeanceApres({ status: 'open' }, pp, new Set())], ['open', 'done'], 'T-D7 : role vide et kind nul → sans rôle ; page_ids absent → done');
      eq([I.issueDUneSeance({ scan_session_id: 'ss1' }), I.issueDUneSeance({ scan_session_id: null }), I.issueDUneSeance({ scan_session_id: '' }), I.issueDUneSeance({}), I.issueDUneSeance({ scan_session_id: 7 }), I.issueDUneSeance({ scan_session_id: 'ss1', lot: null })], [true, false, false, false, false, true], 'T-D7 (M160) : issueDUneSeance — scan_session_id chaîne non vide, jamais lu sur lot');
      // Ronde 1 : bornes et formes de lotDe, total d'un lot, `ecrites` en tableau, REFUS_ARRET_LOT épinglée.
      eq([I.lotDe({ lot: { ...lotOk, rang: 10, total: 10 } }), I.lotDe({ lot: { ...lotOk, classement_id: 'x'.repeat(80) } }), nul(I.lotDe(Object.create({ lot: lotOk }))), I.lotDe({ lot: { ...lotOk, titre: 'Soupe\u{00A0}de courge' } })], [{ ...lotOk, rang: 10, total: 10 }, { ...lotOk, classement_id: 'x'.repeat(80) }, 'null', { ...lotOk, titre: null }], 'T-D7 (M-z, M-y, M-x, ronde 1) : rang = total = 10 gardé ; un classement_id de 80 points de code gardé ; un lot porté par le prototype de la LIGNE → null ; un titre non plié (insécable) → titre null, le lot gardé');
      eq([...C.progressionLots([lig('a', 'a_lancer'), lig('b', 'a_lancer', { lot: { classement_id: 'imp_c', rang: 2, total: 2, titre: null, page: null } })], { deviceId: 'dev1' })].map(([k, p]) => [k, p.total]), [['imp_c', 3]], 'T-D7 (M-ll, ronde 1) : total = le plus grand lot.total lu (3 puis 2 → 3), jamais le dernier');
      eq(I.statutSeanceApres({ status: 'open', page_ids: ['p1', 'p2', 'p3'] }, pp, ['p3']), 'done', 'T-D7 (MR-statut-ecrites-tableau, ronde 1) : `ecrites` admis aussi en tableau');
      eq([C.REFUS_ARRET_LOT, Object.isFrozen(C.REFUS_ARRET_LOT)], [['vol_tenu', 'hors_ligne', 'non_connecte'], true], 'T-D7 (ronde 1) : REFUS_ARRET_LOT épinglée — liste DOCUMENTAIRE (spec § 3.6), sans effet sur suiteDuLot, dont le défaut fermé arrête');
    });

    // T-D8 vocabulaire, fabrique, sac conditions, règle des titres (§ 3.4, D-D12, D-D17, D-D11)
    await run('T-D8 vocabulaire et primitives', () => withRepo(async (repo, db) => {
      const S = await import('../src/model/schema.js');
      const V = await import('../src/domain/vocabulaire.js');
      eq(S.SORTES_IMPORT, ['recette', 'index', 'web', 'couverture', 'classement', 'livre', 'thermomix', 'reperes', 'traduction'], 'T-D8 / I2 / L6 : SORTES_IMPORT exact, traduction ajoutée');
      const champ = (fiche) => { try { V.assertVocabulaire(fiche, 'imports'); return 'acceptée'; } catch (e) { return [e?.name, e?.champ]; } };
      eq([champ({ status: 'a_lancer' }), champ({ id: 'imp' }), champ({ status: 'a_lancer', kind: 'cover' }), champ({ status: 'a_lancer', kind: 'classement' })], [['ErreurVocabulaire', 'kind'], ['ErreurVocabulaire', 'status'], ['ErreurVocabulaire', 'kind'], 'acceptée'], 'T-D8 (M56) : la sorte est obligatoire et fermée, vérifiée APRÈS le statut');
      const ouverte = await repo.ouvrirImport({ kind: 'classement', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p1', 'p2'] });
      const relue = await db.get('imports', ouverte.id);
      eq([relue?.kind, relue?.status, relue?.page_ids, relue?.recipe_id], ['classement', 'a_lancer', ['p1', 'p2'], null], 'T-D8 (M57) : repo.ouvrirImport({ kind: classement }) écrit la ligne');
      const neuve = I.ligneImportNeuve({ id: 'imp_neuve', kind: 'recette', recipe_id: 'rcS', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p1'], device_id: repo.deviceId() });
      await db.mutate({ puts: { imports: [{ ...relue, id: 'imp_main', status: 'a_verifier' }, { ...relue, id: 'imp_main2', status: 'a_verifier' }] }, origin: 'device' });
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push(Object.keys(m.puts).sort()); return capture ? capture(m) : {}; };
      try {
        await repo.transitionner('imports', 'imp_main', { attendus: ['a_verifier'], patch: { status: 'enregistre' }, puts: { imports: [neuve] }, conditions: { imports: [{ key: 'imp_neuve', absente: true }, { index: 'recipe_id', valeur: 'rcS', exclus: I.IMPORTS_OUVERTS }] } });
      } finally { db.onMutate = capture; }
      eq([vus, (await db.get('imports', 'imp_main')).status, (await db.get('imports', 'imp_neuve'))?.status], [[['imports']], 'enregistre', 'a_lancer'], 'T-D8 (M58, M60) : un sac sur le MÊME magasin — la ligne est patchée ET la ligne neuve écrite, en un appel de db.onMutate ; les formes absente et index passent telles quelles');
      let refus = null;
      try { await repo.transitionner('imports', 'imp_main2', { attendus: ['a_verifier'], patch: { status: 'enregistre' }, puts: { imports: [neuve] }, conditions: { imports: [{ key: 'imp_neuve', absente: true }] } }); } catch (e) { refus = e; }
      eq([refus?.name, refus?.key, (await db.get('imports', 'imp_main2')).status], ['TransitionRefusee', 'imp_neuve', 'a_verifier'], 'T-D8 : une « absente » sur un identifiant existant → TransitionRefusee, rien d’écrit, la ligne principale intacte');
      refus = null;
      try { await repo.transitionner('imports', 'imp_main2', { attendus: ['a_verifier'], patch: { status: 'enregistre' }, puts: { imports: [{ ...neuve, id: 'imp_neuve3' }] }, conditions: { imports: [{ key: 'imp_neuve3', absente: true }, { index: 'recipe_id', valeur: 'rcS', exclus: I.IMPORTS_OUVERTS }] } }); } catch (e) { refus = e; }
      eq([refus?.name, (await db.get('imports', 'imp_neuve3')) ?? null, (await db.get('imports', 'imp_main2')).status], ['TransitionRefusee', null, 'a_verifier'], 'T-D8 (M59) : une condition d’index sur une référence à import ouvert → refus, rien d’écrit');
      eq([B.plierUneLigne('Soupe de courge\nrôtie'), B.plierUneLigne('  a\u{2028}b\tc  '), B.plierUneLigne(7)], ['Soupe de courge rôtie', 'a b c', ''], 'T-D8 (M119b) : plierUneLigne — tout blanc devient une espace, puis trim ; pas une chaîne → chaîne vide');
      eq(['x', 'é'.repeat(200), 'é'.repeat(201), '', ' a', 'a ', 'a\nb', 'a\u{2028}b', 'a\tb', 'Le\u{200B}sel', 'voir www.exemple.test/x', 'sur evil.com', 7, null].map((s) => B.estTitreUneLigne(s, 200)), [true, true, false, false, false, false, false, false, false, false, false, false, false, false], 'T-D8 (M119b, M7) : estTitreUneLigne — une ligne, 1..200 points de code, égale à son trim, sans Cc/Cf/U+2028, sans adresse (« voir www.exemple.test/x », « sur evil.com » : M7)');
      eq([B.estTitreUneLigne('abc', 2), B.estTitreUneLigne('ab', 2), B.estTitreUneLigne('a', 0)], [false, true, false], 'T-D8 : la borne est un paramètre (max < 1 → faux)');
      // Ronde 1 (R-D-14) : sur le magasin de la transition, la garde n'admet que des listes FAITES de formes sans fiche — un sac mixte, une condition de
      // fusion, ou une « absente » qui ne vaut pas exactement true et porte une condition à clé → TypeError avant toute écriture.
      const avantMain2 = await db.get('imports', 'imp_main2'), avantMain = await db.get('imports', 'imp_main');
      const refusSac = async (sac) => { try { await repo.transitionner('imports', 'imp_main2', { attendus: ['a_verifier'], patch: { status: 'enregistre' }, conditions: { imports: sac } }); return 'acceptée'; } catch (e) { return e?.name; } };
      const verdictsSac = [];
      for (const sac of [[{ key: 'imp_neuve4', absente: true }, { key: 'imp_main', attendus: ['enregistre'] }], [{ key: 'imp_main', fusion: (c) => ({ ...c, note: 'x' }) }], [{ key: 'imp_main', absente: false, attendus: ['enregistre'], patch: { note: 'x' } }], [{ key: 'imp_main', absente: 1, attendus: ['enregistre'], patch: { note: 'x' } }]]) verdictsSac.push(await refusSac(sac));
      eq([verdictsSac, await db.get('imports', 'imp_main2'), await db.get('imports', 'imp_main'), (await db.get('imports', 'imp_neuve4')) ?? 'absente'], [Array(4).fill('TypeError'), avantMain2, avantMain, 'absente'], 'T-D8 (MR-some, M-t, MR-fusion-admise, MR-absente-lache, ronde 1) : sur le magasin de la transition, un sac MIXTE (absente + condition à clé), une condition { key, fusion }, une « absente » qui vaut false ou 1 avec une condition à clé → TypeError, RIEN d’écrit (la ligne et l’autre fiche relues identiques)');
      eq(['a\u{D800}b', 'a\u{2029}b', 'Soupe  de courge', 'Soupe\u{00A0}de courge', 'Soupe\u{2003}de courge', 'Soupe de courge'].map((s) => B.estTitreUneLigne(s, 200)), [false, false, false, false, false, true], 'T-D8 (M-k, M-l, ronde 1) : estTitreUneLigne refuse une demi-paire de substitution (Cs) et U+2029, et exige la forme PLIÉE (double espace, insécable, U+2003 → faux) — un titre relu que validerClassement ne produirait jamais est refusé');
      eq(B.plierUneLigne('a \n\t b'), 'a b', 'T-D8 (M-v, ronde 1) : plierUneLigne — une SUITE de blancs devient UNE espace');
    }));

    // T-D9 (partie domaine) ligneOuverteDeSeance et la sorte (§ 4.1)
    await run('T-D9 ligneOuverteDeSeance par sorte', async () => {
      const T = await import('../src/domain/table-matieres.js');
      const lignes = [{ id: 'i1', kind: 'index', scan_session_id: 'ss1', status: 'a_verifier', updated_at: '2026-10-19T10:00:00Z', page_ids: [] }, { id: 'c1', kind: 'classement', scan_session_id: 'ss1', status: 'echec', updated_at: '2026-10-19T11:00:00Z', page_ids: [] }, { id: 'c2', kind: 'classement', scan_session_id: 'ss1', status: 'ignore', updated_at: '2026-10-19T12:00:00Z', page_ids: [] }];
      eq([T.ligneOuverteDeSeance(lignes, 'ss1')?.id, T.ligneOuverteDeSeance(lignes, 'ss1', { kind: 'classement' })?.id, T.ligneOuverteDeSeance(lignes, 'ss1', { importId: 'i1', kind: 'classement' })?.id, T.ligneOuverteDeSeance(lignes, 'ss1', { importId: 'c1' })?.id, nul(T.ligneOuverteDeSeance(lignes, 'ss2', { kind: 'classement' }))], ['i1', 'c1', 'c1', 'i1', 'null'], 'T-D9 (M61) : la sorte est lue — une ligne d’index n’est pas rendue pour kind classement, et l’inverse ; défaut index inchangé ; une ligne terminale jamais');
    });

    // T-D10 (partie domaine) « Imports » : sorte classement, lot, reprise, séance du lot, blocs (§ 4.7, D-D11, D-D14)
    await run('T-D10 Imports, domaine', async () => {
      const ctxL = (imports) => ({ imports, scan_sessions: [], recipesById: new Map([['rcS', { id: 'rcS', edition_id: 'ed1', original_title: 'Soupe de courge' }]]), editionsById: new Map([['ed1', { id: 'ed1', book_id: 'b1' }]]), booksById: new Map([['b1', { id: 'b1', title: 'Saisons' }]]) });
      const opts = { maintenant: NOW, documentId: 'doc1', deviceId: 'dev1' };
      const cl = (over = {}) => ({ id: 'imp_cl', kind: 'classement', edition_id: 'ed1', recipe_id: null, scan_session_id: 'ss1', page_ids: ['p1', 'p2'], status: 'a_verifier', erreur: null, resultat: R5, device_id: 'dev1', document_id_vol: null, updated_at: NOW, ...over });
      const un = (l) => I.lignesImports(ctxL([l]), opts)[0];
      eq([un(cl()).titre, un(cl()).cible, un(cl()).gestes, un(cl()).lot], [{ type: 'classement', texte: null, livre: 'Saisons' }, '/import?session=ss1&import=imp_cl', ['reprendre', 'ignorer'], null], 'T-D10 : un classement est listé — type classement, reprise dans sa séance, Reprendre et Ignorer');
      eq([un(cl({ status: 'echec', erreur: { raison: 'coupe', extra: {} } })).gestes, un(cl({ status: 'a_lancer', resultat: null })).gestes], [['reprendre', 'ignorer'], ['reprendre', 'ignorer']], 'T-D10 (M62) : un classement en échec ou à lancer → Reprendre et Ignorer, JAMAIS Relancer depuis Imports');
      eq([un(cl({ device_id: 'dev2', status: 'a_lancer', resultat: null })).gestes, un(cl({ device_id: 'dev2' })).gestes, un(cl({ device_id: 'dev2', status: 'echec', resultat: null })).gestes], [['ignorer'], ['reprendre', 'ignorer'], ['ignorer']], 'T-D10 (D-D24) : autre appareil sans résultat → Ignorer seul ; avec un résultat reçu → Reprendre (les octets sont vérifiés dans la séance)');
      eq([un(cl({ status: 'en_cours', document_id_vol: 'doc1' })).gestes, un(cl({ status: 'en_cours', document_id_vol: 'doc2' })).gestes], [['annuler'], []], 'T-D10 : en vol → Annuler si CE document le tient, rien sinon');
      eq([nul(I.cibleReprise(cl({ scan_session_id: null }))), I.cibleReprise(cl({ id: 'imp&1', scan_session_id: 'ss&1' }))], ['null', '/import?session=ss%261&import=imp%261'], 'T-D10 : cibleReprise d’un classement sans séance → null ; identifiants encodés');
      const lotL = { id: 'imp_r', kind: 'recette', recipe_id: null, edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p5'], status: 'a_lancer', erreur: null, resultat: null, device_id: 'dev1', document_id_vol: null, updated_at: NOW, lot: { classement_id: 'imp_cl', rang: 3, total: 3, titre: 'Gratin dauphinois', page: 148 } };
      eq([un(lotL).lot, un(lotL).titre.type, un({ ...lotL, lot: { rang: 0 } }).lot], [lotL.lot, 'regrouper', null], 'T-D10 : une ligne de lot porte lot (revalidé par lotDe) ; sans référence, elle garde le type regrouper');
      eq([I.seanceDUnImportCible({ id: 'ss1' }, [{ ...lotL, recipe_id: 'rcS' }]), I.seanceDUnImportCible({ id: 'ss1' }, [{ ...lotL, recipe_id: 'rcS', lot: undefined }])], [false, true], 'T-D10 (M63) : une ligne à recipe_id ET lot ne cache pas sa séance ; sans lot, le lot A inchangé');
      const A1 = { id: 'a', lot: { classement_id: 'c1', rang: 2, total: 2 } }, A2 = { id: 'b', lot: null }, A3 = { id: 'c', lot: { classement_id: 'c1', rang: 1, total: 2 } }, A4 = { id: 'd', lot: { classement_id: 'c2', rang: 1, total: 1 } };
      eq(C.blocsImports([A2, A1, A4, A3]), [{ type: 'ligne', ligne: A2 }, { type: 'lot', classementId: 'c1', lignes: [A3, A1] }, { type: 'lot', classementId: 'c2', lignes: [A4] }], 'T-D10 (M64) : blocsImports réunit les lignes d’un lot à la place de la plus récente (la première rencontrée), triées par rang ; les autres gardent leur place');
      const avecSeance = I.lignesImports({ ...ctxL([]), scan_sessions: [{ id: 'ss9', status: 'open', edition_id: 'ed1', page_ids: ['p1'], device_id: 'dev1', started_at: NOW, updated_at: NOW }] }, opts);
      eq(avecSeance.map((l) => [l.kind, nul(l.lot)]), [['seance', 'null']], 'T-D10 (MR-seance-sans-lot, ronde 1) : une ligne de SÉANCE porte lot: null (lu par son type, jamais par un tableau de null)');
    });

    // =================================================================================================================================
    // Tâche 2 — le panneau « Classement » de la séance (§ 4.2) : T-D11 bouton, T-D12 classement, T-D9 (écran), T-D10 (écran). Montage par la route
    // (renderImport à quatre paramètres, D-D13) ou par le panneau seul ; fetch, confirmer, navigate et toast injectés ; aucune scène partagée.
    const G = await import('../src/ui/regroupement.js');
    const UI = await import('../src/ui/import-cible.js');
    const IM = await import('../src/ui/import.js');
    const AD = await import('../src/ui/add.js');
    const navs = [], dits = [], confirmations = [];
    let reponseConfirmer = true;
    const deps = (repo, over = {}) => ({ repo, toast: (m) => dits.push(m), navigate: (p) => navs.push(p), confirmer: async (message, o) => { confirmations.push([message, o?.okLabel ?? null]); return reponseConfirmer; }, maintenant: () => NOW, ...over });
    const scene = nouvelleScene();
    const monterSeance = async (repo, db, { query = { session: 'ss1' }, over = {}, session = SESSION } = {}) => { const racine = await IM.renderImport({}, query, await ctxDe(repo, db, { session }), deps(repo, over)); scene.append(racine); return racine; };
    // Chaque bloc part d'une scène vide, d'une base jetable, de journaux vides, sans vol ni lot tenus, en ligne ; une fetch GLOBALE qui lève attrape tout appel
    // non injecté (les écrans de D reçoivent toujours `fetch`).
    const ecran = (nom, fn) => run('écran — ' + nom, () => withRepo(async (repo, db) => {
      scene.replaceChildren(); navs.length = 0; dits.length = 0; confirmations.length = 0; reponseConfirmer = true;
      const vraiFetch = globalThis.fetch;
      globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try { await fn(repo, db); }
      // Ronde 1 : la vraie fetch est rendue D'ABORD — une réinitialisation qui lèverait ne laisse jamais le piège posé pour les suites suivantes.
      finally { for(const n of scene.querySelectorAll('.editeur-recette'))n.dispose?.();globalThis.fetch = vraiFetch; UI.reinitialiserImportCible(); G.reinitialiserLot(); window.dispatchEvent(new Event('online')); }
    }));
    // Ronde 1 (faux-vert, constat 3) : éprouver une garde de classer() derrière un bouton éteint ou un rendu périmé — le nœud est RALLUMÉ, cliqué, puis le
    // redessin de la barre attendu (classer() finit toujours par synchroniser({ forcer: true }) : au redessin, il est sorti — R-D-10, un fait, pas des ticks).
    const rallumerEtCliquer = async (racine) => { const b = classerBtn(racine); b.disabled = false; b.click(); await attendre(() => classerBtn(racine) !== b, 'barre redessinée : classer() est sorti'); };
    const lignesClassement = async (db) => (await db.getAll('imports')).filter((i) => i.kind === 'classement').length;

    await ecran('T-D11 bouton : une, deux et onze photos cochées', async (repo, db) => {
      const ONZE = Array.from({ length: 11 }, (_, i) => 'p' + (i + 1));
      await poserSeance(repo, db, { pages: ONZE, octets: false });
      let lectures = 0; const ff = fauxFetch();
      const espion = { ...repo, getFile: async (sha) => { lectures += 1; return repo.getFile(sha); } };
      const racine = await monterSeance(repo, db, { over: { repo: espion, fetch: ff.fetch } });
      cocher(racine, ['p1']);
      eq([classerBtn(racine), lienRegrouper(racine)?.className], [null, 'btn primary'], 'T-D11 (M65) : une photo cochée → aucun bouton « Classer » ; « Regrouper en recette » reste le primaire');
      cocher(racine, ['p2']);
      await attendre(() => classerBtn(racine) && !classerBtn(racine).disabled, 'session lue, bouton allumé');
      eq([classerBtn(racine).className, classerBtn(racine).textContent, sousClasser(racine)?.textContent, lienRegrouper(racine)?.className], ['btn primary', 'Classer ces photos avec l’assistant', 'Un classement = un appel à l’assistant ; lire les recettes coûtera ensuite un appel par recette.', 'btn'], 'T-D11 (M122) : deux cochées → « Classer… » primaire et le coût dit sous lui ; « Regrouper en recette » passe secondaire');
      eq(texteNuDeBarre(racine), [], 'T-D11 (M-filter, ronde 1) : deux cochées → aucun nœud texte nu dans la barre (le null de « Remplacer cette page » n’y est jamais écrit « null », écart E-7)');
      cocher(racine, ONZE.slice(2));
      eq([classerBtn(racine).disabled, sousClasser(racine)?.textContent], [true, 'Classe au plus 10 photos à la fois : décoche-en 1.'], 'T-D11 : onze cochées → éteint, la raison dite');
      // click() sur un bouton ÉTEINT ne déclenche rien (spécification HTML) : pour éprouver la garde de classer() elle-même (un rendu périmé, une
      // course), le nœud est RALLUMÉ avant le clic ; l'assertion « éteint » ci-dessus éprouve l'affichage.
      const b11 = classerBtn(racine); b11.disabled = false; b11.click();
      // Un FAIT, jamais des ticks (R-D-10) : classer() finit TOUJOURS par synchroniser({ forcer: true }), qui redessine la barre (surChangement →
      // drawActions : un bouton « Classer » NEUF). Au redessin, classer() est sorti — le code juste au compte, avant tout await ; le mutant M66 (borne
      // des 10 retirée) après octetsPresents, donc après la lecture d'octets que l'espion compte. Deux ticks le laissaient vivre selon le calendrier.
      await attendre(() => classerBtn(racine) !== b11, 'barre redessinée : classer() est sorti');
      eq([lectures, ff.appels.length, await db.count('imports')], [0, 0, 0], 'T-D11 (M66, M125) : onze cochées, bouton rallumé → classer() s’arrête au compte : aucun octet lu par le panneau, aucun POST, aucune ligne — rien n’est décodé avant la borne');
      window.dispatchEvent(new Event('offline'));
      await attendre(() => sousClasser(racine)?.textContent === 'Tu es hors ligne.', 'raison hors ligne');
      eq([classerBtn(racine).disabled, ff.appels.length], [true, 0], 'T-D11 (M124, ordre des raisons) : hors ligne ET plus de 10 → UNE ligne, la première raison (« Tu es hors ligne. »), 0 POST');
    });

    await ecran('T-D11 bouton : photo déjà en cours d’import, sans session, vol tenu', async (repo, db) => {
      await poserSeance(repo, db, { imports: [{ ...IMPORT_RCO, id: 'imp_p2', recipe_id: null, scan_session_id: 'ss1', page_ids: ['p2'] }] });
      const ff = fauxFetch();
      let racine = await monterSeance(repo, db, { over: { fetch: ff.fetch } });
      cocher(racine, ['p1', 'p2']);
      await attendre(() => sousClasser(racine)?.textContent === 'Décoche les photos déjà en cours d’import (1).', 'raison photos en cours');
      eq(classerBtn(racine).disabled, true, 'T-D11 (M67) : une cochée tenue par un import ouvert de la séance → éteint + « Décoche les photos déjà en cours d’import (1). »');
      await rallumerEtCliquer(racine);
      eq([await lignesClassement(db), ff.appels.length, dits, sousClasser(racine)?.textContent], [0, 0, [], 'Décoche les photos déjà en cours d’import (1).'], 'T-D11 (N4, ronde 1, D-D15) : une cochée tenue par un import ouvert, bouton RALLUMÉ → classer() relit le journal et s’arrête : aucune ligne, aucun POST (jamais une photo payée deux fois), la raison redite');
      scene.replaceChildren();
      racine = await monterSeance(repo, db, { over: { fetch: ff.fetch }, session: null });
      cocher(racine, ['p1', 'p3']);
      await attendre(() => sousClasser(racine)?.dataset?.role === 'connexion-ia', 'carte Connecte-toi');
      eq([classerBtn(racine).disabled, sousClasser(racine).textContent.startsWith('Connecte-toi pour utiliser l’assistant.'), ff.appels.length], [true, true, 0], 'T-D11 : sans session → la carte « Connecte-toi… », bouton éteint, 0 POST');
      await rallumerEtCliquer(racine);
      eq([await lignesClassement(db), ff.appels.length, dits, sousClasser(racine)?.dataset?.role], [0, 0, [], 'connexion-ia'], 'T-D11 (N7, ronde 1) : sans session, bouton RALLUMÉ → classer() relit la session et s’arrête avant toute écriture : aucune ligne, aucun POST ; la carte revient');
      scene.replaceChildren();
      const idx = await repo.ouvrirImport({ kind: 'index', edition_id: 'ed1', scan_session_id: 'ss_idx', page_ids: ['p5'] });
      let lacher; const tenu = new Promise((r) => { lacher = r; });
      const vol = UI.lancerVol(idx.id, async () => { await tenu; return { resultat: { photos: [], ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] }, texteBrut: '', modele: null }; }, { ctx: await ctxDe(repo, db), repo, fetch: ff.fetch });
      await attendre(() => UI.volEnCours()?.importId === idx.id, 'vol d’index tenu');
      racine = await monterSeance(repo, db, { over: { fetch: ff.fetch } });
      cocher(racine, ['p1', 'p3']);
      await attendre(() => sousClasser(racine)?.textContent === 'Une lecture est en cours : attends sa fin ou annule-la.', 'raison vol tenu');
      eq(classerBtn(racine).disabled, true, 'T-D11 (M124) : un vol tenu par ce document (une lecture d’index suspendue) → éteint, et la raison est dite');
      await rallumerEtCliquer(racine);
      eq([await lignesClassement(db), ff.appels.length, dits], [0, 0, ['Une lecture est déjà en cours : annule-la d’abord.']], 'T-D11 (N9, ronde 1) : un vol tenu, bouton RALLUMÉ → le filet de la course le dit et s’arrête : aucune ligne de classement (sans lui, une ligne était ouverte puis refusée vol_tenu), aucun POST');
      lacher(); await vol;
    });

    await ecran('T-D11 garde réseau de classer() (ronde 1) : hors ligne, bouton rallumé', async (repo, db) => {
      await poserSeance(repo, db);
      const ff = fauxFetch();
      const racine = await monterSeance(repo, db, { over: { fetch: ff.fetch } });
      cocher(racine, ['p1', 'p2']);
      await attendre(() => classerBtn(racine) && !classerBtn(racine).disabled, 'bouton allumé');
      window.dispatchEvent(new Event('offline'));
      await attendre(() => sousClasser(racine)?.textContent === 'Tu es hors ligne.', 'raison hors ligne');
      await rallumerEtCliquer(racine);
      eq([await lignesClassement(db), ff.appels.length, dits], [0, 0, ['Tu es hors ligne.']], 'T-D11 (N6, N6b, ronde 1) : hors ligne, bouton RALLUMÉ → classer() le dit et s’arrête AVANT toute écriture : aucune ligne, aucun POST');
    });

    await ecran('T-D11 garde des octets de classer() (ronde 1) : une photo cochée sans ses octets ici', async (repo, db) => {
      await poserSeance(repo, db, { sansOctets: ['p2'] });
      const ff = fauxFetch();
      const racine = await monterSeance(repo, db, { over: { fetch: ff.fetch } });
      cocher(racine, ['p1', 'p2']);
      await attendre(() => classerBtn(racine) && !classerBtn(racine).disabled, 'bouton allumé (les octets ne sont lus qu’au clic)');
      await rallumerEtCliquer(racine);
      eq([await lignesClassement(db), ff.appels.length, dits], [0, 0, ['Les photos de cette séance ne sont pas sur cet appareil.']], 'T-D11 (N5, ronde 1) : une cochée sans octets ici → classer() le dit et s’arrête AVANT toute écriture : aucune ligne (sans la garde, une ligne était ouverte puis refusée octets_absents), aucun POST');
    });

    await ecran('T-D11 garde « classement ouvert ailleurs » de classer() (ronde 1) : rendu périmé', async (repo, db) => {
      await poserSeance(repo, db);
      const ff = fauxFetch();
      const racine = await monterSeance(repo, db, { over: { fetch: ff.fetch } });
      cocher(racine, ['p1', 'p2']);
      await attendre(() => classerBtn(racine) && !classerBtn(racine).disabled, 'bouton allumé');
      // Un autre onglet (le bus est propre à chaque document : aucun événement ici) ouvre un classement dans cette séance.
      await db.put('imports', ligneClassement({ id: 'imp_autre_onglet', status: 'a_lancer', page_ids: ['p4', 'p5'] }));
      await rallumerEtCliquer(racine);
      eq([await lignesClassement(db), ff.appels.length, panneau(racine).hidden, panneau(racine).etatClassement().importId], [1, 0, false, 'imp_autre_onglet'], 'T-D11 (N8, ronde 1) : un classement ouvert entre-temps par un autre onglet → classer() n’en crée pas un second ni ne lance rien ; le panneau se redessine sur lui');
    });

    await ecran('T-D11 session pas encore lue (ronde 1) : bouton éteint, jamais la carte « Connecte-toi »', async (repo, db) => {
      await poserSeance(repo, db);
      const ctx = await ctxDe(repo, db);
      ctx.sync.auth.jeton = () => new Promise(() => {}); // la lecture de la session ne finit pas (sessionAssistant la borne à 2 s : l'assertion la précède)
      const racine = await IM.renderImport({}, { session: 'ss1' }, ctx, deps(repo, { fetch: fauxFetch().fetch }));
      scene.append(racine);
      cocher(racine, ['p1', 'p2']);
      eq([classerBtn(racine)?.disabled, !!barre(racine)?.querySelector('[data-role="connexion-ia"]'), !!barre(racine)?.querySelector('[data-role="raison-classer"]')], [true, false, false], 'T-D11 (M-session-attente, ronde 1) : session pas encore lue → « Classer » éteint, SANS la carte « Connecte-toi » (jamais un flash pour une personne connectée) ni aucune ligne');
    });

    await ecran('T-D11 regrouperPermis', async (repo, db) => {
      await poserSeance(repo, db, { pages: [...PAGES_5, 'p6'], octets: false, imports: [ligneClassement({ id: 'imp_rp' })] });
      const ctx = await ctxDe(repo, db);
      const p = G.panneauClassement(ctx.scan_sessions.find((s) => s.id === 'ss1'), ctx, () => [], deps(repo));
      eq([p.regrouperPermis(['p6']), p.regrouperPermis(['p1']), p.regrouperPermis([])], [true, false, true], 'T-D11 (M123) : classement reçu sur p1..p5 — une sélection hors du classement garde « Regrouper en recette », une sélection qui le touche le retire');
    });

    await ecran('T-D12 classer : un POST, ordre de la séance, vol rendu par le bus, Annuler', async (repo, db) => {
      await poserSeance(repo, db);
      const autre = await repo.ouvrirImport({ kind: 'recette', recipe_id: 'rcS', edition_id: 'ed1', scan_session_id: 'ss_autre', page_ids: ['p4'] });
      const ff = fauxFetch();
      // classer() lit enLigne() dans son premier segment SYNCHRONE (avant tout await) : un appel par entrée qui passe le verrou d'instance.
      let entrees = 0;
      const racine = await monterSeance(repo, db, { over: { fetch: ff.fetch, enLigne: () => { entrees += 1; return true; } } });
      cocher(racine, ['p5', 'p1', 'p3']);
      await attendre(() => classerBtn(racine) && !classerBtn(racine).disabled, 'bouton allumé');
      const b = classerBtn(racine); const avantClics = entrees; b.click(); b.click();
      eq(entrees - avantClics, 1, 'T-D12 (M-classer) : double clic → classer() n’entre qu’UNE fois (le verrou d’instance est posé avant tout await)');
      await attendre(() => ff.appels.length === 1, 'POST parti');
      await tick(); await tick();
      const corps = JSON.parse(ff.appels[0].options.body);
      const attendues = await Promise.all(['p1', 'p3', 'p5'].map(async (id) => (await L.pagePourEnvoi((await db.get('files', (await db.get('source_pages', id)).sha256)).blob)).base64));
      eq([ff.appels.length, corps.outil, corps.corps.max_tokens, imagesEnvoyees(ff.appels[0])], [1, 'extraction', 2000, attendues], 'T-D12 (M68) : UN POST (double clic compris), outil extraction, max_tokens 2000, les images de p1, p3, p5 dans l’ordre de la SÉANCE (jamais l’ordre de cochage 5, 1, 3)');
      eq([(await db.getAll('imports')).filter((i) => i.kind === 'classement').length, dits], [1, []], 'T-D12 (M-classer) : UNE ligne de classement et aucun refus dit (sans le verrou, un second classer() ouvrait une seconde ligne, refusée vol_tenu)');
      const id = (await db.getAll('imports')).find((i) => i.kind === 'classement').id;
      await attendre(async () => (await db.get('imports', id)).appels === 1, 'appels à 1');
      const enVol = await db.get('imports', id);
      eq([enVol.status, enVol.appels, enVol.document_id_vol, enVol.page_ids, enVol.scan_session_id, enVol.recipe_id, enVol.edition_id], ['en_cours', 1, UI.DOCUMENT_ID, ['p1', 'p3', 'p5'], 'ss1', null, 'ed1'], 'T-D12 : la ligne kind classement est en_cours, appels 1 au départ du fetch, document_id_vol = DOCUMENT_ID, pages de la séance, édition de la séance');
      await attendre(() => !!panneau(racine).querySelector('.status[role="status"]'), 'état 2 rendu par le bus');
      const statut = panneau(racine).querySelector('.status[role="status"]');
      eq([statut.textContent, statut.nextElementSibling?.classList.contains('row'), !!boutonTexte(statut.nextElementSibling, 'Annuler'), ff.appels.length, ff.rendre.length], ['Classement des photos par l’assistant…', true, true, 1, 1], 'T-D12 (M126, M69) : PENDANT le fetch suspendu (avant le retour de lancerVol), .status[role=status] puis une .row avec « Annuler » (R-VIS-8)');
      eq(lienRegrouper(racine), null, 'T-D12 (M70) : « Regrouper en recette » est retiré pendant le vol pour une sélection classée');
      eq(await UI.lancerExtraction(autre.id, { ctx: await ctxDe(repo, db), repo, fetch: ff.fetch }), { issue: 'refuse', raison: 'vol_tenu' }, 'T-D12 (I-D5) : pendant le classement, l’extraction d’une recette est refusée (un vol par document)');
      boutonTexte(panneau(racine), 'Annuler').click();
      await attendre(async () => (await db.get('imports', id)).status === 'echec' && !!panneau(racine).querySelector('[data-role="echec"]'), 'echec(annule) rendu');
      const fin = await db.get('imports', id);
      eq([ff.appels[0].options.signal.aborted, fin.erreur?.raison, panneau(racine).querySelector('[data-role="echec"] span')?.textContent, !!panneau(racine).querySelector('button[data-role="reclasser"]'), UI.volEnCours()], [true, 'annule', 'Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.', true, null], 'T-D12 : « Annuler » → signal levé, echec(annule), la phrase I-4, « Reclasser » offert, plus de vol');
      await attendre(() => !!lienRegrouper(racine), '« Regrouper en recette » revenu');
      ok(!!lienRegrouper(racine), 'T-D12 : sur un échec, « Regrouper en recette » revient dans la barre');
    });

    await ecran('T-D12 réponses : a_verifier avant le regroupement ; coupe, vide, 413', async (repo, db) => {
      await poserSeance(repo, db);
      let suivante = [200, corpsModele(CLASSEMENT_5)];
      const ff = fauxFetch(() => suivante);
      const racine = await monterSeance(repo, db, { over: { fetch: ff.fetch } });
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { const l = (m.puts.imports || []).find((i) => i.kind === 'classement'); if (l) vus.push([l.status, !!racine.querySelector('[data-role="regroupement"]')]); return capture ? capture(m) : {}; };
      try {
        cocher(racine, PAGES_5);
        await attendre(() => classerBtn(racine) && !classerBtn(racine).disabled, 'bouton allumé');
        classerBtn(racine).click();
        await attendre(() => !!racine.querySelector('[data-role="regroupement"]'), 'écran de regroupement rendu');
      } finally { db.onMutate = capture; }
      eq(vus.find((v) => v[0] === 'a_verifier'), ['a_verifier', false], 'T-D12 (M71) : la ligne passe a_verifier (résultat écrit) AVANT que l’écran de regroupement soit rendu (I-3)');
      eq((await db.getAll('imports')).find((i) => i.kind === 'classement').resultat, R5_STOCKE, 'T-D12 (N1, ronde 1) : le résultat écrit par le vol du panneau porte chaque groupe sur SES photos (photo n → la n-ième page ENVOYÉE) : la forme stockée de CLASSEMENT_5');
      boutonTexte(panneau(racine), 'Ignorer ce classement').click();
      await attendre(() => panneau(racine).hidden && !!classerBtn(racine) && !classerBtn(racine).disabled, 'classement ignoré, « Classer » revenu');
      suivante = [200, corpsModele(CLASSEMENT_5, { stop_reason: 'max_tokens' })];
      classerBtn(racine).click();
      await attendre(() => panneau(racine).querySelector('[data-role="echec"] span')?.textContent === 'Le classement a été coupé : classe moins de photos à la fois.', 'coupe dite');
      suivante = [200, corpsModele({ groupes: [], orphelines: [1, 2, 3, 4, 5], uncertain: [] })];
      await attendre(() => panneau(racine).querySelector('button[data-role="reclasser"]')?.disabled === false, 'Reclasser allumé');
      panneau(racine).querySelector('button[data-role="reclasser"]').click();
      await attendre(() => panneau(racine).querySelector('[data-role="echec"] span')?.textContent === 'Aucune recette reconnue sur ces photos.', 'vide dit');
      suivante = [413, { erreur: 'trop_lourd' }];
      await attendre(() => panneau(racine).querySelector('button[data-role="reclasser"]')?.disabled === false, 'Reclasser allumé');
      panneau(racine).querySelector('button[data-role="reclasser"]').click();
      await attendre(() => panneau(racine).querySelector('[data-role="echec"] span')?.textContent === 'La demande est trop lourde : choisis moins de pages.', '413 dit');
      eq([ff.appels.length, confirmations.map((c) => c[1])], [4, ['Ignorer']], 'T-D12 : coupe, vide et 413 disent leur texte (texteEchecClassement) ; quatre POST ; « Ignorer ce classement » d’un classement reçu est confirmé, « Reclasser » d’un échec ne l’est pas');
    });

    await ecran('T-D12 reprise par ?import=, résultat hostile, Ignorer', async (repo, db) => {
      // Ronde 1 (M74 creux) : imp_ok porte un brouillon NON nul — « Ignorer » doit l'effacer, pas le trouver déjà nul.
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_ok', over: { brouillon: { cle: 'brouillon-sentinelle' } } })] });
      await poserSeance(repo, db, { id: 'ss2', imports: [ligneClassement({ id: 'imp_hostile', sessionId: 'ss2', over: { resultat: { groupes: 'x' }, brouillon: { cle: DATE } } })] });
      const ff = fauxFetch();
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_ok' }, over: { fetch: ff.fetch } });
      await attendre(() => !!racine.querySelector('[data-role="regroupement"]'), 'regroupement rendu');
      eq([ff.appels.length, cochees(racine), racine.querySelector('[data-role="regroupement"] h2')?.textContent], [0, [], 'Recettes trouvées'], 'T-D12 (M72) : reprise par ?import= d’une ligne a_verifier → l’écran de regroupement, 0 POST, rien de coché d’office');
      scene.replaceChildren();
      const r2 = await monterSeance(repo, db, { query: { session: 'ss2', import: 'imp_hostile' }, over: { fetch: ff.fetch } });
      await attendre(async () => (await db.get('imports', 'imp_hostile')).status === 'echec' && !!panneau(r2).querySelector('[data-role="echec"]'), 'echec(illisible)');
      const h = await db.get('imports', 'imp_hostile');
      eq([h.erreur?.raison, h.resultat, h.brouillon, panneau(r2).querySelector('[data-role="echec"] span')?.textContent, panneau(r2).querySelector('[data-role="echec"] small')?.textContent, ff.appels.length], ['illisible', null, null, 'L’assistant n’a pas répondu lisiblement. Réessaie.', 'Code : illisible', 0], 'T-D12 (M73) : un résultat hostile en base → echec(illisible) au montage, résultat ET brouillon effacés, « Code : illisible », aucun appel');
      scene.replaceChildren();
      const r3 = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_ok' }, over: { fetch: ff.fetch } });
      await attendre(() => !!boutonTexte(panneau(r3), 'Ignorer ce classement'), 'Ignorer offert');
      cocher(r3, ['p1']);
      eq(lienRegrouper(r3), null, 'T-D12 : une sélection qui touche le classement reçu → pas de « Regrouper en recette »');
      eq(texteNuDeBarre(r3), [], 'T-D12 (M-filter, ronde 1) : sélection classée → « Regrouper » absent de la barre, et aucun nœud texte « null » à sa place');
      reponseConfirmer = false;
      const avant = await db.get('imports', 'imp_ok');
      // Vague finale (revue de branche, constat 2 ; R-D-10) : un FAIT, jamais des ticks — le panneau prêt d'abord (session lue, octets vérifiés : aucun
      // redessin du montage ne viendra plus), puis, après le « non », ignorerClassement sort par son finally (synchroniser, forcé) : un bouton NEUF ; au
      // redessin, ce qu'un « non » mal tenu aurait écrit l'a été (FV-M127p : la réponse ignorée, une relecture avant l'écriture).
      await attendre(() => { const b = panneau(r3).querySelector('button[data-role="lire-recettes"]'); return !!b && !b.disabled; }, 'panneau prêt');
      const ignorerAvant = boutonTexte(panneau(r3), 'Ignorer ce classement');
      ignorerAvant.click();
      await attendre(() => confirmations.length === 1, 'confirmation demandée');
      await attendre(() => boutonTexte(panneau(r3), 'Ignorer ce classement') !== ignorerAvant, 'panneau redessiné après le « non »');
      eq([confirmations[0], await db.get('imports', 'imp_ok')], [['Ignorer ce classement ? Il a coûté un appel ; le refaire en coûtera un autre.', 'Ignorer'], avant], 'T-D12 (M127) : « Ignorer ce classement » répondu NON → 0 écriture');
      reponseConfirmer = true;
      boutonTexte(panneau(r3), 'Ignorer ce classement').click();
      await attendre(async () => (await db.get('imports', 'imp_ok')).status === 'ignore' && panneau(r3).hidden && !!lienRegrouper(r3), 'ignoré, panneau caché, Regrouper revenu');
      const ig = await db.get('imports', 'imp_ok');
      eq([ig.status, ig.finished_at, nul(ig.brouillon), panneau(r3).hidden, !!lienRegrouper(r3)], ['ignore', NOW, 'null', true, true], 'T-D12 (M74, N43, N44, ronde 1) : « Ignorer ce classement » confirmé → ignore avec finished_at = l’horloge injectée, le brouillon (non nul) effacé, panneau caché, « Regrouper en recette » revenu');
    });

    await ecran('T-D12 liste blanche de l’extraction et option attendus', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_s', status: 'a_lancer' }), { ...ligneClassement({ id: 'imp_cov', status: 'a_lancer' }), kind: 'couverture' }] });
      const ff = fauxFetch([200, corpsModele({ title: 'Soupe', ingredients: [{ source_text: '1 courge', uncertain: false }], steps: [{ text: 'Cuire.' }] })]);
      const ctx = await ctxDe(repo, db);
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push(Object.keys(m.puts)); return capture ? capture(m) : {}; };
      let rs;
      try { rs = [await UI.lancerExtraction('imp_s', { ctx, repo, fetch: ff.fetch }), await UI.lancerExtraction('imp_cov', { ctx, repo, fetch: ff.fetch })]; }
      finally { db.onMutate = capture; }
      eq([rs, vus.length, ff.appels.length, (await db.get('imports', 'imp_s')).status, (await db.get('imports', 'imp_cov')).status], [[{ issue: 'refuse', raison: 'sorte' }, { issue: 'refuse', raison: 'sorte' }], 0, 0, 'a_lancer', 'a_lancer'], 'T-D12 (M75, M128) : lancerExtraction sur une ligne de classement, puis de couverture → refuse(sorte), 0 écriture, 0 POST (liste BLANCHE : une sorte inconnue n’est jamais lue comme une recette)');
      eq(UI.SORTES_EXTRACTION, ['recette', 'index'], 'T-D12 : SORTES_EXTRACTION (C lit encore les index par lancerExtraction : écart E-3)');
      // Ronde 1 (R3, M-lecture-sorte) : la garde de sorte du chemin `lecture` (une lecture SANS ligne, l'éditeur et le panneau d'index) — l'interface
      // Produces : accepte({ kind }) évaluée avant toute écriture.
      let executions = 0; const avantLecture = await db.count('imports');
      const rl = await UI.lancerVol(null, async () => { executions += 1; return { resultat: null, texteBrut: '', modele: null }; }, { ctx, repo, fetch: ff.fetch, lecture: { kind: 'classement', pageIds: ['p1', 'p2'], editionId: 'ed1', sessionId: 'ss1', cle: null }, accepte: (l) => l?.kind === 'recette' });
      eq([rl, executions, ff.appels.length, await db.count('imports')], [{ issue: 'refuse', raison: 'sorte', importId: null }, 0, 0, avantLecture], 'T-D12 (M-lecture-sorte, ronde 1) : une LECTURE d’une sorte que accepte refuse → refuse(sorte), aucune ligne ouverte, l’exécutant jamais appelé, aucun POST');
      const echouee = await repo.ouvrirImport({ kind: 'recette', recipe_id: 'rcS', edition_id: 'ed1', scan_session_id: 'ss1', page_ids: ['p1'] });
      await db.put('imports', { ...(await db.get('imports', echouee.id)), status: 'echec', erreur: { raison: 'serveur', extra: {} } });
      eq([await UI.lancerExtraction(echouee.id, { ctx, repo, fetch: ff.fetch, attendus: ['a_lancer'] }), ff.appels.length, (await db.get('imports', echouee.id)).status], [{ issue: 'refuse', raison: 'transition', statut: 'echec' }, 0, 'echec'], 'T-D12 (M143b) : avec attendus [a_lancer], une ligne echec est refusée (transition) AVANT toute écriture et tout POST');
      eq([(await UI.lancerExtraction(echouee.id, { ctx, repo, fetch: ff.fetch })).issue, ff.appels.length], ['a_verifier', 1], 'T-D12 : sans l’option, une ligne echec part (lot A inchangé)');
    });

    await ecran('T-D12 état 4 : « Reclasser » éteint par un autre import de la séance, jamais par sa propre ligne', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_e4', status: 'echec', page_ids: ['p1', 'p3', 'p5'], over: { erreur: { raison: 'coupe', extra: {} } } }), { ...IMPORT_RCO, id: 'imp_p3', recipe_id: null, scan_session_id: 'ss1', page_ids: ['p3'] }] });
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_e4' }, over: { fetch: fauxFetch().fetch } });
      await attendre(() => raisonPanneau(racine) === 'Décoche les photos déjà en cours d’import (1).', 'raison dite');
      eq([panneau(racine).querySelector('button[data-role="reclasser"]').disabled, cochees(racine)], [true, ['p1', 'p3', 'p5']], 'T-D12 (M118 à l’écran) : reprise d’un échec → ses pages cochées ; une cochée tenue par un AUTRE import ouvert éteint « Reclasser » et le dit');
      await db.put('imports', { ...(await db.get('imports', 'imp_p3')), status: 'ignore' });
      scene.replaceChildren();
      const r2 = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_e4' }, over: { fetch: fauxFetch().fetch } });
      await attendre(() => raisonPanneau(r2) === 'Un classement = un appel à l’assistant ; lire les recettes coûtera ensuite un appel par recette.', 'coût dit');
      eq(panneau(r2).querySelector('button[data-role="reclasser"]').disabled, false, 'T-D12 (M118) : la ligne de classement elle-même ne s’éteint pas (pagesEnCours, sauf: ligne.id)');
    });

    const COUT = 'Un classement = un appel à l’assistant ; lire les recettes coûtera ensuite un appel par recette.';
    const DECOCHE_1 = 'Décoche les photos déjà en cours d’import (1).';
    await ecran('T-D12 état 4 (ronde 1) : la raison suit la sélection, vide comprise ; « Reclasser » sur d’autres pages n’envoie qu’elles', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_e4', status: 'echec', page_ids: ['p1', 'p3', 'p5'], over: { erreur: { raison: 'coupe', extra: {} } } }), { ...IMPORT_RCO, id: 'imp_p3', recipe_id: null, scan_session_id: 'ss1', page_ids: ['p3'] }] });
      const ff = fauxFetch();
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_e4' }, over: { fetch: ff.fetch } });
      const reclasser = () => panneau(racine).querySelector('button[data-role="reclasser"]');
      await attendre(() => raisonPanneau(racine) === DECOCHE_1, 'raison dite');
      cocher(racine, ['p3']);
      await attendre(() => raisonPanneau(racine) === COUT, 'p3 décochée : le coût dit, sans clic');
      eq(reclasser().disabled, false, 'T-D12 (N14, ronde 1) : décocher la photo tenue ailleurs redessine le panneau — « Reclasser » se rallume et le coût est dit, sans aucun clic');
      cocher(racine, ['p1', 'p5']);
      await attendre(() => raisonPanneau(racine) === DECOCHE_1, 'sélection vidée : le panneau se redessine sur les pages de la ligne');
      eq([cochees(racine), reclasser().disabled], [[], true], 'T-D12 (ronde 1, constat 14) : sélection VIDÉE → le panneau se redessine aussi (pagesALire retombe sur les pages de la ligne, dont p3, tenue ailleurs) : éteint, la raison dite');
      cocher(racine, ['p1', 'p5']);
      await attendre(() => raisonPanneau(racine) === COUT && reclasser()?.disabled === false, 'p1 et p5 recochées');
      reclasser().click();
      await attendre(() => ff.appels.length === 1, 'POST parti');
      const attendues = await Promise.all(['p1', 'p5'].map(async (id) => (await L.pagePourEnvoi((await db.get('files', (await db.get('source_pages', id)).sha256)).blob)).base64));
      const e4 = await db.get('imports', 'imp_e4');
      eq([imagesEnvoyees(ff.appels[0]), e4.page_ids, e4.status], [attendues, ['p1', 'p5'], 'en_cours'], 'T-D12 (N2, ronde 1) : « Reclasser » d’un échec sur d’AUTRES pages → echec → a_lancer (page_ids [p1, p5]) puis le vol : exactement ces deux images, jamais p3, tenue par un autre import');
      ff.rendre[0](413, { erreur: 'trop_lourd' });
      await attendre(async () => (await db.get('imports', 'imp_e4')).status === 'echec', 'vol fini');
    });

    await ecran('T-D12 état 5 (ronde 1) : ?import= d’un classement à lancer coche ses pages ; une seule cochée → la raison ; d’autres pages → patch puis le vol, relancé ICI', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_l5', status: 'a_lancer', page_ids: ['p1', 'p3', 'p5'], device_id: 'dev_autre' })] });
      const ff = fauxFetch();
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_l5' }, over: { fetch: ff.fetch } });
      eq(cochees(racine), ['p1', 'p3', 'p5'], 'T-D12 (N17, ronde 1) : reprise par ?import= d’un classement À LANCER → ses pages présentes cochées (§ 4.1, comme un échec)');
      const bouton = () => panneau(racine).querySelector('button[data-role="classer"]');
      cocher(racine, ['p3', 'p5']);
      await attendre(() => raisonPanneau(racine) === 'Coche au moins deux photos de cette séance.', 'une seule cochée : la raison dite');
      eq(bouton().disabled, true, 'T-D12 (ronde 1, constats 15 et 24) : à l’état 5, une seule photo cochée → « Classer » éteint ET la raison dite (I-D4 : un bouton éteint dit pourquoi)');
      window.dispatchEvent(new Event('offline'));
      await attendre(() => raisonPanneau(racine) === 'Tu es hors ligne.', 'hors ligne : la première raison');
      eq(bouton().disabled, true, 'T-D12 (ronde 1, constat 15) : hors ligne avec une seule cochée → « Tu es hors ligne. » d’abord (l’ordre des raisons de § 4.2 tient, la borne basse vient après)');
      window.dispatchEvent(new Event('online'));
      cocher(racine, ['p5']);
      await attendre(() => raisonPanneau(racine) === COUT && bouton()?.disabled === false, 'p1 et p5 : Classer allumé');
      bouton().click();
      await attendre(() => ff.appels.length === 1, 'POST parti');
      const l5 = await db.get('imports', 'imp_l5');
      eq([imagesEnvoyees(ff.appels[0]).length, l5.page_ids, l5.status, l5.device_id], [2, ['p1', 'p5'], 'en_cours', appareilIci()], 'T-D12 (ronde 1, constat 23) : état 5, d’autres pages → patch { page_ids } sur place puis le vol (2 images) ; une ligne venue d’un AUTRE appareil, relancée ici, devient celle de CET appareil (comme R-B-8 : son battement est ici)');
      ff.rendre[0](413, { erreur: 'trop_lourd' });
      await attendre(async () => (await db.get('imports', 'imp_l5')).status === 'echec', 'vol fini');
    });

    await ecran('T-D12 « Ignorer ce classement » sans question sur un échec ou une ligne à lancer (ronde 1)', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_ie', status: 'echec', over: { erreur: { raison: 'coupe', extra: {} }, brouillon: { cle: 'brouillon-sentinelle' } } })] });
      await poserSeance(repo, db, { id: 'ss2', pages: ['q1', 'q2'], octets: false, imports: [ligneClassement({ id: 'imp_il', sessionId: 'ss2', status: 'a_lancer', page_ids: ['q1', 'q2'], over: { brouillon: { cle: 'brouillon-sentinelle' } } })] });
      for (const [seance, id, sorte] of [['ss1', 'imp_ie', 'en échec'], ['ss2', 'imp_il', 'à lancer']]) {
        scene.replaceChildren();
        const racine = await monterSeance(repo, db, { query: { session: seance, import: id }, over: { fetch: fauxFetch().fetch } });
        await attendre(() => !!boutonTexte(panneau(racine), 'Ignorer ce classement'), 'Ignorer offert');
        boutonTexte(panneau(racine), 'Ignorer ce classement').click();
        await attendre(async () => (await db.get('imports', id)).status === 'ignore' && panneau(racine).hidden, 'ignoré, panneau caché');
        const ig = await db.get('imports', id);
        eq([confirmations.length, ig.finished_at, nul(ig.brouillon), panneau(racine).hidden], [0, NOW, 'null', true], `T-D12 (N12, N20, N43, N44, ronde 1) : « Ignorer ce classement » d’une ligne ${sorte} → ignore SANS question (rien de reçu à perdre), finished_at = l’horloge injectée, brouillon effacé, panneau caché`);
      }
    });

    await ecran('T-D12 « Ignorer ce classement » relit la ligne (ronde 1) : changée ailleurs depuis le rendu, ou pendant la question → rien d’écrit', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_x', status: 'echec', over: { erreur: { raison: 'coupe', extra: {} } } })] });
      let pendant = null;
      const confirmer = async (message, o) => { confirmations.push([message, o?.okLabel ?? null]); if (pendant) await pendant(); return true; };
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_x' }, over: { fetch: fauxFetch().fetch, confirmer } });
      await attendre(() => !!boutonTexte(panneau(racine), 'Ignorer ce classement'), 'Ignorer offert');
      // S1 : l'écran montre l'échec ; un autre onglet (aucun événement du bus ici) l'a reclassé : a_verifier, un résultat neuf, payé (appels 2).
      const R2 = { ...ligneClassement({ id: 'imp_x' }), appels: 2, started_at: '2026-10-19T11:00:00.000Z' };
      await db.put('imports', R2);
      boutonTexte(panneau(racine), 'Ignorer ce classement').click();
      await attendre(() => panneau(racine).querySelector('[data-role="regroupement"] h2')?.textContent === 'Recettes trouvées', 'redessin sur la ligne relue (reçue)');
      eq([confirmations.length, await db.get('imports', 'imp_x')], [0, R2], 'T-D12 (ronde 1, constats 1 et 2, S1) : rendu sur un échec, reclassé ailleurs depuis → « Ignorer » relit la ligne : rien n’est demandé ni écrit (le classement payé reste à vérifier), le panneau montre la ligne relue');
      // S2 : la question est posée pour le classement montré (R2) ; un autre (R3, autre départ) arrive PENDANT la question ; « oui » → rien d'écrit.
      const R3 = { ...R2, appels: 3, started_at: '2026-10-19T11:30:00.000Z' };
      pendant = () => db.put('imports', R3);
      const b = boutonTexte(panneau(racine), 'Ignorer ce classement');
      b.click();
      await attendre(() => confirmations.length === 1 && !b.isConnected, 'question posée, puis redessin');
      eq([confirmations[0], await db.get('imports', 'imp_x')], [['Ignorer ce classement ? Il a coûté un appel ; le refaire en coûtera un autre.', 'Ignorer'], R3], 'T-D12 (ronde 1, constat 2, S2) : la question vaut pour LE classement montré — un autre reçu pendant la question (synchro, autre onglet) n’est jamais ignoré sans avoir été vu : la clé est gardée DANS la transaction');
    });

    await ecran('T-D12 marquerIllisible garde la clé DANS la transaction (ronde 1)', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_h', over: { resultat: { groupes: 'x' } } })] });
      const valide = { ...ligneClassement({ id: 'imp_h' }), started_at: '2026-10-19T11:00:00.000Z' };
      let transitions = 0;
      // Entre la relecture (hostile) et la transaction, la ligne est reclassée ailleurs : un nouveau départ, un résultat valide.
      const espion = { ...repo, transitionner: async (store, key, opts) => { if (key === 'imp_h' && transitions++ === 0) await db.put('imports', valide); return repo.transitionner(store, key, opts); } };
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_h' }, over: { repo: espion, fetch: fauxFetch().fetch } });
      await attendre(() => panneau(racine).querySelector('[data-role="regroupement"] h2')?.textContent === 'Recettes trouvées', 'redessin sur le classement valide');
      eq([transitions, await db.get('imports', 'imp_h')], [1, valide], 'T-D12 (N11, ronde 1) : un résultat hostile relu puis reclassé AILLEURS avant la transaction → la revalidation est refusée par la clé : le classement payé, valide, reste à vérifier, intact');
    });

    await ecran('T-D12 résultat hostile : un nœud neutre pendant le marquage (ronde 1)', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_h2', over: { resultat: { groupes: 'x' } } })] });
      const ctx = await ctxDe(repo, db);
      let lacher; const suspendue = new Promise((r) => { lacher = r; });
      const espion = { ...repo, transitionner: async (...a) => { await suspendue; return repo.transitionner(...a); } }; // le marquage reste en cours
      const p = G.panneauClassement(ctx.scan_sessions.find((s) => s.id === 'ss1'), ctx, () => [], deps(espion, { fetch: fauxFetch().fetch }));
      eq([!!p.querySelector('[data-role="regroupement"]'), !!p.querySelector('[data-role="revalidation"]')], [false, true], 'T-D12 (ronde 1, constat 16) : un résultat hostile → pendant son marquage echec(illisible), un nœud NEUTRE (data-role revalidation), jamais un écran de regroupement vide qu’un test prendrait pour rendu');
      lacher();
      await attendre(async () => (await db.get('imports', 'imp_h2')).status === 'echec', 'marquage fini');
    });

    await ecran('T-D12 état 2 tenu par un AUTRE document (ronde 1, I-7)', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_v', status: 'en_cours', over: { document_id_vol: 'doc-ailleurs', battement_at: NOW, started_at: NOW } })] });
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_v' }, over: { fetch: fauxFetch().fetch } });
      eq([panneau(racine).hidden, panneau(racine).textContent, !!panneau(racine).querySelector('button[data-role="annuler"]'), !!panneau(racine).querySelector('.status[role="status"]')], [false, 'En cours sur un autre écran', false, false], 'T-D12 (N13, ronde 1, I-7) : un classement en vol tenu par un AUTRE document → « En cours sur un autre écran », sans « Annuler » (il n’annulerait rien ici)');
    });

    await ecran('T-D9 priorité des présélections (écran)', async (repo, db) => {
      const idx = { ...ligneClassement({ id: 'imp_idx', page_ids: ['p2'], over: { updated_at: NOW } }), kind: 'index', resultat: { photos: [{ page_id: 'p2', printed_page_range: null, entries: [{ title: 'Soupe', printed_page: 5, section: null, uncertain: false }] }], ecartees: { trop_longues: 0, adresse: 0 }, uncertain: [] } };
      await poserSeance(repo, db, { imports: [idx, ligneClassement({ id: 'imp_c9', status: 'echec', page_ids: ['p1', 'p3'], over: { erreur: { raison: 'coupe', extra: {} } } })] });
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_c9' }, over: { fetch: fauxFetch().fetch } });
      eq([cochees(racine), racine.querySelector('[data-role="panneau-index"]')?.hidden], [['p1', 'p3'], true], 'T-D9 (M119) : ?import= d’un classement en échec d’une séance qui a aussi un index ouvert → les pages du classement cochées, celles de l’index non, panneau d’index fermé');
    });

    await ecran('T-D9 ?import= désigne la ligne du panneau parmi deux classements ouverts (ronde 1)', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_vieux', status: 'echec', page_ids: ['p1', 'p2'], over: { erreur: { raison: 'coupe', extra: {} }, updated_at: DATE } }), ligneClassement({ id: 'imp_neuf', status: 'echec', page_ids: ['p3', 'p4'], over: { erreur: { raison: 'vide', extra: {} }, updated_at: NOW } })] });
      const racine = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_vieux' }, over: { fetch: fauxFetch().fetch } });
      eq([panneau(racine).etatClassement().importId, cochees(racine), panneau(racine).querySelector('[data-role="echec"] span')?.textContent], ['imp_vieux', ['p1', 'p2'], 'Le classement a été coupé : classe moins de photos à la fois.'], 'T-D9 (N18, ronde 1) : deux classements ouverts dans la séance, ?import= désigne le plus ancien → le panneau montre CELUI-LÀ (importId passé au panneau), jamais le plus récent');
    });

    await ecran('T-D10 Imports : titres et états du classement (écran)', async (repo, db) => {
      const maintenantReel = new Date().toISOString();
      await poserSeance(repo, db, { imports: [
        ligneClassement({ id: 'c_lancer', status: 'a_lancer', page_ids: ['p1', 'p2'] }),
        ligneClassement({ id: 'c_vol', status: 'en_cours', over: { document_id_vol: 'doc-ailleurs', started_at: maintenantReel, battement_at: maintenantReel } }),
        ligneClassement({ id: 'c_recu', over: { started_at: '2026-10-18T09:30:00.000Z', updated_at: NOW, brouillon: { cle: 'brouillon-sentinelle' } } }),
        ligneClassement({ id: 'c_echec', status: 'echec', over: { erreur: { raison: 'coupe', extra: {} } } }),
        // Ronde 1 : un vol tenu par CE document, et un échec illisible (son code).
        ligneClassement({ id: 'c_ici', status: 'en_cours', over: { document_id_vol: UI.DOCUMENT_ID, started_at: maintenantReel, battement_at: maintenantReel } }),
        ligneClassement({ id: 'c_illis', status: 'echec', over: { erreur: { raison: 'illisible', extra: {} } } }),
      ] });
      const racine = await AD.renderAdd({}, {}, await ctxDe(repo, db), { ...deps(repo), fetch: fauxFetch().fetch });
      scene.append(racine);
      const ligneEl = (id) => racine.querySelector(`[data-role="ligne-import"][data-id="${CSS.escape(id)}"]`);
      eq(['c_lancer', 'c_vol', 'c_recu', 'c_echec'].map((id) => ligneEl(id)?.querySelector('strong')?.textContent), Array(4).fill('Classement · Saisons'), 'T-D10 (écran) : « Classement · {livre} »');
      eq([ligneEl('c_lancer').textContent.includes('2 photos ajoutées'), ligneEl('c_vol').textContent.includes('En cours sur un autre écran'), ligneEl('c_recu').textContent.includes('Classement reçu le'), ligneEl('c_echec').textContent.includes('Le classement a été coupé : classe moins de photos à la fois.')], [true, true, true, true], 'T-D10 (écran) : les états dits du classement (à lancer, ailleurs, reçu, échec)');
      const { formatDate } = await import('../src/core/dom.js');
      eq([ligneEl('c_recu').textContent.includes(formatDate('2026-10-18T09:30:00.900Z', { withTime: true })), ligneEl('c_recu').textContent.includes(formatDate(NOW, { withTime: true }))], [true, false], 'T-D10 (écran, M-recu) : « Classement reçu le » date la RÉCEPTION (départ du vol + durée, dateReception), jamais updated_at — que chaque geste du brouillon réécrit');
      eq([...ligneEl('c_echec').querySelectorAll('button')].map((b) => b.textContent), ['Reprendre', 'Ignorer'], 'T-D10 (M62, écran) : jamais « Relancer » sur un classement');
      boutonTexte(ligneEl('c_echec'), 'Reprendre').click();
      eq(navs.at(-1), '/import?session=ss1&import=c_echec', 'T-D10 (écran) : « Reprendre » → la séance du classement');
      eq([ligneEl('c_ici').textContent.includes('Classement des photos par l’assistant…'), ligneEl('c_illis').textContent.includes('L’assistant n’a pas répondu lisiblement. Réessaie. Code : illisible')], [true, true], 'T-D10 (écran, N15, N53, ronde 1) : un classement en vol tenu par CE document dit « Classement des photos par l’assistant… » ; un échec illisible dit sa phrase ET son code');
      // Ronde 1 (constat 26) : « Ignorer » d'un classement REÇU depuis Imports — la question du panneau, et le brouillon effacé (D-D20).
      reponseConfirmer = false;
      const avantRecu = await db.get('imports', 'c_recu');
      // Vague finale (revue de branche, constat 2 ; R-D-10) : un FAIT, jamais des ticks. D'abord un redessin connu (la file des redessins est en série :
      // tout redessin d'avant est fini) ; puis, après le « non », agir() finit par son redessin depuis la base — la ligne rendue avant le clic n'est plus
      // dans la page ; ce qu'un « non » mal tenu aurait écrit l'a été avant ce redessin (FV-M127i : la réponse ignorée, une relecture avant l'écriture).
      const avantFile = ligneEl('c_recu');
      emit('change', { store: 'imports' });
      await attendre(() => !avantFile.isConnected, 'section redessinée avant la question');
      const avantNon = ligneEl('c_recu');
      boutonTexte(avantNon, 'Ignorer').click();
      await attendre(() => confirmations.length === 1, 'confirmation demandée');
      await attendre(() => !avantNon.isConnected, 'section redessinée après le « non »');
      eq([confirmations[0], await db.get('imports', 'c_recu')], [['Ignorer ce classement ? Il a coûté un appel ; le refaire en coûtera un autre.', 'Ignorer'], avantRecu], 'T-D10 (écran, ronde 1, constat 26) : « Ignorer » d’un classement REÇU depuis Imports pose la question du panneau (il a coûté un appel) ; « non » → rien d’écrit');
      reponseConfirmer = true;
      boutonTexte(ligneEl('c_recu'), 'Ignorer').click();
      await attendre(async () => (await db.get('imports', 'c_recu')).status === 'ignore', 'classement reçu ignoré');
      const igR = await db.get('imports', 'c_recu');
      eq([confirmations.length, igR.finished_at, nul(igR.brouillon)], [2, NOW, 'null'], 'T-D10 (écran, ronde 1, constat 26) : « oui » → ignore, finished_at = l’horloge injectée, le brouillon effacé (D-D20 : « Ignorer ce classement » l’efface, d’où qu’il vienne)');
    });

    // =================================================================================================================================
    // Tâche 3 — l'écran de regroupement (§ 4.3, § 4.4), « Lire ces recettes » (§ 4.5) et la lecture du lot (§ 4.6) : T-D13 à T-D16. Le panneau est
    // monté SEUL (G.panneauClassement, dépendances injectées) sur un classement reçu posé en base ; les gestes n'écrivent que le brouillon.
    const monterPanneau = async (repo, db, { sessionId = 'ss1', importId = 'imp_cl', selection = [], over = {}, session = SESSION } = {}) => {
      const ctx = await ctxDe(repo, db, { session });
      const sel = new Set(selection);
      const p = G.panneauClassement(ctx.scan_sessions.find((s) => s.id === sessionId), ctx, () => [...sel], deps(repo, { importId, ...over }));
      scene.append(p);
      return p;
    };
    const boutonLire = (p) => p.querySelector('button[data-role="lire-recettes"]');
    const pret = (p) => attendre(() => boutonLire(p) && !boutonLire(p).disabled, '« Lire ces recettes » allumé');
    const blocDe = (p, cle) => p.querySelector(`[data-role="groupe"][data-cle="${CSS.escape(cle)}"]`);
    const choisirSelect = (p, page, valeur) => { const s = p.querySelector(`select[data-role="deplacer"][data-page="${CSS.escape(page)}"]`); s.value = valeur; s.dispatchEvent(new Event('change', { bubbles: true })); };
    const brouillonEn = async (db, id) => (await db.get('imports', id))?.brouillon ?? null;
    const groupesBrouillon = async (db, id) => ((await brouillonEn(db, id))?.groupes ?? []).map((g) => [g.cle, g.page_ids]);
    const puces = (racine, page) => [...racine.querySelector(`figure[data-page="${CSS.escape(page)}"]`).querySelectorAll('.chip')].map((c) => c.textContent);

    await ecran('T-D13 regroupement : blocs, puces, gestes du brouillon, nouveau montage', async (repo, db) => {
      await poserSeance(repo, db, { sortes: { p5: 'recipe' }, imports: [ligneClassement({ over: { resultat: { ...R5_STOCKE, partagees: ['p3'], uncertain: ['photo 3 floue'] } } })] });
      const ff = fauxFetch();
      const vraiCreer = URL.createObjectURL; let urlsCreees = 0;
      URL.createObjectURL = (b) => { urlsCreees += 1; return vraiCreer.call(URL, b); };
      try {
        const p = await monterPanneau(repo, db, { over: { fetch: ff.fetch } });
        await pret(p);
        eq([[...p.querySelector('select[data-role="deplacer"][data-page="p1"]').options].map((o) => [o.value, o.textContent]), [...p.querySelector('select[data-role="deplacer"][data-page="p4"]').options].map((o) => o.value), p.querySelector('[data-role="raison-lire"]')?.textContent],
          [[['', 'Déplacer vers…'], ['g2', 'Recette 2 — Tarte fine aux poires'], ['g3', 'Recette 3 — Gratin dauphinois'], ['nouveau', 'Nouvelle recette']], ['', 'g1', 'g2', 'g3', 'nouveau'], 'Une lecture = un appel à l’assistant, compté dans ton quota du jour.'], 'T-D13 (M-options, M-quota, ronde 1, constat 34) : le select d’une page offre CHAQUE AUTRE groupe (jamais le sien) puis « Nouvelle recette » ; une photo à part, tous les groupes ; « Lire » allumé → « Une lecture = un appel… » sous la rangée');
        const titreDe = (b) => [...b.querySelectorAll('h3 + .row span')].map((s) => s.textContent);
        eq([...p.querySelectorAll('[data-role="groupe"]')].map((b) => [b.dataset.cle, b.querySelector('h3').textContent, b.getAttribute('aria-labelledby') === b.querySelector('h3').id, titreDe(b), [...b.querySelectorAll('figure')].map((f) => f.dataset.page)]),
          [['g1', 'Recette 1', true, ['Soupe de courge', 'p. 132'], ['p1', 'p3']], ['g2', 'Recette 2', true, ['Tarte fine aux poires', 'p. 140'], ['p2']], ['g3', 'Recette 3', true, ['Gratin dauphinois', 'p. 148'], ['p5']]], 'T-D13 : trois blocs « Recette k », le titre lu, « p. N », les miniatures dans l’ordre, chacun étiqueté par son h3');
        const aPart = p.querySelector('[data-role="a-part"]');
        eq([aPart?.querySelector('h3')?.textContent, [...aPart.querySelectorAll('p.muted')].map((x) => x.textContent), [...aPart.querySelectorAll('figure')].map((f) => [f.dataset.page, [...f.querySelectorAll('.chip')].map((c) => c.textContent)])], ['Photos qui ne seront pas lues', ['Déplace-les vers une recette si elles en font partie.'], [['p4', ['sans début de recette']]]], 'T-D13 : le bloc « Photos qui ne seront pas lues », sa SEULE phrase, p4 « sans début de recette »');
        eq([p.querySelector('[data-role="incertain"]')?.textContent, p.querySelector('[data-role="regroupement"] > p.muted')?.textContent], ['Incertain : photo 3 floue', '3 recettes proposées par l’assistant — vérifie les groupes avant de lire.'], 'T-D13 : « Incertain : … » quand la racine en porte ; le compte des groupes DU CLASSEMENT');
        eq([puces(p, 'p3'), puces(p, 'p5'), puces(p, 'p1')], [['porte peut-être deux recettes'], ['déjà liée à une recette'], []], 'T-D13 (M130) : une photo de partagees porte « porte peut-être deux recettes » ; une page kind recipe « déjà liée à une recette »');
        await attendre(() => [...p.querySelectorAll('figure img')].every((i) => i.src.startsWith('blob:')), 'miniatures posées');
        const srcP1 = p.querySelector('figure[data-page="p1"] img').src; const urlsAvant = urlsCreees;
        const vus = []; const capture = db.onMutate;
        db.onMutate = (m) => { vus.push([Object.keys(m.puts).sort(), (m.puts.imports || []).map((i) => [i.id, i.status])]); return capture ? capture(m) : {}; };
        let gestes = 0;
        // Ronde 1 de T6 (M132) : la miniature de p1 relue de façon SYNCHRONE juste après chaque geste (le redessin l'est) — lue après des attentes,
        // elle laissait vivant un cache qui ne rend plus l'URL tout de suite (miniatures vides jusqu'à getFile, une relecture IndexedDB par redessin).
        const srcSynchrones = [];
        const geste = async (fn, attendu) => { gestes += 1; fn(); srcSynchrones.push(p.querySelector('figure[data-page="p1"] img')?.src === srcP1); await attendre(async () => JSON.stringify(await groupesBrouillon(db, 'imp_cl')) === JSON.stringify(attendu), 'brouillon écrit : ' + JSON.stringify(attendu)); };
        try {
          await geste(() => choisirSelect(p, 'p3', 'g2'), [['g1', ['p1']], ['g2', ['p2', 'p3']], ['g3', ['p5']]]);
          eq([[...blocDe(p, 'g2').querySelectorAll('figure')].map((f) => f.dataset.page), document.activeElement === p.querySelector('select[data-role="deplacer"][data-page="p3"]')], [['p2', 'p3'], true], 'T-D13 : déplacer p3 vers « Recette 2 » par le select → blocs redessinés, le focus va au select de la même photo dans son nouveau bloc');
          await geste(() => choisirSelect(p, 'p2', 'nouveau'), [['g1', ['p1']], ['g2', ['p3']], ['g3', ['p5']], ['n1', ['p2']]]);
          eq([p.querySelectorAll('[data-role="groupe"]').length, boutonLire(p).textContent], [4, 'Lire ces recettes (4 appels)'], 'T-D13 (M77) : « Nouvelle recette » → un quatrième bloc, le coût recalculé (4 appels)');
          eq(p.querySelector('[data-role="regroupement"] > p.muted')?.textContent, '3 recettes proposées par l’assistant — vérifie les groupes avant de lire.', 'T-D13 (M77-compte, ronde 1, constat 8) : après « Nouvelle recette » (4 blocs, « Lire ces recettes (4 appels) »), le compte reste celui DU CLASSEMENT (3), jamais celui de l’écran');
          await geste(() => choisirSelect(p, 'p4', 'g1'), [['g1', ['p1', 'p4']], ['g2', ['p3']], ['g3', ['p5']], ['n1', ['p2']]]);
          await geste(() => blocDe(p, 'g1').querySelector('button[data-role="descendre"][data-page="p1"]').click(), [['g1', ['p4', 'p1']], ['g2', ['p3']], ['g3', ['p5']], ['n1', ['p2']]]);
          eq([document.activeElement?.dataset?.role, document.activeElement?.dataset?.page], ['descendre', 'p1'], 'T-D13 (M78) : ↓ — le focus suit la page déplacée');
          await geste(() => boutonTexte(blocDe(p, 'g1'), 'Retirer la page 2').click(), [['g1', ['p4']], ['g2', ['p3']], ['g3', ['p5']], ['n1', ['p2']]]);
          eq([...p.querySelector('[data-role="a-part"]').querySelectorAll('figure')].map((f) => [f.dataset.page, [...f.querySelectorAll('.chip')].map((c) => c.textContent)]), [['p1', ['retirée']]], 'T-D13 : « Retirer la page 2 » → la photo à part, puce « retirée »');
          eq([document.activeElement?.tagName, document.activeElement?.dataset?.role, document.activeElement?.dataset?.page], ['SELECT', 'deplacer', 'p1'], 'T-D13 (M-focus-retirer, ronde 1, constat 34) : après « Retirer la page 2 », le focus va au select de la photo, désormais à part');
          gestes += 1;
          blocDe(p, 'g3').querySelector('[data-role="appariement"] label.check input').click();
          await attendre(async () => JSON.stringify((await brouillonEn(db, 'imp_cl'))?.choix) === JSON.stringify([['g3', 'rcG']]), 'choix de g3 écrit');
          await geste(() => choisirSelect(p, 'p5', 'g1'), [['g1', ['p4', 'p5']], ['g2', ['p3']], ['n1', ['p2']]]);
          eq([blocDe(p, 'g3'), (await brouillonEn(db, 'imp_cl')).choix], [null, []], 'T-D13 : vider un groupe le retire AVEC son choix');
        } finally { db.onMutate = capture; }
        eq([vus.length, vus.every((v) => v[0].join() === 'imports' && v[1].length === 1 && v[1][0][0] === 'imp_cl' && v[1][0][1] === 'a_verifier'), ff.appels.length, (await db.getAll('imports')).length], [gestes, true, 0, 1], 'T-D13 (M76) : CHAQUE geste n’écrit que le brouillon — un appel de db.onMutate par geste, imports seul, la ligne toujours a_verifier, aucune ligne neuve, 0 POST');
        eq([p.querySelector('figure[data-page="p1"] img').src === srcP1, urlsCreees, srcSynchrones], [true, urlsAvant, Array(6).fill(true)], 'T-D13 (M132) : les redessins réutilisent la même URL pour la même photo, aucune URL de plus, et la posent DÈS le redessin (six gestes, ronde 1 de T6)');
        // Un choix FAIT avant le nouveau montage : décocher g2 (proposition sûre rcT) écrit [['g2', null]] — sans lui, le remontage ne rendrait que des
        // propositions recalculées, et un écran qui ignorerait les choix restaurés resterait vert.
        blocDe(p, 'g2').querySelector('[data-role="appariement"] label.check input').click();
        await attendre(async () => JSON.stringify((await brouillonEn(db, 'imp_cl'))?.choix) === JSON.stringify([['g2', null]]), 'choix de g2 (décochée) écrit');
        scene.replaceChildren();
        const p2 = await monterPanneau(repo, db, { over: { fetch: ff.fetch } });
        await pret(p2);
        eq([[...p2.querySelectorAll('[data-role="groupe"]')].map((b) => [b.dataset.cle, [...b.querySelectorAll('figure')].map((f) => f.dataset.page)]), p2.etatClassement().aPart, p2.etatClassement().groupes.map((g) => g.recipe_id), blocDe(p2, 'g2').querySelector('[data-role="appariement"] label.check input')?.checked], [[['g1', ['p4', 'p5']], ['g2', ['p3']], ['n1', ['p2']]], [{ page_id: 'p1', motif: 'retiree' }], ['rcS', null, null], false], 'T-D13 (M109) : un NOUVEAU montage (refresh simulé) rend les mêmes groupes, la même photo à part et les mêmes choix — g2, décochée avant le remontage, le reste (choix restauré, jamais la proposition rcT recalculée)');
      } finally { URL.createObjectURL = vraiCreer; }
    });

    await ecran('T-D13 identifiant à guillemet, octets absents, photo prise ailleurs, « Reclasser »', async (repo, db) => {
      const Q = ['q"1', 'q"2'];
      await poserSeance(repo, db, { id: 'ssq', pages: Q, imports: [ligneClassement({ id: 'imp_q', sessionId: 'ssq', page_ids: Q, over: { resultat: { groupes: [{ page_ids: Q, title: 'Q', printed_page: null, uncertain: false }], orphelines: [], non_classees: [], partagees: [], uncertain: [] } } })] });
      const pq = await monterPanneau(repo, db, { sessionId: 'ssq', importId: 'imp_q' });
      await pret(pq);
      pq.querySelector(`button[data-role="descendre"][data-page="${CSS.escape('q"1')}"]`).click();
      await attendre(async () => (await brouillonEn(db, 'imp_q'))?.groupes?.[0]?.page_ids?.[0] === 'q"2' && document.activeElement?.dataset?.page === 'q"1', 'focus suivi');
      eq(document.activeElement?.dataset?.role, 'descendre', 'T-D13 (M133) : un identifiant de page qui contient « " » — le focus suit quand même (CSS.escape)');
      scene.replaceChildren();
      await poserSeance(repo, db, { id: 'ss_o', sansOctets: ['p3'], imports: [ligneClassement({ id: 'imp_o', sessionId: 'ss_o' })] });
      const po = await monterPanneau(repo, db, { sessionId: 'ss_o', importId: 'imp_o' });
      await attendre(() => po.querySelector('[data-role="raison-lire"]')?.textContent === 'Les photos de cette séance ne sont pas sur cet appareil.', 'octets absents dits');
      eq([boutonLire(po).disabled, po.querySelector('button[data-role="reclasser"]').disabled], [true, true], 'T-D13 (M131) : une page d’un groupe sans octets → « Lire » et « Reclasser » éteints, la raison dite');
      scene.replaceChildren();
      await poserSeance(repo, db, { id: 'ss_pr', imports: [ligneClassement({ id: 'imp_pr', sessionId: 'ss_pr' }), { ...ligneLot({ id: 'imp_autre', sessionId: 'ss_pr', page_ids: ['p3'] }), lot: null }] });
      const pp = await monterPanneau(repo, db, { sessionId: 'ss_pr', importId: 'imp_pr' });
      await attendre(() => pp.querySelector('[data-role="raison-lire"]')?.textContent === '1 photo(s) déjà en cours d’import ailleurs : retire-les de leur recette, ou termine l’autre import.', 'photo prise dite');
      eq([boutonLire(pp).disabled, puces(pp, 'p3')], [true, ['déjà en cours d’import']], 'T-D13 (M139b) : une page tenue par un autre import ouvert de la séance → « déjà en cours d’import », « Lire » éteint et la phrase');
      scene.replaceChildren();
      await poserSeance(repo, db, { id: 'ss_rc', imports: [ligneClassement({ id: 'imp_rc', sessionId: 'ss_rc' })] });
      const ff = fauxFetch();
      const pr = await monterPanneau(repo, db, { sessionId: 'ss_rc', importId: 'imp_rc', over: { fetch: ff.fetch } });
      await pret(pr);
      const avant = await db.get('imports', 'imp_rc');
      reponseConfirmer = false;
      const reclasserAvant = pr.querySelector('button[data-role="reclasser"]');
      reclasserAvant.click();
      await attendre(() => confirmations.length === 1, 'confirmation demandée');
      // Un FAIT, jamais des ticks (R-D-10) : après le « non », classer() sort par son finally (synchroniser, forcé), qui redessine le panneau — un
      // « Reclasser » NEUF ; au redessin, ce qu'un « non » mal tenu aurait écrit ou envoyé l'a été.
      await attendre(() => pr.querySelector('button[data-role="reclasser"]') !== reclasserAvant, 'panneau redessiné après le « non »');
      eq([confirmations[0], ff.appels.length, await db.get('imports', 'imp_rc')], [['Reclasser remplace ce classement et tes changements de groupes, et coûte un appel. Continuer ?', 'Reclasser'], 0, avant], 'T-D13 (M129) : « Reclasser » répondu NON → 0 POST, 0 écriture');
      reponseConfirmer = true;
      window.dispatchEvent(new Event('offline'));
      await attendre(() => pr.querySelector('button[data-role="reclasser"]')?.disabled === true, '« Reclasser » éteint hors ligne');
      eq([pr.querySelector('[data-role="hors-ligne"]')?.textContent, pr.querySelector('[data-role="raison-lire"]')?.textContent, boutonLire(pr).disabled], ['Tu es hors ligne.', 'Tu es hors ligne.', true], 'T-D13 (M-bandeau-hors-ligne, ronde 1, constats 10 et 34) : hors ligne → le bandeau « Tu es hors ligne. » en tête du pied, « Lire » éteint, la raison dite');
      // Éteint, il ne se clique pas (spécification HTML) : RALLUMÉ, pour éprouver la garde de classer() elle-même (un rendu périmé, une course).
      const rc = pr.querySelector('button[data-role="reclasser"]'); rc.disabled = false; rc.click();
      // Un FAIT, jamais des ticks (R-D-10) : classer() sort à la garde réseau par son finally (synchroniser, forcé) — le panneau redessiné n'a plus ce
      // nœud. Le mutant M129b écrit la remise à zéro AVANT la garde : son premier redessin (bus ou finally) vient après son écriture.
      await attendre(() => pr.querySelector('button[data-role="reclasser"]') !== rc, 'panneau redessiné : classer() est sorti à la garde réseau');
      eq([confirmations.length, ff.appels.length, await db.get('imports', 'imp_rc')], [1, 0, avant], 'T-D13 (M129b) : hors ligne, « Reclasser » est éteint ; rallumé et cliqué, classer() s’arrête à la garde réseau — aucune confirmation de plus, 0 POST, 0 écriture, le résultat intact (jamais jeté avant les gardes)');
    });

    await ecran('T-D14 appariement à l’écran', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement(), IMPORT_RCO] });
      const p = await monterPanneau(repo, db);
      await pret(p);
      const zone = (cle) => blocDe(p, cle).querySelector('[data-role="appariement"]');
      const caseDe = (cle) => zone(cle).querySelector('label.check input[type="checkbox"]');
      const ouvrir = (cle) => { zone(cle).querySelector('button[data-role="choisir-reference"]').click(); return zone(cle).querySelector('[data-role="selecteur"]'); };
      const listeDe = (sel) => [...sel.querySelectorAll('button[data-role="reference"]')].map((b) => [b.dataset.id, b.textContent]);
      eq([zone('g1').querySelector('label.check').textContent.trim(), caseDe('g1').checked], ['Complète “Soupe de courge”, p. 132', true], 'T-D14 : g1 cochée, la proposition sûre dite');
      eq([zone('g3').querySelector('label.check').textContent.trim(), caseDe('g3').checked, zone('g3').querySelector('small.muted')?.textContent], ['Complète “Gratin dauphinois”, p. 152 ?', false, 'Titre semblable, page différente ou inconnue.'], 'T-D14 : g3 proposée DÉCOCHÉE, avec « ? » et la raison de son motif');
      caseDe('g1').click();
      await attendre(() => zone('g1').querySelector('p.muted')?.textContent === 'Nouvelle recette — “Soupe de courge” restera repérée.', 'décochée dite');
      eq(caseDe('g1').checked, false, 'T-D14 (M135) : décocher g1 → « Nouvelle recette — “Soupe de courge” restera repérée. »');
      const s2 = ouvrir('g2');
      eq([s2.hidden, zone('g2').querySelector('button[data-role="choisir-reference"]').getAttribute('aria-expanded'), s2.querySelector('input[type="search"]').getAttribute('aria-label'), [...s2.querySelectorAll('button[data-role="reference-occupee"]')].map((b) => [b.dataset.id, b.disabled, b.nextElementSibling?.textContent])], [false, 'true', 'Chercher dans les références de ce livre', [['rcO', true, 'Import en cours — voir Imports']]], 'T-D14 (M113) : « Choisir une référence… » ouvre le sélecteur ; rcO (import ouvert) listée ÉTEINTE, « Import en cours — voir Imports »');
      const champ = s2.querySelector('input[type="search"]');
      champ.focus(); champ.value = 'poire'; champ.dispatchEvent(new Event('input', { bubbles: true }));
      eq([listeDe(s2), document.activeElement === champ], [[['rcP', 'Poire rôtie au miel — p. 140'], ['rcT', 'Tarte aux poires — p. 141']], true], 'T-D14 : saisir « poire » → rcP et rcT listées, libellés « titre — p. N » ; la saisie ne redessine que la liste (le focus reste dans le champ)');
      ouvrir('g3').querySelector('button[data-role="reference"][data-id="rcP"]').click();
      await attendre(() => caseDe('g3')?.checked === true && zone('g3').querySelector('label.check').textContent.trim() === 'Complète “Poire rôtie au miel”, p. 140', 'rcP choisie pour g3');
      eq([zone('g3').querySelector('[data-role="selecteur"]').hidden, zone('g3').querySelector('button[data-role="choisir-reference"]').getAttribute('aria-expanded')], [true, 'false'], 'T-D14 (M-selecteur-ferme, ronde 1, constat 33) : une référence choisie dans le sélecteur → il se referme (aria-expanded="false")');
      const ids = (cle) => [...zone(cle).querySelectorAll('[data-role="selecteur"] button[data-role="reference"]')].map((b) => b.dataset.id);
      eq([ids('g1').includes('rcP'), ids('g2').includes('rcP')], [false, false], 'T-D14 (M79) : rcP choisie pour g3 → absente des sélecteurs de g1 et g2');
      scene.replaceChildren();
      const deuxSures = { groupes: [{ page_ids: ['p1'], title: 'Soupe de courge', printed_page: 132, uncertain: false }, { page_ids: ['p2'], title: 'Soupe de courge', printed_page: 133, uncertain: false }], orphelines: [], non_classees: [], partagees: [], uncertain: [] };
      await poserSeance(repo, db, { id: 'ss_cf', imports: [ligneClassement({ id: 'imp_cf', sessionId: 'ss_cf', page_ids: ['p1', 'p2'], over: { resultat: deuxSures } })] });
      const pc = await monterPanneau(repo, db, { sessionId: 'ss_cf', importId: 'imp_cf' });
      await pret(pc);
      const cas = (cle) => blocDe(pc, cle).querySelector('[data-role="appariement"] label.check input');
      eq([cas('g1').checked, cas('g2').checked, blocDe(pc, 'g1').querySelector('[data-role="appariement"] small')?.textContent], [false, false, 'Une autre recette du lot vise aussi cette référence.'], 'T-D14 (M43 à l’écran) : deux groupes sûrs sur rcS → conflit, les deux décochés, la raison dite');
      cas('g1').click();
      await attendre(() => cas('g2')?.disabled === true, 'case de g2 éteinte');
      eq([cas('g1').checked, cas('g2').disabled, cas('g2').getAttribute('aria-label')], [true, true, 'Déjà choisie pour la recette 1'], 'T-D14 (M79) : une référence cochée pour un groupe est désactivée ailleurs — « Déjà choisie pour la recette 1 »');
      scene.replaceChildren();
      const homonyme = { groupes: [{ page_ids: ['p1'], title: 'Tarte aux pommes', printed_page: null, uncertain: false }], orphelines: [], non_classees: [], partagees: [], uncertain: [] };
      await poserSeance(repo, db, { id: 'ss_h', references: [...REFERENCES_ED, ...HOMONYMES], imports: [ligneClassement({ id: 'imp_h', sessionId: 'ss_h', page_ids: ['p1'], over: { resultat: homonyme } })] });
      const ph = await monterPanneau(repo, db, { sessionId: 'ss_h', importId: 'imp_h' });
      await pret(ph);
      const zh = ph.querySelector('[data-role="appariement"]');
      eq([[...zh.querySelectorAll(':scope > p.muted')].map((x) => x.textContent), zh.querySelector('button[data-role="choisir-reference"]').getAttribute('aria-expanded'), zh.querySelector('[data-role="selecteur"]').hidden, listeDe(zh.querySelector('[data-role="selecteur"]')).slice(0, 2).map(([id]) => id), zh.querySelector('label.check')], [['Plusieurs références possibles.', 'Nouvelle recette'], 'true', false, ['rcH1', 'rcH2'], null], 'T-D14 (M134) : HOMONYMES, page nulle → « Plusieurs références possibles. », rien de coché, le sélecteur OUVERT au premier rendu avec rcH1 puis rcH2 en tête');
      scene.replaceChildren();
      await poserSeance(repo, db, { id: 'ss_sl', edition: null, imports: [ligneClassement({ id: 'imp_sl', sessionId: 'ss_sl' })] });
      const ps = await monterPanneau(repo, db, { sessionId: 'ss_sl', importId: 'imp_sl' });
      await pret(ps);
      eq([ps.querySelector('[data-role="regroupement"] .status.info')?.textContent, ps.querySelectorAll('[data-role="appariement"] input, [data-role="appariement"] button').length], ['Aucun livre associé à cette séance : chaque recette sera une nouvelle recette.', 0], 'T-D14 (D-D16) : séance sans livre → la phrase, aucune case, aucun sélecteur');
      // Ronde 1 (constat 13) : D-D16 — une séance sans livre se LIT (§ 4.5 étape 3 : sans édition, aucune référence) : trois lectures sans référence ni
      // édition, sur la séance ; le lot part.
      scene.replaceChildren();
      const ffl = fauxFetch();
      const psl = await monterPanneau(repo, db, { sessionId: 'ss_sl', importId: 'imp_sl', over: { fetch: ffl.fetch } });
      await pret(psl);
      dits.length = 0; boutonLire(psl).click();
      await attendre(() => dits.length >= 1, 'un toast');
      const sl = (await db.getAll('imports')).filter((i) => i.lot?.classement_id === 'imp_sl').sort((a, b) => a.lot.rang - b.lot.rang);
      eq([dits[0], sl.map((l) => [l.recipe_id, l.edition_id, l.scan_session_id]), (await db.get('imports', 'imp_sl')).status], ['3 recettes à lire : suis-les dans Imports.', [[null, null, 'ss_sl'], [null, null, 'ss_sl'], [null, null, 'ss_sl']], 'enregistre'], 'T-D14 (M-DD16-creation, ronde 1, constat 13) : séance sans livre, « Lire » → trois lectures neuves (recipe_id et edition_id nuls, la séance), le classement enregistre, le toast du succès');
      await attendre(() => G.lotEnCours()?.classementId === 'imp_sl' && ffl.appels.length === 1, 'le lot lit la première');
      await UI.annulerVol(sl[0].id);
      await attendre(() => G.lotEnCours() === null, 'lot arrêté');
    });

    await ecran('T-D15 « Lire ces recettes » : une transaction gardée, puis le lot', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const ff = fauxFetch(); // la lecture du lot reste suspendue : la création se lit seule
      let troisieme = null;
      // lireRecettes lit repo.deviceId() en passant ses arguments à creerLesLectures, sans autre attente que le brouillon en vol (nul ici : `pret`) :
      // un appel par entrée qui passe le verrou d'instance (lireLeLot, lui, ne le lit qu'APRÈS la création, des transactions plus tard).
      let entreesLire = 0;
      const espion = { ...repo, deviceId: () => { entreesLire += 1; return repo.deviceId(); }, transitionner: async (store, key, opts) => { if (key === 'imp_cl' && opts?.puts?.imports) troisieme = opts; return repo.transitionner(store, key, opts); } };
      const p = await monterPanneau(repo, db, { over: { repo: espion, fetch: ff.fetch } });
      await pret(p);
      blocDe(p, 'g1').querySelector('button[data-role="monter"][data-page="p3"]').click();
      await attendre(async () => JSON.stringify((await brouillonEn(db, 'imp_cl'))?.groupes?.[0]?.page_ids) === JSON.stringify(['p3', 'p1']), 'ordre [p3, p1] gardé');
      await pret(p);
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push((m.puts.imports || []).map((i) => [i.id, i.status, i.lot?.rang ?? null])); return capture ? capture(m) : {}; };
      try {
        const b = boutonLire(p); const avantLire = entreesLire; b.click(); b.click();
        for (let k = 0; k < 5; k += 1) await Promise.resolve(); // des microtâches seulement : aucune transaction IndexedDB ne se termine entre deux
        eq(entreesLire - avantLire, 1, 'T-D15 (M86) : double clic → lireRecettes n’entre qu’UNE fois (verrou d’instance avant tout await)');
        await attendre(() => navs.includes('/add?section=imports'), 'navigation vers Imports');
      } finally { db.onMutate = capture; }
      const creation = vus.filter((v) => v.some(([id, status]) => id === 'imp_cl' && status === 'enregistre'));
      eq([creation.length, creation[0]?.length, creation[0]?.filter(([id]) => id !== 'imp_cl').map(([, status, rang]) => [status, rang])], [1, 4, [['a_lancer', 1], ['a_lancer', 2], ['a_lancer', 3]]], 'T-D15 (M80, M86) : UNE transaction (double clic compris) — les trois lignes neuves ET le classement enregistre dans le même appel de db.onMutate');
      eq([troisieme?.attendus, typeof troisieme?.patch, troisieme?.conditions?.imports?.filter((c) => c.absente === true).length, troisieme?.conditions?.imports?.filter((c) => c.index === 'recipe_id').map((c) => c.valeur)], [['a_verifier'], 'function', 3, ['rcS', 'rcT']], 'T-D15 (M81, M82) : le troisième argument porte attendus [a_verifier], un patch-FONCTION, trois conditions absente et une condition d’index par référence cochée (rcS, rcT)');
      eq(troisieme?.conditions?.imports?.filter((c) => c.index === 'recipe_id').map((c) => [c.valeur, c.exclus]), [['rcS', I.IMPORTS_OUVERTS], ['rcT', I.IMPORTS_OUVERTS]], 'T-D15 (M82-exclus, ronde 1, constat 2) : chaque condition d’index exclut EXACTEMENT les statuts ouverts (IMPORTS_OUVERTS) — jamais une condition inerte');
      const neuves = (await db.getAll('imports')).filter((i) => i.kind === 'recette').sort((a, b) => a.lot.rang - b.lot.rang);
      eq(neuves.map((l) => [l.recipe_id, l.page_ids, l.scan_session_id, l.edition_id, l.device_id, l.lot]), [['rcS', ['p3', 'p1'], 'ss1', 'ed1', repo.deviceId(), { classement_id: 'imp_cl', rang: 1, total: 3, titre: 'Soupe de courge', page: 132 }], ['rcT', ['p2'], 'ss1', 'ed1', repo.deviceId(), { classement_id: 'imp_cl', rang: 2, total: 3, titre: 'Tarte fine aux poires', page: 140 }], [null, ['p5'], 'ss1', 'ed1', repo.deviceId(), { classement_id: 'imp_cl', rang: 3, total: 3, titre: 'Gratin dauphinois', page: 148 }]], 'T-D15 (M141) : trois lignes — référence cochée ou nulle, l’ordre CHOISI [p3, p1], la séance, son édition, cet appareil, le lot');
      const cl = await db.get('imports', 'imp_cl');
      eq([cl.status, cl.reponse_brute, cl.brouillon, cl.finished_at, dits, navs.at(-1)], ['enregistre', null, null, NOW, ['3 recettes à lire : suis-les dans Imports.'], '/add?section=imports'], 'T-D15 (ronde 1, constat 30 : finished_at = l’horloge injectée) : classement enregistre (réponse brute et brouillon effacés, finished_at) ; UN toast, celui du succès (aucun refus d’un second geste) ; la navigation vers Imports');
      await attendre(() => G.lotEnCours()?.classementId === 'imp_cl' && ff.appels.length === 1, 'le lot lit la première');
      await UI.annulerVol(neuves[0].id);
      await attendre(() => G.lotEnCours() === null, 'lot arrêté');
    });

    await ecran('T-D15 refus : référence prise, classement remplacé (avant et dans la transaction), livre changé, photo prise, octets absents', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const ff = fauxFetch();
      const avant = await db.get('imports', 'imp_cl');
      const RIEN = 'Rien n’a été lancé : ce classement, le livre de la séance ou une référence choisie a changé entre-temps.';
      const monter = async (over = {}) => { scene.replaceChildren(); const p = await monterPanneau(repo, db, { over: { fetch: ff.fetch, ...over } }); await pret(p); return p; };
      // Chaque altération passe par db.mutate (aucun événement du bus) : le panneau garde le rendu d'avant, comme un autre onglet le laisserait.
      const essayer = async (p, toastAttendu) => { const n = (await db.getAll('imports')).length; dits.length = 0; boutonLire(p).click(); await attendre(() => dits.length >= 1, 'toast de refus'); return [dits[0] === toastAttendu, (await db.getAll('imports')).length - n, (await db.get('imports', 'imp_cl')).status]; };
      let p = await monter();
      await db.mutate({ puts: { imports: [{ ...IMPORT_RCO, id: 'imp_rcs', recipe_id: 'rcS', scan_session_id: 'ss_x' }] }, origin: 'device' });
      eq(await essayer(p, RIEN), [true, 0, 'a_verifier'], 'T-D15 (M85) : un import ouvert sur rcS créé entre le rendu et le clic → rien d’écrit, classement a_verifier, « Rien n’a été lancé : … »');
      await db.mutate({ deletes: { imports: ['imp_rcs'] }, origin: 'device' });
      p = await monter();
      const autreResultat = { ...R5_STOCKE, uncertain: ['reclassé ailleurs'] };
      await db.mutate({ puts: { imports: [{ ...avant, started_at: NOW, resultat: autreResultat }] }, origin: 'device' });
      eq([await essayer(p, RIEN), (await db.get('imports', 'imp_cl')).resultat], [[true, 0, 'a_verifier'], autreResultat], 'T-D15 (M136) : un « Reclasser » d’un autre onglet entre le rendu et le clic → 0 écriture, le nouveau résultat intact');
      await db.mutate({ puts: { imports: [avant] }, origin: 'device' });
      let altere = false;
      const espion = { ...repo, transitionner: async (store, key, opts) => { if (key === 'imp_cl' && opts?.puts?.imports && !altere) { altere = true; await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'imp_cl')), started_at: NOW }] }, origin: 'device' }); } return repo.transitionner(store, key, opts); } };
      p = await monter({ repo: espion });
      eq([await essayer(p, RIEN), altere], [[true, 0, 'a_verifier'], true], 'T-D15 (M137) : la même altération faite ENTRE l’étape 1 et la transaction → TransitionRefusee (garde rejouée DANS la transaction), rien d’écrit');
      await db.mutate({ puts: { imports: [avant] }, origin: 'device' });
      p = await monter();
      const seance = await db.get('scan_sessions', 'ss1');
      await db.mutate({ puts: { scan_sessions: [{ ...seance, edition_id: 'ed2' }] }, origin: 'device' });
      eq(await essayer(p, RIEN), [true, 0, 'a_verifier'], 'T-D15 (M138) : le livre de la séance changé entre le rendu et le clic → refuse(edition), 0 écriture');
      await db.mutate({ puts: { scan_sessions: [seance] }, origin: 'device' });
      p = await monter();
      await db.mutate({ puts: { imports: [{ ...IMPORT_RCO, id: 'imp_p5', recipe_id: null, scan_session_id: 'ss1', page_ids: ['p5'] }] }, origin: 'device' });
      eq(await essayer(p, 'Rien n’a été lancé : une photo est déjà en cours d’import ailleurs.'), [true, 0, 'a_verifier'], 'T-D15 (M139) : une photo d’un groupe prise par un autre import ouvert → refuse(pages), 0 écriture');
      await db.mutate({ deletes: { imports: ['imp_p5'] }, origin: 'device' });
      // Ronde 1 (constat 1, M85-pre-seul) : une référence cochée qui n'est plus candidate SANS import ouvert — devenue available, signet (source_url) ou
      // supprimée — n'est refusée QUE par le pré-contrôle (la condition d'index ne voit que les imports ouverts) : rien d'écrit.
      const rcS = await db.get('recipes', 'rcS');
      for (const [libelle, alteration] of [['devenue available', { puts: { recipes: [{ ...rcS, availability: 'available' }] } }], ['devenue un signet (source_url)', { puts: { recipes: [{ ...rcS, source_url: 'https://exemple.test/soupe-2' }] } }], ['supprimée', { deletes: { recipes: ['rcS'] } }]]) {
        p = await monter();
        await db.mutate({ ...alteration, origin: 'device' });
        eq(await essayer(p, RIEN), [true, 0, 'a_verifier'], `T-D15 (M85-pre-seul, ronde 1, constat 1) : rcS cochée au rendu puis ${libelle}, SANS import ouvert → refuse(reference) par le pré-contrôle (la condition d’index ne la voit pas) : 0 écriture, classement a_verifier`);
        await db.mutate({ puts: { recipes: [rcS] }, origin: 'device' });
      }
      // Ronde 1 (constats 2 et 5) : la condition d'index joue DANS la transaction — un import ouvert sur rcS posé par l'espion juste avant elle (APRÈS le
      // pré-contrôle, pendant les lectures d'octets : un autre onglet) → TransitionRefusee → refuse(transition), aucune ligne.
      let pose = false;
      const espionIdx = { ...repo, transitionner: async (store, key, opts) => { if (key === 'imp_cl' && opts?.puts?.imports && !pose) { pose = true; await db.mutate({ puts: { imports: [{ ...IMPORT_RCO, id: 'imp_rcs_tx', recipe_id: 'rcS', scan_session_id: 'ss_x' }] }, origin: 'device' }); } return repo.transitionner(store, key, opts); } };
      p = await monter({ repo: espionIdx });
      dits.length = 0; boutonLire(p).click();
      await attendre(() => dits.length >= 1, 'toast de refus');
      eq([dits[0], pose, (await db.getAll('imports')).filter((i) => i.lot?.classement_id === 'imp_cl').length, (await db.get('imports', 'imp_cl')).status], [RIEN, true, 0, 'a_verifier'], 'T-D15 (M82-exclus, ronde 1, constats 2 et 5) : un import ouvert sur une référence cochée posé ENTRE le pré-contrôle et la transaction → la condition d’index refuse DANS la transaction : refuse(transition), aucune ligne, classement a_verifier (I-D7 : jamais deux imports ouverts sur rcS)');
      await db.mutate({ deletes: { imports: ['imp_rcs_tx'] }, origin: 'device' });
      // Ronde 1 (constat 16, M136-pre-seul) : reclassé ailleurs sur MOINS de pages (nouvelle clé, page_ids [p1, p2]) → la garde de clé de l'étape 1 refuse
      // AVANT lecturesDuLot, qui lèverait sur les pages rendues hors du classement (un clic sans retour) : le refus est dit.
      p = await monter();
      const deuxGroupes = { groupes: [{ page_ids: ['p1'], title: 'Soupe de courge', printed_page: 132, uncertain: false }, { page_ids: ['p2'], title: 'Tarte fine aux poires', printed_page: 140, uncertain: false }], orphelines: [], non_classees: [], partagees: [], uncertain: [] };
      await db.mutate({ puts: { imports: [{ ...avant, started_at: NOW, page_ids: ['p1', 'p2'], resultat: deuxGroupes }] }, origin: 'device' });
      eq(await essayer(p, RIEN), [true, 0, 'a_verifier'], 'T-D15 (M136-pre-seul, ronde 1, constat 16) : reclassé ailleurs sur moins de pages → « Rien n’a été lancé : … » par la garde de clé de l’étape 1 (jamais la levée muette de lecturesDuLot), 0 écriture');
      await db.mutate({ puts: { imports: [avant] }, origin: 'device' });
      p = await monter();
      await db.mutate({ deletes: { files: [(await db.get('source_pages', 'p5')).sha256] }, origin: 'device' });
      eq([await essayer(p, 'Les photos de cette séance ne sont pas sur cet appareil.'), ff.appels.length], [[true, 0, 'a_verifier'], 0], 'T-D15 (M140) : une photo d’un groupe sans octets → refuse(octets_absents), AUCUNE ligne, aucun POST');
    });

    // Vérification de la tâche 3 (D-D23, § 4.5 « cle et editionId = ceux du rendu ») : la séance et les recettes relues PAR LE BUS ne redessinent pas
    // le panneau (sa signature ne les porte pas) ; le clic doit alors agir sur ce qui est RENDU — jamais sur un redessin fait au clic, que la personne n'a
    // pas vu. Le fait attendu avant le clic : les trois lectures de LA relecture que l'écriture déclenche (séance, journal, recettes), comptées par
    // l'espion — le montage n'en lance aucune, chaque bloc a sa base et son espion : rien d'autre ne les compte.
    const relectureEspion = (repo) => {
      const lus = { scan_sessions: 0, imports: 0, recipes: 0 };
      const compter = (s) => { if (Object.hasOwn(lus, s)) lus[s] += 1; };
      const espion = { ...repo, get: async (s, k) => { const r = await repo.get(s, k); compter(s); return r; }, all: async (s) => { const r = await repo.all(s); compter(s); return r; } };
      const relu = async (ecrire) => { const avant = { ...lus }; await ecrire(); await attendre(() => Object.keys(lus).every((s) => lus[s] > avant[s]), 'séance, journal et recettes relus par le panneau'); };
      return { espion, relu };
    };
    const RIEN_LIRE = 'Rien n’a été lancé : ce classement, le livre de la séance ou une référence choisie a changé entre-temps.';
    const essayerLire = async (p, db) => { const n = (await db.getAll('imports')).length; dits.length = 0; boutonLire(p).click(); await attendre(() => dits.length >= 1, 'un toast'); return [dits[0], (await db.getAll('imports')).length - n, (await db.get('imports', 'imp_cl')).status]; };

    await ecran('T-D15 (vérification) livre de la séance relu par le bus sans redessin : le clic garde l’édition RENDUE', async (repo, db) => {
      // Aucune référence : aucun choix (tous nuls) — seule la garde d'édition peut refuser.
      await poserSeance(repo, db, { references: [], imports: [ligneClassement()] });
      const ff = fauxFetch();
      const { espion, relu } = relectureEspion(repo);
      let p = await monterPanneau(repo, db, { over: { repo: espion, fetch: ff.fetch } });
      await pret(p);
      const seance = await db.get('scan_sessions', 'ss1');
      await relu(async () => {
        await db.mutate({origin:'remote',puts:{book_editions:[{id:'ed2',book_id:'b1'}],scan_sessions:[{...seance,edition_id:'ed2'}],
          source_pages:(await db.getAll('source_pages')).map(p=>({...p,edition_id:'ed2'})),
          imports:[{...await db.get('imports','imp_cl'),edition_id:'ed2',expected_edition_id:'ed1'}]}});
        emit('change',{store:'scan_sessions'});
      });
      eq([...(await essayerLire(p, db)), ff.appels.length], [RIEN_LIRE, 0, 'a_verifier', 0], 'T-D15 (M-rendu, M-rendu-edition, vérification) : le livre de la séance changé ICI (le bus relit la séance, sans redessin) → refuse(edition) : l’édition RENDUE part, jamais celle relue ni celle d’un redessin fait au clic ; rien d’écrit, 0 POST');
      // L2 : aucun changement de base implicite au redessin. Rouvrir puis relire le résultat payé adopte le livre montré.
      await attendre(()=>p.querySelector('[data-role=relecture-classement]'),'base ancienne signalée');
      ok(boutonLire(p).disabled,'L2 T-D15 : ancien panneau ne se réarme pas sur une autre édition');
      p.remove();p=await monterPanneau(repo,db,{over:{fetch:ff.fetch}});
      await attendre(()=>p.querySelector('[data-role=relecture-classement]'),'relecture offerte après remontage');
      [...p.querySelectorAll('button')].find(b=>b.textContent==='Réutiliser ce résultat après relecture').click();
      await pret(p);
      dits.length = 0; boutonLire(p).click();
      await attendre(() => dits.length >= 1, 'un toast');
      const surEd2 = (await db.getAll('imports')).filter((i) => i.lot?.classement_id === 'imp_cl').sort((a, b) => a.lot.rang - b.lot.rang);
      eq([dits[0], surEd2.map((l) => l.edition_id)], ['3 recettes à lire : suis-les dans Imports.', ['ed2', 'ed2', 'ed2']], 'T-D15 (M-redessin-refus, M-editionId-rendu, M-edition-relue, ronde 1, constat 12) : après refus puis remontage et relecture explicite, le clic crée trois lectures sur ed2 sans payer un nouveau classement');
      await attendre(() => G.lotEnCours()?.classementId === 'imp_cl' && ff.appels.length === 1, 'le lot lit la première');
      await UI.annulerVol(surEd2[0].id);
      await attendre(() => G.lotEnCours() === null, 'lot arrêté');
    });

    await ecran('T-D15 (vérification) référence prise, relue par le bus sans redessin : le clic garde les choix RENDUS', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const ff = fauxFetch();
      const { espion, relu } = relectureEspion(repo);
      const p = await monterPanneau(repo, db, { over: { repo: espion, fetch: ff.fetch } });
      await pret(p);
      eq(blocDe(p, 'g1').querySelector('[data-role="appariement"] label.check input')?.checked, true, 'T-D15 (vérification) : rcS cochée pour g1 au rendu');
      await relu(async () => { await db.mutate({ puts: { imports: [{ ...IMPORT_RCO, id: 'imp_rcs2', recipe_id: 'rcS', scan_session_id: 'ss_x' }] }, origin: 'device' }); emit('change', { store: 'imports' }); });
      eq([...(await essayerLire(p, db)), ff.appels.length], [RIEN_LIRE, 0, 'a_verifier', 0], 'T-D15 (M-rendu, vérification) : rcS prise ailleurs, relue par le bus sans redessin → refuse(reference) : le choix RENDU part — jamais une « nouvelle recette » silencieuse recalculée au clic ; rien d’écrit, 0 POST');
    });

    // Vérification de la tâche 3 (§ 4.5, étape 1) : page_ids n'entre pas dans la clé (cleClassement : id, started_at, resultat) — une ligne réécrite
    // ailleurs sans une de ses pages garde sa clé, mais son résultat ne se revalide plus : refuse(classement), jamais une levée ni une écriture.
    await ecran('T-D15 (vérification) creerLesLectures : un résultat qui ne se revalide plus sous la même clé → refuse(classement)', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const L = await db.get('imports', 'imp_cl');
      const ctx = await ctxDe(repo, db);
      await db.mutate({ puts: { imports: [{ ...L, page_ids: ['p1', 'p2', 'p3', 'p4'] }] }, origin: 'device' });
      const n = (await db.getAll('imports')).length;
      const r = await G.creerLesLectures('imp_cl', { cle: C.cleClassement(L), editionId: 'ed1', etat: C.regroupementInitial(L.resultat, ctx.pagesById), choix: new Map(), ctx, repo, maintenant: () => NOW, newId: repo.newId, deviceId: repo.deviceId() });
      eq([r, (await db.getAll('imports')).length - n, (await db.get('imports', 'imp_cl')).status], [{ issue: 'refuse', raison: 'classement' }, 0, 'a_verifier'], 'T-D15 (M-revalider, vérification) : même clé, page_ids réécrits sans p5 → le résultat ne se revalide plus → refuse(classement), rien d’écrit (jamais la levée de lecturesDuLot)');
    });

    await ecran('T-D16 lecture du lot : séquentielle, dans l’ordre, erreur de groupe, rien sur une recette', async (repo, db) => {
      await poserSeance(repo, db);
      const moi = repo.deviceId();
      // Identifiants À REBOURS des rangs (l_c rang 1, l_b rang 2, l_a rang 3) : byIndex rend une même valeur d'index dans l'ordre des clés — seul le tri
      // par rang de lireLeLot fait partir l_c d'abord (M84, M84b) ; en production, les identifiants viennent de newId, dans un ordre quelconque.
      await db.mutate({ puts: { imports: [ligneLot({ id: 'l_c', rang: 1, page_ids: ['p1', 'p3'], device_id: moi }), ligneLot({ id: 'l_b', rang: 2, page_ids: ['p2'], device_id: moi }), ligneLot({ id: 'l_a', rang: 3, page_ids: ['p5'], device_id: moi })] }, origin: 'device' });
      const ff = fauxFetch();
      const ctx = await ctxDe(repo, db);
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push(Object.keys(m.puts)); return capture ? capture(m) : {}; };
      let fin;
      try {
        const course = G.lireLeLot('imp_cl', { ctx, repo, fetch: ff.fetch, maintenant: () => NOW });
        await attendre(() => ff.appels.length === 1 && G.lotEnCours()?.classementId === 'imp_cl', 'premier POST');
        eq((await db.get('imports', 'l_c')).started_at, NOW, 'T-D16 (M-maintenant, ronde 1, constat 31) : lireLeLot transmet l’horloge injectée à lancerExtraction — started_at = NOW');
        await tick(); await tick();
        eq([ff.appels.length, (await db.get('imports', 'l_c')).status, (await db.get('imports', 'l_b')).status, await G.lireLeLot('imp_cl', { ctx, repo, fetch: ff.fetch })], [1, 'en_cours', 'a_lancer', { issue: 'refuse', raison: 'lot_tenu' }], 'T-D16 (M83, M90) : UN seul POST en vol (la ligne de rang 1) ; un second lireLeLot pendant → refuse(lot_tenu)');
        ff.rendre[0](200, corpsModele(RECETTE_LUE()));
        await attendre(() => ff.appels.length === 2, 'second POST');
        eq([(await db.get('imports', 'l_c')).status, (await db.get('imports', 'l_b')).status, (await db.get('imports', 'l_a')).status], ['a_verifier', 'en_cours', 'a_lancer'], 'T-D16 (M84, M84b) : la réponse du premier rendue → le second part, dans l’ordre des RANGS (jamais celui des identifiants)');
        ff.rendre[1](200, corpsModele(RECETTE_LUE(), { stop_reason: 'max_tokens' }));
        await attendre(() => ff.appels.length === 3, 'troisième POST');
        ff.rendre[2](200, corpsModele(RECETTE_LUE()));
        fin = await course;
      } finally { db.onMutate = capture; }
      eq([fin, (await db.get('imports', 'l_b')).erreur?.raison, (await db.get('imports', 'l_a')).status, G.lotEnCours()], [{ issue: 'fini', lues: 2, echecs: 1, sautees: 0, arret: null }, 'coupe', 'a_verifier', null], 'T-D16 (M87) : [ok, coupe, ok] → a_verifier, echec(coupe), a_verifier, 3 POST (une erreur propre au groupe n’arrête pas le lot) ; lot libéré');
      eq(vus.some((k) => k.includes('recipes') || k.includes('recipe_versions')), false, 'T-D16 (M92) : aucune écriture recipes ni recipe_versions pendant tout le lot (rien n’est écrit sur une recette)');
    });

    await ecran('T-D16 défaut fermé : quota, 400 relayé et 200 illisible arrêtent ; 413 continue ; Annuler arrête', async (repo, db) => {
      await poserSeance(repo, db);
      const moi = repo.deviceId();
      const ctx = await ctxDe(repo, db);
      const lot3 = (cl) => db.mutate({ puts: { imports: [1, 2, 3].map((r) => ligneLot({ id: `${cl}_${r}`, classementId: cl, rang: r, page_ids: [PAGES_5[r - 1]], device_id: moi })) }, origin: 'device' });
      const statuts = (cl) => Promise.all([1, 2, 3].map(async (r) => (await db.get('imports', `${cl}_${r}`)).status));
      const ARRETS = { quota: 'quota', relaye: 'requete', illisible: 'reponse_illisible' }; // ronde 1 (constat 31) : la raison exacte de l'arrêt
      for (const [cl, rep, libelle] of [
        ['quota', [429, { erreur: 'quota', quota: 60 }], 'T-D16 (M88) : un 429 écrit par la passerelle (quota) → 1 POST, les deux suivantes restent a_lancer'],
        ['relaye', [400, { type: 'error', error: { type: 'invalid_request_error', message: 'credit balance' } }], 'T-D16 (M116) : un 400 relayé sans champ erreur (requete : crédit épuisé, plafond) → 1 POST, arrêt'],
        ['illisible', [200, 'pas du json'], 'T-D16 (M117) : un 200 illisible (reponse_illisible) → 1 POST, arrêt'],
      ]) {
        await lot3(cl);
        const f = fauxFetch(rep);
        const r = await G.lireLeLot(cl, { ctx, repo, fetch: f.fetch, maintenant: () => NOW });
        eq([f.appels.length, await statuts(cl), r.arret !== null], [1, ['echec', 'a_lancer', 'a_lancer'], true], libelle);
        eq(r.arret, ARRETS[cl], `T-D16 (M-arret, ronde 1, constat 31) : l’arrêt du lot nomme sa raison (${ARRETS[cl]}), jamais une valeur constante`);
      }
      await lot3('lourd');
      const f413 = fetchSuite([[413, { erreur: 'trop_lourd' }], [200, corpsModele(RECETTE_LUE())], [200, corpsModele(RECETTE_LUE())]]);
      await G.lireLeLot('lourd', { ctx, repo, fetch: f413.fetch, maintenant: () => NOW });
      eq([f413.appels.length, await statuts('lourd'), (await db.get('imports', 'lourd_1')).erreur], [3, ['echec', 'a_verifier', 'a_verifier'], { raison: 'requete', extra: { trop_lourd: true } }], 'T-D16 (M142) : [413 écrit (trop_lourd), ok, ok] → 3 POST — cette demande-ci est trop lourde, la suivante peut passer');
      await lot3('annule');
      const fa = fauxFetch();
      const course = G.lireLeLot('annule', { ctx, repo, fetch: fa.fetch, maintenant: () => NOW });
      await attendre(() => fa.appels.length === 1, 'premier POST');
      await UI.annulerVol('annule_1');
      // Ronde 1 de T6 (R-D-10) : attendre un FAIT, borné — un lot qui ne s'arrête pas après « Annuler » (M53, M84) rougit ici, nommé, au lieu
      // de figer la suite.
      let lotFini = false; course.then(() => { lotFini = true; }, () => { lotFini = true; });
      await attendre(() => lotFini, 'lot arrêté après « Annuler »');
      await course;
      eq([fa.appels.length, await statuts('annule')], [1, ['echec', 'a_lancer', 'a_lancer']], 'T-D16 (M89) : « Annuler » du premier (annulerVol) → arrêt du lot');
      // Ronde 1 (constat 31) : enLigne est TRANSMIS à lancerExtraction — injecté hors ligne, le lot s'arrête à la première, aucun POST.
      await lot3('horsligne');
      const fh = fauxFetch([200, corpsModele(RECETTE_LUE())]);
      eq([await G.lireLeLot('horsligne', { ctx, repo, fetch: fh.fetch, maintenant: () => NOW, enLigne: () => false }), fh.appels.length, await statuts('horsligne')], [{ issue: 'fini', lues: 0, echecs: 0, sautees: 0, arret: 'hors_ligne' }, 0, ['a_lancer', 'a_lancer', 'a_lancer']], 'T-D16 (M-enLigne, ronde 1, constat 31) : enLigne injecté (hors ligne) → arrêt hors_ligne à la première, 0 POST, les trois restent a_lancer');
      // Ronde 1 (constat 11, I-D5) : le lot est posé AVANT tout await — deux lireLeLot dans le MÊME tour : le second est refusé lot_tenu.
      await lot3('double');
      const fd = fauxFetch([200, corpsModele(RECETTE_LUE())]);
      const premier = G.lireLeLot('double', { ctx, repo, fetch: fd.fetch, maintenant: () => NOW });
      const second = G.lireLeLot('double', { ctx, repo, fetch: fd.fetch, maintenant: () => NOW });
      eq([await second, await premier, fd.appels.length], [{ issue: 'refuse', raison: 'lot_tenu' }, { issue: 'fini', lues: 3, echecs: 0, sautees: 0, arret: null }, 3], 'T-D16 (M-lot-avant-await, ronde 1, constat 11) : deux lireLeLot dans le même tour, sans await entre eux → le second rend refuse(lot_tenu), le premier lit seul ses trois lignes');
      // Ronde 1 (constat 31) : battementMs est TRANSMIS — à 20 ms, au moins deux battements pendant un vol suspendu (le défaut de 15 s n'en ferait aucun).
      await db.mutate({ puts: { imports: [ligneLot({ id: 'bt_1', classementId: 'bt', rang: 1, total: 1, page_ids: ['p1'], device_id: moi })] }, origin: 'device' });
      let battements = 0;
      const repoB = { ...repo, battre: (id, q) => { battements += 1; return repo.battre(id, q); } };
      const fbt = fauxFetch();
      const courseB = G.lireLeLot('bt', { ctx, repo: repoB, fetch: fbt.fetch, maintenant: () => NOW, battementMs: 20 });
      await attendre(() => fbt.appels.length === 1 && battements >= 2, 'deux battements pendant le vol');
      fbt.rendre[0](200, corpsModele(RECETTE_LUE()));
      eq([(await courseB).lues, battements >= 2], [1, true], 'T-D16 (M-battementMs, ronde 1, constat 31) : battementMs injecté (20 ms) → le battement bat pendant le vol, puis la lecture finit');
    });

    await ecran('T-D16 sauts, ligne passée echec, second passage, battement, libération dite', async (repo, db) => {
      await poserSeance(repo, db, { sansOctets: ['p4'] });
      const moi = repo.deviceId();
      const ctx = await ctxDe(repo, db);
      await db.mutate({ puts: { imports: [ligneLot({ id: 'o1', classementId: 'cl_o', rang: 1, page_ids: ['p1'], device_id: moi }), ligneLot({ id: 'o2', classementId: 'cl_o', rang: 2, page_ids: ['p4'], device_id: moi }), ligneLot({ id: 'o3', classementId: 'cl_o', rang: 3, page_ids: ['p5'], device_id: moi })] }, origin: 'device' });
      const fo = fauxFetch([200, corpsModele(RECETTE_LUE())]);
      eq([await G.lireLeLot('cl_o', { ctx, repo, fetch: fo.fetch, maintenant: () => NOW }), fo.appels.length, (await db.get('imports', 'o2')).status], [{ issue: 'fini', lues: 2, echecs: 0, sautees: 1, arret: null }, 2, 'a_lancer'], 'T-D16 : octets_absents sur le second → sauté (il reste a_lancer), le troisième lu');
      await db.mutate({ puts: { imports: [ligneLot({ id: 't1', classementId: 'cl_t', rang: 1, total: 2, page_ids: ['p1'], device_id: moi }), ligneLot({ id: 't2', classementId: 'cl_t', rang: 2, total: 2, page_ids: ['p2'], device_id: moi })] }, origin: 'device' });
      const base = fauxFetch([200, corpsModele(RECETTE_LUE())]);
      let crochet = true;
      const fetchCrochet = async (u, o) => { if (crochet) { crochet = false; await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 't2')), status: 'echec', erreur: { raison: 'serveur', extra: {} } }] }, origin: 'device' }); } return base.fetch(u, o); };
      eq([await G.lireLeLot('cl_t', { ctx, repo, fetch: fetchCrochet, maintenant: () => NOW }), base.appels.length, (await db.get('imports', 't2')).status], [{ issue: 'fini', lues: 1, echecs: 0, sautees: 1, arret: null }, 1, 'echec'], 'T-D16 (M143) : une ligne passée echec entre le gel et son tour (écrite pendant le premier POST) → refusée transition AVANT tout POST, sautée ; le lot ne relance jamais un échec');
      await db.mutate({ puts: { imports: [ligneLot({ id: 's3', classementId: 'cl_s', rang: 3, total: 4, page_ids: ['p5'], device_id: moi }), ligneLot({ id: 's1', classementId: 'cl_s', rang: 1, total: 4, page_ids: ['p1'], device_id: moi, status: 'a_verifier' }), ligneLot({ id: 's2', classementId: 'cl_s', rang: 2, total: 4, page_ids: ['p2'], device_id: 'dev_autre' }), ligneLot({ id: 's4', classementId: 'cl_s', rang: 4, total: 4, page_ids: ['p3'], device_id: moi })] }, origin: 'device' });
      // Les départs relevés PAR LA BASE (db.onMutate : chaque ligne écrite en_cours, une fois) — jamais par la forme du patch : le départ part par le
      // patch-FONCTION memesPages (vague finale du lot A), comme « appels + 1 ».
      const ordre = []; const captureS = db.onMutate;
      db.onMutate = (m) => { for (const i of (m.puts.imports || [])) if (i?.status === 'en_cours' && !ordre.includes(i.id)) ordre.push(i.id); return captureS ? captureS(m) : {}; };
      try { await G.lireLeLot('cl_s', { ctx, repo, fetch: fauxFetch([200, corpsModele(RECETTE_LUE())]).fetch, maintenant: () => NOW }); }
      finally { db.onMutate = captureS; }
      eq(ordre, ['s3', 's4'], 'T-D16 (M91) : second passage — seules les a_lancer de CET appareil, dans l’ordre des rangs (départs relevés par la base)');
      const { installCapture } = await import('../src/sync/outbox.js');
      await db.mutate({ puts: { imports: [ligneLot({ id: 'b1', classementId: 'cl_b', rang: 1, total: 1, page_ids: ['p1'], device_id: moi })] }, origin: 'device' });
      const fb = fauxFetch();
      const course = G.lireLeLot('cl_b', { ctx, repo, fetch: fb.fetch, battementMs: 20 }); // horloge réelle : le battement est frais
      await attendre(() => fb.appels.length === 1, 'POST en vol');
      installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
      await repo.init();
      eq((await db.get('imports', 'b1')).status, 'en_cours', 'T-D16 : repo.init() rejoué pendant un vol au battement frais → la ligne reste en_cours (règle de T6 du lot A)');
      fb.rendre[0](200, corpsModele(RECETTE_LUE()));
      await course;
      const evts = []; const off = on('change', (pl) => evts.push(pl?.store));
      const ecritures = []; const capture = db.onMutate;
      db.onMutate = (m) => { ecritures.push(1); return capture ? capture(m) : {}; };
      let vide;
      try { vide = await G.lireLeLot('cl_vide', { ctx, repo, fetch: fauxFetch().fetch }); }
      finally { off(); db.onMutate = capture; }
      eq([vide, evts.filter((s) => s === 'imports').length, ecritures.length], [{ issue: 'fini', lues: 0, echecs: 0, sautees: 0, arret: null }, 2, 0], 'T-D16 (M144) : la prise et la libération du lot émettent chacune un change « imports », sans aucune écriture (« Lecture du lot en cours… » ne reste jamais affiché)');
    });

    // =================================================================================================================================
    // Tâche 3, ronde 1 (revue adverse à trois lentilles de c7e826b) : chaque assertion nomme le constat et le mutant qu'elle tue ; celles qui éprouvent un
    // comportement NEUF de la ronde (constats 17, 19, 25 à 29) ont été lues ROUGES sur le code de c7e826b avant d'être rendues vertes.
    await ecran('T-D13 (ronde 1) « Reclasser » : la ligne reclassée ailleurs ou le réseau coupé PENDANT la question → rien d’écrit, 0 POST', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const ff = fauxFetch();
      // (a) D-D23 : pendant le dialogue, un autre onglet reclasse (autre started_at, autre résultat, son brouillon ; db.mutate, sans bus) ; « oui » ici →
      // la garde de clé du patch-fonction refuse DANS la transaction (la ligne a été relue AVANT la question, jamais après).
      const autreResultat = { ...R5_STOCKE, uncertain: ['reclassé ailleurs'] };
      let B = null;
      const confirmerEcrit = async (message, o) => {
        confirmations.push([message, o?.okLabel ?? null]);
        await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'imp_cl')), started_at: NOW, resultat: autreResultat, brouillon: C.brouillonDe(C.retirerDuGroupe(C.regroupementInitial(autreResultat, PP), 'p5'), new Map(), NOW) }] }, origin: 'device' });
        B = await db.get('imports', 'imp_cl');
        return true;
      };
      const p = await monterPanneau(repo, db, { over: { fetch: ff.fetch, confirmer: confirmerEcrit } });
      await pret(p);
      const rc = p.querySelector('button[data-role="reclasser"]'); rc.click();
      await attendre(() => confirmations.length === 1 && B !== null && p.querySelector('button[data-role="reclasser"]') !== rc, 'question posée, puis redessin');
      eq([ff.appels.length, await db.get('imports', 'imp_cl')], [0, B], 'T-D13 (M-reclasser-cle, ronde 1, constat 3) : reclassé ailleurs PENDANT la question, « oui » → la clé du patch-fonction refuse : 0 écriture, 0 POST — le classement de l’autre onglet et son brouillon intacts');
      // (b) constat 26 : le réseau tombe pendant la question → revérifié après le « oui », AVANT d'effacer le classement payé.
      scene.replaceChildren(); confirmations.length = 0; dits.length = 0;
      await db.mutate({ puts: { imports: [ligneClassement()] }, origin: 'device' });
      const avant = await db.get('imports', 'imp_cl');
      const confirmerCoupe = async (message, o) => { confirmations.push([message, o?.okLabel ?? null]); window.dispatchEvent(new Event('offline')); return true; };
      const p2 = await monterPanneau(repo, db, { over: { fetch: ff.fetch, confirmer: confirmerCoupe } });
      await pret(p2);
      p2.querySelector('button[data-role="reclasser"]').click();
      await attendre(() => dits.includes('Tu es hors ligne.'), '« Tu es hors ligne. » dit');
      eq([confirmations.length, ff.appels.length, await db.get('imports', 'imp_cl')], [1, 0, avant], 'T-D13 (M-reclasser-reseau, ronde 1, constat 26) : le réseau coupé PENDANT la question → revérifié après le « oui » : rien d’écrit (résultat payé et brouillon gardés), 0 POST, « Tu es hors ligne. »');
    });

    await ecran('T-D13 (ronde 1) brouillon : deux gestes enchaînés, clé changée ailleurs, geste nul', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      let appelsT = 0, regles = 0;
      const espion = { ...repo, transitionner: (s, k, o) => { appelsT += 1; return repo.transitionner(s, k, o).finally(() => { regles += 1; }); } };
      // (a) constat 6 : deux gestes SANS attente — le second arrive pendant l'écriture du premier, il est reporté (aEcrire) et l'écriture suivante porte
      // l'état le plus récent ; au remontage (D-D20), les deux gestes sont là.
      let p = await monterPanneau(repo, db, { over: { repo: espion } });
      await pret(p);
      choisirSelect(p, 'p3', 'g2');
      blocDe(p, 'g2').querySelector('button[data-role="monter"][data-page="p3"]').click();
      const FINAL = [['g1', ['p1']], ['g2', ['p3', 'p2']], ['g3', ['p5']]];
      await attendre(async () => JSON.stringify(await groupesBrouillon(db, 'imp_cl')) === JSON.stringify(FINAL), 'brouillon FINAL écrit');
      scene.replaceChildren();
      p = await monterPanneau(repo, db, { over: { repo: espion } });
      await pret(p);
      eq(p.etatClassement().groupes.map((g) => [g.cle, g.page_ids]), FINAL, 'T-D13 (M-aEcrire, ronde 1, constat 6) : deux gestes enchaînés sans attente (p3 vers g2, puis « Monter » p3) → le brouillon FINAL en base, relu au remontage : le second geste n’est jamais perdu');
      // (b) constats 4, 7 et 25 : la clé de la ligne change ailleurs (un reclassement : started_at et brouillon neufs, db.mutate, sans bus), puis un geste
      // ici → la garde de clé du patch-fonction refuse : le brouillon du NOUVEAU classement reste intact ; le panneau relit alors la ligne et montre l'état
      // réel (le brouillon de l'autre onglet : p5 à part).
      const brouillonB = C.brouillonDe(C.retirerDuGroupe(C.regroupementInitial(R5_STOCKE, PP), 'p5'), new Map(), NOW);
      await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'imp_cl')), started_at: NOW, brouillon: brouillonB }] }, origin: 'device' });
      const avantGeste = regles;
      choisirSelect(p, 'p1', 'g3');
      await attendre(() => regles > avantGeste, 'écriture du brouillon réglée');
      eq((await db.get('imports', 'imp_cl')).brouillon, brouillonB, 'T-D13 (M-brouillon-cle, ronde 1, constats 4 et 7) : clé changée ailleurs sans bus, puis un geste ici → refusé par la clé du patch-fonction : le brouillon du nouveau classement intact, jamais écrasé par celui d’un classement mort');
      await attendre(() => p.querySelector('[data-role="a-part"] figure[data-page="p5"]') !== null, 'panneau relu : le brouillon de l’autre onglet montré');
      eq([p.etatClassement().groupes.map((g) => [g.cle, g.page_ids]), p.etatClassement().aPart], [[['g1', ['p1', 'p3']], ['g2', ['p2']]], [{ page_id: 'p4', motif: 'orpheline' }, { page_id: 'p5', motif: 'retiree' }]], 'T-D13 (ronde 1, constat 25) : un brouillon refusé n’est jamais gardé en silence — le panneau relit la ligne et montre l’état réel (celui de l’autre onglet)');
      // (c) constat 32 : « Monter » sur la première page d'un groupe → sans effet, rien d'écrit (ticks admis : aucun redessin ne marque la fin d'un geste nul).
      const avantNul = appelsT; const vusNul = []; const cap = db.onMutate;
      db.onMutate = (m) => { vusNul.push(1); return cap ? cap(m) : {}; };
      try { blocDe(p, 'g1').querySelector('button[data-role="monter"][data-page="p1"]').click(); await tick(); await tick(); }
      finally { db.onMutate = cap; }
      eq([appelsT - avantNul, vusNul.length], [0, 0], 'T-D13 (M-geste-nul, ronde 1, constat 32) : « Monter » la PREMIÈRE page d’un groupe → sans effet, rien d’écrit (0 transition, 0 écriture)');
    });

    await ecran('T-D13 (ronde 1) n = 1 puis n = 0 : singuliers, « non classée », « Lire » éteint et sa phrase ; creerLesLectures refuse sans ligne', async (repo, db) => {
      const un = { groupes: [{ page_ids: ['p1'], title: 'Soupe de courge', printed_page: 132, uncertain: false }], orphelines: [], non_classees: ['p2'], partagees: [], uncertain: [] };
      await poserSeance(repo, db, { pages: ['p1', 'p2'], imports: [ligneClassement({ page_ids: ['p1', 'p2'], over: { resultat: un } })] });
      const ff = fauxFetch();
      const p = await monterPanneau(repo, db, { over: { fetch: ff.fetch } });
      await pret(p);
      eq([boutonLire(p).textContent, p.querySelector('[data-role="regroupement"] > p.muted')?.textContent, puces(p, 'p2')], ['Lire cette recette (1 appel)', '1 recette proposée par l’assistant — vérifie le groupe avant de lire.', ['non classée']], 'T-D13 (M-singuliers, M-non-classee, ronde 1, constat 34) : n = 1 → « Lire cette recette (1 appel) » et « 1 recette proposée … le groupe … » ; une page non_classees porte « non classée » (jamais « retirée »)');
      boutonTexte(blocDe(p, 'g1'), 'Retirer la page 1').click();
      await attendre(async () => JSON.stringify(await groupesBrouillon(db, 'imp_cl')) === '[]', 'groupe vidé, brouillon écrit');
      const phrases = [...p.querySelectorAll('[data-role="regroupement"] > p.muted')].map((x) => x.textContent);
      eq([p.querySelectorAll('[data-role="groupe"]').length, boutonLire(p).disabled, phrases.includes('Aucune recette à lire : déplace des photos vers une recette, ou ignore ce classement.')], [0, true, true], 'T-D13 (M-n0, M-n0-phrase, ronde 1, constat 9) : n = 0 → aucun bloc, « Lire » éteint, la phrase « Aucune recette à lire : … »');
      const n = (await db.getAll('imports')).length; dits.length = 0;
      const b = boutonLire(p); b.disabled = false; b.click();
      await attendre(() => dits.length >= 1, 'un toast');
      eq([dits[0], (await db.getAll('imports')).length - n, (await db.get('imports', 'imp_cl')).status, ff.appels.length, navs.length], [RIEN_LIRE, 0, 'a_verifier', 0, 0], 'T-D15 (M-lignes-vides, ronde 1, constat 17) : n = 0, « Lire » rallumé et cliqué → creerLesLectures refuse sans ligne (jamais le classement payé enregistré pour rien) : 0 écriture, 0 POST, aucune navigation');
      // Constat 27 : toutes les photos des groupes supprimées ailleurs (« Retirer » d'un autre onglet) → aucune ligne à fabriquer → refuse, rien d'écrit.
      scene.replaceChildren();
      await poserSeance(repo, db, { id: 'ss_vide', imports: [ligneClassement({ id: 'imp_vide', sessionId: 'ss_vide' })] });
      const Lv = await db.get('imports', 'imp_vide');
      const ctxV = await ctxDe(repo, db);
      await db.mutate({ deletes: { source_pages: PAGES_5 }, origin: 'device' });
      const nV = (await db.getAll('imports')).length;
      const rV = await G.creerLesLectures('imp_vide', { cle: C.cleClassement(Lv), editionId: 'ed1', etat: C.regroupementInitial(Lv.resultat, ctxV.pagesById), choix: new Map(), ctx: ctxV, repo, maintenant: () => NOW, newId: repo.newId, deviceId: repo.deviceId() });
      eq([rV, (await db.getAll('imports')).length - nV, (await db.get('imports', 'imp_vide')).status], [{ issue: 'refuse', raison: 'classement' }, 0, 'a_verifier'], 'T-D15 (M-lignes-vides, ronde 1, constat 27) : les photos des groupes supprimées ailleurs → aucune ligne à créer → refuse(classement) : le classement payé reste a_verifier, rien d’écrit');
    });

    await ecran('T-D15 (ronde 1) « Lire » éteint : sans session, garde de compte refusée, octets en attente, lecture en cours ailleurs', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      // Le FAIT attendu quand aucun texte ne le marque : les redessins du panneau (un replaceChildren sur la racine chacun), comptés après le montage.
      const redessins = (racine) => { const c = { n: 0 }; const mo = new MutationObserver((recs) => { for (const r of recs) if (r.target === racine) c.n += 1; }); mo.observe(racine, { childList: true }); c.fin = () => mo.disconnect(); return c; };
      // (a) constat 10 : sans session → « Lire » éteint, la carte, et « Connecte-toi pour utiliser l’assistant. » sous la rangée.
      let p = await monterPanneau(repo, db, { session: null });
      await attendre(() => p.querySelector('[data-role="raison-lire"]')?.textContent === 'Connecte-toi pour utiliser l’assistant.', 'raison « Connecte-toi » dite');
      eq([boutonLire(p).disabled, p.querySelector('[data-role="connexion-ia"]') !== null], [true, true], 'T-D15 (M-sans-session, ronde 1, constat 10) : sans session → « Lire » éteint, la carte et « Connecte-toi pour utiliser l’assistant. »');
      // (b) constat 29 (F-7 du lot passerelle) : la garde de compte a refusé l'adresse → la carte dit son message, sans « Se connecter » ; la ligne sous la
      // rangée ne l'invite plus à se connecter.
      scene.replaceChildren();
      const ctxG = await ctxDe(repo, db, { session: null }); ctxG.sync.guard = { ok: false };
      p = G.panneauClassement(ctxG.scan_sessions.find((s) => s.id === 'ss1'), ctxG, () => [], deps(repo, { importId: 'imp_cl' }));
      const rg = redessins(p); scene.append(p);
      try { await attendre(() => rg.n >= 2, 'session et octets lus (deux redessins)'); } finally { rg.fin(); }
      eq([p.querySelector('[data-role="connexion-ia"]')?.textContent, p.querySelector('[data-role="raison-lire"]'), boutonLire(p).disabled], ['Cet appareil ne peut pas vérifier le compte.', null, true], 'T-D15 (ronde 1, constat 29) : garde de compte refusée → la carte dit le message de la garde ; aucune ligne « Connecte-toi … » sous la rangée ; « Lire » éteint');
      // (c) constat 20 : tant que la réponse des octets n'est pas arrivée, « Lire » et « Reclasser » sont éteints SANS texte (getFile suspendu).
      scene.replaceChildren();
      const ctxO = await ctxDe(repo, db);
      p = G.panneauClassement(ctxO.scan_sessions.find((s) => s.id === 'ss1'), ctxO, () => [], deps(repo, { importId: 'imp_cl', repo: { ...repo, getFile: () => new Promise(() => {}) } }));
      const ro = redessins(p); scene.append(p);
      try { await attendre(() => ro.n >= 1, 'session lue (un redessin)'); } finally { ro.fin(); }
      eq([boutonLire(p).disabled, p.querySelector('button[data-role="reclasser"]').disabled, p.querySelector('[data-role="raison-lire"]')], [true, true, null], 'T-D15 (M-octets-attente, ronde 1, constat 20) : la réponse des octets pas encore arrivée → « Lire » et « Reclasser » éteints, sans texte');
      // (d) constat 10 : une lecture en cours AILLEURS (le lot d'une autre séance) → éteint, « Une lecture est en cours : attends sa fin ou annule-la. ».
      scene.replaceChildren();
      await db.mutate({ puts: { imports: [ligneLot({ id: 'l_ailleurs', classementId: 'cl_autre', sessionId: 'ss_autre', page_ids: ['p1'] })] }, origin: 'device' });
      p = await monterPanneau(repo, db);
      await pret(p);
      const fl = fauxFetch();
      const course = G.lireLeLot('cl_autre', { ctx: await ctxDe(repo, db), repo, fetch: fl.fetch, maintenant: () => NOW });
      await attendre(() => p.querySelector('[data-role="raison-lire"]')?.textContent === 'Une lecture est en cours : attends sa fin ou annule-la.', 'lecture en cours dite');
      eq(boutonLire(p).disabled, true, 'T-D15 (M-lecture-en-cours, ronde 1, constat 10) : un lot en lecture ailleurs → « Lire » éteint, la raison dite');
      await attendre(() => fl.appels.length === 1, 'POST du lot d’ailleurs');
      await UI.annulerVol('l_ailleurs');
      await course;
    });

    await ecran('T-D15 (ronde 1) « Lire » revérifié au clic : hors ligne, vol tenu, échec inattendu dit, lot refusé dit', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const V = await import('../src/ui/vol.js');
      const lignesDuLot = async () => (await db.getAll('imports')).filter((i) => i.lot?.classement_id === 'imp_cl').length;
      // Un rendu périmé : le bouton RALLUMÉ, cliqué ; le premier toast, les lignes du lot, le statut du classement.
      const essai = async (p) => { dits.length = 0; const b = boutonLire(p); b.disabled = false; b.click(); await attendre(() => dits.length >= 1, 'un toast'); return [dits[0], await lignesDuLot(), (await db.get('imports', 'imp_cl')).status]; };
      const ff = fauxFetch();
      let p = await monterPanneau(repo, db, { over: { fetch: ff.fetch } });
      await pret(p);
      // (a) constat 28 : hors ligne.
      window.dispatchEvent(new Event('offline'));
      await attendre(() => boutonLire(p)?.disabled === true, '« Lire » éteint hors ligne');
      eq([...(await essai(p)), ff.appels.length], ['Tu es hors ligne.', 0, 'a_verifier', 0], 'T-D15 (M-lire-reseau, ronde 1, constat 28) : hors ligne, « Lire » rallumé (rendu périmé) et cliqué → revérifié au clic : « Tu es hors ligne. », rien d’écrit, 0 POST');
      window.dispatchEvent(new Event('online'));
      await pret(p);
      // (b) constat 28 : un vol tenu par ce document (une autre lecture) — posé sans événement : le rendu reste allumé.
      const tenue = { importId: 'imp_ailleurs', controller: new AbortController(), repo };
      V.prendreVol(tenue);
      try { eq([...(await essai(p)), ff.appels.length], ['Une lecture est déjà en cours : annule-la d’abord.', 0, 'a_verifier', 0], 'T-D15 (M-lire-vol, ronde 1, constat 28) : un vol tenu (rendu périmé), « Lire » cliqué → « Une lecture est déjà en cours : annule-la d’abord. », rien d’écrit (jamais trois lignes que le lot ne pourrait pas lire)'); }
      finally { V.libererVol(tenue); }
      // (c) constat 28 : une levée inattendue de creerLesLectures est DITE (jamais un clic sans retour) ; le journal la garde (console muette ici).
      scene.replaceChildren();
      let casse = false;
      const espionCasse = { ...repo, byIndex: async (...a) => { if (casse) throw new Error('casse'); return repo.byIndex(...a); } };
      p = await monterPanneau(repo, db, { over: { repo: espionCasse, fetch: ff.fetch } });
      await pret(p);
      casse = true;
      const vraiErreur = console.error; const journal = []; console.error = (...a) => journal.push(a[0]);
      try { eq([...(await essai(p)), journal], ['Une erreur est survenue', 0, 'a_verifier', ['[cuisine-os] regroupement.lire']], 'T-D15 (M-lire-echec-dit, ronde 1, constat 28) : creerLesLectures lève → « Une erreur est survenue », rien d’écrit, l’incident au journal'); }
      finally { console.error = vraiErreur; casse = false; }
      // (d) constat 28 : le lot refusé (un autre lot pris pendant la création) est DIT après le toast du succès.
      scene.replaceChildren();
      await db.mutate({ puts: { imports: [ligneLot({ id: 'l_tenu', classementId: 'cl_tenu', sessionId: 'ss_autre', page_ids: ['p1'] })] }, origin: 'device' });
      const fT = fauxFetch();
      const ctxT = await ctxDe(repo, db);
      let autre = null;
      const espionLot = { ...repo, transitionner: async (s, k, o) => { if (k === 'imp_cl' && o?.puts?.imports && !autre) { autre = G.lireLeLot('cl_tenu', { ctx: ctxT, repo, fetch: fT.fetch, maintenant: () => NOW }); await attendre(() => fT.appels.length === 1, 'un lot pris ailleurs'); } return repo.transitionner(s, k, o); } };
      p = await monterPanneau(repo, db, { over: { repo: espionLot, fetch: ff.fetch } });
      await pret(p);
      dits.length = 0; boutonLire(p).click();
      await attendre(() => dits.length >= 2, 'deux toasts');
      eq([dits, await lignesDuLot()], [['3 recettes à lire : suis-les dans Imports.', 'Une lecture est déjà en cours : annule-la d’abord.'], 3], 'T-D15 (M-lot-refus-dit, ronde 1, constat 28) : les lectures créées, puis le lot refusé (lot_tenu, pris pendant la création) → la raison DITE après le succès, jamais un lot muet');
      await UI.annulerVol('l_tenu');
      await autre;
    });

    await ecran('T-D15 (ronde 1) panneau démonté pendant la création : aucune navigation ; « Lire » éteint pendant l’écriture', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const ff = fauxFetch();
      const p = await monterPanneau(repo, db, { over: { fetch: ff.fetch } });
      await pret(p);
      boutonLire(p).click();
      eq(boutonLire(p).disabled, true, 'T-D15 (M-occupe-lire, ronde 1, constat 20) : juste après le clic, avant la fin de la transaction, « Lire » est éteint (une écriture est en cours)');
      scene.replaceChildren();
      await attendre(() => dits.includes('3 recettes à lire : suis-les dans Imports.'), 'toast de succès');
      eq([navs.length, (await db.get('imports', 'imp_cl')).status], [0, 'enregistre'], 'T-D15 (M-nav-montee, ronde 1, constat 14) : le panneau démonté pendant la création → les lectures créées, le toast dit, AUCUNE navigation (la route choisie par la personne n’est jamais détournée)');
      await attendre(() => G.lotEnCours()?.classementId === 'imp_cl' && ff.appels.length === 1, 'le lot lit la première');
      const premiere = (await db.getAll('imports')).find((i) => i.lot?.classement_id === 'imp_cl' && i.lot.rang === 1);
      await UI.annulerVol(premiere.id);
      await attendre(() => G.lotEnCours() === null, 'lot arrêté');
    });

    await ecran('T-D13 (ronde 1) miniatures : URL suivies par urlDeBlob, type du blob (F-9), un PDF jamais en miniature', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const sha = async (pid) => (await db.get('source_pages', pid)).sha256;
      // p1 : des octets JPEG sous une ligne files hors liste (R-G-26) ; p2 : des octets JPEG sous une ligne typée HEIC (une copie reçue, lot G) ; p3 : un PDF
      // (jamais une miniature).
      const f1 = await db.get('files', await sha('p1')); const f2 = await db.get('files', await sha('p2')); const f3 = await db.get('files', await sha('p3'));
      await db.mutate({ puts: { files: [{ ...f1, mime: 'application/octet-stream' }, { ...f2, mime: 'image/heic' }, { ...f3, blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), mime: 'application/pdf' }] }, origin: 'device' });
      let lus = 0;
      const espion = { ...repo, getFile: (s) => repo.getFile(s).finally(() => { lus += 1; }) };
      const vraiCreer = URL.createObjectURL; const types = new Map();
      URL.createObjectURL = (b) => { const u = vraiCreer.call(URL, b); types.set(u, b?.type ?? null); return u; };
      let srcs = [];
      try {
        const p = await monterPanneau(repo, db, { over: { repo: espion } });
        // Le fait : les quatre images posées ET les dix lectures de fichiers réglées (cinq miniatures dont celle du PDF, cinq vérifications d'octets).
        const src = (pid) => p.querySelector(`figure[data-page="${pid}"] img`)?.getAttribute('src') ?? null;
        await attendre(() => lus >= 10 && ['p1', 'p2', 'p4', 'p5'].every((pid) => (src(pid) || '').startsWith('blob:')), 'miniatures et octets lus');
        eq([['p1', 'p2', 'p4', 'p5'].every((pid) => (src(pid) || '').startsWith('blob:')), types.get(src('p1')), types.get(src('p2')), src('p3')], [true, 'image/jpeg', 'image/jpeg', null], 'T-D13 (M-type-ligne, M-type-garde, M-type-image, ronde 1, constats 18 et 34) : une miniature prend le type du BLOB de la liste blanche (des octets JPEG sous une ligne hors liste, R-G-26, ou typée HEIC, F-9 du lot G : image/jpeg) ; un PDF n’a jamais de miniature');
        srcs = ['p1', 'p2', 'p4', 'p5'].map(src);
      } finally { URL.createObjectURL = vraiCreer; }
      scene.replaceChildren();
      const { revoquerUrlDeBlob } = await import('../src/core/blob-urls.js');
      eq(srcs.map((u) => revoquerUrlDeBlob(u)), [true, true, true, true], 'T-D13 (M-url-non-suivie, ronde 1, constat 15) : chaque miniature affichée est une URL SUIVIE par urlDeBlob — révoquée au changement de route par app.js (revoquerUrlsDeBlob), jamais une fuite');
    });

    await ecran('T-D13 (ronde 1) « Reclasser » suit la sélection à l’état 3 et dit sa raison', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement()] });
      const ctx = await ctxDe(repo, db);
      const sel = new Set();
      const p = G.panneauClassement(ctx.scan_sessions.find((s) => s.id === 'ss1'), ctx, () => [...sel], deps(repo, { importId: 'imp_cl' }));
      scene.append(p);
      await pret(p);
      const rc = () => p.querySelector('button[data-role="reclasser"]');
      const raisonRc = () => p.querySelector('[data-role="raison-reclasser"]')?.textContent ?? null;
      eq([rc().disabled, raisonRc()], [false, null], 'T-D13 (ronde 1, constat 19) : sans sélection, « Reclasser » allumé (les pages du classement), aucune raison');
      sel.add('p1');
      const barre1 = p.actionsSelection(); // ce que fait la barre de sélection de sessionView à chaque case cochée
      eq([barre1, rc().disabled, raisonRc()], [[], true, 'Coche au moins deux photos de cette séance.'], 'T-D13 (M-reclasser-selection, ronde 1, constat 19) : une seule photo cochée → la barre redessinée éteint « Reclasser » ET dit pourquoi (jamais un clic muet) ; l’état 3 ne met rien dans la barre');
      sel.add('p2');
      p.actionsSelection();
      eq([rc().disabled, raisonRc()], [false, null], 'T-D13 (ronde 1, constat 19) : deux photos cochées → « Reclasser » rallumé, la raison retirée');
    });

    await ecran('T-D13 (ronde 1) détails : « Incertain » borné (R-D-19), dédoublonnage des choix, recettes relues par le bus', async (repo, db) => {
      // (a) constat 21 (R-D-19) : la jonction des incertitudes dépasse 300 points de code → coupée par texteDesChamps (INCERTAIN_MAX, « … » final).
      const longue = (m) => Array.from({ length: 45 }, () => m).join(' ');
      const u1 = longue('aaa'), u2 = longue('bbb');
      await poserSeance(repo, db, { imports: [ligneClassement({ over: { resultat: { ...R5_STOCKE, uncertain: [u1, u2] } } })] });
      let p = await monterPanneau(repo, db);
      await pret(p);
      const coupe = Array.from(`${u1} ; ${u2}`).slice(0, 299).join('') + '…';
      eq([p.querySelector('[data-role="incertain"]')?.textContent, Array.from(coupe).length], [`Incertain : ${coupe}`, 300], 'T-D13 (M-incertain-borne, ronde 1, constat 21) : deux incertitudes de 179 points de code (jonction de 361) → « Incertain : … » coupé à 300 points de code avec « … » (texteDesChamps, R-D-19)');
      // (b) constat 34 : un choix FAIT restauré (g3 → rcS) qui croise la proposition cochée d'un groupe précédent (g1 → rcS) → le second perd.
      scene.replaceChildren();
      const L = await db.get('imports', 'imp_cl');
      await db.mutate({ puts: { imports: [{ ...L, brouillon: C.brouillonDe(C.regroupementInitial(L.resultat, PP), new Map([['g3', 'rcS']]), L.started_at) }] }, origin: 'device' });
      p = await monterPanneau(repo, db);
      await pret(p);
      eq(p.etatClassement().groupes.map((g) => g.recipe_id), ['rcS', 'rcT', null], 'T-D14 (M-dedoublon, ronde 1, constat 34) : un choix restauré qui vise la référence déjà cochée par un groupe précédent → le second perd : jamais deux groupes sur la même référence (lecturesDuLot lèverait au clic)');
      // (c) constat 34 : le panneau relit les RECETTES par le bus — rcS devenue available ici, puis un geste : g1 ne la propose plus.
      scene.replaceChildren();
      await db.mutate({ puts: { imports: [L] }, origin: 'device' });
      const { espion, relu } = relectureEspion(repo);
      p = await monterPanneau(repo, db, { over: { repo: espion } });
      await pret(p);
      await relu(async () => repo.save('recipes', { ...(await db.get('recipes', 'rcS')), availability: 'available' }));
      boutonTexte(blocDe(p, 'g1'), 'Retirer la page 2').click();
      await attendre(async () => JSON.stringify(await groupesBrouillon(db, 'imp_cl')) === JSON.stringify([['g1', ['p1']], ['g2', ['p2']], ['g3', ['p5']]]), 'brouillon écrit');
      eq([blocDe(p, 'g1').querySelector('[data-role="appariement"] label.check'), p.etatClassement().groupes[0].recipe_id], [null, null], 'T-D14 (M-bus-recettes, ronde 1, constat 34) : une recette changée ici (bus « recipes ») est relue : au redessin suivant, g1 ne propose plus rcS (devenue available)');
    });

    await run('écran — T-D14 (ronde 1) selecteurReferences seul : borne 20, « {n} autres », aucune, occupées filtrées, tête sans saisie, « Nouvelle recette »', async () => {
      const vingtCinq = Array.from({ length: 25 }, (_, i) => ref(`c${i + 1}`, `Recette ${i + 1}`, i + 1));
      const occupee = [ref('o1', 'Pot-au-feu', 98)];
      const choix = [];
      const sel = (o) => G.selecteurReferences({ surChoix: (id) => choix.push(id), ...o });
      const ids = (s) => [...s.querySelectorAll('button[data-role="reference"]')].map((b) => b.dataset.id);
      const muets = (s) => [...s.querySelectorAll('p.muted')].map((x) => x.textContent);
      const prises = (s) => s.querySelectorAll('button[data-role="reference-occupee"]').length;
      let s = sel({ candidats: vingtCinq, occupees: occupee });
      eq([ids(s).length, ids(s)[0], ids(s)[19], muets(s), prises(s)], [20, 'c1', 'c20', ['5 autres : affine la recherche.'], 1], 'T-D14 (M-borne-20, M-autres, ronde 1, constat 33) : 25 candidates → les 20 premières, « 5 autres : affine la recherche. » ; l’occupée montrée sans saisie');
      s = sel({ candidats: vingtCinq, occupees: occupee, saisie: 'zzz' });
      eq([ids(s), prises(s), muets(s)], [[], 0, ['Aucune référence ne correspond.']], 'T-D14 (M-occupees-filtrees, M-aucune, ronde 1, constat 33) : une saisie sans résultat → aucune candidate, l’occupée filtrée AUSSI par la saisie, « Aucune référence ne correspond. »');
      s = sel({ candidats: vingtCinq, enTete: ['c25'] });
      const teteSans = ids(s).slice(0, 2);
      s = sel({ candidats: vingtCinq, enTete: ['c25'], saisie: 'Recette 1' });
      eq([teteSans, ids(s).includes('c25')], [['c25', 'c1'], false], 'T-D14 (M-tete-saisie, ronde 1, constat 33) : la tête (`ordre` d’un groupe « plusieurs ») d’abord SANS saisie ; une saisie qui ne la contient pas la retire');
      s = sel({ candidats: vingtCinq });
      s.querySelector('button[data-role="nouvelle-recette"]').click();
      s.querySelector('button[data-role="reference"][data-id="c3"]').click();
      eq(choix, [null, 'c3'], 'T-D14 (M-nouvelle-selecteur, ronde 1, constat 33) : « Nouvelle recette » du sélecteur → surChoix(null) ; une référence → surChoix(son id)');
    });

    // =================================================================================================================================
    // Tâche 4 — la progression du lot dans « Imports » (§ 4.7) et la note de séance (D-D18) : T-D17. renderAdd à dépendances injectées (fetch compris) ;
    // un lot démarré par « Continuer » OU directement (comme après « Lire ces recettes ») : la section ne suit alors que le bus.
    const monterAdd = async (repo, db, over = {}) => { const r = await AD.renderAdd({}, {}, await ctxDe(repo, db), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: fauxFetch().fetch, maintenant: () => NOW, ...over }); scene.append(r); return r; };
    const blocLot = (racine, id) => racine.querySelector(`[data-role="lot"][data-classement="${CSS.escape(id)}"]`);
    const enteteLot = (racine, id) => { const b = blocLot(racine, id); return b ? [b.firstElementChild?.querySelector('strong')?.textContent ?? null, b.firstElementChild?.querySelector('span.muted')?.textContent ?? null] : null; };
    const continuerDe = (racine, id) => blocLot(racine, id)?.querySelector('button[data-geste="continuer"]') ?? null;
    const enLectureDe = (racine, id) => blocLot(racine, id)?.querySelector('.status[role="status"]')?.textContent ?? null;

    await ecran('T-D17 Imports : bloc de lot, progression, titres et rangs ; classement', async (repo, db) => {
      await poserSeance(repo, db);
      // Ronde 1 (revue : M64 à l’écran) : les récences de l3, l2 puis l1 vont à rebours des rangs — l’ordre rendu dépend du tri par rang de blocsImports.
      const moi = repo.deviceId();
      await db.mutate({ puts: { imports: [
        ligneClassement({ status: 'enregistre', over: { finished_at: DATE } }),
        ligneLot({ id: 'l1', rang: 1, page_ids: ['p1', 'p3'], recipe_id: 'rcS', device_id: moi, status: 'a_verifier', over: { resultat: RECETTE_LUE(), started_at: DATE, updated_at: '2026-10-19T00:00:01.000Z' } }),
        ligneLot({ id: 'l3', rang: 3, page_ids: ['p5'], device_id: moi, status: 'echec', over: { erreur: { raison: 'serveur', extra: {} }, updated_at: '2026-10-19T00:00:03.000Z' } }),
        ligneLot({ id: 'l2', rang: 2, page_ids: ['p2'], device_id: moi, status: 'a_verifier', over: { resultat: RECETTE_LUE('Tarte fine aux poires', 140), started_at: DATE, updated_at: '2026-10-19T00:00:02.000Z', lot: { classement_id: 'imp_cl', rang: 2, total: 3, titre: 'Tarte fine aux poires', page: 140 } } }),
        // Vague finale (revue de branche, constat 14) : EN ÉCHEC, pas reçu — sous M62 (branche classement de lignesImports retirée), une ligne en échec
        // reçoit les gestes communs, « Relancer » compris ; une ligne reçue ou à lancer garderait « Reprendre », « Ignorer » (mesuré : l'état ne tuait pas M62).
        ligneClassement({ id: 'c_ouvert', status: 'echec', over: { erreur: { raison: 'coupe', extra: {} } } }),
      ] }, origin: 'device' });
      const racine = await monterAdd(repo, db);
      eq([enteteLot(racine, 'imp_cl'), continuerDe(racine, 'imp_cl'), enLectureDe(racine, 'imp_cl')], [['Lot de 3 recettes · Saisons', '2 sur 3 lues · 1 en échec'], null, null], 'T-D17 : le bloc du lot — « Lot de 3 recettes · Saisons », « 2 sur 3 lues · 1 en échec » (l1 et l2, à vérifier, comptées parmi les lues ; une ligne de lot ENREGISTRÉE l’est par la vérification ci-dessous, M51 — libellé corrigé en ronde 1) ; rien à lancer ici → ni « Continuer » ni lecture en cours');
      eq([...blocLot(racine, 'imp_cl').querySelectorAll('[data-role="ligne-import"]')].map((l) => [l.dataset.id, l.querySelector('strong')?.textContent, l.querySelector('[data-role="rang-lot"]')?.textContent ?? null]),
        [['l1', 'Soupe de courge', 'Recette 1 sur 3'], ['l2', 'Tarte fine aux poires', 'Recette 2 sur 3'], ['l3', 'Recette 3 sur 3', null]], 'T-D17 (M64, écran — ronde 1 : récences à rebours des rangs) : les lignes du lot dans leur bloc, par rang ; à référence → le titre de la référence ; sans référence → lot.titre (« Tarte fine aux poires »), sinon « Recette k sur n », sans le redire dessous');
      eq([...racine.querySelectorAll('[data-role="imports"] > [data-role="ligne-import"]')].map((l) => l.dataset.id).filter((id) => ['l1', 'l2', 'l3'].includes(id)), [], 'T-D17 (MT-blocs, écran — libellé corrigé en ronde 1) : une ligne de lot n’est rendue que dans son bloc, jamais hors de lui');
      eq(['l1', 'l2'].map((id) => { const r = blocLot(racine, 'imp_cl').querySelector(`[data-role="ligne-import"][data-id="${id}"] > [data-role="rang-lot"]`); return r?.previousElementSibling?.matches('.row.between') ? r.previousElementSibling.querySelector('strong')?.textContent ?? null : null; }), ['Soupe de courge', 'Tarte fine aux poires'], 'T-D17 (ronde 1, N2) : « Recette {k} sur {n} » est un enfant de sa ligne qui suit IMMÉDIATEMENT la rangée du titre (.row.between), jamais rendu après l’état ou les gestes');
      const cl = racine.querySelector('[data-role="ligne-import"][data-id="c_ouvert"]');
      eq([cl?.querySelector('strong')?.textContent, [...cl.querySelectorAll('button')].map((x) => x.textContent)], ['Classement · Saisons', ['Reprendre', 'Ignorer']], 'T-D17 (M62) : le classement EN ÉCHEC — « Classement · Saisons », Reprendre et Ignorer, jamais « Relancer » (vague finale, constat 14 : l’état qui exerce la branche)');
      boutonTexte(cl, 'Reprendre').click();
      eq(navs.at(-1), '/import?session=ss1&import=c_ouvert', 'T-D17 : « Reprendre » d’un classement → /import?session=…&import=…');
    });

    await ecran('T-D17 Imports : « Continuer la lecture », lecture du lot dite puis levée sans geste', async (repo, db) => {
      await poserSeance(repo, db, { sansOctets: ['p5'] });
      const moi = repo.deviceId();
      await db.mutate({ puts: { imports: [
        ligneLot({ id: 'm1', classementId: 'cl_m', rang: 1, total: 2, page_ids: ['p1'], device_id: moi }),
        ligneLot({ id: 'm2', classementId: 'cl_m', rang: 2, total: 2, page_ids: ['p2'], device_id: 'dev_autre' }),
        ligneLot({ id: 'n1', classementId: 'cl_n', rang: 1, total: 2, page_ids: ['p3'], device_id: moi }),
        ligneLot({ id: 'n2', classementId: 'cl_n', rang: 2, total: 2, page_ids: ['p5'], device_id: moi }),
      ] }, origin: 'device' });
      const ff = fauxFetch();
      const racine = await monterAdd(repo, db, { fetch: ff.fetch });
      eq([continuerDe(racine, 'cl_m')?.textContent, continuerDe(racine, 'cl_m')?.className, continuerDe(racine, 'cl_n')?.textContent, enteteLot(racine, 'cl_m')], ['Continuer la lecture (1 appel)', 'btn primary', 'Continuer la lecture (2 appels)', ['Lot de 2 recettes · Saisons', '0 sur 2 lues']], 'T-D17 : « Continuer la lecture » nomme le coût — les lignes à lancer de CET appareil (m2, d’un autre, n’est pas comptée)');
      eq([blocLot(racine, 'cl_m').children[1] === continuerDe(racine, 'cl_m'), blocLot(racine, 'cl_n').children[1] === continuerDe(racine, 'cl_n')], [true, true], 'T-D17 (ronde 1, N1) : « Continuer » suit IMMÉDIATEMENT l’en-tête du bloc (children[1]), avant les lignes du lot');
      continuerDe(racine, 'cl_m').click();
      await attendre(() => ff.appels.length === 1 && enLectureDe(racine, 'cl_m') === 'Lecture du lot en cours…', 'lecture du lot dite');
      eq([continuerDe(racine, 'cl_m'), continuerDe(racine, 'cl_n'), G.lotEnCours()], [null, null, { classementId: 'cl_m' }], 'T-D17 : pendant la lecture, « Lecture du lot en cours… » et AUCUN « Continuer » (ni sur ce lot ni sur un autre : un lot par document)');
      eq([blocLot(racine, 'cl_m').children[1]?.matches('.status[role="status"]') ?? null, blocLot(racine, 'cl_n').children[1]?.dataset.role ?? null], [true, 'ligne-import'], 'T-D17 (ronde 1, N1) : pendant la lecture, « Lecture du lot en cours… » suit IMMÉDIATEMENT l’en-tête du bloc lu ; le bloc d’un autre lot n’a aucun geste avant ses lignes');
      ff.rendre[0](200, corpsModele(RECETTE_LUE()));
      await attendre(() => G.lotEnCours() === null && enLectureDe(racine, 'cl_m') === null && !!continuerDe(racine, 'cl_n'), 'lot libéré, section redessinée');
      eq([ff.appels.length, (await db.get('imports', 'm1')).status, (await db.get('imports', 'm2')).status, continuerDe(racine, 'cl_m'), enteteLot(racine, 'cl_m')], [1, 'a_verifier', 'a_lancer', null, ['Lot de 2 recettes · Saisons', '1 sur 2 lues']], 'T-D17 (M93) : « Continuer la lecture (1 appel) » → lireLeLot → UN POST (la ligne de cet appareil) ; après, plus rien à continuer ICI, le bloc reste');
      // Un lot lancé HORS de la section (comme après « Lire ces recettes ») : seule la libération dite sur le bus peut retirer « Lecture du lot en cours… ».
      // n2 n'a pas ses octets : son refus (octets_absents, sans écriture ni émission) est tenu ouvert par une porte, pour que le redessin dû à la dernière
      // écriture (n1 → a_verifier) se fasse lot TENU ; à la porte ouverte, plus aucune écriture : seule la libération redessine.
      let ouvrir; const porte = new Promise((r) => { ouvrir = r; });
      const espion = { ...repo, getFile: async (sha) => { if (sha === 'sha-p5') await porte; return repo.getFile(sha); } };
      const f2 = fauxFetch();
      const course = G.lireLeLot('cl_n', { ctx: await ctxDe(repo, db), repo: espion, fetch: f2.fetch, maintenant: () => NOW });
      await attendre(() => f2.appels.length === 1 && enLectureDe(racine, 'cl_n') === 'Lecture du lot en cours…', 'la prise du lot dite par le bus');
      f2.rendre[0](200, corpsModele(RECETTE_LUE()));
      await attendre(async () => (await db.get('imports', 'n1')).status === 'a_verifier' && enteteLot(racine, 'cl_n')?.[1] === '1 sur 2 lues' && enLectureDe(racine, 'cl_n') === 'Lecture du lot en cours…', 'dernière écriture redessinée, lot tenu');
      ouvrir();
      eq(await course, { issue: 'fini', lues: 1, echecs: 0, sautees: 1, arret: null }, 'T-D17 : n2 sans octets → sautée (aucune écriture)');
      await attendre(() => enLectureDe(racine, 'cl_n') === null, 'la libération du lot redessine la section sans geste');
      eq([f2.appels.length, continuerDe(racine, 'cl_n')?.textContent ?? null, dits.length], [1, 'Continuer la lecture (1 appel)', 0], 'T-D17 (M144) : après le dernier POST, sans autre geste, « Lecture du lot en cours… » disparaît (la libération est dite sur le bus) ; « Continuer » revient pour la ligne sautée');
    });

    await ecran('T-D17 note de séance : « {n} recette(s) de cette séance dans Imports », absente sans ligne ouverte', async (repo, db) => {
      await poserSeance(repo, db);
      const moi = repo.deviceId();
      await db.mutate({ puts: { imports: [
        ligneLot({ id: 'q1', rang: 1, total: 3, page_ids: ['p1'], device_id: moi, status: 'enregistre' }),
        ligneLot({ id: 'q2', rang: 2, total: 3, page_ids: ['p2'], device_id: moi }),
        ligneLot({ id: 'q3', rang: 3, total: 3, page_ids: ['p5'], device_id: moi, status: 'echec', over: { erreur: { raison: 'serveur', extra: {} } } }),
        ligneLot({ id: 'q9', classementId: 'cl_ailleurs', rang: 1, total: 1, sessionId: 'ss_autre', page_ids: ['q9'] }),
      ] }, origin: 'device' });
      const racine = await monterSeance(repo, db);
      const note = racine.querySelector('[data-role="note-lots"]');
      eq([note?.querySelector('.status.info')?.textContent, note?.querySelector('a.btn.small')?.textContent, note?.querySelector('a.btn.small')?.getAttribute('href')], ['2 recette(s) de cette séance dans Imports', 'Voir les imports', '#/add?section=imports'], 'T-D17 (M145, D-D18) : la séance du lot dit ses lignes de lot OUVERTES (q2 à lancer, q3 en échec ; q1 enregistrée et la ligne d’une autre séance ne comptent pas) et mène à Imports');
      eq([note?.previousElementSibling?.tagName ?? null, racine.children[1] === note], ['HEADER', true], 'T-D17 (ronde 1, N3) : la note suit IMMÉDIATEMENT l’en-tête de la séance (pageHeader), avant la phrase de séance, les miniatures et le panneau');
      await db.mutate({ puts: { imports: await Promise.all(['q2', 'q3'].map(async (id) => ({ ...(await db.get('imports', id)), status: 'ignore' }))) }, origin: 'device' });
      scene.replaceChildren();
      const racine2 = await monterSeance(repo, db);
      eq([racine2.querySelector('[data-role="note-lots"]'), G.noteLotsDeSeance({ id: 'ss1' }, { imports: [] })], [null, null], 'T-D17 : aucune ligne du lot ouverte → aucune note');
    });

    // Vérification de la tâche 4 (hors bloc du plan, écart déclaré au rapport) : ce que les blocs ci-dessus laissaient vivant, rejoué en mutants — la
    // progression lue sur TOUTES les lignes relues (une ligne `enregistre`, absente du bloc, comptée parmi les lues), le total du lot (jamais le nombre de
    // lignes rendues), le singulier « Lot de 1 recette », « aucun vol tenu » (un vol sans lot éteint aussi « Continuer »), « aucun lot tenu » (un lot pris
    // avant son premier vol éteint aussi « Continuer » d'un autre lot), « Lecture du lot en cours… » réservée AU lot lu, et la note de séance qui ne compte
    // que les lignes de LOT (un classement ouvert de la séance n'y entre pas).
    await ecran('T-D17 (vérification) Imports : lues et total sur toutes les lignes, singulier, vol tenu, lot pris ; note des seules lignes de lot', async (repo, db) => {
      await poserSeance(repo, db);
      const moi = repo.deviceId();
      await db.mutate({ puts: { imports: [
        ligneLot({ id: 'e1', classementId: 'cl_e', rang: 1, total: 2, page_ids: ['p1'], device_id: moi, status: 'enregistre', over: { finished_at: DATE } }),
        ligneLot({ id: 'e2', classementId: 'cl_e', rang: 2, total: 2, page_ids: ['p2'], device_id: moi }),
        ligneLot({ id: 'u1', classementId: 'cl_u', rang: 1, total: 1, page_ids: ['p3'], device_id: moi }),
      ] }, origin: 'device' });
      const jeton = UI.tenirVol();
      try {
        const racine = await monterAdd(repo, db);
        eq([enteteLot(racine, 'cl_e'), [...blocLot(racine, 'cl_e').querySelectorAll('[data-role="ligne-import"]')].map((l) => l.dataset.id), enteteLot(racine, 'cl_u')?.[0] ?? null, continuerDe(racine, 'cl_e'), continuerDe(racine, 'cl_u'), enLectureDe(racine, 'cl_e')],
          [['Lot de 2 recettes · Saisons', '1 sur 2 lues'], ['e2'], 'Lot de 1 recette · Saisons', null, null, null],
          'T-D17 (vérification : MT-total, MT-progression-ouvertes, M51 à l’écran, MT-singulier, MT-vol) : e1 enregistrée n’est plus rendue mais compte — « Lot de 2 recettes », « 1 sur 2 lues » ; un lot d’une recette dit le singulier ; un vol tenu sans lot (tenirVol) → aucun « Continuer » et pas de « Lecture du lot en cours… »');
      } finally { UI.libererVol(jeton); }
      scene.replaceChildren();
      const racine2 = await monterAdd(repo, db);
      eq([continuerDe(racine2, 'cl_e')?.textContent ?? null, continuerDe(racine2, 'cl_u')?.textContent ?? null], ['Continuer la lecture (1 appel)', 'Continuer la lecture (1 appel)'], 'T-D17 (vérification) : le vol libéré, « Continuer » revient sur les deux lots');
      // Le lot cl_u PRIS mais pas encore en vol : sa liste figée (byIndex) est tenue par une porte — lotEnCours() vaut cl_u, volEnCours() rien.
      let ouvrir; const porte = new Promise((r) => { ouvrir = r; });
      const espion = { ...repo, byIndex: async (...a) => { await porte; return repo.byIndex(...a); } };
      const f2 = fauxFetch();
      const course = G.lireLeLot('cl_u', { ctx: await ctxDe(repo, db), repo: espion, fetch: f2.fetch, maintenant: () => NOW });
      try {
        await attendre(() => enLectureDe(racine2, 'cl_u') === 'Lecture du lot en cours…', 'la prise de cl_u dite par le bus');
        eq([enLectureDe(racine2, 'cl_e'), continuerDe(racine2, 'cl_e'), UI.volEnCours(), f2.appels.length], [null, null, null, 0], 'T-D17 (vérification : MT-ce-lot, MT-lot) : un lot pris avant son premier vol — le bloc de cl_e ne dit pas « Lecture du lot en cours… » (ce n’est pas lui qu’on lit) et n’offre pas « Continuer » (un lot par document), alors qu’aucun vol n’est tenu');
      } finally { ouvrir(); }
      await attendre(() => f2.appels.length === 1, 'le POST de u1');
      f2.rendre[0](200, corpsModele(RECETTE_LUE()));
      eq(await course, { issue: 'fini', lues: 1, echecs: 0, sautees: 0, arret: null }, 'T-D17 (vérification) : cl_u lu (un POST)');
      await attendre(() => G.lotEnCours() === null && enLectureDe(racine2, 'cl_u') === null && !!continuerDe(racine2, 'cl_e'), 'lot cl_u libéré, section redessinée');
      const note = (imports) => G.noteLotsDeSeance({ id: 'ss1' }, { imports })?.querySelector('.status.info')?.textContent ?? null;
      eq([note([ligneClassement({ status: 'a_lancer' }), ligneLot({ id: 'z1' })]), note([ligneClassement({ status: 'a_lancer' })])], ['1 recette(s) de cette séance dans Imports', null], 'T-D17 (vérification : MT-note-lot) : la note ne compte que les lignes de LOT ouvertes — un classement ouvert de la séance n’y entre pas, et seul il n’en fait aucune');
      const sansLot = ({ lot: _lot, ...reste }) => reste;
      const lotFaux = (id, lot) => ligneLot({ id, over: { lot } });
      eq([note([sansLot(ligneLot({ id: 'z2' }))]), note([lotFaux('z3', { classement_id: 'cl_x', rang: 11, total: 11 })]), note([lotFaux('z4', { classement_id: '', rang: 1, total: 1 })]), note([{ ...ligneLot({ id: 'z5' }), kind: 'web' }]),
        note([ligneLot({ id: 'z1' }), sansLot(ligneLot({ id: 'z2' })), lotFaux('z3', { classement_id: 'cl_x', rang: 11, total: 11 }), lotFaux('z4', {}), { ...ligneLot({ id: 'z5' }), kind: 'web' }])],
        [null, null, null, null, '1 recette(s) de cette séance dans Imports'], 'T-D17 (ronde 1, R-note-kind, R-note-lot-brut, MR-lot-sorte) : la note ne compte que les lignes de LOT valides — une recette ouverte sans `lot` (« Regrouper » puis « Extraire »), un `lot` hostile (rang 11, classement_id vide, objet vide) revalidé par lotDe, une ligne web qui porte un `lot` : aucune ne compte, seules ou à côté d’une vraie');
    });

    // Ronde 1 de T4 (revue à trois lentilles). Constats 1 et 3 (décision à ratifier) : une ligne de lot n'est lue que si sa référence l'est encore — UNE
    // règle (referenceALire) pour le compte de « Continuer » (progressionLots → restantesIci, sur recipesById) et pour la liste de lireLeLot (référence
    // relue avant chaque lancement). Constat de sécurité « kind » : `lot` n'existe que sur une ligne `recette` (§ 3.3) — lotDeRecette.
    await run('T-D17 (ronde 1) referenceALire, restantesIci, lotDeRecette', async () => {
      const recettes = new Map([['rcR', { id: 'rcR', availability: 'reference_only' }], ['rcP', { id: 'rcP', availability: 'partial' }], ['rcA', { id: 'rcA', availability: 'available' }]]);
      eq([{ recipe_id: null }, {}, { recipe_id: 'rcR' }, { recipe_id: 'rcP' }, { recipe_id: 'rcA' }, { recipe_id: 'rcX' }].map((l) => C.referenceALire(l, recettes.get(l.recipe_id))), [true, true, true, true, false, false], 'T-D17 (ronde 1, MR-ref-available, MR-ref-absente) : sans référence → à lire ; référence reference_only ou partial → à lire ; available ou absente → jamais (un POST ne servirait à rien)');
      const lig = (id, recipe_id, over = {}) => ({ id, kind: 'recette', status: 'a_lancer', device_id: 'dev1', edition_id: 'ed1', recipe_id, lot: { classement_id: 'cl_r', rang: 1, total: 4, titre: null, page: null }, ...over });
      const imps = [lig('a', null), lig('b', 'rcR'), lig('c', 'rcA'), lig('d', 'rcX'), { ...lig('w', null), kind: 'web' }];
      eq([C.progressionLots(imps, { deviceId: 'dev1', recipesById: recettes }).get('cl_r'), C.progressionLots(imps, { deviceId: 'dev1' }).get('cl_r').restantesIci], [{ total: 4, lues: 0, echecs: 0, ignorees: 0, restantes: 4, restantesIci: 2, ouvertes: 4, edition_id: 'ed1' }, 1], 'T-D17 (ronde 1, MR-restantes-ici) : restantesIci ne compte que les lignes À LIRE ici (a, b ; c available et d absente : non) ; sans recipesById, une référence est inconnue, donc jamais comptée (défaut fermé) ; la ligne web au lot n’entre dans aucun compte (restantes 4)');
      eq([I.lotDeRecette(lig('a', null)), nul(I.lotDeRecette({ ...lig('w', null), kind: 'web' })), nul(I.lotDeRecette({ ...lig('k', null), kind: 'classement' })), nul(I.lotDeRecette({ lot: lig('z', null).lot }))], [{ classement_id: 'cl_r', rang: 1, total: 4, titre: null, page: null }, 'null', 'null', 'null'], 'T-D17 (ronde 1, MR-lot-sorte) : lotDeRecette = lotDe sur une ligne `recette` seulement ; web, classement ou sans sorte → null');
    });

    await ecran('T-D17 (ronde 1) Imports : une ligne de lot dont la référence est complétée ou absente n’est ni comptée ni lue', async (repo, db) => {
      await poserSeance(repo, db);
      const moi = repo.deviceId();
      await db.mutate({ puts: { imports: [
        ligneLot({ id: 'a1', classementId: 'cl_a', rang: 1, total: 4, page_ids: ['p1'], recipe_id: 'rcA', device_id: moi }),
        ligneLot({ id: 'a2', classementId: 'cl_a', rang: 2, total: 4, page_ids: ['p2'], device_id: moi }),
        ligneLot({ id: 'a3', classementId: 'cl_a', rang: 3, total: 4, page_ids: ['p3'], recipe_id: 'rc_absente', device_id: moi }),
        ligneLot({ id: 'a4', classementId: 'cl_a', rang: 4, total: 4, page_ids: ['p4'], recipe_id: 'rcS', device_id: moi }),
        ligneLot({ id: 'b1', classementId: 'cl_b', rang: 1, total: 1, page_ids: ['p4'], recipe_id: 'rcA', device_id: moi }),
      ] }, origin: 'device' });
      const ff = fauxFetch();
      const racine = await monterAdd(repo, db, { fetch: ff.fetch });
      const gestesDe = (id) => [...(racine.querySelector(`[data-role="ligne-import"][data-id="${CSS.escape(id)}"]`)?.querySelectorAll('button') ?? [])].map((b) => b.textContent);
      eq([continuerDe(racine, 'cl_a')?.textContent ?? null, continuerDe(racine, 'cl_b'), gestesDe('a1'), gestesDe('a3')], ['Continuer la lecture (2 appels)', null, ['Ignorer'], []], 'T-D17 (ronde 1, constat 1, MR-recettes-section) : « Continuer » ne compte que a2 (sans référence) et a4 (rcS, reference_only) — a1 sur une référence available (« Ignorer » seul) et a3 sur une référence absente (aucun geste) n’y entrent pas ; un lot fait de la seule b1 (available) n’offre aucun « Continuer »');
      continuerDe(racine, 'cl_a').click();
      await attendre(() => ff.appels.length === 1, 'le POST de a2');
      ff.rendre[0](200, corpsModele(RECETTE_LUE()));
      await attendre(() => ff.appels.length === 2, 'le POST de a4 (a3 sautée)');
      ff.rendre[1](200, corpsModele(RECETTE_LUE()));
      await attendre(() => G.lotEnCours() === null && enLectureDe(racine, 'cl_a') === null, 'lot cl_a libéré, section redessinée');
      eq([ff.appels.length, ...(await Promise.all(['a1', 'a2', 'a3', 'a4'].map(async (id) => (await db.get('imports', id)).status))), continuerDe(racine, 'cl_a')], [2, 'a_lancer', 'a_verifier', 'a_lancer', 'a_verifier', null], 'T-D17 (ronde 1, constat 1) : « Continuer la lecture (2 appels) » → DEUX POST (a2, a4) ; a1 et a3 sautées sans écriture ni POST, et plus rien à continuer');
      const f2 = fauxFetch();
      eq([await G.lireLeLot('cl_b', { ctx: await ctxDe(repo, db), repo, fetch: f2.fetch, maintenant: () => NOW }), f2.appels.length, (await db.get('imports', 'b1')).status], [{ issue: 'fini', lues: 0, echecs: 0, sautees: 1, arret: null }, 0, 'a_lancer'], 'T-D17 (ronde 1, constat 3) : lireLeLot lancé hors de la section (« Lire ces recettes ») saute aussi une ligne dont la référence est available — 0 POST, rien d’écrit');
      // La référence est relue AVANT chaque lancement, jamais au seul gel de la liste : rcT complétée pendant la lecture de c1 → c2 sautée.
      await db.mutate({ puts: { imports: [
        ligneLot({ id: 'c1', classementId: 'cl_c', rang: 1, total: 2, page_ids: ['p5'], device_id: moi }),
        ligneLot({ id: 'c2', classementId: 'cl_c', rang: 2, total: 2, page_ids: ['p1'], recipe_id: 'rcT', device_id: moi }),
      ] }, origin: 'device' });
      const f3 = fauxFetch();
      const course = G.lireLeLot('cl_c', { ctx: await ctxDe(repo, db), repo, fetch: f3.fetch, maintenant: () => NOW });
      await attendre(() => f3.appels.length === 1, 'le POST de c1');
      await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rcT')), availability: 'available' }] }, origin: 'device' });
      f3.rendre[0](200, corpsModele(RECETTE_LUE()));
      eq([await course, f3.appels.length, (await db.get('imports', 'c2')).status], [{ issue: 'fini', lues: 1, echecs: 0, sautees: 1, arret: null }, 1, 'a_lancer'], 'T-D17 (ronde 1, MR-ref-au-gel) : la référence est relue juste avant chaque lancement — rcT complétée pendant la lecture de c1 : c2 sautée, un seul POST');
    });

    await ecran('T-D17 (ronde 1) Imports : « Continuer » arrêté sur un refus (hors ligne, sans session, vol tenu) le dit', async (repo, db) => {
      await poserSeance(repo, db);
      await db.mutate({ puts: { imports: [ligneLot({ id: 'o1', classementId: 'cl_o', rang: 1, total: 1, page_ids: ['p1'], device_id: repo.deviceId() })] }, origin: 'device' });
      const ff = fauxFetch();
      // Une tape, puis le FAIT « lot libéré et bouton remplacé » : continuer() a rendu la main (sa phrase est dite avant son redessin).
      const taper = async (racine) => { const b = continuerDe(racine, 'cl_o'); dits.length = 0; b.click(); await attendre(() => G.lotEnCours() === null && continuerDe(racine, 'cl_o') !== b, 'continuer() fini'); return [ff.appels.length, [...dits], (await db.get('imports', 'o1')).status]; };
      const r1 = await monterAdd(repo, db, { fetch: ff.fetch });
      window.dispatchEvent(new Event('offline'));
      const horsLigne = await taper(r1);
      window.dispatchEvent(new Event('online'));
      scene.replaceChildren();
      const r2 = await AD.renderAdd({}, {}, await ctxDe(repo, db, { session: null }), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: ff.fetch, maintenant: () => NOW });
      scene.append(r2);
      const sansSession = await taper(r2);
      scene.replaceChildren();
      const r3 = await monterAdd(repo, db, { fetch: ff.fetch });
      const jeton = UI.tenirVol();
      let volTenu;
      try { volTenu = await taper(r3); } finally { UI.libererVol(jeton); }
      eq([horsLigne, sansSession, volTenu], [[0, ['Tu es hors ligne.'], 'a_lancer'], [0, ['Connecte-toi pour utiliser l’assistant.'], 'a_lancer'], [0, ['Une lecture est déjà en cours : annule-la d’abord.'], 'a_lancer']], 'T-D17 (ronde 1, doute 1 confirmé, MR-arret-muet) : « Continuer » arrêté par un refus de REFUS_ARRET_LOT (hors ligne, sans session, vol tenu ailleurs) — rien n’est parti ni écrit, et la phrase de « Relancer » (texteRefus) le dit');
    });

    await ecran('T-D17 (ronde 1) Imports : le focus de « Continuer » survit à un redessin qui ne le retire pas', async (repo, db) => {
      await poserSeance(repo, db);
      await db.mutate({ puts: { imports: [ligneLot({ id: 'f1', classementId: 'cl_f', rang: 1, total: 1, page_ids: ['p1'], device_id: repo.deviceId() })] }, origin: 'device' });
      const racine = await monterAdd(repo, db);
      const avant = continuerDe(racine, 'cl_f');
      avant.focus();
      const section = racine.querySelector('[data-role="imports"]');
      emit('change', { store: 'recipes' }); // un redessin sans rapport avec le lot (une fiche écrite ailleurs)
      await attendre(() => racine.querySelector('[data-role="imports"]') !== section, 'section redessinée');
      const apres = continuerDe(racine, 'cl_f');
      eq([document.activeElement === avant, !!apres && apres !== avant, document.activeElement === apres], [false, true, true], 'T-D17 (ronde 1, MR-focus-lot) : focus sur « Continuer », puis un redessin sans rapport → le focus est sur le NOUVEAU « Continuer » du même lot, jamais rendu à la section');
    });

    await ecran('T-D17 (ronde 1) Imports : un lot sans livre, et une ligne web qui porte un lot', async (repo, db) => {
      await poserSeance(repo, db);
      const moi = repo.deviceId();
      await db.mutate({ puts: { imports: [
        ligneLot({ id: 's1', classementId: 'cl_sl', rang: 1, total: 2, page_ids: ['p1'], device_id: moi, over: { edition_id: null } }),
        { ...ligneLot({ id: 'w1', classementId: 'cl_w', rang: 1, total: 1, page_ids: [], recipe_id: 'rcW', device_id: moi }), kind: 'web', edition_id: null, scan_session_id: null },
      ] }, origin: 'device' });
      const racine = await monterAdd(repo, db);
      eq([enteteLot(racine, 'cl_sl'), blocLot(racine, 'cl_w'), !!racine.querySelector('[data-role="imports"] > [data-role="ligne-import"][data-id="w1"]')], [['Lot de 2 recettes · Sans livre', '0 sur 2 lues'], null, true], 'T-D17 (ronde 1, MR-sans-livre, MR-lot-sorte) : une ligne de lot sans livre → « Lot de 2 recettes · Sans livre » ; une ligne web qui porte un `lot` (reçue) n’est d’aucun bloc ni « Continuer » : rendue comme une lecture web');
      const f2 = fauxFetch();
      eq([await G.lireLeLot('cl_w', { ctx: await ctxDe(repo, db), repo, fetch: f2.fetch, maintenant: () => NOW }), f2.appels.length, (await db.get('imports', 'w1')).status], [{ issue: 'fini', lues: 0, echecs: 0, sautees: 0, arret: null }, 0, 'a_lancer'], 'T-D17 (ronde 1, MR-lot-sorte-lecture) : lireLeLot ne fige que les lignes `recette` de son lot — la ligne web au `lot` n’est ni tentée ni sautée (0 POST, rien d’écrit)');
    });

    // =================================================================================================================================
    // Tâche 5 — enregistrer une lecture issue d'une séance (§ 4.8, N-1, R-D-3, D-D19) : T-D18, T-D19, T-D21, T-D22. L'écran ciblé est monté avec ses
    // dépendances (renderImportCible) ; l'éditeur (renderRecipeEdit) n'en a pas : sa navigation passe par location.hash, relue puis rendue (comme les
    // tests du lot A) ; la fiche par renderRecipe.
    const RE = await import('../src/ui/recipe-edit.js');
    const FI = await import('../src/ui/recipe.js');
    const adresseT5 = location.href;
    const ecranT5 = (nom, fn) => ecran(nom, async (repo, db) => { try { await fn(repo, db); } finally { history.replaceState(null, '', adresseT5); } });
    const monterCible = async (repo, db, recipeId, over = {}) => { const r = await UI.renderImportCible({ id: recipeId }, {}, await ctxDe(repo, db), deps(repo, { fetch: fauxFetch().fetch, ...over })); scene.append(r); return r; };
    const monterEditeur = async (repo, db, query, params = { id: null }) => { const r = await RE.renderRecipeEdit(params, query, await ctxDe(repo, db)); scene.append(r); return r; };
    const champDe = (racine, libelle) => [...racine.querySelectorAll('.field')].find((f) => f.querySelector('span')?.textContent === libelle) || null;
    const enregistrerLecture = async (racine) => { await attendre(() => racine.querySelector('button[data-role="enregistrer"]') && !racine.querySelector('button[data-role="enregistrer"]').disabled, '« Enregistrer cette lecture »'); racine.querySelector('button[data-role="enregistrer"]').click(); };
    const statutDe = async (db, id) => (await db.get('imports', id))?.status ?? null;
    const lueDuLot = (id, { classementId = 'imp_cl', rang = 1, total = 1, sessionId = 'ss1', page_ids, recipe_id = null, device_id = appareilIci(), resultat }) => ligneLot({ id, classementId, rang, total, sessionId, page_ids, recipe_id, device_id, status: 'a_verifier', over: { resultat, started_at: DATE, model: 'claude-x' } });
    const legendesOriginal = (racine) => [...([...racine.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Sources')?.querySelectorAll('figcaption') ?? [])].map((c) => c.textContent);
    // Les figures de PAGE d'une section (R-D-9) — jamais toute figure : après G, la miniature d'une page SANS octets est un figure.fichier-absent
    // IMBRIQUÉ dans la figure de sa page (vignettesDePages : figure > div.vignette-page > vignettePage, plan G rév. 3) ; querySelectorAll('figure')
    // y compterait deux figures pour une page. La figure de page est l'enfant direct du div.thumbs de la section, avant G (section > div.thumbs >
    // figure, à 58bb49b) comme après (« Original » et « Pages d’index » bâties de même) : `:scope > .thumbs > figure` vaut des deux côtés.
    const figuresDe = (racine, titre) => [...racine.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === titre)?.querySelectorAll(':scope > .thumbs > figure').length ?? 0;

    await run('T-D18 domaine : fabriquerExtraction — positions, rôle, union sans photo d’index', async () => {
      const reference = REFERENCES_ED.find((r) => r.id === 'rcX');
      const pages = [{ id: 'pX', position: 4, printed_page: null, kind: null, document_id: null }, { id: 'pY', position: 2, printed_page: 121, kind: null, document_id: null }];
      const opts = { reference, pages, pageIds: ['pX', 'pY'], maintenant: NOW };
      const garde = I.fabriquerExtraction(RECETTE_LUE('Velouté de panais', 120), { ...opts, reecrirePositions: false });
      const defaut = I.fabriquerExtraction(RECETTE_LUE('Velouté de panais', 120), opts);
      eq([garde.pageUpdates.map((p) => [p.id, p.position, p.kind, p.role, p.printed_page]), defaut.pageUpdates.map((p) => p.position), garde.recipe.source_page_ids, I.fabriquerExtraction(RECETTE_LUE(), { ...opts, reference: REFERENCES_ED[0] }).recipe.source_page_ids],
        [[['pX', 4, 'recipe', 'recette', 120], ['pY', 2, 'recipe', 'recette', 121]], [1, 2], ['pX', 'pY'], ['pX', 'pY']], 'T-D18 (M94, M96, M148) : reecrirePositions faux garde les positions (défaut vrai : 1..n, le lot A inchangé) ; role recette avec kind recipe ; l’union privée de reference.index_page_id (pIdx retirée) ; une référence sans photo d’index ne change pas');
      // Ronde 1 (I-D3, B-7) : la photo d'index de LA référence parmi les pages LUES (le classement l'a mise dans le groupe, « Regrouper en recette » l'a cochée)
      // n'entre ni dans l'union, ni dans la version, ni dans les pages réécrites : elle garde son kind index, sans rôle ; la première page de la recette reçoit le numéro.
      const avecIdx = I.fabriquerExtraction(RECETTE_LUE('Velouté de panais', 120), { reference, pages: [{ id: 'pIdx', position: 1, printed_page: 120, kind: 'index', document_id: null }, ...pages], pageIds: ['pIdx', 'pX'], maintenant: NOW, reecrirePositions: false });
      eq([avecIdx.recipe.source_page_ids, avecIdx.version.provenance.source_page_ids, avecIdx.pageUpdates.map((p) => [p.id, p.kind, p.role, p.position, p.printed_page])], [['pX'], ['pX'], [['pX', 'recipe', 'recette', 4, 120]]], 'T-D18 (ronde 1, I-D3) : la photo d’index de la référence parmi les pages lues → ni dans source_page_ids, ni dans la provenance, ni réécrite (jamais « recette ») ; la première page de la recette reçoit p. 120');
    });

    await ecranT5('T-D18 (a) écran ciblé, lignes de lot : positions gardées, séance par le sac, deux instances, dernière ligne', async (repo, db) => {
      await poserSeance(repo, db);
      const moi = repo.deviceId();
      await db.mutate({ puts: { imports: [
        lueDuLot('la', { rang: 1, total: 3, page_ids: ['p1', 'p3'], recipe_id: 'rcS', device_id: moi, resultat: RECETTE_LUE('Soupe de courge', 132) }),
        lueDuLot('lb', { rang: 2, total: 3, page_ids: ['p2'], recipe_id: 'rcT', device_id: moi, resultat: RECETTE_LUE('Tarte aux poires', 141) }),
        lueDuLot('lc', { rang: 3, total: 3, page_ids: ['p5'], recipe_id: 'rcG', device_id: moi, resultat: RECETTE_LUE('Gratin dauphinois', 152) }),
      ] }, origin: 'device' });
      const options = [];
      const espion = { ...repo, transitionner: async (s, k, o) => { options.push([k, o]); return repo.transitionner(s, k, o); } };
      const ca = await monterCible(repo, db, 'rcS', { repo: espion });
      await enregistrerLecture(ca);
      await attendre(async () => (await statutDe(db, 'la')) === 'enregistre', 'la enregistrée');
      const [p1, p3] = await db.getMany('source_pages', ['p1', 'p3']);
      const ss = await db.get('scan_sessions', 'ss1');
      const cond = options.filter(([k, o]) => k === 'la' && o?.conditions?.scan_sessions).map(([, o]) => o.conditions.scan_sessions[0])[0];
      eq([[p1.position, p1.kind, p1.role], [p3.position, p3.kind, p3.role], ss.status, ss.recipe_ids, typeof cond?.patch, cond?.key, cond?.attendus], [[1, 'recipe', 'recette'], [3, 'recipe', 'recette'], 'open', ['rcS'], 'function', 'ss1', ['open', 'done']], 'T-D18 (a) (M94, M95, M96) : positions de la séance GARDÉES (p3 reste 3), pages kind recipe ET role recette ; la séance reçoit rcS et reste open ; elle passe par le sac (patch-fonction, attendus open et done)');
      scene.replaceChildren();
      // Deux instances entrelacées DE FORCE : l'enregistrement de lb est tenu à une porte juste avant sa transaction (tout ce qu'il relit hors transaction
      // est déjà lu ; la porte reconnaît la séance par le sac OU par une copie dans puts, pour tenir aussi le mutant) ; celui de lc passe pendant ce
      // temps ; puis la porte s'ouvre. Une séance écrite par une copie lue hors transaction (M146) perdrait rcG ; relue DANS la transaction, rien ne se perd.
      let ouvrirPorte; const porte = new Promise((r) => { ouvrirPorte = r; }); let tenue = false;
      const aLaPorte = { ...repo, transitionner: async (s, k, o) => { if (k === 'lb' && (o?.conditions?.scan_sessions || o?.puts?.scan_sessions)) { tenue = true; await porte; } return repo.transitionner(s, k, o); } };
      const cb = await monterCible(repo, db, 'rcT', { repo: aLaPorte });
      const cc = await monterCible(repo, db, 'rcG');
      await attendre(() => !!cb.querySelector('button[data-role="enregistrer"]') && !!cc.querySelector('button[data-role="enregistrer"]'), 'deux écrans prêts');
      try {
        cb.querySelector('button[data-role="enregistrer"]').click();
        await attendre(() => tenue, 'lb tenu à la porte, sa séance déjà lue');
        cc.querySelector('button[data-role="enregistrer"]').click();
        await attendre(async () => (await statutDe(db, 'lc')) === 'enregistre', 'lc enregistrée pendant que lb attend');
      } finally { ouvrirPorte(); }
      await attendre(async () => (await statutDe(db, 'lb')) === 'enregistre', 'lb enregistrée après la porte');
      const ss2 = await db.get('scan_sessions', 'ss1');
      eq([[...ss2.recipe_ids].sort(), ss2.status], [['rcG', 'rcS', 'rcT'], 'open'], 'T-D18 (a) (M146, M120) : deux enregistrements de deux lignes du lot, depuis deux instances ENTRELACÉES (lb tenu avant sa transaction pendant que lc s’enregistre), gardent les DEUX recipe_ids (séance relue dans la transaction) ; la dernière ligne ouverte enregistrée, la séance reste open — p4, orpheline, est sans rôle');
    });

    await ecranT5('T-D18 (a) séance fermée, page ajoutée entre-temps, « En faire une nouvelle recette » (et la question reposée, (e))', async (repo, db) => {
      const moi = repo.deviceId();
      const REFS = [...REFERENCES_ED, ref('rcV', 'Velouté de poireaux', 77)];
      await poserSeance(repo, db, { id: 'ss2', pages: ['pA', 'pB'], references: REFS });
      await db.mutate({ puts: { imports: [lueDuLot('ld', { classementId: 'cl_d', sessionId: 'ss2', page_ids: ['pA', 'pB'], recipe_id: 'rcP', device_id: moi, resultat: RECETTE_LUE('Poire rôtie au miel', 140) })] }, origin: 'device' });
      const cd = await monterCible(repo, db, 'rcP');
      await enregistrerLecture(cd);
      await attendre(async () => (await statutDe(db, 'ld')) === 'enregistre', 'ld enregistrée');
      eq((await db.get('scan_sessions', 'ss2')).status, 'done', 'T-D18 (a) (M121) : une séance de 2 photos lues en un groupe apparié → done (plus aucune photo sans rôle)');
      await poserSeance(repo, db, { id: 'ss3', pages: ['pC'], references: REFS });
      await db.mutate({ puts: { imports: [lueDuLot('le', { classementId: 'cl_e', sessionId: 'ss3', page_ids: ['pC'], recipe_id: 'rcO', device_id: moi, resultat: RECETTE_LUE('Pot-au-feu', 98) })] }, origin: 'device' });
      const espion = { ...repo, transitionner: async (s, k, o) => {
        if (k === 'le' && o?.conditions?.scan_sessions) { // une page arrive dans la séance APRÈS la relecture de ses pages, AVANT la transaction
          const seance = await db.get('scan_sessions', 'ss3');
          await db.mutate({ puts: { source_pages: [{ ...(await db.get('source_pages', 'pC')), id: 'pD', position: 2, kind: null }], scan_sessions: [{ ...seance, page_ids: [...seance.page_ids, 'pD'] }] }, origin: 'device' });
        }
        return repo.transitionner(s, k, o);
      } };
      scene.replaceChildren();
      const ce = await monterCible(repo, db, 'rcO', { repo: espion });
      await enregistrerLecture(ce);
      await attendre(async () => (await statutDe(db, 'le')) === 'enregistre', 'le enregistrée');
      const ss3 = await db.get('scan_sessions', 'ss3');
      eq([ss3.status, ss3.page_ids, ss3.recipe_ids], ['open', ['pC', 'pD'], ['rcO']], 'T-D18 (a) (M159) : une page ajoutée à la séance entre la relecture de ses pages et la transaction compte comme sans rôle → statut inchangé (jamais fermée trop tôt)');
      await poserSeance(repo, db, { id: 'ss4', pages: ['pE'], references: REFS });
      await db.mutate({ puts: { imports: [lueDuLot('lf', { classementId: 'cl_f', sessionId: 'ss4', page_ids: ['pE'], recipe_id: 'rcV', device_id: moi, resultat: RECETTE_LUE('Potage Crécy', 77) })] }, origin: 'device' });
      const ff = fauxFetch();
      scene.replaceChildren(); navs.length = 0;
      const cf = await monterCible(repo, db, 'rcV', { fetch: ff.fetch });
      await enregistrerLecture(cf);
      await attendre(() => !!cf.querySelector('[data-role="discordance"]'), 'discordance');
      eq([...cf.querySelectorAll('[data-role="discordance"] button')].map((b) => b.textContent), ['Rattacher', 'Garder la lecture sans l’enregistrer', 'Changer les pages', 'En faire une nouvelle recette'], 'T-D18 (a) (R-D-3) : le panneau de discordance d’une ligne de lot porte quatre gestes, « En faire une nouvelle recette » en dernier');
      // (e) M147 : une autre lecture écrite sur la ligne (un autre onglet, sans bus) entre la question et la réponse → rien de détaché, la question reposée.
      await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'lf')), started_at: NOW, resultat: RECETTE_LUE('Potage paysan', 77) }] }, origin: 'device' });
      cf.querySelector('[data-role="discordance"] button[data-role="nouvelle-recette"]').click();
      await attendre(() => !!cf.querySelector('[data-role="discordance"]')?.textContent.includes('Potage paysan'), 'question reposée pour la lecture courante');
      eq([(await db.get('imports', 'lf')).recipe_id, navs.length], ['rcV', 0], 'T-D18 (e) (M147) : la lecture questionnée a changé → recipe_id inchangé, aucune navigation ; la question est reposée pour la lecture courante');
      cf.querySelector('[data-role="discordance"] button[data-role="nouvelle-recette"]').click();
      await attendre(() => navs.length === 1, 'navigation vers l’éditeur');
      const lf = await db.get('imports', 'lf');
      eq([lf.recipe_id, lf.status, navs[0], ff.appels.length, (await db.get('scan_sessions', 'ss4')).status], [null, 'a_verifier', '/recipes/new?import=lf', 0, 'open'], 'T-D18 (a) (M97) : « En faire une nouvelle recette » → recipe_id null, statut a_verifier, éditeur ?import=, AUCUN appel ; la séance inchangée');
      scene.replaceChildren();
      const edf = await monterEditeur(repo, db, { import: 'lf' });
      eq(champDe(edf, 'Titre original *')?.querySelector('input')?.value, 'Potage paysan', 'T-D18 (a) (M97) : l’éditeur est prérempli par la lecture, sans appel (fetch global piégé)');
    });

    await ecranT5('T-D18 (b) « Regrouper en recette », lecture, « Enregistrer dans cette référence », écran ciblé', async (repo, db) => {
      await poserSeance(repo, db, { pages: ['p1', 'p2', 'p3'] });
      const ff = fauxFetch([200, corpsModele(RECETTE_LUE('Soupe de courge', 132))]);
      globalThis.fetch = ff.fetch;
      // Le lien « Regrouper en recette » de la séance (un href, sans geste) porte ces paramètres : pages dans l'ordre de la sélection, livre, séance.
      const ed = await monterEditeur(repo, db, { pages: 'p3,p1', edition: 'ed1', session: 'ss1' });
      boutonTexte(ed, 'Extraire avec l’assistant IA').click();
      await attendre(() => !!ed.querySelector('[data-role="apparier-lecture"] [data-role="proposition"]'), 'proposition de référence');
      const ligne = (await db.getAll('imports')).find((i) => i.kind === 'recette');
      eq([ligne.page_ids, ligne.status, ligne.recipe_id, ed.querySelector('[data-role="apparier-lecture"] [data-role="proposition"]').textContent], [['p3', 'p1'], 'a_verifier', null, 'Ces pages complètent “Soupe de courge”, p. 132.'], 'T-D18 (b) : la lecture de « Regrouper en recette » est écrite (a_verifier, sans référence), puis la référence sûre est proposée');
      ed.querySelector('[data-role="enregistrer-reference"]').click();
      await attendre(() => location.hash === '#/recipes/rcS/importer', 'navigation vers l’écran ciblé');
      history.replaceState(null, '', adresseT5);
      scene.replaceChildren();
      const c = await monterCible(repo, db, 'rcS');
      await enregistrerLecture(c);
      await attendre(async () => (await statutDe(db, ligne.id)) === 'enregistre', 'enregistrée');
      const [p1, p3] = await db.getMany('source_pages', ['p1', 'p3']);
      const ss = await db.get('scan_sessions', 'ss1');
      eq([p1.position, p3.position, ss.status, ss.recipe_ids, ff.appels.length, (await db.get('recipes', 'rcS')).source_page_ids], [1, 3, 'open', ['rcS'], 1, ['p3', 'p1']], 'T-D18 (b) (M94, M120) : positions de la séance gardées ; la séance reçoit rcS et reste open (p2 sans rôle) ; UN appel en tout ; la recette garde l’ordre lu');
    });

    await ecranT5('T-D18 (c) photo seule, référence proposée par la page, discordance → « En faire une nouvelle recette »', async (repo, db) => {
      await poserSeance(repo, db, { pages: ['p1', 'p2', 'p3'] });
      const ff = fauxFetch([200, corpsModele(RECETTE_LUE('Compote de poires', 152))]);
      globalThis.fetch = ff.fetch;
      const ed = await monterEditeur(repo, db, { pages: 'p2', edition: 'ed1', session: 'ss1' });
      boutonTexte(ed, 'Extraire avec l’assistant IA').click();
      await attendre(() => !!ed.querySelector('[data-role="apparier-lecture"] [data-role="proposition"]'), 'proposition');
      const bloc = ed.querySelector('[data-role="apparier-lecture"]');
      eq([bloc.querySelector('[data-role="proposition"]').textContent, bloc.querySelector('[data-role="motif"]')?.textContent, bloc.querySelector('[data-role="enregistrer-reference"]')?.className], ['Ces pages complètent peut-être “Gratin dauphinois”, p. 152 ?', 'Même page, titre différent.', 'btn'], 'T-D18 (c) : titre lu sans concordance, une seule référence à ± 2 pages → la question, sa raison, un bouton secondaire');
      const ligne = (await db.getAll('imports')).find((i) => i.kind === 'recette');
      bloc.querySelector('[data-role="enregistrer-reference"]').click();
      await attendre(() => location.hash === '#/recipes/rcG/importer', 'navigation vers l’écran ciblé');
      history.replaceState(null, '', adresseT5);
      scene.replaceChildren(); navs.length = 0;
      const c = await monterCible(repo, db, 'rcG');
      await enregistrerLecture(c);
      await attendre(() => !!c.querySelector('[data-role="discordance"]'), 'discordance de titre');
      const boutons = [...c.querySelectorAll('[data-role="discordance"] button')].map((b) => b.textContent);
      eq([boutons.length, boutons.at(-1)], [4, 'En faire une nouvelle recette'], 'T-D18 (c) (M98) : hors lot aussi, le panneau porte quatre boutons, « En faire une nouvelle recette » en dernier');
      c.querySelector('[data-role="discordance"] button[data-role="nouvelle-recette"]').click();
      await attendre(() => navs.length === 1, 'navigation vers l’éditeur');
      const relue = await db.get('imports', ligne.id);
      eq([relue.recipe_id, relue.status, navs[0], ff.appels.length, (await db.get('scan_sessions', 'ss1')).status, (await db.get('source_pages', 'p2')).position], [null, 'a_verifier', '/recipes/new?import=' + ligne.id, 1, 'open', 2], 'T-D18 (c) : recipe_id null, a_verifier, éditeur ?import=, AUCUN appel de plus, séance open, position de la photo inchangée');
      scene.replaceChildren();
      eq(champDe(await monterEditeur(repo, db, { import: ligne.id }), 'Titre original *')?.querySelector('input')?.value, 'Compote de poires', 'T-D18 (c) : l’éditeur prérempli');
    });

    await ecranT5('T-D18 (e) photo d’index de la référence : hors de la recette lue, hors de l’Original', async (repo, db) => {
      await poserSeance(repo, db, { id: 'ss5', pages: ['pX'] });
      const pIdx = { id: 'pIdx', document_id: null, edition_id: 'ed1', sha256: 'sha-idx', printed_page: 120, file_position: null, locator: null, position: 1, issues: [], kind: 'index', created_at: DATE, updated_at: DATE };
      await db.mutate({ puts: { source_pages: [pIdx], imports: [lueDuLot('lx', { classementId: 'cl_x', sessionId: 'ss5', page_ids: ['pX'], recipe_id: 'rcX', device_id: repo.deviceId(), resultat: RECETTE_LUE('Velouté de panais', 120) })] }, origin: 'device' });
      const c = await monterCible(repo, db, 'rcX');
      await enregistrerLecture(c);
      await attendre(async () => (await statutDe(db, 'lx')) === 'enregistre', 'lx enregistrée');
      eq([(await db.get('recipes', 'rcX')).source_page_ids, await db.get('source_pages', 'pIdx')], [['pX'], pIdx], 'T-D18 (e) (M148) : la lecture enregistrée dans une référence de C → source_page_ids SANS sa photo d’index ; pIdx intacte (kind, role, printed_page)');
      // Trois fiches. rcX, lue (available), dont source_page_ids porte encore sa photo d'index. rcZ, une référence reference_only AVEC une version — la forme
      // qu'écrit « Saisir à la main » enregistré sans ingrédient ni étape (src/ui/recipe-edit.js : la fiche garde reference_only, une version courante
      // posée) : elle atteint le bloc « Original », branche reference_only de pagesOriginal. rcR, une référence SANS version : renderRecipe la rend par
      // referenceOnly (avant le bloc « Original »), qui montre la photo d'index sous « Pages d’index » — le chemin du lot A et de C, que D ne touche pas.
      const vZ = { id: 'rvZ', recipe_id: 'rcZ', kind: 'extraction', parent_version_id: null, status: null, servings: null, prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: null, ingredients: [], steps: [], constraints: {}, changes: '', notes: '', provenance: { source_page_ids: ['pIdx'], generated_by: 'manual' }, verification_state: 'to_verify', created_at: DATE, updated_at: DATE };
      await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rcX')), source_page_ids: ['pIdx', 'pX'] }, ref('rcZ', 'Panais rôtis', 121, { index_page_id: 'pIdx', source_page_ids: ['pIdx'], current_version_id: 'rvZ' }), ref('rcR', 'Panais glacés', 122, { index_page_id: 'pIdx', source_page_ids: ['pIdx'] })], recipe_versions: [vZ] }, origin: 'device' });
      scene.replaceChildren();
      const ctx = await ctxDe(repo, db);
      const fx = await FI.renderRecipe({ id: 'rcX' }, {}, ctx); scene.append(fx);
      const fz = await FI.renderRecipe({ id: 'rcZ' }, {}, ctx); scene.append(fz);
      const fr = await FI.renderRecipe({ id: 'rcR' }, {}, ctx); scene.append(fr);
      eq([legendesOriginal(fx).length, figuresDe(fx, 'Sources'), legendesOriginal(fz), figuresDe(fz, 'Sources')], [1, 1, ['p. 120'], 1], 'T-D18 (e) (M149, M149b) : une fiche lue (available) dont source_page_ids porte encore sa photo d’index ne la montre pas dans « Original » (une légende, une figure de PAGE) ; une référence reference_only qui a une version la montre toujours dans « Original » (branche reference_only de pagesOriginal ; une figure de page — la figure d’absence que G imbrique pour pIdx, sans octets, ne compte pas : R-D-9)');
      eq([legendesOriginal(fr), figuresDe(fr, 'Pages d’index')], [[], 1], 'T-D18 (e) : une référence SANS version passe par referenceOnly — aucun bloc « Original », sa photo d’index sous « Pages d’index » : UNE figure de page, avant comme après G (R-D-9) — chemin du lot A et de C, inchangé');
      // R-D-18 (M149-partiel) : le compte de « Télécharger les {n} pages » du bloc « Original » ne porte pas la photo d'index — rcQ (lue, available) a
      // une page d'index et deux pages originales, toutes trois distantes (une ligne files de ce compte, sans octets ici) ; un compte et un moteur
      // (contexteFichiers : connecte) → « Télécharger les 2 pages », deux figures de page, aucune vignette de la photo d'index. Passer `pages` à la garde
      // et à vignettesDePages sans changer le `map` (M149-partiel) dirait « Télécharger les 3 pages ».
      const HQ = (c) => c.repeat(64);
      const distante = (sha, copie) => ({ sha256: sha, mime: 'image/jpeg', size: 5, updated_at: DATE, remote: { sha256: copie, size: 5, mime: 'image/jpeg', quality: 'reduite', uploaded_at: DATE, owner: 'u1' } });
      const pageQ = (id, sha, kind, printed_page, position) => ({ id, document_id: null, edition_id: 'ed1', sha256: sha, printed_page, file_position: null, locator: null, position, issues: [], kind, ...(kind === 'recipe' ? { role: 'recette' } : {}), created_at: DATE, updated_at: DATE });
      const vQ = { ...vZ, id: 'rvQ', recipe_id: 'rcQ', steps: [{ id: 'stQ', position: 1, text: 'Rôtir.' }], provenance: { source_page_ids: ['pQ1', 'pQ2'], generated_by: 'manual' } };
      await db.mutate({ puts: { files: [distante(HQ('1'), HQ('a')), distante(HQ('2'), HQ('b')), distante(HQ('3'), HQ('c'))] }, origin: 'remote' });
      await db.mutate({ puts: { source_pages: [pageQ('pIdQ', HQ('1'), 'index', 200, 1), pageQ('pQ1', HQ('2'), 'recipe', 201, 1), pageQ('pQ2', HQ('3'), 'recipe', 202, 2)], recipes: [ref('rcQ', 'Panais au four', 201, { availability: 'available', index_page_id: 'pIdQ', source_page_ids: ['pIdQ', 'pQ1', 'pQ2'], current_version_id: 'rvQ' })], recipe_versions: [vQ] }, origin: 'device' });
      scene.replaceChildren();
      const ctxQ = await ctxDe(repo, db);
      const moteurQ = { telecharger: async () => ({ recus: 0, erreurs: 0, erreur: null }), reessayerFichier: async () => ({ recus: 0, erreurs: 0, erreur: null }), onEtat: () => () => {} };
      const fq = await FI.renderRecipe({ id: 'rcQ' }, {}, { ...ctxQ, sync: { ...ctxQ.sync, moteur: moteurQ } }); scene.append(fq);
      const origQ = [...fq.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Sources');
      eq([[...(origQ?.querySelectorAll('button') ?? [])].map((b) => b.textContent).filter((x) => x.startsWith('Télécharger les')), figuresDe(fq, 'Sources'), [...(origQ?.querySelectorAll('[data-role="photo-visible"]') ?? [])].map((f) => f.dataset.sha256)], [['Télécharger les 2 pages'], 2, [HQ('2'), HQ('3')]], 'T-D18 (e) (M149-partiel, R-D-18) : une fiche lue dont source_page_ids porte sa photo d’index et deux pages originales, toutes distantes, avec un compte → « Télécharger les 2 pages » (le compte ne porte pas la photo d’index), deux figures de page, aucune vignette de la photo d’index');
      // Ronde 1 (doute 3 du rapport, § 4.8.4) : une fiche lue (available) dont la SEULE page est sa photo d'index n'a pas de bloc « Original » ; elle dit
      // « Original : page {p} du livre (pages non photographiées). » (branche existante, aucun texte neuf) : les pages de LA recette n'ont pas été photographiées.
      const vI = { ...vZ, id: 'rvI', recipe_id: 'rcI', steps: [{ id: 'stI', position: 1, text: 'Écraser.' }], provenance: { source_page_ids: [], generated_by: 'manual' } };
      await db.mutate({ puts: { recipes: [ref('rcI', 'Purée de panais', 123, { availability: 'available', index_page_id: 'pIdx', source_page_ids: ['pIdx'], current_version_id: 'rvI' })], recipe_versions: [vI] }, origin: 'device' });
      scene.replaceChildren();
      const fi = await FI.renderRecipe({ id: 'rcI' }, {}, await ctxDe(repo, db)); scene.append(fi);
      eq([[...fi.querySelectorAll('section')].some((s) => s.querySelector('h2')?.textContent === 'Sources'), fi.textContent.includes('Original : page 123 du livre (pages non photographiées).')], [false, true], 'T-D18 (e) (ronde 1, doute 3) : une fiche lue dont la seule page est sa photo d’index → aucun bloc « Original » ; « Original : page 123 du livre (pages non photographiées). » (branche existante)');
    });

    await ecranT5('T-D18 et L5 séance : retirer de la sélection conserve les photos liées aux recettes', async (repo, db) => {
      // B-7 retire la photo d'index de l'union d'une fiche lue : « Retirer » la protège désormais par index_page_id, et toute page citée par une version
      // (provenance.source_page_ids, relation d'archive dure) ; une page libre ouvre toujours la question (témoin).
      const versionDe = (id, recipe_id, pages) => ({ id, recipe_id, kind: 'extraction', parent_version_id: null, status: null, servings: null, prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: null, ingredients: [], steps: [{ id: 'st' + id, position: 1, text: 'Cuire.' }], constraints: {}, changes: '', notes: '', provenance: { source_page_ids: pages, generated_by: 'ai' }, verification_state: 'to_verify', created_at: DATE, updated_at: DATE });
      await poserSeance(repo, db, { pages: ['p1', 'p2', 'p3', 'p4'], sortes: { p1: 'index' }, references: [...REFERENCES_ED, ref('rcL', 'Velouté de navet', 125, { availability: 'available', index_page_id: 'p1', source_page_ids: ['p2'], current_version_id: 'rvL' }), ref('rcM', 'Navets glacés', 126, { current_version_id: 'rvM' })] });
      await db.mutate({ puts: { recipe_versions: [versionDe('rvL', 'rcL', ['p2']), versionDe('rvM', 'rcM', ['p3'])] }, origin: 'device' });
      const racine = await monterSeance(repo, db);
      const toastEl = () => document.querySelector('.toast');
      const retirer = async (ids) => {
        if (toastEl()) toastEl().textContent = '';
        cocher(racine, ids);
        [...racine.querySelectorAll('button.btn')].find((b) => b.textContent === 'Retirer de la séance').click();
        await attendre(()=>toastEl()?.textContent || document.querySelector('dialog[open]'),'retrait répondu');
        const vu = [toastEl()?.textContent ?? '', !!document.querySelector('dialog[open]')];
        document.querySelectorAll('dialog[open]').forEach((d) => d.close()); // « non » : rien n'est retiré
        await attendre(()=>!racine.querySelector('figure[data-page] input[type=checkbox]').disabled,'retrait annulé, gestes disponibles');
        cocher(racine, ids);
        return vu;
      };
      try {
        eq([await retirer(['p1']), await retirer(['p3']), await retirer(['p4']), (await db.getMany('source_pages', ['p1', 'p3', 'p4'])).map((p) => !!p)], [['', true], ['', true], ['', true], [true, true, true]], 'L5 T-D18 : toute photo peut quitter la sélection après confirmation ; annuler conserve les pages d’index, les sources de versions et les pages libres');
      } finally { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }
    });

    await ecranT5('T-D18 (ronde 1) écran ciblé : séance déjà fermée, séance d’un statut inconnu, lecture sans séance', async (repo, db) => {
      await poserSeance(repo, db);
      const moi = repo.deviceId();
      const sansSeance = { id: 'lz', kind: 'recette', edition_id: 'ed1', recipe_id: 'rcG', scan_session_id: null, page_ids: ['p5', 'p4'], photo_sha256: null, status: 'a_verifier', erreur: null, resultat: RECETTE_LUE('Gratin dauphinois', 152), reponse_brute: null, appels: 1, model: 'claude-x', duree_ms: 900, device_id: moi, document_id_vol: null, battement_at: null, started_at: DATE, finished_at: null, created_at: DATE, updated_at: DATE };
      await db.mutate({ puts: {
        scan_sessions: [{ ...(await db.get('scan_sessions', 'ss1')), status: 'done' }, { id: 'ss7', status: 'zzz', edition_id: 'ed1', started_at: DATE, page_ids: ['p2'], document_ids: [], recipe_ids: [], device_id: moi, created_at: DATE, updated_at: DATE }],
        imports: [lueDuLot('la', { page_ids: ['p1', 'p3'], recipe_id: 'rcS', device_id: moi, resultat: RECETTE_LUE('Soupe de courge', 132) }), lueDuLot('lu', { classementId: 'cl_u', sessionId: 'ss7', page_ids: ['p2'], recipe_id: 'rcT', device_id: moi, resultat: RECETTE_LUE('Tarte aux poires', 141) }), sansSeance],
      }, origin: 'device' });
      await enregistrerLecture(await monterCible(repo, db, 'rcS'));
      await attendre(async () => (await statutDe(db, 'la')) === 'enregistre', 'la enregistrée');
      const ss1 = await db.get('scan_sessions', 'ss1');
      eq([ss1.status, ss1.recipe_ids], ['done', ['rcS']], 'T-D18 (ronde 1, C11) : une séance déjà fermée (« Terminer la séance » avant la dernière lecture) reçoit la recette et reste done (attendus open ET done)');
      scene.replaceChildren(); dits.length = 0;
      const cu = await monterCible(repo, db, 'rcT');
      await enregistrerLecture(cu);
      await attendre(() => dits.includes('La recette n’a pas pu être enregistrée. Réessaie.'), 'refus dit');
      const luRefusee = await statutDe(db, 'lu');
      await enregistrerLecture(cu);
      await attendre(async () => (await statutDe(db, 'lu')) === 'enregistre', 'lu enregistrée sans la séance');
      const ss7 = await db.get('scan_sessions', 'ss7');
      eq([luRefusee, ss7.status, ss7.recipe_ids, (await db.get('recipes', 'rcT')).availability], ['a_verifier', 'zzz', [], 'available'], 'T-D18 (ronde 1, § 4.8.1 point 2) : une séance d’un statut hors open/done → le premier geste est refusé et dit, rien d’écrit ; le suivant écrit SANS elle (jamais relue indéfiniment), la séance intacte');
      scene.replaceChildren();
      await enregistrerLecture(await monterCible(repo, db, 'rcG'));
      await attendre(async () => (await statutDe(db, 'lz')) === 'enregistre', 'lz enregistrée');
      const [p5, p4] = await db.getMany('source_pages', ['p5', 'p4']);
      eq([[p5.position, p5.role], [p4.position, p4.role]], [[1, 'recette'], [2, 'recette']], 'T-D18 (ronde 1, C1) : une lecture SANS séance réécrit les positions dans l’ordre lu (p5 → 1, p4 → 2 : reecrirePositions vrai hors séance, lot A inchangé)');
    });

    await ecranT5('T-D18 (e, ronde 1) « En faire une nouvelle recette » : sorte changée, écriture en échec, double tape, écran quitté', async (repo, db) => {
      const moi = repo.deviceId();
      await poserSeance(repo, db, { id: 'ss4', pages: ['pE'], references: [...REFERENCES_ED, ref('rcV', 'Velouté de poireaux', 77)] });
      await db.mutate({ puts: { imports: [lueDuLot('lf', { classementId: 'cl_f', sessionId: 'ss4', page_ids: ['pE'], recipe_id: 'rcV', device_id: moi, resultat: RECETTE_LUE('Potage Crécy', 77) })] }, origin: 'device' });
      const poser = async (over = {}) => { scene.replaceChildren(); navs.length = 0; dits.length = 0; const c = await monterCible(repo, db, 'rcV', over); await enregistrerLecture(c); await attendre(() => !!c.querySelector('[data-role="discordance"]'), 'discordance'); return c; };
      const nouvelle = (c) => c.querySelector('[data-role="discordance"] button[data-role="nouvelle-recette"]');
      const lf = () => db.get('imports', 'lf');
      // C3 : la sorte de la ligne change sous la même clé entre la question et le geste (une ligne reçue) → rien de détaché, aucune navigation.
      const c1 = await poser();
      await db.mutate({ puts: { imports: [{ ...(await lf()), kind: 'index' }] }, origin: 'device' });
      nouvelle(c1).click();
      await attendre(() => !c1.querySelector('[data-role="discordance"]') || navs.length > 0, 'question reprise');
      eq([(await lf()).recipe_id, navs.length], ['rcV', 0], 'T-D18 (e, ronde 1, C3) : la sorte de la ligne changée sous la même clé → la transaction refuse : recipe_id gardé, aucune navigation');
      await db.mutate({ puts: { imports: [{ ...(await lf()), kind: 'recette' }] }, origin: 'device' });
      // Une écriture qui échoue sans être un refus (base fermée, quota) est DITE, jamais seulement journalisée ; la question reste posée.
      const erreurs = []; const vraiErreur = console.error; console.error = (...a) => { erreurs.push(String(a[0])); };
      let c2;
      try {
        c2 = await poser({ repo: { ...repo, transitionner: async (s, k, o) => { if (k === 'lf' && !o?.puts) throw new Error('base fermée (sonde)'); return repo.transitionner(s, k, o); } } });
        nouvelle(c2).click();
        await attendre(() => dits.includes('Une erreur est survenue'), 'échec dit');
      } finally { console.error = vraiErreur; }
      await attendre(() => !!nouvelle(c2), 'question reposée');
      eq([(await lf()).recipe_id, navs.length, erreurs.includes('[cuisine-os] import_cible.nouvelle_recette')], ['rcV', 0, true], 'T-D18 (e, ronde 1) : une écriture en échec (pas un refus) → « Une erreur est survenue » dit et journalisé, rien de détaché, aucune navigation, la question reposée');
      // C4 : une double tape synchrone ne fait qu'UNE transition et qu'une navigation.
      let transitions = 0;
      const c3 = await poser({ repo: { ...repo, transitionner: async (s, k, o) => { if (k === 'lf') transitions += 1; return repo.transitionner(s, k, o); } } });
      transitions = 0;
      const b3 = nouvelle(c3); b3.click(); b3.click();
      const auClic = transitions;
      await attendre(() => navs.length === 1, 'navigation vers l’éditeur');
      eq([auClic, navs, (await lf()).recipe_id], [1, ['/recipes/new?import=lf'], null], 'T-D18 (e, ronde 1, C4) : double tape → une seule transition, une seule navigation');
      // C2 : l'écran quitté pendant la transaction → la ligne est détachée, mais personne n'est ramené vers l'éditeur.
      await db.mutate({ puts: { imports: [{ ...(await lf()), recipe_id: 'rcV' }] }, origin: 'device' });
      const c4 = await poser({ repo: { ...repo, transitionner: async (s, k, o) => { if (k === 'lf' && !o?.puts) scene.replaceChildren(); return repo.transitionner(s, k, o); } } });
      nouvelle(c4).click();
      await attendre(async () => (await lf()).recipe_id === null, 'détachée');
      eq([navs.length, c4.isConnected], [0, false], 'T-D18 (e, ronde 1, C2) : l’écran quitté avant la fin de la transaction → recipe_id null écrit, AUCUNE navigation (si l’écran est monté)');
    });

    await ecranT5('T-D19 éditeur : lecture, incertitudes, notes, limites et séance portées', async (repo, db) => {
      await poserSeance(repo, db, { pages: ['p1', 'p2', 'p3'] });
      const moi = repo.deviceId();
      const LU = RECETTE_LUE('Tarte fine aux poires', 140, { missing_page: true, notes: 'Se congèle bien.', ingredients: [{ source_text: '2 poires', uncertain: false }, { source_text: '2 c. à soupe\nd’huile', uncertain: true }, { source_text: '1 pincée de sel', uncertain: true }], steps: [{ text: 'Mélanger.\nLaisser reposer.' }, { text: 'Cuire.' }] });
      await db.mutate({ puts: { imports: [lueDuLot('lg', { total: 2, page_ids: ['p1', 'p3'], device_id: moi, resultat: LU })] }, origin: 'device' });
      const ed = await monterEditeur(repo, db, { import: 'lg' });
      const lignes=()=>[...ed.querySelectorAll('[data-role=editeur-ingredient] details p')].map(n=>n.textContent);
      eq([lignes().join('\n'), champDe(ed, 'Notes de cette version')?.querySelector('textarea')?.value, [...ed.querySelectorAll('[data-role=editeur-etape-texte]')].map(n=>n.value).join('\n\n')], ['2 poires\n2 c. à soupe\nd’huile\n1 pincée de sel', 'Se congèle bien.', 'Mélanger.\nLaisser reposer.\n\nCuire.'], 'T-D19 (M151, M150, M101) : ?import= d’une ligne de lot → le texte source sur deux lignes reste intact dans une seule ligne structurée ; les notes lues posées ; une étape par paragraphe');
      // Ronde 2 : AUCUNE ligne n'est cochée « Vérifié » dans ce parcours — save() efface `uncertain` d'une ligne vérifiée, et la coche de la ronde 1 sur la
      // ligne [0] rendait creux le « [0] faux » de M99 (un remplir() qui marquait toutes les lignes incertaines restait vert). E10 a son propre montage,
      // dans « T-D19 (ronde 1) ».
      const nom=ed.querySelectorAll('[data-role=ingredient-nom]')[2];nom.value='sel fin';nom.dispatchEvent(new Event('input',{bubbles:true}));
      boutonTexte(ed, 'Enregistrer les modifications').click();
      await attendre(async () => (await statutDe(db, 'lg')) === 'enregistre', 'lecture close');
      const rec = (await db.getAll('recipes')).find((r) => r.original_title === 'Tarte fine aux poires');
      const ver = await db.get('recipe_versions', rec.current_version_id);
      const [p1, p3, p2] = await db.getMany('source_pages', ['p1', 'p3', 'p2']);
      const ss = await db.get('scan_sessions', 'ss1');
      eq([ver.provenance.import_id, ver.provenance.incomplete, ver.provenance.missing_page, ver.provenance.titre_lu], ['lg', false, true, 'Tarte fine aux poires'], 'T-D19 (M103) : la version porte la lecture — import_id, incomplete, missing_page, titre_lu');
      eq(ver.ingredients.map((l) => [l.source_text, l.uncertain === true]), [['2 poires', false], ['2 c. à soupe\nd’huile', true], ['1 pincée sel fin', false]], 'T-D19 (M99, M151) : le texte source multiligne reste UNE ligne et garde uncertain ; [0] faux ; la ligne retapée perd uncertain');
      eq([ver.notes, rec.availability, ver.steps.length, ver.steps[0].text], ['Se congèle bien.', 'partial', 2, 'Mélanger.\nLaisser reposer.'], 'T-D19 (M150, M100, M101) : notes lues gardées ; page manquante → partial (jamais comblée) ; deux étapes, la première garde son saut de ligne');
      eq([[p1.printed_page, p1.kind, p1.role, p1.position], [p3.printed_page, p3.kind, p3.role, p3.position], [p2.kind, p2.role ?? null]], [[140, 'recipe', 'recette', 1], [null, 'recipe', 'recette', 3], [null, null]], 'T-D19 (M102, M94) : la première page reçoit p. 140, la seconde reste nulle ; kind recipe ET role recette ; positions inchangées ; p2, hors de la lecture, intacte');
      eq([ss.status, ss.recipe_ids], ['open', [rec.id]], 'T-D19 (M120) : la séance reçoit la recette, par le sac, et reste open — p2 est encore sans rôle');
      scene.replaceChildren();
      const fiche = await FI.renderRecipe({ id: rec.id }, {}, await ctxDe(repo, db)); scene.append(fiche);
      ok(fiche.textContent.includes('page possiblement manquante'), 'T-D19 : la fiche montre « page possiblement manquante » (bandeau du lot A)');
      // Chemin de l'éditeur de N-1 : toutes les photos de la séance ont un rôle après l'enregistrement → done.
      await poserSeance(repo, db, { id: 'ss2', pages: ['pA', 'pB'] });
      await db.mutate({ puts: { imports: [lueDuLot('lh', { classementId: 'cl_h', sessionId: 'ss2', page_ids: ['pA', 'pB'], device_id: moi, resultat: RECETTE_LUE('Clafoutis aux cerises', 60) })] }, origin: 'device' });
      scene.replaceChildren();
      boutonTexte(await monterEditeur(repo, db, { import: 'lh' }), 'Enregistrer les modifications').click();
      await attendre(async () => (await statutDe(db, 'lh')) === 'enregistre', 'seconde lecture close');
      eq((await db.get('scan_sessions', 'ss2')).status, 'done', 'T-D19 (M121, chemin de l’éditeur) : plus aucune photo sans rôle → done');
      // M152 : la ligne close par un autre onglet entre remplir et « Enregistrer » est RELUE.
      await db.mutate({ puts: { imports: [lueDuLot('li', { classementId: 'cl_i', sessionId: 'ss2', page_ids: ['pB'], device_id: moi, resultat: RECETTE_LUE('Flan pâtissier', 61, { missing_page: true }) })] }, origin: 'device' });
      scene.replaceChildren();
      const ed3 = await monterEditeur(repo, db, { import: 'li' });
      await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'li')), status: 'enregistre', finished_at: NOW }] }, origin: 'device' });
      boutonTexte(ed3, 'Enregistrer les modifications').click();
      await attendre(()=>!ed3.querySelector('[data-role=erreur-enregistrement]').hidden,'journal clos refusé');
      eq([(await db.getAll('recipes')).some(r=>r.original_title==='Flan pâtissier'),await statutDe(db,'li'),ed3.etatEditeur().id!=null],[false,'enregistre',true],'T-D19 (M152) : journal clos ailleurs refuse la publication, conserve le brouillon et ne fabrique pas une provenance détachée');
      // M161 : une lecture sans notes (null).
      await db.mutate({ puts: { imports: [lueDuLot('lj', { classementId: 'cl_j', sessionId: 'ss2', page_ids: ['pA'], device_id: moi, resultat: RECETTE_LUE('Crème brûlée', 62) })] }, origin: 'device' });
      scene.replaceChildren();
      const ed4 = await monterEditeur(repo, db, { import: 'lj' });
      eq(champDe(ed4, 'Notes de cette version')?.querySelector('textarea')?.value, '', 'T-D19 (M161) : une lecture sans notes (null) laisse la zone « Notes » vide');
      boutonTexte(ed4, 'Enregistrer les modifications').click();
      await attendre(async () => (await statutDe(db, 'lj')) === 'enregistre', 'lecture sans notes close');
      eq((await db.get('recipe_versions', (await db.getAll('recipes')).find((r) => r.original_title === 'Crème brûlée').current_version_id)).notes, undefined, 'T-D19 (M161) : « Enregistrer la recette » ne lève pas sur des notes nulles');
      // M148, chemin de l'éditeur : « Corriger » une fiche dont source_page_ids porte sa photo d'index.
      const pIdxY = { id: 'pIdxY', document_id: null, edition_id: 'ed1', sha256: 'sha-idx-y', printed_page: 7, file_position: null, locator: null, position: 1, issues: [], kind: 'index', created_at: DATE, updated_at: DATE };
      const pY = { ...pIdxY, id: 'pY', sha256: 'sha-y', printed_page: null, kind: 'recipe', position: 2 };
      const vY = { id: 'rvY', recipe_id: 'rcY', kind: 'extraction', parent_version_id: null, status: null, servings: null, prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: null, ingredients: [], steps: [{ id: 'stY', position: 1, text: 'Cuire.' }], constraints: {}, changes: '', notes: '', provenance: { source_page_ids: ['pY'], generated_by: 'manual' }, verification_state: 'to_verify', created_at: DATE, updated_at: DATE };
      await db.mutate({ puts: { recipes: [ref('rcY', 'Velouté de cresson', 30, { availability: 'partial', index_page_id: 'pIdxY', source_page_ids: ['pIdxY', 'pY'], current_version_id: 'rvY' })], recipe_versions: [vY], source_pages: [pIdxY, pY] }, origin: 'device' });
      scene.replaceChildren();
      const ed5 = await monterEditeur(repo, db, { kind: 'correction' }, { id: 'rcY' });
      const etapeY=ed5.querySelector('[data-role=editeur-etape-texte]');etapeY.value='Cuire. Puis servir.';etapeY.dispatchEvent(new Event('input',{bubbles:true}));
      boutonTexte(ed5, 'Enregistrer les modifications').click();
      await attendre(async () => (await db.get('recipes', 'rcY')).current_version_id !== 'rvY', 'correction écrite');
      eq([await db.get('source_pages', 'pIdxY'), await db.get('source_pages', 'pY')], [pIdxY, pY], 'T-D19 (M148, chemin de l’éditeur) : « Corriger » ne réécrit pas la photo d’index de la fiche (ni kind, ni role, ni printed_page) ; les autres pages déjà liées restent aussi intactes pendant une correction de contenu');
    });

    await ecranT5('T-D19 (ronde 1) éditeur : séance relue dans la transaction, notes tapées gardées, saisie à la main, séance refusée, « Vérifié » après ?import=', async (repo, db) => {
      const moi = repo.deviceId();
      const toastDit = () => document.querySelector('.toast')?.textContent ?? '';
      const viderToast = () => { const n = document.querySelector('.toast'); if (n) n.textContent = ''; };
      // Un piège sur db.get (l'éditeur lit par le repo du module, non injectable) : armé à sa pose, il fait `ecrire` (un autre onglet, sans bus) juste APRÈS
      // la lecture de la séance `id` par save(), donc avant sa transaction ; la valeur lue est rendue telle quelle. Rendu par la fonction qu'il rend (finally).
      const pieger = (id, ecrire) => { let arme = true; const get = db.get; db.get = async (s, k) => { const v = await get.call(db, s, k); if (arme && s === 'scan_sessions' && k === id) { arme = false; await ecrire(); } return v; }; return () => { delete db.get; }; };
      // E1, E2 (équivalents éditeur de M146 et M159) : recipe_ids et page_ids changés par un autre onglet entre la relecture et la transaction.
      await poserSeance(repo, db, { id: 'ss2', pages: ['pA', 'pB'] });
      await db.mutate({ puts: { imports: [lueDuLot('lh', { classementId: 'cl_h', sessionId: 'ss2', page_ids: ['pA', 'pB'], device_id: moi, resultat: RECETTE_LUE('Clafoutis aux cerises', 60) })] }, origin: 'device' });
      const ed = await monterEditeur(repo, db, { import: 'lh' });
      const rendre = pieger('ss2', async () => { const s = await db.get('scan_sessions', 'ss2'); await db.mutate({ puts: { source_pages: [{ ...(await db.get('source_pages', 'pA')), id: 'pD', position: 3 }], scan_sessions: [{ ...s, page_ids: [...s.page_ids, 'pD'], recipe_ids: ['rcAutre'] }] }, origin: 'device' }); });
      try { boutonTexte(ed, 'Enregistrer les modifications').click(); await attendre(async () => (await statutDe(db, 'lh')) === 'enregistre', 'lecture close'); } finally { rendre(); }
      const clafoutis = (await db.getAll('recipes')).find((r) => r.original_title === 'Clafoutis aux cerises');
      const ss2 = await db.get('scan_sessions', 'ss2');
      eq([ss2.status, [...ss2.recipe_ids].sort()], ['open', ['rcAutre', clafoutis.id].sort()], 'T-D19 (ronde 1, E1, E2) : un autre onglet ajoute une recette et une photo à la séance entre la relecture et la transaction de l’éditeur → les DEUX recipe_ids gardés, et la séance reste open (pD, arrivée entre-temps, est sans rôle) : séance relue dans la transaction');
      // E5 (§ 4.8.2 point 2) : des notes tapées AVANT « Extraire » sont gardées — les notes lues ne vont que dans une zone vide.
      await poserSeance(repo, db, { id: 'ss3', pages: ['pN', 'pM'] });
      globalThis.fetch = fauxFetch([200, corpsModele(RECETTE_LUE('Flan pâtissier', 70, { notes: 'Se congèle bien.' }))]).fetch;
      scene.replaceChildren();
      const ed2 = await monterEditeur(repo, db, { pages: 'pN', edition: 'ed1', session: 'ss3' });
      const notes = champDe(ed2, 'Notes de cette version')?.querySelector('textarea');
      notes.value = 'Ma note à moi'; notes.dispatchEvent(new Event('input', { bubbles: true }));
      boutonTexte(ed2, 'Extraire avec l’assistant IA').click();
      await attendre(()=>ed2.querySelector('[data-role=adopter-lecture-editeur]'),'lecture conservée');
      ed2.querySelector('[data-role=adopter-lecture-editeur]').click();await attendre(()=>document.querySelector('dialog[open]'),'adoption proposée');
      boutonTexte(document.querySelector('dialog[open]'),'Utiliser cette lecture').click();
      await attendre(() => champDe(ed2, 'Titre original *')?.querySelector('input')?.value === 'Flan pâtissier', 'lecture posée');
      const zone = champDe(ed2,'Notes de cette version').querySelector('textarea').value;
      boutonTexte(ed2, 'Enregistrer les modifications').click();
      await attendre(async () => (await db.getAll('imports')).some((i) => i.kind === 'recette' && i.status === 'enregistre' && i.page_ids?.includes('pN')), 'lecture close');
      const flan = (await db.getAll('recipes')).find((r) => r.original_title === 'Flan pâtissier');
      eq([zone, (await db.get('recipe_versions', flan.current_version_id)).notes], ['Ma note à moi', 'Ma note à moi'], 'T-D19 (ronde 1, E5) : des notes tapées avant « Extraire avec l’assistant IA » sont gardées dans la zone et dans la version (les notes lues ne vont que dans une zone vide)');
      // E14 (§ 4.8.2 point 5) : sans lecture du journal (saisie à la main dans une séance), la séance reçoit toujours la recette.
      scene.replaceChildren();
      const ed3 = await monterEditeur(repo, db, { pages: 'pM', edition: 'ed1', session: 'ss3' });
      const titre = champDe(ed3, 'Titre original *').querySelector('input'); titre.value = 'Tarte tatin maison'; titre.dispatchEvent(new Event('input', { bubbles: true }));
      const ing = ed3.querySelector('[data-role=texte-analyse-ingredients]'); ing.value = '6 pommes';boutonTexte(ed3,'Analyser les lignes').click();
      boutonTexte(ed3, 'Enregistrer les modifications').click();
      await attendre(async () => (await db.getAll('recipes')).some((r) => r.original_title === 'Tarte tatin maison'), 'fiche saisie à la main');
      const tatin = (await db.getAll('recipes')).find((r) => r.original_title === 'Tarte tatin maison');
      eq([(await db.get('scan_sessions', 'ss3')).recipe_ids.includes(tatin.id), (await db.getAll('imports')).some((i) => i.page_ids?.includes('pM'))], [true, false], 'T-D19 (ronde 1, E14) : une saisie à la main depuis « Regrouper en recette » (aucune lecture du journal) → la séance reçoit la recette, comme avant D ; aucune ligne du journal');
      // La séance refusée dans la transaction : la lecture reste posée (jamais détachée) et le geste suivant la clôt SANS la séance (§ 4.8.1 point 2,
      // repris par § 4.8.2 point 5) — séance disparue (le piège l'efface), puis séance d'un statut hors open/done (refusée à chaque relecture).
      await poserSeance(repo, db, { id: 'ss5', pages: ['pR'] });
      await db.mutate({ puts: { imports: [lueDuLot('lr', { classementId: 'cl_r', sessionId: 'ss5', page_ids: ['pR'], device_id: moi, resultat: RECETTE_LUE('Riz au lait', 80) })] }, origin: 'device' });
      scene.replaceChildren();
      const ed4 = await monterEditeur(repo, db, { import: 'lr' });
      viderToast();
      const rendre2 = pieger('ss5', () => db.mutate({ deletes: { scan_sessions: ['ss5'] }, origin: 'device' }));
      try { boutonTexte(ed4, 'Enregistrer les modifications').click(); await attendre(() => !ed4.querySelector('[data-role=erreur-enregistrement]').hidden, 'refus dit'); } finally { rendre2(); }
      const lrRefusee = [await statutDe(db, 'lr'), (await db.getAll('recipes')).some((r) => r.original_title === 'Riz au lait')];
      boutonTexte(ed4, 'Enregistrer les modifications').click();await ed4.flushEditeur();await tick();
      eq([lrRefusee, await statutDe(db,'lr'), (await db.getAll('recipes')).some(r=>r.original_title==='Riz au lait'),await db.get('scan_sessions','ss5')??null,ed4.etatEditeur().id!=null],[['a_verifier',false],'a_verifier',false,null,true],'T-D19 (ronde 1) : séance disparue refuse les deux gestes, conserve le brouillon et le journal, sans recréer ni détacher implicitement');
      await poserSeance(repo, db, { id: 'ss6', pages: ['pK'] });
      await db.mutate({ puts: { scan_sessions: [{ ...(await db.get('scan_sessions', 'ss6')), status: 'zzz' }], imports: [lueDuLot('lq', { classementId: 'cl_q', sessionId: 'ss6', page_ids: ['pK'], device_id: moi, resultat: RECETTE_LUE('Pain perdu', 81) })] }, origin: 'device' });
      scene.replaceChildren();
      const ed5 = await monterEditeur(repo, db, { import: 'lq' });
      eq([ed5.querySelector('[data-role=enregistrer-editeur]'),await statutDe(db,'lq'),(await db.get('scan_sessions','ss6')).status,(await db.getAll('recipes')).filter(r=>r.original_title==='Pain perdu').length,ed5.textContent.trim().length>0],[null,'a_verifier','zzz',0,true],'T-D19 (ronde 1) : séance de statut inconnu refuse l’ouverture éditable avec explication, lecture intacte et aucune fiche créée');
      // E10 (ronde 1 ; montage à part depuis la ronde 2, pour que le parcours principal de T-D19 garde sa ligne [0] NON vérifiée) : le tableau des lignes
      // est redessiné après la pose de `uncertain` — « Vérifié » coché sur la première ligne d'une lecture posée par ?import= vaut à l'enregistrement (sans
      // ce redessin, la coche modifierait un objet ligne abandonné) ; la ligne vérifiée perd `uncertain`, l'autre ligne garde le sien (faux).
      await poserSeance(repo, db, { id: 'ss8', pages: ['pV'] });
      await db.mutate({ puts: { imports: [lueDuLot('lv', { classementId: 'cl_v', sessionId: 'ss8', page_ids: ['pV'], device_id: moi, resultat: RECETTE_LUE('Poires pochées', 82, { ingredients: [{ source_text: '4 poires', uncertain: true }, { source_text: '1 citron', uncertain: false }] }) })] }, origin: 'device' });
      scene.replaceChildren();
      const ed6 = await monterEditeur(repo, db, { import: 'lv' });
      ed6.querySelector('[data-role=editeur-ingredient] input[type="checkbox"]').click();
      boutonTexte(ed6, 'Enregistrer les modifications').click();
      await attendre(async () => (await statutDe(db, 'lv')) === 'enregistre', 'lecture close (E10)');
      const poires = (await db.getAll('recipes')).find((r) => r.original_title === 'Poires pochées');
      eq((await db.get('recipe_versions', poires.current_version_id)).ingredients.map((l) => [l.source_text, l.verification_state, l.uncertain === true]), [['4 poires', 'verified', false], ['1 citron', 'to_verify', false]], 'T-D19 (ronde 1, E10) : « Vérifié » coché dans le tableau après ?import= → la première ligne est enregistrée verified et perd uncertain ; la seconde reste to_verify, sans uncertain (le tableau suit les lignes de la lecture posée)');
    });

    await ecranT5('T-D21 éditeur : la référence proposée après la lecture, rattachée sans appel', async (repo, db) => {
      await poserSeance(repo, db, { pages: ['p1', 'p2'] });
      const moi = repo.deviceId();
      const lecture = (id, resultat, over = {}) => ({ id, kind: 'recette', edition_id: 'ed1', recipe_id: null, scan_session_id: 'ss1', page_ids: ['p1'], photo_sha256: null, status: 'a_verifier', erreur: null, resultat, reponse_brute: null, appels: 1, model: 'claude-x', duree_ms: 900, device_id: moi, document_id_vol: null, battement_at: null, started_at: DATE, finished_at: null, created_at: DATE, updated_at: DATE, ...over });
      await db.mutate({ puts: { imports: [lecture('lk', RECETTE_LUE('Soupe de courge rôtie', 132))] }, origin: 'device' });
      const avant = (await db.getAll('recipes')).length;
      const ed = await monterEditeur(repo, db, { import: 'lk' });
      await attendre(() => !!ed.querySelector('[data-role="apparier-lecture"]'), 'proposition');
      const bloc = ed.querySelector('[data-role="apparier-lecture"]');
      eq([bloc.querySelector('[data-role="proposition"]')?.textContent, bloc.querySelector('[data-role="enregistrer-reference"]')?.className, bloc.querySelector('[data-role="avertissement"]')?.textContent, bloc.querySelector('button[data-role="choisir-reference"]')?.textContent], ['Ces pages complètent “Soupe de courge”, p. 132.', 'btn primary', 'La lecture sera enregistrée telle que lue dans la référence ; tes changements ici ne la suivent pas.', 'Choisir une référence…'], 'T-D21 (M153) : « Soupe de courge rôtie » p. 132 lue → la référence sûre proposée au-dessus du formulaire, ce que le geste fait, et le repli');
      const vus = []; const capture = db.onMutate;
      db.onMutate = (m) => { vus.push(Object.keys(m.puts).sort().map((s) => [s, (m.puts[s] || []).map((x) => x.id)])); return capture ? capture(m) : {}; };
      try {
        bloc.querySelector('[data-role="enregistrer-reference"]').click();
        await attendre(() => location.hash === '#/recipes/rcS/importer', 'navigation vers l’écran ciblé');
      } finally { db.onMutate = capture; }
      history.replaceState(null, '', adresseT5);
      eq([vus, (await db.get('imports', 'lk')).recipe_id, await statutDe(db, 'lk')], [[[['imports', ['lk']]]], 'rcS', 'a_verifier'], 'T-D21 : « Enregistrer dans cette référence » → UNE écriture (la ligne seule) : rcS, toujours a_verifier ; aucun appel (fetch global piégé)');
      scene.replaceChildren();
      const c = await monterCible(repo, db, 'rcS');
      await enregistrerLecture(c);
      await attendre(async () => (await statutDe(db, 'lk')) === 'enregistre', 'enregistrée');
      eq([(await db.get('recipes', 'rcS')).availability, (await db.getAll('recipes')).length], ['available', avant], 'T-D21 (M154) : puis « Enregistrer cette lecture » → rcS available, AUCUNE seconde fiche');
      // La condition d'index dans le même appel : rattacherLecture appelé avec un espion (le repo de l'éditeur n'est pas injectable).
      await db.mutate({ puts: { imports: [lecture('lk2', RECETTE_LUE('Tarte fine aux poires', 140))] }, origin: 'device' });
      const appels = [];
      const espion = { ...repo, transitionner: async (s, k, o) => { appels.push(o); return repo.transitionner(s, k, o); } };
      eq([await G.rattacherLecture('lk2', 'rcT', { cle: UI.cleLecture(await db.get('imports', 'lk2')), repo: espion }), appels[0]?.attendus, appels[0]?.conditions], [{ issue: 'rattache' }, ['a_verifier'], { imports: [{ index: 'recipe_id', valeur: 'rcT', exclus: I.IMPORTS_OUVERTS }], sync_state: [{ key: 'user_id' }] }], 'T-D21 : rattacherLecture — a_verifier gardé et la condition d’index de la référence (I-2) dans le MÊME appel');
      // M155 et M156 : le bloc monté seul, toast et navigation injectés.
      const monterBloc = async (id, r = repo) => { const l = await db.get('imports', id); const b = G.blocApparierLecture({ ligne: l, resultat: l.resultat, ctx: await ctxDe(repo, db), repo: r, navigate: (p) => navs.push(p), toast: (m) => dits.push(m) }); scene.append(b); return b; };
      await db.mutate({ puts: { imports: [lecture('lk3', RECETTE_LUE('Gratin dauphinois', 152))] }, origin: 'device' });
      scene.replaceChildren(); navs.length = 0; dits.length = 0;
      const b3 = await monterBloc('lk3');
      await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'lk3')), started_at: NOW, resultat: RECETTE_LUE('Gratin dauphinois', 153) }] }, origin: 'device' });
      b3.querySelector('[data-role="enregistrer-reference"]').click();
      await attendre(() => dits.length === 1, 'refus dit');
      await attendre(() => !b3.isConnected, 'bloc relu (remplacé)'); // ronde 1 (R-D-10) : un fait — le remplacement suit trois lectures APRÈS le toast
      eq([dits[0], (await db.get('imports', 'lk3')).recipe_id, navs.length, scene.querySelector('[data-role="apparier-lecture"]')], ['Rien n’a été rattaché : cette lecture ou cette référence a changé entre-temps.', null, 0, null], 'T-D21 (M155) : une autre lecture écrite sur la ligne entre le rendu et le geste → refus dit, recipe_id nul, aucune navigation ; le bloc relu disparaît (ce n’est plus la lecture du formulaire)');
      await db.mutate({ puts: { imports: [lecture('lk4', RECETTE_LUE('Gratin dauphinois', 152), { page_ids: ['p2'] })] }, origin: 'device' });
      scene.replaceChildren(); navs.length = 0; dits.length = 0;
      const course = { ...repo, transitionner: async (s, k, o) => { if (k === 'lk4') await db.mutate({ puts: { imports: [{ ...IMPORT_RCO, id: 'imp_rcg', recipe_id: 'rcG' }] }, origin: 'device' }); return repo.transitionner(s, k, o); } };
      const b4 = await monterBloc('lk4', course);
      b4.querySelector('[data-role="enregistrer-reference"]').click();
      await attendre(() => dits.length === 1, 'refus dit');
      eq([(await db.get('imports', 'lk4')).recipe_id, navs.length], [null, 0], 'T-D21 (M156) : la référence a reçu un import ouvert entre la relecture et la transaction → la condition d’index refuse, rien de rattaché');
      // Ronde 1 (R3, R19) : le bloc relu est recalculé sur des références et des imports FRAIS — rcG, prise entre-temps, n'est plus proposée ; elle est
      // montrée éteinte dans le sélecteur (« Import en cours »).
      await attendre(() => !b4.isConnected, 'bloc relu (remplacé)');
      const b4r = scene.querySelector('[data-role="apparier-lecture"]');
      eq([!!b4r, b4r?.querySelector('[data-role="proposition"]') ?? null, b4r?.querySelector('[data-role="reference-occupee"][data-id="rcG"]')?.disabled ?? null], [true, null, true], 'T-D21 (ronde 1, R3, R19) : après le refus, le bloc frais ne propose plus rcG (prise entre-temps) et la montre éteinte parmi les références prises');
      const l5 = lecture('lk5', RECETTE_LUE('Ragoût de lentilles', 300));
      const ctx = await ctxDe(repo, db);
      const b5 = G.blocApparierLecture({ ligne: l5, resultat: l5.resultat, ctx, repo });
      eq([b5?.querySelector('[data-role="enregistrer-reference"]') ?? null, b5?.querySelector('[data-role="proposition"]') ?? null, b5?.querySelector('button[data-role="choisir-reference"]')?.textContent ?? null, G.blocApparierLecture({ ligne: { ...l5, edition_id: null }, resultat: l5.resultat, ctx, repo })], [null, null, 'Choisir une référence…', null], 'T-D21 : titre lu sans concordance → le seul « Choisir une référence… » ; sans édition → aucun bloc');
      await db.mutate({ puts: { imports: [lecture('lk6', RECETTE_LUE('Soupe de courge rôtie', 132))] }, origin: 'device' });
      scene.replaceChildren();
      const n0 = (await db.getAll('recipes')).length;
      boutonTexte(await monterEditeur(repo, db, { import: 'lk6' }), 'Enregistrer les modifications').click();
      await attendre(async () => (await statutDe(db, 'lk6')) === 'enregistre', 'nouvelle fiche');
      eq([(await db.getAll('recipes')).length, (await db.getAll('recipes')).some((r) => r.original_title === 'Soupe de courge rôtie')], [n0 + 1, true], 'T-D21 : ne rien choisir puis « Enregistrer la recette » → une nouvelle fiche, comme avant');
    });

    await ecranT5('T-D21 (ronde 1) proposition de l’éditeur : sans candidate, titre hostile, plusieurs, choisir, gardes d’écran ; rattacherLecture dans la transaction', async (repo, db) => {
      await poserSeance(repo, db, { pages: ['p1', 'p2'], references: [...REFERENCES_ED, ref('rcE2', 'Gratin dauphinois', 152, { edition_id: 'ed2' })] });
      const moi = repo.deviceId();
      const lecture = (id, resultat) => ({ id, kind: 'recette', edition_id: 'ed1', recipe_id: null, scan_session_id: 'ss1', page_ids: ['p1'], photo_sha256: null, status: 'a_verifier', erreur: null, resultat, reponse_brute: null, appels: 1, model: 'claude-x', duree_ms: 900, device_id: moi, document_id_vol: null, battement_at: null, started_at: DATE, finished_at: null, created_at: DATE, updated_at: DATE });
      const poserLecture = async (id, resultat) => { await db.mutate({ puts: { imports: [lecture(id, resultat)] }, origin: 'device' }); return db.get('imports', id); };
      const monter = async (L, r = repo) => { scene.replaceChildren(); navs.length = 0; dits.length = 0; const b = G.blocApparierLecture({ ligne: L, resultat: L.resultat, ctx: await ctxDe(repo, db), repo: r, navigate: (p) => navs.push(p), toast: (m) => dits.push(m) }); scene.append(b); return b; };
      // R10 : aucune candidate dans l'édition de la ligne → aucun bloc. I-D2 : un titre de référence hostile reste un nœud texte (proposition et sélecteur).
      const lh = lecture('mh', RECETTE_LUE('<img src=x onerror=alert(1)>', 300));
      const bh = G.blocApparierLecture({ ligne: lh, resultat: lh.resultat, ctx: { recipes: [ref('rcHost', '<img src=x onerror=alert(1)>', 300)], imports: [] }, repo });
      eq([nul(G.blocApparierLecture({ ligne: lh, resultat: lh.resultat, ctx: { recipes: [ref('rcAv', 'Gratin dauphinois', 300, { availability: 'available' })], imports: [] }, repo })), bh?.querySelector('[data-role="proposition"]')?.children.length, bh?.querySelector('[data-role="proposition"]')?.textContent.includes('<img src=x onerror=alert(1)>'), bh?.querySelector('button[data-role="reference"][data-id="rcHost"]')?.textContent, bh?.querySelectorAll('img').length], ['null', 0, true, '<img src=x onerror=alert(1)> — p. 300', 0], 'T-D21 (ronde 1, R10, I-D2) : sans candidate dans l’édition → aucun bloc (null) ; un titre de référence porteur de balisage est rendu en TEXTE dans la proposition et dans le sélecteur, aucun élément créé');
      // « plusieurs » (p. 141 : rcT et rcP à ± 2 pages, aucun titre) : la phrase, le sélecteur OUVERT, ces candidates en tête, ni bouton primaire ni « Nouvelle recette ».
      const lp = lecture('mp', RECETTE_LUE('Ragoût de lentilles', 141));
      const bp = G.blocApparierLecture({ ligne: lp, resultat: lp.resultat, ctx: await ctxDe(repo, db), repo });
      const selP = bp?.querySelector('[data-role="selecteur"]');
      eq([[...(bp?.children ?? [])].filter((n) => n.tagName === 'P').map((n) => n.textContent), selP?.hidden, bp?.querySelector('[data-role="choisir-reference"]')?.getAttribute('aria-expanded'), [...(selP?.querySelectorAll('button[data-role="reference"]') ?? [])].slice(0, 2).map((b) => b.dataset.id), bp?.querySelector('[data-role="enregistrer-reference"]') ?? null, bp?.querySelector('[data-role="nouvelle-recette"]') ?? null], [['Plusieurs références possibles.'], false, 'true', ['rcT', 'rcP'], null, null], 'T-D21 (ronde 1, R6, R11, R5) : plusieurs références possibles → la phrase, le sélecteur ouvert (aria-expanded), rcT puis rcP en tête, aucun bouton primaire, jamais « Nouvelle recette »');
      // « aucune » (p. 300) : le sélecteur fermé ; la bascule l'ouvre ; un choix rattache sans appel et ouvre l'écran ciblé.
      const b6 = await monter(await poserLecture('m6', RECETTE_LUE('Ragoût de lentilles', 300)));
      const sel6 = b6.querySelector('[data-role="selecteur"]'); const bas6 = b6.querySelector('[data-role="choisir-reference"]');
      const fermeAuRendu = [sel6.hidden, bas6.getAttribute('aria-expanded'), b6.querySelector('[data-role="nouvelle-recette"]')];
      bas6.click();
      const ouvertApres = [sel6.hidden, bas6.getAttribute('aria-expanded')];
      sel6.querySelector('button[data-role="reference"][data-id="rcO"]').click();
      await attendre(() => navs.length === 1, 'navigation vers l’écran ciblé');
      eq([fermeAuRendu, ouvertApres, navs, (await db.get('imports', 'm6')).recipe_id, dits], [[true, 'false', null], [false, 'true'], ['/recipes/rcO/importer'], 'rcO', []], 'T-D21 (ronde 1, Mc, R12, R4, R5) : aucune concordance → sélecteur fermé, sans « Nouvelle recette » ; « Choisir une référence… » l’ouvre ; choisir rcO rattache la lecture (sans appel) et ouvre l’écran ciblé');
      // R7 : le bloc quitté pendant la transaction → rattachée, mais personne n'est emmené. R8 : une double tape → une seule tentative, aucun refus dit.
      const quitte = { ...repo, transitionner: async (s, k, o) => { if (k === 'm7') scene.replaceChildren(); return repo.transitionner(s, k, o); } };
      (await monter(await poserLecture('m7', RECETTE_LUE('Velouté de panais', 120)), quitte)).querySelector('[data-role="enregistrer-reference"]').click();
      await attendre(async () => (await db.get('imports', 'm7')).recipe_id === 'rcX', 'rattachée à rcX');
      eq([navs.length, dits.length], [0, 0], 'T-D21 (ronde 1, R7) : le bloc retiré avant la fin de la transaction → la lecture est rattachée, AUCUNE navigation (si le bloc est monté)');
      let lectures8 = 0;
      const compte = { ...repo, get: (s, k) => { if (s === 'imports' && k === 'm8') lectures8 += 1; return repo.get(s, k); } };
      const b8 = (await monter(await poserLecture('m8', RECETTE_LUE('Tarte aux poires', 141)), compte)).querySelector('[data-role="enregistrer-reference"]');
      lectures8 = 0;
      b8.click(); b8.click();
      await attendre(() => lectures8 > 0, 'tentative après captures du contexte');
      const auClic = lectures8;
      await attendre(() => navs.length === 1, 'navigation vers l’écran ciblé');
      eq([auClic, navs, dits, (await db.get('imports', 'm8')).recipe_id], [1, ['/recipes/rcT/importer'], [], 'rcT'], 'T-D21 (ronde 1, R8) : double tape sur « Enregistrer dans cette référence » → une seule tentative, une navigation, aucun refus dit');
      // Une écriture qui échoue sans être un refus est DITE (jamais seulement journalisée).
      const erreurs = []; const vraiErreur = console.error; console.error = (...a) => { erreurs.push(String(a[0])); };
      try {
        const casse = { ...repo, transitionner: async (s, k, o) => { if (k === 'm9') throw new Error('base fermée (sonde)'); return repo.transitionner(s, k, o); } };
        (await monter(await poserLecture('m9', RECETTE_LUE('Gratin dauphinois', 152)), casse)).querySelector('[data-role="enregistrer-reference"]').click();
        await attendre(() => dits.length === 1, 'échec dit');
      } finally { console.error = vraiErreur; }
      eq([dits, navs.length, (await db.get('imports', 'm9')).recipe_id, erreurs.includes('[cuisine-os] regroupement.rattacher')], [['Une erreur est survenue'], 0, null, true], 'T-D21 (ronde 1) : « Enregistrer dans cette référence » dont l’écriture échoue (pas un refus) → « Une erreur est survenue » dit et journalisé, rien de rattaché, aucune navigation');
      // rattacherLecture : les gardes rejouées DANS la transaction (une écriture concurrente intercalée juste avant repo.transitionner), puis les pré-gardes.
      const intercaler = (id, ecrire) => ({ ...repo, transitionner: async (s, k, o) => { if (k === id) await ecrire(); return repo.transitionner(s, k, o); } });
      const m1 = await poserLecture('m1', RECETTE_LUE('Tarte fine aux poires', 140));
      const r1 = await G.rattacherLecture('m1', 'rcP', { cle: UI.cleLecture(m1), repo: intercaler('m1', async () => db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'm1')), started_at: NOW, resultat: RECETTE_LUE('Tarte fine aux poires', 141) }] }, origin: 'device' })) });
      const m1Apres = await db.get('imports', 'm1');
      eq([r1, m1Apres.recipe_id, m1Apres.resultat.printed_page], [{ issue: 'refuse', raison: 'transition' }, null, 141], 'T-D21 (ronde 1, R1) : une autre lecture écrite sur la ligne entre la relecture et la transaction → la clé rejouée dans la transaction refuse : rien de rattaché, la lecture neuve intacte');
      const m2 = await poserLecture('m2', RECETTE_LUE('Gratin dauphinois', 152));
      const r2 = await G.rattacherLecture('m2', 'rcG', { cle: UI.cleLecture(m2), repo: intercaler('m2', async () => db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'm2')), recipe_id: 'rcS' }] }, origin: 'device' })) });
      eq([r2, (await db.get('imports', 'm2')).recipe_id], [{ issue: 'refuse', raison: 'transition' }, 'rcS'], 'T-D21 (ronde 1, R2, Ma) : la ligne rattachée à rcS par un autre onglet (même clé) entre la relecture et la transaction → refus, recipe_id resté rcS (jamais écrasé en silence vers rcG)');
      const m4 = await poserLecture('m4', RECETTE_LUE('Poire rôtie au miel', 140));
      const r4 = await G.rattacherLecture('m4', 'rcP', { cle: UI.cleLecture(m4), repo: intercaler('m4', async () => db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rcP')), availability: 'available' }] }, origin: 'device' })) });
      eq([r4, (await db.get('imports', 'm4')).recipe_id], [{ issue: 'refuse', raison: 'transition' }, null], 'T-D21 (ronde 1) : la référence devenue available (une lecture reçue) entre la relecture et la transaction → la candidature rejouée dans la transaction refuse : rien de rattaché');
      const appels = [];
      const espion = { ...repo, transitionner: async (s, k, o) => { appels.push(k); return repo.transitionner(s, k, o); } };
      const m3 = await poserLecture('m3', RECETTE_LUE('Pot-au-feu', 98));
      eq([await G.rattacherLecture('m3', 'rcS', { cle: UI.cleLecture({ ...m3, started_at: NOW }), repo: espion }), await G.rattacherLecture('m3', 'rcE2', { cle: UI.cleLecture(m3), repo: espion }), appels.length, (await db.get('imports', 'm3')).recipe_id], [{ issue: 'refuse', raison: 'lecture' }, { issue: 'refuse', raison: 'reference' }, 0, null], 'T-D21 (ronde 1, R14, R9) : une clé périmée → refus « lecture » dès la relecture ; une référence d’une AUTRE édition que la ligne → refus « reference » ; aucun appel à transitionner, rien de rattaché');
      // Mj : la ligne rattachée par un autre onglet entre la relecture de ?import= et la proposition → aucun bloc (la ligne est relue par proposer).
      await poserLecture('mj', RECETTE_LUE('Soupe de courge rôtie', 132));
      const lectures = []; const get = db.get; let premiere = true;
      db.get = (s, k) => {
        const p = (async () => { const v = await get.call(db, s, k); if (premiere && s === 'imports' && k === 'mj') { premiere = false; await db.mutate({ puts: { imports: [{ ...v, recipe_id: 'rcT' }] }, origin: 'device' }); } return v; })();
        if (s === 'imports' && k === 'mj') lectures.push(p);
        return p;
      };
      let edj;
      try { scene.replaceChildren(); edj = await monterEditeur(repo, db, { import: 'mj' }); await lectures.at(-1); await tick(); } finally { delete db.get; }
      eq([lectures.length >= 2, champDe(edj, 'Titre original *')?.querySelector('input')?.value, edj.querySelector('[data-role="apparier-lecture"]')], [true, 'Soupe de courge rôtie', null], 'T-D21 (ronde 1, Mj) : la lecture rattachée ailleurs entre la relecture de ?import= et la proposition → le formulaire est prérempli, mais aucune proposition (proposer relit la ligne : recipe_id posé)');
    });

    await ecranT5('T-D22 de bout en bout : classer, lire, reprendre, enregistrer une recette répartie', async (repo, db) => {
      await poserSeance(repo, db, { pages: ['pA', 'pB'], references: [], imprimees: { pA: 61, pB: 60 } });
      const f = fetchSuite([[200, corpsModele({ groupes: [{ photos: [2, 1], title: 'Clafoutis', printed_page: 60, uncertain: false }], orphelines: [], uncertain: [] })], [200, corpsModele(RECETTE_LUE('Clafoutis', 60))]]);
      const racine = await monterSeance(repo, db, { over: { fetch: f.fetch } });
      cocher(racine, ['pA', 'pB']);
      await attendre(() => classerBtn(racine) && !classerBtn(racine).disabled, '« Classer » allumé');
      classerBtn(racine).click();
      const p = panneau(racine);
      await pret(p);
      eq([p.etatClassement().groupes.map((g) => g.page_ids), boutonLire(p).textContent], [[['pB', 'pA']], 'Lire cette recette (1 appel)'], 'T-D22 : le classement factice [2, 1] → un groupe [pB, pA] ; « Lire cette recette (1 appel) »');
      boutonLire(p).click();
      await attendre(async () => (await db.getAll('imports')).some((i) => i.kind === 'recette' && i.status === 'a_verifier') && G.lotEnCours() === null, 'la recette lue');
      const ligne = (await db.getAll('imports')).find((i) => i.kind === 'recette');
      eq([f.appels.length, ligne.page_ids, ligne.recipe_id, navs.at(-1)], [2, ['pB', 'pA'], null, '/add?section=imports'], 'T-D22 : UN classement et UNE lecture (2 POST en tout), la ligne sur [pB, pA], sans référence ; Imports ensuite');
      scene.replaceChildren();
      boutonTexte(await monterEditeur(repo, db, { import: ligne.id }), 'Enregistrer les modifications').click();
      await attendre(async () => (await statutDe(db, ligne.id)) === 'enregistre', 'enregistrée');
      const rec = (await db.getAll('recipes')).find((r) => r.original_title === 'Clafoutis');
      scene.replaceChildren();
      const fiche = await FI.renderRecipe({ id: rec.id }, {}, await ctxDe(repo, db)); scene.append(fiche);
      eq([rec.source_page_ids, legendesOriginal(fiche), (await db.get('scan_sessions', 'ss1')).status], [['pB', 'pA'], ['p. 60', 'p. 61'], 'done'], 'T-D22 (M157, M121) : la fiche porte [pB, pA] et son « Original » montre pB (p. 60) puis pA (p. 61) ; la séance passe done (ses deux photos ont un rôle)');
    });

    // Tâche 5 (vérification, hors brief — décision déclarée au rapport ; renommés T5-V1 et T5-V2 en ronde 1 : hors de la séquence T-D de la spec § 7) :
    // deux comportements de la spec que la passe de mutants a laissés sans assertion.
    // § 4.8.1 point 2 : la séance disparue entre la relecture et la transaction → refus, rien d'écrit, le toast existant ; le geste suivant écrit sans elle
    // (M-seance-refus-muet). § 4.8.3 : la référence RELUE doit être encore candidate de l'édition de la ligne, sinon refus sans écriture (M-candidate).
    await ecranT5('T5-V1 écran ciblé : la séance disparue avant la transaction → refus dit, rien d’écrit ; le geste suivant écrit sans elle', async (repo, db) => {
      await poserSeance(repo, db);
      await db.mutate({ puts: { imports: [lueDuLot('lm', { rang: 1, total: 1, page_ids: ['p1'], recipe_id: 'rcS', device_id: repo.deviceId(), resultat: RECETTE_LUE('Soupe de courge', 132) })] }, origin: 'device' });
      let fois = 0;
      const espion = { ...repo, transitionner: async (s, k, o) => { if (k === 'lm' && o?.conditions?.scan_sessions && fois++ === 0) await db.mutate({ deletes: { scan_sessions: ['ss1'] }, origin: 'device' }); return repo.transitionner(s, k, o); } };
      const c = await monterCible(repo, db, 'rcS', { repo: espion });
      await enregistrerLecture(c);
      await attendre(() => dits.includes('La recette n’a pas pu être enregistrée. Réessaie.'), 'refus dit');
      eq([await statutDe(db, 'lm'), (await db.get('recipes', 'rcS')).availability, (await db.get('source_pages', 'p1')).role ?? null, navs.length], ['a_verifier', 'reference_only', null, 0], 'T5-V1 (M-seance-refus-muet) : la séance effacée entre la relecture de ses pages et la transaction → la condition du sac refuse : rien d’écrit (ligne a_verifier, fiche reference_only, page sans rôle, aucune navigation) et le toast existant le dit');
      await enregistrerLecture(c);
      await attendre(async () => (await statutDe(db, 'lm')) === 'enregistre', 'enregistrée sans la séance');
      eq([(await db.get('recipes', 'rcS')).availability, await db.get('scan_sessions', 'ss1') ?? null, dits.at(-1)], ['available', null, 'Recette importée'], 'T5-V1 : le geste suivant enregistre la lecture sans la séance disparue (jamais ressuscitée)');
    });

    await ecranT5('T5-V2 rattacherLecture : une référence qui n’est plus candidate, relue, est refusée sans écriture', async (repo, db) => {
      await poserSeance(repo, db);
      const lv = { id: 'lv', kind: 'recette', edition_id: 'ed1', recipe_id: null, scan_session_id: 'ss1', page_ids: ['p1'], photo_sha256: null, status: 'a_verifier', erreur: null, resultat: RECETTE_LUE('Gratin dauphinois', 148), reponse_brute: null, appels: 1, model: 'claude-x', duree_ms: 900, device_id: repo.deviceId(), document_id_vol: null, battement_at: null, started_at: DATE, finished_at: null, created_at: DATE, updated_at: DATE };
      await db.mutate({ puts: { imports: [lv] }, origin: 'device' });
      const appels = [];
      const espion = { ...repo, transitionner: async (s, k, o) => { appels.push(k); return repo.transitionner(s, k, o); } };
      const cle = UI.cleLecture(await db.get('imports', 'lv'));
      const issues = [];
      for (const id of ['rcA', 'rcW', 'rc_inconnue']) issues.push(await G.rattacherLecture('lv', id, { cle, repo: espion }));
      eq([issues.map((r) => [r.issue, r.raison]), appels.length, (await db.get('imports', 'lv')).recipe_id], [[['refuse', 'reference'], ['refuse', 'reference'], ['refuse', 'reference']], 0, null], 'T5-V2 (M-candidate) : une référence relue available (rcA), un signet (rcW) ou une fiche absente → refus « reference », AUCUN appel à transitionner, recipe_id nul');
    });

    // =================================================================================================================================
    // Tâche 6 — filets du lot (T-D20) : chaque texte neuf de la spec § 5 avec SON anglais (en.js fait foi pour la clé exacte) ; les clés réemployées
    // présentes ; les deux modules neufs dans SHELL, regroupement.js dans le filet i18n ; aucun texte ne nomme le fournisseur ni la base ;
    // regroupement.js n'écrit que par transitionner ou ouvrirImport (I-D1) ; la version de l'app et celle du service worker.
    await run('T-D20 filets du lot', async () => {
      const { EN } = await import('../src/i18n/en.js');
      const { MODULES_NEUFS } = await import('./ajouter.js');
      const { APP_VERSION } = await import('../src/model/schema.js');
      // Ronde 1 de T6 : ne retire que les commentaires qui OUVRENT une ligne (`//` et `/* */`) — couper tout ce qui suit un `//` effaçait aussi le code
      // qui suit une adresse dans une chaîne (« 'https://x'; repo.save( »).
      const sansCommentaires = (s) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
      const ATTENDU = {
        'Classer ces photos avec l’assistant': 'Sort these photos with the assistant',
        'Un classement = un appel à l’assistant ; lire les recettes coûtera ensuite un appel par recette.': 'One sorting = one call to the assistant; reading the recipes will then cost one call per recipe.',
        'Classe au plus 10 photos à la fois : décoche-en {k}.': 'Sort at most 10 photos at a time: uncheck {k}.',
        'Décoche les photos déjà en cours d’import ({k}).': 'Uncheck the photos already being imported ({k}).',
        'Une lecture est en cours : attends sa fin ou annule-la.': 'A reading is in progress: wait for it to finish or cancel it.',
        'Classement des photos par l’assistant…': 'The assistant is sorting the photos…', 'Reclasser': 'Sort again',
        'Reclasser remplace ce classement et tes changements de groupes, et coûte un appel. Continuer ?': 'Sorting again replaces this sorting and your group changes, and costs one call. Continue?',
        'Ignorer ce classement': 'Ignore this sorting',
        'Ignorer ce classement ? Il a coûté un appel ; le refaire en coûtera un autre.': 'Ignore this sorting? It cost one call; doing it again will cost another.',
        'Le classement a été coupé : classe moins de photos à la fois.': 'The sorting was cut off: sort fewer photos at a time.',
        'Aucune recette reconnue sur ces photos.': 'No recipe was recognized on these photos.', 'Classement reçu le {d}': 'Sorting received on {d}', 'Classement · {l}': 'Sorting · {l}',
        'Recettes trouvées': 'Recipes found',
        '1 recette proposée par l’assistant — vérifie le groupe avant de lire.': '1 recipe suggested by the assistant — check the group before reading.',
        '{n} recettes proposées par l’assistant — vérifie les groupes avant de lire.': '{n} recipes suggested by the assistant — check the groups before reading.',
        '(titre non lu)': '(title not read)', 'Recette {k}': 'Recipe {k}', 'Recette {k} — {t}': 'Recipe {k} — {t}', 'déjà liée à une recette': 'already linked to a recipe',
        'porte peut-être deux recettes': 'may hold two recipes', 'déjà en cours d’import': 'already being imported', 'Déplacer vers…': 'Move to…',
        'Déplacer la page {n} vers…': 'Move page {n} to…', 'Photos qui ne seront pas lues': 'Photos that won’t be read',
        'Déplace-les vers une recette si elles en font partie.': 'Move them to a recipe if they belong to one.', 'sans début de recette': 'no recipe start', 'non classée': 'not sorted',
        'retirée': 'removed', 'Complète “{t}”, p. {p}': 'Completes “{t}”, p. {p}', 'Complète “{t}”, p. {p} ?': 'Completes “{t}”, p. {p}?', 'Complète “{t}”': 'Completes “{t}”',
        'Complète “{t}” ?': 'Completes “{t}”?', 'Titre semblable, page différente ou inconnue.': 'Similar title, different or unknown page.',
        'Même page, titre différent.': 'Same page, different title.', 'Plusieurs références possibles.': 'Several possible references.',
        'Une autre recette du lot vise aussi cette référence.': 'Another recipe in the batch also targets this reference.',
        'Nouvelle recette — “{t}” restera repérée.': 'New recipe — “{t}” will stay spotted.', 'Déjà choisie pour la recette {k}': 'Already chosen for recipe {k}',
        'Choisir une référence…': 'Choose a reference…', 'Chercher dans les références de ce livre': 'Search this book’s references',
        'Aucune référence ne correspond.': 'No reference matches.', '{n} autres : affine la recherche.': '{n} more: refine the search.',
        'Import en cours — voir Imports': 'Import in progress — see Imports',
        'Aucun livre associé à cette séance : chaque recette sera une nouvelle recette.': 'No book linked to this session: each recipe will be a new recipe.',
        'Aucune recette à lire : déplace des photos vers une recette, ou ignore ce classement.': 'No recipe to read: move photos to a recipe, or ignore this sorting.',
        '{k} photo(s) déjà en cours d’import ailleurs : retire-les de leur recette, ou termine l’autre import.': '{k} photo(s) already being imported elsewhere: remove them from their recipe, or finish the other import.',
        'Lire cette recette (1 appel)': 'Read this recipe (1 call)', 'Lire ces recettes ({n} appels)': 'Read these recipes ({n} calls)',
        '1 recette à lire : suis-la dans Imports.': '1 recipe to read: follow it in Imports.',
        '{n} recettes à lire : suis-les dans Imports.': '{n} recipes to read: follow them in Imports.',
        'Rien n’a été lancé : ce classement, le livre de la séance ou une référence choisie a changé entre-temps.': 'Nothing was started: this sorting, the session’s book or a chosen reference changed in the meantime.',
        'Rien n’a été lancé : une photo est déjà en cours d’import ailleurs.': 'Nothing was started: a photo is already being imported elsewhere.', 'Nouvelle recette': 'New recipe',
        'Lot de 1 recette · {l}': 'Batch of 1 recipe · {l}', 'Lot de {n} recettes · {l}': 'Batch of {n} recipes · {l}', '{k} sur {n} lues': '{k} of {n} read',
        '· {e} en échec': '· {e} failed', 'Lecture du lot en cours…': 'Reading the batch…', 'Continuer la lecture (1 appel)': 'Continue reading (1 call)',
        'Continuer la lecture ({r} appels)': 'Continue reading ({r} calls)', 'Recette {k} sur {n}': 'Recipe {k} of {n}',
        '{n} recette(s) de cette séance dans Imports': '{n} recipe(s) from this session in Imports', 'Voir les imports': 'See imports',
        'En faire une nouvelle recette': 'Make it a new recipe', 'Ces pages complètent “{t}”, p. {p}.': 'These pages complete “{t}”, p. {p}.',
        'Ces pages complètent “{t}”.': 'These pages complete “{t}”.', 'Ces pages complètent peut-être “{t}”, p. {p} ?': 'These pages may complete “{t}”, p. {p}?',
        'Ces pages complètent peut-être “{t}” ?': 'These pages may complete “{t}”?', 'Enregistrer dans cette référence': 'Save into this reference',
        'La lecture sera enregistrée telle que lue dans la référence ; tes changements ici ne la suivent pas.': 'The reading will be saved as read into the reference; your changes here don’t follow it.',
        'Rien n’a été rattaché : cette lecture ou cette référence a changé entre-temps.': 'Nothing was linked: this reading or this reference changed in the meantime.',
      };
      eq(Object.entries(ATTENDU).filter(([fr, en]) => EN[fr] !== en).map(([fr]) => fr), [], 'T-D20 (§ 5) : chaque texte neuf du lot a son entrée en.js, avec son anglais (« Nouvelle recette » comprise)');
      eq(['Monter la page {n}', 'Descendre la page {n}', 'Retirer la page {n}', 'incertain', 'Incertain : {t}', 'Annuler', 'Ignorer', 'Reprendre', 'Relancer', 'Tu es hors ligne.', 'En cours sur un autre écran', 'Une lecture est déjà en cours : annule-la d’abord.', 'Code : {c}', 'L’assistant n’a pas répondu lisiblement. Réessaie.', 'Connecte-toi pour utiliser l’assistant.', '{n} photo ajoutée', '{n} photos ajoutées', 'p.', 'Sans livre', 'La recette n’a pas pu être enregistrée. Réessaie.', 'Une lecture = un appel à l’assistant, compté dans ton quota du jour.', 'Les photos de cette séance ne sont pas sur cet appareil.', 'Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.', 'La lecture a été interrompue. L’appel a peut-être été compté ; relancer en coûtera un autre.', 'L’appel a peut-être été compté ; relancer en coûtera un autre.', 'Page {n}', 'Une erreur est survenue', 'La demande est trop lourde : choisis moins de pages.'].filter((k) => typeof EN[k] !== 'string'), [], 'T-D20 : les clés existantes que le lot réemploie sont toujours là (ronde 1 de T6 : les trois phrases I-4 du lot A et les trois clés anciennes de regroupement.js comprises)');
      const sw = await lireLivraison();
      ok(sw.chemins.includes('./src/domain/classement.js') && sw.chemins.includes('./src/ui/regroupement.js'), 'T-D20 : SHELL contient les deux modules neufs du lot');
      eq([APP_VERSION, sw.release.split('-')[0] === APP_VERSION, MODULES_NEUFS.includes('../src/ui/regroupement.js')], ['0.32.5', true, true], 'T-D20 : APP_VERSION 0.32.5 (fixée par le chef d’orchestre : R-D-12 au lot D, R-E-18 au lot E, Global Constraints au lot F, I-UI-7 au lot UI-1), VERSION du service worker sur elle, regroupement.js dans le filet i18n');
      const sources = await Promise.all(['../src/ui/regroupement.js', '../src/domain/classement.js'].map(lire));
      ok(sources.every((x) => x.length > 1000) && /export function panneauClassement/.test(sources[0]) && /export function proposerAppariements/.test(sources[1]), 'T-D20 : les deux modules neufs sont lus (garde contre un source vide)');
      eq(sources.map((x) => /anthropic|supabase/i.test(x)), [false, false], 'T-D20 : aucun texte ne nomme le fournisseur ni la base dans les deux modules neufs (toute casse, ronde 1 de T6)');
      // Ronde 1 de T6 (I-D1) : tout ACCÈS sur `repo` ou sur l'espace de noms importé `repoModule` (chaînage optionnel et espaces compris, appelé ou non),
      // jamais une forme qui échappe au motif — crochets, alias, déstructuration, décomposition ; `repo = repoModule` (défaut des paramètres) seul admis.
      const src = sansCommentaires(sources[0]);
      const acces = [...src.matchAll(/(?<![\w$/])repo(Module)?\s*\??\.\s*(\w+)/g)];
      const ecritures = [...new Set(acces.filter((m) => !m[1]).map((m) => m[2]).filter((f) => !['get', 'all', 'byIndex', 'getFile', 'deviceId', 'newId'].includes(f)))].sort();
      const duModule = [...new Set(acces.filter((m) => m[1]).map((m) => m[2]))].filter((f) => !['newId', 'deviceId', 'BATTEMENT_MORT_MS'].includes(f));
      const detours = [...src.matchAll(/(?<![\w$])repo(?:Module)?\s*(?:\?\.\s*)?\[|\.\.\.\s*repo(?:Module)?\b/g)].map((m) => m[0])
        .concat([...src.matchAll(/(\w*)\s*=\s*(repo(?:Module)?)\b(?!\s*\??\.)/g)].map((m) => `${m[1]} = ${m[2]}`).filter((x) => x !== 'repo = repoModule'));
      // Vague finale (revue de branche, constat 11) : les deux formes que le motif ne voyait pas — un import NOMMÉ d'une fonction de repo.js, un second espace
      // de noms sous un autre nom — sont fermées en épinglant les imports : repo.js n'est importé QUE comme `repoModule`, db.js que pour TransitionRefusee.
      // Et (constat 7) la veille de l'état 2 rejoue repo.marquerInterrompus (lot A : la passe du démarrage, par transitionner conditionné) avec la constante
      // BATTEMENT_MORT_MS lue sur l'espace de noms.
      const lignesDe = (fin) => src.split('\n').filter((l) => l.includes(fin)).map((l) => l.trim());
      eq([ecritures, duModule, detours, lignesDe('repo.js'), lignesDe('db.js')], [['marquerInterrompus', 'ouvrirImport', 'transitionner'], [], [], ["import * as repoModule from '../model/repo.js';"], ["import { TransitionRefusee } from '../core/db.js';"]], 'T-D20 (I-D1) : src/ui/regroupement.js n’écrit que par repo.transitionner, repo.ouvrirImport et repo.marquerInterrompus (ni save, ni saveBatch, ni put, ni remove) — par repo ou par repoModule, `?.` et espaces compris ; repoModule ne sert que newId, deviceId et BATTEMENT_MORT_MS ; ni crochets, ni alias, ni déstructuration, ni décomposition (ronde 1 de T6) ; repo.js importé une seule fois, comme l’espace de noms repoModule, et db.js pour TransitionRefusee seul — ni import nommé, ni second espace de noms (vague finale, constat 11)');
    });

    // =================================================================================================================================
    // Vague finale (revue de branche) : un brouillon écrit après « Retirer » d'une photo classée (constat 1), « Regrouper en recette » sur une ligne de lot
    // (constat 4), des octets arrivés pendant que l'écran est monté (constat 5), la veille de l'état 2 (constat 7), le vol lié aux pages comptées (constat 9).
    await ecran('T-D4 (écran, vague finale, constat 1) « Retirer » une photo classée, un geste, un remontage : les groupes gardés', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_rt' })] });
      const groupesDe = (r) => panneau(r).etatClassement().groupes.map((g) => [g.cle, g.page_ids]);
      const monter = async (quoi) => { scene.replaceChildren(); const r = await monterSeance(repo, db, { query: { session: 'ss1', import: 'imp_rt' } }); await attendre(() => !!panneau(r).querySelector('[data-role="regroupement"]'), quoi); return r; };
      try {
        const r1 = await monter('regroupement rendu');
        choisirSelect(panneau(r1), 'p3', 'g2');
        await attendre(async () => (await brouillonEn(db, 'imp_rt'))?.groupes?.find((g) => g.cle === 'g2')?.page_ids?.join() === 'p2,p3', 'brouillon écrit (p3 dans g2)');
        cocher(r1, ['p5']);
        [...r1.querySelectorAll('button.btn')].find((b) => b.textContent === 'Retirer de la séance').click(); // « Retirer » de la séance : la vraie question
        await attendre(() => !!document.querySelector('dialog[open]'), 'question « Retirer »');
        [...document.querySelector('dialog[open]').querySelectorAll('button')].find((b) => b.textContent === 'Retirer de la séance').click();
        await attendre(async () => (await db.get('scan_sessions', 'ss1')).source_state?.active_page_ids.includes('p5') === false, 'p5 retirée de la sélection active');
        ok(!!await db.get('source_pages','p5'),'L2 classement : la page retirée de la séance reste conservée pour le journal payé');
        const r2 = await monter('remontage après « Retirer » (le refresh() de la séance)');
        const apresRetrait = groupesDe(r2);
        choisirSelect(panneau(r2), 'p4', 'nouveau'); // un geste : le brouillon est écrit SANS p5
        await attendre(async () => !!(await brouillonEn(db, 'imp_rt'))?.groupes?.some((g) => g.cle === 'n1'), 'brouillon écrit sans p5');
        const ecrit = await brouillonEn(db, 'imp_rt');
        const r3 = await monter('second remontage');
        eq([apresRetrait, ecrit.groupes.flatMap((g) => g.page_ids).includes('p5'), groupesDe(r3), panneau(r3).etatClassement().aPart], [[['g1', ['p1']], ['g2', ['p2', 'p3']], ['g3', ['p5']]], true, [['g1', ['p1']], ['g2', ['p2', 'p3']], ['g3', ['p5']], ['n1', ['p4']]], []], 'L5 T-D4 : retirer p5 de la sélection puis corriger et rouvrir conserve tout le classement payé, y compris p5 et les groupes corrigés');
      } finally { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }
    });

    await ecran('T-D11 (vague finale, constat 4) regrouperPermis : une photo d’une ligne de lot pas encore lue retire « Regrouper en recette »', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_lu', status: 'enregistre', over: { finished_at: DATE } }), ligneLot({ id: 'l1', classementId: 'imp_lu', rang: 1, total: 1, page_ids: ['p1', 'p3'] })] });
      const racine = await monterSeance(repo, db);
      cocher(racine, ['p1']);
      const surLot = lienRegrouper(racine);
      cocher(racine, ['p1', 'p2']);
      eq([surLot, !!lienRegrouper(racine), panneau(racine).regrouperPermis(['p3', 'p4']), panneau(racine).regrouperPermis(['p4'])], [null, true, false, true], 'T-D11 (M-regrouper-lot, vague finale, constat 4 ; D-D15) : une photo d’une ligne de lot pas encore lue (p1, p3) → pas de « Regrouper en recette » (l’éditeur la relirait : un appel de plus) ; une photo libre (p2, p4) → le geste reste');
    });

    await ecran('T-D12 (vague finale, constat 9) état 5 : page_ids réécrite entre le clic et le vol → refus avant tout décodage et toute transition', async (repo, db) => {
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_rw', status: 'a_lancer', page_ids: ['p1', 'p2'] })] });
      const ff = fauxFetch([200, corpsModele(CLASSEMENT_5)]);
      const sha = await Promise.all(['p4', 'p5'].map(async (id) => (await db.get('source_pages', id)).sha256));
      let arme = false, reecrit = false; const lus = [];
      // La relecture du journal par classer() (après la session) déclenche la réécriture : une réception ou un autre onglet entre le compte et le vol.
      const espion = { ...repo,
        all: async (s) => { const r = await repo.all(s); if (arme && !reecrit && s === 'imports') { reecrit = true; const l = await db.get('imports', 'imp_rw'); await db.mutate({ puts: { imports: [{ ...l, page_ids: ['p4', 'p5'] }] }, origin: 'device' }); } return r; },
        getFile: async (h) => { if (reecrit) lus.push(h); return repo.getFile(h); } };
      const p = await monterPanneau(espion, db, { importId: 'imp_rw', over: { fetch: ff.fetch } });
      await attendre(() => { const b = p.querySelector('button[data-role="classer"]'); return !!b && !b.disabled; }, '« Classer » allumé');
      arme = true;
      const avant = p.querySelector('button[data-role="classer"]');
      avant.click();
      await attendre(() => reecrit && p.querySelector('button[data-role="classer"]') !== avant, 'panneau redessiné après le clic');
      const l = await db.get('imports', 'imp_rw');
      eq([lus.filter((h) => sha.includes(h)), ff.appels.length, l.status, l.page_ids], [[], 0, 'a_lancer', ['p4', 'p5']], 'T-D12 (M-vol-pages, vague finale, constat 9 ; D-D1) : page_ids réécrite entre le compte et le vol → aucun octet des pages réécrites lu (aucun décodage), aucune transition, 0 POST — le vol est lié aux pages COMPTÉES');
    });

    await ecran('T-D13 (vague finale, constat 5) octets arrivés pendant que l’écran est monté : « Lire » se rallume au prochain état du moteur', async (repo, db) => {
      await poserSeance(repo, db, { sansOctets: ['p3'], imports: [ligneClassement({ id: 'imp_oc' })] });
      const abonnes = new Set();
      const ctx = await ctxDe(repo, db);
      ctx.sync.moteur = { onEtat: (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); } }; // un moteur factice : seul onEtat est lu
      const p = G.panneauClassement(ctx.scan_sessions.find((s) => s.id === 'ss1'), ctx, () => [], deps(repo, { importId: 'imp_oc', fetch: fauxFetch().fetch }));
      scene.append(p);
      await attendre(() => p.querySelector('[data-role="raison-lire"]')?.textContent === 'Les photos de cette séance ne sont pas sur cet appareil.', 'octets absents dits');
      const f = await imageDe('p3.jpg', '#123');
      await repo.putFile('sha-p3', f, { original_filename: f.name }); // « Télécharger » du lot G : les octets arrivent, rien sur le bus
      for (const fn of [...abonnes]) fn({});
      await attendre(() => { const b = p.querySelector('button[data-role="lire-recettes"]'); return !!b && !b.disabled; }, '« Lire » rallumé sans quitter la séance');
      eq([p.querySelector('[data-role="raison-lire"]')?.textContent, abonnes.size], ['Une lecture = un appel à l’assistant, compté dans ton quota du jour.', 1], 'T-D13 (M-octets-arrives, vague finale, constat 5 ; D-D24 après G) : des octets arrivés pendant que l’écran est monté → revérifiés à l’état suivant du moteur : « Lire » rallumé, la raison tue');
      scene.replaceChildren();
      for (const fn of [...abonnes]) fn({});
      eq(abonnes.size, 0, 'T-D13 (vague finale, constat 5) : le panneau démonté se désabonne du moteur au premier état qui le trouve détaché');
    });

    await ecran('T-D12 (vague finale, constat 7) état 2 « ailleurs » : la passe interrompu à l’affichage, puis la veille', async (repo, db) => {
      const passes = [];
      const espion = { ...repo, marquerInterrompus: async (m) => { const n = await repo.marquerInterrompus(m); passes.push(n); return n; } };
      // (a) un vol d'un document mort (battement de 12 h à l'horloge du panneau) : levé dès l'affichage — la veille par défaut (91 s) n'a pas le temps.
      await poserSeance(repo, db, { imports: [ligneClassement({ id: 'imp_mort', status: 'en_cours', over: { document_id_vol: 'doc-mort', battement_at: DATE, started_at: DATE } })] });
      const p = await monterPanneau(espion, db, { importId: 'imp_mort' });
      await attendre(async () => (await db.get('imports', 'imp_mort')).erreur?.raison === 'interrompu' && !!p.querySelector('[data-role="echec"]') && !!p.querySelector('button[data-role="reclasser"]'), 'interrompu à l’affichage');
      eq([(await db.get('imports', 'imp_mort')).status, passes[0]], ['echec', 1], 'T-D12 (M-veille-affichage, vague finale, constat 7 ; VF-15 du lot A) : un classement « en cours sur un autre écran » dont le document est mort → echec(interrompu) dès l’affichage, l’état 4 et « Reclasser » ; jamais bloqué sans geste');
      // (b) un vol encore vivant à l'affichage (battement à l'heure du panneau), dont le document meurt ensuite : levé par la veille (60 ms ici).
      scene.replaceChildren(); passes.length = 0;
      await poserSeance(repo, db, { id: 'ss2', imports: [ligneClassement({ id: 'imp_vif', sessionId: 'ss2', status: 'en_cours', over: { document_id_vol: 'doc-mort', battement_at: NOW, started_at: NOW } })] });
      const p2 = await monterPanneau(espion, db, { sessionId: 'ss2', importId: 'imp_vif', over: { veilleMs: 60 } });
      await attendre(() => passes.length >= 1 && p2.textContent === 'En cours sur un autre écran', 'première passe faite, vol vivant');
      const vif = await db.get('imports', 'imp_vif');
      await db.mutate({ puts: { imports: [{ ...vif, battement_at: DATE }] }, origin: 'device' }); // le document meurt : son battement vieillit, rien sur le bus
      await attendre(async () => (await db.get('imports', 'imp_vif')).erreur?.raison === 'interrompu' && !!p2.querySelector('[data-role="echec"]'), 'interrompu par la veille');
      eq([passes[0], (await db.get('imports', 'imp_vif')).status], [0, 'echec'], 'T-D12 (M-veille-repetee, vague finale, constat 7) : vivant à l’affichage (aucune ligne levée), puis mort → la veille le lève sans quitter la séance (toutes les BATTEMENT_MORT_MS + 1 s, injectées ici)');
    });

    // --- (repère) les tâches suivantes ajoutent leurs blocs AU-DESSUS de cette ligne
  } catch (error) {
    ok(false, `Lot de recettes : suite interrompue — ${error?.name || 'Erreur'} — ${error?.message || String(error)}`);
  } finally { setUiLocale(localeAvant); }
}
