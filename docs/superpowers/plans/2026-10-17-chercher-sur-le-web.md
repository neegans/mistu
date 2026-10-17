# Chercher sur le web — plan d'implémentation (rév. 1, base `main e4e841b`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dans l'onglet « Web » de la recherche, une tape sur « Chercher sur le web avec l’assistant » fait **un** appel à l'API Anthropic avec l'outil serveur de recherche web, puis affiche jusqu'à cinq liens vers des pages **réellement rapportées par le serveur**, chacun à ouvrir ou à garder comme lien web ; les échecs sont dits avec leur vraie raison, et rien ne part sans tape.

**Architecture:** Un module pur `src/domain/recherche-web.js` (demande → corps de requête → lecture typée de la réponse → choix des liens parmi les résultats bruts → issue à cinq états, sans jamais lever). Un module pur `src/core/bornes.js` qui **reçoit** les aides réseau du lot ISBN (`lireBornee`, `signalDelai`, `OPTIONS_FETCH`, `borner`) pour que le domaine n'importe rien de l'interface. Dans `src/ui/search.js`, l'état de la recherche web vit **au niveau du module** (un seul appel en vol dans l'app, mémoire vive par clé de demande) parce qu'Entrée ré-instancie la route ; la garde du fournisseur passe par `providerFrom(settings)`. `signet.js` accepte un préremplissage par la query, avec bannière et hôte.

**Tech Stack:** PWA sans build, modules ES natifs, pas de npm ; tests dans le navigateur (`tests/index.html` → `tests/tests.js`, `eq`/`ok`, total épinglé) ; `fetch` injecté partout ; service worker `sw.js` (`SHELL`, `VERSION`) ; API Anthropic Messages avec l'outil `web_search_20250305`, appel direct depuis le navigateur.

**Spec:** `docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md` (rév. 2.1 — K1-K3 du kit intégrés ; § 3 invariants I-A…I-K, § 4 module, § 5 écran, § 6 signet, § 7 fournisseur et aides, § 9 tests, § 11.1 constats des revues). Lis-la **en entier** avant ta tâche. Registre SDD : `~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/` (`progress.md`, un brief, un rapport et une revue par tâche ; lanceur `suite.cjs`).

## Global Constraints

- **Arbre de travail : `~/projects/mistu-web` (branche `recherche-web`, base `main e4e841b`), servi sur `http://localhost:8083/`.** Ne touche JAMAIS `~/projects/mistu`, `~/projects/mistu-isbn` ni `~/projects/mistu-sync`. Si 8083 ne répond pas : `cd ~/projects/mistu-web && nohup python3 -m http.server 8083 > /dev/null 2>&1 &`.
- **Lancer la suite** (sans fenêtre, cache purgé) : `node ~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/suite.cjs 8083` → `BILAN : ✅ N/N tests réussis` ou `❌` + échecs (`.ko`) + console. **Base avant le lot : 1537/1537** (total épinglé 1536), une seule erreur console tolérée : `HTTP 404 …/favicon.ico` (pré-existante). Aussi : `node --test tools/*.test.mjs` (40/40) et `node tools/generer-migrations.mjs --check` (0) ne doivent pas bouger.
- **Total épinglé (F2 du lot UX).** `tests/tests.js` l. 180 : `eq(results.length, 1536, 'compte d’assertions : une assertion qui disparait est un rouge');`. **À chaque tâche** : après le vert de toutes les autres assertions, lire le nombre dans l'échec « obtenu : X » et poser X − 1 ? NON : poser exactement **la valeur « obtenu »** moins rien — l'assertion compte celles qui la précèdent : si le bilan dit `❌ N-1/N` avec `obtenu : M`, poser `M`. Jamais deviner.
- **Aucun réseau dans la suite** : `fetch`, `enLigne`, `signal`, `tentativeMs`, `fuseau`, `chercher`, `navigate` injectés. Les tests d'écran stubbent `globalThis.fetch` pour **refuser** tout appel (modèle `tests/ajouter.js` l. 590-600).
- **Français, chaînes `t('…')` avec l'apostrophe typographique ’ (U+2019)** ; chaque chaîne neuve a son entrée dans `src/i18n/en.js` (clé = chaîne française exacte). La liste exacte est en spec § 8 et dans la tâche 9.
- **`sw.js`** : `SHELL` gagne `./src/core/bornes.js` (tâche 1) et `./src/domain/recherche-web.js` (tâche 3) ; `VERSION = 'cuisine-os-v0.5.0-N'`, **N = numéro de la tâche** dès qu'un fichier servi change. `APP_VERSION = '0.5.0'` dès la tâche 1 ; pins mis à jour en tâche 1 : `tests/ajouter.js` l. 1800 et 1802, `tests/sync-l3.js` l. 1864.
- **Commits** : messages **ASCII sans accents**, un par tâche au moins, **par fichiers nommés** (jamais `git add -A`/`.` : `.superpowers/` est non suivi), terminés par `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Pas de `push` (geste de Neegan).
- **Pas de `html:`, `innerHTML`, `window.open`** dans les modules touchés ; texte par `textContent` via `el()` (`src/core/dom.js`).
- **Pièges connus** : dans un appel d'outil, `\uXXXX` nu devient le caractère réel → écrire `\u{XXXX}` dans le code et vérifier les octets ; `src/core/log.js` ne journalise que les clés `store, id, status, reason, table, count` (écrire `reason`, pas `raison`) ; `parseJsonLoose` (llm.js) coupe du premier `{` au dernier `}` et **lève** si ça ne parse pas.
- **Invariants spec § 3** à relire avant chaque tâche : I-A (lien ⇔ résultat brut), I-B (rien sans tape), I-C (clé jamais recopiée), I-G (mémoire vive par clé de demande), I-I (un vol), I-J (ce qui part = ce qui est affiché), I-K (l'assistant ne garantit rien).

## Review Focus

Entrées que la spec implique sans les nommer d'abord ; chacune a son test dans la tâche qui possède le code :

1. **Phrase tapée sans Entrée, puis tape** : la demande envoyée est le champ, pas l'ancienne `state.q` ; et le bouton s'ouvre pendant la frappe sans redessin → tâche 6.
2. **Puce touchée après des résultats** : les liens restent, la mention « La demande a changé depuis cette recherche. » apparaît puis disparaît, sans aucun appel (K1) → tâche 7.
3. **Titre de page portant du balisage** (`<b>x</b>`) ou un U+202E : rendu littéral et nettoyé, jusque dans le paramètre du signet → tâches 3 et 7.
4. **Réponse à blocs incomplets** (`text` sans `text`, `usage` sans `server_tool_use`, `content` d'un bloc outil à `null`) : lecture sans plantage → tâche 3.
5. **Réglage effacé pendant le vol** (Anthropic → aucun) : l'issue `non_configure` qui revient se rend avec le texte de la garde, pas un écran muet → tâche 7.

---

### Task 1 : `src/core/bornes.js` (déplacement), version 0.5.0, pins, `notice` mort, suite neuve

**Files:**
- Create: `src/core/bornes.js`
- Modify: `src/ui/livre-ajout.js:19` (OPTIONS_FETCH), `:29` (borner), `:58-86` (lireBornee, signalDelai)
- Modify: `src/domain/search.js:149`, `src/domain/pairing.js:44`
- Modify: `src/model/schema.js:6`, `sw.js:4` et `:11`
- Modify: `tests/ajouter.js:1800-1802`, `tests/sync-l3.js:1864`, `tests/tests.js:22` et `:177-180`
- Create: `tests/recherche-web.js`

**Interfaces:**
- Produces: `borner(s, max) → string` (chaîne sans Cc/Cf/U+2028/U+2029, tronquée par points de code ; non-chaîne → `''`), `lireBornee(r, maxOctets) → Uint8Array[] | null | false`, `signalDelai(ms) → AbortSignal`, `OPTIONS_FETCH` ; tous exportés par `src/core/bornes.js` et ré-exportés (sauf `borner`) par `src/ui/livre-ajout.js`.
- Produces: `runRechercheWebTests({ eq, ok })` dans `tests/recherche-web.js`, enregistré dans `tests/tests.js`.

- [ ] **Step 1 : Écrire les tests rouges (bornes, pins, notice) dans `tests/recherche-web.js`**

```js
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
}
```

- [ ] **Step 2 : Enregistrer la suite dans `tests/tests.js`**

Après la ligne 22 (`import { runAjouterTests } from './ajouter.js';`) :

```js
import { runRechercheWebTests } from './recherche-web.js';
```

Après le bloc `runAjouterTests` (l. 174-176), avant le commentaire du total épinglé :

```js
// --- Chercher sur le web : bornes communes, lecture de la réponse, issues, écran à gestes injectés.
try { await runRechercheWebTests({ eq, ok }); }
catch (error) { ok(false, `Suite recherche web interrompue : ${error?.message || String(error)}`); }
```

- [ ] **Step 3 : Lancer la suite, vérifier le rouge**

Run : `node ~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/suite.cjs 8083`
Attendu : `❌`, échecs « bornes : … », « domaine : … », « sw.js : VERSION 0.5.0 », « APP_VERSION 0.5.0 », et l'import de `../src/core/bornes.js` qui échoue dans le `catch` de la suite (« Suite recherche web interrompue »). C'est le rouge attendu.

- [ ] **Step 4 : Créer `src/core/bornes.js`**

```js
// Bornes communes aux appels distants (lot ISBN : R-ISBN-1, S1, C9/S11, S12 ; lot Web : spec § 7.2). Module PUR,
// sans import, sans DOM : le domaine (recherche-web.js) comme l'interface (livre-ajout.js) le lisent. Les corps des
// fonctions sont ceux du lot ISBN, déplacés tels quels ; seul `borner` reçoit sa borne en paramètre.
export const OPTIONS_FETCH = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };

// Une chaîne seulement, sans caractères de contrôle (Cc) ni de format (Cf : bidi, largeur nulle…), ni les séparateurs
// de ligne U+2028/U+2029 (Zl/Zp, nommés à part), tronquée à `max` POINTS DE CODE : une paire de substitution coupée
// laisserait une demi-paire que le jsonb refuse. Tout ce qui n'est pas une chaîne vaut ''.
export function borner(s, max) {
  if (typeof s !== 'string') return '';
  return Array.from(s.replace(/[\p{Cc}\p{Cf}\u{2028}\u{2029}]/gu, '')).slice(0, max).join('');
}

// Un corps distant est lu EN FLUX et la lecture est COUPÉE (reader.cancel()) dès que le cumul dépasse la borne —
// rien de ce qui a été lu n'est conservé, et le reste du corps n'est jamais tiré. Une réponse sans `body` (vieux
// navigateur, réponse factice d'un test) rend `false` : l'appelant replie alors sur r.text() / r.blob() et contrôle
// la taille réelle.
export async function lireBornee(r, maxOctets) {
  if (!r?.body || typeof r.body.getReader !== 'function') return false;
  const lecteur = r.body.getReader();
  const morceaux = [];
  let octets = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    octets += value?.byteLength || 0;
    if (octets > maxOctets) { await lecteur.cancel(); return null; } // le morceau fautif n'est même pas gardé
    morceaux.push(value);
  }
  return morceaux;
}

