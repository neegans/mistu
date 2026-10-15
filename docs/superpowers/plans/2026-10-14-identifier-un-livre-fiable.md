# Identifier un livre, fiable — plan d'implémentation (rév. 2, base `main dccafe4`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quand Neegan tape ou scanne un ISBN, l'app remplit la fiche (titre, auteur, langue, **mots-clés proposés**), ou dit la vraie raison (introuvable / service indisponible, motif nommé) et offre « Réessayer » ; un ISBN mal tapé est refusé avant tout appel ; une seule identification à la fois ; les mots-clés du livre servent la recherche de toutes ses recettes.

**Architecture:** Un module pur `src/core/isbn.js` (validation, conversion 10↔13, filtre du code-barres). Dans `src/ui/livre-ajout.js` : `lookupIsbn` rend un **statut** (`trouve` / `introuvable` / `indisponible` + motif) après Open Library `search.json` (API actuelle, une reprise sur échec muet), Open Library legacy en filet sur un « rien », Google Books seulement avec une clé ; chaque tentative a son budget (`AbortController`) relié au signal extérieur ; la fiche porte `motsCles` (propositions). La route étend les dépendances injectées de `main` (`{ repo, navigate, toast }`) et s'appuie sur sa **génération** (C1) pour qu'une réponse tardive n'écrive rien. `puces.js` gagne les suggestions ; `book.js` et `search.js` lisent `books.tags`.

**Tech Stack:** PWA sans build, modules ES natifs, pas de npm ; tests dans le navigateur (`tests/index.html` → `tests/ajouter.js`, `eq`/`ok`), bases jetables `withRepo` ; `fetch` injecté partout ; service worker `sw.js` (`SHELL`, `VERSION`) ; total d'assertions épinglé dans `tests/tests.js`.

**Spec:** `docs/superpowers/specs/2026-10-14-identifier-un-livre-fiable-design.md` (rév. 3 : § 1-11 le cœur, **§ 12 mots-clés**, **§ 13 ce que `main` a déjà réglé**). Lis-la **en entier** avant ta tâche. Registre SDD : `.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/progress.md` (rulings R-ISBN-n).

## Global Constraints

- **Arbre de travail : `~/projects/mistu-isbn` (branche `isbn-fiable`, rebasée sur `main dccafe4` + `606fdd9`), servi sur `http://localhost:8082/`.** Ne touche JAMAIS `~/projects/mistu`. Si 8082 ne répond pas : `cd ~/projects/mistu-isbn && nohup python3 -m http.server 8082 > /dev/null 2>&1 &`.
- **Lancer la suite** (sans fenêtre, cache purgé) : `node ~/projects/mistu-isbn/.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/suite.cjs 8082` → `BILAN : ✅ N/N tests réussis` ou `❌` + échecs (`.ko`) + console. **Base : 1378/1378**, une seule erreur console préexistante (`Failed to load resource … 404`), à ignorer. **Rouge d'abord** à chaque tâche.
- **Total épinglé (F2 du lot UX).** `tests/tests.js` ≈ ligne 180 : `eq(results.length, 1377, 'compte d’assertions : …')` — N = nombre d'assertions **avant** cette assertion même. **À chaque tâche** : après le vert des autres assertions, lire dans le `.ko` du total « obtenu : X », poser X dans `tests/tests.js`, relancer → tout vert. Ne jamais poser un nombre deviné.
- **Aucun réseau dans la suite** : `fetch`, `attendre`, `enLigne`, délais, `cle` injectés. Deux blocs de route de `main` (≈ 390-416 et 671-706) stubbent `globalThis.fetch` pour **refuser** tout réseau : ils restent tels quels.
- **Français, chaînes `t('…')` avec l'apostrophe typographique ’ (U+2019)** ; chaque chaîne neuve a son entrée dans `src/i18n/en.js` (clé = chaîne française exacte, la mécanique F13 du bloc statique la vérifie).
- **`sw.js`** : `SHELL` gagne `./src/core/isbn.js` (tâche 1, seul module neuf) ; `VERSION = 'cuisine-os-v0.4.1-N'`, **N = numéro de la tâche** dès qu'un fichier servi change. `APP_VERSION = '0.4.1'` dès la tâche 1 ; pins : `tests/ajouter.js` ≈ 1353-1355 et `tests/sync-l3.js` ≈ 1864. `main` est à `cuisine-os-v0.4.0-12`.
- **Commits** : messages **ASCII sans accents**, un par tâche au moins, **par fichiers nommés** (jamais `git add -A`/`.` : `.superpowers/` est non suivi), terminés par `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Pas de `push`, pas de fusion.
- **Pas de `html:`, `innerHTML`, `window.open`** dans les modules touchés ; texte par `textContent` via `el()`.
- **Invariants § 3** : I-B (un état d'écran = un événement réel), I-R (reprise seulement sur délai/réseau), I-G (une identification à la fois, génération = `avancer()` de `main`).
- **Noms déjà pris par `main`, à réutiliser tels quels** : `avancer()`, `oublierDistants()`, `champsDistants`, `langueTouchee`, `lireBornee(r, maxOctets)`, `signalDelai(ms)`, `fusionnerFiche(champs, fiche, { langueTouchee })`, deps `{ repo: r, navigate: nav, toast: dire }`, `root.etatRoute()`, `passagesCouverture`, `couverturesAppliquees`.
- **Table des fixtures du bloc R-UX-13 (`tests/ajouter.js` ≈ 952-1227)** — la garde S9 refuse un ISBN qui n'est pas un ISBN-13 ; chaque fixture courte est remplacée **partout** dans le bloc (`taper`, `couvertures.set`, `fichesLentes.set`, `sansFicheOl.add`, `Livre <isbn>` attendus, `etatRoute().isbn` attendus, `e.isbn === '…'`) par son ISBN-13 valide :

  | courte | ISBN-13 | courte | ISBN-13 |
  |---|---|---|---|
  | `'111'` | `'9780000001115'` | `'2223'` | `'9780000022233'` |
  | `'222'` | `'9780000002228'` | `'3334'` | `'9780000033345'` |
  | `'333'` | `'9780000003331'` | `'4445'` | `'9780000044457'` |
  | `'444'` | `'9780000004444'` | `'1230'` | `'9780000012302'` |
  | `'555'` | `'9780000005557'` | `'2340'` | `'9780000023407'` |
  | `'666'` | `'9780000006660'` | `'5556'` | `'9780000055569'` |
  | `'777'` | `'9780000007773'` | `'6667'` | `'9780000066671'` |
  | `'888'` | `'9780000008886'` | `'1234'` | `'9780000012340'` |
  | `'999'` | `'9780000009999'` | `'1010'` | `'9780000010100'` |
  | `'1112'` | `'9780000011121'` | | |

  Fais-le par un script (`node -e` ou `python3`) qui remplace les occurrences **entre apostrophes** et les deux `Livre 1112`/`Livre 2223` ; relis le diff.

## Review Focus

Entrées que la spec implique sans les nommer d'abord ; chacune a son test dans la tâche qui possède le code :

1. **Open Library répond 200 avec une page HTML** (maintenance derrière un 200) → `indisponible / serveur`, jamais une exception. → tâche 2.
2. **`attenteReelle` face à un signal déjà abandonné ou abandonné en cours** → rend tout de suite. → tâche 2.
3. **Double clic sur « Réessayer »** → un seul appel. → tâche 7.
4. **`first_publish_year` reçu en chaîne ou absent** → année ou `null`, jamais `NaN`. → tâche 2.
5. **Une suggestion qui ne diffère d'un mot-clé choisi que par l'accent ou la casse** (« BBQ » choisi, « bbq » proposé) → absente des suggestions. → tâche 6.
6. **`subject` absent de la réponse** → `motsCles: []`, aucun bloc de suggestions. → tâche 2 et 6.
7. **La clé `t()` à placeholder (« ISBN {i} — … »)** doit être dans `en.js` telle quelle (F13 extrait le littéral). → tâche 4.

---

### Task 1 : `src/core/isbn.js`, version 0.4.1, pins et total

**Files:**
- Create: `src/core/isbn.js`
- Modify: `src/ui/livre-ajout.js` (≈ 23 : `nettoyerIsbn` local → import + ré-export ; ligne d'import)
- Modify: `sw.js` (ligne 4 `VERSION`, liste `SHELL`), `src/model/schema.js` (ligne 6)
- Modify: `tests/ajouter.js` (après ≈ 211 `const LA = …` ; `MODULES_NEUFS` ≈ 1313 ; bloc statique ≈ 1352-1355), `tests/sync-l3.js` (≈ 1864), `tests/tests.js` (≈ 180)

**Interfaces:**
- Produces: `nettoyerIsbn(s) → string` (chiffres et X **majuscule**) ; `validerIsbn(texte) → { ok: true, isbn13, isbn10 } | { ok: false, motif: 'vide'|'longueur'|'controle'|'pas_isbn' }` ; `codeBarresVersIsbn(codes) → string | null`. `livre-ajout.js` ré-exporte `nettoyerIsbn` et importe `validerIsbn`, `codeBarresVersIsbn` (tâches 4 et 7).

- [ ] **Step 1 : Tests (rouge)** — insérer après `const LA = await import('../src/ui/livre-ajout.js');` :

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

Bloc statique (≈ 1352-1355) : ajouter `'./src/core/isbn.js'` à la liste `SHELL` testée ; `v0\.4\.0-\d+` → `v0\.4\.1-\d+`, `'0.4.0'` → `'0.4.1'` (libellés « 0.4.1 »). `MODULES_NEUFS` (≈ 1313) : ajouter `'../src/core/isbn.js'`. `tests/sync-l3.js` ≈ 1864 : `v0\.4\.0` → `v0\.4\.1`.

- [ ] **Step 2 : Suite → rouge** — Expected : « Suite Ajouter interrompue : … isbn.js » (404), pins rouges, total rouge.

- [ ] **Step 3 : Implémenter**

`src/core/isbn.js` :

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

`src/ui/livre-ajout.js` : supprimer `export const nettoyerIsbn = …` (≈ 23) ; ajouter `import { nettoyerIsbn, validerIsbn, codeBarresVersIsbn } from '../core/isbn.js';` après les imports existants, puis `export { nettoyerIsbn };`. `sw.js` : `SHELL` += `'./src/core/isbn.js'` (à côté de `'./src/core/lien.js'`), `VERSION = 'cuisine-os-v0.4.1-1'`. `src/model/schema.js` : `APP_VERSION = '0.4.1'`.

- [ ] **Step 4 : Suite → vert sauf le total ; poser le total ; vert.**

- [ ] **Step 5 : Commit**

```bash
git add src/core/isbn.js src/ui/livre-ajout.js sw.js src/model/schema.js tests/ajouter.js tests/sync-l3.js tests/tests.js
git commit -m "ISBN : module pur de validation (controle, 10<->13, code-barres), version 0.4.1" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2 : `lookupIsbn` — tentative à budget, classement, Open Library actuelle puis legacy, reprise, mots-clés proposés

**Files:**
- Modify: `src/ui/livre-ajout.js` (`LIMITES_ISBN` ≈ 16 ; `borner`/`annee` ≈ 24-25 ; `lireJson` + `lookupIsbn` ≈ 54-77 **supprimés** ; code neuf après `signalDelai` ; import de `puces.js` : + `normaliser, LIMITES_PUCES`)
- Modify: `tests/ajouter.js` (bloc ≈ 212-277 remplacé ; bloc R-UX-13 ≈ 952-1227 : fixtures + stub)

