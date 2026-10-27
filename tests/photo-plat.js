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
      // Ronde 1 : le gel doit aussi tenir la liste des types (COVER_INPUT_MIME, partagée avec le mur distant et les couvertures) — un push la
      // passerait en silence dans les trois murs à la fois.
      ok(Object.isFrozen(W.LIMITES_IMAGE_WEB.types) && Object.isFrozen(COVER_INPUT_MIME), 'LIMITES_IMAGE_WEB.types (COVER_INPUT_MIME) : gelée elle aussi');
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
      // Ronde 1 : la borne AVANT lienSignet, isolée — une entrée de plus de 2 048 points qui RACCOURCIT à la normalisation (identifiants retirés).
      const { lienSignet } = await import('../src/core/lien.js');
      const raccourcie = 'https://' + 'u'.repeat(40) + ':p@a.test/' + 'x'.repeat(2010);
      eq([raccourcie.length, lienSignet(raccourcie).href.length, A(raccourcie)], [2068, 2025, null], 'adresseImageAdmise : 2 068 points en entrée, 2 025 une fois les identifiants retirés → null (la borne d’entrée seule la refuse)');
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
      // Ronde 1 : le corps porte l'adresse NORMALISÉE (identifiants retirés, D-T7), jamais l'adresse reçue telle quelle.
      const avecIdentifiants = await W.lireImageWeb({ url: 'https://u:p@a.test/i.jpg', session: SESSION }, { fetch: f(200, corps200(Uint8Array.of(0xff, 0xd8, 0xff))), config: SUPABASE.prod });
      resultats.push(avecIdentifiants);
      eq([appels.length, JSON.parse(appels[0]?.options?.body ?? 'null'), avecIdentifiants.etat], [1, { outil: 'image-web', corps: { url: 'https://a.test/i.jpg' } }, 'recue'], 'lireImageWeb : https://u:p@a.test/i.jpg → le POST porte https://a.test/i.jpg (l’href normalisé), jamais les identifiants');
      // Ronde 1 : « ne lève jamais » vaut aussi pour des arguments absents — la déstructuration vit DANS le try (aucun rejet, aucun fetch possible :
      // une adresse refusée s'arrête avant la passerelle, une session nulle avant tout réseau).
      const sansArgs = await Promise.allSettled([W.lireImageWeb(null), W.lireImageWeb(undefined, null), W.lireImageWeb({ url: 'http://a.test/i.jpg' }, null), W.lireImageWeb({ url: 'https://a.test/i.jpg', session: null }, null)]);
      resultats.push(...sansArgs.map((p) => p.value));
      eq([sansArgs.map((p) => p.status), sansArgs.map((p) => p.value?.raison)], [['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled'], ['adresse', 'adresse', 'adresse', 'non_connecte']],
        'lireImageWeb(null), (undefined, null), ({ url http }, null), ({ url, session: null }, null) → jamais un rejet : adresse, adresse, adresse, non_connecte');
      eq(resultats.some((x) => JSON.stringify(x ?? null).includes('jeton-photo-sentinelle')), false, 'lireImageWeb : le jeton n’est dans aucun résultat');
      ok(resultats.length === 9 && resultats.every((x) => x?.etat === 'recue' || (x?.etat === 'echec' && W.RAISONS_PHOTO_WEB.includes(x.raison))), 'lireImageWeb (l’appel) : les neuf résultats sont recue ou un échec dont la raison ∈ RAISONS_PHOTO_WEB (adresse, non_connecte, annule compris)');
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
      // Ronde 1 : taille 0 AVEC des octets vides — lireOctetsBase64('', 0) rendrait un Uint8Array(0) : seule la règle « taille ≥ 1 » refuse ici
      // (avec les octets de `petit`, la règle de longueur du base64 refusait à sa place : faux vert).
      eq([(garde(await lu(corps200({ type: 'image/gif' })))).raison, (garde(await lu(corps200({ taille: 0, octets: '' })))).raison], ['illisible', 'illisible'], '200 hostile : type hors liste → illisible ; taille 0 et octets vides → illisible (la règle taille ≥ 1, isolée)');
      // La borne AVANT tout décodage : un base64 de la BONNE longueur pour 2 097 153 octets — un mutant « décoder puis borner » appellerait atob.
      const TROP = W.LIMITES_IMAGE_WEB.octets + 1;
      const vraiAtob = globalThis.atob; let atobs = 0;
      globalThis.atob = (s) => { atobs += 1; return vraiAtob(s); };
      try { eq([(garde(await lu(corps200({ taille: TROP, octets: 'A'.repeat(4 * Math.ceil(TROP / 3)) })))).raison, atobs], ['image_trop_lourde', 0], '200 hostile : taille 2 097 153 (base64 de la bonne longueur) → image_trop_lourde AVANT tout décodage (atob jamais appelé)'); }
      finally { globalThis.atob = vraiAtob; }
      eq([(garde(await lu(corps200({ octets: '@@' })))).raison, (garde(await lu(corps200({ octets: base64De(petit) + 'AAAA' })))).raison, (garde(await lu(corps200({ taille: 4 })))).raison, (garde(await lu(corps200({ octets: 'AAA AAAA' })))).raison],
        ['illisible', 'illisible', 'illisible', 'illisible'], '200 hostile : alphabet hors base64, longueur ≠ 4 × ceil(taille / 3), décodé de longueur ≠ taille, une espace à la bonne longueur (atob l’ignorerait : seule la règle ALPHABET la refuse) → illisible');
      // Ronde 1 : la règle de longueur EXACTE, isolée — un base64 SANS remplissage (7 caractères pour 5 octets) passe l'alphabet et atob le décode
      // en 5 octets : seule la longueur 4 × ceil(taille / 3) le refuse (« avec remplissage », spec § 3.4).
      const sansRemplissage = base64De(petit).replace(/=+$/, '');
      eq([base64De(petit).length, sansRemplissage.length, atob(sansRemplissage).length, (garde(await lu(corps200({ octets: sansRemplissage })))).raison], [8, 7, 5, 'illisible'], '200 hostile : base64 sans remplissage (7 pour 5 octets, décodable) → illisible');
      // Ronde 1 : url_finale est revalidée par adresseImageAdmise (informative, jamais écrite) — http, javascript:, non chaîne → null sur un recue.
      const finales = [];
      for (const url_finale of ['http://cdn.test/i.jpg', 'javascript:x', 7]) { const x = garde(await lu(corps200({ url_finale }))); finales.push([x.etat, x.urlFinale]); }
      eq(finales, [['recue', null], ['recue', null], ['recue', null]], '200 : url_finale http, javascript:, nombre → urlFinale null (jamais la valeur reçue telle quelle)');
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
      ok(resultats.length === 15 && resultats.every((x) => x?.etat === 'recue' || (x?.etat === 'echec' && W.RAISONS_PHOTO_WEB.includes(x.raison))), '200 hostile : les quinze résultats sont recue ou un échec dont la raison ∈ RAISONS_PHOTO_WEB (illisible, image_trop_lourde compris)');
    });

    await run('table serveur → client, raisons fermées', async () => {
      const W = await import('../src/domain/photo-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const SESSION = { access_token: 'jeton-photo-sentinelle', user: { id: 'u1' } };
      const table = [[422, { erreur: 'pas_une_image' }, 'pas_une_image', {}], [413, { erreur: 'image_trop_lourde' }, 'image_trop_lourde', {}], [422, { erreur: 'interdit' }, 'interdit', {}],
        [502, { erreur: 'inaccessible' }, 'inaccessible', {}], [429, { erreur: 'quota', quota: 60 }, 'quota', { quota: 60 }], [429, { type: 'error' }, 'trop_de_demandes', {}], [504, { erreur: 'delai' }, 'delai', {}],
        // Ronde 1 : des refus PROPRES à lecture-web (la passerelle les traduit quel que soit l'outil : page_vide, pas_une_page, page_trop_lourde) sortent
        // de la liste fermée — le filtre de lireImageWeb les ramène à « interne » (sans ces lignes, il n'était éprouvé par rien).
        [422, { erreur: 'vide' }, 'interne', {}], [422, { erreur: 'pas_une_page' }, 'interne', {}], [413, { erreur: 'trop_lourde' }, 'interne', {}]];
      const obtenus = [];
      for (const [statut, corps] of table) { const x = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: async () => reponse(statut, corps), config: SUPABASE.prod }); obtenus.push([x.etat, x.raison, x.extra]); }
      eq(obtenus, table.map(([, , raison, extra]) => ['echec', raison, extra]), 'table serveur → client : pas_une_image, image_trop_lourde, interdit, inaccessible relayées ; quota 60 ; 429 sans champ → trop_de_demandes ; 504 → delai ; vide, pas_une_page, trop_lourde (lecture-web) → interne');
      ok(obtenus.length === 10 && obtenus.every(([, raison]) => W.RAISONS_PHOTO_WEB.includes(raison)), 'toute raison rendue ∈ RAISONS_PHOTO_WEB');
      // Ronde 1 : la liste fermée elle-même, épinglée (les 29 raisons de la spec § 3.4, dans son ordre) : retirer « adresse » ou « illisible » rougit ici.
      eq([...W.RAISONS_PHOTO_WEB], ['adresse', 'fiche_absente', 'fiche_changee', 'photo_manuelle', 'deja_la', 'vol_tenu', 'hors_ligne', 'non_connecte', 'non_admis', 'quota',
        'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit', 'inaccessible', 'pas_une_image', 'image_trop_lourde', 'illisible',
        'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde', 'ecriture'], 'RAISONS_PHOTO_WEB : les 29 raisons de la spec § 3.4');
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
      // Ronde 1 : la borne exacte — 5 Mio pile passe le mur de taille (> et non ≥) ; l'en-tête nul tranche ensuite.
      eq([IM.LIMITES_COUVERTURE.octetsDistants, await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(IM.LIMITES_COUVERTURE.octetsDistants)], { type: 'image/jpeg' })))], [5 * 1024 * 1024, 'indecodable'], '5 Mio pile → indecodable (jamais trop_lourde : la borne est incluse)');
      eq([await code(IM.preparerPhotoDistante(await imageTest('e.jpg', '#a52', 199, 600))), await code(IM.preparerPhotoDistante(await imageTest('f.jpg', '#a52', 200, 600)))], ['trop_petite', 'ok'], 'petit côté 199 → trop_petite ; 200 → accepté');
      const tete = new Uint8Array(33); tete.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const dv = new DataView(tete.buffer); dv.setUint32(16, 5000); dv.setUint32(20, 4000);
      const vrai = globalThis.createImageBitmap; let decodes = 0;
      globalThis.createImageBitmap = (...a) => { decodes += 1; return vrai.call(globalThis, ...a); };
      try {
        eq([await code(IM.preparerPhotoDistante(new Blob([tete], { type: 'image/png' }))), decodes], ['trop_grande', 0], 'en-tête 5 000 × 4 000 → trop_grande AVANT décodage (createImageBitmap jamais appelé)');
        eq([await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(10)], { type: 'image/jpeg' }))), decodes], ['indecodable', 0], '10 octets nuls annoncés image/jpeg → indecodable, sans décodage');
        // Revue finale : l'en-tête JPEG lu comme libjpeg le lit. (a) Un FF de remplissage après SOI : « FF FF E0 00 » lu comme un segment faisait sauter à
        // l'offset 57 348, sur un faux SOF 1 000 × 800 caché dans un COM ; le vrai SOF dit 5 000 × 4 000 (mesuré dans Chrome sans tête : createImageBitmap
        // décode les VRAIES dimensions). (b) « FF 00 », que libjpeg écarte avant de chercher le marqueur suivant, lu comme un segment : même saut → null.
        const sof = (h, l) => [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, l >> 8, l & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
        const APP0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
        const L = 60000; const forgeA = new Uint8Array(21 + 2 + L + 19 + 8);
        forgeA.set([0xff, 0xd8, 0xff, ...APP0]); forgeA.set([0xff, 0xfe, L >> 8, L & 0xff], 21); forgeA.set(sof(800, 1000), 57348); forgeA.set(sof(4000, 5000), 21 + 2 + L);
        const forgeB = new Uint8Array(20 + 4 + 2 + 300 + 19 + 8);
        forgeB.set([0xff, 0xd8, ...APP0]); forgeB.set([0xff, 0x00, 0x01, 0x00], 20); forgeB.set([0xff, 0xfe, 0x01, 0x2c], 24); forgeB.set(sof(800, 1000), 20 + 2 + 256); forgeB.set(sof(4000, 5000), 24 + 2 + 300);
        const jA = new Blob([forgeA], { type: 'image/jpeg' }); const jB = new Blob([forgeB], { type: 'image/jpeg' });
        eq([await IM.dimensionsImage(jA), await code(IM.preparerPhotoDistante(jA)), decodes], [{ largeur: 5000, hauteur: 4000, type: 'image/jpeg' }, 'trop_grande', 0],
          'JPEG à FF de remplissage et faux SOF caché dans un COM → les VRAIES dimensions (5 000 × 4 000), trop_grande AVANT décodage (createImageBitmap jamais appelé)');
        eq([await IM.dimensionsImage(jB), await code(IM.preparerPhotoDistante(jB)), decodes], [null, 'indecodable', 0], 'JPEG à « FF 00 » avant un faux SOF → en-tête illisible (null), indecodable, sans décodage');
        const avantSof = (m) => { const o = new Uint8Array(20 + 4 + 19 + 8); o.set([0xff, 0xd8, ...APP0]); o.set([0xff, m, 0x00, 0x02], 20); o.set(sof(800, 1000), 24); return new Blob([o], { type: 'image/jpeg' }); };
        eq([await IM.dimensionsImage(avantSof(0xd9)), await IM.dimensionsImage(avantSof(0xda)), await code(IM.preparerPhotoDistante(avantSof(0xda))), decodes], [null, null, 'indecodable', 0],
          'EOI ou SOS AVANT le SOF (un flux que libjpeg refuse) → en-tête illisible (null), indecodable, sans décodage');
        const heic = new Blob([new Uint8Array(64).fill(7)], { type: 'image/heic' });
        eq([await code(IM.preparerPhotoLocale(heic)), decodes > 0], ['indecodable', true], 'preparerPhotoLocale inchangée : un image/heic d’en-tête illisible passe au ré-encodage (createImageBitmap appelé), qui tranche');
        const vraie = await octetsDe(await imageTest('r.jpg', '#a52', 600, 400));
        const remplie = new Blob([vraie.subarray(0, 2), Uint8Array.of(0xff, 0xff, 0xff), vraie.subarray(2)], { type: 'image/jpeg' });
        eq([await IM.dimensionsImage(remplie), await code(IM.preparerPhotoDistante(remplie))], [{ largeur: 600, hauteur: 400, type: 'image/jpeg' }, 'ok'],
          'revue finale : un vrai JPEG à trois FF de remplissage après SOI (la norme les admet) → lu 600 × 400 et accepté, jamais un faux refus');
      } finally { globalThis.createImageBitmap = vrai; }
    });

    // ===== Tâche 3 — la fiche (spec § 4.1, § 4.3 point 3)
    await run('composant : etatZonePlat, texteEchecPhotoWeb, renderZonePhotoPlat (§ 4.1.2)', async () => {
      const PP = await import('../src/ui/photo-plat.js');
      const IMG = 'https://cdn.test/i.jpg';
      const AJOUTE = 'Ajoute une photo du plat : elle illustre la recette dans tes listes.';
      const base = { present: true, enVol: false, enLigne: true, connecte: true, occupe: false, echec: null };
      const champs = (e) => [e.sha256, e.message, e.web, e.raison, e.offreReessayer, e.peutReessayer, e.motifEteint, e.absente, e.enCours];
      const Z = (fiche, over = {}) => champs(PP.etatZonePlat(fiche, { ...base, ...over }));
      eq(Z({}), [null, AJOUTE, null, null, false, false, null, false, false], 'cas 1 : aucun pointeur, aucun candidat → le message');
      eq(Z({ photo_sha256: H('a') }), [H('a'), null, null, null, false, false, null, false, false], 'cas 2 : pointeur valide, octets ici');
      eq(Z({ photo_sha256: H('a') }, { present: false }), [H('a'), null, null, null, false, false, null, true, false], 'cas 3 : pointeur valide, octets absents → absente (l’état du fichier vit en tête)');
      eq([Z({}, { enVol: true }), Z({ photo_source_url: IMG }, { enVol: true })], [[null, null, 'en_cours', null, false, false, null, false, false], [null, null, 'en_cours', null, false, false, null, false, false]], 'cas 4 : en vol, avec ou sans candidat écrit → en_cours');
      eq(Z({ photo_source_url: IMG }), [null, null, 'echouee', null, true, true, null, false, false], 'cas 5 : candidat, pas en vol → non récupérée, Réessayer offert et allumé');
      eq([Z({ photo_sha256: '../x', photo_source_url: IMG }), Z({ photo_sha256: '../x' })], [[null, null, 'echouee', null, true, true, null, false, false], [null, AJOUTE, null, null, false, false, null, false, false]], 'cas 6 : un pointeur hostile vaut « aucun pointeur » (cas 5 ou cas 1)');
      eq(Z({ photo_sha256: H('a'), photo_origin: 'web', photo_source_url: IMG }, { enVol: true }), [H('a'), null, 'en_cours', null, false, false, null, false, false], 'en vol avec une photo web en place → cas 2 + en_cours');
      eq([Z({ photo_source_url: IMG }, { enLigne: false }).slice(5, 7), Z({ photo_source_url: IMG }, { connecte: false }).slice(5, 7), Z({}, { occupe: true })[8]], [[false, 'hors_ligne'], [false, 'sans_compte'], true], 'peutReessayer faux hors ligne (motif hors_ligne) et sans compte (sans_compte) ; occupe → enCours');
      const echec = (raison, tape, url = IMG, extra = {}) => ({ raison, extra, tape, url });
      eq(PP.etatZonePlat({ photo_source_url: IMG }, { ...base, echec: echec('quota', true, 'https://cdn.test/autre.jpg', { quota: 60 }) }).raison, null, 'une raison gardée pour une AUTRE adresse est ignorée');
      eq([PP.etatZonePlat({ photo_source_url: IMG }, { ...base, echec: echec('quota', true, IMG, { quota: 60 }) }).raison, PP.etatZonePlat({ photo_source_url: IMG }, { ...base, echec: echec('quota', false, IMG, { quota: 60 }) }).raison],
        ['Tu as atteint la limite du jour pour l’assistant (60 appels).', null], 'quota : dit après une TAPE ; muet après le départ automatique');
      const definitif = PP.etatZonePlat({ photo_source_url: IMG }, { ...base, echec: echec('pas_une_image', false) });
      eq([definitif.raison, definitif.offreReessayer, definitif.peutReessayer], ['L’image de cette page ne peut pas être utilisée.', false, false], 'pas_une_image, départ automatique : raison définitive dite, Réessayer retiré');
      const nc = PP.etatZonePlat({ photo_source_url: IMG }, { ...base, connecte: false, echec: echec('non_connecte', true) });
      eq([nc.raison, nc.motifEteint], ['Connecte-toi pour utiliser l’assistant.', null], 'non_connecte gardé d’une tape, puis sans compte : la raison le dit, la ligne sous le bouton n’est pas répétée (P-2)');

      const T = (raison, extra = {}) => PP.texteEchecPhotoWeb({ raison, extra });
      const COMPTE = 'L’appel a peut-être été compté ; relancer en coûtera un autre.';
      const DEF = 'L’image de cette page ne peut pas être utilisée.';
      const code = (c) => `L’assistant n’a pas répondu. Réessaie. Code : ${c}`;
      eq([T('quota', { quota: 60 }), T('quota'), T('non_admis'), T('non_connecte'), T('trop_de_demandes'), T('delai'), T('reseau'), T('annule'), T('inaccessible'),
        ...['interdit', 'pas_une_image', 'image_trop_lourde', 'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde'].map((r) => T(r)), T('ecriture'),
        T('serveur'), T('interne'), T('reponse_illisible'), T('requete'), T('illisible'), ...['adresse', 'fiche_absente', 'fiche_changee', 'photo_manuelle', 'deja_la', 'vol_tenu', 'hors_ligne'].map((r) => T(r))],
      ['Tu as atteint la limite du jour pour l’assistant (60 appels).', 'Tu as atteint la limite du jour pour l’assistant.', 'Ce compte n’a pas accès à l’assistant.', 'Connecte-toi pour utiliser l’assistant.',
        'Trop de demandes pour l’instant. Réessaie dans une minute.', COMPTE, COMPTE, COMPTE, 'Le site de la page n’a pas donné son image.', DEF, DEF, DEF, DEF, DEF, DEF, DEF, DEF,
        'La photo du plat n’a pas pu être changée. Réessaie.', code('serveur'), code('interne'), code('reponse_illisible'), code('requete'), code('illisible'), null, null, null, null, null, null, null],
      'texteEchecPhotoWeb : la table de § 4.1.2 (textes existants d’abord ; deux neufs ; refus avant l’appel → null)');

      const R = (fiche, over = {}) => PP.renderZonePhotoPlat(PP.etatZonePlat(fiche, { ...base, ...over }), {});
      const web = (n) => n.querySelector('[data-role="photo-web-etat"]');
      const c1 = R({});
      eq([c1.textContent.includes(AJOUTE), etiquettes(c1), web(c1)], [true, ['Photographier', 'Choisir une image'], null], 'rendu cas 1 : le message ; Photographier, Choisir une image');
      for (const [nom, c] of [['cas 2', R({ photo_sha256: H('a') })], ['cas 3', R({ photo_sha256: H('a') }, { present: false })]]) {
        eq([etiquettes(c), c.textContent.includes('Télécharger'), c.textContent.includes(AJOUTE), web(c)], [['Photographier', 'Choisir une image', 'Retirer'], false, false, null], `rendu ${nom} : trois boutons, aucun message, aucun « Télécharger »`);
      }
      const c4 = R({}, { enVol: true });
      eq([web(c4)?.getAttribute('role'), web(c4)?.textContent, bouton(c4, 'Photographier')?.disabled, bouton(c4, 'Choisir une image')?.disabled], ['status', 'Récupération de la photo du plat…', false, false], 'rendu cas 4 : p.status[role=status] « Récupération… », boutons d’ajout ALLUMÉS (une photo choisie pendant la descente gagne)');
      const c5 = R({ photo_source_url: IMG });
      const re5 = c5.querySelector('[data-role="reessayer-photo"]');
      eq([web(c5)?.textContent.includes('Photo du plat non récupérée.'), re5?.textContent, re5?.classList.contains('btn'), re5?.classList.contains('small'), re5?.disabled, c5.querySelector('[data-role="cout-photo-web"]')?.textContent, c5.querySelector('[data-role="abandonner-photo-web"]')?.textContent, c5.querySelector('[data-role="raison-photo-web"]')],
        [true, 'Réessayer', true, false, false, 'Un appel de plus, compté dans ton quota du jour.', 'Ne pas récupérer', null], 'rendu cas 5 : « non récupérée », « Réessayer » (.btn, pas .small) allumé, la ligne de coût, « Ne pas récupérer », aucune raison');
      const horsLigne = R({ photo_source_url: IMG }, { enLigne: false }); const sansCompte = R({ photo_source_url: IMG }, { connecte: false });
      eq([horsLigne.querySelector('[data-role="reessayer-photo"]')?.disabled, horsLigne.textContent.includes('Tu es hors ligne.'), sansCompte.querySelector('[data-role="reessayer-photo"]')?.disabled, sansCompte.textContent.includes('Connecte-toi pour utiliser l’assistant.')],
        [true, true, true, true], 'rendu cas 5 : « Réessayer » éteint, avec « Tu es hors ligne. » ou « Connecte-toi pour utiliser l’assistant. » dessous');
      const def = R({ photo_source_url: IMG }, { echec: echec('pas_une_image', false) });
      eq([def.querySelector('[data-role="reessayer-photo"]'), def.querySelector('[data-role="cout-photo-web"]'), !!def.querySelector('[data-role="abandonner-photo-web"]'), def.querySelector('[data-role="raison-photo-web"]')?.textContent], [null, null, true, DEF], 'raison définitive : aucun « Réessayer », aucune ligne de coût, « Ne pas récupérer » présent, la raison dite');
      const occupe = R({ photo_source_url: IMG }, { occupe: true });
      eq([...occupe.querySelectorAll('button')].every((b) => b.disabled), true, 'enCours : tous les boutons éteints, « Réessayer » et « Ne pas récupérer » compris');
      eq([c1, c4, c5, def].map((n) => [n.querySelectorAll('a').length, n.querySelectorAll('label').length, n.querySelectorAll('img').length]), [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], 'aucun <a>, aucun <label> (R-UX-8), aucun img (apercu: null)');
      const deuxFois = R({ photo_source_url: IMG }, { connecte: false, echec: echec('non_connecte', true) });
      eq(deuxFois.textContent.split('Connecte-toi pour utiliser l’assistant.').length - 1, 1, '« Connecte-toi pour utiliser l’assistant. » UNE seule fois quand la raison le dit déjà');
      eq(PP.ligneAnnoncePhotoWeb().textContent, 'Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour.', 'ligneAnnoncePhotoWeb : le texte de l’annonce (un ESSAI et son coût)');
    });

    await run('fiche : places, D-F8, montage sans appel, gestes, relecture, D-F15, pendant une écriture, légende (§ 4.1)', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const PW = await import('../src/domain/photo-web.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      const { preparerPhotoLocale } = await import('../src/core/image.js');
      const { createArchive, inspectArchive, applyArchive } = await import('../src/domain/backup.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      const SESSION = { access_token: 'jeton-fiche-sentinelle', user: { id: 'u1' } };
      const sync = { user: { id: 'u1' }, auth: { jeton: async () => SESSION } };
      const choix = []; const dits = []; const aChoisir = []; const appelsImage = [];
      const deps = () => ({ pickFiles: async (o) => { choix.push(o); return aChoisir.shift() || []; }, toast: (m) => dits.push(m), fetch: async (url) => { appelsImage.push(url); return reponse(500, {}); }, enLigne: () => true });
      const monter = async (id, over = {}) => { const p = await renderRecipe({ id }, {}, await ctxPour(repo, db, { sync, ...over }), deps()); scene.append(p); return p; };
      const zoneDe = (p) => p.querySelector('[data-role="zone-photo-plat"]');
      const imgTete = (p) => p.querySelector('[data-role="photo-plat"] img');
      const mettre = (...rows) => db.mutate({ puts: { recipes: rows }, origin: 'device' });
      const versions = (...rows) => db.mutate({ puts: { recipe_versions: rows }, origin: 'device' });
      const AJOUTE = 'Ajoute une photo du plat : elle illustre la recette dans tes listes.';
      try {
        // Places (§ 4.1.1)
        await mettre(fiche('rc_p', { source_page_ids: ['pg1'] })); await versions(version('rc_p'));
        const pP = await monter('rc_p', { pagesById: new Map([['pg1', { id: 'pg1', sha256: H('1'), printed_page: 12 }]]) });
        const avant = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
        const zoneP = zoneDe(pP)?.closest('section');
        const original = [...pP.querySelectorAll('section.plain')].find((s) => s.querySelector('h2')?.textContent === 'Original');
        eq([avant(pP.querySelector('[data-role="emplacement-photo-plat"]'), pP.querySelector('[data-role="autres-gestes"]')), avant(pP.querySelector('.recipe-body'), zoneP), avant(zoneP, original), zoneP?.querySelector('h2')?.textContent],
          [true, true, true, 'Photo du plat'], 'places (UI-1, D-UI-6) : l’emplacement de tête (dans .fiche-tete) avant « Portions, versions et autres gestes » ; la section « Photo du plat » (.card) après .recipe-body et avant « Original » (plain)');
        eq([zoneP.querySelectorAll('img').length, !!original?.contains(zoneP), textesDirects(pP)], [0, false, []], 'deux zones distinctes (I-6) : aucune img dans la zone, la zone hors d’« Original » ; aucun nœud texte direct sous la racine');

        // D-F8, D-F5 / R-F-3
        const jpeg = await imageTest('plat.jpg', '#c63', 640, 480); const shaJ = await sha256Hex(jpeg);
        await repo.putFile(shaJ, jpeg, { mime: 'image/jpeg', origin: 'device' });
        await mettre(fiche('rc_ref', { availability: 'reference_only', current_version_id: null, printed_page: 12 }), fiche('rc_sig', { availability: 'reference_only', current_version_id: null, source_url: 'https://site.test/r' }),
          fiche('rc_nov', { availability: 'reference_only', current_version_id: null, photo_sha256: shaJ, photo_origin: 'image' }), fiche('rc_ia', { origine: 'ia' }));
        await versions(version('rc_ia'));
        const pRef = await monter('rc_ref'); const pSig = await monter('rc_sig'); const pNov = await monter('rc_nov'); const pIa = await monter('rc_ia');
        eq([zoneDe(pRef), zoneDe(pSig), zoneDe(pNov), imgTete(pNov)?.getAttribute('src')?.startsWith('blob:'), textesDirects(pNov)], [null, null, null, true, []], 'D-F8 : référence et signet sans version → aucune zone ; fiche sans version avec pointeur et octets → l’image en tête, aucune zone');
        eq([!!zoneDe(pIa), pIa.querySelector('[data-role="photo-web-etat"]'), appelsImage.length, reseau], [true, null, 0, 0], 'D-F5 / R-F-3 : une fiche origine ia avec version → zone présente, aucun candidat, aucun POST');

        // I-F11 / S-5 : monter une fiche au cas 5 (reçue par la synchronisation, puis restaurée d'une archive) → zéro appel
        await db.mutate({ puts: { recipes: [fiche('rc_c5', { source_url: 'https://site.test/r5', photo_source_url: 'https://cdn.test/5.png' })], recipe_versions: [version('rc_c5')] }, origin: 'remote' });
        await withDatabase(async (source) => {
          await source.mutate({ puts: { recipes: [fiche('rc_c5b', { source_url: 'https://site.test/r6', photo_source_url: 'https://cdn.test/6.png' })], recipe_versions: [version('rc_c5b')] }, origin: 'device' });
          const inspection = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
          await applyArchive(db, inspection, { mode: 'merge' });
        });
        // Un FAIT, jamais un délai : un rapatriement lancé par le montage poserait son vol de façon synchrone ; sa descente éventuelle est ATTENDUE.
        const p5 = await monter('rc_c5'); const volC5 = PP.recuperationEnCours('rc_c5');
        const p5b = await monter('rc_c5b'); const volC5b = PP.recuperationEnCours('rc_c5b');
        await PP.attendreRecuperation('rc_c5'); await PP.attendreRecuperation('rc_c5b');
        eq([volC5, volC5b, appelsImage.length, reseau, zoneDe(p5)?.textContent.includes('Photo du plat non récupérée.'), zoneDe(p5b)?.textContent.includes('Photo du plat non récupérée.')], [false, false, 0, 0, true, true],
          'I-F11 : une fiche au cas 5 reçue (origine remote) puis restaurée d’une archive → aucun vol posé, zéro appel au montage (descente éventuelle attendue) ; la zone dit « Photo du plat non récupérée. »');

        // « Choisir une image », « Photographier »
        await mettre(fiche('rc_g')); await versions(version('rc_g'));
        const img = await imageTest('plat.jpg', '#c63', 800, 600);
        aChoisir.push([img]); choix.length = 0; dits.length = 0;
        const pG = await monter('rc_g');
        bouton(zoneDe(pG), 'Choisir une image').click();
        await attendre(async () => !!imgTete(pG) && !!(await db.get('recipes', 'rc_g')).photo_sha256, 'photo posée et rendue');
        const attendue = await sha256Hex(await preparerPhotoLocale(img));
        const rcG = await db.get('recipes', 'rc_g'); const ligneG = await db.get('files', attendue);
        eq([choix, rcG.photo_sha256, rcG.photo_origin, rcG.photo_source_url, ligneG?.mime, Object.hasOwn(ligneG || {}, 'original_filename'), dits],
          [[{ accept: 'image/*', multiple: false }], attendue, 'image', null, 'image/jpeg', false, ['Photo du plat enregistrée.']],
          '« Choisir une image » : pickFiles({ accept: image/*, multiple: false }) exact ; files reçoit le JPEG ré-encodé, sans original_filename ; recipes { photo_sha256, image, photo_source_url null } ; toast « Photo du plat enregistrée. »');
        eq([imgTete(pG).getAttribute('src').startsWith('blob:'), imgTete(pG).getAttribute('alt'), etiquettes(zoneDe(pG))], [true, 'Photo du plat', ['Photographier', 'Choisir une image', 'Retirer']], '« Choisir une image » : l’image en tête (blob:, alt « Photo du plat »), zone cas 2');
        await mettre(fiche('rc_ph')); await versions(version('rc_ph'));
        aChoisir.push([await imageTest('ph.jpg', '#36c', 640, 480)]); choix.length = 0;
        const pPh = await monter('rc_ph');
        bouton(zoneDe(pPh), 'Photographier').click();
        await attendre(async () => (await db.get('recipes', 'rc_ph')).photo_origin === 'photo', 'photo prise');
        eq(choix, [{ accept: 'image/*', multiple: false, capture: 'environment' }], '« Photographier » : pickFiles({ accept: image/*, multiple: false, capture: environment }) exact ; photo_origin photo');

        // « Choisir une image » sur une photo en place : nouveau sha256, ancienne ligne files gardée, ancienne URL révoquée APRÈS le remplacement
        const ancienneUrl = imgTete(pG).getAttribute('src'); const ancienSha = rcG.photo_sha256;
        const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
        URL.revokeObjectURL = (u) => { revoquees.push({ u, encore: [...document.querySelectorAll('img')].some((i) => i.getAttribute('src') === u) }); return vraiRevoke.call(URL, u); };
        try {
          aChoisir.push([await imageTest('autre.jpg', '#6a3', 700, 500)]);
          bouton(zoneDe(pG), 'Choisir une image').click();
          // Ronde 1 de T5 : le FAIT du redessin (la nouvelle URL en tête), puis la révocation attendue bornée SANS lever (l'eq ci-dessous juge) — un tick seul
          // rougissait à tort sous charge (l'ancienne image satisfaisait déjà !!imgTete).
          await attendre(async () => (await db.get('recipes', 'rc_g')).photo_sha256 !== ancienSha && !!imgTete(pG) && imgTete(pG).getAttribute('src') !== ancienneUrl, 'photo remplacée et redessinée');
          for (let i = 0; i < 200 && !revoquees.some((x) => x.u === ancienneUrl); i += 1) await tick();
        } finally { URL.revokeObjectURL = vraiRevoke; }
        const rev = revoquees.find((x) => x.u === ancienneUrl);
        eq([!!(await db.get('files', ancienSha))?.blob, !!rev, rev?.encore], [true, true, false], '« Choisir une image » sur une photo en place : l’ancienne ligne files reste ; l’ancienne URL blob: est révoquée APRÈS le remplacement (plus dans le document)');

        // Remplaçable à la main depuis une photo WEB (D-F14, B-10) ; légende (D-F11)
        const jpegW = await imageTest('web.jpg', '#a33', 640, 480); const shaW = await sha256Hex(jpegW);
        await repo.putFile(shaW, jpegW, { mime: 'image/jpeg', origin: 'device' });
        await mettre(fiche('rc_w', { source_url: 'https://recettes.test/x', photo_sha256: shaW, photo_origin: 'web', photo_source_url: 'https://cdn.test/w.jpg' })); await versions(version('rc_w'));
        const pW = await monter('rc_w');
        eq([pW.querySelector('[data-role="legende-photo-plat"]')?.textContent, pW.querySelector('figcaption.muted')?.dataset.role, pW.textContent.includes('cdn.test')], ['Image de la page recettes.test', 'legende-photo-plat', false], 'photo web : figcaption.muted « Image de la page {hote} » — hôte RECALCULÉ depuis source_url, jamais celui de photo_source_url (cdn.test)');
        aChoisir.push([await imageTest('mienne.jpg', '#3a3', 640, 480)]);
        bouton(zoneDe(pW), 'Choisir une image').click();
        await attendre(async () => (await db.get('recipes', 'rc_w')).photo_origin === 'image' && !pW.querySelector('[data-role="legende-photo-plat"]'), 'photo de la personne posée, légende retirée');
        const rcW = await db.get('recipes', 'rc_w');
        eq([rcW.photo_origin, rcW.photo_source_url, PW.candidatPhotoWeb(rcW, 'https://cdn.test/w.jpg')], ['image', null, null], 'remplaçable à la main depuis une photo WEB : image, photo_source_url null ; la même page relue n’aurait plus de candidat (P-12 : le parcours complet en tâche 5)');
        await mettre(fiche('rc_l1', { source_url: 'pas une adresse', photo_sha256: shaW, photo_origin: 'web', photo_source_url: 'https://cdn.test/l.jpg' }), fiche('rc_l2', { source_url: 'https://recettes.test/y', photo_sha256: shaW, photo_origin: 'image', photo_source_url: null }));
        await versions(version('rc_l1'), version('rc_l2'));
        const pL1 = await monter('rc_l1'); const pL2 = await monter('rc_l2');
        eq([pL1.querySelector('[data-role="legende-photo-plat"]')?.textContent, pL2.querySelector('[data-role="legende-photo-plat"]'), pL1.textContent.includes('cdn.test')], ['Image de la page web', null, false], 'légende : source_url illisible → « Image de la page web » ; photo image → aucune légende ; jamais l’hôte de photo_source_url');

        // « Retirer » — sur une photo WEB : les trois champs sont posés, provenance comprise (un « Retirer » qui garderait photo_source_url rougit ICI ;
        // une fiche dont photo_source_url vaut déjà null ne le verrait pas)
        await mettre(fiche('rc_rw', { source_url: 'https://recettes.test/rw', photo_sha256: shaW, photo_origin: 'web', photo_source_url: 'https://cdn.test/rw.jpg' })); await versions(version('rc_rw'));
        const pRw = await monter('rc_rw');
        dits.length = 0;
        const retirer = bouton(zoneDe(pRw), 'Retirer');
        eq([retirer?.getAttribute('aria-label'), !!imgTete(pRw)], ['Retirer la photo du plat', true], '« Retirer » porte le nom accessible « Retirer la photo du plat » ; la photo web est en tête');
        retirer.click();
        await attendre(async () => (await db.get('recipes', 'rc_rw')).photo_sha256 === null && !pRw.querySelector('[data-role="photo-plat"]'), 'photo retirée');
        const rcR = await db.get('recipes', 'rc_rw');
        eq([rcR.photo_sha256, rcR.photo_origin, rcR.photo_source_url, dits, !!(await db.get('files', shaW))?.blob, zoneDe(pRw).textContent.includes(AJOUTE)], [null, null, null, ['Photo du plat retirée.'], true, true],
          '« Retirer » d’une photo web : trois champs à null (provenance comprise), toast « Photo du plat retirée. », les octets restent, en-tête vide (aucune figure), zone cas 1');

        // Un PDF ; fiche relue (C4) ; fiche supprimée
        dits.length = 0;
        await mettre(fiche('rc_pdf')); await versions(version('rc_pdf'));
        const pPdf = await monter('rc_pdf'); const nFiles = await db.count('files');
        aChoisir.push([new File(['%PDF-1.4 pas une image'], 'menu.pdf', { type: 'application/pdf' })]);
        bouton(zoneDe(pPdf), 'Choisir une image').click();
        await attendre(() => dits.length === 1, 'toast du PDF');
        eq([dits, (await db.get('recipes', 'rc_pdf')).photo_sha256 ?? null, await db.count('files')], [['Cette image ne peut pas être lue ici. Essaie une autre photo.'], null, nFiles], 'un PDF : toast « Cette image ne peut pas être lue ici. … », rien d’écrit');
        await mettre(fiche('rc_c4')); await versions(version('rc_c4'));
        const pC4 = await monter('rc_c4');
        await mettre({ ...(await db.get('recipes', 'rc_c4')), original_title: 'Titre changé ailleurs' });
        aChoisir.push([await imageTest('c4.jpg', '#a0a', 640, 480)]);
        bouton(zoneDe(pC4), 'Choisir une image').click();
        await attendre(async () => !!(await db.get('recipes', 'rc_c4')).photo_sha256, 'photo posée (C4)');
        eq((await db.get('recipes', 'rc_c4')).original_title, 'Titre changé ailleurs', 'relecture C4 : la fiche écrite porte le titre changé en base entre le rendu et le geste, ET la photo');
        dits.length = 0;
        await mettre(fiche('rc_sup')); await versions(version('rc_sup'));
        const pSup = await monter('rc_sup');
        await db.mutate({ deletes: { recipes: ['rc_sup'] }, origin: 'device' });
        const nF = await db.count('files');
        aChoisir.push([await imageTest('sup.jpg', '#0aa', 640, 480)]);
        bouton(zoneDe(pSup), 'Choisir une image').click();
        await attendre(() => dits.length === 1, 'toast fiche supprimée');
        eq([dits, await db.get('recipes', 'rc_sup'), await db.count('files')], [['Recette introuvable.'], undefined, nF], 'fiche supprimée entre le rendu et le geste : « Recette introuvable. », aucune fiche recréée, aucune ligne files neuve (relecture AVANT putFile)');

        // D-F15 : un geste ne redessine que la photo (une scène vide : setServings lit document.getElementById)
        scene.replaceChildren();
        await mettre(fiche('rc_d15')); await versions(version('rc_d15'));
        const pD = await monter('rc_d15');
        const plus = [...pD.querySelectorAll('button')].find((b) => b.textContent === '+');
        plus.click(); plus.click();
        // Relevé APRÈS les « + » : un drawBody() remplacerait les enfants de .recipe-body (le nœud lui-même reste : comparer lui ne prouverait rien).
        const enfantAvant = pD.querySelector('.recipe-body')?.firstElementChild ?? null;
        let rafraichis = 0; const compter = () => { rafraichis += 1; };
        window.addEventListener('cuisineos:refresh', compter);
        try {
          aChoisir.push([await imageTest('d15.jpg', '#aa0', 640, 480)]);
          bouton(zoneDe(pD), 'Choisir une image').click();
          await attendre(() => !!imgTete(pD), 'photo posée (D-F15)');
        } finally { window.removeEventListener('cuisineos:refresh', compter); }
        eq([rafraichis, pD.querySelector('#servings-val')?.textContent, enfantAvant !== null && pD.querySelector('.recipe-body')?.firstElementChild === enfantAvant && enfantAvant.isConnected], [0, '6', true],
          'D-F15 : aucun cuisineos:refresh, les portions restent 6, le corps de la fiche n’est pas redessiné (son premier enfant est le même nœud ; P-19)');

        // Pendant une écriture : boutons éteints ; la garde occupe empêche un second pickFiles
        await mettre(fiche('rc_b')); await versions(version('rc_b'));
        let lever; const barriere = new Promise((r) => { lever = r; });
        // Ronde 1 : saveBatch — l'écriture de la fiche passe par la condition { key, fusion } (relue dans la transaction).
        const repoB = { get: (...a) => repo.get(...a), getFile: (...a) => repo.getFile(...a), save: (...a) => repo.save(...a), saveBatch: (...a) => repo.saveBatch(...a), putFile: async (...a) => { await barriere; return repo.putFile(...a); }, db: repo.db };
        let picks = 0; const imgB = await imageTest('b.jpg', '#a5a', 640, 480);
        const m = await PP.monterPhotoPlat(await db.get('recipes', 'rc_b'), { sync }, { repo: repoB, pickFiles: async () => { picks += 1; return [imgB]; }, toast: () => {}, enLigne: () => true });
        scene.append(m.entete, m.zone);
        const ecritures = async () => (await db.getAll('outbox')).filter((e) => e.store === 'recipes' && e.id === 'rc_b').length;
        const avantB = await ecritures();
        const enCours = m.gestes.choisir();
        await attendre(() => { const bs = [...m.zone.querySelectorAll('button')]; return bs.length > 0 && bs.every((b) => b.disabled); }, 'boutons éteints pendant l’écriture');
        // appel DIRECT : un clic sur un bouton éteint ne déclencherait rien, garde ou pas. BORNÉ (R-D-10) : sans la garde, ce second appel attendrait
        // la barrière levée plus bas — la suite figerait au lieu de rougir ; avec la garde, il rend tout de suite (la borne n'est jamais attendue).
        await Promise.race([m.gestes.choisir(), new Promise((r) => setTimeout(r, 500))]);
        eq(picks, 1, 'pendant une écriture : la garde occupe — pickFiles n’est pas rappelé');
        lever(); await enCours;
        eq((await ecritures()) - avantB, 1, 'pendant une écriture : la barrière levée, UNE écriture recipes');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));

    await run('pointeur sans octets : l’état du fichier EN TÊTE, jamais dans la zone (§ 4.1.4, I-F10)', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try {
        const R = (sur = {}) => ({ sha256: H('e'), size: 400, mime: 'image/jpeg', quality: 'reduite', uploaded_at: DATE, owner: 'u1', ...sur });
        const jpeg = await imageTest('d.jpg', '#c63', 320, 240);
        await db.mutate({ puts: { files: [
          { sha256: H('3'), mime: 'image/jpeg', size: jpeg.size, updated_at: DATE, remote: R({ sha256: H('3'), size: jpeg.size }) },
          { sha256: H('4'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('4'), size: 5, owner: 'u2' }) },
          { sha256: H('6'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('6'), size: 5 }) },
        ] }, origin: 'remote' });
        const appels = [];
        const moteur = { telecharger: async (shas) => { appels.push(shas); const ligne = await db.get('files', H('3')); await db.mutate({ puts: { files: [{ ...ligne, blob: jpeg }] }, origin: 'remote' }); return { recus: 1, erreurs: 0, erreur: null }; },
          reessayerFichier: async () => ({ recus: 0, erreurs: 0, erreur: null }), onEtat: () => () => {} };
        await db.mutate({ puts: { recipes: [fiche('rc_d', { photo_sha256: H('3'), photo_origin: 'image' }), fiche('rc_a', { photo_sha256: H('4'), photo_origin: 'image' }), fiche('rc_s', { photo_sha256: H('6'), photo_origin: 'image' }), fiche('rc_n', { photo_sha256: H('5'), photo_origin: 'image' })],
          recipe_versions: [version('rc_d'), version('rc_a'), version('rc_s'), version('rc_n')] }, origin: 'device' });
        const monter = async (id, sync) => { const p = await renderRecipe({ id }, {}, await ctxPour(repo, db, { sync })); scene.append(p); return p; };
        const tete = (p) => p.querySelector('[data-role="photo-plat"]');
        const zone = (p) => p.querySelector('[data-role="zone-photo-plat"]');
        const telecharger = (n) => [...(n?.querySelectorAll('button') || [])].filter((b) => b.textContent === 'Télécharger');
        const pD = await monter('rc_d', { user: { id: 'u1' }, moteur });
        eq([telecharger(tete(pD)).length, telecharger(zone(pD)).length, etiquettes(zone(pD))], [1, 0, ['Photographier', 'Choisir une image', 'Retirer']], 'distant + compte : EXACTEMENT un « Télécharger » en tête, aucun dans la zone (cas 3 : les boutons du cas 2)');
        let rafraichis = 0; const compter = () => { rafraichis += 1; };
        window.addEventListener('cuisineos:refresh', compter);
        // Le conteneur de la zone n'est JAMAIS remplacé (seuls ses enfants le sont) : c'est son contenu qui dirait un redessin.
        const contenuAvant = zone(pD)?.firstElementChild ?? null;
        try {
          telecharger(tete(pD))[0].click();
          await attendre(() => !!tete(pD)?.querySelector('img'), 'image en tête après « Télécharger »');
        } finally { window.removeEventListener('cuisineos:refresh', compter); }
        eq([appels, rafraichis, contenuAvant !== null && zone(pD)?.firstElementChild === contenuAvant, telecharger(zone(pD)).length], [[[H('3')]], 0, true, 0],
          '« Télécharger » (moteur factice qui écrit le blob) → l’image en tête, sans refresh(), la zone NON redessinée (son contenu est le même nœud)');
        const pA = await monter('rc_a', { user: { id: 'u1' }, moteur });
        eq([tete(pA)?.textContent.includes('Pas encore envoyée par l’appareil qui l’a prise'), telecharger(tete(pA)).length, telecharger(zone(pA)).length], [true, 0, 0], '`absent` (copie d’un autre compte, R-G-2) : le texte de G en tête, aucun bouton');
        await db.put('sync_state', { key: 'user_id', value: 'u1' });
        const pS = await monter('rc_s', { user: null, moteur: null });
        eq([tete(pS)?.textContent.includes('Connecte-toi pour la télécharger'), telecharger(zone(pS)).length], [true, 0], 'sans compte : « Connecte-toi pour la télécharger » en tête');
        const pN = await monter('rc_n', { user: { id: 'u1' }, moteur });
        eq([tete(pN), !!zone(pN)], [null, true], 'aucune ligne files pour le pointeur → rien en tête (lot A, l. 1316), la zone reste');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));

    await run('rapatriement : rapatrierPhotoWeb et la zone (§ 4.3 point 3, I-F1, I-F5, D-F17, D-F18)', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const PW = await import('../src/domain/photo-web.js');
      const P = await import('../src/domain/passerelle.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      PP.reinitialiserPhotoPlat();
      const URL_ASSISTANT = P.urlAssistant();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      const vraiErreur = console.error; const journal = [];
      console.error = (...a) => { journal.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
      let enLigneTest = true;
      try {
        const png = await octetsDe(await imageTest('p.png', '#3a7', 800, 600, 'image/png'));
        const petite = await octetsDe(await imageTest('s.png', '#3a7', 150, 150, 'image/png'));
        // Rejeu (D-2) : trois images DISTINCTES pour les cas qui comptent les lignes files (c1, c2, c4) — files est adressé par l'empreinte :
        // la même image qu'un cas précédent ne poserait jamais de ligne neuve, et le compte ne dirait rien.
        const [pngC1, pngC2, pngC4] = await Promise.all(['#a13', '#1a3', '#13a'].map(async (c, i) => octetsDe(await imageTest(`c${i}.png`, c, 800, 600, 'image/png'))));
        const corps200 = (u8 = png, type = 'image/png') => ({ type, taille: u8.length, url_finale: 'https://cdn.test/p.png', octets: base64De(u8) });
        // Le fetch factice du bloc : chaque adresse appelée est gardée (S-8) ; la réponse vient d'une file — [statut, corps], ou 'suspendre' (rendue par
        // un `suspendus.shift()(statut, corps)`) ; file vide = une PNG 800 × 600.
        const tous = []; const corpsEnvoyes = []; const file = []; const suspendus = [];
        const fetchFaux = (url, options) => new Promise((resolve, reject) => {
          tous.push(url); corpsEnvoyes.push(JSON.parse(options.body));
          const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
          if (options?.signal?.aborted) { abandon(); return; }
          options?.signal?.addEventListener('abort', abandon, { once: true });
          const prochaine = file.length ? file.shift() : [200, corps200()];
          if (prochaine === 'suspendre') { suspendus.push((st, c) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(st, c)); }); return; }
          resolve(reponse(prochaine[0], prochaine[1]));
        });
        const SESSION = { access_token: 'jeton-rapatriement-sentinelle', user: { id: 'u1' } };
        const ctxSync = (session = SESSION, user = { id: 'u1' }) => ({ sync: { user, auth: { jeton: async () => session } } });
        const opts = (over = {}) => ({ ctx: ctxSync(), repo, fetch: fetchFaux, enLigne: () => true, ...over });
        const poser = (...rows) => db.mutate({ puts: { recipes: rows }, origin: 'device' });
        const resultats = [];
        const garde = (r) => { resultats.push(r); return r; };

        // 1. Une fiche à photo_source_url sans photo
        await poser(fiche('rc_r1', { photo_source_url: 'https://cdn.test/1.png' }));
        const r1 = garde(await PP.rapatrierPhotoWeb('rc_r1', opts()));
        const f1 = await db.get('recipes', 'rc_r1'); const l1 = await db.get('files', r1.sha256);
        eq([r1.issue, corpsEnvoyes.at(-1), f1.photo_origin, f1.photo_source_url, f1.photo_sha256 === r1.sha256, l1?.mime, l1?.blob?.type],
          ['ok', { outil: 'image-web', corps: { url: 'https://cdn.test/1.png' } }, 'web', 'https://cdn.test/1.png', true, 'image/jpeg', 'image/jpeg'],
          'fiche à photo_source_url sans photo → un POST image-web avec l’adresse de la fiche relue ; files reçoit le JPEG ré-encodé ; recipes { photo_sha256, web }, photo_source_url conservé ; ok');

        // 2. Deux appels entrelacés sur la même fiche → UN POST ; deux fiches → deux POST
        await poser(fiche('rc_r2', { photo_source_url: 'https://cdn.test/2.png' }), fiche('rc_r3', { photo_source_url: 'https://cdn.test/3.png' }));
        const n0 = corpsEnvoyes.length;
        file.push('suspendre', 'suspendre');
        const p1 = PP.rapatrierPhotoWeb('rc_r2', opts()); const volSansAwait = PP.recuperationEnCours('rc_r2'); // lu AVANT tout await : le vol est déjà posé
        const p2 = PP.rapatrierPhotoWeb('rc_r2', opts()); const p3 = PP.rapatrierPhotoWeb('rc_r3', opts());
        eq([volSansAwait, garde(await p2), PP.recuperationEnCours('rc_r2')], [true, { issue: 'refuse', raison: 'vol_tenu' }, true],
          'deux appels entrelacés sur la même fiche : le vol est posé AVANT tout await (lu sans attendre), le second est refusé vol_tenu tout de suite');
        await attendre(() => suspendus.length === 2, 'deux POST, un par fiche');
        for (const fin of suspendus.splice(0)) fin(200, corps200());
        eq([garde(await p1).issue, garde(await p3).issue, corpsEnvoyes.slice(n0).map((c) => c.corps.url).sort()], ['ok', 'ok', ['https://cdn.test/2.png', 'https://cdn.test/3.png']], 'UN POST pour la fiche doublée ; deux fiches → deux POST en parallèle');

        // 3. Refus avant l'appel : zéro POST
        await poser(fiche('rc_m', { photo_sha256: H('a'), photo_origin: 'image', photo_source_url: 'https://cdn.test/m.png' }), fiche('rc_d', { photo_sha256: H('b'), photo_origin: 'web', photo_source_url: 'https://cdn.test/d.png' }),
          fiche('rc_dn', { photo_sha256: H('c'), photo_origin: 'web', photo_source_url: 'HTTPS://CDN.TEST:443/dn.png' }), fiche('rc_h', { photo_source_url: 'http://cdn.test/h.png' }), fiche('rc_o', { photo_source_url: 'https://cdn.test/o.png' }));
        const n1 = corpsEnvoyes.length;
        const refus = [garde(await PP.rapatrierPhotoWeb('rc_m', opts())), garde(await PP.rapatrierPhotoWeb('rc_d', opts())), garde(await PP.rapatrierPhotoWeb('rc_dn', opts({ candidat: 'https://cdn.test/dn.png' }))),
          garde(await PP.rapatrierPhotoWeb('rc_h', opts())), garde(await PP.rapatrierPhotoWeb('rc_o', opts({ enLigne: () => false }))), garde(await PP.rapatrierPhotoWeb('rc_o', opts({ ctx: ctxSync(null) })))];
        eq([refus.map((x) => x.raison), corpsEnvoyes.length - n1], [['photo_manuelle', 'deja_la', 'deja_la', 'adresse', 'hors_ligne', 'non_connecte'], 0],
          'photo de la personne → photo_manuelle ; même image web (même sous la forme HTTPS://…:443, S-10) → deja_la ; http → adresse ; hors ligne ; sans session → non_connecte ; zéro POST');

        // 4. S-10 : la garde compare la fiche relue à la fiche de DÉPART (normalisées), jamais à l'adresse tentée
        await poser(fiche('rc_n', { photo_source_url: 'HTTPS://A.TEST:443/n.png' }));
        const rn = garde(await PP.rapatrierPhotoWeb('rc_n', opts()));
        eq([rn.issue, corpsEnvoyes.at(-1).corps.url, (await db.get('recipes', 'rc_n')).photo_source_url], ['ok', 'https://a.test/n.png', 'https://a.test/n.png'], 'S-10 : une fiche à HTTPS://A.TEST:443/… aboutit (jamais fiche_changee) ; la provenance écrite est l’adresse normalisée');
        // 4 bis. S-10, les deux règles de la garde départ/relue : la MÊME adresse réécrite sous sa forme normalisée PENDANT la descente → inchangée (ok ;
        //        un `!==` brut rougit) ; une adresse refusée DES DEUX CÔTÉS (http) avec un candidat https → inchangée (ok, jamais fiche_changee : deux
        //        adresses refusées comptent comme égales ; une comparaison par memeAdresseImage seule rougit).
        await poser(fiche('rc_n2', { photo_source_url: 'HTTPS://A.TEST:443/n2.png' }));
        file.push('suspendre');
        const pn2 = PP.rapatrierPhotoWeb('rc_n2', opts());
        await attendre(() => suspendus.length === 1, 'POST parti (n2)');
        await poser({ ...(await db.get('recipes', 'rc_n2')), photo_source_url: 'https://a.test/n2.png' });
        suspendus.shift()(200, corps200());
        const rn2 = garde(await pn2);
        await poser(fiche('rc_hx', { photo_source_url: 'http://cdn.test/x.png' }));
        const rhx = garde(await PP.rapatrierPhotoWeb('rc_hx', opts({ candidat: 'https://cdn.test/y.png' })));
        eq([rn2.issue, (await db.get('recipes', 'rc_n2')).photo_source_url, rhx.issue, (await db.get('recipes', 'rc_hx')).photo_source_url], ['ok', 'https://a.test/n2.png', 'ok', 'https://cdn.test/y.png'],
          'S-10 : la même adresse sous une autre forme pendant la descente → ok ; refusée des deux côtés (http) avec un candidat https → ok, la provenance écrite est le candidat');

        // 5. Fiche changée pendant la descente (Review Focus 1)
        await poser(fiche('rc_c1', { photo_source_url: 'https://cdn.test/c1.png' }));
        const nf1 = await db.count('files');
        file.push('suspendre');
        const pc1 = PP.rapatrierPhotoWeb('rc_c1', opts());
        await attendre(() => suspendus.length === 1, 'POST parti (c1)');
        await poser({ ...(await db.get('recipes', 'rc_c1')), photo_sha256: H('c'), photo_origin: 'image', photo_source_url: null });
        suspendus.shift()(200, corps200(pngC1));
        const rc1 = garde(await pc1); const lu1 = await db.get('recipes', 'rc_c1');
        eq([rc1, lu1.photo_sha256, lu1.photo_origin, await db.count('files')], [{ issue: 'refuse', raison: 'fiche_changee' }, H('c'), 'image', nf1], 'photo choisie entre le POST et l’écriture → fiche_changee, la photo de la personne intacte, AUCUNE ligne files neuve (garde AVANT putFile)');
        await poser(fiche('rc_c2', { photo_source_url: 'https://cdn.test/c2.png' }));
        let lever; const barriere = new Promise((r) => { lever = r; }); let entre; const dansPutFile = new Promise((r) => { entre = r; });
        const repoB = { get: (...a) => repo.get(...a), getFile: (...a) => repo.getFile(...a), save: (...a) => repo.save(...a), saveBatch: (...a) => repo.saveBatch(...a), putFile: async (...a) => { entre(); await barriere; return repo.putFile(...a); }, db: repo.db };
        const nf2 = await db.count('files');
        file.push([200, corps200(pngC2)]);
        const pc2 = PP.rapatrierPhotoWeb('rc_c2', opts({ repo: repoB }));
        await dansPutFile;
        await poser({ ...(await db.get('recipes', 'rc_c2')), photo_sha256: H('d'), photo_origin: 'image', photo_source_url: null });
        lever();
        eq([garde(await pc2).raison, (await db.get('recipes', 'rc_c2')).photo_sha256, await db.count('files')], ['fiche_changee', H('d'), nf2 + 1], 'photo choisie PENDANT putFile → fiche_changee, la photo de la personne intacte ; la ligne files du JPEG reste (orphelin L5)');
        await poser(fiche('rc_c3', { photo_source_url: 'https://cdn.test/c3.png' }));
        file.push('suspendre');
        const pc3 = PP.rapatrierPhotoWeb('rc_c3', opts());
        await attendre(() => suspendus.length === 1, 'POST parti (c3)');
        eq((await PP.retirerPhotoPlat('rc_c3', { repo })).issue, 'ok', '« Ne pas récupérer » pendant la descente');
        suspendus.shift()(200, corps200());
        eq([garde(await pc3).raison, (await db.get('recipes', 'rc_c3')).photo_sha256], ['fiche_changee', null], '« Retirer » ou « Ne pas récupérer » pendant la descente → fiche_changee, rien d’écrit');
        await poser(fiche('rc_c4', { photo_source_url: 'https://cdn.test/c4.png' }));
        const nf4 = await db.count('files');
        file.push('suspendre');
        const pc4 = PP.rapatrierPhotoWeb('rc_c4', opts());
        await attendre(() => suspendus.length === 1, 'POST parti (c4)');
        await db.mutate({ deletes: { recipes: ['rc_c4'] }, origin: 'device' });
        suspendus.shift()(200, corps200(pngC4));
        eq([garde(await pc4).raison, await db.get('recipes', 'rc_c4'), await db.count('files')], ['fiche_absente', undefined, nf4], 'fiche supprimée pendant la descente → fiche_absente, rien ressuscité, aucune ligne files neuve');

        // 6. Relecture dont l'image a changé (D-F18, B-4)
        const jpegA = await imageTest('a.jpg', '#a00', 400, 300); const shaA = await sha256Hex(jpegA);
        await repo.putFile(shaA, jpegA, { mime: 'image/jpeg', origin: 'device' });
        await poser(fiche('rc_b4', { photo_sha256: shaA, photo_origin: 'web', photo_source_url: 'https://cdn.test/A.png' }));
        file.push([502, { erreur: 'inaccessible' }]);
        const echecB = garde(await PP.rapatrierPhotoWeb('rc_b4', opts({ candidat: 'https://cdn.test/B.png' })));
        const apresEchec = await db.get('recipes', 'rc_b4');
        eq([echecB, apresEchec.photo_sha256, apresEchec.photo_source_url, apresEchec.photo_origin, PP.etatZonePlat(apresEchec, { present: true }).web], [{ issue: 'echec', raison: 'inaccessible' }, shaA, 'https://cdn.test/A.png', 'web', null],
          'relecture dont l’image a changé, échec → la photo A et SA provenance intactes, zone cas 2');
        const okB = garde(await PP.rapatrierPhotoWeb('rc_b4', opts({ candidat: 'https://cdn.test/B.png' })));
        const apresOk = await db.get('recipes', 'rc_b4');
        eq([okB.issue, apresOk.photo_sha256 === okB.sha256, apresOk.photo_sha256 !== shaA, apresOk.photo_origin, apresOk.photo_source_url], ['ok', true, true, 'web', 'https://cdn.test/B.png'], 'relecture dont l’image a changé, réussite → les trois champs ENSEMBLE');

        // 7. Échecs du serveur et du mur distant
        for (const [statut, corps, raison] of [[502, { erreur: 'inaccessible' }, 'inaccessible'], [422, { erreur: 'pas_une_image' }, 'pas_une_image'], [413, { erreur: 'image_trop_lourde' }, 'image_trop_lourde'], [429, { erreur: 'quota', quota: 60 }, 'quota']]) {
          const id = 'rc_e_' + raison;
          await poser(fiche(id, { photo_source_url: 'https://cdn.test/e.png' }));
          file.push([statut, corps]); journal.length = 0;
          const r = garde(await PP.rapatrierPhotoWeb(id, opts()));
          const f = await db.get('recipes', id);
          eq([r, f.photo_sha256 ?? null, f.photo_source_url, journal.some((l) => l.includes('photo_web.echec'))], [{ issue: 'echec', raison }, null, 'https://cdn.test/e.png', true], `échec serveur ${raison} → { echec, ${raison} }, logError photo_web.echec, fiche intacte`);
        }
        await poser(fiche('rc_deg', { photo_source_url: 'https://cdn.test/deg.png' }), fiche('rc_pt', { photo_source_url: 'https://cdn.test/pt.png' }));
        file.push([200, corps200(png, 'image/jpeg')], [200, corps200(petite)]);
        eq([garde(await PP.rapatrierPhotoWeb('rc_deg', opts())), (await db.get('recipes', 'rc_deg')).photo_sha256 ?? null], [{ issue: 'echec', raison: 'indecodable' }, null], 'image reçue déguisée (PNG annoncée jpeg) → echec(indecodable), rien d’écrit (le mur DISTANT)');
        eq([garde(await PP.rapatrierPhotoWeb('rc_pt', opts())), (await db.get('recipes', 'rc_pt')).photo_sha256 ?? null], [{ issue: 'echec', raison: 'trop_petite' }, null], 'une PNG 150 × 150 → echec(trop_petite), rien d’écrit');

        // 8. La zone montée
        const dits = []; const chosen = [];
        const monter = async (id, ctx = ctxSync()) => { const p = await renderRecipe({ id }, {}, await ctxPour(repo, db, ctx), { pickFiles: async () => chosen.shift() || [], toast: (m) => dits.push(m), fetch: fetchFaux, enLigne: () => enLigneTest }); scene.append(p); return p; };
        const versionsPour = (...ids) => db.mutate({ puts: { recipe_versions: ids.map((id) => version(id)) }, origin: 'device' });
        const zoneDe = (p) => p.querySelector('[data-role="zone-photo-plat"]');
        const ligneWeb = (p) => zoneDe(p)?.querySelector('[data-role="photo-web-etat"]');
        const auto = (id, over = {}) => PP.rapatrierPhotoWeb(id, opts(over)); // le départ automatique (tape: false), comme enregistrerLecture (tâche 5)
        await poser(fiche('rc_z1', { photo_source_url: 'https://cdn.test/z1.png' })); await versionsPour('rc_z1');
        const pZ1 = await monter('rc_z1');
        file.push('suspendre');
        const pz1 = auto('rc_z1');
        await attendre(() => ligneWeb(pZ1)?.getAttribute('role') === 'status' && ligneWeb(pZ1)?.textContent === 'Récupération de la photo du plat…', '« Récupération… » pendant la descente');
        suspendus.shift()(200, corps200()); garde(await pz1);
        await attendre(() => !!pZ1.querySelector('[data-role="photo-plat"] img') && !ligneWeb(pZ1), 'l’image en tête après la descente');
        eq(dits, [], 'zone montée : « Récupération… » pendant (fetch suspendu), puis l’image en tête ; aucun toast');
        // rc_z2 à rc_z4 : le départ automatique FINIT AVANT le montage — le premier dessin lit l'échec gardé. (Monter d'abord puis attendre
        // « Réessayer » lirait le rendu d'AVANT la descente : la fiche est montée au cas 5, l'attente passerait aussitôt sur un DOM périmé.)
        await poser(fiche('rc_z2', { photo_source_url: 'https://cdn.test/z2.png' })); await versionsPour('rc_z2');
        file.push([502, { erreur: 'inaccessible' }]); garde(await auto('rc_z2'));
        const pZ2 = await monter('rc_z2');
        eq([ligneWeb(pZ2).textContent.includes('Photo du plat non récupérée.'), zoneDe(pZ2).querySelector('[data-role="raison-photo-web"]'), zoneDe(pZ2).querySelector('[data-role="cout-photo-web"]')?.textContent, !!zoneDe(pZ2).querySelector('[data-role="abandonner-photo-web"]')],
          [true, null, 'Un appel de plus, compté dans ton quota du jour.', true], 'échec au départ automatique : « non récupérée », « Réessayer », la ligne de coût, « Ne pas récupérer » — AUCUNE raison dite');
        const avantR = corpsEnvoyes.length;
        file.push([200, corps200()]);
        zoneDe(pZ2).querySelector('[data-role="reessayer-photo"]').click();
        await attendre(() => !!pZ2.querySelector('[data-role="photo-plat"] img'), '« Réessayer » → l’image');
        eq(corpsEnvoyes.length - avantR, 1, '« Réessayer » → UN POST, puis l’image');
        await poser(fiche('rc_z3', { photo_source_url: 'https://cdn.test/z3.png' })); await versionsPour('rc_z3');
        file.push([429, { erreur: 'quota', quota: 60 }]); garde(await auto('rc_z3'));
        const pZ3 = await monter('rc_z3');
        eq([!!zoneDe(pZ3)?.querySelector('[data-role="reessayer-photo"]'), zoneDe(pZ3)?.querySelector('[data-role="raison-photo-web"]')], [true, null],
          'départ automatique sur quota (fini avant le montage) → « Réessayer », aucun texte de raison (un échec automatique gardé avec tape: true rougit ici)');
        file.push([429, { erreur: 'quota', quota: 60 }]); dits.length = 0;
        zoneDe(pZ3).querySelector('[data-role="reessayer-photo"]').click();
        await attendre(() => !!zoneDe(pZ3)?.querySelector('[data-role="raison-photo-web"]'), 'raison dite après la tape');
        eq([zoneDe(pZ3).querySelector('[data-role="raison-photo-web"]').textContent, dits], ['Tu as atteint la limite du jour pour l’assistant (60 appels).', []], '« Réessayer » qui échoue sur quota → la zone dit la raison, aucun toast');
        await poser(fiche('rc_z4', { photo_source_url: 'https://cdn.test/z4.png' })); await versionsPour('rc_z4');
        file.push([422, { erreur: 'pas_une_image' }]); garde(await auto('rc_z4'));
        const pZ4 = await monter('rc_z4');
        eq([zoneDe(pZ4).querySelector('[data-role="raison-photo-web"]').textContent, zoneDe(pZ4).querySelector('[data-role="reessayer-photo"]')], ['L’image de cette page ne peut pas être utilisée.', null], 'départ automatique sur pas_une_image → la raison définitive, aucun « Réessayer »');
        await poser(fiche('rc_z5', { photo_source_url: 'https://cdn.test/z5.png' })); await versionsPour('rc_z5');
        const pZ5 = await monter('rc_z5');
        enLigneTest = false; window.dispatchEvent(new Event('offline'));
        try {
          await attendre(() => zoneDe(pZ5)?.querySelector('[data-role="reessayer-photo"]')?.disabled === true, '« Réessayer » éteint hors ligne');
          const avantH = corpsEnvoyes.length;
          // Revue finale : un clic sur un bouton ÉTEINT ne déclenche rien, garde ou pas — la tape est jouée directement (comme en 3) : c'est la garde hors
          // ligne de la descente qu'elle éprouve (retirée, un POST partirait).
          const rH = garde(await PP.rapatrierPhotoWeb('rc_z5', opts({ tape: true, enLigne: () => false })));
          eq([zoneDe(pZ5).textContent.includes('Tu es hors ligne.'), rH, corpsEnvoyes.length - avantH], [true, { issue: 'refuse', raison: 'hors_ligne' }, 0],
            '« Réessayer » hors ligne → bouton éteint, « Tu es hors ligne. » ; la tape elle-même → refuse(hors_ligne), zéro POST');
        } finally { enLigneTest = true; window.dispatchEvent(new Event('online')); }
        await poser(fiche('rc_z6', { photo_source_url: 'https://cdn.test/z6.png' })); await versionsPour('rc_z6');
        const pZ6 = await monter('rc_z6', ctxSync(null));
        const avantS = corpsEnvoyes.length;
        zoneDe(pZ6).querySelector('[data-role="reessayer-photo"]').click();
        await attendre(() => !!zoneDe(pZ6)?.querySelector('[data-role="raison-photo-web"]'), 'raison non_connecte dite');
        eq([corpsEnvoyes.length - avantS, zoneDe(pZ6).querySelector('[data-role="raison-photo-web"]').textContent, zoneDe(pZ6).textContent.split('Connecte-toi pour utiliser l’assistant.').length - 1], [0, 'Connecte-toi pour utiliser l’assistant.', 1],
          '« Réessayer » avec ctx.sync.user posé et une session nulle (P-13) → zéro POST, la zone dit « Connecte-toi pour utiliser l’assistant. » une seule fois');
        await poser(fiche('rc_z7', { photo_source_url: 'https://cdn.test/z7.png' })); await versionsPour('rc_z7');
        const pZ7 = await monter('rc_z7'); dits.length = 0;
        const avantA = corpsEnvoyes.length;
        zoneDe(pZ7).querySelector('[data-role="abandonner-photo-web"]').click();
        await attendre(() => !!zoneDe(pZ7)?.textContent.includes('Ajoute une photo du plat'), 'cas 1 après « Ne pas récupérer »');
        const f7 = await db.get('recipes', 'rc_z7');
        eq([f7.photo_sha256 ?? null, f7.photo_origin ?? null, f7.photo_source_url, corpsEnvoyes.length - avantA, dits], [null, null, null, 0, []], '« Ne pas récupérer » → les trois champs à null, zone cas 1, zéro POST, aucun toast');
        await poser(fiche('rc_z8', { photo_source_url: 'https://cdn.test/z8.png' })); await versionsPour('rc_z8');
        chosen.push([await imageTest('mienne.jpg', '#3a3', 640, 480)]);
        const pZ8 = await monter('rc_z8');
        file.push('suspendre');
        const pz8 = auto('rc_z8');
        await attendre(() => ligneWeb(pZ8)?.getAttribute('role') === 'status', 'descente en cours (z8)');
        bouton(zoneDe(pZ8), 'Choisir une image').click();
        await attendre(async () => (await db.get('recipes', 'rc_z8')).photo_origin === 'image', 'photo de la personne posée pendant la descente');
        // Revue finale (I-F6) : la descente vole encore, mais la zone dit l'état vrai — la photo choisie, sans « Récupération… » (elle finira fiche_changee).
        await attendre(() => !!pZ8.querySelector('[data-role="photo-plat"] img'), 'la photo de la personne en tête (z8)');
        eq([PP.recuperationEnCours('rc_z8'), ligneWeb(pZ8)?.textContent ?? null], [true, null], 'photo choisie PENDANT la descente : la descente vole encore, la zone ne dit plus « Récupération de la photo du plat… » sous la photo de la personne (I-F6)');
        suspendus.shift()(200, corps200());
        eq([garde(await pz8).raison, (await db.get('recipes', 'rc_z8')).photo_origin], ['fiche_changee', 'image'], 'photo choisie PENDANT la descente → la photo de la personne reste (I-F5)');
        // Et « Retirer » pendant la descente d'une AUTRE image (une relecture : la photo web en place, l'image suivante en vol) : la zone dit le cas 1.
        const jz9 = await imageTest('z9.jpg', '#39a', 400, 300); const sz9 = await sha256Hex(jz9); await repo.putFile(sz9, jz9, { mime: 'image/jpeg', origin: 'device' });
        await poser(fiche('rc_z9', { photo_sha256: sz9, photo_origin: 'web', photo_source_url: 'https://cdn.test/z9a.png' })); await versionsPour('rc_z9');
        const pZ9 = await monter('rc_z9');
        file.push('suspendre');
        const pz9 = auto('rc_z9', { candidat: 'https://cdn.test/z9b.png' });
        await attendre(() => suspendus.length === 1 && ligneWeb(pZ9)?.getAttribute('role') === 'status', 'descente en vol sous la photo web (z9)');
        bouton(zoneDe(pZ9), 'Retirer').click();
        await attendre(() => !pZ9.querySelector('[data-role="photo-plat"] img') && !zoneDe(pZ9).querySelector('button[disabled]'), 'photo retirée, zone redessinée (z9)');
        eq([PP.recuperationEnCours('rc_z9'), ligneWeb(pZ9)?.textContent ?? null, zoneDe(pZ9).textContent.includes('Ajoute une photo du plat')], [true, null, true],
          '« Retirer » PENDANT la descente d’une autre image : la zone dit « Ajoute une photo du plat… », sans « Récupération… » (I-F6)');
        suspendus.shift()(200, corps200());
        eq([garde(await pz9).raison, (await db.get('recipes', 'rc_z9')).photo_sha256 ?? null], ['fiche_changee', null], '« Retirer » pendant la descente → fiche_changee, rien de reposé (I-F5)');

        eq([tous.length > 0, tous.every((u) => u === URL_ASSISTANT), reseau], [true, true, 0], 'S-8 / I-F3 : pendant tout le bloc, seul /functions/v1/assistant est appelé (jamais l’hôte de l’image)');
        eq(resultats.some((x) => JSON.stringify(x).includes('jeton-rapatriement-sentinelle')), false, 'le jeton n’est dans aucun résultat');
        ok(resultats.every((x) => x.issue === 'ok' || PW.RAISONS_PHOTO_WEB.includes(x.raison)), 'toute raison rendue ∈ RAISONS_PHOTO_WEB');
      } finally { console.error = vraiErreur; globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));

    await run('D-F16 : ★ Favori relit la fiche — une photo rapatriée depuis le rendu survit', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try {
        const png = await octetsDe(await imageTest('f.png', '#3a7', 800, 600, 'image/png'));
        const fetchImage = async () => reponse(200, { type: 'image/png', taille: png.length, url_finale: 'https://cdn.test/fav.png', octets: base64De(png) });
        const sync = { user: { id: 'u1' }, auth: { jeton: async () => ({ access_token: 'jeton-favori', user: { id: 'u1' } }) } };
        await db.mutate({ puts: { recipes: [fiche('rc_fav', { photo_source_url: 'https://cdn.test/fav.png' })], recipe_versions: [version('rc_fav')] }, origin: 'device' });
        const p = await renderRecipe({ id: 'rc_fav' }, {}, await ctxPour(repo, db, { sync }), { pickFiles: async () => [], toast: () => {}, fetch: fetchImage, enLigne: () => true });
        scene.append(p);
        eq((await PP.rapatrierPhotoWeb('rc_fav', { ctx: { sync }, repo, fetch: fetchImage, enLigne: () => true })).issue, 'ok', 'la photo est rapatriée APRÈS le rendu de la fiche');
        [...p.querySelectorAll('button')].find((b) => b.title === 'Favori').click();
        await attendre(async () => (await db.get('recipes', 'rc_fav')).favorite === true, '★ écrit');
        const f = await db.get('recipes', 'rc_fav');
        eq([f.favorite, /^[0-9a-f]{64}$/.test(f.photo_sha256 ?? ''), f.photo_origin, f.photo_source_url], [true, true, 'web', 'https://cdn.test/fav.png'], 'D-F16 : ★ Favori écrit favorite: true SANS effacer la photo posée depuis le rendu (fiche relue, leçon C4)');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));

    // ===== Ronde 1 de la tâche 3 (revue adverse) : écritures dans la transaction (I-F5, C4, D-F16), vue périmée, vues bornées, notification avant
    // l'insertion, redessins sérialisés (P-15), sans compte et garde refusée, gestes et rapatriement aux bords, légende après « Télécharger ».
    const pngR1 = await octetsDe(await imageTest('r1.png', '#3a7', 800, 600, 'image/png'));
    const corpsPngR1 = { type: 'image/png', taille: pngR1.length, url_finale: 'https://cdn.test/r1.png', octets: base64De(pngR1) };
    const syncR1 = { user: { id: 'u1' }, auth: { jeton: async () => ({ access_token: 'jeton-ronde-sentinelle', user: { id: 'u1' } }) } };
    // Le fetch factice des blocs de la ronde : une file de réponses ([statut, corps], ou 'suspendre', rendue par suspendus.shift()(statut, corps)) ;
    // file vide = la PNG 800 × 600 ; `posts` compte les appels.
    const fauxFetchR1 = () => {
      const f = { file: [], suspendus: [], posts: 0 };
      f.fetch = () => new Promise((resolve) => {
        f.posts += 1;
        const prochaine = f.file.length ? f.file.shift() : [200, corpsPngR1];
        if (prochaine === 'suspendre') { f.suspendus.push((st, c) => resolve(reponse(st, c))); return; }
        resolve(reponse(prochaine[0], prochaine[1]));
      });
      return f;
    };
    // Un bloc de la ronde : base jetable, scène, aucun réseau, état du module remis ; `journal` : console.error collecté (blocs qui provoquent un
    // logError) ; les enveloppes de la base jetable (propriétés PROPRES mutate / getMany, jamais un prototype : R-F-8) sont retirées en finally.
    const blocR1 = (nom, corps, { journal = false } = {}) => run(nom, () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      const vraiErreur = console.error; const lignes = [];
      if (journal) console.error = (...a) => { lignes.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
      const mettre = (...rows) => db.mutate({ puts: { recipes: rows }, origin: 'device' });
      try { await corps({ PP, repo, db, scene, journal: lignes, mettre }); }
      finally {
        for (const k of ['mutate', 'getMany']) if (Object.hasOwn(db, k)) delete db[k];
        console.error = vraiErreur; globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
      }
    }));
    // Une écriture « d'ailleurs » (un autre onglet, une descente, la synchronisation) posée JUSTE AVANT la prochaine écriture de la fiche visée, après la
    // dernière lecture du geste : db.mutate est la porte unique (db.put y passe). `viser({ id, champs })` arme l'injection ; `arme()` dit si elle attend.
    const ecritureJusteAvant = (db) => {
      const vraiMutate = db.mutate; let avant = null;
      db.mutate = async function (args = {}) {
        const vise = !!avant && ((args.puts?.recipes || []).some((r) => r?.id === avant.id) || (args.conditions?.recipes || []).some((c) => c?.key === avant.id));
        if (vise) { const a = avant; avant = null; await vraiMutate.call(this, { puts: { recipes: [{ ...(await this.get('recipes', a.id)), ...a.champs }] }, origin: 'device' }); }
        return vraiMutate.call(this, args);
      };
      return { viser: (x) => { avant = x; }, arme: () => avant !== null };
    };

    await blocR1('ronde 1 : I-F5 dans la transaction — une écriture qui s’engage juste avant l’écriture du geste n’est jamais défaite (rapatrier, poser, retirer)', async ({ PP, repo, db, mettre }) => {
      const inj = ecritureJusteAvant(db);
      const f = fauxFetchR1();
      await mettre(fiche('rc_t5', { photo_source_url: 'https://cdn.test/t5.png' }), fiche('rc_tp'), fiche('rc_tr', { photo_sha256: H('e'), photo_origin: 'image' }), fiche('rc_ta', { photo_source_url: 'https://cdn.test/ta.png' }));
      inj.viser({ id: 'rc_t5', champs: { photo_sha256: H('d'), photo_origin: 'image', photo_source_url: null } });
      const rT = await PP.rapatrierPhotoWeb('rc_t5', { ctx: { sync: syncR1 }, repo, fetch: f.fetch, enLigne: () => true });
      const fT = await db.get('recipes', 'rc_t5');
      eq([inj.arme(), f.posts, rT, fT.photo_sha256, fT.photo_origin, fT.photo_source_url], [false, 1, { issue: 'refuse', raison: 'fiche_changee' }, H('d'), 'image', null],
        'I-F5 sans fenêtre : une photo choisie qui s’engage APRÈS la dernière relecture de la descente et AVANT son écriture n’est jamais écrasée (garde rejouée dans la transaction → fiche_changee)');
      inj.viser({ id: 'rc_tp', champs: { original_title: 'Titre écrit juste avant' } });
      const rP = await PP.poserPhotoPlat('rc_tp', await imageTest('tp.jpg', '#c63', 640, 480), { repo, origin: 'image' });
      const fP = await db.get('recipes', 'rc_tp');
      eq([inj.arme(), rP.issue, fP.original_title, fP.photo_sha256 === rP.sha256, fP.photo_origin], [false, 'ok', 'Titre écrit juste avant', true, 'image'], 'poser (C4 dans la transaction) : un titre écrit juste avant l’écriture de la photo est gardé, la photo posée');
      inj.viser({ id: 'rc_tr', champs: { original_title: 'Titre écrit juste avant le retrait' } });
      const rR = await PP.retirerPhotoPlat('rc_tr', { repo, attendu: { sha256: H('e'), candidat: null } });
      const fR = await db.get('recipes', 'rc_tr');
      inj.viser({ id: 'rc_ta', champs: { photo_sha256: H('f'), photo_origin: 'image', photo_source_url: null } });
      const rA = await PP.retirerPhotoPlat('rc_ta', { repo, attendu: { sha256: null, candidat: 'https://cdn.test/ta.png' } });
      const fA = await db.get('recipes', 'rc_ta');
      eq([inj.arme(), rR, fR.original_title, fR.photo_sha256, rA, fA.photo_sha256, fA.photo_origin], [false, { issue: 'ok' }, 'Titre écrit juste avant le retrait', null, { issue: 'refuse', raison: 'fiche_changee' }, H('f'), 'image'],
        '« Retirer » dans la transaction : un titre écrit juste avant est gardé ; « Ne pas récupérer » quand une photo s’engage juste avant → fiche_changee, la photo de la personne intacte');
    });

    await blocR1('ronde 1 : C4 relue APRÈS putFile — un titre changé, puis une fiche supprimée, PENDANT putFile', async ({ PP, repo, db, mettre }) => {
      const avecBarriere = () => {
        let lever; const barriere = new Promise((r) => { lever = r; }); let entre; const dans = new Promise((r) => { entre = r; });
        const r = { get: (...a) => repo.get(...a), getFile: (...a) => repo.getFile(...a), save: (...a) => repo.save(...a), saveBatch: (...a) => repo.saveBatch(...a), putFile: async (...a) => { entre(); await barriere; return repo.putFile(...a); } };
        return { lever, dans, repo: r };
      };
      await mettre(fiche('rc_s1a'), fiche('rc_s1b'));
      const b1 = avecBarriere();
      const p1 = PP.poserPhotoPlat('rc_s1a', await imageTest('s1a.jpg', '#a0a', 640, 480), { repo: b1.repo, origin: 'image' });
      await b1.dans;
      await mettre({ ...(await db.get('recipes', 'rc_s1a')), original_title: 'Titre changé pendant putFile' });
      b1.lever();
      const r1 = await p1;
      const b2 = avecBarriere();
      const p2 = PP.poserPhotoPlat('rc_s1b', await imageTest('s1b.jpg', '#0a0', 640, 480), { repo: b2.repo, origin: 'image' });
      await b2.dans;
      await db.mutate({ deletes: { recipes: ['rc_s1b'] }, origin: 'device' });
      b2.lever();
      const r2 = await p2;
      eq([r1.issue, (await db.get('recipes', 'rc_s1a')).original_title, (await db.get('recipes', 'rc_s1a')).photo_sha256 === r1.sha256, r2, await db.get('recipes', 'rc_s1b')],
        ['ok', 'Titre changé pendant putFile', true, { issue: 'refuse', raison: 'fiche_absente' }, undefined], 'C4 relue APRÈS putFile : un titre changé PENDANT putFile est gardé (et la photo posée) ; une fiche supprimée PENDANT putFile → fiche_absente, jamais ressuscitée');
    });

    await blocR1('ronde 1 : ★ Favori dans la transaction (D-F16) — photo écrite juste avant, valeur que l’écran annonce, fiche supprimée depuis le rendu', async ({ repo, db, scene }) => {
      const { renderRecipe } = await import('../src/ui/recipe.js');
      const inj = ecritureJusteAvant(db);
      const dits = [];
      const monterFiche = async (id) => { const p = await renderRecipe({ id }, {}, await ctxPour(repo, db, { sync: syncR1 }), { pickFiles: async () => [], toast: (m) => dits.push(m), fetch: async () => reponse(500, {}), enLigne: () => true }); scene.append(p); return p; };
      const etoile = (p) => [...p.querySelectorAll('button')].find((b) => b.title === 'Favori');
      const enFile = async (id) => (await db.getAll('outbox')).filter((e) => e.store === 'recipes' && e.id === id).length;
      await db.mutate({ puts: { recipes: [fiche('rc_fa'), fiche('rc_fv'), fiche('rc_fs')], recipe_versions: [version('rc_fa'), version('rc_fv'), version('rc_fs')] }, origin: 'device' });
      // une descente qui écrit juste avant ★ (le scénario « ★ dans les 30 s » de D-F16)
      const pFa = await monterFiche('rc_fa');
      inj.viser({ id: 'rc_fa', champs: { photo_sha256: H('c'), photo_origin: 'web', photo_source_url: 'https://cdn.test/fa.png' } });
      etoile(pFa).click();
      await attendre(async () => (await db.get('recipes', 'rc_fa')).favorite === true, '★ écrit (rc_fa)');
      const fFa = await db.get('recipes', 'rc_fa');
      eq([inj.arme(), fFa.favorite, fFa.photo_sha256, fFa.photo_origin, fFa.photo_source_url], [false, true, H('c'), 'web', 'https://cdn.test/fa.png'], 'D-F16 dans la transaction : une photo web écrite juste avant ★ survit (seul favorite change)');
      // la valeur que l'écran annonce (« ☆ Favori » → favori), même si favorite a bougé ailleurs depuis le rendu
      const pFv = await monterFiche('rc_fv');
      const avantFv = await enFile('rc_fv');
      await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_fv')), favorite: true }] }, origin: 'device' });
      etoile(pFv).click();
      await attendre(async () => (await enFile('rc_fv')) > avantFv, '★ écrit (rc_fv)');
      eq((await db.get('recipes', 'rc_fv')).favorite, true, '★ écrit la valeur que l’écran annonce (« ☆ Favori » → favori), jamais l’inverse de la base : un favori posé ailleurs n’est pas défait');
      // fiche supprimée entre le rendu et ★ : rien d'écrit, « Recette introuvable. » par le toast injecté (deps.toast), aucun rejet non géré
      const pFs = await monterFiche('rc_fs');
      await db.mutate({ deletes: { recipes: ['rc_fs'] }, origin: 'device' });
      dits.length = 0; const rejets = []; const surRejet = (e) => { rejets.push(e); };
      window.addEventListener('unhandledrejection', surRejet);
      try {
        etoile(pFs).click();
        await attendre(() => dits.length === 1, 'toast de la fiche supprimée');
        await tick();
      } finally { window.removeEventListener('unhandledrejection', surRejet); }
      eq([dits, await db.get('recipes', 'rc_fs'), await enFile('rc_fs'), rejets.length], [['Recette introuvable.'], undefined, 0, 0], '★ sur une fiche supprimée depuis le rendu : « Recette introuvable. » (toast injecté), aucune fiche recréée, rien en file, aucun rejet');
    });

    await blocR1('ronde 1 : vues bornées — chaque montage purge les zones détachées ou jamais insérées', async ({ PP, repo, db, scene, mettre }) => {
      const monter = async (id) => PP.monterPhotoPlat(await db.get('recipes', id), { sync: syncR1 }, { repo, pickFiles: async () => [], toast: () => {}, enLigne: () => true });
      const inserer = (m) => { scene.append(m.entete, m.zone); return m; };
      await mettre(fiche('rc_va'), fiche('rc_vb'), fiche('rc_vc'), fiche('rc_vd'), fiche('rc_ve'));
      const mA = inserer(await monter('rc_va')); const mB = inserer(await monter('rc_vb'));
      const deux = PP.vuesPhotoPlat();
      mA.entete.remove(); mA.zone.remove(); // la fiche A quittée
      inserer(await monter('rc_vc'));
      const apresC = PP.vuesPhotoPlat();
      // jamais insérée (route abandonnée, fiche sans version : D-F8), montée il y a plus de deux minutes (revue finale : la vie d'une vue jamais insérée)
      await PP.monterPhotoPlat(await db.get('recipes', 'rc_vd'), { sync: syncR1 }, { repo, pickFiles: async () => [], toast: () => {}, enLigne: () => true, instant: () => Date.now() - 2 * 60 * 1000 - 1 });
      inserer(await monter('rc_ve'));
      const apresE = PP.vuesPhotoPlat();
      window.dispatchEvent(new Event('online')); // une notification voit B, C et E dans le document
      mB.entete.remove(); mB.zone.remove(); // puis B quittée
      window.dispatchEvent(new Event('online'));
      eq([deux, apresC, apresE, PP.vuesPhotoPlat()], [2, 2, 3, 2], 'vues bornées : chaque montage purge les zones détachées (A quittée, vue insérée ; D jamais insérée, montée il y a plus de 2 min) ; une zone vue insérée puis détachée (B) est purgée par la notification suivante');
    });

    await blocR1('revue finale : deux rendus de la même fiche qui se chevauchent — le plus ancien, monté APRÈS, ne purge pas la vue que le routeur insère', async ({ PP, repo, db, scene, mettre }) => {
      const monter = async (id) => PP.monterPhotoPlat(await db.get('recipes', id), { sync: syncR1 }, { repo, pickFiles: async () => [], toast: () => {}, enLigne: () => true });
      await mettre(fiche('rc_vr'));
      const recent = await monter('rc_vr'); // le rendu N+1 monte d'abord (son jeton est venu tout de suite)
      await monter('rc_vr'); // le rendu N, retardé, monte ensuite ; le routeur ne l'insérera jamais (le plus récent gagne)
      scene.append(recent.entete, recent.zone); // le routeur insère N+1
      await mettre({ ...(await db.get('recipes', 'rc_vr')), photo_source_url: 'https://cdn.test/vr.png' }); // une écriture que seule une notification fait voir
      window.dispatchEvent(new Event('online'));
      await attendre(() => recent.zone.textContent.includes('Photo du plat non récupérée.'), 'la vue insérée redessinée par la notification');
      ok(!recent.zone.textContent.includes('Ajoute une photo du plat'), 'la vue du rendu le plus récent, insérée par le routeur, reçoit encore les notifications après le montage tardif du plus ancien');
    });

    await blocR1('ronde 1 : l’image de tête est gardée telle quelle par un redessin qui ne la change pas (aucune URL blob: neuve, aucun second décodage)', async ({ PP, repo, db, scene, mettre }) => {
      const j = await imageTest('k.jpg', '#a33', 400, 300); const s = await sha256Hex(j); await repo.putFile(s, j, { mime: 'image/jpeg', origin: 'device' });
      await mettre(fiche('rc_k', { photo_sha256: s, photo_origin: 'image' }));
      const m = await PP.monterPhotoPlat(await db.get('recipes', 'rc_k'), { sync: syncR1 }, { repo, pickFiles: async () => [], toast: () => {}, enLigne: () => true });
      scene.append(m.entete, m.zone);
      const img = m.entete.querySelector('img'); const src = img?.getAttribute('src');
      const cont = m.zone.querySelector('[data-role="zone-photo-plat"]');
      let dessins = 0; const vraiRemplacer = cont.replaceChildren;
      cont.replaceChildren = function (...a) { dessins += 1; return vraiRemplacer.apply(this, a); }; // propriété propre du nœud, jamais un prototype
      window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('online'));
      await attendre(() => dessins >= 2, 'deux redessins');
      eq([!!src?.startsWith('blob:'), m.entete.querySelector('img') === img, img?.getAttribute('src') === src, !!img?.isConnected], [true, true, true, true],
        'un redessin qui ne change ni le pointeur, ni les octets, ni la légende garde la figure de tête : même img, même URL blob: (aucun scintillement)');
    });

    await blocR1('ronde 1 : notification entre le montage et l’insertion (fiche sans pages) — un échec fini avant l’insertion, puis une réussite', async ({ PP, repo, db, scene, mettre }) => {
      const f = fauxFetchR1();
      const monter = async (id) => PP.monterPhotoPlat(await db.get('recipes', id), { sync: syncR1 }, { repo, pickFiles: async () => [], toast: () => {}, fetch: f.fetch, enLigne: () => true });
      const inserer = (m) => { scene.append(m.entete, m.zone); return m; };
      const ligneWeb = (m) => m.zone.querySelector('[data-role="photo-web-etat"]');
      await mettre(fiche('rc_ni', { photo_source_url: 'https://cdn.test/ni.png' }), fiche('rc_ns', { photo_source_url: 'https://cdn.test/ns.png' }));
      // le départ automatique de la tâche 5 : la descente part avant le montage et finit (échec) pendant la fin du rendu, AVANT l'insertion
      f.file.push('suspendre');
      const pNi = PP.rapatrierPhotoWeb('rc_ni', { ctx: { sync: syncR1 }, repo, fetch: f.fetch, enLigne: () => true });
      await attendre(() => f.suspendus.length === 1, 'POST parti (ni)');
      const mNi = await monter('rc_ni');
      const pendant = ligneWeb(mNi)?.textContent;
      f.suspendus.shift()(502, { erreur: 'inaccessible' });
      await pNi;
      inserer(mNi);
      await attendre(() => !!ligneWeb(mNi)?.textContent.includes('Photo du plat non récupérée.'), '« non récupérée » après l’insertion');
      // la même, réussie : la descente part juste avant l'insertion, dans le même tour (comme le routeur pour une fiche sans pages)
      const mNs = await monter('rc_ns');
      const pNs = PP.rapatrierPhotoWeb('rc_ns', { ctx: { sync: syncR1 }, repo, fetch: f.fetch, enLigne: () => true });
      inserer(mNs);
      await pNs;
      await attendre(() => !!mNs.entete.querySelector('img'), 'l’image en tête après la descente');
      eq([pendant, !!ligneWeb(mNi)?.textContent.includes('Récupération'), ligneWeb(mNs)], ['Récupération de la photo du plat…', false, null],
        'notification entre le montage et l’insertion : la vue n’est jamais perdue — « non récupérée » après un échec fini avant l’insertion, l’image après une réussite');
    }, { journal: true }); // l'échec journalise photo_web.echec

    await blocR1('ronde 1 : fiche à pages — une notification pendant la fin du rendu (après le montage, avant l’insertion) ne perd pas la vue', async ({ repo, db, scene }) => {
      const { renderRecipe } = await import('../src/ui/recipe.js');
      const f = fauxFetchR1();
      await db.mutate({ puts: { recipes: [fiche('rc_pg', { source_page_ids: ['pg_r1'], photo_source_url: 'https://cdn.test/pg.png' })], recipe_versions: [version('rc_pg')] }, origin: 'device' });
      // renderRecipe attend encore les vignettes des pages APRÈS monterPhotoPlat : la lecture des octets de la page est retenue (enveloppe propre de getMany)
      const vraiGetMany = db.getMany;
      let lever; const barriere = new Promise((r) => { lever = r; }); let entre; const dans = new Promise((r) => { entre = r; });
      db.getMany = async function (store, keys) { if (store === 'files' && Array.isArray(keys) && keys.includes(H('9'))) { entre(); await barriere; } return vraiGetMany.call(this, store, keys); };
      const prPg = renderRecipe({ id: 'rc_pg' }, {}, await ctxPour(repo, db, { sync: syncR1, pagesById: new Map([['pg_r1', { id: 'pg_r1', sha256: H('9'), printed_page: 3 }]]) }), { pickFiles: async () => [], toast: () => {}, fetch: f.fetch, enLigne: () => true });
      await dans; await tick(); await tick(); // monté ; une réinscription différée d'un tour aurait déjà tiré : la racine n'est pas encore insérée
      window.dispatchEvent(new Event('online')); // une notification pendant la fin du rendu (online, ou la fin du rapatriement d'une AUTRE fiche)
      lever();
      const pPg = await prPg;
      scene.append(pPg);
      const zPg = pPg.querySelector('[data-role="zone-photo-plat"]');
      zPg.querySelector('[data-role="reessayer-photo"]').click();
      await attendre(() => !!pPg.querySelector('[data-role="photo-plat"] img'), 'l’image en tête après « Réessayer » (fiche à pages)');
      eq([zPg.textContent.includes('Photo du plat non récupérée.'), (await db.get('recipes', 'rc_pg')).photo_origin, f.posts], [false, 'web', 1],
        'fiche à pages : une notification arrivée pendant la fin du rendu ne perd pas la vue — « Réessayer » réussi redessine la zone et l’en-tête');
    });

    await blocR1('ronde 1 : redessins sérialisés (P-15) — un redessin lent qui finit après un plus récent ne laisse jamais la zone périmée', async ({ PP, repo, db, scene, mettre }) => {
      await mettre(fiche('rc_ser', { photo_source_url: 'https://cdn.test/ser.png' }));
      let bloquer = false; let lever; const barriere = new Promise((r) => { lever = r; }); let entre; const dans = new Promise((r) => { entre = r; });
      const repoS = { get: async (s, k) => { const r = await repo.get(s, k); if (bloquer && s === 'recipes' && k === 'rc_ser') { bloquer = false; entre(); await barriere; } return r; },
        getFile: (...a) => repo.getFile(...a), putFile: (...a) => repo.putFile(...a), saveBatch: (...a) => repo.saveBatch(...a) };
      const m = await PP.monterPhotoPlat(await db.get('recipes', 'rc_ser'), { sync: syncR1 }, { repo: repoS, pickFiles: async () => [], toast: () => {}, enLigne: () => true });
      scene.append(m.entete, m.zone);
      const cont = m.zone.querySelector('[data-role="zone-photo-plat"]');
      let dessins = 0; const vraiRemplacer = cont.replaceChildren;
      cont.replaceChildren = function (...a) { dessins += 1; return vraiRemplacer.apply(this, a); }; // propriété propre du nœud, jamais un prototype
      bloquer = true; window.dispatchEvent(new Event('online')); // redessin 1 : lit la fiche au cas 5, puis reste bloqué
      await dans;
      await mettre({ ...(await db.get('recipes', 'rc_ser')), photo_source_url: null }); // la fiche passe au cas 1
      window.dispatchEvent(new Event('online')); // redessin 2
      for (let i = 0; i < 30 && dessins < 1; i += 1) await new Promise((r) => setTimeout(r, 10)); // borné : un redessin NON sérialisé finirait ici
      lever();
      await attendre(() => dessins >= 2, 'les deux redessins finis');
      await tick();
      eq([cont.textContent.includes('Ajoute une photo du plat : elle illustre la recette dans tes listes.'), cont.textContent.includes('Photo du plat non récupérée.')], [true, false],
        'redessins sérialisés : la zone finit sur l’état relu le plus récent (cas 1), jamais sur celui du redessin lent (cas 5)');
    });

    await blocR1('ronde 1 : sans compte, et garde de compte refusée — « Réessayer » éteint, la bonne ligne dessous, une fois', async ({ PP, repo, db, mettre }) => {
      await mettre(fiche('rc_sc', { photo_source_url: 'https://cdn.test/sc.png' }), fiche('rc_gr', { photo_source_url: 'https://cdn.test/gr.png' }));
      const GARDE = 'Garde de compte refusée (test).';
      const CONNECTE = 'Connecte-toi pour utiliser l’assistant.';
      const monter = async (id, ctx) => PP.monterPhotoPlat(await db.get('recipes', id), ctx, { repo, pickFiles: async () => [], toast: () => {}, enLigne: () => true });
      const mSc = await monter('rc_sc', { sync: {} });
      const mGr = await monter('rc_gr', { sync: { user: null, guard: { ok: false, message: GARDE } } });
      const re = (m) => m.zone.querySelector('[data-role="reessayer-photo"]');
      const fois = (m, s) => m.zone.textContent.split(s).length - 1;
      eq([re(mSc)?.disabled, fois(mSc, CONNECTE), re(mGr)?.disabled, fois(mGr, GARDE), fois(mGr, CONNECTE)], [true, 1, true, 1, 0],
        'fiche montée sans compte (ctx.sync sans user) : « Réessayer » éteint et « Connecte-toi… » une fois ; garde de compte refusée : son message à la place (F-7), jamais « Connecte-toi… »');
    });

    await blocR1('ronde 1 : vue périmée — « Ne pas récupérer » et « Retirer » après qu’un autre onglet a posé une photo', async ({ PP, repo, db, scene, mettre }) => {
      const poserOctets = async (couleur) => { const j = await imageTest(couleur + '.jpg', couleur, 400, 300); const s = await sha256Hex(j); await repo.putFile(s, j, { mime: 'image/jpeg', origin: 'device' }); return s; };
      const shaA = await poserOctets('#a33'); const shaB = await poserOctets('#33a');
      await mettre(fiche('rc_vp', { photo_source_url: 'https://cdn.test/vp.png' }), fiche('rc_vr', { photo_sha256: shaA, photo_origin: 'image' }));
      const dits = [];
      const monter = async (id) => { const m = await PP.monterPhotoPlat(await db.get('recipes', id), { sync: syncR1 }, { repo, pickFiles: async () => [], toast: (x) => dits.push(x), enLigne: () => true }); scene.append(m.entete, m.zone); return m; };
      const mVp = await monter('rc_vp'); const mVr = await monter('rc_vr');
      const avantVp = !!mVp.zone.querySelector('[data-role="photo-web-etat"]')?.textContent.includes('Photo du plat non récupérée.');
      // un autre onglet (aucune notification d'un document à l'autre) pose une photo sur rc_vp et en met une autre sur rc_vr
      await mettre({ ...(await db.get('recipes', 'rc_vp')), photo_sha256: shaB, photo_origin: 'image', photo_source_url: null });
      await mettre({ ...(await db.get('recipes', 'rc_vr')), photo_sha256: shaB, photo_origin: 'photo' });
      await mVp.gestes.abandonner(); await mVr.gestes.retirer();
      const fVp = await db.get('recipes', 'rc_vp'); const fVr = await db.get('recipes', 'rc_vr');
      eq([avantVp, fVp.photo_sha256, fVp.photo_origin, fVr.photo_sha256, fVr.photo_origin, dits, etiquettes(mVp.zone), !!mVp.entete.querySelector('img')],
        [true, shaB, 'image', shaB, 'photo', [], ['Photographier', 'Choisir une image', 'Retirer'], true],
        'vue périmée : « Ne pas récupérer » (zone au cas 5) puis « Retirer » (photo A rendue) après qu’un autre onglet a posé une photo → rien d’effacé, aucun toast, la zone redessinée sur l’état relu');
    });

    await blocR1('ronde 1 : gestes et rapatriement aux bords — choix annulé, écriture qui lève, lecture qui lève, origine nulle, fiche reçue hors vocabulaire', async ({ PP, repo, db, journal, mettre }) => {
      const f = fauxFetchR1();
      const ctx = { sync: syncR1 };
      const comme = (over) => ({ get: (...a) => repo.get(...a), getFile: (...a) => repo.getFile(...a), putFile: (...a) => repo.putFile(...a), save: (...a) => repo.save(...a), saveBatch: (...a) => repo.saveBatch(...a), ...over });
      // un choix annulé (pickFiles ne se résout jamais, dom.js), puis un second « Choisir une image »
      await mettre(fiche('rc_pk'));
      let picks = 0; const imgPk = await imageTest('pk.jpg', '#c63', 640, 480);
      const mPk = await PP.monterPhotoPlat(await db.get('recipes', 'rc_pk'), ctx, { repo, pickFiles: () => { picks += 1; return picks === 1 ? new Promise(() => {}) : Promise.resolve([imgPk]); }, toast: () => {}, enLigne: () => true });
      mPk.gestes.choisir();
      await mPk.gestes.choisir();
      eq([picks, (await db.get('recipes', 'rc_pk')).photo_origin], [2, 'image'], 'un choix annulé ne fige pas la zone : un second « Choisir une image » rappelle pickFiles et pose la photo (occupe seulement APRÈS le choix)');
      // une écriture qui lève
      await mettre(fiche('rc_ew'));
      const panne = async () => { throw new Error('panne d’écriture'); };
      const repoE = comme({ save: panne, saveBatch: panne });
      const ditsE = [];
      const mE = await PP.monterPhotoPlat(await db.get('recipes', 'rc_ew'), ctx, { repo: repoE, pickFiles: async () => [await imageTest('ew.jpg', '#c63', 640, 480)], toast: (m) => ditsE.push(m), enLigne: () => true });
      journal.length = 0;
      await mE.gestes.choisir();
      const direct = await PP.poserPhotoPlat('rc_ew', await imageTest('ew2.jpg', '#36c', 640, 480), { repo: repoE, origin: 'image' });
      eq([ditsE, journal.some((l) => l.includes('photo_plat.pose')), direct, (await db.get('recipes', 'rc_ew')).photo_sha256 ?? null],
        [['La photo du plat n’a pas pu être changée. Réessaie.'], true, { issue: 'echec', raison: 'ecriture' }, null], 'une écriture qui lève : echec(ecriture), logError photo_plat.pose, le toast d’échec (jamais « Recette introuvable. »), rien d’écrit');
      // une lecture qui lève pendant la descente
      await mettre(fiche('rc_gl', { photo_source_url: 'https://cdn.test/gl.png' }));
      journal.length = 0;
      const lev = await Promise.allSettled([PP.rapatrierPhotoWeb('rc_gl', { ctx, repo: comme({ get: async () => { throw new Error('panne de lecture'); } }), fetch: f.fetch, enLigne: () => true })]);
      eq([lev[0].status, lev[0].value, journal.some((l) => l.includes('photo_web.echec')), PP.recuperationEnCours('rc_gl')], ['fulfilled', { issue: 'echec', raison: 'interne' }, true, false],
        'une lecture qui lève pendant la descente : la promesse se RÉSOUT en echec(interne), photo_web.echec journalisé, le vol est rendu (I-F4, P-17)');
      // un pointeur valide d'origine NULLE (photo d'avant le lot, P-6) : la photo de la personne (D-F10)
      await mettre(fiche('rc_on', { photo_sha256: H('e'), photo_origin: null, photo_source_url: 'https://cdn.test/on.png' }));
      const avantOn = f.posts;
      const rOn = await PP.rapatrierPhotoWeb('rc_on', { candidat: 'https://cdn.test/autre.png', ctx, repo, fetch: f.fetch, enLigne: () => true });
      const fOn = await db.get('recipes', 'rc_on');
      eq([rOn, f.posts - avantOn, fOn.photo_sha256, fOn.photo_origin], [{ issue: 'refuse', raison: 'photo_manuelle' }, 0, H('e'), null], 'D-F10 : un pointeur valide d’origine NULLE compte comme la photo de la personne — photo_manuelle, zéro POST, pointeur intact');
      // une fiche reçue dont un AUTRE champ est hors vocabulaire (source_kind d'une version plus récente)
      await mettre(fiche('rc_vk', { source_kind: 'pdf', photo_source_url: 'https://cdn.test/vk.png' }), fiche('rc_vk2', { source_kind: 'pdf' }));
      const rVk = await PP.rapatrierPhotoWeb('rc_vk', { ctx, repo, fetch: f.fetch, enLigne: () => true });
      const fVk = await db.get('recipes', 'rc_vk');
      const rVk2 = await PP.poserPhotoPlat('rc_vk2', await imageTest('vk.jpg', '#c63', 640, 480), { repo, origin: 'photo' });
      const rVk3 = await PP.retirerPhotoPlat('rc_vk2', { repo });
      eq([rVk.issue, fVk.source_kind, fVk.photo_origin, rVk2.issue, rVk3.issue], ['ok', 'pdf', 'web', 'ok', 'ok'],
        'une fiche reçue dont un AUTRE champ est hors vocabulaire : rapatrier, poser et retirer aboutissent — seul ce qui est écrit passe le vocabulaire (aucun appel payé pour une écriture impossible)');
    }, { journal: true });

    await blocR1('ronde 1 : photo WEB aux octets distants — après « Télécharger », l’image ET sa légende (§ 4.1.4)', async ({ repo, db, scene }) => {
      const { renderRecipe } = await import('../src/ui/recipe.js');
      const jpegL = await imageTest('l.jpg', '#c63', 320, 240);
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'image/jpeg', size: jpegL.size, updated_at: DATE, remote: { sha256: H('7'), size: jpegL.size, mime: 'image/jpeg', quality: 'reduite', uploaded_at: DATE, owner: 'u1' } }] }, origin: 'remote' });
      const moteur = { telecharger: async () => { const ligne = await db.get('files', H('7')); await db.mutate({ puts: { files: [{ ...ligne, blob: jpegL }] }, origin: 'remote' }); return { recus: 1, erreurs: 0, erreur: null }; },
        reessayerFichier: async () => ({ recus: 0, erreurs: 0, erreur: null }), onEtat: () => () => {} };
      await db.mutate({ puts: { recipes: [fiche('rc_lg', { source_url: 'https://recettes.test/x', photo_sha256: H('7'), photo_origin: 'web', photo_source_url: 'https://cdn.test/lg.jpg' })], recipe_versions: [version('rc_lg')] }, origin: 'device' });
      const p = await renderRecipe({ id: 'rc_lg' }, {}, await ctxPour(repo, db, { sync: { user: { id: 'u1' }, moteur } }));
      scene.append(p);
      const tete = p.querySelector('[data-role="photo-plat"]');
      const avant = tete?.querySelector('[data-role="legende-photo-plat"]') ?? null;
      [...tete.querySelectorAll('button')].find((b) => b.textContent === 'Télécharger').click();
      await attendre(() => !!tete.querySelector('img'), 'image en tête après « Télécharger »');
      eq([avant, tete.querySelector('[data-role="legende-photo-plat"]')?.textContent], [null, 'Image de la page recettes.test'], 'photo web aux octets distants : la légende arrive AVEC l’image, après « Télécharger » (calculée dans le redessin de la figure)');
    });

    // ===== Tâche 4 — les cartes illustrées (spec § 4.2)
    await run('recipeCard : la carte sans photo est celle d’avant le lot (référence construite dans le test, spec § 7.4 ; R-F-7)', () => withRepo(async () => {
      const K = await import('../src/ui/components.js');
      const { el } = await import('../src/core/dom.js');
      // La référence est CONSTRUITE ici, jamais relevée en littéral (R-F-7 : le lanceur coupe un échec à 400 caractères). La carte AVEC photo, rendue
      // par le MÊME composant et privée de sa vignette, doit être EXACTEMENT la carte sans photo ; un gabarit explicite borne ce que le composant ne
      // peut pas comparer à lui-même (une enveloppe, une classe, un style ou un enfant posés sur TOUTES les cartes). Pointeur valide sans ligne files
      // (base jetable) : la carte est lue de façon SYNCHRONE, la vignette encore née cachée, sans src. Ronde 1 : comparaison et gabarit couvrent CHAQUE
      // branche de recipeCard (favori, cuisinée, version avec durées, livre et édition, lien web, raisons, extra et href, fiche IA) ; une fiche minimale
      // laissait passer un badge retiré « quand la photo est là » (★ Favori) ou un style de .col changé pour toutes les cartes.
      const base = { id: 'rc_k', original_title: 'Tarte', availability: 'available', favorite: false };
      const duree = { id: 'rv_k', recipe_id: 'rc_k', kind: 'extraction', prep_minutes: 10, cook_minutes: 20, active_minutes: 15, total_minutes: 30, provenance: { generated_by: 'manual' } };
      const creation = { ...duree, kind: 'synthesis', status: 'proposed', provenance: { generated_by: 'ai', creation: { demande: 'tarte' } } };
      const CAS = [
        ['minimale', { recipe: base, version: null, book: null, edition: null }, () => ({})],
        ['favorite, cuisinée, durées, livre', { recipe: { ...base, favorite: true, edition_id: 'ed_k', printed_page: 12 }, version: duree, book: { id: 'b_k', title: 'Livre', author: 'Autrice' }, edition: { id: 'ed_k', book_id: 'b_k' }, cooked: 3 }, () => ({})],
        ['lien web, raisons, extra, href', { recipe: { ...base, availability: 'reference_only', source_url: 'https://recettes.test/tarte' }, version: null, book: null, edition: null },
          () => ({ reasons: ['pomme', 'beurre'], href: '#/ailleurs', extra: el('div', { class: 'stack' }, 'En plus') })],
        ['fiche IA', { recipe: { ...base, origine: 'ia' }, version: creation, book: null, edition: null }, () => ({})],
      ];
      const carte = (doc, opts, photo) => K.recipeCard(photo === undefined ? doc : { ...doc, recipe: { ...doc.recipe, photo_sha256: photo } }, opts());
      const v = carte(CAS[0][1], CAS[0][2], H('f')).querySelector('.col')?.firstElementChild;
      eq([v?.tagName, v?.className, v?.getAttribute('alt'), v?.getAttribute('loading'), v?.hidden, v?.hasAttribute('src')], ['IMG', 'plat-vignette', '', 'lazy', true, false],
        'recipeCard avec un pointeur valide : la vignette est le PREMIER enfant de .col — img.plat-vignette, alt vide, loading lazy, née cachée, sans src');
      const privee = (c) => { const r = c.cloneNode(true); r.querySelector('.col > img.plat-vignette')?.remove(); return r; };
      eq(CAS.map(([nom, doc, opts]) => { const sans = carte(doc, opts); return [nom, sans.outerHTML === privee(carte(doc, opts, H('f'))).outerHTML, carte(doc, opts, 'pas une empreinte').outerHTML === sans.outerHTML]; }),
        CAS.map(([nom]) => [nom, true, true]),
        'recipeCard sans photo (ou à pointeur hostile), chaque branche : son balisage est EXACTEMENT celui de la carte avec photo privée de sa vignette (référence construite)');
      const gabarit = (c) => { const col = c.querySelector('.col'); const rangee = col?.parentElement;
        return [c.className, c.getAttribute('href'), rangee?.className, rangee?.getAttribute('style'), rangee?.parentElement === c, rangee?.firstElementChild?.getAttribute('style'),
          col?.className, col?.getAttribute('style'), [...(col?.children || [])].map((x) => x.className).join('|'), c.querySelectorAll('img').length]; };
      const RANGEE = ['row between top', null, true, 'flex: 1 1 0%; min-width: 0px;', 'col', 'align-items: flex-end; gap: 0.3rem;'];
      eq(CAS.map(([, doc, opts]) => gabarit(carte(doc, opts))),
        [['item-link card', '#/recipes/rc_k', ...RANGEE, 'badge available', 0], ['item-link card', '#/recipes/rc_k', ...RANGEE, 'badge available|badge|badge', 0],
          ['item-link card', '#/ailleurs', ...RANGEE, 'badge reference', 0], ['item-link card', '#/recipes/rc_k', ...RANGEE, 'badge available', 0]],
        'recipeCard sans photo (gabarit explicite, chaque branche) : classe et href de la carte ; .row.between.top sans style, enfant direct de la carte ; bloc de gauche flex 1 ; .col, son style d’avant le lot, ses enfants (badges) ; aucune img');
    }));

    await run('cartes : vignettePlat, recipeCard avec photo, renderMeal, révocation au redessin (§ 4.2)', () => withRepo(async (repo, db) => {
      const K = await import('../src/ui/components.js');
      const { renderMeal } = await import('../src/ui/meals.js');
      const { renderSearch } = await import('../src/ui/search.js');
      const { renderBook } = await import('../src/ui/book.js');
      const { buildDocs } = await import('../src/domain/search.js');
      const BU = await import('../src/core/blob-urls.js');
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      // Ronde 1 (I-F3) : chaque fiche à vignette porte aussi l'adresse de son image web ; une vignette ne la prend jamais pour src (blob: seulement).
      const WEB = { photo_origin: 'web', photo_source_url: 'https://exemple.test/a.jpg' };
      const enBlob = (n) => (n.matches('img.plat-vignette') ? [n] : [...n.querySelectorAll('img.plat-vignette')]).map((i) => (i.getAttribute('src') || '').startsWith('blob:'));
      try {
        const jpeg1 = await imageTest('v1.jpg', '#c63', 320, 240); const sha1 = await sha256Hex(jpeg1);
        const jpeg2 = await imageTest('v2.jpg', '#36c', 320, 240); const sha2 = await sha256Hex(jpeg2);
        await repo.putFile(sha1, jpeg1, { mime: 'image/jpeg', origin: 'device' }); await repo.putFile(sha2, jpeg2, { mime: 'image/jpeg', origin: 'device' });
        await db.mutate({ puts: { files: [
          { sha256: H('1'), mime: 'text/html', blob: new Blob(['<p>x</p>'], { type: 'text/html' }), size: 8, syncable: false, created_at: DATE, updated_at: DATE },
          { sha256: H('2'), mime: 'application/pdf', blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), size: 8, syncable: true, created_at: DATE, updated_at: DATE },
          { sha256: H('3'), mime: 'image/heic', blob: jpeg1, size: jpeg1.size, syncable: true, created_at: DATE, updated_at: DATE },
          { sha256: H('4'), mime: 'image/jpeg', blob: new Blob([Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4)], { type: 'image/jpeg' }), size: 8, syncable: true, created_at: DATE, updated_at: DATE },
        ] }, origin: 'device' });
        const v1 = K.vignettePlat({ photo_sha256: sha1, ...WEB }, { repo });
        await attendre(() => !v1.hidden, 'octets lus (v1)');
        eq([v1.tagName, v1.className, v1.getAttribute('alt'), v1.getAttribute('src')?.startsWith('blob:'), v1.getAttribute('loading')], ['IMG', 'plat-vignette', '', true, 'lazy'], 'vignettePlat : pointeur + octets → img.plat-vignette visible, src blob:, alt vide (décorative)');
        // Ronde 1 (R-F-10 levée pour ces quatre) : les lectures passent par le dépôt INJECTÉ (un espion le prouve) et les négatives attendent la FIN de
        // LEURS lectures (Promise.allSettled), plus l'achèvement d'une autre : aucune hypothèse sur l'ordre des transactions IndexedDB.
        const lectures = []; const espion = { getFile: (s) => { const q = repo.getFile(s); lectures.push(q); return q; } };
        const vSans = K.vignettePlat({ photo_sha256: H('9') }, { repo: espion }); const vHtml = K.vignettePlat({ photo_sha256: H('1') }, { repo: espion });
        const vPdf = K.vignettePlat({ photo_sha256: H('2') }, { repo: espion }); const vHeic = K.vignettePlat({ photo_sha256: H('3') }, { repo: espion });
        await attendre(() => lectures.length === 4, 'les quatre lectures passent par le dépôt injecté');
        await Promise.allSettled(lectures); await tick(); await tick();
        eq([vSans.hidden, vSans.hasAttribute('src'), vHtml.hidden, vHtml.hasAttribute('src'), vPdf.hidden, vPdf.hasAttribute('src'), vHeic.hidden], [true, false, true, false, true, false, false],
          'vignettePlat : sans octets → cachée, sans src ; text/html → cachée ; application/pdf (liste blanche, pas une image) → cachée ; ligne image/heic à blob image/jpeg → visible (le type du blob gagne, G)');
        eq([K.vignettePlat({}), K.vignettePlat({ photo_sha256: '../x' }), K.vignettePlat(null), K.vignettePlat({ photo_sha256: 'g'.repeat(64) }), K.vignettePlat({ photo_sha256: 'A'.repeat(64) })], [null, null, null, null, null],
          'vignettePlat : sans pointeur valide → null (rien, ni pictogramme ni cadre) ; 64 caractères non hexadécimaux, ou en capitales → null (la garde HASH, pas la seule longueur)');
        // Ronde 1 (I-F6) : des octets sous un type d'image que le navigateur ne décode pas → error : la vignette redevient cachée, sans src, son URL
        // révoquée ; jamais un cadre vide de 72 px. Hors du document, « lazy » ne chargerait jamais : le test passe l'élément en eager pour que le
        // navigateur décode vraiment. L'écouteur du test est posé AVANT celui du composant : il lit le src avant que le composant ne le retire.
        const vCasse = K.vignettePlat({ photo_sha256: H('4') }, { repo });
        vCasse.loading = 'eager';
        let urlCasse = null; let minuterie = null;
        await new Promise((resoudre, rejeter) => {
          vCasse.addEventListener('error', () => { urlCasse = vCasse.getAttribute('src'); resoudre(); }, { once: true });
          minuterie = setTimeout(() => rejeter(new Error('attente dépassée (3 s) : error de la vignette indécodable')), 3000);
        });
        clearTimeout(minuterie); await tick();
        eq([vCasse.hidden, vCasse.hasAttribute('src'), typeof urlCasse === 'string' && urlCasse.startsWith('blob:'), BU.revoquerUrlDeBlob(urlCasse)], [true, false, true, false],
          'vignettePlat : octets indécodables sous un type image → error : cachée, sans src, son URL déjà révoquée (aucun cadre vide, I-F6)');
        // La carte SANS photo : bloc « recipeCard : référence construite » (R-F-7). Ici, la carte AVEC photo.
        const doc = { recipe: { id: 'rc_k', original_title: 'Tarte', availability: 'available', favorite: false }, version: null, book: null, edition: null };
        const avec = K.recipeCard({ ...doc, recipe: { ...doc.recipe, photo_sha256: sha1, ...WEB } });
        eq([avec.querySelector('.col')?.firstElementChild?.className, avec.querySelector('.col')?.children[1]?.classList.contains('badge')], ['plat-vignette', true], 'recipeCard avec photo : la vignette est le premier enfant de .col, avant le badge');
        await attendre(() => avec.querySelector('img.plat-vignette')?.hidden === false, 'vignette de la carte');
        const recA = fiche('rc_m1', { photo_sha256: sha1, ...WEB }); const recB = fiche('rc_m2');
        const meal = { id: 'm1', title: 'Souper', servings: 2, items: [{ id: 'mi1', recipe_id: 'rc_m1', recipe_version_id: null, role: 'plat_principal', servings: 2, locked: false }, { id: 'mi2', recipe_id: 'rc_m2', recipe_version_id: null, role: 'accompagnement', servings: 2, locked: false }], constraints_snapshot: { diets: [] } };
        const ctxRepas = (recs, m) => ({ meals: [m], recipesById: new Map(recs.map((r) => [r.id, r])), versionsById: new Map(), editionsById: new Map(), editionLabel: () => '', ingredientsById: ING, meal_feedback: [], docs: [], docsByRecipe: new Map(), settings: {} });
        const repas = await renderMeal({ id: 'm1' }, {}, ctxRepas([recA, recB], meal));
        scene.append(repas);
        const cartes = [...repas.querySelectorAll('.card.flat.stack')];
        await attendre(() => !!cartes[0]?.querySelector('img.plat-vignette:not([hidden])'), 'vignette du repas');
        const gauche = (c) => c.querySelector(':scope > .row.between.top')?.firstElementChild;
        // Ronde 1 : l'enveloppe ET le bloc à côté de la vignette portent flex 1 / min-width 0 (le titre reste à droite, mesuré ci-dessous) ; sans photo,
        // le bloc de gauche est celui d'avant le lot : un div sans classe NI style, dont le premier enfant est le lien du titre.
        const [g0, g1] = [gauche(cartes[0]), gauche(cartes[1])];
        eq([g0?.className, g0?.getAttribute('style'), g0?.firstElementChild?.className, g0?.children[1]?.getAttribute('style'), g0?.children[1]?.firstElementChild?.tagName,
          g1?.className, g1?.getAttribute('style'), g1?.firstElementChild?.tagName, g1?.querySelector('img')],
        ['row top', 'flex: 1 1 0%; min-width: 0px;', 'plat-vignette', 'flex: 1 1 0%; min-width: 0px;', 'A', '', null, 'A', null],
        'renderMeal : la vignette à gauche du titre avec octets (enveloppe et bloc en flex 1, min-width 0) ; sans photo, le bloc de gauche est celui d’avant le lot (div sans classe ni style, le lien du titre en tête)');
        eq([v1, avec, repas].flatMap(enBlob), [true, true, true], 'I-F3 : chaque vignette rendue (vignettePlat, recipeCard, renderMeal) a un src blob:, jamais l’adresse web de la fiche (photo_source_url)');
        // Ronde 1 (D-F9) : la vignette reste À GAUCHE d'un titre long, mesurée avec la VRAIE feuille, injectée dans une racine fantôme (la page de tests ne
        // charge que tests.css ; la racine borne la feuille à cette scène), à 375 px : l'enveloppe .row a flex-wrap, et un bloc sans flex 1 / min-width 0
        // passait SOUS la vignette dès que le titre ne tenait plus sur sa ligne.
        const hote = document.createElement('div'); hote.style.cssText = 'position:absolute;left:-10000px;top:0;width:375px'; document.body.append(hote);
        try {
          const ombre = hote.attachShadow({ mode: 'open' });
          const feuille = document.createElement('link'); feuille.rel = 'stylesheet'; feuille.href = new URL('../styles.css', import.meta.url).href;
          await new Promise((r) => { feuille.onload = r; feuille.onerror = r; ombre.append(feuille); });
          const recLong = fiche('rc_m3', { original_title: 'Tarte fine aux pommes, crème brûlée et caramel salé', photo_sha256: sha1 });
          const repasLong = await renderMeal({ id: 'm2' }, {}, ctxRepas([recLong], { ...meal, id: 'm2', items: [{ ...meal.items[0], id: 'mi3', recipe_id: 'rc_m3' }] }));
          ombre.append(repasLong);
          const carteLongue = repasLong.querySelector('.card.flat.stack');
          await attendre(() => !!carteLongue?.querySelector('img.plat-vignette:not([hidden])'), 'vignette du repas (titre long)');
          const [vi, bl] = [...gauche(carteLongue).children].map((n) => n.getBoundingClientRect());
          eq([Math.round(vi.width), bl.left >= vi.right, Math.abs(bl.top - vi.top) < 1], [72, true, true],
            'renderMeal (styles.css, 375 px, titre long) : la vignette fait 72 px et le bloc du titre reste À DROITE d’elle, au même haut (D-F9)');
        } finally { hote.remove(); }
        const recettes = [fiche('rc_s1', { original_title: 'Tarte aux pommes', photo_sha256: sha1, ...WEB }), fiche('rc_s2', { original_title: 'Tarte aux poires', photo_sha256: sha2, ...WEB })];
        const docs = buildDocs({ recipes: recettes, versions: recettes.map((r) => version(r.id)), editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
        const ctxR = await ctxPour(repo, db, { docs, docsByRecipe: new Map(docs.map((d) => [d.recipe.id, d])) });
        BU.revoquerUrlsDeBlob();
        // L'espion note chaque révocation ET si l'URL est encore sous un <img> du document à cet instant (D-T9 : révoquer APRÈS le vidage) ; il est
        // vidé juste avant chaque geste : le compte est EXACT. Ronde 1 : une URL suivie VIVANTE qui n'est pas une vignette (sentinelle), posée juste
        // avant chaque geste, doit le rester — « tout révoquer » passait tant que les vignettes étaient les seules URL blob: vivantes de la route.
        const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
        const dansLeDocument = (u) => [...document.querySelectorAll('img')].some((i) => i.getAttribute('src') === u);
        URL.revokeObjectURL = (u) => { revoquees.push({ u, encore: dansLeDocument(u) }); return vraiRevoke.call(URL, u); };
        const srcs = (n) => [...n.querySelectorAll('img.plat-vignette')].map((i) => i.getAttribute('src'));
        const toutesPretes = (n, k) => { const s = srcs(n); return s.length === k && s.every((u) => typeof u === 'string' && u.startsWith('blob:')); };
        try {
          const rs = await renderSearch({}, { mode: 'recipes' }, ctxR, { navigate: () => {}, remplacerAdresse: () => {} });
          scene.append(rs);
          await attendre(() => toutesPretes(rs, 2), 'chaque vignette de la recherche a son src');
          const avant = srcs(rs);
          const sentinelle = BU.urlDeBlob(new Blob(['sentinelle']));
          revoquees.length = 0;
          bouton(rs, 'Chercher').click();
          await attendre(() => revoquees.length >= avant.length, 'révocations du redessin (recherche)');
          const bilan = [revoquees.map((x) => x.u).sort(), revoquees.filter((x) => x.encore).length];
          eq([...bilan, BU.revoquerUrlDeBlob(sentinelle)], [[...avant].sort(), 0, true],
            'renderSearch : un redessin révoque EXACTEMENT les URL des vignettes précédentes (compte exact), chacune APRÈS le vidage (plus sous un img du document, D-T9) ; la sentinelle reste vivante');
          const edition = { id: 'ed_v', book_id: 'b_v', language: 'fr', cover_sha256: sha1, updated_at: DATE }; const livre = { id: 'b_v', title: 'Livre', updated_at: DATE };
          const recLivre = [fiche('rc_l1', { edition_id: 'ed_v', original_title: 'Tarte', photo_sha256: sha1, ...WEB }), fiche('rc_l2', { edition_id: 'ed_v', original_title: 'Tourte', photo_sha256: sha2, ...WEB })];
          await db.mutate({ puts: { books: [livre], book_editions: [edition], recipes: recLivre, recipe_versions: recLivre.map((r) => version(r.id)) }, origin: 'device' });
          const rb = await renderBook({ id: 'ed_v' }, {}, await ctxPour(repo, db, { editionsById: new Map([['ed_v', edition]]), booksById: new Map([['b_v', livre]]), books: [livre], book_editions: [edition] }));
          scene.append(rb);
          await attendre(() => toutesPretes(rb, 2), 'chaque vignette du livre a son src');
          const avantL = srcs(rb);
          const couvertures = [...rb.querySelectorAll('img:not(.plat-vignette)')].map((i) => i.getAttribute('src')).filter((u) => typeof u === 'string' && u.startsWith('blob:'));
          ok(couvertures.length >= 1, 'fixture : la fiche du livre affiche sa couverture sous une URL blob: suivie, encore sous un img au moment du filtre');
          const sentinelleL = BU.urlDeBlob(new Blob(['sentinelle']));
          const filtre = rb.querySelector('input[type="search"]');
          revoquees.length = 0;
          filtre.value = 'ta'; filtre.dispatchEvent(new Event('input', { bubbles: true }));
          await attendre(() => revoquees.length >= avantL.length, 'révocations du redessin (livre)');
          const bilanL = [revoquees.map((x) => x.u).sort(), revoquees.filter((x) => x.encore).length];
          eq([...bilanL, BU.revoquerUrlDeBlob(sentinelleL)], [[...avantL].sort(), 0, true],
            'book.js drawList : le filtre redessine et révoque EXACTEMENT les URL des vignettes précédentes, APRÈS le vidage ; la couverture et la sentinelle restent vivantes');
        } finally { URL.revokeObjectURL = vraiRevoke; }
      } finally { globalThis.fetch = vraiFetch; scene.remove(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));

    await run('styles.css : la règle .plat-vignette (D-F9 ; T-1, T-2 ; P-21)', async () => {
      // Lue SANS ses commentaires : le commentaire posé juste avant la règle (Step 4) ne la masque pas. Une règle introuvable est un rouge NOMMÉ.
      const css = (await lire('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
      const regle = css.match(/(?:^|\})\s*\.plat-vignette\s*\{([^}]*)\}/)?.[1] ?? '';
      ok(regle.trim() !== '', 'styles.css : la règle .plat-vignette est trouvée');
      const decl = Object.fromEntries(regle.split(';').map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]).filter(([k, v]) => k && v));
      eq([decl.width, decl.height, decl['object-fit'], decl['border-radius'], decl.border, decl.flex], ['72px', '72px', 'cover', '8px', '1px solid var(--line)', '0 0 auto'], 'styles.css : .plat-vignette 72 × 72, object-fit cover, coins 8 px, bord var(--line), flex 0 0 auto (D-F9)');
      ok(regle.trim() !== '' && !/display\s*:\s*none/.test(regle) && !/#[0-9a-f]{3,8}\b/i.test(regle), 'styles.css : la règle est lue, et elle ne porte ni display:none ni couleur en dur (T-1, T-2 : tests/theme.js inchangé)');
      // Ronde 1 : la PREMIÈRE règle seule était lue — une règle plus loin (`.card .plat-vignette { width: 160px }`) la surchargeait sans rouge. UI-1 T2 (F-7, K-2) :
      // deux règles neuves la complètent, `.grande` (carte-plat, 4:3 ; la MÊME règle que UI-2, au caractère près : R-UI1-1) et `.petite` (48 px, ligne compacte
      // de la fiche livre) — EXACTEMENT trois sélecteurs, dans cet ordre (UI-2 en épingle deux : à la fusion, cette version à trois vaut).
      eq([...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => /\.plat-vignette\b/.test(s)), ['.plat-vignette', '.plat-vignette.grande', '.plat-vignette.petite'],
        'styles.css : exactement trois sélecteurs nomment .plat-vignette — la règle 72 px, puis .grande et .petite, dans cet ordre (aucune surcharge ailleurs)');
    });

    await run('CSP et sources (I-F3, I-F8, D-F11)', async () => {
      const [srcPP, srcK, srcMeals, srcPW, srcB64, srcRecipe, index] = await Promise.all(['../src/ui/photo-plat.js', '../src/ui/components.js', '../src/ui/meals.js', '../src/domain/photo-web.js', '../src/domain/base64.js', '../src/ui/recipe.js', '../index.html'].map(lire));
      const csp = /Content-Security-Policy" content="([^"]+)"/.exec(index)?.[1] || '';
      eq(/img-src ([^;]+)/.exec(csp)?.[1], "'self' blob: data:", 'CSP : img-src inchangée (aucune image externe chargée par le navigateur)');
      eq([srcPP, srcK, srcMeals].map((s) => /(?:\bsrc\s*:|\.src\s*=)\s*['"`]https?:/.test(s)), [false, false, false], 'aucun src d’image ne reçoit une adresse http(s) écrite en dur (photo-plat.js, components.js, meals.js)');
      eq([srcPP, srcPW, srcB64].map((s) => /Anthropic|Supabase/.test(s)), [false, false, false], 'aucun texte ne nomme le fournisseur ni la base (photo-plat.js, photo-web.js, base64.js)');
      eq([srcPP, srcRecipe].flatMap((s) => s.split('\n').filter((l) => l.includes('photo_source_url') && /textContent|\bt\(|\bel\(/.test(l))), [], 'D-F11 : photo_source_url n’entre dans aucune ligne qui porte textContent, t( ou el( (photo-plat.js, recipe.js)');
    });

    // ===== Tâche 5 — régression (spec § 7.4 « Régression », § 3.1 ; P-11)
    await run('régression : « Corriger » relit la photo (D-F16, D-F19), archive aller-retour, capture et envoi', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const { renderRecipeEdit } = await import('../src/ui/recipe-edit.js');
      const { createArchive, inspectArchive, applyArchive, verifyRestored } = await import('../src/domain/backup.js');
      const { createPush } = await import('../src/sync/push.js');
      const { creerTransportFactice } = await import('./transport-factice.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const adresseAvant = location.href;
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try {
        const jpeg = await imageTest('c.jpg', '#c63', 640, 480); const sha = await sha256Hex(jpeg);
        await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
        const idsDe = async (rid) => new Set((await db.byIndex('recipe_versions', 'recipe_id', rid)).map((v) => v.id));
        // « Corriger » joué PAR l'éditeur : rendu, geste éventuel pendant l'édition, « Enregistrer une nouvelle version » ; l'adresse posée par la
        // navigation est rendue (motif de tests/import-cible.js, Review Focus 5 du lot A).
        // Ronde 1 : `kind` 'adaptation' (« Créer ma version ») joue le même chemin d'écriture, changements saisis.
        const corriger = async (rid, pendantEdition = async () => {}, kind = 'correction') => {
          const ed = await renderRecipeEdit({ id: rid }, { kind }, await ctxPour(repo, db)); scene.append(ed);
          if (kind === 'adaptation') { const z = [...ed.querySelectorAll('label')].find((l) => l.textContent.includes('Résumé des changements'))?.querySelector('textarea'); z.value = 'Moins de sel.'; z.dispatchEvent(new Event('input', { bubbles: true })); }
          await pendantEdition();
          const avant = await idsDe(rid);
          bouton(ed, 'Enregistrer une nouvelle version').click();
          await attendre(async () => (await idsDe(rid)).size === avant.size + 1, 'version écrite (' + rid + ')');
          await tick(); history.replaceState(null, '', adresseAvant); ed.remove();
          return db.get('recipes', rid);
        };
        // 1. Une fiche à photo garde ses trois champs (garde de régression : verte avant le changement).
        await db.mutate({ puts: { recipes: [fiche('rc_k1', { source_url: 'https://site.test/k1', photo_sha256: sha, photo_origin: 'web', photo_source_url: 'https://cdn.test/k1.jpg' })], recipe_versions: [version('rc_k1')] }, origin: 'device' });
        const k1 = await corriger('rc_k1');
        eq([k1.photo_sha256, k1.photo_origin, k1.photo_source_url], [sha, 'web', 'https://cdn.test/k1.jpg'], '« Corriger » sur une fiche à photo : la fiche écrite garde photo_sha256, photo_origin, photo_source_url');
        // 2. D-F16 (rouge d'abord) : une photo écrite en base PENDANT l'édition (descente web, autre onglet) survit à « Enregistrer ».
        await db.mutate({ puts: { recipes: [fiche('rc_k2', { photo_source_url: 'https://cdn.test/k2.jpg' })], recipe_versions: [version('rc_k2')] }, origin: 'device' });
        const k2 = await corriger('rc_k2', async () => { await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_k2')), photo_sha256: sha, photo_origin: 'web' }] }, origin: 'device' }); });
        eq([k2.photo_sha256, k2.photo_origin, k2.photo_source_url], [sha, 'web', 'https://cdn.test/k2.jpg'], 'D-F16 : éditeur rendu, puis une photo écrite en base, puis « Enregistrer » → la fiche écrite porte les trois champs de la BASE');
        // 3. D-F19 (rouge d'abord) : une origine hors liste relue se lit null, sans lever.
        await db.mutate({ puts: { recipes: [fiche('rc_k3', { photo_sha256: sha, photo_origin: 'appareil' })], recipe_versions: [version('rc_k3')] }, origin: 'device' });
        const k3 = await corriger('rc_k3');
        eq([k3.photo_sha256, k3.photo_origin], [sha, null], 'D-F19 : « Corriger » d’une fiche relue avec photo_origin « appareil » ne lève pas ; photo_origin null écrit, le pointeur gardé');
        // 4. P-6 : une fiche d'avant le lot ne gagne aucune clé de photo (garde de régression).
        await db.mutate({ puts: { recipes: [fiche('rc_k4')], recipe_versions: [version('rc_k4')] }, origin: 'device' });
        const k4 = await corriger('rc_k4');
        eq(['photo_sha256', 'photo_origin', 'photo_source_url'].map((k) => Object.hasOwn(k4, k)), [false, false, false], '« Corriger » d’une fiche d’avant le lot : aucune clé de photo ajoutée (P-6)');
        // Ronde 1 — 2 bis. D-F16, chacun des TROIS champs vient de la base : « Retirer » pendant l'édition (trois champs à null en base, la copie porte une
        // photo web ET son adresse) → la fiche écrite n'en garde aucun.
        await db.mutate({ puts: { recipes: [fiche('rc_k5', { photo_sha256: sha, photo_origin: 'web', photo_source_url: 'https://cdn.test/k5.jpg' })], recipe_versions: [version('rc_k5')] }, origin: 'device' });
        const k5 = await corriger('rc_k5', async () => { await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_k5')), photo_sha256: null, photo_origin: null, photo_source_url: null }] }, origin: 'device' }); });
        eq([k5.photo_sha256, k5.photo_origin, k5.photo_source_url], [null, null, null], 'D-F16 : « Retirer » pendant l’édition (trois champs à null en base) → la fiche écrite porte les trois nuls de la BASE, pas l’adresse de la copie');
        // Ronde 1 — 4 bis. P-6, la clé absente en base l'est de l'écriture : la copie porte photo_source_url, la fiche est réécrite SANS la clé pendant l'édition
        // (un appareil plus ancien) → la fiche écrite ne la porte pas.
        await db.mutate({ puts: { recipes: [fiche('rc_k6', { photo_source_url: 'https://cdn.test/k6.jpg' })], recipe_versions: [version('rc_k6')] }, origin: 'device' });
        const k6 = await corriger('rc_k6', async () => { const { photo_source_url: _ancienne, ...sans } = await db.get('recipes', 'rc_k6'); await db.mutate({ puts: { recipes: [sans] }, origin: 'device' }); });
        eq(['photo_sha256', 'photo_origin', 'photo_source_url'].map((k) => Object.hasOwn(k6, k)), [false, false, false], 'P-6 : la copie porte photo_source_url, la base ne la porte plus → la fiche écrite ne la porte pas (aucune clé de la copie recopiée)');
        // Ronde 1 — 2 ter. « Créer ma version » (adaptation) écrit aussi la fiche : une photo écrite en base pendant l'édition survit de même.
        await db.mutate({ puts: { recipes: [fiche('rc_k7', { photo_source_url: 'https://cdn.test/k7.jpg' })], recipe_versions: [version('rc_k7')] }, origin: 'device' });
        const k7 = await corriger('rc_k7', async () => { await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_k7')), photo_sha256: sha, photo_origin: 'web' }] }, origin: 'device' }); }, 'adaptation');
        eq([k7.photo_sha256, k7.photo_origin, k7.photo_source_url, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_k7')).some((v) => v.kind === 'adaptation')], [sha, 'web', 'https://cdn.test/k7.jpg', true], 'D-F16 (adaptation) : « Créer ma version » après une photo écrite en base pendant l’édition → la fiche écrite porte les trois champs de la BASE');
        // Ronde 1 — 2 quater. D-F16 DANS la transaction : une écriture de la photo qui s'engage APRÈS les lectures de save() et juste avant sa transaction
        // (la descente d'un rapatriement, ecrireChamps) n'est pas écrasée — l'espion de db.mutate la joue au premier appel qui écrit la version de rc_k8.
        await db.mutate({ puts: { recipes: [fiche('rc_k8', { photo_source_url: 'https://cdn.test/k8.jpg' })], recipe_versions: [version('rc_k8')] }, origin: 'device' });
        const vraiMutate = db.mutate; let injectees = 0;
        db.mutate = async (o) => {
          if (!injectees && (o?.puts?.recipe_versions || []).some((v) => v.recipe_id === 'rc_k8')) { injectees += 1; await vraiMutate.call(db, { puts: { recipes: [{ ...(await db.get('recipes', 'rc_k8')), photo_sha256: sha, photo_origin: 'web' }] }, origin: 'device' }); }
          return vraiMutate.call(db, o);
        };
        let k8;
        try { k8 = await corriger('rc_k8'); } finally { db.mutate = vraiMutate; }
        eq([injectees, k8.photo_sha256, k8.photo_origin, k8.photo_source_url], [1, sha, 'web', 'https://cdn.test/k8.jpg'], 'D-F16 dans la transaction : une photo écrite juste avant la transaction de « Corriger » (après ses lectures) survit — les trois champs relus DANS la transaction');

        // 5. Archive aller-retour (§ 3.1) : une fiche à photo web voyage intacte, ses octets aussi, zéro écart.
        await withDatabase(async (source) => {
          await source.mutate({ puts: {
            files: [{ sha256: sha, mime: 'image/jpeg', blob: jpeg, size: jpeg.size, syncable: true, created_at: DATE, updated_at: DATE }],
            recipes: [fiche('rc_ar', { source_url: 'https://site.test/ar', photo_sha256: sha, photo_origin: 'web', photo_source_url: 'https://cdn.test/ar.jpg' })],
            recipe_versions: [version('rc_ar')],
          }, origin: 'device' });
          const inspection = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
          ok(inspection.ok, 'archive : la fixture est acceptée (' + (inspection.errors || []).join(' · ') + ')');
          await withDatabase(async (cible) => {
            await applyArchive(cible, inspection, { mode: 'replace' });
            const v = await verifyRestored(cible, inspection, { mode: 'replace' });
            const ar = await cible.get('recipes', 'rc_ar');
            eq([v.ok, v.diffs, ar.photo_sha256, ar.photo_origin, ar.photo_source_url, (await cible.get('files', sha))?.blob instanceof Blob], [true, [], sha, 'web', 'https://cdn.test/ar.jpg', true],
              'archive aller-retour d’une fiche à photo web : champs intacts, octets restaurés, verifyRestored zéro écart');
          });
        });

        // 6. La photo rapatriée voyage (P-11) : l'écriture de rapatrierPhotoWeb passe par la capture (une entrée recipes en file) et l'envoi porte les
        //    trois champs au serveur (transport factice arbitre, tests/transport-factice.js) ; les octets, eux, sont l'affaire du lot G.
        const png = await octetsDe(await imageTest('cap.png', '#3a7', 800, 600, 'image/png'));
        const fetchImage = async () => reponse(200, { type: 'image/png', taille: png.length, url_finale: 'https://cdn.test/cap.png', octets: base64De(png) });
        await db.mutate({ puts: { recipes: [fiche('rc_cap', { photo_source_url: 'https://cdn.test/cap.png' })] }, origin: 'device' });
        const sync = { user: { id: 'u1' }, auth: { jeton: async () => ({ access_token: 'jeton-capture', user: { id: 'u1' } }) } };
        const r = await PP.rapatrierPhotoWeb('rc_cap', { ctx: { sync }, repo, fetch: fetchImage, enLigne: () => true });
        const enFile = (await db.getAll('outbox')).filter((e) => e.store === 'recipes' && e.id === 'rc_cap').map((e) => e.op);
        const tf = creerTransportFactice({ serveur: true });
        await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
        const auServeur = tf.ligne('recipes', 'rc_cap')?.data;
        eq([r.issue, enFile, auServeur?.photo_sha256, auServeur?.photo_origin, auServeur?.photo_source_url], ['ok', ['put'], r.sha256, 'web', 'https://cdn.test/cap.png'],
          'capture : une entrée recipes (put, origine local) en file après le rapatriement ; l’envoi porte photo_sha256, photo_origin web et photo_source_url au serveur');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));

    // ===== fin des blocs du lot F (les tâches 3 à 5 ajoutent les leurs AU-DESSUS de cette ligne)
  } finally { setUiLocale(localeAvant); }
}
