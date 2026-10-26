# Lot UI-2 « Aperçus des résultats web » (outil `apercu-web`, `0007`, vignettes et ligne d'état de l'onglet Web) — plan d'implémentation (rév. 2, 25 octobre 2026 ; rév. 1 du 23 octobre revue au pré-vol : 17 constats, section « Pré-vol » en fin de plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dans l'onglet Web, chaque résultat vient avec la photo de la page quand le site en publie une : après le « trouvé », l'app demande en UN
appel (le second de la recherche, annoncé avant la tape) les aperçus des cinq adresses à un sixième outil serveur sans modèle, `apercu-web`, qui
télécharge chaque page, en tire l'adresse d'image par LA règle de F, télécharge l'image (1 Mio au plus) et rend une entrée par adresse ; côté app,
les figures sont posées en UNE fois en tête des cartes, depuis des Blob locaux passés au mur de F sans ré-encodage, jamais par une adresse
`https` ; une ligne d'état dit « Photos en cours de récupération… », puis disparaît ou devient « Photos indisponibles… » / « Quota du jour
atteint… » ; une adresse refusée, une page sans image, un budget épuisé ou une `0007` absente ne font jamais échouer la recherche.

**Architecture:** côté serveur, `supabase/functions/assistant/logique.js` gagne `OUTILS` à six, `LIMITES_APERCU`, `PARALLELISME_APERCU` et
`lireDemandeUrls` (liste blanche `{ urls }`, chaque adresse validée par `valideAdresse` AVANT la réservation) ; `index.ts` gagne le bloc `apercu-web`
de `traiter` (une réservation, un `AbortController` de 60 s relayé à `suivreRedirections`, `enParallele` à 2, dédoublonnage pour le téléchargement
seul, réponse `{ apercus }`), `telechargerImage({ max })`, et `apercuDe` / `enParallele` déclarées APRÈS `traiter` (N-1) ; `0007_apercu_web.sql`
écrite à la main (la contrainte `outil` à six valeurs) et sa preuve (11 verdicts) ; README étape 13 ; RESULTATS ; générateur « la 0008 à venir ».
Côté app, un module de domaine neuf `src/domain/apercu-web.js` (`lireApercusWeb` : un POST par la passerelle, le 200 lu comme une donnée hostile,
une entrée par adresse demandée, `preparerPhotoDistante(…, { reencoder: false })`), l'option `reencoder` de `src/core/image.js`, et `src/ui/search.js`
(la `Map(href → { blob, type } | { raison })` du module à côté de `memoire`, le vol d'aperçus unique, `figureApercu`, `ligneEtatApercus`,
`deps.apercus`) ; `en.js`, `sw.js` (`SHELL` + `./src/domain/apercu-web.js`), `APP_VERSION 0.16.0`, pins et épingle ; puis les documents (tâche 3)
et la Clôture (redéploiement, sondes, fusion). Aucun magasin neuf, `DB_VERSION` 4 ; aucune règle CSS (la figure et la ligne d'état portent des
classes neuves sans thème : UI-1 les habille).

**Tech Stack:** PWA sans build (modules ES), IndexedDB (`db.mutate` porte unique ; ce lot n'écrit RIEN dans `files`), fonction Supabase Edge
`assistant` (Deno ; `logique.js` et `lecture-web.js` purs, éprouvés sous Node ; `index.ts` sous le harnais à faux `Deno` des lots 4, B et F),
suite navigateur `tests/index.html` (lanceur strict `.superpowers/sdd/2026-10-23-apercus-web/suite.cjs`, déjà présent), `node --test tools/*.test.mjs`,
`node tools/generer-migrations.mjs --check`, `tsc` 5.6.3 `--strict` (en cache npx depuis le lot B), SQL collé à la main par Neegan (`0007`).

**Spec:** `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (**rév. 2.1**, commise `7633675` ; § 13 tranché par le « Go » de Neegan
du 23 octobre au soir, commis `f3672be` : les sept défauts sont confirmés, dont les aperçus AUTOMATIQUES, D-UI-13). **Elle fait foi**, et seul son
volet UI-2 est planifié ici : D-UI-12 à D-UI-14, I-UI-2, I-UI-5 à I-UI-7 (I-UI-1, I-UI-3 et I-UI-4 valent aussi, par leur lettre), § 4.6, § 5 (les
quatre lignes UI-2 et la chaîne retirée), § 6 en entier, § 7 (épingles UI-2, tests neufs `tests/apercu-web.js`, mutants UI-2), § 9 (tâches S1 à S3),
§ 10 (UI-2), § 11 (UI-2), § 12 (B-I-1, B-I-2, B-I-12, B-I-13, B-M-6, B-M-10, B-M-11, F-10, F-19, S-1 à S-17, K-1, K-4, K-5, K-7, H-5, H-7, H-18), § 13
point 2 (tranché). Le volet UI-1 « Carnet » (T1 à T6 : thème, grille, fiches, icônes) est un AUTRE lot, sur la branche `experience-carnet` : ce plan
ne le planifie pas, ne touche ni `styles.css` ni aucun écran hors `src/ui/search.js`. Plan à commettre sous
`docs/superpowers/plans/2026-10-23-apercus-web.md` (par le contrôleur, au Départ) ; registre `.superpowers/sdd/2026-10-23-apercus-web/` (hors git :
`progress.md`, `suite.cjs`, un brief et un rapport par tâche ; le copier dans `~/projects/mistu/.superpowers/sdd/` AVANT tout `git worktree remove`).

**Références relues pour écrire ce plan (lecture seule).** Le code du worktree à `f3672be` (= `main` `05c751f` + les trois commits de spec
`0346a3b`, `20aa2fc`, `7633675` et le « Go » `f3672be` ; ni `main` ni `origin/main` ne portent ces trois commits : la branche `experience-carnet`
les porte aussi) : `supabase/functions/assistant/{logique.js,index.ts,lecture-web.js}`, `tools/assistant-{logique,index}.test.mjs`,
`tools/generer-migrations.test.mjs` (N-1, `ordreDuFlux`), `tools/faux/supabase.mjs`, `supabase/migrations/0006_lecture_web.sql`,
`supabase/proofs/{0006_lecture_web.sql,RESULTATS-mitsu.md}`, `supabase/README.md` (étapes 10 à 12), `src/ui/search.js` (lot web, R-WEB-1 à R-WEB-10,
lot B « Garder et lire », lot 4 `sessionAssistant`), `src/core/image.js` (mur distant de F, l. 97-110), `src/domain/{passerelle,photo-web,base64}.js`,
`src/ui/components.js` (`remplacerEnRevoquant`, `urlsDesVignettes`), `src/core/{blob-urls,lien,dom}.js`, `tests/{tests,recherche-web,photo-plat,ajouter}.js`,
`sw.js`, `src/model/schema.js`, `src/i18n/en.js` ; les plans et clôtures des lots 4, B et F (`docs/superpowers/plans/2026-10-19-plats-en-images.md`
est le modèle de forme de celui-ci). **Les numéros de ligne cités valent à `f3672be`** ; chaque Step 0 relit les noms ET les lignes sur la tête
réelle au moment de la construction (une tâche 1 fusionnée avant la tâche 2 ne touche ni `src/` ni `tests/*.js` : les lignes de la tâche 2 tiennent) ;
une dérive de numéro n'est pas un constat, un NOM absent en est un (R-C-7). Les vingt contrôles du Step 0 de la tâche 1 et le relevé des pins du
Step 0 de la tâche 2 ont été REJOUÉS sur `f3672be` le 23 octobre : tous verts, 15 lignes de pins (P-UI2-15).

## Global Constraints

- **Préconditions.** (1) `main` = `05c751f` (chaîne A → F en ligne, `0.15.0`), `0005` et `0006` collées et prouvées, fonction `assistant` en
  version 4 (`lecture-web` + `image-web`, code `0c7cbbd`) : relu dans `STATE.md` et `supabase/proofs/RESULTATS-mitsu.md`. (2) La branche
  **`apercus-web`** existe sur `f3672be` dans le worktree **`/Users/neeganmac/projects/mistu-apercus`**, servie par
  `python3 -m http.server 8095 --bind 127.0.0.1` (PID dans `scratchpad/kit-ui/serveur-8095.pid` de la session du contrôleur ; relancer la même
  commande depuis le worktree si `curl -sI http://127.0.0.1:8095/tests/ | head -1` ne répond pas `200`). (3) Le lanceur
  `.superpowers/sdd/2026-10-23-apercus-web/suite.cjs` est là (copié de celui du lot F). Si l'un manque, la tâche 1 s'arrête au Step 0 et le remonte
  (NEEDS_CONTEXT).
- **Où.** Suite : `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095` (il ouvre `http://127.0.0.1:8095/tests/` dans un Chromium sans tête
  dédié, jamais le navigateur MCP partagé). Node : `node --test tools/*.test.mjs` (`--test-timeout=10000` admis). Générateur :
  `node tools/generer-migrations.mjs --check` (attendu 0). `tsc` (tâche 1) :
  `npx -y -p typescript@5.6.3 tsc --noEmit --strict --allowJs --target es2022 --module esnext --moduleResolution bundler --skipLibCheck supabase/functions/assistant/index.ts supabase/functions/assistant/deno.d.ts`
  (attendu 0). Dans ce plan, **`<scratchpad>` désigne le dossier scratchpad de la session de l'implémenteur** (jamais un dossier du dépôt ni `/tmp`
  nu) : toute copie de mutation, toute copie servie à part y vit (P-UI2-14).
- **Départ (mesuré sur `f3672be`, serveur 8095, 23 octobre 19 h 40 HAE ; registre `progress.md`) : `✅ 5948/5948`, épingle `tests/tests.js:250`
  = 5947, Node 208/208, `--check` 0, `tsc` 0, `APP_VERSION 0.15.0`, `sw.js cuisine-os-v0.15.0-9`, `DB_VERSION 4`, seule erreur de console le 404 de
  `/favicon.ico`.** Règle : **épingle = obtenu − 1** (l'assertion du total s'ajoute elle-même au bilan). Chaque tâche rend verts la suite, Node,
  `--check` (plus `tsc` à la tâche 1) ; la valeur LUE fait foi sur celle que le plan annonce (tâche 1 : Node 227 ; tâche 2 : suite 6038/6038,
  épingle 6037 — la rév. 1 avait mesuré 6032/6032 ; la rév. 2 ajoute six assertions, constats 9, 11, 14 et 16 du pré-vol, non remesurées) ; un écart de
  plus de dix assertions est un bloc interrompu ou une assertion oubliée, à lire, jamais à épingler tel quel.
- **Versions (I-UI-7).** La tâche 1 ne touche pas `src/` : aucune version. La tâche 2, première qui touche `src/`, pose `APP_VERSION = '0.16.0'`
  (`src/model/schema.js:6`), `sw.js` `VERSION = 'cuisine-os-v0.16.0-1'` (l. 4) et `SHELL` + `'./src/domain/apercu-web.js'` (l. 17, en tête de la ligne
  des modules `./src/domain/`), **et les 15 lignes de pins en même temps** (13 assertions + le commentaire `tests/recherche-web.js:66` + la ligne
  `const v = …` de `tests/sync-l4.js:3506` : P-UI2-15). Puis **+1 à chaque commit qui touche `src/` ou `sw.js`, ronde comprise** (R-B-24) : `-2`,
  `-3`, … ; la tâche 3 (docs) ne touche ni `src/` ni `sw.js` : aucune version. `DB_VERSION` reste **4** (aucun magasin, aucun index). Si UI-1 fusionne
  avant UI-2, un commit de version renumérote ce lot en `0.17.0` (schema.js, sw.js, les 15 lignes).
- **Aucun appel réel, aucune migration appliquée, aucun déploiement, aucun secret.** Aucune tâche n'appelle Anthropic ni Supabase en réel
  (`fetch` factice injecté partout ; le harnais Node a son faux `Deno`, son faux supabase-js, son faux `fetch`) ; `0007` n'est QU'ÉCRITE (collée par
  Neegan à la Clôture) ; la fonction reste la version 4 sur `mitsu` jusqu'au redéploiement du chef d'orchestre (Clôture, APRÈS la `0007` collée et
  prouvée) ; aucune clé, aucun jeton, aucune adresse de personne dans le dépôt ni dans un message de commit ; la session de Neegan n'entre jamais
  dans une commande ni dans le chat (script d'attente du presse-papiers, fichier d'en-tête à mode 600, `curl -H @fichier`, vidé après).
- **Bases jetables seulement, aucun réseau.** Les tests de l'écran murent `globalThis.fetch` EN TÊTE du `try` dont le `finally` le remet (pose et retrait
  dans le même `try/finally` : si une fixture asynchrone — `imageTest`, un `import()` — lève, le mur ne survit pas pour `tests/theme.js`) et lisent leurs
  sources par le vrai `fetch` relevé avant ; `lireApercusWeb` reçoit toujours son `fetch` ; tout espion (`URL.revokeObjectURL`, `globalThis.atob`,
  `globalThis.createImageBitmap`, `AbortSignal.timeout`) est posé et retiré en `try/finally` ; aucun prototype natif modifié (R-F-8) ; les tests attendent un
  FAIT (DOM, Map, signal levé), jamais un délai — les deux `attendre` de `tests/apercu-web.js` attendent un fait, « figure retirée » (`img.onerror`) et
  « images chargées » (`img.complete`, avant une révocation), bornés à 3 s ; côté Node,
  les minuteries sont simulées (`mock.timers`, v7). Jamais le navigateur MCP partagé. Toute mutation de test se joue sur une COPIE dans
  `<scratchpad>`, jamais en place dans le worktree ; une copie légère (`src`, `tests`, le lanceur, un lien `node_modules`), jamais `coverage/`.
- **Filet i18n (spec § 5).** Tout texte d'écran par `t('…')` littéral, apostrophe typographique U+2019, avec son entrée dans `src/i18n/en.js` ; les
  quatre textes UI-2 et la chaîne retirée sont ceux de § 5, mot pour mot, **à une différence près, la seule admise : la table de la spec (l. 343) montre
  une apostrophe DROITE (`l'assistant`, U+0027) ; le code, `en.js` et les assertions s'écrivent avec l'apostrophe U+2019 (`l’assistant`), comme la clé
  actuelle d'`en.js` et l'en-tête de § 5 le demandent** — copier la table de la spec telle quelle écrirait l'ASCII des deux côtés (tout vert, texte
  hors convention) et ne rougirait que le `CLES` de `tests/recherche-web.js` ; les trois espaces avant « : » et « ( » des quatre textes sont des
  U+0020 ordinaires (aucune insécable) ; `src/domain/apercu-web.js` ne porte aucun `t()` et ne nomme ni le fournisseur ni la base (commentaires
  compris) ; `MODULES_NEUFS` de `tests/ajouter.js` gagne `'../src/domain/apercu-web.js'`.
- **Tests de source admis** (et eux seuls) : `Anthropic|Supabase` absent de `apercu-web.js` ; « aucun `src:` / `.src =` suivi d'une adresse
  `http(s)` » dans `search.js` et `library.js` (I-F3, S-16, `tests/photo-plat.js:1331` étendu aux deux) ; `search.js` importe `'../domain/apercu-web.js'` et porte la classe
  `'plat-vignette grande'` ; `SHELL` ; les filets i18n ; côté serveur : les marqueurs d'ordre d'`index.ts` (N-1), `apercuDe` déclarée après `traiter`,
  une seule `redirect: 'manual'`, deux `await fetch(`, les constantes nommées ; les tests de TEXTE des fichiers de procédure (`0007`, sa preuve, README
  étape 13, RESULTATS, générateur) dans `tools/generer-migrations.test.mjs` — toute reformulation de ces textes par l'implémenteur garde les phrases
  que les tests citent, ordre des premières occurrences compris. Tout le reste par comportement.
- **Épingles amendées, jamais contournées (I-UI-3, spec § 7 UI-2)** : `tests/recherche-web.js:553` (texte de garde), `:1027` (`forme` : INCHANGÉE, stricte —
  P-UI2-23), `:1033` et `:1226` (assertions « aucune figure sans `deps.apercus` », ajoutées), `:1289` (`CLES`), `:1291` (clés retirées) ;
  `tests/photo-plat.js:1328, 1331` (test de source I-F3 + `search.js`, `library.js`) ; `tools/assistant-logique.test.mjs:44, 234` ; `tools/generer-migrations.test.mjs:1189-1190`
  (`0006` redevient un préfixe), `:1245` (« trois écrites à la main »), `:1264-1268` (« la 0008 à venir »), `:1270-1274` (`OUTILS` = `OUTILS_0007`) ;
  `tests/tests.js:250` (relevée à la tâche 2) ; les 15 lignes de pins. **Toute autre assertion existante qui rougit arrête la tâche (NEEDS_CONTEXT).**
- **Commits** par chemin nommé (jamais `-A` : deux agents peuvent partager l'index d'un worktree), message ASCII sans accent, trailer
  `Co-Authored-By` du modèle RÉEL de l'implémenteur (`Co-Authored-By: <modele reel> <noreply@anthropic.com>`, convention du dépôt, R-T1-3) et la
  ligne `Claude-Session: …` quand le harnais la fournit dans le brief. Jamais réécrire l'historique. Ne pas pousser.
- **Caractères invisibles** (Cc hors `\t` / `\n`, Cf, Cs, U+2028 / U+2029 ; insécables U+00A0 / U+202F dans les lignes ajoutées) : contrôle en
  Python `-I` sur chaque fichier touché, jamais `grep` (ugrep : faux zéro mesuré le 18 octobre). Piège : un appel d'outil dont le texte porte une
  barre oblique inverse suivie de `u` et de quatre chiffres hexadécimaux ÉCRIT le caractère décodé — le code de ce plan n'emploie que
  `String.fromCodePoint(0x…)` dans les tests navigateur ; la seule séquence d'échappement JS de U+2028 du plan vit dans un littéral du test de `logique.js`
  (tâche 1, Step 1, cas « invisible ») : à écrire par le fichier, jamais par un appel d'outil qui la décoderait (l'en-tête de ce plan en a
  fait les frais une fois : relire les octets).

  ```bash
  python3 -I - <fichiers touchés> <<'PY'
  import sys, unicodedata
  mauvais = 0
  for f in sys.argv[1:]:
      for i, l in enumerate(open(f, encoding='utf-8'), 1):
          for c in l:
              cat = unicodedata.category(c)
              if cat in ('Cf', 'Cs') or (cat == 'Cc' and c not in '\t\n') or ord(c) in (0x2028, 0x2029):
                  print(f'{f}:{i}: U+{ord(c):04X} {cat}'); mauvais += 1
  print('invisibles :', mauvais); sys.exit(1 if mauvais else 0)
  PY
  ```

- **Rulings de plan** (où ce plan tranche ou s'écarte de la lettre de la spec, et pourquoi ; chacun se renverse sans défaire le reste ; les deux
  auteurs des tâches 1 et 2 les ont nommés comme doutes, l'assembleur les a vérifiés sur `f3672be`) :
  - **P-UI2-1** une chaîne de plus de 2 048 unités dans `urls` est une erreur de FORME (400 `requete`, tout l'appel refusé sans réservation), pas une
    entrée `interdit` — lecture de § 6 « 1 à 5 chaînes, chacune ≤ 2 048 … une forme autre → 400 forme » ; renversable en une ligne de
    `lireDemandeUrls` et un cas de test (tâche 1, Step 1 et v1).
  - **P-UI2-2** table des raisons par entrée (la spec nomme les raisons, pas la correspondance depuis les refus de `telechargerPage` / `telechargerImage`) :
    `pas_une_page` et page de liste → `pas_de_recette` ; page `trop_lourde` (> 2 Mio) → `inaccessible` ; `pas_une_image` (type hors liste ou signature
    menteuse) → `pas_d_image` ; redirection refusée (page ou image) → `interdit` ; `pas_d_image` est réservé à une `Recipe` lisible UNIQUE sans image ni
    `og:image` (`lue.jsonld !== null && lue.jsonld.autres === 0`). Le client n'affiche aucune raison par carte (seule la ligne d'état) : le coût d'un
    désaccord est diagnostique (sonde S-A5).
  - **P-UI2-3** `apercuDe` et `enParallele` sont déclarées APRÈS `traiter` (hoisting : aucun effet à l'exécution) parce que le test d'ordre N-1 épingle
    le flux par la PREMIÈRE occurrence de `await telechargerPage(`, `lirePageHtml(` et `await telechargerImage(` dans tout le texte ; épinglé par le
    test « index.ts (UI-2) » et son mutant ; amender `ordreDuFlux` pour ne lire que le corps de `traiter` a été écarté (N-1 intact).
  - **P-UI2-4** le client borne aussi chaque image à 1 Mio (`LIMITES_APERCU_WEB.octets`, `image_trop_lourde` AVANT `atob`), miroir du `max` serveur
    (`LIMITES_APERCU.image`) : si la sonde S-A5 fait passer la borne serveur à 2 Mio (B-M-6), les DEUX constantes bougent ensemble, avec v5 et le test
    « LIMITES_APERCU_WEB et listes fermées » — une ronde AVANT la fusion, jamais une seule des deux.
  - **P-UI2-5** `tests/photo-plat.js:1331` (test de source I-F3 ; la spec dit « :1330 ») est étendu DÈS CE LOT à `src/ui/search.js` ET à `src/ui/library.js`,
    S-16 à la lettre : coût nul (vert aujourd'hui — aucun `src:` / `.src =` suivi de `https?:` dans `library.js`, 9 408 caractères relus le 25 octobre),
    aucune dette croisée entre les deux branches (UI-1, T2, n'a plus à toucher cette ligne : un conflit de moins à la fusion du second lot). Rév. 1 disait
    « `search.js` seulement » (pré-vol, constat 2).
  - **P-UI2-6** les échecs de l'appel ENTIER (`quota`, `serveur`, `reseau`, `interne`, un `annule` arrivé sans abandon) sont mémorisés par adresse,
    comme la spec le demande (S-5, K-1 : 0 appel sur la même liste) : une panne passagère prive donc la même liste de liens de ses photos jusqu'à un
    changement de liens, `reinitialiserWeb()` ou un rechargement ; voulu, à confirmer par Neegan à l'usage.
  - **P-UI2-7** une nouvelle instance de la route (retour arrière, reconstruction par `cuisineos:refresh`) rend son premier « trouvé » DÉCONNECTÉE :
    si ses adresses manquent (vol précédent abandonné par la déconnexion), rien n'est demandé avant le prochain redessin connecté (puce, « Chercher
    à nouveau ») ; les Blob déjà reçus, eux, sont réaffichés. Lecture stricte de § 4.6 (« au premier rendu d'un `trouve` par une vue connectée ») ;
    renversable par un `setTimeout(0)` après le montage si le chef d'orchestre le veut.
  - **P-UI2-8** `img.onerror` retire la figure, révoque son URL ET remplace l'entrée de la Map par `{ raison: 'image_refusee' }` — au-delà de la lettre
    de S-7, pour que la ligne d'état reste vraie et qu'aucun redessin ne recrée la figure — **seulement si l'URL était encore vivante** (`revoquerUrlDeBlob(u)`
    rend `true`) : une `error` d'une URL DÉJÀ révoquée (un `<img>` encore en chargement quand `remplacerEnRevoquant` redessine — chaque touche du filtre —
    ou quand `app.js` révoque au changement de route, AVANT de remplacer l'écran) vient de la révocation, pas du décodage, et ne jette pas un Blob valide.
    `img.isConnected` ne discriminerait pas le changement de route (les `<img>` y sont encore attachés). Le test S-7 reste tel quel (l'image indécodable
    échoue sous une URL vivante : une révocation, l'entrée remplacée). Pré-vol, constat 8.
  - **P-UI2-9** « Annuler » ne peut jamais coexister avec un vol d'aperçus dans UNE vue (`lancer()` l'abandonne avant de poser la recherche) : l'abandon
    par « Annuler » n'est éprouvé qu'à DEUX vues ; après « Annuler », la seconde vue redessinée sur le « trouvé » K1 repose aussitôt un vol — conforme à
    « une vue connectée qui rend un trouvé demande ce qui manque », à ratifier.
  - **P-UI2-10** la figure `img.plat-vignette.grande` hérite de la règle `.plat-vignette` 72 px de `styles.css` tant que UI-1 ne pose pas `.grande`
    (aucun CSS dans ce lot, par périmètre) ; la marge UA de `figure` est mise à 0 en ligne ; la classe `plat-vignette` est gardée pour la révocation
    (`urlsDesVignettes`, D-T9).
  - **P-UI2-11** `deps.apercus` vaut `lireApercusWeb` par défaut, et `null` quand `deps.chercher` est injecté sans `deps.apercus` (F-10) : les tests de
    route des lots web et B, qui comptent leurs appels réseau, ne demandent aucun aperçu.
  - **P-UI2-12** le test v7 (b) fait coïncider à 60 s la minuterie du budget et les minuteries de 30 s de deux pages (même tour de `mock.timers`) :
    vert sur la copie de l'auteur (le `catch` lit `signal.aborted` après que les deux ont tiré), mais sensible à l'ordre des minuteries simulées :
    un rouge se rejoue avant d'être un constat (R-B-15).
  - **P-UI2-13** pglast n'est PAS installé sur ce Mac (`python3 -I -c "import pglast"` : `ModuleNotFoundError`, 23 octobre) : le contrôle de syntaxe
    SQL du Step 6 de la tâche 1 est SAUTÉ et dit tel quel dans `progress.md` et le rapport ; la sémantique de `0007` et de sa preuve n'est vérifiée que
    par les tests de texte ; la preuve réelle est le collage de Neegan (Clôture).
  - **P-UI2-14** `<scratchpad>` désigne le dossier scratchpad de la session de l'implémenteur (ci-dessus, « Où »).
  - **P-UI2-15** le relevé des pins rend **15 lignes**, non 14 : 13 assertions, le commentaire `tests/recherche-web.js:66` et la ligne
    `const v = /VERSION = …/.exec(sw);` de `tests/sync-l4.js:3506` (la spec dit « 13 assertions + 1 commentaire ») ; les 15 passent à `0.16.0`.
  - **P-UI2-16** la tâche S3 de la spec (« docs, redéploiement (chef), sondes, RESULTATS ») est coupée : les documents (`CLAUDE.md`, `STATE.md`,
    `docs/architecture.md`, spec § 12 sous-titre UI-2) sont la **tâche 3** de ce plan ; le redéploiement, les sondes et RESULTATS sont la **Clôture**
    (gestes du contrôleur, APRÈS la `0007` collée et prouvée par Neegan), comme aux lots B et F.
  - **P-UI2-17** la spec n'est amendée qu'au § 12 (un sous-titre UI-2 avant « ## 13. ») : ni son titre, ni son en-tête, ni § 13 (UI-1 les
    amendera à sa clôture ; moins de conflits à la fusion des deux lots, § 9).
  - **P-UI2-18** le trailer `Co-Authored-By` est celui du modèle réel de l'implémenteur (R-T1-3) ; `Claude-Session` quand le harnais la fournit.
  - **P-UI2-19** S-A7 (« cinq pages hostiles de 2 Mio ») exige un hôte public en `https` que le contrôleur contrôle ; s'il n'en a aucun à la Clôture,
    la sonde est consignée « non jouée » dans RESULTATS (rouge nommé, jamais un vert) et le budget de 60 s n'est prouvé que par v7.
  - **P-UI2-20** le commit de la tâche 3 (docs seuls) ne porte aucune version : R-B-24 ne vise que `src/`, `styles.css`, `index.html`, le manifeste
    et `sw.js`.
  - **P-UI2-21** la table serveur → client de la tâche 2 emploie le corps RÉEL du 400 de la fonction, `{ erreur: 'requete' }` (`index.ts:228` rend
    `requete` pour un refus `forme` de `lireDemande`), et non `{ erreur: 'forme' }` ; même issue (`requete`), par `RAISON_DE_ERREUR.requete`.
  - **P-UI2-22** I-UI-5 dit « liste blanche `typeAffichage` » ; `typeAffichage(fichier)` (`src/sync/mime.js:28`) lit une ligne `files`, pas un Blob, et
    applique `ALLOWED_MIME` par `safeDisplayType` (JPEG, PNG, WebP, HEIC, PDF, EPUB). La liste blanche des APERÇUS est `COVER_INPUT_MIME` (mime.js:5),
    sous-ensemble gelé d'`ALLOWED_MIME` (JPEG, PNG, WebP), celle de `LIMITES_IMAGE_WEB.types` et du mur distant `preparerPhotoDistante` : `figureApercu`
    et le `.then` de `demanderApercus` la lisent directement ; un élargissement de `typeAffichage` seul ne touche pas les aperçus — voulu (un HEIC ne
    s'affiche pas dans un `<img>` ; le mur de F le refuse de toute façon). Pré-vol, constat 5 (corrigé : le constat disait « la même liste »).
  - **P-UI2-23** `tests/recherche-web.js:1027` (`forme`) reste STRICTE : la spec (§ 7) décrit la forme « avec `FIGURE.apercu` optionnel », mais ces tests
    n'injectent pas `deps.apercus` (P-UI2-11 : aucun aperçu), l'optionnel y vaut toujours « absent », et un filtre qui ignorerait `figure.apercu` serait du
    code mort rendant l'épingle aveugle à une figure apparue à tort sur toutes les cartes des l. 1033-1060 ; une assertion « 0 `figure.apercu` » s'ajoute
    sur `r1` (l. 1033) et sur la carte de « Garder et lire » (l. 1226). Pré-vol, constat 13.
- **Ce que les tâches se transmettent** : la tâche 1 produit la forme HTTP exacte que la tâche 2 consomme (§ 6, reprise mot pour mot dans les
  deux sections « Interfaces ») ; la tâche 2 produit les versions et l'épingle ; la tâche 3 ne produit que des documents et lit `progress.md` et les
  rapports des tâches 1 et 2 ; la Clôture lit les trois.

**Décisions de la spec, copiées mot pour mot (§ 0, D-UI-12 à D-UI-14) :**

- **D-UI-12 Les aperçus des résultats web (UI-2).** Un sixième outil serveur, **`apercu-web`**, sans modèle : pour au plus 5 adresses
  (celles des liens choisis d'une recherche), la fonction télécharge chaque page (bornes de `lecture-web`), en tire l'adresse d'image par
  LA règle de F (`lirePageHtml(...).page.image_url` : `Recipe` lisible retenu, sinon `og:image` hors page de liste), télécharge l'image
  (bornes d'`image-web` pour les types, les redirections et les délais ; octets : `max` 1 Mio, le défaut d'`image-web` restant 2 Mio)
  et rend une entrée par adresse reçue ; **un appel du quota pour les cinq**, zéro jeton.
  Forme exacte : § 6. Côté app, la vignette (4:3, classe `plat-vignette`) s'affiche par blob local, jamais par une adresse `https` (I-F3,
  CSP inchangée), après le mur de pixels de F (I-F2). Rien n'est écrit dans `files` : une mémoire vive par adresse (`Map(href → aperçu)`,
  échecs compris) à côté de la mémoire des liens ; les URL `blob:` sont révoquées au redessin et au changement de route (D-T9), les Blob
  vivent avec le module : une entrée est lâchée quand son `href` n'est plus dans les liens affichés après une nouvelle réception, toutes
  le sont par `reinitialiserWeb()`, jamais par une simple nouvelle issue.
- **D-UI-13 Les aperçus sont automatiques, un appel de plus par recherche — défaut à confirmer (§ 13, point 2).** Quand une vue connectée
  rend un « trouvé », l'app demande les aperçus des adresses qu'elle ne connaît pas encore (un vol d'aperçus unique, annulable) ; le texte
  de garde dit AVANT la tape « Une recherche = 2 appels à l'assistant (résultats, puis photos), comptés dans ton quota du jour. » ; une
  ligne d'état sous « Demande envoyée » dit « Photos en cours de récupération… », puis disparaît (au moins une image), ou devient « Photos
  indisponibles pour cette recherche. » (aucune image, échec, `0007` absente) ou « Quota du jour atteint : photos indisponibles. » (429
  écrit par la passerelle) ; les figures sont insérées en UNE fois pour toute la liste, jamais carte par carte. Renversable vers une tape
  « Voir les photos (1 appel) ».
- **D-UI-14 UI-2 exige `0007`.** La contrainte `outil` du journal passe à six valeurs ; `0007` est écrite à la main comme `0004` et `0006`,
  collée par Neegan AVANT le redéploiement et AVANT le push de UI-2 ; sans elle, après la validation des adresses, l'insert d'`assistant_reserver` lève 23514 :
  la réservation échoue, aucune ligne n'est écrite, la fonction répond 502, et l'app montre les résultats sans image (comportement dégradé de D-UI-13, jamais une erreur bloquante).

**Invariants, copiés mot pour mot (§ 2, I-UI-1 à I-UI-7) :**

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

**Serveur, copié mot pour mot (§ 6, puce « Serveur ») :**

- **Serveur** : `OUTILS` + `'apercu-web'` (logique.js:7), `lireDemande` : forme `urls` pour cet outil seul (logique.js:40-58), branche dans
  `index.ts` à côté d'`image-web` (261-266) ; tests Node : logique (formes, bornes, doublons, refus par adresse sans réservation, 422
  seulement si aucune admise), `index.ts` (réservation unique après la validation, parallélisme 2, budget 60 s, `url` = chaîne reçue,
  journal), `OUTILS_0007` dans `tools/generer-migrations.test.mjs:1182-1192`.

**Base, ordre et lieux, copiés mot pour mot (en-tête, l. 3 ; § 9) :**

Base : `main` `05c751f` (chaîne A → F en ligne, `APP_VERSION 0.15.0`, `sw.js cuisine-os-v0.15.0-9`, suite 5948/5948, épingle 5947).

Deux branches, toutes deux créées sur le commit de cette rév. 2 (spec et maquettes dedans) : **`apercus-web`** (UI-2, worktree
`~/projects/mistu-apercus`, serveur 8095) et **`experience-carnet`** (UI-1, worktree `~/projects/mistu-carnet`, serveur 8096). Construction
séquentielle : UI-2 d'abord (le plus court, la première phrase de Neegan), UI-1 ensuite sans attendre la fusion de UI-2 (sa fusion dépend
de `0007` et du redéploiement, gestes de Neegan et du contrôleur). Chaque lot fusionne dans `main` par un commit de fusion ; le second
résout les quatre fichiers communs : `sw.js` (UNION de `SHELL`, les deux modules neufs, et son propre `VERSION`, +1 au commit de
fusion), `src/model/schema.js` et les pins (règle I-UI-7), `src/i18n/en.js`
(union), `tests/tests.js:250` (remesuré) ; le § 12 de cette spec reçoit les rulings de chaque lot sous son propre titre.

**UI-2 « Aperçus »** (plan 1, `0.16.0`) : S1 serveur (`lecture-web.js` / `logique.js` / `index.ts`, `telechargerImage({ max })`) + tests Node +
`0007` + preuve + README + générateur « 0008 » ; S2 domaine client (`apercu-web.js`, `dimensionsImage`) + `search.js` (vol, Map, ligne
d'état, insertion) + tests + filets + pins ; S3 docs, redéploiement (chef), sondes, RESULTATS. Gate de fusion : `0007` collée et prouvée,
sondes vertes (dont « cinq pages hostiles »), `/verify`.

## Review Focus

1. **Chaque adresse est validée AVANT la réservation ; une refusée devient `{ url, image: null, raison: 'interdit' }` sans priver les autres ; aucune
   admise → 422 `interdit` SANS réservation ni fetch ; une forme refusée → 400 `requete` sans réservation ; UNE réservation `apercu-web` pour les cinq,
   jamais le modèle, `url` = la chaîne reçue** → tâche 1 : `tools/assistant-logique.test.mjs` « lireDemande apercu-web : chaque adresse validee AVANT
   la reservation (I-UI-6, B-I-13) » et `tools/assistant-index.test.mjs` v1, v2, v3 ; mutant « réservation déplacée AVANT `lireDemande` » (Step 10).
2. **Le budget serveur de 60 s et le parallélisme 2 tiennent sous le vrai flux : deux pages en vol, jamais trois ; à 60 s exactes l'adresse en vol
   rend `delai`, une adresse jamais commencée rend `delai` sans fetch ; le client parti → requêtes abandonnées, 499 compté ; `0007` absente (23514 sur
   l'insert d'`assistant_reserver`) → 502 `serveur` sans page demandée, et l'app montre les résultats sans image** → tâche 1 : v6, v7 (a) et (b), v8,
   v9 ; tâche 2 : bloc « écran : la ligne d'état dans ses trois formes ; 429 quota mémorisé » (cas « serveur » → « Photos indisponibles… », mémorisé,
   aucune redemande).
3. **Le 200 est une donnée hostile côté client : la taille est bornée à 1 Mio AVANT tout décodage (`atob` jamais appelé à 1 048 577), un type hors
   liste, une taille nulle, un alphabet hors base64, un champ absent ou une raison inconnue valent `illisible`, une adresse demandée absente de la
   réponse vaut `illisible` (jamais redemandée), une adresse non demandée est ignorée, et chaque Blob passe le mur de F SANS ré-encodage (en-tête
   menteur, 400 Mpx, petit côté 199 → `image_refusee` ; `createImageBitmap` jamais appelé)** → tâche 2 : blocs « lireApercusWeb : corpsMax 8 Mio, le
   200 est une donnée hostile (S-12, I-UI-5) » et « mur sans ré-encodage : preparerPhotoDistante({ reencoder: false }) (H-7, I-UI-2) » ; tâche 1 : v5
   (1 Mio pile rendu, 1 048 577 refusé, cinq images à la borne sous 8 Mio).
4. **Un seul vol d'aperçus, demandé par une vue CONNECTÉE pour les adresses ABSENTES de la Map seulement (0 appel sur la même liste, un appel pour
   les trois adresses neuves sur cinq, les Blob des liens disparus lâchés) ; abandonné par `lancer()`, « Annuler » et la dernière vue déconnectée ; un
   résultat tardif d'un vol abandonné est MUET ; les figures sont insérées en UNE fois (un seul redessin, qui porte déjà les trois figures)** →
   tâche 2 : blocs « écran : demande d'aperçus — forme, un appel pour cinq, un seul vol, insertion en une fois (D-UI-13, S-4, B-I-12) », « écran : même
   demande → 0 appel ; trois liens neufs sur cinq … (K-1, S-5, S-6) » et « écran : abandon par lancer(), par « Annuler » (deux vues) et par la dernière
   vue déconnectée ; un résultat tardif est muet (S-4) » ; mutants 8, 9, 11, 13, 14, 15 (Step 11).
5. **Jamais de `src` `https` : chaque image vient d'une URL `blob:` recréée au rendu, révoquée au redessin (`remplacerEnRevoquant`) et au changement
   de route (`revoquerUrlsDeBlob`), les Blob restant dans la Map (une nouvelle instance de la route les réaffiche sans appel) ; `img.onerror` retire la
   figure, révoque l'URL et remplace l'entrée (si l'URL était encore vivante : une `error` d'URL déjà révoquée vient de la révocation, pas du décodage) ;
   `deps.chercher` injecté sans `deps.apercus` → aucun aperçu demandé, ni factice ni réseau** → tâche 2 :
   blocs « écran : URL révoquées et Blob gardés au changement de route ; révocation au redessin (S-6, D-T9) », « écran : img.onerror → figure retirée,
   URL révoquée, entrée remplacée (S-7) », « écran : deps.chercher sans deps.apercus → 0 appel ; … (F-10, S-4) » et le test de source I-F3 de
   `tests/photo-plat.js` étendu à `search.js` et `library.js` (Step 3) ; mutants 12, 16, 19, 21, 22 (Step 11).

---

### Task 1 : S1 serveur — l'outil `apercu-web` (cinq adresses, une réservation, zéro jeton), `0007` et sa preuve, README étape 13, générateur « 0008 »

Spec § 6 en entier ; D-UI-12, D-UI-14 ; I-UI-6 ; § 7 (lignes UI-2 : `tools/assistant-index.test.mjs`, `tools/generer-migrations.test.mjs:1182-1192, 1264-1266`) ;
§ 9 tâche S1 ; § 12 B-I-13, B-M-6, B-M-10, F-19, S-1 à S-3, S-8 à S-13, K-5, K-7, H-18. Aucun fichier de l'app (`src/`), aucune version (`APP_VERSION`,
`sw.js`, `SHELL`, `DB_VERSION` et l'épingle `tests/tests.js:250` ne bougent pas : la tâche 2 les porte). Aucun appel réel, aucune migration appliquée,
aucun déploiement, aucun secret : la fonction reste la version 4 sur `mitsu` jusqu'au geste du chef d'orchestre (Clôture), après la `0007` collée et prouvée par Neegan.

**Files:**
- Modify: `supabase/functions/assistant/logique.js` (l. 1-5 : l'en-tête gagne le lot UI-2 ; l. 7 `OUTILS` à six ; l. 8-10 : le commentaire d'`OUTILS_MODELE`
  nomme `apercu-web` ; après l. 11 `LIMITES` : `LIMITES_APERCU`, `PARALLELISME_APERCU` ; après l. 45 (fin de `lireDemandeUrl`) : `lireDemandeUrls` ;
  l. 58 : la branche `apercu-web` de `lireDemande`).
- Modify: `supabase/functions/assistant/index.ts` (l. 1-6 : deux lignes d'en-tête ; l. 8 : l'import de `logique.js` gagne `LIMITES_APERCU, PARALLELISME_APERCU` ;
  l. 164-178 : `telechargerImage` gagne `max = LIMITES_IMAGE.octets` ; l. 261-266 : le bloc `apercu-web` s'insère APRÈS le bloc `image-web` et AVANT
  `if (corpsModele !== null)` (l. 267) ; après `traiter` (l. 287) et avant `Deno.serve` (l. 289) : `type ImageApercu`, `type Apercu`, `RAISON_PAGE`,
  `RAISON_IMAGE`, `apercuDe`, `enParallele` — déclarées APRÈS `traiter`, voir Step 7).
- Create: `supabase/migrations/0007_apercu_web.sql` (à la main, sur le gabarit de `0006_lecture_web.sql`, 10 lignes à `f3672be`).
- Create: `supabase/proofs/0007_apercu_web.sql` (sur le gabarit de `proofs/0006_lecture_web.sql`, 114 lignes à `f3672be` : 1.01 à six valeurs, 2.032 « 2.03 ter »,
  3.01 « les cinq anciens »).
- Modify: `supabase/README.md` (l. 3-4 : « trois écrites à la main (`0004`, `0006`, `0007`) » ; l. 21-22 : deux lignes de l'arbre après `proofs/0006_lecture_web.sql` ;
  étape 13 insérée entre la fin de l'étape 12 (l. 382) et `## Où coller les sorties` (l. 384)).
- Modify: `supabase/proofs/RESULTATS-mitsu.md` (445 lignes à `f3672be` ; deux sections ajoutées en fin de fichier, après « Sondes `image-web` » ; une seule
  fin de ligne finale).
- Modify: `tools/generer-migrations.mjs` (l. 202 et l. 322 : « la 0007 à venir » → « la 0008 à venir », « dans une 0007 » → « dans une 0008 »).
- Test (Modify): `tools/assistant-logique.test.mjs` (l. 3-4 imports ; l. 44 `OUTILS` à six ; l. 234 le filtre d'`OUTILS_MODELE` ; fin de fichier, l. 256 : cinq tests neufs).
- Test (Modify): `tools/assistant-index.test.mjs` (fin de fichier, l. 1378 : fixtures et v1 à v9 ; u1 à u12 inchangés en sens — `telechargerImage` garde son défaut de 2 Mio).
- Test (Modify): `tools/generer-migrations.test.mjs` (l. 1189-1190 : `0006` redevient un PRÉFIXE ; l. 1245 : « trois écrites à la main » ; l. 1264-1268 : « la 0008 à venir » ;
  l. 1271-1274 : `OUTILS` = `OUTILS_0007` ; fin de fichier, l. 1296 : `OUTILS_0007` et cinq tests neufs — `0007`, preuve `0007`, README étape 13, RESULTATS, `index.ts` (UI-2)).

**Interfaces:**
- Consumes (à relire au Step 0, dans le code réel de `f3672be`) : `lecture-web.js` — `LIMITES_LECTURE` (l. 7-12), `valideAdresse(url, { hotesRefuses })` →
  `{ ok: true, href, hote } | { ok: false, raison: 'interdit' }` (l. 35-45), `LIMITES_IMAGE` (l. 415-418 : `octets: 2 * 1024 * 1024`), `typeImageAdmis`,
  `signatureImage`, `versBase64` (l. 485-489), `lirePageHtml({ html, urlFinale, contentType, hotesRefuses })` → `{ jsonld: { recette, autres } | null, texte,
  texte_coupe, page: { …, autres_recettes, texte_coupe, image_url } }` (l. 532-552 : `image_url` dernière clé, LA règle de F) ; `logique.js` — `OUTILS`,
  `OUTILS_MODELE`, `LIMITES`, `own`, `objetNu`, `refus(statut, raison)`, `lireDemandeUrl`, `lireDemande`, `ligneJournal`, `corpsErreur` ; `index.ts` —
  `lireCorpsBorne(source, max)` (l. 75-91), `suivreRedirections<T>` (l. 104-149), `telechargerPage` (l. 152-162), `telechargerImage` (l. 167-178), `RefusPage`,
  `traiter` (l. 203-287 : `lu`, `refuses`, `ctl`, `statut`, `corpsReponse`, `usage`, le bloc `image-web` l. 261-266), `json`, `corpsErreur` ; harnais
  `tools/assistant-index.test.mjs` — `handler`, `remise`, `requete(methode, { texte, signal })`, `lire`, `reserves`, `page({ page, anthropic })`, `appelsFetch`,
  `appelsPage`, `appelsModele`, `htmlReponse`, `jsonReponse`, `RECETTE_LD`, `TEXTE_RECETTE`, `sourde`, `vider`, `JPEG`, `imageReponse`, `faux`, `ENV`, `MIO`,
  `mock`, `LIMITES`, `LIMITES_LECTURE` ; `tools/generer-migrations.test.mjs` — `lire`, `sansCommentaires`, `instructions`, `rubrique`, `NOMS`, `FONCTION`,
  `OUTILS_PASSERELLE` (alias d'`OUTILS`), `OUTILS_0006`, `ORDRE_DU_FLUX`, `ordreDuFlux` ; `tools/faux/supabase.mjs` — `registre`, `RPC`, `MAJ`, `evenements`, `REPONSES`.
- Produces (`supabase/functions/assistant/logique.js`) — ce que la tâche 2 (client) consomme :

```js
export const OUTILS = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web', 'apercu-web']);   // = OUTILS_0007
export const OUTILS_MODELE = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web']);                       // inchangé
export const LIMITES_APERCU = Object.freeze({ adresses: 5, budgetMs: 60000, image: 1024 * 1024 });
export const PARALLELISME_APERCU = 2;
// lireDemande(texte, { outil: 'apercu-web', modele, octets, hotesRefuses }) →
//   { ok: true, corps: { entrees: [{ url: <chaîne reçue, telle quelle>, href: <adresse normalisée> | null }] } }   (href null = refusée par valideAdresse)
// | { ok: false, statut: 400, raison: 'forme' }      (urls absent, pas un tableau, vide, > 5, un élément non-chaîne ou de plus de 2 048 unités)
// | { ok: false, statut: 422, raison: 'interdit' }   (aucune admise : jamais de réservation)
// | { ok: false, statut: 413, raison: 'trop_lourd' } (corps > 512 Kio)
```

- Produces (HTTP, la forme exacte que `src/domain/apercu-web.js` lit à la tâche 2) :
  - Demande : `POST /functions/v1/assistant`, corps `{ outil: 'apercu-web', corps: { urls: [ ... ] } }` (1 à 5 chaînes ; le client envoie `lien.href`).
  - 200 `{ apercus: [{ url, image: { type: 'image/jpeg' | 'image/png' | 'image/webp', taille: <octets>, octets: <base64 avec remplissage> } | null,
    raison: null | 'interdit' | 'inaccessible' | 'pas_de_recette' | 'pas_d_image' | 'image_trop_lourde' | 'delai' }] }` — une entrée par chaîne reçue, dans
    l'ordre reçu, `url` = la chaîne reçue ; `raison` nulle si et seulement si `image` est présente ; aucune autre clé (ni `url_finale`, ni `usage`, ni `model`).
  - 400 `{ erreur: 'requete' }` (forme) sans réservation ; 422 `{ erreur: 'interdit' }` (aucune admise) sans réservation ; 413 `{ erreur: 'trop_lourd' }` ;
    429 `{ erreur: 'quota', quota }` (réservation refusée : l'app dit « Quota du jour atteint : photos indisponibles. ») ; 502 `{ erreur: 'serveur' }` (dont
    la `0007` absente : l'insert d'`assistant_reserver` lève 23514 → l'app, tâche 2, montre les résultats sans image) ; 499 sans corps (client parti : appel compté).
  - Raisons par entrée : `interdit` (adresse refusée AVANT la réservation, ou redirection — page ou image — vers un hôte refusé) ; `inaccessible` (page
    4xx/5xx/DNS/délai de saut/page > 2 Mio/exception, image 4xx/5xx/DNS/délai de saut) ; `pas_de_recette` (pas une page HTML, aucune `Recipe` lisible ni
    `og:image` retenue, page de liste) ; `pas_d_image` (une `Recipe` lisible unique sans image ni `og:image` ; type d'image hors liste ou signature menteuse) ;
    `image_trop_lourde` (image > 1 Mio) ; `delai` (budget de 60 s épuisé : adresse en vol abandonnée, ou jamais commencée).
  - Journal : une ligne `apercu-web` par appel, statut 200 (499 si le client est parti), `jetons_entree` / `jetons_sortie` null, `duree_ms`, `octets` = la taille du corps reçu.
- Produces (`index.ts`, internes) : `telechargerImage(href, { signal, hotesRefuses, max = LIMITES_IMAGE.octets })` → `{ octets, type, urlFinale } | RefusPage` ;
  `type ImageApercu = { type: string; taille: number; octets: string }` ; `type Apercu = { image: ImageApercu | null; raison: string | null }` ;
  `apercuDe(href, { signal, hotesRefuses })` → `Promise<Apercu>` (ne lève jamais) ; `enParallele<T>(taches, n)` → `Promise<T[]>` (au plus `n` à la fois, résultats
  à l'index de leur tâche) ; `RAISON_PAGE`, `RAISON_IMAGE` (tables fermées `RefusPage.erreur` → raison d'entrée).
- Produces (SQL) : `0007_apercu_web.sql` (4 instructions : `begin;` drop ; add `check (outil in ('recherche-web', 'creation', 'extraction', 'lecture-web',
  'image-web', 'apercu-web'))` ; `commit;`) ; preuve `0007` : 11 verdicts (1.01-1.05, 2.01, 2.02, 2.03, 2.031, 2.032, 3.01), BILAN attendu `0 faux sur 11`.
- Produces (tests, littéraux) : `OUTILS_0007 = [...OUTILS_0006, 'apercu-web']` dans `tools/generer-migrations.test.mjs` ; `OUTILS_0006` reste (préfixe, historique).

- [ ] **Step 0 : relevés et constats (aucune écriture dans le dépôt).**
  1. Départ, lu dans la sortie (le worktree `/Users/neeganmac/projects/mistu-apercus` est servi par `python3 -m http.server 8095 --bind 127.0.0.1`) :
     `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095` (attendu `✅ 5948/5948`, épingle `tests/tests.js:250` = 5947, seule erreur de console le
     404 de `/favicon.ico`) ; `node --test tools/*.test.mjs` (attendu 208/208) ; `node tools/generer-migrations.mjs --check` (attendu 0) ;
     `npx -y -p typescript@5.6.3 tsc --noEmit --strict --allowJs --target es2022 --module esnext --moduleResolution bundler --skipLibCheck supabase/functions/assistant/index.ts supabase/functions/assistant/deno.d.ts`
     (attendu 0 ; typescript 5.6.3 est en cache npx depuis le lot B) ; `grep -n "APP_VERSION\|DB_VERSION" src/model/schema.js` (`0.15.0`, `4`) ;
     `grep -n "^const VERSION" sw.js` (`cuisine-os-v0.15.0-9`). Noter ces six valeurs dans `.superpowers/sdd/2026-10-23-apercus-web/progress.md`.
  2. Préconditions, constatées en Python sur les fichiers réels ; le script **sort en 1** dès qu'un contrôle manque (NEEDS_CONTEXT : rien d'autre n'est tenté) :

     ```bash
     python3 -I - <<'PY'
     import re, sys
     L = lambda p: open(p, encoding='utf-8').read()
     logique = L('supabase/functions/assistant/logique.js'); index = L('supabase/functions/assistant/index.ts'); lecture = L('supabase/functions/assistant/lecture-web.js')
     gen = L('tools/generer-migrations.mjs'); tgen = L('tools/generer-migrations.test.mjs'); tlog = L('tools/assistant-logique.test.mjs'); tidx = L('tools/assistant-index.test.mjs')
     readme = L('supabase/README.md'); res = L('supabase/proofs/RESULTATS-mitsu.md'); m6 = L('supabase/migrations/0006_lecture_web.sql'); p6 = L('supabase/proofs/0006_lecture_web.sql')
     CINQ = "['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web']"
     controles = [
         ('OUTILS a cinq, image-web dernier', "export const OUTILS = Object.freeze(" + CINQ + ");" in logique),
         ('OUTILS_MODELE a quatre', "export const OUTILS_MODELE = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web']);" in logique),
         ('lireDemandeUrl partagee par lecture-web et image-web (l. 58)', "if (outil === 'lecture-web' || outil === 'image-web') return lireDemandeUrl(corps, { hotesRefuses });" in logique),
         ('LIMITES_IMAGE.octets = 2 Mio', 'octets: 2 * 1024 * 1024' in lecture),
         ('lirePageHtml pose page.image_url en derniere cle', 'autres_recettes: autres, texte_coupe: false, image_url }' in lecture and 'autres_recettes: 0, texte_coupe: coupe, image_url }' in lecture),
         ('telechargerImage sans parametre max', "async function telechargerImage(href: string, { signal, hotesRefuses: refuses }: { signal: AbortSignal; hotesRefuses: string[] }): Promise<ImageTelechargee | RefusPage> {" in index),
         ('telechargerImage borne par LIMITES_IMAGE.octets', 'await lireCorpsBorne(rep, LIMITES_IMAGE.octets)' in index),
         ('bloc image-web de traiter', "if (outil === 'image-web') {" in index and "if (corpsModele !== null) {" in index),
         ('corpsModele par OUTILS_MODELE', 'OUTILS_MODELE.includes(outil) ? lu.corps : null' in index),
         ('traiter puis Deno.serve', index.index('async function traiter(') < index.index('Deno.serve(')),
         ('0006 : check a cinq valeurs', "check (outil in ('recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'))" in m6),
         ('preuve 0006 : 2.031 image-web', "public.assistant_reserver(uid, 'image-web', 1, c::integer + 1)" in p6),
         ('generateur : « la 0007 à venir » (l. 202) et « dans une 0007 » (l. 322)', gen.count('la 0007 à venir') == 1 and gen.count('dans une 0007 (') == 1),
         ('test du generateur : « la 0007 à venir » (l. 1264-1268)', "assert.ok(g.includes('la 0007 à venir'), 'la prochaine migration generee est 0007');" in tgen),
         ('OUTILS_0006 en litteral, puis l egalite du lot F (l. 1189-1190, 1271-1274)', "const OUTILS_0006 = " + CINQ + ";" in tgen and "assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0006, 'lot F : le prefixe de B devient l egalite (R-F-9)');" in tgen and tgen.count('assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0006);') == 1),
         ('README : « deux écrites à la main » (retours a la ligne confondus, comme le test) et l etape 12 suivie de « Où coller »', 'deux écrites à la main (`0004`, `0006`)' in re.sub(r'\s+', ' ', readme) and readme.index('### 12. Coller `0006_lecture_web.sql`') < readme.index('## Où coller les sorties')),
         ('README etape 11 sans numero de migration a venir', '0007' not in readme[readme.index('### 11.'):readme.index('### 12.')]),
         ('RESULTATS : derniere section « Sondes image-web », une seule fin de ligne', res.rstrip('\n').split('\n## ')[-1].startswith('Sondes `image-web`') and res.endswith('\n') and not res.endswith('\n\n')),
         ('test logique : OUTILS a cinq (l. 44) et filtre image-web (l. 234)', "'lecture-web', 'image-web'], 'lot F : cinq outils" in tlog and "assert.deepEqual(OUTILS_MODELE, OUTILS.filter((o) => o !== 'image-web'));" in tlog),
         ('harnais index : u12 dernier test, aides JPEG / imageReponse / sourde / vider presentes', tidx.rstrip().endswith('});') and "test('u12. " in tidx and all(s in tidx for s in ['const JPEG = (n)', 'const imageReponse = ', 'const sourde = ', 'const vider = ', 'const MIO = 1024 * 1024;'])),
     ]
     for nom, vu in controles: print(('ok     ' if vu else 'MANQUE ') + nom)
     sys.exit(0 if all(vu for _, vu in controles) else 1)
     PY
     ```

  3. Relire dans le code RÉEL : `suivreRedirections` (le relais de `signal`, les deux minuteries, la garde `r.redirected`), `telechargerPage`, `telechargerImage`, le
     bloc `image-web` de `traiter` et sa suite (499, mise à jour unique du journal) ; `lireDemandeUrl` ; `lirePageHtml` (la règle d'image de F : `Recipe` retenu, sinon
     `og:image` hors page de liste — `autresRecettes: Math.max(autres, trouvees.length - 1)`) ; dans `tools/generer-migrations.test.mjs`, le test N-1 (l. 749-772 :
     `ordreDuFlux` épingle l'ordre par la PREMIÈRE occurrence de chaque point d'appel dans tout le texte sans commentaires — c'est pourquoi `apercuDe`, qui porte
     `await telechargerPage(`, `lirePageHtml(` et `await telechargerImage(`, est déclarée APRÈS `traiter`, Step 7). Les numéros de lignes cités par cette tâche
     valent à `f3672be` ; tout écart de nom est un amendement nommé dans `progress.md`, pas un constat.

- [ ] **Step 1 : tests rouges — `tools/assistant-logique.test.mjs`.** Imports (l. 3-4) : `import { OUTILS, OUTILS_MODELE, LIMITES, LIMITES_APERCU, PARALLELISME_APERCU, origineAdmise, … } from '../supabase/functions/assistant/logique.js';`
  et `import { LIMITES_LECTURE, LIMITES_IMAGE, textePrincipal } from '../supabase/functions/assistant/lecture-web.js';`. Amender l. 44 :
  `assert.deepEqual(OUTILS, ['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web', 'apercu-web'], 'lot UI-2 : six outils, apercu-web dernier (la contrainte de 0007 suit cet ordre, D-UI-14)');`
  et l. 234 : `assert.deepEqual(OUTILS_MODELE, OUTILS.filter((o) => o !== 'image-web' && o !== 'apercu-web'));`. Ajouter en fin de fichier :

```js
// --- Lot UI-2 « Aperçus des résultats web » (spec 2026-10-23-experience-carnet § 6, D-UI-12, I-UI-6) : apercu-web, sans modèle --------------------
const ap = (corps, extra = {}) => lireDemande(JSON.stringify({ outil: 'apercu-web', corps }), { outil: 'apercu-web', modele: MODELE, maxTokens: LIMITES.maxTokens, ...extra });
test('OUTILS : six outils, apercu-web dernier, gele ; OUTILS_MODELE inchange (ni image-web ni apercu-web n atteint le modele)', () => {
  assert.deepEqual(OUTILS, ['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web', 'apercu-web']);
  assert.ok(Object.isFrozen(OUTILS));
  assert.deepEqual(OUTILS_MODELE, ['recherche-web', 'creation', 'extraction', 'lecture-web']);
  assert.ok(!OUTILS_MODELE.includes('apercu-web'));
});
test('LIMITES_APERCU et PARALLELISME_APERCU : forme (D-UI-12, S-1, S-2, H-18)', () => {
  assert.ok(Object.isFrozen(LIMITES_APERCU));
  assert.deepEqual(LIMITES_APERCU, { adresses: 5, budgetMs: 60000, image: 1024 * 1024 });
  assert.equal(PARALLELISME_APERCU, 2);
  assert.ok(LIMITES_APERCU.budgetMs < LIMITES.attenteMs, 'le budget des apercus (60 s) tient sous les 120 s de la fonction');
  assert.ok(LIMITES_APERCU.image < LIMITES_IMAGE.octets, '1 Mio par apercu, distinct du defaut d image-web (2 Mio), qui ne change pas');
  assert.equal(LIMITES_IMAGE.octets, 2 * 1024 * 1024);
});
test('lireDemande apercu-web : liste blanche { urls }, 1 a 5 chaines de 2 048 unites au plus, sinon 400 forme ; 413 au-dela de 512 Kio', () => {
  const ok = ap({ urls: ['https://a.test/r'], messages: 'ignore', system: 'ignore', max_tokens: 9, model: 'autre', url: 'https://b.test/', tools: [] });
  assert.deepEqual(ok, { ok: true, corps: { entrees: [{ url: 'https://a.test/r', href: 'https://a.test/r' }] } }, 'champs en trop ignores (le `url` au singulier compris)');
  const cinq = Array.from({ length: 5 }, (_, i) => `https://a.test/${i}`);
  assert.deepEqual(ap({ urls: cinq }).corps.entrees.map((e) => e.url), cinq, 'cinq adresses : admises, dans l ordre');
  for (const [nom, corps] of [['urls absent', {}], ['urls chaine', { urls: 'https://a.test/' }], ['urls objet', { urls: { 0: 'https://a.test/' } }], ['vide', { urls: [] }],
    ['six', { urls: [...cinq, 'https://a.test/5'] }], ['un nombre', { urls: ['https://a.test/', 7] }], ['null', { urls: [null] }], ['objet', { urls: [{ url: 'https://a.test/' }] }],
    ['2 049 unites', { urls: ['https://a.test/' + 'x'.repeat(2049 - 15)] }]]) {
    const r = ap(corps); assert.deepEqual([r.ok, r.statut, r.raison], [false, 400, 'forme'], nom);
  }
  assert.equal(ap({ urls: ['https://a.test/' + 'x'.repeat(2048 - 15)] }).ok, true, '2 048 unites : admise');
  const gros = JSON.stringify({ outil: 'apercu-web', corps: { urls: ['https://a.test/'], bourrage: 'x'.repeat(LIMITES.corps) } });
  assert.equal(lireDemande(gros, { outil: 'apercu-web', modele: MODELE }).statut, 413, 'corps > 512 Kio (la borne de LIMITES.corps, pas celle de l extraction)');
  assert.equal(lireDemande(JSON.stringify({ outil: 'apercu-web', corps: { urls: ['https://a.test/'] } }), { outil: 'apercu-web', modele: '' }).statut, 502, 'modele absent : 502 comme pour les autres outils');
});
test('lireDemande apercu-web : chaque adresse validee AVANT la reservation (I-UI-6, B-I-13) — refusee : href null, url telle quelle ; 422 interdit seulement si aucune admise', () => {
  const r = ap({ urls: ['https://a.test/r?x=1#frag', 'http://b.test/', 'https://127.0.0.1/', 'https://u:p@c.test/', 'https://projet.test/x'] }, { hotesRefuses: ['projet.test'] });
  assert.deepEqual(r, { ok: true, corps: { entrees: [
    { url: 'https://a.test/r?x=1#frag', href: 'https://a.test/r?x=1' },
    { url: 'http://b.test/', href: null }, { url: 'https://127.0.0.1/', href: null }, { url: 'https://u:p@c.test/', href: null }, { url: 'https://projet.test/x', href: null },
  ] } }, 'url = la chaine recue (fragment garde) ; href = l adresse normalisee (fragment retire) ou null');
  for (const [nom, urls] of [['http', ['http://b.test/']], ['locaux', ['https://localhost/', 'https://a.test:8443/', 'https://cdn.projet.test/i']], ['invisible', ['https://a.test/\u2028x']]]) {
    const refus = ap({ urls }, { hotesRefuses: ['projet.test'] });
    assert.deepEqual([refus.ok, refus.statut, refus.raison], [false, 422, 'interdit'], nom + ' : aucune admise = 422 sans reservation');
  }
  const une = ap({ urls: ['http://b.test/', 'https://localhost/', 'https://a.test/ok', 'https://a.test:8443/'] });
  assert.deepEqual(une.corps.entrees.map((e) => e.href), [null, null, 'https://a.test/ok', null], 'une seule admise suffit : les refusees ne privent pas les autres');
  const doublons = ap({ urls: ['https://a.test/r', 'https://a.test/r#a', 'https://a.test/r'] });
  assert.deepEqual(doublons.corps.entrees.map((e) => e.href), ['https://a.test/r', 'https://a.test/r', 'https://a.test/r'], 'trois entrees pour trois chaines : le dedoublonnage est celui du TELECHARGEMENT (index.ts), jamais de la reponse (S-9)');
  assert.equal(ap({ urls: ['https://x.test/'] }).ok, true, 'sans hotesRefuses : admis');
  assert.deepEqual(ap({ urls: ['https://x.test/'] }, { hotesRefuses: ['x.test'] }).statut, 422, 'S-12 : l hote du projet refuse');
});
test('ligneJournal : apercu-web admis, usage nul → jetons null ; apercu_web (souligne) refuse', () => {
  const base = { ownerId: 'u', statut: 200, usage: null, dureeMs: 3, octets: 40, maintenant: '2026-10-23T00:00:00.000Z' };
  const l = ligneJournal({ ...base, outil: 'apercu-web' });
  assert.deepEqual([l.outil, l.statut, l.jetons_entree, l.jetons_sortie, l.octets, l.jour], ['apercu-web', 200, null, null, 40, '2026-10-23']);
  assert.equal(ligneJournal({ ...base, outil: 'apercu-web', statut: 499 }).statut, 499, 'client parti : 499 journalise (appel compte)');
  assert.equal(ligneJournal({ ...base, outil: 'apercu_web' }).outil, null);
});
```

- [ ] **Step 2 : tests rouges — `tools/assistant-index.test.mjs`** (ajouter en fin de fichier, après u12 ; `handler`, `remise`, `requete`, `lire`, `reserves`, `page`,
  `appelsFetch`, `appelsPage`, `appelsModele`, `htmlReponse`, `RECETTE_LD`, `TEXTE_RECETTE`, `sourde`, `vider`, `JPEG`, `imageReponse`, `faux`, `ENV`, `MIO`, `mock`
  sont ceux du fichier ; aucun import de plus : les bornes sont des LITTÉRAUX ici, épinglées par le test de `logique.js` au Step 1, pour qu'un budget ou un
  parallélisme changé dans le code rougisse). u1 à u12 ne changent pas : `telechargerImage` garde son défaut de 2 Mio (u5 reste la preuve d'`image-web`).

```js
// --- Lot UI-2 « Aperçus des résultats web » (spec 2026-10-23-experience-carnet § 6, D-UI-12, D-UI-14, I-UI-6) : apercu-web, cinq adresses, zéro jeton ----------
const corpsApercu = (urls) => JSON.stringify({ outil: 'apercu-web', corps: { urls } });
const pageOg = (image, texte = TEXTE_RECETTE) => `<html><head><title>Blogue</title><meta property="og:image" content="${image}"></head><body><main><h1>Plat</h1><p>${texte}</p></main></body></html>`;
const pageLd = (image) => `<html><head><title>Puttanesca</title><script type="application/ld+json">${JSON.stringify({ ...RECETTE_LD, image })}</script></head><body><main><p>Texte.</p></main></body></html>`;
const { image: _imageLd, ...RECETTE_SANS_IMAGE } = RECETTE_LD;
const PAGE_LD_SANS_IMAGE = `<html><head><title>Sans</title><script type="application/ld+json">${JSON.stringify(RECETTE_SANS_IMAGE)}</script></head><body><main><p>Texte.</p></main></body></html>`;
// Une page de LISTE : deux Recipe lisibles sans image, et une og:image (celle d'une autre recette : écartée par la règle de F, D-F3).
const pageListe = (og) => `<html><head><title>Liste</title><meta property="og:image" content="${og}"></head><body><main><script type="application/ld+json">${JSON.stringify([{ ...RECETTE_SANS_IMAGE, name: 'A' }, { ...RECETTE_SANS_IMAGE, name: 'B' }])}</script><p>${TEXTE_RECETTE}</p></main></body></html>`;
const PAGE_RIEN = '<html><head><title>Rien</title></head><body><main><p>Un texte sans recette ni image.</p></main></body></html>';
// Un routeur par adresse : chaque entrée est (url, options) → Response ; une adresse absente répond 404 (donc inaccessible).
const routeur = (routes) => page({ page: (url, options) => (Object.hasOwn(routes, url) ? routes[url](url, options) : Promise.resolve(new Response('absent', { status: 404, headers: { 'content-type': 'text/plain' } }))) });
// Vide les micro-tâches ET quelques tours de boucle : une page lue déclenche une chaîne (lecture du corps, lirePageHtml, fetch de l'image, base64) avant qu'une adresse suivante parte.
const drainer = async () => { for (let i = 0; i < 8; i += 1) await vider(); };
const BUDGET_APERCU_MS = 60000; // LIMITES_APERCU.budgetMs (logique.js), en littéral ici : un budget changé dans index.ts rougit v7
const B64_UN_MIO = 1398104;     // ceil(1 048 576 / 3) × 4

test('v1. apercu-web : adresses toutes refusees → 422 interdit AVANT toute reservation, aucun fetch ; forme (urls absent, chaine, vide, six, non-chaine, 2 049 unites) → 400 requete sans reservation', async () => {
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  const r = await handler(requete('POST', { texte: corpsApercu(['http://a.test/', 'https://127.0.0.1/', 'https://localhost/x', 'https://projet.test/x', 'https://a.test:8443/']) }));
  assert.deepEqual([r.status, await lire(r), reserves().length, appelsFetch.length, faux.MAJ.length], [422, { erreur: 'interdit' }, 0, 0, 0]);
  for (const [nom, texte] of [['absent', JSON.stringify({ outil: 'apercu-web', corps: {} })], ['chaine', corpsApercu('https://a.test/')], ['vide', corpsApercu([])],
    ['six', corpsApercu(Array.from({ length: 6 }, (_, i) => `https://a.test/${i}`))], ['non-chaine', corpsApercu(['https://a.test/', 7])], ['2 049 unites', corpsApercu(['https://a.test/' + 'x'.repeat(2034)])]]) {
    remise();
    const x = await handler(requete('POST', { texte }));
    assert.deepEqual([x.status, await lire(x), reserves().length, appelsFetch.length, faux.MAJ.length], [400, { erreur: 'requete' }, 0, 0, 0], nom);
  }
});

test('v2. une admise et quatre interdites : UNE reservation apercu-web (cle secrete), deux fetch (la page, puis son image), AUCUN fetch du modele, 200 avec cinq entrees dans l ordre, url = chaine recue, journal 200 jetons null', async () => {
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  const octets = JPEG(1000);
  routeur({ 'https://site.test/r1': async () => htmlReponse(pageLd('https://site.test/i/p.jpg')), 'https://site.test/i/p.jpg': async () => imageReponse(octets) });
  const urls = ['https://site.test/r1#frag', 'http://b.test/', 'https://127.0.0.1/', 'https://u:p@c.test/', 'https://projet.test/x'];
  const texte = corpsApercu(urls);
  const r = await handler(requete('POST', { texte }));
  assert.equal(r.status, 200);
  const corps = await lire(r);
  assert.deepEqual(reserves().map((a) => a.args), [{ p_owner: 'compte-1', p_outil: 'apercu-web', p_octets: Buffer.byteLength(texte), p_quota: 2 }], 'une seule reservation pour les cinq (I-UI-6)');
  assert.equal(reserves()[0].cle, 'sb_secret_factice');
  assert.deepEqual([appelsPage().map((a) => a.url), appelsModele().length], [['https://site.test/r1', 'https://site.test/i/p.jpg'], 0], 'la page (fragment retire) puis son image ; jamais le modele');
  for (const f of appelsPage()) {
    assert.deepEqual([f.options.method, f.options.redirect, f.options.credentials], ['GET', 'manual', 'omit']);
    assert.deepEqual(Object.keys(f.options).sort(), ['credentials', 'headers', 'method', 'redirect', 'signal'], 'les options ENTIERES : jamais referrer ni referrerPolicy');
    assert.deepEqual(Object.keys(f.options.headers).sort(), ['accept', 'accept-language', 'user-agent'], 'exactement trois en-tetes : jamais referer, cookie, authorization, apikey, x-api-key');
    assert.equal(f.options.headers['user-agent'], 'Mitsu/0.10 (+https://neegans.github.io/mistu/)');
  }
  assert.ok(appelsPage()[0].options.headers.accept.startsWith('text/html') && appelsPage()[1].options.headers.accept.startsWith('image/jpeg'), 'l accept de la page, puis celui de l image');
  assert.deepEqual(Object.keys(corps), ['apercus'], 'une seule cle (S-17) : ni usage, ni model, ni url_finale');
  assert.deepEqual(corps.apercus.map((a) => Object.keys(a).sort()), Array.from({ length: 5 }, () => ['image', 'raison', 'url']));
  assert.deepEqual(corps.apercus.map((a) => [a.url, a.raison, a.image === null]), [['https://site.test/r1#frag', null, false], ['http://b.test/', 'interdit', true], ['https://127.0.0.1/', 'interdit', true], ['https://u:p@c.test/', 'interdit', true], ['https://projet.test/x', 'interdit', true]], 'une entree par chaine recue, dans l ordre, url telle quelle (fragment garde) ; raison nulle si et seulement si image presente');
  assert.deepEqual([corps.apercus[0].image.type, corps.apercus[0].image.taille, Object.keys(corps.apercus[0].image).sort()], ['image/jpeg', 1000, ['octets', 'taille', 'type']]);
  assert.ok(Buffer.from(corps.apercus[0].image.octets, 'base64').equals(Buffer.from(octets)), 'les octets relus du base64');
  assert.deepEqual(faux.MAJ[0].v, { statut: 200, jetons_entree: null, jetons_sortie: null, duree_ms: faux.MAJ[0].v.duree_ms });
  assert.deepEqual(faux.evenements, ['rpc:is_allowed', 'rpc:assistant_reserver', 'fetch', 'fetch', 'update'], 'validation, reservation, page, image, journal : dans cet ordre');
});

test('v3. dedoublonnage pour le TELECHARGEMENT seulement (S-9) : trois chaines pour la meme page → deux fetch (page, image), trois entrees ; casse et fragment de la chaine recue rendus tels quels', async () => {
  remise();
  routeur({ 'https://site.test/R1': async () => htmlReponse(pageOg('https://cdn.test/og.jpg')), 'https://cdn.test/og.jpg': async () => imageReponse(JPEG(40)) });
  const urls = ['https://Site.test/R1#x', 'https://site.test/R1', 'https://SITE.test/R1#y'];
  const r = await handler(requete('POST', { texte: corpsApercu(urls) }));
  const corps = await lire(r);
  assert.deepEqual([r.status, appelsPage().map((a) => a.url), appelsModele().length, reserves().length], [200, ['https://site.test/R1', 'https://cdn.test/og.jpg'], 0, 1]);
  assert.deepEqual(corps.apercus.map((a) => a.url), urls, 'url = la chaine recue, jamais le href normalise (le client indexe par lien.href)');
  assert.deepEqual(corps.apercus.map((a) => [a.raison, a.image.taille, a.image.octets === corps.apercus[0].image.octets]), [[null, 40, true], [null, 40, true], [null, 40, true]], 'la meme image pour les trois entrees');
});

test('v4. une raison par adresse, sans faire echouer les autres (page : inaccessible, pas_de_recette, pas_d_image, interdit ; image : inaccessible, pas_d_image, image_trop_lourde, interdit) ; une page sans JSON-LD n appelle JAMAIS le modele ; jamais un corps d erreur dans la reponse ni au journal', async () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const html = new TextEncoder().encode('<!doctype html><p>APERCU-SENTINELLE</p>');
  const routes = {
    'https://site.test/p404': async () => new Response('APERCU-SENTINELLE', { status: 404, headers: { 'content-type': 'text/html' } }),
    'https://site.test/pdf': async () => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200, headers: { 'content-type': 'application/pdf' } }),
    'https://site.test/liste': async () => htmlReponse(pageListe('https://cdn.test/liste.jpg')),
    'https://site.test/sans': async () => htmlReponse(PAGE_LD_SANS_IMAGE),
    'https://site.test/rien': async () => htmlReponse(PAGE_RIEN),
    'https://site.test/og': async () => htmlReponse(pageOg('https://cdn.test/og.jpg')),
    'https://cdn.test/og.jpg': async () => imageReponse(JPEG(40)),
    'https://site.test/img404': async () => htmlReponse(pageOg('https://cdn.test/404.jpg')),
    'https://cdn.test/404.jpg': async () => new Response('APERCU-SENTINELLE', { status: 404, headers: { 'content-type': 'text/plain' } }),
    'https://site.test/svg': async () => htmlReponse(pageOg('https://cdn.test/i.svg')),
    'https://cdn.test/i.svg': async () => imageReponse(svg, { type: 'image/svg+xml' }),
    'https://site.test/menteuse': async () => htmlReponse(pageOg('https://cdn.test/menteuse.jpg')),
    'https://cdn.test/menteuse.jpg': async () => imageReponse(html, { type: 'image/jpeg' }),
    'https://site.test/lourde': async () => htmlReponse(pageOg('https://cdn.test/lourde.jpg')),
    'https://cdn.test/lourde.jpg': async () => imageReponse(JPEG(16), { entetes: { 'content-length': String(MIO + 1) } }),
    'https://site.test/redir': async () => htmlReponse(pageOg('https://cdn.test/redir.jpg')),
    'https://cdn.test/redir.jpg': async () => new Response(null, { status: 302, headers: { location: 'https://localhost/x' } }),
    'https://site.test/pageredir': async () => new Response(null, { status: 301, headers: { location: 'https://127.0.0.1/x' } }),
    'https://site.test/pagelourde': async () => htmlReponse('<main>x</main>', { entetes: { 'content-length': String(2 * MIO + 1) } }),
    'https://site.test/dns': async () => { throw new TypeError('getaddrinfo ENOTFOUND'); },
  };
  const attendu = {
    'https://site.test/p404': ['inaccessible', false], 'https://site.test/pdf': ['pas_de_recette', false], 'https://site.test/liste': ['pas_de_recette', false],
    'https://site.test/sans': ['pas_d_image', false], 'https://site.test/rien': ['pas_de_recette', false],
    'https://site.test/og': [null, true], 'https://site.test/img404': ['inaccessible', false], 'https://site.test/svg': ['pas_d_image', false],
    'https://site.test/menteuse': ['pas_d_image', false], 'https://site.test/lourde': ['image_trop_lourde', false],
    'https://site.test/redir': ['interdit', false], 'https://site.test/pageredir': ['interdit', false], 'https://site.test/pagelourde': ['inaccessible', false], 'https://site.test/dns': ['inaccessible', false],
  };
  const urls = Object.keys(attendu);
  const issues = {}; const demandees = [];
  for (let i = 0; i < urls.length; i += 5) {
    remise(); routeur(routes);
    const lot = urls.slice(i, i + 5);
    const r = await handler(requete('POST', { texte: corpsApercu(lot) }));
    const t = await r.text();
    assert.equal(r.status, 200, lot.join(' '));
    assert.ok(!t.includes('SENTINELLE') && !JSON.stringify(faux.MAJ).includes('SENTINELLE'), 'jamais le corps d une page ou d une image d erreur, ni dans la reponse ni au journal');
    for (const a of JSON.parse(t).apercus) issues[a.url] = [a.raison, a.image !== null];
    demandees.push(...appelsPage().map((a) => a.url));
    assert.deepEqual([reserves().length, appelsModele().length, faux.MAJ[0].v.statut], [1, 0, 200], 'une reservation, aucun appel au modele (meme pour une page sans JSON-LD), journal 200 : ' + lot.join(' '));
  }
  assert.deepEqual(issues, attendu);
  assert.equal(demandees.includes('https://cdn.test/liste.jpg'), false, 'l og:image d une page de liste n est jamais demandee (D-F3)');
  assert.equal(demandees.includes('https://localhost/x'), false, 'une cible de redirection refusee n est jamais demandee');
});
```

```js
test('v5. borne de 1 Mio par apercu (H-18, F-19, S-11) : 1 048 577 octets → image_trop_lourde ; 1 048 576 → image rendue (1 398 104 caracteres) ; cinq images a la borne → corps ≤ 8 Mio (le corpsMax du client) ; image-web garde ses 2 Mio (u5)', { timeout: 20000 }, async () => {
  remise();
  routeur({ 'https://site.test/un': async () => htmlReponse(pageOg('https://cdn.test/un.jpg')), 'https://cdn.test/un.jpg': async () => imageReponse(JPEG(MIO + 1)),
    'https://site.test/juste': async () => htmlReponse(pageOg('https://cdn.test/juste.jpg')), 'https://cdn.test/juste.jpg': async () => imageReponse(JPEG(MIO)) });
  const r = await handler(requete('POST', { texte: corpsApercu(['https://site.test/un', 'https://site.test/juste']) }));
  const corps = await lire(r);
  assert.deepEqual([r.status, corps.apercus[0].raison, corps.apercus[0].image, corps.apercus[1].raison, corps.apercus[1].image.taille, corps.apercus[1].image.octets.length], [200, 'image_trop_lourde', null, null, MIO, B64_UN_MIO]);
  assert.ok(Buffer.from(corps.apercus[1].image.octets, 'base64').equals(Buffer.from(JPEG(MIO))), 'base64 relu a l octet (tranches multiples de 3 : un seul remplissage, a la fin)');
  remise();
  const routes = {};
  const cinq = [1, 2, 3, 4, 5].map((i) => `https://site.test/b${i}`);
  for (const [i, u] of cinq.entries()) { routes[u] = async () => htmlReponse(pageOg(`https://cdn.test/b${i + 1}.jpg`)); routes[`https://cdn.test/b${i + 1}.jpg`] = async () => imageReponse(JPEG(MIO)); }
  routeur(routes);
  const r5 = await handler(requete('POST', { texte: corpsApercu(cinq) }));
  const texte = await r5.text();
  assert.equal(r5.status, 200);
  assert.ok(Buffer.byteLength(texte) <= 8 * MIO, 'cinq images a la borne : ' + Buffer.byteLength(texte) + ' octets, sous les 8 Mio du client (≈ 7 Mio de base64)');
  assert.deepEqual(JSON.parse(texte).apercus.map((a) => [a.raison, a.image.taille, a.image.octets.length]), Array.from({ length: 5 }, () => [null, MIO, B64_UN_MIO]));
});

test('v6. parallelisme 2 (PARALLELISME_APERCU, S-2) : deux pages en vol, jamais trois ; la troisieme part quand une des deux premieres finit ; l ordre des entrees est celui des chaines recues', async () => {
  remise();
  const attentes = new Map();
  page({ page: (url) => (url.startsWith('https://cdn.test/') ? Promise.resolve(imageReponse(JPEG(10))) : new Promise((res) => { attentes.set(url, res); })) });
  const urls = [1, 2, 3, 4, 5].map((i) => `https://site.test/p${i}`);
  const enCours = handler(requete('POST', { texte: corpsApercu(urls) }));
  await drainer();
  assert.deepEqual([...attentes.keys()], urls.slice(0, 2), 'deux pages en vol apres la reservation, pas trois');
  attentes.get(urls[1])(htmlReponse(pageOg('https://cdn.test/2.jpg'))); await drainer();
  assert.deepEqual([...attentes.keys()], urls.slice(0, 3), 'p2 finie (page puis image) : p3 part, p1 toujours en vol');
  attentes.get(urls[0])(htmlReponse(pageOg('https://cdn.test/1.jpg'))); await drainer();
  assert.deepEqual([...attentes.keys()], urls.slice(0, 4));
  attentes.get(urls[2])(htmlReponse(pageOg('https://cdn.test/3.jpg'))); attentes.get(urls[3])(htmlReponse(pageOg('https://cdn.test/4.jpg'))); await drainer();
  assert.deepEqual([...attentes.keys()], urls, 'la cinquieme part en dernier');
  attentes.get(urls[4])(htmlReponse(pageOg('https://cdn.test/5.jpg')));
  const r = await enCours;
  const corps = await lire(r);
  assert.deepEqual([r.status, corps.apercus.map((a) => a.url), corps.apercus.every((a) => a.image !== null && a.raison === null), appelsPage().length, appelsModele().length], [200, urls, true, 10, 0]);
});

test('v7. budget serveur de 60 s (S-1) : UN AbortController par appel, relaye a chaque suivreRedirections — (a) les adresses lues avant restent, celle en vol est abandonnee a 60 s EXACTES (delai) ; (b) une adresse jamais commencee rend delai sans fetch ; 200, journal 200', async () => {
  // (a) Chaque page = un 301 a 11 s puis un 200 (og:image) a 11 s : 22 s par adresse, sous les 15 s par saut et les 30 s par page ; deux a la fois (v6) :
  // p1-p2 0-22 s, p3-p4 22-44 s, p5 44 s → son second saut est en vol a 60 s.
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = [];
    const saut = (url, options) => new Promise((resoudre, rejeter) => {
      options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resoudre(url.endsWith('/a') ? new Response(null, { status: 301, headers: { location: url.slice(0, -2) + '/b' } }) : htmlReponse(pageOg('https://cdn.test/' + url.split('/')[3] + '.jpg'))), 11000);
    });
    page({ page: (url, options) => { if (url.startsWith('https://cdn.test/')) return Promise.resolve(imageReponse(JPEG(10))); signaux.push(options.signal); return saut(url, options); } });
    const urls = [1, 2, 3, 4, 5].map((i) => `https://site.test/p${i}/a`);
    const enCours = handler(requete('POST', { texte: corpsApercu(urls) }));
    await drainer();
    assert.equal(signaux.length, 2, 't = 0 : p1 et p2');
    for (const [t, n] of [[11, 4], [22, 6], [33, 8], [44, 9]]) { mock.timers.tick(11000); await drainer(); assert.equal(signaux.length, n, 't = ' + t + ' s'); }
    mock.timers.tick(11000); await drainer();
    assert.equal(signaux.length, 10, 't = 55 s : le second saut de p5 est en vol');
    mock.timers.tick(BUDGET_APERCU_MS - 55000 - 1); await drainer();
    assert.equal(signaux[9].aborted, false, 'rien a 59,999 s');
    mock.timers.tick(1); await drainer();
    assert.equal(signaux[9].aborted, true, 'a 60 s exactes, la requete en vol est abandonnee par le budget');
    const r = await enCours;
    const corps = await lire(r);
    assert.deepEqual([r.status, corps.apercus.map((a) => [a.raison, a.image !== null]), faux.MAJ[0].v.statut, appelsModele().length], [200, [[null, true], [null, true], [null, true], [null, true], ['delai', false]], 200, 0]);
    assert.equal(appelsPage().length, 14, 'dix fetch de page (deux sauts par adresse) et quatre images ; rien apres le budget');
  } finally { mock.timers.reset(); }
  // (b) Chaque page = 301 a 12 s, 301 a 12 s, puis un troisieme saut coupe par les 30 s de la page (inaccessible) : p1-p2 0-30 s (inaccessible), p3-p4
  // 30-60 s (coupees a 60 s par le budget : delai, meme si leur propre minuterie de 30 s tombe dans le meme tour), p5 jamais commencee (delai, zero fetch).
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = [];
    page({ page: (url, options) => { signaux.push(options.signal); return new Promise((resoudre, rejeter) => {
      options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resoudre(new Response(null, { status: 301, headers: { location: url + '/s' } })), 12000);
    }); } });
    const enCours = handler(requete('POST', { texte: corpsApercu([1, 2, 3, 4, 5].map((i) => `https://site.test/q${i}`)) }));
    await drainer();
    for (const [t, n] of [[12, 4], [24, 6], [30, 8], [42, 10], [54, 12]]) { mock.timers.tick(t === 30 ? 6000 : 12000); await drainer(); assert.equal(signaux.length, n, 't = ' + t + ' s'); }
    mock.timers.tick(BUDGET_APERCU_MS - 54000 - 1); await drainer();
    assert.deepEqual([signaux[10].aborted, signaux[11].aborted], [false, false], 'rien a 59,999 s');
    mock.timers.tick(1); await drainer();
    assert.deepEqual([signaux[10].aborted, signaux[11].aborted], [true, true], 'a 60 s : les deux troisiemes sauts de p3 et p4 tombent');
    const r = await enCours;
    const corps = await lire(r);
    assert.deepEqual([r.status, corps.apercus.map((a) => a.raison), appelsPage().length, faux.MAJ[0].v.statut], [200, ['inaccessible', 'inaccessible', 'delai', 'delai', 'delai'], 12, 200], 'p5 jamais demandee : douze fetch en tout (trois par adresse commencee)');
  } finally { mock.timers.reset(); }
});

test('v8. le client part pendant les apercus (F-5) : les requetes en vol sont abandonnees (relais ctl → budget), les adresses restantes ne sont jamais demandees, 499 sans corps, journal 499 (appel compte)', { timeout: 8000 }, async () => {
  remise();
  const signaux = []; let deux; const posees = new Promise((res) => { deux = res; });
  page({ page: (url, options) => { signaux.push(options.signal); if (signaux.length === 2) deux(); return sourde(url, options); } });
  const client = new AbortController();
  const enCours = handler(requete('POST', { texte: corpsApercu([1, 2, 3, 4, 5].map((i) => `https://site.test/s${i}`)), signal: client.signal }));
  await posees;
  client.abort();
  const r = await enCours;
  assert.deepEqual([r.status, await r.text(), signaux.map((s) => s.aborted), appelsPage().length, faux.MAJ[0].v.statut, appelsModele().length], [499, '', [true, true], 2, 499, 0]);
});

test('v9. D-UI-14 / K-7 : la reservation en erreur (0007 absente : 23514 sur l insert d assistant_reserver) → 502 serveur, aucune page demandee ; quota atteint → 429 quota, aucune page demandee', async () => {
  remise(); routeur({ 'https://site.test/r1': async () => htmlReponse(pageLd('https://site.test/i/p.jpg')) });
  faux.REPONSES.rpc = async (nom) => (nom === 'is_allowed' ? { data: true, error: null } : { data: null, error: { code: '23514', message: 'new row for relation "assistant_journal" violates check constraint "assistant_journal_outil_check"' } });
  const r = await handler(requete('POST', { texte: corpsApercu(['https://site.test/r1', 'https://site.test/r2']) }));
  const t = await r.text();
  assert.deepEqual([r.status, JSON.parse(t), reserves().length, appelsFetch.length, faux.MAJ.length, t.includes('23514'), t.includes('check constraint')], [502, { erreur: 'serveur' }, 1, 0, 0, false, false], 'la validation des adresses a eu lieu (une reservation tentee), rien d autre ; le message SQL ne sort jamais');
  remise(); routeur({ 'https://site.test/r1': async () => htmlReponse(pageLd('https://site.test/i/p.jpg')) });
  faux.REPONSES.rpc = async (nom) => (nom === 'is_allowed' ? { data: true, error: null } : { data: null, error: null });
  const q = await handler(requete('POST', { texte: corpsApercu(['https://site.test/r1']) }));
  assert.deepEqual([q.status, await lire(q), appelsFetch.length, faux.MAJ.length], [429, { erreur: 'quota', quota: 2 }, 0, 0], 'S-15 : le 429 ecrit par la passerelle porte quota ; le client dit « Quota du jour atteint : photos indisponibles. »');
});
```

- [ ] **Step 3 : tests rouges — `tools/generer-migrations.test.mjs`.** (1) Sous `const OUTILS_0006 = …` (l. 1182) : `const OUTILS_0007 = [...OUTILS_0006, 'apercu-web'];`.
  (2) l. 1189-1190 (les deux assertions du test « 0006 ») remplacées par UNE :
  `assert.deepEqual(OUTILS_PASSERELLE.slice(0, OUTILS_0006.length), OUTILS_0006, 'lot UI-2 : 0006 redevient un PREFIXE d OUTILS (la 0007 ajoute apercu-web ; l egalite vit au test « lot F puis UI-2 »)');`
  et le commentaire l. 1180-1181 gagne : « Depuis UI-2, OUTILS = OUTILS_0007 et 0006 est un préfixe historique. ». (3) l. 1245 (test de l'étape 12) :
  `assert.ok(arbre.replace(/\s+/g, ' ').includes('trois écrites à la main (`0004`, `0006`, `0007`)'), 'intro : trois ecrites a la main');`. (4) l. 1264-1268 remplacées :

```js
test('generateur (D-B11, B-M-10) : le commentaire dit « la 0008 à venir » (l. 202) et « dans une 0008 » (l. 322) ; plus aucune 0006 ni 0007 a generer', () => {
  const g = lire('tools/generer-migrations.mjs');
  assert.equal(g.split('la 0008 à venir').length - 1, 1, 'la prochaine migration generee est 0008');
  assert.ok(g.includes('dans une 0008 ('), 'le magasin suivant va dans une 0008');
  assert.doesNotMatch(g, /la 000[67] à venir|dans une 000[67] \(/, 'ni 0006 ni 0007 promises par le generateur : toutes deux ecrites a la main (lots B et UI-2)');
});
```

  (5) l. 1270-1274 (le test « lot F : OUTILS porte les cinq ») remplacées :

```js
// --- Lot F « Les plats en images » (spec § 6.3, § 7.2-7.3), puis UI-2 : OUTILS = OUTILS_0007, 0006 en est le prefixe
test('lot F puis UI-2 : OUTILS porte les six outils de 0007, apercu-web dernier ; 0006 en est le prefixe', () => {
  assert.equal(OUTILS_PASSERELLE.length, 6);
  assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0007);
  assert.deepEqual(OUTILS_PASSERELLE.slice(0, 5), OUTILS_0006);
});
```

  (6) En fin de fichier (après le test « index.ts (lot F) », l. 1296) :

```js
// --- Lot UI-2 « Aperçus des résultats web » (spec 2026-10-23-experience-carnet § 6, D-UI-14, S-13, B-M-10) : 0007 écrite à la main, sa preuve, le README
// (étape 13), RESULTATS, le générateur (« la 0008 à venir ») et le flux d'index.ts. 0007 est hors de NOMS et de --check, comme 0004 et 0006.
test('0007 : hors NOMS, une transaction, 4 instructions — drop puis add de la contrainte, avec les six valeurs d OUTILS_0007 dans l ordre ; rien d autre ; 0006 intacte', () => {
  assert.ok(!NOMS.some((n) => n.startsWith('0007')), '0007 n est pas generee');
  const m = lire('supabase/migrations/0007_apercu_web.sql');
  const code = sansCommentaires(m);
  assert.deepEqual(instructions(code), ['begin;', 'alter table public.assistant_journal drop constraint assistant_journal_outil_check;',
    `alter table public.assistant_journal add constraint assistant_journal_outil_check check (outil in (${OUTILS_0007.map((o) => `'${o}'`).join(', ')}));`, 'commit;'],
    'quatre instructions ; la liste SQL est le litteral OUTILS_0007 (six valeurs, apercu-web derniere)');
  assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0007, 'OUTILS = OUTILS_0007');
  assert.doesNotMatch(code, /\b(create|grant|revoke|insert|update|delete|truncate)\b/, 'ni table, ni fonction, ni privilege, ni donnee');
  assert.equal(code, code.toLowerCase(), 'SQL en minuscules');
  assert.ok(m.includes('de colonne') && m.includes('23514') && m.includes('502') && m.includes('sans image'), 'l en-tete dit pourquoi (check de colonne de 0006, 23514, 502, l app montre les resultats sans image : D-UI-14)');
  assert.ok(m.includes('transactionnel'), 'DDL transactionnel : aucune fenetre sans contrainte');
  assert.doesNotMatch(m, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse'); assert.ok(!m.includes('sk-'), 'aucune cle');
  assert.equal(instructions(sansCommentaires(lire('supabase/migrations/0006_lecture_web.sql')))[2], `alter table public.assistant_journal add constraint assistant_journal_outil_check check (outil in (${OUTILS_0006.map((o) => `'${o}'`).join(', ')}));`, '0006 n a pas bouge (historique, collee le 23 octobre)');
});
test('preuve 0007 : rollback final, une transaction, BILAN, gardes, 1.01 a six valeurs, 2.03 ter apercu-web dans un bloc exception, c recompte trois fois, les cinq anciens, aucune adresse ni jeton', () => {
  const p = lire('supabase/proofs/0007_apercu_web.sql');
  const code = sansCommentaires(p);
  const l = instructions(code);
  assert.equal(l[l.length - 1], 'rollback;', 'rollback dernier');
  assert.equal(l.filter((x) => x === 'begin;').length, 1, 'une seule transaction');
  assert.match(code, /select 999,\s*'BILAN'/);
  for (const n of ['1.01', '1.02', '1.03', '1.04', '1.05', '2.01', '2.02', '2.03', '2.031', '2.032', '3.01']) assert.ok(code.includes(`${n},`), 'verdict ' + n);
  for (const m of ['pg_get_constraintdef', "'23514'", 'les six outils, dans l ordre d OUTILS_0007', 'and f > e', "public.assistant_reserver(uid, 'lecture-web', 1, c::integer + 1)",
    "public.assistant_reserver(uid, 'image-web', 1, c::integer + 1)", "public.assistant_reserver(uid, 'apercu-web', 1, c::integer + 1)", "2.03 ter : assistant_reserver(uid, ''apercu-web'', 1, c + 1) -> id non nul",
    "'les cinq anciens outils passent encore'", "'aucun compte : etape sautee'", 'security_invoker=true', "conname = 'assistant_journal_outil_check'", "string_agg(conname, ', ')", "contype = 'c'"]) assert.ok(code.includes(m), m);
  for (const outil of OUTILS_0007) assert.ok(code.includes(`'''${outil}'''`), '1.01 cherche ' + outil);
  const plat = code.replace(/\s+/g, ' ');
  for (const outil of ['lecture-web', 'image-web', 'apercu-web']) assert.ok(plat.includes(`begin r := public.assistant_reserver(uid, '${outil}', 1, c::integer + 1); v := case when r is null then 'null' else 'id non nul' end; exception when others then v := sqlstate; end;`), outil + ' : appel dans un bloc exception');
  assert.equal(plat.split("select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;").length - 1, 3, 'c RECOMPTE avant 2.03, 2.031 et 2.032 (chaque reservation ecrit une ligne du jour)');
  assert.ok(plat.includes("(2.032, '2.03 ter : assistant_reserver(uid, ''apercu-web'', 1, c + 1) -> id non nul (la valeur du lot UI-2)', 'id non nul', v, v = 'id non nul');"), 'verdict 2.032 sur l id');
  assert.ok(plat.includes("values (uid, 'recherche-web', 200, date '2000-01-01'), (uid, 'creation', 200, date '2000-01-01'), (uid, 'extraction', 200, date '2000-01-01'), (uid, 'lecture-web', 200, date '2000-01-01'), (uid, 'image-web', 200, date '2000-01-01')"), '3.01 : les cinq anciens outils');
  assert.ok(!p.includes('@'), 'aucun arobase'); assert.doesNotMatch(p, /A_UUID|B_UUID|A_EMAIL|B_EMAIL/, 'aucun jeton a remplacer');
  assert.doesNotMatch(code, /\bemail\b/i, 'aucune adresse lue'); assert.ok(!p.includes('sk-'), 'aucune cle');
  assert.ok(code.includes('from auth.users order by created_at limit 1'), 'compte emprunte, jamais affiche');
});
test('README : etape 13 (0007, preuve a 11 verdicts, 0006 historique, ordre 0007 → redeploiement → sondes apercu-web → fusion → push, la phrase du 502 sans image) entre 12 et « Où coller les sorties »', () => {
  const r = lire('supabase/README.md');
  const titre = '### 13. Coller `0007_apercu_web.sql`, puis jouer sa preuve';
  const debut = r.indexOf(titre);
  assert.notEqual(debut, -1, 'etape 13');
  assert.ok(r.indexOf('### 12. Coller `0006_lecture_web.sql`') < debut && debut < r.indexOf('## Où coller les sorties'), '13 apres 12, avant « Où coller les sorties »');
  const etape = rubrique(r, titre).replace(/\s+/g, ' ');
  for (const m of ['migrations/0007_apercu_web.sql', 'proofs/0007_apercu_web.sql', 'Run without RLS', '999 BILAN', '0 faux sur 11', 'RESULTATS-mitsu.md', '2.03 ter', 'les six outils',
    'un code servi avant `0007` : chaque demande d\'aperçus répond 502 `serveur` (la réservation refuse l\'outil) ; l\'app montre les résultats sans image, rien d\'autre ne change.',
    'la preuve `0006` devient historique', 'son 1.01 rougit', 'transactionnel', 'aucune fenêtre sans contrainte', 'shasum -a 256 supabase/migrations/0007_apercu_web.sql',
    'supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api', 'S-A1', 'S-A4', 'S-A5', 'S-A7', 'puttanesca', 'cinq pages hostiles', 'zéro jeton',
    'presse-papiers', 'jamais le jeton dans une commande', 'S1-S9 du lot 4']) assert.ok(etape.includes(m), m);
  const i = ['migrations/0007_apercu_web.sql', 'proofs/0007_apercu_web.sql', 'supabase functions deploy assistant', 'S-A1', 'S-A5', 'fusion', '`push`'].map((m) => etape.indexOf(m));
  assert.ok(i.every((x) => x !== -1), 'gestes presents : ' + i.join(','));
  assert.deepEqual([...i].sort((a, b) => a - b), i, 'dans l ordre : ' + i.join(','));
  const arbre = r.slice(0, r.indexOf('## Un seul projet'));
  for (const f of ['migrations/0007_apercu_web.sql', 'proofs/0007_apercu_web.sql']) assert.ok(arbre.includes(f), 'arbre : ' + f);
  assert.ok(arbre.replace(/\s+/g, ' ').includes('trois écrites à la main (`0004`, `0006`, `0007`)'), 'intro : trois ecrites a la main');
  assert.doesNotMatch(etape, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
});
test('RESULTATS-mitsu : sections « Preuve 0007_apercu_web.sql — à jouer » et « Sondes apercu-web » preparees en fin de fichier, sans cle ni adresse', () => {
  const res = lire('supabase/proofs/RESULTATS-mitsu.md');
  const debut = res.indexOf('## Preuve `0007_apercu_web.sql` — ');
  assert.notEqual(debut, -1, 'section 0007');
  assert.ok(debut > res.indexOf('## Sondes `image-web`'), 'apres les sondes image-web');
  const section = res.slice(debut);
  for (const m of ['étape 13', 'migrations/0007_apercu_web.sql', 'shasum -a 256 supabase/migrations/0007_apercu_web.sql', 'Run without RLS', '999 BILAN', '0 faux sur 11', '| ordre | etape | attendu | obtenu | ok |',
    '2.03 ter', '`apercu-web`', 'la preuve `0006` devient historique', '## Sondes `apercu-web`', 'S-A1', 'S-A2', 'S-A3', 'S-A4', 'S-A5', 'S-A6', 'S-A7', 'sans dépense', 'zéro jeton', 'puttanesca',
    'cinq pages hostiles', 'image_trop_lourde', 'pas_de_recette', 'presse-papiers', 'jamais le jeton dans une commande', 'S1-S9']) assert.ok(section.includes(m), m);
  assert.ok(res.endsWith('\n') && !res.endsWith('\n\n'), 'une seule fin de ligne en fin de fichier');
  assert.doesNotMatch(section, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse');
  assert.doesNotMatch(res, /sk-(?!…)[A-Za-z0-9_-]{4,}/, 'aucune cle');
});
test('index.ts (UI-2) : apercu-web dans le flux apres image-web et avant le modele, une seule boucle, deux fetch sortants, budget et parallelisme par leurs constantes, telechargerImage avec max, apercuDe declaree APRES traiter (N-1) ; mutant « apercuDe avant traiter » rouge', () => {
  const code = sansCommentaires(lire(`${FONCTION}/index.ts`));
  assert.deepEqual(ordreDuFlux(code), { presents: true, croissants: true });
  assert.equal((code.match(/redirect: 'manual'/g) || []).length, 1, 'une seule boucle (suivreRedirections)');
  assert.equal((code.match(/await fetch\(/g) || []).length, 2, 'deux appels sortants : la page ou l image dans suivreRedirections, le fournisseur dans appelerAnthropic');
  for (const m of ["if (outil === 'apercu-web') {", 'LIMITES_APERCU.budgetMs', 'PARALLELISME_APERCU)', 'max: LIMITES_APERCU.image', 'async function apercuDe(', 'async function enParallele<T>(', 'max = LIMITES_IMAGE.octets', 'await lireCorpsBorne(rep, max)']) assert.ok(code.includes(m), m);
  assert.ok(code.indexOf("if (outil === 'image-web') {") < code.indexOf("if (outil === 'apercu-web') {") && code.indexOf("if (outil === 'apercu-web') {") < code.indexOf('if (corpsModele !== null) {'), 'le bloc apercu-web entre image-web et le modele');
  assert.ok(code.indexOf('async function traiter(') < code.indexOf('async function apercuDe(') && code.indexOf('async function apercuDe(') < code.indexOf('Deno.serve('), 'apercuDe (qui porte telechargerPage, lirePageHtml et telechargerImage) est declaree apres traiter, avant Deno.serve');
  assert.ok(!code.slice(code.indexOf('async function apercuDe(')).includes('await appelerAnthropic('), 'apercuDe n atteint jamais le modele');
  // Mutant : apercuDe (et ses marqueurs) remontee AVANT traiter → la premiere occurrence d « await telechargerPage( » precede la reservation : l ordre casse.
  const d = code.indexOf('async function apercuDe('); const f = code.indexOf('\n}\n', d) + 3;
  const decl = code.slice(d, f); const sans = code.replace(decl, '');
  const t = sans.indexOf('async function traiter(');
  assert.deepEqual(ordreDuFlux(sans.slice(0, t) + decl + sans.slice(t)), { presents: true, croissants: false }, 'mutant « apercuDe avant traiter » : rouge');
});
```

- [ ] **Step 4 : rouge lu.** `node --test --test-timeout=10000 tools/*.test.mjs` (sans `--test-timeout`, v8 attend un `fetch` qui ne part jamais : son propre
  `{ timeout: 8000 }` le coupe, mais l'option raccourcit tout rouge lent). Attendu, lu dans la sortie : `tools/assistant-logique.test.mjs` entier en erreur de
  chargement (les exports `LIMITES_APERCU` et `PARALLELISME_APERCU` n'existent pas : « does not provide an export named ») ; v1 à v9 rouges (`apercu-web`
  inconnu d'`OUTILS` : la fonction répond 400 `requete` là où v1 attend 422 et v2-v7, v9 attendent 200 / 502 / 429 ; v8 expire) ; dans
  `tools/generer-migrations.test.mjs` : « 0007 » (ENOENT), « preuve 0007 » (ENOENT), « README : etape 13 » (titre absent), « RESULTATS-mitsu : … 0007 » (section
  absente), « generateur (D-B11, B-M-10) » (« la 0008 à venir » absent), « lot F puis UI-2 » (cinq ≠ six), « index.ts (UI-2) » (`apercu-web` absent) rouges ;
  « README : etape 12 » (« trois écrites » absent : ROUGE lui aussi, il attend le README du Step 8) ; **« 0006 » (préfixe) reste VERT** : sur `f3672be`,
  `OUTILS` a cinq valeurs = `OUTILS_0006`, `slice(0, 5)` égale déjà le préfixe et le reste du test (SQL de `0006_lecture_web.sql`) ne bouge pas — un vert
  attendu, pas un constat ; tout le reste vert (u1-u12, t1-t13, a-s4, N-1, `0004`, `0005`, `0006`). Compte attendu : 208 départ + 19 tests neufs (5 logique, 9 index, 5 générateur ; « generateur » et « lot F puis UI-2 »
  remplacent des tests existants et ne comptent pas) = **227 tests**, dont une vingtaine de rouges plus le fichier logique en erreur ; la valeur lue fait
  foi, à consigner dans `progress.md`. La suite navigateur n'est pas relancée ici (aucun fichier de `src/` ni de
  `tests/` touché).

- [ ] **Step 5 : implémenter `logique.js`.** En-tête (l. 1-5) : ajouter après la phrase du lot F : « Lot UI-2 (spec 2026-10-23-experience-carnet § 6) : le
  sixième outil, `apercu-web`, sans modèle non plus — une liste d'adresses, chacune validée AVANT la réservation (I-UI-6) ; ses bornes dans LIMITES_APERCU. ».
  l. 7 :

```js
export const OUTILS = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web', 'apercu-web']);
```

  l. 8-9 (commentaire d'`OUTILS_MODELE`) : « … ; image-web et apercu-web n'y sont pas et n'y seront jamais (index.ts initialise corpsModele par elle, avant tout await). ».
  Après l. 11 (`LIMITES`) :

```js
// Lot UI-2 (spec § 6, D-UI-12, S-1, S-2, H-18) : les bornes de l'outil apercu-web — au plus 5 adresses par appel, un budget serveur de 60 s (un AbortController
// par appel, relayé à chaque suivreRedirections, sous les 120 s de LIMITES.attenteMs), 1 Mio par image (le défaut d'image-web, LIMITES_IMAGE.octets, reste
// 2 Mio) ; PARALLELISME_APERCU adresses à la fois (renversable à 1 ou 3 après la sonde « puttanesca », Clôture du lot).
export const LIMITES_APERCU = Object.freeze({ adresses: 5, budgetMs: 60000, image: 1024 * 1024 });
export const PARALLELISME_APERCU = 2;
```

  Après `lireDemandeUrl` (l. 40-45) :

```js
// apercu-web (lot UI-2, I-UI-6, B-I-13) : liste blanche { urls } — 1 à LIMITES_APERCU.adresses chaînes de LIMITES_LECTURE.url unités au plus, sinon 400 forme ;
// CHAQUE adresse passe par valideAdresse AVANT toute réservation : refusée → href null (l'entrée { url, image: null, raison: 'interdit' } de la réponse) ;
// `url` reste la chaîne reçue, telle quelle (le client indexe par lien.href) ; 422 interdit seulement si AUCUNE n'est admise (aucune réservation). Les doublons
// restent des entrées : le dédoublonnage est celui du téléchargement (index.ts), jamais de la réponse (S-9).
function lireDemandeUrls(corps, { hotesRefuses = [] } = {}) {
  const urls = own(corps, 'urls');
  if (!Array.isArray(urls) || urls.length < 1 || urls.length > LIMITES_APERCU.adresses) return refus(400, 'forme');
  if (urls.some((u) => typeof u !== 'string' || u.length > LIMITES_LECTURE.url)) return refus(400, 'forme');
  const entrees = urls.map((url) => { const v = valideAdresse(url, { hotesRefuses }); return { url, href: v.ok ? v.href : null }; });
  if (entrees.every((e) => e.href === null)) return refus(422, 'interdit');
  return { ok: true, corps: { entrees } };
}
```

  Dans `lireDemande`, après la l. 58 (`if (outil === 'lecture-web' || outil === 'image-web') return lireDemandeUrl(corps, { hotesRefuses });`) :

```js
  if (outil === 'apercu-web') return lireDemandeUrls(corps, { hotesRefuses });
```

  Rien d'autre ne change : `ligneJournal` admet `apercu-web` par `OUTILS` ; `OUTILS_MODELE` est inchangé. Contrôle : `node --test tools/assistant-logique.test.mjs`
  → vert (les cinq tests neufs, l. 44 et l. 234 amendées).

- [ ] **Step 6 : écrire `0007_apercu_web.sql` et sa preuve** (à la main, sur le gabarit de `0006`). `supabase/migrations/0007_apercu_web.sql` :

```sql
-- 0007 — le sixième outil de la passerelle, apercu-web (lot UI-2 « Aperçus des résultats web », spec 2026-10-23-experience-carnet § 6, D-UI-14).
-- Écrite à la main, comme 0004 et 0006 (hors du générateur et de --check). Le `check` de colonne du journal, tel que 0006 l'a laissé, ne connaît que
-- cinq outils : sans 0007, l'insert d'assistant_reserver('apercu-web') échoue en 23514, la réservation échoue, aucune ligne n'est écrite et la fonction
-- répond 502 à chaque demande d'aperçus — l'app montre alors les résultats sans image (comportement dégradé de D-UI-13, jamais une erreur bloquante).
-- DDL transactionnel : le drop et l'add tiennent dans UNE transaction, aucune fenêtre sans contrainte (un verrou de quelques millisecondes sur une petite
-- table). Rien d'autre ne change : ni table, ni fonction, ni privilège (la vue, assistant_reserver et les revoke de 0004 tiennent). La preuve 0006 devient
-- historique : rejouée après 0007, son 1.01 (cinq valeurs) rougit, c'est attendu.
begin;
alter table public.assistant_journal drop constraint assistant_journal_outil_check;
alter table public.assistant_journal add constraint assistant_journal_outil_check check (outil in ('recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web', 'apercu-web'));
commit;
```

  `supabase/proofs/0007_apercu_web.sql` (11 verdicts ; BILAN attendu `0 faux sur 11`, 12 lignes affichées) :

```sql
-- Preuve 0007 — spec du lot UI-2 (2026-10-23-experience-carnet § 6, D-UI-14). À coller dans l'éditeur SQL de Supabase APRÈS
-- `migrations/0007_apercu_web.sql` (étape 13 de `supabase/README.md`).
--
-- AUCUN jeton à remplacer et AUCUNE adresse à ajouter. Pour les verdicts 2.01 à 2.032 et 3.01, elle EMPRUNTE le compte le plus ancien de
-- `auth.users` — sans jamais le nommer ni l'afficher ; si `auth.users` est vide, ces verdicts sont sautés (« aucun compte : etape sautee »,
-- vert). Tout est annulé à la dernière instruction : rejouable telle quelle. La preuve 0006 est historique : son 1.01 (cinq valeurs) rougit après 0007.
--
-- Lis d'abord la ligne 999 « BILAN » (`ok = true` = aucun verdict faux). Au dialogue « Potential issue detected », choisis « Run without
-- RLS » (README, étape 5). Si une instruction échoue, l'éditeur annule tout et le message d'erreur est la seule sortie.

begin;

-- 0. Gardes de lecture : 0004 collée, et la contrainte au nom attendu (sinon, le message nomme les contraintes `check` réelles à relever).
do $$
declare v text;
begin
  if to_regclass('public.assistant_journal') is null then
    raise exception 'public.assistant_journal absente : colle d''abord 0004 (etape 10 du README), 0006 (etape 12), puis 0007';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.assistant_journal'::regclass and conname = 'assistant_journal_outil_check') then
    select string_agg(conname, ', ') into v from pg_constraint where conrelid = 'public.assistant_journal'::regclass and contype = 'c';
    raise exception 'contrainte assistant_journal_outil_check absente ; contraintes check presentes : %', coalesce(v, 'aucune');
  end if;
end $$;

create temporary table preuve (ordre numeric primary key, etape text, attendu text, obtenu text, ok boolean);

-- 1. LA CONTRAINTE ET CE QUI NE DOIT PAS AVOIR BOUGÉ.
insert into pg_temp.preuve
select 1.01, 'pg_get_constraintdef : les six outils, dans l ordre d OUTILS_0007', 'recherche-web < creation < extraction < lecture-web < image-web < apercu-web',
  case when a > 0 and b > a and c > b and d > c and e > d and f > e then 'dans l ordre' else 'positions ' || a || ' / ' || b || ' / ' || c || ' / ' || d || ' / ' || e || ' / ' || f end,
  a > 0 and b > a and c > b and d > c and e > d and f > e
from (select position('''recherche-web''' in x) as a, position('''creation''' in x) as b, position('''extraction''' in x) as c, position('''lecture-web''' in x) as d,
             position('''image-web''' in x) as e, position('''apercu-web''' in x) as f
      from (select pg_get_constraintdef(oid) as x from pg_constraint where conrelid = 'public.assistant_journal'::regclass and conname = 'assistant_journal_outil_check') t) u;
insert into pg_temp.preuve
select 1.02, 'une seule contrainte check sur assistant_journal', '1', count(*)::text, count(*) = 1
from pg_constraint where conrelid = 'public.assistant_journal'::regclass and contype = 'c';
insert into pg_temp.preuve
select 1.03, 'anon et authenticated : aucun privilege sur la table (inchange depuis 0004)', 'false / false', a::text || ' / ' || b::text, not a and not b
from (select has_table_privilege('anon', 'public.assistant_journal', 'select, insert, update, delete, truncate, references, trigger') as a,
             has_table_privilege('authenticated', 'public.assistant_journal', 'select, insert, update, delete, truncate, references, trigger') as b) t;
insert into pg_temp.preuve
select 1.04, 'service_role : select, insert, update sur la table', 'true / true / true', s::text || ' / ' || i::text || ' / ' || u::text, s and i and u
from (select has_table_privilege('service_role', 'public.assistant_journal', 'select') as s,
             has_table_privilege('service_role', 'public.assistant_journal', 'insert') as i,
             has_table_privilege('service_role', 'public.assistant_journal', 'update') as u) t;
insert into pg_temp.preuve
select 1.05, 'vue assistant_usage_jour toujours la, en security invoker', 'true', coalesce(v::text, 'absente'), coalesce(v, false)
from (select (select 'security_invoker=true' = any (reloptions) from pg_class
              where oid = to_regclass('public.assistant_usage_jour') and relkind = 'v') as v) t;

-- 2. LE SIXIÈME OUTIL, VU DE `postgres` (propriétaire de la table) : la ligne de journal, le refus d'un outil hors liste, puis assistant_reserver pour
-- lecture-web (2.03, comme 0006), image-web (2.031, 2.03 bis) et apercu-web (2.032, 2.03 ter). Compte emprunté jamais affiché ; lignes insérées au jour
-- 2000-01-01, les réservations sur le jour UTC courant, c RECOMPTÉ avant chacune (la précédente a écrit une ligne du jour) ; tout est annulé.
do $$
declare uid uuid; v text; c bigint; r bigint;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    insert into pg_temp.preuve values
      (2.01, 'sous postgres : une ligne de journal outil apercu-web est acceptee', 'acceptee', 'aucun compte : etape sautee', true),
      (2.02, 'un outil hors liste est toujours refuse par le check', '23514', 'aucun compte : etape sautee', true),
      (2.03, 'assistant_reserver accepte lecture-web : un id non nul', 'id non nul', 'aucun compte : etape sautee', true),
      (2.031, '2.03 bis : assistant_reserver(uid, ''image-web'', 1, c + 1) -> id non nul (la valeur du lot F)', 'id non nul', 'aucun compte : etape sautee', true),
      (2.032, '2.03 ter : assistant_reserver(uid, ''apercu-web'', 1, c + 1) -> id non nul (la valeur du lot UI-2)', 'id non nul', 'aucun compte : etape sautee', true),
      (3.01, 'les cinq anciens outils passent encore', 'acceptes', 'aucun compte : etape sautee', true);
    return;
  end if;
  begin
    insert into public.assistant_journal (owner_id, outil, statut, jour) values (uid, 'apercu-web', 200, date '2000-01-01');
    v := 'acceptee';
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.01, 'sous postgres : une ligne de journal outil apercu-web est acceptee', 'acceptee', v, v = 'acceptee');
  begin
    insert into public.assistant_journal (owner_id, outil, statut, jour) values (uid, 'inconnu', 200, date '2000-01-01');
    v := 'AUCUNE ERREUR : un outil hors liste a ete accepte';
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.02, 'un outil hors liste est toujours refuse par le check', '23514', v, v = '23514');
  -- 2.03, 2.03 bis, 2.03 ter : chaque appel dans un bloc exception — un refus du check (23514 : une 0007 collée sans apercu-web) devient un verdict rouge
  -- lisible au BILAN, au lieu d'annuler le collage entier sans rien afficher ; c recompté avant chaque appel (le quota c + 1 vaut pour lui seul).
  select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;
  begin
    r := public.assistant_reserver(uid, 'lecture-web', 1, c::integer + 1);
    v := case when r is null then 'null' else 'id non nul' end;
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.03, 'assistant_reserver accepte lecture-web : un id non nul', 'id non nul', v, v = 'id non nul');
  select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;
  begin
    r := public.assistant_reserver(uid, 'image-web', 1, c::integer + 1);
    v := case when r is null then 'null' else 'id non nul' end;
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.031, '2.03 bis : assistant_reserver(uid, ''image-web'', 1, c + 1) -> id non nul (la valeur du lot F)', 'id non nul', v, v = 'id non nul');
  select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;
  begin
    r := public.assistant_reserver(uid, 'apercu-web', 1, c::integer + 1);
    v := case when r is null then 'null' else 'id non nul' end;
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.032, '2.03 ter : assistant_reserver(uid, ''apercu-web'', 1, c + 1) -> id non nul (la valeur du lot UI-2)', 'id non nul', v, v = 'id non nul');
  begin
    insert into public.assistant_journal (owner_id, outil, statut, jour) values (uid, 'recherche-web', 200, date '2000-01-01'), (uid, 'creation', 200, date '2000-01-01'), (uid, 'extraction', 200, date '2000-01-01'), (uid, 'lecture-web', 200, date '2000-01-01'), (uid, 'image-web', 200, date '2000-01-01');
    v := 'acceptes';
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (3.01, 'les cinq anciens outils passent encore', 'acceptes', v, v = 'acceptes');
end $$;

-- BILAN : une seule ligne à lire.
insert into pg_temp.preuve
select 999, 'BILAN', 'aucun verdict faux',
  (select count(*) from pg_temp.preuve where ok is not true)::text || ' faux sur ' || (select count(*) from pg_temp.preuve)::text,
  (select count(*) from pg_temp.preuve where ok is not true) = 0;

select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;

-- Dernière instruction : tout est annulé.
rollback;
```

  Contrôle de SYNTAXE seulement (pglast v8.6, comme les lots B et F ; `python3 -I -c "import pglast"` dit s'il est là — ABSENT sur ce Mac au 23 octobre, `ModuleNotFoundError`, P-UI2-13 : le contrôle est alors SAUTÉ et dit tel quel dans `progress.md` et le rapport) : `parse_sql` sur les deux fichiers
  (`0007` : 4 instructions, dernière `commit` ; preuve : 12 instructions de premier niveau + 2 blocs `do`, dernière `rollback`) et `parse_plpgsql` sur les deux
  corps `do $$…$$` ; aucune erreur. Ce n'est PAS une exécution : la sémantique se prouve par le collage de Neegan (Clôture, gate de fusion). Contrôle Node :
  `node --test tools/generer-migrations.test.mjs` → « 0007 » et « preuve 0007 » verts (README, RESULTATS, générateur et « index.ts (UI-2) » encore rouges).

- [ ] **Step 7 : implémenter `index.ts`.** En-tête : après la l. 6, deux lignes :
  `// Lot UI-2 (spec 2026-10-23-experience-carnet § 6) : apercu-web — jusqu'à cinq adresses validées AVANT une réservation unique ; pour chaque adresse admise,`
  `// la page (telechargerPage), l'image par LA règle de F (lirePageHtml(...).page.image_url), l'image bornée à 1 Mio (telechargerImage, max) ; jamais le modèle.`
  Import (l. 8) : `import { LIMITES, LIMITES_APERCU, OUTILS, OUTILS_MODELE, PARALLELISME_APERCU, corpsErreur, corpsLectureModele, entetesCors, ligneJournal, lireDemande as lireDemandeJs, origineAdmise, statutRelaye } from './logique.js';`
  (une seule ligne d'import par module : le harnais remplace les trois imports par motif). `telechargerImage` (l. 164-178) : le commentaire gagne « ; `max` (lot UI-2)
  borne les octets lus — LIMITES_IMAGE.octets (2 Mio) par défaut pour image-web, LIMITES_APERCU.image (1 Mio) pour apercu-web » et la fonction devient :

```ts
async function telechargerImage(href: string, { signal, hotesRefuses: refuses, max = LIMITES_IMAGE.octets }: { signal: AbortSignal; hotesRefuses: string[]; max?: number }): Promise<ImageTelechargee | RefusPage> {
  const r = await suivreRedirections<{ octets: Uint8Array; type: string }>(href, { signal, hotesRefuses: refuses, accept: 'image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.1', lire: async (rep) => {
    const type = typeImageAdmis(rep.headers.get('content-type'));
    if (!type) { void rep.body?.cancel().catch(() => {}); return { erreur: 'pas_une_image', statut: 422 }; }
    const octets = await lireCorpsBorne(rep, max);
    if (octets === null) return { erreur: 'image_trop_lourde', statut: 413 };
    if (signatureImage(octets) !== type) return { erreur: 'pas_une_image', statut: 422 };
    return { ok: { octets, type } };
  } });
  if ('erreur' in r) return r;
  return { octets: r.valeur.octets, type: r.valeur.type, urlFinale: r.urlFinale };
}
```

  Dans `traiter`, juste APRÈS le bloc `image-web` (l. 261-266) et AVANT `if (corpsModele !== null) {` (l. 267) :

```ts
    if (outil === 'apercu-web') {
      // Lot UI-2 (spec § 6, I-UI-6) : la réservation est faite (UN appel du quota pour les cinq) ; lireDemande a déjà validé chaque adresse (href null = interdit)
      // et refusé 422 sans réservation si aucune ne passait. Budget serveur : un AbortController par appel (60 s), relayé à chaque suivreRedirections par apercuDe,
      // et levé par ctl (120 s, ou le client parti → 499). Dédoublonnage pour le TÉLÉCHARGEMENT seulement : une entrée par chaîne reçue, url = la chaîne (S-9).
      const budget = new AbortController();
      const minuterieBudget = setTimeout(() => budget.abort(), LIMITES_APERCU.budgetMs);
      const relaisBudget = () => budget.abort();
      if (ctl.signal.aborted) budget.abort(); else ctl.signal.addEventListener('abort', relaisBudget, { once: true });
      try {
        const entrees = (lu.corps as { entrees: Array<{ url: string; href: string | null }> }).entrees;
        const hrefs = [...new Set(entrees.map((e) => e.href).filter((h): h is string => h !== null))];
        const resultats = await enParallele(hrefs.map((h) => () => apercuDe(h, { signal: budget.signal, hotesRefuses: refuses })), PARALLELISME_APERCU);
        const parHref = new Map(hrefs.map((h, i) => [h, resultats[i]]));
        statut = 200; // usage reste null : jetons null au journal
        corpsReponse = JSON.stringify({ apercus: entrees.map((e) => { const a = e.href === null ? null : parHref.get(e.href); return { url: e.url, image: a?.image ?? null, raison: a ? a.raison : 'interdit' }; }) });
      } finally { clearTimeout(minuterieBudget); ctl.signal.removeEventListener('abort', relaisBudget); }
    }
```

  Après la fermeture de `traiter` (l. 287) et AVANT `Deno.serve` (l. 289) — **déclarées après `traiter`, exprès** : le test d'ordre N-1 (`ordreDuFlux`) épingle le
  flux par la PREMIÈRE occurrence de `await telechargerPage(`, `lirePageHtml(` et `await telechargerImage(` dans tout le fichier ; `apercuDe` porte les trois,
  elle doit donc venir après (les déclarations de fonction sont hoistées : aucun effet à l'exécution) :

```ts
// Lot UI-2 (spec § 6) : UNE adresse d'aperçu. La page par telechargerPage (bornes de lecture-web), l'adresse d'image par LA règle de F (lirePageHtml(...).page.image_url :
// Recipe lisible retenu, sinon og:image hors page de liste — aucune seconde copie, S-10), l'image par telechargerImage bornée à LIMITES_APERCU.image, encodée en
// base64 dès sa réception et ses octets lâchés (K-5). Ne lève jamais : une raison fermée par échec (RAISON_PAGE, RAISON_IMAGE ; `delai` quand le budget a levé
// `signal`, en vol ou avant de commencer). Déclarée APRÈS traiter : N-1 épingle l'ordre du flux par la première occurrence de chaque point d'appel.
type ImageApercu = { type: string; taille: number; octets: string };
type Apercu = { image: ImageApercu | null; raison: string | null };
const RAISON_PAGE: Record<string, string> = { inaccessible: 'inaccessible', interdit: 'interdit', pas_une_page: 'pas_de_recette', trop_lourde: 'inaccessible' };
const RAISON_IMAGE: Record<string, string> = { inaccessible: 'inaccessible', interdit: 'interdit', pas_une_image: 'pas_d_image', image_trop_lourde: 'image_trop_lourde' };
async function apercuDe(href: string, { signal, hotesRefuses: refuses }: { signal: AbortSignal; hotesRefuses: string[] }): Promise<Apercu> {
  if (signal.aborted) return { image: null, raison: 'delai' };
  try {
    const page = await telechargerPage(href, { signal, hotesRefuses: refuses });
    if ('erreur' in page) return { image: null, raison: RAISON_PAGE[page.erreur] ?? 'inaccessible' };
    const lue = lirePageHtml({ html: page.html, urlFinale: page.urlFinale, contentType: page.contentType, hotesRefuses: refuses });
    const adresse = lue.page.image_url;
    // pas_d_image : une Recipe lisible UNIQUE sans image ni og:image ; pas_de_recette : rien de lisible, ou une page de liste (og:image écartée par F).
    if (typeof adresse !== 'string') return { image: null, raison: lue.jsonld !== null && lue.jsonld.autres === 0 ? 'pas_d_image' : 'pas_de_recette' };
    const image = await telechargerImage(adresse, { signal, hotesRefuses: refuses, max: LIMITES_APERCU.image });
    if ('erreur' in image) return { image: null, raison: RAISON_IMAGE[image.erreur] ?? 'inaccessible' };
    return { image: { type: image.type, taille: image.octets.byteLength, octets: versBase64(image.octets) }, raison: null };
  } catch { return { image: null, raison: signal.aborted ? 'delai' : 'inaccessible' }; }
}
// Au plus `n` tâches à la fois (PARALLELISME_APERCU), lancées dans l'ordre ; chaque résultat garde l'index de sa tâche.
async function enParallele<T>(taches: Array<() => Promise<T>>, n: number): Promise<T[]> {
  const resultats: T[] = new Array(taches.length);
  let prochaine = 0;
  const ouvrier = async (): Promise<void> => { for (;;) { const i = prochaine; prochaine += 1; if (i >= taches.length) return; resultats[i] = await taches[i](); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, taches.length)) }, ouvrier));
  return resultats;
}
```

  Rien d'autre ne change dans `traiter` : le 499 (`req.signal.aborted` après le `try`), la mise à jour unique du journal, le `try/catch` global de `Deno.serve` ;
  `corpsModele` reste `null` pour `apercu-web` (`OUTILS_MODELE` ne le porte pas) : le modèle n'est jamais atteint, même pour une page sans JSON-LD (v4). Les
  sondes du générateur tiennent : une seule `redirect: 'manual'`, deux `await fetch(`, aucune `.text()` / `.json()` / `.arrayBuffer(`, une seule lecture
  d'`ANTHROPIC_API_KEY`. Contrôle : `node --test --test-timeout=10000 tools/assistant-index.test.mjs` → v1 à v9 verts, u1 à u12 et t1 à t13 inchangés ;
  `tsc` (commande du Step 0) → 0 — si `tsc` refuse `resultats[i] = …` ou le prédicat `(h): h is string`, c'est un constat de forme à corriger au plus près,
  jamais en relâchant `--strict`.

- [ ] **Step 8 : README (étape 13), RESULTATS-mitsu.md (deux sections « à jouer »), générateur (« la 0008 à venir »).**
  (1) `tools/generer-migrations.mjs`, deux commentaires JS (aucun effet sur le SQL rendu : `--check` reste 0) — l. 202 :
  `// Une migration À AJOUT SEUL (0003, 0005, la 0008 à venir — 0006 et 0007 sont écrites à la main, lots B et UI-2), d'un seul gabarit : les tables neuves (\`nouvelles\` : celles de \`stores\``
  (la suite de la ligne inchangée) ; l. 322 : `  // empreinte épinglée) et rendre le magasin suivant dans une 0008 (README, étape 11 ; 0006 et 0007 sont prises à la main, lots B et UI-2).`.
  (2) `supabase/README.md` — l. 3-4 : « quatre migrations générées (`0001`, `0002`, `0003`, `0005`) et trois écrites à la main (`0004`, `0006`, `0007`) » ;
  arbre, après la l. 22 (`proofs/0006_lecture_web.sql`) :
  `  migrations/0007_apercu_web.sql         écrite à la main, hors du générateur (lot UI-2 « aperçus des résultats web », étape 13)` et
  `  proofs/0007_apercu_web.sql             à coller après 0007 ; rien à remplacer ; n'écrit rien (rollback final)` ;
  puis, entre la fin de l'étape 12 (l. 382) et `## Où coller les sorties` (l. 384), le texte suivant (l'ordre des premières occurrences compte pour le test :
  `migrations/0007` → `proofs/0007` → la commande de déploiement → `S-A1` → `S-A5` → « fusion » → « `push` » ; ni « fusion » ni « `push` » avant le point 5) :

```markdown
### 13. Coller `0007_apercu_web.sql`, puis jouer sa preuve

Lot UI-2 « aperçus des résultats web » (spec `docs/superpowers/specs/2026-10-23-experience-carnet-design.md`, § 6 et D-UI-14) : la passerelle gagne
un sixième outil, `apercu-web`, sans modèle — pour les adresses des liens d'une recherche (cinq au plus), la fonction télécharge chaque page, en tire
l'adresse d'image par la règle du lot F (`Recipe` lisible, sinon `og:image`), télécharge l'image (1 Mio au plus) et rend une entrée par adresse ; un
appel du quota pour les cinq, zéro jeton. Le `check` de colonne du journal, tel que `0006` l'a laissé, ne connaît que cinq outils : **un code servi
avant `0007` : chaque demande d'aperçus répond 502 `serveur` (la réservation refuse l'outil) ; l'app montre les résultats sans image, rien d'autre ne
change.** `0007` est écrite à la main, comme `0004` et `0006` (hors du générateur et de `--check`), et ne touche qu'à cette contrainte : ni table, ni
fonction, ni privilège ; le `drop` et l'`add` tiennent dans une transaction (DDL transactionnel : aucune fenêtre sans contrainte). Après `0007`,
**la preuve `0006` devient historique** : rejouée, son 1.01 rougit (il attend cinq valeurs) — c'est attendu, pas un défaut.

1. **Coller `migrations/0007_apercu_web.sql`** en entier, sous `postgres` (un collage = une transaction). Attendu : `Success. No rows returned`. Si la
   contrainte porte un autre nom sur ce projet, le collage échoue sans rien appliquer : la garde 0 de la preuve nomme alors les contraintes `check`
   réelles, à relever avant de corriger. Relever l'empreinte du fichier collé : `shasum -a 256 supabase/migrations/0007_apercu_web.sql`.
2. Facultatif : `notify pgrst, 'reload schema';` collée seule — aucune table ni fonction neuve, le cache de PostgREST n'a rien à apprendre.
3. **Jouer `proofs/0007_apercu_web.sql`** (rien à remplacer, aucune adresse à ajouter ; « Run without RLS »). Lire la ligne `999 BILAN` : `0 faux sur 11`,
   c'est vert — dont 1.01 (les six outils, dans l'ordre d'`OUTILS_0007`) et 2.03 ter (`apercu-web` accepté par `assistant_reserver` ; les cinq anciens
   passent encore, 3.01).
4. **Consigner** la sortie dans `proofs/RESULTATS-mitsu.md`, section « Preuve `0007_apercu_web.sql` — à jouer » déjà préparée (tableau tel quel, empreinte).
5. **Ordre, sans exception** : `0007` → redéploiement de la fonction (geste du chef d'orchestre, la commande du point 2 de l'étape 10 :
   `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api`) → les sondes sans dépense : S-A1 (forme refusée,
   `urls: 'x'` → 400 `requete`, aucune ligne au journal), S-A2 (cinq adresses interdites → 422 `interdit`, aucune ligne), S-A3 (une admise et quatre
   interdites → 200 avec quatre `interdit` et UNE ligne `apercu-web` : un appel du quota, zéro jeton), S-A4 (sans jeton → 401 `non_connecte`), et les
   sondes S1-S9 du lot 4, S13-S19 du lot B, S-F1 à S-F3 du lot F et le `GET` d'état rejoués (leurs listes : `RESULTATS-mitsu.md`, sections « Passerelle
   `assistant` », « Sondes `lecture-web` » et « Sondes `image-web` » ; `lecture-web` et `image-web` doivent être reprouvés sur la version 5) → les sondes payantes, un appel du quota
   chacune et zéro jeton : S-A5 (les cinq adresses des liens de la recherche « puttanesca » → cinq images ou raisons, le compte d'`image_trop_lourde`
   — il décide si la borne passe de 1 à 2 Mio —, la durée totale et la taille réelle de la réponse), S-A6 (une page de liste → `pas_de_recette`),
   S-A7 (« cinq pages hostiles de 2 Mio » servies par un hôte public contrôlé par le contrôleur → 200 ou `delai` en moins de 60 s, jamais un 502
   d'isolat tué) → fusion → `push`. Les sondes se consignent dans la section « Sondes `apercu-web` » de `RESULTATS-mitsu.md`. S-A3 et S-A5 à S-A7
   passent la session et la liste admise : la session de Neegan est lue par le script d'attente du presse-papiers (fichier d'en-tête à mode 600,
   `curl -H @fichier`, fichier vidé dès les sondes finies) — jamais le jeton dans une commande, ni dans un fichier du dépôt ; S-A4 se joue sans jeton.
```

  (3) `supabase/proofs/RESULTATS-mitsu.md`, à la fin (après la dernière ligne de « Sondes `image-web` », l. 445 ; une ligne vide avant chaque titre ; le
  fichier finit par UNE fin de ligne) :

```markdown

## Preuve `0007_apercu_web.sql` — à jouer

Section préparée le 23 octobre 2026 (lot UI-2 « Aperçus des résultats web », spec `docs/superpowers/specs/2026-10-23-experience-carnet-design.md`
§ 6, D-UI-14 ; procédure : étape 13 du README). **À jouer par Neegan après `0006` (jouée le 23 octobre, ci-dessus), AVANT le redéploiement de la
fonction et AVANT que le code du lot UI-2 n'arrive sur le site public** : coller `migrations/0007_apercu_web.sql` en entier (attendu `Success. No rows
returned`), relever `shasum -a 256 supabase/migrations/0007_apercu_web.sql`, puis la preuve (« Run without RLS ») : lire `999 BILAN`, attendu
`0 faux sur 11` — dont 1.01 (les six outils, dans l'ordre d'`OUTILS_0007`) et 2.03 ter (`apercu-web` accepté par `assistant_reserver` ; les cinq anciens
passent encore, 3.01). Rien à remplacer, aucune adresse ; la preuve n'affiche aucun identifiant (compte emprunté jamais nommé) ; aucune clé en jeu.
Après `0007`, la preuve `0006` devient historique : rejouée, son 1.01 rougit (voulu).

| Heure | Collage | Résultat |
| --- | --- | --- |
| — | `migrations/0007_apercu_web.sql` | à jouer (attendu `Success. No rows returned`) |
| — | empreinte du `0007` collé : `shasum -a 256 supabase/migrations/0007_apercu_web.sql` | à relever (fichier du dépôt à la tête de la tâche 1) |
| — | `notify pgrst, 'reload schema';` (collée seule ; facultative selon l'étape 13) | — |
| — | preuve `0007` (« Run without RLS ») | à jouer : attendu `999 BILAN : 0 faux sur 11`, `ok` vrai sur les 12 lignes |

Tableau des verdicts (ordre, etape, attendu, obtenu, ok), à coller tel que rendu par l'éditeur SQL :

| ordre | etape | attendu | obtenu | ok |
| --- | --- | --- | --- | --- |
| à coller | | | | |

## Sondes `apercu-web` — à jouer (après `0007` et le redéploiement)

Lot UI-2 (spec § 6, « Sondes » ; étape 13, point 5 du README) : à jouer par le chef d'orchestre sur la version redéployée (version et `ezbr_sha256` à
consigner ici, comme pour les versions 1 à 4, section « Passerelle `assistant` »), après la `0007` collée et prouvée par Neegan, et après les tests Node
du serveur. S-A1, S-A2 et S-A4 ne dépensent rien (elles s'arrêtent avant la réservation : `assistant_usage_jour` inchangé) ; S-A3 et S-A5 à S-A7
coûtent un appel du quota chacune, **sans dépense** Anthropic : **zéro jeton** attendu (jetons `null` au journal). Les sondes S1-S9 du lot 4, S13-S19 du
lot B, S-F1 à S-F3 du lot F et le `GET` d'état sont rejouées au même redéploiement (les chemins `lecture-web` et `image-web` reprouvés sur la version 5).
Session : jeton copié depuis la console du site connecté par le script d'attente du presse-papiers vers un fichier d'en-tête à mode
600 (`curl -H @fichier`), fichier vidé dès les sondes finies — jamais le jeton dans une commande ; S-A4 se joue sans jeton.

| Sonde | Requête | Statut attendu | Statut obtenu | Ce que ça prouve |
| --- | --- | --- | --- | --- |
| S-A1 | `{ outil: 'apercu-web', corps: { urls: 'x' } }` | 400 `requete` | à jouer | forme refusée avant toute réservation (aucune ligne au journal) |
| S-A2 | `urls: ['http://exemple.test/', 'https://127.0.0.1/', 'https://localhost/', 'https://ybdooerfeziiabsbfxtb.supabase.co/', 'https://exemple.test:8443/']` | 422 `interdit` | à jouer | cinq adresses refusées par `valideAdresse` : 422 sans réservation, aucune ligne |
| S-A3 | une admise (la page Ricardo de S17) et les quatre premières de S-A2 | 200, `apercus[0]` avec `image` ou une raison, `apercus[1..4]` `{ image: null, raison: 'interdit' }` | à jouer | validation par adresse AVANT une réservation unique (I-UI-6) : UNE ligne `apercu-web` au journal, jetons `null` |
| S-A4 | sans jeton | 401 `non_connecte` | à jouer | la session d'abord |
| S-A5 | les cinq adresses des liens de la recherche « puttanesca » (relevées dans l'app) | 200 : cinq images ou raisons, en ≤ 60 s | à jouer | taille réelle de la réponse (K-5), durée totale, compte d'`image_trop_lourde` (décide si la borne passe de 1 à 2 Mio, B-M-6) |
| S-A6 | une page de liste (catégorie de recettes) | 200 : `pas_de_recette` | à jouer | la règle de F (page de liste : `og:image` écartée) vaut pour les aperçus |
| S-A7 | « cinq pages hostiles de 2 Mio » servies par un hôte public contrôlé par le contrôleur | 200 ou `delai` en moins de 60 s | à jouer | budget de 60 s et parallélisme 2 sous le vrai runtime (mémoire ≈ 20 Mio transitoires) : jamais un 502 d'isolat tué (S-2) |

Attendu dans `public.assistant_journal` (à lire par Neegan dans l'éditeur SQL) : une ligne `apercu-web` par sonde payante (S-A3, S-A5, S-A6, S-A7), statut 200,
jetons `null` ; `assistant_usage_jour` du jour : 4 appels de plus.
```

  Contrôle : `node --test tools/generer-migrations.test.mjs` → tout vert (« 0006 » préfixe, étape 12 « trois écrites », étape 13, RESULTATS, générateur, « lot F
  puis UI-2 », « index.ts (UI-2) ») ; `node tools/generer-migrations.mjs --check` → 0.

- [ ] **Step 9 : vert.** `node --test --test-timeout=10000 tools/*.test.mjs` : tout vert, compte relevé (attendu **227/227** : 208 + 5 logique + 9 index
  + 5 générateur ; la valeur lue fait foi) ; `node tools/generer-migrations.mjs --check` : **0** ; `tsc` (commande du Step 0) : **0** ; suite navigateur
  `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095` : `✅ 5948/5948`, épingle `tests/tests.js:250` = 5947 **inchangée** (aucun fichier de `src/`
  ni de `tests/` touché : l'épingle N−1 n'est pas relevée par cette tâche), seule erreur de console le 404 de `/favicon.ico`. **SHELL/VERSION : inchangés**
  (`APP_VERSION 0.15.0`, `sw.js cuisine-os-v0.15.0-9`, `DB_VERSION 4`, `SHELL` sans module neuf) : la tâche 2 porte `0.16.0`, `-1` et `./src/domain/apercu-web.js`.
  Bilans lus dans la sortie, consignés dans `progress.md`.

- [ ] **Step 10 : mutants de la tâche** (**jamais une mutation dans le worktree**. Copier l'arbre ENTIER, travail non commis compris :
  `rsync -a --exclude .git --exclude .superpowers /Users/neeganmac/projects/mistu-apercus/ <scratchpad>/mut-UI2-S1/base/` ; pour chaque mutant, une copie de
  `base/` (`rsync -a --delete <scratchpad>/mut-UI2-S1/base/ <scratchpad>/mut-UI2-S1/m<N>/`), la mutation écrite dans `m<N>/` par un script qui refuse tout
  chemin hors du scratchpad et exige une occurrence unique, puis `node --test --test-timeout=15000 tools/*.test.mjs` lancé DEPUIS `m<N>/` — les harnais y lisent
  la copie de `logique.js`, `lecture-web.js` et `index.ts` par leurs chemins relatifs ; les copies sont retirées par chemin littéral, une par commande, ou
  laissées nommées). Chacun doit rougir ; le test qui le tue est nommé ; la sortie lue est consignée dans le rapport. Les douze premiers ont été REJOUÉS
  par l'auteur du plan sur une copie assemblée des blocs de cette tâche (tests v seuls), avec les tueurs lus ci-dessous ; les suivants sont à jouer :
  `PARALLELISME_APERCU = 1` (v6, v7, v8) · budget à 120 000 (v7) · `url: e.href ?? e.url` dans la réponse (v2, v3) · `every` → `some` dans `lireDemandeUrls`
  (v2) · `max: LIMITES_IMAGE.octets` passé à `telechargerImage` par `apercuDe` (v4, v5) · dédoublonnage retiré (`hrefs` sans `Set`) (v3) · `signal` non relayé à
  `telechargerPage` (`new AbortController().signal`) (v7, v8) · `corpsModele` posé pour `apercu-web` (v2 à v7) · `lireDemandeUrls` sans `valideAdresse`
  (`href: url`) (v1, v2, v3) · `pas_de_recette` pour toute image absente (v4) · base64 tronqué (v2, v5) · relais `ctl` → `budget` retiré (v8, par expiration) ·
  puis : `apercuDe` déclarée AVANT `traiter` (« index.ts (UI-2) » et N-1 : `ordreDuFlux` non croissant) · `0007` à cinq valeurs (« 0007 ») · `and f > e` retiré
  de la preuve (« preuve 0007 ») · `OUTILS` sans `'apercu-web'` (tests logique l. 44, « lot F puis UI-2 », « 0007 », v1 à v9) · `LIMITES_APERCU.adresses = 6`
  (« lireDemande apercu-web : liste blanche », v1 « six ») · `max = LIMITES_APERCU.image` en défaut de `telechargerImage` (u5) · `telechargerImage` sans
  `max` (`LIMITES_IMAGE.octets` en dur) (v5) · réservation déplacée AVANT `lireDemande` dans `traiter` (N-1, v1 : réservation faite sur un 422).

- [ ] **Step 11 : invisibles et secrets** (Python `-I`, jamais `grep -P` : ce shell est ugrep) sur les ONZE fichiers touchés (trois du serveur, deux SQL
  neufs, README, RESULTATS, générateur, trois tests Node) : 0 caractère de Cc hors `\t` / `\n`, Cf, Cs, U+2028 / U+2029 ; 0 insécable littérale (U+00A0,
  U+202F) dans les lignes ajoutées ; aucun motif de clé (`sk-ant-`, `eyJ[A-Za-z0-9_-]{20,}`, `sb_secret_` hors `factice`, `AIza`, `service_role` hors les
  commentaires qui le nomment déjà) dans les lignes ajoutées ; `git diff --check` muet.

- [ ] **Step 12 : commit** (par chemins nommés : `git add` des onze fichiers, `git commit -- <fichiers>` ; message ASCII, sans accent ; trailer
  `Co-Authored-By` du modèle RÉEL de l'implémenteur, convention du dépôt — R-T1-3 —, par exemple `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`,
  plus la ligne `Claude-Session: …` quand le harnais la fournit ; jamais de réécriture d'historique) :

```
Serveur apercu-web : sixieme outil sans modele, cinq adresses validees avant une reservation unique, parallelisme 2, budget 60 s, images 1 Mio en base64 ; 0007 a la main et sa preuve, README etape 13, generateur 0008 (lot UI-2, tache S1)

logique.js : OUTILS a six (= OUTILS_0007, apercu-web dernier), LIMITES_APERCU { adresses 5, budgetMs 60000, image 1 Mio },
PARALLELISME_APERCU 2, lireDemandeUrls (liste blanche { urls }, 1 a 5 chaines de 2 048 au plus sinon 400 forme ; chaque adresse
validee par valideAdresse AVANT la reservation : href null = interdit, url = la chaine recue ; 422 interdit seulement si aucune admise).
index.ts : telechargerImage({ max }) (defaut LIMITES_IMAGE.octets, 2 Mio : image-web inchange) ; bloc apercu-web apres image-web :
un AbortController par appel (60 s) relaye a chaque suivreRedirections et leve par ctl (120 s, client parti → 499), enParallele a 2,
dedoublonnage pour le telechargement seulement, reponse { apercus: [{ url, image: { type, taille, octets } | null, raison }] } ;
apercuDe (page → lirePageHtml(...).page.image_url → telechargerImage a 1 Mio, base64 des reception, raisons fermees
interdit / inaccessible / pas_de_recette / pas_d_image / image_trop_lourde / delai) et enParallele declarees apres traiter (N-1).
0007_apercu_web.sql a la main (drop puis add de la contrainte a six valeurs, DDL transactionnel) et sa preuve (11 verdicts : 1.01 a six
valeurs, 2.03 ter apercu-web, les cinq anciens) ; README etape 13 (preuve 0006 historique) ; RESULTATS : sections Preuve 0007 et
Sondes apercu-web (S-A1 a S-A7) a jouer ; generateur : la 0008 a venir.
Tests Node : logique (OUTILS a six, LIMITES_APERCU, lireDemande apercu-web forme et validation par adresse, journal), index v1 a v9
(refus avant reservation, nominal, dedoublonnage, raisons par adresse, borne 1 Mio et cinq images sous 8 Mio, parallelisme 2, budget 60 s
en vol et jamais commencee, client parti 499, 0007 absente → 502 et quota → 429), generer-migrations (0007, preuve 0007, README 13,
RESULTATS, generateur 0008, OUTILS = OUTILS_0007, index.ts UI-2 ; 0006 redevient un prefixe).
Node 208 -> 227/227, --check 0, tsc 0, suite navigateur 5948/5948 inchangee (aucun src/) ; mutants : voir le rapport de tache.

Co-Authored-By: <modele reel de l implementeur> <noreply@anthropic.com>
```

---

### Task 2 : S2 client — `lireApercusWeb`, mur sans ré-encodage, vignettes et ligne d'état de l'onglet Web, versions 0.16.0

Spec § 9 tâche S2 ; D-UI-12, D-UI-13, I-UI-2, I-UI-5, I-UI-7 ; § 4.6 ; § 5 (lignes UI-2) ; § 6 « Client » ; § 7 (épingles UI-2, tests neufs
`tests/apercu-web.js`, mutants UI-2) ; § 12 : F-10, S-4 à S-7, S-12, S-15, S-16, K-1, H-7. Première tâche qui touche `src/` : `APP_VERSION 0.16.0`,
pins, `sw.js` `cuisine-os-v0.16.0-1`, `SHELL` + `./src/domain/apercu-web.js` (I-UI-7). Consomme la forme serveur de la spec § 6 (la tâche 1
l'implémente à l'identique) : demande `{ outil: 'apercu-web', corps: { urls } }`, réponse 200 `{ apercus: [{ url, image: { type, taille, octets } | null,
raison }] }`, `url` = la chaîne reçue. Aucun déploiement, aucun appel réel, aucun SQL.

**Files:**
- Modify: `src/core/image.js` (l. 97-110 à `f3672be` : le commentaire de `preparerPhotoDistante` et sa signature — option neuve `reencoder = true` ;
  `return reencoder ? reduireImage(blob) : blob`)
- Create: `src/domain/apercu-web.js` (≈ 60 lignes ; importe `passerelle.js`, `base64.js`, `../core/image.js`, `../sync/mime.js` ; aucun `t()`)
- Modify: `src/ui/search.js` (l. 2-16 imports ; l. 25-30 état du module — `apercus`, `volApercus`, `etatApercus`, `abandonnerApercus`,
  `elaguerApercus`, `reinitialiserWeb` ; l. 68 `deps` — `apercus: apercusFn` ; l. 185-205 `lancer()` et `annuler()` ; l. 234 texte de garde ;
  l. 239-299 `renderIssue` — `figureApercu`, `demanderApercus`, `ligneEtatApercus`, la carte avec la figure en tête, la ligne sous « Demande envoyée »)
- Modify: `src/i18n/en.js` (l. 273 retirée : « Une recherche = un appel à l’assistant… » ; quatre entrées neuves avant la l. 755 `};`)
- Modify: `sw.js` (l. 4 `VERSION = 'cuisine-os-v0.16.0-1'` ; l. 17 `SHELL` + `'./src/domain/apercu-web.js'` en tête de la ligne des modules
  `./src/domain/…`, avant `assistant-config.js` : ordre alphabétique)
- Modify: `src/model/schema.js` (l. 6 `APP_VERSION = '0.16.0'`)
- Create: `tests/apercu-web.js` (`export async function runApercuWebTests({ eq, ok })`) ; Modify: `tests/tests.js` (import après la l. 34
  `runPhotoPlatTests` ; appel entre le bloc du lot F, l. 238-240, et le bloc du thème, l. 242-244 ; épingle l. 250)
- Modify: `tests/recherche-web.js` (l. 553 texte de garde ; l. 1027 `forme` : INCHANGÉE (stricte, P-UI2-23) ; après l. 1033, première carte : une assertion
  « aucune `figure.apercu` sans `deps.apercus` » ; l. 1055 (même `forme`, rien à changer) ; après l. 1226 (« Garder et lire », que la spec cite « :1225 » :
  aucune figure sans `deps.apercus`) ; l. 1289 `CLES` ; l. 1291 clés retirées)
- Modify: `tests/photo-plat.js` (l. 1328 la déstructuration des sources, l. 1331 l'assertion I-F3 : + `src/ui/search.js` et `src/ui/library.js`, S-16 ; la
  l. 1330 est l'assertion `img-src` de la CSP, inchangée)
- Modify: `tests/ajouter.js` (l. 8 `MODULES_NEUFS` + `'../src/domain/apercu-web.js'`)
- Modify: les pins de version (13 assertions + 1 commentaire dans 8 suites, retrouvés par leur TEXTE : `tests/ajouter.js:3817, 3819` ;
  `tests/passerelle.js:765, 767` ; `tests/recherche-web.js:66 (commentaire), 69, 72` ; `tests/sync-l3.js:1867` ; `tests/sync-l4.js:514, 516, 3506,
  3507` ; `tests/assistant-compte.js:8` ; `tests/creer-ia.js:11` ; `tests/classement.js:2568`)
- Test: `tests/apercu-web.js` (neuf), `tests/recherche-web.js`, `tests/photo-plat.js`, `tests/ajouter.js` (amendés) ; la suite entière par
  `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095` ; `node --test tools/*.test.mjs` (la valeur lue à la tête — 227/227 si la tâche 1 est
  commise, 208/208 sinon —, inchangée par cette tâche : rien de Node ici) ; `node tools/generer-migrations.mjs --check` (0)

**Interfaces:**
- Consumes : `appelerAssistant(outil, corps, { fetch, session, config, signal, tentativeMs, corpsMax })`, `echecDomaine({ raison, quota, ecrite })`,
  `LIMITES_PASSERELLE`, `urlAssistant` (`src/domain/passerelle.js`) ; `lireOctetsBase64(texte, taille)` (`src/domain/base64.js`) ;
  `COTE_MIN_DISTANT`, `preparerPhotoDistante`, `dimensionsImage`, `ErreurImage`, `LIMITES_COUVERTURE` (`src/core/image.js`) ; `COVER_INPUT_MIME`
  (`src/sync/mime.js`) ; `urlDeBlob`, `revoquerUrlDeBlob`, `revoquerUrlsDeBlob` (`src/core/blob-urls.js`) ; `remplacerEnRevoquant`,
  `sessionAssistant`, `section` (`src/ui/components.js`) ; `lienSignet` (`src/core/lien.js`) ; `memoire`, `vol`, `vues`, `notifier`, `renderIssue`,
  `lancer`, `annuler` (`src/ui/search.js`, lot web) ; la forme serveur de la spec § 6 (tâche 1).
- Produces :

```js
// src/core/image.js
export async function preparerPhotoDistante(blob, { coteMin = COTE_MIN_DISTANT, reencoder = true } = {})
  // → Blob : le JPEG ré-encodé (reencoder vrai, inchangé) ou LE MÊME Blob, contrôlé (reencoder faux : aucun createImageBitmap) ;
  //   lève ErreurImage('indecodable' | 'trop_lourde' | 'type' | 'trop_petite' | 'trop_grande') — les mêmes murs dans les deux cas
// src/domain/apercu-web.js
export const LIMITES_APERCU_WEB = Object.freeze({ adresses: 5, url: 2048, octets: 1048576, corpsReponse: 8388608, tentativeMs: 135000, types: COVER_INPUT_MIME });
export const RAISONS_ENTREE_APERCU = Object.freeze(['interdit', 'inaccessible', 'pas_de_recette', 'pas_d_image', 'image_trop_lourde', 'delai', 'illisible', 'image_refusee']);
export const RAISONS_ECHEC_APERCU = Object.freeze(['adresse', 'non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit']);
export async function lireApercusWeb({ urls, session } = {}, { fetch, signal, tentativeMs = 135000, corpsMax = 8388608, config } = {})
  // → { etat: 'recus', apercus: Map(url → { blob, type } | { raison ∈ RAISONS_ENTREE_APERCU }) } — UNE clé par adresse DEMANDÉE, dans l'ordre
  //   | { etat: 'echec', raison ∈ RAISONS_ECHEC_APERCU, extra } ; ne lève jamais ; le jeton n'entre dans aucun objet rendu
// src/ui/search.js
renderSearch(params, query, ctx, deps)   // deps.apercus (défaut lireApercusWeb ; null quand deps.chercher est injecté sans deps.apercus : aucun aperçu demandé)
export function etatApercus()            // tests : { hrefs: [...clés de la Map], blobs: n, enVol: [...hrefs du vol] | null }
export function reinitialiserWeb()       // tests : abandonne aussi le vol d'aperçus et vide la Map
// DOM (onglet Web, issue « trouvé ») : div.card.flat.stack > [figure.apercu > img.plat-vignette.grande[alt='']]? , a.btn, … (figure en TÊTE, quand l'image est là)
//   p.muted[data-role=etat-apercus] juste après div.muted « Demande envoyée : {q} » : « Photos en cours de récupération… » | « Photos indisponibles pour cette
//   recherche. » | « Quota du jour atteint : photos indisponibles. » ; absente dès qu'une image est posée, ou tant que rien n'a été demandé
// src/i18n/en.js : + « Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour. », « Photos en cours de récupération… »,
//   « Photos indisponibles pour cette recherche. », « Quota du jour atteint : photos indisponibles. » ; − « Une recherche = un appel à l’assistant, compté dans ton quota du jour. »
// src/model/schema.js : APP_VERSION = '0.16.0' ; sw.js : VERSION = 'cuisine-os-v0.16.0-1', SHELL + './src/domain/apercu-web.js'
```

- [ ] **Step 0 : relire le code réel** à la tête du lot (`f3672be` = `main 05c751f` + trois commits de docs ; les numéros ci-dessous y valent ; une
  dérive n'est pas un constat, un nom absent en est un — R-C-7). `src/ui/search.js` : l. 25-30 (`memoire`, `vol`, `vues`, `etatWeb`, `reinitialiserWeb`,
  `notifier`) ; l. 66-68 (`renderSearch`, la déstructuration de `deps` : `chercher = chercherRecettesWeb`) ; l. 113-115 (`render()`,
  `remplacerEnRevoquant(results)`) ; l. 185-205 (`lancer`, `annuler`) ; l. 214-236 (`renderWeb`, texte de garde l. 234) ; l. 239-299 (`renderIssue` :
  `carte` l. 259-277 — `el('div', { class: 'card flat stack' }, a.btn, div.muted, …)` —, `cartes`/`autres` l. 278-279, R-WEB-3 l. 281, la section l. 283-298 avec
  `el('div', { class: 'muted' }, t('Demande envoyée : {q}', …))` l. 284). `src/core/image.js` l. 97-110 (`COTE_MIN_DISTANT`, `preparerPhotoDistante`).
  `src/domain/photo-web.js` l. 56-74 (`lireImageWeb` : le gabarit — déstructuration DANS le try, `lu(k)` par `Object.hasOwn`, `lireOctetsBase64`,
  `echecDomaine`). `src/core/blob-urls.js` (`urlDeBlob`, `revoquerUrlDeBlob`, `revoquerUrlsDeBlob` : app.js l. 80 révoque tout à chaque route).
  `src/ui/components.js` l. 176-185 (`urlsDesVignettes` ne relève que `img.plat-vignette` : la figure GARDE cette classe), l. 337-345 (`sessionAssistant`),
  l. 265-271 (`select` : `onChange(e.target.value)` — le redessin sans tape des tests de l'écran passe par le `change` du « + type »). `tests/tests.js`
  l. 34 (dernier import), l. 238-244 (blocs F puis thème), l. 250 (épingle 5947). `tests/recherche-web.js` l. 553, 1027 (`forme`), 1033, 1055,
  1223-1226, 1289, 1291 ; `tests/photo-plat.js` l. 1327-1330 ; `tests/ajouter.js` l. 8. Relevé des pins (depuis la racine du worktree) :

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

  Attendu : 15 lignes (P-UI2-15 : 13 assertions, le commentaire de `tests/recherche-web.js:66` et la ligne `const v` de `tests/sync-l4.js:3506` — `tests/ajouter.js:3817, 3819` ; `tests/assistant-compte.js:8` ; `tests/classement.js:2568` ; `tests/creer-ia.js:11` ;
  `tests/passerelle.js:765, 767` ; `tests/recherche-web.js:66, 69, 72` ; `tests/sync-l3.js:1867` ; `tests/sync-l4.js:514, 516, 3506, 3507`) ; une 16e
  ligne serait un pin que la spec n'a pas relevé : l'amender aussi et le dire au rapport. Mesure de départ (registre `progress.md`, 23 oct. 19 h 40) :
  suite `✅ 5948/5948`, épingle 5947, Node 208/208, `--check` 0, `sw.js cuisine-os-v0.15.0-9`.

- [ ] **Step 1 : tests rouges — `tests/apercu-web.js` (neuf), blocs du DOMAINE** (`lireApercusWeb`, mur sans ré-encodage, table serveur → client) :

```js
// Tests du lot UI-2 « Aperçus des résultats web » (spec docs/superpowers/specs/2026-10-23-experience-carnet-design.md, § 4.6, § 6, § 7 UI-2).
// Domaine (lireApercusWeb, preparerPhotoDistante sans ré-encodage) sur des réponses fixes et un fetch factice ; écran (search.js) à gestes injectés,
// chercher ET apercus factices ; aucun réseau ; aucune base ; jamais le navigateur partagé. Les images sont fabriquées par canvas (imageTest de
// tests/photo-plat.js, recopié : des Blob, pas des File). Un caractère hostile est construit par String.fromCodePoint, jamais écrit en littéral.
export async function runApercuWebTests({ eq, ok }) {
  const run = async (name, test) => {
    try { await test(); }
    catch (error) { ok(false, `Aperçus web — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };
  const vraiFetch = globalThis.fetch; // relevé AVANT le mur du réseau (ci-dessous) : `lire` lit les sources par lui
  const lire = async (chemin) => { const r = await vraiFetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
  const localeAvant = getUiLocale();
  setUiLocale('fr'); // des textes français sont affirmés
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
  // Une image de test : un aplat et un coin clair ; PNG (sans perte : les octets rendus se comparent aux octets reçus) ou JPEG ; un Blob typé.
  const imageTest = async (couleur, l, h, type = 'image/png') => {
    const toile = new OffscreenCanvas(l, h); const cx = toile.getContext('2d');
    cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); cx.fillStyle = '#fff'; cx.fillRect(0, 0, Math.max(1, l >> 2), Math.max(1, h >> 2));
    return toile.convertToBlob(type === 'image/png' ? { type } : { type, quality: 0.9 });
  };
  const octetsDe = async (blob) => new Uint8Array(await blob.arrayBuffer());
  // Le base64 que la fonction rend (un seul btoa sur la chaîne binaire entière : jamais par tranches non multiples de 3).
  const base64De = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
  // Les deux formes d'une entrée de la réponse (spec § 6) : avec image (raison nulle), sans image (raison écrite par la fonction).
  const entreeImage = (url, u8, type = 'image/png') => ({ url, image: { type, taille: u8.length, octets: base64De(u8) }, raison: null });
  const entreeRefus = (url, raison) => ({ url, image: null, raison });
  const SESSION = { access_token: 'jeton-apercus-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
  const U = (i) => `https://r${i}.test/recette`;
  const CINQ = [0, 1, 2, 3, 4].map(U);
  // Le jeton n'est dans aucun champ TEXTE d'un résultat : etat, raison, extra, et pour une Map ses clés et ses raisons (un Blob ne porte pas de texte lisible
  // par JSON.stringify — il rend `{}` — : la garde ne prétend pas le fouiller).
  const sansJeton = (x) => !JSON.stringify(x instanceof Map ? [...x].map(([k, v]) => [k, v?.blob instanceof Blob ? 'blob' : v]) : x ?? null).includes('jeton-apercus-sentinelle');
  // Un en-tête PNG de l × h pixels (33 octets : signature, IHDR) — assez pour dimensionsImage, jamais décodable.
  const tetePng = (l, h) => { const t = new Uint8Array(33); t.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const dv = new DataView(t.buffer); dv.setUint32(16, l); dv.setUint32(20, h); return t; };
  try {
    // (en tête du try : le mur du fetch et les fixtures de l'écran — second extrait de ce Step —, puis ces blocs du domaine, puis ceux de l'écran, Step 2)
    // ===== Domaine (spec § 6 « Client », H-7, S-12)
    await run('LIMITES_APERCU_WEB et listes fermées (§ 6)', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const { COVER_INPUT_MIME } = await import('../src/sync/mime.js');
      const { LIMITES_PASSERELLE } = await import('../src/domain/passerelle.js');
      const { LIMITES_COUVERTURE } = await import('../src/core/image.js');
      ok(Object.isFrozen(A.LIMITES_APERCU_WEB) && Object.isFrozen(A.RAISONS_ENTREE_APERCU) && Object.isFrozen(A.RAISONS_ECHEC_APERCU), 'LIMITES_APERCU_WEB, RAISONS_ENTREE_APERCU, RAISONS_ECHEC_APERCU : gelées');
      eq([A.LIMITES_APERCU_WEB.adresses, A.LIMITES_APERCU_WEB.url, A.LIMITES_APERCU_WEB.octets, A.LIMITES_APERCU_WEB.corpsReponse, A.LIMITES_APERCU_WEB.tentativeMs, A.LIMITES_APERCU_WEB.types === COVER_INPUT_MIME],
        [5, 2048, 1024 * 1024, 8 * 1024 * 1024, 135000, true], 'LIMITES_APERCU_WEB : 5 adresses de 2 048 points, 1 Mio par image (le max du serveur), réponse ≤ 8 Mio, 135 s, les types des couvertures');
      eq(A.LIMITES_APERCU_WEB.tentativeMs, LIMITES_PASSERELLE.tentativeMs, 'tentativeMs = le délai de la passerelle (135 s), au-dessus du budget serveur de 60 s');
      ok(A.LIMITES_APERCU_WEB.corpsReponse >= 5 * 4 * Math.ceil(A.LIMITES_APERCU_WEB.octets / 3) + 4096, 'corpsReponse ≥ le base64 de cinq images à la borne + 4 Kio d’enveloppe');
      ok(A.LIMITES_APERCU_WEB.octets <= LIMITES_COUVERTURE.octetsDistants, 'LIMITES_APERCU_WEB.octets ≤ le mur commun des images distantes (5 Mio)');
      eq([[...A.RAISONS_ENTREE_APERCU], [...A.RAISONS_ECHEC_APERCU]], [['interdit', 'inaccessible', 'pas_de_recette', 'pas_d_image', 'image_trop_lourde', 'delai', 'illisible', 'image_refusee'],
        ['adresse', 'non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit']], 'raisons : les six du serveur + illisible, image_refusee par entrée ; les raisons de la passerelle par appel');
    });

    await run('lireApercusWeb : l’appel (§ 6, I-UI-2)', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const P = await import('../src/domain/passerelle.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const png = await octetsDe(await imageTest('#3a7', 320, 240));
      const appels = [];
      const f = (statut, corps) => async (url, options) => { appels.push({ url, options }); return reponse(statut, corps); };
      const corps200 = { apercus: [entreeImage(U(0), png), entreeRefus(U(1), 'pas_d_image'), entreeRefus(U(2), 'inaccessible'), entreeImage(U(3), png), entreeRefus(U(4), 'interdit')] };
      const delais = []; const vraiTimeout = AbortSignal.timeout;
      AbortSignal.timeout = (ms) => { delais.push(ms); return vraiTimeout.call(AbortSignal, ms); };
      const vraiBitmap = globalThis.createImageBitmap; let decodes = 0;
      globalThis.createImageBitmap = (...a) => { decodes += 1; return vraiBitmap.call(globalThis, ...a); };
      let r;
      try { r = await A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: f(200, corps200), config: SUPABASE.prod }); }
      finally { AbortSignal.timeout = vraiTimeout; globalThis.createImageBitmap = vraiBitmap; }
      const a = appels[0];
      eq([appels.length, a.url, JSON.parse(a.options.body), Object.keys(a.options.headers).sort(), a.options.redirect, a.options.credentials],
        [1, P.urlAssistant(SUPABASE.prod), { outil: 'apercu-web', corps: { urls: CINQ } }, ['apikey', 'authorization', 'content-type'], 'error', 'omit'],
        'lireApercusWeb : UN POST { outil: apercu-web, corps: { urls } } exact vers la fonction assistant (cinq adresses, dans l’ordre), trois en-têtes, redirect error, credentials omit');
      eq(delais.includes(135000), true, 'lireApercusWeb : tentativeMs passé à la passerelle = 135 000');
      eq([r.etat, r.apercus instanceof Map, [...r.apercus.keys()]], ['recus', true, CINQ], 'lireApercusWeb : { etat: recus, apercus: Map } avec UNE clé par adresse demandée, dans l’ordre de la demande');
      const a0 = r.apercus.get(U(0));
      eq([a0.type, a0.blob?.type, a0.blob?.size, [...(await octetsDe(a0.blob))].every((o, i) => o === png[i]), decodes], ['image/png', 'image/png', png.length, true, 0],
        'blob par adresse : une PNG 320 × 240 → { blob, type } du bon type, aux octets REÇUS (pas de ré-encodage : createImageBitmap jamais appelé — H-7)');
      eq([r.apercus.get(U(1)), r.apercus.get(U(2)), r.apercus.get(U(4)), r.apercus.get(U(3)).blob instanceof Blob], [{ raison: 'pas_d_image' }, { raison: 'inaccessible' }, { raison: 'interdit' }, true],
        'blob par adresse : chaque adresse sans image garde SA raison ; une image refusée pour une adresse ne prive pas les autres (I-UI-6)');
      appels.length = 0;
      const sansSession = await A.lireApercusWeb({ urls: CINQ, session: null }, { fetch: f(200, corps200), config: SUPABASE.prod });
      const ctl = new AbortController(); ctl.abort();
      const annule = await A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: f(200, corps200), config: SUPABASE.prod, signal: ctl.signal });
      const formes = [];
      for (const urls of [[], [...CINQ, U(5)], [U(0), 7], [U(0), ''], ['x'.repeat(2049)], null, 'https://a.test/']) formes.push((await A.lireApercusWeb({ urls, session: SESSION }, { fetch: f(200, corps200), config: SUPABASE.prod })).raison);
      eq([sansSession.etat, sansSession.raison, annule.raison, formes, appels.length], ['echec', 'non_connecte', 'annule', ['adresse', 'adresse', 'adresse', 'adresse', 'adresse', 'adresse', 'adresse'], 0],
        'lireApercusWeb : sans session → non_connecte ; signal levé → annule ; zéro, six, une non-chaîne, une vide, 2 049 points, null, une chaîne nue → adresse ; zéro fetch dans tous les cas');
      const nul = await A.lireApercusWeb(null, null);
      eq([nul.etat, nul.raison], ['echec', 'adresse'], 'lireApercusWeb(null, null) : un échec, jamais un rejet');
      ok([r, sansSession, annule, nul].every(sansJeton) && sansJeton(r.apercus), 'lireApercusWeb : le jeton n’est dans aucun champ texte des résultats (etat, raison, extra ; clés et raisons de la Map)');
    });

    await run('lireApercusWeb : corpsMax 8 Mio, le 200 est une donnée hostile (S-12, I-UI-5)', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const P = await import('../src/domain/passerelle.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const lu = async (corps) => A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: async () => reponse(200, corps), config: SUPABASE.prod });
      // Cinq « images » de 1 Mio pile (la borne) : ≈ 7 Mio de JSON, au-delà des 2 Mio par défaut de la passerelle — le corps est LU en entier, chaque entrée
      // décodée (atob × 5) puis refusée par le mur (FF D8 FF 00 : un en-tête que libjpeg ne lirait pas → image_refusee), jamais `reponse_illisible`.
      // BORNE en LITTÉRAL, jamais lue dans le module : sous le mutant « LIMITES_APERCU_WEB.octets remis à 2 Mio », TROP (1 048 577) passerait la borne mutée,
      // atob serait appelé et « image_trop_lourde AVANT tout décodage » rougirait à la lettre (le test des constantes le tue aussi).
      const BORNE = 1024 * 1024;
      eq(A.LIMITES_APERCU_WEB.octets, BORNE, 'la borne client vaut 1 Mio, le littéral de ce bloc (P-UI2-4 : miroir du max serveur)');
      const grosse = new Uint8Array(BORNE); grosse.set([0xff, 0xd8, 0xff]);
      const b64Grosse = base64De(grosse);
      const corpsGros = { apercus: CINQ.map((u) => ({ url: u, image: { type: 'image/jpeg', taille: BORNE, octets: b64Grosse }, raison: null })) };
      ok(JSON.stringify(corpsGros).length > 3 * P.LIMITES_PASSERELLE.corps, 'fixture : cinq images à la borne font plus de 6 Mio de JSON (le mutant « corpsMax omis ou 2 Mio » les refuse)');
      const vraiAtob = globalThis.atob; let atobs = 0;
      globalThis.atob = (s) => { atobs += 1; return vraiAtob(s); };
      let gros;
      try { gros = await lu(corpsGros); } finally { globalThis.atob = vraiAtob; }
      eq([gros.etat, [...gros.apercus.values()], atobs], ['recus', CINQ.map(() => ({ raison: 'image_refusee' })), 5], 'corpsMax : ≈ 7 Mio de JSON sont lus ; cinq entrées décodées (atob × 5) et refusées par le mur → image_refusee chacune');
      // La borne AVANT tout décodage : 1 Mio + 1 avec un base64 de la BONNE longueur — un mutant « décoder puis borner » appellerait atob.
      const TROP = BORNE + 1; atobs = 0;
      globalThis.atob = (s) => { atobs += 1; return vraiAtob(s); };
      let trop;
      try { trop = await lu({ apercus: [{ url: U(0), image: { type: 'image/jpeg', taille: TROP, octets: 'A'.repeat(4 * Math.ceil(TROP / 3)) }, raison: null }] }); } finally { globalThis.atob = vraiAtob; }
      eq([trop.apercus.get(U(0)), atobs], [{ raison: 'image_trop_lourde' }, 0], 'hostile : taille 1 048 577 (base64 de la bonne longueur) → image_trop_lourde AVANT tout décodage (atob jamais appelé)');
      const png = await octetsDe(await imageTest('#a52', 320, 240));
      const formes = await lu({ apercus: [
        { url: U(0), image: { type: 'image/gif', taille: png.length, octets: base64De(png) }, raison: null },   // type hors liste
        { url: U(1), image: { type: 'image/png', taille: 0, octets: '' }, raison: null },                         // taille 0
        { url: U(2), image: { type: 'image/png', taille: png.length, octets: '@@' }, raison: null },              // alphabet hors base64
        { url: U(3), image: { taille: png.length, octets: base64De(png) }, raison: null },                        // sans champ type
        { url: U(4), image: null, raison: 'constructor' },                                                        // raison hors liste (héritée)
        { url: 'https://inconnue.test/', image: { type: 'image/png', taille: png.length, octets: base64De(png) }, raison: null }, // adresse non demandée
      ] });
      eq([[...formes.apercus.entries()], formes.apercus.has('https://inconnue.test/')], [[[U(0), { raison: 'illisible' }], [U(1), { raison: 'illisible' }], [U(2), { raison: 'illisible' }], [U(3), { raison: 'illisible' }], [U(4), { raison: 'illisible' }]], false],
        'hostile : type hors liste, taille 0, alphabet hors base64, champ type absent, raison hors liste → illisible ; une adresse NON demandée est ignorée');
      const manquantes = await lu({ apercus: [entreeImage(U(1), png), entreeImage(U(1), tetePng(300, 300)), entreeRefus(U(3), 'delai')] });
      eq([[...manquantes.apercus.keys()], manquantes.apercus.get(U(0)), manquantes.apercus.get(U(1)).blob?.size, manquantes.apercus.get(U(3)), manquantes.apercus.get(U(4))],
        [CINQ, { raison: 'illisible' }, png.length, { raison: 'delai' }, { raison: 'illisible' }], 'hostile : une adresse demandée ABSENTE de la réponse vaut illisible (jamais redemandée en boucle) ; une adresse en double → la première entrée gagne ; `delai` relayé');
      const menteur = await lu({ apercus: [entreeImage(U(0), png, 'image/jpeg'), entreeImage(U(1), tetePng(20000, 20000)), entreeImage(U(2), (await octetsDe(await imageTest('#3a7', 199, 600))))] });
      eq([menteur.apercus.get(U(0)), menteur.apercus.get(U(1)), menteur.apercus.get(U(2))], [{ raison: 'image_refusee' }, { raison: 'image_refusee' }, { raison: 'image_refusee' }],
        'hostile : octets PNG annoncés image/jpeg (en-tête menteur), 20 000 × 20 000 (400 Mpx), petit côté 199 → image_refusee (LE mur de F, I-UI-2)');
      for (const corps of [{}, { apercus: {} }, { apercus: 'x' }, []]) eq((await lu(corps)).raison, 'reponse_illisible', `hostile : un 200 sans tableau apercus (${JSON.stringify(corps)}) → reponse_illisible`);
      ok([gros, trop, formes, manquantes, menteur].every((x) => sansJeton(x) && sansJeton(x.apercus)), 'le jeton n’est dans aucun champ texte des résultats (clés et raisons des Map comprises)');
    });

    await run('mur sans ré-encodage : preparerPhotoDistante({ reencoder: false }) (H-7, I-UI-2)', async () => {
      const IM = await import('../src/core/image.js');
      const code = async (p) => { try { await p; return 'ok'; } catch (e) { return e?.code ?? 'autre:' + (e?.message || ''); } };
      const png = await imageTest('#3a7', 320, 240);
      const jpeg = await imageTest('#a52', 600, 400, 'image/jpeg');
      const vrai = globalThis.createImageBitmap; let decodes = 0;
      globalThis.createImageBitmap = (...a) => { decodes += 1; return vrai.call(globalThis, ...a); };
      try {
        const sortiePng = await IM.preparerPhotoDistante(png, { coteMin: IM.COTE_MIN_DISTANT, reencoder: false });
        const sortieJpeg = await IM.preparerPhotoDistante(jpeg, { reencoder: false });
        eq([sortiePng === png, sortieJpeg === jpeg, decodes], [true, true, 0], 'reencoder: false → LE MÊME Blob est rendu (PNG et JPEG), sans aucun createImageBitmap');
        eq([await code(IM.preparerPhotoDistante(new Blob([png], { type: 'image/jpeg' }), { reencoder: false })), decodes], ['indecodable', 0], 'reencoder: false : octets PNG annoncés image/jpeg → indecodable (l’en-tête dit un autre type), sans décodage');
        eq([await code(IM.preparerPhotoDistante(new Blob([tetePng(20000, 20000)], { type: 'image/png' }), { reencoder: false })), decodes], ['trop_grande', 0], 'reencoder: false : en-tête 20 000 × 20 000 (400 Mpx) → trop_grande AVANT décodage');
        eq([await code(IM.preparerPhotoDistante(await imageTest('#a52', 199, 600), { reencoder: false })), await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(10)], { type: 'image/heic' }), { reencoder: false })), await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }), { reencoder: false })), decodes],
          ['trop_petite', 'type', 'trop_lourde', 0], 'reencoder: false : petit côté 199 → trop_petite ; image/heic → type ; 5 Mio + 1 → trop_lourde — les mêmes murs, sans décodage');
        const reencode = await IM.preparerPhotoDistante(png);
        eq([reencode !== png, reencode.type, decodes >= 1], [true, 'image/jpeg', true], 'défaut (reencoder vrai) inchangé : la PNG est ré-encodée en JPEG par le canvas (lot F)');
      } finally { globalThis.createImageBitmap = vrai; }
    });

    await run('table serveur → client : les échecs de l’appel entier', async () => {
      const A = await import('../src/domain/apercu-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const table = [[429, { erreur: 'quota', quota: 60 }, 'quota', { quota: 60 }], [429, { type: 'error' }, 'trop_de_demandes', {}], [422, { erreur: 'interdit' }, 'interdit', {}], [400, { erreur: 'requete' }, 'requete', {}],
        [401, { erreur: 'non_connecte' }, 'non_connecte', {}], [403, { erreur: 'non_admis' }, 'non_admis', {}], [413, { erreur: 'trop_lourd' }, 'requete', { trop_lourd: true }], [502, { erreur: 'serveur' }, 'serveur', {}], [504, { erreur: 'delai' }, 'delai', {}]];
      const obtenus = [];
      for (const [statut, corps] of table) { const x = await A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: async () => reponse(statut, corps), config: SUPABASE.prod }); obtenus.push([x.etat, x.raison, x.extra]); }
      eq(obtenus, table.map(([, , raison, extra]) => ['echec', raison, extra]), 'table serveur → client : quota 60 (écrit) ; 429 sans champ → trop_de_demandes ; 422 interdit (aucune adresse admise) ; 400 requete (forme refusée, P-UI2-21) → requete ; 401 ; 403 non_admis ; 413 → requete + trop_lourd ; 502 serveur ; 504 delai');
      ok(obtenus.every(([, raison]) => A.RAISONS_ECHEC_APERCU.includes(raison)), 'toute raison d’échec rendue ∈ RAISONS_ECHEC_APERCU');
      const reseau = await A.lireApercusWeb({ urls: CINQ, session: SESSION }, { fetch: async () => { throw new TypeError('Failed to fetch'); }, config: SUPABASE.prod });
      eq([reseau.etat, reseau.raison], ['echec', 'reseau'], 'un fetch qui rejette → reseau, jamais une levée');
    });
```

  Au-dessus du `try` (après `tetePng`), les repères partagés par les blocs de l'ÉCRAN (Step 2) : des fermetures sur des variables déclarées `let` ici et
  ASSIGNÉES en tête du `try` (le mur du `fetch`, la scène, les modules, l'image : si l'une de ces fixtures lève — `OffscreenCanvas`, un `import()` —, le
  `finally` remet `fetch` et la suite ne rougit pas en cascade) ; le `finally` de la fonction remet tout en place :

```js
  // ===== Écran : src/ui/search.js (spec § 4.6, D-UI-13, S-4 à S-7, K-1). Le fetch global est muré EN TÊTE du try ci-dessous (lireApercusWeb reçoit toujours
  // le sien ; `lire` a le vrai) ; S, BU, EN, scene, PNG, IMG y sont assignés : les aides ci-dessous les lisent par fermeture.
  let S, BU, EN, scene, PNG, IMG;
  let reseau = 0;
  const ctxDe = (session = SESSION) => ({ docs: [], docsByRecipe: new Map(), ingredientsById: new Map(), meal_feedback: [], settings: { llm: { provider: 'none' } }, sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } } });
  const lien = (i) => ({ href: U(i), hote: `r${i}.test`, titre: `Recette ${i}`, date: null, presentation: null, temps_min: null, difficulte: null, ingredients: null });
  const trouve = (liens) => ({ etat: 'trouve', raison: null, liens, autres: [], repli: false, recherches: 1, modele: 'm' });
  const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
  const cartes = (root) => [...root.querySelectorAll('a.btn:not(.small)[target="_blank"]')].map((a) => a.parentElement); // les liens-titres des cartes
  const figures = (root) => [...root.querySelectorAll('figure.apercu')];
  const srcs = (root) => figures(root).map((f) => f.querySelector('img')?.getAttribute('src'));
  const etat = (root) => root.querySelector('[data-role="etat-apercus"]');
  // Deux pilotes à promesses : chaque appel de chercher / d'apercus est rangé avec ses arguments et résolu quand le test le veut.
  const pilotes = () => {
    const p = { recherches: [], demandes: [] };
    const pose = (liste) => async (a, d) => { const x = { a, d }; x.promesse = new Promise((r) => { x.rendre = r; }); liste.push(x); return x.promesse; };
    p.chercher = pose(p.recherches); p.apercus = pose(p.demandes);
    return p;
  };
  const monter = async (p, query = { q: 'puttanesca' }, deps = {}, ctx = ctxDe()) => { const root = await S.renderSearch({}, { mode: 'web', ...query }, ctx, { chercher: p.chercher, apercus: p.apercus, navigate: () => {}, remplacerAdresse: () => {}, ...deps }); scene.append(root); return root; };
  // Tape, laisse lancer() appeler chercher, résout le « trouvé », laisse notifier() redessiner (la vue CONNECTÉE pose alors le vol d'aperçus).
  const chercheEtRecoit = async (root, p, liens, nom = 'Chercher sur le web avec l’assistant') => { bouton(root, nom).click(); await tick(); p.recherches.at(-1).rendre(trouve(liens)); await tick(); };
  // La réponse d'un vol d'aperçus : une clé par adresse demandée ; `images` = les adresses qui ont l'image ; les autres portent `raison`.
  const recus = (urls, images, raison = 'pas_d_image') => ({ etat: 'recus', apercus: new Map(urls.map((u) => [u, images.includes(u) ? IMG : { raison }])) });
  // Un redessin SANS tape : le « + type » de la barre de filtres (select → change → render() ; 'salade' ∈ RECIPE_TYPES).
  const redessiner = (root) => { const s = root.querySelector('select'); s.value = 'salade'; s.dispatchEvent(new Event('change')); };
  try {
    // Le mur et les fixtures DANS le try : le finally les retire quoi qu'il arrive (Global Constraints « Bases jetables seulement, aucun réseau »).
    globalThis.fetch = async (u) => { reseau += 1; throw new Error(`aucun reseau attendu ici : ${u}`); };
    scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    S = await import('../src/ui/search.js');
    BU = await import('../src/core/blob-urls.js');
    ({ EN } = await import('../src/i18n/en.js'));
    PNG = await imageTest('#3a7', 320, 240);
    IMG = { blob: PNG, type: 'image/png' };
    // … les blocs du domaine (ci-dessus), puis ceux de l'écran (Step 2) …
  } finally { globalThis.fetch = vraiFetch; scene?.remove(); S?.reinitialiserWeb(); BU?.revoquerUrlsDeBlob(); setUiLocale(localeAvant); }
}
```

  (Les blocs du domaine n'emploient ni `S`, ni `scene`, ni `PNG` : ils injectent leur `fetch` et fabriquent leurs images ; l'ordre « mur, puis domaine, puis
  écran » dans le `try` est celui du fichier.)

  `tests/tests.js` : `import { runApercuWebTests } from './apercu-web.js';` après la l. 34, et, entre le bloc du lot F (l. 238-240) et celui du
  thème (l. 242-244) :

```js
// --- Aperçus des résultats web (lot UI-2) : lireApercusWeb, mur sans ré-encodage, vol d'aperçus, figures et ligne d'état de l'onglet Web.
try { await runApercuWebTests({ eq, ok }); }
catch (error) { ok(false, `Suite aperçus web interrompue : ${error?.message || String(error)}`); }
```

- [ ] **Step 2 : tests rouges — `tests/apercu-web.js`, blocs de l'ÉCRAN** (dans le `try`, après les blocs du domaine) :

```js
    await run('écran : demande d’aperçus — forme, un appel pour cinq, un seul vol, insertion en une fois (D-UI-13, S-4, B-I-12)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien));
      const d = p.demandes[0];
      eq([p.demandes.length, d?.a.urls, d?.a.session === SESSION, d?.d.signal instanceof AbortSignal, d?.d.signal.aborted, S.etatApercus().enVol], [1, CINQ, true, true, false, CINQ],
        'demande : UN appel d’aperçus pour les cinq adresses des liens (dans l’ordre), avec la SESSION relue et un signal d’abandon ; le vol est posé au module');
      const ligne = etat(root);
      eq([ligne?.tagName, ligne?.className, ligne?.textContent, ligne?.previousElementSibling?.textContent, figures(root).length], ['P', 'muted', 'Photos en cours de récupération…', 'Demande envoyée : puttanesca', 0],
        'ligne d’état (forme 1) : p.muted[data-role=etat-apercus] « Photos en cours de récupération… » juste sous « Demande envoyée », aucune figure pendant le vol');
      redessiner(root); await tick();
      eq([p.demandes.length, !!etat(root), S.etatApercus().enVol], [1, true, CINQ], 'un seul vol : un redessin pendant le vol (puce « + type ») ne pose pas de second appel ; la ligne « en cours » reste');
      // Insertion en UNE fois : le conteneur des résultats (root.lastElementChild) est observé — chaque redessin commence par UN vidage (remplacerEnRevoquant :
      // un enregistrement à removedNodes ; les deux append qui suivent n'en ont pas) ; à la réception, UN seul redessin, les trois figures déjà dedans.
      const resultats = root.lastElementChild; const redessins = [];
      const mo = new MutationObserver((records) => { for (const r of records) if (r.removedNodes.length) redessins.push(figures(root).length); });
      mo.observe(resultats, { childList: true });
      d.rendre(recus(CINQ, [U(0), U(1), U(2)]));
      await tick(); await tick(); mo.disconnect();
      eq([redessins, figures(root).length], [[3], 3], 'insertion en une fois : UN seul redessin à la réception, qui porte déjà les trois figures (jamais 1 puis 2 puis 3, jamais trois redessins)');
      const c = cartes(root);
      eq([c.map((x) => x.firstElementChild?.matches('figure.apercu') ?? false), c.slice(0, 3).map((x) => [x.firstElementChild.firstElementChild.tagName, x.firstElementChild.firstElementChild.className, x.firstElementChild.firstElementChild.getAttribute('alt')]), c[0].children[1].tagName + '.' + c[0].children[1].className],
        [[true, true, true, false, false], [['IMG', 'plat-vignette grande', ''], ['IMG', 'plat-vignette grande', ''], ['IMG', 'plat-vignette grande', '']], 'A.btn'],
        'figure : figure.apercu > img.plat-vignette.grande[alt=""] en TÊTE des trois cartes qui ont l’image, puis le titre ; aucune figure sur les deux autres');
      eq([srcs(root).every((s) => typeof s === 'string' && s.startsWith('blob:')), root.querySelectorAll('img').length, etat(root), S.etatApercus()], [true, 3, null, { hrefs: CINQ, blobs: 3, enVol: null }],
        'jamais de src https : les trois images viennent d’URL blob: ; la ligne d’état a disparu (une image posée) ; la Map porte 5 entrées, 3 Blob, aucun vol');
      ok([...root.querySelectorAll('img')].every((i) => c.some((x) => x.contains(i))), 'les images sont dans les cartes (aucune ailleurs)');
    });

    await run('écran : même demande → 0 appel ; trois liens neufs sur cinq → un appel pour trois ; Blob des liens disparus lâchés (K-1, S-5, S-6)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien));
      p.demandes[0].rendre(recus(CINQ, [U(0), U(1), U(2)])); await tick();
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien), 'Chercher à nouveau');
      eq([p.recherches.length, p.demandes.length, figures(root).length, etat(root)], [2, 1, 3, null], 'même demande relancée avec les mêmes cinq liens : une recherche de plus, ZÉRO appel d’aperçus, les trois figures reviennent de la Map');
      await chercheEtRecoit(root, p, [0, 1, 5, 6, 7].map(lien), 'Chercher à nouveau');
      const d = p.demandes[1];
      eq([p.demandes.length, d?.a.urls, S.etatApercus(), figures(root).length, etat(root)?.textContent], [2, [U(5), U(6), U(7)], { hrefs: [U(0), U(1)], blobs: 2, enVol: [U(5), U(6), U(7)] }, 2, 'Photos en cours de récupération…'],
        'trois liens neufs sur cinq : UN appel pour les trois adresses neuves seulement ; les entrées de r2, r3, r4 (Blob de r2 compris) sont lâchées ; les figures de r0 et r1 restent ; « en cours » pour les neuves');
      d.rendre(recus([U(5), U(6), U(7)], [U(5)])); await tick();
      eq([figures(root).length, S.etatApercus(), etat(root)], [3, { hrefs: [U(0), U(1), U(5), U(6), U(7)], blobs: 3, enVol: null }, null], 'réception : r5 posée (trois figures : r0, r1, r5), r6 et r7 mémorisées sans image');
      await chercheEtRecoit(root, p, [0, 1, 5, 6, 7].map(lien), 'Chercher à nouveau');
      eq([p.demandes.length, figures(root).length], [2, 3], 'les échecs sont mémorisés aussi : la même liste relancée ne redemande ni r6 ni r7 (0 appel)');
    });

    await run('écran : abandon par lancer(), par « Annuler » (deux vues) et par la dernière vue déconnectée ; un résultat tardif est muet (S-4)', async () => {
      // lancer() : une nouvelle recherche abandonne le vol d'aperçus ; sa réponse tardive n'écrit rien ; le « trouvé » suivant redemande (connecté).
      S.reinitialiserWeb();
      let p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2, 3, 4].map(lien));
      const d0 = p.demandes[0];
      bouton(root, 'Chercher à nouveau').click(); await tick();
      eq([d0.d.signal.aborted, S.etatApercus().enVol, p.demandes.length], [true, null, 1], 'lancer() : la tape abandonne le vol d’aperçus (signal levé, plus de vol au module)');
      d0.rendre(recus(CINQ, [U(0), U(1), U(2)])); await tick();
      eq(S.etatApercus(), { hrefs: [], blobs: 0, enVol: null }, 'un résultat tardif d’un vol abandonné est MUET : rien n’est écrit dans la Map');
      p.recherches.at(-1).rendre(trouve([0, 1, 2, 3, 4].map(lien))); await tick();
      eq([p.demandes.length, p.demandes[1]?.a.urls, figures(root).length], [2, CINQ, 0], 'le « trouvé » suivant, rendu par la vue connectée, redemande les cinq adresses (toujours absentes)');
      p.demandes[1].rendre(recus(CINQ, [U(0)])); await tick();
      root.remove();
      // « Annuler » : deux vues. root0 montre un « trouvé » dont les aperçus manquent (son vol a été abandonné par la tape de root2) ; root2 tient la recherche
      // en vol et son bouton « Annuler ». Un redessin de root0 pose un nouveau vol d'aperçus ; « Annuler » dans root2 l'abandonne aussi — puis root2, redessinée
      // sur le « trouvé » de la mémoire (K1) aux adresses toujours absentes, en pose aussitôt un troisième : c'est la règle (une vue connectée qui rend un
      // « trouvé » demande ce qui manque), pas une fuite ; le résultat tardif du vol abandonné, lui, reste muet.
      S.reinitialiserWeb();
      p = pilotes();
      const root0 = await monter(p, { q: 'puttanesca' });
      await chercheEtRecoit(root0, p, [0, 1, 2, 3, 4].map(lien));
      const root2 = await monter(p, { q: 'autre plat' });
      bouton(root2, 'Chercher à nouveau').click(); await tick(); // lancer() dans root2 : abandonne le vol d'aperçus de root0, pose la recherche « autre plat »
      eq([p.demandes[0].d.signal.aborted, !!bouton(root2, 'Annuler'), S.etatApercus().enVol], [true, true, null], 'deux vues : la tape de la seconde abandonne le vol d’aperçus de la première et montre « Annuler »');
      redessiner(root0); await tick();
      const d1 = p.demandes[1];
      eq([p.demandes.length, d1?.a.urls, !!bouton(root2, 'Annuler')], [2, CINQ, true], 'deux vues : le redessin de la première (connectée, adresses absentes) pose un nouveau vol d’aperçus pendant que « Annuler » est visible dans la seconde');
      bouton(root2, 'Annuler').click(); await tick();
      eq([d1.d.signal.aborted, S.etatWeb().enCours, p.demandes.length, p.demandes[2]?.d.signal.aborted, S.etatApercus().enVol], [true, false, 3, false, CINQ], '« Annuler » abandonne le vol d’aperçus avec la recherche (signal de d1 levé, plus de recherche en vol) ; le redessin de root2 sur le « trouvé » (K1, adresses absentes) pose aussitôt un nouveau vol');
      d1.rendre(recus(CINQ, [U(0)])); await tick();
      eq([S.etatApercus().blobs, S.etatApercus().enVol], [0, CINQ], '« Annuler » : le résultat tardif du vol abandonné est muet (le nouveau vol est intact)');
      root0.remove(); root2.remove();
      // La dernière vue déconnectée : avec deux vues connectées, retirer l'une ne fait rien ; retirer la dernière abandonne le vol (observateur du document).
      S.reinitialiserWeb();
      p = pilotes();
      const rootA = await monter(p);
      await chercheEtRecoit(rootA, p, [0, 1, 2, 3, 4].map(lien));
      const rootB = await monter(p); // seconde instance : la mémoire porte le « trouvé », le vol est déjà posé
      const d2 = p.demandes[0];
      rootB.remove(); await tick();
      eq([p.demandes.length, d2.d.signal.aborted, S.etatApercus().enVol], [1, false, CINQ], 'deux vues connectées : retirer la seconde ne touche pas au vol');
      rootA.remove(); await tick();
      eq([d2.d.signal.aborted, S.etatApercus().enVol], [true, null], 'la DERNIÈRE vue déconnectée abandonne le vol (signal levé, plus de vol au module)');
      d2.rendre(recus(CINQ, [U(0)])); await tick();
      eq(S.etatApercus(), { hrefs: [], blobs: 0, enVol: null }, 'dernière vue déconnectée : le résultat tardif est muet, rien n’est écrit');
    });

    await run('écran : la ligne d’état dans ses trois formes ; 429 quota mémorisé (D-UI-13, S-15, D-UI-14)', async () => {
      S.reinitialiserWeb();
      let p = pilotes();
      let root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      eq(etat(root)?.textContent, 'Photos en cours de récupération…', 'forme 1 : « Photos en cours de récupération… » pendant le vol');
      p.demandes[0].rendre(recus([U(0), U(1)], [], 'pas_de_recette')); await tick();
      eq([etat(root)?.textContent, figures(root).length, etat(root)?.previousElementSibling?.textContent], ['Photos indisponibles pour cette recherche.', 0, 'Demande envoyée : puttanesca'], 'forme 2 : aucune image → « Photos indisponibles pour cette recherche. », sous « Demande envoyée »');
      await chercheEtRecoit(root, p, [0, 1].map(lien), 'Chercher à nouveau');
      eq([p.demandes.length, etat(root)?.textContent], [1, 'Photos indisponibles pour cette recherche.'], 'forme 2 : la même liste relancée ne redemande rien et dit encore « indisponibles »');
      root.remove();
      // Une Map INCOMPLÈTE reçue (une adresse demandée sans entrée — deps.apercus factice ; lireApercusWeb, elle, remplit toujours) : l'écran boucle sur les
      // adresses DEMANDÉES, pas sur la Map, et remplit l'absente (illisible) ; rien n'est redemandé (S-5 : jamais une boucle de demandes).
      S.reinitialiserWeb(); p = pilotes(); root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      p.demandes[0].rendre({ etat: 'recus', apercus: new Map([[U(0), IMG]]) }); await tick();
      eq([S.etatApercus(), figures(root).length, etat(root)], [{ hrefs: [U(0), U(1)], blobs: 1, enVol: null }, 1, null], 'Map incomplète : l’adresse absente de la Map reçue est remplie côté écran (une entrée par adresse DEMANDÉE), r0 posée, pas de ligne d’état');
      await chercheEtRecoit(root, p, [0, 1].map(lien), 'Chercher à nouveau');
      eq(p.demandes.length, 1, 'Map incomplète : la même liste relancée ne redemande pas l’adresse remplie (0 appel, jamais une boucle)');
      root.remove();
      // 429 écrit par la passerelle (quota) → forme 3, mémorisée par adresse : « Chercher à nouveau » avec les mêmes liens ne repaie pas.
      S.reinitialiserWeb(); p = pilotes(); root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2].map(lien));
      p.demandes[0].rendre({ etat: 'echec', raison: 'quota', extra: { quota: 60 } }); await tick();
      eq([etat(root)?.textContent, S.etatApercus()], ['Quota du jour atteint : photos indisponibles.', { hrefs: [U(0), U(1), U(2)], blobs: 0, enVol: null }], 'forme 3 : 429 quota écrit → « Quota du jour atteint : photos indisponibles. » ; les trois adresses portent la raison');
      await chercheEtRecoit(root, p, [0, 1, 2].map(lien), 'Chercher à nouveau');
      eq([p.demandes.length, etat(root)?.textContent], [1, 'Quota du jour atteint : photos indisponibles.'], 'forme 3 : mémorisée — la même liste ne redemande rien');
      root.remove();
      // Un échec de l'appel entier d'une autre raison (serveur : `0007` absente → 502) → forme 2, mémorisé ; une réponse sans forme aussi. La raison écrite dans
      // la Map (serveur, annule, interne) n'est PAS observable : etatApercus() n'expose que hrefs / blobs / enVol et la ligne d'état ne distingue que « quota »
      // (P-UI2-2 : aucune raison par carte) — le libellé n'affirme que ce que le test lit : « indisponibles », une entrée par adresse, aucune redemande.
      for (const [nom, reponseVol] of [['serveur', { etat: 'echec', raison: 'serveur', extra: {} }], ['annule hors abandon', { etat: 'echec', raison: 'annule', extra: {} }], ['sans forme', undefined]]) {
        S.reinitialiserWeb(); p = pilotes(); root = await monter(p);
        await chercheEtRecoit(root, p, [0].map(lien));
        p.demandes[0].rendre(reponseVol); await tick();
        eq([etat(root)?.textContent, S.etatApercus().hrefs, p.demandes.length], ['Photos indisponibles pour cette recherche.', [U(0)], 1], `échec « ${nom} » → « indisponibles », une entrée mémorisée pour l’adresse, aucune redemande (jamais une boucle ; D-UI-14 : dégradé, jamais bloquant)`);
        root.remove();
      }
    });

    await run('écran : img.onerror → figure retirée, URL révoquée, entrée remplacée (S-7)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
      URL.revokeObjectURL = (u) => { revoquees.push(u); return vraiRevoke.call(URL, u); };
      try {
        // Des octets que le navigateur ne décode pas, sous un type admis : la Map les accepte (deps.apercus factice), l'<img> lève error.
        // (64 octets indécodables lèvent `error` avant même le premier tour de boucle : l'état « deux figures » n'est pas observable, on attend le FAIT.)
        p.demandes[0].rendre({ etat: 'recus', apercus: new Map([[U(0), { blob: new Blob([new Uint8Array(64).fill(7)], { type: 'image/png' }), type: 'image/png' }], [U(1), IMG]]) });
        await attendre(() => figures(root).length === 1, 'la figure indécodable est retirée');
        const restante = srcs(root)[0];
        eq([cartes(root)[0].firstElementChild.tagName, cartes(root)[1].firstElementChild.matches('figure.apercu'), revoquees.length, revoquees[0]?.startsWith('blob:') && revoquees[0] !== restante, restante.startsWith('blob:'), S.etatApercus()],
          ['A', true, 1, true, true, { hrefs: [U(0), U(1)], blobs: 1, enVol: null }],
          'onerror : la figure de r0 est retirée (la carte commence au titre), son URL révoquée (une seule révocation, pas celle de r1) ; celle de r1 reste ; l’entrée de r0 devient un refus (plus jamais de cadre vide)');
        redessiner(root); await tick();
        eq([figures(root).length, p.demandes.length, etat(root)], [1, 1, null], 'après onerror, un redessin ne recrée pas la figure et ne redemande rien (r1 est posée : pas de ligne d’état)');
      } finally { URL.revokeObjectURL = vraiRevoke; }
    });

    await run('écran : URL révoquées et Blob gardés au changement de route ; révocation au redessin (S-6, D-T9)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1, 2].map(lien));
      p.demandes[0].rendre(recus([U(0), U(1), U(2)], [U(0), U(1)])); await tick();
      const avant = srcs(root);
      const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
      URL.revokeObjectURL = (u) => { revoquees.push(u); return vraiRevoke.call(URL, u); };
      try {
        redessiner(root); await tick();
        const apres = srcs(root);
        eq([avant.length, avant.every((u) => revoquees.includes(u)), apres.length, apres.every((u) => u.startsWith('blob:') && !avant.includes(u))], [2, true, 2, true], 'redessin : les deux URL précédentes sont révoquées APRÈS le remplacement (remplacerEnRevoquant), deux URL neuves depuis les Blob');
        // Le FAIT « images chargées » AVANT de révoquer : une URL blob: révoquée sous un <img> encore en chargement lève `error` plus tard (hors de tout
        // reinitialiserWeb()) ; img.onerror ne touche plus la Map pour une URL déjà révoquée (P-UI2-8), mais le test ne dépend pas du temps.
        await attendre(() => [...root.querySelectorAll('img')].every((i) => i.complete), 'les deux images chargées');
        revoquees.length = 0;
        const n = BU.revoquerUrlsDeBlob(); // ce que fait app.js à chaque changement de route (AVANT de remplacer l'écran : les <img> sont encore attachés)
        eq([n >= 2, apres.every((u) => revoquees.includes(u)), S.etatApercus().blobs], [true, true, 2], 'changement de route : les URL des figures sont révoquées (toutes connues de blob-urls.js), les Blob restent dans la Map');
        // Une `error` TARDIVE d'un <img> dont l'URL est DÉJÀ révoquée (un chargement coupé par la révocation : redessin ou changement de route pendant le
        // chargement), simulée par un événement synthétique sur l'<img> encore attachée : la figure part, le Blob RESTE, aucune révocation de plus (P-UI2-8).
        root.querySelector('figure.apercu img').dispatchEvent(new Event('error'));
        eq([figures(root).length, S.etatApercus().blobs, revoquees.length], [1, 2, n], 'error après révocation : la figure est retirée, le Blob reste (aucun image_refusee écrit), aucune révocation de plus');
        root.remove();
        const root2 = await monter(p); // une nouvelle instance de la route : la mémoire porte le « trouvé », les Blob sont là
        const neuves = srcs(root2);
        eq([p.demandes.length, figures(root2).length, neuves.every((u) => u.startsWith('blob:') && !apres.includes(u)), etat(root2)], [1, 2, true, null], 'nouvelle instance : deux figures recréées depuis les Blob (URL neuves), ZÉRO appel d’aperçus, pas de ligne d’état');
        root2.remove();
      } finally { URL.revokeObjectURL = vraiRevoke; }
    });

    await run('écran : deps.chercher sans deps.apercus → 0 appel ; une vue déconnectée ne demande rien ; reinitialiserWeb() vide tout (F-10, S-4)', async () => {
      S.reinitialiserWeb();
      let p = pilotes();
      const reseauAvant = reseau;
      let root = await S.renderSearch({}, { mode: 'web', q: 'puttanesca' }, ctxDe(), { chercher: p.chercher, navigate: () => {}, remplacerAdresse: () => {} }); scene.append(root);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      eq([p.demandes.length, reseau - reseauAvant, S.etatApercus(), etat(root), figures(root).length, cartes(root).length], [0, 0, { hrefs: [], blobs: 0, enVol: null }, null, 0, 2],
        'deps.chercher injecté sans deps.apercus : aucun aperçu demandé (ni factice ni réseau), ni ligne d’état ni figure ; les cartes sont celles d’avant le lot');
      root.remove();
      // Une vue déconnectée ne demande rien : la mémoire porte un « trouvé » aux aperçus absents (vol abandonné par la déconnexion de la première vue).
      S.reinitialiserWeb(); p = pilotes();
      root = await monter(p);
      await chercheEtRecoit(root, p, [0, 1].map(lien));
      root.remove(); await tick(); // dernière vue déconnectée : le vol est abandonné, les adresses restent absentes
      const root2 = await S.renderSearch({}, { mode: 'web', q: 'puttanesca' }, ctxDe(), { chercher: p.chercher, apercus: p.apercus, navigate: () => {}, remplacerAdresse: () => {} }); // PAS montée
      eq([p.demandes.length, cartes(root2).length, etat(root2)], [1, 2, null], 'vue déconnectée : le « trouvé » est rendu (deux cartes) mais aucun aperçu n’est demandé, aucune ligne d’état');
      scene.append(root2); await tick();
      eq(p.demandes.length, 1, 'monter la vue ne demande rien à lui seul (aucun redessin)');
      redessiner(root2); await tick();
      const dVol = p.demandes[1];
      eq([p.demandes.length, dVol?.a.urls, etat(root2)?.textContent], [2, [U(0), U(1)], 'Photos en cours de récupération…'], 'le premier redessin CONNECTÉ demande les adresses absentes');
      // reinitialiserWeb() PENDANT un vol (S-4 : le quatrième abandon) — la seule assertion de la suite qui tue le mutant « abandonnerApercus() retiré de
      // reinitialiserWeb() » : partout ailleurs, reinitialiserWeb() ouvre un bloc après un vol résolu (enVol déjà null, la Map vidée par apercus.clear()).
      S.reinitialiserWeb();
      eq([dVol.d.signal.aborted, S.etatApercus()], [true, { hrefs: [], blobs: 0, enVol: null }], 'reinitialiserWeb() pendant un vol : signal levé, plus de vol, Map vide');
      dVol.rendre(recus([U(0), U(1)], [U(0)])); await tick();
      eq(S.etatApercus().hrefs, [], 'reinitialiserWeb() : le résultat tardif du vol abandonné est muet');
      root2.remove(); // reinitialiserWeb() a vidé `vues` : cette vue ne serait plus redessinée — un vol FRAIS passe par une vue neuve
      p = pilotes();
      const root3 = await monter(p);
      await chercheEtRecoit(root3, p, [0, 1].map(lien));
      p.demandes[0].rendre(recus([U(0), U(1)], [U(0)])); await tick();
      eq(S.etatApercus(), { hrefs: [U(0), U(1)], blobs: 1, enVol: null }, 'réception : la Map est peuplée');
      S.reinitialiserWeb();
      eq([S.etatApercus(), S.etatWeb()], [{ hrefs: [], blobs: 0, enVol: null }, { cle: null, enCours: false, memoire: null }], 'reinitialiserWeb() : la Map des aperçus est vidée (Blob lâchés) avec la mémoire et les vols');
      root3.remove();
    });

    await run('écran : texte de garde « 2 appels » et dictionnaire (§ 5, I-UI-1)', async () => {
      S.reinitialiserWeb();
      const p = pilotes();
      const root = await monter(p, { q: '' });
      const texte = root.textContent;
      eq([texte.includes('Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.'), texte.includes('Une recherche = un appel à l’assistant'), p.demandes.length, p.recherches.length], [true, false, 0, 0],
        'garde : « Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour. » AVANT la tape ; l’ancienne phrase a disparu ; aucun appel au rendu');
      eq([EN['Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.'], EN['Photos en cours de récupération…'], EN['Photos indisponibles pour cette recherche.'], EN['Quota du jour atteint : photos indisponibles.'], 'Une recherche = un appel à l’assistant, compté dans ton quota du jour.' in EN],
        ['One search = 2 assistant calls (results, then photos), counted in your daily quota.', 'Fetching photos…', 'Photos unavailable for this search.', 'Daily quota reached: photos unavailable.', false], 'en.js : les quatre traductions de la spec § 5 ; l’ancienne clé « un appel » est retirée');
      root.remove();
    });

    await run('statiques : SHELL, filet i18n, aucune marque dans le domaine, test de source I-F3 (I-UI-2, S-16)', async () => {
      const sw = await lire('../sw.js');
      const { MODULES_NEUFS } = await import('./ajouter.js');
      const srcA = await lire('../src/domain/apercu-web.js');
      const srcS = await lire('../src/ui/search.js');
      ok(sw.length > 300 && sw.includes("'./src/domain/apercu-web.js'"), 'SHELL : ./src/domain/apercu-web.js (le graphe d’imports de tests/sync.js l’exige aussi)');
      ok(MODULES_NEUFS.includes('../src/domain/apercu-web.js'), 'MODULES_NEUFS (tests/ajouter.js) : apercu-web.js est scanné par le filet i18n');
      eq([srcA.length > 300, /Anthropic|Supabase/i.test(srcA), /\bt\(/.test(srcA)], [true, false, false], 'apercu-web.js : lu ; ne nomme ni le fournisseur ni la base ; aucun texte d’écran (t) dans le domaine');
      eq([srcS.length > 300, /(?:\bsrc\s*:|\.src\s*=)\s*['"`]https?:/.test(srcS), srcS.includes("from '../domain/apercu-web.js'"), srcS.includes("'plat-vignette grande'")], [true, false, true, true], 'search.js : aucun src d’image https écrit en dur (I-F3) ; importe le domaine des aperçus ; la figure garde la classe plat-vignette (révocation D-T9)');
    });
```

- [ ] **Step 3 : tests rouges — amendements des suites existantes** (épingles amendées, jamais contournées ; § 7 UI-2) :

  `tests/recherche-web.js` l. 553 : le texte de garde (I-UI-1 : le nombre d'appels est annoncé AVANT la tape) —

```js
        eq([b.disabled, texte(root).includes('Écris d’abord ce que tu cherches.'), texte(root).includes('Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.'), appels.length], [true, true, true, 0], 'bouton : champ vide → éteint, deux lignes (UI-2 : « 2 appels … résultats, puis photos »), aucun appel au rendu (I-B)');
```

  l. 1027 (`forme`) : **INCHANGÉE, stricte** (P-UI2-23). La spec (§ 7) décrit la forme attendue « avec `FIGURE.apercu` optionnel », mais ces tests n'injectent
  pas `deps.apercus` : l'optionnel y vaut toujours « absent », et un filtre qui ignorerait `figure.apercu` dans `forme` serait du code mort qui rendrait
  l'épingle AVEUGLE à une figure apparue à tort (régression de `figureApercu` rendant une figure vide, I-UI-5) sur toutes les cartes des l. 1033-1060.
  `forme` reste donc telle quelle : une figure parasite rougit chaque forme ; une seule ligne de commentaire au-dessus de la l. 1027, et une assertion de
  plus après la l. 1033 (`let r1 = await rendre([lienR({ presentation: 'Un saumon rôti…' …`) :

```js
        // UI-2 (§ 4.6, P-UI2-23) : la figure d'aperçu (figure.apercu, en tête de carte quand l'image est là) n'existe qu'avec deps.apercus ; ces tests ne l'injectent
        // pas → aucune figure, et `forme` reste STRICTE : une figure parasite rougirait chaque forme ci-dessous (les aperçus se testent dans tests/apercu-web.js).
```

```js
        eq(r1.querySelectorAll('figure.apercu').length, 0, 'UI-2 : sans deps.apercus, aucune figure d’aperçu dans les cartes (0 appel) — la carte garde sa forme ; les aperçus se testent dans tests/apercu-web.js');
```

  (la l. 1055, « les quatre formes de carte », passe par le même `forme`, strict : rien d'autre à y changer.) L. 1223-1226 (« Garder et lire » — la spec dit
  « :1225 », la ligne de `forme` des deux rangées —, les rangées `:scope > .row` ne bougent pas), après la l. 1226 (`eq([garderEtLire(carteDe(root, 1)), …`) :

```js
        eq(carteDe(root).querySelector(':scope > figure.apercu'), null, 'UI-2 : sans deps.apercus, la carte n’a pas de figure d’aperçu (les rangées :scope > .row sont celles d’avant)');
```

  l. 1289 (`CLES`) : remplacer `'Une recherche = un appel à l’assistant, compté dans ton quota du jour.'` par
  `'Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.', 'Photos en cours de récupération…', 'Photos indisponibles pour cette recherche.', 'Quota du jour atteint : photos indisponibles.'` ;
  l. 1291 (clés retirées) : ajouter `'Une recherche = un appel à l’assistant, compté dans ton quota du jour.'` au tableau, et compléter le libellé par
  « ; UI-2 : la garde « un appel » (remplacée par « 2 appels ») ».

  `tests/photo-plat.js` l. 1328 (la déstructuration des sources) et l. 1331 (l'assertion I-F3 ; la l. 1330 est l'assertion `img-src` de la CSP, inchangée) —
  S-16 à la lettre, `search.js` ET `library.js` (P-UI2-5 : coût nul, vert aujourd'hui, aucune dette croisée avec UI-1) :

```js
      const [srcPP, srcK, srcMeals, srcPW, srcB64, srcRecipe, index, srcSearch, srcLib] = await Promise.all(['../src/ui/photo-plat.js', '../src/ui/components.js', '../src/ui/meals.js', '../src/domain/photo-web.js', '../src/domain/base64.js', '../src/ui/recipe.js', '../index.html', '../src/ui/search.js', '../src/ui/library.js'].map(lire));
```

```js
      eq([srcPP, srcK, srcMeals, srcSearch, srcLib].map((s) => /(?:\bsrc\s*:|\.src\s*=)\s*['"`]https?:/.test(s)), [false, false, false, false, false], 'aucun src d’image ne reçoit une adresse http(s) écrite en dur (photo-plat.js, components.js, meals.js ; UI-2 : search.js, library.js, S-16)');
```

  `tests/ajouter.js` l. 8 : `MODULES_NEUFS` + `'../src/domain/apercu-web.js'` (en fin de tableau), et son commentaire l. 5-7 : « + le domaine des aperçus des
  résultats web (lot UI-2, tâche 2) ». `tests/library.js` n'existe pas et `src/ui/library.js` n'affiche pas d'image avant UI-1 : l'extension à `library.js`
  est verte dès maintenant et le reste quand UI-1 (T2) y posera ses vignettes par blob (le lot UI-1 n'a plus rien à écrire sur cette ligne).

- [ ] **Step 4 : rouge lu.** Servir le worktree (`python3 -m http.server 8095 --bind 127.0.0.1`, déjà lancé : registre `progress.md`), puis
  `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095`. **Mesuré par l'auteur du plan** (23 oct., copie légère de `f3672be` + Steps 1 à 3, servie à
  part) : `BILAN : ❌ 5949/5973`, **24 rouges**, exactement ceux-ci — `tests/ajouter.js` « statique ../src/domain/apercu-web.js : c’est bien le module (un export
  y figure) » (le `lire` d'ajouter.js, l. 3769, rend le corps du 404 du serveur Python, 335 caractères : « le source est bien lu (> 300) » reste VERT, c'est
  l'absence d'`export` qui rougit) ; `tests/recherche-web.js` « bouton : champ vide → éteint, deux lignes (UI-2 … » (`[true,true,false,0]`), « en.js : chaque
  texte du lot a sa traduction » (les quatre clés UI-2), « en.js : les textes de l’ancienne clé locale … » (la clé « un appel » encore là) ; `tests/apercu-web.js`
  : les quatre blocs du domaine qui importent le module (« TypeError — Failed to fetch dynamically imported module : …/src/domain/apercu-web.js »), le bloc
  « mur sans ré-encodage » dont QUATRE assertions rougissent sur l'ancien `preparerPhotoDistante` (`reencoder` ignoré : `[false,false,2]`, puis `decodes` 2 au lieu
  de 0 trois fois), les sept blocs de l'écran (« S.etatApercus is not a function », puis « Cannot read properties of undefined (reading 'rendre') » : aucun
  `deps.apercus` appelé), « forme 1 : « Photos en cours… » » (`undefined`), « garde : « Une recherche = 2 appels … » » (`[false,true,0,0]`), « en.js : les
  quatre traductions … » (`[null,null,null,null,true]`), « statiques : … : Error — ../src/domain/apercu-web.js : HTTP 404 » ; et l'épingle « compte
  d’assertions » (obtenu 5972). Console : le 404 de `/favicon.ico` plus les 404 de `apercu-web.js` (attendus au rouge, disparus au vert). Les treize pins à
  `0.15.0` sont encore VERTS (ils rougiraient si le Step 8 relevait `APP_VERSION` sans eux ; ils se relèvent ensemble). `node --test tools/*.test.mjs` :
  la valeur lue à la tête (227/227 si la tâche 1 est commise, 208/208 sinon), inchangée (rien de Node dans cette tâche) ; `node tools/generer-migrations.mjs --check` : 0.
  Lire la sortie : un rouge qui ne figure pas dans cette liste est un constat, pas du bruit. La rév. 2 de ce plan ajoute cinq assertions (une de domaine,
  constat 11 ; quatre d'écran, constats 9 et 14 du pré-vol) DANS des blocs qui, au rouge, lèvent avant de les atteindre (module 404, `S.etatApercus is not
  a function`) : le bilan rouge attendu reste `❌ 5949/5973`, non remesuré — la valeur lue fait foi.

- [ ] **Step 5 : implémenter — `src/core/image.js`** (l. 97-110 à `f3672be` : le commentaire et la fonction remplacés ; `COTE_MIN_DISTANT` inchangé) :

```js
// Lot F (spec plats-en-images § 3.4, D-F12) : une image DISTANTE (l'image d'une page web, rapatriée par la fonction de l'assistant) passe un mur plus
// strict qu'une photo locale : type annoncé de la liste des couvertures (jamais HEIC), en-tête LU et du MÊME type que l'annonce, petit côté ≥ 200 px
// (une icône, un logo carré ou un pixel de suivi n'illustre pas un plat), ≤ 16 Mpx, ≤ 5 Mio ; puis le même ré-encodage JPEG 1 200 px. N'écrit rien.
// Lot UI-2 (spec expérience carnet § 6, H-7, I-UI-2) : `reencoder: false` rend le Blob CONTRÔLÉ tel quel, sans reduireImage — un aperçu de résultat web
// n'est pas ré-encodé (cinq décodages canvas par recherche évités) ; les murs sont les mêmes, l'en-tête lu AVANT tout décodage reste le seul juge.
export const COTE_MIN_DISTANT = 200;
export async function preparerPhotoDistante(blob, { coteMin = COTE_MIN_DISTANT, reencoder = true } = {}) {
  if (!(blob instanceof Blob)) throw new ErreurImage('indecodable');
  if (blob.size > LIMITES_COUVERTURE.octetsDistants) throw new ErreurImage('trop_lourde');
  if (!COVER_INPUT_MIME.includes(blob.type)) throw new ErreurImage('type');
  const dims = await dimensionsImage(blob);
  if (!dims || dims.type !== blob.type) throw new ErreurImage('indecodable');
  if (Math.min(dims.largeur, dims.hauteur) < coteMin) throw new ErreurImage('trop_petite');
  if (dims.largeur * dims.hauteur > LIMITES_COUVERTURE.pixels) throw new ErreurImage('trop_grande');
  return reencoder ? reduireImage(blob) : blob;
}
```

- [ ] **Step 6 : implémenter — `src/domain/apercu-web.js` (neuf** ; aucun mot du fournisseur ni de la base, commentaires compris ; aucun `t()`) :

```js
// Les aperçus des résultats web (lot UI-2 « Aperçus », spec docs/superpowers/specs/2026-10-23-experience-carnet-design.md § 6, D-UI-12) : UN appel,
// `lireApercusWeb`, par la passerelle de l'assistant avec la session (outil `apercu-web`, sans modèle) pour au plus cinq adresses — jamais un fetch
// direct vers un site (I-UI-2 : l'adresse IP de l'appareil ne part jamais chez lui). La réponse est une DONNÉE HOSTILE : chaque champ lu par
// Object.hasOwn, UNE entrée par adresse DEMANDÉE (une adresse absente de la réponse vaut `illisible` : rien n'est redemandé en boucle ; une adresse
// non demandée est ignorée), le type dans la liste des couvertures, la taille bornée AVANT tout décodage, le base64 relu à la longueur exacte
// (base64.js), puis LE mur de F sans ré-encodage (preparerPhotoDistante, reencoder: false). Décodage adresse par adresse : un binaire à la fois
// (S-12). Aucune fonction ne lève ; le jeton n'entre dans aucun objet rendu.
import { appelerAssistant, echecDomaine } from './passerelle.js';
import { lireOctetsBase64 } from './base64.js';
import { COTE_MIN_DISTANT, preparerPhotoDistante } from '../core/image.js';
import { COVER_INPUT_MIME } from '../sync/mime.js';

// § 6 : 5 adresses de 2 048 points au plus ; 1 Mio par image (le `max` que la fonction passe à telechargerImage, épinglé des deux côtés) ; la réponse de
// cinq images à la borne (5 × 1 398 104 caractères de base64 plus l'enveloppe) tient dans 8 Mio ; 135 s = le délai de la passerelle, au-dessus du budget
// serveur de 60 s et du transfert de 7 Mio (≈ 56 s à 1 Mbit/s).
export const LIMITES_APERCU_WEB = Object.freeze({ adresses: 5, url: 2048, octets: 1024 * 1024, corpsReponse: 8 * 1024 * 1024, tentativeMs: 135000, types: COVER_INPUT_MIME });
// Les raisons d'une ENTRÉE (une adresse sans image) : les six que la fonction écrit (§ 6), plus les deux de la lecture ici (forme illisible, mur).
export const RAISONS_ENTREE_APERCU = Object.freeze(['interdit', 'inaccessible', 'pas_de_recette', 'pas_d_image', 'image_trop_lourde', 'delai', 'illisible', 'image_refusee']);
// Les raisons d'un ÉCHEC de l'appel entier (liste FERMÉE : toute autre est `interne`) ; `interdit` = 422 sans réservation (aucune adresse admise).
export const RAISONS_ECHEC_APERCU = Object.freeze(['adresse', 'non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit']);

const echecDe = (raison, extra = {}) => ({ etat: 'echec', raison, extra });
const lu = (o, k) => (o && typeof o === 'object' && Object.hasOwn(o, k) ? o[k] : undefined);

// Une image de la réponse → { blob, type } | { raison } ; jamais une levée (une image refusée par le mur de F est `image_refusee`).
async function lireImage(image) {
  const type = lu(image, 'type'); const taille = lu(image, 'taille');
  if (typeof type !== 'string' || !LIMITES_APERCU_WEB.types.includes(type)) return { raison: 'illisible' };
  if (!Number.isSafeInteger(taille) || taille < 1) return { raison: 'illisible' };
  if (taille > LIMITES_APERCU_WEB.octets) return { raison: 'image_trop_lourde' };
  const octets = lireOctetsBase64(lu(image, 'octets'), taille);
  if (octets === null) return { raison: 'illisible' };
  try { return { blob: await preparerPhotoDistante(new Blob([octets], { type }), { coteMin: COTE_MIN_DISTANT, reencoder: false }), type }; }
  catch { return { raison: 'image_refusee' }; }
}

// UN POST { outil: 'apercu-web', corps: { urls } } (corpsMax 8 Mio, 135 s). Rend { etat: 'recus', apercus: Map(url → { blob, type } | { raison }) }, une clé par
// adresse demandée, dans l'ordre de la demande, ou { etat: 'echec', raison ∈ RAISONS_ECHEC_APERCU, extra }. `config` : tests seulement. La déstructuration
// vit DANS le try : des arguments nuls rendent un échec, jamais un rejet. Forme d'appel : lireApercusWeb({ urls, session }, { fetch, signal, tentativeMs, corpsMax, config }).
export async function lireApercusWeb(args, opts) {
  try {
    const { urls, session } = args ?? {};
    const { fetch, signal, tentativeMs = LIMITES_APERCU_WEB.tentativeMs, corpsMax = LIMITES_APERCU_WEB.corpsReponse, config } = opts ?? {};
    if (!Array.isArray(urls) || urls.length < 1 || urls.length > LIMITES_APERCU_WEB.adresses || urls.some((u) => typeof u !== 'string' || !u || u.length > LIMITES_APERCU_WEB.url)) return echecDe('adresse');
    const demandees = [...urls];
    const r = await appelerAssistant('apercu-web', { urls: demandees }, { fetch, session, config, signal, tentativeMs, corpsMax });
    if (r.raison) { const d = echecDomaine(r); return echecDe(RAISONS_ECHEC_APERCU.includes(d.raison) ? d.raison : 'interne', d.extra ?? {}); }
    const liste = lu(r.corps, 'apercus');
    if (!Array.isArray(liste)) return echecDe('reponse_illisible');
    const recus = new Map();
    for (const entree of liste) {
      const url = lu(entree, 'url');
      if (typeof url !== 'string' || !demandees.includes(url) || recus.has(url)) continue; // non demandée, ou déjà lue (la première entrée gagne) : ignorée
      const image = lu(entree, 'image');
      if (image === null || image === undefined) { const raison = lu(entree, 'raison'); recus.set(url, { raison: RAISONS_ENTREE_APERCU.includes(raison) ? raison : 'illisible' }); continue; }
      recus.set(url, await lireImage(image)); // l'une après l'autre : un binaire décodé à la fois (S-12)
    }
    const apercus = new Map();
    for (const url of demandees) apercus.set(url, recus.get(url) ?? { raison: 'illisible' });
    return { etat: 'recus', apercus };
  } catch { return echecDe('interne'); }
}
```

- [ ] **Step 7 : implémenter — `src/ui/search.js`** (neuf retouches, par leur texte ; numéros à `f3672be`). Rien d'autre ne bouge : `renderWeb`, les
  issues `rien` / `indisponible`, « Garder et lire », les rangées de la carte gardent leur forme (I-UI-3).

  **(a) Imports** — après la l. 7 (`import { logError } from '../core/log.js';`), après la l. 11 (`import { chercherRecettesWeb, … } from
  '../domain/recherche-web.js';`) et après la l. 12 (`import { RECIPE_TYPES, DIET_TAGS } from '../model/schema.js';`), respectivement :

```js
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';
```
```js
import { lireApercusWeb } from '../domain/apercu-web.js';
```
```js
import { COVER_INPUT_MIME } from '../sync/mime.js';
```

  **(b) État du module** — les l. 27-29 (`const vues = new Set();`, `etatWeb`, `reinitialiserWeb`) deviennent :

```js
const vues = new Set(); // { root, redessiner }
export function etatWeb() { return { cle: vol?.cle ?? null, enCours: !!vol, memoire: memoire ? { cle: memoire.cle, etat: memoire.issue.etat } : null }; }
// Lot UI-2 (D-UI-12, § 4.6) : les aperçus des résultats, mémoire VIVE par ADRESSE à côté de `memoire` — `href` du lien → { blob, type } (l'image contrôlée par
// le mur de F, Blob typé dans la liste des couvertures) ou { raison } (échec mémorisé : une adresse sans image n'est pas redemandée). La Map SURVIT à une
// nouvelle issue (elle est indexée par href, pas par demande) : après chaque « trouvé » reçu, les entrées dont le href a quitté ses liens sont lâchées, Blob
// compris ; reinitialiserWeb() seule la vide entière. L'UNIQUE vol d'aperçus de l'app : posé par une vue CONNECTÉE qui rend un « trouvé » aux adresses
// encore absentes ; abandonné par lancer(), « Annuler », reinitialiserWeb() et quand plus aucune vue n'est connectée (un observateur du document, le temps
// du vol) ; un vol abandonné est MUET (rien d'écrit : ses adresses restent absentes et se redemandent au prochain « trouvé » rendu connecté). Les URL blob:
// sont recréées à chaque rendu depuis les Blob et révoquées par remplacerEnRevoquant (img.plat-vignette) et au changement de route (app.js).
const apercus = new Map();
let volApercus = null; // { controller, promesse, hrefs, garde }
export function etatApercus() { return { hrefs: [...apercus.keys()], blobs: [...apercus.values()].filter((a) => a.blob instanceof Blob).length, enVol: volApercus ? [...volApercus.hrefs] : null }; } // tests seulement
function abandonnerApercus() { if (!volApercus) return; volApercus.garde.disconnect(); volApercus.controller.abort(); volApercus = null; }
function elaguerApercus(issue) {
  const gardes = new Set((Array.isArray(issue?.liens) ? issue.liens : []).map((l) => l?.href));
  for (const href of [...apercus.keys()]) if (!gardes.has(href)) apercus.delete(href);
}
export function reinitialiserWeb() { vol?.controller.abort(); vol = null; memoire = null; vues.clear(); abandonnerApercus(); apercus.clear(); } // tests seulement
```

  **(c) `deps`** — la l. 68 devient (F-10 : `deps.apercus` par défaut `lireApercusWeb` ; un test qui injecte `chercher` sans `apercus` ne demande aucun
  aperçu — les tests de route d'avant le lot n'appellent rien) :

```js
  const { chercher = chercherRecettesWeb, apercus: apercusFn = (deps.chercher === undefined ? lireApercusWeb : null), enLigne, navigate: nav = navigate, remplacerAdresse: remplacer = remplacerAdresse, toast = toastDom, lecture = {} } = deps;
```

  **(d) `lancer()`** — l. 190 (`vol?.controller.abort();` ; la l. 189 est `if (!demande.cle) { render(); return; }`) suivie de `abandonnerApercus(); // UI-2 : une nouvelle recherche rend le vol d'aperçus caduc (ses
  liens changent)` ; l. 198 (`if (issue?.raison !== 'annule') memoire = { … };`) devient :

```js
        if (issue?.raison !== 'annule') { memoire = { cle, issue: issue && typeof issue === 'object' ? issue : ISSUE_INTERNE, q, filtres }; if (memoire.issue.etat === 'trouve') elaguerApercus(memoire.issue); } // UI-2 (K-1) : les entrées des liens disparus sont lâchées à chaque « trouvé » reçu
```

  **(e) `annuler()`** — l. 205 : `const annuler = () => { vol?.controller.abort(); vol = null; abandonnerApercus(); render(); }; // UI-2 : le vol d'aperçus aussi (S-4)`.

  **(f) Texte de garde** — l. 234 :

```js
      el('small', { class: 'muted' }, t('Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.')), // UI-2 (D-UI-13, I-UI-1) : le nombre d'appels, dit AVANT la tape
```

  **(g) Les trois aides du vol d'aperçus** — insérées AVANT la l. 237 (`// § 5.5-5.6 : chaque issue a son écran …`), au niveau de `renderSearch` (elles lisent
  `root`, `ctx`, `apercusFn`) :

```js
  // UI-2 (D-UI-13, S-4, S-5) : le vol d'aperçus — demandé par CETTE vue si elle est connectée, pour les adresses encore absentes de la Map (0 appel quand
  // tout est connu : « Chercher à nouveau » ne repaie que les adresses neuves), jamais pendant un autre vol d'aperçus, jamais sans deps.apercus. Un
  // abandon (lancer, « Annuler », dernière vue déconnectée, reinitialiserWeb) rend le résultat MUET ; tout autre résultat est écrit par adresse (une Map
  // reçue → ses entrées, une entrée absente ou un échec de l'appel entier → sa raison, une réponse sans forme → `interne`) : jamais une boucle de demandes.
  const demanderApercus = (hrefs) => {
    const manquants = [...new Set(hrefs.filter((h) => !apercus.has(h)))].slice(0, 5);
    if (!apercusFn || volApercus || !manquants.length || !root.isConnected) return;
    const controller = new AbortController();
    const promesse = Promise.resolve()
      .then(async () => apercusFn({ urls: manquants, session: await sessionAssistant(ctx) }, { signal: controller.signal }))
      .catch(() => ({ etat: 'echec', raison: 'interne' }))
      .then((r) => {
        if (volApercus?.promesse !== promesse) return; // abandonné : muet, rien d'écrit
        volApercus.garde.disconnect(); volApercus = null;
        if (r?.etat === 'recus' && r.apercus instanceof Map) {
          for (const h of manquants) { const a = r.apercus.get(h); apercus.set(h, a?.blob instanceof Blob && COVER_INPUT_MIME.includes(a.blob.type) ? { blob: a.blob, type: a.blob.type } : { raison: typeof a?.raison === 'string' ? a.raison : 'illisible' }); }
        } else { const raison = typeof r?.raison === 'string' ? r.raison : 'interne'; for (const h of manquants) apercus.set(h, { raison }); }
        notifier(); // les figures de TOUTE la liste en un seul redessin (B-I-12)
      });
    // La dernière vue déconnectée abandonne le vol (S-4) : un observateur du document, le temps du vol seulement (déconnecté à la fin ou à l'abandon).
    const garde = new MutationObserver(() => { if (![...vues].some((v) => v.root.isConnected)) abandonnerApercus(); });
    garde.observe(document.body, { childList: true, subtree: true });
    volApercus = { controller, promesse, hrefs: manquants, garde };
  };
  // § 4.6 : la figure d'une carte — depuis le Blob de la Map, une URL blob: NEUVE à chaque rendu (révoquée par remplacerEnRevoquant au redessin : la classe
  // plat-vignette est celle que urlsDesVignettes relève ; par app.js au changement de route) ; décorative (alt vide : la carte porte le titre) ; classes neuves
  // sans thème (UI-1 les habille ; la marge UA « 1em 40px » d'une figure est mise à 0 en ligne). I-UI-5 : la liste blanche d'un aperçu est COVER_INPUT_MIME
  // (mime.js), le sous-ensemble gelé d'ALLOWED_MIME que typeAffichage applique aux lignes `files` — ni HEIC, ni PDF, ni EPUB pour une image de page web ;
  // la même liste borne LIMITES_IMAGE_WEB.types et le mur distant (P-UI2-22). Une image que le navigateur ne décode pas (error) retire la figure, révoque son
  // URL et remplace l'entrée par un refus : plus jamais de cadre vide. Mais une `error` dont l'URL est DÉJÀ révoquée — par remplacerEnRevoquant à un
  // redessin pendant le chargement (chaque touche du filtre redessine), ou par app.js au changement de route, qui révoque AVANT de remplacer l'écran —
  // vient de la révocation, pas du décodage : la figure part, le Blob RESTE (revoquerUrlDeBlob rend false pour une URL déjà révoquée ; P-UI2-8).
  const figureApercu = (lien) => {
    const a = apercus.get(lien.href);
    if (!(a?.blob instanceof Blob) || !COVER_INPUT_MIME.includes(a.blob.type)) return null;
    const u = urlDeBlob(a.blob);
    const img = el('img', { class: 'plat-vignette grande', alt: '', src: u });
    const fig = el('figure', { class: 'apercu', style: { margin: '0' } }, img);
    img.addEventListener('error', () => { fig.remove(); if (revoquerUrlDeBlob(u)) apercus.set(lien.href, { raison: 'image_refusee' }); }, { once: true });
    return fig;
  };
  // D-UI-13 : la ligne d'état, sous « Demande envoyée » — « en cours » pendant le vol de ces adresses ; rien dès qu'une image est posée ; sinon, quand toutes
  // les adresses ont leur entrée, « Quota… » si l'une porte `quota` (429 écrit, S-15), « indisponibles » autrement ; rien tant que rien n'a été demandé.
  const ligneEtatApercus = (hrefs) => {
    const ligne = (texte) => el('p', { class: 'muted', dataset: { role: 'etat-apercus' } }, texte);
    if (volApercus && hrefs.some((h) => volApercus.hrefs.includes(h))) return ligne(t('Photos en cours de récupération…'));
    const entrees = hrefs.map((h) => apercus.get(h));
    if (!entrees.length || entrees.some((a) => a?.blob instanceof Blob) || !entrees.every(Boolean)) return null;
    return ligne(entrees.some((a) => a.raison === 'quota') ? t('Quota du jour atteint : photos indisponibles.') : t('Photos indisponibles pour cette recherche.'));
  };
```

  **(h) La carte** — l. 266-267 (`return el('div', { class: 'card flat stack' },` puis `el('a', { class: 'btn', href: l.href, …`) :

```js
      return el('div', { class: 'card flat stack' },
        figureApercu(lien), // UI-2 (§ 4.6) : la figure en TÊTE, quand l'image est là ; null sinon (el l'ignore : la carte d'avant le lot)
        el('a', { class: 'btn', href: l.href, target: '_blank', rel: 'noopener noreferrer' }, titre),
```

  **(i) La demande et la ligne d'état** — après la l. 281 (`if (!cartes.length) return renderIssue({ ...issue, etat: 'rien' });`) et avant la l. 282 (`const demande =
  …`) :

```js
    // UI-2 (D-UI-13) : les adresses des cartes affichées (les liens CHOISIS, jamais « autres »), telles que l'issue les porte — la clé de la Map et l'`url` de la
    // réponse (le serveur rend la chaîne reçue, S-9) ; demandées AVANT la ligne d'état, qui dit le vol posé ici.
    const hrefsApercus = (Array.isArray(issue.liens) ? issue.liens : []).filter((lien) => lienSignet(lien?.href).ok).map((lien) => lien.href);
    demanderApercus(hrefsApercus);
```

  et, dans la section (l. 283-284), juste après `el('div', { class: 'muted' }, t('Demande envoyée : {q}', { q: demande })),` :

```js
      ligneEtatApercus(hrefsApercus), // UI-2 : « Photos en cours… » | « Photos indisponibles… » | « Quota du jour atteint… » | rien
```

  Vérifications de forme à la fin du Step : `node --check src/ui/search.js src/domain/apercu-web.js src/core/image.js` (0) ; `git grep -n "Anthropic\|Supabase"
  -- src/domain/apercu-web.js` vide ; `grep -n "styles.css" <(git diff --stat)` vide (aucune règle CSS : UI-1).

- [ ] **Step 8 : implémenter — dictionnaire, coquille, versions, pins.**

  `src/i18n/en.js` : la l. 273 (`"Une recherche = un appel à l’assistant, compté dans ton quota du jour.": "One search = one call to the assistant, counted in your
  daily quota.",`) est RETIRÉE (spec § 5 : les chaînes retirées quittent aussi `en.js` ; aucun autre module ne la rend — `git grep` : `src/ui/search.js:234` seul) ;
  avant la dernière ligne `};` :

```js
  // Lot UI-2 « Aperçus des résultats web » (spec expérience carnet § 5) : le texte de garde (deux appels) et la ligne d'état des photos (search.js).
  "Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour.": "One search = 2 assistant calls (results, then photos), counted in your daily quota.",
  "Photos en cours de récupération…": "Fetching photos…",
  "Photos indisponibles pour cette recherche.": "Photos unavailable for this search.",
  "Quota du jour atteint : photos indisponibles.": "Daily quota reached: photos unavailable.",
```

  `sw.js` l. 4 : `const VERSION = 'cuisine-os-v0.16.0-1';` ; l. 17 : la ligne des modules `./src/domain/…` commence par `'./src/domain/apercu-web.js',
  './src/domain/assistant-config.js', …` (ordre alphabétique ; `tests/sync.js` l. 977-1014 exige le module dans `SHELL` dès que `search.js` l'importe).
  `src/model/schema.js` l. 6 : `export const APP_VERSION = '0.16.0';` (`DB_VERSION` reste 4).

  Pins — les 15 lignes relevées au Step 0 (P-UI2-15), `0.15.0` → `0.16.0` et `v0\.15\.0` → `v0\.16\.0`, libellé du lot « (lot UI-2, aperçus des résultats web) », l'historique
  des versions prolongé là où la ligne le porte :
  - `tests/ajouter.js:3817` → `ok(/VERSION = 'cuisine-os-v0\.16\.0-\d+'/.test(sw), 'sw.js : VERSION 0.16.0');` ; `:3819` → `eq(APP_VERSION, '0.16.0', 'APP_VERSION 0.16.0 (lot UI-2, aperçus des résultats web)');`
  - `tests/passerelle.js:765` → la même `ok(/VERSION = 'cuisine-os-v0\.16\.0-\d+'/…, 'sw.js : VERSION 0.16.0')` ; `:767` → le même `eq(APP_VERSION, '0.16.0', 'APP_VERSION 0.16.0 (lot UI-2, aperçus des résultats web)')`
  - `tests/recherche-web.js:66` (commentaire) → `// --- § 8 : version 0.16.0 (lot UI-2, aperçus des résultats web ; 0.15.0 au lot F, 0.14.0 au lot E, 0.13.0 au lot D, 0.12.0 au lot C, 0.11.0 au lot G, 0.10.0 au lot B, 0.9.0 au lot A, 0.8.1 à la présentation du serveur), SHELL` ; `:69` → regex `v0\.16\.0-\d+`, libellé `'sw.js : VERSION 0.16.0'` ; `:72` → `eq(APP_VERSION, '0.16.0', 'APP_VERSION 0.16.0 (lot UI-2, aperçus des résultats web)')`
  - `tests/sync-l3.js:1867` → regex `v0\.16\.0-\d+` (libellé inchangé : « VERSION incrémentée (format …) »)
  - `tests/sync-l4.js:514` → regex `v0\.16\.0-\d+`, `'sw.js : VERSION 0.16.0'` ; `:516` → `eq([APP_VERSION, DB_VERSION], ['0.16.0', 4], 'T1 (lot UI-2, aperçus des résultats web) : APP_VERSION 0.16.0, DB_VERSION inchangée (D-G11 : 0.11.0 au lot G ; 0.12.0 au lot C ; 0.13.0 au lot D ; 0.14.0 au lot E ; 0.15.0 au lot F)');` ; `:3506` → `const v = /VERSION = 'cuisine-os-v0\.16\.0-(\d+)'/.exec(sw);` ; `:3507` → `ok(!!v && Number(v[1]) >= 1, 'sw.js : VERSION 0.16.0-N avec N ≥ 1 (lot UI-2 ; le seuil N ≥ 6 de la clôture des écrans du lot G valait sous 0.11.0)');`
  - `tests/assistant-compte.js:8` → `eq([DB_VERSION, APP_VERSION], [4, '0.16.0'], 'T1 (lot UI-2, aperçus des résultats web) : DB_VERSION 4 inchangée, APP_VERSION 0.16.0');`
  - `tests/creer-ia.js:11` → `eq(APP_VERSION, '0.16.0', 'T1 : APP_VERSION 0.16.0 (lot UI-2)');`
  - `tests/classement.js:2568` → `['0.16.0', true, true]` dans l'attendu, et le libellé « T-D20 : APP_VERSION 0.16.0 (fixée par le chef d’orchestre : R-D-12 au lot D, R-E-18 au lot E, Global Constraints au lot F, I-UI-7 au lot UI-2), VERSION du service worker sur elle, regroupement.js dans le filet i18n »

  Relancer le relevé du Step 0 avec `0.15.0` : attendu VIDE (hors les mentions d'historique dans les libellés, qui contiennent « 0.15.0 au lot F ») ; avec
  `0.16.0` : les 14 lignes.

- [ ] **Step 9 : vert.** `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095` : tout vert **sauf l'épingle** (`eq(results.length, …)`, forcément rouge
  tant qu'elle n'est pas relevée : Step 10), une seule erreur de console (le 404 de `/favicon.ico`), aucune réponse ≥ 400 autre. **Mesuré par l'auteur du plan**
  (copie légère de `f3672be` + Steps 1 à 8 de la rév. 1, servie à part) : `❌ 6031/6032` (l'épingle seule : « obtenu : 6031 attendu : 5947 »), console : le 404 de
  `/favicon.ico` seul ; la rév. 1 comptait `tests/apercu-web.js` = 82 assertions (33 de domaine, 49 d'écran), `tests/recherche-web.js` + 2 : 84 de plus que le
  départ (5948 → 6032). **La rév. 2 ajoute six assertions, non remesurées** : une de domaine (`eq(A.LIMITES_APERCU_WEB.octets, BORNE, …)`, constat 11) et
  cinq d'écran (« reinitialiserWeb() pendant un vol » et « son résultat tardif est muet », constat 9 ; les deux « Map incomplète », constat 14 ; « error
  après révocation », constats 8 et 16) → attendu **`❌ 6037/6038`**, `tests/apercu-web.js` = 88 assertions (34 de domaine, 54 d'écran), 90 de plus que
  le départ (5948 → 6038).
  La valeur MESURÉE sur la tête réelle fait foi ; un écart de plus de dix est une assertion oubliée ou un bloc interrompu (`run` rend UNE ligne rouge pour un
  bloc qui lève : la lire). `node --test tools/*.test.mjs` : la valeur lue à la tête (227/227 si la tâche 1 est commise, 208/208 sinon), inchangée ;
  `node tools/generer-migrations.mjs --check` : 0.

- [ ] **Step 10 : épingle relevée** : `tests/tests.js` l. 250, `eq(results.length, 6037,'compte d’assertions : une assertion qui disparait est un rouge');` (règle
  N−1 : l'assertion du total s'ajoute elle-même au bilan ; 6037 si la mesure du Step 9 est bien 6037/6038, sinon « obtenu ») ; relancer la suite : `✅ 6038/6038`,
  même 404 seul en console. Consigner N et l'épingle dans le rapport de tâche.

- [ ] **Step 11 : mutants de la tâche** — sur une copie LÉGÈRE servie à part (`rsync -a --exclude .git --exclude .superpowers --exclude node_modules
  /Users/neeganmac/projects/mistu-apercus/ <scratchpad>/mutant-S2/`, `python3 -m http.server 8195 --bind 127.0.0.1` depuis la copie (8195 était occupé par un autre serveur Python le 23 octobre, PID 72905, non tué : vérifier `lsof -nP -iTCP:8195 -sTCP:LISTEN` et prendre le premier port libre de 8195, 8295, 8395 — jamais 8095), `node
  .superpowers/sdd/2026-10-23-apercus-web/suite.cjs <le port choisi>` ; jamais en place ; le serveur de la copie est tué à la fin, jamais celui du port 8095). Chacun
  doit rougir ; le bilan et la première ligne rouge de chacun vont au rapport :
  1. `reencoder` ignoré (`return reduireImage(blob)` toujours) → « reencoder: false → LE MÊME Blob … sans aucun createImageBitmap » et « blob par adresse … aux octets REÇUS ».
  2. `dims.type !== blob.type` retiré de `preparerPhotoDistante` → « octets PNG annoncés image/jpeg (en-tête menteur) … → image_refusee » et « reencoder: false : octets PNG annoncés image/jpeg → indecodable ».
  3. `corpsMax` omis dans `lireApercusWeb` (ou `corpsReponse` remis à 2 Mio) → « corpsMax : ≈ 7 Mio de JSON sont lus ».
  4. `LIMITES_APERCU_WEB.octets` remis à 2 Mio → « taille 1 048 577 … → image_trop_lourde AVANT tout décodage ».
  5. `lireOctetsBase64` appelée AVANT la borne de taille → le même test (espion `atob` : 1 au lieu de 0).
  6. Type hors liste accepté (`!LIMITES_APERCU_WEB.types.includes(type)` retiré) → « type hors liste … → illisible ».
  7. Une adresse demandée absente de la réponse NON remplie (`?? { raison: 'illisible' }` retiré) → « une adresse demandée ABSENTE de la réponse vaut illisible » ; à l'écran, « échec … aucune redemande (jamais une boucle) ».
  8. `!root.isConnected` retiré de `demanderApercus` → « vue déconnectée : … aucun aperçu n’est demandé » (3 au lieu de 1) ; « aperçus demandés par une vue déconnectée » de la spec § 7.
  9. La garde `volApercus` retirée (second vol possible) → « un seul vol : un redessin pendant le vol … ne pose pas de second appel ».
  10. `elaguerApercus` jamais appelée → « trois liens neufs sur cinq : … les entrées de r2, r3, r4 … sont lâchées » (hrefs 5 au lieu de 2).
  11. Figures insérées carte par carte (`apercus.set(h, …); notifier();` DANS la boucle du `.then`) → « insertion en une fois : UN seul redessin » (`[3, 3, 3, 3, 3]` au lieu de `[3]`) ; spec § 7 « insertion en deux temps observée ».
  12. `img.src = lien.href` (une adresse https) → « jamais de src https : les trois images viennent d’URL blob: » et le test de source I-F3 de `tests/photo-plat.js`.
  13. Résultat abandonné écrit quand même (`if (volApercus?.promesse !== promesse) return;` retiré) → « un résultat tardif d’un vol abandonné est MUET » (et le cas « Annuler », « dernière vue déconnectée »).
  14. `abandonnerApercus()` retiré de `lancer()` → « lancer() : la tape abandonne le vol d’aperçus » ; de `annuler()` → « « Annuler » abandonne le vol d’aperçus avec la recherche » ; de `reinitialiserWeb()` → « reinitialiserWeb() pendant un vol : signal levé, plus de vol, Map vide » (`[false, { …, enVol: [U(0), U(1)] }]`) puis « le résultat tardif du vol abandonné est muet » (hrefs `[U(0), U(1)]`) — la seule assertion qui l'atteint : « la Map des aperçus est vidée » reste VERTE sous ce mutant (vol déjà résolu, `apercus.clear()` suffit).
  15. L'observateur du document retiré (`garde` jamais posé) → « la DERNIÈRE vue déconnectée abandonne le vol ».
  16. Blob jetés au changement de route (mutant : `apercus.clear()` dans `figureApercu` après la création de l'URL, ou `elaguerApercus({ liens: [] })` au redessin) → « changement de route : … les Blob restent dans la Map » et « nouvelle instance : deux figures recréées … ZÉRO appel » (spec § 7 : second appel).
  17. Branche « quota » retirée de `ligneEtatApercus` (toujours « indisponibles ») → « forme 3 : 429 quota écrit → « Quota du jour atteint … » ».
  18. Ligne d'état rendue même avec une image (`entrees.some(blob)` retiré) → « la ligne d’état a disparu (une image posée) ».
  19. L'entrée NON remplacée à l'`error` de l'image → « l’entrée de r0 devient un refus » (blobs 2 au lieu de 1).
  20. Ancien texte de garde remis → « bouton : champ vide → éteint, deux lignes (UI-2 … » et « garde : « Une recherche = 2 appels … » ».
  21. Classe `plat-vignette` retirée de l'`img` de la figure → « redessin : les deux URL précédentes sont révoquées APRÈS le remplacement » (aucune révocation) et le statique « la figure garde la classe plat-vignette ».
  22. `deps.apercus` demandé même quand `deps.chercher` est injecté seul (`apercusFn = lireApercusWeb` inconditionnel) → « deps.chercher injecté sans deps.apercus : aucun aperçu demandé » (réseau 1 : le fetch muré lève, `interne` mémorisé) et les tests de route des lots web et B qui comptent leurs appels réseau (« aucun réseau réel »).
  23. Le `.then` de `demanderApercus` boucle sur `r.apercus` au lieu de `manquants` (une adresse absente de la Map reçue reste absente et serait redemandée) → « Map incomplète : la même liste relancée ne redemande pas l’adresse remplie » (2 au lieu de 1) et « Map incomplète : l’adresse absente … est remplie » (hrefs `[U(0)]`).
  24. `if (revoquerUrlDeBlob(u))` retiré de l'`error` de `figureApercu` (l'entrée remplacée même pour une URL déjà révoquée : `fig.remove(); revoquerUrlDeBlob(u); apercus.set(…)`) → « error après révocation : la figure est retirée, le Blob reste » (blobs 1 au lieu de 2 ; l'événement `error` synthétique du bloc « URL révoquées et Blob gardés »).

  **Déjà joués par l'auteur du plan** (copie légère de la rév. 1 servie sur 8495, épingle 6031 d'alors ; 8195 était occupé par un autre serveur, jamais tué) : le n° 11
  (`notifier()` dans la boucle du `.then`) → `❌ 5962/5980`, 18 rouges dont « insertion en une fois : … obtenu [[3,3,3,3,3,3],3] attendu [[3],3] », les
  redemandes en cascade (« même demande relancée … ZÉRO appel » rouge) et une attente dépassée du lot B ; le n° 8 (`!root.isConnected` retiré) →
  `❌ 6030/6032`, 2 rouges : « vue déconnectée : le « trouvé » est rendu … mais aucun aperçu n’est demandé » (`[1,2,{}]`) et « monter la vue ne demande rien à
  lui seul » (2 au lieu de 1). Les vingt autres restent à jouer par l'implémenteur, chacun sur une copie.

- [ ] **Step 12 : invisibles** sur les fichiers touchés (`src/core/image.js src/domain/apercu-web.js src/ui/search.js src/i18n/en.js sw.js src/model/schema.js
  tests/apercu-web.js tests/tests.js tests/recherche-web.js tests/photo-plat.js tests/ajouter.js tests/passerelle.js tests/sync-l3.js tests/sync-l4.js
  tests/assistant-compte.js tests/creer-ia.js tests/classement.js`) : **le script des Global Constraints** (« Caractères invisibles » : catégories Cc hors
  `\t` / `\n`, Cf, Cs, U+2028 / U+2029 — jamais une liste fermée de points de code : la rév. 1 de ce Step en portait une, aveugle aux insécables et au
  trait d'union conditionnel), attendu `invisibles : 0` ; PUIS le contrôle des insécables sur les LIGNES AJOUTÉES seulement (U+00A0 et U+202F sont des `Zs`,
  hors des catégories ci-dessus ; une insécable tapée avant le « : » de « Quota du jour atteint : photos indisponibles. » — identique dans `search.js`,
  `en.js` et `tests/apercu-web.js` — laisserait la suite verte et ne serait vue qu'au `/verify` de la Clôture) :

  Le script vit dans un FICHIER du `<scratchpad>` et lit le diff par le tube (ronde 1 de la tâche 2 : avec un heredoc `<<'PY'` sur `python3 -I -`, le
  heredoc REMPLACE l'entrée standard, le `git diff | grep` est ignoré et Python lit le diff comme un script — `SyntaxError` sur « § », reproduit) :

  ```bash
  cat > <scratchpad>/insecables.py <<'PY'
  import sys
  mauvais = 0
  for i, l in enumerate(sys.stdin, 1):
      for c in l:
          if ord(c) in (0x00A0, 0x202F):
              print(f'ligne ajoutee {i}: U+{ord(c):04X}'); mauvais += 1
  print('insecables :', mauvais); sys.exit(1 if mauvais else 0)
  PY
  git diff -U0 -- <fichiers touchés> | grep '^+' | python3 -I <scratchpad>/insecables.py
  ```

  Attendu `insecables : 0` : les quatre textes de § 5 ne portent que des espaces ordinaires (U+0020) avant « : » et « ( », et l'apostrophe U+2019 (Global
  Constraints « Filet i18n »).

  Secrets : `git grep -nEi 'sk-ant-[0-9A-Za-z_-]{10,}|eyJ[A-Za-z0-9_-]{20,}' -- src tests` ne rend que les sentinelles déjà présentes (`…-sentinelle`,
  `sk-factice-…`) ; `jeton-apercus-sentinelle` est une sentinelle de plus, jamais une valeur.

- [ ] **Step 13 : commit** (message ASCII, sans accents ; `git add` nommé fichier par fichier, jamais `-A` : deux agents partagent l'index d'un worktree) :
  `Apercus web, client : lireApercusWeb, mur sans re-encodage, figures et ligne d etat de l onglet Web, APP_VERSION 0.16.0 (lot UI-2, tache 2)`,
  corps en ASCII (une ligne par bloc : domaine, image.js, search.js, en.js, sw.js -1 et SHELL, pins et epingle), puis les deux trailers du dépôt :
  `Co-Authored-By: <modele reel de l implementeur> <noreply@anthropic.com>` (R-T1-3, P-UI2-18) et la ligne `Claude-Session: …` quand le harnais la fournit, comme à la tâche 1. Le commit touche `src/` : `sw.js` porte `-1` (I-UI-7, R-B-24) ; toute ronde ultérieure qui touche `src/`
  ou `sw.js` incrémente encore (`-2`, `-3`, …), jamais de réécriture d'historique.

---

### Task 3 : S3 docs — `CLAUDE.md` (section du lot), `STATE.md`, `docs/architecture.md`, spec § 12 (sous-titre UI-2) ; aucune version

Spec § 9 tâche S3 (la part « docs » ; redéploiement, sondes et RESULTATS sont la Clôture, P-UI2-16) ; § 12 (« le § 12 de cette spec reçoit les rulings
de chaque lot sous son propre titre », § 9). Aucun fichier de `src/`, `tests/`, `tools/`, `supabase/` ni `sw.js` : aucune version (P-UI2-20), la suite
n'est pas relancée par cette tâche (elle l'est à la Clôture, `/verify`). Aucun appel réel, aucun secret, aucune adresse de personne, aucun nom de
personne autre que Neegan.

**Files:**
- Modify: `CLAUDE.md` (2 892 lignes à `f3672be` ; la section du lot s'insère entre la fin de la section du lot F — l. 2824, `VERT
  (\`verify-F-b65988f.txt\`), registre copié.` — et la ligne 2826 `## La présentation du serveur (18 octobre 2026, lot borné après la passerelle)`).
- Modify: `STATE.md` (400 lignes ; l. 1 : le titre ; un bloc neuf inséré entre la l. 2 (vide) et la l. 3, qui commence par
  `**23 octobre 2026, 17 h 30 — CHAÎNE A → F EN LIGNE.**`).
- Modify: `docs/architecture.md` (1 481 lignes ; l. 22 : la ligne `creation-ia.js (…)` de la carte des modules gagne `apercu-web.js` ; l. 1429 : la
  phrase « cinquième et dernier outil de `OUTILS` = `OUTILS_0006` » du lot F est amendée ; une section neuve s'insère entre la fin de la section du
  lot F — l. 1444 — et la l. 1446 `## Modèle de données (magasins IndexedDB)`).
- Modify: `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (650 lignes ; un sous-titre `###` inséré entre la fin de « ### Specs
  amendées par ce lot » — l. 630 — et la l. 632 `## 13. À trancher par Neegan (sans urgence ; chaque point a son défaut, construit tel quel)` ;
  rien d'autre dans la spec : P-UI2-17).
- Lu, jamais modifié : `.superpowers/sdd/2026-10-23-apercus-web/progress.md`, les rapports des tâches 1 et 2 (`task-1-report.md`, `task-2-report.md`
  et leurs rondes, s'ils existent sous ces noms : sinon les fichiers du registre que `progress.md` nomme), `git log --oneline f3672be..HEAD`,
  `supabase/proofs/RESULTATS-mitsu.md` (les deux sections « à jouer » posées par la tâche 1).

**Interfaces:**
- Consumes : les valeurs MESURÉES des tâches 1 et 2 (Node 227/227 attendu ; suite 6038/6038 et épingle 6037 attendues ; `sw.js` `-1` ou plus si une
  ronde a touché `src/` ; les SHA des commits de tâche et de ronde ; le nombre de mutants rouges par tâche et les équivalents nommés ; les écarts
  d'intention consignés dans `progress.md`) ; les rulings de plan P-UI2-1 à P-UI2-23 (Global Constraints) ; les textes de § 5 et § 6 de la spec.
- Produces : quatre documents amendés, un commit. Dans les gabarits ci-dessous, **chaque `<…>` est une valeur à lire dans le registre ou dans `git
  log`, à remplacer AVANT le commit ; le Step 5 vérifie qu'aucun chevron ne reste dans les lignes ajoutées**. Les nombres écrits en clair (227, 6038,
  6037, `0.16.0`, `-1`) sont les attendus du plan : si la mesure lue diffère, la mesure gagne et l'écart est une ligne de `progress.md`.

- [ ] **Step 0 : relevés (aucune écriture).** Lire, dans l'ordre : `progress.md` (mesures de départ, de la tâche 1 et de la tâche 2 : suite,
  épingle, Node, `--check`, `tsc`, `sw.js`, écarts nommés, rulings de construction) ; les rapports des tâches 1 et 2 (mutants : nombre joué, rouges,
  équivalents ; rondes : constats et correctifs) ; `git log --oneline f3672be..HEAD` (les SHA : tâche 1, sa ronde, tâche 2, sa ronde) ;
  `grep -n "APP_VERSION\|DB_VERSION" src/model/schema.js` (`0.16.0`, `4`) ; `grep -n "^const VERSION" sw.js` (`cuisine-os-v0.16.0-N`) ;
  `sed -n '250p' tests/tests.js` (l'épingle, attendue 6037) ; `git status --short` (propre). Noter ces valeurs dans `progress.md` (une ligne
  « tâche 3 : relevés ») : elles remplacent les chevrons des gabarits. Vérifier que les quatre ancres existent telles quelles (sinon NEEDS_CONTEXT) :

  ```bash
  grep -c "^## La présentation du serveur (18 octobre 2026, lot borné après la passerelle)$" CLAUDE.md
  grep -c "^\*\*23 octobre 2026, 17 h 30 — CHAÎNE A → F EN LIGNE\.\*\*" STATE.md
  grep -c "^## Modèle de données (magasins IndexedDB)$" docs/architecture.md
  grep -c "cinquième et dernier outil de \`OUTILS\` = \`OUTILS_0006\`, R-F-9" docs/architecture.md
  grep -c "^## 13\. À trancher par Neegan" docs/superpowers/specs/2026-10-23-experience-carnet-design.md
  ```

  Attendu : `1` cinq fois.

- [ ] **Step 1 : `CLAUDE.md` — la section du lot UI-2**, insérée AVANT la ligne `## La présentation du serveur (18 octobre 2026, lot borné après la
  passerelle)` (une ligne vide avant et après le bloc ; le motif des sections de lot : Pour toi, Où, Ce qui marche, Ce qui n'est PAS prouvé, Dettes,
  Gestes, Versions, Bilan) :

```markdown
### Aperçus des résultats web : l'outil `apercu-web`, `0007`, vignettes et ligne d'état de l'onglet Web (23-24 octobre 2026, lot UI-2)

**Pour toi.** Dans l'onglet Web, chaque résultat vient avec la photo de la page quand le site en publie une : juste après les liens, une ligne
« Photos en cours de récupération… », puis les photos arrivent d'un coup en tête des cartes ; sans photo nulle part, « Photos indisponibles pour cette
recherche. » ; quota atteint, « Quota du jour atteint : photos indisponibles. ». C'est un second appel de ton quota par recherche (deux au lieu d'un,
dit avant la tape : « Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour. »), zéro jeton, et jamais une
page ni une image chargée depuis ton appareil : c'est la fonction qui télécharge, avec ses hôtes refusés, ses redirections bornées et son
`User-Agent`. « Chercher à nouveau » ne repaie que les adresses neuves. Rien n'est écrit dans ta bibliothèque. Rien n'arrive sur le site public
avant `0007` (collée et prouvée par toi), le redéploiement de la fonction (chef d'orchestre), ta fusion et ton `push` ; **aucun aperçu réel n'a
encore été rendu**.

**Où.** Branche `apercus-web`, worktree `~/projects/mistu-apercus` (jamais `~/projects/mistu`), serveur de vérification
`python3 -m http.server 8095 --bind 127.0.0.1` (suite : `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095`). Base `f3672be` = `main`
`05c751f` + la spec « expérience carnet » (rév. 1 `0346a3b`, rév. 2 `20aa2fc`, rév. 2.1 `7633675`) + le « Go » de Neegan du 23 octobre (`f3672be`,
§ 13 : les sept défauts confirmés, dont les aperçus AUTOMATIQUES, D-UI-13). Spec : `docs/superpowers/specs/2026-10-23-experience-carnet-design.md`
(volet UI-2 : D-UI-12 à D-UI-14, I-UI-2, I-UI-5 à I-UI-7, § 4.6, § 6, § 7, § 10, § 11 ; § 12 sous-titre « Construction de UI-2 » : rulings de plan
P-UI2-1 à P-UI2-23 et de construction). Plan : `docs/superpowers/plans/2026-10-23-apercus-web.md`. Registre, hors git :
`.superpowers/sdd/2026-10-23-apercus-web/` (`progress.md`, un brief et un rapport par tâche, `suite.cjs`). Trois tâches : S1 serveur (`<sha T1>`
puis sa ronde `<sha T1-R1>`), S2 client (`<sha T2>` puis `<sha T2-R1>`), S3 docs (ce commit) ; le volet UI-1 « Carnet » (thème, grille, fiches,
icônes) est l'autre branche, `experience-carnet`, sur la même base. **PAS fusionné, PAS poussé, `0007` PAS collée, fonction `assistant` PAS
redéployée** (la version 4 du 23 octobre sert toujours : le chemin `apercu-web` n'existe pas encore sur `mitsu`).

**Ce qui marche, prouvé** (suite navigateur : `fetch` injecté, `chercher` et `apercus` factices, images fabriquées par canvas, aucun réseau, aucune
base ; tests Node : faux `Deno`, faux supabase-js, faux `fetch`, minuteries simulées ; **aucun appel réel, aucune sonde, fonction non redéployée**) :
- **Serveur** (`supabase/functions/assistant/`, sixième outil `apercu-web`, `OUTILS` = `OUTILS_0007`, sans modèle) : `lireDemande` lit `{ urls }` (1 à 5
  chaînes de 2 048 unités au plus, sinon 400 `requete` sans réservation), valide CHAQUE adresse par `valideAdresse` AVANT la réservation (`href` null =
  `interdit`), refuse 422 `interdit` sans réservation si aucune n'est admise ; `traiter` fait UNE réservation pour les cinq, pose un `AbortController`
  de 60 s (`LIMITES_APERCU.budgetMs`) relayé à chaque `suivreRedirections` et levé par le client parti (499, appel compté), dédoublonne pour le
  TÉLÉCHARGEMENT seulement, lance `apercuDe` à deux adresses à la fois (`PARALLELISME_APERCU`, `enParallele`) : `telechargerPage` →
  `lirePageHtml(...).page.image_url` (LA règle de F) → `telechargerImage(…, { max: LIMITES_APERCU.image })` (1 Mio ; le défaut d'`image-web` reste
  2 Mio) → base64 dès réception ; rend `{ apercus: [{ url (la chaîne reçue, dans l'ordre), image: { type, taille, octets } | null, raison: null |
  interdit | inaccessible | pas_de_recette | pas_d_image | image_trop_lourde | delai }] }`, une seule clé, jamais un corps d'erreur ; journal `apercu-web`
  200 (499), jetons `null`. `0007_apercu_web.sql` (à la main : `drop` puis `add` de `assistant_journal_outil_check` à six valeurs, une transaction) et sa
  preuve (11 verdicts : 1.01 à six valeurs, 2.03 ter `apercu-web`, 3.01 les cinq anciens ; BILAN attendu `0 faux sur 11`) ; README étape 13 ;
  RESULTATS : « Preuve `0007_apercu_web.sql` — à jouer » et « Sondes `apercu-web` — à jouer » (S-A1 à S-A7) ; générateur « la 0008 à venir ».
  Tests Node : logique (OUTILS, LIMITES_APERCU, formes, validation par adresse, journal), index v1 à v9 (refus avant réservation, nominal,
  dédoublonnage, raisons par adresse, borne 1 Mio et cinq images sous 8 Mio, parallélisme 2, budget 60 s en vol et jamais commencée, 499, 502 sur
  `0007` absente et 429), générateur (`0007`, preuve, README 13, RESULTATS, « 0008 », `OUTILS` = `OUTILS_0007`, `index.ts` UI-2 : `apercuDe` après
  `traiter`, N-1).
- **Domaine client** (`src/domain/apercu-web.js`, neuf ; `src/core/image.js`) : `lireApercusWeb({ urls, session }, { fetch, signal, tentativeMs 135 000,
  corpsMax 8 Mio })` : UN POST `{ outil: 'apercu-web', corps: { urls } }` par la passerelle (trois en-têtes, `redirect: 'error'`, `credentials: 'omit'`),
  sans session aucun fetch ; le 200 est une donnée hostile : UNE clé par adresse DEMANDÉE dans l'ordre (absente → `illisible`, non demandée ignorée),
  type dans la liste des couvertures, taille bornée à 1 Mio AVANT tout décodage, base64 relu à la longueur exacte (`lireOctetsBase64`), puis LE mur de
  F sans ré-encodage (`preparerPhotoDistante(blob, { coteMin, reencoder: false })` : en-tête du même type que l'annonce, ≤ 16 Mpx, petit côté ≥ 200 px,
  `createImageBitmap` jamais appelé) sinon `image_refusee` ; décodage adresse par adresse ; échecs de l'appel entier classés (`quota` écrit,
  `trop_de_demandes`, `interdit`, `requete`, `non_connecte`, `non_admis`, `serveur`, `delai`, `reseau`, `interne`) ; ne lève jamais ; le jeton n'est dans
  aucun résultat.
- **Écran** (`src/ui/search.js`) : `Map(href → { blob, type } | { raison })` au niveau du module, à côté de `memoire` ; une vue CONNECTÉE qui rend un
  « trouvé » demande les adresses ABSENTES (0 appel sur la même liste ; un appel pour les trois adresses neuves sur cinq ; les entrées des liens
  disparus sont lâchées à chaque « trouvé » reçu, Blob compris ; `reinitialiserWeb()` vide tout) dans UN vol d'aperçus, abandonné par `lancer()`,
  « Annuler », la dernière vue déconnectée et `reinitialiserWeb()` ; un résultat tardif d'un vol abandonné est muet ; les figures
  (`figure.apercu > img.plat-vignette.grande[alt='']`, en TÊTE des cartes qui ont l'image) sont insérées en UNE fois (un seul redessin) ; URL `blob:`
  recréées au rendu, révoquées par `remplacerEnRevoquant` et au changement de route, Blob gardés ; `img.onerror` → figure retirée, URL révoquée, entrée
  remplacée ; ligne d'état `p.muted[data-role=etat-apercus]` sous « Demande envoyée » dans ses trois formes ; texte de garde « 2 appels » ;
  `deps.apercus` (défaut `lireApercusWeb` ; `null` quand `deps.chercher` est injecté seul : les tests de route d'avant le lot n'appellent rien).
- **Filets** : `MODULES_NEUFS` + `apercu-web.js`, `SHELL` + `./src/domain/apercu-web.js`, les quatre clés de § 5 dans `en.js` et l'ancienne garde
  retirée, test de source I-F3 étendu à `search.js` et `library.js` (S-16), `Anthropic|Supabase` absent du domaine, 15 lignes de pins à `0.16.0`.

**Ce qui n'est PAS prouvé.** **`0007` et sa preuve** : jamais jouées sur `mitsu` (et, pglast étant absent de ce Mac, leur syntaxe n'est vérifiée
que par les tests de texte : le collage de Neegan est la preuve). **Le chemin `apercu-web` sous le vrai runtime** : la fonction n'est pas redéployée ;
S-A1 à S-A7 n'ont pas été jouées — la taille réelle de la réponse (K-5), la durée totale, le compte d'`image_trop_lourde` sur « puttanesca » (décide si
la borne passe de 1 à 2 Mio, B-M-6, P-UI2-4), la mémoire et le CPU de l'isolat au parallélisme 2 (« cinq pages hostiles de 2 Mio »), le 499 d'un
client parti. **Aucun aperçu réel** dans l'app (preuve § 10 UI-2 : geste de Neegan après le push). **Safari et l'iPhone** : rien (une réponse de 7 Mio
lue en texte puis décodée adresse par adresse, `OffscreenCanvas` des tests ≠ l'appareil). Le rendu de la figure (4:3, taille) est celui de UI-1 :
ici la figure hérite de la règle 72 px de `.plat-vignette` (P-UI2-10). Les tests sensibles au temps (v7 (b), `attendre` de l'`onerror`) : un rouge se
rejoue avant d'être un constat (R-B-15).

**Dettes et limites (assumées, une ligne chacune ; spec § 11 UI-2 et § 12 sous-titre UI-2).** P-UI2-6 : un échec de l'appel entier (panne réseau
passagère) prive la même liste de liens de ses photos jusqu'à un changement de liens ou un rechargement · P-UI2-7 : une nouvelle instance de la
route rend son premier « trouvé » déconnectée : ses adresses manquantes attendent le prochain redessin connecté · P-UI2-9 : après « Annuler », la vue
redessinée sur le « trouvé » K1 repose un vol · P-UI2-2 : la table des raisons par entrée est un choix de plan (diagnostic seulement, aucune raison
affichée par carte) · P-UI2-1 : une chaîne de plus de 2 048 unités refuse tout l'appel (400) · quota : 2 appels par recherche illustrée (30 par
jour) ; vie privée : jusqu'à 10 requêtes signées `Mitsu/0.10 (+https://neegans.github.io/mistu/)` par recherche vers des pages que la personne n'a
pas choisies (§ 11 ; renversable vers une tape « Voir les photos (1 appel) », § 13 point 2) · amplification : un appel du quota achète jusqu'à 10
téléchargements (15 Mio, 60 s), mêmes règles SSRF que B et F (résidu R-B-21) · une image au-delà de 1 Mio manque en silence (`image_trop_lourde`) ·
une page sans `Recipe` ni `og:image` n'a pas d'aperçu ; un 403 anti-hotlink rend `inaccessible` · deux copies de la borne 1 Mio (serveur
`LIMITES_APERCU.image`, client `LIMITES_APERCU_WEB.octets`), à bouger ensemble · `apercuDe` et `enParallele` déclarées après `traiter` (N-1, P-UI2-3) ·
les figures arrivent 20 à 90 s après les résultats, en une fois (la liste descend d'un coup) · mutants : `<n T1>` rouges sur `<n T1>` (tâche 1), `<n T2>`
sur `<n T2>` (tâche 2) ; équivalents nommés : `<aucun, ou leur liste>`.

**Gestes, dans l'ordre (dépense dite à chaque pas).** 1) **Neegan, `0007` AVANT le redéploiement et AVANT tout `push` de UI-2** (`supabase/README.md`,
étape 13, points 1 à 4) : coller `supabase/migrations/0007_apercu_web.sql` entière (attendu `Success. No rows returned`), relever
`shasum -a 256 supabase/migrations/0007_apercu_web.sql`, jouer `supabase/proofs/0007_apercu_web.sql` (« Run without RLS », rien à remplacer) : `999 BILAN`
= `0 faux sur 11`, tableau collé dans `RESULTATS-mitsu.md`, section « Preuve `0007_apercu_web.sql` — à jouer » ; la preuve `0006` devient historique
(son 1.01 rougit, voulu). Sans dépense. 2) **Chef d'orchestre, après le geste 1** : redéploiement `supabase functions deploy assistant --project-ref
ybdooerfeziiabsbfxtb --no-verify-jwt --use-api` depuis le worktree (version 5 attendue ; version et `ezbr_sha256` dans « Sondes `apercu-web` ») ;
sondes sans dépense S-A1, S-A2, S-A4, S1-S9, S13-S19, S-F1 à S-F3 et le `GET` d'état ; S-A3 (un appel du quota, zéro jeton) ; puis S-A5 (« puttanesca »),
S-A6 (page de liste), S-A7 (cinq pages hostiles, si un hôte public contrôlé existe ; sinon « non jouée », P-UI2-19) ; la session de Neegan par le
script d'attente du presse-papiers, jamais dans une commande. Si S-A5 compte des `image_trop_lourde` : ronde « borne 2 Mio » (les deux constantes,
v5, le test du domaine) AVANT la fusion. 3) **Neegan** : après `/verify` : `! git -C ~/projects/mistu merge --ff-only apercus-web` si `main` est encore
`05c751f` (sinon, UI-1 fusionné d'abord : un commit de fusion qui résout `sw.js` (union de `SHELL`, `VERSION` +1), `src/model/schema.js` et les pins,
`src/i18n/en.js` (union), `tests/tests.js:250` remesuré — spec § 9), puis `! git -C ~/projects/mistu push origin main` ; suite publique
`https://neegans.github.io/mistu/tests/` → `6038/6038` (épingle 6037 ; plus le 404 de `/favicon.ico`), service worker `cuisine-os-v0.16.0-<N>`.
4) **Preuve § 10 UI-2 sur le site public**, connecté : « puttanesca » dans l'onglet Web → « Photos en cours de récupération… » puis des photos en
tête des cartes, posées d'un coup ; `select jour, appels from public.assistant_usage_jour;` : +2 par recherche ; `select outil, statut, jetons_entree,
jetons_sortie, duree_ms from public.assistant_journal order by id desc limit 2;` : une ligne `recherche-web` puis une ligne `apercu-web` ;
« Chercher à nouveau » → au plus un appel de plus ; une recherche dont les sites n'ont pas d'image → « Photos indisponibles pour cette recherche. ».
5) Tous les appareils sur 0.16.0 avant la première recherche illustrée d'une bibliothèque partagée (rien n'est écrit par ce lot : règle de confort,
R-C-32). 6) iPhone : le même parcours depuis l'app installée (durée en réseau mobile). 7) Décisions, sans urgence : la borne 1 ou 2 Mio (B-M-6),
`PARALLELISME_APERCU` 1, 2 ou 3 (S-2), le mode automatique ou la tape « Voir les photos (1 appel) » (§ 13 point 2, confirmé le 23 octobre),
P-UI2-6, P-UI2-7, P-UI2-9. 8) « clean » seulement après la copie du registre dans `~/projects/mistu/.superpowers/sdd/` (serveur 8095 arrêté,
worktree `mistu-apercus` retiré ; la branche `experience-carnet` reste : UI-1).

**Versions.** `APP_VERSION 0.16.0` (F : 0.15.0 ; I-UI-7 : le premier lot UI fusionné porte 0.16.0, le second 0.17.0) ; `sw.js`
`cuisine-os-v0.16.0-1` (tâche 2) puis `-<N>` (+1 par commit qui touche `src/` ou `sw.js`, rondes comprises, R-B-24) ; `SHELL` +
`./src/domain/apercu-web.js` ; `DB_VERSION` 4 inchangée ; la migration `0007` est côté serveur, écrite à la main (hors `NOMS` et `--check`, comme
`0004` et `0006`) ; CSP inchangée (`img-src 'self' blob: data:` : aucune image externe chargée par le navigateur).

**Bilan.** Départ sur `f3672be` (mesure = F : 5948/5948, épingle 5947, Node 208/208, `--check` 0, `tsc` 0) ; tâche 1 (serveur) : Node 208 → `<227>`,
`tsc` 0, `--check` 0, suite inchangée, `<n T1>` mutants rouges ; tâche 2 (client) : suite 5948 → `<6038/6038>` (épingle `<6037>`), Node inchangé,
`<n T2>` mutants rouges ; tâche 3 : ces documents. Rondes : `<une ligne par ronde : sha, constats, correctifs ; ou « aucune »>`. Revue finale de
branche, vague et `/verify` : à la clôture du chef d'orchestre (plan, section « Clôture »).
```

  Aucune autre ligne de `CLAUDE.md` ne change (la section du lot F reste telle qu'elle était à sa clôture : « fonction À REDÉPLOYER » y est
  historique, le `STATE.md` du 23 octobre dit la version 4).

- [ ] **Step 2 : `STATE.md`.** (a) La l. 1 (le titre, qui commence par `# STATE.md — Cuisine OS (mistu) — état au 23 octobre 2026, 17 h 30`) est
  REMPLACÉE entière par :

```markdown
# STATE.md — Cuisine OS (mistu) — état au <date et heure de ce commit, HAE> (chaîne A → F EN LIGNE : `main` = `05c751f`, 0.15.0, suite publique 5948/5948, migrations `0005` et `0006` collées et prouvées, fonction `assistant` version 4 ; LOT UI-2 « APERÇUS DES RÉSULTATS WEB » FINI dans le worktree `~/projects/mistu-apercus` (branche `apercus-web`, 0.16.0), PAS fusionné, `0007` PAS collée, fonction PAS redéployée ; lot UI-1 « Carnet » à construire sur `experience-carnet` ; reste à Neegan : `0007` et sa preuve, appareils à jour, preuves réelles sur le site public, décisions ouvertes, révocation de l'ancienne clé, « clean »)
```

  (relire `git -C ~/projects/mistu ls-remote origin main` : si `origin/main` n'est pas `05c751f`, écrire la valeur lue). (b) Entre la l. 2 (vide) et la
  l. 3 (`**23 octobre 2026, 17 h 30 — CHAÎNE A → F EN LIGNE.**`), insérer ce bloc suivi d'une ligne vide :

```markdown
**<date>, <heure> — LOT UI-2 « APERÇUS DES RÉSULTATS WEB » : FINI dans le worktree `~/projects/mistu-apercus` (branche `apercus-web`, base
`f3672be` = `main` `05c751f` + la spec « expérience carnet » rév. 2.1 `7633675` + le « Go » du 23 octobre `f3672be` ; plan
`docs/superpowers/plans/2026-10-23-apercus-web.md` ; tête de code `<sha du dernier commit de code>` ; serveur 8095), trois tâches (S1 serveur `<sha T1>`
<+ sa ronde>, S2 client `<sha T2>` <+ sa ronde>, S3 docs = ce commit), `/verify` mécanique : à la clôture du chef d'orchestre ; mesures à la tête :
suite `<6038/6038>` (épingle `<6037>`), Node `<227/227>`, `--check` 0, `tsc` 0, `sw.js cuisine-os-v0.16.0-<N>`, `APP_VERSION 0.16.0`, `DB_VERSION` 4 ;
`0007_apercu_web.sql` ÉCRITE (à coller par Neegan : README étape 13), fonction `assistant` À REDÉPLOYER (sixième outil `apercu-web` ; geste du chef
d'orchestre APRÈS la `0007` collée et prouvée). **PAS fusionné, PAS poussé.** Pour Neegan, dans l'ordre : `0007` + preuve (`0 faux sur 11`) ; puis le
chef : redéploiement, sondes S-A1 à S-A7 (S-A3 et S-A5 à S-A7 : un appel du quota chacune, zéro jeton) ; ronde « borne 2 Mio » si S-A5 l'impose ;
`/verify` ; `git merge --ff-only apercus-web` (si `main` est encore `05c751f`), push, suite publique `6038/6038`, preuve § 10 UI-2 (« puttanesca » :
la ligne « Photos en cours de récupération… » puis les photos d'un coup ; `assistant_usage_jour` +2 par recherche), tous les appareils sur 0.16.0,
iPhone, décisions (borne 1 ou 2 Mio, parallélisme, mode automatique ou tape), « clean ». Registre `.superpowers/sdd/2026-10-23-apercus-web/` (copie
dans `~/projects/mistu/.superpowers/sdd/`) ; rulings dans la spec § 12, sous-titre « Construction de UI-2 ». Prochain : Départ UI-1 « Carnet »
(branche `experience-carnet`, déjà créée sur `f3672be` ; worktree `~/projects/mistu-carnet`, serveur 8096, `APP_VERSION 0.17.0` pendant la
construction ; le second lot fusionné résout les quatre fichiers communs, spec § 9).**
```

  Rien d'autre ne change dans `STATE.md` (les blocs des lots A à F décrivent chaque lot tel qu'il était à sa clôture).

- [ ] **Step 3 : `docs/architecture.md`**, trois retouches par leur texte. (a) Carte des modules : après la ligne
  `             creation-ia.js (demande, validation, fabrication et appel de « Créer une recette avec l'assistant » — voir cette section)` (l. 22,
  unique), insérer :

```text
             apercu-web.js (les aperçus des résultats web : un appel `apercu-web` par la passerelle, le 200 lu comme une donnée hostile, le mur de F sans ré-encodage — voir « Aperçus des résultats web »)
```

  (b) Section du lot F, l. 1429 : `- **Serveur** (\`supabase/functions/assistant/\`, outil \`image-web\`, cinquième et dernier outil de \`OUTILS\` =
  \`OUTILS_0006\`, R-F-9) : télécharge l'image` devient `- **Serveur** (\`supabase/functions/assistant/\`, outil \`image-web\`, cinquième outil de
  \`OUTILS\` = \`OUTILS_0006\`, R-F-9 ; depuis le lot UI-2, \`OUTILS\` = \`OUTILS_0007\` et \`apercu-web\` est le sixième et dernier) : télécharge l'image`
  (le reste de la ligne inchangé). (c) AVANT la ligne `## Modèle de données (magasins IndexedDB)` (l. 1446), une section neuve (une ligne vide avant
  et après) :

```markdown
## Aperçus des résultats web (lot UI-2, 23-24 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (volet UI-2 : D-UI-12 à D-UI-14, I-UI-2, I-UI-5 à I-UI-7, § 4.6, § 6, § 7, § 11 ;
§ 12 sous-titre « Construction de UI-2 »). Livré ici (branche `apercus-web`, sur `main` `05c751f` + la spec, non fusionnée) : les vignettes des
résultats de l'onglet Web, rendues par un sixième outil serveur sans modèle, avec une migration écrite à la main (`0007`) ; la fonction `assistant`
doit être redéployée. Rien n'est écrit dans `files` ni dans aucun magasin ; `DB_VERSION` 4.

```text
src/ui/search.js  (onglet Web, issue « trouvé ») ──► deps.apercus = lireApercusWeb({ urls: hrefs ABSENTS de la Map, session }, { signal })
   │   Map(href → { blob, type } | { raison }) au niveau du module, à côté de `memoire` ; UN vol d'aperçus (volApercus : controller, promesse, hrefs, garde)
   │   demandé par une vue CONNECTÉE qui rend un « trouvé » ; abandonné par lancer(), annuler(), la dernière vue déconnectée (MutationObserver du document,
   │   le temps du vol), reinitialiserWeb() ; un résultat d'un vol abandonné est MUET ; à la réception : une entrée par adresse demandée, puis UN notifier()
   │   (les figures de toute la liste en un seul redessin) ; elaguerApercus(issue) à chaque « trouvé » reçu lâche les href sortis des liens, Blob compris.
   ▼
src/domain/apercu-web.js  lireApercusWeb → appelerAssistant('apercu-web', { urls }, { fetch, session, config, signal, tentativeMs 135 000, corpsMax 8 Mio })
   │   le 200 est une donnée hostile : Object.hasOwn, UNE clé par adresse DEMANDÉE (absente → illisible ; non demandée ignorée ; la première entrée gagne),
   │   type ∈ COVER_INPUT_MIME, taille ≤ 1 Mio AVANT atob, lireOctetsBase64 à la longueur exacte, preparerPhotoDistante(blob, { coteMin, reencoder: false })
   │   (le mur de F : en-tête lu = type annoncé, ≤ 16 Mpx, petit côté ≥ 200 px ; sans reduireImage) sinon image_refusee ; décodage adresse par adresse.
   ▼
supabase/functions/assistant  POST { outil: 'apercu-web', corps: { urls: [1..5] } }
   lireDemande → lireDemandeUrls : liste blanche { urls } (1 à 5 chaînes ≤ 2 048, sinon 400 forme) ; valideAdresse(url, { hotesRefuses }) sur CHACUNE,
   AVANT la réservation : refusée → { url, href: null } (l'entrée interdit) ; aucune admise → 422 interdit sans réservation.
   traiter : UNE réservation (assistant_reserver, 'apercu-web') ; budget = AbortController 60 s (LIMITES_APERCU.budgetMs) relayé à chaque
   suivreRedirections et levé par ctl (120 s, client parti → 499) ; hrefs dédoublonnés pour le TÉLÉCHARGEMENT seulement ;
   enParallele(hrefs.map(h => () => apercuDe(h)), PARALLELISME_APERCU = 2) ; réponse { apercus: [{ url (chaîne reçue, ordre reçu),
   image: { type, taille, octets base64 } | null, raison }] }, une seule clé, jamais usage ni model ; journal 200 (499), jetons null.
   apercuDe(href) : telechargerPage (LIMITES_LECTURE) → lirePageHtml(...).page.image_url (LA règle de F) → telechargerImage(adresse, { max: 1 Mio })
   → base64 dès réception ; ne lève jamais : interdit | inaccessible | pas_de_recette | pas_d_image | image_trop_lourde | delai (RAISON_PAGE, RAISON_IMAGE).
   Déclarée APRÈS traiter (N-1 épingle le flux par la première occurrence des points d'appel).
```

- **Serveur** : `logique.js` — `OUTILS` à six (= `OUTILS_0007`, `apercu-web` dernier ; `OUTILS_MODELE` inchangé : ni `image-web` ni `apercu-web`
  n'atteint le modèle), `LIMITES_APERCU = { adresses: 5, budgetMs: 60000, image: 1 Mio }`, `PARALLELISME_APERCU = 2`, `lireDemandeUrls` ; `index.ts` —
  `telechargerImage(href, { signal, hotesRefuses, max = LIMITES_IMAGE.octets })` (2 Mio par défaut : `image-web` inchangé), le bloc `apercu-web` de
  `traiter` entre `image-web` et le modèle, `apercuDe`, `enParallele`, `RAISON_PAGE`, `RAISON_IMAGE` ; `0007_apercu_web.sql` (à la main, hors `NOMS` et
  `--check` : `drop` puis `add` de `assistant_journal_outil_check` à six valeurs, une transaction, aucune fenêtre sans contrainte) et sa preuve (11
  verdicts, `rollback;` dernier ; la preuve `0006` devient historique : son 1.01 rougit après `0007`) ; README étape 13 ; le générateur dit « la 0008 à
  venir ». Sans `0007`, l'insert d'`assistant_reserver('apercu-web')` lève 23514 → 502 `serveur` : l'app montre les résultats sans image (D-UI-14).
- **Client** : `src/core/image.js` — `preparerPhotoDistante(blob, { coteMin, reencoder = true })`, `reencoder: false` rend LE MÊME Blob contrôlé ;
  `src/domain/apercu-web.js` — `LIMITES_APERCU_WEB` (5 adresses, `url` 2 048, `octets` 1 Mio, `corpsReponse` 8 Mio, `tentativeMs` 135 000, `types` =
  `COVER_INPUT_MIME`), `RAISONS_ENTREE_APERCU` (les six du serveur + `illisible`, `image_refusee`), `RAISONS_ECHEC_APERCU` (liste fermée ; toute autre →
  `interne`), `lireApercusWeb` (ne lève jamais ; le jeton n'entre dans aucun objet rendu) ; `src/ui/search.js` — `apercus`, `volApercus`, `etatApercus()`
  (tests), `abandonnerApercus`, `elaguerApercus`, `demanderApercus`, `figureApercu` (`figure.apercu` > `img.plat-vignette.grande[alt='']`, URL `blob:`
  neuve à chaque rendu, révoquée par `remplacerEnRevoquant` et au changement de route ; `img.onerror` → figure retirée, URL révoquée, entrée
  `image_refusee`), `ligneEtatApercus` (`p.muted[data-role=etat-apercus]` : « Photos en cours de récupération… » | « Photos indisponibles pour cette
  recherche. » | « Quota du jour atteint : photos indisponibles. » | rien), `deps.apercus` (défaut `lireApercusWeb` ; `null` quand `deps.chercher` est
  injecté seul) ; texte de garde « Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés dans ton quota du jour. ».
- **Limites nommées** (spec § 11, § 12) : 2 appels par recherche illustrée ; jusqu'à 10 requêtes signées Mitsu par recherche vers des pages non
  choisies (mode automatique, § 13 point 2) ; un appel du quota achète jusqu'à 10 téléchargements (15 Mio, 60 s) ; une image au-delà de 1 Mio manque en
  silence ; les échecs de l'appel entier sont mémorisés par adresse jusqu'à un changement de liens (P-UI2-6) ; une nouvelle instance de la route rend
  son premier « trouvé » déconnectée (P-UI2-7) ; la figure hérite de la règle 72 px de `.plat-vignette` tant que UI-1 ne pose pas `.grande` (P-UI2-10).
```

- [ ] **Step 4 : spec § 12, sous-titre UI-2**, inséré AVANT la ligne `## 13. À trancher par Neegan (sans urgence ; chaque point a son défaut, construit
  tel quel)` (une ligne vide avant et après ; rien d'autre dans la spec, P-UI2-17 ; les rulings de construction R-UI2-… viennent de `progress.md` et
  des rapports : une ligne par écart nommé — forme adaptée au code réel, décision d'une ronde, mutant équivalent déclaré — ; s'il n'y en a aucun,
  écrire « aucun écart de construction nommé ») :

```markdown
### Construction de UI-2 « Aperçus » (23-25 octobre 2026 ; plan `docs/superpowers/plans/2026-10-23-apercus-web.md`, rév. 2 ; rulings de plan P-UI2-1 à P-UI2-23 ; rulings de construction R-UI2-1 à R-UI2-<n>)

Branche `apercus-web` sur `f3672be` (worktree `~/projects/mistu-apercus`, serveur 8095) ; trois tâches (S1 serveur `<sha T1>`, S2 client `<sha T2>`,
S3 docs `<sha T3>`) ; mesures à la tête : suite `<6038/6038>` (épingle `<6037>`), Node `<227/227>`, `--check` 0, `tsc` 0, `APP_VERSION 0.16.0`,
`sw.js cuisine-os-v0.16.0-<N>`, `DB_VERSION` 4. Les décisions du 23 octobre (§ 13) sont construites telles quelles : aperçus AUTOMATIQUES (D-UI-13).
`0007` ÉCRITE, pas collée ; fonction `assistant` pas redéployée ; aucune sonde S-A1 à S-A7 jouée : la Clôture du plan les porte.

Rulings de plan (une ligne chacun ; détail dans le plan, « Global Constraints ») :
- **P-UI2-1** une chaîne de plus de 2 048 unités dans `urls` → 400 `forme` (tout l'appel, sans réservation), pas une entrée `interdit` (§ 6 lu à la lettre).
- **P-UI2-2** table des raisons par entrée : `pas_une_page` et page de liste → `pas_de_recette` ; page `trop_lourde` → `inaccessible` ; `pas_une_image` →
  `pas_d_image` ; redirection refusée → `interdit` ; `pas_d_image` réservé à une `Recipe` lisible unique sans image.
- **P-UI2-3** `apercuDe` et `enParallele` déclarées APRÈS `traiter` (le test d'ordre N-1 épingle la première occurrence des points d'appel).
- **P-UI2-4** la borne de 1 Mio vit en deux copies (`LIMITES_APERCU.image`, `LIMITES_APERCU_WEB.octets`) : à bouger ensemble (ronde avant la fusion si S-A5 l'impose, B-M-6).
- **P-UI2-5** `tests/photo-plat.js:1331` (la spec dit « :1330 ») étendu à `search.js` ET `library.js` dès ce lot (S-16 à la lettre, coût nul ; UI-1 n'y touche plus).
- **P-UI2-6** les échecs de l'appel entier sont mémorisés par adresse (S-5, K-1) : une panne passagère prive la même liste jusqu'à un changement de liens.
- **P-UI2-7** une nouvelle instance de la route rend son premier « trouvé » déconnectée : ses adresses absentes attendent le prochain redessin connecté.
- **P-UI2-8** `img.onerror` remplace aussi l'entrée de la Map par `{ raison: 'image_refusee' }` (S-7 précisé) — seulement si l'URL était encore vivante
  (`revoquerUrlDeBlob(u)` vrai) : une `error` d'URL déjà révoquée (redessin ou changement de route pendant le chargement) ne jette pas le Blob.
- **P-UI2-9** « Annuler » n'est éprouvé qu'à deux vues ; après « Annuler », la vue redessinée sur le « trouvé » K1 repose un vol (règle de § 4.6).
- **P-UI2-10** aucune règle CSS : la figure hérite de `.plat-vignette` 72 px tant que UI-1 ne pose pas `.grande` ; marge UA de `figure` à 0 en ligne.
- **P-UI2-11** `deps.apercus` : `lireApercusWeb` par défaut, `null` quand `deps.chercher` est injecté sans `deps.apercus` (F-10).
- **P-UI2-12** v7 (b) : minuteries coïncidentes à 60 s, test sensible à l'ordre des minuteries simulées (R-B-15).
- **P-UI2-13** pglast absent : la syntaxe de `0007` et de sa preuve n'est vérifiée que par les tests de texte ; la preuve est le collage.
- **P-UI2-14** `<scratchpad>` = le scratchpad de la session de l'implémenteur ; toute mutation sur copie.
- **P-UI2-15** 15 lignes de pins (13 assertions, un commentaire, une ligne `const v`), pas « 13 + 1 ».
- **P-UI2-16** S3 de la spec coupée : docs = tâche 3 ; redéploiement, sondes, RESULTATS = Clôture (après la `0007` collée et prouvée).
- **P-UI2-17** la spec n'est amendée qu'ici (§ 12) ; titre, en-tête et § 13 restent à UI-1.
- **P-UI2-18** trailers des commits : le modèle réel de l'implémenteur (R-T1-3) ; `Claude-Session` quand le harnais la fournit.
- **P-UI2-19** S-A7 exige un hôte public contrôlé ; sinon « non jouée » (rouge nommé).
- **P-UI2-20** le commit de docs ne porte aucune version (R-B-24).
- **P-UI2-21** la table serveur → client de la tâche 2 emploie le corps réel du 400 (`{ erreur: 'requete' }`).
- **P-UI2-22** I-UI-5 : la liste blanche des aperçus est `COVER_INPUT_MIME` (JPEG, PNG, WebP), sous-ensemble gelé d'`ALLOWED_MIME` que `typeAffichage`
  applique aux lignes `files` ; la même liste que `LIMITES_IMAGE_WEB.types` et le mur distant ; un élargissement de `typeAffichage` seul ne touche pas les aperçus.
- **P-UI2-23** `tests/recherche-web.js:1027` (`forme`) reste stricte (ces tests n'injectent pas `deps.apercus` : « `FIGURE.apercu` optionnel » y vaut toujours
  « absent », un filtre serait du code mort aveugle à une figure parasite) ; une assertion « 0 `figure.apercu` » s'ajoute l. 1033 et l. 1226.

Rulings de construction (tâches 1 et 2, rondes ; une ligne chacun, depuis `progress.md` et les rapports) :
- **R-UI2-1** <écart nommé, sa raison, ce que le code fait ; ou « aucun écart de construction nommé »>
- <…une ligne par écart suivant…>

Mutants : tâche 1 `<n>` rouges sur `<n>` (dont les douze rejoués par l'auteur du plan), tâche 2 `<n>` rouges sur `<n>` (dont les n° 8 et 11 rejoués par
l'auteur du plan) ; équivalents déclarés : `<aucun, ou leur liste>`. Ce qui reste (§ 10, Clôture du plan) : `0007` et sa preuve (Neegan), redéploiement
et sondes S-A1 à S-A7 (chef), preuve § 10 UI-2 sur le site public, décisions : borne 1 ou 2 Mio (B-M-6), `PARALLELISME_APERCU` (S-2), mode automatique
ou tape (§ 13 point 2), P-UI2-6, P-UI2-7, P-UI2-9.
```

- [ ] **Step 5 : contrôles.** (1) `git status --short` ne liste que `CLAUDE.md`, `STATE.md`, `docs/architecture.md` et
  `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` ; `git diff --stat` ne nomme ni `src/`, ni `tests/`, ni `sw.js`, ni `supabase/`.
  (2) Aucun chevron de gabarit dans les lignes AJOUTÉES : `git diff -U0 -- CLAUDE.md STATE.md docs/architecture.md docs/superpowers/specs/2026-10-23-experience-carnet-design.md | grep '^+' | grep -c '<[^>]*>'`
  → `0` (les chevrons des flèches `→` ne comptent pas : ce sont d'autres caractères). (3) Les cinq ancres du Step 0 valent encore `1` chacune, et
  `grep -c "^### Aperçus des résultats web" CLAUDE.md`, `grep -c "^## Aperçus des résultats web" docs/architecture.md`,
  `grep -c "^### Construction de UI-2" docs/superpowers/specs/2026-10-23-experience-carnet-design.md` rendent `1`. (4) Invisibles (commande des Global
  Constraints) sur les quatre fichiers : 0 ; insécables U+00A0 / U+202F dans les lignes ajoutées : 0. (5) Secrets et adresses :
  `git diff -U0 | grep '^+' | grep -nEi 'sk-ant-|eyJ[A-Za-z0-9_-]{20,}|sb_secret_|AIza|[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}'` vide. (6) `git diff --check`
  muet. (7) Les mesures écrites (suite, épingle, Node, `sw.js`, SHA) sont celles de `progress.md` : relire côte à côte.

- [ ] **Step 6 : commit** (par chemins nommés : `git add CLAUDE.md STATE.md docs/architecture.md docs/superpowers/specs/2026-10-23-experience-carnet-design.md`,
  puis `git commit -- CLAUDE.md STATE.md docs/architecture.md docs/superpowers/specs/2026-10-23-experience-carnet-design.md` ; message ASCII sans accent ; trailer du modèle réel, ligne de session si le harnais la fournit ; aucune version,
  P-UI2-20) :

```
docs(lot UI-2): CLAUDE.md, STATE.md, architecture.md et spec § 12 pour les apercus des resultats web (tache 3)

CLAUDE.md : section du lot UI-2 (pour toi, ou, ce qui marche, non prouve, dettes, gestes, versions, bilan).
STATE.md : titre et bloc de tete (lot FINI, pas fusionne, 0007 pas collee, fonction pas redeployee ; prochain : UI-1).
docs/architecture.md : apercu-web.js dans la carte, section « Apercus des resultats web » (flux, serveur, client, limites), lot F amende (sixieme outil).
Spec § 12 : sous-titre « Construction de UI-2 » (rulings de plan P-UI2-1 a P-UI2-23, rulings de construction, mutants, ce qui reste).
Aucun fichier de src/, tests/, tools/, supabase/ ni sw.js : aucune version.

Co-Authored-By: <modele reel de l implementeur> <noreply@anthropic.com>
```

---

### Clôture (contrôleur, hors tâche)

- **Revue finale de branche** (panel à trois lentilles : besoin, sécurité, faisabilité ; sur `git diff f3672be...apercus-web`), vague de corrections
  (un commit par ronde, message ASCII ; `sw.js` +1 si la ronde touche `src/` ou `sw.js`, R-B-24), re-revue jusqu'à zéro constat Critical ou Important ;
  chaque ruling de ronde va dans `progress.md` ET dans la spec § 12, sous-titre « Construction de UI-2 » (R-UI2-…), avec le SHA.
- **`/verify`** sur la tête finale : suite `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095` (bilan `✅ N/N` lu, épingle = N − 1, une seule
  erreur de console — le 404 de `/favicon.ico` —, aucune réponse ≥ 400 autre), `node --test --test-timeout=10000 tools/*.test.mjs` (227 ou plus, tous
  verts), `node tools/generer-migrations.mjs --check` (0), `tsc --strict` sur `index.ts` (0), `APP_VERSION 0.16.0`, `sw.js cuisine-os-v0.16.0-N`,
  `DB_VERSION 4`, scan de secrets sur tout le diff `f3672be...HEAD` (motifs Anthropic, JWT, Supabase, Google, adresses : rien que les sentinelles de
  test, dont `jeton-apercus-sentinelle`), invisibles en Python `-I` sur tout le diff (0), `git diff --check` muet, aucun `styles.css` ni écran hors
  `search.js` dans `git diff --stat f3672be...HEAD -- src` ; **mutants** : la liste de la tâche 1 (Step 10) et celle de la tâche 2 (Step 11) rejouées
  sur la tête de branche APRÈS les rondes, sur des copies dans le scratchpad du contrôleur (chacun rouge, sortie lue ; les témoins verts nommés) ;
  bilan dans `verify-UI2-<sha>.txt` du registre. **« Vert conditionnel »** tant que `0007` n'est pas collée et prouvée par Neegan (vert du code,
  rouge nommé du déploiement) ; vert plein seulement après les sondes ci-dessous.
- **Geste de Neegan, AVANT le redéploiement et AVANT tout `push`** (`supabase/README.md`, étape 13, points 1 à 4 ; sans dépense) : coller
  `supabase/migrations/0007_apercu_web.sql` entière dans l'éditeur SQL de `mitsu` (attendu `Success. No rows returned` ; si la contrainte porte un autre
  nom, rien n'est appliqué et la garde 0 de la preuve le dit) ; relever `shasum -a 256 supabase/migrations/0007_apercu_web.sql` ; `notify pgrst, 'reload
  schema';` collée seule, facultative ; jouer `supabase/proofs/0007_apercu_web.sql` (« Run without RLS », rien à remplacer, aucune adresse) : lire `999
  BILAN`, attendu `0 faux sur 11`, dont 1.01 (les six outils dans l'ordre d'`OUTILS_0007`), 2.03 ter (`apercu-web` accepté par `assistant_reserver`) et
  3.01 (les cinq anciens) ; coller le tableau tel quel dans `supabase/proofs/RESULTATS-mitsu.md`, section « Preuve `0007_apercu_web.sql` — à jouer »
  (heure, empreinte, 12 lignes) ; la preuve `0006` devient historique (son 1.01 rougit : voulu). Un code servi avant `0007` : chaque demande d'aperçus
  répond 502 `serveur`, l'app montre les résultats sans image, rien d'autre ne change (D-UI-14).
- **Redéploiement de la fonction** (geste du contrôleur, APRÈS le geste ci-dessus ; il relit d'abord le BILAN `0 faux sur 11` et le verdict 2.03 ter
  dans `RESULTATS-mitsu.md`) : `~/.local/bin/supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api` depuis le
  worktree, à la tête vérifiée (CLI 2.121.0 extraite ; bundle côté serveur ; aucun `config.toml` dans le dépôt) ; `supabase functions list` : `ACTIVE`,
  `verify_jwt: false` ; version (5 attendue) et `ezbr_sha256` consignés dans la section « Sondes `apercu-web` — à jouer » de `RESULTATS-mitsu.md`, qui
  perd son « — à jouer » et gagne l'heure UTC, comme les sections des versions 1 à 4. Recul : `supabase functions deploy` depuis `0c7cbbd` (la version 4).
- **Sondes sans dépense** (`curl`, clé publique seule, `assistant_usage_jour` inchangé ; corps et statuts consignés dans la table S-A de RESULTATS) :
  S-A1 `{ outil: 'apercu-web', corps: { urls: 'x' } }` → 400 `requete`, aucune ligne au journal ; S-A2 `urls: ['http://exemple.test/', 'https://127.0.0.1/',
  'https://localhost/', 'https://ybdooerfeziiabsbfxtb.supabase.co/', 'https://exemple.test:8443/']` → 422 `interdit`, aucune ligne ; S-A4 sans jeton → 401
  `non_connecte` ; puis S1-S9 (lot 4), S13-S19 (lot B), S-F1 à S-F3 (lot F) rejouées, identiques, et le `GET` d'état (`cles`, `modele`, `quotaJour`). Toute
  dérive = une ronde AVANT la fusion.
- **Sondes avec la session de Neegan** (un appel du quota chacune, **zéro jeton** attendu : `jetons_entree` / `jetons_sortie` `null` au journal ; dépense
  dite à chaque pas ; le jeton copié depuis la console du site connecté par le script d'attente du presse-papiers vers un fichier d'en-tête à mode 600,
  `curl -H @fichier`, fichier vidé dès les sondes finies ; jamais dans une commande ni dans le chat) : S-A3 (une admise — la page Ricardo de S17 — et les
  quatre premières adresses de S-A2 → 200, `apercus[0]` avec `image` ou une raison, `apercus[1..4]` `{ image: null, raison: 'interdit' }`, UNE ligne
  `apercu-web` 200) ; S-A5 (les cinq adresses des liens de la recherche « puttanesca », relevées dans l'app : 200 en ≤ 60 s, cinq images ou raisons ;
  consigner la taille réelle de la réponse en octets (K-5), la durée (`duree_ms`), le compte d'`image_trop_lourde` — s'il est ≥ 1, **ronde « borne
  2 Mio »** AVANT la fusion : `LIMITES_APERCU.image`, `LIMITES_APERCU_WEB.octets`, v5 et le test « LIMITES_APERCU_WEB et listes fermées », B-M-6, P-UI2-4 ;
  et, si la durée dépasse 40 s, dire si `PARALLELISME_APERCU` passe à 3, S-2) ; S-A6 (une page de liste — une catégorie de recettes — → 200 avec
  `pas_de_recette`) ; S-A7 (« cinq pages hostiles de 2 Mio » en `https` sur un hôte public contrôlé par le contrôleur → 200 ou `delai` en moins de
  60 s, jamais un 502 d'isolat tué ; sans hôte disponible : « non jouée », P-UI2-19). Attendu dans `public.assistant_journal` (lu par Neegan) : une ligne
  `apercu-web` par sonde payante (S-A3, S-A5, S-A6, S-A7), statut 200, jetons `null` ; `assistant_usage_jour` du jour : 4 appels de plus. Chaque sonde se
  consigne dans la table « Sondes `apercu-web` » de `RESULTATS-mitsu.md` (statut obtenu, taille, durée, compte) ; ce commit de RESULTATS est celui du
  contrôleur, message ASCII, sans version.
- **Documents** (tâche 3 ; le contrôleur les complète si une ronde ou une sonde a changé une mesure : `CLAUDE.md` section du lot, `STATE.md` tête,
  spec § 12 sous-titre UI-2 — rulings de construction et de ronde R-UI2-… —, `docs/architecture.md` si une forme a changé) ; plan coché (chaque `- [ ]`
  des tâches faites → `- [x]`, commis avec les docs du contrôleur).
- **Registre** : copier `.superpowers/sdd/2026-10-23-apercus-web/` (progress, briefs, rapports, `suite.cjs`, `verify-UI2-<sha>.txt`, sorties des sondes
  sans jeton) dans `~/projects/mistu/.superpowers/sdd/` AVANT tout `git worktree remove` (`diff -rq` muet).
- **Gestes de Neegan, après les sondes et `/verify`** (dépense dite ; spec § 10 UI-2) : (1) **fusion** : `! git -C ~/projects/mistu merge --ff-only
  apercus-web` si `main` est encore `05c751f` (la branche porte les trois commits de spec et le « Go » : avance rapide) — si UI-1 a fusionné d'abord, un
  commit de fusion qui résout les quatre fichiers communs (`sw.js` : union de `SHELL`, `VERSION` +1 ; `src/model/schema.js` et les 15 lignes de pins
  selon I-UI-7 — le second lot fusionné porte `0.17.0` ; `src/i18n/en.js` : union ; `tests/tests.js:250` : remesuré sur l'arbre fusionné), relu ligne à
  ligne, suite rejouée sur l'arbre fusionné AVANT le push ; puis **un** `! git -C ~/projects/mistu push origin main` ; (2) suite publique
  `https://neegans.github.io/mistu/tests/` → `6038/6038` (ou la valeur de la tête finale ; épingle N − 1 ; plus le 404 de `/favicon.ico`), service worker
  `cuisine-os-v0.16.0-N` ; (3) **preuve § 10 UI-2**, connecté, onglet Réseau ouvert : « puttanesca » dans l'onglet Web → la ligne « Photos en cours de
  récupération… » puis des photos en tête des cartes, posées d'un coup ; `select jour, appels from public.assistant_usage_jour;` : +2 par recherche ;
  `select outil, statut, jetons_entree, jetons_sortie, duree_ms from public.assistant_journal order by id desc limit 2;` : une ligne `recherche-web` puis
  une ligne `apercu-web` ; « Chercher à nouveau » → au plus un appel de plus ; une recherche dont les sites n'ont pas d'image → « Photos indisponibles
  pour cette recherche. » ; noter la durée entre les liens et les photos ; (4) tous les appareils sur 0.16.0 (règle de confort : ce lot n'écrit rien) ;
  iPhone : le même parcours depuis l'app installée, durée en réseau mobile, taille lue dans l'onglet Réseau si disponible ; (5) décisions, sans urgence :
  borne 1 ou 2 Mio (B-M-6, d'après S-A5), `PARALLELISME_APERCU` (S-2), mode automatique ou tape « Voir les photos (1 appel) » (§ 13 point 2, confirmé le
  23 octobre, renversable), P-UI2-6, P-UI2-7, P-UI2-9 ; (6) « clean » : après la copie du registre, arrêter le serveur 8095 (PID dans
  `scratchpad/kit-ui/serveur-8095.pid` de la session du contrôleur), `git worktree remove` de `mistu-apercus` ; la branche `experience-carnet` et son
  futur worktree `mistu-carnet` restent (UI-1).
- **Prochain** : Départ UI-1 « Carnet » (plan 2 ; branche `experience-carnet`, déjà sur `f3672be` ; worktree `~/projects/mistu-carnet`, serveur 8096,
  `APP_VERSION 0.17.0` pendant la construction ; `SHELL` + `./src/ui/icones.js` ; les quatre fichiers communs à résoudre à sa fusion, spec § 9).

---

## Pré-vol (rév. 1 → rév. 2, 25 octobre 2026)

Dix-sept constats du pré-vol de la rév. 1 (lentilles ordre, fantômes, faux vert), relus sur le code de `f3672be` (lecture seule) ; chacun appliqué
par éditions ciblées, ou refusé avec sa raison. Une ligne par constat, dans l'ordre du pré-vol.

1. **« 0006 » (préfixe) annoncé ROUGE au rouge lu** — APPLIQUÉ (tâche 1, Step 4) : « 0006 » est écrit parmi les verts (`OUTILS` à cinq = `OUTILS_0006`,
   le préfixe tient déjà) ; seul « README : etape 12 » reste le rouge d'attente du Step 8.
2. **Test de source I-F3 étendu à `search.js` seul ; S-16 dit aussi `library.js`** — APPLIQUÉ (option 1 : l'extension dès ce lot) : `tests/photo-plat.js:1328`
   et `:1331` à cinq sources (`srcSearch`, `srcLib`) ; vérifié sur `f3672be` : aucun `src:` / `.src =` suivi de `https?:` dans `src/ui/library.js` (9 408
   caractères) → vert aujourd'hui, aucune dette croisée ; P-UI2-5 réécrit (Global Constraints, spec § 12, CLAUDE.md gabarit, Review Focus 5, Files et Step 3
   de la tâche 2).
3. **Trois textes pour la liste des sondes rejouées** — APPLIQUÉ : README étape 13 point 5 et section RESULTATS « Sondes `apercu-web` » disent la liste de
   la Clôture (S1-S9 du lot 4, S13-S19 du lot B, S-F1 à S-F3 du lot F, le `GET` d'état) ; la chaîne « S1-S9 du lot 4 » que le test cite reste contiguë
   (tests de texte inchangés).
4. **Mur du `fetch` et scène posés AVANT le `try`** — APPLIQUÉ (tâche 2, Step 1, second extrait) : `S`, `BU`, `EN`, `scene`, `PNG`, `IMG` déclarés `let`
   avant le `try`, assignés en TÊTE du `try` avec le mur ; `finally` à chaînage optionnel (`scene?.remove()`, `S?.reinitialiserWeb()`,
   `BU?.revoquerUrlsDeBlob()`) ; Global Constraints « Bases jetables » réécrites ; note d'ordre ajoutée au premier extrait.
5. **I-UI-5 nomme `typeAffichage`, le code lit `COVER_INPUT_MIME`** — APPLIQUÉ AVEC CORRECTION : le constat disait « la liste employée est la même » ;
   vérifié dans `src/sync/mime.js` : `typeAffichage` (l. 28) applique `ALLOWED_MIME` par `safeDisplayType` (JPEG, PNG, WebP, HEIC, PDF, EPUB), pas
   `COVER_INPUT_MIME` (l. 5 : JPEG, PNG, WebP, gelée, sous-ensemble). Ruling neuf **P-UI2-22** (Global Constraints et spec § 12) et commentaire de
   `figureApercu` (Step 7 (g)) : la liste des aperçus est `COVER_INPUT_MIME`, celle de `LIMITES_IMAGE_WEB.types` et du mur distant ; un élargissement de
   `typeAffichage` seul ne touche pas les aperçus, voulu.
6. **« Node 208/208 » trois fois dans la tâche 2** — APPLIQUÉ (Files, Step 4, Step 9) : « la valeur lue à la tête (227/227 si la tâche 1 est commise,
   208/208 sinon), inchangée par cette tâche ».
7. **Trois numéros de ligne dérivés (22, 1331, 190)** — APPLIQUÉ : `docs/architecture.md:22` (tâche 3, Files et Step 3 (a)), `tests/photo-plat.js:1331`
   (Global Constraints, tâche 2 Files, Step 0, Step 3 ; la l. 1330 = `img-src` nommée), `src/ui/search.js:190` (Step 7 (d), la l. 189 nommée). Vérifiés par
   `sed` sur `f3672be`.
8. **`img.onerror` jette un Blob valide quand l'`error` vient d'une URL révoquée** — APPLIQUÉ, par la SECONDE variante du constat (`if (revoquerUrlDeBlob(u))`,
   pas `img.isConnected`) : `src/app.js:80` révoque TOUTES les URL AVANT de remplacer l'écran (`revoquerUrlsDeBlob()` puis `replace(current.main, …)`),
   les `<img>` y sont encore attachés — `isConnected` ne discriminerait pas le changement de route ; `revoquerUrlDeBlob` rend `false` pour une URL déjà
   révoquée (`src/core/blob-urls.js`). P-UI2-8 réécrit (Global Constraints, spec § 12), commentaire et code de `figureApercu` (Step 7 (g)), Review Focus 5 ;
   un mutant 24 et une assertion neuve le prouvent (constat 16).
9. **Mutant 14, variante `reinitialiserWeb()`, survivant** — APPLIQUÉ (Important) : dans le bloc F-10/S-4, `S.reinitialiserWeb()` est appelé PENDANT un
   vol (`dVol = p.demandes[1]`) → `[signal.aborted, etatApercus()]` = `[true, { hrefs: [], blobs: 0, enVol: null }]`, puis le résultat tardif muet ; la
   vérification « après réception » se rejoue sur un vol frais (`root3`, car `reinitialiserWeb()` vide `vues` : `src/ui/search.js:216` ne réinscrit une vue
   qu'à son propre rendu) ; item 14 du Step 11 nomme ce tueur et dit que « la Map est vidée » reste verte sous ce mutant. +2 assertions.
10. **Script d'invisibles du Step 12 plus étroit que les Global Constraints** — APPLIQUÉ (Important) : le Step 12 renvoie au script des Global
    Constraints (catégories Cc hors `\t`/`\n`, Cf, Cs, U+2028/2029) et ajoute le passage des lignes ajoutées (`git diff -U0 … | grep '^+'`) au compte des
    insécables U+00A0 / U+202F ; les quatre textes § 5 n'ont que des U+0020 avant « : » et « ( ».
11. **Mutant 4 non tué par le tueur nommé** — APPLIQUÉ (seconde option, à la lettre) : `const BORNE = 1024 * 1024;` en LITTÉRAL dans le bloc hostile, plus
    `eq(A.LIMITES_APERCU_WEB.octets, BORNE, …)` : sous le mutant, `TROP` (1 048 577) passe la borne mutée, `atob` est appelé et « image_trop_lourde AVANT
    tout décodage » rougit à la lettre. +1 assertion de domaine.
12. **Libellés « mémorisé sous la raison … » creux** — APPLIQUÉ (première option) : la boucle « serveur / annule hors abandon / sans forme » perd son
    troisième élément et son libellé n'affirme que ce que le test lit (« indisponibles », une entrée par adresse, aucune redemande) ; commentaire explicite :
    la raison n'est pas observable (`etatApercus()` n'expose pas les raisons, P-UI2-2 : aucune raison par carte). L'option `raisons` dans `etatApercus()`
    a été écartée : elle aurait touché une dizaine d'assertions `eq(S.etatApercus(), …)` pour une raison que l'écran n'affiche pas.
13. **Filtre `!(FIGURE.apercu)` de `forme` = code mort** — APPLIQUÉ (première option) : `forme` reste STRICTE (`tests/recherche-web.js:1027` inchangée), un
    commentaire au-dessus, l'assertion « 0 `figure.apercu` » gardée sur `r1` (l. 1033) et sur la carte de « Garder et lire » (l. 1226) ; ruling neuf
    **P-UI2-23** (Global Constraints, spec § 12 ; la spec § 7 dit « `FIGURE.apercu` optionnel » : ici l'optionnel vaut toujours « absent »).
14. **Aucun test d'écran ne reçoit une Map incomplète** — APPLIQUÉ : cas « Map incomplète » ajouté au bloc « ligne d'état » (demande `[U(0), U(1)]`, Map
    `{ U(0) → IMG }` → `{ hrefs: [U(0), U(1)], blobs: 1, enVol: null }`, 1 figure, pas de ligne ; « Chercher à nouveau » → 0 appel) ; mutant 23 ajouté au
    Step 11 (« boucler sur `r.apercus` au lieu de `manquants` »). +2 assertions.
15. **`sansJeton(r.apercus)` trivialement vrai** — APPLIQUÉ (les deux options) : `sansJeton` remplace un Blob par `'blob'` et garde clés et raisons (elle ne
    prétend plus fouiller un Blob) ; les deux libellés disent « aucun champ texte des résultats (clés et raisons de la Map) ».
16. **`revoquerUrlsDeBlob()` sur des images peut-être encore en chargement** — APPLIQUÉ (seconde option, le FAIT « images chargées ») : `await attendre(() =>
    [...root.querySelectorAll('img')].every((i) => i.complete), …)` AVANT la révocation (borné à 3 s ; Global Constraints : « les deux `attendre` ») ; la
    révocation reste faite sur la vue attachée, comme `app.js` ; PLUS une assertion neuve : un `error` synthétique dispatché sur l'`<img>` après la révocation
    → figure retirée, Blob gardé, aucune révocation de plus (tue le mutant 24 du constat 8). +1 assertion.
17. **Apostrophe ASCII dans la table § 5 de la spec, U+2019 dans le plan** — APPLIQUÉ : Global Constraints « Filet i18n » disent que la table de la spec
    (l. 343, `l'assistant`, U+0027, vérifié) montre la seule différence admise ; le code, `en.js` et les assertions portent U+2019, comme la clé actuelle
    d'`en.js` ; les espaces avant « : » et « ( » sont des U+0020.

**Comptes amendés par cette rév.** : six assertions de plus dans `tests/apercu-web.js` (34 de domaine, 54 d'écran = 88 ; + 2 de `tests/recherche-web.js`
= 90 de plus que le départ) → suite attendue **6038/6038**, épingle **6037** (rév. 1 : 6032 / 6031, mesurées par l'auteur ; la rév. 2 n'est PAS remesurée :
la valeur LUE fait foi, Global Constraints) ; le rouge lu du Step 4 reste `❌ 5949/5973` (les assertions neuves vivent dans des blocs qui lèvent avant de
les atteindre). Mutants de la tâche 2 : 24 (22 + n° 23 « Map incomplète » + n° 24 « error après révocation »). Rulings de plan : P-UI2-1 à P-UI2-23
(P-UI2-5 et P-UI2-8 réécrits, P-UI2-22 et P-UI2-23 neufs). Aucun fichier du worktree `/Users/neeganmac/projects/mistu-apercus` modifié par ce pré-vol.

---