**Interfaces:**
- Consumes: `lireBornee(r, maxOctets)` (main), `normaliser`, `LIMITES_PUCES` (`puces.js`).
- Produces: `lookupIsbn(isbn13, { fetch, signal, cle = '', attendre = attenteReelle, surReprise = null, tentativeMs, repriseMs }) → { statut, fiche, source, motif, google, appels }` avec `fiche = { title, author, publisher, year, language, motsCles }` ; `attenteReelle(ms, signal)` exportée ; `MOTS_CLES_MAX = 10` exporté ; `LIMITES_ISBN = { champ: 300, corps: 262144, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 }`. `cle` acceptée mais **ignorée jusqu'à la tâche 3** (`google` = `'non_appele'`).

- [ ] **Step 1 : Tests (rouge)**

Remplacer, dans `tests/ajouter.js`, de `eq(LA.LIMITES_ISBN, …` (≈ 212) jusqu'à la fermeture du bloc `{ … }` qui contient `'livre : un 429 porteur d’une fiche valide reste un échec'` (≈ 277) par :

```js
  eq(LA.LIMITES_ISBN, { champ: 300, corps: 262144, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 }, 'livre : bornes S3 + délais du lot ISBN (F24 : delaiMs de la couverture intact)');
  eq(LA.OPTIONS_FETCH, { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }, 'livre : options de fetch explicites (S12)');
  eq(LA.nettoyerIsbn(' 978-2-7619-5000-1 '), '9782761950001', 'livre : ISBN sans tirets ni espaces');
  {
    // lookupIsbn : fetch, attente et délais injectés (aucune vraie attente). Une réponse factice sans body : lireBornee
    // rend false et le corps est lu par text(), comme sur main.
    const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
    const SEARCH = 'https://openlibrary.org/search.json?isbn=9781785035289&fields=title,author_name,publisher,first_publish_year,language,subject&limit=1';
    const LEGACY = 'https://openlibrary.org/api/books?bibkeys=ISBN:9781785035289&format=json&jscmd=data';
    const jamais = async () => { throw new Error('attendre ne doit pas être appelée'); };
    const sansAttente = async () => {};
    const chercher = (fetch, options = {}) => LA.lookupIsbn('9781785035289', { fetch, attendre: sansAttente, tentativeMs: 50, ...options });
    const VIDE = { title: 'T', author: '', publisher: '', year: null, language: null, motsCles: [] };
    // Garde S9 : une entrée qui n'est pas un ISBN-13 ne part jamais sur le réseau.
    let erreur = null; let appelsGarde = 0;
    try { await LA.lookupIsbn('9781&x=1', { fetch: async () => { appelsGarde += 1; return reponse(200, {}); } }); } catch (e) { erreur = e; }
    eq([erreur instanceof TypeError, appelsGarde], [true, 0], 'lookup : une entrée qui n’est pas un ISBN-13 lève avant tout appel (S9)');
    // Trouvé par search.json en un appel, fiche typée, mots-clés proposés (§ 12.2).
    const urls = [];
    const sujets = ['Barbecuing', 'barbecuing', 12, 'x'.repeat(80), 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const r1 = await chercher(async (u, o) => { urls.push([u, o]); return reponse(200, { numFound: 1, docs: [{ title: 'Berber and Q', author_name: ['Josh Katz'], publisher: ['Ebury Publishing', 'Penguin Random House'], first_publish_year: 2018, language: ['eng', 'fre'], subject: sujets }] }); }, { attendre: jamais });
    eq([r1.statut, r1.source, r1.appels, r1.motif, r1.google], ['trouve', 'openlibrary', 1, null, 'non_appele'], 'lookup : search.json répond → trouvé en un appel');
    eq([r1.fiche.title, r1.fiche.author, r1.fiche.publisher, r1.fiche.year, r1.fiche.language], ['Berber and Q', 'Josh Katz', 'Ebury Publishing', 2018, 'fr'], 'lookup : fiche typée, premier éditeur, le français d’abord');
    eq([r1.fiche.motsCles.length, r1.fiche.motsCles[0], r1.fiche.motsCles[1].length, r1.fiche.motsCles.includes('barbecuing'), LA.MOTS_CLES_MAX], [10, 'Barbecuing', 60, false, 10], 'lookup : mots-clés proposés — 10 au plus, tronqués à 60, dédoublonnés par normaliser, chaînes seulement (§ 12.2)');
    eq(urls[0][0], SEARCH, 'lookup : adresse de l’API actuelle, fields avec subject, sans isbn (F13, § 12.2)');
    ok(urls[0][1].signal instanceof AbortSignal && urls[0][1].mode === 'cors' && urls[0][1].credentials === 'omit' && urls[0][1].cache === 'no-store' && urls[0][1].referrerPolicy === 'no-referrer', 'lookup : options S12 + un signal par tentative');
    // « Rien » sans numFound → legacy en filet, champs typés, sujets legacy.
    const r2 = await chercher(async (u) => (u === SEARCH ? reponse(200, { docs: [] }) : reponse(200, { 'ISBN:9781785035289': { title: 'Legacy', authors: [{ name: 'A' }, { nom: 'x' }], publishers: [{ name: 'P' }], publish_date: 'March 2018', subjects: [{ name: 'Grill' }, { nom: 'x' }] } })), { attendre: jamais });
    eq([r2.statut, r2.source, r2.appels, r2.fiche], ['trouve', 'openlibrary', 2, { title: 'Legacy', author: 'A', publisher: 'P', year: 2018, language: null, motsCles: ['Grill'] }], 'lookup : « rien » (sans numFound) → legacy en filet, champs et sujets typés');
    const r3 = await chercher(async (u) => reponse(200, u === SEARCH ? { numFound: 0, docs: [] } : {}), { attendre: jamais });
    eq([r3.statut, r3.appels, r3.motif, r3.google, r3.fiche, r3.source], ['introuvable', 2, null, 'non_appele', null, null], 'lookup : deux « rien » → introuvable');
    const r4 = await chercher(async (u) => { if (u === SEARCH) return reponse(200, { docs: [] }); throw new Error('reseau'); }, { attendre: jamais });
    eq([r4.statut, r4.appels], ['introuvable', 2], 'lookup : le legacy qui tombe ne change pas le statut (search a répondu)');
    // Reprise (I-R).
    const attentes = []; let surReprises = 0;
    const r5 = await chercher(async () => { throw new Error('reseau'); }, { attendre: async (ms, s) => { attentes.push([ms, s === undefined || s instanceof AbortSignal]); }, repriseMs: 1500, surReprise: () => { surReprises += 1; } });
    eq([r5.statut, r5.motif, r5.appels, attentes, surReprises], ['indisponible', 'reseau', 2, [[1500, true]], 1], 'lookup : échec muet → une reprise, attendre(repriseMs, signal), surReprise une fois (I-R)');
    let n6 = 0;
    const r6 = await chercher(async () => { n6 += 1; if (n6 === 1) throw new Error('reseau'); return reponse(200, { docs: [{ title: 'T' }] }); });
    eq([r6.statut, r6.appels, r6.fiche], ['trouve', 2, VIDE], 'lookup : la reprise peut trouver ; sans subject, motsCles vide');
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
    const bidi = String.fromCodePoint(0x202e), sepLigne = String.fromCodePoint(0x2028);
    const r14 = await chercher(async () => reponse(200, { docs: [{ title: `T${bidi}${sepLigne}x`, author_name: 'x', publisher: [{}], language: 'french', first_publish_year: { a: 1 }, subject: 'x' }] }), { attendre: jamais });
    eq(r14.fiche, { title: 'Tx', author: '', publisher: '', year: null, language: null, motsCles: [] }, 'lookup : champs typés, Cc/Cf/U+2028 retirés, subject non tableau → [] (S6)');
    eq((await chercher(async () => reponse(200, { docs: [{ title: 'T', first_publish_year: '2018' }] }), { attendre: jamais })).fiche.year, 2018, 'lookup : une année reçue en chaîne reste une année');
    eq((await chercher(async () => reponse(200, { docs: [{ title: 'T'.repeat(400) }] }), { attendre: jamais })).fiche.title.length, 300, 'lookup : titre tronqué à 300 (S3)');
    // Corps en flux > 256 Kio : coupé par cancel(), jamais gardé (S7, via lireBornee).
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

Bloc R-UX-13 (≈ 952-1227), **sans toucher à sa logique** : (a) appliquer la **table des fixtures** (Global Constraints) ; (b) dans le stub `globalThis.fetch`, ajouter **avant** la branche `api/books` une branche `search.json` qui porte la porte `fichesLentes` (déplacée de la branche legacy) et une table `languesOl` :

```js
          if (u.startsWith('https://openlibrary.org/search.json')) {
            const isbn = new URL(u).searchParams.get('isbn');
            const lente = fichesLentes.get(isbn);
            if (lente) await lente;
            const corps = sansFicheOl.has(isbn) ? { numFound: 0, docs: [] } : { numFound: 1, docs: [{ title: `Livre ${isbn}`, author_name: [], publisher: [], first_publish_year: 2020, language: languesOl.get(isbn) || ['fre'] }] };
            return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(corps) };
          }
```

(déclarer `const languesOl = new Map();` à côté de `fichesLentes`) ; (c) cas 4 (`'666'` → `'9780000006660'`) devient « sans clé, un « rien » d'Open Library ne demande ni couverture ni Google » :

```js
        eq([depuis.some((u) => u.startsWith('https://covers.openlibrary.org/')), depuis.some((u) => u.startsWith('https://www.googleapis.com/books/')), r4.textContent.includes('Aucune fiche')],
          [false, false, true], 'route : sans clé, un « rien » d’Open Library ne demande ni couverture ni Google Books (I-A, § 5)');
```

(d) cas 10 (C2, `'5556'`/`'6667'`) : remplacer `sansFicheOl.add('…'); sansFicheOl.add('…');` par `languesOl.set('9780000055569', ['eng']); languesOl.set('9780000066671', ['eng']);` — la langue vient maintenant de `search.json` (C2 inchangé, libellés « via search.json »). Les cas 1-3, 5-9, 11-12 ne changent que par leurs fixtures.

- [ ] **Step 2 : Suite → rouge** — « Suite Ajouter interrompue » ou `lookup : …` rouges (`statut` absent, `attenteReelle` indéfinie), R-UX-13 rouge (garde S9 sur `'111'` tant que la table n'est pas appliquée).

- [ ] **Step 3 : Implémenter dans `src/ui/livre-ajout.js`**

Import : `import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes, normaliser, LIMITES_PUCES } from './puces.js';`. Remplacer `LIMITES_ISBN` (≈ 16) et les deux lignes `borner`/`annee` (≈ 24-25) ; **supprimer** `lireJson` et l'ancien `lookupIsbn` (≈ 54-77) ; insérer après `signalDelai` :

```js
export const LIMITES_ISBN = { champ: 300, corps: 256 * 1024, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 };
```

```js
// S3/S6 : une chaîne seulement, sans caractères de contrôle (Cc) ni de format (Cf : bidi…), ni les séparateurs de
// ligne U+2028/U+2029 (catégories Zl/Zp, nommés à part — R-ISBN-1), tronquée à 300. Tout ce qui n'est pas une
// chaîne vaut ''.
const borner = (s) => (typeof s === 'string' ? s.replace(/[\p{Cc}\p{Cf}\u{2028}\u{2029}]/gu, '').slice(0, LIMITES_ISBN.champ) : '');
const chaines = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const annee = (s) => { const m = String(s ?? '').match(/\b(\d{4})\b/); return m ? parseInt(m[1], 10) : null; };
const langueDe = (liste) => (!Array.isArray(liste) ? null : liste.includes('fre') ? 'fr' : liste.includes('eng') ? 'en' : null);
const ficheOk = (f) => (f && f.title ? f : null);
// § 12.2 : des PROPOSITIONS de mots-clés — 10 au plus, tronquées à la borne des puces, dédoublonnées par normaliser.
// Jamais posées sans la tape de la personne : fusionnerFiche ne les lit pas.
export const MOTS_CLES_MAX = 10;
const motsClesDe = (liste) => {
  const vus = new Map();
  for (const v of chaines(liste)) {
    const valeur = borner(v).trim().slice(0, LIMITES_PUCES.longueur);
    const cle = normaliser(valeur);
    if (cle && !vus.has(cle)) vus.set(cle, valeur);
    if (vus.size >= MOTS_CLES_MAX) break;
  }
  return [...vus.values()];
};
```

```js
// Attente abandonnable : rend tout de suite si le signal est déjà abandonné, et dès qu'il l'est.
export const attenteReelle = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) { resolve(); return; }
  const fin = () => { clearTimeout(id); signal?.removeEventListener('abort', fin); resolve(); };
  const id = setTimeout(fin, ms);
  signal?.addEventListener('abort', fin, { once: true });
});

