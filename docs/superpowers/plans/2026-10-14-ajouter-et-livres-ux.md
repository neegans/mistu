# Page « Ajouter » et flux des livres — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page « Ajouter » en cartes, un ajout de livre en deux pas (ISBN → détails, cuisines en puces, couverture), un accueil du livre après création, des gestes nommés dans la fiche livre, un sélecteur « ces pages vont où ? » avant un scan parti de la page générale, et un signet web — sans rien inventer, sans migration serveur, sans effacer de fichier.

**Architecture:** Modèles purs + rendus DOM à gestes injectés (motif `src/ui/porte-entree.js`), composés par les vues existantes (`add.js`, `book.js`, `import.js`, `library.js`, `recipe.js`, `recipe-edit.js`). Six modules neufs : `src/ui/puces.js`, `src/ui/livre-ajout.js`, `src/ui/accueil-livre.js`, `src/ui/signet.js`, `src/core/image.js`, `src/core/blob-urls.js`. Trois nouveaux champs vivent dans `data` côté serveur (`book_editions.cover_sha256`, `recipes.source_url`) ou dans l'adresse (`intention`) : `DB_VERSION` et les migrations ne bougent pas.

**Tech Stack:** PWA sans build, modules ES natifs, IndexedDB (`src/core/db.js`, `src/model/repo.js`), `t()` i18n, suite de tests navigateur `tests/index.html` (Playwright MCP), outils Node `tools/*.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md` (rév. 2). Les paragraphes cités `§ n` sont ceux de la spec.

## Global Constraints

