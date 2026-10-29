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
    // bornerAuMot (présentation du serveur) : coupe au MOT, « … » à la fin, jamais plus de `max` points de code.
    {
      const mots = Array.from({ length: 120 }, (_, i) => `mot${i}`).join(' '); // 120 mots distincts, bien plus de 400 caractères
      const coupee = typeof B.bornerAuMot === 'function' ? B.bornerAuMot(mots, 400) : 'absente';
      const sansPoints = coupee.slice(0, -1);
      const bm = typeof B.bornerAuMot === 'function' ? B.bornerAuMot : () => 'absente';
      eq([bm('Un plat.', 400), bm('x'.repeat(400), 400), bm('ab\u{200B}c\u{202E}d', 400), bm('a'.repeat(400) + '\u{200B}'.repeat(10), 400)], ['Un plat.', 'x'.repeat(400), 'abcd', 'a'.repeat(400)], 'bornerAuMot : un texte qui tient en 400 points de code une fois nettoyé est rendu nettoyé et inchangé (pas de « … »)');
      eq([bm('x'.repeat(401), 400), bm('a'.repeat(500), 400)], ['x'.repeat(399) + '…', 'a'.repeat(399) + '…'], 'bornerAuMot : sans espace, la coupe est à max − 1 points de code puis « … » (399 + « … » = 400)');
      eq([coupee.endsWith('…'), Array.from(coupee).length <= 400, sansPoints.endsWith(' '), mots.startsWith(sansPoints), mots[sansPoints.length]], [true, true, false, true, ' '], 'bornerAuMot : un texte long à espaces finit par « … », tient en 400, ne finit pas par une espace avant « … », est un préfixe du texte et s’arrête à une frontière de mot');
      eq([Array.from(bm('😀'.repeat(500), 400)).length, bm('😀'.repeat(500), 400).endsWith('😀…')], [400, true], 'bornerAuMot : compte et coupe par points de code (aucune paire de substitution coupée)');
      // La coupe à l'espace n'a lieu que si cette espace est dans la moitié droite : index ≥ floor((400 − 1) / 2) = 199.
      eq([bm('a'.repeat(199) + ' ' + 'b'.repeat(600), 400), bm('a'.repeat(198) + ' ' + 'b'.repeat(600), 400), bm('a'.repeat(300) + '  ' + 'b'.repeat(300), 400)], ['a'.repeat(199) + '…', 'a'.repeat(198) + ' ' + 'b'.repeat(200) + '…', 'a'.repeat(300) + '…'], 'bornerAuMot : une espace à l’index 199 coupe le mot, une espace à l’index 198 (moitié gauche) ne coupe pas ; une double espace à la coupe ne laisse aucune espace avant « … »');
      eq([bm(42, 400), bm(null, 400), bm(undefined, 400)], ['', '', ''], 'bornerAuMot : tout ce qui n’est pas une chaîne vaut la chaîne vide');
      // m1 : une borne qui n'est pas un entier >= 1 ne produit rien (jamais de slice négatif ni de NaN)
      eq([bm('abc', 0), bm('abc', NaN), bm('abc', undefined), bm('abc', -3), bm('abc', 1.5), bm('abc', '5')], ['', '', '', '', '', ''], 'bornerAuMot : max 0, NaN, indéfini, négatif, fractionnaire ou non numérique → chaîne vide');
      // m2 : un saut de ligne ou une tabulation est une espace entre deux phrases (borner les retirerait et colle les mots)
      eq([bm('Un saumon rôti.\nLe fenouil fond.', 400), bm('a\t\r\nb', 400), bm('a\n\n\nb   c', 400)], ['Un saumon rôti. Le fenouil fond.', 'a b', 'a b c'], 'bornerAuMot : sauts de ligne, retours et tabulations deviennent UNE espace (jamais « rôti.Le »)');
      // m2 (résidu) : tous les séparateurs de ligne — VT, FF, NEL, U+2028, U+2029 — valent UNE espace (borner retirerait les deux derniers et collerait les phrases)
      eq([bm('phrase un.\u{2028}phrase deux.', 400), bm('phrase un.\u{2029}phrase deux.', 400), bm('a\u{000B}b\u{000C}c\u{0085}d', 400)], ['phrase un. phrase deux.', 'phrase un. phrase deux.', 'a b c d'], 'bornerAuMot : U+2028, U+2029, tabulation verticale, saut de page et NEL deviennent UNE espace (jamais « un.phrase »)');
      // m3 : la longueur se mesure sur le texte ROGNÉ — les espaces de tête et de fin ne coûtent rien
      eq([bm(' '.repeat(500), 400), bm('x' + ' '.repeat(500), 400), bm(' '.repeat(30) + 'y'.repeat(380), 400)], ['', 'x', 'y'.repeat(380)], 'bornerAuMot : 500 espaces → vide ; « x » + 500 espaces → « x » ; 30 espaces + 380 points de code → rendu entier, sans « … »');
      // m4 : une insécable (U+00A0, U+202F) n'est jamais un point de coupe — « 15 min » ne se coupe pas entre 15 et min
      { const avant = 'a'.repeat(250) + ' ' + 'b'.repeat(143);
        for (const [nom, esp] of [['U+00A0', '\u{00A0}'], ['U+2007', '\u{2007}'], ['U+202F', '\u{202F}']]) {
          const r = bm(avant + '15' + esp + 'min' + 'c'.repeat(200), 400);
          eq([r, r.includes(esp)], ['a'.repeat(250) + '…', false], `bornerAuMot : l’insécable ${nom} de « 15 min » n’est pas un point de coupe — on coupe à l’espace d’avant`);
        } }
      eq(bm('a'.repeat(300) + ' \u{2003}' + 'b'.repeat(300), 400), 'a'.repeat(300) + '…', 'bornerAuMot : une espace large (U+2003) reste un point de coupe, et l’espace qui la précède est retirée avant « … »');
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

  // --- § 8 : version 0.17.0 (lot UI-1 « Carnet » ; 0.16.0 au lot UI-2, aperçus ; 0.15.0 au lot F, plats en images ; 0.14.0 au lot E, 0.13.0 au lot D, 0.12.0 au lot C, 0.11.0 au lot G, 0.10.0 au lot B, 0.9.0 au lot A, 0.8.1 à la présentation du serveur), SHELL
  {
    const sw = await lire('../sw.js');
    ok(/VERSION = 'cuisine-os-v0\.23\.0-\d+'/.test(sw), 'sw.js : VERSION 0.23.0');
    ok(sw.includes("'./src/core/bornes.js'"), 'SHELL : ./src/core/bornes.js');
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(APP_VERSION, '0.23.0', 'APP_VERSION 0.23.0 (lot UI-1, carnet)');
  }

  // --- § 7.1 : supportsWebSearch lu par l'écran (F6) — seule la passerelle (une SESSION) cherche sur le web
  {
    const L = await import('../src/domain/llm.js');
    const SESSION = { access_token: 'jeton-factice-0123', user: { id: 'u1', email: 'a@exemple.invalid' } };
    eq([L.providerFrom({ llm: { provider: 'none' } }).supportsWebSearch, L.providerFrom({ llm: { provider: 'openai_compatible', api_key: 'k', model: 'm' } }).supportsWebSearch, L.providerFrom({ llm: { provider: 'none' } }, { session: SESSION }).supportsWebSearch], [false, false, true], 'llm : seule la passerelle (une session) cherche sur le web');
    eq([L.providerFrom({ llm: { provider: 'anthropic', api_key: 'k', model: 'm' } }).configured, L.providerFrom({}, { session: { access_token: '' } }).configured, L.providerFrom({}, { session: SESSION }).configured], [false, false, true], 'llm : sans session (même avec une clé locale), pas configuré — garde § 5.2 ; avec une session, configuré');
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
    // Présentation du serveur : la consigne annonce le NOUVEAU contrat (champs, voix, bornes) et ne parle plus de « pourquoi ».
    for (const langue of ['fr', 'en']) {
      const sys = W.construireDemande({ q: 'saumon', filtres: [], langue }).system;
      eq(['"presentation"', '"temps_min"', '"difficulte"', '"ingredients"', '"choix"'].filter((m) => !sys.includes(m)), [], `demande : le system ${langue} nomme presentation, temps_min, difficulte, ingredients et choix`);
      ok(!sys.includes('pourquoi'), `demande : le system ${langue} ne contient plus « pourquoi »`);
    }
    {
      const fr = W.construireDemande({ q: 'saumon', filtres: [], langue: 'fr' }).system; const en = W.construireDemande({ q: 'saumon', filtres: [], langue: 'en' }).system;
      ok(fr.includes('deux ou trois phrases') && fr.includes('serveur') && fr.includes('400 caractères au plus') && fr.includes('omets tout champ que tu ne peux pas établir') && fr.includes('Québec') && fr.includes('N’affirme JAMAIS'), 'demande : le system français porte la voix du serveur, les 400 caractères, l’omission des champs inconnus, et garde Québec et l’interdiction d’affirmer');
      ok(en.includes('two or three sentences') && en.includes('waiter') && en.includes('400 characters at most') && en.includes('omit any field you cannot establish') && en.includes('NEVER claim'), 'demande : le system anglais porte la voix du serveur, les 400 caractères, l’omission des champs inconnus, et garde l’interdiction d’affirmer');
    }
    // I4 : la consigne est épinglée MOT POUR MOT — huit lignes par langue recopiées ici (une sortie de construireDemande, pas le source).
    {
      const LIGNES_FR = [
        'Tu trouves des pages de recettes sur le web pour Cuisine OS, une bibliothèque de recettes personnelle.',
        'Cherche TOUJOURS sur le web avec l’outil web_search (1 à 3 recherches), même si tu crois connaître des recettes.',
        'Préfère les pages de recettes complètes ; en français du Québec d’abord.',
        'N’affirme JAMAIS qu’une page respecte une restriction alimentaire ou une durée : dis seulement ce que la page annonce.',
        'Puis réponds UNIQUEMENT par un objet JSON de cette forme : {"choix":[{"url":"…","presentation":"…","temps_min":15,"difficulte":"facile","ingredients":7}]}',
        '— 5 entrées au plus ; chaque url est l’adresse EXACTE d’une page trouvée par la recherche ; n’invente ni page ni adresse ;',
        'presentation = deux ou trois phrases, comme un serveur qui présente le plat à table, en tutoyant : les ingrédients principaux, ce qui fait son charme, et en dernière phrase le lien avec la demande ; le temps ou les portions seulement si la page les donne ; n’affirme jamais qu’elle respecte une restriction ou une durée, dis ce que la page annonce ; aucune adresse web dans le texte ; 400 caractères au plus ;',
        'temps_min = durée totale estimée en minutes (le chiffre de la page si elle en donne un) ; difficulte = "facile", "moyen" ou "exigeant" ; ingredients = nombre d’ingrédients de la page sans compter sel et poivre ; omets tout champ que tu ne peux pas établir.',
      ];
      const LIGNES_EN = [
        'You find recipe pages on the web for Cuisine OS, a personal recipe library.',
        'ALWAYS search the web with the web_search tool (1 to 3 searches), even if you think you know recipes.',
        'Prefer complete recipe pages.',
        'NEVER claim that a page meets a dietary restriction or a duration: only say what the page announces.',
        'Then answer ONLY with a JSON object of this shape: {"choix":[{"url":"…","presentation":"…","temps_min":15,"difficulte":"facile","ingredients":7}]}',
        '— at most 5 entries; each url is the EXACT address of a page found by the search; never invent a page or an address;',
        'presentation = two or three sentences, like a waiter presenting the dish at the table, addressing the reader as "you": the main ingredients, what makes it appealing, and in the last sentence the link with the request; time or servings only if the page gives them; never claim it meets a restriction or a duration, say what the page announces; no web address in the text; 400 characters at most;',
        'temps_min = estimated total time in minutes (the page’s figure if it gives one); difficulte = "facile", "moyen" or "exigeant" (keep these French tokens); ingredients = number of ingredients on the page, not counting salt and pepper; omit any field you cannot establish.',
      ];
      eq(W.construireDemande({ q: 'saumon', filtres: [], langue: 'fr' }).system, LIGNES_FR.join('\n'), 'consigne : le system français est EXACTEMENT les huit lignes attendues (voix du serveur, interdiction d’affirmer, aucune adresse)');
      eq(W.construireDemande({ q: 'salmon', filtres: [], langue: 'en' }).system, LIGNES_EN.join('\n'), 'consigne : le system anglais est EXACTEMENT les huit lignes attendues (jetons de difficulté français gardés)');
    }
    eq([W.LIMITES_WEB.presentation, W.LIMITES_WEB.tempsMax, W.LIMITES_WEB.ingredientsMax, 'pourquoi' in W.LIMITES_WEB, W.DIFFICULTES], [400, 1440, 99, false, ['facile', 'moyen', 'exigeant']], 'limites : présentation 400, durée 1440, ingrédients 99, plus de « pourquoi » ; DIFFICULTES exportée');

    // 4.2 corpsRequete
    const corps = W.corpsRequete({ demande: d, fuseau: 'America/Toronto' });
    eq(corps.tools, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'CA', timezone: 'America/Toronto' } }], 'corps : outil web_search_20250305, 3 recherches, Canada, fuseau');
    eq([corps.max_tokens, corps.system, corps.messages, 'model' in corps], [4096, d.system, [{ role: 'user', content: d.user }], false], 'corps : max_tokens, system, un message user, JAMAIS de model (le serveur le choisit)');
    eq(['thinking', 'output_config', 'stream', 'allowed_callers'].filter((k) => k in corps || k in corps.tools[0]), [], 'corps : ni thinking, ni output_config, ni stream, ni allowed_callers');
    eq('timezone' in W.corpsRequete({ demande: d, fuseau: '' }).tools[0].user_location, false, 'corps : fuseau vide → timezone omis');

    // 4.3 lireReponse — fixture exacte (F17) : A = [a, b, c avec identifiants], B = [a doublon, ftp, d]
    const json = { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1, server_tool_use: { web_search_requests: 2 } }, content: [
      texte('Je cherche.'), { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'saumon fenouil recette' } },
      blocRes([res('https://a.test/r1', 'A', 'October 1, 2026'), res('https://b.test/r2', 'B'), res('https://u:p@c.test/r3', 'C'.repeat(100) + '\u{202E}' + 'C'.repeat(250), '')]),
      blocRes([res('https://a.test/r1', 'A bis'), res('ftp://x.test/r', 'X'), res('https://d.test/r4', 'D')]),
      texte('{"choix":[{"url":"https://c.test/r3","presentation":"Court."},{"url":"https://zz.test/pas-dans-les-resultats","presentation":"Inventé"},{"url":"https://a.test/r1","presentation":"' + 'p'.repeat(100) + '\u{200B}' + 'q'.repeat(400) + '"}]}'),
    ] };
    const lu = W.lireReponse(json);
    eq(lu.resultats.map((r) => r.href), ['https://a.test/r1', 'https://b.test/r2', 'https://c.test/r3', 'https://d.test/r4'], 'lecture : 4 résultats dans l’ordre, doublon et ftp écartés, identifiants retirés');
    eq([lu.resultats[0].titre, lu.resultats[0].date, lu.resultats[1].date, lu.resultats[2].date], ['A', 'October 1, 2026', null, null], 'lecture : titre et date typés ; page_age absent ou vide → null');
    // Confort après preuve (item 3) : dateLisible, PURE — lireReponse garde la date brute bornée (ci-dessus), l'écran la met
    // en forme ou la masque.
    {
      const dl = typeof W.dateLisible === 'function' ? W.dateLisible : () => 'absente';
      eq([dl('April 30, 2025', 'fr'), dl('April 30, 2025', 'en')], ['30 avril 2025', 'April 30, 2025'], 'dateLisible : une date lisible est mise en forme dans la langue demandée (fr-CA, en-CA) (confort, item 3)');
      eq([dl('654 days ago', 'fr'), dl('', 'fr'), dl(null, 'fr'), dl(42, 'fr')], [null, null, null, null], 'dateLisible : une date relative, vide ou qui n’est pas une chaîne → null (masquée) (confort, item 3)');
      // Ronde 1 : liste blanche (« rien d'inventé ») — « mois jour, année » et la date ISO seule, lue en UTC ; tout le reste → null.
      eq([dl('2025-04-30', 'fr'), dl('2025-04-30', 'en'), dl('Apr 30, 2025', 'fr')], ['30 avril 2025', 'April 30, 2025', '30 avril 2025'], 'dateLisible : une date ISO seule est rendue telle quelle (UTC), jamais la veille ; « Apr 30, 2025 » aussi (confort, ronde 1)');
      { const refusees = ['April 2025', '2025', '1', '12/04/2025', 'Feb 30, 2025', 'Thu, 01 May 2025 00:00:00 GMT', '2025-13-40', '2025-02-30'];
        eq(refusees.map((x) => dl(x, 'fr')), refusees.map(() => null), 'dateLisible : jour absent, année seule, nombre, date à barres, jour qui déborde, RFC 1123, ISO hors bornes ou qui déborde → null (rien d’inventé, ronde 1)'); }
      // Ronde 2 : sans Date.parse — liste FERMÉE des mois anglais (noms, abréviations de 3 lettres, « Sept »), casse libre,
      // point facultatif, année à 4 chiffres commençant par 1 ou 2 ; date construite en UTC, refusée si elle déborde.
      eq([dl('Sept. 5, 2025', 'fr'), dl('Sep 5, 2025', 'fr'), dl('Feb 29, 2024', 'fr'), dl('april 30, 2025', 'fr')], ['5 septembre 2025', '5 septembre 2025', '29 février 2024', '30 avril 2025'],
        'dateLisible : « Sept. », « Sep », le 29 février d’une année bissextile et la casse libre sont lus (confort, ronde 2)');
      { const refusees = ['Mayhem 5, 2025', 'April 30, 0025', 'Feb 29, 2025', 'Avril 30, 2025'];
        eq(refusees.map((x) => dl(x, 'fr')), refusees.map(() => null), 'dateLisible : un mot qui commence comme un mois, une année hors 1000-2999, un 29 février non bissextile ou un mois français → null (rien d’inventé, ronde 2)'); }
      // Ronde 3 (F1) : la borne d'année 1000-2999 est épinglée, et la même pour la date ISO seule.
      eq([dl('Dec 31, 2999', 'fr'), dl('2999-12-31', 'fr')], ['31 décembre 2999', '31 décembre 2999'], 'dateLisible : l’année 2999 est lue, en mois-jour-année comme en ISO (confort, ronde 3)');
      { const refusees = ['April 30, 0150', 'April 30, 3000', '0150-04-30', '3000-04-30'];
        eq(refusees.map((x) => dl(x, 'fr')), refusees.map(() => null), 'dateLisible : une année hors 1000-2999 → null, en mois-jour-année comme en ISO (confort, ronde 3)'); }
    }
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
      const deuxBlocs = W.lireReponse({ content: [blocRes([res('https://a.test/r1', 'A')]), texte('{"choix":[{"url":"ht'), texte('tps://a.test/r1","presentation":"ok"}]}')] });
      eq(W.choisirLiens(deuxBlocs).liens[0].presentation, 'ok', 'lecture : un JSON coupé par une citation sur deux blocs est lu (F7)');
    }

    {
      // V-F3 : deux pages du MÊME hôte sont deux pages (dédoublonnage par href exact, jamais par hôte)
      const lu2 = W.lireReponse({ content: [blocRes([res('https://a.test/1', 'Un'), res('https://a.test/2', 'Deux')]), texte('{"choix":[{"url":"https://a.test/2","presentation":"La deuxième."}]}')] });
      const c2 = W.choisirLiens(lu2);
      eq([lu2.resultats.map((r) => r.href), c2.liens.map((l) => l.href), c2.liens[0]?.presentation, c2.autres.map((l) => l.href)], [['https://a.test/1', 'https://a.test/2'], ['https://a.test/2'], 'La deuxième.', ['https://a.test/1']], 'lecture : deux pages du même hôte restent deux résultats, et la seconde peut être choisie (V-F3)');
    }
    // 4.4 choisirLiens
    const ch = W.choisirLiens(lu);
    eq(ch.liens.map((l) => l.href), ['https://c.test/r3', 'https://a.test/r1'], 'choix : seuls les choix survivants, dans l’ordre des choix ; l’adresse inventée est écartée (I-A) ; pas de complément (K2)');
    eq(ch.autres.map((l) => l.href), ['https://b.test/r2', 'https://d.test/r4'], 'choix : les autres pages trouvées, dans l’ordre du serveur, à part (K2)');
    eq([ch.liens[0].presentation, ch.liens[0].titre.length, ch.autres[0].presentation, ch.repli], ['Court.', 300, null, false], 'choix : présentation des choix, titre DU RÉSULTAT, présentation null pour les autres, pas de repli');
    eq(ch.liens[1].presentation, 'p'.repeat(100) + 'q'.repeat(299) + '…', 'choix : présentation de 500 dont le U+200B est AVANT la coupe : nettoyée puis bornée à 400 points de code, « … » compris (I-J)');
    // I-A : aucune adresse hors des résultats bruts — y compris une adresse inventée sur un hôte RÉEL du serveur
    ok(ch.liens.every((l) => lu.resultats.some((r) => r.href === l.href)) && ch.autres.every((l) => lu.resultats.some((r) => r.href === l.href)), 'choix : tout href rendu est un href des résultats bruts (I-A)');
    for (const inventee of ['https://a.test/r1#x', 'https://a.test/r1/', 'https://a.test/r1?x=1', 'https://a.test/recette-inventee']) {
      const c = W.choisirLiens({ ...lu, texte: JSON.stringify({ choix: [{ url: inventee, presentation: 'Inventé' }] }) });
      eq([c.repli, [...c.liens, ...c.autres].some((l) => l.href === inventee)], [true, false], `choix : ${inventee} (hôte réel, adresse absente des résultats) est écarté → repli (I-A)`);
    }
    {
      const c = W.choisirLiens({ ...lu, texte: '{"choix":[{"url":"https://u:p@A.TEST/r1","presentation":"ok"}]}' });
      eq([c.liens[0].href, c.repli], ['https://a.test/r1', false], 'choix : un choix avec user:pass@ et un hôte en majuscules est retrouvé, href sans identifiants (§ 9.2)');
    }
    eq(W.choisirLiens({ ...lu, texte: 'pas du json' }), { liens: lu.resultats.map((r) => ({ ...r, presentation: null, temps_min: null, difficulte: null, ingredients: null })), autres: [], repli: true }, 'choix : JSON illisible → repli, les résultats tels quels, rien dans autres');
    eq(W.choisirLiens({ ...lu, texte: '{"choix":[]}' }).repli, true, 'choix : choix vide → repli');
    eq(W.choisirLiens({ ...lu, texte: '{"choix":[null,3,{},{"url":5}]}' }).repli, true, 'choix : entrées hostiles ignorées sans lever (S13)');
    eq(W.choisirLiens({ ...lu, texte: '{x} puis {"choix":[{"url":"https://a.test/r1"}]}' }).repli, true, 'choix : une accolade parasite dans la prose rend le JSON illisible → repli (même avec une adresse valide dedans)');
    {
      const sept = { resultats: Array.from({ length: 7 }, (_, i) => ({ href: `https://s${i}.test/`, hote: `s${i}.test`, titre: `S${i}`, date: null })), texte: '{"choix":' + JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ url: `https://s${i}.test/`, presentation: 'p' }))) + '}' };
      eq([W.choisirLiens(sept).liens.length, W.choisirLiens(sept).autres.length], [5, 2], 'choix : cinq liens au plus, les deux autres à part (K2)');
      const r7 = W.choisirLiens({ ...sept, texte: 'pas du json' });
      eq([r7.liens.length, r7.autres.length, r7.repli], [5, 2, true], 'choix : repli avec sept résultats → cinq liens, deux autres, repli (§ 9.2)');
      eq(W.choisirLiens({ ...sept, texte: '{"choix":[{"url":"https://s1.test/"},{"url":"https://s1.test/"}]}' }).liens.filter((l) => l.href === 'https://s1.test/').length, 1, 'choix : un doublon de choix ne rend qu’un lien');
      eq(W.choisirLiens({ resultats: [{ href: 'https://s.test/', hote: 's.test', titre: '', date: null }], texte: '' }).liens[0].titre, 's.test', 'choix : titre vide → l’hôte');
    }
    // Présentation du serveur : lecture des champs d'un choix (Object.hasOwn, bornes, jetons) — une assertion par cas.
    {
      const R = { href: 'https://a.test/r1', hote: 'a.test', titre: 'A', date: null };
      const R2 = { href: 'https://b.test/r2', hote: 'b.test', titre: 'B', date: null };
      const NULS = { presentation: null, temps_min: null, difficulte: null, ingredients: null };
      const un = (champs) => W.choisirLiens({ resultats: [R], texte: JSON.stringify({ choix: [{ url: R.href, ...champs }] }) }).liens[0];
      const quatre = (l) => [l?.presentation, l?.temps_min, l?.difficulte, l?.ingredients];
      eq(quatre(un({ presentation: '  Un plat de saison.  ', temps_min: 15, difficulte: 'facile', ingredients: 7 })), ['Un plat de saison.', 15, 'facile', 7], 'choix : les quatre champs valides sont lus (présentation rognée)');
      eq(JSON.stringify(un({ presentation: 'P', temps_min: 9, difficulte: 'moyen', ingredients: 4 })), JSON.stringify({ ...R, presentation: 'P', temps_min: 9, difficulte: 'moyen', ingredients: 4 }), 'choix : un lien rendu porte href, hote, titre, date, presentation, temps_min, difficulte, ingredients (dans cet ordre)');
      eq(quatre(un({})), [null, null, null, null], 'choix : champs absents → quatre null');
      // présentation
      const longue = Array.from({ length: 130 }, (_, i) => `mot${i}`).join(' ');
      { const p = un({ presentation: longue }).presentation;
        eq([p.endsWith('…'), Array.from(p).length <= 400, p.slice(0, -1).endsWith(' '), longue.startsWith(p.slice(0, -1)), longue[p.length - 1]], [true, true, false, true, ' '], 'choix : une présentation longue est bornée AU MOT à 400 points de code, avec « … » (jamais en plein mot)'); }
      eq([42, null, {}, ['x'], true, '', '   ', '\u{200B}'].map((v) => un({ presentation: v }).presentation), [null, null, null, null, null, null, null, null], 'choix : présentation non-chaîne, vide, d’espaces ou faite de Cf → null');
      // I2 : une présentation qui porte une adresse web est ÉCARTÉE (null), le reste du choix survit
      eq(['Va sur https://evil.test/phish', 'Regarde www.evil.test', 'Voir evil.test/x', 'HTTPS://EVIL.TEST', 'ｗｗｗ.evil.test', 'Va sur htt\u{200B}ps://evil.test'].map((v) => un({ presentation: v, temps_min: 20 }).presentation), [null, null, null, null, null, null], 'choix : une présentation qui contient une adresse (https://, www., hôte/chemin, majuscules, pleine chasse, invisible dans le schéma) est écartée → null');
      // Ronde 2 : l'HÔTE NU (« la recette est sur evil.com ») est le cas principal — liste fermée de domaines de premier niveau
      eq(['La recette complète est sur evil.com, tu verras.', 'Inspirée de ricardocuisine.com avec des herbes.', 'Va voir EVIL.COM pour la suite.', 'Un classique de recettes.qc.ca : une salade fraîche.', 'Le raccourci bit.ly cache la page.'].map((v) => un({ presentation: v }).presentation), [null, null, null, null, null], 'choix : un hôte nu (evil.com, ricardocuisine.com, EVIL.COM, recettes.qc.ca, bit.ly) dans une présentation → écartée');
      { const gardees = ['Dorée en 15 min. Le fenouil caramélise doucement.', 'Dorée en 30 min.Le fenouil caramélise doucement.', 'Un saumon à l’aneth.Tu vas l’adorer.', 'Poêle le saumon.Coupe-le en deux pour servir.', 'Cuit env. 4 minutes de chaque côté.', 'Ajoute 2 c. à s. de miel avant de servir.', 'Compte 2.0 dl de crème pour la sauce.', 'Environ 3.5 kg de saumon pour la tablée.', 'Four à 180°C/350°F pour 20 minutes.', 'Assaisonne de sel/poivre au goût.'];
        eq(gardees.map((v) => un({ presentation: v }).presentation), gardees, 'choix : les points de ponctuation et d’unités ne sont pas des adresses (15 min. Le, 30 min.Le, aneth.Tu, saumon.Coupe-le, env. 4, 2 c. à s., 2.0, 3.5, 180°C/350°F, sel/poivre) → gardées'); }
      eq(un({ presentation: 'Le sel.Ca y est vraiment très bon.' }).presentation, null, 'choix : faux positif CONNU et assumé — « sel.Ca » (point collé et « ca » : domaine de la liste fermée) est écarté plutôt que risquer une adresse');
      // Ronde 2 : les points et barres d'autres écritures sont ramenés à « . » et « / » avant le test (le texte affiché n'est pas touché)
      eq(['Va sur evil\u{3002}com/x pour voir.', 'Va sur evil.com\u{2215}x pour voir.', 'Va sur evil\u{3002}test/x pour voir.', 'Va sur evil\u{FF61}test/x pour voir.', 'Va sur evil.test\u{2215}x pour voir.', 'Va sur evil.test\u{2044}x pour voir.'].map((v) => un({ presentation: v }).presentation), [null, null, null, null, null, null], 'choix : « 。 » (U+3002), « ｡ » (U+FF61), « ∕ » (U+2215) et « ⁄ » (U+2044) valent « . » et « / » pour le test d’adresse');
      eq(un({ presentation: 'Va sur https://evil.test/phish', temps_min: 20 }).temps_min, 20, 'choix : une présentation écartée pour adresse laisse les repères du choix');
      eq(['Une salade fraîche, prête en 15 min.', 'Servi avec du pain et/ou du riz.'].map((v) => un({ presentation: v }).presentation), ['Une salade fraîche, prête en 15 min.', 'Servi avec du pain et/ou du riz.'], 'choix : une présentation sans adresse est gardée (point final, « et/ou »)');
      // m5 : « choix » est lu PROPRE, pas par le prototype
      {
        let c;
        try { Object.prototype.choix = [{ url: R.href, presentation: 'HÉRITÉE', temps_min: 5 }]; c = W.choisirLiens({ resultats: [R], texte: '{"x":1}' }); } finally { delete Object.prototype.choix; }
        eq([c.repli, c.liens[0].presentation, c.liens[0].temps_min, Object.hasOwn(Object.prototype, 'choix')], [true, null, null, false], 'choix : « choix » hérité du prototype n’est jamais lu — aucun choix, repli');
      }
      // temps_min : entier de 1 à 1440
      eq([15, 1, 1440, '15', 0, -3, 1441, 100000, 1.5, null, true, [15]].map((v) => un({ temps_min: v }).temps_min), [15, 1, 1440, null, null, null, null, null, null, null, null, null], 'choix : temps_min entier de 1 à 1440 seulement (« 15 », 0, -3, 1441, 100000, 1.5, null → null)');
      // difficulte : jeton de DIFFICULTES, casse et espaces tolérés
      eq(['Facile ', 'MOYEN', 'exigeant', 'easy', 42, '', null, ['facile'], { toString: 1 }].map((v) => un({ difficulte: v }).difficulte), ['facile', 'moyen', 'exigeant', null, null, null, null, null, null], 'choix : difficulte ∈ facile / moyen / exigeant après trim et minuscules ; « easy », 42, vide, tableau et objet à toString hostile → null, sans lever');
      // ingredients : entier de 1 à 99
      eq([7, 1, 99, 0, 100, '7', 7.5, null].map((v) => un({ ingredients: v }).ingredients), [7, 1, 99, null, null, null, null, null], 'choix : ingredients entier de 1 à 99 seulement (0, 100, « 7 », 7.5, null → null)');
      // Object.hasOwn : jamais la chaîne de prototype
      {
        const cles = ['presentation', 'temps_min', 'difficulte', 'ingredients', 'url'];
        let heritee; let urlHeritee;
        try {
          Object.prototype.presentation = 'HÉRITÉE'; Object.prototype.temps_min = 5; Object.prototype.difficulte = 'moyen'; Object.prototype.ingredients = 3; Object.prototype.url = R.href;
          heritee = un({}); // le choix a une url PROPRE, mais aucun des quatre autres champs
          urlHeritee = W.choisirLiens({ resultats: [R], texte: '{"choix":[{}]}' }); // aucune url propre : la valeur héritée ne compte pas
        } finally { for (const k of cles) delete Object.prototype[k]; }
        eq([quatre(heritee), urlHeritee.repli, cles.map((k) => Object.hasOwn(Object.prototype, k))], [[null, null, null, null], true, [false, false, false, false, false]], 'choix : les champs (url comprise) sont lus par Object.hasOwn — une valeur héritée du prototype n’est jamais lue');
      }
      {
        const c = W.choisirLiens({ resultats: [R], texte: '{"choix":[{"url":"https://a.test/r1","__proto__":{"presentation":"PROTO","temps_min":5,"polluee":true}}]}' });
        eq([quatre(c.liens[0]), Object.hasOwn(Object.prototype, 'presentation'), ({}).presentation, ({}).polluee], [[null, null, null, null], false, undefined, undefined], 'choix : un objet {"__proto__": …} dans un choix ne pollue rien et ne donne aucun champ');
      }
      // I-A : un choix dont l'url n'est pas un résultat est ignoré, présentation et repères compris
      {
        const c = W.choisirLiens({ resultats: [R], texte: JSON.stringify({ choix: [{ url: 'https://zz.test/inconnue', presentation: 'INVENTÉE', temps_min: 10, difficulte: 'facile', ingredients: 3 }] }) });
        eq([JSON.stringify(c).includes('INVENTÉE'), c.repli, quatre(c.liens[0])], [false, true, [null, null, null, null]], 'choix : une url hors des résultats est ignorée avec sa présentation et ses repères (I-A) → repli, quatre null');
      }
      // repli et autres : les quatre champs à null
      eq(W.choisirLiens({ resultats: [R, R2], texte: 'pas du json' }), { liens: [{ ...R, ...NULS }, { ...R2, ...NULS }], autres: [], repli: true }, 'choix : repli → les résultats tels quels, quatre champs à null');
      eq(W.choisirLiens({ resultats: [R, R2], texte: JSON.stringify({ choix: [{ url: R.href, presentation: 'P', temps_min: 9, difficulte: 'moyen', ingredients: 4 }] }) }), { liens: [{ ...R, presentation: 'P', temps_min: 9, difficulte: 'moyen', ingredients: 4 }], autres: [{ ...R2, ...NULS }], repli: false }, 'choix : les pages « autres » portent les quatre champs à null');
    }
    const sw = await lire('../sw.js');
    ok(sw.includes("'./src/domain/recherche-web.js'"), 'SHELL : ./src/domain/recherche-web.js');
    ok(!/from '\.\.\/ui\//.test(await lire('../src/domain/recherche-web.js')), 'recherche-web.js : n’importe rien de src/ui/ (couche domaine)');
  }

  // --- § 4.5 chercherRecettesWeb : fetch factice, classement des issues, jamais le jeton dans l'issue
  {
    const W = await import('../src/domain/recherche-web.js');
    const { CHEMIN_ASSISTANT } = await import('../src/domain/passerelle.js');
    const { SUPABASE } = await import('../src/sync/config.js');
    const JETON = 'jeton-factice-0123';
    const SESSION = { access_token: JETON, user: { id: 'u1', email: 'a@exemple.invalid' } };
    const CONFIG = SUPABASE.prod; // explicite : la suite ne dépend pas du nom d'hôte de la page de tests
    const args = { q: 'saumon fenouil', filtres: ['Sans gluten'], langue: 'fr', session: SESSION };
    const res = (url, title) => ({ type: 'web_search_result', url, title, page_age: 'May 1, 2026', encrypted_content: 'x' });
    const blocRes = (liste) => ({ type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: liste });
    const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
    const nominal = { model: 'modele-test', stop_reason: 'end_turn', usage: { server_tool_use: { web_search_requests: 2 } }, content: [{ type: 'server_tool_use', id: 's', name: 'web_search', input: {} }, blocRes([res('https://a.test/1', 'A'), res('https://b.test/2', 'B')]), { type: 'text', text: '{"choix":[{"url":"https://b.test/2","presentation":"Fenouil."}]}' }] };
    const sansJeton = (issue) => { const s = JSON.stringify(issue); return !s.includes(JETON) && !s.includes('access_token') && !s.includes('CORPS-SENTINELLE'); };
    let appels = [];
    const fauxFetch = function (url, options) { appels.push({ url, options, self: this }); return Promise.resolve(fauxFetch.rendre(url, options)); };
    fauxFetch.rendre = () => reponse(200, nominal);
    // V-F2 : CHAQUE issue rendue par lancer() est contrôlée (ni le jeton, ni le corps d'erreur sentinelle) ; bilan en fin de bloc.
    const issuesVues = { n: 0, fautives: [] };
    const lancer = async (deps = {}, a = args) => { appels = []; const i = await W.chercherRecettesWeb(a, { fetch: fauxFetch, enLigne: () => true, fuseau: 'America/Toronto', config: CONFIG, ...deps }); issuesVues.n += 1; if (!sansJeton(i)) issuesVues.fautives.push(i); return i; };

    // Forme de l'appel
    const ok1 = await lancer();
    eq([ok1.etat, ok1.liens.map((l) => l.href), ok1.autres.map((l) => l.href), ok1.liens[0].presentation, ok1.recherches, ok1.modele, ok1.repli], ['trouve', ['https://b.test/2'], ['https://a.test/1'], 'Fenouil.', 2, 'modele-test', false], 'appel : cas nominal → trouve, le choix seul dans liens, l’autre page à part (K2), recherches, modèle PORTÉ PAR LA RÉPONSE (json.model)');
    eq(appels.length, 1, 'appel : un seul fetch');
    ok(appels[0].self === undefined, 'appel : fetch est appelé comme fonction libre, sans this (F11, V-F12 : comparaison stricte, pas par JSON)');
    eq(appels[0].url, 'https://ybdooerfeziiabsbfxtb.supabase.co/functions/v1/assistant', 'appel : la fonction assistant du projet, sans le jeton');
    ok(appels.every((a) => a.url.endsWith(CHEMIN_ASSISTANT) && new URL(a.url).host.endsWith('.supabase.co')), 'appel : toute requête va à …supabase.co/functions/v1/assistant, jamais ailleurs');
    ok(!appels[0].url.includes(JETON), 'appel : le jeton n’est pas dans l’adresse');
    eq([appels[0].options.method, appels[0].options.headers.authorization, appels[0].options.headers.apikey, 'x-api-key' in appels[0].options.headers, appels[0].options.credentials, appels[0].options.cache, appels[0].options.referrerPolicy, appels[0].options.mode, appels[0].options.redirect], ['POST', 'Bearer jeton-factice-0123', SUPABASE.prod.anonKey, false, 'omit', 'no-store', 'no-referrer', 'cors', 'error'], 'appel : POST, jeton en Bearer, clé PUBLIQUE en apikey, jamais x-api-key, options réseau du lot ISBN, et redirect error (le jeton ne suit jamais une redirection)');
    ok(appels[0].options.signal instanceof AbortSignal, 'appel : un signal d’abandon est posé');
    {
      const envoye = JSON.parse(appels[0].options.body);
      const corps = envoye.corps;
      eq([envoye.outil, Object.keys(envoye), 'model' in corps, corps.tools[0].type, corps.tools[0].max_uses, corps.tools[0].user_location], ['recherche-web', ['outil', 'corps'], false, 'web_search_20250305', 3, { type: 'approximate', country: 'CA', timezone: 'America/Toronto' }], 'appel : { outil: recherche-web, corps } où corps = corpsRequete, SANS model');
      ok(corps.messages[0].content.includes('saumon fenouil') && corps.messages[0].content.includes('Sans gluten'), 'appel : la demande et les textes des puces partent (I-J)');
    }
    // Gardes sans appel : plus de clé côté app, la session décide
    for (const [nom, s] of [['session absente', undefined], ['session nulle', null], ['sans jeton', { user: { id: 'u1' } }], ['jeton vide', { access_token: '' }], ['jeton à caractère invisible', { access_token: 'jeton\u{200B}x' }]]) {
      const i = await lancer({}, { ...args, session: s });
      eq([i.etat, i.raison, i.liens, appels.length], ['indisponible', 'non_connecte', [], 0], `garde : ${nom} → non_connecte, aucun appel`);
    }
    eq([(await W.chercherRecettesWeb(null)).raison, (await W.chercherRecettesWeb()).raison], ['non_connecte', 'non_connecte'], 'garde : arguments null ou absents → non_connecte, sans lever');
    eq([(await lancer({}, { ...args, q: '\u{200B}' })).raison, appels.length], ['requete', 0], 'garde : demande vide après nettoyage → indisponible/requete, aucun appel');
    eq([(await lancer({ enLigne: () => false })).raison, appels.length], ['hors_ligne', 0], 'garde : hors ligne → aucun appel');
    { const c = new AbortController(); c.abort(); eq([(await lancer({ signal: c.signal })).raison, appels.length], ['annule', 0], 'garde : signal déjà abandonné → annule, aucun appel'); }
    // Statuts HTTP (R-T3-4) : le champ `erreur` de la passerelle prime ; un 429 SANS champ erreur est celui d'Anthropic, relayé
    const anthropic = { type: 'error', error: { type: 'x', message: 'CORPS-SENTINELLE' } };
    const statut = async (s, corps = anthropic) => { fauxFetch.rendre = () => reponse(s, corps); const i = await lancer(); fauxFetch.rendre = () => reponse(200, nominal); return i; };
    eq([(await statut(401)).raison, (await statut(403)).raison, (await statut(401, { erreur: 'non_connecte' })).raison, (await statut(403, { erreur: 'non_admis' })).raison, (await statut(403, { erreur: 'origine' })).raison], ['non_connecte', 'serveur', 'non_connecte', 'non_admis', 'serveur'], 'statut : 401 → non_connecte ; un 403 RELAYÉ d’Anthropic (sans champ erreur) → serveur, pas « compte non admis » ; 403 { erreur: non_admis } → non_admis ; 403 { erreur: origine } → serveur (F-6 : une panne de configuration, pas un compte refusé ; plus de cle_refusee)');
    { const q = await statut(429, { erreur: 'quota', quota: 60 }); eq([q.etat, q.raison, q.quota, q.liens], ['indisponible', 'quota', 60, []], 'statut : 429 { erreur: quota, quota: 60 } → quota, avec quota: 60 dans l’issue'); }
    { const q = await statut(429, { erreur: 'quota' }); const q2 = await statut(429, { erreur: 'quota', quota: '60' }); eq([q.raison, 'quota' in q, q.quota, q2.raison, q2.quota], ['quota', true, null, 'quota', null], 'statut : 429 { erreur: quota } SANS nombre → quota quand même (la passerelle l’a écrit), quota: null dans l’issue — jamais « trop de demandes »'); }
    eq([(await statut(429)).raison, (await statut(429)).quota], ['trop_de_demandes', undefined], 'statut : 429 SANS champ erreur (Anthropic relayé) → trop_de_demandes, sans quota');
    eq([(await statut(400)).raison, (await statut(404)).raison, (await statut(422)).raison, (await statut(422, { erreur: 'bornes' })).raison], ['requete', 'requete', 'requete', 'requete'], 'statut : 400, 404, 422 → requete');
    { const i = await statut(413, { erreur: 'trop_lourd' }); eq([i.raison, i.trop_lourd, (await statut(400)).trop_lourd], ['requete', true, undefined], 'statut : 413 → requete, avec trop_lourd: true (« La demande est trop lourde. », texte de l’écran)'); }
    eq([(await statut(500)).raison, (await statut(502, { erreur: 'serveur' })).raison, (await statut(503)).raison, (await statut(529)).raison], ['serveur', 'serveur', 'serveur', 'serveur'], 'statut : 5xx (dont 502 et 503 de la passerelle) → serveur');
    eq((await statut(504, { erreur: 'delai' })).raison, 'delai', 'statut : 504 → delai');
    eq([(await statut(400, { error: { type: 'invalid_request_error', message: 'Web search is not enabled for this organization' } })).raison, (await statut(403, { error: { type: 'permission_error', message: 'Web search is not enabled for this organization' } })).raison], ['requete', 'serveur'], 'statut : « web search not enabled » n’est plus lu (le corps d’erreur d’Anthropic n’arrive jamais jusqu’au domaine) — plus de recherche_desactivee');
    ok(sansJeton(await statut(400)) && sansJeton(await statut(500)), 'statut : l’issue ne recopie ni le jeton ni le corps d’erreur (I-C)');
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
    const contenu = async (json) => { fauxFetch.rendre = () => reponse(200, json); const i = await lancer(); fauxFetch.rendre = () => reponse(200, nominal); return i; };
    // Le modèle de l'issue vient de la RÉPONSE : borné à 80 points de code, null sans chaîne
    eq([(await contenu({ ...nominal, model: undefined })).modele, (await contenu({ ...nominal, model: 42 })).modele, (await contenu({ ...nominal, model: 'm'.repeat(200) })).modele, (await contenu({ ...nominal, model: 'a\u{202E}b' })).modele], [null, null, 'm'.repeat(80), 'ab'], 'modèle : json.model borné à 80 points de code et nettoyé, sinon null (R-T3-3)');
    // Contenu de la réponse
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
      // Le filet extérieur : une exception levée AVANT l'appel (ici un `fuseau` qui lève à sa lecture) donne `interne` — jamais
      // `reseau` — sans fetch ; le journal ne porte ni le jeton ni le texte de l'erreur.
      const vus = []; const vraiErreur = console.error;
      console.error = (...a) => { vus.push(a); };
      appels = []; let i; try { i = await W.chercherRecettesWeb(args, { fetch: fauxFetch, enLigne: () => true, config: CONFIG, get fuseau() { throw new Error('fuseau piege'); } }); } finally { console.error = vraiErreur; }
      issuesVues.n += 1; if (!sansJeton(i)) issuesVues.fautives.push(i);
      eq([i.etat, i.raison, appels.length], ['indisponible', 'interne', 0], 'filet : une exception avant l’appel → interne, aucun fetch (jamais reseau)');
      const charge = vus[0]?.[1];
      eq([vus.length, Object.keys(charge ?? {}), charge?.reason], [1, ['reason', 'name'], 'interne'], 'filet : le journal ne porte que reason et name, reason = interne');
      ok(!JSON.stringify(vus).includes(JETON) && !JSON.stringify(vus).includes('piege'), 'filet : le journal ne contient ni le jeton ni le texte de l’erreur (S10/F12)');
    }
    eq([issuesVues.n, issuesVues.fautives.length], [58, 0], 'I-C : CHACUNE des issues rendues dans ce bloc (toutes comptées) est sans jeton ni corps d’erreur (V-F2)');
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
      // La session vient de ctx.sync.auth.jeton() (R-T3-1) : sans session, ni clé locale ni réglage ne donnent un assistant.
      const ctxDe = (session, llm = { provider: 'none' }) => ({ docs: [], docsByRecipe: new Map(), ingredientsById: ING, meal_feedback: [], settings: { llm }, sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } } });
      const JETON_ECRAN = 'jeton-ecran-sentinelle'; // V-F2 : il doit atteindre chercher(), jamais l'état ni l'écran
      const SESSION_ECRAN = { access_token: JETON_ECRAN, user: { id: 'u1', email: 'a@exemple.invalid' } };
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
      const issueTrouve = { etat: 'trouve', raison: null, liens: [{ href: 'https://a.test/r', hote: 'a.test', titre: 'A', date: null, presentation: null, temps_min: null, difficulte: null, ingredients: null }], repli: false, recherches: 1, modele: 'm' };

      // Garde (R-T4-4) : une seule source de vérité — la SESSION (R-T3-1). Sans session : « Connecte-toi… » + « Se connecter », rien d'autre — aucun
      // appel, plus de lien Réglages (il n'y a plus rien à configurer), quel que soit le réglage local hérité.
      const { SYNC_ROUTE_KEY } = await import('../src/ui/state.js');
      S.reinitialiserWeb();
      for (const [nom, session, llm] of [['sans session', null, { provider: 'none' }], ['sans session, une clé locale ne sert plus', null, { provider: 'anthropic', api_key: 'cle-locale', model: 'm' }], ['jeton vide', { access_token: '' }, { provider: 'none' }], ['openai sans session', null, { provider: 'openai_compatible', api_key: 'k', model: 'm' }]]) {
        let appels = 0;
        const root = await monter({ q: 'saumon' }, ctxDe(session, llm), { chercher: async () => { appels += 1; return issueTrouve; } });
        eq(root.querySelector('.status.warn > span')?.textContent, 'Connecte-toi pour utiliser l’assistant.', `garde : ${nom} → « Connecte-toi pour utiliser l’assistant. »`);
        eq([!!bouton(root, 'Se connecter'), !!root.querySelector('a[href="#/settings"]'), appels, !!bouton(root, 'Chercher sur le web avec l’assistant'), texte(root).includes('configure l’assistant IA')], [true, false, 0, false, false], `garde : ${nom} → « Se connecter », ni lien Réglages ni bouton de recherche, aucun appel`);
        // Garde retirée : le bouton de recherche existerait et un clic enverrait la demande — ni le domaine injecté ni le réseau ne doivent rien voir
        const reseauAvant = appelsReseau;
        bouton(root, 'Chercher sur le web avec l’assistant')?.click(); await tick();
        eq([appels, appelsReseau - reseauAvant], [0, 0], `garde : ${nom} → aucun appel du domaine ni du réseau, même en cherchant un bouton à cliquer`);
        root.remove();
      }
      {
        // « Se connecter » : le geste de la section Compte — auth.signIn() du contexte
        const signIns = [];
        const ctx = { ...ctxDe(null), sync: { user: null, auth: { jeton: async () => null, signIn: async () => { signIns.push(1); return { error: null }; } } } };
        const root = await monter({ q: 'saumon' }, ctx, { chercher: async () => { throw new Error('aucun appel attendu'); } });
        try { bouton(root, 'Se connecter').click(); await tick(); await tick(); } finally { try { sessionStorage.removeItem(SYNC_ROUTE_KEY); } catch { /* stockage indisponible */ } }
        eq(signIns.length, 1, 'garde : « Se connecter » appelle auth.signIn() du contexte (le chemin de la section Compte)');
        root.remove();
      }
      {
        // F-7 (M4) : la garde de compte a REFUSÉ l'adresse sur cet appareil — « Se connecter » renverrait au même refus (boucle OAuth) :
        // la carte dit le message de la garde, sans bouton, et rien n'est appelé
        const MESSAGE_GARDE = 'Cet appareil a été synchronisé avec b@exemple.invalid.';
        const signIns = [];
        const ctx = { ...ctxDe(null), sync: { user: null, guard: { ok: false, message: MESSAGE_GARDE }, auth: { jeton: async () => null, signIn: async () => { signIns.push(1); return { error: null }; } } } };
        const root = await monter({ q: 'saumon' }, ctx, { chercher: async () => { throw new Error('aucun appel attendu'); } });
        const carte = root.querySelector('[data-role="connexion-ia"]');
        eq([!!carte, carte?.textContent.includes(MESSAGE_GARDE), carte?.textContent.includes('Connecte-toi'), !!bouton(root, 'Se connecter'), signIns.length], [true, true, false, false, 0], 'F-7 garde de compte refusée : le message de la garde, ni « Connecte-toi » ni « Se connecter » (pas de boucle OAuth)');
        root.remove();
      }
      {
        // Avec une session, AUCUN réglage local n'est nécessaire : l'écran du bouton s'affiche (la clé n'existe plus côté app)
        const root = await monter({ q: 'saumon' }, ctxDe(SESSION_ECRAN, { provider: 'none' }), { chercher: async () => issueTrouve });
        eq([!!bouton(root, 'Chercher sur le web avec l’assistant'), texte(root).includes('Connecte-toi'), !!bouton(root, 'Se connecter')], [true, false, false], 'garde : une session suffit — le bouton « Chercher sur le web » est là, sans « Connecte-toi » ni réglage local');
        root.remove();
      }
      {
        // R-T4-10 : basculer vers « Web » dans la MÊME instance (run() → render(), sans ré-instanciation) relit la session AVANT de rendre —
        // une personne connectée ne voit jamais « Connecte-toi » en flash.
        S.reinitialiserWeb();
        let lectures = 0; const pj = pilote();
        const ctxCompte = { ...ctxDe(SESSION_ECRAN), sync: { user: { id: 'u1' }, auth: { jeton: () => { lectures += 1; return pj.promesse; } } } };
        const root = await S.renderSearch({}, { mode: 'recipes', q: 'saumon' }, ctxCompte, { remplacerAdresse: () => {}, navigate: () => {} });
        scene.append(root);
        const avant = lectures;
        [...root.querySelectorAll('.segmented button')].find((b) => b.textContent === 'Web').click();
        await tick();
        eq([avant, lectures, texte(root).includes('Connecte-toi'), !!bouton(root, 'Chercher sur le web avec l’assistant')], [0, 1, false, false], 'bascule vers Web : la session est lue UNE fois, et tant qu’elle n’est pas là l’écran ne montre pas « Connecte-toi » (pas de flash)');
        pj.resoudre(SESSION_ECRAN);
        await tick(); await tick();
        eq([lectures, texte(root).includes('Connecte-toi'), !!bouton(root, 'Chercher sur le web avec l’assistant')], [1, false, true], 'bascule vers Web : la session lue, l’écran porte l’état connecté (le bouton de recherche), toujours une seule lecture');
        root.remove();
        // …et sans compte : l'écran dit « Connecte-toi » tout de suite, jeton() n'est jamais appelé (garde de compte)
        let lectures2 = 0;
        const ctxSans = { ...ctxDe(null), sync: { user: null, auth: { jeton: async () => { lectures2 += 1; return SESSION_ECRAN; } } } };
        const root2 = await S.renderSearch({}, { mode: 'recipes', q: 'saumon' }, ctxSans, { remplacerAdresse: () => {}, navigate: () => {} });
        scene.append(root2);
        [...root2.querySelectorAll('.segmented button')].find((b) => b.textContent === 'Web').click();
        await tick(); await tick();
        eq([lectures2, texte(root2).includes('Connecte-toi pour utiliser l’assistant.'), !!bouton(root2, 'Se connecter')], [0, true, true], 'bascule vers Web sans compte : « Connecte-toi… » et « Se connecter », jeton() jamais appelé');
        root2.remove();
        S.reinitialiserWeb();
      }
      {
        // La session n'est attendue qu'en mode web : un jeton() lent (rafraîchissement réseau) ne retarde pas les autres modes de recherche
        let lectures = 0;
        const ctxCompte = { ...ctxDe(SESSION_ECRAN), sync: { user: { id: 'u1' }, auth: { jeton: async () => { lectures += 1; return SESSION_ECRAN; } } } };
        S.reinitialiserWeb();
        const autre = await S.renderSearch({}, { mode: 'recipes', q: 'saumon' }, ctxCompte, { remplacerAdresse: () => {}, navigate: () => {} });
        const apresAutre = lectures;
        const web = await monter({ q: 'saumon' }, ctxCompte, { chercher: async () => issueTrouve });
        eq([apresAutre, lectures, !!bouton(web, 'Chercher sur le web avec l’assistant')], [0, 1, true], 'session : lue en mode web seulement (0 lecture pour le mode recipes, 1 pour le mode web)');
        autre.remove(); web.remove();
      }
      // Écran du bouton (§ 5.3) et frappe sans Entrée (Review Focus 1)
      {
        let appels = []; const p = pilote();
        const root = await monter({}, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return p.promesse; }, navigate: () => {} });
        const b = bouton(root, 'Chercher sur le web avec l’assistant');
        eq([b.disabled, texte(root).includes('Écris d’abord ce que tu cherches.'), texte(root).includes('Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.'), appels.length], [true, true, true, 0], 'bouton : champ vide → éteint, deux lignes (UI-2 : « 2 appels … résultats, puis photos »), aucun appel au rendu (I-B)');
        ok(!texte(root).includes('Anthropic'), 'bouton : aucun texte de l’écran ne nomme Anthropic (l’appel passe par l’assistant et son quota du jour)');
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
        eq([appels[0].a.q, appels[0].a.filtres, appels[0].a.langue, appels[0].a.session, 'cfg' in appels[0].a], ['saumon fenouil sans gluten', ['Sans gluten', 'avec fenouil', 'avec saumon'], 'fr', SESSION_ECRAN, false], 'tape : la demande est le CHAMP relu (q), les puces comprises en TEXTE (« Sans gluten », les ingrédients par leur libellé), la langue, la SESSION relue au moment de l’appel, jamais de cfg (I-J)');
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
        const ctx = ctxDe(SESSION_ECRAN);
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
        const root = await monter({ q: 'saumon sans gluten' }, ctxDe(SESSION_ECRAN), { chercher, navigate: () => {} });
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
        const root = await monter({ q: 'saumon' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
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
        const root = await monter({ q: '' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
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
        const root = await monter({ q: 'soupe sans gluten en 20 minutes' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
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
        const root = await monter({ q: 'salade sans xyzzy en 20 minutes' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
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
        const root = await monter({ q: 'sans fenouil' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
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
        const root = await monter({ q: '10 min actives' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
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
        const root = await monter({ q: '' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
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
        const root = await monter({ q: 'soupe saumon sans lactose' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
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
          let root = await monter({ q: 'soupe sans gluten en 20 minutes' }, ctxDe(SESSION_ECRAN), deps);
          taper(root, 'saumon fenouil');
          if (avecEntree) {
            champ(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            root.remove();
            root = await monter(parseHash('#' + navs[navs.length - 1]).query, ctxDe(SESSION_ECRAN), deps); // la ré-instanciation de production
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
        const ctx = ctxDe(SESSION_ECRAN);
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
        eq([appels[0]?.a.session?.access_token === JETON_ECRAN, JSON.stringify(S.etatWeb()).includes(JETON_ECRAN), texte(vue).includes(JETON_ECRAN), document.body.textContent.includes(JETON_ECRAN)], [true, false, false, false], 'I-C écran : le jeton atteint chercher(), jamais etatWeb() ni le texte rendu après un trouvé (V-F2)');
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
          const root = await S.renderSearch({}, { mode: 'web', q: 'saumon' }, ctxDe(SESSION_ECRAN), { chercher: async () => p.promesse, navigate: () => { navs += 1; } });
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
          const root = await monter({ q: 'saumon' }, ctxDe(SESSION_ECRAN), { chercher: async () => { appels += 1; return issueTrouve; }, navigate: (p, o) => { navs.push([p, o]); } });
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
        const root = await monter({ q: 'saumon\u{200B} fenouil' }, ctxDe(SESSION_ECRAN), { chercher: async (a, d) => { appels.push({ a, d }); return issueTrouve; }, navigate: () => {} });
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await tick();
        eq(appels.map((x) => x.a.q), ['saumon fenouil'], 'R-WEB-1 : la demande envoyée est q NETTOYÉ (le U+200B retiré), pas la saisie brute');
        root.remove();
      }
      // Filet (§ 5.4.5, F12)
      {
        S.reinitialiserWeb();
        const root = await monter({ q: 'saumon' }, ctxDe(SESSION_ECRAN), { chercher: async () => { throw new TypeError('bogue'); }, navigate: () => {} });
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
      const ctxDe = (session) => ({ docs: [], docsByRecipe: new Map(), ingredientsById: ING, meal_feedback: [], settings: { llm: { provider: 'none' } }, sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } } });
      const JETON_ECRAN = 'jeton-ecran-sentinelle'; // V-F2 : il doit atteindre chercher(), jamais l'état ni l'écran
      const SESSION_ECRAN = { access_token: JETON_ECRAN, user: { id: 'u1', email: 'a@exemple.invalid' } };
      // remplacerAdresse factice par défaut : la tape (lancer) met l'adresse à jour par history.replaceState, pas celle de la page de tests.
      const monter = async (query, ctx, deps) => { const root = await S.renderSearch({}, { mode: 'web', ...query }, ctx, { remplacerAdresse: () => {}, ...deps }); scene.append(root); return root; };
      const texte = (root) => root.textContent;
      const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
      const titres = (r) => r?.querySelectorAll('a.btn:not(.small)[target="_blank"]'); // les liens-titres des cartes (« Voir la recette » est un a.btn.small)
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const puces = (root) => [...root.querySelectorAll('.chip')].map((c) => c.textContent); // les puces AFFICHÉES
      const enVol = (root) => !!root.querySelector('[role="status"]') && texte(root).includes('L’assistant cherche sur le web…'); // « rien » a aussi un role=status
      // Tape, laisse lancer() appeler chercher (qui pose appels.rendre), résout l'issue, laisse la mémoire et le redessin se poser.
      const tapeEtAttend = async (root, issue) => { bouton(root, 'Chercher sur le web avec l’assistant').click(); await tick(); appels.rendre(issue); await tick(); };
      const liens = [{ href: 'https://a.test/r?x=1', hote: 'a.test', titre: '<b>Saumon</b> au fenouil', date: 'May 1, 2026', presentation: 'Fenouil et saumon.', temps_min: 15, difficulte: 'facile', ingredients: 7 }, { href: 'https://b.test/', hote: 'b.test', titre: 'b.test', date: null, presentation: null, temps_min: null, difficulte: null, ingredients: null }, { href: 'https://u:p@a.test/x', hote: 'a.test', titre: '', date: null, presentation: null, temps_min: null, difficulte: null, ingredients: null }];
      const trouve = { etat: 'trouve', raison: null, liens, autres: [], repli: false, recherches: 2, modele: 'm' };
      const appels = { n: 0, deps: [], args: [], rendre: null };
      const chercher = async (a, d) => { appels.n += 1; appels.deps.push(d); appels.args.push(a); return new Promise((r) => { appels.rendre = r; }); };
      const navs = [];
      const ctx = ctxDe(SESSION_ECRAN);

      // trouve
      S.reinitialiserWeb();
      let root = await monter({ q: 'saumon fenouil' }, ctx, { chercher, navigate: (p) => navs.push(p) });
      await tapeEtAttend(root, trouve);
      const a = titres(root);
      eq([...a].map((n) => [n.getAttribute('href'), n.getAttribute('target'), n.getAttribute('rel'), n.textContent]), [['https://a.test/r?x=1', '_blank', 'noopener noreferrer', '<b>Saumon</b> au fenouil'], ['https://b.test/', '_blank', 'noopener noreferrer', 'b.test'], ['https://a.test/x', '_blank', 'noopener noreferrer', 'a.test']], 'trouve : un lien par résultat, href exact (identifiants retirés AU RENDU), target _blank, rel noopener noreferrer, titre en TEXTE littéral, titre vide → hôte (I-H, Review Focus 3)');
      eq(root.querySelectorAll('b').length, 0, 'trouve : aucun élément créé par un titre hostile');
      ok(texte(root).includes('a.test · 1 mai 2026') && texte(root).includes('Fenouil et saumon.') && texte(root).includes('Estimé par l’assistant : ≈ 15 min · facile · 7 ingrédients'), 'trouve : hôte, date mise en forme (confort, item 3), présentation et ligne de repères (« Estimé par l’assistant : … »)');
      eq([...root.querySelectorAll('a.btn.small[target="_blank"][rel="noopener noreferrer"]')].map((n) => [n.getAttribute('href'), n.textContent]), [['https://a.test/r?x=1', 'Voir la recette'], ['https://b.test/', 'Voir la recette'], ['https://a.test/x', 'Voir la recette']], 'trouve : un « Voir la recette » par carte, même adresse que le titre (identifiants retirés AU RENDU)');
      ok(texte(root).includes('Trouvé sur le web') && texte(root).includes('Demande envoyée : saumon fenouil'), 'trouve : titre de section et demande envoyée (I-J)');
      eq([appels.args[0]?.session?.access_token === JETON_ECRAN, JSON.stringify(S.etatWeb()).includes(JETON_ECRAN), texte(root).includes(JETON_ECRAN)], [true, false, false], 'I-C écran : après un trouvé, le jeton n’est ni dans etatWeb() ni dans le texte rendu — il a bien atteint chercher() (V-F2)');
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
      ok(texte(root).includes('L’assistant présente les plats et estime le temps d’après les pages : il ne vérifie ni le temps, ni les ingrédients, ni les restrictions. Relis la page avant de cuisiner.'), 'trouve : l’avertissement fixe (reformulé : il estime le temps) est TOUJOURS là (I-K, S1)');
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
        eq([enCours, S.etatWeb().memoire?.etat, S.etatWeb().enCours, titres(root).length, texte(root).includes('Trouvé sur le web')], [[true, true, n + 1], 'trouve', false, 3, true], 'annuler : depuis un trouvé, « Chercher à nouveau » puis « Annuler » → la mémoire reste « trouve » et ses liens sont remontrés (V-F7)');
        appels.rendre({ etat: 'indisponible', raison: 'annule', liens: [], autres: [], repli: false, recherches: null, modele: 'm' }); await tick(); // le vol annulé finit, muet
      }
      // Mémoire par clé (F13/S5/F20) : une nouvelle instance avec la même demande montre les liens SANS appel
      root.remove();
      const nAvant = appels.n;
      root = await monter({ q: 'saumon fenouil' }, ctx, { chercher, navigate: () => {} });
      eq([appels.n, titres(root).length], [nAvant, 3], 'mémoire : même demande, nouvelle instance → les liens, aucun appel (F3/F20)');
      // Puce ajoutée → clé différente → les liens RESTENT, la différence est dite (K1) ; puce retirée → la mention disparaît (Review Focus 2)
      const selects = root.querySelectorAll('select');
      const restriction = [...selects].find((s) => [...s.options].some((o) => o.textContent === '+ restriction'));
      restriction.value = 'sans_gluten'; restriction.dispatchEvent(new Event('change'));
      eq([titres(root).length, texte(root).includes('La demande a changé depuis cette recherche.'), appels.n], [3, true, nAvant], 'puce : ajoutée → les liens RESTENT, la mention « la demande a changé » apparaît, aucun appel (K1)');
      [...root.querySelectorAll('.chip.removable')].find((c) => c.textContent === 'Sans gluten').click();
      eq([titres(root).length, texte(root).includes('La demande a changé depuis cette recherche.'), appels.n], [3, false, nAvant], 'puce : retirée → la mention disparaît, aucun appel');
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
        // Ronde 3 (F3) : bouton() prend désormais celui du HAUT dans l'état K1 — le bouton du BAS y relance lui aussi.
        [...root.querySelectorAll('.chip.removable')].find((c) => c.textContent === 'Sans gluten').click();
        {
          const r = relances(); const bas = r[r.length - 1]; const etat = [r.length, bas?.parentElement?.tagName];
          const n2 = appels.n; const affichees2 = puces(root);
          bas?.click(); await tick();
          const d2 = appels.args[appels.args.length - 1];
          eq([etat, appels.n, d2?.q, d2?.filtres, enVol(root)], [[2, 'SECTION'], n2 + 1, 'saumon fenouil', affichees2, true], 'K1 : le « Chercher à nouveau » du BAS lance aussi la tape : un appel, avec les puces affichées (confort, ronde 3)');
          appels.rendre(trouve); await tick();
        }
        // Ronde 3 (M1) : champ vidé puis Entrée → la demande n'a plus de clé (construireDemande). La mention K1 reste, mais pas
        // de relance en haut : elle ne ferait rien. Le bouton du bas (préexistant) ne change pas. La frappe seule ne redessine
        // pas l'écran (l'écouteur `input` ne fait qu'ouvrir ou fermer le bouton de l'écran sans issue) : c'est Entrée qui le fait.
        {
          const champ = root.querySelector('input[type="search"]');
          const n3 = appels.n;
          champ.value = ''; champ.dispatchEvent(new Event('input')); await tick();
          champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await tick();
          const r = relances();
          eq([texte(root).includes('La demande a changé depuis cette recherche.'), r.length, r[0]?.parentElement?.tagName, appels.n], [true, 1, 'SECTION', n3], 'K1 avec une demande vide : la mention reste, UN seul « Chercher à nouveau » (celui du bas), aucun appel (confort, ronde 3)');
          champ.value = 'saumon fenouil'; champ.dispatchEvent(new Event('input'));
          champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await tick();
        }
      }
      // R-WEB-3 : un « trouvé » dont aucune adresse ne survit à la revalidation au rendu replie sur l'écran « rien »
      root.remove(); S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { ...trouve, liens: [{ ...liens[0], href: 'javascript:alert(1)' }] });
      ok(!texte(root).includes('Trouvé sur le web') && texte(root).includes('Aucune page trouvée pour cette demande.'), 'trouve sans carte : pas de titre vide, écran « rien » (R-WEB-3)');
      // K2 : les autres pages trouvées, repliées, jamais mêlées aux choix
      root.remove(); S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { ...trouve, autres: [{ href: 'https://c.test/x', hote: 'c.test', titre: 'C', date: null, presentation: null, temps_min: null, difficulte: null, ingredients: null }] });
      { const d = root.querySelector('details'); eq([d?.querySelector('summary')?.textContent, d?.open, titres(d)?.length, titres(root).length], ['Autres pages trouvées (1)', false, 1, 4], 'autres : repliées sous « Autres pages trouvées (1) », avec leur lien (K2)'); }
      // Confort après preuve (item 3) : la date d'une page n'est montrée que lisible, dans la langue de l'interface ;
      // une date relative (« 654 days ago ») est masquée — la ligne vaut exactement l'hôte, sans « · ».
      root.remove(); S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { ...trouve, liens: [liens[0], { ...liens[1], date: '654 days ago' }] });
      {
        const lignesDate = (r) => [...titres(r)].map((a) => a.parentElement.querySelector('.muted')?.textContent);
        eq(lignesDate(root), ['a.test · 1 mai 2026', 'b.test'], 'date de page : « May 1, 2026 » → « 1 mai 2026 » ; « 654 days ago » masquée, la ligne vaut l’hôte seul (confort, item 3)');
        setUiLocale('en');
        const enAnglais = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} }); // même issue en mémoire (K1), aucun appel
        eq(lignesDate(enAnglais), ['a.test · May 1, 2026', 'b.test'], 'date de page : interface anglaise → « May 1, 2026 » (la langue vient de getUiLocale)');
        setUiLocale('fr'); enAnglais.remove();
      }
      // Présentation du serveur : la carte porte, dans l'ordre, le titre, l'hôte (et la date), la présentation en TEXTE, la ligne de
      // repères, puis la rangée « Voir la recette » + « Garder ce lien ». Les repères sont joints par « · », dans l'ordre temps,
      // difficulté, ingrédients ; une partie absente disparaît, et sans aucune partie la ligne n'existe pas.
      {
        const NUL = { presentation: null, temps_min: null, difficulte: null, ingredients: null };
        const lienR = (champs, i = 0) => ({ href: `https://r${i}.test/r`, hote: `r${i}.test`, titre: `Plat ${i}`, date: null, ...NUL, ...champs });
        const rendre = async (liensR) => { S.reinitialiserWeb(); const r = await monter({ q: 'saumon' }, ctx, { chercher, navigate: (p) => navs.push(p) }); await tapeEtAttend(r, { ...trouve, liens: liensR }); return r; };
        const cartes = (r) => [...titres(r)].map((n) => n.parentElement);
        // UI-2 (§ 4.6, P-UI2-23) : la figure d'aperçu (figure.apercu, en tête de carte quand l'image est là) n'existe qu'avec deps.apercus ; ces tests ne l'injectent
        // pas → aucune figure, et `forme` reste STRICTE : une figure parasite rougirait chaque forme ci-dessous (les aperçus se testent dans tests/apercu-web.js).
        const forme = (carte) => [...carte.children].map((n) => n.tagName + (n.className ? '.' + String(n.className).split(' ').join('.') : ''));
        const reperes = (carte) => [...carte.querySelectorAll('div.muted')].slice(1).map((n) => n.textContent); // div.muted n° 1 = hôte · date
        const P = 'Estimé par l’assistant : ';
        const E = (...parties) => parties.map((x) => [P + x]); // la ligne de repères dit toujours de qui vient l'estimation (I1)
        const MENTION = 'L’assistant présente les plats et estime le temps d’après les pages : il ne vérifie ni le temps, ni les ingrédients, ni les restrictions. Relis la page avant de cuisiner.';
        const ANCIENNE = 'L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.';
        let r1 = await rendre([lienR({ presentation: 'Un saumon rôti, fenouil fondant.', temps_min: 15, difficulte: 'facile', ingredients: 7 })]);
        eq(r1.querySelectorAll('figure.apercu').length, 0, 'UI-2 : sans deps.apercus, aucune figure d’aperçu dans les cartes (0 appel) — la carte garde sa forme ; les aperçus se testent dans tests/apercu-web.js');
        { const c = cartes(r1)[0];
          eq([forme(c), c.children[2].textContent, c.children[3].textContent, c.children[3].style.fontSize], [['A.btn', 'DIV.muted', 'DIV', 'DIV.muted', 'DIV.row', 'DIV.row'], 'Un saumon rôti, fenouil fondant.', 'Estimé par l’assistant : ≈ 15 min · facile · 7 ingrédients', '0.9rem'], 'présentation : la carte = titre, hôte, présentation, ligne de repères (« Estimé par l’assistant : ≈ 15 min · facile · 7 ingrédients », .9rem), rangée de boutons, puis (lot B) la rangée « Garder et lire » — dans cet ordre');
          const rangee = [...c.children[4].children];
          eq([rangee.map((n) => n.tagName + '.' + n.className), rangee.map((n) => n.textContent)], [['A.btn small', 'BUTTON.btn small'], ['Voir la recette', 'Garder ce lien']], 'présentation : la rangée = « Voir la recette » (lien) puis « Garder ce lien » (bouton), tous deux .btn.small');
          eq([rangee[0].getAttribute('href'), rangee[0].getAttribute('target'), rangee[0].getAttribute('rel'), titres(r1)[0].getAttribute('href')], ['https://r0.test/r', '_blank', 'noopener noreferrer', 'https://r0.test/r'], '« Voir la recette » : a avec href = l’adresse du titre, target _blank, rel noopener noreferrer');
          const avant = navs.filter((p) => p.startsWith('/add/signet')).length;
          rangee[1].click();
          const apres = navs.filter((p) => p.startsWith('/add/signet'));
          eq([apres.length - avant, new URLSearchParams(apres[apres.length - 1].split('?')[1]).get('adresse')], [1, 'https://r0.test/r'], 'présentation : « Garder ce lien » navigue toujours vers /add/signet avec l’adresse'); }
        ok(texte(r1).includes(MENTION) && !texte(r1).includes(ANCIENNE), 'présentation : sur un « trouvé » trié par l’assistant, la mention I-K qui dit qu’il estime le temps est rendue, l’ancienne ne l’est pas');
        r1.remove();
        // le temps : < 60 → minutes ; sinon heures et minutes
        r1 = await rendre([15, 59, 60, 61, 90, 125, 1440].map((n, i) => lienR({ temps_min: n }, i)));
        eq(cartes(r1).map(reperes), E('≈ 15 min', '≈ 59 min', '≈ 1 h', '≈ 1 h 01', '≈ 1 h 30', '≈ 2 h 05', '≈ 24 h'), 'repères : 15 → « ≈ 15 min », 60 → « ≈ 1 h », 90 → « ≈ 1 h 30 », 125 → « ≈ 2 h 05 » (minutes sur deux chiffres), 1440 → « ≈ 24 h »');
        r1.remove();
        // un seul repère : aucun « · » ; deux : les parties présentes seulement, dans l'ordre
        r1 = await rendre([{ difficulte: 'facile' }, { difficulte: 'moyen' }, { difficulte: 'exigeant' }, { ingredients: 1 }, { ingredients: 7 }, { temps_min: 15, ingredients: 7 }, { difficulte: 'moyen', ingredients: 3 }, { temps_min: 30, difficulte: 'exigeant' }].map((c, i) => lienR(c, i)));
        eq(cartes(r1).map(reperes), E('facile', 'moyen', 'exigeant', '1 ingrédient', '7 ingrédients', '≈ 15 min · 7 ingrédients', 'moyen · 3 ingrédients', '≈ 30 min · exigeant'), 'repères : un seul repère sans « · » ; « 1 ingrédient » au singulier ; une partie absente disparaît sans trou');
        r1.remove();
        // présence de la présentation et de la ligne : les quatre formes de carte
        r1 = await rendre([lienR({}, 0), lienR({ presentation: 'Seule.' }, 1), lienR({ temps_min: 20 }, 2), lienR({ presentation: 42, temps_min: '15', difficulte: 'impossible', ingredients: 0 }, 3), lienR({ temps_min: 20, difficulte: 'impossible' }, 4)]);
        eq([cartes(r1).map(forme), reperes(cartes(r1)[4])], [[['A.btn', 'DIV.muted', 'DIV.row', 'DIV.row'], ['A.btn', 'DIV.muted', 'DIV', 'DIV.row', 'DIV.row'], ['A.btn', 'DIV.muted', 'DIV.muted', 'DIV.row', 'DIV.row'], ['A.btn', 'DIV.muted', 'DIV.row', 'DIV.row'], ['A.btn', 'DIV.muted', 'DIV.muted', 'DIV.row', 'DIV.row']], [P + '≈ 20 min']], 'carte : sans présentation ni repère → ni l’un ni l’autre ; la ligne de repères n’existe que s’il y a un repère ; des valeurs illisibles à l’écran (« 15 », « impossible », 0, 42) ne font rien paraître, sans « · » orphelin à côté d’un repère valide');
        r1.remove();
        // m6 : au-delà des bornes du domaine (1440 min, 99 ingrédients), un repère ne paraît pas non plus à l'écran
        r1 = await rendre([lienR({ temps_min: 1e9, ingredients: 1e9 }, 0), lienR({ temps_min: 1441, ingredients: 100 }, 1), lienR({ temps_min: 1e9, difficulte: 'facile', ingredients: 99 }, 2)]);
        eq(cartes(r1).map(reperes), [[], [], E('facile · 99 ingrédients')[0]], 'repères : temps > 1440 et ingrédients > 99 ne font rien paraître à l’écran (10^9, 1441, 100) ; 99 reste affiché');
        r1.remove();
        // la présentation est un TEXTE
        r1 = await rendre([lienR({ presentation: '<b>x</b>' })]);
        eq([r1.querySelectorAll('b').length, cartes(r1)[0].children[2].textContent], [0, '<b>x</b>'], 'présentation : « <b>x</b> » est rendue en TEXTE — aucun élément b dans la carte');
        r1.remove();
        // l'adresse à identifiants : « Voir la recette » porte l'href nettoyé, comme le titre
        r1 = await rendre([lienR({ href: 'https://u:p@c.test/x', hote: 'c.test' })]);
        eq([cartes(r1)[0].querySelector('a.btn.small').getAttribute('href'), titres(r1)[0].getAttribute('href')], ['https://c.test/x', 'https://c.test/x'], '« Voir la recette » : adresse revalidée au rendu, identifiants retirés (I-H)');
        r1.remove();
        // l'interface anglaise : même issue en mémoire (K1), aucun appel
        r1 = await rendre([lienR({ presentation: 'Roast salmon.', temps_min: 90, difficulte: 'moyen', ingredients: 1 }, 0), lienR({ difficulte: 'exigeant', ingredients: 12 }, 1), lienR({ temps_min: 15, difficulte: 'facile' }, 2)]);
        setUiLocale('en');
        { const nAv = appels.n; const en = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
          eq([cartes(en).map(reperes), [...en.querySelectorAll('a.btn.small')].map((n) => n.textContent), appels.n - nAv, texte(en).includes('The assistant presents dishes and estimates time from the pages: it checks neither time, nor ingredients, nor restrictions. Read the page before cooking.')], [[['Estimated by the assistant: ≈ 1 h 30 · medium · 1 ingredient'], ['Estimated by the assistant: demanding · 12 ingredients'], ['Estimated by the assistant: ≈ 15 min · easy']], ['View recipe', 'View recipe', 'View recipe'], 0, true], 'repères : interface anglaise → « Estimated by the assistant: », easy / medium / demanding, « 1 ingredient », « View recipe » et la mention traduite');
          en.remove(); }
        setUiLocale('fr'); r1.remove();
      }
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
      // m7 : en repli l'assistant n'a rien présenté ni estimé — l'ancienne mention, pas celle qui parle d'estimation du temps
      ok(texte(root).includes('L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.') && !texte(root).includes('estime le temps'), 'repli : la mention I-K d’avant (sans estimation) est rendue, pas la nouvelle');
      root.remove();
      // rien + Réessayer force enLigne (S9) : monté avec enLigne FAUX, l'appel de « Réessayer » doit recevoir vrai
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {}, enLigne: () => false });
      await tapeEtAttend(root, { etat: 'rien', raison: null, liens: [], repli: false, recherches: 1, modele: 'm' });
      ok(texte(root).includes('Aucune page trouvée pour cette demande. Reformule ou cherche autrement.') && !!bouton(root, 'Réessayer'), 'rien : texte + Réessayer');
      { const n = appels.n; bouton(root, 'Réessayer').click(); await tick(); eq([appels.n, appels.deps[appels.deps.length - 1].enLigne()], [n + 1, true], 'réessayer : rappelle chercher avec enLigne forcé à vrai (S9)'); eq([enVol(root), !!bouton(root, 'Annuler'), !!bouton(root, 'Chercher à nouveau')], [true, true, false], 'réessayer depuis « rien » : écran du vol, « Annuler », plus de « Chercher à nouveau » (V-F4)'); appels.rendre(trouve); await tick(); }
      root.remove();
      // indisponible — les raisons connues (R-T4-4 : non_admis, quota avec ou sans nombre, trop lourd ; cle_refusee et recherche_desactivee
      // n'existent plus : la passerelle les classe requete / serveur) et le texte générique + « Code : … » pour le reste
      const GENERIQUE = 'L’assistant n’a pas répondu. Réessaie.';
      const CAS = [['hors_ligne', {}, 'Tu es hors ligne.', true, false], ['trop_de_demandes', {}, 'Trop de demandes pour l’instant. Réessaie dans une minute.', true, false], ['refus', {}, 'L’assistant a refusé cette demande.', false, false], ['pas_cherche', {}, 'L’assistant n’a pas cherché sur le web. Réessaie.', true, false],
        ['non_admis', {}, 'Ce compte n’a pas accès à l’assistant.', false, false], ['quota', { quota: 60 }, 'Tu as atteint la limite du jour pour l’assistant (60 appels).', false, false], ['quota', { quota: null }, 'Tu as atteint la limite du jour pour l’assistant.', false, false],
        ['requete', { trop_lourd: true }, 'La demande est trop lourde.', false, false],
        ['requete', {}, GENERIQUE, true, true], ['serveur', {}, GENERIQUE, true, true], ['delai', {}, GENERIQUE, true, true], ['interne', {}, GENERIQUE, true, true], ['cle_refusee', {}, GENERIQUE, true, true], ['recherche_desactivee', {}, GENERIQUE, true, true], ['constructor', {}, GENERIQUE, true, true]]; // « constructor » : une clé du prototype n'est pas une raison connue (Object.hasOwn) ; les deux anciennes raisons ne sont plus connues non plus
      for (const [raison, extras, attendu, reessai, code] of CAS) {
        S.reinitialiserWeb();
        root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
        await tapeEtAttend(root, { etat: 'indisponible', raison, liens: [], repli: false, recherches: null, modele: 'm', ...extras });
        const statut = root.querySelector('.status.warn[role="status"]');
        eq([statut?.textContent.includes(attendu), !!bouton(root, 'Réessayer'), !!bouton(root, 'Chercher à nouveau'), !!root.querySelector('a[href="#/settings"]'), texte(root).includes('Code : ' + raison)], [true, reessai, !reessai, false, code], `indisponible/${raison}${extras.quota !== undefined ? ' quota ' + extras.quota : ''}${extras.trop_lourd ? ' trop lourd' : ''} : texte, Réessayer=${reessai}, Chercher à nouveau=${!reessai}, jamais de lien Réglages, code=${code} (K3, R-WEB-7)`);
        root.remove();
      }
      // non_connecte rendu par l'appel (la session a disparu pendant le vol) : « Connecte-toi… » + « Se connecter », pas de relance qui ne mène à rien
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { etat: 'indisponible', raison: 'non_connecte', liens: [], repli: false, recherches: null, modele: 'm' });
      eq([root.querySelector('.status.warn > span')?.textContent, !!bouton(root, 'Se connecter'), !!bouton(root, 'Réessayer'), !!bouton(root, 'Chercher à nouveau'), texte(root).includes('Code : ')], ['Connecte-toi pour utiliser l’assistant.', true, false, false, false], 'indisponible/non_connecte : « Connecte-toi… » + « Se connecter », ni Réessayer ni Chercher à nouveau, pas de code');
      root.remove();
      // R-WEB-7 (a) : une issue sans « Réessayer » relance la MÊME demande par « Chercher à nouveau », SANS forcer enLigne
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {}, enLigne: () => false });
      await tapeEtAttend(root, { etat: 'indisponible', raison: 'non_admis', liens: [], repli: false, recherches: null, modele: 'm' });
      {
        const n = appels.n; const b = bouton(root, 'Chercher à nouveau'); const present = !!b;
        b?.click(); await tick();
        eq([present, appels.n, appels.args[appels.args.length - 1].q, appels.deps[appels.deps.length - 1].enLigne()], [true, n + 1, 'saumon', false], 'non_admis : « Chercher à nouveau » relance la même demande, un appel, enLigne NON forcé (contraste avec « Réessayer », R-WEB-7)');
        eq([enVol(root), !!bouton(root, 'Annuler'), !!bouton(root, 'Chercher à nouveau')], [true, true, false], 'non_admis : après « Chercher à nouveau », écran du vol avec « Annuler », plus de « Chercher à nouveau » (V-F4)');
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
  // --- Lot B « Recette web complète » (spec 2026-10-19-recette-web § 4.1 b, D-B5, D-B7, D-B21, B-29) : « Garder et lire » sur une carte
  {
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale(); setUiLocale('fr');
    const S = await import('../src/ui/search.js');
    const V = await import('../src/ui/vol.js');
    const { withRepo } = await import('./sync-fixture.js');
    const vraiFetch = globalThis.fetch; let reseau = 0;
    globalThis.fetch = async (u) => { reseau += 1; throw new Error(`aucun reseau attendu ici : ${u}`); };
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    try {
      await withRepo(async (repo, db) => {
        const SESSION = { access_token: 'jeton-garder-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
        const ctxDe = async () => ({ docs: [], docsByRecipe: new Map(), ingredientsById: new Map(), meal_feedback: [], settings: { llm: { provider: 'none' } }, recipes: await db.getAll('recipes'), imports: await db.getAll('imports'), sync: { user: { id: 'u1' }, auth: { jeton: async () => SESSION } } });
        const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(corps) });
        const LD = { source_kind: 'jsonld', page: { url_finale: 'https://r.test/a', hote: 'r.test', titre_page: 'P', auteur: null, site: null, lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 0, texte_coupe: false }, recette: { title: 'Pâtes', ingredients: [{ source_text: 'a' }], steps: [{ text: 'b' }] }, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null };
        const posts = []; const fetchLecture = async (url, options) => { posts.push(JSON.parse(options.body)); return reponse(200, LD); };
        const lien = (href, champs = {}) => ({ href, hote: new URL(href).host, titre: 'Pâtes du garde-manger', date: null, presentation: 'Un plat rapide.', temps_min: 20, difficulte: 'facile', ingredients: 7, ...champs });
        const trouve = (liens) => ({ etat: 'trouve', raison: null, liens, autres: [], repli: false, recherches: 1, modele: 'm' });
        const navs = []; const toasts = [];
        const monter = async (liens, lecture = {}) => {
          S.reinitialiserWeb();
          let rendre; const chercher = async () => new Promise((r) => { rendre = r; });
          const root = await S.renderSearch({}, { mode: 'web', q: 'pâtes' }, await ctxDe(), { chercher, navigate: (p) => navs.push(p), remplacerAdresse: () => {}, toast: (m) => toasts.push(m), lecture: { repo, fetch: fetchLecture, ...lecture } });
          scene.append(root);
          [...root.querySelectorAll('button')].find((b) => b.textContent === 'Chercher sur le web avec l’assistant').click();
          await new Promise((r) => setTimeout(r, 0)); rendre(trouve(liens)); await new Promise((r) => setTimeout(r, 0));
          return root;
        };
        const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
        const carteDe = (root, i = 0) => root.querySelectorAll('a.btn:not(.small)[target="_blank"]')[i].parentElement;
        const garderEtLire = (carte) => carte.querySelector('[data-role="garder-et-lire"]');

        // La carte : « Voir la recette » · « Garder ce lien » (.btn.small), puis « Garder et lire » sur une rangée DÉDIÉE, primaire (pas .small, B-29).
        let root = await monter([lien('https://r.test/a'), lien('http://r.test/b')]);
        const rangees = [...carteDe(root).querySelectorAll(':scope > .row')];
        eq([rangees.length, [...rangees[0].children].map((n) => [n.tagName, n.className, n.textContent]), [...rangees[1].children].map((n) => [n.tagName, n.className, n.textContent])], [2, [['A', 'btn small', 'Voir la recette'], ['BUTTON', 'btn small', 'Garder ce lien']], [['BUTTON', 'btn primary', 'Garder et lire']]], 'carte : deux rangées — « Voir la recette » · « Garder ce lien » (.btn.small), puis « Garder et lire » (.btn.primary, pas .small)');
        eq([garderEtLire(carteDe(root, 1)), !!carteDe(root, 1).querySelector('button.btn.small')], [null, true], 'carte : un résultat en http: n’offre pas « Garder et lire » (« Garder ce lien » reste)');
        eq(carteDe(root).querySelector(':scope > figure.apercu'), null, 'UI-2 : sans deps.apercus, la carte n’a pas de figure d’aperçu (les rangées :scope > .row sont celles d’avant)');

        // UNE transaction (signet + import a_lancer kind web), conditionnée ; puis UN POST lecture-web avec l'adresse du signet relu ; puis la route.
        const appels = []; const mutate = db.mutate.bind(db);
        db.mutate = (o) => { appels.push({ puts: Object.keys(o.puts || {}).sort(), conditions: o.conditions ? Object.keys(o.conditions).sort() : null }); return mutate(o); };
        try {
          garderEtLire(carteDe(root)).click();
          await attendre(() => navs.some((p) => p.endsWith('/importer')), 'navigation vers l’écran de lecture');
          await attendre(() => posts.length === 1 && V.volEnCours() === null, 'lecture finie');
        } finally { db.mutate = mutate; }
        const signet = (await db.getAll('recipes')).find((r) => r.source_url === 'https://r.test/a');
        const ligne = (await db.byIndex('imports', 'recipe_id', signet.id))[0];
        eq(appels[0], { puts: ['imports', 'recipes'], conditions: ['imports', 'recipes', 'sync_state'] }, '« Garder et lire » : UNE transaction écrit le signet ET l’import, conditionnée (D-B21)');
        eq([signet.original_title, signet.availability, signet.web_reperes, ligne.kind, ligne.recipe_id], ['Pâtes du garde-manger', 'reference_only', { presentation: 'Un plat rapide.', temps_min: 20, difficulte: 'facile', ingredients: 7 }, 'web', signet.id], '« Garder et lire » : le signet porte le titre et l’adresse du résultat, et ses quatre repères (web_reperes) ; l’import est kind web');
        eq([posts, navs.at(-1)], [[{ outil: 'lecture-web', corps: { url: 'https://r.test/a' } }], `/recipes/${signet.id}/importer`], '« Garder et lire » : puis un POST lecture-web avec l’adresse du signet, puis #/recipes/<id>/importer');

        // Doublon : la même adresse (normalisée) → la phrase et « Ouvrir la fiche » remplacent les deux rangées ; rien d'écrit, zéro POST.
        const nRecettes = await db.count('recipes');
        root = await monter([lien('https://r.test/a/?utm_source=x')]);
        garderEtLire(carteDe(root)).click();
        await attendre(() => !!carteDe(root).querySelector('[data-role="doublon-adresse"]'), 'doublon dit');
        const statut = carteDe(root).querySelector('[data-role="doublon-adresse"]');
        eq([statut.textContent.includes('Tu as déjà gardé cette adresse.'), statut.querySelector('a').getAttribute('href'), carteDe(root).querySelectorAll(':scope > .row').length, await db.count('recipes') - nRecettes, posts.length], [true, `#/recipes/${signet.id}`, 0, 0, 1], 'doublon : « Tu as déjà gardé cette adresse. » + « Ouvrir la fiche » à la place des rangées, zéro écriture, zéro POST (mutant « sans retrait des utm_* » : rouge)');

        // Double tape → un signet, un POST.
        root = await monter([lien('https://r.test/double')]);
        const b = garderEtLire(carteDe(root)); b.click(); b.click();
        await attendre(() => posts.length === 2 && V.volEnCours() === null, 'une lecture');
        await new Promise((r) => setTimeout(r, 30));
        eq([(await db.getAll('recipes')).filter((r) => r.source_url === 'https://r.test/double').length, posts.length], [1, 2], 'double tape : un signet, un POST');

        // Hors ligne : le signet et l'import a_lancer sont écrits, zéro POST, la navigation a lieu (l'écran dira « Tu es hors ligne. »).
        root = await monter([lien('https://r.test/hors')], { enLigne: () => false });
        const avantNav = navs.length;
        garderEtLire(carteDe(root)).click();
        await attendre(() => navs.length > avantNav, 'navigation');
        const sh = (await db.getAll('recipes')).find((r) => r.source_url === 'https://r.test/hors');
        eq([(await db.byIndex('imports', 'recipe_id', sh.id))[0].status, posts.length, navs.at(-1)], ['a_lancer', 2, `/recipes/${sh.id}/importer`], 'hors ligne : signet + import a_lancer écrits, zéro POST, navigation quand même');

        // Régression (§ 8) : « Garder ce lien » navigue toujours vers /add/signet?adresse=&titre= (sans repères).
        [...carteDe(root).querySelectorAll('button')].find((x) => x.textContent === 'Garder ce lien').click();
        const q = new URLSearchParams(navs.at(-1).split('?')[1]);
        eq([navs.at(-1).startsWith('/add/signet?'), q.get('adresse'), q.get('titre'), [...q.keys()].sort()], [true, 'https://r.test/hors', 'Pâtes du garde-manger', ['adresse', 'titre']], 'régression : « Garder ce lien » mène toujours au formulaire, adresse et titre seulement');
        // Ronde 1 : une écriture impossible (quota, base fermée) est journalisée (search.garder_et_lire) et dite « Le lien n’a pas pu être gardé.
        // Réessaie. » — jamais « Adresse non reconnue. » pour une adresse valide — ; le bouton se rallume ; rien d'écrit, zéro POST, aucune navigation.
        const nPosts = posts.length; const nNavs = navs.length;
        const erreursG = []; const vraiErreurG = console.error; console.error = (...a) => { erreursG.push(String(a[0])); };
        let bPanne;
        try {
          root = await monter([lien('https://r.test/panne')], { repo: { ...repo, saveBatch: async () => { throw new Error('disque plein'); } } });
          bPanne = garderEtLire(carteDe(root)); const nToasts = toasts.length;
          bPanne.click();
          await attendre(() => toasts.length > nToasts, 'le refus dit');
        } finally { console.error = vraiErreurG; }
        eq([toasts.at(-1), bPanne.disabled, erreursG.some((e) => e.includes('search.garder_et_lire')), (await db.getAll('recipes')).some((r) => r.source_url === 'https://r.test/panne'), posts.length - nPosts, navs.length - nNavs], ['Le lien n’a pas pu être gardé. Réessaie.', false, true, false, 0, 0], '« Garder et lire » : une écriture impossible → journalisée, « Le lien n’a pas pu être gardé. Réessaie. », bouton rallumé ; rien d’écrit, zéro POST, aucune navigation');

        eq(reseau, 0, 'aucun réseau réel');
      });
    } finally { globalThis.fetch = vraiFetch; scene.remove(); S.reinitialiserWeb(); setUiLocale(localeAvant); }
  }
  // --- § 8 / § 9.8 dictionnaire et statiques
  {
    const { EN } = await import('../src/i18n/en.js');
    const CLES = ['Connecte-toi pour utiliser l’assistant.', 'Se connecter', 'Ce compte n’a pas accès à l’assistant.', 'Tu as atteint la limite du jour pour l’assistant ({n} appels).', 'Tu as atteint la limite du jour pour l’assistant.', 'La demande est trop lourde.', 'Chercher sur le web avec l’assistant', 'Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.', 'Photos en cours de récupération…', 'Photos indisponibles pour cette recherche.', 'Quota du jour atteint : photos indisponibles.', 'Écris d’abord ce que tu cherches.', 'L’assistant cherche sur le web…', 'Annuler', 'Trouvé sur le web', 'Demande envoyée : {q}', 'Garder ce lien', 'L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.', 'L’assistant présente les plats et estime le temps d’après les pages : il ne vérifie ni le temps, ni les ingrédients, ni les restrictions. Relis la page avant de cuisiner.', 'Estimé par l’assistant : {r}', 'Voir la recette', '≈ {n} min', '≈ {h} h', '≈ {h} h {m}', 'facile', 'moyen', 'exigeant', '1 ingrédient', '{n} ingrédients', 'Recherches faites par l’assistant : {n}', 'Liens tels que trouvés, sans tri de l’assistant.', 'Chercher à nouveau', 'Aucune page trouvée pour cette demande. Reformule ou cherche autrement.', 'Trop de demandes pour l’instant. Réessaie dans une minute.', 'L’assistant a refusé cette demande.', 'L’assistant n’a pas cherché sur le web. Réessaie.', 'L’assistant n’a pas répondu. Réessaie.', 'Adresse reçue : vérifie-la avant d’enregistrer.', 'La demande a changé depuis cette recherche.', 'Autres pages trouvées ({n})', 'Réessayer', 'Réglages', 'Tu es hors ligne.', 'Code : {c}'];
    eq(CLES.filter((k) => typeof EN[k] !== 'string' || !EN[k]), [], 'en.js : chaque texte du lot a sa traduction');
    eq(['Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.', 'Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.', 'Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.', 'La recherche web n’est pas activée sur ton compte Anthropic.', 'Une recherche = un appel à ton compte Anthropic.', 'Une création = un appel à ton compte Anthropic.', 'L’assistant présente les plats d’après les pages et ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.', 'Une recherche = un appel à l’assistant, compté dans ton quota du jour.'].filter((k) => k in EN), [], 'en.js : les textes de l’ancienne clé locale (configure, fournisseur, clé refusée, recherche désactivée) sont retirés avec leurs écrans (Passerelle T4), la mention intermédiaire « présente les plats d’après les pages » (remplacée avant d’être servie) ; UI-2 : la garde « un appel » (remplacée par « 2 appels »)');
    ok(!('Le Web n’est pas activé : aucune source externe n’est configurée. Aucune recherche extérieure n’a été faite.' in EN), 'en.js : la clé morte du mode Web est retirée');
    ok(!(await lire('../src/ui/search.js')).includes('Le Web n’est pas activé'), 'search.js : la coquille est retirée');
    ok(!/from '\.\.\/ui\//.test(await lire('../src/core/bornes.js')) && !/from '\.\.\/ui\//.test(await lire('../src/domain/recherche-web.js')), 'couches : bornes.js et recherche-web.js n’importent rien de src/ui/');
  }
}
