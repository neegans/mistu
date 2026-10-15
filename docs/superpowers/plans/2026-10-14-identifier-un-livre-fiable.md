# Identifier un livre, fiable — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quand Neegan tape ou scanne un ISBN, l'app remplit la fiche, ou dit la vraie raison (introuvable / service indisponible, motif nommé) et offre « Réessayer » ; un ISBN mal tapé est refusé avant tout appel ; une seule identification à la fois.

**Architecture:** Un module pur `src/core/isbn.js` (validation, conversion 10↔13, filtre du code-barres). Dans `src/ui/livre-ajout.js` : `lookupIsbn` rend un **statut** (`trouve` / `introuvable` / `indisponible` + motif) après Open Library `search.json` (API actuelle, une reprise sur échec muet), Open Library legacy en filet sur un « rien », Google Books seulement avec une clé ; chaque tentative a son budget (`AbortController`) relié au signal extérieur. La route reçoit ses dépendances par un 4ᵉ paramètre `deps` et protège l'écran par une **génération** (une réponse tardive n'écrit rien). Le modèle pur `livreAjoutModel` porte les messages ; le rendu ajoute « Réessayer », Entrée = Identifier, champ en lecture seule pendant la recherche.

**Tech Stack:** PWA sans build, modules ES natifs, pas de npm ; tests dans le navigateur (`tests/index.html` → `tests/ajouter.js`, `eq`/`ok`), bases jetables `withRepo` ; `fetch` injecté partout ; service worker `sw.js` (`SHELL`, `VERSION`).

**Spec:** `docs/superpowers/specs/2026-10-14-identifier-un-livre-fiable-design.md` (rév. 2). Lis-la **en entier** avant ta tâche : le plan en découle, et le registre SDD (`.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/progress.md`) consigne les rulings R-ISBN-n pris en construction.

## Global Constraints