- **Branche `ajouter-livres-ux`**, arbre `~/projects/mistu`, serveur `http://localhost:8080/` (déjà lancé par Neegan ; sinon `cd ~/projects/mistu && nohup python3 -m http.server 8080 > /dev/null 2>&1 &`). Pas de worktree neuf ; pas de `git stash` ; **aucun `git push`**.
- **Suite complète** = `http://localhost:8080/tests/?v=<libre>` par Playwright MCP : **avant chaque passage**, désinscrire le service worker (`navigator.serviceWorker.getRegistrations()` → `unregister()`) et purger le cache par CDP (`Network.clearBrowserCache`), sinon un `304` sert un module périmé. Lire `#out h2` ; **0 erreur et 0 avertissement console** exigés (hors `favicon.ico` racine). La page de tests charge `tests/tests.js`, qui appelle les suites ; les nouveaux tests vivent dans **`tests/ajouter.js`** (`export async function runAjouterTests({ eq, ok })`), câblé dans `tests/tests.js` à côté de `runSyncL3Tests`. État de départ mesuré : **986/986**.
- **Navigateur Playwright = fenêtre partagée avec Neegan** : aucun `deleteDatabase`, aucun « Effacer », aucun `clearDevice`, aucune écriture dans la base `cuisine-os` — bases jetables seulement (`withRepo` de `tests/sync-fixture.js`, `withDatabase` de `tests/backup.js`). Aucun `history.pushState/replaceState` réel dans un test : le geste `historique.remplacer` est injecté et espionné.
- **Aucun réseau dans les tests** : `fetch` injecté partout où le code en prend un (`lookupIsbn`, `recupererCouvertureParIsbn`).
- **Écritures** : `repo.save` / `repo.saveBatch` (jamais `db.mutate` depuis une vue — I-D). **Aucun blob effacé** par ce lot (§ 2). Chaînes par `t('…')` avec entrée dans `src/i18n/en.js` pour **chaque** chaîne neuve. Aucun `innerHTML`, aucun `html:` d'`el()`, aucun `window.open`.
- **`sw.js`** : tout module neuf entre dans `SHELL` ; `VERSION` incrémentée à **chaque tâche** qui touche un fichier servi (`cuisine-os-v0.4.0-1`, `-2`, …) ; `APP_VERSION` passe à `'0.4.0'` en tâche 10.
- **Invariants** (§ 3) : rien d'inventé (provenance étiquetée), états = événements réels, écran du côté de la personne (première ligne = le but), I-F (un scan parti d'un livre porte le livre), I-G (distant borné et revalidé), I-H (gestes injectés).
- **Commits** : messages **sans accents**, un commit par tâche au moins, terminés par `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. `node --check` sur chaque fichier touché ; U+2028/2029 = 0 (`grep -c $'\xe2\x80[\xa8\xa9]' <fichier>` → `0`).
- **Vérifications de fin de tâche** (toutes) : suite complète verte, `node --test tools/*.test.mjs` 40/40, `node tools/generer-migrations.mjs --check` → 0, `git status --porcelain` vide.

---

## Structure des fichiers

| Fichier | Rôle | Tâches |
|---|---|---|
| `tests/ajouter.js` (créer) | toutes les assertions du lot, `runAjouterTests` | 1 → 10 |
| `tests/tests.js` (modifier) | import + appel de `runAjouterTests` | 1 |
| `src/ui/puces.js` (créer) | normalisation, graine, `pucesModel`, `renderPuces` | 1 |
| `src/ui/components.js` (modifier) | `carte()`, `libelleLivre()`, `bookCover` avec fichier, pastille « Lien web » | 2, 7, 9 |
| `src/ui/add.js` (réécrire) | grille, sélecteur avant scan, composition | 2 |
| `src/ui/import.js` (modifier) | `startScanSession` avec `intention`, `sessionView` qui la consomme, `libelleLivre` | 3 |
| `src/core/router.js` (modifier) | `remplacerAdresse(hash)` | 3 |
| `src/ui/livre-ajout.js` (créer) | `lookupIsbn` neuf, `livreAjoutModel`, `renderLivreAjout`, `enregistrerLivre`, route | 4, 9 |
| `src/app.js` (modifier) | routes `/add/livre`, `/add/signet` ; révocation des URL `blob:` à chaque route | 4, 7, 9 |
| `src/ui/accueil-livre.js` (créer) | `accueilLivreModel`, `renderAccueilLivre` | 5 |
| `src/ui/book.js` (modifier) | accueil `?nouveau=1`, gestes « + Pages d'index » / « + Recette », séance en cours, puces, couverture | 5, 9 |
| `src/ui/recipe-edit.js` (modifier) | champ « Cuisines » en puces | 6 |
| `src/ui/signet.js` (créer) | `signetModel`, `lienSignet`, `enregistrerSignet`, `renderSignet`, route | 7 |
| `src/ui/recipe.js` (modifier) | branche « Lien web gardé » | 7 |
| `src/domain/search.js` (modifier) | cuisines dans `titleTokens` des références | 7 |
| `src/core/image.js` (créer) | `dimensionsImage`, `reduireImage`, bornes | 8 |
| `src/sync/mime.js` (modifier) | `COVER_INPUT_MIME` | 8 |
| `src/core/blob-urls.js` (créer) | `urlDeBlob`, `revoquerUrlsDeBlob` | 9 |
| `src/model/repo.js` (modifier) | `getFiles(sha256s)` | 9 |
| `src/ui/library.js` (modifier) | `renderLibrary` asynchrone avec fichiers, `booksTab(ctx, fichiers)` | 9 |
| `index.html`, `tests/index.html` (modifier) | `connect-src` épinglé | 10 |
| `styles.css` (modifier) | `.carte`, `.puce`, `.accueil-livre`, `.cover.with-img`, `.cover-img` | 2, 5, 9 |
| `src/i18n/en.js` (modifier) | toutes les chaînes neuves | chaque tâche |
| `sw.js` (modifier) | `SHELL` + `VERSION` | chaque tâche |
| `CLAUDE.md`, `README.md`, `docs/architecture.md`, spec § 15 (modifier) | clôture | 10 |

Ordre : **tranche 1** = tâches 1-6 (navigation et puces) · **tranche 2** = tâche 7 (signet) · **tranche 3** = tâches 8-9 (couverture) · **clôture** = tâche 10.

---

### Task 1 : Puces « Cuisines » — module pur et rendu (§ 7)

**Files:**
- Create: `src/ui/puces.js`
- Create: `tests/ajouter.js`
- Modify: `tests/tests.js` (import + appel), `src/i18n/en.js`, `sw.js`, `styles.css`

**Interfaces:**
- Produces: `normaliser(s) → string` (trim, minuscules, accents retirés) ; `capitaliser(s) → string` ; `GRAINE_CUISINES: string[]` ; `pucesModel({ choisies, existantes, graine }) → { puces: [{ cle, valeur, libelle, choisie }] }` ; `basculerPuce(choisies, valeur) → string[]` ; `ajouterPuce(choisies, texte) → string[]` (même tableau si refusé) ; `cuisinesExistantes(ctx) → string[]` ; `renderPuces(model, { basculer, ajouter }) → HTMLElement` (`.puces`, boutons `.puce[aria-pressed]`, champ « Autre… »).

- [ ] **Step 1 : câbler `tests/ajouter.js` dans la suite et écrire les tests rouges**

Créer `tests/ajouter.js` :

```js
// Tests du lot « page Ajouter et flux des livres » (spec docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md).
// Modèles purs et rendus DOM à gestes injectés ; bases jetables seulement ; aucun réseau ; aucun history.* réel.
export async function runAjouterTests({ eq, ok }) {
  // --- § 7 Puces « Cuisines »
  const { normaliser, capitaliser, GRAINE_CUISINES, pucesModel, basculerPuce, ajouterPuce, cuisinesExistantes, renderPuces } = await import('../src/ui/puces.js');
  eq(normaliser('  Québécoise '), 'quebecoise', 'puces : normaliser = trim + minuscules + accents retirés');
  eq(capitaliser('italienne'), 'Italienne', 'puces : capitaliser la première lettre seulement');
  eq(capitaliser(''), '', 'puces : capitaliser une chaîne vide rend vide');
  eq(GRAINE_CUISINES, ['québécoise', 'autochtone', 'française', 'italienne', 'levantine', 'marocaine', 'mexicaine', 'indienne', 'chinoise', 'japonaise', 'thaïe', 'vietnamienne', 'grecque', 'espagnole', 'américaine'], 'puces : la graine fermée, en minuscules');
  {
    const m = pucesModel({ choisies: ['Italienne'], existantes: ['levantine', 'levantine', 'italienne', 'thaie'], graine: ['italienne', 'levantine', 'grecque'] });
    eq(m.puces.map((p) => p.valeur), ['Italienne', 'levantine', 'thaie', 'grecque'], 'puces : choisies d’abord, puis existantes par fréquence, puis la graine — la jumelle de graine d’une valeur existante est masquée');
    eq(m.puces.map((p) => p.choisie), [true, false, false, false], 'puces : seule la valeur choisie est marquée');
    eq(m.puces[0].libelle, 'Italienne', 'puces : le libellé affiché est capitalisé');
    eq(m.puces[2].cle, 'thaie', 'puces : la clé est la forme normalisée');
  }
  eq(basculerPuce(['a', 'b'], 'b'), ['a'], 'puces : basculer retire une valeur choisie');
  eq(basculerPuce(['a'], 'B'), ['a', 'B'], 'puces : basculer ajoute une valeur absente telle quelle');
  eq(ajouterPuce(['italienne'], ' Italienne '), ['italienne'], 'puces : un doublon par normalisation est refusé (même tableau)');
  eq(ajouterPuce(['italienne'], 'Thaïe'), ['italienne', 'thaïe'], 'puces : « Autre… » ajoute en minuscules, accents conservés');
  eq(ajouterPuce(['italienne'], '   '), ['italienne'], 'puces : le vide est ignoré');
  eq(cuisinesExistantes({ books: [{ cuisines: ['a', 'b'] }, {}], recipes: [{ cuisines: ['b'] }] }), ['a', 'b', 'b'], 'puces : existantes = toutes les occurrences des livres et des recettes (la fréquence compte)');
  {
    const appels = [];
    const m = pucesModel({ choisies: ['italienne'], existantes: [], graine: ['italienne', 'grecque'] });
    const noeud = renderPuces(m, { basculer: (v) => appels.push(['basculer', v]), ajouter: (v) => appels.push(['ajouter', v]) });
    const boutons = [...noeud.querySelectorAll('button.puce')];
    eq(boutons.map((b) => b.textContent), ['Italienne', 'Grecque'], 'puces : rendu dans l’ordre du modèle, libellés capitalisés');
    eq(boutons.map((b) => b.getAttribute('aria-pressed')), ['true', 'false'], 'puces : aria-pressed reflète le choix');
    boutons[1].click();
    const champ = noeud.querySelector('input[type="text"]');
    champ.value = 'Levantine';
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    eq(appels, [['basculer', 'grecque'], ['ajouter', 'Levantine']], 'puces : un clic bascule la VALEUR stockée, Entrée ajoute le texte tapé');
    ok(!noeud.innerHTML.includes('<script'), 'puces : rendu par el(), aucun HTML injecté');
  }
}
```

Dans `tests/tests.js`, ajouter après `import { runSyncL3Tests } from './sync-l3.js';` :

```js
import { runAjouterTests } from './ajouter.js';
```

et, à l'endroit où `runSyncL3Tests({ eq, ok })` est appelé (chercher `runSyncL3Tests(` dans le fichier), ajouter juste après, de la même façon :

```js
await runAjouterTests({ eq, ok });
```

- [ ] **Step 2 : lancer la suite — attendu rouge**

Playwright → `http://localhost:8080/tests/?v=t1-rouge` (SW désinscrit, cache purgé). Attendu : la suite affiche des échecs du bloc « puces » (import de `../src/ui/puces.js` en échec → les assertions du bloc tombent, ou la suite nomme l'import manquant). Noter le compte.

- [ ] **Step 3 : écrire `src/ui/puces.js`**

```js
// Puces « Cuisines » (spec § 7) : une seule normalisation décide de l'union et de l'ajout ; la valeur STOCKÉE reste la
// chaîne en minuscules sans espaces de bord (comme add.js et recipe-edit.js l'écrivaient déjà) ; l'affichage capitalise.
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';

export const GRAINE_CUISINES = ['québécoise', 'autochtone', 'française', 'italienne', 'levantine', 'marocaine', 'mexicaine', 'indienne', 'chinoise', 'japonaise', 'thaïe', 'vietnamienne', 'grecque', 'espagnole', 'américaine'];

export const normaliser = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
export const capitaliser = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const valeurStockee = (s) => String(s ?? '').trim().toLowerCase();

// Toutes les occurrences (la fréquence sert à l'ordre), livres puis recettes.
export function cuisinesExistantes(ctx) {
  return [...(ctx?.books || []), ...(ctx?.recipes || [])].flatMap((r) => r?.cuisines || []);
}

export function pucesModel({ choisies = [], existantes = [], graine = GRAINE_CUISINES } = {}) {
  const vues = new Map(); // cle → { cle, valeur, libelle, choisie }
  const poser = (valeur, choisie) => {
    const cle = normaliser(valeur);
    if (!cle) return;
    if (!vues.has(cle)) vues.set(cle, { cle, valeur, libelle: capitaliser(t(valeur)), choisie });
    else if (choisie) vues.get(cle).choisie = true;
  };
  for (const v of choisies) poser(v, true);
  const freq = new Map();
  for (const v of existantes) { const c = normaliser(v); if (c) freq.set(c, { n: (freq.get(c)?.n || 0) + 1, valeur: freq.get(c)?.valeur ?? valeurStockee(v) }); }
  for (const [, { valeur }] of [...freq.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))) poser(valeur, false);
  for (const v of graine) poser(v, false);
  return { puces: [...vues.values()] };
}

export function basculerPuce(choisies, valeur) {
  const cle = normaliser(valeur);
  return choisies.some((c) => normaliser(c) === cle) ? choisies.filter((c) => normaliser(c) !== cle) : [...choisies, valeur];
}

// Refus = le MÊME tableau (l'appelant compare par identité pour ne pas re-rendre).
export function ajouterPuce(choisies, texte) {
  const valeur = valeurStockee(texte);
  const cle = normaliser(valeur);
  if (!cle || choisies.some((c) => normaliser(c) === cle)) return choisies;
  return [...choisies, valeur];
}

export function renderPuces(model, { basculer, ajouter } = {}) {
  const liste = el('div', { class: 'puces', role: 'group' },
    ...model.puces.map((p) => el('button', { type: 'button', class: 'puce', 'aria-pressed': p.choisie ? 'true' : 'false', onClick: () => basculer && basculer(p.valeur) }, p.libelle)));
  const champ = el('input', { type: 'text', placeholder: t('Autre…'), 'aria-label': t('Autre cuisine') });
  const envoyer = () => { const v = champ.value; if (!v.trim()) return; ajouter && ajouter(v); champ.value = ''; };
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); envoyer(); } });
  return el('div', { class: 'stack' }, liste,
    el('div', { class: 'row' }, champ, el('button', { type: 'button', class: 'btn small', onClick: envoyer }, t('Ajouter'))));
}
```

`src/i18n/en.js` — ajouter (dans le bloc le plus proche des formulaires) :

```js
  'Autre…': 'Other…', 'Autre cuisine': 'Other cuisine',
  'québécoise': 'Quebecois', 'autochtone': 'Indigenous', 'française': 'French', 'italienne': 'Italian', 'levantine': 'Levantine', 'marocaine': 'Moroccan', 'mexicaine': 'Mexican', 'indienne': 'Indian', 'chinoise': 'Chinese', 'japonaise': 'Japanese', 'thaïe': 'Thai', 'vietnamienne': 'Vietnamese', 'grecque': 'Greek', 'espagnole': 'Spanish', 'américaine': 'American',
```

(`'Ajouter': 'Add'` existe déjà.) `styles.css`, après `.chips` :

```css
.puces { display: flex; flex-wrap: wrap; gap: .35rem; }
.puce { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: .3rem .7rem; font: inherit; font-size: .9rem; cursor: pointer; min-height: 32px; }
.puce[aria-pressed="true"] { background: var(--green); border-color: var(--green); color: var(--cream); }
```

`sw.js` : ajouter `'./src/ui/puces.js'` dans la ligne des `./src/ui/` de `SHELL` (ordre alphabétique) ; `VERSION = 'cuisine-os-v0.4.0-1'`.

- [ ] **Step 4 : lancer la suite — attendu vert**

`?v=t1-vert` : toutes les assertions « puces : … » vertes, total = 986 + le nombre d'assertions ajoutées, 0 erreur console.

- [ ] **Step 5 : vérifications et commit**

```bash
cd ~/projects/mistu && node --check src/ui/puces.js && node --check tests/ajouter.js && grep -c $'\xe2\x80[\xa8\xa9]' src/ui/puces.js tests/ajouter.js src/i18n/en.js
git add src/ui/puces.js tests/ajouter.js tests/tests.js src/i18n/en.js sw.js styles.css
git commit -m "Puces Cuisines : modele pur, rendu et graine (spec UX section 7)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2 : Page « Ajouter » — grille de cartes et sélecteur avant scan (§ 4, § 10)

**Files:**
- Modify: `src/ui/add.js` (réécrit : la grille, le sélecteur, la composition ; `bookForm`/`lookupIsbn`/`scan` **retirés** — ils renaissent en tâche 4 dans `livre-ajout.js`)
- Modify: `src/ui/components.js` (`carte`, `libelleLivre`), `src/i18n/en.js`, `styles.css`, `sw.js`
- Test: `tests/ajouter.js`

**Interfaces:**
- Consumes: `startScanSession(files, { edition_id, intention })` — la signature neuve arrive en tâche 3 ; en attendant, `add.js` l'appelle déjà avec `intention` (argument ignoré jusqu'à la tâche 3 : aucune casse).
- Produces: `components.carte(ico, titre, sousTitre, onClick) → HTMLButtonElement.carte` ; `components.libelleLivre(edition, book) → string` (« titre · auteur · année ») ; `add.js` exporte `grilleModel({ editionImposee }) → { cartes: [{ action, ico, titre, sousTitre }] }`, `GRILLE_ACTIONS = ['ajouterLivre', 'pages', 'saisir', 'signet', 'congelateur']`, `renderGrille(model, gestes)`, `selecteurScanModel({ livres, editionImposee, livreChoisi, genre }) → { options, livreChoisi, livreImpose, genre, indexDisponible, messageIndex }`, `renderSelecteurScan(model, gestes)` (gestes `{ changerLivre, changerGenre, photographier, choisir, retour }`), `ACCEPT_PHOTOS = 'image/*'`, `ACCEPT_FICHIERS = 'image/*,application/pdf,application/epub+zip'`. **Attention** : la route `/add` garde `renderAdd(params, query, ctx)` ; les routes `/add/livre` et `/add/signet` n'existent pas encore (tâches 4 et 7) — la carte « Ajouter un livre » navigue vers `/add/livre`, qui affichera « Page introuvable » jusqu'à la tâche 4 : c'est attendu et dit au registre.

- [ ] **Step 1 : tests rouges** — ajouter dans `runAjouterTests`, après le bloc puces :

```js
  // --- § 4 Grille et § 10 sélecteur avant scan
  const { grilleModel, GRILLE_ACTIONS, renderGrille, selecteurScanModel, renderSelecteurScan, ACCEPT_PHOTOS, ACCEPT_FICHIERS } = await import('../src/ui/add.js');
  const { libelleLivre, carte } = await import('../src/ui/components.js');
  eq(GRILLE_ACTIONS, ['ajouterLivre', 'pages', 'saisir', 'signet', 'congelateur'], 'grille : cinq gestes nommés, dans l’ordre des cartes');
  eq(grilleModel({}).cartes.map((c) => c.action), GRILLE_ACTIONS, 'grille : une carte par geste, même ordre');
  eq(grilleModel({}).cartes.map((c) => c.titre), ['Ajouter un livre', 'Photographier ou importer des pages', 'Saisir une recette', 'Garder un lien web', 'Ajouter un lot au congélateur'], 'grille : les cinq titres de la spec');
  {
    const appels = [];
    const gestes = Object.fromEntries(GRILLE_ACTIONS.map((a) => [a, () => appels.push(a)]));
    const noeud = renderGrille(grilleModel({}), gestes);
    const cartes = [...noeud.querySelectorAll('button.carte')];
    eq(cartes.length, 5, 'grille : cinq cartes rendues, aucun formulaire');
    eq(noeud.querySelectorAll('input, select, textarea').length, 0, 'grille : plus aucun champ de formulaire sur la page Ajouter');
    cartes[3].click(); cartes[0].click();
    eq(appels, ['signet', 'ajouterLivre'], 'grille : chaque carte appelle son geste');
    eq(renderGrille(grilleModel({}), { pages: () => {} }).querySelectorAll('button.carte').length, 1, 'grille : une carte sans geste câblé n’est pas rendue');
  }
  eq(libelleLivre({ year: 2019 }, { title: 'Mon livre', author: 'A. B.' }), 'Mon livre · A. B. · 2019', 'libelleLivre : titre · auteur · année');
  eq(libelleLivre({}, null), 'Sans titre', 'libelleLivre : sans livre → « Sans titre »');
  ok(carte('x', 'T', 'S', () => {}).classList.contains('carte'), 'carte : composant partagé');
  {
    const livres = [{ edition: { id: 'e1', year: 2019 }, book: { title: 'B', author: 'x' }, activite: 5 }, { edition: { id: 'e2' }, book: { title: 'A' }, activite: 0 }, { edition: { id: 'e3' }, book: { title: 'C' }, activite: 9 }];
    const m = selecteurScanModel({ livres, livreChoisi: '', genre: 'recette' });
    eq(m.options.map((o) => o.value), ['', 'e3', 'e1', 'e2'], 'sélecteur : « sans livre » d’abord, puis par activité décroissante, puis titre');
    eq(m.options[0].label, 'Recette indépendante (sans livre)', 'sélecteur : le défaut est nommé');
    eq(m.options[2].label, 'B · x · 2019', 'sélecteur : libellé = libelleLivre');
    eq([m.indexDisponible, m.messageIndex], [false, 'Un index appartient à un livre : choisis-le d’abord.'], 'sélecteur : sans livre, « Index » indisponible et la raison est dite');
    const m2 = selecteurScanModel({ livres, livreChoisi: 'e1', genre: 'index' });
    eq([m2.indexDisponible, m2.messageIndex, m2.genre], [true, null, 'index'], 'sélecteur : avec un livre, « Index » disponible');
    eq(selecteurScanModel({ livres, livreChoisi: '', genre: 'index' }).genre, 'recette', 'sélecteur : un genre « index » sans livre retombe sur « recette »');
    const m3 = selecteurScanModel({ livres, editionImposee: 'e2', livreChoisi: '', genre: 'recette' });
    eq([m3.livreImpose, m3.livreChoisi], [true, 'e2'], 'sélecteur : une édition imposée (?edition connu) fixe le livre');
    eq(selecteurScanModel({ livres, editionImposee: 'inconnue', livreChoisi: '', genre: 'recette' }).livreImpose, false, 'sélecteur : un ?edition inconnu est traité comme absent (S9)');
    const appels = [];
    const noeud = renderSelecteurScan(m, { changerLivre: (v) => appels.push(['livre', v]), changerGenre: (v) => appels.push(['genre', v]), photographier: () => appels.push(['photo']), choisir: () => appels.push(['choisir']), retour: () => appels.push(['retour']) });
    eq(noeud.querySelector('h2').textContent, 'Ces pages vont où ?', 'sélecteur : la première ligne dit le but');
    const radios = [...noeud.querySelectorAll('input[type="radio"]')];
    eq(radios.map((r) => [r.value, r.disabled, r.checked]), [['recette', false, true], ['index', true, false]], 'sélecteur : deux genres, « index » désactivé sans livre');
    const boutons = [...noeud.querySelectorAll('button.btn')].map((b) => b.textContent);
    ok(boutons.includes('Photographier') && boutons.includes('Choisir des photos ou un PDF') && boutons.includes('← Retour'), 'sélecteur : les deux sources et le retour');
    noeud.querySelector('select').value = 'e1'; noeud.querySelector('select').dispatchEvent(new Event('change'));
    [...noeud.querySelectorAll('button.btn')].find((b) => b.textContent === 'Photographier').click();
    eq(appels, [['livre', 'e1'], ['photo']], 'sélecteur : les gestes reçoivent la valeur choisie');
    const impose = renderSelecteurScan(m3, { changerLivre: () => {}, changerGenre: () => {}, photographier: () => {}, choisir: () => {}, retour: () => {} });
    ok(impose.querySelector('select').disabled, 'sélecteur : livre imposé → select désactivé');
  }
  eq([ACCEPT_PHOTOS, ACCEPT_FICHIERS], ['image/*', 'image/*,application/pdf,application/epub+zip'], 'sélecteur : les accept actuels sont conservés');
```

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t2-rouge` : exports absents de `add.js`, `libelleLivre`/`carte` absents).

- [ ] **Step 3 : `components.js`** — ajouter après `bookCover` :

```js
// Carte d'action de la page « Ajouter » (spec § 4) et de l'accueil d'un livre (§ 8).
export function carte(ico, titre, sousTitre, onClick) {
  return el('button', { type: 'button', class: 'card carte', onClick },
    el('div', { class: 'carte-ico', 'aria-hidden': 'true' }, ico), el('h3', null, titre), sousTitre ? el('p', { class: 'muted' }, sousTitre) : null);
}

// Un seul libellé pour désigner un livre dans une liste (spec § 10, F18) : titre · auteur · année.
export function libelleLivre(edition, book) {
  return [book?.title || t('Sans titre'), book?.author, edition?.year].filter(Boolean).join(' · ');
}
```

`styles.css`, après `.card.danger` :

```css
.card.carte { text-align: left; cursor: pointer; border: 0; font: inherit; width: 100%; }
.card.carte .carte-ico { font-size: 1.6rem; }
.card.carte p { margin: 0; font-size: .9rem; }
```

- [ ] **Step 4 : réécrire `src/ui/add.js`**

```js
// Ajouter (spec UX § 4, § 10) : une grille de cinq cartes, et — avant un scan parti d'ici — la question « ces pages vont
// où ? ». Le formulaire « Ajouter un livre » vit dans livre-ajout.js (#/add/livre), le signet dans signet.js (#/add/signet).
import { el, pickFiles } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, refresh } from '../core/router.js';
import { pageHeader, carte, libelleLivre, field, select } from './components.js';
import { startScanSession } from './import.js';

export const GRILLE_ACTIONS = ['ajouterLivre', 'pages', 'saisir', 'signet', 'congelateur'];
export const ACCEPT_PHOTOS = 'image/*';
export const ACCEPT_FICHIERS = 'image/*,application/pdf,application/epub+zip';

export function grilleModel() {
  return { cartes: [
    { action: 'ajouterLivre', ico: '📚', titre: t('Ajouter un livre'), sousTitre: t('ISBN (scan ou saisie), ou titre à la main') },
    { action: 'pages', ico: '📷', titre: t('Photographier ou importer des pages'), sousTitre: t('Caméra, photos ou PDF — pour une recette ou un index') },
    { action: 'saisir', ico: '✍️', titre: t('Saisir une recette'), sousTitre: t('À la main') },
    { action: 'signet', ico: '🔗', titre: t('Garder un lien web'), sousTitre: t('Une recette ou une page à retrouver') },
    { action: 'congelateur', ico: '🧊', titre: t('Ajouter un lot au congélateur'), sousTitre: t('Portions, date, recette source et méthode de réchauffage.') },
  ] };
}

// Une carte sans geste câblé n'est pas rendue (même garde que la porte d'entrée).
export function renderGrille(model, gestes = {}) {
  return el('div', { class: 'grid wide' },
    ...model.cartes.filter((c) => typeof gestes[c.action] === 'function').map((c) => carte(c.ico, c.titre, c.sousTitre, () => gestes[c.action]())));
}

// livres : [{ edition, book, activite }] ; editionImposee : id connu (I-F) ou null ; genre : 'recette' | 'index'.
export function selecteurScanModel({ livres = [], editionImposee = null, livreChoisi = '', genre = 'recette' } = {}) {
  const connu = editionImposee && livres.some((l) => l.edition.id === editionImposee) ? editionImposee : null; // S9
  const choisi = connu || livreChoisi || '';
  const tries = [...livres].sort((a, b) => (b.activite || 0) - (a.activite || 0) || libelleLivre(a.edition, a.book).localeCompare(libelleLivre(b.edition, b.book)));
  const options = [{ value: '', label: t('Recette indépendante (sans livre)') }, ...tries.map((l) => ({ value: l.edition.id, label: libelleLivre(l.edition, l.book) }))];
  const indexDisponible = !!choisi;
  return { options, livreChoisi: choisi, livreImpose: !!connu, genre: indexDisponible && genre === 'index' ? 'index' : 'recette', indexDisponible, messageIndex: indexDisponible ? null : t('Un index appartient à un livre : choisis-le d’abord.') };
}

export function renderSelecteurScan(model, gestes = {}) {
  const radio = (valeur, libelle, disabled) => el('label', { class: 'check' },
    el('input', { type: 'radio', name: 'genre', value: valeur, checked: model.genre === valeur, disabled, onChange: () => gestes.changerGenre && gestes.changerGenre(valeur) }), ' ', libelle);
  const sel = select(model.options, model.livreChoisi, (v) => gestes.changerLivre && gestes.changerLivre(v));
  sel.disabled = model.livreImpose;
  return el('section', { class: 'card stack selecteur-scan' },
    el('h2', null, t('Ces pages vont où ?')),
    field(t('Livre'), sel),
    el('div', { class: 'stack' }, el('span', null, t('Genre de pages')),
      radio('recette', t('Page(s) de recette'), false), radio('index', t('Index ou table des matières'), !model.indexDisponible),
      model.messageIndex ? el('small', { class: 'muted' }, model.messageIndex) : null),
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn primary', onClick: () => gestes.photographier && gestes.photographier() }, t('Photographier')),
      el('button', { type: 'button', class: 'btn', onClick: () => gestes.choisir && gestes.choisir() }, t('Choisir des photos ou un PDF')),
      el('button', { type: 'button', class: 'btn link', onClick: () => gestes.retour && gestes.retour() }, t('← Retour'))));
}

export async function renderAdd(params, query, ctx) {
  const root = el('div', null, pageHeader(t('Ajouter')));
  const zone = el('div', null);
  root.append(zone);
  const activite = new Map();
  for (const a of ctx.library_activity || []) activite.set(a.edition_id, (activite.get(a.edition_id) || 0) + 1);
  const livres = ctx.book_editions.map((edition) => ({ edition, book: ctx.booksById.get(edition.book_id), activite: activite.get(edition.id) || 0 }));
  const editionImposee = query.edition && ctx.editionsById.has(query.edition) ? query.edition : null; // S9
  const etat = { livreChoisi: editionImposee || '', genre: 'recette' };
  const lancer = async (accept, capture) => {
    const files = await pickFiles({ accept, multiple: true, capture });
    if (files.length) await startScanSession(files, { edition_id: etat.livreChoisi || null, intention: etat.genre });
  };
  const gestesScan = {
    changerLivre: (v) => { etat.livreChoisi = v; dessinerSelecteur(); },
    changerGenre: (v) => { etat.genre = v; dessinerSelecteur(); },
    photographier: () => lancer(ACCEPT_PHOTOS, 'environment'),
    choisir: () => lancer(ACCEPT_FICHIERS, null),
    retour: () => dessinerGrille(),
  };
  const dessinerSelecteur = () => zone.replaceChildren(renderSelecteurScan(selecteurScanModel({ livres, editionImposee, livreChoisi: etat.livreChoisi, genre: etat.genre }), gestesScan));
  // ?edition connu (« Scanner cette recette ») : la question est déjà répondue — les deux sources, directement (F14).
  const dessinerImpose = () => zone.replaceChildren(el('section', { class: 'card stack' },
    el('h2', null, t('Ajouter des pages à « {l} »', { l: libelleLivre(ctx.editionsById.get(editionImposee), ctx.booksById.get(ctx.editionsById.get(editionImposee)?.book_id)) })),
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn primary', onClick: gestesScan.photographier }, t('Photographier')),
      el('button', { type: 'button', class: 'btn', onClick: gestesScan.choisir }, t('Choisir des photos ou un PDF')),
      el('button', { type: 'button', class: 'btn link', onClick: () => dessinerGrille() }, t('← Retour')))));
  const dessinerGrille = () => zone.replaceChildren(renderGrille(grilleModel(), {
    ajouterLivre: () => navigate('/add/livre'),
    pages: () => (editionImposee ? dessinerImpose() : dessinerSelecteur()),
    saisir: () => navigate('/recipes/new' + (editionImposee ? `?edition=${editionImposee}` : '')),
    signet: () => navigate('/add/signet'),
    congelateur: () => navigate('/kitchen?tab=inventory&add=1'),
  }));
  dessinerGrille();
  return root;
}

export { refresh };
```

`en.js` — ajouter : `'ISBN (scan ou saisie), ou titre à la main': 'ISBN (scan or typed), or title by hand', 'Photographier ou importer des pages': 'Photograph or import pages', 'Caméra, photos ou PDF — pour une recette ou un index': 'Camera, photos or PDF — for a recipe or an index', 'À la main': 'By hand', 'Garder un lien web': 'Keep a web link', 'Une recette ou une page à retrouver': 'A recipe or a page to find again', 'Recette indépendante (sans livre)': 'Standalone recipe (no book)', 'Un index appartient à un livre : choisis-le d’abord.': 'An index belongs to a book: choose it first.', 'Ces pages vont où ?': 'Where do these pages go?', 'Livre': 'Book', 'Genre de pages': 'Kind of pages', 'Page(s) de recette': 'Recipe page(s)', 'Index ou table des matières': 'Index or table of contents', 'Photographier': 'Take photos', '← Retour': '← Back', 'Ajouter des pages à « {l} »': 'Add pages to “{l}”'` (vérifier chaque clé : si elle existe déjà, ne pas la doubler). Retirer d'`en.js` les clés qui n'existent plus nulle part dans `src/` après la réécriture (`grep -rn "<clé>" src/` vide) — par exemple `'Choisir des photos ou un PDF'` **reste** (utilisée).

`sw.js` : `VERSION = 'cuisine-os-v0.4.0-2'` (aucun module neuf).

- [ ] **Step 5 : lancer — attendu vert** (`?v=t2-vert`). Vérifier aussi, dans l'app (`http://localhost:8080/#/add`), que la grille s'affiche sans erreur console et que « Photographier ou importer des pages » ouvre le sélecteur ; **ne pas** cliquer « Photographier » (sélecteur de fichiers natif).

- [ ] **Step 6 : vérifications et commit**

```bash
cd ~/projects/mistu && node --check src/ui/add.js && node --check src/ui/components.js && grep -rn "bookForm\|lookupIsbn" src/ | grep -v livre-ajout ; grep -c $'\xe2\x80[\xa8\xa9]' src/ui/add.js src/ui/components.js
git add src/ui/add.js src/ui/components.js src/i18n/en.js styles.css sw.js tests/ajouter.js
git commit -m "Page Ajouter : grille de cinq cartes et selecteur avant scan (spec UX sections 4 et 10)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Le `grep lookupIsbn` doit être vide : la fonction renaît en tâche 4.)

---

### Task 3 : L'intention voyage dans l'adresse — `startScanSession`, `sessionView`, `remplacerAdresse` (§ 10)

**Files:**
- Modify: `src/ui/import.js:15-41` (signature), `:46-51` (`renderImport` passe `query`), `:66-146` (`sessionView` consomme `intention`, `libelleLivre` dans le `select`), `src/core/router.js` (`remplacerAdresse`), `sw.js`
- Test: `tests/ajouter.js`

**Interfaces:**
- Produces: `startScanSession(files, { edition_id = null, session_id = null, intention = null } = {})` → navigue vers `/import?session=<id>` + `&intention=index|recette` si fournie ; `adresseSeance(sessionId, intention) → string` (pur, exporté) ; `appliquerIntention({ intention, pageIds }) → { selection: string[], ouvrirIndex: boolean, consommee: boolean }` (pur, exporté) ; `router.remplacerAdresse(hash)` = `history.replaceState(null, '', hash)`.
- `sessionView(session, ctx, query, { historique } = {})` : `historique.remplacer` injecté (défaut : `remplacerAdresse`).

- [ ] **Step 1 : tests rouges**

```js
  // --- § 10 L'intention voyage dans l'adresse (F6)
  const { adresseSeance, appliquerIntention } = await import('../src/ui/import.js');
  const { remplacerAdresse } = await import('../src/core/router.js');
  eq(adresseSeance('ss1', 'index'), '/import?session=ss1&intention=index', 'intention : portée par l’adresse');
  eq(adresseSeance('ss1', null), '/import?session=ss1', 'intention : absente → adresse d’aujourd’hui');
  eq(adresseSeance('ss1', 'autre'), '/import?session=ss1', 'intention : une valeur inconnue n’entre pas dans l’adresse');
  eq(appliquerIntention({ intention: 'index', pageIds: ['p1', 'p2'] }), { selection: ['p1', 'p2'], ouvrirIndex: true, consommee: true }, 'intention index : pages présélectionnées, panneau ouvert');
  eq(appliquerIntention({ intention: 'recette', pageIds: ['p1'] }), { selection: ['p1'], ouvrirIndex: false, consommee: true }, 'intention recette : pages présélectionnées, panneau fermé');
  eq(appliquerIntention({ intention: undefined, pageIds: ['p1'] }), { selection: [], ouvrirIndex: false, consommee: false }, 'sans intention : rien n’est appliqué (un refresh() ultérieur ne réapplique rien)');
  eq(typeof remplacerAdresse, 'function', 'router : remplacerAdresse existe (history.replaceState enveloppé, jamais appelé par la suite)');
```

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t3-rouge`).

- [ ] **Step 3 : `router.js`** — ajouter après `navigate` :

```js
// Retire ou pose un paramètre d'adresse SANS re-rendu : history.replaceState ne déclenche pas hashchange. Injecté dans les
// vues qui s'en servent (geste `historique.remplacer`), donc espionnable dans la suite.
export function remplacerAdresse(hash) { history.replaceState(null, '', hash.startsWith('#') ? hash : '#' + hash); }
```

- [ ] **Step 4 : `import.js`**

Imports : ajouter `remplacerAdresse` à l'import du routeur et `libelleLivre` à celui de `components.js`. Ajouter avant `startScanSession` :

```js
const INTENTIONS = ['index', 'recette'];
// L'intention (spec § 10) voyage dans l'adresse, pas dans la base : consommée au premier rendu, puis retirée.
export const adresseSeance = (sessionId, intention) => `/import?session=${sessionId}${INTENTIONS.includes(intention) ? `&intention=${intention}` : ''}`;
export function appliquerIntention({ intention, pageIds = [] } = {}) {
  if (!INTENTIONS.includes(intention)) return { selection: [], ouvrirIndex: false, consommee: false };
  return { selection: [...pageIds], ouvrirIndex: intention === 'index', consommee: true };
}
```

`startScanSession` : signature `export async function startScanSession(files, { edition_id = null, session_id = null, intention = null } = {})` ; dernière navigation → `navigate(adresseSeance(session.id, intention));`.

`renderImport` : `return sessionView(session, ctx, query);`.

`sessionView(session, ctx, query = {}, { historique = { remplacer: remplacerAdresse } } = {})` :
- `const selected = new Set();` devient `const applique = appliquerIntention({ intention: query.intention, pageIds: session.page_ids }); const selected = new Set(applique.selection);`
- options du `select` : `label: libelleLivre(e, ctx.booksById.get(e.book_id))` au lieu de `ctx.editionLabel(e)` ;
- les cases : `el('input', { type: 'checkbox', checked: selected.has(p.id), onChange: … })` ;
- après `indexPanel.hidden = true; root.append(indexPanel);` ajouter :

```js
  if (applique.consommee) {
    if (applique.ouvrirIndex) indexPanel.hidden = false;
    historique.remplacer(adresseSeance(session.id, null)); // consommée : un refresh() ne la réappliquera pas
  }
```
- `drawActions()` est déjà appelé après les miniatures : la présélection s'affiche.

`sw.js` : `VERSION = 'cuisine-os-v0.4.0-3'`.

- [ ] **Step 5 : lancer — attendu vert** (`?v=t3-vert`). Dans l'app : ouvrir `#/import` → la liste des séances s'affiche sans erreur ; ne lancer aucun scan réel.

- [ ] **Step 6 : vérifications et commit**

```bash
cd ~/projects/mistu && node --check src/ui/import.js && node --check src/core/router.js && grep -c $'\xe2\x80[\xa8\xa9]' src/ui/import.js src/core/router.js
git add src/ui/import.js src/core/router.js sw.js tests/ajouter.js
git commit -m "Seance de scan : l intention (index ou recette) voyage dans l adresse et se consomme au premier rendu (F6)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4 : « Ajouter un livre » en deux pas — `src/ui/livre-ajout.js`, route `#/add/livre` (§ 5, sans la couverture)

**Files:**
- Create: `src/ui/livre-ajout.js`
- Modify: `src/app.js:85-103` (route), `src/i18n/en.js`, `sw.js`
- Test: `tests/ajouter.js`

**Interfaces:**
- Consumes: `puces.js` (tâche 1), `components.carte/field/select/pageHeader`, `repo.saveBatch`, `repo.newId`, `listConventions` (`src/domain/units.js`).
- Produces: `LIMITES_ISBN = { champ: 300, corps: 256 * 1024, delaiMs: 10000 }` ; `OPTIONS_FETCH = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }` ; `lookupIsbn(isbn, { fetch = globalThis.fetch, signal } = {}) → Promise<{ fiche: { title, author, publisher, year, language } | null, source: 'openlibrary' | 'googlebooks' | null }>` ; `nettoyerIsbn(s) → string` ; `fusionnerFiche(champs, fiche) → champs` (ne remplit que les champs vides, tronqués) ; `livreAjoutModel(etat) → { pas, isbn, champs, provenance, recherche, lecteurDisponible, peutEnregistrer, messages: { provenance, recherche, lecteur } }` ; `fabriquerLivre({ champs, isbn, coverSha256 }, { newId }) → { book, edition }` (pur) ; `enregistrerLivre(args, { repo }) → Promise<edition>` ; `renderLivreAjout(model, gestes)` (gestes `{ changerIsbn, scanner, identifier, saisirMain, changerChamp, basculerCuisine, ajouterCuisine, retourIsbn, enregistrer }`) ; `renderLivreAjoutRoute(params, query, ctx)` (la route). La zone « Couverture » du pas 2 est rendue par un crochet `gestes.couverture` **absent** jusqu'à la tâche 9 : sans ce geste, rien n'est affiché.

- [ ] **Step 1 : tests rouges**

```js
  // --- § 5 Ajouter un livre en deux pas
  const LA = await import('../src/ui/livre-ajout.js');
  eq(LA.LIMITES_ISBN, { champ: 300, corps: 262144, delaiMs: 10000 }, 'livre : bornes S3');
  eq(LA.OPTIONS_FETCH, { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }, 'livre : options de fetch explicites (S12)');
  eq(LA.nettoyerIsbn(' 978-2-7619-5000-1 '), '9782761950001', 'livre : ISBN sans tirets ni espaces');
  {
    // fetch injecté : Open Library répond, Google jamais appelé
    const appels = [];
    const reponse = (status, corps) => ({ ok: status < 400, status, text: async () => corps });
    const fetchOL = async (url, options) => { appels.push([url, options]); return reponse(200, JSON.stringify({ 'ISBN:9782761950001': { title: 'T'.repeat(400), authors: [{ name: 'A' }, { name: 'B' }], publishers: [{ name: 'P' }], publish_date: 'March 2019' } })); };
    const r = await LA.lookupIsbn('9782761950001', { fetch: fetchOL });
    eq(r.source, 'openlibrary', 'livre : Open Library d’abord');
    eq([r.fiche.title.length, r.fiche.author, r.fiche.publisher, r.fiche.year, r.fiche.language], [300, 'A, B', 'P', 2019, null], 'livre : champs tronqués à 300, année entière, langue inconnue → null');
    eq(appels.length, 1, 'livre : Google Books pas appelé quand Open Library répond');
    eq(appels[0][1].credentials, 'omit', 'livre : les options S12 sont passées au fetch');
    // Open Library vide → Google Books ; les deux appels dans un try
    const fetchG = async (url) => url.includes('openlibrary') ? reponse(200, '{}') : reponse(200, JSON.stringify({ items: [{ volumeInfo: { title: 'G', authors: ['X'], publisher: 'Q', publishedDate: '2001-02', language: 'fr' } }] }));
    const g = await LA.lookupIsbn('9782761950001', { fetch: fetchG });
    eq([g.source, g.fiche.title, g.fiche.language, g.fiche.year], ['googlebooks', 'G', 'fr', 2001], 'livre : repli Google Books');
    eq(await LA.lookupIsbn('9782761950001', { fetch: async () => { throw new Error('reseau'); } }), { fiche: null, source: null }, 'livre : un fetch qui rejette → aucune fiche, aucune exception');
    eq(await LA.lookupIsbn('9782761950001', { fetch: async (u) => u.includes('openlibrary') ? reponse(200, '{}') : reponse(429, '{}') }), { fiche: null, source: null }, 'livre : 429 Google Books = échec ordinaire');
    eq(await LA.lookupIsbn('9782761950001', { fetch: async () => reponse(200, 'x'.repeat(262145)) }), { fiche: null, source: null }, 'livre : corps > 256 Ko abandonné avant JSON.parse');
    eq((await LA.lookupIsbn('9782761950001', { fetch: async () => reponse(200, JSON.stringify({ 'ISBN:9782761950001': { title: 'T', publish_date: 'vers 19' } })) })).fiche.year, null, 'livre : une année qui n’est pas quatre chiffres → vide');
    // délai : le signal fourni est transmis
    let signalVu = null;
    await LA.lookupIsbn('9782761950001', { fetch: async (u, o) => { signalVu = o.signal; return reponse(200, '{}'); }, signal: new AbortController().signal });
    ok(signalVu instanceof AbortSignal, 'livre : le signal d’abandon est transmis au fetch');
  }
  eq(LA.fusionnerFiche({ title: 'Déjà', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] }, { title: 'T', author: 'A', publisher: null, year: 2019, language: null }),
    { title: 'Déjà', author: 'A', publisher: '', year: '2019', language: 'fr', convention: '', cuisines: [] }, 'livre : la fusion ne remplit que les champs vides, l’année devient texte de formulaire');
  {
    const m = LA.livreAjoutModel({ pas: 1, isbn: '', champs: { title: '' }, provenance: null, recherche: false, lecteurDisponible: false });
    eq([m.pas, m.peutEnregistrer, m.messages.lecteur], [1, false, 'Le lecteur de code-barres n’est pas offert dans ce navigateur.'], 'livre : pas 1, lecteur absent nommé');
    const m2 = LA.livreAjoutModel({ pas: 2, isbn: '978', champs: { title: 'X' }, provenance: 'openlibrary', recherche: false, lecteurDisponible: true });
    eq([m2.peutEnregistrer, m2.messages.provenance], [true, 'Renseigné par Open Library — vérifie et corrige.'], 'livre : pas 2, provenance étiquetée (I-A)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance: 'aucune' }).messages.provenance, 'Aucune fiche trouvée pour cet ISBN. Complète à la main.', 'livre : échec dit après la réponse (I-B)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance: null }).messages.provenance, null, 'livre : saisie à la main → aucune provenance');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: '   ' } }).peutEnregistrer, false, 'livre : sans titre, pas d’enregistrement');
    eq(LA.livreAjoutModel({ pas: 1, recherche: true }).messages.recherche, 'Recherche…', 'livre : pendant l’appel');
  }
  {
    let n = 0;
    const { book, edition } = LA.fabriquerLivre({ champs: { title: ' Titre ', author: 'A', publisher: '', year: '2019', language: 'fr', convention: 'metric_ca', cuisines: ['italienne'] }, isbn: '9782761950001', coverSha256: null }, { newId: (p) => `${p}-${++n}` });
    eq(book, { id: 'bk-1', title: 'Titre', author: 'A', cuisines: ['italienne'], tags: [] }, 'livre : book comme avant, cuisines en tableau');
    eq(edition, { id: 'ed-2', book_id: 'bk-1', isbn: '9782761950001', publisher: null, year: 2019, language: 'fr', unit_convention_id: 'metric_ca', convention_evidence: 'confirmed_by_user', owned: true, cover_sha256: null }, 'livre : edition comme avant + cover_sha256 (pointeur souple)');
  }
  {
    const { withRepo } = await import('./sync-fixture.js');
    await withRepo(async (repo, db) => {
      const edition = await LA.enregistrerLivre({ champs: { title: 'Propre\u0001', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] }, isbn: '', coverSha256: null }, { repo });
      const book = await db.get('books', edition.book_id);
      eq(book.title, 'Propre', 'livre : écrit par repo.saveBatch → R61 nettoie le caractère de contrôle (S2)');
      eq((await db.getAll('outbox')).map((o) => o.store).sort(), ['book_editions', 'books'], 'livre : une transaction, deux lignes en file');
    });
  }
  {
    const appels = [];
    const gestes = { changerIsbn: (v) => appels.push(['isbn', v]), scanner: () => appels.push(['scanner']), identifier: () => appels.push(['identifier']), saisirMain: () => appels.push(['main']), changerChamp: (k, v) => appels.push(['champ', k, v]), basculerCuisine: (v) => appels.push(['cuisine', v]), ajouterCuisine: (v) => appels.push(['ajout', v]), retourIsbn: () => appels.push(['retour']), enregistrer: () => appels.push(['enregistrer']) };
    const p1 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '', champs: {}, lecteurDisponible: false }), gestes);
    eq(p1.querySelector('p').textContent, 'Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.', 'livre : première ligne du pas 1 = le but');
    ok(p1.textContent.includes('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.'), 'livre : les tiers sont nommés (S12)');
    ok([...p1.querySelectorAll('button')].find((b) => b.textContent === 'Scanner le code-barres').disabled, 'livre : lecteur absent → bouton désactivé');
    [...p1.querySelectorAll('button')].find((b) => b.textContent === 'Saisir à la main').click();
    const p2 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 2, isbn: '978', champs: { title: 'T', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: ['italienne'] }, provenance: 'openlibrary' }), gestes);
    eq(p2.querySelectorAll('input[name="isbn"]').length, 0, 'livre : l’ISBN ne se modifie pas au pas 2 (F23)');
    ok(p2.querySelector('details') && p2.querySelector('details summary').textContent === 'Plus de détails', 'livre : éditeur/année/convention repliés');
    ok(p2.querySelectorAll('button.puce').length >= 1, 'livre : puces Cuisines au pas 2');
    ok([...p2.querySelectorAll('button, a')].some((b) => b.textContent === '← Changer d’ISBN'), 'livre : retour au pas 1 offert');
    eq(p2.querySelector('.zone-couverture'), null, 'livre : sans geste couverture (tâche 9), aucune zone couverture');
    [...p2.querySelectorAll('button')].find((b) => b.textContent === 'Ajouter ce livre').click();
    eq(appels, [['main'], ['enregistrer']], 'livre : les gestes sont appelés');
  }
```

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t4-rouge`).

- [ ] **Step 3 : écrire `src/ui/livre-ajout.js`**

```js
// « Ajouter un livre » en deux pas (spec UX § 5) : identifier (ISBN scanné, tapé, ou saisie à la main), puis compléter.
// Ce qui vient d'Open Library / Google Books est ÉTIQUETÉ et borné (I-A, I-G) ; l'écriture passe par repo.saveBatch (I-D).
import { el, toast, pickFiles } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate } from '../core/router.js';
import * as repo from '../model/repo.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, field, select } from './components.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';

export const LIMITES_ISBN = { champ: 300, corps: 256 * 1024, delaiMs: 10000 };
export const OPTIONS_FETCH = { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };
const CHAMPS_VIDES = () => ({ title: '', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] });

export const nettoyerIsbn = (s) => String(s || '').replace(/[^0-9Xx]/g, '');
const borner = (s) => (s == null ? '' : String(s).slice(0, LIMITES_ISBN.champ));
const annee = (s) => { const m = String(s || '').match(/\b(\d{4})\b/); return m ? parseInt(m[1], 10) : null; };

async function lireJson(fetchFn, url, signal) {
  const r = await fetchFn(url, { ...OPTIONS_FETCH, signal });
  if (!r.ok) return null;
  const texte = await r.text();
  if (texte.length > LIMITES_ISBN.corps) return null; // S3 : abandonné avant JSON.parse
  return JSON.parse(texte);
}

// Les deux appels sont dans un try : un échec réseau, un 404, un 429 ou le délai donnent { fiche: null, source: null }.
export async function lookupIsbn(isbn, { fetch = globalThis.fetch, signal } = {}) {
  try {
    const data = await lireJson(fetch, `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, signal);
    const b = data?.[`ISBN:${isbn}`];
    if (b) return { source: 'openlibrary', fiche: { title: borner(b.title), author: borner((b.authors || []).map((a) => a.name).join(', ')), publisher: borner((b.publishers || []).map((p) => p.name).join(', ')), year: annee(b.publish_date), language: null } };
  } catch { /* continuer */ }
  try {
    const gd = await lireJson(fetch, `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, signal);
    const v = gd?.items?.[0]?.volumeInfo;
    if (v) return { source: 'googlebooks', fiche: { title: borner(v.title), author: borner((v.authors || []).join(', ')), publisher: borner(v.publisher), year: annee(v.publishedDate), language: v.language === 'fr' || v.language === 'en' ? v.language : null } };
  } catch { /* continuer */ }
  return { fiche: null, source: null };
}

export function fusionnerFiche(champs, fiche) {
  const out = { ...champs };
  for (const k of ['title', 'author', 'publisher', 'language']) if (fiche?.[k] && !out[k]) out[k] = fiche[k];
  if (fiche?.year && !out.year) out.year = String(fiche.year);
  return out;
}

export function livreAjoutModel({ pas = 1, isbn = '', champs = {}, provenance = null, recherche = false, lecteurDisponible = true } = {}) {
  const c = { ...CHAMPS_VIDES(), ...champs };
  const provenanceMessage = provenance === 'openlibrary' ? t('Renseigné par Open Library — vérifie et corrige.')
    : provenance === 'googlebooks' ? t('Renseigné par Google Books — vérifie et corrige.')
    : provenance === 'aucune' ? t('Aucune fiche trouvée pour cet ISBN. Complète à la main.') : null;
  return { pas, isbn, champs: c, provenance, recherche, lecteurDisponible, peutEnregistrer: pas === 2 && !!c.title.trim() && !recherche,
    messages: { provenance: provenanceMessage, recherche: recherche ? t('Recherche…') : null, lecteur: lecteurDisponible ? null : t('Le lecteur de code-barres n’est pas offert dans ce navigateur.') } };
}

export function fabriquerLivre({ champs, isbn, coverSha256 = null }, { newId }) {
  const c = { ...CHAMPS_VIDES(), ...champs };
  const book = { id: newId('bk'), title: c.title.trim(), author: c.author.trim(), cuisines: [...c.cuisines], tags: [] };
  const edition = { id: newId('ed'), book_id: book.id, isbn: nettoyerIsbn(isbn) || null, publisher: c.publisher.trim() || null, year: c.year ? parseInt(c.year, 10) || null : null, language: c.language || null, unit_convention_id: c.convention || null, convention_evidence: c.convention ? 'confirmed_by_user' : null, owned: true, cover_sha256: coverSha256 || null };
  return { book, edition };
}

export async function enregistrerLivre(args, { repo: r = repo } = {}) {
  const { book, edition } = fabriquerLivre(args, { newId: r.newId });
  await r.saveBatch({ books: [book], book_editions: [edition] });
  return edition;
}

export function renderLivreAjout(model, gestes = {}) {
  const g = (nom) => (...a) => (typeof gestes[nom] === 'function' ? gestes[nom](...a) : undefined);
  if (model.pas === 1) {
    return el('section', { class: 'card stack livre-ajout' },
      el('p', null, t('Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.')),
      field(t('ISBN'), el('input', { type: 'text', name: 'isbn', inputmode: 'numeric', placeholder: '978…', value: model.isbn, onInput: (e) => g('changerIsbn')(e.target.value) })),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', disabled: !model.lecteurDisponible || model.recherche, onClick: g('scanner') }, t('Scanner le code-barres')),
        el('button', { type: 'button', class: 'btn primary', disabled: model.recherche, onClick: g('identifier') }, t('Identifier')),
        el('button', { type: 'button', class: 'btn link', onClick: g('saisirMain') }, t('Saisir à la main'))),
      model.messages.lecteur ? el('small', { class: 'muted' }, model.messages.lecteur) : null,
      model.messages.recherche ? el('div', { class: 'muted' }, model.messages.recherche) : null,
      model.messages.provenance ? el('div', { class: 'muted' }, model.messages.provenance) : null,
      el('small', { class: 'muted' }, t('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.')));
  }
  const c = model.champs;
  const inp = (k, type = 'text') => el('input', { type, value: c[k], onInput: (e) => g('changerChamp')(k, e.target.value) });
  const puces = renderPuces(pucesModel({ choisies: c.cuisines, existantes: model.existantes || [] }), { basculer: g('basculerCuisine'), ajouter: g('ajouterCuisine') });
  return el('section', { class: 'card stack livre-ajout' },
    el('p', null, t('Vérifie la fiche, puis ajoute le livre.')),
    model.messages.provenance ? el('div', { class: 'status info' }, model.messages.provenance) : null,
    model.isbn ? el('div', { class: 'row' }, el('span', { class: 'muted' }, `ISBN ${model.isbn}`), el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN'))) : el('button', { type: 'button', class: 'btn link', onClick: g('retourIsbn') }, t('← Changer d’ISBN')),
    field(t('Titre *'), inp('title')),
    field(t('Auteur / chef'), inp('author')),
    field(t('Langue du livre'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'other', label: t('Autre') }], c.language, (v) => g('changerChamp')('language', v))),
    field(t('Cuisines'), puces),
    typeof gestes.couverture === 'function' ? gestes.couverture() : null,
    el('details', null, el('summary', { class: 'btn' }, t('Plus de détails')),
      el('div', { class: 'two-col', style: { marginTop: '.8rem' } },
        field(t('Éditeur'), inp('publisher')), field(t('Année'), inp('year', 'number')),
        field(t('Convention de mesure (tasses, cuillères)'), select([{ value: '', label: t('Non confirmée — à préciser plus tard') }, ...listConventions().map((x) => ({ value: x.id, label: x.labels.fr }))], c.convention, (v) => g('changerChamp')('convention', v)),
          t('La langue du livre ne suffit pas à choisir une convention. Sans convention, les tasses restent affichées telles quelles.')))),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', disabled: !model.peutEnregistrer, onClick: g('enregistrer') }, t('Ajouter ce livre'))));
}

// La route : état + gestes réels, re-rendu complet à chaque changement (le formulaire est petit).
export async function renderLivreAjoutRoute(params, query, ctx) {
  const etat = { pas: 1, isbn: '', champs: CHAMPS_VIDES(), provenance: null, recherche: false, lecteurDisponible: 'BarcodeDetector' in window, existantes: cuisinesExistantes(ctx), couverture: null };
  const root = el('div', null, pageHeader(t('Ajouter un livre'), { back: { href: '/add', label: t('Ajouter') } }));
  const zone = el('div', null);
  root.append(zone);
  const dessiner = () => zone.replaceChildren(renderLivreAjout({ ...livreAjoutModel(etat), existantes: etat.existantes }, gestes));
  const identifier = async () => {
    const isbn = nettoyerIsbn(etat.isbn);
    if (!isbn) { toast(t('Saisis un ISBN d’abord.')); return; }
    etat.recherche = true; dessiner();
    const ctl = new AbortController();
    const chrono = setTimeout(() => ctl.abort(), LIMITES_ISBN.delaiMs);
    try {
      const { fiche, source } = await lookupIsbn(isbn, { signal: ctl.signal });
      etat.isbn = isbn; etat.champs = fusionnerFiche(etat.champs, fiche); etat.provenance = source || 'aucune'; etat.pas = 2;
    } finally { clearTimeout(chrono); etat.recherche = false; dessiner(); }
  };
  const gestes = {
    changerIsbn: (v) => { etat.isbn = v; },
    identifier,
    scanner: async () => {
      const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
      if (!files.length) return;
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
        const bmp = await createImageBitmap(files[0]);
        const code = (await detector.detect(bmp)).find((x) => /^97[89]\d{10}$/.test(x.rawValue));
        if (!code) { toast(t('Aucun ISBN lu sur cette photo.')); return; }
        etat.isbn = code.rawValue; await identifier();
      } catch { toast(t('Lecture du code-barres impossible.')); }
    },
    saisirMain: () => { etat.isbn = nettoyerIsbn(etat.isbn); etat.provenance = null; etat.pas = 2; dessiner(); },
    changerChamp: (k, v) => { etat.champs[k] = v; },
    basculerCuisine: (v) => { etat.champs.cuisines = basculerPuce(etat.champs.cuisines, v); dessiner(); },
    ajouterCuisine: (v) => { const apres = ajouterPuce(etat.champs.cuisines, v); if (apres !== etat.champs.cuisines) { etat.champs.cuisines = apres; dessiner(); } },
    retourIsbn: () => { etat.pas = 1; dessiner(); },
    enregistrer: async () => {
      if (!livreAjoutModel(etat).peutEnregistrer) return;
      const edition = await enregistrerLivre({ champs: etat.champs, isbn: etat.isbn, coverSha256: etat.couverture?.sha256 || null }, { repo });
      toast(t('Livre ajouté'));
      navigate(`/books/${edition.id}?nouveau=1`);
    },
  };
  dessiner();
  return root;
}
```

`src/app.js` : importer `renderLivreAjoutRoute` depuis `./ui/livre-ajout.js` et ajouter `route('/add/livre', renderLivreAjoutRoute);` juste avant `route('/add', renderAdd);`.

`en.js` : `'Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.': 'Scan the barcode, type the ISBN, or enter the book by hand.', 'Scanner le code-barres': 'Scan the barcode', 'Saisir à la main': 'Enter by hand'` (vérifier si existe), `'Le lecteur de code-barres n’est pas offert dans ce navigateur.': 'The barcode reader is not available in this browser.', 'L’ISBN est envoyé à Open Library, puis à Google Books si besoin.': 'The ISBN is sent to Open Library, then to Google Books if needed.', 'Renseigné par Open Library — vérifie et corrige.': 'Filled in by Open Library — check and correct.', 'Renseigné par Google Books — vérifie et corrige.': 'Filled in by Google Books — check and correct.', 'Aucune fiche trouvée pour cet ISBN. Complète à la main.': 'No record found for this ISBN. Fill it in by hand.', 'Recherche…': 'Searching…', 'Vérifie la fiche, puis ajoute le livre.': 'Check the record, then add the book.', '← Changer d’ISBN': '← Change ISBN', 'Cuisines': 'Cuisines', 'Plus de détails': 'More details', 'Aucun ISBN lu sur cette photo.': 'No ISBN read on this photo.', 'Lecture du code-barres impossible.': 'Could not read the barcode.', 'Saisis un ISBN d’abord.': 'Enter an ISBN first.'` — pour chaque clé déjà présente, ne rien doubler.

`sw.js` : `'./src/ui/livre-ajout.js'` dans `SHELL` ; `VERSION = 'cuisine-os-v0.4.0-4'`.

- [ ] **Step 4 : lancer — attendu vert** (`?v=t4-vert`). Dans l'app : `#/add/livre` → pas 1 s'affiche, « Saisir à la main » → pas 2, « ← Changer d'ISBN » revient ; **ne pas** cliquer « Identifier » avec un vrai ISBN pendant la suite (réseau réel : à faire une fois, à la main, en fin de tâche, et noter la réponse au rapport). Ne pas enregistrer de livre réel dans la base de Neegan.

- [ ] **Step 5 : vérifications et commit**

```bash
cd ~/projects/mistu && node --check src/ui/livre-ajout.js && node --check src/app.js && grep -c $'\xe2\x80[\xa8\xa9]' src/ui/livre-ajout.js
git add src/ui/livre-ajout.js src/app.js src/i18n/en.js sw.js tests/ajouter.js
git commit -m "Ajouter un livre en deux pas : identifier puis completer, provenance etiquetee, bornes S3 (spec UX section 5)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 5 : Accueil du livre après création et gestes nommés de la fiche (§ 8, § 9)

**Files:**
- Create: `src/ui/accueil-livre.js`
- Modify: `src/ui/book.js:11-28` (accueil, `recordActivity` sauté, en-tête), `:90-104` (puces « Cuisines » dans le bloc replié), `src/i18n/en.js`, `styles.css`, `sw.js`
- Test: `tests/ajouter.js`

**Interfaces:**
- Consumes: `startScanSession(files, { edition_id, intention })` (tâche 3), `carte` (tâche 2), `puces.js` (tâche 1), `remplacerAdresse` (tâche 3).
- Produces: `accueilLivreModel({ nouveau }) → { afficher, titre, cartes: [{ action: 'index' | 'recette' | 'plusTard', ico, titre, texte }] }` ; `ACCUEIL_ACTIONS = ['index', 'recette', 'plusTard']` ; `renderAccueilLivre(model, gestes)` avec gestes `{ photographier(intention), choisir(intention), plusTard(), fermer() }` — les cartes « index » et « recette » dévoilent deux boutons (Photographier / Choisir des photos ou un PDF) au toucher ; `seancesOuvertes(ctx, editionId) → scan_sessions[]` (pur, exporté de `book.js`) ; `menuSource(libelle, boutons)` (`<details>` + `summary.btn`) local à `book.js`.

- [ ] **Step 1 : tests rouges**

```js
  // --- § 8 Accueil du livre, § 9 fiche livre
  const { accueilLivreModel, ACCUEIL_ACTIONS, renderAccueilLivre } = await import('../src/ui/accueil-livre.js');
  const { seancesOuvertes } = await import('../src/ui/book.js');
  eq(ACCUEIL_ACTIONS, ['index', 'recette', 'plusTard'], 'accueil : trois gestes');
  eq(accueilLivreModel({ nouveau: undefined }).afficher, false, 'accueil : sans ?nouveau, rien');
  {
    const m = accueilLivreModel({ nouveau: '1' });
    eq([m.afficher, m.titre], [true, 'Le livre est dans ta bibliothèque. Et maintenant ?'], 'accueil : la première ligne dit où on est et pose la question');
    eq(m.cartes.map((c) => c.action), ACCUEIL_ACTIONS, 'accueil : les trois cartes dans l’ordre');
    eq(m.cartes[0].titre, 'Photographier l’index ou la table des matières', 'accueil : carte index');
    const appels = [];
    const noeud = renderAccueilLivre(m, { photographier: (i) => appels.push(['photo', i]), choisir: (i) => appels.push(['choisir', i]), plusTard: () => appels.push(['plusTard']), fermer: () => appels.push(['fermer']) });
    const cartes = [...noeud.querySelectorAll('button.carte')];
    eq(cartes.length, 3, 'accueil : trois cartes rendues');
    cartes[0].click();
    const sources = [...noeud.querySelectorAll('.sources button')].map((b) => b.textContent);
    eq(sources, ['Photographier', 'Choisir des photos ou un PDF'], 'accueil : toucher « index » dévoile les deux sources');
    [...noeud.querySelectorAll('.sources button')][1].click();
    cartes[2].click();
    noeud.querySelector('button.fermer').click();
    eq(appels, [['choisir', 'index'], ['plusTard'], ['fermer']], 'accueil : l’intention suit la carte touchée, « Plus tard » et « × » appellent leurs gestes');
    ok(!renderAccueilLivre(accueilLivreModel({}), {}).hasChildNodes(), 'accueil : modèle fermé → nœud vide');
  }
  eq(seancesOuvertes({ scan_sessions: [{ id: 's1', status: 'open', edition_id: 'e1', page_ids: ['a'] }, { id: 's2', status: 'done', edition_id: 'e1', page_ids: [] }, { id: 's3', status: 'open', edition_id: 'e2', page_ids: [] }] }, 'e1').map((s) => s.id), ['s1'], 'fiche : séances ouvertes de CETTE édition seulement');
```

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t5-rouge`).

- [ ] **Step 3 : écrire `src/ui/accueil-livre.js`**

```js
// Accueil d'un livre qui vient d'être créé (spec UX § 8) : pas de modale, un panneau au-dessus de la fiche, tenu par
// ?nouveau=1 — « × » le retire du DOM et le geste `fermer` retire le paramètre de l'adresse sans re-rendu (F19).
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { carte } from './components.js';

export const ACCUEIL_ACTIONS = ['index', 'recette', 'plusTard'];

export function accueilLivreModel({ nouveau = undefined } = {}) {
  const afficher = nouveau !== undefined && nouveau !== null && nouveau !== '';
  return { afficher, titre: t('Le livre est dans ta bibliothèque. Et maintenant ?'), cartes: afficher ? [
    { action: 'index', ico: '📸', titre: t('Photographier l’index ou la table des matières'), texte: t('Pour que l’app connaisse les recettes du livre.') },
    { action: 'recette', ico: '📄', titre: t('Photographier ou importer des pages de recettes'), texte: t('Seulement celles qui t’intéressent, tout de suite.') },
    { action: 'plusTard', ico: '🕒', titre: t('Plus tard'), texte: t('Aller à Mes livres.') },
  ] : [] };
}

export function renderAccueilLivre(model, gestes = {}) {
  const root = el('div', null);
  if (!model.afficher) return root;
  const sources = el('div', { class: 'row sources' });
  const devoiler = (intention) => sources.replaceChildren(
    el('button', { type: 'button', class: 'btn primary', onClick: () => gestes.photographier && gestes.photographier(intention) }, t('Photographier')),
    el('button', { type: 'button', class: 'btn', onClick: () => gestes.choisir && gestes.choisir(intention) }, t('Choisir des photos ou un PDF')));
  const panneau = el('section', { class: 'card accueil-livre stack' },
    el('div', { class: 'row between top' }, el('h2', null, model.titre),
      el('button', { type: 'button', class: 'btn small fermer', 'aria-label': t('Fermer'), onClick: () => { panneau.remove(); gestes.fermer && gestes.fermer(); } }, '×')),
    el('div', { class: 'grid wide' }, ...model.cartes.map((c) => carte(c.ico, c.titre, c.texte, () => (c.action === 'plusTard' ? gestes.plusTard && gestes.plusTard() : devoiler(c.action))))),
    sources);
  root.append(panneau);
  return root;
}
```

- [ ] **Step 4 : `book.js`**

Imports : ajouter `remplacerAdresse` à l'import du routeur ; `libelleLivre` à `components.js` ; `import { accueilLivreModel, renderAccueilLivre } from './accueil-livre.js';` ; `import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';` ; `ACCEPT_PHOTOS, ACCEPT_FICHIERS` depuis `./add.js`.

Ajouter, hors de `renderBook` :

```js
export const seancesOuvertes = (ctx, editionId) => (ctx.scan_sessions || []).filter((s) => s.status === 'open' && s.edition_id === editionId);

// « + Pages d'index » / « + Recette » : un <details> dont le résumé est le bouton, les sources dessous (spec § 9).
function menuSource(libelle, ...boutons) {
  return el('details', { class: 'menu-source' }, el('summary', { class: 'btn primary' }, libelle), el('div', { class: 'row', style: { marginTop: '.5rem' } }, ...boutons));
}
```

Dans `renderBook` :
- remplacer `await repo.recordActivity(edition.id, 'open_book');` par `if (query.nouveau === undefined) await repo.recordActivity(edition.id, 'open_book'); // S16 : l'arrivée après création n'est pas une ouverture volontaire`
- définir `const lancer = (intention) => async (accept, capture) => { const f = await pickFiles({ accept, multiple: true, capture }); if (f.length) startScanSession(f, { edition_id: edition.id, intention }); };` puis `actions:` devient :

```js
    actions: [
      menuSource(t('+ Pages d’index'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF'))),
      menuSource(t('+ Recette'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF')),
        el('a', { class: 'btn', href: `#/recipes/new?edition=${edition.id}` }, t('Saisir à la main'))),
    ],
