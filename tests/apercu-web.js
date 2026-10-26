// Tests du lot UI-2 « Aperçus des résultats web » (spec docs/superpowers/specs/2026-10-23-experience-carnet-design.md, § 4.6, § 6, § 7 UI-2 ;
// rulings du chef R-UI2-1, R-UI2-6, R-UI2-7, R-UI2-9 du brief de la tâche 2).
// Domaine (lireApercusWeb, preparerPhotoDistante sans ré-encodage) sur des réponses fixes et un fetch factice ; écran (search.js) à gestes injectés,
// chercher ET apercus factices ; aucun réseau ; aucune base ; jamais le navigateur partagé. Les images sont fabriquées par canvas (imageTest de
// tests/photo-plat.js, recopié : des Blob, pas des File). Un caractère hostile est construit par String.fromCodePoint, jamais écrit en littéral.
export async function runApercuWebTests({ eq, ok }) {
  const run = async (name, test) => {
    try { await test(); }
    catch (error) { ok(false, `Aperçus web — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };
  const vraiFetch = globalThis.fetch; // relevé AVANT le mur du réseau (ci-dessous) : `lire` lit les sources par lui
  const lire = async (chemin) => { const r = await vraiFetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
  const localeAvant = getUiLocale();
  setUiLocale('fr'); // des textes français sont affirmés
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
  // Une image de test : un aplat et un coin clair ; PNG (sans perte : les octets rendus se comparent aux octets reçus) ou JPEG ; un Blob typé.
  const imageTest = async (couleur, l, h, type = 'image/png') => {
    const toile = new OffscreenCanvas(l, h); const cx = toile.getContext('2d');
    cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); cx.fillStyle = '#fff'; cx.fillRect(0, 0, Math.max(1, l >> 2), Math.max(1, h >> 2));
    return toile.convertToBlob(type === 'image/png' ? { type } : { type, quality: 0.9 });
  };
  const octetsDe = async (blob) => new Uint8Array(await blob.arrayBuffer());
  // Le base64 que la fonction rend (un seul btoa sur la chaîne binaire entière : jamais par tranches non multiples de 3).
  const base64De = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
  // Les deux formes d'une entrée de la réponse (spec § 6) : avec image (raison nulle), sans image (raison écrite par la fonction).
  const entreeImage = (url, u8, type = 'image/png') => ({ url, image: { type, taille: u8.length, octets: base64De(u8) }, raison: null });
  const entreeRefus = (url, raison) => ({ url, image: null, raison });
  const SESSION = { access_token: 'jeton-apercus-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
  const U = (i) => `https://r${i}.test/recette`;
  const CINQ = [0, 1, 2, 3, 4].map(U);
  // Le jeton n'est dans aucun champ TEXTE d'un résultat : etat, raison, extra, et pour une Map ses clés et ses raisons (un Blob ne porte pas de texte lisible
  // par JSON.stringify — il rend `{}` — : la garde ne prétend pas le fouiller).
  const sansJeton = (x) => !JSON.stringify(x instanceof Map ? [...x].map(([k, v]) => [k, v?.blob instanceof Blob ? 'blob' : v]) : x ?? null).includes('jeton-apercus-sentinelle');
  // Un en-tête PNG de l × h pixels (33 octets : signature, IHDR) — assez pour dimensionsImage, jamais décodable.
  const tetePng = (l, h) => { const t = new Uint8Array(33); t.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const dv = new DataView(t.buffer); dv.setUint32(16, l); dv.setUint32(20, h); return t; };

  // ===== Écran : src/ui/search.js (spec § 4.6, D-UI-13, S-4 à S-7, K-1). Le fetch global est muré EN TÊTE du try ci-dessous (lireApercusWeb reçoit toujours
  // le sien ; `lire` a le vrai) ; S, BU, EN, scene, PNG, IMG y sont assignés : les aides ci-dessous les lisent par fermeture.
  let S, BU, EN, scene, PNG, IMG;
  let reseau = 0;
  const ctxDe = (session = SESSION) => ({ docs: [], docsByRecipe: new Map(), ingredientsById: new Map(), meal_feedback: [], settings: { llm: { provider: 'none' } }, sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } } });
  const lien = (i) => ({ href: U(i), hote: `r${i}.test`, titre: `Recette ${i}`, date: null, presentation: null, temps_min: null, difficulte: null, ingredients: null });
  const trouve = (liens) => ({ etat: 'trouve', raison: null, liens, autres: [], repli: false, recherches: 1, modele: 'm' });
  const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
  const cartes = (root) => [...root.querySelectorAll('a.btn:not(.small)[target="_blank"]')].map((a) => a.parentElement); // les liens-titres des cartes
  const figures = (root) => [...root.querySelectorAll('figure.apercu')];
  const srcs = (root) => figures(root).map((f) => f.querySelector('img')?.getAttribute('src'));
  const etat = (root) => root.querySelector('[data-role="etat-apercus"]');
  // Deux pilotes à promesses : chaque appel de chercher / d'apercus est rangé avec ses arguments et résolu quand le test le veut.
  const pilotes = () => {
    const p = { recherches: [], demandes: [] };
    const pose = (liste) => async (a, d) => { const x = { a, d }; x.promesse = new Promise((r) => { x.rendre = r; }); liste.push(x); return x.promesse; };
    p.chercher = pose(p.recherches); p.apercus = pose(p.demandes);
    return p;
  };
  const monter = async (p, query = { q: 'puttanesca' }, deps = {}, ctx = ctxDe()) => { const root = await S.renderSearch({}, { mode: 'web', ...query }, ctx, { chercher: p.chercher, apercus: p.apercus, navigate: () => {}, remplacerAdresse: () => {}, ...deps }); scene.append(root); return root; };
  // Tape, laisse lancer() appeler chercher, résout le « trouvé », laisse notifier() redessiner (la vue CONNECTÉE pose alors le vol d'aperçus).
  const chercheEtRecoit = async (root, p, liens, nom = 'Chercher sur le web avec l’assistant') => { bouton(root, nom).click(); await tick(); p.recherches.at(-1).rendre(trouve(liens)); await tick(); };
  // La réponse d'un vol d'aperçus : une clé par adresse demandée ; `images` = les adresses qui ont l'image ; les autres portent `raison`.
  const recus = (urls, images, raison = 'pas_d_image') => ({ etat: 'recus', apercus: new Map(urls.map((u) => [u, images.includes(u) ? IMG : { raison }])) });
  // Un redessin SANS tape : le « + type » de la barre de filtres (select → change → render() ; 'salade' ∈ RECIPE_TYPES).
  const redessiner = (root) => { const s = root.querySelector('select'); s.value = 'salade'; s.dispatchEvent(new Event('change')); };
  try {
    // Le mur et les fixtures DANS le try : le finally les retire quoi qu'il arrive (Global Constraints « Bases jetables seulement, aucun réseau »).
    globalThis.fetch = async (u) => { reseau += 1; throw new Error(`aucun reseau attendu ici : ${u}`); };
    scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    S = await import('../src/ui/search.js');
    BU = await import('../src/core/blob-urls.js');
    ({ EN } = await import('../src/i18n/en.js'));
    PNG = await imageTest('#3a7', 320, 240);
    IMG = { blob: PNG, type: 'image/png' };

    // ===== Domaine (spec § 6 « Client », H-7, S-12)
    await run('LIMITES_APERCU_WEB et listes fermées (§ 6)', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const { COVER_INPUT_MIME } = await import('../src/sync/mime.js');
      const { LIMITES_PASSERELLE } = await import('../src/domain/passerelle.js');
      const { LIMITES_COUVERTURE } = await import('../src/core/image.js');
      ok(Object.isFrozen(A.LIMITES_APERCU_WEB) && Object.isFrozen(A.RAISONS_ENTREE_APERCU) && Object.isFrozen(A.RAISONS_ECHEC_APERCU), 'LIMITES_APERCU_WEB, RAISONS_ENTREE_APERCU, RAISONS_ECHEC_APERCU : gelées');
      eq([A.LIMITES_APERCU_WEB.adresses, A.LIMITES_APERCU_WEB.url, A.LIMITES_APERCU_WEB.octets, A.LIMITES_APERCU_WEB.corpsReponse, A.LIMITES_APERCU_WEB.tentativeMs, A.LIMITES_APERCU_WEB.types === COVER_INPUT_MIME],
        [5, 2048, 1024 * 1024, 8 * 1024 * 1024, 135000, true], 'LIMITES_APERCU_WEB : 5 adresses de 2 048 points, 1 Mio par image (le max du serveur), réponse ≤ 8 Mio, 135 s, les types des couvertures');
      eq(A.LIMITES_APERCU_WEB.tentativeMs, LIMITES_PASSERELLE.tentativeMs, 'tentativeMs = le délai de la passerelle (135 s), au-dessus du budget serveur de 60 s');
      ok(A.LIMITES_APERCU_WEB.corpsReponse >= 5 * 4 * Math.ceil(A.LIMITES_APERCU_WEB.octets / 3) + 4096, 'corpsReponse ≥ le base64 de cinq images à la borne + 4 Kio d’enveloppe');
      ok(A.LIMITES_APERCU_WEB.octets <= LIMITES_COUVERTURE.octetsDistants, 'LIMITES_APERCU_WEB.octets ≤ le mur commun des images distantes (5 Mio)');
      eq([[...A.RAISONS_ENTREE_APERCU], [...A.RAISONS_ECHEC_APERCU]], [['interdit', 'inaccessible', 'pas_de_recette', 'pas_d_image', 'image_trop_lourde', 'delai', 'illisible', 'image_refusee'],
        ['adresse', 'non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit']], 'raisons : les six du serveur + illisible, image_refusee par entrée ; les raisons de la passerelle par appel');
    });

    await run('lireApercusWeb : l’appel (§ 6, I-UI-2)', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const P = await import('../src/domain/passerelle.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const png = await octetsDe(await imageTest('#3a7', 320, 240));
      const appels = [];
      const f = (statut, corps) => async (url, options) => { appels.push({ url, options }); return reponse(statut, corps); };
      const corps200 = { apercus: [entreeImage(U(0), png), entreeRefus(U(1), 'pas_d_image'), entreeRefus(U(2), 'inaccessible'), entreeImage(U(3), png), entreeRefus(U(4), 'interdit')] };
      const delais = []; const vraiTimeout = AbortSignal.timeout;
      AbortSignal.timeout = (ms) => { delais.push(ms); return vraiTimeout.call(AbortSignal, ms); };
      const vraiBitmap = globalThis.createImageBitmap; let decodes = 0;
      globalThis.createImageBitmap = (...a) => { decodes += 1; return vraiBitmap.call(globalThis, ...a); };
      let r;
      try { r = await A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: f(200, corps200), config: SUPABASE.prod }); }
      finally { AbortSignal.timeout = vraiTimeout; globalThis.createImageBitmap = vraiBitmap; }
      const a = appels[0];
      eq([appels.length, a.url, JSON.parse(a.options.body), Object.keys(a.options.headers).sort(), a.options.redirect, a.options.credentials],
        [1, P.urlAssistant(SUPABASE.prod), { outil: 'apercu-web', corps: { urls: CINQ } }, ['apikey', 'authorization', 'content-type'], 'error', 'omit'],
        'lireApercusWeb : UN POST { outil: apercu-web, corps: { urls } } exact vers la fonction assistant (cinq adresses, dans l’ordre), trois en-têtes, redirect error, credentials omit');
      eq(delais.includes(135000), true, 'lireApercusWeb : tentativeMs passé à la passerelle = 135 000');
      eq([r.etat, r.apercus instanceof Map, [...r.apercus.keys()]], ['recus', true, CINQ], 'lireApercusWeb : { etat: recus, apercus: Map } avec UNE clé par adresse demandée, dans l’ordre de la demande');
      const a0 = r.apercus.get(U(0));
      eq([a0.type, a0.blob?.type, a0.blob?.size, [...(await octetsDe(a0.blob))].every((o, i) => o === png[i]), decodes], ['image/png', 'image/png', png.length, true, 0],
        'blob par adresse : une PNG 320 × 240 → { blob, type } du bon type, aux octets REÇUS (pas de ré-encodage : createImageBitmap jamais appelé — H-7)');
      eq([r.apercus.get(U(1)), r.apercus.get(U(2)), r.apercus.get(U(4)), r.apercus.get(U(3)).blob instanceof Blob], [{ raison: 'pas_d_image' }, { raison: 'inaccessible' }, { raison: 'interdit' }, true],
        'blob par adresse : chaque adresse sans image garde SA raison ; une image refusée pour une adresse ne prive pas les autres (I-UI-6)');
      appels.length = 0;
      const sansSession = await A.lireApercusWeb({ urls: CINQ, session: null }, { fetch: f(200, corps200), config: SUPABASE.prod });
      const ctl = new AbortController(); ctl.abort();
      const annule = await A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: f(200, corps200), config: SUPABASE.prod, signal: ctl.signal });
      const formes = [];
      for (const urls of [[], [...CINQ, U(5)], [U(0), 7], [U(0), ''], ['x'.repeat(2049)], null, 'https://a.test/']) formes.push((await A.lireApercusWeb({ urls, session: SESSION }, { fetch: f(200, corps200), config: SUPABASE.prod })).raison);
      eq([sansSession.etat, sansSession.raison, annule.raison, formes, appels.length], ['echec', 'non_connecte', 'annule', ['adresse', 'adresse', 'adresse', 'adresse', 'adresse', 'adresse', 'adresse'], 0],
        'lireApercusWeb : sans session → non_connecte ; signal levé → annule ; zéro, six, une non-chaîne, une vide, une seule de 2 049 points (rien d’admis à envoyer), null, une chaîne nue → adresse ; zéro fetch dans tous les cas');
      const nul = await A.lireApercusWeb(null, null);
      eq([nul.etat, nul.raison], ['echec', 'adresse'], 'lireApercusWeb(null, null) : un échec, jamais un rejet');
      ok([r, sansSession, annule, nul].every(sansJeton) && sansJeton(r.apercus), 'lireApercusWeb : le jeton n’est dans aucun champ texte des résultats (etat, raison, extra ; clés et raisons de la Map)');
    });

    await run('lireApercusWeb : une adresse de plus de 2 048 unités est écartée AVANT l’envoi (R-UI2-1)', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const png = await octetsDe(await imageTest('#3a7', 320, 240));
      const LONGUE = 'https://longue.test/' + 'x'.repeat(2100); // 2 120 unités : le serveur refuserait la FORME entière (400) et priverait les quatre autres
      const BORNE = 'https://borne.test/' + 'y'.repeat(2048 - 'https://borne.test/'.length); // 2 048 unités pile : admise
      const cinq = [U(0), U(1), LONGUE, U(3), BORNE];
      const appels = [];
      const f = async (url, options) => { appels.push(JSON.parse(options.body)); return reponse(200, { apercus: [entreeImage(U(0), png), entreeRefus(U(1), 'pas_d_image'), entreeRefus(U(3), 'delai'), entreeRefus(BORNE, 'inaccessible')] }); };
      const r = await A.lireApercusWeb({ urls: cinq, session: SESSION }, { fetch: f, config: SUPABASE.prod });
      eq([appels.length, appels[0]?.corps.urls, BORNE.length], [1, [U(0), U(1), U(3), BORNE], 2048], 'R-UI2-1 : la demande ne porte que les QUATRE adresses admises (celle de 2 048 unités pile comprise), dans l’ordre ; la longue n’est jamais envoyée');
      eq([r.etat, [...r.apercus.keys()], r.apercus.get(LONGUE), r.apercus.get(U(0)).blob instanceof Blob, r.apercus.get(U(3)), r.apercus.get(BORNE)], ['recus', cinq, { raison: 'interdit' }, true, { raison: 'delai' }, { raison: 'inaccessible' }],
        'R-UI2-1 : la Map porte les CINQ adresses dans l’ordre demandé ; la longue vaut { raison: interdit } posé localement ; les quatre autres ont leur entrée du serveur');
      // Une réponse qui prétend une image pour l'adresse JAMAIS envoyée est ignorée (adresse non demandée au serveur) : l'entrée locale `interdit` tient.
      const r2 = await A.lireApercusWeb({ urls: [U(0), LONGUE] }, { fetch: async () => reponse(200, { apercus: [entreeImage(U(0), png), entreeImage(LONGUE, png)] }), config: SUPABASE.prod }).catch(() => null);
      const r3 = await A.lireApercusWeb({ urls: [U(0), LONGUE], session: SESSION }, { fetch: async () => reponse(200, { apercus: [entreeImage(U(0), png), entreeImage(LONGUE, png)] }), config: SUPABASE.prod });
      eq([r2?.raison, r3.apercus.get(LONGUE), r3.apercus.get(U(0)).blob instanceof Blob], ['non_connecte', { raison: 'interdit' }, true], 'R-UI2-1 : une entrée du serveur pour l’adresse écartée est ignorée (interdit tient) ; sans session, toujours non_connecte');
    });

    await run('lireApercusWeb : corpsMax 8 Mio, le 200 est une donnée hostile (S-12, I-UI-5)', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const P = await import('../src/domain/passerelle.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const lu = async (corps) => A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: async () => reponse(200, corps), config: SUPABASE.prod });
      // Cinq « images » de 1 Mio pile (la borne) : ≈ 7 Mio de JSON, au-delà des 2 Mio par défaut de la passerelle — le corps est LU en entier, chaque entrée
      // décodée (atob × 5) puis refusée par le mur (FF D8 FF 00 : un en-tête que libjpeg ne lirait pas → image_refusee), jamais `reponse_illisible`.
      // BORNE en LITTÉRAL, jamais lue dans le module : sous le mutant « LIMITES_APERCU_WEB.octets remis à 2 Mio », TROP (1 048 577) passerait la borne mutée,
      // atob serait appelé et « image_trop_lourde AVANT tout décodage » rougirait à la lettre (le test des constantes le tue aussi).
      const BORNE = 1024 * 1024;
      eq(A.LIMITES_APERCU_WEB.octets, BORNE, 'la borne client vaut 1 Mio, le littéral de ce bloc (P-UI2-4 : miroir du max serveur)');
      const grosse = new Uint8Array(BORNE); grosse.set([0xff, 0xd8, 0xff]);
      const b64Grosse = base64De(grosse);
      const corpsGros = { apercus: CINQ.map((u) => ({ url: u, image: { type: 'image/jpeg', taille: BORNE, octets: b64Grosse }, raison: null })) };
      ok(JSON.stringify(corpsGros).length > 3 * P.LIMITES_PASSERELLE.corps, 'fixture : cinq images à la borne font plus de 6 Mio de JSON (le mutant « corpsMax omis ou 2 Mio » les refuse)');
      const vraiAtob = globalThis.atob; let atobs = 0;
      globalThis.atob = (s) => { atobs += 1; return vraiAtob(s); };
      let gros;
      try { gros = await lu(corpsGros); } finally { globalThis.atob = vraiAtob; }
      eq([gros.etat, [...gros.apercus.values()], atobs], ['recus', CINQ.map(() => ({ raison: 'image_refusee' })), 5], 'corpsMax : ≈ 7 Mio de JSON sont lus ; cinq entrées décodées (atob × 5) et refusées par le mur → image_refusee chacune');
      // La borne AVANT tout décodage : 1 Mio + 1 avec un base64 de la BONNE longueur — un mutant « décoder puis borner » appellerait atob.
      const TROP = BORNE + 1; atobs = 0;
      globalThis.atob = (s) => { atobs += 1; return vraiAtob(s); };
      let trop;
      try { trop = await lu({ apercus: [{ url: U(0), image: { type: 'image/jpeg', taille: TROP, octets: 'A'.repeat(4 * Math.ceil(TROP / 3)) }, raison: null }] }); } finally { globalThis.atob = vraiAtob; }
      eq([trop.apercus.get(U(0)), atobs], [{ raison: 'image_trop_lourde' }, 0], 'hostile : taille 1 048 577 (base64 de la bonne longueur) → image_trop_lourde AVANT tout décodage (atob jamais appelé)');
      const png = await octetsDe(await imageTest('#a52', 320, 240));
      const formes = await lu({ apercus: [
        { url: U(0), image: { type: 'image/gif', taille: png.length, octets: base64De(png) }, raison: null },   // type hors liste
        { url: U(1), image: { type: 'image/png', taille: 0, octets: '' }, raison: null },                         // taille 0
        { url: U(2), image: { type: 'image/png', taille: png.length, octets: '@@' }, raison: null },              // alphabet hors base64
        { url: U(3), image: { taille: png.length, octets: base64De(png) }, raison: null },                        // sans champ type
        { url: U(4), image: null, raison: 'constructor' },                                                        // raison hors liste (héritée)
        { url: 'https://inconnue.test/', image: { type: 'image/png', taille: png.length, octets: base64De(png) }, raison: null }, // adresse non demandée
      ] });
      eq([[...formes.apercus.entries()], formes.apercus.has('https://inconnue.test/')], [[[U(0), { raison: 'illisible' }], [U(1), { raison: 'illisible' }], [U(2), { raison: 'illisible' }], [U(3), { raison: 'illisible' }], [U(4), { raison: 'illisible' }]], false],
        'hostile : type hors liste, taille 0, alphabet hors base64, champ type absent, raison hors liste → illisible ; une adresse NON demandée est ignorée');
      const manquantes = await lu({ apercus: [entreeImage(U(1), png), entreeImage(U(1), tetePng(300, 300)), entreeRefus(U(3), 'delai')] });
      eq([[...manquantes.apercus.keys()], manquantes.apercus.get(U(0)), manquantes.apercus.get(U(1)).blob?.size, manquantes.apercus.get(U(3)), manquantes.apercus.get(U(4))],
        [CINQ, { raison: 'illisible' }, png.length, { raison: 'delai' }, { raison: 'illisible' }], 'hostile : une adresse demandée ABSENTE de la réponse vaut illisible (jamais redemandée en boucle) ; une adresse en double → la première entrée gagne ; `delai` relayé');
      const menteur = await lu({ apercus: [entreeImage(U(0), png, 'image/jpeg'), entreeImage(U(1), tetePng(20000, 20000)), entreeImage(U(2), (await octetsDe(await imageTest('#3a7', 199, 600))))] });
      eq([menteur.apercus.get(U(0)), menteur.apercus.get(U(1)), menteur.apercus.get(U(2))], [{ raison: 'image_refusee' }, { raison: 'image_refusee' }, { raison: 'image_refusee' }],
        'hostile : octets PNG annoncés image/jpeg (en-tête menteur), 20 000 × 20 000 (400 Mpx), petit côté 199 → image_refusee (LE mur de F, I-UI-2)');
      for (const corps of [{}, { apercus: {} }, { apercus: 'x' }, []]) eq((await lu(corps)).raison, 'reponse_illisible', `hostile : un 200 sans tableau apercus (${JSON.stringify(corps)}) → reponse_illisible`);
      ok([gros, trop, formes, manquantes, menteur].every((x) => sansJeton(x) && sansJeton(x.apercus)), 'le jeton n’est dans aucun champ texte des résultats (clés et raisons des Map comprises)');
    });

    await run('mur sans ré-encodage : preparerPhotoDistante({ reencoder: false }) (H-7, I-UI-2)', async () => {
      const IM = await import('../src/core/image.js');
      const code = async (p) => { try { await p; return 'ok'; } catch (e) { return e?.code ?? 'autre:' + (e?.message || ''); } };
      const png = await imageTest('#3a7', 320, 240);
      const jpeg = await imageTest('#a52', 600, 400, 'image/jpeg');
      const vrai = globalThis.createImageBitmap; let decodes = 0;
      globalThis.createImageBitmap = (...a) => { decodes += 1; return vrai.call(globalThis, ...a); };
      try {
        const sortiePng = await IM.preparerPhotoDistante(png, { coteMin: IM.COTE_MIN_DISTANT, reencoder: false });
        const sortieJpeg = await IM.preparerPhotoDistante(jpeg, { reencoder: false });
        eq([sortiePng === png, sortieJpeg === jpeg, decodes], [true, true, 0], 'reencoder: false → LE MÊME Blob est rendu (PNG et JPEG), sans aucun createImageBitmap');
        eq([await code(IM.preparerPhotoDistante(new Blob([png], { type: 'image/jpeg' }), { reencoder: false })), decodes], ['indecodable', 0], 'reencoder: false : octets PNG annoncés image/jpeg → indecodable (l’en-tête dit un autre type), sans décodage');
        eq([await code(IM.preparerPhotoDistante(new Blob([tetePng(20000, 20000)], { type: 'image/png' }), { reencoder: false })), decodes], ['trop_grande', 0], 'reencoder: false : en-tête 20 000 × 20 000 (400 Mpx) → trop_grande AVANT décodage');
        eq([await code(IM.preparerPhotoDistante(await imageTest('#a52', 199, 600), { reencoder: false })), await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(10)], { type: 'image/heic' }), { reencoder: false })), await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }), { reencoder: false })), decodes],
          ['trop_petite', 'type', 'trop_lourde', 0], 'reencoder: false : petit côté 199 → trop_petite ; image/heic → type ; 5 Mio + 1 → trop_lourde — les mêmes murs, sans décodage');
        const reencode = await IM.preparerPhotoDistante(png);
        eq([reencode !== png, reencode.type, decodes >= 1], [true, 'image/jpeg', true], 'défaut (reencoder vrai) inchangé : la PNG est ré-encodée en JPEG par le canvas (lot F)');
      } finally { globalThis.createImageBitmap = vrai; }
    });

    await run('table serveur → client : les échecs de l’appel entier', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const table = [[429, { erreur: 'quota', quota: 60 }, 'quota', { quota: 60 }], [429, { type: 'error' }, 'trop_de_demandes', {}], [422, { erreur: 'interdit' }, 'interdit', {}], [400, { erreur: 'requete' }, 'requete', {}],
        [401, { erreur: 'non_connecte' }, 'non_connecte', {}], [403, { erreur: 'non_admis' }, 'non_admis', {}], [413, { erreur: 'trop_lourd' }, 'requete', { trop_lourd: true }], [502, { erreur: 'serveur' }, 'serveur', {}], [504, { erreur: 'delai' }, 'delai', {}]];
      const obtenus = [];
      for (const [statut, corps] of table) { const x = await A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: async () => reponse(statut, corps), config: SUPABASE.prod }); obtenus.push([x.etat, x.raison, x.extra]); }
      eq(obtenus, table.map(([, , raison, extra]) => ['echec', raison, extra]), 'table serveur → client : quota 60 (écrit) ; 429 sans champ → trop_de_demandes ; 422 interdit (aucune adresse admise) ; 400 requete (forme refusée, P-UI2-21) → requete ; 401 ; 403 non_admis ; 413 → requete + trop_lourd ; 502 serveur ; 504 delai');
      ok(obtenus.every(([, raison]) => A.RAISONS_ECHEC_APERCU.includes(raison)), 'toute raison d’échec rendue ∈ RAISONS_ECHEC_APERCU');
      const reseau = await A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: async () => { throw new TypeError('Failed to fetch'); }, config: SUPABASE.prod });
      eq([reseau.etat, reseau.raison], ['echec', 'reseau'], 'un fetch qui rejette → reseau, jamais une levée');
    });

    // ===== Écran (Step 2)
    await run('écran : demande d’aperçus — forme, un appel pour cinq, un seul vol, insertion en une fois (D-UI-13, S-4, B-I-12)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien));
      const d = p.demandes[0];
      eq([p.demandes.length, d?.a.urls, d?.a.session === SESSION, d?.d.signal instanceof AbortSignal, d?.d.signal.aborted, S.etatApercus().enVol], [1, CINQ, true, true, false, CINQ],
        'demande : UN appel d’aperçus pour les cinq adresses des liens (dans l’ordre), avec la SESSION relue et un signal d’abandon ; le vol est posé au module');
      const ligne = etat(root);
      eq([ligne?.tagName, ligne?.className, ligne?.textContent, ligne?.previousElementSibling?.textContent, figures(root).length], ['P', 'muted', 'Photos en cours de récupération…', 'Demande envoyée : puttanesca', 0],
        'ligne d’état (forme 1) : p.muted[data-role=etat-apercus] « Photos en cours de récupération… » juste sous « Demande envoyée », aucune figure pendant le vol');
      redessiner(root); await tick();
      eq([p.demandes.length, !!etat(root), S.etatApercus().enVol], [1, true, CINQ], 'un seul vol : un redessin pendant le vol (puce « + type ») ne pose pas de second appel ; la ligne « en cours » reste');
      // Insertion en UNE fois : le conteneur des résultats (root.lastElementChild) est observé — chaque redessin commence par UN vidage (remplacerEnRevoquant :
      // un enregistrement à removedNodes ; les deux append qui suivent n'en ont pas) ; à la réception, UN seul redessin, les trois figures déjà dedans.
      const resultats = root.lastElementChild; const redessins = [];
      const mo = new MutationObserver((records) => { for (const r of records) if (r.removedNodes.length) redessins.push(figures(root).length); });
      mo.observe(resultats, { childList: true });
      d.rendre(recus(CINQ, [U(0), U(1), U(2)]));
      await tick(); await tick(); mo.disconnect();
      eq([redessins, figures(root).length], [[3], 3], 'insertion en une fois : UN seul redessin à la réception, qui porte déjà les trois figures (jamais 1 puis 2 puis 3, jamais trois redessins)');
      const c = cartes(root);
      eq([c.map((x) => x.firstElementChild?.matches('figure.apercu') ?? false), c.slice(0, 3).map((x) => [x.firstElementChild.firstElementChild.tagName, x.firstElementChild.firstElementChild.className, x.firstElementChild.firstElementChild.getAttribute('alt')]), c[0].children[1].tagName + '.' + c[0].children[1].className],
        [[true, true, true, false, false], [['IMG', 'plat-vignette grande', ''], ['IMG', 'plat-vignette grande', ''], ['IMG', 'plat-vignette grande', '']], 'A.btn'],
        'figure : figure.apercu > img.plat-vignette.grande[alt=""] en TÊTE des trois cartes qui ont l’image, puis le titre ; aucune figure sur les deux autres');
      eq([srcs(root).every((s) => typeof s === 'string' && s.startsWith('blob:')), root.querySelectorAll('img').length, etat(root), S.etatApercus()], [true, 3, null, { hrefs: CINQ, blobs: 3, enVol: null }],
        'jamais de src https : les trois images viennent d’URL blob: ; la ligne d’état a disparu (une image posée) ; la Map porte 5 entrées, 3 Blob, aucun vol');
      ok([...root.querySelectorAll('img')].every((i) => c.some((x) => x.contains(i))), 'les images sont dans les cartes (aucune ailleurs)');
      eq(figures(root).map((f) => f.getAttribute('style')), [null, null, null], 'R-UI2-9 : la figure ne porte aucun style en ligne (sa marge vient de styles.css, figure.apercu)');
    });

    await run('écran : même demande → 0 appel ; trois liens neufs sur cinq → un appel pour trois ; Blob des liens disparus lâchés (K-1, S-5, S-6)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien));
      p.demandes[0].rendre(recus(CINQ, [U(0), U(1), U(2)])); await tick();
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien), 'Chercher à nouveau');
      eq([p.recherches.length, p.demandes.length, figures(root).length, etat(root)], [2, 1, 3, null], 'même demande relancée avec les mêmes cinq liens : une recherche de plus, ZÉRO appel d’aperçus, les trois figures reviennent de la Map');
      await chercheEtRecoit(root, p, [0, 1, 5, 6, 7].map(lien), 'Chercher à nouveau');
      const d = p.demandes[1];
      eq([p.demandes.length, d?.a.urls, S.etatApercus(), figures(root).length, etat(root)?.textContent], [2, [U(5), U(6), U(7)], { hrefs: [U(0), U(1)], blobs: 2, enVol: [U(5), U(6), U(7)] }, 2, 'Photos en cours de récupération…'],
        'trois liens neufs sur cinq : UN appel pour les trois adresses neuves seulement ; les entrées de r2, r3, r4 (Blob de r2 compris) sont lâchées ; les figures de r0 et r1 restent ; « en cours » pour les neuves');
      d.rendre(recus([U(5), U(6), U(7)], [U(5)])); await tick();
      eq([figures(root).length, S.etatApercus(), etat(root)], [3, { hrefs: [U(0), U(1), U(5), U(6), U(7)], blobs: 3, enVol: null }, null], 'réception : r5 posée (trois figures : r0, r1, r5), r6 et r7 mémorisées sans image');
      await chercheEtRecoit(root, p, [0, 1, 5, 6, 7].map(lien), 'Chercher à nouveau');
      eq([p.demandes.length, figures(root).length], [2, 3], 'les échecs PAR ENTRÉE sont mémorisés aussi : la même liste relancée ne redemande ni r6 ni r7 (0 appel)');
    });

    await run('écran : abandon par lancer(), par « Annuler » (deux vues) et par la dernière vue déconnectée ; un résultat tardif est muet (S-4)', async () => {
      // lancer() : une nouvelle recherche abandonne le vol d'aperçus ; sa réponse tardive n'écrit rien ; le « trouvé » suivant redemande (connecté).
      S.reinitialiserWeb();
      let p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien));
      const d0 = p.demandes[0];
      bouton(root, 'Chercher à nouveau').click(); await tick();
      eq([d0.d.signal.aborted, S.etatApercus().enVol, p.demandes.length], [true, null, 1], 'lancer() : la tape abandonne le vol d’aperçus (signal levé, plus de vol au module)');
      d0.rendre(recus(CINQ, [U(0), U(1), U(2)])); await tick();
      eq(S.etatApercus(), { hrefs: [], blobs: 0, enVol: null }, 'un résultat tardif d’un vol abandonné est MUET : rien n’est écrit dans la Map');
      p.recherches.at(-1).rendre(trouve([0, 1, 2, 3, 4].map(lien))); await tick();
      eq([p.demandes.length, p.demandes[1]?.a.urls, figures(root).length], [2, CINQ, 0], 'le « trouvé » suivant, rendu par la vue connectée, redemande les cinq adresses (toujours absentes)');
      p.demandes[1].rendre(recus(CINQ, [U(0)])); await tick();
      root.remove();
      // « Annuler » : deux vues. root0 montre un « trouvé » dont les aperçus manquent (son vol a été abandonné par la tape de root2) ; root2 tient la recherche
      // en vol et son bouton « Annuler ». Un redessin de root0 pose un nouveau vol d'aperçus ; « Annuler » dans root2 l'abandonne aussi — puis root2, redessinée
      // sur le « trouvé » de la mémoire (K1) aux adresses toujours absentes, en pose aussitôt un troisième : c'est la règle (une vue connectée qui rend un
      // « trouvé » demande ce qui manque), pas une fuite (R-UI2-8, limite nommée) ; le résultat tardif du vol abandonné, lui, reste muet.
      S.reinitialiserWeb();
      p = pilotes();
      const root0 = await monter(p, { q: 'puttanesca' });
      await chercheEtRecoit(root0, p, [0, 1, 2, 3, 4].map(lien));
      const root2 = await monter(p, { q: 'autre plat' });
      bouton(root2, 'Chercher à nouveau').click(); await tick(); // lancer() dans root2 : abandonne le vol d'aperçus de root0, pose la recherche « autre plat »
      eq([p.demandes[0].d.signal.aborted, !!bouton(root2, 'Annuler'), S.etatApercus().enVol], [true, true, null], 'deux vues : la tape de la seconde abandonne le vol d’aperçus de la première et montre « Annuler »');
      redessiner(root0); await tick();
      const d1 = p.demandes[1];
      eq([p.demandes.length, d1?.a.urls, !!bouton(root2, 'Annuler')], [2, CINQ, true], 'deux vues : le redessin de la première (connectée, adresses absentes) pose un nouveau vol d’aperçus pendant que « Annuler » est visible dans la seconde');
      bouton(root2, 'Annuler').click(); await tick();
      eq([d1.d.signal.aborted, S.etatWeb().enCours, p.demandes.length, p.demandes[2]?.d.signal.aborted, S.etatApercus().enVol], [true, false, 3, false, CINQ], '« Annuler » abandonne le vol d’aperçus avec la recherche (signal de d1 levé, plus de recherche en vol) ; le redessin de root2 sur le « trouvé » (K1, adresses absentes) pose aussitôt un nouveau vol');
      d1.rendre(recus(CINQ, [U(0)])); await tick();
      eq([S.etatApercus().blobs, S.etatApercus().enVol], [0, CINQ], '« Annuler » : le résultat tardif du vol abandonné est muet (le nouveau vol est intact)');
      root0.remove(); root2.remove();
      // La dernière vue déconnectée : avec deux vues connectées, retirer l'une ne fait rien ; retirer la dernière abandonne le vol (observateur du document).
      S.reinitialiserWeb();
      p = pilotes();
      const rootA = await monter(p);
      await chercheEtRecoit(rootA, p, [0, 1, 2, 3, 4].map(lien));
      const rootB = await monter(p); // seconde instance : la mémoire porte le « trouvé », le vol est déjà posé
      const d2 = p.demandes[0];
      rootB.remove(); await tick();
      eq([p.demandes.length, d2.d.signal.aborted, S.etatApercus().enVol], [1, false, CINQ], 'deux vues connectées : retirer la seconde ne touche pas au vol');
      rootA.remove(); await tick();
      eq([d2.d.signal.aborted, S.etatApercus().enVol], [true, null], 'la DERNIÈRE vue déconnectée abandonne le vol (signal levé, plus de vol au module)');
      d2.rendre(recus(CINQ, [U(0)])); await tick();
      eq(S.etatApercus(), { hrefs: [], blobs: 0, enVol: null }, 'dernière vue déconnectée : le résultat tardif est muet, rien n’est écrit');
    });

    await run('écran : la ligne d’état dans ses trois formes ; un échec de l’appel ENTIER est mémorisé pour l’ISSUE, pas par adresse (D-UI-13, S-15, D-UI-14, R-UI2-6)', async () => {
      S.reinitialiserWeb();
      let p = pilotes();
      let root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      eq(etat(root)?.textContent, 'Photos en cours de récupération…', 'forme 1 : « Photos en cours de récupération… » pendant le vol');
      p.demandes[0].rendre(recus([U(0), U(1)], [], 'pas_de_recette')); await tick();
      eq([etat(root)?.textContent, figures(root).length, etat(root)?.previousElementSibling?.textContent], ['Photos indisponibles pour cette recherche.', 0, 'Demande envoyée : puttanesca'], 'forme 2 : aucune image (raisons PAR ENTRÉE) → « Photos indisponibles pour cette recherche. », sous « Demande envoyée »');
      await chercheEtRecoit(root, p, [0, 1].map(lien), 'Chercher à nouveau');
      eq([p.demandes.length, etat(root)?.textContent], [1, 'Photos indisponibles pour cette recherche.'], 'forme 2 : les raisons par entrée restent dans la Map — la même liste relancée ne redemande rien et dit encore « indisponibles »');
      root.remove();
      // Une Map INCOMPLÈTE reçue (une adresse demandée sans entrée — deps.apercus factice ; lireApercusWeb, elle, remplit toujours) : l'écran boucle sur les
      // adresses DEMANDÉES, pas sur la Map, et remplit l'absente (illisible) ; rien n'est redemandé (S-5 : jamais une boucle de demandes).
      S.reinitialiserWeb(); p = pilotes(); root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      p.demandes[0].rendre({ etat: 'recus', apercus: new Map([[U(0), IMG]]) }); await tick();
      eq([S.etatApercus(), figures(root).length, etat(root)], [{ hrefs: [U(0), U(1)], blobs: 1, enVol: null }, 1, null], 'Map incomplète : l’adresse absente de la Map reçue est remplie côté écran (une entrée par adresse DEMANDÉE), r0 posée, pas de ligne d’état');
      await chercheEtRecoit(root, p, [0, 1].map(lien), 'Chercher à nouveau');
      eq(p.demandes.length, 1, 'Map incomplète : la même liste relancée ne redemande pas l’adresse remplie (0 appel, jamais une boucle)');
      root.remove();
      // 429 écrit par la passerelle (quota) → forme 3. R-UI2-6 : un échec de l'appel ENTIER n'apprend rien sur les adresses — rien dans la Map ; il est mémorisé
      // pour l'ISSUE courante : un redessin de la MÊME issue ne redemande rien ; une NOUVELLE issue (« Chercher à nouveau ») redemande les adresses absentes.
      S.reinitialiserWeb(); p = pilotes(); root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2].map(lien));
      p.demandes[0].rendre({ etat: 'echec', raison: 'quota', extra: { quota: 60 } }); await tick();
      eq([etat(root)?.textContent, S.etatApercus(), figures(root).length], ['Quota du jour atteint : photos indisponibles.', { hrefs: [], blobs: 0, enVol: null }, 0], 'forme 3 : 429 quota écrit → « Quota du jour atteint : photos indisponibles. » ; RIEN dans la Map (R-UI2-6 : l’échec est celui de l’appel, pas des adresses)');
      redessiner(root); await tick();
      eq([p.demandes.length, etat(root)?.textContent], [1, 'Quota du jour atteint : photos indisponibles.'], 'forme 3 : un simple redessin de la MÊME issue ne redemande rien (0 appel) et dit encore « Quota… »');
      await chercheEtRecoit(root, p, [0, 1, 2].map(lien), 'Chercher à nouveau');
      eq([p.demandes.length, p.demandes[1]?.a.urls, etat(root)?.textContent], [2, [U(0), U(1), U(2)], 'Photos en cours de récupération…'], 'forme 3 : une NOUVELLE issue (« Chercher à nouveau », mêmes liens) redemande les trois adresses absentes de la Map (R-UI2-6 : un appel de plus par geste, jamais sans geste)');
      root.remove();
      // Les deux tests nommés par R-UI2-6 : une panne réseau puis « Chercher à nouveau » avec les mêmes cinq liens → un second appel pour les cinq ;
      // une panne réseau puis un simple redessin → 0 appel. La raison écrite (reseau) n'est pas observable par etatApercus() ; la ligne dit « indisponibles ».
      S.reinitialiserWeb(); p = pilotes(); root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien));
      p.demandes[0].rendre({ etat: 'echec', raison: 'reseau', extra: {} }); await tick();
      eq([etat(root)?.textContent, S.etatApercus()], ['Photos indisponibles pour cette recherche.', { hrefs: [], blobs: 0, enVol: null }], 'panne réseau : « Photos indisponibles pour cette recherche. », rien dans la Map');
      redessiner(root); await tick(); redessiner(root); await tick();
      eq([p.demandes.length, etat(root)?.textContent], [1, 'Photos indisponibles pour cette recherche.'], 'panne réseau puis deux simples redessins → 0 appel, la ligne reste');
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien), 'Chercher à nouveau');
      eq([p.demandes.length, p.demandes[1]?.a.urls, etat(root)?.textContent], [2, CINQ, 'Photos en cours de récupération…'], 'panne réseau puis « Chercher à nouveau » avec les mêmes cinq liens → un SECOND appel pour les cinq');
      p.demandes[1].rendre(recus(CINQ, [U(0)])); await tick();
      eq([figures(root).length, etat(root), S.etatApercus().hrefs, S.etatApercus().blobs], [1, null, CINQ, 1], 'la réponse de la seconde issue est écrite par adresse : r0 posée, les quatre autres mémorisées, plus de ligne d’état');
      root.remove();
      // Un échec de l'appel entier d'une autre raison (serveur : `0007` absente → 502) → forme 2, mémorisé pour l'issue ; une réponse sans forme (interne) aussi ;
      // un `annule` arrivé sans abandon aussi. D-UI-14 : dégradé, jamais bloquant ; jamais une boucle de demandes.
      for (const [nom, reponseVol] of [['serveur', { etat: 'echec', raison: 'serveur', extra: {} }], ['annule hors abandon', { etat: 'echec', raison: 'annule', extra: {} }], ['sans forme', undefined], ['delai', { etat: 'echec', raison: 'delai', extra: {} }]]) {
        S.reinitialiserWeb(); p = pilotes(); root = await monter(p);
        await chercheEtRecoit(root, p, [0].map(lien));
        p.demandes[0].rendre(reponseVol); await tick();
        redessiner(root); await tick();
        eq([etat(root)?.textContent, S.etatApercus().hrefs, p.demandes.length, cartes(root).length], ['Photos indisponibles pour cette recherche.', [], 1, 1], `échec « ${nom} » → « indisponibles », rien dans la Map, aucune redemande au redessin (jamais une boucle ; D-UI-14 : dégradé, jamais bloquant — la carte est là)`);
        await chercheEtRecoit(root, p, [0].map(lien), 'Chercher à nouveau');
        eq([p.demandes.length, p.demandes[1]?.a.urls], [2, [U(0)]], `échec « ${nom} » puis « Chercher à nouveau » → l’adresse absente est redemandée (nouvelle issue)`);
        root.remove();
      }
    });

    await run('écran : img.onerror → figure retirée, URL révoquée, entrée remplacée (S-7)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
      URL.revokeObjectURL = (u) => { revoquees.push(u); return vraiRevoke.call(URL, u); };
      try {
        // Des octets que le navigateur ne décode pas, sous un type admis : la Map les accepte (deps.apercus factice), l'<img> lève error.
        // (64 octets indécodables lèvent `error` avant même le premier tour de boucle : l'état « deux figures » n'est pas observable, on attend le FAIT.)
        p.demandes[0].rendre({ etat: 'recus', apercus: new Map([[U(0), { blob: new Blob([new Uint8Array(64).fill(7)], { type: 'image/png' }), type: 'image/png' }], [U(1), IMG]]) });
        await attendre(() => figures(root).length === 1, 'la figure indécodable est retirée');
        const restante = srcs(root)[0];
        eq([cartes(root)[0].firstElementChild.tagName, cartes(root)[1].firstElementChild.matches('figure.apercu'), revoquees.length, revoquees[0]?.startsWith('blob:') && revoquees[0] !== restante, restante.startsWith('blob:'), S.etatApercus()],
          ['A', true, 1, true, true, { hrefs: [U(0), U(1)], blobs: 1, enVol: null }],
          'onerror : la figure de r0 est retirée (la carte commence au titre), son URL révoquée (une seule révocation, pas celle de r1) ; celle de r1 reste ; l’entrée de r0 devient un refus (plus jamais de cadre vide)');
        redessiner(root); await tick();
        eq([figures(root).length, p.demandes.length, etat(root)], [1, 1, null], 'après onerror, un redessin ne recrée pas la figure et ne redemande rien (r1 est posée : pas de ligne d’état)');
      } finally { URL.revokeObjectURL = vraiRevoke; }
    });

    await run('écran : URL révoquées et Blob gardés au changement de route ; révocation au redessin (S-6, D-T9)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2].map(lien));
      p.demandes[0].rendre(recus([U(0), U(1), U(2)], [U(0), U(1)])); await tick();
      const avant = srcs(root);
      const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
      URL.revokeObjectURL = (u) => { revoquees.push(u); return vraiRevoke.call(URL, u); };
      try {
        redessiner(root); await tick();
        const apres = srcs(root);
        eq([avant.length, avant.every((u) => revoquees.includes(u)), apres.length, apres.every((u) => u.startsWith('blob:') && !avant.includes(u))], [2, true, 2, true], 'redessin : les deux URL précédentes sont révoquées APRÈS le remplacement (remplacerEnRevoquant), deux URL neuves depuis les Blob');
        // Le FAIT « images chargées » AVANT de révoquer : une URL blob: révoquée sous un <img> encore en chargement lève `error` plus tard (hors de tout
        // reinitialiserWeb()) ; img.onerror ne touche plus la Map pour une URL déjà révoquée (P-UI2-8), mais le test ne dépend pas du temps.
        await attendre(() => [...root.querySelectorAll('img')].every((i) => i.complete), 'les deux images chargées');
        revoquees.length = 0;
        const n = BU.revoquerUrlsDeBlob(); // ce que fait app.js à chaque changement de route (AVANT de remplacer l'écran : les <img> sont encore attachés)
        eq([n >= 2, apres.every((u) => revoquees.includes(u)), S.etatApercus().blobs], [true, true, 2], 'changement de route : les URL des figures sont révoquées (toutes connues de blob-urls.js), les Blob restent dans la Map');
        // Une `error` TARDIVE d'un <img> dont l'URL est DÉJÀ révoquée (un chargement coupé par la révocation : redessin ou changement de route pendant le
        // chargement), simulée par un événement synthétique sur l'<img> encore attachée : la figure part, le Blob RESTE, aucune révocation de plus (P-UI2-8).
        root.querySelector('figure.apercu img').dispatchEvent(new Event('error'));
        eq([figures(root).length, S.etatApercus().blobs, revoquees.length], [1, 2, n], 'error après révocation : la figure est retirée, le Blob reste (aucun image_refusee écrit), aucune révocation de plus');
        root.remove();
        const root2 = await monter(p); // une nouvelle instance de la route : la mémoire porte le « trouvé », les Blob sont là
        const neuves = srcs(root2);
        eq([p.demandes.length, figures(root2).length, neuves.every((u) => u.startsWith('blob:') && !apres.includes(u)), etat(root2)], [1, 2, true, null], 'nouvelle instance : deux figures recréées depuis les Blob (URL neuves), ZÉRO appel d’aperçus, pas de ligne d’état');
        root2.remove();
      } finally { URL.revokeObjectURL = vraiRevoke; }
    });

    await run('écran : deps.chercher sans deps.apercus → 0 appel ; une vue déconnectée ne demande rien, son montage demande UNE fois (R-UI2-7) ; reinitialiserWeb() vide tout (F-10, S-4)', async () => {
      S.reinitialiserWeb();
      let p = pilotes();
      const reseauAvant = reseau;
      let root = await S.renderSearch({}, { mode: 'web', q: 'puttanesca' }, ctxDe(), { chercher: p.chercher, navigate: () => {}, remplacerAdresse: () => {} }); scene.append(root);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      eq([p.demandes.length, reseau - reseauAvant, S.etatApercus(), etat(root), figures(root).length, cartes(root).length], [0, 0, { hrefs: [], blobs: 0, enVol: null }, null, 0, 2],
        'deps.chercher injecté sans deps.apercus : aucun aperçu demandé (ni factice ni réseau), ni ligne d’état ni figure ; les cartes sont celles d’avant le lot');
      root.remove();
      // Une vue déconnectée ne demande rien : la mémoire porte un « trouvé » aux aperçus absents (vol abandonné par la déconnexion de la première vue).
      // R-UI2-7 : au MONTAGE (première fois que root.isConnected devient vrai), la vue vérifie UNE fois, dans une microtâche, et demande ce qui manque.
      S.reinitialiserWeb(); p = pilotes();
      root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      root.remove(); await tick(); // dernière vue déconnectée : le vol est abandonné, les adresses restent absentes
      const root2 = await S.renderSearch({}, { mode: 'web', q: 'puttanesca' }, ctxDe(), { chercher: p.chercher, apercus: p.apercus, navigate: () => {}, remplacerAdresse: () => {} }); // PAS montée
      eq([p.demandes.length, cartes(root2).length, etat(root2)], [1, 2, null], 'vue déconnectée : le « trouvé » est rendu (deux cartes) mais aucun aperçu n’est demandé, aucune ligne d’état');
      await tick();
      eq(p.demandes.length, 1, 'vue déconnectée : un tour de boucle plus tard, toujours aucune demande (rien ne part avant le montage)');
      scene.append(root2); await tick();
      const dVol = p.demandes[1];
      eq([p.demandes.length, dVol?.a.urls, etat(root2)?.textContent, cartes(root2).length], [2, [U(0), U(1)], 'Photos en cours de récupération…', 2], 'R-UI2-7 : le MONTAGE de la vue demande les adresses absentes (une demande, après le montage), et la ligne « en cours » paraît');
      redessiner(root2); await tick();
      eq([p.demandes.length, S.etatApercus().enVol], [2, [U(0), U(1)]], 'R-UI2-7 : une seule fois — un redessin connecté pendant ce vol ne pose pas de second appel');
      // reinitialiserWeb() PENDANT un vol (S-4 : le quatrième abandon) — la seule assertion de la suite qui tue le mutant « abandonnerApercus() retiré de
      // reinitialiserWeb() » : partout ailleurs, reinitialiserWeb() ouvre un bloc après un vol résolu (enVol déjà null, la Map vidée par apercus.clear()).
      S.reinitialiserWeb();
      eq([dVol.d.signal.aborted, S.etatApercus()], [true, { hrefs: [], blobs: 0, enVol: null }], 'reinitialiserWeb() pendant un vol : signal levé, plus de vol, Map vide');
      dVol.rendre(recus([U(0), U(1)], [U(0)])); await tick();
      eq(S.etatApercus().hrefs, [], 'reinitialiserWeb() : le résultat tardif du vol abandonné est muet');
      root2.remove(); // reinitialiserWeb() a vidé `vues` : cette vue ne serait plus redessinée — un vol FRAIS passe par une vue neuve
      p = pilotes();
      const root3 = await monter(p);
      await chercheEtRecoit(root3, p, [0, 1].map(lien));
      p.demandes[0].rendre(recus([U(0), U(1)], [U(0)])); await tick();
      eq(S.etatApercus(), { hrefs: [U(0), U(1)], blobs: 1, enVol: null }, 'réception : la Map est peuplée');
      S.reinitialiserWeb();
      eq([S.etatApercus(), S.etatWeb()], [{ hrefs: [], blobs: 0, enVol: null }, { cle: null, enCours: false, memoire: null }], 'reinitialiserWeb() : la Map des aperçus est vidée (Blob lâchés) avec la mémoire et les vols');
      root3.remove();
      // R-UI2-7, le montage quand tout est connu ou qu'un vol tient déjà : rien ne part (même règle que le redessin connecté).
      p = pilotes();
      const root4 = await monter(p);
      await chercheEtRecoit(root4, p, [0, 1].map(lien));
      const root5 = await S.renderSearch({}, { mode: 'web', q: 'puttanesca' }, ctxDe(), { chercher: p.chercher, apercus: p.apercus, navigate: () => {}, remplacerAdresse: () => {} });
      scene.append(root5); await tick();
      eq([p.demandes.length, S.etatApercus().enVol], [1, [U(0), U(1)]], 'R-UI2-7 : une seconde vue montée pendant le vol ne pose pas de second appel');
      p.demandes[0].rendre(recus([U(0), U(1)], [U(0)])); await tick();
      root4.remove(); root5.remove();
      const root6 = await S.renderSearch({}, { mode: 'web', q: 'puttanesca' }, ctxDe(), { chercher: p.chercher, apercus: p.apercus, navigate: () => {}, remplacerAdresse: () => {} });
      scene.append(root6); await tick();
      eq([p.demandes.length, figures(root6).length, etat(root6)], [1, 1, null], 'R-UI2-7 : une vue montée quand tout est connu ne demande rien (figure depuis le Blob, pas de ligne)');
      root6.remove();
    });

    await run('écran : texte de garde « 2 appels » et dictionnaire (§ 5, I-UI-1)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p, { q: '' });
      const texte = root.textContent;
      eq([texte.includes('Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.'), texte.includes('Une recherche = un appel à l’assistant'), p.demandes.length, p.recherches.length], [true, false, 0, 0],
        'garde : « Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour. » AVANT la tape ; l’ancienne phrase a disparu ; aucun appel au rendu');
      eq([EN['Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.'], EN['Photos en cours de récupération…'], EN['Photos indisponibles pour cette recherche.'], EN['Quota du jour atteint : photos indisponibles.'], 'Une recherche = un appel à l’assistant, compté dans ton quota du jour.' in EN],
        ['One search = 2 assistant calls (results, then photos), counted in your daily quota.', 'Fetching photos…', 'Photos unavailable for this search.', 'Daily quota reached: photos unavailable.', false], 'en.js : les quatre traductions de la spec § 5 ; l’ancienne clé « un appel » est retirée');
      root.remove();
    });

    await run('statiques : SHELL, filet i18n, aucune marque dans le domaine, test de source I-F3, styles.css (I-UI-2, S-16, R-UI2-9)', async () => {
      const sw = await lire('../sw.js');
      const { MODULES_NEUFS } = await import('./ajouter.js');
      const srcA = await lire('../src/domain/apercu-web.js');
      const srcS = await lire('../src/ui/search.js');
      ok(sw.length > 300 && sw.includes("'./src/domain/apercu-web.js'"), 'SHELL : ./src/domain/apercu-web.js (le graphe d’imports de tests/sync.js l’exige aussi)');
      ok(MODULES_NEUFS.includes('../src/domain/apercu-web.js'), 'MODULES_NEUFS (tests/ajouter.js) : apercu-web.js est scanné par le filet i18n');
      eq([srcA.length > 300, /Anthropic|Supabase/i.test(srcA), /\bt\(/.test(srcA)], [true, false, false], 'apercu-web.js : lu ; ne nomme ni le fournisseur ni la base ; aucun texte d’écran (t) dans le domaine');
      eq([srcS.length > 300, /(?:\bsrc\s*:|\.src\s*=)\s*['"`]https?:/.test(srcS), srcS.includes("from '../domain/apercu-web.js'"), srcS.includes("'plat-vignette grande'")], [true, false, true, true], 'search.js : aucun src d’image https écrit en dur (I-F3) ; importe le domaine des aperçus ; la figure garde la classe plat-vignette (révocation D-T9)');
      // R-UI2-9 : ce lot POSE les deux règles de la figure dans styles.css, avec les jetons seuls (aucune couleur, aucun display: none, aucun 56px).
      const css = (await lire('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
      const regleDe = (sel) => { const m = css.match(new RegExp('(?:^|\\})\\s*' + sel.replace(/[.\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')); return m ? Object.fromEntries(m[1].split(';').map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]).filter(([k, v]) => k && v)) : null; };
      const grande = regleDe('.plat-vignette.grande'); const fig = regleDe('figure.apercu');
      eq([grande?.width, grande?.height, grande?.['aspect-ratio'], grande?.['object-fit'], grande?.['border-radius'], grande?.display], ['100%', 'auto', '4 / 3', 'cover', '12px', 'block'], 'styles.css : .plat-vignette.grande { width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; display: block } (R-UI2-9 : la figure n’hérite plus des 72 × 72 px)');
      eq(fig, { margin: '0 0 .6rem' }, 'styles.css : figure.apercu { margin: 0 0 .6rem } (R-UI2-9 : la marge UA de la figure, par la feuille, pas en ligne)');
      const corps = [grande, fig].map((d) => JSON.stringify(d ?? {}));
      ok(corps.every((c) => !/display\s*"?:\s*"?none/.test(c) && !/#[0-9a-f]{3,8}\b/i.test(c) && !/56px/.test(c) && !/\b(?:white|black|red|olive|green)\b/.test(c)), 'styles.css : les deux règles neuves ne portent ni couleur, ni display: none, ni 56px (T-1, T-2, T-11 de tests/theme.js)');
    });
  } finally { globalThis.fetch = vraiFetch; scene?.remove(); S?.reinitialiserWeb(); BU?.revoquerUrlsDeBlob(); setUiLocale(localeAvant); }
}