// Délai borné : AbortSignal.timeout n'existe pas partout (Safari < 16) et peut lever. Repli sur un AbortController +
// setTimeout, qui abandonne à la même seconde.
export function signalDelai(ms) {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  } catch { /* repli ci-dessous */ }
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), ms);
  return ctl.signal;
}
```

- [ ] **Step 5 : Faire lire `livre-ajout.js` depuis `core/bornes.js` (comportement inchangé)**

Ligne 19, remplacer `export const OPTIONS_FETCH = { … };` par :

```js
import { borner as bornerCore, lireBornee, signalDelai, OPTIONS_FETCH } from '../core/bornes.js';
export { lireBornee, signalDelai, OPTIONS_FETCH }; // ré-exportés : tests/ajouter.js et book.js les lisent ici
```

Ligne 29, remplacer la définition de `borner` par :

```js
const borner = (s) => bornerCore(s, LIMITES_ISBN.champ);
```

Supprimer les définitions de `lireBornee` (≈ l. 58-75, commentaire compris) et de `signalDelai` (≈ l. 77-86). Garder `attenteReelle`. Vérifier : `grep -n "lireBornee\|signalDelai\|borner(" src/ui/livre-ajout.js` ne montre plus de `function`, seulement des appels. `grep -rn "lireBornee\|signalDelai\|OPTIONS_FETCH" src/ui/book.js` : si `book.js` les importe depuis `livre-ajout.js`, rien à changer (ré-export).

- [ ] **Step 6 : Retirer le `notice` mort**

`src/domain/search.js` l. 149 → `if (mode === 'web') return groups;`. `src/domain/pairing.js` l. 44 : retirer `, notice: groups.notice` de l'objet rendu.

- [ ] **Step 7 : Versions et pins**

`src/model/schema.js` l. 6 : `export const APP_VERSION = '0.5.0';`. `sw.js` l. 4 : `const VERSION = 'cuisine-os-v0.5.0-1';` ; l. 11 (ligne des `./src/core/…`) : insérer `'./src/core/bornes.js',` après `'./src/core/blob-urls.js',` (ordre alphabétique de la ligne).
`tests/ajouter.js` l. 1800 : `ok(/VERSION = 'cuisine-os-v0\.5\.0-\d+'/.test(sw), 'sw.js : VERSION 0.5.0');` ; l. 1802 : `eq(APP_VERSION, '0.5.0', 'APP_VERSION 0.5.0');`. `tests/sync-l3.js` l. 1864 : `v0\.4\.1` → `v0\.5\.0` dans la regex (le message peut rester).

- [ ] **Step 8 : Lancer la suite, poser le total épinglé**

Run : `node ~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/suite.cjs 8083`
Attendu : tout vert sauf « compte d’assertions » avec `obtenu : M` → poser `M` à `tests/tests.js` l. 180, relancer : `✅ (M+1)/(M+1)`, console = le seul 404 favicon. Puis `node --test tools/*.test.mjs` (40/40) et `node tools/generer-migrations.mjs --check` (0).

- [ ] **Step 9 : Commit**

```bash
cd ~/projects/mistu-web && git add src/core/bornes.js src/ui/livre-ajout.js src/domain/search.js src/domain/pairing.js src/model/schema.js sw.js tests/ajouter.js tests/sync-l3.js tests/tests.js tests/recherche-web.js
git commit -m "Bornes communes dans core/bornes.js, version 0.5.0, notice web mort retire, suite recherche-web (tache 1)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2 : `llm.js` — test « inchangé » d'abord, puis `ANTHROPIC_MESSAGES_URL`, `anthropicHeaders`, `supportsWebSearch`

**Files:**
- Modify: `src/domain/llm.js:5-13` (LLMProvider), `:40-62` (AnthropicProvider)
- Test: `tests/recherche-web.js`

**Interfaces:**
- Produces: `export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'` ; `export function anthropicHeaders(apiKey) → { 'content-type', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access' }` ; `get supportsWebSearch()` sur `LLMProvider` (false) et `AnthropicProvider` (true) ; `providerFrom(settings)` inchangé.

- [ ] **Step 1 : Écrire le test « comportement inchangé » de `AnthropicProvider.complete` — il doit être VERT sur le code actuel (§ 9.7, F19)**

Ajouter à `runRechercheWebTests`, après le bloc bornes :

```js
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
```

- [ ] **Step 2 : Lancer la suite : ce bloc est vert (la preuve que le refactor sera à comportement inchangé)**

Run : `node ~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/suite.cjs 8083`
Attendu : seules les assertions « llm : … » neuves, toutes vertes ; « compte d’assertions » rouge (normal, posé au step 7).

- [ ] **Step 3 : Écrire les tests rouges des exports neufs**

```js
  // --- § 7.1 : exports neufs, et supportsWebSearch lu par l'écran (F6)
  {
    const L = await import('../src/domain/llm.js');
    eq(L.ANTHROPIC_MESSAGES_URL, 'https://api.anthropic.com/v1/messages', 'llm : ANTHROPIC_MESSAGES_URL exportée');
    eq(L.anthropicHeaders('k'), { 'content-type': 'application/json', 'x-api-key': 'k', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, 'llm : anthropicHeaders rend exactement les quatre en-têtes');
    eq([L.providerFrom({ llm: { provider: 'none' } }).supportsWebSearch, L.providerFrom({ llm: { provider: 'openai_compatible', api_key: 'k', model: 'm' } }).supportsWebSearch, L.providerFrom({ llm: { provider: 'anthropic', api_key: 'k', model: 'm' } }).supportsWebSearch], [false, false, true], 'llm : seul Anthropic cherche sur le web');
    eq([L.providerFrom({ llm: { provider: 'anthropic', api_key: '', model: 'm' } }).configured, L.providerFrom({ llm: { provider: 'anthropic', api_key: 'k', model: '' } }).configured], [false, false], 'llm : Anthropic sans clé ou sans modèle n’est pas configuré (garde § 5.2)');
  }
```

- [ ] **Step 4 : Lancer la suite, vérifier le rouge** (« ANTHROPIC_MESSAGES_URL exportée », « anthropicHeaders », « seul Anthropic »).

- [ ] **Step 5 : Implémenter dans `src/domain/llm.js`**

Avant `export class LLMProvider` :

```js
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
// Les en-têtes d'un appel direct depuis le navigateur (clé en en-tête, jamais dans l'adresse — I-C) : une seule
// définition, lue par `complete` et par recherche-web.js.
export function anthropicHeaders(apiKey) {
  return { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
}
```

Dans `LLMProvider`, après `get supportsVision()` : `get supportsWebSearch() { return false; }`. Dans `AnthropicProvider`, après `get supportsVision()` : `get supportsWebSearch() { return true; }`. Dans `AnthropicProvider.complete`, remplacer l'appel `fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { … }, body: JSON.stringify(body) })` par :

```js
    const res = await fetch(ANTHROPIC_MESSAGES_URL, { method: 'POST', headers: anthropicHeaders(this.config.api_key), body: JSON.stringify(body) });
```

- [ ] **Step 6 : Lancer la suite : tout vert (le bloc « inchangé » du step 1 toujours vert)**

- [ ] **Step 7 : Poser le total épinglé, relancer, commit**

```bash
cd ~/projects/mistu-web && git add src/domain/llm.js tests/recherche-web.js tests/tests.js
git commit -m "llm.js : URL et en-tetes Anthropic exportes, supportsWebSearch, test de comportement inchange (tache 2)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3 : `src/domain/recherche-web.js` pur — `construireDemande`, `corpsRequete`, `lireReponse`, `choisirLiens`

**Files:**
- Create: `src/domain/recherche-web.js`
- Modify: `sw.js:4` (VERSION -3), `:17` (SHELL)
- Test: `tests/recherche-web.js`

**Interfaces:**
- Consumes: `borner` (`core/bornes.js`), `lienSignet` (`core/lien.js`), `parseJsonLoose` (`domain/llm.js`).
- Produces: `LIMITES_WEB`, `OUTIL_RECHERCHE`, `construireDemande({ q, filtres, langue }) → { system, user, cle, q, filtres }` (`q` et `filtres` **nettoyés**, ce qui part vraiment — amende la spec § 4.1, à consigner en § 11.2 comme R-WEB-1 : l'écran rappelle la demande partie, jamais la saisie brute), `corpsRequete({ cfg, demande, fuseau }) → objet`, `lireReponse(json) → { resultats: [{ href, hote, titre, date }], erreursOutil: string[], aCherche, texte, stopReason, recherches }`, `choisirLiens(lu, { max }) → { liens: [{ href, hote, titre, date, pourquoi }], autres: [même forme], repli }` (K2 : `liens` = choix survivants seulement, `autres` = le reste des résultats). La tâche 4 ajoute `chercherRecettesWeb` au même fichier.

- [ ] **Step 1 : Écrire les tests rouges (§ 9.1-9.3)**

```js
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
    eq(W.construireDemande({ q: 'x'.repeat(600) + '\u{202E}', filtres: [], langue: 'fr' }).q.length, 500, 'demande : le q rendu est borné et sans bidi');
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
      blocRes([res('https://a.test/r1', 'A', 'October 1, 2026'), res('https://b.test/r2', 'B'), res('https://u:p@c.test/r3', 'C'.repeat(350) + '\u{202E}', '')]),
      blocRes([res('https://a.test/r1', 'A bis'), res('ftp://x.test/r', 'X'), res('https://d.test/r4', 'D')]),
      texte('{"choix":[{"url":"https://c.test/r3","pourquoi":"Court."},{"url":"https://zz.test/pas-dans-les-resultats","pourquoi":"Inventé"},{"url":"https://a.test/r1","pourquoi":"' + 'p'.repeat(250) + '\u{200B}' + 'q'.repeat(50) + '"}]}'),
    ] };
    const lu = W.lireReponse(json);
    eq(lu.resultats.map((r) => r.href), ['https://a.test/r1', 'https://b.test/r2', 'https://c.test/r3', 'https://d.test/r4'], 'lecture : 4 résultats dans l’ordre, doublon et ftp écartés, identifiants retirés');
    eq([lu.resultats[0].titre, lu.resultats[0].date, lu.resultats[1].date, lu.resultats[2].date], ['A', 'October 1, 2026', null, null], 'lecture : titre et date typés ; page_age absent ou vide → null');
    eq([lu.resultats[2].titre.length, lu.resultats[2].titre.includes('\u{202E}')], [300, false], 'lecture : un titre de 350 avec U+202E est borné à 300 points de code sans le bidi (S2)');
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
    eq([ch.liens[1].pourquoi.length, ch.liens[1].pourquoi.includes('\u{200B}')], [200, false], 'choix : pourquoi borné à 200 points de code sans Cf (I-J)');
    eq(W.choisirLiens({ ...lu, texte: 'pas du json' }), { liens: lu.resultats.map((r) => ({ ...r, pourquoi: null })), autres: [], repli: true }, 'choix : JSON illisible → repli, les résultats tels quels, rien dans autres');
    eq(W.choisirLiens({ ...lu, texte: '{"choix":[]}' }).repli, true, 'choix : choix vide → repli');
    eq(W.choisirLiens({ ...lu, texte: '{"choix":[null,3,{},{"url":5}]}' }).repli, true, 'choix : entrées hostiles ignorées sans lever (S13)');
    eq(W.choisirLiens({ ...lu, texte: '{x} puis {"choix":[{"url":"https://a.test/r1"}]}' }).repli, true, 'choix : une accolade parasite dans la prose rend le JSON illisible → repli (même avec une adresse valide dedans)');
    {
      const sept = { resultats: Array.from({ length: 7 }, (_, i) => ({ href: `https://s${i}.test/`, hote: `s${i}.test`, titre: `S${i}`, date: null })), texte: '{"choix":' + JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ url: `https://s${i}.test/`, pourquoi: 'p' }))) + '}' };
      eq([W.choisirLiens(sept).liens.length, W.choisirLiens(sept).autres.length], [5, 2], 'choix : cinq liens au plus, les deux autres à part (K2)');
      eq(W.choisirLiens({ ...sept, texte: '{"choix":[{"url":"https://s1.test/"},{"url":"https://s1.test/"}]}' }).liens.filter((l) => l.href === 'https://s1.test/').length, 1, 'choix : un doublon de choix ne rend qu’un lien');
      eq(W.choisirLiens({ resultats: [{ href: 'https://s.test/', hote: 's.test', titre: '', date: null }], texte: '' }).liens[0].titre, 's.test', 'choix : titre vide → l’hôte');
    }
    const sw = await lire('../sw.js');
    ok(sw.includes("'./src/domain/recherche-web.js'"), 'SHELL : ./src/domain/recherche-web.js');
    ok(!/from '\.\.\/ui\//.test(await lire('../src/domain/recherche-web.js')), 'recherche-web.js : n’importe rien de src/ui/ (couche domaine)');
  }
```

- [ ] **Step 2 : Lancer la suite, vérifier le rouge** (import de `recherche-web.js` échoue → « Suite recherche web interrompue » ; c'est attendu tant que le module n'existe pas).

- [ ] **Step 3 : Créer `src/domain/recherche-web.js` (fonctions pures ; `chercherRecettesWeb` arrive à la tâche 4)**

```js
// Chercher sur le web avec l'assistant (spec docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md, § 4).
// Pur, sauf l'appel réseau de chercherRecettesWeb (tâche 4). Un lien n'existe que s'il est dans les RÉSULTATS BRUTS du
// serveur (I-A) ; le texte de l'assistant ne donne que « pourquoi », borné (I-J) ; rien de l'API n'est recopié dans
// l'issue (I-C) ; aucune fonction ne lève vers l'appelant.
import { parseJsonLoose, ANTHROPIC_MESSAGES_URL, anthropicHeaders } from './llm.js';
import { lienSignet } from '../core/lien.js';
import { borner, lireBornee, signalDelai, OPTIONS_FETCH } from '../core/bornes.js';
import { logError } from '../core/log.js';

export const LIMITES_WEB = { demande: 500, filtre: 80, filtres: 12, titre: 300, date: 40, pourquoi: 200, liens: 5, recherches: 3, tentativeMs: 45000, corps: 2 * 1024 * 1024, corpsErreur: 64 * 1024 };
export const OUTIL_RECHERCHE = 'web_search_20250305';

// Le system par langue (§ 4.1). Il cherche TOUJOURS, n'affirme JAMAIS une restriction (I-K), répond en JSON `choix`.
const SYSTEM = {
  fr: [
    'Tu trouves des pages de recettes sur le web pour Cuisine OS, une bibliothèque de recettes personnelle.',
    'Cherche TOUJOURS sur le web avec l’outil web_search (1 à 3 recherches), même si tu crois connaître des recettes.',
    'Préfère les pages de recettes complètes ; en français du Québec d’abord.',
    'N’affirme JAMAIS qu’une page respecte une restriction alimentaire ou une durée : dis seulement ce que la page annonce.',
    'Puis réponds UNIQUEMENT par un objet JSON de cette forme : {"choix":[{"url":"…","pourquoi":"…"}]}',
    '— 5 entrées au plus ; chaque url est l’adresse EXACTE d’une page trouvée par la recherche ; n’invente ni page ni adresse ;',
    'pourquoi = une phrase courte qui relie la page à la demande.',
  ].join('\n'),
  en: [
    'You find recipe pages on the web for Cuisine OS, a personal recipe library.',
    'ALWAYS search the web with the web_search tool (1 to 3 searches), even if you think you know recipes.',
    'Prefer complete recipe pages.',
    'NEVER claim that a page meets a dietary restriction or a duration: only say what the page announces.',
    'Then answer ONLY with a JSON object of this shape: {"choix":[{"url":"…","pourquoi":"…"}]}',
    '— at most 5 entries; each url is the EXACT address of a page found by the search; never invent a page or an address;',
    'pourquoi = one short sentence linking the page to the request.',
  ].join('\n'),
};

export function construireDemande({ q, filtres, langue } = {}) {
  const demande = borner(q, LIMITES_WEB.demande).trim();
  const propres = (Array.isArray(filtres) ? filtres : []).map((f) => borner(f, LIMITES_WEB.filtre).trim()).filter(Boolean).slice(0, LIMITES_WEB.filtres);
  const lang = langue === 'fr' ? 'fr' : 'en';
  if (!demande) return { system: null, user: null, cle: null, q: '', filtres: [] };
  const user = propres.length ? `${demande}\n${lang === 'fr' ? 'Contraintes' : 'Constraints'} : ${propres.join(' ; ')}` : demande;
  // q et filtres rendus = NETTOYÉS : l'écran rappelle ce qui est parti, jamais la saisie brute (I-J, R-WEB-1).
  return { system: SYSTEM[lang], user, cle: JSON.stringify([demande, propres, lang]), q: demande, filtres: propres };
}

export function corpsRequete({ cfg, demande, fuseau } = {}) {
  const user_location = { type: 'approximate', country: 'CA' };
  if (typeof fuseau === 'string' && fuseau) user_location.timezone = fuseau;
  return {
    model: cfg.model, max_tokens: 4096, system: demande.system,
    messages: [{ role: 'user', content: demande.user }],
    tools: [{ type: OUTIL_RECHERCHE, name: 'web_search', max_uses: LIMITES_WEB.recherches, user_location }],
  };
}

// § 4.3 : la liste brute des pages (dédoublonnée par href exact — deux adresses différentes sont deux pages), les
// erreurs d'outil, le texte recollé SANS séparateur (les citations coupent une chaîne JSON au milieu — F7), le
// stop_reason et le compte de recherches. Toute forme hostile est ignorée, jamais levée.
export function lireReponse(json) {
  const vide = { resultats: [], erreursOutil: [], aCherche: false, texte: '', stopReason: null, recherches: null };
  if (!json || typeof json !== 'object' || !Array.isArray(json.content)) return vide;
  const vus = new Set(); const resultats = []; const erreursOutil = []; let aCherche = false; let texte = '';
  for (const bloc of json.content) {
    if (!bloc || typeof bloc !== 'object') continue;
    if (bloc.type === 'text') { if (typeof bloc.text === 'string') texte += bloc.text; continue; }
    if (bloc.type === 'server_tool_use') { aCherche = true; continue; }
    if (bloc.type !== 'web_search_tool_result') continue;
    aCherche = true;
    const contenu = bloc.content;
    if (Array.isArray(contenu)) {
      for (const r of contenu) {
        if (!r || typeof r !== 'object' || r.type !== 'web_search_result' || typeof r.url !== 'string' || !r.url) continue;
        const lien = lienSignet(r.url);
        if (!lien.ok || vus.has(lien.href)) continue;
        vus.add(lien.href);
        const date = typeof r.page_age === 'string' ? borner(r.page_age, LIMITES_WEB.date).trim() : '';
        resultats.push({ href: lien.href, hote: lien.hote, titre: borner(r.title, LIMITES_WEB.titre).trim(), date: date || null });
      }
    } else if (contenu && typeof contenu === 'object' && typeof contenu.error_code === 'string') {
      erreursOutil.push(contenu.error_code);
    }
  }
  const n = json.usage?.server_tool_use?.web_search_requests;
  return { resultats, erreursOutil, aCherche, texte, stopReason: typeof json.stop_reason === 'string' ? json.stop_reason : null, recherches: Number.isInteger(n) && n >= 0 ? n : null };
}

// § 4.4 : les choix de l'assistant ne SURVIVENT que s'ils désignent exactement un résultat (I-A) ; titre, hôte et
// date viennent du résultat. PAS de complément automatique (K2) : les résultats non choisis vont dans `autres`, que
// l'écran replie. repli = aucun choix n'a survécu : `liens` = les premiers résultats tels quels.
export function choisirLiens(lu, { max = LIMITES_WEB.liens } = {}) {
  const resultats = Array.isArray(lu?.resultats) ? lu.resultats : [];
  const parHref = new Map(resultats.map((r) => [r.href, r]));
  const liens = []; const pris = new Set();
  let choix = null;
  try { const data = parseJsonLoose(lu?.texte); choix = Array.isArray(data?.choix) ? data.choix : null; } catch { choix = null; }
  for (const c of choix || []) {
    if (liens.length >= max) break;
    if (!c || typeof c !== 'object' || typeof c.url !== 'string') continue;
    const lien = lienSignet(c.url);
    if (!lien.ok || !parHref.has(lien.href) || pris.has(lien.href)) continue;
    pris.add(lien.href);
    const pourquoi = borner(c.pourquoi, LIMITES_WEB.pourquoi).trim();
    liens.push({ ...parHref.get(lien.href), pourquoi: pourquoi || null });
  }
  const repli = liens.length === 0;
  if (repli) for (const r of resultats) { if (liens.length >= max) break; pris.add(r.href); liens.push({ ...r, pourquoi: null }); }
  const autres = resultats.filter((r) => !pris.has(r.href)).map((r) => ({ ...r, pourquoi: null }));
  const nommer = (l) => ({ ...l, titre: l.titre || l.hote });
  return { liens: liens.map(nommer), autres: autres.map(nommer), repli };
}
```

Les imports `ANTHROPIC_MESSAGES_URL`, `anthropicHeaders`, `lireBornee`, `signalDelai`, `OPTIONS_FETCH`, `logError` servent à la tâche 4 ; les laisser (le linter du projet n'existe pas ; un commentaire « tâche 4 » n'est pas nécessaire).

- [ ] **Step 4 : `sw.js`** : l. 4 `VERSION = 'cuisine-os-v0.5.0-3'` ; l. 17, après `'./src/domain/quantity.js',` insérer `'./src/domain/recherche-web.js',` (ordre alphabétique).

- [ ] **Step 5 : Lancer la suite : vert sauf le total ; poser le total ; relancer ; commit**

```bash
cd ~/projects/mistu-web && git add src/domain/recherche-web.js sw.js tests/recherche-web.js tests/tests.js
git commit -m "recherche-web.js : demande, corps de requete, lecture typee de la reponse, choix des liens parmi les resultats bruts (tache 3)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4 : `chercherRecettesWeb` — réseau injecté, délai, abandon, classement des issues

**Files:**
- Modify: `src/domain/recherche-web.js` (ajout en fin de fichier)
- Modify: `sw.js:4` (VERSION -4)
- Test: `tests/recherche-web.js`

**Interfaces:**
- Consumes: tout de la tâche 3 ; `anthropicHeaders`, `ANTHROPIC_MESSAGES_URL` (tâche 2) ; `lireBornee`, `signalDelai`, `OPTIONS_FETCH` (tâche 1).
- Produces: `chercherRecettesWeb({ q, filtres, langue, cfg }, deps = { fetch, enLigne, tentativeMs, corpsMax, corpsErreurMax, fuseau, signal }) → Promise<{ autres, etat: 'non_configure'|'non_pris_en_charge'|'indisponible'|'rien'|'trouve', raison: null|'requete'|'hors_ligne'|'annule'|'delai'|'reseau'|'cle_refusee'|'recherche_desactivee'|'trop_de_demandes'|'serveur'|'reponse_illisible'|'refus'|'outil'|'interrompu'|'pas_cherche'|'interne', liens, repli, recherches, modele }>` — **ne lève jamais**.

- [ ] **Step 1 : Écrire les tests rouges (§ 9.4)**

```js
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
```

- [ ] **Step 2 : Lancer la suite, vérifier le rouge** (« appel : … », `chercherRecettesWeb is not a function`).

- [ ] **Step 3 : Ajouter `chercherRecettesWeb` à la fin de `src/domain/recherche-web.js`**

```js
function fuseauAppareil() {
  try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; return typeof z === 'string' ? z : ''; } catch { return ''; }
}

// Un 400 peut dire « recherche web non activée sur ce compte » (S12) : lu dans error.message du JSON BORNÉ, jamais
// recopié. Toute autre forme → false (le 400 reste `requete`).
async function rechercheDesactivee(r, max) {
  try {
    const morceaux = await lireBornee(r, max);
    if (morceaux === null) return false;
    const texte = morceaux === false ? await r.text() : await new Blob(morceaux).text();
    if (typeof texte !== 'string' || texte.length > max) return false;
    const msg = String(JSON.parse(texte)?.error?.message ?? '').toLowerCase();
    return /web.?search/.test(msg) && /not enabled|disabled/.test(msg);
  } catch { return false; }
}

// § 4.5 : UN appel, délai et abandon extérieur combinés, classement dans l'ordre du tableau de la spec. Ne lève jamais :
// toute exception inattendue devient `interne` (journal sans aucun champ de cfg — S10/F12).
export async function chercherRecettesWeb({ q, filtres, langue, cfg } = {}, deps = {}) {
  const issue = (etat, raison = null, extra = {}) => ({ etat, raison, liens: [], autres: [], repli: false, recherches: null, modele: typeof cfg?.model === 'string' ? cfg.model : null, ...extra });
  try {
    if (!cfg || typeof cfg !== 'object' || !cfg.provider || cfg.provider === 'none' || !cfg.api_key || !cfg.model) return issue('non_configure');
    if (cfg.provider !== 'anthropic') return issue('non_pris_en_charge');
    const demande = construireDemande({ q, filtres, langue });
    if (!demande.cle) return issue('indisponible', 'requete');
    const enLigne = deps.enLigne ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
    if (!enLigne()) return issue('indisponible', 'hors_ligne');
    if (deps.signal?.aborted) return issue('indisponible', 'annule');
    const f = deps.fetch ?? globalThis.fetch;                 // fonction LIBRE : jamais deps.fetch(...) (Illegal invocation)
    const corpsMax = deps.corpsMax ?? LIMITES_WEB.corps;
    const corpsErreurMax = deps.corpsErreurMax ?? LIMITES_WEB.corpsErreur;
    const fuseau = deps.fuseau ?? fuseauAppareil();
    const ctl = new AbortController();
    const delai = signalDelai(deps.tentativeMs ?? LIMITES_WEB.tentativeMs);
    const relaisDelai = () => ctl.abort();
    const relaisExterne = () => ctl.abort();
    if (delai.aborted) ctl.abort(); else delai.addEventListener('abort', relaisDelai, { once: true });
    deps.signal?.addEventListener('abort', relaisExterne, { once: true });
    const motifAbandon = () => (deps.signal?.aborted ? 'annule' : 'delai');
    try {
      let r;
      try {
        // redirect: 'error' — l'en-tête x-api-key ne doit JAMAIS suivre une redirection vers un autre hôte (I-C).
        r = await f(ANTHROPIC_MESSAGES_URL, { ...OPTIONS_FETCH, method: 'POST', redirect: 'error', headers: anthropicHeaders(cfg.api_key), body: JSON.stringify(corpsRequete({ cfg, demande, fuseau })), signal: ctl.signal });
      } catch { return issue('indisponible', ctl.signal.aborted ? motifAbandon() : 'reseau'); }
      if (!r || typeof r.status !== 'number') return issue('indisponible', 'interne');
      if (r.status === 401 || r.status === 403) return issue('indisponible', 'cle_refusee');
      if (r.status === 429) return issue('indisponible', 'trop_de_demandes');
      if (r.status === 400) return issue('indisponible', (await rechercheDesactivee(r, corpsErreurMax)) ? 'recherche_desactivee' : 'requete');
      if (r.status >= 400 && r.status < 500) return issue('indisponible', 'requete');
      if (r.status >= 500) return issue('indisponible', 'serveur');
      let texte;
      try {
        const morceaux = await lireBornee(r, corpsMax);
        if (morceaux === null) return issue('indisponible', 'reponse_illisible');
        texte = morceaux === false ? await r.text() : await new Blob(morceaux).text();
      } catch { return issue('indisponible', ctl.signal.aborted ? motifAbandon() : 'reseau'); }
      if (typeof texte !== 'string' || texte.length > corpsMax) return issue('indisponible', 'reponse_illisible');
      let json;
      try { json = JSON.parse(texte); } catch { return issue('indisponible', 'reponse_illisible'); }
      if (!json || typeof json !== 'object' || !Array.isArray(json.content)) return issue('indisponible', 'reponse_illisible');
      const lu = lireReponse(json);
      const avec = { recherches: lu.recherches };
      if (lu.stopReason === 'refusal') return issue('indisponible', 'refus', avec);
      if (lu.resultats.length === 0) {
        if (lu.erreursOutil.includes('too_many_requests')) return issue('indisponible', 'trop_de_demandes', avec);
        if (lu.erreursOutil.length) return issue('indisponible', 'outil', avec);
        if (lu.stopReason === 'pause_turn' || lu.stopReason === 'max_tokens') return issue('indisponible', 'interrompu', avec);
        if (!lu.aCherche) return issue('indisponible', 'pas_cherche', avec);
        return issue('rien', null, avec);
      }
      const { liens, autres, repli } = choisirLiens(lu);
      return issue('trouve', null, { ...avec, liens, autres, repli });
    } finally {
      delai.removeEventListener('abort', relaisDelai);
      deps.signal?.removeEventListener('abort', relaisExterne);
    }
  } catch (e) {
    logError('web_recherche', { reason: 'interne', error: e });
    return issue('indisponible', 'interne');
  }
}
```

- [ ] **Step 4 : `sw.js` l. 4 → `cuisine-os-v0.5.0-4`. Lancer la suite : vert sauf le total ; poser ; relancer ; commit**

```bash
cd ~/projects/mistu-web && git add src/domain/recherche-web.js sw.js tests/recherche-web.js tests/tests.js
git commit -m "chercherRecettesWeb : un appel, delai et abandon, classement des issues, jamais la cle dans l issue (tache 4)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 : `components.js` — `libellePuce` exporté (une seule définition du texte d'une puce)

**Files:**
- Modify: `src/ui/components.js:122-134` (chipLabel), `:136-139` (filterChips)
- Modify: `sw.js:4` (VERSION -5)
- Test: `tests/recherche-web.js`

**Interfaces:**
- Produces: `export function libellePuce(chip, ingredientsById) → string` (= l'actuel `chipLabel`, renommé et exporté ; `filterChips` l'appelle).

- [ ] **Step 1 : Tests rouges**

```js
  // --- § 7.3 libellePuce : la même définition pour la puce affichée et pour la demande envoyée (I-J, F1)
  {
    const C = await import('../src/ui/components.js');
    const { chipsFor, parseQuery } = await import('../src/domain/search.js');
    const ing = new Map([['ing_cucumber', { labels: { fr: { label: 'concombre' } } }]]);
    const chips = chipsFor(parseQuery('une salade avec du concombre, sans gluten, en quinze minutes').filters);
    const textes = chips.map((c) => C.libellePuce(c, ing));
    ok(textes.includes('Salade') && textes.includes('Sans gluten') && textes.includes('avec concombre') && textes.some((x) => x.includes('15 min')), 'puces : libellePuce rend type, restriction, ingrédient (libellé fr) et durée comme la puce affichée');
    eq(C.libellePuce({ kind: 'include', value: 'ing_inconnu' }, ing), 'avec ing_inconnu', 'puces : un ingrédient sans libellé rend son id');
    eq(C.libellePuce({ kind: 'exclude_text', value: 'noix' }, ing), 'sans « noix »', 'puces : exclude_text tel quel');
    const rendu = C.filterChips(chips, ing, () => {});
    eq([...rendu.querySelectorAll('.chip')].map((n) => n.textContent), textes, 'puces : filterChips rend EXACTEMENT les textes de libellePuce (une seule définition)');
  }
```

- [ ] **Step 2 : Rouge** (`libellePuce is not a function`).

- [ ] **Step 3 : Implémenter** : renommer `chipLabel` en `libellePuce` et l'exporter (`export function libellePuce(chip, ingredientsById) { … }`), remplacer l'appel dans `filterChips` (`libellePuce(c, ingredientsById)`). Vérifier qu'aucun autre fichier n'importe `chipLabel` : `grep -rn "chipLabel" src/` → seule la définition et `filterChips`.

- [ ] **Step 4 : `sw.js` → `-5`. Suite verte ; total ; commit**

```bash
cd ~/projects/mistu-web && git add src/ui/components.js sw.js tests/recherche-web.js tests/tests.js
git commit -m "components.js : libellePuce exporte, une seule definition du texte d une puce (tache 5)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 : `search.js` — état de module, garde du fournisseur, écran du bouton, tape, vol, « Annuler », filet

**Files:**
- Modify: `src/ui/search.js` (imports l. 2-9, signature l. 13, bloc `if (state.mode === 'web')` l. 59-62, fonctions neuves)
- Modify: `sw.js:4` (VERSION -6)
- Test: `tests/recherche-web.js`

**Interfaces:**
- Consumes: `chercherRecettesWeb`, `construireDemande` (tâches 3-4) ; `providerFrom` (tâche 2) ; `libellePuce` (tâche 5) ; `borner` (tâche 1) ; `getUiLocale`, `t` (`core/i18n.js`) ; `chipsFor`, `parseQuery` (`domain/search.js`) ; `buildQuery`, `navigate` (`core/router.js`) ; `section`, `select`… (`components.js`).
- Produces: `renderSearch(params, query, ctx, deps = { chercher, enLigne, navigate })` ; `export function etatWeb() → { cle, enCours, memoire: { cle, etat } | null }` ; `export function reinitialiserWeb()` ; état de module `memoire = { cle, issue, q, filtres } | null`, `vol = { cle, controller, promesse } | null`, `vues: Set<{ root, redessiner }>`. La tâche 7 ajoute `renderIssue` (rendu de `trouve`/`rien`/`indisponible`) ; dans cette tâche, une issue en mémoire rend un simple `div.status` « Résultat reçu. » **provisoire**, remplacé en tâche 7.

- [ ] **Step 1 : Tests rouges (première moitié de § 9.5 : garde, bouton, tape, vol, annulation, filet, nouvelle instance)**

```js
  // --- § 5.1-5.4 écran du mode Web : état de module, garde, tape, vol, annulation, filet
  {
    const S = await import('../src/ui/search.js');
    const vraiFetch = globalThis.fetch;
    let appelsReseau = 0;
    globalThis.fetch = async (u) => { appelsReseau += 1; throw new Error(`aucun reseau attendu ici : ${u}`); };
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    try {
      const ctxDe = (llm) => ({ docs: [], docsByRecipe: new Map(), ingredientsById: new Map(), meal_feedback: [], settings: { llm } });
      const ANTH = { provider: 'anthropic', api_key: 'k', model: 'm' };
      const pilote = () => { const p = {}; p.promesse = new Promise((res) => { p.resoudre = res; }); return p; };
      const tick = () => new Promise((r) => setTimeout(r, 0)); // un tour de boucle : les .then de lancer() ont tourné
      const monter = async (query, ctx, deps) => { const root = await S.renderSearch({}, { mode: 'web', ...query }, ctx, deps); scene.append(root); return root; };
      const texte = (root) => root.textContent;
      const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
      const champ = (root) => root.querySelector('input[type="search"]');
      const taper = (root, v) => { champ(root).value = v; champ(root).dispatchEvent(new Event('input', { bubbles: true })); };
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
        taper(root, 'saumon fenouil');
        eq(b.disabled, false, 'bouton : la frappe ouvre le bouton sans Entrée ni redessin');
        taper(root, '\u{200B}');
        eq(b.disabled, true, 'bouton : une saisie faite de Cf laisse le bouton éteint (même règle que construireDemande)');
        taper(root, 'saumon fenouil sans gluten');
        b.click();
        await tick();
        eq(appels.length, 1, 'tape : un appel');
        eq([appels[0].a.q, appels[0].a.filtres, appels[0].a.langue, appels[0].a.cfg], ['saumon fenouil sans gluten', ['Sans gluten'], 'fr', ANTH], 'tape : la demande est le CHAMP relu tel quel (q brut), la puce comprise en TEXTE « Sans gluten », la langue, la cfg (I-J)');
        ok(appels[0].d.signal instanceof AbortSignal && typeof appels[0].d.enLigne === 'undefined', 'tape : un signal est passé ; enLigne n’est pas forcé à la tape');
        const e = S.etatWeb();
        eq([e.enCours, typeof e.cle, e.memoire], [true, 'string', null], 'tape : etatWeb dit un vol en cours, rien en mémoire');
        const statut = root.querySelector('[role="status"]');
        ok(statut && statut.textContent.includes('L’assistant cherche sur le web…'), 'vol : écran « en cours » avec role=status (F20)');
        ok(bouton(root, 'Chercher sur le web avec l’assistant')?.disabled === true && !!bouton(root, 'Annuler'), 'vol : bouton éteint, « Annuler » présent');
        // Annuler (§ 5.4.6)
        bouton(root, 'Annuler').click();
        eq([appels[0].d.signal.aborted, S.etatWeb().enCours, S.etatWeb().memoire, !!bouton(root, 'Chercher sur le web avec l’assistant')], [true, false, null, true], 'annuler : signal abandonné, plus de vol, mémoire intacte, écran du bouton');
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
        // le bouton de r2 est éteint pendant le vol : la seconde tape passe par « Annuler » puis le bouton
        bouton(r2, 'Annuler').click();
        bouton(r2, 'Chercher sur le web avec l’assistant').click();
        await tick();
        eq([appels.length, appels[0].aborted, appels[1].aborted], [2, true, false], 'instance 2 : deux appels, le premier abandonné (I-I)');
        p1.resoudre({ ...issueTrouve, liens: [{ ...issueTrouve.liens[0], titre: 'TARDIF' }] });
        await tick();
        eq(S.etatWeb().memoire, null, 'instance 2 : la réponse tardive du vol 1 n’écrit rien');
        p2.resoudre(issueTrouve);
        await tick();
        eq([S.etatWeb().enCours, S.etatWeb().memoire?.etat], [false, 'trouve'], 'instance 2 : la réponse du vol 2 est en mémoire');
        ok(!texte(r2).includes('TARDIF'), 'instance 2 : l’écran ne montre rien du vol 1');
        r2.remove();
      }
      // Filet (§ 5.4.5, F12)
      {
        S.reinitialiserWeb();
        const root = await monter({ q: 'saumon' }, ctxDe(ANTH), { chercher: async () => { throw new TypeError('bogue'); }, navigate: () => {} });
        bouton(root, 'Chercher sur le web avec l’assistant').click();
        await new Promise((r) => setTimeout(r, 0));
        eq([S.etatWeb().enCours, S.etatWeb().memoire?.etat], [false, 'indisponible'], 'filet : un chercher qui lève → indisponible en mémoire, plus de vol (jamais d’écran figé)');
        root.remove();
      }
      eq(appelsReseau, 0, 'écran web : aucun appel réseau réel pendant ces tests');
    } finally { globalThis.fetch = vraiFetch; scene.remove(); S.reinitialiserWeb(); }
  }
```

- [ ] **Step 2 : Rouge** (`reinitialiserWeb is not a function`, textes absents).

- [ ] **Step 3 : Implémenter dans `src/ui/search.js`**

Imports (remplacer les l. 2-9 par) :

```js
import { el } from '../core/dom.js';
import { t, label, getUiLocale } from '../core/i18n.js';
import { navigate, buildQuery } from '../core/router.js';
import { borner } from '../core/bornes.js';
import { lienSignet } from '../core/lien.js';
import { parseQuery, searchDocs, chipsFor } from '../domain/search.js';
import { findAccompaniments } from '../domain/pairing.js';
import { providerFrom } from '../domain/llm.js';
import { chercherRecettesWeb, construireDemande } from '../domain/recherche-web.js';
import { RECIPE_TYPES, DIET_TAGS } from '../model/schema.js';
import { recipeCard, filterChips, libellePuce, segmented, emptyState, section, availabilityBadge, provenanceText, select } from './components.js';
import { addToMealFlow } from './meals.js';
```

Après `const MODES = …` :

```js
// --- Recherche web : état AU NIVEAU DU MODULE (spec Web § 5.1). run() navigue en `replace`, donc chaque Entrée,
// changement de mode ou de case ré-instancie la route : un état d'instance ne survit pas. Ici vivent la dernière issue
// (mémoire VIVE, jamais en base — I-G), sous la clé exacte de la demande qui l'a produite, et l'UNIQUE appel en vol de
// l'app (I-I). Les instances sont des vues : elles s'abonnent, et sont oubliées dès que leur racine quitte le document.
let memoire = null; // { cle, issue, q, filtres }
let vol = null;     // { cle, controller, promesse }
const vues = new Set(); // { root, redessiner }
export function etatWeb() { return { cle: vol?.cle ?? null, enCours: !!vol, memoire: memoire ? { cle: memoire.cle, etat: memoire.issue.etat } : null }; }
export function reinitialiserWeb() { vol?.controller.abort(); vol = null; memoire = null; vues.clear(); } // tests seulement
function notifier() { for (const v of [...vues]) { if (!v.root.isConnected) { vues.delete(v); continue; } v.redessiner(); } }
const ISSUE_INTERNE = { etat: 'indisponible', raison: 'interne', liens: [], autres: [], repli: false, recherches: null, modele: null };
```

Signature : `export async function renderSearch(params, query, ctx, deps = {}) {` et, juste après `const root = el('div', null);` :

```js
  const { chercher = chercherRecettesWeb, enLigne, navigate: nav = navigate } = deps;
```

Après `input.addEventListener('keydown', …)` (l. 22), ajouter l'ouverture du bouton pendant la frappe :

```js
  input.addEventListener('input', () => { const b = root.querySelector('[data-role="chercher-web"]'); if (b) b.disabled = !borner(input.value, 500).trim(); });
```

Remplacer le bloc `if (state.mode === 'web') { … return; }` (l. 59-62) par :

```js
    if (state.mode === 'web') { results.append(renderWeb()); return; }
```

Avant `render();` (l. 96), ajouter les fonctions de la recherche web (closures sur `state`, `input`, `ctx`, `deps`) :

```js
  // --- Recherche web (spec Web § 5)
  const textesDesPuces = () => chipsFor(state.parsed.filters).map((c) => libellePuce(c, ctx.ingredientsById));
  const demandeCourante = () => construireDemande({ q: state.q, filtres: textesDesPuces(), langue: getUiLocale() });
  const requeteRoute = () => '/search' + buildQuery({ q: state.q, mode: state.mode, fav: state.favorites ? 1 : '', cooked: state.cooked ? 1 : '', any: state.requireAll ? '' : 1, for: query.for || '', role: role || '' });
  // § 5.4 : le champ est RELU s'il a changé depuis la dernière analyse (I-J) — s'il n'a pas changé, les puces ajoutées
  // par les listes « + type » / « + restriction » ou retirées à la main RESTENT ce qu'elles sont à l'écran (R-WEB-2 : une
  // relecture inconditionnelle les écrasait). Puis le vol précédent est abandonné (I-I), le nouveau posé au module, et la
  // route rejouée en replace (elle se ré-instancie et retrouve le vol par sa clé). « Réessayer » passe { enLigne: () => true }.
  const lancer = (depsForces = {}) => {
    const champ = input.value.trim();
    if (champ !== state.q) { state.q = champ; state.parsed = parseQuery(champ); if (forRecipe && role) state.parsed.filters.type = role; }
    const demande = demandeCourante();
    if (!demande.cle) { render(); return; }
    vol?.controller.abort();
    const controller = new AbortController();
    const cle = demande.cle; const q = demande.q; const filtres = demande.filtres; // nettoyés : ce qui part (R-WEB-1)
    const promesse = Promise.resolve()
      .then(() => chercher({ q, filtres, langue: getUiLocale(), cfg: ctx.settings?.llm }, { enLigne, signal: controller.signal, ...depsForces }))
      .catch(() => ISSUE_INTERNE)
      .then((issue) => {
        if (vol?.promesse !== promesse) return;           // abandonné ou remplacé : muet
        vol = null;
        if (issue?.raison !== 'annule') memoire = { cle, issue: issue && typeof issue === 'object' ? issue : ISSUE_INTERNE, q, filtres };
        notifier();
      });
    vol = { cle, controller, promesse };
    nav(requeteRoute(), { replace: true });
    render();
  };
  const annuler = () => { vol?.controller.abort(); vol = null; render(); };
  function renderWeb() {
    for (const v of [...vues]) if (!v.root.isConnected) vues.delete(v); // borné en permanence, pas seulement à la résolution d'un vol
    vues.add({ root, redessiner: render });
    const fournisseur = providerFrom(ctx.settings);
    const reglages = () => el('a', { class: 'btn small', href: '#/settings' }, t('Réglages'));
    if (!fournisseur.configured) return el('div', { class: 'status warn' }, t('Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'), ' ', reglages());
    if (!fournisseur.supportsWebSearch) return el('div', { class: 'status warn' }, t('Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.'), ' ', reglages());
    const cle = demandeCourante().cle;
    const boutonChercher = (eteint) => el('button', { class: 'btn primary', dataset: { role: 'chercher-web' }, disabled: eteint, onClick: () => lancer() }, t('Chercher sur le web avec l’assistant')); // data-role : rouvert par la frappe (§ 5.3)
    if (vol && vol.cle === cle) {
      return el('div', { class: 'card flat stack' },
        el('div', { class: 'status', role: 'status' }, t('L’assistant cherche sur le web…')),
        // Sans data-role : l'écouteur de frappe ne doit PAS rouvrir ce bouton pendant le vol.
        el('div', { class: 'row' }, el('button', { class: 'btn primary', disabled: true }, t('Chercher sur le web avec l’assistant')), el('button', { class: 'btn', onClick: annuler }, t('Annuler'))));
    }
    if (memoire) return renderIssue(memoire.issue, reglages, { demandeDiffere: memoire.cle !== cle }); // K1 : les liens restent ; la différence est dite
    const demandeVide = !borner(input.value, 500).trim();
    return el('div', { class: 'card flat stack' },
      boutonChercher(demandeVide),
      el('small', { class: 'muted' }, t('Une recherche = un appel à ton compte Anthropic.')),
      demandeVide ? el('small', { class: 'muted' }, t('Écris d’abord ce que tu cherches.')) : null);
  }
  // Provisoire (tâche 6) : la tâche 7 remplace ce corps par le rendu des issues (§ 5.5-5.6).
  function renderIssue(issue, reglages, { demandeDiffere = false } = {}) {
    if (issue.etat === 'non_configure') return el('div', { class: 'status warn' }, t('Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'), ' ', reglages());
    if (issue.etat === 'non_pris_en_charge') return el('div', { class: 'status warn' }, t('Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.'), ' ', reglages());
    return el('div', { class: 'status' }, 'Résultat reçu.');
  }
```

Note : `vues.add({ root, redessiner: render })` à chaque `renderWeb()` ajoute un objet par redessin ; `notifier()` les purge dès que `root` n'est plus connecté et appelle `render` autant de fois qu'il y a d'entrées vivantes pour la même racine. Pour n'en garder qu'une par racine, remplacer par :

```js
    if (![...vues].some((v) => v.root === root)) vues.add({ root, redessiner: render });
```

(utiliser cette forme).

- [ ] **Step 4 : `sw.js` → `-6`. Suite : vert sauf total ; poser ; relancer ; commit**

```bash
cd ~/projects/mistu-web && git add src/ui/search.js sw.js tests/recherche-web.js tests/tests.js
git commit -m "search.js : etat de module de la recherche web, garde du fournisseur, bouton, tape, vol unique, Annuler, filet (tache 6)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7 : `search.js` — rendu des issues (`trouve`, `rien`, `indisponible`), « Garder ce lien », mémoire par clé

**Files:**
- Modify: `src/ui/search.js` (`renderIssue`)
- Modify: `sw.js:4` (VERSION -7)
- Test: `tests/recherche-web.js`

**Interfaces:**
- Consumes: tout de la tâche 6 ; `lienSignet` ; `section` (`components.js`) ; `buildQuery`.
- Produces: `renderIssue(issue, reglages)` complet (§ 5.5-5.6) ; textes `t()` du § 8.

- [ ] **Step 1 : Tests rouges (seconde moitié de § 9.5)**

```js
  // --- § 5.5-5.6 écran du mode Web : issues, Garder ce lien, mémoire par clé de demande
  {
    const S = await import('../src/ui/search.js');
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async (u) => { throw new Error(`aucun reseau attendu ici : ${u}`); };
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    try {
      const ctxDe = (llm) => ({ docs: [], docsByRecipe: new Map(), ingredientsById: new Map(), meal_feedback: [], settings: { llm } });
      const ANTH = { provider: 'anthropic', api_key: 'k', model: 'm' };
      const monter = async (query, ctx, deps) => { const root = await S.renderSearch({}, { mode: 'web', ...query }, ctx, deps); scene.append(root); return root; };
      const texte = (root) => root.textContent;
      const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
      const tick = () => new Promise((r) => setTimeout(r, 0));
      // Tape, laisse lancer() appeler chercher (qui pose appels.rendre), résout l'issue, laisse la mémoire et le redessin se poser.
      const tapeEtAttend = async (root, issue) => { bouton(root, 'Chercher sur le web avec l’assistant').click(); await tick(); appels.rendre(issue); await tick(); };
      const liens = [{ href: 'https://a.test/r?x=1', hote: 'a.test', titre: '<b>Saumon</b> au fenouil', date: 'May 1, 2026', pourquoi: 'Fenouil et saumon.' }, { href: 'https://b.test/', hote: 'b.test', titre: 'b.test', date: null, pourquoi: null }];
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
      eq([...a].map((n) => [n.getAttribute('href'), n.textContent]), [['https://a.test/r?x=1', '<b>Saumon</b> au fenouil'], ['https://b.test/', 'b.test']], 'trouve : un lien par résultat, href exact, titre en TEXTE littéral (I-H, Review Focus 3)');
      eq(root.querySelectorAll('b').length, 0, 'trouve : aucun élément créé par un titre hostile');
      ok(texte(root).includes('a.test · May 1, 2026') && texte(root).includes('Fenouil et saumon.'), 'trouve : hôte, date, pourquoi');
      ok(texte(root).includes('Trouvé sur le web') && texte(root).includes('Demande envoyée : saumon fenouil'), 'trouve : titre de section et demande envoyée (I-J)');
      // R-WEB-1 : une saisie avec un caractère de format (U+200B) est nettoyée AVANT l'envoi ; l'écran rappelle la demande partie
      {
        const r0 = await monter({ q: 'saumon\u{200B} fenouil' }, ctx, { chercher, navigate: () => {} });
        const n = appels.n;
        bouton(r0, 'Chercher sur le web avec l’assistant').click(); await tick();
        eq(appels.args[appels.args.length - 1].q, 'saumon\u{200B} fenouil', 'tape : q brut passé au module (le module nettoie)');
        appels.rendre(trouve); await tick();
        ok(texte(r0).includes('Demande envoyée : saumon fenouil') && !texte(r0).includes('\u{200B}'), 'trouve : la demande rappelée est celle qui est PARTIE, nettoyée (R-WEB-1)');
        eq(appels.n, n + 1, 'tape : un seul appel pour cette saisie');
        r0.remove();
      }
      ok(texte(root).includes('L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.'), 'trouve : l’avertissement fixe est TOUJOURS là (I-K, S1)');
      ok(texte(root).includes('Recherches faites par l’assistant : 2') && !texte(root).includes('Liens tels que trouvés'), 'trouve : compte des recherches ; pas de ligne repli');
      // lancer() a déjà navigué une fois (replace vers /search?…) : on compte les navigations vers le signet, pas le total.
      const avantGarder = navs.filter((p) => p.startsWith('/add/signet')).length;
      [...root.querySelectorAll('button')].find((b) => b.textContent === 'Garder ce lien').click();
      const versSignet = navs.filter((p) => p.startsWith('/add/signet'));
      eq([avantGarder, versSignet.length], [0, 1], 'garder : une seule navigation vers le signet, après le clic seulement');
      { const [chemin, qs] = versSignet[0].split('?'); const p = new URLSearchParams(qs); eq([chemin, p.get('adresse'), p.get('titre')], ['/add/signet', 'https://a.test/r?x=1', '<b>Saumon</b> au fenouil'], 'garder : route signet préremplie, adresse et titre encodés'); }
      ok(!!bouton(root, 'Chercher à nouveau'), 'trouve : « Chercher à nouveau » présent');
      // Mémoire par clé (F13/S5/F20) : une nouvelle instance avec la même demande montre les liens SANS appel
      root.remove();
      const nAvant = appels.n;
      root = await monter({ q: 'saumon fenouil' }, ctx, { chercher, navigate: () => {} });
      eq([appels.n, root.querySelectorAll('a[target="_blank"]').length], [nAvant, 2], 'mémoire : même demande, nouvelle instance → les liens, aucun appel (F3/F20)');
      // Puce ajoutée → clé différente → liens cachés, mémoire intacte ; puce retirée → liens de retour (Review Focus 2)
      const selects = root.querySelectorAll('select');
      const restriction = [...selects].find((s) => [...s.options].some((o) => o.textContent === '+ restriction'));
      restriction.value = 'sans_gluten'; restriction.dispatchEvent(new Event('change'));
      eq([root.querySelectorAll('a[target="_blank"]').length, texte(root).includes('La demande a changé depuis cette recherche.'), appels.n], [2, true, nAvant], 'puce : ajoutée → les liens RESTENT, la mention « la demande a changé » apparaît, aucun appel (K1)');
      [...root.querySelectorAll('.chip.removable')].find((c) => c.textContent === 'Sans gluten').click();
      eq([root.querySelectorAll('a[target="_blank"]').length, texte(root).includes('La demande a changé depuis cette recherche.'), appels.n], [2, false, nAvant], 'puce : retirée → la mention disparaît, aucun appel');
      // R-WEB-2 : un filtre ajouté par la liste, champ inchangé, PART avec la tape (il n'est pas écrasé par une relecture du champ)
      restriction.value = 'sans_gluten'; restriction.dispatchEvent(new Event('change'));
      { const n = appels.n; bouton(root, 'Chercher à nouveau').click(); await tick(); const dernier = appels.args[appels.args.length - 1]; eq([appels.n, dernier.q, dernier.filtres], [n + 1, 'saumon fenouil', ['Sans gluten']], 'tape : le filtre ajouté par la liste part avec la demande, le champ inchangé n’est pas réanalysé (R-WEB-2)'); appels.rendre(trouve); await tick(); }
      // R-WEB-3 : un « trouvé » dont aucune adresse ne survit à la revalidation au rendu replie sur l'écran « rien »
      root.remove(); S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { ...trouve, liens: [{ ...liens[0], href: 'javascript:alert(1)' }] });
      ok(!texte(root).includes('Trouvé sur le web') && texte(root).includes('Aucune page trouvée pour cette demande.'), 'trouve sans carte : pas de titre vide, écran « rien » (R-WEB-3)');
      // K2 : les autres pages trouvées, repliées, jamais mêlées aux choix
      root.remove(); S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { ...trouve, autres: [{ href: 'https://c.test/x', hote: 'c.test', titre: 'C', date: null, pourquoi: null }] });
      { const d = root.querySelector('details'); eq([d?.querySelector('summary')?.textContent, d?.open, d?.querySelectorAll('a[target="_blank"]').length, root.querySelectorAll('a[target="_blank"]').length], ['Autres pages trouvées (1)', false, 1, 3], 'autres : repliées sous « Autres pages trouvées (1) », avec leur lien (K2)'); }
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
      // rien + Réessayer force enLigne (S9)
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { etat: 'rien', raison: null, liens: [], repli: false, recherches: 1, modele: 'm' });
      ok(texte(root).includes('Aucune page trouvée pour cette demande. Reformule ou cherche autrement.') && !!bouton(root, 'Réessayer'), 'rien : texte + Réessayer');
      { const n = appels.n; bouton(root, 'Réessayer').click(); await tick(); eq([appels.n, appels.deps[appels.deps.length - 1].enLigne()], [n + 1, true], 'réessayer : rappelle chercher avec enLigne forcé à vrai (S9)'); appels.rendre(trouve); await tick(); }
      root.remove();
      // indisponible × 8
      const CAS = [['hors_ligne', 'Tu es hors ligne.', true, false, false], ['cle_refusee', 'Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.', false, true, false], ['recherche_desactivee', 'La recherche web n’est pas activée sur ton compte Anthropic.', false, true, false], ['trop_de_demandes', 'Trop de demandes pour l’instant. Réessaie dans une minute.', true, false, false], ['refus', 'L’assistant a refusé cette demande.', false, false, false], ['pas_cherche', 'L’assistant n’a pas cherché sur le web. Réessaie.', true, false, false], ['delai', 'L’assistant n’a pas répondu. Réessaie.', true, false, true], ['interne', 'L’assistant n’a pas répondu. Réessaie.', true, false, true]];
      for (const [raison, attendu, reessai, reglages, code] of CAS) {
        S.reinitialiserWeb();
        root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
        await tapeEtAttend(root, { etat: 'indisponible', raison, liens: [], repli: false, recherches: null, modele: 'm' });
        const statut = root.querySelector('.status.warn[role="status"]');
        eq([statut?.textContent.includes(attendu), !!bouton(root, 'Réessayer'), !!root.querySelector('a[href="#/settings"]'), texte(root).includes('Code : ' + raison)], [true, reessai, reglages, code], `indisponible/${raison} : texte, Réessayer=${reessai}, Réglages=${reglages}, code=${code} (K3)`);
        root.remove();
      }
      // Réglage changé pendant le vol (Review Focus 5) : l'issue non_configure se rend avec le texte de la garde
      S.reinitialiserWeb();
      root = await monter({ q: 'saumon' }, ctx, { chercher, navigate: () => {} });
      await tapeEtAttend(root, { etat: 'non_configure', raison: null, liens: [], repli: false, recherches: null, modele: null });
      ok(texte(root).includes('Pour chercher sur le web, configure l’assistant IA') && !!root.querySelector('a[href="#/settings"]'), 'non_configure en issue : texte de la garde + Réglages (F5)');
      root.remove();
      ok(!(await (async () => (await fetch('../src/ui/search.js?v=' + Date.now(), { cache: 'no-store' })).text())()).includes('innerHTML'), 'search.js : aucun innerHTML');
    } finally { globalThis.fetch = vraiFetch; scene.remove(); S.reinitialiserWeb(); }
  }
```

- [ ] **Step 2 : Rouge** (textes absents, « Résultat reçu. »).

- [ ] **Step 3 : Remplacer `renderIssue` dans `src/ui/search.js`**

```js
  const TEXTES_INDISPONIBLE = {
    hors_ligne: 'Tu es hors ligne.',
    cle_refusee: 'Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.',
    recherche_desactivee: 'La recherche web n’est pas activée sur ton compte Anthropic.',
    trop_de_demandes: 'Trop de demandes pour l’instant. Réessaie dans une minute.',
    refus: 'L’assistant a refusé cette demande.',
    pas_cherche: 'L’assistant n’a pas cherché sur le web. Réessaie.',
  };
  const SANS_REESSAI = ['cle_refusee', 'recherche_desactivee', 'refus'];
  const AVEC_REGLAGES = ['cle_refusee', 'recherche_desactivee'];
  // § 5.5-5.6 : chaque issue a son écran ; les liens sont revalidés AU RENDU par lienSignet (I-H) ; l'avertissement
  // I-K accompagne toujours les liens ; aucun texte de l'API n'est rendu hors « pourquoi » (borné en amont).
  function renderIssue(issue, reglages, { demandeDiffere = false } = {}) {
    const reessayer = () => el('button', { class: 'btn', onClick: () => lancer({ enLigne: () => true }) }, t('Réessayer'));
    if (issue.etat === 'non_configure') return el('div', { class: 'status warn' }, t('Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.'), ' ', reglages());
    if (issue.etat === 'non_pris_en_charge') return el('div', { class: 'status warn' }, t('Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.'), ' ', reglages());
    if (issue.etat === 'rien') return el('div', { class: 'card flat stack' }, el('div', { class: 'status', role: 'status' }, t('Aucune page trouvée pour cette demande. Reformule ou cherche autrement.')), reessayer());
    if (issue.etat === 'indisponible') {
      const demandeVide = issue.raison === 'requete' && !state.q;
      const cle = demandeVide ? 'Écris d’abord ce que tu cherches.' : (TEXTES_INDISPONIBLE[issue.raison] || 'L’assistant n’a pas répondu. Réessaie.');
      const generique = !demandeVide && !TEXTES_INDISPONIBLE[issue.raison]; // K3 : le code reste lisible sous le texte générique
      return el('div', { class: 'card flat stack' },
        el('div', { class: 'status warn', role: 'status' }, t(cle), AVEC_REGLAGES.includes(issue.raison) ? [' ', reglages()] : null),
        generique ? el('small', { class: 'muted' }, t('Code : {c}', { c: String(issue.raison || 'inconnu') })) : null,
        SANS_REESSAI.includes(issue.raison) ? null : reessayer());
    }
    // trouve
    const carte = (lien) => {
      const l = lienSignet(lien.href);
      if (!l.ok) return null; // revalidé AU RENDU (I-H) : une adresse refusée ici n'a pas de carte
      const titre = lien.titre || l.hote;
      return el('div', { class: 'card flat stack' },
        el('a', { class: 'btn', href: l.href, target: '_blank', rel: 'noopener noreferrer' }, titre),
        el('div', { class: 'muted', style: { fontSize: '.85rem' } }, lien.date ? `${l.hote} · ${lien.date}` : l.hote),
        lien.pourquoi ? el('div', null, lien.pourquoi) : null,
        el('button', { class: 'btn small', onClick: () => nav('/add/signet' + buildQuery({ adresse: l.href, titre })) }, t('Garder ce lien')));
    };
    const cartes = (Array.isArray(issue.liens) ? issue.liens : []).map(carte).filter(Boolean);
    const autres = (Array.isArray(issue.autres) ? issue.autres : []).map(carte).filter(Boolean); // K2 : repliées, jamais mêlées aux choix
    // R-WEB-3 : un « trouvé » dont aucune carte ne survit à la revalidation ne montre pas un titre sans rien dessous.
    if (!cartes.length) return renderIssue({ ...issue, etat: 'rien' }, reglages);
    const demande = memoire?.filtres?.length ? `${memoire.q} · ${memoire.filtres.join(' ; ')}` : (memoire?.q ?? state.q);
    return section(t('Trouvé sur le web'),
      el('div', { class: 'muted' }, t('Demande envoyée : {q}', { q: demande })),
      demandeDiffere ? el('div', { class: 'status' }, t('La demande a changé depuis cette recherche.')) : null, // K1
      ...cartes,
      autres.length ? el('details', null, el('summary', { class: 'btn' }, t('Autres pages trouvées ({n})', { n: autres.length })), ...autres) : null, // K2
      el('div', { class: 'status' }, t('L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.')),
      issue.recherches != null ? el('small', { class: 'muted' }, t('Recherches faites par l’assistant : {n}', { n: issue.recherches })) : null,
      issue.repli ? el('small', { class: 'muted' }, t('Liens tels que trouvés, sans tri de l’assistant.')) : null,
      el('button', { class: 'btn', onClick: () => lancer() }, t('Chercher à nouveau')));
  }
```

Vérifier la signature de `section` dans `components.js` l. 21 (`section(title, ...children)`) et que `buildQuery` encode par `URLSearchParams` (router.js) — sinon utiliser `encodeURIComponent` explicitement.

- [ ] **Step 4 : `sw.js` → `-7`. Suite verte sauf total ; poser ; relancer ; commit**

```bash
cd ~/projects/mistu-web && git add src/ui/search.js sw.js tests/recherche-web.js tests/tests.js
git commit -m "search.js : rendu des issues trouve/rien/indisponible, Garder ce lien, avertissement restrictions, memoire par cle (tache 7)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8 : `signet.js` — préremplissage par la query, bannière « Adresse reçue » et hôte

**Files:**
- Modify: `src/ui/signet.js:1-20` (imports), `:101-108` (renderSignetRoute)
- Modify: `sw.js:4` (VERSION -8)
- Test: `tests/recherche-web.js`

**Interfaces:**
- Consumes: `borner` (`core/bornes.js`), `lienSignet`, `LIMITES_SIGNET`.
- Produces: `renderSignetRoute(params, query, ctx, deps)` lit `query.adresse` (telle quelle) et `query.titre` (borné) ; bannière `[data-role="adresse-recue"]` avec `strong` = hôte quand `query.adresse` est présent.

- [ ] **Step 1 : Tests rouges (§ 9.6)**

```js
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
        eq([champ(root, 'Adresse *').value.length, root.querySelector('[data-erreur="adresse"]').textContent, garder(root).disabled], [longue.length, 'Adresse trop longue.', true], 'signet prérempli : une adresse trop longue n’est JAMAIS tronquée — refusée (I-A, F9)');
        root = await S.renderSignetRoute({}, { adresse: 'https://exemple.test/r', titre: 't'.repeat(400) + '\u{202E}' }, ctx, deps);
        eq([champ(root, 'Titre *').value.length, champ(root, 'Titre *').value.includes('\u{202E}')], [300, false], 'signet prérempli : titre borné à 300 points de code sans bidi (S2)');
        root = await S.renderSignetRoute({}, {}, ctx, deps);
        eq([banniere(root), champ(root, 'Adresse *').value], [null, ''], 'signet sans query : aucune bannière, champ vide (comportement inchangé)');
      });
    } finally { globalThis.fetch = vraiFetch; }
  }
```

- [ ] **Step 2 : Rouge.**

- [ ] **Step 3 : Implémenter dans `src/ui/signet.js`**

Import : `import { borner } from '../core/bornes.js';` (et vérifier que `lienSignet` est déjà importé/ré-exporté depuis `core/lien.js` l. 19 ; sinon `import { lienSignet } from '../core/lien.js';`). Dans `renderSignetRoute`, remplacer `const etat = { adresse: '', titre: '', … };` et la création de `root` par :

```js
  // § 6 : préremplissage par la query (depuis « Garder ce lien » de la recherche web — ou un lien profond venu de
  // l'extérieur, S4). L'adresse arrive TELLE QUELLE (jamais tronquée : trop longue, signetModel la refuse — I-A/F9) ;
  // le titre est borné par points de code, Cc/Cf retirés (S2). Rien n'est écrit avant « Enregistrer ».
  const recue = typeof query?.adresse === 'string' && query.adresse !== '';
  const etat = { adresse: recue ? query.adresse : '', titre: borner(typeof query?.titre === 'string' ? query.titre : '', LIMITES_SIGNET.titre), editionId: '', cuisines: [], enCours: false };
  …
  const root = el('div', null, pageHeader(t('Garder un lien web'), { back: { href: '/add', label: t('Ajouter') } }));
  if (recue) {
    const lien = lienSignet(etat.adresse);
    root.append(el('div', { class: 'status', dataset: { role: 'adresse-recue' } }, t('Adresse reçue : vérifie-la avant d’enregistrer.'), ' ', el('strong', null, lien.ok ? lien.hote : '')));
  }
```

- [ ] **Step 4 : `sw.js` → `-8`. Suite verte sauf total (vérifier aussi que les tests signet existants de `tests/ajouter.js` restent verts) ; poser ; relancer ; commit**

```bash
cd ~/projects/mistu-web && git add src/ui/signet.js sw.js tests/recherche-web.js tests/tests.js
git commit -m "signet.js : preremplissage par la query, adresse jamais tronquee, titre borne, banniere Adresse recue avec hote (tache 8)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9 : Clôture — dictionnaire `en.js`, statiques, docs, spec § 8/§ 11.2, `STATE.md`

**Files:**
- Modify: `src/i18n/en.js:17` (clé retirée) et fin du fichier (clés neuves)
- Modify: `sw.js:4` (VERSION -9)
- Modify: `docs/architecture.md` (carte des modules + section du lot), `CLAUDE.md` (section du lot), `docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md` (§ 8 VERSION réelle, § 11.2), `STATE.md`
- Test: `tests/recherche-web.js`

- [ ] **Step 1 : Tests rouges (§ 9.8 : chaque texte a sa clé ; la clé morte est retirée)**

```js
  // --- § 8 / § 9.8 dictionnaire et statiques
  {
    const { EN } = await import('../src/i18n/en.js');
    const CLES = ['Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.', 'Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.', 'Chercher sur le web avec l’assistant', 'Une recherche = un appel à ton compte Anthropic.', 'Écris d’abord ce que tu cherches.', 'L’assistant cherche sur le web…', 'Annuler', 'Trouvé sur le web', 'Demande envoyée : {q}', 'Garder ce lien', 'L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.', 'Recherches faites par l’assistant : {n}', 'Liens tels que trouvés, sans tri de l’assistant.', 'Chercher à nouveau', 'Aucune page trouvée pour cette demande. Reformule ou cherche autrement.', 'Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.', 'La recherche web n’est pas activée sur ton compte Anthropic.', 'Trop de demandes pour l’instant. Réessaie dans une minute.', 'L’assistant a refusé cette demande.', 'L’assistant n’a pas cherché sur le web. Réessaie.', 'L’assistant n’a pas répondu. Réessaie.', 'Adresse reçue : vérifie-la avant d’enregistrer.', 'La demande a changé depuis cette recherche.', 'Autres pages trouvées ({n})', 'Réessayer', 'Réglages', 'Tu es hors ligne.', 'Code : {c}'];
    eq(CLES.filter((k) => typeof EN[k] !== 'string' || !EN[k]), [], 'en.js : chaque texte du lot a sa traduction');
    ok(!('Le Web n’est pas activé : aucune source externe n’est configurée. Aucune recherche extérieure n’a été faite.' in EN), 'en.js : la clé morte du mode Web est retirée');
    const lire = async (chemin) => (await fetch(chemin + '?v=' + Date.now(), { cache: 'no-store' })).text();
    ok(!(await lire('../src/ui/search.js')).includes('Le Web n’est pas activé'), 'search.js : la coquille est retirée');
    ok(!/from '\.\.\/ui\//.test(await lire('../src/core/bornes.js')) && !/from '\.\.\/ui\//.test(await lire('../src/domain/recherche-web.js')), 'couches : bornes.js et recherche-web.js n’importent rien de src/ui/');
  }
```

- [ ] **Step 2 : Rouge** (clés manquantes).

- [ ] **Step 3 : `src/i18n/en.js`** : retirer l'entrée de la l. 17 (`'Le Web n’est pas activé : … n’a été faite.': '…'`), et ajouter avant la fermeture `};` :

```js
  "Pour chercher sur le web, configure l’assistant IA : fournisseur Anthropic, modèle et clé.": "To search the web, set up the AI assistant: Anthropic provider, model and key.",
  "Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages → Assistant IA.": "This provider does not search the web. Choose Anthropic in Settings → AI assistant.",
  "Chercher sur le web avec l’assistant": "Search the web with the assistant",
  "Une recherche = un appel à ton compte Anthropic.": "One search = one call billed to your Anthropic account.",
  "Écris d’abord ce que tu cherches.": "Type what you are looking for first.",
  "L’assistant cherche sur le web…": "The assistant is searching the web…",
  "Annuler": "Cancel",
  "Trouvé sur le web": "Found on the web",
  "Demande envoyée : {q}": "Request sent: {q}",
  "Garder ce lien": "Keep this link",
  "L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner.": "The assistant checks neither ingredients nor restrictions: read the page before cooking.",
  "Recherches faites par l’assistant : {n}": "Searches made by the assistant: {n}",
  "Liens tels que trouvés, sans tri de l’assistant.": "Links as found, not sorted by the assistant.",
  "Chercher à nouveau": "Search again",
  "Aucune page trouvée pour cette demande. Reformule ou cherche autrement.": "No page found for this request. Rephrase or search differently.",
  "Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA.": "Your Anthropic key was refused, or lacks this permission. Check it in Settings → AI assistant.",
  "La recherche web n’est pas activée sur ton compte Anthropic.": "Web search is not enabled on your Anthropic account.",
  "Trop de demandes pour l’instant. Réessaie dans une minute.": "Too many requests for now. Try again in a minute.",
  "L’assistant a refusé cette demande.": "The assistant refused this request.",
  "L’assistant n’a pas cherché sur le web. Réessaie.": "The assistant did not search the web. Try again.",
  "L’assistant n’a pas répondu. Réessaie.": "The assistant did not answer. Try again.",
  "Adresse reçue : vérifie-la avant d’enregistrer.": "Address received: check it before saving.",
  "La demande a changé depuis cette recherche.": "The request has changed since this search.",
  "Autres pages trouvées ({n})": "Other pages found ({n})",
```

**Avant d'ajouter** : `grep -n "Annuler\|Réessayer\|'Réglages'\|Tu es hors ligne" src/i18n/en.js` — « Réessayer » (l. 151), « Réglages » (l. 4) et « Tu es hors ligne. » (l. 206) existent déjà ; si « Annuler » existe aussi, ne pas la dupliquer. Le test du step 1 vérifie 28 clés : 24 neuves (dont « Annuler » si elle manquait) + 4 existantes (« Réessayer », « Réglages », « Tu es hors ligne. », « Code : {c} »).

- [ ] **Step 4 : `sw.js` → `cuisine-os-v0.5.0-9`. Suite complète verte ; poser le total ; relancer ; `node --test tools/*.test.mjs` 40/40 ; `--check` 0.**

- [ ] **Step 5 : Docs**
  - `docs/architecture.md` : dans la carte des modules, ajouter `bornes.js` à `src/core/` et `recherche-web.js` à `src/domain/` ; étendre la ligne « Déterministe avant IA » (l. 7) : « … et sur la recherche web, où le texte de l'assistant ne peut qu'étiqueter des pages que le serveur a réellement rapportées » ; ajouter une section « ### Chercher sur le web avec l'assistant (lot du 17 octobre 2026) » après « Identifier un livre, fiable » : état de module de `search.js` (`memoire`, `vol`, `vues`), mur I-A, issues, `core/bornes.js` reçu du lot ISBN, ce qui n'est pas prouvé (appel réel, Safari).
  - `CLAUDE.md` : section « ### Chercher sur le web avec l'assistant (17 octobre 2026) » sur le modèle de « Identifier un livre, fiable » : où (branche, worktree, 8083, spec, plan, registre), ce qui marche (éprouvé par la suite, aucun réseau), ce qui n'est PAS prouvé (aucun appel réel avec la clé de Neegan ; forme réelle de la réponse ; durée ; coût ; Safari/iPhone), dettes (pays `CA` fixe, 45 s, classement du 400 par texte, `vues` purgées par `isConnected`), versions (`APP_VERSION 0.5.0`, `VERSION` réelle, deux modules dans `SHELL`), **gestes de Neegan** (workspace Anthropic dédié à plafond ; pas de clé sur le site public avant D5 ; preuve réelle Mac puis iPhone ; `! git push` après fusion).
  - Spec § 8 : remplacer `cuisine-os-v0.5.0-1` par la `VERSION` réelle ; § 11.2 : une ligne par écart entre la spec et la construction (R-WEB-n, avec son coût si faux) — au moins : **K1-K3** du kit (liens conservés + mention, `autres` repliés, code de la raison) ; **R-WEB-1** `construireDemande` rend aussi `q` et `filtres` nettoyés et l'écran rappelle ceux-là ; **R-WEB-2** la tape ne réanalyse le champ que s'il a changé (les filtres des listes et les puces retirées survivent) ; **R-WEB-3** un « trouvé » sans carte survivante replie sur « rien » ; `libellePuce` = l'ancien `chipLabel` exporté ; `vues` purgées à chaque rendu et dédoublonnées par racine ; « Résultat reçu. » provisoire remplacé en tâche 7 ; tout ce que les tâches ont amendé.
  - `STATE.md` (racine) : réécrire pour l'état de fin de lot (fini, non prouvé, reprendre, gestes de Neegan).

- [ ] **Step 6 : Commit**

```bash
cd ~/projects/mistu-web && git add src/i18n/en.js sw.js tests/recherche-web.js tests/tests.js docs/architecture.md CLAUDE.md docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md STATE.md
git commit -m "Cloture Chercher sur le web : dictionnaire, statiques, docs, spec 8 et 11.2, STATE (tache 9)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Après le plan (hors tâches, par le chef d'orchestre)

1. Revue finale de branche (`reviewer`, lecture seule) puis `/verify` (trois lentilles : correctness, sécurité, faux-vert) ; une vague de corrections rouge d'abord ; spec § 11.2 complétée.
2. Copier `~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/` dans `~/projects/mistu/.superpowers/sdd/` **avant** tout `git worktree remove`.
3. Fusion par Neegan (`cd ~/projects/mistu && git merge --ff-only recherche-web`, ou rebase si `main` a bougé) puis `! git push` ; preuve sur le site public : service worker `cuisine-os-v0.5.0-N` servi, onglet Web → garde « configure l’assistant » sur un navigateur sans clé (0 requête), puis **preuve réelle par Neegan avec sa clé** : « saumon fenouil » → liens, « Garder ce lien » → signet prérempli ; noter durée, nombre de recherches, forme du 400 d'un compte sans recherche web si observable.
4. Gestes hors code de Neegan (spec § 10 R2) : clé d'un workspace Anthropic dédié avec plafond ; pas de clé sur le site public avant D5.
