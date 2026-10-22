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
const barre = (racine) => [...racine.querySelectorAll('button.btn.danger')].find((b) => b.textContent === 'Retirer')?.parentElement ?? null;
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
      eq([V({ groupes: [g([1], 'voir www.exemple.test/x')] }).groupes[0].title, V({ groupes: [g([1], 'voir www.exemple.test/x')] }).groupes[0].uncertain], [null, true], 'T-D1 (M7) : une adresse dans le titre → titre null + incertain');
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
        ['clé __proto__', JSON.parse('{"__proto__":{"cle":"x"}}')], ['oublie une page du résultat', { ...BR, groupes: BR.groupes.slice(0, 3), choix: sansChoix('n1') }],
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
    });

    // T-D5 appariement (§ 0 D-D5, § 3.6, B-1, F-2)
    await run('T-D5 appariement', async () => {
      const cand = C.candidatsReference([...REFERENCES_ED, ref('rcZ', 'Soupe de courge', 132, { edition_id: 'ed2' })], { editionId: 'ed1', imports: [IMPORT_RCO] });
      eq(cand.map((r) => r.id), ['rcS', 'rcT', 'rcG', 'rcP', 'rcX'], 'T-D5 (M38) : candidatsReference exclut le signet rcW, l’available rcA, rcO (import ouvert) et une autre édition');
      eq(C.referencesOccupees(REFERENCES_ED, { editionId: 'ed1', imports: [IMPORT_RCO] }).map((r) => r.id), ['rcO'], 'T-D5 (M113) : referencesOccupees rend rcO seule (montrée éteinte, jamais proposée)');
      eq([C.candidatsReference(REFERENCES_ED, { editionId: null, imports: [] }), C.referencesOccupees(REFERENCES_ED, { editionId: null, imports: [IMPORT_RCO] })], [[], []], 'T-D5 : sans édition → aucune candidate');
      eq(C.concordance({ title: 'Tarte fine aux poires', printed_page: 140 }, ref('x', 'Tarte aux poires', 141)), { titre: true, page: true, ecart: 1 }, 'T-D5 : « Tarte aux poires » ⊂ « Tarte fine aux poires », écart 1 → sûre');
      eq(C.concordance({ title: 'Tarte fine aux poires', printed_page: 140 }, ref('x', 'Tarte aux poires', 143)), { titre: true, page: false, ecart: 3 }, 'T-D5 (M39) : écart 3 → page fausse (± 2, jamais ± 3)');
      eq(C.concordance({ title: 'Tarte fine aux poires', printed_page: 140 }, ref('x', 'Poire rôtie au miel', 140)), { titre: false, page: true, ecart: 0 }, 'T-D5 (M40) : « Poire rôtie au miel » contre « Tarte fine aux poires » → titre faux (mots distinctifs, jamais l’égalité de chaînes)');
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
      eq(S.SORTES_IMPORT, ['recette', 'index', 'web', 'couverture', 'classement'], 'T-D8 : SORTES_IMPORT exact');
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
      eq(['x', 'é'.repeat(200), 'é'.repeat(201), '', ' a', 'a ', 'a\nb', 'a\u{2028}b', 'a\tb', 'Le\u{200B}sel', 'voir www.exemple.test/x', 'sur evil.com', 7, null].map((s) => B.estTitreUneLigne(s, 200)), [true, true, false, false, false, false, false, false, false, false, false, false, false, false], 'T-D8 (M119b) : estTitreUneLigne — une ligne, 1..200 points de code, égale à son trim, sans Cc/Cf/U+2028, sans adresse');
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
      finally { globalThis.fetch = vraiFetch; UI.reinitialiserImportCible(); G.reinitialiserLot(); window.dispatchEvent(new Event('online')); }
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
      boutonTexte(panneau(r3), 'Ignorer ce classement').click();
      await attendre(() => confirmations.length === 1, 'confirmation demandée'); await tick(); await tick();
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
      boutonTexte(ligneEl('c_recu'), 'Ignorer').click();
      await attendre(() => confirmations.length === 1, 'confirmation demandée'); await tick(); await tick();
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
        const geste = async (fn, attendu) => { gestes += 1; fn(); await attendre(async () => JSON.stringify(await groupesBrouillon(db, 'imp_cl')) === JSON.stringify(attendu), 'brouillon écrit : ' + JSON.stringify(attendu)); };
        try {
          await geste(() => choisirSelect(p, 'p3', 'g2'), [['g1', ['p1']], ['g2', ['p2', 'p3']], ['g3', ['p5']]]);
          eq([[...blocDe(p, 'g2').querySelectorAll('figure')].map((f) => f.dataset.page), document.activeElement === p.querySelector('select[data-role="deplacer"][data-page="p3"]')], [['p2', 'p3'], true], 'T-D13 : déplacer p3 vers « Recette 2 » par le select → blocs redessinés, le focus va au select de la même photo dans son nouveau bloc');
          await geste(() => choisirSelect(p, 'p2', 'nouveau'), [['g1', ['p1']], ['g2', ['p3']], ['g3', ['p5']], ['n1', ['p2']]]);
          eq([p.querySelectorAll('[data-role="groupe"]').length, boutonLire(p).textContent], [4, 'Lire ces recettes (4 appels)'], 'T-D13 (M77) : « Nouvelle recette » → un quatrième bloc, le coût recalculé (4 appels)');
          await geste(() => choisirSelect(p, 'p4', 'g1'), [['g1', ['p1', 'p4']], ['g2', ['p3']], ['g3', ['p5']], ['n1', ['p2']]]);
          await geste(() => blocDe(p, 'g1').querySelector('button[data-role="descendre"][data-page="p1"]').click(), [['g1', ['p4', 'p1']], ['g2', ['p3']], ['g3', ['p5']], ['n1', ['p2']]]);
          eq([document.activeElement?.dataset?.role, document.activeElement?.dataset?.page], ['descendre', 'p1'], 'T-D13 (M78) : ↓ — le focus suit la page déplacée');
          await geste(() => boutonTexte(blocDe(p, 'g1'), 'Retirer la page 2').click(), [['g1', ['p4']], ['g2', ['p3']], ['g3', ['p5']], ['n1', ['p2']]]);
          eq([...p.querySelector('[data-role="a-part"]').querySelectorAll('figure')].map((f) => [f.dataset.page, [...f.querySelectorAll('.chip')].map((c) => c.textContent)]), [['p1', ['retirée']]], 'T-D13 : « Retirer la page 2 » → la photo à part, puce « retirée »');
          gestes += 1;
          blocDe(p, 'g3').querySelector('[data-role="appariement"] label.check input').click();
          await attendre(async () => JSON.stringify((await brouillonEn(db, 'imp_cl'))?.choix) === JSON.stringify([['g3', 'rcG']]), 'choix de g3 écrit');
          await geste(() => choisirSelect(p, 'p5', 'g1'), [['g1', ['p4', 'p5']], ['g2', ['p3']], ['n1', ['p2']]]);
          eq([blocDe(p, 'g3'), (await brouillonEn(db, 'imp_cl')).choix], [null, []], 'T-D13 : vider un groupe le retire AVEC son choix');
        } finally { db.onMutate = capture; }
        eq([vus.length, vus.every((v) => v[0].join() === 'imports' && v[1].length === 1 && v[1][0][0] === 'imp_cl' && v[1][0][1] === 'a_verifier'), ff.appels.length, (await db.getAll('imports')).length], [gestes, true, 0, 1], 'T-D13 (M76) : CHAQUE geste n’écrit que le brouillon — un appel de db.onMutate par geste, imports seul, la ligne toujours a_verifier, aucune ligne neuve, 0 POST');
        eq([p.querySelector('figure[data-page="p1"] img').src === srcP1, urlsCreees], [true, urlsAvant], 'T-D13 (M132) : les redessins réutilisent la même URL pour la même photo, aucune URL de plus');
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
      const neuves = (await db.getAll('imports')).filter((i) => i.kind === 'recette').sort((a, b) => a.lot.rang - b.lot.rang);
      eq(neuves.map((l) => [l.recipe_id, l.page_ids, l.scan_session_id, l.edition_id, l.device_id, l.lot]), [['rcS', ['p3', 'p1'], 'ss1', 'ed1', repo.deviceId(), { classement_id: 'imp_cl', rang: 1, total: 3, titre: 'Soupe de courge', page: 132 }], ['rcT', ['p2'], 'ss1', 'ed1', repo.deviceId(), { classement_id: 'imp_cl', rang: 2, total: 3, titre: 'Tarte fine aux poires', page: 140 }], [null, ['p5'], 'ss1', 'ed1', repo.deviceId(), { classement_id: 'imp_cl', rang: 3, total: 3, titre: 'Gratin dauphinois', page: 148 }]], 'T-D15 (M141) : trois lignes — référence cochée ou nulle, l’ordre CHOISI [p3, p1], la séance, son édition, cet appareil, le lot');
      const cl = await db.get('imports', 'imp_cl');
      eq([cl.status, cl.reponse_brute, cl.brouillon, typeof cl.finished_at, dits, navs.at(-1)], ['enregistre', null, null, 'string', ['3 recettes à lire : suis-les dans Imports.'], '/add?section=imports'], 'T-D15 : classement enregistre (réponse brute et brouillon effacés, finished_at) ; UN toast, celui du succès (aucun refus d’un second geste) ; la navigation vers Imports');
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
      const p = await monterPanneau(repo, db, { over: { repo: espion, fetch: ff.fetch } });
      await pret(p);
      const seance = await db.get('scan_sessions', 'ss1');
      await relu(() => repo.save('scan_sessions', { ...seance, edition_id: 'ed2' }));
      eq([...(await essayerLire(p, db)), ff.appels.length], [RIEN_LIRE, 0, 'a_verifier', 0], 'T-D15 (M-rendu, M-rendu-edition, vérification) : le livre de la séance changé ICI (le bus relit la séance, sans redessin) → refuse(edition) : l’édition RENDUE part, jamais celle relue ni celle d’un redessin fait au clic ; rien d’écrit, 0 POST');
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
      for (const [cl, rep, libelle] of [
        ['quota', [429, { erreur: 'quota', quota: 60 }], 'T-D16 (M88) : un 429 écrit par la passerelle (quota) → 1 POST, les deux suivantes restent a_lancer'],
        ['relaye', [400, { type: 'error', error: { type: 'invalid_request_error', message: 'credit balance' } }], 'T-D16 (M116) : un 400 relayé sans champ erreur (requete : crédit épuisé, plafond) → 1 POST, arrêt'],
        ['illisible', [200, 'pas du json'], 'T-D16 (M117) : un 200 illisible (reponse_illisible) → 1 POST, arrêt'],
      ]) {
        await lot3(cl);
        const f = fauxFetch(rep);
        const r = await G.lireLeLot(cl, { ctx, repo, fetch: f.fetch, maintenant: () => NOW });
        eq([f.appels.length, await statuts(cl), r.arret !== null], [1, ['echec', 'a_lancer', 'a_lancer'], true], libelle);
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
      await course;
      eq([fa.appels.length, await statuts('annule')], [1, ['echec', 'a_lancer', 'a_lancer']], 'T-D16 (M89) : « Annuler » du premier (annulerVol) → arrêt du lot');
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

    // --- (repère) les tâches suivantes ajoutent leurs blocs AU-DESSUS de cette ligne
  } catch (error) {
    ok(false, `Lot de recettes : suite interrompue — ${error?.name || 'Erreur'} — ${error?.message || String(error)}`);
  } finally { setUiLocale(localeAvant); }
}
