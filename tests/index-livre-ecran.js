// Tests de l'ÉCRAN du lot I1 « index fiable » (spec docs/superpowers/specs/2026-10-28-index-fiable-design.md, rév. 2) : le panneau d'index d'une séance
// (lecture page par page par le vol partagé, enregistrement automatique des recettes certaines, « À vérifier », écartées, « Retirer ces {n} recettes »,
// relecture des pages incomplètes, moitiés d'une page dense, « Annuler »), la saisie à la main, la rotation d'une page, la fiche du livre (plages) et la
// recherche par rubrique. Bases jetables (withRepo), réseau factice injecté (un corps de réponse par appel, dans l'ordre), aucune dépense réelle.
import { withRepo } from './sync-fixture.js';
import { resetClock } from '../src/sync/clock.js';
import { setUiLocale, getUiLocale } from '../src/core/i18n.js';
import { sha256Hex } from '../src/core/hash.js';
import { TRINITY } from './index-livre.js';

const DATE = '2026-10-28T00:00:00.000Z';
const SESSION = { access_token: 'jeton-index-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
const MODELE = 'claude-sonnet-5-5';
const PAGES = ['pg310', 'pg311', 'pg312'];
// La réponse du modèle pour une page de la fixture, au format compact (D-I3) : « ^ » pour une entrée en retrait sous une rubrique hors de la photo.
const versModele = (page) => ({ sorte_page: page.sorte_page, page_imprimee: page.page_imprimee, incertain: [],
  entrees: page.entrees.map((e) => [e.titre, e.renvois, e.suite ? '^' : e.rubrique, e.sorte, e.incertain]) });
const corps = (data, extra = {}) => ({ model: MODELE, stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 },
  content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data) }], ...extra });
