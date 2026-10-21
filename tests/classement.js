// Tests du lot D « Un lot de recettes photographiées » (spec docs/superpowers/specs/2026-10-19-recettes-en-lot-design.md, rév. 4 ;
// plan docs/superpowers/plans/2026-10-19-recettes-en-lot.md). Fonctions pures sur des fixtures fixes (données fictives), primitives sur bases
// jetables (withRepo), écrans à dépendances injectées (repo, fetch, confirmer, navigate, toast, maintenant) ; aucun réseau ; chaque assertion
// nomme le mutant qu'elle tue (spec § 7). Les modules du lot sont importés DYNAMIQUEMENT : un module absent fait une ligne rouge nommée, jamais une
// page de tests blanche.
import { withRepo } from './sync-fixture.js';
import { on } from '../src/core/bus.js';
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

    // --- (repère) les tâches suivantes ajoutent leurs blocs AU-DESSUS de cette ligne
  } catch (error) {
    ok(false, `Lot de recettes : suite interrompue — ${error?.name || 'Erreur'} — ${error?.message || String(error)}`);
  } finally { setUiLocale(localeAvant); }
}