```
- juste après `root.append(pageHeader(…));` :

```js
  root.append(renderAccueilLivre(accueilLivreModel({ nouveau: query.nouveau }), {
    photographier: (intention) => lancer(intention)(ACCEPT_PHOTOS, 'environment'),
    choisir: (intention) => lancer(intention)(ACCEPT_FICHIERS, null),
    plusTard: () => navigate('/library'),
    fermer: () => remplacerAdresse(`#/books/${edition.id}`),
  }));
  const ouvertes = seancesOuvertes(ctx, edition.id);
  if (ouvertes.length) root.append(el('div', { class: 'card flat row between' },
    el('span', null, t('Séance en cours : {n} page(s)', { n: ouvertes[0].page_ids.length })),
    el('a', { class: 'btn small', href: `#/import?session=${ouvertes[0].id}` }, t('Reprendre'))));
```
- bloc « Métadonnées et convention » : `cuisines: (book.cuisines || []).join(', ')` devient `cuisines: [...(book.cuisines || [])]` ; remplacer `field(t('Cuisines'), inp('cuisines'))` par un conteneur re-rendu :

```js
      field(t('Cuisines'), (() => { const box = el('div', null); const dessiner = () => box.replaceChildren(renderPuces(pucesModel({ choisies: meta.cuisines, existantes: cuisinesExistantes(ctx) }), { basculer: (v) => { meta.cuisines = basculerPuce(meta.cuisines, v); dessiner(); }, ajouter: (v) => { const a = ajouterPuce(meta.cuisines, v); if (a !== meta.cuisines) { meta.cuisines = a; dessiner(); } } })); dessiner(); return box; })()),