const URL_OL_SEARCH = (isbn) => `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=title,author_name,publisher,first_publish_year,language,subject&limit=1`;
const URL_OL_LEGACY = (isbn) => `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;

// Une tentative = un budget (S4) : son AbortController couvre le fetch ET la lecture du corps ; il est relié au signal
// extérieur par un écouteur retiré en finally. Rend { ok: true, json } ou { ok: false, motif }. Ordre du classement
// (F14) : signal de la tentative abandonné → delai ; rejet → reseau ; 429 → limite ; autre non-2xx → serveur ;
// corps trop gros (lireBornee, S1) ou non JSON → serveur.
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
    let texte;
    try {
      const morceaux = await lireBornee(r, LIMITES_ISBN.corps);
      if (morceaux === null) return { ok: false, motif: 'serveur' };
      texte = morceaux === false ? await r.text() : await new Blob(morceaux).text();
    } catch { return echec(); }
    if (typeof texte !== 'string' || texte.length > LIMITES_ISBN.corps) return { ok: false, motif: 'serveur' };
    try { return { ok: true, json: JSON.parse(texte) }; } catch { return { ok: false, motif: 'serveur' }; }
  } finally { clearTimeout(chrono); signal?.removeEventListener('abort', relais); }
}

// Lecteurs : { repondu: true, fiche | null } si la forme est celle attendue, { repondu: false } sinon (→ serveur).
function lireSearch(json) {
  const docs = json?.docs;
  if (!Array.isArray(docs)) return { repondu: false };
  const d = docs[0];
  if (!d || typeof d !== 'object') return { repondu: true, fiche: null };
  return { repondu: true, fiche: ficheOk({ title: borner(d.title).trim(), author: borner(chaines(d.author_name).join(', ')), publisher: borner(chaines(d.publisher)[0]), year: annee(d.first_publish_year), language: langueDe(d.language), motsCles: motsClesDe(d.subject) }) };
}
const noms = (liste) => (Array.isArray(liste) ? liste.map((x) => (typeof x?.name === 'string' ? x.name : '')).filter(Boolean) : []);
function lireLegacy(json, isbn) {
  if (!json || typeof json !== 'object') return { repondu: false };
  const b = json[`ISBN:${isbn}`];
  if (!b || typeof b !== 'object') return { repondu: true, fiche: null };
  return { repondu: true, fiche: ficheOk({ title: borner(b.title).trim(), author: borner(noms(b.authors).join(', ')), publisher: borner(noms(b.publishers).join(', ')), year: annee(b.publish_date), language: null, motsCles: motsClesDe(noms(b.subjects)) }) };
}

// Trois issues (spec § 5) : trouve / introuvable (Open Library a répondu « rien ») / indisponible (motif). Étape 1 :
// search.json, une reprise sur échec muet (I-R). Étape 2 : legacy api/books, seulement après un « rien ». Étape 3
// (tâche 3) : Google Books, seulement avec une clé et après un « rien ». Jamais d'exception pour un échec de source ;
// une TypeError seulement pour un appelant qui ne passe pas un ISBN-13 (S9).
export async function lookupIsbn(isbn13, { fetch = globalThis.fetch, signal, cle = '', attendre = attenteReelle, surReprise = null, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = {}) {
  if (!/^97[89]\d{10}$/.test(String(isbn13))) throw new TypeError('lookupIsbn : ISBN-13 attendu');
  const bilan = { statut: 'indisponible', fiche: null, source: null, motif: null, google: 'non_appele', appels: 0 };
  const appel = async (url, options) => { bilan.appels += 1; return tentative(fetch, url, options, { tentativeMs, signal }); };
  const trouve = (fiche, source) => ({ ...bilan, statut: 'trouve', fiche, source });
  const abandonne = () => ({ ...bilan, motif: 'delai' });
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
  // Étape 2 : Open Library a répondu « rien » → le statut est acquis ; le legacy ne peut que trouver.
  if (signal?.aborted) return { ...bilan, statut: 'introuvable' };
  const r2 = await appel(URL_OL_LEGACY(isbn13), OPTIONS_FETCH);
  const lu2 = r2.ok ? lireLegacy(r2.json, isbn13) : null;
  if (lu2?.fiche) return trouve(lu2.fiche, 'openlibrary');
  return { ...bilan, statut: 'introuvable' };
}
```

La route de `main` lit encore `{ fiche, source }` : elle continue de marcher (le statut est ignoré jusqu'à la tâche 7 ; `fiche.motsCles` est ignoré par `fusionnerFiche`). `sw.js` : `VERSION = 'cuisine-os-v0.4.1-2'`.

- [ ] **Step 4 : Suite → vert ; poser le total ; vert.** Si R-UX-13 reste rouge : vérifier la table appliquée **partout** (dont `Livre 1112`/`Livre 2223`, `e.isbn === '…'`), la porte `fichesLentes` dans la branche `search.json`.

- [ ] **Step 5 : Commit**

```bash
git add src/ui/livre-ajout.js sw.js tests/ajouter.js tests/tests.js
git commit -m "lookupIsbn : trois issues, tentative a budget sur lireBornee, search.json puis legacy, une reprise sur echec muet, mots-cles proposes" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3 : Google Books avec clé, `GOOGLE_BOOKS`, `strict-origin`, catégories

**Files:**
- Modify: `src/sync/config.js` (export `GOOGLE_BOOKS` après `SUPABASE`)
- Modify: `src/ui/livre-ajout.js` (`lookupIsbn` étape 3 ; `URL_GOOGLE` ; `OPTIONS_GOOGLE` ; `lireGoogle` ; import `GOOGLE_BOOKS`)
- Modify: `tests/ajouter.js` (fin du bloc `lookupIsbn` ; bloc statique : test de forme de la clé), `tests/tests.js` (total)

**Interfaces:**
- Produces: `GOOGLE_BOOKS = { key: '' }` ; avec `cle` non vide, troisième appel `https://www.googleapis.com/books/v1/volumes?q=isbn:<13>&maxResults=1&key=<encodeURIComponent(cle)>` avec `referrerPolicy: 'strict-origin'` ; `google ∈ { 'non_appele', 'rien', 'echec' }` ; `fiche.motsCles` ← `volumeInfo.categories`.

- [ ] **Step 1 : Tests (rouge)** — à la fin du bloc `lookupIsbn` (avant son `}`) :

```js
    // Google Books : jamais sans clé ; avec clé, troisième appel, strict-origin, clé encodée ; jamais après un échec OL.
    const urls3 = [];
    const g0 = await chercher(async (u) => { urls3.push([u]); return reponse(200, u === SEARCH ? { docs: [] } : {}); }, { attendre: jamais });
    eq([g0.appels, urls3.some(([u]) => u.includes('googleapis'))], [2, false], 'lookup : sans clé, Google Books n’est jamais appelé');
    const stubGoogle = (reponseGoogle, search = { docs: [] }) => async (u, o) => { urls3.push([u, o]); if (u === SEARCH) return reponse(200, search); if (u === LEGACY) return reponse(200, {}); return reponseGoogle(u, o); };
    urls3.length = 0;
    const g1 = await chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: 'G', authors: ['X', 3], publisher: 'Q', publishedDate: '2001-02', language: 'fr', categories: ['Cooking / BBQ', 'cooking / bbq'] } }] })), { cle: 'k&x', attendre: jamais });
    eq([g1.statut, g1.source, g1.appels, g1.fiche], ['trouve', 'googlebooks', 3, { title: 'G', author: 'X', publisher: 'Q', year: 2001, language: 'fr', motsCles: ['Cooking / BBQ'] }], 'lookup : avec clé, Google Books est le troisième appel, champs et catégories typés');
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
    const ctl6 = new AbortController();
    urls3.length = 0;
    const g5 = await chercher(async (u, o) => { urls3.push([u, o]); if (u === SEARCH) return reponse(200, { docs: [] }); ctl6.abort(); return reponse(200, {}); }, { cle: 'k', signal: ctl6.signal, attendre: jamais });
    eq([g5.statut, g5.appels, g5.google], ['introuvable', 2, 'echec'], 'lookup : abandon après le legacy → Google jamais appelé, introuvable avec google = echec (S4c)');
```

Bloc statique (près des pins) :

```js
    const { GOOGLE_BOOKS } = await import('../src/sync/config.js');
    ok(typeof GOOGLE_BOOKS?.key === 'string' && (GOOGLE_BOOKS.key === '' || /^AIza[0-9A-Za-z_-]{35}$/.test(GOOGLE_BOOKS.key)), 'config : la clé Google Books est vide ou au format d’une clé d’API publique — un test de forme, jamais de valeur (S2/F2)');
```

- [ ] **Step 2 : Suite → rouge** — `GOOGLE_BOOKS` indéfini ; `g1.appels` 2 ; `g2.google` `'non_appele'`.

- [ ] **Step 3 : Implémenter**

`src/sync/config.js`, après `SUPABASE` :

```js
// Clé d'API Google Books, PUBLIQUE PAR CONCEPTION (spec « Identifier un livre, fiable » § 7) : vide = Google Books
// jamais appelé. Le jour où elle est posée, elle vient d'un projet Google Cloud DÉDIÉ et SANS facturation, restreinte
// à l'API Books, à un quota abaissé et aux référents du site — la restriction par référent seule est un dos-d'âne,
// pas un mur (S1). Jamais une clé sans restriction d'API. Procédure : docs/google-books.md.
export const GOOGLE_BOOKS = { key: '' };
```

`src/ui/livre-ajout.js` : `import { GOOGLE_BOOKS } from '../sync/config.js';` ; après `URL_OL_LEGACY` :

```js
const URL_GOOGLE = (isbn, cle) => `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1&key=${encodeURIComponent(cle)}`;
// § 7 : une clé restreinte par référent exige un Referer ; strict-origin envoie l'ORIGINE seule (jamais le chemin ni
// le #), et rien sur un déclassement HTTPS → HTTP. Google Books est le seul appel qui s'écarte de no-referrer (S12).
const OPTIONS_GOOGLE = { ...OPTIONS_FETCH, referrerPolicy: 'strict-origin' };
function lireGoogle(json) {
  if (!json || typeof json !== 'object') return { repondu: false };
  const items = json.items;
  const v = Array.isArray(items) && items[0] && typeof items[0] === 'object' ? items[0].volumeInfo : null;
  if (!v || typeof v !== 'object') return { repondu: true, fiche: null };
  return { repondu: true, fiche: ficheOk({ title: borner(v.title).trim(), author: borner(chaines(v.authors).join(', ')), publisher: borner(v.publisher), year: annee(v.publishedDate), language: v.language === 'fr' || v.language === 'en' ? v.language : null, motsCles: motsClesDe(v.categories) }) };
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

Commentaire d'en-tête : « Étape 3 : Google Books… ». `sw.js` : `VERSION = 'cuisine-os-v0.4.1-3'`.

- [ ] **Step 4 : Suite → vert ; total ; vert.**

- [ ] **Step 5 : Commit**

```bash
git add src/sync/config.js src/ui/livre-ajout.js sw.js tests/ajouter.js tests/tests.js
git commit -m "lookupIsbn : Google Books seulement avec cle (GOOGLE_BOOKS vide), strict-origin, categories en mots-cles, jamais apres un echec Open Library" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4 : `fabriquerLivre` (ISBN-13 ou `null`, `tags`), modèle `livreAjoutModel`, dictionnaire

**Files:**
- Modify: `src/ui/livre-ajout.js` (`CHAMPS_VIDES` ≈ 20 ; `livreAjoutModel` ≈ 173-180 ; `fabriquerLivre` ≈ 182-187)
- Modify: `src/i18n/en.js` (≈ 195-199), `tests/ajouter.js` (bloc modèle ≈ 301-310 ; bloc `fabriquerLivre` ≈ 312-316), `tests/tests.js`

**Interfaces:**
- Consumes: `validerIsbn` (tâche 1).
- Produces: `livreAjoutModel({ pas, isbn, champs, provenance, recherche, reprise, validation, resultat, suggestions, cleGoogle, lecteurDisponible, enCours })` → `{ …, reprise, validation, resultat, suggestions, cleGoogle, isbnValide, peutReessayer, messages: { provenance, recherche, lecteur, validation, indisponible, sources, rappelIsbn } }` ; `CHAMPS_VIDES().tags = []` ; `fabriquerLivre` écrit `edition.isbn = isbn13 | null` et `book.tags = [...c.tags]`.

- [ ] **Step 1 : Tests (rouge)** — remplacer le bloc modèle (≈ 301-310, de `const m = LA.livreAjoutModel({ pas: 1, isbn: '', …` à la fin de son `{ … }`) par :

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
    eq(LA.livreAjoutModel({ pas: 2, suggestions: { source: 'openlibrary', valeurs: ['bbq'] } }).suggestions, { source: 'openlibrary', valeurs: ['bbq'] }, 'livre : les suggestions passent telles quelles au rendu (§ 12.3)');
    eq(LA.livreAjoutModel({ pas: 2 }).champs.tags, [], 'livre : les champs vides portent tags: [] (§ 12.1)');
  }