const reponse = (status, c) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof c === 'string' ? c : JSON.stringify(c)) });
// Un réseau factice : une réponse par appel, dans l'ordre ; 'suspendu' = jamais de réponse (seul « Annuler » en sort) ; au-delà de la liste, 500.
function reseau(reponses) {
  const a = { appels: [] };
  a.fetch = (url, options) => new Promise((resolve, reject) => {
    a.appels.push({ url, options });
    const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
    if (options?.signal?.aborted) { abandon(); return; }
    options?.signal?.addEventListener('abort', abandon, { once: true });
    const r = reponses[a.appels.length - 1];
    if (r === 'suspendu') return;
    const [st, c] = r || [500, { erreur: 'serveur' }];
    resolve(reponse(st, c));
  });
  return a;
}
// Les dimensions d'une image envoyée ({ mime, base64 } ou bloc de l'API { source: { media_type, data } }), décodée sans réseau (la CSP refuse data: à fetch).
async function dimsImage(im) {
  if (!im) return null;
  const b64 = im.base64 ?? im.source?.data; const mime = im.mime ?? im.source?.media_type;
  const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([octets], { type: mime })); const d = [bmp.width, bmp.height]; bmp.close(); return d;
}
const imagesDe = (appel) => JSON.parse(appel.options.body).corps.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((c) => c.type === 'image');
const COULEURS = ['#811', '#181', '#118', '#881'];
async function imageDe(nom, couleur, l = 320, h = 240) {
  const c = new OffscreenCanvas(l, h); const cx = c.getContext('2d');
  cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); cx.fillStyle = '#fff'; cx.fillRect(10, 10, l / 2, h / 2);
  return new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' });
}
// Un livre « Trinity », son édition ed1, une séance ss1 dont les pages portent de vraies images (le vol les décode) ; `but` = 'index' (séance d'index).
async function poser(repo, db, { pages = PAGES, but = 'index', recettes = [] } = {}) {
  const lignes = [],documents=[];
  for (const [i, id] of pages.entries()) {
    const f = await imageDe(`${id}.jpg`, COULEURS[i % COULEURS.length]); const sha256 = await sha256Hex(f);
    await repo.putFile(sha256, f, { original_filename: f.name });
    const document_id='doc_'+id;documents.push({id:document_id,edition_id:'ed1',scan_session_id:'ss1',source_type:'photo',sha256,original_filename:f.name,mime:f.type,size:f.size});
    lignes.push({ id, document_id, edition_id: 'ed1', sha256, printed_page: null, file_position: null, locator: null, position: i + 1, issues: [], kind: null, created_at: DATE, updated_at: DATE });
  }
  await db.mutate({ puts: {
    books: [{ id: 'b1', title: 'Trinity', author: 'Adam Byatt', created_at: DATE, updated_at: DATE }],
    book_editions: [{ id: 'ed1', book_id: 'b1', language: 'en', created_at: DATE, updated_at: DATE }],
    source_pages: lignes,source_documents:documents, recipes: recettes,
    scan_sessions: [{ id: 'ss1', status: 'open', edition_id: 'ed1', started_at: DATE, page_ids: [...pages], document_ids: documents.map(d=>d.id), device_id: repo.deviceId(), ...(but ? { but } : {}), created_at: DATE, updated_at: DATE }] } });
}
async function ctxDe(repo, db, { session = SESSION } = {}) {
  const [recipes, books, book_editions, source_pages, scan_sessions, imports,source_documents] = await Promise.all(['recipes', 'books', 'book_editions', 'source_pages', 'scan_sessions', 'imports','source_documents'].map((s) => db.getAll(s)));
  return {
    recipes, books, book_editions, source_pages, scan_sessions, imports, source_documents, recipe_versions: [], rediscovery_prefs: [], cook_history: [], dish_recipe_links: [], recipe_translations: [], dishes: [], ingredients: [], units: [], unit_conventions: [],
    recipesById: repo.indexBy(recipes), editionsById: repo.indexBy(book_editions), booksById: repo.indexBy(books), pagesById: repo.indexBy(source_pages),
    versionsByRecipe: new Map(), versionsById: new Map(), dishesById: new Map(), ingredientsById: new Map(), docsByRecipe: new Map(),
    settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' },
    sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } },
    editionLabel: () => 'Trinity', conventionFor: () => null,
  };
}
const attendre = async (cond, quoi, ms = 8000) => { for (let i = 0; i < ms / 10; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée : ' + quoi); };
const texte = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : null);
const boutonNomme = (racine, debut) => [...racine.querySelectorAll('button')].find((b) => texte(b).startsWith(debut)) || null;

export async function runIndexLivreEcranTests({ eq, ok }) {
  resetClock();
  const localeAvant = getUiLocale();
  setUiLocale('fr');
  const vraiFetch = globalThis.fetch;
  globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
  const bloc = async (nom, f) => { try { await f(); } catch (error) { ok(false, `Index (écran) — bloc « ${nom} » interrompu : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); } };
  let P; let M; let UI;
  try {
    P = await import('../src/ui/index-livre.js'); M = await import('../src/domain/index-livre.js'); UI = await import('../src/ui/import-cible.js');
  } catch (e) { ok(false, `Index (écran) : module illisible — ${e?.message || e}`); globalThis.fetch = vraiFetch; setUiLocale(localeAvant); return; }
  const attendu = M.consolider(TRINITY);
  const monter = async (repo, db, opts = {}) => {
    const ctx = await ctxDe(repo, db, opts);
    const session = ctx.scan_sessions[0];
    const dits = [];
    const racine = P.panneauIndex(session, ctx, () => session.page_ids, { seanceIndex: true, repo, toast: (m) => dits.push(m), confirmer: async () => true, enLigne: () => true, battementMs: 20, ...opts });
    document.body.append(racine);
    await attendre(() => racine.querySelector('[data-role="compte-pages"]'), 'premier dessin du panneau');
    await attendre(() => !racine.querySelector('.carte-connexion') || !opts.session, 'session lue');
    return { racine, ctx, session, dits };
  };
  const lireEtAttendre = async (racine, bouton) => {
    bouton.click();
    await attendre(() => racine.etatPanneau().occupe === true || racine.querySelector('[data-role="bilan"]'), 'départ de la lecture');
    await attendre(() => racine.etatPanneau().occupe === false && !racine.querySelector('[data-role="progression"]'), 'fin de la lecture');
  };

  try {
    await bloc('saisie à la main : lireSaisieIndex (pure)', async () => {
      const l = P.lireSaisieIndex('Tarte 116–19\nPot-au-feu — 140\nSalade de fenouil, p. 58\n212 Pâtes puttanesca\nKetchup 100 % maison — 12\nSans page\n\n  \u2028Gougères ..... 40–1');
      eq(l.map((x) => [x.titre, x.renvois]), [['Tarte', '116–19'], ['Pot-au-feu', '140'], ['Salade de fenouil', '58'], ['Pâtes puttanesca', '212'], ['Ketchup 100 % maison', '12'], ['Sans page', ''], ['Gougères', '40–1']],
        'lireSaisieIndex : renvois en fin (tiret, virgule et « p. », points de conduite), numéro en tête, titre sans page ; un titre à trait d’union ou à nombre intérieur reste entier ; lignes vides et U+2028 coupent');
      eq(P.lireSaisieIndex('x\n'.repeat(600)).length, 500, 'lireSaisieIndex : 500 lignes au plus');
      // Une ligne collée démesurée ne fige pas l'écran : chaque ligne est bornée avant l'analyse.
      const t0 = performance.now(); const enorme = P.lireSaisieIndex('Tarte ' + '1,'.repeat(100000) + 'x'); const duree = performance.now() - t0;
      eq([duree < 300, enorme.length, enorme[0].titre.length <= 400], [true, 1, true], 'une ligne de 200 000 caractères faite de numéros : analysée en moins de 300 ms, titre borné');
    });

    await bloc('plagesLisibles (une fiche reçue est une donnée hostile)', async () => {
      eq([M.plagesLisibles({ printed_pages: [{ debut: 116, fin: 119 }, { debut: 213, fin: 213 }] }), M.plagesLisibles({ printed_pages: [{ debut: '1', fin: 2 }, null, { debut: 5, fin: 3 }, { debut: 0, fin: 1 }], printed_page: 7 }),
        M.plagesLisibles({ printed_pages: 'x', printed_page: 10000 }), M.plagesLisibles({ printed_pages: Array.from({ length: 30 }, (_, i) => ({ debut: i + 1, fin: i + 1 })) }).length],
        [[{ debut: 116, fin: 119 }, { debut: 213, fin: 213 }], [{ debut: 7, fin: 7 }], [], 20], 'plagesLisibles : entiers 1..9999 et début ≤ fin seulement ; sinon la page imprimée ; 20 plages au plus');
    });

    await bloc('lectureDeSeance : la lecture la plus récente de chaque page', async () => {
      const page = (id, etat, titre) => ({ page_id: id, etat, sorte_page: 'index', page_imprimee: null, suite_rubrique: false, modele: MODELE, raison: etat === 'echec' ? 'illisible' : null, moities: 0,
        entrees: etat === 'echec' ? [] : [{ titre, renvois: '12', rubrique: null, sorte: 'recette', incertain: false }], incertain: [], ecartees: { adresse: 0, longueur: 0, forme: 0 } });
      const ligne = (id, quand, pages, decisions = {}, status = 'a_verifier') => ({ id, kind: 'index', scan_session_id: 'ss1', status, page_ids: pages.map((p) => p.page_id), started_at: quand, updated_at: '2026-10-28T09:00:00.000Z', model: MODELE, decisions, resultat: { format: 2, pages } });
      const L1 = ligne('imp1', '2026-10-28T01:00:00.000Z', [page('p1', 'lue', 'Tarte'), page('p2', 'echec')], { a: 'ecartee' });
      const L2 = ligne('imp2', '2026-10-28T02:00:00.000Z', [page('p2', 'lue', 'Flan')], { b: 'les_deux' });
      const L3 = ligne('imp3', '2026-10-28T03:00:00.000Z', [page('p1', 'echec')]);
      const autre = { ...ligne('imp4', '2026-10-28T04:00:00.000Z', [page('p3', 'lue', 'Gratin')]), scan_session_id: 'ss2' };
      const lu = P.lectureDeSeance([L3, autre, L2, L1], 'ss1');
      eq([lu.lignes.map((L) => L.id), lu.pages.map((p) => [p.page_id, p.etat, p.entrees[0]?.titre, p.ligne_id]), lu.decisions, lu.modeleValide],
        [['imp1', 'imp2', 'imp3'], [['p1', 'lue', 'Tarte', 'imp1'], ['p2', 'lue', 'Flan', 'imp2']], { a: 'ecartee', b: 'les_deux' }, true],
        'lectureDeSeance : lignes de la séance par date ; la page relue plus tard gagne, une page en échec ne remplace jamais une page lue ; décisions réunies ; une autre séance ignorée');
      eq(P.lectureDeSeance([L1, L2], 'ss1', ['p2']).pages.map((p) => p.page_id), ['p2'], 'lectureDeSeance : une page retirée de la séance ne compte plus');
      // Une décision écrite plus tard dans la PREMIÈRE lecture (updated_at plus récent) ne la fait pas repasser devant la relecture.
      const partielle = { ...page('p2', 'lue', 'Flan coupé'), etat: 'partielle' };
      const L1bis = { ...ligne('imp1', '2026-10-28T01:00:00.000Z', [page('p1', 'lue', 'Tarte'), partielle]), updated_at: '2026-10-28T23:00:00.000Z' };
      eq(P.lectureDeSeance([L2, L1bis], 'ss1').pages.find((p) => p.page_id === 'p2')?.entrees[0]?.titre, 'Flan', 'lectureDeSeance : l’ordre est celui du départ des lectures (started_at), jamais celui de la dernière écriture');
    });

    await bloc('enregistrerAuto : deux enregistrements simultanés de la même lecture n’écrivent qu’une fois (deux onglets, D-I15)', () => withRepo(async (repo, db) => {
      await poser(repo, db, { pages: ['pg310'] });
      // Une lecture qui garde une ambiguïté (la tarte à deux pages) : la ligne reste « à vérifier » après l'enregistrement, seul `auto_enregistre_at` protège.
      const entree = (titre, renvois, rubrique) => ({ titre, renvois, rubrique, sorte: 'recette', incertain: false });
      const page = { page_id: 'pg310', etat: 'lue', sorte_page: 'index', page_imprimee: 310, suite_rubrique: false, modele: MODELE, raison: null, moities: 0,
        entrees: [entree('Flan', '20', null), entree('Tarte', '12', 'pommes'), entree('Tarte', '40', 'poires')], incertain: [], ecartees: { adresse: 0, longueur: 0, forme: 0 } };
      await db.mutate({ puts: { imports: [{ id: 'impA', kind: 'index', edition_id:'ed1', scan_session_id: 'ss1', status: 'a_verifier', page_ids: ['pg310'], started_at: DATE, created_at: DATE, updated_at: DATE,
        model: MODELE, decisions: {}, resultat: { format: 2, pages: [page] } }] } });
      const session = await db.get('scan_sessions', 'ss1');
      const ctx = await ctxDe(repo, db);
      const issues = await Promise.all([P.enregistrerAuto('impA', { ctx, session, repo }), P.enregistrerAuto('impA', { ctx, session, repo })]);
      const flans = (await db.getAll('recipes')).filter((r) => r.original_title === 'Flan');
      const L = await db.get('imports', 'impA');
      eq([flans.length, issues.filter(Boolean).length, L.status, typeof L.auto_enregistre_at, (await db.getAll('recipes')).filter((r) => r.original_title === 'Tarte').length],
        [1, 1, 'a_verifier', 'string', 0],
        'deux enregistrements lancés ensemble : UN seul écrit (une seule fiche « Flan »), l’autre est refusé ; la tarte ambiguë attend la personne');
      // Deux onglets tranchent la même entrée en même temps : la décision n'est écrite qu'une fois, sa fiche n'est créée qu'une fois.
      const ed = await db.get('book_editions', 'ed1');
      let n = 0; const newId = () => `tarte_${n += 1}`;
      const fiche = () => M.fabriquerReferenceIndex({ titre: 'Tarte', renvois: '12', rubriques: [], section: null, sources: [] }, { edition: ed, newId, plages: [{ debut: 12, fin: 12 }] });
      const cleTarte = M.cleTitre('Tarte');
      const res = await Promise.allSettled([P.decider('impA', cleTarte, 'garder:12', [fiche()], { repo, resteApres: 0 }), P.decider('impA', cleTarte, 'garder:12', [fiche()], { repo, resteApres: 0 })]);
      eq([res.filter((r) => r.status === 'fulfilled').length, res.find((r) => r.status === 'rejected')?.reason?.name, (await db.getAll('recipes')).filter((r) => r.original_title === 'Tarte').length,
        (await db.get('imports', 'impA')).status], [1, 'TransitionRefusee', 1, 'enregistre'],
        'deux décisions simultanées sur la même entrée : une écrite, l’autre refusée ; une seule fiche ; la ligne se ferme');
    }));

    await bloc('une décision déjà prise ailleurs : le geste refusé n’écrit rien et ne dit pas d’échec (deux onglets, R-I1-4)', () => withRepo(async (repo, db) => {
      await poser(repo, db, { pages: ['pg310'] });
      const entree = (titre, renvois, rubrique) => ({ titre, renvois, rubrique, sorte: 'recette', incertain: false });
      const page = { page_id: 'pg310', etat: 'lue', sorte_page: 'index', page_imprimee: 310, suite_rubrique: false, modele: MODELE, raison: null, moities: 0,
        entrees: [entree('Flan', '20', null), entree('Tarte', '12', 'pommes'), entree('Tarte', '40', 'poires')], incertain: [], ecartees: { adresse: 0, longueur: 0, forme: 0 } };
      await db.mutate({ puts: { imports: [{ id: 'impB', kind: 'index', edition_id:'ed1', scan_session_id: 'ss1', status: 'a_verifier', page_ids: ['pg310'], started_at: DATE, created_at: DATE, updated_at: DATE,
        model: MODELE, decisions: {}, auto_enregistre_at: DATE, resultat: { format: 2, pages: [page] } }] } });
      const { racine, dits } = await monter(repo, db, {});
      try {
        await attendre(() => [...racine.querySelectorAll('[data-role="a-verifier"] li')].some((li) => texte(li).startsWith('Tarte')), 'la tarte à vérifier');
        // L'autre onglet tranche pendant que celui-ci montre encore la question (écriture sans bus : cet écran n'est pas redessiné).
        await db.mutate({ puts: { imports: [{ ...(await db.get('imports', 'impB')), decisions: { [M.cleTitre('Tarte')]: 'ecartee' } }] } });
        const li = [...racine.querySelectorAll('[data-role="a-verifier"] li')].find((x) => texte(x).startsWith('Tarte'));
        boutonNomme(li, 'Garder 12').click();
        await attendre(() => ![...racine.querySelectorAll('[data-role="a-verifier"] li')].some((x) => texte(x).startsWith('Tarte')), 'redessin sans la tarte');
        eq([(await db.getAll('recipes')).filter((r) => r.original_title === 'Tarte').length, dits], [0, []],
          'la décision prise ailleurs gagne : aucune fiche, aucune phrase d’échec, la question disparaît au redessin');
      } finally { racine.dispose?.();racine.remove(); }
    }));

    await bloc('séance d’index : lire, enregistrer d’office, « À vérifier », écartées, retirer (D-I1, D-I11, D-I15, D-I20)', () => withRepo(async (repo, db) => {
      UI.reinitialiserImportCible?.();
      await poser(repo, db);
      const net = reseau(TRINITY.map((p) => [200, corps(versModele(p))]));
      const { racine, dits } = await monter(repo, db, { fetch: net.fetch });
      try {
        eq([texte(racine.querySelector('[data-role="compte-pages"]')), texte(racine.querySelector('[data-role="etat-lecture"]')), texte(racine.querySelector('[data-role="lire"]')), net.appels.length],
          ['3 pages d’index', 'Lecture : à faire', 'Lire les 3 pages (9 appels au plus)', 0], 'avant la lecture : trois pages retenues sans cocher, « Lecture : à faire », le geste dit son coût, aucun appel');
        await lireEtAttendre(racine, racine.querySelector('[data-role="lire"]'));
        const imports = (await db.getAll('imports')).filter((i) => i.kind === 'index');
        const ajoutees = (await db.getAll('recipes')).filter((r) => r.edition_id === 'ed1' && imports.some(i=>i.id===r.index_import_id));
        eq([net.appels.length, net.appels.map((a) => imagesDe(a).length), net.appels.map((a) => JSON.parse(a.options.body).outil), imports.length, imports.map(i=>[i.index_call.page_id,i.status]).sort(), imports.some(i=>i.index_decisions?.length)],
          [3, [1, 1, 1], ['extraction', 'extraction', 'extraction'], 3, [['pg310','enregistre'],['pg311','a_verifier'],['pg312','a_verifier']], true], 'trois appels, UNE photo chacun, trois journaux exacts ; page310 résolue et close, pages311/312 gardées ouvertes pour les choux à vérifier');
        eq(ajoutees.map((r) => r.original_title).sort(), attendu.certaines.map((x) => M.titreEnregistre(x.titre)).sort(),
          'les recettes CERTAINES deviennent des références du livre, sans geste (D-I15) : exactement celles de la consolidation');
        eq([ajoutees.every((r) => r.availability === 'reference_only' && Array.isArray(r.printed_pages) && r.printed_pages.length > 0), new Set(ajoutees.map((r) => r.original_title.toLowerCase())).size === ajoutees.length,
          ajoutees.find((r) => r.original_title === 'Roast chicken and pommes purée')?.index_rubriques],
          [true, true, ['asparagus', 'chicken', 'cream']], 'chaque référence « À importer » porte ses pages ; aucune recette deux fois ; le poulet porte ses trois rubriques');
        const bilan = texte(racine.querySelector('[data-role="bilan"]'));
        eq(bilan, `${attendu.certaines.length} recettes dans le livre · ${attendu.aVerifier.length} à vérifier · ${attendu.ecartees.length} écartées`, 'le bilan dit ce qui est écrit, ce qui attend et ce qui est écarté');
        ok(texte(racine.querySelector('[data-role="etat-lecture"]'))?.startsWith('Lecture : faite le '), 'après la lecture : « Lecture : faite le {d} »');
        const choux = [...racine.querySelectorAll('[data-role="a-verifier"] li')].find((li) => texte(li).includes('choux à la crème'));
        eq([!!choux, choux && [...choux.querySelectorAll('button')].map(texte)], [true, ['Garder 236–238', 'Garder 40–41', 'Les deux', 'Écarter']],
          'les choux contradictoires : les deux pages montrées, aucune choisie d’office ; « Garder », « Les deux », « Écarter »');
        const garder = boutonNomme(choux, 'Garder 236–238');
        garder.click(); garder.click(); // une double tape : UNE décision, UNE fiche
        await attendre(async () => (await db.getAll('imports')).some(r=>r.index_decisions?.some(d=>d.action==='garder_option')), 'décision exacte écrite');
        await new Promise((r) => setTimeout(r, 50));
        eq([(await db.getAll('recipes')).filter((r) => r.original_title.startsWith('Choux à la crème')).length, dits.filter((m) => /décision/.test(m))], [1, []],
          'une double tape sur « Garder 236–238 » : une seule fiche, aucune phrase d’échec');
        const apres = (await db.getAll('imports')).filter(i=>imports.some(l=>l.id===i.id));
        const chouxFiche = (await db.getAll('recipes')).find((r) => r.original_title.startsWith('Choux à la crème'));
        eq([chouxFiche?.printed_pages, apres.map(i=>[i.index_call.page_id,i.status]).sort()], [[{ debut: 236, fin: 238 }], [['pg310','enregistre'],['pg311','enregistre'],['pg312','enregistre']]],
          '« Garder 236–238 » : référence aux pages choisies, décision conservée et tous les journaux entièrement résolus fermés');
        await attendre(() => racine.querySelector('[data-role="ecartees"]'), 'écartées redessinées');
        const ecartees = racine.querySelector('[data-role="ecartees"]');
        eq(texte(ecartees.querySelector('summary')), `Écartées (${attendu.ecartees.length})`, 'les écartées sont repliées et comptées (D-I4)');
        const equipement = [...ecartees.querySelectorAll('.row')].find((r) => texte(r).startsWith('equipment'));
        boutonNomme(equipement, 'C’est une recette').click();
        await attendre(async () => (await db.getAll('recipes')).some((r) => r.original_title === 'Equipment'), '« C’est une recette »');
        await attendre(() => texte(racine.querySelector('[data-role="ecartees"] summary')) === `Écartées (${attendu.ecartees.length - 1})`, 'écartées recomptées');
        // Une référence modifiée par la personne n'est jamais retirée (D-I20).
        const poulet = (await db.getAll('recipes')).find((r) => r.original_title === 'Roast chicken and pommes purée');
        await repo.save('recipes', { ...poulet, favorite: true });
        await attendre(() => racine.querySelector('[data-role="retirer"]'), 'bouton Retirer');
        racine.querySelector('[data-role="retirer"]').click();
        await attendre(async () => (await db.getAll('recipes')).filter((r) => r.edition_id === 'ed1' && !r.trashed_at).length === 1 && dits.some((m) => /recettes retirées$/.test(m)), 'retrait dit');
        const restent = (await db.getAll('recipes')).filter((r) => r.edition_id === 'ed1' && !r.trashed_at);
        eq([restent.map((r) => r.original_title), dits.some((m) => /recettes retirées$/.test(m))], [['Roast chicken and pommes purée'], true],
          '« Retirer ces {n} recettes » retire celles de la lecture restées intactes — la recette mise en favori reste');
      } finally { racine.dispose?.();racine.remove(); UI.reinitialiserImportCible?.(); }
    }));

    await bloc('une page illisible : « Relire la page incomplète », sans recréer ce qui est déjà dans le livre (D-I10)', () => withRepo(async (repo, db) => {
      UI.reinitialiserImportCible?.();
      await poser(repo, db);
      const net = reseau([[200, corps(versModele(TRINITY[0]))], [200, corps('pas du json')], [200, corps(versModele(TRINITY[2]))], [200, corps(versModele(TRINITY[1]))]]);
      const { racine } = await monter(repo, db, { fetch: net.fetch });
      try {
        await lireEtAttendre(racine, racine.querySelector('[data-role="lire"]'));
        const avant = (await db.getAll('recipes')).filter((r) => r.edition_id === 'ed1').map((r) => r.original_title).sort();
        eq([net.appels.length, texte(racine.querySelector('[data-role="etat-lecture"]')), texte(racine.querySelector('[data-role="reprendre"]'))],
          [3, 'Lecture : 1 page à relire', 'Reprendre la lecture (3 appels au plus)'], 'la page 311 illisible : la lecture garde les deux autres, dit « 1 page à relire » et offre de la relire (1 appel)');
        await lireEtAttendre(racine, racine.querySelector('[data-role="reprendre"]'));
        const apres = (await db.getAll('recipes')).filter((r) => r.edition_id === 'ed1').map((r) => r.original_title);
        eq([net.appels.length, (await db.getAll('imports')).filter((i) => i.kind === 'index').length, imagesDe(net.appels[3]).length,
          avant.every((t) => apres.includes(t)), new Set(apres.map((t) => t.toLowerCase())).size === apres.length, apres.length >= avant.length],
          [4, 3, 1, true, true, true], 'la reprise : UN appel de plus, seul journal échoué repris sous CAS ; lectures réussies et références conservées sans doublon');
        // Lues en deux temps (310 et 312, puis 311), les choux n'ont d'abord qu'une page (236–238) : certains, ils sont écrits ; la page 311 apporte 40–41,
        // et la contradiction est alors montrée avec l'option déjà dans le livre, jamais tranchée en silence ni recréée.
        const partiel = M.consolider([TRINITY[0], TRINITY[2]]).certaines.map((x) => M.titreEnregistre(x.titre));
        const attenduFinal = [...new Set([...attendu.certaines.map((x) => M.titreEnregistre(x.titre)), ...partiel])].sort();
        eq(apres.slice().sort(), attenduFinal, 'après la relecture, le livre porte les certaines des trois pages, plus celles déjà écrites par la première lecture');
        const choux = [...racine.querySelectorAll('[data-role="a-verifier"] li')].find((li) => texte(li).includes('choux à la crème'));
        eq([!!choux, choux && texte(choux).includes('236–238 · déjà dans le livre'), choux && [...choux.querySelectorAll('button')].map(texte)], [true, true, ['Garder 40–41', 'Les deux', 'Écarter']],
          'la contradiction arrivée avec la page 311 : 236–238 est dite « déjà dans le livre » (aucun « Garder » ne la recrée), « Garder 40–41 », « Les deux », « Écarter »');
        boutonNomme(choux, 'Les deux').click();
        await attendre(async () => (await db.getAll('recipes')).filter((r) => r.original_title.startsWith('Choux à la crème')).length === 2, '« Les deux »');
        eq((await db.getAll('recipes')).filter((r) => r.original_title.startsWith('Choux à la crème')).map((r) => M.textePlages(M.plagesLisibles(r))).sort(), ['236–238', '40–41'],
          '« Les deux » ajoute la page qui manque, jamais une seconde fiche à 236–238');
      } finally { racine.dispose?.();racine.remove(); UI.reinitialiserImportCible?.(); }
    }));

    await bloc('page dense : coupée, relue en deux moitiés (D-I2)', () => withRepo(async (repo, db) => {
      UI.reinitialiserImportCible?.();
      await poser(repo, db, { pages: ['pg310'] });
      const p = versModele(TRINITY[0]); const moitie = Math.ceil(p.entrees.length / 2);
      const net = reseau([[200, corps('{"sorte_page":"index","entrees":[', { stop_reason: 'max_tokens' })], [200, corps({ ...p, entrees: p.entrees.slice(0, moitie + 2) })], [200, corps({ ...p, entrees: p.entrees.slice(moitie) })]]);
      const { racine } = await monter(repo, db, { fetch: net.fetch });
      try {
        eq(texte(racine.querySelector('[data-role="lire"]')), 'Lire la page (3 appels au plus)', 'une page : le geste dit « Lire la page (1 appel) »');
        await lireEtAttendre(racine, racine.querySelector('[data-role="lire"]'));
        const dims = await Promise.all(net.appels.map((a) => dimsImage(imagesDe(a)[0])));
        const L = (await db.getAll('imports')).find((i) => i.kind === 'index');
        const page = P.lectureDeSeance(await db.getAll('imports'),'ss1',['pg310']).pages[0];
        eq([net.appels.length, page?.etat, page?.moities, dims[0]?.[0], dims[1]?.[0] < dims[0]?.[0] && dims[2]?.[0] < dims[0]?.[0], dims[1]?.[1] === dims[0]?.[1]], [3, 'lue', 2, 320, true, true],
          'coupée (max_tokens) : deux appels de plus, chacun avec une moitié (moins large, même hauteur) de la photo ; la page est lue en deux moitiés');
        eq([page.entrees.length, TRINITY[0].entrees.every((e) => page.entrees.some((x) => x.titre === e.titre && x.renvois === e.renvois))], [TRINITY[0].entrees.length, true],
          'les entrées du recouvrement ne sont pas doublées (autant d’entrées que la page entière), aucune n’est perdue');
      } finally { racine.dispose?.();racine.remove(); UI.reinitialiserImportCible?.(); }
    }));

    await bloc('« Annuler » pendant la lecture : rien n’est écrit dans le livre', () => withRepo(async (repo, db) => {
      UI.reinitialiserImportCible?.();
      await poser(repo, db);
      const net = reseau([[200, corps(versModele(TRINITY[0]))], 'suspendu']);
      const { racine } = await monter(repo, db, { fetch: net.fetch });
      try {
        racine.querySelector('[data-role="lire"]').click();
        await attendre(() => net.appels.length === 2, 'deuxième page en vol');
        await attendre(() => texte(racine.querySelector('[data-role="progression"]')) === 'Lecture de la page 2 sur 3…', 'progression');
        boutonNomme(racine, 'Annuler').click();
        await attendre(() => racine.etatPanneau().occupe === false, 'fin après Annuler');
        const rows=await db.getAll('imports'),L=rows.find(i=>i.kind==='index'&&i.status==='echec');
        eq([L?.status, L?.erreur?.raison, (await db.getAll('recipes')).filter((r) => r.edition_id === 'ed1').length, net.appels.length], ['echec', 'annule', 0, 2],
          '« Annuler » : la ligne passe en échec (annulée), aucune recette écrite, aucun appel de plus');
        await attendre(() => racine.querySelector('[data-role="reprendre"]'), 'Reprendre offert');
        eq(texte(racine.querySelector('[data-role="reprendre"]')), 'Reprendre la lecture (3 appels au plus)', 'après « Annuler », « Reprendre la lecture » (la page déjà lue n’est pas relue : au plus 3 appels annoncés)');
      } finally { racine.dispose?.();racine.remove(); UI.reinitialiserImportCible?.(); }
    }));

    await bloc('lue par un modèle hors liste : rien d’enregistré d’office (D-I16)', () => withRepo(async (repo, db) => {
      UI.reinitialiserImportCible?.();
      await poser(repo, db, { pages: ['pg310'] });
      const net = reseau([[200, corps(versModele(TRINITY[0]), { model: 'claude-haiku-5-5' })]]);
      const { racine } = await monter(repo, db, { fetch: net.fetch });
      try {
        await lireEtAttendre(racine, racine.querySelector('[data-role="lire"]'));
        eq([(await db.getAll('recipes')).filter((r) => r.edition_id === 'ed1').length, texte(racine).includes('rien n’a été ajouté d’office')], [0, true],
          'un modèle hors de la liste validée : aucune référence écrite, tout attend dans « À vérifier », et l’écran le dit');
      } finally { racine.dispose?.();racine.remove(); UI.reinitialiserImportCible?.(); }
    }));

    for (const changement of ['compte', 'generation']) await bloc('saisie ancienne : ' + changement, () => withRepo(async (repo, db) => {
      await poser(repo, db); const ed = await db.get('book_editions', 'ed1'), dits = [];
      const zone = P.saisieIndexManuelle(ed, { repo, toast: m => dits.push(m), ctx: { proprietaireDonnees: null } }); document.body.append(zone);
      try {
        if (changement === 'compte') await db.put('sync_state', { key: 'user_id', value: 'nouveau-compte' }, { origin: 'device' });
        else { const state = await import('../src/ui/state.js'); state.setSyncState({ ...state.getSyncState() }); }
        zone.querySelector('textarea').value = 'Recette tardive — 12'; zone.querySelector('[data-role="ajouter-saisie"]').click();
        await attendre(() => dits.length > 0, 'ancien contexte refusé');
        eq((await db.getAll('recipes')).filter(r => r.original_title === 'Recette tardive').length, 0, 'L1 index : saisie issue d’un ancien ' + changement + ' ne crée rien');
        eq(zone.querySelector('textarea').value, 'Recette tardive — 12', 'L1 index : refus conserve la saisie après changement de ' + changement);
      } finally { zone.remove(); }
    }));

    await bloc('saisie à la main : création, et rien de recréé (fiche livre et panneau)', () => withRepo(async (repo, db) => {
      await poser(repo, db, { recettes: [{ id: 'rc_ex', edition_id: 'ed1', original_title: 'Trinity bread', original_language: 'en', availability: 'reference_only', verification_state: 'unverified', printed_page: 24, printed_pages: [{ debut: 24, fin: 26 }], source_page_ids: [], current_version_id: null, tags: [], cuisines: [], favorite: false, created_at: DATE, updated_at: DATE }] });
      const ed = await db.get('book_editions', 'ed1');
      const dits = []; let apres = 0;
      const zone = P.saisieIndexManuelle(ed, { repo, toast: (m) => dits.push(m), apres: () => { apres += 1; } });
      document.body.append(zone);
      try {
        zone.querySelector('textarea').value = 'Trinity bread — 24–6\nBaguettes — 28–9\nCanelés, p. 44\nSans page';
        zone.querySelector('[data-role="ajouter-saisie"]').click();
        await attendre(() => apres === 1, 'saisie écrite');
        const r = (await db.getAll('recipes')).filter((x) => x.edition_id === 'ed1');
        eq([r.map((x) => [x.original_title, M.textePlages(M.plagesLisibles(x))]).sort(), dits, zone.querySelector('textarea').value],
          [[['Baguettes', '28–29'], ['Canelés', '44'], ['Sans page', ''], ['Trinity bread', '24–26']], ['3 recettes ajoutées'], ''],
          'chaque ligne devient une référence (plages développées) ; « Trinity bread — 24–6 » déjà dans le livre n’est pas recréée ; un titre sans page est gardé');
        zone.querySelector('textarea').value = 'Baguettes — 28–29';
        zone.querySelector('[data-role="ajouter-saisie"]').click();
        await attendre(() => dits.length === 2, 'second ajout');
        eq([dits[1], (await db.getAll('recipes')).filter((x) => x.edition_id === 'ed1').length], ['Rien de nouveau à ajouter.', 4], 'une ligne déjà dans le livre : « Rien de nouveau à ajouter. », rien d’écrit');
      } finally { zone.remove(); }
    }));

    await bloc('séance de scan : séance d’index explicite, « Page de l’index », « Pivoter » (D-I11, D-I12, D-I13)', () => withRepo(async (repo, db) => {
      await poser(repo, db);
      const I = await import('../src/ui/import.js');
      const ctx = await ctxDe(repo, db);
      UI.reinitialiserImportCible?.();
      const net = reseau(TRINITY.map((p) => [200, corps(versModele(p))]));
      const vue = await I.renderImport({}, { session: 'ss1' }, ctx, { fetch: net.fetch, enLigne: () => true, battementMs: 20, toast: () => {} });
      document.body.append(vue);
      try {
        const panneau = vue.querySelector('[data-role="panneau-index"]');
        const boutonIndex = [...vue.querySelectorAll('button')].find((b) => texte(b) === 'Index / table des matières');
        const champ = vue.querySelector('figure[data-page="pg310"] input[type="number"]');
        eq([!!panneau && !panneau.hidden, !!boutonIndex, champ?.getAttribute('placeholder'), champ?.getAttribute('aria-label')], [true, false, 'Page de l’index', 'Page de l’index'],
          'séance d’index : le panneau est ouvert d’office, sans bouton « Index / table des matières » ; le champ de chaque photo dit « Page de l’index »');
        let fig = vue.querySelector('figure[data-page="pg310"]');
        boutonNomme(fig, '↻').click();
        await attendre(async () => (await db.getAll('source_pages')).some(p=>p.source_revision?.parent_page_id==='pg310'&&p.rotation===90), 'nouvelle révision orientée conservée');
        const pivotee=(await db.getAll('source_pages')).find(p=>p.source_revision?.parent_page_id==='pg310'&&p.rotation===90);
        await attendre(()=>panneau.querySelector('[data-role=revoir-sources]')&&!panneau.querySelector('[data-role=revoir-sources]').disabled,'comparaison proposée après rotation');panneau.querySelector('[data-role=revoir-sources]').click();
        // La page pivotée part pivotée : la première photo envoyée est en hauteur (240 × 320), les autres restent en largeur.
        await attendre(() => panneau.querySelector('[data-role="lire"]') && !panneau.querySelector('[data-role="lire"]').disabled, 'Lire allumé').catch(e=>{throw Error(e.message+' '+JSON.stringify(panneau.etatPanneau())+' '+panneau.textContent);});
        panneau.querySelector('[data-role="lire"]').click();
        await attendre(() => net.appels.length === 3, 'trois pages envoyées');
        eq(await Promise.all(net.appels.map((x) => dimsImage(imagesDe(x)[0]))), [[240, 320], [320, 240], [320, 240]], '« Pivoter » d’un quart de tour : la photo envoyée à l’assistant est pivotée, les autres non (D-I12)');
        await attendre(() => panneau.etatPanneau().occupe === false, 'fin de la lecture');
        fig=vue.querySelector(`figure[data-page="${pivotee.id}"]`);boutonNomme(fig, '↻').click();
        await attendre(async () => (await db.getAll('source_pages')).some(p=>p.source_revision?.parent_page_id===pivotee.id&&p.rotation===180), 'deuxième révision orientée');
        const suivante=(await db.getAll('source_pages')).find(p=>p.source_revision?.parent_page_id===pivotee.id&&p.rotation===180);
        await attendre(()=>vue.querySelector(`figure[data-page="${suivante.id}"]`),'nouvelle miniature');fig=vue.querySelector(`figure[data-page="${suivante.id}"]`);
        eq([fig.dataset.rotation, boutonNomme(fig, '↻')?.getAttribute('aria-label'),(await db.get('source_pages',pivotee.id)).rotation], ['180', 'Pivoter la page 1',90], '« Pivoter » : un quart de tour gardé sur la page, la miniature suit (data-rotation)');
      } finally { vue.dispose?.();vue.remove(); UI.reinitialiserImportCible?.(); }
    }));

    await bloc('séance générique : le panneau d’index reste fermé derrière « Index / table des matières » (D-I11)', () => withRepo(async (repo, db) => {
      // Une séance neuve, sans intention d'index ni lecture d'index, ses pages pas encore rangées : une séance générique.
      await poser(repo, db, { pages: ['pg310'], but: null });
      const I = await import('../src/ui/import.js');
      const ctx2 = await ctxDe(repo, db);
      const vue2 = await I.renderImport({}, { session: 'ss1' }, ctx2, {});
      document.body.append(vue2);
      try {
        const fermeAvant = vue2.querySelector('[data-role="panneau-index"]')?.hidden;
        vue2.querySelector('figure[data-page="pg310"] input[type="checkbox"]').click();
        await attendre(() => [...vue2.querySelectorAll('button')].some((b) => texte(b) === 'Index / table des matières'), 'bouton de la sélection');
        [...vue2.querySelectorAll('button')].find((b) => texte(b) === 'Index / table des matières').click();
        await attendre(() => texte(vue2.querySelector('[data-role="compte-pages"]')) === '1 page(s) sélectionnée(s)', 'panneau redessiné sur la sélection');
        eq([fermeAvant, vue2.querySelector('[data-role="panneau-index"]')?.hidden, texte(vue2.querySelector('[data-role="compte-pages"]'))], [true, false, '1 page(s) sélectionnée(s)'],
          'séance générique : le panneau reste fermé derrière « Index / table des matières », qui l’ouvre sur la sélection');
      } finally { vue2.dispose?.();vue2.remove(); }
    }));

    await bloc('pagePourEnvoi : la rotation de la page suit jusqu’à l’image envoyée (D-I12)', async () => {
      const L = await import('../src/domain/llm.js');
      const f = await imageDe('r.jpg', '#811', 320, 240);
      eq([await dimsImage(await L.pagePourEnvoi(f)), await dimsImage(await L.pagePourEnvoi(f, { rotation: 90 })), await dimsImage(await L.pagePourEnvoi(f, { rotation: 180 }))], [[320, 240], [240, 320], [320, 240]],
        'pagePourEnvoi : un quart de tour échange largeur et hauteur ; un demi-tour non');
    });

    await bloc('gardes du panneau : sans session, hors ligne, image illisible, double clic, jeton, quota (portées du lot C)', () => withRepo(async (repo, db) => {
      UI.reinitialiserImportCible?.();
      await poser(repo, db, { pages: ['pg310'] });
      const lignes = async () => (await db.getAll('imports')).filter((i) => i.kind === 'index').length;
      { // sans session : la carte « Connecte-toi » ; le geste éteint ; aucun appel
        const net = reseau([]);
        const { racine } = await monter(repo, db, { fetch: net.fetch, session: null });
        try {
          await attendre(() => racine.querySelector('[data-role="connexion-ia"]'), 'carte de connexion');
          eq([!racine.querySelector('[data-role="connexion-ia"]').hidden, racine.querySelector('[data-role="lire"]')?.disabled], [true, true], 'sans session : « Connecte-toi pour utiliser l’assistant. » et « Lire » éteint');
          racine.querySelector('[data-role="lire"]').click();
          await new Promise((r) => setTimeout(r, 30));
          eq([net.appels.length, await lignes()], [0, 0], 'sans session : aucun appel, aucune ligne du journal');
        } finally { racine.dispose?.();racine.remove(); }
      }
      { // hors ligne : éteint
        const net = reseau([]);
        const { racine } = await monter(repo, db, { fetch: net.fetch, enLigne: () => false });
        try { eq(racine.querySelector('[data-role="lire"]')?.disabled, true, 'hors ligne : « Lire » éteint (rien ne part)'); } finally { racine.dispose?.();racine.remove(); }
      }
      { // une page qui ne se décode pas : refus AVANT toute écriture, dit par un toast ; aucun POST
        const illisible = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
        const sha = await sha256Hex(illisible);
        await repo.putFile(sha, illisible, {});
        await db.mutate({ puts: { source_pages: [{ ...(await db.get('source_pages', 'pg310')), sha256: sha }] } });
        const net = reseau([]);
        const { racine, dits } = await monter(repo, db, { fetch: net.fetch });
        try {
          racine.querySelector('[data-role="lire"]').click();
          await attendre(() => !!racine.querySelector('[data-role=erreur-index]'), 'refus visible');
          eq([net.appels.length, await lignes(), !!racine.querySelector('[data-role=erreur-index]')], [0, 0, true], 'image illisible : aucun POST, aucune ligne, le toast de l’image');
        } finally { racine.dispose?.();racine.remove(); }
      }
      await poser(repo, db, { pages: ['pg310'] }); // des octets lisibles à nouveau
      { // double clic : UN vol, UNE ligne ; le jeton n'apparaît jamais à l'écran ; quota atteint → la phrase de la passerelle et « Reprendre »
        const net = reseau([[429, { erreur: 'quota', quota: 60 }]]);
        const { racine } = await monter(repo, db, { fetch: net.fetch });
        try {
          const b = racine.querySelector('[data-role="lire"]');
          b.click(); b.click();
          await attendre(() => racine.querySelector('[data-role="echec"]'), 'échec dit');
          eq([net.appels.length, await lignes(), texte(racine.querySelector('[data-role="echec"]')), texte(racine.querySelector('[data-role="reprendre"]'))],
            [1, 1, 'Tu as atteint la limite du jour pour l’assistant (60 appels).', 'Reprendre la lecture (3 appels au plus)'],
            'double clic : un appel, une ligne ; quota atteint : la phrase de la passerelle, puis « Reprendre la lecture (1 appel au plus) »');
          ok(!racine.textContent.includes(SESSION.access_token), 'le jeton de la session n’apparaît jamais dans le panneau');
        } finally { racine.dispose?.();racine.remove(); UI.reinitialiserImportCible?.(); }
      }
    }));

    await bloc('fiche du livre : les plages dans la liste ; recherche par rubrique (D-I9, D-I13, D-I19)', async () => {
      const B = await import('../src/ui/book.js');
      const ref = { id: 'rc1', edition_id: 'ed1', original_title: 'Roast chicken and pommes purée', availability: 'reference_only', printed_page: 116, printed_pages: [{ debut: 116, fin: 119 }], index_rubriques: ['asparagus', 'chicken'], tags: [], cuisines: [] };
      const ligne = B.ligneCompacte(ref);
      const hostile = B.ligneCompacte({ ...ref, id: 'rc2', printed_pages: [{ debut: '<b>', fin: 3 }], printed_page: 12 });
      eq([texte(ligne.querySelector('[data-role="pages"]')), texte(hostile.querySelector('[data-role="pages"]'))], ['p. 116–119', 'p. 12'],
        'la ligne compacte dit les plages (« p. 116–119 ») ; une plage illisible reçue retombe sur la page imprimée');
      const S = await import('../src/domain/search.js');
      const docs = S.buildDocs({ recipes: [ref, { ...ref, id: 'rc3', original_title: 'Turbot', index_rubriques: ['fish'] }], versions: [], editions: [{ id: 'ed1', book_id: 'b1' }], books: [{ id: 'b1', title: 'Trinity' }], dishes: [], links: [] });
      eq(S.searchDocs(docs, S.parseQuery('asparagus'), {}).references.map((r) => r.doc.recipe.id), ['rc1'], 'une référence se retrouve par la rubrique d’index sous laquelle le livre la cite');
    });
  } finally { globalThis.fetch = vraiFetch; setUiLocale(localeAvant); }
}
