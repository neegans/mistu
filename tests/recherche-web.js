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
}