- **Arbre de travail : `~/projects/mistu-isbn` (branche `isbn-fiable`), servi sur `http://localhost:8082/`.** Ne touche JAMAIS `~/projects/mistu` (un autre lot y vit). Si le serveur 8082 ne répond pas : `cd ~/projects/mistu-isbn && nohup python3 -m http.server 8082 > /dev/null 2>&1 &`.
- **Lancer la suite** (sans fenêtre, cache purgé) : `node ~/projects/mistu-isbn/.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/suite.cjs 8082` → imprime `BILAN : ✅ N/N tests réussis` ou `❌` + la liste des échecs (`.ko`) + la console. **Base de départ : 1270/1270**, une seule erreur console préexistante (`Failed to load resource … 404`), à ignorer. **Rouge d'abord** : chaque tâche écrit ses tests, lance la suite, lit le rouge attendu, puis implémente.
- **Aucun réseau dans la suite** : `fetch`, `attendre`, `enLigne`, délais, `cle`, `naviguer` injectés. Un test qui parle à `openlibrary.org` est un défaut.
- **Français, chaînes par `t('…')` avec l'apostrophe typographique ’ (U+2019)**, jamais `'` dans une clé `t()` ; chaque chaîne neuve a son entrée dans `src/i18n/en.js` (clé = chaîne française exacte).
- **`sw.js`** : tout module neuf entre dans `SHELL` ; `VERSION` = `cuisine-os-v0.4.1-N`, **N = numéro de la tâche** (tâche 1 → `-1`, tâche 2 → `-2`, …) dès qu'un fichier servi change (pas pour un commit qui ne touche que `tests/` ou `docs/`). `APP_VERSION = '0.4.1'` dès la tâche 1 ; deux pins à tenir : `tests/ajouter.js` (bloc statique de fin) et `tests/sync-l3.js` (≈ ligne 1864).
- **Commits** : messages **en ASCII sans accents** (le terminal de Neegan déforme l'UTF-8), un commit par tâche au moins, **toujours par fichiers nommés** (`git add <fichiers>`, jamais `git add -A` ni `git add .` : `.superpowers/` est non suivi et doit le rester). Terminer chaque message par `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Pas de `push`, pas de fusion.
- **Pas de `html:`, `innerHTML`, `window.open`** dans `isbn.js` ni `livre-ajout.js` ; tout texte passe par `textContent` via `el()` (`src/core/dom.js`).
- **Invariants de la spec § 3** : I-B (un état d'écran = un événement réel), I-R (reprise seulement sur délai/réseau), I-G (une identification à la fois, génération).
- Le bloc route R-UX-13 de `tests/ajouter.js` (≈ 631-775) est **retouché deux fois** (tâche 2 : ISBN valides + stub `search.json` ; tâche 6 : `deps` à la place de `globalThis.fetch`). Ne le réécris pas davantage que ce que la tâche demande.

## Review Focus

Cinq entrées que la spec implique sans qu'une tâche les ait d'abord nommées ; chacune a maintenant son test dans la tâche qui possède le code :

1. **Open Library répond 200 avec une page HTML** (maintenance derrière un 200) → `JSON.parse` échoue → doit donner `indisponible / serveur`, jamais une exception ni « aucune fiche ». → tâche 2, test « corps non JSON ».
2. **`attenteReelle` face à un signal déjà abandonné ou abandonné en cours** → doit rendre tout de suite, sans minuterie qui traîne. → tâche 2, test `attenteReelle`.
3. **Double clic sur « Réessayer »** → un seul appel (la garde `recherche`). → tâche 6, test « deux Réessayer ».
4. **`first_publish_year` reçu en chaîne (`'2018'`) ou absent** → `year` 2018 ou `null`, jamais `NaN`. → tâche 2, test « année en chaîne ».
5. **Le rappel « ISBN {i} — … » avec placeholder** : la clé `t()` à placeholder doit être dans `en.js` telle quelle (la mécanique F13 extrait le littéral). → tâche 4, entrée `en.js` + test statique existant.

---

### Task 1 : `src/core/isbn.js`, version 0.4.1, pins

**Files:**
- Create: `src/core/isbn.js`
- Modify: `src/ui/livre-ajout.js` (lignes 20 : `nettoyerIsbn` local → import + ré-export)
- Modify: `sw.js` (ligne 4 `VERSION`, liste `SHELL`)
- Modify: `src/model/schema.js` (ligne 6 `APP_VERSION`)
- Modify: `tests/ajouter.js` (bloc « § 5 » ≈ ligne 137 : ajouter les tests ISBN après `const LA = …` ; `MODULES_NEUFS` ≈ 830 ; bloc statique ≈ 861-864)
- Modify: `tests/sync-l3.js` (≈ 1864)

**Interfaces:**
- Produces: `nettoyerIsbn(s) → string` (chiffres et X majuscule seulement) ; `validerIsbn(texte) → { ok: true, isbn13, isbn10 } | { ok: false, motif: 'vide'|'longueur'|'controle'|'pas_isbn' }` ; `codeBarresVersIsbn(codes) → string | null`. `livre-ajout.js` ré-exporte `nettoyerIsbn`.

- [ ] **Step 1 : Écrire les tests (rouge)**

Dans `tests/ajouter.js`, juste après la ligne `const LA = await import('../src/ui/livre-ajout.js');` (≈ 137), insérer :

```js
  // --- § 4 ISBN (spec 2026-10-14-identifier-un-livre-fiable)
  const ISBN = await import('../src/core/isbn.js');
  eq(ISBN.nettoyerIsbn(' 978-2-7619-5000-1 '), '9782761950001', 'isbn : nettoyage = chiffres et X seulement');
  eq(ISBN.nettoyerIsbn('080442957x'), '080442957X', 'isbn : le x minuscule devient X (F23)');
  ok(LA.nettoyerIsbn === ISBN.nettoyerIsbn, 'isbn : livre-ajout ré-exporte la même fonction');
  eq(ISBN.validerIsbn('0306406152'), { ok: true, isbn13: '9780306406157', isbn10: '0306406152' }, 'isbn : ISBN-10 valide → 13 recalculé');
  eq(ISBN.validerIsbn('080442957x'), { ok: true, isbn13: '9780804429573', isbn10: '080442957X' }, 'isbn : contrôle X admis, en majuscule');
  eq(ISBN.validerIsbn('9782890772816'), { ok: true, isbn13: '9782890772816', isbn10: '2890772810' }, 'isbn : 13 → 10 (978)');
  eq(ISBN.validerIsbn('9791234567896'), { ok: true, isbn13: '9791234567896', isbn10: null }, 'isbn : 979 n’a pas de forme à dix chiffres');
  eq(ISBN.validerIsbn('9781785035280'), { ok: false, motif: 'controle' }, 'isbn : chiffre de contrôle faux');
  eq(ISBN.validerIsbn('5901234123457'), { ok: false, motif: 'pas_isbn' }, 'isbn : EAN valide hors 978/979 = pas un ISBN (préfixe lu avant le contrôle)');
  eq(ISBN.validerIsbn('978X785035289'), { ok: false, motif: 'longueur' }, 'isbn : un X dans un 13 → longueur');
  eq(ISBN.validerIsbn('978178503528'), { ok: false, motif: 'longueur' }, 'isbn : douze chiffres');
  eq(ISBN.validerIsbn(' 978-1-78503-528-9 '), { ok: true, isbn13: '9781785035289', isbn10: '1785035282' }, 'isbn : tirets et espaces nettoyés');
  eq(ISBN.validerIsbn(''), { ok: false, motif: 'vide' }, 'isbn : vide');
  eq(ISBN.validerIsbn('12345678X9'), { ok: false, motif: 'longueur' }, 'isbn : X hors dernière position');
  eq(ISBN.codeBarresVersIsbn([{ rawValue: '5901234123457' }, { rawValue: '9781785035289' }]), '9781785035289', 'isbn : le premier code au motif 978/979 est retenu');
  eq(ISBN.codeBarresVersIsbn([]), null, 'isbn : aucun code → null');
  eq(ISBN.codeBarresVersIsbn(null), null, 'isbn : entrée absente → null');
```

Dans le bloc statique de fin (≈ 861-864) : ajouter `'./src/core/isbn.js'` à la liste `SHELL` testée ; remplacer `v0\.4\.0-\d+` par `v0\.4\.1-\d+` et `'0.4.0'` par `'0.4.1'` (deux assertions, libellés mis à jour en « 0.4.1 »). Dans `MODULES_NEUFS` (≈ 830) : ajouter `'../src/core/isbn.js'`. Dans `tests/sync-l3.js` (≈ 1864) : `v0\.4\.0-\d+` → `v0\.4\.1-\d+`.

- [ ] **Step 2 : Lancer la suite, lire le rouge**

Run: `node ~/projects/mistu-isbn/.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/suite.cjs 8082`
Expected: `❌` — « Suite Ajouter interrompue : … isbn.js » (l'import échoue, 404) et les pins `0.4.1` rouges dans `sync-l3`.

- [ ] **Step 3 : Écrire `src/core/isbn.js`**

```js
// ISBN : nettoyage, validation par chiffre de contrôle, conversion 10 ↔ 13, filtre d'un code-barres lu
// (spec « Identifier un livre, fiable » § 4). Module PUR : aucune dépendance, aucun DOM, aucune chaîne t().
export const nettoyerIsbn = (s) => String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();

// ISBN-10 : somme pondérée 10→1 ≡ 0 (mod 11), X = 10 en dernière position.
const controle10Ok = (s) => { let t = 0; for (let i = 0; i < 10; i += 1) t += (10 - i) * (s[i] === 'X' ? 10 : Number(s[i])); return t % 11 === 0; };
const controle10 = (neuf) => { let t = 0; for (let i = 0; i < 9; i += 1) t += (10 - i) * Number(neuf[i]); const r = (11 - (t % 11)) % 11; return r === 10 ? 'X' : String(r); };
// EAN-13 : poids 1,3 alternés sur douze chiffres.
const controleEan = (douze) => { let t = 0; for (let i = 0; i < 12; i += 1) t += Number(douze[i]) * (i % 2 === 0 ? 1 : 3); return String((10 - (t % 10)) % 10); };

export function validerIsbn(texte) {
  const s = nettoyerIsbn(texte);
  if (!s) return { ok: false, motif: 'vide' };
  if (s.length === 10) {
    if (!/^\d{9}[\dX]$/.test(s)) return { ok: false, motif: 'longueur' };
    if (!controle10Ok(s)) return { ok: false, motif: 'controle' };
    const douze = `978${s.slice(0, 9)}`;
    return { ok: true, isbn13: douze + controleEan(douze), isbn10: s };
  }
  if (s.length === 13) {
    if (!/^\d{13}$/.test(s)) return { ok: false, motif: 'longueur' };
    if (!/^97[89]/.test(s)) return { ok: false, motif: 'pas_isbn' }; // le préfixe AVANT le contrôle : un EAN de prix est valide et n'est pas un livre
    if (controleEan(s.slice(0, 12)) !== s[12]) return { ok: false, motif: 'controle' };
    return { ok: true, isbn13: s, isbn10: s.startsWith('978') ? s.slice(3, 12) + controle10(s.slice(3, 12)) : null };
  }
  return { ok: false, motif: 'longueur' };
}

// Le premier code lu qui a la forme d'un ISBN-13 (le lecteur peut voir aussi l'EAN-5 du prix).
export const codeBarresVersIsbn = (codes) => (Array.isArray(codes) ? codes : []).map((c) => String(c?.rawValue ?? '')).find((v) => /^97[89]\d{10}$/.test(v)) || null;
```

Dans `src/ui/livre-ajout.js` : supprimer la ligne `export const nettoyerIsbn = …` (≈ 20) et ajouter en tête des imports `import { nettoyerIsbn, validerIsbn, codeBarresVersIsbn } from '../core/isbn.js';` puis, juste après les imports, `export { nettoyerIsbn };` (les tâches 4 et 6 utilisent `validerIsbn` et `codeBarresVersIsbn`). Dans `sw.js` : ajouter `'./src/core/isbn.js'` à `SHELL` (à côté de `'./src/core/lien.js'`) et `VERSION = 'cuisine-os-v0.4.1-1'`. Dans `src/model/schema.js` : `APP_VERSION = '0.4.1'`.

- [ ] **Step 4 : Lancer la suite, vert**

Run: la même commande. Expected: `✅ 1289/1289` (1270 + 17 assertions ISBN + libellés des pins ; le nombre exact importe moins que **zéro `.ko`**).

- [ ] **Step 5 : Commit**

```bash
git add src/core/isbn.js src/ui/livre-ajout.js sw.js src/model/schema.js tests/ajouter.js tests/sync-l3.js
git commit -m "ISBN : module pur de validation (controle, 10<->13, code-barres), version 0.4.1" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2 : `lookupIsbn` — tentative à budget, classement, Open Library actuelle puis legacy, reprise

**Files:**
- Modify: `src/ui/livre-ajout.js` (`LIMITES_ISBN` ≈ 16 ; `borner` ≈ 21 ; `lireJson` + `lookupIsbn` ≈ 24-45 remplacés ; `corpsBorne` ≈ 61 : troisième paramètre)
- Modify: `tests/ajouter.js` (bloc `lookupIsbn` ≈ 138-161 remplacé ; bloc route R-UX-13 ≈ 631-775 : ISBN valides + stub `search.json`)

**Interfaces:**
- Consumes: `corpsBorne(r, type, borne)` (existant, paramètre ajouté ici).
- Produces: `lookupIsbn(isbn13, { fetch, signal, cle = '', attendre = attenteReelle, surReprise = null, tentativeMs, repriseMs }) → { statut, fiche, source, motif, google, appels }` ; `attenteReelle(ms, signal) → Promise<void>` (exportée) ; `LIMITES_ISBN = { champ: 300, corps: 262144, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 }`. `cle` est acceptée mais **ignorée jusqu'à la tâche 3** (`google` vaut toujours `'non_appele'`).

- [ ] **Step 1 : Écrire les tests (rouge)**

Remplacer dans `tests/ajouter.js` le bloc qui commence à `eq(LA.LIMITES_ISBN, …` (≈ 138) et finit à la fermeture du bloc `{ … }` qui contient `'livre : le signal d’abandon est transmis au fetch'` (≈ 161) par :

```js
  eq(LA.LIMITES_ISBN, { champ: 300, corps: 262144, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 }, 'livre : bornes S3 + délais du lot ISBN (F24 : delaiMs de la couverture intact)');
  eq(LA.OPTIONS_FETCH, { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }, 'livre : options de fetch explicites (S12)');
  {
    // lookupIsbn : fetch injecté, attente injectée (aucune vraie attente), délais injectés. Chaque réponse factice
    // expose blob() comme une vraie Response sans body (corpsBorne retombe sur blob()).
    const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), blob: async () => new Blob([typeof corps === 'string' ? corps : JSON.stringify(corps)], { type: 'application/json' }) });
    const SEARCH = 'https://openlibrary.org/search.json?isbn=9781785035289&fields=title,author_name,publisher,first_publish_year,language&limit=1';
    const LEGACY = 'https://openlibrary.org/api/books?bibkeys=ISBN:9781785035289&format=json&jscmd=data';
    const jamais = async () => { throw new Error('attendre ne doit pas être appelée'); };
    const sansAttente = async () => {};
    const chercher = (fetch, options = {}) => LA.lookupIsbn('9781785035289', { fetch, attendre: sansAttente, tentativeMs: 50, ...options });
    // Garde S9 : une entrée qui n'est pas un ISBN-13 ne part jamais sur le réseau.
    let erreur = null; let appelsGarde = 0;
    try { await LA.lookupIsbn('9781&x=1', { fetch: async () => { appelsGarde += 1; return reponse(200, {}); } }); } catch (e) { erreur = e; }
    eq([erreur instanceof TypeError, appelsGarde], [true, 0], 'lookup : une entrée qui n’est pas un ISBN-13 lève avant tout appel (S9)');
    // Trouvé par search.json en un appel, fiche typée.
    const urls = [];
    const r1 = await chercher(async (u, o) => { urls.push([u, o]); return reponse(200, { numFound: 1, docs: [{ title: 'Berber and Q', author_name: ['Josh Katz'], publisher: ['Ebury Publishing', 'Penguin Random House'], first_publish_year: 2018, language: ['eng', 'fre'] }] }); }, { attendre: jamais });
    eq([r1.statut, r1.source, r1.appels, r1.motif, r1.google], ['trouve', 'openlibrary', 1, null, 'non_appele'], 'lookup : search.json répond → trouvé en un appel');
    eq(r1.fiche, { title: 'Berber and Q', author: 'Josh Katz', publisher: 'Ebury Publishing', year: 2018, language: 'fr' }, 'lookup : fiche typée, premier éditeur, le français d’abord');
    eq(urls[0][0], SEARCH, 'lookup : adresse de l’API actuelle, sans isbn dans fields (F13)');
    ok(urls[0][1].signal instanceof AbortSignal && urls[0][1].mode === 'cors' && urls[0][1].credentials === 'omit' && urls[0][1].cache === 'no-store' && urls[0][1].referrerPolicy === 'no-referrer', 'lookup : options S12 + un signal par tentative');
    // « Rien » sans numFound → legacy en filet, champs typés.
    const r2 = await chercher(async (u) => (u === SEARCH ? reponse(200, { docs: [] }) : reponse(200, { 'ISBN:9781785035289': { title: 'Legacy', authors: [{ name: 'A' }, { nom: 'x' }], publishers: [{ name: 'P' }], publish_date: 'March 2018' } })), { attendre: jamais });
    eq([r2.statut, r2.source, r2.appels, r2.fiche], ['trouve', 'openlibrary', 2, { title: 'Legacy', author: 'A', publisher: 'P', year: 2018, language: null }], 'lookup : « rien » (sans numFound) → legacy en filet, champs typés');
    const r3 = await chercher(async (u) => reponse(200, u === SEARCH ? { numFound: 0, docs: [] } : {}), { attendre: jamais });
    eq([r3.statut, r3.appels, r3.motif, r3.google, r3.fiche, r3.source], ['introuvable', 2, null, 'non_appele', null, null], 'lookup : deux « rien » → introuvable');
    const r4 = await chercher(async (u) => { if (u === SEARCH) return reponse(200, { docs: [] }); throw new Error('reseau'); }, { attendre: jamais });
    eq([r4.statut, r4.appels], ['introuvable', 2], 'lookup : le legacy qui tombe ne change pas le statut (search a répondu)');
    // Reprise (I-R) : échec muet → une seconde tentative après attendre(repriseMs, signal), surReprise une fois.
    const attentes = []; let surReprises = 0;
    const r5 = await chercher(async () => { throw new Error('reseau'); }, { attendre: async (ms, s) => { attentes.push([ms, s === undefined || s instanceof AbortSignal]); }, repriseMs: 1500, surReprise: () => { surReprises += 1; } });
    eq([r5.statut, r5.motif, r5.appels, attentes, surReprises], ['indisponible', 'reseau', 2, [[1500, true]], 1], 'lookup : échec muet → une reprise, attendre(repriseMs, signal), surReprise une fois (I-R)');
    let n6 = 0;
    const r6 = await chercher(async () => { n6 += 1; if (n6 === 1) throw new Error('reseau'); return reponse(200, { docs: [{ title: 'T' }] }); });
    eq([r6.statut, r6.appels], ['trouve', 2], 'lookup : la reprise peut trouver');
    const r7 = await chercher(async () => reponse(429, {}), { attendre: jamais });
    eq([r7.statut, r7.motif, r7.appels], ['indisponible', 'limite', 1], 'lookup : 429 = limite, jamais réessayé par la machine (I-R)');
    const r8 = await chercher(async () => reponse(503, {}), { attendre: jamais });
    eq([r8.statut, r8.motif, r8.appels], ['indisponible', 'serveur', 1], 'lookup : 5xx = serveur, pas de reprise');
    eq((await chercher(async () => reponse(200, '<html>maintenance</html>'), { attendre: jamais })).motif, 'serveur', 'lookup : un 200 qui n’est pas du JSON = serveur, jamais une exception');
    // Délai : un fetch qui ne finit qu'à l'abandon de SON signal.
    const pendu = (u, o) => new Promise((resolve, reject) => o.signal.addEventListener('abort', () => reject(new DOMException('abandon', 'AbortError')), { once: true }));
    let signalVu = null;
    const r9 = await chercher(async (u, o) => { signalVu = signalVu || o.signal; return pendu(u, o); }, { tentativeMs: 1 });
    eq([r9.statut, r9.motif, r9.appels, signalVu.aborted], ['indisponible', 'delai', 2, true], 'lookup : chrono de tentative → delai, signal de la tentative abandonné, puis une reprise');
    const ctl1 = new AbortController();
    const r10 = await chercher(async (u, o) => { setTimeout(() => ctl1.abort(), 0); return pendu(u, o); }, { signal: ctl1.signal, tentativeMs: 5000, attendre: jamais });
    eq([r10.statut, r10.motif, r10.appels], ['indisponible', 'delai', 1], 'lookup : abandon extérieur pendant la tentative → delai, aucune reprise (S4)');
    const ctl2 = new AbortController();
    const r11 = await chercher(async () => { throw new Error('reseau'); }, { signal: ctl2.signal, attendre: async () => { ctl2.abort(); } });
    eq([r11.appels, r11.statut, r11.motif], [1, 'indisponible', 'delai'], 'lookup : abandon pendant l’attente → la seconde tentative ne part pas (S4a)');
    const ctl3 = new AbortController(); ctl3.abort();
    const r12 = await chercher(async () => reponse(200, { docs: [{ title: 'T' }] }), { signal: ctl3.signal });
    eq([r12.appels, r12.statut, r12.motif], [0, 'indisponible', 'delai'], 'lookup : signal déjà abandonné → zéro appel (S4b)');
    // Formes hostiles ou dégradées (S6/F13).
    eq((await chercher(async () => reponse(200, {}), { attendre: jamais })).motif, 'serveur', 'lookup : search sans docs = forme inattendue → serveur');
    const r13 = await chercher(async (u) => reponse(200, u === SEARCH ? { docs: [{ author_name: ['A'] }] } : {}), { attendre: jamais });
    eq([r13.statut, r13.appels], ['introuvable', 2], 'lookup : docs[0] sans titre = « rien », le legacy est consulté');
    eq((await chercher(async (u) => reponse(200, u === SEARCH ? { docs: [{ title: 12 }] } : {}), { attendre: jamais })).statut, 'introuvable', 'lookup : un titre qui n’est pas une chaîne n’est pas une fiche');
    const r14 = await chercher(async () => reponse(200, { docs: [{ title: 'T\u202E\u2028x', author_name: 'x', publisher: [{}], language: 'french', first_publish_year: { a: 1 } }] }), { attendre: jamais });
    eq(r14.fiche, { title: 'Tx', author: '', publisher: '', year: null, language: null }, 'lookup : champs typés, Cc/Cf/U+2028 retirés (S6)');
    eq((await chercher(async () => reponse(200, { docs: [{ title: 'T', first_publish_year: '2018' }] }), { attendre: jamais })).fiche.year, 2018, 'lookup : une année reçue en chaîne reste une année');
    eq((await chercher(async () => reponse(200, { docs: [{ title: 'T'.repeat(400) }] }), { attendre: jamais })).fiche.title.length, 300, 'lookup : titre tronqué à 300 (S3)');
    // Corps en flux > 256 Kio : coupé par cancel(), jamais gardé (S7, R-UX-12).
    let annule = false;
    const flux = () => ({ ok: true, status: 200, headers: new Headers(), body: { getReader: () => ({ read: async () => ({ done: false, value: new Uint8Array(100 * 1024) }), cancel: async () => { annule = true; } }) } });
    const r15 = await chercher(async () => flux(), { attendre: jamais });
    eq([r15.motif, annule], ['serveur', true], 'lookup : un corps sans fin est coupé à 256 Kio (S7)');
    // attenteReelle : abandonnable, rend tout de suite si déjà abandonné.
    const ctl4 = new AbortController(); ctl4.abort();
    const t0 = performance.now(); await LA.attenteReelle(5000, ctl4.signal);
    ok(performance.now() - t0 < 100, 'lookup : attenteReelle rend tout de suite sur un signal déjà abandonné');
    const ctl5 = new AbortController(); setTimeout(() => ctl5.abort(), 5);
    const t1 = performance.now(); await LA.attenteReelle(5000, ctl5.signal);
    ok(performance.now() - t1 < 1000, 'lookup : attenteReelle est coupée par l’abandon');
    await LA.attenteReelle(1);
    ok(true, 'lookup : attenteReelle sans signal rend après le délai');
  }