```
et dans « Enregistrer » : `cuisines: meta.cuisines.split(',')…` devient `cuisines: [...meta.cuisines]`.

`styles.css` : `.accueil-livre { border: 1px solid var(--sage); } .menu-source summary { list-style: none; display: inline-flex; } .menu-source summary::-webkit-details-marker { display: none; }`.

`en.js` : `'Le livre est dans ta bibliothèque. Et maintenant ?': 'The book is in your library. What now?', 'Photographier l’index ou la table des matières': 'Photograph the index or table of contents', 'Pour que l’app connaisse les recettes du livre.': 'So the app knows the book’s recipes.', 'Photographier ou importer des pages de recettes': 'Photograph or import recipe pages', 'Seulement celles qui t’intéressent, tout de suite.': 'Only the ones you care about, right now.', 'Plus tard': 'Later', 'Aller à Mes livres.': 'Go to My books.', 'Fermer': 'Close', '+ Pages d’index': '+ Index pages', '+ Recette': '+ Recipe', 'Séance en cours : {n} page(s)': 'Session in progress: {n} page(s)', 'Reprendre': 'Resume'` (vérifier les doublons).

`sw.js` : `'./src/ui/accueil-livre.js'` dans `SHELL` ; `VERSION = 'cuisine-os-v0.4.0-5'`.

- [ ] **Step 5 : lancer — attendu vert** (`?v=t5-vert`). Dans l'app : ouvrir une fiche livre existante (`#/library` → un livre) : deux menus en en-tête, aucune erreur ; ajouter `?nouveau=1` à l'adresse → le panneau s'affiche, « × » le retire et l'adresse perd le paramètre. Ne rien enregistrer.

