// Tests du lot « Chercher sur le web » (spec docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md).
// Fonctions pures sur des réponses fixes ; rendus DOM à gestes injectés ; aucun réseau ; aucun history.* réel.
export async function runRechercheWebTests({ eq, ok }) {
  const lire = async (chemin) => (await fetch(chemin + '?v=' + Date.now(), { cache: 'no-store' })).text();

  // --- § 7.2 core/bornes.js : les aides du lot ISBN, déplacées sans changer de corps
  {
    const B = await import('../src/core/bornes.js');
    const LA = await import('../src/ui/livre-ajout.js');
    eq(B.OPTIONS_FETCH, { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }, 'bornes : OPTIONS_FETCH identiques au lot ISBN');
    ok(LA.OPTIONS_FETCH === B.OPTIONS_FETCH && LA.lireBornee === B.lireBornee && LA.signalDelai === B.signalDelai, 'bornes : livre-ajout.js ré-exporte les MÊMES fonctions (une seule définition)');
    eq(B.borner('ab\u{202E}c\u{200B}d\u{0007}e\u{2028}f', 10), 'abcdef', 'bornes : borner retire Cc, Cf (bidi, largeur nulle) et U+2028');
    eq(B.borner('😀😀😀', 2), '😀😀', 'bornes : borner tronque par points de code, jamais au milieu d’une paire de substitution');
    eq([B.borner(42, 5), B.borner(null, 5), B.borner(undefined, 5)], ['', '', ''], 'bornes : tout ce qui n’est pas une chaîne vaut la chaîne vide');
    eq(B.borner('x'.repeat(400), 300).length, 300, 'bornes : borner coupe à la borne exacte');
    ok(B.signalDelai(50) instanceof AbortSignal, 'bornes : signalDelai rend un signal d’abandon');
    eq(await B.lireBornee({}, 10), false, 'bornes : lireBornee sans corps lisible rend false (l’appelant replie sur text())');
    {
      const r = new Response(new Blob(['x'.repeat(2048)]));
      eq(await B.lireBornee(r, 1024), null, 'bornes : lireBornee coupe un corps trop gros et rend null');
    }
    const srcBornes = await lire('../src/core/bornes.js');
    ok(!/^\s*import\s/m.test(srcBornes), 'bornes : le module n’importe rien (pur, utilisable par le domaine)');
    const srcLA = await lire('../src/ui/livre-ajout.js');
    ok(!/export async function lireBornee|export function signalDelai/.test(srcLA), 'bornes : lireBornee et signalDelai ne sont plus DÉFINIES dans livre-ajout.js (déplacées, pas dupliquées)');
  }

  // --- § 5.7 / F16 : le texte mort du domaine est retiré
  {
    const { parseQuery, searchDocs } = await import('../src/domain/search.js');
    const g = searchDocs([], parseQuery('salade'), { mode: 'web' });
    eq([g.admissible.length, g.notice], [0, undefined], 'domaine : le mode web rend des groupes vides SANS notice (le texte « Le Web n’est pas activé » est mort)');
    ok(!(await lire('../src/domain/search.js')).includes('Le Web n’est pas activé'), 'domaine : src/domain/search.js ne porte plus le texte mort');
    ok(!(await lire('../src/domain/pairing.js')).includes('notice'), 'domaine : pairing.js ne propage plus de notice');
  }

  // --- § 8 : version 0.5.1 (confort après preuve), SHELL
  {
    const sw = await lire('../sw.js');
    ok(/VERSION = 'cuisine-os-v0\.5\.1-\d+'/.test(sw), 'sw.js : VERSION 0.5.1');
    ok(sw.includes("'./src/core/bornes.js'"), 'SHELL : ./src/core/bornes.js');
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(APP_VERSION, '0.5.1', 'APP_VERSION 0.5.1');
  }

  // --- § 7.1 / § 9.7 : AnthropicProvider.complete envoie la même requête avant et après le refactor (écrit AVANT, vert dès le départ)
  {
    const { AnthropicProvider } = await import('../src/domain/llm.js');
    const vraiFetch = globalThis.fetch;
    let appel = null;
    try {
      globalThis.fetch = async (url, options) => { appel = { url, options }; return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'OK' }] }) }; };
      const p = new AnthropicProvider({ provider: 'anthropic', api_key: 'cle-test', model: 'modele-test' });
      const sortie = await p.complete([{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], { maxTokens: 5 });
      eq(sortie, 'OK', 'llm : complete rend le texte des blocs text');
      eq(appel.url, 'https://api.anthropic.com/v1/messages', 'llm : complete appelle l’URL Messages');
      eq(appel.options.method, 'POST', 'llm : complete fait un POST');
      eq(appel.options.headers, { 'content-type': 'application/json', 'x-api-key': 'cle-test', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, 'llm : complete envoie exactement les quatre en-têtes');
      eq(JSON.parse(appel.options.body), { model: 'modele-test', max_tokens: 5, system: 'S', messages: [{ role: 'user', content: 'U' }] }, 'llm : complete envoie le même corps qu’avant le lot');
    } finally { globalThis.fetch = vraiFetch; }
  }

  // --- § 7.1 : exports neufs, et supportsWebSearch lu par l'écran (F6)
  {
    const L = await import('../src/domain/llm.js');
    eq(L.ANTHROPIC_MESSAGES_URL, 'https://api.anthropic.com/v1/messages', 'llm : ANTHROPIC_MESSAGES_URL exportée');
    eq(L.anthropicHeaders('k'), { 'content-type': 'application/json', 'x-api-key': 'k', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, 'llm : anthropicHeaders rend exactement les quatre en-têtes');
    eq([L.providerFrom({ llm: { provider: 'none' } }).supportsWebSearch, L.providerFrom({ llm: { provider: 'openai_compatible', api_key: 'k', model: 'm' } }).supportsWebSearch, L.providerFrom({ llm: { provider: 'anthropic', api_key: 'k', model: 'm' } }).supportsWebSearch], [false, false, true], 'llm : seul Anthropic cherche sur le web');
    eq([L.providerFrom({ llm: { provider: 'anthropic', api_key: '', model: 'm' } }).configured, L.providerFrom({ llm: { provider: 'anthropic', api_key: 'k', model: '' } }).configured], [false, false], 'llm : Anthropic sans clé ou sans modèle n’est pas configuré (garde § 5.2)');
  }

  // --- § 4.1-4.4 recherche-web.js : fonctions pures sur des réponses fixes
  {
    const W = await import('../src/domain/recherche-web.js');
    const res = (url, title, page_age) => ({ type: 'web_search_result', url, title, page_age, encrypted_content: 'x' });
    const blocRes = (liste) => ({ type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: liste });
    const texte = (t) => ({ type: 'text', text: t });

    // 4.1 construireDemande
    const d = W.construireDemande({ q: 'saumon fenouil', filtres: ['Sans gluten', '', 'x'], langue: 'fr' });
    ok(typeof d.system === 'string' && d.system.length > 50 && /recette/i.test(d.system), 'demande : system français non vide');
    ok(d.user.startsWith('saumon fenouil') && d.user.includes('Contraintes : Sans gluten ; x'), 'demande : user = la demande puis les contraintes (textes des puces, vides retirées)');
    eq(d.cle, JSON.stringify(['saumon fenouil', ['Sans gluten', 'x'], 'fr']), 'demande : la clé est la demande nettoyée, les filtres nettoyés et la langue');
    eq(W.construireDemande({ q: 'saumon fenouil', filtres: ['Sans gluten', 'x'], langue: 'fr' }).cle, d.cle, 'demande : même entrée, même clé');
    ok(W.construireDemande({ q: 'saumon fenouil', filtres: ['Sans gluten'], langue: 'fr' }).cle !== d.cle, 'demande : un filtre de moins change la clé');
    eq(W.construireDemande({ q: 'x'.repeat(600), filtres: [], langue: 'fr' }).user.length, 500, 'demande : q bornée à 500 points de code');
    eq(W.construireDemande({ q: '\u{200B}\u{200B}', filtres: [], langue: 'fr' }), { system: null, user: null, cle: null, q: '', filtres: [] }, 'demande : une demande faite de Cf est vide → aucune clé');
    eq([d.q, d.filtres], ['saumon fenouil', ['Sans gluten', 'x']], 'demande : q et filtres NETTOYÉS sont rendus (c’est eux que l’écran rappelle — R-WEB-1)');
    { let r; try { r = W.construireDemande(null); } catch (e) { r = `leve : ${e?.message}`; } eq(r, { system: null, user: null, cle: null, q: '', filtres: [] }, 'demande : construireDemande(null) ne lève pas → demande vide, sans clé (comme chercherRecettesWeb(null))'); }
    {
      const r = W.construireDemande({ q: '\u{202E}' + 'x'.repeat(600), filtres: [], langue: 'fr' });
      eq([r.q, r.user], ['x'.repeat(500), 'x'.repeat(500)], 'demande : le bidi en tête est retiré AVANT la coupe, puis q et user sont bornés à 500 (un bidi après la coupe ne prouverait rien)');
    }
    ok(/recipe/i.test(W.construireDemande({ q: 'salmon', filtres: [], langue: 'en' }).system) && !/recette/i.test(W.construireDemande({ q: 'salmon', filtres: [], langue: 'en' }).system), 'demande : system anglais quand la langue n’est pas fr');
    ok(/restriction/i.test(d.system) && /JSON/.test(d.system) && /choix/.test(d.system), 'demande : le system interdit d’affirmer une restriction et exige le JSON choix (I-K)');
    eq(W.construireDemande({ q: 'a', filtres: Array.from({ length: 20 }, (_, i) => `f${i}`), langue: 'fr' }).user.split(' ; ').length, 12, 'demande : douze filtres au plus');

    // 4.2 corpsRequete
    const corps = W.corpsRequete({ cfg: { model: 'modele-test' }, demande: d, fuseau: 'America/Toronto' });
    eq(corps.tools, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'CA', timezone: 'America/Toronto' } }], 'corps : outil web_search_20250305, 3 recherches, Canada, fuseau');
    eq([corps.model, corps.max_tokens, corps.system, corps.messages], ['modele-test', 4096, d.system, [{ role: 'user', content: d.user }]], 'corps : modèle, max_tokens, system, un message user');
    eq(['thinking', 'output_config', 'stream', 'allowed_callers'].filter((k) => k in corps || k in corps.tools[0]), [], 'corps : ni thinking, ni output_config, ni stream, ni allowed_callers');
    eq('timezone' in W.corpsRequete({ cfg: { model: 'm' }, demande: d, fuseau: '' }).tools[0].user_location, false, 'corps : fuseau vide → timezone omis');

    // 4.3 lireReponse — fixture exacte (F17) : A = [a, b, c avec identifiants], B = [a doublon, ftp, d]
    const json = { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1, server_tool_use: { web_search_requests: 2 } }, content: [
      texte('Je cherche.'), { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'saumon fenouil recette' } },
      blocRes([res('https://a.test/r1', 'A', 'October 1, 2026'), res('https://b.test/r2', 'B'), res('https://u:p@c.test/r3', 'C'.repeat(100) + '\u{202E}' + 'C'.repeat(250), '')]),
      blocRes([res('https://a.test/r1', 'A bis'), res('ftp://x.test/r', 'X'), res('https://d.test/r4', 'D')]),
      texte('{"choix":[{"url":"https://c.test/r3","pourquoi":"Court."},{"url":"https://zz.test/pas-dans-les-resultats","pourquoi":"Inventé"},{"url":"https://a.test/r1","pourquoi":"' + 'p'.repeat(100) + '\u{200B}' + 'q'.repeat(199) + '"}]}'),
    ] };
    const lu = W.lireReponse(json);
    eq(lu.resultats.map((r) => r.href), ['https://a.test/r1', 'https://b.test/r2', 'https://c.test/r3', 'https://d.test/r4'], 'lecture : 4 résultats dans l’ordre, doublon et ftp écartés, identifiants retirés');
    eq([lu.resultats[0].titre, lu.resultats[0].date, lu.resultats[1].date, lu.resultats[2].date], ['A', 'October 1, 2026', null, null], 'lecture : titre et date typés ; page_age absent ou vide → null');
    eq([lu.resultats[2].titre.length, lu.resultats[2].titre.includes('\u{202E}')], [300, false], 'lecture : un titre de 351 dont le U+202E est AVANT la coupe est nettoyé puis borné à 300 points de code (S2)');
    eq(lu.resultats[2].hote, 'c.test', 'lecture : l’hôte est recalculé');
    eq([lu.aCherche, lu.recherches, lu.stopReason, lu.erreursOutil], [true, 2, 'end_turn', []], 'lecture : aCherche, recherches, stopReason');
    ok(lu.texte.startsWith('Je cherche.{"choix"'), 'lecture : les blocs text sont recollés SANS séparateur (F7)');
    eq(W.lireReponse({ content: [blocRes({ type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' })] }).erreursOutil, ['max_uses_exceeded'], 'lecture : un content objet est une erreur d’outil');
    eq(W.lireReponse({ content: [blocRes([])] }), { resultats: [], erreursOutil: [], aCherche: true, texte: '', stopReason: null, recherches: null }, 'lecture : liste vide = une recherche faite sans résultat, usage absent → recherches null');
    eq(W.lireReponse({ content: [texte('De mémoire : …')] }).aCherche, false, 'lecture : aucun bloc outil → aCherche faux');
    eq(W.lireReponse({ content: 'pas un tableau' }).resultats, [], 'lecture : content racine non tableau → rien, sans lever');
    eq(W.lireReponse({ content: [null, 3, { type: 'text' }, { type: 'web_search_tool_result', content: null }, { type: 'web_search_tool_result', content: [null, { type: 'web_search_result' }, res('', 'vide')] }] }).resultats, [], 'lecture : blocs incomplets ignorés, sans lever (Review Focus 4)');
    {
      const deuxBlocs = W.lireReponse({ content: [blocRes([res('https://a.test/r1', 'A')]), texte('{"choix":[{"url":"ht'), texte('tps://a.test/r1","pourquoi":"ok"}]}')] });
      eq(W.choisirLiens(deuxBlocs).liens[0].pourquoi, 'ok', 'lecture : un JSON coupé par une citation sur deux blocs est lu (F7)');
    }

    {
      // V-F3 : deux pages du MÊME hôte sont deux pages (dédoublonnage par href exact, jamais par hôte)
      const lu2 = W.lireReponse({ content: [blocRes([res('https://a.test/1', 'Un'), res('https://a.test/2', 'Deux')]), texte('{"choix":[{"url":"https://a.test/2","pourquoi":"La deuxième."}]}')] });
      const c2 = W.choisirLiens(lu2);
      eq([lu2.resultats.map((r) => r.href), c2.liens.map((l) => l.href), c2.liens[0]?.pourquoi, c2.autres.map((l) => l.href)], [['https://a.test/1', 'https://a.test/2'], ['https://a.test/2'], 'La deuxième.', ['https://a.test/1']], 'lecture : deux pages du même hôte restent deux résultats, et la seconde peut être choisie (V-F3)');
    }
    // 4.4 choisirLiens
    const ch = W.choisirLiens(lu);
    eq(ch.liens.map((l) => l.href), ['https://c.test/r3', 'https://a.test/r1'], 'choix : seuls les choix survivants, dans l’ordre des choix ; l’adresse inventée est écartée (I-A) ; pas de complément (K2)');
    eq(ch.autres.map((l) => l.href), ['https://b.test/r2', 'https://d.test/r4'], 'choix : les autres pages trouvées, dans l’ordre du serveur, à part (K2)');
    eq([ch.liens[0].pourquoi, ch.liens[0].titre.length, ch.autres[0].pourquoi, ch.repli], ['Court.', 300, null, false], 'choix : pourquoi des choix, titre DU RÉSULTAT, pourquoi null pour les autres, pas de repli');
    eq(ch.liens[1].pourquoi, 'p'.repeat(100) + 'q'.repeat(100), 'choix : pourquoi de 300 dont le U+200B est AVANT la coupe : nettoyé puis borné à 200 points de code (I-J)');
    // I-A : aucune adresse hors des résultats bruts — y compris une adresse inventée sur un hôte RÉEL du serveur
    ok(ch.liens.every((l) => lu.resultats.some((r) => r.href === l.href)) && ch.autres.every((l) => lu.resultats.some((r) => r.href === l.href)), 'choix : tout href rendu est un href des résultats bruts (I-A)');
    for (const inventee of ['https://a.test/r1#x', 'https://a.test/r1/', 'https://a.test/r1?x=1', 'https://a.test/recette-inventee']) {
      const c = W.choisirLiens({ ...lu, texte: JSON.stringify({ choix: [{ url: inventee, pourquoi: 'Inventé' }] }) });
      eq([c.repli, [...c.liens, ...c.autres].some((l) => l.href === inventee)], [true, false], `choix : ${inventee} (hôte réel, adresse absente des résultats) est écarté → repli (I-A)`);
    }
    {
      const c = W.choisirLiens({ ...lu, texte: '{"choix":[{"url":"https://u:p@A.TEST/r1","pourquoi":"ok"}]}' });
      eq([c.liens[0].href, c.repli], ['https://a.test/r1', false], 'choix : un choix avec user:pass@ et un hôte en majuscules est retrouvé, href sans identifiants (§ 9.2)');
    }
    eq(W.choisirLiens({ ...lu, texte: 'pas du json' }), { liens: lu.resultats.map((r) => ({ ...r, pourquoi: null })), autres: [], repli: true }, 'choix : JSON illisible → repli, les résultats tels quels, rien dans autres');
    eq(W.choisirLiens({ ...lu, texte: '{"choix":[]}' }).repli, true, 'choix : choix vide → repli');
    eq(W.choisirLiens({ ...lu, texte: '{"choix":[null,3,{},{"url":5}]}' }).repli, true, 'choix : entrées hostiles ignorées sans lever (S13)');
    eq(W.choisirLiens({ ...lu, texte: '{x} puis {"choix":[{"url":"https://a.test/r1"}]}' }).repli, true, 'choix : une accolade parasite dans la prose rend le JSON illisible → repli (même avec une adresse valide dedans)');
    {
      const sept = { resultats: Array.from({ length: 7 }, (_, i) => ({ href: `https://s${i}.test/`, hote: `s${i}.test`, titre: `S${i}`, date: null })), texte: '{"choix":' + JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ url: `https://s${i}.test/`, pourquoi: 'p' }))) + '}' };
      eq([W.choisirLiens(sept).liens.length, W.choisirLiens(sept).autres.length], [5, 2], 'choix : cinq liens au plus, les deux autres à part (K2)');
      const r7 = W.choisirLiens({ ...sept, texte: 'pas du json' });
      eq([r7.liens.length, r7.autres.length, r7.repli], [5, 2, true], 'choix : repli avec sept résultats → cinq liens, deux autres, repli (§ 9.2)');
      eq(W.choisirLiens({ ...sept, texte: '{"choix":[{"url":"https://s1.test/"},{"url":"https://s1.test/"}]}' }).liens.filter((l) => l.href === 'https://s1.test/').length, 1, 'choix : un doublon de choix ne rend qu’un lien');
      eq(W.choisirLiens({ resultats: [{ href: 'https://s.test/', hote: 's.test', titre: '', date: null }], texte: '' }).liens[0].titre, 's.test', 'choix : titre vide → l’hôte');
    }
    const sw = await lire('../sw.js');
    ok(sw.includes("'./src/domain/recherche-web.js'"), 'SHELL : ./src/domain/recherche-web.js');
    ok(!/from '\.\.\/ui\//.test(await lire('../src/domain/recherche-web.js')), 'recherche-web.js : n’importe rien de src/ui/ (couche domaine)');
  }

  // --- § 4.5 chercherRecettesWeb : fetch factice, classement des issues, jamais la clé dans l'issue
  {
    const W = await import('../src/domain/recherche-web.js');
    const CLE = 'sk-ant-cle-test-sentinelle';
    const cfg = { provider: 'anthropic', api_key: CLE, model: 'modele-test' };
    const args = { q: 'saumon fenouil', filtres: ['Sans gluten'], langue: 'fr', cfg };
    const res = (url, title) => ({ type: 'web_search_result', url, title, page_age: 'May 1, 2026', encrypted_content: 'x' });
    const blocRes = (liste) => ({ type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: liste });
    const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
    const nominal = { stop_reason: 'end_turn', usage: { server_tool_use: { web_search_requests: 2 } }, content: [{ type: 'server_tool_use', id: 's', name: 'web_search', input: {} }, blocRes([res('https://a.test/1', 'A'), res('https://b.test/2', 'B')]), { type: 'text', text: '{"choix":[{"url":"https://b.test/2","pourquoi":"Fenouil."}]}' }] };
    const sansClef = (issue) => !JSON.stringify(issue).includes(CLE) && !JSON.stringify(issue).includes('CORPS-SENTINELLE');
    let appels = [];
    const fauxFetch = function (url, options) { appels.push({ url, options, self: this }); return Promise.resolve(fauxFetch.rendre(url, options)); };
    fauxFetch.rendre = () => reponse(200, nominal);
    // V-F2 : CHAQUE issue rendue par lancer() est contrôlée (ni la clé, ni le corps d'erreur sentinelle) ; bilan en fin de bloc.
    const issuesVues = { n: 0, fautives: [] };
    const lancer = async (deps = {}, a = args) => { appels = []; const i = await W.chercherRecettesWeb(a, { fetch: fauxFetch, enLigne: () => true, fuseau: 'America/Toronto', ...deps }); issuesVues.n += 1; if (!sansClef(i)) issuesVues.fautives.push(i); return i; };

    // Forme de l'appel
    const ok1 = await lancer();
    eq([ok1.etat, ok1.liens.map((l) => l.href), ok1.autres.map((l) => l.href), ok1.liens[0].pourquoi, ok1.recherches, ok1.modele, ok1.repli], ['trouve', ['https://b.test/2'], ['https://a.test/1'], 'Fenouil.', 2, 'modele-test', false], 'appel : cas nominal → trouve, le choix seul dans liens, l’autre page à part (K2), recherches, modèle');
    eq(appels.length, 1, 'appel : un seul fetch');
    ok(appels[0].self === undefined, 'appel : fetch est appelé comme fonction libre, sans this (F11, V-F12 : comparaison stricte, pas par JSON)');
    eq(appels[0].url, 'https://api.anthropic.com/v1/messages', 'appel : l’URL Messages, sans la clé');
    ok(!appels[0].url.includes(CLE), 'appel : la clé n’est pas dans l’adresse');
    eq([appels[0].options.method, appels[0].options.headers['x-api-key'], appels[0].options.headers['anthropic-dangerous-direct-browser-access'], appels[0].options.credentials, appels[0].options.cache, appels[0].options.referrerPolicy, appels[0].options.mode, appels[0].options.redirect], ['POST', CLE, 'true', 'omit', 'no-store', 'no-referrer', 'cors', 'error'], 'appel : en-têtes et options réseau du lot ISBN, et redirect error (la clé ne suit jamais une redirection)');
    ok(appels[0].options.signal instanceof AbortSignal, 'appel : un signal d’abandon est posé');
    {
      const corps = JSON.parse(appels[0].options.body);
      eq([corps.model, corps.tools[0].type, corps.tools[0].max_uses, corps.tools[0].user_location], ['modele-test', 'web_search_20250305', 3, { type: 'approximate', country: 'CA', timezone: 'America/Toronto' }], 'appel : corps = corpsRequete');
      ok(corps.messages[0].content.includes('saumon fenouil') && corps.messages[0].content.includes('Sans gluten'), 'appel : la demande et les textes des puces partent (I-J)');
    }
    // Gardes sans appel
    for (const [nom, c, etat] of [['cfg absent', undefined, 'non_configure'], ['none', { provider: 'none' }, 'non_configure'], ['anthropic sans clé', { provider: 'anthropic', api_key: '', model: 'm' }, 'non_configure'], ['anthropic sans modèle', { provider: 'anthropic', api_key: 'k', model: '' }, 'non_configure'], ['openai', { provider: 'openai_compatible', api_key: 'k', model: 'm' }, 'non_pris_en_charge']]) {
      const i = await lancer({}, { ...args, cfg: c });
      eq([i.etat, i.liens, appels.length], [etat, [], 0], `garde : ${nom} → ${etat}, aucun appel`);
    }
    eq([(await W.chercherRecettesWeb(null)).etat, (await W.chercherRecettesWeb()).etat], ['non_configure', 'non_configure'], 'garde : arguments null ou absents → non_configure, sans lever');
    eq([(await lancer({}, { ...args, cfg: { ...cfg, api_key: 'sk-ant-\u{200B}x' } })).raison, appels.length], ['cle_refusee', 0], 'garde : clé collée avec un caractère invisible → cle_refusee, aucun appel (fetch lèverait « ByteString » avant tout réseau)');
    eq([(await lancer({}, { ...args, q: '\u{200B}' })).raison, appels.length], ['requete', 0], 'garde : demande vide après nettoyage → indisponible/requete, aucun appel');
    eq([(await lancer({ enLigne: () => false })).raison, appels.length], ['hors_ligne', 0], 'garde : hors ligne → aucun appel');
    { const c = new AbortController(); c.abort(); eq([(await lancer({ signal: c.signal })).raison, appels.length], ['annule', 0], 'garde : signal déjà abandonné → annule, aucun appel'); }
    // Statuts HTTP
    const statut = async (s, corps = { error: { type: 'x', message: 'CORPS-SENTINELLE' } }) => { fauxFetch.rendre = () => reponse(s, corps); const i = await lancer(); fauxFetch.rendre = () => reponse(200, nominal); return i; };
    eq([(await statut(401)).raison, (await statut(403)).raison], ['cle_refusee', 'cle_refusee'], 'statut : 401 et 403 → cle_refusee');
    eq((await statut(403, { error: { type: 'permission_error', message: 'Web search is not enabled for this organization' } })).raison, 'recherche_desactivee', 'statut : 403 « web search not enabled » → recherche_desactivee, pas une clé refusée (S12)');
    eq((await statut(400, { error: { type: 'invalid_request_error', message: 'Web search is not enabled for this organization' } })).raison, 'recherche_desactivee', 'statut : 400 « web search not enabled » → recherche_desactivee (S12)');
    eq([(await statut(400)).raison, (await statut(404)).raison, (await statut(422)).raison], ['requete', 'requete', 'requete'], 'statut : autres 4xx → requete');
    eq((await statut(429)).raison, 'trop_de_demandes', 'statut : 429 → trop_de_demandes');
    eq([(await statut(500)).raison, (await statut(529)).raison], ['serveur', 'serveur'], 'statut : 5xx → serveur');
    ok(sansClef(await statut(400)) && sansClef(await statut(500)), 'statut : l’issue ne recopie ni la clé ni le corps d’erreur (I-C)');
    // Réseau, délai, abandon, corps
    fauxFetch.rendre = () => { throw new Error('coupé'); };
    eq((await lancer()).raison, 'reseau', 'réseau : fetch qui lève → reseau');
    fauxFetch.rendre = (url, options) => new Promise((_, reject) => { options.signal.addEventListener('abort', () => reject(new DOMException('abandon', 'AbortError')), { once: true }); });
    eq((await lancer({ tentativeMs: 1 })).raison, 'delai', 'délai : abandon par le chrono → delai (F18)');
    { const c = new AbortController(); const p = lancer({ signal: c.signal, tentativeMs: 60000 }); c.abort(); const relaye = appels[0]?.options.signal.aborted === true; eq([relaye, (await p).raison], [true, 'annule'], 'abandon : signal extérieur pendant le vol → le signal du fetch est abandonné AUSSITÔT (V-F6), issue annule'); }
    {
      // Abandon extérieur PENDANT la lecture du corps d'erreur d'un 400 : annule, pas `requete`.
      const c = new AbortController();
      let finir; const attente = new Promise((resoudre) => { finir = resoudre; });
      let lectureCommencee; const commence = new Promise((resoudre) => { lectureCommencee = resoudre; });
      fauxFetch.rendre = () => ({ ok: false, status: 400, headers: new Headers(), text: () => { lectureCommencee(); return attente; } });
      const p = lancer({ signal: c.signal, tentativeMs: 60000 });
      await commence; c.abort(); finir('{"error":{"message":"autre chose"}}');
      eq((await p).raison, 'annule', 'abandon : signal extérieur pendant la lecture du corps d’erreur d’un 400 → annule');
      fauxFetch.rendre = () => reponse(200, nominal);
    }
    // V-F1 : le corps trop gros est du JSON VALIDE — seule la borne peut le refuser (un corps invalide passait par JSON.parse).
    fauxFetch.rendre = () => new Response(new Blob([JSON.stringify({ ...nominal, bourrage: 'x'.repeat(4096) })]), { status: 200 });
    eq((await lancer({ corpsMax: 1024 })).raison, 'reponse_illisible', 'corps : une vraie Response en flux, JSON valide > corpsMax → reponse_illisible (lireBornee, V-F1)');
    fauxFetch.rendre = () => new Response(new Blob([JSON.stringify(nominal)]), { status: 200, headers: { 'content-type': 'application/json' } });
    { const i = await lancer(); eq([i.etat, i.liens[0]?.href], ['trouve', 'https://b.test/2'], 'corps : une vraie Response en flux sous la borne → trouve (chemin lireBornee puis Blob, celui de la production)'); }
    fauxFetch.rendre = () => reponse(200, 'pas du json');
    eq((await lancer()).raison, 'reponse_illisible', 'corps : JSON invalide → reponse_illisible');
    fauxFetch.rendre = () => reponse(200, { content: 'x' });
    eq((await lancer()).raison, 'reponse_illisible', 'corps : content non tableau → reponse_illisible');
    // Contenu de la réponse
    const contenu = async (json) => { fauxFetch.rendre = () => reponse(200, json); const i = await lancer(); fauxFetch.rendre = () => reponse(200, nominal); return i; };
    eq((await contenu({ ...nominal, stop_reason: 'refusal' })).raison, 'refus', 'contenu : refusal AVEC résultats → refus, aucun lien (F22)');
    eq((await contenu({ ...nominal, stop_reason: 'refusal' })).liens, [], 'contenu : refus → liens vides');
    eq((await contenu({ content: [blocRes({ type: 'web_search_tool_result_error', error_code: 'too_many_requests' })] })).raison, 'trop_de_demandes', 'contenu : too_many_requests sans résultat → trop_de_demandes');
    eq((await contenu({ content: [blocRes({ type: 'web_search_tool_result_error', error_code: 'unavailable' })] })).raison, 'outil', 'contenu : unavailable sans résultat → outil');
    eq((await contenu({ content: [blocRes([res('https://a.test/1', 'A'), res('https://b.test/2', 'B')]), blocRes({ type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' })] })).liens.length, 2, 'contenu : max_uses_exceeded APRÈS des résultats → trouve 2 liens');
    eq((await contenu({ stop_reason: 'pause_turn', content: [blocRes([])] })).raison, 'interrompu', 'contenu : pause_turn sans résultat → interrompu (F10)');
    eq((await contenu({ stop_reason: 'pause_turn', content: [blocRes([res('https://a.test/1', 'A')])] })).etat, 'trouve', 'contenu : pause_turn avec résultats → trouve');
    eq((await contenu({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'De mémoire…' }] })).raison, 'pas_cherche', 'contenu : aucun bloc outil → pas_cherche (R4)');
    eq((await contenu({ stop_reason: 'end_turn', content: [blocRes([])] })).etat, 'rien', 'contenu : une recherche faite, aucune page → rien');
    fauxFetch.rendre = () => ({});
    eq((await lancer()).raison, 'interne', 'filet : une réponse sans statut → interne, sans lever');
    fauxFetch.rendre = () => ({ ok: true, status: 200 });
    eq((await lancer()).raison, 'interne', 'corps : un 200 sans corps lisible ni text() → interne, jamais reseau (V-C6)');
    fauxFetch.rendre = () => reponse(200, nominal);
    {
      // Le filet extérieur : le corps de la requête est calculé HORS du try du réseau. Un `model` qui lève à son 2e accès
      // (1 = la garde `!cfg.model`, 2 = corpsRequete, avant tout fetch) doit donner `interne` — jamais `reseau` — sans fetch.
      let acces = 0;
      const cfgPiege = { provider: 'anthropic', api_key: CLE, get model() { acces += 1; if (acces === 2) throw new Error('modele piege'); return 'modele-test'; } };
      const vus = []; const vraiErreur = console.error;
      console.error = (...a) => { vus.push(a); };
      let i; try { i = await lancer({}, { ...args, cfg: cfgPiege }); } finally { console.error = vraiErreur; }
      eq([i.etat, i.raison, appels.length], ['indisponible', 'interne', 0], 'filet : une exception pendant le calcul du corps → interne, aucun fetch (jamais reseau)');
      const charge = vus[0]?.[1];
      eq([vus.length, Object.keys(charge ?? {}), charge?.reason], [1, ['reason', 'name'], 'interne'], 'filet : le journal ne porte que reason et name, reason = interne');
      ok(!JSON.stringify(vus).includes(CLE) && !JSON.stringify(vus).includes('model'), 'filet : le journal ne contient ni la clé ni le modèle (S10/F12)');
    }
    eq([issuesVues.n, issuesVues.fautives.length], [42, 0], 'I-C : CHACUNE des issues rendues dans ce bloc (toutes comptées) est sans clé ni corps d’erreur (V-F2)');
  }

  // --- V-C2 : t() rend une valeur telle quelle, même avec les motifs « $ » de replaceAll
  {
    const { t: traduire, setUiLocale: poserLangue, getUiLocale: langue } = await import('../src/core/i18n.js');
    const avant = langue(); poserLangue('fr');
    try {
      eq([traduire('Demande envoyée : {q}', { q: 'a$&b' }), traduire('Demande envoyée : {q}', { q: '5$$' }), traduire('Demande envoyée : {q}', { q: "x$'y" })], ['Demande envoyée : a$&b', 'Demande envoyée : 5$$', "Demande envoyée : x$'y"], 't() : $&, $$ et $\' dans une valeur sont rendus tels quels (V-C2)');
    } finally { poserLangue(avant); }
  }

  // --- § 7.3 libellePuce : la même définition pour la puce affichée et pour la demande envoyée (I-J, F1)
  {
    const C = await import('../src/ui/components.js');
    const { chipsFor, parseQuery } = await import('../src/domain/search.js');
    const ing = new Map([['ing_cucumber', { labels: { fr: { label: 'concombre' } } }]]);
    const chips = chipsFor(parseQuery('une salade avec du concombre, sans gluten, en 15 minutes').filters);
    const textes = chips.map((c) => C.libellePuce(c, ing));
    ok(textes.includes('Salade') && textes.includes('Sans gluten') && textes.includes('avec concombre') && textes.some((x) => x.includes('15 min')), 'puces : libellePuce rend type, restriction, ingrédient (libellé fr) et durée comme la puce affichée');
    eq(C.libellePuce({ kind: 'include', value: 'ing_inconnu' }, ing), 'avec ing_inconnu', 'puces : un ingrédient sans libellé rend son id');
    eq(C.libellePuce({ kind: 'exclude_text', value: 'noix' }, ing), 'sans « noix »', 'puces : exclude_text tel quel');
    const rendu = C.filterChips(chips, ing, () => {});
    eq([...rendu.querySelectorAll('.chip')].map((n) => n.textContent), textes, 'puces : filterChips rend EXACTEMENT les textes de libellePuce (une seule définition)');
  }

  // --- § 5.1-5.4 écran du mode Web : état de module, garde, tape, vol, annulation, filet
  {
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale();
    setUiLocale('fr'); // une suite antérieure bascule 'en' ; ce bloc affirme langue === 'fr' (rendue dans le finally)
    const S = await import('../src/ui/search.js');
    const vraiFetch = globalThis.fetch;
    let appelsReseau = 0;
    globalThis.fetch = async (u) => { appelsReseau += 1; throw new Error(`aucun reseau attendu ici : ${u}`); };
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    try {
      const ING = new Map([['ing_salmon', { labels: { fr: { label: 'saumon' } } }], ['ing_fennel_bulb', { labels: { fr: { label: 'fenouil' } } }], ['ing_chicken', { labels: { fr: { label: 'poulet' } } }]]);
      const ctxDe = (llm) => ({ docs: [], docsByRecipe: new Map(), ingredientsById: ING, meal_feedback: [], settings: { llm } });
      const CLE_ECRAN = 'sk-ant-cle-ecran-sentinelle'; // V-F2 : elle doit atteindre chercher(), jamais l'état ni l'écran
      const ANTH = { provider: 'anthropic', api_key: CLE_ECRAN, model: 'm' };
      const pilote = () => { const p = {}; p.promesse = new Promise((res) => { p.resoudre = res; }); return p; };
      const tick = () => new Promise((r) => setTimeout(r, 0)); // un tour de boucle : les .then de lancer() ont tourné
      // remplacerAdresse factice par défaut : la tape (lancer) met l'adresse à jour par history.replaceState, pas celle de la page de tests.
      const monter = async (query, ctx, deps) => { const root = await S.renderSearch({}, { mode: 'web', ...query }, ctx, { remplacerAdresse: () => {}, ...deps }); scene.append(root); return root; };
      const texte = (root) => root.textContent;
      const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
      const champ = (root) => root.querySelector('input[type="search"]');
      const taper = (root, v) => { champ(root).value = v; champ(root).dispatchEvent(new Event('input', { bubbles: true })); };
      const puces = (root) => [...root.querySelectorAll('.chip')].map((c) => c.textContent); // les puces AFFICHÉES
      const aide = (root) => root.querySelector('[data-role="aide-web"]');
      const enVol = (root) => !!root.querySelector('[role="status"]');
      const issueTrouve = { etat: 'trouve', raison: null, liens: [{ href: 'https://a.test/r', hote: 'a.test', titre: 'A', date: null, pourquoi: null }], repli: false, recherches: 1, modele: 'm' };

      // Garde du fournisseur (§ 5.2) : une seule source de vérité
      S.reinitialiserWeb();
      for (const [nom, llm, attendu] of [['none', { provider: 'none' }, 'Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'], ['anthropic sans clé', { provider: 'anthropic', api_key: '', model: 'm' }, 'Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'], ['openai', { provider: 'openai_compatible', api_key: 'k', model: 'm' }, 'Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.']]) {
        let appels = 0;
        const root = await monter({ q: 'saumon' }, ctxDe(llm), { chercher: async () => { appels += 1; return issueTrouve; } });
        ok(texte(root).includes(attendu), `garde : ${nom} → « ${attendu.slice(0, 30)}… »`);
        ok(!!root.querySelector('a[href="#/settings"]'), `garde : ${nom} → lien Réglages`);
        eq([appels, !!bouton(root, 'Chercher sur le web avec l’assistant')], [0, false], `garde : ${nom} → aucun appel, pas de bouton`);
        root.remove();
      }
      // Écran du bouton (§ 5.3) et frappe sans Entrée (Review Focus 1)
      {
        let appels = []; const p = pilote();
        const root = await monter({}, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return p.promesse; }, navigate: () => {} });
        const b = bouton(root, 'Chercher sur le web avec l’assistant');
        eq([b.disabled, texte(root).includes('Écris d’abord ce que tu cherches.'), texte(root).includes('Une recherche = un appel à ton compte Anthropic.'), appels.length], [true, true, true, 0], 'bouton : champ vide → éteint, deux lignes, aucun appel au rendu (I-B)');
        eq(aide(root)?.hidden, false, 'aide : champ vide au montage → la ligne « Écris d’abord… » est VISIBLE (elle est toujours rendue : le texte seul ne le prouve pas)');
        taper(root, 'saumon fenouil');
        eq(b.disabled, false, 'bouton : la frappe ouvre le bouton sans Entrée ni redessin');
        const aideCacheeParLaFrappe = aide(root)?.hidden;
        taper(root, '');
        eq([aideCacheeParLaFrappe, aide(root)?.hidden, b.disabled], [true, false, true], 'aide : la frappe cache « Écris d’abord… », l’effacement la remontre et éteint le bouton');
        taper(root, '\u{200B}');
        eq(b.disabled, true, 'bouton : une saisie faite de Cf laisse le bouton éteint (même règle que construireDemande)');
        taper(root, 'saumon fenouil sans gluten');
        b.click();
        await tick();
        eq(appels.length, 1, 'tape : un appel');
        eq([appels[0].a.q, appels[0].a.filtres, appels[0].a.langue, appels[0].a.cfg], ['saumon fenouil sans gluten', ['Sans gluten', 'avec fenouil', 'avec saumon'], 'fr', ANTH], 'tape : la demande est le CHAMP relu (q), les puces comprises en TEXTE (« Sans gluten », les ingrédients par leur libellé), la langue, la cfg (I-J)');
        eq(appels[0].a.filtres, puces(root), 'tape : les filtres envoyés sont EXACTEMENT les puces affichées après la relecture du champ (I-J)');
        ok(appels[0].d.signal instanceof AbortSignal && typeof appels[0].d.enLigne === 'undefined', 'tape : un signal est passé ; enLigne n’est pas forcé à la tape');
        const e = S.etatWeb();
        eq([e.enCours, typeof e.cle, e.memoire], [true, 'string', null], 'tape : etatWeb dit un vol en cours, rien en mémoire');
        const statut = root.querySelector('[role="status"]');
        ok(statut && statut.textContent.includes('L’assistant cherche sur le web…'), 'vol : écran « en cours » avec role=status (F20)');
        ok(bouton(root, 'Chercher sur le web avec l’assistant')?.disabled === true && !!bouton(root, 'Annuler'), 'vol : bouton éteint, « Annuler » présent');
        // Annuler (§ 5.4.6)
        bouton(root, 'Annuler').click();
        eq([appels[0].d.signal.aborted, S.etatWeb().enCours, S.etatWeb().memoire, !!root.querySelector('[data-role="chercher-web"]') && !enVol(root)], [true, false, null, true], 'annuler : signal abandonné, plus de vol, mémoire intacte, écran du bouton (pas celui du vol)');
        p.resoudre({ ...issueTrouve, raison: 'annule', etat: 'indisponible', liens: [] });
        await tick();
        eq(S.etatWeb().memoire, null, 'annuler : la résolution tardive d’un vol annulé n’écrit rien');
        root.remove();
      }
      // Nouvelle instance pendant un vol (F2/F3) : le premier vol est abandonné, sa réponse tardive est muette
      {
        S.reinitialiserWeb();
        const appels = []; const p1 = pilote(); const p2 = pilote();
        const chercher = async (a, d) => { appels.push(d.signal); return appels.length === 1 ? p1.promesse : p2.promesse; };
        const ctx = ctxDe(ANTH);
        const r1 = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
        bouton(r1, 'Chercher sur le web avec l’assistant').click();
        await tick();
        const r2 = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });   // la ré-instanciation de production
        ok(!!r2.querySelector('[role="status"]') && !!bouton(r2, 'Annuler'), 'instance 2 : retrouve le vol par sa clé et montre « en cours »');
        r1.remove();
        taper(r2, 'saumon fenouil');
        eq([r2.querySelector('[data-role="chercher-web"]'), bouton(r2, 'Chercher sur le web avec l’assistant')?.disabled, enVol(r2)], [null, true, true], 'vol : la frappe pendant le vol ne rouvre pas le bouton éteint (il n’a pas de data-role)');
        // le bouton de r2 est éteint pendant le vol : la seconde tape passe par « Annuler » puis le bouton
        bouton(r2, 'Annuler').click();
        bouton(r2, 'Chercher sur le web avec l’assistant').click();
        await tick();
        eq([appels.length, appels[0].aborted, appels[1].aborted], [2, true, false], 'instance 2 : deux appels, le premier abandonné');
        p1.resoudre({ ...issueTrouve, liens: [{ ...issueTrouve.liens[0], titre: 'TARDIF' }] });
        await tick();
        eq(S.etatWeb().memoire, null, 'instance 2 : la réponse tardive du vol 1 n’écrit rien');
        p2.resoudre(issueTrouve);
        await tick();
        eq([S.etatWeb().enCours, S.etatWeb().memoire?.etat], [false, 'trouve'], 'instance 2 : la réponse du vol 2 est en mémoire');
        eq([enVol(r2), texte(r2).includes('L’assistant cherche sur le web…'), texte(r2).includes('Trouvé sur le web')], [false, false, true], 'instance 2 : la résolution redessine la vue abonnée (notifier → vues) : l’écran « en cours » ne reste pas figé, l’issue trouve est rendue');
        ok(!texte(r2).includes('TARDIF'), 'instance 2 : l’écran ne montre rien du vol 1');
        r2.remove();
      }
      // I-I sans « Annuler » : une puce retirée change la clé dans la MÊME instance ; la tape suivante abandonne le vol en l'air
      {
        S.reinitialiserWeb();
        const appels = []; const p1 = pilote(); const p2 = pilote();
        const chercher = async (a, d) => { appels.push({ a, d }); return appels.length === 1 ? p1.promesse : p2.promesse; };
        const root = await monter({ q: 'saumon sans gluten' }, ctxDe(ANTH), { chercher, navigate: () => {} });
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        [...root.querySelectorAll('.chip.removable')].find((c) => c.textContent === 'Sans gluten').click();
        eq([S.etatWeb().enCours, enVol(root), root.querySelector('[data-role="chercher-web"]')?.disabled], [true, false, false], 'I-I : la puce retirée change la clé : écran du bouton (allumé) alors que le vol 1 est encore en l’air');
        root.querySelector('[data-role="chercher-web"]').click();
        await tick();
        eq([appels.length, appels[0].d.signal.aborted, appels[1].d.signal.aborted, appels[1].a.filtres], [2, true, false, ['avec saumon']], 'I-I : sans « Annuler », la nouvelle tape abandonne le vol précédent ; la demande porte les puces restantes');
        p1.resoudre(issueTrouve);
        await tick();
        eq(S.etatWeb().memoire, null, 'I-I : la réponse tardive du vol remplacé n’écrit rien');
        root.remove();
      }
      // R-WEB-2 : champ INCHANGÉ → pas de relecture ; la restriction ajoutée par « + restriction » part avec la demande
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: 'saumon' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        eq(aide(root)?.hidden, true, 'aide : champ rempli au montage → la ligne d’aide est cachée');
        const liste = [...root.querySelectorAll('select')].find((s) => s.options[0]?.textContent === '+ restriction');
        liste.value = 'sans_gluten'; liste.dispatchEvent(new Event('change'));
        const affichees = puces(root);
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        eq([affichees, appels[0]?.a.filtres], [['Sans gluten', 'avec saumon'], ['Sans gluten', 'avec saumon']], 'R-WEB-2 : champ inchangé → pas de relecture ; la demande porte EXACTEMENT les puces affichées, la restriction ajoutée comprise (I-J)');
        eq([...root.querySelectorAll('.muted')].find((n) => n.textContent.startsWith('Demande envoyée'))?.textContent, 'Demande envoyée : saumon · ' + puces(root).join(' ; '), 'R-WEB-2 : « Demande envoyée » dit EXACTEMENT q puis les puces, jointes par « ; » (I-J)');
        root.remove();
      }
      // R-WEB-9/10 : champ CHANGÉ sans Entrée, puis « + restriction » → la tape relit le champ ET garde la puce de LISTE
      // (ce qui part reste ce qui est affiché, I-J)
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: '' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        taper(root, 'saumon');
        const liste = [...root.querySelectorAll('select')].find((s) => s.options[0]?.textContent === '+ restriction');
        liste.value = 'sans_gluten'; liste.dispatchEvent(new Event('change'));
        const avantTape = puces(root);
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        const apres = puces(root);
        eq([avantTape, appels.length, appels[0]?.a.q, appels[0]?.a.filtres, apres.includes('Sans gluten')], [['Sans gluten'], 1, 'saumon', apres, true], 'R-WEB-9 : champ changé sans Entrée + « + restriction » → la demande relit le champ, porte EXACTEMENT les puces affichées après la tape, « Sans gluten » comprise');
        eq(apres, ['Sans gluten', 'avec saumon'], 'R-WEB-9 : après la tape, la puce « Sans gluten » est toujours affichée, à côté de celle du champ relu');
        root.remove();
      }
      // R-WEB-10 (corrige R-WEB-9) : une demande NEUVE tapée sans Entrée n'hérite pas des contraintes de l'ancien texte
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: 'soupe sans gluten en 20 minutes' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        const avant = puces(root);
        taper(root, 'gâteau au chocolat');
        bouton(root, 'Chercher à nouveau').click();
        await tick();
        const apres = puces(root);
        eq([avant.length, appels.length, appels[1]?.a.q, appels[1]?.a.filtres, avant.filter((c) => apres.includes(c))], [3, 2, 'gâteau au chocolat', apres, []], 'R-WEB-10 : « soupe sans gluten en 20 minutes » puis « gâteau au chocolat » sans Entrée → « Chercher à nouveau » n’envoie AUCUNE contrainte de l’ancien texte (type, régime, durée) : exactement les puces affichées');
        root.remove();
      }
      // R-WEB-10 : l'exclusion en texte et la durée de l'ancien texte ne sont pas portées non plus
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: 'salade sans xyzzy en 20 minutes' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        const avant = puces(root);
        taper(root, 'saumon');
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        const apres = puces(root);
        eq([avant.length, apres, appels[0]?.a.filtres], [3, ['avec saumon'], ['avec saumon']], 'R-WEB-10 : le type, l’exclusion en texte et la durée de l’ancien texte ne partent pas : seule « avec saumon » (le nouveau texte)');
        root.remove();
      }
      // R-WEB-10 : l'exclusion de l'ancien texte n'est pas portée — « sans fenouil » puis « saumon fenouil » ne se contredit pas
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: 'sans fenouil' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        const avant = puces(root);
        taper(root, 'saumon fenouil');
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        eq([avant, puces(root), appels[0]?.a.filtres], [['sans fenouil'], ['avec fenouil', 'avec saumon'], ['avec fenouil', 'avec saumon']], 'R-WEB-10 : « sans fenouil » puis « saumon fenouil » → la demande est celle du NOUVEAU texte seul, sans exclusion héritée (aucune demande contradictoire)');
        root.remove();
      }
      // R-WEB-10 : la durée « actives » de l'ancien texte n'est pas portée
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: '10 min actives' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        const avant = puces(root);
        taper(root, 'saumon');
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        eq([avant.length, puces(root), appels[0]?.a.filtres], [1, ['avec saumon'], ['avec saumon']], 'R-WEB-10 : « ≤ 10 min actives » de l’ancien texte ne part pas avec « saumon »');
        root.remove();
      }
      // R-WEB-10 : une puce de LISTE survit à un champ retapé ; ce que l'ancien texte avait donné, non
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: '' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        taper(root, 'saumon');
        const liste = [...root.querySelectorAll('select')].find((s) => s.options[0]?.textContent === '+ restriction');
        liste.value = 'sans_gluten'; liste.dispatchEvent(new Event('change'));
        taper(root, 'poulet');
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        const f = appels[0]?.a.filtres || [];
        eq([f, f.includes('Sans gluten'), f.includes('avec poulet'), f.includes('avec saumon'), puces(root)], [['Sans gluten', 'avec poulet'], true, true, false, ['Sans gluten', 'avec poulet']], 'R-WEB-10 : « saumon » tapé, « + restriction : Sans gluten », champ changé en « poulet » → Sans gluten (liste) et avec poulet partent, pas avec saumon');
        root.remove();
      }
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: 'soupe saumon sans lactose' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        const parNom = (nom) => [...root.querySelectorAll('select')].find((s) => s.options[0]?.textContent === nom);
        parNom('+ type').value = 'dessert'; parNom('+ type').dispatchEvent(new Event('change'));
        parNom('+ restriction').value = 'sans_gluten'; parNom('+ restriction').dispatchEvent(new Event('change'));
        const typeListe = puces(root)[0]; // chipsFor : le type vient en premier
        taper(root, 'poulet');
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        eq([typeListe === 'Soupe', appels[0]?.a.filtres, puces(root)], [false, [typeListe, 'Sans gluten', 'avec poulet'], [typeListe, 'Sans gluten', 'avec poulet']], 'R-WEB-10 : type et régime choisis par les LISTES survivent au champ retapé ; « Sans lactose », « Soupe » et « avec saumon » de l’ancien texte ne partent pas');
        root.remove();
      }
      // R-WEB-10 : « Entrée puis tape » = « tape seule » — même texte, deux chemins, même demande
      {
        const { parseHash } = await import('../src/core/router.js');
        const filtresDe = async (avecEntree) => {
          S.reinitialiserWeb();
          const appels = []; const navs = [];
          const deps = { chercher: async (a) => { appels.push(a); return issueTrouve; }, navigate: (chemin) => { navs.push(chemin); } };
          let root = await monter({ q: 'soupe sans gluten en 20 minutes' }, ctxDe(ANTH), deps);
          taper(root, 'saumon fenouil');
          if (avecEntree) {
            champ(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            root.remove();
            root = await monter(parseHash('#' + navs[navs.length - 1]).query, ctxDe(ANTH), deps); // la ré-instanciation de production
          }
          bouton(root, 'Chercher sur le web avec l’assistant').click();
          await tick();
          root.remove();
          return appels[0]?.filtres;
        };
        const parEntree = await filtresDe(true); const parTape = await filtresDe(false);
        eq([parEntree, parTape], [['avec fenouil', 'avec saumon'], ['avec fenouil', 'avec saumon']], 'R-WEB-10 : « soupe sans gluten en 20 minutes » puis « saumon fenouil » : Entrée puis tape et tape seule envoient la MÊME demande');
      }
      // R-WEB-9 de bout en bout : la tape ne ré-instancie PAS la route. Le faux `navigate` fait ce que fait app.js sur
      // hashchange (une NOUVELLE instance montée depuis l'adresse) ; la tape doit passer par remplacerAdresse, sans re-rendu.
      {
        S.reinitialiserWeb();
        const { parseHash } = await import('../src/core/router.js');
        const appels = []; const p = pilote(); const adresses = []; let reinstanciations = 0;
        const ctx = ctxDe(ANTH);
        let vue = null;
        const deps = {
          chercher: async (a, d) => { appels.push({ a, d }); return p.promesse; },
          remplacerAdresse: (h) => { adresses.push(h); },
          // hashchange arrive dans une tâche LATER : la nouvelle instance est montée après le tour de lancer(), comme en production.
          navigate: (chemin) => { reinstanciations += 1; setTimeout(async () => { const r = await S.renderSearch({}, parseHash('#' + chemin).query, ctx, deps); vue.replaceWith(r); vue = r; }, 0); },
        };
        const root = await monter({ q: '' }, ctx, deps);
        vue = root;
        taper(root, 'saumon');
        const liste = [...root.querySelectorAll('select')].find((s) => s.options[0]?.textContent === '+ restriction');
        liste.value = 'sans_gluten'; liste.dispatchEvent(new Event('change'));
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick(); await tick(); // la tâche du faux hashchange a tourné
        eq([reinstanciations, vue === root, adresses, puces(vue).includes('Sans gluten'), S.etatWeb().enCours, !!vue.querySelector('[role="status"]') && texte(vue).includes('L’assistant cherche sur le web…'), !!bouton(vue, 'Annuler'), !!vue.querySelector('[data-role="chercher-web"]'), appels.length, appels[0]?.a.filtres.includes('Sans gluten')], [0, true, ['/search?q=saumon&mode=web'], true, true, true, true, false, 1, true], 'R-WEB-9 : la tape met l’adresse à jour SANS re-rendu (remplacerAdresse, navigate jamais appelé) : la MÊME instance garde « Sans gluten » et montre le vol en cours avec « Annuler », aucun bouton rallumé');
        p.resoudre(issueTrouve);
        await tick();
        eq([vue === root, texte(vue).includes('Trouvé sur le web'), texte(vue).includes('La demande a changé depuis cette recherche.'), puces(vue).includes('Sans gluten')], [true, true, false, true], 'R-WEB-9 : à la réponse, les liens s’affichent dans cette instance SANS la mention K1 (la demande affichée est celle qui est partie)');
        eq([appels[0]?.a.cfg?.api_key === CLE_ECRAN, JSON.stringify(S.etatWeb()).includes(CLE_ECRAN), texte(vue).includes(CLE_ECRAN), document.body.textContent.includes(CLE_ECRAN)], [true, false, false, false], 'I-C écran : la clé atteint chercher(), jamais etatWeb() ni le texte rendu après un trouvé (V-F2)');
        root.remove();
      }
      // R-WEB-9, dépendance par défaut : sans remplacerAdresse injecté, la tape pose l'adresse par history.replaceState (aucun
      // hashchange, donc aucun re-rendu) et l'instance garde son vol ; l'adresse de la page de tests est rendue au finally.
      {
        S.reinitialiserWeb();
        const adresseAvant = location.href;
        let hashchanges = 0; const compter = () => { hashchanges += 1; };
        window.addEventListener('hashchange', compter);
        try {
          const p = pilote(); let navs = 0;
          const root = await S.renderSearch({}, { mode: 'web', q: 'saumon' }, ctxDe(ANTH), { chercher: async () => p.promesse, navigate: () => { navs += 1; } });
          scene.append(root);
          bouton(root, 'Chercher sur le web avec l’assistant').click();
          await tick();
          const apres = location.href;
          eq([apres.includes('#/search?q=saumon'), hashchanges, navs, S.etatWeb().enCours, !!root.querySelector('[role="status"]') && !!bouton(root, 'Annuler')], [true, 0, 0, true, true], 'R-WEB-9 : par défaut, la tape pose #/search?q=… par replaceState (aucun hashchange, aucun navigate) et l’instance montre son vol (vol.cle === sa clé)');
          p.resoudre(issueTrouve);
          await tick();
          root.remove();
        } finally { window.removeEventListener('hashchange', compter); if (location.href !== adresseAvant) history.replaceState(null, '', adresseAvant); }
      }
      // run() passe par requeteRoute et le `navigate` injecté : Entrée dans le champ navigue par le faux, sans appeler l'assistant (I-B)
      {
        S.reinitialiserWeb();
        const navs = []; let appels = 0;
        const adresseAvant = location.href;
        try {
          const root = await monter({ q: 'saumon' }, ctxDe(ANTH), { chercher: async () => { appels += 1; return issueTrouve; }, navigate: (p, o) => { navs.push([p, o]); } });
          champ(root).value = 'saumon fenouil';
          champ(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          const [chemin, options] = navs[0] || [];
          eq([navs.length, typeof chemin === 'string' && chemin.startsWith('/search?') && chemin.includes('q='), chemin, options, appels, location.href === adresseAvant], [1, true, '/search?q=saumon+fenouil&mode=web', { replace: true }, 0, true], 'run() : Entrée → le navigate INJECTÉ reçoit /search?q=… (requeteRoute, en replace), aucun appel à l’assistant, l’adresse de la page de tests intacte');
          root.remove();
        } finally { if (location.href !== adresseAvant) history.replaceState(null, '', adresseAvant); }
      }
      // R-WEB-1 : ce qui part est la demande NETTOYÉE par construireDemande (un Cf retiré), jamais la saisie brute
      {
        S.reinitialiserWeb();
        const appels = [];
        const root = await monter({ q: 'saumon\u{200B} fenouil' }, ctxDe(ANTH), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        eq(appels.map((x) => x.a.q), ['saumon fenouil'], 'R-WEB-1 : la demande envoyée est q NETTOYÉ (le U+200B retiré), pas la saisie brute');
        root.remove();
      }
      // Filet (§ 5.4.5, F12)
      {
        S.reinitialiserWeb();
        const root = await monter({ q: 'saumon' }, ctxDe(ANTH), { chercher: async () => { throw new TypeError('bogue'); }, navigate: () => {} });
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await new Promise((r) => setTimeout(r, 0));
        eq([S.etatWeb().enCours, S.etatWeb().memoire?.etat], [false, 'indisponible'], 'filet : un chercher qui lève → indisponible en mémoire, plus de vol (jamais d’écran figé)');
        const statutFilet = root.querySelector('[role="status"]');
        eq([statutFilet?.textContent.includes('L’assistant cherche sur le web…'), statutFilet?.textContent.includes('L’assistant n’a pas répondu. Réessaie.'), texte(root).includes('Code : interne')], [false, true, true], 'filet : la vue abonnée est redessinée (notifier → vues) : plus d’écran « en cours », le texte générique et « Code : interne » (K3)');
        root.remove();
      }
      eq(appelsReseau, 0, 'écran web : aucun appel réseau réel pendant ces tests');
    } finally { globalThis.fetch = vraiFetch; scene.remove(); S.reinitialiserWeb(); setUiLocale(localeAvant); }
  }

  // --- § 5.5-5.6 écran du mode Web : issues, Garder ce lien, mémoire par clé de demande
  {
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale();
    setUiLocale('fr'); // une suite antérieure bascule 'en' ; ce bloc affirme des textes français (rendue dans le finally)
    const S = await import('../src/ui/search.js');
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async (u) => { throw new Error(`aucun reseau attendu ici : ${u}`); };
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    try {
      // I-J : « saumon » et « fenouil » sont des ingrédients du lexique et deviennent des puces « avec … » ; leurs libellés fr.
      const ING = new Map([['ing_salmon', { labels: { fr: { label: 'saumon' } } }], ['ing_fennel_bulb', { labels: { fr: { label: 'fenouil' } } }], ['ing_chicken', { labels: { fr: { label: 'poulet' } } }]]);
      const ctxDe = (llm) => ({ docs: [], docsByRecipe: new Map(), ingredientsById: ING, meal_feedback: [], settings: { llm } });
      const CLE_ECRAN = 'sk-ant-cle-ecran-sentinelle'; // V-F2 : elle doit atteindre chercher(), jamais l'état ni l'écran
      const ANTH = { provider: 'anthropic', api_key: CLE_ECRAN, model: 'm' };
      // remplacerAdresse factice par défaut : la tape (lancer) met l'adresse à jour par history.replaceState, pas celle de la page de tests.
      const monter = async (query, ctx, deps) => { const root = await S.renderSearch({}, { mode: 'web', ...query }, ctx, { remplacerAdresse: () => {}, ...deps }); scene.append(root); return root; };
      const texte = (root) => root.textContent;
      const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const puces = (root) => [...root.querySelectorAll('.chip')].map((c) => c.textContent); // les puces AFFICHÉES
      const enVol = (root) => !!root.querySelector('[role="status"]') && texte(root).includes('L’assistant cherche sur le web…'); // « rien » a aussi un role=status
      // Tape, laisse lancer() appeler chercher (qui pose appels.rendre), résout l'issue, laisse la mémoire et le redessin se poser.
      const tapeEtAttend = async (root, issue) => { bouton(root, 'Chercher sur le web avec l’assistant').click(); await tick(); appels.rendre(issue); await tick(); };
      const liens = [{ href: 'https://a.test/r?x=1', hote: 'a.test', titre: '<b>Saumon</b> au fenouil', date: 'May 1, 2026', pourquoi: 'Fenouil et saumon.' }, { href: 'https://b.test/', hote: 'b.test', titre: 'b.test', date: null, pourquoi: null }, { href: 'https://u:p@a.test/x', hote: 'a.test', titre: '', date: null, pourquoi: null }];
      const trouve = { etat: 'trouve', raison: null, liens, autres: [], repli: false, recherches: 2, modele: 'm' };
      const appels = { n: 0, deps: [], args: [], rendre: null };
      const chercher = async (a, d) => { appels.n += 1; appels.deps.push(d); appels.args.push(a); return new Promise((r) => { appels.rendre = r; }); };
      const navs = [];
      const ctx = ctxDe(ANTH);

      // trouve
      S.reinitialiserWeb();
      let root = await monter({ q: 'saumon fenouil' }, ctx, { chercher, navigate: (p) => navs.push(p) });
      await tapeEtAttend(root, trouve);
      const a = root.querySelectorAll('a[target="_blank"][rel="noopener noreferrer"]');
      eq([...a].map((n) => [n.getAttribute('href'), n.textContent]), [['https://a.test/r?x=1', '<b>Saumon</b> au fenouil'], ['https://b.test/', 'b.test'], ['https://a.test/x', 'a.test']], 'trouve : un lien par résultat, href exact (identifiants retirés AU RENDU), titre en TEXTE littéral, titre vide → hôte (I-H, Review Focus 3)');
      eq(root.querySelectorAll('b').length, 0, 'trouve : aucun élément créé par un titre hostile');
      ok(texte(root).includes('a.test · May 1, 2026') && texte(root).includes('Fenouil et saumon.'), 'trouve : hôte, date, pourquoi');
      ok(texte(root).includes('Trouvé sur le web') && texte(root).includes('Demande envoyée : saumon fenouil'), 'trouve : titre de section et demande envoyée (I-J)');
      eq([appels.args[0]?.cfg?.api_key === CLE_ECRAN, JSON.stringify(S.etatWeb()).includes(CLE_ECRAN), texte(root).includes(CLE_ECRAN)], [true, false, false], 'I-C écran : après un trouvé, la clé n’est ni dans etatWeb() ni dans le texte rendu — elle a bien atteint chercher() (V-F2)');
      // R-WEB-1 : une saisie avec un caractère de format (U+200B) est nettoyée AVANT l'envoi ; l'écran rappelle la demande partie
      {
        const r0 = await monter({ q: 'saumon\u{200B} fenouil' }, ctx, { chercher, navigate: () => {} });
        const n = appels.n;
        // La mémoire existe (le « trouve » ci-dessus) : la nouvelle instance montre donc l'écran de l'issue (§ 5.1, K1), dont
        // le geste de relance est « Chercher à nouveau » (= tape, § 5.4) — le bouton « Chercher sur le web… » n'y est pas.
        bouton(r0, 'Chercher à nouveau').click(); await tick();
        eq(appels.args[appels.args.length - 1].q, 'saumon fenouil', 'tape : le q NETTOYÉ (construireDemande) est passé au module — ce qui part est ce qui sera rappelé (R-WEB-1)');
        appels.rendre(trouve); await tick();
        ok(texte(r0).includes('Demande envoyée : saumon fenouil') && !texte(r0).includes('\u{200B}'), 'trouve : la demande rappelée est celle qui est PARTIE, nettoyée (R-WEB-1)');
        eq(appels.n, n + 1, 'tape : un seul appel pour cette saisie');
        r0.remove();
      }
      ok(texte(root).includes('L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.'), 'trouve : l’avertissement fixe est TOUJOURS là (I-K, S1)');
      ok(texte(root).includes('Recherches faites par l’assistant : 2') && !texte(root).includes('Liens tels que trouvés'), 'trouve : compte des recherches ; pas de ligne repli');
      // lancer() ne navigue pas (R-WEB-9 : remplacerAdresse, sans re-rendu) : seules les navigations vers le signet comptent.
      const avantGarder = navs.filter((p) => p.startsWith('/add/signet')).length;
      [...root.querySelectorAll('button')].find((b) => b.textContent === 'Garder ce lien').click();
      const versSignet = navs.filter((p) => p.startsWith('/add/signet'));
      eq([avantGarder, versSignet.length], [0, 1], 'garder : une seule navigation vers le signet, après le clic seulement');
      { const [chemin, qs] = versSignet[0].split('?'); const p = new URLSearchParams(qs); eq([chemin, p.get('adresse'), p.get('titre')], ['/add/signet', 'https://a.test/r?x=1', '<b>Saumon</b> au fenouil'], 'garder : route signet préremplie, adresse et titre encodés'); }
      // I-H au rendu : la carte d'une adresse à identifiants garde l'href NETTOYÉ, jusque dans « Garder ce lien »
      {
        const carteCred = root.querySelector('a[href="https://a.test/x"]')?.parentElement;
        [...(carteCred?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Garder ce lien')?.click();
        const dernier = navs.filter((p) => p.startsWith('/add/signet'));
        const p = new URLSearchParams(dernier[dernier.length - 1]?.split('?')[1] ?? '');
        eq([dernier.length, p.get('adresse'), p.get('titre')], [2, 'https://a.test/x', 'a.test'], 'garder : la carte à identifiants navigue avec l’adresse SANS u:p et le titre de repli (I-H)');
      }
      ok(!!bouton(root, 'Chercher à nouveau'), 'trouve : « Chercher à nouveau » présent');
      // V-F7 : « Annuler » laisse une VRAIE mémoire intacte — « Chercher à nouveau » depuis un trouvé, puis « Annuler »
      {
        const n = appels.n;
        bouton(root, 'Chercher à nouveau')?.click(); await tick();
        const enCours = [enVol(root), !!bouton(root, 'Annuler'), appels.n];
        bouton(root, 'Annuler')?.click(); // ?. : un écran faux rend l'assertion rouge au lieu d'interrompre le bloc
        eq([enCours, S.etatWeb().memoire?.etat, S.etatWeb().enCours, root.querySelectorAll('a[target="_blank"]').length, texte(root).includes('Trouvé sur le web')], [[true, true, n + 1], 'trouve', false, 3, true], 'annuler : depuis un trouvé, « Chercher à nouveau » puis « Annuler » → la mémoire reste « trouve » et ses liens sont remontrés (V-F7)');
        appels.rendre({ etat: 'indisponible', raison: 'annule', liens: [], autres: [], repli: false, recherches: null, modele: 'm' }); await tick(); // le vol annulé finit, muet
      }
      // Mémoire par clé (F13/S5/F20) : une nouvelle instance avec la même demande montre les liens SANS appel
      root.remove();
      const nAvant = appels.n;
      root = await monter({ q: 'saumon fenouil' }, ctx, { chercher, navigate: () => {} });
      eq([appels.n, root.querySelectorAll('a[target="_blank"]').length], [nAvant, 3], 'mémoire : même demande, nouvelle instance → les liens, aucun appel (F3/F20)');
      // Puce ajoutée → clé différente → les liens RESTENT, la différence est dite (K1) ; puce retirée → la mention disparaît (Review Focus 2)
      const selects = root.querySelectorAll('select');
      const restriction = [...selects].find((s) => [...s.options].some((o) => o.textContent === '+ restriction'));
      restriction.value = 'sans_gluten'; restriction.dispatchEvent(new Event('change'));
      eq([root.querySelectorAll('a[target="_blank"]').length, texte(root).includes('La demande a changé depuis cette recherche.'), appels.n], [3, true, nAvant], 'puce : ajoutée → les liens RESTENT, la mention « la demande a changé » apparaît, aucun appel (K1)');
      [...root.querySelectorAll('.chip.removable')].find((c) => c.textContent === 'Sans gluten').click();
      eq([root.querySelectorAll('a[target="_blank"]').length, texte(root).includes('La demande a changé depuis cette recherche.'), appels.n], [3, false, nAvant], 'puce : retirée → la mention disparaît, aucun appel');
      // R-WEB-2 : un filtre ajouté par la liste, champ inchangé, PART avec la tape (il n'est pas écrasé par une relecture du champ)
      restriction.value = 'sans_gluten'; restriction.dispatchEvent(new Event('change'));
      { const n = appels.n; const affichees = puces(root); bouton(root, 'Chercher à nouveau').click(); await tick(); const dernier = appels.args[appels.args.length - 1]; eq([appels.n, dernier.q, dernier.filtres, affichees.includes('Sans gluten')], [n + 1, 'saumon fenouil', affichees, true], 'tape : le filtre ajouté par la liste part avec la demande (EXACTEMENT les puces affichées), le champ inchangé n’est pas réanalysé (R-WEB-2)'); appels.rendre(trouve); await tick(); }
      eq([...root.querySelectorAll('.muted')].find((n) => n.textContent.startsWith('Demande envoyée'))?.textContent, 'Demande envoyée : saumon fenouil · ' + puces(root).join(' ; '), 'Chercher à nouveau : « Demande envoyée » dit EXACTEMENT la demande relancée, puces jointes par « ; » (I-J)');
      // Confort après preuve (item 2) : quand la demande a changé (K1), « Chercher à nouveau » est AUSSI sur la ligne de la
      // mention, AVANT les liens (il n'était qu'en bas, sous les cartes et « Autres pages ») ; le bouton du bas reste.
      root.remove(); S.reinitialiserWeb();
      root = await monter({ q: 'saumon fenouil' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, trouve);
      {
        const relances = () => [...root.querySelectorAll('button')].filter((b) => b.textContent === 'Chercher à nouveau');
        const avantLiens = (b) => !!(b && (b.compareDocumentPosition(root.querySelector('a[target="_blank"]')) & Node.DOCUMENT_POSITION_FOLLOWING));
        const ajouterSansGluten = () => { const l = [...root.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent === '+ restriction')); l.value = 'sans_gluten'; l.dispatchEvent(new Event('change')); };
        ajouterSansGluten();
        { const [haut, bas] = relances(); const ligne = haut?.parentElement;
          eq([relances().length, avantLiens(haut), ligne?.matches('.status.row.between'), ligne?.querySelector('span')?.textContent, avantLiens(bas), bas?.parentElement?.tagName],
            [2, true, true, 'La demande a changé depuis cette recherche.', false, 'SECTION'], 'K1 : demande changée → DEUX « Chercher à nouveau » : le premier sur la ligne de la mention, avant le premier lien ; celui du bas reste (confort, item 2)'); }
        [...root.querySelectorAll('.chip.removable')].find((c) => c.textContent === 'Sans gluten').click();
        { const r = relances(); eq([r.length, avantLiens(r[0]), r[0]?.parentElement?.tagName, texte(root).includes('La demande a changé depuis cette recherche.')], [1, false, 'SECTION', false], 'sans mention (puce retirée) : UN seul « Chercher à nouveau », en bas (confort, item 2)'); }
        ajouterSansGluten();
        const n = appels.n; const affichees = puces(root);
        const haut = relances()[0]; const enHaut = avantLiens(haut);
        haut.click(); await tick();
        const dernier = appels.args[appels.args.length - 1];
        eq([enHaut, appels.n, dernier.q, dernier.filtres, affichees.includes('Sans gluten'), enVol(root)], [true, n + 1, 'saumon fenouil', affichees, true, true], 'le « Chercher à nouveau » de la mention (avant les liens) lance la tape : un appel, avec les puces courantes (confort, item 2)');
        appels.rendre(trouve); await tick();
      }
      // R-WEB-3 : un « trouvé » dont aucune adresse ne survit à la revalidation au rendu replie sur l'écran « rien »
      root.remove(); S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { ...trouve, liens: [{ ...liens[0], href: 'javascript:alert(1)' }] });
      ok(!texte(root).includes('Trouvé sur le web') && texte(root).includes('Aucune page trouvée pour cette demande.'), 'trouve sans carte : pas de titre vide, écran « rien » (R-WEB-3)');
      // K2 : les autres pages trouvées, repliées, jamais mêlées aux choix
      root.remove(); S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { ...trouve, autres: [{ href: 'https://c.test/x', hote: 'c.test', titre: 'C', date: null, pourquoi: null }] });
      { const d = root.querySelector('details'); eq([d?.querySelector('summary')?.textContent, d?.open, d?.querySelectorAll('a[target="_blank"]').length, root.querySelectorAll('a[target="_blank"]').length], ['Autres pages trouvées (1)', false, 1, 4], 'autres : repliées sous « Autres pages trouvées (1) », avec leur lien (K2)'); }
      // mode all : aucun lien web
      root.remove();
      root = await monter({ q: 'saumon fenouil', mode: 'all' }, ctx, { chercher, navigate: () => {} });
      eq(root.querySelectorAll('a[target="_blank"]').length, 0, 'mode all : aucun lien web');
      root.remove();
      // repli
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { ...trouve, repli: true, recherches: null });
      ok(texte(root).includes('Liens tels que trouvés, sans tri de l’assistant.') && !texte(root).includes('Recherches faites'), 'repli : ligne repli ; pas de compte quand recherches est null');
      root.remove();
      // rien + Réessayer force enLigne (S9) : monté avec enLigne FAUX, l'appel de « Réessayer » doit recevoir vrai
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {}, enLigne: () => false });
      await tapeEtAttend(root, { etat: 'rien', raison: null, liens: [], repli: false, recherches: 1, modele: 'm' });
      ok(texte(root).includes('Aucune page trouvée pour cette demande. Reformule ou cherche autrement.') && !!bouton(root, 'Réessayer'), 'rien : texte + Réessayer');
      { const n = appels.n; bouton(root, 'Réessayer').click(); await tick(); eq([appels.n, appels.deps[appels.deps.length - 1].enLigne()], [n + 1, true], 'réessayer : rappelle chercher avec enLigne forcé à vrai (S9)'); eq([enVol(root), !!bouton(root, 'Annuler'), !!bouton(root, 'Chercher à nouveau')], [true, true, false], 'réessayer depuis « rien » : écran du vol, « Annuler », plus de « Chercher à nouveau » (V-F4)'); appels.rendre(trouve); await tick(); }
      root.remove();
      // indisponible × 8
      const CAS = [['hors_ligne', 'Tu es hors ligne.', true, false, false], ['cle_refusee', 'Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.', false, true, false], ['recherche_desactivee', 'La recherche web n’est pas activée sur ton compte Anthropic.', false, true, false], ['trop_de_demandes', 'Trop de demandes pour l’instant. Réessaie dans une minute.', true, false, false], ['refus', 'L’assistant a refusé cette demande.', false, false, false], ['pas_cherche', 'L’assistant n’a pas cherché sur le web. Réessaie.', true, false, false], ['delai', 'L’assistant n’a pas répondu. Réessaie.', true, false, true], ['interne', 'L’assistant n’a pas répondu. Réessaie.', true, false, true], ['constructor', 'L’assistant n’a pas répondu. Réessaie.', true, false, true]]; // « constructor » : une clé du prototype n'est pas une raison connue (Object.hasOwn)
      for (const [raison, attendu, reessai, reglages, code] of CAS) {
        S.reinitialiserWeb();
        root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
        await tapeEtAttend(root, { etat: 'indisponible', raison, liens: [], repli: false, recherches: null, modele: 'm' });
        const statut = root.querySelector('.status.warn[role="status"]');
        eq([statut?.textContent.includes(attendu), !!bouton(root, 'Réessayer'), !!bouton(root, 'Chercher à nouveau'), !!root.querySelector('a[href="#/settings"]'), texte(root).includes('Code : ' + raison)], [true, reessai, !reessai, reglages, code], `indisponible/${raison} : texte, Réessayer=${reessai}, Chercher à nouveau=${!reessai}, Réglages=${reglages}, code=${code} (K3, R-WEB-7)`);
        root.remove();
      }
      // R-WEB-7 (a) : une issue sans « Réessayer » relance la MÊME demande par « Chercher à nouveau », SANS forcer enLigne
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {}, enLigne: () => false });
      await tapeEtAttend(root, { etat: 'indisponible', raison: 'cle_refusee', liens: [], repli: false, recherches: null, modele: 'm' });
      {
        const n = appels.n; const b = bouton(root, 'Chercher à nouveau'); const present = !!b;
        b?.click(); await tick();
        eq([present, appels.n, appels.args[appels.args.length - 1].q, appels.deps[appels.deps.length - 1].enLigne()], [true, n + 1, 'saumon', false], 'cle_refusee : « Chercher à nouveau » relance la même demande, un appel, enLigne NON forcé (contraste avec « Réessayer », R-WEB-7)');
        eq([enVol(root), !!bouton(root, 'Annuler'), !!bouton(root, 'Chercher à nouveau')], [true, true, false], 'cle_refusee : après « Chercher à nouveau », écran du vol avec « Annuler », plus de « Chercher à nouveau » (V-F4)');
        appels.rendre(trouve); await tick();
      }
      root.remove();
      // R-WEB-7 (b) : K1 ne vaut que pour « trouvé » — un refus en mémoire, une puce ajoutée → retour à l'écran du bouton, aucun appel
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { etat: 'indisponible', raison: 'refus', liens: [], repli: false, recherches: null, modele: 'm' });
      {
        const n = appels.n; const avant = texte(root).includes('L’assistant a refusé cette demande.');
        const liste = [...root.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent === '+ restriction'));
        liste.value = 'sans_gluten'; liste.dispatchEvent(new Event('change'));
        const b = root.querySelector('[data-role="chercher-web"]');
        eq([avant, texte(root).includes('L’assistant a refusé cette demande.'), !!b, b?.disabled, appels.n], [true, false, true, false, n], 'refus : une puce ajoutée change la demande → l’écran du refus disparaît, écran du bouton allumé, aucun appel (R-WEB-7)');
      }
      root.remove();
      // Réglage changé pendant le vol (Review Focus 5) : les issues de garde se rendent avec le texte de la garde, + une sortie
      for (const [etat, attendu] of [['non_configure', 'Pour chercher sur le web, configure l’assistant IA'], ['non_pris_en_charge', 'Ce fournisseur ne cherche pas sur le web.']]) {
        S.reinitialiserWeb();
        root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
        await tapeEtAttend(root, { etat, raison: null, liens: [], repli: false, recherches: null, modele: null });
        eq([texte(root).includes(attendu), !!root.querySelector('a[href="#/settings"]'), !!bouton(root, 'Chercher à nouveau')], [true, true, true], `${etat} en issue : texte de la garde + Réglages + « Chercher à nouveau » (F5, R-WEB-7)`);
        root.remove();
      }
      // Lu par le VRAI fetch : le global est remplacé ici par un piège qui lève (aucun réseau pendant les rendus).
      {
        const res = await vraiFetch('../src/ui/search.js?v=' + Date.now(), { cache: 'no-store' });
        const src = await res.text();
        eq([res.ok, src.includes('function renderIssue'), src.includes('innerHTML'), src.includes('html:')], [true, true, false, false], 'search.js : source réellement lu (renderIssue présent), aucun innerHTML ni html:');
      }
    } finally { globalThis.fetch = vraiFetch; scene.remove(); S.reinitialiserWeb(); setUiLocale(localeAvant); }
  }
  // --- § 6 signet prérempli : adresse telle quelle, titre borné, bannière + hôte, aucune écriture
  {
    const S = await import('../src/ui/signet.js');
    const { withRepo } = await import('./sync-fixture.js');
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async (u) => { throw new Error(`aucun reseau attendu ici : ${u}`); };
    try {
      await withRepo(async (repo, db) => {
        const ctx = { book_editions: [], booksById: new Map(), books: [], recipes: [] };
        const deps = { repo, navigate: () => {}, toast: () => {} };
        const champ = (root, libelle) => [...root.querySelectorAll('label.field')].find((f) => f.querySelector('span')?.textContent === libelle).querySelector('input');
        const garder = (root) => root.querySelector('[data-role="enregistrer"]');
        const banniere = (root) => root.querySelector('[data-role="adresse-recue"]');
        const avant = (await db.getAll('recipes')).length;
        let root = await S.renderSignetRoute({}, { adresse: 'https://exemple.test/r', titre: 'Saumon' }, ctx, deps);
        eq([champ(root, 'Adresse *').value, champ(root, 'Titre *').value, garder(root).disabled], ['https://exemple.test/r', 'Saumon', false], 'signet prérempli : les deux champs, bouton ouvert');
        ok(banniere(root)?.textContent.includes('Adresse reçue : vérifie-la avant d’enregistrer.') && banniere(root)?.querySelector('strong')?.textContent === 'exemple.test', 'signet prérempli : bannière + hôte recalculé en gras (S4)');
        eq((await db.getAll('recipes')).length, avant, 'signet prérempli : aucune écriture avant Enregistrer');
        root = await S.renderSignetRoute({}, { adresse: 'javascript:alert(1)', titre: 'X' }, ctx, deps);
        eq([champ(root, 'Adresse *').value, root.querySelector('[data-erreur="adresse"]').textContent, banniere(root)?.querySelector('strong')?.textContent, garder(root).disabled], ['javascript:alert(1)', 'Adresse non reconnue.', '', true], 'signet prérempli : adresse refusée → montrée, erreur dite, hôte vide, bouton fermé');
        const longue = 'https://exemple.test/' + 'a'.repeat(3000);
        root = await S.renderSignetRoute({}, { adresse: longue, titre: 'X' }, ctx, deps);
        eq([champ(root, 'Adresse *').value.length, root.querySelector('[data-erreur="adresse"]').textContent, garder(root).disabled, banniere(root)?.querySelector('strong')?.textContent], [longue.length, 'Adresse trop longue.', true, ''], 'signet prérempli : une adresse trop longue n’est JAMAIS tronquée — refusée, et la bannière ne montre aucun hôte (I-A, F9, R-WEB-8)');
        // R-WEB-8 : la bannière suit la MÊME décision que l'enregistrement (signetModel, adresse rognée par trim()) — un NBSP
        // en tête n'est pas retiré par l'analyseur d'URL mais l'est par trim() : le formulaire accepte et enregistrerait cette adresse.
        root = await S.renderSignetRoute({}, { adresse: '\u{00A0}https://exemple.test/r', titre: 'X' }, ctx, deps);
        eq([banniere(root)?.querySelector('strong')?.textContent, garder(root).disabled], ['exemple.test', false], 'signet prérempli : adresse à NBSP en tête → la bannière montre l’hôte que le formulaire enregistrera (R-WEB-8)');
        root = await S.renderSignetRoute({}, { adresse: '   ', titre: 'X' }, ctx, deps);
        eq([banniere(root), champ(root, 'Adresse *').value], [null, ''], 'signet prérempli : une adresse d’espaces n’est pas « reçue » — aucune bannière, champ vide (R-WEB-8)');
        root = await S.renderSignetRoute({}, { adresse: 'https://exemple.test/r', titre: 't'.repeat(100) + '\u{202E}' + 't'.repeat(300) }, ctx, deps);
        eq([champ(root, 'Titre *').value.length, champ(root, 'Titre *').value.includes('\u{202E}')], [300, false], 'signet prérempli : titre borné à 300 points de code, le bidi placé AVANT la coupe est retiré (S2, V-F5)');
        root = await S.renderSignetRoute({}, { adresse: 'https://exemple.test/r', titre: '😀'.repeat(200) }, ctx, deps);
        { const err = root.querySelector('[data-erreur="titre"]'); eq([Array.from(champ(root, 'Titre *').value).length, err.textContent, err.hidden, garder(root).disabled], [200, '', true, false], 'signet prérempli : 200 emoji (400 unités UTF-16) — signetModel compte des POINTS DE CODE comme borner : aucune erreur « Titre trop long. », bouton ouvert'); }
        { const a = 'https://exemple.test/r'; const m300 = S.signetModel({ adresse: a, titre: '😀'.repeat(300) }); const m301 = S.signetModel({ adresse: a, titre: '😀'.repeat(301) }); eq([m300.valide, m301.valide, !!m301.erreurs.titre], [true, false, true], 'signetModel : la borne du titre est 300 POINTS DE CODE (300 emoji passent, 301 non)'); }
        root = await S.renderSignetRoute({}, {}, ctx, deps);
        eq([banniere(root), champ(root, 'Adresse *').value], [null, ''], 'signet sans query : aucune bannière, champ vide (comportement inchangé)');
      });
    } finally { globalThis.fetch = vraiFetch; }
  }
  // --- § 8 / § 9.8 dictionnaire et statiques
  {
    const { EN } = await import('../src/i18n/en.js');
    const CLES = ['Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.', 'Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.', 'Chercher sur le web avec l’assistant', 'Une recherche = un appel à ton compte Anthropic.', 'Écris d’abord ce que tu cherches.', 'L’assistant cherche sur le web…', 'Annuler', 'Trouvé sur le web', 'Demande envoyée : {q}', 'Garder ce lien', 'L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.', 'Recherches faites par l’assistant : {n}', 'Liens tels que trouvés, sans tri de l’assistant.', 'Chercher à nouveau', 'Aucune page trouvée pour cette demande. Reformule ou cherche autrement.', 'Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.', 'La recherche web n’est pas activée sur ton compte Anthropic.', 'Trop de demandes pour l’instant. Réessaie dans une minute.', 'L’assistant a refusé cette demande.', 'L’assistant n’a pas cherché sur le web. Réessaie.', 'L’assistant n’a pas répondu. Réessaie.', 'Adresse reçue : vérifie-la avant d’enregistrer.', 'La demande a changé depuis cette recherche.', 'Autres pages trouvées ({n})', 'Réessayer', 'Réglages', 'Tu es hors ligne.', 'Code : {c}'];
    eq(CLES.filter((k) => typeof EN[k] !== 'string' || !EN[k]), [], 'en.js : chaque texte du lot a sa traduction');
    ok(!('Le Web n’est pas activé : aucune source externe n’est configurée. Aucune recherche extérieure n’a été faite.' in EN), 'en.js : la clé morte du mode Web est retirée');
    ok(!(await lire('../src/ui/search.js')).includes('Le Web n’est pas activé'), 'search.js : la coquille est retirée');
    ok(!/from '\.\.\/ui\//.test(await lire('../src/core/bornes.js')) && !/from '\.\.\/ui\//.test(await lire('../src/domain/recherche-web.js')), 'couches : bornes.js et recherche-web.js n’importent rien de src/ui/');
  }
}
