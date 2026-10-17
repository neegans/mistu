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

  // --- § 8 : version 0.5.0, SHELL
  {
    const sw = await lire('../sw.js');
    ok(/VERSION = 'cuisine-os-v0\.5\.0-\d+'/.test(sw), 'sw.js : VERSION 0.5.0');
    ok(sw.includes("'./src/core/bornes.js'"), 'SHELL : ./src/core/bornes.js');
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(APP_VERSION, '0.5.0', 'APP_VERSION 0.5.0');
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
    const lancer = (deps = {}, a = args) => { appels = []; return W.chercherRecettesWeb(a, { fetch: fauxFetch, enLigne: () => true, fuseau: 'America/Toronto', ...deps }); };

    // Forme de l'appel
    const ok1 = await lancer();
    eq([ok1.etat, ok1.liens.map((l) => l.href), ok1.autres.map((l) => l.href), ok1.liens[0].pourquoi, ok1.recherches, ok1.modele, ok1.repli], ['trouve', ['https://b.test/2'], ['https://a.test/1'], 'Fenouil.', 2, 'modele-test', false], 'appel : cas nominal → trouve, le choix seul dans liens, l’autre page à part (K2), recherches, modèle');
    eq(appels.length, 1, 'appel : un seul fetch');
    eq(appels[0].self, undefined, 'appel : fetch est appelé comme fonction libre, sans this (F11)');
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
    eq([(await lancer({}, { ...args, q: '\u{200B}' })).raison, appels.length], ['requete', 0], 'garde : demande vide après nettoyage → indisponible/requete, aucun appel');
    eq([(await lancer({ enLigne: () => false })).raison, appels.length], ['hors_ligne', 0], 'garde : hors ligne → aucun appel');
    { const c = new AbortController(); c.abort(); eq([(await lancer({ signal: c.signal })).raison, appels.length], ['annule', 0], 'garde : signal déjà abandonné → annule, aucun appel'); }
    // Statuts HTTP
    const statut = async (s, corps = { error: { type: 'x', message: 'CORPS-SENTINELLE' } }) => { fauxFetch.rendre = () => reponse(s, corps); const i = await lancer(); fauxFetch.rendre = () => reponse(200, nominal); return i; };
    eq([(await statut(401)).raison, (await statut(403)).raison], ['cle_refusee', 'cle_refusee'], 'statut : 401 et 403 → cle_refusee');
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
    { const c = new AbortController(); const p = lancer({ signal: c.signal, tentativeMs: 60000 }); c.abort(); eq((await p).raison, 'annule', 'abandon : signal extérieur pendant le vol → annule'); }
    fauxFetch.rendre = () => new Response(new Blob(['x'.repeat(4096)]), { status: 200 });
    eq((await lancer({ corpsMax: 1024 })).raison, 'reponse_illisible', 'corps : une vraie Response en flux > corpsMax → reponse_illisible (lireBornee)');
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
    fauxFetch.rendre = () => reponse(200, nominal);
  }
}