- [ ] **Step 6 : vérifications et commit**

```bash
cd ~/projects/mistu && node --check src/ui/accueil-livre.js && node --check src/ui/book.js && grep -c $'\xe2\x80[\xa8\xa9]' src/ui/accueil-livre.js src/ui/book.js
git add src/ui/accueil-livre.js src/ui/book.js src/i18n/en.js styles.css sw.js tests/ajouter.js
git commit -m "Fiche livre : accueil apres creation, gestes + Pages d index / + Recette, seance en cours, puces (spec UX sections 8 et 9)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 : Puces « Cuisines » dans l'éditeur de recette (§ 7)

**Files:**
- Modify: `src/ui/recipe-edit.js:38` (`f.cuisines` devient un tableau), `:167` (champ), `:210` (lecture), `sw.js`
- Test: `tests/ajouter.js`

**Interfaces:**
- Produces: `cuisinesDepuis(f) → string[]` exporté de `recipe-edit.js` (pur : rend `[...f.cuisines]` si tableau, sinon découpe l'ancienne chaîne CSV — pour que le reste de la fonction `save()` n'ait qu'un seul chemin).

- [ ] **Step 1 : tests rouges**

```js
  // --- § 7 Éditeur de recette : même geste pour les cuisines
  const { cuisinesDepuis } = await import('../src/ui/recipe-edit.js');
  eq(cuisinesDepuis({ cuisines: ['italienne', 'thaïe'] }), ['italienne', 'thaïe'], 'éditeur : un tableau est repris tel quel');
  eq(cuisinesDepuis({ cuisines: ' italienne , Thaïe ,' }), ['italienne', 'thaïe'], 'éditeur : une ancienne chaîne CSV est découpée, en minuscules');
  eq(cuisinesDepuis({}), [], 'éditeur : rien → tableau vide');
  {
    const src = await (await fetch('../src/ui/recipe-edit.js?v=' + Date.now(), { cache: 'no-store' })).text();
    ok(!/Cuisines \/ régions'\), el\('input'/.test(src), 'éditeur : le champ texte « Cuisines / régions » a disparu');
    ok(/renderPuces\(/.test(src), 'éditeur : les puces sont rendues');
  }
```

(Le test statique est assumé : `renderRecipeEdit` exige `ctx` complet et une séance ; le comportement du tableau est prouvé par `cuisinesDepuis`, celui des puces par la tâche 1.)

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t6-rouge`).

- [ ] **Step 3 : `recipe-edit.js`**

Import : `import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';`. Ajouter, hors de la fonction de rendu :

```js
export const cuisinesDepuis = (f) => Array.isArray(f?.cuisines) ? [...f.cuisines] : String(f?.cuisines || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
```

Ligne 38 : `cuisines: (recipe?.cuisines || []).join(', ')` → `cuisines: [...(recipe?.cuisines || [])]`.
Ligne 167 : remplacer le `field(t('Cuisines / régions'), el('input', …))` par :

```js
      field(t('Cuisines / régions'), (() => { const box = el('div', null); const dessiner = () => box.replaceChildren(renderPuces(pucesModel({ choisies: f.cuisines, existantes: cuisinesExistantes(ctx) }), { basculer: (v) => { f.cuisines = basculerPuce(f.cuisines, v); dessiner(); }, ajouter: (v) => { const a = ajouterPuce(f.cuisines, v); if (a !== f.cuisines) { f.cuisines = a; dessiner(); } } })); dessiner(); return box; })()),
```

Ligne 210 : `cuisines: f.cuisines.split(',').map((s) => s.trim()).filter(Boolean)` → `cuisines: cuisinesDepuis(f)`.

`sw.js` : `VERSION = 'cuisine-os-v0.4.0-6'`.

- [ ] **Step 4 : lancer — attendu vert** (`?v=t6-vert`). Dans l'app : `#/recipes/new` → les puces s'affichent sous « Cuisines / régions », aucune erreur ; ne rien enregistrer.

- [ ] **Step 5 : vérifications et commit**

```bash
cd ~/projects/mistu && node --check src/ui/recipe-edit.js && grep -c $'\xe2\x80[\xa8\xa9]' src/ui/recipe-edit.js
git add src/ui/recipe-edit.js sw.js tests/ajouter.js
git commit -m "Editeur de recette : cuisines en puces, meme geste que le livre (spec UX section 7)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 7 : Signet web — `src/ui/signet.js`, route `#/add/signet`, vue recette, recherche (§ 11) — tranche 2

**Files:**
- Create: `src/ui/signet.js`
- Modify: `src/app.js` (route), `src/ui/recipe.js:204-214` (branche signet), `src/ui/components.js:27-31` (pastille « Lien web »), `src/domain/search.js:125` (cuisines des références), `src/i18n/en.js`, `sw.js`
- Test: `tests/ajouter.js`

**Interfaces:**
- Consumes: `puces.js`, `libelleLivre`, `repo.save`, `repo.newId`, `getUiLocale` (`src/core/i18n.js`).
- Produces: `LIMITES_SIGNET = { adresse: 2048, titre: 300 }` ; `lienSignet(sourceUrl) → { ok: boolean, href: string | null, hote: string | null }` (revalidation **au rendu** : `http:`/`https:` seulement, `hote = url.host`) ; `signetModel({ adresse, titre, editionId, cuisines }) → { valide, erreurs: { adresse?: string, titre?: string }, href, hote, titre, editionId, cuisines }` ; `fabriquerSignet(etatValide, { newId, langue }) → recipes` ; `enregistrerSignet(etat, { repo, langue }) → Promise<recipes>` (revalide, lève `Error('signet_invalide')` sinon) ; `renderSignet(model, gestes)` (gestes `{ changerAdresse, changerTitre, changerLivre, basculerCuisine, ajouterCuisine, enregistrer }`) ; `renderSignetRoute(params, query, ctx)`.

- [ ] **Step 1 : tests rouges**

```js
  // --- § 11 Signet web
  const S = await import('../src/ui/signet.js');
  eq(S.LIMITES_SIGNET, { adresse: 2048, titre: 300 }, 'signet : bornes (S13)');
  eq(S.lienSignet('https://ricardocuisine.com/recettes/1'), { ok: true, href: 'https://ricardocuisine.com/recettes/1', hote: 'ricardocuisine.com' }, 'signet : lien https accepté, hôte recalculé');
  eq(S.lienSignet('http://user:pw@exemple.test/x'), { ok: true, href: 'http://user:pw@exemple.test/x', hote: 'exemple.test' }, 'signet : userinfo hors de l’hôte affiché');
  for (const mauvais of ['javascript:alert(1)', 'data:text/html,x', 'blob:https://x/y', 'ftp://x.test/f', 'file:///etc/passwd', 'ricardocuisine.com/recettes', '', null])
    eq(S.lienSignet(mauvais).ok, false, `signet : refusé au rendu — ${JSON.stringify(mauvais)}`);
  eq(S.lienSignet('https://xn--caf-dma.test/').hote, 'xn--caf-dma.test', 'signet : hôte IDN en punycode (jamais trompeur)');
  {
    const bon = S.signetModel({ adresse: ' https://exemple.test/r?x=1 ', titre: ' Pâtes ', editionId: '', cuisines: ['italienne'] });
    eq([bon.valide, bon.href, bon.hote, bon.titre, bon.erreurs], [true, 'https://exemple.test/r?x=1', 'exemple.test', 'Pâtes', {}], 'signet : modèle valide, adresse normalisée par URL, titre taillé');
    eq(S.signetModel({ adresse: 'javascript:x', titre: 'T' }).erreurs.adresse, 'Adresse non reconnue.', 'signet : schéma refusé à la saisie');
    eq(S.signetModel({ adresse: 'https://a.test/' + 'x'.repeat(2048), titre: 'T' }).erreurs.adresse, 'Adresse trop longue.', 'signet : > 2 048 refusé dans le modèle');
    eq(S.signetModel({ adresse: 'https://a.test/', titre: '  ' }).erreurs.titre, 'Donne un titre au lien.', 'signet : titre requis');
    eq(S.signetModel({ adresse: 'https://a.test/', titre: 'x'.repeat(301) }).erreurs.titre, 'Titre trop long.', 'signet : titre > 300 refusé');
    eq(S.signetModel({ adresse: 'https://a.test/', titre: 'T' }).valide, true, 'signet : adresse + titre suffisent');
  }
  {
    const rec = S.fabriquerSignet(S.signetModel({ adresse: 'https://a.test/p', titre: 'T', editionId: 'e1', cuisines: ['thaïe'] }), { newId: () => 'rc-1', langue: 'fr' });
    eq(rec, { id: 'rc-1', edition_id: 'e1', original_title: 'T', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null, tags: [], cuisines: ['thaïe'], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: 'https://a.test/p', source_label: 'a.test' }, 'signet : une recette-référence, aucune version (I-E)');
    const { withRepo } = await import('./sync-fixture.js');
    await withRepo(async (repo, db) => {
      const avant = await db.count('recipe_versions');
      const r = await S.enregistrerSignet({ adresse: 'https://a.test/p', titre: 'T', editionId: '', cuisines: [] }, { repo, langue: 'fr' });
      eq([(await db.get('recipes', r.id))?.source_url, await db.count('recipe_versions')], ['https://a.test/p', avant], 'signet : écrit par repo.save, aucune version créée');
      let refuse = false;
      try { await S.enregistrerSignet({ adresse: 'javascript:alert(1)', titre: 'T' }, { repo, langue: 'fr' }); } catch (e) { refuse = e.message === 'signet_invalide'; }
      eq([refuse, (await db.getAll('recipes')).filter((x) => String(x.source_url || '').startsWith('javascript')).length], [true, 0], 'signet : une adresse hostile est refusée à l’ÉCRITURE aussi (S13), rien n’est écrit');
    });
  }
  {
    const appels = [];
    const m = S.signetModel({ adresse: 'https://a.test/', titre: 'T', editionId: '', cuisines: [] });
    const noeud = S.renderSignet({ ...m, livres: [{ value: '', label: 'Aucun — recette indépendante' }, { value: 'e1', label: 'B · x' }] }, { changerAdresse: (v) => appels.push(['adresse', v]), changerTitre: (v) => appels.push(['titre', v]), changerLivre: (v) => appels.push(['livre', v]), basculerCuisine: () => {}, ajouterCuisine: () => {}, enregistrer: () => appels.push(['enregistrer']) });
    ok(noeud.textContent.includes('L’app n’ouvre pas la page : donne-lui le titre.'), 'signet : l’écran dit qu’aucune page n’est lue');
    const bouton = [...noeud.querySelectorAll('button')].find((b) => b.textContent === 'Garder le lien');
    eq(bouton.disabled, false, 'signet : modèle valide → bouton actif');
    bouton.click();
    eq(appels, [['enregistrer']], 'signet : le geste d’enregistrement');
    const invalide = S.renderSignet({ ...S.signetModel({ adresse: 'x', titre: '' }), livres: [] }, {});
    ok([...invalide.querySelectorAll('button')].find((b) => b.textContent === 'Garder le lien').disabled, 'signet : modèle invalide → bouton désactivé');
    ok(invalide.textContent.includes('Adresse non reconnue.'), 'signet : l’erreur est affichée');
  }
  {
    // Vue recette : pastille et branche « Lien web gardé » (F8, S6, S7)
    const { availabilityBadge } = await import('../src/ui/components.js');
    eq(availabilityBadge({ availability: 'reference_only', source_url: 'https://a.test/' }).textContent, 'Lien web', 'pastille : un signet n’est pas « Repérée dans ton livre »');
    eq(availabilityBadge({ availability: 'reference_only', printed_page: 12 }).textContent, 'Repérée dans ton livre — page 12', 'pastille : les références d’index inchangées');
    const { blocSignet } = await import('../src/ui/recipe.js');
    const sain = blocSignet({ source_url: 'https://a.test/x', source_label: 'ment.test' });
    const a = sain.querySelector('a');
    eq([a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel'), a.textContent], ['https://a.test/x', '_blank', 'noopener noreferrer', 'Ouvrir le lien'], 'signet : lien revalidé au rendu, noopener noreferrer');
    ok(sain.textContent.includes('a.test') && !sain.textContent.includes('ment.test'), 'signet : l’hôte affiché vient de l’adresse, jamais du libellé stocké (S7)');
    ok(sain.textContent.includes('Lien web gardé.') && !sain.textContent.includes('Scanner cette recette'), 'signet : texte propre, aucun geste de scan');
    const hostile = blocSignet({ source_url: 'javascript:alert(1)' });
    eq([hostile.querySelectorAll('a').length, hostile.textContent.includes('javascript:alert(1)')], [0, true], 'signet : adresse hostile en base → aucun <a>, texte inerte (S6)');
  }
  {
    const { buildDocs, searchDocs, parseQuery } = await import('../src/domain/search.js');
    const docs = buildDocs({ recipes: [{ id: 'r1', original_title: 'Pad', availability: 'reference_only', cuisines: ['thaïe'], source_url: 'https://a.test/' }], versions: [], editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
    eq(searchDocs(docs, parseQuery('thaïe'), { mode: 'all' }).references.map((r) => r.doc.recipe.id), ['r1'], 'recherche : un signet se trouve par une cuisine (F7)');
  }
```

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t7-rouge`).

- [ ] **Step 3 : écrire `src/ui/signet.js`**

```js
// Signet web (spec UX § 11) : adresse + titre → une recette-référence qui s'ouvre sur le lien. Aucun réseau. L'adresse
// est validée dans le modèle ET à l'écriture (S13) ; au rendu, recipe.js la revalide encore (S6) — ce module fournit lienSignet.
import { el, toast } from '../core/dom.js';
import { t, getUiLocale } from '../core/i18n.js';
import { navigate } from '../core/router.js';
import * as repo from '../model/repo.js';
import { pageHeader, field, select, libelleLivre } from './components.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';

export const LIMITES_SIGNET = { adresse: 2048, titre: 300 };

export function lienSignet(sourceUrl) {
  try {
    const u = new URL(String(sourceUrl ?? ''));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, href: null, hote: null };
    return { ok: true, href: u.href, hote: u.host };
  } catch { return { ok: false, href: null, hote: null }; }
}

