# Expérience « carnet » (lot UI-1) : olive, grands titres, cartes-plat, bibliothèque sur les recettes — plan d'implémentation (rév. 5, 26 octobre 2026)

> **Rév. 4** : trois rulings du chef d'orchestre (26 octobre 2026, rév. 3 → rév. 4), appliqués PAR ÉDITION CIBLÉE sur une copie `cp` de la rév. 3 — une ligne
> par point dans la sous-section « Rulings du chef d'orchestre (rév. 3 → rév. 4) » de la section « Pré-vol » en fin de plan. (1) CRITICAL T3 Step 6 : la règle
> `.fiche-tete:has(> .fiche-photo:empty)` déclare la zone `photo` (`"etat" "gestes" "photo"`, troisième rangée de 0 px) — sans elle, l'enfant vide `grid-area: photo`
> prenait une piste implicite à droite (Chromium : « 1068px 0px 0px ») contre l'assertion `vide1100` ; un mutant CSS de plus au Step 10, P-23 complété.
> (2) `mesureFiche` borne `img.decode()` à 3 s (`Promise.race`) : sans `eager`, une img lazy hors écran ne se charge jamais et la suite se figerait au lieu de
> rougir ; l'attendu du mutant du test réécrit. (3) T5 Step 10 : l'épingle à la valeur MESURÉE (obtenu − 1), l'attendu de raisonnement en commentaire seulement.
> Rien n'a été écrit dans `/Users/neeganmac/projects/mistu-carnet`.
>
> **Rév. 3** : les dix-neuf rulings du chef d'orchestre (26 octobre 2026, rév. 2 → rév. 3), appliqués PAR ÉDITION CIBLÉE — une ligne par point dans la
> sous-section « Rulings du chef d'orchestre (rév. 2 → rév. 3) » de la section « Pré-vol » en fin de plan. Le Critical du vérificateur (T3 : `onglets` capturé
> AVANT un redessin, nœud détaché) est fermé par un accesseur, et le mutant qui le révèle rejoint le Step 10 de T3 ; la règle `.plat-vignette.grande` est
> écrite au caractère près comme celle du lot UI-2 (R-UI1-1) ; les sources du test I-F3 restent à UI-2 (R-UI1-2) ; une largeur 950 px s'ajoute aux cadres de
> T2 (D-15 ; T2 passe à 40) ; la mesure de la fiche (T3) charge une image RÉELLE avant de mesurer ; les doutes D-1 à D-6, D-8 à D-10, D-14 à D-16, A-15,
> A-16 et P-7 sont ratifiés ou tranchés ; la Clôture dit la résolution des fichiers communs par union et le commit de version si UI-1 fusionnait en premier
> (I-UI-7). Rien n'a été écrit dans `/Users/neeganmac/projects/mistu-carnet`.
>
> **Rév. 2** : pré-vol à trois lentilles (ordre, fantômes, faux-vert) sur la rév. 1 ; chaque constat est appliqué PAR ÉDITION CIBLÉE ou refusé avec sa
> raison, vérifiée dans le code à `f3672be` — une ligne par constat dans la section « Pré-vol (rév. 1 → rév. 2) » en fin de plan. Trois rulings du
> pré-vol (R-UI-P1 à R-UI-P3, Global Constraints) tranchent les doutes D-1, D-6 et le sous-titre de la fiche (§ 4.2) ; T6 les porte en spec § 12.
>
> **Rév. 1** : six auteurs ont écrit les tâches 1 à 6 en parallèle, en lecture seule sur le worktree à `f3672be` ; un assembleur a posé
> l'en-tête et la clôture, concaténé les six tâches et corrigé PAR ÉDITIONS CIBLÉES les écarts entre auteurs (noms d'aides, placement des blocs
> de `tests/carnet.js`, signatures consommées, clés `en.js` doublées, listes des filets i18n) — une ligne par correction dans la section
> « Assemblage (rév. 1) » en fin de plan (A-1 à A-n), avec les doutes laissés au chef d'orchestre. La spec § 7 a tranché chaque écart.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'app prend l'allure des maquettes sans changer un seul geste ni une seule règle de produit : l'olive devient la couleur d'action (le vert
gris reste aux états), les titres grandissent (`clamp()`, serif système), vingt-trois icônes au trait remplacent les émojis de la navigation, de la
grille Ajouter, de l'accueil d'un livre et des onze états vides ; la Bibliothèque (ex-« Mes livres ») s'ouvre sur les RECETTES en grille de
cartes-plat (photo 4:3 quand les octets sont là, bloc de titre sur `--paper-2` sinon, jamais de cadre vide), filtres Toutes / De mes livres / Du
web calculés sur les données, « Ajouter une recette », pied « Recettes de mes livres à importer » ; la fiche recette met la photo en regard du titre
dès 760 px, replie Portions / versions / autres gestes sous un `details`, garde « Commencer à cuisiner » et « Corriger » à portée, met Ingrédients
et Préparation côte à côte ou en onglets ; la fiche livre passe en deux colonnes dès 900 px avec une liste compacte des recettes ; Aujourd'hui,
Ajouter et l'écran d'import ciblé suivent (cartes-plat, icônes, « À importer », « × » de retrait) ; les textes qui portaient un outil (« + Recette »,
« Ouvrir le lien », « Repérée dans ton livre » dans les listes) deviennent des textes d'affichage. Aucun serveur, aucune migration, aucun appel.

**Architecture:** une feuille (`styles.css` : quatre jetons, deux formules `clamp()`, `section.plain`, `.grille-plats`, `.carte-plat`,
`.plat-vignette.grande` / `.petite`, `.two-col.livre`, `.liste-compacte`, `.fiche-tete`, `.icone`), un module feuille neuf (`src/ui/icones.js` :
`NOMS_ICONES`, `icone(nom)` → svg au trait `currentColor`, levée sur un nom inconnu), des composants étendus dans `src/ui/components.js`
(`pageHeader({ classeTitre })`, `sectionPlain`, `emptyState` à nom d'icône, `recipeCard(doc, { photoEnTete, fichier })` + `dureeTotale`,
`ligneSource`, `grilleCartes`, `lienOrigine`, `availabilityBadge` à textes courts), et cinq écrans recomposés qui ne lisent les octets qu'en UNE
passe `repo.getFiles` par rendu et passent la ligne `files` à la carte, qui décide au rendu (I-UI-5) : `library.js` (segments Recettes | Livres |
Plats, `?tab=a-importer`, grille bornée à 60 + « Voir plus »), `recipe.js` (`.fiche-tete`, repères, `details[data-role=autres-gestes]`, `segmented`
Ingrédients / Préparation par `hidden`, `deps.matchMedia` injectable), `book.js` (`.two-col.livre`, « Sommaire », `ligneCompacte`, 8 lignes puis « Voir
les {n} recettes »), `home.js` (`pageHeader`, `grilleCartes`, sa passe `getFiles`), `add.js` / `accueil-livre.js` / `import-cible.js` (icônes, « × »,
badge court) ; `src/app.js` (NAV « Bibliothèque », icônes) reste hors suite ; `search.js` ne change que d'un littéral (le nom d'icône de son état
vide). Tests : `tests/carnet.js` (neuf, un bloc par tâche AU-DESSUS d'un repère de fin), les épingles de § 7 amendées tâche par tâche, et un outil
de preuve visuelle Playwright DÉDIÉ dans le registre (hors git), jamais le navigateur MCP partagé.

**Tech Stack:** PWA sans build (modules ES natifs, aucune dépendance npm), IndexedDB (`db.mutate` porte unique, `repo.getFiles` en une transaction),
suite navigateur `tests/index.html` lancée par `.superpowers/sdd/2026-10-23-experience-carnet/suite.cjs` (Chrome sans tête, Playwright du cache npx,
fenêtre 1280 px), `node --test tools/*.test.mjs`, `node tools/generer-migrations.mjs --check` ; preuve visuelle `preuve-visuelle.cjs` (copie adaptée de
l'outil du lot refonte, contextes jetables, données SEMÉES, quatre largeurs + 320 px).

**Spec:** `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (**rév. 2.1**, commise `7633675` ; le « Go » de Neegan sur les sept points de
§ 13 : `f3672be`). Elle fait foi. PÉRIMÈTRE DE CE PLAN : le volet **UI-1 « Carnet »** seulement — D-UI-1 à D-UI-11, I-UI-1 à I-UI-5 et I-UI-7, § 3 en
entier, § 4.1 à § 4.5, § 4.6 partie UI-1 (thème seulement : la carte web garde sa forme épinglée par `tests/recherche-web.js:1035`), § 5 hors lignes UI-2,
§ 7 partie UI-1 (épingles T1 à T5, tests neufs `tests/carnet.js`, mutants UI-1, preuve visuelle), § 9 tâches T1 à T6, § 10 UI-1, § 11 UI-1, § 12
(constats B-I-3 à B-I-11, B-I-14, B-I-15, B-M-1 à B-M-5, B-M-7 à B-M-9, B-M-12, F-1 à F-9, F-11 à F-18, K-2, K-3, K-6, H-1 à H-4, H-6, H-8 à H-11,
H-13 à H-17, H-19 à H-21) et les sept défauts confirmés du § 13 (olive = action, « Cuisine OS », « Bibliothèque », gestes repliés avec « Corriger »
visible, tri par dernière modification). Le volet **UI-2 « Aperçus »** (outil serveur `apercu-web`, `src/domain/apercu-web.js`, figures et ligne d'état
de `search.js`, `0007`) est un AUTRE plan, sur la branche `apercus-web` : rien ici ne le planifie. Plan à commettre sous
`docs/superpowers/plans/2026-10-23-experience-carnet-ui-1.md` ; registre `.superpowers/sdd/2026-10-23-experience-carnet/` (hors git : `progress.md`,
`cartographie.md`, `revue-spec-rev1.md`, `verif-spec-rev2.md`, `suite.cjs` déjà présents ; le copier dans `~/projects/mistu/.superpowers/sdd/` AVANT tout
`git worktree remove`).

**Références relues pour écrire ce plan (lecture seule).** Le worktree `/Users/neeganmac/projects/mistu-carnet` à `f3672be` (= `main` `05c751f` + trois
commits de docs : spec rév. 1, rév. 2, rév. 2.1 et le « Go ») : chaque numéro de ligne du plan vaut à `f3672be` et se RELIT au Step 0 de chaque tâche (une
dérive après T1 à T5 n'est pas un constat, R-C-7 : la ligne se retrouve par son texte, l'écart est un amendement nommé dans `progress.md`). Le modèle
de ce plan : `docs/superpowers/plans/2026-10-19-plats-en-images.md` (lot F). Les décisions de Neegan du 23 octobre (§ 13) sont confirmées : le plan
construit les sept défauts.

## Global Constraints

- **Préconditions.** (1) La branche `experience-carnet` est à `f3672be` (`git log --oneline -1`), worktree `/Users/neeganmac/projects/mistu-carnet`,
  propre (`git status --short` vide hors `.superpowers/`, exclu). (2) Le serveur du worktree tourne : `python3 -m http.server 8096 --bind 127.0.0.1`
  depuis le worktree (`curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8096/tests/` → 200 ; PID consigné dans le scratchpad du lot). (3) Le
  lanceur `.superpowers/sdd/2026-10-23-experience-carnet/suite.cjs` est présent (copié au Départ). (4) La branche `apercus-web` (UI-2, worktree
  `~/projects/mistu-apercus`, port 8095) est un AUTRE lot : aucun fichier de ce plan n'est écrit là, aucun fichier de UI-2 n'est lu comme une consigne.
  **Si (1) ou (3) manque, la tâche 1 s'arrête au Step 0 et le remonte (NEEDS_CONTEXT).**
- **Où.** Branche **`experience-carnet`**, worktree **`/Users/neeganmac/projects/mistu-carnet`** (jamais `~/projects/mistu`, ni `~/projects/mistu-apercus`),
  servi sur **8096**. Suite : `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` (il ouvre `http://localhost:8096/tests/`, purge le cache
  par CDP, lit le bilan `#out h2`, rend 0 seulement sur un bilan ✅ stable et une console propre hors favicon). Node : `node --test tools/*.test.mjs`.
  Générateur : `node tools/generer-migrations.mjs --check` (attendu 0). Mutants : sur des COPIES légères du worktree dans le scratchpad (`rsync -a
  --exclude .git --exclude .superpowers --exclude node_modules --exclude coverage --exclude public`), servies à part (8196, 8296, 8396 ; trois copies au
  plus à la fois ; serveur tué à la fin), jamais en place, jamais le port 8096 ; la mutation est écrite par un script qui refuse tout chemin hors du
  scratchpad (Edit ciblé si un garde-fou refuse : jamais un contournement).
- **Départ (mesure, pas consigne).** À `f3672be` : suite **`✅ 5948/5948`**, épingle `tests/tests.js:250` **5947** (`eq(results.length, 5947,…`), Node
  **208/208**, `--check` **0**, `APP_VERSION 0.15.0` (`src/model/schema.js:6`), `sw.js` `VERSION = 'cuisine-os-v0.15.0-9'` (l. 4), `DB_VERSION 4`
  (l. 5). La tâche 1 RELÈVE ces six chiffres au Step 0 et les consigne dans `progress.md` ; un écart est un amendement nommé, pas un NEEDS_CONTEXT.
  Règle : **épingle = obtenu − 1** (l'assertion du total s'ajoute elle-même au bilan). **Chaque tâche rend verts** la suite, Node et `--check` ; seule
  erreur de console admise : le 404 de `/favicon.ico` (préexistant). Chaque tâche relève l'épingle à la valeur MESURÉE dans « obtenu » (jamais à un
  compte raisonné) et consigne l'écart quand il y en a ; les comptes d'assertions écrits dans les tâches (T1 37, T2 40, T3 30, T4 35 + 1 par l'amendement
  de `tests/photo-plat.js:1298`, T5 28, T6 12 ; avec la 29e paire de `tests/theme.js` et les 3 assertions du filet `MODULES_NEUFS` pour `icones.js`
  (`tests/ajouter.js:3790-3796` : trois `ok()` par module — longueur, `export`, S14 ; rév. 2) : épingle finale attendue **6134** = 5947 + 1 + 3 + 37 + 40 +
  30 + 36 + 28 + 12, bilan **✅ 6135/6135**) sont des attendus de RAISONNEMENT, pas des mesures (rév. 2 : T2 passe à 39 par deux largeurs de cadre de plus,
  T3 à 30 par le sous-titre et la feuille mesurée ; rév. 3 : T2 passe à 40 par la largeur 950 px, D-15). **D-14 et A-16 RATIFIÉS (rév. 3)** : toutes les
  valeurs de suite écrites dans ce plan sont des attendus de raisonnement ; chaque Step « vert » épingle la valeur MESURÉE dans « obtenu » et consigne l'écart.
- **Versions (I-UI-7 ; ruling 19 de la rév. 3).** Ce lot porte **`APP_VERSION 0.17.0`** dès la tâche 1 (UI-2 porte `0.16.0` et fusionne D'ABORD ; **si UI-1
  fusionnait AVANT UI-2**, un commit de version renumérote à la fusion — I-UI-7 : le premier lot FUSIONNÉ porte 0.16.0, le second 0.17.0 — sur `schema.js`,
  `sw.js` et les 13 assertions + 1 commentaire des 8 suites, relevés par le script ci-dessous ; le détail est dans la section « Clôture », Fusion).
  `sw.js` `VERSION = 'cuisine-os-v0.17.0-1'` à la tâche 1, puis **+1 à chaque commit — tâche ou ronde — qui touche `src/`, `styles.css`,
  `index.html`, le manifeste ou `sw.js`** (R-B-24) : attendu `-2` (T2), `-3` (T3), `-4` (T4), `-5` (T5) ; T6 ne porte une version que si
  `src/i18n/en.js` change à son Step 3 (attendu : non). Chaque tâche lit le suffixe RÉEL à son Step 0 et écrit K+1 (une ronde compte). `SHELL` +
  `'./src/ui/icones.js'` (tâche 1, entre `./src/ui/home.js` et `./src/ui/import-cible.js`, posé DANS le Step qui pose le premier import du module :
  `tests/sync.js:977` compare `SHELL` au graphe d'imports depuis `src/app.js`) ; aucun autre module neuf. `DB_VERSION` reste **4** ; `index.html`,
  le manifeste, `theme-color`, la CSP ne changent pas. Relevé des pins (depuis la racine du worktree ; l'argument est la version cherchée) :

  ```bash
  python3 -I - 0.15.0 <<'PY'
  import glob, sys
  v = sys.argv[1]; v_echappee = v.replace('.', '\\.')
  for f in sorted(glob.glob('tests/*.js')):
      for i, l in enumerate(open(f, encoding='utf-8'), 1):
          if v in l or v_echappee in l:
              print(f'{f}:{i}: {l.strip()[:160]}')
  PY
  ```

- **Aucun serveur, aucune migration, aucun appel réel.** Aucun fichier sous `supabase/` ni sous `tools/` (`git diff --stat f3672be..HEAD -- supabase/
  tools/` vide à chaque clôture de tâche) ; la fonction `assistant` n'est ni touchée ni redéployée ; aucun magasin, aucun index, aucune relation ;
  aucun réglage neuf ; CSP inchangée. Le seul fichier de `src/` hors `src/ui/` touché : `src/i18n/en.js` (textes), `src/core/i18n.js:27`
  (`STATE_LABELS.availability.reference_only`, T5), `src/model/schema.js:6` (`APP_VERSION`, T1), `src/app.js` (NAV, T1 ; hors suite).
- **Quatre fichiers communs avec UI-2** (spec § 9) : `sw.js` (UNION de `SHELL` — `./src/ui/icones.js` ET `./src/domain/apercu-web.js` — et `VERSION`
  +1 au commit de fusion), `src/model/schema.js` et les pins (règle I-UI-7), `src/i18n/en.js` (union ; une clé que les deux lots posent est écrite UNE
  fois), `tests/tests.js:250` (remesuré après la fusion). Toute édition de ces quatre fichiers par ce plan est faite par son texte, jamais par un
  numéro de ligne seul, pour que la fusion se résolve sans surprise. `search.js` : UN littéral change (tâche 1, l. 162, le nom d'icône `'loupe'` de
  son état vide, nommé par § 3.3 et rendu nécessaire par `emptyState` stricte) ; UI-2 réécrit ce fichier : ligne à surveiller à la fusion (sous-section
  « Assemblage », doute D-1, TRANCHÉ par R-UI-P1 ci-dessous). Rien d'autre dans `search.js`.
- **Rulings du pré-vol (rév. 2, RATIFIÉS rév. 3) et rulings du chef d'orchestre (rév. 3) — T6 les porte en spec § 12, AVANT R-UI-1, et amende § 4.2, § 5
  et « Specs amendées par ce lot » :**
  - **R-UI-P1** `search.js:162` est la SEULE édition de `search.js` dans ce lot : le littéral `'🔍'` → `'loupe'` (§ 3.3 le nomme ; `emptyState` stricte
    lèverait sinon au rendu de `#/search` sans résultat). Le brief (« aucune édition de `search.js` ») vise la FORME de la carte web, épinglée par
    `tests/recherche-web.js:1035`, qui ne bouge pas. À la fusion, la version UI-2 de `search.js` porte `'loupe'` (section « Clôture », Fusion).
    Coût si faux : un état vide de recherche qui lève — aucun. **RATIFIÉ rév. 3 (D-1)** : UN seul littéral change dans `search.js`, rien d'autre ; la ligne
    est NOMMÉE pour la fusion : `results.append(emptyState('🔍', t('Aucune recette admissible.') + …` (l. 162 à `f3672be`) → `emptyState('loupe', …`.
  - **R-UI-P2** le sous-titre de la fiche recette RESTE `provenanceText(recipe, book, edition)` (« {titre} — {auteur} · page N », hôte recalculé, étiquette
    IA, « Source personnelle ») : les préfixes « Du web · » / « De mon livre · » sont ceux de la ligne de source de la CARTE-PLAT (§ 3.3, `ligneSource`),
    pas de la fiche — `tests/creer-ia.js:1397-1398` épingle « Mon livre — A. B. · page 58 » en `header p`, et une fiche à livre ET adresse montre les deux
    (C10, F22, `tests/ajouter.js:1142`). La première phrase de § 4.2 (« sous-titre = « Du web · {hôte} » / « De mon livre · {titre} — {auteur} · page N » /
    étiquette IA ») est AMENDÉE par T6 en « sous-titre = `provenanceText` (inchangé) ». T3 l'épingle (une assertion). Coût si faux : un préfixe à poser et
    quatre tests à amender (creer-ia.js:1338, 1375, 1397, 1400). **RATIFIÉ rév. 3 (P-7)** : le sous-titre reste `provenanceText` (`tests/creer-ia.js`
    l'épingle) ; l'amendement de spec est consigné au § 12 par T6 (Step 8.4).
  - **R-UI-P3** le `segmented` « Ingrédients / Préparation » (T3) réemploie les clés des sections : `'Préparation': 'Method'` (`en.js:49`) ; la ligne
    « Ingredients / Steps » de § 5 est AMENDÉE par T6 en « Ingredients / Method (clé partagée avec la section, H-14 par analogie) ». Coût si faux : une
    clé dédiée au `segmented` et une entrée `en.js` de plus. **RATIFIÉ rév. 3 (D-6)** : « Préparation » garde `'Method'` (clé existante) ; § 5 amendé à la
    clôture par T6.
  - **R-UI1-1** (rév. 3, chef d'orchestre) la règle `.plat-vignette.grande` de ce plan (T2, Step 5) est ÉCRITE AU CARACTÈRE PRÈS comme celle que le lot UI-2
    (branche `apercus-web`, fusionné AVANT) pose dans `styles.css` juste après la règle `.plat-vignette` 72 px :
    `.plat-vignette.grande { width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; display: block }` ; UI-2 la suit de
    `figure.apercu { margin: 0 0 .6rem }` et porte l'épingle `tests/photo-plat.js:1323` à DEUX sélecteurs ; ce plan ajoute `.plat-vignette.petite { width: 48px;
    height: 48px; }` juste après et porte l'épingle à TROIS sélecteurs (`.plat-vignette`, `.plat-vignette.grande`, `.plat-vignette.petite`). À la fusion,
    `styles.css` et `tests/photo-plat.js:1323` se résolvent par UNION (section « Clôture », Fusion). Coût si faux : un conflit textuel de plus à la fusion.
  - **R-UI1-2** (rév. 3, chef d'orchestre) la liste des sources du test I-F3 (`tests/photo-plat.js:1327-1331` : `srcPP`, `srcK`, `srcMeals`) est étendue par
    UI-2 à `search.js` et `library.js` : ce plan NE la touche PAS (vérifié à la rév. 3 : aucune tâche ne l'édite — T2 n'amende que les l. 1322-1323, T4 les
    l. 1296-1309 ; la version UI-2 de ces lignes vaut à la fusion).
- **Tests : bases jetables seulement** (`withRepo` de `tests/sync-fixture.js` ; jamais la base `cuisine-os`), `fetch` remplacé par un lanceur d'erreur
  pendant tout bloc qui monte un écran (remis en `finally`), `matchMedia` FACTICE injecté par `deps.matchMedia` (`library.js`, `recipe.js`, `book.js` :
  `(q) => window.matchMedia(q)` par défaut, jamais `window.matchMedia` nu — « Illegal invocation »), `pickFiles`, `navigate`, `toast` injectés ; aucune
  navigation réelle (un segment n'est jamais cliqué dans la suite : `navigate` changerait le fragment de la page de tests) ; scènes hors écran pour les
  mesures de feuille (la feuille servie est injectée le temps du bloc, retirée en `finally`), scènes DANS la fenêtre (`position:fixed`, `z-index:-1`)
  quand une image `loading="lazy"` doit se charger ; URL `blob:` révoquées en `finally` (`revoquerUrlsDeBlob`) ; textes français affirmés sous
  `setUiLocale('fr')`, locale remise en `finally` ; un émoji de test est écrit par `String.fromCodePoint`, jamais en littéral ; aucune clé ni valeur
  sensible (le seul jeton d'un bloc est une sentinelle `…-sentinelle`, jamais lue par un `fetch`). Jamais le navigateur MCP partagé : la suite par
  `suite.cjs`, la preuve par `preuve-visuelle.cjs`, tout regard ad hoc par un `page.evaluate` Playwright depuis le scratchpad, en lecture seule.
- **Un seul fichier de tests neuf, `tests/carnet.js`** (`export async function runCarnetTests({ eq, ok })`, câblé dans `tests/tests.js` AVANT le bloc du
  thème, tâche 1). Son lanceur de bloc est **`bloc(nom, f)`** (try/catch → `ok(false, 'Carnet — bloc « nom » interrompu : …')`) ; chaque tâche 2 à 6
  ajoute son bloc `{ … }` AU-DESSUS du repère de fin `// --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette ligne ---`, après
  le bloc de la tâche précédente, dans la fonction ; un bloc déclare ses propres aides (portée de bloc, suffixées ou locales) et importe lui-même ce
  qu'il emploie (`withRepo`, `sha256Hex`, modules) : aucune aide d'une tâche n'est supposée par une autre, hors `bloc`, `eq`, `ok`.
- **Toute règle neuve de `styles.css` respecte `tests/theme.js`** (I-UI-4, F-18) : T-1 (inventaire EXACT des `display: none` : aucun neuf — un bouton
  ou une section se cache par `[hidden]`), T-2 (jetons seulement : aucun `#…`, aucun `rgba(`, aucune couleur nommée hors `:root` ; le mot « olive » est
  permis dans un commentaire, jamais dans une valeur), T-11 (aucun `56px` hors `.btn.big`), survol seulement sous `@media (hover: hover)`, 29 paires
  ≥ 4,5 (la 29e : olive sur `--paper-2`). `tests/theme.js` reste VERT sans autre changement que ceux de la tâche 1 (une valeur, une paire, les
  libellés « tomate »).
- **Épingles : amendées, jamais contournées** (spec § 7, tâche par tâche) ; chaque site est retrouvé par son TEXTE ; tout rouge HORS de la liste
  attendue du Step « rouge lu » arrête la tâche (NEEDS_CONTEXT). Un test neuf affirme un COMPORTEMENT (DOM rendu, lectures comptées par un espion
  sur l'instance de base, feuille mesurée) ; un test de source n'est admis que pour `app.js` (hors suite par décision), les filets i18n et `SHELL`.
- **Mutants** : chaque tâche rejoue les siens sur une copie servie à part, chacun doit rougir, le test qui le tue est nommé, la sortie est lue et
  consignée ; un survivant se consigne et gagne son test avant le commit, jamais un « équivalent » sans sa sortie lue.
- **Invisibles et secrets** : avant chaque commit, le scan Python (`python3 -I`, jamais `grep` : ce shell est `ugrep`, faux zéro) sur chaque fichier
  touché — U+200B à U+200D, U+2028 / U+2029, U+202A à U+202E, U+2060, U+FEFF — attendu `invisibles : 0` ; `git grep -nEi
  'sk-ant-[0-9A-Za-z_-]{10,}|eyJ[A-Za-z0-9_-]{20,}|sb_(secret|publishable)_' -- src styles.css sw.js tests` : rien hors les sentinelles connues.
  Les U+FE0E de `app.js:60` (barre haute, antérieurs) restent hors de l'ensemble contrôlé.
- **Commits** : un commit par tâche (deux pour T6), par chemins nommés (jamais `-A` : le registre `.superpowers/` est hors git, le scratchpad hors
  dépôt), message ASCII sans accents, trailer `Co-Authored-By` du modèle RÉEL de l'implémenteur (R-T1-3 ; ex. `Co-Authored-By: Claude Fable 5.1
  <noreply@anthropic.com>`) et la ligne de session que le brief donne ; jamais `git push`, jamais une réécriture d'historique ; `git status --short`
  propre hors `.superpowers/` après chaque commit. Deux agents dans le worktree partagent l'index : `git add <fichiers>` nommés.
- **Chaque tâche écrit dans `progress.md`** (registre) : Départ (chiffres relevés), rouge lu, vert, épingle, `sw.js`, mutants, amendements nommés
  (ligne retrouvée ailleurs, conditionnel tranché), rulings R-UI-n proposés au chef d'orchestre (T6 les porte en spec § 12).

- **Les invariants du lot (spec § 2, copiés mot pour mot ; I-UI-6 est UI-2 et ne vaut pas ici) :**

  - **I-UI-1 Aucune règle de produit ne bouge.** L'original n'est jamais réécrit (« Corriger » crée une version) ; un signet n'est pas une
    recette conservée (il garde son badge « Lien web » là où il paraît) ; « Disponible » seulement après enregistrement ; **un geste = un
    nombre d'appels annoncé AVANT la tape** (une recherche illustrée en annonce deux) ; aucune donnée inventée (pas de sous-titre, de titre
    d'étape, de durée, de « Livre reconnu » sans « vérifie ») ; le segment « Web » de la recherche reste l'appel payant, distinct du filtre
    « Du web » de la bibliothèque ; « Voir la page d'origine » reste offert sur toute adresse lisible (I-B5).
  - **I-UI-2 Aucune image distante.** `img-src 'self' blob: data:` inchangée ; toute image vient d'un blob local (I-F3) ; l'adresse IP de
    l'appareil ne part jamais chez un site (D-F3) ; les aperçus passent par la fonction, avec ses hôtes refusés, sa boucle de redirections
    et son `User-Agent` ; une image reçue passe le mur de F, `preparerPhotoDistante`, avant tout `<img>` (I-F2 : type de l'en-tête = type
    annoncé, ≤ 16 Mpx, petit côté ≥ 200 px ; sans ré-encodage pour un aperçu).
  - **I-UI-3 Aucune classe JS renommée, aucune route retirée, aucun écran retiré de la navigation** (règle « une page sans lien n'existe
    pas ») ; `NAV`, `registerRoutes`, `ROUTES_DE_SAISIE` gardent leurs entrées ; les blocs épinglés par les tests de comportement (ordre des
    rangées d'une carte web, `.status[role=status]` suivie de `.row`, `data-role` des gestes) se déplacent avec leurs tests amendés, jamais
    en silence.
  - **I-UI-4 Accessibilité mesurée, comme la refonte visuelle.** 28 paires + la paire neuve ≥ 4,5 ; contour des champs ≥ 3 (aucun champ
    posé sur `--action-bg`, où `--field-line` ne vaut que 2,89) ; cibles ≥ 44 px (36 pour `.btn.small`) ; focus visible ; mouvement réduit ;
    `[hidden]` et jamais une `display:none` neuve ; les vignettes décoratives gardent `alt=''` ; une image qui porte un sens a un nom ; le
    glisser garde Monter / Descendre ; toute règle neuve de `styles.css` respecte T-1, T-2 et T-11 de `tests/theme.js` (jetons seulement,
    jamais le mot « olive » en valeur, jamais 56 px hors `.btn.big`, survol sous `@media (hover: hover)`).
  - **I-UI-5 Rien sans octets.** Une carte-plat ou une vignette de résultat n'existe que lorsque les octets sont là et de type image (liste
    blanche `typeAffichage`) ; la décision est prise AU RENDU, de façon synchrone, à partir de la ligne `files` passée à la carte ; sinon la
    carte sans photo ; aucune image générique, aucune photo IA substituée (B7).
  - **I-UI-6 Un appel = une réservation, avant tout téléchargement** (I-B10) ; chaque adresse d'un aperçu est validée AVANT la réservation ;
    une adresse refusée est rendue `{ url, image: null, raison: 'interdit' }` et ne prive pas les autres ; la réservation n'a lieu que s'il
    reste au moins une adresse admise (422 sans réservation sinon) ; le journal ne porte que des compteurs.
  - **I-UI-7 Versions.** Le premier lot FUSIONNÉ porte `APP_VERSION 0.16.0`, le second `0.17.0` ; pendant la construction UI-2 porte 0.16.0
    et UI-1 0.17.0 ; si l'ordre des fusions s'inverse, un commit de version renumérote le lot qui fusionne (schema.js, sw.js et les 13
    assertions + 1 commentaire des 8 suites : § 7). `sw.js` `cuisine-os-v0.1N.0-K`, +1 à chaque commit qui touche `src/`, `styles.css`,
    `index.html`, le manifeste ou `sw.js` (R-B-24) ; `SHELL` + `./src/ui/icones.js` (UI-1), + `./src/domain/apercu-web.js` (UI-2).

- **Les décisions du lot (spec § 0, copiées mot pour mot ; D-UI-12 à D-UI-14 sont UI-2 et ne valent pas ici) :**

  - **D-UI-1 Adapter, pas copier.** Les maquettes fixent la direction (crème, olive, grandes photos, titres serif généreux, filets fins au
    lieu de cartes à ombre) ; les parcours, les écrans, la navigation, les données et les libellés qui portent une règle du produit restent
    ceux de l'app. Rien n'est inventé pour ressembler à une image (§ 8).
  - **D-UI-2 L'olive devient la couleur d'action — ce qui renverse V-4 (§ 13, point 0).** `--action` passe de la tomate `#bc3026` à l'olive
    `#4f6b2e` (5,55 sur papier, 5,95 sur carte, 4,97 sur `--accent-bg`, 5,14 sur `--paper-2`), `--action-2` (survol) `#3e5424` (papier dessus
    7,72), `--action-bg` `#e9eddf` (gris `--muted` dessus 4,80, ambre 4,71), `--tap` `rgba(79,107,46,.15)`. Le vert gris des états
    (`--accent #45604a`, `--ok`) reste ; la brique `--danger` reste le seul rouge. V-2 et V-4 de la refonte visuelle sont amendés (§ 12).
    Règle vérifiable : un ÉTAT n'est jamais un bouton plein olive ni un texte olive (badge « Original », statut ok, puce cochée = vert gris,
    jamais `.btn.primary`) ; l'action (bouton plein, lien, onglet actif, anneau de focus) n'emprunte jamais le vert gris ; la galerie de la
    preuve visuelle montre un badge « Original » à côté d'un `.btn.primary` pour que l'œil les distingue (§ 7).
  - **D-UI-3 Titres plus grands, police système.** Titres de PAGE (`pageHeader` d'Aujourd'hui, Bibliothèque, Ajouter, Ma semaine, Ma
    cuisine, Réglages) : `h1` `clamp(1.8rem, 6vw, 3.2rem)` (1,8 rem à 375 et 390 px, 2,88 rem à 768 px, 3,2 rem à 1512 px) ; titres de
    FICHE (recette, livre : `h1.titre-fiche`, classe posée par l'option `classeTitre` de `pageHeader`) : `clamp(1.5rem, 4.5vw, 2.6rem)`
    (1,5 rem à 375 et 390 px, 2,16 rem à 768 px, 2,6 rem à 1512 px), pour qu'un titre long (« The Particular Sadness of Lemon Cake ») tienne en deux
    lignes à 375 px ; `h2` 1,6 rem ; titre de carte-plat en serif 1,3 rem ; `--serif` reste Georgia (la CSP n'admet aucune police externe
    et V-2 le veut ainsi). La barre haute garde 64 px et sa marque 44 px.
  - **D-UI-4 La bibliothèque s'ouvre sur les plats.** `#/library` gagne un troisième segment, **« Recettes »**, par défaut : la grille des
    recettes (deux colonnes dès 360 px, trois ≥ 900 px) en cartes-plat (D-UI-5), un champ « Une recette, un ingrédient… » qui filtre
    localement, les filtres **Toutes / De mes livres / Du web** calculés sur les données (`edition_id`, `source_url` ; une fiche qui a les
    deux est dans les deux), l'action principale « Ajouter une recette » (→ `#/add`) dans l'en-tête et, sous 760 px, répétée en bouton
    pleine largeur sous la grille (maquette mobile 01), et en pied « Recettes de mes livres à importer → » vers la liste des références.
    « Livres » (avec « Ajouter un livre ») et « Plats » gardent leurs écrans. L'entrée de navigation garde sa route `/library` et prend le
    libellé « Bibliothèque » (en.js « Library ») ; les retours « ← Mes livres » (recipe.js:88, book.js:121) et la carte d'accueil
    « Aller à Mes livres. » (accueil-livre.js:14) suivent (« ← Bibliothèque », « Aller à la bibliothèque. ») ; le segment « Mes livres » de
    la RECHERCHE (`MODES`, search.js:18) garde son libellé : il nomme une portée de recherche, pas l'écran.
  - **D-UI-5 La carte-plat.** `recipeCard(doc, { photoEnTete: true, fichier })` : l'appelant passe la ligne `files` lue en une fois
    (`repo.getFiles`), la carte décide au rendu, de façon synchrone, ne rend pas `vignettePlat` et ne lit rien elle-même (`fichier`
    est sa seule source d'image) ; QUAND `typeAffichage(fichier)` est une image (I-F6, I-UI-5), une image
    4:3 (`img.plat-vignette.grande`, `displayUrl(fichier, urlDeBlob)`) au-dessus du titre serif et d'une ligne « Du web · {hôte} · 35 min »
    ou « De mon livre · {titre} · 40 min » (durée = `total_minutes ?? prep + cook`, UN nombre par `formatMinutes`, jamais la paire
    « actif · total » ; rien sans durée) ; SANS photo, une seule forme : `a.item-link.carte-plat.sans-photo`, un bloc de titre serif sur
    `--paper-2` (même rayon 12, hauteur minimale 7 rem pour aligner les rangées), la même ligne de source dessous ; jamais de cadre vide ni
    d'image générique. L'image garde la classe `plat-vignette` (révocation D-T9). La carte horizontale actuelle reste le défaut partout
    ailleurs.
  - **D-UI-6 La fiche recette en deux colonnes.** ≥ 760 px : [en-tête : état, titre, provenance, « Voir la page d'origine ↗ », repères
    « 4 portions · 35 min », « Commencer à cuisiner » + « Corriger »] | [photo du plat, pleine largeur de colonne, 4:3] ; puis
    [Ingrédients] | [Préparation]. < 760 px : photo pleine largeur sous la provenance, repères, puis un `segmented` **Ingrédients /
    Préparation** (bascule locale, sans navigation ni appel), « Commencer à cuisiner » pleine largeur, « Corriger » en lien texte à côté
    tant que la version affichée n'est pas vérifiée (le seul geste que « — vérifie » et « {n} lignes à vérifier » réclament). Le −/+ des
    portions, Unités, Langue, le sélecteur de versions, « Créer ma version », « Adapter avec l'IA », repas, épicerie, plat passent sous un
    `details[data-role=autres-gestes]` « Portions, versions et autres gestes » (jamais « Réglages » : l'app a déjà un écran de ce
    nom) ; la rangée Export (recipe.js:204-208) reste en bas, inchangée. Le style inline 320 px de la photo disparaît. La bascule et l'ouverture du `details` suivent un `matchMedia('(min-width: 760px)')`
    injectable (`deps.matchMedia`, défaut `window.matchMedia`), écouté sur `change` : les deux sections sont toujours dans le DOM ; en
    large aucune n'a `hidden` et le `segmented` est `hidden` ; le choix mémorisé dans l'instance survit à `drawBody()`.
  - **D-UI-7 La fiche livre en deux colonnes.** ≥ 900 px (`div.two-col.livre`, `200px 1fr`, classe neuve) : gauche = `bookCover`
    ≈ 200 px, la section « Couverture » actuelle (`.card`, ses gestes inchangés : Télécharger, Réessayer, Photographier, Choisir),
    métadonnées repliées (`details` inchangé), « Sommaire » (vignettes des pages d'index) ; droite = `pageHeader` déjà passé (titre,
    sous-titre « {auteur} · {éditeur} · {année} » (ISBN et langue vivent dans le `details` Métadonnées), ACTIONS gardées en tête : les deux menus `details.menu-source` d'aujourd'hui,
    renommés « Ajouter des recettes » (Photographier / Choisir des photos ou un PDF ; plusieurs recettes à la fois = lot D) et « Ajouter des
    pages de sommaire »), les rappels, puis « Les recettes de ce livre » (sous son titre, `p.muted` « {n} disponible(s) · {m} à importer ») : filtres, liste COMPACTE
    « vignette 48 px (`.plat-vignette.petite`) si octets · titre · p. N ·
    badge » avec « Importer » (référence sans adresse) et « Saisir à la main » (même `href` qu'aujourd'hui) sur la ligne. < 900 px : la même
    chose empilée, la liste limitée à 8 lignes puis « Voir les {n} recettes » (déplie sur place, sans navigation) pour que les actions
    restent atteignables. Les trois chips d'état du menu disparaissent (la phrase du sous-titre les remplace) ; la vignette de la liste
    tient D-F9.
  - **D-UI-8 Les listes sur le papier, section par section.** `sectionPlain(title, ...children)` (fonction sœur de `section`, même forme, qui lui
    délègue) rend `section.plain` (sans fond ni ombre, `h2` serif, filet fin `--line` sous le titre) ; `section(title, ...children)` ne change
    pas et reste `section.card` (54 appelants dans 17 modules : rien ne
    change hors des sections nommées en § 4). Chaque tâche liste les sections qu'elle bascule et amende leurs tests (§ 7).
  - **D-UI-9 Icônes au trait.** Un module `src/ui/icones.js` de vingt-trois SVG inline monochromes (`currentColor`, `aria-hidden`, `icone(nom)`
    lève sur un nom inconnu) remplace les émojis de la navigation (`app.js`), de la grille Ajouter (`add.js:29-34`), de l'accueil d'un livre
    (`accueil-livre.js:12-14`) et des onze états vides (`emptyState`, § 3.3) ; les émojis restent dans les textes de contenu.
  - **D-UI-10 Libellés d'affichage.** « À importer » pour une référence sans adresse dans les listes, badges, compteurs et filtres
    (`availabilityBadge` porte ses propres textes courts : « À importer · p. {p} » ou « À importer », « Disponible », « Partielle »,
    « Lien web » ; dans `STATE_LABELS.availability` (i18n.js:27), seule `reference_only` change, → « À importer », suivie par les exports et
    Redécouvrir ; `available` et `partial` y restent « Recette disponible » et « Partiellement disponible ») ; « Repérée dans ton livre — page {p} » reste sur la fiche (il dit d'où elle vient) ;
    « Voir la page d'origine ↗ » (lien texte, même `data-role`) remplace « Ouvrir le lien » partout (fiche, bloc du signet, écran d'import
    web) sur TOUTE adresse lisible, `http:` compris (I-B5 : seule la LECTURE exige https) ; « Ajouter des recettes » et « Ajouter des pages
    de sommaire » remplacent « + Recette » et « + Pages d'index ». La phrase « Texte conservé dans Mitsu » de la rév. 1 est retirée (elle
    nommait la marque et doublait « — vérifie »). `availability` et les statuts du journal ne changent pas (doc 03 § 5).
  - **D-UI-11 La marque reste « Cuisine OS »** (titre, manifeste, icône, nom sur l'iPhone) : « mitsu » des maquettes est le nom du projet,
    pas celui de l'app ; à trancher par Neegan (§ 13).

## Review Focus

1. **Un nom d'icône hors du jeu lève, jamais une icône vide en silence** (D-UI-9) : `icone('inconnue')`, `icone('Soleil')`, `icone('constructor')`,
   `icone(undefined)` → `TypeError` ; `emptyState(String.fromCodePoint(0x1F6D2), …)`, `emptyState('caddie', …)` → levée ; les vingt-trois noms rendent un
   svg distinct `[aria-hidden=true][focusable=false][stroke=currentColor]` → tâche 1, `tests/carnet.js`, blocs « icônes » (« icone(nom) lève une TypeError
   sur un nom inconnu — casse comprise ; les clés héritées du prototype … », « exactement vingt-trois noms ») et « pageHeader, emptyState, sectionPlain »
   (« emptyState lève sur un émoji, sur un nom hors du jeu, sur rien »).
2. **La carte-plat décide au rendu, de façon synchrone, sur la ligne `files` passée, et ne lit rien** (D-UI-5, I-UI-5) : `fichier` nul, sans blob,
   `text/html` (mime ET blob : `typeAffichage` rend le type du blob s'il est dans la liste blanche, SINON celui de la ligne — un blob `text/html` sous un mime
   `image/jpeg` est affiché jpeg, règle F-9 du lot G), PDF, SVG → `a.item-link.carte-plat.sans-photo`, zéro `img`, bloc de titre ; octets `image/jpeg` → `img.plat-vignette.grande[src^=blob:]`
   au retour de l'appel ; pointeur valide sans `fichier` → aucune `img`, AUCUNE lecture `files` (espion sur `db.get` ET `db.getMany`) ; octets indécodables
   → `img` retirée, `.sans-photo`, URL révoquée → tâche 2, `tests/carnet.js`, bloc « recipeCard({ photoEnTete, fichier }) : décision synchrone, jamais de
   cadre vide, aucune lecture ».
3. **La grille est bornée et lit exactement ce qu'elle rend** (F-9, D-T9) : 70 recettes à photo → 60 cartes (les 60 dernières modifiées), EXACTEMENT 60
   lectures en UN `getFiles`, « Voir plus » en lit 10 de plus (70, aucune relecture), le redessin par le filtre révoque les 70 URL précédentes APRÈS le
   vidage et n'en relit aucune → tâche 2, bloc « grille bornée : 70 recettes à photo → 60 cartes et EXACTEMENT 60 lectures … ».
4. **« Corriger » reste visible tant que la version affichée n'est pas vérifiée ; la bascule Ingrédients / Préparation est locale** (D-UI-6, B-I-8, F-5) :
   version `to_verify` → `a.btn.link[data-role=corriger-tete]` après « Commencer à cuisiner », même `href` que celui du `details` ; version `verified` →
   aucun « Corriger » dans l'en-tête ; sous 760 px la tape « Préparation » bascule par `hidden` sans `location.hash` changé, sans `fetch`, sans redessin
   (mêmes nœuds), le choix survit à un « + » (`drawBody`), le `change` du `matchMedia` rouvre le `details` et montre les deux sections, une fiche retirée
   se désabonne → tâche 3, bloc « fiche recette (T3) : ordre du DOM, deux largeurs, onglets, autres gestes, repères, « Voir la page d’origine » » (assertions
   « version NON vérifiée → a.btn.link « Corriger » », « fiche VÉRIFIÉE → aucun « Corriger » dans l’en-tête », « la tape « Préparation » bascule par hidden
   — sans navigation, sans appel, sans redessin », « le choix « Préparation » est gardé »).
5. **« À importer » n'apparaît que pour `reference_only` SANS `source_url`** (D-UI-10, H-19) : huit combinaisons (`available`, `partial`, `reference_only`,
   `undefined` × `source_url` nul ou posé) → une seule porte « À importer » ; un signet dit « Lien web » ; `available` → « Disponible », `partial` →
   « Partielle » ; `label('availability', 'reference_only')` → « À importer », `available` et `partial` gardent leur libellé long → tâche 5,
   `tests/carnet.js`, bloc « T5 — libellés D-UI-10 … » (« « À importer » n’apparaît que pour reference_only SANS source_url (huit combinaisons) »,
   « STATE_LABELS.availability : seule reference_only change »).

---

### Task 1 : Fondations — jetons olive, typographie, `sectionPlain`, `pageHeader({ classeTitre })`, `icones.js`, NAV « Bibliothèque », pins 0.17.0

Spec § 9 tâche T1 ; D-UI-2 (olive = action, § 3.1), D-UI-3 (titres, § 3.2), D-UI-4 (libellé « Bibliothèque » et ses quatre sites : NAV, les deux
retours « ← Bibliothèque », « Aller à la bibliothèque. »), D-UI-8 (`sectionPlain`, § 3.3), D-UI-9 (`icones.js`, onze états vides, NAV ; la grille
Ajouter et l'accueil d'un livre restent à la tâche 5), § 3.3 (`pageHeader` + `classeTitre`, `.grid.livres`, `.two-col.livre`), § 5 (« Bibliothèque »
→ « Library », « Aller à la bibliothèque. » → « Go to the library. »), § 7 UI-1 T1 (épingles à amender : `tests/theme.js`, les 13 pins + 1 commentaire,
`MODULES_NEUFS`, SHELL), I-UI-4 (toute règle neuve respecte T-1, T-2, T-11 de `tests/theme.js`), I-UI-7 (`APP_VERSION 0.17.0`, `sw.js`
`cuisine-os-v0.17.0-1`, `SHELL` + `./src/ui/icones.js`), § 13 points 0 et 3 (olive et « Bibliothèque », confirmés le 23 octobre). Rien d'autre :
ni carte-plat (T2), ni fiche (T3, T4), ni Aujourd'hui / Ajouter (T5), ni preuve visuelle (T6). `search.js` ne change que d'UN littéral (l. 162, le nom
d'icône de son état vide : § 3.3 le nomme) — la carte web garde sa forme (`tests/recherche-web.js:1035`), aucune autre ligne de ce fichier n'est touchée.

**Files:**
- Modify: `styles.css` (321 lignes à `f3672be`) — l. 1 (commentaire « action tomate ») ; l. 10-12 et 25 (`--action`, `--action-2`, `--action-bg`,
  `--tap`) ; l. 52-53 (`h1` et sa règle `@media (min-width: 900px)`, remplacées par UNE formule `clamp()` + `h1.titre-fiche`) ; l. 54 (`h2`) ;
  après l. 55 (`header.stack h1 + p.muted`) ; l. 63 et 170 (commentaires « anneau tomate ») ; après l. 138 (`section.card`, `section.plain`,
  `section.plain > h2`) ; après l. 151 (`.grid.livres`) ; l. 279 (`.two-col.livre { 1fr }` dans le bloc 760 px) et après elle (`@media (min-width:
  900px) { .two-col.livre }`) ; l. 284 (`.step-num`) ; après l. 315 (`.icone`, `.empty .ico .icone`).
- Create: `src/ui/icones.js` (module FEUILLE : aucun import ; `NOMS_ICONES`, `icone(nom)` ; vingt-trois tracés).
- Modify: `src/ui/components.js` — après la l. 15 (`import { pointeurValide } from '../domain/photo-web.js';`, dernier import) : l'import de
  `./icones.js` ; l. 17-23 (`pageHeader` : option `classeTitre`) ; après l. 27 (`sectionPlain`) ; l. 29-31 (`emptyState` : nom d'icône).
- Modify: `src/app.js` — l. 15 (import de `./ui/icones.js` à côté de celui de `./ui/components.js`) ; l. 37-43 (`NAV` : libellé « Bibliothèque »,
  `ico` = noms d'icônes) ; l. 46 (`navLinks` : `icone(n.ico)`) ; l. 52 (la roue des Réglages du panneau latéral : `icone('roue')`). La barre haute
  (l. 54-60 : marque, pilule « ⌕ », bouton « ⚙︎ ») ne change pas (« rien d'autre », § 11 : `app.js` reste hors suite). **D-2 RATIFIÉ rév. 3** : la roue
  traitée par T1 est celle du panneau latéral (`app.js:52`) ; la pilule et le bouton de la barre haute (`app.js:59-60`) restent en texte.
- Modify (un littéral chacun, le premier argument d'`emptyState`) : `src/ui/library.js:53` (U+1F4DA → `'livres'`) et `:103` (U+1F35D →
  `'assiette'`) ; `src/ui/grocery.js:21` (U+1F6D2 → `'panier'`) ; `src/ui/meals.js:18` (U+1F37D → `'couverts'`) et `:79` (U+1F957 → `'salade'`) ;
  `src/ui/kitchen.js:30` (U+1F373 → `'toque'`) et `:75` (U+1F9CA → `'flocon'`) ; `src/ui/dish.js:43` (U+1F35D → `'assiette'`) ;
  `src/ui/book.js:176` (U+1F4D6 → `'livre-ouvert'`) ; `src/ui/search.js:162` (U+1F50D → `'loupe'`) ; `src/ui/import.js:68` (U+1F4F7 →
  `'appareil-photo'`). Onze sites, relevés par `grep -n "emptyState(" src/ui/*.js` (onze appels + la définition dans `components.js`).
- Modify (un littéral chacun) : `src/ui/recipe.js:88` et `src/ui/book.js:121` (`label: t('Mes livres')` → `label: t('Bibliothèque')`) ;
  `src/ui/accueil-livre.js:14` (`t('Aller à Mes livres.')` → `t('Aller à la bibliothèque.')`). Le segment `['books', 'Mes livres']` de
  `src/ui/search.js:18` (`MODES`) reste (D-UI-4 : une portée de recherche, pas l'écran).
- Modify: `src/i18n/en.js` — l. 4 (`'Bibliothèque': 'Library'` ajoutée après `'Mes livres': 'My books'`, qui reste) ; l. 232 (`"Aller à Mes
  livres.": "Go to My books."` → `"Aller à la bibliothèque.": "Go to the library."` : la chaîne retirée du source quitte `en.js`, § 5).
- Modify: `src/model/schema.js:6` (`APP_VERSION = '0.17.0'`) ; `sw.js:4` (`VERSION = 'cuisine-os-v0.17.0-1'`) et `sw.js:19` (`SHELL` +
  `'./src/ui/icones.js'`, entre `./src/ui/home.js` et `./src/ui/import-cible.js`).
- Test (Create): `tests/carnet.js` (`export async function runCarnetTests({ eq, ok })` ; 37 assertions au vert ; un repère de fin que T2 à T6
  étendent). Test (Modify): `tests/tests.js` (import après la l. 34 ; bloc avant le bloc du thème, l. 242 ; épingle l. 250).
- Test (Modify): `tests/theme.js` — l. 4 (`PAIRES` + 1), l. 27 (valeur `--action` + libellé), l. 93, 95, 96, 108, 110, 113 (libellés « tomate »
  → « olive »), l. 45 et 106 (commentaires « tomate »), l. 48 (libellé « 2px tomate ») — les deux derniers libellés ne sont pas dans la liste de
  § 7 T1 (qui dit 27, 93, 95, 96, 106, 108, 110, 113) : `grep -n tomate tests/theme.js` les rend aussi, ils sont renommés pour la même raison
  (amendement EI-T1-1, consigné dans `progress.md` ; **D-3 RATIFIÉ rév. 3** : `tests/theme.js` l. 45 et 48 renommées aussi).
- Test (Modify), les 13 pins + 1 commentaire, retrouvés par leur TEXTE : `tests/ajouter.js:3817, 3819` ; `tests/passerelle.js:765, 767` ;
  `tests/recherche-web.js:66 (commentaire), 69, 72` ; `tests/sync-l3.js:1867` ; `tests/sync-l4.js:514, 516, 3506-3507` ;
  `tests/assistant-compte.js:8` ; `tests/creer-ia.js:11` ; `tests/classement.js:2568` ; et `tests/ajouter.js:8` (`MODULES_NEUFS` +
  `'../src/ui/icones.js'`).

**Interfaces:**
- Consumes (existant, à relire au Step 0) : `el(tag, attrs, ...children)` (`src/core/dom.js:3-20` : `class` → `className`, `null` ignoré, un nœud
  enfant ajouté tel quel) ; `t()` (`src/core/i18n.js`) ; `pageHeader`, `section`, `emptyState` (`src/ui/components.js:17-31`) ; `carte(ico, …)`
  (`components.js:232-235`, qui accepte déjà un nœud comme `ico` : T5 s'en servira) ; `MODULES_NEUFS` (`tests/ajouter.js:8`, exporté) et son
  filet (`tests/ajouter.js:3786-3800` : `src.length > 300`, un `export`, ni `html:`, ni `innerHTML`, ni `window.open`) ; `tests/sync.js:977-…`
  (SHELL contre le graphe d'imports depuis `src/app.js`) ; `tests/theme.js:2, 4, 7-16, 24-30` (`JETONS`, `PAIRES`, `HEX3`, `lum`, `contraste`,
  `rgbVersHex`, `regles`, `declarations`, `hex` — NON exportés : `tests/carnet.js` recopie ces quelques lignes, par choix : les deux suites ne
  partagent aucun module) ; le lanceur `.superpowers/sdd/2026-10-23-experience-carnet/suite.cjs` (Chrome sans tête, fenêtre 1280 px : les
  mesures en `vw` et le `@media (min-width: 900px)` se calculent sur `window.innerWidth`, jamais sur un nombre figé).
- Produces (`src/ui/icones.js`, signatures exactes) :

```js
export const NOMS_ICONES = Object.freeze([...]) // les vingt-trois noms, dans l'ordre de la spec § 3.3 : 'soleil', 'bibliotheque', 'calendrier',
  // 'toque', 'plus', 'roue', 'livres', 'appareil-photo', 'crayon', 'lien', 'etincelle', 'flocon', 'page', 'horloge', 'panier', 'assiette',
  // 'couverts', 'salade', 'livre-ouvert', 'loupe', 'globe', 'personnes', 'image'
export function icone(nom) // → SVGSVGElement neuf : svg.icone.icone-<nom>[viewBox="0 0 24 24"][width=24][height=24][fill=none][stroke=currentColor]
  // [stroke-width=1.75][stroke-linecap=round][stroke-linejoin=round][aria-hidden=true][focusable=false] > path[d]+ ; lève TypeError sur un nom
  // inconnu (casse comprise, émoji compris, clé héritée du prototype comprise)
```

- Produces (`src/ui/components.js`, signatures exactes) :

```js
export function pageHeader(title, { subtitle = null, actions = [], back = null, classeTitre = null } = {}) // header.stack > [a.muted « ← {back.label} »]
  // + div.row.between.top > div > h1[.classeTitre] + [p.muted] ; [div.row > ...actions] ; back reste { href, label } ; rien d'autre ne change
export function section(title, ...children)       // inchangée : section.card > [h2] + ...children
export function sectionPlain(title, ...children)  // = section(title, ...children) avec className 'plain' à la place de 'card' (délègue à section)
export function emptyState(icon, text, action = null) // div.empty > div.ico > icone(icon) ; p > text ; [action] — `icon` est un NOM d'icones.js (lève sinon)
```

- Produces (`styles.css`, classes et règles que T2 à T6 posent ou mesurent) : `h1.titre-fiche` (posée par `pageHeader({ classeTitre:
  'titre-fiche' })`, T3 et T4) ; `section.plain`, `section.plain > h2` (T2 à T5 par `sectionPlain`) ; `section.card { margin-bottom: 1.6rem }` ;
  `header.stack h1 + p.muted` (VOULU : la règle touche aussi les deux en-têtes maison qui ont la forme de `pageHeader` — `import-web.js:391-396`, le
  `p.muted[data-role=hote]`, et `import-cible.js:666-670`, « {livre} · p. N » — même forme d'en-tête, même sous-titre à 1,05 rem ; aucun test ne mesure
  ces tailles ; une ligne de `progress.md` le dit, rév. 2) ; `.grid.livres` (T2 la pose sur la grille des couvertures, `booksTab`, l. 58 : `el('div',
  { class: 'grid livres' })`) ; `.two-col.livre` (T4 la pose sur la fiche livre : une colonne sous 900 px, `200px 1fr` au-dessus) ; `.icone` (24 × 24) et
  `.empty .ico .icone` (40 × 40) ; `.step-num` en `--paper-2` / `--ink`.
- Produces (`src/i18n/en.js`) : `EN['Bibliothèque'] === 'Library'`, `EN['Aller à la bibliothèque.'] === 'Go to the library.'`.
- Produces (`tests/carnet.js`) : `runCarnetTests({ eq, ok })`, câblée dans `tests/tests.js` avant le bloc du thème ; dedans, les aides `bloc(nom,
  f)`, `lire(chemin)`, `hex(jeton)`, `contraste(a, b)`, `rgbVersHex`, `regles(css)`, `declarations(corps)`, `regle(sel, media)` et le repère de fin
  `// --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette ligne ---` (T2 à T6 écrivent leurs blocs au-dessus, dans la
  fonction).

- [ ] **Step 0 : relevés et constats (aucune écriture dans `src/`).**
  1. Servir le worktree : `python3 -m http.server 8096 --bind 127.0.0.1` depuis `/Users/neeganmac/projects/mistu-carnet` (en arrière-plan, si
     ce n'est pas déjà fait : `curl -sS http://127.0.0.1:8096/tests/ | head -3`). Départ : `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096`
     (attendu `BILAN : ✅ 5948/5948`, seule erreur de console admise : le 404 de `/favicon.ico`), `node --test tools/*.test.mjs` (attendu 208/208),
     `node tools/generer-migrations.mjs --check` (attendu 0) ; `sed -n '250p' tests/tests.js` (épingle 5947), `sed -n '6p' src/model/schema.js`
     (`'0.15.0'`), `sed -n '4p' sw.js` (`cuisine-os-v0.15.0-9`), `sed -n '5p' src/model/schema.js` (`DB_VERSION = 4`). Consigner ces six chiffres
     dans `.superpowers/sdd/2026-10-23-experience-carnet/progress.md` (section « Tâche 1 — Départ »). Règle : **épingle = obtenu − 1**.
  2. Relevé des pins (depuis la racine du worktree) — attendu : exactement les quinze lignes de **Files** (13 assertions + 1 commentaire + `tests/sync-l4.js:3506`
     qui porte la regex de l'assertion 3507) ; toute ligne de plus est un amendement nommé (`progress.md`), pas un NEEDS_CONTEXT :

     ```bash
     python3 -I - 0.15.0 <<'PY'
     import glob, sys
     v = sys.argv[1]; v_echappee = v.replace('.', '\\.')
     for f in sorted(glob.glob('tests/*.js')):
         for i, l in enumerate(open(f, encoding='utf-8'), 1):
             if v in l or v_echappee in l:
                 print(f'{f}:{i}: {l.strip()[:160]}')
     PY
     ```

  3. Relire dans le code RÉEL : `sed -n '17,31p' src/ui/components.js` (la forme exacte de `pageHeader`, `section`, `emptyState`) ;
     `sed -n '37,62p' src/app.js` (`NAV`, `navLinks`, `shell`) ; `grep -n "emptyState(" src/ui/*.js` (onze appels, ceux de **Files**, plus la
     définition) ; `grep -n "Mes livres\|Aller à Mes livres" src/ui/*.js src/app.js src/i18n/en.js` (attendu, ONZE lignes à `f3672be` : `search.js:18`
     (MODES, reste), `recipe.js:88`, `book.js:97` (un commentaire, reste), `book.js:121`, `accueil-livre.js:14`, `library.js:1` et `:19` (deux
     commentaires, restent), `library.js:13` (le titre `pageHeader(t('Mes livres'), …)` : LAISSÉ à T2, qui réécrit tout l'en-tête — pas un site de T1),
     `app.js:39`, `en.js:4` (reste), `en.js:232`) ;
     `grep -n tomate tests/theme.js` (attendu : 45, 48, 93, 95, 96, 106, 108, 110, 113 — la l. 27 n'a pas le mot mais porte la valeur) ;
     `grep -n "emptyState\|\.empty\|'\.ico'" tests/*.js` (attendu : aucun test ne lit l'émoji d'un état vide ; `tests/ajouter.js:3735` lit le
     TEXTE de l'état vide des livres, qui ne change pas). Tout écart aux lignes citées se relit par le texte et se consigne (`progress.md`).
  4. Constat de forme (I-UI-4) : `tests/theme.js` lit la feuille sans ses commentaires (`sansCommentaires`, l. 11) — le mot « olive » est PERMIS
     dans un commentaire, JAMAIS dans une valeur (c'est une couleur nommée CSS, T-2, l. 38) ; aucun `display: none` neuf (T-1, l. 40-42) ;
     aucun `56px` hors `.btn.big` (T-11, l. 57) ; un survol seulement sous `@media (hover: hover)` (l. 59-60). Les règles du Step 4 ci-dessous
     ont été écrites sous ces quatre contraintes ; les relire avant de les poser.

- [ ] **Step 1 : tests rouges — `tests/carnet.js` (neuf, en entier).** Six blocs indépendants (`bloc()` : une levée dans un bloc rougit UNE ligne
  nommée et laisse les cinq autres tourner — tant que `src/ui/icones.js` n'existe pas, les blocs « icônes » et la fin de « rendu » rougissent par
  leur nom, et les autres assertions se lisent une à une). Aucune base, aucun réseau, aucun écran monté : des composants seuls, la feuille lue
  (texte) et mesurée (scène hors écran). Les aides de `tests/theme.js` sont recopiées (elles n'y sont pas exportées). Un émoji de test est écrit
  par `String.fromCodePoint`, jamais en littéral.

```js
// Tests du lot UI-1 « Carnet » (spec docs/superpowers/specs/2026-10-23-experience-carnet-design.md, § 7 « Tests neufs »). Tâche 1 : jetons olive
// et la paire neuve, typographie (une formule clamp() par titre), sectionPlain, pageHeader({ classeTitre, back }), icones.js (vingt-trois noms,
// aria-hidden, currentColor, levée sur un nom inconnu), emptyState à nom d'icône, et les filets de source du lot (onze états vides, NAV, retours,
// en.js, SHELL). La feuille est LUE (texte, sans commentaires) et MESURÉE (scène hors écran, feuille injectée le temps du bloc), jamais recopiée.
// Aucune base, aucun réseau, aucun écran monté : des composants seuls. Les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS du repère de fin.
import { MODULES_NEUFS } from './ajouter.js';

export async function runCarnetTests({ eq, ok }) {
  const bloc = async (nom, f) => { try { await f(); } catch (error) { ok(false, `Carnet — bloc « ${nom} » interrompu : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); } };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const C = await import('../src/ui/components.js');
  let I = null; // le module d'icônes : absent tant que la tâche 1 ne l'a pas posé — les blocs qui en dépendent rougissent alors par leur nom
  try { I = await import('../src/ui/icones.js'); } catch { I = null; }
  const v = Date.now();
  const css = (await lire('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  // Aides recopiées de tests/theme.js (non exportées là-bas ; les deux suites ne partagent aucun module).
  const HEX3 = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
  const lum = (hex) => { const h = HEX3(hex); const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contraste = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const rgbVersHex = (rgb) => { const m = (rgb || '').match(/\d+/g); return m ? '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : null; };
  const racine = css.match(/(?:^|\n)\s*:root\s*\{([^}]*)\}/)?.[1] || '';
  const jetons = Object.fromEntries([...racine.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const hex = (j) => { let x = jetons[j]; for (let i = 0; i < 5 && x && x.startsWith('var('); i++) x = jetons[x.slice(4, -1).trim()]; return /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(x || '') ? HEX3(x.toLowerCase()) : null; };
  // Les règles dans l'ordre des sources, avec leur @media (la feuille n'a qu'un niveau d'imbrication) ; regle(sel, media) rend la DERNIÈRE qui porte ce sélecteur.
  const regles = (texte) => { const out = []; const pile = []; let sel = null; let debut = 0; for (let i = 0; i < texte.length; i++) { if (texte[i] === '{') { const tete = texte.slice(debut, i).trim(); if (tete.startsWith('@')) pile.push(tete); else sel = tete.replace(/\s+/g, ' '); debut = i + 1; } else if (texte[i] === '}') { if (sel !== null) { out.push({ sel, corps: texte.slice(debut, i), media: pile.length ? pile[pile.length - 1] : null }); sel = null; } else pile.pop(); debut = i + 1; } } return out; };
  const declarations = (corps) => Object.fromEntries(corps.split(';').filter((d) => d.includes(':')).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
  const R = regles(css);
  const regle = (sel, media = null) => { const r = R.filter((x) => x.sel === sel && x.media === media).pop(); return r ? declarations(r.corps) : null; };
  const { el } = await import('../src/core/dom.js');
  const NOMS = ['soleil', 'bibliotheque', 'calendrier', 'toque', 'plus', 'roue', 'livres', 'appareil-photo', 'crayon', 'lien', 'etincelle', 'flocon', 'page', 'horloge', 'panier', 'assiette', 'couverts', 'salade', 'livre-ouvert', 'loupe', 'globe', 'personnes', 'image'];

  // --- Tâche 1 — jetons (D-UI-2, § 3.1) : les quatre valeurs de l'olive, les huit contrastes de la table, plus aucune tomate.
  await bloc('jetons', async () => {
    eq([jetons['--action'], jetons['--action-2'], jetons['--action-bg'], jetons['--tap']], ['#4f6b2e', '#3e5424', '#e9eddf', 'rgba(79,107,46,.15)'], 'D-UI-2 : --action, --action-2, --action-bg et --tap sont l’olive (§ 3.1) ; les 25 autres jetons restent épinglés par tests/theme.js');
    const c = (a, b) => Number(contraste(hex(a), hex(b)).toFixed(2));
    eq([c('--action', '--paper'), c('--action', '--card'), c('--action', '--accent-bg'), c('--action', '--paper-2'), c('--action-2', '--paper'), c('--muted', '--action-bg'), c('--action', '--action-bg'), c('--warn', '--action-bg')], [5.55, 5.95, 4.97, 5.14, 7.72, 4.8, 5.08, 4.71], 'D-UI-2 : les huit contrastes de § 3.1, recalculés par la formule de theme.js (olive sur papier, carte, accent-bg et paper-2 ; survol sur papier ; gris, olive et ambre sur action-bg)');
    eq([css.includes('#bc3026'), css.includes('#98231b'), css.includes('#f7e3e0'), /rgba\(188,\s*48,\s*38/.test(css)], [false, false, false, false], 'D-UI-2 : plus aucune tomate dans la feuille servie (ni #bc3026, ni #98231b, ni #f7e3e0, ni rgba(188,48,38,…))');
  });

  // --- Tâche 1 — règles de la feuille (texte) : où vivent .two-col.livre, .grid.livres, section.plain, les titres, .step-num.
  await bloc('règles de la feuille', async () => {
    eq(regle('.two-col.livre', '@media (min-width: 900px)')?.['grid-template-columns'], '200px 1fr', 'D-UI-7 / F-17 : .two-col.livre = 200px 1fr sous @media (min-width: 900px)');
    eq(regle('.two-col.livre', '@media (min-width: 760px)')?.['grid-template-columns'], '1fr', 'D-UI-7 : sous 900 px la fiche livre reste EMPILÉE — .two-col.livre = 1fr dans le bloc 760 px (sans elle, .two-col y ferait deux colonnes de 760 à 899 px)');
    eq([regle('.two-col')?.['grid-template-columns'], regle('.two-col', '@media (min-width: 760px)')?.['grid-template-columns'], regle('.two-col.narrow-left', '@media (min-width: 760px)')?.['grid-template-columns'], regle('.two-col.livre')], ['1fr', '1fr 1fr', '320px 1fr', null], 'F-17 : .two-col (760 px) et .two-col.narrow-left inchangées ; .two-col.livre n’a aucune règle hors @media');
    eq([regle('.grid.livres')?.['grid-template-columns'], regle('.grid')?.['grid-template-columns']], ['repeat(auto-fill, minmax(170px, 1fr))', 'repeat(auto-fill, minmax(150px, 1fr))'], '§ 3.3 : .grid.livres minmax(170px, 1fr) ; .grid intacte');
    const plain = regle('section.plain');
    eq([plain?.['box-shadow'], plain?.padding, plain?.['margin-bottom'], regle('section.plain > h2')?.['border-bottom']], ['none', '0', '1.6rem', '1px solid var(--line)'], 'D-UI-8 : section.plain sans ombre ni marge intérieure, 1,6 rem sous elle ; filet fin --line sous son h2');
    eq([regle('h1')?.['font-size'], regle('h1.titre-fiche')?.['font-size'], R.filter((r) => r.sel === 'h1' && r.media).length, regle('h2')?.['font-size'], regle('h3')?.['font-size'], regle('header.stack h1 + p.muted')?.['font-size']], ['clamp(1.8rem, 6vw, 3.2rem)', 'clamp(1.5rem, 4.5vw, 2.6rem)', 0, '1.6rem', '1.15rem', '1.05rem'], 'D-UI-3 / § 3.2 / H-6 : UNE formule clamp() par titre, plus aucune règle h1 sous @media ; h2 1,6 rem, h3 1,15 rem, sous-titre de page 1,05 rem');
    eq([regle('.step-num')?.background, regle('.step-num')?.color], ['var(--paper-2)', 'var(--ink)'], '§ 3.2 : .step-num en --paper-2 / --ink (le cercle beige des maquettes)');
  });

  // --- Tâche 1 — composants (DOM seul) : pageHeader({ classeTitre, back }), emptyState(nom), sectionPlain / section.
  await bloc('pageHeader, emptyState, sectionPlain', async () => {
    const tete = C.pageHeader('The Particular Sadness of Lemon Cake', { subtitle: 'Aimee Bender · Doubleday · 2010', back: { href: '/library', label: 'Bibliothèque' }, classeTitre: 'titre-fiche' });
    const h1 = tete.querySelector('h1'); const retour = tete.querySelector('a');
    eq([tete.tagName, tete.className, h1?.className, h1?.textContent, retour?.getAttribute('href'), retour?.textContent, tete.querySelector('h1 + p.muted')?.textContent], ['HEADER', 'stack', 'titre-fiche', 'The Particular Sadness of Lemon Cake', '#/library', '← Bibliothèque', 'Aimee Bender · Doubleday · 2010'], 'pageHeader : classeTitre pose la classe sur le h1 (H-20) ; back reste un objet { href, label } (H-1) ; le sous-titre suit le h1');
    const page = C.pageHeader('Bibliothèque', { subtitle: 'Tes livres, tes trouvailles, tes recettes.' });
    eq([page.querySelector('h1')?.hasAttribute('class'), page.querySelector('h1')?.className, page.querySelector('a'), page.querySelectorAll('.row.between.top > div').length], [false, '', null, 1], 'pageHeader sans classeTitre ni back : un h1 nu (titre de PAGE), aucun lien de retour, aucune rangée d’actions — rien d’autre ne change');
    const action = el('a', { class: 'btn primary', href: '#/add' }, 'Ajouter une recette');
    const vide = C.emptyState('panier', 'Aucun ingrédient structuré dans ces recettes.', action);
    const ico = vide.querySelector('.ico');
    eq([vide.className, ico?.children.length, ico?.firstElementChild?.tagName.toLowerCase(), ico?.firstElementChild?.classList.contains('icone-panier'), ico?.textContent, vide.querySelector('p')?.textContent, vide.lastElementChild === action], ['empty', 1, 'svg', true, '', 'Aucun ingrédient structuré dans ces recettes.', true], 'D-UI-9 : emptyState prend un NOM d’icône — .ico porte le svg du jeu et aucun texte ; le texte et l’action suivent');
    const leve = (f) => { try { f(); return false; } catch { return true; } };
    eq([leve(() => C.emptyState(String.fromCodePoint(0x1F6D2), 'x')), leve(() => C.emptyState('caddie', 'x')), leve(() => C.emptyState(undefined, 'x'))], [true, true, true], 'D-UI-9 : emptyState lève sur un émoji, sur un nom hors du jeu, sur rien — aucun état vide ne garde un émoji en silence');
    const sp = C.sectionPlain('Ingrédients', el('ul', { class: 'list plain' }, el('li', null, '400 g de spaghetti')), el('p', { class: 'muted' }, 'x'));
    eq([sp.tagName, sp.className, sp.children.length, sp.firstElementChild?.tagName, sp.firstElementChild?.textContent, sp.children[1]?.tagName, sp.children[2]?.className], ['SECTION', 'plain', 3, 'H2', 'Ingrédients', 'UL', 'muted'], 'D-UI-8 / H-2 : sectionPlain(title, ...children) rend section.plain, h2 puis ses enfants dans l’ordre (la forme de section)');
    const sc = C.section('Ingrédients', el('p', null, 'x')); const sansTitre = C.sectionPlain(null, el('p', null, 'seul'));
    eq([sc.className, sc.firstElementChild?.tagName, sc.children.length, sansTitre.firstElementChild?.tagName, sansTitre.className], ['card', 'H2', 2, 'P', 'plain'], 'D-UI-8 : section() reste .card (54 appelants intacts) ; sectionPlain sans titre = aucun h2, toujours .plain');
  });

  // --- Tâche 1 — icônes (DOM seul) : vingt-trois noms, la forme de chaque svg, levée sur un nom inconnu.
  await bloc('icônes', async () => {
    const { icone, NOMS_ICONES } = I; // module absent : TypeError, le bloc rougit par son nom
    eq([Object.isFrozen(NOMS_ICONES), NOMS_ICONES.length, [...NOMS_ICONES].sort()], [true, 23, [...NOMS].sort()], 'D-UI-9 / K-3 : exactement vingt-trois noms, ceux de la spec § 3.3, gelés');
    const NS = 'http://www.w3.org/2000/svg';
    const forme = (n) => { const s = icone(n); const traces = [...s.children]; return [s.namespaceURI, s.tagName.toLowerCase(), s.getAttribute('viewBox'), s.getAttribute('width'), s.getAttribute('height'), s.getAttribute('aria-hidden'), s.getAttribute('focusable'), s.getAttribute('fill'), s.getAttribute('stroke'), s.classList.contains('icone') && s.classList.contains('icone-' + n), traces.length >= 1 && traces.every((p) => p.namespaceURI === NS && p.tagName === 'path' && /^M[\d.\s,a-zA-Z-]+$/.test(p.getAttribute('d') || ''))]; };
    const FORME = [NS, 'svg', '0 0 24 24', '24', '24', 'true', 'false', 'none', 'currentColor', true, true];
    eq(NOMS.map((n) => [n, ...forme(n)]), NOMS.map((n) => [n, ...FORME]), 'D-UI-9 / § 3.3 : chaque icône = svg[aria-hidden=true][focusable=false] 24 × 24, viewBox 0 0 24 24, fill none, stroke currentColor, classes icone + icone-<nom>, des <path d> au trait');
    eq(new Set(NOMS.map((n) => icone(n).innerHTML)).size, 23, 'D-UI-9 : vingt-trois tracés DISTINCTS (aucune icône recopiée d’une autre)');
    // La levée ATTENDUE porte son message (« icône inconnue : … ») : un `nom in TRACES` laisserait passer 'constructor' et lèverait AUTRE chose (« is not iterable »,
    // une TypeError aussi) — le message tranche (rév. 2, mutant 8).
    const leve = (f) => { try { f(); return false; } catch (e) { return e instanceof TypeError && /icône inconnue/.test(e.message); } };
    eq([leve(() => icone('inconnue')), leve(() => icone('')), leve(() => icone('Soleil')), leve(() => icone('constructor')), leve(() => icone('toString')), leve(() => icone(undefined)), leve(() => icone(null)), leve(() => icone(7))], [true, true, true, true, true, true, true, true], 'D-UI-9 : icone(nom) lève une TypeError « icône inconnue : … » sur un nom inconnu — casse comprise ; les clés héritées du prototype (constructor, toString) ne sont pas des icônes (Object.hasOwn, pas `in`)');
    ok(icone('plus') !== icone('plus') && icone('plus').isEqualNode(icone('plus')), 'icone() rend un nœud NEUF à chaque appel, identique au précédent (une icône par site, jamais un nœud déplacé)');
  });

  // --- Tâche 1 — rendu (feuille injectée, scène hors écran de 980 px) : titres, sections, .step-num, grilles ; puis les icônes (tailles, couleur héritée, tracés).
  await bloc('rendu : typographie, sections, grilles, icônes', async () => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../styles.css?v=' + v;
    await new Promise((r) => { link.onload = r; link.onerror = r; document.head.append(link); });
    const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-9999px;top:0;width:980px'; document.body.append(scene);
    try {
      const S = (n) => getComputedStyle(n);
      const taille = (n) => Number(parseFloat(S(n).fontSize).toFixed(1));
      // Attendu CALCULÉ sur la fenêtre réelle (vw = 1 % de window.innerWidth) : la même assertion vaut à 390, 768, 1280 ou 1512 px de fenêtre.
      const clamp = (min, vw, max) => Number(Math.min(max, Math.max(min, (vw / 100) * window.innerWidth)).toFixed(1));
      const tete = C.pageHeader('Bibliothèque', { subtitle: 'Tes livres, tes trouvailles, tes recettes.' });
      const fiche = C.pageHeader('The Particular Sadness of Lemon Cake', { classeTitre: 'titre-fiche' }); scene.append(tete, fiche);
      eq([taille(tete.querySelector('h1')), taille(fiche.querySelector('h1'))], [clamp(28.8, 6, 51.2), clamp(24, 4.5, 41.6)], `D-UI-3 : h1 de page = clamp(1.8rem, 6vw, 3.2rem), h1.titre-fiche = clamp(1.5rem, 4.5vw, 2.6rem), mesurés à ${window.innerWidth} px de fenêtre (1,8 / 1,5 rem à 375 et 390 px, 2,88 / 2,16 à 768, 3,2 / 2,6 à 1512)`);
      const h2 = el('h2', null, 'Ingrédients'); const h3 = el('h3', null, 'Titre'); scene.append(h2, h3);
      eq([taille(h2), taille(h3), taille(tete.querySelector('p.muted'))], [25.6, 18.4, 16.8], '§ 3.2 : h2 1,6 rem, h3 1,15 rem, sous-titre de pageHeader 1,05 rem (mesurés, racine 16 px)');
      // Les sections sont construites À LA MAIN ici : ce bloc mesure la FEUILLE (section.plain / section.card) ; la fonction sectionPlain est éprouvée au bloc « composants ».
      const sp = el('section', { class: 'plain' }, el('h2', null, 'Préparation'), el('p', null, 'x')); const sc = el('section', { class: 'card' }, el('h2', null, 'Photo du plat'), el('p', null, 'x')); const carte = el('div', { class: 'card' }, 'x'); scene.append(sp, sc, carte);
      eq([S(sp).backgroundColor, S(sp).boxShadow, S(sp).borderTopWidth, S(sp).paddingLeft, S(sp).marginBottom, S(sp).scrollMarginTop], ['rgba(0, 0, 0, 0)', 'none', '0px', '0px', '25.6px', '72px'], 'D-UI-8 : section.plain sur le papier (ni fond, ni ombre, ni bord, ni marge intérieure), 1,6 rem sous elle, même scroll-margin que .card (mesurés)');
      const h2p = sp.querySelector('h2');
      eq([S(h2p).borderBottomWidth, rgbVersHex(S(h2p).borderBottomColor), /georgia/i.test(S(h2p).fontFamily), S(h2p).marginTop], ['1px', hex('--line'), true, '0px'], 'D-UI-8 : le h2 d’une section plain = serif, filet fin --line dessous, sans marge haute (mesurés)');
      eq([S(sc).marginBottom, rgbVersHex(S(sc).backgroundColor), S(sc).boxShadow !== 'none', S(carte).marginBottom], ['25.6px', hex('--card'), true, '14.4px'], '§ 3.2 / R-VIS-14 : section.card espacée de 1,6 rem et toujours une carte (fond, ombre) ; un div.card garde ses .9 rem — .card ne change pas');
      const num = el('span', { class: 'step-num' }, '3'); scene.append(num);
      eq([rgbVersHex(S(num).backgroundColor), rgbVersHex(S(num).color)], [hex('--paper-2'), hex('--ink')], '§ 3.2 : .step-num = cercle --paper-2, chiffre --ink (mesurés)');
      const pistes = (n) => S(n).gridTemplateColumns.split(' ');
      const livre = el('div', { class: 'two-col livre' }, el('div', null, 'g'), el('div', null, 'd')); const deux = el('div', { class: 'two-col' }, el('div', null, 'g'), el('div', null, 'd')); scene.append(livre, deux);
      eq([pistes(livre).length, pistes(livre)[0], pistes(deux).length], window.innerWidth >= 900 ? [2, '200px', 2] : [1, '980px', window.innerWidth >= 760 ? 2 : 1], `D-UI-7 : .two-col.livre = 200px | le reste à ≥ 900 px, une seule colonne en dessous ; .two-col inchangée (fenêtre ${window.innerWidth} px, scène 980 px)`);
      const gl = el('div', { class: 'grid livres' }, ...Array.from({ length: 8 }, () => el('div', null, 'c'))); const g = el('div', { class: 'grid' }, ...Array.from({ length: 8 }, () => el('div', null, 'c'))); scene.append(gl, g);
      eq([pistes(gl).length, pistes(g).length], [5, 6], '§ 3.3 : .grid.livres (minmax 170 px) fait 5 colonnes à 980 px là où .grid (150 px) en fait 6 (mesurés)');
      // Icônes : tailles, couleur héritée, tracés. nav.tabs est display:none à ≥ 900 px : le style en ligne la montre (comme tests/theme.js, l. 69).
      const { icone, NOMS_ICONES } = I; // module absent : TypeError, le reste du bloc rougit par son nom
      const nav = el('nav', { class: 'tabs', style: { position: 'static', display: 'flex' } },
        el('a', { href: '#/library', class: 'active' }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('bibliotheque')), el('span', null, 'Bibliothèque')),
        el('a', { href: '#/add', class: 'add' }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('plus')), el('span', null, 'Ajouter')));
      const vide = C.emptyState('panier', 'Rien.'); const seul = el('span', null, icone('horloge')); scene.append(nav, vide, seul);
      const dims = (s) => [S(s).width, S(s).height];
      eq([dims(seul.firstElementChild), dims(vide.querySelector('svg')), dims(nav.querySelector('a.active svg'))], [['24px', '24px'], ['40px', '40px'], ['24px', '24px']], '§ 3.3 : une icône mesure 24 × 24 ; 40 × 40 dans un état vide (mesurés)');
      // Chromium rend le stroke RÉSOLU (rgb) ; s'il gardait le mot currentcolor, la couleur calculée du path fait foi : dans les deux cas, l'icône suit son texte.
      const couleur = (p) => { const s = S(p).stroke.toLowerCase(); return s === 'currentcolor' ? rgbVersHex(S(p).color) : rgbVersHex(s); };
      eq([couleur(nav.querySelector('a.active path')), couleur(nav.querySelector('a.add path'))], [hex('--action'), hex('--paper')], 'D-UI-9 : le trait suit la couleur du texte — olive sur l’onglet actif, papier dans la pastille « Ajouter » (currentColor, mesuré)');
      const fautes = [];
      for (const n of NOMS_ICONES) {
        const s = icone(n); scene.append(s);
        for (const p of s.querySelectorAll('path')) { const b = p.getBBox(); if (!(p.getTotalLength() > 0) || b.x < -0.01 || b.y < -0.01 || b.x + b.width > 24.01 || b.y + b.height > 24.01) fautes.push(`${n} : d « ${(p.getAttribute('d') || '').slice(0, 40)} » (longueur ${p.getTotalLength().toFixed(1)}, boîte ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}×${b.height.toFixed(1)})`); }
      }
      eq(fautes, [], 'D-UI-9 : chaque tracé des vingt-trois icônes se dessine (longueur > 0) et tient dans la boîte 0 0 24 24 (mesuré)');
    } finally { scene.remove(); link.remove(); }
  });

  // --- Tâche 1 — sources (filets) : les états vides, NAV, les trois retours, en.js, SHELL et MODULES_NEUFS. app.js reste hors suite (§ 11) : seul son texte se relit.
  await bloc('sources : états vides, NAV, retours, en.js, SHELL', async () => {
    // D-UI-9 : par module, l'ENSEMBLE (trié) des noms d'icône de ses emptyState, et aucun nom hors du jeu (un émoji resté y tomberait) — un ensemble, pas la
    // liste ordonnée : T2 ajoute deux emptyState('assiette', …) à library.js (recettesTab, aImporterTab) sans toucher ce filet ; onze sites à f3672be.
    const SITES = { 'library.js': ['assiette', 'livres'], 'grocery.js': ['panier'], 'meals.js': ['couverts', 'salade'], 'kitchen.js': ['flocon', 'toque'], 'dish.js': ['assiette'], 'book.js': ['livre-ouvert'], 'search.js': ['loupe'], 'import.js': ['appareil-photo'] };
    const releve = {}; const horsJeu = [];
    for (const f of Object.keys(SITES)) { const src = await lire('../src/ui/' + f); const noms = [...src.matchAll(/\bemptyState\(\s*'([^']*)'/g)].map((m) => m[1]); releve[f] = [...new Set(noms)].sort(); horsJeu.push(...noms.filter((n) => !NOMS.includes(n)).map((n) => `${f} : ${n}`)); }
    eq([releve, horsJeu], [SITES, []], 'D-UI-9 / § 3.3 : chaque module porte l’ENSEMBLE de noms d’icône attendu pour ses états vides (onze sites à f3672be ; T2 en ajoute deux à library.js) et aucun nom hors du jeu — plus aucun émoji');
    const app = await lire('../src/app.js');
    const nav = [...app.matchAll(/\{ href: '([^']+)', label: '([^']+)', ico: '([^']+)'/g)].map((m) => m.slice(1, 4));
    eq([nav, app.includes("from './ui/icones.js'"), app.includes("icone('roue')"), app.includes('Mes livres'), /ico: '[^a-z]/.test(app)], [[['/', 'Aujourd’hui', 'soleil'], ['/library', 'Bibliothèque', 'bibliotheque'], ['/meals', 'Ma semaine', 'calendrier'], ['/kitchen', 'Ma cuisine', 'toque'], ['/add', 'Ajouter', 'plus']], true, true, false, false], 'D-UI-4 / D-UI-9 : NAV = cinq entrées, libellé « Bibliothèque », des noms d’icônes du jeu (plus un émoji), la roue des Réglages aussi (source relu : app.js est hors suite, § 11)');
    const [recipe, book, accueil, search] = await Promise.all(['recipe.js', 'book.js', 'accueil-livre.js', 'search.js'].map((f) => lire('../src/ui/' + f)));
    eq([(recipe.match(/label: t\('Bibliothèque'\)/g) || []).length, (book.match(/label: t\('Bibliothèque'\)/g) || []).length, recipe.includes("t('Mes livres')"), book.includes("t('Mes livres')"), accueil.includes("t('Aller à la bibliothèque.')"), accueil.includes('Aller à Mes livres.'), search.includes("['books', 'Mes livres']")], [1, 1, false, false, true, false, true], 'D-UI-4 / B-M-9 : « ← Bibliothèque » sur la fiche recette et la fiche livre, « Aller à la bibliothèque. » à l’accueil d’un livre ; le segment « Mes livres » de la RECHERCHE (une portée, pas l’écran) reste');
    const { EN } = await import('../src/i18n/en.js');
    eq([EN['Bibliothèque'], EN['Aller à la bibliothèque.'], 'Aller à Mes livres.' in EN, EN['Mes livres']], ['Library', 'Go to the library.', false, 'My books'], '§ 5 : en.js porte « Library » et « Go to the library. », a perdu « Go to My books. » (chaîne retirée du source) et garde « My books » (segment de la recherche)');
    const sw = await lire('../sw.js');
    eq([sw.includes("'./src/ui/icones.js'"), MODULES_NEUFS.includes('../src/ui/icones.js')], [true, true], 'I-UI-7 / § 7 T1 : ./src/ui/icones.js dans SHELL (sw.js) et dans le filet i18n MODULES_NEUFS (tests/ajouter.js:8)');
  });

  // --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette ligne ---
}
```

  Compte au vert : 3 + 7 + 6 + 5 + 11 + 5 = **37 assertions**.

- [ ] **Step 2 : tests rouges — câblage et amendements des suites existantes** (§ 7 UI-1 T1 ; chaque ligne retrouvée par son TEXTE, jamais par
  son numéro seul).
  1. `tests/tests.js` : après la l. 34 (`import { runPhotoPlatTests } from './photo-plat.js';`) :

     ```js
     import { runCarnetTests } from './carnet.js';
     ```

     et, juste AVANT le bloc du thème (`// --- Thème « magazine culinaire » …`, l. 242) :

     ```js
     // --- Lot UI-1 « Carnet » : jetons olive, typographie, sectionPlain, pageHeader({ classeTitre }), icônes au trait, états vides ; T2 à T6 y ajoutent leurs blocs.
     try { await runCarnetTests({ eq, ok }); }
     catch (error) { ok(false, `Suite carnet interrompue : ${error?.message || String(error)}`); }

     ```

     L'épingle (l. 250, `eq(results.length, 5947,…`) ne bouge PAS ici : elle rougit, c'est voulu ; elle est relevée au Step 9.
  2. `tests/theme.js` :
     - l. 4, `PAIRES` : avant le `]` final, ajouter `, ['--action', '--paper-2', 'olive sur --paper-2 (D-UI-2 : lien ou bouton sur un bloc beige, carte-plat sans photo)']`
       (la 29e paire : 5,14 ; les trois autres paires de l'olive y sont déjà : papier, carte, accent-bg). Les 28 autres restent ≥ 4,5 : minimum 4,62
       (ambre sur accent-bg, R-VIS-13), inchangé.
     - l. 27 : `['#f8f5ef', '#bc3026', '#242821', '#45604a', '#8b5f10', '#636860']` → `['#f8f5ef', '#4f6b2e', '#242821', '#45604a', '#8b5f10', '#636860']` et le libellé
       `'thème : jetons de la direction 01 (revus R4 ; --warn R-VIS-13 : ambre sur accent-bg 4,49 → 4,62)'` → `'thème : jetons de la direction 01, l’action passée à l’olive (D-UI-2 : --action #4f6b2e, 5,55 sur papier, 5,95 sur carte ; --warn R-VIS-13 : ambre sur accent-bg 4,49 → 4,62)'`.
     - l. 45 (commentaire) : `l'anneau global (2 px tomate décalé 2 px)` → `l'anneau global (2 px olive décalé 2 px)`.
     - l. 48 (libellé) : `:focus-visible = 2px tomate décalé 2px` → `:focus-visible = 2px olive (--action) décalé 2px`.
     - l. 93 : `'badges : .badge.ai en tomate'` → `'badges : .badge.ai en olive (--action, D-UI-2)'`.
     - l. 95 : `'T-5/T-8 : champ focalisé = anneau tomate, 16 px minimum (iOS ne zoome pas)'` → `'T-5/T-8 : champ focalisé = anneau olive, 16 px minimum (iOS ne zoome pas)'`.
     - l. 96 : `contour du champ tomate en plus de l’anneau` → `contour du champ olive en plus de l’anneau`.
     - l. 106 (commentaire) : `montrent l'anneau tomate` → `montrent l'anneau olive`.
     - l. 108 : `'T-5 : .btn.active focalisé = anneau tomate, pas le contour vert d’état (calculé)'` → `'T-5 : .btn.active focalisé = anneau olive (--action), pas le contour vert gris d’état (calculé)'`.
     - l. 110 : `anneau tomate rentré de 3 px` → `anneau olive rentré de 3 px` ; l. 113 : idem (`anneau tomate rentré de 3 px` → `anneau olive rentré de 3 px`).
     Après ces éditions : `grep -c tomate tests/theme.js` rend 0 (les assertions sur `hex('--action')` restent, renommées : spec § 7 T1).
  3. Pins de version (I-UI-7 : UI-1 porte `0.17.0` ; si UI-2 fusionne après, un commit de version renumérote). Le même motif partout : `v0\.15\.0`
     → `v0\.17\.0`, `'0.15.0'` → `'0.17.0'`, « lot F, plats en images » → « lot UI-1, carnet » :
     - `tests/ajouter.js:3817` : `ok(/VERSION = 'cuisine-os-v0\.17\.0-\d+'/.test(sw), 'sw.js : VERSION 0.17.0');`
     - `tests/ajouter.js:3819` : `eq(APP_VERSION, '0.17.0', 'APP_VERSION 0.17.0 (lot UI-1, carnet)');`
     - `tests/passerelle.js:765` : `ok(/VERSION = 'cuisine-os-v0\.17\.0-\d+'/.test(sw), 'sw.js : VERSION 0.17.0');`
     - `tests/passerelle.js:767` : `eq(APP_VERSION, '0.17.0', 'APP_VERSION 0.17.0 (lot UI-1, carnet)');`
     - `tests/recherche-web.js:66` (commentaire) : `// --- § 8 : version 0.17.0 (lot UI-1 « Carnet » ; 0.15.0 au lot F, plats en images ; 0.14.0 au lot E, 0.13.0 au lot D, 0.12.0 au lot C, 0.11.0 au lot G, 0.10.0 au lot B, 0.9.0 au lot A, 0.8.1 à la présentation du serveur), SHELL`
     - `tests/recherche-web.js:69` : `ok(/VERSION = 'cuisine-os-v0\.17\.0-\d+'/.test(sw), 'sw.js : VERSION 0.17.0');`
     - `tests/recherche-web.js:72` : `eq(APP_VERSION, '0.17.0', 'APP_VERSION 0.17.0 (lot UI-1, carnet)');`
     - `tests/sync-l3.js:1867` : `ok(/VERSION = 'cuisine-os-v0\.17\.0-\d+'/.test(source), 'sw.js : VERSION incrémentée (format cuisine-os-vMAJOR.MINOR.PATCH-N), l’ancien cache est purgé à l’activation');`
     - `tests/sync-l4.js:514` : `ok(/VERSION = 'cuisine-os-v0\.17\.0-\d+'/.test(sw), 'sw.js : VERSION 0.17.0');`
     - `tests/sync-l4.js:516` : `eq([APP_VERSION, DB_VERSION], ['0.17.0', 4], 'T1 (lot UI-1, carnet) : APP_VERSION 0.17.0, DB_VERSION inchangée (D-G11 : 0.11.0 au lot G ; 0.12.0 au lot C ; 0.13.0 au lot D ; 0.14.0 au lot E ; 0.15.0 au lot F ; 0.16.0 à UI-2)');`
     - `tests/sync-l4.js:3506` : `const v = /VERSION = 'cuisine-os-v0\.17\.0-(\d+)'/.exec(sw); // ronde 1 : le libellé dit ce que le test vérifie (le -\d+ seul acceptait -1)`
     - `tests/sync-l4.js:3507` : `ok(!!v && Number(v[1]) >= 1, 'sw.js : VERSION 0.17.0-N avec N ≥ 1 (lot UI-1 ; le seuil N ≥ 6 de la clôture des écrans du lot G valait sous 0.11.0)');`
     - `tests/assistant-compte.js:8` : `eq([DB_VERSION, APP_VERSION], [4, '0.17.0'], 'T1 (lot UI-1, carnet) : DB_VERSION 4 inchangée, APP_VERSION 0.17.0');`
     - `tests/creer-ia.js:11` : `eq(APP_VERSION, '0.17.0', 'T1 : APP_VERSION 0.17.0 (lot UI-1)');`
     - `tests/classement.js:2568` : `eq([APP_VERSION, sw.includes(\`VERSION = 'cuisine-os-v${APP_VERSION}-\`), MODULES_NEUFS.includes('../src/ui/regroupement.js')], ['0.17.0', true, true], 'T-D20 : APP_VERSION 0.17.0 (fixée par le chef d’orchestre : R-D-12 au lot D, R-E-18 au lot E, Global Constraints au lot F, I-UI-7 au lot UI-1), VERSION du service worker sur elle, regroupement.js dans le filet i18n');`
     Puis le script du Step 0, point 2, avec `0.15.0` : il ne rend plus RIEN dans `tests/` (relancé avec `0.17.0`, il rend les quinze lignes).
  4. `tests/ajouter.js:8` : `MODULES_NEUFS` gagne `'../src/ui/icones.js'` en FIN de liste (après `'../src/ui/photo-plat.js'`) ; le commentaire de la
     l. 5 gagne ` + icones.js (lot UI-1 « Carnet », tâche 1 : aucun t(), mais S14 — ni innerHTML, ni html:)`.

- [ ] **Step 3 : rouge lu.** `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096`. Attendu, par raisonnement sur le code d'avant (à lire,
  pas à deviner ; tout rouge HORS de cette liste arrête la tâche : NEEDS_CONTEXT) : **`❌ 5938/5982`** — 5982 = 5948 + 1 (la 29e paire) + 30
  (carnet au rouge : 28 rouges, 2 verts, 30 lignes) + 3 (le filet `MODULES_NEUFS` fait TROIS `ok()` par module, `tests/ajouter.js:3790-3796` : longueur,
  `export`, S14 — deux verts sur la page 404, un rouge compté ci-dessous) ; 44 rouges :
  - carnet « jetons » : 3 (valeurs tomate, contrastes de la tomate, `#bc3026` présent) ;
  - carnet « règles » : 6 rouges (`.two-col.livre` absente des deux blocs, `.grid.livres` absente, `section.plain` absente, `h1` 2.1rem + une
    règle `h1` sous @media, `.step-num` en `--action`) et 1 vert (`.two-col` / `.narrow-left` inchangées) ;
  - carnet « composants » : 3 rouges (classeTitre ignorée ; emptyState rend le texte « panier » ; emptyState ne lève pas), 1 vert (pageHeader sans
    option), puis `Carnet — bloc « pageHeader, emptyState, sectionPlain » interrompu : TypeError — C.sectionPlain is not a function` (1 rouge) ;
  - carnet « icônes » : 1 rouge (`interrompu : TypeError` sur `I` nul) ;
  - carnet « rendu » : 8 rouges (h1 41,6 px pour les deux titres — l'ancienne règle `h1` 2,6 rem à ≥ 900 px — au lieu de 51,2 / 41,6 ; h2 23,2
    et sous-titre 16 ; `section.plain` sans marge ni scroll-margin ; h2 sans filet ; `section.card` à 14,4 px ; `.step-num` tomate sur papier ;
    `.two-col.livre` à deux colonnes égales (482 px) ; `.grid.livres` à 6 colonnes) puis `interrompu : TypeError` (1 rouge) ;
  - carnet « sources » : 5 rouges (émojis, NAV, retours, en.js, SHELL) ;
  - `tests/theme.js:27` (la valeur de `--action`) : 1 ; la 29e paire est VERTE au rouge (tomate sur paper-2 = 4,97 ≥ 4,5 : elle ne mesure que
    l'olive une fois posée, 5,14) ;
  - les 13 pins de version : 13 ;
  - `tests/ajouter.js`, filet `MODULES_NEUFS` : `statique ../src/ui/icones.js : c’est bien le module (un export y figure)` : 1 (la page 404 du
    serveur Python fait 335 caractères : « le source est bien lu (… > 300) » reste vert, « ni html:, ni innerHTML, ni window.open (S14) » aussi ;
    c'est le mot `export` qui manque) ;
  - l'épingle `tests/tests.js` : 1 (obtenu 5981, attendu 5947).
  Node (208/208) et `--check` (0) sont inchangés : aucun fichier de `tools/` ni de `supabase/`. Lire la sortie entière du lanceur (`ECHECS (25)` montre
  les 25 premiers : les 19 autres se lisent dans `tests/index.html` ouvert dans le Chrome dédié de Playwright, jamais le navigateur MCP partagé —
  ou en relançant le lanceur après avoir fait vert les pins, Step 8, pour lire le reste). Consigner le bilan dans `progress.md`.

- [ ] **Step 4 : implémenter `styles.css`** (règles ENTIÈRES ; chaque emplacement par son texte à `f3672be` ; les commentaires peuvent dire « olive »,
  jamais une valeur — T-2). Après ce Step, `tests/theme.js` : T-1 (inventaire des `display: none` inchangé), T-2 (aucune couleur en dur ni nommée),
  T-11 (aucun `56px` neuf), survol (aucun `:hover` neuf) restent verts ; T-3 : 29 paires ≥ 4,5.
  1. l. 1 : `/* Cuisine OS — direction « magazine culinaire » : papier ivoire, encre, action tomate, accent vert (spec 2026-10-18-refonte-visuelle). */`
     → `/* Cuisine OS — direction « magazine culinaire » : papier ivoire, encre, action olive (lot UI-1 « Carnet », D-UI-2 ; tomate jusqu'au 23 octobre), accent vert gris (specs 2026-10-18-refonte-visuelle et 2026-10-23-experience-carnet). */`
  2. `:root`, quatre déclarations (l. 10-12 et 25) :

```css
  --action: #4f6b2e;
  --action-2: #3e5424;
  --action-bg: #e9eddf;
```

```css
  --tap: rgba(79,107,46,.15);
```

  3. l. 52-53 (`h1 { font-size: 2.1rem; line-height: 1.1; }` et `@media (min-width: 900px) { h1 { font-size: 2.6rem; } }`) → ces trois lignes, la
     règle `@media` disparaît (H-6 : UNE formule par titre) :

```css
/* D-UI-3 : titre de PAGE (pageHeader d'Aujourd'hui, Bibliothèque, Ajouter, Ma semaine, Ma cuisine, Réglages) : 1,8 rem à 375 et 390 px, 2,88 rem à 768, 3,2 rem à 1512. */
h1 { font-size: clamp(1.8rem, 6vw, 3.2rem); line-height: 1.1; }
/* D-UI-3 : titre de FICHE (recette, livre : classe posée par pageHeader({ classeTitre: 'titre-fiche' })) : 1,5 / 2,16 / 2,6 rem — un titre long tient en deux lignes à 375 px. */
h1.titre-fiche { font-size: clamp(1.5rem, 4.5vw, 2.6rem); }
```

  4. l. 54 : `h2 { font-size: 1.45rem; }` → `h2 { font-size: 1.6rem; }` ; l. 55 `h3 { font-size: 1.15rem; }` ne change pas (§ 3.2 la confirme) ;
     juste après elle :

```css
/* § 3.2 : le sous-titre d'un pageHeader (le p.muted qui suit son h1). */
header.stack h1 + p.muted { font-size: 1.05rem; }
```

  5. l. 63 : `/* T-5 : focus visible au clavier, anneau tomate décalé. */` → `/* T-5 : focus visible au clavier, anneau olive (--action) décalé. */` ;
     l. 170 : `/* T-5 : un bouton actif focalisé au clavier montre l'anneau tomate, pas son contour vert d'état. */` →
     `/* T-5 : un bouton actif focalisé au clavier montre l'anneau olive (--action), pas son contour vert gris d'état. */`.
  6. Après `.card h2, .card h3 { margin-top: 0; }` (l. 138) :

```css
/* § 3.2 : les sections (section.card et section.plain) sont espacées de 1,6 rem ; la règle .card elle-même ne change pas (R-VIS-14 : un div.card garde ses .9 rem). */
section.card { margin-bottom: 1.6rem; }
/* D-UI-8 : sectionPlain() — la section posée sur le papier : ni fond, ni bord, ni ombre, ni marge intérieure ; son h2 serif porte un filet fin.
   Seule sectionPlain pose cette classe ; section() reste .card. */
section.plain { background: transparent; border: 0; box-shadow: none; padding: 0; margin-bottom: 1.6rem; scroll-margin-top: calc(var(--topbar-h) + .5rem); }
section.plain > h2 { margin: 0 0 .8rem; padding-bottom: .4rem; border-bottom: 1px solid var(--line); }
```

  7. Après `.grid.wide { … }` (l. 151) :

```css
/* § 3.3 : la grille des couvertures (library.js, tâche 2) : des couvertures plus larges que la grille générale. */
.grid.livres { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
```

  8. l. 279, le bloc 760 px, et une règle neuve derrière lui (les déclarations de `.two-col` et de `.narrow-left` ne changent pas : F-17) :

```css
@media (min-width: 760px) { .two-col { grid-template-columns: 1fr 1fr; } .two-col.narrow-left { grid-template-columns: 320px 1fr; } .two-col.livre { grid-template-columns: 1fr; } }
/* D-UI-7 : la fiche livre (tâche 4) ne passe en deux colonnes — couverture 200 px | recettes — qu'à partir de 900 px ; de 760 à 899 px la règle ci-dessus la garde empilée. */
@media (min-width: 900px) { .two-col.livre { grid-template-columns: 200px 1fr; } }
```

  9. l. 284 : `.step-num { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--action); color: var(--paper); font-weight: 700; font-size: .85rem; flex-shrink: 0; }`
     → `.step-num { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--paper-2); color: var(--ink); font-weight: 700; font-size: .85rem; flex-shrink: 0; }`
     (§ 3.2 : le cercle beige des maquettes ; encre sur paper-2 = 12,74).
  10. Après `.empty .ico { font-size: 2rem; }` (l. 315 ; la règle reste : elle ne gêne pas un svg) :

```css
/* D-UI-9 : icônes au trait (src/ui/icones.js) : 24 × 24, trait currentColor — elles prennent la couleur du texte qui les porte (onglet actif,
   pastille « Ajouter », état vide gris) ; 40 × 40 dans un état vide. Hors de tout jeton : le trait est un attribut du svg, pas une valeur CSS. */
.icone { width: 24px; height: 24px; display: inline-block; vertical-align: middle; flex-shrink: 0; }
.empty .ico .icone { width: 40px; height: 40px; }
```

  Vérification de forme avant d'aller plus loin : `grep -n "olive" styles.css` ne rend que des lignes de commentaire ; `grep -c "56px" styles.css` rend 1
  (`.btn.big`) ; `grep -c "display: none" styles.css` rend 6 (les cinq de T-1 + `[hidden]`), comme avant.

- [ ] **Step 5 : implémenter `src/ui/icones.js`** (neuf ; module FEUILLE : aucun import, aucun `t()`, aucun `html:`, aucun `innerHTML` — le filet
  `MODULES_NEUFS` le relit ; les cercles sont des arcs : un seul type d'enfant, `path`) :

```js
// Icônes au trait (lot UI-1 « Carnet », D-UI-9, spec 2026-10-23-experience-carnet § 3.3) : vingt-trois SVG inline monochromes, 24 × 24, trait
// currentColor — elles prennent la couleur du texte qui les porte (onglet actif olive, pastille « Ajouter » papier, état vide gris). Module FEUILLE :
// aucun import, aucun texte d'écran. icone(nom) lève une TypeError sur un nom inconnu (une faute de frappe ou un émoji ne rend jamais une icône
// vide en silence) ; les noms sont lus par Object.hasOwn (« constructor » n'est pas une icône). Les tracés sont des <path d> seulement — les
// cercles en arcs — et tiennent dans la boîte 0 0 24 24 (tests/carnet.js les mesure) ; feather-like, trait 1,75, bouts et joints ronds.
const NS = 'http://www.w3.org/2000/svg';
const TRACES = Object.freeze({
  // navigation (app.js)
  soleil: ['M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  bibliotheque: ['M3 20h18', 'M5 20V5h3v15', 'M9 20V3h4v17', 'M15 20 13 6.5l3.5-.8L19.5 19.4z'],
  calendrier: ['M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M8 3v4M16 3v4M4 10h16'],
  toque: ['M7 15.5a3.5 3.5 0 0 1-.8-6.9A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 5.8 3.6 3.5 3.5 0 0 1-.8 6.9', 'M7 15.5V21h10v-5.5', 'M7 18h10'],
  plus: ['M12 5v14M5 12h14'],
  roue: ['M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1'],
  // grille Ajouter (add.js, tâche 5)
  livres: ['M4 4h5v16H4z', 'M9 4h5v16H9z', 'M14 5.2l4.4-1.2L21 19l-4.4 1.2z'],
  'appareil-photo': ['M3 8a2 2 0 0 1 2-2h2.5l1.5-2.5h6L16.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M12 9.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7'],
  crayon: ['M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', 'M14.5 5.5l3 3'],
  lien: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5'],
  etincelle: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'],
  flocon: ['M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7', 'M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5M4 10.3 7 12l-3 1.7M20 10.3 17 12l3 1.7'],
  // accueil d'un livre (accueil-livre.js, tâche 5)
  page: ['M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M14 2v6h6'],
  horloge: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M12 7v5l3 2'],
  // états vides (emptyState, components.js)
  panier: ['M2 3h3l2.6 12.6a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.5L22 7H6', 'M9 21a1 1 0 1 0 0-2a1 1 0 1 0 0 2M18 21a1 1 0 1 0 0-2a1 1 0 1 0 0 2'],
  assiette: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9'],
  couverts: ['M6 2v7a3 3 0 0 0 6 0V2', 'M9 2v20', 'M18 2c-2 2.5-3 5.5-3 9h3v11'],
  salade: ['M3 12h18a9 9 0 0 1-18 0z', 'M7 12a5 5 0 0 1 10 0', 'M12 7V4'],
  'livre-ouvert': ['M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z', 'M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z'],
  loupe: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14', 'M21 21l-4.3-4.3'],
  // cartes et repères (tâches 2 à 4)
  globe: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'],
  personnes: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'],
  image: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M8.5 7a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3', 'M21 15l-5-5L5 21'],
});
// Les vingt-trois noms, dans l'ordre de la spec § 3.3 (le test en compte exactement 23).
export const NOMS_ICONES = Object.freeze(Object.keys(TRACES));
const ATTRIBUTS = Object.freeze({ viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });

// icone(nom) → un svg NEUF (jamais un nœud partagé : chaque site a le sien) ; TypeError sur un nom inconnu.
export function icone(nom) {
  if (typeof nom !== 'string' || !Object.hasOwn(TRACES, nom)) throw new TypeError(`icône inconnue : ${typeof nom === 'string' ? nom : typeof nom}`);
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, val] of Object.entries(ATTRIBUTS)) svg.setAttribute(k, val);
  svg.setAttribute('class', `icone icone-${nom}`);
  for (const d of TRACES[nom]) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.append(p); }
  return svg;
}
```

  Contrôle hors ligne (fait à la rédaction du plan, à refaire si un tracé change) : les 23 jeux de tracés sont distincts et chacun tient dans la
  boîte (extrêmes mesurés : x de 1,00 à 23,00, y de 2,00 à 22,00 ; `toque` 3,53-20,47 × 4,79-15,50 ; `globe` 8,72-15,28 pour les méridiens). Une
  faute de tracé se lit dans le libellé « boîte » du test : corriger le TRACÉ, jamais la borne.

- [ ] **Step 6 : implémenter `src/ui/components.js`** (l. 15-31 à `f3672be` ; le reste du module ne change pas) :

```js
import { pointeurValide } from '../domain/photo-web.js';
import { icone } from './icones.js';

// classeTitre (lot UI-1, D-UI-3, H-20) : une classe posée sur le h1 — 'titre-fiche' pour une fiche recette ou livre (tâches 3 et 4) ; sans elle, le
// titre de PAGE. `back` reste un objet { href, label } (H-1). Rien d'autre ne change.
export function pageHeader(title, { subtitle = null, actions = [], back = null, classeTitre = null } = {}) {
  return el('header', { class: 'stack', style: { marginBottom: '1rem' } },
    back ? el('a', { href: `#${back.href}`, class: 'muted', style: { textDecoration: 'none', fontSize: '.9rem' } }, `← ${back.label}`) : null,
    el('div', { class: 'row between top' },
      el('div', null, el('h1', { class: classeTitre }, title), subtitle ? el('p', { class: 'muted' }, subtitle) : null),
      actions.length ? el('div', { class: 'row' }, ...actions) : null));
}

export function section(title, ...children) {
  return el('section', { class: 'card' }, title ? el('h2', null, title) : null, ...children);
}

// D-UI-8 (H-2) : la sœur de section() — même forme, même contenu — posée sur le papier : section.plain (styles.css : ni fond, ni ombre, filet fin
// sous le h2). Seule cette fonction pose la classe plain ; section() reste .card pour ses 54 appelants. Chaque tâche nomme les sections qu'elle bascule.
export function sectionPlain(title, ...children) {
  const s = section(title, ...children);
  s.className = 'plain';
  return s;
}

// D-UI-9 : l'icône d'un état vide est un NOM du jeu d'icones.js (icone() lève sur un nom inconnu, un émoji compris : plus aucun émoji ici).
export function emptyState(icon, text, action = null) {
  return el('div', { class: 'empty' }, el('div', { class: 'ico' }, icone(icon)), el('p', null, text), action);
}
```

  (`el('h1', { class: classeTitre }, …)` : `el` ignore une valeur `null`, l. 7 de `dom.js` — le h1 n'a alors AUCUN attribut `class`, ce que le test
  « pageHeader sans classeTitre » affirme.)

- [ ] **Step 7 : implémenter `src/app.js`, les onze états vides, les trois retours, `en.js`** (chaque édition par son texte exact).
  1. `src/app.js`, l. 15 : après `import { pastille, majPastille } from './ui/components.js';` :

```js
import { icone } from './ui/icones.js';
```

     l. 37-47, `NAV` et `navLinks` (D-UI-4 : la route `/library` et sa fonction `match` ne changent pas, I-UI-3) :

```js
// D-UI-4 : « Bibliothèque » (l'écran s'ouvre sur les plats, tâche 2) ; D-UI-9 : ico = un nom d'icones.js, plus un émoji (les émojis ne prennent pas la couleur de l'onglet actif).
const NAV = [
  { href: '/', label: 'Aujourd’hui', ico: 'soleil', match: (p) => p === '/' || p.startsWith('/search') },
  { href: '/library', label: 'Bibliothèque', ico: 'bibliotheque', match: (p) => p.startsWith('/library') || p.startsWith('/books') || p.startsWith('/dishes') || p.startsWith('/recipes') },
  { href: '/meals', label: 'Ma semaine', ico: 'calendrier', match: (p) => p.startsWith('/meals') || p.startsWith('/lists') },
  { href: '/kitchen', label: 'Ma cuisine', ico: 'toque', match: (p) => p.startsWith('/kitchen') },
  { href: '/add', label: 'Ajouter', ico: 'plus', add: true, match: (p) => p.startsWith('/add') || p.startsWith('/import') },
];

function navLinks(path, cls) {
  return NAV.map((n) => el('a', { href: `#${n.href}`, class: `${cls} ${n.add ? 'add' : ''} ${n.match(path) ? 'active' : ''}` }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone(n.ico)), el('span', null, t(n.label))));
}
```

     l. 52, la roue du panneau latéral : `el('span', { class: 'ico' }, '⚙︎')` (U+2699 U+FE0E) → `el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('roue'))`.
     La barre haute (l. 54-60) ne change pas : ni la pilule « ⌕ », ni le bouton « ⚙︎ » (« rien d'autre » ; **D-2 RATIFIÉ rév. 3** : seule la roue du
     panneau latéral, l. 52, passe au trait ; la pilule et le bouton de la barre haute, l. 59-60, restent en texte — une bascule de ces deux-là est un
     lot ultérieur).
  2. Les onze états vides — le premier argument d'`emptyState(` seulement, la ligne reste identique par ailleurs (les points de code des émojis
     à remplacer sont dans **Files**) :
     - `src/ui/library.js:53` → `emptyState('livres', t('Aucun livre pour l’instant.'), …` ; `:103` → `emptyState('assiette', t('Aucun plat défini. …`
     - `src/ui/grocery.js:21` → `emptyState('panier', t('Aucun ingrédient structuré dans ces recettes.'))`
     - `src/ui/meals.js:18` → `emptyState('couverts', t('Aucun repas composé. …` ; `:79` → `emptyState('salade', t('Ajoute un plat principal …`
     - `src/ui/kitchen.js:30` → `emptyState('toque', t('Aucun appareil enregistré.'))` ; `:75` → `emptyState('flocon', t('Inventaire vide. …`
     - `src/ui/dish.js:43` → `emptyState('assiette', t('Aucune recette rattachée. …`
     - `src/ui/book.js:176` → `emptyState('livre-ouvert', t('Aucune recette dans cette vue. …`
     - `src/ui/search.js:162` → `emptyState('loupe', t('Aucune recette admissible.') + …` (UN littéral ; rien d'autre dans ce fichier)
     - `src/ui/import.js:68` → `emptyState('appareil-photo', t('Aucune séance en cours.'))`
     Contrôle : `grep -n "emptyState('" src/ui/*.js | grep -v "emptyState('[a-z-]*'"` ne rend plus rien (onze appels, tous à un nom ASCII du jeu ;
     la définition de `components.js` n'a pas d'apostrophe après la parenthèse).
  3. Les trois retours (D-UI-4, B-M-9) : `src/ui/recipe.js:88` — `{ href: '/library', label: t('Mes livres') }` → `{ href: '/library', label: t('Bibliothèque') }`
     (le reste de la ligne, `back: edition ? { href: \`/books/${edition.id}\`, label: book?.title || t('Livre') } : …`, ne change pas) ;
     `src/ui/book.js:121` — `back: { href: '/library', label: t('Mes livres') },` → `back: { href: '/library', label: t('Bibliothèque') },` ;
     `src/ui/accueil-livre.js:14` — `texte: t('Aller à Mes livres.')` → `texte: t('Aller à la bibliothèque.')`. `src/ui/search.js:18` (`MODES`) et
     `src/ui/book.js:97` (un commentaire) gardent « Mes livres ».
  4. `src/i18n/en.js`, l. 4 : `'Aujourd’hui': 'Today', 'Mes livres': 'My books', 'Ma semaine': 'My week', …` → `'Aujourd’hui': 'Today', 'Mes livres': 'My books', 'Bibliothèque': 'Library', 'Ma semaine': 'My week', …`
     (« My books » reste : le segment de la recherche) ; l. 232 : `"Aller à Mes livres.": "Go to My books.",` → `"Aller à la bibliothèque.": "Go to the library.",`.

- [ ] **Step 8 : versions et SHELL** (I-UI-7 ; posés dans le MÊME Step que le dernier import d'`icones.js` : `tests/sync.js` compare `SHELL` au graphe
  d'imports depuis `app.js`) : `src/model/schema.js:6` → `export const APP_VERSION = '0.17.0';` ; `sw.js:4` → `const VERSION = 'cuisine-os-v0.17.0-1';` ;
  `sw.js:19` : `'./src/ui/home.js', './src/ui/import-cible.js',` → `'./src/ui/home.js', './src/ui/icones.js', './src/ui/import-cible.js',`. `DB_VERSION` reste 4
  (aucun magasin, aucun index). UI-2 porte `0.16.0` : si UI-2 fusionne APRÈS UI-1, un commit de version renumérote le lot qui fusionne en second
  (schema.js, sw.js, les 13 pins + 1 commentaire : règle I-UI-7) — rien à faire ici.

- [ ] **Step 9 : vert et épingle relevée.** `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` : un seul rouge attendu, l'épingle
  (`obtenu : 5988`, attendu 5947) ; tout autre rouge se corrige AVANT de toucher l'épingle (un rouge d'icône « boîte » = un tracé à corriger ; un
  rouge de pin = un texte mal retrouvé). Puis l'épingle de `tests/tests.js` (l. 250 à `f3672be`, glissée de cinq lignes par l'import et le bloc du Step 2 : la retrouver par son texte
  `eq(results.length, 5947,`) → `eq(results.length, <obtenu>,'compte d’assertions : une assertion qui disparait est un rouge');` (**épingle = obtenu − 1** ;
  attendu 5988 = 5947 + 1 (la 29e paire) + 37 (carnet) + 3 (les trois `ok()` du filet `MODULES_NEUFS` pour `icones.js`) ; si l'obtenu diffère, l'épingle prend
  la valeur MESURÉE et l'écart se consigne — jamais une valeur écrite d'avance). Relancer :
  **`✅ 5989/5989`**, seule erreur de console : le 404 de `/favicon.ico` ; `node --test tools/*.test.mjs` 208/208 ; `node tools/generer-migrations.mjs --check` 0.
  Relire aussi dans le Chrome dédié (`http://127.0.0.1:8096/#/library`, jamais le navigateur MCP) que la coquille se dessine sans erreur de console
  (`app.js` est hors suite) : cinq onglets au trait, « Bibliothèque », roue au trait dans le panneau latéral à ≥ 900 px — par le script Playwright du
  registre ou un `page.evaluate` ad hoc dans le scratchpad, en lecture seule, sans toucher à la base. Consigner dans `progress.md` : bilan, épingle,
  Node, `--check`, `sw.js -1`.

- [ ] **Step 10 : mutants de la tâche** (jamais une mutation dans le worktree ; copie LÉGÈRE de l'arbre dans le scratchpad, servie à part, un port par
  copie ; la mutation est écrite dans la copie par un script qui refuse tout chemin hors du scratchpad ; le lanceur du worktree pointe la copie) :

  ```bash
  S=/private/tmp/claude-501/-Users-neeganmac/1602708c-1218-4b6c-99db-b05ac6854f25/scratchpad/mut-UI1-T1
  mkdir -p "$S" && rsync -a --exclude .git --exclude .superpowers --exclude docs /Users/neeganmac/projects/mistu-carnet/ "$S/base/"
  # pour chaque mutant N : une copie neuve de base/, la mutation (sed ou python -I sur $S/mN/… seulement), un serveur, le lanceur
  rsync -a "$S/base/" "$S/m1/" && (cd "$S/m1" && python3 -m http.server 8296 --bind 127.0.0.1 >/dev/null 2>&1 &) && sleep 1
  node /Users/neeganmac/projects/mistu-carnet/.superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8296   # attendu : ❌, le test tueur nommé dans ECHECS
  pkill -f "http.server 8296"
  ```

  Chaque mutant doit rougir ; le test qui le tue est nommé ; la sortie lue est consignée dans le rapport. Témoin : `base/` servie sur 8296 rend
  `✅ 5989/5989` avant le premier mutant.
  1. `--action: #bc3026` (olive remise en tomate) → quatre tueurs : `theme.js:27` et les trois de « jetons » (valeurs, contrastes, `#bc3026` présent) ;
     les mesures de « rendu » restent vertes (elles comparent à `hex('--action')`, lu dans la feuille mutée : c'est voulu, elles mesurent la cohérence,
     pas la valeur — la valeur est épinglée par « jetons »).
  2. `sectionPlain` pose `s.className = 'card plain'` → « sectionPlain(title, ...children) rend section.plain » (className `'card plain'`).
  3. `pageHeader` ignore `classeTitre` (`el('h1', null, title)`) → « classeTitre pose la classe sur le h1 » + « h1.titre-fiche = clamp(1.5rem…) » (mesuré : 51,2 au lieu de 41,6).
  4. `icone()` rend un svg vide au lieu de lever (`if (!…) return document.createElementNS(NS, 'svg')`) → « lève une TypeError » + « emptyState lève ».
  5. `stroke: '#242821'` en attribut (plus `currentColor`) → « chaque icône = svg[…] stroke currentColor » + « le trait suit la couleur du texte ».
  6. `'aria-hidden'` retiré d'`ATTRIBUTS` → « chaque icône = svg[aria-hidden=true]… ».
  7. `image` retirée de `TRACES` (22 noms) ; puis une 24e (`'coeur': ['M12 21s-8-5-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 6-8 11-8 11z']`) → « exactement vingt-trois noms » (les deux).
  8. `nom in TRACES` à la place d'`Object.hasOwn` → « icone(nom) lève … (constructor, toString) » : `'constructor' in TRACES` est vrai, `TRACES.constructor` est
     `Object`, et `for (const d of TRACES[nom])` lève « … is not iterable » — une TypeError AUSSI, mais sans « icône inconnue » : c'est le MESSAGE que `leve`
     exige qui rougit (rév. 2 : sans lui, ce mutant survivait).
  9. `emptyState` garde l'ancien repli : `NOMS_ICONES.includes(icon) ? icone(icon) : icon` → « emptyState lève sur un émoji ».
  10. `src/ui/grocery.js:21` remis à l'émoji → « chaque module porte l’ENSEMBLE de noms … aucun nom hors du jeu » (`horsJeu` = `['grocery.js : 🛒']`, `releve['grocery.js']`
      ≠ `['panier']` ; et la liste de courses lève à son rendu : d'autres rouges, nommés).
  11. `.two-col.livre { grid-template-columns: 200px 1fr; }` déplacée dans le bloc 760 px (la règle `1fr` retirée) → « .two-col.livre = 1fr dans le bloc 760 px » + « 200px 1fr sous 900 px » (absente).
  12. `h1 { font-size: 2.1rem }` gardé (clamp retiré) → « UNE formule clamp() par titre » + « h1 de page = clamp(…) » (mesuré).
  13. `'./src/ui/icones.js'` retiré de `SHELL` → `tests/sync.js` « SHELL complet » (module atteignable absent) + « ./src/ui/icones.js dans SHELL ».
  14. `label: 'Mes livres'` laissé dans `NAV` → « NAV = cinq entrées, libellé « Bibliothèque » ».
  15. `.step-num { background: var(--action); color: var(--paper); }` remis → « .step-num en --paper-2 / --ink » (texte) + « .step-num = cercle --paper-2 » (mesuré).
  16. `.grid.livres` à `minmax(150px, 1fr)` → « .grid.livres minmax(170px, 1fr) » + « 5 colonnes à 980 px » (6 mesurées).
  17. `header.stack h1 + p.muted` retirée → « h2 1,6 rem, h3 1,15 rem, sous-titre 1,05 rem » (texte et mesuré : 16 au lieu de 16,8).
  18. `section.card { margin-bottom: 1.6rem; }` retirée → « section.card espacée de 1,6 rem » (14,4 mesurés).
  19. `h1.titre-fiche { font-size: clamp(1.8rem, 6vw, 3.2rem); }` (même formule que la page) → « UNE formule clamp() par titre » + « h1.titre-fiche = clamp(1.5rem…) » (mesuré à ≥ 900 px : 51,2 ≠ 41,6).
  20. `label: t('Mes livres')` laissé dans `recipe.js:88` → « « ← Bibliothèque » sur la fiche recette et la fiche livre ».
  21. `VERSION = 'cuisine-os-v0.15.0-9'` gardé dans `sw.js` → les pins `sw.js : VERSION 0.17.0` (7 assertions) + `classement.js` T-D20.
  22. `'Bibliothèque': 'Library'` absente d'`en.js` → « en.js porte « Library » … ».
  23. `.icone { width: 20px; height: 20px; }` → « une icône mesure 24 × 24 ».
  24. La roue du panneau latéral laissée en `'⚙︎'` → « NAV … la roue des Réglages aussi » (`icone('roue')` absent du source).
  25. `--action-bg: #f7e3e0` gardé (trois jetons sur quatre) → « --action, --action-2, --action-bg et --tap sont l’olive » + « plus aucune tomate ».
  Attendu : 25 sur 25 rouges (le n° 1 par quatre tests nommés ; le n° 8 par le message « icône inconnue » exigé). Un mutant qui
  survit se consigne et gagne son test avant le commit — jamais un mutant déclaré « équivalent » sans sa sortie lue.

- [ ] **Step 11 : invisibles.** Script Python des contraintes (jamais `grep`) sur les fichiers touchés : `styles.css src/ui/icones.js src/ui/components.js
  src/app.js src/ui/library.js src/ui/grocery.js src/ui/meals.js src/ui/kitchen.js src/ui/dish.js src/ui/book.js src/ui/search.js src/ui/import.js
  src/ui/recipe.js src/ui/accueil-livre.js src/i18n/en.js src/model/schema.js sw.js tests/carnet.js tests/tests.js tests/theme.js tests/ajouter.js
  tests/passerelle.js tests/recherche-web.js tests/sync-l3.js tests/sync-l4.js tests/assistant-compte.js tests/creer-ia.js tests/classement.js` — attendu
  `invisibles : 0`, sortie 0 (les U+FE0E de `app.js:60` — la roue de la barre haute — restent : hors de l'ensemble contrôlé, antérieurs au lot) :

  ```bash
  python3 -I - <fichiers touchés> <<'PY'
  import sys
  INVISIBLES = {0x200B, 0x200C, 0x200D, 0x2028, 0x2029, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2060, 0xFEFF}
  mauvais = 0
  for f in sys.argv[1:]:
      for i, l in enumerate(open(f, encoding='utf-8'), 1):
          for c in l:
              if ord(c) in INVISIBLES:
                  print(f'{f}:{i}: U+{ord(c):04X}'); mauvais += 1
  print('invisibles :', mauvais); sys.exit(1 if mauvais else 0)
  PY
  ```

  Et aucune clé : `git grep -nEi 'sk-ant-[0-9A-Za-z_-]{10,}|eyJ[A-Za-z0-9_-]{20,}|sb_(secret|publishable)_' -- src styles.css sw.js tests/carnet.js` (attendu : rien, hors les sentinelles `…-sentinelle` déjà présentes dans `tests/recherche-web.js`).

- [ ] **Step 12 : commit** (par chemins nommés, jamais `-A` ; message ASCII sans accents ; trailer du modèle RÉEL de l'implémenteur, et la ligne de
  session si le brief la donne ; ne pas pousser) :

  ```bash
  git -C /Users/neeganmac/projects/mistu-carnet add styles.css src/ui/icones.js src/ui/components.js src/app.js src/ui/library.js src/ui/grocery.js src/ui/meals.js src/ui/kitchen.js src/ui/dish.js src/ui/book.js src/ui/search.js src/ui/import.js src/ui/recipe.js src/ui/accueil-livre.js src/i18n/en.js src/model/schema.js sw.js tests/carnet.js tests/tests.js tests/theme.js tests/ajouter.js tests/passerelle.js tests/recherche-web.js tests/sync-l3.js tests/sync-l4.js tests/assistant-compte.js tests/creer-ia.js tests/classement.js
  git -C /Users/neeganmac/projects/mistu-carnet commit -m "Carnet T1 : jetons olive, titres clamp, sectionPlain, pageHeader classeTitre, icones au trait, NAV Bibliotheque, pins 0.17.0 (lot UI-1, tache 1)" -m "Co-Authored-By: <modele reel de l'implementeur> <noreply@anthropic.com>"
  ```

  Puis `git -C /Users/neeganmac/projects/mistu-carnet status --short` : vide (le registre `.superpowers/` est hors git). `progress.md` : « Tâche 1 — Clôture » avec le
  bilan (`✅ 5989/5989`, épingle 5988, Node 208, `--check` 0, `APP_VERSION 0.17.0`, `sw.js cuisine-os-v0.17.0-1`, 25 mutants rouges, invisibles 0),
  les amendements nommés (EI-T1-1 : libellés `theme.js:45, 48` ; la règle `header.stack h1 + p.muted` touche aussi les en-têtes maison d'`import-web.js`
  et d'`import-cible.js`, voulu ; tout écart de ligne relu au Step 0), la décision D-2 (RATIFIÉE rév. 3 : la pilule « ⌕ » et le bouton « ⚙︎ » de la barre
  haute restent en texte, seule la roue du panneau latéral passe au trait) et le rappel de R-UI-P1 : `search.js:162` a changé d'un littéral (le nom `loupe`, que § 3.3
  nomme), la SEULE édition de ce fichier, à porter dans la version UI-2 à la fusion (branche `apercus-web`, qui réécrit `search.js`).

---

### Task 2 : Carte-plat, grille bornée et Bibliothèque « Recettes » — segments, filtres, actions, pied « à importer »

Spec § 9 tâche T2 ; D-UI-4, D-UI-5, I-UI-5, § 3.3 (`recipeCard({ photoEnTete, fichier })`, `grilleCartes`, `.plat-vignette.grande` / `.petite`), § 4.1,
§ 5 (textes de la bibliothèque et de la carte), § 7 UI-1 T2 (épingles à amender), § 13 point 5 (tri par dernière modification, confirmé).
Consomme la tâche 1 : `sectionPlain`, `pageHeader({ subtitle, actions, back })` (`back` objet `{ href, label }`, inchangé), `emptyState` qui
accepte un nom d'icône du jeu neuf (`assiette`), la clé `en.js` « Bibliothèque » → « Library ». `sw.js` `cuisine-os-v0.17.0-2`.

**Files:**
- Modify: `src/ui/components.js` (`recipeCard`, l. 187-205 à `f3672be` : deux options neuves `photoEnTete`, `fichier` ; après elle et avant
  `bookCover` (l. 207) : `dureeTotale`, `ligneSource`, `cartePlat`, `grilleCartes` neuves ; aucun import neuf — `typeAffichage`, `displayUrl`,
  `urlDeBlob`, `revoquerUrlDeBlob`, `lienSignet`, `formatMinutes`, `estCreationIA` sont déjà importés l. 2-13)
- Modify: `styles.css` (après la règle `.plat-vignette` 72 px, l. 270 à `f3672be` : `.plat-vignette.grande`, `.plat-vignette.petite`, puis
  `.grille-plats` et ses deux `@media`, puis les règles `.carte-plat` ; la règle 72 px ne change pas d'un octet)
- Modify: `src/ui/library.js` (l. 6 : import de `./components.js` étendu ; import neuf de `pointeurValide` ; `renderLibrary` l. 10-27 réécrite
  avec un quatrième paramètre `deps` ; `recettesTab` et `aImporterTab` neuves ; `liensWebGardes` l. 38-42 et `recettesCreeesIA` l. 46-50 :
  `section(` → `sectionPlain(` (l. 41 et l. 49) ; `booksTab` l. 52-87 : UNE classe (l. 58, `el('div', { class: 'grid' })` → `'grid livres'`, § 3.3 : la
  règle `.grid.livres` posée par T1 trouve son appelant) ; `dishesTab` intacte — la tâche 1 a seulement remplacé les deux émojis d'état vide)
- Modify: `src/i18n/en.js` (treize entrées, § 5, avant la `};` finale, l. 755 à `f3672be` — après le bloc « Lot F »)
- Modify: `tests/ajouter.js` (`CHAINES_NEUVES_AILLEURS`, l. 24-62 : clé `'../src/ui/library.js'` neuve, liste de `components.js` + 2 ; l. 3675
  et l. 3734, 3738, 3743, 3744, 3745, 3751, 3757 : `{ tab: 'books' }` ; l. 3729 : `section.plain`)
- Modify: `tests/creer-ia.js` (l. 1511-1512 : `section.plain` ; l. 1513, 1516, 1517 : `{ tab: 'books' }`)
- Modify: `tests/photo-plat.js` (l. 1323 : « exactement trois sélecteurs »)
- Modify: `tests/carnet.js` (créé par la tâche 1 : le bloc « Tâche 2 » ci-dessous, AU-DESSUS de son repère de fin, dans `runCarnetTests`),
  `tests/tests.js` (épingle l. 250), `sw.js` (`VERSION` l. 4 : `-2` ; `SHELL` inchangé, aucun module neuf)

**Interfaces:**
- Consumes : tâche 1 — `sectionPlain(title, ...children) → section.plain`, `pageHeader(title, { subtitle, actions, back, classeTitre })`,
  `emptyState(nomIcone, texte, action = null)` (nom `assiette`), `EN['Bibliothèque'] === 'Library'` ; existant — `typeAffichage(fileRow)`,
  `displayUrl(fileRow, creerUrl)` (`src/sync/mime.js`), `urlDeBlob`, `revoquerUrlDeBlob` (`src/core/blob-urls.js`), `lienSignet(sourceUrl) →
  { ok, href, hote }` (`src/core/lien.js`), `formatMinutes(min)` (`src/core/dom.js`), `estCreationIA`, `etiquetteIA`, `availabilityBadge`,
  `provenanceText`, `remplacerEnRevoquant(conteneur, ...noeuds)`, `segmented(options, value, onChange)` (`components.js`), `repo.getFiles(sha256s) →
  Map`, `repo.groupBy(rows, key)`, `pointeurValide(fiche)` (`src/domain/photo-web.js`), `navigate`, `buildQuery` (`src/core/router.js`),
  `buildDocs` (`src/domain/search.js` : la forme `{ recipe, version, edition, book, cooked }` des docs), le filet `MODULES_NEUFS` /
  `CHAINES_NEUVES_AILLEURS` (`tests/ajouter.js`, l. 3786-3800), `withRepo` (`tests/sync-fixture.js`).
- Produces (`src/ui/components.js`, signatures exactes) :

```js
export function recipeCard(doc, { extra = null, href = null, reasons = null, photoEnTete = false, fichier = null } = {})
  // photoEnTete: true → a.item-link.carte-plat[.sans-photo] (cartePlat) ; sinon la carte horizontale d'avant, inchangée
export function dureeTotale(version)        // → number | null : total_minutes ?? prep + cook ; null sans durée, pour une création IA, pour une valeur non numérique
export function ligneSource(doc)            // → chaîne « Du web · {hôte} » | « De mon livre · {titre} » | provenanceText(…), puis « · {durée} » (formatMinutes) si dureeTotale
export function grilleCartes(noeuds)        // → div.grille-plats portant les nœuds
```

- Produces (`src/ui/library.js`) :

```js
export async function renderLibrary(params, query, ctx, deps = {})   // deps.matchMedia (défaut (q) => window.matchMedia(q)) ; query.tab ∈ recettes (défaut) | books | dishes | a-importer
export const CARTES_PAR_PAGE = 60;
export const dansLaGrille = (r) => boolean;      // availability !== 'reference_only' || source_url non vide (B-I-5)
export const estAImporter = (r) => boolean;      // reference_only, sans adresse, d'un livre (edition_id)
export const passeLaPuce = (r, puce) => boolean; // puce ∈ 'toutes' | 'livres' (edition_id) | 'web' (source_url)
```

- Produces (`styles.css`, classes) : `.grille-plats` (grille, 1 colonne sous 360 px, 2 dès 360 px, 3 dès 900 px, `gap: 1.2rem`, `align-items:
  stretch`), `.carte-plat` (la carte verticale), `.carte-plat.sans-photo` (bloc de titre `.carte-plat-corps` sur `--paper-2`, `min-height: 7rem`),
  `.carte-plat-corps`, `.carte-plat-source`, `.carte-plat-badges`, `.plat-vignette.grande` (4:3, rayon 12), `.plat-vignette.petite` (48 × 48, pour la
  ligne compacte de la tâche 4). DOM de la carte-plat : `a.item-link.carte-plat[.sans-photo][href]` > [`img.plat-vignette.grande[alt=""][loading=lazy]`]
  > `div.carte-plat-corps` > `h3` (titre), `div.muted.carte-plat-source`, [`div.row.carte-plat-badges` > badges], puis `extra`.
- Produces (`src/i18n/en.js`) : les treize clés du Step 7 ; « À importer » est la clé que la tâche 5 réemploie pour le badge court (une seule clé).

- [ ] **Step 0 : relire** (lecture seule, sur la tête réelle après la tâche 1 ; un numéro de ligne qui a bougé est un amendement nommé, pas un constat :
  retrouver chaque site par son TEXTE).
  - `src/ui/components.js` : `recipeCard` (« `export function recipeCard(doc, { extra = null, href = null, reasons = null } = {})` », l. 188 à
    `f3672be`) et son `.col` (vignettePlat en tête, l. 199-203) ; `bookCover` juste après (l. 213) ; `sectionPlain` posée par la tâche 1 après
    `section` (l. 25-27) ; la signature de `pageHeader` (l. 17, avec `classeTitre` depuis la tâche 1) ; `emptyState` (l. 29-31, nom d'icône depuis
    la tâche 1 : relire quel paramètre elle attend — un nom du jeu `icones.js` ; `assiette` et `livres` existent déjà par `library.js:53/103`).
  - `src/ui/library.js` : `renderLibrary` (l. 10-27), `carteOuLien` (l. 31-34 : `recipeCard(doc)` sans option — la carte horizontale reste pour
    « Liens web gardés » et « Recettes créées avec l’IA »), `liensWebGardes` (l. 38-42), `recettesCreeesIA` (l. 46-50), `booksTab` (l. 52-87 :
    `repo.getFiles` des couvertures l. 57, `const grid = el('div', { class: 'grid' })` l. 58, le `draw()` avec révocation D-T9 l. 80-82 — le MODÈLE
    de la grille bornée), `dishesTab` (l. 89-…).
    Les deux émojis d'état vide (l. 53 `'📚'`, l. 103 `'🍝'`) sont déjà des noms d'icônes depuis la tâche 1 : ne pas les toucher.
  - `styles.css` : la règle `.plat-vignette` (l. 270) et son commentaire (l. 269) ; `.item-link` (l. 249-250 : `display: block`, le `:hover h3`
    déjà présent — aucun `:hover` neuf) ; `.grid` (l. 150) intacte ; `.puce` / `.puce[aria-pressed="true"]` (l. 210-211 : le style des puces
    Toutes / De mes livres / Du web existe déjà, en `--action`, olive depuis la tâche 1) ; les jetons `--paper-2`, `--radius`, `--line`.
  - `tests/theme.js` : T-1 l. 40-42 (inventaire EXACT des `display:none` : aucun neuf, d'où le bouton mobile par `[hidden]`), T-2 l. 34-38 (aucun
    `#…`, `rgba(`, ni couleur nommée hors `:root` : jetons seulement), T-11 l. 57 (`56px` réservé à `.btn.big`), survol l. 59-60 ; `tests/photo-plat.js`
    l. 1314-1324 (le bloc « styles.css : la règle .plat-vignette » : la regex de la l. 1317 ne lit que la règle `.plat-vignette {` nue — les deux
    règles neuves `.plat-vignette.grande {` et `.plat-vignette.petite {` ne la masquent pas ; la l. 1323 collecte TOUS les sélecteurs qui nomment
    `.plat-vignette`, dans l'ordre du source : aucune autre règle du lot ne doit contenir ce nom).
  - Les tests qui appellent `renderLibrary` (relevé par recherche de `renderLibrary(` dans `tests/`) : `tests/ajouter.js` l. 3675, 3734, 3738, 3743,
    3744, 3745, 3748 (déjà `{ tab: 'dishes' }`), 3751, 3757 ; `tests/creer-ia.js` l. 1513, 1516, 1517 — aucun autre (vérifié à `f3672be`). Aucun test
    n'épingle le titre « Mes livres » de `pageHeader` (seuls des libellés d'assertions le citent : `tests/ajouter.js` l. 3736, 3739, 3749, 3758, et
    la recherche garde SON segment « Mes livres », `search.js:18`).
  - Les aides de `tests/carnet.js` posées par la tâche 1 (`bloc`, `lire`, scène…) : le bloc de la tâche 2 est un bloc `{ … }` autonome qui déclare
    les siennes (portée de bloc : aucun conflit de nom avec celles de la tâche 1, qu'elles existent ou non) ; il importe `withRepo` lui-même.
  - `src/i18n/en.js` : les clés « Toutes », « Recettes », « À importer », « Voir plus », « Du web », « De mes livres », « Ajouter une recette »
    n'existent pas à `f3672be` (`book.js:193-195` appelle `t('Recettes')` et `t('Toutes')` SANS entrée : les ajouter ici traduit aussi ces deux sites,
    sans les changer) ; « Importer », « Livres », « Plats », « Ajouter un livre », « Favoris », « Sans titre » existent.

- [ ] **Step 1 : tests rouges — `tests/carnet.js`**, le bloc « Tâche 2 », collé dans `runCarnetTests({ eq, ok })` AU-DESSUS du repère de fin posé par la
  tâche 1 (à défaut de repère : juste avant l'accolade qui ferme la fonction). Bloc `{ … }` autonome : ses aides sont à lui (portée de bloc), il n'en
  attend aucune de la tâche 1 ; scènes en bas de pile (`z-index: -1`, DANS la fenêtre : une image `loading="lazy"` hors fenêtre ne se décoderait jamais —
  la scène hors écran de `tests/theme.js` ne mesure pas de chargement) ; bases jetables (`withRepo`) ; `fetch` interdit ; aucune navigation (un segment
  n'est jamais cliqué : `navigate` changerait le fragment de la page de tests ; `dish.js:35` garde son retour `/library?tab=dishes`) ; `matchMedia` factice
  injecté par `deps` ; les lectures de `files` comptées sur l'instance de base (`db.get` ET `db.getMany`, les deux chemins de `repo.getFile` / `repo.getFiles`).

```js
    // ===== Tâche 2 — la carte-plat, la grille bornée et la Bibliothèque « Recettes » (spec D-UI-4, D-UI-5, I-UI-5, § 4.1, § 7 UI-1 T2)
    {
      const run = async (name, test) => { try { await test(); } catch (error) { ok(false, `Carnet T2 — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); } };
      const { withRepo } = await import('./sync-fixture.js');
      const { buildDocs } = await import('../src/domain/search.js');
      const K = await import('../src/ui/components.js');
      const L = await import('../src/ui/library.js');
      const { renderLibrary } = L;
      const BU = await import('../src/core/blob-urls.js');
      const { EN } = await import('../src/i18n/en.js');
      const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
      const localeAvant = getUiLocale();
      setUiLocale('fr'); // des textes français sont affirmés (rendue dans le finally)
      const DATE = '2026-10-23T12:00:00.000Z';
      const H = (c) => c.repeat(64); // une empreinte lisible : H('a') = « aaaa… » (64)
      const hex64 = (i) => i.toString(16).padStart(2, '0').repeat(32); // 70 empreintes DISTINCTES, admises par HASH (64 hex)
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
      // Une scène DANS la fenêtre, derrière la page (z-index -1, aucun pointeur) : les images lazy s'y chargent, et un décodage raté y lève error.
      const nouvelleScene = () => { const s = document.createElement('div'); s.style.cssText = 'position:fixed;left:0;top:0;width:900px;z-index:-1;pointer-events:none'; document.body.append(s); return s; };
      const imageTest = async (couleur = '#c63', l = 64, h = 48) => { const toile = new OffscreenCanvas(l, h); const cx = toile.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); return toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
      const ligneFichier = (sha, blob, mime = blob.type) => ({ sha256: sha, mime, blob, size: blob.size, syncable: true, created_at: DATE, updated_at: DATE });
      const fiche = (id, over = {}) => ({ id, edition_id: null, original_title: 'Plat ' + id, availability: 'available', verification_state: 'verified', printed_page: null, current_version_id: 'rv_' + id, favorite: false, created_at: DATE, updated_at: DATE, ...over });
      const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, total_minutes: null,
        ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }],
        provenance: { generated_by: 'manual' }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
      const docDe = (recipe, over = {}) => ({ recipe, version: null, book: null, edition: null, cooked: 0, ...over });
      // Le contexte d'une bibliothèque (motif de tests/ajouter.js, bloc « Liens web gardés ») : les docs sont ceux de buildDocs, la forme que recipeCard attend.
      const ctxDe = (recipes, { versions = [], editions = [], books = [] } = {}) => {
        const docs = buildDocs({ recipes, versions, editions, books, dishes: [], links: [] });
        return { book_editions: editions, recipes, recipe_versions: versions, source_documents: [], source_pages: [], rediscovery_prefs: [], dishes: [], dish_recipe_links: [],
          recipesById: new Map(recipes.map((r) => [r.id, r])), docs, docsByRecipe: new Map(docs.map((d) => [d.recipe.id, d])), scan_sessions: [], settings: {}, books,
          booksById: new Map(books.map((b) => [b.id, b])), editionsById: new Map(editions.map((e) => [e.id, e])), editionLabel: (e) => (e ? books.find((b) => b.id === e.book_id)?.title || '' : ''), cook_history: [], imports: [] };
      };
      // Un matchMedia factice : `matches` posé, écouteurs `change` notés, `bascule(m)` les appelle (F-5 : le même motif que la fiche recette, tâche 3).
      const fauxMatchMedia = (matches) => {
        const ecouteurs = [];
        const mq = { matches, addEventListener: (type, fn) => { if (type === 'change') ecouteurs.push(fn); }, removeEventListener: (type, fn) => { const i = ecouteurs.indexOf(fn); if (i >= 0) ecouteurs.splice(i, 1); } };
        return { matchMedia: (q) => { if (q !== '(min-width: 760px)') throw new Error('requête inattendue : ' + q); return mq; }, mq, ecouteurs, bascule(m) { mq.matches = m; for (const fn of [...ecouteurs]) fn({ matches: m }); } };
      };
      const texte = (n) => n?.textContent ?? null;
      // Espion des lectures de `files` sur l'instance de base : repo.getFile → db.get('files', sha), repo.getFiles → db.getMany('files', shas) (H-10 : les deux comptés).
      const espionnerLectures = (db) => { const lectures = []; const vraiGet = db.get.bind(db); const vraiGetMany = db.getMany.bind(db);
        db.get = (store, key) => { if (store === 'files') lectures.push(key); return vraiGet(store, key); };
        db.getMany = (store, keys) => { if (store === 'files') lectures.push(...keys); return vraiGetMany(store, keys); };
        return { lectures, rendre: () => { delete db.get; delete db.getMany; } }; };
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try {
        await run('recipeCard({ photoEnTete, fichier }) : décision synchrone, jamais de cadre vide, aucune lecture (D-UI-5, I-UI-5)', () => withRepo(async (repo, db) => {
          const jpeg = await imageTest();
          const { lectures, rendre } = espionnerLectures(db);
          const scene = nouvelleScene();
          try {
            const doc = docDe(fiche('rc_a', { photo_sha256: H('a') }));
            const avec = K.recipeCard(doc, { photoEnTete: true, fichier: ligneFichier(H('a'), jpeg) });
            const img = avec.firstElementChild;
            eq([avec.tagName, avec.className, avec.getAttribute('href'), img?.tagName, img?.className, img?.getAttribute('alt'), img?.getAttribute('loading'), img?.getAttribute('src')?.startsWith('blob:'), avec.querySelector(':scope > .carte-plat-corps > h3')?.textContent, avec.querySelectorAll('img').length],
              ['A', 'item-link carte-plat', '#/recipes/rc_a', 'IMG', 'plat-vignette grande', '', 'lazy', true, 'Plat rc_a', 1],
              'carte-plat avec octets image : a.item-link.carte-plat > img.plat-vignette.grande (alt vide, lazy, src blob:) puis le bloc de titre — décidé AU RETOUR de l’appel, sans attendre');
            const corps = (c) => c.querySelector(':scope > .carte-plat-corps');
            // text/html : mime ET blob — typeAffichage (lot G, F-9, mime.js:28-31) rend le type du blob s'il est admis, SINON celui de la ligne : un blob text/html sous
            // un mime image/jpeg est affiché jpeg (règle épinglée par le lot G, jamais touchée ici) ; ses octets indécodables suivent le chemin asynchrone testé plus bas.
            const SANS = [['aucune ligne files', null], ['ligne sans blob (octets pas ici)', { sha256: H('a'), mime: 'image/jpeg' }], ['text/html (mime et blob : hors liste)', ligneFichier(H('a'), new Blob(['<p>x</p>'], { type: 'text/html' }))],
              ['PDF (liste blanche, pas une image)', ligneFichier(H('a'), new Blob(['%PDF-1.4'], { type: 'application/pdf' }))], ['SVG (hors liste, blob et mime)', ligneFichier(H('a'), new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'image/svg+xml')]];
            eq(SANS.map(([nom, f]) => { const c = K.recipeCard(doc, { photoEnTete: true, fichier: f }); return [nom, c.className, c.querySelectorAll('img').length, !!corps(c), c.querySelector('h3')?.textContent]; }),
              SANS.map(([nom]) => [nom, 'item-link carte-plat sans-photo', 0, true, 'Plat rc_a']),
              'carte-plat sans octets affichables (aucune ligne, pas de blob, text/html, PDF, SVG) : a.item-link.carte-plat.sans-photo, le bloc de titre, AUCUNE img — jamais de cadre vide ni d’image générique (I-UI-5)');
            const heic = K.recipeCard(doc, { photoEnTete: true, fichier: ligneFichier(H('a'), jpeg, 'image/heic') });
            eq([heic.className, heic.querySelector('img.plat-vignette.grande')?.getAttribute('src')?.startsWith('blob:')], ['item-link carte-plat', true], 'carte-plat : une ligne image/heic dont le blob est image/jpeg s’affiche (le type du blob, dans la liste blanche, gagne — G, F-9)');
            // H-10 : la variante ne rend PAS vignettePlat et ne lit rien elle-même — un pointeur valide sans `fichier` ne fait ni img cachée ni getFile.
            const muette = K.recipeCard(doc, { photoEnTete: true, fichier: null });
            await tick(); await tick();
            eq([muette.querySelectorAll('img').length, lectures], [0, []], 'carte-plat : pointeur valide sans ligne passée → aucune img (pas même cachée), AUCUNE lecture de files (la variante ne rend pas vignettePlat)');
            // Des octets image/jpeg que le navigateur ne décode pas : l'img est retirée, la carte retombe sans photo, l'URL blob: révoquée (jamais un cadre d'image cassée).
            const faux = K.recipeCard(doc, { photoEnTete: true, fichier: ligneFichier(H('a'), new Blob(['pas une image'], { type: 'image/jpeg' })) });
            const u = faux.querySelector('img')?.getAttribute('src');
            eq(typeof u === 'string' && u.startsWith('blob:'), true, 'carte-plat : des octets image/jpeg indécodables ont d’abord une img (le type est admis : la décision est synchrone)');
            scene.append(faux);
            await attendre(() => faux.classList.contains('sans-photo'), 'octets indécodables : la carte retombe sans photo');
            eq([faux.querySelectorAll('img').length, !!corps(faux), BU.revoquerUrlDeBlob(u)], [0, true, false], 'carte-plat : au décodage raté, l’img est retirée, la carte passe .sans-photo avec son bloc de titre, et son URL blob: est déjà révoquée (revoquerUrlDeBlob rend false)');
            eq(K.recipeCard(doc).className, 'item-link card', 'recipeCard sans photoEnTete : la carte horizontale d’avant, inchangée (épinglée par tests/photo-plat.js)');
            const g = K.grilleCartes([avec, heic]);
            eq([g.tagName, g.className, [...g.children].map((c) => c.getAttribute('href'))], ['DIV', 'grille-plats', ['#/recipes/rc_a', '#/recipes/rc_a']], 'grilleCartes(noeuds) → div.grille-plats portant ses cartes, dans l’ordre');
          } finally { rendre(); scene.remove(); BU.revoquerUrlsDeBlob(); }
        }));

        // Les docs de référence des deux blocs suivants : une recette du web, une d'un livre (prep + cook), une sans durée, un signet non lu, une création IA, une saisie à la main.
        const livre = { id: 'b1', title: 'Le livre', author: 'A.' }; const ed = { id: 'e1', book_id: 'b1' };
        const web = docDe(fiche('rc_w', { source_url: 'https://recettes.test/tarte' }), { version: version('rc_w', { total_minutes: 35 }) });
        const duLivre = docDe(fiche('rc_l', { edition_id: 'e1' }), { version: version('rc_l', { prep_minutes: 10, cook_minutes: 30 }), book: livre, edition: ed });
        const sansDuree = docDe(fiche('rc_s', { edition_id: 'e1' }), { version: version('rc_s'), book: livre, edition: ed });
        const signet = docDe(fiche('rc_g', { availability: 'reference_only', source_url: 'https://a.test/x' }));
        const ia = docDe(fiche('rc_i', { origine: 'ia' }), { version: version('rc_i', { kind: 'synthesis', status: 'proposed', total_minutes: 20, provenance: { generated_by: 'ai', creation: { demande: 'tarte' } } }) });
        const main = docDe(fiche('rc_m', { source_label: 'Recette de famille' }), { version: version('rc_m', { total_minutes: 90 }) });

        await run('dureeTotale, ligneSource, badges : « {source} · {durée} », rien d’inventé (D-UI-5, B-I-6)', async () => {
          const source = (d) => texte(K.recipeCard(d, { photoEnTete: true }).querySelector('.carte-plat-source'));
          eq([K.dureeTotale(web.version), K.dureeTotale(duLivre.version), K.dureeTotale(sansDuree.version), K.dureeTotale(null), K.dureeTotale(ia.version), K.dureeTotale(version('x', { total_minutes: 5, prep_minutes: 1, cook_minutes: 1 })), K.dureeTotale(version('x', { total_minutes: '35' })), K.dureeTotale(version('x', { cook_minutes: 25 }))],
            [35, 40, null, null, null, 5, null, 25],
            'dureeTotale : total_minutes d’abord, sinon prep + cook (l’un des deux suffit), sinon null ; une création IA n’a pas de durée (C-6) ; une valeur non numérique vaut null');
          eq([source(web), source(duLivre), source(sansDuree), source(signet), source(ia), source(main)],
            ['Du web · recettes.test · 35 min', 'De mon livre · Le livre · 40 min', 'De mon livre · Le livre', 'Du web · a.test', 'Créée avec l’IA', 'Recette de famille · 1 h 30'],
            'ligne de source : « Du web · {hôte} » (hôte RECALCULÉ) ou « De mon livre · {titre} », puis « · {durée} » en UN nombre (formatMinutes) seulement quand une durée existe ; un signet non lu n’a pas de durée ; une fiche IA ou personnelle garde sa provenance');
          eq(K.ligneSource(docDe(fiche('rc_x', { source_url: 'pas une adresse' }))), 'Adresse non reconnue', 'ligneSource : une adresse illisible le dit (lienSignet), jamais le source_label stocké (S7)');
          const badges = (d) => [...K.recipeCard(d, { photoEnTete: true }).querySelectorAll('.carte-plat-corps > .carte-plat-badges > *')].map((b) => b.textContent);
          // Le badge de disponibilité est celui d'availabilityBadge, lu par le composant lui-même (« Recette disponible » aujourd'hui, « Disponible » dès T5, D-UI-10) :
          // ce test tient la CARTE (ordre et présence des badges), jamais le libellé — qui est à T5 (rév. 2).
          const dispo = K.availabilityBadge(fiche('rc_f')).textContent;
          eq([badges(signet), badges(docDe(fiche('rc_f', { favorite: true }), { cooked: 3 })), badges(web), badges(ia)],
            [['Lien web'], [dispo, '★ Favori', 'Cuisinée 3×'], [dispo], [dispo, 'Créée avec l’IA · non testée']],
            'carte-plat : les badges restent dans la carte, sous la ligne de source — « Lien web » pour un signet, le badge de disponibilité (texte d’availabilityBadge, court dès T5), ★ Favori, « Cuisinée {n}× », l’étiquette IA');
        });

        await run('styles.css : .grille-plats 1 colonne à 359 px, 2 dès 360, 2 à 899, 3 dès 900 et à 950 (D-UI-4, bornes exactes ; D-15) ; carte sans photo ≥ 7 rem sur --paper-2 ; image 4:3 ; h3 serif 1,3 rem (mesurés dans un cadre)', async () => {
          // La grille suit la LARGEUR DE LA FENÊTRE (@media) : une scène dans la page de tests ne la ferait pas varier. Un <iframe> about:blank par largeur,
          // hors écran, même origine (frame-src 'self' ; about:blank hérite de la politique), qui charge la feuille servie et adopte la grille.
          const jpeg = await imageTest();
          const cadre = async (largeur) => {
            const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'scène de mesure');
            f.style.cssText = `position:absolute;left:-12000px;top:0;width:${largeur}px;height:900px;border:0`;
            document.body.append(f);
            const d = f.contentDocument;
            d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><main class="content"></main></body></html>'); d.close();
            const lien = d.createElement('link'); lien.rel = 'stylesheet'; lien.href = new URL('../styles.css?v=' + Date.now(), location.href).href;
            await new Promise((r) => { lien.onload = r; lien.onerror = r; d.head.append(lien); });
            return f;
          };
          const fautes = [];
          // Les DEUX bornes de D-UI-4, de part et d'autre (359 | 360, 899 | 900), plus 950 (rév. 3, D-15) : un @media décalé rougit — à 370 (360 → 1 piste),
          // à 880 (899 → 3 pistes), à 1000 (900 ET 950 → 2 pistes : la largeur 950 tue le mutant « 900 → 1000 » quelle que soit la borne basse de la plage).
          for (const [largeur, colonnes] of [[359, 1], [360, 2], [899, 2], [900, 3], [950, 3]]) {
            const f = await cadre(largeur);
            try {
              const w = f.contentWindow; const d = f.contentDocument;
              if (w.innerWidth !== largeur) fautes.push(`cadre ${largeur} : innerWidth ${w.innerWidth}`);
              const g = K.grilleCartes([K.recipeCard(web, { photoEnTete: true, fichier: ligneFichier(H('a'), jpeg) }), K.recipeCard(duLivre, { photoEnTete: true }), K.recipeCard(sansDuree, { photoEnTete: true }), K.recipeCard(signet, { photoEnTete: true })]);
              d.querySelector('main').append(g); // adopté par le document du cadre : la feuille du cadre s'applique
              const cs = w.getComputedStyle(g);
              const pistes = cs.gridTemplateColumns.trim().split(/\s+/);
              const img = g.querySelector('img.plat-vignette.grande'); const r = img.getBoundingClientRect();
              const corps = g.querySelector('.carte-plat.sans-photo > .carte-plat-corps'); const cc = w.getComputedStyle(corps);
              const h3 = w.getComputedStyle(g.querySelector('.carte-plat h3'));
              const cartes = [...g.children].map((c) => Math.round(c.getBoundingClientRect().height));
              eq([largeur, cs.display, pistes.length, cs.columnGap, cs.alignItems, Math.abs(r.width / r.height - 4 / 3) < 0.02, w.getComputedStyle(img).objectFit, w.getComputedStyle(img).borderRadius, cc.minHeight, cc.backgroundColor, cc.borderRadius, h3.fontSize, /georgia/i.test(h3.fontFamily), cartes.slice(0, colonnes).every((h) => h === cartes[0])],
                [largeur, 'grid', colonnes, '19.2px', 'stretch', true, 'cover', '12px', '112px', 'rgb(241, 236, 227)', '12px', '20.8px', true, true],
                `styles.css à ${largeur} px : .grille-plats = grid à ${colonnes} colonnes, gap 1.2rem, align-items stretch ; l’image 4:3, recadrée, rayon 12 ; le bloc sans photo ≥ 7 rem (112 px) sur --paper-2 (#f1ece3), rayon 12 ; h3 serif 1,3 rem ; les cartes d’une même rangée ont la même hauteur (mesurés)`);
            } finally { f.remove(); }
          }
          eq(fautes, [], 'cadres de mesure : chaque iframe a la largeur demandée (359, 360, 899, 900, 950)');
          BU.revoquerUrlsDeBlob();
        });

        await run('Bibliothèque : Recettes par défaut, actions par segment, segments anciens valides, filtres par données, tri, pied, bouton mobile, « à importer » (§ 4.1)', () => withRepo(async () => {
          // A : de mon livre · B : du web (lue) · C : les deux · D : référence sans adresse (DEHORS, « à importer ») · E : signet non lu (DEDANS) · F : référence sans page.
          const A = fiche('rA', { edition_id: 'e1', updated_at: '2026-10-20T00:00:00.000Z' });
          const B = fiche('rB', { source_url: 'https://web.test/b', updated_at: '2026-10-22T00:00:00.000Z' });
          const C = fiche('rC', { edition_id: 'e1', source_url: 'https://web.test/c', updated_at: '2026-10-21T00:00:00.000Z' });
          const D = fiche('rD', { edition_id: 'e1', availability: 'reference_only', printed_page: 58 });
          const E = fiche('rE', { availability: 'reference_only', source_url: 'https://web.test/e', updated_at: '2026-10-23T00:00:00.000Z' });
          const F = fiche('rF', { edition_id: 'e1', availability: 'reference_only' });
          const ctx = ctxDe([A, B, C, D, E, F], { versions: [version('rA'), version('rB', { total_minutes: 35 }), version('rC')], editions: [ed], books: [livre] });
          const segment = (r) => texte(r.querySelector('.segmented button.active'));
          const action = (r) => { const a = r.querySelector('header .row.between.top > .row > a'); return a ? [a.className, a.getAttribute('href'), a.textContent] : null; };
          const titres = (r) => [...r.querySelectorAll('.grille-plats > a.carte-plat h3')].map((h) => h.textContent);
          const puce = (r, libelle) => [...r.querySelectorAll('button.puce')].find((b) => b.textContent === libelle);
          const pressees = (r) => [...r.querySelectorAll('button.puce')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
          const n = await renderLibrary({}, {}, ctx, fauxMatchMedia(false));
          eq([texte(n.querySelector('header h1')), texte(n.querySelector('header p.muted')), [...n.querySelectorAll('.segmented button')].map((b) => b.textContent), segment(n), action(n), !!n.querySelector('.grille-plats'), titres(n)],
            ['Bibliothèque', 'Tes livres, tes trouvailles, tes recettes.', ['Recettes', 'Livres', 'Plats'], 'Recettes', ['btn primary', '#/add', 'Ajouter une recette'], true, ['Plat rE', 'Plat rB', 'Plat rC', 'Plat rA']],
            'renderLibrary({}) : « Bibliothèque », son sous-titre, trois segments, Recettes ACTIF par défaut, « Ajouter une recette » → #/add en tête, la grille triée par dernière modification (E, B, C, A) ; la référence D est DEHORS, le signet non lu E DEDANS (B-I-5)');
          const carteE = n.querySelector('.grille-plats > a.carte-plat[href="#/recipes/rE"]');
          eq([carteE?.className, texte(carteE?.querySelector('.carte-plat-source')), [...(carteE?.querySelectorAll('.carte-plat-badges > *') || [])].map((b) => b.textContent), texte(n.querySelector('a.carte-plat[href="#/recipes/rB"] .carte-plat-source'))],
            ['item-link carte-plat sans-photo', 'Du web · web.test', ['Lien web'], 'Du web · web.test · 35 min'],
            'un signet non lu : carte sans photo, « Du web · {hôte} » sans durée, badge « Lien web » ; une recette web lue porte sa durée');
          puce(n, 'De mes livres').click(); await attendre(() => titres(n).length === 2, 'puce « De mes livres »');
          eq([titres(n), pressees(n)], [['Plat rC', 'Plat rA'], [['Toutes', 'false'], ['De mes livres', 'true'], ['Du web', 'false']]], '« De mes livres » = edition_id non nul (C puis A) ; une seule puce pressée (aria-pressed)');
          puce(n, 'Du web').click(); await attendre(() => titres(n).length === 3, 'puce « Du web »');
          eq(titres(n), ['Plat rE', 'Plat rB', 'Plat rC'], '« Du web » = source_url non nul (E, B, C) : une fiche qui a les deux est dans les deux (B-M-7) — un filtre de DONNÉES, jamais un appel');
          puce(n, 'Toutes').click(); await attendre(() => titres(n).length === 4, 'puce « Toutes »');
          const champ = n.querySelector('.stack input[type="search"]');
          // Après chaque frappe, l'attente borne le redessin (asynchrone : il relit les lignes files manquantes) ; au-delà, les titres du moment sont rendus tels quels (le diff se lit dans eq).
          const taper = async (q, attendu) => { champ.value = q; champ.dispatchEvent(new Event('input', { bubbles: true })); try { await attendre(() => JSON.stringify(titres(n)) === JSON.stringify(attendu), `filtre « ${q} »`); } catch { /* lu tel quel */ } return titres(n); };
          eq([champ.getAttribute('placeholder'), await taper('rb', ['Plat rB']), await taper('pomme', ['Plat rB', 'Plat rC', 'Plat rA']), await taper('le livre', ['Plat rC', 'Plat rA']), await taper('', ['Plat rE', 'Plat rB', 'Plat rC', 'Plat rA'])],
            ['Une recette, un ingrédient…', ['Plat rB'], ['Plat rB', 'Plat rC', 'Plat rA'], ['Plat rC', 'Plat rA'], ['Plat rE', 'Plat rB', 'Plat rC', 'Plat rA']],
            'le champ « Une recette, un ingrédient… » filtre LOCALEMENT sur le titre, les ingrédients de la version courante (« pomme » : A, B, C) et le titre du livre ; vidé, tout revient ; aucun appel, aucune navigation');
          const pied = n.querySelector('a[data-role="a-importer"]');
          eq([pied?.getAttribute('href'), pied?.textContent, !!(n.querySelector('.grille-plats').compareDocumentPosition(pied) & Node.DOCUMENT_POSITION_FOLLOWING)], ['#/library?tab=a-importer', 'Recettes de mes livres à importer →', true],
            'pied : « Recettes de mes livres à importer → » vers ?tab=a-importer, sous la grille, parce qu’une référence sans adresse existe');
          const sansRef = await renderLibrary({}, {}, ctxDe([A, B], { versions: [version('rA')], editions: [ed], books: [livre] }), fauxMatchMedia(false));
          eq(sansRef.querySelector('a[data-role="a-importer"]'), null, 'pied absent quand aucune référence n’est à importer (rien d’inventé)');
          // Les segments : ?tab=books et ?tab=dishes d'aujourd'hui restent valides ; ?tab=recettes aussi ; un ?tab inconnu vaut Recettes.
          const livres = await renderLibrary({}, { tab: 'books' }, ctx, fauxMatchMedia(false));
          const plats = await renderLibrary({}, { tab: 'dishes' }, ctx, fauxMatchMedia(false));
          const recettes = await renderLibrary({}, { tab: 'recettes' }, ctx, fauxMatchMedia(false));
          const inconnu = await renderLibrary({}, { tab: 'zzz' }, ctx, fauxMatchMedia(false));
          eq([segment(livres), action(livres), !!livres.querySelector('.grid.livres'), livres.querySelectorAll('.grid').length, !!livres.querySelector('.grille-plats'), segment(plats), action(plats), !!plats.querySelector('.grille-plats'), segment(recettes), !!recettes.querySelector('.grille-plats'), segment(inconnu), titres(inconnu).length],
            ['Livres', ['btn primary', '#/add/livre', 'Ajouter un livre'], true, 1, false, 'Plats', null, false, 'Recettes', true, 'Recettes', 4],
            '?tab=books : Livres actif, « Ajouter un livre » → #/add/livre (neuf, H-15), la grille des couvertures porte .grid.livres (§ 3.3 : minmax 170 px, règle de T1) et reste la seule .grid ; ?tab=dishes : Plats actif, AUCUNE action ; ?tab=recettes et un ?tab inconnu : la grille des plats');
          eq([[...livres.querySelectorAll('section.plain > h2')].map((h) => h.textContent), livres.querySelectorAll('section.card').length, livres.querySelector('section.plain a.item-link.card')?.getAttribute('href')],
            [['Liens web gardés'], 0, '#/recipes/rB'], 'sous Livres : « Liens web gardés » (B et E, signets sans livre, en carte horizontale) est une section PLAIN ; aucune section .card (D-UI-8)');
          // Le bouton mobile : a.btn.primary.big.block « Ajouter une recette » sous la grille, [hidden] ≥ 760 px (matchMedia injecté), suivi sur change tant qu'il est dans le document.
          const mm = fauxMatchMedia(true);
          const large = await renderLibrary({}, {}, ctx, mm);
          const bouton = (r) => r.querySelector('a[data-role="ajouter-mobile"]');
          eq([bouton(large)?.className, bouton(large)?.getAttribute('href'), bouton(large)?.textContent, bouton(large)?.hidden, bouton(n)?.hidden, !!(large.querySelector('.grille-plats').compareDocumentPosition(bouton(large)) & Node.DOCUMENT_POSITION_FOLLOWING), mm.ecouteurs.length],
            ['btn primary big block', '#/add', 'Ajouter une recette', true, false, true, 1],
            '« Ajouter une recette » répété sous la grille en a.btn.primary.big.block : [hidden] quand (min-width: 760px) est vraie, visible dessous ; un écouteur change posé');
          const scene = nouvelleScene();
          try {
            scene.append(large);
            mm.bascule(false); eq(bouton(large).hidden, false, 'le bouton suit la largeur : (min-width: 760px) devient fausse → visible');
            mm.bascule(true); eq(bouton(large).hidden, true, '… et redevient vraie → [hidden]');
          } finally { scene.remove(); }
          mm.bascule(false);
          eq([mm.ecouteurs.length, bouton(large).hidden], [0, true], 'hors du document, le prochain change retire l’écouteur sans rien toucher (aucune fuite par route)');
          // Vide : seules des références → l'état vide « Aucune recette pour l’instant. » + « Ajouter une recette », aucune grille — et le pied, puisque des références attendent.
          const vide = await renderLibrary({}, {}, ctxDe([D, F], { editions: [ed], books: [livre] }), fauxMatchMedia(false));
          eq([texte(vide.querySelector('.empty p')), vide.querySelector('.empty a.btn.primary')?.getAttribute('href'), texte(vide.querySelector('.empty a.btn.primary')), !!vide.querySelector('.grille-plats'), vide.querySelector('a[data-role="a-importer"]')?.getAttribute('href')],
            ['Aucune recette pour l’instant.', '#/add', 'Ajouter une recette', false, '#/library?tab=a-importer'], 'vide (seules des références) : « Aucune recette pour l’instant. » + « Ajouter une recette », aucune grille, le pied « à importer » reste');
          // ?tab=a-importer : segment Recettes actif, retour « ← Recettes », la liste compacte groupée par livre, « {titre} · p. N · À importer » → l'écran d'import ciblé.
          const ai = await renderLibrary({}, { tab: 'a-importer' }, ctx, fauxMatchMedia(false));
          const retour = ai.querySelector('header > a');
          eq([segment(ai), action(ai), retour?.getAttribute('href'), retour?.textContent, texte(ai.querySelector('section.plain > h2')), [...ai.querySelectorAll('section.plain h3')].map((h) => h.textContent), [...ai.querySelectorAll('section.plain li > a')].map((a) => [a.getAttribute('href'), a.textContent]), ai.querySelectorAll('section.card').length, !!ai.querySelector('.grille-plats')],
            ['Recettes', ['btn primary', '#/add', 'Ajouter une recette'], '#/library?tab=recettes', '← Recettes', 'Recettes de mes livres à importer', ['Le livre'], [['#/recipes/rD/importer', 'Plat rD · p. 58 · À importer'], ['#/recipes/rF/importer', 'Plat rF · À importer']], 0, false],
            '?tab=a-importer : segment Recettes actif, retour « ← Recettes » vers /library?tab=recettes (B-M-4), section plain « Recettes de mes livres à importer » groupée par livre, une ligne « {titre} · p. N · À importer » → #/recipes/<id>/importer par référence sans adresse (page d’abord, puis titre) ; le signet E n’y est pas');
          BU.revoquerUrlsDeBlob();
        }));

        await run('grille bornée : 70 recettes à photo → 60 cartes et EXACTEMENT 60 lectures (getFile et getFiles comptés), « Voir plus » en lit 10 ; révocation au redessin (F-9, D-T9)', () => withRepo(async (repo, db) => {
          const jpeg = await imageTest();
          // 70 recettes à photo, une empreinte DISTINCTE chacune, la plus récemment modifiée = la 69 ; les 70 lignes files partagent les mêmes octets (la base ne relit pas l'empreinte).
          const recettes = Array.from({ length: 70 }, (_, i) => fiche('rp' + String(i).padStart(2, '0'), { photo_sha256: hex64(i), original_title: 'Photo ' + String(i).padStart(2, '0'), updated_at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() }));
          await db.mutate({ puts: { files: recettes.map((r) => ligneFichier(r.photo_sha256, jpeg)) }, origin: 'device' });
          const { lectures, rendre } = espionnerLectures(db);
          const scene = nouvelleScene();
          const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
          try {
            const n = await renderLibrary({}, {}, ctxDe(recettes), fauxMatchMedia(false));
            scene.append(n);
            const cartes = () => [...n.querySelectorAll('.grille-plats > a.carte-plat')];
            const voirPlus = () => [...n.querySelectorAll('button')].find((b) => b.textContent === 'Voir plus') || null;
            const srcs = () => cartes().map((c) => c.querySelector('img.plat-vignette.grande')?.getAttribute('src'));
            eq([cartes().length, lectures.length, new Set(lectures).size, cartes()[0]?.querySelector('h3')?.textContent, cartes()[59]?.querySelector('h3')?.textContent, srcs().every((u) => typeof u === 'string' && u.startsWith('blob:')), voirPlus()?.className, L.CARTES_PAR_PAGE],
              [60, 60, 60, 'Photo 69', 'Photo 10', true, 'btn', 60],
              '70 recettes à photo : 60 cartes rendues (les 60 dernières modifiées), EXACTEMENT 60 lectures de files en UN getFiles des cartes rendues (aucun getFile : la carte ne lit rien), chaque carte avec son image ; « Voir plus » (button.btn) offert ; CARTES_PAR_PAGE = 60');
            voirPlus().click();
            await attendre(() => cartes().length === 70, '« Voir plus » rend la suite');
            eq([lectures.length, new Set(lectures).size, cartes()[69]?.querySelector('h3')?.textContent, voirPlus(), srcs().every((u) => typeof u === 'string' && u.startsWith('blob:'))], [70, 70, 'Photo 00', null, true],
              '« Voir plus » rend les 10 suivantes et en lit EXACTEMENT 10 de plus (70 au total, aucune relecture des 60 premières) ; plus rien à montrer : le bouton disparaît');
            // D-T9 : un redessin (le filtre) révoque EXACTEMENT les URL des vignettes précédentes, chacune APRÈS le vidage (plus sous aucun img du document) ; les lignes files
            // gardées ne sont pas relues ; les cartes neuves ont des URL vivantes. L'espion note chaque révocation et si l'URL est encore sous un <img> à cet instant.
            const dansLeDocument = (u) => [...document.querySelectorAll('img')].some((i) => i.getAttribute('src') === u);
            URL.revokeObjectURL = (u) => { revoquees.push({ u, encore: dansLeDocument(u) }); return vraiRevoke.call(URL, u); };
            const avant = srcs();
            const sentinelle = BU.urlDeBlob(new Blob(['sentinelle']));
            const champ = n.querySelector('.stack input[type="search"]');
            champ.value = 'photo 6'; champ.dispatchEvent(new Event('input', { bubbles: true })); // « Photo 60 » à « Photo 69 »
            await attendre(() => cartes().length === 10 && revoquees.length >= avant.length, 'filtre « photo 6 » et révocations du redessin');
            eq([revoquees.map((x) => x.u).sort(), revoquees.filter((x) => x.encore).length, lectures.length, cartes().map((c) => c.querySelector('h3').textContent), srcs().every((u) => typeof u === 'string' && u.startsWith('blob:') && !revoquees.some((x) => x.u === u)), BU.revoquerUrlDeBlob(sentinelle)],
              [[...avant].sort(), 0, 70, ['Photo 69', 'Photo 68', 'Photo 67', 'Photo 66', 'Photo 65', 'Photo 64', 'Photo 63', 'Photo 62', 'Photo 61', 'Photo 60'], true, true],
              'redessin par le filtre : les 70 URL précédentes révoquées (compte exact), chacune APRÈS le vidage ; aucune nouvelle lecture (lignes gardées) ; 10 cartes neuves aux URL vivantes ; la sentinelle d’autrui reste vivante');
          } finally { URL.revokeObjectURL = vraiRevoke; rendre(); scene.remove(); BU.revoquerUrlsDeBlob(); }
        }));

        await run('en.js et filets i18n : les textes neufs de la tâche 2 (§ 5), l’interface anglaise', () => withRepo(async () => {
          const CLES = { 'Tes livres, tes trouvailles, tes recettes.': 'Your books, your finds, your recipes.', 'Recettes': 'Recipes', 'Ajouter une recette': 'Add a recipe', 'Une recette, un ingrédient…': 'A recipe, an ingredient…',
            'Toutes': 'All', 'De mes livres': 'From my books', 'Du web': 'From the web', 'Recettes de mes livres à importer': 'Recipes from my books to import', 'Voir plus': 'Show more', 'À importer': 'To import',
            'Du web · {h}': 'From the web · {h}', 'De mon livre · {t}': 'From my book · {t}', 'Aucune recette pour l’instant.': 'No recipes yet.' };
          eq(Object.entries(CLES).filter(([k, v]) => EN[k] !== v).map(([k]) => k), [], 'en.js : chaque texte neuf de la tâche 2 a sa traduction exacte (§ 5)');
          const { CHAINES_NEUVES_AILLEURS } = await import('./ajouter.js');
          const deComponents = ['Du web · {h}', 'De mon livre · {t}'];
          eq([Object.keys(CLES).filter((k) => !deComponents.includes(k) && !(CHAINES_NEUVES_AILLEURS['../src/ui/library.js'] || []).includes(k)), deComponents.filter((k) => !(CHAINES_NEUVES_AILLEURS['../src/ui/components.js'] || []).includes(k)), (CHAINES_NEUVES_AILLEURS['../src/ui/library.js'] || []).includes('Bibliothèque')],
            [[], [], true], 'filet i18n (tests/ajouter.js) : les chaînes neuves de library.js (« Bibliothèque » comprise) et de components.js sont déclarées dans CHAINES_NEUVES_AILLEURS');
          setUiLocale('en');
          try {
            // rx plus récente que ry : l'ordre attendu vient du tri, jamais de la stabilité d'Array.prototype.sort sur des dates égales (rév. 2).
            const en = await renderLibrary({}, {}, ctxDe([fiche('rx', { source_url: 'https://web.test/x', updated_at: '2026-10-24T00:00:00.000Z' }), fiche('ry', { edition_id: 'e1' }), fiche('rz', { edition_id: 'e1', availability: 'reference_only', printed_page: 3 })], { versions: [version('rx', { total_minutes: 35 }), version('ry', { prep_minutes: 5, cook_minutes: 5 })], editions: [ed], books: [livre] }), fauxMatchMedia(false));
            eq([texte(en.querySelector('header h1')), texte(en.querySelector('header p.muted')), [...en.querySelectorAll('.segmented button')].map((b) => b.textContent), [...en.querySelectorAll('button.puce')].map((b) => b.textContent), [...en.querySelectorAll('.carte-plat-source')].map(texte), texte(en.querySelector('a[data-role="a-importer"]')), en.querySelector('.stack input[type="search"]')?.getAttribute('placeholder') ?? null],
              ['Library', 'Your books, your finds, your recipes.', ['Recipes', 'Books', 'Dishes'], ['All', 'From my books', 'From the web'], ['From the web · web.test · 35 min', 'From my book · Le livre · 10 min'], 'Recipes from my books to import →', 'A recipe, an ingredient…'],
              'en : en-tête, segments, puces, lignes de source, pied et champ rendus par t() (la durée reste formatMinutes)');
            const enAI = await renderLibrary({}, { tab: 'a-importer' }, ctxDe([fiche('rz', { edition_id: 'e1', availability: 'reference_only', printed_page: 3 })], { editions: [ed], books: [livre] }), fauxMatchMedia(false));
            eq([texte(enAI.querySelector('header > a')), texte(enAI.querySelector('section.plain > h2')), texte(enAI.querySelector('section.plain li > a'))], ['← Recipes', 'Recipes from my books to import', 'Plat rz · p. 3 · To import'], 'en : la liste « à importer » (retour, titre, ligne) rendue par t()');
          } finally { setUiLocale('fr'); }
        }));
      } finally { globalThis.fetch = vraiFetch; setUiLocale(localeAvant); BU.revoquerUrlsDeBlob(); }
    }
```

  Compte des assertions neuves de ce bloc : **40** (carte-plat 8, ligne de source et badges 4, cadres 6 — cinq largeurs, 359, 360, 899, 900, 950, et
  `fautes` —, Bibliothèque 15, grille bornée 3, en.js et filets 4 ; rév. 3 : + 1 par la largeur 950, D-15) ; un `run` qui lève ajoute UN rouge de plus. Les
  amendements du Step 2 ne changent aucun compte. L'épingle (Step 9) se relève à la valeur MESURÉE dans « obtenu » (attendue, par raisonnement : celle
  laissée par la tâche 1 + 40), jamais à ce compte.

- [ ] **Step 2 : amender les tests existants** (spec § 7 UI-1 T2 ; chaque site retrouvé par son TEXTE ; aucun compte d'assertions ne change).
  - `tests/ajouter.js`, bloc « § 6 Couverture » (l. 3675 à `f3672be`) : `const biblio = await renderLibrary({}, {}, ctx);` →
    `const biblio = await renderLibrary({}, { tab: 'books' }, ctx); // UI-1 T2 : la bibliothèque s'ouvre sur Recettes ; ce bloc affirme la grille des couvertures`.
  - `tests/ajouter.js`, bloc « Confort après preuve (17 octobre, item 1) » : les SEPT appels `renderLibrary({}, {}, ctxDe(` des l. 3734, 3738, 3743, 3744,
    3745, 3751, 3757 deviennent `renderLibrary({}, { tab: 'books' }, ctxDe(` (la l. 3748, déjà `{ tab: 'dishes' }`, ne change pas) ; la l. 3729 :
    `const bloc = (n) => [...n.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Liens web gardés') || null;` →
    `section.plain` (D-UI-8 : « Liens web gardés » bascule en plain ; la l. 3667 `blocCouverture`, qui lit `section.card` pour « Couverture », reste).
    Un commentaire au-dessus de la l. 3729 : `// UI-1 T2 : « Liens web gardés » est une section PLAIN (sectionPlain, D-UI-8) sous le segment Livres, que ces appels nomment par { tab: 'books' }.`
  - `tests/creer-ia.js`, bloc « Bibliothèque (N-7) » : l. 1511 `const sections = (racine) => [...racine.querySelectorAll('section.card')]…` et l. 1512
    `const sectionIA = (racine) => [...racine.querySelectorAll('section.card')]…` → `section.plain` (les deux) ; l. 1513, 1516, 1517 :
    `renderLibrary({}, {}, ctxBiblio(` → `renderLibrary({}, { tab: 'books' }, ctxBiblio(` (trois sites) ; un commentaire au-dessus de la l. 1511 :
    `// UI-1 T2 : les deux sections vivent sous Livres ({ tab: 'books' }) et sont PLAIN (D-UI-8).`
  - `tests/photo-plat.js`, bloc « styles.css : la règle .plat-vignette », l. 1322-1323 : le commentaire et l'assertion deviennent

```js
      // Ronde 1 : la PREMIÈRE règle seule était lue — une règle plus loin (`.card .plat-vignette { width: 160px }`) la surchargeait sans rouge. UI-1 T2 (F-7, K-2) :
      // deux règles neuves la complètent, `.grande` (carte-plat, 4:3 ; la MÊME règle que UI-2, au caractère près : R-UI1-1) et `.petite` (48 px, ligne compacte
      // de la fiche livre) — EXACTEMENT trois sélecteurs, dans cet ordre (UI-2 en épingle deux : à la fusion, cette version à trois vaut).
      eq([...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => /\.plat-vignette\b/.test(s)), ['.plat-vignette', '.plat-vignette.grande', '.plat-vignette.petite'],
        'styles.css : exactement trois sélecteurs nomment .plat-vignette — la règle 72 px, puis .grande et .petite, dans cet ordre (aucune surcharge ailleurs)');
```

  (la l. 1320, qui épingle les six déclarations de la règle 72 px, et la l. 1317, qui ne lit que `.plat-vignette {` nue, ne changent pas.) **R-UI1-2
  (rév. 3)** : les l. 1327-1331 du même fichier (le test « CSP et sources (I-F3, …) », `srcPP`, `srcK`, `srcMeals`) sont à UI-2 seul, qui les étend à
  `search.js` et `library.js` : cette tâche — et aucune autre de ce plan — ne les touche (vérifié).

- [ ] **Step 3 : rouge lu** — `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` (le worktree est servi sur 8096). Attendu : `BILAN : ❌ …`
  avec, pour les BONNES raisons :
  - `tests/carnet.js`, bloc T2 : « carte-plat avec octets image » rouge (`className` obtenu `item-link card`, les options `photoEnTete` / `fichier` ignorées),
    puis le `run` lève (`K.grilleCartes is not a function`) ; « dureeTotale… » lève (`K.dureeTotale is not a function`) ; « styles.css… » lève de même ;
    « Bibliothèque… » rouge dès la première assertion (`segment(n)` obtenu `Livres`, titre « Mes livres », action « Ajouter ») puis lève sur
    `puce(n, 'De mes livres').click()` (`undefined`) ; « grille bornée » rouge (aucune `.grille-plats`, 0 carte) puis lève sur `voirPlus().click()` ;
    « en.js et filets » rouge (treize clés absentes, `CHAINES_NEUVES_AILLEURS['../src/ui/library.js']` indéfini).
  - `tests/ajouter.js` : les assertions qui passent par `bloc()` / `titres()` (l. 3735-3736, 3743-3746, 3752, 3758) rouges — `section.plain` introuvable
    (les sections sont encore `.card`) ; les sept `{ tab: 'books' }` restent verts (`books` est l'onglet d'aujourd'hui : garde de régression).
  - `tests/creer-ia.js` : l. 1514, 1515, 1516, 1518 rouges (même cause).
  - `tests/photo-plat.js` l. 1323 : rouge, obtenu `['.plat-vignette']`.
  - `tests/tests.js:250` : rouge (+37 assertions, épingle de la tâche 1 inchangée).
  Aucun autre rouge : un rouge ailleurs (theme.js, sync.js) est un constat, pas un rouge attendu. `node --test tools/*.test.mjs` et `--check` : inchangés (verts).

- [ ] **Step 4 : implémenter `src/ui/components.js`.** La signature de `recipeCard` (l. 188) gagne `photoEnTete` et `fichier` et délègue à `cartePlat` ; le
  corps de la carte horizontale ne change pas d'un octet (épinglé par `tests/photo-plat.js:1145-1180`, « référence construite »). Aucun import neuf : tout
  est déjà en tête du module (`el`, `formatMinutes`, `t`, `lienSignet`, `urlDeBlob`, `revoquerUrlDeBlob`, `displayUrl`, `typeAffichage`, `estCreationIA`).

```js
// doc : { recipe, version, book, edition, cooked }
// Lot UI-1 (D-UI-5) : `photoEnTete: true` rend la carte-plat VERTICALE (cartePlat, ci-dessous) à partir de `fichier`, la ligne files que l'appelant a lue
// en une fois ; sans l'option, la carte horizontale d'avant, inchangée (épinglée par tests/photo-plat.js, « référence construite »).
export function recipeCard(doc, { extra = null, href = null, reasons = null, photoEnTete = false, fichier = null } = {}) {
  if (photoEnTete) return cartePlat(doc, { fichier, href, extra });
  const { recipe, version, book, edition } = doc;
  const etiquette = etiquetteIA(version, recipe); // C-2 : depuis doc.version ou recipe.origine
  return el('a', { class: 'item-link card', href: href || `#/recipes/${recipe.id}` },
    el('div', { class: 'row between top' },
      el('div', { style: { flex: '1', minWidth: '0' } },
        el('h3', null, recipe.display_title || recipe.original_title),
        el('div', { class: 'muted', style: { fontSize: '.85rem' } }, provenanceText(recipe, book, edition)),
        etiquette ? el('div', null, etiquette) : null,
        version ? el('div', { class: 'muted', style: { fontSize: '.85rem' } }, timeText(version)) : null,
        reasons?.length ? el('div', { class: 'muted', style: { fontSize: '.8rem' } }, `${t('Correspond à')} : ${reasons.slice(0, 4).join(', ')}`) : null),
      el('div', { class: 'col', style: { alignItems: 'flex-end', gap: '.3rem' } },
        vignettePlat(recipe),
        availabilityBadge(recipe),
        recipe.favorite ? el('span', { class: 'badge' }, '★ ' + t('Favori')) : null,
        doc.cooked ? el('span', { class: 'badge' }, t('Cuisinée {n}×', { n: doc.cooked })) : null)),
    extra);
}

// --- Lot UI-1 « Carnet » : la carte-plat et sa grille (spec D-UI-4, D-UI-5, I-UI-5, § 3.3) --------------------------------------------------------
// dureeTotale(version) : PURE. UN nombre de minutes — total_minutes, sinon prep + cook dès que l'un des deux existe — ou null : rien sans durée (B-I-6),
// jamais la paire « actif · total » de timeText. Une création IA n'a qu'une estimation, dite à part sur sa fiche (C-6, comme timeText). Une valeur
// qui n'est pas un nombre fini (fiche reçue ou restaurée) vaut null.
export function dureeTotale(version) {
  if (!version || estCreationIA(version)) return null;
  const nombre = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const total = nombre(version.total_minutes);
  if (total !== null) return total;
  const prep = nombre(version.prep_minutes); const cook = nombre(version.cook_minutes);
  return prep === null && cook === null ? null : (prep || 0) + (cook || 0);
}

// ligneSource(doc) : PURE. « Du web · {hôte} » quand la fiche a une adresse lisible (hôte RECALCULÉ par lienSignet, jamais source_label : S7), sinon
// « De mon livre · {titre} » quand elle vient d'un livre, sinon sa provenance d'avant (provenanceText : étiquette IA, source personnelle, adresse non
// reconnue) ; puis « · {durée} » (formatMinutes) seulement quand dureeTotale en donne une. Une fiche qui a un livre ET une adresse est une page web rangée
// dans un livre : son texte vient du web, la ligne dit le web (le filtre « De mes livres » la garde, lui : D-UI-4).
export function ligneSource(doc) {
  const { recipe, book, edition, version } = doc;
  const lien = recipe?.source_url ? lienSignet(recipe.source_url) : null;
  const source = lien?.ok ? t('Du web · {h}', { h: lien.hote }) : book ? t('De mon livre · {t}', { t: book.title || t('Sans titre') }) : provenanceText(recipe, book, edition);
  const duree = dureeTotale(version);
  return duree === null ? source : `${source} · ${formatMinutes(duree)}`;
}

// cartePlat(doc, { fichier, href, extra }) : la carte-plat verticale. La décision est SYNCHRONE et ne lit rien : `fichier` (la ligne files passée par
// l'appelant, lue en une fois par repo.getFiles) est sa seule source d'image (I-UI-5) ; quand typeAffichage en fait une image (liste blanche ; le type du
// blob gagne : G, F-9), img.plat-vignette.grande 4:3 (alt vide : la carte porte le titre ; la classe plat-vignette la soumet à la révocation au redessin,
// D-T9) ; sinon .sans-photo, le bloc de titre sur --paper-2 — jamais de cadre vide ni d'image générique. Des octets que le navigateur ne décode pas (HEIC
// hors Safari, octets tronqués) lèvent error : l'img est retirée, la carte passe .sans-photo, son URL révoquée. La variante ne rend PAS vignettePlat (H-10).
function cartePlat(doc, { fichier = null, href = null, extra = null } = {}) {
  const { recipe, version } = doc;
  const type = typeAffichage(fichier);
  const affichable = !!type && type.startsWith('image/');
  const carte = el('a', { class: `item-link carte-plat${affichable ? '' : ' sans-photo'}`, href: href || `#/recipes/${recipe.id}` });
  if (affichable) {
    const u = displayUrl(fichier, urlDeBlob);
    const img = el('img', { class: 'plat-vignette grande', alt: '', loading: 'lazy', src: u });
    img.addEventListener('error', () => { img.remove(); carte.classList.add('sans-photo'); revoquerUrlDeBlob(u); }, { once: true });
    carte.append(img);
  }
  const badges = [availabilityBadge(recipe), etiquetteIA(version, recipe), recipe.favorite ? el('span', { class: 'badge' }, '★ ' + t('Favori')) : null,
    doc.cooked ? el('span', { class: 'badge' }, t('Cuisinée {n}×', { n: doc.cooked })) : null].filter(Boolean);
  carte.append(el('div', { class: 'carte-plat-corps' },
    el('h3', null, recipe.display_title || recipe.original_title),
    el('div', { class: 'muted carte-plat-source' }, ligneSource(doc)),
    badges.length ? el('div', { class: 'row carte-plat-badges' }, ...badges) : null),
  extra);
  return carte;
}

// grilleCartes(noeuds) : div.grille-plats (2 colonnes dès 360 px, 3 dès 900 px : styles.css) ; `.grid` reste la grille des couvertures.
export function grilleCartes(noeuds) { return el('div', { class: 'grille-plats' }, ...noeuds); }
```

  Posées APRÈS `recipeCard` et AVANT le commentaire de `bookCover` (« La vignette d'un livre (spec § 6) … », l. 207).

- [ ] **Step 5 : implémenter `styles.css`.** Juste après la règle `.plat-vignette` (l. 270, inchangée, et son commentaire l. 269), dans cet ordre (l'épingle de
  `tests/photo-plat.js:1323` lit les sélecteurs dans l'ordre du source : `.plat-vignette`, `.plat-vignette.grande`, `.plat-vignette.petite`, et AUCUNE autre
  règle du lot ne nomme `.plat-vignette`). Jetons seulement (T-2), aucun `display:none` (T-1), aucun `56px` (T-11), aucun `:hover` (le `.item-link:hover h3`
  existant suffit). **R-UI1-1 (rév. 3)** : la règle `.plat-vignette.grande` est celle du lot UI-2, AU CARACTÈRE PRÈS (`border-radius: 12px` en dur, la valeur
  de `--radius`, et `display: block` : T-2 ne vise que les couleurs ; `object-fit: cover` y est écrit, le test du cadre le mesure) — UI-2 la fait suivre de
  `figure.apercu { margin: 0 0 .6rem }`, que ce plan N'ÉCRIT PAS : à la fusion, `styles.css` se résout par union (`.grande` identique écrite une fois,
  `figure.apercu` gardée, puis `.petite` : l'épingle « trois sélecteurs » reste vraie, `figure.apercu` ne nomme pas `.plat-vignette`) :

```css
/* Lot UI-1 (D-UI-5, § 3.3) : les deux tailles de la vignette d'une carte — « grande » = l'image 4:3 en tête d'une carte-plat ; « petite » = 48 × 48 sur
   une ligne compacte (fiche d'un livre, tâche 4). La règle 72 px ci-dessus reste celle de la carte horizontale. R-UI1-1 : la règle .grande est ÉCRITE AU
   CARACTÈRE PRÈS comme celle du lot UI-2 (branche apercus-web, fusionné avant), posée au même endroit — la fusion la résout par union, à l'identique. */
.plat-vignette.grande { width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; display: block }
.plat-vignette.petite { width: 48px; height: 48px; }
/* Lot UI-1 (D-UI-4, F-9) : la grille des cartes-plat — 1 colonne sous 360 px, 2 dès 360 px, 3 dès 900 px ; les cartes d'une rangée s'étirent à la même
   hauteur. .grid reste la grille des couvertures. */
.grille-plats { display: grid; gap: 1.2rem; grid-template-columns: minmax(0, 1fr); align-items: stretch; }
@media (min-width: 360px) { .grille-plats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 900px) { .grille-plats { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
/* D-UI-5 : la carte-plat, verticale — l'image puis le bloc de titre (h3 serif 1,3 rem, ligne de source, badges) ; sans photo, le bloc de titre est posé
   sur --paper-2 (même rayon, 7 rem au moins pour aligner les rangées, titre en bas) : jamais de cadre vide ni d'image générique. */
.carte-plat { display: flex; flex-direction: column; gap: .55rem; min-width: 0; }
.carte-plat .carte-plat-corps { display: flex; flex-direction: column; gap: .3rem; min-width: 0; flex: 1; }
.carte-plat h3 { font-size: 1.3rem; margin: 0; }
.carte-plat .carte-plat-source { font-size: .9rem; }
.carte-plat .carte-plat-badges { gap: .35rem; }
.carte-plat.sans-photo .carte-plat-corps { background: var(--paper-2); border-radius: var(--radius); padding: .9rem 1rem; min-height: 7rem; justify-content: flex-end; }
```

  `tests/theme.js` reste vert sans changement : T-2 (ni `#…`, ni `rgba(`, ni couleur nommée : `auto`, `cover`, `stretch`, `column`, `flex`, `grid` n'en
  sont pas), T-1 (inventaire des `display:none` intact ; le bouton mobile se cache par `[hidden]`), T-11 (aucun `56px`), survol (aucun `:hover` neuf).

- [ ] **Step 6 : implémenter `src/ui/library.js`.** L'en-tête (l. 1-27 à `f3672be`) est remplacé par ce qui suit ; `carteOuLien` et `dishesTab`
  restent tels quels (les noms d'icônes de leurs états vides sont ceux de la tâche 1) ; `booksTab` ne change que d'UNE ligne (l. 58 à `f3672be`) :
  `const grid = el('div', { class: 'grid' });` → `const grid = el('div', { class: 'grid livres' }); // § 3.3 : couvertures minmax(170px, 1fr) — la règle .grid.livres de T1`
  (le reste de la fonction, `getFiles`, `draw()` et sa révocation, est intact ; `tests/ajouter.js:3758` lit `.grid` et reste vert) ; `liensWebGardes` et
  `recettesCreeesIA` passent de `section(` à `sectionPlain(` (deux sites, l. 41 et l. 49, leur commentaire inchangé). `renderLibrary` prend un quatrième
  paramètre `deps` (le motif des autres routes : `renderSearch`, `renderRecipe`) ; `app.js` l'appelle toujours par `route('/library', renderLibrary)` sans
  rien passer : le défaut vaut.

```js
// Bibliothèque (lot UI-1, D-UI-4) : trois segments — Recettes (la grille des cartes-plat, par défaut), Livres (grille de couvertures, « Liens web gardés »,
// « Recettes créées avec l’IA »), Plats — et la liste « à importer » (?tab=a-importer : segment Recettes actif, retour « ← Recettes »). Les adresses
// ?tab=books et ?tab=dishes d'avant restent valides (dish.js:35 y revient) ; un ?tab inconnu vaut Recettes. Vue Plats : spec §17, §30, §32.
import { el, promptDialog, toast } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { pageHeader, bookCover, segmented, emptyState, section, sectionPlain, recipeCard, grilleCartes, remplacerEnRevoquant } from './components.js';
import { revoquerUrlDeBlob } from '../core/blob-urls.js';
import { proposeDishesForRecipe } from '../domain/dishes.js';
import { pointeurValide } from '../domain/photo-web.js';

const TABS = ['recettes', 'books', 'dishes', 'a-importer'];
export const CARTES_PAR_PAGE = 60; // F-9 : la grille est bornée ; « Voir plus » rend la page suivante
const aUneAdresse = (r) => typeof r?.source_url === 'string' && r.source_url !== '';
// B-I-5 : la grille montre les recettes CONSERVÉES et les signets (lus ou non) ; une référence d'index sans adresse est « à importer », pas une recette.
export const dansLaGrille = (r) => r.availability !== 'reference_only' || aUneAdresse(r);
// La liste « à importer » et son pied : les références sans adresse d'un livre (le pied n'est offert que s'il y en a : rien d'inventé).
export const estAImporter = (r) => r.availability === 'reference_only' && !aUneAdresse(r) && !!r.edition_id;
// Puces Toutes / De mes livres / Du web, calculées sur les DONNÉES (edition_id, source_url) : une fiche qui a les deux est dans les deux (B-M-7).
// Un filtre de données, jamais un appel : le segment « Web » de la RECHERCHE reste l'appel payant (I-UI-1).
export const passeLaPuce = (r, puce) => puce === 'toutes' || (puce === 'livres' ? !!r.edition_id : aUneAdresse(r));
// Tri de la grille : dernière modification d'abord (§ 13, point 5), updated_at puis created_at en repli, sans horodatage en dernier.
const quandModifie = (r) => String(r.updated_at || r.created_at || '');
const derniereModificationDabord = (a, b) => (quandModifie(a.recipe) < quandModifie(b.recipe) ? 1 : quandModifie(a.recipe) > quandModifie(b.recipe) ? -1 : 0);
// Le filtre local (même mécanique que celui des livres, booksTab) : titre, ingrédients de la version courante, titre du livre — calculé une fois par doc.
const meule = (d) => [d.recipe.original_title, d.recipe.display_title, d.book?.title, ...(d.version?.ingredients || []).map((ri) => ri.name_text || ri.source_text)].filter(Boolean).join(' ').toLowerCase();
// Ordre de la liste « à importer » (celui de la fiche du livre) : page imprimée, puis titre.
const parPageEtTitre = (a, b) => (a.printed_page ?? 99999) - (b.printed_page ?? 99999) || String(a.original_title || '').localeCompare(String(b.original_title || ''));

export async function renderLibrary(params, query, ctx, deps = {}) {
  const { matchMedia = (q) => window.matchMedia(q) } = deps;
  const tab = TABS.includes(query.tab) ? query.tab : 'recettes';
  const segment = tab === 'a-importer' ? 'recettes' : tab;
  // L'action d'en-tête suit le segment : « Ajouter une recette » sur Recettes, « Ajouter un livre » sur Livres (→ #/add/livre, H-15), rien sur Plats.
  const actions = segment === 'books' ? [el('a', { class: 'btn primary', href: '#/add/livre' }, t('Ajouter un livre'))]
    : segment === 'recettes' ? [el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter une recette'))] : [];
  const root = el('div', null,
    pageHeader(t('Bibliothèque'), { subtitle: t('Tes livres, tes trouvailles, tes recettes.'), actions, back: tab === 'a-importer' ? { href: '/library?tab=recettes', label: t('Recettes') } : null }),
    el('div', { style: { marginBottom: '1rem' } }, segmented([{ value: 'recettes', label: t('Recettes') }, { value: 'books', label: t('Livres') }, { value: 'dishes', label: t('Plats') }], segment, (v) => navigate('/library' + buildQuery({ tab: v })))));
  if (tab === 'dishes') root.append(await dishesTab(ctx));
  else if (tab === 'books') {
    root.append(await booksTab(ctx));
    // APRÈS booksTab, y compris quand il rend l'état vide : un signet sans livre n'a pas d'autre place, et le bouton
    // « ← Bibliothèque » de sa fiche y ramène (confort après preuve, 17 octobre). D-UI-8 : les deux sections sont PLAIN.
    const liens = liensWebGardes(ctx);
    if (liens) root.append(liens);
    const creees = recettesCreeesIA(ctx); // N-7 : après « Liens web gardés »
    if (creees) root.append(creees);
  } else if (tab === 'a-importer') root.append(aImporterTab(ctx));
  else root.append(await recettesTab(ctx, { matchMedia }));
  return root;
}

// Le segment Recettes (§ 4.1 ; D-UI-4, D-UI-5, F-9) : le filtre local, les puces de source, la grille BORNÉE de cartes-plat, « Voir plus », le bouton
// « Ajouter une recette » répété sous 760 px, le pied « à importer ». Rien n'est écrit ; rien ne part.
async function recettesTab(ctx, { matchMedia }) {
  const docs = (ctx.docs || []).filter((d) => dansLaGrille(d.recipe)).sort(derniereModificationDabord);
  const refs = (ctx.recipes || []).filter(estAImporter);
  const pied = refs.length ? el('p', { style: { marginTop: '1rem' } }, el('a', { href: '#/library?tab=a-importer', dataset: { role: 'a-importer' } }, `${t('Recettes de mes livres à importer')} →`)) : null;
  if (!docs.length) return el('div', null, emptyState('assiette', t('Aucune recette pour l’instant.'), el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter une recette'))), pied);
  const meules = new Map(docs.map((d) => [d.recipe.id, meule(d)]));
  const etat = { puce: 'toutes', limite: CARTES_PAR_PAGE };
  // F-9 : les lignes files des cartes RENDUES, lues en UNE fois par page (repo.getFiles) et gardées — un redessin (filtre, puce) ne relit rien, « Voir
  // plus » ne lit que les empreintes qu'il découvre ; jamais toute la bibliothèque d'un coup. Une empreinte sans ligne vaut null (lue, absente). La carte,
  // elle, ne lit rien (I-UI-5) : elle reçoit sa ligne.
  const fichiers = new Map();
  const lire = async (page) => {
    const empreintes = [...new Set(page.filter((d) => pointeurValide(d.recipe)).map((d) => d.recipe.photo_sha256).filter((s) => !fichiers.has(s)))];
    if (!empreintes.length) return;
    const lues = await repo.getFiles(empreintes);
    for (const s of empreintes) fichiers.set(s, lues.get(s) || null);
  };
  const filtre = el('input', { type: 'search', placeholder: t('Une recette, un ingrédient…'), 'aria-label': t('Une recette, un ingrédient…') });
  const puces = el('div', { class: 'puces' });
  const grille = grilleCartes([]);
  const suite = el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '1rem' } });
  const visibles = () => { const q = filtre.value.trim().toLowerCase(); return docs.filter((d) => passeLaPuce(d.recipe, etat.puce) && (!q || meules.get(d.recipe.id).includes(q))); };
  const redessiner = async () => {
    const liste = visibles();
    const page = liste.slice(0, etat.limite);
    await lire(page);
    // D-T9 : les URL blob: des vignettes de la génération précédente sont révoquées APRÈS le remplacement des nœuds (remplacerEnRevoquant relève img.plat-vignette).
    remplacerEnRevoquant(grille, ...page.map((d) => recipeCard(d, { photoEnTete: true, fichier: pointeurValide(d.recipe) ? fichiers.get(d.recipe.photo_sha256) : null })));
    suite.replaceChildren(...(liste.length > page.length ? [el('button', { type: 'button', class: 'btn', onClick: async () => { etat.limite += CARTES_PAR_PAGE; await redessiner(); } }, t('Voir plus'))] : []));
  };
  for (const [valeur, libelle] of [['toutes', t('Toutes')], ['livres', t('De mes livres')], ['web', t('Du web')]]) {
    puces.append(el('button', { type: 'button', class: 'puce', 'aria-pressed': String(valeur === etat.puce), dataset: { puce: valeur }, onClick: () => {
      etat.puce = valeur; etat.limite = CARTES_PAR_PAGE;
      for (const b of puces.children) b.setAttribute('aria-pressed', String(b.dataset.puce === valeur));
      redessiner();
    } }, libelle));
  }
  filtre.addEventListener('input', () => { etat.limite = CARTES_PAR_PAGE; redessiner(); });
  // Sous 760 px, l'action d'en-tête est répétée pleine largeur sous la grille (maquette mobile 01) ; au-dessus, [hidden] (T-9 ; aucun display:none neuf : T-1).
  // La largeur est lue par matchMedia (injectable : deps.matchMedia, comme la fiche recette) et suivie sur `change` tant que le bouton est dans le document ;
  // détaché, le prochain change retire l'écouteur (aucune fuite d'une route à l'autre).
  const mobile = el('a', { class: 'btn primary big block', href: '#/add', dataset: { role: 'ajouter-mobile' } }, t('Ajouter une recette'));
  const large = matchMedia('(min-width: 760px)');
  mobile.hidden = !!large?.matches;
  const suivre = (e) => { if (!mobile.isConnected) { large.removeEventListener?.('change', suivre); return; } mobile.hidden = !!e.matches; };
  large?.addEventListener?.('change', suivre);
  await redessiner();
  return el('div', null, el('div', { class: 'stack', style: { marginBottom: '1rem' } }, filtre, puces), grille, suite, el('div', { style: { marginTop: '1rem' } }, mobile), pied);
}

// ?tab=a-importer (§ 4.1, B-M-4) : les références sans adresse, groupées par livre (titre du livre en h3, livres par ordre alphabétique), une ligne
// « {titre} · p. N · À importer » → l'écran d'import ciblé (#/recipes/<id>/importer, le même href que la fiche du livre). Section PLAIN (D-UI-8).
function aImporterTab(ctx) {
  const refs = (ctx.recipes || []).filter(estAImporter);
  if (!refs.length) return emptyState('assiette', t('Aucune recette pour l’instant.'));
  const groupes = [...repo.groupBy(refs, 'edition_id').entries()]
    .map(([editionId, liste]) => ({ titre: ctx.editionLabel?.(ctx.editionsById?.get(editionId)) || t('Sans titre'), liste: [...liste].sort(parPageEtTitre) }))
    .sort((a, b) => a.titre.localeCompare(b.titre));
  return sectionPlain(t('Recettes de mes livres à importer'), ...groupes.map((g) => el('div', { class: 'stack' }, el('h3', null, g.titre),
    el('ul', { class: 'list plain' }, ...g.liste.map((r) => el('li', null, el('a', { href: `#/recipes/${encodeURIComponent(r.id)}/importer` },
      [r.display_title || r.original_title || t('Sans titre'), r.printed_page ? `p. ${r.printed_page}` : null, t('À importer')].filter(Boolean).join(' · '))))))));
}
```

  `liensWebGardes` : `return sectionPlain(t('Liens web gardés'), ...signets.map((r) => carteOuLien(ctx, r)));` ; `recettesCreeesIA` :
  `return sectionPlain(t('Recettes créées avec l’IA'), ...creees.map((r) => carteOuLien(ctx, r)));` — leurs cartes restent `recipeCard(doc)` (horizontales).
  `section` reste importé : `dishesTab` l'emploie (« Rapprochements proposés »).

- [ ] **Step 7 : `src/i18n/en.js` et le filet i18n de `tests/ajouter.js`.** Dans `en.js`, avant la `};` finale (après le bloc « Lot F « Les plats en images » »,
  l. 740-754 à `f3672be`), treize entrées — apostrophe U+2019 et points de suspension U+2026 dans les clés, comme la spec § 5 :

```js
  // Lot UI-1 « Carnet », tâche 2 (spec § 5) : la Bibliothèque « Recettes » et la carte-plat. « À importer » est aussi le badge court de la tâche 5 (UNE clé).
  // « Recettes » et « Toutes » traduisent au passage les deux appels de book.js:193-195 qui n'avaient pas d'entrée (sans les changer).
  'Tes livres, tes trouvailles, tes recettes.': 'Your books, your finds, your recipes.',
  'Recettes': 'Recipes',
  'Ajouter une recette': 'Add a recipe',
  'Une recette, un ingrédient…': 'A recipe, an ingredient…',
  'Toutes': 'All',
  'De mes livres': 'From my books',
  'Du web': 'From the web',
  'Recettes de mes livres à importer': 'Recipes from my books to import',
  'Voir plus': 'Show more',
  'À importer': 'To import',
  'Du web · {h}': 'From the web · {h}',
  'De mon livre · {t}': 'From my book · {t}',
  'Aucune recette pour l’instant.': 'No recipes yet.',
```

  Dans `tests/ajouter.js`, `CHAINES_NEUVES_AILLEURS` (l. 24-62) : la liste de `'../src/ui/components.js'` (l. 45-49) gagne une ligne après celle du lot G :

```js
    // Lot UI-1, tâche 2 : la ligne de source de la carte-plat (ligneSource).
    'Du web · {h}', 'De mon livre · {t}',
```

  et une clé neuve, posée après celle de `'../src/ui/search.js'` (l. 51) :

```js
  // Lot UI-1, tâche 2 : la Bibliothèque — en-tête (« Bibliothèque » : clé posée par la tâche 1), segments, filtre, puces, grille bornée, pied et liste « à importer ».
  '../src/ui/library.js': ['Bibliothèque', 'Tes livres, tes trouvailles, tes recettes.', 'Recettes', 'Ajouter une recette', 'Une recette, un ingrédient…', 'Toutes', 'De mes livres', 'Du web',
    'Recettes de mes livres à importer', 'Voir plus', 'À importer', 'Aucune recette pour l’instant.'],
```

  (`library.js` n'est pas dans `MODULES_NEUFS` : ses chaînes antérieures sans entrée — « Mes livres » retiré ici, « Nom du plat (français) »… — ne sont pas
  scannées ; le filet vérifie que chaque clé déclarée est dans `EN`, et le bloc « en.js et filets » de `tests/carnet.js` vérifie que chaque clé neuve est déclarée.)

- [ ] **Step 8 : vert** — `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` : tout vert **sauf l'épingle** `tests/tests.js:250` (relevée au
  Step 9) ; attendu `❌ (N−1)/N` avec N = total de la tâche 1 + 40 (attendu de raisonnement, D-14), la seule ligne `.ko` étant « compte d’assertions… » ; 0 erreur et 0 avertissement console
  hors le 404 de `/favicon.ico` (préexistant). `tests/theme.js` vert SANS changement (T-1, T-2, T-11, survol : relire ses quatre lignes dans le bilan).
  `node --test tools/*.test.mjs` : 208/208 (inchangé, aucun fichier Node touché) ; `node tools/generer-migrations.mjs --check` : 0.
  Si le bloc « styles.css … cadre » rougit sur `pistes.length` à 900 px alors que 360 px passe : vérifier que `main.content` du cadre mesure 900 px (la
  feuille servie est bien celle du worktree, `?v=` frais) avant de toucher la règle ; un `innerWidth` différent de la largeur demandée est un défaut du cadre,
  dit par l'assertion `fautes` ; les deux largeurs juste SOUS les bornes (359, 899) rougissent si un `@media` est décalé — c'est la règle qu'on corrige, jamais la largeur.

- [ ] **Step 9 : épingle relevée ; `sw.js` `VERSION = 'cuisine-os-v0.17.0-2'`** (`SHELL` inchangé : aucun module neuf ; `APP_VERSION` reste `0.17.0`, posée par la
  tâche 1 ; les pins de version des huit suites ne bougent pas). `tests/tests.js:250` : `eq(results.length, <valeur lue dans « obtenu » au Step 8>, …)` (règle N−1 :
  le nombre mesuré AVANT l'assertion elle-même). Relancer la suite : `✅ N/N`. Noter N dans le rapport de tâche avec le détail « tâche 1 : … ; + 40 » (et
  l'écart s'il y en a un : la valeur MESURÉE fait foi, D-14).

- [ ] **Step 10 : mutants de la tâche** — chacun sur une COPIE légère servie à part (`rsync -a --exclude .git --exclude .superpowers --exclude node_modules`
  vers le scratchpad, `python3 -m http.server 8196 --bind 127.0.0.1` depuis la copie, `suite.cjs 8196`, serveur tué ensuite ; jamais en place, jamais le
  port 8096 ; au plus trois copies à la fois) ; chacun doit rougir, le test qui le tue est nommé :
  - `cartePlat` qui pose l'`img` sans contrôle de `typeAffichage` (`affichable = !!fichier`) → « jamais de cadre vide » (text/html, PDF, SVG rendent une img).
  - `cartePlat` qui appelle `vignettePlat(recipe)` en plus → « pointeur valide sans ligne passée » (une img cachée, et une lecture `files` comptée).
  - `cartePlat` qui lit `URL.createObjectURL(fichier.blob)` au lieu de `displayUrl(fichier, urlDeBlob)` → « image/heic à blob jpeg » reste vert mais la
    révocation au redessin rougit (URL non suivie : `revoquerUrlDeBlob` rend `false`, compte exact des révocations faux) ; le `error` qui ne retire pas l'img → « décodage raté ».
  - `dureeTotale` qui rend `0` sans durée, ou qui ignore `estCreationIA` → « dureeTotale… » (null attendu ; « Créée avec l’IA » sans « · 20 min »).
  - `ligneSource` qui lit `source_label` avant l'hôte → « Adresse non reconnue » / « Recette de famille » (S7).
  - `recettesTab` sans borne (`liste` au lieu de `page`) → « grille bornée » (70 cartes, 70 lectures au premier rendu) ; `lire` sans `fichiers.has` → « Voir plus »
    (130 lectures) et le redessin (lectures > 70) ; `remplacerEnRevoquant` remplacé par `grille.replaceChildren(…)` → révocations 0 ; révocation AVANT le
    remplacement → `encore` > 0.
  - `renderLibrary` dont le défaut est `'books'` → « renderLibrary({}) » (segment Livres) ; `?tab=books` ignoré (toujours Recettes) → le bloc segments ;
    action « Ajouter un livre » sur Recettes, ou une action sur Plats → le bloc segments ; `booksTab` laissée en `class: 'grid'` (la classe `livres` absente)
    → le bloc segments (`.grid.livres` introuvable ; et la mesure « 5 colonnes à 980 px » de T1 reste verte : elle mesure une règle, pas son appelant).
  - `dansLaGrille` sans `|| aUneAdresse` → le signet E manque ; `passeLaPuce('web')` câblé sur `!r.edition_id` → « Du web » rend [E, B] sans C ; tri par
    `created_at` → ordre faux ; `aria-pressed` jamais réécrit → `pressees`.
  - bouton mobile sans `hidden` (ou `hidden = !large.matches`) → « [hidden] quand (min-width: 760px) » ; `suivre` sans garde `isConnected` → « aucune fuite » (écouteur
    gardé, `hidden` changé hors document).
  - `aImporterTab` qui garde les signets (`estAImporter` sans `!aUneAdresse`) → E dans la liste ; `href` sans `/importer` → la ligne ; `section(` au lieu de `sectionPlain(` →
    `section.card` compté 1 ; retour `/library` sans `?tab=recettes` → « ← Recettes ».
  - `liensWebGardes` laissée en `section(` → `tests/ajouter.js:3735` et `tests/creer-ia.js:1514` (section.plain introuvable) et « sous Livres ».
  - `styles.css` : `@media (min-width: 360px)` retiré → 1 piste attendue à 359 reste verte mais 2 pistes à 360 rougit ; `@media (min-width: 360px)` à 370 px → 360
    rougit ; `@media (min-width: 900px)` à 1000 px → 900 ET 950 rougissent (2 pistes au lieu de 3 ; rév. 3, D-15 : la largeur 950 le tue même si la borne
    basse de la plage bougeait) ; à 880 px → 899 rougit (3 au lieu de 2) — les cinq largeurs du cadre encadrent les deux bornes (rév. 2, rév. 3) ;
    `min-height: 7rem` retiré → `112px` ;
    `.plat-vignette.grande` renommée `.carte-plat .plat-vignette` → `tests/photo-plat.js:1323` (quatre sélecteurs, ou l'ordre) ; `aspect-ratio` retiré → le ratio ;
    une couleur en dur (`#f1ece3`) à la place de `var(--paper-2)` → `tests/theme.js` T-2 ; un `display: none` sous `@media (min-width: 760px)` pour le bouton
    mobile → T-1 (inventaire).
  - `en.js` : une clé retirée (« Voir plus ») → « en.js : chaque texte neuf… » et le filet de `tests/ajouter.js` (clé déclarée absente) ; la clé `library.js`
    retirée de `CHAINES_NEUVES_AILLEURS` → « filet i18n ».

- [ ] **Step 11 : invisibles** sur les fichiers touchés (Python `-I`, jamais `grep -P` : il rend 0 à tort sur ce shell) — attendu `0` pour chacun :

```
python3 -I -c 'import sys,re; p=re.compile("[\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff\u00a0\u202f]"); [print(f, len(p.findall(open(f,encoding="utf-8").read()))) for f in sys.argv[1:]]' src/ui/components.js src/ui/library.js styles.css src/i18n/en.js tests/carnet.js tests/ajouter.js tests/creer-ia.js tests/photo-plat.js tests/tests.js sw.js
```

  (mesuré à `f3672be` : 0 sur chacun des neuf fichiers existants.) Puis `git diff --stat` : aucun fichier sous `supabase/`, aucun sous `tools/`.

- [ ] **Step 12 : commit** (dans le worktree `~/projects/mistu-carnet`, branche `experience-carnet` ; message ASCII, sans accent) :

```
Carte-plat, grille bornee et Bibliotheque Recettes : segments, filtres, actions, pied a importer (lot UI-1, tache 2)

recipeCard({ photoEnTete, fichier }) rend la carte-plat verticale, decidee au
rendu depuis la ligne files passee (jamais de cadre vide, aucune lecture) ;
dureeTotale, ligneSource, grilleCartes ; .grille-plats 2/3 colonnes,
.plat-vignette.grande et .petite ; la bibliotheque s'ouvre sur Recettes
(filtre local, puces de donnees, grille bornee a 60 et Voir plus, bouton
mobile par [hidden], pied vers ?tab=a-importer) ; Liens web gardes et
Recettes creees avec l'IA en sectionPlain ; treize entrees en.js ; tests
amendes ({ tab: 'books' }, section.plain, trois selecteurs) ; sw.js -2.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

---

### Task 3 : La fiche recette — en-tête en deux colonnes, repères, « Voir la page d'origine », gestes repliés, Ingrédients | Préparation

Spec § 4.2 et D-UI-6 (composition), D-UI-10 (« Voir la page d'origine » sur toute adresse lisible, I-B5), D-UI-8 (sections `plain`), § 5 (textes),
§ 7 UI-1 T3 (épingles) ; décision de Neegan du 23 octobre (§ 13, point 4 : gestes repliés avec « Corriger » visible). Aucun serveur, aucune migration.
`sw.js` `-3` (T1 `-1`, T2 `-2` : si la chaîne réelle diffère à la tête, +1 sur le dernier suffixe servi, R-B-24).

**Files:**
- Modify: `src/ui/recipe.js` (l. 3 import de `../core/dom.js` + `formatMinutes` ; l. 16 import de `./components.js` + `sectionPlain`, `lienOrigine` ; l. 34-175 :
  `renderRecipe` recomposée du `pageHeader` à `drawBody()` — `.fiche-tete`, `details[data-role=autres-gestes]`, `.recipe-body` à onglets/colonnes,
  `matchMedia` injecté ; l. 182, 190, 198 : `section(` → `sectionPlain(` pour « Original », « Versions », « Mémoire culinaire » ; l. 213-253 `drawBody`
  réécrite ; l. 336-367 `blocSignet` : `ouvrir()` → `lienOrigine(lien)` ; deux fonctions neuves exportées `texteReperes`, `dureeVersion`)
- Modify: `src/ui/components.js` (après `availabilityBadge`, l. 33-39 : `lienOrigine(lien)` neuve)
- Modify: `src/ui/import-web.js` (l. 390 `ouvrir` → `lienOrigine(lien)` ; l. 397 et l. 450 : `ouvrir()` sans argument ; import de `./components.js`
  + `lienOrigine`)
- Modify: `src/ui/photo-plat.js` (l. 87 : le style en ligne de l'`img` — `display: block; width: 320px; max-width: 100%; border-radius` — retiré ; la
  feuille le remplace)
- Modify: `styles.css` (après la règle `.two-col` et son `@media`, l. 278-279 : `.fiche-tete`, `.fiche-etat`, `.fiche-gestes`, `.fiche-photo`,
  `.photo-plat img`, `.reperes`, `.geste-principal`, `a[data-role="ouvrir-lien"]::after`, `details[data-role="autres-gestes"] > summary`,
  `.recipe-body > [data-role="onglets-corps"]` — jetons seulement, aucun `display: none`, aucun `56px`, aucun survol)
- Modify: `src/i18n/en.js` (trois entrées neuves en fin de dictionnaire ; l. 251 `"Ouvrir le lien": "Open the link",` retirée : plus aucun site ne la lit)
- Test (neuf, dans `tests/carnet.js` créé par T1) : un bloc `{ … }` qui importe `withRepo` et lance `await bloc('fiche recette (T3) …')`, AU-DESSUS du repère de fin de `runCarnetTests`, après le bloc de T2 (A-2)
- Test (amendés, retrouvés par leur TEXTE) : `tests/photo-plat.js:340-341`, `tests/sync-l4.js:3476`, `tests/creer-ia.js:1341, 1346, 1376, 1391, 1790`,
  `tests/lecture-web.js:605, 611, 792, 1051, 1055, 1071, 1073` (code) et `:676, 679, 682, 1109, 1150` (messages seuls ; `:672` est un commentaire) — relevé réel,
  rév. 2 —, `tests/ajouter.js:37, 45, 1149`, `tests/tests.js:250` (épingle), `sw.js:4` (`VERSION`)

**Interfaces:**
- Consumes : T1 — `sectionPlain(title, ...children)` → `section.plain` (h2 serif, filet `--line`) ; `pageHeader(title, { subtitle, actions, back, classeTitre })`
  (`classeTitre: 'titre-fiche'` → `h1.titre-fiche`) ; le retour `back: { href: '/library', label: t('Bibliothèque') }` déjà posé par T1 sur recipe.js:88 ;
  `tests/carnet.js` (`runCarnetTests({ eq, ok })`, son lanceur `bloc(nom, f)` qui attrape et nomme une levée ; `withRepo` est importé par le bloc lui-même,
  `await import('./sync-fixture.js')`, comme T2 : A-2). T2 — `dureeTotale(version)` (`components.js` : `total_minutes ?? prep + cook`, `null` sans durée
  ou pour une création IA) : `dureeVersion` lui DÉLÈGUE la règle et n'y ajoute que la mise en forme (`formatMinutes`, `''` si ≤ 0) — une seule règle de
  durée dans l'app (D-UI-5, B-I-6, C-6 ; A-6) ; la carte-plat elle-même n'est pas rendue sur la fiche. Existant : `monterPhotoPlat(recipe, ctx, deps)` → `{ entete: div[data-role=emplacement-photo-plat], zone: section.card, gestes }`
  (lot F) ; `figurePhotoPlat` rend `figure.photo-plat[data-role=photo-plat] > img[alt="Photo du plat"] (+ figcaption)` ; `segmented(options, value,
  onChange)` → `div.segmented[role=tablist] > button(.active)` (components.js:273) ; `lienSignet(url)` → `{ ok, href, hote }` ; `formatMinutes(min)`
  (dom.js:130 : « 35 min », « 1 h 30 ») ; `estCreationIA(version)` ; `el()` pose `open` et `hidden` ? — `open` par propriété (dom.js:14), `hidden` par
  attribut (`node.setAttribute('hidden', '')`) ; `window.matchMedia('(min-width: 760px)')` (le motif de dish.js:64).
- Produces (signatures exactes) :

```js
// src/ui/recipe.js
export async function renderRecipe(params, query, ctx, deps = {})
  // deps gagne `matchMedia` : (query) => MediaQueryList-like { matches, addEventListener('change', f), removeEventListener('change', f) } ;
  // défaut (q) => window.matchMedia(q) — jamais window.matchMedia nu (appel sans this : « Illegal invocation »)
export function texteReperes(version)   // → '4 portions · 35 min' | '1 portion · 1 h 30' | '4 portions' | '35 min' | null ; portions = version.servings (entier ≥ 1), jamais state.servings
export function dureeVersion(version)   // → formatMinutes(total_minutes ?? prep + cook) | '' ; '' pour une création IA (C-6) ; '' si ≤ 0 ou non fini
export function blocSignet(recipe, ctx = null, { lire = null, connecter = () => {}, moi = null } = {})  // inchangée ; « Ouvrir le lien » → lienOrigine(lien) sur ses six sites
// src/ui/components.js
export function lienOrigine(lien)       // lien = { ok, href, hote } de lienSignet → a.btn.link[data-role="ouvrir-lien"][target=_blank][rel="noopener noreferrer"] « Voir la page d’origine » | null si !lien?.ok
```

- DOM produit par `renderRecipe` (épinglé par le test « ordre du DOM ») :

```text
div
├ header.stack > a.muted « ← Bibliothèque » ; .row.between.top > div > h1.titre-fiche + p.muted ; .row > button « ☆ Favori »
├ (div.card.warn.stack : conflit de version, inchangé, seulement s'il existe)
├ div.two-col.fiche-tete[data-role=fiche-tete]
│ ├ div.stack.fiche-etat[data-role=fiche-etat] > .row (badges : disponibilité, version, vérification, type, cuisines) ; [data-role=bandeau-web] ; [data-role=bandeau-lecture]
│ ├ div.fiche-photo[data-role=emplacement-photo-plat] (figure.photo-plat > img 4:3 + figcaption, ou vide)
│ └ div.stack.fiche-gestes[data-role=fiche-gestes] (seulement avec une version) > div.reperes.muted[data-role=reperes] ? ; a.btn.link[data-role=ouvrir-lien] ? ;
│     div.geste-principal[data-role=geste-principal] > button.btn.primary.big.block « Commencer à cuisiner » + a.btn.link[data-role=corriger-tete] « Corriger » ? (non vérifiée)
├ (sans version : le bloc referenceOnly() d'aujourd'hui, inchangé — puis fin)
├ details.card[data-role=autres-gestes][open ≥ 760 px] > summary « Portions, versions et autres gestes » ; div.stack > TOUT l'ancien contenu de `controls`
│   (.row.between : sélecteur de versions / badge, « Créer ma version », « Corriger », « Relire les pages », « Relire la page avec l’assistant » ; .row : Portions −/+,
│   Unités, Langue de lecture ; « Adapter avec l’IA » ou les puces V1 ; le small) + div.row[data-role=autres-actions] (« Avec quoi on mange ça ? »,
│   « Ajouter à mon repas », « Liste d’épicerie », « Autres recettes de ce plat » | « Rattacher à un plat »)
├ div.recipe-body > (section.card[data-role=creation-ia] ?) ; div.segmented[role=tablist][data-role=onglets-corps][hidden ≥ 760 px] ;
│   div.two-col[data-role=colonnes-corps] > section.plain[data-role=section-ingredients] + section.plain[data-role=section-preparation] (< 760 px : la non choisie [hidden]) ;
│   (section.card « Conseils » ?) ; (section.card « À vérifier avant de servir » ?)
├ section.card « Photo du plat » (photo.zone, inchangée)
├ section.plain « Original » (ou p.muted « Original : page … ») ; section.plain « Versions » ; section.plain « Mémoire culinaire » ?
└ div.row (Export : « Exporter JSON-LD », « Exporter YAML (Paprika) », inchangé)
```

- [ ] **Step 0 : relevés (aucune écriture).** Relire sur la tête réelle (après T1 et T2 commises) : `src/ui/recipe.js` — la ligne du `pageHeader` (l. 87-90 à
  `f3672be` : `back` déjà `{ href: '/library', label: t('Bibliothèque') }` par T1), la rangée des badges (l. 108), `bandeauWeb` / `bandeauLecture` (l. 109-111),
  `ctxF` et `monterPhotoPlat` (l. 112-115), `controls` (l. 139-162), la rangée d'actions (l. 164-171), `body` et `drawBody()` (l. 173-175, 213-253), les trois
  `section(` d'« Original », « Versions », « Mémoire culinaire » (l. 182, 190, 198), la rangée Export (l. 204-208), `blocSignet` et son `ouvrir` (l. 336-367) ;
  `src/ui/components.js` — `sectionPlain` et `pageHeader({ classeTitre })` tels que T1 les a écrits ; `src/ui/import-web.js` — `ouvrir` (l. 390) et ses deux
  appels (l. 397, 450), l'import de `./components.js` (l. 17) ; `src/ui/photo-plat.js:87` (le style en ligne) ; `tests/carnet.js` — le lanceur `bloc(nom, f)`
  de T1, le repère de fin, l'accolade qui ferme le bloc `{ … }` de T2 (le nouveau bloc va APRÈS lui, AU-DESSUS du repère) ; `src/ui/components.js` —
  `export function dureeTotale(version)` posée par T2 (importée par `recipe.js` au Step 4).
  Compter les sites : `python3 -I - <<'PY'` … `src.count("t('Ouvrir le lien')")` → 2 dans recipe.js (l. 171, 341), 1 dans import-web.js (l. 390) ;
  `grep -rn "Ouvrir le lien" src/ tests/` (relevé RÉEL à `f3672be`, rév. 2) → recipe.js (5 : 37, 170, 332 commentaires ; 171, 341 code), import-web.js (1 : 390),
  en.js (1 : 251), tests/lecture-web.js (13 : 605, 611, 792, 1051, 1055, 1071, 1073 par leur CODE ; 672 commentaire ; 676, 679, 682, 1109, 1150 par leur message
  seulement), tests/ajouter.js (2 : 37, 1149) : rien d'autre (sinon : NEEDS_CONTEXT, le site manquant s'ajoute à la liste). La l. 792 est du CODE : elle affirme que
  le premier `a` de `[data-role="action"]` (zoneEchec, import-web.js:445-452) est `.primary` — c'est `ouvrir('btn primary')` (l. 450), qui devient `lienOrigine` : amendée
  au Step 2.4. Vérifier qu'aucun test ne cherche
  `.card.sage` hors `tests/creer-ia.js:1346, 1376, 1391` et `tests/photo-plat.js:341` (`grep -rn "card.sage\|card sage" tests/` : quatre lignes + le libellé
  d'une paire de `tests/theme.js:4`, qui n'est qu'un texte). Numéros de ligne : ceux de `f3672be` ; une dérive après T1/T2 n'est pas un constat (R-C-7) —
  chaque ligne se retrouve par son texte.

- [ ] **Step 1 : tests rouges — `tests/carnet.js`, bloc « fiche recette (T3) »** (un bloc `{ … }` AU-DESSUS du repère de fin de `runCarnetTests`, après le
  bloc de T2 ; `bloc`, `eq`, `ok` du fichier ; `withRepo` importé par le bloc ; tout le reste est local : aucune aide de T1/T2 n'est supposée) :

```js
    // ===== Tâche 3 — la fiche recette (spec § 4.2, D-UI-6, D-UI-10 ; bases jetables, matchMedia FACTICE, aucun réseau, aucune navigation réelle).
    // Trois fiches sont montées dans la même scène : avant chaque « + » (setServings lit document.getElementById), la scène est vidée.
    // Rév. 3 : tout nœud que drawBody() REMPLACE (body.replaceChildren : le segmented, les deux sections) se lit par un ACCESSEUR (onglets(), ing(), prep()),
    // jamais par une constante capturée — un nœud capturé avant un « + » serait détaché (vert aveugle sur actif(), rouge à tort sur hidden).
    {
    const { withRepo } = await import('./sync-fixture.js');
    await bloc('fiche recette (T3) : ordre du DOM, deux largeurs, onglets, autres gestes, repères, « Voir la page d’origine »', () => withRepo(async (repo, db) => {
      const { renderRecipe, blocSignet, texteReperes, dureeVersion } = await import('../src/ui/recipe.js');
      const { lienOrigine } = await import('../src/ui/components.js');
      const { lienSignet } = await import('../src/core/lien.js');
      const { sha256Hex } = await import('../src/core/hash.js');
      const { INGREDIENTS } = await import('../src/model/seed.js');
      const ING = new Map(INGREDIENTS.map((i) => [i.id, i]));
      const DATE = '2026-10-23T00:00:00.000Z';
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
      const fiche = (id, over = {}) => ({ id, edition_id: null, original_title: 'Pâtes ' + id, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE, ...over });
      const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: 35,
        ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }],
        constraints: {}, changes: '', notes: '', provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: null, convention_snapshot: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
      // Une page d'original pour rc_t3 (le motif de tests/photo-plat.js:336-337) : la section « Original » n'est rendue que si la fiche a une page (recipe.js:178-187) — sans
      // elle, l'ordre « Photo du plat → Original → Versions » n'aurait rien à mesurer (rév. 2). Les autres fiches ont source_page_ids: [] et ne la voient pas.
      const PAGE_T3 = { id: 'pg_t3', sha256: '1'.repeat(64), printed_page: 12 };
      const ctxPour = async (over = {}) => {
        const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
        return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])),
          editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map([[PAGE_T3.id, PAGE_T3]]), imports: await db.getAll('imports'), dishesById: new Map(), dishes: [], cook_history: [],
          dish_recipe_links: [], recipe_translations: [], ingredients: INGREDIENTS, ingredientsById: ING, source_documents: [], source_pages: [], scan_sessions: [], rediscovery_prefs: [], docsByRecipe: new Map(),
          meals: [], meal_feedback: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, sync: {}, ...over };
      };
      // Le matchMedia FACTICE : une MediaQueryList à la main — matches, change écouté, bascule à la demande, abonnés et requêtes comptés.
      const fauxMatchMedia = (large) => {
        const abonnes = new Set(); const requetes = [];
        const mql = { matches: large, media: '(min-width: 760px)', addEventListener: (nom, f) => { if (nom === 'change') abonnes.add(f); }, removeEventListener: (nom, f) => { abonnes.delete(f); } };
        return { matchMedia: (q) => { requetes.push(q); return mql; }, basculer: (l) => { mql.matches = l; for (const f of [...abonnes]) f({ matches: l, media: mql.media }); }, abonnes, requetes };
      };
      const mettre = (...rows) => db.mutate({ puts: { recipes: rows }, origin: 'device' });
      const versions = (...rows) => db.mutate({ puts: { recipe_versions: rows }, origin: 'device' });
      const monter = async (id, mm, query = {}) => { const p = await renderRecipe({ id }, query, await ctxPour(), { matchMedia: mm.matchMedia }); scene.append(p); return p; };
      const avant = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      const q = (p, sel) => p?.querySelector(sel) ?? null;
      const textes = (p, sel) => [...(p?.querySelectorAll(sel) ?? [])].map((n) => n.textContent);
      const titreSection = (s) => s?.querySelector('h2')?.textContent ?? null;
      const sectionPlain = (p, titre) => [...p.querySelectorAll('section.plain')].find((s) => (titreSection(s) ?? '').startsWith(titre)) ?? null;
      try {
        await mettre(fiche('rc_t3', { source_page_ids: [PAGE_T3.id] })); await versions(version('rc_t3'));
        // --- Ordre du DOM, large
        const mmL = fauxMatchMedia(true);
        const pL = await monter('rc_t3', mmL);
        eq(mmL.requetes, ['(min-width: 760px)'], 'fiche T3 : la largeur est demandée au matchMedia INJECTÉ, par la requête de D-UI-6');
        const tete = q(pL, '[data-role="fiche-tete"]'); const details = q(pL, '[data-role="autres-gestes"]'); const corps = q(pL, '.recipe-body');
        eq([q(pL, 'header h1')?.classList.contains('titre-fiche'), q(pL, 'header a.muted')?.textContent, q(pL, 'header a.muted')?.getAttribute('href')], [true, '← Bibliothèque', '#/library'], 'fiche T3 : h1.titre-fiche (classeTitre) ; retour « ← Bibliothèque » → #/library');
        eq([tete?.classList.contains('two-col'), [...(tete?.children ?? [])].map((c) => c.dataset.role)], [true, ['fiche-etat', 'emplacement-photo-plat', 'fiche-gestes']], 'fiche T3 : .fiche-tete.two-col porte, dans cet ordre, l’état, l’emplacement de la photo, les gestes (en étroit, la photo passe avant les repères)');
        eq([q(tete, '[data-role="emplacement-photo-plat"]')?.classList.contains('fiche-photo'), !!q(tete, '[data-role="fiche-etat"] .badge'), avant(q(pL, 'header'), tete), avant(tete, details), avant(details, corps), details?.tagName, details?.classList.contains('card')],
          [true, true, true, true, true, 'DETAILS', true], 'fiche T3 : la photo porte .fiche-photo ; les badges sont dans l’état ; header → .fiche-tete → details.card → .recipe-body');
        const zone = [...pL.querySelectorAll('section.card')].find((s) => titreSection(s) === 'Photo du plat');
        const original = sectionPlain(pL, 'Original'); const versionsSec = sectionPlain(pL, 'Versions');
        const exportRow = [...pL.querySelectorAll('button')].find((b) => b.textContent === 'Exporter JSON-LD')?.closest('.row') ?? null;
        eq([avant(corps, zone), avant(zone, original), avant(original, versionsSec), avant(versionsSec, exportRow), !!exportRow, details.contains(exportRow)], [true, true, true, true, true, false], 'fiche T3 : .recipe-body → « Photo du plat » (.card) → « Original » (plain) → « Versions » (plain) → la rangée Export, hors du details (H-3)');
        eq([sectionPlain(pL, 'Ingrédients')?.dataset.role, sectionPlain(pL, 'Préparation')?.dataset.role, q(corps, '[data-role="colonnes-corps"]')?.classList.contains('two-col'), q(corps, '[data-role="colonnes-corps"]')?.children.length, [...pL.querySelectorAll('section.card')].map(titreSection)],
          ['section-ingredients', 'section-preparation', true, 2, ['Photo du plat']], 'fiche T3 : Ingrédients et Préparation en section.plain, seules dans un .two-col ; la seule section.card restante est « Photo du plat »');
        // --- Large : details ouvert, onglets cachés, les deux sections visibles
        const ongletsL = q(corps, '[data-role="onglets-corps"]');
        eq([details.open, details.querySelector('summary')?.textContent, ongletsL?.hidden, ongletsL?.classList.contains('segmented'), textes(ongletsL, 'button'), q(corps, '[data-role="section-ingredients"]').hidden, q(corps, '[data-role="section-preparation"]').hidden],
          [true, 'Portions, versions et autres gestes', true, true, ['Ingrédients', 'Préparation'], false, false], 'fiche T3 ≥ 760 px : details OUVERT, segmented caché, Ingrédients et Préparation toutes deux visibles');
        // --- Autres gestes : TOUT l'ancien contenu de controls et de la rangée d'actions, sauf « Commencer à cuisiner » et « Corriger » (qui y reste aussi) ; pas l'Export
        const boutonsDetails = textes(details, 'button, a');
        eq(['Créer ma version', 'Corriger', '−', '+', 'Avec quoi on mange ça ?', 'Ajouter à mon repas', 'Liste d’épicerie', 'Rattacher à un plat', 'Original', 'Métrique', 'US', 'FR', 'EN'].filter((x) => !boutonsDetails.includes(x)), [], 'fiche T3 : « autres gestes » porte les anciens boutons de controls (versions, portions, unités, langue) ET de la rangée d’actions');
        eq([boutonsDetails.includes('Commencer à cuisiner'), boutonsDetails.includes('Exporter JSON-LD'), boutonsDetails.includes('Exporter YAML (Paprika)'), !!q(details, '#servings-val'), q(details, '.chip.neutral')?.textContent, !!q(details, 'select'), details.querySelector('.row.between') !== null],
          [false, false, false, true, 'Rapide · V1', false, true], 'fiche T3 : ni « Commencer à cuisiner » ni l’Export dans le details ; les portions et les puces V1 y sont ; une seule version → badge, pas de select ; la .row.between (épingle creer-ia) y est');
        const gestes = q(tete, '[data-role="fiche-gestes"]'); const principal = q(gestes, '[data-role="geste-principal"]');
        const commencer = [...(principal?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Commencer à cuisiner');
        eq([commencer?.className, textes(pL, 'button').filter((x) => x === 'Commencer à cuisiner').length, q(gestes, '[data-role="corriger-tete"]'), q(pL, '.card.sage')], ['btn primary big block', 1, null, null], 'fiche T3 : « Commencer à cuisiner » = button.btn.primary.big.block dans les gestes de tête, une seule fois ; fiche VÉRIFIÉE → aucun « Corriger » dans l’en-tête ; plus de .card.sage');
        // --- « Corriger » visible tant que la version affichée n'est pas vérifiée (le seul geste que « — vérifie » réclame)
        await mettre(fiche('rc_nv', { verification_state: 'to_verify' }));
        await versions(version('rc_nv', { verification_state: 'to_verify', ingredients: [{ id: 'ri_nv', source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'to_verify' }] }));
        const pNV = await monter('rc_nv', fauxMatchMedia(true));
        const corriger = q(pNV, '[data-role="corriger-tete"]');
        eq([corriger?.tagName, corriger?.className, corriger?.textContent, corriger?.getAttribute('href'), q(pNV, '[data-role="geste-principal"]')?.contains(corriger), textes(q(pNV, '[data-role="autres-gestes"]'), 'a').filter((x) => x === 'Corriger').length, avant(q(pNV, '[data-role="geste-principal"] button'), corriger)],
          ['A', 'btn link', 'Corriger', '#/recipes/rc_nv/edit?kind=correction&v=rv_rc_nv', true, 1, true], 'fiche T3 : version NON vérifiée → a.btn.link « Corriger » à côté (après) de « Commencer à cuisiner », même href que celui du details, qui reste');
        // --- Étroit : details fermé, onglets visibles, bascule LOCALE (la scène est vidée : un seul #servings-val dans le document)
        scene.replaceChildren();
        const mmE = fauxMatchMedia(false);
        const pE = await monter('rc_t3', mmE);
        const detailsE = q(pE, '[data-role="autres-gestes"]'); const corpsE = q(pE, '.recipe-body');
        // Rév. 3 (Critical du vérificateur) : `onglets` est un ACCESSEUR, comme ing() et prep() — un « + » (setServings → drawBody → body.replaceChildren) remplace
        // le segmented ; un nœud capturé ici serait DÉTACHÉ après le « + » : « change → large » rougirait avec un code correct (son hidden n'est plus touché),
        // actif() resterait vert aveugle (l'ancien nœud garde son .active).
        const onglets = () => q(corpsE, '[data-role="onglets-corps"]');
        const ing = () => q(corpsE, '[data-role="section-ingredients"]'); const prep = () => q(corpsE, '[data-role="section-preparation"]');
        const actif = () => textes(onglets(), 'button.active');
        eq([detailsE.open, onglets().hidden, ing().hidden, prep().hidden, actif(), onglets().getAttribute('role')], [false, false, false, true, ['Ingrédients'], 'tablist'], 'fiche T3 < 760 px : details FERMÉ ; segmented visible (tablist) ; Ingrédients visible, Préparation cachée (hidden), segment actif « Ingrédients »');
        const hashAvant = location.hash; const ingAvant = ing(); const prepAvant = prep(); const corpsAvant = corpsE.firstElementChild;
        [...onglets().querySelectorAll('button')].find((b) => b.textContent === 'Préparation').click();
        eq([ing().hidden, prep().hidden, actif(), location.hash === hashAvant, reseau, ing() === ingAvant && prep() === prepAvant, corpsE.firstElementChild === corpsAvant, corpsE.contains(ingAvant), ing().querySelectorAll('li').length],
          [true, false, ['Préparation'], true, 0, true, true, true, 1], 'fiche T3 : la tape « Préparation » bascule par hidden — sans navigation, sans appel, sans redessin (mêmes nœuds) ; Ingrédients reste dans le DOM avec sa ligne');
        // Le choix survit à drawBody() (un « + » redessine le corps : nœuds neufs, même choix)
        [...detailsE.querySelectorAll('button')].find((b) => b.textContent === '+').click();
        eq([q(detailsE, '#servings-val')?.textContent, ing() !== ingAvant, ing().hidden, prep().hidden, actif(), location.hash === hashAvant], ['5', true, true, false, ['Préparation'], true], 'fiche T3 : après un « + » (drawBody), les sections sont neuves mais le choix « Préparation » est gardé (mémorisé dans l’instance, jamais dans l’adresse)');
        // change du matchMedia : large → les deux visibles, onglets cachés, details ouvert ; retour étroit → le choix tient
        mmE.basculer(true);
        eq([onglets().hidden, ing().hidden, prep().hidden, detailsE.open, ing() !== null && ing() === q(corpsE, '[data-role="section-ingredients"]')], [true, false, false, true, true], 'fiche T3 : change → large : segmented caché, les deux sections visibles, details ouvert (écouté sur change, sans redessin)');
        mmE.basculer(false);
        eq([onglets().hidden, ing().hidden, prep().hidden, detailsE.open, actif()], [false, true, false, false, ['Préparation']], 'fiche T3 : change → étroit : segmented visible, Préparation (le choix) visible, Ingrédients cachée, details fermé');
        // L'abonné est retiré quand la fiche a quitté le document (pas de fuite à chaque visite)
        eq(mmE.abonnes.size, 1, 'fiche T3 : un seul abonné change par fiche montée');
        pE.remove(); mmE.basculer(true);
        eq(mmE.abonnes.size, 0, 'fiche T3 : une fiche retirée du document se désabonne à la notification suivante');
        // --- Repères (B-I-6) : « {n} portions · {durée} », chaque partie si connue, UN nombre, portions de la VERSION
        const R = (over) => texteReperes({ ...version('x'), ...over });
        eq([R({ servings: 4, total_minutes: 35 }), R({ servings: 1, total_minutes: null, prep_minutes: 20, cook_minutes: 70 }), R({ servings: 4, total_minutes: null }), R({ servings: null, total_minutes: 35 }), R({ servings: null, total_minutes: null }), R({ servings: 2, total_minutes: 80, prep_minutes: 20, cook_minutes: 60 })],
          ['4 portions · 35 min', '1 portion · 1 h 30', '4 portions', '35 min', null, '2 portions · 1 h 20'], 'texteReperes : n ≥ 2 et durée → « {n} portions · {d} » ; « 1 portion » ; une seule partie connue ; rien → null ; total_minutes gagne sur prep + cook');
        eq([R({ servings: '4', total_minutes: 35 }), R({ servings: 0, total_minutes: 35 }), R({ servings: 4, total_minutes: -5 }), R({ servings: 4, total_minutes: 'x' }), texteReperes(null), dureeVersion({ kind: 'synthesis', total_minutes: 30, provenance: { generated_by: 'ai', creation: { demande: 'x' } } }), dureeVersion({ kind: 'extraction', total_minutes: null, prep_minutes: 0, cook_minutes: 0 })],
          ['35 min', '35 min', '4 portions', '4 portions', null, '', ''], 'texteReperes / dureeVersion : portions non entières ou nulles ignorées ; durée négative, illisible ou nulle ignorée ; version nulle → null ; une création IA n’a pas de durée ici (C-6)');
        await mettre(fiche('rc_r1'), fiche('rc_r2'), fiche('rc_r3'));
        await versions(version('rc_r1', { servings: 1, total_minutes: null, prep_minutes: 20, cook_minutes: 70 }), version('rc_r2', { servings: 4, total_minutes: null }), version('rc_r3', { servings: null, total_minutes: null }));
        scene.replaceChildren();
        const pR0 = await monter('rc_t3', fauxMatchMedia(true)); const pR1 = await monter('rc_r1', fauxMatchMedia(true)); const pR2 = await monter('rc_r2', fauxMatchMedia(true)); const pR3 = await monter('rc_r3', fauxMatchMedia(true));
        const reperes = (p) => q(p, '[data-role="reperes"]')?.textContent ?? null;
        eq([reperes(pR0), reperes(pR1), reperes(pR2), reperes(pR3), /\b(actif|total)\b/.test(q(pR0, '[data-role="fiche-gestes"]').textContent), q(pR0, '[data-role="fiche-gestes"]').contains(q(pR0, '[data-role="reperes"]')), /total 35 min/.test(sectionPlain(pR0, 'Ingrédients').textContent)],
          ['4 portions · 35 min', '1 portion · 1 h 30', '4 portions', null, false, true, true], 'fiche T3 : div.reperes dans les gestes de tête — « 4 portions · 35 min », « 1 portion · 1 h 30 », « 4 portions » seul, rien sans portions ni durée ; jamais la paire « actif · total », qui reste dans l’en-tête d’Ingrédients (timeText)');
        scene.replaceChildren();
        const pRq = await monter('rc_t3', fauxMatchMedia(true), { servings: '8' });
        eq([reperes(pRq), q(pRq, '#servings-val')?.textContent, titreSection(sectionPlain(pRq, 'Ingrédients'))], ['4 portions · 35 min', '8', 'Ingrédients — recalculés pour 8 portions'], 'fiche T3 : ?servings=8 recalcule les lignes (titre d’Ingrédients, −/+) mais les repères disent la version (une donnée, jamais la valeur du −/+)');
        // --- « Voir la page d’origine » (D-UI-10, I-B5) : lien texte, sur toute adresse lisible, http compris ; même data-role sur la fiche et le bloc du signet
        await mettre(fiche('rc_http', { source_url: 'http://site.test/r' })); await versions(version('rc_http'));
        const pH = await monter('rc_http', fauxMatchMedia(true));
        const ouvrir = q(pH, '[data-role="ouvrir-lien"]');
        eq([ouvrir?.tagName, ouvrir?.className, ouvrir?.textContent, ouvrir?.getAttribute('href'), ouvrir?.getAttribute('target'), ouvrir?.getAttribute('rel'), q(pH, '[data-role="fiche-gestes"]').contains(ouvrir), avant(ouvrir, q(pH, '[data-role="geste-principal"]')), pH.textContent.includes('Ouvrir le lien'), pH.querySelectorAll('[data-role="ouvrir-lien"]').length, q(pL, '[data-role="ouvrir-lien"]')],
          ['A', 'btn link', 'Voir la page d’origine', 'http://site.test/r', '_blank', 'noopener noreferrer', true, true, false, 1, null], 'fiche T3 : a.btn.link[data-role=ouvrir-lien] « Voir la page d’origine » sur une fiche http (I-B5), dans les gestes de tête avant la rangée principale ; « Ouvrir le lien » n’existe plus ; aucun lien sans adresse');
        const signetHttp = blocSignet({ id: 'rc_s', source_url: 'http://a.test/x', availability: 'reference_only' });
        const lienS = q(signetHttp, '[data-role="ouvrir-lien"]');
        eq([lienS?.className, lienS?.textContent, lienS?.getAttribute('href'), lienS?.getAttribute('rel'), signetHttp.textContent.includes('Ouvrir le lien'), signetHttp.querySelectorAll('a.btn.primary').length, lienOrigine(lienSignet('javascript:alert(1)')), lienOrigine(null), lienOrigine(lienSignet('https://b.test/y'))?.getAttribute('href')],
          ['btn link', 'Voir la page d’origine', 'http://a.test/x', 'noopener noreferrer', false, 0, null, null, 'https://b.test/y'], 'blocSignet et lienOrigine : le même lien texte « Voir la page d’origine » (plus de « Ouvrir le lien » primaire) ; une adresse hostile ou absente → null');
        // --- Le sous-titre reste provenanceText (R-UI-P2) : « Du web · » / « De mon livre · » sont les préfixes de la CARTE-PLAT (ligneSource, T2), pas de la fiche — tests/creer-ia.js:1397 épingle « Mon livre — A. B. · page 58 » en header p.
        eq([q(pL, 'header p.muted')?.textContent, q(pH, 'header p.muted')?.textContent], ['Source personnelle', 'site.test'], 'fiche T3 : le sous-titre est provenanceText, inchangé — « Source personnelle » sans livre ni adresse, l’hôte RECALCULÉ pour une fiche web (R-UI-P2 ; § 4.2 amendé par T6)');
        // --- La photo en tête : dans la colonne photo, sans style en ligne (la feuille rend 4:3 pleine colonne)
        // Rév. 3 (ruling 17) : une image RÉELLE, 640 × 400 (16:10, PAS 4:3) — chargée avant la mesure du cadre, elle prouve que le 4:3 mesuré vient de la
        // feuille (aspect-ratio) et non de l'image : un JPEG 4:3 chargé aurait masqué le mutant « aspect-ratio retirée » (Step 10).
        const toile = new OffscreenCanvas(640, 400); toile.getContext('2d').fillRect(0, 0, 640, 400);
        const jpeg = await toile.convertToBlob({ type: 'image/jpeg' }); const sha = await sha256Hex(jpeg);
        await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
        await mettre(fiche('rc_ph', { photo_sha256: sha, photo_origin: 'image' })); await versions(version('rc_ph'));
        const pPh = await monter('rc_ph', fauxMatchMedia(true));
        const img = q(pPh, '[data-role="photo-plat"] img');
        eq([!!img, img?.getAttribute('src')?.startsWith('blob:'), img?.getAttribute('style'), q(pPh, '.fiche-photo')?.contains(img), avant(img, q(pPh, '[data-role="fiche-gestes"]'))], [true, true, null, true, true], 'fiche T3 : la photo de tête vit dans .fiche-photo, avant les gestes, sans style en ligne (plus de 320 px : la feuille rend 4:3 pleine colonne)');
        // --- La FEUILLE servie (D-UI-6), mesurée dans des cadres (la technique de T2 : un <iframe> about:blank par largeur, la feuille chargée DEDANS — les jetons de :root et
        // les @media y valent, ce qu'une scène de la page de tests ou une racine fantôme ne donne pas ; rév. 2). Deux fiches : rc_ph (photo) et rc_t3 (emplacement vide → une colonne).
        const cadre3 = async (largeur) => {
          const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'scène de mesure');
          f.style.cssText = `position:absolute;left:-12000px;top:0;width:${largeur}px;height:1200px;border:0`;
          document.body.append(f);
          const d = f.contentDocument;
          d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><main class="content"></main></body></html>'); d.close();
          const lien = d.createElement('link'); lien.rel = 'stylesheet'; lien.href = new URL('../styles.css?v=' + Date.now(), location.href).href;
          await new Promise((r) => { lien.onload = r; lien.onerror = r; d.head.append(lien); });
          if (f.contentWindow.innerWidth !== largeur) throw new Error(`cadre ${largeur} : innerWidth ${f.contentWindow.innerWidth}`);
          return f;
        };
        const mesureFiche = async (largeur, id) => {
          const f = await cadre3(largeur);
          try {
            const w = f.contentWindow; const S = (n) => w.getComputedStyle(n);
            const p = await renderRecipe({ id }, {}, await ctxPour(), { matchMedia: fauxMatchMedia(largeur >= 760).matchMedia });
            f.contentDocument.querySelector('main').append(p); // adopté par le document du cadre : SA feuille s'applique
            const tete = q(p, '[data-role="fiche-tete"]'); const ph = q(tete, '.fiche-photo'); const img = q(ph, 'img');
            // Rév. 3 (ruling 17) : l'image RÉELLE est CHARGÉE avant la mesure — le cadre est hors écran, loading="lazy" n'y décoderait jamais : on force le
            // chargement (eager + decode) du JPEG réel posé par repo.putFile (640 × 400, le chemin de production) ; la mesure ne dépend pas d'une boîte de
            // remplacement (`chargee` l'affirme par naturalWidth > 0). Si la mesure restait instable, elle porterait sur la figure parente (figure.photo-plat),
            // pas sur l'img. Rév. 4 (point 2) : l'attente est BORNÉE à 3 s — sans `eager`, une img lazy dans un cadre hors écran ne se charge jamais et
            // `decode()` PEND : la suite se figerait au lieu de rougir ; un rejet (indécodable) est avalé, puis `chargee` lit naturalWidth > 0 et tranche.
            if (img) { img.loading = 'eager'; await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]); }
            const rE = q(tete, '[data-role="fiche-etat"]').getBoundingClientRect(); const rP = ph.getBoundingClientRect(); const rG = q(tete, '[data-role="fiche-gestes"]').getBoundingClientRect();
            const rI = img ? img.getBoundingClientRect() : null;
            return { pistesTete: S(tete).gridTemplateColumns.trim().split(/\s+/).length, photoADroite: rP.left >= rE.right - 1 && rP.left >= rG.right - 1, photoEntre: rE.bottom <= rP.top + 1 && rP.bottom <= rG.top + 1,
              chargee: img ? img.naturalWidth > 0 : null,
              imgPleine: rI ? Math.abs(rI.width - rP.width) < 1 : null, ratio: rI ? Math.abs(rI.width / rI.height - 4 / 3) < 0.02 : null, objectFit: img ? S(img).objectFit : null,
              onglets: S(q(p, '[data-role="onglets-corps"]')).display, prep: S(q(p, '[data-role="section-preparation"]')).display, pistesCorps: S(q(p, '[data-role="colonnes-corps"]')).gridTemplateColumns.trim().split(/\s+/).length };
          } finally { f.remove(); }
        };
        const [ph1100, ph375, vide1100] = [await mesureFiche(1100, 'rc_ph'), await mesureFiche(375, 'rc_ph'), await mesureFiche(1100, 'rc_t3')];
        eq([ph1100.pistesTete, ph1100.photoADroite, ph1100.chargee, ph1100.imgPleine, ph1100.ratio, ph1100.objectFit, ph1100.onglets, ph1100.prep, ph1100.pistesCorps], [2, true, true, true, true, 'cover', 'none', 'block', 2],
          'styles.css à 1100 px (D-UI-6) : .fiche-tete en deux colonnes, la photo à droite de l’état ET des gestes (grid-template-areas), l’image RÉELLE chargée (naturalWidth > 0, 640 × 400) rendue pleine colonne en 4:3 recadrée par la feuille ; segmented caché ([hidden]), les deux sections visibles, .recipe-body en deux colonnes (mesurés dans un cadre)');
        eq([ph375.pistesTete, ph375.photoEntre, ph375.chargee, ph375.imgPleine, ph375.ratio, ph375.onglets !== 'none', ph375.prep, ph375.pistesCorps], [1, true, true, true, true, true, 'none', 1],
          'styles.css à 375 px (D-UI-6) : une colonne, la photo ENTRE l’état et les gestes (sous la provenance, maquette mobile), image réelle chargée, pleine largeur 4:3 ; segmented visible, Préparation cachée ([hidden]), une seule colonne de corps (mesurés)');
        eq([vide1100.pistesTete, vide1100.chargee, vide1100.imgPleine, vide1100.photoADroite], [1, null, null, false], 'styles.css à 1100 px, fiche SANS photo : .fiche-tete:has(> .fiche-photo:empty) → une seule colonne (la zone photo déclarée en troisième rangée, 0 px : aucune piste implicite à droite, rév. 4), aucune image (mesuré)');
        eq(reseau, 0, 'fiche T3 : aucun réseau');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));
    }
```

- [ ] **Step 2 : tests amendés (épingles de la spec § 7 T3, retrouvées par leur TEXTE ; jamais contournées).**
  1. `tests/photo-plat.js:340-341` (bloc « fiche : places… », aide `avant` l. 338) : « Original » devient `plain`, la carte des contrôles devient le `details` :

```js
        const original = [...pP.querySelectorAll('section.plain')].find((s) => s.querySelector('h2')?.textContent === 'Original');
        eq([avant(pP.querySelector('[data-role="emplacement-photo-plat"]'), pP.querySelector('[data-role="autres-gestes"]')), avant(pP.querySelector('.recipe-body'), zoneP), avant(zoneP, original), zoneP?.querySelector('h2')?.textContent],
          [true, true, true, 'Photo du plat'], 'places (UI-1, D-UI-6) : l’emplacement de tête (dans .fiche-tete) avant « Portions, versions et autres gestes » ; la section « Photo du plat » (.card) après .recipe-body et avant « Original » (plain)');
```

  2. `tests/sync-l4.js:3476` : `const original = [...page.querySelectorAll('section.card')].find(…'Original')` → `section.plain` (le reste de la ligne inchangé).
  3. `tests/creer-ia.js` : l. 1341 `[...page.querySelectorAll('section.card')].find(… 'Versions')` → `section.plain` ; l. 1346 :
     `ok(apres(page.querySelector('[data-role="autres-gestes"] .row.between'), adapter) && page.querySelector('[data-role="autres-gestes"]').contains(adapter), 'fiche IA : le bouton est dans « Portions, versions et autres gestes », à la place des puces V1');` ;
     l. 1376 `textes(pageC, '.card.sage select option')` → `textes(pageC, '[data-role="autres-gestes"] select option')` ; l. 1391 de même sur `pageA` ;
     l. 1790 `sectionVersions = (p) => [...p.querySelectorAll('section.card')].find(… 'Versions')` → `section.plain`.
  4. `tests/lecture-web.js` (aide `lien(root, texte)` l. 594 : égalité stricte du `textContent` ; numéros RÉELS à `f3672be`, rév. 2) :
     - l. 605 : `lien(root, 'Ouvrir le lien')?.getAttribute('href')` → `lien(root, 'Voir la page d’origine')?.getAttribute('href')` ; message : « … aucun « Choisir des photos », « Voir la page d’origine », sous-titre = hôte recalculé » ;
     - l. 611 : `eq(lien(root, 'Voir la page d’origine')?.getAttribute('rel'), 'noopener noreferrer', 'écran (I-B5, ronde 1) : « Voir la page d’origine » de l’écran porte rel="noopener noreferrer"');` ;
     - l. 792 (zoneEchec de l'écran, après « Annuler ») : `root.querySelector('[data-role="action"] a')?.classList.contains('primary')` → `root.querySelector('[data-role="action"] a')?.classList.contains('link')`
       (attendu `true` inchangé : le premier `a` de la rangée est désormais `lienOrigine`, `a.btn.link`, à la place d'`ouvrir('btn primary')`, import-web.js:450) ; message
       « Annuler : fetch abandonné, echec(annule), texte I-B7 ; « Voir la page d’origine » (lien texte), « Réessayer », « Ignorer », « Retour à la fiche » » ;
     - l. 1051 : attendu `'Ouvrir le lien'` → `'Voir la page d’origine'` (le premier `a` du bloc reste le lien d'origine : la rangée est `boutonLire` (un `button`), `ouvrir()`, `hote`) ; message « … bouton éteint, carte cachée, « Voir la page d’origine » » ;
     - l. 1055 : `!!lien(sansSession, 'Ouvrir le lien')` → `!!lien(sansSession, 'Voir la page d’origine')` ; message « … « Voir la page d’origine » reste » ;
     - l. 1071 (echec) : `lien(echec, 'Ouvrir le lien').classList.contains('primary')` → `lien(echec, 'Voir la page d’origine')?.classList.contains('link')` (attendu `true` inchangé) ; message « … « Voir la page d’origine » (lien texte), « Réessayer », la phrase du cas dessous » ;
     - l. 1073 (http) : `!!lien(http, 'Ouvrir le lien')` → `!!lien(http, 'Voir la page d’origine')` ; message de même ;
     - l. 676, 679, 682, 1109, 1150 : code INCHANGÉ (ils lisent `[data-role="ouvrir-lien"]`) ; seuls leurs messages remplacent « Ouvrir le lien » par « Voir la page d’origine » ; l. 672 : un commentaire, réécrit de même.
  5. `tests/ajouter.js` :
     - l. 37 (`CHAINES_NEUVES_AILLEURS['../src/ui/recipe.js']`) : `'Ouvrir le lien'` retiré de la liste ; à la fin de la liste de recipe.js, après `'Section : {s}'` :
       `,\n    // Lot UI-1, tâche 3 : les gestes repliés et les repères de l'en-tête (D-UI-6).\n    'Portions, versions et autres gestes', '{n} portions · {d}'` ;
     - l. 45 (`'../src/ui/components.js'`) : en fin de liste, `,\n    // Lot UI-1, tâche 3 : « Voir la page d’origine » (D-UI-10, I-B5), une définition pour la fiche, le bloc du signet et l'écran d'import web.\n    'Voir la page d’origine'` ;
     - l. 1149 : attendu `'Ouvrir le lien'` → `'Voir la page d’origine'` ; message « signet : lien revalidé au rendu, noopener noreferrer, lien texte « Voir la page d’origine » ».
  Aucune autre épingle ne vise ces blocs (Step 0) : `tests/import-cible.js:1628, 1648, 1716, 1759` lisent `.recipe-body ul.list.plain > li` et `.recipe-body .chip`
  (toujours vrais : les listes vivent dans les sections `plain` du corps) ; `tests/classement.js:1886, 2074, 2082` cherchent une `section` sans classe ;
  `tests/photo-plat.js:464-473` (D-F15) compare le premier enfant de `.recipe-body` avant et après une pose de photo (le `segmented`, même nœud : vrai) ;
  `tests/creer-ia.js:1350` lit `.recipe-body` qui contient `[data-role="notes-ia"]` (toujours vrai : « À vérifier avant de servir » suit le `.two-col` dans le corps).

- [ ] **Step 3 : rouge lu.** `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` : `❌` — le bloc « fiche recette (T3) » rouge dès sa première
  assertion (`mmL.requetes` vaut `[]` : aucun `matchMedia` demandé) puis `.fiche-tete` et `[data-role="autres-gestes"]` nuls ; `tests/photo-plat.js:341`
  (`[data-role="autres-gestes"]` nul → `avant` faux, « Original » introuvable en `plain`) ; `tests/sync-l4.js:3476` (« Original » en `plain` introuvable →
  `!!groupe` faux) ; `tests/creer-ia.js:1341, 1346, 1376, 1391, 1790` (section `plain` et details absents : `TypeError` attrapée par le bloc, ou `options`
  vides) ; `tests/lecture-web.js:605, 611, 1051, 1055, 1071, 1073` et `tests/ajouter.js:1149` (« Voir la page d’origine » introuvable) ; `tests/lecture-web.js:792`
  (`.link` attendu, obtenu `false` : le premier `a` de `[data-role="action"]` est encore `btn primary`) ; les filets i18n de
  `tests/ajouter.js` (l. 3786-3799 : `'Voir la page d’origine'`, `'Portions, versions et autres gestes'`, `'{n} portions · {d}'` absents d'en.js). Node
  (`node --test tools/*.test.mjs`) et `node tools/generer-migrations.mjs --check` : verts et inchangés (aucun fichier serveur touché). Un rouge AILLEURS que
  dans cette liste = NEEDS_CONTEXT (une épingle non relevée par la spec).

- [ ] **Step 4 : implémenter `src/ui/recipe.js`.** Imports (l. 3 et l. 16 à `f3672be`) :

```js
import { el, toast, chooseDialog, promptDialog, confirmDialog, formatDate, formatMinutes, downloadBlob } from '../core/dom.js';
import { pageHeader, section, sectionPlain, lienOrigine, dureeTotale, availabilityBadge, versionBadge, timeText, provenanceText, segmented, select, ingredientLineEl, timerBlock, dietChip, recipeCard, banniereLecture, sessionAssistant, carteConnexion, ligneReperes, contexteFichiers, vignettesDePages, boutonTelechargerPages } from './components.js';
```

  Deux fonctions PURES neuves, exportées, posées après `adresseInerte` (l. 29) :

```js
// UI-1 (D-UI-6, B-I-6) : la durée d'une version, en UN nombre par formatMinutes (jamais la paire « actif · total » de timeText, qui reste dans
// l'en-tête d'Ingrédients). LA règle est celle de la carte-plat, dureeTotale (components.js, T2 : total_minutes ?? prep + cook ; null sans durée
// connue, non numérique, ou pour une création IA — C-6 : son estimation est dite à part) ; ici seulement la mise en forme, '' si rien ou ≤ 0.
export function dureeVersion(version) {
  const total = dureeTotale(version);
  return total !== null && total > 0 ? formatMinutes(total) : '';
}
// La ligne de repères de l'en-tête : « {n} portions · {durée} », chaque partie seulement si connue ; portions = celles de la VERSION affichée (une donnée,
// entier ≥ 1 — jamais la valeur du −/+, qui recalcule les lignes sans changer la recette) ; null quand rien n'est connu (aucune ligne rendue).
export function texteReperes(version) {
  if (!version) return null;
  const n = Number.isInteger(version.servings) && version.servings >= 1 ? version.servings : null;
  const d = dureeVersion(version);
  if (n !== null && n >= 2 && d) return t('{n} portions · {d}', { n, d });
  const parties = [];
  if (n === 1) parties.push(t('1 portion')); else if (n !== null) parties.push(t('{n} portions', { n }));
  if (d) parties.push(d);
  return parties.length ? parties.join(' · ') : null;
}
```

  Dans `renderRecipe` : l. 72, `state` gagne le choix de l'onglet — `const state = { servings: …, units: ctx.settings.units, lang: query.lang || ctx.settings.reading_locale, diet: '', onglet: 'ingredients' };`.
  Puis le bloc l. 87-176 (du `pageHeader` à `root.append(photo.zone)`) devient, entier (les commentaires existants des blocs conservés — conflit § 5.5, import ciblé,
  lot B, D-11, D-B18, N-5 — sont gardés tels quels là où ils sont repris ; seuls ceux cités ici sont neufs) :

```js
  // UI-1 (D-UI-6, F-5) : la largeur par un matchMedia INJECTABLE (deps.matchMedia ; défaut : celui de la fenêtre, appelé SUR window — jamais la fonction
  // nue : « Illegal invocation »). Une seule requête, celle de .two-col (760 px, le motif de dish.js) ; `large()` la relit à chaque usage.
  const mq = (deps.matchMedia ?? ((requete) => window.matchMedia(requete)))('(min-width: 760px)');
  const large = () => !!mq.matches;
  // R-UI-P2 : le sous-titre reste la provenance (« {titre} — {auteur} · page N », hôte recalculé, étiquette IA) ; « Du web · » / « De mon livre · » sont les préfixes de la
  // CARTE-PLAT (ligneSource), pas de la fiche — § 4.2 amendé par T6 ; tests/creer-ia.js:1338, 1375, 1397, 1400 lisent ce header p tel quel.
  root.append(pageHeader(recipe.display_title || recipe.original_title, {
    subtitle: provenanceText(recipe, book, edition), back: edition ? { href: `/books/${edition.id}`, label: book?.title || t('Livre') } : { href: '/library', label: t('Bibliothèque') },
    actions: [favBtn], classeTitre: 'titre-fiche',
  }));

  // Conflit de version (spec § 5.5) : … (bloc l. 92-100 inchangé : `const conflit = …` et sa carte « Une autre version a été créée ailleurs »)
  const conflit = await repo.get('sync_conflicts', 'recipes:' + params.id);
  if (conflit?.kind === 'version') {
    root.append(el('div', { class: 'card warn stack' },
      el('p', null, t('Une autre version a été créée ailleurs — les deux versions sont conservées.')),
      el('a', { class: 'btn', href: '#/settings' }, t('Trancher dans Réglages'))));
  }
  // Import ciblé (spec § 4.3.6-4.3.7) : … (commentaire l. 101-105 inchangé)
  const ligneLue = (ctx.imports || []).find((i) => i?.id === version?.provenance?.import_id) || null;
  const lecture = banniereLecture(version, ligneLue?.kind === 'web' ? { ...ligneLue, resultat: relireResultat(ligneLue.resultat)?.recette ?? null } : ligneLue);
  // UI-1 (D-UI-6) : l'en-tête en deux colonnes — UN ordre de DOM : l'état (badges, bandeaux), la photo, les gestes (repères, « Voir la page d’origine »,
  // « Commencer à cuisiner » + « Corriger »). La feuille met la photo à droite dès 760 px et, en étroit, la laisse entre l'état et les gestes (sous la
  // provenance, avant les repères : la maquette mobile). Les gestes ne sont posés qu'avec une version (plus bas).
  const etat = el('div', { class: 'stack fiche-etat', dataset: { role: 'fiche-etat' } },
    el('div', { class: 'row' }, availabilityBadge(recipe), versionBadge(version, recipe), lecture ? etatVerification(version) : null, recipe.type ? el('span', { class: 'badge' }, label('recipe_type', recipe.type)) : null, ...(recipe.cuisines || []).map((c) => el('span', { class: 'chip outline' }, capitaliser(c)))));
  const web = bandeauWeb(version);
  if (web) etat.append(web); // lot B (§ 4.5) : la source d'une version lue sur le web, d'abord — puis la bannière du lot A
  if (lecture) etat.append(bandeauLecture(lecture));
  const ctxF = await contexteFichiers(ctx); // lot G : compte, file_error et moteur, pour les vignettes et la photo du plat (§ 4.4)
  // Lot F (§ 4.1.1) : l'emplacement de tête (un div, jamais null : aucun nœud texte direct) ; la zone est insérée plus bas, après la préparation.
  const photo = await monterPhotoPlat(recipe, ctx, { ...deps, ctxF });
  photo.entete.classList.add('fiche-photo');
  const tete = el('div', { class: 'two-col fiche-tete', dataset: { role: 'fiche-tete' } }, etat, photo.entete);
  root.append(tete);

  if (!version) {
    root.append(await referenceOnly());
    // F-9 : la carte « Connecte-toi » et le bouton de lecture sont rendus cachée / éteint ; la session (déjà lue plus haut) les bascule ici —
    // jamais de flash « Connecte-toi » pour une personne connectée, jamais de carte retirée (le motif d'import.js).
    basculerSessionSignet(root, sessionWeb, enLigneWeb());
    return root;
  }

  // Sélecteur Original / Ma version — C-2 : … (l. 125-138 inchangées : statutDe, libelleOption, versionOptions, estUneCreation, selectVersion)
  const statutDe = (v) => (v.status === 'tested' ? t('testée') : t('proposée'));
  const libelleOption = (v, { adaptation }) => {
    const ia = etiquetteCreationIA(v, recipe);
    if (!ia) return adaptation ? `${t('Ma version')} — ${statutDe(v)} ${formatDate(v.created_at)}` : t('Original');
    const statut = adaptation && !estCreationIA(v) ? ` — ${statutDe(v)}` : '';
    return adaptation ? `${t(ia)}${statut} ${formatDate(v.created_at)}` : t(ia);
  };
  const versionOptions = [];
  if (original) versionOptions.push({ value: original.id, label: libelleOption(original, { adaptation: false }) });
  for (const a of adaptations) versionOptions.push({ value: a.id, label: libelleOption(a, { adaptation: true }) });
  const estUneCreation = estCreationIA(version);
  const selectVersion = (id) => navigate(`/recipes/${recipe.id}${buildQuery({ v: id, servings: state.servings || '' })}`, { replace: true });

  // Les gestes de tête (D-UI-6, B-I-8) : les repères, le lien d'origine (toute adresse lisible, http compris : I-B5), puis « Commencer à cuisiner » pleine
  // largeur et, tant que la version AFFICHÉE n'est pas vérifiée, « Corriger » en lien texte à côté — le seul geste que « — vérifie » et « {n} lignes à
  // vérifier » réclament ; il reste aussi dans « autres gestes ».
  const reperes = texteReperes(version);
  tete.append(el('div', { class: 'stack fiche-gestes', dataset: { role: 'fiche-gestes' } },
    reperes ? el('div', { class: 'reperes muted', dataset: { role: 'reperes' } }, reperes) : null,
    lienOrigine(lienFiche),
    el('div', { class: 'geste-principal', dataset: { role: 'geste-principal' } },
      el('button', { class: 'btn primary big block', onClick: startCooking }, t('Commencer à cuisiner')),
      version.verification_state !== 'verified' ? el('a', { class: 'btn link', href: `#/recipes/${recipe.id}/edit?kind=correction&v=${version.id}`, dataset: { role: 'corriger-tete' } }, t('Corriger')) : null)));

  // « Portions, versions et autres gestes » (D-UI-6, § 13 point 4) : TOUT l'ancien contenu de la carte des contrôles et de la rangée d'actions, sauf
  // « Commencer à cuisiner » et le « Corriger » de tête — replié sous 760 px, ouvert au-dessus (le matchMedia, relu sur change) ; jamais « Réglages »
  // (l'app a déjà un écran de ce nom). L'Export reste en bas de la fiche, hors du details (H-3).
  const autresGestes = el('details', { class: 'card', open: large(), dataset: { role: 'autres-gestes' } },
    el('summary', null, t('Portions, versions et autres gestes')),
    el('div', { class: 'stack' },
      el('div', { class: 'row between' },
        versionOptions.length > 1 ? select(versionOptions, version.id, selectVersion) : etiquetteCreationIA(version, recipe) ? versionBadge(version, recipe) : el('span', { class: 'badge original' }, t('Original')),
        el('div', { class: 'row' },
          el('a', { class: 'btn small', href: `#/recipes/${recipe.id}/edit?kind=adaptation&v=${version.id}` }, t('Créer ma version')),
          el('a', { class: 'btn small', href: `#/recipes/${recipe.id}/edit?kind=correction&v=${version.id}` }, t('Corriger')),
          // Import ciblé (spec import-cible § 4.1, D-11) : une recette partielle se relit par l'écran déjà rattaché (import à refaire) ; une recette complète n'a pas d'entrée.
          recipe.availability === 'partial' && !recipe.source_url ? el('a', { class: 'btn small', href: `#/recipes/${encodeURIComponent(recipe.id)}/importer` }, t('Relire les pages')) : null,
          // Lot B (D-B18) : une fiche à adresse https qui a déjà une version se relit par l'assistant — absent sans session.
          lisibleParLAssistant && sessionWeb ? el('button', { type: 'button', class: 'btn small', dataset: { role: 'relire-web' }, onClick: lireWeb }, t('Relire la page avec l’assistant')) : null)),
      el('div', { class: 'row' },
        el('label', { class: 'field' }, el('span', null, t('Portions')), el('div', { class: 'row' },
          el('button', { class: 'btn small', onClick: () => setServings((state.servings || 1) - 1) }, '−'),
          el('strong', { id: 'servings-val' }, state.servings ?? t('inconnues')),
          el('button', { class: 'btn small', onClick: () => setServings((state.servings || 0) + 1) }, '+'))),
        el('label', { class: 'field' }, el('span', null, t('Unités')), segmented([{ value: 'original', label: t('Original') }, { value: 'metric', label: t('Métrique') }, { value: 'us', label: 'US' }], state.units, (v) => { state.units = v; drawBody(); })),
        el('label', { class: 'field' }, el('span', null, t('Langue de lecture')), segmented([{ value: 'original', label: t('Original') }, { value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }], state.lang, (v) => { state.lang = v; drawBody(); }))),
      // N-5 : une création IA s'adapte par l'assistant (version enfant, original intact) ; les puces V1 s'effacent devant ce geste réel.
      estUneCreation
        ? el('div', { class: 'row' }, el('a', { class: 'btn small', href: `#/recipes/creer${buildQuery({ adapter: version.id })}`, dataset: { role: 'adapter-ia' } }, t('Adapter avec l’IA')))
        : el('div', { class: 'chips' },
          ...[t('Rapide'), t('On se gâte'), t('Meal prep')].map((n) => el('span', { class: 'chip neutral', title: t('Adaptation assistée : palier V1, non disponible dans cette version. Utilise « Créer ma version » pour décrire toi-même les changements.') }, `${n} · V1`))),
      el('small', { class: 'muted' }, t('Changer les portions, les unités ou la langue ne crée pas de nouvelle version. Les durées ne sont pas multipliées.')),
      el('div', { class: 'row', dataset: { role: 'autres-actions' } },
        el('a', { class: 'btn', href: `#/search${buildQuery({ for: recipe.id, role: 'salade', mode: 'all' })}` }, t('Avec quoi on mange ça ?')),
        el('button', { class: 'btn', onClick: () => addToMealFlow(ctx, { recipe, version, book, edition }, { role: recipe.type === 'salade' || recipe.type === 'soupe' || recipe.type === 'legumes' || recipe.type === 'feculent' ? 'accompagnement' : 'plat_principal' }) }, t('Ajouter à mon repas')),
        el('button', { class: 'btn', onClick: makeList }, t('Liste d’épicerie')),
        dish ? el('a', { class: 'btn', href: `#/dishes/${dish.id}` }, t('Autres recettes de ce plat')) : el('button', { class: 'btn', onClick: attachDish }, t('Rattacher à un plat')))));
  root.append(autresGestes);

  const body = el('div', { class: 'recipe-body' }); // C-7 : overflow-wrap (styles.css)
  root.append(body);
  drawBody();
  root.append(photo.zone); // lot F (D-F2, D-F8) : seulement quand la fiche a une version
  // La largeur, écoutée sur change (F-5) : le details s'ouvre ou se replie, le corps bascule entre colonnes et onglets — sans redessin. Une fiche vue
  // dans le document puis retirée se désabonne à la notification suivante (la MediaQueryList garde ses abonnés : aucune fuite à chaque visite).
  let inseree = false;
  const surLargeur = () => {
    if (root.isConnected) inseree = true;
    else if (inseree) { mq.removeEventListener('change', surLargeur); return; }
    autresGestes.open = large();
    appliquerCorps();
  };
  mq.addEventListener('change', surLargeur);
```

  Les anciennes lignes 164-171 (la rangée d'actions avec « Commencer à cuisiner », « Avec quoi on mange ça ? », …, « Ouvrir le lien ») disparaissent : leurs
  gestes vivent dans `[data-role=autres-actions]`, « Commencer à cuisiner » dans `.geste-principal`, le lien dans `lienOrigine(lienFiche)` (l'ancien
  `t('Ouvrir le lien')` et son commentaire I-B5 l. 170 sont retirés). Le `div.row` des badges avec son `style: { marginBottom: '.8rem' }` (l. 108) et le
  `root.append(photo.entete)` (l. 115) sont remplacés par `.fiche-etat` et `tete`.

  Les trois sections du bas (l. 182, 190, 198) passent en `plain` — même appel, seule la fonction change : `root.append(sectionPlain(t('Original'), …))`,
  `root.append(sectionPlain(t('Versions'), …))`, `root.append(sectionPlain(t('Mémoire culinaire'), …))` ; la rangée Export (l. 204-208) et `setServings`
  (l. 211) ne changent pas. `drawBody` (l. 213-253) devient, entière, suivie d'`appliquerCorps` (fonction déclarée, hissée : `drawBody()` l'appelle avant
  que `surLargeur` existe) :

```js
  function drawBody() {
    body.replaceChildren();
    const scaled = scaleVersion(version, state.servings);
    const translation = state.lang !== 'original' ? ctx.recipe_translations.find((tr) => tr.recipe_version_id === version.id && tr.locale === state.lang) : null;
    const wantsTranslation = state.lang !== 'original' && state.lang !== (recipe.original_language || 'fr');
    const ctxQty = { system: state.units, locale: state.lang === 'original' ? (recipe.original_language || 'fr') : state.lang, convention_id: conventionId, readingLocale: state.lang, originalLocale: recipe.original_language || 'fr', showSource: true };
    const ingList = el('ul', { class: 'list plain' });
    scaled.ingredients.forEach((ri, i) => {
      const li = ingredientLineEl(ri, ctxQty, ctx.ingredientsById);
      if (translation?.translated_content?.ingredients?.[i]) li.append(el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `${t('Traduction')} : ${translation.translated_content.ingredients[i]}`));
      li.append(el('button', { class: 'btn small', style: { marginLeft: '.4rem' }, onClick: () => replaceIngredient(ri) }, t('Remplacer')));
      ingList.append(li);
    });
    // § 3.3, C-6, C-9 : sur une création, ce que l'assistant a dit (préfixé « Selon l’assistant »), sa durée ESTIMÉE (jamais dans
    // timeText), et l'avertissement fixe — relus et rebornés par lireCreation (une ligne reçue peut porter n'importe quoi), en texte seul.
    const lc = lireCreation(version);
    if (lc) body.append(el('section', { class: 'card stack', dataset: { role: 'creation-ia' } },
      lc.description ? el('p', { dataset: { role: 'description-ia' } }, t('Selon l’assistant : {texte}', { texte: lc.description })) : null,
      lc.minutes ? el('div', { class: 'muted', dataset: { role: 'minutes-ia' } }, t('environ {m} min (estimé par l’assistant)', { m: lc.minutes })) : null,
      el('div', { class: 'status warn', dataset: { role: 'avertissement-ia' } }, t(AVERTISSEMENT_CREATION_IA))));
    const dietSel = select([{ value: '', label: t('Évaluer une restriction…') }, ...DIET_TAGS.map((d) => ({ value: d, label: label('diet', d) }))], state.diet, (v) => { state.diet = v; drawBody(); });
    const assessment = state.diet ? assessVersion(version, ctx.ingredientsById, state.diet) : null;
    // UI-1 (D-UI-6, D-UI-8) : Ingrédients et Préparation en sections `plain`, côte à côte dès 760 px (.two-col), en onglets au-dessous (segmented ;
    // la section non choisie cachée par hidden, les deux toujours dans le DOM). Le segmented est reconstruit à chaque drawBody ; le choix (state.onglet)
    // survit. La liste garde ingredientLineEl et « Remplacer » ; le select « Évaluer une restriction… » et timeText (« actif · total ») restent dans l'en-tête de la section.
    const ingredients = sectionPlain(`${t('Ingrédients')}${scaled.ok && scaled.factor !== 1 ? ` — ${t('recalculés pour {n} portions', { n: state.servings })}` : version.servings ? ` — ${t('{n} portions', { n: version.servings })}` : ''}`,
      el('div', { class: 'row between' }, el('span', { class: 'muted' }, timeText(version)), dietSel),
      assessment ? el('div', { style: { margin: '.4rem 0' } }, dietChip(assessment), assessment.unknown.length ? el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `${t('Inconnus')} : ${assessment.unknown.join(', ')}`) : null) : null,
      wantsTranslation && !translation ? el('div', { class: 'status warn' }, t('Aucune traduction {l} pour cette version.', { l: state.lang.toUpperCase() }), el('a', { class: 'btn small', href: `#/recipes/${recipe.id}/edit?kind=translation&v=${version.id}` }, t('Traduire'))) : null,
      translation ? el('div', { class: 'row' }, el('span', { class: 'badge' }, t('Traduction')), el('span', { class: 'muted' }, translation.translated_content.title || '')) : null,
      ingList, ...scaled.notes.map((n) => el('small', { class: 'muted', style: { display: 'block' } }, n)),
      !conventionId && scaled.ingredients.some((i) => ['cup', 'tbsp', 'tsp', 'fl_oz'].includes(i.unit_id)) ? el('div', { class: 'status warn', style: { marginTop: '.5rem' } }, t('Tasses/cuillères : convention non confirmée pour cette édition — quantités d’origine affichées.'), edition ? el('a', { class: 'btn small', href: `#/books/${edition.id}` }, t('Préciser')) : null) : null);
    ingredients.dataset.role = 'section-ingredients';
    const steps = el('ol', { class: 'list steps' });
    (version.steps || []).forEach((s, i) => {
      const li = el('li', null, el('span', { class: 'step-num' }, String(i + 1)), el('div', { style: { flex: 1 } },
        el('div', { style: { whiteSpace: 'pre-line' }, dataset: { role: 'texte-etape' } }, s.text), // m10 : une étape lue entière garde ses sauts de ligne
        translation?.translated_content?.steps?.[i] ? el('div', { class: 'muted', style: { fontSize: '.9rem' } }, translation.translated_content.steps[i]) : null,
        ...(s.timers || []).slice(0, 2).map((tm) => timerBlock(tm.seconds, { compact: true, onRequest: (channel) => repo.save('timer_launches', createTimerLaunch({ recipe_version_id: version.id, step_id: s.id, device_id: deviceId(), duration_seconds: tm.seconds, channel })) }))));
      steps.append(li);
    });
    const preparation = sectionPlain(t('Préparation'), (version.steps || []).length ? steps : el('p', { class: 'muted' }, t('Étapes non numérisées.')), version.notes ? el('p', { class: 'muted' }, version.notes) : null);
    preparation.dataset.role = 'section-preparation';
    const onglets = segmented([{ value: 'ingredients', label: t('Ingrédients') }, { value: 'preparation', label: t('Préparation') }], state.onglet, (v) => { state.onglet = v; appliquerCorps(); });
    onglets.dataset.role = 'onglets-corps';
    onglets.querySelectorAll('button').forEach((b, i) => { b.dataset.value = ['ingredients', 'preparation'][i]; }); // segmented() ne pose pas la valeur : le segment actif se retrouve par elle
    body.append(onglets, el('div', { class: 'two-col', dataset: { role: 'colonnes-corps' } }, ingredients, preparation));
    appliquerCorps();
    if (lc?.conseils.length) body.append(section(t('Conseils'), el('ul', { dataset: { role: 'conseils-ia' } }, ...lc.conseils.map((c) => el('li', null, t('Selon l’assistant : {texte}', { texte: c }))))));
    if (lc?.notes.length) body.append(section(t('À vérifier avant de servir'), el('ul', { dataset: { role: 'notes-ia' } }, ...lc.notes.map((n) => el('li', null, n)))));
  }

  // La bascule Ingrédients / Préparation (D-UI-6, F-5) : LOCALE — ni navigation, ni appel, ni redessin. En large : les deux sections visibles, le segmented
  // caché ; en étroit : la section non choisie cachée ([hidden]), le segment actif suit state.onglet. Appelée par drawBody, par la tape, par le change du matchMedia.
  function appliquerCorps() {
    const onglets = body.querySelector('[data-role="onglets-corps"]');
    if (!onglets) return;
    const etroit = !large();
    onglets.hidden = !etroit;
    for (const b of onglets.querySelectorAll('button')) b.classList.toggle('active', b.dataset.value === state.onglet);
    body.querySelector('[data-role="section-ingredients"]').hidden = etroit && state.onglet !== 'ingredients';
    body.querySelector('[data-role="section-preparation"]').hidden = etroit && state.onglet !== 'preparation';
  }
```

  `blocSignet` (l. 336-367) : le commentaire de tête dit désormais « « Voir la page d’origine » (lien texte, D-UI-10) est toujours là, http: compris » à la
  place de « « Ouvrir le lien » est toujours là. » ; la ligne 341 devient
  `const ouvrir = () => lienOrigine(lien); // D-UI-10 (I-B5) : « Voir la page d’origine », lien texte — le même sur la fiche et l'écran d'import web`
  et ses six appels perdent leur argument : l. 349 `ouvrir('btn primary')` → `ouvrir()`, l. 359 `ouvrir('btn')` → `ouvrir()`, l. 360 `ouvrir('btn')` → `ouvrir()`,
  l. 361 `ouvrir('btn primary')` → `ouvrir()`, l. 363 `ouvrir('btn')` → `ouvrir()` (sur un échec et sur une adresse http:, le lien n'est plus le bouton primaire :
  c'est un lien texte, la décision D-UI-10 ; « Réessayer » et « Lire la recette avec l’assistant » gardent leur rang). Les fonctions `startCooking`,
  `makeList`, `attachDish`, `replaceIngredient`, `referenceOnly`, `basculerSessionSignet`, `bandeauWeb`, `etatVerification`, `bandeauLecture`, `slug` et
  l'`export { recipeCard }` ne changent pas.

- [ ] **Step 5 : implémenter `components.js`, `import-web.js`, `photo-plat.js`.** `src/ui/components.js`, après `availabilityBadge` (l. 33-39) :

```js
// UI-1 (D-UI-10, I-B5) : « Voir la page d’origine » — un lien texte vers l'adresse LISIBLE d'une fiche (lienSignet : http: compris, seule la LECTURE exige
// https), le même sur la fiche, le bloc du signet et l'écran d'import web ; la flèche « ↗ » est posée par la feuille (::after), hors du texte. null sans
// adresse lisible. Remplace « Ouvrir le lien » (trois sites : recipe.js ×2, import-web.js).
export function lienOrigine(lien) {
  if (!lien?.ok) return null;
  return el('a', { class: 'btn link', href: lien.href, target: '_blank', rel: 'noopener noreferrer', dataset: { role: 'ouvrir-lien' } }, t('Voir la page d’origine'));
}
```

  `src/ui/import-web.js` : l. 17 `import { sessionAssistant, carteConnexion, texteRefusAssistant, texteEchecAssistant, availabilityBadge, section, INCERTAIN_MAX, lienOrigine } from './components.js';` ;
  l. 390 `const ouvrir = (classe = 'btn') => (lien.ok ? el('a', { class: classe, href: lien.href, target: '_blank', rel: 'noopener noreferrer' }, t('Ouvrir le lien')) : null);`
  → `const ouvrir = () => lienOrigine(lien); // D-UI-10 : « Voir la page d’origine », lien texte (null si l'adresse ne se lit pas)` ; l. 397 `ouvrir()` inchangé ;
  l. 450 `ouvrir('btn primary')` → `ouvrir()`. Aucun autre `t('Ouvrir le lien')` ne subsiste dans `src/` (`grep -rn "Ouvrir le lien" src/` : vide après en.js, Step 7).

  `src/ui/photo-plat.js:87` : `figure.replaceChildren(el('img', { alt: t('Photo du plat'), src, loading: 'lazy' }), ...[legende()].filter(Boolean));`
  (le `style: { display: 'block', width: '320px', maxWidth: '100%', borderRadius: 'var(--radius)' }` disparaît : `img { display: block }` est global, la
  feuille rend la figure 4:3 pleine colonne — D-UI-6 « le style inline 320 px de la photo disparaît ») ; le commentaire de `figurePhotoPlat` (l. 63-67) gagne
  « UI-1 (D-UI-6) : l'image n'a plus de largeur en ligne, `.photo-plat img` la rend 4:3 dans la colonne de l'en-tête ». Rien d'autre ne change dans ce module.

- [ ] **Step 6 : implémenter `styles.css`** — après la règle `.two-col` et son `@media` (l. 278-279 à `f3672be` ; T1 a pu poser `.two-col.livre` juste après :
  ces règles vont APRÈS elle). Jetons seulement, aucune couleur, aucun `display: none` (les sections et le segmented se cachent par `[hidden]`), aucun `56px`,
  aucun `:hover` (T-1, T-2, T-11 ; `:has()` et `:empty` comme R-VIS-10 ; la chaîne `" ↗"` est retirée des valeurs par le test des couleurs nommées) :

```css
/* UI-1 (D-UI-6) : l'en-tête de la fiche recette — un seul ordre de DOM (état, photo, gestes) : en étroit, la photo passe sous la provenance et avant les
   repères (maquette mobile) ; dès 760 px, deux colonnes : l'état puis les gestes à gauche, la photo à droite sur les deux rangées ; sans photo
   (emplacement vide), une seule colonne, rien de réservé à droite : la zone « photo » reste DÉCLARÉE, en troisième rangée (0 px : l'enfant vide y tombe).
   Rév. 4 : sans elle, l'enfant vide `grid-area: photo` sans zone nommée prenait une piste IMPLICITE à droite (mesure Chromium : « 1068px 0px 0px »,
   `photoADroite` vrai) ; le gap de 1 rem qui en résulte sous les gestes est ACCEPTÉ. Le segmented Ingrédients / Préparation et la section non choisie se
   cachent par [hidden]. */
.fiche-tete { margin-bottom: 1.2rem; }
.photo-plat img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--radius); }
.reperes { font-size: 1.05rem; }
/* « Commencer à cuisiner » prend la place, « Corriger » (lien texte) se range à côté ; seul, le bouton remplit la rangée. */
.geste-principal { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: .6rem; }
.geste-principal > .btn.block { width: auto; }
/* D-UI-10 : la flèche de « Voir la page d’origine » vit dans la feuille, hors du texte du lien. */
a[data-role="ouvrir-lien"]::after { content: " ↗"; }
details[data-role="autres-gestes"] > summary { cursor: pointer; font-family: var(--serif); font-weight: 600; font-size: 1.15rem; padding: .3rem 0; min-height: 44px; }
details[data-role="autres-gestes"][open] > summary { margin-bottom: .6rem; }
.recipe-body > [data-role="onglets-corps"] { margin-bottom: .8rem; }
@media (min-width: 760px) {
  .fiche-tete { grid-template-areas: "etat photo" "gestes photo"; align-items: start; }
  .fiche-tete > .fiche-etat { grid-area: etat; }
  .fiche-tete > .fiche-gestes { grid-area: gestes; }
  .fiche-tete > .fiche-photo { grid-area: photo; }
  /* Sans photo : une colonne, et la zone photo GARDÉE en troisième rangée (0 px) — l'enfant vide `grid-area: photo` y tombe au lieu d'ouvrir une piste implicite
     à droite (rév. 4 ; `grid-area: etat` sur l'enfant vide est REFUSÉ : étiré sur la cellule de l'état, il se peindrait au-dessus et intercepterait les tapes ;
     `display: none` interdit, T-1). Le gap de 1 rem sous les gestes est accepté. */
  .fiche-tete:has(> .fiche-photo:empty) { grid-template-columns: 1fr; grid-template-areas: "etat" "gestes" "photo"; }
}
```

  (`.two-col` donne déjà `display: grid`, `gap: 1rem` et `1fr 1fr` dès 760 px : `.fiche-tete` n'ajoute que les zones ; la figure garde son
  `style: { margin: '0 0 .8rem' }` de photo-plat.js:77, qui ne gêne pas la colonne.) `tests/theme.js` reste vert sans changement : relire ses
  assertions T-1 (inventaire exact des `display:none`), T-2 (couleurs), T-11 (`56px`) et « survol » après la pose.

- [ ] **Step 7 : `src/i18n/en.js` et le filet.** Retirer la ligne 251 `"Ouvrir le lien": "Open the link",` (plus aucun site ne la lit : Step 5). Ajouter, avant le `};`
  final, sous les entrées de T2 (les entrées de T2 à T5 se suivent en fin de dictionnaire, chacune sous sa ligne de commentaire « Lot UI-1 … tâche N », dans
  l'ordre des tâches ; T1 pose les siennes en place, l. 4 et l. 232 — A-17) :

```js
  // Lot UI-1 « Carnet », tâche 3 : la fiche recette (spec experience-carnet § 5). « Corriger » garde « Fix » (H-14) ; « Ingrédients » et « Préparation »
  // gardent leurs entrées (une clé, une traduction).
  "Voir la page d’origine": "View the original page",
  "Portions, versions et autres gestes": "Servings, versions and more",
  "{n} portions · {d}": "{n} servings · {d}",
```

  Les filets de `tests/ajouter.js` (Step 2, point 5) portent ces trois clés ; `tests/creer-ia.js` (`sansEntree`) ne scanne ni recipe.js ni le bloc de
  components.js hors assistant : rien à y changer. `grep -rn "Ouvrir le lien" src/ tests/` → vide (les messages amendés au Step 2 compris) ; sinon un site a
  été oublié : le reprendre.

- [ ] **Step 8 : vert.** `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` : tout vert **sauf l'épingle** (`eq(results.length, …)`,
  forcément rouge tant qu'elle n'est pas relevée : Step 9), une seule erreur de console (le 404 de `/favicon.ico`, préexistant). Attendu : la mesure de la tête
  de T2 + **30** (les assertions du bloc T3 : 18 sur l'ordre, les largeurs, les onglets, les gestes et « Corriger », 4 sur les repères, 2 sur « Voir la page
  d’origine », 1 sur le sous-titre (R-UI-P2), 1 sur la photo, 3 sur la feuille mesurée dans des cadres (1100 avec photo, 375 avec photo, 1100 sans), 1 « aucun
  réseau » ; rév. 2) ; les amendements du Step 2 ne changent pas le compte. Si une AUTRE assertion existante rougit hors des
  amendements nommés au Step 2 : NEEDS_CONTEXT (une épingle que la spec § 7 n'a pas vue), jamais un contournement. `node --test tools/*.test.mjs` : 208/208
  inchangé (aucun fichier de `tools/` ni de `supabase/` touché) ; `node tools/generer-migrations.mjs --check` : 0.

- [ ] **Step 9 : épingle relevée, `sw.js`.** `tests/tests.js:250` : `eq(results.length, <obtenu − 1>, 'compte d’assertions : une assertion qui disparait est un rouge');`
  (règle N−1 : la valeur lue dans « obtenu » moins l'assertion du total elle-même). `sw.js:4` : `const VERSION = 'cuisine-os-v0.17.0-3';` (T1 `-1`, T2 `-2` ;
  si la tête porte un autre suffixe, +1 dessus — R-B-24 ; `SHELL` inchangé : aucun module neuf dans cette tâche, `icones.js` est celui de T1). Relancer la
  suite : `✅ N/N`, totaux consignés dans le rapport de tâche.

- [ ] **Step 10 : mutants de la tâche** (jamais en place : copie LÉGÈRE du worktree sous `/tmp/claude-501/…/scratchpad/`, `rsync -a --exclude .git --exclude
  .superpowers --exclude node_modules`, servie sur **8196** par `python3 -m http.server 8196 --bind 127.0.0.1` depuis la copie, `node <suite.cjs> 8196` ; chacun doit
  rougir ; le serveur de la copie est tué à la fin, jamais celui du port 8096) :
  « Corriger » hors de l'en-tête sur une fiche non vérifiée (`version.verification_state !== 'verified'` → `false` : spec § 7) · « Corriger » de tête aussi sur une
  fiche vérifiée (condition retirée) · `details` toujours ouvert (`open: true`) · `details` toujours fermé · `surLargeur` jamais abonné · `surLargeur` qui ne
  touche pas `autresGestes.open` · l'abonné jamais retiré (la fiche détachée reste abonnée : « se désabonne » rouge) · la bascule par `navigate(…)` au lieu
  d'`appliquerCorps` (« sans navigation » rouge : `location.hash`) · la bascule par `drawBody()` (« mêmes nœuds » rouge) · la section non choisie RETIRÉE du DOM
  au lieu de `hidden` (« Ingrédients reste dans le DOM » rouge) · le segmented jamais `hidden` en large · **`appliquerCorps` qui ne touche pas `onglets.hidden`
  au `change`** (rév. 3 : `surLargeur` repose `open` et les deux sections mais pas le segmented — par exemple une copie locale d'`appliquerCorps` sans la
  ligne `onglets.hidden = !etroit`, ou un drapeau `{ sansOnglets: true }` passé depuis `surLargeur` seulement → « change → large : segmented caché » rouge :
  tué par l'assertion de la l. « change → large » une fois l'accesseur `onglets()` posé ; avec le nœud CAPTURÉ de la rév. 2, ce mutant SURVIVAIT — c'est le
  Critical du vérificateur) · `state.onglet` remis à `'ingredients'` dans `drawBody`
  (« le choix est gardé » rouge) · `matchMedia` lu par `window.matchMedia` au lieu de `deps.matchMedia` (`mmL.requetes` vide : rouge) · `texteReperes` sur
  `state.servings` (« ?servings=8 … disent la version » rouge) · repères par `timeText` (« actif · total » rouge) · `dureeVersion` sans la garde `estCreationIA`
  · `dureeVersion` par `prep + cook` même quand `total_minutes` existe (« 1 h 20 » rouge) · `n >= 1` au lieu de `Number.isInteger` (`'4'` → « 4 portions » rouge)
  · `lienOrigine` qui exige `https:` (« fiche http » rouge) · `lienOrigine` en `a.btn` (classe `link` manquante : rouge) · `ouvrir('btn primary')` gardé dans
  `blocSignet` (« plus de « Ouvrir le lien » primaire » rouge) · « Commencer à cuisiner » laissé dans le `details` · l'Export déplacé dans le `details` (H-3 rouge)
  · `section(` au lieu de `sectionPlain(` pour « Original » (photo-plat :340 et sync-l4 :3476 rouges) · le style en ligne 320 px remis (`getAttribute('style')`
  rouge) · `.fiche-photo` non posée · l'ordre `etat, gestes, photo` dans `.fiche-tete` (« dans cet ordre » rouge) · `.card.sage` gardée sur le `details` ·
  **quatre mutants de `styles.css`** (rév. 2 ; rév. 4 : le quatrième ; tués par les trois mesures en cadre) : le bloc `@media (min-width: 760px) { .fiche-tete … }` retiré → à 1100
  `photoADroite` faux (la photo tombe en troisième position dans un `1fr 1fr` sans zones : rangée 2, colonne 1) ; `aspect-ratio: 4 / 3` retirée de
  `.photo-plat img` → `ratio` faux (rév. 3 : l'image RÉELLE chargée fait 640 × 400, 16:10 — sans la feuille la boîte suit l'image ; un JPEG 4:3 chargé
  l'aurait masqué, d'où le choix de 640 × 400) ; `:has(> .fiche-photo:empty)` retirée → `vide1100.pistesTete` 2 (une colonne vide réservée : reste tué) ;
  **la zone `photo` retirée de la règle `:has`** (rév. 4, point 1 : la forme de la rév. 3, `grid-template-areas: "etat" "gestes"` seules) → `vide1100.pistesTete` 3
  et `photoADroite` vrai (l'enfant vide `grid-area: photo` sans zone nommée prend une piste IMPLICITE à droite : mesure Chromium « 1068px 0px 0px ») — tué par
  `vide1100.pistesTete` [**amendé par la vague finale (R-UI-57)** : depuis R-UI-16 (`display: contents` sur l'emplacement vide), ce mutant SURVIVAIT — la
  zone était morte ; elle est retirée de la règle (`"etat" "gestes"`), le mutant n'a plus d'objet, et le tueur de l'enfant vide est « `display: contents`
  retiré » (`vide1100.pistesTete` 3, rouge)] ; **et un mutant du TEST (rév. 3, ruling 17 ; attendu réécrit rév. 4, point 2)** : `img.loading = 'eager'` retiré du test sur une copie (la
  mesure sans chargement forcé) → `chargee` faux à 1100 et 375, bilan ROUGE à la fin de la suite, jamais une suite figée (l'attente de `decode()` est bornée à 3 s PAR
  mesure avec image par `Promise.race` : deux mesures, ≈ 6 s d'attente au plus, 3 003 ms chacune mesurées par le vérificateur de la rév. 4) : il prouve que la mesure charge bien une image réelle et ne dépend pas d'une boîte de remplacement (joué une fois, consigné).
- [ ] **Step 11 : invisibles** (Python `-I`, jamais `grep`) sur les fichiers touchés — `src/ui/recipe.js`, `src/ui/components.js`, `src/ui/import-web.js`,
  `src/ui/photo-plat.js`, `styles.css`, `src/i18n/en.js`, `sw.js`, `tests/carnet.js`, `tests/photo-plat.js`, `tests/sync-l4.js`, `tests/creer-ia.js`,
  `tests/lecture-web.js`, `tests/ajouter.js`, `tests/tests.js` : 0 (U+200B-200F, U+2028/2029, U+202A-202E, U+2060-2064, U+2066-2069, U+FEFF ; la flèche
  « ↗ » U+2197 de `styles.css` et les « · », « — », « ’ » sont des caractères visibles).
- [ ] **Step 12 : commit** (par chemins nommés, jamais `-A` ; message ASCII sans accents) :
  `Fiche recette : en-tete en deux colonnes (reperes, Voir la page d origine, Commencer a cuisiner + Corriger), autres gestes replies, Ingredients / Preparation en colonnes ou en onglets, sections plain (lot UI-1, tache 3)`
  avec le trailer `Co-Authored-By: <modele reel de l'implementeur> <noreply@anthropic.com>` et la ligne de session du brief. Ne pas pousser.

---

### Task 4 : La fiche livre — menus renommés en tête, deux colonnes, « Sommaire », liste compacte des recettes

Spec § 4.3 et D-UI-7 (composition), D-UI-8 (sections `plain` : « Les recettes de ce livre », « Sommaire », « Pages et fichiers sources »), D-UI-10
(« Ajouter des recettes », « Ajouter des pages de sommaire », « À importer » dans le filtre et le compteur), I-UI-4 (toute règle CSS neuve : jetons
seulement, aucun `display:none`, jamais 56 px, survol sous `@media (hover: hover)`), I-UI-5 (la vignette de la ligne compacte se décide AU RENDU, de
façon synchrone, sur la ligne `files` passée ; D-F9 tenu), § 5 (textes), § 7 UI-1 T4 (épingles), B-I-14, F-6, F-16, H-21. Aucun serveur, aucune
migration, `DB_VERSION` 4 inchangée. `sw.js` `cuisine-os-v0.17.0-4` (T1 `-1`, T2 `-2`, T3 `-3`, un commit chacun ; si la chaîne réelle diffère à la
tête de T3 — une ronde a compté —, le dernier suffixe servi +1, R-B-24).

**Files:**
- Modify: `src/ui/book.js` (à `f3672be` : l. 8 import de `./components.js` — `recipeCard` retiré, `sectionPlain` et `availabilityBadge` ajoutés ;
  imports neufs `typeAffichage`, `displayUrl` (`../sync/mime.js`), `pointeurValide` (`../domain/photo-web.js`) — aucun import d'`icones.js` : `emptyState` prend un NOM (T1, A-4) ;
  l. 30-33 `menuSource` inchangée ; deux constantes et une fonction exportées neuves `LIGNES_REPLIEES`, `LARGEUR_DEUX_COLONNES`, `ligneCompacte`
  avant `renderBook` ; l. 84-328 `renderBook` recomposée : `deps = {}` (`matchMedia`), `pageHeader` (sous-titre sans ISBN ni langue, `classeTitre`,
  menus renommés, l. 119-131), la rangée `.row.top` couverture + en-tête (l. 133-135) disparaît, `div.two-col.livre` à deux colonnes, les trois chips
  d'état (l. 159-164) disparaissent, `drawList` (l. 167-198) réécrite autour de `ligneCompacte` et de la borne de 8 lignes, « Sommaire » neuve, « Pages
  et fichiers sources » (l. 263-274) en `sectionPlain` et sans les pages d'index, le `details` « Métadonnées et convention » (l. 276-326) déplacé dans la
  colonne de gauche sans changer une ligne de son contenu)
- Modify: `styles.css` (cinq règles `.liste-compacte` après `.list.plain li { border: 0; padding: .25rem 0; }`, l. 248 à `f3672be` ; `.two-col.livre`
  est posée par T1 aux DEUX bornes — `1fr` dans le bloc 760 px, `200px 1fr` sous 900 px — : le conditionnel (b) du Step 0 est attendu sans objet, A-5)
- Modify: `src/i18n/en.js` (l. 234-235 `"+ Pages d’index"`, `"+ Recette"` retirées ; neuf entrées neuves avant l'accolade finale `};`)
- Modify: `tests/ajouter.js` (l. 25 `CHAINES_NEUVES_AILLEURS['../src/ui/book.js']` : `'+ Pages d’index'`, `'+ Recette'` retirées, huit chaînes neuves
  ajoutées ; l. 844-846 textes des `summary` ; l. 3672-3674 la couverture dans la colonne de gauche)
- Modify: `tests/photo-plat.js` (l. 1296-1309 : une assertion de plus sur `ul.liste-compacte > li img.plat-vignette.petite`, libellé de l. 1309)
- Modify: `tests/sync-l4.js` (l. 3580 : `section.card` → `section.plain` pour « Pages et fichiers sources » ; l. 3585, 3595, 3606, 3810 relues, INCHANGÉES :
  « Couverture », « Fichiers », « Pages d'index » restent `.card`)
- Modify: `tests/table-matieres.js` (l. 1605-1608 et 1623 : la rangée d'une recette devient `ul.liste-compacte > li`, `matchMedia` injecté)
- Test (neuf, dans `tests/carnet.js` créé par T1) : un bloc `{ … }` « Tâche 4 — la fiche livre » (six `await bloc(…)`) AU-DESSUS du repère de fin de
  `runCarnetTests`, après le bloc de T3 ; ses aides portent le suffixe `4` (`DATE4`, `H4`, `ctx4`, `lignes4`…) et vivent dans le bloc : aucune
  collision avec les aides de T1 à T3
- Relu, inchangé : `tests/import-cible.js:1482-1486` (« Importer » ×2 vers `/recipes/<id>/importer`, « Saisir à la main » ×3, hors de tout `<a>` : la ligne
  compacte garde les mêmes `href` et le même compte ; l'assertion reste verte telle quelle), `tests/ajouter.js:850, 872` (« Reprendre » : « Reprendre la
  séance » a un autre `textContent`), `tests/couverture.js:488, 523` (le bouton « Supprimer » du `details` déplacé), `tests/import-cible.js:2209-2210, 2779`
  (« {n} import(s) à reprendre »)
- Modify: `tests/tests.js` (l. 250, épingle relevée, règle N−1), `sw.js` (l. 4 `VERSION`)

**Interfaces:**
- Consumes : T1 — `sectionPlain(title, ...children)` → `section.plain` (classe `plain`, `h2` serif, filet `--line`) ; `pageHeader(title, { subtitle, actions,
  back, classeTitre })` (`classeTitre: 'titre-fiche'` → `h1.titre-fiche`) ; `emptyState('livre-ouvert', …)` (un NOM d'icône : `emptyState` appelle
  `icone()` elle-même et lève sur autre chose — jamais `emptyState(icone(…), …)`, A-4) ; `.two-col.livre` (`1fr` dans le bloc `@media (min-width: 760px)`,
  `200px 1fr` sous `@media (min-width: 900px)`) ; le retour `back: { href: '/library', label: t('Bibliothèque') }` et l'entrée `en.js` `'Bibliothèque': 'Library'`
  déjà posés par T1 (book.js:121) ; `tests/carnet.js` (`runCarnetTests({ eq, ok })`, son lanceur `bloc(nom, f)` qui attrape et nomme une levée). T2 —
  `.plat-vignette.petite` (48 × 48, `styles.css`), les entrées `en.js` `'Toutes': 'All'` et `'À importer': 'To import'` (§ 5 ; le filtre de la fiche les
  réemploie : aucune des deux n'est redoublée ici, A-7). Existant : `availabilityBadge(recipe)` → `span.badge.(available|reference|partial)` (ses textes courts arrivent avec T5, D-UI-10 :
  cette tâche ne les épingle pas) ; `bookCover(edition, book, { fichier })` → `a.cover-wrap` ; `renderZoneCouverture`, `vignettesDePages(pages, ctxF)` →
  `{ places: Map(page.id → div.vignette-page), distantes: sha256[], telecharger }`, `boutonTelechargerPages(distantes, { connecte, telecharger })`,
  `contexteFichiers(ctx)`, `remplacerEnRevoquant(conteneur, ...noeuds)` (relève `img.plat-vignette`, `.petite` comprise), `emptyState(icon, text)` ;
  `typeAffichage(fileRow)` / `displayUrl(fileRow, creerUrl)` (`src/sync/mime.js`), `pointeurValide(fiche)` (`src/domain/photo-web.js`), `urlDeBlob`
  (`src/core/blob-urls.js`), `repo.getFiles(sha256s)` → `Map` ; `sectionLisible(section)` (`src/domain/llm.js`) ; `seancesOuvertes(ctx, editionId)` ;
  `el()` pose `hidden` par attribut ; `window.matchMedia` jamais nu (appel sans `this`) : `(q) => window.matchMedia(q)` (le motif de T3).
- Produces (signatures exactes, `src/ui/book.js`) :

```js
export const LIGNES_REPLIEES = 8;                       // sous 900 px : lignes montrées avant « Voir les {n} recettes »
export const LARGEUR_DEUX_COLONNES = '(min-width: 900px)'; // la requête du matchMedia injecté (la même borne que .two-col.livre)
export function ligneCompacte(r, { fichier = null } = {})  // → li.row.between[data-recette=<id>] (voir le DOM ci-dessous) ; décision synchrone sur `fichier`
export async function renderBook(params, query, ctx, deps = {})
  // deps.matchMedia : (query) => MediaQueryList-like { matches, addEventListener('change', f) } ; défaut (q) => window.matchMedia(q)
export const seancesOuvertes = (ctx, editionId) => …   // inchangée
export async function supprimerLivreVide(…)             // inchangée
```

- `en.js` (clés posées par cette tâche, réemployables par T5 et T6 : ne pas les redoubler) : `'Ajouter des recettes'`, `'Ajouter des pages de sommaire'`,
  `'Sommaire'`, `'Reprendre la séance'`, `'Les recettes de ce livre'`, `'{n} disponible(s) · {m} à importer'`, `'Voir les {n} recettes'`,
  `'Disponibles'` (au passage : antérieure, sans entrée jusqu'ici) ; `'À importer'` est RÉEMPLOYÉE (posée par T2), jamais redoublée (A-7).
- DOM produit par `renderBook` (épinglé par le bloc « T4 — fiche livre : en-tête… ») :

```text
div
├ header.stack > a.muted « ← Bibliothèque » ; .row.between.top > div > h1.titre-fiche + p.muted « {auteur} · {éditeur} · {année} » ; .row > details.menu-source ×2
│   (summary.btn.primary « Ajouter des pages de sommaire » > .row [Photographier, Choisir des photos ou un PDF] ; summary.btn.primary « Ajouter des recettes »
│    > .row [Photographier, Choisir des photos ou un PDF, a.btn « Saisir à la main » → #/recipes/new?edition=<id>])
├ div (renderAccueilLivre : section.card.accueil-livre seulement avec ?nouveau=1 ; vide sinon)
├ div.two-col.livre
│ ├ div.stack[data-role=colonne-livre] > a.cover-wrap (bookCover) ; section.card « Couverture » (zone inchangée) ; details.card « Métadonnées et convention »
│ │   (inchangé, Enregistrer / Réafficher / Supprimer compris) ; section.plain « Sommaire » (seulement avec une page kind 'index' ou une séance ouverte :
│ │   .row > a.btn.small « Reprendre la séance » → #/import?session=<id> ? ; « Télécharger les {n} pages » ? ; div.thumbs > figure (span.num « 1 »…,
│ │   div.vignette-page, figcaption « p. N · index »)) ; details > summary.btn « Ajouter des entrées d’index à la main » + panneau d'index (inchangé)
│ └ div[data-role=colonne-recettes] > div.row[data-role=imports-a-reprendre] ? ; div.card.flat.row.between « Séance en cours : {n} page(s) » + « Reprendre » ? ;
│     div.card.warn.stack (convention des tasses) ? ; section.plain « Les recettes de ce livre » > p.muted[data-role=compte-recettes] « {n} disponible(s) · {m} à importer » ;
│     .row > button.btn.small(.active) Toutes | Disponibles | À importer | Favoris + input[type=search] ; div[data-role=liste-recettes] > ul.liste-compacte > li…
│     + button.btn[data-role=voir-tout] « Voir les {n} recettes » (sous 900 px, > 8 lignes, pas encore déplié) | .empty (aucune ligne)
└ section.plain « Pages et fichiers sources » (seulement avec un document) > p.muted ; « Télécharger les {n} pages » ? ; div.thumbs (pages kind ≠ 'index', sans
    numéro) ; div.row.between.card.flat par document non-photo (inchangé)

li.row.between[data-recette=<id>]
├ div.row.top[style flex:1;min-width:0] > img.plat-vignette.petite[alt=""][loading=lazy][src=blob:] ? ; div[style flex:1;min-width:0] > a.titre[href=#/recipes/<id>] ;
│   div.row > span.muted « p. N » ? ; span.chip.neutral[data-role=section] ? (référence SANS adresse seulement : la règle d'avant)
└ div.row[data-role=etat-recette] > availabilityBadge(r) ; a.btn.small « Importer » → #/recipes/<id>/importer ? ; a.btn.small « Saisir à la main » →
    #/recipes/<id>/edit?kind=extraction ? (les deux : reference_only ou partial SANS source_url) ; span.badge « ★ Favori » ?
```

- [ ] **Step 0 : relire la tête de T3.** `python3 -I - <<'PY'` qui imprime, pour `src/ui/book.js`, les lignes de `import`, `menuSource`, `pageHeader(`,
  `drawList`, `section(t(`, `emptyState(` ; pour `styles.css`, toute règle qui nomme `.two-col.livre`, `.plat-vignette.petite`, `.liste-compacte` ; pour
  `src/ui/components.js`, les signatures de `sectionPlain` et `pageHeader` ; pour `src/i18n/en.js`, les lignes `"+ Pages d’index"`, `"+ Recette"`,
  `'Toutes'`, `'Bibliothèque'` ; pour `sw.js`, la ligne `VERSION`. Attendu à la tête de T3 : book.js:121 porte déjà `label: t('Bibliothèque')` (T1) ;
  `sectionPlain` existe et rend `section.plain` ; `pageHeader` accepte `classeTitre` ; `.plat-vignette.petite` (48 px, T2) et `.two-col.livre` (`1fr` à 760 px,
  `200px 1fr` à 900 px, T1) existent ; `.liste-compacte` n'existe pas ; `en.js` porte `'Toutes': 'All'` et `'Bibliothèque': 'Library'`. **Deux conditionnels, décidés
  par cette lecture** : (a) book.js:176 porte `emptyState('livre-ouvert', …)` depuis T1 (un NOM : `emptyState` appelle `icone()` ; `emptyState(icone(…), …)` lèverait) —
  attendu ; s'il portait encore l'émoji, cette tâche écrit `emptyState('livre-ouvert', …)` (A-4) ; (b) `styles.css` porte `.two-col.livre { grid-template-columns:
  1fr; }` DANS le bloc `@media (min-width: 760px)` et `200px 1fr` sous `@media (min-width: 900px)` (T1, Step 4.8) — attendu ; si la règle à 760 px manquait,
  l'ajouter dans ce bloc (sans elle, la plage 760-899 prend le `1fr 1fr` de `.two-col` ; A-5). Tout autre écart est un amendement nommé dans `progress.md`, pas un constat.

- [ ] **Step 1 : tests rouges — `tests/carnet.js`** (bloc « Tâche 4 », AU-DESSUS du repère de fin de `runCarnetTests`, après le bloc de T3 ; `bloc`, `eq`,
  `ok` sont ceux du fichier) :

```js
    // ===== Tâche 4 — la fiche livre (spec § 4.3, D-UI-7, D-UI-8, D-UI-10, I-UI-5 ; § 7 UI-1 T4). Un bloc : ses aides ne sortent pas d'ici.
    {
      const { withRepo } = await import('./sync-fixture.js');
      const { sha256Hex } = await import('../src/core/hash.js');
      const DATE4 = '2026-10-23T00:00:00.000Z';
      const H4 = (c) => c.repeat(64);
      // Un JPEG réel (OffscreenCanvas) : la vignette ne se décide que sur des octets d'un type d'image (I-UI-5).
      const jpegDe = async (couleur) => { const toile = new OffscreenCanvas(32, 24); const cx = toile.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, 32, 24); return toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
      // Un matchMedia factice : `matches` lisible, écouteurs de `change` tenus, `basculer(v)` les appelle ; la requête reçue est gardée (`requete`).
      const mediaFactice = (matches) => {
        const mq = { matches, requete: null, ecouteurs: [], addEventListener(type, fn) { if (type === 'change') this.ecouteurs.push(fn); }, removeEventListener(type, fn) { this.ecouteurs = this.ecouteurs.filter((f) => f !== fn); }, basculer(v) { this.matches = v; for (const f of [...this.ecouteurs]) f({ matches: v }); } };
        const media = (q) => { mq.requete = q; return mq; }; media.mq = mq; return media;
      };
      const LIVRE4 = { id: 'b4', title: 'Saisons gourmandes', author: 'A. Cuisinière', cuisines: [], tags: [], created_at: DATE4, updated_at: DATE4 };
      const EDITION4 = { id: 'ed4', book_id: 'b4', isbn: '9782890772816', publisher: 'Flammarion Québec', year: 2004, language: 'fr', owned: true, cover_sha256: null, unit_convention_id: null, convention_evidence: null, created_at: DATE4, updated_at: DATE4 };
      // Une fiche disponible (ou partielle) a une version courante — I-UI-1 : « Disponible » seulement après enregistrement ; une fixture impossible en base masquerait un
      // défaut si une tâche lisait doc.version sur la ligne (rév. 2) ; une référence n'en a pas (current_version_id null, sauf override explicite).
      const recette4 = (id, over = {}) => { const r = { id, edition_id: 'ed4', original_title: 'Recette ' + id, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_url: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE4, updated_at: DATE4, ...over }; if (r.availability === 'reference_only' && !('current_version_id' in over)) r.current_version_id = null; return r; };
      const version4 = (rid) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, total_minutes: null, ingredients: [], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }], provenance: { generated_by: 'manual' }, verification_state: 'verified', created_at: DATE4, updated_at: DATE4 });
      const versions4 = (rs) => rs.filter((r) => r.availability !== 'reference_only').map((r) => version4(r.id)); // une version par fiche non référence
      // Le contexte d'une fiche livre (le motif de tests/sync-l4.js:3574), relu de la base jetable ; `over` complète ou remplace.
      const ctx4 = async (db, over = {}) => {
        const [recipes, recipe_versions, source_pages, source_documents, scan_sessions, imports] = await Promise.all(['recipes', 'recipe_versions', 'source_pages', 'source_documents', 'scan_sessions', 'imports'].map((s) => db.getAll(s)));
        return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions, source_pages, source_documents, scan_sessions, imports, rediscovery_prefs: [], book_editions: [EDITION4], books: [LIVRE4],
          editionsById: new Map([['ed4', EDITION4]]), booksById: new Map([['b4', LIVRE4]]), docsByRecipe: new Map(), settings: {}, sync: {}, editionLabel: () => LIVRE4.title, ...over };
      };
      const sectionDe = (racine, titre) => [...racine.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === titre) ?? null;
      const lignes4 = (racine) => [...racine.querySelectorAll('ul.liste-compacte > li')];
      const titres4 = (racine) => lignes4(racine).map((li) => li.querySelector('a.titre')?.textContent);
      const bouton4 = (racine, texte) => [...racine.querySelectorAll('button')].find((b) => b.textContent === texte) ?? null;

      await bloc('T4 — fiche livre : en-tête, menus renommés, deux colonnes, « Sommaire », « Pages et fichiers sources » (D-UI-7, D-UI-8)', () => withRepo(async (repo, db) => {
        const { renderBook } = await import('../src/ui/book.js');
        const doc = { id: 'doc4', edition_id: 'ed4', source_type: 'photo', sha256: H4('a'), original_filename: 'a.jpg', created_at: DATE4, updated_at: DATE4 };
        const pages = [
          { id: 'pg3', edition_id: 'ed4', document_id: 'doc4', sha256: H4('3'), printed_page: 3, kind: 'index', created_at: DATE4, updated_at: DATE4 },
          { id: 'pg2', edition_id: 'ed4', document_id: 'doc4', sha256: H4('2'), printed_page: 2, kind: 'index', created_at: DATE4, updated_at: DATE4 },
          { id: 'pg10', edition_id: 'ed4', document_id: 'doc4', sha256: H4('5'), printed_page: 10, kind: 'recette', created_at: DATE4, updated_at: DATE4 },
        ];
        const r1 = recette4('r1', { printed_page: 10 });
        await db.mutate({ puts: { books: [LIVRE4], book_editions: [EDITION4], source_documents: [doc], source_pages: pages, recipes: [r1], recipe_versions: versions4([r1]) }, origin: 'device' });
        const fiche = await renderBook({ id: 'ed4' }, {}, await ctx4(db), { matchMedia: mediaFactice(true) });
        // En-tête : titre de fiche, sous-titre dérivé SANS l'ISBN ni la langue (ils restent dans le details), retour « Bibliothèque », deux menus renommés.
        const h1 = fiche.querySelector('header h1');
        const menus = [...fiche.querySelectorAll('header details.menu-source')];
        eq([h1?.textContent, h1?.classList.contains('titre-fiche'), fiche.querySelector('header p.muted')?.textContent, fiche.querySelector('header a.muted')?.getAttribute('href'), fiche.querySelector('header a.muted')?.textContent],
          ['Saisons gourmandes', true, 'A. Cuisinière · Flammarion Québec · 2004', '#/library', '← Bibliothèque'],
          'T4 : h1.titre-fiche = le titre du livre ; sous-titre « {auteur} · {éditeur} · {année} », sans ISBN ni langue (H-21) ; retour « ← Bibliothèque » → #/library');
        eq(menus.map((d) => [d.querySelector('summary')?.textContent, d.querySelector('summary')?.className, [...d.querySelectorAll('button, a')].map((b) => b.textContent)]),
          [['Ajouter des pages de sommaire', 'btn primary', ['Photographier', 'Choisir des photos ou un PDF']], ['Ajouter des recettes', 'btn primary', ['Photographier', 'Choisir des photos ou un PDF', 'Saisir à la main']]],
          'T4 : les deux details.menu-source gardent leur forme (summary.btn.primary, mêmes sources) et sont renommés « Ajouter des pages de sommaire », « Ajouter des recettes » (D-UI-10)');
        eq([fiche.querySelectorAll('.status.ok, .status.warn, .status.info').length, fiche.querySelector('.row.top > header')], [0, null],
          'T4 : les trois chips d’état (« disponible(s) », « repérée(s) », « page(s) source ») ont disparu ; l’en-tête n’est plus dans une rangée avec la couverture (D-UI-7)');
        // Deux colonnes : gauche = couverture, « Couverture » (.card), métadonnées (details.card), « Sommaire » (.plain), le details des entrées d'index ; droite = « Les recettes de ce livre » (.plain).
        const colonnes = fiche.querySelector('.two-col.livre');
        const [gauche, droite] = [...(colonnes?.children || [])];
        const forme = (n) => n.tagName + ':' + [...n.classList].filter((c) => ['card', 'plain', 'cover-wrap'].includes(c)).join('.');
        eq([colonnes?.parentElement === fiche, colonnes?.children.length, [...(gauche?.children || [])].map(forme), [...(gauche?.children || [])].map((n) => n.querySelector(':scope > h2, :scope > summary > strong')?.textContent ?? null)],
          [true, 2, ['A:cover-wrap', 'SECTION:card', 'DETAILS:card', 'SECTION:plain', 'DETAILS:'], [null, 'Couverture', 'Métadonnées et convention', 'Sommaire', null]],
          'T4 : div.two-col.livre, enfant direct de la fiche, deux colonnes ; gauche = bookCover, « Couverture » (.card), « Métadonnées et convention » (details.card), « Sommaire » (section.plain), le details des entrées d’index');
        const sources = sectionDe(fiche, 'Pages et fichiers sources');
        eq([[...(droite?.querySelectorAll('section') || [])].map((s) => [forme(s), s.querySelector('h2')?.textContent]), forme(sources), sources?.parentElement === fiche, sources?.previousElementSibling === colonnes],
          [[['SECTION:plain', 'Les recettes de ce livre']], 'SECTION:plain', true, true],
          'T4 : droite = « Les recettes de ce livre » en section.plain ; « Pages et fichiers sources » en section.plain, en bas, juste après les deux colonnes');
        // Sommaire : les pages kind === 'index' seulement, dans l'ordre des pages imprimées, numérotées ; la page de recette reste dans « Pages et fichiers sources », sans numéro.
        const sommaire = sectionDe(fiche, 'Sommaire');
        const figures = (s) => [...(s?.querySelectorAll('.thumbs figure') || [])].map((f) => [f.querySelector('.num')?.textContent ?? null, f.querySelector('figcaption')?.textContent, !!f.querySelector('.vignette-page')]);
        eq([figures(sommaire), figures(sources), sommaire?.textContent.includes('Reprendre la séance')],
          [[['1', 'p. 2 · index', true], ['2', 'p. 3 · index', true]], [[null, 'p. 10 · recette', true]], false],
          'T4 : « Sommaire » = les pages d’index (p. 2 puis p. 3, numérotées 1 et 2, chacune par vignettesDePages) ; « Pages et fichiers sources » garde la page de recette, sans numéro ; sans séance ouverte, pas de « Reprendre la séance »');
        // Sans page d'index ni séance ouverte : pas de « Sommaire » ; avec une séance ouverte : « Sommaire » porte « Reprendre la séance » (vers la séance de CE livre) ; le rappel de droite reste.
        await db.mutate({ deletes: { source_pages: ['pg3', 'pg2'] }, origin: 'device' });
        const sans = await renderBook({ id: 'ed4' }, {}, await ctx4(db), { matchMedia: mediaFactice(true) });
        await db.mutate({ puts: { scan_sessions: [{ id: 'ss4', status: 'open', edition_id: 'ed4', started_at: DATE4, page_ids: ['pg10'], document_ids: [], created_at: DATE4, updated_at: DATE4 }] }, origin: 'device' });
        const avecSeance = await renderBook({ id: 'ed4' }, {}, await ctx4(db), { matchMedia: mediaFactice(true) });
        const reprise = [...avecSeance.querySelectorAll('a')].find((a) => a.textContent === 'Reprendre la séance');
        eq([sectionDe(sans, 'Sommaire'), !!sectionDe(avecSeance, 'Sommaire'), reprise?.getAttribute('href'), reprise?.className, reprise?.closest('section')?.querySelector('h2')?.textContent, [...avecSeance.querySelectorAll('a')].filter((a) => a.textContent === 'Reprendre').map((a) => a.getAttribute('href'))],
          [null, true, '#/import?session=ss4', 'btn small', 'Sommaire', ['#/import?session=ss4']],
          'T4 : sans page d’index ni séance, pas de « Sommaire » ; une séance ouverte le fait paraître avec a.btn.small « Reprendre la séance » → #/import?session=<id> ; le rappel « Reprendre » de la colonne de droite reste');
        // ?nouveau=1 : l'accueil d'un livre reste, entre l'en-tête et les colonnes (renderAccueilLivre inchangé) ; le sous-titre ne dit que ce qui est connu.
        const nouvelle = await renderBook({ id: 'ed4' }, { nouveau: '1' }, await ctx4(db), { matchMedia: mediaFactice(true) });
        const accueil = nouvelle.querySelector('.accueil-livre');
        const sansEditeur = await renderBook({ id: 'ed4' }, {}, await ctx4(db, { editionsById: new Map([['ed4', { ...EDITION4, publisher: null, year: null }]]) }), { matchMedia: mediaFactice(true) });
        eq([!!accueil, accueil?.parentElement?.previousElementSibling?.tagName, accueil?.parentElement?.nextElementSibling?.classList.contains('livre'), sansEditeur.querySelector('header p.muted')?.textContent],
          [true, 'HEADER', true, 'A. Cuisinière'],
          'T4 : ?nouveau=1 → le panneau d’accueil entre l’en-tête et les deux colonnes (inchangé) ; sans éditeur ni année, le sous-titre ne porte que l’auteur (rien d’inventé)');
      }));

      await bloc('T4 — liste compacte : vignette 48 px sur octets (synchrone), titre, « p. N », section, badge, « Importer » / « Saisir à la main », favori, compteur, filtres', () => withRepo(async (repo, db) => {
        const B = await import('../src/ui/book.js');
        const K = await import('../src/ui/components.js');
        const BU = await import('../src/core/blob-urls.js');
        const jpeg = await jpegDe('#c63'); const sha = await sha256Hex(jpeg);
        await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
        await db.mutate({ puts: { files: [{ sha256: H4('1'), mime: 'text/html', blob: new Blob(['<p>x</p>'], { type: 'text/html' }), size: 8, syncable: false, created_at: DATE4, updated_at: DATE4 }] }, origin: 'device' });
        const recettes = [
          recette4('rA', { original_title: 'Tarte aux pommes', printed_page: 40, photo_sha256: sha, photo_origin: 'photo' }), // disponible, octets JPEG ici → vignette
          recette4('rB', { original_title: 'Bouillon', printed_page: 12, photo_sha256: H4('1'), favorite: true }), // disponible, pointeur vers une ligne text/html → aucune image ; favori
          recette4('rC', { original_title: 'Compote', printed_page: 12, availability: 'reference_only', section: '  Desserts  ' }), // à importer : référence sans adresse, avec section
          recette4('rD', { original_title: 'Dahl', printed_page: 77, availability: 'partial' }), // partielle sans adresse : « Importer » aussi ; compte parmi les disponibles
          recette4('rE', { original_title: 'Escabèche', availability: 'reference_only', source_url: 'https://exemple.test/escabeche', section: 'Poissons' }), // signet rangé dans le livre : « Lien web », ni Importer ni « à importer »
          recette4('rF', { original_title: 'Fenouil rôti', printed_page: 55, photo_sha256: H4('9') }), // pointeur sans ligne files → aucune image
        ];
        await db.mutate({ puts: { books: [LIVRE4], book_editions: [EDITION4], recipes: recettes, recipe_versions: versions4(recettes) }, origin: 'device' });
        const fiche = await B.renderBook({ id: 'ed4' }, {}, await ctx4(db), { matchMedia: mediaFactice(true) });
        const liste = sectionDe(fiche, 'Les recettes de ce livre');
        eq([liste?.querySelector('h2 + p.muted')?.textContent, liste?.querySelector('h2 + p.muted')?.dataset.role, titres4(fiche)],
          ['4 disponible(s) · 1 à importer', 'compte-recettes', ['Bouillon', 'Compote', 'Tarte aux pommes', 'Fenouil rôti', 'Dahl', 'Escabèche']],
          'T4 : sous le titre, « {n} disponible(s) · {m} à importer » (disponibles = available + partial ; à importer = les références SANS adresse : le signet rangé ne compte pas) ; tri par page imprimée puis titre, sans page en dernier');
        const ligne = (titre) => lignes4(fiche).find((li) => li.querySelector('a.titre')?.textContent === titre);
        // Le portrait d'une ligne : classe, href du titre, vignette (présence, src blob:, alt), « p. N », sections, badge = availabilityBadge, gestes [texte, href], « ★ Favori ».
        const portrait = (titre) => { const li = ligne(titre); const r = recettes.find((x) => x.original_title === titre); const img = li?.querySelector('img');
          return [li?.className, li?.querySelector('a.titre')?.getAttribute('href'), !!li?.querySelector('img.plat-vignette.petite'), img ? img.getAttribute('src')?.startsWith('blob:') : null, img ? img.getAttribute('alt') : null,
            li?.querySelector('span.muted')?.textContent ?? null, [...(li?.querySelectorAll('.chip.neutral') || [])].map((c) => c.textContent), li?.querySelector('.badge')?.outerHTML === K.availabilityBadge(r).outerHTML,
            [...(li?.querySelectorAll('a.btn.small') || [])].map((a) => [a.textContent, a.getAttribute('href')]), [...(li?.querySelectorAll('.badge') || [])].map((b) => b.textContent).includes('★ Favori')]; };
        eq(portrait('Tarte aux pommes'), ['row between', '#/recipes/rA', true, true, '', 'p. 40', [], true, [], false],
          'T4 (I-UI-5, D-F9) : octets JPEG ici → img.plat-vignette.petite, src blob:, alt vide, DÈS le rendu (décision synchrone sur la ligne files) ; « p. 40 » ; le badge est celui d’availabilityBadge ; aucun geste');
        eq([portrait('Bouillon'), portrait('Fenouil rôti')], [['row between', '#/recipes/rB', false, null, null, 'p. 12', [], true, [], true], ['row between', '#/recipes/rF', false, null, null, 'p. 55', [], true, [], false]],
          'T4 (I-UI-5) : une ligne files text/html, ou un pointeur sans ligne → AUCUNE image (ni cadre vide) ; « ★ Favori » sur la ligne du favori');
        eq([portrait('Compote'), portrait('Dahl')],
          [['row between', '#/recipes/rC', false, null, null, 'p. 12', ['Desserts'], true, [['Importer', '#/recipes/rC/importer'], ['Saisir à la main', '#/recipes/rC/edit?kind=extraction']], false],
            ['row between', '#/recipes/rD', false, null, null, 'p. 77', [], true, [['Importer', '#/recipes/rD/importer'], ['Saisir à la main', '#/recipes/rD/edit?kind=extraction']], false]],
          'T4 : référence sans adresse → section rognée en .chip.neutral, « Importer » et « Saisir à la main » (mêmes href qu’au lot A, T4-R1) ; partielle sans adresse → les deux gestes aussi, sans section (reference_only seulement)');
        eq([portrait('Escabèche'), fiche.querySelectorAll('a.titre .chip, a.titre .badge, a .btn, a [data-role="section"]').length],
          [['row between', '#/recipes/rE', false, null, null, null, [], true, [], false], 0],
          'T4 : un signet rangé dans le livre → badge « Lien web » (availabilityBadge), ni « Importer » ni « Saisir à la main », pas de « p. » ; aucun chip, badge ou bouton dans un <a>');
        // Filtres : chaque bouton redessine la liste ; le filtre actif est marqué ; « À importer » ne retient que les références sans adresse.
        const clic = (texte) => { bouton4(liste, texte).click(); return titres4(fiche); };
        eq([clic('À importer'), clic('Disponibles'), clic('Favoris'), clic('Toutes'), [...liste.querySelectorAll('button.btn.small.active')].map((b) => b.textContent)],
          [['Compote'], ['Bouillon', 'Tarte aux pommes', 'Fenouil rôti', 'Dahl'], ['Bouillon'], ['Bouillon', 'Compote', 'Tarte aux pommes', 'Fenouil rôti', 'Dahl', 'Escabèche'], ['Toutes']],
          'T4 : filtres Toutes / Disponibles / À importer / Favoris — « À importer » = les références sans adresse seules (le signet reste sous Toutes), « Disponibles » compte la partielle ; le filtre actif est marqué');
        const champ = liste.querySelector('input[type="search"]');
        champ.value = 'ta'; champ.dispatchEvent(new Event('input', { bubbles: true }));
        eq(titres4(fiche), ['Tarte aux pommes'], 'T4 : le champ filtre les titres (« ta » → Tarte aux pommes seule)');
        champ.value = 'zzz'; champ.dispatchEvent(new Event('input', { bubbles: true }));
        eq([lignes4(fiche).length, !!liste.querySelector('.empty'), !!liste.querySelector('.empty .ico svg[aria-hidden="true"]'), liste.querySelector('.empty p')?.textContent],
          [0, true, true, 'Aucune recette dans cette vue. Photographie l’index ou une recette pour commencer.'],
          'T4 : aucune ligne → l’état vide d’avant, avec son icône au trait (D-UI-9, icone(\'livre-ouvert\'))');
        // ligneCompacte seule : la décision est prise sur la ligne files PASSÉE — octets ET type d'image —, jamais relue en base.
        const ligneDirecte = B.ligneCompacte(recette4('rX', { photo_sha256: sha }), { fichier: { sha256: sha, mime: 'image/jpeg', blob: jpeg } });
        const ligneSansBlob = B.ligneCompacte(recette4('rY', { photo_sha256: sha }), { fichier: { sha256: sha, mime: 'image/jpeg', remote: null } });
        const lignePdf = B.ligneCompacte(recette4('rW', { photo_sha256: sha }), { fichier: { sha256: sha, mime: 'application/pdf', blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) } });
        eq([ligneDirecte.querySelector('img.plat-vignette.petite')?.getAttribute('src')?.startsWith('blob:'), ligneDirecte.querySelector('img')?.getAttribute('loading'), ligneSansBlob.querySelector('img'), lignePdf.querySelector('img'), B.ligneCompacte(recette4('rZ')).querySelector('img')],
          [true, 'lazy', null, null, null],
          'ligneCompacte : octets d’un type d’image → img.plat-vignette.petite (loading lazy, src blob:) ; ligne sans blob, blob PDF (liste blanche, pas une image) ou fiche sans pointeur → aucune image');
        BU.revoquerUrlsDeBlob();
      }));

      await bloc('T4 — sous 900 px : 8 lignes puis « Voir les {n} recettes » (déplie sur place) ; ≥ 900 px : tout ; la bascule de largeur redessine', () => withRepo(async (repo, db) => {
        const { renderBook, LIGNES_REPLIEES, LARGEUR_DEUX_COLONNES } = await import('../src/ui/book.js');
        const recettes = Array.from({ length: 12 }, (_, i) => recette4('r' + String(i).padStart(2, '0'), { original_title: 'Plat ' + String(i).padStart(2, '0'), printed_page: i + 1, favorite: i < 10 }));
        await db.mutate({ puts: { books: [LIVRE4], book_editions: [EDITION4], recipes: recettes, recipe_versions: versions4(recettes) }, origin: 'device' });
        const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:375px'; document.body.append(scene);
        const hashAvant = location.hash;
        try {
          const media = mediaFactice(false);
          const etroite = await renderBook({ id: 'ed4' }, {}, await ctx4(db), { matchMedia: media });
          scene.append(etroite);
          const liste = sectionDe(etroite, 'Les recettes de ce livre');
          const voirTout = (racine = liste) => racine.querySelector('button[data-role="voir-tout"]');
          eq([LIGNES_REPLIEES, LARGEUR_DEUX_COLONNES, media.mq.requete, lignes4(etroite).length, voirTout()?.textContent, voirTout()?.tagName, voirTout()?.className, voirTout()?.getAttribute('href'), voirTout()?.previousElementSibling?.matches('ul.liste-compacte')],
          [8, '(min-width: 900px)', '(min-width: 900px)', 8, 'Voir les 12 recettes', 'BUTTON', 'btn', null, true],
            'T4 : sous 900 px (matchMedia injecté, requête (min-width: 900px)), 8 lignes puis button.btn « Voir les 12 recettes » juste sous la liste (un bouton, pas un lien)');
          voirTout().click();
          eq([lignes4(etroite).length, voirTout(), location.hash === hashAvant], [12, null, true], 'T4 : « Voir les {n} recettes » déplie sur place : 12 lignes, le bouton disparaît, aucune navigation');
          bouton4(liste, 'Favoris').click();
          eq([lignes4(etroite).length, voirTout()], [10, null], 'T4 : une fois dépliée, la liste reste dépliée quand le filtre change (10 favoris, pas de bouton)');
          // Une nouvelle instance est repliée de nouveau ; le compte du bouton est celui de la VUE filtrée ; la bascule de largeur (événement change) redessine.
          const media2 = mediaFactice(false);
          const seconde = await renderBook({ id: 'ed4' }, {}, await ctx4(db), { matchMedia: media2 });
          scene.append(seconde);
          const liste2 = sectionDe(seconde, 'Les recettes de ce livre');
          bouton4(liste2, 'Favoris').click();
          eq([lignes4(seconde).length, voirTout(liste2)?.textContent, media2.mq.ecouteurs.length], [8, 'Voir les 10 recettes', 1], 'T4 : nouvelle instance → repliée ; « Voir les 10 recettes » compte la vue filtrée ; un seul écouteur de change posé');
          media2.mq.basculer(true);
          eq([lignes4(seconde).length, voirTout(liste2)], [10, null], 'T4 : la bascule ≥ 900 px (change) redessine : les 10 lignes, sans bouton');
          media2.mq.basculer(false);
          eq([lignes4(seconde).length, voirTout(liste2)?.textContent], [8, 'Voir les 10 recettes'], 'T4 : la bascule inverse replie de nouveau (cette instance n’avait pas déplié)');
          const large = await renderBook({ id: 'ed4' }, {}, await ctx4(db), { matchMedia: mediaFactice(true) });
          const huit = await renderBook({ id: 'ed4' }, {}, await ctx4(db, { recipes: recettes.slice(0, 8), recipesById: new Map(recettes.slice(0, 8).map((r) => [r.id, r])) }), { matchMedia: mediaFactice(false) });
          eq([lignes4(large).length, voirTout(large), lignes4(huit).length, voirTout(huit)], [12, null, 8, null],
            'T4 : ≥ 900 px, les 12 lignes d’un coup, aucun bouton ; exactement 8 recettes sous 900 px → 8 lignes, aucun bouton (la borne est « plus de 8 »)');
        } finally { scene.remove(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
      }));

      await bloc('T4 — styles.css servie : deux colonnes 200px 1fr ≥ 900 px, une colonne sous ; titre de ligne en serif ; vignette 48 × 48 (cadres de mesure)', () => withRepo(async (repo, db) => {
        const { renderBook } = await import('../src/ui/book.js');
        const jpeg = await jpegDe('#36c'); const sha = await sha256Hex(jpeg);
        await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
        // Deux recettes : la première (photo, page 5) porte le filet du bas ; la dernière ligne n'en a pas (:last-child).
        const rGH = [recette4('rG', { original_title: 'Gratin dauphinois aux trois fromages et à la muscade', printed_page: 5, photo_sha256: sha }), recette4('rH', { original_title: 'Haricots', printed_page: 9 })];
        await db.mutate({ puts: { books: [LIVRE4], book_editions: [EDITION4], recipes: rGH, recipe_versions: versions4(rGH) }, origin: 'device' });
        // La VRAIE feuille, chargée DANS un <iframe> about:blank par largeur (la technique de T2 ; rév. 2) : les jetons de :root (var(--serif), var(--line)) s'y résolvent et
        // les @media suivent la largeur du CADRE — dans une racine fantôme, :root ne matche rien (tests/index.html ne charge que tests.css) et (min-width: 900px) suivrait la
        // fenêtre de 1280 px du lanceur, quelle que soit la largeur de l'hôte : serif faux, filet 0px, deux pistes à 375 et 800.
        const mesurer = async (largeur) => {
          const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'scène de mesure');
          f.style.cssText = `position:absolute;left:-12000px;top:0;width:${largeur}px;height:900px;border:0`;
          document.body.append(f);
          try {
            const d = f.contentDocument; const w = f.contentWindow;
            d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><main class="content"></main></body></html>'); d.close();
            const lien = d.createElement('link'); lien.rel = 'stylesheet'; lien.href = new URL('../styles.css?v=' + Date.now(), location.href).href;
            await new Promise((r) => { lien.onload = r; lien.onerror = r; d.head.append(lien); });
            if (w.innerWidth !== largeur) throw new Error(`cadre ${largeur} : innerWidth ${w.innerWidth}`);
            const fiche = await renderBook({ id: 'ed4' }, {}, await ctx4(db), { matchMedia: mediaFactice(largeur >= 900) });
            d.querySelector('main').append(fiche); // adopté par le document du cadre : SA feuille s'applique
            const S = (n) => w.getComputedStyle(n);
            const colonnes = fiche.querySelector('.two-col.livre');
            const [gauche, droite] = [...colonnes.children].map((n) => n.getBoundingClientRect());
            const titre = fiche.querySelector('a.titre'); const img = fiche.querySelector('img.plat-vignette.petite').getBoundingClientRect();
            const li = fiche.querySelector('ul.liste-compacte > li');
            return { gauche: Math.round(gauche.width), coteACote: droite.left >= gauche.right - 1 && Math.abs(droite.top - gauche.top) < 2, empilee: droite.top >= gauche.bottom - 1,
              serif: /georgia/i.test(S(titre).fontFamily), souligne: S(titre).textDecorationLine, vignette: [Math.round(img.width), Math.round(img.height)],
              grille: S(colonnes).gridTemplateColumns.trim().split(/\s+/).length, filet: S(li).borderBottomWidth, puce: S(fiche.querySelector('ul.liste-compacte')).listStyleType };
          } finally { f.remove(); }
        };
        const [l1100, l800, l375] = [await mesurer(1100), await mesurer(800), await mesurer(375)];
        eq([l1100.gauche, l1100.coteACote, l1100.grille, l1100.serif, l1100.souligne, l1100.vignette, l1100.filet, l1100.puce], [200, true, 2, true, 'none', [48, 48], '1px', 'none'],
          'T4 (styles.css, 1100 px) : colonne de gauche 200 px, droite à côté (.two-col.livre 200px 1fr) ; titre de ligne en Georgia, sans soulignement ; vignette 48 × 48 (.plat-vignette.petite, T2) ; filet de 1 px sous la ligne ; aucune puce de liste');
        eq([l800.empilee, l800.grille, l375.empilee, l375.grille, l375.vignette], [true, 1, true, 1, [48, 48]],
          'T4 (styles.css, 800 et 375 px) : une seule colonne, gauche puis droite (la fiche livre ne prend pas le 1fr 1fr de .two-col à 760 px) ; la vignette reste 48 × 48');
        (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
      }));

      await bloc('T4 — styles.css lue : les règles .liste-compacte (jetons seulement : T-1, T-2, T-11 ; survol sous @media (hover: hover))', async () => {
        const css = (await (await fetch(new URL('../styles.css', import.meta.url), { cache: 'no-store' })).text()).replace(/\/\*[\s\S]*?\*\//g, '');
        const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]).filter(([s]) => s.includes('.liste-compacte'));
        const decl = (sel) => regles.find(([s]) => s === sel)?.[1] ?? '';
        eq(regles.map(([s]) => s), ['.liste-compacte', '.liste-compacte > li', '.liste-compacte > li:last-child', '.liste-compacte .titre', '.liste-compacte .titre:hover'], 'styles.css : les cinq règles .liste-compacte, dans cet ordre, et aucune autre');
        ok(/list-style:\s*none/.test(decl('.liste-compacte')) && /border-bottom:\s*1px solid var\(--line\)/.test(decl('.liste-compacte > li')) && /border-bottom:\s*0/.test(decl('.liste-compacte > li:last-child')) && /font-family:\s*var\(--serif\)/.test(decl('.liste-compacte .titre')) && /color:\s*var\(--ink\)/.test(decl('.liste-compacte .titre')) && /text-decoration:\s*none/.test(decl('.liste-compacte .titre')),
          'styles.css : filets fins --line entre les lignes, titre en --serif / --ink sans soulignement (jetons seulement)');
        const survol = [...css.matchAll(/@media\s*\(hover:\s*hover\)\s*\{\s*([^{}]+)\{/g)].map((m) => m[1].trim());
        ok(survol.includes('.liste-compacte .titre:hover') && !/(?:^|\})\s*\.liste-compacte \.titre:hover\s*\{/.test(css), 'styles.css : le survol du titre vit sous @media (hover: hover) seulement (I-UI-4, R-VIS-12)');
        ok(regles.every(([, d]) => !/display\s*:\s*none|#[0-9a-f]{3,8}\b|\b56px\b|olive/i.test(d)), 'styles.css : ni display:none, ni couleur en dur, ni 56px, ni « olive » dans ces règles (T-1, T-2, T-11)');
      });

      await bloc('T4 — filets : chaînes retirées et neuves (book.js, en.js, CHAINES_NEUVES_AILLEURS), sections plain par sectionPlain, recipeCard parti', async () => {
        const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
        const src = await lire('../src/ui/book.js');
        const { EN } = await import('../src/i18n/en.js');
        const { CHAINES_NEUVES_AILLEURS } = await import('./ajouter.js');
        ok(src.length > 3000 && /export async function renderBook\(params, query, ctx, deps = \{\}\)/.test(src), `book.js : le source est lu (${src.length} caractères) et renderBook prend deps`);
        const NEUVES = ['Ajouter des recettes', 'Ajouter des pages de sommaire', 'Sommaire', 'Reprendre la séance', 'Les recettes de ce livre', '{n} disponible(s) · {m} à importer', 'À importer', 'Voir les {n} recettes'];
        const RETIREES = ['+ Recette', '+ Pages d’index', 'Repérées', '{n} recette(s) disponible(s)', '{n} repérée(s) dans l’index', '{n} page(s) source'];
        eq([NEUVES.filter((c) => !src.includes(`t('${c}'`)), RETIREES.filter((c) => src.includes(`'${c}'`))], [[], []], 'book.js : chaque chaîne neuve est posée par t(), aucune chaîne retirée ne subsiste');
        eq([NEUVES.map((c) => EN[c]), RETIREES.slice(0, 2).map((c) => c in EN), EN['Disponibles']],
          [['Add recipes', 'Add table-of-contents pages', 'Table of contents', 'Resume the session', 'The recipes in this book', '{n} available · {m} to import', 'To import', 'Show all {n} recipes'], [false, false], 'Available'],
          'en.js : les traductions de la spec § 5 (et « Reprendre la séance », « Disponibles » au passage) ; « + Recette » et « + Pages d’index » ont quitté le dictionnaire');
        const filet = CHAINES_NEUVES_AILLEURS['../src/ui/book.js'];
        eq([NEUVES.filter((c) => !filet.includes(c)), RETIREES.slice(0, 2).filter((c) => filet.includes(c))], [[], []], 'CHAINES_NEUVES_AILLEURS (book.js) : porte les chaînes neuves, plus « + Recette » ni « + Pages d’index »');
        // Un seul test de SOURCE ici, admis par exception (Global Constraints) : le défaut de deps.matchMedia n'est atteignable que dans l'app réelle (la suite injecte
        // toujours) — il garde le motif « jamais window.matchMedia nu » (Illegal invocation). Les sections plain, « Couverture » en .card et l'absence de recipeCard sont
        // tenues par COMPORTEMENT dans les blocs « fiche livre » (formes SECTION:plain / SECTION:card) et « liste compacte » (rév. 2 : les regex de source sur ces faits, vertes
        // sur une ligne commentée, sont retirées).
        eq([/\(q\) => window\.matchMedia\(q\)/.test(src), /[^.\w]window\.matchMedia\(LARGEUR_DEUX_COLONNES\)/.test(src)], [true, false],
          'book.js : le défaut de deps.matchMedia est la flèche (q) => window.matchMedia(q), jamais window.matchMedia(LARGEUR_DEUX_COLONNES) nu (appel sans this : « Illegal invocation » dans l’app)');
      });
    }
```

- [ ] **Step 2 : amendements des tests existants** (retrouvés par leur TEXTE ; chacun est un rouge attendu au Step 3 sur l'ancien `book.js`) :

  `tests/ajouter.js:844-846` (les trois `eq` qui suivent `const menus = [...fiche.querySelectorAll('details.menu-source')];`) :

```js
      eq(menus.map((d) => d.querySelector('summary').textContent), ['Ajouter des pages de sommaire', 'Ajouter des recettes'], 'fiche : deux gestes nommés en en-tête (§ 9 ; lot UI-1, D-UI-10 : le verbe avant l’outil)');
      eq([...menus[0].querySelectorAll('button, a')].map((b) => b.textContent), ['Photographier', 'Choisir des photos ou un PDF'], 'fiche : « Ajouter des pages de sommaire » dévoile les deux sources');
      eq([...menus[1].querySelectorAll('button, a')].map((b) => b.textContent), ['Photographier', 'Choisir des photos ou un PDF', 'Saisir à la main'], 'fiche : « Ajouter des recettes » offre aussi la saisie à la main');
```

  `tests/ajouter.js:3672-3674` (après `const ficheAvec = await renderBook({ id: 'eC' }, {}, ctx);`) : la rangée `.row.top` n'existe plus ; la couverture ouvre la
  colonne de gauche.

```js
      const gaucheLivre = ficheAvec.querySelector('.two-col.livre')?.firstElementChild;
      eq([!!gaucheLivre?.querySelector(':scope > a.cover-wrap img.cover-img'), !!blocCouverture(ficheAvec), blocCouverture(ficheAvec)?.querySelector('small')],
        [true, true, null], 'fiche : la couverture ouvre la colonne de gauche (lot UI-1, D-UI-7), le bloc « Couverture » est visible, et rien n’est signalé (§ 6)');
```

  `tests/ajouter.js:25-31` (`CHAINES_NEUVES_AILLEURS['../src/ui/book.js']`) : retirer `'+ Pages d’index', '+ Recette', ` de la l. 25 et ajouter, après la ligne
  `'Un import est encore lié à ce livre : rien n’a été supprimé.'` (l. 31, avant `],`) :

```js
    // Lot UI-1, tâche 4 : la fiche livre recomposée (D-UI-7, D-UI-10) — menus renommés, « Sommaire », la liste compacte et son compteur, « Voir les {n} recettes ».
    'Ajouter des recettes', 'Ajouter des pages de sommaire', 'Sommaire', 'Reprendre la séance', 'Les recettes de ce livre', '{n} disponible(s) · {m} à importer', 'À importer', 'Voir les {n} recettes'],
```

  (`'Disponibles'` et `'Toutes'` existaient mot pour mot sur `main` dans book.js : écartées de la liste malgré la ligne réécrite — règle de l'en-tête du fichier.)

  `tests/photo-plat.js:1298-1309` : après `await attendre(() => toutesPretes(rb, 2), 'chaque vignette du livre a son src');` insérer :

```js
          eq([rb.querySelectorAll('ul.liste-compacte > li img.plat-vignette.petite').length, rb.querySelectorAll('img.plat-vignette').length], [2, 2],
            'book.js (lot UI-1, T4) : les deux vignettes du livre sont des img.plat-vignette.petite, chacune dans une ligne de la liste compacte (D-F9 tenu)');
```

  et le libellé de l. 1309 devient `'book.js drawList (ligne compacte, lot UI-1 T4) : le filtre redessine et révoque EXACTEMENT les URL des vignettes précédentes, APRÈS le
  vidage ; la couverture et la sentinelle restent vivantes'`. (L'assertion compte dans l'épingle : +1.)

  `tests/sync-l4.js:3580` : `[...fiche.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Pages et fichiers sources')` →
  `[...fiche.querySelectorAll('section.plain')].find(…)` (même suite de la ligne). Les l. 3585 (« Couverture »), 3595 et 3810 (« Fichiers », séance) et 3606 (« Pages
  d’index », fiche recette) restent `section.card` : relues, inchangées.

  `tests/table-matieres.js:1605-1608` et `:1623` (T-C18) : la rangée d'une recette est sa ligne compacte ; `matchMedia` injecté (les neuf recettes de la fixture
  dépassent la borne de 8 lignes si la page de tests tourne sous 900 px, ce qui rendrait « sans rangée » pour la neuvième) :

```js
      const LARGE = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
      const fiche = await renderBook({ id: 'ed1' }, { nouveau: '1' }, ctx, LARGE);
      const rangee = (titre) => [...fiche.querySelectorAll('ul.liste-compacte > li')].find((li) => li.querySelector('a.titre')?.textContent === titre) ?? null;
      const puces = (titre) => { const r = rangee(titre); return r ? [...r.querySelectorAll('.chip.neutral')].map((c) => c.textContent) : 'sans rangée'; };
      eq([puces('Soupe de courge'), puces('Gaspacho'), fiche.querySelectorAll('a [data-role="section"]').length], [['Soupes'], [], 0], 'T-C18 (M55, M-livre-sans-trim ; lot UI-1 T4 : la ligne compacte) : une référence avec section → une puce .chip.neutral « Soupes » (rognée) dans SA ligne, jamais dans un lien ; sans section → aucune');
```

  et l. 1623 : `const ficheH = await renderBook({ id: 'ed1' }, { nouveau: '1' }, ctxH, LARGE);` (l. 1609-1610, 1626 inchangées : la partielle « Tian de courgettes » garde
  sa ligne « Importer » sans puce, la section hostile reste du texte).

- [ ] **Step 3 : rouge lu.** `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` (le worktree servi : `python3 -m http.server 8096 --bind 127.0.0.1`).
  Attendu : `❌` ; dans ECHECS, pour la BONNE raison — bloc « T4 — fiche livre » : `h1.titre-fiche` vrai mais sous-titre `'A. Cuisinière · Flammarion Québec · 2004 · ISBN 9782890772816 · FR'`,
  menus `['+ Pages d’index', '+ Recette']`, `.two-col.livre` absent (`colonnes?.parentElement === fiche` faux), puis le bloc s'arrête sur une levée NOMMÉE par
  son `bloc` (`forme(null)` : « Pages et fichiers sources » n'est pas encore `section.plain`) ; « liste compacte » : `sectionDe(fiche, 'Les recettes de ce livre')`
  nul → compteur `undefined`, `titres4` `[]` ; « 8 lignes » : `LIGNES_REPLIEES` `undefined` ; « styles.css servie » : le bloc rougit par son `bloc` (`fiche.querySelector('.two-col.livre')` nul
  → `TypeError`, nommé, dans le premier cadre) ; « styles.css lue » : `regles` `[]` ; « filets » : `renderBook(params, query, ctx)` sans `deps`, chaînes neuves absentes, `EN['Ajouter des recettes']` `undefined`,
  `CHAINES_NEUVES_AILLEURS` porte encore `'+ Recette'`, la flèche `(q) => window.matchMedia(q)` absente ; amendements : ajouter.js:844 (`['+ Pages d’index', '+ Recette']`), 3672 (`.two-col.livre` absent → `[false, true, null]`),
  photo-plat 1298 (`[0, 2]`), sync-l4:3580 (`section.plain` introuvable → `[[], false]`), T-C18 (`'sans rangée'`). Les autres suites restent vertes (le rouge est celui du
  changement attendu, jamais une levée hors des blocs nommés). `node --test tools/*.test.mjs` 208/208, `node tools/generer-migrations.mjs --check` 0 (rien côté outils).

- [ ] **Step 4 : implémenter `src/ui/book.js`.** Les imports (l. 2-20 à `f3672be`) deviennent :

```js
// Fiche d'un livre (édition possédée) : en-tête (titre, sous-titre, deux menus d'ajout), couverture et sommaire à gauche, les recettes à droite, pages sources en bas.
import { el, toast, pickFiles, confirmDialog, promptDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, refresh, remplacerAdresse } from '../core/router.js';
import * as repo from '../model/repo.js';
import { etatFichier } from '../sync/fichiers.js';
import { typeAffichage, displayUrl } from '../sync/mime.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, section, sectionPlain, field, select, availabilityBadge, emptyState, bookCover, contexteFichiers, vignettesDePages, boutonTelechargerPages, relireErreurs, texteErreurFichier, remplacerEnRevoquant } from './components.js';
import { invalidate } from './state.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { poserCouverture, renderZoneCouverture, messageErreurImage } from './livre-ajout.js';
import { startScanSession, indexEntriesPanel } from './import.js';
import { accueilLivreModel, renderAccueilLivre } from './accueil-livre.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes, motsClesExistants } from './puces.js';
import { tagsDe } from '../domain/search.js';
import { sectionLisible } from '../domain/llm.js';
import { seanceDUnImportCible, importOuvert } from '../domain/import-cible.js';
import { pointeurValide } from '../domain/photo-web.js';
import { ACCEPT_PHOTOS, ACCEPT_FICHIERS } from './add.js';
import { STATUTS_IMPORT } from '../model/schema.js';
import { TransitionRefusee } from '../core/db.js';
```

  (`recipeCard` quitte l'import : la ligne compacte le remplace ; `seancesOuvertes`, `menuSource` et `supprimerLivreVide` ne changent pas, hors le commentaire de `menuSource`,
  l. 30 : `// « Ajouter des pages de sommaire » / « Ajouter des recettes » : un <details> dont le résumé est le bouton, les sources dessous (spec UX § 9 ; textes D-UI-10).`).
  Entre `supprimerLivreVide` et `renderBook`, les constantes et la ligne compacte :

```js
// D-UI-7 : sous 900 px, la liste des recettes montre LIGNES_REPLIEES lignes puis « Voir les {n} recettes », qui déplie sur place (aucune navigation) ; la même
// borne que .two-col.livre (styles.css), lue par un matchMedia INJECTABLE (deps.matchMedia, le motif de la fiche recette) et réécoutée sur `change`.
export const LIGNES_REPLIEES = 8;
export const LARGEUR_DEUX_COLONNES = '(min-width: 900px)';

// D-UI-7, D-UI-10, I-UI-5 : une ligne de la liste compacte des recettes d'un livre. La vignette (D-F9 tenu) se décide AU RENDU, de façon synchrone, sur la ligne
// `files` que l'appelant a lue en une fois (repo.getFiles, comme les couvertures de la bibliothèque) : octets ICI et d'un type d'image (typeAffichage, la règle du
// lot G, displayUrl par urlDeBlob pour la révocation D-T9) → img.plat-vignette.petite, décorative (alt vide : le titre est à côté) ; sinon rien — jamais un cadre
// vide, jamais une lecture en base depuis la ligne. Le titre serif est le lien de la fiche ; « p. N » seulement avec printed_page ; la section lue dans la table des
// matières (lot C, sectionLisible : une fiche reçue ou restaurée peut porter autre chose qu'une chaîne) pour une référence seulement ; le badge est celui
// d'availabilityBadge (UNE définition des textes, D-UI-10) ; « Importer » et « Saisir à la main » sur une référence ou une partielle SANS adresse (mêmes href qu'au
// lot A, T4-R1 : un signet devenu partiel n'a pas d'entrée), hors du <a> du titre (jamais un lien dans un lien, m4).
export function ligneCompacte(r, { fichier = null } = {}) {
  const type = typeAffichage(fichier);
  const vignette = type && type.startsWith('image/') ? el('img', { class: 'plat-vignette petite', alt: '', loading: 'lazy', src: displayUrl(fichier, urlDeBlob) }) : null;
  const aImporter = (r.availability === 'reference_only' || r.availability === 'partial') && !r.source_url;
  const sectionLue = r.availability === 'reference_only' && !r.source_url ? sectionLisible(r.section) : null; // la règle d'avant : jamais sur un signet rangé
  const id = encodeURIComponent(r.id);
  return el('li', { class: 'row between', dataset: { recette: r.id } },
    el('div', { class: 'row top', style: { flex: '1', minWidth: '0' } },
      vignette,
      el('div', { style: { flex: '1', minWidth: '0' } },
        el('a', { class: 'titre', href: `#/recipes/${id}` }, r.display_title || r.original_title),
        el('div', { class: 'row', style: { gap: '.4rem' } },
          r.printed_page ? el('span', { class: 'muted' }, `${t('p.')} ${r.printed_page}`) : null,
          sectionLue ? el('span', { class: 'chip neutral', dataset: { role: 'section' } }, sectionLue) : null))),
    el('div', { class: 'row', dataset: { role: 'etat-recette' } },
      availabilityBadge(r),
      aImporter ? el('a', { class: 'btn small', href: `#/recipes/${id}/importer` }, t('Importer')) : null,
      aImporter ? el('a', { class: 'btn small', href: `#/recipes/${id}/edit?kind=extraction` }, t('Saisir à la main')) : null,
      r.favorite ? el('span', { class: 'badge' }, '★ ' + t('Favori')) : null));
}
```

  `renderBook` entière (l. 84-328 à `f3672be` ; les blocs marqués « inchangé » sont ceux de `f3672be` recopiés à l'octet, seul leur conteneur change) :

```js
export async function renderBook(params, query, ctx, deps = {}) {
  const edition = ctx.editionsById.get(params.id);
  if (!edition) return el('div', { class: 'card' }, t('Livre introuvable.'));
  const book = ctx.booksById.get(edition.book_id) || { title: t('Sans titre') };
  // R-UX-10 : un seul fait (« on arrive après création »), donc une seule condition — le MODÈLE décide, et la même
  // décision sert à poser le panneau plus bas. S16 : une arrivée après création n'est pas une ouverture volontaire.
  const accueil = accueilLivreModel({ nouveau: query.nouveau });
  if (!accueil.afficher) await repo.recordActivity(edition.id, 'open_book');
  const recipes = ctx.recipes.filter((r) => r.edition_id === edition.id);
  const docs = ctx.source_documents.filter((d) => d.edition_id === edition.id);
  const pages = ctx.source_pages.filter((p) => p.edition_id === edition.id);
  const pref = ctx.rediscovery_prefs.find((p) => p.edition_id === edition.id);
  // Une empreinte de couverture sans ligne files est un état NORMAL (fiche reçue d'un autre appareil, octets en L4) :
  // ici ça se dit, parce que la personne peut agir ; dans la grille de Mes livres, la vignette reste muette (§ 6).
  const fichierCouverture = edition.cover_sha256 ? await repo.getFile(edition.cover_sha256) : null;
  // Lot G (§ 4.2) : l'état de la couverture dit ce que la personne peut faire — télécharger (distante, compte), se connecter, ou attendre l'appareil
  // qui l'a prise. Sans ligne files du tout (pointeur arrivé avant sa ligne), le texte d'avant (tests/ajouter.js « un pointeur sans ligne files le DIT »).
  const ctxF = await contexteFichiers(ctx);
  const decrireCouverture = (fichier) => {
    const rien = { message: null, telechargeable: false, reessayable: false };
    if (!edition.cover_sha256 || fichier?.blob instanceof Blob) return rien;
    if (!fichier) return { ...rien, message: t('La couverture n’est pas sur cet appareil.') };
    const etat = etatFichier(fichier, ctxF);
    // Ronde 1 : la phrase du motif (un 404 n'est pas « illisible reçu ») ; « Réessayer » avec un compte ET le moteur (sans compte, la tape effaçait
    // le diagnostic sans rien retenter, R52 ; sans moteur, elle ne pouvait rien).
    if (etat === 'erreur') return { ...rien, message: texteErreurFichier(edition.cover_sha256, ctxF.erreurs), reessayable: ctxF.connecte };
    if (etat === 'distant') return ctxF.connecte ? { ...rien, message: t('La couverture n’est pas sur cet appareil.'), telechargeable: true } : { ...rien, message: t('La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.') };
    return { ...rien, message: t('La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.') };
  };
  // D-UI-7 : la largeur décide de la liste repliée (LIGNES_REPLIEES sous 900 px) ; injectable, jamais window.matchMedia nu (appel sans this : « Illegal invocation »).
  const matchMedia = deps.matchMedia || ((q) => window.matchMedia(q));
  const large = matchMedia(LARGEUR_DEUX_COLONNES);
  const root = el('div', null);
  // I-F : un scan parti d'ici porte le livre ET l'intention (index ou recette) ; le menu ne décide que de la SOURCE.
  const lancer = (intention) => async (accept, capture) => {
    const f = await pickFiles({ accept, multiple: true, capture });
    if (f.length) startScanSession(f, { edition_id: edition.id, intention });
  };
  // D-UI-7, H-21 : le sous-titre dit l'auteur, l'éditeur et l'année — ce qui est connu, dans cet ordre ; l'ISBN et la langue restent dans « Métadonnées et
  // convention ». Les deux menus d'ajout restent les ACTIONS de l'en-tête (markup inchangé, textes D-UI-10) ; le titre de fiche porte classeTitre (D-UI-3).
  root.append(pageHeader(book.title, {
    subtitle: [book.author, edition.publisher, edition.year].filter(Boolean).join(' · '),
    back: { href: '/library', label: t('Bibliothèque') },
    classeTitre: 'titre-fiche',
    actions: [
      menuSource(t('Ajouter des pages de sommaire'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF'))),
      menuSource(t('Ajouter des recettes'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF')),
        el('a', { class: 'btn', href: `#/recipes/new?edition=${encodeURIComponent(edition.id)}` }, t('Saisir à la main'))),
    ],
  }));
  root.append(renderAccueilLivre(accueil, {
    photographier: (intention) => lancer(intention)(ACCEPT_PHOTOS, 'environment'),
    choisir: (intention) => lancer(intention)(ACCEPT_FICHIERS, null),
    plusTard: () => navigate('/library'),
    fermer: () => remplacerAdresse(`#/books/${encodeURIComponent(edition.id)}`),
  }));
  // D-UI-7 : deux colonnes dès 900 px (.two-col.livre, 200px 1fr), empilées en dessous — gauche puis droite. Gauche = le livre (couverture, zone « Couverture »,
  // métadonnées, sommaire) ; droite = ce qu'on en fait (rappels, puis les recettes).
  const gauche = el('div', { class: 'stack', dataset: { role: 'colonne-livre' } });
  const droite = el('div', { dataset: { role: 'colonne-recettes' } });
  root.append(el('div', { class: 'two-col livre' }, gauche, droite));
  // La couverture ouvre la colonne de gauche (≈ 200 px, la largeur de la colonne) : c'est le livre qu'on reconnaît, avant de lire son nom (F15).
  gauche.append(bookCover(edition, book, { fichier: fichierCouverture }));
  // Spec import-cible § 4.5 : les imports ouverts de CE livre se reprennent dans la section « Imports » d'Ajouter (rendue en premier, avec le focus).
  const aReprendre = (ctx.imports || []).filter((i) => importOuvert(i) && i.edition_id === edition.id).length;
  if (aReprendre) droite.append(el('div', { class: 'row', dataset: { role: 'imports-a-reprendre' }, style: { marginBottom: '.8rem' } },
    el('a', { class: 'btn small', href: '#/add?section=imports' }, aReprendre === 1 ? t('{n} import à reprendre', { n: aReprendre }) : t('{n} imports à reprendre', { n: aReprendre }))));
  const ouvertes = seancesOuvertes(ctx, edition.id);
  if (ouvertes.length) droite.append(el('div', { class: 'card flat row between' },
    el('span', null, t('Séance en cours : {n} page(s)', { n: (ouvertes[0].page_ids || []).length })),
    el('a', { class: 'btn small', href: `#/import?session=${encodeURIComponent(ouvertes[0].id)}` }, t('Reprendre'))));

  const usesCups = ctx.recipe_versions.some((v) => recipes.some((r) => r.id === v.recipe_id) && (v.ingredients || []).some((i) => ['cup', 'tbsp', 'tsp', 'fl_oz'].includes(i.unit_id)));
  if (!edition.unit_convention_id && usesCups) {
    droite.append(el('div', { class: 'card warn stack' },
      el('strong', null, t('Quelle convention pour les tasses et cuillères de cette édition ?')),
      el('p', { class: 'muted', style: { margin: 0 } }, t('Des recettes de ce livre utilisent des tasses ou des cuillères. Sans convention confirmée, ces quantités restent affichées telles quelles.')),
      el('div', { class: 'row' }, select([{ value: '', label: t('Choisir…') }, ...listConventions().map((c) => ({ value: c.id, label: c.labels.fr }))], '', async (v) => { if (!v) return; await repo.save('book_editions', { ...edition, unit_convention_id: v, convention_evidence: 'confirmed_by_user' }); toast(t('Convention confirmée')); refresh(); }))));
  }

  // Les recettes de ce livre (D-UI-7, D-UI-10) : « disponibles » = tout ce qui n'est pas une simple référence (la partielle comprise, comme le compteur d'avant) ;
  // « à importer » = les références SANS adresse (un signet rangé dans le livre est un lien web, pas une page à importer). Les trois chips d'état ont disparu : la
  // phrase sous le titre les remplace.
  const disponibles = recipes.filter((r) => r.availability !== 'reference_only');
  const aImporter = recipes.filter((r) => r.availability === 'reference_only' && !r.source_url);
  // I-UI-5 : les octets des photos de plat sont lus UNE fois, en une transaction (comme les couvertures de la bibliothèque, library.js) ; la ligne décide au rendu.
  const photos = await repo.getFiles(recipes.filter(pointeurValide).map((r) => r.photo_sha256));
  const filterState = { mode: 'all', q: '', tout: false };
  const list = el('div', { dataset: { role: 'liste-recettes' } });
  const drawList = () => {
    let rows = recipes;
    if (filterState.mode === 'available') rows = disponibles; if (filterState.mode === 'refs') rows = aImporter; if (filterState.mode === 'fav') rows = recipes.filter((r) => r.favorite);
    if (filterState.q) rows = rows.filter((r) => (r.original_title + ' ' + (r.display_title || '')).toLowerCase().includes(filterState.q.toLowerCase()));
    rows = [...rows].sort((a, b) => (a.printed_page ?? 99999) - (b.printed_page ?? 99999) || a.original_title.localeCompare(b.original_title));
    // Lot F (§ 4.2, D-T9) : le filtre redessine à chaque touche ; les URL des vignettes précédentes sont révoquées APRÈS le remplacement, elles seules.
    if (!rows.length) { remplacerEnRevoquant(list, emptyState('livre-ouvert', t('Aucune recette dans cette vue. Photographie l’index ou une recette pour commencer.'))); return; }
    // Sous 900 px : LIGNES_REPLIEES lignes, puis « Voir les {n} recettes » déplie l'instance pour de bon (un filtre changé ensuite reste déplié) ; ≥ 900 px : tout.
    const repliee = !large.matches && !filterState.tout && rows.length > LIGNES_REPLIEES;
    const visibles = repliee ? rows.slice(0, LIGNES_REPLIEES) : rows;
    const noeuds = [el('ul', { class: 'liste-compacte' }, ...visibles.map((r) => ligneCompacte(r, { fichier: pointeurValide(r) ? photos.get(r.photo_sha256) ?? null : null })))];
    if (repliee) noeuds.push(el('button', { type: 'button', class: 'btn', dataset: { role: 'voir-tout' }, onClick: () => { filterState.tout = true; drawList(); } }, t('Voir les {n} recettes', { n: rows.length })));
    remplacerEnRevoquant(list, ...noeuds);
  };
  // Une rotation ou un redimensionnement redessine la liste tant que la fiche est à l'écran ; détachée (route quittée), elle ne fait rien.
  large.addEventListener?.('change', () => { if (list.isConnected) drawList(); });
  const q = el('input', { type: 'search', placeholder: t('Filtrer les recettes de ce livre'), onInput: (e) => { filterState.q = e.target.value; drawList(); } });
  droite.append(sectionPlain(t('Les recettes de ce livre'),
    el('p', { class: 'muted', dataset: { role: 'compte-recettes' } }, t('{n} disponible(s) · {m} à importer', { n: disponibles.length, m: aImporter.length })),
    el('div', { class: 'row', style: { marginBottom: '.6rem' } },
      ...[['all', t('Toutes')], ['available', t('Disponibles')], ['refs', t('À importer')], ['fav', t('Favoris')]].map(([v, l]) => el('button', { type: 'button', class: `btn small${v === 'all' ? ' active' : ''}`, onClick: (e) => { filterState.mode = v; for (const b of e.target.parentNode.children) b.classList.remove('active'); e.target.classList.add('active'); drawList(); } }, l)),
      q),
    list));
  drawList();

  // Couverture (spec § 6) : visible, hors du <details> replié ; « Retirer » ne touche que le pointeur. (Bloc inchangé, de `const etatCouv` à `dessinerCouv();` ;
  // seule sa dernière ligne change de conteneur.)
  const etatCouv = { sha256: edition.cover_sha256 || null, apercu: fichierCouverture?.blob ? urlDeBlob(fichierCouverture.blob) : null, enCours: false,
    telechargement: false, ...decrireCouverture(fichierCouverture) };
  // Le ré-encodage d'une photo de téléphone prend un instant : les boutons se ferment pendant (aucune double pose),
  // et l'état réel est redessiné sur place. En cas de succès, refresh() rend la fiche entière.
  const zoneCouv = el('div', null);
  const dessinerCouv = () => zoneCouv.replaceChildren(renderZoneCouverture(etatCouv, gestesCouv));
  // C4 : chaque geste RELIT l'édition et n'écrit que SON champ. Réécrire `{ ...edition }` — l'édition lue au RENDU —
  // effaçait ce que l'autre geste de la même fiche venait d'écrire : enregistrer les métadonnées remettait le
  // `cover_sha256` d'avant (couverture perdue), et poser une couverture remettait les métadonnées d'avant.
  const ecrirePointeur = async (sha256) => {
    try {
      const courante = (await repo.get('book_editions', edition.id)) || edition;
      await repo.save('book_editions', { ...courante, cover_sha256: sha256 });
      return true;
    } catch { return false; }
  };
  const poser = async (capture) => {
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture });
    if (!files.length) return;
    etatCouv.enCours = true; dessinerCouv();
    let empreinte;
    // Deux phases, deux phrases : une image refusée n'est pas une écriture refusée (I-B).
    try { empreinte = (await poserCouverture(files[0], { origine: 'locale' })).sha256; }
    catch (e) { etatCouv.enCours = false; dessinerCouv(); toast(messageErreurImage(e)); return; }
    if (!(await ecrirePointeur(empreinte))) { etatCouv.enCours = false; dessinerCouv(); toast(t('La couverture n’a pas pu être changée. Réessaie.')); return; }
    toast(t('Couverture enregistrée.')); refresh();
  };
  const gestesCouv = {
    photographier: () => poser('environment'),
    choisir: () => poser(null),
    // RF-m4 : « Retirer » écrit aussi — il se ferme donc pendant, comme les deux autres (deux tapes pressées ne
    // font pas deux écritures), et il relit l'édition avant d'écrire (C4).
    retirer: async () => {
      if (etatCouv.enCours) return;
      etatCouv.enCours = true; dessinerCouv();
      if (!(await ecrirePointeur(null))) { etatCouv.enCours = false; dessinerCouv(); toast(t('La couverture n’a pas pu être changée. Réessaie.')); return; }
      toast(t('Couverture retirée.')); refresh();
    },
    // Sur une tape seulement (R-G-1). Succès : la zone se redessine avec l'image, le cache est invalidé et la fiche se rend (bookCover de l'en-tête).
    telecharger: async (reessayer = false) => {
      if (etatCouv.telechargement) return;
      etatCouv.telechargement = true; dessinerCouv();
      try { if (reessayer) await ctxF.moteur?.reessayerFichier(edition.cover_sha256); else await ctxF.moteur?.telecharger([edition.cover_sha256]); } catch { /* dit plus bas */ }
      // Ronde 1 : une relecture qui lève (base fermée, quota) ne laisse plus la zone figée sur « Téléchargement… » : l'état d'avant, et l'échec dit.
      let f = null; let lu = true;
      try { f = await repo.getFile(edition.cover_sha256); } catch { lu = false; }
      etatCouv.telechargement = false;
      if (lu && f?.blob instanceof Blob) { invalidate(); Object.assign(etatCouv, { apercu: urlDeBlob(f.blob) }, decrireCouverture(f)); dessinerCouv(); refresh(); return; }
      if (lu) { await relireErreurs(ctxF); Object.assign(etatCouv, decrireCouverture(f)); }
      dessinerCouv();
      toast(t('Le téléchargement n’a pas abouti.'));
    },
    reessayer: () => gestesCouv.telecharger(true),
  };
  dessinerCouv();
  gauche.append(section(t('Couverture'), zoneCouv)); // reste .card : un panneau d'action (D-UI-8)

  // Métadonnées (details inchangé, l. 276-326 à f3672be, recopié à l'octet ; seul `root.append(` devient `gauche.append(`) : le bloc de `const meta = {` au
  // `: el('small', { class: 'muted' }, t('Un livre avec des recettes ou des pages ne se supprime pas d’un geste.')))));` — Enregistrer, Réafficher, Supprimer compris.
  const meta = { title: book.title, author: book.author || '', isbn: edition.isbn || '', publisher: edition.publisher || '', year: edition.year || '', language: edition.language || 'fr', convention: edition.unit_convention_id || '', cuisines: [...(book.cuisines || [])], tags: tagsDe(book.tags) }; // S2 : tagsDe rend toujours un tableau neuf
  const inp = (k, type = 'text') => el('input', { type, value: meta[k], onInput: (e) => { meta[k] = e.target.value; } });
  gauche.append(el('details', { class: 'card' }, el('summary', null, el('strong', null, t('Métadonnées et convention'))),
    /* … le contenu de f3672be l. 280-326, inchangé … */));

  // D-UI-7 : UNE lecture des octets des pages (vignettesDePages, le motif du lot G) ; les pages d'index font le « Sommaire » (gauche, numérotées dans l'ordre
  // des pages imprimées ; l'ordre se corrige dans le panneau de la séance, pas ici), les autres restent dans « Pages et fichiers sources » (bas). Chaque groupe
  // n'offre « Télécharger les {n} pages » que pour SES pages distantes.
  const triees = [...pages].sort((a, b) => (a.printed_page ?? 9999) - (b.printed_page ?? 9999));
  const pagesIndex = triees.filter((p) => p.kind === 'index');
  const pagesAutres = triees.filter((p) => p.kind !== 'index');
  const vignettes = (pagesIndex.length || docs.length) && triees.length ? await vignettesDePages(triees, ctxF) : { places: new Map(), distantes: [], telecharger: null };
  const distantesDe = (liste) => { const shas = new Set(liste.map((p) => p.sha256)); return vignettes.distantes.filter((s) => shas.has(s)); };
  const vignettesDe = (liste, numerotees) => el('div', { class: 'thumbs' }, ...liste.map((p, i) => el('figure', null,
    numerotees ? el('span', { class: 'num' }, String(i + 1)) : null,
    vignettes.places.get(p.id),
    el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : t('page non numérotée'), p.kind ? ` · ${p.kind === 'index' ? t('index') : t('recette')}` : ''))));
  // « Sommaire » (plain) : seulement quand il y a quelque chose à montrer — des pages d'index, ou une séance ouverte à reprendre (rien d'inventé).
  if (pagesIndex.length || ouvertes.length) gauche.append(sectionPlain(t('Sommaire'),
    ouvertes.length ? el('div', { class: 'row' }, el('a', { class: 'btn small', href: `#/import?session=${encodeURIComponent(ouvertes[0].id)}` }, t('Reprendre la séance'))) : null,
    boutonTelechargerPages(distantesDe(pagesIndex), { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
    pagesIndex.length ? vignettesDe(pagesIndex, true) : null));

  // Index : ajouter des entrées directement depuis la fiche du livre (inchangé) — sous le Sommaire, dont c'est la saisie à la main.
  const indexPanel = indexEntriesPanel(null, ctx, () => [], { editionId: edition.id });
  gauche.append(el('details', null, el('summary', { class: 'btn' }, t('Ajouter des entrées d’index à la main')), indexPanel));

  // Pages et documents (plain, en bas) : les pages qui ne sont pas d'index, et les documents non-photo.
  if (docs.length) {
    root.append(sectionPlain(t('Pages et fichiers sources'),
      el('p', { class: 'muted' }, t('{n} document(s). Les originaux restent consultables depuis chaque recette.', { n: docs.length })),
      boutonTelechargerPages(distantesDe(pagesAutres), { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
      vignettesDe(pagesAutres, false),
      ...docs.filter((d) => d.source_type !== 'photo').map((d) => el('div', { class: 'row between card flat' }, el('span', null, `${d.original_filename} (${d.source_type.toUpperCase()})`), el('a', { class: 'btn small', href: `#/recipes/new?doc=${encodeURIComponent(d.id)}&edition=${encodeURIComponent(edition.id)}` }, t('Créer une recette depuis ce fichier'))))));
  }
  return root;
}

export { promptDialog };
```

  Le commentaire `/* … le contenu de f3672be l. 280-326, inchangé … */` désigne les 47 lignes du `details` « Métadonnées et convention » telles qu'elles sont à la
  tête de T3 (le `div.two-col` des champs, Cuisines, Mots-clés, Convention de mesure, la rangée Enregistrer / Réafficher / Supprimer) : elles ne bougent pas d'un
  caractère ; l'implémenteur les laisse en place et ne change que `root.append(` → `gauche.append(` sur la l. 279 et la position du bloc (avant le Sommaire).
  Rien d'autre ne change dans le module : `seancesOuvertes`, `menuSource`, `supprimerLivreVide` sont ceux de `f3672be`.

- [ ] **Step 5 : `styles.css` et `src/i18n/en.js`.** Dans `styles.css`, après `.list.plain li { border: 0; padding: .25rem 0; }` (l. 248 à `f3672be`) :

```css
/* UI-1, T4 (D-UI-7, D-UI-8) : la liste compacte des recettes d'un livre — filets fins entre les lignes, titre serif qui est le lien de la fiche ;
   la vignette 48 px à sa gauche est .plat-vignette.petite (T2). Jetons seulement (T-2), aucun display:none (T-1), le survol sous @media (hover: hover). */
.liste-compacte { list-style: none; margin: 0; padding: 0; }
.liste-compacte > li { padding: .55rem 0; border-bottom: 1px solid var(--line); }
.liste-compacte > li:last-child { border-bottom: 0; }
.liste-compacte .titre { font-family: var(--serif); font-size: 1.05rem; line-height: 1.3; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
@media (hover: hover) { .liste-compacte .titre:hover { text-decoration: underline; } }
```

  (plus le conditionnel (b) du Step 0 sur `.two-col.livre`, s'il y a lieu). Dans `src/i18n/en.js` : retirer les deux lignes `"+ Pages d’index": "+ Index pages",` et
  `"+ Recette": "+ Recipe",` (l. 234-235 à `f3672be`) ; ajouter, juste avant l'accolade finale `};` :

```js
  // Lot UI-1, tâche 4 : la fiche livre (spec § 5 ; « Reprendre la séance » est le texte de § 4.3 ; « Disponibles » : filtre antérieur, entrée posée au passage ;
  // « À importer » → « To import » est posée par T2 : UNE clé, jamais redoublée — tests/ajouter.js:21).
  'Ajouter des recettes': 'Add recipes', 'Ajouter des pages de sommaire': 'Add table-of-contents pages', 'Sommaire': 'Table of contents', 'Reprendre la séance': 'Resume the session',
  'Les recettes de ce livre': 'The recipes in this book', '{n} disponible(s) · {m} à importer': '{n} available · {m} to import', 'Voir les {n} recettes': 'Show all {n} recipes',
  'Disponibles': 'Available',
```

- [ ] **Step 6 : vert.** `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` : tout vert **sauf l'épingle** (relevée au Step 7) — le bloc T4 de
  `tests/carnet.js` (six `bloc`, aucun échec ni levée), `tests/ajouter.js` (844-846, 3672-3674, filet i18n F13 : « chaque t() des modules neufs a son entrée en.js »
  avec la liste de book.js), `tests/photo-plat.js` (1296-1309 amendé : 2 vignettes `.petite`, révocation exacte au filtre), `tests/sync-l4.js` (3580 en `plain` ;
  3585, 3595, 3606, 3810 toujours verts), `tests/table-matieres.js` (T-C18 sur la ligne compacte), `tests/import-cible.js:1482-1486` (inchangé, vert),
  `tests/theme.js` vert SANS changement (T-1 inventaire des `display:none`, T-2 couleurs, T-11 `56px`, survols). Attendu : `❌ N/(N+1)` avec l'épingle seule en
  ECHECS ; `node --test tools/*.test.mjs` 208/208 ; `node tools/generer-migrations.mjs --check` 0 ; 0 erreur console hors le 404 de `/favicon.ico`.
- [ ] **Step 7 : épingle relevée ; `sw.js` `VERSION`.** `tests/tests.js:250` : `eq(results.length, <N>, …)` où `<N>` = le total lu dans le bilan du Step 6 moins
  l'assertion du total elle-même (règle N−1 : la valeur de « obtenu » dans la ligne rouge de l'épingle). `sw.js:4` : `const VERSION = 'cuisine-os-v0.17.0-4';` (+1 sur
  le suffixe de la tête de T3 ; `SHELL` inchangé : aucun module neuf dans cette tâche). Relancer la suite : `✅ (N+1)/(N+1)`.
- [ ] **Step 8 : mutants de la tâche** (copie servie à part — `git archive HEAD | tar -x -C <scratchpad>/mut-T4` puis le mutant, servie sur 8190 ; jamais en place ;
  chacun doit rougir, le bloc ou le test qui le voit est nommé) : la vignette posée sans `typeAffichage` (`fichier?.blob` seul : la ligne `text/html` de « Bouillon »
  montre une image → « liste compacte ») · `displayUrl(fichier)` sans `urlDeBlob` (révocation aveugle → photo-plat 1309, compte des révocations) · révocation
  retirée de `drawList` (`list.replaceChildren` au lieu de `remplacerEnRevoquant` → photo-plat 1309) · « Importer » posé aussi sur un signet (`!r.source_url`
  retiré → « liste compacte » Escabèche, import-cible 1485) · filtre « À importer » câblé sur `reference_only` seul (`aImporter = refs` → « liste compacte » :
  `['Compote', 'Escabèche']`) · compteur « à importer » qui compte le signet (→ `'4 disponible(s) · 2 à importer'`) · sous-titre qui garde l'ISBN (→ « fiche livre »)
  · `classeTitre` retiré (→ `titre-fiche` faux) · borne de 8 lignes retirée (`repliee = false` → « 8 lignes » : 12) · borne appliquée aussi ≥ 900 px
  (`!large.matches` retiré → `large` 8) · « Voir les {n} recettes » en `a[href]` ou qui ne déplie pas (→ « 8 lignes ») · écouteur `change` retiré (→ bascule : 8)
  · `filterState.tout` remis à faux au changement de filtre (→ « reste dépliée » : 8) · `section(` au lieu de `sectionPlain(` pour « Les recettes de ce livre »,
  « Sommaire » ou « Pages et fichiers sources » (→ « fiche livre » formes `SECTION:plain`, sync-l4:3580 — par comportement, rév. 2) · « Couverture » en `sectionPlain` (→ « fiche livre »
  `SECTION:plain` en 2e, ajouter:3667, sync-l4:3585) · la couverture laissée hors de la colonne (→ ajouter:3672, « fiche livre » `A:cover-wrap`) · chip de section
  dans le `<a>` du titre (→ T-C18 `a [data-role="section"]`, « liste compacte » `a.titre .chip`) · Sommaire sur toutes les pages (`kind` ignoré → « fiche livre »
  figures) · Sommaire rendu sans page d'index ni séance (→ `sectionDe(sans, 'Sommaire')` non nul) · « Reprendre la séance » retiré (→ « fiche livre ») · les trois
  chips `.status` gardés (→ « fiche livre » `.status.ok` 1) · anciens textes des `summary` (→ ajouter:844, « fiche livre ») · `.liste-compacte .titre` sans
  `var(--serif)` (→ « styles.css servie » `serif` faux ; « styles.css lue ») · survol hors `@media (hover: hover)` (→ « styles.css lue ») · un `display: none` ou
  une couleur en dur ajoutés à une règle `.liste-compacte` (→ « styles.css lue » ; `tests/theme.js` T-1 / T-2 aussi) · `window.matchMedia(LARGEUR_DEUX_COLONNES)` nu
  comme défaut (→ « filets » `(q) => window.matchMedia(q)` ; dans l'app réelle : « Illegal invocation »).
- [ ] **Step 9 : invisibles** sur les fichiers touchés (`src/ui/book.js`, `styles.css`, `src/i18n/en.js`, `tests/carnet.js`, `tests/ajouter.js`, `tests/photo-plat.js`,
  `tests/sync-l4.js`, `tests/table-matieres.js`, `tests/tests.js`, `sw.js`) : `python3 -I` qui compte U+200B-200F, U+2028-202E, U+2060-2064, U+2066-2069, U+FEFF et
  les Cc hors `\n`, `\t` → 0 partout (jamais `grep -cP` : ugrep rend 0 à tort). Secrets : `git grep -nEi 'sk-ant-[0-9A-Za-z_-]{10,}|eyJ[A-Za-z0-9_-]{20,}' -- src tests` :
  seules les sentinelles connues du lot web.
- [ ] **Step 10 : commit** (un seul, après le vert du Step 7, message ASCII sans accents) :

```text
Fiche livre : menus renommes, deux colonnes, sommaire, liste compacte des recettes (lot UI-1, tache 4)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

  (plus le trailer `Claude-Session:` que le harnais de l'implémenteur impose, comme sur `f3672be`.) Fichiers du commit : `src/ui/book.js`, `styles.css`,
  `src/i18n/en.js`, `sw.js`, `tests/carnet.js`, `tests/ajouter.js`, `tests/photo-plat.js`, `tests/sync-l4.js`, `tests/table-matieres.js`, `tests/tests.js` — par
  `git add <fichiers>` nommés (jamais `-A` : le registre `.superpowers/` est exclu, le scratchpad est hors dépôt). `progress.md` du registre : une ligne « T4 : … »
  avec le bilan (épingle, `sw.js`, mutants rouges, les deux conditionnels du Step 0 tranchés).

---

### Task 5 : Aujourd'hui, Ajouter, import ciblé, libellés dérivés — pageHeader et cartes-plat de l'accueil, icônes des cartes d'action, « À importer », × sur la vignette

Spec § 9 tâche T5 ; § 4.4 (Aujourd'hui), § 4.5 (Ajouter, import ciblé), D-UI-9 (icônes d'`add.js:29-34` et d'`accueil-livre.js:12-14`), D-UI-10 et
H-19 (libellés d'affichage), § 5 (textes), § 7 T5 (épingles) ; I-UI-1, I-UI-3, I-UI-4, I-UI-5 ; H-16 (date et bouton de cuisson hors du `<a>`, puces
sous la barre). Consomme T1 (`sectionPlain`, `pageHeader` + `classeTitre`, `icones.js`, `tests/carnet.js`) et T2 (`recipeCard(doc, { photoEnTete,
fichier })`, `grilleCartes`). `sw.js` `VERSION` : le suffixe de la tête de T4 **+1** (attendu `cuisine-os-v0.17.0-5` si T1 à T4 ont chacune UN
commit qui touche `src/` ; R-B-24 : chaque commit qui touche `src/`, `styles.css` ou `sw.js` incrémente, ronde comprise). Aucun module neuf : `SHELL`
inchangé. `APP_VERSION 0.17.0` et `DB_VERSION 4` inchangées.

**Files:**
- Modify: `src/ui/home.js` (l. 1-20 : en-tête, imports, `renderHome` jusqu'aux puces ; l. 25 et 58 : `section` → `sectionPlain` ; l. 38-53 : Favoris et
  Dernières cuissons en grille ; signature de `renderHome`, l. 11 : un 4e paramètre, le sac `{ repo }`)
- Modify: `src/ui/add.js` (l. 15 : import `icone` ; l. 29-34 : `ico` = nom d'icône ; l. 41 : `carte(icone(c.ico), …)`)
- Modify: `src/ui/accueil-livre.js` (l. 5 : import `icone` ; l. 12-14 : `ico` = nom d'icône, le TEXTE de la l. 14 est celui que T1 a posé ; l. 28 :
  `carte(icone(c.ico), …)`)
- Modify: `src/ui/import-cible.js` (l. 499-510 : `ecrirePageImprimee` réécrit la légende et referme le champ ; l. 670 : badge « À importer » /
  « Partielle » ; l. 672-696 : `sectionPages` — × en coin, légende-bouton, champ né `hidden`, Monter / Descendre inchangés ; une fonction `legendeDe`
  déclarée juste avant `ecrirePageImprimee`)
- Modify: `src/ui/components.js` (l. 33-39 : `availabilityBadge`, textes courts)
- Modify: `src/core/i18n.js` (l. 27 : `reference_only: 'À importer'`)
- Modify: `src/ui/library.js` (l. 73 : `'{n} repérée(s)'` → `'{n} à importer'`)
- Relu, INCHANGÉ : `src/ui/book.js` (**D-10 RATIFIÉ rév. 3** : T4 (§ 4.3) porte le compteur « {n} disponible(s) · {m} à importer » et le filtre « À importer »
  de `book.js` — il remplace les trois chips d'état et renomme le filtre ; T5 NE les refait PAS. Si `grep` trouvait encore à la tête de T4 les sites de
  `f3672be` (l. 163 `t('{n} repérée(s) dans l’index', …)`, l. 195 `['refs', t('Repérées')]`), c'est un CONSTAT pour la revue de T4, consigné dans
  `progress.md`, jamais une correction de T5 ; Step 0 (b))
- Modify: `src/i18n/en.js` (fin du dictionnaire : sept clés neuves ; retrait de la clé orpheline `'{n} repérée(s)'` (en.js:23) si plus aucun `t('…')` de
  `src/` ne la porte — `'{n} repérée(s) dans l’index'` n'a JAMAIS eu d'entrée : book.js:163 l'appelait sans traduction, T4 la retire ; rév. 2)
- Modify: `styles.css` (après `.card.carte p` l. 137 : `.card.carte .carte-ico svg` ; après `.search-bar input` l. 233 : `.recherche-accueil`,
  `.cellule-cuisson` ; après `.thumbs .fichier-absent` l. 267 : `.thumbs .btn.retirer`, `.thumbs .legende`)
- Test: `tests/carnet.js` (bloc « Tâche 5 », AVANT la fin de `runCarnetTests`), `tests/ajouter.js` (l. 24-49 `CHAINES_NEUVES_AILLEURS` ; l. 1133 ;
  l. 3807), `tests/import-cible.js` (l. 668, 713, 912), `tests/creer-ia.js` (l. 1089), `tests/table-matieres.js` (l. 1672 : relue, voir Step 2),
  `tests/tests.js` (épingle l. 250), `sw.js` (`VERSION`, l. 4)

Les numéros de ligne sont ceux de `f3672be` (main `05c751f` + docs) ; T1 à T4 ont bougé `home.js` (non), `add.js` (non), `accueil-livre.js` (l. 14 :
texte), `import-cible.js` (non attendu), `components.js` (oui : `sectionPlain`, `grilleCartes`, `recipeCard`, `pageHeader`), `library.js` (oui, T2),
`book.js` (oui, T4), `en.js` (oui), `tests/ajouter.js` (oui : pins, `MODULES_NEUFS`, `CHAINES_NEUVES_AILLEURS`), `tests/import-cible.js` (T4 : ligne
compacte). Chaque site est retrouvé par son TEXTE (Step 0) ; un écart de numéro n'est pas un constat (R-C-7).

**Interfaces:**
- Consumes (T1, `src/ui/components.js`) : `sectionPlain(title, ...children) → HTMLElement` (`section.plain` > `h2` + enfants ; `section()` reste
  `section.card`) ; `pageHeader(title, { subtitle = null, actions = [], back = null, classeTitre = null } = {})` (`header.stack` > `div.row.between.top`
  > `div` > `h1` + `p.muted`). (T1, `src/ui/icones.js`) : `icone(nom) → SVGSVGElement` (`svg[aria-hidden="true"][focusable="false"]` 24 × 24,
  `stroke: currentColor` ; LÈVE sur un nom hors des vingt-trois) ; noms employés ici : `livres`, `appareil-photo`, `crayon`, `lien`, `etincelle`, `flocon`
  (grille Ajouter), `appareil-photo`, `page`, `horloge` (accueil d'un livre). (T1, `tests/carnet.js`) : `runCarnetTests({ eq, ok })`, son lanceur
  `bloc(nom, f)` (try/catch → `ok(false, …)`) et son repère de fin (`// --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette
  ligne ---`), câblés dans `tests/tests.js` avant le bloc thème ; `icone(nom)` lève `TypeError` sur un nom inconnu (plan T1).
- Consumes (T2, `src/ui/components.js`) : `recipeCard(doc, { photoEnTete: true, fichier })` → `a.item-link.carte-plat[href="#/recipes/<id>"]` ; quand
  `typeAffichage(fichier)` est une image : `img.plat-vignette.grande[src^="blob:"]` (`displayUrl(fichier, urlDeBlob)`, décision SYNCHRONE) ; sinon
  `a.item-link.carte-plat.sans-photo` sans aucune `img` ; la variante ne lit RIEN elle-même (ni `getFile`, ni `vignettePlat`). `grilleCartes(noeuds) →
  div.grille-plats` (les nœuds reçus sont ses enfants directs).
- Consumes (existants) : `repo.getFiles(sha256s) → Map(sha → ligne files)` (`src/model/repo.js:565` ; une transaction ; dédoublonne ; les absentes
  manquent) ; `el`, `formatDate` (`src/core/dom.js`) ; `buildQuery` (`src/core/router.js` : `URLSearchParams`, les valeurs `''`/`null` sautent) ;
  `renderImportCible(params, query, ctx, { repo, navigate, toast, fetch, pickFiles, maintenant })` et `root.etatRoute()` (lot A) ; `withRepo`
  (`tests/sync-fixture.js`) ; `buildDocs` (`src/domain/search.js`) ; `label`, `setUiLocale`, `getUiLocale` (`src/core/i18n.js`) ; `EN` (`src/i18n/en.js`).
- Produces :
  - `availabilityBadge(recipe) → span.badge` : `reference_only` + `source_url` → `.badge.reference` « Lien web » (inchangé) ; `reference_only` →
    `.badge.reference` « À importer · p. {p} » si `recipe.printed_page` est vrai, sinon « À importer » ; `available` → `.badge.available` « Disponible » ;
    `partial` → `.badge.partial` « Partielle » ; toute autre valeur → `.badge.reference` + `label('availability', valeur)` (comme avant : texte vide).
  - `STATE_LABELS.availability.reference_only === 'À importer'` : `label('availability', 'reference_only')` → « À importer » / « To import » ;
    `available` et `partial` inchangés (« Recette disponible », « Partiellement disponible »).
  - `renderHome(params, query, ctx, { repo: depot = repo } = {})` : quatrième paramètre neuf (sac injecté, même forme que les autres routes ; **D-9 RATIFIÉ
    rév. 3** : une extension d'API facultative, `app.js:96` `route('/', renderHome)` ne change pas — la route reçoit trois arguments, le défaut vaut) ;
    `depot.getFiles` est appelé UNE fois par rendu, avec les empreintes des cartes rendues (favoris + cuissons), zéro fois sans empreinte.
    DOM : `header` (pageHeader) → `div.recherche-accueil.stack` > `div.search-bar` + `div.chips` → `section.plain` « Reprendre ma recette » →
    Redécouvrir (`div.card`, inchangé) → `section.plain` « Favoris » > `div.grille-plats` > cartes-plat → `section.plain` « Dernières cuissons » >
    `div.grille-plats` > `div.cellule-cuisson` > [`a.carte-plat`, `div.muted.cuisson-date`, `a.btn.small` « Refaire comme la dernière fois »] →
    `section.plain` « À utiliser en priorité » → `section.card` « Bienvenue » (inchangée).
  - `grilleModel().cartes[i].ico` : le NOM d'une icône (`'livres'`, `'appareil-photo'`, `'crayon'`, `'lien'`, `'etincelle'`, `'flocon'`), plus un émoji ;
    `renderGrille` rend `carte(icone(c.ico), …)`. `accueilLivreModel().cartes[i].ico` : `'appareil-photo'`, `'page'`, `'horloge'` ; `renderAccueilLivre`
    rend `carte(icone(c.ico), …)`. `carte(ico, …)` (components.js:232) accepte déjà un nœud comme `ico` (`el` ajoute un nœud enfant tel quel).
  - Écran d'import ciblé (`src/ui/import-cible.js`) : en-tête `span.badge.reference` « À importer » / `span.badge.partial` « Partielle » ; par vignette
    (`figure`), enfants directs : `span.num`, `img`, `button.btn.retirer[data-role="retirer"][data-page=<id>][aria-label="Retirer la page {n}"]`
    (texte « × », absent quand les pages sont figées), `figcaption.stack` > [`button.btn.link.small.legende[data-role="legende"][data-page=<id>]
    [aria-expanded="false"|"true"]` (texte « Page {n} · p. {p} » ou « Page {n} »), `input[type="number"][hidden]` (« p. imprimée », ouvert par la légende,
    refermé par une saisie valide), `div.row` > Monter / Descendre inchangés (`data-role` `monter` / `descendre`, textes « Monter la page {n} » /
    « Descendre la page {n} », absents quand figées)].
  - `styles.css` : `.card.carte .carte-ico svg`, `.recherche-accueil`, `.cellule-cuisson`, `.cellule-cuisson > .carte-plat`, `.cellule-cuisson
    .cuisson-date`, `.thumbs .btn.retirer`, `.thumbs .legende` (jetons seulement, aucun `display:none`, aucun `56px`, aucun `:hover`).
  - `src/i18n/en.js` : « À importer » → « To import », « À importer · p. {p} » → « To import · p. {p} », « Disponible » → « Available », « Partielle » →
    « Partial », « Cherche une recette, un ingrédient, une envie. » → « Search a recipe, an ingredient, a craving. », « Page {n} · p. {p} » →
    « Page {n} · p. {p} », « {n} à importer » → « {n} to import ».
  - `tests/ajouter.js` : `CHAINES_NEUVES_AILLEURS['../src/ui/components.js']` + les quatre textes courts ; clé neuve `'../src/ui/home.js'` ;
    `CHAINES_NEUVES_AILLEURS['../src/ui/library.js']` + `'{n} à importer'` (créée si T2 ne l'a pas posée).

- [ ] **Step 0 : relire la tête de T4** (lecture seule ; chaque écart est un amendement NOMMÉ dans `progress.md`, jamais un constat) :

```bash
cd /Users/neeganmac/projects/mistu-carnet && git log --oneline -1 && grep -n "VERSION = " sw.js && grep -n "APP_VERSION" src/model/schema.js && grep -n "results.length" tests/tests.js
# T1 : les interfaces consommées existent (chaque grep rend au moins une ligne)
grep -n "export function sectionPlain\|export function pageHeader\|export function grilleCartes\|export function recipeCard\|photoEnTete" src/ui/components.js
grep -n "export function icone\|'livres'\|'appareil-photo'\|'crayon'\|'lien'\|'etincelle'\|'flocon'\|'page'\|'horloge'" src/ui/icones.js
grep -n "export async function runCarnetTests\|const bloc = \|repère de fin" tests/carnet.js | head
grep -n "runCarnetTests" tests/tests.js
# Les sites de cette tâche, retrouvés par leur TEXTE
grep -n "card sage\|section(t('Favoris')\|section(t('Dernières cuissons')\|section(t('Reprendre ma recette')\|section(t('À utiliser en priorité')\|recipeCard(d)" src/ui/home.js
grep -n "ico: '" src/ui/add.js src/ui/accueil-livre.js
grep -n "Repérée dans ton livre\|Partiellement disponible\|Retirer la page\|p. imprimée\|function ecrirePageImprimee\|function sectionPages" src/ui/import-cible.js
grep -n "epérée\|Repérées" src/ui/book.js src/ui/library.js
grep -rn "t('{n} repérée(s)'\|t('{n} repérée(s) dans l’index'\|t('Repérées')" src/
grep -n "'À importer'\|\"À importer\"\|'Disponible'\|\"Disponible\"\|'Partielle'\|\"Partielle\"\|{n} à importer\|Page {n} · p\|Cherche une recette" src/i18n/en.js
grep -n "'../src/ui/home.js'\|'../src/ui/library.js'\|'../src/ui/components.js'" tests/ajouter.js
grep -n "Repérée dans ton livre — page 12\|ico: 'x'" tests/ajouter.js
grep -n "\['Repérée dans ton livre'\]\|\['Partiellement disponible'\]\|bouton(root, 'Retirer la page 2')" tests/import-cible.js
grep -n "'✨'" tests/creer-ia.js
grep -n "Repérée dans ton livre — page {p}" src/ui/recipe.js tests/table-matieres.js
```

  Attendus et décisions : (a) `sw.js` lu = `cuisine-os-v0.17.0-K` : cette tâche écrit `-(K+1)` ; (b) `book.js` : ATTENDU — le plan T4 retire `{n} recette(s) disponible(s)`, `{n} repérée(s)
  dans l’index`, `{n} page(s) source` et `Repérées` (sous-titre « {n} disponible(s) · {m} à importer », filtre `t('À importer')`) : le Step 7 ne touche
  pas `book.js` ; si `grep` les rend encore, c'est un CONSTAT pour la revue de T4 (**D-10 RATIFIÉ rév. 3** : T4 porte le compteur et le filtre, T5 ne les
  refait pas) — la tâche s'arrête et le remonte (NEEDS_CONTEXT : le test « libellés » du Step 1 rougirait sur `[0, 0]`, il n'affirme que l'ABSENCE de
  « repérée » dans les `t('…')` du source) ; (c) `en.js` : une clé déjà posée par T1 à T4 n'est PAS répétée (une seconde clé homonyme la remplacerait : `tests/ajouter.js:21`) — ATTENDU :
  `'À importer': 'To import'` est posée par T2 (plan T2, Step 7 ; T4 ne la redouble pas, A-7) ; les six autres clés du Step 4 sont neuves ; (d) `CHAINES_NEUVES_AILLEURS` : la clé `'../src/ui/library.js'` existe (T2, douze chaînes) : on y AJOUTE
  `'{n} à importer'` en fin de tableau, jamais une seconde clé (A-8) ; (e) `tests/carnet.js` : le lanceur s'appelle `bloc(nom, f)` (plan T1) et le repère de fin est la ligne
  `// --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette ligne ---` ; `withRepo` n'y est pas importé en tête — le bloc du
  Step 1 importe ce qu'il emploie (`await import('./sync-fixture.js')`) et déclare ses helpers dans sa propre accolade, donc rien ne dépend des helpers
  de T1 à T4 ; si le lanceur ou le repère ont bougé, le bloc suit le nom réel ; (f) `grilleCartes(noeuds)` → `div.grille-plats` portant les nœuds, et `recipeCard(doc, { photoEnTete: true, fichier })` →
  `a.item-link.carte-plat[.sans-photo]` > [`img.plat-vignette.grande`] > `div.carte-plat-corps` (plan T2) : confirmés ; si la forme réelle diffère, les deux
  appels du Step 5 la suivent (le test lit les cellules en descendants de `.grille-plats`, pas en enfants directs) ; (g) `recipe.js:315` porte toujours `t('Repérée dans ton livre — page {p}')`
  (D-UI-10 : la fiche le garde ; T3 ne le retire pas) : `tests/table-matieres.js:1672` reste vraie telle quelle (Step 2, point 5).

- [ ] **Step 1 : tests rouges — `tests/carnet.js`**, bloc « Tâche 5 » inséré dans `runCarnetTests` AU-DESSUS du repère de fin posé par T1
  (`// --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette ligne ---`), après le bloc de T4. Le bloc tient dans sa propre
  accolade : ses helpers sont locaux (son `lire` masque celui de T1 sans le toucher), il n'emploie du fichier que `bloc`, `eq`, `ok` — `bloc(nom, f)` est le
  lanceur de T1 (try/catch → `ok(false, …)`). Scènes hors écran mais visibles (le focus et les mesures l'exigent), bases jetables (`withRepo`), `fetch` remplacé par un
  lanceur d'erreur et remis en `finally`, gestes injectés, aucune écriture dans la bibliothèque, jamais le navigateur partagé. Textes français affirmés :
  la locale est forcée à `fr` puis remise. Un caractère hostile n'est jamais écrit en littéral (aucun ici).

```js
    // ===== Tâche 5 — Aujourd'hui, Ajouter, import ciblé, libellés dérivés (spec experience-carnet § 4.4, § 4.5, D-UI-9, D-UI-10, § 5 ; § 7 T5)
    {
      const { withRepo } = await import('./sync-fixture.js');
      const { sha256Hex } = await import('../src/core/hash.js');
      const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
      const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
      const H = (c) => c.repeat(64); // une empreinte lisible : H('b') = « bbbb… » (64)
      const DATE = '2026-10-23T12:00:00.000Z';
      const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
      // Une image de test : un aplat et un coin clair ; un File, comme un sélecteur de fichiers.
      const imageTest = async (nom, couleur, l = 320, h = 240) => { const toile = new OffscreenCanvas(l, h); const cx = toile.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); cx.fillStyle = '#fff'; cx.fillRect(0, 0, l >> 2, h >> 2); return new File([await toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' }); };
      const nouvelleScene = (largeur = 900) => { const s = document.createElement('div'); s.style.cssText = `position:absolute;left:-10000px;top:0;width:${largeur}px`; document.body.append(s); return s; };
      const bouton = (racine, texte) => [...(racine?.querySelectorAll('button') || [])].find((b) => b.textContent === texte) || null;
      const sectionNommee = (racine, titre) => [...racine.querySelectorAll('section')].find((s) => s.querySelector(':scope > h2')?.textContent === titre) || null;
      const avant = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const fiche = (id, over = {}) => ({ id, edition_id: null, original_title: 'Plat ' + id, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE, ...over });
      const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: 10, cook_minutes: 25, active_minutes: null, total_minutes: null,
        ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }, { id: 'st2_' + rid, position: 2, text: 'Servir.' }],
        constraints: {}, changes: '', notes: '', provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: null, convention_snapshot: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
      const localeAvantT5 = getUiLocale(); setUiLocale('fr');
      try {
        await bloc('T5 — Aujourd’hui : en-tête, barre hors carte, puces, grilles de cartes-plat, UNE passe getFiles, cuissons hors du <a>, sections plain (§ 4.4)', () => withRepo(async (repo, db) => {
          const { renderHome } = await import('../src/ui/home.js');
          const { buildDocs } = await import('../src/domain/search.js');
          const { formatDate } = await import('../src/core/dom.js');
          const BU = await import('../src/core/blob-urls.js');
          const scene = nouvelleScene();
          const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
          try {
            const jpeg = await imageTest('fav.jpg', '#c63'); const sha = await sha256Hex(jpeg);
            await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
            // Quatre fiches : deux favorites (octets ici / pointeur sans octets), une cuisinée ni favorite ni illustrée, une ni favorite ni cuisinée AVEC pointeur (jamais lue).
            const recettes = [fiche('rc_f1', { favorite: true, photo_sha256: sha }), fiche('rc_f2', { favorite: true, photo_sha256: H('b') }), fiche('rc_c1'), fiche('rc_x', { photo_sha256: H('c') })];
            const versions = recettes.map((r) => version(r.id));
            const histoire = [
              { id: 'ch1', recipe_id: 'rc_c1', recipe_version_id: 'rv_rc_c1', cooked_at: '2026-10-22T18:00:00.000Z', servings: 2, rating: 2, redo: true },
              { id: 'ch2', recipe_id: 'rc_f1', recipe_version_id: 'rv_rc_f1', cooked_at: '2026-10-21T18:00:00.000Z', servings: 4, rating: null, redo: false },
              { id: 'ch3', recipe_id: 'rc_absente', recipe_version_id: null, cooked_at: '2026-10-20T18:00:00.000Z' }]; // une cuisson d'une fiche inconnue : pas rendue (comme avant)
            const docs = buildDocs({ recipes: recettes, versions, editions: [], books: [], dishes: [], links: [], translations: [], history: histoire });
            const ctx = { recipes: recettes, docs, docsByRecipe: new Map(docs.map((d) => [d.recipe.id, d])), cook_history: histoire,
              cook_sessions: [{ id: 'cs1', recipe_id: 'rc_c1', status: 'active', updated_at: DATE, progress: { total_steps: 2, done_step_ids: ['st_rc_c1'] } }],
              inventory: [{ id: 'inv1', label: 'Épinards', quantity_text: '1 sac', use_by: new Date(Date.now() + 86400000).toISOString() }],
              settings: { rediscover_enabled: false }, book_editions: [], books: [], library_activity: [], rediscovery_prefs: [] };
            // L'espion compte les lectures de fichiers : UNE passe getFiles sur les cartes rendues, jamais un getFile par carte (D-UI-5, F-3).
            const appels = []; const depot = { ...repo, getFiles: async (shas) => { appels.push([...shas]); return repo.getFiles(shas); }, getFile: async (s) => { appels.push(['getFile', s]); return repo.getFile(s); } };
            const root = await renderHome({}, {}, ctx, { repo: depot });
            scene.append(root);
            const entete = root.querySelector(':scope > header'); const barre = root.querySelector('.search-bar'); const puces = root.querySelector('.chips');
            eq([entete?.querySelector('h1')?.textContent, entete?.querySelector('p.muted')?.textContent, root.querySelectorAll('.card.sage').length, !!barre?.closest('.card'), !!puces?.closest('.card'), avant(entete, barre), avant(barre, puces),
              barre?.querySelector('input[type="search"]')?.getAttribute('placeholder'), bouton(barre, 'Chercher')?.classList.contains('primary'), puces?.querySelectorAll('.chip.clickable').length],
              ['Qu’est-ce qu’on cuisine ?', 'Cherche une recette, un ingrédient, une envie.', 0, false, false, true, true, 'Qu’est-ce qu’on cuisine ?', true, 4],
              'Aujourd’hui : pageHeader (titre, sous-titre § 5) puis .search-bar hors de toute .card (plus de .card.sage), puis les quatre puces d’exemple hors de toute carte ; « Chercher » reste primaire, le placeholder est inchangé');
            const favoris = sectionNommee(root, 'Favoris'); const grilleF = favoris?.querySelector('.grille-plats');
            const cartesF = [...(grilleF?.querySelectorAll('a.item-link.carte-plat') || [])];
            const parHref = (cartes, id) => cartes.find((c) => c.getAttribute('href') === `#/recipes/${id}`) || null;
            const avecPhoto = parHref(cartesF, 'rc_f1'); const sansOctets = parHref(cartesF, 'rc_f2');
            eq([favoris?.className, cartesF.length, !!avecPhoto?.querySelector('img.plat-vignette.grande'), avecPhoto?.querySelector('img.plat-vignette.grande')?.getAttribute('src')?.startsWith('blob:'), avecPhoto?.classList.contains('sans-photo'), sansOctets?.classList.contains('sans-photo'), sansOctets?.querySelectorAll('img').length, favoris?.querySelectorAll('a.item-link.card').length],
              ['plain', 2, true, true, false, true, 0, 0],
              'Favoris : section.plain > div.grille-plats de cartes-plat ; octets ici → img.plat-vignette.grande en blob: (décision synchrone) ; pointeur sans octets → .sans-photo sans aucune img (I-UI-5) ; aucune carte horizontale');
            eq([appels.length, appels[0] ? [...new Set(appels[0])].sort() : null, appels.filter((a) => a[0] === 'getFile').length], [1, [H('b'), sha].sort(), 0],
              'Aujourd’hui : UNE passe repo.getFiles, sur les empreintes des cartes RENDUES seulement (rc_f1 et rc_f2 ; rc_x, ni favorite ni cuisinée, n’est jamais lue) ; zéro getFile carte par carte (D-UI-5, F-3, I-UI-5)');
            const cuissons = sectionNommee(root, 'Dernières cuissons');
            const cellules = [...(cuissons?.querySelectorAll('.grille-plats .cellule-cuisson') || [])];
            const celluleDe = (id) => cellules.find((c) => c.querySelector('a.carte-plat')?.getAttribute('href') === `#/recipes/${id}`) || null;
            const refaire = (cell) => [...(cell?.querySelectorAll('a.btn') || [])].find((a) => a.textContent === 'Refaire comme la dernière fois') || null;
            const c1 = celluleDe('rc_c1'); const carte1 = c1?.querySelector('a.carte-plat'); const date1 = c1?.querySelector('.cuisson-date'); const r1 = refaire(c1);
            eq([cuissons?.className, cellules.length, !!carte1, !!date1 && !carte1.contains(date1), !!r1 && !carte1.contains(r1), date1?.textContent, r1?.getAttribute('href'), r1?.className, avant(carte1, date1), avant(date1, r1)],
              ['plain', 2, true, true, true, `${formatDate('2026-10-22T18:00:00.000Z')} · ★★`, '#/recipes/rc_c1?v=rv_rc_c1&servings=2', 'btn small', true, true],
              'Dernières cuissons : section.plain > grille de 2 cellules (la cuisson d’une fiche inconnue n’est pas rendue) ; la date (★★) puis « Refaire comme la dernière fois » (même href qu’avant) sont HORS du <a> de la carte, sous elle, dans la cellule (§ 4.4, H-16)');
            const c2 = celluleDe('rc_f1');
            eq([c2?.querySelector('.cuisson-date')?.textContent, !!c2?.querySelector('a.carte-plat img.plat-vignette.grande'), refaire(c2)?.getAttribute('href')],
              [`${formatDate('2026-10-21T18:00:00.000Z')} · à ne pas refaire`, true, '#/recipes/rc_f1?v=rv_rc_f1&servings=4'],
              'Dernières cuissons : « à ne pas refaire » sur la date ; la carte-plat d’une cuisson porte sa photo (la même passe getFiles sert favoris et cuissons)');
            eq([sectionNommee(root, 'Reprendre ma recette')?.className, !!sectionNommee(root, 'Reprendre ma recette')?.querySelector('a.item-link.card.flat[href="#/cook/cs1"]'), sectionNommee(root, 'À utiliser en priorité')?.className, !!sectionNommee(root, 'À utiliser en priorité')?.querySelector('a.btn.small[href="#/kitchen?tab=inventory"]'), sectionNommee(root, 'Bienvenue')],
              ['plain', true, 'plain', true, null],
              'Aujourd’hui : « Reprendre ma recette » et « À utiliser en priorité » en section.plain, contenu inchangé ; pas de « Bienvenue » quand la bibliothèque a des recettes');
            const vide = await renderHome({}, {}, { ...ctx, recipes: [], docs: [], docsByRecipe: new Map(), cook_sessions: [], cook_history: [], inventory: [] }, { repo: depot });
            eq([sectionNommee(vide, 'Bienvenue')?.className, !!sectionNommee(vide, 'Bienvenue')?.querySelector('a.btn.primary[href="#/add"]'), appels.length, vide.querySelectorAll('.grille-plats').length], ['card', true, 1, 0],
              'Aujourd’hui vide : « Bienvenue » reste une section.card avec « Ajouter » primaire ; sans carte rendue, aucune lecture de fichiers de plus ; aucune grille');
          } finally { globalThis.fetch = vraiFetch; scene.remove(); BU.revoquerUrlsDeBlob(); }
        }));

        await bloc('T5 — libellés D-UI-10 : availabilityBadge courts, « À importer » seulement pour reference_only sans adresse, STATE_LABELS, en.js, compteurs', () => withRepo(async (repo, db) => {
          const { availabilityBadge } = await import('../src/ui/components.js');
          const { label } = await import('../src/core/i18n.js');
          const { EN } = await import('../src/i18n/en.js');
          const { renderLibrary } = await import('../src/ui/library.js');
          const badge = (r) => { const b = availabilityBadge(r); return [b.className, b.textContent]; };
          eq([badge({ availability: 'reference_only', printed_page: 12 }), badge({ availability: 'reference_only' }), badge({ availability: 'reference_only', printed_page: 0 }), badge({ availability: 'reference_only', source_url: 'https://a.test/' }),
            badge({ availability: 'available' }), badge({ availability: 'available', source_url: 'https://a.test/' }), badge({ availability: 'partial' }), badge({ availability: 'partial', source_url: 'https://a.test/', printed_page: 3 }), badge({})],
            [['badge reference', 'À importer · p. 12'], ['badge reference', 'À importer'], ['badge reference', 'À importer'], ['badge reference', 'Lien web'], ['badge available', 'Disponible'], ['badge available', 'Disponible'], ['badge partial', 'Partielle'], ['badge partial', 'Partielle'], ['badge reference', '']],
            'availabilityBadge : textes courts — « À importer · p. {p} » (page > 0) / « À importer », « Lien web » (signet), « Disponible », « Partielle » ; classes inchangées ; availability inconnue → badge reference vide, comme avant (D-UI-10, H-19)');
          const porteurs = [];
          for (const availability of ['available', 'partial', 'reference_only', undefined]) for (const source_url of [null, 'https://a.test/x']) { if (availabilityBadge({ availability, source_url, printed_page: 7 }).textContent.startsWith('À importer')) porteurs.push([availability, source_url]); }
          eq(porteurs, [['reference_only', null]], '« À importer » n’apparaît que pour reference_only SANS source_url (huit combinaisons) — mutant « posé sur une available » : rouge');
          eq([label('availability', 'reference_only'), label('availability', 'available'), label('availability', 'partial')], ['À importer', 'Recette disponible', 'Partiellement disponible'],
            'STATE_LABELS.availability : seule reference_only change (« À importer », suivie par les exports et Redécouvrir) ; available et partial gardent leur libellé long (D-UI-10, H-19)');
          setUiLocale('en');
          try {
            eq([label('availability', 'reference_only'), availabilityBadge({ availability: 'reference_only', printed_page: 12 }).textContent, availabilityBadge({ availability: 'available' }).textContent, availabilityBadge({ availability: 'partial' }).textContent, availabilityBadge({ availability: 'reference_only' }).textContent],
              ['To import', 'To import · p. 12', 'Available', 'Partial', 'To import'], 'interface anglaise : « To import », « To import · p. 12 », « Available », « Partial » (§ 5)');
          } finally { setUiLocale('fr'); }
          eq(['À importer', 'À importer · p. {p}', 'Disponible', 'Partielle', 'Cherche une recette, un ingrédient, une envie.', 'Page {n} · p. {p}', '{n} à importer'].map((k) => EN[k]),
            ['To import', 'To import · p. {p}', 'Available', 'Partial', 'Search a recipe, an ingredient, a craving.', 'Page {n} · p. {p}', '{n} to import'], 'en.js : les sept clés de la tâche portent l’anglais de la spec § 5');
          // Compteur library.js:73 (grille Livres) : « {n} à importer » à la place de « {n} repérée(s) » ; base jetable (renderLibrary lit repo.getFiles pour les couvertures).
          const ed = { id: 'ed_k', book_id: 'b_k', year: 2020 }; const livre = { id: 'b_k', title: 'Mon livre', author: 'A. B.', cuisines: [], tags: [] };
          const refs = [fiche('rc_k1', { edition_id: 'ed_k' }), fiche('rc_k2', { edition_id: 'ed_k', availability: 'reference_only', verification_state: 'unverified', current_version_id: null, printed_page: 12 }), fiche('rc_k3', { edition_id: 'ed_k', availability: 'reference_only', verification_state: 'unverified', current_version_id: null, printed_page: 40 })];
          const ctxL = { book_editions: [ed], books: [livre], booksById: new Map([['b_k', livre]]), editionsById: new Map([['ed_k', ed]]), recipes: refs, recipe_versions: [], recipesById: new Map(refs.map((r) => [r.id, r])), docs: [], docsByRecipe: new Map(),
            rediscovery_prefs: [], dishes: [], dish_recipe_links: [], source_documents: [], source_pages: [], scan_sessions: [], settings: {}, sync: {}, editionLabel: () => livre.title };
          const biblio = await renderLibrary({}, { tab: 'books' }, ctxL);
          const legende = [...biblio.querySelectorAll('.muted')].map((n) => n.textContent).find((x) => x.includes('à importer')) ?? null;
          eq([legende, /repérée/i.test(biblio.textContent)], ['1 disponible(s) · 2 à importer', false], 'library.js (grille Livres, l. 73) : « {n} disponible(s) · {m} à importer » sous la couverture ; plus aucun « repérée(s) »');
          const [srcBook, srcLib] = await Promise.all(['../src/ui/book.js', '../src/ui/library.js'].map(lire));
          eq([srcBook.length > 1000, srcLib.length > 1000, [srcBook, srcLib].map((s) => (s.match(/t\('[^']*epérée[^']*'/g) || []).length)], [true, true, [0, 0]],
            'book.js (compteur et filtre) et library.js : plus aucun t(\'…repérée(s)…\') ni t(\'Repérées\') dans le source (lus, non vides) — les libellés sont « À importer / à importer » (D-UI-10 ; § 7 T5)');
        }));

        await bloc('T5 — icônes au trait : la grille Ajouter et l’accueil d’un livre (D-UI-9)', async () => {
          const A = await import('../src/ui/add.js');
          const AL = await import('../src/ui/accueil-livre.js');
          eq(A.grilleModel().cartes.map((c) => c.ico), ['livres', 'appareil-photo', 'crayon', 'lien', 'etincelle', 'flocon'], 'grilleModel : ico = le NOM d’une icône d’icones.js, dans l’ordre des six cartes (plus d’émoji)');
          const gestes = Object.fromEntries(A.GRILLE_ACTIONS.map((a) => [a, () => {}]));
          const grille = A.renderGrille(A.grilleModel(), gestes);
          const svgs = [...grille.querySelectorAll('button.carte .carte-ico > svg')];
          eq([grille.querySelectorAll('button.carte').length, svgs.length, svgs.every((s) => s.getAttribute('aria-hidden') === 'true' && s.getAttribute('focusable') === 'false'), [...grille.querySelectorAll('.carte-ico')].every((n) => n.textContent.trim() === '')], [6, 6, true, true],
            'renderGrille : chaque .carte-ico porte un svg[aria-hidden=true][focusable=false] et aucun texte (plus d’émoji) ; six cartes');
          const m = AL.accueilLivreModel({ nouveau: '1' });
          eq(m.cartes.map((c) => c.ico), ['appareil-photo', 'page', 'horloge'], 'accueilLivreModel : ico = appareil-photo, page, horloge (D-UI-9, § 3.3)');
          const panneau = AL.renderAccueilLivre(m, {});
          eq([panneau.querySelectorAll('button.carte .carte-ico > svg').length, [...panneau.querySelectorAll('.carte-ico')].every((n) => n.textContent.trim() === '')], [3, true], 'renderAccueilLivre : trois svg, aucun émoji');
          let leve = null;
          try { A.renderGrille({ cartes: [{ action: 'pages', ico: 'inconnue', titre: 'x', sousTitre: 'y' }] }, { pages: () => {} }); } catch (e) { leve = e?.name || String(e); }
          eq(leve, 'TypeError', 'renderGrille : un nom d’icône inconnu lève TypeError (icone(nom), T1) — jamais une carte sans pictogramme en silence');
        });

        await bloc('T5 — import ciblé : badge « À importer » / « Partielle », × en coin de la vignette (nom accessible, ≥ 44 px), légende « Page 1 · p. 76 » et champ ouvert à la tape, Monter / Descendre inchangés (§ 4.5)', () => withRepo(async (repo, db) => {
          const UI = await import('../src/ui/import-cible.js');
          const BU = await import('../src/core/blob-urls.js');
          const scene = nouvelleScene();
          // La feuille servie, injectée le temps du bloc (comme tests/theme.js) : la cible du × se MESURE (I-UI-4), elle ne se lit pas dans un attribut.
          const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../styles.css?v=' + Date.now();
          await new Promise((r) => { link.onload = r; link.onerror = r; document.head.append(link); });
          const vraiFetch = globalThis.fetch; let reseau = 0; globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
          const NOW = '2026-10-23T12:00:00.000Z';
          const livre = { id: 'b5', title: 'Mon livre', author: 'A. B.', updated_at: DATE }; const edition = { id: 'ed5', book_id: 'b5', language: 'fr', updated_at: DATE };
          const ref = (id, over = {}) => fiche(id, { edition_id: 'ed5', original_title: 'Tarte aux pommes', availability: 'reference_only', verification_state: 'unverified', printed_page: 132, current_version_id: null, ...over });
          const manuelle = version('rc_t5p', { provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: 'ed5', convention_snapshot: null } });
          await db.mutate({ puts: { books: [livre], book_editions: [edition], recipes: [ref('rc_t5'), ref('rc_t5p', { availability: 'partial', verification_state: 'verified', current_version_id: 'rv_rc_t5p' })], recipe_versions: [manuelle] }, origin: 'device' });
          const SESSION = { access_token: 'jeton-carnet-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
          const ctxDe = async () => { const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions'); return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])), editionsById: new Map([['ed5', edition]]), booksById: new Map([['b5', livre]]), books: [livre], book_editions: [edition], pagesById: new Map(), imports: await db.getAll('imports'), settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' }, sync: { user: SESSION.user, auth: { jeton: async () => SESSION } }, conventionFor: () => null }; };
          const pick = { suivant: [] }; const pickFiles = async () => (pick.suivant.length ? pick.suivant.shift() : []);
          const navs = [], dits = [];
          const monter = async (id) => { const root = await UI.renderImportCible({ id }, {}, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: async () => { reseau += 1; throw new Error('aucun appel attendu'); }, pickFiles, maintenant: () => NOW }); scene.append(root); return root; };
          try {
            const root = await monter('rc_t5');
            eq([...root.querySelectorAll('.badge')].map((b) => [b.className, b.textContent]), [['badge reference', 'À importer']], 'écran d’import : badge « À importer » sur une référence — le sous-titre porte déjà « Mon livre · p. 132 » (§ 4.5, D-UI-10)');
            pick.suivant.push([await imageTest('a.jpg', '#c33'), await imageTest('b.jpg', '#3c3')]);
            bouton(root, 'Choisir des photos').click();
            await attendre(() => root.etatRoute().pageIds.length === 2, 'deux pages ajoutées');
            const [p1, p2] = root.etatRoute().pageIds;
            const figures = [...root.querySelectorAll('.thumbs figure')]; const fig1 = figures[0];
            const croix = fig1?.querySelector(':scope > button[data-role="retirer"]'); const legende = fig1?.querySelector('button[data-role="legende"]'); const champ = fig1?.querySelector('input[type="number"]');
            eq([figures.length, croix?.textContent, croix?.getAttribute('aria-label'), croix?.dataset.page, croix?.classList.contains('retirer'), legende?.textContent, legende?.dataset.page, legende?.getAttribute('aria-expanded'), champ?.hidden, !!bouton(root, 'Monter la page 1'), !!bouton(root, 'Descendre la page 1'), bouton(root, 'Retirer la page 1')],
              [2, '×', 'Retirer la page 1', p1, true, 'Page 1', p1, 'false', true, true, true, null],
              'vignette : le × (button.btn.retirer, data-role retirer) est enfant direct de la figure, nom accessible « Retirer la page 1 » ; légende « Page 1 » (pas de numéro imprimé) ; champ « p. imprimée » né hidden ; Monter / Descendre inchangés ; plus aucun bouton au TEXTE « Retirer la page 1 »');
            const r = croix.getBoundingClientRect(); const rf = fig1.getBoundingClientRect();
            ok(r.width >= 44 && r.height >= 44 && r.right <= rf.right + 1 && r.top >= rf.top - 1 && r.left > rf.left, `× : cible ${Math.round(r.width)} × ${Math.round(r.height)} ≥ 44 px, dans le coin supérieur droit de la vignette (feuille servie injectée ; I-UI-4)`);
            legende.click();
            eq([champ.hidden, document.activeElement === champ, legende.getAttribute('aria-expanded')], [false, true, 'true'], 'légende : la tape ouvre le champ « p. imprimée » et lui donne le focus (aria-expanded true)');
            champ.value = '76'; champ.dispatchEvent(new Event('change', { bubbles: true }));
            await attendre(async () => (await db.get('source_pages', p1)).printed_page === 76, 'p. imprimée écrite');
            eq([legende.textContent, legende.getAttribute('aria-expanded'), champ.hidden, (await db.get('source_pages', p1)).printed_page, root.etatRoute().pageIds, root.querySelector('button[data-role="legende"]') === legende],
              ['Page 1 · p. 76', 'false', true, 76, [p1, p2], true],
              'légende : après la saisie, « Page 1 · p. 76 » réécrite SUR PLACE (le même nœud : aucun redessin, page_ids intacts), le champ se referme ; source_pages.printed_page écrit');
            legende.click(); champ.value = '0'; champ.dispatchEvent(new Event('change', { bubbles: true }));
            await attendre(() => champ.value === '76', 'champ remis à la valeur courante');
            eq([legende.textContent, champ.hidden, (await db.get('source_pages', p1)).printed_page], ['Page 1 · p. 76', false, 76], 'légende : une saisie illisible (« 0 ») n’écrit rien, la légende garde « p. 76 », le champ reste ouvert pour corriger (T4-R1 du lot A tenu)');
            croix.click();
            await attendre(() => root.etatRoute().pageIds.length === 1, 'page retirée');
            const apres = [...root.querySelectorAll('.thumbs figure')];
            eq([root.etatRoute().pageIds, apres.length, apres[0]?.querySelector('button[data-role="retirer"]')?.getAttribute('aria-label'), apres[0]?.querySelector('button[data-role="legende"]')?.textContent, reseau, dits],
              [[p2], 1, 'Retirer la page 1', 'Page 1', 0, []],
              '× : « Retirer la page 1 » détache p1 (même geste qu’avant : la ligne source_pages reste) ; la vignette restante est renumérotée « Page 1 » (× et légende) ; aucun réseau, aucun toast');
            const partielle = await monter('rc_t5p');
            eq([...partielle.querySelectorAll('.badge')].map((b) => [b.className, b.textContent]), [['badge partial', 'Partielle']], 'écran d’import : badge « Partielle » sur une fiche partial (§ 4.5, D-UI-10)');
            // styles.css : les deux règles neuves de l'écran, lues sans commentaires (T-1, T-2, T-11 : ni display:none, ni couleur en dur, ni 56px, ni :hover hors @media).
            const css = (await lire('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
            const croixCss = css.match(/(?:^|\})\s*\.thumbs \.btn\.retirer\s*\{([^}]*)\}/)?.[1] ?? null;
            const legCss = css.match(/(?:^|\})\s*\.thumbs \.legende\s*\{([^}]*)\}/)?.[1] ?? null;
            eq([croixCss !== null, /position:\s*absolute/.test(croixCss || ''), /min-width:\s*44px/.test(croixCss || ''), /min-height:\s*44px/.test(croixCss || ''), legCss !== null, [croixCss, legCss].some((x) => /display\s*:\s*none|#[0-9a-f]{3,8}\b|56px|:hover/i.test(x || ''))],
              [true, true, true, true, true, false], 'styles.css : .thumbs .btn.retirer (position absolute, min-width et min-height 44px) et .thumbs .legende sont trouvées ; ni display:none, ni couleur en dur, ni 56px, ni :hover (T-1, T-2, T-11)');
          } finally { globalThis.fetch = vraiFetch; if (UI.volEnCours()) UI.reinitialiserImportCible(); scene.remove(); link.remove(); BU.revoquerUrlsDeBlob(); }
        }));
      } finally { setUiLocale(localeAvantT5); }
    }
```

  Compte des assertions neuves : **28** (7 + 7 + 5 + 9), toutes dans quatre `bloc` ; un `bloc` qui lève remplace ses assertions par UN `ok(false)`.

- [ ] **Step 2 : amendements des tests existants** (spec § 7 T5 ; chacun retrouvé par son TEXTE, amendé, jamais retiré) :

  1. `tests/ajouter.js:1133` — la pastille d'une référence d'index :

```js
    // avant
    eq(availabilityBadge({ availability: 'reference_only', printed_page: 12 }).textContent, 'Repérée dans ton livre — page 12', 'pastille : les références d’index inchangées');
    // après (lot UI-1 « Carnet », D-UI-10 : le badge porte un texte court ; la fiche garde « Repérée dans ton livre — page {p} »)
    eq(availabilityBadge({ availability: 'reference_only', printed_page: 12 }).textContent, 'À importer · p. 12', 'pastille : une référence d’index dit « À importer · p. 12 » (D-UI-10, lot Carnet T5)');
```

  2. `tests/ajouter.js:3807` — le rendu hostile de la grille : `ico` est désormais un NOM d'icône, `icone('x')` lèverait :

```js
    // avant
    const n1 = renderGrille({ cartes: [{ action: 'pages', ico: 'x', titre: hostile, sousTitre: hostile }] }, { pages: () => {} });
    // après
    const n1 = renderGrille({ cartes: [{ action: 'pages', ico: 'appareil-photo', titre: hostile, sousTitre: hostile }] }, { pages: () => {} }); // lot Carnet T5 : ico = un nom d'icône (icone(nom) lève sur un inconnu)
```

  3. `tests/import-cible.js:668`, `:912` (badges de l'écran) et `:713` (le × porte le nom accessible, pas le texte) :

```js
    // :668 avant
        eq([...root.querySelectorAll('.badge')].map((b) => b.textContent), ['Repérée dans ton livre'], 'ouverture : badge « Repérée dans ton livre »');
    // :668 après
        eq([...root.querySelectorAll('.badge')].map((b) => b.textContent), ['À importer'], 'ouverture : badge « À importer » (D-UI-10, lot Carnet T5)');
    // :713 avant
        bouton(root, 'Retirer la page 2').click();
    // :713 après
        root.querySelector('button[data-role="retirer"][aria-label="Retirer la page 2"]').click(); // lot Carnet T5 : le × en coin porte le nom accessible « Retirer la page 2 », son texte est « × »
    // :912 avant
        eq([...root.querySelectorAll('.badge')].map((b) => b.textContent), ['Partiellement disponible'], 'I-5 : une partial porte son badge');
    // :912 après
        eq([...root.querySelectorAll('.badge')].map((b) => b.textContent), ['Partielle'], 'I-5 : une partial porte son badge court « Partielle » (D-UI-10, lot Carnet T5)');
```

  Les autres lectures des vignettes de cette suite tiennent sans changement : `button[data-role="retirer"][data-page=…]` (l. 1356), le compte de
  `[data-role="retirer"]` (l. 792, 883, 1387, 1390 : le × est absent quand les pages sont figées, comme l'ancien bouton), le champ
  `.thumbs figure input[type="number"]` (l. 717, 726 : trouvé même `hidden`, sa saisie écrit toujours). `tests/classement.js` (« Retirer la page n »
  de l'écran de regroupement, l. 954, 1431, 1615) n'est pas touché : c'est `regroupement.js`, hors de cette tâche.

  4. `tests/creer-ia.js:1089` — la carte « Créer avec l'IA » de la grille :

```js
    // avant
        eq([carteIA?.ico, carteIA?.titre, carteIA?.sousTitre, A.grilleModel().cartes.map((c) => c.action).indexOf('creerIA'), A.grilleModel().cartes.length], ['✨', 'Créer avec l’IA', 'Une proposition à vérifier', 4, 6], 'porte Ajouter : la carte ✨ « Créer avec l’IA » est la cinquième, juste avant le congélateur');
    // après (D-UI-9 : ico = le nom de l'icône au trait)
        eq([carteIA?.ico, carteIA?.titre, carteIA?.sousTitre, A.grilleModel().cartes.map((c) => c.action).indexOf('creerIA'), A.grilleModel().cartes.length], ['etincelle', 'Créer avec l’IA', 'Une proposition à vérifier', 4, 6], 'porte Ajouter : la carte « étincelle » « Créer avec l’IA » est la cinquième, juste avant le congélateur (icône au trait, lot Carnet T5)');
```

  5. `tests/table-matieres.js:1672` — RELUE, inchangée : la liste des clés réemployées porte `'Repérée dans ton livre — page {p}'`, que la fiche d'une
  référence (`src/ui/recipe.js:315`) emploie toujours (D-UI-10 : « reste sur la fiche ») ; l'entrée `en.js` reste. Si le Step 0 (g) montre que T3 l'a
  retirée de `recipe.js`, retirer la clé de cette liste ET d'`en.js` (amendement nommé) ; sinon rien. Le filet `MODULES_NEUFS` de `tests/import-cible.js:2921`
  (cité par § 7 T5 comme « `CHAINES_NEUVES_AILLEURS` d'import-cible.js ») ne change pas : `import-cible.js` est scanné en entier, ses chaînes neuves
  (« À importer », « Partielle », « Page {n} · p. {p} ») n'ont besoin que de leur entrée `en.js` (Step 4).

  6. `tests/ajouter.js:24-49` — `CHAINES_NEUVES_AILLEURS` (le filet i18n qui exige une entrée `en.js` pour chaque chaîne neuve hors `MODULES_NEUFS`) :

```js
  '../src/ui/components.js': ['Lien web', 'Adresse non reconnue', 'incertain', 'Ligne incertaine selon l’assistant',
    // (… lignes existantes inchangées …)
    'Page', 'Télécharger', 'Téléchargement…', 'Télécharger les {n} pages', 'Le téléchargement n’a pas abouti.', 'Pas encore sur cet appareil', 'Connecte-toi pour la télécharger', 'Pas encore envoyée par l’appareil qui l’a prise', 'Pas encore reçue', 'Fichier illisible reçu du serveur.',
    // Lot UI-1, tâche 2 : la ligne de source de la carte-plat (ligneSource).
    'Du web · {h}', 'De mon livre · {t}',
    // Lot UI-1, tâche 3 : « Voir la page d’origine » (D-UI-10, I-B5), une définition pour la fiche, le bloc du signet et l'écran d'import web.
    'Voir la page d’origine',
    // Lot UI-1 « Carnet », tâche 5 : les textes courts d'availabilityBadge (D-UI-10).
    'À importer', 'À importer · p. {p}', 'Disponible', 'Partielle'],
  // ('../src/ui/search.js' — lot B — puis '../src/ui/library.js' — posée par T2, complétée ci-dessous — s'intercalent ici, inchangées, dans cet ordre.)
  // Lot UI-1 « Carnet », tâche 5 : le sous-titre d'Aujourd'hui (§ 4.4).
  '../src/ui/home.js': ['Cherche une recette, un ingrédient, une envie.'],
```

  et, dans le tableau `'../src/ui/library.js'` posé par T2 (douze chaînes, après `'Aucune recette pour l’instant.'`), avant son `],` (A-8) :

```js
    // Lot UI-1, tâche 5 : le compteur de la grille Livres (library.js:73).
    '{n} à importer'],
```

  (la ligne `'../src/ui/components.js'` reçoit les quatre textes à la FIN de son tableau existant, après `'Voir la page d’origine'` (T3) ; la clé `home.js`
  s'ajoute après `'../src/ui/library.js'` (T2) — Step 0 (d)).

- [ ] **Step 3 : rouge lu** (`node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096`, le worktree servi par `python3 -m http.server 8096 --bind 127.0.0.1`) :
  chaque rouge l'est pour la BONNE raison, lue dans la sortie du lanceur (« obtenu / attendu ») :
  - « T5 — Aujourd’hui » : rouge sur la première assertion (`.card.sage` compte 1, pas de `header` direct, puces dans la carte) ; `renderHome` ignore le
    4e paramètre : `appels` reste vide ; « Favoris » rend `section.card` et des `a.item-link.card`.
  - « T5 — libellés » : `availabilityBadge` rend « Repérée dans ton livre — page 12 », « Recette disponible », « Partiellement disponible » ;
    `label('availability', 'reference_only')` rend « Repérée dans ton livre » ; `EN['À importer']` est `undefined` ; la légende de la grille Livres dit
    « 2 repérée(s) » ; les `t('…repérée…')` du source comptent 0 dans `book.js` (T4 les a retirés : D-10) et 1 dans `library.js` — c'est `library.js:73` qui
    rougit cette assertion.
  - « T5 — icônes » : `grilleModel().cartes[].ico` sont les six émojis ; `.carte-ico > svg` compte 0 ; « nom inconnu lève » : `renderGrille` ne lève pas
    (`leve === null`).
  - « T5 — import ciblé » : badge « Repérée dans ton livre » ; `fig1.querySelector(':scope > button[data-role="retirer"]')` est `null` (le bouton vit dans la
    `figcaption`), pas de `legende`, le champ n'est pas `hidden`, `bouton(root, 'Retirer la page 1')` existe ; l'assertion de mesure rougit sur
    `croix.getBoundingClientRect()` — `croix` nul : le `bloc` lève et rend UN `ok(false)` nommé (rouge par levée, pour la bonne raison : le × n'existe pas) ; « icônes » : « lève TypeError » obtenu `null`.
  - Les amendements du Step 2 rougissent sur l'ancien code : `tests/ajouter.js:1133` (obtenu « Repérée dans ton livre — page 12 »), `:3807` reste VERT
    (`ico: 'appareil-photo'` est une chaîne comme une autre pour l'ancien `carte`), `tests/import-cible.js:668`, `:912` (anciens textes), `:713` (le
    sélecteur `aria-label` ne trouve rien : `null.click()` lève, le bloc « pages » rougit par levée), `tests/creer-ia.js:1089` (obtenu `'✨'`).
  - Tout le reste VERT (la suite de T4 : 0 rouge hors ceux-ci et l'épingle). `node --test tools/*.test.mjs` et `--check` : inchangés (rien de cette tâche
    ne les touche).

- [ ] **Step 4 : implémenter les libellés — `src/ui/components.js`, `src/core/i18n.js`, `src/i18n/en.js`.** `availabilityBadge` (l. 33-39), fonction entière :

```js
export function availabilityBadge(recipe) {
  // Un signet web n'est pas une référence de livre : il n'y a pas de page de livre, il y a un lien (spec UX § 11, F8).
  if (recipe.availability === 'reference_only' && recipe.source_url) return el('span', { class: 'badge reference' }, t('Lien web'));
  // Lot UI-1 « Carnet » (D-UI-10, H-19) : le badge porte ses propres textes COURTS — listes, cartes, écran d'import. « Repérée dans ton livre — page {p} »
  // reste sur la FICHE (recipe.js), où il dit d'où la référence vient ; STATE_LABELS.availability (i18n.js) sert aux exports et à Redécouvrir.
  if (recipe.availability === 'reference_only') return el('span', { class: 'badge reference' }, recipe.printed_page ? t('À importer · p. {p}', { p: recipe.printed_page }) : t('À importer'));
  if (recipe.availability === 'available') return el('span', { class: 'badge available' }, t('Disponible'));
  if (recipe.availability === 'partial') return el('span', { class: 'badge partial' }, t('Partielle'));
  return el('span', { class: 'badge reference' }, label('availability', recipe.availability)); // availability inconnue (fiche reçue ou restaurée) : comme avant, texte vide
}
```

  `src/core/i18n.js:27` : `reference_only: 'Repérée dans ton livre',` → `reference_only: 'À importer', // lot UI-1 « Carnet » (D-UI-10) : libellé d'affichage ; le badge porte ses textes courts, la fiche garde « Repérée dans ton livre — page {p} »` ;
  `partial` et `available` (l. 28-29) inchangés.

  `src/i18n/en.js` : à la FIN du dictionnaire (avant `};`), après le bloc « Lot F » ; une clé déjà présente (Step 0 (c)) n'est pas répétée :

```js
  // Lot UI-1 « Carnet » (spec experience-carnet § 5), tâche 5 : libellés courts d'availabilityBadge et de STATE_LABELS, sous-titre d'Aujourd'hui, légende d'une vignette, compteur de la grille Livres.
  "À importer · p. {p}": "To import · p. {p}",  // « À importer » → « To import » est déjà là (T2) : ne pas la répéter
  "Disponible": "Available",
  "Partielle": "Partial",
  "Cherche une recette, un ingrédient, une envie.": "Search a recipe, an ingredient, a craving.",
  "Page {n} · p. {p}": "Page {n} · p. {p}",
  "{n} à importer": "{n} to import",
```

  (Si, contre l'attendu, `'À importer'` manque encore à la tête de T4, elle s'ajoute ici : `"À importer": "To import",`.) Clé orpheline : si le Step 0 montre qu'aucun `t('…')` de `src/` ne porte plus `'{n} repérée(s)'` (en.js:23 : `'{n} repérée(s)': '{n} spotted'`)
  après le Step 7, cette entrée est RETIRÉE d'`en.js` (les chaînes retirées quittent `en.js`, § 5) — `'{n} repérée(s) dans l’index'` n'y a jamais eu d'entrée (book.js:163 l'appelait sans
  traduction ; T4 retire l'appel) : rien à retirer pour elle ; `'Repérée dans ton livre'` (en.js:11) et
  `'Repérée dans ton livre — page {p}'` restent (la seconde est employée par `recipe.js:315` ; la première reste citée par le commentaire de
  `import.js:292` et par `rediscover.js:69`, qui n'est pas un `t()` : la retirer n'est pas une exigence de la spec — la garder).

- [ ] **Step 5 : implémenter `src/ui/home.js`** — en-tête, imports et `renderHome` entière (l. 1-69 ; `rediscoverCard`, l. 71-95, et l'export final, l. 97,
  ne changent pas) :

```js
// Aujourd'hui : recherche, reprendre ma recette, Redécouvrir, favoris, dernières cuissons, ingrédients à utiliser (spec §17).
// Lot UI-1 « Carnet » (spec experience-carnet § 4.4, D-UI-5, D-UI-8) : pageHeader au-dessus de la barre (sur le papier, hors de toute carte), les puces
// d'exemple sous la barre ; « Favoris » et « Dernières cuissons » en grille de cartes-plat — UNE passe repo.getFiles sur les empreintes des cartes
// rendues, la carte ne lit rien elle-même (I-UI-5) ; la date et « Refaire comme la dernière fois » HORS du <a> de la carte (H-16) ; « Reprendre ma
// recette » et « À utiliser en priorité » en sectionPlain ; Redécouvrir (rediscoverCard) et « Bienvenue » ne changent que par le thème.
import { el, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { emit } from '../core/bus.js';
import { pickSuggestion, snoozeUntil } from '../domain/rediscover.js';
import { parseQuery } from '../domain/search.js';
import { recipeCard, section, sectionPlain, grilleCartes, pageHeader, emptyState, availabilityBadge, provenanceText } from './components.js';

// `deps.repo` : le sac injecté des routes (la suite y compte la passe getFiles) ; l'app ne passe rien et le module sert.
export async function renderHome(params, query, ctx, { repo: depot = repo } = {}) {
  const root = el('div', null);
  const input = el('input', { type: 'search', placeholder: t('Qu’est-ce qu’on cuisine ?'), 'aria-label': t('Recherche'), enterkeyhint: 'search' });
  const go = () => { if (input.value.trim()) navigate('/search' + buildQuery({ q: input.value.trim(), mode: 'all' })); else navigate('/search'); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.append(pageHeader(t('Qu’est-ce qu’on cuisine ?'), { subtitle: t('Cherche une recette, un ingrédient, une envie.') }),
    el('div', { class: 'recherche-accueil stack' },
      el('div', { class: 'search-bar' }, input, el('button', { class: 'btn primary', onClick: go }, t('Chercher'))),
      el('div', { class: 'chips' },
        ...['saumon fenouil', 'salade concombre sans gluten 15 minutes', 'soupe rapide', 'puttanesca'].map((ex) => el('span', { class: 'chip clickable', onClick: () => { input.value = ex; go(); } }, ex)))));

  // Reprendre ma recette
  const active = ctx.cook_sessions.filter((s) => s.status === 'active').sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  if (active.length) {
    root.append(sectionPlain(t('Reprendre ma recette'), ...active.slice(0, 3).map((s) => {
      const doc = ctx.docsByRecipe.get(s.recipe_id);
      const total = s.progress?.total_steps || doc?.version?.steps?.length || 0;
      const done = s.progress?.done_step_ids?.length || 0;
      return el('a', { class: 'item-link card flat', href: `#/cook/${s.id}` },
        el('div', { class: 'row between' }, el('strong', null, doc?.recipe.display_title || doc?.recipe.original_title || t('Recette')), el('span', { class: 'muted' }, t('{d}/{n} étapes', { d: done, n: total }))),
        el('div', { class: 'progress', style: { marginTop: '.4rem' } }, el('div', { style: { width: total ? `${Math.round(done / total * 100)}%` : '0%' } })));
    })));
  }

  // Redécouvrir
  if (ctx.settings.rediscover_enabled) root.append(await rediscoverCard(ctx, query));

  // Favoris et Dernières cuissons (D-UI-5, F-3) : les docs à rendre d'abord, puis UNE lecture groupée des lignes files de leurs photos — la carte-plat
  // reçoit sa ligne et décide au rendu (I-UI-5) ; sans empreinte, aucune lecture. Les URL blob: sont celles d'urlDeBlob : révoquées au changement de route (D-T9).
  const favs = ctx.docs.filter((d) => d.recipe.favorite).slice(0, 6);
  const recent = [...ctx.cook_history].sort((a, b) => (b.cooked_at || '').localeCompare(a.cooked_at || '')).slice(0, 4)
    .map((h) => ({ h, doc: ctx.docsByRecipe.get(h.recipe_id) })).filter((x) => x.doc); // une cuisson d'une fiche inconnue n'est pas rendue (comme avant)
  const empreintes = [...favs, ...recent.map((x) => x.doc)].map((d) => d.recipe.photo_sha256).filter((s) => typeof s === 'string' && s);
  const fichiers = empreintes.length ? await depot.getFiles(empreintes) : new Map();
  const cartePlat = (d) => recipeCard(d, { photoEnTete: true, fichier: fichiers.get(d.recipe.photo_sha256) ?? null });
  if (favs.length) root.append(sectionPlain(t('Favoris'), grilleCartes(favs.map(cartePlat))));

  // Dernières cuissons → Refaire comme la dernière fois : la date et le bouton HORS du <a> de la carte, sous elle, dans la cellule de grille (§ 4.4, H-16).
  if (recent.length) {
    root.append(sectionPlain(t('Dernières cuissons'), grilleCartes(recent.map(({ h, doc }) => el('div', { class: 'cellule-cuisson' },
      cartePlat(doc),
      el('div', { class: 'muted cuisson-date' }, `${formatDate(h.cooked_at)}${h.rating ? ` · ${'★'.repeat(h.rating)}` : ''}${h.redo === false ? ` · ${t('à ne pas refaire')}` : ''}`),
      el('a', { class: 'btn small', href: `#/recipes/${h.recipe_id}${buildQuery({ v: h.recipe_version_id, servings: h.servings || '' })}` }, t('Refaire comme la dernière fois')))))));
  }

  // Ingrédients à utiliser (inventaire)
  const soon = ctx.inventory.filter((i) => i.use_by && (Date.parse(i.use_by) - Date.now()) < 4 * 86400000).sort((a, b) => a.use_by.localeCompare(b.use_by)).slice(0, 5);
  if (soon.length) {
    root.append(sectionPlain(t('À utiliser en priorité'), el('ul', { class: 'list' }, ...soon.map((i) => el('li', { class: 'row between' },
      el('span', null, `${i.label}${i.quantity_text ? ` — ${i.quantity_text}` : ''}`),
      el('span', { class: `chip ${Date.parse(i.use_by) < Date.now() ? 'danger' : 'warn'}` }, `${t('à consommer avant le')} ${formatDate(i.use_by)}`)))),
      el('a', { class: 'btn small', href: '#/kitchen?tab=inventory' }, t('Voir l’inventaire'))));
  }

  if (!ctx.recipes.length) {
    root.append(section(t('Bienvenue'), el('p', null, t('Ta bibliothèque est vide. Commence par ajouter un livre, puis photographie sa table des matières ou une recette.')),
      el('div', { class: 'row' }, el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter')), el('a', { class: 'btn', href: '#/settings' }, t('Restaurer une sauvegarde')))));
  }
  return root;
}
```

  Ce qui ne bouge pas, exprès : la liste `.list` des cuissons disparaît au profit de la grille, mais l'`href` de « Refaire comme la dernière fois »
  (`buildQuery({ v, servings })`), la date, les étoiles et « à ne pas refaire » sont les mêmes textes ; `rediscoverCard` garde son `availabilityBadge`
  (qui dit désormais « À importer · p. {p} ») et son style inline `var(--sage)` ; `section` reste importé pour « Bienvenue » ; `emptyState` et
  `provenanceText` restent ré-exportés (l. 97). `app.js:96` (`route('/', renderHome)`) ne change pas : la route reçoit trois arguments, le 4e prend son défaut.

- [ ] **Step 6 : implémenter les icônes — `src/ui/add.js`, `src/ui/accueil-livre.js`** (D-UI-9 ; `carte(ico, …)` de components.js:232 reçoit un nœud,
  `el` l'ajoute tel quel dans `div.carte-ico[aria-hidden]`). `add.js` : après la l. 15 (`import { pageHeader, carte, … } from './components.js';`) :

```js
import { icone } from './icones.js';
```

  `grilleModel()` (l. 27-36) et `renderGrille` (l. 38-42), entières :

```js
// D-UI-9 (lot UI-1 « Carnet ») : `ico` est le NOM d'une icône au trait d'icones.js (plus un émoji : il ne prenait pas la couleur) ; renderGrille la rend.
export function grilleModel() {
  return { cartes: [
    { action: 'ajouterLivre', ico: 'livres', titre: t('Ajouter un livre'), sousTitre: t('ISBN (scan ou saisie), ou titre à la main') },
    { action: 'pages', ico: 'appareil-photo', titre: t('Photographier ou importer des pages'), sousTitre: t('Caméra, photos ou PDF — pour une recette ou un index') },
    { action: 'saisir', ico: 'crayon', titre: t('Saisir une recette'), sousTitre: t('À la main') },
    { action: 'signet', ico: 'lien', titre: t('Garder un lien web'), sousTitre: t('Une recette ou une page à retrouver') },
    { action: 'creerIA', ico: 'etincelle', titre: t('Créer avec l’IA'), sousTitre: t('Une proposition à vérifier') },
    { action: 'congelateur', ico: 'flocon', titre: t('Ajouter un lot au congélateur'), sousTitre: t('Portions, date, recette source et méthode de réchauffage.') },
  ] };
}

// Une carte sans geste câblé n'est pas rendue (même garde que la porte d'entrée). Un nom d'icône inconnu LÈVE (icone) : jamais une carte sans pictogramme en silence.
export function renderGrille(model, gestes = {}) {
  return el('div', { class: 'grid wide' },
    ...model.cartes.filter((c) => typeof gestes[c.action] === 'function').map((c) => carte(icone(c.ico), c.titre, c.sousTitre, () => gestes[c.action]())));
}
```

  `accueil-livre.js` : après la l. 5 (`import { carte } from './components.js';`) : `import { icone } from './icones.js';` ; dans `accueilLivreModel`
  (l. 12-14), SEUL le champ `ico` change — `ico: '📸'` → `ico: 'appareil-photo'`, `ico: '📄'` → `ico: 'page'`, `ico: '🕒'` → `ico: 'horloge'` (le texte de
  la l. 14, « Aller à la bibliothèque. », est celui que T1 a posé : ne pas le réécrire) ; dans `renderAccueilLivre` (l. 28) :
  `carte(c.ico, c.titre, c.texte, …)` → `carte(icone(c.ico), c.titre, c.texte, …)`. Les deux modules sont dans `MODULES_NEUFS` : aucune chaîne `t()` neuve.

- [ ] **Step 7 : implémenter l'écran d'import ciblé et les compteurs — `src/ui/import-cible.js`, `src/ui/book.js`, `src/ui/library.js`.**
  `import-cible.js`, l'en-tête (l. 665-670) — la dernière ligne d'`enTete` :

```js
      recipe.availability === 'partial' ? el('span', { class: 'badge partial' }, t('Partielle')) : el('span', { class: 'badge reference' }, t('À importer'))));
```

  Juste AVANT `ecrirePageImprimee` (l. 499) :

```js
  // Lot UI-1 « Carnet » (§ 4.5) : la légende d'une vignette — « Page 1 · p. 76 » quand la page imprimée est connue, « Page 1 » sinon ; réécrite sur place.
  const legendeDe = (rang, page) => (Number.isInteger(page) && page > 0 ? t('Page {n} · p. {p}', { n: rang, p: page }) : t('Page {n}', { n: rang }));
```

  `ecrirePageImprimee` (l. 499-510), entière :

```js
  // Le champ « p. imprimée » d'une vignette écrit source_pages.printed_page (relue avant d'écrire, leçon C4) ; sans redessin : la saisie garde le focus.
  // Une saisie illisible (vide — ce qu'un champ nombre rend pour « 13a » —, « 0 », hors 1..9999) n'écrit RIEN et le champ reprend la valeur courante
  // (T4-R1 : jamais un numéro effacé sans le dire) ; il reste ouvert pour corriger. Lot UI-1 (§ 4.5) : une saisie valide réécrit la légende SUR PLACE et
  // referme le champ (aucun redessin : page_ids et focus intacts).
  async function ecrirePageImprimee(pageId, champ, { legende = null, rang = null } = {}) {
    const s = String(champ.value ?? '').trim();
    const p = etat.pages.get(pageId);
    if (!/^[1-9]\d{0,3}$/.test(s)) { champ.value = p?.printed_page ?? ''; return; }
    const n = parseInt(s, 10);
    try { const courante = await repo.get('source_pages', pageId); if (courante) await repo.save('source_pages', { ...courante, printed_page: n }); }
    catch (e) { logError('import_cible.page_imprimee', { error: e, id: pageId }); }
    if (p) p.printed_page = n;
    if (legende) { legende.textContent = legendeDe(rang, n); legende.setAttribute('aria-expanded', 'false'); }
    champ.hidden = true;
  }
```

  `sectionPages` (l. 672-696), entière :

```js
  function sectionPages(pageIds, figees) {
    const n = pageIds.length;
    const vignettes = el('div', { class: 'thumbs' });
    pageIds.forEach((id, i) => {
      const p = etat.pages.get(id);
      if (!p) return; // pointeur souple : une page absente n'est pas rendue
      const rang = i + 1;
      const img = el('img', { alt: t('Page {n}', { n: rang }), loading: 'lazy' });
      poserImage(img, p.sha256);
      const bouton = (role, libelle, onClick) => el('button', { type: 'button', class: 'btn', dataset: { role, page: id }, onClick }, libelle);
      // Lot UI-1 « Carnet » (§ 4.5, maquette 04) : le × en coin de la vignette EST le bouton « Retirer » d'avant (même data-role, même nom accessible par
      // aria-label, cible 44 × 44 par .thumbs .btn.retirer), absent quand les pages sont figées ; la légende « Page 1 · p. 76 » est un bouton qui OUVRE le
      // champ « p. imprimée », né hidden (la saisie le referme : ecrirePageImprimee) ; Monter / Descendre restent le chemin garanti (§ 8 : pas de glisser).
      const croix = figees ? null : el('button', { type: 'button', class: 'btn retirer', 'aria-label': t('Retirer la page {n}', { n: rang }), dataset: { role: 'retirer', page: id }, onClick: () => retirerLaPage(id) }, '×');
      const champ = el('input', { type: 'number', min: 1, max: 9999, hidden: true, placeholder: t('p. imprimée'), 'aria-label': t('p. imprimée'), value: p.printed_page ?? '' });
      const legende = el('button', { type: 'button', class: 'btn link small legende', 'aria-expanded': 'false', dataset: { role: 'legende', page: id }, onClick: () => { champ.hidden = false; legende.setAttribute('aria-expanded', 'true'); champ.focus(); } }, legendeDe(rang, p.printed_page));
      champ.addEventListener('change', (e) => ecrirePageImprimee(p.id, e.target, { legende, rang }));
      vignettes.append(el('figure', null, el('span', { class: 'num' }, String(rang)), img, croix,
        el('figcaption', { class: 'stack' }, legende, champ,
          figees ? null : el('div', { class: 'row' },
            bouton('monter', t('Monter la page {n}', { n: rang }), () => bougerPage(id, -1, 'monter')),
            bouton('descendre', t('Descendre la page {n}', { n: rang }), () => bougerPage(id, 1, 'descendre'))))));
    });
    return section(t('Pages de la recette'),
      el('p', { class: 'muted', style: { margin: 0 } }, n <= 1 ? t('{n} photo ajoutée', { n }) : t('{n} photos ajoutées', { n })),
      n ? vignettes : null,
      figees ? null : el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn', disabled: etat.occupe, onClick: () => ajouterPhotos({ accept: 'image/*', capture: 'environment', multiple: true }) }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', disabled: etat.occupe, onClick: () => ajouterPhotos({ accept: 'image/*', multiple: true }) }, t('Choisir des photos'))));
  }
```

  (`el` pose `hidden: true` en attribut `hidden` ; `'aria-expanded': 'false'` et `'aria-label'` en attributs ; la section reste `section.card` — un
  panneau d'action, § 3.3.) Les trois chaînes neuves (« À importer », « Partielle », « Page {n} · p. {p} ») ont leur entrée `en.js` (Step 4) ;
  `import-cible.js` est scanné en entier par `MODULES_NEUFS` et par `sansEntree` (tests/creer-ia.js : définition l. 1227, appel sur les sources l. 1242). Rien d'autre ne bouge : `retirerLaPage`,
  `bougerPage`, `poserImage`, le focus restitué par `dessiner()` (`button[data-role][data-page]`), `zoneAction`.

  `library.js:73` : `t('{n} repérée(s)', { n: refs })` → `t('{n} à importer', { n: refs })` (le reste de la ligne inchangé : « {n} disponible(s) · {m} à
  importer »). `book.js` : NON TOUCHÉ (**D-10 RATIFIÉ rév. 3** : T4 a retiré les chips et renommé le filtre « À importer » ; T5 ne les refait pas — un reste
  à la tête de T4 est un constat pour la revue de T4, Step 0 (b), jamais une édition de cette tâche).

- [ ] **Step 8 : implémenter `styles.css`** — quatre groupes, jetons seulement (T-2), aucun `display:none` (T-1), aucun `56px` (T-11), aucun `:hover`.
  Après `.card.carte p { … }` (l. 137) :

```css
/* Lot UI-1 « Carnet » (D-UI-9) : l'icône au trait d'une carte d'action — un svg 24 × 24 en currentColor (icones.js), agrandi à la taille de l'émoji d'avant. */
.card.carte .carte-ico svg { width: 2rem; height: 2rem; }
```

  Après `.search-bar input { … }` (l. 233) :

```css
/* Lot UI-1 « Carnet » (§ 4.4) : la barre d'Aujourd'hui vit sur le papier, sous le pageHeader, ses puces d'exemple dessous (espacement de section, § 3.2) ;
   une cuisson = sa carte-plat puis, HORS du lien, la date et « Refaire comme la dernière fois » (H-16) ; la carte s'étire pour aligner les rangées. */
.recherche-accueil { margin-bottom: 1.6rem; }
.cellule-cuisson { display: flex; flex-direction: column; gap: .4rem; }
.cellule-cuisson > .carte-plat { flex: 1; }
.cellule-cuisson .cuisson-date { font-size: .85rem; }
```

  Après `.thumbs .fichier-absent { … }` (l. 267) :

```css
/* Lot UI-1 « Carnet » (§ 4.5) : sur une vignette de l'import ciblé, le × « Retirer la page n » en coin (cible 44 × 44, I-UI-4 ; la figure est relative) et la
   légende « Page 1 · p. 76 », un bouton-lien compact qui ouvre le champ « p. imprimée » (né [hidden], T-1). */
.thumbs .btn.retirer { position: absolute; top: .25rem; right: .25rem; width: 44px; min-width: 44px; height: 44px; min-height: 44px; padding: 0; justify-content: center; font-size: 1.3rem; line-height: 1; background: var(--card); }
.thumbs .legende { padding-left: 0; padding-right: 0; justify-content: flex-start; font-size: .8rem; }
```

  `tests/theme.js` reste vert sans changement : inventaire T-1 (les cinq `display:none` d'origine), T-2 (`var(--card)` seul jeton de couleur), T-11
  (`44px` et non `56px`), survol (aucun `:hover` neuf), `.search-bar input` toujours 52 px (règle inchangée).

- [ ] **Step 9 : vert** — depuis la racine du worktree (`/Users/neeganmac/projects/mistu-carnet`, servi par `python3 -m http.server 8096 --bind 127.0.0.1`) :
  `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` → tout vert **sauf l'épingle** (`compte d’assertions : une assertion qui disparait
  est un rouge`, obtenu = épingle de T4 + 28 : la ligne rouge affiche `results.length` évalué AVANT que l'assertion du total se pousse), une seule erreur de console admise, le 404 de `/favicon.ico` ; les quatre `bloc` « T5 — … » verts en entier,
  les six amendements du Step 2 verts, `tests/theme.js` vert sans changement. `node --test tools/*.test.mjs` → **208/208** (inchangé : rien côté Node).
  `node tools/generer-migrations.mjs --check` → **0**. Attendu : `❌ (N−1)/N`, l'épingle seule, où N = épingle de T4 + 29 (le total du bilan) ; un autre rouge est un défaut de
  cette tâche (ou un écart d'interface avec T1/T2 : Step 0 (e)(f)), jamais un amendement de plus.

- [ ] **Step 10 : épingle relevée ; `sw.js` `VERSION`.** `tests/tests.js:250` : `eq(results.length, <N − 1>, …)` — N = le total du bilan du Step 9 (`❌ (N−1)/N`) ; N − 1 est exactement la
  valeur `obtenu :` de la ligne rouge de l'épingle, reprise TELLE QUELLE (la forme de T1 Step 9 et de T4 Step 7 ; règle N−1), jamais un compte écrit
  d'avance (D-14 ; rév. 5, point 1). Attendu de RAISONNEMENT, en commentaire seulement : épingle de T4 + 28 — les 28 assertions du Step 1 ; les amendements du Step 2
  n'en ajoutent ni n'en retirent aucune ; un écart se consigne. `sw.js:4` : `const VERSION = 'cuisine-os-v0.17.0-<K+1>';`
  (K relevé au Step 0 ; attendu `-5`) ; `SHELL` inchangé (aucun module neuf). Relancer la suite : `✅ (épingle + 1)/(épingle + 1)`, Node 208/208, `--check` 0.
  Consigner dans `progress.md` : bilan, épingle, `VERSION`, et les décisions du Step 0 (b)(c)(d)(e)(f)(g).

- [ ] **Step 11 : mutants de la tâche** (copie LÉGÈRE du worktree dans le scratchpad — `src/`, `tests/`, `styles.css`, `sw.js`, `index.html`, `tests/fixtures/`,
  lien `node_modules` s'il existe ; jamais `coverage/` ni `public/` —, servie à part sur 8196 ; chaque mutant rejoué puis la copie remise ; JAMAIS en place) :
  chacun doit rougir, l'assertion qui le tue est nommée :
  - « À importer » posé sur une `available` (`availabilityBadge` : la branche `available` rend « À importer ») → « huit combinaisons » (spec § 7).
  - badge long rétabli (`t('Repérée dans ton livre — page {p}')` dans la branche `reference_only`) → « textes courts », `tests/ajouter.js:1133`, `tests/import-cible.js:668`.
  - `STATE_LABELS.availability.reference_only` remis à « Repérée dans ton livre » → « STATE_LABELS.availability : seule reference_only change ».
  - `home.js` : `depot.getFiles(ctx.docs.map((d) => d.recipe.photo_sha256))` (toute la bibliothèque) → « UNE passe repo.getFiles, sur les empreintes des cartes RENDUES » (rc_x lue).
  - `home.js` : `recipeCard(d)` (carte horizontale, `vignettePlat` → `getFile` par carte) → « Favoris : section.plain > div.grille-plats de cartes-plat » et « zéro getFile ».
  - `home.js` : la date et « Refaire comme la dernière fois » passés en `extra` de la carte (DANS le `<a>`) → « HORS du <a> de la carte ».
  - `home.js` : `.search-bar` remise dans `el('div', { class: 'card sage' }, …)` → « plus de .card.sage ».
  - `home.js` : `section(t('Favoris'), …)` à la place de `sectionPlain` → « Favoris : section.plain ».
  - `home.js` : `fichiers.get(…)` remplacé par `null` (toujours la carte sans photo) → « octets ici → img.plat-vignette.grande ».
  - `add.js` : `ico: '✨'` rétabli sur `creerIA` → « grilleModel : ico = le NOM d’une icône » et `tests/creer-ia.js:1089` ; `renderGrille` qui rend `carte(c.ico, …)`
    (le nom en texte) → « chaque .carte-ico porte un svg … aucun texte ».
  - `accueil-livre.js` : `carte(c.ico, …)` → « renderAccueilLivre : trois svg, aucun émoji ».
  - `import-cible.js` : × sans `aria-label` → « nom accessible « Retirer la page 1 » » et `tests/import-cible.js:713` (sélecteur nul → levée).
  - `import-cible.js` : × en `class: 'btn small retirer'` et `.thumbs .btn.retirer` sans `min-width` / `width` → « cible ≥ 44 px » (mesurée) et « styles.css : … min-width et min-height 44px ».
  - `import-cible.js` : champ « p. imprimée » sans `hidden: true` → « champ « p. imprimée » né hidden ».
  - `import-cible.js` : légende non réécrite (ligne `legende.textContent = …` retirée) → « « Page 1 · p. 76 » réécrite SUR PLACE ».
  - `import-cible.js` : `redessiner()` à la fin d'`ecrirePageImprimee` (la légende par redessin) → « le même nœud : aucun redessin » (`=== legende` faux) ; et
    `tests/import-cible.js:717-720` reste vert (témoin : un redessin n'y est pas interdit — c'est l'assertion du nœud identique qui porte la règle).
  - `import-cible.js` : × rendu même quand `figees` → `tests/import-cible.js:792` et `:883` (compte de `[data-role="retirer"]` à 0).
  - `styles.css` : `.thumbs .btn.retirer { display: none; }` ajouté → `tests/theme.js` T-1 (inventaire) ET « ni display:none ».
  - `en.js` : `"À importer": "To import"` retirée → « en.js : les sept clés » et le filet `MODULES_NEUFS` (import-cible.js) et `sansEntree` (creer-ia.js).
  - `library.js:73` : `'{n} repérée(s)'` rétabli → « library.js (grille Livres, l. 73) » et « plus aucun t('…repérée(s)…') ».
  Compte attendu : 20 mutants, 20 rouges ; un survivant est un constat (ou un équivalent NOMMÉ, jamais tu).

- [ ] **Step 12 : invisibles** sur les fichiers touchés (Python `-I`, jamais `grep` : ugrep rend un faux zéro) : `src/ui/home.js src/ui/add.js
  src/ui/accueil-livre.js src/ui/import-cible.js src/ui/components.js src/core/i18n.js src/ui/library.js src/i18n/en.js styles.css sw.js
  tests/carnet.js tests/ajouter.js tests/import-cible.js tests/creer-ia.js tests/tests.js` (`src/ui/book.js` n'est pas touché : D-10) — attendu `invisibles : 0`, sortie 0 (la commande des contraintes
  globales du plan, l'ensemble U+200B-200D, U+2028/2029, U+202A-202E, U+2060, U+FEFF). Aucune clé ni valeur sensible : le seul jeton du bloc est la
  sentinelle `jeton-carnet-sentinelle`, jamais lue par un `fetch` (le `fetch` du bloc lève).

- [ ] **Step 13 : commit** par chemin nommé (jamais `-A`) : `git add src/ui/home.js src/ui/add.js src/ui/accueil-livre.js src/ui/import-cible.js
  src/ui/components.js src/core/i18n.js src/ui/library.js src/i18n/en.js styles.css sw.js tests/carnet.js tests/ajouter.js tests/import-cible.js
  tests/creer-ia.js tests/tests.js` (jamais `src/ui/book.js` : D-10 RATIFIÉ rév. 3, T5 ne le touche pas), puis :

```text
Aujourd hui, Ajouter, import cible, libelles : pageHeader et cartes-plat de l accueil (une passe getFiles, date et Refaire hors du lien), icones au trait des cartes d action, A importer / Disponible / Partielle sur les badges et STATE_LABELS, croix en coin et legende Page n p. N sur les vignettes (lot UI-1 Carnet, tache 5 ; sw.js -5, epingle relevee)

Co-Authored-By: <modele reel de l'implementeur> <noreply@anthropic.com>
```

  (message ASCII sans accents ; le trailer `Co-Authored-By` porte le modèle RÉEL de l'implémenteur — par exemple `Claude Fable 5.1` ou `Claude Opus 5.5` —,
  suivi de la ligne de session que le contrôleur donne dans le brief ; `-5` et l'épingle se lisent avec les valeurs relevées au Step 10. Ne pas pousser.)

---

### Task 6 : Filets, preuve visuelle, docs — i18n du lot, chaînes retirées, outil de preuve rejoué, CLAUDE.md, STATE.md, architecture, spec § 12

Spec § 9 tâche T6 ; § 5 (textes FR → EN), § 7 (filets, mutants, preuve visuelle), § 10 UI-1, § 11, § 12 (sous-titre neuf « Construction UI-1 :
rulings »), § 13 ; I-UI-4, I-UI-7 ; D-UI-2 (galerie : badge « Original » à côté d'un `.btn.primary`), D-UI-3 (titre de fiche long aux quatre
largeurs), D-UI-4 (« Bibliothèque » dans l'onglet à 320 et 375 px, § 13 point 3). Cette tâche **consomme tout** : elle ne crée aucun composant, ne
touche aucun module de `src/` hors `src/i18n/en.js` (retrait des clés mortes), et ne porte une version QUE si `en.js` change (R-B-24 : `sw.js`
`VERSION` +1 dans ce cas, et dans ce cas seulement ; `SHELL` inchangé, aucun module neuf). Le registre (`.superpowers/`, exclu par
`.git/info/exclude`) reçoit l'outil de preuve, la galerie, `resultats.md` / `resultats.json` et `captures/` : hors git, copié dans
`~/projects/mistu/.superpowers/sdd/` à la clôture.

**Files:**
- Modify: `tests/carnet.js` (bloc « Tâche 6 — filets du lot » ajouté EN DERNIER, AU-DESSUS du repère de fin de `runCarnetTests`, après le
  bloc de T5 ; le bloc est autonome : ses aides portent le suffixe `T6`, aucune dépendance aux aides des tâches 1 à 5)
- Modify: `tests/ajouter.js` (l. 8 `MODULES_NEUFS` : `'../src/ui/icones.js'` si T1 ne l'a pas posé ; l. 24-… `CHAINES_NEUVES_AILLEURS` :
  entrées de `book.js` et `recipe.js` COMPLÉTÉES (les compléments de A-9 : « Bibliothèque », « Toutes », « Disponibles » ; « Bibliothèque », « 1 portion ») ;
  `'../src/ui/library.js'` (T2, + T5), `'../src/ui/home.js'` (T5) et `'../src/ui/components.js'` (T2, T3, T5) relues, INCHANGÉES ; retrait de
  `'+ Pages d’index'`, `'+ Recette'` (book.js, T4) et `'Ouvrir le lien'` (recipe.js, T3) de ces listes SI encore présents)
- Modify: `src/i18n/en.js` (l. 232 `"Aller à Mes livres."`, l. 234 `"+ Pages d’index"`, l. 235 `"+ Recette"`, l. 251 `"Ouvrir le lien"` à
  `f3672be` : retirées SI encore présentes — T3, T4 et T5 ont pu les retirer en remplaçant leurs chaînes ; les lignes se retrouvent par leur TEXTE)
- Modify: `tests/tests.js` (l. 250 à `f3672be`, épingle `eq(results.length, …)` : relevée à la valeur mesurée, règle N−1)
- Modify: `sw.js` (l. 4 `VERSION` : +1 **ssi** `en.js` a changé à cette tâche)
- Modify: `CLAUDE.md` (section neuve `### Expérience « carnet » : olive, grands titres, cartes-plat, bibliothèque sur les recettes (23-25 octobre
  2026, lot UI-1)`, insérée juste AVANT la ligne `## La présentation du serveur (18 octobre 2026, lot borné après la passerelle)`, sur le
  modèle des sections A à F : Pour toi, Où, Ce qui marche, Ce qui n'est PAS prouvé, Dettes, Gestes de Neegan, Versions, Bilan)
- Modify: `STATE.md` (l. 1 : titre réécrit ; paragraphe neuf en tête, avant `**23 octobre 2026, 17 h 30 — CHAÎNE A → F EN LIGNE.**` ; bloc
  « Reprendre » : un bloc de commandes pour le lot)
- Modify: `docs/architecture.md` (section neuve `## Expérience « carnet » (lot UI-1, 23-25 octobre 2026)`, insérée juste AVANT `## Modèle de
  données (magasins IndexedDB)`, après la section du lot F)
- Modify: `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (§ 12 : sous-titre `### Construction UI-1 : rulings` inséré juste AVANT
  `## 13. À trancher par Neegan` ; d'abord les trois rulings du pré-vol R-UI-P1 à R-UI-P3 et les deux du chef d'orchestre R-UI1-1, R-UI1-2 (Global
  Constraints), puis une ligne par ruling R-UI-1 à R-UI-n relevé dans `progress.md` par les tâches 1 à 5, puis ceux de cette tâche ; ET trois amendements de
  texte : § 4.2, première phrase (« sous-titre = `provenanceText`, inchangé », R-UI-P2) ; § 5, ligne « Ingrédients / Préparation » (« Ingredients / Method »,
  R-UI-P3) — rév. 2 ; § 12 « Specs amendées par ce lot » : une puce pour les cinq textes posés hors de la table § 5 (D-8, rév. 3))
- Create (registre, hors git) : `.superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs` (copie adaptée de
  `~/projects/mistu/.superpowers/sdd/2026-10-18-refonte-visuelle/preuve-visuelle.cjs`, 740 lignes à la source), `galerie.html` (copie adaptée,
  386 lignes à la source), `resultats.md`, `resultats.json`, `resultats-contre-preuve.md`, `captures/` (PNG `<largeur>-<nom>.png`)
- Test: `tests/carnet.js` (bloc T6), `tests/theme.js` (inchangé : T-1 inventaire des `display: none`, T-2 couleurs en dur, T-11 `56px`, survol
  sous `@media (hover: hover)` — relus VERTS sur la feuille servie, c'est le filet « aucune couleur en dur ni display:none neuf » demandé par la
  spec § 7)

**Interfaces:**
- Consumes (tâches 1 à 5, par leur nom exact) : `icone(nom)` et `NOMS_ICONES` ou la liste des vingt-trois noms (`src/ui/icones.js`, T1) ;
  `sectionPlain(title, ...children)`, `grilleCartes(noeuds)`, `recipeCard(doc, { photoEnTete, fichier })`, `pageHeader(title, { subtitle,
  actions, back, classeTitre })`, `availabilityBadge(recipe)` (`src/ui/components.js`, T1-T2) ; routes `#/library?tab=recettes|books|dishes|a-importer`
  (T2), `#/recipes/<id>` (T3), `#/books/<edition_id>` (T4), `#/` (T5), `#/add`, `#/recipes/<id>/importer`, `#/search?mode=web` ; `MODULES_NEUFS`,
  `CHAINES_NEUVES_AILLEURS` (`tests/ajouter.js`) ; `runCarnetTests({ eq, ok })` (`tests/carnet.js`, T1) ; `repo.save`, `repo.saveBatch`, `repo.putFile`,
  `repo.ajouterPages`, `repo.newId` (`src/model/repo.js`) ; `sha256Hex` (`src/core/hash.js`) ; classes CSS de la spec § 3.3 et § 4 : `.carte-plat`,
  `.sans-photo`, `.grille-plats`, `.plat-vignette.grande`, `.plat-vignette.petite`, `section.plain`, `.two-col.livre`, `.titre-fiche`, `.grid.livres`,
  `.liste-compacte`, `.fiche-tete`, `.reperes`, `details[data-role=autres-gestes]`.
- Produces : aucun symbole de production. Dans `tests/carnet.js` (portée du bloc) : `TEXTES_UI1` (table FR → EN : les 28 textes neufs UI-1 de la spec § 5 plus
  cinq textes posés par T3 à T5 hors de la table — 33 paires, R-UI-n+3, A-10), `CHAINES_RETIREES` (`['+ Recette', '+ Pages d’index', 'Ouvrir le lien', 'Aller à Mes livres.']`), `SELECTEURS_UI1` (les treize
  sélecteurs ci-dessus). Outil : `node .superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs <port> [--css=<fichier>]
  [--largeurs=375,390,768,1512] [--seulement=app,galerie,etroit]` → code 0 = VERT ; `resultats.md`, `resultats.json`, `captures/`. Galerie :
  `http://127.0.0.1:8096/.superpowers/sdd/2026-10-23-experience-carnet/galerie.html` (blocs `section.bloc[data-nom]`, dont `onglets`,
  `badges-et-action`, `cartes-plat`, `sections`, `fiche`, `liste-compacte`, `hidden`).

- [ ] **Step 0 : relire l'état réel des tâches 1 à 5** (lecture seule ; chaque écart est un amendement NOMMÉ dans `progress.md`, pas un constat :
  R-C-7, R-E-14). Depuis la racine du worktree :

```bash
git log --oneline f3672be..HEAD                      # les commits de T1 à T5 (et leurs rondes)
git diff --stat f3672be..HEAD -- supabase/            # attendu : vide (aucun fichier serveur)
grep -n "VERSION = 'cuisine-os-v" sw.js ; grep -n "APP_VERSION" src/model/schema.js   # attendu : 0.17.0-K, K = nombre de commits qui ont touché src/, styles.css, index.html, le manifeste ou sw.js
grep -n "eq(results.length" tests/tests.js            # l'épingle courante (règle N-1) : la relever au Step 5
grep -n "icones.js" tests/ajouter.js sw.js            # MODULES_NEUFS (T1) et SHELL (T1) : si l'un manque, le Step 3 le pose
grep -n "'+ Recette'\|'+ Pages d’index'\|'Ouvrir le lien'\|Aller à Mes livres" tests/ajouter.js src/i18n/en.js   # les clés mortes encore présentes
grep -rn "t('Ouvrir le lien')\|t('+ Recette')\|t('+ Pages d’index')\|t('Aller à Mes livres.')\|label: 'Mes livres'" src   # attendu : vide (T3, T4, T5, T1) ; un reste = un constat de la revue de la tâche fautive, PAS une correction ici
grep -n "R-UI-" .superpowers/sdd/2026-10-23-experience-carnet/progress.md   # les rulings consignés par T1 à T5, à porter au § 12 (Step 8)
ls ~/projects/mistu/.superpowers/sdd/2026-10-18-refonte-visuelle/preuve-visuelle.cjs ~/projects/mistu/.superpowers/sdd/2026-10-18-refonte-visuelle/galerie.html   # la source de l'outil (lecture seule)
curl -sS -o /dev/null -w "8096 http=%{http_code}\n" http://127.0.0.1:8096/tests/   # le serveur du worktree (lancé au Départ ; PID dans le scratchpad)
```

  Puis la suite, Node et `--check`, pour poser la mesure de départ de la tâche : `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096`
  (attendu `✅ N/N`, N = épingle + 1), `node --test tools/*.test.mjs` (attendu 208/208 : aucune tâche UI-1 ne touche `tools/`), `node
  tools/generer-migrations.mjs --check` (attendu 0). **Relevé attendu à la tête de T5** (une dérive est un amendement nommé) : les quatre sites de
  D-UI-4 réécrits (`app.js:39` `label: 'Bibliothèque'`, `recipe.js:88` et `book.js:121` `label: t('Bibliothèque')`, `accueil-livre.js:14`
  `t('Aller à la bibliothèque.')`) ; `book.js:123, 126` `menuSource(t('Ajouter des pages de sommaire')…` / `menuSource(t('Ajouter des recettes')…` ;
  `components.js` (`lienOrigine`) porte le SEUL `t('Voir la page d’origine')` ; `recipe.js` (en-tête, `blocSignet`) et `import-web.js:390` l'appellent par `lienOrigine(lien)` ; `grep -rn "Ouvrir le lien" src/` vide ; `search.js:18` `MODES` garde `'Mes livres'` (une portée de recherche,
  D-UI-4) ; `en.js:4` garde `'Mes livres': 'My books'`.

- [ ] **Step 1 : tests rouges — `tests/carnet.js`**, bloc « Tâche 6 — filets du lot », ajouté EN DERNIER, AU-DESSUS du repère de fin de
  `runCarnetTests`, après le bloc de T5 (les blocs des tâches 1 à 5 le précèdent ; aucune de leurs aides n'est reprise : le bloc porte les siennes,
  suffixe `T6`). Les textes viennent de la spec § 5 (apostrophe U+2019 dans les chaînes, « … » U+2026) ; aucun n'est inventé :

```js
  // ===== Tâche 6 — filets du lot (spec § 5, § 7 « Tests neufs » : filets i18n ; D-UI-4, D-UI-10 : chaînes retirées ; I-UI-4 : règles neuves)
  try {
    // S4 (lot UX) : une lecture de source qui échoue est un ROUGE nommé, jamais un source vide lu comme vert (V-F13 du lot web).
    const lireT6 = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); const s = await r.text(); if (s.length < 300) throw new Error(`${chemin} : source trop court (${s.length})`); return s; };
    const clesDe = (src) => [...src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    const { EN } = await import('../src/i18n/en.js');
    const { MODULES_NEUFS, CHAINES_NEUVES_AILLEURS } = await import('./ajouter.js');
    // La table FR → EN des textes UI-1 (spec § 5, lignes UI-1 seulement ; les quatre lignes UI-2 vivent dans tests/apercu-web.js), plus cinq textes
    // que les tâches posent hors de la table § 5 (R-UI-n+3) : « 1 portion » (repères, n = 1 ; clé ANTÉRIEURE, en.js:341 à f3672be, anglais relu),
    // « Disponibles » (filtre § 4.3, T4), « Reprendre la séance » (§ 4.3, T4), « {n} à importer » (compteur library.js:73, T5), « Page {n} · p. {p} »
    // (légende § 4.5, T5) — les anglais sont ceux de la tâche qui les pose et se relisent ici (amendement nommé si une tâche a choisi un autre mot).
    const TEXTES_UI1 = {
      'Bibliothèque': 'Library', 'Aller à la bibliothèque.': 'Go to the library.', 'Tes livres, tes trouvailles, tes recettes.': 'Your books, your finds, your recipes.',
      'Recettes': 'Recipes', 'Ajouter une recette': 'Add a recipe', 'Une recette, un ingrédient…': 'A recipe, an ingredient…',
      'Toutes': 'All', 'De mes livres': 'From my books', 'Du web': 'From the web', 'Recettes de mes livres à importer': 'Recipes from my books to import', 'Voir plus': 'Show more',
      'À importer': 'To import', 'À importer · p. {p}': 'To import · p. {p}', 'Disponible': 'Available', 'Disponibles': 'Available', 'Partielle': 'Partial',
      'Du web · {h}': 'From the web · {h}', 'De mon livre · {t}': 'From my book · {t}', '{n} portions · {d}': '{n} servings · {d}', '1 portion': '1 serving',
      'Voir la page d’origine': 'View the original page', 'Portions, versions et autres gestes': 'Servings, versions and more',
      'Les recettes de ce livre': 'The recipes in this book', '{n} disponible(s) · {m} à importer': '{n} available · {m} to import', 'Voir les {n} recettes': 'Show all {n} recipes',
      'Ajouter des recettes': 'Add recipes', 'Ajouter des pages de sommaire': 'Add table-of-contents pages', 'Sommaire': 'Table of contents',
      'Cherche une recette, un ingrédient, une envie.': 'Search a recipe, an ingredient, a craving.', 'Aucune recette pour l’instant.': 'No recipes yet.',
      'Reprendre la séance': 'Resume the session', '{n} à importer': '{n} to import', 'Page {n} · p. {p}': 'Page {n} · p. {p}',
    };
    // Clés RÉEMPLOYÉES par le lot (existaient avant lui : leur anglais ne change pas ; « Corriger » reste « Fix », H-14 ; « Mes livres » reste le
    // segment de la recherche, D-UI-4). Existence seulement.
    const CLES_REEMPLOYEES = ['Corriger', 'Ingrédients', 'Préparation', 'Ajouter un livre', 'Favoris', 'Mes livres', 'Livres', 'Plats'];
    // Les chaînes RETIRÉES par D-UI-4 et D-UI-10 (§ 5, dernier alinéa : les trois nommées + « Aller à Mes livres. », remplacée par la même décision).
    const CHAINES_RETIREES = ['+ Recette', '+ Pages d’index', 'Ouvrir le lien', 'Aller à Mes livres.'];
    // Où chaque texte neuf doit paraître comme t('…') (§ 4 ; un texte peut vivre dans plusieurs modules). Les modules de MODULES_NEUFS sont scannés
    // en entier par tests/ajouter.js ; les autres passent par CHAINES_NEUVES_AILLEURS, dont ce bloc vérifie qu'elle est À JOUR (calcul, pas relevé).
    const MODULES_UI1 = ['../src/ui/library.js', '../src/ui/recipe.js', '../src/ui/book.js', '../src/ui/home.js', '../src/ui/components.js', '../src/ui/accueil-livre.js', '../src/ui/import-web.js', '../src/ui/import-cible.js', '../src/ui/add.js'];
    const HORS_MODULES_NEUFS = ['../src/ui/library.js', '../src/ui/recipe.js', '../src/ui/book.js', '../src/ui/home.js', '../src/ui/components.js'];
    const sources = Object.fromEntries(await Promise.all(MODULES_UI1.map(async (m) => [m, await lireT6(m)])));
    const parModule = Object.fromEntries(MODULES_UI1.map((m) => [m, new Set(clesDe(sources[m]))]));

    eq(Object.keys(TEXTES_UI1).length, 33, 'T6 i18n : la table des textes UI-1 compte 33 paires — 28 de la spec § 5, cinq hors table (garde contre une ligne effacée)');
    eq(Object.entries(TEXTES_UI1).filter(([fr, en]) => EN[fr] !== en).map(([fr]) => fr), [], 'T6 i18n : chaque texte neuf de la spec § 5 (UI-1) a son entrée en.js, à l’anglais exact de la table');
    eq(CLES_REEMPLOYEES.filter((k) => typeof EN[k] !== 'string' || !EN[k]), [], 'T6 i18n : les clés réemployées (Corriger, Ingrédients, Préparation, Ajouter un livre, Favoris, Mes livres, Livres, Plats) gardent une entrée');
    eq([EN['Corriger'], EN['Mes livres']], ['Fix', 'My books'], 'T6 i18n : « Corriger » reste « Fix » (H-14) et « Mes livres » reste « My books » (le segment de la recherche, D-UI-4)');
    // Chaque texte neuf est bien ÉCRIT quelque part dans les modules du lot, en t('…') littéral : une table sans emploi serait un filet creux.
    const employes = new Set(MODULES_UI1.flatMap((m) => [...parModule[m]]));
    eq(Object.keys(TEXTES_UI1).filter((fr) => !employes.has(fr)), [], 'T6 i18n : chaque texte neuf de la table est écrit en t(\'…\') dans au moins un module du lot (library, recipe, book, home, components, accueil-livre, import-web, import-cible, add)');
    // Filet CALCULÉ : pour les cinq modules hors MODULES_NEUFS, tout texte neuf qu'ils écrivent figure dans CHAINES_NEUVES_AILLEURS[module].
    const manquantes = HORS_MODULES_NEUFS.flatMap((m) => [...parModule[m]].filter((k) => k in TEXTES_UI1 && !(CHAINES_NEUVES_AILLEURS[m] || []).includes(k)).map((k) => `${m} : ${k}`));
    eq(manquantes, [], 'T6 i18n : CHAINES_NEUVES_AILLEURS (tests/ajouter.js) est à jour pour library.js, recipe.js, book.js, home.js et components.js — chaque texte neuf qu’ils écrivent y est listé');
    eq(['../src/ui/accueil-livre.js', '../src/ui/import-web.js', '../src/ui/import-cible.js', '../src/ui/add.js', '../src/ui/icones.js'].filter((m) => !MODULES_NEUFS.includes(m)), [], 'T6 i18n : accueil-livre.js, import-web.js, import-cible.js, add.js et icones.js sont dans MODULES_NEUFS (scannés en entier ; icones.js : S14 — ni innerHTML, ni html:)');
    // Les chaînes retirées ont quitté en.js, les filets ET chaque module de SHELL (sw.js lu comme un tableau, X4 du lot C).
    const sw = await lireT6('../sw.js');
    // Le TABLEAU SHELL, sans ses commentaires (la forme X4 du lot C, tests/table-matieres.js:1674) ; seuls les modules de src/ hors vendor sont relus.
    const shell = [...(sw.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    ok(shell.length > 30 && shell.includes('./src/ui/icones.js'), `T6 SHELL : lu comme un tableau (${shell.length} entrées) et il porte ./src/ui/icones.js`);
    const srcShell = Object.fromEntries(await Promise.all(shell.filter((m) => m.startsWith('./src/') && m.endsWith('.js') && !m.includes('/vendor/')).map(async (m) => [m, await lireT6('.' + m)])));
    const restes = CHAINES_RETIREES.flatMap((c) => [
      ...(c in EN ? [`en.js : ${c}`] : []),
      ...Object.values(CHAINES_NEUVES_AILLEURS).some((l) => l.includes(c)) ? [`CHAINES_NEUVES_AILLEURS : ${c}`] : [],
      ...Object.entries(srcShell).filter(([, s]) => clesDe(s).includes(c)).map(([m]) => `${m} : ${c}`),
    ]);
    eq(restes, [], 'T6 chaînes retirées : « + Recette », « + Pages d’index », « Ouvrir le lien », « Aller à Mes livres. » ne sont plus ni dans en.js, ni dans les filets, ni en t(\'…\') dans aucun module de SHELL');
    eq([/label: 'Bibliothèque'/.test(srcShell['./src/app.js']), /label: 'Mes livres'/.test(srcShell['./src/app.js']), clesDe(srcShell['./src/ui/search.js']).includes('Mes livres') || /\['books', 'Mes livres'\]/.test(srcShell['./src/ui/search.js'])],
      [true, false, true], 'T6 D-UI-4 : NAV (app.js, hors suite : lu au source) dit « Bibliothèque » et plus « Mes livres » ; le segment « Mes livres » de la recherche (search.js MODES) reste');
    // I-UI-4 : les règles neuves du lot existent dans la feuille servie (garde positive ; T-1, T-2, T-11 et le survol sont tenus par tests/theme.js sur TOUTE la feuille).
    const css = (await lireT6('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
    const selecteurs = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
    const SELECTEURS_UI1 = ['.carte-plat', '.sans-photo', '.grille-plats', '.plat-vignette.grande', '.plat-vignette.petite', 'section.plain', '.two-col.livre', '.titre-fiche', '.grid.livres', '.liste-compacte', '.fiche-tete', '.reperes', '[data-role=autres-gestes]'];
    const present = (s) => selecteurs.some((sel) => sel.split(',').some((part) => part.trim().includes(s) || part.trim().includes(s.replace('=autres-gestes]', '="autres-gestes"]'))));
    eq(SELECTEURS_UI1.filter((s) => !present(s)), [], 'T6 I-UI-4 : les treize sélecteurs neufs du lot (spec § 3.3, § 4) existent dans styles.css');
    eq([...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => /\.plat-vignette\b/.test(s)), ['.plat-vignette', '.plat-vignette.grande', '.plat-vignette.petite'], 'T6 § 3.3 : exactement trois sélecteurs nomment .plat-vignette, dans cet ordre (72 px, grande 4:3, petite 48 px)');
  } catch (e) { ok(false, `T6 filets : bloc interrompu — ${e?.message || String(e)}`); } // un source illisible est UN rouge nommé, jamais une suite coupée en silence
```

- [ ] **Step 2 : rouge lu.** `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096`. Attendu : le bilan `❌`, et les rouges pour la
  BONNE raison, lus ligne à ligne dans `ECHECS` :
  - « CHAINES_NEUVES_AILLEURS … à jour » ROUGE si T2 à T5 n'ont pas listé toutes leurs chaînes (le texte de l'échec nomme `module : clé`) ;
  - « chaînes retirées » ROUGE si `en.js` porte encore `"+ Pages d’index"`, `"+ Recette"`, `"Ouvrir le lien"` ou `"Aller à Mes livres."`, ou si
    `tests/ajouter.js:25, 37` (les listes de `book.js` et de `recipe.js` à `f3672be`) les listent encore ;
  - « chaque texte neuf … entrée en.js » ROUGE si une traduction manque ou diffère de la table (« Disponibles », « Reprendre la séance », « {n} à importer », « Page {n} · p. {p} » : relire T4/T5) ;
  - « icones.js dans MODULES_NEUFS » ROUGE si T1 ne l'a pas posé (spec § 7 T1 le demande : ici c'est un filet de clôture) ;
  - l'épingle de `tests/tests.js` ROUGE (la tâche ajoute 12 assertions).
  Si TOUT est vert d'emblée hors l'épingle (T2 à T5 ont tout fait) : le rouge se voit sur une COPIE (Step 7, mutants M-UI6-1 à M-UI6-4), jamais en
  place (précédent : la tâche 6 du lot C, « vert d'emblée, rouge vu sur copie », `7c519f8`).

- [ ] **Step 3 : implémenter les filets — `tests/ajouter.js`, puis `src/i18n/en.js`.** Aucun module de `src/ui` n'est touché ici : un texte neuf
  absent d'un module, ou une chaîne retirée encore écrite, est un constat pour la revue de la tâche qui possède le module (T2 à T5), consigné dans
  `progress.md`, jamais corrigé en douce par T6.
  1. `tests/ajouter.js:8` — si `'../src/ui/icones.js'` manque à `MODULES_NEUFS`, l'ajouter en FIN de liste et compléter le commentaire de la l. 7 par
     ` + les icônes au trait (lot UI-1, tâche 1 ; aucun t() : le filet S14 y vaut pour innerHTML et html:)`.
  2. `tests/ajouter.js`, `CHAINES_NEUVES_AILLEURS` — les COMPLÉMENTS (une ligne commentée « Lot UI-1, tâche 6 » par module touché ; les chaînes posées par T2 à T5 ne sont
     pas doublées : on complète, on ne réécrit pas ; le filet du Step 1 — « à jour », CALCULÉ — dit exactement ce qui manque ; A-9) :

```js
  '../src/ui/book.js': [ /* … les entrées des lots UX, A, G, E (sans '+ Pages d’index' ni '+ Recette', retirées par T4) et les huit chaînes de T4 … */
    // Lot UI-1, tâche 6 : complément (A-9) — le retour « ← Bibliothèque » (T1) ; les filtres « Toutes » et « Disponibles », antérieurs au lot mais écrits
    // par t() et portés par la table TEXTES_UI1 (entrées en.js posées par T2 et T4) : le filet CALCULÉ du Step 1 les exige ici.
    'Bibliothèque', 'Toutes', 'Disponibles'],
  '../src/ui/recipe.js': [ /* … les entrées des lots A, B, C (sans 'Ouvrir le lien', retirée par T3) et les deux chaînes de T3 … */
    // Lot UI-1, tâche 6 : complément (A-9) — le retour « ← Bibliothèque » (T1) et « 1 portion » (repères, T3 ; clé antérieure, en.js:341).
    'Bibliothèque', '1 portion'],
  // '../src/ui/components.js' : INCHANGÉE — 'Du web · {h}', 'De mon livre · {t}' (T2), 'Voir la page d’origine' (T3), 'À importer', 'À importer · p. {p}',
  // 'Disponible', 'Partielle' (T5) y sont déjà ; '../src/ui/library.js' : INCHANGÉE — les douze chaînes de T2 ('Bibliothèque' comprise) et '{n} à importer' (T5) ;
  // '../src/ui/home.js' : INCHANGÉE — ['Cherche une recette, un ingrédient, une envie.'] posée par T5. Relues, jamais redoublées.
```

     (`'../src/ui/accueil-livre.js'`, `'../src/ui/import-web.js'`, `'../src/ui/import-cible.js'`, `'../src/ui/add.js'` : rien à lister, ils sont
     dans `MODULES_NEUFS`, scannés en entier.) Si une chaîne de ces listes n'est PAS écrite dans son module (l'assertion « CHAINES_NEUVES_AILLEURS
     … à jour » ne le voit pas : elle ne regarde que ce qui EST écrit), elle reste inoffensive pour le filet de `tests/ajouter.js` (il vérifie `cle in
     EN`) ; la liste ci-dessus suit § 4 et se relit sur le code réel au Step 0 (amendement nommé si T2-T5 ont rangé un texte ailleurs).
  3. `src/i18n/en.js` — retirer, SI encore présentes (relues par leur texte), les quatre lignes :

```js
  "Aller à Mes livres.": "Go to My books.",
  "+ Pages d’index": "+ Index pages",
  "+ Recette": "+ Recipe",
  "Ouvrir le lien": "Open the link",
```

     et rien d'autre (`'Mes livres': 'My books'`, l. 4, RESTE : segment de la recherche). Toute entrée de `TEXTES_UI1` absente d'`en.js` à ce stade est
     un constat pour T2-T5 (chaque tâche devait poser ses entrées, § 7) : il est consigné dans `progress.md` ET l'entrée est posée ici, à l'anglais de
     la table, pour que la clôture soit verte (une entrée, pas un texte d'écran : aucun module de `src/ui` n'est touché).
- [ ] **Step 4 : vert, épingle, version.** `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` : tout vert SAUF l'épingle ;
  `tests/theme.js` vert sans changement (T-1 inventaire des `display: none` = les cinq d'origine, T-2 couleurs en dur = liste blanche `#fff`, `#222`,
  T-11 `56px` sur `.btn.big` seul, survols sous `@media (hover: hover)` : c'est le filet « aucune couleur en dur ni display:none neuf » de la spec § 7,
  déjà porté, relu vert ici sur la feuille de T1 à T5). Puis `tests/tests.js:250` : `eq(results.length, <obtenu − 1>, …)`, la valeur lue dans
  « obtenu » du bilan rouge, jamais devinée (règle N−1 : l'assertion du total s'ajoute elle-même). `sw.js:4` : `VERSION = 'cuisine-os-v0.17.0-(K+1)'`
  **ssi** le Step 3.3 a modifié `src/i18n/en.js` (R-B-24 ; K = le suffixe relevé au Step 0) ; sinon `sw.js` ne bouge pas et la tâche ne porte aucune
  version. Relancer : `✅ N/N` ; `node --test tools/*.test.mjs` 208/208 ; `node tools/generer-migrations.mjs --check` 0. Les deux fichiers neufs du
  lot (`tests/carnet.js`, `src/ui/icones.js`) et `tests/ajouter.js`, `src/i18n/en.js` passent le scan des invisibles (Step 9).

- [ ] **Step 5 : l'outil de preuve visuelle — copie, puis adaptations** (registre, hors git ; Playwright DÉDIÉ depuis le cache npx, jamais le
  navigateur MCP partagé ; aucun fichier suivi touché). Copie :

```bash
R=.superpowers/sdd/2026-10-23-experience-carnet
cp ~/projects/mistu/.superpowers/sdd/2026-10-18-refonte-visuelle/preuve-visuelle.cjs "$R/preuve-visuelle.cjs"
cp ~/projects/mistu/.superpowers/sdd/2026-10-18-refonte-visuelle/galerie.html "$R/galerie.html"
mkdir -p "$R/captures"
```

  Puis, dans `$R/preuve-visuelle.cjs`, ces remplacements EXACTS (le reste du fichier est conservé tel quel : mesures `mesurerEnPage`, captures,
  contexte, `attendreCoquille`, `attendreRoute`, `allerA`, M14, rapport) :
  1. **En-tête** : la première ligne du commentaire ` * PREUVE VISUELLE DU CONTROLEUR — lot « Refonte visuelle magazine culinaire » (spec § 0 V-6, plan T3).`
     devient ` * PREUVE VISUELLE — lot UI-1 « Experience carnet » (spec 2026-10-23 § 7 « Preuve visuelle », § 13 point 3) ; copie adaptee de l'outil du lot refonte (18 oct).` ;
     la ligne ` *   - port (defaut 8085) : le serveur de l'arbre (python3 -m http.server 8085 dans ~/projects/mistu-look) doit tourner.` devient
     ` *   - port (defaut 8096) : le serveur du worktree ~/projects/mistu-carnet doit tourner (python3 -m http.server 8096 --bind 127.0.0.1).` ;
     la ligne ` *   - --largeurs, --seulement : pour un essai rapide (par defaut les 4 largeurs et app + galerie + m3).` devient
     ` *   - --largeurs, --seulement : pour un essai rapide (par defaut les 4 largeurs et app + galerie + etroit ; etroit = la galerie a 320 px, onglet « Bibliotheque »).` ;
     le paragraphe ` *   M3 (section a part) : …` jusqu'à ` *                 Repli si le vol ne peut pas etre produit : geometrie de la garde « assistant non configure » + segments.` est REMPLACÉ par
     ` *   M3 : NON rejouee. L'app ne poste plus a api.anthropic.com (lot passerelle) : un vrai vol exige une session ; search.js ne change pas en UI-1 (R-VIS-8 inchange, tests/theme.js le tient).` ;
     ` *   M14 (section a part ; AJOUT de la tache 3 …` : ` si l'anneau n'est pas tomate (--action)` devient ` si l'anneau n'est pas olive (--action)` ;
     après le paragraphe M14, ajouter :

```
 *   ONGLET (colonne « onglet », D-UI-4, § 13 point 3) : `nav.tabs a[href="#/library"]` visible sous 900 px : son libelle est exactement
 *                 « Bibliothèque », tient sur UNE ligne (Range.getClientRects) et ne deborde pas de son onglet (bords, scrollWidth). Mesure dans
 *                 l'app (bibliotheque, 375/390/768) et dans la galerie (375/390/768, plus la passe « etroit » a 320 x 568). Repli « Carnet » si KO.
 *   DONNEES : avant les routes, `semer(page, 'peu')` ecrit dans la base JETABLE du contexte (IndexedDB d'un contexte Playwright neuf, jamais la
 *                 bibliotheque de Neegan) un livre, douze recettes (deux a photo), deux pages de sommaire, deux favoris, une cuisson ; `semer(page,
 *                 'beaucoup')` pose une photo sur chaque recette disponible (neuf) avant la ligne « bibliotheque-photos ».
```

  2. **Constantes** (`// ---- arguments`) :

```js
const PORT = argv.find((x) => /^\d+$/.test(x)) || '8096';
```
```js
const SEULEMENT = (opt('seulement') || 'app,galerie,etroit').split(',');
const TOUTES = [[375, 812], [390, 844], [768, 1024], [1512, 982]];
const ETROIT = [320, 568]; // § 13 point 3 : « Bibliothèque » dans l'onglet a 320 px (iPhone en « Agrandir l'affichage »), galerie seulement
```
```js
const GALERIE_URL = `${BASE}/.superpowers/sdd/2026-10-23-experience-carnet/galerie.html`;
// Identifiants FIXES des fiches semees (semer) : les routes les visent sans closure.
const IDS = { edition: 'ed_pv', livre: 'b_pv', longue: 'rc_pv_long', web: 'rc_pv_web', reference: 'rc_pv_ref' };
const ROUTES = [
  ['accueil', '#/'],                                                   // § 4.4 : pageHeader + grilleCartes (Favoris, Dernieres cuissons)
  ['bibliotheque', '#/library'],                                       // § 4.1 : segment Recettes par defaut, PEU de photos (2 sur 10 cartes)
  ['bibliotheque-importer', '#/library?tab=a-importer'],               // § 4.1 : pied « Recettes de mes livres a importer »
  ['livres', '#/library?tab=books'],                                   // § 4.1 : grille des livres (.grid.livres), « Liens web gardes » en plain
  ['fiche-recette', `#/recipes/${IDS.longue}`],                        // § 4.2, D-UI-3 : titre long, photo, deux colonnes >= 760 / segmented dessous
  ['fiche-recette-web', `#/recipes/${IDS.web}`],                       // § 4.2, D-UI-6, D-UI-10 : non verifiee (« Corriger » visible), « Du web · {h} », « Voir la page d’origine »
  ['fiche-livre', `#/books/${IDS.edition}`],                           // § 4.3, D-UI-7 : .two-col.livre >= 900, 8 lignes + « Voir les {n} recettes » dessous
  ['import-cible', `#/recipes/${IDS.reference}/importer`],             // § 4.5 : badge « A importer »
  ['ajouter', '#/add'],                                                // § 4.5 : icones au trait
  ['recherche-web', '#/search?mode=web'],                              // § 4.6 : theme seulement (carte web inchangee)
  ['creer-ia', '#/recipes/creer'], ['reglages', '#/settings'], ['cuisine', '#/kitchen'],   // § 8 : couleurs et titres seulement
];
```

  3. **Le journal de la ligne gagne la colonne « onglet »** — `ligne()` :

```js
function ligne(largeur, nom, mesure, journal, debut, extra = {}) {
  const erreurs = journal.slice(debut);
  const etat = {
    debordement: mesure.debordement.fautes.length,
    navigation: mesure.nav ? mesure.nav.fautes.length : null,
    cibles: mesure.cibles.length,
    contraste: mesure.contraste ? mesure.contraste.echecs : null,
    hidden: mesure.hidden ? mesure.hidden.length : null,
    onglet: extra.onglet ? extra.onglet.fautes.length : null, // D-UI-4 : null = non mesure (>= 900 px : nav.tabs cachee)
    console: erreurs.length,
  };
  const r = { largeur, page: nom, etat, mesure, erreurs, notes: extra.notes || [], onglet: extra.onglet || null };
  lignes.push(r);
  return r;
}
```

  4. **La mesure de l'onglet** (fonction sérialisée, posée après `mesurerEnPage`) :

```js
// Fonction serialisee : l'onglet « Bibliothèque » (D-UI-4, § 13 point 3) tel que RENDU — texte exact, une seule ligne, sans debordement.
function mesurerOngletEnPage(sel) {
  const a = document.querySelector(sel);
  if (!a) return { introuvable: true, fautes: [`onglet introuvable (${sel})`] };
  const nav = a.closest('nav.tabs');
  if (!nav || getComputedStyle(nav).display === 'none') return { visible: false, fautes: [] }; // >= 900 px : le panneau lateral prend le relais (mesure sans objet)
  const lib = a.querySelector('span:last-child');
  const texte = lib ? lib.textContent.trim() : '';
  const rg = document.createRange(); if (lib) rg.selectNodeContents(lib);
  const lignes = lib ? [...rg.getClientRects()].filter((r) => r.width > 0 && r.height > 0).length : 0;
  const r = lib ? lib.getBoundingClientRect() : null; const ra = a.getBoundingClientRect();
  const deborde = !!r && (r.right > ra.right + 0.5 || r.left < ra.left - 0.5 || lib.scrollWidth > lib.clientWidth + 0.5);
  const fautes = [];
  if (texte !== 'Bibliothèque') fautes.push(`libelle « ${texte} », attendu « Bibliothèque »`);
  if (lignes !== 1) fautes.push(`libelle sur ${lignes} ligne(s), attendu 1`);
  if (deborde) fautes.push(`libelle deborde de l'onglet (libelle ${Math.round(r.width)} px, onglet ${Math.round(ra.width)} px)`);
  return { visible: true, texte, lignes, deborde, largeurLibelle: Math.round((r ? r.width : 0) * 10) / 10, largeurOnglet: Math.round(ra.width * 10) / 10, police: lib ? parseFloat(getComputedStyle(lib).fontSize) : null, fautes };
}
```

  5. **Les données semées** (posée avant `parcoursApp` ; tourne DANS la page, sur la base jetable du contexte, par les modules réels de l'app —
  mêmes URL que celles d'`app.js`, donc mêmes instances) :

```js
// ---------------------------------------------------------------- donnees semees (base JETABLE du contexte Playwright)
// Les modules de l'app sont importes par leur URL absolue (celle que src/app.js resout) : meme instance de repo.js, meme base ouverte par app.js.
// `niveau` : 'peu' = un livre (ed_pv), 10 recettes du livre (7 disponibles + celle au titre long, a photo ; 2 a importer), 1 recette web, 1 signet non
// lu, 2 photos en tout, 2 pages de sommaire, 2 favoris, 1 cuisson ; 'beaucoup' = une photo sur CHAQUE recette disponible (9 : les 7, la longue, la web). Rien de reel :
// titres de fixtures, hote d'exemple en .test, images fabriquees par canvas.
async function semer(page, niveau) {
  await page.evaluate(async (niv) => {
    const repo = await import('/src/model/repo.js');
    const { sha256Hex } = await import('/src/core/hash.js');
    const { invalidate } = await import('/src/ui/state.js');
    const DATE = '2026-10-20T12:00:00.000Z';
    const image = async (couleur) => {
      const c = new OffscreenCanvas(640, 480); const g = c.getContext('2d');
      g.fillStyle = couleur; g.fillRect(0, 0, 640, 480); g.fillStyle = '#fff'; g.fillRect(0, 0, 160, 120);
      const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); const sha = await sha256Hex(blob);
      await repo.putFile(sha, blob, { mime: 'image/jpeg', origin: 'device' }); return sha;
    };
    const fiche = (id, titre, over = {}) => ({ id, edition_id: 'ed_pv', original_title: titre, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], photo_sha256: null, photo_origin: null, source_url: null, created_at: DATE, updated_at: DATE, ...over });
    const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: 15, cook_minutes: 20, active_minutes: null, total_minutes: 35,
      ingredients: [{ id: 'ri_' + rid + '_1', source_text: '2 fenouils', name_text: 'fenouil', quantity: { raw: '2', value: 2 }, unit_id: null, verification_state: 'verified' }, { id: 'ri_' + rid + '_2', source_text: '600 g de saumon', name_text: 'saumon', quantity: { raw: '600', value: 600 }, unit_id: null, verification_state: 'verified' }, { id: 'ri_' + rid + '_3', source_text: '1 orange', name_text: 'orange', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }],
      steps: [{ id: 'st_' + rid + '_1', position: 1, text: 'Emincer le fenouil et le faire revenir.' }, { id: 'st_' + rid + '_2', position: 2, text: 'Ajouter le saumon, enfourner 20 minutes.' }, { id: 'st_' + rid + '_3', position: 3, text: 'Servir avec les quartiers d’orange.' }],
      constraints: {}, changes: '', notes: '', provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: 'ed_pv', convention_snapshot: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
    const DISPONIBLES = [['rc_pv_01', 'Soupe à l’oignon', 12], ['rc_pv_02', 'Tarte aux pommes de ma grand-mère', 48], ['rc_pv_03', 'Saumon rôti au fenouil et à l’orange', 76], ['rc_pv_04', 'Pâtes puttanesca', 90], ['rc_pv_05', 'Risotto aux champignons', 104], ['rc_pv_06', 'Poulet au citron et aux olives', 118], ['rc_pv_07', 'Gratin dauphinois', 160]];
    const COULEURS = ['#b5462f', '#4f6b2e', '#8b5f10', '#45604a', '#636860', '#242821', '#3e5424', '#98231b', '#55705a', '#8f8a80'];
    if (niv === 'peu') {
      const [shaLong, sha03] = [await image(COULEURS[0]), await image(COULEURS[1])];
      const recettes = [
        ...DISPONIBLES.map(([id, titre, p]) => fiche(id, titre, { printed_page: p, favorite: id === 'rc_pv_03', photo_sha256: id === 'rc_pv_03' ? sha03 : null, photo_origin: id === 'rc_pv_03' ? 'image' : null })),
        fiche('rc_pv_ref', 'Tarte aux poires', { availability: 'reference_only', verification_state: 'unverified', printed_page: 132, current_version_id: null }),
        fiche('rc_pv_ref2', 'Bœuf braisé', { availability: 'reference_only', verification_state: 'unverified', printed_page: 140, current_version_id: null }),
        fiche('rc_pv_long', 'The Particular Sadness of Lemon Cake', { original_language: 'en', printed_page: 212, favorite: true, photo_sha256: shaLong, photo_origin: 'image' }),
        fiche('rc_pv_web', 'Pavé de saumon, fenouil braisé', { edition_id: null, source_url: 'https://www.exemple-recettes.test/pave-de-saumon', verification_state: 'unverified' }),
        fiche('rc_pv_signet', 'Un lien gardé, pas encore lu', { edition_id: null, availability: 'reference_only', verification_state: 'unverified', source_url: 'https://www.exemple-recettes.test/lien-garde', current_version_id: null }),
      ];
      const versions = recettes.filter((r) => r.current_version_id).map((r) => version(r.id, r.id === 'rc_pv_web' ? { verification_state: 'unverified', provenance: { source_page_ids: [], generated_by: 'ai', model: null, edition_id: null, convention_snapshot: null } } : {}));
      await repo.saveBatch({
        books: [{ id: 'b_pv', title: 'À la di Stasio', author: 'Josée Di Stasio', cuisines: [], tags: [], created_at: DATE, updated_at: DATE }],
        book_editions: [{ id: 'ed_pv', book_id: 'b_pv', isbn: '9782890772816', publisher: 'Flammarion Québec', year: 2004, language: 'fr', unit_convention_id: null, created_at: DATE, updated_at: DATE }],
        recipes: recettes, recipe_versions: versions,
        cook_history: [{ id: 'ch_pv_1', recipe_id: 'rc_pv_04', recipe_version_id: 'rv_rc_pv_04', cooked_at: DATE, servings: 4, rating: 4, redo: true, created_at: DATE, updated_at: DATE }],
      }, { origin: 'device' });
      // Deux pages de sommaire par le chemin reel (octets puis seance), marquees index et la seance close : « Sommaire » (§ 4.3) sans « Reprendre la seance ».
      const photo = async (nom, couleur) => { const c = new OffscreenCanvas(600, 800); const g = c.getContext('2d'); g.fillStyle = couleur; g.fillRect(0, 0, 600, 800); g.fillStyle = '#fff'; g.fillRect(40, 40, 520, 720); return new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' }); };
      const { session, pages } = await repo.ajouterPages([await photo('sommaire-1.jpg', '#e9eddf'), await photo('sommaire-2.jpg', '#f8f5ef')], { edition_id: 'ed_pv' });
      for (const [i, p] of pages.entries()) await repo.save('source_pages', { ...p, kind: 'index', printed_page: 6 + i });
      await repo.save('scan_sessions', { ...session, status: 'done' });
    } else {
      const toutes = (await repo.all('recipes')).filter((r) => r.availability === 'available' && !r.photo_sha256);
      for (const [i, r] of toutes.entries()) await repo.save('recipes', { ...r, photo_sha256: await image(COULEURS[(i + 2) % COULEURS.length]), photo_origin: 'image' });
    }
    invalidate();
  }, niveau);
}
```

  6. **`parcoursApp`** — réécrite ainsi (la porte, les captures et le journal sont ceux de l'outil source ; les données sont semées après la porte,
  l'onglet mesuré sur chaque route, la ligne « bibliotheque-photos » après `semer('beaucoup')`) :

```js
async function parcoursApp(browser, taille) {
  const [largeur] = taille;
  const { ctx, page, journal } = await nouveauContexte(browser, taille);
  try {
    log(`[app ${largeur}] ouverture`);
    let debut = journal.length;
    await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 40000 });
    const mesurerPorte = async () => {
      await page.evaluate(() => document.fonts && document.fonts.ready); await page.waitForTimeout(250);
      const m = await page.evaluate(mesurerEnPage, { nav: false, contraste: true, hidden: false });
      ligne(largeur, 'porte', m, journal, debut);
      await capturer(page, 'porte', largeur);
    };
    const passee = await attendreCoquille(page, largeur, mesurerPorte);
    if (!passee) log(`[app ${largeur}] ATTENTION : aucune porte d'entree rencontree (synchro non configuree sur cette adresse ?)`);
    await attendreRoute(page);
    await semer(page, 'peu');
    const visiter = async (nom, hash) => {
      debut = journal.length;
      await allerA(page, hash);
      const m = await page.evaluate(mesurerEnPage, { nav: true, navDansEcran: true, contraste: true, hidden: false });
      const onglet = await page.evaluate(mesurerOngletEnPage, 'nav.tabs a[href="#/library"]');
      const notes = [];
      if (onglet.visible) notes.push(`onglet « ${onglet.texte} » : ${onglet.lignes} ligne, libelle ${onglet.largeurLibelle} px dans ${onglet.largeurOnglet} px, police ${onglet.police} px`);
      if (nom === 'bibliotheque' || nom === 'bibliotheque-photos') {
        const g = await page.evaluate(() => {
          const grille = document.querySelector('.grille-plats'); if (!grille) return null;
          const cartes = [...grille.querySelectorAll('.carte-plat')];
          const cols = new Set(cartes.map((c) => Math.round(c.getBoundingClientRect().left))).size;
          return { cartes: cartes.length, photos: grille.querySelectorAll('img.plat-vignette.grande').length, sansPhoto: grille.querySelectorAll('.carte-plat.sans-photo').length, colonnes: cols, cadresVides: [...grille.querySelectorAll('img')].filter((i) => !i.getAttribute('src')).length };
        });
        notes.push(g ? `grille : ${g.cartes} cartes, ${g.photos} photos, ${g.sansPhoto} sans photo, ${g.colonnes} colonne(s), ${g.cadresVides} cadre(s) vide(s)` : 'grille .grille-plats INTROUVABLE');
        if (!g || g.cadresVides > 0) onglet.fautes.push(g ? `${g.cadresVides} <img> sans src dans la grille (I-UI-5 : jamais de cadre vide)` : 'grille .grille-plats introuvable (§ 4.1)');
      }
      ligne(largeur, nom, m, journal, debut, { notes, onglet: onglet.visible || onglet.introuvable || onglet.fautes.length ? onglet : null });
      await capturer(page, nom, largeur);
    };
    if (SEULEMENT.includes('app')) {
      for (const [nom, hash] of ROUTES) await visiter(nom, hash);
      await semer(page, 'beaucoup');
      await visiter('bibliotheque-photos', '#/library');                 // § 7 : la bibliotheque Recettes avec BEAUCOUP de photos (les 9 disponibles sur 10 cartes)
    }
  } catch (e) {
    log(`[app ${largeur}] ECHEC DU SCRIPT : ${e.stack || e}`);
    lignes.push({ largeur, page: 'app (script)', etat: { debordement: 0, navigation: null, cibles: 0, contraste: null, hidden: null, onglet: null, console: 1 }, mesure: null, erreurs: [`le script a plante : ${String(e.message).split('\n')[0]}`], notes: [], onglet: null });
  } finally { await ctx.close(); }
}
```

  (`allerA('#/library')` pour « bibliotheque-photos » part de `#/kitchen`, la dernière route : le `hashchange` a lieu et la route relit la base,
  `invalidate()` ayant été appelé par `semer`.) La ligne `['bibliotheque', '#/library']` capture la grille avec 2 photos sur 10 cartes (les deux
  références sont dehors, le signet dedans sans photo ni durée) ; « bibliotheque-photos », 9 photos sur 10.

  7. **`parcoursGalerie`** — après le chargement (`goto` ou `setContent`), AVANT `document.fonts.ready` :

```js
    await page.waitForFunction(() => document.documentElement.dataset.galeriePrete === '1', null, { timeout: 20000 }); // le module de la galerie a monte les composants reels
```

  et la ligne `ligne(largeur, 'galerie', m, journal, debut, { notes });` devient :

```js
    const onglet = await page.evaluate(mesurerOngletEnPage, '[data-nom="onglets"] nav.tabs a[href="#/library"]');
    if (onglet.visible) notes.push(`onglet « ${onglet.texte} » : ${onglet.lignes} ligne, libelle ${onglet.largeurLibelle} px dans ${onglet.largeurOnglet} px`);
    ligne(largeur, 'galerie', m, journal, debut, { notes, onglet: onglet.visible || onglet.introuvable ? onglet : null });
```

  (le bloc `onglets` de la galerie garde la règle `nav.tabs { display: none }` ≥ 900 px : l'onglet y est mesuré à 375, 390 et 768, `-` à 1512). La
  ligne `'galerie (dialogue modal)'` ne change pas.

  8. **La passe « etroit »** (posée après `parcoursGalerie`) — la galerie seule, à 320 × 568, pour l'onglet (§ 13 point 3 : si KO, le repli est
  « Carnet », décision de Neegan, pas une correction de T6) :

```js
// ---------------------------------------------------------------- etroit : la galerie a 320 px, l'onglet « Bibliothèque » (§ 13 point 3)
async function parcoursEtroit(browser) {
  const [largeur] = ETROIT;
  const { ctx, page, journal } = await nouveauContexte(browser, ETROIT);
  try {
    log(`[etroit ${largeur}] ouverture de la galerie`);
    const debut = journal.length;
    const rep = argv.includes('--setcontent') ? null : await page.goto(GALERIE_URL, { waitUntil: 'load', timeout: 40000 }).catch(() => null);
    if (!rep || rep.status() !== 200) {
      const html = fs.readFileSync(path.join(DOSSIER, 'galerie.html'), 'utf8').replace('<head>', `<head><base href="${BASE}/">`);
      await page.goto('about:blank'); await page.setContent(html, { waitUntil: 'load' });
    }
    await page.waitForFunction(() => document.documentElement.dataset.galeriePrete === '1', null, { timeout: 20000 });
    await page.evaluate(() => document.fonts && document.fonts.ready); await page.waitForTimeout(300);
    // Seul le bloc des onglets est juge ici (le debordement du reste de la galerie a 320 px — la barre haute avec pastille, 341 px — est connu : spec refonte § 11).
    const m = await page.evaluate(mesurerEnPage, { nav: false, contraste: true, hidden: false, racine: '[data-nom="onglets"]', sansDebordement: true });
    const onglet = await page.evaluate(mesurerOngletEnPage, '[data-nom="onglets"] nav.tabs a[href="#/library"]');
    const tous = await page.evaluate(() => [...document.querySelectorAll('[data-nom="onglets"] nav.tabs a')].map((a) => { const s = a.querySelector('span:last-child'); const rg = document.createRange(); rg.selectNodeContents(s); return `${s.textContent.trim()} ${Math.round(s.getBoundingClientRect().width)}/${Math.round(a.getBoundingClientRect().width)} px, ${[...rg.getClientRects()].filter((r) => r.width > 0).length} ligne(s)`; }));
    ligne(largeur, 'galerie (onglets)', m, journal, debut, { notes: [`onglets a ${largeur} px : ${tous.join(' ; ')}`], onglet });
    const bloc = page.locator('section.bloc[data-nom="onglets"]');
    await capturer(page, 'galerie-onglets', largeur, bloc);
  } catch (e) {
    log(`[etroit ${largeur}] ECHEC DU SCRIPT : ${e.stack || e}`);
    lignes.push({ largeur, page: 'galerie (onglets, script)', etat: { debordement: 0, navigation: null, cibles: 0, contraste: null, hidden: null, onglet: null, console: 1 }, mesure: null, erreurs: [`le script a plante : ${String(e.message).split('\n')[0]}`], notes: [], onglet: null });
  } finally { await ctx.close(); }
}
```

  9. **M3 retirée** : supprimer, de la ligne `// ---------------------------------------------------------------- M3 : « Chercher à nouveau » (K1) contre « Annuler »`
  jusqu'à l'accolade qui ferme `async function mesurerM3` (incluse : le bloc `REPONSE_FACTICE`, `recouvrement`, `ecartVertical`, `boite`, `mesurerM3`),
  et la ligne `const m3Resultats = [];` devient `const m3Resultats = []; // M3 : non rejouee en UI-1 (voir l'en-tete) ; le tableau reste vide, la section du rapport ne s'imprime pas`.
  Le rapport garde son `if (m3Resultats.length) { … }` (inerte). La clé `m3` de `resultats.json` reste (vide).
  10. **M14** : dans `mesurerClavier`, `fautes.push(\`anneau ${m.couleur}, attendu tomate ${m.action}\`)` devient `attendu olive ${m.action}` ; dans
  `rapport()`, le titre `## M14 — focus clavier (Tab) dans la galerie : anneau visible, tomate, non coupe` devient `… anneau visible, olive, non coupe`.
  11. **Rapport et boucle principale** : l'en-tête du tableau devient
  `'| largeur | page | debordement | navigation | cibles | contraste | [hidden] | onglet | console |', '|---|---|---|---|---|---|---|---|---|'` et chaque ligne
  `… | ${cellule(l.etat.hidden)} | ${cellule(l.etat.onglet)} | ${cellule(l.etat.console)} |` ; dans « Detail des fautes », après le bloc `[hidden]`, ajouter
  `if (l.onglet) for (const f of l.onglet.fautes) sortie.push(\`- onglet : ${f}\`);` ; la première ligne du rapport devient
  `# Preuve visuelle UI-1 « Experience carnet » — ${BASE} — ${new Date().toISOString()}`. Boucle principale :

```js
    for (const t of TAILLES) {
      if (SEULEMENT.includes('app')) await parcoursApp(browser, t);
      if (SEULEMENT.includes('galerie')) await parcoursGalerie(browser, t);
    }
    if (SEULEMENT.includes('etroit')) await parcoursEtroit(browser);
```

  `node --check .superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs` : 0.

- [ ] **Step 6 : la galerie — `$R/galerie.html`** (copie du lot refonte, adaptée ; elle lie `/styles.css` et n'écrit aucune couleur ni taille de
  composant ; les composants NEUFS du lot y sont montés par les modules RÉELS, jamais recopiés en balisage). Remplacements exacts :
  1. En-tête : `<title>Galerie — refonte visuelle</title>` → `<title>Galerie — expérience carnet (UI-1)</title>` ; dans le commentaire d'ouverture,
     `Servie par http://127.0.0.1:PORT/.superpowers/sdd/2026-10-18-refonte-visuelle/galerie.html` → `…/2026-10-23-experience-carnet/galerie.html` ;
     ajouter la ligne `  Les blocs 7 bis à 7 sexies (lot UI-1) sont montés par le <script type="module"> de fin de page avec les composants réels de src/ui ;
  l'outil attend data-galerie-prete="1" sur <html> avant de mesurer.`
  2. Blocs 2 et 3 (onglets, panneau latéral) : chaque `<span class="ico" aria-hidden="true">…</span>` devient
     `<span class="ico" aria-hidden="true" data-icone="NOM"></span>` (`soleil`, `bibliotheque`, `calendrier`, `toque`, `plus` ; `roue` pour Réglages du
     panneau), et les deux `<span>Mes livres</span>` deviennent `<span>Bibliothèque</span>` ; le `<p class="muted">` du bloc 2 devient
     `Masquées à partir de 900 px (voulu). Onglet « Bibliothèque » mesuré ici à 320, 375, 390 et 768 px (D-UI-4, § 13 point 3).`
  3. Bloc 12 (formulaire) : `<summary class="btn primary">+ Pages d’index</summary>` → `<summary class="btn primary">Ajouter des pages de sommaire</summary>`.
  4. Bloc 16 (typographie) : après `<h1>Un titre de page (h1)</h1>`, ajouter `<h1 class="titre-fiche">The Particular Sadness of Lemon Cake — un titre de fiche long (h1.titre-fiche, D-UI-3)</h1>`.
  5. Après le bloc 7 (`data-nom="badges"`), insérer les cinq blocs neufs :

```html
  <!-- 7 bis. Un ÉTAT n'est jamais un bouton plein olive (D-UI-2) : le badge « Original » (vert gris) à côté d'un .btn.primary (olive) -->
  <section class="bloc" data-nom="badges-et-action">
    <h2>7 bis. État contre action — .badge.original à côté de .btn.primary (D-UI-2)</h2>
    <div class="contenu stack">
      <div class="row">
        <span class="badge original">Original</span>
        <button type="button" class="btn primary">Enregistrer</button>
        <span class="status ok">ok</span>
        <label class="chip clickable"><input type="checkbox" checked style="display:none"> bascule cochée</label>
        <a href="#">un lien d’action</a>
      </div>
      <p class="muted">Les trois états (badge, statut, puce cochée) restent vert gris (--accent, --ok) ; le bouton et le lien portent l’olive (--action). L’œil doit les distinguer à toutes les largeurs.</p>
    </div>
  </section>

  <!-- 7 ter. Cartes-plat (D-UI-5) : avec photo, sans photo (bloc titre sur --paper-2), signet non lu ; grille 2 colonnes dès 360 px, 3 dès 900 px -->
  <section class="bloc" data-nom="cartes-plat">
    <h2>7 ter. Cartes-plat — recipeCard(doc, { photoEnTete: true, fichier }) dans grilleCartes (D-UI-5, § 3.3)</h2>
    <div class="contenu stack">
      <div id="zone-cartes-plat"></div>
      <p class="muted">Deux cartes avec photo (4:3, titre serif, « De mon livre · … · 35 min » / « Du web · … · 35 min »), une sans photo (titre long sur --paper-2, 7 rem), un signet non lu (« Lien web », sans durée). Montées par le composant réel.</p>
      <div id="zone-carte-horizontale"></div>
      <p class="muted">La carte horizontale d’avant le lot (recipeCard(doc)) : inchangée, le défaut partout ailleurs.</p>
    </div>
  </section>

  <!-- 7 quater. section() reste .card ; sectionPlain() rend section.plain (D-UI-8) -->
  <section class="bloc" data-nom="sections">
    <h2>7 quater. Sections — .card (panneau d’action) contre .plain (liste sur le papier, filet sous le titre)</h2>
    <div class="contenu stack" id="zone-sections"></div>
  </section>

  <!-- 7 quinquies. En-tête de fiche : titre long, repères, « Commencer à cuisiner » + « Corriger », details des autres gestes (D-UI-3, D-UI-6) -->
  <section class="bloc" data-nom="fiche">
    <h2>7 quinquies. En-tête de fiche — h1.titre-fiche, div.reperes, rangée principale, details[data-role=autres-gestes]</h2>
    <div class="contenu stack" id="zone-fiche">
      <div class="row"><span class="badge available">Disponible</span><span class="badge reference">À importer · p. 132</span><span class="badge">Lien web</span><span class="badge partial">Partielle</span></div>
      <div class="reperes muted">4 portions · 35 min</div>
      <a class="btn link" href="#" data-role="ouvrir-lien">Voir la page d’origine ↗</a>
      <div class="row"><button type="button" class="btn primary big block">Commencer à cuisiner</button><a class="btn link" href="#">Corriger</a></div>
      <details class="card" data-role="autres-gestes"><summary>Portions, versions et autres gestes</summary><div class="row" style="margin-top:.5rem"><button type="button" class="btn small">−</button><span>4 portions</span><button type="button" class="btn small">+</button><button type="button" class="btn">Créer ma version</button></div></details>
      <div class="segmented" role="tablist"><button type="button" class="active">Ingrédients</button><button type="button">Préparation</button></div>
    </div>
  </section>

  <!-- 7 sexies. Liste compacte de la fiche livre (D-UI-7) : vignette 48 px si octets, titre serif, p. N, section, badge, gestes -->
  <section class="bloc" data-nom="liste-compacte">
    <h2>7 sexies. Liste compacte — ul.liste-compacte > li.row.between (fiche livre, D-UI-7)</h2>
    <div class="contenu">
      <p class="muted" style="margin:0 0 .4rem">7 disponibles · 2 à importer</p>
      <ul class="liste-compacte list">
        <li class="row between"><div class="row"><img class="plat-vignette petite" alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOoinEFAAJvARzi6he3AAAAAElFTkSuQmCC"><div><a href="#"><h3>Saumon rôti au fenouil et à l’orange</h3></a> <span class="muted">p. 76</span> <span class="chip neutral">Poissons</span></div></div><div class="row"><span class="badge available">Disponible</span><span class="badge">★</span></div></li>
        <li class="row between"><div class="row"><div><a href="#"><h3>Tarte aux poires</h3></a> <span class="muted">p. 132</span></div></div><div class="row"><span class="badge reference">À importer</span><a class="btn small" href="#">Importer</a><a class="btn small" href="#">Saisir à la main</a></div></li>
      </ul>
      <button type="button" class="btn">Voir les 9 recettes</button>
    </div>
  </section>
```

  6. Avant `</body>`, le module de montage (composants RÉELS ; une exception y laisse `data-galerie-prete` absent → la ligne « galerie » de l'outil
     sort en « le script a plante » : c'est voulu, un nom qui n'existe pas doit rougir) :

```html
<script type="module">
  // Lot UI-1 : les composants reels de src/ui montes dans la galerie (jamais une copie de leur balisage). URL absolues : celles que src/app.js resout.
  import { icone } from '/src/ui/icones.js';
  import { recipeCard, grilleCartes, sectionPlain, section, pageHeader } from '/src/ui/components.js';
  import { el } from '/src/core/dom.js';
  import { sha256Hex } from '/src/core/hash.js';
  for (const s of document.querySelectorAll('.ico[data-icone]')) s.replaceChildren(icone(s.dataset.icone));
  // Une ligne `files` fabriquee (la forme que repo.getFiles rend) : un JPEG de canvas, son empreinte, son type.
  const fichier = async (couleur) => { const c = new OffscreenCanvas(640, 480); const g = c.getContext('2d'); g.fillStyle = couleur; g.fillRect(0, 0, 640, 480); g.fillStyle = '#fff'; g.fillRect(0, 0, 160, 120); const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); return { sha256: await sha256Hex(blob), blob, mime: 'image/jpeg', size: blob.size, syncable: true }; };
  const livre = { id: 'b_g', title: 'À la di Stasio', author: 'Josée Di Stasio' }; const edition = { id: 'ed_g', book_id: 'b_g', language: 'fr' };
  const doc = (id, titre, over = {}, version = { id: 'rv_' + id, recipe_id: id, servings: 4, prep_minutes: 15, cook_minutes: 20, total_minutes: 35, ingredients: [], steps: [] }) =>
    ({ recipe: { id, original_title: titre, availability: 'available', verification_state: 'verified', favorite: false, edition_id: null, source_url: null, photo_sha256: null, ...over }, version, book: over.edition_id ? livre : null, edition: over.edition_id ? edition : null });
  const [f1, f2] = await Promise.all([fichier('#b5462f'), fichier('#4f6b2e')]);
  const cartes = [
    recipeCard(doc('g1', 'Saumon rôti au fenouil et à l’orange', { edition_id: 'ed_g', photo_sha256: f1.sha256, favorite: true }), { photoEnTete: true, fichier: f1 }),
    recipeCard(doc('g2', 'Pâtes puttanesca', { source_url: 'https://www.exemple-recettes.test/puttanesca', photo_sha256: f2.sha256 }), { photoEnTete: true, fichier: f2 }),
    recipeCard(doc('g3', 'The Particular Sadness of Lemon Cake', { edition_id: 'ed_g' }), { photoEnTete: true, fichier: null }),
    recipeCard(doc('g4', 'Un lien gardé, pas encore lu', { availability: 'reference_only', verification_state: 'unverified', source_url: 'https://www.exemple-recettes.test/lien-garde' }, null), { photoEnTete: true, fichier: null }),
  ];
  document.getElementById('zone-cartes-plat').replaceChildren(grilleCartes(cartes));
  document.getElementById('zone-carte-horizontale').replaceChildren(recipeCard(doc('g5', 'Risotto aux champignons', { edition_id: 'ed_g' })));
  document.getElementById('zone-sections').replaceChildren(
    section('Couverture (section() : .card, panneau d’action)', el('p', null, 'Les panneaux d’action restent sur une carte : Couverture, Photo du plat, Fichiers, import, questions, réglages.')),
    sectionPlain('Ingrédients (sectionPlain() : section.plain, sur le papier)', el('ul', { class: 'list' }, el('li', null, '2 fenouils'), el('li', null, '600 g de saumon'), el('li', null, '1 orange'))));
  // R-UI-P2 : le sous-titre d'une fiche est provenanceText (« {titre} — {auteur} · page N »), sans préfixe « De mon livre · » (celui-ci est la ligne de source de la carte-plat).
  document.getElementById('zone-fiche').prepend(pageHeader('The Particular Sadness of Lemon Cake', { subtitle: 'À la di Stasio — Josée Di Stasio · page 212', back: { href: '/library', label: 'Bibliothèque' }, classeTitre: 'titre-fiche' }));
  document.documentElement.dataset.galeriePrete = '1';
</script>
```

  (La ligne de source de la carte-plat lit le livre dans `doc.book` et l'hôte dans `recipe.source_url` : c'est la forme de `buildDocs` ; si T2 lit
  `ctx.editionLabel`, la galerie montre la carte sans son libellé de livre — amendement nommé, pas un constat.) Ouvrir
  `http://127.0.0.1:8096/.superpowers/sdd/2026-10-23-experience-carnet/galerie.html` dans le Chrome sans tête de l'outil seulement (jamais le
  navigateur MCP) : c'est le Step 7 qui la regarde.

- [ ] **Step 7 : la preuve, ses contre-preuves, les mutants.**
  1. **Preuve** (le serveur 8096 sert la tête de T5 + les filets du Step 3 ; la feuille est stable) :

```bash
node .superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs 8096 2> .superpowers/sdd/2026-10-23-experience-carnet/preuve-journal.txt ; echo "code=$?"
```

  Attendu : `code=0`, verdict **VERT** dans `resultats.md` ; **69 lignes** (par largeur 375, 390, 768, 1512 : la porte, les 13 routes, « bibliotheque-photos »,
  « galerie », « galerie (dialogue modal) » = 17 ; plus « galerie (onglets) » à 320) toutes `ok` ou `-` ; **173 captures** (par largeur : 15 d'app, 22
  blocs de galerie, le dialogue modal, 5 focus = 43 ; plus `320-galerie-onglets.png`) ; `onglet` `ok` sur « bibliotheque », « bibliotheque-photos »,
  toutes les routes à 375, 390 et 768 (`-` à 1512 : panneau latéral), sur « galerie » à 375, 390 et 768 et sur « galerie (onglets) » à 320 ; M14 **20 cibles
  sur 20** (anneau olive `#4f6b2e`) ; contraste rendu minimum ≥ 4,5 (lu dans `resultats.json`, à consigner au Step 8 : nœuds texte comptés et
  minimum) ; 0 requête externe, 0 erreur console hors les requêtes coupées volontairement. Les notes « grille : … » disent 10 cartes / 2 photos /
  8 sans photo / 0 cadre vide (« bibliotheque »), 10 / 9 / 1 / 0 (« bibliotheque-photos »), 2 colonnes à 375-768 et 3 à 1512. Un KO est lu ligne à ligne
  (« Detail des fautes ») : une faute de contraste ou de cible dans un écran de T2-T5 est un constat pour cette tâche (ronde), consigné dans
  `progress.md` avec sa capture ; un KO `onglet` à 320 px est la mesure que § 13 point 3 demande (repli « Carnet » : décision de Neegan, pas une
  correction) ; un `scrollWidth` de la barre haute à 320 px n'est pas mesuré (passe « etroit » : `sansDebordement`, débordement connu de 21 px avec la
  pastille, spec refonte § 11). Regarder les captures : `375-fiche-recette.png` (titre long sur deux lignes, D-UI-3 ; photo pleine largeur sous la
  provenance ; `segmented` Ingrédients / Préparation ; « Corriger » absent de l'en-tête — fiche vérifiée), `375-fiche-recette-web.png` (« Corriger »
  à côté de « Commencer à cuisiner », « Du web · www.exemple-recettes.test », « Voir la page d'origine »), `1512-fiche-recette.png` (deux colonnes,
  `details` ouvert), `375-fiche-livre.png` (8 lignes puis « Voir les 10 recettes »), `1512-fiche-livre.png` (`.two-col.livre`, couverture et Sommaire à
  gauche), `375-bibliotheque.png` / `375-bibliotheque-photos.png` (2 colonnes), `1512-bibliotheque-photos.png` (3 colonnes), `375-galerie-badges-et-action.png`
  (badge « Original » vert gris à côté du bouton olive), `320-galerie-onglets.png`. Rien n'est corrigé « à l'œil » : une capture qui contredit la spec
  est un constat nommé.
  2. **Contre-preuve 1 — l'outil voit une olive trop pâle** (il ne sert de preuve que s'il sait rougir) :

```bash
S=/private/tmp/claude-501/-Users-neeganmac/1602708c-1218-4b6c-99db-b05ac6854f25/scratchpad/kit-ui/contre-preuve
mkdir -p "$S" && python3 -I -c 'import sys; s=open(sys.argv[1],encoding="utf-8").read(); assert s.count("--action: #4f6b2e;")==1; open(sys.argv[2],"w",encoding="utf-8").write(s.replace("--action: #4f6b2e;","--action: #9bb86a;"))' styles.css "$S/styles-pale.css"
node .superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs 8096 --css="$S/styles-pale.css" --largeurs=390 --seulement=galerie > "$S/resultats-pale.md" 2>/dev/null ; echo "code=$?"
```

  Attendu : `code=1`, ligne « 390 · galerie » `contraste KO (n)` avec des groupes `.btn.primary` / `a` papier sur `#9bb86a` sous 4,5 (`#f8f5ef` sur
  `#9bb86a` ≈ 2,1), et M14 « anneau … attendu olive » vert (la couleur lue est bien `--action`). L'outil réécrit TOUJOURS `resultats.md`,
  `resultats.json` et `captures/` de son dossier : d'où l'ORDRE d'exécution — les contre-preuves 2 et 3 D'ABORD (leurs sorties renommées aussitôt :
  `mv resultats.md resultats-contre-preuve.md ; mv resultats.json resultats-contre-preuve.json` dans le registre), la preuve 1 EN DERNIER, dont
  `resultats.md`, `resultats.json` et `captures/` restent ceux consignés au Step 8 (règle du lot refonte : « jamais pendant qu'une revue les lit »).
  3. **Contre-preuve 2 — l'onglet qui coupe se voit** (copie de l'outil et de la galerie dans le scratchpad ; le libellé de l'onglet y est allongé) :

```bash
C=$S/galerie-coupe && mkdir -p "$C" && cp .superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs .superpowers/sdd/2026-10-23-experience-carnet/galerie.html "$C/"
python3 -I -c 'import sys; p=sys.argv[1]; s=open(p,encoding="utf-8").read(); assert s.count("<span>Bibliothèque</span>")==2; open(p,"w",encoding="utf-8").write(s.replace("<span>Bibliothèque</span>","<span>Bibliothèque de la maison</span>",1))' "$C/galerie.html"
node "$C/preuve-visuelle.cjs" 8096 --setcontent --seulement=etroit > "$C/resultats.md" 2>/dev/null ; echo "code=$?"
```

  Attendu : `code=1`, ligne « 320 · galerie (onglets) » `onglet KO (2)` : `libelle « Bibliothèque de la maison », attendu « Bibliothèque »` et `libelle sur 2 ligne(s)` ou
  `deborde` ; la copie écrit SES `resultats.md` et `captures/` dans `$C` (jamais dans le registre). Garder `$C/resultats.md` → registre
  `resultats-contre-preuve-onglet.md`.
  4. **Mutants de la tâche** (spec § 7 ; sur des COPIES légères servies à part, `rsync -a --exclude .git --exclude .superpowers --exclude node_modules
  <worktree>/ <copie>/`, ports 8196, 8296, 8396 — trois copies au plus à la fois, chaque serveur tué à la fin, jamais celui du 8096 ; la suite de la
  copie par `node suite.cjs <port>` ; chacun doit ROUGIR, le témoin sans mutation VERT) :
  - **M-UI6-1** `src/i18n/en.js` : l'entrée `'Voir la page d’origine'` retirée → « chaque texte neuf … entrée en.js » rouge (et le filet F13 de
    `tests/ajouter.js`, par `CHAINES_NEUVES_AILLEURS['../src/ui/components.js']`, où T3 l'a listée : A-9, A-11).
  - **M-UI6-2** `tests/ajouter.js` : `'../src/ui/library.js': []` → « CHAINES_NEUVES_AILLEURS … à jour » rouge (nomme `library.js : Bibliothèque`, …).
  - **M-UI6-3** `src/i18n/en.js` : `"Ouvrir le lien": "Open the link",` remis → « chaînes retirées » rouge (`en.js : Ouvrir le lien`).
  - **M-UI6-4** `tests/ajouter.js:8` : `'../src/ui/icones.js'` retiré de `MODULES_NEUFS` → « … sont dans MODULES_NEUFS » rouge (et l'assertion de T1 si elle existe).
  - **M-UI6-5** `styles.css` : `.plat-vignette.petite` renommée `.plat-vignette.mini` → « treize sélecteurs » et « exactement trois sélecteurs » rouges
    (plus l'épingle de T2 sur `tests/photo-plat.js:1320-1323`).
  - **M-UI6-6** `src/app.js:39` : `label: 'Bibliothèque'` → `label: 'Mes livres'` → « NAV … dit « Bibliothèque » » rouge ; ET la preuve visuelle sur
    cette copie (`node preuve-visuelle.cjs 8196 --largeurs=375 --seulement=app`) : `onglet KO (1)` sur chaque route sous 900 px (`libelle « Mes livres »`).
  - **M-UI6-7** `styles.css` : `display: none` ajouté à `.carte-plat.sans-photo` → `tests/theme.js` T-1 rouge (inventaire exact) : le filet « aucun
    display:none neuf » demandé par § 7 est bien celui-là, vu rouge une fois.
  - **M-UI6-8** `styles.css` : `color: #4f6b2e` écrit en dur dans `.carte-plat h3` → `tests/theme.js` T-2 rouge (liste blanche `#fff`, `#222`).
  Comptes attendus par mutant lus dans « ECHECS » (pas seulement le bilan), consignés dans `progress.md`.

- [ ] **Step 8 : les documents.** Quatre fichiers suivis, un seul mouvement ; chaque nombre vient d'une mesure de cette tâche (Step 4 : bilan et
  épingle ; Step 7 : lignes, captures, contraste minimum et nœuds de `resultats.json`, mutants) ou d'un relevé du Step 0 (versions, commits de T1 à
  T5, rulings de `progress.md`) — jamais deviné. **Les crochets `[…]` des gabarits ci-dessous (`[sha]`, `[N/N]`, `[N−1]`, `[min]`, `[n]`, `[K]`, `[date]`,
  `[heure]`, `[n/n]`, `[R-UI-1 à R-UI-n …]`) sont des RELEVÉS à remplir par cette tâche (A-15, RATIFIÉ rév. 3)** : `git log --format='%h %ci'` (sha, dates),
  le bilan de `suite.cjs` (N, N−1), `resultats.json` (min, n), `sw.js` (K), `progress.md` (rulings, mutants des rapports de tâche) ; aucun crochet ne
  reste dans un fichier commis (le `grep -n '\[sha\]\|\[N/N\]\|\[min\]\|\[n\]' CLAUDE.md STATE.md docs/architecture.md docs/superpowers/specs/2026-10-23-experience-carnet-design.md`
  du Step 9 rend vide). Dates : « 23-25 octobre 2026 » (spec et branche le 23, construction les 25 et suivants : relire
  `git log --format=%ci`).
  1. **`CLAUDE.md`** — insérer, juste AVANT la ligne `## La présentation du serveur (18 octobre 2026, lot borné après la passerelle)`, la section
     suivante (le modèle des sections A à F ; les crochets `[…]` désignent la valeur à lire, et où) :

```markdown
### Expérience « carnet » : olive, grands titres, cartes-plat, bibliothèque sur les recettes (23-25 octobre 2026, lot UI-1)

**Pour toi.** L'app prend l'allure des maquettes sans changer un seul geste : papier crème, l'olive pour tout ce qui se touche (boutons pleins,
liens, onglet actif, anneau de focus), le vert gris gardé pour les états (« Original », ok, puce cochée), de grands titres serif, des icônes au
trait à la place des émojis de la navigation et de la page Ajouter. L'onglet « Bibliothèque » (ex-« Mes livres ») s'ouvre sur TES RECETTES en
grille : la photo quand tu l'as, un bloc de titre sinon (jamais de cadre vide), les filtres Toutes / De mes livres / Du web, « Ajouter une
recette », et en pied « Recettes de mes livres à importer » ; tes livres et tes plats sont les deux autres segments. Une fiche de recette met la
photo en regard du titre sur le Mac, en pleine largeur sur l'iPhone, puis Ingrédients et Préparation côte à côte (deux onglets sur l'iPhone) ;
« Commencer à cuisiner » reste le grand bouton, « Corriger » reste à côté tant que tu n'as pas relu, et le reste (portions, unités, versions,
« Adapter avec l'IA », repas, épicerie) se replie sous « Portions, versions et autres gestes ». Une fiche de livre montre la couverture, les
métadonnées et le sommaire à gauche, la liste compacte des recettes à droite (« Disponible », « À importer », « Importer », « Saisir à la main » sur
la ligne ; 8 lignes puis « Voir les {n} recettes » sur l'iPhone) ; ses menus s'appellent « Ajouter des recettes » et « Ajouter des pages de
sommaire ». « À importer » remplace « Repérée dans ton livre » dans les listes (la fiche garde la phrase), « Voir la page d'origine ↗ » remplace
« Ouvrir le lien ». Rien d'inventé : pas de photo sans octets, pas de durée ni de portions sans donnée, « vérifie » reste tant que tu n'as pas
relu. L'onglet Web ne change que de couleurs : les photos des résultats sont l'autre lot (UI-2). Rien n'arrive sur le site public avant la fusion
(après UI-2) et ton `push`.

**Où.** Branche `experience-carnet`, worktree `~/projects/mistu-carnet` (jamais `~/projects/mistu`), serveur `python3 -m http.server 8096 --bind
127.0.0.1` (suite : `http://127.0.0.1:8096/tests/`). Base : `main` `05c751f` + trois commits de docs, tête `f3672be` (spec rév. 2.1 et le « Go » de
Neegan sur les sept points de § 13). Spec : `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (rév. 2.1 ; § 0 : D-UI-1 à D-UI-14 ; § 2 :
I-UI-1 à I-UI-7 ; § 3 : jetons, typographie, composants ; § 4 : écrans ; § 5 : textes ; § 7 : tests ; § 12 « Construction UI-1 : rulings » : R-UI-1
à R-UI-[n] ; § 13 : les sept défauts confirmés). Plan : `docs/superpowers/plans/2026-10-23-experience-carnet-ui-1.md` (six tâches). Registre, hors git
(`.superpowers/` exclu) : `.superpowers/sdd/2026-10-23-experience-carnet/` (`progress.md`, `cartographie.md`, les revues de la spec, un brief et un
rapport par tâche, lanceur `suite.cjs`, outil `preuve-visuelle.cjs`, `galerie.html`, `resultats*.md` / `.json`, `captures/`). Commits : T1 `[sha]`
(jetons, `sectionPlain`, `pageHeader classeTitre`, `icones.js`, NAV « Bibliothèque », pins, `theme.js` amendé), T2 `[sha]` (carte-plat, `grilleCartes`,
segment Recettes), T3 `[sha]` (fiche recette), T4 `[sha]` (fiche livre), T5 `[sha]` (Aujourd'hui, Ajouter, import ciblé, libellés), T6 `[sha]` et `[sha]`
(filets, preuve, docs) — plus les rondes relevées par `git log --oneline f3672be..HEAD`. **FINI dans le worktree, PAS fusionné, PAS poussé** ; revue
finale de branche, vague et `/verify` : au chef d'orchestre ; fusion APRÈS UI-2 par un commit de fusion (quatre fichiers communs, spec § 9).
Fichiers du lot : `styles.css`, `index.html` (rien : `theme-color` inchangé), `sw.js` (`VERSION`, `SHELL` + `./src/ui/icones.js`), `src/app.js` (NAV),
`src/ui/icones.js` (neuf), `src/ui/components.js`, `library.js`, `recipe.js`, `book.js`, `home.js`, `add.js`, `accueil-livre.js`, `import-cible.js`,
`import-web.js`, `photo-plat.js`, `src/core/i18n.js` (`STATE_LABELS.availability.reference_only`), `src/i18n/en.js`, `src/model/schema.js`
(`APP_VERSION`) ; tests : `tests/carnet.js` (neuf), `tests/theme.js`, `tests/ajouter.js`, `tests/photo-plat.js`, `tests/creer-ia.js`, `tests/lecture-web.js`,
`tests/sync-l4.js`, `tests/import-cible.js`, `tests/table-matieres.js`, les pins de version (8 suites), `tests/tests.js`. **Aucun fichier sous `supabase/`**
(`git diff --stat f3672be..HEAD -- supabase/` vide), aucune migration, aucun appel réel.

**Ce qui marche** (éprouvé par la suite — bases jetables, `matchMedia` factice, scènes hors écran, aucun réseau — et par la preuve visuelle,
Chrome sans tête, contextes jetables, données semées, jamais la bibliothèque de Neegan) :
- **Le thème** (T1, `tests/theme.js` amendé : une valeur, une paire, deux libellés) : `--action #4f6b2e`, `--action-2 #3e5424`, `--action-bg #e9eddf`,
  `--tap rgba(79,107,46,.15)` ; les 25 autres jetons, `theme-color` et le manifeste inchangés ; **29 paires** ≥ 4,5 (olive sur papier 5,55, sur carte
  5,95, sur `--paper-2` 5,14 — la 29e —, minimum 4,62 inchangé) ; inventaire des `display: none` = les cinq d'origine ; aucune couleur en dur ; `56px`
  sur `.btn.big` seul ; survols sous `@media (hover: hover)`.
- **Les composants** (T1, T2 ; `tests/carnet.js`) : `sectionPlain(title, ...children)` → `section.plain` (et `section()` reste `.card` : 54 appelants,
  17 modules) ; `pageHeader(…, { classeTitre })` ; `icone(nom)` → vingt-trois SVG au trait (`currentColor`, `aria-hidden`, nom inconnu → levée) ;
  `recipeCard(doc, { photoEnTete: true, fichier })` synchrone (image 4:3 quand `typeAffichage(fichier)` est une image, bloc titre sur `--paper-2`
  sinon, jamais de cadre vide, ligne « Du web · {h} · 35 min » / « De mon livre · {t} · 40 min », durée = `total_minutes ?? prep + cook`) ;
  `grilleCartes` 2 colonnes dès 360 px, 3 dès 900 px, bornée à 60 cartes et « Voir plus » (fixture de 70 : 60 lectures).
- **La bibliothèque** (T2) : `#/library` ouvre Recettes (`{}` → Recettes ; `?tab=books` et `?tab=dishes` restent valides) ; filtre local, puces
  calculées sur `edition_id` / `source_url`, tri par dernière modification (§ 13 point 5), signets dedans (carte sans photo, « Lien web »), références
  dehors ; « Ajouter une recette » en en-tête et sous la grille sous 760 px ; pied `?tab=a-importer` ; « Liens web gardés » et « Recettes créées
  avec l'IA » restent sous Livres, en `plain`.
- **La fiche recette** (T3) : `h1.titre-fiche`, repères dérivés (« 1 portion », rien sans durée, un seul nombre), « Voir la page d'origine ↗ » sur toute
  adresse lisible (http compris, I-B5), « Commencer à cuisiner » + « Corriger » visible tant que non vérifiée, `details[data-role=autres-gestes]`
  (tous les anciens boutons de `controls` et de la rangée, pas l'Export), `.two-col` ≥ 760 px, `segmented` Ingrédients / Préparation dessous
  (bascule par `hidden`, état dans l'instance, survit à `drawBody()`), `matchMedia` injecté dans ses deux états.
- **La fiche livre** (T4) : sous-titre « {auteur} · {éditeur} · {année} », menus renommés, `.two-col.livre` ≥ 900 px, « Sommaire », « Les recettes de ce
  livre » avec « {n} disponible(s) · {m} à importer », filtres, ligne compacte (vignette 48 px si octets, « Importer » et « Saisir à la main » seulement
  sur une référence sans adresse, mêmes `href`), 8 lignes puis « Voir les {n} recettes » sous 900 px ; « Couverture », « Fichiers », « Pages d'index »
  restent `.card`.
- **Aujourd'hui, Ajouter, import ciblé, libellés** (T5) : `pageHeader` et `grilleCartes` sur Favoris et Dernières cuissons (date et « Refaire comme la
  dernière fois » hors du `<a>`), icônes au trait de la grille Ajouter et des états vides, « × » de retrait d'une page (≥ 44 px, même nom accessible),
  « À importer » (`availabilityBadge`, `STATE_LABELS.availability.reference_only`, compteurs, filtres) seulement pour `reference_only` sans `source_url`.
- **Les filets** (T6, `tests/carnet.js`, 12 assertions) : les 33 textes de la table (28 de § 5 UI-1, cinq hors table : R-UI-[n+3]) avec leur anglais exact ; les clés réemployées ;
  `CHAINES_NEUVES_AILLEURS` à jour par CALCUL pour library.js, recipe.js, book.js, home.js, components.js ; accueil-livre.js, import-web.js,
  import-cible.js, add.js, icones.js dans `MODULES_NEUFS` ; « + Recette », « + Pages d'index », « Ouvrir le lien », « Aller à Mes livres. » absentes
  d'`en.js`, des filets et de tout module de `SHELL` ; NAV « Bibliothèque » (source) ; les treize sélecteurs neufs présents, trois `.plat-vignette`.
- **La preuve visuelle** (T6 ; `preuve-visuelle.cjs 8096`, [date et heure UTC lues en tête de `resultats.md`]) : **VERT, code 0**, **69 lignes sur 69**
  (porte, treize routes et « bibliotheque-photos » à 375, 390, 768, 1512 ; galerie et dialogue modal ; galerie à 320 px) ; `onglet` « Bibliothèque »
  sur une ligne sans débordement à 320, 375, 390 et 768 ; contraste rendu minimum **[min]** sur **[n]** nœuds texte (`resultats.json`) ; M14 20 sur 20
  (anneau olive) ; **173 captures** ; grille 2 colonnes à 375-768, 3 à 1512, 0 cadre vide avec 2 photos sur 10 cartes comme avec 9. Contre-preuves :
  une olive pâle (`#9bb86a`) rougit la galerie (contraste), un libellé d'onglet allongé rougit la passe « etroit ». M3 (« Annuler » à droite) n'est PAS
  rejouée : l'app ne poste plus à `api.anthropic.com` et `search.js` ne change pas (R-VIS-8 tenu par `tests/theme.js`).
- **Mutants** (copies servies à part ; comptes dans les rapports de tâche) : T1 [n/n], T2 [n/n], T3 [n/n], T4 [n/n], T5 [n/n], T6 8 sur 8 (M-UI6-1 à
  M-UI6-8 ; M-UI6-6 vu rouge aussi par la preuve : `onglet KO`).

Les rulings, une ligne chacun (détail en spec § 12 « Construction UI-1 : rulings ») : **R-UI-P1** `search.js:162` seule édition de `search.js` (`'loupe'`) ·
**R-UI-P2** le sous-titre de la fiche reste `provenanceText` (§ 4.2 amendé) · **R-UI-P3** « Préparation » → « Method » pour le `segmented` (§ 5 amendé) — les trois
du pré-vol du plan (rév. 2, ratifiés rév. 3) · **R-UI1-1** la règle `.plat-vignette.grande` identique à UI-2 au caractère près, `.petite` ajoutée, l'épingle à
trois sélecteurs (fusion par union) · **R-UI1-2** les sources du test I-F3 (`tests/photo-plat.js:1327-1331`) à UI-2 seul — les deux du chef d'orchestre (plan
rév. 3) ; [R-UI-1 à R-UI-n, copiés de `progress.md`, une ligne chacun] ;
puis ceux de la tâche 6 : **R-UI-[n+1]** M3 non rejouée (session exigée ; `search.js` inchangé) · **R-UI-[n+2]** « Aller à Mes livres. » quitte `en.js`
avec les trois chaînes de § 5 (même décision, D-UI-4) · **R-UI-[n+3]** cinq textes que § 5 ne fixe pas : « Disponibles » → « Available », « 1 portion » → « 1 serving » (clé
antérieure, relue), « Reprendre la séance » → « Resume the session », « {n} à importer » → « {n} to import », « Page {n} · p. {p} » (identique), épinglés · **R-UI-[n+4]** la galerie monte les composants réels (jamais une copie de balisage) et
l'outil attend `data-galerie-prete` · **R-UI-[n+5]** à 320 px seul l'onglet est jugé (la barre haute avec pastille déborde de 21 px, connu, spec refonte
§ 11).

**Ce qui n'est PAS prouvé.**
- **Safari et l'iPhone** : rien n'y a été vu (aucun WebKit ici) — Georgia et `clamp()` des titres, le `details` replié, la bascule Ingrédients /
  Préparation au toucher, les icônes SVG dans les onglets, « Bibliothèque » dans l'onglet avec « Agrandir l'affichage » (320 px : mesuré sur la
  galerie, pas dans l'app installée), la grille à deux colonnes sur un vrai écran, `object-fit` des photos 4:3.
- **Ta bibliothèque** : la grille Recettes n'a été vue qu'avec des données semées (12 fiches, 2 puis 9 photos) ; avec tes photos réelles (rares :
  lot F) elle sera d'abord faite de blocs de titre (§ 11, § 13 point 5 : « photos d'abord » reste renversable).
- **La coquille** (`app.js`) reste hors suite : la NAV avec icônes et le libellé « Bibliothèque » ne sont mesurés que par la preuve visuelle (et un
  test de source).
- **R-VIS-8 en vrai vol** : M3 n'est pas rejouée (voir ci-dessus) ; la règle est tenue par `tests/theme.js` et `search.js` n'a pas changé.
- **Le site public** ne porte rien du lot (rien n'est poussé) ; la fusion vient APRÈS UI-2, avec la règle des quatre fichiers communs.

**Dettes (assumées, une ligne chacune).**
- La galerie montre la ligne de source de la carte-plat telle que `recipeCard` la lit dans `doc.book` / `recipe.source_url` : si l'app passe par
  `ctx.editionLabel`, la galerie l'omet (visuel seulement).
- Les 173 captures et l'outil vivent hors git : ils disparaissent avec le worktree si le registre n'est pas copié (comme au lot refonte).
- Cinq textes vivent hors de la table § 5 de la spec (« Disponibles », « 1 portion » — sans anglais —, « Reprendre la séance », « {n} à importer », « Page {n} · p. {p} ») : épinglés par `tests/carnet.js` (R-UI-[n+3]).
- Le test NAV (`label: 'Bibliothèque'`) est un test de source (app.js hors suite) : la preuve visuelle est la vraie mesure.
- [dettes nommées par les revues de T1 à T5 et consignées dans `progress.md`, une ligne chacune]

**Gestes de Neegan, dans cet ordre.**
1. **UI-2 d'abord** (sa section) : `0007` collée et prouvée, fonction redéployée, sondes, fusion de `apercus-web` dans `main`, push.
2. Après la revue finale et `/verify` du chef d'orchestre : fusion de `experience-carnet` par un **commit de fusion** (jamais `--ff-only` : UI-2 a
   bougé `main`), les quatre fichiers communs résolus (`sw.js` : UNION de `SHELL` — `./src/ui/icones.js` ET `./src/domain/apercu-web.js` — et
   `VERSION` `cuisine-os-v0.17.0-[K+1]` ; `src/model/schema.js` `APP_VERSION 0.17.0` et les 13 pins + 1 commentaire des 8 suites ; `src/i18n/en.js` :
   union ; `tests/tests.js:250` : remesuré après la fusion) ; puis `! git -C ~/projects/mistu push origin main`. Ouvrir
   `https://neegans.github.io/mistu/tests/` et lire le BILAN (attendu : la valeur remesurée, plus le 404 de `/favicon.ico`) ; service worker
   `cuisine-os-v0.17.0-[K+1]`.
3. **Preuve réelle § 10 UI-1** sur le site public : Bibliothèque → Recettes sur TA bibliothèque (dire si la grille, avec tes photos réelles,
   ressemble assez à la maquette ; sinon § 13 point 5), filtres, pied, « Ajouter une recette » ; une fiche de recette avec photo sur le Mac (deux
   colonnes) et sur l'iPhone (onglets, « Corriger » à côté) ; une fiche de livre (menus en tête, 8 lignes puis « Voir les {n} recettes ») ;
   Aujourd'hui ; Ajouter ; l'onglet « Bibliothèque » lisible sur l'iPhone, « Agrandir l'affichage » dit (repli « Carnet », § 13 point 3).
4. Regarder les captures : `~/projects/mistu-carnet/.superpowers/sdd/2026-10-23-experience-carnet/captures/` (173 PNG `<largeur>-<nom>.png`) ;
   la galerie : `http://127.0.0.1:8096/.superpowers/sdd/2026-10-23-experience-carnet/galerie.html` (serveur du worktree).
5. Les sept points de § 13 restent renversables (olive, « Cuisine OS », aperçus, « Bibliothèque », gestes repliés, tri, ordre des lots) ; chacun au
   prix dit dans sa ligne.
6. « clean » **seulement après** la copie du registre **avec `captures/`** dans `~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet) ; ensuite
   `git worktree remove` de `mistu-carnet`.

**Versions.** `APP_VERSION = '0.17.0'` (était 0.15.0 ; 0.16.0 = UI-2 ; pins `v0\.17\.0-\d+` / `'0.17.0'` : 13 assertions + 1 commentaire dans
`tests/ajouter.js`, `tests/passerelle.js`, `tests/recherche-web.js`, `tests/sync-l3.js`, `tests/sync-l4.js`, `tests/assistant-compte.js`,
`tests/creer-ia.js`, `tests/classement.js`), `DB_VERSION = 4` (inchangée), `sw.js VERSION = 'cuisine-os-v0.17.0-[K]'` (`-1` à T1, +1 à chaque commit
qui a touché `src/`, `styles.css`, `index.html`, le manifeste ou `sw.js` ; T6 : +1 ssi `en.js` a changé), `SHELL` + `./src/ui/icones.js` (seul module
neuf). Aucun schéma, aucune migration, CSP inchangée, `theme-color` inchangé.

**Bilan ([date], tête `[sha]`).** Suite complète **[N/N]** (épingle **[N−1]** dans `tests/tests.js`, règle N−1 ; départ du lot sur `f3672be` :
5948/5948, épingle 5947 ; T1 [n], T2 [n], T3 [n], T4 [n], T5 [n] : lus dans leurs rapports), une seule erreur de console : le 404 de `/favicon.ico`
(préexistant) ; `node --test tools/*.test.mjs` **208/208** (inchangé) ; `node tools/generer-migrations.mjs --check` **0** ; preuve visuelle VERT (69/69,
173 captures, contraste minimum [min] sur [n] nœuds) ; aucun caractère invisible (Python `-I`) ni aucune clé dans les fichiers touchés ; `git diff
--stat f3672be..HEAD -- supabase/` vide.

**Fusion.** Revue finale de branche puis `/verify` par le chef d'orchestre ; le registre (avec `captures/`) se copie **avant** tout `git worktree
remove` ; UI-2 fusionne **d'abord**, UI-1 par un commit de fusion ensuite (spec § 9).
```

  2. **`STATE.md`** — (a) la ligne 1 devient `# STATE.md — Cuisine OS (mistu) — état au [date], [heure] (chaîne A → F EN LIGNE : `main` = `origin/main` =
     `2f15d2e`, 0.15.0 ; lot UI-2 « Aperçus » (0.16.0, branche `apercus-web`) et lot UI-1 « Carnet » (0.17.0, branche `experience-carnet`) construits sur
     `f3672be`, PAS fusionnés ; UI-2 fusionne d'abord ; reste à Neegan : `0007`, redéploiement, fusions, preuves réelles, décisions ouvertes, « clean »)` ;
     (b) un paragraphe neuf en TÊTE, avant `**23 octobre 2026, 17 h 30 — CHAÎNE A → F EN LIGNE.**` :

```markdown
**[date], [heure] — LOT UI-1 « EXPÉRIENCE CARNET » : FINI dans le worktree `~/projects/mistu-carnet` (branche `experience-carnet`, base `f3672be`
= `main` `05c751f` + trois commits de docs, spec rév. 2.1 `7633675` et le « Go » de Neegan `f3672be`, plan `[sha du commit du plan]`, tête de code
`[sha]`, serveur 8096), six tâches (T1 jetons et composants, T2 bibliothèque sur les recettes, T3 fiche recette, T4 fiche livre, T5 Aujourd'hui /
Ajouter / import ciblé / libellés, T6 filets, preuve visuelle, docs ; rondes et re-revues : `progress.md`), `/verify` mécanique [VERT / au chef
d'orchestre] (suite [N/N], épingle [N−1], Node 208/208, `--check` 0, invisibles 0, aucune clé), preuve visuelle VERT (69 lignes, 173 captures,
contraste minimum [min], onglet « Bibliothèque » entier à 320-768 px), `sw.js cuisine-os-v0.17.0-[K]`, `APP_VERSION 0.17.0`, `DB_VERSION` 4, aucune
migration, aucun fichier sous `supabase/`. **PAS fusionné, PAS poussé.** Pour Neegan, dans l'ordre : le lot UI-2 d'abord (`0007`, redéploiement,
sondes, fusion de `apercus-web`, push) ; puis la fusion de `experience-carnet` par un commit de fusion (quatre fichiers communs : `sw.js` union de
`SHELL` + `VERSION` +1, `schema.js` et les pins 0.17.0, `en.js` union, `tests/tests.js:250` remesuré), push, suite publique, preuve réelle § 10 UI-1
sur sa bibliothèque et sur l'iPhone (« Agrandir l'affichage » dit), les sept points de § 13 (défauts confirmés le 23 octobre, renversables), « clean »
après la copie du registre AVEC `captures/`. Registre `.superpowers/sdd/2026-10-23-experience-carnet/` ; rulings R-UI-1 à R-UI-[n+5] dans la spec
§ 12 « Construction UI-1 : rulings » ; section du lot dans `CLAUDE.md` et `docs/architecture.md`.**
```

     (c) dans « Reprendre », en tête, le bloc du lot :

```
Lot UI-1 « Carnet » (le plus récent ; l'outil de preuve réécrit resultats.md, resultats.json et captures/ : jamais pendant qu'une revue les lit) :
cd ~/projects/mistu-carnet && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8096 http=%{http_code}\n" http://127.0.0.1:8096/tests/ || (nohup python3 -m http.server 8096 --bind 127.0.0.1 > /dev/null 2>&1 &)
node ~/projects/mistu-carnet/.superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096   # attendu : [N/N] (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 208/208, code 0
node ~/projects/mistu-carnet/.superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs 8096   # attendu : VERT, code 0, 69 lignes, 173 captures
```

  3. **`docs/architecture.md`** — insérer, juste AVANT `## Modèle de données (magasins IndexedDB)` (après la section du lot F) :

```markdown
## Expérience « carnet » (lot UI-1, 23-25 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (rév. 2.1 ; § 0 : D-UI-1 à D-UI-14 ; § 2 : I-UI-1 à I-UI-7 ; § 3 : jetons,
typographie, composants ; § 4 : écrans ; § 5 : textes ; § 12 « Construction UI-1 : rulings » : R-UI-1 à R-UI-[n+5] ; § 13 : les sept défauts
confirmés). Livré ici (branche `experience-carnet`, construite sur `f3672be` en parallèle de UI-2, non fusionnée) : la direction des maquettes
adaptée à l'app — thème, composition des écrans, textes, icônes — sans serveur, sans migration, sans règle de produit changée (I-UI-1).

- **Jetons** (`styles.css` `:root`, `tests/theme.js`) : quatre valeurs changent — `--action #4f6b2e` (l'olive des maquettes ; renverse V-4 de la refonte,
  § 13 point 0), `--action-2 #3e5424`, `--action-bg #e9eddf`, `--tap rgba(79,107,46,.15)` ; 29 paires ≥ 4,5 (la 29e : olive sur `--paper-2`, 5,14). Règle
  vérifiable (D-UI-2) : un ÉTAT (badge « Original », statut ok, puce cochée) reste vert gris (`--accent`, `--ok`) ; l'ACTION (bouton plein, lien, onglet
  actif, anneau de focus) porte l'olive ; la galerie les met côte à côte (bloc `badges-et-action`). Inventaire T-1 et liste blanche T-2 inchangés.
- **Typographie** : `h1` de page `clamp(1.8rem, 6vw, 3.2rem)` ; `h1.titre-fiche` (`pageHeader(…, { classeTitre: 'titre-fiche' })`) `clamp(1.5rem, 4.5vw,
  2.6rem)` ; `h2` 1,6 rem ; titre de carte-plat serif 1,3 rem ; `--serif` Georgia (CSP : aucune police externe) ; `.step-num` sur `--paper-2`.
- **Composants** (`src/ui/components.js`) : `sectionPlain(title, ...children)` → `section.plain` (sans fond ni ombre, filet `--line` sous le titre) ;
  `section()` inchangé (`.card`, 54 appelants) ; `recipeCard(doc, { photoEnTete, fichier })` : la carte-plat VERTICALE (`a.item-link.carte-plat`,
  `img.plat-vignette.grande` 4:3 quand `typeAffichage(fichier)` est une image, sinon `.sans-photo` : bloc de titre sur `--paper-2`, 7 rem) — décision
  SYNCHRONE au rendu sur la ligne `files` passée par l'appelant (`repo.getFiles` en une fois pour les cartes rendues, I-UI-5 ; jamais `vignettePlat`,
  jamais un cadre vide) ; la carte horizontale reste le défaut ailleurs ; `grilleCartes(noeuds)` → `div.grille-plats` (2 colonnes dès 360 px, 3 dès
  900 px), bornée à 60 cartes + « Voir plus » (F-9) ; trois règles `.plat-vignette` (72 px, `.grande` 4:3, `.petite` 48 px).
- **Icônes** (`src/ui/icones.js`, dans `SHELL`) : `icone(nom)` → `svg[aria-hidden][focusable=false]` 24 × 24 au trait, `stroke: currentColor`, vingt-trois
  noms relevés du code (navigation, grille Ajouter, accueil d'un livre, états vides, repères) ; nom inconnu → levée ; les émojis restent dans les textes
  de contenu. `tests/theme.js` ne les voit pas (hors feuille de style).
- **Écrans** : `src/ui/library.js` (segment Recettes par défaut, filtres par données, tri par dernière modification, pied `?tab=a-importer`, actions par
  segment : « Ajouter une recette » → `#/add`, « Ajouter un livre » → `#/add/livre`) ; `src/ui/recipe.js` (`div.fiche-tete` `.two-col` ≥ 760 px, repères
  `div.reperes`, `a.btn.link[data-role=ouvrir-lien]` « Voir la page d'origine ↗ », `details.card[data-role=autres-gestes]`, `segmented` Ingrédients /
  Préparation par `hidden`, `deps.matchMedia` injectable écouté sur `change`) ; `src/ui/book.js` (`div.two-col.livre` `200px 1fr` ≥ 900 px, « Sommaire »
  = `div.thumbs` des pages `kind === 'index'`, `ul.liste-compacte`, 8 lignes puis « Voir les {n} recettes ») ; `src/ui/home.js` (`pageHeader`,
  `grilleCartes` sur Favoris et Dernières cuissons, sa propre passe `getFiles`) ; `src/ui/add.js`, `accueil-livre.js`, `import-cible.js` (icônes, « × » de
  retrait ≥ 44 px, badge « À importer ») ; `src/app.js` (NAV `label: 'Bibliothèque'`, icônes). Les écrans hors § 4 ne changent que par les jetons et les
  titres (§ 8). `search.js` ne change pas (la carte web garde sa forme épinglée ; UI-2 y pose les vignettes).
- **Libellés** (D-UI-10) : `availabilityBadge` porte ses textes courts (« À importer · p. {p} », « À importer », « Disponible », « Partielle », « Lien
  web ») ; `STATE_LABELS.availability.reference_only` → « À importer » (exports et Redécouvrir suivent) ; « Repérée dans ton livre — page {p} » reste
  sur la fiche ; « Voir la page d'origine » sur toute adresse lisible (`http:` compris, I-B5) ; « + Recette », « + Pages d'index », « Ouvrir le lien »,
  « Aller à Mes livres. » retirées du source ET d'`en.js` ; « Mes livres » reste le segment de la recherche.
- **Tests** : `tests/carnet.js` (`runCarnetTests({ eq, ok })`, câblé dans `tests/tests.js` avant le bloc thème ; blocs par tâche ; le bloc T6 porte les
  filets : table `TEXTES_UI1` de 33 paires, `CHAINES_NEUVES_AILLEURS` vérifiée par CALCUL sur les cinq modules hors `MODULES_NEUFS`, chaînes retirées
  absentes de tout module de `SHELL`, treize sélecteurs neufs présents) ; `tests/theme.js` amendé (une valeur, une paire, deux libellés) ; épingles
  amendées tâche par tâche (spec § 7), jamais contournées.
- **Preuve visuelle** (registre, hors git ; `preuve-visuelle.cjs`, copie adaptée de l'outil du lot refonte) : quatre largeurs (375 × 812, 390 × 844,
  768 × 1024, 1512 × 982) plus la galerie à 320 × 568 ; `reducedMotion: 'reduce'`, service workers bloqués, réseau externe coupé, porte passée ; les
  données sont SEMÉES dans la base jetable du contexte par les modules réels (`semer(page, 'peu' | 'beaucoup')` : un livre, douze recettes, deux
  pages de sommaire ; 2 puis 9 photos) ; colonnes : débordement, navigation, cibles, contraste par nœud texte, `[hidden]`, **onglet** (« Bibliothèque »
  exact, une ligne, sans débordement : D-UI-4, § 13 point 3), console ; M14 (focus clavier, anneau olive) ; M3 NON rejouée (l'app ne poste plus à
  `api.anthropic.com` ; `search.js` inchangé : R-VIS-8 tenu par `tests/theme.js`). La galerie monte les composants RÉELS (`recipeCard`, `grilleCartes`,
  `sectionPlain`, `section`, `pageHeader`, `icone`) par un `<script type="module">` et signale `data-galerie-prete`. Contre-preuves : olive pâle →
  contraste KO ; libellé d'onglet allongé → onglet KO.
```

  4. **Spec § 12** — insérer, juste AVANT `## 13. À trancher par Neegan (sans urgence ; chaque point a son défaut, construit tel quel)` (et, dans la même
     spec, trois amendements de texte retrouvés par leur TEXTE — rév. 2 : § 4.2, « sous-titre = « Du web · {hôte} » / « De mon livre · {titre} — {auteur} · page N » /
     étiquette IA » → « sous-titre = `provenanceText(recipe, book, edition)`, inchangé (R-UI-P2 : les préfixes « Du web · » / « De mon livre · » sont ceux de la
     carte-plat) » ; § 5, ligne `| Ingrédients / Préparation | Ingredients / Steps | segmented mobile |` → `| Ingrédients / Préparation | Ingredients / Method | segmented mobile (clés des sections, R-UI-P3) |` ;
     et — D-8, rév. 3 — dans la sous-section `### Specs amendées par ce lot` de § 12, APRÈS la puce « Recette web (…) », une puce neuve :
     `- Cette spec, § 5 (UI-1) : cinq textes posés par T3 à T5 HORS de la table, chacun avec son entrée `en.js` (R-UI-[n+3]) — « Reprendre la séance » → « Resume the session » (§ 4.3, T4 ; le `t('Reprendre')` existant n'est pas réemployé : D-8), « Disponibles » → « Available » (filtre § 4.3, T4), « {n} à importer » → « {n} to import » (compteur library.js:73, T5), « Page {n} · p. {p} » (légende § 4.5, identique, T5), « 1 portion » → « 1 serving » (repères, clé antérieure relue, T3).`) :

```markdown
### Construction UI-1 : rulings (23-25 octobre 2026, branche `experience-carnet`, registre `.superpowers/sdd/2026-10-23-experience-carnet/`)

Une ligne par ruling, dans l'ordre des tâches (détail : `progress.md` et le rapport de la tâche) ; chacun se renverse sans défaire le reste.
- **R-UI-P1** (pré-vol du plan, rév. 2) `search.js:162` est la SEULE édition de `search.js` en UI-1 : le littéral `'🔍'` → `'loupe'` (§ 3.3 ; `emptyState`
  stricte lèverait sinon) ; la forme de la carte web (`tests/recherche-web.js:1035`) ne bouge pas ; la version UI-2 de `search.js` porte `'loupe'` à la fusion.
- **R-UI-P2** (pré-vol du plan, rév. 2) le sous-titre de la fiche recette reste `provenanceText` (« {titre} — {auteur} · page N », hôte recalculé, étiquette IA) :
  « Du web · » / « De mon livre · » sont les préfixes de la carte-plat (`ligneSource`), pas de la fiche (`tests/creer-ia.js:1397` épingle « Mon livre — A. B. ·
  page 58 » ; C10, F22 : une fiche à livre ET adresse montre les deux). § 4.2, première phrase, amendée en ce sens. Coût si faux : un préfixe à poser, quatre tests.
- **R-UI-P3** (pré-vol du plan, rév. 2) le `segmented` Ingrédients / Préparation réemploie les clés des sections : « Préparation » → « Method » (`en.js:49`) ;
  § 5 amendé (« Ingredients / Method », H-14 par analogie). Coût si faux : une clé dédiée au `segmented`.
- **R-UI1-1** (chef d'orchestre, plan rév. 3) la règle `.plat-vignette.grande` est la MÊME, au caractère près, dans UI-2 et UI-1 (`width: 100%; height: auto;
  aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; display: block`) ; UI-1 ajoute `.plat-vignette.petite` (48 × 48) juste après et porte l'épingle
  `tests/photo-plat.js:1323` à TROIS sélecteurs (UI-2 : deux) ; la fusion résout `styles.css` (règle identique écrite une fois, `figure.apercu` de UI-2 gardée)
  et cette épingle par union. Coût si faux : un conflit textuel de plus à la fusion.
- **R-UI1-2** (chef d'orchestre, plan rév. 3) la liste des sources du test I-F3 (`tests/photo-plat.js:1327-1331` : `srcPP`, `srcK`, `srcMeals`) appartient
  à UI-2 seul, qui l'étend à `search.js` et `library.js` ; UI-1 n'y touche pas. Coût si faux : un conflit textuel à la fusion.
[R-UI-1 à R-UI-n : copiés mot pour mot de `progress.md` (T1 à T5 et leurs rondes), numérotés dans l'ordre où ils y sont consignés.]
- **R-UI-[n+1]** (T6) M3 (« Annuler » à droite pendant un vol, R-VIS-8) n'est pas rejouée par la preuve visuelle : l'app ne poste plus à
  `api.anthropic.com` (lot passerelle) et un vrai vol exige une session ; `search.js` ne change pas en UI-1 ; la règle est tenue par `tests/theme.js`.
  Coût si faux : un recouvrement K1 / « Annuler » réapparu ne serait vu qu'au prochain lot qui touche `search.js` (UI-2 : sa preuve § 7 le mesure).
- **R-UI-[n+2]** (T6) « Aller à Mes livres. » quitte `en.js` avec les trois chaînes nommées au § 5 (même décision, D-UI-4 : « Aller à la
  bibliothèque. » la remplace). Coût si faux : une clé morte de plus dans le dictionnaire, rien à l'écran.
- **R-UI-[n+3]** (T6) cinq textes que § 5 ne fixe pas : « Disponibles » (filtre § 4.3) → « Available », « 1 portion » (repères, n = 1 ; clé antérieure,
  en.js:341) → « 1 serving », « Reprendre la séance » (§ 4.3) → « Resume the session », « {n} à importer » (compteur library.js:73) → « {n} to import »,
  « Page {n} · p. {p} » (légende § 4.5, identique) ; épinglés par `tests/carnet.js` (table `TEXTES_UI1`, 33 paires). Coût si faux : des mots d'anglais à
  changer, un test à relire.
- **R-UI-[n+4]** (T6) la galerie de la preuve monte les composants RÉELS de `src/ui` (`recipeCard`, `grilleCartes`, `sectionPlain`, `section`,
  `pageHeader`, `icone`) par un module, et l'outil attend `data-galerie-prete="1"` : un nom qui n'existe pas rougit la ligne « galerie » au lieu de
  montrer une copie de balisage périmée. Coût si faux : la galerie dépend des noms de T1-T2 (voulu).
- **R-UI-[n+5]** (T6) à 320 px (§ 13 point 3), seule la passe « etroit » juge l'onglet « Bibliothèque » (texte exact, une ligne, sans débordement) sur la
  galerie ; le débordement du reste de la galerie à cette largeur (barre haute avec pastille, 341 px, spec refonte § 11) est connu et exclu de la
  mesure. Coût si faux : un débordement neuf à 320 px hors de l'onglet ne serait pas vu ; 320 px n'est pas une largeur de T-7.
[Dettes et limites nommées par T1 à T5, une ligne chacune, si `progress.md` en porte.]
```

- [ ] **Step 9 : invisibles, secrets, périmètre.** Sur chaque fichier touché par la tâche (suivis : `tests/carnet.js`, `tests/ajouter.js`, `tests/tests.js`,
  `src/i18n/en.js` et `sw.js` s'ils ont changé, `CLAUDE.md`, `STATE.md`, `docs/architecture.md`, la spec ; hors git : `preuve-visuelle.cjs`,
  `galerie.html`) — la commande de la ligne 21 du plan `docs/superpowers/plans/2026-10-17-assistant-par-le-compte.md`, lue par script, jamais retapée
  (`grep` de ce shell = `ugrep` UTF-8, faux vert) ; attendu `0` partout. Puis `git grep -nEi 'sk-ant-[0-9A-Za-z_-]{10,}|sb_secret_|eyJ[0-9A-Za-z_-]{20,}' --
  tests/carnet.js tests/ajouter.js src/i18n/en.js CLAUDE.md STATE.md docs/architecture.md docs/superpowers/specs/2026-10-23-experience-carnet-design.md`
  : vide ; `git diff --stat f3672be..HEAD -- supabase/` : vide ; `git status --short` : aucun fichier de `.superpowers/` listé (exclu). `node --check`
  sur `preuve-visuelle.cjs` : 0.
- [ ] **Step 10 : commits** (deux ; messages ASCII sans accents ; `git add` nominatif, jamais `-A` ; trailer `Co-Authored-By` du modèle réel de
  l'implémenteur, R-T1-3 — ex. `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`) :
  1. `git add tests/carnet.js tests/ajouter.js tests/tests.js` (+ `src/i18n/en.js sw.js` s'ils ont changé) ;
     `Lot UI-1 tache 6 : filets i18n du lot, chaines retirees, total epingle`, corps : `tests/carnet.js : bloc T6 (33 textes — 28 de la spec 5, 5 hors table — avec leur
     anglais, cles reemployees, CHAINES_NEUVES_AILLEURS a jour par calcul pour library/recipe/book/home/components, MODULES_NEUFS, chaines retirees
     absentes d en.js et de tout module de SHELL, NAV Bibliotheque, treize selecteurs neufs) ; tests/ajouter.js : filets completes ; en.js : quatre cles
     mortes retirees (sw.js VERSION -[K+1]) OU en.js intact (aucune version). Epingle [N-2] -> [N-1] (suite [N/N]). Vert d emblee ou rouge lu : [ce qui a
     ete vu au Step 2]. Mutants M-UI6-1 a M-UI6-8 rouges sur copies (registre).`
  2. `git add CLAUDE.md STATE.md docs/architecture.md docs/superpowers/specs/2026-10-23-experience-carnet-design.md` ;
     `Lot UI-1 tache 6 : preuve visuelle rejouee, docs (CLAUDE.md, STATE.md, architecture, spec 12)`, corps : `Preuve visuelle : copie adaptee de l outil du
     lot refonte dans le registre (hors git) ; 69 lignes vertes aux largeurs 375/390/768/1512 + galerie a 320 ; 173 captures ; contraste minimum [min] sur
     [n] noeuds ; onglet Bibliotheque entier a 320-768 ; M3 non rejouee (R-UI-[n+1]) ; contre-preuves olive pale et onglet allonge rouges. Section du lot dans
     CLAUDE.md et docs/architecture.md, STATE.md, spec 12 Construction UI-1 : rulings R-UI-P1 a P3 (pre-vol du plan), R-UI1-1 et R-UI1-2 (chef, rev. 3),
     R-UI-1 a R-UI-[n+5] ; spec 4.2 et 5 amendees (R-UI-P2, R-UI-P3), Specs amendees : cinq textes hors table (D-8). Aucun fichier de src/.`
  Après chaque commit : `git log --format='%h %s%n%b' -1` relu (ASCII, trailer présent), `git status --short` propre hors `.superpowers/`.

---

### Clôture (contrôleur, hors tâche)

- **Revue finale de branche** (panel à trois lentilles : besoin / spec, sécurité et vie privée, faux-vert ; sur `git diff f3672be...experience-carnet`,
  lu depuis une copie `git archive <sha>` servie à part, jamais le worktree pendant qu'un agent y écrit), puis une **vague** de corrections (un commit
  par ronde, message ASCII, `sw.js` +1 si `src/`, `styles.css` ou `sw.js` sont touchés, R-B-24), re-revue jusqu'à zéro constat Critical ou Important ;
  chaque constat de la revue finale qui change ce que la personne OBTIENT est rouge d'abord (sur une copie de l'ancien `src/`), puis vert. Les
  rulings de la vague s'écrivent R-UI-n+… dans `progress.md` et en spec § 12 « Construction UI-1 : rulings » (T6 a posé le sous-titre).
- **`/verify`** sur la tête finale : suite `node .superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096` (bilan `✅ N/N` lu, épingle N−1 relue dans
  `tests/tests.js`, une seule erreur de console : le 404 de `/favicon.ico`), `node --test tools/*.test.mjs` (208/208, inchangé), `node
  tools/generer-migrations.mjs --check` (0), `tests/theme.js` vert (T-1, T-2, T-11, survols : le filet « aucune couleur en dur ni `display:none` neuf »),
  preuve visuelle `node .superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs 8096` rejouée sur la tête finale (code 0, `resultats.md`
  VERT, lignes, captures, contraste minimum et nœuds relevés dans `resultats.json`), scan de secrets sur tout le diff (aucune clé ni jeton réel ; les
  sentinelles des tests seulement), invisibles en Python `-I` sur tout le diff (0), `git diff --stat f3672be..HEAD -- supabase/ tools/` vide, `APP_VERSION
  0.17.0`, `sw.js cuisine-os-v0.17.0-K` (K = nombre de commits qui ont touché `src/`, `styles.css`, `index.html`, le manifeste ou `sw.js`), `DB_VERSION` 4 ;
  mutants : la liste de § 7 (olive remise en tomate, `photoEnTete` sans contrôle des octets, filtre « Du web » câblé sur `mode=web`, « À importer » posé
  sur une `available`, `plain` par défaut, « Corriger » hors de l'en-tête sur une fiche non vérifiée, grille sans borne) rejouée sur une copie de la
  tête finale APRÈS les rondes (chacun rouge, sortie lue, consignée `verify-UI1-<sha>.txt` dans le registre). « Vert » seulement si tout est lu ;
  « vert conditionnel » n'existe pas pour ce lot (rien à coller, rien à redéployer).
- **Documents** (posés par la tâche 6, relus et complétés par la vague : chaque nombre vient d'une mesure, jamais deviné) : `CLAUDE.md` (section
  « Expérience « carnet » … (23-25 octobre 2026, lot UI-1) » : Pour toi, Où, Ce qui marche, Ce qui n'est PAS prouvé, Dettes, Gestes de Neegan, Versions,
  Bilan, Fusion), `STATE.md` (titre, paragraphe de tête, bloc « Reprendre »), `docs/architecture.md` (section « Expérience « carnet » (lot UI-1) »),
  spec § 12 (« Construction UI-1 : rulings » : R-UI-1 à R-UI-n des tâches, R-UI-n+1 à n+5 de T6, puis ceux de la vague ; chaque amendement nommé des
  Step 0 ; la sous-section « Assemblage (rév. 1) » de ce plan, A-1 à A-n et D-1 à D-n, tranchée ligne par ligne), plan coché et commis sous
  `docs/superpowers/plans/2026-10-23-experience-carnet-ui-1.md`. Ces quatre documents sont AUSSI touchés par UI-2 : conflits textuels attendus à la
  fusion, en plus des quatre fichiers communs de § 9 — les deux sections (UI-2, UI-1) se gardent toutes deux, dans cet ordre.
- **Registre** : copier `.superpowers/sdd/2026-10-23-experience-carnet/` (progress, cartographie, revues de la spec, briefs et rapports de tâche,
  `suite.cjs`, `preuve-visuelle.cjs`, `galerie.html`, `resultats*.md` / `.json`, `preuve-journal.txt`, **`captures/`**, `verify-*.txt`) dans
  `~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet) AVANT tout `git worktree remove` ; la recopier après la vague et après la clôture (chaque
  rapport périme la copie). Les 173 captures vivent hors git : elles disparaissent avec le worktree si la copie manque.
- **Fusion dans `main` : APRÈS UI-2, par un commit de fusion** (spec § 9 ; jamais `--ff-only` : UI-2 a bougé `main` ; jamais de rebase : commits de
  fusion seulement, l'historique n'est pas réécrit). Ordre, sur le mot de Neegan : (1) UI-2 fusionne d'abord (`0007` collée et prouvée, fonction
  redéployée, sondes, fusion de `apercus-web`, push — sa section) ; (2) `git -C ~/projects/mistu fetch`, puis depuis l'arbre principal : `git merge
  --no-ff experience-carnet` ; les **quatre fichiers communs** se résolvent ainsi, par leur texte : `sw.js` → `SHELL` = UNION des deux listes
  (`./src/ui/icones.js` entre `./src/ui/home.js` et `./src/ui/import-cible.js` ; `./src/domain/apercu-web.js` à la place que UI-2 lui a donnée) et
  `VERSION = 'cuisine-os-v0.17.0-(K+1)'` où K est le dernier suffixe servi par l'une ou l'autre branche (I-UI-7 : le premier lot FUSIONNÉ porte 0.16.0, le
  second 0.17.0) ; `src/model/schema.js` → `APP_VERSION = '0.17.0'`
  et les 13 assertions + 1 commentaire des 8 suites à `0.17.0` (le script du relevé des pins, lancé avec `0.16.0` puis `0.17.0`, rend rien puis quinze
  lignes). **Si UI-1 fusionnait AVANT UI-2** (ruling 19, rév. 3), un commit de version renumérote à la fusion, par le texte des mêmes fichiers : UI-1,
  fusionné en premier, passe à `0.16.0` (`src/model/schema.js:6`, `sw.js` `VERSION = 'cuisine-os-v0.16.0-K'`, les 13 assertions + 1 commentaire des 8 suites ;
  le script du relevé des pins lancé avec `0.17.0` ne rend plus rien, avec `0.16.0` quinze lignes), puis UI-2, fusionné en second, passe à `0.17.0` par le
  même geste à sa fusion ; aucune des deux branches ne porte deux fois le même numéro, `DB_VERSION` reste 4. `src/i18n/en.js` → UNION des entrées (une
  clé posée par les deux lots est écrite UNE fois ; aucune clé retirée par UI-1 ne revient) ;
  `tests/tests.js:250` → l'épingle REMESURÉE sur l'arbre fusionné, servi à part (règle N−1), jamais la somme des deux ; `src/ui/search.js` → la version
  de UI-2 (figures, ligne d'état) avec le littéral `'loupe'` de UI-1 dans son état vide (D-1 de l'Assemblage, RATIFIÉ rév. 3 : la ligne
  `results.append(emptyState('loupe', t('Aucune recette admissible.') + …` ; rien d'autre de UI-1 dans ce fichier) ; **`styles.css` → UNION (R-UI1-1,
  rév. 3)** : la règle `.plat-vignette.grande` est IDENTIQUE au caractère près dans les deux lots (écrite UNE fois, juste après la règle `.plat-vignette`
  72 px), `figure.apercu { margin: 0 0 .6rem }` de UI-2 est gardée juste après elle, `.plat-vignette.petite { width: 48px; height: 48px; }` de UI-1 suit —
  l'épingle « exactement trois sélecteurs » reste vraie dans l'ordre `.plat-vignette`, `.plat-vignette.grande`, `.plat-vignette.petite` (`figure.apercu`
  ne nomme pas `.plat-vignette`) ; **`tests/photo-plat.js:1323`** → la version UI-1 (TROIS sélecteurs ; UI-2 en pose deux) ; **`tests/photo-plat.js:1327-1331`**
  (les sources du test I-F3, `srcPP`, `srcK`, `srcMeals`) → la version UI-2 (étendue à `search.js` et `library.js` ; UI-1 ne la touche pas, R-UI1-2) ;
  `CLAUDE.md`, `STATE.md`, `docs/architecture.md`, la spec § 12 → les deux sections gardées. Puis la suite complète sur l'arbre fusionné (`python3 -m http.server 8097 --bind
  127.0.0.1` depuis `~/projects/mistu`, `node ~/projects/mistu/.superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8097` → `✅ N/N`), Node 208/208,
  `--check` 0, `tsc` 0 si UI-2 a touché `index.ts`, la preuve visuelle sur 8097 (VERT) ; relire la résolution de chaque conflit à l'œil (jamais une
  résolution par script sans relecture : la PWA a déjà cassé deux heures ainsi) ; commit de fusion ASCII.
- **Push et suite publique** (geste de Neegan, par `!`) : `! git -C ~/projects/mistu push origin main` (HTTPS + `gh auth git-credential` si la garde SSH
  tue le push en silence : relire `origin/main` après) ; ouvrir `https://neegans.github.io/mistu/tests/` et lire le BILAN (attendu : la valeur
  remesurée à la fusion, plus le 404 de `/favicon.ico`) ; service worker `cuisine-os-v0.17.0-(K+1)` ; tous les appareils sur 0.17.0 avant la première
  preuve réelle (règle R-C-32 : un appareil resté sur 0.16.0 ne connaît pas la grille Recettes mais lit les mêmes données — aucune donnée ne change ici).
- **Gestes de Neegan — preuve réelle § 10 UI-1** (sur le site public, après le push ; aucun coût, aucun appel) : (1) Bibliothèque → Recettes sur TA
  bibliothèque : dire si la grille, avec le nombre réel de photos que tu as, ressemble assez à la maquette (sinon § 13 point 5, « photos d'abord »,
  renversable au prix d'un tri) ; filtres Toutes / De mes livres / Du web ; pied « Recettes de mes livres à importer » ; « Ajouter une recette » en tête et,
  sur l'iPhone, sous la grille ; (2) une fiche de recette AVEC photo sur le Mac (deux colonnes, `details` ouvert) et sur l'iPhone (photo pleine largeur
  sous la provenance, onglets Ingrédients / Préparation, `details` replié, « Corriger » à côté de « Commencer à cuisiner » sur une fiche non relue) ;
  (3) une fiche de livre (menus « Ajouter des recettes » et « Ajouter des pages de sommaire » en tête ; deux colonnes sur le Mac, couverture et Sommaire à
  gauche ; sur l'iPhone, 8 lignes puis « Voir les {n} recettes ») ; (4) Aujourd'hui (titre, barre sur le papier, Favoris et Dernières cuissons en
  cartes) ; (5) Ajouter (icônes au trait) et une référence → « Importer » (badge « À importer », « × » en coin de la vignette, légende « Page 1 · p. N ») ;
  (6) l'onglet « Bibliothèque » lisible sur l'iPhone, « Agrandir l'affichage » dit (repli « Carnet », § 13 point 3) ; (7) Safari / iPhone : Georgia et
  `clamp()` des titres, `object-fit` des photos 4:3, le `details` au toucher, les icônes SVG dans les onglets — rien n'y a été vu (aucun WebKit ici) ;
  (8) les sept points de § 13 restent renversables, chacun au prix dit dans sa ligne ; (9) « clean » SEULEMENT après la copie du registre avec
  `captures/` (`diff -rq` muet), puis `git worktree remove` de `mistu-carnet` ; les serveurs 8096 (et 8095 de UI-2) tués par Neegan.

---

## Assemblage (rév. 1)

Six auteurs ont écrit les tâches 1 à 6 en parallèle, chacun en lecture seule sur `f3672be` et sans le texte des autres ; l'assembleur a lu les six,
la spec et le code aux lignes citées (toutes relues : `components.js:17-39`, `book.js:160-200`, `library.js:73`, `recipe.js:38-49, 171, 315, 341`,
`import-cible.js:499-510, 665-672`, `import-web.js:17, 390, 397, 450`, `photo-plat.js:87`, `add.js:15-42`, `accueil-livre.js:5-28`, `home.js:1-12`,
`styles.css` aux ancres de T1 à T5, `en.js:4, 23, 49, 232-235, 251, 341`, `tests/ajouter.js:8, 24-62, 844-846, 1133, 3672-3675, 3729, 3807`,
`tests/photo-plat.js:340-341, 1298, 1309, 1323`, `tests/sync-l4.js:3476, 3580`, `tests/creer-ia.js:1089, 1341-1391, 1511-1513, 1790`,
`tests/lecture-web.js:605-1073`, `tests/table-matieres.js:1605-1608, 1623, 1672`, `tests/tests.js:34, 242, 250`, `sw.js:4, 19`, `schema.js:6`,
`i18n.js:27`, les onze sites `emptyState(` et `search.js:18, 162`) et corrigé les écarts suivants, chacun par une édition ciblée du texte de la tâche :

- **A-1** (T2, T3, T4, T6) le lanceur de bloc de `tests/carnet.js` s'appelle **`bloc(nom, f)`** (T1) : T3 et T4 l'appelaient `run` sans le définir
  (T2 définit un `run` LOCAL dans son bloc `{ … }`, gardé) ; les six `await run('T4 — …')` de T4 et l'appel de T3 sont réécrits `bloc(…)`.
- **A-2** (T3, T4, T6) chaque bloc s'ajoute **AU-DESSUS du repère de fin** de `runCarnetTests`, après le bloc de la tâche précédente (T1 l'écrit ainsi ;
  T3 et T4 disaient « à la fin du `try` », qui n'existe pas ; T6 « juste avant l'accolade », sous le repère). T3 n'importait pas `withRepo` : son bloc
  est enveloppé `{ const { withRepo } = await import('./sync-fixture.js'); … }`, comme T2, T4 et T5.
- **A-3** (T4) `.two-col.livre` est posée par **T1** aux deux bornes (`1fr` dans le bloc 760 px, `200px 1fr` sous 900 px), pas par T2 : le conditionnel (b)
  du Step 0 de T4 est attendu sans objet ; T4 l'attribuait à T2.
- **A-4** (T4) `emptyState(icone('livre-ouvert'), …)` lèverait : T1 rend `emptyState` STRICTE (un NOM, `icone()` appelée dedans). T4 écrit
  `emptyState('livre-ouvert', …)` et n'importe plus `icones.js` dans `book.js`.
- **A-5** (T4) même constat que A-3 côté `styles.css` (Files et Step 5 de T4 relus).
- **A-6** (T3) T2 exporte `dureeTotale(version)` (`components.js`) : `dureeVersion` (recipe.js) lui DÉLÈGUE et n'ajoute que `formatMinutes` et la garde
  `> 0` — une seule règle de durée (D-UI-5, B-I-6) ; les huit cas du test de T3 rendent la même valeur (relus un à un : `'x'`, `-5`, `0 + 0`, création IA).
- **A-7** (T4, T5) `'À importer': 'To import'` est posée par **T2** (Step 7) : T4 la redoublait dans `en.js` (retirée de son Step 5 ; sa liste
  `CHAINES_NEUVES_AILLEURS` de `book.js` la garde, parce que `book.js` l'écrit) ; T5 la lit comme réemployée.
- **A-8** (T5) la clé `'../src/ui/library.js'` de `CHAINES_NEUVES_AILLEURS` est créée par T2 (douze chaînes) : T5 y AJOUTE `'{n} à importer'` au lieu
  d'écrire une seconde clé (une clé homonyme écrase la première dans un littéral d'objet).
- **A-9** (T6) les listes du Step 3.2 de T6 ne montrent plus que les COMPLÉMENTS : `book.js` + `'Bibliothèque'`, `'Toutes'`, `'Disponibles'` (T1 écrit le
  retour ; `book.js` écrit `t('Toutes')` et `t('Disponibles')`, deux textes de la table : le filet CALCULÉ du Step 1 les exige, T4 les avait exclus comme
  antérieurs) ; `recipe.js` + `'Bibliothèque'`, `'1 portion'` (`'Voir la page d’origine'` est écrite par `components.js`, T3, pas par `recipe.js`) ;
  `components.js`, `library.js`, `home.js` inchangées (T2, T3, T5 les ont complétées).
- **A-10** (T6) la table `TEXTES_UI1` compte **33 paires** (T6 disait 30 et 32) : les 28 textes neufs UI-1 de § 5, plus cinq textes que les tâches posent
  hors de la table — `'Disponibles'` (T4), `'1 portion'` (clé antérieure, `en.js:341`, anglais relu), `'Reprendre la séance'` (T4), `'{n} à importer'` (T5),
  `'Page {n} · p. {p}'` (T5) ; R-UI-n+3 et les quatre documents de T6 le disent.
- **A-11** (T6) `t('Voir la page d’origine')` n'est écrit que dans `components.js` (`lienOrigine`) ; `recipe.js` et `import-web.js` l'appellent (relevé
  attendu du Step 0 de T6 corrigé) ; la note « 2 sur 9 cartes » de la route `bibliotheque` devient « 2 sur 10 » (sept disponibles, la longue, la web,
  le signet ; les deux références sont dehors).
- **A-12** (T4) deux restes du mot `run` dans la prose (Step 3 « rouge lu » : « nommée par son `run` », « le bloc rougit par son `run` » ; Step 6 : « six
  `run` ») réécrits `bloc` — A-1 suivi jusqu'au bout ; le code de T4 appelait déjà `bloc(…)`.
- **A-13** (T5) le bloc `CHAINES_NEUVES_AILLEURS` du Step 2, point 6, montrait la liste de `components.js` sans la ligne de T2 (`'Du web · {h}', 'De mon
  livre · {t}'`) ni celle de T3 (`'Voir la page d’origine'`), et la clé `home.js` collée à `components.js` : les deux lignes sont rétablies dans l'ordre réel
  (lot G → T2 → T3 → T5) et un commentaire dit que `search.js` (lot B, l. 51) puis `library.js` (T2) s'intercalent avant `home.js` — ce que le Step 0 (d)
  et la parenthèse du point 6 disaient déjà.
- **A-14** (T6) `Files` disait encore « entrées NEUVES `library.js` et `home.js` » et le mutant M-UI6-1 cherchait `'Voir la page d’origine'` sous
  `CHAINES_NEUVES_AILLEURS['../src/ui/recipe.js']` : alignés sur A-9 et A-11 (`library.js` est posée par T2, `home.js` par T5, la clé vit sous
  `components.js`, T3) ; au Step 2, `tests/ajouter.js:25, 44` → `:25, 37` (la liste de `recipe.js` est à la l. 37 à `f3672be`, celle de `components.js` à la l. 45).
- **A-15** (T6) le sous-titre de la spec § 12 portait le marqueur `[dates]` : `23-25 octobre 2026`, les dates que T6 pose déjà dans `CLAUDE.md` et
  `docs/architecture.md` (son Step 8 dit de relire `git log --format=%ci` et d'ajuster la fin). Les autres crochets `[…]` de T6 (`[sha]`, `[N/N]`, `[min]`,
  `[n]`, `[R-UI-1 à R-UI-n …]`) sont déclarés comme « la valeur à lire, et où » (Step 8, point 1) : des relevés, pas des trous. **RATIFIÉ rév. 3** : des
  relevés à remplir par la tâche 6, dits tels quels dans ses Steps (Step 8 nomme la source de chacun ; le Step 9 vérifie qu'aucun crochet ne reste commis).
- **A-16** (en-tête, D-14) T4 n'annonçait aucun compte d'assertions : ses six blocs en portent 35 (8 + 9 + 7 + 2 + 4 + 5), plus l'amendement de
  `tests/photo-plat.js:1298` (+1) ; par raisonnement, l'épingle finale attendue est **6134** = 5947 + 1 + 3 + 37 + 40 + 30 + 36 + 28 + 12 (29e paire, filet
  `MODULES_NEUFS` pour `icones.js`, carnet T1 à T6 — recomptée au pré-vol rév. 2 : la rév. 1 disait 6124 sans les 3 du filet, avec T2 37 et T3 26 ; rév. 3 :
  T2 40 par la largeur 950, D-15) et le bilan ✅ 6135/6135 — un attendu, jamais une consigne : chaque Step « vert » épingle la valeur mesurée (règle N−1),
  la clôture relit la valeur de la tête finale. **RATIFIÉ rév. 3** (avec D-14) : des attendus de raisonnement ; la valeur MESURÉE fait foi, l'écart se consigne.
- **A-17** (T3) le Step 7 disait « l'assembleur ordonne T1 → T2 → T3 → T4 → T5 sous un seul en-tête de lot » dans `en.js` : aucun en-tête commun n'est posé ;
  les entrées de T2 à T5 se suivent en fin de dictionnaire, chacune sous sa ligne de commentaire « Lot UI-1 … tâche N », dans l'ordre des tâches, et T1
  pose les siennes en place (l. 4 et l. 232) ; la phrase est réécrite ainsi.

**Doutes laissés au chef d'orchestre** (chacun tranché par une ligne, aucun ne bloque le départ de T1) :

- **D-1** `search.js:162` : le brief dit à la fois « aucune édition de `search.js` » et « les onze états vides (… `search.js:162` …) » ; § 3.3 nomme
  `loupe` pour ce site. Le plan change CE SEUL littéral (`'🔍'` → `'loupe'`) : `emptyState` étant stricte, sans lui l'état vide de la recherche
  LÈVERAIT au rendu. Ligne à surveiller à la fusion avec UI-2 (branche `apercus-web`, qui réécrit `search.js`) ; si le chef tranche l'inverse, retirer
  `'search.js': ['loupe']` de `SITES` (bloc « sources » de T1) et du Step 7.2 de T1, et rendre à `emptyState` un repli texte pour ce seul site.
  **TRANCHÉ rév. 2 : R-UI-P1** (Global Constraints) — l'édition du seul littéral est gardée et nommée ; la fusion porte `'loupe'` dans la version UI-2.
  **RATIFIÉ rév. 3** : `search.js:162` change d'UN seul littéral (`'loupe'`), rien d'autre dans `search.js` ; la ligne est nommée pour la fusion (R-UI-P1, Clôture).
- **D-2** « la roue » (T1) est lue comme la roue des Réglages du PANNEAU LATÉRAL (`app.js:52`) ; la pilule « ⌕ » et le bouton « ⚙︎ » de la barre haute
  (`app.js:59-60`) restent en texte (« rien d'autre »). **RATIFIÉ rév. 3** : la roue traitée par T1 est celle du panneau latéral ; la pilule et le bouton de la
  barre haute restent en texte (T1 Files, Step 7.1, Step 12 le disent).
- **D-3** `tests/theme.js` : la spec § 7 T1 liste les lignes 27, 93, 95, 96, 106, 108, 110, 113 ; `grep -n tomate` rend aussi 45 (commentaire) et 48
  (libellé « 2px tomate ») : T1 les renomme aussi (amendement EI-T1-1 à consigner). **RATIFIÉ rév. 3** : l. 45 et 48 renommées aussi.
- **D-4** la ligne de source d'une fiche qui a un livre ET une adresse dit « Du web · {hôte} » (T2 : son texte vient du web ; le filtre « De mes livres »
  la garde). La spec ne tranche pas ce cas (C10 montrait les deux sur la carte horizontale). **RATIFIÉ rév. 3** : « Du web · {hôte} » quand livre ET adresse
  (`ligneSource`, T2 Step 4 ; épinglé par le bloc « dureeTotale, ligneSource, badges »).
- **D-5** `?tab=a-importer` sans référence et un filtre sans résultat (T2) : « Aucune recette pour l’instant. » réemployée sans action, et une grille vide
  sans phrase — § 5 n'a pas de texte dédié. **RATIFIÉ rév. 3** : grille vide sur un filtre sans résultat ; `?tab=a-importer` sans référence réemploie
  « Aucune recette pour l’instant. » (`aImporterTab`, T2 Step 6).
- **D-6** « Ingrédients / Préparation » → § 5 dit « Ingredients / Steps » pour le `segmented`, mais `en.js:49` porte déjà `'Préparation': 'Method'` et la
  section partage la clé : T3 garde la traduction existante (H-14 par analogie) ; T6 ne pince que l'existence des deux clés. **TRANCHÉ rév. 2 : R-UI-P3** — T6
  amende la ligne de § 5 en « Ingredients / Method » et porte le ruling en § 12. **RATIFIÉ rév. 3** : 'Préparation' garde 'Method' (clé existante) ; § 5
  amendé à la clôture (R-UI-P3).
- **D-7** les repères de la fiche lisent `version.servings` (une donnée), jamais `state.servings` (le −/+ et `?servings=` recalculent les lignes sans
  changer la recette) : décision de T3, épinglée ; renversable. (Non visé par la rév. 3 : reste tel quel.)
- **D-8** « Reprendre la séance » (§ 4.3) n'est pas dans la table § 5 : T4 pose `'Resume the session'` ; ou réemployer le `t('Reprendre')` existant.
  **TRANCHÉ rév. 3** : « Reprendre la séance » et toute chaîne neuve hors table § 5 reçoivent leur entrée `en.js` (T4 : 'Resume the session', 'Available' ;
  T5 : '{n} to import', 'Page {n} · p. {p}' ; T3 : '1 portion' relue) et sont listées par T6 dans la sous-section « Specs amendées par ce lot » de § 12
  (Step 8.4) ; le `t('Reprendre')` existant n'est pas réemployé.
- **D-9** `renderHome` gagne un quatrième paramètre `{ repo }` (T5, pour compter la passe `getFiles`) : `app.js:96` ne change pas ; petite extension d'API
  à ratifier (R-UI-…). **RATIFIÉ rév. 3** : `renderHome` gagne `{ repo }` optionnel sans changer `app.js`.
- **D-10** T4 fait le compteur « {n} disponible(s) · {m} à importer » et le filtre « À importer » de `book.js` (§ 7 les rangeait sous T5 : T4 réécrit la
  section entière) ; T5 reste conditionnel sur `book.js` et ne touche que `library.js:73`. **RATIFIÉ rév. 3** : T4 porte le compteur et le filtre de `book.js` ;
  T5 ne les refait pas (son conditionnel est retiré : un reste à la tête de T4 est un constat pour la revue de T4, NEEDS_CONTEXT pour T5).
- **D-11** choix de composition de T4 non dits par la spec : le `details` « Ajouter des entrées d’index à la main » sous « Sommaire » ; « Sommaire » rendu
  seulement avec une page `kind: 'index'` ou une séance ouverte ; les pages d'index quittent « Pages et fichiers sources ».
- **D-12** la légende d'une vignette de l'import ciblé (T5) rouvre le champ au clic ; rien ne le referme sur Échap ni à la perte de focus (seule une
  saisie valide) : choix minimal.
- **D-13** `tests/table-matieres.js:1672` liste `'Repérée dans ton livre — page {p}'` parmi les clés réemployées : `recipe.js:315` la porte toujours
  (D-UI-10) → aucun amendement (la spec § 7 T5 la cite pourtant : un amendement VIDE est consigné, pas inventé).
- **D-14** les comptes du rouge et du vert de chaque tâche (T1 ❌ 5938/5982 puis ✅ 5989/5989, épingle 5988 — les 3 `ok()` du filet `MODULES_NEUFS` pour
  `icones.js` comptés, rév. 2 ; T2 +40 (39 à la rév. 2, + 1 par la largeur 950 à la rév. 3) ; T3 +30 ; T4 +36 — 35 assertions dans ses six blocs,
  8 + 9 + 7 + 2 + 4 + 5, plus l'amendement de `tests/photo-plat.js:1298` — ; T5 +28 ; T6 +12 ; soit, par raisonnement, une épingle finale 6134 = 5947 + 1 + 3 +
  37 + 40 + 30 + 36 + 28 + 12 et un bilan ✅ 6135/6135 à la tête de T6) sont établis par raisonnement sur le code, pas mesurés : chaque Step « vert » épingle
  la valeur MESURÉE et consigne l'écart. **RATIFIÉ rév. 3** (avec A-16) : toutes les valeurs de suite du plan sont des attendus de raisonnement.
- **D-15** les mutants de `styles.css` « @media 900 → 1000 px » (T2) ne sont pas tués par les largeurs 375 / 1100 ; une largeur 950 les tuerait (non
  requise par la spec). **TRANCHÉ rév. 2** : le cadre de T2 mesure 359, 360, 899 et 900 px (les deux bornes de D-UI-4, de part et d'autre) ; un `@media`
  décalé rougit ; T2 passe de 37 à 39 assertions. **Rév. 3** : une mesure à 950 px s'ajoute (3 colonnes attendues : elle tue le mutant « 900 → 1000 »
  même si la borne basse de la plage bougeait) ; T2 passe à 40.
- **D-16** M3 (R-VIS-8) n'est pas rejouée par la preuve visuelle (T6) : l'app ne poste plus à `api.anthropic.com` ; une mesure en vrai vol exige une
  session (hors T6). **RATIFIÉ rév. 3 comme limite nommée** : M3 non rejouée en vrai vol (R-UI-[n+1], spec § 12 par T6 ; « Ce qui n'est PAS prouvé » de
  CLAUDE.md le dit).
- **D-17** quatre fichiers de vérification du scratchpad de l'auteur de T1 (`verif-carnet.mjs`, `verif-icones.mjs`, `verif-components.mjs`,
  `verif-app.mjs`) restent dans le scratchpad : inoffensifs, hors du dossier du plan.

---

## Pré-vol (rév. 1 → rév. 2)

Trois lentilles (ordre, fantômes, faux-vert) ont relu la rév. 1 ; 32 constats (dont des doublons entre lentilles), chacun vérifié dans le code à `f3672be`
avant d'être appliqué PAR ÉDITION CIBLÉE ou refusé. Une ligne par constat, dans l'ordre du JSON reçu ; les doublons renvoient à la première ligne.

- **P-1** (Critical, ordre — T2 casse le filet « onze états vides » de T1) — **APPLIQUÉ** : le bloc « sources » de T1 compare par module l'ENSEMBLE trié des
  noms (`new Set(noms)`) et exige qu'aucun nom ne soit hors de `NOMS` (`horsJeu`) ; `SITES['library.js'] = ['assiette', 'livres']` absorbe les deux
  `emptyState('assiette', …)` de T2 (vérifié : `recettesTab`, `aImporterTab` ; T4 garde un seul site dans `book.js`, T3/T5 n'en ajoutent pas) ; mutant 10
  reformulé. Compte de T1 inchangé (un seul `eq`).
- **P-2** (Critical, ordre — T5 change « Recette disponible » que T2 épingle trois fois) — **APPLIQUÉ** : le bloc « dureeTotale, ligneSource, badges » de T2 lit le
  texte de disponibilité par `K.availabilityBadge(fiche('rc_f')).textContent` (`dispo`) : le test tient la carte, le libellé est à T5 (vérifié :
  `components.js:33-39` rend `label('availability', 'available')` = « Recette disponible » à `f3672be`).
- **P-3** (Critical, ordre — T3 cherche une section « Original » que `rc_t3` ne produit pas) — **APPLIQUÉ** : `PAGE_T3` dans `pagesById` de `ctxPour`, `rc_t3`
  monté avec `source_page_ids: [PAGE_T3.id]` (le motif de `tests/photo-plat.js:336-337`) ; vérifié : `recipe.js:178-187` ne rend « Original » que si
  `pagesOriginal.length`. Les autres fiches gardent `source_page_ids: []`.
- **P-4** (Critical, ordre — T4 mesure la feuille dans une racine fantôme) — **APPLIQUÉ** : le bloc « styles.css servie » est réécrit sur des `<iframe>` about:blank par
  largeur (1100, 800, 375 ; la technique de T2), feuille chargée dans le cadre, mesures par `w.getComputedStyle` ; vérifié : `tests/index.html` ne lie que
  `tests.css`, `frame-src 'self' blob:` admet le cadre, `--serif` est Georgia. Attendus inchangés ; `mediaFactice(largeur >= 900)` gardé pour le JS.
- **P-5** (Important, ordre — `tests/lecture-web.js:792` et numéros 1056/1068) — **APPLIQUÉ** : Step 0 relevé réel (13 lignes dans `lecture-web.js`, 5 dans
  `recipe.js`), Step 2.4 : l. 792 → `.classList.contains('link')` + message, 1055 et 1071 corrigés, 682 et 672 ajoutés ; Step 3 et Files : 792 au rouge attendu.
  Vérifié : `import-web.js:450` `ouvrir('btn primary')` dans `[data-role="action"]`.
- **P-6** (Important, ordre — personne ne pose `.grid.livres`) — **APPLIQUÉ** : T2 Step 6, `booksTab` l. 58 `class: 'grid livres'` ; assertion
  `!!livres.querySelector('.grid.livres')` + `querySelectorAll('.grid').length === 1` dans le bloc Bibliothèque ; Files, Step 0, mutant ajoutés ; T1 Produces le dit.
  Vérifié : `tests/ajouter.js:3758` lit `.grid` (reste vert), aucun test n'épingle `className === 'grid'`.
- **P-7** (Important, ordre — § 4.2 fixe un sous-titre « Du web · … » / « De mon livre · … ») — **APPLIQUÉ par la voie (b), spec amendée (R-UI-P2)** : garder
  `provenanceText` et amender § 4.2 par T6 ; T3 épingle le sous-titre (« Source personnelle », « site.test ») ; la galerie de T6 perd le préfixe. Raison vérifiée :
  `tests/creer-ia.js:1397-1398` épingle « Mon livre — A. B. · page 58 » en `header p` (et 1338, 1375, 1400) — la voie (a) rougirait quatre épingles que § 7 ne
  nomme pas ; C10 / F22 (`tests/ajouter.js:1142`) veulent le livre ET l'hôte sur une fiche rangée. **RATIFIÉ rév. 3** : le sous-titre de la fiche reste
  `provenanceText` (`tests/creer-ia.js` l'épingle) ; l'amendement de spec R-UI-P2 est consigné au § 12 par T6 (Step 8.4).
- **P-8** (Important, ordre — D-1 `search.js:162`, contradiction brief / plan) — **APPLIQUÉ** : ruling R-UI-P1 dans les Global Constraints (seule édition de
  `search.js`, `'loupe'` porté dans la version UI-2 à la fusion), D-1 marqué tranché, Step 12 de T1 et T6 Step 8.4 le portent.
- **P-9** (Minor, ordre — `header.stack h1 + p.muted` touche deux en-têtes maison) — **APPLIQUÉ** : dit VOULU dans T1 Produces et Step 12 (`progress.md`) ;
  vérifié : `import-web.js:391-396` et `import-cible.js:666-670` ont la forme `header.stack > div > h1 + p.muted`.
- **P-10** (Minor, ordre — le filet lit les commentaires, compare une liste ordonnée) — **APPLIQUÉ par P-1** (ensemble + appartenance à `NOMS`) ; la lecture des
  commentaires reste : un `emptyState('x'` en commentaire tomberait dans `horsJeu` et rougirait — voulu, aucun commentaire de ce genre à `f3672be`.
- **P-11** (Critical, fantômes — même constat que P-1) — **APPLIQUÉ** (P-1).
- **P-12** (Critical, fantômes — même constat que P-2) — **APPLIQUÉ** (P-2).
- **P-13** (Critical, fantômes — même constat que P-4) — **APPLIQUÉ** (P-4).
- **P-14** (Important, fantômes — « blob text/html sous un mime image » contredit `typeAffichage`) — **APPLIQUÉ** : le cas devient « text/html (mime et blob) »
  (`ligneFichier(H('a'), new Blob(…, { type: 'text/html' }))`, mime = type du blob) ; Review Focus n° 2 réécrit ; `mime.js` jamais touché (F-9). Vérifié :
  `mime.js:28-31` rend `safeDisplayType(blob.type) ?? safeDisplayType(fileRow.mime)`.
- **P-15** (Important, fantômes — relevé « Ouvrir le lien » faux et incomplet) — **APPLIQUÉ** (P-5) : le Step 0 de T3 porte le relevé réel ligne par ligne.
- **P-16** (Minor, fantômes — grep « Mes livres » omet `library.js:1, 13, 19`) — **APPLIQUÉ** : les onze lignes réelles dans T1 Step 0.3, la l. 13 dite laissée à T2.
- **P-17** (Minor, fantômes — `icones.js` dans `MODULES_NEUFS` = +3 assertions) — **APPLIQUÉ** : rouge `❌ 5938/5982`, vert `✅ 5989/5989`, épingle 5988, témoin et
  Step 12 ; épingle finale 6133 / bilan 6134 (recomptée avec T2 39 et T3 30 : Global Constraints, A-16, D-14 ; rév. 3 : 6134 / 6135 avec T2 40). Vérifié :
  `tests/ajouter.js:3790-3796`, trois `ok()`.
- **P-18** (Minor, fantômes — numéros de `library.js` décalés de deux) — **APPLIQUÉ** : Files et Step 0 de T2 (38-42, 46-50, 41/49, 52-87, 57, 58, 80-82).
- **P-19** (Minor, fantômes — `'{n} repérée(s) dans l’index'` absente d'`en.js` ; `creer-ia.js:1237`) — **APPLIQUÉ** : T5 Files et Step 4 ne parlent que de
  `'{n} repérée(s)'` (en.js:23) ; Step 7 cite 1227 (définition) et 1242 (appel). Vérifié par grep.
- **P-20** (Important, faux-vert — même constat que P-1) — **APPLIQUÉ** (P-1).
- **P-21** (Important, faux-vert — même constat que P-14) — **APPLIQUÉ** (P-14).
- **P-22** (Important, faux-vert — même constat que P-5) — **APPLIQUÉ** (P-5).
- **P-23** (Important, faux-vert — T3 ne mesure jamais la feuille de `.fiche-tete`) — **APPLIQUÉ** : trois mesures en cadres (1100 avec photo : zones, photo à
  droite, img pleine colonne 4:3 `cover`, segmented `display: none`, deux colonnes de corps ; 375 : photo entre l'état et les gestes, Préparation `none`, une
  colonne ; 1100 sans photo : `:has(> .fiche-photo:empty)` → une colonne) ; trois mutants CSS au Step 10. Vérifié : `monterPhotoPlat` rend un `div` vide sans
  photo (`:empty` tient). T3 passe de 26 à 30 (avec P-7). **Rév. 4 (point 1)** : `:empty` ne suffisait pas — la zone fantôme restait : l'enfant vide
  `grid-area: photo` sans zone nommée prenait une piste implicite à droite (mesure Chromium « 1068px 0px 0px », `photoADroite` vrai) ; la règle `:has()` déclare
  désormais `"etat" "gestes" "photo"` (troisième rangée de 0 px, gap de 1 rem sous les gestes accepté) ; quatre mutants CSS au Step 10.
- **P-24** (Important, faux-vert — même constat que P-4) — **APPLIQUÉ** (P-4).
- **P-25** (Important, faux-vert — même constat que P-2) — **APPLIQUÉ** (P-2).
- **P-26** (Important, faux-vert — mutant 8 `nom in TRACES` survit) — **APPLIQUÉ** : `leve` du bloc « icônes » exige `e instanceof TypeError &&
  /icône inconnue/.test(e.message)` ; mutant 8 et son attendu réécrits (« is not iterable » ne porte pas le message).
- **P-27** (Minor, faux-vert — bornes 360 / 900 non mesurées) — **APPLIQUÉ** : cadres à 359, 360, 899, 900 ; D-15 tranché ; mutants `@media` réécrits ; T2 = 39
  (rév. 3 : + 950, T2 = 40).
- **P-28** (Minor, faux-vert — bloc « filets » de T4 affirme du texte source) — **APPLIQUÉ** : les regex `sectionPlain(t('…'))`, `recipeCard`, `window.matchMedia(`
  retirées (tenues par comportement dans « fiche livre » et « liste compacte ») ; reste le seul test de source admis par exception, la flèche
  `(q) => window.matchMedia(q)` et l'absence d'un appel nu (défaut inatteignable depuis la suite) ; compte du bloc inchangé (5) ; mutant « sectionPlain » sans « filets ».
- **P-29** (Minor, faux-vert — fixtures `available` sans version) — **APPLIQUÉ** : `recette4` pose `current_version_id: 'rv_' + id` (null pour une référence),
  `version4` / `versions4(rs)` écrivent une version par fiche non référence dans les quatre `db.mutate` du bloc T4.
- **P-30** (Minor, faux-vert — tri sur des `updated_at` égaux) — **APPLIQUÉ** : `rx` à `2026-10-24`, plus récente que `ry` (DATE).
- **P-31** (Minor, faux-vert — § 5 « Steps » contre `en.js` « Method ») — **APPLIQUÉ** : ruling R-UI-P3 (Global Constraints), T6 amende § 5 et porte le ruling en
  § 12 ; D-6 marqué tranché.
- **P-32** (Minor, faux-vert — liste Step 0 de T3 non exhaustive) — **APPLIQUÉ** (P-5, P-15).

Aucun constat refusé. Hors constats, par conséquence : titre et en-tête en rév. 2 ; Review Focus n° 2 ; T2 Step 8 (bornes 360 / 900 dans l'aide au rouge) ;
T6 Files, Step 6.6 (galerie sans préfixe), Step 8.4 (R-UI-P1 à P3 avant R-UI-1, amendements § 4.2 et § 5), CLAUDE.md et message du commit 2 ; A-16, D-1, D-6,
D-14, D-15. Rien n'a été écrit dans `/Users/neeganmac/projects/mistu-carnet`.

### Rulings du chef d'orchestre (rév. 2 → rév. 3, 26 octobre 2026)

Dix-neuf points, appliqués PAR ÉDITION CIBLÉE sur une copie `cp` de la rév. 2 (jamais une réécriture du fichier) ; chaque nom touché relu dans le code à
`f3672be` (lecture seule : `styles.css:270`, `tests/photo-plat.js:1314-1332`, `src/ui/recipe.js:211-214` — `setServings` → `drawBody()` → `body.replaceChildren()`,
le Critical est confirmé —, `src/app.js:52, 59-60`, `tests/theme.js:45, 48`, `src/ui/home.js:11`, `src/app.js:96`, `src/ui/book.js:160-195`,
`src/ui/photo-plat.js:87`, `src/ui/search.js:18, 162`) et sur la branche UI-2 (`apercus-web`, tête `c8b07f5` : `.plat-vignette.grande` et `figure.apercu`
n'y sont pas encore posées — le texte du chef fait foi). Les blocs JS modifiés (T2 Step 1, T3 Step 1) passent `node --check` sur une copie dans le scratchpad
du plan ; invisibles à 0 (Python `-I`) ; aucune clé ni valeur sensible. Une ligne par point :

- **(1) CRITICAL T3, `onglets` capturé avant un redessin** — **APPLIQUÉ** : `const onglets = () => q(corpsE, '[data-role="onglets-corps"]')` et
  `const actif = () => textes(onglets(), 'button.active')` ; `onglets()` partout (l. `< 760 px` : `.hidden` et `.getAttribute('role')` ; la tape :
  `.querySelectorAll('button')` ; les deux `change` : `.hidden`) ; compte d'assertions de T3 inchangé (30) ; mutant « `appliquerCorps` ne touche pas
  `onglets.hidden` au `change` » ajouté au Step 10 (tué par l'assertion « change → large » une fois l'accesseur posé ; survivant à la rév. 2). Relecture de
  TOUT le bloc T3 et des blocs T2, T4, T5 pour toute autre capture avant un redessin : T3 — `detailsE` (hors de `body`, jamais remplacé : `setServings`
  n'écrit que `#servings-val`), `corpsE` (= `body`, persistant), `ing()` / `prep()` (déjà des accesseurs), `ingAvant` / `prepAvant` / `corpsAvant` (captures
  VOULUES pour une comparaison d'identité), `ongletsL` / `details` / `tete` / `corps` du bloc large (aucun redessin entre la capture et la lecture) ; T2 —
  `n`, `large`, `champ` (le `<input>` du filtre n'est pas remplacé par `redessiner`), `pied` statiques, `titres()`, `puce()`, `pressees()`, `bouton()`,
  `cartes()`, `voirPlus()`, `srcs()` accesseurs ; T4 — `liste` (la `section`, dont `drawList` ne remplace que le `div[data-role=liste-recettes]`), `champ`
  et les boutons de filtre hors de ce `div`, `lignes4()` / `titres4()` / `voirTout()` / `bouton4()` accesseurs ; T5 — `root`, `favoris`, `cuissons`, `cellules`
  sans redessin ; `fig1`, `croix`, `legende`, `champ` lus AVANT le seul redessin (`croix.click()`), puis `apres` relu — aucune autre capture périmée.
- **(2) R-UI1-1, règle `.plat-vignette.grande`** — **APPLIQUÉ** : T2 Step 5 écrit `.plat-vignette.grande { width: 100%; height: auto; aspect-ratio: 4 / 3;
  object-fit: cover; border-radius: 12px; display: block }` au caractère près (à la place de `border-radius: var(--radius); border: 0;`), puis
  `.plat-vignette.petite { width: 48px; height: 48px; }` ; l'épingle `tests/photo-plat.js:1323` à trois sélecteurs (inchangée, commentaire complété :
  UI-2 en pose deux) ; ruling R-UI1-1 dans les Global Constraints, dans le § 12 posé par T6 et dans CLAUDE.md ; la Clôture dit la résolution par union
  (`.grande` identique écrite une fois, `figure.apercu` gardée, trois sélecteurs dans l'ordre, `tests/photo-plat.js:1323` version UI-1).
- **(3) R-UI1-2, sources du test I-F3** — **APPLIQUÉ (vérification, aucune édition à retirer)** : `grep` du plan sur `1327`, `1330`, `1331`, `srcPP`, `srcK`,
  `srcMeals` ne rend que l'invariant I-UI-2 ; aucune tâche n'édite `tests/photo-plat.js:1327-1331` (T2 : l. 1322-1323 ; T4 : l. 1296-1309) ; dit dans les
  Global Constraints (R-UI1-2), au Step 2 de T2 et dans la Clôture (version UI-2 à la fusion).
- **(4) D-1 ratifié** — **APPLIQUÉ** : R-UI-P1 marqué ratifié, la ligne nommée pour la fusion (`results.append(emptyState('🔍', t('Aucune recette admissible.')
  + …`, `search.js:162` à `f3672be`, relue) ; Clôture et Assemblage (D-1) le disent.
- **(5) D-2 ratifié** — **APPLIQUÉ** : la roue traitée = panneau latéral (`app.js:52`, relu) ; pilule et bouton de la barre haute (`app.js:59-60`, relus)
  restent en texte — T1 Files, Step 7.1, Step 12 ; Assemblage (D-2).
- **(6) D-3 ratifié** — **APPLIQUÉ** : `tests/theme.js` l. 45 et 48 (relues : « 2 px tomate », « 2px tomate ») renommées aussi — T1 Files ; Assemblage (D-3).
- **(7) D-6 ratifié** — **APPLIQUÉ** : 'Préparation' garde 'Method' (R-UI-P3 marqué ratifié) ; § 5 amendé à la clôture par T6 (Step 8.4) ; Assemblage (D-6).
- **(8) D-8** — **APPLIQUÉ** : « Reprendre la séance » et les quatre autres chaînes hors table § 5 ont leur entrée `en.js` (T4 : 'Resume the session',
  'Available' ; T5 : '{n} to import', 'Page {n} · p. {p}' ; T3 : '1 portion' relue) — déjà posées par les tâches — et T6 Step 8.4 les liste dans la
  sous-section « Specs amendées par ce lot » de la spec § 12 (puce neuve, texte donné) ; T6 Files et le message du commit 2 le disent ; Assemblage (D-8).
- **(9) D-9 ratifié** — **APPLIQUÉ** : `renderHome` gagne `{ repo }` optionnel sans changer `app.js` (`app.js:96` relu : `route('/', renderHome)`) — T5
  Produces ; Assemblage (D-9).
- **(10) D-10 ratifié** — **APPLIQUÉ** : T4 porte le compteur et le filtre de `book.js` ; T5 ne les refait pas — le conditionnel de T5 est retiré (Files,
  Step 0 (b) → constat pour la revue de T4 / NEEDS_CONTEXT, Step 3, Step 7, Step 12, Step 13 : `src/ui/book.js` n'est plus un fichier de T5) ; Assemblage (D-10).
- **(11) D-14 / A-16 / comptes** — **APPLIQUÉ** : Global Constraints (« attendus de RAISONNEMENT … chaque Step « vert » épingle la valeur MESURÉE et consigne
  l'écart », D-14 et A-16 ratifiés), A-16 et D-14 marqués ; T2 Steps 8 et 9 le rappellent ; les comptes réécrits avec T2 = 40 (point 14) : épingle attendue
  6134, bilan 6135/6135 (Global Constraints, A-16, D-14, P-17, P-27).
- **(12) Crochets de T6** — **APPLIQUÉ** : A-15 marqué ratifié ; T6 Step 8 nomme chaque crochet (`[sha]`, `[N/N]`, `[N−1]`, `[min]`, `[n]`, `[K]`, `[date]`,
  `[heure]`, `[n/n]`, `[R-UI-1 à R-UI-n …]`) et sa source, et dit qu'aucun crochet ne reste commis (grep au Step 9).
- **(13) D-4 et D-5 ratifiés** — **APPLIQUÉ** : marqués dans l'Assemblage avec le lieu du code (`ligneSource`, `aImporterTab` de T2) ; aucun changement de
  code (le plan rév. 2 faisait déjà ainsi).
- **(14) D-15, mesure à 950 px** — **APPLIQUÉ** : la boucle des cadres de T2 passe à `[[359, 1], [360, 2], [899, 2], [900, 3], [950, 3]]` (3 colonnes
  attendues à 950 : tue le mutant `@media 900 → 1000` quelle que soit la borne basse) ; libellé du `run`, assertion `fautes` (cinq largeurs), compte du bloc
  39 → 40 (cadres 6), Steps 8 et 9 (+ 40), mutants `@media` (900 ET 950 rougissent) ; D-15, P-27, P-17, A-16, D-14 et les Global Constraints recomptés.
- **(15) D-16 ratifié comme limite nommée** — **APPLIQUÉ** : marqué dans l'Assemblage (M3 non rejouée en vrai vol ; R-UI-[n+1] de T6 et « Ce qui n'est PAS
  prouvé » de CLAUDE.md le portaient déjà).
- **(16) P-7 ratifié** — **APPLIQUÉ** : R-UI-P2 et P-7 marqués ratifiés ; T6 Step 8.4 consigne l'amendement § 4.2 au § 12 (déjà prévu).
- **(17) Image réelle dans la mesure de T3** — **APPLIQUÉ** : `mesureFiche` force le chargement de l'img (`img.loading = 'eager'` puis `await img.decode()`)
  AVANT toute mesure, affirme `chargee` (`naturalWidth > 0`) à 1100 et 375 (`null` sans photo), et dit le repli (la figure parente si la mesure restait
  instable) ; l'image RÉELLE passe de 640 × 480 à **640 × 400** (16:10) pour que le mutant « `aspect-ratio` retirée » reste tué par une image chargée (un
  JPEG 4:3 chargé l'aurait masqué : le 4:3 mesuré vient de la feuille, pas de l'image) ; un quatrième mutant CSS de test (`eager` retiré → `chargee` faux)
  au Step 10 ; compte de T3 inchangé (30 : `chargee` entre dans les trois `eq` existants). La technique de T2 (cadre hors écran, ratio de la BOÎTE CSS)
  n'est pas visée par le ruling et n'est pas changée.
- **(18) Fichiers intermédiaires** — **APPLIQUÉ (rien à faire)** : `plan-rev1-T*.md`, `plan-rev1-entete.md`, `plan-rev1-cloture.md`, `plan-rev1.md`,
  `plan-rev2.md` laissés tels quels ; `plan-rev3.md` est le seul livrable.
- **(19) Versions** — **APPLIQUÉ** : Global Constraints (Versions : `APP_VERSION 0.17.0` et `cuisine-os-v0.17.0-1` à T1, +1 à chaque commit — tâche ou
  ronde — qui touche `src/`, `styles.css`, `index.html`, le manifeste ou `sw.js` ; renvoi à la Clôture) ; la Clôture, Fusion, dit le commit de version si
  UI-1 fusionnait AVANT UI-2 (I-UI-7 : le premier lot FUSIONNÉ porte 0.16.0, le second 0.17.0 — UI-1 passe à 0.16.0 par le texte de `schema.js:6`, `sw.js`
  et les 13 assertions + 1 commentaire des 8 suites, relevé des pins avec `0.17.0` vide puis `0.16.0` quinze lignes ; UI-2 passe à 0.17.0 à sa fusion).

Aucun point refusé. Non visés par la rév. 3, laissés tels quels : D-7 (repères sur `version.servings`), D-11 (composition de T4), D-12 (légende de la
vignette), D-13 (`tests/table-matieres.js:1672`), D-17 (fichiers de vérification du scratchpad). Hors points, par conséquence : titre et en-tête en rév. 3 ;
T6 Files (R-UI1-1, R-UI1-2, trois amendements) ; CLAUDE.md (rulings R-UI1-1, R-UI1-2) et message du commit 2 de T6. Rien n'a été écrit dans
`/Users/neeganmac/projects/mistu-carnet` ni dans `/Users/neeganmac/projects/mistu-apercus`.

### Rulings du chef d'orchestre (rév. 3 → rév. 4, 26 octobre 2026)

Trois points, appliqués PAR ÉDITION CIBLÉE sur une copie `cp` de la rév. 3 (`plan-rev4.md`, le seul livrable ; jamais une réécriture du fichier) ; chaque nom
touché relu dans le code à `f3672be` (lecture seule : `src/ui/photo-plat.js:286, 304-307, 353` — `entete` est un `div[data-role=emplacement-photo-plat]` vide sans
photo, `:empty` tient —, `:87` — l'`img` est `loading: 'lazy'` —, `styles.css:278-279` — `.two-col` et son `@media` —, `tests/theme.js:34-37` — T-2 retire les
chaînes entre guillemets des valeurs : `"etat" "gestes" "photo"` ne passent pas pour des couleurs nommées —, `tests/tests.js:250`, `src/ui/recipe.js:211`). Le bloc
JS modifié (T3 Step 1) passe `node --check` sur une copie dans le scratchpad du plan ; invisibles à 0 (Python `-I`) ; aucune clé ni valeur sensible. Une ligne par point :

- **(1) CRITICAL T3 Step 6, `.fiche-tete:has(> .fiche-photo:empty)`** — **APPLIQUÉ, variante (a)** : la règle déclare `grid-template-areas: "etat" "gestes" "photo"`
  (une troisième rangée de 0 px : l'enfant vide `grid-area: photo` y tombe ; le gap de 1 rem qui en résulte sous les gestes est ACCEPTÉ et dit en commentaire) —
  à la rév. 3, `"etat" "gestes"` seules laissaient à l'enfant vide une `grid-area: photo` sans zone nommée → piste IMPLICITE à droite (mesure Chromium :
  « 1068px 0px 0px », `photoADroite` vrai), contre l'assertion `vide1100` (`[1, null, null, false]`, inchangée ; son libellé dit la troisième rangée). Reporté :
  commentaire du Step 6, Step 10 (le mutant « `:has` retirée → 2 pistes » reste tué ; mutant neuf « zone `photo` retirée de la règle `:has` → 3 pistes
  implicites », tué par `vide1100.pistesTete` ; « quatre mutants de `styles.css` »), P-23 du pré-vol (« `:empty` ne suffisait pas : la zone fantôme restait »).
  **REFUSÉ** (par le chef, dit en commentaire du Step 6) : `grid-area: etat` sur l'enfant vide — un élément vide étiré sur la cellule de l'état se peint au-dessus
  et intercepte les tapes (« Commencer à cuisiner » deviendrait injoignable) ; `display: none` reste interdit (T-1).
- **(2) Point 17 résiduel, `mesureFiche` (T3 Step 1)** — **APPLIQUÉ** : `if (img) { img.loading = 'eager'; await Promise.race([img.decode().catch(() => {}),
  new Promise((r) => setTimeout(r, 3000))]); }` — sans `eager`, une img lazy dans un cadre hors écran ne se charge jamais et `await img.decode()` PEND : la suite se
  figerait au lieu de rougir ; `chargee` (naturalWidth > 0) est lu ensuite et tranche. L'attendu du mutant du test (dit « quatrième » à la rév. 3) est réécrit :
  « `chargee` faux à 1100 et 375, bilan ROUGE à la fin de la suite (≈ 3 s par mesure avec image), jamais une suite figée ». Compte de T3 inchangé (30).
- **(3) Point 11 résiduel, T5 Step 10** — **APPLIQUÉ** : `eq(results.length, <épingle de T4 + 28>, …)` → `eq(results.length, <obtenu − 1>, …)`, la valeur MESURÉE
  (« obtenu » lu dans le bilan du Step 9, règle N−1), la forme des autres tâches ; l'attendu de raisonnement (épingle de T4 + 28) ne reste qu'en commentaire (D-14).

Aucun point refusé. Hors points, par conséquence : titre et en-tête en rév. 4 ; le libellé de l'assertion `vide1100` (point 1). Rien n'a été écrit dans
`/Users/neeganmac/projects/mistu-carnet` ni dans `/Users/neeganmac/projects/mistu-apercus`.

### Rulings du chef d'orchestre (rév. 4 → rév. 5, 26 octobre 2026)

- **(1) T5 Steps 9 et 10 (verdict de la rév. 4, point 3)** — **APPLIQUÉ** : l'idiome de l'épingle est remis d'aplomb : la ligne rouge de l'épingle affiche `obtenu :` = `results.length` évalué AVANT que l'assertion du total se pousse (`tests/tests.js:37, :250`), donc `obtenu` = épingle de T4 + 28 ; le bilan attendu s'écrit `❌ (N−1)/N` avec N = épingle de T4 + 29 ; le Step 10 épingle `<N − 1>` = la valeur `obtenu` reprise telle quelle (la forme de T1 Step 9 et T4 Step 7).
- **(2) T3 Step 10 et pré-vol rév. 4 (point 2, mineur)** — **APPLIQUÉ** : l'attendu du mutant du test dit « bilan ROUGE à la fin de la suite, 3 s par mesure avec image, deux mesures » au lieu de « en moins de 4 s ».

Aucun autre changement. Titre en rév. 5. Rien n'a été écrit dans le worktree avant le commit du plan.