```

Bloc `fabriquerLivre` (≈ 312-316) : remplacer `'9782761950001'` par `'9782890772816'` dans l'appel **et** l'édition attendue, puis ajouter avant la fermeture du bloc :

```js
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '0306406152' }, { newId: (p) => p }).edition.isbn, '9780306406157', 'livre : un ISBN-10 valide est enregistré en 13');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '12345' }, { newId: (p) => p }).edition.isbn, null, 'livre : un ISBN invalide n’est pas enregistré (S8)');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '9'.repeat(10000) }, { newId: (p) => p }).edition.isbn, null, 'livre : une suite libre de chiffres n’atteint jamais la base ni son index (S8)');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '' }, { newId: (p) => p }).edition.isbn, null, 'livre : sans ISBN, null');
    eq(LA.fabriquerLivre({ champs: { title: 'T', tags: ['bbq', 'charbon'] }, isbn: '' }, { newId: (p) => p }).book.tags, ['bbq', 'charbon'], 'livre : les mots-clés choisis sont écrits dans books.tags (§ 12.1)');
```

- [ ] **Step 2 : Suite → rouge.**

- [ ] **Step 3 : Implémenter**

`CHAMPS_VIDES` : `({ title: '', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [], tags: [] })`.

`livreAjoutModel` :

```js
export function livreAjoutModel({ pas = 1, isbn = '', champs = {}, provenance = null, recherche = false, reprise = false, validation = null, resultat = null, suggestions = null, cleGoogle = false, lecteurDisponible = true, enCours = false } = {}) {
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
  return { pas, isbn, champs: c, provenance, recherche, reprise, validation, resultat, suggestions, cleGoogle, lecteurDisponible, enCours, isbnValide,
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

`fabriquerLivre` : `const v = validerIsbn(isbn);` en tête ; `book` reçoit `tags: [...c.tags]` à la place de `tags: []` ; `edition.isbn: v.ok ? v.isbn13 : null`.

`src/i18n/en.js` : **retirer** `'Aucune fiche trouvée pour cet ISBN. Complète à la main.'` ; ajouter (vérifier d'abord par `grep` qu'aucune n'existe déjà) :

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

`sw.js` : `VERSION = 'cuisine-os-v0.4.1-4'`.

- [ ] **Step 4 : Suite → vert ; total ; vert** (le test F13 reste vert : chaque `t()` neuf a son entrée).

- [ ] **Step 5 : Commit**

```bash
git add src/ui/livre-ajout.js src/i18n/en.js sw.js tests/ajouter.js tests/tests.js
git commit -m "Modele du livre : trois issues dites vrai, ISBN valide ou null et tags a l enregistrement, phrase des sources selon la cle" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 : Rendu du pas 1 (validation, « Réessayer », Entrée, phrase des sources) et rappel du pas 2

**Files:**
- Modify: `src/ui/livre-ajout.js` (`renderLivreAjout` pas 1 ≈ 196-212 ; pas 2 ligne « ISBN » ≈ 218)
- Modify: `tests/ajouter.js` (≈ 342 phrase ; fixture ≈ 399-413 ; bloc neuf), `tests/tests.js`

**Interfaces:**
- Produces: pas 1 : `input[name=isbn]` avec `maxlength="20"`, `disabled` pendant la recherche (inchangé), `keydown` Entrée → `gestes.identifier()` (ignoré si `repeat`/`isComposing`) ; `small[data-role=validation]` ; `div[data-role=indisponible]` + `button[data-role=reessayer]` (`gestes.reessayer`) ; `messages.sources`. Pas 2 : `span.muted` = `messages.rappelIsbn`.

- [ ] **Step 1 : Tests (rouge)**

≈ 342 : remplacer `ok(p1.textContent.includes('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.'), …)` par :

```js
    ok(p1.textContent.includes('L’ISBN est envoyé à Open Library.') && !p1.textContent.includes('Google Books'), 'livre : sans clé, la phrase ne promet pas Google Books (F12)');
    ok(LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, cleGoogle: true }), {}).textContent.includes('puis à Google Books si besoin.'), 'livre : avec clé, les deux tiers sont nommés (S12)');
```

Bloc route ≈ 399-413 : `' 978-2-7619-5000-1 '` → `' 978-2-8907-7281-6 '`, `['ISBN 9782761950001']` → `['ISBN 9782890772816']`, `.value, '9782761950001'` → `'9782890772816'`.

Bloc neuf, après le bloc R-UX-9 (`majBoutonEnregistrer`) :

```js
  {
    // Rendu du pas 1 : refus sous le champ, Réessayer, Entrée, champ fermé pendant la recherche (spec § 6, RF-m8).
    const appels = [];
    const gestes = { identifier: () => appels.push('identifier'), reessayer: () => appels.push('reessayer'), changerIsbn: () => {}, scanner: () => {}, saisirMain: () => {} };
    const p1 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '' }), gestes);
    const champ = p1.querySelector('input[name="isbn"]');
    eq([champ.getAttribute('maxlength'), champ.disabled], ['20', false], 'livre : champ borné à 20, ouvert hors recherche (S8)');
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    eq(appels, ['identifier'], 'livre : Entrée identifie une fois ; répétition, composition et autres touches non (S3)');
    const pr = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '9781785035289', recherche: true, resultat: { statut: 'indisponible', motif: 'limite' } }), gestes);
    eq([pr.querySelector('input[name="isbn"]').disabled, [...pr.querySelectorAll('button')].find((b) => b.textContent === 'Identifier').disabled, pr.querySelector('[data-role="reessayer"]'), pr.querySelector('[data-role="indisponible"]'), pr.textContent.includes('Recherche…')],
      [true, true, null, null, true], 'livre : pendant la recherche — champ fermé, Identifier fermé, ni Réessayer ni message, « Recherche… » (F17)');
    const pi = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '9781785035289', resultat: { statut: 'indisponible', motif: 'limite' } }), gestes);
    eq([pi.querySelector('[data-role="indisponible"]')?.textContent.includes('trop de demandes'), [...pi.querySelectorAll('button')].filter((b) => b.textContent === 'Saisir à la main').length, pi.querySelectorAll('input[name="isbn"]').length, pi.querySelector('[data-role="reessayer"]')?.textContent],
      [true, 1, 1, 'Réessayer'], 'livre : indisponible → message + un seul « Saisir à la main » + Réessayer, toujours au pas 1');
    pi.querySelector('[data-role="reessayer"]').click();
    eq(appels, ['identifier', 'reessayer'], 'livre : « Réessayer » part par son geste');
    const pv = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, validation: 'controle' }), gestes);
    eq([pv.querySelector('[data-role="validation"]')?.textContent, pv.querySelector('.status.error, .error')], ['Cet ISBN n’est pas valide, vérifie les chiffres.', null], 'livre : le refus est sous le champ, sans carte rouge');
    const ph = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, resultat: { statut: 'indisponible', motif: '<img src=x onerror="void 0">' } }), gestes);
    eq([ph.querySelectorAll('img').length, ph.querySelector('[data-role="indisponible"]')?.textContent], [0, 'Open Library est en panne pour le moment.'], 'livre : un motif hostile ne crée aucun élément et retombe sur le texte sûr (S12)');
    const p2 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 2, isbn: '12345', champs: { title: 'T' } }), gestes);
    ok([...p2.querySelectorAll('span.muted')].some((s) => s.textContent === 'ISBN 12345 — non valide, ne sera pas enregistré'), 'livre : au pas 2, un ISBN invalide est annoncé comme non enregistré (S8)');
    eq(LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1 }), gestes).querySelector('[data-role="indisponible"], [data-role="validation"]'), null, 'livre : sans rien à dire, rien n’est affiché');
  }