```

Dans le bloc route R-UX-13 (≈ 631-775), **sans toucher à sa logique** : (a) remplacer les ISBN de fixture partout (`taper`, `couvertures.set`, `sansFicheOl.add`, libellés) : `'111'` → `'9780306406157'`, `'222'` → `'9780804429573'`, `'333'` → `'9782890772816'`, `'444'` → `'9781785035289'`, `'555'` → `'9791234567896'`, `'666'` → `'9782890775367'`, `'777'` → `'9782891291392'` ; (b) dans le stub `globalThis.fetch`, ajouter **avant** la branche `api/books` :

```js
          if (u.startsWith('https://openlibrary.org/search.json')) {
            const isbn = new URL(u).searchParams.get('isbn');
            const corps = sansFicheOl.has(isbn) ? { numFound: 0, docs: [] } : { numFound: 1, docs: [{ title: `Livre ${isbn}`, author_name: [], publisher: [], first_publish_year: 2020, language: ['fre'] }] };
            return { ok: true, status: 200, headers: new Headers(), blob: async () => new Blob([JSON.stringify(corps)], { type: 'application/json' }) };
          }
```

et donner `blob` aux réponses `api/books` (`blob: async () => new Blob([JSON.stringify(…)])` à la place de `text`) ; (c) le cas 4 (`'666'`, ≈ 757-767) devient « sans clé, un « rien » d'Open Library ne demande ni couverture ni Google » :

```js
        eq([depuis.some((u) => u.startsWith('https://covers.openlibrary.org/')), depuis.some((u) => u.startsWith('https://www.googleapis.com/books/')), r4.textContent.includes('Aucune fiche')],
          [false, false, true], 'route : sans clé, un « rien » d’Open Library ne demande ni couverture ni Google Books (I-A, § 5)');
```

- [ ] **Step 2 : Lancer la suite, lire le rouge**

Expected: `❌` — « Suite Ajouter interrompue » ou une série de `lookup : …` rouges (`statut` absent, `LIMITES_ISBN` sans `tentativeMs`, `attenteReelle` indéfinie).

- [ ] **Step 3 : Implémenter dans `src/ui/livre-ajout.js`**

Remplacer `LIMITES_ISBN`, `borner`, `lireJson` et `lookupIsbn` (≈ 16-45) par :

```js
export const LIMITES_ISBN = { champ: 300, corps: 256 * 1024, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 };
export const OPTIONS_FETCH = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };
const CHAMPS_VIDES = () => ({ title: '', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] });

// S3/S6 : une chaîne seulement, sans caractères de contrôle (Cc), de format (Cf : bidi…) ni séparateurs de ligne
// U+2028/2029 (catégories Zl/Zp, nommés à part), tronquée à 300. Tout ce qui n'est pas une chaîne vaut ''.
const borner = (s) => (typeof s === 'string' ? s.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '').slice(0, LIMITES_ISBN.champ) : '');
const chaines = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const annee = (s) => { const m = String(s ?? '').match(/\b(\d{4})\b/); return m ? parseInt(m[1], 10) : null; };
const langueDe = (liste) => (!Array.isArray(liste) ? null : liste.includes('fre') ? 'fr' : liste.includes('eng') ? 'en' : null);
const ficheOk = (f) => (f && f.title ? f : null);

// Attente abandonnable : rend tout de suite si le signal est déjà abandonné, et dès qu'il l'est.
export const attenteReelle = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) { resolve(); return; }
  const fin = () => { clearTimeout(id); signal?.removeEventListener('abort', fin); resolve(); };
  const id = setTimeout(fin, ms);
  signal?.addEventListener('abort', fin, { once: true });
});

const URL_OL_SEARCH = (isbn) => `https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name,publisher,first_publish_year,language&limit=1`;
const URL_OL_LEGACY = (isbn) => `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;

// Une tentative = un budget (S4) : son AbortController couvre le fetch ET la lecture du corps ; il est relié au signal
// extérieur par un écouteur retiré en finally. Rend { ok: true, json } ou { ok: false, motif }. Ordre du classement
// (F14) : signal de la tentative abandonné → delai ; rejet → reseau ; 429 → limite ; autre non-2xx → serveur ;
// corps trop gros, non JSON → serveur.
async function tentative(fetchFn, url, options, { tentativeMs, signal }) {
  const ctl = new AbortController();
  const chrono = setTimeout(() => ctl.abort(), tentativeMs);
  const relais = () => ctl.abort();
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', relais, { once: true }); }
  const echec = () => ({ ok: false, motif: ctl.signal.aborted ? 'delai' : 'reseau' });
  try {
    let r;
    try { r = await fetchFn(url, { ...options, signal: ctl.signal }); } catch { return echec(); }
    if (r.status === 429) return { ok: false, motif: 'limite' };
    if (!r.ok) return { ok: false, motif: 'serveur' };
    let blob;
    try { blob = await corpsBorne(r, 'application/json', LIMITES_ISBN.corps); } catch { return echec(); }
    if (!blob) return { ok: false, motif: 'serveur' };
    try { return { ok: true, json: JSON.parse(await blob.text()) }; } catch { return { ok: false, motif: 'serveur' }; }
  } finally { clearTimeout(chrono); signal?.removeEventListener('abort', relais); }
}

// Lecteurs : { repondu: true, fiche | null } si la forme est celle attendue, { repondu: false } sinon (→ serveur).
function lireSearch(json) {
  const docs = json?.docs;
  if (!Array.isArray(docs)) return { repondu: false };
  const d = docs[0];
  if (!d || typeof d !== 'object') return { repondu: true, fiche: null };
  return { repondu: true, fiche: ficheOk({ title: borner(d.title).trim(), author: borner(chaines(d.author_name).join(', ')), publisher: borner(chaines(d.publisher)[0]), year: annee(d.first_publish_year), language: langueDe(d.language) }) };
}
function lireLegacy(json, isbn) {
  if (!json || typeof json !== 'object') return { repondu: false };
  const b = json[`ISBN:${isbn}`];
  if (!b || typeof b !== 'object') return { repondu: true, fiche: null };
  const noms = (liste) => (Array.isArray(liste) ? liste.map((x) => (typeof x?.name === 'string' ? x.name : '')).filter(Boolean) : []);
  return { repondu: true, fiche: ficheOk({ title: borner(b.title).trim(), author: borner(noms(b.authors).join(', ')), publisher: borner(noms(b.publishers).join(', ')), year: annee(b.publish_date), language: null }) };
}

// Trois issues (spec § 5) : trouve / introuvable (Open Library a répondu « rien ») / indisponible (motif). Étape 1 :
// search.json, une reprise sur échec muet (I-R). Étape 2 : legacy api/books, seulement après un « rien ». Étape 3
// (tâche 3) : Google Books, seulement avec une clé et après un « rien ». Jamais d'exception pour un échec de source.
export async function lookupIsbn(isbn13, { fetch = globalThis.fetch, signal, cle = '', attendre = attenteReelle, surReprise = null, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = {}) {
  if (!/^97[89]\d{10}$/.test(String(isbn13))) throw new TypeError('lookupIsbn : ISBN-13 attendu'); // S9 : l'erreur d'un appelant, pas d'une source
  const bilan = { statut: 'indisponible', fiche: null, source: null, motif: null, google: 'non_appele', appels: 0 };
  const appel = async (url, options) => { bilan.appels += 1; return tentative(fetch, url, options, { tentativeMs, signal }); };
  const trouve = (fiche, source) => ({ ...bilan, statut: 'trouve', fiche, source });
  const abandonne = () => ({ ...bilan, motif: 'delai' });
  // Étape 1.
  let r1 = null;
  for (let essai = 0; essai < 2; essai += 1) {
    if (signal?.aborted) return abandonne();
    if (essai === 1) {
      if (typeof surReprise === 'function') surReprise();
      await attendre(repriseMs, signal);
      if (signal?.aborted) return abandonne();
    }
    r1 = await appel(URL_OL_SEARCH(isbn13), OPTIONS_FETCH);
    if (r1.ok) break;
    const muet = (r1.motif === 'reseau' || r1.motif === 'delai') && !signal?.aborted;
    if (!muet) break;
  }
  if (!r1.ok) return { ...bilan, motif: r1.motif };
  const lu1 = lireSearch(r1.json);
  if (!lu1.repondu) return { ...bilan, motif: 'serveur' };
  if (lu1.fiche) return trouve(lu1.fiche, 'openlibrary');
  // Étape 2 : Open Library a répondu « rien » → le statut est acquis (introuvable) ; le legacy ne peut que trouver.
  if (signal?.aborted) return { ...bilan, statut: 'introuvable' };
  const r2 = await appel(URL_OL_LEGACY(isbn13), OPTIONS_FETCH);
  const lu2 = r2.ok ? lireLegacy(r2.json, isbn13) : null;
  if (lu2?.fiche) return trouve(lu2.fiche, 'openlibrary');
  return { ...bilan, statut: 'introuvable' };
}
```

Puis `corpsBorne` (≈ 61) : signature `async function corpsBorne(r, type, borne = LIMITES_COUVERTURE.octetsDistants)` et supprimer la ligne `const borne = LIMITES_COUVERTURE.octetsDistants;`. Tout le reste de la couverture est inchangé (`recupererCouvertureParIsbn` appelle `corpsBorne(r, type)` : défaut intact). Réécrire le commentaire d'en-tête de `lookupIsbn` comme ci-dessus (F27). Dans `sw.js` : `VERSION = 'cuisine-os-v0.4.1-2'`.

- [ ] **Step 4 : Lancer la suite, vert**

Expected: `✅`, zéro `.ko`. Si le bloc R-UX-13 reste rouge : vérifier que les sept ISBN sont remplacés **partout** (y compris dans `couvertures.set` et les libellés) et que le stub rend `blob`.

- [ ] **Step 5 : Commit**

```bash
git add src/ui/livre-ajout.js sw.js tests/ajouter.js
git commit -m "lookupIsbn : trois issues, tentative a budget, Open Library search.json puis legacy, une reprise sur echec muet" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3 : Google Books avec clé, `GOOGLE_BOOKS` dans la config, `strict-origin`

**Files:**
- Modify: `src/sync/config.js` (export `GOOGLE_BOOKS` après `SUPABASE`)
- Modify: `src/ui/livre-ajout.js` (`lookupIsbn` : étape 3 ; `URL_GOOGLE` ; `lireGoogle`)
- Modify: `tests/ajouter.js` (suite du bloc `lookupIsbn` de la tâche 2 ; bloc statique de fin : test de forme de la clé)

**Interfaces:**
- Consumes: `lookupIsbn` (tâche 2), `tentative`, `borner`, `chaines`, `annee`, `ficheOk`.
- Produces: `GOOGLE_BOOKS = { key: '' }` (export de `src/sync/config.js`) ; `lookupIsbn(…, { cle })` : avec `cle` non vide, troisième appel `https://www.googleapis.com/books/v1/volumes?q=isbn:<13>&maxResults=1&key=<encodeURIComponent(cle)>` avec `referrerPolicy: 'strict-origin'` ; `google ∈ { 'non_appele', 'rien', 'echec' }`.