export function signetModel({ adresse = '', titre = '', editionId = '', cuisines = [] } = {}) {
  const erreurs = {};
  const lien = lienSignet(String(adresse).trim());
  if (!lien.ok) erreurs.adresse = t('Adresse non reconnue.');
  else if (lien.href.length > LIMITES_SIGNET.adresse) erreurs.adresse = t('Adresse trop longue.');
  const titreNet = String(titre ?? '').trim();
  if (!titreNet) erreurs.titre = t('Donne un titre au lien.');
  else if (titreNet.length > LIMITES_SIGNET.titre) erreurs.titre = t('Titre trop long.');
  return { valide: Object.keys(erreurs).length === 0, erreurs, href: erreurs.adresse ? null : lien.href, hote: erreurs.adresse ? null : lien.hote, titre: titreNet, editionId: editionId || '', cuisines: [...cuisines] };
}

export function fabriquerSignet(m, { newId, langue }) {
  return { id: newId('rc'), edition_id: m.editionId || null, original_title: m.titre, original_language: langue, availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null, tags: [], cuisines: [...m.cuisines], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: m.href, source_label: m.hote };
}

export async function enregistrerSignet(etat, { repo: r = repo, langue = getUiLocale() } = {}) {
  const m = signetModel(etat);
  if (!m.valide) throw new Error('signet_invalide');
  return r.save('recipes', fabriquerSignet(m, { newId: r.newId, langue }));
}

export function renderSignet(model, gestes = {}) {
  const g = (nom) => (...a) => (typeof gestes[nom] === 'function' ? gestes[nom](...a) : undefined);
  return el('section', { class: 'card stack signet' },
    el('p', null, t('Une recette ou une page que tu veux retrouver dans ta bibliothèque.')),
    el('small', { class: 'muted' }, t('L’app n’ouvre pas la page : donne-lui le titre.')),
    field(t('Adresse *'), el('input', { type: 'url', inputmode: 'url', value: model.adresse ?? model.href ?? '', onInput: (e) => g('changerAdresse')(e.target.value) }), model.erreurs.adresse || null),
    field(t('Titre *'), el('input', { type: 'text', value: model.titre, onInput: (e) => g('changerTitre')(e.target.value) }), model.erreurs.titre || null),
    field(t('Livre (facultatif)'), select(model.livres || [{ value: '', label: t('Aucun — recette indépendante') }], model.editionId, (v) => g('changerLivre')(v))),
    field(t('Cuisines'), renderPuces(pucesModel({ choisies: model.cuisines, existantes: model.existantes || [] }), { basculer: g('basculerCuisine'), ajouter: g('ajouterCuisine') })),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', disabled: !model.valide, onClick: g('enregistrer') }, t('Garder le lien'))));
}

export async function renderSignetRoute(params, query, ctx) {
  const etat = { adresse: '', titre: '', editionId: '', cuisines: [] };
  const livres = [{ value: '', label: t('Aucun — recette indépendante') }, ...ctx.book_editions.map((e) => ({ value: e.id, label: libelleLivre(e, ctx.booksById.get(e.book_id)) }))];
  const existantes = cuisinesExistantes(ctx);
  const root = el('div', null, pageHeader(t('Garder un lien web'), { back: { href: '/add', label: t('Ajouter') } }));
  const zone = el('div', null);
  root.append(zone);
  const dessiner = () => zone.replaceChildren(renderSignet({ ...signetModel(etat), adresse: etat.adresse, livres, existantes }, gestes));
  const gestes = {
    changerAdresse: (v) => { etat.adresse = v; const m = signetModel(etat); zone.querySelector('button.primary').disabled = !m.valide; },
    changerTitre: (v) => { etat.titre = v; zone.querySelector('button.primary').disabled = !signetModel(etat).valide; },
    changerLivre: (v) => { etat.editionId = v; },
    basculerCuisine: (v) => { etat.cuisines = basculerPuce(etat.cuisines, v); dessiner(); },
    ajouterCuisine: (v) => { const a = ajouterPuce(etat.cuisines, v); if (a !== etat.cuisines) { etat.cuisines = a; dessiner(); } },
    enregistrer: async () => {
      const m = signetModel(etat);
      if (!m.valide) { dessiner(); return; }
      const rec = await enregistrerSignet(etat, { repo });
      toast(t('Lien gardé'));
      navigate(`/recipes/${rec.id}`);
    },
  };
  dessiner();
  return root;
}
```

- [ ] **Step 4 : `recipe.js`, `components.js`, `search.js`, `app.js`**

`recipe.js` : importer `lienSignet` depuis `./signet.js`. Ajouter, **hors** de `renderRecipe` (exporté, pur) :

```js
// Signet web (spec § 11) : revalidé AU RENDU — une fiche venue d'une archive peut porter n'importe quoi (S6) ; l'hôte
// affiché vient de l'adresse, jamais de source_label (S7). Aucun geste de scan : ce n'est pas une référence d'index (F8).
export function blocSignet(recipe) {
  const lien = lienSignet(recipe.source_url);
  return el('div', { class: 'card warn stack' },
    el('h2', null, t('Lien web gardé.')),
    el('p', null, t('L’app n’a pas lu la page : ouvre-la pour cuisiner.')),
    lien.ok
      ? el('div', { class: 'row' }, el('a', { class: 'btn primary', href: lien.href, target: '_blank', rel: 'noopener noreferrer' }, t('Ouvrir le lien')), el('span', { class: 'muted' }, lien.hote))
      : el('p', { class: 'muted' }, t('Adresse non reconnue : '), String(recipe.source_url ?? '')));
}
```

Dans `referenceOnly()` (ligne 204), première ligne : `if (recipe.source_url) return el('div', null, blocSignet(recipe));`.

`components.js`, `availabilityBadge` : avant le calcul de `text`, `if (recipe.availability === 'reference_only' && recipe.source_url) return el('span', { class: 'badge reference' }, t('Lien web'));`.

`search.js:125` : `const titleTokens = new Set(tokenize(`${recipe.original_title || ''} ${recipe.display_title || ''} ${tr?.translated_content?.title || ''} ${recipe.availability === 'reference_only' ? (recipe.cuisines || []).join(' ') : ''}`));` (les références d'index ont `cuisines: []` : aucun effet sur elles).

`app.js` : `import { renderSignetRoute } from './ui/signet.js';` et `route('/add/signet', renderSignetRoute);` avant `route('/add', renderAdd);`.

`en.js` : `'Adresse non reconnue.': 'Address not recognized.', 'Adresse trop longue.': 'Address too long.', 'Donne un titre au lien.': 'Give the link a title.', 'Titre trop long.': 'Title too long.', 'Une recette ou une page que tu veux retrouver dans ta bibliothèque.': 'A recipe or a page you want to find again in your library.', 'L’app n’ouvre pas la page : donne-lui le titre.': 'The app does not open the page: give it the title.', 'Adresse *': 'Address *', 'Livre (facultatif)': 'Book (optional)', 'Aucun — recette indépendante': 'None — standalone recipe', 'Garder le lien': 'Keep the link', 'Lien gardé': 'Link kept', 'Lien web gardé.': 'Web link kept.', 'L’app n’a pas lu la page : ouvre-la pour cuisiner.': 'The app has not read the page: open it to cook.', 'Ouvrir le lien': 'Open the link', 'Adresse non reconnue : ': 'Address not recognized: ', 'Lien web': 'Web link'`.

`sw.js` : `'./src/ui/signet.js'` dans `SHELL` ; `VERSION = 'cuisine-os-v0.4.0-7'`.

- [ ] **Step 5 : lancer — attendu vert** (`?v=t7-vert`). Dans l'app : `#/add/signet` s'affiche ; taper une adresse invalide → erreur affichée, bouton désactivé ; ne rien enregistrer.

- [ ] **Step 6 : vérifications et commit**

```bash
cd ~/projects/mistu && for f in src/ui/signet.js src/ui/recipe.js src/ui/components.js src/domain/search.js src/app.js; do node --check $f && grep -c $'\xe2\x80[\xa8\xa9]' $f; done
git add src/ui/signet.js src/ui/recipe.js src/ui/components.js src/domain/search.js src/app.js src/i18n/en.js sw.js tests/ajouter.js
git commit -m "Signet web : adresse + titre en recette-reference, lien revalide au rendu, pastille Lien web, recherche par cuisine (spec UX section 11)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 8 : Images — `dimensionsImage`, `reduireImage`, bornes (§ 6, I-G) — tranche 3

**Files:**
- Create: `src/core/image.js`
- Modify: `src/sync/mime.js` (`COVER_INPUT_MIME`), `sw.js`
- Test: `tests/ajouter.js`

**Interfaces:**
- Produces: `LIMITES_COUVERTURE = { octetsDistants: 5 * 1024 * 1024, octetsLocaux: 25 * 1024 * 1024, pixels: 50_000_000, maxCote: 1200, qualite: 0.85 }` ; `dimensionsImage(blob) → Promise<{ largeur, hauteur, type } | null>` (lecture d'en-tête JPEG/PNG/WebP, aucun décodage) ; `reduireImage(blob, { maxCote, qualite }) → Promise<Blob image/jpeg>` (TOUJOURS ré-encodé ; lève `ErreurImage` code `indecodable`) ; `class ErreurImage extends Error { code }` ; `mime.COVER_INPUT_MIME = ['image/jpeg', 'image/png', 'image/webp']`.

- [ ] **Step 1 : tests rouges**

```js
  // --- § 6 Images : en-têtes lus avant tout décodage, ré-encodage systématique (S4, S5, F11)
  const IM = await import('../src/core/image.js');
  const { COVER_INPUT_MIME } = await import('../src/sync/mime.js');
  eq(COVER_INPUT_MIME, ['image/jpeg', 'image/png', 'image/webp'], 'image : types admis pour une couverture reçue du réseau (F20)');
  eq(IM.LIMITES_COUVERTURE, { octetsDistants: 5242880, octetsLocaux: 26214400, pixels: 50000000, maxCote: 1200, qualite: 0.85 }, 'image : bornes de la spec');
  // En-têtes fabriqués à la main : aucun décodeur n'est appelé.
  const u8 = (...a) => new Uint8Array(a);
  const png = (w, h) => new Blob([u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255, h >>> 24, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, 8, 2, 0, 0, 0)], { type: 'image/png' });
  const jpeg = (w, h) => new Blob([u8(0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1)], { type: 'image/jpeg' });
  const webpVp8x = (w, h) => { const W = w - 1, H = h - 1; return new Blob([u8(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0, W & 255, (W >> 8) & 255, (W >> 16) & 255, H & 255, (H >> 8) & 255, (H >> 16) & 255)], { type: 'image/webp' }); };
  eq(await IM.dimensionsImage(png(640, 480)), { largeur: 640, hauteur: 480, type: 'image/png' }, 'image : IHDR PNG');
  eq(await IM.dimensionsImage(jpeg(1200, 800)), { largeur: 1200, hauteur: 800, type: 'image/jpeg' }, 'image : SOF0 JPEG après un segment APP0');
  eq(await IM.dimensionsImage(webpVp8x(300, 200)), { largeur: 300, hauteur: 200, type: 'image/webp' }, 'image : VP8X WebP');
  eq(await IM.dimensionsImage(png(20000, 20000)), { largeur: 20000, hauteur: 20000, type: 'image/png' }, 'image : un PNG 20 000 × 20 000 est MESURÉ sans être décodé (S4)');
  eq(await IM.dimensionsImage(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })), null, 'image : en-tête inconnu → null');
  eq(await IM.dimensionsImage(new Blob([u8(0xff, 0xd8, 0xff)], { type: 'image/jpeg' })), null, 'image : JPEG tronqué → null, pas d’exception');
  {
    // Vraie image générée au canvas : 2 000 px de large → JPEG ≤ 1 200 ; une petite image est ré-encodée QUAND MÊME.
    const canvas = document.createElement('canvas'); canvas.width = 2000; canvas.height = 1000;
    const c2 = canvas.getContext('2d'); c2.fillStyle = '#4a7'; c2.fillRect(0, 0, 2000, 1000); c2.fillStyle = '#fff'; c2.fillRect(100, 100, 600, 300);
    const grand = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const reduit = await IM.reduireImage(grand, { maxCote: 1200, qualite: 0.85 });
    const dims = await IM.dimensionsImage(reduit);
    eq([reduit.type, dims.largeur, dims.hauteur], ['image/jpeg', 1200, 600], 'image : réduit au grand côté 1 200, proportions gardées, JPEG');
    const petit = document.createElement('canvas'); petit.width = 40; petit.height = 30;
    petit.getContext('2d').fillRect(0, 0, 40, 30);
    const petitPng = await new Promise((r) => petit.toBlob(r, 'image/png'));
    const petitReduit = await IM.reduireImage(petitPng);
    eq([petitReduit.type, (await IM.dimensionsImage(petitReduit)).largeur], ['image/jpeg', 40], 'image : une petite image passe au canvas quand même (type prouvé, métadonnées retirées)');
    let code = null;
    try { await IM.reduireImage(new Blob(['pas une image'], { type: 'image/png' })); } catch (e) { code = e.code; }
    eq(code, 'indecodable', 'image : un blob indécodable lève ErreurImage(indecodable)');
  }
```

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t8-rouge`).

- [ ] **Step 3 : écrire `src/core/image.js`**

