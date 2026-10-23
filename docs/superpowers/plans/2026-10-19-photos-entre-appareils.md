# Lot G « Les photos voyagent entre appareils » (octets des fichiers, L4) — plan d'implémentation (rév. 3, 19 octobre 2026 — pré-vol et rulings P1 à P7 appliqués ; rejouée le 20 octobre sur la tête finale du lot B `cf91f09`, départ `3601a52`, voie (b))

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une page photographiée sur l'iPhone s'ouvre sur le Mac (et l'inverse) : les octets des fichiers référencés partent au seau privé
`pages` après confirmation (réduits par défaut, l'original reste sur l'appareil qui l'a pris), se téléchargent sur une tape ou par
« Télécharger toutes les pages », se mesurent sans promesse de plan, et une archive ZIP dit franchement ce qui lui manque — sans jamais
perdre un original, ni par le serveur, ni par une archive.

**Architecture:** le champ `files.remote` devient un objet descripteur de la copie serveur (`tables.js` : `remoteValide`,
`remoteDeCeCompte`, `projectionFichier`) ; un module neuf `src/sync/fichiers.js` porte les définitions uniques (référencé, candidat,
fusion d'une ligne venue du serveur, garde de relecture) puis la passe « fichiers » (`createFichiers` : envoi, téléchargement,
téléchargement global, mesure) ; le client Storage est injecté par `createStockage(client)` (`transport.js`) dans le moteur, qui tient
tous ses vols ; Réglages gagne l'ensemble L4 (`syncSectionL4`) ; les écrans rendent chaque page par `vignettePage`. Aucune table neuve,
aucune migration, `DB_VERSION` 4.

**Tech Stack:** PWA sans build (modules ES), IndexedDB (`db.mutate` porte unique), supabase-js 2.117.3 embarqué (Storage : `upload`,
`download`, `list`), suite navigateur `tests/index.html` (bases jetables, transport et Storage factices), `node --test tools/*.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-19-photos-entre-appareils-design.md` (**rév. 4**, commise par le contrôleur au Départ : `3601a52` ; copie durable
`/Users/neeganmac/projects/mistu/.superpowers/sdd/nuit-2026-10-18/lots/G/spec-rev4-depart.md`). Les décisions
D-G1 à D-G16, les invariants I-G1 à I-G10 et les rulings de § 12 (B, S, F, R-G-1 à R-G-6, N-1 à N-4) font foi ; ce plan les met en
tâches, dans l'ordre de § 9. Plan à commettre sous `docs/superpowers/plans/2026-10-19-photos-entre-appareils.md` ; registre
`.superpowers/sdd/2026-10-19-photos-entre-appareils/`.

**Rév. 2 (pré-vol).** Les trente et un constats du pré-vol (trois lentilles : ordre des tâches, fantômes, faux-vert) sont appliqués ou refusés
un par un, chacun relu dans le code du worktree à `bd03e48` : section « Pré-vol (rév. 1 → rév. 2) » en fin de plan, une ligne par constat. Deux
constats neufs du réviseur s'y ajoutent : la rév. 1 lisait le type d'un blob par `fetch(urlBlob)`, que la CSP de `tests/index.html` ne permet pas
(Global Constraints) ; et `t('Page')` (l'`alt` de `vignettePage`) n'avait pas d'entrée `en.js`.

**Rév. 3 (rulings du chef d'orchestre P1 à P7).** Chaque point est appliqué, chaque nom touché relu dans le worktree (`bd03e48`, puis `4cb99a0` : la
ronde 1 de la tâche 6 du lot A, commise pendant cette révision — le lot A écrit encore) : **P1** le test de la photo du plat (tâche 6) prend une fixture qui sépare la garde de `photoDuPlat` du
retypage de `displayUrl` — une ligne `application/pdf` sur les octets d'un vrai JPEG — : rejoué sous Node, le mutant « `safeDisplayType(fichier.mime)`
gardé » survivait à la fixture HEIC de la rév. 2 et meurt à la nouvelle ; les autres lecteurs de la règle (`displayUrl`, `bookCover`,
`poserImage`) tuaient déjà le leur ; **P2** le texte de pause L3 « 1 Go au palier gratuit » est amendé en tâche 5 (R-G-5), ses deux assertions L3
réécrites : I-G9 compte **dix-sept** lignes ; **P3** la passe fichiers sous pause L3 est ratifiée (le test de la tâche 4 l'affirme) ; **P4**
`pdfFrame` de `recipe-edit.js` reste non câblé, dette nommée à la clôture ; **P5** la clôture amende la spec (I-G9 = 17 lignes, liste exacte) ;
**P6** le Step 0 de la tâche 1 relit la tête **finale** du lot A et quatre signatures ; **P7** les six tâches, leurs tests et leurs blocs restent.
Une ligne par point : section « Pré-vol », sous-section « Rév. 2 → rév. 3 ».

**Rejeu sur `cf91f09` (voie (b), 20 octobre 2026).** La rév. 3 a été écrite et relue sur `bd03e48` puis `4cb99a0` (lot A en cours). Depuis, le lot A
s'est clos à `2b6a2fd` et le lot B « Recette web complète » s'est bâti par-dessus jusqu'à sa tête finale `cf91f09` ; le worktree de G est créé à
`3601a52` (= `cf91f09` + spec rév. 4). Le plan n'a pas de scripts de chaîne (ses blocs sont des modules, des corps de fonction, des littéraux et le
fichier `tests/sync-l4.js` assemblé par tâche) : chaque bloc de chaque tâche a été **appliqué par intention** sur une COPIE de `3601a52`, tâche par
tâche, suite navigateur, `node --test` et `--check` mesurés après chacune (rouge puis vert). Les blocs restent identiques à l'octet, **sauf deux lignes
du bloc de tests de la tâche 6** (C-1 : une image `loading: 'lazy'` détachée ou cachée ne se charge jamais — la suite restait sans bilan) ; les
numéros de ligne sont ré-ancrés à `3601a52` (les dix-sept de I-G9 y sont aux mêmes numéros, retrouvées par leur texte) ; les totaux de chaque tâche
sont ceux mesurés au rejeu ; les écarts d'intention entre ce plan et le code commis de B sont tranchés en faveur de B et déclarés (R-G-7 à R-G-13),
les corrections du plan indépendantes de B aussi (C-1 à C-3). Détail : sous-section finale « Rejeu sur `cf91f09` (voie (b)) ».

## Global Constraints

- **Préconditions.** Les lots A (« import ciblé », tête finale `2b6a2fd`) et B (« Recette web complète », tête finale `cf91f09`) sont **terminés** :
  le lot G part de la tête finale du lot B (chaîne linéaire A → B → G → C → D → E → F). Branche `photos-entre-appareils`, créée par le contrôleur au
  Départ dans le worktree PROPRE au lot `/Users/neeganmac/projects/mistu-photos-entre-appareils`, à `3601a52` (= `cf91f09` + la spec rév. 4 commise),
  servie par `python3 -m http.server 8090 --bind 127.0.0.1` depuis le worktree. Lanceur : `.superpowers/sdd/2026-10-19-photos-entre-appareils/suite.cjs`
  (copié au Départ) ; suite : `node .superpowers/sdd/2026-10-19-photos-entre-appareils/suite.cjs 8090`. **Mesure de départ** (contrôleur, 20 octobre,
  sur `3601a52`, remesurée identique sur la copie du rejeu) : suite 3997/3997, épingle 3996, `node --test tools/*.test.mjs` 172/172, `--check` 0,
  `APP_VERSION 0.10.0`, `sw.js cuisine-os-v0.10.0-8`, `DB_VERSION 4`. Le plan, écrit et relu à `bd03e48` puis à `4cb99a0` (lot A en cours), est
  **rejoué** sur `3601a52` (voie (b), sous-section finale) : les dix-sept lignes de I-G9 y sont aux numéros cités, retrouvées par leur texte. Le Step 0
  de la tâche 1 relève quand même la tête (P6). Règle : épingle = N − 1. **Chaque tâche rend verts** la suite,
  `node --test tools/*.test.mjs` et `node tools/generer-migrations.mjs --check` (0).
- **Aucune migration, aucun SQL, aucun changement sous `supabase/functions/`** ; `DB_VERSION` reste **4** ; `ARCHIVE_FORMAT_VERSION` reste 1
  (champs additifs). Le générateur ne doit rien voir changer : `tables.js` gagne des exports, `TABLES` est intact (`--check` 0).
- **Versions (D-G11).** `APP_VERSION = '0.11.0'` **dès la tâche 1** (la base, tête finale du lot B, porte `0.10.0` : B est fusionné avant G, D-G11 ;
  spec rév. 4, R-E-18) ; ses pins en **même temps** (dix lignes dans six suites, relevées à `3601a52` par `grep -n "0[.]10[.]0" tests/*.js` :
  `tests/ajouter.js` l. 1928 et 1930, `tests/creer-ia.js` l. 11, `tests/assistant-compte.js` l. 8, `tests/passerelle.js` l. 672 et 674,
  `tests/recherche-web.js` l. 69 et 72 et son commentaire l. 66, `tests/sync-l3.js` l. 1867 ; les libellés « (lot B) » / « lot B : » deviennent
  « (lot G) » / « lot G : »). `sw.js` : `VERSION =
  'cuisine-os-v0.11.0-1'` en tâche 1, **+1 à chaque tâche qui touche `src/`** (les six : `-1` à `-6`) ; `SHELL` + `./src/sync/fichiers.js`
  **dès la tâche 1** (atteignable par `pull.js` : le test « tout module atteignable depuis app.js est dans SHELL » de `tests/sync.js`
  rougirait sinon, F-5). La spec (§ 9 tâche 6) range `APP_VERSION` et les pins en tâche 6 : ils montent ici en tâche 1, sinon la suite ne
  serait verte à aucune tâche intermédiaire (doute 3).
- **I-G9 : dix-sept lignes de test existantes amendées, chacune nommée, chacune dans la tâche dont le code la fait changer** (la spec en
  compte onze — doute 1 ; quinze en rév. 2, dix-sept en rév. 3 : P2). **Tâche 1** (onze) : sept assertions de `tests/sync-l3.js` (l. 527, 528, 529, 537, 543, 545, 682), le **libellé
  seul** de `tests/sync-l3.js` l. 100 (valeurs inchangées ; « la retenue passe AVANT la relecture » devient faux dès qu'`elementFichier`
  relit), trois de `tests/assistant-compte.js` (l. 388, 395 et **401** — `prog.every((p) => p.total === 24)` hors production, que la spec
  oublie : 25 avec `files`). **Tâche 4** (deux) : `tests/sync-l3.js` l. 1703 et 1708 (`derniersEffets` + `fichiersRecus: 0`, que seul le
  moteur de la tâche 4 pose — amendées en tâche 1, elles rougissaient les tâches 1 à 3). **Tâche 5** (deux, rév. 3 — P2) : `tests/sync-l3.js` l. 1237 et 1326
  (`includes('1 Go')` : le texte de pause L3 perd « (1 Go au palier gratuit) », R-G-5 ; réécrites en égalité exacte avec le texte neuf).
  **Tâche 6** (deux) : `tests/sync.js` l. 124 et 125 (`pdfFrame :
  iframe sandbox present avant resolution`, `pdfFrame : bouton Télécharger le fichier toujours present`), qui contredisent § 4.5 / B-24
  (« jamais un cadre vide », « Télécharger le fichier ne s'affiche qu'avec un blob »). Numéros relevés à `bd03e48`, **identiques à `3601a52`**
  (rejeu : chaque ligne retrouvée par son texte ; les lots A-fin et B n'ont touché, dans ces trois suites, que les pins `tests/sync-l3.js` l. 1867 et
  `tests/assistant-compte.js` l. 8). Aucune autre assertion
  existante n'est touchée : une assertion qui rougit hors de cette liste arrête la tâche (NEEDS_CONTEXT).
- **Filet i18n.** Tout texte d'écran par `t('…')` avec son entrée dans `src/i18n/en.js` (apostrophe typographique U+2019, textes exacts de
  la spec § 5). Les listes du filet vivent dans **`tests/ajouter.js`** (`MODULES_NEUFS`, `CHAINES_NEUVES_AILLEURS`, exportées ; la consigne
  les disait dans `tests/creer-ia.js` — elles n'y sont pas, doute 2) : `MODULES_NEUFS` + `'../src/sync/fichiers.js'` (tâche 1) ;
  `CHAINES_NEUVES_AILLEURS` : clé **neuve** `['../src/ui/settings.js']`
  (tâche 2, complétée en tâche 5) ; clés **existantes** `['../src/ui/components.js']`, `['../src/ui/book.js']` et `['../src/ui/import.js']`
  (tâche 6) — à `3601a52`, le lot B a étendu ces listes (`MODULES_NEUFS` + `lecture-web.js`, `import-web.js`, `vol.js` ; clés `components.js` et
  `recipe.js` complétées ; clés neuves `search.js`, `cook.js`, `grocery.js`, `recipe-edit.js`) : G ajoute en fin de liste, sans rien retirer (R-G-10) —
  on **ajoute** à la liste en place : une seconde clé du même nom dans le littéral écraserait la première sans erreur, et ses
  chaînes sortiraient du filet (faux vert) ; `recipe.js` ne gagne aucun `t('…')` neuf (ses vignettes viennent de `components.js`).
  `livre-ajout.js` est déjà dans `MODULES_NEUFS` (ses `t('…')` neufs sont vus d'office). Aucun texte ne nomme le fournisseur de stockage
  (I-G8) ; aucun texte de `syncSectionL4` ne contient « Go », « palier » ni « $ » (R-G-5), et la pause L3 ne nomme plus de palier (P2) — éprouvés par comportement : l'assertion R-G-5 de
  la tâche 5 (rendu à toutes branches actives, `/supabase/i` compris), les deux assertions L3 réécrites en tâche 5 (égalité exacte
  avec le texte neuf, P2) et le statique de la tâche 6 (chaînes neuves des écrans, en français
  et en anglais).
- **Bases jetables seulement** (`withRepo` de `tests/sync-fixture.js`, qui pose la capture APRÈS `init()` avec `getUserId: () => 'u1'` ;
  `withDatabase` de `tests/backup.js`), **Storage factice** (`tests/stockage-factice.js`, tâche 3), transport factice
  (`tests/transport-factice.js`), aucun réseau, aucune clé ; jamais le navigateur MCP partagé. Toute suite qui reçoit une heure serveur
  (`createPush` → `appliquerHeureServeur`) remet l'horloge par `resetClock()` en `finally`.
- **Le type d'un blob affiché se lit sans `fetch`** (constat du réviseur, rév. 2) : la CSP de `tests/index.html` (`connect-src 'self'
  https:`) ne nomme pas `blob:`, et `'self'` ne rejoint pas ce schéma (CSP 3) — `fetch(urlBlob)` y serait refusé (non rejoué dans Chrome :
  doute 16 ; aucune lecture d'URL `blob:` par `fetch` n'existe dans la suite à `bd03e48`). On lit le Blob remis à `URL.createObjectURL` par un **espion** (remis en `finally`) ou par
  le `creerUrl` injecté de `displayUrl`.
- **Porte unique d'écriture** : `src/ui/` n'appelle jamais `db.mutate` (test statique existant de `tests/sync.js`) — les gestes de fichiers
  passent par le moteur ; `MUTATING_METHODS` inchangé.
- **Échappements dans les fichiers écrits par un outil** : une séquence `\u` + quatre chiffres hexadécimaux tapée dans un appel d'outil est
  **décodée** (mesuré le 2 octobre et rejoué pour ce plan : elle devient le caractère lui-même). Aucun source ni test de ce lot n'en porte :
  un caractère de contrôle ou invisible s'écrit `String.fromCharCode(…)` (la forme de ce plan). Caractères invisibles (U+200B-200D,
  U+2028/2029, U+202A-202E, U+2060, U+FEFF) : contrôle en Python (`python3 -I`) sur chaque fichier touché, jamais `grep`.
- **Tests de source admis** (et seulement eux) : `src/sync/transport.js` sans `.getPublicUrl(`, `.createSignedUrl(`, `.remove(` (I-G6,
  faible, borné à ce module) ; `getClient` nommé seulement par `src/sync/auth.js` et `src/app.js` (R53) ; `navigator.onLine` absent de
  `src/sync/` (I-G4) ; `SHELL` et pins ; filet `en.js` ; le câblage de `src/app.js` (jamais importé par la suite : il lance l'app à
  l'import). Tout le reste par comportement.
- Commits par chemin nommé (jamais `-A`), message ASCII sans accents, trailer du modèle réel de l'implémenteur
  (`Co-Authored-By: <modele reel> <noreply@anthropic.com>`). Jamais réécrire l'historique. Chaque tâche : rouge lu, vert lu, épingle
  relevée dans « obtenu », jamais « vert » sans avoir lu la sortie.

## Review Focus

1. **Un original n'est jamais perdu par une écriture venue du serveur** (tombale `files` reçue, `adjusted`, « Garder celle d'ailleurs » sur une
   ligne ou une tombale) : blob, `syncable` et `created_at` survivent, `remote` seul change → tâche 1 (bloc « réception », mutants « spread
   nu » et « `deletes.files` réintroduit »).
2. **Deux appareils qui ont le même original ne se renvoient pas la photo à chaque passe** : B reçoit la ligne de A, garde blob ET `remote`,
   n'est plus candidat → tâche 1 (test « A et B ont le même blob », mutant `delete fiche.remote`).
3. **Une archive faite sur un appareil qui n'a que des copies réussit, et une restauration ne remplace jamais un original par la copie
   qu'elle porte** (fusion ET remplacement) → tâche 2 (tests (b), (e4), (e5), (e6), mutants « blob tel quel » et « comparaison brute »).
4. **Garde de relecture (N-2)** : une réception pendant un envoi n'est jamais écrasée, mais un renvoi en originale et un ré-envoi sous un
   autre compte s'écrivent → tâche 3 (tests (l2), (l3), (l4), mutants « autre empreinte → rien » et « `updated_at` ignoré »).
5. **`arreter()` attend tous les vols** (passe, téléchargement par tape, mesure) et plus rien ne s'écrit ensuite ; une API appelée après
   rend `{ erreur: { type: 'arrete' } }` sans appel → tâche 4 (test « tape puis arrêt », mutant « vol non tenu »).

---

### Task 1 : Données, projection, réception, capture et lots (spec § 3.1-3.3, § 3.5, D-G8, D-G12, D-G15, D-G16, R56)

**Files:**
- Modify: `src/sync/tables.js` (`CHAMPS_FILES_SERVEUR`, `remoteValide`, `remoteDeCeCompte`, `projectionFichier` ; import d'`ALLOWED_MIME`)
- Create: `src/sync/fichiers.js` (partie pure : `HASH_FICHIER`, réexports, `estOriginalIci`, `copiePerimee`, `referencesFichiers`,
  `etatFichier`, `nomFichier`, `candidatsEnvoi`, `fusionnerFichier`, `fusionnerOctetsRecus`, `peutEcrireRemote`, `peutEcrireOctets`)
- Modify: `src/sync/pull.js` (`identiques(a, b, table)`, `decider({ locale, distante, table })`, `ficheFichier` retiré au profit de
  `fusionnerFichier`, tombale `files`, retrait de `file_error`), `src/sync/conflits.js` (`garderAilleurs` sur `files`),
  `src/sync/reponses.js` (`adjusted` sur `files`), `src/sync/outbox.js` (capture `files`), `src/sync/backfill.js` (`files` candidate,
  lignes filtrées), `src/sync/lots.js` (`elementFichier`)
- Modify: `src/model/repo.js` (`DEFAULT_SETTINGS.upload_quality`, `putFile`, `convertirRemoteBooleen` exportée et appelée par `init()`
  après `purgerFilesEnFile()`), `src/ui/state.js` (`qualiteEnvoi`), `src/sync/mime.js` (`typeAffichage`, `displayUrl`),
  `src/ui/components.js` (`bookCover` par `typeAffichage`), `src/ui/recipe.js` (import l. 7 et `photoDuPlat` par `typeAffichage`),
  `src/ui/import-cible.js` (`poserImage` par `typeAffichage` : la troisième lecture de la règle, F-9), `src/domain/backup.js` (deux lignes
  remontées de la tâche 2 : une ligne sans blob est « manquante » quelle que soit `remote`, `comparableFiles` filtré par le blob — D-G12),
  `src/model/schema.js` (`APP_VERSION = '0.11.0'`), `src/i18n/en.js` (sept chaînes de `nomFichier`)
- Modify: `sw.js` (`SHELL` + `'./src/sync/fichiers.js'` entre `./src/sync/conflits.js` et `./src/sync/lots.js`, `VERSION =
  'cuisine-os-v0.11.0-1'`)
- Create: `tests/sync-l4.js` (`export async function runSyncL4Tests({ eq, ok })`), `tools/fichiers-node.test.mjs`
- Modify: `tests/tests.js` (import et appel après le bloc `runLectureWebTests` du lot B, avant `runThemeTests` ; total épinglé — R-G-7),
  `tests/transport-factice.js` (le mode `serveur` refuse `forme` une ligne `files` qui porte `blob`), `tests/sync-l3.js` (sept
  assertions et un libellé amendés + un pin), `tests/assistant-compte.js` (trois assertions amendées + un pin), `tests/ajouter.js` (`MODULES_NEUFS` +
  `'../src/sync/fichiers.js'` ; deux pins), `tests/creer-ia.js`, `tests/passerelle.js`, `tests/recherche-web.js` (pins)

**Interfaces:**
- Produces (`tables.js`) : `CHAMPS_FILES_SERVEUR` (gelé, 6 noms) ; `remoteValide(remote) → boolean` ; `remoteDeCeCompte(remote, uid) →
  boolean` ; `projectionFichier(row) → { sha256?, mime?, size?, original_filename?, updated_at?, remote: objet | null }`.
- Produces (`fichiers.js`) : `HASH_FICHIER` ; `estOriginalIci(row)` ; `copiePerimee(row)` ; `referencesFichiers(snapshot) → Set<sha256>` ;
  `etatFichier(row, { uid, erreurs }) → 'erreur' | 'present' | 'distant' | 'absent'` (`erreurs` : tout objet à `.has(sha256)`, `Set` ou
  `Map`) ; `nomFichier(sha256, snapshot) → string` ; `candidatsEnvoi(snapshot, { uid, renvoi = false, erreurs }) → row[]` ;
  `fusionnerFichier(locale, data, updated_at) → row` ; `fusionnerOctetsRecus(existing, blob) → row` ; `peutEcrireRemote(avant, relue, {
  h, uid }) → boolean` ; `peutEcrireOctets(avant, relue) → boolean`. **Écart de signature** : `etatFichier` ne prend pas `connecte` (l'état
  ne dépend pas de la connexion ; l'écran lit `connecte` pour offrir ou non « Télécharger ») — doute 6.
- Produces : `decider({ locale, distante, table = null })`, `identiques(a, b, table = null)` (pull.js) ; `repo.convertirRemoteBooleen() →
  nombre de lignes réécrites` ; `qualiteEnvoi() → 'reduite' | 'originale'` (state.js) ; `typeAffichage(fileRow) → type | null` (mime.js).

- [ ] **Step 0 : départ relevé (P6, rejoué sur `3601a52`).** Le worktree est créé par le contrôleur : `/Users/neeganmac/projects/mistu-photos-entre-appareils`,
  branche `photos-entre-appareils` à `3601a52` (tête finale du lot B `cf91f09` + spec rév. 4) ; `git -C /Users/neeganmac/projects/mistu-photos-entre-appareils
  status --short` ne liste aucun fichier suivi modifié ; `git -C /Users/neeganmac/projects/mistu-photos-entre-appareils rev-parse --short HEAD` consigné.
  Relire par `grep -n` et lecture les quatre noms dont ce plan suppose la forme — relus au rejeu à `3601a52` : `displayUrl(fileRow, creerUrl)`
  (`src/sync/mime.js` l. 27 ; `creerUrl` par défaut `(b) => URL.createObjectURL(b)` ; inchangée) ; `marquerInterrompus` (exportée, `src/model/repo.js`
  l. 116 ; depuis la vague finale du lot A elle relit aussi le battement interne `battement:<id>` de `sync_state`) et `purgerImportsAnciens` (l. 146),
  appelées par `init()` juste après `purgerFilesEnFile()` (l. 78, 79, 80 — `convertirRemoteBooleen()` s'insère entre `purgerFilesEnFile()` et elles) ;
  `renderImportCible(params, query, ctx, deps)` (`src/ui/import-cible.js` l. 304 ; `deps` = `{ repo, navigate, toast, fetch, pickFiles, maintenant,
  battementMs, veilleMs }` — `veilleMs` ajouté par la vague finale du lot A, `bbb6cef` — ; depuis le lot B (D-B13, `3ca8d19`), une fiche à `source_url`
  part vers `renderImportWeb` : le test d'affichage du Step 4 passe les cinq premiers sur une fiche SANS adresse, il reste sur l'écran photo, R-G-9).
  **Si une signature diffère, la tâche 1 s'aligne** (le code et le test qui la lisent suivent la forme réelle, sans changer ce que le test affirme)
  **et le dit dans son rapport** (forme supposée, forme réelle, lignes touchées). Puis : servir le worktree (`python3 -m http.server 8090 --bind
  127.0.0.1`, déjà servi au Départ) ; le lanceur est copié (Global Constraints) ; lancer `node .superpowers/sdd/2026-10-19-photos-entre-appareils/suite.cjs 8090`,
  `node --test tools/*.test.mjs`, `node tools/generer-migrations.mjs --check` ; consigner dans `progress.md` : BILAN `N/N`, l'épingle de `tests/tests.js`
  (doit valoir N − 1), le compte Node, `VERSION` de `sw.js`, la tête (`git rev-parse --short HEAD`) — mesuré au Départ : 3997/3997, épingle 3996, Node 172,
  `cuisine-os-v0.10.0-8`, `3601a52`. Relire par `grep -n` les dix-sept lignes de I-G9 (les onze du Step 5 ; les deux de la tâche 4, l. 1703 et 1708 ;
  les deux de la tâche 5, l. 1237 et 1326 ; les deux de la tâche 6, `tests/sync.js` l. 124 et 125 ; leurs libellés sont uniques ; au rejeu, toutes
  retrouvées par leur texte aux numéros de `bd03e48`) : si l'une a changé de texte depuis `3601a52`, s'arrêter (NEEDS_CONTEXT).

- [ ] **Step 1 : créer `tests/sync-l4.js` (tests rouges du module pur) et l'enregistrer.** Dans `tests/tests.js`, ajouter
  `import { runSyncL4Tests } from './sync-l4.js';` après l'import de `runLectureWebTests` (lot B), et après le bloc `runLectureWebTests`, avant le
  bloc du thème (R-G-7 : la suite de G suit la dernière suite de lot de la chaîne) :

```js
// --- Les photos voyagent entre appareils (lot G) : projection, réception, archive, passe fichiers, moteur, Réglages, écrans.
try { await runSyncL4Tests({ eq, ok }); }
catch (error) { ok(false, `Suite photos entre appareils interrompue : ${error?.message || String(error)}`); }
```

`tests/sync-l4.js` (les tâches suivantes ajoutent leurs blocs **à la fin du corps** de `runSyncL4Tests`, après le dernier bloc écrit) :

```js
// Suite du lot G « Les photos voyagent entre appareils » (spec 2026-10-19, rév. 4) : données, projection, réception et capture (tâche 1),
// archive (2), Storage factice et passe fichiers (3), moteur (4), Réglages (5), écrans (6). Bases jetables, aucun réseau, aucune clé.
// Chaque assertion nomme le mutant qu'elle tue (rejoués sur une copie à la clôture).
import { withRepo } from './sync-fixture.js';
import { creerTransportFactice } from './transport-factice.js';
import { resetClock } from '../src/sync/clock.js';
import { sha256Hex } from '../src/core/hash.js';

const DATE = '2026-10-19T00:00:00.000Z';
const H = (c) => c.repeat(64); // une empreinte lisible : H('a') = « aaaa… » (64)
// Un `remote` valide de ce compte (u1, l'utilisateur de withRepo) ; chaque test surcharge ce qui le concerne.
const R = (sur = {}) => ({ sha256: H('e'), size: 400, mime: 'image/jpeg', quality: 'reduite', uploaded_at: DATE, owner: 'u1', ...sur });
const octets = (texte, type = 'image/jpeg') => new Blob([texte], { type });
// Une ligne `files` qui porte son ORIGINAL : clé = empreinte des octets, taille = taille des octets.
async function original(texte, sur = {}) {
  const blob = octets(texte);
  return { sha256: await sha256Hex(blob), mime: 'image/jpeg', size: blob.size, blob, syncable: true, created_at: DATE, updated_at: DATE, ...sur };
}
const sansBlob = (ligne) => { const { blob: _octets, ...reste } = ligne; return reste; };
const MAGASINS_SNAPSHOT = ['source_pages', 'source_documents', 'book_editions', 'recipes', 'imports', 'files', 'books'];

export async function runSyncL4Tests({ eq, ok }) {
  resetClock();
  const run = async (nom, test) => {
    try { await test(); }
    catch (error) { ok(false, `Lot G — ${nom} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
    finally { resetClock(); } // une heure serveur reçue (createPush) ne survit jamais à son test
  };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const T = await import('../src/sync/tables.js');
  const F = await import('../src/sync/fichiers.js');
  const { SYNC_STORES } = await import('../src/model/schema.js');

  // === Tâche 1 — données, projection, réception, capture

  await run('schéma et projection', async () => {
    eq([...T.CHAMPS_FILES_SERVEUR], ['sha256', 'mime', 'size', 'original_filename', 'remote', 'updated_at'], 'D-G8 : CHAMPS_FILES_SERVEUR exact');
    const ligne = { sha256: H('a'), mime: 'image/jpeg', size: 3, original_filename: 'p.jpg', blob: octets('abc'), syncable: true, created_at: DATE, updated_at: DATE, remote: R({ owner: 'u2' }) };
    const proj = T.projectionFichier(ligne);
    eq(Object.keys(proj).sort(), ['mime', 'original_filename', 'remote', 'sha256', 'size', 'updated_at'], 'projection : exactement les champs du serveur, ni blob, ni syncable, ni created_at (mutant : blob gardé → la projection porte un Blob)');
    eq(proj.remote, R({ owner: 'u2' }), 'projection : un remote d’un autre compte voyage tel quel (S-8 : l’écho doit se lire pareil des deux côtés)');
    eq([T.projectionFichier({ ...ligne, remote: true }).remote, T.projectionFichier({ sha256: H('a') }).remote], [null, null], 'projection : remote true (L3) ou absent → null');
    const etranger = Object.assign(Object.create({ herite: 1 }), R());
    const formes = [
      [R(), true], [{ ...R(), version: 2 }, true], [true, false], [null, false], [etranger, false], [R({ sha256: 'abc' }), false],
      [R({ size: 0 }), false], [R({ size: 52428801 }), false], [R({ mime: 'image/svg+xml' }), false], [R({ quality: 'haute' }), false],
      [R({ owner: '' }), false], [R({ uploaded_at: 5 }), false], [[R()], false], ['remote', false],
    ];
    eq(formes.map(([r]) => T.remoteValide(r)), formes.map(([, v]) => v), 'remoteValide : 14 formes — valide ; champ en plus ignoré (F-23) ; true, null, prototype étranger, empreinte courte, taille 0 et 52 428 801, svg, qualité inconnue, owner vide, uploaded_at nombre, tableau, chaîne refusés (mutants : borne de taille retirée ; champ en plus refusé)');
    eq([T.remoteDeCeCompte(R(), 'u1'), T.remoteDeCeCompte(R(), 'u2'), T.remoteDeCeCompte(R(), null)], [true, false, false], 'remoteDeCeCompte : même owner, autre owner, uid nul');
    eq([F.remoteValide === T.remoteValide, F.remoteDeCeCompte === T.remoteDeCeCompte], [true, true], 'I-G10 : fichiers.js réexporte les définitions de tables.js, il n’en écrit pas d’autres');
  });

  await run('originaux, copies, références, états, noms', async () => {
    const orig = await original('original-de-dix-huit');
    const reduite = { ...orig, blob: octets('jpg'), remote: R({ size: 3 }) };
    const fausseOriginale = { ...orig, blob: octets('jpg'), remote: R({ sha256: orig.sha256, size: 3 }) };
    const partieTelleQuelle = { ...orig, remote: R({ sha256: orig.sha256, size: orig.size }) };
    eq([F.estOriginalIci(orig), F.estOriginalIci(reduite), F.estOriginalIci(fausseOriginale), F.estOriginalIci(sansBlob(orig)), F.estOriginalIci(partieTelleQuelle)],
      [true, false, false, false, true], 'estOriginalIci : original ; copie réduite ; copie de la taille de remote dont remote.sha256 = clé (faux : la disjonction de la rév. 1 retirée, S-3) ; sans blob ; parti tel quel');
    eq([F.copiePerimee({ ...orig, blob: octets('vieille'), remote: R({ size: 3 }) }), F.copiePerimee(reduite), F.copiePerimee(orig)], [true, false, false], 'copiePerimee : copie dont la taille n’est plus celle du serveur ; copie fidèle ; original');
    const snap = { source_pages: [{ id: 'p1', sha256: H('1') }], source_documents: [{ id: 'd1', sha256: H('2') }], book_editions: [{ id: 'e1', cover_sha256: H('3') }], recipes: [{ id: 'r1', photo_sha256: H('4') }], imports: [{ id: 'i1', photo_sha256: H('5') }, { id: 'i2', photo_sha256: 'pas-une-empreinte' }], files: [{ sha256: H('6') }] };
    eq([...F.referencesFichiers(snap)].sort(), [H('1'), H('2'), H('3'), H('4'), H('5')], 'referencesFichiers : les cinq pointeurs, une valeur non HASH ignorée, l’orphelin exclu (mutant : imports.photo_sha256 retiré de la liste)');
    const distant = { sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() };
    eq([F.etatFichier(orig, { uid: 'u1', erreurs: new Set([orig.sha256]) }), F.etatFichier(orig, { uid: 'u1' }), F.etatFichier(distant, { uid: 'u1' }), F.etatFichier({ ...distant, remote: R({ owner: 'u2' }) }, { uid: 'u1' }), F.etatFichier({ ...distant, remote: null }, { uid: 'u1' }), F.etatFichier(distant, { uid: null }), F.etatFichier(null, { uid: 'u1' })],
      ['erreur', 'present', 'distant', 'absent', 'absent', 'absent', 'absent'], 'etatFichier : erreur prime ; present ; distant ; remote d’un autre owner → absent (R-G-2 ; mutant : owner ignoré → distant) ; sans remote ; sans compte connu ; sans ligne');
    const snapNom = {
      books: [{ id: 'b1', title: 'Mon livre' }],
      book_editions: [{ id: 'e1', book_id: 'b1', cover_sha256: H('3') }],
      source_documents: [{ id: 'd1', edition_id: 'e1', sha256: H('1') }, { id: 'd2', edition_id: 'e1', sha256: H('2'), original_filename: 'menu.pdf' }, { id: 'd3', edition_id: null, sha256: H('8') }],
      source_pages: [{ id: 'p1', document_id: 'd1', sha256: H('1'), printed_page: 12 }, { id: 'p2', document_id: 'd1', sha256: H('9'), printed_page: null }, { id: 'p3', document_id: 'd3', sha256: H('8'), printed_page: 4 }, { id: 'p4', document_id: 'd3', sha256: H('b'), printed_page: null }],
      recipes: [{ id: 'r1', original_title: 'Tarte', photo_sha256: H('4') }],
      imports: [{ id: 'i1', photo_sha256: H('5'), created_at: '2026-10-18T14:00:00.000Z' }],
    };
    eq([H('1'), H('9'), H('8'), H('b'), H('2'), H('3'), H('4'), H('5'), H('6')].map((s) => F.nomFichier(s, snapNom)),
      ['Page 12 · Mon livre', 'page non numérotée · Mon livre', 'Page 4', 'page non numérotée', 'menu.pdf', 'Couverture · Mon livre', 'Photo du plat · Tarte', 'Photo importée · 2026-10-18', H('6').slice(0, 12)],
      'nomFichier (B-23, I-G8) : page numérotée, page non numérotée, page sans livre, page sans livre ni numéro (« page non numérotée » : chaîne hors § 5, ruling de construction), nom d’origine d’un document, couverture, photo du plat, photo importée, repli sur l’empreinte tronquée à 12');
  });

  await run('candidats, fusions et gardes de relecture', async () => {
    const a = await original('candidat-a', { created_at: '2026-10-19T00:00:03.000Z' });
    const b = await original('candidat-b', { created_at: '2026-10-19T00:00:01.000Z' });
    const c = await original('candidat-c', { syncable: false });
    const d = await original('candidat-d', { created_at: '2026-10-19T00:00:02.000Z', remote: R({ sha256: H('d') }) }); // déjà partie réduite sous ce compte
    const e = await original('candidat-e', { created_at: '2026-10-19T00:00:04.000Z', remote: R({ owner: 'u2' }) }); // partie sous un autre compte
    const g = await original('candidat-g', { created_at: undefined, updated_at: '2026-10-19T00:00:00.500Z' }); // reçue : pas de created_at (B-20)
    const orpheline = await original('orpheline');
    const snap = { source_pages: [a, b, c, d, e, g].map((l, i) => ({ id: 'p' + i, sha256: l.sha256 })), files: [a, b, c, d, e, g, orpheline, { ...sansBlob(a), sha256: H('f') }] };
    eq(F.candidatsEnvoi(snap, { uid: 'u1' }).map((l) => l.sha256), [g.sha256, b.sha256, a.sha256, e.sha256], 'candidatsEnvoi : originaux référencés et syncables sans remote de ce compte (un autre owner repart sous ce compte), triés par created_at ?? updated_at ; ni orpheline, ni type inconnu, ni ligne sans octets');
    eq(F.candidatsEnvoi(snap, { uid: 'u1', renvoi: true }).map((l) => l.sha256), [g.sha256, b.sha256, d.sha256, a.sha256, e.sha256], 'candidatsEnvoi (renvoi) : la ligne partie réduite sous ce compte s’ajoute (B-21)');
    eq(F.candidatsEnvoi(snap, { uid: 'u1', erreurs: new Set([b.sha256]) }).map((l) => l.sha256), [g.sha256, a.sha256, e.sha256], 'candidatsEnvoi : une ligne en file_error n’est pas candidate');
    const locale = { ...a, original_filename: 'x.jpg', remote: R({ owner: 'u2' }) };
    const f1 = F.fusionnerFichier(locale, { sha256: a.sha256, mime: 'image/jpeg', size: a.size, original_filename: 'x.jpg', remote: R(), updated_at: 'celle-du-corps' }, '2026-10-20T00:00:00.000Z');
    eq([f1.blob === a.blob, f1.syncable, f1.created_at, f1.remote, f1.updated_at], [true, true, a.created_at, R(), '2026-10-20T00:00:00.000Z'], 'fusionnerFichier (D-G16) : blob, syncable et created_at locaux gardés ; remote de data ; updated_at du serveur');
    const f2 = F.fusionnerFichier(locale, { remote: null }, '2030-01-01T00:00:00.000Z');
    eq([f2.blob === a.blob, f2.remote, f2.mime, f2.size], [true, null, 'image/jpeg', a.size], 'fusionnerFichier : data = { remote: null } (tombale) → ligne et blob gardés, remote nul');
    const f3 = F.fusionnerFichier(sansBlob(locale), { sha256: a.sha256, mime: 'image/jpeg', size: a.size }, DATE);
    eq(['remote' in f3, 'blob' in f3], [false, false], 'fusionnerFichier : data sans remote → remote absent, ni true ni gardé du local (mutants : delete fiche.remote ; fiche.remote = true)');
    const existante = { sha256: H('7'), mime: 'image/heic', size: 999, updated_at: DATE, remote: R({ mime: 'image/jpeg' }) };
    const recue = octets('octets-recus');
    const fo = F.fusionnerOctetsRecus(existante, recue);
    eq([fo.blob === recue, fo.size, fo.mime, fo.updated_at, fo.syncable, fo.remote], [true, 999, 'image/heic', DATE, true, R({ mime: 'image/jpeg' })], 'fusionnerOctetsRecus : size, mime, updated_at et remote de la ligne intacts ; syncable résolu par la liste blanche');
    const avant = { ...a };
    const garde = { h: H('e'), uid: 'u1' };
    eq([
      F.peutEcrireRemote(avant, { ...avant }, garde),
      F.peutEcrireRemote(avant, { ...avant, updated_at: '2026-10-19T09:00:00.000Z' }, garde),
      F.peutEcrireRemote(avant, undefined, garde),
      F.peutEcrireRemote(avant, sansBlob(avant), garde),
      F.peutEcrireRemote(avant, { ...avant, remote: R({ sha256: H('e') }) }, garde),
      F.peutEcrireRemote(avant, { ...avant, remote: R({ sha256: H('d') }) }, garde),
      F.peutEcrireRemote(avant, { ...avant, remote: R({ sha256: H('e'), owner: 'u2' }) }, garde),
    ], [true, false, false, false, false, true, true], 'peutEcrireRemote (N-2) : inchangée → oui ; updated_at changé, disparue, sans blob, déjà posée pour CETTE empreinte sous CE compte → non ; renvoi en originale et ré-envoi sous ce compte → oui (mutants : garde de la rév. 2 « autre empreinte → rien » ; updated_at ignoré)');
    const aRecevoir = { sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() };
    eq([F.peutEcrireOctets(aRecevoir, { ...aRecevoir, blob: octets('x') }), F.peutEcrireOctets(aRecevoir, { ...aRecevoir, updated_at: '2026-10-19T09:00:00.000Z' }), F.peutEcrireOctets(aRecevoir, undefined), F.peutEcrireOctets(aRecevoir, { ...aRecevoir })],
      [false, false, false, true], 'peutEcrireOctets : blob déjà là, ligne modifiée, ligne disparue → non ; sinon oui');
  });
```

- [ ] **Step 2 : tests rouges des écritures locales** (ajoutés à la suite du Step 1, même fonction) :

```js
  await run('passe unique : remote true retiré (D-G12)', async () => {
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [
        { sha256: H('a'), mime: 'image/jpeg', size: 1, remote: true, updated_at: '2026-10-01T00:00:00.000Z' },
        { sha256: H('b'), mime: 'image/png', size: 2, remote: true, updated_at: '2026-10-02T00:00:00.000Z' },
        { sha256: H('c'), mime: 'image/jpeg', size: 3, updated_at: '2026-10-03T00:00:00.000Z' },
      ] }, origin: 'device' });
      await db.mutate({ deletes: { sync_state: ['files_remote_v2'] }, origin: 'device' }); // la fixture a déjà joué init() : la garde est retirée pour rejouer
      const vues = [];
      const vrai = db.mutate;
      db.mutate = function (args) { vues.push(args); return vrai.call(this, args); };
      try {
        await repo.init();
        const [la, lb, lc] = await Promise.all([H('a'), H('b'), H('c')].map((s) => db.get('files', s)));
        eq(['remote' in la, 'remote' in lb, la.updated_at, lb.updated_at, lc.updated_at], [false, false, '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', '2026-10-03T00:00:00.000Z'], 'passe unique : le booléen retiré des deux lignes de L3, updated_at conservé (mutant : updated_at réécrit)');
        const ecritures = vues.filter((m) => m.puts?.files);
        eq([ecritures.length, ecritures[0]?.origin, (ecritures[0]?.puts.files || []).map((l) => l.sha256).sort(), (ecritures[0]?.puts.sync_state || []).some((l) => l.key === 'files_remote_v2'), (await db.get('sync_state', 'files_remote_v2'))?.value, await db.count('outbox')], [1, 'device', [H('a'), H('b')], true, 1, 0], 'passe unique : UNE transaction d’origine device, la garde DANS la même transaction que les lignes, la ligne saine non réécrite, rien en file (mutant : garde écrite par un second mutate)');
        vues.length = 0;
        await repo.init();
        eq(vues.filter((m) => m.puts?.files || (m.puts?.sync_state || []).some((l) => l.key === 'files_remote_v2')).length, 0, 'passe unique : au second démarrage, aucune transaction (garde)');
      } finally { delete db.mutate; }
    });
  });

  await run('putFile : métadonnées nettoyées, octets reçus par une seule règle', async () => {
    await withRepo(async (repo, db) => {
      const sale = octets('photo-sale'); const shaSale = await sha256Hex(sale);
      await repo.putFile(shaSale, sale, { original_filename: 'a' + String.fromCharCode(0) + 'b.jpg' });
      eq((await db.get('files', shaSale)).original_filename, 'ab.jpg', 'putFile (B-27) : les métadonnées passent par nettoyerChaines (classe R61)');
      const existante = { sha256: H('7'), mime: 'image/heic', size: 999, updated_at: DATE, remote: R({ mime: 'image/jpeg' }) };
      await db.mutate({ puts: { files: [existante] }, origin: 'remote' });
      const recue = octets('octets-recus');
      await repo.putFile(H('7'), recue, { origin: 'remote' });
      const ecrite = await db.get('files', H('7'));
      const attendue = F.fusionnerOctetsRecus(existante, recue);
      eq([ecrite.size, ecrite.mime, ecrite.updated_at, ecrite.syncable, ecrite.remote, ecrite.blob instanceof Blob, ecrite.blob.size, await db.count('outbox')], [attendue.size, attendue.mime, attendue.updated_at, attendue.syncable, attendue.remote, true, recue.size, 0], 'putFile origin remote = fusionnerOctetsRecus (F-20 : une règle, deux appelants ; mutant : putFile ordinaire → size réécrit)');
    });
  });

  await run('capture des lignes files (D-G8)', async () => {
    await withRepo(async (repo, db) => {
      const photo = octets('photo-capture'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, { original_filename: 'p.jpg' });
      eq(await db.count('outbox'), 0, 'capture : une photo posée n’entre pas en file (R-L3-22 tenu ; mutant : wanted sans la condition remote)');
      const ligne = await db.get('files', sha);
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ sha256: sha, size: photo.size }), updated_at: '2026-10-19T01:00:00.000Z' }] }, origin: 'local' });
      eq((await db.getAll('outbox')).map((e) => [e.store, e.id, e.op, e.user_id]), [['files', sha, 'put', 'u1']], 'capture : la même ligne avec un remote valide de ce compte → UNE entrée files');
      await db.mutate({ puts: { files: [{ ...ligne, remote: true }] }, origin: 'local' });
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ owner: 'u2' }) }] }, origin: 'local' });
      await db.mutate({ puts: { files: [{ ...ligne, syncable: false, remote: R() }] }, origin: 'local' });
      eq(await db.count('outbox'), 1, 'capture : remote true, remote d’un autre compte, syncable false → aucune entrée de plus');
      await db.mutate({ deletes: { files: [sha] }, payloads: { files: { [sha]: ligne } }, origin: 'local' });
      eq(await db.count('outbox'), 1, 'capture : une suppression locale de files n’est JAMAIS capturée (D-G15 ; mutant : deletes capturés)');
    });
  });

  await run('lots : projection et retenue après relecture', async () => {
    const { composerLots } = await import('../src/sync/lots.js');
    const fiche = { sha256: H('a'), mime: 'image/jpeg', size: 3, original_filename: 'p.jpg', blob: octets('abc'), syncable: true, created_at: DATE, updated_at: DATE, remote: R({ sha256: H('a'), size: 3 }) };
    const entree = (seq) => ({ seq, user_id: 'u1', store: 'files', id: H('a'), op: 'put', updated_at: DATE, tries: 0 });
    const c1 = await composerLots([entree(1)], async () => fiche);
    eq([c1.lots.length, Object.keys(c1.lots[0]?.elements[0]?.data || {}).sort(), c1.retenues], [1, ['mime', 'original_filename', 'remote', 'sha256', 'size', 'updated_at'], []], 'lots : un remote de ce compte → l’élément porte exactement CHAMPS_FILES_SERVEUR, sans blob (mutant : projection non appliquée)');
    const c2 = await composerLots([entree(2)], async () => ({ ...fiche, remote: null }));
    const c3 = await composerLots([entree(3)], async () => ({ ...fiche, remote: R({ owner: 'u2' }) }));
    const c4 = await composerLots([{ ...entree(4), op: 'delete', payload: fiche }], async () => fiche);
    eq([c2.lots, c2.retenues.map((r) => r.raison), c3.lots, c3.retenues.map((r) => r.raison), c4.lots, c4.retenues.length], [[], ['fichier en attente'], [], ['fichier en attente'], [], 1], 'lots : sans remote de ce compte (aucun, ou d’un autre owner) → retenue « fichier en attente » ; une entrée delete de files ne part jamais');
    const tf = creerTransportFactice({ serveur: true });
    const reponse = (await tf.pousser([{ store: 'files', id: H('a'), data: { sha256: H('a'), blob: {} }, updated_at: DATE, deleted: false }])).reponse;
    eq(reponse.rejected.map((r) => r.reason), ['forme'], 'factice serveur : une ligne files qui porte blob est refusée « forme » (contrôle not (data ? blob) de 0001)');
  });

  await run('envoi initial de files filtré', async () => {
    const { tablesCandidates, envoiInitial } = await import('../src/sync/backfill.js');
    ok(tablesCandidates().includes('files'), 'envoi initial : files est candidate (D-G8)');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { sync_state: SYNC_STORES.filter((t) => t !== 'files').map((t) => ({ key: `backfill:${t}`, value: 'fait' })) }, origin: 'device' });
      await db.mutate({ puts: { files: [
        { sha256: H('1'), mime: 'image/jpeg', size: 1, syncable: true, updated_at: DATE, remote: R({ sha256: H('1'), size: 1 }) },
        { sha256: H('2'), mime: 'image/jpeg', size: 1, syncable: true, updated_at: DATE },
        { sha256: H('3'), mime: 'image/jpeg', size: 1, syncable: true, updated_at: DATE, remote: R({ owner: 'u2' }) },
        { sha256: H('4'), mime: 'application/octet-stream', size: 1, syncable: false, updated_at: DATE, remote: R() },
      ] }, origin: 'device' });
      await envoiInitial({ db, getUserId: () => 'u1' });
      eq([(await db.getAll('outbox')).map((e) => [e.store, e.id, e.user_id]), (await db.get('sync_state', 'backfill:files'))?.value], [[['files', H('1'), 'u1']], 'fait'], 'envoi initial : UNE entrée (seule la ligne syncable à remote valide de ce compte), marqueur posé (mutant : filtre retiré → quatre entrées)');
    });
  });

  await run('archive : une ligne sans octets ni remote ne fait plus lever (D-G12, dès la tâche 1)', async () => {
    // La passe unique retire le booléen : une ligne reçue sans octets n'a plus `remote: true`. Sans les deux lignes de backup.js remontées de la
    // tâche 2, createArchive lèverait « Fichier source invalide » sur elle entre les commits des tâches 1 et 2.
    const B1 = await import('../src/domain/backup.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('1'), mime: 'image/jpeg', size: 3, updated_at: DATE }] }, origin: 'device' });
      const a = await B1.createArchive(db);
      eq([a.missingFiles, a.manifest.files.some((f) => f.sha256 === H('1'))], [1, false], 'createArchive (D-G12) : une ligne sans octets ni remote est « manquante », jamais une levée (mutant : `file.remote` exigé → « Fichier source invalide »)');
    });
  });
```

- [ ] **Step 3 : tests rouges de la réception, des tombales, des ajustements et des conflits** (à la suite) :

```js
  await run('réception : identiques sur la projection (R56)', async () => {
    const { decider } = await import('../src/sync/pull.js');
    const locale = { sha256: H('a'), mime: 'image/jpeg', size: 3, blob: octets('abc'), syncable: true, created_at: DATE, updated_at: DATE, remote: R() };
    const distante = { id: H('a'), data: { sha256: H('a'), mime: 'image/jpeg', size: 3, remote: R(), updated_at: DATE }, updated_at: DATE, deleted_at: null };
    eq([decider({ locale, distante, table: 'files' }), decider({ locale: { id: 'b1', title: 'x', updated_at: DATE }, distante: { id: 'b1', data: { id: 'b1', title: 'y', updated_at: DATE }, updated_at: DATE, deleted_at: null } })],
      ['ignorer', 'conflit'], 'R56 : à instant égal, une ligne files qui ne diffère que par blob, syncable et created_at est identique (mutant : identiques sans projection → conflit) ; decider à deux clés (L3) inchangé');
  });

  await run('réception : A et B ont le même original (B-1)', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      const photo = octets('meme-photo'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, {});
      await db.mutate({ puts: { source_pages: [{ id: 'pgAB', document_id: 'dAB', sha256: sha, updated_at: DATE }] }, origin: 'device' });
      const remoteA = R({ sha256: H('e'), size: 400 });
      const tf = creerTransportFactice({ lire: { files: [[{ id: sha, data: { sha256: sha, mime: 'image/jpeg', size: photo.size, remote: remoteA, updated_at: '2030-01-01T00:00:00.000Z' }, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: null, server_seq: 1 }], []] } });
      await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir();
      const b = await db.get('files', sha);
      eq([b.blob instanceof Blob, b.remote, F.candidatsEnvoi(await db.getSnapshot(MAGASINS_SNAPSHOT), { uid: 'u1' }).length], [true, remoteA, 0], 'B-1 : B garde blob ET le remote reçu, et n’est plus candidat (mutant : delete fiche.remote réintroduit → renvoi perpétuel)');
    });
  });

  await run('réception : ligne sans remote', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      const tf = creerTransportFactice({ lire: { files: [[{ id: H('d'), data: { sha256: H('d'), mime: 'image/png', size: 2, updated_at: '2030-01-01T00:00:00.000Z' }, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: null, server_seq: 4 }], []] } });
      await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir();
      const sans = await db.get('files', H('d'));
      eq(['remote' in sans, 'blob' in sans, F.etatFichier(sans, { uid: 'u1' })], [false, false, 'absent'], 'D-G12 : une ligne reçue sans remote n’est plus marquée remote: true (mutant : fiche.remote = true réintroduit)');
    });
  });

  await run('réception : tombale files sur une ligne avec blob (D-G15, N-4)', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      const photo = octets('photo-tombale'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, { original_filename: 't.jpg' });
      const avant = await db.get('files', sha);
      await db.mutate({ puts: { files: [{ ...avant, remote: R({ sha256: sha, size: photo.size }) }] }, origin: 'device' });
      const journal = [];
      const vraiConsole = console.error;
      console.error = (...a) => journal.push(String(a[0]));
      let bilan = null;
      try {
        const tf = creerTransportFactice({ lire: { files: [[{ id: sha, data: null, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: '2030-01-01T00:00:00.000Z', server_seq: 9 }], []] } });
        bilan = await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir();
      } finally { console.error = vraiConsole; }
      const apres = await db.get('files', sha);
      eq([apres?.blob instanceof Blob, apres?.syncable, apres?.created_at, apres?.original_filename, apres?.remote, apres?.updated_at, await db.count('outbox'), (await db.get('sync_state', 'cursor:files'))?.value, bilan.recues, bilan.supprimees],
        [true, true, avant.created_at, 't.jpg', null, '2030-01-01T00:00:00.000Z', 0, 9, 1, 0], 'tombale files : ligne et blob gardés, syncable et created_at gardés, remote nul, updated_at de la tombale, rien en file, curseur avancé, comptée en recues et jamais en supprimees (mutants : deletes.files réintroduit → blob perdu ; tombale ignorée → remote gardé)');
      ok(journal.some((l) => l.includes('sync.pull.tombale_files')), 'tombale files : journalisée par son code');
    });
  });

  await run('réception : tombales files sans blob, inconnue, plus ancienne', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    const { composerLots } = await import('../src/sync/lots.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }, { sha256: H('8'), mime: 'image/jpeg', size: 5, updated_at: '2031-01-01T00:00:00.000Z', remote: R({ sha256: H('8'), size: 5 }) }, { sha256: H('6'), mime: 'image/jpeg', size: 5, updated_at: '2031-01-01T00:00:00.000Z', remote: null }] }, origin: 'device' });
      const tombale = (id, seq) => ({ id, data: null, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: '2030-01-01T00:00:00.000Z', server_seq: seq });
      const tf = creerTransportFactice({ lire: { files: [[tombale(H('7'), 1), tombale(H('9'), 2), tombale(H('8'), 3), tombale(H('6'), 4)], []] } });
      const vraiConsole = console.error;
      console.error = () => {};
      try { await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir(); } finally { console.error = vraiConsole; }
      const sept = await db.get('files', H('7'));
      const file = await db.getAll('outbox');
      const conflits = await db.getAll('sync_conflicts');
      eq([sept?.remote, F.etatFichier(sept, { uid: 'u1' }), await db.get('files', H('9')), (await db.get('files', H('8')))?.remote, file.filter((e) => e.id === H('8')).map((e) => [e.store, e.id, e.op]), conflits.filter((c) => c.record_id === H('8')).map((c) => [c.store, c.record_id, c.renvoye])],
        [null, 'absent', undefined, R({ sha256: H('8'), size: 5 }), [['files', H('8'), 'put']], [['files', H('8'), true]]], 'tombales files : sans blob → ligne gardée, remote nul (état absent) ; clé inconnue → rien ; plus ancienne que la ligne → conflit_renvoyer comme en L3 (ligne intacte, remise en file)');
      // § 7 : une ligne SANS remote de ce compte, plus récente que la tombale, est remise en file comme en L3 — puis retenue à la composition.
      const six = file.filter((e) => e.store === 'files' && e.id === H('6'));
      const c6 = await composerLots(six, (store, id) => db.get(store, id));
      eq([six.length, (await db.get('files', H('6')))?.updated_at, conflits.some((c) => c.record_id === H('6') && c.renvoye === true), c6.lots, c6.retenues.map((r) => r.raison)], [1, '2031-01-01T00:00:00.000Z', true, [], ['fichier en attente']],
        'tombale plus ancienne sur une ligne SANS remote de ce compte : intacte et remise en file (L3), puis retenue « fichier en attente » à la composition — elle ne part jamais sans copie serveur (§ 7 ; mutant : elementFichier sans la garde remote → un lot part)');
    });
  });

  await run('réception : un remote qui change lève file_error de réception (F-7)', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }], sync_state: [{ key: 'file_error:' + H('7'), value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const tf = creerTransportFactice({ lire: { files: [[{ id: H('7'), data: { sha256: H('7'), mime: 'image/jpeg', size: 5, remote: R({ sha256: H('d') }), updated_at: '2030-01-01T00:00:00.000Z' }, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: null, server_seq: 1 }], []] } });
      const vues = [];
      const vrai = db.mutate;
      db.mutate = function (args) { vues.push(args); return vrai.call(this, args); };
      try { await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir(); } finally { delete db.mutate; }
      eq([await db.get('sync_state', 'file_error:' + H('7')), vues.filter((m) => m.puts?.files && (m.deletes?.sync_state || []).includes('file_error:' + H('7'))).length], [undefined, 1], 'F-7 : remote changé → la clé file_error de réception retirée dans la MÊME transaction (mutant : clé gardée)');
    });
  });

  await run('ajustement du serveur sur une ligne files (D-G16)', async () => {
    const { createPush } = await import('../src/sync/push.js');
    await withRepo(async (repo, db) => {
      const photo = octets('photo-ajustee'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, {});
      const ligne = await db.get('files', sha);
      const remote = R({ sha256: sha, size: photo.size });
      await db.mutate({ puts: { files: [{ ...ligne, remote, updated_at: '2026-10-19T02:00:00.000Z' }] }, origin: 'local' }); // capturée : une entrée files
      const tf = creerTransportFactice({ pousser: [{ reponse: { server_time: '2026-10-19T02:00:01.000Z', accepted: [], adjusted: [{ store: 'files', id: sha, updated_at: '2026-10-19T02:00:00.500Z' }], rejected: [] } }] });
      await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
      const apres = await db.get('files', sha);
      eq([apres.blob instanceof Blob, apres.syncable, apres.created_at, apres.updated_at, apres.remote, 'blob' in tf.journal[0].rows[0].data], [true, true, ligne.created_at, '2026-10-19T02:00:00.500Z', remote, false], 'adjusted (pousser scripté : le factice serveur n’en émet jamais) : blob, syncable, created_at gardés, updated_at du serveur posé, l’élément envoyé sans blob (mutant : spread nu → blob perdu)');
    });
  });

  await run('conflits sur une ligne files : garder ici, garder ailleurs, tombale', async () => {
    const { garderAilleurs, garderIci } = await import('../src/sync/conflits.js');
    await withRepo(async (repo, db) => {
      const photo = octets('photo-conflit'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, {});
      const ligne = await db.get('files', sha);
      const remoteServeur = R({ sha256: H('d'), size: 9 });
      const conflit = { id: 'files:' + sha, store: 'files', record_id: sha, local: ligne, server: { data: { sha256: sha, mime: 'image/jpeg', size: photo.size, remote: remoteServeur, updated_at: ligne.updated_at }, updated_at: ligne.updated_at, deleted_at: null }, at: DATE, kind: 'donnees' };
      await db.mutate({ puts: { sync_conflicts: [conflit] }, origin: 'remote' });
      const applique = await garderAilleurs(db, conflit);
      const apres = await db.get('files', sha);
      eq([applique, apres.blob instanceof Blob, apres.remote, apres.created_at, await db.get('sync_conflicts', conflit.id)], [true, true, remoteServeur, ligne.created_at, undefined], 'garderAilleurs sur files : blob gardé, remote du serveur posé, conflit retiré (mutant : spread nu → blob perdu)');
      const conflitT = { ...conflit, server: { data: null, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: '2030-01-01T00:00:00.000Z' }, renvoye: true };
      await db.mutate({ puts: { sync_conflicts: [conflitT] }, origin: 'remote' });
      const appliqueT = await garderAilleurs(db, conflitT);
      const t2 = await db.get('files', sha);
      eq([appliqueT, t2?.blob instanceof Blob, t2?.remote, t2?.updated_at, await db.get('sync_conflicts', conflit.id), await db.count('outbox')], [true, true, null, '2030-01-01T00:00:00.000Z', undefined, 0], 'garderAilleurs, tombale files (« Supprimer ici aussi », N-4) : ligne et blob gardés, remote nul, updated_at de la tombale, conflit retiré, origine remote (mutant : deletes[conflit.store] → blob perdu)');
      const conflitIci = { ...conflit, local: t2 };
      await db.mutate({ puts: { sync_conflicts: [conflitIci] }, origin: 'remote' });
      await garderIci(db, conflitIci);
      ok((await db.get('files', sha))?.blob instanceof Blob, 'garderIci sur files : inchangé, le blob est dans conflit.local');
    });
  });
```

- [ ] **Step 4 : tests rouges de l'affichage, du réglage, du statique, et le test Node** (à la suite, puis fermer la fonction) :

```js
  await run('affichage : le type du blob, dans la liste, gagne (F-9)', async () => {
    const { displayUrl, typeAffichage } = await import('../src/sync/mime.js');
    eq([typeAffichage({ mime: 'image/heic', blob: octets('j', 'image/jpeg') }), typeAffichage({ mime: 'image/jpeg', blob: octets('<p>', 'text/html') }), typeAffichage({ mime: 'text/html', blob: octets('<p>', 'text/html') }), typeAffichage({ mime: 'image/jpeg' })],
      ['image/jpeg', 'image/jpeg', null, null], 'typeAffichage : copie JPEG sous une ligne HEIC → image/jpeg ; blob text/html sous image/jpeg → retypé (S3 tenu) ; text/html partout → rien (mutant : type du blob pris sans liste blanche) ; sans blob → rien');
    // Le Blob remis à creerUrl — jamais un fetch d'URL blob: (la CSP de tests/index.html, connect-src 'self' https:, ne couvre pas blob:).
    let remis = null;
    eq([displayUrl({ mime: 'image/heic', blob: octets('j', 'image/jpeg') }, (b) => { remis = b; return 'blob:espion'; }), remis?.type], ['blob:espion', 'image/jpeg'], 'displayUrl : une copie JPEG sous une ligne HEIC est remise image/jpeg à creerUrl (mutant : type de la ligne → image/heic)');
    // bookCover et poserImage créent leur URL par urlDeBlob → URL.createObjectURL : un espion lit le Blob remis, la vraie fonction est rendue en finally.
    const vraiCreer = URL.createObjectURL;
    const vus = [];
    URL.createObjectURL = (b) => { vus.push(b); return vraiCreer.call(URL, b); };
    try {
      const { bookCover } = await import('../src/ui/components.js');
      const toile = new OffscreenCanvas(2, 2); toile.getContext('2d').fillRect(0, 0, 2, 2);
      const jpeg = new Blob([await toile.convertToBlob({ type: 'image/png' })], { type: 'image/jpeg' });
      const couv = bookCover({ id: 'e1' }, { title: 'T' }, { fichier: { sha256: H('a'), mime: 'image/heic', blob: jpeg } });
      eq([!!couv.querySelector('img.cover-img'), vus.map((b) => b.type)], [true, ['image/jpeg']], 'bookCover : une copie JPEG reçue sous une ligne HEIC s’affiche, et le Blob affiché est image/jpeg (mutant : safeDisplayType(fichier.mime) gardé → image/heic)');
      // import-cible.js (poserImage) : la troisième lecture de la règle — vignette de page et aperçu de la photo du plat de l'import ciblé.
      vus.length = 0;
      const { renderImportCible } = await import('../src/ui/import-cible.js');
      await withRepo(async (repo, db) => {
        const ligneHeic = (sha256) => ({ sha256, mime: 'image/heic', size: 999, blob: jpeg, syncable: true, created_at: DATE, updated_at: DATE });
        await db.mutate({ puts: {
          files: [ligneHeic(H('a')), ligneHeic(H('b'))],
          source_pages: [{ id: 'pgIC', document_id: 'dIC', sha256: H('b'), updated_at: DATE }],
          recipes: [{ id: 'rIC', original_title: 'Tarte', availability: 'reference_only', edition_id: null, updated_at: DATE }],
          imports: [{ id: 'impIC', kind: 'recette', recipe_id: 'rIC', edition_id: null, scan_session_id: null, status: 'a_lancer', page_ids: ['pgIC'], photo_sha256: H('a'), photo_origin: 'image', created_at: DATE, updated_at: DATE }],
        }, origin: 'device' });
        const recette = await db.get('recipes', 'rIC');
        const ctxIC = { recipesById: new Map([['rIC', recette]]), editionsById: new Map(), booksById: new Map(), sync: {} };
        const root = await renderImportCible({ id: 'rIC' }, {}, ctxIC, { repo, navigate: () => {}, toast: () => {}, fetch: async () => { throw new Error('aucun réseau attendu'); }, pickFiles: async () => [] });
        for (let i = 0; i < 100 && vus.length < 2; i += 1) await new Promise((r) => setTimeout(r, 10));
        eq([vus.map((b) => b.type), !!root.querySelector('.thumbs img'), !!root.querySelector('[data-role="apercu-plat"]')], [['image/jpeg', 'image/jpeg'], true, true], 'import ciblé (poserImage, F-9) : la vignette de page et l’aperçu du plat d’une copie JPEG sous une ligne HEIC sont servis image/jpeg (mutant : safeDisplayType(f?.mime) gardé → image/heic)');
      });
    } finally { URL.createObjectURL = vraiCreer; }
    (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
  });

  await run('réglage upload_quality et qualiteEnvoi (§ 3.3)', async () => {
    const S = await import('../src/ui/state.js');
    try {
      await withRepo(async (repo) => {
        eq(await repo.getSetting('upload_quality'), 'reduite', 'D-G3 : Réduite par défaut (DEFAULT_SETTINGS)');
        await S.relireReglages();
        const lu = [S.qualiteEnvoi()];
        await repo.setSetting('upload_quality', 'originale'); await S.relireReglages(); lu.push(S.qualiteEnvoi());
        await repo.setSetting('upload_quality', 'inconnue'); await S.relireReglages(); lu.push(S.qualiteEnvoi());
        await S.relectureEnCours();
        eq(lu, ['reduite', 'originale', 'reduite'], 'qualiteEnvoi : une fonction relue à chaque appel (B-16) ; une valeur inconnue vaut Réduite');
      });
    } finally { await S.relireReglages(); } // la base de l'app reprend la main (gabarit de tests/sync.js) : `reglages` ne garde pas l'état d'une base fermée
  });

  await run('statique tâche 1', async () => {
    const sw = await lire('../sw.js');
    ok(sw.includes("'./src/sync/fichiers.js'"), 'SHELL : ./src/sync/fichiers.js (atteignable par pull.js dès la tâche 1, F-5)');
    ok(/VERSION = 'cuisine-os-v0\.11\.0-\d+'/.test(sw), 'sw.js : VERSION 0.11.0');
    const { APP_VERSION, DB_VERSION } = await import('../src/model/schema.js');
    eq([APP_VERSION, DB_VERSION], ['0.11.0', 4], 'D-G11 : APP_VERSION 0.11.0, DB_VERSION inchangée');
    const { MODULES_NEUFS } = await import('./ajouter.js');
    ok(MODULES_NEUFS.includes('../src/sync/fichiers.js'), 'filet i18n : MODULES_NEUFS contient src/sync/fichiers.js');
  });
}
```

`tools/fichiers-node.test.mjs` (F-12) :

```js
// Contrainte Node du lot G (spec § 3.1, F-12) : src/sync/fichiers.js et tout ce qu'il importe se chargent sous Node — aucun global du
// navigateur au niveau d'un module (createImageBitmap, OffscreenCanvas, document restent dans des fonctions).
import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteValide, remoteDeCeCompte, projectionFichier, CHAMPS_FILES_SERVEUR } from '../src/sync/tables.js';

const R = { sha256: 'e'.repeat(64), size: 400, mime: 'image/jpeg', quality: 'reduite', uploaded_at: '2026-10-19T00:00:00.000Z', owner: 'u1' };

test('fichiers.js se charge sous Node et réexporte remoteValide', async () => {
  const F = await import('../src/sync/fichiers.js');
  assert.equal(F.remoteValide, remoteValide);
  assert.equal(F.remoteValide(R), true);
  assert.equal(F.remoteValide(true), false);
  assert.equal(F.remoteDeCeCompte(R, 'u1'), true);
  assert.equal(remoteDeCeCompte(R, 'u2'), false);
});

test('tables.js : la projection serveur d’une ligne files', () => {
  assert.deepEqual([...CHAMPS_FILES_SERVEUR], ['sha256', 'mime', 'size', 'original_filename', 'remote', 'updated_at']);
  assert.deepEqual(projectionFichier({ sha256: 'a'.repeat(64), mime: 'image/png', size: 3, syncable: true, created_at: 'x', updated_at: 'y', remote: true }), { sha256: 'a'.repeat(64), mime: 'image/png', size: 3, updated_at: 'y', remote: null });
});
```

- [ ] **Step 5 : amender les onze lignes de la tâche 1 (I-G9), exactement.** Repérées par leur libellé actuel (numéros relevés à `bd03e48`,
  retrouvés identiques à `3601a52` : se fier au libellé). La réécriture du commentaire R-L3-22 (deux lignes → une) et l'import de `remoteValide`
  (une ligne de plus, avant la l. 674) font que, la tâche faite, les lignes 527 à 545 sont à 526-544 ; la l. 682 reste à 682. Chaque ligne ci-dessous REMPLACE la ligne d'origine, mot pour mot ; le commentaire R-L3-22 qui les précède (« `files`
  n'est PAS de l'envoi initial en L3 … ») est réécrit en une phrase : « L4 (D-G8) : `files` est de l'envoi initial, filtrée par remote de ce compte ;
  son marqueur est posé. » Les deux `derniersEffets` (l. 1703, 1708) ne sont **pas** touchés ici : seul le moteur de la tâche 4 pose
  `fichiersRecus` (tâche 4, Step 1) — amendés ici, ils rougiraient les tâches 1 à 3.

```js
// tests/sync-l3.js l. 100 — LIBELLÉ seul (valeurs inchangées : relire → undefined → retenue, jamais « disparue »)
  eq([cf.lots, cf.abandonnees], [[], []], 'lots : deux put du même fichier ne produisent aucun lot — une ligne files relue absente est retenue, jamais « disparue » (L4 : la retenue suit la relecture et précède la branche « fiche disparue »)');
// tests/sync-l3.js ≈ l. 527, 528, 529
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false }).length, 25, 'envoi initial : 25 tables (imports et files comprises ; files depuis L4) sans l’historique ni assistant_config (hors production par défaut)');
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true }).length, 26, 'envoi initial : 26 tables avec l’historique');
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true }).includes('files'), true, 'L4 (D-G8) : « files » est de l’envoi initial, filtrée par remote de ce compte');
// ≈ l. 537, 543, 545
    eq(r.tables.length, 25, 'envoi initial : les 25 tables sont parcourues (imports et files comprises ; ni l’historique, ni assistant_config hors production)');
    eq((await db.get('sync_state', 'backfill:files'))?.value, 'fait', 'L4 (D-G8) : le marqueur « backfill:files » est posé par l’envoi initial (aucune ligne à remote de ce compte : rien en file)');
    ok(progression.some((p) => p.table === 'books' && p.n >= 1 && p.total === 25), 'envoi initial : progression « table n/25 »');
// ≈ l. 682 (et, en tête du même withRepo, avant `const sha = 'c'.repeat(64);`, la ligne : const { remoteValide } = await import('../src/sync/tables.js');)
    eq([remoteValide(sans.remote), 'blob' in sans], [false, false], 'réception (L4, D-G12) : une ligne files inconnue arrive sans octets et sans remote valide (plus remote: true)');
// tests/assistant-compte.js ≈ l. 388, 395, 401
  eq([tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false }).includes('assistant_config'), tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false, configSuitLeCompte: () => true }).includes('assistant_config'), tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true, configSuitLeCompte: () => true }).length], [false, true, 27], 'envoi initial : hors production exclue ; en production incluse (27 avec l’historique, imports et files)');
    eq([r.tables.length, r.tables.slice(-2), prog.every((p) => p.total === 26), (await db.getAll('outbox')).map((e) => [e.store, e.op, e.user_id])], [26, ['assistant_config', 'imports'], true, [['assistant_config', 'put', 'u1']]], 'envoi initial : en production, 26 tables (files comprise depuis L4), assistant_config puis imports (dernière, lot A) sont parcourues, la ligne mise en file au nom du compte, progression sur 26');
    eq([r.tables.includes('assistant_config'), prog.every((p) => p.total === 25), await db.count('outbox'), await db.get('sync_state', 'backfill:assistant_config')], [false, true, 0, undefined], 'envoi initial : hors production (défaut), rien en file, aucun marqueur posé, progression sur 25 (imports et files comprises)');
```

  Mesuré à `bd03e48` (Node, `src/model/schema.js` et `src/sync/backfill.js` du worktree) : `SYNC_STORES` = 27, `tablesCandidates()` hors
  production et sans historique = 24 aujourd'hui, 25 avec `files` ; `files` précède `assistant_config` et `imports` dans `SYNC_STORES`, donc
  `r.tables.slice(-2)` reste `['assistant_config', 'imports']` (inchangé à `3601a52` : le lot B
  n'ajoute aucun magasin). Inchangées et contraignantes : `tests/sync-l3.js` l. 99-101 (valeurs : `relire →
  undefined` sur deux `put` `files` → `retenue` ; seul le libellé de l. 100 change) et l. 540-542 (`refs + 2`, aucune entrée `files` : les deux
  lignes de la fixture n'ont pas de `remote`). Pins (même étape) : les dix lignes `0.10.0` des six suites (liste à `3601a52` : Global Constraints, Versions) deviennent `0.11.0` (valeurs) et
  `v0\.11\.0-\d+` (expressions), libellés « 0.11.0 (lot G) ».

- [ ] **Step 6 : lancer la suite et Node, lire le rouge** (attendu : `Lot G — …` rouges ou « Suite photos entre appareils interrompue » faute
  du module ; les dix assertions amendées en valeur rouges — le libellé de l. 100 reste vert, ses valeurs ne changent pas ; Node :
  `fichiers-node.test.mjs` en échec d'import). **Mesuré au rejeu** : 3653/3673, vingt rouges — six lignes I-G9 de `tests/sync-l3.js` en valeur
  (527, 528, 529, 537, 543, 545), « Suite L3 interrompue : remoteValide is not a function » (la l. 682 lit `remoteValide`, pas encore exporté : la suite
  L3 s'arrête là, ce qui masque son pin l. 1867 et les lignes I-G9 des tâches 4 et 5), trois de `tests/assistant-compte.js` (388, 395, 401), huit pins
  visibles, « Suite photos entre appareils interrompue » (module absent), l'épingle ; Node 172/173 (`fichiers-node.test.mjs`).

- [ ] **Step 7 : implémenter.**

`src/sync/tables.js` : la ligne `import { ALLOWED_MIME } from './mime.js';` va **sous l'import de tête** (l. 4, `import { STORES,
SYNC_STORES } from '../model/schema.js';`) — jamais au milieu du fichier, qui est la source de vérité du générateur ; puis, après `keyOf`, les
exports :

```js
// Lot G (spec § 3.1, D-G8) : les champs d'une ligne `files` que le serveur porte — ce que lots.js envoie, ce que `identiques` compare.
export const CHAMPS_FILES_SERVEUR = Object.freeze(['sha256', 'mime', 'size', 'original_filename', 'remote', 'updated_at']);
const HASH = /^[a-f0-9]{64}$/;
const QUALITES = ['reduite', 'originale'];
const OCTETS_MAX = 52428800; // file_size_limit du seau `pages` (0002)

// La copie serveur d'une ligne `files` (D-G12) : objet nu, lu par Object.hasOwn ; un champ en plus est ignoré (F-23 : une version future qui
// enrichit `remote` ne fait pas renvoyer chaque photo) ; tout le reste — dont le booléen `true` de L3 — vaut « aucune copie serveur connue ».
// Une ligne reçue est une donnée hostile : rien ne se télécharge sur un remote invalide. `uploaded_at` n'est jamais interprété.
export function remoteValide(remote) {
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return false;
  const proto = Object.getPrototypeOf(remote);
  if (proto !== Object.prototype && proto !== null) return false;
  const lu = (cle) => (Object.hasOwn(remote, cle) ? remote[cle] : undefined);
  const sha = lu('sha256'), size = lu('size'), mime = lu('mime'), quality = lu('quality'), uploaded = lu('uploaded_at'), owner = lu('owner');
  return typeof sha === 'string' && HASH.test(sha)
    && Number.isSafeInteger(size) && size >= 1 && size <= OCTETS_MAX
    && ALLOWED_MIME.includes(mime) && QUALITES.includes(quality) && typeof uploaded === 'string'
    && typeof owner === 'string' && owner.length > 0 && owner.length <= 64;
}

// R-G-2 : un remote d'un autre compte vaut « aucune copie serveur connue » (ses octets sont dans un dossier que pages_select interdit).
export const remoteDeCeCompte = (remote, uid) => remoteValide(remote) && typeof uid === 'string' && remote.owner === uid;

// Ce qui part et ce qui se compare (D-G8) : les champs serveur seulement, `remote` tel quel s'il est valide (quel que soit owner : S-8), null
// sinon. Jamais `blob` (contrainte not (data ? 'blob') de 0001), ni `syncable`, ni `created_at`.
export function projectionFichier(row) {
  const sortie = {};
  for (const champ of CHAMPS_FILES_SERVEUR) {
    if (champ !== 'remote' && row && Object.hasOwn(row, champ) && row[champ] !== undefined) sortie[champ] = row[champ];
  }
  sortie.remote = remoteValide(row?.remote) ? row.remote : null;
  return sortie;
}
```

`src/sync/fichiers.js` (création) :

```js
// Lot G « Les photos voyagent entre appareils » (spec § 3, § 4.7, § 4.8) : UNE définition de ce qu'est un fichier référencé, une ligne à
// envoyer, la fusion d'une ligne venue du serveur, l'écriture d'octets reçus et la garde de relecture (I-G10) — relues par la passe, la
// capture, les lots, la réception, les ajustements, les conflits, l'archive, repo.putFile et Réglages. Contrainte Node (F-12) : aucun global
// du navigateur au niveau du module (tools/fichiers-node.test.mjs l'importe sous Node). Les modules de src/sync/ n'importent jamais repo.
import { remoteValide, remoteDeCeCompte } from './tables.js';
import { isAllowed } from './mime.js';
import { t } from '../core/i18n.js';

export { remoteValide, remoteDeCeCompte };
export const HASH_FICHIER = /^[a-f0-9]{64}$/;

// L'original est ICI quand la taille du blob est celle de la ligne (sans hachage ; limite dite § 11 : une copie de la même taille passerait).
export const estOriginalIci = (row) => row?.blob instanceof Blob && row.blob.size === row.size;
// Une copie dont la taille n'est plus celle que le serveur porte (renvoi en originale fait ailleurs) : `present`, comptée, jamais retéléchargée.
export const copiePerimee = (row) => row?.blob instanceof Blob && !estOriginalIci(row) && remoteValide(row.remote) && row.blob.size !== row.remote.size;

// § 3.5 : les cinq pointeurs vers `files` ; une ligne hors de cet ensemble est un orphelin (ni envoyé, ni compté, ni effacé — D-G1).
const POINTEURS = [['source_pages', 'sha256'], ['source_documents', 'sha256'], ['book_editions', 'cover_sha256'], ['recipes', 'photo_sha256'], ['imports', 'photo_sha256']];
export function referencesFichiers(snapshot) {
  const refs = new Set();
  for (const [store, champ] of POINTEURS) {
    for (const r of snapshot?.[store] || []) { const v = r?.[champ]; if (typeof v === 'string' && HASH_FICHIER.test(v)) refs.add(v); }
  }
  return refs;
}

// Quatre états (§ 3.1) ; `erreur` prime : une clé posée est un fait qu'un geste retire.
export function etatFichier(row, { uid = null, erreurs = new Set() } = {}) {
  if (row && erreurs.has(row.sha256)) return 'erreur';
  if (row?.blob instanceof Blob) return 'present';
  if (row && remoteDeCeCompte(row.remote, uid)) return 'distant';
  return 'absent';
}

// Le nom que la personne reconnaît (B-23, I-G8), par l'inverse de referencesFichiers ; repli : l'empreinte tronquée à 12.
export function nomFichier(sha256, snapshot = {}) {
  const parId = (store) => new Map((snapshot?.[store] || []).filter(Boolean).map((r) => [r.id, r]));
  const documents = parId('source_documents'), editions = parId('book_editions'), livres = parId('books');
  const titreLivre = (editionId) => { const ed = editionId ? editions.get(editionId) : null; return (ed && livres.get(ed.book_id)?.title) || null; };
  const page = (snapshot?.source_pages || []).find((p) => p?.sha256 === sha256);
  if (page) {
    const livre = titreLivre(documents.get(page.document_id)?.edition_id ?? page.edition_id);
    const p = page.printed_page ?? null;
    if (livre) return p != null ? t('Page {p} · {livre}', { p, livre }) : t('page non numérotée · {livre}', { livre });
    return p != null ? t('Page {p}', { p }) : t('page non numérotée');
  }
  const doc = (snapshot?.source_documents || []).find((d) => d?.sha256 === sha256);
  if (doc?.original_filename) return String(doc.original_filename);
  const edition = (snapshot?.book_editions || []).find((e) => e?.cover_sha256 === sha256);
  if (edition) return t('Couverture · {livre}', { livre: titreLivre(edition.id) || t('Sans titre') });
  const recette = (snapshot?.recipes || []).find((r) => r?.photo_sha256 === sha256);
  if (recette) return t('Photo du plat · {titre}', { titre: recette.original_title || t('Sans titre') }); // les versions ne portent pas de titre (doute 7)
  const imp = (snapshot?.imports || []).find((i) => i?.photo_sha256 === sha256);
  if (imp) return t('Photo importée · {date}', { date: String(imp.created_at || '').slice(0, 10) });
  return String(sha256).slice(0, 12);
}

// Les lignes à envoyer (§ 4.7, 2.) : un ORIGINAL ici (jamais une copie du serveur, S-3), syncable, référencé, sans file_error, et sans remote de
// ce compte — ou, seulement sur « Renvoyer en originale », une ligne partie réduite (B-21). Triées par created_at ?? updated_at (B-20).
const dateDe = (row) => String(row?.created_at ?? row?.updated_at ?? '');
export function candidatsEnvoi(snapshot, { uid = null, renvoi = false, erreurs = new Set() } = {}) {
  const refs = referencesFichiers(snapshot);
  return (snapshot?.files || [])
    .filter((row) => row && estOriginalIci(row) && row.syncable !== false && refs.has(row.sha256) && !erreurs.has(row.sha256)
      && (!remoteDeCeCompte(row.remote, uid) || (renvoi && row.remote.sha256 !== row.sha256)))
    .sort((a, b) => (dateDe(a) < dateDe(b) ? -1 : dateDe(a) > dateDe(b) ? 1 : 0));
}

// D-G16 : UNE règle pour toute écriture d'une ligne files depuis une copie serveur (réception, adjusted, garderAilleurs, tombale) :
// { ...métadonnées locales sans blob ni remote, ...data, updated_at } + le blob local s'il existe. `remote` est celui de data — jamais
// effacé quand data le porte, jamais `true`, jamais gardé du local quand data ne le porte pas.
export function fusionnerFichier(locale, data, updated_at) {
  const { blob, remote: _ancien, ...meta } = locale || {};
  const fiche = { ...meta, ...(data || {}), updated_at };
  if (blob instanceof Blob) fiche.blob = blob;
  return fiche;
}

// Octets reçus du serveur (§ 3.1) : ni size, ni mime, ni updated_at ne bougent (sinon chaque écho ferait un conflit) ; une règle, deux appelants
// (repo.putFile d'origine remote et la passe, F-20).
export const fusionnerOctetsRecus = (existing, blob) => ({ ...existing, blob, syncable: isAllowed(existing?.mime) });

// Garde de relecture à l'envoi (N-2) : rien si la ligne a bougé depuis la lecture (réception pendant l'envoi : S-10) ou si ce remote est
// DÉJÀ posé pour cette empreinte sous ce compte ; un renvoi en originale et un ré-envoi sous un autre compte passent.
export function peutEcrireRemote(avant, relue, { h, uid } = {}) {
  if (!relue || !(relue.blob instanceof Blob)) return false;
  if ((relue.updated_at ?? null) !== (avant?.updated_at ?? null)) return false;
  return !(remoteDeCeCompte(relue.remote, uid) && relue.remote.sha256 === h);
}

// Même forme à la réception (§ 4.8) : rien si un blob est déjà là ou si la ligne a bougé pendant la descente.
export const peutEcrireOctets = (avant, relue) => !!relue && !(relue.blob instanceof Blob) && (relue.updated_at ?? null) === (avant?.updated_at ?? null);
```

`src/sync/pull.js` : importer `import { projectionFichier } from './tables.js';` et `import { fusionnerFichier, HASH_FICHIER } from './fichiers.js';` ;
`identiques(a, b, table = null)` compare `projectionFichier(fiche)` quand `table === 'files'` (`const sansHeure = (fiche) => { const { updated_at:
_heure, ...reste } = (table === 'files' ? projectionFichier(fiche) : fiche) || {}; return stable(reste); };`) ; `decider({ locale, distante, table =
null })` passe `table` à `identiques` ; `appliquerPage` appelle `decider({ locale, distante: ligne, table })`, **retire `ficheFichier`**, et :

```js
      if (decision === 'supprimer') {
        if (table === 'files') {
          // D-G15 / N-4 : une tombale files dit « cette copie serveur n'existe plus », jamais « efface l'original » : ligne et blob restent,
          // remote passe à null. Comptée en recues, jamais en supprimees ; rien ne repart (origine remote).
          (puts.files ||= []).push(fusionnerFichier(locale, { remote: null }, ligne.updated_at));
          recues += 1;
          logError('sync.pull.tombale_files', { table });
          continue;
        }
        (deletes[table] ||= []).push(ligne.id); supprimees += 1; continue;
      }
      if (decision === 'ignorer') continue;
      if (decision === 'ecrire') {
        if (table === 'files') {
          (puts.files ||= []).push(fusionnerFichier(locale, ligne.data, ligne.updated_at));
          // F-7 : un remote qui CHANGE lève l'erreur de réception posée sur l'ancien, dans la même transaction.
          if (HASH_FICHIER.test(ligne.id) && JSON.stringify(stable(locale?.remote ?? null)) !== JSON.stringify(stable(ligne.data?.remote ?? null))) {
            const cle = 'file_error:' + ligne.id;
            if ((await db.get('sync_state', cle))?.value?.sens === 'reception') (deletes.sync_state ||= []).push(cle);
          }
        } else (puts[table] ||= []).push({ ...ligne.data, updated_at: ligne.updated_at });
        recues += 1;
        // (inchangé : conflit de pointeur des recettes)
```

`src/sync/conflits.js` : `import { fusionnerFichier } from './fichiers.js';` ; dans `garderAilleurs`, après les gardes existantes :

```js
  const puts = {};
  const deletes = { sync_conflicts: [conflit.id] };
  if (conflit.store === 'files') {
    // D-G15 / D-G16 : ni la version d'ailleurs ni sa tombale ne remplacent la ligne d'ici — le blob local reste, remote suit le serveur.
    const ici = (await db.get('files', conflit.record_id)) ?? conflit.local ?? null;
    if (serveur.deleted_at) { if (ici) puts.files = [fusionnerFichier(ici, { remote: null }, serveur.updated_at)]; }
    else puts.files = [fusionnerFichier(ici, serveur.data, serveur.updated_at)];
  } else if (serveur.deleted_at) deletes[conflit.store] = [conflit.record_id];
  else puts[conflit.store] = [{ ...serveur.data, updated_at: serveur.updated_at }];
  await db.mutate({ puts, deletes, origin: 'remote' });
  return true;
```

`src/sync/reponses.js` : `import { fusionnerFichier } from './fichiers.js';` ; dans la boucle `adjusted`, avant `const connue` :

```js
    if (a.store === 'files') {
      // D-G16 : `element.data` est la projection, sans blob — un { ...data } remplacerait la ligne et perdrait l'original. Sans fiche locale
      // connue (appel sans contexte), rien n'est réécrit pour files.
      const locale = fichesLocales[k];
      if (!Object.hasOwn(fichesLocales, k) || !locale || locale.updated_at !== element.updated_at) continue;
      (reecrire.files ||= []).push(fusionnerFichier(locale, element.data, a.updated_at));
      continue;
    }
```

`src/sync/outbox.js` : `import { keyOf, remoteDeCeCompte } from './tables.js';` ; `const SYNCHRONISEES = SYNC_STORES;` (le commentaire R-L3-22
réécrit : « L4 (D-G8) : une ligne files n'entre en file QUE quand ses octets sont confirmés — remote valide de ce compte — et jamais une
suppression ») ; dans la boucle des `puts` : `if (store === 'files') { for (const r of list) if (r?.syncable !== false && remoteDeCeCompte(r?.remote,
user_id)) rows.push({ user_id, store, id: keyOf(store, r), op: 'put', updated_at: r.updated_at || null, tries: 0 }); continue; }` ; dans la boucle des
`deletes` : `if (store === 'files') continue;`.

`src/sync/backfill.js` : `import { keyOf, remoteDeCeCompte } from './tables.js';` ; `tablesCandidates` sans le filtre `t !== 'files'` (commentaire
mis à jour : L4 envoie `files`) ; dans `envoiInitial`, `const lignes = (await db.getAll(table)).filter((r) => table !== 'files' || (r?.syncable !==
false && remoteDeCeCompte(r?.remote, user_id)));`.

`src/sync/lots.js` : `import { projectionFichier, remoteDeCeCompte } from './tables.js';` ; `elementDe` commence par `if (entree.store === 'files')
return elementFichier(entree, relire);` avec :

```js
// Lot G (D-G8) : une entrée files part avec la PROJECTION serveur, relue au moment de l'envoi ; sans remote de ce compte (ou disparue), elle est
// retenue « fichier en attente » — la retenue PRÉCÈDE la branche « fiche disparue » (R-L3-28 : l. 99-101 de tests/sync-l3.js). Jamais une tombale.
async function elementFichier(entree, relire) {
  if (entree.op !== 'put') return { retenue: true };
  const fiche = await relire('files', entree.id);
  if (!fiche || !remoteDeCeCompte(fiche.remote, entree.user_id)) return { retenue: true };
  const data = nettoyerChaines(projectionFichier(fiche));
  return { element: { store: 'files', id: entree.id, data, updated_at: data.updated_at || entree.updated_at, deleted: false } };
}
```

`src/model/repo.js` : `import { fusionnerOctetsRecus } from '../sync/fichiers.js';` ; `DEFAULT_SETTINGS` gagne `upload_quality: 'reduite', // qualité
d'envoi des photos (lot G, D-G3) : par appareil, jamais synchronisée` ; `init()` appelle `await convertirRemoteBooleen();` après `await
purgerFilesEnFile();` ; ajouter :

```js
// Passe unique (lot G, D-G12) : `remote` change de nature — le booléen `true` de L3 (« ligne reçue sans octets ») est retiré des lignes files.
// Garde dans la même transaction, updated_at conservé, origine 'device' (rien en file). Une bibliothèque saine ne réécrit aucune ligne.
const REMOTE_V2_GUARD = 'files_remote_v2';
export async function convertirRemoteBooleen() {
  if ((await db.get('sync_state', REMOTE_V2_GUARD))?.value === 1) return 0;
  const lignes = (await db.getAll('files')).filter((r) => r?.remote === true);
  const puts = { sync_state: [{ key: REMOTE_V2_GUARD, value: 1 }] };
  if (lignes.length) puts.files = lignes.map(({ remote: _booleen, ...reste }) => reste);
  await db.mutate({ puts, origin: 'device' });
  return lignes.length;
}
```

et `putFile` devient :

```js
export async function putFile(sha256, blob, meta = {}) {
  const existing = await db.get('files', sha256);
  if (existing && existing.blob instanceof Blob) return existing;
  const { origin, ...brut } = meta;
  const rest = nettoyerChaines(brut); // B-27 : un original_filename à caractère de contrôle faisait un conflit perpétuel dès que la ligne part
  if (origin === 'remote' && existing) {
    // Lot G (§ 3.1, F-20) : des octets reçus du serveur ne touchent ni size, ni mime, ni updated_at — la règle de la passe, la même fonction.
    const row = fusionnerOctetsRecus(existing, blob);
    await db.mutate({ puts: { files: [row] }, origin: 'remote' });
    return row;
  }
  const { mime, syncable } = resolveMime(blob.type || rest.mime || existing?.mime, rest.original_filename || existing?.original_filename);
  const now = syncNow();
  const row = { ...(existing || {}), ...rest, sha256, blob, mime, syncable, size: blob.size, created_at: existing?.created_at || now, updated_at: now };
  await db.mutate({ puts: { files: [row] }, origin: origin === 'remote' ? 'remote' : 'local' });
  return row;
}
```

`src/ui/state.js` (après `isActivitySynced`) : `export const qualiteEnvoi = () => (reglages.upload_quality === 'originale' ? 'originale' :
'reduite');` avec le commentaire « relue à CHAQUE fichier par la passe (B-16) ; une valeur inconnue vaut Réduite ».

`src/sync/mime.js` : ajouter `typeAffichage` et réécrire `displayUrl` :

```js
// Lot G (F-9) : le type du BLOB, s'il est dans la liste blanche, gagne — une copie JPEG reçue sous une ligne image/heic s'affiche image/jpeg ;
// un type hors liste n'est jamais servi (S3 du lot UX) : repli sur le type de la ligne, sinon rien.
export function typeAffichage(fileRow) {
  if (!(fileRow?.blob instanceof Blob)) return null;
  return safeDisplayType(String(fileRow.blob.type || '').toLowerCase().split(';')[0].trim()) ?? safeDisplayType(fileRow?.mime);
}

// `creerUrl` (ronde 1 de la tâche 5 du lot A, `f8cfafa`) : qui crée l'URL — une vue qui suit ses URL passe urlDeBlob. Signature gardée.
export function displayUrl(fileRow, creerUrl = (b) => URL.createObjectURL(b)) {
  const type = typeAffichage(fileRow);
  if (!type) return null;
  return creerUrl(fileRow.blob.type === type ? fileRow.blob : new Blob([fileRow.blob], { type }));
}
```

`src/ui/components.js` : l'import de `../sync/mime.js` devient `import { displayUrl, typeAffichage } from '../sync/mime.js';`
(`safeDisplayType` n'y est plus lu) ; dans `bookCover`, `const type = typeAffichage(fichier); const affichable = !!type && type.startsWith('image/');`
(le reste inchangé ; commentaire S3 complété « la règle de displayUrl, F-9 »). `src/ui/recipe.js` : l'import l. 7 devient `import { displayUrl,
typeAffichage } from '../sync/mime.js';` et `photoDuPlat` (seul lecteur de `safeDisplayType` dans ce fichier) teste
`typeAffichage(fichier)?.startsWith('image/')` à la place de `safeDisplayType(fichier?.mime)?.startsWith('image/')` (sa forme complète vient en
tâche 6, qui ne touche plus l'import de `mime.js`). `src/ui/import-cible.js` : l'import l. 17 devient `import { typeAffichage } from
'../sync/mime.js';` et, dans `poserImage` (l. 451 à `3601a52`), `const type = safeDisplayType(f?.mime); …` puis `if (!(f?.blob instanceof Blob) || !type ||
!type.startsWith('image/')) return;` deviennent `const type = typeAffichage(f); // F-9 (lot G) : le type du blob, dans la liste blanche, gagne — la
règle de displayUrl` puis `if (!type || !type.startsWith('image/')) return;` (`typeAffichage` rend `null` sans blob ; la ligne `urlDeBlob(…)`
suivante inchangée). Une règle d'affichage, lue par `displayUrl`, `bookCover` et `poserImage` (et `photoDuPlat` par `displayUrl`).

`src/domain/backup.js` (deux lignes remontées de la tâche 2, qui réécrit ensuite ces deux endroits sur la même règle) : dans `createArchive`,
le bloc `if (!(file.blob instanceof Blob)) { … if (file.remote) { missingFiles++; continue; } throw new Error('Fichier source invalide : ' +
file.sha256); }` devient `if (!(file.blob instanceof Blob)) { missingFiles++; continue; } // D-G12 : sans octets ici = manquante, quelle que soit
remote` ; dans `verifyRestored`, `comparableFiles` devient `snapshot.files.filter((row) => row.blob instanceof Blob)`. Sans elles, entre les commits
des tâches 1 et 2, toute ligne reçue sans octets — dont la passe unique a retiré le booléen — ferait lever `createArchive` (aucun test existant ne
le verrait : `tests/sync.js` l. 92 pose `remote: true` sans `init()`).

`src/model/schema.js` : `export const APP_VERSION = '0.11.0';`.

`src/i18n/en.js` (avant `};`, sous `// Lot G : nom d'un fichier dans Réglages (nomFichier).`) :
`"Page {p} · {livre}": "Page {p} · {livre}"`, `"page non numérotée · {livre}": "unnumbered page · {livre}"`, `"Page {p}": "Page {p}"`,
`"page non numérotée": "unnumbered page"`, `"Couverture · {livre}": "Cover · {livre}"`, `"Photo du plat · {titre}": "Dish photo · {titre}"`,
`"Photo importée · {date}": "Imported photo · {date}"`.

`tests/transport-factice.js`, dans `arbitrer`, après le contrôle de clé : `if (store === 'files' && data && Object.hasOwn(data, 'blob')) return {
store, id, reason: 'forme' }; // check (not (data ? 'blob')) de 0001 : les octets ne voyagent jamais dans data`.

`tests/ajouter.js` : `MODULES_NEUFS` + `'../src/sync/fichiers.js'` en fin de liste, après `vol.js` du lot B (commentaire « … + le module des fichiers du lot G »).

`sw.js` : `SHELL` + `'./src/sync/fichiers.js'`, `VERSION = 'cuisine-os-v0.11.0-1'`.

- [ ] **Step 8 : vert.** Suite : BILAN `N/N` vert, seul le 404 de `/favicon.ico` en console ; relever « obtenu » de l'assertion du total et
  poser l'épingle de `tests/tests.js` à (obtenu) ; relancer, vert. `node --test tools/*.test.mjs` : départ + 2. `node
  tools/generer-migrations.mjs --check` : 0. **Mesuré au rejeu** : seule l'épingle rouge (obtenu 4057), puis 4058/4058 (épingle 4057), seul le 404
  de `/favicon.ico` ; Node 174/174 ; `--check` 0 ; `APP_VERSION 0.11.0`, `sw.js cuisine-os-v0.11.0-1`.
- [ ] **Step 9 : invisibles** (Python `-I`) sur chaque fichier touché ; `git diff --stat` relu (aucun fichier hors liste).
- [ ] **Step 10 : commit** `Fichiers L4 : remote objet, projection serveur, fusion unique, tombale files sans perte, capture et envoi initial filtres (lot G, tache 1)`.

---

### Task 2 : Archive — pages manquantes, copies, originaux jamais remplacés (spec § 3.4, § 4.6, D-G3, D-G7, S-1, B-6, B-25, N-1, R-G-6)

**Files:**
- Modify: `src/domain/backup.js` (`README_TXT`, `createArchive`, `inspectArchive`, `requireInspection`, `octetsRestaures` exportée,
  `applyArchive`, `verifyRestored`, `compterFichesSynchronisees` ; imports `remoteValide` de `../sync/tables.js` et `estOriginalIci` de
  `../sync/fichiers.js`)
- Modify: `src/ui/settings.js` (`renderSettings(params, query, ctx, { fetch, createArchive = createArchiveReel, pickFiles: choisirArchive =
  pickFiles, telechargerArchive = downloadBlob } = {})` ; `messagesArchive`,
  `phrasesInspection`, `messageOriginauxConserves` exportées ; bilan de création, rapport d'inspection, bilan de restauration)
- Modify: `src/i18n/en.js` (dix chaînes), `tests/ajouter.js` (clé **neuve** `CHAINES_NEUVES_AILLEURS['../src/ui/settings.js']`), `sw.js`
  (`VERSION -2`), `tests/sync-l4.js` (bloc tâche 2 ; **ajout** en tête de `import { withDatabase, rewriteArchive } from './backup.js';`),
  `tests/tests.js` (total)

**Interfaces:**
- Consumes : `remoteValide` (tâche 1), `estOriginalIci` (tâche 1).
- Produces (`backup.js`) : `createArchive(db, { deviceName })` → `{ blob, manifest, bytes, filesBytes, warnings, missingFiles, copies: { serveur,
  inconnues } }` (manifeste : `files[]` à `bytes_sha256?`, `bytes_size?`, `bytes_mime?`, `remote?` ; `missing_files[]` = `{ sha256, mime,
  size, remote? }`, toujours écrit, hors `counts`) ; `inspectArchive(buffer)` → `payload.missing`, `summary.files_distants`,
  `summary.files_copies` ; `octetsRestaures(entry, ligne) → { garder, blob, attendu: { sha256, size } }` ; `applyArchive(db, inspection, {
  mode, horodater })` → décomptes par magasin **+ `originauxConserves`** ; `verifyRestored(db, inspection, { mode, horodate })` →
  `{ ok, diffs }` (nouveau motif : `Copie serveur différente : <sha256>`).
- Produces (`settings.js`) : `messagesArchive({ missingFiles, copies }) → string[]` ; `phrasesInspection(summary) → { puces: string[],
  phrases: string[] }` ; `messageOriginauxConserves(n) → string | null` ; `renderSettings` gagne deux injections, `pickFiles` (le choix de l'archive à
  restaurer) et `telechargerArchive` (l'enregistrement de l'archive créée) : le rapport d'inspection réel s'éprouve, et le bilan sans téléchargement
  dans le Chrome sans tête.

- [ ] **Step 1 : tests rouges** (à la fin du corps de `runSyncL4Tests` ; **ajouter** en tête du fichier, sous les imports de la tâche 1 — qui
  restent tous, `withRepo` compris —, la ligne `import { withDatabase, rewriteArchive } from './backup.js';`) :

```js
  // === Tâche 2 — archive (D-G3, D-G7, S-1, R-G-6, N-1)
  const B = await import('../src/domain/backup.js');
  const ouvrir = async (archive) => B.inspectArchive(await archive.blob.arrayBuffer());
  const pageVers = (sha256) => ({ source_documents: [{ id: 'd1', sha256, updated_at: DATE }], source_pages: [{ id: 'pg1', document_id: 'd1', sha256, updated_at: DATE }] });

  await run('archive : pages manquantes et copie réduite (a)', async () => {
    const orig = await original('original-archive-a');
    const copieOctets = octets('copie-reduite-a');
    const shaCopie = await sha256Hex(copieOctets);
    const remoteManquante = R({ sha256: H('d'), size: 5 });
    const remoteCopie = R({ sha256: shaCopie, size: copieOctets.size });
    const lignes = [
      { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: remoteManquante },             // sans blob, à remote
      { sha256: H('2'), mime: 'image/png', size: 11, updated_at: DATE },                                         // sans blob, sans remote
      orig,                                                                                                      // l'original
      { sha256: H('4'), mime: 'image/heic', size: 99999, blob: copieOctets, updated_at: DATE, remote: remoteCopie }, // copie réduite reçue
    ];
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: lignes, ...pageVers(H('1')) }); archive = await B.createArchive(db); });
    const m = archive.manifest;
    const copie = m.files.find((f) => f.sha256 === H('4'));
    eq([m.missing_files.map((x) => x.sha256).sort(), m.files.length, archive.missingFiles, archive.copies, m.counts.files, 'missing_files' in m.counts, m.missing_files.find((x) => x.sha256 === H('1'))?.remote],
      [[H('1'), H('2')], 2, 2, { serveur: 1, inconnues: 0 }, 2, false, remoteManquante], 'createArchive (D-G7, S-1) : deux lignes sans blob dans missing_files (remote gardé s’il est valide), deux fichiers, copies { serveur: 1 }, missing_files hors counts');
    eq([copie?.path, copie?.bytes_sha256, copie?.bytes_size, copie?.bytes_mime, copie?.size, copie?.mime, copie?.remote, 'bytes_sha256' in m.files.find((f) => f.sha256 === orig.sha256)],
      ['files/' + H('4') + '.jpg', shaCopie, copieOctets.size, 'image/jpeg', 99999, 'image/heic', remoteCopie, false], 'createArchive : la copie porte bytes_* (ce qui est dans le ZIP) et la ligne (clé, taille et type de l’original) ; chemin selon bytes_mime ; l’original n’a pas de bytes_*');
    const insp = await ouvrir(archive);
    eq([insp.ok, insp.summary.files_distants, insp.summary.files_copies, insp.errors], [true, 2, 1, []], 'inspectArchive : acceptée, files_distants 2, files_copies 1, relation source_pages → missing tenue (mutant : bytes_sha256 ignoré → « endommagé »)');
    for (const mode of ['merge', 'replace']) {
      await withDatabase(async (db) => {
        await B.applyArchive(db, insp, { mode });
        const parSha = new Map((await db.getAll('files')).map((r) => [r.sha256, r]));
        const v = await B.verifyRestored(db, insp, { mode });
        eq([parSha.size, [...parSha.values()].filter((r) => r.blob instanceof Blob).length, await sha256Hex(parSha.get(H('4')).blob), parSha.get(H('4')).remote, parSha.get(H('1')).remote, parSha.get(H('2')).remote, v.ok, v.diffs],
          [4, 2, shaCopie, remoteCopie, remoteManquante, null, true, []], `applyArchive (${mode}) : 4 lignes dont 2 sans blob, la copie sous sa clé avec son remote ; verifyRestored vert (mutants : comparableFiles compte les lignes sans blob ; requireInspection compare size à bytes.length → « Archive non validée »)`);
      });
    }
  });

  await run('archive : copie sans remote, copie périmée (b, b2)', async () => {
    const copie = octets('copie-sans-remote');
    let archive = null;
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ sha256: H('5'), mime: 'image/jpeg', size: 5000, blob: copie, updated_at: DATE }, { sha256: H('6'), mime: 'image/jpeg', size: 6000, blob: octets('copie-perimee'), updated_at: DATE, remote: R({ size: 77 }) }] });
      archive = await B.createArchive(db);
    });
    const e5 = archive.manifest.files.find((f) => f.sha256 === H('5'));
    eq([archive.copies, 'remote' in e5, e5.bytes_sha256 === await sha256Hex(copie)], [{ serveur: 0, inconnues: 2 }, false, true], 'createArchive : une copie SANS remote et une copie périmée (bytes_sha256 ≠ remote.sha256) réussissent, archivées telles quelles, comptées « inconnues » (mutant : levée « Fichier source endommagé » réintroduite)');
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => { await B.applyArchive(db, insp, { mode: 'merge' }); eq([insp.ok, (await B.verifyRestored(db, insp, { mode: 'merge' })).ok], [true, true], 'archive (b) : inspectée et restaurée'); });
  });

  await run('archive fabriquée : formes refusées, relation vers une page manquante (c)', async () => {
    const copie = octets('copie-c'); const shaCopie = await sha256Hex(copie);
    let archive = null;
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ sha256: H('4'), mime: 'image/jpeg', size: 900, blob: copie, updated_at: DATE, remote: R({ sha256: shaCopie, size: copie.size }) }, { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: R({ sha256: H('d'), size: 5 }) }], ...pageVers(H('1')) });
      archive = await B.createArchive(db);
    });
    const fabriquer = async (edit) => B.inspectArchive(await rewriteArchive(archive.blob, edit));
    const seul = await fabriquer(({ manifest }) => { delete manifest.files[0].bytes_sha256; delete manifest.files[0].bytes_mime; });
    const repete = await fabriquer(({ manifest }) => { manifest.missing_files.push({ sha256: H('4'), mime: 'image/jpeg', size: 900 }); });
    const remoteFaux = await fabriquer(({ manifest }) => { manifest.missing_files[0].remote = { sha256: 'court' }; });
    eq([seul.ok, seul.errors.includes('Description de fichier invalide'), repete.ok, repete.errors.some((e) => e.startsWith('Empreinte de fichier répétée')), remoteFaux.ok, remoteFaux.errors.includes('Description de fichier invalide')],
      [false, true, false, true, false, true], 'inspectArchive : bytes_size seul → « Description de fichier invalide » ; même empreinte dans files et missing_files → refusée ; un remote invalide dans missing_files → refusé');
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp, { mode: 'merge' });
      eq([insp.ok, (await db.get('source_pages', 'pg1'))?.sha256, (await db.get('files', H('1')))?.remote], [true, H('1'), R({ sha256: H('d'), size: 5 })], 'B-6 : une source_page qui pointe une entrée de missing_files est inspectée ET appliquée (mutant : requireInspection sans missing → « introuvable »)');
    });
  });

  await run('archive figée d’avant le lot (d)', async () => {
    const zip = await (await fetch(new URL('./fixtures/archive-0.8.1-sans-imports.zip', import.meta.url), { cache: 'no-store' })).arrayBuffer();
    const insp = await B.inspectArchive(zip);
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp, { mode: 'merge' });
      eq([insp.ok, insp.summary.files_distants, insp.summary.files_copies, (await B.verifyRestored(db, insp, { mode: 'merge' })).ok], [true, 0, 0, true], 'archive figée (sans missing_files ni bytes_*) : inspectée et restaurée, rien de manquant (mutant : missing_files exigé)');
    });
  });

  await run('restauration en fusion : blob et remote locaux (e, e2, e3)', async () => {
    const orig = await original('original-e2');
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [orig, { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE }] }); archive = await B.createArchive(db); }); // faite AVANT l'envoi : aucun remote
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => {
      const blobLocal = octets('octets-locaux-de-la-page');
      const remoteO = R({ sha256: orig.sha256, size: orig.size });
      await db.putBatch({ files: [{ ...orig, remote: remoteO }, { sha256: H('1'), mime: 'image/jpeg', size: 10, blob: blobLocal, updated_at: DATE, remote: R({ sha256: H('d'), size: 5 }) }] });
      await B.applyArchive(db, insp, { mode: 'merge' });
      const o = await db.get('files', orig.sha256);
      const p = await db.get('files', H('1'));
      eq([o.remote, p.remote, await sha256Hex(p.blob), (await B.verifyRestored(db, insp, { mode: 'merge' })).ok], [remoteO, R({ sha256: H('d'), size: 5 }), await sha256Hex(blobLocal), true], 'fusion (e, e2, e3 ; N-1) : une ligne de missing_files garde le blob local ; une entrée sans remote laisse le remote local, et verifyRestored est vert (mutant : remote comparé sans condition → « contenu différent »)');
    });
    let archive2 = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ ...orig, remote: R({ sha256: orig.sha256, size: orig.size }) }] }); archive2 = await B.createArchive(db); });
    const insp2 = await ouvrir(archive2);
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp2, { mode: 'merge' });
      const ecrite = await db.get('files', orig.sha256);
      await db.putBatch({ files: [{ ...ecrite, remote: R({ sha256: H('c') }) }] }); // écart posé APRÈS la restauration
      const v = await B.verifyRestored(db, insp2, { mode: 'merge' });
      eq([v.ok, v.diffs.some((d) => d.startsWith('Copie serveur différente'))], [false, true], 'verifyRestored : là où l’entrée porte un remote, un écart est dit (le contrôle tient là où l’archive affirme quelque chose)');
    });
  });

  // R-G-6 : une archive dont l'entrée est une COPIE (bytes_*) ne remplace jamais l'original local, ni en fusion ni en remplacement.
  const archiveDeCopie = async (shaO, tailleO, copie, remote) => {
    let a = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ sha256: shaO, mime: 'image/jpeg', size: tailleO, blob: copie, updated_at: DATE, remote }] }); a = await B.createArchive(db); });
    return a;
  };
  for (const mode of ['merge', 'replace']) {
    await run(`restauration (${mode}) : l’original local survit à une copie d’archive (e4, e5)`, async () => {
      const orig = await original('original-e4-de-cette-page');
      const copie = octets('copie-e4'); const shaC = await sha256Hex(copie);
      const R1 = R({ sha256: H('d'), size: 7 }); const R2 = R({ sha256: shaC, size: copie.size });
      const insp = await ouvrir(await archiveDeCopie(orig.sha256, orig.size, copie, R2));
      await withDatabase(async (db) => {
        await db.putBatch({ files: [{ ...orig, remote: R1 }] });
        const bilan = await B.applyArchive(db, insp, { mode });
        const row = await db.get('files', orig.sha256);
        const v = await B.verifyRestored(db, insp, { mode });
        eq([await sha256Hex(row.blob), row.blob.size, row.remote, row.mime, row.size, bilan.originauxConserves, F.estOriginalIci(row), v.ok, v.diffs],
          [orig.sha256, orig.size, R2, 'image/jpeg', orig.size, 1, true, true, []], `R-G-6 (${mode}) : blob INCHANGÉ (l’original), remote et métadonnées pris de l’archive, originauxConserves 1, verifyRestored vert (mutants : « blob tel quel » ; comparaison brute bytes_sha256 ?? sha256 dans verifyRestored ; existingFiles vide en remplacement)`);
      });
    });
  }

  await run('restauration : une copie locale cède à l’original de l’archive (e6)', async () => {
    const orig = await original('original-e6-de-cette-page');
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [orig] }); archive = await B.createArchive(db); });
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ ...orig, blob: octets('copie-locale-e6'), remote: R({ sha256: H('d'), size: 15 }) }] });
      const bilan = await B.applyArchive(db, insp, { mode: 'merge' });
      const row = await db.get('files', orig.sha256);
      eq([await sha256Hex(row.blob), row.blob.size, bilan.originauxConserves, (await B.verifyRestored(db, insp, { mode: 'merge' })).ok], [orig.sha256, orig.size, 0, true], 'R-G-6 symétrique : la copie locale est remplacée par l’original que l’archive porte');
    });
    await withDatabase(async (db) => {
      await db.putBatch({ files: [orig] });
      eq((await B.applyArchive(db, insp, { mode: 'merge' })).originauxConserves, 0, 'R-G-6 : original ici + original dans l’archive → rien de « conservé » (mutant : garder sans !entreeOriginale → 1)');
    });
  });

  await run('bilans d’archive : textes, renvoi, README, inspection (e7, f, f2, g, h)', async () => {
    const S = await import('../src/ui/settings.js');
    eq([0, 1, 3].map((n) => S.messageOriginauxConserves(n)), [null, '1 original de cet appareil conservé (l’archive portait une copie).', '3 originaux de cet appareil conservés (l’archive portait des copies).'], 'messageOriginauxConserves (e7) : rien à 0, singulier à 1, pluriel (le câblage dans appliquerArchive reste à la revue : confirmDialog y est importé, pas injecté)');
    eq([S.messagesArchive({ missingFiles: 1, copies: { serveur: 0, inconnues: 0 } }), S.messagesArchive({ missingFiles: 0, copies: { serveur: 0, inconnues: 0 } })],
      [['1 page n’est pas encore téléchargée sur cet appareil et n’est pas dans l’archive.'], []], 'messagesArchive : le singulier à 1 page ; rien à dire, rien de dit');
    eq(S.phrasesInspection({ files_distants: 3, files_copies: 2 }), { puces: ['pages manquantes : 3', 'copies du serveur : 2'], phrases: ['Cette archive renvoie à 3 pages qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les pages).'] }, 'phrasesInspection (§ 4.6, B-8) : puces et phrase d’inspection ; rien n’est promis comme « se téléchargera »');
    eq(S.phrasesInspection({ files_distants: 0, files_copies: 0 }), { puces: [], phrases: [] }, 'phrasesInspection : une archive complète ne dit rien de plus');
    eq(B.compterFichesSynchronisees({ payload: { stores: { books: [{ id: 'a' }] }, files: [{ sha256: H('1') }], missing: [{ sha256: H('2') }, { sha256: H('3') }] } }), 4, 'compterFichesSynchronisees (B-25, g) : files + missing (mutant : missing oublié)');
    let archive = null;
    await withDatabase(async (db) => { archive = await B.createArchive(db); });
    const { readZip, textOf } = await import('../src/core/zip.js');
    ok(textOf(readZip(await archive.blob.arrayBuffer()).get('README.txt')).includes('Le manifeste peut porter l\'identifiant technique du compte qui a envoyé un fichier (un uuid, pas un secret).'), 'README_TXT (S-9, h) : l’identifiant du compte est dit');
    const S0 = await import('../src/ui/state.js');
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    try {
      await withRepo(async (repo) => {
        const faux = async () => ({ blob: new Blob(['zip'], { type: 'application/zip' }), manifest: { created_at: DATE, counts: {}, files: [] }, bytes: 3, filesBytes: 0, warnings: [], missingFiles: 2, copies: { serveur: 1, inconnues: 1 } });
        const enregistres = [];
        const page = await S.renderSettings({}, {}, { settings: await repo.getSettings(), sync: {} }, { createArchive: faux, telechargerArchive: (blob, nom) => enregistres.push(nom) });
        scene.append(page);
        [...page.querySelectorAll('button')].find((b) => b.textContent === 'Sauvegarder toute ma bibliothèque').click();
        let bilan = null;
        for (let i = 0; i < 300 && !(bilan = page.querySelector('[data-role="bilan-archive"]')); i += 1) await new Promise((r) => setTimeout(r, 10));
        eq([...(bilan?.querySelectorAll('p') || [])].map((p) => p.textContent), ['2 pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive.', '1 fichier(s) archivé(s) sont des copies du serveur, pas l’original.', '1 fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du serveur connue : archivés tels quels.'],
          'Réglages (f, F-15) : avec createArchive injecté, le bilan de création dit les pages manquantes, les copies du serveur et les octets inconnus — une phrase chacun');
        eq(enregistres.length, 1, 'Réglages (f) : l’archive passe par telechargerArchive injecté — aucun téléchargement réel dans le Chrome sans tête (doute 12 de la rév. 1, tranché)');
        // (f2) Le VRAI rapport d'inspection (restoreReport n'est pas exporté) : pickFiles injecté rend une archive à pages manquantes et à copie.
        let archiveF2 = null;
        await withDatabase(async (db2) => {
          const copieF2 = octets('copie-f2'); const shaF2 = await sha256Hex(copieF2);
          await db2.putBatch({ files: [{ sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: R({ sha256: H('d'), size: 5 }) }, { sha256: H('2'), mime: 'image/png', size: 11, updated_at: DATE }, { sha256: H('4'), mime: 'image/heic', size: 99999, blob: copieF2, updated_at: DATE, remote: R({ sha256: shaF2, size: copieF2.size }) }], ...pageVers(H('1')) });
          archiveF2 = await B.createArchive(db2);
        });
        const zipF2 = new File([await archiveF2.blob.arrayBuffer()], 'f2.zip', { type: 'application/zip' });
        const page2 = await S.renderSettings({}, {}, { settings: await repo.getSettings(), sync: {} }, { pickFiles: async () => [zipF2] });
        scene.append(page2);
        [...page2.querySelectorAll('button')].find((b) => b.textContent === 'Restaurer une sauvegarde…').click();
        let puces = null;
        for (let i = 0; i < 300 && !(puces = [...page2.querySelectorAll('.chips')].find((c) => c.textContent.includes('fichiers vérifiés'))); i += 1) await new Promise((r) => setTimeout(r, 10));
        const textesPuces = [...(puces?.querySelectorAll('.chip') || [])].map((c) => c.textContent);
        eq([textesPuces.includes('pages manquantes : 2'), textesPuces.includes('copies du serveur : 1'), page2.textContent.includes('Cette archive renvoie à 2 pages qui ne sont pas dedans'), page2.textContent.includes('Les pages de cet appareil absentes de l’archive seront retirées d’ici.')], [true, true, true, true],
          'Réglages (f2) : le vrai rapport d’inspection (pickFiles injecté) porte les puces « pages manquantes : 2 » et « copies du serveur : 1 », la phrase de § 4.6 et, le remplacement offert (base non vide), la phrase de B-28 (mutants : puces non rendues ; phrase de remplacement retirée)');
        await S0.relectureEnCours(); // le clic a écrit last_backup : la relecture différée par le bus finit AVANT la fermeture de la base jetable (R-L3-17)
      });
    } finally { scene.remove(); try { sessionStorage.removeItem('cuisineos.archive_created'); } catch { /* stockage indisponible */ } await S0.relireReglages(); }
  });
```

- [ ] **Step 2 : rouge lu** (suite : les blocs « archive … » rouges ; `B.octetsRestaures` absente). **Mesuré au rejeu** : 4058/4069, onze rouges —
  dix du lot G (archive (a), (b), (c), figée, `verifyRestored`, (e4) en fusion et en remplacement, (e6) deux fois, bilans) et l'épingle ; aucune
  assertion existante.

- [ ] **Step 3 : implémenter `src/domain/backup.js`.** Imports : `import { remoteValide } from '../sync/tables.js';` et `import { estOriginalIci }
  from '../sync/fichiers.js';`. `README_TXT` gagne, avant la ligne « Aucun secret… », cette ligne (S-9) :

```text
Le manifeste peut porter l'identifiant technique du compte qui a envoyé un fichier (un uuid, pas un secret).
```

  Dans `createArchive`, la boucle des fichiers devient :

```js
  let bytesTotal = 0;
  const manquantes = [];
  const copies = { serveur: 0, inconnues: 0 };
  for (const file of snapshot.files) {
    if (!HASH.test(file.sha256)) throw new Error('Fichier source invalide : ' + file.sha256);
    const remote = remoteValide(file.remote) ? file.remote : undefined;
    const mime = validKey(file.mime) ? file.mime : (validKey(file.blob?.type) ? file.blob.type : 'application/octet-stream');
    if (!(file.blob instanceof Blob)) {
      // D-G7 (R18) : une ligne sans octets ici entre dans missing_files, QUELLE QUE SOIT la valeur de remote (D-G12).
      manquantes.push({ sha256: file.sha256, mime, size: validCount(file.size) ? file.size : 0, ...(remote ? { remote } : {}) });
      continue;
    }
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const h = await sha256Hex(data);
    const entree = { sha256: file.sha256, size: h === file.sha256 ? data.length : (validCount(file.size) ? file.size : data.length), mime };
    if (h !== file.sha256) {
      // S-1 : des octets qui ne sont pas l'original sont décrits par bytes_*, quel que soit remote — jamais une levée (« Fichier source endommagé »
      // reste à l'inspection, pour un ZIP abîmé). Copie du serveur connue, ou autre chose (octets abîmés, copie périmée) : archivée telle quelle.
      Object.assign(entree, { bytes_sha256: h, bytes_size: data.length, bytes_mime: validKey(file.blob.type) ? file.blob.type : mime });
      if (remote && remote.sha256 === h) copies.serveur += 1; else copies.inconnues += 1;
    }
    if (remote) entree.remote = remote;
    const path = 'files/' + file.sha256 + '.' + extFor(entree.bytes_mime ?? mime);
    entries.push({ path, data });
    files.push({ path, ...entree });
    bytesTotal += data.length;
  }
  counts.files = files.length; // missing_files n'entre PAS dans counts : un client plus ancien refuse tout décompte de magasin inconnu
```

  le manifeste porte `files, missing_files: manquantes`, et le retour `{ blob, manifest, bytes: zip.length, filesBytes: bytesTotal, warnings,
  missingFiles: manquantes.length, copies }`.

  `inspectArchive` : `payload = { stores: Object.create(null), files: [], missing: [] }` ; la boucle des fichiers devient :

```js
    const bytesValides = (f) => {
      const n = ['bytes_sha256', 'bytes_size', 'bytes_mime'].filter((k) => own(f, k)).length;
      return n === 0 || (n === 3 && HASH.test(f.bytes_sha256) && validCount(f.bytes_size) && validKey(f.bytes_mime));
    };
    for (const f of manifest.files) {
      if (!record(f) || !HASH.test(f.sha256) || !validCount(f.size) || !validKey(f.mime) || !bytesValides(f) || (own(f, 'remote') && !remoteValide(f.remote))) { errors.push('Description de fichier invalide'); continue; }
      if (hashes.has(f.sha256)) { errors.push('Empreinte de fichier répétée : ' + f.sha256); continue; }
      hashes.add(f.sha256);
      const copie = own(f, 'bytes_sha256');
      if (f.path !== 'files/' + f.sha256 + '.' + extFor(copie ? f.bytes_mime : f.mime) || paths.has(f.path)) { errors.push('Chemin de fichier invalide : ' + f.path); continue; }
      paths.add(f.path);
      const fileEntry = zip.get(f.path);
      if (!fileEntry) { missing++; errors.push('Fichier source manquant : ' + f.path); continue; }
      if (!fileEntry.crcOk || await sha256Hex(fileEntry.data) !== (copie ? f.bytes_sha256 : f.sha256)) { hashMismatch++; errors.push('Fichier source endommagé : ' + f.path); continue; }
      if (fileEntry.data.length !== (copie ? f.bytes_size : f.size)) { errors.push('Taille différente : ' + f.path); continue; }
      payload.files.push({ sha256: f.sha256, bytes: fileEntry.data, mime: f.mime, size: f.size,
        ...(copie ? { bytes_sha256: f.bytes_sha256, bytes_size: f.bytes_size, bytes_mime: f.bytes_mime } : {}), ...(own(f, 'remote') ? { remote: f.remote } : {}) });
    }
    const listeManquantes = own(manifest, 'missing_files') ? manifest.missing_files : []; // archive d'avant le lot : absente = []
    if (!Array.isArray(listeManquantes)) errors.push('Description de fichier invalide');
    else for (const mf of listeManquantes) {
      if (!record(mf) || !HASH.test(mf.sha256) || !validKey(mf.mime) || !validCount(mf.size) || (own(mf, 'remote') && !remoteValide(mf.remote))) { errors.push('Description de fichier invalide'); continue; }
      if (hashes.has(mf.sha256)) { errors.push('Empreinte de fichier répétée : ' + mf.sha256); continue; }
      hashes.add(mf.sha256);
      payload.missing.push({ sha256: mf.sha256, mime: mf.mime, size: mf.size, ...(own(mf, 'remote') ? { remote: mf.remote } : {}) });
    }
```

  `checkRelations(payload.stores, new Set([...payload.files.map((f) => f.sha256), ...payload.missing.map((m) => m.sha256)]))` ; `summary` gagne
  `files_distants: payload.missing.length, files_copies: payload.files.filter((f) => own(f, 'bytes_sha256')).length`.

  `requireInspection` :

```js
  const hashes = new Set();
  for (const file of inspection.payload.files) {
    if (!record(file)) { errors.push('Fichier de restauration invalide'); continue; }
    const attendu = own(file, 'bytes_sha256') ? file.bytes_sha256 : file.sha256;
    const taille = own(file, 'bytes_size') ? file.bytes_size : file.size; // F-8 : (bytes_size ?? size) === bytes.length
    if (!HASH.test(file.sha256) || !HASH.test(attendu) || hashes.has(file.sha256) || !(file.bytes instanceof Uint8Array) || taille !== file.bytes.length || !validKey(file.mime)) errors.push('Fichier de restauration invalide');
    else hashes.add(file.sha256);
  }
  for (const mf of Array.isArray(inspection.payload.missing) ? inspection.payload.missing : []) {
    if (!record(mf) || !HASH.test(mf.sha256) || !validKey(mf.mime) || !validCount(mf.size) || (own(mf, 'remote') && !remoteValide(mf.remote)) || hashes.has(mf.sha256)) errors.push('Fichier de restauration invalide');
    else hashes.add(mf.sha256);
  }
  errors.push(...checkRelations(inspection.payload.stores, hashes)); // B-6 : files ∪ missing
```

  `compterFichesSynchronisees` : `if (name === 'files') total += (inspection.payload.files?.length || 0) + (inspection.payload.missing?.length || 0);`.

  `octetsRestaures` (exportée, avant `applyArchive`) et `applyArchive` :

```js
// R-G-6 (C-1) : ce que la restauration écrit pour une entrée `files`, NOMMÉ UNE FOIS et relu par applyArchive ET verifyRestored (le gabarit de
// ficheRestauree, R61 : le bilan compare la base à ce que la restauration a PROMIS). Un blob local ORIGINAL n'est jamais remplacé par une copie
// venue d'une archive, ni en fusion ni en remplacement ; une copie locale cède à ce que l'archive porte (l'original, ou une autre copie).
export function octetsRestaures(entry, ligne) {
  const entreeOriginale = (entry.bytes_sha256 ?? entry.sha256) === entry.sha256;
  const originalIci = ligne?.blob instanceof Blob && estOriginalIci(ligne);
  if (originalIci && !entreeOriginale) return { garder: true, blob: ligne.blob, attendu: { sha256: entry.sha256, size: entry.size } };
  return { garder: false, blob: new Blob([entry.bytes], { type: entry.bytes_mime ?? entry.mime }), attendu: { sha256: entry.bytes_sha256 ?? entry.sha256, size: entry.bytes_size ?? entry.size } };
}

export async function applyArchive(db, inspection, { mode = 'merge', horodater = null } = {}) {
  requireInspection(inspection, mode);
  const batch = structuredClone(restoredStores(inspection));
  // R-G-6 : la ligne locale est lue DANS LES DEUX MODES — sans elle, un original ne peut ni être reconnu ni survivre à clearStores (il ne survit
  // que porté dans le batch). En remplacement, elle ne sert QU'À octetsRestaures : ni ...existing, ni son remote, ni son created_at.
  const existingFiles = new Map((await db.getSnapshot(['files'])).files.map((row) => [row.sha256, row]));
  const fusion = mode === 'merge';
  const maintenant = new Date().toISOString();
  let originauxConserves = 0;
  batch.files = [];
  for (const file of inspection.payload.files) {
    const existing = existingFiles.get(file.sha256);
    const o = octetsRestaures(file, existing);
    if (!o.garder && await sha256Hex(o.blob) !== o.attendu.sha256) throw new Error('Fichier modifié depuis la validation : ' + file.sha256);
    if (o.garder) originauxConserves += 1;
    batch.files.push({ ...(fusion ? existing : {}), sha256: file.sha256, blob: o.blob, mime: file.mime, size: file.size,
      remote: file.remote ?? (fusion ? existing?.remote ?? null : null), created_at: (fusion ? existing?.created_at : null) || maintenant });
  }
  for (const mf of inspection.payload.missing || []) {
    const existing = existingFiles.get(mf.sha256);
    // D-G7 : restaurée SANS blob ; en fusion, un blob local déjà là est gardé (porté par ...existing).
    batch.files.push({ ...(fusion ? existing : {}), sha256: mf.sha256, mime: mf.mime, size: mf.size,
      remote: mf.remote ?? (fusion ? existing?.remote ?? null : null), created_at: (fusion ? existing?.created_at : null) || maintenant });
  }
  normaliserFiches(batch, { horodater });
  await db.putBatch(batch, { clearStores: mode === 'replace' ? Object.keys(STORES).filter((s) => !SYNC_INTERNAL_STORES.includes(s) && s !== 'assistant_config') : [] });
  return { ...Object.fromEntries(Object.entries(batch).map(([name, rows]) => [name, rows.length])), originauxConserves };
}
```

  `verifyRestored`, fin de fonction (la partie des magasins de données inchangée) :

```js
  const filesBySha = new Map(snapshot.files.map((row) => [row.sha256, row]));
  // Une ligne sans octets (missing_files, ou reçue sans être téléchargée) n'entre pas dans le décompte (spec § 3.4).
  const comparableFiles = snapshot.files.filter((row) => row.blob instanceof Blob);
  if (mode === 'replace' && comparableFiles.length !== inspection.payload.files.length) diffs.push('files : décompte différent après restauration');
  // N-1 : un remote n'est comparé que si l'entrée en porte un (en fusion, une entrée sans remote laisse celui de la ligne locale).
  const memeRemote = (row, entree) => !own(entree, 'remote') || canonical(row.remote ?? null) === canonical(entree.remote);
  for (const file of inspection.payload.files) {
    const row = filesBySha.get(file.sha256);
    if (!row) { diffs.push('Fichier absent : ' + file.sha256); continue; }
    if (!(row.blob instanceof Blob)) { diffs.push('Fichier illisible : ' + file.sha256); continue; }
    const { attendu } = octetsRestaures(file, row); // R-G-6 : la même décision qu'à l'application, jamais bytes_sha256 ?? sha256 en brut
    if (row.size !== file.size || row.mime !== file.mime || row.blob.size !== attendu.size) diffs.push('Métadonnées de fichier différentes : ' + file.sha256);
    if (await sha256Hex(row.blob) !== attendu.sha256) diffs.push('Empreinte différente : ' + file.sha256);
    if (!memeRemote(row, file)) diffs.push('Copie serveur différente : ' + file.sha256);
  }
  for (const mf of inspection.payload.missing || []) {
    const row = filesBySha.get(mf.sha256);
    if (!row) { diffs.push('Fichier absent : ' + mf.sha256); continue; }
    if (!memeRemote(row, mf)) diffs.push('Copie serveur différente : ' + mf.sha256);
  }
  diffs.push(...checkRelations(currentStores, new Set(filesBySha.keys())));
  return { ok: diffs.length === 0, diffs };
```

- [ ] **Step 4 : implémenter `src/ui/settings.js`.** Import : `import { createArchive as createArchiveReel, inspectArchive, applyArchive, verifyRestored,
  compterFichesSynchronisees } from '../domain/backup.js';` ; signature `export async function renderSettings(params, query, ctx, { fetch, createArchive =
  createArchiveReel, pickFiles: choisirArchive = pickFiles, telechargerArchive = downloadBlob } = {})` — le bouton « Restaurer une sauvegarde… »
  appelle `choisirArchive({ accept: '.zip,application/zip', multiple: false })` à la place de `pickFiles(…)`, le bouton de sauvegarde
  `telechargerArchive(blob, …)` à la place de `downloadBlob(blob, …)` (les exports de recettes gardent `downloadBlob`). Fonctions pures exportées (à
  côté de `messageRenvoi`) :

```js
// Bilan de création (§ 4.6) : une phrase par cas, jamais un pluriel calculé sur une chaîne traduite. Rien à dire → rien de dit.
export function messagesArchive({ missingFiles = 0, copies = { serveur: 0, inconnues: 0 } } = {}) {
  const sortie = [];
  if (missingFiles === 1) sortie.push(t('1 page n’est pas encore téléchargée sur cet appareil et n’est pas dans l’archive.'));
  else if (missingFiles > 1) sortie.push(t('{n} pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive.', { n: missingFiles }));
  if (copies?.serveur > 0) sortie.push(t('{n} fichier(s) archivé(s) sont des copies du serveur, pas l’original.', { n: copies.serveur }));
  if (copies?.inconnues > 0) sortie.push(t('{n} fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du serveur connue : archivés tels quels.', { n: copies.inconnues }));
  return sortie;
}

// Inspection (§ 4.6, B-8) : rien n'est promis comme « se téléchargera » — une entrée sans remote ne viendra de nulle part (I5).
export function phrasesInspection(summary = {}) {
  const puces = []; const phrases = [];
  if (summary.files_distants > 0) {
    puces.push(t('pages manquantes : {n}', { n: summary.files_distants }));
    phrases.push(t('Cette archive renvoie à {n} pages qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les pages).', { n: summary.files_distants }));
  }
  if (summary.files_copies > 0) puces.push(t('copies du serveur : {n}', { n: summary.files_copies }));
  return { puces, phrases };
}

// R-G-6 : le bilan de restauration dit les originaux gardés (l'archive portait des copies). Singulier sur le gabarit de messageRenvoi.
export const messageOriginauxConserves = (n) => {
  if (!(n > 0)) return null;
  return n === 1 ? t('1 original de cet appareil conservé (l’archive portait une copie).') : t('{n} originaux de cet appareil conservés (l’archive portait des copies).', { n });
};
```

  Câblage, trois endroits de `renderSettings` :

```js
// 1. Bouton « Sauvegarder toute ma bibliothèque » : la déstructuration, puis, APRÈS le toast existant, le bilan (une phrase par cas).
        const { blob, manifest, bytes, warnings, missingFiles = 0, copies } = await createArchive(repo.db, { deviceName: s.device_name });
        // … (inchangé jusqu'au toast « Archive générée … »)
        backupStatus.querySelector('[data-role="bilan-archive"]')?.remove();
        const bilanArchive = messagesArchive({ missingFiles, copies });
        if (bilanArchive.length) backupStatus.append(el('div', { class: 'status warn', dataset: { role: 'bilan-archive' } }, ...bilanArchive.map((p) => el('p', null, p))));
// 2. restoreReport : les puces s'ajoutent au même div.chips, les phrases dessous ; la phrase du remplacement à côté de horsArchive (B-28).
    const ins = phrasesInspection(insp.summary || {});
    //   dans le div.chips existant, après « fichiers vérifiés » : ...ins.puces.map((p) => el('span', { class: 'chip neutral' }, p))
    for (const phrase of ins.phrases) box.append(el('div', { class: 'status info' }, phrase));
    //   à côté de horsArchive, quand le remplacement est offert (!empty) :
    if (!empty) box.append(el('small', { class: 'muted' }, t('Les pages de cet appareil absentes de l’archive seront retirées d’ici.')));
// 3. appliquerArchive : le bilan de applyArchive est gardé, et dit APRÈS le statut de verifyRestored (R-G-6).
        const bilanRestauration = await applyArchive(repo.db, insp, { mode, horodater: reHorodatage ? syncNow : null });
        // … (inchangé jusqu'au statut de verifyRestored)
        const conserves = messageOriginauxConserves(bilanRestauration?.originauxConserves);
        if (conserves) result.append(el('p', { class: 'muted' }, conserves));
```

- [ ] **Step 5 : `en.js`** (avant `};`, sous le commentaire `// Lot G : archive (§ 4.6).`), les dix entrées, mot pour mot :

```js
  "{n} pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive.": "{n} pages are not downloaded on this device yet and are not in the archive.",
  "1 page n’est pas encore téléchargée sur cet appareil et n’est pas dans l’archive.": "1 page is not downloaded on this device yet and is not in the archive.",
  "{n} fichier(s) archivé(s) sont des copies du serveur, pas l’original.": "{n} archived file(s) are server copies, not the original.",
  "{n} fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du serveur connue : archivés tels quels.": "{n} archived file(s) have bytes that are neither the original nor the known server copy: archived as is.",
  "pages manquantes : {n}": "missing pages: {n}",
  "copies du serveur : {n}": "server copies: {n}",
  "Cette archive renvoie à {n} pages qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les pages).": "This archive refers to {n} pages that are not in it: those on the server can be downloaded (from the page, or Settings → Download all pages).",
  "Les pages de cet appareil absentes de l’archive seront retirées d’ici.": "Pages on this device that are not in the archive will be removed from here.",
  "{n} originaux de cet appareil conservés (l’archive portait des copies).": "{n} originals of this device kept (the archive carried copies).",
  "1 original de cet appareil conservé (l’archive portait une copie).": "1 original of this device kept (the archive carried a copy).",
```

  `tests/ajouter.js` : `CHAINES_NEUVES_AILLEURS['../src/ui/settings.js']` = ces dix clés françaises (commentaire « Lot G, tâche 2 : bilans d'archive »).
  `sw.js` : `VERSION = 'cuisine-os-v0.11.0-2'`.
- [ ] **Step 6 : vert** (suite, épingle relevée, Node inchangé, `--check` 0) ; les tests d'archive existants (`tests/backup.js`, `tests/sync.js`
  « Une ligne files reçue sans octets n'empêche ni l'archive ni la vérification », `tests/import-cible.js`) restent verts sans retouche, comme
  le test « archive : une ligne sans octets ni remote ne fait plus lever » de la tâche 1 (la réécriture de `createArchive` garde sa règle).
  **Mesuré au rejeu** : seule l'épingle rouge (obtenu 4082), puis 4083/4083 (épingle 4082) ; Node 174 ; `--check` 0 ; `sw.js cuisine-os-v0.11.0-2`.
- [ ] **Step 7 : invisibles** (Python) sur les fichiers touchés.
- [ ] **Step 8 : commit** `Archive L4 : missing_files, copies decrites par bytes_*, original local jamais remplace, bilans dits (lot G, tache 2)`.

---

### Task 3 : Storage injecté et passe « fichiers » (spec § 4.7, § 4.8, § 4.9, § 6, D-G2, D-G4, D-G9, N-2, R-G-4)

**Files:**
- Modify: `src/sync/transport.js` (`createStockage(client)`, `dejaPresent(erreur)`, `introuvable(erreur)` ; aucun autre appel Storage)
- Modify: `src/sync/fichiers.js` (partie passe : `LIMITES_FICHIERS`, `MAGASINS_FICHIERS`, `lireErreursFichiers`, `compterFichiers`,
  `octetsAEnvoyer`, `createFichiers` → `envoyer`, `telecharger`, `telechargerTout`, `mesurerEspace`)
- Create: `tests/stockage-factice.js` (`creerStockageFactice`)
- Modify: `tests/sync-l4.js` (bloc tâche 3), `sw.js` (`VERSION -3`), `tests/tests.js` (total)

**Interfaces:**
- Consumes : tâche 1 (`candidatsEnvoi`, `referencesFichiers`, `remoteValide`, `remoteDeCeCompte`, `estOriginalIci`, `copiePerimee`,
  `peutEcrireRemote`, `peutEcrireOctets`, `fusionnerOctetsRecus`, `HASH_FICHIER`) ; `classerErreur` (transport.js) ; `reculMs` (push.js) ;
  `reduireImage`, `dimensionsImage`, `LIMITES_COUVERTURE` (core/image.js) ; `sha256Hex` ; `nettoyerChaines` ; `syncNow` ; `logError`.
- Produces (`transport.js`) : `createStockage(client) → { envoyer(chemin, blob, { upsert }) → { erreur }, recevoir(chemin) → { blob, erreur },
  lister(prefixe, { limit, offset, search }) → { objets, erreur } }`, chaque `erreur` = `{ type, status, statusCode, code, message }` ;
  `dejaPresent(e) → boolean` ; `introuvable(e) → boolean`.
- Produces (`fichiers.js`) : `LIMITES_FICHIERS = { parPasse: 20, dureeMs: 60000, octetsMax: 52428800, pixelsMax: LIMITES_COUVERTURE.pixels,
  reduite: { maxCote: 2000, qualite: 0.8, octetsTelQuel: 614400 } }` ; `MAGASINS_FICHIERS` (les sept magasins du snapshot) ;
  `lireErreursFichiers(db) → Map<sha256, { motif, sens, at }>` ; `compterFichiers(snapshot, { uid, erreurs }) → { aEnvoyer, aTelecharger,
  octetsATelecharger, enErreur, typeInconnu, copiesPerimees, copiesSansServeur, aRenvoyer }` (`aRenvoyer` : ajout au § 3.6, lu par Réglages
  § 4.1 item 5 — doute 8) ; `octetsAEnvoyer(row, { qualite, reduire, limites }) → { blob, mime, tropGrande, pixels }` ;
  `createFichiers({ db, stockage, getUserId, qualite, reduire = reduireImage, hacher = sha256Hex, maintenant = Date.now, limites =
  LIMITES_FICHIERS })` → `{ envoyer({ stop, surProgression, snapshot }) → { confirmes, erreurs, restants, attenteConnexion, pauseFichiers,
  erreur, recul, rien?, pause? }, telecharger(shas, { stop }) → { recus, erreurs, erreur, rien? }, telechargerTout({ stop, surProgression,
  snapshot }) → { recus, restants, erreur, rien? }, mesurerEspace() → { octets, objets, at, tronque } | { erreur } }`. `envoyer` et
  `telechargerTout` **remplacent dans le snapshot** les lignes qu'ils écrivent : le snapshot unique de la passe reste juste pour
  `compterFichiers` (S-12).
- Factice (`tests/stockage-factice.js`) : `creerStockageFactice({ objets = {} /* chemin → Blob */, limiteOctets, types, pannes = [] /* {
  methode, chemin?, erreur } */, forme409 = 'status' | 'statusCode', forme404 = 'status' | 'statusCode', avant = null /* (methode, chemin) =>
  Promise, appelé avant de répondre */ })` → `{ journal, octets(chemin), envoyer, recevoir, lister }`. `avant` est un ajout à la liste de § 7 : il
  porte les cas (j), (l), (l2) et « ligne modifiée pendant la descente ». Sous `forme409: 'statusCode'`, l'erreur n'a **pas** de `code` (`null`) :
  `statusCode` y est le seul signal, et la passe (b) tue le mutant « statusCode ignoré » de bout en bout (rév. 2 ; la description de § 7 est à
  amender en § 12 à la clôture).

- [ ] **Step 1 : créer `tests/stockage-factice.js`** :

```js
// Storage factice du lot G (spec § 7) : aucun réseau. Mémoire `objets[chemin] = Blob` ; il rend des erreurs DÉJÀ classées, de la forme de
// createStockage (src/sync/transport.js) — { type, status, statusCode, code, message } —, sous les deux formes vues chez le fournisseur pour
// un « déjà présent » (409, ou 400 + statusCode '409' SANS code : la forme que StorageApiError prend d'un corps sans `code`, vendor 2.117.3)
// et un introuvable (404, ou 400 + statusCode '404'). Tout appel est journalisé.
import { ALLOWED_MIME } from '../src/sync/mime.js';

const erreur = (type, status, statusCode, code, message = '') => ({ type, status, statusCode, code, message });

export function creerStockageFactice({ objets = {}, limiteOctets = 52428800, types = ALLOWED_MIME, pannes = [], forme409 = 'status', forme404 = 'status', avant = null } = {}) {
  const memoire = new Map(Object.entries(objets));
  const restantes = [...pannes];
  const journal = [];
  // Une panne scriptée est consommée UNE fois : la première dont la méthode (et le chemin, s'il est donné) correspond.
  const panne = (methode, chemin) => {
    const i = restantes.findIndex((p) => p.methode === methode && (p.chemin == null || p.chemin === chemin));
    return i < 0 ? null : restantes.splice(i, 1)[0].erreur;
  };
  return {
    journal,
    octets: (chemin) => memoire.get(chemin) ?? null,
    async envoyer(chemin, blob, { upsert = false } = {}) {
      journal.push({ methode: 'envoyer', chemin, type: blob.type, taille: blob.size, upsert });
      if (avant) await avant('envoyer', chemin);
      const p = panne('envoyer', chemin);
      if (p) return { erreur: p };
      if (!types.includes(blob.type)) return { erreur: erreur('refus', 415, '415', 'InvalidMimeType') }; // S-2 : le type du BLOB, jamais une option
      if (blob.size > limiteOctets) return { erreur: erreur('quota', 413, '413', 'EntityTooLarge') };
      if (memoire.has(chemin) && !upsert) {
        return { erreur: forme409 === 'statusCode' ? erreur('refus', 400, '409', null, 'The resource already exists') : erreur('refus', 409, '409', 'Duplicate', 'The resource already exists') };
      }
      memoire.set(chemin, blob);
      return { erreur: null };
    },
    async recevoir(chemin) {
      journal.push({ methode: 'recevoir', chemin });
      if (avant) await avant('recevoir', chemin);
      const p = panne('recevoir', chemin);
      if (p) return { blob: null, erreur: p };
      if (!memoire.has(chemin)) {
        return { blob: null, erreur: forme404 === 'statusCode' ? erreur('refus', 400, '404', 'not_found', 'Object not found') : erreur('inconnu', 404, '404', 'KeyNotFound', 'Object not found') };
      }
      const b = memoire.get(chemin);
      return { blob: new Blob([b], { type: b.type }), erreur: null };
    },
    async lister(prefixe, options = {}) {
      const { limit = 100, offset = 0, search = '' } = options;
      journal.push({ methode: 'lister', prefixe, options: { limit, offset, search } });
      if (avant) await avant('lister', prefixe);
      const p = panne('lister', prefixe);
      if (p) return { objets: [], erreur: p };
      const tete = prefixe + '/';
      const dossier = [...memoire.entries()].filter(([c]) => c.startsWith(tete))
        .map(([c, b]) => ({ name: c.slice(tete.length), metadata: { size: b.size, mimetype: b.type } }))
        .filter((o) => o.name.startsWith(search))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      return { objets: dossier.slice(offset, offset + limit), erreur: null };
    },
  };
}
```

- [ ] **Step 2 : tests rouges** (à la fin du corps de `runSyncL4Tests`) :

```js
  // === Tâche 3 — Storage injecté, octetsAEnvoyer, passe fichiers
  const TR = await import('../src/sync/transport.js');
  const { ErreurImage, dimensionsImage } = await import('../src/core/image.js');
  const { creerStockageFactice } = await import('./stockage-factice.js');
  // Une image dont l'EN-TÊTE PNG dit largeur × hauteur (lu par dimensionsImage, jamais décodé) ; `graine` rend chaque photo unique.
  const entetePng = (largeur, hauteur, { taille = 64, graine = '' } = {}) => {
    const b = new Uint8Array(Math.max(taille, 32));
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    const dv = new DataView(b.buffer); dv.setUint32(16, largeur); dv.setUint32(20, hauteur);
    b.set(new TextEncoder().encode(graine).slice(0, b.length - 24), 24);
    return new Blob([b], { type: 'image/png' });
  };
  // Un réducteur injecté : il note ses appels et rend un « JPEG » minuscule et unique (jpeg-1, jpeg-2…), plus petit que toute photo de test.
  const reducteur = () => { const appels = []; return { appels, reduire: async (blob, opts) => { appels.push(opts); return octets('jpeg-' + appels.length); } }; };
  const empreinte = (texte) => sha256Hex(octets(texte));
  async function poserPhoto(repo, db, graine, { largeur = 3000, hauteur = 2000, taille = 64, page = true, type = 'image/png', nom = 'p.png' } = {}) {
    const brut = entetePng(largeur, hauteur, { taille, graine });
    const blob = type === 'image/png' ? brut : new Blob([brut], { type });
    const sha256 = await sha256Hex(blob);
    await repo.putFile(sha256, blob, { original_filename: nom });
    if (page) await db.mutate({ puts: { source_pages: [{ id: 'pg_' + graine, document_id: 'doc_' + graine, sha256, updated_at: DATE }] }, origin: 'device' });
    return sha256;
  }
  const passe = (db, stockage, sur = {}) => F.createFichiers({ db, stockage, getUserId: () => 'u1', qualite: () => 'reduite', ...sur });
  const snapshot = (db) => db.getSnapshot(MAGASINS_SNAPSHOT);
  const sansConsole = async (fn) => { const vrai = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = vrai; } };
  const lireCles = async (db, prefixe) => (await db.getAll('sync_state')).filter((l) => String(l.key).startsWith(prefixe));

  await run('Storage : createStockage, dejaPresent, introuvable (§ 6, B-3)', async () => {
    const appels = [];
    const seau = {
      upload: async (chemin, corps, opts) => { appels.push(['upload', chemin, corps.type, opts]); return { data: null, error: { status: 400, statusCode: '409', code: undefined, message: 'The resource already exists' } }; }, // StorageApiError d'un corps { statusCode: '409', error: 'Duplicate' } : code = corps.code, absent (vendor 2.117.3)
      download: async (chemin) => { appels.push(['download', chemin]); return { data: null, error: { status: 400, statusCode: '404', code: 'not_found', message: 'Object not found' } }; },
      list: async (prefixe, opts) => { appels.push(['list', prefixe, opts]); return { data: [{ name: H('a'), metadata: { size: 3, mimetype: 'image/jpeg' } }], error: null }; },
    };
    const st = TR.createStockage({ storage: { from: (nom) => { appels.push(['from', nom]); return seau; } } });
    const e1 = (await st.envoyer('u1/' + H('a'), octets('abc'), { upsert: false })).erreur;
    const e2 = (await st.recevoir('u1/' + H('a'))).erreur;
    const l = await st.lister('u1', { limit: 1, offset: 0, search: H('a') });
    eq([e1.type, e1.status, e1.statusCode, e1.code, TR.dejaPresent(e1), TR.introuvable(e2), e2.statusCode, l.objets.length, l.erreur],
      ['refus', 400, '409', null, true, true, '404', 1, null], 'createStockage : erreurs classées par classerErreur, statusCode recopié, code absent → null ; « déjà présent » reconnu par statusCode SEUL, introuvable sous la forme 400 + statusCode (mutant : statusCode ignoré → faux)');
    eq(appels.filter((a) => a[0] === 'from').map((a) => a[1]).every((n) => n === 'pages') && appels.find((a) => a[0] === 'upload')[3].upsert === false && appels.find((a) => a[0] === 'list')[2].search === H('a'), true, 'createStockage : seau pages, upsert explicite, list avec search');
    eq([TR.dejaPresent({ status: 409 }), TR.dejaPresent({ code: 'Duplicate' }), TR.dejaPresent({ status: 400, statusCode: '409' }), TR.dejaPresent({ status: 400, statusCode: '409', code: 'KeyAlreadyExists' }), TR.dejaPresent({ status: 400, statusCode: '400' }), TR.introuvable({ status: 404 }), TR.introuvable({ code: 'KeyNotFound' }), TR.introuvable({ code: 'NoSuchKey' }), TR.introuvable({ status: 400, statusCode: '404' }), TR.introuvable({ status: 400 })],
      [true, true, true, true, false, true, true, true, true, false], 'dejaPresent / introuvable : les trois champs lus — 400 + statusCode « 409 » sans code Duplicate est « déjà présent » (mutant : statusCode ignoré → faux)');
    const leve = TR.createStockage({ storage: { from: () => ({ upload: async () => { throw new Error('Failed to fetch'); } }) } });
    eq([(await leve.envoyer('u1/x', octets('a'))).erreur.type, (await TR.createStockage(null).envoyer('u1/x', octets('a'))).erreur.type], ['reseau', 'auth'], 'createStockage : une levée → reseau ; sans client → auth (rien n’est tenté)');
  });

  await run('octetsAEnvoyer : qualité, seuils, mur de 16 Mpx (R-G-4)', async () => {
    const appel = (blob, mime, qualite, reduire) => F.octetsAEnvoyer({ sha256: H('a'), mime, size: blob.size, blob }, { qualite, reduire });
    const r1 = reducteur();
    const grande = entetePng(3000, 200, { graine: 'g' });
    const o1 = await appel(grande, 'image/png', 'originale', r1.reduire);
    const o2 = await appel(octets('%PDF-1.4', 'application/pdf'), 'application/pdf', 'reduite', r1.reduire);
    eq([o1.blob === grande, o1.mime, o2.mime, r1.appels.length], [true, 'image/png', 'application/pdf', 0], 'octetsAEnvoyer : Originale → tel quel ; PDF → tel quel ; reduire jamais appelé');
    const o3 = await appel(grande, 'image/png', 'reduite', r1.reduire);
    eq([o3.mime, o3.blob.type, r1.appels], ['image/jpeg', 'image/jpeg', [{ maxCote: 2000, qualite: 0.8 }]], 'octetsAEnvoyer : 3 000 px → reduire({ maxCote: 2000, qualite: 0.8 }), sortie JPEG');
    const r2 = reducteur();
    const petite = entetePng(1200, 800, { taille: 300 * 1024 });
    const lourde = entetePng(1200, 800, { taille: 900 * 1024 });
    const o4 = await appel(petite, 'image/png', 'reduite', r2.reduire);
    const o5 = await appel(lourde, 'image/png', 'reduite', r2.reduire);
    eq([o4.blob === petite, o5.mime, r2.appels.length], [true, 'image/jpeg', 1], 'octetsAEnvoyer : 1 200 px et 300 Ko → tel quel ; 1 200 px et 900 Ko → réduite (mutant : seuil octetsTelQuel retiré)');
    const o6 = await appel(octets('heic-brut', 'image/heic'), 'image/heic', 'reduite', async () => { throw new ErreurImage('indecodable'); });
    const o7 = await appel(grande, 'image/png', 'reduite', async () => octets('x'.repeat(5000)));
    eq([o6.mime, o6.blob.type, o7.blob === grande], ['image/heic', 'image/heic', true], 'octetsAEnvoyer : HEIC indécodable (Chrome) → tel quel (mutant : refusé) ; réduite plus grosse que l’original → l’original');
    const r3 = reducteur();
    const vingt = entetePng(5000, 4000, { graine: '20mpx' });
    const o8 = await appel(vingt, 'image/png', 'reduite', r3.reduire);
    eq([o8.blob === vingt, o8.tropGrande, o8.pixels, r3.appels.length], [true, true, 20000000, 0], 'octetsAEnvoyer : en-tête de 20 Mpx → tel quel, SANS décodage (R-G-4 ; mutant : mur de pixels retiré → reduire appelé)');
    const toile = new OffscreenCanvas(3000, 200);
    const cx = toile.getContext('2d');
    const img = cx.createImageData(3000, 200);
    let graine = 7;
    for (let i = 0; i < img.data.length; i += 1) { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; img.data[i] = i % 4 === 3 ? 255 : graine >>> 24; }
    cx.putImageData(img, 0, 0);
    const bruit = await toile.convertToBlob({ type: 'image/png' }); // du bruit : le PNG ne se comprime pas, la réduction est plus légère
    const o9 = await F.octetsAEnvoyer({ sha256: H('a'), mime: 'image/png', size: bruit.size, blob: bruit }, { qualite: 'reduite' });
    const dims = await dimensionsImage(o9.blob);
    eq([o9.mime, dims?.largeur, dims?.hauteur], ['image/jpeg', 2000, 133], 'octetsAEnvoyer : une vraie image de 3 000 × 200 (reduireImage réel, canvas) → JPEG de 2 000 × 133');
  });

  await run('passe : trois photos réduites, une telle quelle, un HEIC sans type (a, a2, a3)', async () => {
    await withRepo(async (repo, db) => {
      const s1 = await poserPhoto(repo, db, 'un');
      const s2 = await poserPhoto(repo, db, 'deux');
      const s3 = await poserPhoto(repo, db, 'trois');
      const orpheline = await poserPhoto(repo, db, 'orpheline', { page: false });
      const inconnue = await poserPhoto(repo, db, 'inconnue', { type: '', nom: 'notes.txt' });
      const sf = creerStockageFactice();
      const red = reducteur();
      let lectures = 0;
      const bilan = await passe(db, sf, { reduire: red.reduire, qualite: () => { lectures += 1; return 'reduite'; } }).envoyer({ snapshot: await snapshot(db) });
      const h = await Promise.all([1, 2, 3].map((n) => empreinte('jpeg-' + n)));
      eq([sf.journal.filter((j) => j.methode === 'envoyer').map((j) => [j.chemin, j.type, j.upsert]), bilan.confirmes, bilan.restants, lectures], [h.map((x) => ['u1/' + x, 'image/jpeg', false]), 3, 0, 3], 'passe (a) : trois envois dans l’ordre created_at, le Blob envoyé typé image/jpeg (S-2), qualite() appelée à CHAQUE fichier (B-16)');
      const lignes = await Promise.all([s1, s2, s3].map((s) => db.get('files', s)));
      eq(lignes.map((l) => ({ ...l.remote, uploaded_at: typeof l.remote?.uploaded_at })), h.map((x, i) => ({ sha256: x, size: ('jpeg-' + (i + 1)).length, mime: 'image/jpeg', quality: 'reduite', uploaded_at: 'string', owner: 'u1' })), 'passe (a) : remote = { empreinte et taille des octets envoyés, image/jpeg, quality — le FAIT —, uploaded_at, owner }');
      eq([(await db.getAll('outbox')).filter((e) => e.store === 'files').map((e) => e.id).sort(), (await db.get('files', orpheline)).remote, (await db.get('files', inconnue)).remote], [[s1, s2, s3].sort(), undefined, undefined], 'passe (a) : trois entrées files en file (capture D-G8) ; l’orpheline et le type inconnu intacts (mutant : orpheline envoyée)');
    });
    await withRepo(async (repo, db) => {
      const petite = await poserPhoto(repo, db, 'petite', { largeur: 1200, hauteur: 800 });
      await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      const lp = await db.get('files', petite);
      eq([lp.remote?.sha256, lp.remote?.quality, F.candidatsEnvoi(await snapshot(db), { uid: 'u1', renvoi: true }).some((l) => l.sha256 === petite)], [petite, 'originale', false], 'passe (a2) : une image sous les seuils part telle quelle → quality « originale » (le fait), et n’est pas candidate au renvoi');
    });
    await withRepo(async (repo, db) => {
      const heic = await poserPhoto(repo, db, 'heic', { type: '', nom: 'IMG.HEIC' });
      const sf = creerStockageFactice();
      await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      const lh = await db.get('files', heic);
      eq([sf.journal.find((j) => j.chemin === 'u1/' + heic)?.type, lh.remote?.mime, lh.remote?.quality, lh.mime], ['image/heic', 'image/heic', 'originale', 'image/heic'], 'passe (a3) : en Originale, un HEIC dont File.type était vide part en copie retypée image/heic (mutant : blob non retypé → type vide → 415 sur le factice)');
    });
  });

  await run('passe : déjà présent (b, b2, c, d)', async () => {
    for (const forme409 of ['status', 'statusCode']) {
      await withRepo(async (repo, db) => {
        const s = await poserPhoto(repo, db, 'deja-' + forme409);
        const h = await empreinte('jpeg-1');
        const sf = creerStockageFactice({ forme409, objets: { ['u1/' + h]: octets('jpeg-1') } });
        const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
        eq([sf.journal.map((j) => [j.methode, j.methode === 'lister' ? j.options.search : j.upsert]), bilan.confirmes, (await db.get('files', s)).remote?.sha256], [[['envoyer', false], ['lister', h]], 1, h], `passe (b, forme ${forme409}) : déjà présent → lister(search = h), taille égale → confirmé sans second envoi (mutants : 409 confirmé sans lister ; statusCode ignoré → file_error type)`);
      });
    }
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'tronquee');
      const h = await empreinte('jpeg-1');
      const sf = creerStockageFactice({ objets: { ['u1/' + h]: octets('jpeg-1-tronque') } });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([sf.journal.map((j) => [j.methode, j.methode === 'lister' ? j.options.search : j.upsert]), bilan.confirmes, sf.octets('u1/' + h).size, (await db.get('files', s)).remote?.sha256], [[['envoyer', false], ['lister', h], ['envoyer', true], ['lister', h]], 1, 6, h], 'passe (c) : déjà présent, taille différente → upsert: true puis lister → confirmé');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'menteur');
      const h = await empreinte('jpeg-1');
      const sf = creerStockageFactice({ objets: { ['u1/' + h]: octets('ancien') } });
      const menteur = { ...sf, lister: async (prefixe, options) => { const r = await sf.lister(prefixe, options); return { ...r, objets: r.objets.map((o) => ({ ...o, metadata: { ...o.metadata, size: o.metadata.size + 1 } })) }; } };
      const bilan = await passe(db, menteur, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.confirmes, bilan.erreurs, (await db.get('sync_state', 'file_error:' + s))?.value?.motif, (await db.get('files', s)).remote], [0, 1, 'verification', undefined], 'passe (d) : déjà présent puis deux tailles différentes → file_error verification, rien d’écrit sur la ligne (mutant : remote écrit quand même)');
    });
  });

  await run('passe : erreurs classées (e, f, g, h, i)', async () => {
    await withRepo(async (repo, db) => {
      const jpeg = await poserPhoto(repo, db, 'refusee');
      const pdfBlob = octets('%PDF-1.4 e', 'application/pdf'); const pdf = await sha256Hex(pdfBlob);
      await repo.putFile(pdf, pdfBlob, { original_filename: 'm.pdf' });
      await db.mutate({ puts: { source_documents: [{ id: 'doc_pdf', sha256: pdf, updated_at: DATE }] }, origin: 'device' });
      const bilan = await passe(db, creerStockageFactice({ types: ['application/pdf'] }), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      const e = (await db.get('sync_state', 'file_error:' + jpeg))?.value;
      eq([e?.motif, e?.sens, (await db.get('files', pdf)).remote?.quality, bilan.confirmes, bilan.erreurs], ['type', 'envoi', 'originale', 1, 1], 'passe (e) : 415 → file_error type (envoi), la passe continue sur le suivant (un PDF part tel quel)');
    });
    await withRepo(async (repo, db) => {
      const onze = octets('onze-octets'); const sha = await sha256Hex(onze);
      await repo.putFile(sha, onze, {});
      await db.mutate({ puts: { source_pages: [{ id: 'pg_onze', document_id: 'd', sha256: sha, updated_at: DATE }] }, origin: 'device' });
      const sf = creerStockageFactice();
      const bilan = await passe(db, sf, { qualite: () => 'originale', limites: { ...F.LIMITES_FICHIERS, octetsMax: 10 } }).envoyer({ snapshot: await snapshot(db) });
      eq([sf.journal.length, (await db.get('sync_state', 'file_error:' + sha))?.value?.motif, bilan.erreurs], [0, 'trop_gros', 1], 'passe (f, F-14) : un vrai Blob de 11 octets sous une borne de 10 → aucun appel réseau, file_error trop_gros (mutant : borne retirée)');
    });
    await withRepo(async (repo, db) => {
      const [p1, p2, p3] = [await poserPhoto(repo, db, 'g1'), await poserPhoto(repo, db, 'g2'), await poserPhoto(repo, db, 'g3')];
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', chemin: 'u1/' + await empreinte('jpeg-2'), erreur: { type: 'reseau', status: 0, statusCode: null, code: null, message: 'x' } }] });
      const bilan = await sansConsole(async () => passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) }));
      eq([bilan.confirmes, bilan.restants, bilan.recul, bilan.erreur?.type, sf.journal.filter((j) => j.methode === 'envoyer').length, !!(await db.get('files', p1)).remote, (await db.get('files', p2)).remote, (await db.get('files', p3)).remote, (await lireCles(db, 'file_error:')).length],
        [1, 2, 2000, 'reseau', 2, true, undefined, undefined, 0], 'passe (g) : réseau au deuxième → arrêt, recul 2 s, le premier confirmé, deux restants, rien de marqué (mutant : la passe continue après reseau)');
    });
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'h1');
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', erreur: { type: 'auth', status: 401, statusCode: '401', code: null, message: 'x' } }] });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.attenteConnexion, bilan.confirmes, bilan.pauseFichiers, (await lireCles(db, 'file_error:')).length, await db.get('sync_state', 'pause_fichiers')], [true, 0, false, 0, undefined], 'passe (h) : auth → attenteConnexion, rien d’autre');
    });
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'i1');
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', erreur: { type: 'quota', status: 413, statusCode: '413', code: null, message: 'exceeded' } }] });
      const p = passe(db, sf, { reduire: reducteur().reduire });
      const bilan = await p.envoyer({ snapshot: await snapshot(db) });
      const encore = await p.envoyer({ snapshot: await snapshot(db) });
      eq([bilan.pauseFichiers, (await db.get('sync_state', 'pause_fichiers'))?.value?.raison, await db.get('sync_state', 'pause'), encore.pause, sf.journal.length], [true, 'stockage', undefined, true, 1], 'passe (i, B-5/S-4) : quota → sync_state.pause_fichiers posé, sync_state.pause ABSENT ; la passe suivante ne tente rien (mutant : clé pause posée)');
    });
  });

  await run('passe : bornes et arrêt (j, k)', async () => {
    await withRepo(async (repo, db) => {
      for (let i = 0; i < 25; i += 1) await poserPhoto(repo, db, 'borne' + i);
      const bilan = await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.confirmes, bilan.restants], [20, 5], 'passe (j) : 25 candidates → 20 envoyées, 5 restantes (parPasse)');
    });
    await withRepo(async (repo, db) => {
      for (let i = 0; i < 3; i += 1) await poserPhoto(repo, db, 'temps' + i);
      let horloge = 0;
      const sf = creerStockageFactice({ avant: async (methode) => { if (methode === 'envoyer') horloge += 61000; } });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire, maintenant: () => horloge }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.confirmes, bilan.restants], [1, 2], 'passe (j) : maintenant() saute de 61 s après le premier → confirmes 1 (mutant : borne de temps retirée)');
      const sf2 = creerStockageFactice();
      const bilan2 = await passe(db, sf2, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db), stop: () => sf2.journal.length >= 1 });
      eq([bilan2.confirmes, sf2.journal.filter((j) => j.methode === 'envoyer').length], [1, 1], 'passe (k) : stop() vrai après le premier → arrêt');
    });
  });

  await run('passe : garde de relecture (l, l2, l3, l4 ; N-2)', async () => {
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'disparue');
      const sf = creerStockageFactice({ avant: async (methode) => { if (methode === 'envoyer') await db.mutate({ deletes: { files: [s] }, origin: 'device' }); } });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([await db.get('files', s), bilan.confirmes, await db.count('outbox')], [undefined, 0, 0], 'passe (l) : ligne supprimée pendant l’envoi → rien n’est écrit (mutant : fiche fantôme)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'recue-pendant');
      const recu = R({ sha256: H('c'), size: 9 });
      const sf = creerStockageFactice({ avant: async (methode) => {
        if (methode !== 'envoyer') return;
        const l = await db.get('files', s);
        await db.mutate({ puts: { files: [{ ...l, remote: recu, updated_at: '2030-01-01T00:00:00.000Z' }] }, origin: 'remote' });
      } });
      await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      const l = await db.get('files', s);
      eq([l.remote, l.updated_at, await db.count('outbox')], [recu, '2030-01-01T00:00:00.000Z', 0], 'passe (l2) : une réception pendant l’envoi (updated_at neuf) n’est pas écrasée (mutants : écriture écrasante ; updated_at ignoré)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'renvoi');
      const ligne = await db.get('files', s);
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ sha256: H('d'), size: 6 }) }], sync_state: [{ key: 'renvoi_originale', value: { at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { ['u1/' + H('d')]: octets('ancien') } });
      await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      const l = await db.get('files', s);
      eq([l.remote.sha256, l.remote.quality, l.remote.size, !!sf.octets('u1/' + H('d'))], [s, 'originale', ligne.size, true], 'passe (l3) : renvoi en originale → remote originale écrit, l’ancienne copie reste au serveur (orphelin, L5) (mutant : garde de la rév. 2 « autre empreinte → rien » → jamais écrit)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'autre-compte');
      const ligne = await db.get('files', s);
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ owner: 'u2' }) }] }, origin: 'device' });
      await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq((await db.get('files', s)).remote.owner, 'u1', 'passe (l4) : ré-envoi sous ce compte → remote de u1 écrit (même mutant)');
    });
  });

  await run('passe : renvoyer en originale, copie sans serveur (m, n)', async () => {
    await withRepo(async (repo, db) => {
      const x = await poserPhoto(repo, db, 'm-original');
      const y = await poserPhoto(repo, db, 'm-copie');
      const z = await poserPhoto(repo, db, 'm-telquel');
      const [lx, ly, lz] = await Promise.all([x, y, z].map((s) => db.get('files', s)));
      await db.mutate({ puts: { files: [{ ...lx, remote: R({ sha256: H('d'), size: 6 }) }, { ...ly, blob: octets('copie-de-y'), remote: R({ sha256: H('b'), size: 10 }) }, { ...lz, remote: R({ sha256: z, size: lz.size, quality: 'originale' }) }], sync_state: [{ key: 'renvoi_originale', value: { at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice();
      await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      eq([sf.journal.filter((j) => j.methode === 'envoyer').map((j) => j.chemin), (await db.get('files', x)).remote.sha256, (await db.get('files', y)).remote.sha256, !!(await db.get('sync_state', 'renvoi_originale'))], [['u1/' + x], x, H('b'), true], 'passe (m) : seule la ligne réduite dont l’ORIGINAL est ici repart, sous sa clé ; une copie réduite sans original ici ne repart pas ; une ligne partie telle quelle non plus (mutant : estOriginalIci ignoré → la copie repart)');
      await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      eq(await db.get('sync_state', 'renvoi_originale'), undefined, 'passe (m) : plus aucune candidate de renvoi → la clé est retirée');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'n-copie');
      const l = await db.get('files', s);
      await db.mutate({ puts: { files: [{ ...l, blob: octets('copie-sans-serveur'), remote: null }] }, origin: 'device' });
      const snap = await snapshot(db);
      eq([F.candidatsEnvoi(snap, { uid: 'u1' }).length, F.compterFichiers(snap, { uid: 'u1' }).copiesSansServeur], [0, 1], 'passe (n, S-3) : une copie sans remote n’est PAS candidate (elle partirait « originale ») et compte en copiesSansServeur (mutant : candidate)');
    });
  });

  await run('compterFichiers : les compteurs de Réglages (§ 3.6)', async () => {
    const orig = await original('c-orig');
    const renv = await original('c-renvoi', { remote: R({ sha256: H('d') }) });
    const telq = await original('c-telquel'); telq.remote = R({ sha256: telq.sha256, size: telq.size });
    const dist = { sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ size: 300 }) };
    const etr = { sha256: H('8'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ owner: 'u2', size: 999 }) };
    const err = await original('c-erreur');
    const inco = await original('c-inconnu', { syncable: false });
    const sans = { ...(await original('c-sans')), blob: octets('copie') };
    const peri = { ...(await original('c-perimee')), blob: octets('vieille'), remote: R({ size: 3 }) };
    const tous = [orig, renv, telq, dist, etr, err, inco, sans, peri];
    const snap = { source_pages: tous.map((l, i) => ({ id: 'p' + i, sha256: l.sha256 })), files: [...tous, await original('c-orpheline')] };
    eq(F.compterFichiers(snap, { uid: 'u1', erreurs: new Set([err.sha256]) }), { aEnvoyer: 1, aTelecharger: 1, octetsATelecharger: 300, enErreur: 1, typeInconnu: 1, copiesPerimees: 1, copiesSansServeur: 1, aRenvoyer: 1 },
      'compterFichiers : un de chaque — un remote d’un autre owner n’est ni à télécharger ni compté en octets (mutant : compté) ; l’orpheline ne compte pas');
  });

  await run('téléchargement sur une tape (§ 4.8, I-G7)', async () => {
    const copie = octets('copie-telechargee'); const shaC = await sha256Hex(copie);
    const ligneDistante = (sha256, sur = {}) => ({ sha256, mime: 'image/heic', size: 999, updated_at: DATE, remote: R({ sha256: shaC, size: copie.size }), ...sur });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [ligneDistante(H('7'))] }, origin: 'remote' });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaC]: copie } });
      const r = await passe(db, sf).telecharger([H('7')]);
      const l = await db.get('files', H('7'));
      eq([r.recus, sf.journal.map((j) => [j.methode, j.chemin]), l.blob.type, await sha256Hex(l.blob), l.size, l.mime, l.updated_at, l.syncable, await db.count('outbox')],
        [1, [['recevoir', 'u1/' + shaC]], 'image/jpeg', shaC, 999, 'image/heic', DATE, true, 0], 'télécharger : recevoir(u1/remote.sha256), blob écrit typé remote.mime ; size, mime, updated_at de la ligne inchangés ; origine remote (mutant : putFile ordinaire → size réécrit)');
      eq([(await passe(db, sf).telecharger([H('7')])).recus, sf.journal.length], [0, 1], 'télécharger : blob déjà là → aucun appel');
    });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [
        ligneDistante(H('1')),
        ligneDistante(H('2'), { remote: R({ sha256: H('c'), size: copie.size }) }),
        ligneDistante(H('3'), { remote: R({ mime: 'image/svg+xml' }) }),
        ligneDistante(H('4'), { remote: true }),
        ligneDistante(H('5'), { remote: R({ owner: 'u2' }) }),
        ligneDistante(H('6'), { remote: R({ sha256: H('a'), size: 5 }) }),
        ligneDistante(H('8'), { remote: R({ sha256: H('b'), size: 5 }) }),
        ligneDistante(H('9')),
      ], sync_state: [{ key: 'file_error:' + H('9'), value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'remote' });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaC]: octets('copie-telechargeX'), ['u1/' + H('c')]: octets('court') } });
      const p = passe(db, sf);
      for (const s of [H('1'), H('2'), H('3'), H('4'), H('5'), H('6'), H('9')]) await sansConsole(() => p.telecharger([s]));
      const motif = async (s) => (await db.get('sync_state', 'file_error:' + s))?.value?.motif ?? null;
      eq(await Promise.all([H('1'), H('2'), H('3'), H('4'), H('5'), H('6')].map(motif)), ['empreinte', 'taille', 'forme', 'forme', null, 'introuvable'],
        'télécharger : même taille autres octets → empreinte ; taille fausse → taille ; remote hors liste ou true → forme ; autre compte → aucune erreur (B-4) ; 404 → introuvable');
      eq(sf.journal.map((j) => j.chemin), ['u1/' + shaC, 'u1/' + H('c'), 'u1/' + H('a')], 'télécharger : un remote invalide, un autre compte et une file_error posée ne font AUCUN appel (mutant : owner ignoré → 404 → introuvable)');
      ok(!(await Promise.all([H('1'), H('2'), H('6')].map((s) => db.get('files', s)))).some((l) => l.blob), 'télécharger : un écart n’écrit rien');
      await sansConsole(() => passe(db, creerStockageFactice({ forme404: 'statusCode' })).telecharger([H('8')]));
      eq(await motif(H('8')), 'introuvable', 'télécharger : 404 sous la forme 400 + statusCode « 404 » → introuvable (le mutant « statusCode ignoré » est tué par le test pur d’introuvable)');
    });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [ligneDistante(H('7')), ligneDistante(H('8'))] }, origin: 'remote' });
      let lacher = null;
      const tenu = new Promise((r) => { lacher = r; });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaC]: copie }, avant: async (methode) => { if (methode === 'recevoir') await tenu; } });
      const p = passe(db, sf);
      const a1 = p.telecharger([H('7')]);
      const a2 = p.telecharger([H('7')]);
      lacher();
      const [r1, r2] = await Promise.all([a1, a2]);
      eq([sf.journal.filter((j) => j.methode === 'recevoir').length, r1.recus + r2.recus], [1, 1], 'télécharger : deux appels concurrents sur la même clé → un seul recevoir (mutant : enVol retiré)');
      const sf2 = creerStockageFactice({ objets: { ['u1/' + shaC]: copie }, avant: async (methode) => {
        if (methode !== 'recevoir') return;
        const l = await db.get('files', H('8'));
        await db.mutate({ puts: { files: [{ ...l, updated_at: '2030-01-01T00:00:00.000Z' }] }, origin: 'remote' });
      } });
      const r3 = await passe(db, sf2).telecharger([H('8')]);
      eq([r3.recus, (await db.get('files', H('8'))).blob, await db.get('sync_state', 'file_error:' + H('8'))], [0, undefined, undefined], 'télécharger (N-2) : ligne modifiée pendant la descente → rien d’écrit, aucune file_error (mutant : écriture malgré le changement)');
    });
  });

  await run('télécharger toutes les pages : bornes, reprise, clé', async () => {
    await withRepo(async (repo, db) => {
      const objets = {}; const lignes = []; const pages = [];
      for (let i = 0; i < 25; i += 1) {
        const copie = octets('page-distante-' + i); const sha = await sha256Hex(copie);
        objets['u1/' + sha] = copie;
        const cle = (i + 1).toString(16).padStart(64, '0');
        lignes.push({ sha256: cle, mime: 'image/jpeg', size: 5000, updated_at: DATE, created_at: '2026-10-19T00:00:' + String(i).padStart(2, '0') + '.000Z', remote: R({ sha256: sha, size: copie.size }) });
        pages.push({ id: 'pt' + i, sha256: cle, updated_at: DATE });
      }
      lignes.push({ sha256: H('e'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }); // orpheline
      lignes.push({ sha256: H('f'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ owner: 'u2' }) }); // autre compte
      pages.push({ id: 'ptf', sha256: H('f'), updated_at: DATE });
      const erreur = (sha256) => ({ key: 'file_error:' + sha256, value: { motif: 'introuvable', sens: 'reception', at: DATE } });
      await db.mutate({ puts: { files: lignes, source_pages: pages, sync_state: [erreur(lignes[0].sha256), erreur(lignes[1].sha256), { key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
      const snap = await snapshot(db);
      const c = F.compterFichiers(snap, { uid: 'u1', erreurs: new Set([lignes[0].sha256, lignes[1].sha256]) });
      eq([c.aTelecharger, c.octetsATelecharger], [23, lignes.slice(2, 25).reduce((n, l) => n + l.remote.size, 0)], 'compterFichiers : 23 pages à télécharger, octets = Σ remote.size — l’autre owner ignoré (mutant : compté)');
      const sf = creerStockageFactice({ objets });
      const p = passe(db, sf);
      const b0 = await p.telechargerTout({ snapshot: snap, stop: () => sf.journal.length >= 1 });
      const b1 = await p.telechargerTout({ snapshot: await snapshot(db) });
      const cleGardee = !!(await db.get('sync_state', 'telecharger_tout'));
      const b2 = await p.telechargerTout({ snapshot: await snapshot(db) });
      eq([b0.recus, b0.restants, b1.recus, b1.restants, cleGardee, b2.recus, b2.restants, await db.get('sync_state', 'telecharger_tout'), sf.journal.every((j) => Object.hasOwn(objets, j.chemin))],
        [1, 22, 20, 2, true, 2, 0, undefined, true], 'telechargerTout : arrêt sur stop, 20 par passe, reprise à la passe suivante, clé retirée quand plus rien ne manque ; ni orpheline, ni autre owner, ni file_error (mutant : clé jamais retirée)');
    });
  });

  await run('espace serveur : mesure paginée du dossier de ce compte (§ 4.9)', async () => {
    await withRepo(async (repo, db) => {
      const objets = {}; let total = 0;
      for (let i = 0; i < 1250; i += 1) { const o = octets('x'.repeat(1 + (i % 7))); objets['u1/' + String(i).padStart(64, '0')] = o; total += o.size; }
      objets['u2/' + H('a')] = octets('autre-compte');
      const sf = creerStockageFactice({ objets });
      const m = await passe(db, sf).mesurerEspace();
      eq([m.octets, m.objets, m.tronque, typeof m.at, sf.journal.filter((j) => j.methode === 'lister').map((j) => [j.prefixe, j.options.limit, j.options.offset])],
        [total, 1250, false, 'string', [['u1', 1000, 0], ['u1', 1000, 1000]]], 'mesurerEspace : deux pages (offset 0 puis 1000), somme exacte du dossier de CE compte (mutant : pagination retirée → une seule page)');
      const pleine = Array.from({ length: 1000 }, (_, i) => ({ name: String(i), metadata: { size: 2 } }));
      let appels = 0;
      const t = await passe(db, { lister: async () => { appels += 1; return { objets: pleine, erreur: null }; } }).mesurerEspace();
      eq([t.tronque, t.objets, t.octets, appels], [true, 20000, 40000, 20], 'mesurerEspace : 20 pages pleines → tronque: true, 20 appels au plus');
      eq((await passe(db, { lister: async () => ({ objets: [], erreur: { type: 'reseau', status: 0, statusCode: null, code: null, message: 'x' } }) }).mesurerEspace()).erreur?.type, 'reseau', 'mesurerEspace : une erreur rend { erreur }, rien d’autre');
    });
  });

  await run('statique tâche 3 (I-G4, I-G6, R53)', async () => {
    const src = await lire('../src/sync/transport.js');
    ok(src.length > 1000 && src.includes('export function createStockage'), 'statique : transport.js est lu et porte createStockage (garde contre un source vide)');
    eq(['.getPublicUrl(', '.createSignedUrl(', '.remove('].filter((m) => src.includes(m)), [], 'I-G6 : ni URL publique, ni URL signée, ni suppression dans le seul module qui tient client.storage (test de texte, faible, admis)');
    const sw = await lire('../sw.js');
    const modules = [...sw.matchAll(/'\.\/(src\/[^']+\.js)'/g)].map((m) => m[1]).filter((m) => !m.includes('/vendor/'));
    const porteurs = []; const lisentEnLigne = [];
    for (const m of modules) {
      const s = await lire('../' + m);
      if (s.includes('getClient')) porteurs.push(m);
      if (m.startsWith('src/sync/') && s.includes('navigator.onLine')) lisentEnLigne.push(m);
    }
    eq([modules.length > 30, porteurs.sort(), lisentEnLigne], [true, ['src/app.js', 'src/sync/auth.js'], []], 'R53 : getClient n’est nommé que par auth.js (définition) et app.js (seul appelant) ; I-G4 : navigator.onLine n’est lu nulle part dans src/sync/');
  });
```

- [ ] **Step 3 : rouge lu.** **Mesuré au rejeu** : 4084/4098, quatorze rouges — treize du lot G (`createStockage`, `octetsAEnvoyer`, passes,
  téléchargement, espace, statique) et l'épingle ; aucune assertion existante.

- [ ] **Step 4 : implémenter `src/sync/transport.js`** (à la suite de `createTransport`) :

```js
// Lot G (§ 6, D-G9) : le client Storage, INJECTÉ — seul module qui tient client.storage, comme pour sync_push. Trois appels, sur le seau privé
// `pages` : upload (upsert explicite), download, list. Jamais d'URL publique ni signée, jamais de suppression (L5). Chaque erreur est classée
// par classerErreur, puis statusCode et code de StorageApiError sont recopiés : « déjà présent » et « introuvable » ont deux formes chez le
// fournisseur (B-3), lues par dejaPresent et introuvable.
const SEAU = 'pages';
function erreurStockage(e) {
  const classee = classerErreur({ status: Number.isFinite(e?.status) ? e.status : null, code: e?.code ?? null, message: e?.message ?? '' });
  return { type: classee.type, status: classee.status, statusCode: e?.statusCode != null ? String(e.statusCode) : null, code: e?.code != null ? String(e.code) : null, message: classee.message };
}
const SANS_SEAU = () => ({ type: 'auth', status: null, statusCode: null, code: null, message: 'client absent' });

export function createStockage(client) {
  const seau = () => client?.storage?.from?.(SEAU) ?? null;
  return {
    async envoyer(chemin, blob, { upsert = false } = {}) {
      const s = seau();
      if (!s) return { erreur: SANS_SEAU() };
      try {
        const { error } = await s.upload(chemin, blob, { upsert: upsert === true }); // le type part comme blob.type (S-2)
        return { erreur: error ? erreurStockage(error) : null };
      } catch (error) { return { erreur: erreurStockage({ status: 0, message: error?.message }) }; }
    },
    async recevoir(chemin) {
      const s = seau();
      if (!s) return { blob: null, erreur: SANS_SEAU() };
      try {
        const { data, error } = await s.download(chemin);
        if (error) return { blob: null, erreur: erreurStockage(error) };
        if (!(data instanceof Blob)) return { blob: null, erreur: { type: 'inconnu', status: null, statusCode: null, code: null, message: 'corps absent' } };
        return { blob: data, erreur: null };
      } catch (error) { return { blob: null, erreur: erreurStockage({ status: 0, message: error?.message }) }; }
    },
    async lister(prefixe, { limit = 100, offset = 0, search = '' } = {}) {
      const s = seau();
      if (!s) return { objets: [], erreur: SANS_SEAU() };
      try {
        const { data, error } = await s.list(prefixe, { limit, offset, search, sortBy: { column: 'name', order: 'asc' } });
        if (error) return { objets: [], erreur: erreurStockage(error) };
        return { objets: Array.isArray(data) ? data : [], erreur: null };
      } catch (error) { return { objets: [], erreur: erreurStockage({ status: 0, message: error?.message }) }; }
    },
  };
}

// Testés AVANT le type (F-13 : classerErreur range un 404 en « inconnu », un 400 en « refus »).
export const dejaPresent = (e) => !!e && (e.statusCode === '409' || e.status === 409 || e.code === 'Duplicate');
export const introuvable = (e) => !!e && (e.statusCode === '404' || e.status === 404 || ['KeyNotFound', 'NoSuchKey', 'not_found'].includes(e.code));
```

- [ ] **Step 5 : implémenter la passe dans `src/sync/fichiers.js`** (imports ajoutés : `import { reduireImage, dimensionsImage, LIMITES_COUVERTURE,
  ErreurImage } from '../core/image.js';`, `import { sha256Hex } from '../core/hash.js';`, `import { dejaPresent, introuvable } from './transport.js';`,
  `import { reculMs } from './push.js';` — cycle bénin `fichiers → push → reponses → fichiers` : aucun des deux n'utilise l'autre à l'évaluation —,
  `import { nettoyerChaines } from './lots.js';`, `import { syncNow } from './clock.js';`, `import { logError } from '../core/log.js';`) :

```js
export const LIMITES_FICHIERS = Object.freeze({
  parPasse: 20, dureeMs: 60000, octetsMax: 52428800,
  pixelsMax: LIMITES_COUVERTURE.pixels, // 16 Mpx : une seule borne dans l'app (R-G-4 : hauteur à relever après mesure, § 10 geste 8)
  reduite: Object.freeze({ maxCote: 2000, qualite: 0.8, octetsTelQuel: 614400 }),
});
// Le snapshot de la passe : pris UNE fois (S-12) et relu par envoyer, telechargerTout et compterFichiers.
export const MAGASINS_FICHIERS = Object.freeze(['source_pages', 'source_documents', 'book_editions', 'recipes', 'imports', 'files', 'books']);
const PREFIXE_ERREUR = 'file_error:';

export async function lireErreursFichiers(db) {
  return new Map((await db.getAll('sync_state')).filter((l) => String(l?.key).startsWith(PREFIXE_ERREUR)).map((l) => [l.key.slice(PREFIXE_ERREUR.length), l.value]));
}

// Les compteurs de Réglages (§ 3.6, § 4.1) : des lignes RÉFÉRENCÉES seulement ; un remote d'un autre compte n'est jamais « à télécharger ».
export function compterFichiers(snapshot, { uid = null, erreurs = new Map() } = {}) {
  const refs = referencesFichiers(snapshot);
  const c = { aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0, aRenvoyer: 0 };
  for (const row of snapshot?.files || []) {
    if (!row || !refs.has(row.sha256)) continue;
    if (erreurs.has(row.sha256)) { c.enErreur += 1; continue; }
    if (row.syncable === false) { c.typeInconnu += 1; continue; }
    const deCeCompte = remoteDeCeCompte(row.remote, uid);
    if (estOriginalIci(row)) {
      if (!deCeCompte) c.aEnvoyer += 1;
      else if (row.remote.sha256 !== row.sha256) c.aRenvoyer += 1;
    } else if (row.blob instanceof Blob) {
      if (!deCeCompte) c.copiesSansServeur += 1;
      else if (copiePerimee(row)) c.copiesPerimees += 1;
    } else if (deCeCompte) { c.aTelecharger += 1; c.octetsATelecharger += row.remote.size; }
  }
  return c;
}

// Les octets qui partent (§ 4.7 a, D-G3, R-G-4) : Originale ou non-image → tels quels ; au-dessus du mur de pixels → tels quels SANS décodage ;
// petite et légère → telle quelle ; sinon réduite en JPEG — indécodable (HEIC hors Safari) ou plus grosse que l'original → l'original.
export async function octetsAEnvoyer(row, { qualite = 'reduite', reduire = reduireImage, limites = LIMITES_FICHIERS } = {}) {
  const telQuel = { blob: row.blob, mime: row.mime, tropGrande: false, pixels: null };
  if (qualite === 'originale' || !String(row.mime).startsWith('image/')) return telQuel;
  const dims = await dimensionsImage(row.blob);
  const pixels = dims ? dims.largeur * dims.hauteur : null;
  if (pixels !== null && pixels > limites.pixelsMax) return { ...telQuel, tropGrande: true, pixels };
  if (dims && Math.max(dims.largeur, dims.hauteur) <= limites.reduite.maxCote && row.blob.size <= limites.reduite.octetsTelQuel) return telQuel;
  let reduite;
  try { reduite = await reduire(row.blob, { maxCote: limites.reduite.maxCote, qualite: limites.reduite.qualite }); }
  catch (error) { if (error instanceof ErreurImage) return telQuel; throw error; }
  if (!(reduite instanceof Blob) || reduite.size > row.blob.size) return telQuel;
  return { blob: reduite, mime: 'image/jpeg', tropGrande: false, pixels };
}

export function createFichiers({ db, stockage, getUserId, qualite = () => 'reduite', reduire = reduireImage, hacher = sha256Hex, maintenant = Date.now, limites = LIMITES_FICHIERS }) {
  let tentatives = 0; // échecs passagers consécutifs de l'envoi (recul), remis à zéro à la première confirmation
  const enVol = new Set(); // une seule descente à la fois par clé
  const iso = () => new Date(maintenant()).toISOString();
  // Une clé file_error n'est posée que sur une empreinte de forme valide (S-13) : une clé venue du serveur ne devient jamais une clé sync_state.
  async function poserErreur(sha256, motif, sens) {
    if (!HASH_FICHIER.test(String(sha256))) { logError('sync.fichiers.forme', { reason: motif }); return; }
    await db.mutate({ puts: { sync_state: [{ key: PREFIXE_ERREUR + sha256, value: { motif, sens, at: iso() } }] }, origin: 'device' });
  }
  const remplacer = (snapshot, ligne) => {
    const liste = snapshot?.files;
    const i = Array.isArray(liste) ? liste.findIndex((r) => r?.sha256 === ligne.sha256) : -1;
    if (i >= 0) liste[i] = ligne;
  };
  // « Déjà présent » vérifié par la taille (D-G2) : list(search = h), l'objet nommé h, metadata.size égale.
  async function verifierDistant(uid, h, taille) {
    const r = await stockage.lister(uid, { search: h, limit: 1 });
    if (r.erreur) return false;
    const objet = r.objets.find((o) => o?.name === h);
    return !!objet && Number(objet.metadata?.size) === taille;
  }

  async function envoyer({ stop = () => false, surProgression = () => {}, snapshot } = {}) {
    const bilan = { confirmes: 0, erreurs: 0, restants: 0, attenteConnexion: false, pauseFichiers: false, erreur: null, recul: null };
    const uid = getUserId();
    if (!uid) return { ...bilan, rien: true };
    if ((await db.get('sync_state', 'pause_fichiers'))?.value) return { ...bilan, pause: true };
    const renvoi = !!(await db.get('sync_state', 'renvoi_originale'))?.value;
    const candidats = candidatsEnvoi(snapshot, { uid, renvoi, erreurs: await lireErreursFichiers(db) });
    if (renvoi && !candidats.some((r) => remoteDeCeCompte(r.remote, uid))) await db.mutate({ deletes: { sync_state: ['renvoi_originale'] }, origin: 'device' });
    const debut = maintenant();
    let tropGrandeDite = false;
    let i = 0;
    for (; i < candidats.length; i += 1) {
      if (i >= limites.parPasse || maintenant() - debut >= limites.dureeMs || stop()) break;
      const row = candidats[i];
      surProgression({ sens: 'envoi', n: i + 1, total: candidats.length });
      const choisie = qualite(); // relue à CHAQUE fichier : le réglage peut changer pendant la passe (B-16)
      // Un renvoi (la ligne porte déjà un remote de ce compte) part toujours en originale : c'est ce que le geste demande.
      const octets = await octetsAEnvoyer(row, { qualite: remoteDeCeCompte(row.remote, uid) ? 'originale' : choisie, reduire, limites });
      if (octets.tropGrande && !tropGrandeDite) { tropGrandeDite = true; logError('sync.fichiers.trop_grande', { count: octets.pixels }); }
      if (octets.blob.size > limites.octetsMax) { await poserErreur(row.sha256, 'trop_gros', 'envoi'); bilan.erreurs += 1; continue; }
      const h = await hacher(octets.blob);
      const quality = h === row.sha256 ? 'originale' : 'reduite'; // le FAIT, jamais le réglage (D-G3, S-3)
      const chemin = `${uid}/${h}`;
      const corps = new Blob([octets.blob], { type: octets.mime }); // la copie retypée est la règle (S-2)
      let r = await stockage.envoyer(chemin, corps, { upsert: false });
      let confirme = !r.erreur;
      if (r.erreur && dejaPresent(r.erreur)) {
        confirme = await verifierDistant(uid, h, corps.size);
        if (!confirme) {
          r = await stockage.envoyer(chemin, corps, { upsert: true });
          confirme = !r.erreur && await verifierDistant(uid, h, corps.size);
          if (!confirme && !r.erreur) { await poserErreur(row.sha256, 'verification', 'envoi'); bilan.erreurs += 1; continue; }
        }
      }
      if (!confirme) {
        const e = r.erreur;
        if (e.type === 'auth') { bilan.attenteConnexion = true; bilan.erreur = e; break; }
        if (e.type === 'quota') {
          await db.mutate({ puts: { sync_state: [{ key: 'pause_fichiers', value: { raison: 'stockage', at: iso() } }] }, origin: 'device' }); // jamais `pause` (D-G4)
          bilan.pauseFichiers = true; bilan.erreur = e; break;
        }
        if (e.type === 'refus') { await poserErreur(row.sha256, 'type', 'envoi'); bilan.erreurs += 1; continue; }
        logError('sync.fichiers.envoi', { reason: e.type, status: e.status });
        bilan.erreur = e; bilan.recul = reculMs(tentatives); tentatives += 1; break;
      }
      tentatives = 0;
      const relue = await db.get('files', row.sha256); // relue JUSTE avant d'écrire (S-10)
      if (!peutEcrireRemote(row, relue, { h, uid })) continue;
      const ecrite = nettoyerChaines({ ...relue, remote: { sha256: h, size: corps.size, mime: octets.mime, quality, uploaded_at: syncNow(), owner: uid }, updated_at: syncNow() });
      await db.mutate({ puts: { files: [ecrite] }, origin: 'local' }); // capturée : la ligne part à la passe suivante (D-G8)
      remplacer(snapshot, ecrite);
      bilan.confirmes += 1;
    }
    bilan.restants = candidats.length - i;
    return bilan;
  }

  async function telechargerUn(sha256, uid) {
    const ligne = await db.get('files', sha256);
    if (!ligne || ligne.blob instanceof Blob) return 'rien';
    if (await db.get('sync_state', PREFIXE_ERREUR + sha256)) return 'rien'; // « Réessayer » retire la clé d'abord
    if (!remoteValide(ligne.remote)) { await poserErreur(sha256, 'forme', 'reception'); return 'erreur'; }
    if (ligne.remote.owner !== uid) return 'rien'; // ses octets ne sont pas dans ce dossier (B-4) : aucun appel, aucune erreur
    const r = await stockage.recevoir(`${uid}/${ligne.remote.sha256}`);
    if (r.erreur) {
      if (introuvable(r.erreur) || r.erreur.type === 'refus') { await poserErreur(sha256, 'introuvable', 'reception'); return 'erreur'; }
      logError('sync.fichiers.reception', { reason: r.erreur.type, status: r.erreur.status });
      return { erreur: r.erreur };
    }
    // I-G7 : ce qui s'écrit est vérifié contre remote — taille, empreinte, type de la liste blanche (défense en profondeur : remoteValide l'a déjà lu).
    if (r.blob.size !== ligne.remote.size) { await poserErreur(sha256, 'taille', 'reception'); return 'erreur'; }
    if (await hacher(r.blob) !== ligne.remote.sha256) { await poserErreur(sha256, 'empreinte', 'reception'); return 'erreur'; }
    if (!isAllowed(ligne.remote.mime)) { await poserErreur(sha256, 'type', 'reception'); return 'erreur'; }
    const relue = await db.get('files', sha256);
    if (!peutEcrireOctets(ligne, relue)) return 'rien';
    await db.mutate({ puts: { files: [fusionnerOctetsRecus(relue, new Blob([r.blob], { type: ligne.remote.mime }))] }, origin: 'remote' });
    return 'recu';
  }

  async function telecharger(shas, { stop = () => false } = {}) {
    const bilan = { recus: 0, erreurs: 0, erreur: null };
    const uid = getUserId();
    if (!uid) return { ...bilan, rien: true };
    for (const sha256 of shas) {
      if (stop()) break;
      if (enVol.has(sha256)) continue;
      enVol.add(sha256);
      try {
        const r = await telechargerUn(sha256, uid);
        if (r === 'recu') bilan.recus += 1;
        else if (r === 'erreur') bilan.erreurs += 1;
        else if (r?.erreur) { bilan.erreur = r.erreur; break; }
      } finally { enVol.delete(sha256); }
    }
    return bilan;
  }

  async function telechargerTout({ stop = () => false, surProgression = () => {}, snapshot } = {}) {
    const uid = getUserId();
    if (!uid) return { recus: 0, restants: 0, erreur: null, rien: true };
    const erreurs = await lireErreursFichiers(db);
    const refs = referencesFichiers(snapshot);
    const candidats = (snapshot?.files || [])
      .filter((row) => row && refs.has(row.sha256) && !(row.blob instanceof Blob) && remoteDeCeCompte(row.remote, uid) && !erreurs.has(row.sha256))
      .sort((a, b) => (dateDe(a) < dateDe(b) ? -1 : dateDe(a) > dateDe(b) ? 1 : 0));
    const bilan = { recus: 0, restants: 0, erreur: null };
    const debut = maintenant();
    let i = 0;
    for (; i < candidats.length; i += 1) {
      if (i >= limites.parPasse || maintenant() - debut >= limites.dureeMs || stop()) break;
      surProgression({ sens: 'reception', n: i + 1, total: candidats.length });
      const r = await telecharger([candidats[i].sha256], { stop });
      if (r.recus) { bilan.recus += r.recus; const ecrite = await db.get('files', candidats[i].sha256); if (ecrite) remplacer(snapshot, ecrite); }
      if (r.erreur) { bilan.erreur = r.erreur; break; }
    }
    bilan.restants = candidats.length - i;
    if (!bilan.restants && !bilan.erreur) await db.mutate({ deletes: { sync_state: ['telecharger_tout'] }, origin: 'device' });
    return bilan;
  }

  // L'espace du dossier de CE compte (D-G6, R-G-5) : une mesure, jamais un plafond ; 20 pages de 1 000 au plus (tronque).
  async function mesurerEspace() {
    const uid = getUserId();
    if (!uid) return { erreur: SANS_COMPTE };
    let offset = 0; let octets = 0; let objets = 0; let tronque = true;
    for (let page = 0; page < 20; page += 1) {
      const r = await stockage.lister(uid, { limit: 1000, offset });
      if (r.erreur) return { erreur: r.erreur };
      objets += r.objets.length;
      for (const o of r.objets) octets += Number(o?.metadata?.size) || 0;
      if (r.objets.length < 1000) { tronque = false; break; }
      offset += 1000;
    }
    return { octets, objets, at: syncNow(), tronque };
  }

  return { envoyer, telecharger, telechargerTout, mesurerEspace };
}
const SANS_COMPTE = Object.freeze({ type: 'auth', status: null, statusCode: null, code: null, message: 'sans compte' });
```

  (`dateDe` est la fonction de tri de la tâche 1, partagée.)

- [ ] **Step 6 : vert** (suite, épingle, `node --test tools/*.test.mjs` inchangé — `fichiers-node.test.mjs` doit rester vert malgré les imports
  neufs : c'est la contrainte F-12 —, `--check` 0). `sw.js` : `VERSION = 'cuisine-os-v0.11.0-3'`. **Mesuré au rejeu** : seule l'épingle rouge
  (obtenu 4133), puis 4134/4134 (épingle 4133) ; Node 174 (`fichiers-node.test.mjs` vert avec les imports neufs) ; `--check` 0.
- [ ] **Step 7 : invisibles** (Python).
- [ ] **Step 8 : commit** `Passe fichiers L4 : Storage injecte, octets reduits ou tels quels, deja present verifie, garde de relecture, telechargement verifie, espace mesure (lot G, tache 3)`.

---

### Task 4 : Moteur — phase « fichiers », vols tenus, API des gestes (spec § 3.6, § 4.7 fin, § 4.8 « Arrêt », § 4.9, D-G13, B-9)

**Files:**
- Modify: `src/sync/moteur.js` (`AU_REPOS` + cinq clés, `instantane` les fige, `createMoteur({ …, stockage = null, qualite = () => 'reduite', reduire =
  null })`, compteur `compte` étendu au stockage, `charger`, phase `fichiers` dans `passe`, `fin.fichiers`, `derniersEffets.fichiersRecus`,
  `vols`, `arreter()` étendu, `envoyerMaintenant` lève les deux pauses ; API `telecharger`, `telechargerTout`, `arreterTelechargement`,
  `actualiserEspace`, `renvoyerEnOriginale`, `reessayerFichier`)
- Modify: `src/app.js` (`createStockage` importé de `./sync/transport.js`, `qualiteEnvoi` de `./ui/state.js` ; `createMoteur({ …, stockage:
  createStockage(client), qualite: qualiteEnvoi })`), `src/ui/state.js` (`passeAEcrit` lit `fichiersRecus`)
- Modify: `tests/sync-l4.js` (bloc tâche 4), `tests/sync-l3.js` (l. 1703 et 1708 : `derniersEffets` + `fichiersRecus: 0`, I-G9), `sw.js`
  (`VERSION -4`), `tests/tests.js` (total)

**Interfaces:**
- Consumes : `createFichiers`, `compterFichiers`, `lireErreursFichiers`, `MAGASINS_FICHIERS` (tâche 3) ; `createStockage` (tâche 3) ; `qualiteEnvoi`
  (tâche 1).
- Produces (état, toujours présent) : `fichiers` (les huit compteurs de `compterFichiers`, à zéro au repos), `progressionFichiers: null | { sens, n,
  total }`, `espaceServeur: null | { octets, objets, at, tronque }`, `telechargementGlobal: boolean`, `pauseFichiers: null | { raison, at }` ;
  `derniersEffets` = `{ recues, supprimees, ajustes, conflits, fichiersRecus }` ; `phase` peut valoir `'fichiers'`.
- Produces (API) : `telecharger(shas) → Promise<{ recus, erreurs, erreur } | { erreur: { type: 'arrete' } } | { rien: true }>` ;
  `telechargerTout() → état` ; `arreterTelechargement() → état` ; `actualiserEspace() → { octets, objets, at, tronque } | { erreur }` ;
  `renvoyerEnOriginale() → état` ; `reessayerFichier(sha256) → résultat du téléchargement ou de la passe | { rien: true }` ; `arreter() →
  Promise` qui attend la passe ET les vols (`Promise.allSettled`). Après `arreter()`, `telecharger`, `telechargerTout`, `actualiserEspace`,
  `renvoyerEnOriginale` et `reessayerFichier` rendent `{ erreur: { type: 'arrete' } }` sans appel ni écriture.

- [ ] **Step 1 : tests rouges.** D'abord, dans `tests/sync-l3.js`, les deux lignes ≈ 1703 et 1708 REMPLACÉES mot pour mot (I-G9 ; rouges
  jusqu'au Step 3 : le moteur de L3 rend quatre clés et `eq` compare par `JSON.stringify`) :

```js
// tests/sync-l3.js ≈ l. 1703, 1708
    eq(e.derniersEffets, { recues: 1, supprimees: 0, ajustes: 0, conflits: 0, fichiersRecus: 0 }, 'moteur (R-L3-16) : la fin d’une passe dit ce qu’elle a écrit');
    eq((await m2.executer('t')).derniersEffets, { recues: 0, supprimees: 0, ajustes: 0, conflits: 0, fichiersRecus: 0 }, 'moteur (R-L3-16) : une passe qui n’écrit rien le dit aussi — zéro partout');
```

  Puis, à la fin du corps de `runSyncL4Tests` :

```js
  // === Tâche 4 — moteur (D-G13, § 3.6, § 4.7)
  const { createMoteur } = await import('../src/sync/moteur.js');
  const fenetreMuette = () => ({ addEventListener() {}, removeEventListener() {}, document: { visibilityState: 'visible' } });
  const busMuet = { on: () => () => {} };
  // Toutes les tables marquées « fait » : la file ne porte que ce que le test écrit (comme tests/sync-l3.js).
  const toutDejaEnvoye = (db) => db.mutate({ puts: { sync_state: SYNC_STORES.map((t) => ({ key: `backfill:${t}`, value: 'fait' })) }, origin: 'device' });
  const moteurDe = (db, sur = {}) => createMoteur({ db, getUserId: () => 'u1', transport: creerTransportFactice({ lire: {} }), fenetre: fenetreMuette(), bus: busMuet, ...sur });
  const ligneDistanteDe = async (db, texte, cle = H('7')) => {
    const copie = octets(texte); const shaC = await sha256Hex(copie);
    await db.mutate({ puts: { files: [{ sha256: cle, mime: 'image/jpeg', size: 9, updated_at: DATE, remote: R({ sha256: shaC, size: copie.size }) }] }, origin: 'remote' });
    return { copie, chemin: 'u1/' + shaC };
  };

  await run('moteur sans stockage : L3 telle quelle, clés L4 au repos', async () => {
    await withRepo(async (repo, db) => {
      const m = moteurDe(db);
      const phases = []; m.onEtat((e) => phases.push(e.phase));
      const e0 = m.etat();
      const fin = await m.executer('t');
      eq([e0.fichiers, e0.progressionFichiers, e0.espaceServeur, e0.telechargementGlobal, e0.pauseFichiers, fin.derniersEffets.fichiersRecus, phases.includes('fichiers'), Object.isFrozen(fin.fichiers), await m.telecharger([H('a')])],
        [{ aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0, aRenvoyer: 0 }, null, null, false, null, 0, false, true, { rien: true }],
        'moteur sans stockage : les clés L4 existent à leur valeur de repos, figées ; aucune phase fichiers ; fichiersRecus toujours présent (§ 3.6) ; une tape ne fait rien');
      await m.arreter();
    });
  });

  await run('moteur avec stockage : phases, compte final, espace, planifier', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const s = await poserPhoto(repo, db, 'moteur-1');
      const tf = creerTransportFactice({ serveur: true });
      const m = moteurDe(db, { transport: tf, stockage: creerStockageFactice(), reduire: reducteur().reduire, delaiRegroupementMs: 1 });
      const phases = []; m.onEtat((e) => { if (e.phase && phases.at(-1) !== e.phase) phases.push(e.phase); });
      const fin = await m.executer('t');
      const phasesDeLaPasse = [...phases]; // relevées AVANT tout await : la passe suivante (planifier, 1 ms) en ajouterait
      eq([phasesDeLaPasse, fin.fichiers.aEnvoyer, fin.espaceServeur?.objets, (await db.get('sync_state', 'storage_usage'))?.value?.objets, fin.progressionFichiers], [['envoi_initial', 'envoi', 'reception', 'fichiers'], 0, 1, 1, null],
        'moteur : envoi initial → envoi → réception → fichiers ; fin.fichiers recompté (le snapshot mis à jour) ; espace mesuré après une confirmation ; progression retirée en fin de passe');
      let partie = false;
      for (let i = 0; i < 300 && !(partie = (await db.count('outbox')) === 0 && !!tf.ligne('files', s)); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([partie, tf.ligne('files', s)?.data?.remote?.sha256, 'blob' in (tf.ligne('files', s)?.data || {})], [true, await empreinte('jpeg-1'), false], 'moteur : confirmes > 0 → planifier() — la ligne files part à la passe suivante, sans blob (mutant : planifier non appelé → l’entrée attend)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      for (let i = 0; i < 21; i += 1) await poserPhoto(repo, db, 'reprise' + i);
      const minuteries = []; const vrai = globalThis.setTimeout;
      globalThis.setTimeout = (fn, ms, ...reste) => { minuteries.push(ms); return vrai(fn, ms, ...reste); };
      let m = null;
      try { m = moteurDe(db, { stockage: creerStockageFactice(), reduire: reducteur().reduire, delaiRegroupementMs: 50000 }); await m.executer('t'); }
      finally { globalThis.setTimeout = vrai; }
      ok(minuteries.includes(1000), 'moteur : restants > 0 sans erreur, page visible → reprise programmée à 1 s (mutant : pas de reprise)');
      await m.arreter();
    });
  });

  await run('moteur : arrêt pendant la passe, pauses, sans compte', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      for (let i = 0; i < 3; i += 1) await poserPhoto(repo, db, 'arret' + i);
      let m = null;
      const sf = creerStockageFactice({ avant: async (methode) => { if (methode === 'envoyer') m.arreter(); } }); // jamais attendu ici : arreter() attend la passe
      m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire });
      await m.executer('t');
      eq(sf.journal.filter((j) => j.methode === 'envoyer').length, 1, 'moteur : arreter() pendant la passe → stop() vrai, aucun envoi de plus');
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'en-pause');
      await repo.save('books', { id: 'bP', title: 'Part quand même' });
      await db.mutate({ puts: { sync_state: [{ key: 'pause_fichiers', value: { raison: 'stockage', at: DATE } }] }, origin: 'device' });
      const tf = creerTransportFactice({ serveur: true }); const sf = creerStockageFactice();
      const m = moteurDe(db, { transport: tf, stockage: sf, reduire: reducteur().reduire });
      const fin = await m.executer('t');
      eq([tf.journal.some((j) => j.appel === 'pousser' && j.rows.some((r) => r.id === 'bP')), sf.journal.length, fin.pauseFichiers?.raison], [true, 0, 'stockage'], 'moteur (B-5, S-4) : pause_fichiers posée → les fiches partent, la passe fichiers n’est pas tentée (mutant : passe fichiers tentée)');
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: DATE } }] }, origin: 'device' });
      await m.envoyerMaintenant();
      eq([await db.get('sync_state', 'pause'), await db.get('sync_state', 'pause_fichiers'), m.etat().pause, m.etat().pauseFichiers], [undefined, undefined, null, null], 'envoyerMaintenant : lève pause ET pause_fichiers');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      // § 7 « pause (L3) posée » avec un stockage : l'envoi des fiches est sauté comme en L3 ; la passe fichiers, elle, tourne — le seau a son
      // propre quota (D-G4) : les octets montent, la ligne confirmée attend en file la levée de la pause (doute 14, ratifié par P3 : le stockage
      // n'est pas le quota des fiches).
      await toutDejaEnvoye(db);
      const s = await poserPhoto(repo, db, 'pause-l3');
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: DATE } }] }, origin: 'device' });
      const tf = creerTransportFactice({ serveur: true }); const sf = creerStockageFactice();
      const m = moteurDe(db, { transport: tf, stockage: sf, reduire: reducteur().reduire });
      const fin = await m.executer('t');
      eq([tf.journal.filter((j) => j.appel === 'pousser').length, sf.journal.filter((j) => j.methode === 'envoyer').length, !!(await db.get('files', s)).remote, (await db.getAll('outbox')).filter((e) => e.store === 'files').map((e) => e.id), fin.pause?.raison],
        [0, 1, true, [s], 'quota'], 'moteur (pause L3 + stockage, P3 ratifié) : aucun pousser (comme en L3) ; la passe fichiers envoie et confirme ; la ligne files attend en file la levée de la pause (mutants : push appelé malgré la pause ; passe fichiers sautée sous pause)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'sans-compte');
      const sf = creerStockageFactice();
      const m = moteurDe(db, { getUserId: () => null, stockage: sf, reduire: reducteur().reduire });
      await m.executer('t');
      eq(sf.journal.length, 0, 'moteur : sans compte, la passe fichiers ne tente rien');
      await m.arreter();
    });
  });

  await run('moteur : vols tenus — tape puis arrêt (D-G13, B-9)', async () => {
    await withRepo(async (repo, db) => {
      const { copie, chemin } = await ligneDistanteDe(db, 'copie-tape');
      let lacher = null; const tenu = new Promise((r) => { lacher = r; });
      const sf = creerStockageFactice({ objets: { [chemin]: copie }, avant: async (methode) => { if (methode === 'recevoir') await tenu; } });
      const m = moteurDe(db, { stockage: sf });
      const tape = m.telecharger([H('7')]);
      await new Promise((r) => setTimeout(r, 0));
      let arretFini = false;
      const arret = m.arreter().then(() => { arretFini = true; });
      await new Promise((r) => setTimeout(r, 20));
      const avantLacher = arretFini;
      lacher();
      await arret;
      const ecrite = await db.get('files', H('7'));
      const apres = await m.telecharger([H('7')]);
      eq([avantLacher, (await tape).recus, ecrite.blob instanceof Blob, apres, sf.journal.filter((j) => j.methode === 'recevoir').length], [false, 1, true, { erreur: { type: 'arrete' } }, 1],
        'D-G13 : arreter() ne se résout qu’après le téléchargement lancé par une tape ; après l’arrêt, telecharger rend { erreur: arrete } sans appel (mutant : vol non tenu → arreter() rendu avant l’écriture)');
      eq([await m.actualiserEspace(), await m.telechargerTout(), await m.reessayerFichier(H('7'))], [{ erreur: { type: 'arrete' } }, { erreur: { type: 'arrete' } }, { erreur: { type: 'arrete' } }], 'D-G13 : après l’arrêt, actualiserEspace, telechargerTout et reessayerFichier ne font rien');
    });
  });

  await run('moteur : une lecture de files par passe (S-12)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'snap');
      const m = moteurDe(db, { stockage: creerStockageFactice(), reduire: reducteur().reduire });
      const lectures = []; const vrai = db.getSnapshot;
      db.getSnapshot = function (noms) { lectures.push(noms); return vrai.call(this, noms); };
      try { await m.executer('t'); } finally { delete db.getSnapshot; }
      eq(lectures.filter((n) => (n || []).includes('files')).length, 1, 'S-12 : UNE lecture de files par passe, réutilisée par envoyer, telechargerTout et le compte final (mutant : compter relit)');
      await m.arreter();
    });
  });

  await run('moteur : gestes des fichiers (réessayer, télécharger tout, espace, dernier échange)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const { copie, chemin } = await ligneDistanteDe(db, 'copie-reessai');
      await db.mutate({ puts: { sync_state: [{ key: 'file_error:' + H('7'), value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { [chemin]: copie } });
      const m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire });
      const r = await m.reessayerFichier(H('7'));
      eq([r.recus, await db.get('sync_state', 'file_error:' + H('7')), (await db.get('files', H('7'))).blob instanceof Blob, !!m.etat().dernierEchange], [1, undefined, true, true], 'reessayerFichier (réception) : la clé retirée, puis le téléchargement ; un téléchargement abouti compte pour « Dernier échange » (I5 ; mutant : stockage hors du compteur)');
      const s = await poserPhoto(repo, db, 'reessai-envoi');
      await db.mutate({ puts: { sync_state: [{ key: 'file_error:' + s, value: { motif: 'type', sens: 'envoi', at: DATE } }] }, origin: 'device' });
      await m.reessayerFichier(s);
      eq([await db.get('sync_state', 'file_error:' + s), !!(await db.get('files', s)).remote], [undefined, true], 'reessayerFichier (envoi) : la clé retirée, puis une passe — la photo part');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const objets = {}; const pages = [];
      for (let i = 0; i < 3; i += 1) {
        const { copie, chemin } = await ligneDistanteDe(db, 'tout-' + i, H(String(i + 1)));
        objets[chemin] = copie; pages.push({ id: 'pt' + i, sha256: H(String(i + 1)), updated_at: DATE });
      }
      await db.mutate({ puts: { source_pages: pages }, origin: 'device' });
      let m = null;
      const sf = creerStockageFactice({ objets, avant: async (methode) => { if (methode === 'recevoir' && sf.journal.filter((j) => j.methode === 'recevoir').length === 1) await m.arreterTelechargement(); } });
      m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire });
      await m.telechargerTout();
      eq([sf.journal.filter((j) => j.methode === 'recevoir').length, await db.get('sync_state', 'telecharger_tout'), m.etat().telechargementGlobal], [1, undefined, false], 'telechargerTout puis « Arrêter le téléchargement » pendant : arrêt au fichier suivant, clé retirée');
      await m.telechargerTout();
      eq([sf.journal.filter((j) => j.methode === 'recevoir').length, (await Promise.all([H('1'), H('2'), H('3')].map((k) => db.get('files', k)))).every((l) => l.blob instanceof Blob), await db.get('sync_state', 'telecharger_tout'), m.etat().derniersEffets.fichiersRecus], [3, true, undefined, 2], 'telechargerTout : la reprise télécharge le reste, la clé tombe quand plus rien ne manque ; derniersEffets.fichiersRecus compte les pages arrivées');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      const sf = creerStockageFactice({ objets: { ['u1/' + H('a')]: octets('abc') } });
      const m = moteurDe(db, { stockage: sf });
      const vues = []; const vrai = db.mutate;
      db.mutate = function (a) { vues.push(a); return vrai.call(this, a); };
      try { await m.actualiserEspace(); } finally { delete db.mutate; }
      eq([m.etat().espaceServeur?.octets, (await db.get('sync_state', 'storage_usage'))?.value?.objets, vues.find((v) => (v.puts?.sync_state || []).some((l) => l.key === 'storage_usage'))?.origin], [3, 1, 'device'], 'actualiserEspace : storage_usage écrit (origine device), espaceServeur posé');
      const m2 = moteurDe(db, { stockage: { ...sf, lister: async () => ({ objets: [], erreur: { type: 'reseau', status: 0, statusCode: null, code: null, message: 'x' } }) } });
      await sansConsole(() => m2.actualiserEspace());
      eq((await db.get('sync_state', 'storage_usage'))?.value?.objets, 1, 'actualiserEspace : une erreur reseau laisse storage_usage inchangé');
      await m.arreter(); await m2.arreter();
    });
  });

  await run('rendu après une passe et câblage de app.js', async () => {
    const S = await import('../src/ui/state.js');
    const effets = (fichiersRecus) => ({ enCours: false, derniersEffets: { recues: 0, supprimees: 0, ajustes: 0, conflits: 0, fichiersRecus } });
    eq([S.passeAEcrit({ avant: true, etat: effets(2) }), S.passeAEcrit({ avant: true, etat: effets(0) })], [true, false], 'passeAEcrit : une page arrivée redessine la fiche affichée (fichiersRecus)');
    const app = await lire('../src/app.js');
    ok(app.length > 1000 && /stockage: createStockage\(client\)/.test(app) && /qualite: qualiteEnvoi/.test(app), 'app.js (lu au source, admis : jamais importé) : le moteur reçoit stockage: createStockage(client) et qualite: qualiteEnvoi');
  });
```

- [ ] **Step 2 : rouge lu** (les blocs « moteur … » rouges : clés L4 absentes de l'état, `m.telecharger` n'existe pas ; les deux `derniersEffets`
  de `tests/sync-l3.js` rouges). **Mesuré au rejeu** : 4132/4146, quatorze rouges — les deux lignes I-G9 l. 1703 et 1708, onze du lot G, l'épingle.

- [ ] **Step 3 : implémenter `src/sync/moteur.js`.** Import : `import { createFichiers, compterFichiers, lireErreursFichiers, MAGASINS_FICHIERS } from
  './fichiers.js';`. En tête :

```js
// Lot G (§ 3.6) : les compteurs de fichiers au repos — toujours présents, à zéro tant qu'aucune passe n'a compté.
const FICHIERS_AU_REPOS = Object.freeze({ aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0, aRenvoyer: 0 });
// D-G13 : la réponse de toute API de fichiers appelée après arreter() — sans appel, sans écriture.
const ARRETE = Object.freeze({ erreur: Object.freeze({ type: 'arrete' }) });
```

  `AU_REPOS` gagne `fichiers: FICHIERS_AU_REPOS, progressionFichiers: null, espaceServeur: null, telechargementGlobal: false, pauseFichiers: null` ;
  `instantane` fige aussi `fichiers`, `progressionFichiers`, `espaceServeur`, `pauseFichiers` (`fige(etat.x)`). Paramètres de `createMoteur` :
  `stockage = null, qualite = () => 'reduite', reduire = null`. Après `compte` :

```js
  // Le stockage passe par le même compteur que le transport : un envoi ou un téléchargement abouti date « Dernier échange » (I5).
  const compteStockage = stockage ? {
    async envoyer(chemin, blob, options) { const r = await stockage.envoyer(chemin, blob, options); if (!r.erreur) appelsReussis += 1; return r; },
    async recevoir(chemin) { const r = await stockage.recevoir(chemin); if (!r.erreur) appelsReussis += 1; return r; },
    async lister(prefixe, options) { const r = await stockage.lister(prefixe, options); if (!r.erreur) appelsReussis += 1; return r; },
  } : null;
  // Sans stockage (suites L3, appareil sans client), aucune passe fichiers : le moteur est exactement celui de L3.
  const fichiers = compteStockage ? createFichiers({ db, stockage: compteStockage, getUserId, qualite, maintenant, ...(reduire ? { reduire } : {}) }) : null;
  const vols = new Set(); // D-G13 : téléchargements par tape et mesures d'espace — arreter() les attend tous, avec la passe
  let generationTelechargement = 0; // « Arrêter le téléchargement » : la passe en vol s'arrête à son prochain fichier

  const lirePauseFichiers = async () => (await db.get('sync_state', 'pause_fichiers'))?.value || null;
  async function etatFichiers(snapshot = null) {
    const snap = snapshot ?? await db.getSnapshot(MAGASINS_FICHIERS);
    return compterFichiers(snap, { uid: getUserId(), erreurs: await lireErreursFichiers(db) });
  }
  async function appliquerEspace(r) {
    if (!r || r.erreur) { if (r?.erreur) logError('sync.fichiers.espace', { reason: r.erreur.type, status: r.erreur.status }); return r; }
    if (arrete) return ARRETE; // rien ne s'écrit après l'arrêt
    const valeur = { octets: r.octets, objets: r.objets, at: r.at, tronque: r.tronque };
    await db.mutate({ puts: { sync_state: [{ key: 'storage_usage', value: valeur }] }, origin: 'device' });
    poser({ espaceServeur: valeur });
    return valeur;
  }
  function tenir(promesse) {
    vols.add(promesse);
    promesse.then(() => vols.delete(promesse), () => vols.delete(promesse));
    return promesse;
  }
```

  `charger()` : avant le `poser`, si `fichiers` : `pauseFichiers: await lirePauseFichiers()`, `espaceServeur: (await db.get('sync_state',
  'storage_usage'))?.value || null`, `telechargementGlobal: !!(await db.get('sync_state', 'telecharger_tout'))`, `fichiers: await etatFichiers()`
  (ajoutés au même `poser`).

  `passe()` : déclarer `let bilanFichiers = null; let bilanTelechargement = null; let snapshotFichiers = null;` avec les autres bilans ; après le bloc de
  réception (avant `toucherEchange`) :

```js
      // Lot G (§ 4.7) : après la réception, seulement avec un stockage, hors pause_fichiers et sans envoi bloqué. Les fiches sont parties AVANT.
      if (fichiers && !envoiBloque && !arrete) {
        const pauseF = await lirePauseFichiers();
        poser({ pauseFichiers: pauseF });
        if (!pauseF) {
          poser({ phase: 'fichiers', progression: null });
          snapshotFichiers = await db.getSnapshot(MAGASINS_FICHIERS); // UNE lecture par passe (S-12)
          const surProgression = (p) => poser({ progressionFichiers: p });
          bilanFichiers = await fichiers.envoyer({ stop: () => arrete, surProgression, snapshot: snapshotFichiers });
          const bloque = bilanFichiers.attenteConnexion || bilanFichiers.pauseFichiers || !!bilanFichiers.erreur;
          if (!bloque && !arrete && await db.get('sync_state', 'telecharger_tout')) {
            const g = generationTelechargement;
            bilanTelechargement = await fichiers.telechargerTout({ stop: () => arrete || g !== generationTelechargement, surProgression, snapshot: snapshotFichiers });
          }
          poser({ progressionFichiers: null });
          if (!arrete && (bilanFichiers.confirmes > 0 || !(await db.get('sync_state', 'storage_usage')))) await appliquerEspace(await fichiers.mesurerEspace());
          const erreurFichiers = bilanFichiers.erreur || bilanTelechargement?.erreur || null;
          if (bilanFichiers.attenteConnexion) poser({ attenteConnexion: true });
          if (bilanFichiers.pauseFichiers) poser({ pauseFichiers: await lirePauseFichiers() });
          else if (erreurFichiers) poser({ derniereErreur: { type: erreurFichiers.type } });
          if (bilanFichiers.recul) programmerReprise(bilanFichiers.recul);
          else if (!erreurFichiers && (bilanFichiers.restants > 0 || bilanTelechargement?.restants > 0) && fenetre.document?.visibilityState !== 'hidden') programmerReprise(1000);
          if (bilanFichiers.confirmes > 0) planifier(); // les lignes confirmées partent à la passe suivante
        }
      }
```

  Dans le `finally`, après `fin = await compter()` :

```js
      if (fichiers) {
        try {
          fin.fichiers = await etatFichiers(snapshotFichiers); // le snapshot de la passe, mis à jour par envoyer/telechargerTout ; lu une fois sinon
          fin.telechargementGlobal = !!(await db.get('sync_state', 'telecharger_tout'));
          fin.progressionFichiers = null;
        } catch (error) { logError('sync.passe', { error, reason: 'fichiers illisibles' }); }
      }
```

  et `derniersEffets` gagne `fichiersRecus: bilanTelechargement?.recus || 0` (toujours présent, forme fixe). `envoyerMaintenant` :

```js
  async function envoyerMaintenant() {
    const aLever = [];
    if (await lirePause()) aLever.push('pause');
    if (await lirePauseFichiers()) aLever.push('pause_fichiers'); // B-5 : le geste lève aussi la pause du seau
    if (aLever.length) { await db.mutate({ deletes: { sync_state: aLever }, origin: 'device' }); poser({ pause: null, pauseFichiers: null }); }
    if (vol) await vol;
    return executer('manuel');
  }
```

  Les API (avant `demarrer`) :

```js
  // D-G13 : tout ce qu'une tape lance entre dans `vols` ; après arreter(), rien n'appelle et rien n'écrit.
  function telecharger(shas) {
    if (arrete) return Promise.resolve(ARRETE);
    if (!fichiers) return Promise.resolve({ rien: true });
    return tenir((async () => {
      const avant = appelsReussis;
      const r = await fichiers.telecharger(Array.isArray(shas) ? shas : [], { stop: () => arrete });
      if (!arrete) {
        if (appelsReussis > avant) await toucherEchange();
        poser({ fichiers: await etatFichiers() });
      }
      return r;
    })());
  }
  async function telechargerTout() {
    if (arrete) return ARRETE;
    if (!fichiers) return { rien: true };
    await db.mutate({ puts: { sync_state: [{ key: 'telecharger_tout', value: { at: new Date(maintenant()).toISOString() } }] }, origin: 'device' });
    poser({ telechargementGlobal: true });
    if (vol) await vol; // une passe déjà en vol a pu lire la clé avant qu'elle existe : la suivante la lira
    return executer('telechargement');
  }
  async function arreterTelechargement() {
    generationTelechargement += 1; // la passe en vol s'arrête à son prochain fichier (stop relit la génération)
    if (arrete) return ARRETE;
    await db.mutate({ deletes: { sync_state: ['telecharger_tout'] }, origin: 'device' });
    poser({ telechargementGlobal: false });
    return instantane();
  }
  function actualiserEspace() {
    if (arrete) return Promise.resolve(ARRETE);
    if (!fichiers) return Promise.resolve({ rien: true });
    return tenir((async () => appliquerEspace(await fichiers.mesurerEspace()))()); // hors passe : lister ne touche pas la base avant la fin
  }
  async function renvoyerEnOriginale() {
    if (arrete) return ARRETE;
    if (!fichiers) return { rien: true };
    await db.mutate({ puts: { sync_state: [{ key: 'renvoi_originale', value: { at: new Date(maintenant()).toISOString() } }] }, origin: 'device' });
    if (vol) await vol;
    return executer('renvoi');
  }
  async function reessayerFichier(sha256) {
    if (arrete) return ARRETE;
    const cle = 'file_error:' + sha256;
    const ligne = await db.get('sync_state', cle);
    if (!ligne) return { rien: true };
    await db.mutate({ deletes: { sync_state: [cle] }, origin: 'device' });
    if (ligne.value?.sens === 'reception') return telecharger([sha256]);
    if (vol) await vol;
    return executer('reessai');
  }
```

  `arreter()` rend `Promise.allSettled([vol, ...vols].filter(Boolean)).then(() => instantane())` (au lieu de `vol || Promise.resolve(instantane())`) ;
  l'objet rendu gagne `telecharger, telechargerTout, arreterTelechargement, actualiserEspace, renvoyerEnOriginale, reessayerFichier`.

- [ ] **Step 4 : `src/ui/state.js`** : `passeAEcrit` rend aussi vrai pour `(effets.fichiersRecus > 0)`. **`src/app.js`** : `import { createTransport,
  createStockage } from './sync/transport.js';`, `qualiteEnvoi` ajouté à l'import de `./ui/state.js`, et dans `demarrerMoteur` : `createMoteur({ db:
  repo.db, transport: createTransport(client), stockage: createStockage(client), qualite: qualiteEnvoi, getUserId: …, … })` (R53 : le client ne
  sort de `app.js` que vers `transport.js`).
- [ ] **Step 5 : vert** — les suites L3 passent telles quelles (le moteur sans `stockage` est celui de L3, aux deux `derniersEffets` amendés au
  Step 1 près : rouges au Step 2, verts ici). Épingle relevée ; Node et `--check` inchangés. `sw.js` : `VERSION = 'cuisine-os-v0.11.0-4'`.
  **Mesuré au rejeu** : seule l'épingle rouge (obtenu 4153), puis 4154/4154 (épingle 4153) ; Node 174 ; `--check` 0.
- [ ] **Step 6 : invisibles** (Python).
- [ ] **Step 7 : commit** `Moteur L4 : phase fichiers apres la reception, un snapshot par passe, vols tenus par arreter, gestes de fichiers, pause du seau distincte (lot G, tache 4)`.

---

### Task 5 : Réglages → Synchronisation, ensemble L4 (spec § 4.1, § 4.10, § 5, R-G-5, B-15, B-21, B-22, S-11)

**Files:**
- Modify: `src/ui/settings.js` (`syncSectionModel` : trois paramètres `fichiersErreurs = []`, `qualite = 'reduite'`, `snapshot = null` et quatre clés
  rendues `fichiers`, `espace`, `qualite`, `erreursFichiers` — seulement avec un compte établi ET un moteur ; `syncSectionL4(model, gestes,
  { choisirQualite })` ; `SYNC_L4_ACTIONS` ; `gestesL4Pour` ; `MOTIFS_FICHIER`, `motifFichier(motif, sens)` ; `renderSettings` lit les
  `file_error` et le snapshot quand un moteur existe ; `syncSection` ajoute l'ensemble L4 après L3 ; `effacerDonnees` et `changerDeCompte`
  gagnent `transfertEnCours` ; la phrase de `pause` de L3 perd « (1 Go au palier gratuit) », P2)
- Modify: `src/i18n/en.js` (vingt-huit chaînes neuves, plus l'entrée de la pause L3 remplacée — P2), `tests/ajouter.js`
  (`CHAINES_NEUVES_AILLEURS['../src/ui/settings.js']` complété : vingt-neuf clés), `tests/sync-l3.js` (l. 1237 et 1326 réécrites, I-G9 — P2),
  `tests/sync-l4.js` (bloc tâche 5), `sw.js` (`VERSION -5`), `tests/tests.js` (total)

**Interfaces:**
- Consumes : état du moteur (tâche 4 : `fichiers`, `progressionFichiers`, `espaceServeur`, `telechargementGlobal`, `pauseFichiers`) ; API
  `telechargerTout`, `arreterTelechargement`, `actualiserEspace`, `renvoyerEnOriginale`, `reessayerFichier` ; `referencesFichiers`,
  `nomFichier` (tâche 1) ; `lireErreursFichiers`, `MAGASINS_FICHIERS` (tâche 3).
- Produces : `syncSectionModel({ …, fichiersErreurs: [{ sha256, motif, sens }], qualite, snapshot })` → avec moteur : `fichiers = { aEnvoyer,
  envoi, pause, aTelecharger, telechargerTout, reception, arreter, renvoi, refuses, typeInconnu, copiesSansServeur, copiesPerimees }` (des
  phrases, ou `null` / booléen pour `arreter`), `espace` (une phrase), `qualite` (`'reduite' | 'originale'`), `erreursFichiers = [{ sha256, texte,
  reessayer }]` ; sans moteur, **exactement** le modèle de L3. `syncSectionL4(model, gestes = {}, { choisirQualite } = {}) → Node[]` (vide sans
  `model.fichiers`). `SYNC_L4_ACTIONS = ['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerOriginale', 'reessayerFichier']`.
  `gestesL4Pour({ obtenirMoteur, dire, rafraichir, journaliser })` (le `db` de la signature de § 4.1 n'est pas repris : aucun geste L4 n'écrit
  hors du moteur — doute 9). `motifFichier(motif, sens) → phrase`. `effacerDonnees({ …, transfertEnCours })`, `changerDeCompte({ …,
  transfertEnCours })`. `syncSectionModel(…).pause` (L3, `raison: 'quota'`) = « Espace serveur plein — rien n’est perdu, tout reste sur cet
  appareil. » (P2 : plus de palier).

- [ ] **Step 1 : tests rouges.** D'abord, dans `tests/sync-l3.js`, les deux lignes ≈ 1237 et 1326 REMPLACÉES mot pour mot (I-G9, rév. 3 —
  P2 ; rouges jusqu'au Step 3 : le modèle de L3 rend encore « Espace serveur plein (1 Go au palier gratuit) — … ») :

```js
// tests/sync-l3.js ≈ l. 1237 (bloc « réglages L3 » ; m4 = modèle avec pause de quota)
  eq(m4.pause, 'Espace serveur plein — rien n’est perdu, tout reste sur cet appareil.', 'réglages L3 : pause quota nommée (rien n’est perdu), sans palier ni plan : l’app ne connaît pas le plan du projet (R-G-5, lot G)');
// tests/sync-l3.js ≈ l. 1326 (rendu de syncSectionL3(m4) : la carte .warn porte la phrase seule)
    eq(boite.querySelector('.warn')?.textContent, 'Espace serveur plein — rien n’est perdu, tout reste sur cet appareil.', 'rendu L3 : la pause de quota est un avertissement visible, sans palier (R-G-5, lot G)');
```

  Puis, à la fin du corps de `runSyncL4Tests` :

```js
  // === Tâche 5 — Réglages, ensemble L4 (§ 4.1, § 4.10, R-G-5)
  const SR = await import('../src/ui/settings.js');
  const baseL4 = { available: true, user: { id: 'u1', email: 'x@exemple.invalid' }, guard: { ok: true }, pending: 0 };
  const fichiersL4 = (sur = {}) => ({ aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0, aRenvoyer: 0, ...sur });
  const moteurL4 = (sur = {}) => ({ enCours: false, phase: null, progression: null, dernierEchange: null, aEnvoyer: 0, enQuarantaine: 0, conflits: 0, pause: null, attenteConnexion: false, horloge: null, derniereErreur: null, derniersEffets: null, fichiers: fichiersL4(), progressionFichiers: null, espaceServeur: null, telechargementGlobal: false, pauseFichiers: null, ...sur });
  const modele = (moteur, sur = {}) => SR.syncSectionModel({ ...baseL4, moteur, ...sur });
  const rendre = (model, gestes = {}, options = {}) => { const boite = document.createElement('div'); for (const n of SR.syncSectionL4(model, gestes, options)) boite.append(n); return boite; };
  const boutons = (boite) => [...boite.querySelectorAll('button')].map((b) => b.textContent);
  const snapNoms = { books: [{ id: 'b1', title: 'Mon livre' }], book_editions: [{ id: 'e1', book_id: 'b1', cover_sha256: H('3') }], source_documents: [{ id: 'd1', edition_id: 'e1', sha256: H('1') }], source_pages: [{ id: 'p1', document_id: 'd1', sha256: H('1'), printed_page: 12 }], recipes: [{ id: 'r1', original_title: 'Tarte', photo_sha256: H('4') }], imports: [], files: [] };

  await run('Réglages L4 : rendu réel (§ 4.1)', async () => {
    eq(Object.keys(modele(null, { fichiersErreurs: [{ sha256: H('1'), motif: 'type', sens: 'envoi' }], qualite: 'originale', snapshot: snapNoms })).sort(), ['buttons', 'lines', 'title'], 'Réglages L4 : sans moteur, le modèle est celui de L2/L3 — pas une clé de plus');
    eq([SR.syncSectionL4(modele(null)), SR.syncSectionL4(SR.syncSectionModel({ available: true, guard: { ok: false, message: 'x' }, moteur: moteurL4() }))], [[], []], 'Réglages L4 : sans moteur ou sans compte établi, rien de rendu');
    const b1 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aEnvoyer: 3 }), progressionFichiers: { sens: 'envoi', n: 2, total: 3 } })));
    ok(b1.textContent.includes('Photos à envoyer : 3') && b1.textContent.includes('Envoi des photos : 2/3'), 'L4 : « Photos à envoyer : 3 » et la progression d’envoi');
    const b2 = rendre(modele(moteurL4({ pauseFichiers: { raison: 'stockage', at: DATE } })));
    eq(b2.querySelector('.card.warn')?.textContent, 'Espace photos plein sur le serveur : les photos attendent sur cet appareil, les fiches continuent de partir.', 'L4 : seau plein → la phrase en card warn, sans aucun chiffre de plan (R-G-5)');
    const quatre = 4 * 419430; // 1 677 720 octets → « 1,6 Mo »
    const b3 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 4, octetsATelecharger: quatre }) })), { telechargerTout: () => {} });
    eq([b3.textContent.includes('Pages à télécharger : 4 (~1,6 Mo)'), boutons(b3).includes('Télécharger toutes les pages (4 fichiers, ~1,6 Mo)')], [true, true], 'L4 : 4 pages, ~1,6 Mo → la ligne et le bouton');
    const b4 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 4, octetsATelecharger: quatre }), telechargementGlobal: true, progressionFichiers: { sens: 'reception', n: 1, total: 4 } })), { telechargerTout: () => {}, arreterTelechargement: () => {} });
    eq([boutons(b4).includes('Arrêter le téléchargement'), boutons(b4).some((b) => b.startsWith('Télécharger toutes')), b4.textContent.includes('Téléchargement des pages : 1/4')], [true, false, true], 'L4 : pendant le téléchargement global → « Arrêter le téléchargement » et la progression');
    const espace = { octets: 850 * 1048576, objets: 312, at: DATE, tronque: false };
    const b5 = rendre(modele(moteurL4({ espaceServeur: espace })), { actualiserEspace: () => {} });
    eq([b5.textContent.includes('Tes photos sur le serveur : 850 Mo (312 fichiers)'), b5.querySelectorAll('progress').length, /Go|palier|\$/.test(b5.textContent), boutons(b5).includes('Actualiser')], [true, 0, false, true],
      'L4 (R-G-5) : « Tes photos sur le serveur : 850 Mo (312 fichiers) », aucun <progress>, ni « Go », ni « palier », ni « $ » (mutants : barre ou phrase de palier réintroduite ; objets ignoré → « (0 fichiers) »)');
    eq([rendre(modele(moteurL4({ espaceServeur: { ...espace, tronque: true } }))).textContent.includes('au moins 850 Mo (312 fichiers)'), rendre(modele(moteurL4())).textContent.includes('Espace serveur : pas encore mesuré.')], [true, true], 'L4 : tronque → « au moins … » ; sans mesure → « pas encore mesuré »');
    const choix = [];
    const b6 = rendre(modele(moteurL4()), {}, { choisirQualite: (v) => choix.push(v) });
    const seg = b6.querySelector('.segmented');
    const actif = seg?.querySelector('button.active')?.textContent;
    [...seg.querySelectorAll('button')].find((b) => b.textContent === 'Originale').click();
    eq([actif, seg.closest('label'), !!seg.closest('.field'), choix], ['Réduite (≈ 400 Ko, 2 000 px)', null, true, ['originale']], 'L4 : segmented « Réduite » actif, HORS de tout <label> (R-UX-8, B-15), habillé .field ; un clic sur « Originale » choisit originale');
    const r1 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aRenvoyer: 2 }) }), { qualite: 'originale' }), { renvoyerOriginale: () => {} });
    const r2 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aRenvoyer: 2 }) }), { qualite: 'reduite' }), { renvoyerOriginale: () => {} });
    eq([boutons(r1).includes('Renvoyer en originale les 2 photos de cet appareil envoyées en réduite'), boutons(r2).some((b) => b.startsWith('Renvoyer'))], [true, false], 'L4 : « Renvoyer en originale … » seulement en Originale avec des candidates (B-21)');
    const errs = [{ sha256: H('1'), motif: 'introuvable', sens: 'reception' }, { sha256: H('3'), motif: 'trop_gros', sens: 'envoi' }, { sha256: H('4'), motif: 'nouveau-motif', sens: 'envoi' }, { sha256: H('9'), motif: 'type', sens: 'envoi' }];
    const vus = [];
    const b8 = rendre(modele(moteurL4({ fichiers: fichiersL4({ enErreur: 3 }) }), { fichiersErreurs: errs, snapshot: snapNoms }), { reessayerFichier: (sha) => vus.push(sha) });
    const lignes = [...b8.querySelectorAll('[data-fichier]')];
    eq([b8.textContent.includes('Fichiers refusés : 3'), lignes.map((l) => l.querySelector('p').textContent), lignes.map((l) => l.querySelectorAll('button').length)],
      [true, ['Page 12 · Mon livre — Ce fichier n’est plus sur le serveur.', 'Couverture · Mon livre — Plus de 50 Mo : ce fichier reste sur cet appareil seulement.', 'Photo du plat · Tarte — Fichier refusé'], [1, 0, 1]],
      'L4 : une ligne par file_error d’une ligne RÉFÉRENCÉE (H9, orpheline, n’est pas dite), nommée par nomFichier (I-G8), motif en phrase, motif inconnu → « Fichier refusé » ; trop_gros sans « Réessayer » (B-22 ; mutant : bouton rendu)');
    lignes[0].querySelector('button').click();
    eq(vus, [H('1')], 'L4 : « Réessayer » appelle gestes.reessayerFichier(sha256)');
    const b9 = rendre(modele(moteurL4({ fichiers: fichiersL4({ typeInconnu: 1, copiesSansServeur: 1, copiesPerimees: 1 }) })));
    ok(['1 fichier(s) de type inconnu ne seront pas synchronisés.', '1 copie(s) de photos ici dont le serveur n’a plus trace : l’appareil qui a l’original les renverra.', '1 photo(s) ici sont une copie plus ancienne que celle du serveur.'].every((p) => b9.textContent.includes(p)), 'L4 : type inconnu, copies sans serveur, copies périmées — leurs phrases (§ 4.1 items 7 et 8)');
    eq([SR.motifFichier('type', 'envoi'), SR.motifFichier('type', 'reception'), SR.motifFichier('forme', 'reception'), SR.motifFichier('__proto__', 'envoi')], ['Type de fichier refusé par le serveur.', 'Fichier illisible reçu du serveur.', 'Ligne de fichier mal formée reçue du serveur.', 'Fichier refusé'], 'motifFichier (§ 4.10) : le motif ET le sens décident la phrase ; un jeton inconnu ou hostile → « Fichier refusé », jamais le jeton');
    // R-G-5 et I-G8 sur un rendu où TOUTES les branches sont actives (pause, à télécharger, téléchargement global, renvoi, refusés, phrases),
    // pas sur le seul rendu de l'espace : une phrase de palier dans la carte pause ou le renvoi resterait verte sinon.
    const toutes = rendre(modele(moteurL4({ fichiers: fichiersL4({ aEnvoyer: 2, aTelecharger: 4, octetsATelecharger: quatre, aRenvoyer: 2, enErreur: 3, typeInconnu: 1, copiesSansServeur: 1, copiesPerimees: 1 }), progressionFichiers: { sens: 'reception', n: 1, total: 4 }, telechargementGlobal: true, pauseFichiers: { raison: 'stockage', at: DATE }, espaceServeur: { ...espace, tronque: true } }), { qualite: 'originale', fichiersErreurs: errs, snapshot: snapNoms }),
      { telechargerTout: () => {}, arreterTelechargement: () => {}, actualiserEspace: () => {}, renvoyerOriginale: () => {}, reessayerFichier: () => {} });
    const texteToutes = toutes.textContent;
    eq([texteToutes.includes('Espace photos plein'), texteToutes.includes('Pages à télécharger : 4'), boutons(toutes).includes('Arrêter le téléchargement'), boutons(toutes).some((b) => b.startsWith('Renvoyer en originale')), toutes.querySelectorAll('[data-fichier]').length, /Go|palier|\$/.test(texteToutes), /supabase/i.test(texteToutes), toutes.querySelectorAll('progress').length],
      [true, true, true, true, 3, false, false, 0], 'L4 (R-G-5, I-G8) : sur un rendu où toutes les branches sont actives — pause, pages à télécharger, téléchargement global, renvoi, refusés, phrases —, ni « Go », ni « palier », ni « $ », ni le nom du fournisseur, aucun <progress> (mutants : phrase de palier dans la carte pause ou le renvoi ; fournisseur nommé)');
  });

  await run('Réglages L4 : gestes câblés, protégés ; qualité écrite ; « Envoi en cours… »', async () => {
    eq(SR.SYNC_L4_ACTIONS, ['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerOriginale', 'reessayerFichier'], 'L4 : les cinq gestes nommés');
    const appels = [];
    const moteurFactice = Object.fromEntries(['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerEnOriginale', 'reessayerFichier'].map((nom) => [nom, async (x) => { appels.push(nom + (x ? ':' + x : '')); }]));
    const gestes = SR.gestesL4Pour({ obtenirMoteur: () => moteurFactice, dire: () => {}, rafraichir: () => {}, journaliser: () => {} });
    eq(Object.keys(gestes).sort(), [...SR.SYNC_L4_ACTIONS].sort(), 'gestesL4Pour : exactement les cinq gestes');
    const tout = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 1, octetsATelecharger: 10, aRenvoyer: 1, enErreur: 1 }) }), { qualite: 'originale', fichiersErreurs: [{ sha256: H('1'), motif: 'introuvable', sens: 'reception' }], snapshot: snapNoms }), gestes);
    for (const b of tout.querySelectorAll('button')) if (!b.closest('.segmented')) b.click();
    const arret = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 1 }), telechargementGlobal: true })), gestes);
    [...arret.querySelectorAll('button')].find((b) => b.textContent === 'Arrêter le téléchargement').click();
    await new Promise((r) => setTimeout(r, 0));
    eq(appels.sort(), ['actualiserEspace', 'arreterTelechargement', 'reessayerFichier:' + H('1'), 'renvoyerEnOriginale', 'telechargerTout'], 'L4 : chaque bouton appelle SON geste, chaque geste son API du moteur (mutant : action renommée → bouton manquant)');
    const dits = [];
    await SR.gestesL4Pour({ obtenirMoteur: () => ({ actualiserEspace: async () => { throw new Error('x'); } }), dire: (m) => dits.push(m), rafraichir: () => {}, journaliser: () => {} }).actualiserEspace();
    eq(dits, ['Ce geste n’a pas abouti.'], 'gestesL4Pour : un geste qui rejette est dit, jamais un rejet non traité');
    await withRepo(async (repo) => {
      const b = rendre(modele(moteurL4()));
      [...b.querySelectorAll('.segmented button')].find((x) => x.textContent === 'Originale').click();
      let lu = null;
      for (let i = 0; i < 100 && (lu = await repo.getSetting('upload_quality')) !== 'originale'; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq(lu, 'originale', 'L4 : le câblage par défaut écrit repo.setSetting(upload_quality, originale) (§ 3.3)');
      await (await import('../src/ui/state.js')).relectureEnCours();
    });
    await (await import('../src/ui/state.js')).relireReglages(); // la base de l'app reprend la main (même hygiène qu'en tâche 1)
    const ditsE = [];
    await SR.effacerDonnees({ user: null, pending: async () => 0, confirm: async () => true, demanderMot: async () => 'EFFACER', toast: (m) => ditsE.push(m), clearDevice: async () => {}, reload: () => {}, arreterSync: async () => {}, transfertEnCours: () => true });
    const ditsC = [];
    await SR.changerDeCompte({ confirm: async () => true, toast: (m) => ditsC.push(m), pending: async () => 0, archiveCreated: () => 'oui', clearDevice: async () => {}, reload: () => {}, arreterSync: async () => {}, transfertEnCours: () => true });
    eq([ditsE, ditsC], [['Envoi en cours…', 'Données effacées'], ['Envoi en cours…']], 'effacerDonnees et changerDeCompte : un envoi ou un téléchargement en vol se dit « Envoi en cours… » avant d’attendre l’arrêt (S-11/F-24 : non annulable)');
  });
```

- [ ] **Step 2 : rouge lu** (les blocs « Réglages L4 … » rouges ; les deux assertions L3 réécrites rouges : le modèle rend encore le palier).
  **Mesuré au rejeu** : 4152/4158, six rouges — les deux lignes I-G9 l. 1237 et 1326, trois du lot G, l'épingle.

- [ ] **Step 3 : implémenter `src/ui/settings.js`.** Imports : `import { t, getUiLocale } from '../core/i18n.js';` et `import { referencesFichiers, nomFichier,
  lireErreursFichiers, MAGASINS_FICHIERS } from '../sync/fichiers.js';`. Dans `renderSettings`, après `suivreMoteurDeLaPage(moteur);` (C-2 : la lecture
  des conflits PRÉCÈDE `const moteur` — placé juste après elle, le bloc lève « Cannot access 'moteur' before initialization » et Réglages ne se rend
  plus ; mesuré au rejeu sur une copie : suites L3 et « assistant par le compte » interrompues) :

```js
  // Lot G (§ 4.1) : les erreurs de fichiers et le snapshot (pour nomFichier) sont lus au rendu, comme la quarantaine — seulement s'il y a un moteur.
  const etatMoteur = moteur?.etat() || null;
  const fichiersErreurs = etatMoteur ? [...(await lireErreursFichiers(repo.db))].map(([sha256, v]) => ({ sha256, motif: v?.motif, sens: v?.sens })) : [];
  const snapshotFichiers = etatMoteur ? await repo.db.getSnapshot(MAGASINS_FICHIERS) : null;
```

  et l'objet passé à `syncSection` porte `moteur: etatMoteur, …, fichiersErreurs, qualite: s.upload_quality, snapshot: snapshotFichiers`. Dans
  `syncSection`, `const gestesL4 = gestesL4Pour();` et, après `...syncSectionL3(model, gestesL3),` : `...syncSectionL4(model, gestesL4),`.
  `syncSectionModel` gagne les trois paramètres et, dans le `return` final (après `pause`) :

```js
    // Lot G (§ 4.1) : l'ensemble L4 — des faits du moteur, des phrases ici ; aucun plan, palier ni prix (R-G-5).
    fichiers: modeleFichiers(moteur, { qualite, refuses: erreursReferencees.length }),
    espace: phraseEspace(moteur.espaceServeur),
    qualite: qualite === 'originale' ? 'originale' : 'reduite',
    erreursFichiers: erreursReferencees,
```

  avec, juste avant ce `return` : `const refsFichiers = snapshot ? referencesFichiers(snapshot) : new Set(); const erreursReferencees = (fichiersErreurs ||
  []).filter((e) => refsFichiers.has(e?.sha256)).map((e) => ({ sha256: e.sha256, texte: `${nomFichier(e.sha256, snapshot)} — ${motifFichier(e.motif,
  e.sens)}`, reessayer: e.motif !== 'trop_gros' }));` — et, au niveau du module :

```js
// Lot G (§ 4.1) : des mégaoctets arrondis au dixième, dans la langue de l'interface (« 1,6 », « 850 ») — une MESURE, jamais un plafond (R-G-5).
const enMo = (octets) => new Intl.NumberFormat(getUiLocale() === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 1 }).format(Math.round((Number(octets) || 0) / 104857.6) / 10);
const compte = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);

function modeleFichiers(moteur, { qualite, refuses }) {
  const f = moteur.fichiers || {};
  const prog = moteur.progressionFichiers;
  const aTelecharger = compte(f.aTelecharger);
  const mo = enMo(f.octetsATelecharger);
  return {
    aEnvoyer: t('Photos à envoyer : {n}', { n: compte(f.aEnvoyer) }),
    envoi: prog?.sens === 'envoi' ? t('Envoi des photos : {n}/{m}', { n: prog.n, m: prog.total }) : null,
    pause: moteur.pauseFichiers ? t('Espace photos plein sur le serveur : les photos attendent sur cet appareil, les fiches continuent de partir.') : null,
    aTelecharger: aTelecharger ? t('Pages à télécharger : {n} (~{m} Mo)', { n: aTelecharger, m: mo }) : null,
    telechargerTout: aTelecharger && moteur.telechargementGlobal !== true ? t('Télécharger toutes les pages ({n} fichiers, ~{m} Mo)', { n: aTelecharger, m: mo }) : null,
    reception: prog?.sens === 'reception' ? t('Téléchargement des pages : {n}/{m}', { n: prog.n, m: prog.total }) : null,
    arreter: moteur.telechargementGlobal === true,
    renvoi: qualite === 'originale' && compte(f.aRenvoyer) ? t('Renvoyer en originale les {n} photos de cet appareil envoyées en réduite', { n: f.aRenvoyer }) : null,
    refuses: refuses ? t('Fichiers refusés : {n}', { n: refuses }) : null,
    typeInconnu: compte(f.typeInconnu) ? t('{n} fichier(s) de type inconnu ne seront pas synchronisés.', { n: f.typeInconnu }) : null,
    copiesSansServeur: compte(f.copiesSansServeur) ? t('{n} copie(s) de photos ici dont le serveur n’a plus trace : l’appareil qui a l’original les renverra.', { n: f.copiesSansServeur }) : null,
    copiesPerimees: compte(f.copiesPerimees) ? t('{n} photo(s) ici sont une copie plus ancienne que celle du serveur.', { n: f.copiesPerimees }) : null,
  };
}

function phraseEspace(e) {
  if (!e || !Number.isFinite(e.octets) || !Number.isFinite(e.objets)) return t('Espace serveur : pas encore mesuré.');
  const v = { x: enMo(e.octets), n: e.objets };
  return e.tronque ? t('au moins {x} Mo ({n} fichiers)', v) : t('Tes photos sur le serveur : {x} Mo ({n} fichiers)', v);
}

// Motifs d'un fichier refusé (§ 4.10) : le motif ET le sens décident la phrase (« type » à l'envoi = refusé par le serveur ; à la réception =
// illisible). Lus par hasOwn : un jeton inconnu ou hostile retombe sur « Fichier refusé », jamais sur le jeton.
const MOTIFS_FICHIER = {
  'envoi:trop_gros': 'Plus de 50 Mo : ce fichier reste sur cet appareil seulement.',
  'envoi:type': 'Type de fichier refusé par le serveur.',
  'envoi:verification': 'Empreinte différente après envoi.',
  'reception:forme': 'Ligne de fichier mal formée reçue du serveur.',
  'reception:introuvable': 'Ce fichier n’est plus sur le serveur.',
  'reception:empreinte': 'Fichier illisible reçu du serveur.',
  'reception:taille': 'Fichier illisible reçu du serveur.',
  'reception:type': 'Fichier illisible reçu du serveur.',
};
export const motifFichier = (motif, sens) => { const cle = `${sens}:${motif}`; return t(Object.hasOwn(MOTIFS_FICHIER, cle) ? MOTIFS_FICHIER[cle] : 'Fichier refusé'); };

export const SYNC_L4_ACTIONS = ['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerOriginale', 'reessayerFichier'];

// Le câblage des gestes L4 (§ 4.1), protégé comme gestesL3Pour : l'écran n'a ni le client ni le stockage (R53), tout passe par le moteur.
export function gestesL4Pour({ obtenirMoteur = () => getSyncState().moteur, dire = toast, rafraichir = refresh, journaliser = logError } = {}) {
  const protege = (nom, fn) => async (cle) => {
    try { await fn(cle); }
    catch (error) { journaliser('sync.geste.' + nom, { error }); dire(t('Ce geste n’a pas abouti.')); }
  };
  return {
    telechargerTout: protege('telecharger_tout', async () => { await obtenirMoteur()?.telechargerTout(); rafraichir(); }),
    arreterTelechargement: protege('arreter_telechargement', async () => { await obtenirMoteur()?.arreterTelechargement(); rafraichir(); }),
    actualiserEspace: protege('actualiser_espace', async () => { await obtenirMoteur()?.actualiserEspace(); rafraichir(); }),
    renvoyerOriginale: protege('renvoyer_originale', async () => { await obtenirMoteur()?.renvoyerEnOriginale(); rafraichir(); }),
    reessayerFichier: protege('reessayer_fichier', async (sha256) => { await obtenirMoteur()?.reessayerFichier(sha256); rafraichir(); }),
  };
}

const choisirQualiteReelle = async (valeur) => { await repo.setSetting('upload_quality', valeur); refresh(); };

// Rendu de l'ensemble L4 (§ 4.1), exporté pour être éprouvé tel quel. Un bouton n'existe que si son geste est câblé (la règle de L3).
export function syncSectionL4(model, gestes = {}, { choisirQualite = choisirQualiteReelle } = {}) {
  const f = model?.fichiers;
  if (!f) return [];
  const bouton = (action, libelle, cle) => (Object.hasOwn(gestes, action) ? el('button', { class: 'btn', onClick: () => gestes[action](cle) }, libelle) : null);
  const rangee = (...b) => { const vus = b.filter(Boolean); return vus.length ? el('div', { class: 'row' }, ...vus) : null; };
  const bloc = el('div', { class: 'stack', dataset: { role: 'sync-l4' } }, el('p', { class: 'muted' }, f.aEnvoyer));
  if (f.envoi) bloc.append(el('p', { class: 'muted' }, f.envoi));
  if (f.pause) bloc.append(el('div', { class: 'card warn' }, f.pause));
  if (f.aTelecharger) bloc.append(el('p', { class: 'muted' }, f.aTelecharger));
  if (f.reception) bloc.append(el('p', { class: 'muted' }, f.reception));
  const telechargement = rangee(f.telechargerTout ? bouton('telechargerTout', f.telechargerTout) : null, f.arreter ? bouton('arreterTelechargement', t('Arrêter le téléchargement')) : null);
  if (telechargement) bloc.append(telechargement);
  bloc.append(el('p', { class: 'muted' }, model.espace));
  const actualiser = rangee(bouton('actualiserEspace', t('Actualiser')));
  if (actualiser) bloc.append(actualiser);
  // R-UX-8 / B-15 : le segmented n'est JAMAIS dans un <label> (field() en rend un) : même habillage .field, par un div.
  bloc.append(el('div', { class: 'field' }, el('span', null, t('Qualité d’envoi des photos')),
    segmented([{ value: 'reduite', label: t('Réduite (≈ 400 Ko, 2 000 px)') }, { value: 'originale', label: t('Originale') }], model.qualite, (v) => choisirQualite(v)),
    el('small', null, t('L’original reste toujours sur l’appareil qui a pris la photo. Réduite : JPEG de 2 000 px au plus, environ 400 Ko par page, métadonnées retirées. Originale : le fichier tel quel, avec ses métadonnées (dont la position GPS si la photo en porte).'))));
  const renvoi = f.renvoi ? rangee(bouton('renvoyerOriginale', f.renvoi)) : null;
  if (renvoi) bloc.append(renvoi);
  if (f.refuses) {
    bloc.append(el('p', null, f.refuses));
    for (const e of model.erreursFichiers || []) {
      bloc.append(el('div', { class: 'status warn', dataset: { fichier: e.sha256 } }, el('p', null, e.texte), e.reessayer ? rangee(bouton('reessayerFichier', t('Réessayer'), e.sha256)) : null));
    }
  }
  for (const phrase of [f.typeInconnu, f.copiesSansServeur, f.copiesPerimees]) if (phrase) bloc.append(el('p', { class: 'muted' }, phrase));
  return [bloc];
}
```

  `effacerDonnees` et `changerDeCompte` gagnent le paramètre `transfertEnCours = () => !!getSyncState().moteur?.etat?.()?.progressionFichiers` et, juste
  avant `await arreterSync();` :

```js
  // S-11 / F-24 : upload() et download() ne prennent pas de signal ; arreter() attend le fichier en cours — on le dit avant d'attendre.
  if (transfertEnCours()) dire(t('Envoi en cours…'));
```

  Pause de quota de L3 (rév. 3, P2 ; R-G-5 : aucune promesse de palier) : dans `syncSectionModel`, la phrase de `pause` devient

```js
    pause: moteur.pause?.raison === 'quota'
      ? t('Espace serveur plein — rien n’est perdu, tout reste sur cet appareil.')
      : null,
```

  Seule la parenthèse « (1 Go au palier gratuit) » tombe : la pause L3 est le quota des fiches de `sync_push`, que l'app ne connaît pas plus que
  le plan du projet (`mitsu` est sur une organisation Pro, R33) ; la carte `card warn` de `syncSectionL3` est inchangée.

- [ ] **Step 4 : `en.js`** (avant `};`, sous `// Lot G : Réglages → Synchronisation (§ 4.1, § 4.10).`), les vingt-huit entrées de la spec § 5, mot
  pour mot (et, à la place de l'ancienne — l. 141 à `bd03e48` comme à `3601a52` —, l'entrée de la pause L3 : P2, bloc suivant) :

```js
  "Photos à envoyer : {n}": "Photos to upload: {n}",
  "Envoi des photos : {n}/{m}": "Uploading photos: {n}/{m}",
  "Pages à télécharger : {n} (~{m} Mo)": "Pages to download: {n} (~{m} MB)",
  "Télécharger toutes les pages ({n} fichiers, ~{m} Mo)": "Download all pages ({n} files, ~{m} MB)",
  "Arrêter le téléchargement": "Stop downloading",
  "Téléchargement des pages : {n}/{m}": "Downloading pages: {n}/{m}",
  "Tes photos sur le serveur : {x} Mo ({n} fichiers)": "Your photos on the server: {x} MB ({n} files)",
  "Espace serveur : pas encore mesuré.": "Server storage: not measured yet.",
  "au moins {x} Mo ({n} fichiers)": "at least {x} MB ({n} files)",
  "Actualiser": "Refresh",
  "Espace photos plein sur le serveur : les photos attendent sur cet appareil, les fiches continuent de partir.": "Photo storage on the server is full: photos wait on this device, records keep going out.",
  "Qualité d’envoi des photos": "Photo upload quality",
  "Réduite (≈ 400 Ko, 2 000 px)": "Reduced (≈ 400 KB, 2,000 px)",
  "Originale": "Original",
  "L’original reste toujours sur l’appareil qui a pris la photo. Réduite : JPEG de 2 000 px au plus, environ 400 Ko par page, métadonnées retirées. Originale : le fichier tel quel, avec ses métadonnées (dont la position GPS si la photo en porte).": "The original always stays on the device that took the photo. Reduced: JPEG of at most 2,000 px, about 400 KB per page, metadata removed. Original: the file as is, with its metadata (including GPS position if the photo has one).",
  "Renvoyer en originale les {n} photos de cet appareil envoyées en réduite": "Re-upload as original the {n} photos of this device sent reduced",
  "Fichiers refusés : {n}": "Rejected files: {n}",
  "{n} fichier(s) de type inconnu ne seront pas synchronisés.": "{n} file(s) of unknown type will not be synchronized.",
  "{n} copie(s) de photos ici dont le serveur n’a plus trace : l’appareil qui a l’original les renverra.": "{n} photo copy(ies) here that the server no longer tracks: the device with the original will send them again.",
  "{n} photo(s) ici sont une copie plus ancienne que celle du serveur.": "{n} photo(s) here are an older copy than the server's.",
  "Plus de 50 Mo : ce fichier reste sur cet appareil seulement.": "Over 50 MB: this file stays on this device only.",
  "Type de fichier refusé par le serveur.": "File type refused by the server.",
  "Empreinte différente après envoi.": "Different fingerprint after upload.",
  "Ligne de fichier mal formée reçue du serveur.": "Malformed file row received from the server.",
  "Ce fichier n’est plus sur le serveur.": "This file is no longer on the server.",
  "Fichier illisible reçu du serveur.": "Unreadable file received from the server.",
  "Fichier refusé": "File refused",
  "Envoi en cours…": "Upload in progress…",
```

  L'entrée de la pause L3 (P2) est **remplacée** à sa place (l. 141 à `bd03e48` et à `3601a52`) : l'ancienne clé « Espace serveur plein (1 Go au palier
  gratuit) — … » disparaît (plus aucun `t()` ne la lit) ; la neuve :

```js
  "Espace serveur plein — rien n’est perdu, tout reste sur cet appareil.": "Server storage is full — nothing is lost, everything stays on this device.",
```

  `tests/ajouter.js` : ces vingt-huit clés françaises et la clé neuve de la pause L3 (vingt-neuf) ajoutées à
  `CHAINES_NEUVES_AILLEURS['../src/ui/settings.js']` (commentaire « Lot G, tâche 5 ; pause L3 sans palier, P2 »).
  `sw.js` : `VERSION = 'cuisine-os-v0.11.0-5'`.
- [ ] **Step 5 : vert** (suite, épingle ; le test « un rendu de Réglages lit la file d'envoi exactement une fois » de `tests/sync-l3.js` reste vert : les
  lectures neuves portent sur `sync_state` et le snapshot, jamais sur `outbox`). Node et `--check` inchangés. Les deux assertions L3 réécrites au Step 1 (`tests/sync-l3.js`
  l. 1237 et 1326), rouges au Step 2, sont vertes ici : le texte de pause L3 est amendé (Step 3, P2) ; « 1 Go » et « palier gratuit »
  n'apparaissent plus dans `src/` (hors `vendor/`) ni dans `tests/` (relu à `bd03e48`, puis à `3601a52` : `settings.js` l. 846, `en.js` l. 141 et ces
  deux lignes de test étaient les seules). **Mesuré au rejeu** : seule l'épingle rouge (obtenu 4174), puis 4175/4175 (épingle 4174) ; Node 174 ;
  `--check` 0 ; `sw.js cuisine-os-v0.11.0-5` ; « 1 Go » et « palier gratuit » absents de `src/` et `tests/`.
- [ ] **Step 6 : invisibles** (Python).
- [ ] **Step 7 : commit** `Reglages L4 : photos a envoyer, pages a telecharger, espace mesure sans plan, pause L3 sans palier, qualite d envoi hors label, fichiers refuses nommes (lot G, tache 5)`.

---

### Task 6 : Écrans — couverture, vignettes, cadre PDF, séance ; documents (spec § 4.2-4.5, § 9 tâche 6, B-24, F-21, R-G-1)

**Files:**
- Modify: `src/ui/components.js` (`contexteFichiers`, `gesteTelechargement`, `vignettePage`, `vignettesDePages`, `boutonTelechargerPages` ; `pdfFrame({
  sha256, filename, connecte, telecharger })` rempli à la résolution), `src/ui/livre-ajout.js` (`renderZoneCouverture` : « Télécharger » /
  « Téléchargement… » / « Réessayer »), `src/ui/book.js` (couverture par état, vignettes de « Pages et fichiers sources »), `src/ui/import.js`
  (`sessionView` asynchrone, vignettes, bouton groupé, phrase de séance abonnée à `onEtat`, `pdfFrame` à téléchargement), `src/ui/recipe.js`
  (« Original », « Pages d'index » — `referenceOnly` asynchrone —, `photoDuPlat(recipe, ctxF)`), `styles.css` (`.thumbs .fichier-absent`,
  `.vignette-page`)
- Modify: `src/i18n/en.js` (treize chaînes), `tests/ajouter.js` (`CHAINES_NEUVES_AILLEURS` : ajouts aux clés **existantes** `components.js`,
  `book.js`, `import.js`), `tests/sync.js`
  (les deux assertions `pdfFrame` amendées — doute 1), `tests/sync-l4.js` (bloc tâche 6), `sw.js` (`VERSION -6`), `tests/tests.js` (total)
- Modify (documents, § 9 tâche 6) : `docs/architecture.md` (« Ce qui est absent (L4 et L5) » réécrit, `files.js` → `fichiers.js`, les trois
  phrases « les octets … ne partent pas encore » — l. 6, 179 et 1276 à `3601a52`, 882 à `bd03e48`), `docs/spec-compte-et-stockage-distant.md` (§ 11 : une
  ligne au numéro qui suit le dernier R, R66 à `bd03e48` comme à `3601a52`), `supabase/README.md` (étape 7 : une ligne)
- Non modifié, par choix : `src/ui/recipe-edit.js` (troisième appelant de `pdfFrame`, l. 94 à `3601a52`) — sans `connecte` ni `telecharger`, l'écran de
  correction d'une recette dit la phrase de repli d'un PDF absent, sans « Télécharger » (doute 15 ; P4 : dette nommée à la clôture,
  spec § 11, pas de tâche ; l. 86 à `bd03e48`, l. 89 à `4cb99a0`, l. 94 à `3601a52`)

**Interfaces:**
- Consumes : `etatFichier`, `remoteDeCeCompte` (tâche 1) ; `lireErreursFichiers` (tâche 3) ; `moteur.telecharger`, `moteur.reessayerFichier`,
  `moteur.onEtat` (tâche 4) ; `typeAffichage`, `displayUrl(fileRow, creerUrl)` (tâche 1).
- Produces (`components.js`) : `contexteFichiers(ctx) → Promise<{ connecte, uid, erreurs: Set, moteur }>` (`uid` : le compte connecté, sinon
  `sync_state.user_id` — celui que l'appareil a connu, pour dire « Connecte-toi pour la télécharger ») ; `gesteTelechargement({ moteur, redessiner, dire })
  → (sha256 | sha256[], { reessayer }) => Promise` ; `vignettePage(page, fichier, { connecte, uid, erreurs, telecharger }) → HTMLImageElement |
  HTMLElement(figure.fichier-absent[data-etat])` ; `vignettesDePages(pages, ctxF) → Promise<{ places: Map(page.id → nœud), distantes: sha256[],
  telecharger }>` ; `boutonTelechargerPages(distantes, { connecte, telecharger }) → bouton | null` (≥ 2 pages distantes, compte) ; `pdfFrame({ sha256,
  filename, connecte = false, telecharger = null }) → div.stack` (vide à l'appel, rempli à la résolution).
- Produces (`livre-ajout.js`) : `renderZoneCouverture(etat, gestes)` lit en plus `etat.telechargeable`, `etat.telechargement`, `etat.reessayable` et
  appelle `gestes.telecharger` / `gestes.reessayer`.

- [ ] **Step 1 : tests rouges** (à la fin du corps de `runSyncL4Tests`). **Rejeu, C-1** : deux lignes de ce bloc diffèrent de la rév. 3 — `finDesImages`
  et l'attente de fin de l'image du test `vignettePage` passent l'image en `loading = 'eager'` avant d'attendre `onload`/`onerror`. Telles quelles, elles
  attendaient une image `loading: 'lazy'` détachée (`vignettePage`) ou dans une scène cachée (séance) : Chrome ne la charge jamais, l'attente ne se
  résolvait pas et la suite entière restait sans bilan (mesuré au rejeu, rouge comme vert ; aucun bloc de la tâche 6 n'avait été joué dans un navigateur
  avant). Aucune assertion n'est touchée :

```js
  // === Tâche 6 — écrans (§ 4.2-4.5)
  const K = await import('../src/ui/components.js');
  // Une image `loading: 'lazy'` détachée ou dans une scène cachée ne se charge jamais (Chrome) : passée en `eager` avant d'attendre (rejeu, mesuré).
  const finDesImages = (racine) => Promise.all([...racine.querySelectorAll('img')].map((i) => { if (i.complete) return null; i.loading = 'eager'; return new Promise((r) => { i.onload = r; i.onerror = r; }); }));
  const pngMinuscule = async () => { const toile = new OffscreenCanvas(2, 2); toile.getContext('2d').fillRect(0, 0, 2, 2); return toile.convertToBlob({ type: 'image/png' }); };

  await run('vignettePage : les états d’une page (§ 4.3)', async () => {
    const page = { id: 'p1', sha256: H('7') };
    const distant = { sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() };
    const vus = [];
    const telecharger = async (sha, o) => { vus.push([sha, !!o?.reessayer]); };
    const img = K.vignettePage(page, { ...distant, mime: 'image/png', blob: await pngMinuscule() }, { connecte: true, uid: 'u1', telecharger });
    const etat = (f, o) => K.vignettePage(page, f, { uid: 'u1', telecharger, ...o });
    const v = [
      etat(distant, { connecte: true }),
      etat(distant, { connecte: false }),
      etat({ ...distant, remote: null }, { connecte: true }),
      etat({ ...distant, remote: R({ owner: 'u2' }) }, { connecte: true }),
      etat(undefined, { connecte: true }),
      etat(distant, { connecte: true, erreurs: new Set([H('7')]) }),
    ];
    const decrire = (n) => [n.tagName, n.dataset.etat, n.querySelector('small')?.textContent ?? null, [...n.querySelectorAll('button')].map((b) => b.textContent)];
    eq([img.tagName, ...v.map(decrire)], ['IMG',
      ['FIGURE', 'distant', 'Pas encore sur cet appareil', ['Télécharger']],
      ['FIGURE', 'distant', 'Connecte-toi pour la télécharger', []],
      ['FIGURE', 'absent', 'Pas encore envoyée par l’appareil qui l’a prise', []],
      ['FIGURE', 'absent', 'Pas encore envoyée par l’appareil qui l’a prise', []],
      ['FIGURE', 'pas_recue', 'Pas encore reçue', []],
      ['FIGURE', 'erreur', 'Fichier illisible reçu du serveur.', ['Réessayer']]],
      'vignettePage : avec octets → <img> ; distante (compte : « Télécharger » ; sans compte : « Connecte-toi ») ; absente ; d’un autre compte → absente (R-G-2) ; sans ligne → « Pas encore reçue » ; erreur → « Réessayer »');
    ok(v.every((n) => n.classList.contains('fichier-absent')), 'vignettePage : figure.fichier-absent, le gabarit 110 × 140 des miniatures');
    v[0].querySelector('button').click(); v[5].querySelector('button').click();
    await new Promise((r) => setTimeout(r, 0));
    eq(vus, [[H('7'), false], [H('7'), true]], 'vignettePage : « Télécharger » et « Réessayer » appellent telecharger(sha256, { reessayer }) — sur une tape seulement (R-G-1)');
    if (!img.complete) { img.loading = 'eager'; await new Promise((r) => { img.onload = r; img.onerror = r; }); } // lazy détachée : jamais chargée sinon
    URL.revokeObjectURL(img.src);
  });

  await run('pdfFrame : conteneur tout de suite, cadre ou bouton à la résolution (§ 4.5, B-24)', async () => {
    await withRepo(async (repo, db) => {
      const pdf = octets('%PDF-1.4 cadre', 'application/pdf'); const shaPdf = await sha256Hex(pdf);
      await repo.putFile(shaPdf, pdf, { original_filename: 'c.pdf' });
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'application/pdf', size: 9, updated_at: DATE, remote: R({ mime: 'application/pdf' }) }] }, origin: 'remote' });
      const vus = [];
      const sans = K.pdfFrame({ sha256: H('7'), filename: 'x.pdf', connecte: true, telecharger: async (sha) => { vus.push(sha); } });
      const avec = K.pdfFrame({ sha256: shaPdf, filename: 'c.pdf' });
      const immediat = [sans.classList.contains('stack'), sans.querySelector('iframe'), avec.querySelector('iframe')];
      for (let i = 0; i < 100 && !(sans.querySelector('button') && avec.querySelector('iframe')); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([immediat, sans.querySelector('iframe'), [...sans.querySelectorAll('button')].map((b) => b.textContent), sans.textContent.includes('Ce fichier n’est pas encore sur cet appareil.'), !!avec.querySelector('iframe.pdf[sandbox]'), [...avec.querySelectorAll('button')].map((b) => b.textContent)],
        [[true, null, null], null, ['Télécharger'], true, true, ['Télécharger le fichier']], 'pdfFrame : conteneur rendu de suite et vide ; sans octets → la phrase et « Télécharger », jamais un cadre vide ; avec octets → le cadre sandbox et « Télécharger le fichier » (mutant : cadre rendu avant la résolution)');
      const pdf2 = octets('%PDF-1.4 recu', 'application/pdf');
      const apres = K.pdfFrame({ sha256: H('7'), filename: 'x.pdf', connecte: true, telecharger: async (sha) => { vus.push(sha); await db.mutate({ puts: { files: [{ ...(await db.get('files', sha)), blob: pdf2 }] }, origin: 'remote' }); } });
      for (let i = 0; i < 100 && !apres.querySelector('button'); i += 1) await new Promise((r) => setTimeout(r, 10));
      apres.querySelector('button').click();
      for (let i = 0; i < 100 && !apres.querySelector('iframe'); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([vus, !!apres.querySelector('iframe.pdf[sandbox]')], [[H('7')], true], 'pdfFrame : « Télécharger » appelle telecharger(sha256), puis le cadre remplace le bouton');
    });
  });

  await run('fiche du livre : couverture distante, sans compte, absente, en erreur, échec dit (§ 4.2)', async () => {
    const { renderBook } = await import('../src/ui/book.js');
    await withRepo(async (repo, db) => {
      const toile = new OffscreenCanvas(4, 6); toile.getContext('2d').fillRect(0, 0, 4, 6);
      const jpeg = await toile.convertToBlob({ type: 'image/jpeg' }); const shaJ = await sha256Hex(jpeg);
      const eD = { id: 'eD', book_id: 'bD', year: 2020, cover_sha256: H('7') };
      const eA = { id: 'eA', book_id: 'bD', year: 2021, cover_sha256: H('8') };
      const eE = { id: 'eE', book_id: 'bD', year: 2022, cover_sha256: H('9') };
      const livre = { id: 'bD', title: 'Distant', author: 'A', cuisines: [] };
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'image/jpeg', size: jpeg.size, updated_at: DATE, remote: R({ sha256: shaJ, size: jpeg.size }) }, { sha256: H('8'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: null }, { sha256: H('9'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('c'), size: 5 }) }], sync_state: [{ key: 'user_id', value: 'u1' }, { key: 'file_error:' + H('9'), value: { motif: 'empreinte', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const appels = [];
      const moteur = { telecharger: async (shas) => { appels.push(shas); const l = await db.get('files', shas[0]); await db.mutate({ puts: { files: [{ ...l, blob: jpeg }] }, origin: 'remote' }); return { recus: 1, erreurs: 0, erreur: null }; }, onEtat: () => () => {} };
      const ctx = (sync) => ({ book_editions: [eD, eA, eE], recipes: [], recipe_versions: [], source_documents: [], source_pages: [], rediscovery_prefs: [], dishes: [], dish_recipe_links: [], recipesById: new Map(), docsByRecipe: new Map(), scan_sessions: [], settings: {}, books: [livre], booksById: new Map([['bD', livre]]), editionsById: new Map([['eD', eD], ['eA', eA], ['eE', eE]]), editionLabel: () => livre.title, sync });
      const bloc = (n) => [...n.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Couverture');
      const textesBoutons = (n) => [...(bloc(n)?.querySelectorAll('button') || [])].map((b) => b.textContent);
      const sansCompte = await renderBook({ id: 'eD' }, {}, ctx({}));
      const absente = await renderBook({ id: 'eA' }, {}, ctx({ user: { id: 'u1' }, moteur }));
      eq([bloc(sansCompte)?.querySelector('small')?.textContent, textesBoutons(sansCompte).includes('Télécharger'), bloc(absente)?.querySelector('small')?.textContent, textesBoutons(absente).includes('Télécharger')],
        ['La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.', false, 'La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.', false], 'couverture : distante sans compte → « Connecte-toi … », aucun bouton ; absente → « … ne l’a pas encore envoyée »');
      // Erreur et échec (faux-vert de la rév. 1) : une couverture en file_error offre « Réessayer », qui passe par reessayerFichier ; un
      // téléchargement qui n'aboutit pas (recus: 0) se DIT (toast) et laisse la zone telle quelle. Joué AVANT le succès : il donne ses octets à H('7').
      const reessais = [];
      const moteurEchec = { telecharger: async (shas) => ({ recus: 0, erreurs: 1, erreur: null, shas }), reessayerFichier: async (sha) => { reessais.push(sha); return { recus: 0, erreurs: 1, erreur: null }; }, onEtat: () => () => {} };
      const toastDit = () => document.querySelector('.toast')?.textContent ?? null;
      const viderToast = () => { const n = document.querySelector('.toast'); if (n) n.textContent = ''; };
      viderToast();
      const enErreur = await renderBook({ id: 'eE' }, {}, ctx({ user: { id: 'u1' }, moteur: moteurEchec }));
      const zoneE = bloc(enErreur);
      eq([zoneE?.querySelector('small')?.textContent, textesBoutons(enErreur).includes('Réessayer'), textesBoutons(enErreur).includes('Télécharger')], ['Fichier illisible reçu du serveur.', true, false], 'couverture en erreur : la phrase et « Réessayer », jamais « Télécharger »');
      [...zoneE.querySelectorAll('button')].find((b) => b.textContent === 'Réessayer').click();
      for (let i = 0; i < 100 && toastDit() !== 'Le téléchargement n’a pas abouti.'; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([reessais, toastDit(), !!zoneE.querySelector('img')], [[H('9')], 'Le téléchargement n’a pas abouti.', false], 'couverture : « Réessayer » appelle moteur.reessayerFichier(sha) ; sans octets reçus, l’échec est DIT et aucune image n’apparaît (mutants : Réessayer → telecharger ; toast retiré)');
      viderToast();
      const echec = await renderBook({ id: 'eD' }, {}, ctx({ user: { id: 'u1' }, moteur: moteurEchec }));
      const zoneEchec = bloc(echec);
      [...zoneEchec.querySelectorAll('button')].find((b) => b.textContent === 'Télécharger').click();
      for (let i = 0; i < 100 && toastDit() !== 'Le téléchargement n’a pas abouti.'; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([toastDit(), zoneEchec.querySelector('small')?.textContent, textesBoutons(echec).includes('Télécharger'), !!zoneEchec.querySelector('img')], ['Le téléchargement n’a pas abouti.', 'La couverture n’est pas sur cet appareil.', true, false], 'couverture : un téléchargement qui rend recus: 0 se dit (toast), la zone reste la même avec « Télécharger » (mutant : échec muet)');
      const fiche = await renderBook({ id: 'eD' }, {}, ctx({ user: { id: 'u1' }, moteur }));
      const zone = bloc(fiche);
      eq([zone?.querySelector('small')?.textContent, textesBoutons(fiche).includes('Télécharger')], ['La couverture n’est pas sur cet appareil.', true], 'couverture distante avec compte : le texte existant et « Télécharger »');
      [...zone.querySelectorAll('button')].find((b) => b.textContent === 'Télécharger').click();
      for (let i = 0; i < 100 && !zone.querySelector('img'); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([appels, !!zone.querySelector('img'), zone.querySelector('small')], [[[H('7')]], true, null], 'couverture : « Télécharger » → moteur.telecharger([sha]) puis la zone se redessine avec l’image (invalidate + refresh pour la fiche entière)');
      await finDesImages(fiche);
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('séance de scan : vignettes et phrase abonnée (§ 4.3, F-21)', async () => {
    const { renderImport } = await import('../src/ui/import.js');
    await withRepo(async (repo, db) => {
      const photo = new Blob([await pngMinuscule()], { type: 'image/png' }); const s1 = await sha256Hex(photo);
      await repo.putFile(s1, photo, {});
      await db.mutate({ puts: { files: [{ ...(await db.get('files', s1)), remote: R({ sha256: s1, size: photo.size, mime: 'image/png' }) }, { sha256: H('2'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }, { sha256: H('3'), mime: 'image/jpeg', size: 5, updated_at: DATE }] }, origin: 'remote' });
      const pages = [{ id: 'q1', document_id: 'dq', sha256: s1, position: 1 }, { id: 'q2', document_id: 'dq', sha256: H('2'), position: 2 }, { id: 'q3', document_id: 'dq', sha256: H('3'), position: 3 }];
      const seance = { id: 'ss1', status: 'open', started_at: DATE, page_ids: ['q1', 'q2', 'q3'], document_ids: [] };
      const abonnes = new Set();
      const moteur = { onEtat: (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); }, telecharger: async () => ({ recus: 0, erreurs: 0, erreur: null }) };
      const ctx = { scan_sessions: [seance], pagesById: new Map(pages.map((p) => [p.id, p])), source_documents: [], book_editions: [], booksById: new Map(), editionsById: new Map(), editionLabel: () => '', recipes: [], settings: {}, sync: { user: { id: 'u1' }, moteur } };
      const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
      try {
        const root = await renderImport({}, { session: 'ss1' }, ctx);
        scene.append(root);
        const phrase = () => root.querySelector('[data-role="phrase-seance"]')?.textContent;
        const etats = [...root.querySelectorAll('.thumbs .fichier-absent')].map((f) => f.dataset.etat);
        const avant = phrase();
        await db.mutate({ puts: { files: [{ sha256: H('3'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('3'), size: 5 }) }] }, origin: 'remote' });
        for (const fn of abonnes) fn({ enCours: false });
        for (let i = 0; i < 100 && phrase() === avant; i += 1) await new Promise((r) => setTimeout(r, 10));
        eq([avant, phrase(), etats, root.querySelectorAll('.thumbs img').length], ['2/3 photos de cette séance envoyées au serveur', '3/3 photos de cette séance envoyées au serveur', ['distant', 'absent'], 1],
          'séance : « {n}/{m} photos … envoyées au serveur » compte les remote de CE compte — la page distante aussi, ses octets sont au serveur (I5 ; mutant : compte sur blob → 1/3) — et se redessine sur onEtat SANS re-rendu de la route (mutant : phrase non abonnée) ; vignettes : image, distante, absente');
        await finDesImages(root);
      } finally { scene.remove(); }
      const sansCompte = await renderImport({}, { session: 'ss1' }, { ...ctx, sync: {} });
      eq(sansCompte.querySelector('[data-role="phrase-seance"]')?.textContent, 'Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages', 'séance sans compte : la phrase de la sauvegarde (« Aucune synchronisation serveur configurée » était faux dès qu’un compte existe)');
      await finDesImages(sansCompte);
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('fiche recette : « Original » groupé et photo du plat distante (§ 4.4)', async () => {
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const { INGREDIENTS } = await import('../src/model/seed.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('1'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('a'), size: 5 }) }, { sha256: H('2'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('b'), size: 5 }) }, { sha256: H('3'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('c'), size: 5 }) }] }, origin: 'remote' });
      const pages = [{ id: 'o1', sha256: H('1'), printed_page: 10 }, { id: 'o2', sha256: H('2'), printed_page: 11 }];
      const recette = { id: 'rO', edition_id: null, original_title: 'Compote', availability: 'available', verification_state: 'verified', source_page_ids: ['o1', 'o2'], current_version_id: 'vO', photo_sha256: H('3'), tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE };
      const version = { id: 'vO', recipe_id: 'rO', kind: 'extraction', servings: 2, ingredients: [], steps: [{ id: 's1', position: 1, text: 'Cuire.' }], constraints: {}, changes: '', notes: '', provenance: { source_page_ids: ['o1', 'o2'], generated_by: 'manual', model: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE };
      const appels = [];
      const moteur = { telecharger: async (shas) => { appels.push(shas); return { recus: 0, erreurs: 0, erreur: null }; }, onEtat: () => () => {} };
      const ctx = { recipes: [recette], recipesById: new Map([['rO', recette]]), recipe_versions: [version], versionsByRecipe: new Map([['rO', [version]]]), versionsById: new Map([['vO', version]]), editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(pages.map((p) => [p.id, p])), imports: [], dishesById: new Map(), dishes: [], cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: INGREDIENTS, ingredientsById: new Map(INGREDIENTS.map((i) => [i.id, i])), source_documents: [], source_pages: pages, scan_sessions: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, sync: { user: { id: 'u1' }, moteur } };
      const page = await renderRecipe({ id: 'rO' }, {}, ctx);
      const original = [...page.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Original');
      const groupe = [...(original?.querySelectorAll('button') || [])].find((b) => b.textContent === 'Télécharger les 2 pages');
      eq([!!groupe, original?.querySelectorAll('.fichier-absent').length, [...(page.querySelector('[data-role="photo-plat"]')?.querySelectorAll('button') || [])].map((b) => b.textContent)], [true, 2, ['Télécharger']],
        'fiche recette : deux pages distantes → deux vignettes et « Télécharger les 2 pages » sous le titre ; la photo du plat distante suit la règle de la couverture (« Télécharger »)');
      groupe.click();
      for (let i = 0; i < 100 && !appels.length; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq(appels[0], [H('1'), H('2')], 'fiche recette : le bouton groupé passe les deux clés à telecharger, dans l’ordre des pages');
      // F-9 sur la photo du plat (rév. 3, P1) : la fixture SÉPARE la garde de photoDuPlat du retypage de displayUrl. Sous une ligne image/heic
      // (rév. 2), le mutant « photoDuPlat garde safeDisplayType(fichier.mime) » passait la garde (heic est une image de la liste) et displayUrl
      // retypait quand même en image/jpeg : sortie identique, mutant vivant (rejoué sous Node). Ici la ligne dit application/pdf (dans la liste,
      // PAS une image) et les octets sont un vrai JPEG : le vrai code (typeAffichage, le type du blob gagne) montre la photo, le mutant ne montre
      // rien. Vert à l'écriture (la règle est posée en tâche 1) ; le mutant le rougit (rejoué à la clôture). Le Blob affiché se lit par l'espion
      // de URL.createObjectURL, jamais par fetch (CSP).
      const toileP = new OffscreenCanvas(2, 2); toileP.getContext('2d').fillRect(0, 0, 2, 2);
      const jpegP = await toileP.convertToBlob({ type: 'image/jpeg' }); // un vrai JPEG, décodable, typé image/jpeg
      await db.mutate({ puts: { files: [{ sha256: H('5'), mime: 'application/pdf', size: 999, blob: jpegP, syncable: true, created_at: DATE, updated_at: DATE }] }, origin: 'remote' });
      const recetteP = { ...recette, id: 'rP', photo_sha256: H('5'), source_page_ids: [], current_version_id: 'vP' };
      const versionP = { ...version, id: 'vP', recipe_id: 'rP', provenance: { ...version.provenance, source_page_ids: [] } };
      const ctxP = { ...ctx, recipes: [recetteP], recipesById: new Map([['rP', recetteP]]), recipe_versions: [versionP], versionsByRecipe: new Map([['rP', [versionP]]]), versionsById: new Map([['vP', versionP]]) };
      const remis = []; const vraiCreer = URL.createObjectURL;
      URL.createObjectURL = (b) => { remis.push(b); return vraiCreer.call(URL, b); };
      let pageP = null;
      try { pageP = await renderRecipe({ id: 'rP' }, {}, ctxP); } finally { URL.createObjectURL = vraiCreer; }
      eq([!!pageP.querySelector('[data-role="photo-plat"] img'), remis.some((b) => b.type === 'image/jpeg'), remis.some((b) => b.type === 'application/pdf')], [true, true, false], 'photo du plat (F-9, P1) : des octets JPEG sous une ligne application/pdf s’affichent, le Blob affiché est image/jpeg (mutant : safeDisplayType(fichier.mime) gardé dans photoDuPlat → application/pdf n’est pas une image → aucune photo, rouge)');
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('statique tâche 6', async () => {
    const sw = await lire('../sw.js');
    ok(/VERSION = 'cuisine-os-v0\.11\.0-\d+'/.test(sw), 'sw.js : VERSION 0.11.0 (au moins -6 à la clôture des écrans)');
    const { EN } = await import('../src/i18n/en.js');
    const neuves = ['Page', 'Télécharger', 'Télécharger les {n} pages', 'Téléchargement…', 'Le téléchargement n’a pas abouti.', 'Pas encore sur cet appareil', 'Connecte-toi pour la télécharger', 'Pas encore envoyée par l’appareil qui l’a prise', 'Pas encore reçue', 'La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.', 'La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.', 'Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages', '{n}/{m} photos de cette séance envoyées au serveur'];
    eq(neuves.filter((k) => typeof EN[k] !== 'string' || !EN[k]), [], 'en.js : chaque chaîne neuve des écrans a sa traduction (dont « Page », l’alt de vignettePage)');
    eq(neuves.filter((k) => /supabase/i.test(k) || /supabase/i.test(EN[k] || '')), [], 'I-G8 : aucune chaîne neuve des écrans ne nomme le fournisseur de stockage, ni en français ni en anglais');
  });
```

- [ ] **Step 2 : amender `tests/sync.js`** (bloc « Ronde 1 : le bouton de repli doit exister avant toute resolution du fichier ») — les deux
  assertions contredisent § 4.5 (doute 1) et deviennent :

```js
  // Lot G (§ 4.5, B-24) : le conteneur est rendu de suite, et c'est la résolution qui pose le cadre OU la phrase de repli — jamais un cadre vide.
  const { pdfFrame } = await import('../src/ui/components.js');
  const frame = pdfFrame({ sha256: 'z'.repeat(64), filename: 'x.pdf' });
  ok(frame.classList.contains('stack') && !frame.querySelector('iframe'), 'pdfFrame (lot G) : conteneur rendu de suite, aucun cadre vide avant la resolution');
  for (let i = 0; i < 100 && !frame.querySelector('p'); i += 1) await new Promise((r) => setTimeout(r, 10));
  ok(frame.textContent.includes('Ce fichier n’est pas encore sur cet appareil.') && ![...frame.querySelectorAll('button')].some((b) => b.textContent === 'Télécharger le fichier'), 'pdfFrame (lot G) : sans octets, la phrase de repli ; « Télécharger le fichier » seulement avec un blob');
```

- [ ] **Step 3 : rouge lu.** **Mesuré au rejeu** (bloc de la tâche corrigé, C-1) : 4174/4188, quatorze rouges — les deux lignes I-G9 de
  `tests/sync.js` (l. 124 et 125, réécrites au Step 2), onze du lot G, l'épingle ; le test de la photo du plat (P1) est vert à l'écriture (la règle est
  posée en tâche 1). Avec le bloc de la rév. 3 tel quel : suite sans bilan (C-1).

- [ ] **Step 4 : implémenter `src/ui/components.js`.** Imports : celui de `../sync/mime.js` est déjà `{ displayUrl, typeAffichage }` (tâche 1) ;
  ajouter `import { etatFichier, lireErreursFichiers } from '../sync/fichiers.js';` ; l'import existant de `./state.js` (`pastilleModel`) devient
  `import { pastilleModel, invalidate } from './state.js';`. `pdfFrame` remplacé ; après lui :

```js
// Cadre PDF isolé (§ 4.5, B-24) : SYNCHRONE à l'appel (l'appelant fait box.append(pdfFrame(…))) — le conteneur est rendu de suite, et c'est la
// résolution de repo.getFile qui y pose le cadre (sandbox vide, type par la liste blanche) OU, sans octets, la phrase et « Télécharger » (avec un
// compte). Jamais un cadre vide ; « Télécharger le fichier » seulement avec un blob. Après un téléchargement, le cadre remplace le bouton.
export function pdfFrame({ sha256, filename, connecte = false, telecharger = null }) {
  const boite = el('div', { class: 'stack' });
  const remplir = async () => {
    let f = null;
    try { f = await repo.getFile(sha256); } catch { f = null; }
    const u = displayUrl(f);
    if (u) {
      boite.replaceChildren(el('iframe', { class: 'pdf', title: filename, sandbox: '', src: u }),
        el('div', { class: 'row' },
          el('button', { class: 'btn', onClick: () => downloadBlob(f.blob, filename) }, t('Télécharger le fichier')),
          el('small', { class: 'muted' }, t('Si l’aperçu reste vide, télécharge le fichier.'))));
      return;
    }
    const enfants = [el('p', { class: 'muted' }, t('Ce fichier n’est pas encore sur cet appareil.'))];
    if (connecte && typeof telecharger === 'function') {
      const b = el('button', { type: 'button', class: 'btn', onClick: async () => { b.disabled = true; b.textContent = t('Téléchargement…'); try { await telecharger(sha256); } finally { await remplir(); } } }, t('Télécharger'));
      enfants.push(el('div', { class: 'row' }, b));
    }
    boite.replaceChildren(...enfants);
  };
  remplir();
  return boite;
}

// === Lot G : les fichiers qui ne sont pas encore ici (§ 4.2-4.4)
// Le contexte des fichiers d'un écran : le compte (connecté, sinon celui que l'appareil a connu — sync_state.user_id —, pour reconnaître un remote
// de ce compte et dire « Connecte-toi pour la télécharger »), les file_error et le moteur (le seul qui télécharge, R53).
export async function contexteFichiers(ctx) {
  const sync = ctx?.sync || {};
  const moteur = sync.moteur || null;
  let uid = sync.user?.id || null;
  let erreurs = new Set();
  try {
    if (!uid) uid = (await repo.get('sync_state', 'user_id'))?.value || null;
    erreurs = new Set((await lireErreursFichiers(repo.db)).keys());
  } catch { /* base illisible : ni compte connu ni erreur affichée */ }
  return { connecte: !!sync.user && !!moteur, uid, erreurs, moteur };
}

// Le geste « Télécharger » d'un écran : sur une TAPE seulement (R-G-1), par le moteur ; puis l'écran redessine ce qui a changé — jamais un
// refresh() de la route (/import est une route de saisie) ; un échec se dit.
export function gesteTelechargement({ moteur, redessiner = async () => {}, dire = toast }) {
  return async (sha256s, { reessayer = false } = {}) => {
    const liste = Array.isArray(sha256s) ? sha256s : [sha256s];
    let r = null;
    try { r = reessayer ? await moteur?.reessayerFichier(liste[0]) : await moteur?.telecharger(liste); } catch { r = null; }
    invalidate();
    await redessiner(liste);
    if (!(r?.recus > 0)) dire(t('Le téléchargement n’a pas abouti.'));
    return r;
  };
}

const TEXTES_VIGNETTE = {
  distant: 'Pas encore sur cet appareil',
  sans_compte: 'Connecte-toi pour la télécharger',
  absent: 'Pas encore envoyée par l’appareil qui l’a prise',
  pas_recue: 'Pas encore reçue',
  erreur: 'Fichier illisible reçu du serveur.',
};

// Une miniature de page (§ 4.3) : avec octets, l'image (displayUrl, le type par la liste blanche) ; sinon un figure.fichier-absent qui DIT l'état
// et n'offre que le geste qui a un sens — « Télécharger » (distante, compte) ou « Réessayer » (erreur).
export function vignettePage(page, fichier, { connecte = false, uid = null, erreurs = new Set(), telecharger = null } = {}) {
  if (fichier?.blob instanceof Blob) {
    const img = el('img', { alt: t('Page'), loading: 'lazy' });
    const u = displayUrl(fichier);
    if (u) img.src = u;
    return img;
  }
  const etat = fichier ? etatFichier(fichier, { uid, erreurs }) : 'pas_recue';
  const texte = TEXTES_VIGNETTE[etat === 'distant' && !connecte ? 'sans_compte' : etat];
  const fig = el('figure', { class: 'fichier-absent', dataset: { etat, sha256: String(page?.sha256 || '') } }, el('small', null, t(texte)));
  const geste = (libelle, reessayer) => {
    const b = el('button', { type: 'button', class: 'btn small', onClick: async () => {
      b.disabled = true; b.textContent = t('Téléchargement…');
      try { await telecharger(page.sha256, { reessayer }); } finally { if (b.isConnected) { b.disabled = false; b.textContent = libelle; } }
    } }, libelle);
    return b;
  };
  if (typeof telecharger === 'function' && etat === 'distant' && connecte) fig.append(geste(t('Télécharger'), false));
  if (typeof telecharger === 'function' && etat === 'erreur') fig.append(geste(t('Réessayer'), true));
  return fig;
}

// Les miniatures d'une liste de pages — UNE définition pour la fiche du livre, la séance et la fiche recette : chaque page a sa place, redessinée
// seule après un téléchargement. `distantes` = les pages téléchargeables, dans l'ordre des pages (pour « Télécharger les {n} pages »).
export async function vignettesDePages(pages, ctxF) {
  const places = new Map(pages.map((p) => [p.id, el('div', { class: 'vignette-page' })]));
  const dessiner = async (liste) => {
    const fichiers = await repo.getFiles(liste.map((p) => p.sha256));
    for (const p of liste) places.get(p.id)?.replaceChildren(vignettePage(p, fichiers.get(p.sha256), { ...ctxF, telecharger }));
    return fichiers;
  };
  const telecharger = gesteTelechargement({ moteur: ctxF.moteur, redessiner: async (shas) => {
    try { ctxF.erreurs = new Set((await lireErreursFichiers(repo.db)).keys()); } catch { /* garde les erreurs connues */ }
    await dessiner(pages.filter((p) => shas.includes(p.sha256)));
  } });
  const fichiers = await dessiner(pages);
  const distantes = pages.filter((p) => { const f = fichiers.get(p.sha256); return !!f && !(f.blob instanceof Blob) && etatFichier(f, ctxF) === 'distant'; }).map((p) => p.sha256);
  return { places, distantes, telecharger };
}

// « Télécharger les {n} pages » (§ 4.3, § 4.4) : un geste, en série dans l'ordre des pages ; seulement à partir de deux pages et avec un compte.
export function boutonTelechargerPages(distantes, { connecte = false, telecharger = null } = {}) {
  if (!connecte || typeof telecharger !== 'function' || distantes.length < 2) return null;
  const b = el('button', { type: 'button', class: 'btn small', onClick: async () => { b.disabled = true; try { await telecharger(distantes); } finally { if (b.isConnected) b.disabled = false; } } }, t('Télécharger les {n} pages', { n: distantes.length }));
  return el('div', { class: 'row' }, b);
}
```

  `src/ui/livre-ajout.js` (`renderZoneCouverture`), en tête de la rangée des boutons (les trois boutons existants inchangés) :

```js
          etat.telechargeable ? el('button', { type: 'button', class: 'btn primary', disabled: !!etat.telechargement, onClick: g('telecharger') }, etat.telechargement ? t('Téléchargement…') : t('Télécharger')) : null,
          etat.reessayable ? el('button', { type: 'button', class: 'btn', disabled: !!etat.telechargement, onClick: g('reessayer') }, t('Réessayer')) : null,
```

  `src/ui/book.js` : imports `contexteFichiers, vignettesDePages, boutonTelechargerPages` (de `./components.js`), `etatFichier` (de
  `../sync/fichiers.js`), `invalidate` (de `./state.js`) ; `displayUrl` retiré s'il n'est plus lu. Après la lecture de `fichierCouverture` :

```js
  // Lot G (§ 4.2) : l'état de la couverture dit ce que la personne peut faire — télécharger (distante, compte), se connecter, ou attendre l'appareil
  // qui l'a prise. Sans ligne files du tout (pointeur arrivé avant sa ligne), le texte d'avant (tests/ajouter.js « un pointeur sans ligne files le DIT »).
  const ctxF = await contexteFichiers(ctx);
  const decrireCouverture = (fichier) => {
    const rien = { message: null, telechargeable: false, reessayable: false };
    if (!edition.cover_sha256 || fichier?.blob instanceof Blob) return rien;
    if (!fichier) return { ...rien, message: t('La couverture n’est pas sur cet appareil.') };
    const etat = etatFichier(fichier, ctxF);
    if (etat === 'erreur') return { ...rien, message: t('Fichier illisible reçu du serveur.'), reessayable: !!ctxF.moteur };
    if (etat === 'distant') return ctxF.connecte ? { ...rien, message: t('La couverture n’est pas sur cet appareil.'), telechargeable: true } : { ...rien, message: t('La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.') };
    return { ...rien, message: t('La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.') };
  };
```

  `etatCouv` devient `{ sha256: edition.cover_sha256 || null, apercu: fichierCouverture?.blob ? urlDeBlob(fichierCouverture.blob) : null, enCours: false,
  telechargement: false, ...decrireCouverture(fichierCouverture) }` ; `gestesCouv` gagne :

```js
    // Sur une tape seulement (R-G-1). Succès : la zone se redessine avec l'image, le cache est invalidé et la fiche se rend (bookCover de l'en-tête).
    telecharger: async (reessayer = false) => {
      if (etatCouv.telechargement) return;
      etatCouv.telechargement = true; dessinerCouv();
      try { if (reessayer) await ctxF.moteur?.reessayerFichier(edition.cover_sha256); else await ctxF.moteur?.telecharger([edition.cover_sha256]); } catch { /* dit plus bas */ }
      etatCouv.telechargement = false;
      const f = await repo.getFile(edition.cover_sha256);
      if (f?.blob instanceof Blob) { invalidate(); Object.assign(etatCouv, { apercu: urlDeBlob(f.blob) }, decrireCouverture(f)); dessinerCouv(); refresh(); return; }
      Object.assign(ctxF, await contexteFichiers(ctx));
      Object.assign(etatCouv, decrireCouverture(f));
      dessinerCouv();
      toast(t('Le téléchargement n’a pas abouti.'));
    },
    reessayer: () => gestesCouv.telecharger(true),
```

  et la boucle des miniatures de « Pages et fichiers sources » devient :

```js
    const triees = [...pages].sort((a, b) => (a.printed_page ?? 9999) - (b.printed_page ?? 9999));
    const vignettes = await vignettesDePages(triees, ctxF);
    const thumbs = el('div', { class: 'thumbs' }, ...triees.map((p) => el('figure', null, vignettes.places.get(p.id),
      el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : t('page non numérotée'), p.kind ? ` · ${p.kind === 'index' ? t('index') : t('recette')}` : ''))));
```

  et la section reçoit `boutonTelechargerPages(vignettes.distantes, { connecte: ctxF.connecte, telecharger: vignettes.telecharger })` entre sa phrase et
  `thumbs`.

  `src/ui/import.js` : imports `contexteFichiers, vignettesDePages, boutonTelechargerPages, gesteTelechargement` (ajoutés à l'import existant de
  `./components.js`), `remoteDeCeCompte` (de `../sync/tables.js`) ; `logError` est **déjà** importé (l. 6 : une seconde liaison du même nom
  serait une SyntaxError, le module ne se chargerait plus) ; `displayUrl` retiré ; `sessionView` devient `async function
  sessionView(…)` (`renderImport` rend déjà sa promesse ; sa signature à `3601a52` porte un quatrième paramètre `{ historique }`, lot A, inchangé). En tête de `sessionView` : `const ctxF = await contexteFichiers(ctx);`. La rangée des statuts
  remplace le `status info` « Aucune synchronisation serveur configurée … » par `phraseSeance` :

```js
  // Lot G (§ 4.3, I5, F-21) : la phrase de séance dit un FAIT — les pages dont la ligne a un remote de ce compte. /import est une route de saisie :
  // doitRendreApresPasse refuse le rendu, donc cette ligne SEULE se redessine sur onEtat (jusqu'à ce que l'écran soit quitté).
  const phraseSeance = el('span', { class: 'status info', dataset: { role: 'phrase-seance' } });
  const majPhrase = async () => {
    if (!ctx.sync?.user) { phraseSeance.textContent = t('Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages'); return; }
    const fs = await repo.getFiles(pages.map((p) => p.sha256));
    const n = pages.filter((p) => remoteDeCeCompte(fs.get(p.sha256)?.remote, ctxF.uid)).length;
    phraseSeance.textContent = t('{n}/{m} photos de cette séance envoyées au serveur', { n, m: pages.length });
  };
  await majPhrase();
  if (typeof ctxF.moteur?.onEtat === 'function') {
    let montee = false;
    const retirer = ctxF.moteur.onEtat(() => {
      if (!phraseSeance.isConnected) { if (montee) retirer(); return; }
      montee = true;
      majPhrase().catch((error) => logError('seance.phrase', { error }));
    });
  }
```

  Les miniatures : `const vignettes = await vignettesDePages(pages, ctxF);` avant la boucle ; dans la boucle, la figure prend `vignettes.places.get(p.id)`
  à la place de l'`img` (le numéro, la case, le champ « p. imprimée » et les puces inchangés) ; au-dessus de `thumbs`, `boutonTelechargerPages(
  vignettes.distantes, { connecte: ctxF.connecte, telecharger: vignettes.telecharger })` s'il n'est pas nul. Le cadre PDF :
  `pdfFrame({ sha256: d.sha256, filename: d.original_filename, connecte: ctxF.connecte, telecharger: gesteTelechargement({ moteur: ctxF.moteur }) })`.

  `src/ui/recipe.js` : imports `contexteFichiers, vignettesDePages, boutonTelechargerPages, vignettePage, gesteTelechargement` (ajoutés à l'import
  existant de `./components.js`), `lireErreursFichiers` (de `../sync/fichiers.js`) — l'import de `mime.js` est `{ displayUrl, typeAffichage }`
  depuis la tâche 1, rien à y changer ; `const ctxF = await contexteFichiers(ctx);` avant `photoDuPlat` ; `const photo = await photoDuPlat(recipe,
  ctxF);` ; « Original » :

```js
  if (pages.length) {
    const vignettes = await vignettesDePages(pages, ctxF);
    root.append(section(t('Original'), el('p', { class: 'muted' }, t('Pages du livre telles que photographiées. Une adaptation n’est jamais présentée comme le texte original.')),
      boutonTelechargerPages(vignettes.distantes, { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
      el('div', { class: 'thumbs' }, ...pages.map((p) => el('figure', null, vignettes.places.get(p.id), el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : ''))))));
  }
```

  (la branche `else if (recipe.printed_page && recipe.origine !== 'ia')` inchangée) ; `referenceOnly` devient `async function referenceOnly()`, appelée par
  `root.append(await referenceOnly())`, et sa section « Pages d'index » est bâtie de même (`vignettesDePages`, `boutonTelechargerPages`, une `figure` par
  page) — sa première branche, le signet web du lot B (`if (recipe.source_url) return … blocSignet(…)`), reste telle quelle et rend avant toute
  vignette (R-G-12) ; `photoDuPlat` :

```js
// Photo du plat (lot A D-4 ; lot G § 4.4 : la règle de la couverture). Aucune ligne files : rien, pas même un cadre (tests/import-cible.js) ; avec
// octets d'un type d'image de la liste : l'image ; sans octets : la vignette d'état, avec « Télécharger » sur une tape (R-G-1).
async function photoDuPlat(recipe, ctxF) {
  if (typeof recipe?.photo_sha256 !== 'string' || !recipe.photo_sha256) return null;
  let fichier = null;
  try { fichier = await repo.getFile(recipe.photo_sha256); } catch { fichier = null; }
  if (!fichier) return null;
  const figure = el('figure', { class: 'photo-plat', dataset: { role: 'photo-plat' }, style: { margin: '0 0 .8rem' } });
  const dessiner = (f) => {
    if (f?.blob instanceof Blob) {
      const src = typeAffichage(f)?.startsWith('image/') ? displayUrl(f, urlDeBlob) : null;
      if (!src) return false;
      figure.replaceChildren(el('img', { alt: t('Photo du plat'), src, loading: 'lazy', style: { display: 'block', width: '320px', maxWidth: '100%', borderRadius: 'var(--radius)' } }));
      return true;
    }
    figure.replaceChildren(vignettePage({ id: 'photo', sha256: recipe.photo_sha256 }, f, { ...ctxF, telecharger }));
    return true;
  };
  const telecharger = gesteTelechargement({ moteur: ctxF.moteur, redessiner: async () => {
    try { ctxF.erreurs = new Set((await lireErreursFichiers(repo.db)).keys()); } catch { /* garde les erreurs connues */ }
    dessiner(await repo.getFile(recipe.photo_sha256));
  } });
  return dessiner(fichier) ? figure : null;
}
```

  `styles.css` (après les règles `.thumbs`) — jetons seulement, aucune couleur en dur ni `display: none` (T-2 et l'inventaire de `tests/theme.js`) :

```css
.thumbs .fichier-absent { margin: 0; min-height: 140px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: .3rem; padding: .4rem; border: 1px dashed var(--line); border-radius: 8px; font-size: .75rem; color: var(--muted); }
.photo-plat .fichier-absent { margin: 0; padding: .6rem; border: 1px dashed var(--line); border-radius: var(--radius); color: var(--muted); }
```

- [ ] **Step 5 : `en.js`** (avant `};`, sous `// Lot G : écrans (§ 4.2-4.5).`), les treize entrées (« Fichier illisible reçu du serveur. » et
  « Réessayer » existent depuis la tâche 5 et L3 ; « Page », l'`alt` de `vignettePage`, n'a pas d'entrée à `bd03e48` — constat du réviseur) :

```js
  "Page": "Page",
  "Télécharger": "Download",
  "Télécharger les {n} pages": "Download the {n} pages",
  "Téléchargement…": "Downloading…",
  "Le téléchargement n’a pas abouti.": "The download did not complete.",
  "Pas encore sur cet appareil": "Not on this device yet",
  "Connecte-toi pour la télécharger": "Sign in to download it",
  "Pas encore envoyée par l’appareil qui l’a prise": "Not yet sent by the device that took it",
  "Pas encore reçue": "Not received yet",
  "La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.": "The cover is not on this device. Sign in to download it.",
  "La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.": "The cover is not on this device: the device that took it has not sent it yet.",
  "Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages": "Without an account these photos stay on this device: back up from Settings",
  "{n}/{m} photos de cette séance envoyées au serveur": "{n}/{m} photos of this session uploaded to the server",
```

  `tests/ajouter.js`, `CHAINES_NEUVES_AILLEURS` — trois clés **existantes**, on ajoute à leurs listes, jamais une seconde clé du même nom (le
  littéral garderait la dernière, sans erreur) : `['../src/ui/components.js']` + les dix chaînes du bloc suivant ; `['../src/ui/book.js']` + les
  deux phrases de couverture ci-dessus, « Fichier illisible reçu du serveur. » et « Le téléchargement n’a pas abouti. » ; `['../src/ui/import.js']`
  (qui porte une chaîne à `3601a52` — les trois autres ont rejoint `import-cible.js` à la ronde 1 de la tâche 6 du lot A, C-3) + les deux phrases de
  séance ci-dessus. `sw.js` : `VERSION = 'cuisine-os-v0.11.0-6'`. Les dix chaînes de
  `components.js` :

```js
'Page', 'Télécharger', 'Téléchargement…', 'Télécharger les {n} pages', 'Le téléchargement n’a pas abouti.', 'Pas encore sur cet appareil', 'Connecte-toi pour la télécharger', 'Pas encore envoyée par l’appareil qui l’a prise', 'Pas encore reçue', 'Fichier illisible reçu du serveur.',
```

- [ ] **Step 6 : documents.** `docs/architecture.md` : la section « Ce qui est absent (L4 et L5) » devient « Fichiers (L4, lot G) et ce qui reste absent
  (L5) » — premier point remplacé par : « **Octets des fichiers** (L4, lot G) : `src/sync/fichiers.js` (définitions uniques et passe « fichiers »),
  `createStockage` dans `src/sync/transport.js` (seau privé `pages`, `upload`/`download`/`list`, jamais d'URL publique ni de suppression) ; `files.remote`
  est un objet `{ sha256, size, mime, quality, uploaded_at, owner }` (plus `true`) ; envoi après les fiches, réduit par défaut, l'original reste ici ;
  téléchargement sur une tape ou par « Télécharger toutes les pages » ; espace mesuré sans plan ; archive à `missing_files` et `bytes_*` (R18) ;
  `identiques` compare la projection serveur (R56). » ; les trois phrases « les **octets des fichiers**, eux, ne partent pas encore (L4) » (§ principes, l. 6),
  « Pas les **octets** des fichiers (L4) » (section L3, l. 179) et « les **octets des fichiers** (photos, PDF) ne partent pas encore » (« Limites
  connues de V0 », l. 1276 à `3601a52`, 882 à `bd03e48` : le lot B a ajouté ses sections avant elle) amendées « (depuis le lot G : voir “Fichiers (L4)”) »
  — la section du lot A (« Ce qui est absent. … octets entre appareils (G) … », l. 1032 à `3601a52`) reste telle quelle, comme le lot B y a laissé
  « Lecture d'une page web (B) » (R-G-13). `docs/spec-compte-et-stockage-distant.md`,
  après la dernière ligne R de § 11 — R65 à `bd03e48` comme à `3601a52` (ni le lot A ni le lot B n'en ont posé ; relever le dernier numéro au moment
  d'écrire, le revérifier à la fusion) —, une ligne au numéro suivant (**R66**) :

```markdown
- **R66 (19 octobre 2026) — amende § 5.3, § 5.4, § 8 ligne L4, R18 et R55 ; spec `docs/superpowers/specs/2026-10-19-photos-entre-appareils-design.md` (lot G).**
  Le module s'appelle `src/sync/fichiers.js` (et non `files.js`) ; la qualité d'envoi est notée dans `files.remote.quality` — un FAIT mesuré, jamais le
  réglage — et non dans la provenance de la page (`upload_quality` par appareil) ; `remote` est un objet descripteur `{ sha256, size, mime, quality,
  uploaded_at, owner }`, plus `true` (R55 ; `missing_files` de R18 porte `remote` objet ou absent) ; le « déjà présent » se vérifie par `list` + taille et
  non par `download` + recalcul ; l'erreur d'un fichier vit dans `sync_state.file_error:<sha256>`, pas dans une entrée de file ; une tombale `files` ne
  supprime jamais un blob local — la ligne reste, `remote` passe à `null` (D-G15, N-4) ; l'espace serveur affiché est une mesure du dossier du compte,
  sans mention de plan ni de quota (R-G-5), et la phrase de pause de quota des fiches (§ 5.3) perd sa parenthèse « (1 Go au palier
  gratuit) » (R-G-5, ruling P2) ; `putFile(…, { origin: 'remote' })` écrit par `fusionnerOctetsRecus` (le DOIT de § 5.4 tenu).
```

  `supabase/README.md`, étape 7, à la fin du paragraphe : « L4 utilise ces règles (lot G) ; l'espace est mesuré par l'app en listant son dossier ; le quota
  est celui du projet, l'app ne le connaît pas. »
- [ ] **Step 7 : vert** — la suite entière, dont les tests existants des écrans (`tests/ajouter.js` « fiche : un pointeur sans ligne files le DIT », les
  fiches et photos du plat de `tests/import-cible.js`) sans autre retouche que les deux assertions `pdfFrame` du Step 2. Épingle relevée ; Node et
  `--check` inchangés ; preuve visuelle : non requise (aucun jeton de thème touché, deux règles à jetons — `tests/theme.js` les lit). **Mesuré au rejeu** :
  seule l'épingle rouge (obtenu 4193), puis 4194/4194 (épingle 4193), seul le 404 de `/favicon.ico` ; Node 174 ; `--check` 0 ; `APP_VERSION 0.11.0`,
  `sw.js cuisine-os-v0.11.0-6`, `DB_VERSION 4`.
- [ ] **Step 8 : invisibles** (Python) sur les fichiers touchés, documents compris.
- [ ] **Step 9 : commit** `Ecrans L4 : couverture, vignettes et cadre PDF par etat, telechargement sur une tape, phrase de seance abonnee ; R66 et architecture (lot G, tache 6)`.

---

### Clôture (contrôleur, hors tâche)

- **Revue finale de branche** (panel, trois lentilles : correctness, sécurité, faux-vert), une vague de corrections au plus, re-revue ciblée. Points à
  relire à la main, que la suite n'exerce pas : le câblage de `messageOriginauxConserves` dans `appliquerArchive` (confirmDialog importé, pas injecté) ;
  le fil de `src/app.js` (jamais importé) ; `src/ui/recipe-edit.js` (`pdfFrame` sans téléchargement, doute 15). Le rapport d'inspection
  (`restoreReport` : puces, phrase, phrase de remplacement) est désormais éprouvé, par `pickFiles` injecté (tâche 2, test f2).
- **`/verify`** : suite (`node .superpowers/sdd/2026-10-19-photos-entre-appareils/suite.cjs 8090` : BILAN vert, seul le 404 de `/favicon.ico` en
  console), `node --test tools/*.test.mjs`, `node tools/generer-migrations.mjs --check` (0 : aucune migration — le lot n'en a pas), scan des secrets
  (`git grep -nEi 'sk-ant-[0-9A-Za-z_-]{10,}'` : seules les sentinelles connues ; aucune URL de projet ni clé neuve), invisibles (Python) sur tout le diff,
  **mutants rejoués** sur une copie servie à part (8091) : chacun de ceux que nomment les libellés de `tests/sync-l4.js` (§ 7 de la spec : borne de taille
  et champ en plus de `remoteValide`, `blob` gardé par la projection, `imports.photo_sha256` retiré, owner ignoré, `delete fiche.remote`, `fiche.remote =
  true`, `deletes.files` réintroduit, tombale ignorée, clé `file_error` gardée, spread nu dans `adjusted` et `garderAilleurs`, `wanted` sans `remote`,
  `deletes` capturés, filtre de l'envoi initial retiré, `identiques` sans projection, mur de pixels retiré, seuil `octetsTelQuel` retiré, HEIC refusé, 409
  sans `lister`, `statusCode` ignoré, `remote` écrit malgré `verification`, borne de 50 Mo, passe continuée après `reseau`, `pause` au lieu de
  `pause_fichiers`, borne de temps, écriture écrasante, `updated_at` ignoré, garde de la rév. 2, `estOriginalIci` ignoré, copie candidate, `enVol`
  retiré, clé `telecharger_tout` jamais retirée, pagination retirée, levée « Fichier source endommagé », `bytes_sha256` ignoré, `comparableFiles` sans
  filtre, `requireInspection` sans `missing` ou à `size`, « blob tel quel », comparaison brute, `existingFiles` vide en remplacement, `garder` sans
  `!entreeOriginale`, `remote` comparé sans condition, `missing` oublié dans le décompte, `planifier` non appelé, pas de reprise, passe fichiers sous
  `pause_fichiers`, vol non tenu, `compter` qui relit, stockage hors du compteur, barre ou palier, `objets` ignoré, bouton sur `trop_gros`, action
  renommée, cadre avant la résolution, phrase non abonnée, compte sur `blob` ; ajoutés par la rév. 2 : `dejaPresent` sans `statusCode` (forme 400 sans `code`), `poserImage`,
  `bookCover` et `photoDuPlat` sur `safeDisplayType(mime)` (celui de `photoDuPlat` sur la fixture `application/pdf` + JPEG de la rév. 3, P1 :
  la fixture HEIC de la rév. 2 le laissait vivant), garde de la passe unique par un second `mutate`, `file.remote` exigé par
  `createArchive` dès la tâche 1, `elementFichier` sans la garde remote, « Réessayer » de la couverture vers `telecharger`, toast d'échec
  retiré, puces d'inspection non rendues, phrase de remplacement retirée, `push.envoyer` appelé malgré `pause` ; ajoutés par la rév. 3 :
  ancien texte de pause L3 « (1 Go au palier gratuit) » gardé (P2), passe fichiers sautée sous `pause` L3 (P3)) — chacun rouge, consigné avec
  son compte.
- **Docs** : `CLAUDE.md` (section « Les photos voyagent entre appareils (lot G) » : où, ce qui marche, ce qui n'est PAS prouvé — aucune passe réelle
  contre le seau `pages`, Safari et l'iPhone, la forme réelle du 409/404/413, le mur de 16 Mpx —, dettes, gestes de Neegan, versions, bilan),
  `STATE.md`, `docs/architecture.md` (relue après la vague), spec § 12 « Ce que la construction a amendé » (une ligne par ruling de construction, dont les
  doutes de ce plan tranchés), **et les amendements de la spec dus par la rév. 3** — (**P5**) **§ 7, I-G9 et § 9 tâche 1 : I-G9 = 17 lignes**,
  liste exacte (numéros à `bd03e48`, identiques à `3601a52`, relus au Step 0) : `tests/sync-l3.js` l. 100 (libellé seul), 527, 528, 529, 537, 543, 545, 682 et
  `tests/assistant-compte.js` l. 388, 395, 401 (tâche 1) ; `tests/sync-l3.js` l. 1703, 1708 (tâche 4) ; `tests/sync-l3.js` l. 1237, 1326
  (tâche 5) ; `tests/sync.js` l. 124, 125 (tâche 6) ; (**P3**) **§ 11, une ligne** : « Pause L3 de quota (`sync_push`) et passe fichiers : sous
  `sync_state.pause`, la passe fichiers tourne — le stockage n'est pas le quota des fiches (D-G4) ; les octets montent, la ligne `files`
  confirmée attend en file la levée de la pause (« Envoyer maintenant ») ; éprouvé par le test « moteur (pause L3 + stockage) » (tâche 4). » ;
  (**P4**) **§ 11, dette nommée** : « `pdfFrame` de `src/ui/recipe-edit.js` n'est pas câblé : sur l'écran de correction, un PDF absent dit
  « Ce fichier n’est pas encore sur cet appareil. » sans « Télécharger », et les pages photographiées de cet écran restent des `<img>` vides
  quand leurs octets manquent (préexistant) ; lot suivant : `contexteFichiers`, `gesteTelechargement` et `vignettesDePages`, comme
  `import.js`. » ; (**P2**) § 5 : la phrase de pause L3 sans palier et son anglais ; puis copie du registre `.superpowers/sdd/2026-10-19-photos-entre-appareils/` dans `~/projects/mistu/.superpowers/sdd/`
  **avant** tout `git worktree remove` (`diff -rq` muet).
- **Gestes de Neegan** : fusion `--ff-only` dans l'ordre de la chaîne (G est bâti sur la tête finale de B : B fusionne d'abord, G garde `0.11.0` ; texte
  d'origine, pour mémoire : si le lot B est fusionné d'abord, rebaser `photos-entre-appareils` dessus :
  `APP_VERSION 0.11.0` garde son numéro ; si G fusionne avant B, G prend `0.10.0` — pins `v0\.10\.0-\d+` / `'0.10.0'` dans les six suites — et B
  rebase), puis `git push`, BILAN de la suite publique lu ; **aucune migration à coller**. Preuve réelle, spec § 10, gestes 1 à 8 (iPhone → Mac même
  empreinte ; fichier de plus de 50 Mo ; archive à pages manquantes ; PDF en cadre sur iPhone ; « Télécharger toutes les pages » et durée d'une passe ;
  Originale et renvoi ; **forme réelle du « déjà présent »** collée dans `CLAUDE.md` ; **mur de 16 Mpx mesuré** sur l'iPhone) — si une mesure contredit la
  spec (§ 11), la spec s'amende avant la suite ; « clean » seulement après la copie du registre.

---

### Doutes (rév. 1, mis à jour en rév. 2 et en rév. 3 ; numérotés comme les renvois du texte)

1. **I-G9 dit onze assertions amendées ; il en faut dix-sept** (quinze en rév. 2 ; dix-sept en rév. 3 : P2 ajoute `tests/sync-l3.js`
   l. 1237 et 1326, en tâche 5). En plus des onze de la spec : les deux `pdfFrame` de `tests/sync.js`
   (« pdfFrame : iframe sandbox present avant resolution », « pdfFrame : bouton Télécharger le fichier toujours present »), que § 4.5 / B-24
   contredisent mot pour mot (tâche 6, Step 2) ; `tests/assistant-compte.js` l. 401 (hors production, progression 24 → 25 : la spec l'oublie) ;
   le libellé de `tests/sync-l3.js` l. 100 (« la retenue passe AVANT la relecture » devient faux). Et l. 1703/1708 passent de la tâche 1 à la
   tâche 4 (seul le moteur pose `fichiersRecus`). La spec § 7 (« Assertions L3 amendées »), I-G9 et § 9 tâche 1 sont à corriger à la clôture (P5 : I-G9 = 17 lignes, liste
   exacte dans « Clôture »).
2. **`MODULES_NEUFS` et `CHAINES_NEUVES_AILLEURS` vivent dans `tests/ajouter.js`** (exportées), pas dans `tests/creer-ia.js` comme le disait la
   consigne (et le plan du lot A) ; le plan les complète là.
3. **Versions en tâche 1, pas en tâche 6** (§ 9) : un `APP_VERSION` changé sans ses pins rougit six suites ; tout monte ensemble en tâche 1.
   `0.11.0` suit D-G11 (B fusionné d'abord) ; l'ordre réel des fusions décide au geste de Neegan.
4. **Branche, worktree, port** : la consigne dit `photos-entre-appareils` / `~/projects/mistu-import` / 8090 ; la spec (en-tête) disait
   `octets-fichiers` / `~/projects/mistu-fichiers` / 8089. Le plan suit la consigne. `mistu-import` est le worktree du lot A, **encore écrit pendant
   la rédaction** (tâche 5 ronde 1 commise en `f8cfafa` — `displayUrl(fileRow, creerUrl)` —, tâche 6 en cours : `marquerInterrompus` et
   `purgerImportsAnciens` ajoutées à `init()`) : rien ne commence avant sa clôture, et chaque nom est à relire à sa tête finale (le plan nomme des
   symboles, pas des lignes ; `convertirRemoteBooleen` s'insère juste après `purgerFilesEnFile()`, quel que soit ce qui suit). **Rejeu** : le Départ a
   créé le worktree PROPRE au lot, `~/projects/mistu-photos-entre-appareils`, port 8090, sur la tête finale du lot B (`cf91f09`, puis `3601a52`).
5. **§ 7 « remote.mime hors liste → type sans appel » est inatteignable** : `remoteValide` refuse un type hors liste, donc le motif est `forme` (sans
   appel) — c'est ce que le plan éprouve ; le contrôle `isAllowed(remote.mime)` après la descente reste en défense (I-G7). De même, § 4.8 range
   `refus` en `introuvable` : le mutant « `statusCode` ignoré » du 404 n'est pas tuable de bout en bout ; il l'est par le test pur
   d'`introuvable` (tâche 3).
6. **`etatFichier(row, { uid, erreurs })` sans `connecte`** : l'état ne dépend pas de la connexion ; l'écran lit `connecte` pour offrir
   « Télécharger » ou dire « Connecte-toi pour la télécharger ». Écart de signature avec § 3.1.
7. **`nomFichier`** : « titre de la version courante » — les versions ne portent pas de titre (le titre est `recipes.original_title`, vérifié dans
   `import-cible.js` et `search.js`) ; « Photo importée · {date} » rend la date `AAAA-MM-JJ` (module de `src/sync/`, chargé sous Node : pas de
   `formatDate` du DOM).
8. **`fichiers.aRenvoyer`** ajouté aux compteurs de § 3.6 : § 4.1 item 5 exige que `compter()` compte les candidates du renvoi, et l'état les porte.
9. **`gestesL4Pour({ obtenirMoteur, dire, rafraichir, journaliser })`** sans le `db` de § 4.1 : aucun geste L4 n'écrit hors du moteur (porte
   unique : `src/ui/` n'appelle jamais `db.mutate`).
10. **Précisions de comportement non écrites par la spec**, à ratifier : (a) une couverture **sans ligne `files`** garde le texte d'aujourd'hui
    (aucun état : pointeur arrivé avant sa ligne — `tests/ajouter.js` l'épingle) ; (b) la photo du plat sans octets prend les textes génériques de la
    vignette, pas ceux de la couverture ; (c) un **renvoi** part toujours en originale même si le réglage est revenu à Réduite (sinon : 409 et
    « déjà posé » à chaque passe, une boucle) ; (d) un `adjusted` sur `files` sans fiche locale connue ne réécrit rien (plus strict que « réécrit
    comme avant ») ; (e) l'`alt` des miniatures devient « Page » partout (était « Page originale » et « Page {position} ») ; (f) une entrée `delete`
    de `files` dans la file est retenue, jamais envoyée en tombale.
11. **Factice** : l'option `avant(methode, chemin)` s'ajoute à la liste de § 7 (elle porte (j), (l), (l2) et la descente modifiée) ; les API sans
    stockage rendent `{ rien: true }`.
12. **Test (f) de l'archive** — **tranché en rév. 2** : `renderSettings` reçoit `telechargerArchive` (comme `createArchive`) ; le test (f)
    ne lance plus de téléchargement dans le Chrome sans tête, et compte l'appel injecté.
13. **Texte de pause L3 « Espace serveur plein (1 Go au palier gratuit) — … »** (`src/ui/settings.js` l. 846, `en.js` l. 141) — **tranché par
    le ruling P2 (rév. 3)** : amendé **dans ce lot**, en tâche 5 (R-G-5 : aucune promesse de palier ; `mitsu` est sur une organisation Pro) :
    « Espace serveur plein — rien n’est perdu, tout reste sur cet appareil. », son entrée `en.js` remplacée, les deux assertions
    `tests/sync-l3.js` l. 1237 et 1326 (`includes('1 Go')`) réécrites en égalité exacte avec le texte neuf ; I-G9 passe à dix-sept lignes ; R66
    nomme § 5.3 de la spec parente. (Rév. 2 : hors lot par défaut, décision laissée à Neegan.)
14. **`pause` (L3) posée avec un stockage** : la passe fichiers **tourne** — § 4.7 la conditionne à `stockage`, hors `pause_fichiers` et sans
    `envoiBloque`, et sous `pause` `bilanEnvoi` est nul, donc `envoiBloque` faux. Les octets montent au seau, qui a son propre quota (D-G4) ; la
    ligne confirmée attend en file la levée de la pause. Le plan l'affirme par un test (tâche 4) ; **ratifié par P3 (rév. 3)** : le stockage n'est pas le quota des fiches, une ligne de
    § 11 de la spec à la clôture. L'autre choix — écarté — (`pause` suspend
    aussi la passe fichiers) tiendrait en une condition dans `passe()` et ce test retourné.
15. **`pdfFrame` dans `src/ui/recipe-edit.js`** (l. 86 à `bd03e48`, l. 89 à `4cb99a0`, l. 94 à `3601a52` ; troisième appelant) : non
    câblé — **tranché par P4 (rév. 3)** : dette nommée dans la Clôture (spec § 11), pas de tâche. Sur l'écran de correction, un PDF absent dit « Ce fichier
    n’est pas encore sur cet appareil. » sans « Télécharger » (la fiche recette et la séance, elles, téléchargent) ; les pages photographiées de
    cet écran restent des `<img>` vides quand leurs octets manquent (préexistant, hors § 4). Lot suivant : `contexteFichiers` +
    `gesteTelechargement` comme `import.js`, et `vignettesDePages`.
16. **CSP et `fetch` d'une URL `blob:`** (constat du réviseur) : la rév. 1 lisait le type affiché par `fetch(displayUrl(…))` ; la CSP de
    `tests/index.html` ne nomme pas `blob:` dans `connect-src`, et `'self'` ne le couvre pas (CSP 3). D'où l'espion de `URL.createObjectURL` et le
    `creerUrl` injecté. Non rejoué dans Chrome ici (lecture seule, aucun navigateur) ; si le `fetch` passait, rien ne change : l'espion lit le Blob
    lui-même, plus directement.
17. **Spec à amender à la clôture** (§ 12 « Ce que la construction a amendé ») : I-G9 et § 7 (dix-sept lignes, réparties en tâches 1, 4, 5 et 6 — P5),
    § 9 tâche 1 (« onze »), description du factice (`forme409: 'statusCode'` sans `code`), chaîne « page non numérotée » de `nomFichier` (hors § 5),
    `renderSettings` à `pickFiles` et `telechargerArchive` injectés, `import-cible.js` lecteur de la règle d'affichage F-9, deux lignes de
    `backup.js` remontées en tâche 1, `pause` L3 et passe fichiers (doute 14, ratifié : § 11 — P3),
    `pdfFrame` de `recipe-edit.js` (dette, § 11 — P4), phrase de pause L3 sans palier (§ 5 — P2).

**Vérification de cette rév. 1 (lecture seule sur le worktree, tout dans le scratchpad).** Les blocs de code du plan ont été extraits, assemblés et
passés à `node --check` (douze fichiers, dont `tests/sync-l4.js` complet) ; puis appliqués à une **copie** de `src/` (tête du worktree au 19 octobre,
lot A en cours) et **exécutés sous Node** avec une base en mémoire qui imite `Database` (`get`, `getAll`, `getMany`, `count`, `getSnapshot`,
`mutate` avec capture) : tâche 1 (pures, écritures, réception, tombales, `adjusted`, conflits) 47/47, tâche 2 (archive, R-G-6) 16/16, tâche 3
(Storage, `octetsAEnvoyer`, passe, téléchargement, espace) 47/47, tâche 4 (moteur, vols, arrêt) 17/17, test Node `fichiers-node` 2/2 ; mutants
rejoués : six d'archive (« blob tel quel », `garder` sans `!entreeOriginale`, `existingFiles` vide en remplacement, `remote` comparé sans
condition, `requireInspection` sans `missing`, `comparableFiles` sans filtre) et cinq du moteur (vol non tenu, compte qui relit, stockage hors du
compteur, `planifier` non appelé, `pause_fichiers` ignorée) — tous rouges. Non exécutés : les blocs qui exigent le DOM, IndexedDB réel ou un canvas
(tâches 5 et 6, affichage et réglage de la tâche 1, l'image réelle de `octetsAEnvoyer`, les statiques) — la suite navigateur les jouera.

**Vérification de cette rév. 2** (lecture seule sur le worktree ; tout dans le scratchpad, sous `verif-rev2/`). (1) Chaque constat du pré-vol
relu dans le code à `bd03e48` (numéros de ligne cités ci-dessous). (2) `tests/sync-l4.js` réassemblé depuis les blocs de la rév. 2 (tâches 1 à 6,
import de la tâche 2 en tête, 1 448 lignes) : `node --check` vert ; les 46 autres blocs JS du plan, chacun dans l'enveloppe qui lui convient
(fonction, boucle, objet, tableau ; l'extrait de `pull.js` garde son `if` ouvert, voulu) : `node --check` vert. (3) Sept blocs `run(…)` touchés
par la rév. 2, extraits **tels quels** du plan et joués sous Node sur la base imitée des harnais de la rév. 1 (copie de `src/` aux tâches 1 à 4
appliquées, factice de la rév. 2), plus deux contrôles directs (`tests/assistant-compte.js` l. 395/401, `tests/sync-l3.js` l. 1703) : **27/27** ;
six mutants rejoués sur cette copie, **tous rouges** — `dejaPresent` sans `statusCode` (24/27 : trois assertions), `elementFichier` sans la garde
remote, garde de la passe unique écrite par un second `mutate`, `createArchive` qui exige `remote` (le code de `bd03e48`), passe fichiers sautée
sous `pause`, `nomFichier` sans la branche « page non numérotée » (26/27 chacun) — et le témoin revenu à 27/27 après remise. (4) Non exécuté :
ce qui exige le DOM, IndexedDB réel, un canvas ou la CSP (affichage F-9 et ses espions, écran d'import ciblé, Réglages (f) et (f2), R-G-5 à
toutes branches, couverture en erreur et échec dit, photo du plat) — la suite navigateur les jouera au premier passage ; la lecture « `fetch` d'une
URL `blob:` refusé par la CSP » (doute 16) n'est pas rejouée dans Chrome.

---

### Pré-vol (rév. 1 → rév. 2, puis rév. 2 → rév. 3)

Une ligne par constat, dans l'ordre reçu (lentilles : ordre des tâches, fantômes, faux-vert). « Appliqué » dit où ; « refusé » dit pourquoi,
vérifié dans le code à `bd03e48`.

- **P-1** (ordre, Critical, tâche 1 → 4) `fichiersRecus` attendu dès la tâche 1, posé en tâche 4 — **appliqué** : `tests/sync-l3.js` l. 1703 et
  1708 passent au Step 1 de la tâche 4 (vérifié : `src/sync/moteur.js` l. 215-220 rend quatre clés, `eq` compare par `JSON.stringify`) ; I-G9,
  Step 5 de la tâche 1 et Step 5 de la tâche 4 réécrits ; sous Node, le moteur de la tâche 4 rend `fichiersRecus: 0`.
- **P-2** (ordre, Minor, tâche 1 → 2) `createArchive` lève sur une ligne reçue sans octets entre les tâches 1 et 2 — **appliqué** (option 1) : les
  deux lignes de `backup.js` (manquante sans condition de `remote`, `comparableFiles` par le blob ; l. 128-131 et 359 à `bd03e48`) remontent en
  tâche 1, avec le test « archive : une ligne sans octets ni remote ne fait plus lever » ; aucun test existant n'attend la levée (relu) ; mutant
  « `file.remote` exigé » rouge sous Node.
- **P-3** (ordre, Minor, tâche 1) `poserImage` hors de la règle d'affichage — **appliqué** : `src/ui/import-cible.js` l. 17 et 316 passent à
  `typeAffichage` ; un test monte l'écran d'import ciblé (gestes injectés) sur une ligne HEIC à blob JPEG et lit le Blob affiché par l'espion de
  `URL.createObjectURL` (jamais par `fetch` : P-23).
- **P-4** (ordre, Minor, tâche 6) listes du filet i18n mal décrites — **appliqué** : Global Constraints et tâche 6 (Step 5) disent « ajouter aux
  clés existantes » (vérifié : `tests/ajouter.js` l. 18 porte `'../src/ui/import.js'` avec quatre chaînes du lot A) ; `recipe.js` retiré (aucun
  `t()` neuf).
- **P-5** (ordre, Minor, tâche 2) « l'import de tête devient » ambigu — **appliqué** : « ajouter en tête, sous les imports de la tâche 1, qui restent
  tous (`withRepo` compris) ».
- **P-6** (ordre, Minor, tâche 6) collision possible de R66 — **appliqué** : numéro relevé au moment d'écrire, revérifié au rebase ou à la fusion
  (R65 est le dernier à `bd03e48`).
- **P-7** (ordre, Minor, tâche 5) I-G8 sans assertion — **appliqué** : `/supabase/i` dans l'assertion R-G-5 à toutes branches (tâche 5) et sur les
  chaînes neuves des écrans, en français et en anglais (statique de la tâche 6).
- **P-8** (ordre, Minor, tâche 4) `pause` (L3) + stockage sans test — **appliqué** : test qui affirme § 4.7 tel qu'écrit (aucun `pousser`, la passe
  fichiers envoie, la ligne attend en file) ; vérifié à `bd03e48` : sous `pause`, `bilanEnvoi` est nul et `envoiBloque` faux ; vert sous Node,
  mutant « passe sautée sous `pause` » rouge ; la règle reste à ratifier (doute 14).
- **P-9** (ordre, Minor, tâche 5) phrase L3 « 1 Go au palier gratuit » contre R-G-5 — **appliqué, variante « hors lot nommé »** : Step 5 de la
  tâche 5 et doute 13. **Le constat se trompe sur un point** : deux assertions L3 épinglent la phrase (`tests/sync-l3.js` l. 1237 et 1326,
  `includes('1 Go')`) ; l'amender ici ajouterait deux lignes à I-G9 et un texte que la spec ne nomme pas — décision laissée à Neegan.
- **P-10** (fantômes, Critical) même défaut que P-1 — **appliqué** (même remède).
- **P-11** (fantômes, Critical) `tests/assistant-compte.js` l. 401 oubliée — **appliqué** : ajoutée au Step 5 de la tâche 1 (`p.total === 25`,
  « imports et files comprises ») ; texte relu à `bd03e48` ; sous Node : progression hors production 24 → 25. I-G9 compte quinze lignes (doute 1).
- **P-12** (fantômes, Important) clé `import.js` présentée comme neuve — **appliqué** (même remède que P-4).
- **P-13** (fantômes, Minor) `logError` déjà importé par `import.js` — **appliqué** : vérifié (`src/ui/import.js` l. 6) ; retiré des imports neufs, la
  raison dite (une seconde liaison serait une SyntaxError).
- **P-14** (fantômes, Minor) `recipe-edit.js:86`, troisième appelant de `pdfFrame` — **refusé pour le câblage, appliqué pour le nommage** :
  l'écran de correction n'est pas dans § 4 de la spec et ses pages y restent des `<img>` sans état ; câbler le seul PDF ferait un demi-écran.
  Nommé dans les fichiers de la tâche 6 (« non modifié, par choix ») et en doute 15.
- **P-15** (fantômes, Minor) `docs/architecture.md` l. 882 oubliée — **appliqué** : trois phrases amendées (l. 6, 179 et 882, relues à `bd03e48`).
- **P-16** (fantômes, Minor) import de `typeAffichage` dans `recipe.js` au mauvais endroit — **appliqué** : la tâche 1 change l'import l. 7 en
  `{ displayUrl, typeAffichage }` ; la tâche 6 ne touche plus l'import de `mime.js`.
- **P-17** (fantômes, Minor) libellé devenu faux, `tests/sync-l3.js` l. 100 — **appliqué** (amendé) : libellé seul réécrit en tâche 1, valeurs
  inchangées, compté dans I-G9.
- **P-18** (fantômes, Minor) `import { ALLOWED_MIME }` au milieu de `tables.js` — **appliqué** : sous l'import de tête (l. 4).
- **P-19** (fantômes, Minor) « l'import DEVIENT » laisse croire à un import existant — **appliqué** (même remède que P-5 ; vérifié : `withDatabase`
  et `rewriteArchive` sont exportés par `tests/backup.js`).
- **P-20** (faux-vert, Critical) même défaut que P-1 — **appliqué**.
- **P-21** (faux-vert, Critical) même défaut que P-11 — **appliqué**.
- **P-22** (faux-vert, Important) le mutant « `statusCode` ignoré » de `dejaPresent` survit — **appliqué** : vérifié dans le vendor 2.117.3
  (`StorageApiError` : `statusCode = corps.statusCode || corps.code || status`, `code = corps.code`) ; l'erreur d'`upload` du test de
  `createStockage` n'a plus de `code` (attendu `null`), le test pur gagne `{ status: 400, statusCode: '409' }` et `{ …, code: 'KeyAlreadyExists' }`,
  le factice `forme409: 'statusCode'` rend `code: null` ; sous Node, le mutant rougit trois assertions (24/27).
- **P-23** (faux-vert, Important) F-9 : `bookCover` vert avant le changement, `photoDuPlat` sans test, `import-cible.js` hors règle —
  **appliqué, par un autre moyen de lecture** : `fetch(img.src)` est refusé par la CSP de `tests/index.html` (`connect-src 'self' https:` ne couvre
  pas `blob:` — constat du réviseur, qui touchait aussi le test `displayUrl` de la rév. 1) ; le Blob affiché se lit par l'espion de
  `URL.createObjectURL` (`bookCover`, `poserImage`, `photoDuPlat`) et par le `creerUrl` injecté (`displayUrl`). Le test de `photoDuPlat` vit en
  tâche 6, où sa fiche est montée : vert à l'écriture, son mutant rejoué à la clôture. `import-cible.js` : P-3.
- **P-24** (faux-vert, Minor) même défaut que P-4 — **appliqué**.
- **P-25** (faux-vert, Minor) garde de la passe unique pas éprouvée dans la même transaction — **appliqué** : `(ecritures[0]?.puts.sync_state ||
  []).some((l) => l.key === 'files_remote_v2')` dans l'`eq` ; sous Node, le mutant « second `mutate` » rougit.
- **P-26** (faux-vert, Minor) `reglages` laissé à la base jetable — **appliqué** : `relireReglages()` en `finally` (gabarit relu : `tests/sync.js`
  l. 723) ; étendu au test de la tâche 5 qui écrit `upload_quality` (même état partagé).
- **P-27** (faux-vert, Minor) relecture différée non attendue au test (f) — **appliqué** : `relectureEnCours()` avant la sortie de `withRepo`
  (vérifié : le clic écrit `last_backup` par `repo.setSetting`, `src/ui/settings.js` l. 108), `relireReglages()` en `finally`.
- **P-28** (faux-vert, Minor) R-G-5 contrôlé sur le seul rendu de l'espace — **appliqué** : un rendu à toutes branches actives (pause, pages à
  télécharger, téléchargement global, renvoi, trois refusés, phrases) porte `/Go|palier|\$/`, `/supabase/i` et zéro `<progress>`.
- **P-29** (faux-vert, Minor) « page non numérotée » sans livre non testée — **appliqué** : page `p4` ajoutée au tableau de `nomFichier` ; la
  chaîne, hors § 5, est un ruling de construction (doute 17) ; sous Node, le mutant rougit.
- **P-30** (faux-vert, Minor) tombale plus ancienne : la retenue sans remote de ce compte n'est pas éprouvée — **appliqué** : ligne `H('6')` sans
  remote, remise en file comme en L3, puis `composerLots` → retenue « fichier en attente » ; vert sous Node, mutant « `elementFichier` sans la
  garde remote » rouge.
- **P-31** (faux-vert, Minor) branches non éprouvées des écrans et de l'archive — **appliqué en partie** : couverture en `file_error`
  (« Réessayer » → `reessayerFichier`, échec dit) et téléchargement à `recus: 0` (toast, zone inchangée) testés en tâche 6 ; rapport d'inspection
  éprouvé par `pickFiles` injecté (tâche 2, test f2). **Refusé** pour `messageOriginauxConserves` dans `appliquerArchive` : `confirmDialog` y est
  importé, pas injecté, et l'injecter élargirait une fonction interne à `restoreReport` pour un message déjà épinglé en pur (e7) — reste à la
  revue de clôture, comme le fil de `src/app.js`.

#### Rév. 2 → rév. 3 — rulings du chef d'orchestre P1 à P7

Une ligne par point ; « appliqué » dit où et ce qui l'éprouve. Chaque nom touché est relu dans le worktree en lecture seule : `bd03e48`, puis
`4cb99a0` (ronde 1 de la tâche 6 du lot A, commise pendant cette révision ; `git diff bd03e48 4cb99a0` ne touche ni `tests/sync-l3.js`, ni
`tests/assistant-compte.js`, ni `tests/sync.js`, ni `src/sync/mime.js`, `src/ui/recipe.js`, `src/ui/components.js`, `src/ui/settings.js`,
`src/i18n/en.js`).

- **P1** (constat 8 non réglé, faux-vert, tâche 6) le test de `photoDuPlat` doit tuer « `photoDuPlat` garde `safeDisplayType(fichier.mime)` » —
  **appliqué** : la fixture passe d'une ligne `image/heic` (sur des octets PNG typés `image/jpeg`) à une ligne **`application/pdf`** — dans la
  liste blanche, **pas** une image — sur les octets d'un **vrai JPEG** (`convertToBlob({ type: 'image/jpeg' })`) ; l'assertion lit `[photo,
  Blob image/jpeg remis, Blob application/pdf remis]` = `[true, true, false]`. Rejoué sous Node (`verif-rev3/photo-plat-rev3.mjs` : le bloc
  `photoDuPlat` de la tâche 6 et `typeAffichage` / `displayUrl` de la tâche 1 tirés tels quels de ce plan, `safeDisplayType` du worktree,
  `URL.createObjectURL` remplacé par un espion) : fixture HEIC → vrai `[true,true,false]`, mutant `[true,true,false]`, **le mutant survit**
  (constat confirmé) ; fixture `application/pdf` → vrai `[true,true,false]`, mutant `[false,false,false]`, **tué** ; `application/octet-stream`
  → tué aussi. Le script du vérificateur (`verif-rev2/verif-photo/photo-plat.mjs`, rejoué tel quel, puis sur une copie qui ajoute la fixture
  `application/pdf` : `verif-rev3/photo-plat-verificateur.mjs`) dit la même chose : HEIC « MUTANT SURVIT », octet-stream et pdf « mutant tue ».
  **Autres appelants de la règle**, même vérification : `displayUrl` (`creerUrl` injecté), `bookCover` et `poserImage` (`import-cible.js`), tous en
  tâche 1, tuent déjà leur mutant « type de la ligne » sur la fixture HEIC — leur `type` sert À LA FOIS de garde et de retypage, le Blob remis
  passe alors à `image/heic` (rejoué : vrai `image/jpeg`, mutant `image/heic`) : rien à changer ; `vignettePage` et `pdfFrame` (tâche 6) n'ont pas
  de garde à eux, leur seul type est celui de `displayUrl`. Seul `photoDuPlat` avait le défaut : sa garde et son URL lisent deux fonctions
  différentes. (L'aperçu de `renderZoneCouverture`, `urlDeBlob(blob)` brut dans `book.js`, n'est pas un appelant de `displayUrl` : préexistant,
  hors du défaut.) Liste des mutants de la clôture complétée.
- **P2** (doute 13) texte de pause L3 « 1 Go au palier gratuit » — **appliqué** en tâche 5 : `syncSectionModel` rend « Espace serveur plein — rien
  n’est perdu, tout reste sur cet appareil. » (seule la parenthèse tombe ; Step 3) ; `en.js` : l'entrée de la l. 141 remplacée, clé et valeur
  (« Server storage is full — nothing is lost, everything stays on this device. ») ; filet i18n : vingt-neuf clés dans
  `CHAINES_NEUVES_AILLEURS['../src/ui/settings.js']` ; `tests/sync-l3.js` l. 1237 et 1326 (`includes('1 Go')`) réécrites en **égalité exacte**
  avec la phrase neuve (Step 1 ; rouges au Step 2, vertes au Step 5 ; relu : la carte `card warn` est la première `.warn` de `syncSectionL3` et
  porte la phrase seule) ; I-G9 = dix-sept lignes (Global Constraints, Step 0, doutes 1, 13 et 17). Ajouté pour la cohérence, sans tâche de plus :
  R66 (tâche 6) nomme § 5.3 de la spec parente, qui cite l'ancienne phrase mot pour mot ; mutant « ancien texte gardé » dans la liste de la
  clôture. Relu à `bd03e48` : « 1 Go » et « palier gratuit » n'apparaissent dans `src/` et `tests/` qu'à `settings.js` l. 846, `en.js` l. 141 et
  ces deux lignes.
- **P3** (doute 14) passe fichiers sous pause L3 de quota — **appliqué (ratifié)** : le test « moteur (pause L3 + stockage) » de la tâche 4 reste
  tel quel (aucun `pousser`, la passe envoie et confirme, la ligne attend en file) ; son commentaire dit « ratifié par P3 », son libellé « P3 ratifié » ; la
  ligne de § 11 de la spec est due à la clôture (texte donné) ; mutant « passe fichiers sautée sous `pause` L3 » nommé dans la liste de la clôture.
- **P4** (doute 15) `pdfFrame` de `src/ui/recipe-edit.js` non câblé — **appliqué** : dette nommée dans la Clôture (spec § 11, texte donné), aucune
  tâche ; les fichiers de la tâche 6 et le doute 15 le disent (l. 89 à `4cb99a0`, l. 86 à `bd03e48`).
- **P5** (doute 17) — **appliqué** : la Clôture porte « amender la spec § 7, I-G9 et § 9 tâche 1 : I-G9 = 17 lignes » avec la liste exacte
  (fichier, ligne, tâche), relue dans le worktree : `tests/sync-l3.js` l. 100, 527, 528, 529, 537, 543, 545, 682, 1237, 1326, 1703, 1708 ;
  `tests/assistant-compte.js` l. 388, 395, 401 ; `tests/sync.js` l. 124, 125.
- **P6** (Step 0 de la tâche 1) — **appliqué** : le Step 0 relit d'abord la tête **finale** du lot A (`import-cible` fusionnée) et quatre noms,
  `displayUrl(fileRow, creerUrl)`, `marquerInterrompus`, `purgerImportsAnciens`, `renderImportCible(params, query, ctx, deps)` ; une signature
  qui diffère → la tâche 1 s'aligne et le dit dans son rapport. Relu à la rév. 3 (`bd03e48`, puis `4cb99a0`) : les quatre existent sous
  ces formes — `displayUrl` (`src/sync/mime.js`) ; `marquerInterrompus` (exportée depuis `4cb99a0`) et `purgerImportsAnciens`, appelées
  par `init()` juste après `purgerFilesEnFile()` ; `renderImportCible(params, query, ctx, { repo, navigate, toast, fetch, pickFiles, maintenant,
  battementMs })`.
- **P7** — **appliqué** : six tâches, mêmes tests, mêmes blocs de code ; seuls changent le bloc de test de la photo du plat (P1), deux lignes de
  `tests/sync-l3.js` et deux fragments neufs (phrase de `syncSectionModel`, entrée `en.js`) en tâche 5 (P2), un commentaire et un libellé en
  tâche 4 (P3), le texte du Step 0 (P6), la Clôture et les doutes (P2 à P5).

**Vérification de cette rév. 3** (lecture seule sur le worktree ; tout dans le scratchpad, sous `rev3-outils/` et `verif-rev3/`). Le plan est
produit par 36 remplacements exacts sur la rév. 2 (`rev3-outils/appliquer.py` : chaque ancien texte trouvé une seule fois, sinon arrêt),
des retouches de relecture sous la même règle (dont la tête `4cb99a0`, commise par le lot A pendant la révision : les noms et les dix-sept
lignes y sont relus, inchangés) et l'ajout de cette sous-section (`rev3-outils/prevol.py`).
`node --check` (`rev3-outils/verifier-syntaxe.py`) : `tests/sync-l4.js` réassemblé (tâches 1 à 6, import de la tâche 2 en tête, 1 453 lignes)
vert ; les 49 autres blocs JS verts, chacun dans son enveloppe (13 modules, 25 corps de fonction, 7 littéraux d'objet, 4 enveloppes propres :
l'extrait de `pull.js` au `if` ouvert, celui de `reponses.js` à `continue`, deux listes d'éléments) — dont les trois blocs neufs (les deux lignes
de `tests/sync-l3.js`, la phrase de `syncSectionModel`, l'entrée `en.js`). La phrase neuve est identique dans ses quatre occurrences ; « (1 Go au
palier gratuit) » n'est plus dans aucun bloc JS. P1 rejoué sous Node (ci-dessus). Invisibles (Python `-I` : U+200B-200F, U+2028/2029,
U+202A-202E, U+2060-2069, U+FEFF, U+00A0, U+202F, U+00AD) et caractères de contrôle : zéro dans ce plan et dans les scripts. Non exécuté : la
suite navigateur (DOM, IndexedDB, canvas, CSP) — le vrai JPEG de P1, les deux assertions L3 et le rendu de la pause se joueront au premier
passage.

### Rejeu sur `cf91f09` (voie (b))

**Base et méthode (20 octobre 2026).** Tête finale du lot A : `2b6a2fd` ; tête finale du lot B : `cf91f09` ; worktree de G :
`/Users/neeganmac/projects/mistu-photos-entre-appareils`, branche `photos-entre-appareils` à `3601a52` (= `cf91f09` + spec rév. 4 commise), resté
propre (aucune écriture, serveur 8090 non touché). Copie de travail par `rsync` (sans `.git` ni `.superpowers`) dans le scratchpad
(`…/scratchpad/lots/G/depart/copie`, servie sur 8192 ; base intacte `…/depart/base`), remesurée identique au Départ (3997/3997, épingle 3996,
Node 172, `--check` 0). Les blocs du plan ont été extraits du markdown tels quels (61 blocs : 58 `js`, un `text`, un `css`, un `markdown`) et
appliqués tâche par tâche par des scripts de remplacement exact (chaque ancre trouvée une fois, sinon arrêt) : d'abord les tests (rouge lu), puis le
code (vert lu), l'épingle relevée (règle N-1), la suite relancée. Un instantané par tâche (`…/depart/snap/t1` à `t6`). Aucun commit, aucun sous-agent,
jamais le navigateur MCP (Chrome sans tête du lanceur `suite.cjs` du registre de G, lu, jamais modifié), aucun réseau ni appel réel (Anthropic,
Supabase), aucun effacement récursif.

**Mesures, tâche par tâche** (copie de `3601a52` ; Node = `node --test tools/*.test.mjs` ; `--check` = `node tools/generer-migrations.mjs --check`).

| Tâche | Rouge lu (tests posés, code absent) | Vert (épingle relevée) | Épingle | Node | `--check` | `sw.js` |
|---|---|---|---|---|---|---|
| Départ | — | 3997/3997 | 3996 | 172/172 | 0 | `cuisine-os-v0.10.0-8` (`APP_VERSION 0.10.0`) |
| T1 | 3653/3673 (20) | 4058/4058 (avant l'épingle : 4057/4058) | 4057 | 174/174 (rouge : 172/173) | 0 | `cuisine-os-v0.11.0-1` (`APP_VERSION 0.11.0`) |
| T2 | 4058/4069 (11) | 4083/4083 (avant : 4082/4083) | 4082 | 174/174 | 0 | `-2` |
| T3 | 4084/4098 (14) | 4134/4134 (avant : 4133/4134) | 4133 | 174/174 | 0 | `-3` |
| T4 | 4132/4146 (14) | 4154/4154 (avant : 4153/4154) | 4153 | 174/174 | 0 | `-4` |
| T5 | 4152/4158 (6) | 4175/4175 (avant : 4174/4175) | 4174 | 174/174 | 0 | `-5` |
| T6 | 4174/4188 (14, bloc corrigé C-1) — bloc de la rév. 3 tel quel : suite sans bilan | 4194/4194 (avant : 4193/4194) | 4193 | 174/174 | 0 | `-6` |

À chaque vert, seule l'épingle rougissait avant d'être relevée ; la console ne portait que le 404 de `/favicon.ico` (préexistant). `DB_VERSION` reste 4,
`TABLES` intact (`--check` 0 partout). Rouges de T1 : six lignes I-G9 de `tests/sync-l3.js` en valeur, « Suite L3 interrompue : remoteValide is not a
function » (la l. 682 lit `remoteValide` : la suite L3 s'arrête là et masque son pin l. 1867), trois de `tests/assistant-compte.js`, huit pins visibles,
« Suite photos entre appareils interrompue », l'épingle. Rouges de T2 à T6 : les blocs du lot G de la tâche, les lignes I-G9 de la tâche (T4 : 1703,
1708 ; T5 : 1237, 1326 ; T6 : `tests/sync.js` 124, 125), l'épingle — **aucune autre assertion existante n'a rougi**, à aucune tâche (à T1,
la suite L3 s'arrête à la l. 682 dans la phase rouge : ce qui la suit n'est vu qu'au vert, où tout passe).

**Les dix-sept lignes de I-G9, retrouvées par leur TEXTE à `3601a52`** (texte de `bd03e48` cherché ligne entière dans `3601a52` : une occurrence
chacune, aux mêmes numéros).

| Fichier | Ligne à `bd03e48` | Ligne à `3601a52` | Tâche | Rouge à la tâche | Ligne une fois la tâche faite |
|---|---|---|---|---|---|
| `tests/sync-l3.js` | 100 (libellé seul) | 100 | T1 | non (valeurs inchangées) | 100 |
| `tests/sync-l3.js` | 527, 528, 529 | 527, 528, 529 | T1 | oui | 526, 527, 528 |
| `tests/sync-l3.js` | 537, 543, 545 | 537, 543, 545 | T1 | oui | 536, 542, 544 |
| `tests/sync-l3.js` | 682 | 682 | T1 | oui (interrompt la suite L3) | 682 |
| `tests/assistant-compte.js` | 388, 395, 401 | 388, 395, 401 | T1 | oui | 388, 395, 401 |
| `tests/sync-l3.js` | 1703, 1708 | 1703, 1708 | T4 | oui | 1703, 1708 |
| `tests/sync-l3.js` | 1237, 1326 | 1237, 1326 | T5 | oui | 1237, 1326 |
| `tests/sync.js` | 124, 125 | 124, 125 | T6 | oui | 124, 126 (le bloc du Step 2 ajoute l'attente) |

(Le commentaire R-L3-22, deux lignes → une, et l'import de `remoteValide`, une ligne de plus avant la l. 674, sont les seuls déplacements.)

**Step 0 (P6) relu à `3601a52`.** `displayUrl(fileRow, creerUrl)` : `src/sync/mime.js` l. 27, inchangée. `marquerInterrompus` (exportée, `repo.js`
l. 116) et `purgerImportsAnciens` (l. 146) : appelées par `init()` aux l. 79 et 80, juste après `purgerFilesEnFile()` (l. 78) ; `convertirRemoteBooleen()`
s'insère entre les deux, comme prévu. `renderImportCible(params, query, ctx, deps)` : `import-cible.js` l. 304, `deps` à huit noms (`veilleMs` en plus,
vague finale du lot A) et redirection vers `renderImportWeb` pour une fiche à `source_url` (lot B) — R-G-9. Aucune signature ne diffère de ce que le
code et les tests du plan lisent.

**Fichiers adaptés, et la règle appliquée.** (Les fichiers que ni la fin du lot A ni le lot B n'ont touchés — `src/sync/tables.js`, `pull.js`,
`conflits.js`, `reponses.js`, `outbox.js`, `backfill.js`, `lots.js`, `moteur.js`, `transport.js`, `mime.js`, `src/ui/state.js`, `settings.js`, `book.js`,
`livre-ajout.js`, `src/app.js`, `src/domain/backup.js`, `styles.css`, `tests/sync.js`, `tests/transport-factice.js` — reçoivent les blocs
à l'octet ; `src/ui/import.js`, changé par la ronde 1 de la tâche 6 du lot A dès `4cb99a0`, aussi.)
- `tests/tests.js` — R-G-7 : import et appel de la suite G après ceux du lot B (`runLectureWebTests`), avant le thème ; épingle relevée à chaque tâche
  (3996 → 4057 → 4082 → 4133 → 4153 → 4174 → 4193 ; la forme de B, `eq(results.length, N,'…')`, gardée).
- `tests/ajouter.js` — R-G-10 : `MODULES_NEUFS` + `fichiers.js` après `vol.js` (B) ; `CHAINES_NEUVES_AILLEURS` : clé neuve `settings.js` (T2, complétée en
  T5) posée dans le littéral sans toucher aux clés de B ; en T6, ajouts en fin des listes existantes `components.js` (après les repères de B), `book.js`
  et `import.js` (une chaîne à `3601a52`, C-3) ; pins l. 1928 et 1930.
- Pins `tests/creer-ia.js` l. 11, `tests/assistant-compte.js` l. 8, `tests/passerelle.js` l. 672 et 674, `tests/recherche-web.js` l. 66 (commentaire),
  69 et 72, `tests/sync-l3.js` l. 1867 — R-G-8 : `0.10.0` → `0.11.0` et `v0\.10\.0-\d+` → `v0\.11\.0-\d+`, libellés « (lot B) » / « lot B : » →
  « (lot G) » / « lot G : ».
- `src/model/schema.js` (`APP_VERSION 0.10.0 → 0.11.0` ; `SOURCE_KINDS` de B sans effet), `sw.js` (`SHELL` de B gardé, `fichiers.js` entre `conflits.js`
  et `lots.js`, ligne inchangée par B ; `VERSION` de `cuisine-os-v0.10.0-8` à `cuisine-os-v0.11.0-1` puis `-2` … `-6`).
- `src/ui/import-cible.js` — refactoré par B autour de `vol.js` et par la vague finale de A ; `poserImage` (l. 451, 413 à `4cb99a0`) et l'import l. 17
  inchangés : les deux substitutions de T1 à l'octet (R-G-9).
- `src/ui/components.js` — R-G-11 : ajouts de B ailleurs dans le fichier ; T1 (`bookCover`, import de `mime.js`) et T6 (`pdfFrame` et les vignettes à sa
  place, imports) à l'octet.
- `src/ui/recipe.js` — R-G-12 : T1 (import l. 7, garde de `photoDuPlat`) à l'octet ; T6 : `ctxF` juste avant l'appel de `photoDuPlat` (après le bandeau
  web et la bannière de B), « Original » (bloc), `referenceOnly` async avec la branche signet de B intacte, « Pages d'index » rebâtie, `photoDuPlat` (bloc).
- `src/model/repo.js` — B y a renommé `KINDS_IMPORT` en `KINDS_PAGES` et le lot A y a ajouté le battement interne (`battre`, `oublierBattement`,
  `transitionner(… autres)`) ; aucun recouvrement : `DEFAULT_SETTINGS`, `putFile`, `convertirRemoteBooleen` et l'appel dans `init()` à l'octet.
- `src/i18n/en.js` — B a ajouté ses entrées en fin de littéral (« Lien web · {h} » dernière) : les quatre blocs de G suivent, avant `};` ; l'entrée de la
  pause L3 (l. 141, inchangée) remplacée à sa place ; les 59 clés neuves du plan (7 + 10 + 29 + 13) vérifiées absentes de l'`EN` de `3601a52`
  (aucun doublon de clé).
- `docs/architecture.md` — R-G-13 : l. 6 et 179 inchangées, la phrase des « Limites connues de V0 » à la l. 1276 (882 à `bd03e48`), la section
  « Ce qui est absent (L4 et L5) » toujours l. 243 ; la section du lot A (l. 1032) laissée telle quelle. `docs/spec-compte-et-stockage-distant.md` :
  R65 dernier → R66. `supabase/README.md` : étape 7 (l. 149) inchangée par B → une phrase.
- `tests/sync-l3.js`, `tests/assistant-compte.js` — les lignes I-G9 aux mêmes numéros (tableau ci-dessus).

**Écarts d'intention entre ce plan et le code commis de B — tous tranchés en faveur du code de B.**
- **R-G-7 — ordre des suites.** B a inséré `runLectureWebTests` entre `runImportCibleTests` et `runThemeTests` ; le plan plaçait G juste après
  `runImportCibleTests`. G s'enregistre après la suite de B, avant le thème (chaîne A → B → G) ; le bloc d'appel est inchangé, seule sa place change.
- **R-G-8 — versions.** La base porte `0.10.0` (B) ; le plan, écrit à `0.9.0`, nommait des pins `0.9.0` et laissait ouvert l'ordre des fusions. G prend
  `0.11.0` (D-G11, B fusionné d'abord ; spec rév. 4, R-E-18) ; les dix lignes `0.10.0` des six mêmes suites sont relevées à `3601a52` ; les libellés « lot B »
  de B deviennent « lot G ».
- **R-G-9 — l'écran d'import ciblé.** `deps` a huit noms (`veilleMs`, lot A) et une fiche à `source_url` part vers `renderImportWeb` (B, D-B13) ; la règle
  F-9 de `poserImage` ne vaut que pour l'écran photo, et l'écran web de B (`import-web.js`, `vol.js`, `lecture-web.js`) n'affiche aucun octet de fichier :
  rien à y étendre ; le test d'affichage garde ses cinq dépendances, sur une fiche sans adresse.
- **R-G-10 — filet i18n.** B a étendu `MODULES_NEUFS` et `CHAINES_NEUVES_AILLEURS` ; G ajoute en fin de liste, ne retire ni ne réordonne rien ; la clé
  `settings.js` reste neuve (B n'en pose pas).
- **R-G-11 — `components.js`.** B y a déménagé `ligneReperes`, ajouté `texteDesChamps`, étendu `banniereLecture` et importé `recherche-web.js` ;
  `bookCover` et `pdfFrame` sont ceux du plan : aucun recouvrement, blocs à l'octet.
- **R-G-12 — `recipe.js`.** B a donné à `renderRecipe` un paramètre `deps`, une branche signet (`blocSignet`) en tête de `referenceOnly`, `bandeauWeb` et
  la ligne lue ; la branche signet reste la première de `referenceOnly` (devenue async) et rend avant toute vignette ; `ctxF` est lu après ce que B affiche
  en tête de fiche.
- **R-G-13 — `docs/architecture.md`.** B a ajouté ses sections avant les « Limites connues de V0 » (l. 882 → 1276) ; la section du lot A annonce encore
  « octets entre appareils (G) » parmi ce qui est absent (l. 1032), là où B a laissé « Lecture d'une page web (B) » : G suit B, la section d'un autre lot
  n'est pas réécrite.

**Corrections du plan indépendantes de B** (même défaut à `bd03e48` ; déclarées, appliquées a minima, sans redessiner de tâche).
- **C-1 — tâche 6, bloc de tests (seul bloc qui change).** `finDesImages` et la fin du test `vignettePage` attendaient `onload`/`onerror` d'une image
  `loading: 'lazy'` détachée (`vignettePage`) ou dans une scène cachée (séance) : Chrome ne la charge jamais ; la suite entière restait sans bilan
  (mesuré, rouge comme vert ; une page de diagnostic sur une copie a montré l'arrêt après la 178e assertion du lot G, à la fin du test `vignettePage`).
  Correctif : l'image passe en `loading = 'eager'` avant l'attente ; elle se charge, puis son URL est révoquée (intention du bloc) ; aucune assertion
  touchée. Aucun bloc de la tâche 6 n'avait été joué dans un navigateur avant ce rejeu.
- **C-2 — tâche 5, prose.** « Après la lecture des conflits » plaçait le bloc de lecture au rendu avant `const moteur` : « Cannot access 'moteur' before
  initialization » (mesuré sur une copie : 4069/4073, suites L3 et « assistant par le compte » interrompues). Placé après
  `suivreMoteurDeLaPage(moteur);`.
- **C-3 — tâche 6, prose.** La clé `['../src/ui/import.js']` de `CHAINES_NEUVES_AILLEURS` porte une chaîne (et non quatre) depuis la ronde 1 de la
  tâche 6 du lot A (`4cb99a0`) : on y ajoute les deux phrases de séance.
- Note, non corrigée : le bloc de `backup.js` de la tâche 2 (`octetsRestaures` + `applyArchive`) remplace la fonction entière et n'en reprend ni le
  commentaire « Tout préparer AVANT la transaction… » ni celui de K-7 (`assistant_config` hors du vidage) ; le code de K-7 est gardé. Le rejeu suit le bloc ;
  l'implémenteur peut garder les deux commentaires (aucun effet sur la suite).

**Mutants rejoués** (copies mutées dans `…/depart/mut/<nom>`, chacune servie à part sur 8193 à 8196, serveur tué ensuite ; témoins verts 4058/4058 à T1 et
4194/4194 à T6).
- T1, « spread nu » dans `adjusted` (`reponses.js` : `{ ...element.data, updated_at }` à la place de `fusionnerFichier`) : **rouge**, 4057/4058 — « adjusted
  (pousser scripté …) : blob, syncable, created_at gardés … (mutant : spread nu → blob perdu) ».
- T1, « spread nu » dans `garderAilleurs` (`conflits.js`) : **rouge**, 4055/4058 — garderAilleurs sur files, tombale files (« Supprimer ici aussi »),
  garderIci sur files.
- T1, « `deletes.files` réintroduit » (`pull.js`, branche `files` de la tombale neutralisée) : **rouge**, 4056/4058 — tombale files (ligne et blob gardés …),
  tombale journalisée par son code.
- T1, « `delete fiche.remote` » (`fusionnerFichier` retire `remote` quand le blob local existe, forme de L3) : **rouge**, 4054/4058 — `fusionnerFichier`
  (D-G16), B-1 (« A et B ont le même original »), `adjusted`, `garderAilleurs`.
- P1, sous Node (`…/depart/outils/p1-node.mjs`, `photoDuPlat` lu dans le `recipe.js` de la copie à la tâche 6 — le `recipe.js` de B —, `typeAffichage`,
  `displayUrl` et `safeDisplayType` importés du `mime.js` de la copie) : ligne `image/heic` + octets JPEG → vrai `[true,true,false]`, mutant
  `[true,true,false]` **survit** (la fixture de la rév. 2) ; ligne `application/pdf` + octets JPEG (la fixture du plan) → mutant `[false,false,false]`
  **tué** ; `application/octet-stream` → **tué**. Rejoué aussi dans la suite navigateur : **rouge**, 4193/4194 — « photo du plat (F-9, P1) … ».

**Vérifications.** Les 41 fichiers qui diffèrent de `3601a52` dans la copie à la tâche 6 (`…/depart/outils/verifier.py`, Python `-I`) : aucun caractère
invisible ni de contrôle introduit (U+200B-200F, U+2028/2029, U+202A-202E, U+2060-2069, U+FEFF, U+00A0, U+202F, U+00AD : 0 partout) ; séquences
« barre oblique inverse + u + 4 hexa » en même nombre que la base dans chaque fichier (héritées : `lots.js` 7, `tests/sync-l3.js` 22,
`tests/assistant-compte.js` 7, `tests/creer-ia.js` 24, `tests/passerelle.js` 24, `tests/ajouter.js` 1, `docs/spec-compte-et-stockage-distant.md` 2 ; aucun
bloc du plan n'en porte, aucune retapée) ; aucun motif de clé nouveau (`sk-ant-…`, jeton JWT, `sb_secret_…`, `sb_publishable_…`, `service_role`) ;
`node --check` vert sur les 33 modules JS ; rien sous `supabase/functions/` ni `supabase/migrations/`. Fichiers touchés par tâche conformes aux listes
« Files » du plan. Ce plan régénéré : 0 invisible, 0 caractère de contrôle (même contrôle).

**Outils et traces.** Scripts : `…/scratchpad/lots/G/depart/outils/` (`extraire.py`, `ig9.py`, `ed.py`, `t1_tests.py` … `t6_src.py`, `t6_correctif.py`,
`epingle.py`, `mutants.py`, `jouer-mutant.sh`, `p1-node.mjs`, `verifier.py`, `plan.py`, `diag*.cjs`) ; sorties : `…/depart/logs/` (suite rouge et verte de
chaque tâche, mutants, P1) ; copie durable des scripts et des sorties : `…/nuit-2026-10-18/lots/G/depart-rejeu-outils/` et `…/depart-rejeu-logs/`.

**Reste au contrôleur.** Commettre ce plan sous `docs/superpowers/plans/2026-10-19-photos-entre-appareils.md` dans le worktree de G (et consigner le
rejeu dans `progress.md`) ; remplir les amendements du brief (`amend-G-sans-ecarts.md`, `{{ECARTS_R_G}}`) avec R-G-7 à R-G-13 et C-1 à C-3 ; trancher C-1
(`eager` avant l'attente, ou n'attendre que les images non `lazy`) s'il préfère l'autre forme ; lancer la tâche 1.