- [ ] **Step 1 : Écrire les tests (rouge)**

À la fin du bloc `lookupIsbn` de la tâche 2 (avant son `}` fermant), ajouter :

```js
    // Google Books : jamais sans clé ; avec clé, troisième appel, strict-origin, clé encodée ; jamais après un échec OL.
    const urls3 = [];
    const g0 = await chercher(async (u) => { urls3.push([u]); return reponse(200, u === SEARCH ? { docs: [] } : {}); }, { attendre: jamais });
    eq([g0.appels, urls3.some(([u]) => u.includes('googleapis'))], [2, false], 'lookup : sans clé, Google Books n’est jamais appelé');
    const stubGoogle = (reponseGoogle, search = { docs: [] }) => async (u, o) => { urls3.push([u, o]); if (u === SEARCH) return reponse(200, search); if (u === LEGACY) return reponse(200, {}); return reponseGoogle(u, o); };
    urls3.length = 0;
    const g1 = await chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: 'G', authors: ['X', 3], publisher: 'Q', publishedDate: '2001-02', language: 'fr' } }] })), { cle: 'k&x', attendre: jamais });
    eq([g1.statut, g1.source, g1.appels, g1.fiche], ['trouve', 'googlebooks', 3, { title: 'G', author: 'X', publisher: 'Q', year: 2001, language: 'fr' }], 'lookup : avec clé, Google Books est le troisième appel, champs typés');
    const [uG, oG] = urls3[2];
    eq(uG, 'https://www.googleapis.com/books/v1/volumes?q=isbn:9781785035289&maxResults=1&key=k%26x', 'lookup : adresse Google, clé encodée (S9)');
    eq([oG.referrerPolicy, urls3[0][1].referrerPolicy, urls3[1][1].referrerPolicy, oG.mode, oG.credentials, oG.cache, oG.signal instanceof AbortSignal], ['strict-origin', 'no-referrer', 'no-referrer', 'cors', 'omit', 'no-store', true], 'lookup : strict-origin pour Google seul (§ 7), no-referrer ailleurs');
    const g2 = await chercher(stubGoogle(async () => reponse(429, {})), { cle: 'k', attendre: jamais });
    eq([g2.statut, g2.google, g2.appels, g2.motif], ['introuvable', 'echec', 3, null], 'lookup : Google qui tombe après deux « rien » → introuvable, google = echec (S5)');
    const g3 = await chercher(stubGoogle(async () => reponse(200, { totalItems: 0 })), { cle: 'k', attendre: jamais });
    eq([g3.statut, g3.google], ['introuvable', 'rien'], 'lookup : Google « rien » (sans items) → google = rien');
    eq((await chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: '' } }] })), { cle: 'k', attendre: jamais })).google, 'rien', 'lookup : un volume sans titre n’est pas une fiche');
    eq((await chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: 'G', language: 'de' } }] })), { cle: 'k', attendre: jamais })).fiche.language, null, 'lookup : langue Google hors fr/en → null');
    urls3.length = 0;
    const g4 = await chercher(async (u) => { urls3.push([u]); return reponse(503, {}); }, { cle: 'k', attendre: jamais });
    eq([g4.statut, g4.motif, g4.appels, urls3.some(([u]) => u.includes('googleapis'))], ['indisponible', 'serveur', 1, false], 'lookup : Open Library muette → Google jamais appelé, « Réessayer » plutôt qu’un mensonge (S5/F6)');
    // Signal abandonné entre le legacy et Google : Google ne part pas, le statut reste introuvable (search a répondu).
    const ctl6 = new AbortController();
    urls3.length = 0;
    const g5 = await chercher(async (u, o) => { urls3.push([u, o]); if (u === SEARCH) return reponse(200, { docs: [] }); ctl6.abort(); return reponse(200, {}); }, { cle: 'k', signal: ctl6.signal, attendre: jamais });
    eq([g5.statut, g5.appels, g5.google], ['introuvable', 2, 'echec'], 'lookup : abandon après le legacy → Google jamais appelé, introuvable avec google = echec (S4c)');
```

Dans le bloc statique de fin (près des pins) :

```js
    const { GOOGLE_BOOKS } = await import('../src/sync/config.js');
    ok(typeof GOOGLE_BOOKS?.key === 'string' && (GOOGLE_BOOKS.key === '' || /^AIza[0-9A-Za-z_-]{35}$/.test(GOOGLE_BOOKS.key)), 'config : la clé Google Books est vide ou au format d’une clé d’API publique — un test de forme, jamais de valeur (S2/F2)');
```

- [ ] **Step 2 : Lancer la suite, lire le rouge**

Expected: `❌` — `GOOGLE_BOOKS` indéfini ; `g1.appels` = 2 au lieu de 3 ; `g2.google` = `'non_appele'`.

- [ ] **Step 3 : Implémenter**

`src/sync/config.js`, après `SUPABASE` :

```js
// Clé d'API Google Books, PUBLIQUE PAR CONCEPTION (spec « Identifier un livre, fiable » § 7) : vide = Google Books
// jamais appelé. Le jour où elle est posée, elle vient d'un projet Google Cloud DÉDIÉ et SANS facturation, restreinte
// à l'API Books, à un quota abaissé et aux référents du site — la restriction par référent seule est un dos-d'âne,
// pas un mur (S1). Jamais une clé sans restriction d'API. Procédure : docs/google-books.md.
export const GOOGLE_BOOKS = { key: '' };
```

`src/ui/livre-ajout.js` : import `import { GOOGLE_BOOKS } from '../sync/config.js';` (servira à la route, tâche 6 ; ici pour `URL_GOOGLE`, rien à lire). Ajouter après `URL_OL_LEGACY` :

```js
const URL_GOOGLE = (isbn, cle) => `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1&key=${encodeURIComponent(cle)}`;
// § 7 : une clé restreinte par référent exige un Referer ; strict-origin envoie l'ORIGINE seule (jamais le chemin ni
// le #), et rien sur un déclassement HTTPS → HTTP. Google Books est le seul appel qui s'écarte de no-referrer (S12).
const OPTIONS_GOOGLE = { ...OPTIONS_FETCH, referrerPolicy: 'strict-origin' };
function lireGoogle(json) {
  if (!json || typeof json !== 'object') return { repondu: false };
  const items = json.items;
  const v = Array.isArray(items) && items[0] && typeof items[0] === 'object' ? items[0].volumeInfo : null;
  if (!v || typeof v !== 'object') return { repondu: true, fiche: null };
  return { repondu: true, fiche: ficheOk({ title: borner(v.title).trim(), author: borner(chaines(v.authors).join(', ')), publisher: borner(v.publisher), year: annee(v.publishedDate), language: v.language === 'fr' || v.language === 'en' ? v.language : null }) };
}
```

Dans `lookupIsbn`, remplacer la dernière ligne `return { ...bilan, statut: 'introuvable' };` (après le legacy) par :

```js
  // Étape 3 : Google Books, avec clé seulement, et seulement après un « rien » d'Open Library (jamais après un échec).
  if (!cle) return { ...bilan, statut: 'introuvable' };
  if (signal?.aborted) return { ...bilan, statut: 'introuvable', google: 'echec' };
  const r3 = await appel(URL_GOOGLE(isbn13, cle), OPTIONS_GOOGLE);
  const lu3 = r3.ok ? lireGoogle(r3.json) : null;
  if (lu3?.fiche) return trouve(lu3.fiche, 'googlebooks');
  return { ...bilan, statut: 'introuvable', google: lu3?.repondu ? 'rien' : 'echec' };
```

Mettre à jour le commentaire d'en-tête de `lookupIsbn` (« Étape 3 (tâche 3) » → « Étape 3 : Google Books… »). `sw.js` : `VERSION = 'cuisine-os-v0.4.1-3'`.

- [ ] **Step 4 : Lancer la suite, vert** — Expected: `✅`, zéro `.ko`.

- [ ] **Step 5 : Commit**