```js
// Images de couverture (spec UX § 6, I-G) : les dimensions sont lues dans l'EN-TÊTE du fichier avant tout décodage (une
// image hostile de 20 000 × 20 000 ne doit jamais atteindre createImageBitmap), puis TOUTE couverture est ré-encodée par
// canvas en JPEG : le type est prouvé par le décodage, les métadonnées (dont la position GPS d'une photo) disparaissent.
export const LIMITES_COUVERTURE = { octetsDistants: 5 * 1024 * 1024, octetsLocaux: 25 * 1024 * 1024, pixels: 50_000_000, maxCote: 1200, qualite: 0.85 };

export class ErreurImage extends Error {
  constructor(code) { super(code); this.name = 'ErreurImage'; this.code = code; }
}

const TETE_MAX = 256 * 1024; // un SOF JPEG peut suivre de gros segments EXIF ; au-delà, on renonce (null)

export async function dimensionsImage(blob) {
  if (!(blob instanceof Blob)) return null;
  const b = new Uint8Array(await blob.slice(0, TETE_MAX).arrayBuffer());
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16be = (o) => dv.getUint16(o, false), u32be = (o) => dv.getUint32(o, false), u16le = (o) => dv.getUint16(o, true);
  const u24le = (o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  try {
    if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52) {
      return { largeur: u32be(16), hauteur: u32be(20), type: 'image/png' };
    }
    if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
      let o = 2;
      while (o + 9 < b.length) {
        if (b[o] !== 0xff) return null;
        const m = b[o + 1];
        if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { o += 2; continue; }
        const taille = u16be(o + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { hauteur: u16be(o + 5), largeur: u16be(o + 7), type: 'image/jpeg' };
        o += 2 + taille;
      }
      return null;
    }
    if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
      const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (chunk === 'VP8X') return { largeur: 1 + u24le(24), hauteur: 1 + u24le(27), type: 'image/webp' };
      if (chunk === 'VP8 ') return { largeur: u16le(26) & 0x3fff, hauteur: u16le(28) & 0x3fff, type: 'image/webp' };
      if (chunk === 'VP8L') { const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24]; return { largeur: 1 + (((b1 & 0x3f) << 8) | b0), hauteur: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)), type: 'image/webp' }; }
    }
  } catch { return null; }
  return null;
}

async function decoder(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch (e) {
    // Option refusée par un vieux Safari : repli sans orientation. Un blob indécodable échoue aussi au repli.
    try { return await createImageBitmap(blob); } catch { throw new ErreurImage('indecodable'); }
  }
}

export async function reduireImage(blob, { maxCote = LIMITES_COUVERTURE.maxCote, qualite = LIMITES_COUVERTURE.qualite } = {}) {
  const bmp = await decoder(blob);
  try {
    const ratio = Math.min(1, maxCote / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * ratio)), h = Math.max(1, Math.round(bmp.height * ratio));
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const cx = canvas.getContext('2d');
    cx.drawImage(bmp, 0, 0, w, h);
    const sortie = canvas.convertToBlob ? await canvas.convertToBlob({ type: 'image/jpeg', quality: qualite }) : await new Promise((r) => canvas.toBlob(r, 'image/jpeg', qualite));
    if (!sortie || sortie.type !== 'image/jpeg') throw new ErreurImage('indecodable');
    return sortie;
  } finally { bmp.close?.(); }
}
```

`mime.js` : ajouter après `ALLOWED_MIME` : `export const COVER_INPUT_MIME = ['image/jpeg', 'image/png', 'image/webp'];`.

`sw.js` : `'./src/core/image.js'` dans la ligne `./src/core/` de `SHELL` ; `VERSION = 'cuisine-os-v0.4.0-8'`.

- [ ] **Step 4 : lancer — attendu vert** (`?v=t8-vert`). Si `imageOrientation: 'from-image'` lève dans le navigateur de la suite, le repli couvre ; noter au rapport ce que le navigateur a fait.

- [ ] **Step 5 : vérifications et commit**

```bash
cd ~/projects/mistu && node --check src/core/image.js && node --check src/sync/mime.js && grep -c $'\xe2\x80[\xa8\xa9]' src/core/image.js
git add src/core/image.js src/sync/mime.js sw.js tests/ajouter.js
git commit -m "Images : dimensions lues dans l en-tete avant decodage, re-encodage JPEG systematique (spec UX section 6, S4-S5)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9 : Couverture — réception par ISBN, photo, stockage, affichage (§ 6)

**Files:**
- Create: `src/core/blob-urls.js`
- Modify: `src/model/repo.js` (`getFiles`), `src/ui/livre-ajout.js` (zone couverture + `recupererCouvertureParIsbn` + `poserCouverture`), `src/ui/components.js:74-79` (`bookCover` avec fichier), `src/ui/library.js` (asynchrone, fichiers), `src/ui/book.js` (couverture en en-tête + bloc « Couverture »), `src/app.js:61-83` (révocation à chaque route), `styles.css`, `src/i18n/en.js`, `sw.js`
- Test: `tests/ajouter.js`

**Interfaces:**
- Consumes: `image.js` (tâche 8), `COVER_INPUT_MIME`, `sha256Hex` (`src/core/hash.js`), `repo.putFile`, `repo.getFile`.
- Produces: `blob-urls.js` : `urlDeBlob(blob) → string`, `revoquerUrlsDeBlob() → number` (nombre révoqué) ; `repo.getFiles(sha256s) → Promise<Map<sha256, row>>` ; `livre-ajout.js` : `URL_COUVERTURE_OL(isbn) → string`, `recupererCouvertureParIsbn(isbn, { fetch, signal }) → Promise<Blob | null>` (bornes : `Content-Length` et `blob.size` ≤ 5 Mo, type dans `COVER_INPUT_MIME`, en-tête lisible, pixels ≤ 50 M), `poserCouverture(blob, { origine: 'distante' | 'locale', repo, sha256 = sha256Hex }) → Promise<{ sha256, taille } >` (ré-encode, `putFile`), `renderZoneCouverture(etatCouverture, gestes)` (`.zone-couverture`, boutons Photographier / Choisir une image / Retirer, aperçu, message) ; `components.bookCover(edition, book, { href, fichier })`.

- [ ] **Step 1 : tests rouges**

```js
  // --- § 6 Couverture : réception bornée, ré-encodage, pointeur souple, affichage, URL blob révoquées
  const BU = await import('../src/core/blob-urls.js');
  {
    const revoques = [];
    const orig = URL.revokeObjectURL;
    URL.revokeObjectURL = (u) => { revoques.push(u); return orig.call(URL, u); };
    try {
      const u1 = BU.urlDeBlob(new Blob(['a'])), u2 = BU.urlDeBlob(new Blob(['b']));
      ok(u1.startsWith('blob:') && u2.startsWith('blob:'), 'blob-urls : des URL d’objet');
      eq([BU.revoquerUrlsDeBlob(), revoques.sort(), BU.revoquerUrlsDeBlob()], [2, [u1, u2].sort(), 0], 'blob-urls : tout révoqué une fois, puis plus rien (F4/S15)');
    } finally { URL.revokeObjectURL = orig; }
  }
  {
    const { withRepo } = await import('./sync-fixture.js');
    await withRepo(async (repo) => {
      await repo.putFile('aaa', new Blob(['x'], { type: 'image/jpeg' }), { mime: 'image/jpeg' });
      const m = await repo.getFiles(['aaa', 'absent']);
      eq([m.size, m.get('aaa')?.mime, m.has('absent')], [1, 'image/jpeg', false], 'repo.getFiles : une transaction, les absents ne figurent pas');
    });
  }
  eq(LA.URL_COUVERTURE_OL('9782761950001'), 'https://covers.openlibrary.org/b/isbn/9782761950001-L.jpg?default=false', 'couverture : adresse Open Library avec default=false');
  {
    const reponseBlob = (status, blob, ct = blob.type, longueur = blob.size) => ({ ok: status < 400, status, headers: new Headers({ 'content-type': ct, 'content-length': String(longueur) }), blob: async () => blob });
    const bonPng = png(400, 600);
    ok((await LA.recupererCouvertureParIsbn('978', { fetch: async (u, o) => { eq(o.credentials, 'omit', 'couverture : options S12'); return reponseBlob(200, bonPng); } })) instanceof Blob, 'couverture : 200 image/png → blob');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(404, new Blob([''], { type: 'image/jpeg' })) }), null, 'couverture : 404 → null');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(200, new Blob(['<html>'], { type: 'text/html' })) }), null, 'couverture : type hors liste → null');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(200, bonPng, 'image/png', 6 * 1024 * 1024) }), null, 'couverture : Content-Length 6 Mo → null AVANT de lire le corps');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(200, png(20000, 20000)) }), null, 'couverture : 400 Mpx annoncés par l’en-tête → null, jamais décodé');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => { throw new Error('cors'); } }), null, 'couverture : rejet (CORS/réseau) → null, aucune exception');
  }
  {
    const { withRepo } = await import('./sync-fixture.js');
    await withRepo(async (repo, db) => {
      const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 2000;
      canvas.getContext('2d').fillRect(0, 0, 1600, 2000);
      const photo = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const { sha256 } = await LA.poserCouverture(photo, { origine: 'locale', repo });
      const ligne = await db.get('files', sha256);
      eq([ligne.mime, ligne.blob.type, (await IM.dimensionsImage(ligne.blob)).hauteur], ['image/jpeg', 'image/jpeg', 1200], 'couverture : stockée ré-encodée en JPEG 1 200 px, ligne files locale');
      eq((await db.getAll('outbox')).filter((o) => o.store === 'files').length, 0, 'couverture : la ligne files n’entre pas en file (R58)');
      const encore = await LA.poserCouverture(photo, { origine: 'locale', repo });
      eq(encore.sha256, sha256, 'couverture : putFile idempotent (F10)');
      let code = null;
      try { await LA.poserCouverture(new Blob(['x'], { type: 'image/png' }), { origine: 'locale', repo }); } catch (e) { code = e.code; }
      eq(code, 'indecodable', 'couverture : indécodable → refus nommé (F11)');
      // bookCover avec et sans fichier
      const { bookCover } = await import('../src/ui/components.js');
      const avec = bookCover({ id: 'e1', cover_sha256: sha256 }, { title: 'T' }, { fichier: ligne });
      ok(avec.querySelector('img.cover-img') && avec.querySelector('.cover').classList.contains('with-img'), 'bookCover : fichier présent → <img>');
      const sans = bookCover({ id: 'e1', cover_sha256: sha256 }, { title: 'T' }, {});
      eq([sans.querySelector('img'), sans.querySelector('.title').textContent], [null, 'T'], 'bookCover : pointeur sans fichier (autre appareil avant L4) → vignette texte, sans message');
      BU.revoquerUrlsDeBlob();
    });
  }
  {
    const appels = [];
    const zone = LA.renderZoneCouverture({ sha256: null, apercu: null, message: 'Aucune couverture reçue. Tu peux la photographier.', enCours: false }, { photographier: () => appels.push('photo'), choisir: () => appels.push('choisir'), retirer: () => appels.push('retirer') });
    ok(zone.classList.contains('zone-couverture') && zone.textContent.includes('Aucune couverture reçue.'), 'couverture : la zone dit l’état réel (I-B)');
    eq([...zone.querySelectorAll('button')].map((b) => b.textContent), ['Photographier', 'Choisir une image'], 'couverture : sans image, pas de « Retirer »');
    const avecImg = LA.renderZoneCouverture({ sha256: 'x', apercu: 'blob:fake', message: null, enCours: false }, { photographier: () => {}, choisir: () => {}, retirer: () => appels.push('retirer') });
    [...avecImg.querySelectorAll('button')].find((b) => b.textContent === 'Retirer').click();
    eq(appels, ['retirer'], 'couverture : « Retirer » n’efface que le pointeur (le geste), jamais la ligne files');
  }
```

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t9-rouge`).

- [ ] **Step 3 : `blob-urls.js`, `repo.getFiles`, `components.bookCover`, `app.js`**

`src/core/blob-urls.js` :

```js
// Propriétaire des URL blob: d'affichage (spec UX § 6, F4/S15) : chaque vue en crée par urlDeBlob, et app.js révoque tout
// à chaque changement de route ; library.js révoque aussi en tête de chaque draw() (le filtre redessine à chaque touche).
const vivantes = new Set();
export function urlDeBlob(blob) { const u = URL.createObjectURL(blob); vivantes.add(u); return u; }
export function revoquerUrlsDeBlob() { const n = vivantes.size; for (const u of vivantes) URL.revokeObjectURL(u); vivantes.clear(); return n; }
```

`repo.js`, après `getFile` :

```js
// Lecture groupée (une transaction) des lignes files d'une liste d'empreintes ; les absentes ne figurent pas.
export async function getFiles(sha256s) {
  const rows = await db.getMany('files', [...new Set(sha256s.filter(Boolean))]);
  return new Map(rows.filter(Boolean).map((r) => [r.sha256, r]));
}
```

(Vérifier la forme de retour de `db.getMany` dans `src/core/db.js:102` : si elle rend un tableau aligné avec des `undefined`, le `filter(Boolean)` suffit.)

`components.js` : importer `urlDeBlob` depuis `../core/blob-urls.js` ; `bookCover` devient :

```js
export function bookCover(edition, book, { href = null, fichier = null } = {}) {
  const image = fichier?.blob instanceof Blob ? el('img', { class: 'cover-img', alt: '', src: urlDeBlob(fichier.blob) }) : null;
  return el('a', { class: 'cover-wrap', href: href || `#/books/${edition.id}` },
    el('div', { class: `cover${image ? ' with-img' : ''}` }, image,
      el('div', { class: 'title' }, book?.title || t('Sans titre')),
      el('div', { class: 'author' }, [book?.author, edition.year].filter(Boolean).join(' · '))));
}
```

`styles.css` : `.cover.with-img .title, .cover.with-img .author { display: none; } .cover-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }` ; `.zone-couverture img { max-width: 120px; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 8px; }`.

`app.js` : `import { revoquerUrlsDeBlob } from './core/blob-urls.js';` et, dans `onRoute`, juste après `const seq = ++renderSeq;` : `revoquerUrlsDeBlob();`.

- [ ] **Step 4 : `livre-ajout.js` — couverture**

Imports : `import { sha256Hex } from '../core/hash.js'; import { COVER_INPUT_MIME, ALLOWED_MIME } from '../sync/mime.js'; import { LIMITES_COUVERTURE, dimensionsImage, reduireImage, ErreurImage } from '../core/image.js'; import { urlDeBlob } from '../core/blob-urls.js';`. Ajouter :

```js
export const URL_COUVERTURE_OL = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

// Couverture reçue par ISBN (spec § 6) : Open Library seulement ; bornes AVANT décodage (S4) ; tout échec → null.
export async function recupererCouvertureParIsbn(isbn, { fetch = globalThis.fetch, signal } = {}) {
  try {
    const r = await fetch(URL_COUVERTURE_OL(isbn), { ...OPTIONS_FETCH, signal });
    if (!r.ok) return null;
    const type = String(r.headers.get('content-type') || '').split(';')[0].trim();
    if (!COVER_INPUT_MIME.includes(type)) return null;
    const annonce = parseInt(r.headers.get('content-length') || '0', 10);
    if (annonce > LIMITES_COUVERTURE.octetsDistants) return null;
    const blob = await r.blob();
    if (blob.size > LIMITES_COUVERTURE.octetsDistants) return null;
    const dims = await dimensionsImage(blob);
    if (!dims || dims.largeur * dims.hauteur > LIMITES_COUVERTURE.pixels) return null;
    return blob.type === type ? blob : new Blob([blob], { type });
  } catch { return null; }
}

// Toute couverture est ré-encodée (S5/F11) puis écrite par putFile (idempotent, hors file : R58).
export async function poserCouverture(blob, { origine = 'locale', repo: r = repo, sha256 = sha256Hex } = {}) {
  const borne = origine === 'distante' ? LIMITES_COUVERTURE.octetsDistants : LIMITES_COUVERTURE.octetsLocaux;
  if (blob.size > borne) throw new ErreurImage('trop_lourde');
  if (origine === 'locale' && blob.type && !ALLOWED_MIME.includes(blob.type)) throw new ErreurImage('type');
  const jpeg = await reduireImage(blob);
  const empreinte = await sha256(jpeg);
  await r.putFile(empreinte, jpeg, { mime: 'image/jpeg' });
  return { sha256: empreinte, taille: jpeg.size };
}

export function renderZoneCouverture(etat, gestes = {}) {
  const g = (nom) => () => (typeof gestes[nom] === 'function' ? gestes[nom]() : undefined);
  return el('div', { class: 'field zone-couverture' }, el('span', null, t('Couverture')),
    el('div', { class: 'row' },
      etat.apercu ? el('img', { src: etat.apercu, alt: '' }) : null,
      el('div', { class: 'stack' },
        etat.message ? el('small', { class: 'muted' }, etat.message) : null,
        el('div', { class: 'row' },
          el('button', { type: 'button', class: 'btn', disabled: !!etat.enCours, onClick: g('photographier') }, t('Photographier')),
          el('button', { type: 'button', class: 'btn', disabled: !!etat.enCours, onClick: g('choisir') }, t('Choisir une image')),
          etat.sha256 ? el('button', { type: 'button', class: 'btn link', onClick: g('retirer') }, t('Retirer')) : null))));
}
```

Dans `renderLivreAjoutRoute` : `etat.couverture = { sha256: null, apercu: null, message: null, enCours: false }` ; après une identification **réussie** (`source === 'openlibrary'`), lancer sans attendre :

```js
      if (source === 'openlibrary') recupererCouvertureParIsbn(isbn, { signal: AbortSignal.timeout(LIMITES_ISBN.delaiMs) }).then(async (blob) => {
        if (!blob) { etat.couverture.message = t('Aucune couverture reçue. Tu peux la photographier.'); dessiner(); return; }
        try { const { sha256 } = await poserCouverture(blob, { origine: 'distante' }); etat.couverture = { sha256, apercu: urlDeBlob(await reduireImage(blob)), message: t('Couverture reçue d’Open Library.'), enCours: false }; }
        catch { etat.couverture.message = t('Aucune couverture reçue. Tu peux la photographier.'); }
        dessiner();
      });