```

- [ ] **Step 2 : Suite → rouge.**

- [ ] **Step 3 : Implémenter** — pas 1 de `renderLivreAjout` :

```js
  if (model.pas === 1) {
    // Entrée = Identifier (pas de <form> : un submit natif ferait naviguer le #). Répétition de touche et composition
    // IME ne déclenchent pas (S3) ; la garde d'une seule identification vit dans la route (I-G).
    const surTouche = (e) => { if (e.key !== 'Enter') return; e.preventDefault(); if (!e.repeat && !e.isComposing) g('identifier')(); };
    return el('section', { class: 'card stack livre-ajout' },
      el('p', null, t('Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.')),
      // RF-m8 : pendant « Recherche… », le champ est fermé comme les boutons — taper un autre ISBN dans un champ
      // actif pendant qu'un appel est en vol ferait croire que la réponse qui arrive est celle du nouvel ISBN.
      field(t('ISBN'), el('input', { type: 'text', name: 'isbn', inputmode: 'numeric', maxlength: '20', placeholder: '978…', value: model.isbn, disabled: !!model.recherche, onInput: (e) => g('changerIsbn')(e.target.value), onKeydown: surTouche })),
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

(la ligne `model.messages.provenance ? …` du pas 1 disparaît.) Pas 2 : `` `${t('ISBN')} ${model.isbn}` `` → `model.messages.rappelIsbn`. `sw.js` : `VERSION = 'cuisine-os-v0.4.1-5'`.

- [ ] **Step 4 : Suite → vert ; total ; vert.**

- [ ] **Step 5 : Commit**

```bash
git add src/ui/livre-ajout.js sw.js tests/ajouter.js tests/tests.js
git commit -m "Pas 1 : refus sous le champ, Reessayer, Entree identifie, phrase des sources vraie" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 : Mots-clés au pas 2 — suggestions (`puces.js`) et bloc « Mots-clés »

**Files:**
- Modify: `src/ui/puces.js` (`motsClesExistants`, `suggestionsModel`, `renderSuggestions`, `renderPuces` 3ᵉ paramètre)
- Modify: `src/ui/livre-ajout.js` (`renderLivreAjout` pas 2 : bloc « Mots-clés » après « Cuisines »)
- Modify: `src/i18n/en.js`, `tests/ajouter.js` (bloc neuf après celui de la tâche 5), `tests/tests.js`

**Interfaces:**
- Consumes: `normaliser`, `capitaliser`, `pucesModel`, `renderPuces` (existants) ; `livreAjoutModel().suggestions` (tâche 4).
- Produces: `motsClesExistants(ctx) → string[]` ; `suggestionsModel({ proposees = [], source = null, choisies = [] }) → { source, libelle, puces: [{ valeur, cle }] } | null` ; `renderSuggestions(model, { ajouter }) → Element` (`div.suggestions`, `small.muted` libellé, `button.puce.suggestion`) ; `renderPuces(model, gestes, { libelleAutre = t('Autre cuisine') } = {})`. Le rendu du pas 2 lit `model.existantesMotsCles` (posé par la route, tâche 7) et `model.suggestions` ; gestes `basculerMotCle`, `ajouterMotCle`.

- [ ] **Step 1 : Tests (rouge)**

```js
  {
    // § 12.3 : suggestions de mots-clés — propositions étiquetées, jamais posées sans geste.
    const P = await import('../src/ui/puces.js');
    eq(P.motsClesExistants({ books: [{ tags: ['a', 'b'] }, { tags: ['b'] }, {}], recipes: [{ tags: ['z'] }] }), ['a', 'b', 'b'], 'mots-clés : existants = toutes les occurrences des tags des LIVRES (la fréquence fait l’ordre)');
    const s1 = P.suggestionsModel({ proposees: ['Barbecuing', 'BBQ', 'bbq', 'Charbon', '', 'Arabe'], source: 'openlibrary', choisies: ['BBQ'] });
    eq([s1.libelle, s1.puces.map((p) => p.valeur)], ['Proposé par Open Library', ['Barbecuing', 'Charbon', 'Arabe']], 'mots-clés : une suggestion déjà choisie (à la casse près) disparaît, les doublons aussi, le vide aussi');
    eq(P.suggestionsModel({ proposees: ['Bbq'], source: 'openlibrary', choisies: ['bbq'] }), null, 'mots-clés : plus rien à proposer → null, aucun bloc');
    eq(P.suggestionsModel({ proposees: ['Épice'], source: 'openlibrary', choisies: ['epice'] }), null, 'mots-clés : l’accent ne fait pas une proposition nouvelle (normaliser)');
    eq(P.suggestionsModel({ proposees: Array.from({ length: 14 }, (_, i) => `s${i}`), source: 'googlebooks' }).puces.length, 10, 'mots-clés : 10 suggestions au plus');
    eq(P.suggestionsModel({ proposees: ['x'], source: 'googlebooks' }).libelle, 'Proposé par Google Books', 'mots-clés : la source est nommée (I-A)');
    eq(P.suggestionsModel({ proposees: [], source: null }), null, 'mots-clés : sans proposition, null');
    const ajoutes = [];
    const n = P.renderSuggestions(s1, { ajouter: (v) => ajoutes.push(v) });
    eq([n.className, n.querySelector('small').textContent, [...n.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent)], ['suggestions', 'Proposé par Open Library', ['Barbecuing', 'Charbon', 'Arabe']], 'mots-clés : rendu = libellé + une puce par proposition, affichée capitalisée');
    n.querySelectorAll('button')[1].click();
    eq(ajoutes, ['Charbon'], 'mots-clés : un clic propose la valeur au geste ajouter — rien n’est écrit ici');
    eq(n.querySelector('label'), null, 'mots-clés : jamais dans un label (R-UX-8)');
    eq(P.renderPuces(P.pucesModel({ choisies: [] }), {}, { libelleAutre: 'Autre mot-clé' }).querySelector('input').getAttribute('aria-label'), 'Autre mot-clé', 'mots-clés : le champ libre est nommé pour les mots-clés');
    eq(P.renderPuces(P.pucesModel({ choisies: [] }), {}).querySelector('input').getAttribute('aria-label'), 'Autre cuisine', 'mots-clés : sans option, le champ libre reste « Autre cuisine »');
    // Pas 2 : le bloc « Mots-clés » avec ses gestes.
    const gestes = { basculerMotCle: (v) => ajoutes.push(['bascule', v]), ajouterMotCle: (v) => ajoutes.push(['ajout', v]) };
    const m = { ...LA.livreAjoutModel({ pas: 2, isbn: '9781785035289', champs: { title: 'T', tags: ['bbq'] }, provenance: 'openlibrary', suggestions: { source: 'openlibrary', valeurs: ['Barbecuing', 'bbq'] } }), existantes: ['italienne'], existantesMotsCles: ['charbon', 'charbon', 'arabe'] };
    const p2 = LA.renderLivreAjout(m, gestes);
    const bloc = p2.querySelector('[data-role="mots-cles"]');
    ok(bloc && bloc.querySelector('span').textContent === 'Mots-clés' && !bloc.closest('label'), 'livre : bloc « Mots-clés » au pas 2, hors label (R-UX-8)');
    eq([...bloc.querySelectorAll('button.puce:not(.suggestion)')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]), [['Bbq', 'true'], ['Charbon', 'false'], ['Arabe', 'false']], 'livre : mots-clés = choisis puis existants par fréquence, AUCUNE cuisine de graine (graine vide)');
    eq([...bloc.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent), ['Barbecuing'], 'livre : les suggestions excluent ce qui est déjà choisi');
    eq(bloc.querySelector('input').getAttribute('aria-label'), 'Autre mot-clé', 'livre : champ libre des mots-clés nommé');
    bloc.querySelector('button.puce.suggestion').click();
    [...bloc.querySelectorAll('button.puce:not(.suggestion)')][1].click();
    eq(ajoutes.slice(-2), [['ajout', 'Barbecuing'], ['bascule', 'charbon']], 'livre : suggestion → ajouterMotCle, puce → basculerMotCle');
    const sans = LA.renderLivreAjout({ ...LA.livreAjoutModel({ pas: 2, champs: { title: 'T' } }), existantes: [], existantesMotsCles: [] }, {});
    eq([!!sans.querySelector('[data-role="mots-cles"]'), sans.querySelector('.suggestions')], [true, null], 'livre : sans suggestion, le bloc existe (saisie libre) mais pas de ligne « Proposé par … »');
  }
```

- [ ] **Step 2 : Suite → rouge.**

- [ ] **Step 3 : Implémenter**

`src/ui/puces.js` (après `cuisinesExistantes`) :

```js
// § 12 : les mots-clés des LIVRES seulement (les tags de recette sont un autre écran). Même rôle que cuisinesExistantes.
export function motsClesExistants(ctx) {
  return [...(ctx?.books || [])].flatMap((b) => b?.tags || []);
}

// Propositions reçues d'une source (Open Library, Google Books) : étiquetées, dédoublonnées, sans ce qui est déjà
// choisi (à la casse et à l'accent près), 10 au plus ; null quand il n'y a rien à montrer. Rien n'est écrit ici.
export const SUGGESTIONS_MAX = 10;
export function suggestionsModel({ proposees = [], source = null, choisies = [] } = {}) {
  const prises = new Set(choisies.map(normaliser));
  const vues = new Map();
  for (const v of proposees) {
    const valeur = String(v ?? '').trim();
    const cle = normaliser(valeur);
    if (!cle || prises.has(cle) || vues.has(cle)) continue;
    vues.set(cle, { valeur, cle });
    if (vues.size >= SUGGESTIONS_MAX) break;
  }
  if (!vues.size) return null;
  const libelle = source === 'googlebooks' ? t('Proposé par Google Books') : t('Proposé par Open Library');
  return { source, libelle, puces: [...vues.values()] };
}

// S10 : une valeur proposée n'est pas une clé de traduction — affichée telle quelle, capitalisée. Jamais dans un label.
export function renderSuggestions(model, { ajouter } = {}) {
  return el('div', { class: 'suggestions' },
    el('small', { class: 'muted' }, model.libelle),
    el('div', { class: 'puces', role: 'group' },
      ...model.puces.map((p) => el('button', { type: 'button', class: 'puce suggestion', 'aria-pressed': 'false', onClick: () => ajouter && ajouter(p.valeur) }, capitaliser(p.valeur)))));
}
```

`renderPuces` : signature `export function renderPuces(model, { basculer, ajouter } = {}, { libelleAutre = t('Autre cuisine') } = {})` et `'aria-label': libelleAutre` sur le champ.

`src/ui/livre-ajout.js`, pas 2 : importer `motsClesExistants, suggestionsModel, renderSuggestions` depuis `./puces.js` ; après la ligne `el('div', { class: 'field' }, el('span', null, t('Cuisines')), puces),` :

```js
    // § 12 : mots-clés du livre — mêmes puces que les cuisines, graine vide, puis les propositions reçues (étiquetées).
    el('div', { class: 'field', dataset: { role: 'mots-cles' } }, el('span', null, t('Mots-clés')),
      renderPuces(pucesModel({ choisies: c.tags, existantes: model.existantesMotsCles || [], graine: [] }), { basculer: g('basculerMotCle'), ajouter: g('ajouterMotCle') }, { libelleAutre: t('Autre mot-clé') }),
      (() => { const s = suggestionsModel({ proposees: model.suggestions?.valeurs || [], source: model.suggestions?.source || null, choisies: c.tags }); return s ? renderSuggestions(s, { ajouter: g('ajouterMotCle') }) : null; })()),
```

`en.js` : `'Mots-clés': 'Keywords', 'Autre mot-clé': 'Other keyword', 'Proposé par Open Library': 'Suggested by Open Library', 'Proposé par Google Books': 'Suggested by Google Books'` (vérifier par `grep` l'absence de doublon). `sw.js` : `VERSION = 'cuisine-os-v0.4.1-6'`.

- [ ] **Step 4 : Suite → vert ; total ; vert.** (Les appelants existants de `renderPuces` passent deux arguments : le troisième a un défaut.)

- [ ] **Step 5 : Commit**

```bash
git add src/ui/puces.js src/ui/livre-ajout.js src/i18n/en.js sw.js tests/ajouter.js tests/tests.js
git commit -m "Mots-cles au pas 2 : puces a graine vide, suggestions etiquetees par source, jamais posees sans geste" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7 : Route — dépendances étendues, garde I-G, trois issues à l'écran, mots-clés, R-UX-13 sur `deps`

**Files:**
- Modify: `src/ui/livre-ajout.js` (`renderLivreAjoutRoute` ≈ 252-398 : signature, `etat`, `dessiner`/`modele`, `identifier`, gestes)
- Modify: `tests/ajouter.js` (bloc R-UX-13 ≈ 952-1227 : `deps` ; bloc neuf « route, partie A »), `tests/tests.js`

**Interfaces:**
- Consumes: tout ce qui précède ; de `main` : `avancer()`, `oublierDistants()`, `fusionnerFiche(…, { langueTouchee })`, `signalDelai`, `etatRoute()`.
- Produces: `renderLivreAjoutRoute(params, query, ctx, { repo: r = repo, navigate: nav = navigate, toast: dire = toast, fetch = globalThis.fetch, enLigne = () => navigator.onLine !== false, attendre = attenteReelle, cle = GOOGLE_BOOKS.key, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = {})`. `etatRoute()` expose en plus `resultat`, `validation`, `suggestions`, `reprise`.

- [ ] **Step 1 : Tests (rouge)**

(a) Bloc R-UX-13 : remplacer `globalThis.fetch = async (url) => {` par `const fetchFactice = async (url) => {` ; supprimer `const vraiFetch = globalThis.fetch;` et le `finally { globalThis.fetch = vraiFetch; }` de ce bloc seulement ; après le stub : `const depsRoute = { repo, fetch: fetchFactice, attendre: async () => {}, tentativeMs: 50 };` ; remplacer chaque `{ repo }` passé à `renderLivreAjoutRoute` par `depsRoute`, `{ repo, navigate: …, toast: … }` par `{ ...depsRoute, navigate: …, toast: … }`, `{ repo: repoRefus, … }` par `{ ...depsRoute, repo: repoRefus, … }`. Cas 4 : `const r4 = await LA.renderLivreAjoutRoute({}, {}, {}, { ...depsRoute, cle: 'k' });` et l'attendu redevient Google :

```js
        eq([depuis.some((u) => u.startsWith('https://covers.openlibrary.org/')), depuis.some((u) => u.startsWith('https://www.googleapis.com/books/')), r4.textContent.includes('Renseigné par Google Books')],
          [false, true, true], 'route : une fiche venue de Google Books (clé injectée) ne demande AUCUNE couverture à Open Library (I-A)');
```

(le stub `googleapis` rend un volume `language: 'en'` : cas 10 reste sur `search.json`, inchangé depuis la tâche 2).

(b) Bloc neuf après R-UX-13 :

```js
  {
    // La route avec deps étendues (F3) : validation, hors ligne, indisponible → Réessayer, Entrée, une seule
    // identification (I-G), langue reçue (C2), sorties après un échec (F7), suggestions (§ 12). Aucun réseau, base jetable.
    const { withRepo } = await import('./sync-fixture.js');
    const reponseJson = (o, status = 200) => ({ ok: status < 300, status, headers: new Headers(), text: async () => JSON.stringify(o) });
    const r404 = { ok: false, status: 404, headers: new Headers(), text: async () => '', blob: async () => new Blob([]) };
    const attendre = async (condition, quoi) => { for (let i = 0; i < 300; i += 1) { if (await condition()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error(`attente dépassée (3 s) : ${quoi}`); };
    const taper = (root, isbn) => { const i = root.querySelector('input[name="isbn"]'); i.value = isbn; i.dispatchEvent(new Event('input')); };
    const cliquer = (root, texte) => { const b = [...root.querySelectorAll('button')].find((x) => x.textContent === texte); if (!b) throw new Error(`bouton absent : ${texte}`); b.click(); };
    const entree = (root) => root.querySelector('input[name="isbn"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const titreDe = (root) => [...root.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn');
    const rappel = (root) => [...root.querySelectorAll('span.muted')].find((s) => s.textContent.startsWith('ISBN'))?.textContent ?? null;
    await withRepo(async (repo) => {
      const urls = [];
      const recherches = () => urls.filter((u) => u.includes('/search.json')).length; // la couverture passe aussi par fetch
      let search = () => reponseJson({ docs: [{ title: 'Livre', language: ['eng'], subject: ['Barbecuing', 'Charcoal'] }] });
      const fetch = async (u) => { const s = String(u); urls.push(s); if (s.startsWith('https://openlibrary.org/search.json')) return search(); return r404; };
      const deps = { repo, fetch, enLigne: () => true, attendre: async () => {}, tentativeMs: 50, navigate: () => {} };
      // 1. ISBN faux : aucun appel, la saisie reste.
      const rA = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rA, '9781785035280'); cliquer(rA, 'Identifier');
      eq([urls.length, rA.querySelector('[data-role="validation"]')?.textContent, rA.querySelector('input[name="isbn"]')?.value], [0, 'Cet ISBN n’est pas valide, vérifie les chiffres.', '9781785035280'], 'route : un ISBN faux est refusé sans appel, la saisie reste (§ 4)');
      taper(rA, '5901234123457'); entree(rA);
      eq([urls.length, rA.querySelector('[data-role="validation"]')?.textContent], [0, 'Ce code-barres n’est pas un ISBN.'], 'route : un EAN qui n’est pas un livre est refusé sans appel');
      // 2. Hors ligne : aucun appel ; Réessayer force (S13) ; langue reçue (C2) ; suggestions posées (§ 12).
      const rB = await LA.renderLivreAjoutRoute({}, {}, {}, { ...deps, enLigne: () => false });
      taper(rB, '9781785035289'); cliquer(rB, 'Identifier');
      eq([urls.length, rB.querySelector('[data-role="indisponible"]')?.textContent.includes('Tu es hors ligne.'), !!rB.querySelector('[data-role="reessayer"]')], [0, true, true], 'route : hors ligne → aucun appel, dit, Réessayer offert');
      cliquer(rB, 'Réessayer');
      await attendre(() => rB.querySelector('.status.info'), 'pas 2 après Réessayer');
      eq([recherches(), rB.querySelector('select').value, titreDe(rB).value, [...rB.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent)], [1, 'en', 'Livre', ['Barbecuing', 'Charcoal']], 'route : Réessayer force l’appel malgré onLine (S13) ; langue au sélecteur (C2) ; suggestions affichées (§ 12)');
      // 3. 429 → pas 1, message vrai, Réessayer ; deux clics = un appel ; puis 200 → pas 2.
      urls.length = 0; search = () => reponseJson({}, 429);
      const rC = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rC, '9782890772816'); entree(rC);
      await attendre(() => rC.querySelector('[data-role="reessayer"]'), 'indisponible après 429');
      eq([recherches(), rC.querySelector('[data-role="indisponible"]')?.textContent.includes('trop de demandes'), !!rC.querySelector('input[name="isbn"]'), [...rC.querySelectorAll('button')].filter((b) => b.textContent === 'Saisir à la main').length, rC.etatRoute().resultat?.motif], [1, true, true, 1, 'limite'], 'route : Entrée identifie ; 429 → pas 1, message vrai, Réessayer, un seul « Saisir à la main » (F17)');
      search = () => reponseJson({ docs: [{ title: 'Carnet', language: ['fre'] }] });
      cliquer(rC, 'Réessayer'); cliquer(rC, 'Réessayer');
      await attendre(() => rC.querySelector('.status.info'), 'pas 2 après Réessayer');
      eq([recherches(), rC.querySelector('.status.info').textContent, titreDe(rC).value, rC.querySelector('select').value, rappel(rC), rC.querySelector('.suggestions')], [2, 'Renseigné par Open Library — vérifie et corrige.', 'Carnet', 'fr', 'ISBN 9782890772816', null], 'route : deux clics sur Réessayer = un appel ; il relance et remplit ; sans subject, aucune suggestion');
      // 4. F7 : après un échec, « Saisir à la main » et « ← Changer d’ISBN » effacent le message.
      urls.length = 0; search = () => reponseJson({}, 503);
      const rD = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rD, '0306406152'); cliquer(rD, 'Identifier');
      await attendre(() => rD.querySelector('[data-role="reessayer"]'), 'indisponible après 503');
      ok(rD.querySelector('[data-role="indisponible"]').textContent.includes('en panne'), 'route : 503 = « en panne »');
      cliquer(rD, 'Saisir à la main');
      eq([rD.querySelector('[data-role="indisponible"]'), rD.querySelector('.status.info'), rappel(rD)], [null, null, 'ISBN 9780306406157'], 'route : « Saisir à la main » après un échec → pas 2 muet, ISBN normalisé en 13 (F7, F22)');
      cliquer(rD, '← Changer d’ISBN');
      eq([rD.querySelector('[data-role="indisponible"]'), rD.querySelector('input[name="isbn"]').value, rD.querySelector('input[name="isbn"]').disabled], [null, '9780306406157', false], 'route : retour au pas 1 sans message, champ ouvert (F7)');
      // 5. I-G : une identification à la fois ; champ fermé pendant la recherche.
      urls.length = 0; let liberer = null; search = () => new Promise((r) => { liberer = () => r(reponseJson({ docs: [{ title: 'Lent' }] })); });
      const rE = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rE, '9780306406157'); entree(rE);
      await attendre(() => liberer, 'premier appel en vol');
      eq([rE.querySelector('input[name="isbn"]').disabled, rE.textContent.includes('Recherche…')], [true, true], 'route : champ fermé et « Recherche… » pendant l’appel (RF-m8)');
      entree(rE); cliquer(rE, 'Identifier');
      liberer();
      await attendre(() => rE.querySelector('.status.info'), 'pas 2');
      eq(recherches(), 1, 'route : Entrée et clic pendant la recherche ne partent pas (I-G)');
      // 6. « Nouvel essai… » visible pendant la reprise (S11/F26).
      urls.length = 0; let n = 0; let libererReprise = null;
      search = () => { n += 1; if (n === 1) throw new Error('reseau'); return new Promise((r) => { libererReprise = () => r(reponseJson({ docs: [{ title: 'Repris' }] })); }); };
      const rF = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rF, '9780306406157'); cliquer(rF, 'Identifier');
      await attendre(() => libererReprise, 'seconde tentative en vol');
      ok(rF.textContent.includes('Nouvel essai…') && rF.etatRoute().reprise === true, 'route : la reprise est dite pendant qu’elle a lieu (S11)');
      libererReprise();
      await attendre(() => rF.querySelector('.status.info'), 'pas 2 après reprise');
      eq([recherches(), titreDe(rF).value, rF.etatRoute().reprise], [2, 'Repris', false], 'route : la reprise a trouvé, et reprise retombe');
    });
  }
```

- [ ] **Step 2 : Suite → rouge** — R-UX-13 (deps ignorées → stub `fetchFactice` jamais appelé), pas 2 ouvert sur un 429, suggestions absentes.

- [ ] **Step 3 : Implémenter la route** (en gardant tout ce que `main` y a mis : C1, C3, `pertinent()`, `etatRoute()`, `passagesCouverture`, `couverturesAppliquees`, `messageErreurImage`…)

Signature et état :

```js
export async function renderLivreAjoutRoute(params, query, ctx, { repo: r = repo, navigate: nav = navigate, toast: dire = toast, fetch = globalThis.fetch, enLigne = () => navigator.onLine !== false, attendre = attenteReelle, cle = GOOGLE_BOOKS.key, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = {}) {
```

`etat` gagne `reprise: false, validation: null, resultat: null, suggestions: null, existantesMotsCles: motsClesExistants(ctx)` ; `const modele = () => ({ ...livreAjoutModel({ ...etat, cleGoogle: !!cle }), existantes: etat.existantes, existantesMotsCles: etat.existantesMotsCles });` et `dessiner` l'utilise ; chaque `livreAjoutModel(etat)` de la route (gestes `changerChamp`, `enregistrer`) devient `modele()`.

`identifier` :

```js
  // I-G : tout geste qui change l'ISBN ou le pas ferme la porte aux réponses en vol (avancer, C1) ET libère la recherche.
  const nouvelleGeneration = () => { avancer(); etat.recherche = false; etat.reprise = false; etat.validation = null; etat.resultat = null; etat.suggestions = null; };
  const identifier = async ({ forcer = false } = {}) => {
    if (etat.recherche) return; // I-G : une identification à la fois (Entrée, Réessayer et le clic passent tous ici)
    const v = validerIsbn(etat.isbn);
    if (!v.ok) {
      if (v.motif === 'vide') { dire(t('Saisis un ISBN d’abord.')); return; }
      etat.validation = v.motif; dessiner(); return; // aucun appel
    }
    etat.validation = null; etat.isbn = v.isbn13;
    if (!forcer && !enLigne()) { etat.resultat = { statut: 'indisponible', motif: 'horsligne', google: 'non_appele' }; dessiner(); return; } // S13 : Réessayer force
    // Une provenance ne survit pas à l'ISBN qui l'a produite (I-B) ; la COUVERTURE non plus (R-UX-13) ; C3 avant C1.
    etat.provenance = null; etat.couverture = COUVERTURE_VIDE(); etat.suggestions = null;
    oublierDistants();
    avancer();
    const generation = etat.generation;
    etat.recherche = true; etat.reprise = false; etat.resultat = null;
    dessiner();
    const ctl = new AbortController();
    const chrono = setTimeout(() => ctl.abort(), LIMITES_ISBN.totalMs);
    try {
      const res = await lookupIsbn(v.isbn13, { fetch, signal: ctl.signal, cle, attendre, tentativeMs, repriseMs, surReprise: () => { if (etat.generation === generation) { etat.reprise = true; dessiner(); } } });
      if (etat.generation !== generation) return; // C1/F3 : la réponse d'une autre génération n'écrit rien (I-G)
      if (res.statut === 'trouve') {
        const avantFusion = { ...etat.champs };
        etat.champs = fusionnerFiche(etat.champs, res.fiche, { langueTouchee: etat.langueTouchee });
        const reprises = CHAMPS_DISTANTS.filter((k) => String(avantFusion[k] ?? '') !== String(etat.champs[k] ?? ''));
        etat.champsDistants = reprises.length ? Object.fromEntries(reprises.map((k) => [k, etat.champs[k]])) : null;
        etat.provenance = res.source; etat.pas = 2;
        etat.suggestions = res.fiche.motsCles?.length ? { source: res.source, valeurs: res.fiche.motsCles } : null; // § 12.2 : propositions, jamais posées
        if (res.source === 'openlibrary') {
          /* bloc couverture de main, INCHANGÉ, sauf : recupererCouvertureParIsbn(v.isbn13, { fetch, signal: signalDelai(LIMITES_ISBN.delaiMs) }) */
        }
      } else if (res.statut === 'introuvable') { etat.provenance = 'aucune'; etat.resultat = res; etat.pas = 2; }
      else { etat.resultat = res; } // indisponible : on reste au pas 1, ISBN conservé, Réessayer offert
    } finally {
      clearTimeout(chrono);
      if (etat.generation === generation) { etat.recherche = false; etat.reprise = false; dessiner(); }
    }
  };
```

(Recopie le bloc couverture **tel qu'il est sur `main`** — `isbnDemande`, `pertinent()`, `passagesCouverture`, `poserCouverture(…, { repo: r })`, `couverturesAppliquees`, `ILLISIBLE` — en changeant seulement l'appel à `recupererCouvertureParIsbn` pour passer `fetch`.) Dans `finally`, la condition sur la génération est **nouvelle** : `saisirMain`/`retourIsbn` libèrent déjà la recherche par `nouvelleGeneration()`, et une identification plus récente a sa propre `recherche`.

Gestes :

```js
    reessayer: () => identifier({ forcer: true }),
    scanner: async () => {
      const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
      if (!files.length) return;
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
        const bmp = await createImageBitmap(files[0]);
        const code = codeBarresVersIsbn(await detector.detect(bmp));
        if (!code) { dire(t('Aucun ISBN lu sur cette photo.')); return; }
        etat.isbn = code; await identifier();
      } catch { dire(t('Lecture du code-barres impossible.')); }
    },
    saisirMain: () => {
      nouvelleGeneration();
      const v = validerIsbn(etat.isbn);
      etat.isbn = v.ok ? v.isbn13 : nettoyerIsbn(etat.isbn).slice(0, 20); // affiché = enregistré quand valide ; borné sinon (S8/F22)
      etat.provenance = null; etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; etat.pas = 2; dessiner();
    },
    retourIsbn: () => { nouvelleGeneration(); etat.pas = 1; etat.provenance = null; etat.couverture = { ...COUVERTURE_VIDE(), touchee: true }; dessiner(); },
    basculerMotCle: (v) => { etat.champs.tags = basculerPuce(etat.champs.tags, v); dessiner(); },
    ajouterMotCle: (v) => { const apres = ajouterPuce(etat.champs.tags, v); if (apres !== etat.champs.tags) { etat.champs.tags = apres; dessiner(); } },
```

(`changerIsbn`, `changerChamp` (avec `langueTouchee`), `basculerCuisine`, `ajouterCuisine`, `couverture`, `enregistrer` restent ceux de `main`, `livreAjoutModel(etat)` → `modele()`.) `sw.js` : `VERSION = 'cuisine-os-v0.4.1-7'`.

- [ ] **Step 4 : Suite → vert ; total ; vert.** Le lanceur ne doit montrer **aucune** requête `HTTP` vers `openlibrary.org` : si une apparaît, une dépendance n'est pas passée (couverture ?).

- [ ] **Step 5 : Commit**

```bash
git add src/ui/livre-ajout.js sw.js tests/ajouter.js tests/tests.js
git commit -m "Route livre : deps etendues, garde d une identification a la fois, trois issues a l ecran, suggestions de mots-cles" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8 : Preuves de concurrence, d'écriture et de mots-clés (I-G, S3, S8, F15, § 12)

**Files:**
- Modify: `tests/ajouter.js` (bloc neuf après celui de la tâche 7), `tests/tests.js`
- Modify (si un rouge le demande) : `src/ui/livre-ajout.js` (+ `VERSION -8`)

- [ ] **Step 1 : Tests**

```js
  {
    // Réponses tardives et croisées (S3/I-G), écriture de l'édition et des mots-clés (F15, § 12), ISBN libre (S8).
    const { withRepo } = await import('./sync-fixture.js');
    const reponseJson = (o) => ({ ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(o) });
    const r404 = { ok: false, status: 404, headers: new Headers(), text: async () => '', blob: async () => new Blob([]) };
    const attendre = async (condition, quoi) => { for (let i = 0; i < 300; i += 1) { if (await condition()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error(`attente dépassée (3 s) : ${quoi}`); };
    const taper = (root, isbn) => { const i = root.querySelector('input[name="isbn"]'); i.value = isbn; i.dispatchEvent(new Event('input')); };
    const cliquer = (root, texte) => { const b = [...root.querySelectorAll('button')].find((x) => x.textContent === texte); if (!b) throw new Error(`bouton absent : ${texte}`); b.click(); };
    const titreDe = (root) => [...root.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn');
    const rappel = (root) => [...root.querySelectorAll('span.muted')].find((s) => s.textContent.startsWith('ISBN'))?.textContent ?? null;
    await withRepo(async (repo, db) => {
      const urls = []; const enVol = new Map(); // isbn → fonction qui libère la réponse search.json
      const fetch = async (u) => { const s = String(u); urls.push(s); if (s.startsWith('https://openlibrary.org/search.json')) { const isbn = new URL(s).searchParams.get('isbn'); return new Promise((r) => { enVol.set(isbn, () => r(reponseJson({ docs: [{ title: `Livre ${isbn}`, subject: ['Barbecuing', 'Charcoal'] }] }))); }); } return r404; };
      const liberer = (isbn) => { const f = enVol.get(isbn); enVol.delete(isbn); f(); };
      const navigations = [];
      const deps = { repo, fetch, enLigne: () => true, attendre: async () => {}, tentativeMs: 5000, navigate: (p) => navigations.push(p) };
      const A = '9780306406157', B = '9782890772816';
      // 1. « Saisir à la main » pendant la recherche : la réponse tardive n'écrit rien (I-G), pas même une suggestion.
      const r1 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r1, A); cliquer(r1, 'Identifier');
      await attendre(() => enVol.has(A), 'A en vol');
      cliquer(r1, 'Saisir à la main');
      liberer(A);
      await new Promise((r) => setTimeout(r, 50));
      eq([titreDe(r1).value, r1.querySelector('.status.info'), rappel(r1), r1.querySelector('.suggestions'), r1.etatRoute().recherche], ['', null, `ISBN ${A}`, null, false], 'route : la réponse d’une identification abandonnée par « Saisir à la main » n’écrit rien, et la recherche est libérée (I-G)');
      // 2. Croisement A puis B : seule B écrit ; une seule couverture demandée (B).
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
      eq([titreDe(r2).value, rappel(r2), urls.filter((u) => u.startsWith('https://covers.openlibrary.org/')).length, [...r2.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent)], [`Livre ${B}`, `ISBN ${B}`, 1, ['Barbecuing', 'Charcoal']], 'route : les champs et suggestions sont ceux de B seulement ; une seule couverture demandée (S3, § 5, § 12)');
      // 3. Une suggestion cliquée devient un mot-clé choisi ; « Ajouter ce livre » écrit isbn13 et tags (F15, § 12).
      r2.querySelector('button.puce.suggestion').click();
      eq([r2.etatRoute().champs.tags, [...r2.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent)], [['barbecuing'], ['Charcoal']], 'route : la suggestion cliquée devient une puce choisie (minuscules, comme ajouterPuce) et quitte les suggestions');
      cliquer(r2, 'Ajouter ce livre');
      await attendre(() => navigations.length === 1, 'navigation après enregistrement');
      const editions = await db.getAll('book_editions');
      const livre = await db.get('books', editions[0].book_id);
      eq([editions.length, editions[0].isbn, livre.tags, navigations[0] === `/books/${editions[0].id}?nouveau=1`], [1, B, ['barbecuing'], true], 'route : l’édition porte l’ISBN-13, le livre ses mots-clés, la navigation part vers la fiche (F15, § 12.1)');
      // 4. Saisie à la main invalide → édition sans ISBN ; 10 000 chiffres → rappel borné, rien en base (S8).
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
      // 5. « ← Changer d’ISBN » vide les suggestions (elles appartiennent à l'ISBN qui les a produites, § 12.2).
      const r5 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r5, A); cliquer(r5, 'Identifier');
      await attendre(() => enVol.has(A), 'A en vol (5)'); liberer(A);
      await attendre(() => r5.querySelector('.suggestions'), 'suggestions de A');
      cliquer(r5, '← Changer d’ISBN');
      eq([r5.etatRoute().suggestions, r5.querySelector('.suggestions')], [null, null], 'route : revenir changer l’ISBN abandonne les suggestions de l’ancien (§ 12.2)');
    });
  }
```

- [ ] **Step 2 : Suite → vert ; total ; vert.** Un rouge ici = un défaut de la tâche 7 : corriger **le code**, nommer le ruling R-ISBN-n au registre (jamais plier le test, sauf erreur manifeste du test, consignée).

- [ ] **Step 3 : Commit**

```bash
git add tests/ajouter.js tests/tests.js
git commit -m "Tests route : reponses tardives et croisees muettes (I-G), edition en ISBN-13 ou null, mots-cles ecrits, suggestions liees a l ISBN" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Si `src/ui/livre-ajout.js` a changé : l'ajouter, `VERSION` → `-8`.)

---

### Task 9 : Fiche livre (« Mots-clés ») et recherche (`books.tags` pour toutes les recettes du livre)

**Files:**
- Modify: `src/ui/book.js` (≈ 179 `meta` ; bloc `.field` « Mots-clés » après « Cuisines » ≈ 187-195 ; `saveBatch` ≈ 203)
- Modify: `src/domain/search.js` (`buildDocs` ≈ 121 et 127)
- Modify: `tests/ajouter.js` (bloc fiche ≈ 538-560 : un cas de plus ; bloc recherche ≈ 747-757 : cas de plus), `tests/tests.js`

**Interfaces:**
- Consumes: `motsClesExistants`, `pucesModel`, `renderPuces` 3ᵉ paramètre (tâche 6).
- Produces: la fiche écrit `tags: [...meta.tags]` ; `buildDocs` : `tokens` de chaque recette d'un livre contiennent ses `tags` ; `titleTokens` des `reference_only` aussi.

- [ ] **Step 1 : Tests (rouge)**

Dans le bloc fiche (après l'assertion « GARDE la couverture posée entre-temps », ≈ 553) :

```js
      // § 12.4 : « Mots-clés » dans la fiche, écrits par « Enregistrer », sans toucher au reste.
      const fiche3 = await renderBook({ id: 'eZ' }, {}, ctxDeux(await db.get('book_editions', 'eZ')));
      const blocMots = [...fiche3.querySelectorAll('div.field')].find((f) => f.querySelector('span')?.textContent === 'Mots-clés');
      ok(blocMots && !blocMots.closest('label') && blocMots.querySelector('input').getAttribute('aria-label') === 'Autre mot-clé', 'fiche : bloc « Mots-clés » hors label, champ libre nommé (§ 12.4)');
      ok(![...blocMots.querySelectorAll('button.puce')].some((b) => b.textContent === 'Italienne'), 'fiche : aucune cuisine de graine parmi les mots-clés');
      const champLibre = blocMots.querySelector('input'); champLibre.value = 'BBQ';
      [...blocMots.querySelectorAll('button')].find((b) => b.textContent === 'Ajouter').click();
      eq([...blocMots.querySelectorAll('button.puce')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]), [['Bbq', 'true']], 'fiche : « Ajouter » pose la puce choisie (minuscules)');
      await repo.save('book_editions', { ...(await db.get('book_editions', 'eZ')), cover_sha256: 'encore-posee' });
      [...fiche3.querySelectorAll('button')].find((b) => b.textContent === 'Enregistrer').click();
      eq(await attendreFait(async () => (await db.get('books', 'bZ'))?.tags?.length === 1), true, 'fiche : « Enregistrer » écrit les mots-clés');
      eq([(await db.get('books', 'bZ')).tags, (await db.get('book_editions', 'eZ')).cover_sha256], [['bbq'], 'encore-posee'], 'fiche : tags écrits, couverture relue intacte (C4, § 12.4)');
```

(`livre` du bloc est `{ id: 'bZ', … }` : vérifier son identifiant en tête du bloc et l'utiliser.) Dans le bloc recherche (après « une référence d’index sans cuisine ne remonte pas par une cuisine ») :

```js
    // § 12.5 : les mots-clés du livre comptent pour toutes ses recettes ; titleTokens pour les références seulement.
    const livreBbq = { id: 'bB', title: 'Berber and Q', author: 'Katz', cuisines: [], tags: ['bbq', 'charbon'] };
    const edBbq = { id: 'eB', book_id: 'bB' };
    const docsBbq = buildDocs({ recipes: [
      { id: 'c1', original_title: 'Agneau', edition_id: 'eB', availability: 'full' },
      { id: 'c2', original_title: 'Agneau', edition_id: 'eB', availability: 'reference_only', printed_page: 12, cuisines: [] },
      { id: 'c3', original_title: 'Agneau', edition_id: 'eB', availability: 'reference_only', source_url: 'https://a.test/', cuisines: [] },
      { id: 'c4', original_title: 'Agneau', availability: 'full' },
    ], versions: [], editions: [edBbq], books: [livreBbq], dishes: [], links: [], translations: [], history: [] });
    const par = (id) => docsBbq.find((d) => d.recipe.id === id);
    eq([par('c1').tokens.has('bbq'), par('c1').titleTokens.has('bbq'), par('c2').tokens.has('charbon'), par('c2').titleTokens.has('bbq'), par('c3').titleTokens.has('bbq'), par('c4').tokens.has('bbq')], [true, false, true, true, true, false], 'recherche : les tags du livre entrent dans les tokens de chaque recette, et dans les titleTokens des références seulement (§ 12.5)');
    const res = searchDocs(docsBbq, parseQuery('bbq'), { mode: 'all' });
    ok(res.references.some((x) => x.doc.recipe.id === 'c2') && res.references.some((x) => x.doc.recipe.id === 'c3'), 'recherche : une référence d’index et un signet d’un livre tagué « bbq » remontent sur « bbq »');
```

(Vérifie dans `searchDocs` ≈ 140-175 le nom du groupe des recettes pleines — `recipes` — et ajoute `ok(res.recipes?.some((x) => x.doc.recipe.id === 'c1'), …)` si le mode `all` les renvoie par `tokens`.)

- [ ] **Step 2 : Suite → rouge.**

- [ ] **Step 3 : Implémenter**

`src/ui/book.js` : import `motsClesExistants` depuis `./puces.js` ; `meta` gagne `tags: [...(book.tags || [])]` ; après le bloc « Cuisines » (même IIFE) :

```js
      el('div', { class: 'field' }, el('span', null, t('Mots-clés')), (() => {
        const box = el('div', null);
        const dessiner = () => box.replaceChildren(renderPuces(pucesModel({ choisies: meta.tags, existantes: motsClesExistants(ctx), graine: [] }), {
          basculer: (v) => { meta.tags = basculerPuce(meta.tags, v); dessiner(); },
          ajouter: (v) => { const a = ajouterPuce(meta.tags, v); if (a !== meta.tags) { meta.tags = a; dessiner(); } },
        }, { libelleAutre: t('Autre mot-clé') }));
        dessiner();
        return box;
      })()),
```

et dans le `saveBatch` : `books: [{ ...courantLivre, title: …, author: …, cuisines: [...meta.cuisines], tags: [...meta.tags] }]`.

`src/domain/search.js` : ligne ≈ 121 `textParts` : ajouter `...(book?.tags || [])` ; ligne ≈ 127 `titleTokens` : la partie `reference_only` devient `${recipe.availability === 'reference_only' ? [...(recipe.cuisines || []), ...(book?.tags || [])].join(' ') : ''}` ; mettre à jour le commentaire F7 (« … et les mots-clés du livre, § 12.5 du lot ISBN »).

`sw.js` : `VERSION = 'cuisine-os-v0.4.1-9'`.

- [ ] **Step 4 : Suite → vert ; total ; vert.**

- [ ] **Step 5 : Commit**

```bash
git add src/ui/book.js src/domain/search.js sw.js tests/ajouter.js tests/tests.js
git commit -m "Mots-cles : edition dans la fiche livre, et les tags du livre servent la recherche de toutes ses recettes" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10 : Clôture — statique, docs, mesures réelles, spec § 11.2

**Files:**
- Modify: `docs/architecture.md` (≈ 262), `CLAUDE.md` (sous-section après « Page « Ajouter » et flux des livres livrés »), spec § 11.2, `sw.js`, `tests/tests.js`
- Create: `docs/google-books.md`

- [ ] **Step 1 : Statique.** Suite `✅` ; `cd ~/projects/mistu-isbn && node --test tools/*.test.mjs` (40/40) ; `node tools/generer-migrations.mjs --check` (0) ; aucun U+2028/U+2029/U+202E ni caractère de contrôle dans les fichiers touchés (`python3 -c` : lire les octets, chercher ` ` etc. — pas de `grep -P` sur macOS) ; `grep -rn "AIza" src/` vide.

- [ ] **Step 2 : Mesures réelles (réseau réel, hors suite).** Écrire `.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/mesure.cjs` (Playwright local, `channel: 'chrome'`, headless ; modèle : `suite.cjs`) : `http://localhost:8082/#/add/livre`, « Continuer sans compte » si présent, puis (1) `9781785035289` + Entrée → « Renseigné par Open Library », titre/auteur/éditeur/année/langue, **suggestions** affichées (attendu « Barbecuing »), nombre de requêtes `search.json` (1) ; (2) « ← Changer d'ISBN », `9782890772816` → idem, langue `fr` ; (3) `9781785035280` → « pas valide », zéro requête ; (4) `context.setOffline(true)`, `9780306406157` → « Tu es hors ligne. » + « Réessayer », zéro requête ; (5) `setOffline(false)`, « Réessayer » → trouvé. Coller la sortie dans le rapport et dans `CLAUDE.md`. Si Open Library est en panne : le dire, montrer l'écran « en panne »/« n'a pas répondu » + « Réessayer » (preuve aussi).

- [ ] **Step 3 : Docs.** `docs/architecture.md` ≈ 262 : « lookupIsbn (trois issues : trouvé / introuvable / indisponible avec motif ; Open Library `search.json` puis legacy en filet, Google Books seulement avec `GOOGLE_BOOKS.key` ; une tentative = un budget, une reprise sur échec muet ; `fiche.motsCles` = propositions) » + ligne `src/core/isbn.js` + ligne `puces.js` (suggestions) + `search.js` (tags du livre). `docs/google-books.md` (une page) : pourquoi public ; les **murs** (projet Google Cloud dédié **sans facturation**, API Books seule, quota abaissé, référents `https://neegans.github.io/*`, `http://localhost:8082/*`, sous-domaine D5) ; étapes console ; coller dans `GOOGLE_BOOKS.key` ; `VERSION` ; contournement de la protection de push GitHub ; **mesure à faire avec la clé** : un ISBN absent d'Open Library → « Renseigné par Google Books », `Referer: https://neegans.github.io/` accepté (Chrome **et** Safari). `CLAUDE.md` : « ### Identifier un livre, fiable (14 octobre 2026) » — où, ce qui marche (suite), ce qui n'est PAS prouvé (Safari/iPhone ; Google avec clé ; référent accepté), dettes (S4d ; `pickFiles` hors suite ; suggestions distantes hors fiche), versions, bilan suite + mesures ; fusion : rebaser si `main` a bougé. Spec § 11.2 : une ligne par ruling R-ISBN-n (au moins : R-ISBN-1 U+2028/2029 nommés dans `borner` ; `nouvelleGeneration()` libère la recherche ; cas 10 R-UX-13 sur `search.json`).

- [ ] **Step 4 : Suite finale `✅`, total posé, `tools` 40/40, `--check` 0.** `sw.js` : `VERSION = 'cuisine-os-v0.4.1-10'`.

- [ ] **Step 5 : Commit**

```bash
git add docs/architecture.md docs/google-books.md CLAUDE.md docs/superpowers/specs/2026-10-14-identifier-un-livre-fiable-design.md sw.js tests/tests.js
git commit -m "Cloture du lot Identifier un livre fiable : docs, procedure cle Google, mesures reelles, spec 11.2" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Après le plan (hors tâches, par le chef d'orchestre)

Revue finale de branche (modèle le plus capable) + une vague de corrections ; `/verify` (revue adverse + suite + scan secrets : aucun `AIza…`, aucune adresse personnelle) ; copier `.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/` dans `~/projects/mistu/.superpowers/sdd/` **avant** tout `git worktree remove` ; si `main` a bougé, rebaser ; Neegan fusionne (`!`) puis `git push` ; preuve sur le site public : les deux ISBN, les suggestions, la recherche « bbq ».