```bash
git add src/sync/config.js src/ui/livre-ajout.js sw.js tests/ajouter.js
git commit -m "lookupIsbn : Google Books seulement avec cle (GOOGLE_BOOKS vide), strict-origin, jamais apres un echec Open Library" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4 : `fabriquerLivre` (ISBN-13 ou `null`), modèle `livreAjoutModel`, dictionnaire

**Files:**
- Modify: `src/ui/livre-ajout.js` (`livreAjoutModel` ≈ 128-135 ; `fabriquerLivre` ≈ 137-142)
- Modify: `src/i18n/en.js` (≈ 195-199 : entrées neuves, une retirée)
- Modify: `tests/ajouter.js` (bloc modèle ≈ 165-174 ; bloc `fabriquerLivre` ≈ 176-183)

**Interfaces:**
- Consumes: `validerIsbn` (tâche 1).
- Produces: `livreAjoutModel({ pas, isbn, champs, provenance, recherche, reprise, validation, resultat, cleGoogle, lecteurDisponible, enCours })` → `{ …, reprise, validation, resultat, cleGoogle, isbnValide, peutReessayer, messages: { provenance, recherche, lecteur, validation, indisponible, sources, rappelIsbn } }` ; `fabriquerLivre` écrit `edition.isbn = isbn13 | null`.

- [ ] **Step 1 : Écrire les tests (rouge)**

Remplacer le bloc modèle (de `const m = LA.livreAjoutModel({ pas: 1, isbn: '', …` à la fin de son `{ … }`, ≈ 165-174) par :

```js
  {
    const m = LA.livreAjoutModel({ pas: 1, isbn: '', champs: { title: '' }, provenance: null, recherche: false, lecteurDisponible: false });
    eq([m.pas, m.peutEnregistrer, m.messages.lecteur], [1, false, 'Le lecteur de code-barres n’est pas offert dans ce navigateur.'], 'livre : pas 1, lecteur absent nommé');
    const m2 = LA.livreAjoutModel({ pas: 2, isbn: '9781785035289', champs: { title: 'X' }, provenance: 'openlibrary', recherche: false, lecteurDisponible: true });
    eq([m2.peutEnregistrer, m2.messages.provenance], [true, 'Renseigné par Open Library — vérifie et corrige.'], 'livre : pas 2, provenance étiquetée (I-A)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance: 'aucune' }).messages.provenance, 'Aucune fiche chez Open Library pour cet ISBN. Complète à la main.', 'livre : « rien » dit après la réponse d’Open Library seule (I-B)');
    eq(LA.livreAjoutModel({ pas: 2, provenance: 'aucune', resultat: { statut: 'introuvable', motif: null, google: 'rien' } }).messages.provenance, 'Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main.', 'livre : les deux sources ont répondu « rien »');
    eq(LA.livreAjoutModel({ pas: 2, provenance: 'aucune', resultat: { statut: 'introuvable', motif: null, google: 'echec' } }).messages.provenance, 'Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la main.', 'livre : Google muet n’est pas cité comme ayant répondu (S5)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance: null }).messages.provenance, null, 'livre : saisie à la main → aucune provenance');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: '   ' } }).peutEnregistrer, false, 'livre : sans titre, pas d’enregistrement');
    eq(LA.livreAjoutModel({ pas: 1, recherche: true }).messages.recherche, 'Recherche…', 'livre : pendant l’appel');
    eq(LA.livreAjoutModel({ pas: 1, recherche: true, reprise: true }).messages.recherche, 'Nouvel essai…', 'livre : la reprise est dite (S11)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, enCours: true }).peutEnregistrer, false, 'livre : pendant l’enregistrement, on ne peut pas enregistrer une seconde fois (double clic)');
    eq([LA.livreAjoutModel({ pas: 1, validation: 'controle' }).messages.validation, LA.livreAjoutModel({ pas: 1, validation: 'longueur' }).messages.validation, LA.livreAjoutModel({ pas: 1, validation: 'pas_isbn' }).messages.validation, LA.livreAjoutModel({ pas: 1 }).messages.validation],
      ['Cet ISBN n’est pas valide, vérifie les chiffres.', 'Cet ISBN n’est pas valide, vérifie les chiffres.', 'Ce code-barres n’est pas un ISBN.', null], 'livre : un ISBN refusé est dit sous le champ (§ 4)');
    const TEXTES = { delai: 'Open Library n’a pas répondu à temps.', reseau: 'Impossible de joindre Open Library. Vérifie ta connexion.', limite: 'Open Library reçoit trop de demandes en ce moment. Attends quelques secondes.', serveur: 'Open Library est en panne pour le moment.', horsligne: 'Tu es hors ligne.' };
    for (const [motif, texte] of Object.entries(TEXTES)) {
      const mi = LA.livreAjoutModel({ pas: 1, resultat: { statut: 'indisponible', motif } });
      eq([mi.messages.indisponible, mi.peutReessayer], [texte, true], `livre : indisponible/${motif} dit vrai et offre Réessayer`);
    }
    const mr = LA.livreAjoutModel({ pas: 1, recherche: true, resultat: { statut: 'indisponible', motif: 'limite' } });
    eq([mr.messages.indisponible, mr.peutReessayer], [null, false], 'livre : pendant la recherche, ni message indisponible ni Réessayer (F17)');
    eq(LA.livreAjoutModel({ pas: 1, resultat: { statut: 'indisponible', motif: '__proto__' } }).messages.indisponible, 'Open Library est en panne pour le moment.', 'livre : un motif inconnu ou hostile retombe sur « panne » (S12)');
    eq(LA.livreAjoutModel({ pas: 1, resultat: { statut: 'introuvable', motif: null, google: 'non_appele' } }).peutReessayer, false, 'livre : introuvable n’offre pas Réessayer');
    eq([LA.livreAjoutModel({ pas: 1 }).messages.sources, LA.livreAjoutModel({ pas: 1, cleGoogle: true }).messages.sources], ['L’ISBN est envoyé à Open Library.', 'L’ISBN est envoyé à Open Library, puis à Google Books si besoin.'], 'livre : la phrase des sources dit ce qui est vrai (F12)');
    eq([LA.livreAjoutModel({ pas: 2, isbn: '9782890772816' }).isbnValide, LA.livreAjoutModel({ pas: 2, isbn: '12345' }).isbnValide, LA.livreAjoutModel({ pas: 2, isbn: '' }).isbnValide], [true, false, true], 'livre : isbnValide');
    eq([LA.livreAjoutModel({ pas: 2, isbn: '9782890772816' }).messages.rappelIsbn, LA.livreAjoutModel({ pas: 2, isbn: '12345' }).messages.rappelIsbn, LA.livreAjoutModel({ pas: 2, isbn: '' }).messages.rappelIsbn], ['ISBN 9782890772816', 'ISBN 12345 — non valide, ne sera pas enregistré', null], 'livre : rappel de l’ISBN au pas 2 (S8)');
  }
```

Dans le bloc `fabriquerLivre` existant (≈ 176-183) : remplacer `'9782761950001'` par `'9782890772816'` dans l'appel **et** dans l'`edition` attendue (la fixture d'avant a un contrôle faux — F22) ; puis ajouter avant la fermeture du bloc :

```js
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '0306406152' }, { newId: (p) => p }).edition.isbn, '9780306406157', 'livre : un ISBN-10 valide est enregistré en 13');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '12345' }, { newId: (p) => p }).edition.isbn, null, 'livre : un ISBN invalide n’est pas enregistré (S8)');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '9'.repeat(10000) }, { newId: (p) => p }).edition.isbn, null, 'livre : une suite libre de chiffres n’atteint jamais la base ni son index (S8)');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '' }, { newId: (p) => p }).edition.isbn, null, 'livre : sans ISBN, null');
```

- [ ] **Step 2 : Lancer la suite, lire le rouge** — Expected: `❌` — messages `validation`/`indisponible`/`sources`/`rappelIsbn` indéfinis, texte « Aucune fiche trouvée… » ancien, `isbn` '12345' enregistré.

- [ ] **Step 3 : Implémenter**

`livreAjoutModel` :

```js
export function livreAjoutModel({ pas = 1, isbn = '', champs = {}, provenance = null, recherche = false, reprise = false, validation = null, resultat = null, cleGoogle = false, lecteurDisponible = true, enCours = false } = {}) {
  const c = { ...CHAMPS_VIDES(), ...champs };
  const google = resultat?.google || 'non_appele';
  const provenanceMessage = provenance === 'openlibrary' ? t('Renseigné par Open Library — vérifie et corrige.')
    : provenance === 'googlebooks' ? t('Renseigné par Google Books — vérifie et corrige.')
    : provenance === 'aucune' ? (google === 'rien' ? t('Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main.')
      : google === 'echec' ? t('Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la main.')
      : t('Aucune fiche chez Open Library pour cet ISBN. Complète à la main.')) : null;
  // Tables fermées, lues par hasOwn : un motif inconnu (ou hostile, « __proto__ ») retombe sur un texte sûr (S12).
  const INDISPONIBLE = { delai: t('Open Library n’a pas répondu à temps.'), reseau: t('Impossible de joindre Open Library. Vérifie ta connexion.'), limite: t('Open Library reçoit trop de demandes en ce moment. Attends quelques secondes.'), serveur: t('Open Library est en panne pour le moment.'), horsligne: t('Tu es hors ligne.') };
  const VALIDATION = { longueur: t('Cet ISBN n’est pas valide, vérifie les chiffres.'), controle: t('Cet ISBN n’est pas valide, vérifie les chiffres.'), pas_isbn: t('Ce code-barres n’est pas un ISBN.') };
  const lire = (table, cle, repli) => (typeof cle === 'string' && Object.hasOwn(table, cle) ? table[cle] : repli);
  const isbnValide = !isbn || validerIsbn(isbn).ok;
  const indisponible = resultat?.statut === 'indisponible' && !recherche;
  return { pas, isbn, champs: c, provenance, recherche, reprise, validation, resultat, cleGoogle, lecteurDisponible, enCours, isbnValide,
    peutEnregistrer: pas === 2 && !!c.title.trim() && !recherche && !enCours,
    peutReessayer: indisponible,
    messages: {
      provenance: provenanceMessage,
      recherche: recherche ? (reprise ? t('Nouvel essai…') : t('Recherche…')) : null,
      lecteur: lecteurDisponible ? null : t('Le lecteur de code-barres n’est pas offert dans ce navigateur.'),
      validation: validation ? lire(VALIDATION, validation, VALIDATION.longueur) : null,
      indisponible: indisponible ? lire(INDISPONIBLE, resultat.motif, INDISPONIBLE.serveur) : null,
      sources: cleGoogle ? t('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.') : t('L’ISBN est envoyé à Open Library.'),
      rappelIsbn: isbn ? (isbnValide ? `${t('ISBN')} ${isbn}` : t('ISBN {i} — non valide, ne sera pas enregistré', { i: isbn })) : null,
    } };
}
```

`fabriquerLivre` : remplacer `isbn: nettoyerIsbn(isbn) || null` par `isbn: validerIsbn(isbn).ok ? validerIsbn(isbn).isbn13 : null` (ou `const v = validerIsbn(isbn);` en tête et `isbn: v.ok ? v.isbn13 : null`).

`src/i18n/en.js` (près de la ligne 199) : **retirer** l'entrée `"Aucune fiche trouvée pour cet ISBN. Complète à la main."` et ajouter :

```js
  'Aucune fiche chez Open Library pour cet ISBN. Complète à la main.': 'No record at Open Library for this ISBN. Fill it in by hand.',
  'Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main.': 'No record at Open Library or Google Books for this ISBN. Fill it in by hand.',
  'Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la main.': 'No record at Open Library for this ISBN (Google Books did not answer). Fill it in by hand.',
  'Open Library n’a pas répondu à temps.': 'Open Library did not answer in time.',
  'Impossible de joindre Open Library. Vérifie ta connexion.': 'Cannot reach Open Library. Check your connection.',
  'Open Library reçoit trop de demandes en ce moment. Attends quelques secondes.': 'Open Library is getting too many requests right now. Wait a few seconds.',
  'Open Library est en panne pour le moment.': 'Open Library is down for now.',
  'Tu es hors ligne.': 'You are offline.',
  'Cet ISBN n’est pas valide, vérifie les chiffres.': 'This ISBN is not valid, check the digits.',
  'Ce code-barres n’est pas un ISBN.': 'This barcode is not an ISBN.',
  'L’ISBN est envoyé à Open Library.': 'The ISBN is sent to Open Library.',
  'Nouvel essai…': 'Trying again…',
  'ISBN {i} — non valide, ne sera pas enregistré': 'ISBN {i} — not valid, will not be saved',
  'Réessayer': 'Try again',
```

(La clé `'Réessayer'` sert à la tâche 5.) Vérifier qu'aucune de ces clés n'existe déjà (`grep -n "Réessayer\|Tu es hors ligne" src/i18n/en.js`) ; si `'Réessayer'` existe, ne pas la doubler. Pas de fichier servi modifié hors `livre-ajout.js` et `en.js` : `sw.js` → `VERSION = 'cuisine-os-v0.4.1-4'`.

- [ ] **Step 4 : Lancer la suite, vert** — Expected: `✅`. Le test i18n F13 (bloc de fin) reste vert : chaque `t('…')` neuf a son entrée.

- [ ] **Step 5 : Commit**

```bash
git add src/ui/livre-ajout.js src/i18n/en.js sw.js tests/ajouter.js
git commit -m "Modele du livre : trois issues dites vrai, ISBN valide ou null a l enregistrement, phrase des sources selon la cle" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 : Rendu du pas 1 (validation, « Réessayer », Entrée, lecture seule) et rappel du pas 2

**Files:**
- Modify: `src/ui/livre-ajout.js` (`renderLivreAjout` ≈ 148-166 pas 1 ; ≈ 171 ligne de rappel du pas 2)
- Modify: `tests/ajouter.js` (bloc rendu ≈ 200-223 : assertion « tiers nommés » ; fixture route ≈ 249-262 ; bloc neuf)

**Interfaces:**
- Consumes: `livreAjoutModel` (tâche 4).
- Produces: pas 1 : `input[name=isbn]` avec `maxlength="20"`, `readOnly` = `model.recherche`, `keydown` Entrée → `gestes.identifier()` (ignoré si `repeat`/`isComposing`) ; `small[data-role=validation]` ; `div[data-role=indisponible]` + `button[data-role=reessayer]` (`gestes.reessayer`) ; phrase `messages.sources`. Pas 2 : `span.muted` = `messages.rappelIsbn`.

- [ ] **Step 1 : Écrire les tests (rouge)**

Dans le bloc rendu existant (≈ 203-205) remplacer `ok(p1.textContent.includes('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.'), …)` par :

```js
    ok(p1.textContent.includes('L’ISBN est envoyé à Open Library.') && !p1.textContent.includes('Google Books'), 'livre : sans clé, la phrase ne promet pas Google Books (F12)');
    ok(LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, cleGoogle: true }), {}).textContent.includes('puis à Google Books si besoin.'), 'livre : avec clé, les deux tiers sont nommés (S12)');
```

Dans le bloc route existant (≈ 249-262) : `' 978-2-7619-5000-1 '` → `' 978-2-8907-7281-6 '`, `['ISBN 9782761950001']` → `['ISBN 9782890772816']`, `.value, '9782761950001'` → `'9782890772816'`.

Ajouter un bloc neuf juste après le bloc R-UX-9 (`majBoutonEnregistrer`, ≈ 224-240) :

