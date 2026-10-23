// Tests du lot F « Les plats en images » (spec docs/superpowers/specs/2026-10-19-plats-en-images-design.md, § 7.4). Bases jetables (withRepo,
// withDatabase), fetch factice, gestes injectés ; aucun réseau ; aucune écriture dans la bibliothèque de la personne ; jamais le navigateur partagé.
// Images fabriquées par canvas (imageTest, recopié ici : celui de tests/import-cible.js est local à un bloc et ne fait que du JPEG). Un caractère
// hostile est construit par String.fromCodePoint, jamais écrit en littéral. Les tâches 3 à 5 ajoutent leurs blocs AU-DESSUS du repère de fin.
import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';

export async function runPhotoPlatTests({ eq, ok }) {
  const run = async (name, test) => {
    try { await test(); }
    catch (error) { ok(false, `Photo du plat — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
  const { sha256Hex } = await import('../src/core/hash.js');
  const { INGREDIENTS } = await import('../src/model/seed.js');
  const ING = new Map(INGREDIENTS.map((i) => [i.id, i]));
  const localeAvant = getUiLocale();
  setUiLocale('fr'); // des textes français sont affirmés
  const DATE = '2026-10-19T00:00:00.000Z';
  const H = (c) => c.repeat(64); // une empreinte lisible : H('a') = « aaaa… » (64)
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
  const bouton = (racine, texte) => [...(racine?.querySelectorAll('button') || [])].find((b) => b.textContent === texte) || null;
  const etiquettes = (racine) => [...racine.querySelectorAll('button')].map((b) => b.textContent);
  const textesDirects = (p) => [...p.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent);
  // Une image de test : un aplat et un coin clair (le ré-encodage a quelque chose à garder) ; JPEG ou PNG ; un File, comme un sélecteur de fichiers.
  const imageTest = async (nom, couleur, l, h, type = 'image/jpeg') => {
    const toile = new OffscreenCanvas(l, h); const cx = toile.getContext('2d');
    cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); cx.fillStyle = '#fff'; cx.fillRect(0, 0, Math.max(1, l >> 2), Math.max(1, h >> 2));
    const blob = await toile.convertToBlob(type === 'image/png' ? { type } : { type, quality: 0.9 });
    return new File([blob], nom, { type });
  };
  const octetsDe = async (blob) => new Uint8Array(await blob.arrayBuffer());
  // Le base64 que la fonction rend (un seul btoa sur la chaîne binaire entière : jamais par tranches non multiples de 3).
  const base64De = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
  const fiche = (id, over = {}) => ({ id, edition_id: null, original_title: 'Pâtes ' + id, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE, ...over });
  const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: null,
    ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }],
    constraints: {}, changes: '', notes: '', provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: null, convention_snapshot: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
  // Le contexte d'une fiche (motif de tests/import-cible.js, tâche 5 du lot A), relu de la base jetable ; `over` complète (sync, pagesById…).
  const ctxPour = async (repo, db, over = {}) => {
    const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
    return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])),
      editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(), imports: await db.getAll('imports'), dishesById: new Map(), dishes: [], cook_history: [],
      dish_recipe_links: [], recipe_translations: [], ingredients: INGREDIENTS, ingredientsById: ING, source_documents: [], source_pages: [], scan_sessions: [], rediscovery_prefs: [], docsByRecipe: new Map(),
      meals: [], meal_feedback: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, sync: {}, ...over };
  };
  const nouvelleScene = () => { const s = document.createElement('div'); s.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(s); return s; };
  try {
    // ===== Tâche 2 — le domaine client (spec § 3.4)
    await run('LIMITES_IMAGE_WEB (R-F-4, D-F13)', async () => {
      const W = await import('../src/domain/photo-web.js');
      const { LIMITES_COUVERTURE } = await import('../src/core/image.js');
      const { COVER_INPUT_MIME } = await import('../src/sync/mime.js');
      const { LIMITES_PASSERELLE } = await import('../src/domain/passerelle.js');
      ok(Object.isFrozen(W.LIMITES_IMAGE_WEB), 'LIMITES_IMAGE_WEB : gelée');
      eq([W.LIMITES_IMAGE_WEB.url, W.LIMITES_IMAGE_WEB.octets, W.LIMITES_IMAGE_WEB.corpsReponse, W.LIMITES_IMAGE_WEB.tentativeMs, W.LIMITES_IMAGE_WEB.types === COVER_INPUT_MIME],
        [2048, 2097152, 3 * 1024 * 1024, 90000, true], 'LIMITES_IMAGE_WEB : 2 048 points, 2 Mio (le littéral du serveur), réponse ≤ 3 Mio, 90 s, les types des couvertures');
      ok(W.LIMITES_IMAGE_WEB.octets <= LIMITES_COUVERTURE.octetsDistants, 'LIMITES_IMAGE_WEB.octets ≤ le mur commun des images distantes (5 Mio)');
      ok(W.LIMITES_IMAGE_WEB.corpsReponse >= 4 * Math.ceil(W.LIMITES_IMAGE_WEB.octets / 3) + 4096, 'corpsReponse ≥ le base64 d’une image à la borne + 4 Kio d’enveloppe');
      ok(W.LIMITES_IMAGE_WEB.tentativeMs < LIMITES_PASSERELLE.tentativeMs, '90 s restent sous le délai par défaut de la passerelle (135 s)');
    });

    await run('adresseImageAdmise, memeAdresseImage (I-F2, S-10)', async () => {
      const W = await import('../src/domain/photo-web.js');
      const A = W.adresseImageAdmise;
      eq([A('https://a.test/i.jpg'), A('https://u:p@a.test/i.jpg')], ['https://a.test/i.jpg', 'https://a.test/i.jpg'], 'adresseImageAdmise : https admise ; identifiants retirés (lienSignet, D-T7)');
      eq([A('http://a.test/i.jpg'), A('https://a.test/ i.jpg'), A('https://café.test/i.jpg'), A('https://a.test/i' + String.fromCodePoint(0x2028) + '.jpg'), A('https://a.test/' + 'x'.repeat(2049 - 15)),
        A('javascript:x'), A(''), A(null), A(7), A({})], [null, null, null, null, null, null, null, null, null, null],
        'adresseImageAdmise : http, espace, non ASCII, U+2028, 2 049 points, javascript:, vide, null, nombre, objet → null');
      const longue = 'https://a.test/' + '"'.repeat(10) + 'x'.repeat(2040 - 15 - 10);
      eq([longue.length, new URL(longue).href.length > 2048, A(longue)], [2040, true, null], 'adresseImageAdmise : un href ASCII de 2 040 points dont dix « " » (encodés %22) dépasse 2 048 APRÈS normalisation → null');
      eq([W.memeAdresseImage('HTTPS://A.TEST:443/i.jpg', 'https://a.test/i.jpg'), W.memeAdresseImage('https://a.test/1.jpg', 'https://a.test/2.jpg'), W.memeAdresseImage('http://a.test/i.jpg', 'http://a.test/i.jpg'), W.memeAdresseImage(null, null)],
        [true, false, false, false], 'memeAdresseImage : la même adresse sous une autre forme → vrai ; deux adresses → faux ; refusée des deux côtés → faux');
    });

    await run('candidatPhotoWeb (D-F10)', async () => {
      const W = await import('../src/domain/photo-web.js');
      const C = W.candidatPhotoWeb; const IMG = 'https://a.test/i.jpg';
      eq([C({}, IMG), C({ photo_sha256: H('a'), photo_origin: 'image' }, IMG), C({ photo_sha256: H('a'), photo_origin: 'photo' }, IMG), C({ photo_sha256: H('a'), photo_origin: null }, IMG),
        C({ photo_sha256: H('a'), photo_origin: 'web', photo_source_url: IMG }, IMG), C({ photo_sha256: H('a'), photo_origin: 'web', photo_source_url: 'HTTPS://A.TEST:443/i.jpg' }, IMG),
        C({ photo_sha256: H('a'), photo_origin: 'web', photo_source_url: 'https://a.test/ancienne.jpg' }, IMG), C({ photo_sha256: '../x', photo_origin: 'image' }, IMG), C({}, 'http://a.test/i.jpg'), C(null, IMG)],
      [IMG, null, null, null, null, null, IMG, IMG, null, IMG],
      'candidatPhotoWeb : sans photo → l’adresse ; photo de la personne (image, photo, origine nulle) → null ; même image web (même sous une autre forme) → null ; autre image web → l’adresse ; pointeur hostile = sans photo ; http → null');
    });

    await run('lireImageWeb : l’appel (I-F3, D-F13)', async () => {
      const W = await import('../src/domain/photo-web.js');
      const P = await import('../src/domain/passerelle.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const SESSION = { access_token: 'jeton-photo-sentinelle', user: { id: 'u1' } };
      const resultats = [];
      const BORNE = W.LIMITES_IMAGE_WEB.octets;
      const grosse = new Uint8Array(BORNE); grosse.set([0xff, 0xd8, 0xff]);
      const corps200 = (u8, type = 'image/jpeg') => ({ type, taille: u8.length, url_finale: 'https://cdn.test/i.jpg', octets: base64De(u8) });
      const appels = [];
      const f = (statut, corps) => async (url, options) => { appels.push({ url, options }); return reponse(statut, corps); };
      const delais = []; const vraiTimeout = AbortSignal.timeout;
      AbortSignal.timeout = (ms) => { delais.push(ms); return vraiTimeout.call(AbortSignal, ms); };
      let r;
      try { r = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: f(200, corps200(grosse)), config: SUPABASE.prod }); }
      finally { AbortSignal.timeout = vraiTimeout; }
      resultats.push(r);
      const a = appels[0];
      eq([appels.length, a.url, JSON.parse(a.options.body), Object.keys(a.options.headers).sort(), a.options.redirect, a.options.credentials],
        [1, P.urlAssistant(SUPABASE.prod), { outil: 'image-web', corps: { url: 'https://a.test/i.jpg' } }, ['apikey', 'authorization', 'content-type'], 'error', 'omit'],
        'lireImageWeb : UN POST { outil: image-web, corps: { url } } exact vers la fonction assistant, trois en-têtes, redirect error, credentials omit');
      ok(JSON.stringify(corps200(grosse)).length > P.LIMITES_PASSERELLE.corps, 'fixture : la réponse d’une image à la borne dépasse les 2 Mio par défaut de la passerelle (le mutant « corpsMax omis » la refuse)');
      eq([r.etat, r.blob?.type, r.blob?.size, r.urlFinale], ['recue', 'image/jpeg', BORNE, 'https://cdn.test/i.jpg'], 'lireImageWeb : une image à la borne (≈ 2,7 Mio de JSON) est LUE');
      eq(delais.includes(90000), true, 'lireImageWeb : tentativeMs passé à la passerelle = 90 000');
      appels.length = 0;
      const sansSession = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: null }, { fetch: f(200, corps200(grosse)), config: SUPABASE.prod });
      const enHttp = await W.lireImageWeb({ url: 'http://a.test/i.jpg', session: SESSION }, { fetch: f(200, corps200(grosse)), config: SUPABASE.prod });
      const ctl = new AbortController(); ctl.abort();
      const annule = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: f(200, corps200(grosse)), config: SUPABASE.prod, signal: ctl.signal });
      resultats.push(sansSession, enHttp, annule);
      eq([sansSession.raison, enHttp.raison, annule.raison, appels.length], ['non_connecte', 'adresse', 'annule', 0], 'lireImageWeb : sans session → non_connecte ; http → adresse ; signal levé → annule ; zéro fetch');
      eq(resultats.some((x) => JSON.stringify(x ?? null).includes('jeton-photo-sentinelle')), false, 'lireImageWeb : le jeton n’est dans aucun résultat');
    });

    await run('lireImageWeb : le 200 est une donnée hostile', async () => {
      const W = await import('../src/domain/photo-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const SESSION = { access_token: 'jeton-photo-sentinelle', user: { id: 'u1' } };
      const petit = Uint8Array.of(0xff, 0xd8, 0xff, 1, 2);
      const corps200 = (over = {}) => ({ type: 'image/jpeg', taille: petit.length, url_finale: 'https://cdn.test/i.jpg', octets: base64De(petit), ...over });
      const lu = async (corps) => W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: async () => reponse(200, corps), config: SUPABASE.prod });
      const resultats = [];
      const garde = (r) => { resultats.push(r); return r; };
      eq([(garde(await lu(corps200({ type: 'image/gif' })))).raison, (garde(await lu(corps200({ taille: 0 })))).raison], ['illisible', 'illisible'], '200 hostile : type hors liste → illisible ; taille 0 → illisible');
      // La borne AVANT tout décodage : un base64 de la BONNE longueur pour 2 097 153 octets — un mutant « décoder puis borner » appellerait atob.
      const TROP = W.LIMITES_IMAGE_WEB.octets + 1;
      const vraiAtob = globalThis.atob; let atobs = 0;
      globalThis.atob = (s) => { atobs += 1; return vraiAtob(s); };
      try { eq([(garde(await lu(corps200({ taille: TROP, octets: 'A'.repeat(4 * Math.ceil(TROP / 3)) })))).raison, atobs], ['image_trop_lourde', 0], '200 hostile : taille 2 097 153 (base64 de la bonne longueur) → image_trop_lourde AVANT tout décodage (atob jamais appelé)'); }
      finally { globalThis.atob = vraiAtob; }
      eq([(garde(await lu(corps200({ octets: '@@' })))).raison, (garde(await lu(corps200({ octets: base64De(petit) + 'AAAA' })))).raison, (garde(await lu(corps200({ taille: 4 })))).raison, (garde(await lu(corps200({ octets: 'AAA AAAA' })))).raison],
        ['illisible', 'illisible', 'illisible', 'illisible'], '200 hostile : alphabet hors base64, longueur ≠ 4 × ceil(taille / 3), décodé de longueur ≠ taille, une espace à la bonne longueur (atob l’ignorerait : seule la règle ALPHABET la refuse) → illisible');
      // S-11 sans polluer aucun prototype (R-F-8 : la suite tourne des cas en parallèle et un appel asynchrone y lit des objets nus) : le corps passe
      // par la configuration de test déjà prévue pour lireImageWeb (P-3 : config, fetch factice, JSON relu par la passerelle) ; un champ absent du
      // corps est absent pour lu(k). Mutants tués : « type par défaut quand le champ propre manque » (lu('type') ?? 'image/jpeg' : le corps sans type
      // passerait) et « Blob au type figé » (new Blob([octets], { type: 'image/jpeg' }) : la PNG sortirait typée jpeg).
      const tetePng = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
      const sansType = garde(await lu({ taille: petit.length, url_finale: 'https://cdn.test/i.jpg', octets: base64De(petit) }));
      const enPng = garde(await lu({ type: 'image/png', taille: tetePng.length, url_finale: 'https://cdn.test/i.png', octets: base64De(tetePng) }));
      eq([sansType.raison, (garde(await lu({ type: 'image/jpeg', taille: 5 }))).raison, enPng.etat, enPng.blob?.type, enPng.blob?.size],
        ['illisible', 'illisible', 'recue', 'image/png', tetePng.length], '200 hostile : sans champ propre type → illisible ; octets absents → illisible ; une PNG annoncée image/png → un Blob construit avec SON type explicite (jamais un type figé)');
      const bon = garde(await lu(corps200()));
      eq([bon.etat, bon.blob.type, [...(await octetsDe(bon.blob))]], ['recue', 'image/jpeg', [...petit]], '200 valide → { etat: recue, blob } du bon type et des bons octets');
      eq(resultats.some((x) => JSON.stringify(x).includes('jeton-photo-sentinelle')), false, 'le jeton n’est dans aucun résultat');
    });

    await run('table serveur → client, raisons fermées', async () => {
      const W = await import('../src/domain/photo-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const SESSION = { access_token: 'jeton-photo-sentinelle', user: { id: 'u1' } };
      const table = [[422, { erreur: 'pas_une_image' }, 'pas_une_image', {}], [413, { erreur: 'image_trop_lourde' }, 'image_trop_lourde', {}], [422, { erreur: 'interdit' }, 'interdit', {}],
        [502, { erreur: 'inaccessible' }, 'inaccessible', {}], [429, { erreur: 'quota', quota: 60 }, 'quota', { quota: 60 }], [429, { type: 'error' }, 'trop_de_demandes', {}], [504, { erreur: 'delai' }, 'delai', {}]];
      const obtenus = [];
      for (const [statut, corps] of table) { const x = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: async () => reponse(statut, corps), config: SUPABASE.prod }); obtenus.push([x.etat, x.raison, x.extra]); }
      eq(obtenus, table.map(([, , raison, extra]) => ['echec', raison, extra]), 'table serveur → client : pas_une_image, image_trop_lourde, interdit, inaccessible relayées ; quota 60 ; 429 sans champ → trop_de_demandes ; 504 → delai');
      ok(obtenus.every(([, raison]) => W.RAISONS_PHOTO_WEB.includes(raison)), 'toute raison rendue ∈ RAISONS_PHOTO_WEB');
      ok(Object.isFrozen(W.RAISONS_PHOTO_WEB) && Object.isFrozen(W.RAISONS_DEFINITIVES) && W.RAISONS_DEFINITIVES.every((r) => W.RAISONS_PHOTO_WEB.includes(r)), 'RAISONS_DEFINITIVES ⊂ RAISONS_PHOTO_WEB, les deux gelées');
      eq([...W.RAISONS_DEFINITIVES], ['interdit', 'pas_une_image', 'image_trop_lourde', 'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde'], 'RAISONS_DEFINITIVES : la liste de la spec');
    });

    await run('mur distant : preparerPhotoDistante (D-F12)', async () => {
      const IM = await import('../src/core/image.js');
      const code = async (p) => { try { await p; return 'ok'; } catch (e) { return e?.code ?? 'autre:' + (e?.message || ''); } };
      eq(IM.COTE_MIN_DISTANT, 200, 'COTE_MIN_DISTANT = 200');
      const sortie = await IM.preparerPhotoDistante(await imageTest('a.jpg', '#a52', 600, 400, 'image/jpeg'));
      const dims = await IM.dimensionsImage(sortie);
      eq([sortie.type, dims.largeur, dims.hauteur], ['image/jpeg', 600, 400], 'un JPEG 600 × 400 → un JPEG ≤ 1 200 px');
      const png = await imageTest('p.png', '#5a2', 300, 300, 'image/png');
      eq(await code(IM.preparerPhotoDistante(new Blob([png], { type: 'image/jpeg' }))), 'indecodable', 'octets PNG annoncés image/jpeg → indecodable (l’en-tête dit un autre type)');
      eq(await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(10)], { type: 'image/heic' }))), 'type', 'image/heic → type (jamais HEIC pour une image distante)');
      eq(await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }))), 'trop_lourde', '5 Mio + 1 → trop_lourde (le mur commun octetsDistants)');
      eq([await code(IM.preparerPhotoDistante(await imageTest('e.jpg', '#a52', 199, 600))), await code(IM.preparerPhotoDistante(await imageTest('f.jpg', '#a52', 200, 600)))], ['trop_petite', 'ok'], 'petit côté 199 → trop_petite ; 200 → accepté');
      const tete = new Uint8Array(33); tete.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const dv = new DataView(tete.buffer); dv.setUint32(16, 5000); dv.setUint32(20, 4000);
      const vrai = globalThis.createImageBitmap; let decodes = 0;
      globalThis.createImageBitmap = (...a) => { decodes += 1; return vrai.call(globalThis, ...a); };
      try {
        eq([await code(IM.preparerPhotoDistante(new Blob([tete], { type: 'image/png' }))), decodes], ['trop_grande', 0], 'en-tête 5 000 × 4 000 → trop_grande AVANT décodage (createImageBitmap jamais appelé)');
        eq([await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(10)], { type: 'image/jpeg' }))), decodes], ['indecodable', 0], '10 octets nuls annoncés image/jpeg → indecodable, sans décodage');
        const heic = new Blob([new Uint8Array(64).fill(7)], { type: 'image/heic' });
        eq([await code(IM.preparerPhotoLocale(heic)), decodes > 0], ['indecodable', true], 'preparerPhotoLocale inchangée : un image/heic d’en-tête illisible passe au ré-encodage (createImageBitmap appelé), qui tranche');
      } finally { globalThis.createImageBitmap = vrai; }
    });

    // ===== fin des blocs du lot F (les tâches 3 à 5 ajoutent les leurs AU-DESSUS de cette ligne)
  } finally { setUiLocale(localeAvant); }
}