```

et `gestes.couverture = () => renderZoneCouverture(etat.couverture, { photographier: () => depuisFichier('environment'), choisir: () => depuisFichier(null), retirer: () => { etat.couverture = { sha256: null, apercu: null, message: null, enCours: false }; dessiner(); } })` avec :

```js
  const depuisFichier = async (capture) => {
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture });
    if (!files.length) return;
    etat.couverture.enCours = true; dessiner();
    try { const { sha256 } = await poserCouverture(files[0], { origine: 'locale' }); const ligne = await repo.getFile(sha256); etat.couverture = { sha256, apercu: urlDeBlob(ligne.blob), message: t('Couverture enregistrée.'), enCours: false }; }
    catch (e) { etat.couverture = { sha256: null, apercu: null, message: e?.code === 'trop_lourde' ? t('Cette image est trop lourde (25 Mo au plus).') : t('Cette image ne peut pas être lue ici. Essaie une autre photo.'), enCours: false }; }
    dessiner();
  };
```

(`poserCouverture` écrit la ligne au choix ; si la personne quitte sans enregistrer, la ligne reste : assumé, § 2.) `enregistrer` passe déjà `coverSha256: etat.couverture?.sha256`.

- [ ] **Step 5 : `library.js` et `book.js`**

`library.js` : `renderLibrary` → `else root.append(await booksTab(ctx));` ; `booksTab` devient `async function booksTab(ctx)` : au début, `const fichiers = await repo.getFiles(ctx.book_editions.map((e) => e.cover_sha256).filter(Boolean));` ; `draw` commence par `revoquerUrlsDeBlob();` (import depuis `../core/blob-urls.js`) ; `bookCover(ed, book)` → `bookCover(ed, book, { fichier: ed.cover_sha256 ? fichiers.get(ed.cover_sha256) : null })`.

`book.js` : importer `bookCover` ; au début de `renderBook`, `const fichierCouverture = edition.cover_sha256 ? await repo.getFile(edition.cover_sha256) : null;` ; dans `pageHeader`, pas de slot pour une image : poser juste **avant** l'en-tête `root.append(el('div', { class: 'row top' }, el('div', { style: { width: '96px', flex: '0 0 auto' } }, bookCover(edition, book, { fichier: fichierCouverture })), enTete))` où `enTete = pageHeader(…)` (la couverture à gauche du titre, F15). Après la section « Recettes », un bloc visible :

```js
  // Couverture (spec § 6) : visible, hors du <details> replié ; « Retirer » ne touche que le pointeur.
  const etatCouv = { sha256: edition.cover_sha256 || null, apercu: fichierCouverture?.blob ? urlDeBlob(fichierCouverture.blob) : null, message: edition.cover_sha256 && !fichierCouverture ? t('La couverture n’est pas sur cet appareil.') : null, enCours: false };
  const poser = async (capture) => {
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture });
    if (!files.length) return;
    try { const { sha256 } = await poserCouverture(files[0], { origine: 'locale' }); await repo.save('book_editions', { ...edition, cover_sha256: sha256 }); toast(t('Couverture enregistrée.')); refresh(); }
    catch { toast(t('Cette image ne peut pas être lue ici. Essaie une autre photo.')); }
  };
  root.append(section(t('Couverture'), renderZoneCouverture(etatCouv, { photographier: () => poser('environment'), choisir: () => poser(null), retirer: async () => { await repo.save('book_editions', { ...edition, cover_sha256: null }); toast(t('Couverture retirée.')); refresh(); } })));
```

(imports : `poserCouverture, renderZoneCouverture` depuis `./livre-ajout.js`, `urlDeBlob` depuis `../core/blob-urls.js`). Sur un appareil sans la ligne `files`, le message « La couverture n'est pas sur cet appareil. » est un **état réel** (I-B) — la vignette de la liste, elle, reste muette (§ 6).

`en.js` : `'Couverture': 'Cover', 'Choisir une image': 'Choose an image', 'Retirer': 'Remove'` (vérifier), `'Aucune couverture reçue. Tu peux la photographier.': 'No cover received. You can photograph it.', 'Couverture reçue d’Open Library.': 'Cover received from Open Library.', 'Couverture enregistrée.': 'Cover saved.', 'Couverture retirée.': 'Cover removed.', 'Cette image est trop lourde (25 Mo au plus).': 'This image is too heavy (25 MB at most).', 'Cette image ne peut pas être lue ici. Essaie une autre photo.': 'This image cannot be read here. Try another photo.', 'La couverture n’est pas sur cet appareil.': 'The cover is not on this device.'`.

`sw.js` : `'./src/core/blob-urls.js'` dans `SHELL` ; `VERSION = 'cuisine-os-v0.4.0-9'`.

- [ ] **Step 6 : lancer — attendu vert** (`?v=t9-vert`). Puis la **mesure réelle depuis `localhost`** (§ 14) : dans l'onglet `http://localhost:8080/tests/`, `page.evaluate(() => fetch('https://covers.openlibrary.org/b/isbn/9780385533225-L.jpg?default=false', { mode: 'cors', credentials: 'omit' }).then((r) => [r.status, r.headers.get('content-type')]))` → attendu `[200, 'image/jpeg']` ; noter le résultat au rapport (un refus CORS en local n'empêche rien : la couverture par ISBN tombe alors à « Aucune couverture reçue » en local seulement).

- [ ] **Step 7 : vérifications et commit**

```bash
cd ~/projects/mistu && for f in src/core/blob-urls.js src/model/repo.js src/ui/livre-ajout.js src/ui/components.js src/ui/library.js src/ui/book.js src/app.js; do node --check $f && grep -c $'\xe2\x80[\xa8\xa9]' $f; done
git add src/core/blob-urls.js src/model/repo.js src/ui/livre-ajout.js src/ui/components.js src/ui/library.js src/ui/book.js src/app.js styles.css src/i18n/en.js sw.js tests/ajouter.js
git commit -m "Couverture de livre : recue par ISBN ou photographiee, bornee avant decodage, re-encodee, pointeur souple, URL blob revoquees (spec UX section 6)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 10 : Clôture — CSP épinglée, tests statiques, version, docs (§ 12, § 13.10)

**Files:**
- Modify: `index.html:5`, `tests/index.html:5` (`connect-src`), `src/model/schema.js` (`APP_VERSION`), `sw.js` (`VERSION`), `CLAUDE.md`, `README.md`, `docs/architecture.md`, `docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md` (§ 15 : ce que la construction a amendé)
- Test: `tests/ajouter.js`

**Interfaces:**
- Consumes : tout ce qui précède. Aucune interface neuve.

- [ ] **Step 1 : tests rouges (statiques, § 13.10)**

```js
  // --- § 12 CSP épinglée, § 13.10 statique
  const lire = async (chemin) => (await fetch(chemin + '?v=' + Date.now(), { cache: 'no-store' })).text();
  const { SUPABASE } = await import('../src/sync/config.js');
  const hotes = [...new Set(Object.values(SUPABASE).map((c) => c.url).filter(Boolean))];
  const attenduConnect = `connect-src 'self' ${hotes.join(' ')} https://openlibrary.org https://www.googleapis.com https://covers.openlibrary.org`;
  for (const page of ['../index.html', './index.html']) {
    const html = await lire(page);
    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
    ok(csp.includes(attenduConnect), `CSP ${page} : connect-src = liste fermée (S10) — lu : ${csp.match(/connect-src [^;]+/)?.[0]}`);
    ok(!/connect-src[^;]*\shttps:(\s|;|$)/.test(csp), `CSP ${page} : plus de https: ouvert`);
  }
  const MODULES_NEUFS = ['../src/ui/puces.js', '../src/ui/livre-ajout.js', '../src/ui/accueil-livre.js', '../src/ui/signet.js', '../src/core/image.js', '../src/core/blob-urls.js', '../src/ui/add.js'];
  const CHAINES_NEUVES_AILLEURS = { '../src/ui/book.js': ['+ Pages d’index', '+ Recette', 'Séance en cours : {n} page(s)', 'Reprendre', 'Couverture', 'Couverture enregistrée.', 'Couverture retirée.', 'La couverture n’est pas sur cet appareil.'], '../src/ui/recipe.js': ['Lien web gardé.', 'L’app n’a pas lu la page : ouvre-la pour cuisiner.', 'Ouvrir le lien', 'Adresse non reconnue : '], '../src/ui/components.js': ['Lien web'] };
  {
    const { EN } = await import('../src/i18n/en.js');
    const manquantes = [];
    for (const m of MODULES_NEUFS) {
      const src = await lire(m);
      for (const [, cle] of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) if (!(cle in EN)) manquantes.push(`${m}: ${cle}`);
      ok(!/\bhtml:\s/.test(src) && !/innerHTML\s*=/.test(src) && !/window\.open\(/.test(src), `statique ${m} : ni html:, ni innerHTML, ni window.open (S14)`);
    }
    for (const [m, cles] of Object.entries(CHAINES_NEUVES_AILLEURS)) for (const cle of cles) if (!(cle in EN)) manquantes.push(`${m}: ${cle}`);
    eq(manquantes, [], 'i18n : chaque t() des modules neufs a son entrée en.js (F13)');
  }
  {
    // Rendu hostile : une chaîne <img onerror> reste du texte dans les rendus neufs.
    const hostile = '<img src=x onerror="window.__x=1">';
    const n1 = renderGrille({ cartes: [{ action: 'pages', ico: 'x', titre: hostile, sousTitre: hostile }] }, { pages: () => {} });
    const n2 = renderPuces(pucesModel({ choisies: [hostile] }), {});
    const n3 = S.renderSignet({ ...S.signetModel({ adresse: 'https://a.test/', titre: hostile }), livres: [] }, {});
    eq([n1.querySelectorAll('img').length, n2.querySelectorAll('img').length, n3.querySelectorAll('img').length, window.__x], [0, 0, 0, undefined], 'statique : une chaîne hostile reste du texte (S14)');
  }
  {
    const sw = await lire('../sw.js');
    for (const m of ['./src/ui/puces.js', './src/ui/livre-ajout.js', './src/ui/accueil-livre.js', './src/ui/signet.js', './src/core/image.js', './src/core/blob-urls.js']) ok(sw.includes(`'${m}'`), `SHELL : ${m}`);
    ok(/VERSION = 'cuisine-os-v0\.4\.0-\d+'/.test(sw), 'sw.js : VERSION 0.4.0');
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(APP_VERSION, '0.4.0', 'APP_VERSION 0.4.0');
  }
```

- [ ] **Step 2 : lancer — attendu rouge** (`?v=t10-rouge` : CSP, `APP_VERSION`, et toute clé `en.js` oubliée — la liste `manquantes` les nomme : les ajouter).

- [ ] **Step 3 : CSP, versions**

`index.html:5` et `tests/index.html:5` : remplacer `connect-src 'self' https:` par `connect-src 'self' https://ybdooerfeziiabsbfxtb.supabase.co https://openlibrary.org https://www.googleapis.com https://covers.openlibrary.org` (l'hôte Supabase est celui de `src/sync/config.js` — le test le relit de là). `src/model/schema.js` : `APP_VERSION = '0.4.0'`. `sw.js` : `VERSION = 'cuisine-os-v0.4.0-10'`.

- [ ] **Step 4 : docs**

- `CLAUDE.md` : sous-section « ### Page « Ajouter » et flux des livres livrés (14 octobre 2026) » après « Synchronisation L3 livrée » : où (branche, plan, registre), ce qui marche (grille, livre en deux pas, puces, accueil, gestes de la fiche, sélecteur, signet, couverture), ce qui n'est **pas** prouvé (aucun scan réel joué par la suite ; couverture par ISBN mesurée par `fetch` depuis Pages et localhost — résultats au rapport ; parcours réel par Neegan : ajouter un vrai livre par ISBN sur le Mac, photographier son index depuis l'accueil, puis sur l'iPhone une couverture par photo), dettes (orphelins `files` → L4 ; `source_pages.sha256` relation latente ; couverture ne voyage pas avant L4 ; D2 pages scannées), **VERSION/APP_VERSION**, compte de tests.
- `README.md` : trois phrases dans la section d'usage : « Ajouter » → cinq cartes ; un livre se crée en deux pas ; un lien web se garde comme référence.
- `docs/architecture.md` : les six modules neufs et leurs rôles ; `blob-urls` ; « intention dans l'adresse » ; `cover_sha256` pointeur souple.
- Spec § 15 : ajouter « ### 15.2 Ce que la construction a amendé » avec une ligne par écart réel (rulings du registre SDD), et le compte final.

- [ ] **Step 5 : lancer — attendu vert** (`?v=t10-vert`) ; noter le total. Puis **dans l'app** (`http://localhost:8080/`), avec le vrai service worker : recharger deux fois, vérifier dans la console `cuisine-os-v0.4.0-10` actif et aucune erreur ; ouvrir `#/add`, `#/add/livre`, `#/add/signet`, `#/library`, une fiche livre : 0 erreur console, 0 réponse ≥ 400 (`browser_network_requests`).

- [ ] **Step 6 : vérifications finales et commit**

```bash
cd ~/projects/mistu && node --test tools/*.test.mjs 2>&1 | grep -E 'ℹ (pass|fail)' && node tools/generer-migrations.mjs --check; echo "check=$?"
grep -rn "window.open\|innerHTML" src --exclude-dir=vendor | grep -v "dom.js" ; for f in $(git diff --name-only main...HEAD); do [ -f "$f" ] && c=$(grep -c $'\xe2\x80[\xa8\xa9]' "$f") && [ "$c" != "0" ] && echo "$f: $c"; done; echo octets-ok
git add index.html tests/index.html src/model/schema.js sw.js CLAUDE.md README.md docs/architecture.md docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md tests/ajouter.js src/i18n/en.js
git commit -m "Cloture du lot Ajouter et livres : CSP epinglee, tests statiques, version 0.4.0, docs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git status --porcelain
```

---

## Auto-revue du plan (faite à l'écriture)

**Couverture de la spec.** § 4 → T2 ; § 5 → T4 (+ couverture T9) ; § 6 → T8, T9 ; § 7 → T1, T4, T5, T6 ; § 8 → T5 ; § 9 → T5 ; § 10 → T2, T3 ; § 11 → T7 ; § 12 → T9 (pointeur souple, `getFiles`), T10 (CSP, `--check`) ; § 13.1-13.10 → les blocs de `tests/ajouter.js` des tâches 2-10 ; § 14 → mesures réelles en T4 (ISBN réel, à la main) et T9 (CORS localhost). Dettes nommées : orphelins `files`, `source_pages.sha256`, octets L4, D2 — consignées en T10.

**Cohérence des noms.** `startScanSession(files, { edition_id, session_id, intention })` (T3) utilisé par T2, T5 ; `adresseSeance` ; `remplacerAdresse` (T3) utilisé par T5 ; `carte`, `libelleLivre` (T2) utilisés par T5, T7 ; `pucesModel/renderPuces/basculerPuce/ajouterPuce/cuisinesExistantes` (T1) utilisés par T4, T5, T6, T7 ; `lookupIsbn(isbn, { fetch, signal })`, `fusionnerFiche`, `fabriquerLivre`, `enregistrerLivre`, `renderLivreAjout`, `renderLivreAjoutRoute`, `LIMITES_ISBN`, `OPTIONS_FETCH` (T4) ; `URL_COUVERTURE_OL`, `recupererCouvertureParIsbn`, `poserCouverture`, `renderZoneCouverture` (T9) utilisés par `book.js` ; `dimensionsImage`, `reduireImage`, `ErreurImage`, `LIMITES_COUVERTURE` (T8) ; `COVER_INPUT_MIME` (T8) ; `urlDeBlob`, `revoquerUrlsDeBlob` (T9) ; `repo.getFiles` (T9) ; `bookCover(edition, book, { href, fichier })` (T9) ; `lienSignet`, `signetModel`, `fabriquerSignet`, `enregistrerSignet`, `renderSignet`, `renderSignetRoute`, `LIMITES_SIGNET` (T7) ; `blocSignet` (T7, exporté de `recipe.js`) ; `accueilLivreModel`, `ACCUEIL_ACTIONS`, `renderAccueilLivre` (T5) ; `seancesOuvertes` (T5) ; `cuisinesDepuis` (T6). Les variables de test `png`, `jpeg`, `webpVp8x`, `u8` sont définies en T8 et réutilisées en T9 (même fonction `runAjouterTests`, même portée) ; `LA`, `S`, `IM`, `BU`, `renderGrille`, `renderPuces`, `pucesModel` idem — **les blocs de tests doivent rester dans l'ordre des tâches** dans `tests/ajouter.js`.

**Placeholders.** Aucun « TODO/TBD/à définir » ; chaque étape de code porte le code. Points laissés au jugement de l'implémenteur, nommés : la forme de retour de `db.getMany` (T9), l'emplacement exact des appels `runSyncL3Tests` (T1), les clés `en.js` déjà présentes (ne pas doubler), le comportement d'`imageOrientation` dans le navigateur de la suite (T8).

**Ce qui n'est pas dans ce plan.** La preuve sur appareils par Neegan (un vrai livre par ISBN, un index photographié depuis l'accueil, une couverture par photo sur l'iPhone) ; la synchronisation des octets (L4) ; l'import complet d'une page web.