```js
  {
    // Rendu du pas 1 : refus sous le champ, Réessayer, Entrée, lecture seule pendant la recherche (spec § 6).
    const appels = [];
    const gestes = { identifier: () => appels.push('identifier'), reessayer: () => appels.push('reessayer'), changerIsbn: () => {}, scanner: () => {}, saisirMain: () => {} };
    const p1 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '' }), gestes);
    const champ = p1.querySelector('input[name="isbn"]');
    eq([champ.getAttribute('maxlength'), champ.readOnly], ['20', false], 'livre : champ borné à 20, modifiable hors recherche (S8)');
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    eq(appels, ['identifier'], 'livre : Entrée identifie une fois ; répétition, composition et autres touches non (S3)');
    const pr = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '9781785035289', recherche: true, resultat: { statut: 'indisponible', motif: 'limite' } }), gestes);
    eq([pr.querySelector('input[name="isbn"]').readOnly, [...pr.querySelectorAll('button')].find((b) => b.textContent === 'Identifier').disabled, pr.querySelector('[data-role="reessayer"]'), pr.querySelector('[data-role="indisponible"]'), pr.textContent.includes('Recherche…')],
      [true, true, null, null, true], 'livre : pendant la recherche — champ en lecture seule, Identifier fermé, ni Réessayer ni message, « Recherche… » (F17)');
    const pi = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '9781785035289', resultat: { statut: 'indisponible', motif: 'limite' } }), gestes);
    eq([pi.querySelector('[data-role="indisponible"]')?.textContent.includes('trop de demandes'), [...pi.querySelectorAll('button')].filter((b) => b.textContent === 'Saisir à la main').length, pi.querySelectorAll('input[name="isbn"]').length, pi.querySelector('[data-role="reessayer"]')?.textContent],
      [true, 1, 1, 'Réessayer'], 'livre : indisponible → message + un seul « Saisir à la main » + Réessayer, toujours au pas 1');
    pi.querySelector('[data-role="reessayer"]').click();
    eq(appels, ['identifier', 'reessayer'], 'livre : « Réessayer » part par son geste');
    const pv = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, validation: 'controle' }), gestes);
    eq([pv.querySelector('[data-role="validation"]')?.textContent, pv.querySelector('.status.error, .error')], ['Cet ISBN n’est pas valide, vérifie les chiffres.', null], 'livre : le refus est sous le champ, sans carte rouge');
    const ph = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, resultat: { statut: 'indisponible', motif: '<img src=x onerror="window.__y=1">' } }), gestes);
    eq([ph.querySelectorAll('img').length, window.__y], [0, undefined], 'livre : un motif hostile reste du texte (S12)');
    const p2 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 2, isbn: '12345', champs: { title: 'T' } }), gestes);
    ok([...p2.querySelectorAll('span.muted')].some((s) => s.textContent === 'ISBN 12345 — non valide, ne sera pas enregistré'), 'livre : au pas 2, un ISBN invalide est annoncé comme non enregistré (S8)');
    eq(LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1 }), gestes).querySelector('[data-role="indisponible"], [data-role="validation"]'), null, 'livre : sans rien à dire, rien n’est affiché');
  }
```

- [ ] **Step 2 : Lancer la suite, lire le rouge** — Expected: `❌` — `maxlength` null, Entrée muette, pas de `data-role="reessayer"`, rappel « ISBN 12345 » sans mention.

- [ ] **Step 3 : Implémenter**

Pas 1 de `renderLivreAjout` :

```js
  if (model.pas === 1) {
    // Entrée = Identifier (pas de <form> : un submit natif ferait naviguer le #). Répétition de touche et composition
    // IME ne déclenchent pas (S3) ; la garde d'une seule identification vit dans la route (I-G).
    const surTouche = (e) => { if (e.key !== 'Enter') return; e.preventDefault(); if (!e.repeat && !e.isComposing) g('identifier')(); };
    return el('section', { class: 'card stack livre-ajout' },
      el('p', null, t('Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.')),
      field(t('ISBN'), el('input', { type: 'text', name: 'isbn', inputmode: 'numeric', maxlength: '20', placeholder: '978…', value: model.isbn, readOnly: !!model.recherche, onInput: (e) => g('changerIsbn')(e.target.value), onKeydown: surTouche })),
      model.messages.validation ? el('small', { class: 'muted', dataset: { role: 'validation' } }, model.messages.validation) : null,
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', disabled: !model.lecteurDisponible || model.recherche, onClick: g('scanner') }, t('Scanner le code-barres')),
        el('button', { type: 'button', class: 'btn primary', disabled: model.recherche, onClick: g('identifier') }, t('Identifier')),
        el('button', { type: 'button', class: 'btn link', onClick: g('saisirMain') }, t('Saisir à la main'))),
      model.messages.lecteur ? el('small', { class: 'muted' }, model.messages.lecteur) : null,
      model.messages.recherche ? el('div', { class: 'muted' }, model.messages.recherche) : null,
      // Indisponible : le message vrai, puis UN bouton Réessayer (F17 : pas de second « Saisir à la main »).
      model.messages.indisponible ? el('div', { class: 'stack', dataset: { role: 'indisponible' } },
        el('div', { class: 'muted' }, model.messages.indisponible),
        model.peutReessayer ? el('button', { type: 'button', class: 'btn primary', dataset: { role: 'reessayer' }, onClick: g('reessayer') }, t('Réessayer')) : null) : null,
      el('small', { class: 'muted' }, model.messages.sources));
  }
```

(La ligne `model.messages.provenance ? …` du pas 1 disparaît : la provenance ne se dit qu'au pas 2.) Au pas 2, remplacer `` `${t('ISBN')} ${model.isbn}` `` par `model.messages.rappelIsbn`. `sw.js` : `VERSION = 'cuisine-os-v0.4.1-5'`.

- [ ] **Step 4 : Lancer la suite, vert** — Expected: `✅`.

- [ ] **Step 5 : Commit**

```bash
git add src/ui/livre-ajout.js sw.js tests/ajouter.js
git commit -m "Pas 1 : refus sous le champ, Reessayer, Entree identifie, champ en lecture seule pendant la recherche" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 : Route — `deps`, génération (I-G), identifier à trois issues, langue reçue, R-UX-13 sur `deps`

**Files:**
- Modify: `src/ui/livre-ajout.js` (`renderLivreAjoutRoute` ≈ 197-304 : signature, `etat`, `identifier`, gestes `reessayer`/`saisirMain`/`retourIsbn`/`changerChamp`/`scanner`/`enregistrer`, couverture via `fetch` injecté)
- Modify: `tests/ajouter.js` (bloc R-UX-13 ≈ 631-775 : `deps` ; bloc neuf « route, partie A »)

**Interfaces:**
- Consumes: `lookupIsbn` (tâches 2-3), `livreAjoutModel` (4), rendu (5), `validerIsbn`/`codeBarresVersIsbn` (1), `GOOGLE_BOOKS` (3), `attenteReelle` (2).
- Produces: `renderLivreAjoutRoute(params, query, ctx, deps = {})` avec `deps = { fetch, enLigne, attendre, cle, naviguer, tentativeMs, repriseMs }` (défauts = production). Le routeur (`app.js:81`) ne passe pas `deps`.

- [ ] **Step 1 : Écrire les tests (rouge)**

(a) Bloc R-UX-13 (≈ 631-775) : remplacer `globalThis.fetch = async (url) => {` par `const fetchFactice = async (url) => {` ; supprimer `const vraiFetch = globalThis.fetch;` et le `finally { globalThis.fetch = vraiFetch; }` (garder `try { … } finally { }` vide ou retirer le try) ; définir après le stub `const deps = { fetch: fetchFactice, attendre: async () => {}, tentativeMs: 50, naviguer: () => {} };` et passer `deps` en 4ᵉ argument à **chaque** `LA.renderLivreAjoutRoute({}, {}, {})` du bloc. Le cas 4 redevient le cas Google **avec clé** : `const r4 = await LA.renderLivreAjoutRoute({}, {}, {}, { ...deps, cle: 'k' });` et

```js
        eq([depuis.some((u) => u.startsWith('https://covers.openlibrary.org/')), depuis.some((u) => u.startsWith('https://www.googleapis.com/books/')), r4.textContent.includes('Renseigné par Google Books')],
          [false, true, true], 'route : une fiche venue de Google Books (clé injectée) ne demande AUCUNE couverture à Open Library (I-A)');
```

(le stub `googleapis` du bloc rend déjà un volume ; lui donner `blob` comme aux autres).

(b) Bloc neuf, après le bloc R-UX-13 :

```js
  {
    // La route avec deps injectées (F3) : validation, hors ligne, indisponible → Réessayer, Entrée, une seule
    // identification (I-G), langue reçue (F5), sorties après un échec (F7). Aucun réseau, base jetable.
    const { withRepo } = await import('./sync-fixture.js');
    const reponseJson = (o, status = 200) => ({ ok: status < 300, status, headers: new Headers(), blob: async () => new Blob([JSON.stringify(o)], { type: 'application/json' }) });
    const r404 = { ok: false, status: 404, headers: new Headers(), blob: async () => new Blob([]) };
    const attendre = async (condition, quoi) => { for (let i = 0; i < 300; i += 1) { if (condition()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error(`attente dépassée (3 s) : ${quoi}`); };
    const taper = (root, isbn) => { const i = root.querySelector('input[name="isbn"]'); i.value = isbn; i.dispatchEvent(new Event('input')); };
    const cliquer = (root, texte) => { const b = [...root.querySelectorAll('button')].find((x) => x.textContent === texte); if (!b) throw new Error(`bouton absent : ${texte}`); b.click(); };
    const entree = (root) => root.querySelector('input[name="isbn"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const titreDe = (root) => [...root.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn');
    const rappel = (root) => [...root.querySelectorAll('span.muted')].find((s) => s.textContent.startsWith('ISBN'))?.textContent ?? null;
    await withRepo(async () => {
      const urls = [];
      const recherches = () => urls.filter((u) => u.includes('/search.json')).length; // la couverture passe aussi par fetch
      let search = () => reponseJson({ docs: [{ title: 'Livre', language: ['eng'] }] });
      const fetch = async (u) => { const s = String(u); urls.push(s); if (s.startsWith('https://openlibrary.org/search.json')) return search(); return r404; };
      const deps = { fetch, enLigne: () => true, attendre: async () => {}, tentativeMs: 50, naviguer: () => {} };
      // 1. ISBN faux : aucun appel, la saisie reste.
      const rA = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rA, '9781785035280'); cliquer(rA, 'Identifier');
      eq([urls.length, rA.querySelector('[data-role="validation"]')?.textContent, rA.querySelector('input[name="isbn"]')?.value], [0, 'Cet ISBN n’est pas valide, vérifie les chiffres.', '9781785035280'], 'route : un ISBN faux est refusé sans appel, la saisie reste (§ 4)');
      taper(rA, '5901234123457'); entree(rA);
      eq([urls.length, rA.querySelector('[data-role="validation"]')?.textContent], [0, 'Ce code-barres n’est pas un ISBN.'], 'route : un EAN qui n’est pas un livre est refusé sans appel');
      // 2. Hors ligne : aucun appel, dit ; Réessayer force l'appel (S13) ; la langue reçue arrive au sélecteur (F5).
      const rB = await LA.renderLivreAjoutRoute({}, {}, {}, { ...deps, enLigne: () => false });
      taper(rB, '9781785035289'); cliquer(rB, 'Identifier');
      eq([urls.length, rB.querySelector('[data-role="indisponible"]')?.textContent.includes('Tu es hors ligne.'), !!rB.querySelector('[data-role="reessayer"]')], [0, true, true], 'route : hors ligne → aucun appel, dit, Réessayer offert');
      cliquer(rB, 'Réessayer');
      await attendre(() => rB.querySelector('.status.info'), 'pas 2 après Réessayer');
      eq([recherches(), rB.querySelector('select').value, titreDe(rB).value], [1, 'en', 'Livre'], 'route : Réessayer force l’appel malgré onLine (S13) ; la langue reçue arrive au sélecteur (F5)');
      // 3. 429 → pas 1, message vrai, Réessayer ; puis 200 → pas 2.
      urls.length = 0; search = () => reponseJson({}, 429);
      const rC = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rC, '9782890772816'); entree(rC);
      await attendre(() => rC.querySelector('[data-role="reessayer"]'), 'indisponible après 429');
      eq([recherches(), rC.querySelector('[data-role="indisponible"]')?.textContent.includes('trop de demandes'), !!rC.querySelector('input[name="isbn"]'), [...rC.querySelectorAll('button')].filter((b) => b.textContent === 'Saisir à la main').length], [1, true, true, 1], 'route : Entrée identifie ; 429 → pas 1, message vrai, Réessayer, un seul « Saisir à la main » (F17)');
      search = () => reponseJson({ docs: [{ title: 'Carnet', language: ['fre'] }] });
      cliquer(rC, 'Réessayer'); cliquer(rC, 'Réessayer');
      await attendre(() => rC.querySelector('.status.info'), 'pas 2 après Réessayer');
      eq([recherches(), rC.querySelector('.status.info').textContent, titreDe(rC).value, rC.querySelector('select').value, rappel(rC)], [2, 'Renseigné par Open Library — vérifie et corrige.', 'Carnet', 'fr', 'ISBN 9782890772816'], 'route : deux clics sur Réessayer = un appel ; il relance et remplit');
      // 4. F7 : après un échec, « Saisir à la main » et « ← Changer d’ISBN » effacent le message.
      urls.length = 0; search = () => reponseJson({}, 503);
      const rD = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rD, '0306406152'); cliquer(rD, 'Identifier');
      await attendre(() => rD.querySelector('[data-role="reessayer"]'), 'indisponible après 503');
      ok(rD.querySelector('[data-role="indisponible"]').textContent.includes('en panne'), 'route : 503 = « en panne »');
      cliquer(rD, 'Saisir à la main');
      eq([rD.querySelector('[data-role="indisponible"]'), rD.querySelector('.status.info'), rappel(rD)], [null, null, 'ISBN 9780306406157'], 'route : « Saisir à la main » après un échec → pas 2 muet, ISBN normalisé en 13 (F7, F22)');
      cliquer(rD, '← Changer d’ISBN');
      eq([rD.querySelector('[data-role="indisponible"]'), rD.querySelector('input[name="isbn"]').value, rD.querySelector('input[name="isbn"]').readOnly], [null, '9780306406157', false], 'route : retour au pas 1 sans message, champ modifiable (F7)');
      // 5. I-G : une identification à la fois ; lecture seule pendant la recherche.
      urls.length = 0; let liberer = null; search = () => new Promise((r) => { liberer = () => r(reponseJson({ docs: [{ title: 'Lent' }] })); });
      const rE = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rE, '9780306406157'); entree(rE);
      await attendre(() => liberer, 'premier appel en vol');
      eq([rE.querySelector('input[name="isbn"]').readOnly, rE.textContent.includes('Recherche…')], [true, true], 'route : champ en lecture seule et « Recherche… » pendant l’appel (S3)');
      entree(rE); cliquer(rE, 'Identifier');
      liberer();
      await attendre(() => rE.querySelector('.status.info'), 'pas 2');
      eq(recherches(), 1, 'route : Entrée et clic pendant la recherche ne partent pas (I-G)');
      // 6. « Nouvel essai… » visible pendant la reprise (surReprise → redessin, F26).
      urls.length = 0; let n = 0; let libererReprise = null;
      search = () => { n += 1; if (n === 1) throw new Error('reseau'); return new Promise((r) => { libererReprise = () => r(reponseJson({ docs: [{ title: 'Repris' }] })); }); };
      const rF = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rF, '9780306406157'); cliquer(rF, 'Identifier');
      await attendre(() => libererReprise, 'seconde tentative en vol');
      ok(rF.textContent.includes('Nouvel essai…'), 'route : la reprise est dite pendant qu’elle a lieu (S11)');
      libererReprise();
      await attendre(() => rF.querySelector('.status.info'), 'pas 2 après reprise');
      eq([recherches(), titreDe(rF).value], [2, 'Repris'], 'route : la reprise a trouvé');
    });
  }
