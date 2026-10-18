// Tests du lot « Passerelle de l'assistant », tâche 3 (spec docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md).
// L'app n'appelle plus jamais api.anthropic.com : elle poste à la fonction `assistant` de Supabase avec la SESSION de la personne
// (Authorization: Bearer <access_token>) et la clé PUBLIQUE du projet (apikey). Aucune clé ici : seul un jeton factice. Zéro réseau :
// `fetch` est toujours injecté (jamais le global). Le jeton ne doit apparaître dans AUCUN objet rendu.
export async function runPasserelleTests({ eq, ok }) {
  const P = await import('../src/domain/passerelle.js');
  const { SUPABASE, currentConfig } = await import('../src/sync/config.js');
  const lire = async (chemin) => { const r = await fetch(chemin + '?v=' + Date.now(), { cache: 'no-store' }); return r.ok ? r.text() : `ERREUR ${r.status}`; };
  const JETON = 'jeton-factice-0123';
  const SESSION = { access_token: JETON, user: { id: 'u1', email: 'a@exemple.invalid' } };
  const CONFIG = SUPABASE.prod;
  const URL_ATTENDUE = 'https://ybdooerfeziiabsbfxtb.supabase.co/functions/v1/assistant';
  const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
  const resultats = []; // V-F2 : CHAQUE résultat rendu est contrôlé en fin de bloc (ni le jeton, ni « access_token », ni un corps d'erreur)
  const garde = (r) => { resultats.push(r); return r; };

  // --- URL et constantes
  {
    eq(P.CHEMIN_ASSISTANT, '/functions/v1/assistant', 'passerelle : le chemin de la fonction');
    eq(P.urlAssistant(CONFIG), URL_ATTENDUE, 'urlAssistant : l’adresse du projet (prod) + le chemin');
    eq(P.urlAssistant({ url: 'https://x.supabase.co/', anonKey: 'k' }), 'https://x.supabase.co/functions/v1/assistant', 'urlAssistant : une barre finale de l’adresse du projet n’est pas doublée');
    eq([P.urlAssistant(null), P.urlAssistant({}), P.urlAssistant({ url: '' }), P.urlAssistant({ url: 7 })], [null, null, null, null], 'urlAssistant : sans configuration (hôte inconnu) → null');
    eq(P.urlAssistant(), P.urlAssistant(currentConfig()), 'urlAssistant : sans argument, la configuration de l’hôte courant (currentConfig)');
    eq([P.sessionValide(SESSION), P.sessionValide({ access_token: 'x' }), P.sessionValide(null), P.sessionValide({}), P.sessionValide({ access_token: '' }), P.sessionValide({ access_token: 5 }), P.sessionValide({ access_token: 'a b' }), P.sessionValide({ access_token: 'é' })], [true, true, false, false, false, false, false, false], 'sessionValide : un jeton non vide fait de caractères ASCII visibles seulement (sinon fetch lèverait avant tout réseau)');
  }

  // --- Sans session : non_connecte, AUCUN fetch (POST et GET)
  {
    let n = 0; const f = async () => { n += 1; return reponse(200, {}); };
    for (const [nom, session] of [['absente', undefined], ['null', null], ['sans jeton', { user: { id: 'u1' } }], ['jeton vide', { access_token: '' }], ['jeton non chaîne', { access_token: 12 }], ['jeton à espace', { access_token: 'a b' }]]) {
      const r = garde(await P.appelerAssistant('recherche-web', { messages: [] }, { fetch: f, session, config: CONFIG }));
      const e = garde(await P.etatAssistant({ fetch: f, session, config: CONFIG }));
      eq([r.statut, r.corps, r.raison, r.quota, e.statut, e.corps, e.raison, n], [0, null, 'non_connecte', null, 0, null, 'non_connecte', 0], `sans session (${nom}) : non_connecte, aucun fetch, ni en POST ni en GET`);
    }
    eq([garde(await P.appelerAssistant('creation', {}, { fetch: f, session: SESSION, config: null })).raison, garde(await P.appelerAssistant('creation', {}, { fetch: f, session: SESSION, config: { url: 'https://x.supabase.co' } })).raison, n], ['non_connecte', 'non_connecte', 0], 'sans configuration de projet sur cette origine (ou sans clé publique) : non_connecte, aucun fetch');
  }

  // --- La requête exacte
  {
    const appels = [];
    const f = function (url, options) { appels.push({ url, options, self: this }); return Promise.resolve(reponse(200, { content: [{ type: 'text', text: 'OK' }], model: 'claude-x' })); };
    const corps = { system: 'S', messages: [{ role: 'user', content: 'U' }], max_tokens: 5 };
    const r = garde(await P.appelerAssistant('extraction', corps, { fetch: f, session: SESSION, config: CONFIG }));
    eq(appels.length, 1, 'requête : un seul fetch');
    const a = appels[0];
    ok(a.self === undefined, 'requête : fetch est appelé comme fonction libre, sans this (Illegal invocation)');
    eq(a.url, URL_ATTENDUE, 'requête : l’adresse EXACTE de la fonction assistant du projet');
    ok(new URL(a.url).host.endsWith('.supabase.co') && new URL(a.url).protocol === 'https:', 'requête : en https, vers un hôte *.supabase.co');
    eq(a.options.method, 'POST', 'requête : POST');
    eq(a.options.headers, { 'content-type': 'application/json', apikey: SUPABASE.prod.anonKey, authorization: 'Bearer jeton-factice-0123' }, 'requête : EXACTEMENT trois en-têtes — content-type, la clé PUBLIQUE en apikey, le jeton de la session en Bearer');
    eq(Object.keys(a.options.headers).filter((k) => /x-api-key|anthropic/i.test(k)), [], 'requête : jamais x-api-key ni un en-tête anthropic-*');
    eq([a.options.redirect, a.options.credentials, a.options.cache, a.options.referrerPolicy, a.options.mode], ['error', 'omit', 'no-store', 'no-referrer', 'cors'], 'requête : redirect error (le jeton ne suit jamais une redirection), credentials omit, no-store, no-referrer, cors');
    ok(a.options.signal instanceof AbortSignal, 'requête : un signal d’abandon est posé');
    eq(JSON.parse(a.options.body), { outil: 'extraction', corps }, 'requête : le corps est { outil, corps }, tel quel, SANS model (le serveur le choisit)');
    ok(!a.options.body.includes(JETON) && !a.url.includes(JETON), 'requête : le jeton n’est ni dans le corps ni dans l’adresse');
    eq([r.statut, r.raison, r.quota, r.corps.content[0].text, r.corps.model], [200, null, null, 'OK', 'claude-x'], 'résultat 200 : { statut, corps (le JSON de la réponse), raison null, quota null }');
    // L'alerte : une passerelle qui posterait ailleurs (le mutant de la tâche) fait rougir CE contrôle.
    ok(appels.every((x) => new URL(x.url).host.endsWith('.supabase.co') && x.url.endsWith(P.CHEMIN_ASSISTANT)), 'garde-fou : toute requête de ce bloc va à …supabase.co/functions/v1/assistant, jamais ailleurs');
  }

  // --- Statuts → raisons (R-T3-4) ; le champ `erreur` de la passerelle prime ; AUCUN corps d'erreur n'est relayé
  {
    const SENTINELLE = 'CORPS-SENTINELLE';
    const statut = async (s, corps) => { const f = async () => reponse(s, corps); return garde(await P.appelerAssistant('recherche-web', {}, { fetch: f, session: SESSION, config: CONFIG })); };
    const anthropic = { type: 'error', error: { type: 'x', message: SENTINELLE } }; // un corps d'erreur d'Anthropic relayé : SANS champ `erreur`
    for (const [s, raison] of [[401, 'non_connecte'], [403, 'serveur'], [413, 'trop_lourd'], [400, 'requete'], [422, 'requete'], [404, 'requete'], [418, 'requete'], [429, 'quota'], [500, 'serveur'], [502, 'serveur'], [503, 'serveur'], [504, 'delai'], [529, 'serveur'], [204, 'serveur'], [302, 'serveur']]) {
      const r = await statut(s, anthropic);
      eq([r.statut, r.corps, r.raison, r.ecrite], [s, null, raison, false], `statut ${s} sans champ erreur → ${raison}, corps null (le corps d’erreur n’est jamais relayé), ecrite: false`);
    }
    { // un 403 RELAYÉ d'Anthropic (permission_error, ex. « web search not enabled ») n'est PAS un compte non admis : la passerelle écrit toujours `erreur` pour ses propres 403
      const r = await statut(403, { type: 'error', error: { type: 'permission_error', message: 'x' } });
      eq([r.raison, r.ecrite, r.corps], ['serveur', false, null], 'statut 403 relayé d’Anthropic (permission_error, sans champ erreur) → serveur, ecrite: false');
      const a = await statut(403, { erreur: 'non_admis' }); const o = await statut(403, { erreur: 'origine' });
      eq([a.raison, a.ecrite, o.raison, o.ecrite], ['non_admis', true, 'non_admis', true], 'statut 403 { erreur: non_admis } ou { erreur: origine } (écrits par la passerelle) → non_admis, ecrite: true');
    }
    const q = await statut(429, { erreur: 'quota', quota: 60 });
    eq([q.statut, q.raison, q.quota, q.corps], [429, 'quota', 60, null], '429 { erreur: quota, quota: 60 } → quota, avec quota: 60');
    eq([(await statut(429, anthropic)).quota, (await statut(429, anthropic)).ecrite, q.ecrite], [null, false, true], '429 relayé d’Anthropic (sans champ erreur) : quota null et ecrite false — le domaine y lit « trop de demandes », pas « limite du jour »');
    { const sansNombre = await statut(429, { erreur: 'quota' }); eq([sansNombre.raison, sansNombre.quota, sansNombre.ecrite], ['quota', null, true], '429 { erreur: quota } sans nombre : raison quota, quota null, ecrite true (c’est ecrite, pas quota === null, qui distingue la passerelle d’Anthropic)'); }
    eq([P.echecDomaine({ raison: 'quota', quota: 60, ecrite: true }), P.echecDomaine({ raison: 'quota', quota: null, ecrite: true }), P.echecDomaine({ raison: 'quota', quota: null, ecrite: false }), P.echecDomaine({ raison: 'quota', quota: 60, ecrite: false })],
      [{ raison: 'quota', extra: { quota: 60 } }, { raison: 'quota', extra: { quota: null } }, { raison: 'trop_de_demandes', extra: {} }, { raison: 'trop_de_demandes', extra: {} }], 'echecDomaine : un quota écrit par la passerelle → quota (nombre ou null) ; un 429 non écrit → trop_de_demandes'); 
    eq([(await statut(429, { erreur: 'quota', quota: '60' })).quota, (await statut(429, { erreur: 'quota', quota: -1 })).quota, (await statut(429, { erreur: 'quota', quota: 1.5 })).quota, (await statut(429, { erreur: 'quota' })).quota], [null, null, null, null], 'quota : seulement un entier positif ou nul, sinon null');
    eq([(await statut(401, { erreur: 'non_connecte' })).raison, (await statut(403, { erreur: 'non_admis' })).raison, (await statut(403, { erreur: 'origine' })).raison, (await statut(405, { erreur: 'methode' })).raison, (await statut(400, { erreur: 'requete' })).raison, (await statut(413, { erreur: 'trop_lourd' })).raison, (await statut(422, { erreur: 'bornes' })).raison, (await statut(502, { erreur: 'serveur' })).raison, (await statut(504, { erreur: 'delai' })).raison],
      ['non_connecte', 'non_admis', 'non_admis', 'requete', 'requete', 'trop_lourd', 'requete', 'serveur', 'delai'], 'champ erreur de la passerelle : lu, et ramené aux raisons connues (origine → non_admis, methode et bornes → requete)');
    eq([(await statut(502, { erreur: 'constructor' })).raison, (await statut(502, { erreur: '__proto__' })).raison, (await statut(403, { erreur: 'toString' })).raison, (await statut(500, { erreur: 7 })).raison, (await statut(500, { erreur: ['quota'] })).raison, (await statut(500, 'pas du json')).raison, (await statut(500, '')).raison], ['serveur', 'serveur', 'serveur', 'serveur', 'serveur', 'serveur', 'serveur'], 'champ erreur inconnu, hérité du prototype ou mal typé, corps illisible ou vide : le statut seul classe');
    ok(!JSON.stringify(resultats).includes(SENTINELLE), 'aucun corps d’erreur n’est recopié dans un résultat (le champ erreur de la passerelle est le seul lu)');
  }

  // --- Réseau, délai, abandon, corps
  {
    const lancer = async (f, deps = {}) => garde(await P.appelerAssistant('creation', {}, { fetch: f, session: SESSION, config: CONFIG, ...deps }));
    eq((await lancer(async () => { throw new TypeError('Failed to fetch'); })).raison, 'reseau', 'réseau : TypeError (dont celui d’une redirection refusée) → reseau');
    eq((await lancer(() => { throw new RangeError('coupé'); })).raison, 'reseau', 'réseau : fetch qui lève de façon synchrone → reseau');
    const sourd = (url, options) => new Promise((_, rejeter) => { options.signal.addEventListener('abort', () => rejeter(new DOMException('abandon', 'AbortError')), { once: true }); });
    eq((await lancer(sourd, { tentativeMs: 1 })).raison, 'delai', 'délai : abandon par le chrono local → delai');
    {
      const c = new AbortController(); const appels = [];
      const f = (url, options) => { appels.push(options); return sourd(url, options); };
      const p = lancer(f, { signal: c.signal, tentativeMs: 60000 }); c.abort();
      eq([appels[0]?.signal.aborted, (await p).raison], [true, 'annule'], 'abandon : le signal extérieur abandonne AUSSITÔT le signal du fetch → annule');
    }
    { const c = new AbortController(); c.abort(); let n = 0; const r = await lancer(async () => { n += 1; return reponse(200, {}); }, { signal: c.signal }); eq([r.raison, n], ['annule', 0], 'abandon : un signal déjà abandonné → annule, aucun fetch'); }
    {
      // Abandon extérieur PENDANT la lecture du corps d'une réponse d'erreur : annule, pas la raison du statut.
      const c = new AbortController(); let finir; const attente = new Promise((res) => { finir = res; }); let commence; const lecture = new Promise((res) => { commence = res; });
      const p = lancer(async () => ({ ok: false, status: 400, headers: new Headers(), text: () => { commence(); return attente; } }), { signal: c.signal, tentativeMs: 60000 });
      await lecture; c.abort(); finir('{"erreur":"requete"}');
      eq((await p).raison, 'annule', 'abandon : signal extérieur pendant la lecture du corps d’une erreur → annule');
    }
    {
      // Un fetch sourd au signal : une réponse arrivée APRÈS l'abandon extérieur ne rend jamais un résultat.
      const c = new AbortController();
      const p = lancer(async () => { await new Promise((r) => setTimeout(r, 15)); return reponse(200, { content: [] }); }, { signal: c.signal });
      c.abort();
      eq((await p).raison, 'annule', 'abandon : un fetch sourd au signal, réponse arrivée après l’abandon → annule, pas un résultat');
    }
    // Corps : trop gros (JSON VALIDE — seule la borne peut le refuser), illisible, de mauvaise forme
    eq((await lancer(async () => new Response(new Blob([JSON.stringify({ content: [], bourrage: 'x'.repeat(4096) })]), { status: 200 }), { corpsMax: 1024 })).raison, 'reponse_illisible', 'corps : une vraie Response en flux, JSON valide > corpsMax → reponse_illisible (lireBornee)');
    { const r = await lancer(async () => new Response(new Blob([JSON.stringify({ content: [{ type: 'text', text: 'ok' }] })]), { status: 200, headers: { 'content-type': 'application/json' } }), { corpsMax: 1024 }); eq([r.statut, r.raison, r.corps?.content?.[0]?.text], [200, null, 'ok'], 'corps : une vraie Response en flux sous la borne → lue (le chemin de la production)'); }
    eq((await lancer(async () => reponse(200, 'x'.repeat(2000)), { corpsMax: 1024 })).raison, 'reponse_illisible', 'corps : une réponse sans flux (text()) plus longue que corpsMax → reponse_illisible');
    eq([(await lancer(async () => reponse(200, 'pas du json'))).raison, (await lancer(async () => reponse(200, '[]'))).raison, (await lancer(async () => reponse(200, 'null'))).raison, (await lancer(async () => reponse(200, '7'))).raison, (await lancer(async () => reponse(200, ''))).raison], ['reponse_illisible', 'reponse_illisible', 'reponse_illisible', 'reponse_illisible', 'reponse_illisible'], 'corps : JSON invalide, tableau, null, nombre ou vide → reponse_illisible');
    eq([(await lancer(async () => ({}))).raison, (await lancer(async () => null)).raison, (await lancer(async () => ({ ok: true, status: 200 }))).raison], ['interne', 'interne', 'interne'], 'filet : une réponse sans statut, nulle, ou un 200 sans corps lisible ni text() → interne (jamais reseau)');
    // Le corps d'erreur trop gros n'est pas lu en entier : le statut classe quand même
    eq((await lancer(async () => new Response(new Blob(['x'.repeat(4096)]), { status: 502 }), { corpsErreurMax: 1024 })).raison, 'serveur', 'erreur : un corps d’erreur plus gros que corpsErreurMax est écarté, le statut classe');
  }

  // --- Le corps de la requête est calculé HORS du try du réseau : une exception y est `interne`, jamais `reseau`, sans fetch
  {
    const piege = { get messages() { throw new Error('corps piege'); } };
    let n = 0; const vus = []; const vraiErreur = console.error; console.error = (...a) => { vus.push(a); };
    let r; try { r = garde(await P.appelerAssistant('creation', piege, { fetch: async () => { n += 1; return reponse(200, {}); }, session: SESSION, config: CONFIG })); } finally { console.error = vraiErreur; }
    eq([r.statut, r.raison, n], [0, 'interne', 0], 'filet : une exception pendant le calcul du corps → interne, aucun fetch (jamais reseau)');
    eq(vus.length, 0, 'filet : la passerelle ne journalise rien — c’est l’appelant (le module de domaine) qui journalise, sous son code, sans le jeton ni le texte de l’erreur');
  }

  // --- etatAssistant : GET sans dépense
  {
    const appels = [];
    const f = function (url, options) { appels.push({ url, options, self: this }); return Promise.resolve(reponse(200, { modele: 'claude-sonnet-5-5', quotaJour: 60 })); };
    const r = garde(await P.etatAssistant({ fetch: f, session: SESSION, config: CONFIG }));
    const a = appels[0];
    eq([appels.length, a.self === undefined, a.url, a.options.method, a.options.body], [1, true, URL_ATTENDUE, 'GET', undefined], 'état : un seul GET à la même adresse, sans corps');
    eq(a.options.headers, { 'content-type': 'application/json', apikey: SUPABASE.prod.anonKey, authorization: 'Bearer jeton-factice-0123' }, 'état : les mêmes en-têtes que le POST, jamais x-api-key');
    eq([a.options.redirect, a.options.credentials, a.options.cache, a.options.referrerPolicy, a.options.mode, a.options.signal instanceof AbortSignal], ['error', 'omit', 'no-store', 'no-referrer', 'cors', true], 'état : mêmes options réseau (redirect error, credentials omit)');
    eq([r.statut, r.corps, r.raison], [200, { modele: 'claude-sonnet-5-5', quotaJour: 60 }, null], 'état : { modele, quotaJour } et rien d’autre');
    const lancer = async (s, corps) => garde(await P.etatAssistant({ fetch: async () => reponse(s, corps), session: SESSION, config: CONFIG }));
    eq((await lancer(200, { modele: 'm'.repeat(200), quotaJour: 60, secret: 'AUTRE' })).corps, { modele: 'm'.repeat(80), quotaJour: 60 }, 'état : le modèle est borné à 80 points de code, un champ en trop n’est pas rendu');
    eq((await lancer(200, { modele: 7, quotaJour: 'beaucoup' })).corps, { modele: null, quotaJour: null }, 'état : un champ mal typé vaut null');
    eq([(await lancer(403, { erreur: 'non_admis' })).raison, (await lancer(401, { erreur: 'non_connecte' })).raison, (await lancer(502, {})).raison, (await lancer(200, 'x')).raison, (await lancer(200, '[]')).raison], ['non_admis', 'non_connecte', 'serveur', 'reponse_illisible', 'reponse_illisible'], 'état : 403 → non_admis, 401 → non_connecte, 502 → serveur, corps illisible → reponse_illisible');
    eq([garde(await P.etatAssistant({ fetch: async () => { throw new TypeError('x'); }, session: SESSION, config: CONFIG })).raison], ['reseau'], 'état : réseau coupé → reseau');
  }

  // --- Le jeton n'apparaît dans AUCUN objet rendu
  {
    const fautifs = resultats.filter((r) => /access_token|jeton-factice/.test(JSON.stringify(r)));
    eq([resultats.length, resultats.every((r) => r && typeof r === 'object' && 'raison' in r), fautifs.length], [86, true, 0], `jeton : ${resultats.length} résultats contrôlés (tous de vrais résultats, aucune promesse), aucun ne contient « access_token » ni la valeur du jeton (R-T3-2)`);
  }

  // --- Le fournisseur de l'app : PasserelleProvider (extraction de pages), providerFrom
  {
    const L = await import('../src/domain/llm.js');
    const journal = [];
    const f = async (url, options) => { journal.push({ url, options }); return reponse(200, { model: 'claude-sonnet-5-5', content: [{ type: 'text', text: '{"title":"Tarte","ingredients":[{"source_text":"2 oeufs"}],"steps":[{"text":"Cuire."}]}' }] }); };
    const p = new L.PasserelleProvider({}, { session: SESSION, fetch: f });
    eq([p.name, p.configured, p.supportsVision, p.supportsWebSearch], ['anthropic', true, true, true], 'PasserelleProvider : name reste anthropic (gardes des écrans), configuré par la session, vision et recherche web');
    const images = [{ mime: 'image/jpeg', base64: 'AAAA' }, { mime: 'image/png', base64: 'BBBB' }];
    const recette = await L.extractRecipeFromImages(p, images);
    eq(journal.length, 1, 'extraction : un seul appel');
    const corps = JSON.parse(journal[0].options.body);
    eq([journal[0].url, journal[0].options.method, journal[0].options.headers.authorization, journal[0].options.headers.apikey, journal[0].options.redirect, journal[0].options.credentials, corps.outil], [URL_ATTENDUE, 'POST', 'Bearer jeton-factice-0123', SUPABASE.prod.anonKey, 'error', 'omit', 'extraction'], 'extraction : POST à la passerelle, outil extraction, jeton en Bearer, apikey publique');
    eq(corps.corps.messages[0].content.filter((b) => b.type === 'image'), [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'BBBB' } }], 'extraction : les blocs image partent tels quels (base64, type MIME)');
    eq([typeof corps.corps.system, corps.corps.system.includes('Recipe Parser'), corps.corps.messages.length, corps.corps.messages[0].role, 'model' in corps.corps, 'model' in corps, typeof corps.corps.max_tokens], ['string', true, 1, 'user', false, false, 'number'], 'extraction : le message system devient le champ system, un seul message user, jamais de model');
    eq([recette.title, recette.ingredients.map((i) => i.source_text), recette.steps.map((s) => s.text)], ['Tarte', ['2 oeufs'], ['Cuire.']], 'extraction : la recette lue passe par le validateur habituel');
    const sortie = await p.complete([{ role: 'user', content: 'U' }], { maxTokens: 5 });
    eq([sortie.startsWith('{"title"'), JSON.parse(journal[1].options.body).corps.max_tokens], [true, 5], 'complete : rend le texte des blocs text ; max_tokens transmis');
    ok(journal.every((x) => new URL(x.url).host.endsWith('.supabase.co')), 'extraction : toutes les requêtes vont à …supabase.co');
    // Échecs : la raison devient le message de l'Error ; le corps de la réponse n'y est pas
    for (const [s, corpsErr, message] of [[401, { erreur: 'non_connecte' }, 'non_connecte'], [403, { erreur: 'non_admis' }, 'non_admis'], [429, { erreur: 'quota', quota: 60 }, 'quota'], [502, { erreur: 'serveur', detail: 'CORPS-SENTINELLE' }, 'serveur']]) {
      let erreur = null; try { await new L.PasserelleProvider({}, { session: SESSION, fetch: async () => reponse(s, corpsErr) }).complete([{ role: 'user', content: 'U' }]); } catch (e) { erreur = e; }
      eq([erreur instanceof Error, erreur?.message], [true, message], `complete : ${s} → Error(« ${message} »), sans le corps de la réponse`);
    }
    { let n = 0; let erreur = null; try { await new L.PasserelleProvider({}, { session: null, fetch: async () => { n += 1; return reponse(200, {}); } }).complete([{ role: 'user', content: 'U' }]); } catch (e) { erreur = e; } eq([erreur?.message, n], ['non_connecte', 0], 'complete : sans session → Error(non_connecte), aucun fetch'); }
    // providerFrom : la session décide, plus aucune clé locale
    const avecCle = { llm: { provider: 'anthropic', api_key: 'sk-factice-locale', model: 'm' } };
    const sans = L.providerFrom(avecCle);
    eq([sans.name, sans.configured, sans.supportsWebSearch], ['none', false, false], 'providerFrom : sans session, une clé locale ne sert plus — NoneProvider (le chemin direct n’existe plus)');
    const avec = L.providerFrom({ llm: { provider: 'none' } }, { session: SESSION });
    eq([avec.name, avec.configured, avec.supportsWebSearch, avec.supportsVision, avec instanceof L.PasserelleProvider], ['anthropic', true, true, true, true], 'providerFrom : une session → PasserelleProvider, quel que soit settings.llm');
    eq([L.providerFrom(undefined, { session: SESSION }).name, L.providerFrom(null).name, L.providerFrom({}, {}).name, L.providerFrom({}, { session: { access_token: '' } }).name], ['anthropic', 'none', 'none', 'none'], 'providerFrom : réglages absents tolérés ; un jeton vide n’est pas une session');
    const oc = L.providerFrom({ llm: { provider: 'openai_compatible', api_key: 'k', model: 'm' } });
    eq([oc.name, oc.configured, oc.supportsWebSearch, L.providerFrom({ llm: { provider: 'openai_compatible', api_key: '', model: 'm' } }).name, L.providerFrom({ llm: { provider: 'openai_compatible', api_key: 'k', model: 'm' } }, { session: SESSION }).name], ['openai_compatible', true, false, 'none', 'anthropic'], 'providerFrom : le fournisseur compatible OpenAI ne se rend que sans session et avec une clé (inchangé) ; une session gagne');
    eq([typeof L.ANTHROPIC_MESSAGES_URL, typeof L.anthropicHeaders, typeof L.AnthropicProvider], ['undefined', 'undefined', 'undefined'], 'llm : ANTHROPIC_MESSAGES_URL, anthropicHeaders et AnthropicProvider n’existent plus');
    // Sans session, l'extraction refuse AVANT tout appel
    {
      let n2 = 0; const vf = globalThis.fetch; globalThis.fetch = async () => { n2 += 1; throw new Error('aucun reseau attendu'); };
      let e2 = null; try { await L.extractRecipeFromImages(L.providerFrom(avecCle), images); } catch (e) { e2 = e; } finally { globalThis.fetch = vf; }
      eq([e2?.message, n2], ['Assistant IA non configuré', 0], 'extraction : sans session, « Assistant IA non configuré » avant tout appel (le fetch global n’est jamais touché)');
    }
  }

  // --- auth.jeton() : la session-donnée, lue sans réseau, jamais ailleurs que dans la valeur rendue
  {
    const { createAuth } = await import('../src/sync/auth.js');
    const fenetre = { location: { search: '', hash: '', pathname: '/', origin: 'https://exemple.invalid' }, history: { replaceState() {} } };
    const fabrique = (getSession) => () => ({ auth: { getSession } });
    const creer = (getSession) => createAuth({ config: { url: 'https://x.supabase.co', anonKey: 'cle-publique' }, factory: fabrique(getSession), win: fenetre });
    const vus = []; const vraiErreur = console.error; console.error = (...a) => { vus.push(a); };
    try {
    const session = { access_token: JETON, refresh_token: 'RAFRAICHIR', expires_at: 1, user: { id: 'u1', email: 'a@exemple.invalid', phone: '555' } };
    eq(await creer(async () => ({ data: { session }, error: null })).jeton(), { access_token: JETON, user: { id: 'u1', email: 'a@exemple.invalid' } }, 'jeton() : { access_token, user: { id, email } } et rien d’autre (ni refresh_token, ni téléphone)');
    eq(await creer(async () => ({ data: { session: { access_token: JETON, user: { id: 'u2' } } }, error: null })).jeton(), { access_token: JETON, user: { id: 'u2', email: '' } }, 'jeton() : sans adresse, une chaîne vide');
    eq([await creer(async () => ({ data: { session: null }, error: null })).jeton(), await creer(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })).jeton(), await creer(async () => ({ data: { session: { access_token: '', user: { id: 'u1' } } }, error: null })).jeton(), await creer(async () => ({ data: null, error: { code: 'x' } })).jeton()], [null, null, null, null], 'jeton() : sans session, sans jeton ou sur une erreur du client → null');
    { const avant = vus.length; const r = await creer(async () => { throw new Error('boom ' + JETON); }).jeton(); eq([r, vus.length - avant, JSON.stringify(vus).includes(JETON)], [null, 1, false], 'jeton() : un client qui lève → null, une ligne de journal sans le texte de l’erreur'); }
    eq(await createAuth({ config: null, factory: fabrique(async () => ({ data: { session }, error: null })), win: fenetre }).jeton(), null, 'jeton() : sans configuration de projet (pas de client) → null');
    let reseau = 0; const vraiFetch = globalThis.fetch; globalThis.fetch = async () => { reseau += 1; throw new Error('aucun reseau attendu'); };
    try { await creer(async () => ({ data: { session }, error: null })).jeton(); } finally { globalThis.fetch = vraiFetch; }
    eq(reseau, 0, 'jeton() : aucun appel réseau (getSession lit le stockage local)');
    ok(vus.every((a) => a[0] === '[cuisine-os] auth.jeton' && !JSON.stringify(a).includes(JETON)), 'jeton() : chaque ligne de journal porte le code auth.jeton et jamais le jeton');
    } finally { console.error = vraiErreur; }
  }

  // --- Les écrans lisent la session et la passent (plomberie MINIMALE, R-T3-1 ; les textes « Connecte-toi » sont ceux de la tâche 4)
  {
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const avant = getUiLocale(); setUiLocale('fr');
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const vraiFetch = globalThis.fetch;
    try {
      // sessionAssistant : la session-donnée des écrans — bornée à 2 s, et seulement pour un compte reconnu sur cet appareil
      const { sessionAssistant } = await import('../src/ui/components.js');
      {
        const U = { id: 'u1', email: 'a@exemple.invalid' };
        const ctxS = (user, jeton) => ({ sync: { user, auth: { jeton } } });
        let lectures = 0; const compter = async () => { lectures += 1; return SESSION; };
        eq([await sessionAssistant(ctxS(U, compter)), lectures], [SESSION, 1], 'sessionAssistant : avec un compte reconnu, la session de jeton()');
        lectures = 0;
        eq([await sessionAssistant(ctxS(null, compter)), await sessionAssistant({ sync: { auth: { jeton: compter } } }), lectures], [null, null, 0], 'sessionAssistant : sans ctx.sync.user (garde de compte refusée, ou aucun compte) → null, jeton() n’est même pas appelé');
        const debut = Date.now();
        eq([await sessionAssistant(ctxS(U, () => new Promise(() => {})), { delaiMs: 20 }), Date.now() - debut < 1500], [null, true], 'sessionAssistant : un jeton() qui ne se résout jamais (rafraîchissement réseau bloqué) → null au bout du délai, l’écran se rend « sans session »');
        eq(await sessionAssistant(ctxS(U, () => new Promise((res) => setTimeout(() => res(SESSION), 5))), { delaiMs: 1000 }), SESSION, 'sessionAssistant : un jeton() lent mais dans le délai rend la session');
        eq([await sessionAssistant(ctxS(U, async () => { throw new Error('boom'); })), await sessionAssistant(ctxS(U, async () => undefined)), await sessionAssistant(null), await sessionAssistant({}), await sessionAssistant({ sync: { user: U } })], [null, null, null, null, null], 'sessionAssistant : jeton() qui lève ou rend rien, contexte absent ou sans auth → null, sans lever');
        { // le minuteur du délai est libéré dès que la session est là (aucun minuteur orphelin par rendu)
          const vrai = globalThis.clearTimeout; let effaces = 0; globalThis.clearTimeout = (id) => { effaces += 1; return vrai(id); };
          try { await sessionAssistant(ctxS(U, async () => SESSION), { delaiMs: 1000 }); } finally { globalThis.clearTimeout = vrai; }
          ok(effaces >= 1, 'sessionAssistant : le minuteur du délai est effacé quand la session arrive avant lui');
        }
      }
      // Le panneau d'index (import.js) : le bouton de l'assistant s'allume quand la session est lue, jamais sur une clé locale
      const I = await import('../src/ui/import.js');
      const ctxDe = (session, llm) => ({ settings: { llm }, sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } }, pagesById: new Map(), editionsById: new Map(), recipes: [] });
      const NONE = { provider: 'none' };
      for (const [nom, session, llm, allume] of [['session, aucun réglage local', SESSION, NONE, true], ['sans session', null, NONE, false], ['jeton vide', { access_token: '' }, NONE, false], ['clé Anthropic locale, sans session', null, { provider: 'anthropic', api_key: 'cle-locale', model: 'm' }, false], ['compatible OpenAI configuré, sans session', null, { provider: 'openai_compatible', api_key: 'k', model: 'm' }, true], ['session ET compatible OpenAI', SESSION, { provider: 'openai_compatible', api_key: 'k', model: 'm' }, true]]) {
        const panneau = I.indexEntriesPanel(null, ctxDe(session, llm), () => [], { editionId: 'ed1' });
        const b = [...panneau.querySelectorAll('button')].find((x) => x.textContent === 'Lire avec l’assistant IA');
        const auDepart = b.disabled; await tick();
        eq([auDepart, b.disabled], [true, !allume], `panneau d'index (${nom}) : éteint au départ, ${allume ? 'allumé' : 'éteint'} une fois la session lue`);
      }
      { // sans ctx.sync du tout (ancien contexte) : éteint, sans lever
        const panneau = I.indexEntriesPanel(null, { settings: { llm: NONE }, pagesById: new Map(), editionsById: new Map(), recipes: [] }, () => [], { editionId: 'ed1' });
        await tick();
        eq([...panneau.querySelectorAll('button')].find((x) => x.textContent === 'Lire avec l’assistant IA').disabled, true, 'panneau d\'index : sans ctx.sync, le bouton reste éteint');
      }
      // « Tester » de Réglages (T4 retire la section) : par la passerelle quand une session existe, aucune clé n'est lue
      const St = await import('../src/ui/settings.js');
      const dits = [];
      const tester = async (sync) => {
        const appels = [];
        globalThis.fetch = async (url, options) => { appels.push({ url, options }); return reponse(200, { model: 'claude-x', content: [{ type: 'text', text: 'OK' }] }); };
        try {
          const sec = St.sectionAssistant({ llm: { provider: 'none', model: '', base_url: '', api_key: '' }, sync }, { saveConfig: async () => {}, dire: (m) => dits.push(m), confirm: async () => true });
          [...sec.querySelectorAll('button')].find((x) => x.textContent === 'Tester').click();
          await tick(); await tick();
          return { appels, texte: sec.textContent };
        } finally { globalThis.fetch = vraiFetch; }
      };
      {
        const avecSession = await tester({ user: { id: 'u1', email: 'a@exemple.invalid' }, auth: { jeton: async () => SESSION } });
        const a = avecSession.appels[0];
        eq([avecSession.appels.length, a && new URL(a.url).host.endsWith('.supabase.co') && a.url.endsWith(P.CHEMIN_ASSISTANT), a?.options.headers.authorization, JSON.parse(a?.options.body ?? '{}').outil, avecSession.texte.includes('Réponse : OK')], [1, true, 'Bearer jeton-factice-0123', 'extraction', true], '« Tester » avec une session : un POST à la passerelle (outil extraction, jeton en Bearer), jamais ailleurs');
        const sansCompte = await tester({ user: null, auth: { jeton: async () => SESSION } });
        eq([sansCompte.appels.length, sansCompte.texte.includes('Échec : Configuration incomplète')], [0, true], '« Tester » avec un jeton mais sans compte reconnu sur cet appareil (garde de compte) : aucun appel');
        const sans = await tester({ user: { id: 'u1' }, auth: { jeton: async () => null } });
        eq([sans.appels.length, sans.texte.includes('Échec : Configuration incomplète')], [0, true], '« Tester » sans session : aucun appel, « Configuration incomplète »');
        const sansAuth = await tester({});
        eq([sansAuth.appels.length, sansAuth.texte.includes('Échec : Configuration incomplète')], [0, true], '« Tester » sans module d’auth (ctx.sync vide) : aucun appel, « Configuration incomplète »');
      }
    } finally { globalThis.fetch = vraiFetch; setUiLocale(avant); }
  }

  // --- Absence de toute clé et de tout appel direct : lue dans les SOURCES (les modules de la coquille)
  {
    const sw = await lire('../sw.js');
    const modules = [...sw.matchAll(/'\.\/(src\/[^']+\.js)'/g)].map((m) => m[1]);
    ok(modules.length > 50 && modules.includes('src/domain/passerelle.js'), `absence : la liste SHELL est lue (${modules.length} modules, passerelle.js compris) — sans quoi les inclusions ci-dessous ne prouveraient rien`);
    const sources = await Promise.all(modules.map(async (m) => [m, await lire('../' + m)]));
    const lus = sources.filter(([, s]) => !s.startsWith('ERREUR'));
    eq(lus.length, modules.length, 'absence : chaque module de la coquille est réellement lu');
    for (const motif of ['api.anthropic.com', 'x-api-key', 'anthropic-dangerous', 'ANTHROPIC_MESSAGES_URL', 'anthropicHeaders']) {
      eq(lus.filter(([, s]) => s.includes(motif)).map(([m]) => m), [], `absence : « ${motif} » n’apparaît dans aucun module de la coquille`);
    }
    const passerelle = lus.find(([m]) => m === 'src/domain/passerelle.js')?.[1] ?? '';
    ok(!/from '\.\.\/ui\//.test(passerelle), 'passerelle.js : n’importe rien de src/ui/ (couche domaine)');
    ok(sw.includes("'./src/domain/passerelle.js'"), 'SHELL : ./src/domain/passerelle.js');
    ok(/VERSION = 'cuisine-os-v0\.8\.0-\d+'/.test(sw), 'sw.js : VERSION 0.8.0');
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(APP_VERSION, '0.8.0', 'APP_VERSION 0.8.0');
  }
}