```

- [ ] **Step 2 : Lancer la suite, lire le rouge** — Expected: `❌` — le bloc R-UX-13 part sur le vrai réseau ou échoue (`deps` ignorées), `urls.length` ≠ 0 sur l'ISBN faux, pas 2 ouvert sur un 429.

- [ ] **Step 3 : Implémenter la route**

Remplacer `renderLivreAjoutRoute` de sa signature jusqu'à la fin de `identifier` (≈ 197-240) :

```js
// La route : état + gestes réels, re-rendu complet à chaque changement (le formulaire est petit). Dépendances par
// `deps` (F3) : les défauts sont la production ; le routeur n'en passe aucune. I-G : `generation` avance à chaque
// identification, « Saisir à la main » et « ← Changer d'ISBN » — une réponse d'une génération passée n'écrit rien.
export async function renderLivreAjoutRoute(params, query, ctx, deps = {}) {
  const { fetch = globalThis.fetch, enLigne = () => navigator.onLine !== false, attendre = attenteReelle, cle = GOOGLE_BOOKS.key, naviguer = navigate, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = deps;
  // `touchee` (R-UX-13) : la personne a agi sur la couverture (choisi une image, ou retiré). Une réponse distante
  // tardive ne défait jamais un geste — même si l'ISBN, lui, n'a pas changé.
  const COUVERTURE_VIDE = () => ({ sha256: null, apercu: null, message: null, enCours: false, touchee: false });
  const etat = { pas: 1, isbn: '', champs: CHAMPS_VIDES(), langueChoisie: false, provenance: null, recherche: false, reprise: false, validation: null, resultat: null, generation: 0, enCours: false, lecteurDisponible: 'BarcodeDetector' in window, existantes: cuisinesExistantes(ctx), couverture: COUVERTURE_VIDE() };
  const root = el('div', null, pageHeader(t('Ajouter un livre'), { back: { href: '/add', label: t('Ajouter') } }));
  const zone = el('div', null);
  root.append(zone);
  const modele = () => ({ ...livreAjoutModel({ ...etat, cleGoogle: !!cle }), existantes: etat.existantes });
  const dessiner = () => zone.replaceChildren(renderLivreAjout(modele(), gestes));
  // Tout geste qui change l'ISBN ou le pas ferme la porte aux réponses en vol (I-G) et libère la recherche.
  const nouvelleGeneration = () => { etat.generation += 1; etat.recherche = false; etat.reprise = false; etat.validation = null; etat.resultat = null; };
  const identifier = async ({ forcer = false } = {}) => {
    if (etat.recherche) return; // I-G : une identification à la fois (Entrée, Réessayer et le clic passent tous ici)
    const v = validerIsbn(etat.isbn);
    if (!v.ok) {
      if (v.motif === 'vide') { toast(t('Saisis un ISBN d’abord.')); return; }
      etat.validation = v.motif; dessiner(); return; // aucun appel
    }
    etat.validation = null; etat.isbn = v.isbn13;
    if (!forcer && !enLigne()) { etat.resultat = { statut: 'indisponible', motif: 'horsligne', google: 'non_appele' }; dessiner(); return; } // S13 : Réessayer force
    etat.generation += 1;
    const gen = etat.generation;
    etat.recherche = true; etat.reprise = false; etat.resultat = null;
    // Une provenance ne survit pas à l'ISBN qui l'a produite (I-B) ; la COUVERTURE non plus (R-UX-13).
    etat.provenance = null; etat.couverture = COUVERTURE_VIDE();
    dessiner();
    const ctl = new AbortController();
    const chrono = setTimeout(() => ctl.abort(), LIMITES_ISBN.totalMs);
    try {
      const res = await lookupIsbn(v.isbn13, { fetch, signal: ctl.signal, cle, attendre, tentativeMs, repriseMs, surReprise: () => { if (gen === etat.generation) { etat.reprise = true; dessiner(); } } });
      if (gen !== etat.generation) return; // la réponse d'une autre génération n'écrit rien (I-G)
      if (res.statut === 'trouve') {
        // F5 : la langue reçue arrive au sélecteur — sauf si la personne l'a choisie elle-même ; repli « fr ».
        etat.champs = fusionnerFiche({ ...etat.champs, language: etat.langueChoisie ? etat.champs.language : '' }, res.fiche);
        if (!etat.champs.language) etat.champs.language = 'fr';
        etat.provenance = res.source; etat.pas = 2;
        if (res.source === 'openlibrary') {
          const isbnDemande = v.isbn13;
          recupererCouvertureParIsbn(isbnDemande, { fetch, signal: AbortSignal.timeout(LIMITES_ISBN.delaiMs) }).then(async (blob) => {
            // R-UX-13 + I-G : cette réponse appartient à SA demande et à SA génération.
            if (gen !== etat.generation || etat.isbn !== isbnDemande || etat.couverture.sha256 || etat.couverture.touchee) return;
            if (!blob) { etat.couverture = { ...etat.couverture, message: t('Aucune couverture reçue. Tu peux la photographier.') }; dessiner(); return; }
            etat.couverture = { ...etat.couverture, enCours: true }; dessiner();
            try {
              const { sha256 } = await poserCouverture(blob, { origine: 'distante' });
              if (gen !== etat.generation || etat.isbn !== isbnDemande || etat.couverture.touchee) return;
              const ligne = await repo.getFile(sha256);
              etat.couverture = { sha256, apercu: urlDeBlob(ligne.blob), message: t('Couverture reçue d’Open Library.'), enCours: false, touchee: false };
            } catch { etat.couverture = { ...etat.couverture, enCours: false, message: t('Aucune couverture reçue. Tu peux la photographier.') }; }
            dessiner();
          }).catch(() => { /* une couverture n'est jamais essentielle : aucun rejet non traité, aucune carte rouge */ });
        }
      } else if (res.statut === 'introuvable') { etat.provenance = 'aucune'; etat.resultat = res; etat.pas = 2; }
      else { etat.resultat = res; } // indisponible : on reste au pas 1, ISBN conservé, Réessayer offert
    } finally {
      clearTimeout(chrono);
      if (gen === etat.generation) { etat.recherche = false; etat.reprise = false; dessiner(); }
    }
  };
```

**Attention** : la branche couverture ci-dessus doit reproduire **exactement** la logique existante (≈ 222-238 : messages, `poserCouverture`, `repo.getFile`, `urlDeBlob`, gardes) en y ajoutant seulement `gen !== etat.generation ||` aux deux gardes et `fetch` injecté — relis le code actuel et garde ses textes (`t('Aucune couverture reçue. Tu peux la photographier.')`, `t('Couverture reçue d’Open Library.')`) tels quels ; si l'existant diffère du bloc ci-dessus, l'existant gagne.

Puis dans `gestes` :

```js
    reessayer: () => identifier({ forcer: true }),
    scanner: async () => {
      const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
      if (!files.length) return;
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
        const bmp = await createImageBitmap(files[0]);
        const code = codeBarresVersIsbn(await detector.detect(bmp));
        if (!code) { toast(t('Aucun ISBN lu sur cette photo.')); return; }
        etat.isbn = code; await identifier();
      } catch { toast(t('Lecture du code-barres impossible.')); }
    },
    saisirMain: () => {
      nouvelleGeneration();
      const v = validerIsbn(etat.isbn);
      etat.isbn = v.ok ? v.isbn13 : nettoyerIsbn(etat.isbn).slice(0, 20); // affiché = enregistré quand valide ; borné sinon (S8/F22)
      etat.provenance = null; etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; etat.pas = 2; dessiner();
    },
    changerChamp: (k, v) => { if (k === 'language') etat.langueChoisie = true; etat.champs[k] = v; majBoutonEnregistrer(zone, modele()); },
    retourIsbn: () => { nouvelleGeneration(); etat.pas = 1; etat.provenance = null; etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; dessiner(); },
```

(`changerIsbn`, `basculerCuisine`, `ajouterCuisine`, `couverture` inchangés ; dans `enregistrer`, remplacer `navigate(` par `naviguer(` et `livreAjoutModel(etat)` par `modele()`.) Vérifier que plus aucun `livreAjoutModel(etat)` nu ne reste dans la route (le `cleGoogle` passe par `modele()`). `sw.js` : `VERSION = 'cuisine-os-v0.4.1-6'`.

- [ ] **Step 4 : Lancer la suite, vert** — Expected: `✅`, zéro `.ko`, **zéro requête réseau sortante** (le lanceur affiche une ligne `HTTP 4xx` ou une erreur console si la route a touché `openlibrary.org` — ce serait un défaut d'injection).

- [ ] **Step 5 : Commit**

```bash
git add src/ui/livre-ajout.js sw.js tests/ajouter.js
git commit -m "Route livre : deps injectees, generation (une identification a la fois), trois issues a l ecran, langue recue au selecteur" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7 : Preuves de concurrence et d'écriture (I-G, S3, S8, F15)

**Files:**
- Modify: `tests/ajouter.js` (bloc neuf après celui de la tâche 6)
- Modify (si un rouge le demande) : `src/ui/livre-ajout.js`

**Interfaces:**
- Consumes: la route de la tâche 6 (`deps.naviguer`, `withRepo`).
- Produces: rien de neuf ; des preuves. Si un test ici est rouge, c'est un défaut de la tâche 6 à corriger **dans cette tâche**, en nommant le ruling R-ISBN-n au registre.

- [ ] **Step 1 : Écrire les tests**

```js
  {
    // Réponses tardives et croisées (S3/I-G), écriture de l'édition (F15), ISBN libre (S8). Base jetable, aucun réseau.
    const { withRepo } = await import('./sync-fixture.js');
    const reponseJson = (o) => ({ ok: true, status: 200, headers: new Headers(), blob: async () => new Blob([JSON.stringify(o)], { type: 'application/json' }) });
    const r404 = { ok: false, status: 404, headers: new Headers(), blob: async () => new Blob([]) };
    const attendre = async (condition, quoi) => { for (let i = 0; i < 300; i += 1) { if (condition()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error(`attente dépassée (3 s) : ${quoi}`); };
    const taper = (root, isbn) => { const i = root.querySelector('input[name="isbn"]'); i.value = isbn; i.dispatchEvent(new Event('input')); };
    const cliquer = (root, texte) => { const b = [...root.querySelectorAll('button')].find((x) => x.textContent === texte); if (!b) throw new Error(`bouton absent : ${texte}`); b.click(); };
    const titreDe = (root) => [...root.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn');
    const rappel = (root) => [...root.querySelectorAll('span.muted')].find((s) => s.textContent.startsWith('ISBN'))?.textContent ?? null;
    await withRepo(async (repo, db) => {
      const urls = []; const enVol = new Map(); // isbn → fonction qui libère la réponse search.json
      const fetch = async (u) => { const s = String(u); urls.push(s); if (s.startsWith('https://openlibrary.org/search.json')) { const isbn = new URL(s).searchParams.get('isbn'); return new Promise((r) => { enVol.set(isbn, () => r(reponseJson({ docs: [{ title: `Livre ${isbn}` }] }))); }); } return r404; };
      const liberer = (isbn) => { const f = enVol.get(isbn); enVol.delete(isbn); f(); };
      const navigations = [];
      const deps = { fetch, enLigne: () => true, attendre: async () => {}, tentativeMs: 5000, naviguer: (p) => navigations.push(p) };
      const A = '9780306406157', B = '9782890772816';
      // 1. « Saisir à la main » pendant la recherche : la réponse tardive n'écrit rien (I-G).
      const r1 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r1, A); cliquer(r1, 'Identifier');
      await attendre(() => enVol.has(A), 'A en vol');
      cliquer(r1, 'Saisir à la main');
      liberer(A);
      await new Promise((r) => setTimeout(r, 50));
      eq([titreDe(r1).value, r1.querySelector('.status.info'), rappel(r1)], ['', null, `ISBN ${A}`], 'route : la réponse d’une identification abandonnée par « Saisir à la main » n’écrit rien (I-G)');
      // 2. Croisement A puis B : seule B écrit ; la couverture n'est demandée qu'une fois (pour B).
      const r2 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r2, A); cliquer(r2, 'Identifier');
      await attendre(() => enVol.has(A), 'A en vol (2)');
      cliquer(r2, 'Saisir à la main'); cliquer(r2, '← Changer d’ISBN');
      taper(r2, B); cliquer(r2, 'Identifier');
      await attendre(() => enVol.has(B), 'B en vol');
      liberer(A);
      await new Promise((r) => setTimeout(r, 30));
      eq([r2.querySelector('.status.info'), !!r2.querySelector('input[name="isbn"]')], [null, true], 'route : la réponse de A, arrivée pendant B, n’écrit rien et ne quitte pas le pas 1 (S3)');
      liberer(B);
      await attendre(() => r2.querySelector('.status.info'), 'B remplie');
      eq([titreDe(r2).value, rappel(r2), urls.filter((u) => u.startsWith('https://covers.openlibrary.org/')).length], [`Livre ${B}`, `ISBN ${B}`, 1], 'route : les champs sont ceux de B seulement ; une seule couverture demandée, celle de B (S3, § 5)');
      // 3. « Ajouter ce livre » : ISBN-13 en base, navigation injectée (F15).
      cliquer(r2, 'Ajouter ce livre');
      await attendre(() => navigations.length === 1, 'navigation après enregistrement');
      const editions = await db.getAll('book_editions');
      eq([editions.length, editions[0].isbn, navigations[0] === `/books/${editions[0].id}?nouveau=1`], [1, B, true], 'route : l’édition porte l’ISBN-13, la navigation part vers la fiche (F15)');
      // 4. Saisie à la main invalide → édition sans ISBN ; 10 000 chiffres → rappel borné à 20, rien en base (S8).
      const r3 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r3, '12345'); cliquer(r3, 'Saisir à la main');
      eq(rappel(r3), 'ISBN 12345 — non valide, ne sera pas enregistré', 'route : rappel « non valide » (S8)');
      titreDe(r3).value = 'Sans ISBN'; titreDe(r3).dispatchEvent(new Event('input', { bubbles: true }));
      cliquer(r3, 'Ajouter ce livre');
      await attendre(() => navigations.length === 2, 'navigation 2');
      ok((await db.getAll('book_editions')).some((e) => e.isbn === null), 'route : un ISBN invalide est enregistré null (S8)');
      const r4 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r4, '9'.repeat(10000)); cliquer(r4, 'Saisir à la main');
      eq(rappel(r4), `ISBN ${'9'.repeat(20)} — non valide, ne sera pas enregistré`, 'route : une saisie démesurée est bornée à l’affichage (S8)');
      titreDe(r4).value = 'Long'; titreDe(r4).dispatchEvent(new Event('input', { bubbles: true }));
      cliquer(r4, 'Ajouter ce livre');
      await attendre(() => navigations.length === 3, 'navigation 3');
      eq((await db.getAll('book_editions')).filter((e) => e.isbn === null).length, 2, 'route : la suite démesurée n’atteint pas la base (S8)');
      ok(!urls.some((u) => u.includes('googleapis')), 'route : sans clé, Google Books jamais appelé');
    });
  }
```

- [ ] **Step 2 : Lancer la suite** — Expected: `✅` si la tâche 6 est juste ; sinon lire le rouge, corriger **le code** (pas le test, sauf erreur manifeste du test, consignée), relancer.

- [ ] **Step 3 : Commit**

```bash
git add tests/ajouter.js
git commit -m "Tests route : reponses tardives et croisees muettes (I-G), edition en ISBN-13 ou null, navigation injectee" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Si `src/ui/livre-ajout.js` a changé : l'ajouter au commit et incrémenter `VERSION` → `-7`.)

---

### Task 8 : Clôture — statique, docs, mesures réelles, spec § 11.2

**Files:**
- Modify: `tests/ajouter.js` (bloc statique : rendus neufs sans `html:`/`innerHTML` — déjà couvert par `MODULES_NEUFS` pour `livre-ajout.js` et `isbn.js` ; vérifier)
- Modify: `docs/architecture.md` (≈ 262), `CLAUDE.md` (nouvelle sous-section après « Page « Ajouter » et flux des livres livrés »), `docs/superpowers/specs/2026-10-14-identifier-un-livre-fiable-design.md` (§ 11.2)
- Create: `docs/google-books.md`
- Modify: `sw.js` (`VERSION` finale)

- [ ] **Step 1 : Statique**

Vérifier dans `tests/ajouter.js` que `MODULES_NEUFS` contient `'../src/core/isbn.js'` et `'../src/ui/livre-ajout.js'` (le test S14 et F13 couvrent les deux) ; que le test de forme de la clé (tâche 3) et les deux pins `0.4.1` sont présents. Lancer la suite : `✅`. Lancer aussi `cd ~/projects/mistu-isbn && node --test tools/*.test.mjs` (40/40 attendu) et `node tools/generer-migrations.mjs --check` (0 attendu : aucun schéma touché).

- [ ] **Step 2 : Mesures réelles (réseau réel, hors suite)**

Écrire `.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/mesure.cjs` (Playwright local, `channel: 'chrome'`, headless ; modèle : `suite.cjs`) qui ouvre `http://localhost:8082/#/add/livre`, clique « Continuer sans compte » si présent, puis : (1) tape `9781785035289`, Entrée → attend « Renseigné par Open Library », imprime titre/auteur/éditeur/année/langue et le **nombre** de requêtes vers `openlibrary.org/search.json` (attendu 1) ; (2) « ← Changer d'ISBN », tape `9782890772816`, « Identifier » → idem (langue attendue `fr`) ; (3) tape `9781785035280`, « Identifier » → message « pas valide », **zéro** requête nouvelle ; (4) `context.setOffline(true)`, tape `9780306406157`, « Identifier » → « Tu es hors ligne. » + bouton « Réessayer », zéro requête ; (5) `setOffline(false)`, « Réessayer » → trouvé. Coller la sortie dans le rapport de tâche et dans `CLAUDE.md` (sous-section ci-dessous). Si Open Library est en panne au moment de la mesure : le dire, et montrer que l'écran dit « en panne »/« n'a pas répondu » avec « Réessayer » (c'est aussi une preuve).

- [ ] **Step 3 : Docs**

`docs/architecture.md` ≈ 262 : remplacer « lookupIsbn (Open Library puis Google Books en repli) » par « lookupIsbn (trois issues : trouvé / introuvable / indisponible avec motif ; Open Library `search.json` puis legacy en filet, Google Books seulement avec `GOOGLE_BOOKS.key` ; une tentative = un budget, une reprise sur échec muet) » et ajouter une ligne `src/core/isbn.js  nettoyerIsbn/validerIsbn/codeBarresVersIsbn : contrôle, conversion 10↔13, filtre du code-barres ; pur.`

`docs/google-books.md` (une page) : pourquoi la clé est publique ; les **murs** (projet Google Cloud dédié **sans facturation**, restriction d'API « Books API » seule, quota abaissé dans IAM → Quotas, restriction par référent `https://neegans.github.io/*` + `http://localhost:8082/*` + le sous-domaine D5 le jour venu) ; les étapes dans la console ; coller dans `src/sync/config.js` → `GOOGLE_BOOKS.key` ; incrémenter `VERSION` ; si la protection de push de GitHub refuse la chaîne `AIza…` : passer par l'écran de contournement (« utilisé en public par conception ») ; **mesure à faire avec la clé** : un ISBN absent d'Open Library (p. ex. un livre très récent) → « Renseigné par Google Books », et vérifier dans la console réseau que la requête porte `Referer: https://neegans.github.io/` (strict-origin) et que Google l'accepte — sur Chrome **et** Safari.

`CLAUDE.md` : sous-section « ### Identifier un livre, fiable (14 octobre 2026) » : où (branche, worktree, port, spec, plan, registre), ce qui marche (éprouvé par la suite : liste courte), ce qui n'est PAS prouvé (Safari/iPhone ; chemin Google avec clé ; référent `strict-origin` accepté par Google), dettes (S4d : quitter la route n'abandonne pas la requête ; chemin `pickFiles` du lecteur hors suite), versions (`APP_VERSION 0.4.1`, `VERSION` finale), bilan de la suite et des mesures réelles. Rappeler : fusion **après** le lot UX ; rebaser `isbn-fiable` si `ajouter-livres-ux` a bougé.

Spec § 11.2 : une ligne par ruling R-ISBN-n consigné au registre pendant la construction (au moins : « U+2028/2029 sont Zl/Zp, nommés explicitement dans `borner` » ; `langueChoisie` ; `nouvelleGeneration()` libère aussi `recherche`).

`sw.js` : `VERSION = 'cuisine-os-v0.4.1-8'` (ou le suffixe libre suivant).

- [ ] **Step 4 : Suite finale** — `✅`, zéro `.ko` ; `tools` 40/40 ; `--check` 0 ; aucun U+2028/2029 dans les fichiers touchés (`python3 -c` ou `grep -P '\x{2028}|\x{2029}'`).

- [ ] **Step 5 : Commit**

```bash
git add docs/architecture.md docs/google-books.md CLAUDE.md docs/superpowers/specs/2026-10-14-identifier-un-livre-fiable-design.md sw.js tests/ajouter.js
git commit -m "Cloture du lot Identifier un livre fiable : docs, procedure cle Google, mesures reelles, spec 11.2" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Après le plan (hors tâches, par le chef d'orchestre)

Revue finale de branche (modèle le plus capable) + une vague de corrections ; `/verify` (revue adverse + suite + scan secrets : aucun `AIza…`, aucune adresse personnelle) ; copier `.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/` dans `~/projects/mistu/.superpowers/sdd/` **avant** tout `git worktree remove` ; Neegan fusionne (`!`) après le lot UX, puis `git push` ; preuve sur le site public : les deux ISBN.
