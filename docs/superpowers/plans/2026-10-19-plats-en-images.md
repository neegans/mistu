# Lot F « Les plats en images » (photo du plat, rapatriement par la fonction, cartes illustrées) — plan d'implémentation (rév. 3, 19 octobre 2026 ; rejoué sur la tête finale du lot E `5ec092c`, 23 octobre 2026)

> **Rejeu sur `5ec092c` (voie (b), 23 octobre 2026)** : chaque bloc de chaque tâche a été APPLIQUÉ PAR INTENTION sur une copie de `35fb29c`
> (= `5ec092c` + la spec F), servie à part ; chaque bloc est gardé à l'octet là où la base n'a pas bougé ; les fonctions que le plan réécrit sont
> réécrites DEPUIS `35fb29c` (B, G, C, D et E compris) ; les numéros de ligne sont ceux de `35fb29c` ; les totaux des Steps « vert » sont MESURÉS
> (suite, Node, `--check`, `tsc`) ; trois défauts du plan (D-1 à D-3) sont corrigés au plus près et sept écarts d'intention (EI-1 à EI-7) sont
> tranchés en faveur du code commis — une ligne chacun dans la sous-section finale « Rejeu sur 5ec092c (voie (b)) » de la section « Pré-vol ».
>
> **Rév. 3** : les rulings R-F-7 à R-F-11 du chef d'orchestre sont appliqués (référence de `recipeCard` construite dans le test, aucun prototype
> natif modifié par la suite navigateur, préfixe d'`OUTILS_0006` changé en égalité quelle que soit sa forme, limite nommée des négatives du bloc
> « cartes », lignes relues sur la tête du lot E) ; une ligne par point dans la sous-section « Rév. 2 -> rév. 3 » de la section « Pré-vol » en fin
> de plan.
>
> **Rév. 2** : le pré-vol à trois lentilles (ordre, fantômes, faux-verts) de la rév. 1 est appliqué ; une ligne par constat dans la sous-section
> « Rév. 1 -> rév. 2 » de la section « Pré-vol » en fin de plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chaque recette peut avoir SA photo du plat — posée sur la fiche par « Photographier » / « Choisir une image », retirée par « Retirer » —,
l'image d'une page web gardée et lue est rapatriée par la fonction `assistant` (outil `image-web`, jamais par le téléphone) juste APRÈS
« Enregistrer », un échec ne touche jamais le texte, et les cartes de recettes (recherche, Mes livres, fiche d'un livre, plats, favoris, repas)
montrent une vignette quand les octets sont ici, rien sinon.

**Architecture:** côté serveur, le module feuille `supabase/functions/assistant/lecture-web.js` du lot B gagne l'image de la page (`imageDe`,
`imageOgDe`, `imageUrlDe`, `page.image_url`) et le transport (`typeImageAdmis`, `signatureImage`, `versBase64`) ; `logique.js` gagne le cinquième
outil et la liste fermée `OUTILS_MODELE` ; `index.ts` extrait la boucle de redirections de B en `suivreRedirections` (corps lu sous les
minuteries) et la partage entre `telechargerPage` et `telechargerImage`. Côté app : deux modules de domaine neufs (`src/domain/photo-web.js` :
adresse admise, candidat, `lireImageWeb` par la passerelle ; `src/domain/base64.js` : relecture du base64, sans import), le mur distant
`preparerPhotoDistante` (`src/core/image.js`), un module d'écran neuf `src/ui/photo-plat.js` (figure de tête déplacée du lot G, zone « Photo du
plat » par le composant de la couverture, gestes, rapatriement), `recipe.js` qui le monte, `components.js` (`vignettePlat`) et `meals.js` pour
les cartes, et l'écran web du lot B (`import-web.js`) qui annonce l'essai puis le déclenche. Aucun magasin neuf, aucune migration.

**Tech Stack:** PWA sans build (modules ES), IndexedDB (`db.mutate` porte unique, `repo.save` / `repo.putFile`), fonction Supabase Edge
`assistant` (Deno ; `logique.js` et `lecture-web.js` purs, éprouvés sous Node ; `index.ts` sous le harnais à faux `Deno` du lot B), suite
navigateur `tests/index.html` (lanceur `suite.cjs`), `node --test tools/*.test.mjs`, `tsc` 5.6.3 `--strict`.

**Spec:** `docs/superpowers/specs/2026-10-19-plats-en-images-design.md` (**rév. 3**, commise par le contrôleur au Départ : `35fb29c` sur `5ec092c` ;
même texte que `/private/tmp/claude-501/-Users-neeganmac/1602708c-1218-4b6c-99db-b05ac6854f25/scratchpad/lots/F/spec-rev3.md`, la ligne de chaîne mise
à jour : c'est la spec COMMISE qui fait foi). Les décisions D-F1 à D-F19, les
invariants I-F1 à I-F11 et les rulings R-F-1 à R-F-6 (§ 12) font foi ; ce plan les met en tâches, dans l'ordre de § 9 (cinq tâches). Plan à
commettre sous `docs/superpowers/plans/2026-10-19-plats-en-images.md` ; registre `.superpowers/sdd/2026-10-19-plats-en-images/` (hors git :
le copier dans `~/projects/mistu/.superpowers/sdd/` AVANT tout `git worktree remove`).

**Références relues pour écrire ce plan (lecture seule).** Le code du worktree à `bd03e48` (tâche 6 du lot A commise) et à `4cb99a0` (sa ronde 1) ;
le **prototype du lot B** (`…/scratchpad/lots/B/proto/rejeu2/`, identique à `rejeu6`, état de fin de la tâche 6 du plan B rév. 1 :
`supabase/functions/assistant/{lecture-web.js,logique.js,index.ts}`, `src/domain/lecture-web.js`, `src/ui/import-web.js`, `src/ui/import-cible.js`,
`src/ui/recipe.js`, `src/ui/vol.js`, `src/domain/passerelle.js`, `tests/lecture-web.js`, `tools/assistant-{index,lecture-web,logique}.test.mjs`,
`tools/generer-migrations.test.mjs`) ; le **plan B rév. 2** (`…/scratchpad/lots/B/plan-rev2.md`, 15 h 11), qui change `src/ui/import-web.js` par
rapport au prototype — `enregistrerLecture(importId, { repo, remplacer, maintenant, choisir, cle })` (refus `lecture`, clôture `cloture` passée en
`patch` FONCTION, `cleLecture` déménagée dans `src/domain/import-cible.js`, P-12 de B) : c'est CETTE forme que la tâche 5 prolonge ; `telechargerPage`,
`lirePageHtml`, `lirePage` et `fabriquerLectureWeb` y sont identiques au prototype — ; le **ruling R-B-6** du chef d'orchestre (`…/scratchpad/lots/NUIT.md` :
R-F-1 tranché « chemin 1 » ; spec B rév. 4 et plan B rév. 3 en écriture à la date de ce plan) ; le **plan G rév. 3** (`…/scratchpad/lots/G/plan-rev3.md`, PRÊT ; le code de `photoDuPlat`, `contexteFichiers`
et `gesteTelechargement` y est celui de la rév. 2 : `typeAffichage`, `contexteFichiers`, `gesteTelechargement`, `vignettePage`,
`photoDuPlat(recipe, ctxF)`, `lireErreursFichiers`). Ni B ni G ne sont construits à la date de ce plan : **chaque nom de B, de G (et de C, D, E)
cité ici est relu dans le code réel à la tête du lot E** (Step 0 des tâches 1, 2, 3 et 5) ; une forme qui diffère du prototype ou du plan est
adaptée SANS changer ce que les tests affirment, et l'écart est un amendement nommé (spec § 12, ligne « plan F »). Les numéros de ligne valent à
`bd03e48` (code de l'app ; `src/ui/recipe-edit.js`, `src/ui/import-cible.js` et `src/domain/import-cible.js` ont bougé à `4cb99a0`, où ils sont
relevés quand c'est dit), au prototype B (`rejeu2`) ou au plan G rév. 3, selon ce qui est nommé ; ils sont relus au Step 0 (règle R-C-7 : une
dérive n'est pas un constat). **R-F-11 (rév. 3)** : ces numéros — ceux du prototype B (`rejeu2`) surtout — peuvent bouger avec le plan B
rév. 3 (R-B-6) et la construction de B, G, C, D et E ; chaque Step 0 relit les noms ET les lignes sur la tête du lot E (la base réelle de F), et
tout écart est un amendement nommé (consigné dans `progress.md`, spec § 12), jamais un constat (R-C-7). **Rejeu (23 octobre)** : noms et numéros
relus sur `35fb29c` ; un numéro de `bd03e48`, du prototype B ou du plan G encore cité est suivi de celui de `35fb29c` (« → l. N à `35fb29c` »).

## Global Constraints

- **Préconditions.** (1) Le lot E (« couverture lue ») est **clos** (revue finale, vague, `/verify`) : le lot F part de sa tête, qui porte A, B, G,
  C, D et E (chaîne linéaire). (2) **R-F-1 appliqué par le chef d'orchestre sur le lot B** (ruling R-B-6, « chemin 1 » : spec B rév. 4 et plan B
  rév. 3 ; le plan B rév. 2 ne le porte PAS encore — aucune occurrence d'`OUTILS_0006` ni d'`image-web`, l'égalité à quatre
  `[...OUTILS_0004, 'lecture-web']` y est encore) : `supabase/migrations/0006_lecture_web.sql` porte
  `check (outil in ('recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'))` ; `tools/generer-migrations.test.mjs` déclare le littéral
  **`OUTILS_0006`** (les cinq outils, `image-web` dernier), construit la contrainte attendue de `0006` depuis lui (`OUTILS_0006.map(`) et affirme
  `OUTILS` égal à un préfixe d'`OUTILS_0006` à la place de l'égalité à quatre (`OUTILS_0006.slice(0, 4)`, la forme de la spec B rév. 4 et du plan
  B rév. 3, ou `OUTILS_0006.slice(0, OUTILS.length)` : les DEUX sont admises au Step 0 de la tâche 1, sans NEEDS_CONTEXT, et F les change toutes
  deux en `OUTILS` = `OUTILS_0006` avec `OUTILS.length === 5`, tâche 1, Step 4, point 4 ; R-F-9) ; la preuve `0006` porte le verdict de
  réservation d'`image-web` (« 2.03 bis » : `public.assistant_reserver(uid, 'image-web', 1, …)`
  → id non nul). **Si l'un manque, la tâche 1 s'arrête au Step 0 et le remonte (NEEDS_CONTEXT ; le script du Step 0 sort en 1)** : F n'écrit
  aucune migration (spec § 6.4, § 11 : seul le chef d'orchestre rouvre ce point).
- **Où.** Branche **`plats-en-images`**, créée par le contrôleur sur la tête du lot E, dans le worktree **`/Users/neeganmac/projects/mistu-plats-en-images`** (worktree PROPRE au lot, créé par le contrôleur au Départ sur la tête finale du lot précédent de la chaîne A → B → G → C → D → E → F ; le plan avait été rédigé avec le worktree du lot A comme référence)
  (consigne du chef d'orchestre ; la spec proposait `~/projects/mistu-plats` — voir P-14), servie par
  `python3 -m http.server 8094 --bind 127.0.0.1` depuis le worktree. Lanceur : copier `.superpowers/sdd/2026-10-18-import-cible/suite.cjs` dans
  `.superpowers/sdd/2026-10-19-plats-en-images/suite.cjs` ; suite : `node .superpowers/sdd/2026-10-19-plats-en-images/suite.cjs 8094` (il ouvre
  `http://localhost:8094/tests/`). Node : `node --test tools/*.test.mjs`. Générateur : `node tools/generer-migrations.mjs --check` (attendu 0).
  `tsc` (tâche 1) : `npx -y -p typescript@5.6.3 tsc --noEmit --strict --allowJs --target es2022 --module esnext --moduleResolution bundler --skipLibCheck
  supabase/functions/assistant/index.ts supabase/functions/assistant/deno.d.ts` (attendu 0).
- **Départ : aucun chiffre figé ici.** La tâche 1 **relève** au Step 0 : le bilan de la suite (`✅ N/N`), l'épingle (`tests/tests.js`,
  `eq(results.length, …)`), le compte Node, `APP_VERSION` (attendu `0.14.0`), `sw.js` `VERSION` (attendu `cuisine-os-v0.14.0-K`), `DB_VERSION`
  (attendu 4). Règle : **épingle = obtenu − 1** (l'assertion du total s'ajoute elle-même au bilan). **Chaque tâche rend verts** la suite, Node et
  `--check` (plus `tsc` à la tâche 1) ; seule erreur de console admise : le 404 de `/favicon.ico` (préexistant).
  Repère du rejeu (mesuré sur `35fb29c`, pas une consigne) : `✅ 5681/5681`, épingle 5680, Node 174/174, `--check` 0, `tsc` 0, `APP_VERSION 0.14.0`,
  `sw.js` `cuisine-os-v0.14.0-12`, `DB_VERSION 4` ; script R-F-1 du Step 0 de la tâche 1 : sortie 0, forme `slice(0, 4)`, alias `OUTILS_PASSERELLE`.
- **Versions (D-F6).** La tâche 1 relève `APP_VERSION` = `X.Y.Z` (attendu `0.14.0` : A 0.9.0 → B 0.10.0 → G 0.11.0 → C 0.12.0 → D 0.13.0 →
  E 0.14.0). F prend la mineure suivante, **`X.(Y+1).0`** (attendu `0.15.0` ; « sinon le numéro suivant libre », spec D-F6), et `sw.js`
  `VERSION = 'cuisine-os-vX.(Y+1).0-N'`. Ce plan écrit `0.14.0` / `0.15.0` : si le relevé diffère (E a livré `0.14.1`, un lot de la chaîne a sauté…),
  chaque occurrence se lit avec la version relevée et l'écart est consigné dans `progress.md` (ce n'est pas un NEEDS_CONTEXT). La tâche 1 ne touche
  pas `src/` : aucune version. **Tâche 2** (la première qui touche `src/`) : `APP_VERSION = '0.15.0'` (`src/model/schema.js`) et ses pins **en même
  temps** (relevé par le script Python ci-dessous, qui prend la version RELEVÉE en argument et cherche `X.Y.Z` et `vX\.Y\.Z`) ; `sw.js`
  `VERSION = 'cuisine-os-v0.15.0-1'`. Puis **+1 à chaque tâche qui touche `src/`** : tâche 3 → `-2`, tâche 4 → `-3`, tâche 5 → `-4`. `SHELL` +
  `./src/domain/photo-web.js` et `./src/domain/base64.js` (tâche 2, Step 7), `./src/ui/photo-plat.js` (tâche 3, Step 9) — chacun posé DANS le Step
  qui le rend atteignable depuis `src/app.js`, jamais après un Step « vert » (le test « tout module atteignable depuis app.js est dans SHELL » de
  `tests/sync.js`, l. 963 à `bd03e48` → l. 977 à `35fb29c`, rougirait sinon). `DB_VERSION` reste **4** ; `ARCHIVE_FORMAT_VERSION` 1. Relevé des pins (depuis la racine du
  worktree ; l'argument est la version relevée au Step 0 de la tâche 1) :

  ```bash
  python3 -I - 0.14.0 <<'PY'
  import glob, sys
  v = sys.argv[1]; v_echappee = v.replace('.', '\\.')
  for f in sorted(glob.glob('tests/*.js')):
      for i, l in enumerate(open(f, encoding='utf-8'), 1):
          if v in l or v_echappee in l:
              print(f'{f}:{i}: {l.strip()[:160]}')
  PY
  ```

- **Aucune migration, aucun SQL, aucun pglast côté F** (R-F-1) ; `supabase/functions/assistant/` change en tâche 1 seulement ; le
  redéploiement de la fonction est un geste du contrôleur, **après** `0006` (cinq outils) collée et prouvée avec le lot B (Clôture).
- **Bases jetables seulement** (`withRepo` de `tests/sync-fixture.js`, qui pose la capture APRÈS `init()` avec `getUserId: () => 'u1'` ;
  `withDatabase` de `tests/backup.js`) ; `fetch`, `pickFiles`, `toast`, `enLigne`, `choisir`, `navigate` injectés ; **aucun réseau** (tout bloc
  qui monte un écran remplace `globalThis.fetch` par un lanceur d'erreur, remis en `finally`, et lit ses sources AVANT) ; aucune clé ; jamais le
  navigateur MCP partagé. Tout bloc qui provoque un `logError` (échec d'image, d'écriture) **remplace `console.error` par un collecteur, remis en
  `finally`** : la suite exige 0 erreur de console hors favicon. Tout espion (`URL.revokeObjectURL`, `URL.createObjectURL`, `globalThis.atob`,
  `globalThis.createImageBitmap`, `AbortSignal.timeout`, `db.mutate`) est posé et retiré en `try/finally` ; jamais `revoquerUrlDeBlob` (liaison
  d'import ESM). Les tests attendent un FAIT (DOM, base, `attendreRecuperation(id)`), jamais un délai. Un test qui enregistre une lecture web attend
  `attendreRecuperation(id)` avant de sortir de son `withRepo`. **Aucun test de la suite navigateur ne modifie `Object.prototype` (ni `.type`
  ni aucun autre champ) ni un autre prototype natif, même sous `try/finally` (R-F-8)** : la suite tourne des cas en parallèle et un appel
  asynchrone y lit des objets nus ; une lecture « par `Object.hasOwn` » s'éprouve par une donnée (un corps sans le champ propre), jamais en
  polluant un prototype.
- **Filet i18n (I-F8).** Tout texte d'écran par `t('…')` littéral, avec son entrée dans `src/i18n/en.js` (apostrophe typographique U+2019 ; textes
  exacts de la spec § 5). `src/ui/photo-plat.js` est le SEUL module qui porte des textes neufs : il est ajouté **aux deux filets** (P-8) —
  `MODULES_NEUFS` de `tests/ajouter.js` (l. 6 à `bd03e48` → l. 7 à `35fb29c` ; le plan B, P-2, y range ses filets) et les `sources` de `sansEntree` de
  `tests/creer-ia.js` (l. 1238 à `bd03e48` comme à `35fb29c`, I-F8). Aucun texte ne nomme le fournisseur ni la base : `Anthropic|Supabase` absent de
  `photo-plat.js`, `photo-web.js` et `base64.js` (test de source, tâche 4) — **commentaires compris** : n'écrire ni l'un ni l'autre mot dans ces
  trois fichiers.
- **Tests de source admis** (et eux seuls) : `Anthropic|Supabase` sur les trois modules neufs ; « aucun `src:` / `.src =` suivi d'une adresse
  `http(s)` » dans `photo-plat.js`, `components.js`, `meals.js` (I-F3) ; « `photo_source_url` n'entre dans aucune ligne qui porte `textContent`, `t(`
  ou `el(` » dans `photo-plat.js` et `recipe.js` (D-F11 : n'écrire `photo_source_url` sur aucune ligne de ces deux fichiers qui porte aussi `t(` ou
  `el(`, commentaires compris) ; de même « `image_url` » dans `import-web.js` (tâche 5) ; « `image_url` passe par `adresseImageAdmise(` dans `lirePage` » ; `base64.js` sans `import` ; `SHELL` ; côté serveur,
  les marqueurs d'ordre d'`index.ts` (N-1 de B, amendé) et les déclarations `suivreRedirections<T>`, `telechargerPage`, `telechargerImage` (tâche 1) ;
  `styles.css` : la règle `.plat-vignette` (D-F9, lue sans commentaires, tâche 4) ; `index.html` : `img-src 'self' blob: data:` inchangée (I-F3,
  tâche 4) ; les filets i18n. Tout le reste par comportement.
- **Commits** par chemin nommé (jamais `-A`), message ASCII sans accents, trailer du modèle réel de l'implémenteur
  (`Co-Authored-By: <modele reel> <noreply@anthropic.com>`, et la ligne de session que le contrôleur donne dans le brief). Jamais réécrire
  l'historique. Ne pas pousser.
- **Caractères invisibles** (U+200B-200D, U+2028/2029, U+202A-202E, U+2060, U+FEFF) : contrôle en Python sur chaque fichier touché, jamais `grep`
  (ugrep : faux zéro mesuré le 18 octobre). Piège : un appel d'outil dont le texte porte une barre oblique inverse suivie de `u` et de quatre
  chiffres hexadécimaux ÉCRIT le caractère décodé — le code de ce plan n'emploie que `String.fromCodePoint(0x…)` ou la forme à accolades `\u{…}`.

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

- **I-F9 : les tests des lots précédents restent verts sans changement**, sauf les **amendements nommés** ici, chacun dans la tâche dont le code
  le fait changer : tâche 1 — `tools/assistant-logique.test.mjs` (la liste `OUTILS` à quatre devient cinq), `tools/assistant-index.test.mjs` (t2 :
  forme exacte de `page` + `RECETTE_LD.image` ; t3 : `PAGE_TEXTE` porte une `og:image` et `page.image_url` est affirmée — dans l'objet `page` ENTIER que B épingle depuis sa ronde 1, EI-2),
  `tools/assistant-lecture-web.test.mjs` (« `lirePageHtml` : assemblage » : forme exacte de `page` + `image_url` — P-9),
  `tools/generer-migrations.test.mjs` (liste d'ordre `ORDRE_DU_FLUX` ; dans N-1, la boucle « déclarations sans marqueur » — quatre déclarations,
  chacune affirmée trouvée, motif étendu à `telechargerImage` — et `decl()` gardé contre une aiguille absente ; l'assertion de préfixe du test
  de `0006`, quelle que soit sa forme — `OUTILS_0006.slice(0, 4)` (B rév. 3) ou `slice(0, OUTILS.length)` —, devient l'égalité `OUTILS` =
  `OUTILS_0006` avec `OUTILS.length === 5`, R-F-9) ; tâche 2 — `tests/lecture-web.js` (l. 45, 47 et 151 à `35fb29c` : formes exactes
  de `page` rendues par `lirePage`, + `image_url: null` en dernier) et les pins de version. **Toute autre assertion existante qui rougit arrête la
  tâche (NEEDS_CONTEXT)**.
- **Rulings de plan** (où ce plan s'écarte de la lettre de la spec, et pourquoi ; chacun se renverse sans défaire le reste) :
  - **P-1** `logError('photo_web.echec', { reason, id })` (et non `{ raison, id }`) : `src/core/log.js` ne garde que les clés `store, id, status,
    reason, table, count` — `raison` serait jetée.
  - **P-2** `etatZonePlat` rend aussi **`motifEteint`** (`'hors_ligne' | 'sans_compte' | null`) : la ligne sous un « Réessayer » éteint est
    décidée par la fonction pure (testable par table), le rendu ne fait que l'afficher ; `null` quand la raison dit déjà « Connecte-toi… »
    (résidu 4 de la vérification rév. 2).
  - **P-3** `lireImageWeb` accepte un `config` facultatif (comme `lireRecetteWeb` de B) pour les tests ; la production n'en passe pas
    (`currentConfig()`).
  - **P-4** `imageOgDe` lit la balise `og:image` par le balayage linéaire UNIQUE de B (`balayer(html).metas` : `lireMetaTranche` capture
    `og:image` en troisième clé, la première occurrence) ; `lirePageHtml` réutilise le `scan` qu'elle a déjà fait (aucun second balayage, D-B12).
    Conséquence nommée : une balise `meta` de plus de 2 048 caractères est ignorée par la borne de B (une `og:image` de plus de ≈ 2 000
    caractères vaut `null`).
  - **P-5** `fabriquerLectureWeb(…, { remplacer: false })` vérifie le vocabulaire sur une COPIE dont l'origine passe `originePhotoAdmise`, et rend le
    signet INTACT (B-24) : sans cela, une fiche reçue avec `photo_origin: 'appareil'` ferait lever « Ajouter sans remplacer ».
  - **P-6** `photo_origin` n'est réécrite par `fabriquerLectureWeb` et « Corriger » que si la fiche la porte (`Object.hasOwn`) : aucune clé ajoutée
    à une fiche ancienne (les formes exactes de B restent vertes).
  - **P-7** `enregistrerLecture` gagne **quatre** dépendances (`ctx`, `fetch`, `enLigne`, `photoAnnoncee`) : la signature du plan B rév. 2
    (`{ repo, remplacer, maintenant, choisir, cle }`, P-12 de B) n'a pas `ctx`, dont `rapatrierPhotoWeb` a besoin pour la session. `cle`, le refus
    `lecture` et la clôture `cloture` de B sont gardés tels quels (les retirer réintroduirait le mutant C23 de B).
  - **P-8** `photo-plat.js` dans les deux filets i18n (ci-dessus).
  - **P-9** le test Node de B « `lirePageHtml` : assemblage » épingle la forme exacte de `page` ; `RICARDO` y porte une `image` : amendé
    (`image_url: 'https://ricardo.test/a.jpg'`), amendement que la spec I-F9 ne listait pas.
  - **P-10** les docs (`CLAUDE.md`, `STATE.md`, `docs/architecture.md`, spec § 12) passent à la Clôture (spec § 9 : tâche 5), comme B (P-7 du plan B).
  - **P-11** le test « l'écriture passe par la capture » vit en tâche 5 (spec § 9) ; § 7.4 le range sous « Rapatriement ».
  - **P-12** le test B-10 « remplaçable à la main… puis relecture de la même page → zéro POST » est coupé en deux : la tâche 3 éprouve le candidat
    pur (`candidatPhotoWeb` → `null` après le remplacement), la tâche 5 le parcours complet de relecture par l'écran web.
  - **P-13** « session nulle avec `ctx.sync.user` posé » : le jeton factice rend `null` tout de suite (`jeton: async () => null`) — même branche que
    « ne répond pas en 2 s » (`sessionAssistant` rend `null` dans les deux cas), sans 2 s d'attente dans la suite.
  - **P-14** worktree `/Users/neeganmac/projects/mistu-plats-en-images` (consigne), et non `~/projects/mistu-plats` (spec, en-tête).
  - **P-15** `monterPhotoPlat` sérialise ses redessins (une file de promesses, motif de `renderImportWeb`) : deux redessins ne s'entrelacent jamais.
  - **P-16** `poserPhotoPlat` : une exception autre qu'`ErreurImage` levée par `preparerPhotoLocale` vaut `refuse(image, 'indecodable')`.
  - **P-17** `descendre` (le corps de `rapatrierPhotoWeb`) attrape toute exception inattendue → `echec('interne')` : rien ne lève vers l'écran (I-F4).
  - **P-18** les assertions neuves de `tests/passerelle.js` n'emploient pas `garde()` : le balayage « jeton absent » du lot 4 compte exactement ses
    résultats (R-T3-12) ; elles contrôlent le jeton sur place.
  - **P-19** D-F15 : la suite n'a pas de routeur, donc un `refresh()` ne redessine rien sous test ; le mutant « `refresh()` après un geste » est tué
    par l'écouteur espion de `cuisineos:refresh` (spec), et la conservation des portions par `#servings-val` ; « le segment Métrique reste actif »
    n'est pas observable (le segmenté ne change pas sa classe au clic, préexistant) et n'est pas affirmé.
  - **P-20** *(refusé en rév. 3, R-F-7)* — la « référence dorée » (le `outerHTML` de la carte relevé en littéral au Step 0 de la tâche 4) est
    abandonnée : le lanceur `suite.cjs` réduit les blancs et coupe chaque échec à 400 caractères (`.slice(0, 400)`, l. 22 du lanceur du lot A,
    relu) — le littéral « obtenu » n'est pas lisible dans le bilan. Retour à la lettre de la spec § 7.4 : la référence est CONSTRUITE dans le
    test (la carte avec photo, rendue par le MÊME composant et privée de sa vignette, doit être exactement la carte sans photo ; un gabarit
    explicite borne la colonne), et le test compare des FAITS (tâche 4, bloc « recipeCard : référence construite »).
  - **P-21** la règle `.plat-vignette` est lue dans `styles.css` **sans ses commentaires**, dans un bloc à part : son rouge se lit au Step 2 de la
    tâche 4 pour la bonne raison (règle absente) ; une règle introuvable est un rouge NOMMÉ, jamais une chaîne vide qui passe les filets.
  - **P-22** les mutants serveur (tâches 1 et 5) se rejouent sur une **copie entière** du worktree dans le scratchpad, une par mutant : les
    harnais Node importent `logique.js` (et `index.ts` charge `lecture-web.js`) par des chemins fixes ; `LECTURE_WEB_JS` et `INDEX_TS` ne
    suffisent pas pour `logique.js`. Jamais une mutation dans le worktree.

## Review Focus

1. **Une photo de la personne n'est jamais écrasée par le web, même par une descente partie avant son geste** (garde des trois champs AVANT `putFile`
   et encore avant l'écriture) → tâche 3, bloc « rapatriement » (« fiche changée pendant la descente », quatre cas).
2. **Le texte ne dépend jamais de l'image** : « Enregistrer » écrit la version et `imports enregistre` AVANT le premier POST `image-web`, et un échec
   d'image laisse l'import, la version et `availability` intacts → tâche 5, bloc « lot F — import web » (« ordre », « échec du rapatriement »).
3. **`image-web` n'atteint jamais le modèle, et le corps reste sous les minuteries** (15 s par saut, 30 s en tout, corps compris, pour `image-web` ET
   `lecture-web`) → tâche 1 (u11, u6 bis (a)-(d)).
4. **Le base64 du serveur se relit au client à toute taille** (tranche multiple de 3 ; longueur exacte) → tâches 1 (« `versBase64` ») et 2
   (« chaînage serveur → client »).
5. **Monter une fiche n'appelle jamais `image-web`** (fiche reçue par la synchronisation, restaurée d'une archive), et « Réessayer » dit son coût
   puis disparaît après une raison définitive → tâche 3 (« monter ne lance aucun appel », « composant : états de la zone »).

---

### Task 1 : Serveur — l'image de la page, l'outil `image-web`, une seule boucle de redirections

Spec § 9 tâche 1 ; § 6.1-6.3 ; § 7.1-7.3 (sauf le chaînage serveur → client, tâche 2). Aucun fichier de l'app (`src/`), aucune version.

**Files:**
- Modify: `supabase/functions/assistant/lecture-web.js` (module feuille de B, 464 lignes à `35fb29c`) — `lireMetaTranche` (l. 285-294, la clé l. 288 :
  troisième clé `og:image`) ; après `siteDe` / `titreDe` (l. 401-406) : `LIMITES_IMAGE`, `typeImageAdmis`, `signatureImage`, `imageDe`, `imageOgDe`,
  `imageUrlDe` (+ l'interne `imageUrlDesMetas`), `TRANCHE_BASE64`, `versBase64` ; `lirePageHtml` (l. 449-464 : `hotesRefuses`, `page.image_url`).
- Modify: `supabase/functions/assistant/logique.js` (l. 7 `OUTILS` ; après l. 7 `OUTILS_MODELE` ; l. 47-52 : le bloc `lecture-web` de `lireDemande`
  devient `lireDemandeUrl`, partagé par `image-web` ; l. 4-5 : le commentaire de B « OUTILS reste à quatre » réécrit, A-1).
- Modify: `supabase/functions/assistant/index.ts` (l. 6-7 imports ; l. 13 cast de `lirePageHtml` ; l. 98-145, la FONCTION `telechargerPage` →
  `suivreRedirections<T>` + `telechargerPage` + `telechargerImage` — les l. 91-97 restent : le commentaire de B, `const REDIRECTIONS`,
  `type PageTelechargee`, `type RefusPage` — ; la boucle extraite garde la garde `r.redirected` de la vague finale de B (l. 116-118, EI-1) ; l. 210
  `corpsModele` ; l. 212-227 : le bloc `image-web` après celui de `lecture-web` ; l. 217 : `hotesRefuses` passé à `lirePageHtml`).
- Test (Modify): `tools/assistant-lecture-web.test.mjs` (fin de fichier : huit tests neufs ; « assemblage », l. 315-346, objet `page` l. 320, amendé, P-9).
- Test (Modify): `tools/assistant-logique.test.mjs` (l. 3 import ; l. 44 `OUTILS` à cinq ; fin : quatre tests neufs).
- Test (Modify): `tools/assistant-index.test.mjs` (l. 594 `RECETTE_LD` + `image` ; l. 597 `PAGE_TEXTE` + `og:image` ; t2 l. 639 et t3 l. 672 amendés ;
  fin : u1 à u11).
- Test (Modify): `tools/generer-migrations.test.mjs` (numéros à `35fb29c`, égaux à ceux du prototype `rejeu2` : l. 741-742 `ORDRE_DU_FLUX` ; test N-1
  l. 747-768 — boucle « déclarations sans marqueur » l. 749-752, `decl` et `deplacees` l. 763-764 ; l'assertion « `OUTILS` préfixe d'`OUTILS_0006` » du
  test de `0006`, l. 1188, forme `slice(0, 4)` (R-F-9), et son commentaire l. 1177-1178 (A-2) ; fin : deux tests neufs, « `OUTILS` = `OUTILS_0006` » et
  « index.ts (lot F) »).

**Interfaces:**
- Consumes (B, à relire au Step 0) : `LIMITES_LECTURE`, `valideAdresse(url, { hotesRefuses })` → `{ ok, href, hote } | { ok: false, raison }`,
  `decoderEntites`, `nettoyerChaineJsonLd`, `balayer(html)` (interne : `{ texte, zones, horsTexte, blocs, titre, metas }`), `lireMetaTranche` (interne),
  `trouverRecettes`, `recetteDepuisJsonLd`, `typeAdmis`, `lireCharset` (`lecture-web.js`) ; `OUTILS`, `LIMITES`, `lireDemande`, `ligneJournal`,
  `corpsErreur` (`logique.js`) ; dans `index.ts` : `lireCorpsBorne(source, max)`, `REDIRECTIONS`, `RefusPage`, `PageTelechargee`, `appelerAnthropic`,
  `traiter` ; harnais `tools/assistant-index.test.mjs` : `remise`, `requete(methode, { texte, signal })`, `lire`, `reserves`, `page({ page, anthropic })`,
  `appelsFetch`, `appelsPage`, `appelsModele`, `ANTHROPIC_URL`, `htmlReponse`, `jsonReponse`, `corpsLecture`, `sourde`, `vider`, `faux`, `ENV`,
  `TEXTE_RECETTE`, `mock` ; `tools/generer-migrations.test.mjs` : `lire`, `sansCommentaires`, `FONCTION`, `ORDRE_DU_FLUX`, `ordreDuFlux`, et
  l'alias d'`OUTILS` importé de `logique.js` (`OUTILS_PASSERELLE` au prototype) et le littéral `OUTILS_0006` (R-F-1).
- Produces (`supabase/functions/assistant/lecture-web.js`) :

```js
export const LIMITES_IMAGE = Object.freeze({ url, octets: 2097152, redirections, delaiSautMs, delaiTotalMs, types: Object.freeze(['image/jpeg', 'image/png', 'image/webp']) });
export function typeImageAdmis(contentType)            // → 'image/jpeg' | 'image/png' | 'image/webp' | null
export function signatureImage(octets)                 // Uint8Array → 'image/jpeg' | 'image/png' | 'image/webp' | null ; ne lève jamais
export function imageDe(objet)                         // → chaîne | null
export function imageOgDe(html)                        // → chaîne | null
export function imageUrlDe(objet, html, { urlFinale, hotesRefuses = [], autresRecettes = 0 } = {})   // → href | null
export const TRANCHE_BASE64 = 24576;
export function versBase64(octets)                     // Uint8Array → base64 avec remplissage
export function lirePageHtml({ html, urlFinale, contentType, hotesRefuses = [] } = {})  // page gagne image_url (dernière clé)
```

- Produces (`logique.js`) : `OUTILS = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'])` ;
  `OUTILS_MODELE = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web'])` ; `lireDemande(texte, { outil: 'image-web', modele, octets,
  hotesRefuses })` → `{ ok: true, corps: { url: href } }` | `{ ok: false, statut: 400, raison: 'forme' }` | `{ ok: false, statut: 422, raison: 'interdit' }` |
  `{ ok: false, statut: 413, raison: 'trop_lourd' }`.
- Produces (`index.ts`, internes) : `suivreRedirections<T>(href, { signal, hotesRefuses, accept, lire }) → { valeur: T, urlFinale } | RefusPage` ;
  `telechargerPage(href, { signal, hotesRefuses }) → PageTelechargee | RefusPage` (comportement de B inchangé) ; `telechargerImage(href, { signal,
  hotesRefuses }) → { octets, type, urlFinale } | RefusPage` ; réponse 200 d'`image-web` : `{ type, taille, url_finale, octets }` (spec § 3.5).

- [ ] **Step 0 : relevés et constats (aucune écriture).**
  1. Départ : lancer la suite, Node, `--check`, `tsc` ; noter dans `.superpowers/sdd/2026-10-19-plats-en-images/progress.md` le bilan, l'épingle
     (`tests/tests.js`), le compte Node, `APP_VERSION`, `sw.js` `VERSION`, `DB_VERSION`.
  2. R-F-1 (précondition 2), constaté en Python sur les trois fichiers. Le script **sort en 1** dès qu'un contrôle manque (NEEDS_CONTEXT, rien
     d'autre n'est tenté) ; il dit aussi la forme du préfixe : `slice(0, 4)` (la forme de B rév. 3) ou `slice(0, <alias>.length)` — les DEUX
     sont admises, sans NEEDS_CONTEXT, et mènent au même amendement, l'égalité du Step 4, point 4 (R-F-9) ; toute autre forme manque (sortie 1).
     Le verdict de la preuve est cherché par son TEXTE (`'image-web'` dans l'appel de réservation), jamais par son numéro : « 2.03 » existe déjà
     pour `lecture-web`.

     ```bash
     python3 -I - <<'PY'
     import re, sys
     CINQ = ['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web']
     sql = open('supabase/migrations/0006_lecture_web.sql', encoding='utf-8').read()
     test = open('tools/generer-migrations.test.mjs', encoding='utf-8').read()
     preuve = open('supabase/proofs/0006_lecture_web.sql', encoding='utf-8').read()
     a = re.search(r"\bOUTILS as (\w+)\b", test)
     alias = a.group(1) if a else '?'
     m = re.search(r"const OUTILS_0006\s*=\s*(?:Object\.freeze\()?\[([^\]]*)\]", test)
     prefixe = re.search(r"OUTILS_0006\.slice\(0,\s*([^)]*)\)", test)
     forme = prefixe.group(1).strip() if prefixe else 'absent'
     FORMES = ('4', alias + '.length')  # R-F-9 : les deux formes de B, admises ; le Step 4, point 4, les change toutes deux en egalite
     controles = [
         ('0006 : check a cinq outils', "check (outil in ('recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'))" in sql),
         ('OUTILS_0006 = les cinq, image-web dernier', bool(m) and re.findall(r"'([^']*)'", m.group(1)) == CINQ),
         ('alias d OUTILS : ' + alias, alias != '?'),
         ('contrainte attendue de 0006 construite depuis OUTILS_0006', 'OUTILS_0006.map(' in test),
         ('egalite a quatre retiree', f"deepEqual({alias}, [...OUTILS_0004, 'lecture-web']" not in test),
         ('OUTILS prefixe d OUTILS_0006 : slice(0, ' + forme + ') ; admises : slice(0, 4) ou slice(0, ' + alias + '.length)', forme in FORMES),
         ('preuve : reservation image-web', "assistant_reserver(uid, 'image-web'" in preuve),
     ]
     for nom, vu in controles:
         print(('ok     ' if vu else 'MANQUE ') + nom)
     sys.exit(0 if all(vu for _, vu in controles) else 1)
     PY
     ```

  3. Relire dans le code RÉEL de B : `lireMetaTranche`, `balayer`, `lirePageHtml` (`lecture-web.js`) ; le bloc `lecture-web` de `lireDemande`
     (`logique.js`) ; `telechargerPage`, la valeur exacte du `user-agent`, le bloc `lecture-web` de `traiter`, le cast de `lirePageHtml` (`index.ts`) ;
     les noms du harnais listés en « Consumes ». Tout écart au prototype se recopie tel quel dans le code ci-dessous (les tests ne changent pas) et
     se consigne dans `progress.md` (amendement nommé, spec § 12). **Lignes (R-F-11)** : les numéros du prototype B (`rejeu2`) cités par
     cette tâche (Files, Steps 3, 4, 6 et 8) peuvent avoir bougé avec le plan B rév. 3 et la construction de B, G, C, D et E : noms ET lignes
     relus sur la tête du lot E ; tout écart est un amendement nommé (consigné dans `progress.md`), pas un constat (R-C-7).
  4. **Relevé du rejeu (`35fb29c`)** : le script du point 2 sort en 0 (sept « ok », forme `slice(0, 4)`, alias `OUTILS_PASSERELLE`) ; `user-agent` =
     `'Mitsu/0.10 (+https://neegans.github.io/mistu/)'` ; harnais : tous les noms de « Consumes » présents (`RECETTE_LD` l. 594, `PAGE_TEXTE` l. 597,
     `sourde` l. 602, `vider` l. 606) ; écarts au prototype : `telechargerPage` porte la garde `r.redirected` → 422 (vague finale de B, `ebbcf10`,
     test t13), son contrôleur de saut s'appelle `ctlSaut` (EI-1) ; t3 épingle l'objet `page` ENTIER (ronde 1 de B, EI-2) ; le commentaire
     d'en-tête de `logique.js` (l. 3-5) et celui d'`OUTILS_0006` (l. 1177-1178) disent « OUTILS reste à quatre » (A-1, A-2).

- [ ] **Step 1 : tests rouges — `tools/assistant-lecture-web.test.mjs`** (ajouter en fin de fichier ; `L`, `test`, `assert`, `MIO`, `script`,
  `RICARDO` sont ceux du fichier de B). Amender aussi « `lirePageHtml` : assemblage » (P-9 ; l. 320 à `35fb29c`) : dans l'objet attendu `page`, ajouter en dernier
  `image_url: 'https://ricardo.test/a.jpg'`.

```js
// --- Lot F « Les plats en images » (spec § 6.1, § 7.1) : l'image de la page et son transport en base64 ------------------------------------------
const octetsDe = (...morceaux) => Uint8Array.from(morceaux.flat());
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
// Octets pseudo-aléatoires à graine fixe (reproductibles d'un passage à l'autre).
const pseudo = (n, graine = 7) => { const u = new Uint8Array(n); let x = graine >>> 0; for (let i = 0; i < n; i += 1) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; u[i] = x >>> 24; } return u; };

test('LIMITES_IMAGE : forme (R-F-4)', () => {
  assert.ok(Object.isFrozen(L.LIMITES_IMAGE) && Object.isFrozen(L.LIMITES_IMAGE.types), 'gelees');
  assert.deepEqual([L.LIMITES_IMAGE.url, L.LIMITES_IMAGE.redirections, L.LIMITES_IMAGE.delaiSautMs, L.LIMITES_IMAGE.delaiTotalMs],
    [L.LIMITES_LECTURE.url, L.LIMITES_LECTURE.redirections, L.LIMITES_LECTURE.delaiSautMs, L.LIMITES_LECTURE.delaiTotalMs], 'url, redirections et delais recopient LIMITES_LECTURE');
  assert.equal(L.LIMITES_IMAGE.octets, 2097152, '2 Mio en litteral : le meme que LIMITES_IMAGE_WEB.octets du client (les deux suites ne partagent aucun module)');
  assert.deepEqual([...L.LIMITES_IMAGE.types], ['image/jpeg', 'image/png', 'image/webp'], 'exactement trois types');
});

test('typeImageAdmis : table', () => {
  const table = [['image/jpeg', 'image/jpeg'], ['IMAGE/PNG; charset=binary', 'image/png'], ['image/webp', 'image/webp'], ['image/gif', null], ['image/svg+xml', null],
    ['image/heic', null], ['text/html', null], ['application/octet-stream', null], ['', null], [null, null], [undefined, null], [7, null]];
  for (const [entree, attendu] of table) assert.equal(L.typeImageAdmis(entree), attendu, String(entree));
});

test('signatureImage : table (les premiers octets doivent dire le type)', () => {
  assert.equal(L.signatureImage(octetsDe([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])), 'image/jpeg');
  assert.equal(L.signatureImage(octetsDe([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), 'image/png');
  assert.equal(L.signatureImage(octetsDe(ascii('RIFF'), [1, 2, 3, 4], ascii('WEBP'), ascii('VP8 '))), 'image/webp');
  assert.equal(L.signatureImage(octetsDe(ascii('RIFF'), [1, 2, 3, 4], ascii('AVI '), [0, 0])), null, 'RIFF sans WEBP aux octets 8-11 : null');
  assert.equal(L.signatureImage(octetsDe(ascii('<!doctype html>'))), null, 'un HTML');
  assert.equal(L.signatureImage(octetsDe(ascii('%PDF-1.4'))), null, 'un PDF');
  assert.equal(L.signatureImage(octetsDe([0xff, 0xd8])), null, 'deux octets');
  assert.equal(L.signatureImage(new Uint8Array(0)), null, 'vide');
  assert.equal(L.signatureImage('pas des octets'), null, 'ne leve jamais');
});

test('imageDe : formes (S-11 : jamais Object.assign ni for…in)', () => {
  assert.equal(L.imageDe({ image: 'https://a.test/i.jpg' }), 'https://a.test/i.jpg', 'chaine');
  assert.equal(L.imageDe({ image: { url: 'https://a.test/u.jpg' } }), 'https://a.test/u.jpg', '{ url }');
  assert.equal(L.imageDe({ image: { contentUrl: 'https://a.test/c.jpg' } }), 'https://a.test/c.jpg', '{ contentUrl }');
  assert.equal(L.imageDe({ image: ['https://a.test/1.jpg', 'https://a.test/2.jpg'] }), 'https://a.test/1.jpg', 'tableau de chaines : la premiere');
  assert.equal(L.imageDe({ image: [{ '@type': 'ImageObject' }, { url: 'https://a.test/o.jpg' }] }), 'https://a.test/o.jpg', 'tableau d ImageObject : le premier qui rend une adresse');
  assert.equal(L.imageDe({ image: [] }), null, 'tableau vide');
  assert.equal(L.imageDe({ image: { '@type': 'ImageObject' } }), null, 'ImageObject sans adresse');
  assert.equal(L.imageDe({ image: '<b>https://a.test/i.jpg</b>' }), 'https://a.test/i.jpg', 'balises retirees');
  assert.equal(L.imageDe({ image: 'https://a.test/i.jpg?a=1&amp;b=2' }), 'https://a.test/i.jpg?a=1&b=2', 'entites decodees');
  assert.equal(L.imageDe({ image: 7 }), null);
  assert.equal(L.imageDe(null), null);
  // S-11 : un champ HÉRITÉ du prototype n'est jamais lu (Object.hasOwn) — le prototype est pollué le temps des appels, rendu en finally. Un
  // JSON.parse de « __proto__ » crée une clé PROPRE et ne prouverait rien (un accès direct x.url y rendrait aussi null).
  try {
    Object.prototype.url = 'https://evil.test/u.jpg'; Object.prototype.image = 'https://evil.test/i.jpg';
    assert.deepEqual([L.imageDe({ image: {} }), L.imageDe({}), L.imageDe({ image: [{}] })], [null, null, null], 'url et image heritees du prototype : jamais lues');
  } finally { delete Object.prototype.url; delete Object.prototype.image; }
});

test('imageOgDe : la balise lue dans sa tranche, lineaire (S-4)', () => {
  assert.equal(L.imageOgDe('<head><meta property="og:image" content="https://a.test/i.jpg"></head>'), 'https://a.test/i.jpg');
  assert.equal(L.imageOgDe('<meta name="og:image" content="https://a.test/n.jpg">'), 'https://a.test/n.jpg', 'name=');
  assert.equal(L.imageOgDe('<meta content="https://a.test/o.jpg" property="og:image">'), 'https://a.test/o.jpg', 'ordre des attributs libre');
  assert.equal(L.imageOgDe("<META PROPERTY='og:image' CONTENT='https://a.test/q.jpg'>"), 'https://a.test/q.jpg', 'casse libre, guillemets simples');
  assert.equal(L.imageOgDe('<meta property="og:image" content="https://a.test/i.jpg?a=1&amp;b=2">'), 'https://a.test/i.jpg?a=1&b=2', 'entites decodees');
  assert.equal(L.imageOgDe('<meta property="og:image" content="https://a.test/1.jpg"><meta property="og:image" content="https://a.test/2.jpg">'), 'https://a.test/1.jpg', 'la premiere');
  assert.equal(L.imageOgDe('<meta property="og:image:secure_url" content="https://a.test/s.jpg">'), null, 'og:image:secure_url seul : ignore');
  assert.equal(L.imageOgDe('<meta property="og:image:url" content="https://a.test/u.jpg">'), null, 'og:image:url seul : ignore');
  assert.equal(L.imageOgDe('<html><head><title>x</title></head></html>'), null, 'absente');
  assert.equal(L.imageOgDe('<meta property="og:image" content="https://a.test/i.jpg"'), null, 'balise jamais fermee : null, sans lever');
  assert.equal(L.imageOgDe(42), null);
  const t0 = performance.now();
  assert.equal(L.imageOgDe('<meta'.repeat(Math.ceil((2 * MIO) / 5))), null);
  assert.ok(performance.now() - t0 < 500, '2 Mio de <meta sans > : sous 500 ms');
});

test('imageUrlDe : priorite, resolution, validation, pages de liste (D-F3)', () => {
  const OG = '<meta property="og:image" content="https://og.test/og.jpg">';
  const base = { urlFinale: 'https://site.test/r/x' };
  assert.equal(L.imageUrlDe({ image: 'https://site.test/ld.jpg' }, OG, base), 'https://site.test/ld.jpg', 'l image du JSON-LD avant og:image');
  assert.equal(L.imageUrlDe({ name: 'x' }, OG, base), 'https://og.test/og.jpg', 'JSON-LD sans image : og:image');
  assert.equal(L.imageUrlDe({ name: 'x' }, OG, { ...base, autresRecettes: 2 }), null, 'page de liste : og:image ecartee');
  assert.equal(L.imageUrlDe({ image: 'https://site.test/ld.jpg' }, OG, { ...base, autresRecettes: 2 }), 'https://site.test/ld.jpg', 'page de liste : l image du Recipe retenu reste');
  assert.equal(L.imageUrlDe(null, OG, base), 'https://og.test/og.jpg', 'sans objet : og:image');
  assert.equal(L.imageUrlDe({ image: '/img/i.jpg' }, '', base), 'https://site.test/img/i.jpg', 'relative resolue contre urlFinale');
  assert.equal(L.imageUrlDe({ image: '//cdn.test/i.jpg' }, '', base), 'https://cdn.test/i.jpg', 'sans schema resolue');
  for (const refusee of ['http://a.test/i.jpg', 'https://127.0.0.1/i.jpg', 'https://a.test:8443/i.jpg', 'https://localhost/i.jpg', 'https://u:p@a.test/i.jpg']) assert.equal(L.imageUrlDe({ image: refusee }, '', base), null, refusee);
  assert.equal(L.imageUrlDe({ image: 'https://projet.test/i.jpg' }, '', { ...base, hotesRefuses: ['projet.test'] }), null, 'hote du projet');
  assert.equal(L.imageUrlDe({ image: 'https://a.test/i.jpg#frag' }, '', base), 'https://a.test/i.jpg', 'fragment retire');
  assert.equal(L.imageUrlDe({ image: 'https://a.test/' + 'x'.repeat(2049 - 15) }, '', base), null, '2 049 points de code');
  assert.equal(L.imageUrlDe({ image: '/i.jpg' }, '', {}), null, 'relative sans urlFinale : null, sans lever');
  assert.equal(L.imageUrlDe(null, '', base), null);
});

test('versBase64 : base64 valide a toute taille (TRANCHE_BASE64 multiple de 3)', () => {
  assert.equal(L.TRANCHE_BASE64, 24576);
  assert.equal(L.TRANCHE_BASE64 % 3, 0, 'une tranche multiple de 3 n a jamais de remplissage');
  assert.deepEqual([L.versBase64(Uint8Array.of(0)), L.versBase64(Uint8Array.of(0, 0)), L.versBase64(new Uint8Array(0))], ['AA==', 'AAA=', '']);
  for (const n of [100000, L.TRANCHE_BASE64 + 1, 2 * L.TRANCHE_BASE64 + 2]) {
    const entree = pseudo(n);
    const sortie = L.versBase64(entree);
    assert.equal(sortie.length, 4 * Math.ceil(n / 3), 'longueur pour ' + n);
    assert.ok(!sortie.slice(0, -2).includes('='), 'aucun = ailleurs que dans les deux derniers caracteres (' + n + ')');
    assert.ok(Buffer.from(sortie, 'base64').equals(Buffer.from(entree)), 'Buffer relit les memes octets (' + n + ')');
    const binaire = atob(sortie);
    assert.ok(binaire.length === n && entree.every((o, i) => binaire.charCodeAt(i) === o), 'atob relit les memes octets (' + n + ')');
  }
});

test('lirePageHtml : page.image_url (le Recipe RETENU, og:image, pages de liste)', () => {
  const ld = (o) => script(o);
  const lisible = (nom, image) => ({ '@type': 'Recipe', name: nom, recipeIngredient: ['1 pomme'], recipeInstructions: ['Cuire.'], ...(image ? { image } : {}) });
  const urlFinale = 'https://site.test/r/1';
  const deux = ld({ '@type': 'Recipe', name: 'Vide', image: 'https://site.test/a.jpg' }) + ld(lisible('Bonne', 'https://site.test/b.jpg'));
  assert.equal(L.lirePageHtml({ html: deux, urlFinale }).page.image_url, 'https://site.test/b.jpg', 'l image du Recipe RETENU (le premier lisible), jamais du premier trouve');
  const texte = '<main><p>' + 'Texte de recette assez long pour le modele. '.repeat(3) + '</p></main>';
  assert.equal(L.lirePageHtml({ html: '<meta property="og:image" content="/og.jpg">' + texte, urlFinale }).page.image_url, 'https://site.test/og.jpg', 'sans JSON-LD : og:image, relative resolue');
  assert.equal(L.lirePageHtml({ html: texte, urlFinale }).page.image_url, null, 'ni l un ni l autre : null');
  assert.equal(L.lirePageHtml({ html: ld(lisible('X', 'https://projet.test/i.jpg')), urlFinale, hotesRefuses: ['projet.test'] }).page.image_url, null, 'hotesRefuses relaye');
  assert.equal(L.lirePageHtml({ html: ld(lisible('X', '/i/x.jpg')), urlFinale }).page.image_url, 'https://site.test/i/x.jpg', 'relative resolue contre urlFinale');
  const liste = L.lirePageHtml({ html: ld(lisible('Un')) + ld(lisible('Deux')) + '<meta property="og:image" content="https://site.test/og.jpg">', urlFinale });
  assert.deepEqual([liste.page.autres_recettes, liste.page.image_url], [1, null], 'deux Recipe lisibles sans image et une og:image : null (page de liste)');
  assert.equal(Object.keys(L.lirePageHtml({ html: texte, urlFinale }).page).at(-1), 'image_url', 'image_url est la derniere cle de page');
});
```

- [ ] **Step 2 : tests rouges — `tools/assistant-logique.test.mjs`.** Import (l. 3) : ajouter `OUTILS_MODELE`. Amender l. 44 :
  `assert.deepEqual(OUTILS, ['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'], 'lot F : cinq outils, image-web dernier (la contrainte de 0006 suit cet ordre, R-F-1)');`.
  Ajouter en fin de fichier (`MODELE`, `LIMITES`, `lireDemande`, `ligneJournal` sont ceux du fichier) :

```js
// --- Lot F « Les plats en images » (spec § 6.2) -----------------------------------------------------------------------------------------------
test('OUTILS_MODELE : gelee, egale a OUTILS sans image-web (image-web n atteint jamais le modele)', () => {
  assert.ok(Object.isFrozen(OUTILS_MODELE));
  assert.deepEqual(OUTILS_MODELE, OUTILS.filter((o) => o !== 'image-web'));
  assert.ok(!OUTILS_MODELE.includes('image-web'));
});
test('lireDemande image-web : liste blanche { url }, adresse revalidee, 422 interdit, rien d autre lu', () => {
  const iw = (corps, extra = {}) => lireDemande(JSON.stringify({ outil: 'image-web', corps }), { outil: 'image-web', modele: MODELE, maxTokens: LIMITES.maxTokens, ...extra });
  assert.deepEqual(iw({ url: 'https://a.test/i.jpg#f', messages: 'x', system: 'y', max_tokens: 9, model: 'autre' }), { ok: true, corps: { url: 'https://a.test/i.jpg' } }, 'champs en trop ignores ; href sans fragment');
  for (const corps of [{}, { url: 7 }, { url: null }, { url: ['https://a.test/i.jpg'] }]) assert.deepEqual([iw(corps).statut, iw(corps).raison], [400, 'forme'], JSON.stringify(corps));
  assert.deepEqual([iw({ url: 'http://a.test/i.jpg' }).statut, iw({ url: 'http://a.test/i.jpg' }).raison], [422, 'interdit']);
  assert.deepEqual([iw({ url: 'https://x.test/i.jpg' }, { hotesRefuses: ['x.test'] }).statut, iw({ url: 'https://x.test/i.jpg' }, { hotesRefuses: ['x.test'] }).raison], [422, 'interdit'], 'S-12');
  const gros = JSON.stringify({ outil: 'image-web', corps: { url: 'https://a.test/i.jpg', bourrage: 'x'.repeat(LIMITES.corps) } });
  assert.equal(lireDemande(gros, { outil: 'image-web', modele: MODELE }).statut, 413, 'corps > 512 Kio');
  assert.equal(iw({ url: 'https://a.test/i.jpg' }).ok, true, 'messages absents : pas une erreur pour cet outil');
});
test('lireDemandeUrl : une regle, deux outils (lecture-web et image-web rendent le meme verdict)', () => {
  const adresses = ['https://a.test/r', 'http://a.test/r', 'https://127.0.0.1/r', 'https://u:p@a.test/r', 'https://a.test:8443/r', 'https://projet.test/r'];
  const verdict = (outil, url) => { const r = lireDemande(JSON.stringify({ outil, corps: { url } }), { outil, modele: MODELE, hotesRefuses: ['projet.test'] }); return r.ok ? r.corps.url : `${r.statut}:${r.raison}`; };
  assert.deepEqual(adresses.map((u) => verdict('image-web', u)), adresses.map((u) => verdict('lecture-web', u)));
  assert.deepEqual(adresses.map((u) => verdict('image-web', u)), ['https://a.test/r', '422:interdit', '422:interdit', '422:interdit', '422:interdit', '422:interdit']);
});
test('ligneJournal : image-web admis, usage nul → jetons null', () => {
  const l = ligneJournal({ ownerId: 'u', outil: 'image-web', statut: 200, usage: null, dureeMs: 3, octets: 40, maintenant: '2026-10-19T00:00:00.000Z' });
  assert.deepEqual([l.outil, l.statut, l.jetons_entree, l.jetons_sortie, l.octets], ['image-web', 200, null, null, 40]);
});
```

- [ ] **Step 3 : tests rouges — `tools/assistant-index.test.mjs`.** Amendements nommés (u9) : `RECETTE_LD` (l. 587 → l. 594 à `35fb29c`) gagne
  `image: ['https://site.test/i/puttanesca.jpg']` ; `PAGE_TEXTE` (l. 590 → l. 597) porte dans son `<head>` `<meta property="og:image" content="https://cdn.test/og.jpg">` ;
  t2 (l. 639) : l'objet attendu de `{ ...corps.page, lue_le: typeof corps.page.lue_le }` gagne en dernier `image_url: 'https://site.test/i/puttanesca.jpg'` ;
  t3 (prototype l. 659 → l. 672 à `35fb29c`, EI-2 : depuis sa ronde 1, B épingle l'objet `page` ENTIER, « comme t2 » ; la ligne à trois champs du
  prototype n'existe plus) : l'objet attendu de `{ ...corps.page, lue_le: typeof corps.page.lue_le }` gagne en dernier `image_url: 'https://cdn.test/og.jpg'`.
  Ajouter en fin de fichier :

```js
// --- Lot F « Les plats en images » (spec § 6.3, § 7.2) : l'outil image-web ------------------------------------------------------------------------
// La boucle de redirections est PARTAGÉE avec lecture-web (suivreRedirections) : les minuteries d'un saut et du téléchargement entier courent
// pendant TOUTE la lecture du corps (D-B26, R-F-6). Le modèle n'est jamais appelé pour image-web.
const corpsImage = (url) => JSON.stringify({ outil: 'image-web', corps: { url } });
const JPEG = (n) => { const u = new Uint8Array(n); u.set([0xff, 0xd8, 0xff, 0xe0].slice(0, n)); for (let i = 4; i < n; i += 1) u[i] = i % 251; return u; };
const PNG = (n) => { const u = new Uint8Array(n); u.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return u; };
const WEBP = (n, quatre = 'WEBP') => { const u = new Uint8Array(n); u.set([...'RIFF'].map((c) => c.charCodeAt(0))); u.set([...quatre].map((c) => c.charCodeAt(0)), 8); return u; };
const imageReponse = (octets, { statut = 200, type = 'image/jpeg', entetes = {} } = {}) => new Response(octets, { status: statut, headers: { 'content-type': type, ...entetes } });
const OUTILS_TELECHARGES = [['image-web', corpsImage, 'image/jpeg', 0xff], ['lecture-web', corpsLecture, 'text/html; charset=utf-8', 0x3c]];
// Un corps qui GOUTTE : un octet par seconde (minuteries simulées), jamais fermé ; l'abandon du signal du saut le fait échouer (comme undici).
function goutte(options, octet) {
  const etat = { annule: false };
  const corps = new ReadableStream({
    start(c) {
      const un = () => { if (options.signal.aborted) return; c.enqueue(Uint8Array.of(octet)); setTimeout(un, 1000); };
      options.signal.addEventListener('abort', () => { etat.annule = true; try { c.error(new DOMException('Aborted', 'AbortError')); } catch { /* deja en erreur */ } }, { once: true });
      setTimeout(un, 1000);
    },
    cancel() { etat.annule = true; },
  });
  return { corps, etat };
}

test('u1. image-web : http:// → 422 interdit AVANT toute reservation, aucun fetch ; u1bis : l hote de SUPABASE_URL → 422 (S-12)', async () => {
  remise();
  const r = await handler(requete('POST', { texte: corpsImage('http://site.test/i.jpg') }));
  assert.deepEqual([r.status, await lire(r), reserves().length, appelsFetch.length, faux.MAJ.length], [422, { erreur: 'interdit' }, 0, 0, 0]);
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  const r2 = await handler(requete('POST', { texte: corpsImage('https://projet.test/i.jpg') }));
  assert.deepEqual([r2.status, await lire(r2), reserves().length, appelsFetch.length], [422, { erreur: 'interdit' }, 0, 0]);
});

test('u2. une JPEG : reservation image-web par la cle secrete, UN fetch (trois en-tetes EXACTEMENT), AUCUN fetch du fournisseur, 200 base64, journal jetons null', async () => {
  remise();
  const octets = JPEG(1000);
  page({ page: async () => imageReponse(octets) });
  const texte = corpsImage('https://site.test/i.jpg');
  const r = await handler(requete('POST', { texte }));
  assert.equal(r.status, 200);
  const corps = await lire(r);
  assert.deepEqual(reserves()[0].args, { p_owner: 'compte-1', p_outil: 'image-web', p_octets: Buffer.byteLength(texte), p_quota: 2 });
  assert.equal(reserves()[0].cle, 'sb_secret_factice');
  assert.deepEqual([appelsFetch.length, appelsModele().length], [1, 0], 'un seul fetch : l image ; aucun appel au modele');
  const f = appelsPage()[0];
  assert.deepEqual([f.url, f.options.method, f.options.redirect, f.options.credentials], ['https://site.test/i.jpg', 'GET', 'manual', 'omit']);
  assert.deepEqual(Object.keys(f.options.headers).sort(), ['accept', 'accept-language', 'user-agent'], 'exactement trois en-tetes : jamais referer, origin, cookie, authorization, apikey');
  assert.ok(f.options.headers['user-agent'].startsWith('Mitsu/') && f.options.headers.accept.startsWith('image/jpeg'));
  assert.deepEqual(Object.keys(corps).sort(), ['octets', 'taille', 'type', 'url_finale']);
  assert.deepEqual([corps.type, corps.taille, corps.url_finale], ['image/jpeg', 1000, 'https://site.test/i.jpg']);
  assert.ok(Buffer.from(corps.octets, 'base64').equals(Buffer.from(octets)), 'les octets relus du base64');
  assert.deepEqual(faux.MAJ[0].v, { statut: 200, jetons_entree: null, jetons_sortie: null, duree_ms: faux.MAJ[0].v.duree_ms });
  assert.deepEqual(faux.evenements, ['rpc:is_allowed', 'rpc:assistant_reserver', 'fetch', 'update']);
});

test('u3. redirections : suivies et revalidees, corps du 3xx annule ; http, localhost, IP, SUPABASE_URL → 422 apres reservation ; quatre 301 → 502 ; sans location → 502 ; relative resolue', async () => {
  remise();
  let annule = false;
  page({ page: async (url) => (url === 'https://site.test/i.jpg' ? new Response(new ReadableStream({ cancel() { annule = true; } }), { status: 301, headers: { location: 'https://cdn.test/i.jpg' } }) : imageReponse(JPEG(50))) });
  const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
  await vider();
  assert.deepEqual([r.status, (await lire(r)).url_finale, appelsPage().map((a) => a.url), annule], [200, 'https://cdn.test/i.jpg', ['https://site.test/i.jpg', 'https://cdn.test/i.jpg'], true]);
  for (const cible of ['http://cdn.test/i.jpg', 'https://localhost/i.jpg', 'https://127.0.0.1/i.jpg', 'https://projet.test/i.jpg']) {
    remise(); ENV.SUPABASE_URL = 'https://projet.test';
    page({ page: async () => new Response(null, { status: 302, headers: { location: cible } }) });
    const x = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    assert.deepEqual([x.status, await lire(x), reserves().length, appelsPage().length, faux.MAJ[0].v.statut], [422, { erreur: 'interdit' }, 1, 1, 422], cible + ' : reservation faite, cible jamais demandee');
  }
  remise(); let n = 0;
  page({ page: async () => { n += 1; return new Response(null, { status: 301, headers: { location: `https://site.test/s${n}.jpg` } }); } });
  const chaine = await handler(requete('POST', { texte: corpsImage('https://site.test/s0.jpg') }));
  assert.deepEqual([chaine.status, await lire(chaine), appelsPage().length], [502, { erreur: 'inaccessible' }, 4], 'quatre 301 : trois suivis, le quatrieme refuse');
  remise(); page({ page: async () => new Response(null, { status: 301 }) });
  const sans = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
  assert.deepEqual([sans.status, await lire(sans)], [502, { erreur: 'inaccessible' }], '3xx sans location');
  remise();
  page({ page: async (url) => (url === 'https://site.test/x/a.jpg' ? new Response(null, { status: 307, headers: { location: '/c.jpg' } }) : imageReponse(JPEG(20))) });
  const rel = await handler(requete('POST', { texte: corpsImage('https://site.test/x/a.jpg') }));
  assert.deepEqual([rel.status, appelsPage().map((a) => a.url)], [200, ['https://site.test/x/a.jpg', 'https://site.test/c.jpg']], 'location relative resolue');
});

test('u4. type et signature : text/html, svg, gif, PNG de 0 octet → 422 pas_une_image (corps annule) ; u4bis : HTML ou PNG annonces jpeg → 422 sans rien relayer ; RIFF…WEBP → 200 ; RIFF…AVI → 422', async () => {
  for (const type of ['text/html', 'image/svg+xml', 'image/gif']) {
    remise(); let annule = false;
    page({ page: async () => new Response(new ReadableStream({ cancel() { annule = true; } }), { status: 200, headers: { 'content-type': type } }) });
    const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i') }));
    await vider();
    assert.deepEqual([r.status, await lire(r), annule, faux.MAJ[0].v.statut], [422, { erreur: 'pas_une_image' }, true, 422], type);
  }
  remise(); page({ page: async () => imageReponse(new Uint8Array(0), { type: 'image/png' }) });
  assert.deepEqual(await lire(await handler(requete('POST', { texte: corpsImage('https://site.test/vide.png') }))), { erreur: 'pas_une_image' }, 'corps de 0 octet');
  const html = new TextEncoder().encode('<!doctype html><p>IMAGE-SENTINELLE</p>');
  for (const [octets, type, attendu, nom] of [[html, 'image/jpeg', 422, 'HTML annonce jpeg'], [PNG(64), 'image/jpeg', 422, 'PNG annoncee jpeg'], [WEBP(64), 'image/webp', 200, 'RIFF…WEBP'], [WEBP(64, 'AVI '), 'image/webp', 422, 'RIFF…AVI']]) {
    remise(); page({ page: async () => imageReponse(octets, { type }) });
    const r = await handler(requete('POST', { texte: corpsImage('https://site.test/x') }));
    const t = await r.text();
    assert.equal(r.status, attendu, nom);
    if (attendu === 422) assert.deepEqual([JSON.parse(t), t.includes('SENTINELLE'), JSON.stringify(faux.MAJ).includes('SENTINELLE')], [{ erreur: 'pas_une_image' }, false, false], nom + ' : rien du corps, ni dans la reponse ni au journal');
  }
});

test('u5. 2 Mio (R-F-4) : content-length 2 097 153 → 413 sans lire (cancel) ; flux de 2 Mio + 1 sans content-length → 413 ; 2 097 152 exactement → 200, 2 796 204 caracteres', async () => {
  remise(); let annule = false;
  page({ page: async () => new Response(new ReadableStream({ pull(c) { c.enqueue(JPEG(16)); }, cancel() { annule = true; } }), { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '2097153' } }) });
  const r1 = await handler(requete('POST', { texte: corpsImage('https://site.test/gros.jpg') }));
  await vider();
  assert.deepEqual([r1.status, await lire(r1), annule], [413, { erreur: 'image_trop_lourde' }, true]);
  remise();
  const TOTAL = 2 * MIO + 1; let envoyes = 0; let annule2 = false; let finDemandee = false;
  // Rejeu (D-1) : la fermeture est differee d'un tirage — fermé juste après le dernier octet, le flux serait déjà CLOS quand le lecteur franchit la
  // borne (reader.cancel() sur un flux clos n'appelle jamais cancel) ; différée, un lecteur qui ne coupe pas reçoit quand même la fin (aucun blocage).
  page({ page: async () => new Response(new ReadableStream({
    pull(c) { if (envoyes >= TOTAL) { if (finDemandee) c.close(); finDemandee = true; return; } const n = Math.min(64 * 1024, TOTAL - envoyes); const m = new Uint8Array(n); if (envoyes === 0) m.set([0xff, 0xd8, 0xff]); envoyes += n; c.enqueue(m); },
    cancel() { annule2 = true; },
  }), { status: 200, headers: { 'content-type': 'image/jpeg' } }) });
  const r2 = await handler(requete('POST', { texte: corpsImage('https://site.test/flux.jpg') }));
  await vider();
  assert.deepEqual([r2.status, await lire(r2), annule2], [413, { erreur: 'image_trop_lourde' }, true], 'flux de 2 Mio + 1 : coupe en route');
  remise();
  page({ page: async () => imageReponse(JPEG(2097152)) });
  const r3 = await handler(requete('POST', { texte: corpsImage('https://site.test/juste.jpg') }));
  const c3 = await lire(r3);
  assert.deepEqual([r3.status, c3.taille, c3.octets.length], [200, 2097152, 2796204]);
});

test('u6. 404 / 500 / 403 / DNS → 502 inaccessible ; un saut a 15 s → 502 ; trois sauts de 12 s → 502 a 30 s ; ctl a 120 s pendant les en-tetes → 504', async () => {
  for (const s of [404, 500, 403]) {
    remise(); page({ page: async () => imageReponse(JPEG(10), { statut: s }) });
    const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [502, { erreur: 'inaccessible' }, 502], 'statut ' + s);
  }
  remise(); page({ page: async () => { throw new TypeError('getaddrinfo ENOTFOUND'); } });
  assert.equal((await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }))).status, 502, 'DNS');
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    let signalSaut = null; let parti; const appele = new Promise((res) => { parti = res; });
    page({ page: (url, options) => { signalSaut = options.signal; parti(); return sourde(url, options); } });
    const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    await appele;
    mock.timers.tick(LIMITES_LECTURE.delaiSautMs - 1);
    assert.equal(signalSaut.aborted, false, 'pas encore a 14,999 s');
    mock.timers.tick(1);
    assert.equal(signalSaut.aborted, true, 'abandonne a 15 s');
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r)], [502, { erreur: 'inaccessible' }]);
  } finally { mock.timers.reset(); }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = []; let prochain; const attendreAppel = () => new Promise((res) => { prochain = res; });
    let appel = attendreAppel();
    page({ page: (url, options) => { signaux.push(options.signal); prochain(); return new Promise((resoudre, rejeter) => {
      options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resoudre(new Response(null, { status: 301, headers: { location: `https://site.test/n${signaux.length}.jpg` } })), 12000);
    }); } });
    const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/n0.jpg') }));
    await appel; appel = attendreAppel(); mock.timers.tick(12000); await appel;
    appel = attendreAppel(); mock.timers.tick(12000); await appel;
    mock.timers.tick(5999);
    assert.equal(signaux[2].aborted, false, 'troisieme saut : rien a 29,999 s');
    mock.timers.tick(1);
    assert.equal(signaux[2].aborted, true, 'abandonne a 30 s en tout');
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), signaux.length], [502, { erreur: 'inaccessible' }, 3]);
  } finally { mock.timers.reset(); }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    let parti; const appele = new Promise((res) => { parti = res; });
    page({ page: (url, options) => { parti(); return sourde(url, options); } });
    const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    await appele;
    mock.timers.tick(LIMITES.attenteMs); // le saut, le total et le budget tombent dans le même tour : le budget l'emporte (D-B26)
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [504, { erreur: 'delai' }, 504]);
  } finally { mock.timers.reset(); }
});

test('u6 bis (a). R-F-6 / D-B26 : en-tetes en 1 s puis un corps qui goutte → coupe a 15 s EXACTES (la minuterie du saut court pendant le corps), 502 — image-web ET lecture-web', async () => {
  for (const [nom, corpsDe, type, octet] of OUTILS_TELECHARGES) {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      remise();
      let signalSaut = null; let parti; const appele = new Promise((res) => { parti = res; });
      page({ page: (url, options) => { signalSaut = options.signal; parti(); return new Promise((resoudre) => { setTimeout(() => resoudre(new Response(goutte(options, octet).corps, { status: 200, headers: { 'content-type': type } })), 1000); }); } });
      const enCours = handler(requete('POST', { texte: corpsDe('https://site.test/g') }));
      await appele;
      mock.timers.tick(1000); await vider();
      mock.timers.tick(LIMITES_LECTURE.delaiSautMs - 1000 - 1); await vider();
      assert.equal(signalSaut.aborted, false, nom + ' : rien a 14,999 s');
      mock.timers.tick(1);
      assert.equal(signalSaut.aborted, true, nom + ' : coupe a 15 s, corps compris');
      const r = await enCours;
      assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [502, { erreur: 'inaccessible' }, 502], nom + ' : 502 (jamais 504 a 120 s)');
    } finally { mock.timers.reset(); }
  }
});

test('u6 bis (b). la minuterie GLOBALE pendant le corps : deux 301 de 12 s, puis en-tetes en 1 s et un corps qui goutte → coupe a 30 s exactes, 502 — pour les deux outils', async () => {
  for (const [nom, corpsDe, type, octet] of OUTILS_TELECHARGES) {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      remise();
      const signaux = []; let prochain; const attendreAppel = () => new Promise((res) => { prochain = res; });
      let appel = attendreAppel();
      page({ page: (url, options) => {
        signaux.push(options.signal); prochain();
        if (signaux.length <= 2) return new Promise((resoudre, rejeter) => { options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError'))); setTimeout(() => resoudre(new Response(null, { status: 301, headers: { location: `https://site.test/n${signaux.length}` } })), 12000); });
        return new Promise((resoudre) => { setTimeout(() => resoudre(new Response(goutte(options, octet).corps, { status: 200, headers: { 'content-type': type } })), 1000); });
      } });
      const enCours = handler(requete('POST', { texte: corpsDe('https://site.test/n0') }));
      await appel; appel = attendreAppel(); mock.timers.tick(12000); await appel;
      appel = attendreAppel(); mock.timers.tick(12000); await appel;
      mock.timers.tick(1000); await vider();
      mock.timers.tick(4999); await vider();
      assert.equal(signaux[2].aborted, false, nom + ' : rien a 29,999 s');
      mock.timers.tick(1);
      assert.equal(signaux[2].aborted, true, nom + ' : coupe a 30 s en tout, corps compris');
      const r = await enCours;
      assert.deepEqual([r.status, await lire(r), signaux.length], [502, { erreur: 'inaccessible' }, 3], nom);
    } finally { mock.timers.reset(); }
  }
});

test('u6 bis (c). abandon par ctl (120 s) PENDANT le corps → 504 delai — pour les deux outils', async () => {
  for (const [nom, corpsDe, type, octet] of OUTILS_TELECHARGES) {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      remise();
      let parti; const appele = new Promise((res) => { parti = res; });
      page({ page: (url, options) => { parti(); return new Promise((resoudre) => { setTimeout(() => resoudre(new Response(goutte(options, octet).corps, { status: 200, headers: { 'content-type': type } })), 1000); }); } });
      const enCours = handler(requete('POST', { texte: corpsDe('https://site.test/c') }));
      await appele;
      mock.timers.tick(1000); await vider();
      mock.timers.tick(LIMITES.attenteMs - 1000); // le saut (15 s), le total (30 s) et le budget (120 s) tombent dans le même tour : le budget l'emporte
      const r = await enCours;
      assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [504, { erreur: 'delai' }, 504], nom);
    } finally { mock.timers.reset(); }
  }
});

test('u6 bis (d). le client part PENDANT le corps → flux annule (lecteur factice), aucun corps, journal 499 — pour les deux outils', { timeout: 8000 }, async () => {
  for (const [nom, corpsDe, type, octet] of OUTILS_TELECHARGES) {
    remise();
    const etat = { annule: false }; let parti; const appele = new Promise((res) => { parti = res; });
    page({ page: (url, options) => {
      parti();
      const corps = new ReadableStream({ start(c) { c.enqueue(Uint8Array.of(octet)); options.signal.addEventListener('abort', () => { etat.annule = true; try { c.error(new DOMException('Aborted', 'AbortError')); } catch { /* deja en erreur */ } }, { once: true }); }, cancel() { etat.annule = true; } });
      return Promise.resolve(new Response(corps, { status: 200, headers: { 'content-type': type } }));
    } });
    const client = new AbortController();
    const enCours = handler(requete('POST', { texte: corpsDe('https://site.test/d'), signal: client.signal }));
    await appele; await vider();
    client.abort();
    const r = await enCours;
    assert.deepEqual([r.status, await r.text(), etat.annule, faux.MAJ[0].v.statut], [499, '', true, 499], nom);
  }
});

test('u7. abandon du client pendant les en-tetes → fetch abandonne, 499 sans corps, journal 499', { timeout: 8000 }, async () => {
  remise();
  let signalSaut = null; let parti; const appele = new Promise((res) => { parti = res; });
  page({ page: (url, options) => { signalSaut = options.signal; parti(); return sourde(url, options); } });
  const client = new AbortController();
  const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg'), signal: client.signal }));
  await appele;
  client.abort();
  const r = await enCours;
  assert.deepEqual([r.status, await r.text(), signalSaut.aborted, faux.MAJ[0].v.statut], [499, '', true, 499]);
});

test('u8. jamais le corps d une page d erreur : un 500 qui porte IMAGE-SENTINELLE → 502 inaccessible, absent de la reponse et du journal', async () => {
  remise();
  page({ page: async () => new Response('IMAGE-SENTINELLE', { status: 500, headers: { 'content-type': 'text/plain' } }) });
  const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
  const t = await r.text();
  assert.deepEqual([r.status, JSON.parse(t), t.includes('SENTINELLE'), JSON.stringify(faux.MAJ).includes('SENTINELLE')], [502, { erreur: 'inaccessible' }, false, false]);
});

test('u9. lecture-web : une page sans image → page.image_url null ; une og:image relative est resolue contre l adresse finale', async () => {
  const modele = async () => jsonReponse(200, { model: 'm', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: '{}' }] });
  remise();
  page({ page: async () => htmlReponse(`<html><head><title>T</title></head><body><main><p>${TEXTE_RECETTE}</p></main></body></html>`), anthropic: modele });
  assert.equal((await lire(await handler(requete('POST', { texte: corpsLecture('https://site.test/sans') })))).page.image_url, null);
  remise();
  page({ page: async () => htmlReponse(`<html><head><meta property="og:image" content="/img/og.jpg"></head><body><main><p>${TEXTE_RECETTE}</p></main></body></html>`), anthropic: modele });
  assert.equal((await lire(await handler(requete('POST', { texte: corpsLecture('https://site.test/r/og') })))).page.image_url, 'https://site.test/img/og.jpg');
});

test('u10. une seule boucle : image-web et lecture-web rediriges vers https://localhost/ rendent le meme 422 interdit', async () => {
  const issues = [];
  for (const corpsDe of [corpsImage, corpsLecture]) {
    remise(); page({ page: async () => new Response(null, { status: 302, headers: { location: 'https://localhost/x' } }) });
    const r = await handler(requete('POST', { texte: corpsDe('https://site.test/a') }));
    issues.push([r.status, await lire(r), appelsPage().length, faux.MAJ[0].v.statut]);
  }
  assert.deepEqual(issues, [[422, { erreur: 'interdit' }, 1, 422], [422, { erreur: 'interdit' }, 1, 422]]);
});

test('u11. image-web n atteint JAMAIS le modele : pour chaque issue, zero fetch vers le fournisseur, aucun x-api-key', { timeout: 8000 }, async () => {
  const sansModele = (nom) => {
    assert.equal(appelsModele().length, 0, nom + ' : aucun appel au modele');
    assert.ok(appelsFetch.every((a) => !Object.keys(a.options?.headers || {}).some((h) => h.toLowerCase() === 'x-api-key')), nom + ' : aucun x-api-key');
  };
  const issues = [
    ['200', async () => imageReponse(JPEG(40)), 200],
    ['interdit (redirection)', async () => new Response(null, { status: 302, headers: { location: 'https://localhost/' } }), 422],
    ['pas_une_image', async () => imageReponse(new TextEncoder().encode('<p>x</p>'), { type: 'text/html' }), 422],
    ['image_trop_lourde', async () => imageReponse(JPEG(10), { entetes: { 'content-length': '2097153' } }), 413],
    ['inaccessible', async () => imageReponse(JPEG(10), { statut: 404 }), 502],
    ['exception levee par telechargerImage', async () => ({ status: 301, headers: { get: () => { throw new Error('en-tete hostile'); } }, body: null }), 502],
  ];
  for (const [nom, rep, statut] of issues) {
    remise(); page({ page: rep });
    const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    assert.equal(r.status, statut, nom);
    await r.text();
    sansModele(nom);
  }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise(); let parti; const appele = new Promise((res) => { parti = res; });
    page({ page: (url, options) => { parti(); return sourde(url, options); } });
    const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    await appele; mock.timers.tick(LIMITES.attenteMs);
    assert.equal((await enCours).status, 504, '504');
    sansModele('504');
  } finally { mock.timers.reset(); }
  remise(); let parti; const appele = new Promise((res) => { parti = res; });
  page({ page: (url, options) => { parti(); return sourde(url, options); } });
  const client = new AbortController();
  const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg'), signal: client.signal }));
  await appele; client.abort();
  assert.equal((await enCours).status, 499, '499');
  sansModele('499');
});
```

- [ ] **Step 4 : tests rouges — `tools/generer-migrations.test.mjs`.** (1) `ORDRE_DU_FLUX` (l. 741-742 à `35fb29c`, comme au prototype) : insérer
  `'await telechargerImage('` entre `'lirePageHtml('` et `'await appelerAnthropic('`. (2) Dans le test N-1 (l. 747-768) : la boucle « déclarations sans
  marqueur » (l. 749-752) couvre les QUATRE déclarations, affirme que chacune est TROUVÉE, et son motif compte aussi `telechargerImage` ; `decl()` (l. 763)
  refuse une aiguille absente ; `deplacees` (l. 764) déplace les quatre. L'aiguille est la chaîne que le code DÉCLARE : `suivreRedirections<T>(`
  (générique TypeScript, Step 8) — `'async function suivreRedirections('` ne s'y trouve pas : `indexOf` vaudrait -1, la tranche examinée serait
  vide et le témoin ne déplacerait rien, vert sans rien tester. Les lignes 749-752 et 763-764 deviennent :

```js
  for (const nom of ['async function suivreRedirections<T>(', 'async function telechargerPage(', 'async function telechargerImage(', 'async function appelerAnthropic(']) {
    const debut = code.indexOf(nom); assert.notEqual(debut, -1, nom + ' : declaration trouvee');
    const corps = code.slice(debut, code.indexOf('\n}\n', debut));
    assert.ok(!/await (telechargerPage|telechargerImage|appelerAnthropic)\(/.test(corps) && !corps.includes('lirePageHtml('), nom + ' ne porte aucun marqueur du flux');
  }
  // … (l. 753-762 inchangées)
  const decl = (nom) => { const d = code.indexOf(nom); assert.notEqual(d, -1, nom + ' : declaration trouvee'); return code.slice(d, code.indexOf('\n}\n', d) + 3); };
  const deplacees = [decl('async function suivreRedirections<T>('), decl('async function telechargerPage('), decl('async function telechargerImage('), decl('async function appelerAnthropic(')];
```

  Le message de `await fetch(` compté 2, dans le test d'avant N-1 (l. 736 à `35fb29c`), devient « la page ou l'image dans suivreRedirections, le
  fournisseur dans appelerAnthropic ». (3) Ajouter les deux tests ci-dessous (`OUTILS_PASSERELLE` et `OUTILS_0006` : les noms relevés au Step 0).
  (4) **Préfixe → égalité (R-F-9), quelle que soit la forme lue au Step 0** : la ligne du test de `0006` qui affirme `OUTILS_PASSERELLE` égal à
  `OUTILS_0006.slice(0, 4)` (la forme de B rév. 3) ou à `OUTILS_0006.slice(0, OUTILS_PASSERELLE.length)` est REMPLACÉE (l. 1188 à `35fb29c`, forme `slice(0, 4)` relevée), à la même place et avec
  son indentation, par deux assertions : `assert.equal(OUTILS_PASSERELLE.length, 5, 'lot F : cinq outils, image-web compris (R-F-9)');` puis
  `assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0006, 'lot F : le prefixe de B devient l egalite (R-F-9)');` (amendement nommé, I-F9 ; le test
  neuf « lot F : OUTILS porte les cinq outils de 0006 » ci-dessous reste : deux témoins du même fait).
  A-2 (rejeu) : le commentaire de B juste au-dessus d'`OUTILS_0006` (l. 1177-1178 à `35fb29c`) disait « OUTILS (logique.js) en porte quatre : une valeur
  admise de plus dans un check est inoffensive tant qu'OUTILS ne la porte pas. » ; sa seconde ligne devient « Depuis le lot F, OUTILS (logique.js) porte
  les cinq : OUTILS = OUTILS_0006 (R-F-9). ».

```js
// --- Lot F « Les plats en images » (spec § 6.3, § 7.2-7.3) : image-web dans le flux, une seule boucle, le modele jamais atteint ; OUTILS = 0006
test('lot F : OUTILS porte les cinq outils de 0006, image-web dernier (le prefixe devient l egalite)', () => {
  assert.equal(OUTILS_PASSERELLE.length, 5);
  assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0006);
});
test('index.ts (lot F) : image-web dans l ordre du flux, une seule boucle de redirections, corpsModele par OUTILS_MODELE ; mutant « reservation apres telechargerImage » rouge', () => {
  const code = sansCommentaires(lire(`${FONCTION}/index.ts`));
  assert.deepEqual(ordreDuFlux(code), { presents: true, croissants: true });
  assert.equal((code.match(/redirect: 'manual'/g) || []).length, 1, 'une seule boucle (suivreRedirections)');
  assert.equal((code.match(/await fetch\(/g) || []).length, 2, 'deux appels sortants : la page ou l image dans suivreRedirections, le fournisseur dans appelerAnthropic');
  assert.ok(code.includes('OUTILS_MODELE.includes(outil)'), 'corpsModele initialise par la liste fermee');
  for (const nom of ['async function suivreRedirections<T>(', 'async function telechargerPage(', 'async function telechargerImage(']) assert.notEqual(code.indexOf(nom), -1, nom);
  // Mutant : la réservation déplacée sous le téléchargement de l'IMAGE → l'ordre casse. (« un second await fetch( dans telechargerImage » se
  // rejoue sur une COPIE d'index.ts, Step 10 : le compte ci-dessus le tue.)
  const debutRes = code.indexOf('  const { data: idReserve');
  assert.notEqual(debutRes, -1, 'la ligne de reservation est trouvee');
  const reservation = code.slice(debutRes, code.indexOf('\n', debutRes) + 1);
  const sansRes = code.replace(reservation, '');
  const apres = sansRes.indexOf('\n', sansRes.indexOf('await telechargerImage(')) + 1;
  const mutant1 = sansRes.slice(0, apres) + reservation + sansRes.slice(apres);
  assert.deepEqual(ordreDuFlux(mutant1), { presents: true, croissants: false }, 'mutant « reservation apres telechargerImage » : rouge');
});
```

- [ ] **Step 5 : rouge lu.** `node --test --test-timeout=10000 tools/*.test.mjs` (D-3 : sans `--test-timeout`, le rouge ne finit pas — u6, u6 bis, u7 et u11
  attendent un `fetch` de l'image qui ne part jamais contre le code d'avant) : les tests neufs et amendés rougissent (exports absents, `OUTILS` à quatre,
  `image_url` absent, `telechargerImage` absent) ; noter le compte rouge dans `progress.md`. Mesuré au rejeu (tests sur le code serveur de `35fb29c`) :
  `tests 174, pass 142, fail 29, cancelled 3` (`assistant-logique.test.mjs` rougit en bloc à l'import d'`OUTILS_MODELE`).

- [ ] **Step 6 : implémenter `lecture-web.js`.** (1) `lireMetaTranche` (prototype l. 218 → l. 288 à `35fb29c`) : la clé admet `og:image` —
  `const cle = /\b(?:property|name)\s*=\s*["']?\s*(og:site_name|author|og:image)["'\s/>]/.exec(tranche);` (`og:image:url` et `og:image:secure_url`
  ne passent pas : le caractère qui suit doit être un guillemet, une espace, `/` ou `>`). (2) Après `titreDe` :

```js
// --- Lot F « Les plats en images » (spec § 6.1) : l'image de la page et son transport ----------------------------------------------------------
// L'image d'une page est une DONNÉE HOSTILE comme le reste : lue par Object.hasOwn, nettoyée, résolue contre l'adresse finale (une adresse
// relative ou sans schéma), puis revalidée par valideAdresse (https, hôte public, ni IP, ni port, ni identifiants, ≤ 2 048, hôte du projet refusé).
export const LIMITES_IMAGE = Object.freeze({
  url: LIMITES_LECTURE.url, octets: 2 * 1024 * 1024, redirections: LIMITES_LECTURE.redirections, delaiSautMs: LIMITES_LECTURE.delaiSautMs,
  delaiTotalMs: LIMITES_LECTURE.delaiTotalMs, types: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
});
export function typeImageAdmis(contentType) {
  if (typeof contentType !== 'string') return null;
  const t = contentType.split(';')[0].trim().toLowerCase();
  return LIMITES_IMAGE.types.includes(t) ? t : null;
}
// Les premiers octets doivent dire le type annoncé (S-7) : un HTML, un PDF ou une PNG annoncés image/jpeg ne sont jamais relayés.
export function signatureImage(octets) {
  try {
    if (!(octets instanceof Uint8Array)) return null;
    const a = (i, liste) => octets.length >= i + liste.length && liste.every((x, k) => octets[i + k] === x);
    if (a(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (a(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
    if (a(0, [0x52, 0x49, 0x46, 0x46]) && a(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
    return null;
  } catch { return null; }
}
// `image` d'un objet Recipe : une chaîne ; un objet nu → url, sinon contentUrl ; un tableau → le premier élément qui rend une adresse (profondeur 2 :
// un tableau d'ImageObject). Jamais Object.assign ni une boucle « in » (S-11 de B).
const PROFONDEUR_IMAGE = 2;
function adresseDe(x, profondeur) {
  if (typeof x === 'string') return nettoyerChaineJsonLd(x) || null;
  if (Array.isArray(x)) {
    if (profondeur >= PROFONDEUR_IMAGE) return null;
    for (const y of x) { const a = adresseDe(y, profondeur + 1); if (a) return a; }
    return null;
  }
  if (objetNu(x)) {
    const u = propre(x, 'url'); const c = propre(x, 'contentUrl');
    return (typeof u === 'string' && nettoyerChaineJsonLd(u)) || (typeof c === 'string' && nettoyerChaineJsonLd(c)) || null;
  }
  return null;
}
export function imageDe(objet) {
  try { return adresseDe(propre(objet, 'image'), 0); } catch { return null; }
}
// <meta property|name="og:image" content="…"> : capturée par le balayage UNIQUE de la page (lireMetaTranche, la première), décodée, rognée (P-4).
const ogDesMetas = (metas) => { const b = metas?.get?.('og:image'); const v = typeof b === 'string' ? decoderEntites(b).trim() : ''; return v || null; };
export function imageOgDe(html) {
  return typeof html === 'string' ? ogDesMetas(balayer(html).metas) : null;
}
// D-F3 : l'image du Recipe RETENU, sinon og:image — sauf sur une page de liste (autresRecettes > 0 : l'image de partage serait celle d'une autre recette).
function imageUrlDesMetas(objet, metas, { urlFinale, hotesRefuses = [], autresRecettes = 0 } = {}) {
  try {
    const candidat = (objet ? imageDe(objet) : null) ?? (autresRecettes > 0 ? null : ogDesMetas(metas));
    if (!candidat) return null;
    let abs;
    try { abs = new URL(candidat, urlFinale); } catch { return null; }
    const v = valideAdresse(abs.href, { hotesRefuses });
    return v.ok ? v.href : null;
  } catch { return null; }
}
export function imageUrlDe(objet, html, { urlFinale, hotesRefuses = [], autresRecettes = 0 } = {}) {
  return imageUrlDesMetas(objet, typeof html === 'string' ? balayer(html).metas : new Map(), { urlFinale, hotesRefuses, autresRecettes });
}
// Le base64 d'une image (avec remplissage) : par tranches de 24 576 octets, un MULTIPLE DE 3 — une tranche multiple de 3 n'a jamais de
// remplissage, donc seul le DERNIER morceau peut finir par « = » (rév. 1 de la spec : 32 Kio plaçaient des « = » au milieu). Node et Deno.
export const TRANCHE_BASE64 = 24576;
export function versBase64(octets) {
  const morceaux = [];
  for (let i = 0; i < octets.length; i += TRANCHE_BASE64) morceaux.push(btoa(String.fromCharCode(...octets.subarray(i, i + TRANCHE_BASE64))));
  return morceaux.join('');
}
```

  (3) `lirePageHtml` (prototype l. 363-378 → l. 449-464 à `35fb29c`) : signature `export function lirePageHtml({ html, urlFinale, contentType, hotesRefuses = [] } = {})` ; après
  la boucle des `Recipe`, `const image_url = imageUrlDesMetas(objetRecette, scan.metas, { urlFinale, hotesRefuses, autresRecettes: premiere ? autres : 0 });`
  et `page` gagne `image_url` en DERNIÈRE clé dans les deux branches : `page: { ...commun, autres_recettes: autres, texte_coupe: false, image_url }` et
  `page: { ...commun, autres_recettes: 0, texte_coupe: coupe, image_url }` (`objetRecette` est l'objet brut retenu, nul sans `Recipe` lisible).

- [ ] **Step 7 : implémenter `logique.js`.** (`OUTILS` l. 7 à `35fb29c` ; A-1 : le commentaire d'en-tête de B, l. 4-5, « puis `image-web` (la valeur du
  lot F, R-B-6) : OUTILS reste à quatre, … » devient « ; `image-web` (la valeur du lot F, R-B-6) en est le cinquième (lot F, R-F-9 : OUTILS = OUTILS_0006),
  et n'atteint jamais le modèle (OUTILS_MODELE). »)

```js
export const OUTILS = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web']);
// Lot F (S-2) : la liste FERMÉE des outils qui peuvent atteindre le modèle ; image-web n'y est pas et n'y sera jamais (index.ts initialise
// corpsModele par elle, avant tout await).
export const OUTILS_MODELE = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web']);
```

  Dans `lireDemande`, le bloc `if (outil === 'lecture-web') { … }` (l. 47-52 à `35fb29c`) devient `if (outil === 'lecture-web' || outil === 'image-web') return lireDemandeUrl(corps, { hotesRefuses });`
  avec, au-dessus de `lireDemande` :

```js
// lecture-web et image-web : UNE règle (lot F) — liste blanche { url } ; tout autre champ est ignoré ; une adresse refusée l'est AVANT toute
// réservation (I-B10) : 422 interdit.
function lireDemandeUrl(corps, { hotesRefuses = [] } = {}) {
  const url = own(corps, 'url');
  if (typeof url !== 'string') return refus(400, 'forme');
  const v = valideAdresse(url, { hotesRefuses });
  return v.ok ? { ok: true, corps: { url: v.href } } : refus(422, 'interdit');
}
```

- [ ] **Step 8 : implémenter `index.ts`.** Imports : `import { LIMITES, OUTILS, OUTILS_MODELE, corpsErreur, … } from './logique.js';` et
  `import { LIMITES_IMAGE, LIMITES_LECTURE, lireCharset, lirePageHtml as lirePageHtmlJs, signatureImage, typeAdmis, typeImageAdmis, valideAdresse as valideAdresseJs, versBase64 } from './lecture-web.js';`
  (une seule ligne d'import par module : le test « trois imports » de B reste vert). Cast (l. 13) :
  `const lirePageHtml = lirePageHtmlJs as unknown as (o: { html: string; urlFinale: string; contentType: string; hotesRefuses: string[] }) => PageLue;`.
  Remplacer la FONCTION `telechargerPage` (prototype l. 86-130 → l. 98-145 à `35fb29c`) par le bloc ci-dessous. Les l. 79-85 du prototype (l. 91-97 à
  `35fb29c`) RESTENT telles quelles — le commentaire de B, `const REDIRECTIONS = [301, 302, 303, 307, 308];`, `type PageTelechargee`, `type RefusPage` : le
  bloc les emploie sans les redéclarer (les retirer donnerait une ReferenceError sur `REDIRECTIONS` dans le harnais et des erreurs `tsc`). La valeur du
  `user-agent` est celle relevée au Step 0. La déclaration porte un générique, `async function suivreRedirections<T>(` : c'est cette chaîne que cherchent
  les tests du Step 4. **EI-1 (rejeu)** : la fonction est réécrite DEPUIS `35fb29c` — la boucle extraite garde les trois formes de B absentes du prototype :
  le contrôleur du saut `ctlSaut`, le commentaire du signal déjà levé, et la garde `r.redirected` → 422 `interdit` de la vague finale de B (`ebbcf10`,
  défense en profondeur SSRF, test t13), désormais partagée par `image-web` (mutant M20 du rejeu : garde retirée → t13 rouge).

```ts
// Lot B, D-B1 / D-B26, puis lot F (R-F-6) : UNE boucle de redirections pour la page (lecture-web) et l'image (image-web). https seulement, chaque
// cible revalidée, au plus 3 sauts, 15 s par saut et 30 s en tout ; aucun cookie, aucune identité, EXACTEMENT trois en-têtes. Le corps d'un 2xx est
// lu par `lire(r)` DANS le try/finally du saut : la minuterie du saut, la minuterie globale et le relais de `signal` restent posés pendant TOUTE la
// lecture du corps (un hôte qui envoie ses en-têtes vite puis son corps au goutte-à-goutte est coupé à 15 s). Une exception pendant `lire` : abandon
// par `signal` (le budget de 120 s, ou le client parti) → relancée (504 / 499 dans traiter) ; sinon (minuterie, réseau) → inaccessible.
type Lecture<T> = { ok: T } | RefusPage;
async function suivreRedirections<T>(href: string, { signal, hotesRefuses: refuses, accept, lire }: { signal: AbortSignal; hotesRefuses: string[]; accept: string; lire: (r: Response) => Promise<Lecture<T>> }): Promise<{ valeur: T; urlFinale: string } | RefusPage> {
  const inaccessible: RefusPage = { erreur: 'inaccessible', statut: 502 };
  const total = new AbortController();
  const minuterieTotale = setTimeout(() => total.abort(), LIMITES_LECTURE.delaiTotalMs);
  let courant = href;
  try {
    for (let saut = 0; ; saut += 1) {
      const ctlSaut = new AbortController();
      const couper = () => ctlSaut.abort();
      const minuterieSaut = setTimeout(couper, LIMITES_LECTURE.delaiSautMs);
      signal.addEventListener('abort', couper, { once: true });
      total.signal.addEventListener('abort', couper, { once: true });
      if (signal.aborted || total.signal.aborted) ctlSaut.abort(); // un écouteur posé sur un signal déjà levé ne se déclenche jamais
      try {
        let r: Response;
        try {
          r = await fetch(courant, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: ctlSaut.signal, headers: { 'user-agent': 'Mitsu/0.10 (+https://neegans.github.io/mistu/)', accept, 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.5' } });
        } catch (e) { if (signal.aborted) throw e; return inaccessible; }
        // Vague finale (SSRF, défense en profondeur) : le mur des redirections (valideAdresse sur chaque cible) suppose que le runtime honore
        // redirect: 'manual'. Une réponse SUIVIE quand même (r.redirected) vient d'une adresse jamais revalidée : refusée, son corps jamais lu.
        if (r.redirected) { void r.body?.cancel().catch(() => {}); return { erreur: 'interdit', statut: 422 }; }
        if (REDIRECTIONS.includes(r.status)) {
          void r.body?.cancel().catch(() => {}); // S-9 : le corps d'une redirection n'est jamais lu
          const loc = r.headers.get('location');
          if (!loc) return inaccessible;
          let cible: string;
          try { cible = new URL(loc, courant).href; } catch { return inaccessible; }
          const v = valideAdresse(cible, { hotesRefuses: refuses });
          if (!v.ok) return { erreur: 'interdit', statut: 422 };
          if (saut + 1 > LIMITES_LECTURE.redirections) return inaccessible;
          courant = v.href;
          continue;
        }
        if (r.status < 200 || r.status > 299) { void r.body?.cancel().catch(() => {}); return inaccessible; }
        let lu: Lecture<T>;
        try { lu = await lire(r); } catch (e) { if (signal.aborted) throw e; return inaccessible; }
        if ('erreur' in lu) return lu;
        return { valeur: lu.ok, urlFinale: courant };
      } finally {
        clearTimeout(minuterieSaut);
        signal.removeEventListener('abort', couper);
        total.signal.removeEventListener('abort', couper);
      }
    }
  } finally { clearTimeout(minuterieTotale); }
}

// La page (lot B, comportement inchangé) : content-type html, corps borné à 2 Mio, décodé selon son charset.
async function telechargerPage(href: string, { signal, hotesRefuses: refuses }: { signal: AbortSignal; hotesRefuses: string[] }): Promise<PageTelechargee | RefusPage> {
  const r = await suivreRedirections<{ html: string; contentType: string }>(href, { signal, hotesRefuses: refuses, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', lire: async (rep) => {
    const type = rep.headers.get('content-type') ?? '';
    if (!typeAdmis(type)) { void rep.body?.cancel().catch(() => {}); return { erreur: 'pas_une_page', statut: 422 }; }
    const octets = await lireCorpsBorne(rep, LIMITES_LECTURE.page);
    if (octets === null) return { erreur: 'trop_lourde', statut: 413 };
    return { ok: { html: new TextDecoder(lireCharset(type, octets)).decode(octets), contentType: type } };
  } });
  if ('erreur' in r) return r;
  return { html: r.valeur.html, urlFinale: r.urlFinale, contentType: r.valeur.contentType };
}

// L'image d'une page (lot F, D-F3) : jpeg, png ou webp annoncés ET signés par leurs premiers octets, ≤ 2 Mio (R-F-4), jamais un corps vide.
type ImageTelechargee = { octets: Uint8Array; type: string; urlFinale: string };
async function telechargerImage(href: string, { signal, hotesRefuses: refuses }: { signal: AbortSignal; hotesRefuses: string[] }): Promise<ImageTelechargee | RefusPage> {
  const r = await suivreRedirections<{ octets: Uint8Array; type: string }>(href, { signal, hotesRefuses: refuses, accept: 'image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.1', lire: async (rep) => {
    const type = typeImageAdmis(rep.headers.get('content-type'));
    if (!type) { void rep.body?.cancel().catch(() => {}); return { erreur: 'pas_une_image', statut: 422 }; }
    const octets = await lireCorpsBorne(rep, LIMITES_IMAGE.octets);
    if (octets === null) return { erreur: 'image_trop_lourde', statut: 413 };
    if (octets.byteLength === 0 || signatureImage(octets) !== type) return { erreur: 'pas_une_image', statut: 422 };
    return { ok: { octets, type } };
  } });
  if ('erreur' in r) return r;
  return { octets: r.valeur.octets, type: r.valeur.type, urlFinale: r.urlFinale };
}
```

  Dans `traiter` (l. 210 à `35fb29c`) : `let corpsModele: unknown = OUTILS_MODELE.includes(outil) ? lu.corps : null; // lot F (S-2) : image-web n'atteint JAMAIS le modèle`
  (à la place de `= lu.corps`, avant le `try`) ; dans le bloc `lecture-web` (l. 212-227), l'appel (l. 217) devient
  `lirePageHtml({ html: telechargee.html, urlFinale: telechargee.urlFinale, contentType: telechargee.contentType, hotesRefuses: refuses })` ; juste
  APRÈS ce bloc et AVANT `if (corpsModele !== null)` :

```ts
    if (outil === 'image-web') {
      // Lot F (§ 6.3) : la réservation est faite (le quota compte cet appel) ; l'image est téléchargée par la boucle partagée, relayée en base64.
      const image = await telechargerImage((lu.corps as { url: string }).url, { signal: ctl.signal, hotesRefuses: refuses });
      if ('erreur' in image) { statut = image.statut; corpsReponse = JSON.stringify(corpsErreur(image.erreur)); }
      else { statut = 200; usage = null; corpsReponse = JSON.stringify({ type: image.type, taille: image.octets.byteLength, url_finale: image.urlFinale, octets: versBase64(image.octets) }); }
    }
```

  Rien d'autre ne change dans `traiter` (le 499, la mise à jour unique du journal, le `try/catch` global de `Deno.serve`).

- [ ] **Step 9 : vert.** `node --test tools/*.test.mjs` : tout vert, compte relevé (départ + 8 + 4 + 15 + 2 ; mesuré au rejeu : **203/203**, 174 au départ) ;
  `node tools/generer-migrations.mjs --check` : 0 ; `tsc` : 0 ; suite navigateur inchangée (même bilan qu'au Step 0, épingle inchangée ; mesuré :
  `✅ 5681/5681`, épingle 5680) ; SHELL/VERSION : inchangés (aucun fichier de `src/` touché : `APP_VERSION` et `sw.js` changent à la tâche 2).
- [ ] **Step 10 : mutants de la tâche** (P-22 : **jamais une mutation dans le worktree**. Copier l'arbre ENTIER, travail non commis compris :
  `rsync -a --exclude .git --exclude .superpowers /Users/neeganmac/projects/mistu-plats-en-images/ <scratchpad>/mut-F-T1/base/` ; pour chaque mutant, une copie
  de `base/` (`rsync -a --delete <scratchpad>/mut-F-T1/base/ <scratchpad>/mut-F-T1/m<N>/`), la mutation écrite dans `m<N>/` par un script qui refuse
  tout chemin hors du scratchpad, puis `node --test tools/*.test.mjs` lancé DEPUIS `m<N>/` — les harnais y lisent la copie de `logique.js`,
  `lecture-web.js` et `index.ts` par leurs chemins relatifs. Chacun doit rougir ; le test qui le tue est nommé ; la sortie lue est consignée dans
  le rapport) : `image/gif` ajouté à `LIMITES_IMAGE.types` · `octets` remis à 5 Mio (`LIMITES_IMAGE`) · `typeImageAdmis` admet `image/svg+xml` ·
  WebP admis sur `RIFF` seul · contrôle de signature retiré de `telechargerImage` · `imageUrlDe` sans `valideAdresse` · sans résolution (`new URL(candidat)`
  sans base) · sans la garde `autresRecettes` · image lue sur le premier `Recipe` trouvé · `TRANCHE_BASE64 = 32768` · `lire` appelé APRÈS le `finally` du
  saut · minuterie du saut retirée à la réception des en-têtes · `referer` ajouté aux en-têtes · `corpsModele` laissé à `lu.corps` pour tout outil ·
  `OUTILS` sans `'image-web'` · `image-web` sans `valideAdresse` dans `lireDemande` · `telechargerImage` avec sa propre boucle sans revalidation (u10) ·
  un second `await fetch(` dans `telechargerImage` (« index.ts (lot F) », le compte de `await fetch(`) · `propre` remplacé par un accès direct dans
  `adresseDe` (« imageDe : formes », S-11).
  Rejoués au rejeu (copie ENTIÈRE de l'état de la tâche 1, resynchronisée avant chaque mutant ; `node --test --test-timeout=10000` depuis la copie) :
  les **19 rougissent**, chacun par au moins un test nommé (relevé dans `depart-rejeu-rapport.md`) ; un 20e, hors liste, « garde `r.redirected` retirée de
  `suivreRedirections` » (EI-1), rougit t13.
- [ ] **Step 11 : invisibles** (script Python des contraintes) sur les SEPT fichiers touchés (trois du serveur, quatre tests Node) : 0 (mesuré au rejeu).
- [ ] **Step 12 : commit** `Serveur image-web : image de la page, une seule boucle de redirections sous minuteries, base64 par tranches de 3 (lot F, tache 1)`.

---

### Task 2 : Schéma et domaine client — origine de la photo, adresse d'image, `lireImageWeb`, mur distant, lecture web amendée

Spec § 9 tâche 2 ; § 3.1, § 3.3, § 3.4, § 4.3 point 2 (fabrication), § 4.4, § 4.6 ; tests § 7.4 (vocabulaire et D-F19, domaine, mur distant, `lirePage`,
fabrication, passerelle) et le chaînage serveur → client de § 7.1. Première tâche qui touche `src/` : `APP_VERSION 0.15.0`, pins, `sw.js` `-1`.

**Files:**
- Modify: `src/model/schema.js` (l. 6 `APP_VERSION '0.15.0'` ; après `VERIFICATION`, l. 149 — `SOURCE_KINDS` de B, l. 147-148, sépare `AVAILABILITY`, l. 146,
  de `VERIFICATION` — : `PHOTO_ORIGINS`, `HASH`)
- Modify: `src/domain/vocabulaire.js` (l. 5 import — il porte déjà `SOURCE_KINDS` (B) et `SORTES_IMPORT` (D) — ; l. 22-26 : `recipes.photo_origin` après
  `source_kind` (l. 25) ; fin : `originePhotoAdmise`)
- Modify: `src/domain/import-cible.js` (l. 7 import ; l. 116 à `bd03e48` → l. 130 à `35fb29c` : `originePhotoAdmise(reference.photo_origin)` ;
  `ORIGINES_PHOTO`, l. 91 à `bd03e48` → l. 102 à `35fb29c`, intouchée)
- Modify: `src/core/image.js` (après `preparerPhotoLocale`, l. 83-90 à `35fb29c` : `COTE_MIN_DISTANT`, `preparerPhotoDistante`)
- Create: `src/domain/photo-web.js` (≈ 75 lignes), `src/domain/base64.js` (≈ 20 lignes, sans import)
- Modify: `src/domain/passerelle.js` (`RAISON_DE_ERREUR`, l. 24-25 ; `echecDomaine`, l. 121 — numéros égaux au prototype B)
- Modify: `src/domain/lecture-web.js` (lot B ; l. 7-17 imports, l. 34-54 `lirePage` — la clé l. 47 —, l. 194-228 `fabriquerLectureWeb` à `35fb29c`)
- Modify: `sw.js` (`VERSION = 'cuisine-os-v0.15.0-1'` ; `SHELL` + `'./src/domain/base64.js'`, `'./src/domain/photo-web.js'`, rangés dans la ligne des modules
  `./src/domain/…` par ordre alphabétique : après `backup.js`, après `passerelle.js`)
- Create: `tests/photo-plat.js` (`export async function runPhotoPlatTests({ eq, ok })`) ; Modify: `tests/tests.js` (import après la l. 33 ; appel juste
  avant le bloc du thème, l. 236-238, donc après celui du lot D, l. 232-234 — le bloc du lot E est l. 217-219, A-8 — ; épingle l. 245)
- Modify: `tests/import-cible.js` (bloc neuf après `await run('vocabulaire', …)`, l. 260-288 à `35fb29c`), `tests/passerelle.js` (bloc neuf avant la fin
  de `runPasserelleTests`, l. 769), `tests/lecture-web.js` (B : formes exactes de `lirePage` amendées, l. 45, 47 et 151 ; deux blocs neufs avant la fin du
  `try` de `runLectureWebTests`, l. 1157)
- Modify: les pins de version (relevé Python des contraintes sur `35fb29c` : QUINZE lignes, listées au Step 7 ; `0.14.0` → `0.15.0`, `v0\.14\.0` → `v0\.15\.0`)
- Modify: `tools/assistant-lecture-web.test.mjs` (fin : chaînage serveur → client)

**Interfaces:**
- Consumes : `COVER_INPUT_MIME` (`src/sync/mime.js`) ; `lienSignet` (`src/core/lien.js`) ; `appelerAssistant(outil, corps, { fetch, session, config, signal,
  tentativeMs, corpsMax })`, `echecDomaine({ raison, quota, ecrite })`, `LIMITES_PASSERELLE`, `urlAssistant` (`src/domain/passerelle.js`) ;
  `LIMITES_COUVERTURE`, `dimensionsImage`, `reduireImage`, `ErreurImage`, `preparerPhotoLocale` (`src/core/image.js`) ; `lirePage`,
  `fabriquerLectureWeb`, `relireResultat` (`src/domain/lecture-web.js`, B) ; `versBase64`, `TRANCHE_BASE64` (tâche 1).
- Produces :

```js
// src/model/schema.js
export const PHOTO_ORIGINS = Object.freeze(['photo', 'image', 'web']);
export const HASH = /^[0-9a-f]{64}$/;
// src/domain/vocabulaire.js
export const originePhotoAdmise = (v) => (PHOTO_ORIGINS.includes(v) ? v : null);
// src/core/image.js
export const COTE_MIN_DISTANT = 200;
export async function preparerPhotoDistante(blob, { coteMin = COTE_MIN_DISTANT } = {})   // → Blob JPEG ; lève ErreurImage('indecodable' | 'trop_lourde' | 'type' | 'trop_petite' | 'trop_grande')
// src/domain/base64.js
export function lireOctetsBase64(texte, taille)       // → Uint8Array | null ; ne lève jamais
// src/domain/photo-web.js
export const LIMITES_IMAGE_WEB = Object.freeze({ url: 2048, octets: 2097152, corpsReponse: 3145728, tentativeMs: 90000, types: COVER_INPUT_MIME });
export const RAISONS_PHOTO_WEB = Object.freeze([...29 raisons de la spec § 3.4]);
export const RAISONS_DEFINITIVES = Object.freeze(['interdit', 'pas_une_image', 'image_trop_lourde', 'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde']);
export function adresseImageAdmise(valeur)            // → href | null
export function memeAdresseImage(a, b)                // → booléen
export function candidatPhotoWeb(fiche, imageUrl)     // → href | null (D-F10)
export async function lireImageWeb({ url, session } = {}, { fetch, signal, tentativeMs = 90000, config } = {})
  // → { etat: 'recue', blob, urlFinale } | { etat: 'echec', raison, extra } ; ne lève jamais
// src/domain/lecture-web.js (B, amendé)
lirePage(corps).page.image_url                        // adresseImageAdmise(propre(p, 'image_url')), DERNIÈRE clé de page
fabriquerLectureWeb(recette, { …B…, photoAnnoncee = null })  // → { recipe, version, remplacement, photoWeb }
```

- [ ] **Step 0 : relire le code réel** de B à la tête du lot E : `src/domain/lecture-web.js` (`lirePage`, `fabriquerLectureWeb` : signature, retour,
  appel d'`assertVocabulaire` sur la branche `remplacer === false`), `src/domain/passerelle.js` (`RAISON_DE_ERREUR`, liste relayée par
  `echecDomaine`), `tests/lecture-web.js` (structure : `run(name, test)`, `lire`, blocs ; chaque `eq` qui épingle la forme EXACTE de `page` rendue
  par `lirePage` — au prototype : l. 33 et l. 35 ; tout autre `eq` qui compare un `resultat.page` complet). Relever les pins (script des
  contraintes). Relever le nom de la fonction du lot E appelée dans `tests/tests.js` (au plus près avant `runThemeTests`). **Lignes (R-F-11)** :
  les numéros cités par cette tâche — prototype B (`rejeu2` : `lirePage` l. 28-48, `fabriquerLectureWeb` l. 175-206, `RAISON_DE_ERREUR` l. 24-25,
  `echecDomaine` l. 121, `tests/lecture-web.js` l. 33 et 35), `bd03e48` et `4cb99a0` — sont relus sur la tête du lot E ; tout écart est un
  amendement nommé, pas un constat (R-C-7).
  **Relevé du rejeu (`35fb29c`)** : `lirePage` l. 34-54 (la dernière clé de `page`, `texte_coupe`, l. 47) ; `fabriquerLectureWeb` l. 194-228, dont le corps
  RÉEL diffère du prototype (vocabulaire de `source_kind` vérifié en tête, `incertains`, `lu_le`, branche `remplacer === false` qui rend une COPIE
  `intact` après `assertVocabulaire(intact, 'recipes')`) : c'est lui qui est gardé (A-6) ; `RAISON_DE_ERREUR` l. 24-25, `echecDomaine` l. 121 ;
  `tests/lecture-web.js` : formes exactes l. 45 et 47, et un `eq` qui compare un `resultat.page` complet, l. 151 (« lireRecetteWeb : le succès porte la page
  RELUE… » : `PAGE` y est l'entrée ET l'attendu, A-5) ; fonction du lot E dans `tests/tests.js` : `runCouvertureTests` (l. 217-219) — la plus proche avant
  `runThemeTests` est `runClassementTests` (lot D, l. 232-234) : l'appel du lot F se pose entre elle et le thème (A-8). Pins : quinze lignes (Step 7).

- [ ] **Step 1 : tests rouges — `tests/photo-plat.js` (neuf, squelette et blocs du domaine).**

```js
// Tests du lot F « Les plats en images » (spec docs/superpowers/specs/2026-10-19-plats-en-images-design.md, § 7.4). Bases jetables (withRepo,
// withDatabase), fetch factice, gestes injectés ; aucun réseau ; aucune écriture dans la bibliothèque de la personne ; jamais le navigateur partagé.
// Images fabriquées par canvas (imageTest, recopié ici : celui de tests/import-cible.js est local à un bloc et ne fait que du JPEG). Un caractère
// hostile est construit par String.fromCodePoint, jamais écrit en littéral. Les tâches 3 à 5 ajoutent leurs blocs AU-DESSUS du repère de fin.
import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';

export async function runPhotoPlatTests({ eq, ok }) {
  const run = async (name, test) => {
    try { await test(); }
    catch (error) { ok(false, `Photo du plat — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
  };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
  const { sha256Hex } = await import('../src/core/hash.js');
  const { INGREDIENTS } = await import('../src/model/seed.js');
  const ING = new Map(INGREDIENTS.map((i) => [i.id, i]));
  const localeAvant = getUiLocale();
  setUiLocale('fr'); // des textes français sont affirmés
  const DATE = '2026-10-19T00:00:00.000Z';
  const H = (c) => c.repeat(64); // une empreinte lisible : H('a') = « aaaa… » (64)
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
  const bouton = (racine, texte) => [...(racine?.querySelectorAll('button') || [])].find((b) => b.textContent === texte) || null;
  const etiquettes = (racine) => [...racine.querySelectorAll('button')].map((b) => b.textContent);
  const textesDirects = (p) => [...p.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent);
  // Une image de test : un aplat et un coin clair (le ré-encodage a quelque chose à garder) ; JPEG ou PNG ; un File, comme un sélecteur de fichiers.
  const imageTest = async (nom, couleur, l, h, type = 'image/jpeg') => {
    const toile = new OffscreenCanvas(l, h); const cx = toile.getContext('2d');
    cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); cx.fillStyle = '#fff'; cx.fillRect(0, 0, Math.max(1, l >> 2), Math.max(1, h >> 2));
    const blob = await toile.convertToBlob(type === 'image/png' ? { type } : { type, quality: 0.9 });
    return new File([blob], nom, { type });
  };
  const octetsDe = async (blob) => new Uint8Array(await blob.arrayBuffer());
  // Le base64 que la fonction rend (un seul btoa sur la chaîne binaire entière : jamais par tranches non multiples de 3).
  const base64De = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
  const fiche = (id, over = {}) => ({ id, edition_id: null, original_title: 'Pâtes ' + id, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE, ...over });
  const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: null,
    ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }],
    constraints: {}, changes: '', notes: '', provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: null, convention_snapshot: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
  // Le contexte d'une fiche (motif de tests/import-cible.js, tâche 5 du lot A), relu de la base jetable ; `over` complète (sync, pagesById…).
  const ctxPour = async (repo, db, over = {}) => {
    const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
    return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])),
      editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(), imports: await db.getAll('imports'), dishesById: new Map(), dishes: [], cook_history: [],
      dish_recipe_links: [], recipe_translations: [], ingredients: INGREDIENTS, ingredientsById: ING, source_documents: [], source_pages: [], scan_sessions: [], rediscovery_prefs: [], docsByRecipe: new Map(),
      meals: [], meal_feedback: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, sync: {}, ...over };
  };
  const nouvelleScene = () => { const s = document.createElement('div'); s.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(s); return s; };
  try {
    // ===== Tâche 2 — le domaine client (spec § 3.4)
    await run('LIMITES_IMAGE_WEB (R-F-4, D-F13)', async () => {
      const W = await import('../src/domain/photo-web.js');
      const { LIMITES_COUVERTURE } = await import('../src/core/image.js');
      const { COVER_INPUT_MIME } = await import('../src/sync/mime.js');
      const { LIMITES_PASSERELLE } = await import('../src/domain/passerelle.js');
      ok(Object.isFrozen(W.LIMITES_IMAGE_WEB), 'LIMITES_IMAGE_WEB : gelée');
      eq([W.LIMITES_IMAGE_WEB.url, W.LIMITES_IMAGE_WEB.octets, W.LIMITES_IMAGE_WEB.corpsReponse, W.LIMITES_IMAGE_WEB.tentativeMs, W.LIMITES_IMAGE_WEB.types === COVER_INPUT_MIME],
        [2048, 2097152, 3 * 1024 * 1024, 90000, true], 'LIMITES_IMAGE_WEB : 2 048 points, 2 Mio (le littéral du serveur), réponse ≤ 3 Mio, 90 s, les types des couvertures');
      ok(W.LIMITES_IMAGE_WEB.octets <= LIMITES_COUVERTURE.octetsDistants, 'LIMITES_IMAGE_WEB.octets ≤ le mur commun des images distantes (5 Mio)');
      ok(W.LIMITES_IMAGE_WEB.corpsReponse >= 4 * Math.ceil(W.LIMITES_IMAGE_WEB.octets / 3) + 4096, 'corpsReponse ≥ le base64 d’une image à la borne + 4 Kio d’enveloppe');
      ok(W.LIMITES_IMAGE_WEB.tentativeMs < LIMITES_PASSERELLE.tentativeMs, '90 s restent sous le délai par défaut de la passerelle (135 s)');
    });

    await run('adresseImageAdmise, memeAdresseImage (I-F2, S-10)', async () => {
      const W = await import('../src/domain/photo-web.js');
      const A = W.adresseImageAdmise;
      eq([A('https://a.test/i.jpg'), A('https://u:p@a.test/i.jpg')], ['https://a.test/i.jpg', 'https://a.test/i.jpg'], 'adresseImageAdmise : https admise ; identifiants retirés (lienSignet, D-T7)');
      eq([A('http://a.test/i.jpg'), A('https://a.test/ i.jpg'), A('https://café.test/i.jpg'), A('https://a.test/i' + String.fromCodePoint(0x2028) + '.jpg'), A('https://a.test/' + 'x'.repeat(2049 - 15)),
        A('javascript:x'), A(''), A(null), A(7), A({})], [null, null, null, null, null, null, null, null, null, null],
        'adresseImageAdmise : http, espace, non ASCII, U+2028, 2 049 points, javascript:, vide, null, nombre, objet → null');
      const longue = 'https://a.test/' + '"'.repeat(10) + 'x'.repeat(2040 - 15 - 10);
      eq([longue.length, new URL(longue).href.length > 2048, A(longue)], [2040, true, null], 'adresseImageAdmise : un href ASCII de 2 040 points dont dix « " » (encodés %22) dépasse 2 048 APRÈS normalisation → null');
      eq([W.memeAdresseImage('HTTPS://A.TEST:443/i.jpg', 'https://a.test/i.jpg'), W.memeAdresseImage('https://a.test/1.jpg', 'https://a.test/2.jpg'), W.memeAdresseImage('http://a.test/i.jpg', 'http://a.test/i.jpg'), W.memeAdresseImage(null, null)],
        [true, false, false, false], 'memeAdresseImage : la même adresse sous une autre forme → vrai ; deux adresses → faux ; refusée des deux côtés → faux');
    });

    await run('candidatPhotoWeb (D-F10)', async () => {
      const W = await import('../src/domain/photo-web.js');
      const C = W.candidatPhotoWeb; const IMG = 'https://a.test/i.jpg';
      eq([C({}, IMG), C({ photo_sha256: H('a'), photo_origin: 'image' }, IMG), C({ photo_sha256: H('a'), photo_origin: 'photo' }, IMG), C({ photo_sha256: H('a'), photo_origin: null }, IMG),
        C({ photo_sha256: H('a'), photo_origin: 'web', photo_source_url: IMG }, IMG), C({ photo_sha256: H('a'), photo_origin: 'web', photo_source_url: 'HTTPS://A.TEST:443/i.jpg' }, IMG),
        C({ photo_sha256: H('a'), photo_origin: 'web', photo_source_url: 'https://a.test/ancienne.jpg' }, IMG), C({ photo_sha256: '../x', photo_origin: 'image' }, IMG), C({}, 'http://a.test/i.jpg'), C(null, IMG)],
      [IMG, null, null, null, null, null, IMG, IMG, null, IMG],
      'candidatPhotoWeb : sans photo → l’adresse ; photo de la personne (image, photo, origine nulle) → null ; même image web (même sous une autre forme) → null ; autre image web → l’adresse ; pointeur hostile = sans photo ; http → null');
    });

    await run('lireImageWeb : l’appel (I-F3, D-F13)', async () => {
      const W = await import('../src/domain/photo-web.js');
      const P = await import('../src/domain/passerelle.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const SESSION = { access_token: 'jeton-photo-sentinelle', user: { id: 'u1' } };
      const resultats = [];
      const BORNE = W.LIMITES_IMAGE_WEB.octets;
      const grosse = new Uint8Array(BORNE); grosse.set([0xff, 0xd8, 0xff]);
      const corps200 = (u8, type = 'image/jpeg') => ({ type, taille: u8.length, url_finale: 'https://cdn.test/i.jpg', octets: base64De(u8) });
      const appels = [];
      const f = (statut, corps) => async (url, options) => { appels.push({ url, options }); return reponse(statut, corps); };
      const delais = []; const vraiTimeout = AbortSignal.timeout;
      AbortSignal.timeout = (ms) => { delais.push(ms); return vraiTimeout.call(AbortSignal, ms); };
      let r;
      try { r = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: f(200, corps200(grosse)), config: SUPABASE.prod }); }
      finally { AbortSignal.timeout = vraiTimeout; }
      resultats.push(r);
      const a = appels[0];
      eq([appels.length, a.url, JSON.parse(a.options.body), Object.keys(a.options.headers).sort(), a.options.redirect, a.options.credentials],
        [1, P.urlAssistant(SUPABASE.prod), { outil: 'image-web', corps: { url: 'https://a.test/i.jpg' } }, ['apikey', 'authorization', 'content-type'], 'error', 'omit'],
        'lireImageWeb : UN POST { outil: image-web, corps: { url } } exact vers la fonction assistant, trois en-têtes, redirect error, credentials omit');
      ok(JSON.stringify(corps200(grosse)).length > P.LIMITES_PASSERELLE.corps, 'fixture : la réponse d’une image à la borne dépasse les 2 Mio par défaut de la passerelle (le mutant « corpsMax omis » la refuse)');
      eq([r.etat, r.blob?.type, r.blob?.size, r.urlFinale], ['recue', 'image/jpeg', BORNE, 'https://cdn.test/i.jpg'], 'lireImageWeb : une image à la borne (≈ 2,7 Mio de JSON) est LUE');
      eq(delais.includes(90000), true, 'lireImageWeb : tentativeMs passé à la passerelle = 90 000');
      appels.length = 0;
      const sansSession = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: null }, { fetch: f(200, corps200(grosse)), config: SUPABASE.prod });
      const enHttp = await W.lireImageWeb({ url: 'http://a.test/i.jpg', session: SESSION }, { fetch: f(200, corps200(grosse)), config: SUPABASE.prod });
      const ctl = new AbortController(); ctl.abort();
      const annule = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: f(200, corps200(grosse)), config: SUPABASE.prod, signal: ctl.signal });
      resultats.push(sansSession, enHttp, annule);
      eq([sansSession.raison, enHttp.raison, annule.raison, appels.length], ['non_connecte', 'adresse', 'annule', 0], 'lireImageWeb : sans session → non_connecte ; http → adresse ; signal levé → annule ; zéro fetch');
      eq(resultats.some((x) => JSON.stringify(x ?? null).includes('jeton-photo-sentinelle')), false, 'lireImageWeb : le jeton n’est dans aucun résultat');
    });

    await run('lireImageWeb : le 200 est une donnée hostile', async () => {
      const W = await import('../src/domain/photo-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const SESSION = { access_token: 'jeton-photo-sentinelle', user: { id: 'u1' } };
      const petit = Uint8Array.of(0xff, 0xd8, 0xff, 1, 2);
      const corps200 = (over = {}) => ({ type: 'image/jpeg', taille: petit.length, url_finale: 'https://cdn.test/i.jpg', octets: base64De(petit), ...over });
      const lu = async (corps) => W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: async () => reponse(200, corps), config: SUPABASE.prod });
      const resultats = [];
      const garde = (r) => { resultats.push(r); return r; };
      eq([(garde(await lu(corps200({ type: 'image/gif' })))).raison, (garde(await lu(corps200({ taille: 0 })))).raison], ['illisible', 'illisible'], '200 hostile : type hors liste → illisible ; taille 0 → illisible');
      // La borne AVANT tout décodage : un base64 de la BONNE longueur pour 2 097 153 octets — un mutant « décoder puis borner » appellerait atob.
      const TROP = W.LIMITES_IMAGE_WEB.octets + 1;
      const vraiAtob = globalThis.atob; let atobs = 0;
      globalThis.atob = (s) => { atobs += 1; return vraiAtob(s); };
      try { eq([(garde(await lu(corps200({ taille: TROP, octets: 'A'.repeat(4 * Math.ceil(TROP / 3)) })))).raison, atobs], ['image_trop_lourde', 0], '200 hostile : taille 2 097 153 (base64 de la bonne longueur) → image_trop_lourde AVANT tout décodage (atob jamais appelé)'); }
      finally { globalThis.atob = vraiAtob; }
      eq([(garde(await lu(corps200({ octets: '@@' })))).raison, (garde(await lu(corps200({ octets: base64De(petit) + 'AAAA' })))).raison, (garde(await lu(corps200({ taille: 4 })))).raison, (garde(await lu(corps200({ octets: 'AAA AAAA' })))).raison],
        ['illisible', 'illisible', 'illisible', 'illisible'], '200 hostile : alphabet hors base64, longueur ≠ 4 × ceil(taille / 3), décodé de longueur ≠ taille, une espace à la bonne longueur (atob l’ignorerait : seule la règle ALPHABET la refuse) → illisible');
      // S-11 sans polluer aucun prototype (R-F-8 : la suite tourne des cas en parallèle et un appel asynchrone y lit des objets nus) : le corps passe
      // par la configuration de test déjà prévue pour lireImageWeb (P-3 : config, fetch factice, JSON relu par la passerelle) ; un champ absent du
      // corps est absent pour lu(k). Mutants tués : « type par défaut quand le champ propre manque » (lu('type') ?? 'image/jpeg' : le corps sans type
      // passerait) et « Blob au type figé » (new Blob([octets], { type: 'image/jpeg' }) : la PNG sortirait typée jpeg).
      const tetePng = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
      const sansType = garde(await lu({ taille: petit.length, url_finale: 'https://cdn.test/i.jpg', octets: base64De(petit) }));
      const enPng = garde(await lu({ type: 'image/png', taille: tetePng.length, url_finale: 'https://cdn.test/i.png', octets: base64De(tetePng) }));
      eq([sansType.raison, (garde(await lu({ type: 'image/jpeg', taille: 5 }))).raison, enPng.etat, enPng.blob?.type, enPng.blob?.size],
        ['illisible', 'illisible', 'recue', 'image/png', tetePng.length], '200 hostile : sans champ propre type → illisible ; octets absents → illisible ; une PNG annoncée image/png → un Blob construit avec SON type explicite (jamais un type figé)');
      const bon = garde(await lu(corps200()));
      eq([bon.etat, bon.blob.type, [...(await octetsDe(bon.blob))]], ['recue', 'image/jpeg', [...petit]], '200 valide → { etat: recue, blob } du bon type et des bons octets');
      eq(resultats.some((x) => JSON.stringify(x).includes('jeton-photo-sentinelle')), false, 'le jeton n’est dans aucun résultat');
    });

    await run('table serveur → client, raisons fermées', async () => {
      const W = await import('../src/domain/photo-web.js');
      const { SUPABASE } = await import('../src/sync/config.js');
      const SESSION = { access_token: 'jeton-photo-sentinelle', user: { id: 'u1' } };
      const table = [[422, { erreur: 'pas_une_image' }, 'pas_une_image', {}], [413, { erreur: 'image_trop_lourde' }, 'image_trop_lourde', {}], [422, { erreur: 'interdit' }, 'interdit', {}],
        [502, { erreur: 'inaccessible' }, 'inaccessible', {}], [429, { erreur: 'quota', quota: 60 }, 'quota', { quota: 60 }], [429, { type: 'error' }, 'trop_de_demandes', {}], [504, { erreur: 'delai' }, 'delai', {}]];
      const obtenus = [];
      for (const [statut, corps] of table) { const x = await W.lireImageWeb({ url: 'https://a.test/i.jpg', session: SESSION }, { fetch: async () => reponse(statut, corps), config: SUPABASE.prod }); obtenus.push([x.etat, x.raison, x.extra]); }
      eq(obtenus, table.map(([, , raison, extra]) => ['echec', raison, extra]), 'table serveur → client : pas_une_image, image_trop_lourde, interdit, inaccessible relayées ; quota 60 ; 429 sans champ → trop_de_demandes ; 504 → delai');
      ok(obtenus.every(([, raison]) => W.RAISONS_PHOTO_WEB.includes(raison)), 'toute raison rendue ∈ RAISONS_PHOTO_WEB');
      ok(Object.isFrozen(W.RAISONS_PHOTO_WEB) && Object.isFrozen(W.RAISONS_DEFINITIVES) && W.RAISONS_DEFINITIVES.every((r) => W.RAISONS_PHOTO_WEB.includes(r)), 'RAISONS_DEFINITIVES ⊂ RAISONS_PHOTO_WEB, les deux gelées');
      eq([...W.RAISONS_DEFINITIVES], ['interdit', 'pas_une_image', 'image_trop_lourde', 'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde'], 'RAISONS_DEFINITIVES : la liste de la spec');
    });

    await run('mur distant : preparerPhotoDistante (D-F12)', async () => {
      const IM = await import('../src/core/image.js');
      const code = async (p) => { try { await p; return 'ok'; } catch (e) { return e?.code ?? 'autre:' + (e?.message || ''); } };
      eq(IM.COTE_MIN_DISTANT, 200, 'COTE_MIN_DISTANT = 200');
      const sortie = await IM.preparerPhotoDistante(await imageTest('a.jpg', '#a52', 600, 400, 'image/jpeg'));
      const dims = await IM.dimensionsImage(sortie);
      eq([sortie.type, dims.largeur, dims.hauteur], ['image/jpeg', 600, 400], 'un JPEG 600 × 400 → un JPEG ≤ 1 200 px');
      const png = await imageTest('p.png', '#5a2', 300, 300, 'image/png');
      eq(await code(IM.preparerPhotoDistante(new Blob([png], { type: 'image/jpeg' }))), 'indecodable', 'octets PNG annoncés image/jpeg → indecodable (l’en-tête dit un autre type)');
      eq(await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(10)], { type: 'image/heic' }))), 'type', 'image/heic → type (jamais HEIC pour une image distante)');
      eq(await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }))), 'trop_lourde', '5 Mio + 1 → trop_lourde (le mur commun octetsDistants)');
      eq([await code(IM.preparerPhotoDistante(await imageTest('e.jpg', '#a52', 199, 600))), await code(IM.preparerPhotoDistante(await imageTest('f.jpg', '#a52', 200, 600)))], ['trop_petite', 'ok'], 'petit côté 199 → trop_petite ; 200 → accepté');
      const tete = new Uint8Array(33); tete.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const dv = new DataView(tete.buffer); dv.setUint32(16, 5000); dv.setUint32(20, 4000);
      const vrai = globalThis.createImageBitmap; let decodes = 0;
      globalThis.createImageBitmap = (...a) => { decodes += 1; return vrai.call(globalThis, ...a); };
      try {
        eq([await code(IM.preparerPhotoDistante(new Blob([tete], { type: 'image/png' }))), decodes], ['trop_grande', 0], 'en-tête 5 000 × 4 000 → trop_grande AVANT décodage (createImageBitmap jamais appelé)');
        eq([await code(IM.preparerPhotoDistante(new Blob([new Uint8Array(10)], { type: 'image/jpeg' }))), decodes], ['indecodable', 0], '10 octets nuls annoncés image/jpeg → indecodable, sans décodage');
        const heic = new Blob([new Uint8Array(64).fill(7)], { type: 'image/heic' });
        eq([await code(IM.preparerPhotoLocale(heic)), decodes > 0], ['indecodable', true], 'preparerPhotoLocale inchangée : un image/heic d’en-tête illisible passe au ré-encodage (createImageBitmap appelé), qui tranche');
      } finally { globalThis.createImageBitmap = vrai; }
    });

    // ===== fin des blocs du lot F (les tâches 3 à 5 ajoutent les leurs AU-DESSUS de cette ligne)
  } finally { setUiLocale(localeAvant); }
}
```

  `tests/tests.js` : `import { runPhotoPlatTests } from './photo-plat.js';` (après les imports existants) et, juste avant le bloc du thème :

```js
// --- Les plats en images (lot F) : photo du plat, rapatriement par la fonction, cartes illustrées.
try { await runPhotoPlatTests({ eq, ok }); }
catch (error) { ok(false, `Suite photo du plat interrompue : ${error?.message || String(error)}`); }
```

- [ ] **Step 2 : tests rouges — `tests/import-cible.js`** (bloc neuf juste après `await run('vocabulaire', …)`, l. 260-288 à `35fb29c` ; `run`, `eq`, `ok` du fichier) :

```js
  await run('vocabulaire (lot F) : PHOTO_ORIGINS, HASH, originePhotoAdmise, fabriquerExtraction (D-F1, D-F19)', async () => {
    const S = await import('../src/model/schema.js');
    const V = await import('../src/domain/vocabulaire.js');
    const D = await import('../src/domain/import-cible.js');
    eq([[...S.PHOTO_ORIGINS], Object.isFrozen(S.PHOTO_ORIGINS)], [['photo', 'image', 'web'], true], 'PHOTO_ORIGINS gelée = photo, image, web');
    eq([S.HASH instanceof RegExp, String(S.HASH), S.HASH.test('a'.repeat(64)), S.HASH.test('A'.repeat(64)), S.HASH.test('a'.repeat(63)), S.HASH.test('g'.repeat(64))],
      [true, '/^[0-9a-f]{64}$/', true, false, false, false], 'HASH exporté par schema.js = /^[0-9a-f]{64}$/');
    let e = null; try { V.assertVocabulaire({ photo_origin: 'appareil' }, 'recipes'); } catch (x) { e = x; }
    eq([e?.name, e?.magasin, e?.champ, e?.valeur], ['ErreurVocabulaire', 'recipes', 'photo_origin', 'appareil'], 'recipes.photo_origin « appareil » → ErreurVocabulaire (magasin, champ, valeur)');
    eq([V.assertVocabulaire({ photo_origin: null }, 'recipes'), V.assertVocabulaire({}, 'recipes'), V.assertVocabulaire({ photo_origin: 'web' }, 'recipes')], [true, true, true], 'null et absent tolérés ; web admis');
    eq(['photo', 'image', 'web', 'appareil', '', 7, null, '__proto__', 'constructor'].map((v) => V.originePhotoAdmise(v)), ['photo', 'image', 'web', null, null, null, null, null, null], 'originePhotoAdmise : les trois origines → elles-mêmes ; tout le reste → null');
    eq(S.RELATIONS.filter(([, champ]) => /photo_(sha256|source_url)/.test(champ)), [], 'RELATIONS : aucune relation sur photo_sha256 ni photo_source_url (pointeurs souples)');
    eq(S.DB_VERSION, 4, 'DB_VERSION 4 inchangée');
    const reference = { id: 'rc_f', edition_id: 'ed1', original_title: 'Tarte', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, source_page_ids: [], current_version_id: null, tags: [], cuisines: [], favorite: false, ingredient_ids: [] };
    const resultat = { title: 'Tarte', servings: 4, prep_minutes: null, cook_minutes: null, ingredients: [{ source_text: '1 pomme', uncertain: false }], steps: [{ text: 'Cuire.' }], printed_page: null, sub_recipes: [], uncertain_fields: [], notes: null, incomplete: false, missing_page: false };
    const opts = { reference, versions: [], pages: [], pageIds: [], edition: null, importId: 'imp_f', modele: 'claude-x', maintenant: '2026-10-19T00:00:00.000Z' };
    eq(D.fabriquerExtraction(resultat, { ...opts, photo: { sha256: 'a'.repeat(64), origin: 'web' } }).recipe.photo_origin, null, 'fabriquerExtraction avec photo { origin: web } → photo_origin null (l’écran ciblé n’admet que photo | image)');
    let e2 = null; let f2 = null;
    try { f2 = D.fabriquerExtraction(resultat, { ...opts, reference: { ...reference, photo_origin: 'appareil' }, photo: null }); } catch (x) { e2 = x; }
    eq([e2?.name ?? null, f2?.recipe.photo_origin], [null, null], 'D-F19 : une référence relue avec photo_origin « appareil » et sans photo → aucune levée, photo_origin null');
    eq(Object.keys(f2?.recipe || {}).sort(), Object.keys({ ...reference, photo_sha256: null, photo_origin: null }).sort(), 'D-F19 : aucune clé ajoutée à la fiche par le lot F (ni photo_source_url)');
  });
```

- [ ] **Step 3 : tests rouges — `tests/passerelle.js`** (bloc neuf avant la fin de `runPasserelleTests`, l. 769 à `35fb29c` ; P-18 : pas de `garde()`) :

```js
  // --- Lot F (spec plats-en-images § 4.6) : deux raisons de plus, écrites par la passerelle pour image-web et relayées telles quelles
  {
    const f = (s, c) => async () => reponse(s, c);
    const a = await P.appelerAssistant('image-web', { url: 'https://a.test/i.jpg' }, { fetch: f(422, { erreur: 'pas_une_image' }), session: SESSION, config: CONFIG });
    const b = await P.appelerAssistant('image-web', { url: 'https://a.test/i.jpg' }, { fetch: f(413, { erreur: 'image_trop_lourde' }), session: SESSION, config: CONFIG });
    eq([a.raison, a.ecrite, b.raison, b.ecrite], ['pas_une_image', true, 'image_trop_lourde', true], 'RAISON_DE_ERREUR lit pas_une_image et image_trop_lourde (écrites par la passerelle)');
    eq([P.echecDomaine(a), P.echecDomaine(b)], [{ raison: 'pas_une_image', extra: {} }, { raison: 'image_trop_lourde', extra: {} }], 'echecDomaine les relaie avec extra: {}');
    eq([JSON.stringify(a).includes(JETON), JSON.stringify(b).includes(JETON)], [false, false], 'le jeton n’est dans aucun des deux résultats');
  }
```

- [ ] **Step 4 : tests rouges — `tests/lecture-web.js` (lot B).** Amender les formes exactes relevées au Step 0 : dans l'objet attendu de
  « lirePage : hôte RECALCULÉ… » (prototype l. 33 → l. 45 à `35fb29c`) et dans `page` de « lirePage : url_finale non URL → null… » (l. 35 → l. 47), ajouter
  en DERNIÈRE clé `image_url: null` (les entrées n'en portent pas) ; et (A-5, « tout autre eq qui compare un resultat.page complet ») l. 151, l'attendu
  `[PAGE, JSON.stringify(ok200.recette), null]` devient `[{ ...PAGE, image_url: null }, JSON.stringify(ok200.recette), null]`. Ajouter, avant la fin du
  `try` de `runLectureWebTests` :

```js
    // === Lot F (spec plats-en-images § 3.3, § 4.3 point 2, D-F18, D-F19) : l'image de la page, relue ; la provenance n'est écrite qu'avec la photo
    await run('lot F — lirePage : image_url', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const p = (image_url) => W.lirePage({ page: { url_finale: 'https://a.test/r', image_url } }).page.image_url;
      eq([p('https://cdn.test/i.jpg'), p('http://cdn.test/i.jpg'), p(undefined), p('https://cdn.test/i' + String.fromCodePoint(0x2028) + '.jpg'), p(7)], ['https://cdn.test/i.jpg', null, null, null, null],
        'lirePage : image_url admise gardée ; http, absente, hostile (U+2028), non chaîne → null');
      eq(Object.keys(W.lirePage({ page: {} }).page).at(-1), 'image_url', 'lirePage : image_url est la dernière clé de page');
      const source = await lire('../src/domain/lecture-web.js');
      const debut = source.indexOf('export function lirePage(');
      const corps = source.slice(debut, source.indexOf('\n}\n', debut));
      ok(corps.includes("adresseImageAdmise(propre(p, 'image_url'))"), 'lirePage (test de source) : image_url passe par adresseImageAdmise( — jamais par borner (une adresse tronquée n’est pas une adresse)');
    });

    await run('lot F — fabriquerLectureWeb : photoWeb et photo_source_url (D-F18, D-F19)', async () => {
      const W = await import('../src/domain/lecture-web.js');
      const H = (c) => c.repeat(64);
      const IMG = 'https://cdn.site.test/p.jpg';
      const SIGNET = { id: 'rc_s', edition_id: null, original_title: 'site.test', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: 'https://site.test/r/1', source_label: 'site.test' };
      const PAGE = { url_finale: 'https://site.test/r/1', hote: 'site.test', titre_page: 'P', auteur: null, site: null, lue_le: '2026-10-19T12:00:00.000Z', autres_recettes: 0, texte_coupe: false, image_url: IMG };
      const RECETTE = { title: 'Pâtes', servings: 2, prep_minutes: null, cook_minutes: null, total_minutes: null, ingredients: [{ source_text: '1 pomme', uncertain: false }], steps: [{ text: 'Cuire.' }], printed_page: null, sub_recipes: [], uncertain_fields: [], notes: null, incomplete: false, missing_page: false };
      const fab = (signet, over = {}) => W.fabriquerLectureWeb(RECETTE, { signet, versions: [], page: PAGE, sourceKind: 'jsonld', photoAnnoncee: IMG, ...over });
      const a = fab(SIGNET);
      eq([a.photoWeb, a.recipe.photo_source_url, 'photo_sha256' in a.recipe, 'photo_origin' in a.recipe], [IMG, IMG, false, false], 'fiche sans photo + image annoncée → photo_source_url = l’adresse (le rapatriement attendu), photoWeb = l’adresse ; photo_sha256 jamais touché ; aucune clé photo_origin ajoutée');
      const b = fab({ ...SIGNET, photo_sha256: H('a'), photo_origin: 'image', photo_source_url: null });
      eq([b.photoWeb, b.recipe.photo_source_url, b.recipe.photo_sha256, b.recipe.photo_origin], [null, null, H('a'), 'image'], 'fiche à photo de la personne → photoWeb null, rien de la photo changé');
      const c = fab({ ...SIGNET, photo_sha256: H('a'), photo_origin: 'web', photo_source_url: 'https://cdn.site.test/ancienne.jpg' });
      eq([c.photoWeb, c.recipe.photo_source_url, c.recipe.photo_sha256], [IMG, 'https://cdn.site.test/ancienne.jpg', H('a')], 'photo web + autre image annoncée → photoWeb = l’adresse, photo_source_url INCHANGÉ (la provenance de la photo en place reste vraie)');
      const sig = { ...SIGNET, current_version_id: 'rv_m' };
      const d = fab(sig, { versions: [{ id: 'rv_m', kind: 'extraction', provenance: { generated_by: 'manual' }, verification_state: 'verified' }], remplacer: false });
      eq([d.recipe, d.photoWeb], [sig, IMG], 'remplacer: false → le signet INTACT (aucune clé changée, B-24), photoWeb = l’adresse (la descente partira après la transaction, R-F-2)');
      eq([fab(SIGNET, { photoAnnoncee: null }).photoWeb, fab(SIGNET, { photoAnnoncee: 'https://cdn.site.test/autre.jpg' }).photoWeb, 'photo_source_url' in fab(SIGNET, { photoAnnoncee: null }).recipe], [null, null, false], 'photoAnnoncee nulle ou différente → photoWeb null, aucun photo_source_url posé (S-12)');
      let e = null; let ap = null;
      try { ap = fab({ ...SIGNET, photo_origin: 'appareil' }); } catch (x) { e = x; }
      eq([e?.name ?? null, ap?.recipe.photo_origin], [null, null], 'D-F19 : signet relu avec photo_origin « appareil » → aucune levée, photo_origin null');
      let e2 = null; let ap2 = null;
      try { ap2 = fab({ ...SIGNET, photo_origin: 'appareil' }, { remplacer: false }); } catch (x) { e2 = x; }
      eq([e2?.name ?? null, ap2?.recipe.photo_origin], [null, 'appareil'], 'P-5 : « Ajouter sans remplacer » sur une origine hors liste ne lève pas ; le signet rendu reste intact (il n’est pas écrit)');
    });
```

- [ ] **Step 5 : test rouge Node — chaînage** (`tools/assistant-lecture-web.test.mjs`, après les tests de la tâche 1 ; `pseudo`, `ICI`, `path`,
  `pathToFileURL`, `readFileSync` du fichier) :

```js
test('chainage serveur → client : lireOctetsBase64(versBase64(octets), n) rend les memes octets a toute taille ; base64.js sans import', async () => {
  const chemin = path.join(ICI, '..', 'src', 'domain', 'base64.js');
  assert.doesNotMatch(readFileSync(chemin, 'utf8'), /^\s*import\b/m, 'module feuille, sans import (importable par Node)');
  const { lireOctetsBase64 } = await import(pathToFileURL(chemin).href);
  for (const n of [1, 2, 3, 100000, L.TRANCHE_BASE64 + 1, 2 * L.TRANCHE_BASE64 + 2]) {
    const entree = pseudo(n);
    const relus = lireOctetsBase64(L.versBase64(entree), n);
    assert.ok(relus instanceof Uint8Array && relus.length === n && relus.every((o, i) => o === entree[i]), 'n = ' + n);
  }
  const b = L.versBase64(pseudo(100000)); const milieu = Math.floor(b.length / 2);
  assert.equal(lireOctetsBase64(b.slice(0, milieu) + '=' + b.slice(milieu + 1), 100000), null, 'un = au milieu → null');
  assert.equal(lireOctetsBase64(b, 99999), null, 'longueur ≠ 4 × ceil(taille / 3) → null');
  assert.deepEqual([lireOctetsBase64(42, 1), lireOctetsBase64('@@@@', 3), lireOctetsBase64('', 0)?.length], [null, null, 0]);
  assert.equal(lireOctetsBase64('AAA AAAA', 5), null, 'une espace, longueur exacte : atob l ignorerait, seule la regle ALPHABET la refuse');
});
```

- [ ] **Step 6 : rouge lu.** Suite : les blocs neufs rougissent (modules absents, raisons non relayées, `image_url` absente, `photoWeb` absent) ; Node :
  le chaînage rougit (`base64.js` absent). Noter les comptes dans `progress.md`. Mesuré au rejeu (tests de la tâche 2 sur le code de la tâche 1, épingle
  5680) : suite `❌ 5668/5703` (35 rouges : les pins, les blocs neufs, les trois formes de `page`) ; Node 203/204 (le chaînage).

- [ ] **Step 7 : implémenter.** `src/model/schema.js` (après `AVAILABILITY` / `VERIFICATION` : après la l. 149 à `35fb29c`) :

```js
// Lot F « Les plats en images » (spec § 3.1, D-F1) : l'origine d'une photo du plat — prise ici (photo), choisie ici (image) ou rapatriée d'une page
// web par la fonction de l'assistant (web). Liste FERMÉE, lue par assertVocabulaire ; l'écran ciblé du lot A n'admet que les deux premières.
export const PHOTO_ORIGINS = Object.freeze(['photo', 'image', 'web']);
// L'empreinte d'une ligne files (sa clé) : 64 chiffres hexadécimaux en minuscules. UNE définition pour les lecteurs du lot F (un pointeur
// venu d'ailleurs n'est lu que s'il la passe, règle T4-R1-d du lot A).
export const HASH = /^[0-9a-f]{64}$/;
```

  et `APP_VERSION = '0.15.0'`. `src/domain/vocabulaire.js` : import `{ AVAILABILITY, VERIFICATION, STATUTS_IMPORT, SOURCE_KINDS, SORTES_IMPORT, PHOTO_ORIGINS }` (garder les noms que B,
  C, D, E y ont ajoutés) ; dans `VOCABULAIRE.recipes`, après `source_kind` (l. 25), `photo_origin: { liste: PHOTO_ORIGINS, obligatoire: false },` ; en fin de fichier :

```js
// D-F19 : une origine relue hors liste (archive, appareil plus récent) se lit null chez les fabricants qui RECOPIENT une fiche (fabriquerExtraction,
// fabriquerLectureWeb, « Corriger ») — sinon assertVocabulaire lèverait sur une fiche reçue. Le pointeur et l'adresse, eux, sont revalidés à chaque lecture.
export const originePhotoAdmise = (v) => (PHOTO_ORIGINS.includes(v) ? v : null);
```

  `src/domain/import-cible.js` : import `{ assertVocabulaire, originePhotoAdmise } from './vocabulaire.js'` ; l. 116 à `bd03e48` (l. 119 à `4cb99a0`, l. 130 à `35fb29c`) :
  `photo_origin: photo ? (ORIGINES_PHOTO.includes(photo.origin) ? photo.origin : null) : originePhotoAdmise(reference.photo_origin),`.
  `src/core/image.js` (après `preparerPhotoLocale`, l. 83-90 à `35fb29c`) :

```js
// Lot F (spec plats-en-images § 3.4, D-F12) : une image DISTANTE (l'image d'une page web, rapatriée par la fonction de l'assistant) passe un mur plus
// strict qu'une photo locale : type annoncé de la liste des couvertures (jamais HEIC), en-tête LU et du MÊME type que l'annonce, petit côté ≥ 200 px
// (une icône, un logo carré ou un pixel de suivi n'illustre pas un plat), ≤ 16 Mpx, ≤ 5 Mio ; puis le même ré-encodage JPEG 1 200 px. N'écrit rien.
export const COTE_MIN_DISTANT = 200;
export async function preparerPhotoDistante(blob, { coteMin = COTE_MIN_DISTANT } = {}) {
  if (!(blob instanceof Blob)) throw new ErreurImage('indecodable');
  if (blob.size > LIMITES_COUVERTURE.octetsDistants) throw new ErreurImage('trop_lourde');
  if (!COVER_INPUT_MIME.includes(blob.type)) throw new ErreurImage('type');
  const dims = await dimensionsImage(blob);
  if (!dims || dims.type !== blob.type) throw new ErreurImage('indecodable');
  if (Math.min(dims.largeur, dims.hauteur) < coteMin) throw new ErreurImage('trop_petite');
  if (dims.largeur * dims.hauteur > LIMITES_COUVERTURE.pixels) throw new ErreurImage('trop_grande');
  return reduireImage(blob);
}
```

  `src/domain/base64.js` (neuf) :

```js
// Relire le base64 d'une image reçue (lot F « Les plats en images », spec § 3.4) : module FEUILLE, sans aucun import — la suite navigateur ET les tests
// Node l'importent (chaînage avec versBase64 du serveur, tools/assistant-lecture-web.test.mjs). Ne lève jamais : toute forme inattendue rend null.
// Règle : une chaîne de l'alphabet base64 standard avec remplissage, de longueur EXACTE 4 × ceil(taille / 3), qui se décode en `taille` octets.
const ALPHABET = /^[A-Za-z0-9+/]*={0,2}$/;
export function lireOctetsBase64(texte, taille) {
  try {
    if (typeof texte !== 'string' || !Number.isSafeInteger(taille) || taille < 0) return null;
    if (texte.length !== 4 * Math.ceil(taille / 3) || !ALPHABET.test(texte)) return null;
    const binaire = atob(texte);
    if (binaire.length !== taille) return null;
    const octets = new Uint8Array(taille);
    for (let i = 0; i < taille; i += 1) octets[i] = binaire.charCodeAt(i);
    return octets;
  } catch { return null; }
}
```

  `src/domain/photo-web.js` (neuf ; aucun des mots du fournisseur ni de la base dans ce fichier, commentaires compris) :

```js
// Le rapatriement de l'image d'une page web (lot F « Les plats en images », spec docs/superpowers/specs/2026-10-19-plats-en-images-design.md § 3.4) :
// des fonctions PURES (adresse admise, comparaison, candidat) et UN appel, `lireImageWeb`, par la passerelle de l'assistant avec la session (outil
// `image-web`) — jamais un fetch direct vers l'hôte de l'image (I-F3 : l'adresse IP de l'appareil ne part jamais chez lui). La réponse est une
// DONNÉE HOSTILE : chaque champ lu par Object.hasOwn, le type dans la liste, la taille bornée AVANT tout décodage, le base64 relu à la longueur
// exacte (base64.js). Aucune fonction ne lève ; le jeton n'entre dans aucun objet rendu.
import { appelerAssistant, echecDomaine } from './passerelle.js';
import { lireOctetsBase64 } from './base64.js';
import { lienSignet } from '../core/lien.js';
import { HASH } from '../model/schema.js';
import { COVER_INPUT_MIME } from '../sync/mime.js';

// R-F-4, D-F13 : 2 Mio par image (le même littéral que LIMITES_IMAGE.octets du serveur, épinglé des deux côtés) ; la réponse JSON d'une image à la
// borne (2 796 204 caractères de base64 plus une enveloppe de moins de 4 Kio) tient dans 3 Mio ; 90 s couvrent le téléchargement côté serveur
// (30 s au plus) ET le transfert de la réponse vers le téléphone.
export const LIMITES_IMAGE_WEB = Object.freeze({ url: 2048, octets: 2 * 1024 * 1024, corpsReponse: 3 * 1024 * 1024, tentativeMs: 90000, types: COVER_INPUT_MIME });
// Liste FERMÉE des raisons que lireImageWeb et rapatrierPhotoWeb peuvent rendre (journal, tests) ; les définitives disent que l'image de CETTE
// adresse ne sera jamais utilisable : « Réessayer » n'est plus offert pour elle (D-F17).
export const RAISONS_PHOTO_WEB = Object.freeze(['adresse', 'fiche_absente', 'fiche_changee', 'photo_manuelle', 'deja_la', 'vol_tenu', 'hors_ligne', 'non_connecte', 'non_admis', 'quota',
  'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit', 'inaccessible', 'pas_une_image', 'image_trop_lourde', 'illisible',
  'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde', 'ecriture']);
export const RAISONS_DEFINITIVES = Object.freeze(['interdit', 'pas_une_image', 'image_trop_lourde', 'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde']);

const ASCII_VISIBLE = /^[\x21-\x7e]+$/;
// Une adresse d'image admise (I-F2) : https seul, ASCII visible, ≤ 2 048 AVANT et APRÈS la normalisation de lienSignet (qui retire les identifiants
// et peut allonger par encodage : un href qui dépasse serait refusé par le serveur, échec permanent). Rend l'href normalisé, sinon null.
export function adresseImageAdmise(valeur) {
  try {
    if (typeof valeur !== 'string' || valeur.length > LIMITES_IMAGE_WEB.url || !ASCII_VISIBLE.test(valeur)) return null;
    const l = lienSignet(valeur);
    if (!l.ok || new URL(l.href).protocol !== 'https:') return null;
    return l.href.length <= LIMITES_IMAGE_WEB.url && ASCII_VISIBLE.test(l.href) ? l.href : null;
  } catch { return null; }
}
// UNE comparaison d'adresses d'image (candidat, garde des trois champs, raisons gardées, S-10) : sous leur forme normalisée ; refusée = jamais égale.
export function memeAdresseImage(a, b) {
  const x = adresseImageAdmise(a);
  return x !== null && x === adresseImageAdmise(b);
}
const pointeurValide = (f) => typeof f?.photo_sha256 === 'string' && HASH.test(f.photo_sha256);
// D-F10 : l'adresse à rapatrier pour cette fiche, ou null — jamais quand la personne a sa photo (origine photo, image, ou inconnue, avec un pointeur
// valide), jamais quand cette image-là est déjà en place ; une photo web se remplace par une image différente.
export function candidatPhotoWeb(fiche, imageUrl) {
  const href = adresseImageAdmise(imageUrl);
  if (href === null) return null;
  const photo = pointeurValide(fiche);
  if (photo && fiche.photo_origin !== 'web') return null;
  if (photo && memeAdresseImage(fiche.photo_source_url, href)) return null;
  return href;
}
const echecDe = (raison, extra = {}) => ({ etat: 'echec', raison, extra });
// UN POST { outil: 'image-web', corps: { url } } (corpsMax 3 Mio : le défaut de 2 Mio de la passerelle ne suffit pas à une image à la borne).
// Rend { etat: 'recue', blob, urlFinale } ou { etat: 'echec', raison ∈ RAISONS_PHOTO_WEB, extra }. `config` : tests seulement (P-3).
export async function lireImageWeb({ url, session } = {}, { fetch, signal, tentativeMs = LIMITES_IMAGE_WEB.tentativeMs, config } = {}) {
  try {
    const href = adresseImageAdmise(url);
    if (href === null) return echecDe('adresse');
    const r = await appelerAssistant('image-web', { url: href }, { fetch, session, config, signal, tentativeMs, corpsMax: LIMITES_IMAGE_WEB.corpsReponse });
    if (r.raison) { const d = echecDomaine(r); return echecDe(RAISONS_PHOTO_WEB.includes(d.raison) ? d.raison : 'interne', d.extra ?? {}); }
    const c = r.corps;
    const lu = (k) => (c && typeof c === 'object' && Object.hasOwn(c, k) ? c[k] : undefined);
    const type = lu('type'); const taille = lu('taille');
    if (typeof type !== 'string' || !LIMITES_IMAGE_WEB.types.includes(type)) return echecDe('illisible');
    if (!Number.isSafeInteger(taille) || taille < 1) return echecDe('illisible');
    if (taille > LIMITES_IMAGE_WEB.octets) return echecDe('image_trop_lourde');
    const octets = lireOctetsBase64(lu('octets'), taille);
    if (octets === null) return echecDe('illisible');
    return { etat: 'recue', blob: new Blob([octets], { type }), urlFinale: adresseImageAdmise(lu('url_finale')) };
  } catch { return echecDe('interne'); }
}
```

  `src/domain/passerelle.js` : `RAISON_DE_ERREUR` gagne `pas_une_image: 'pas_une_image', image_trop_lourde: 'image_trop_lourde'` ; la liste relayée par
  `echecDomaine` gagne `'pas_une_image', 'image_trop_lourde'`. `src/domain/lecture-web.js` (B) : imports
  `import { adresseImageAdmise, candidatPhotoWeb, memeAdresseImage } from './photo-web.js';` et `import { assertVocabulaire, originePhotoAdmise } from './vocabulaire.js';`
  et `HASH` ajouté à l'import de `../model/schema.js` (`{ SOURCE_KINDS, HASH }`) ; dans `lirePage` (l. 47 à `35fb29c`), la dernière clé de `page` :
  `texte_coupe: propre(p, 'texte_coupe') === true, image_url: adresseImageAdmise(propre(p, 'image_url')),` ; `fabriquerLectureWeb` :

```js
// Le fabricant de B (35fb29c, l. 194-228), recopié en entier : seules les lignes marquées « Lot F » sont neuves (rejeu, A-6 : le corps RÉEL de B —
// vocabulaire de source_kind vérifié en tête, incertains, lu_le, copie `intact` de la branche remplacer: false — est gardé ligne pour ligne).
export function fabriquerLectureWeb(recette, { signet, versions = [], page = null, sourceKind = null, importId = null, modele = null, maintenant = null, remplacer = true, photoAnnoncee = null } = {}) {
  assertVocabulaire({ source_kind: sourceKind }, 'recipes'); // la provenance porte sourceKind même quand la fiche reste intacte
  const B = BORNES_EXTRACTION;
  const ingredients = recette.ingredients.map((l) => ({ ...parseIngredientLine(l.source_text), uncertain: l.uncertain === true, verification_state: 'to_verify' }));
  const steps = recette.steps.map((s, i) => ({ id: newId('st'), position: i + 1, text: s.text, ...detectTimers(s.text) }));
  const lu = typeof recette.title === 'string' ? borner(recette.title, TITRE_FICHE_MAX).trim() : '';
  const titreLu = lu && !adresseStricte(lu) ? lu : null;
  const premiere = !(Array.isArray(versions) && versions.length);
  const incertains = (Array.isArray(recette.uncertain_fields) ? recette.uncertain_fields : []).filter((u) => typeof u === 'string' && Array.from(u).length <= B.champIncertain).slice(0, B.champsIncertains);
  const version = {
    id: newId('rv'), recipe_id: signet.id, kind: 'extraction', parent_version_id: signet.current_version_id || null, status: null,
    servings: recette.servings ?? null, prep_minutes: recette.prep_minutes ?? null, cook_minutes: recette.cook_minutes ?? null, active_minutes: null, total_minutes: recette.total_minutes ?? null,
    ingredients, steps, constraints: {}, changes: '', notes: recette.notes ?? null,
    provenance: {
      source_url: signet.source_url, url_finale: page?.url_finale ?? null, source_kind: sourceKind, lue_le: page?.lue_le ?? null, lu_le: page?.lue_le ?? null, model: modele ?? null, generated_by: 'ai',
      auteur: page?.auteur ?? null, site: page?.site ?? null,
      import_id: importId ?? null, incomplete: recette.incomplete === true, missing_page: false, titre_lu: titreLu, titre_signet: premiere && titreLu ? (signet.original_title ?? null) : null,
      source_page_ids: [], source_document_id: null, edition_id: signet.edition_id ?? null, convention_snapshot: null, uncertain_fields: incertains,
    },
    verification_state: 'to_verify',
    ...(maintenant ? { created_at: maintenant } : {}),
  };
  const remplacement = versionHumaine(versions);
  // Lot F (§ 4.3 point 2, D-F18) : un appel ne part que s'il a été ANNONCÉ, et pour l'adresse annoncée (S-12) ; la provenance n'est écrite
  // ici que sur une fiche SANS photo valide (le rapatriement attendu) ; photo_sha256 n'est jamais touché ; l'origine recopiée passe
  // originePhotoAdmise (D-F19), et seulement si la fiche la porte (P-6 : aucune clé ajoutée).
  const candidat = candidatPhotoWeb(signet, page?.image_url ?? null);
  const photoWeb = candidat !== null && memeAdresseImage(candidat, photoAnnoncee) ? candidat : null;
  const origine = Object.hasOwn(signet, 'photo_origin') ? { photo_origin: originePhotoAdmise(signet.photo_origin) } : {};
  if (remplacer === false) { const intact = { ...signet }; assertVocabulaire({ ...intact, ...origine }, 'recipes'); return { recipe: intact, version, remplacement, photoWeb }; } // une copie, jamais la référence ; P-5 (lot F) : le vocabulaire est vérifié avec l'origine admise, le signet rendu INTACT (B-24)
  const sansPhoto = !(typeof signet.photo_sha256 === 'string' && HASH.test(signet.photo_sha256));
  const recipe = {
    ...signet,
    original_title: premiere && titreLu ? titreLu : signet.original_title,
    availability: ingredients.length && steps.length && recette.incomplete !== true ? 'available' : 'partial',
    verification_state: 'to_verify', current_version_id: version.id, printed_page: null,
    ingredient_ids: [...new Set(ingredients.map((l) => l.ingredient_id).filter(Boolean))],
    source_author: page?.auteur ?? null, source_site: page?.site ?? null, source_fetched_at: page?.lue_le ?? null, source_kind: sourceKind ?? null,
    ...origine, // Lot F (D-F19)
    ...(photoWeb && sansPhoto ? { photo_source_url: photoWeb } : {}), // Lot F (D-F18) : le rapatriement attendu
  };
  assertVocabulaire(recipe, 'recipes'); // D-12 : le sixième fabricant vérifie le vocabulaire fermé avant toute écriture
  return { recipe, version, remplacement, photoWeb };
}
```

  Si le code réel de B (relu au Step 0) diffère du prototype dans le corps de ce fabricant, c'est SON corps qui est gardé ligne pour ligne ; seules
  les lignes « Lot F » sont ajoutées (la déstructuration gagne `photoAnnoncee`, le retour gagne `photoWeb`), et l'écart est consigné. **Rejeu (A-6)** :
  c'est le cas — le bloc ci-dessus est le fabricant de `35fb29c` ; P-5 s'applique à sa copie : `assertVocabulaire({ ...intact, ...origine }, 'recipes')`.

  Pins : chaque ligne relevée au Step 0 passe de `0.14.0` à `0.15.0` (et `v0\.14\.0` à `v0\.15\.0`), avec le libellé du lot (convention du lot E :
  « (lot F, plats en images) », l'historique des versions prolongé). Les quinze lignes à `35fb29c` : `tests/ajouter.js` l. 3806 et 3808 ;
  `tests/assistant-compte.js` l. 8 ; `tests/classement.js` l. 2568 ; `tests/creer-ia.js` l. 11 ; `tests/passerelle.js` l. 765 et 767 ;
  `tests/recherche-web.js` l. 66 (commentaire), 69 et 72 ; `tests/sync-l3.js` l. 1867 ; `tests/sync-l4.js` l. 514, 516, 3506 et 3507. `sw.js` :
  `VERSION = 'cuisine-os-v0.15.0-1'`, `SHELL` + `'./src/domain/base64.js'` et `'./src/domain/photo-web.js'`.
- [ ] **Step 8 : vert.** Suite : tout vert **sauf l'épingle** (`eq(results.length, …)`, forcément rouge tant qu'elle n'est pas relevée : Step 9),
  une seule erreur de console (favicon) ; Node : tout vert (compte relevé) ; `--check` 0. Mesuré au rejeu : `❌ 5738/5739` (l'épingle seule) ; Node
  **204/204** ; `--check` 0.
- [ ] **Step 9 : épingle relevée** : `tests/tests.js`, `eq(results.length, <obtenu − 1>, …)` ; relancer la suite, `✅ N/N`. Mesuré : épingle
  **5738** (5680 + 58), `✅ 5739/5739`.
- [ ] **Step 10 : mutants de la tâche** (copie du worktree servie à part sur 8190, `node <suite.cjs> 8190` ; chacun doit rougir) : `ORIGINES_PHOTO` remplacée par
  `PHOTO_ORIGINS` dans `fabriquerExtraction` · recopie brute `reference.photo_origin ?? null` (D-F19) · `PHOTO_ORIGINS` sans `'web'` · règle ASCII retirée
  d'`adresseImageAdmise` · borne après `lienSignet` retirée · `candidatPhotoWeb` sans la règle `photo_origin !== 'web'` · `corpsMax` omis dans
  `lireImageWeb` · `LIMITES_IMAGE_WEB.octets` remis à 5 Mio · `corpsReponse` remis à 2 Mio · `dims.type !== blob.type` retiré · plancher de 200 px retiré ·
  `image_url` lue par `borner` au lieu d'`adresseImageAdmise` · `fabriquerLectureWeb` qui pose `photo_source_url` quand une photo web est en place ·
  `photoWeb` sans la comparaison à `photoAnnoncee` · règle `ALPHABET` retirée de `lireOctetsBase64` (« le 200 est une donnée hostile », chaînage
  Node) · `type` par défaut quand le champ propre manque (`lu('type') ?? 'image/jpeg'`) et Blob construit avec un type figé
  (`new Blob([octets], { type: 'image/jpeg' })`) (« le 200 est une donnée hostile », R-F-8) · `lireOctetsBase64` appelée AVANT la borne de taille
  (espion `atob`). (L'accès direct `c[k]` à la place de `lu(k)` n'est plus dans cette liste : sur un corps relu par `JSON.parse`, aucun champ
  n'est hérité hors `Object.prototype`, que la suite ne pollue plus — mutant équivalent ; la garde `Object.hasOwn` reste dans le code, S-11.)
- [ ] **Step 11 : invisibles** sur les fichiers touchés : 0.
- [ ] **Step 12 : commit** `Domaine photo web : PHOTO_ORIGINS, HASH, adresse d image, lireImageWeb, base64, mur distant, lecture web amendee (lot F, tache 2)`.

---

### Task 3 : La fiche — figure de tête, zone « Photo du plat », gestes, rapatriement, ★ Favori relu

Spec § 9 tâche 3 ; § 4.1 (montage, états, gestes, pointeur sans octets), § 4.3 point 3 (`rapatrierPhotoWeb`), § 4.5, § 5, D-F15, D-F16 (★ Favori) ;
tests § 7.4 (composant, fiche, pointeur sans octets, rapatriement, ★ Favori). `sw.js` `-2`.

**Files:**
- Create: `src/ui/photo-plat.js` (≈ 300 lignes au rejeu)
- Modify: `src/ui/components.js` (EI-5 : `renderZoneCouverture` y est DÉPLACÉE depuis `livre-ajout.js` — l. 283-298 à `35fb29c`, commentaire compris, dans sa
  forme du lot G — et prend son troisième paramètre `{ libelle, nomRetirer }` ; posée après `boutonTelechargerPages`, l. 547-551, avant `dietChip`) ;
  Modify: `src/ui/livre-ajout.js` (la fonction retirée ; l. 13 : l'import de `./components.js` gagne `renderZoneCouverture` ; après la l. 24,
  `export { renderZoneCouverture };` — le motif de D-E20 : book.js et les tests l'importent toujours de `livre-ajout.js`)
- Modify: `src/ui/recipe.js` (l. 34 signature — `deps` déjà posé par B — ; l. 76 `favBtn` ; l. 102-104 — `ctxF` puis `photoDuPlat(recipe, ctxF)` du lot G —
  → `monterPhotoPlat` ; après `drawBody()`, l. 164 : la zone ; l. 404-430 : `photoDuPlat` retirée ; imports l. 7, 8 et 18)
- Modify: `src/i18n/en.js` (quatorze entrées, § 5 ; la valeur anglaise de « Photo du plat · {titre} » du lot G, l. 528 : « Dish photo · {titre} » → « Photo of
  the dish · {titre} »)
- Modify: `tests/ajouter.js` (`MODULES_NEUFS` l. 7 + `'../src/ui/photo-plat.js'` ; à côté du test de `renderZoneCouverture`, l. 1376-1393 : un bloc neuf)
- Modify: `tests/creer-ia.js` (les `sources` de `sansEntree`, l. 1238 : `'photo-plat.js'` ; une garde contre un scan vide, après la l. 1244)
- Modify: `tests/photo-plat.js` (cinq blocs, plus un par écrivain (c) neuf de `recipe.js`, au-dessus du repère de fin), `tests/tests.js` (épingle,
  Step 12), `sw.js` (`VERSION` `-2`, `SHELL` + `'./src/ui/photo-plat.js'` : au Step 9, AVEC `recipe.js`)
- Modify: tout écrivain (c) neuf de `src/ui/recipe.js` relevé au Step 0 (D-F16 : corrigé comme ★ Favori, avec son test) — relevé au rejeu : aucun

**Interfaces:**
- Consumes : tâche 2 (`HASH`, `adresseImageAdmise`, `memeAdresseImage`, `candidatPhotoWeb`, `lireImageWeb`, `RAISONS_DEFINITIVES`, `preparerPhotoDistante`,
  `assertVocabulaire`) ; lot A (`preparerPhotoLocale`, `ErreurImage`, `messageErreurImage`, `section`, `sessionAssistant`, `texteRefusAssistant`,
  `texteEchecAssistant`, `urlDeBlob`, `revoquerUrlDeBlob`, `sha256Hex`, `lienSignet`, `logError`, `pickFiles`, `toast`) ; lot G (plan G rév. 3 tâches 1 et
  6, à relire au Step 0) : `typeAffichage(fileRow)`, `displayUrl(fileRow, creerUrl)` (`src/sync/mime.js`), `contexteFichiers(ctx) → { connecte, uid,
  erreurs, moteur }`, `gesteTelechargement({ moteur, redessiner })`, `vignettePage(page, fichier, { connecte, uid, erreurs, telecharger })`
  (`src/ui/components.js`), `lireErreursFichiers(db)` (`src/sync/fichiers.js`), le `photoDuPlat(recipe, ctxF)` de G dans `recipe.js`, et les boutons
  `telechargeable` / `reessayable` que G a ajoutés à `renderZoneCouverture`. **Relu à `35fb29c`** : `erreurs` est une `Map` et se relit par
  `relireErreurs(ctxF)` (`components.js`, l. 481 : une définition) ; `gesteTelechargement({ moteur, redessiner, dire })` ; `photoDuPlat` (l. 406-430) porte
  la garde de G « sans octets, rien n'est offert si ce qui arrivera ne s'affichera pas » (`safeDisplayType`, ronde 1 de sa tâche 6) ; `messageErreurImage`
  vit dans `src/core/image.js` (lot E, D-E20) — EI-3, EI-4.
- Produces (`src/ui/photo-plat.js`, signatures exactes) :

```js
export async function figurePhotoPlat(recipe, { repo = repoModule, ctxF = {} } = {})                 // → HTMLElement (figure) | null
export function texteEchecPhotoWeb({ raison, extra = {} } = {})                                     // → chaîne | null
export function etatZonePlat(recipe, { present = false, enVol = false, enLigne = true, connecte = false, occupe = false, echec = null } = {})
  // → { sha256, message, web: null | 'en_cours' | 'echouee', raison, offreReessayer, peutReessayer, motifEteint: null | 'hors_ligne' | 'sans_compte', absente, enCours }
export function renderZonePhotoPlat(etat, gestes = {})                                              // → HTMLElement
export function ligneAnnoncePhotoWeb()                                                             // → small.muted[data-role="photo-web-annonce"]
export async function poserPhotoPlat(recipeId, file, { repo = repoModule, origin } = {})
  // → { issue: 'ok', sha256 } | { issue: 'refuse', raison: 'image', code } | { issue: 'refuse', raison: 'fiche_absente' } | { issue: 'echec', raison: 'ecriture' }
export async function retirerPhotoPlat(recipeId, { repo = repoModule } = {})
  // → { issue: 'ok' } | { issue: 'refuse', raison: 'fiche_absente' } | { issue: 'echec', raison: 'ecriture' }
export function rapatrierPhotoWeb(recipeId, { candidat = null, tape = false, ctx = null, repo = repoModule, fetch = undefined, enLigne = () => enLigneFlag } = {})
  // → Promise<{ issue: 'ok', sha256 } | { issue: 'refuse', raison } | { issue: 'echec', raison }> ; ne lève jamais ; vol posé AVANT tout await
export const recuperationEnCours = (recipeId) => boolean
export const attendreRecuperation = (recipeId) => Promise
export async function monterPhotoPlat(recipe, ctx, { repo, pickFiles, toast, fetch, enLigne, ctxF } = {})
  // → { entete: div[data-role="emplacement-photo-plat"], zone: section.card (h2 « Photo du plat », div[data-role="zone-photo-plat"]), gestes: { photographier, choisir, retirer, reessayer, abandonner } }
export function reinitialiserPhotoPlat()                                                           // tests seulement
```

- Produces (`components.js`, ré-exportée par `livre-ajout.js` : EI-5) : `renderZoneCouverture(etat, gestes = {}, { libelle = null, nomRetirer = null } = {})`. (`recipe.js`) :
  `renderRecipe(params, query, ctx, deps = {})`.

- [ ] **Step 0 : relire le lot G dans le code réel** : `photoDuPlat` de `recipe.js` (corps entier, imports qu'il est seul à lire), `contexteFichiers`,
  `gesteTelechargement`, `vignettePage` (textes, `data-*`, forme du geste « Télécharger »), `typeAffichage`, `displayUrl`, `lireErreursFichiers`, la
  forme actuelle de `renderZoneCouverture` (boutons de G en tête de la rangée), le moteur factice de G (`telecharger(shas) → { recus, … }`,
  `onEtat`), les textes de `TEXTES_VIGNETTE` (« Pas encore sur cet appareil », « Connecte-toi pour la télécharger », « Pas encore envoyée par l’appareil
  qui l’a prise »), et la valeur `en.js` de « Photo du plat · {titre} ». **Tout écart au plan G rév. 3 se recopie** dans `figurePhotoPlat` (la règle
  reste : l'état d'un fichier absent vit EN TÊTE, la zone ne le répète pas, I-F10) et se consigne (amendement nommé, spec § 12). **Recensement D-F16**
  (★ Favori) sur la tête du lot E — toute écriture de `recipes` qui part d'une copie du RENDU de la fiche :

  ```bash
  python3 -I - <<'PY'
  import glob, re
  motifs = [r"save\(\s*'recipes'", r"\brecipes\s*:\s*\[", r"puts\s*:\s*\{[^}]*\brecipes\b", r"\.recipes\s*=", r"\brecipes\.push\(", r"saveBatch\(", r"transitionner\(", r"\.mutate\("]
  for f in sorted(glob.glob('src/**/*.js', recursive=True)):
      for i, l in enumerate(open(f, encoding='utf-8'), 1):
          if any(re.search(m, l) for m in motifs):
              print(f'{f}:{i}: {l.strip()[:200]}')
  PY
  ```

  Classer chaque ligne dans `.superpowers/sdd/2026-10-19-plats-en-images/recensement-D-F16.md` : (a) fabrique sa fiche (`creer-ia.js`, `signet.js`,
  `import.js` à `bd03e48`), (b) relit la fiche juste avant (`fabriquerExtraction` via `import-cible.js`, `fabriquerLectureWeb` via `import-web.js`),
  (c) part d'une copie du rendu (`recipe.js` l. 48 ★ Favori ; `recipe-edit.js` l. 270 à `bd03e48` — l. 282 à `4cb99a0` — « Corriger », corrigé en
  tâche 5). **Partage des (c)** : ceux de `src/ui/recipe.js` (l'écran de la fiche) — ★ Favori et tout (c) neuf que C, D ou E y ont ajouté — sont
  corrigés ICI (relire par `repo.get`, n'écrire que son champ sur la fiche relue), chacun avec SON test écrit sur le gabarit du bloc « D-F16 :
  ★ Favori » (Step 6 : fiche rendue sans photo, `rapatrierPhotoWeb` aboutit, puis le geste, et la fiche écrite porte encore les trois champs), et
  nommés ; les (c) de tout AUTRE fichier vont à la tâche 5 (Step 0, point 4), qui ne revient pas sur ceux-ci. **Lignes (R-F-11)** : les numéros
  cités par cette tâche — `bd03e48` (`recipe.js` l. 26, 48, 68-69, 119, 293-305 ; `livre-ajout.js` l. 240-251), prototype B (`recipe.js`
  l. 28-39) et plan G rév. 3 — sont relus sur la tête du lot E ; tout écart est un amendement nommé, pas un constat (R-C-7).
  **Relevé du rejeu (`35fb29c`)** : `photoDuPlat` l. 404-430 (commentaire compris), qui seule lit `safeDisplayType`, `displayUrl`, `typeAffichage`
  (l. 7), `urlDeBlob` (l. 8), `vignettePage`, `gesteTelechargement` et `relireErreurs` (l. 18) — recherche Python hors commentaires ; `contexteFichiers`
  rend `{ connecte, uid, erreurs: Map, moteur }` ; `TEXTES_VIGNETTE` porte les trois textes attendus ; `renderZoneCouverture` (livre-ajout.js l. 283-298)
  a les boutons de G en tête ; en.js l. 528 vaut « Dish photo · {titre} » (amendé, Step 10). Recensement D-F16 (script ci-dessus, et diff contre
  `4cb99a0`) : (c) = `recipe.js` l. 76 (★ Favori, ici) et `recipe-edit.js` l. 342 (« Corriger », tâche 5) ; AUCUN (c) neuf de B, C, D ou E — `import-web.js`
  l. 186 (signet neuf) = (a), l. 270 (`fabriquerLectureWeb` sur le signet relu) = (b), `table-matieres.js` l. 64 et `domain/table-matieres.js` l. 201
  (`fabriquerReferences` : des fiches NEUVES) = (a), `regroupement.js` l. 686 = une condition sans écriture (`fusion` rend `null`). **EI-5** : `livre-ajout.js`
  importe `./import-cible.js` depuis le lot E (`c647e4a`), qui importe `./import-web.js` depuis le lot B (`3ca8d19`) : lire `renderZoneCouverture` depuis
  `livre-ajout.js` ferait, à la tâche 5, le PREMIER cycle d'imports du graphe (0 à `35fb29c`) — d'où son déménagement dans `components.js` (Step 9).

- [ ] **Step 1 : tests rouges — `tests/ajouter.js`.** `MODULES_NEUFS` gagne `'../src/ui/photo-plat.js'`. À côté du bloc `renderZoneCouverture` existant (l. 1376-1393 à `35fb29c`)
  (`LA` = `livre-ajout.js`, déjà importé dans ce fichier) :

```js
  {
    // Lot F (spec plats-en-images § 4.1.2) : deux options de plus, défauts inchangés — la fiche du livre appelle toujours à deux arguments.
    const gestes = { photographier: () => {}, choisir: () => {}, retirer: () => {} };
    const sans = LA.renderZoneCouverture({ sha256: 'x', apercu: null, message: null, enCours: false }, gestes);
    eq([sans.querySelector(':scope > span')?.textContent, [...sans.querySelectorAll('button')].find((b) => b.textContent === 'Retirer')?.hasAttribute('aria-label')], ['Couverture', false],
      'renderZoneCouverture sans troisième argument : « Couverture », « Retirer » sans aria-label (inchangé)');
    const avec = LA.renderZoneCouverture({ sha256: 'x', apercu: null, message: null, enCours: false }, gestes, { libelle: 'Photo du plat', nomRetirer: 'Retirer la photo du plat' });
    eq([avec.querySelector(':scope > span')?.textContent, [...avec.querySelectorAll('button')].map((b) => b.textContent), [...avec.querySelectorAll('button')].find((b) => b.textContent === 'Retirer')?.getAttribute('aria-label')],
      ['Photo du plat', ['Photographier', 'Choisir une image', 'Retirer'], 'Retirer la photo du plat'], 'renderZoneCouverture avec { libelle, nomRetirer } : « Photo du plat », les mêmes boutons dans le même ordre, « Retirer » nommé « Retirer la photo du plat »');
  }
```

- [ ] **Step 2 : tests rouges — `tests/creer-ia.js`.** Dans `sources` (l. 1238), ajouter `'photo-plat.js': await lire('../src/ui/photo-plat.js'),` ; après les gardes (l. 1243-1244 à `35fb29c`)
  existantes : `ok(chainesDe(sources['photo-plat.js']).includes('Photo du plat non récupérée.') && chainesDe(sources['photo-plat.js']).includes('Ne pas récupérer'), 'couverture en.js : le détecteur lit bien photo-plat.js (garde contre un scan vide)');`.

- [ ] **Step 3 : tests rouges — `tests/photo-plat.js`, bloc « composant » (pur, au-dessus du repère de fin) :**

```js
    // ===== Tâche 3 — la fiche (spec § 4.1, § 4.3 point 3)
    await run('composant : etatZonePlat, texteEchecPhotoWeb, renderZonePhotoPlat (§ 4.1.2)', async () => {
      const PP = await import('../src/ui/photo-plat.js');
      const IMG = 'https://cdn.test/i.jpg';
      const AJOUTE = 'Ajoute une photo du plat : elle illustre la recette dans tes listes.';
      const base = { present: true, enVol: false, enLigne: true, connecte: true, occupe: false, echec: null };
      const champs = (e) => [e.sha256, e.message, e.web, e.raison, e.offreReessayer, e.peutReessayer, e.motifEteint, e.absente, e.enCours];
      const Z = (fiche, over = {}) => champs(PP.etatZonePlat(fiche, { ...base, ...over }));
      eq(Z({}), [null, AJOUTE, null, null, false, false, null, false, false], 'cas 1 : aucun pointeur, aucun candidat → le message');
      eq(Z({ photo_sha256: H('a') }), [H('a'), null, null, null, false, false, null, false, false], 'cas 2 : pointeur valide, octets ici');
      eq(Z({ photo_sha256: H('a') }, { present: false }), [H('a'), null, null, null, false, false, null, true, false], 'cas 3 : pointeur valide, octets absents → absente (l’état du fichier vit en tête)');
      eq([Z({}, { enVol: true }), Z({ photo_source_url: IMG }, { enVol: true })], [[null, null, 'en_cours', null, false, false, null, false, false], [null, null, 'en_cours', null, false, false, null, false, false]], 'cas 4 : en vol, avec ou sans candidat écrit → en_cours');
      eq(Z({ photo_source_url: IMG }), [null, null, 'echouee', null, true, true, null, false, false], 'cas 5 : candidat, pas en vol → non récupérée, Réessayer offert et allumé');
      eq([Z({ photo_sha256: '../x', photo_source_url: IMG }), Z({ photo_sha256: '../x' })], [[null, null, 'echouee', null, true, true, null, false, false], [null, AJOUTE, null, null, false, false, null, false, false]], 'cas 6 : un pointeur hostile vaut « aucun pointeur » (cas 5 ou cas 1)');
      eq(Z({ photo_sha256: H('a'), photo_origin: 'web', photo_source_url: IMG }, { enVol: true }), [H('a'), null, 'en_cours', null, false, false, null, false, false], 'en vol avec une photo web en place → cas 2 + en_cours');
      eq([Z({ photo_source_url: IMG }, { enLigne: false }).slice(5, 7), Z({ photo_source_url: IMG }, { connecte: false }).slice(5, 7), Z({}, { occupe: true })[8]], [[false, 'hors_ligne'], [false, 'sans_compte'], true], 'peutReessayer faux hors ligne (motif hors_ligne) et sans compte (sans_compte) ; occupe → enCours');
      const echec = (raison, tape, url = IMG, extra = {}) => ({ raison, extra, tape, url });
      eq(PP.etatZonePlat({ photo_source_url: IMG }, { ...base, echec: echec('quota', true, 'https://cdn.test/autre.jpg', { quota: 60 }) }).raison, null, 'une raison gardée pour une AUTRE adresse est ignorée');
      eq([PP.etatZonePlat({ photo_source_url: IMG }, { ...base, echec: echec('quota', true, IMG, { quota: 60 }) }).raison, PP.etatZonePlat({ photo_source_url: IMG }, { ...base, echec: echec('quota', false, IMG, { quota: 60 }) }).raison],
        ['Tu as atteint la limite du jour pour l’assistant (60 appels).', null], 'quota : dit après une TAPE ; muet après le départ automatique');
      const definitif = PP.etatZonePlat({ photo_source_url: IMG }, { ...base, echec: echec('pas_une_image', false) });
      eq([definitif.raison, definitif.offreReessayer, definitif.peutReessayer], ['L’image de cette page ne peut pas être utilisée.', false, false], 'pas_une_image, départ automatique : raison définitive dite, Réessayer retiré');
      const nc = PP.etatZonePlat({ photo_source_url: IMG }, { ...base, connecte: false, echec: echec('non_connecte', true) });
      eq([nc.raison, nc.motifEteint], ['Connecte-toi pour utiliser l’assistant.', null], 'non_connecte gardé d’une tape, puis sans compte : la raison le dit, la ligne sous le bouton n’est pas répétée (P-2)');

      const T = (raison, extra = {}) => PP.texteEchecPhotoWeb({ raison, extra });
      const COMPTE = 'L’appel a peut-être été compté ; relancer en coûtera un autre.';
      const DEF = 'L’image de cette page ne peut pas être utilisée.';
      const code = (c) => `L’assistant n’a pas répondu. Réessaie. Code : ${c}`;
      eq([T('quota', { quota: 60 }), T('quota'), T('non_admis'), T('non_connecte'), T('trop_de_demandes'), T('delai'), T('reseau'), T('annule'), T('inaccessible'),
        ...['interdit', 'pas_une_image', 'image_trop_lourde', 'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde'].map((r) => T(r)), T('ecriture'),
        T('serveur'), T('interne'), T('reponse_illisible'), T('requete'), T('illisible'), ...['adresse', 'fiche_absente', 'fiche_changee', 'photo_manuelle', 'deja_la', 'vol_tenu', 'hors_ligne'].map((r) => T(r))],
      ['Tu as atteint la limite du jour pour l’assistant (60 appels).', 'Tu as atteint la limite du jour pour l’assistant.', 'Ce compte n’a pas accès à l’assistant.', 'Connecte-toi pour utiliser l’assistant.',
        'Trop de demandes pour l’instant. Réessaie dans une minute.', COMPTE, COMPTE, COMPTE, 'Le site de la page n’a pas donné son image.', DEF, DEF, DEF, DEF, DEF, DEF, DEF, DEF,
        'La photo du plat n’a pas pu être changée. Réessaie.', code('serveur'), code('interne'), code('reponse_illisible'), code('requete'), code('illisible'), null, null, null, null, null, null, null],
      'texteEchecPhotoWeb : la table de § 4.1.2 (textes existants d’abord ; deux neufs ; refus avant l’appel → null)');

      const R = (fiche, over = {}) => PP.renderZonePhotoPlat(PP.etatZonePlat(fiche, { ...base, ...over }), {});
      const web = (n) => n.querySelector('[data-role="photo-web-etat"]');
      const c1 = R({});
      eq([c1.textContent.includes(AJOUTE), etiquettes(c1), web(c1)], [true, ['Photographier', 'Choisir une image'], null], 'rendu cas 1 : le message ; Photographier, Choisir une image');
      for (const [nom, c] of [['cas 2', R({ photo_sha256: H('a') })], ['cas 3', R({ photo_sha256: H('a') }, { present: false })]]) {
        eq([etiquettes(c), c.textContent.includes('Télécharger'), c.textContent.includes(AJOUTE), web(c)], [['Photographier', 'Choisir une image', 'Retirer'], false, false, null], `rendu ${nom} : trois boutons, aucun message, aucun « Télécharger »`);
      }
      const c4 = R({}, { enVol: true });
      eq([web(c4)?.getAttribute('role'), web(c4)?.textContent, bouton(c4, 'Photographier')?.disabled, bouton(c4, 'Choisir une image')?.disabled], ['status', 'Récupération de la photo du plat…', false, false], 'rendu cas 4 : p.status[role=status] « Récupération… », boutons d’ajout ALLUMÉS (une photo choisie pendant la descente gagne)');
      const c5 = R({ photo_source_url: IMG });
      const re5 = c5.querySelector('[data-role="reessayer-photo"]');
      eq([web(c5)?.textContent.includes('Photo du plat non récupérée.'), re5?.textContent, re5?.classList.contains('btn'), re5?.classList.contains('small'), re5?.disabled, c5.querySelector('[data-role="cout-photo-web"]')?.textContent, c5.querySelector('[data-role="abandonner-photo-web"]')?.textContent, c5.querySelector('[data-role="raison-photo-web"]')],
        [true, 'Réessayer', true, false, false, 'Un appel de plus, compté dans ton quota du jour.', 'Ne pas récupérer', null], 'rendu cas 5 : « non récupérée », « Réessayer » (.btn, pas .small) allumé, la ligne de coût, « Ne pas récupérer », aucune raison');
      const horsLigne = R({ photo_source_url: IMG }, { enLigne: false }); const sansCompte = R({ photo_source_url: IMG }, { connecte: false });
      eq([horsLigne.querySelector('[data-role="reessayer-photo"]')?.disabled, horsLigne.textContent.includes('Tu es hors ligne.'), sansCompte.querySelector('[data-role="reessayer-photo"]')?.disabled, sansCompte.textContent.includes('Connecte-toi pour utiliser l’assistant.')],
        [true, true, true, true], 'rendu cas 5 : « Réessayer » éteint, avec « Tu es hors ligne. » ou « Connecte-toi pour utiliser l’assistant. » dessous');
      const def = R({ photo_source_url: IMG }, { echec: echec('pas_une_image', false) });
      eq([def.querySelector('[data-role="reessayer-photo"]'), def.querySelector('[data-role="cout-photo-web"]'), !!def.querySelector('[data-role="abandonner-photo-web"]'), def.querySelector('[data-role="raison-photo-web"]')?.textContent], [null, null, true, DEF], 'raison définitive : aucun « Réessayer », aucune ligne de coût, « Ne pas récupérer » présent, la raison dite');
      const occupe = R({ photo_source_url: IMG }, { occupe: true });
      eq([...occupe.querySelectorAll('button')].every((b) => b.disabled), true, 'enCours : tous les boutons éteints, « Réessayer » et « Ne pas récupérer » compris');
      eq([c1, c4, c5, def].map((n) => [n.querySelectorAll('a').length, n.querySelectorAll('label').length, n.querySelectorAll('img').length]), [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], 'aucun <a>, aucun <label> (R-UX-8), aucun img (apercu: null)');
      const deuxFois = R({ photo_source_url: IMG }, { connecte: false, echec: echec('non_connecte', true) });
      eq(deuxFois.textContent.split('Connecte-toi pour utiliser l’assistant.').length - 1, 1, '« Connecte-toi pour utiliser l’assistant. » UNE seule fois quand la raison le dit déjà');
      eq(PP.ligneAnnoncePhotoWeb().textContent, 'Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour.', 'ligneAnnoncePhotoWeb : le texte de l’annonce (un ESSAI et son coût)');
    });
```

- [ ] **Step 4 : tests rouges — `tests/photo-plat.js`, bloc « fiche » :**

```js
    await run('fiche : places, D-F8, montage sans appel, gestes, relecture, D-F15, pendant une écriture, légende (§ 4.1)', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const PW = await import('../src/domain/photo-web.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      const { preparerPhotoLocale } = await import('../src/core/image.js');
      const { createArchive, inspectArchive, applyArchive } = await import('../src/domain/backup.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      const SESSION = { access_token: 'jeton-fiche-sentinelle', user: { id: 'u1' } };
      const sync = { user: { id: 'u1' }, auth: { jeton: async () => SESSION } };
      const choix = []; const dits = []; const aChoisir = []; const appelsImage = [];
      const deps = () => ({ pickFiles: async (o) => { choix.push(o); return aChoisir.shift() || []; }, toast: (m) => dits.push(m), fetch: async (url) => { appelsImage.push(url); return reponse(500, {}); }, enLigne: () => true });
      const monter = async (id, over = {}) => { const p = await renderRecipe({ id }, {}, await ctxPour(repo, db, { sync, ...over }), deps()); scene.append(p); return p; };
      const zoneDe = (p) => p.querySelector('[data-role="zone-photo-plat"]');
      const imgTete = (p) => p.querySelector('[data-role="photo-plat"] img');
      const mettre = (...rows) => db.mutate({ puts: { recipes: rows }, origin: 'device' });
      const versions = (...rows) => db.mutate({ puts: { recipe_versions: rows }, origin: 'device' });
      const AJOUTE = 'Ajoute une photo du plat : elle illustre la recette dans tes listes.';
      try {
        // Places (§ 4.1.1)
        await mettre(fiche('rc_p', { source_page_ids: ['pg1'] })); await versions(version('rc_p'));
        const pP = await monter('rc_p', { pagesById: new Map([['pg1', { id: 'pg1', sha256: H('1'), printed_page: 12 }]]) });
        const avant = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
        const zoneP = zoneDe(pP)?.closest('section');
        const original = [...pP.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Original');
        eq([avant(pP.querySelector('[data-role="emplacement-photo-plat"]'), pP.querySelector('.card.sage')), avant(pP.querySelector('.recipe-body'), zoneP), avant(zoneP, original), zoneP?.querySelector('h2')?.textContent],
          [true, true, true, 'Photo du plat'], 'places : l’emplacement de tête avant la carte des contrôles ; la section « Photo du plat » après .recipe-body et avant « Original »');
        eq([zoneP.querySelectorAll('img').length, !!original?.contains(zoneP), textesDirects(pP)], [0, false, []], 'deux zones distinctes (I-6) : aucune img dans la zone, la zone hors d’« Original » ; aucun nœud texte direct sous la racine');

        // D-F8, D-F5 / R-F-3
        const jpeg = await imageTest('plat.jpg', '#c63', 640, 480); const shaJ = await sha256Hex(jpeg);
        await repo.putFile(shaJ, jpeg, { mime: 'image/jpeg', origin: 'device' });
        await mettre(fiche('rc_ref', { availability: 'reference_only', current_version_id: null, printed_page: 12 }), fiche('rc_sig', { availability: 'reference_only', current_version_id: null, source_url: 'https://site.test/r' }),
          fiche('rc_nov', { availability: 'reference_only', current_version_id: null, photo_sha256: shaJ, photo_origin: 'image' }), fiche('rc_ia', { origine: 'ia' }));
        await versions(version('rc_ia'));
        const pRef = await monter('rc_ref'); const pSig = await monter('rc_sig'); const pNov = await monter('rc_nov'); const pIa = await monter('rc_ia');
        eq([zoneDe(pRef), zoneDe(pSig), zoneDe(pNov), imgTete(pNov)?.getAttribute('src')?.startsWith('blob:'), textesDirects(pNov)], [null, null, null, true, []], 'D-F8 : référence et signet sans version → aucune zone ; fiche sans version avec pointeur et octets → l’image en tête, aucune zone');
        eq([!!zoneDe(pIa), pIa.querySelector('[data-role="photo-web-etat"]'), appelsImage.length, reseau], [true, null, 0, 0], 'D-F5 / R-F-3 : une fiche origine ia avec version → zone présente, aucun candidat, aucun POST');

        // I-F11 / S-5 : monter une fiche au cas 5 (reçue par la synchronisation, puis restaurée d'une archive) → zéro appel
        await db.mutate({ puts: { recipes: [fiche('rc_c5', { source_url: 'https://site.test/r5', photo_source_url: 'https://cdn.test/5.png' })], recipe_versions: [version('rc_c5')] }, origin: 'remote' });
        await withDatabase(async (source) => {
          await source.mutate({ puts: { recipes: [fiche('rc_c5b', { source_url: 'https://site.test/r6', photo_source_url: 'https://cdn.test/6.png' })], recipe_versions: [version('rc_c5b')] }, origin: 'device' });
          const inspection = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
          await applyArchive(db, inspection, { mode: 'merge' });
        });
        // Un FAIT, jamais un délai : un rapatriement lancé par le montage poserait son vol de façon synchrone ; sa descente éventuelle est ATTENDUE.
        const p5 = await monter('rc_c5'); const volC5 = PP.recuperationEnCours('rc_c5');
        const p5b = await monter('rc_c5b'); const volC5b = PP.recuperationEnCours('rc_c5b');
        await PP.attendreRecuperation('rc_c5'); await PP.attendreRecuperation('rc_c5b');
        eq([volC5, volC5b, appelsImage.length, reseau, zoneDe(p5)?.textContent.includes('Photo du plat non récupérée.'), zoneDe(p5b)?.textContent.includes('Photo du plat non récupérée.')], [false, false, 0, 0, true, true],
          'I-F11 : une fiche au cas 5 reçue (origine remote) puis restaurée d’une archive → aucun vol posé, zéro appel au montage (descente éventuelle attendue) ; la zone dit « Photo du plat non récupérée. »');

        // « Choisir une image », « Photographier »
        await mettre(fiche('rc_g')); await versions(version('rc_g'));
        const img = await imageTest('plat.jpg', '#c63', 800, 600);
        aChoisir.push([img]); choix.length = 0; dits.length = 0;
        const pG = await monter('rc_g');
        bouton(zoneDe(pG), 'Choisir une image').click();
        await attendre(async () => !!imgTete(pG) && !!(await db.get('recipes', 'rc_g')).photo_sha256, 'photo posée et rendue');
        const attendue = await sha256Hex(await preparerPhotoLocale(img));
        const rcG = await db.get('recipes', 'rc_g'); const ligneG = await db.get('files', attendue);
        eq([choix, rcG.photo_sha256, rcG.photo_origin, rcG.photo_source_url, ligneG?.mime, Object.hasOwn(ligneG || {}, 'original_filename'), dits],
          [[{ accept: 'image/*', multiple: false }], attendue, 'image', null, 'image/jpeg', false, ['Photo du plat enregistrée.']],
          '« Choisir une image » : pickFiles({ accept: image/*, multiple: false }) exact ; files reçoit le JPEG ré-encodé, sans original_filename ; recipes { photo_sha256, image, photo_source_url null } ; toast « Photo du plat enregistrée. »');
        eq([imgTete(pG).getAttribute('src').startsWith('blob:'), imgTete(pG).getAttribute('alt'), etiquettes(zoneDe(pG))], [true, 'Photo du plat', ['Photographier', 'Choisir une image', 'Retirer']], '« Choisir une image » : l’image en tête (blob:, alt « Photo du plat »), zone cas 2');
        await mettre(fiche('rc_ph')); await versions(version('rc_ph'));
        aChoisir.push([await imageTest('ph.jpg', '#36c', 640, 480)]); choix.length = 0;
        const pPh = await monter('rc_ph');
        bouton(zoneDe(pPh), 'Photographier').click();
        await attendre(async () => (await db.get('recipes', 'rc_ph')).photo_origin === 'photo', 'photo prise');
        eq(choix, [{ accept: 'image/*', multiple: false, capture: 'environment' }], '« Photographier » : pickFiles({ accept: image/*, multiple: false, capture: environment }) exact ; photo_origin photo');

        // « Choisir une image » sur une photo en place : nouveau sha256, ancienne ligne files gardée, ancienne URL révoquée APRÈS le remplacement
        const ancienneUrl = imgTete(pG).getAttribute('src'); const ancienSha = rcG.photo_sha256;
        const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
        URL.revokeObjectURL = (u) => { revoquees.push({ u, encore: [...document.querySelectorAll('img')].some((i) => i.getAttribute('src') === u) }); return vraiRevoke.call(URL, u); };
        try {
          aChoisir.push([await imageTest('autre.jpg', '#6a3', 700, 500)]);
          bouton(zoneDe(pG), 'Choisir une image').click();
          await attendre(async () => (await db.get('recipes', 'rc_g')).photo_sha256 !== ancienSha && !!imgTete(pG), 'photo remplacée et redessinée');
          await tick();
        } finally { URL.revokeObjectURL = vraiRevoke; }
        const rev = revoquees.find((x) => x.u === ancienneUrl);
        eq([!!(await db.get('files', ancienSha))?.blob, !!rev, rev?.encore], [true, true, false], '« Choisir une image » sur une photo en place : l’ancienne ligne files reste ; l’ancienne URL blob: est révoquée APRÈS le remplacement (plus dans le document)');

        // Remplaçable à la main depuis une photo WEB (D-F14, B-10) ; légende (D-F11)
        const jpegW = await imageTest('web.jpg', '#a33', 640, 480); const shaW = await sha256Hex(jpegW);
        await repo.putFile(shaW, jpegW, { mime: 'image/jpeg', origin: 'device' });
        await mettre(fiche('rc_w', { source_url: 'https://recettes.test/x', photo_sha256: shaW, photo_origin: 'web', photo_source_url: 'https://cdn.test/w.jpg' })); await versions(version('rc_w'));
        const pW = await monter('rc_w');
        eq([pW.querySelector('[data-role="legende-photo-plat"]')?.textContent, pW.querySelector('figcaption.muted')?.dataset.role, pW.textContent.includes('cdn.test')], ['Image de la page recettes.test', 'legende-photo-plat', false], 'photo web : figcaption.muted « Image de la page {hote} » — hôte RECALCULÉ depuis source_url, jamais celui de photo_source_url (cdn.test)');
        aChoisir.push([await imageTest('mienne.jpg', '#3a3', 640, 480)]);
        bouton(zoneDe(pW), 'Choisir une image').click();
        await attendre(async () => (await db.get('recipes', 'rc_w')).photo_origin === 'image' && !pW.querySelector('[data-role="legende-photo-plat"]'), 'photo de la personne posée, légende retirée');
        const rcW = await db.get('recipes', 'rc_w');
        eq([rcW.photo_origin, rcW.photo_source_url, PW.candidatPhotoWeb(rcW, 'https://cdn.test/w.jpg')], ['image', null, null], 'remplaçable à la main depuis une photo WEB : image, photo_source_url null ; la même page relue n’aurait plus de candidat (P-12 : le parcours complet en tâche 5)');
        await mettre(fiche('rc_l1', { source_url: 'pas une adresse', photo_sha256: shaW, photo_origin: 'web', photo_source_url: 'https://cdn.test/l.jpg' }), fiche('rc_l2', { source_url: 'https://recettes.test/y', photo_sha256: shaW, photo_origin: 'image', photo_source_url: null }));
        await versions(version('rc_l1'), version('rc_l2'));
        const pL1 = await monter('rc_l1'); const pL2 = await monter('rc_l2');
        eq([pL1.querySelector('[data-role="legende-photo-plat"]')?.textContent, pL2.querySelector('[data-role="legende-photo-plat"]'), pL1.textContent.includes('cdn.test')], ['Image de la page web', null, false], 'légende : source_url illisible → « Image de la page web » ; photo image → aucune légende ; jamais l’hôte de photo_source_url');

        // « Retirer » — sur une photo WEB : les trois champs sont posés, provenance comprise (un « Retirer » qui garderait photo_source_url rougit ICI ;
        // une fiche dont photo_source_url vaut déjà null ne le verrait pas)
        await mettre(fiche('rc_rw', { source_url: 'https://recettes.test/rw', photo_sha256: shaW, photo_origin: 'web', photo_source_url: 'https://cdn.test/rw.jpg' })); await versions(version('rc_rw'));
        const pRw = await monter('rc_rw');
        dits.length = 0;
        const retirer = bouton(zoneDe(pRw), 'Retirer');
        eq([retirer?.getAttribute('aria-label'), !!imgTete(pRw)], ['Retirer la photo du plat', true], '« Retirer » porte le nom accessible « Retirer la photo du plat » ; la photo web est en tête');
        retirer.click();
        await attendre(async () => (await db.get('recipes', 'rc_rw')).photo_sha256 === null && !pRw.querySelector('[data-role="photo-plat"]'), 'photo retirée');
        const rcR = await db.get('recipes', 'rc_rw');
        eq([rcR.photo_sha256, rcR.photo_origin, rcR.photo_source_url, dits, !!(await db.get('files', shaW))?.blob, zoneDe(pRw).textContent.includes(AJOUTE)], [null, null, null, ['Photo du plat retirée.'], true, true],
          '« Retirer » d’une photo web : trois champs à null (provenance comprise), toast « Photo du plat retirée. », les octets restent, en-tête vide (aucune figure), zone cas 1');

        // Un PDF ; fiche relue (C4) ; fiche supprimée
        dits.length = 0;
        await mettre(fiche('rc_pdf')); await versions(version('rc_pdf'));
        const pPdf = await monter('rc_pdf'); const nFiles = await db.count('files');
        aChoisir.push([new File(['%PDF-1.4 pas une image'], 'menu.pdf', { type: 'application/pdf' })]);
        bouton(zoneDe(pPdf), 'Choisir une image').click();
        await attendre(() => dits.length === 1, 'toast du PDF');
        eq([dits, (await db.get('recipes', 'rc_pdf')).photo_sha256 ?? null, await db.count('files')], [['Cette image ne peut pas être lue ici. Essaie une autre photo.'], null, nFiles], 'un PDF : toast « Cette image ne peut pas être lue ici. … », rien d’écrit');
        await mettre(fiche('rc_c4')); await versions(version('rc_c4'));
        const pC4 = await monter('rc_c4');
        await mettre({ ...(await db.get('recipes', 'rc_c4')), original_title: 'Titre changé ailleurs' });
        aChoisir.push([await imageTest('c4.jpg', '#a0a', 640, 480)]);
        bouton(zoneDe(pC4), 'Choisir une image').click();
        await attendre(async () => !!(await db.get('recipes', 'rc_c4')).photo_sha256, 'photo posée (C4)');
        eq((await db.get('recipes', 'rc_c4')).original_title, 'Titre changé ailleurs', 'relecture C4 : la fiche écrite porte le titre changé en base entre le rendu et le geste, ET la photo');
        dits.length = 0;
        await mettre(fiche('rc_sup')); await versions(version('rc_sup'));
        const pSup = await monter('rc_sup');
        await db.mutate({ deletes: { recipes: ['rc_sup'] }, origin: 'device' });
        const nF = await db.count('files');
        aChoisir.push([await imageTest('sup.jpg', '#0aa', 640, 480)]);
        bouton(zoneDe(pSup), 'Choisir une image').click();
        await attendre(() => dits.length === 1, 'toast fiche supprimée');
        eq([dits, await db.get('recipes', 'rc_sup'), await db.count('files')], [['Recette introuvable.'], undefined, nF], 'fiche supprimée entre le rendu et le geste : « Recette introuvable. », aucune fiche recréée, aucune ligne files neuve (relecture AVANT putFile)');

        // D-F15 : un geste ne redessine que la photo (une scène vide : setServings lit document.getElementById)
        scene.replaceChildren();
        await mettre(fiche('rc_d15')); await versions(version('rc_d15'));
        const pD = await monter('rc_d15');
        const plus = [...pD.querySelectorAll('button')].find((b) => b.textContent === '+');
        plus.click(); plus.click();
        // Relevé APRÈS les « + » : un drawBody() remplacerait les enfants de .recipe-body (le nœud lui-même reste : comparer lui ne prouverait rien).
        const enfantAvant = pD.querySelector('.recipe-body')?.firstElementChild ?? null;
        let rafraichis = 0; const compter = () => { rafraichis += 1; };
        window.addEventListener('cuisineos:refresh', compter);
        try {
          aChoisir.push([await imageTest('d15.jpg', '#aa0', 640, 480)]);
          bouton(zoneDe(pD), 'Choisir une image').click();
          await attendre(() => !!imgTete(pD), 'photo posée (D-F15)');
        } finally { window.removeEventListener('cuisineos:refresh', compter); }
        eq([rafraichis, pD.querySelector('#servings-val')?.textContent, enfantAvant !== null && pD.querySelector('.recipe-body')?.firstElementChild === enfantAvant && enfantAvant.isConnected], [0, '6', true],
          'D-F15 : aucun cuisineos:refresh, les portions restent 6, le corps de la fiche n’est pas redessiné (son premier enfant est le même nœud ; P-19)');

        // Pendant une écriture : boutons éteints ; la garde occupe empêche un second pickFiles
        await mettre(fiche('rc_b')); await versions(version('rc_b'));
        let lever; const barriere = new Promise((r) => { lever = r; });
        const repoB = { get: (...a) => repo.get(...a), getFile: (...a) => repo.getFile(...a), save: (...a) => repo.save(...a), putFile: async (...a) => { await barriere; return repo.putFile(...a); }, db: repo.db };
        let picks = 0; const imgB = await imageTest('b.jpg', '#a5a', 640, 480);
        const m = await PP.monterPhotoPlat(await db.get('recipes', 'rc_b'), { sync }, { repo: repoB, pickFiles: async () => { picks += 1; return [imgB]; }, toast: () => {}, enLigne: () => true });
        scene.append(m.entete, m.zone);
        const ecritures = async () => (await db.getAll('outbox')).filter((e) => e.store === 'recipes' && e.id === 'rc_b').length;
        const avantB = await ecritures();
        const enCours = m.gestes.choisir();
        await attendre(() => { const bs = [...m.zone.querySelectorAll('button')]; return bs.length > 0 && bs.every((b) => b.disabled); }, 'boutons éteints pendant l’écriture');
        await m.gestes.choisir(); // appel DIRECT : un clic sur un bouton éteint ne déclencherait rien, garde ou pas
        eq(picks, 1, 'pendant une écriture : la garde occupe — pickFiles n’est pas rappelé');
        lever(); await enCours;
        eq((await ecritures()) - avantB, 1, 'pendant une écriture : la barrière levée, UNE écriture recipes');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));
```

- [ ] **Step 5 : tests rouges — `tests/photo-plat.js`, bloc « pointeur sans octets » (moteur factice et `contexteFichiers` du lot G) :**

```js
    await run('pointeur sans octets : l’état du fichier EN TÊTE, jamais dans la zone (§ 4.1.4, I-F10)', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try {
        const R = (sur = {}) => ({ sha256: H('e'), size: 400, mime: 'image/jpeg', quality: 'reduite', uploaded_at: DATE, owner: 'u1', ...sur });
        const jpeg = await imageTest('d.jpg', '#c63', 320, 240);
        await db.mutate({ puts: { files: [
          { sha256: H('3'), mime: 'image/jpeg', size: jpeg.size, updated_at: DATE, remote: R({ sha256: H('3'), size: jpeg.size }) },
          { sha256: H('4'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('4'), size: 5, owner: 'u2' }) },
          { sha256: H('6'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('6'), size: 5 }) },
        ] }, origin: 'remote' });
        const appels = [];
        const moteur = { telecharger: async (shas) => { appels.push(shas); const ligne = await db.get('files', H('3')); await db.mutate({ puts: { files: [{ ...ligne, blob: jpeg }] }, origin: 'remote' }); return { recus: 1, erreurs: 0, erreur: null }; },
          reessayerFichier: async () => ({ recus: 0, erreurs: 0, erreur: null }), onEtat: () => () => {} };
        await db.mutate({ puts: { recipes: [fiche('rc_d', { photo_sha256: H('3'), photo_origin: 'image' }), fiche('rc_a', { photo_sha256: H('4'), photo_origin: 'image' }), fiche('rc_s', { photo_sha256: H('6'), photo_origin: 'image' }), fiche('rc_n', { photo_sha256: H('5'), photo_origin: 'image' })],
          recipe_versions: [version('rc_d'), version('rc_a'), version('rc_s'), version('rc_n')] }, origin: 'device' });
        const monter = async (id, sync) => { const p = await renderRecipe({ id }, {}, await ctxPour(repo, db, { sync })); scene.append(p); return p; };
        const tete = (p) => p.querySelector('[data-role="photo-plat"]');
        const zone = (p) => p.querySelector('[data-role="zone-photo-plat"]');
        const telecharger = (n) => [...(n?.querySelectorAll('button') || [])].filter((b) => b.textContent === 'Télécharger');
        const pD = await monter('rc_d', { user: { id: 'u1' }, moteur });
        eq([telecharger(tete(pD)).length, telecharger(zone(pD)).length, etiquettes(zone(pD))], [1, 0, ['Photographier', 'Choisir une image', 'Retirer']], 'distant + compte : EXACTEMENT un « Télécharger » en tête, aucun dans la zone (cas 3 : les boutons du cas 2)');
        let rafraichis = 0; const compter = () => { rafraichis += 1; };
        window.addEventListener('cuisineos:refresh', compter);
        // Le conteneur de la zone n'est JAMAIS remplacé (seuls ses enfants le sont) : c'est son contenu qui dirait un redessin.
        const contenuAvant = zone(pD)?.firstElementChild ?? null;
        try {
          telecharger(tete(pD))[0].click();
          await attendre(() => !!tete(pD)?.querySelector('img'), 'image en tête après « Télécharger »');
        } finally { window.removeEventListener('cuisineos:refresh', compter); }
        eq([appels, rafraichis, contenuAvant !== null && zone(pD)?.firstElementChild === contenuAvant, telecharger(zone(pD)).length], [[[H('3')]], 0, true, 0],
          '« Télécharger » (moteur factice qui écrit le blob) → l’image en tête, sans refresh(), la zone NON redessinée (son contenu est le même nœud)');
        const pA = await monter('rc_a', { user: { id: 'u1' }, moteur });
        eq([tete(pA)?.textContent.includes('Pas encore envoyée par l’appareil qui l’a prise'), telecharger(tete(pA)).length, telecharger(zone(pA)).length], [true, 0, 0], '`absent` (copie d’un autre compte, R-G-2) : le texte de G en tête, aucun bouton');
        await db.put('sync_state', { key: 'user_id', value: 'u1' });
        const pS = await monter('rc_s', { user: null, moteur: null });
        eq([tete(pS)?.textContent.includes('Connecte-toi pour la télécharger'), telecharger(zone(pS)).length], [true, 0], 'sans compte : « Connecte-toi pour la télécharger » en tête');
        const pN = await monter('rc_n', { user: { id: 'u1' }, moteur });
        eq([tete(pN), !!zone(pN)], [null, true], 'aucune ligne files pour le pointeur → rien en tête (lot A, l. 1316), la zone reste');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));
```

- [ ] **Step 6 : tests rouges — `tests/photo-plat.js`, bloc « rapatriement » (Review Focus 1 et 5 ; P-13) :**

```js
    await run('rapatriement : rapatrierPhotoWeb et la zone (§ 4.3 point 3, I-F1, I-F5, D-F17, D-F18)', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const PW = await import('../src/domain/photo-web.js');
      const P = await import('../src/domain/passerelle.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      PP.reinitialiserPhotoPlat();
      const URL_ASSISTANT = P.urlAssistant();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      const vraiErreur = console.error; const journal = [];
      console.error = (...a) => { journal.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
      let enLigneTest = true;
      try {
        const png = await octetsDe(await imageTest('p.png', '#3a7', 800, 600, 'image/png'));
        const petite = await octetsDe(await imageTest('s.png', '#3a7', 150, 150, 'image/png'));
        // Rejeu (D-2) : trois images DISTINCTES pour les cas qui comptent les lignes files (c1, c2, c4) — files est adressé par l'empreinte :
        // la même image qu'un cas précédent ne poserait jamais de ligne neuve, et le compte ne dirait rien.
        const [pngC1, pngC2, pngC4] = await Promise.all(['#a13', '#1a3', '#13a'].map(async (c, i) => octetsDe(await imageTest(`c${i}.png`, c, 800, 600, 'image/png'))));
        const corps200 = (u8 = png, type = 'image/png') => ({ type, taille: u8.length, url_finale: 'https://cdn.test/p.png', octets: base64De(u8) });
        // Le fetch factice du bloc : chaque adresse appelée est gardée (S-8) ; la réponse vient d'une file — [statut, corps], ou 'suspendre' (rendue par
        // un `suspendus.shift()(statut, corps)`) ; file vide = une PNG 800 × 600.
        const tous = []; const corpsEnvoyes = []; const file = []; const suspendus = [];
        const fetchFaux = (url, options) => new Promise((resolve, reject) => {
          tous.push(url); corpsEnvoyes.push(JSON.parse(options.body));
          const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
          if (options?.signal?.aborted) { abandon(); return; }
          options?.signal?.addEventListener('abort', abandon, { once: true });
          const prochaine = file.length ? file.shift() : [200, corps200()];
          if (prochaine === 'suspendre') { suspendus.push((st, c) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(st, c)); }); return; }
          resolve(reponse(prochaine[0], prochaine[1]));
        });
        const SESSION = { access_token: 'jeton-rapatriement-sentinelle', user: { id: 'u1' } };
        const ctxSync = (session = SESSION, user = { id: 'u1' }) => ({ sync: { user, auth: { jeton: async () => session } } });
        const opts = (over = {}) => ({ ctx: ctxSync(), repo, fetch: fetchFaux, enLigne: () => true, ...over });
        const poser = (...rows) => db.mutate({ puts: { recipes: rows }, origin: 'device' });
        const resultats = [];
        const garde = (r) => { resultats.push(r); return r; };

        // 1. Une fiche à photo_source_url sans photo
        await poser(fiche('rc_r1', { photo_source_url: 'https://cdn.test/1.png' }));
        const r1 = garde(await PP.rapatrierPhotoWeb('rc_r1', opts()));
        const f1 = await db.get('recipes', 'rc_r1'); const l1 = await db.get('files', r1.sha256);
        eq([r1.issue, corpsEnvoyes.at(-1), f1.photo_origin, f1.photo_source_url, f1.photo_sha256 === r1.sha256, l1?.mime, l1?.blob?.type],
          ['ok', { outil: 'image-web', corps: { url: 'https://cdn.test/1.png' } }, 'web', 'https://cdn.test/1.png', true, 'image/jpeg', 'image/jpeg'],
          'fiche à photo_source_url sans photo → un POST image-web avec l’adresse de la fiche relue ; files reçoit le JPEG ré-encodé ; recipes { photo_sha256, web }, photo_source_url conservé ; ok');

        // 2. Deux appels entrelacés sur la même fiche → UN POST ; deux fiches → deux POST
        await poser(fiche('rc_r2', { photo_source_url: 'https://cdn.test/2.png' }), fiche('rc_r3', { photo_source_url: 'https://cdn.test/3.png' }));
        const n0 = corpsEnvoyes.length;
        file.push('suspendre', 'suspendre');
        const p1 = PP.rapatrierPhotoWeb('rc_r2', opts()); const volSansAwait = PP.recuperationEnCours('rc_r2'); // lu AVANT tout await : le vol est déjà posé
        const p2 = PP.rapatrierPhotoWeb('rc_r2', opts()); const p3 = PP.rapatrierPhotoWeb('rc_r3', opts());
        eq([volSansAwait, garde(await p2), PP.recuperationEnCours('rc_r2')], [true, { issue: 'refuse', raison: 'vol_tenu' }, true],
          'deux appels entrelacés sur la même fiche : le vol est posé AVANT tout await (lu sans attendre), le second est refusé vol_tenu tout de suite');
        await attendre(() => suspendus.length === 2, 'deux POST, un par fiche');
        for (const fin of suspendus.splice(0)) fin(200, corps200());
        eq([garde(await p1).issue, garde(await p3).issue, corpsEnvoyes.slice(n0).map((c) => c.corps.url).sort()], ['ok', 'ok', ['https://cdn.test/2.png', 'https://cdn.test/3.png']], 'UN POST pour la fiche doublée ; deux fiches → deux POST en parallèle');

        // 3. Refus avant l'appel : zéro POST
        await poser(fiche('rc_m', { photo_sha256: H('a'), photo_origin: 'image', photo_source_url: 'https://cdn.test/m.png' }), fiche('rc_d', { photo_sha256: H('b'), photo_origin: 'web', photo_source_url: 'https://cdn.test/d.png' }),
          fiche('rc_dn', { photo_sha256: H('c'), photo_origin: 'web', photo_source_url: 'HTTPS://CDN.TEST:443/dn.png' }), fiche('rc_h', { photo_source_url: 'http://cdn.test/h.png' }), fiche('rc_o', { photo_source_url: 'https://cdn.test/o.png' }));
        const n1 = corpsEnvoyes.length;
        const refus = [garde(await PP.rapatrierPhotoWeb('rc_m', opts())), garde(await PP.rapatrierPhotoWeb('rc_d', opts())), garde(await PP.rapatrierPhotoWeb('rc_dn', opts({ candidat: 'https://cdn.test/dn.png' }))),
          garde(await PP.rapatrierPhotoWeb('rc_h', opts())), garde(await PP.rapatrierPhotoWeb('rc_o', opts({ enLigne: () => false }))), garde(await PP.rapatrierPhotoWeb('rc_o', opts({ ctx: ctxSync(null) })))];
        eq([refus.map((x) => x.raison), corpsEnvoyes.length - n1], [['photo_manuelle', 'deja_la', 'deja_la', 'adresse', 'hors_ligne', 'non_connecte'], 0],
          'photo de la personne → photo_manuelle ; même image web (même sous la forme HTTPS://…:443, S-10) → deja_la ; http → adresse ; hors ligne ; sans session → non_connecte ; zéro POST');

        // 4. S-10 : la garde compare la fiche relue à la fiche de DÉPART (normalisées), jamais à l'adresse tentée
        await poser(fiche('rc_n', { photo_source_url: 'HTTPS://A.TEST:443/n.png' }));
        const rn = garde(await PP.rapatrierPhotoWeb('rc_n', opts()));
        eq([rn.issue, corpsEnvoyes.at(-1).corps.url, (await db.get('recipes', 'rc_n')).photo_source_url], ['ok', 'https://a.test/n.png', 'https://a.test/n.png'], 'S-10 : une fiche à HTTPS://A.TEST:443/… aboutit (jamais fiche_changee) ; la provenance écrite est l’adresse normalisée');
        // 4 bis. S-10, les deux règles de la garde départ/relue : la MÊME adresse réécrite sous sa forme normalisée PENDANT la descente → inchangée (ok ;
        //        un `!==` brut rougit) ; une adresse refusée DES DEUX CÔTÉS (http) avec un candidat https → inchangée (ok, jamais fiche_changee : deux
        //        adresses refusées comptent comme égales ; une comparaison par memeAdresseImage seule rougit).
        await poser(fiche('rc_n2', { photo_source_url: 'HTTPS://A.TEST:443/n2.png' }));
        file.push('suspendre');
        const pn2 = PP.rapatrierPhotoWeb('rc_n2', opts());
        await attendre(() => suspendus.length === 1, 'POST parti (n2)');
        await poser({ ...(await db.get('recipes', 'rc_n2')), photo_source_url: 'https://a.test/n2.png' });
        suspendus.shift()(200, corps200());
        const rn2 = garde(await pn2);
        await poser(fiche('rc_hx', { photo_source_url: 'http://cdn.test/x.png' }));
        const rhx = garde(await PP.rapatrierPhotoWeb('rc_hx', opts({ candidat: 'https://cdn.test/y.png' })));
        eq([rn2.issue, (await db.get('recipes', 'rc_n2')).photo_source_url, rhx.issue, (await db.get('recipes', 'rc_hx')).photo_source_url], ['ok', 'https://a.test/n2.png', 'ok', 'https://cdn.test/y.png'],
          'S-10 : la même adresse sous une autre forme pendant la descente → ok ; refusée des deux côtés (http) avec un candidat https → ok, la provenance écrite est le candidat');

        // 5. Fiche changée pendant la descente (Review Focus 1)
        await poser(fiche('rc_c1', { photo_source_url: 'https://cdn.test/c1.png' }));
        const nf1 = await db.count('files');
        file.push('suspendre');
        const pc1 = PP.rapatrierPhotoWeb('rc_c1', opts());
        await attendre(() => suspendus.length === 1, 'POST parti (c1)');
        await poser({ ...(await db.get('recipes', 'rc_c1')), photo_sha256: H('c'), photo_origin: 'image', photo_source_url: null });
        suspendus.shift()(200, corps200(pngC1));
        const rc1 = garde(await pc1); const lu1 = await db.get('recipes', 'rc_c1');
        eq([rc1, lu1.photo_sha256, lu1.photo_origin, await db.count('files')], [{ issue: 'refuse', raison: 'fiche_changee' }, H('c'), 'image', nf1], 'photo choisie entre le POST et l’écriture → fiche_changee, la photo de la personne intacte, AUCUNE ligne files neuve (garde AVANT putFile)');
        await poser(fiche('rc_c2', { photo_source_url: 'https://cdn.test/c2.png' }));
        let lever; const barriere = new Promise((r) => { lever = r; }); let entre; const dansPutFile = new Promise((r) => { entre = r; });
        const repoB = { get: (...a) => repo.get(...a), getFile: (...a) => repo.getFile(...a), save: (...a) => repo.save(...a), putFile: async (...a) => { entre(); await barriere; return repo.putFile(...a); }, db: repo.db };
        const nf2 = await db.count('files');
        file.push([200, corps200(pngC2)]);
        const pc2 = PP.rapatrierPhotoWeb('rc_c2', opts({ repo: repoB }));
        await dansPutFile;
        await poser({ ...(await db.get('recipes', 'rc_c2')), photo_sha256: H('d'), photo_origin: 'image', photo_source_url: null });
        lever();
        eq([garde(await pc2).raison, (await db.get('recipes', 'rc_c2')).photo_sha256, await db.count('files')], ['fiche_changee', H('d'), nf2 + 1], 'photo choisie PENDANT putFile → fiche_changee, la photo de la personne intacte ; la ligne files du JPEG reste (orphelin L5)');
        await poser(fiche('rc_c3', { photo_source_url: 'https://cdn.test/c3.png' }));
        file.push('suspendre');
        const pc3 = PP.rapatrierPhotoWeb('rc_c3', opts());
        await attendre(() => suspendus.length === 1, 'POST parti (c3)');
        eq((await PP.retirerPhotoPlat('rc_c3', { repo })).issue, 'ok', '« Ne pas récupérer » pendant la descente');
        suspendus.shift()(200, corps200());
        eq([garde(await pc3).raison, (await db.get('recipes', 'rc_c3')).photo_sha256], ['fiche_changee', null], '« Retirer » ou « Ne pas récupérer » pendant la descente → fiche_changee, rien d’écrit');
        await poser(fiche('rc_c4', { photo_source_url: 'https://cdn.test/c4.png' }));
        const nf4 = await db.count('files');
        file.push('suspendre');
        const pc4 = PP.rapatrierPhotoWeb('rc_c4', opts());
        await attendre(() => suspendus.length === 1, 'POST parti (c4)');
        await db.mutate({ deletes: { recipes: ['rc_c4'] }, origin: 'device' });
        suspendus.shift()(200, corps200(pngC4));
        eq([garde(await pc4).raison, await db.get('recipes', 'rc_c4'), await db.count('files')], ['fiche_absente', undefined, nf4], 'fiche supprimée pendant la descente → fiche_absente, rien ressuscité, aucune ligne files neuve');

        // 6. Relecture dont l'image a changé (D-F18, B-4)
        const jpegA = await imageTest('a.jpg', '#a00', 400, 300); const shaA = await sha256Hex(jpegA);
        await repo.putFile(shaA, jpegA, { mime: 'image/jpeg', origin: 'device' });
        await poser(fiche('rc_b4', { photo_sha256: shaA, photo_origin: 'web', photo_source_url: 'https://cdn.test/A.png' }));
        file.push([502, { erreur: 'inaccessible' }]);
        const echecB = garde(await PP.rapatrierPhotoWeb('rc_b4', opts({ candidat: 'https://cdn.test/B.png' })));
        const apresEchec = await db.get('recipes', 'rc_b4');
        eq([echecB, apresEchec.photo_sha256, apresEchec.photo_source_url, apresEchec.photo_origin, PP.etatZonePlat(apresEchec, { present: true }).web], [{ issue: 'echec', raison: 'inaccessible' }, shaA, 'https://cdn.test/A.png', 'web', null],
          'relecture dont l’image a changé, échec → la photo A et SA provenance intactes, zone cas 2');
        const okB = garde(await PP.rapatrierPhotoWeb('rc_b4', opts({ candidat: 'https://cdn.test/B.png' })));
        const apresOk = await db.get('recipes', 'rc_b4');
        eq([okB.issue, apresOk.photo_sha256 === okB.sha256, apresOk.photo_sha256 !== shaA, apresOk.photo_origin, apresOk.photo_source_url], ['ok', true, true, 'web', 'https://cdn.test/B.png'], 'relecture dont l’image a changé, réussite → les trois champs ENSEMBLE');

        // 7. Échecs du serveur et du mur distant
        for (const [statut, corps, raison] of [[502, { erreur: 'inaccessible' }, 'inaccessible'], [422, { erreur: 'pas_une_image' }, 'pas_une_image'], [413, { erreur: 'image_trop_lourde' }, 'image_trop_lourde'], [429, { erreur: 'quota', quota: 60 }, 'quota']]) {
          const id = 'rc_e_' + raison;
          await poser(fiche(id, { photo_source_url: 'https://cdn.test/e.png' }));
          file.push([statut, corps]); journal.length = 0;
          const r = garde(await PP.rapatrierPhotoWeb(id, opts()));
          const f = await db.get('recipes', id);
          eq([r, f.photo_sha256 ?? null, f.photo_source_url, journal.some((l) => l.includes('photo_web.echec'))], [{ issue: 'echec', raison }, null, 'https://cdn.test/e.png', true], `échec serveur ${raison} → { echec, ${raison} }, logError photo_web.echec, fiche intacte`);
        }
        await poser(fiche('rc_deg', { photo_source_url: 'https://cdn.test/deg.png' }), fiche('rc_pt', { photo_source_url: 'https://cdn.test/pt.png' }));
        file.push([200, corps200(png, 'image/jpeg')], [200, corps200(petite)]);
        eq([garde(await PP.rapatrierPhotoWeb('rc_deg', opts())), (await db.get('recipes', 'rc_deg')).photo_sha256 ?? null], [{ issue: 'echec', raison: 'indecodable' }, null], 'image reçue déguisée (PNG annoncée jpeg) → echec(indecodable), rien d’écrit (le mur DISTANT)');
        eq([garde(await PP.rapatrierPhotoWeb('rc_pt', opts())), (await db.get('recipes', 'rc_pt')).photo_sha256 ?? null], [{ issue: 'echec', raison: 'trop_petite' }, null], 'une PNG 150 × 150 → echec(trop_petite), rien d’écrit');

        // 8. La zone montée
        const dits = []; const chosen = [];
        const monter = async (id, ctx = ctxSync()) => { const p = await renderRecipe({ id }, {}, await ctxPour(repo, db, ctx), { pickFiles: async () => chosen.shift() || [], toast: (m) => dits.push(m), fetch: fetchFaux, enLigne: () => enLigneTest }); scene.append(p); return p; };
        const versionsPour = (...ids) => db.mutate({ puts: { recipe_versions: ids.map((id) => version(id)) }, origin: 'device' });
        const zoneDe = (p) => p.querySelector('[data-role="zone-photo-plat"]');
        const ligneWeb = (p) => zoneDe(p)?.querySelector('[data-role="photo-web-etat"]');
        const auto = (id, over = {}) => PP.rapatrierPhotoWeb(id, opts(over)); // le départ automatique (tape: false), comme enregistrerLecture (tâche 5)
        await poser(fiche('rc_z1', { photo_source_url: 'https://cdn.test/z1.png' })); await versionsPour('rc_z1');
        const pZ1 = await monter('rc_z1');
        file.push('suspendre');
        const pz1 = auto('rc_z1');
        await attendre(() => ligneWeb(pZ1)?.getAttribute('role') === 'status' && ligneWeb(pZ1)?.textContent === 'Récupération de la photo du plat…', '« Récupération… » pendant la descente');
        suspendus.shift()(200, corps200()); garde(await pz1);
        await attendre(() => !!pZ1.querySelector('[data-role="photo-plat"] img') && !ligneWeb(pZ1), 'l’image en tête après la descente');
        eq(dits, [], 'zone montée : « Récupération… » pendant (fetch suspendu), puis l’image en tête ; aucun toast');
        // rc_z2 à rc_z4 : le départ automatique FINIT AVANT le montage — le premier dessin lit l'échec gardé. (Monter d'abord puis attendre
        // « Réessayer » lirait le rendu d'AVANT la descente : la fiche est montée au cas 5, l'attente passerait aussitôt sur un DOM périmé.)
        await poser(fiche('rc_z2', { photo_source_url: 'https://cdn.test/z2.png' })); await versionsPour('rc_z2');
        file.push([502, { erreur: 'inaccessible' }]); garde(await auto('rc_z2'));
        const pZ2 = await monter('rc_z2');
        eq([ligneWeb(pZ2).textContent.includes('Photo du plat non récupérée.'), zoneDe(pZ2).querySelector('[data-role="raison-photo-web"]'), zoneDe(pZ2).querySelector('[data-role="cout-photo-web"]')?.textContent, !!zoneDe(pZ2).querySelector('[data-role="abandonner-photo-web"]')],
          [true, null, 'Un appel de plus, compté dans ton quota du jour.', true], 'échec au départ automatique : « non récupérée », « Réessayer », la ligne de coût, « Ne pas récupérer » — AUCUNE raison dite');
        const avantR = corpsEnvoyes.length;
        file.push([200, corps200()]);
        zoneDe(pZ2).querySelector('[data-role="reessayer-photo"]').click();
        await attendre(() => !!pZ2.querySelector('[data-role="photo-plat"] img'), '« Réessayer » → l’image');
        eq(corpsEnvoyes.length - avantR, 1, '« Réessayer » → UN POST, puis l’image');
        await poser(fiche('rc_z3', { photo_source_url: 'https://cdn.test/z3.png' })); await versionsPour('rc_z3');
        file.push([429, { erreur: 'quota', quota: 60 }]); garde(await auto('rc_z3'));
        const pZ3 = await monter('rc_z3');
        eq([!!zoneDe(pZ3)?.querySelector('[data-role="reessayer-photo"]'), zoneDe(pZ3)?.querySelector('[data-role="raison-photo-web"]')], [true, null],
          'départ automatique sur quota (fini avant le montage) → « Réessayer », aucun texte de raison (un échec automatique gardé avec tape: true rougit ici)');
        file.push([429, { erreur: 'quota', quota: 60 }]); dits.length = 0;
        zoneDe(pZ3).querySelector('[data-role="reessayer-photo"]').click();
        await attendre(() => !!zoneDe(pZ3)?.querySelector('[data-role="raison-photo-web"]'), 'raison dite après la tape');
        eq([zoneDe(pZ3).querySelector('[data-role="raison-photo-web"]').textContent, dits], ['Tu as atteint la limite du jour pour l’assistant (60 appels).', []], '« Réessayer » qui échoue sur quota → la zone dit la raison, aucun toast');
        await poser(fiche('rc_z4', { photo_source_url: 'https://cdn.test/z4.png' })); await versionsPour('rc_z4');
        file.push([422, { erreur: 'pas_une_image' }]); garde(await auto('rc_z4'));
        const pZ4 = await monter('rc_z4');
        eq([zoneDe(pZ4).querySelector('[data-role="raison-photo-web"]').textContent, zoneDe(pZ4).querySelector('[data-role="reessayer-photo"]')], ['L’image de cette page ne peut pas être utilisée.', null], 'départ automatique sur pas_une_image → la raison définitive, aucun « Réessayer »');
        await poser(fiche('rc_z5', { photo_source_url: 'https://cdn.test/z5.png' })); await versionsPour('rc_z5');
        const pZ5 = await monter('rc_z5');
        enLigneTest = false; window.dispatchEvent(new Event('offline'));
        try {
          await attendre(() => zoneDe(pZ5)?.querySelector('[data-role="reessayer-photo"]')?.disabled === true, '« Réessayer » éteint hors ligne');
          const avantH = corpsEnvoyes.length;
          zoneDe(pZ5).querySelector('[data-role="reessayer-photo"]').click(); await tick();
          eq([zoneDe(pZ5).textContent.includes('Tu es hors ligne.'), corpsEnvoyes.length - avantH], [true, 0], '« Réessayer » hors ligne → bouton éteint, « Tu es hors ligne. », zéro POST');
        } finally { enLigneTest = true; window.dispatchEvent(new Event('online')); }
        await poser(fiche('rc_z6', { photo_source_url: 'https://cdn.test/z6.png' })); await versionsPour('rc_z6');
        const pZ6 = await monter('rc_z6', ctxSync(null));
        const avantS = corpsEnvoyes.length;
        zoneDe(pZ6).querySelector('[data-role="reessayer-photo"]').click();
        await attendre(() => !!zoneDe(pZ6)?.querySelector('[data-role="raison-photo-web"]'), 'raison non_connecte dite');
        eq([corpsEnvoyes.length - avantS, zoneDe(pZ6).querySelector('[data-role="raison-photo-web"]').textContent, zoneDe(pZ6).textContent.split('Connecte-toi pour utiliser l’assistant.').length - 1], [0, 'Connecte-toi pour utiliser l’assistant.', 1],
          '« Réessayer » avec ctx.sync.user posé et une session nulle (P-13) → zéro POST, la zone dit « Connecte-toi pour utiliser l’assistant. » une seule fois');
        await poser(fiche('rc_z7', { photo_source_url: 'https://cdn.test/z7.png' })); await versionsPour('rc_z7');
        const pZ7 = await monter('rc_z7'); dits.length = 0;
        const avantA = corpsEnvoyes.length;
        zoneDe(pZ7).querySelector('[data-role="abandonner-photo-web"]').click();
        await attendre(() => !!zoneDe(pZ7)?.textContent.includes('Ajoute une photo du plat'), 'cas 1 après « Ne pas récupérer »');
        const f7 = await db.get('recipes', 'rc_z7');
        eq([f7.photo_sha256 ?? null, f7.photo_origin ?? null, f7.photo_source_url, corpsEnvoyes.length - avantA, dits], [null, null, null, 0, []], '« Ne pas récupérer » → les trois champs à null, zone cas 1, zéro POST, aucun toast');
        await poser(fiche('rc_z8', { photo_source_url: 'https://cdn.test/z8.png' })); await versionsPour('rc_z8');
        chosen.push([await imageTest('mienne.jpg', '#3a3', 640, 480)]);
        const pZ8 = await monter('rc_z8');
        file.push('suspendre');
        const pz8 = auto('rc_z8');
        await attendre(() => ligneWeb(pZ8)?.getAttribute('role') === 'status', 'descente en cours (z8)');
        bouton(zoneDe(pZ8), 'Choisir une image').click();
        await attendre(async () => (await db.get('recipes', 'rc_z8')).photo_origin === 'image', 'photo de la personne posée pendant la descente');
        suspendus.shift()(200, corps200());
        eq([garde(await pz8).raison, (await db.get('recipes', 'rc_z8')).photo_origin], ['fiche_changee', 'image'], 'photo choisie PENDANT la descente → la photo de la personne reste (I-F5)');

        eq([tous.length > 0, tous.every((u) => u === URL_ASSISTANT), reseau], [true, true, 0], 'S-8 / I-F3 : pendant tout le bloc, seul /functions/v1/assistant est appelé (jamais l’hôte de l’image)');
        eq(resultats.some((x) => JSON.stringify(x).includes('jeton-rapatriement-sentinelle')), false, 'le jeton n’est dans aucun résultat');
        ok(resultats.every((x) => x.issue === 'ok' || PW.RAISONS_PHOTO_WEB.includes(x.raison)), 'toute raison rendue ∈ RAISONS_PHOTO_WEB');
      } finally { console.error = vraiErreur; globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));

    await run('D-F16 : ★ Favori relit la fiche — une photo rapatriée depuis le rendu survit', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try {
        const png = await octetsDe(await imageTest('f.png', '#3a7', 800, 600, 'image/png'));
        const fetchImage = async () => reponse(200, { type: 'image/png', taille: png.length, url_finale: 'https://cdn.test/fav.png', octets: base64De(png) });
        const sync = { user: { id: 'u1' }, auth: { jeton: async () => ({ access_token: 'jeton-favori', user: { id: 'u1' } }) } };
        await db.mutate({ puts: { recipes: [fiche('rc_fav', { photo_source_url: 'https://cdn.test/fav.png' })], recipe_versions: [version('rc_fav')] }, origin: 'device' });
        const p = await renderRecipe({ id: 'rc_fav' }, {}, await ctxPour(repo, db, { sync }), { pickFiles: async () => [], toast: () => {}, fetch: fetchImage, enLigne: () => true });
        scene.append(p);
        eq((await PP.rapatrierPhotoWeb('rc_fav', { ctx: { sync }, repo, fetch: fetchImage, enLigne: () => true })).issue, 'ok', 'la photo est rapatriée APRÈS le rendu de la fiche');
        [...p.querySelectorAll('button')].find((b) => b.title === 'Favori').click();
        await attendre(async () => (await db.get('recipes', 'rc_fav')).favorite === true, '★ écrit');
        const f = await db.get('recipes', 'rc_fav');
        eq([f.favorite, /^[0-9a-f]{64}$/.test(f.photo_sha256 ?? ''), f.photo_origin, f.photo_source_url], [true, true, 'web', 'https://cdn.test/fav.png'], 'D-F16 : ★ Favori écrit favorite: true SANS effacer la photo posée depuis le rendu (fiche relue, leçon C4)');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));
```

- [ ] **Step 7 : rouge lu** (le module `photo-plat.js` n'existe pas : les blocs rougissent par leur `run` ; `renderZoneCouverture` ignore son troisième argument ;
  le filet `creer-ia.js` lève sur le `lire` du module absent) ; ★ Favori rougit **contre le code d'avant** (D-F16, rouge d'abord) une fois `photo-plat.js` posé
  — le vérifier en posant le module puis en rejouant le bloc ★ avec l'ancien `favBtn` : la photo est effacée. (Rouge non remesuré au rejeu : seul le vert
  l'est, Steps 11-12.)

- [ ] **Step 8 : implémenter `src/ui/photo-plat.js`** (rejeu : le bloc est le fichier mesuré — EI-3 garde de G et `relireErreurs`, EI-4
  `messageErreurImage` de `../core/image.js`, EI-5 `renderZoneCouverture` de `./components.js` ; aucune autre ligne ne diffère du plan) (neuf ; aucun des mots du fournisseur ni de la base dans ce fichier ; `photo_source_url` sur aucune
  ligne qui porte aussi `t(` ou `el(`) :

```js
// La photo du plat (lot F « Les plats en images », spec docs/superpowers/specs/2026-10-19-plats-en-images-design.md § 4.1, § 4.3) : la figure de
// tête de la fiche (le photoDuPlat du lot G, déplacé ici), la zone « Photo du plat » (le composant de la couverture d'un livre), ses gestes (poser,
// retirer) et le rapatriement de l'image d'une page web par la fonction de l'assistant (outil image-web). Règles : toute pose ou tout retrait
// RELIT la fiche et n'écrit que les trois champs de la photo (I-F1) ; un seul rapatriement par fiche et par document, hors du vol partagé (D-F7) ;
// monter une fiche n'appelle rien (I-F11) ; le redessin est LOCAL, jamais refresh() (D-F15) ; l'état web est DÉRIVÉ de la fiche, ses raisons vivent
// dans ce document (D-F17). Textes par t() littéral (I-F8).
import { el, toast as toastDom, pickFiles as pickDom } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { logError } from '../core/log.js';
import { sha256Hex } from '../core/hash.js';
import { lienSignet } from '../core/lien.js';
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';
import { preparerPhotoLocale, preparerPhotoDistante, ErreurImage, messageErreurImage } from '../core/image.js';
import * as repoModule from '../model/repo.js';
import { HASH } from '../model/schema.js';
import { assertVocabulaire } from '../domain/vocabulaire.js';
import { adresseImageAdmise, memeAdresseImage, lireImageWeb, RAISONS_DEFINITIVES } from '../domain/photo-web.js';
import { displayUrl, typeAffichage, safeDisplayType } from '../sync/mime.js';
import { section, sessionAssistant, texteRefusAssistant, texteEchecAssistant, vignettePage, gesteTelechargement, relireErreurs, renderZoneCouverture } from './components.js';

const pointeur = (f) => (typeof f?.photo_sha256 === 'string' && HASH.test(f.photo_sha256) ? f.photo_sha256 : null);
const lireEnLigne = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
let enLigneFlag = lireEnLigne();
const enVol = new Map();          // recipe_id → { controller, promesse } : un rapatriement par fiche et par document (D-F7)
const derniersEchecs = new Map(); // recipe_id → { raison, extra, tape, url } : la raison du dernier échec, pour l'adresse tentée (D-F17)
const vues = new Set();           // { root, recipeId, redessiner } : les zones montées, purgées par isConnected
function notifier(recipeId = null) {
  for (const v of [...vues]) {
    if (!v.root.isConnected) { vues.delete(v); continue; }
    if (recipeId === null || v.recipeId === recipeId) v.redessiner();
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { enLigneFlag = true; notifier(); });
  window.addEventListener('offline', () => { enLigneFlag = false; notifier(); });
}
export const recuperationEnCours = (recipeId) => enVol.has(recipeId);
export const attendreRecuperation = (recipeId) => enVol.get(recipeId)?.promesse ?? Promise.resolve();
export function reinitialiserPhotoPlat() { for (const e of enVol.values()) e.controller.abort(); enVol.clear(); vues.clear(); derniersEchecs.clear(); enLigneFlag = lireEnLigne(); } // tests seulement

// --- La figure de tête (lot A D-4 ; lot G § 4.4) : le photoDuPlat de G DÉPLACÉ, avec deux différences — le pointeur doit passer HASH, et une image
// web porte sa légende (D-F11 : l'hôte RECALCULÉ depuis l'adresse de la recette, jamais celle de l'image). Aucune ligne files : null (rien, pas
// même un cadre) ; octets d'un type que typeAffichage ne rend pas image/ : null ; sans octets : la vignette d'état de G et son « Télécharger »,
// redessinée sur place. La légende est calculée DANS le redessin : elle suit l'image après un téléchargement.
export async function figurePhotoPlat(recipe, { repo = repoModule, ctxF = {} } = {}) {
  const sha = pointeur(recipe);
  if (!sha) return null;
  let fichier = null;
  try { fichier = await repo.getFile(sha); } catch { fichier = null; }
  if (!fichier) return null;
  // Lot G (ronde 1 de sa tâche 6, recopiée) : sans octets, rien n'est offert si ce qui arrivera ne s'affichera pas — le type que portera le blob reçu (remote.mime), sinon celui
  // de la ligne (typeAffichage) ; une ligne distante application/pdf réussissait chaque tape sans que rien ne change (boucle muette).
  if (!(fichier.blob instanceof Blob) && !(safeDisplayType(fichier.remote?.mime) ?? safeDisplayType(fichier.mime))?.startsWith('image/')) return null;
  const figure = el('figure', { class: 'photo-plat', dataset: { role: 'photo-plat' }, style: { margin: '0 0 .8rem' } });
  const legende = () => {
    if (recipe.photo_origin !== 'web') return null;
    const l = lienSignet(recipe.source_url);
    return el('figcaption', { class: 'muted', dataset: { role: 'legende-photo-plat' } }, l.ok ? t('Image de la page {hote}', { hote: l.hote }) : t('Image de la page web'));
  };
  const dessiner = (f) => {
    if (f?.blob instanceof Blob) {
      const src = typeAffichage(f)?.startsWith('image/') ? displayUrl(f, urlDeBlob) : null;
      if (!src) return false;
      figure.replaceChildren(el('img', { alt: t('Photo du plat'), src, loading: 'lazy', style: { display: 'block', width: '320px', maxWidth: '100%', borderRadius: 'var(--radius)' } }), ...[legende()].filter(Boolean));
      return true;
    }
    figure.replaceChildren(vignettePage({ id: 'photo', sha256: sha }, f, { ...ctxF, telecharger }));
    return true;
  };
  const telecharger = gesteTelechargement({ moteur: ctxF?.moteur ?? null, redessiner: async () => {
    await relireErreurs(ctxF);
    dessiner(await repo.getFile(sha));
  } });
  return dessiner(fichier) ? figure : null;
}

// --- Le texte d'un échec (§ 4.1.2) : les textes existants d'abord ; deux neufs (inaccessible, définitives) ; un refus AVANT l'appel → null.
const REFUS_AVANT_APPEL = ['adresse', 'fiche_absente', 'fiche_changee', 'photo_manuelle', 'deja_la', 'vol_tenu', 'hors_ligne'];
export function texteEchecPhotoWeb({ raison, extra = {} } = {}) {
  if (raison === 'quota' || raison === 'non_admis') return texteRefusAssistant({ raison, quota: extra?.quota });
  if (raison === 'non_connecte') return t('Connecte-toi pour utiliser l’assistant.');
  if (raison === 'trop_de_demandes') return t('Trop de demandes pour l’instant. Réessaie dans une minute.');
  if (raison === 'delai' || raison === 'reseau' || raison === 'annule') return t('L’appel a peut-être été compté ; relancer en coûtera un autre.');
  if (raison === 'inaccessible') return t('Le site de la page n’a pas donné son image.');
  if (RAISONS_DEFINITIVES.includes(raison)) return t('L’image de cette page ne peut pas être utilisée.');
  if (raison === 'ecriture') return t('La photo du plat n’a pas pu être changée. Réessaie.');
  if (REFUS_AVANT_APPEL.includes(raison)) return null;
  return texteEchecAssistant({ message: typeof raison === 'string' ? raison : 'interne' });
}

// --- L'état de la zone (§ 4.1.2) : PUR (sauf t()). `motifEteint` (P-2) : la ligne sous un « Réessayer » éteint, jamais quand la raison la dit déjà.
export function etatZonePlat(recipe, { present = false, enVol = false, enLigne = true, connecte = false, occupe = false, echec = null } = {}) {
  const sha = pointeur(recipe);
  const candidat = !sha ? adresseImageAdmise(recipe?.photo_source_url) : null;
  const echecVu = echec && candidat && memeAdresseImage(echec.url, candidat) ? echec : null;
  const definitif = !!echecVu && RAISONS_DEFINITIVES.includes(echecVu.raison);
  const web = enVol ? 'en_cours' : candidat ? 'echouee' : null;
  const etat = { sha256: sha, message: null, web, raison: null, offreReessayer: false, peutReessayer: false, motifEteint: null, absente: !!sha && !present, enCours: !!occupe };
  if (!sha && !web) etat.message = t('Ajoute une photo du plat : elle illustre la recette dans tes listes.');
  if (web === 'echouee') {
    etat.raison = echecVu && (echecVu.tape || definitif) ? texteEchecPhotoWeb(echecVu) : null;
    etat.offreReessayer = !definitif;
    etat.peutReessayer = !definitif && !!enLigne && !!connecte;
    const motif = etat.offreReessayer && !etat.peutReessayer ? (!enLigne ? 'hors_ligne' : 'sans_compte') : null;
    etat.motifEteint = motif === 'sans_compte' && echecVu?.raison === 'non_connecte' && etat.raison ? null : motif;
  }
  return etat;
}

// --- Le rendu de la zone : le composant de la couverture (libellé et nom accessible de la photo du plat), puis la ligne web.
export function renderZonePhotoPlat(etat, gestes = {}) {
  const g = (nom) => () => (typeof gestes[nom] === 'function' ? gestes[nom]() : undefined);
  const composant = renderZoneCouverture({ sha256: etat.sha256, apercu: null, message: etat.message, enCours: etat.enCours },
    { photographier: g('photographier'), choisir: g('choisir'), retirer: g('retirer') },
    { libelle: t('Photo du plat'), nomRetirer: t('Retirer la photo du plat') });
  let ligne = null;
  if (etat.web === 'en_cours') ligne = el('p', { class: 'status', role: 'status', dataset: { role: 'photo-web-etat' } }, t('Récupération de la photo du plat…'));
  else if (etat.web === 'echouee') {
    const motif = etat.motifEteint === 'hors_ligne' ? el('small', { class: 'muted' }, t('Tu es hors ligne.'))
      : etat.motifEteint === 'sans_compte' ? el('small', { class: 'muted' }, t('Connecte-toi pour utiliser l’assistant.')) : null;
    ligne = el('div', { class: 'stack', dataset: { role: 'photo-web-etat' } },
      el('small', { class: 'muted' }, t('Photo du plat non récupérée.')),
      etat.raison ? el('small', { class: 'muted', dataset: { role: 'raison-photo-web' } }, etat.raison) : null,
      etat.offreReessayer ? el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn', dataset: { role: 'reessayer-photo' }, disabled: !etat.peutReessayer || etat.enCours, onClick: g('reessayer') }, t('Réessayer')),
        el('small', { class: 'muted', dataset: { role: 'cout-photo-web' } }, t('Un appel de plus, compté dans ton quota du jour.')),
        motif) : null,
      el('button', { type: 'button', class: 'btn link', dataset: { role: 'abandonner-photo-web' }, disabled: etat.enCours, onClick: g('abandonner') }, t('Ne pas récupérer')));
  }
  return el('div', { class: 'stack' }, composant, ligne);
}

// L'annonce de l'écran a_verifier de la lecture web (§ 4.3 point 1) : un ESSAI et son coût, jamais un résultat. Ici pour que le filet i18n la voie.
export function ligneAnnoncePhotoWeb() {
  return el('small', { class: 'muted', dataset: { role: 'photo-web-annonce' } }, t('Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour.'));
}

// --- Poser (§ 4.1.3) : le mur local, la fiche relue AVANT putFile (une fiche absente n'entraîne aucune ligne files), puis relue encore (C4) ;
// les trois champs ENSEMBLE ; une photo choisie efface le candidat web (D-F10). Ne lève jamais (sauf une origine hors liste : erreur de programmation).
export async function poserPhotoPlat(recipeId, file, { repo = repoModule, origin } = {}) {
  if (origin !== 'photo' && origin !== 'image') throw new TypeError('poserPhotoPlat : origine ' + String(origin));
  let jpeg;
  try { jpeg = await preparerPhotoLocale(file); }
  catch (e) { return { issue: 'refuse', raison: 'image', code: e instanceof ErreurImage ? e.code : 'indecodable' }; } // P-16
  try {
    if (!(await repo.get('recipes', recipeId))) return { issue: 'refuse', raison: 'fiche_absente' };
    const sha = await sha256Hex(jpeg);
    await repo.putFile(sha, jpeg, { mime: 'image/jpeg' });
    const courante = await repo.get('recipes', recipeId);
    if (!courante) return { issue: 'refuse', raison: 'fiche_absente' }; // la ligne files reste : orphelin L5
    const ecrite = { ...courante, photo_sha256: sha, photo_origin: origin, photo_source_url: null };
    assertVocabulaire(ecrite, 'recipes');
    await repo.save('recipes', ecrite);
    derniersEchecs.delete(recipeId);
    return { issue: 'ok', sha256: sha };
  } catch (e) {
    logError('photo_plat.pose', { error: e, id: recipeId });
    return { issue: 'echec', raison: 'ecriture' };
  }
}

// « Retirer » et « Ne pas récupérer » (D-F4) : les trois champs à null sur la fiche relue ; la ligne files reste (orphelins = L5). Aucun appel.
export async function retirerPhotoPlat(recipeId, { repo = repoModule } = {}) {
  try {
    const courante = await repo.get('recipes', recipeId);
    if (!courante) return { issue: 'refuse', raison: 'fiche_absente' };
    const ecrite = { ...courante, photo_sha256: null, photo_origin: null, photo_source_url: null };
    assertVocabulaire(ecrite, 'recipes');
    await repo.save('recipes', ecrite);
    derniersEchecs.delete(recipeId);
    return { issue: 'ok' };
  } catch (e) {
    logError('photo_plat.retrait', { error: e, id: recipeId });
    return { issue: 'echec', raison: 'ecriture' };
  }
}

// --- Le rapatriement (§ 4.3 point 3) : non async — le vol est posé AVANT tout await (une seconde demande sur la même fiche est refusée vol_tenu),
// la zone passe en « Récupération… » par notifier, puis la descente ; la fin retire le vol et redessine. Ne lève jamais.
const adressesEgalesOuNulles = (a, b) => (adresseImageAdmise(a) === null && adresseImageAdmise(b) === null) || memeAdresseImage(a, b);
export function rapatrierPhotoWeb(recipeId, options = {}) {
  if (enVol.has(recipeId)) return Promise.resolve({ issue: 'refuse', raison: 'vol_tenu' });
  const entree = { controller: new AbortController(), promesse: null };
  enVol.set(recipeId, entree);
  notifier(recipeId);
  entree.promesse = descendre(recipeId, entree, options).finally(() => { if (enVol.get(recipeId) === entree) enVol.delete(recipeId); notifier(recipeId); });
  return entree.promesse;
}
async function descendre(recipeId, entree, { candidat = null, tape = false, ctx = null, repo = repoModule, fetch = undefined, enLigne = () => enLigneFlag } = {}) {
  let url = null;
  const refuser = (raison) => {
    if (raison === 'fiche_changee' || raison === 'fiche_absente') derniersEchecs.delete(recipeId);
    if (raison === 'non_connecte' && tape) derniersEchecs.set(recipeId, { raison: 'non_connecte', extra: {}, tape: true, url });
    return { issue: 'refuse', raison };
  };
  const echouer = (raison, extra = {}) => {
    logError('photo_web.echec', { reason: raison, id: recipeId }); // P-1 : log.js ne garde que reason
    derniersEchecs.set(recipeId, { raison, extra, tape, url });
    return { issue: 'echec', raison };
  };
  try {
    const fiche = await repo.get('recipes', recipeId);
    if (!fiche) return refuser('fiche_absente');
    const depart = { photo_sha256: fiche.photo_sha256, photo_origin: fiche.photo_origin, photo_source_url: fiche.photo_source_url };
    const sha = pointeur(fiche);
    if (sha && fiche.photo_origin !== 'web') return refuser('photo_manuelle'); // D-F10 : une origine nulle avec un pointeur compte comme celle de la personne
    url = candidat !== null ? adresseImageAdmise(candidat) : adresseImageAdmise(fiche.photo_source_url);
    if (!url) return refuser('adresse');
    if (sha && memeAdresseImage(url, fiche.photo_source_url)) return refuser('deja_la');
    if (!enLigne()) return refuser('hors_ligne');
    const session = await sessionAssistant(ctx);
    if (!session) return refuser('non_connecte');
    const r = await lireImageWeb({ url, session }, { fetch: fetch ?? globalThis.fetch, signal: entree.controller.signal });
    if (r.etat === 'echec') return echouer(r.raison, r.extra ?? {});
    let jpeg;
    try { jpeg = await preparerPhotoDistante(r.blob); } catch (e) { return echouer(e instanceof ErreurImage ? e.code : 'indecodable'); }
    const sha2 = await sha256Hex(jpeg);
    // Garde des trois champs (I-F1, I-F5, D-F18), AVANT putFile puis encore avant l'écriture : la personne a pu choisir une photo, retirer, refuser
    // le rapatriement, ou une relecture changer l'adresse — rien n'est alors écrasé.
    const inchangee = (relue) => relue.photo_sha256 === depart.photo_sha256 && relue.photo_origin === depart.photo_origin && adressesEgalesOuNulles(relue.photo_source_url, depart.photo_source_url);
    let relue = await repo.get('recipes', recipeId);
    if (!relue) return refuser('fiche_absente');
    if (!inchangee(relue)) return refuser('fiche_changee');
    try { await repo.putFile(sha2, jpeg, { mime: 'image/jpeg' }); } catch { return echouer('ecriture'); }
    relue = await repo.get('recipes', recipeId);
    if (!relue) return refuser('fiche_absente');
    if (!inchangee(relue)) return refuser('fiche_changee'); // la ligne files reste : orphelin L5
    const ecrite = { ...relue, photo_sha256: sha2, photo_origin: 'web', photo_source_url: url }; // les trois ENSEMBLE : la provenance de CETTE image
    try { assertVocabulaire(ecrite, 'recipes'); await repo.save('recipes', ecrite); } catch { return echouer('ecriture'); }
    derniersEchecs.delete(recipeId);
    return { issue: 'ok', sha256: sha2 };
  } catch {
    return echouer('interne'); // P-17 : jamais une levée vers l'écran (I-F4)
  }
}

// --- Le montage (§ 4.1.1) : l'emplacement de tête (un div, jamais null), la section « Photo du plat », les gestes. Monter n'appelle RIEN (I-F11).
// Les redessins sont sérialisés (P-15) ; les URL blob: d'avant sont relevées juste avant le remplacement et révoquées APRÈS (D-T9).
export async function monterPhotoPlat(recipe, ctx, { repo = repoModule, pickFiles = pickDom, toast = toastDom, fetch = undefined, enLigne = () => enLigneFlag, ctxF = {} } = {}) {
  const entete = el('div', { dataset: { role: 'emplacement-photo-plat' } });
  const conteneur = el('div', { dataset: { role: 'zone-photo-plat' } });
  const zone = section(t('Photo du plat'), conteneur);
  const connecte = !!ctx?.sync?.user;
  let occupe = false;
  async function dessiner() {
    let relue = recipe;
    try { relue = (await repo.get('recipes', recipe.id)) || recipe; } catch { relue = recipe; }
    const sha = pointeur(relue);
    let fichier = null;
    if (sha) { try { fichier = await repo.getFile(sha); } catch { fichier = null; } }
    const etat = etatZonePlat(relue, { present: !!typeAffichage(fichier)?.startsWith('image/'), enVol: recuperationEnCours(relue.id), enLigne: enLigne(), connecte, occupe, echec: derniersEchecs.get(relue.id) ?? null });
    const figure = await figurePhotoPlat(relue, { repo, ctxF });
    const anciennes = [...entete.querySelectorAll('img'), ...conteneur.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((u) => typeof u === 'string' && u.startsWith('blob:'));
    entete.replaceChildren(...[figure].filter(Boolean));
    conteneur.replaceChildren(renderZonePhotoPlat(etat, gestes));
    for (const u of anciennes) revoquerUrlDeBlob(u);
  }
  let file = Promise.resolve();
  const redessiner = () => { file = file.then(dessiner).catch((e) => logError('photo_plat.rendu', { error: e, id: recipe.id })); return file; };
  // Garde `occupe` AVANT pickFiles, mais `occupe = true` seulement APRÈS le choix (pickFiles ne se résout jamais sur une annulation : poser
  // `occupe` avant figerait la zone) — le motif d'import-cible.js.
  async function poserDepuis(options, origin) {
    if (occupe) return;
    const fichiers = await pickFiles(options);
    if (!fichiers?.length) return;
    occupe = true; await redessiner();
    try {
      const r = await poserPhotoPlat(recipe.id, fichiers[0], { repo, origin });
      if (r.issue === 'ok') toast(t('Photo du plat enregistrée.'));
      else if (r.raison === 'image') toast(messageErreurImage({ code: r.code }));
      else if (r.raison === 'fiche_absente') toast(t('Recette introuvable.'));
      else toast(t('La photo du plat n’a pas pu être changée. Réessaie.'));
    } finally { occupe = false; await redessiner(); }
  }
  async function retirerAvec({ dire }) {
    if (occupe) return;
    occupe = true; await redessiner();
    try {
      const r = await retirerPhotoPlat(recipe.id, { repo });
      if (r.issue === 'ok') { if (dire) toast(t('Photo du plat retirée.')); }
      else if (r.raison === 'fiche_absente') toast(t('Recette introuvable.'));
      else toast(t('La photo du plat n’a pas pu être changée. Réessaie.'));
    } finally { occupe = false; await redessiner(); }
  }
  const gestes = {
    photographier: () => poserDepuis({ accept: 'image/*', multiple: false, capture: 'environment' }, 'photo'),
    choisir: () => poserDepuis({ accept: 'image/*', multiple: false }, 'image'),
    retirer: () => retirerAvec({ dire: true }),
    abandonner: () => retirerAvec({ dire: false }),
    // Sans await dans le gestionnaire : le vol est posé avant tout await, la zone passe en « Récupération… » par notifier (§ 4.1.3).
    reessayer: () => (occupe ? Promise.resolve(null) : rapatrierPhotoWeb(recipe.id, { tape: true, ctx, repo, fetch, enLigne })),
  };
  await redessiner();
  const vue = { root: zone, recipeId: recipe.id, redessiner };
  vues.add(vue);
  // Le routeur insère la racine APRÈS la fin de la route : une notification arrivée avant l'insertion purge la vue ; elle revient ici (motif
  // d'import-cible.js) et se redessine — une descente finie entre-temps n'est jamais perdue.
  setTimeout(() => { if (zone.isConnected && !vues.has(vue)) { vues.add(vue); redessiner(); } }, 0);
  return { entete, zone, gestes };
}
```

- [ ] **Step 9 : implémenter `components.js`, `livre-ajout.js`, `recipe.js` et `sw.js`.** `sw.js` dans le MÊME Step que `recipe.js`, qui rend `photo-plat.js`
  atteignable depuis `src/app.js` (le test « tout module atteignable depuis app.js est dans SHELL » de `tests/sync.js` rougirait sinon, et le Step 11
  tomberait en NEEDS_CONTEXT pour rien) : `VERSION = 'cuisine-os-v0.15.0-2'`, `SHELL` + `'./src/ui/photo-plat.js'` (ligne des modules `./src/ui/…`,
  ordre alphabétique : entre `meals.js` et `porte-entree.js`). **EI-5** : `renderZoneCouverture` (livre-ajout.js l. 283-298 à `35fb29c`, son commentaire
  R-UX-8 compris) est DÉPLACÉE dans `src/ui/components.js`, après `boutonTelechargerPages` (avant `dietChip`), et `livre-ajout.js` l'importe de
  `./components.js` (l. 13) et la ré-exporte (`export { renderZoneCouverture };` après la l. 24 — le motif de D-E20 pour `messageErreurImage`) ; sa
  signature devient `renderZoneCouverture(etat, gestes = {}, { libelle = null, nomRetirer = null } = {})` : le `span`
  devient `el('span', null, libelle ?? t('Couverture'))` et le bouton « Retirer » gagne `'aria-label': nomRetirer` dans ses attributs (`el` ignore une valeur
  nulle : la fiche du livre, qui appelle à deux arguments, ne change pas) ; les boutons de G et le reste inchangés. La fonction déplacée :

```js
// La zone d'une image (couverture d'un livre, photo du plat : lot F) — déplacée de livre-ajout.js au lot F (rejeu : photo-plat.js la lit
// sans importer livre-ajout.js, qui importe import-cible.js ; aucun cycle d'imports), ré-exportée là-bas (motif de D-E20).
// R-UX-8 : aucun groupe de boutons dans un <label> — un clic sur le mot « Couverture » déclencherait « Photographier ».
// L'état est dit tel qu'il est (I-B) : le message vient d'un fait (reçue, enregistrée, refusée), jamais d'une attente.
export function renderZoneCouverture(etat, gestes = {}, { libelle = null, nomRetirer = null } = {}) {
  const g = (nom) => () => (typeof gestes[nom] === 'function' ? gestes[nom]() : undefined);
  return el('div', { class: 'field zone-couverture' }, el('span', null, libelle ?? t('Couverture')),
    el('div', { class: 'row' },
      etat.apercu ? el('img', { src: etat.apercu, alt: '' }) : null,
      el('div', { class: 'stack' },
        etat.message ? el('small', { class: 'muted' }, etat.message) : null,
        el('div', { class: 'row' },
          etat.telechargeable ? el('button', { type: 'button', class: 'btn primary', disabled: !!etat.telechargement, onClick: g('telecharger') }, etat.telechargement ? t('Téléchargement…') : t('Télécharger')) : null,
          etat.reessayable ? el('button', { type: 'button', class: 'btn', disabled: !!etat.telechargement, onClick: g('reessayer') }, t('Réessayer')) : null,
          el('button', { type: 'button', class: 'btn', disabled: !!etat.enCours, onClick: g('photographier') }, t('Photographier')),
          el('button', { type: 'button', class: 'btn', disabled: !!etat.enCours, onClick: g('choisir') }, t('Choisir une image')),
          etat.sha256 ? el('button', { type: 'button', class: 'btn link', disabled: !!etat.enCours, 'aria-label': nomRetirer, onClick: g('retirer') }, t('Retirer')) : null))));
}
```

  `src/ui/recipe.js` :
  - `import { monterPhotoPlat } from './photo-plat.js';` ; signature `export async function renderRecipe(params, query, ctx, deps = {}) {` — le lot B
    l'a DÉJÀ posée (prototype B, `recipe.js` l. 28-39 → l. 32-34 à `35fb29c` : `deps` porte les gestes de la lecture web `{ repo, navigate, fetch, maintenant, enLigne }`) : F lit
    dans ce MÊME objet `pickFiles` et `toast` en plus, et le transmet tel quel à `monterPhotoPlat` (les clés que la zone ne connaît pas sont ignorées ;
    `app.js` appelle avec trois arguments : les défauts de `monterPhotoPlat` valent la production). Si le code réel n'a pas `deps`, l'ajouter (écart
    consigné) ;
  - `favBtn` (D-F16) :

```js
  // Lot F (D-F16) : ★ Favori RELIT la fiche et n'écrit que `favorite` — une photo du plat posée depuis le rendu (descente web, autre onglet) survit.
  const favBtn = el('button', { class: 'btn', title: t('Favori'), onClick: async () => {
    const relue = await repo.get('recipes', recipe.id);
    if (!relue) { toast(t('Recette introuvable.')); return; }
    await repo.save('recipes', { ...relue, favorite: !relue.favorite });
    refresh();
  } }, recipe.favorite ? '★ ' + t('Favori') : '☆ ' + t('Favori'));
```

  - l'appel de G (l. 102-104 à `35fb29c` : `const ctxF = await contexteFichiers(ctx); const photo = await photoDuPlat(recipe, ctxF); if (photo) root.append(photo);`,
    chacun avec son commentaire ; celui de `ctxF` est gardé) devient :

```js
  const ctxF = await contexteFichiers(ctx);
  // Lot F (§ 4.1.1) : l'emplacement de tête (un div, jamais null : aucun nœud texte direct) ; la zone est insérée plus bas, après la préparation.
  const photo = await monterPhotoPlat(recipe, ctx, { ...deps, ctxF });
  root.append(photo.entete);
```

  - juste après `drawBody();` (l. 164 à `35fb29c` ; avant « Pages originales ») : `root.append(photo.zone); // lot F (D-F2, D-F8) : seulement quand la fiche a une version` ;
  - la fonction `photoDuPlat` est retirée (l. 404-430 à `35fb29c`, commentaire compris) ; retirer de ses imports ceux qu'elle était seule à lire (relevé au
    Step 0 par une recherche Python sur le fichier, hors commentaires : la ligne `../sync/mime.js` (l. 7) et la ligne `../core/blob-urls.js` (l. 8) entières ;
    `vignettePage`, `gesteTelechargement` et `relireErreurs` de la ligne `./components.js` (l. 18)) ;
  - chaque écrivain (c) neuf de `recipe.js` relevé au Step 0 : la même correction que ★ Favori (relire par `repo.get`, n'écrire que son champ sur
    la fiche relue), et son test (un bloc à part au-dessus du repère, gabarit « D-F16 : ★ Favori ») ; consigné dans `recensement-D-F16.md`.
- [ ] **Step 10 : `en.js`** (avant `};`, sous `// Lot F « Les plats en images » (spec § 5).`) :

```js
  "Ajoute une photo du plat : elle illustre la recette dans tes listes.": "Add a photo of the dish: it illustrates the recipe in your lists.",
  "Image de la page {hote}": "Image from the page {hote}",
  "Image de la page web": "Image from the web page",
  "Récupération de la photo du plat…": "Fetching the photo of the dish…",
  "Photo du plat non récupérée.": "Photo of the dish not retrieved.",
  "Un appel de plus, compté dans ton quota du jour.": "One more call, counted in your daily quota.",
  "Ne pas récupérer": "Don’t fetch it",
  "Le site de la page n’a pas donné son image.": "The page’s site did not provide its image.",
  "L’image de cette page ne peut pas être utilisée.": "This page’s image cannot be used.",
  "Photo du plat enregistrée.": "Photo of the dish saved.",
  "Photo du plat retirée.": "Photo of the dish removed.",
  "La photo du plat n’a pas pu être changée. Réessaie.": "The photo of the dish could not be changed. Try again.",
  "Retirer la photo du plat": "Remove the photo of the dish",
  "Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour.": "After saving, the app will try to fetch the photo of the dish from the page: one more call, counted in your daily quota.",
```

  Si l'entrée de G vaut `"Photo du plat · {titre}": "Dish photo · {titre}"`, sa valeur devient `"Photo of the dish · {titre}"` (amendement nommé, § 5).
- [ ] **Step 11 : vert.** Suite : tout vert **sauf l'épingle** (relevée au Step 12), une seule erreur de console (favicon) — si une AUTRE assertion
  existante des lots A, B, G, C, D ou E rougit hors des amendements nommés : NEEDS_CONTEXT ; Node et `--check` inchangés et verts. Mesuré au rejeu (avec D-2
  et EI-5) : `❌ 5827/5828` (l'épingle seule) ; Node 204/204 ; `--check` 0 ; graphe d'imports depuis `src/app.js` : 0 cycle.
- [ ] **Step 12 : épingle relevée** (`sw.js` est déjà posé au Step 9) ; relancer la suite : `✅ N/N`. Mesuré : épingle **5827** (5738 + 89), `✅ 5828/5828`.
- [ ] **Step 13 : mutants de la tâche** (copie servie sur 8190 ; chacun doit rougir) : `enVol` posé après le premier `await` · écriture de la fiche
  sans garde des trois champs · `putFile` avant la garde · la garde compare l'adresse relue à l'adresse tentée par `!==` · `deja_la` par comparaison brute ·
  `monterPhotoPlat` qui lance `rapatrierPhotoWeb` au cas 5 · raison dite après le départ automatique (`quota`) · « Réessayer » offert après une raison
  définitive · `non_connecte` d'une tape non gardé · « Connecte-toi… » rendu deux fois · `poserPhotoPlat` qui ne remet pas `photo_source_url` à `null` ·
  « Retirer » qui garde `photo_source_url` · `{ ...recipe }` du rendu au lieu de la fiche relue (poser) · écriture sans relecture (la fiche supprimée
  ressuscite) · `refresh()` à la place du redessin · `enCours` ignoré au rendu · garde `if (occupe) return` retirée · la zone rend aussi l'état du
  fichier (deux « Télécharger ») · `preparerPhotoLocale` employée pour l'image web · ★ Favori qui écrit `{ ...recipe, favorite }` du rendu ·
  `lireImageWeb` remplacée par un `fetch(url)` direct · garde départ/relue comparée en brut (`!==`) (« rapatriement », cas 4 bis) · garde par
  `memeAdresseImage` seule, deux adresses refusées jamais égales (cas 4 bis) · `descendre` qui garde l'échec automatique avec `tape: true`
  (« rapatriement », cas 8, `rc_z3`) · `zone` redessinée par « Télécharger » (« pointeur sans octets ») · chaque écrivain (c) neuf de `recipe.js`
  rendu à sa copie du rendu (son test).
- [ ] **Step 14 : invisibles** sur les fichiers touchés : 0.
- [ ] **Step 15 : commit** `Fiche : photo du plat (zone, gestes, rapatriement image-web), figure de tete deplacee, Favori relu (lot F, tache 3)`.

---

### Task 4 : Cartes illustrées — `vignettePlat`, `recipeCard`, repas, révocation au redessin

Spec § 9 tâche 4 ; § 4.2, D-F9, I-F3, I-F6 ; tests § 7.4 (cartes, CSP et sources). `sw.js` `-3`.

**Files:**
- Modify: `src/ui/components.js` (imports : `HASH` de `../model/schema.js`, après la l. 14 ; `vignettePlat` et `urlsDesVignettes` avant `recipeCard`,
  l. 157-158 à `35fb29c` ; `recipeCard` l. 169-170 : la vignette, premier enfant de `.col`)
- Modify: `src/ui/meals.js` (l. 10 import ; `renderMeal`, l. 80-96 : la carte d'un élément — la boucle de `bd03e48`, inchangée à `35fb29c`)
- Modify: `src/ui/search.js` (imports ; `render()`, l. 113-114 : relevé et révocation), `src/ui/book.js` (imports, l. 8 et l. 10 ; `drawList()`, l. 169-170 :
  de même)
- Modify: `styles.css` (règle `.plat-vignette`, après les règles `.photo-plat` / `.thumbs` : après la l. 268)
- Modify: `tests/photo-plat.js` (quatre blocs au-dessus du repère : « recipeCard : référence construite », « cartes », « styles.css », « CSP et
  sources »), `tests/tests.js` (épingle), `sw.js` (`VERSION` `-3`)

**Interfaces:**
- Consumes : `HASH` (tâche 2), `typeAffichage`, `displayUrl` (G), `urlDeBlob`, `revoquerUrlDeBlob` (`src/core/blob-urls.js`).
- Produces (`src/ui/components.js`) : `vignettePlat(recipe, { repo } = {}) → HTMLImageElement | null` (`img.plat-vignette`, `alt=""`, `loading="lazy"`, né `hidden`) ;
  `urlsDesVignettes(conteneur) → string[]` (les `src` en `blob:` des `img.plat-vignette` du conteneur).

- [ ] **Step 0 : relire** `recipeCard` et ses appelants (`search.js`, `book.js` `drawList`, `dish.js`, `home.js`, `library.js` — après C, D, E, la liste peut avoir
  bougé : relevé par une recherche Python de `recipeCard(` dans `src/`), `renderMeal`, `render()` de `search.js`, `drawList` de `book.js`, et la place des règles
  `.photo-plat` (G) dans `styles.css`. Un nouvel écran qui redessine une liste de `recipeCard` à chaque frappe (C, D ou E) reçoit la même révocation que
  `search.js` (amendement nommé). **Référence construite (R-F-7 ; P-20 refusé)** : AUCUN relevé de littéral, aucun « obtenu » recopié du
  bilan — le bloc « recipeCard : référence construite » du Step 1 fabrique sa référence (la carte avec photo, rendue par le même composant,
  privée de sa vignette) et pose un gabarit explicite (`.col` enfant direct de `.row.between.top`, elle-même enfant direct de la carte ; le
  badge en tête de `.col`) : relire ce gabarit sur le `recipeCard` réel ; si C, D ou E ont déplacé `.col` ou le badge, le gabarit suit le code
  réel (amendement nommé). **Lignes (R-F-11)** : les numéros cités par cette tâche (`bd03e48` : `recipeCard` l. 140-141, `meals.js` l. 10 et
  80-96, `render()` de `search.js` l. 121-122, `drawList` de `book.js` l. 102-103) sont relus sur la tête du lot E ; tout écart est un amendement
  nommé, pas un constat (R-C-7).
  **Relevé du rejeu (`35fb29c`)** : appelants de `recipeCard(` — `library.js` l. 33, `home.js` l. 40, `dish.js` l. 51, `search.js` l. 144 et 154, `book.js`
  l. 178 : la liste du plan, aucun écran neuf de C, D ou E ; seuls `render()` de `search.js` et `drawList` de `book.js` (filtre `input[type="search"]`, l. 191)
  redessinent à chaque frappe (`dish.js` `drawList` ne tourne qu'au rendu, l. 92) ; `recipeCard` (l. 158-176) : `a.item-link.card` > `div.row.between.top` >
  `div.col` > `availabilityBadge` (`span.badge`) — le gabarit du Step 1 tient ; la boucle de `renderMeal` (l. 80-96) est celle de `bd03e48` à l'octet ;
  règles `.photo-plat` de G : `styles.css` l. 268 ; `book.js` importe déjà `urlDeBlob` de `../core/blob-urls.js` (l. 10, lot G : A-11).

- [ ] **Step 1 : tests rouges — `tests/photo-plat.js`** (au-dessus du repère de fin) :

```js
    // ===== Tâche 4 — les cartes illustrées (spec § 4.2)
    await run('recipeCard : la carte sans photo est celle d’avant le lot (référence construite dans le test, spec § 7.4 ; R-F-7)', () => withRepo(async () => {
      const K = await import('../src/ui/components.js');
      // La référence est CONSTRUITE ici, jamais relevée en littéral (R-F-7 : le lanceur coupe un échec à 400 caractères). La carte AVEC photo, rendue
      // par le MÊME composant et privée de sa vignette, doit être EXACTEMENT la carte sans photo ; un gabarit explicite borne ce que le composant ne
      // peut pas comparer à lui-même (une enveloppe posée sur toutes les cartes). Pointeur valide sans ligne files (base jetable) : la carte est lue
      // de façon SYNCHRONE, la vignette encore née cachée, sans src.
      const doc = { recipe: { id: 'rc_k', original_title: 'Tarte', availability: 'available', favorite: false }, version: null, book: null, edition: null };
      const sans = K.recipeCard(doc);
      const pointeurHostile = K.recipeCard({ ...doc, recipe: { ...doc.recipe, photo_sha256: 'pas une empreinte' } });
      const avec = K.recipeCard({ ...doc, recipe: { ...doc.recipe, photo_sha256: H('f') } });
      const v = avec.querySelector('.col')?.firstElementChild;
      eq([v?.tagName, v?.className, v?.getAttribute('alt'), v?.getAttribute('loading'), v?.hidden, v?.hasAttribute('src')], ['IMG', 'plat-vignette', '', 'lazy', true, false],
        'recipeCard avec un pointeur valide : la vignette est le PREMIER enfant de .col — img.plat-vignette, alt vide, loading lazy, née cachée, sans src');
      const reference = avec.cloneNode(true);
      reference.querySelector('.col > img.plat-vignette')?.remove();
      eq([sans.outerHTML === reference.outerHTML, pointeurHostile.outerHTML === sans.outerHTML], [true, true],
        'recipeCard sans photo (ou à pointeur hostile) : son balisage est EXACTEMENT celui de la carte avec photo privée de sa vignette (référence construite)');
      const gabarit = (carte) => { const col = carte.querySelector('.col'); const rangee = col?.parentElement; return [!!rangee?.matches('.row.between.top'), rangee?.parentElement === carte, !!col?.firstElementChild?.classList.contains('badge'), carte.querySelectorAll('img').length]; };
      eq([gabarit(sans), gabarit(pointeurHostile)], [[true, true, true, 0], [true, true, true, 0]],
        'recipeCard sans photo (gabarit explicite) : .col enfant direct de .row.between.top, elle-même enfant direct de la carte ; le badge en tête de .col ; aucune img');
    }));

    await run('cartes : vignettePlat, recipeCard avec photo, renderMeal, révocation au redessin (§ 4.2)', () => withRepo(async (repo, db) => {
      const K = await import('../src/ui/components.js');
      const { renderMeal } = await import('../src/ui/meals.js');
      const { renderSearch } = await import('../src/ui/search.js');
      const { renderBook } = await import('../src/ui/book.js');
      const { buildDocs } = await import('../src/domain/search.js');
      const BU = await import('../src/core/blob-urls.js');
      const scene = nouvelleScene();
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try {
        const jpeg1 = await imageTest('v1.jpg', '#c63', 320, 240); const sha1 = await sha256Hex(jpeg1);
        const jpeg2 = await imageTest('v2.jpg', '#36c', 320, 240); const sha2 = await sha256Hex(jpeg2);
        await repo.putFile(sha1, jpeg1, { mime: 'image/jpeg', origin: 'device' }); await repo.putFile(sha2, jpeg2, { mime: 'image/jpeg', origin: 'device' });
        await db.mutate({ puts: { files: [
          { sha256: H('1'), mime: 'text/html', blob: new Blob(['<p>x</p>'], { type: 'text/html' }), size: 8, syncable: false, created_at: DATE, updated_at: DATE },
          { sha256: H('2'), mime: 'application/pdf', blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), size: 8, syncable: true, created_at: DATE, updated_at: DATE },
          { sha256: H('3'), mime: 'image/heic', blob: jpeg1, size: jpeg1.size, syncable: true, created_at: DATE, updated_at: DATE },
        ] }, origin: 'device' });
        const v1 = K.vignettePlat({ photo_sha256: sha1 }, { repo });
        await attendre(() => !v1.hidden, 'octets lus (v1)');
        eq([v1.tagName, v1.className, v1.getAttribute('alt'), v1.getAttribute('src')?.startsWith('blob:'), v1.getAttribute('loading')], ['IMG', 'plat-vignette', '', true, 'lazy'], 'vignettePlat : pointeur + octets → img.plat-vignette visible, src blob:, alt vide (décorative)');
        const vSans = K.vignettePlat({ photo_sha256: H('9') }, { repo }); const vHtml = K.vignettePlat({ photo_sha256: H('1') }, { repo });
        const vPdf = K.vignettePlat({ photo_sha256: H('2') }, { repo }); const vHeic = K.vignettePlat({ photo_sha256: H('3') }, { repo });
        // R-F-10, limite NOMMÉE : les quatre getFile partent dans l'ordre (vSans, vHtml, vPdf, vHeic), une transaction en lecture seule chacun ;
        // attendre vHeic (la DERNIÈRE) puis deux tick() suppose que les trois premières ont abouti — IndexedDB ne garantit pas l'ordre d'achèvement
        // de transactions en lecture seule concurrentes. Un rouge intermittent sur les négatives ci-dessous se REJOUE avant d'en faire un constat
        // (R-B-15 du lot B, même esprit).
        await attendre(() => !vHeic.hidden, 'ligne heic à blob jpeg visible'); await tick(); await tick();
        eq([vSans.hidden, vSans.hasAttribute('src'), vHtml.hidden, vHtml.hasAttribute('src'), vPdf.hidden, vPdf.hasAttribute('src'), vHeic.hidden], [true, false, true, false, true, false, false],
          'vignettePlat : sans octets → cachée, sans src ; text/html → cachée ; application/pdf (liste blanche, pas une image) → cachée ; ligne image/heic à blob image/jpeg → visible (le type du blob gagne, G)');
        eq([K.vignettePlat({}), K.vignettePlat({ photo_sha256: '../x' }), K.vignettePlat(null)], [null, null, null], 'vignettePlat : sans pointeur valide → null (rien, ni pictogramme ni cadre)');
        // La carte SANS photo : bloc « recipeCard : référence construite » (R-F-7). Ici, la carte AVEC photo.
        const doc = { recipe: { id: 'rc_k', original_title: 'Tarte', availability: 'available', favorite: false }, version: null, book: null, edition: null };
        const avec = K.recipeCard({ ...doc, recipe: { ...doc.recipe, photo_sha256: sha1 } });
        eq([avec.querySelector('.col')?.firstElementChild?.className, avec.querySelector('.col')?.children[1]?.classList.contains('badge')], ['plat-vignette', true], 'recipeCard avec photo : la vignette est le premier enfant de .col, avant le badge');
        const recA = fiche('rc_m1', { photo_sha256: sha1 }); const recB = fiche('rc_m2');
        const meal = { id: 'm1', title: 'Souper', servings: 2, items: [{ id: 'mi1', recipe_id: 'rc_m1', recipe_version_id: null, role: 'plat_principal', servings: 2, locked: false }, { id: 'mi2', recipe_id: 'rc_m2', recipe_version_id: null, role: 'accompagnement', servings: 2, locked: false }], constraints_snapshot: { diets: [] } };
        const repas = await renderMeal({ id: 'm1' }, {}, { meals: [meal], recipesById: new Map([[recA.id, recA], [recB.id, recB]]), versionsById: new Map(), editionsById: new Map(), editionLabel: () => '', ingredientsById: ING, meal_feedback: [], docs: [], docsByRecipe: new Map(), settings: {} });
        scene.append(repas);
        const cartes = [...repas.querySelectorAll('.card.flat.stack')];
        await attendre(() => !!cartes[0]?.querySelector('img.plat-vignette:not([hidden])'), 'vignette du repas');
        const gauche = (c) => c.querySelector(':scope > .row.between.top')?.firstElementChild;
        eq([gauche(cartes[0])?.className, gauche(cartes[0])?.firstElementChild?.className, gauche(cartes[1])?.className, gauche(cartes[1])?.querySelector('img')], ['row top', 'plat-vignette', '', null],
          'renderMeal : la vignette à gauche du titre avec octets ; sans photo, le bloc de gauche est celui d’avant le lot (un div sans classe)');
        const recettes = [fiche('rc_s1', { original_title: 'Tarte aux pommes', photo_sha256: sha1 }), fiche('rc_s2', { original_title: 'Tarte aux poires', photo_sha256: sha2 })];
        const docs = buildDocs({ recipes: recettes, versions: recettes.map((r) => version(r.id)), editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
        const ctxR = await ctxPour(repo, db, { docs, docsByRecipe: new Map(docs.map((d) => [d.recipe.id, d])) });
        BU.revoquerUrlsDeBlob();
        // L'espion note chaque révocation ET si l'URL est encore sous un <img> du document à cet instant (D-T9 : révoquer APRÈS le vidage) ; il est
        // vidé juste avant chaque geste : le compte est EXACT.
        const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
        const dansLeDocument = (u) => [...document.querySelectorAll('img')].some((i) => i.getAttribute('src') === u);
        URL.revokeObjectURL = (u) => { revoquees.push({ u, encore: dansLeDocument(u) }); return vraiRevoke.call(URL, u); };
        const srcs = (n) => [...n.querySelectorAll('img.plat-vignette')].map((i) => i.getAttribute('src'));
        const toutesPretes = (n, k) => { const s = srcs(n); return s.length === k && s.every((u) => typeof u === 'string' && u.startsWith('blob:')); };
        try {
          const rs = await renderSearch({}, { mode: 'recipes' }, ctxR, { navigate: () => {}, remplacerAdresse: () => {} });
          scene.append(rs);
          await attendre(() => toutesPretes(rs, 2), 'chaque vignette de la recherche a son src');
          const avant = srcs(rs);
          revoquees.length = 0;
          bouton(rs, 'Chercher').click();
          await attendre(() => revoquees.length >= avant.length, 'révocations du redessin (recherche)');
          eq([revoquees.map((x) => x.u).sort(), revoquees.filter((x) => x.encore).length], [[...avant].sort(), 0],
            'renderSearch : un redessin révoque EXACTEMENT les URL des vignettes précédentes (compte exact), chacune APRÈS le vidage (plus sous un img du document, D-T9)');
          const edition = { id: 'ed_v', book_id: 'b_v', language: 'fr', updated_at: DATE }; const livre = { id: 'b_v', title: 'Livre', updated_at: DATE };
          const recLivre = [fiche('rc_l1', { edition_id: 'ed_v', original_title: 'Tarte', photo_sha256: sha1 }), fiche('rc_l2', { edition_id: 'ed_v', original_title: 'Tourte', photo_sha256: sha2 })];
          await db.mutate({ puts: { books: [livre], book_editions: [edition], recipes: recLivre, recipe_versions: recLivre.map((r) => version(r.id)) }, origin: 'device' });
          const rb = await renderBook({ id: 'ed_v' }, {}, await ctxPour(repo, db, { editionsById: new Map([['ed_v', edition]]), booksById: new Map([['b_v', livre]]), books: [livre], book_editions: [edition] }));
          scene.append(rb);
          await attendre(() => toutesPretes(rb, 2), 'chaque vignette du livre a son src');
          const avantL = srcs(rb);
          const filtre = rb.querySelector('input[type="search"]');
          revoquees.length = 0;
          filtre.value = 'ta'; filtre.dispatchEvent(new Event('input', { bubbles: true }));
          await attendre(() => revoquees.length >= avantL.length, 'révocations du redessin (livre)');
          eq([revoquees.map((x) => x.u).sort(), revoquees.filter((x) => x.encore).length], [[...avantL].sort(), 0],
            'book.js drawList : le filtre redessine et révoque EXACTEMENT les URL des vignettes précédentes, APRÈS le vidage');
        } finally { URL.revokeObjectURL = vraiRevoke; }
      } finally { globalThis.fetch = vraiFetch; scene.remove(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));

    await run('styles.css : la règle .plat-vignette (D-F9 ; T-1, T-2 ; P-21)', async () => {
      // Lue SANS ses commentaires : le commentaire posé juste avant la règle (Step 4) ne la masque pas. Une règle introuvable est un rouge NOMMÉ.
      const css = (await lire('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
      const regle = css.match(/(?:^|\})\s*\.plat-vignette\s*\{([^}]*)\}/)?.[1] ?? '';
      ok(regle.trim() !== '', 'styles.css : la règle .plat-vignette est trouvée');
      const decl = Object.fromEntries(regle.split(';').map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]).filter(([k, v]) => k && v));
      eq([decl.width, decl.height, decl['object-fit'], decl['border-radius'], decl.border, decl.flex], ['72px', '72px', 'cover', '8px', '1px solid var(--line)', '0 0 auto'], 'styles.css : .plat-vignette 72 × 72, object-fit cover, coins 8 px, bord var(--line), flex 0 0 auto (D-F9)');
      ok(regle.trim() !== '' && !/display\s*:\s*none/.test(regle) && !/#[0-9a-f]{3,8}\b/i.test(regle), 'styles.css : la règle est lue, et elle ne porte ni display:none ni couleur en dur (T-1, T-2 : tests/theme.js inchangé)');
    });

    await run('CSP et sources (I-F3, I-F8, D-F11)', async () => {
      const [srcPP, srcK, srcMeals, srcPW, srcB64, srcRecipe, index] = await Promise.all(['../src/ui/photo-plat.js', '../src/ui/components.js', '../src/ui/meals.js', '../src/domain/photo-web.js', '../src/domain/base64.js', '../src/ui/recipe.js', '../index.html'].map(lire));
      const csp = /Content-Security-Policy" content="([^"]+)"/.exec(index)?.[1] || '';
      eq(/img-src ([^;]+)/.exec(csp)?.[1], "'self' blob: data:", 'CSP : img-src inchangée (aucune image externe chargée par le navigateur)');
      eq([srcPP, srcK, srcMeals].map((s) => /(?:\bsrc\s*:|\.src\s*=)\s*['"`]https?:/.test(s)), [false, false, false], 'aucun src d’image ne reçoit une adresse http(s) écrite en dur (photo-plat.js, components.js, meals.js)');
      eq([srcPP, srcPW, srcB64].map((s) => /Anthropic|Supabase/.test(s)), [false, false, false], 'aucun texte ne nomme le fournisseur ni la base (photo-plat.js, photo-web.js, base64.js)');
      eq([srcPP, srcRecipe].flatMap((s) => s.split('\n').filter((l) => l.includes('photo_source_url') && /textContent|\bt\(|\bel\(/.test(l))), [], 'D-F11 : photo_source_url n’entre dans aucune ligne qui porte textContent, t( ou el( (photo-plat.js, recipe.js)');
    });
```

**Limite nommée du bloc « cartes » (R-F-10).** Les vérifications négatives (`vSans`, `vHtml`, `vPdf` : cachées, sans `src`) sont GARDÉES, après
`attendre(vHeic visible) ; tick ; tick`. Elles tiennent par l'ordre des requêtes IndexedDB : chaque `vignettePlat` appelle `repo.getFile`
(`db.get('files', sha)` : une transaction en lecture seule par appel, relu dans `src/model/repo.js` et `src/core/db.js`), émises dans l'ordre
`vSans`, `vHtml`, `vPdf`, `vHeic` ; attendre la DERNIÈRE suppose que les trois premières ont abouti, et les deux `tick()` couvrent le `.then` qui
pose `src` et `hidden`. La norme IndexedDB ne garantit pas l'ordre d'achèvement de transactions en lecture seule concurrentes sur un même magasin
(hypothèse : Chromium les achève dans l'ordre de création ; non mesurée). Si l'ordre cédait, une négative serait lue avant que sa lecture ait
abouti : vraie par construction (l'élément naît caché, sans `src`), donc muette — un mutant de ces lignes (« `src` posé sans octets », « garde
`image/` retirée ») pourrait survivre un passage. **Consigne** : un rouge intermittent sur ces négatives — comme un mutant qui y survit — est
REJOUÉ avant d'en faire un constat (règle R-B-15 du lot B, même esprit : rejouer avant de conclure).

- [ ] **Step 2 : rouge lu** (« recipeCard : référence construite » : ROUGE pour la BONNE raison — « la vignette est le PREMIER enfant de .col »
  faux, le premier enfant est le badge —, ses deux autres assertions, balisage égal à la carte avec photo privée de sa vignette et gabarit, VERTES
  avant le changement : garde de régression ; « cartes » : `vignettePlat` absent, le bloc rougit par son
  `run` ; « styles.css » : rouge pour la BONNE raison — « la règle .plat-vignette est trouvée » faux, la règle est absente —, jamais par la regex ;
  « CSP et sources » : vert, c'est un filet, ses mutants sont au Step 7).
- [ ] **Step 3 : implémenter `components.js`** (avant `recipeCard`) :

```js
// Lot F (spec plats-en-images § 4.2, D-F9) : la vignette d'une carte de recette — décorative (alt vide : la carte porte le titre), née cachée ([hidden]
// du thème), montrée seulement quand les octets sont ICI et d'un type d'image (la règle d'affichage du lot G : typeAffichage puis displayUrl). Sans
// pointeur valide : null (la carte est celle d'avant le lot) ; sans octets : l'élément reste caché, sans src (I-F6).
export function vignettePlat(recipe, { repo: depot = repo } = {}) {
  const sha = recipe?.photo_sha256;
  if (typeof sha !== 'string' || !HASH.test(sha)) return null;
  const img = el('img', { class: 'plat-vignette', alt: '', loading: 'lazy', hidden: true });
  Promise.resolve().then(() => depot.getFile(sha)).then((f) => {
    if (!typeAffichage(f)?.startsWith('image/')) return;
    const u = displayUrl(f, urlDeBlob);
    if (!u) return;
    img.src = u; img.hidden = false;
  }).catch(() => {});
  return img;
}
// Les URL blob: des vignettes d'un conteneur : relevées AVANT son vidage et révoquées APRÈS par les écrans qui redessinent leur liste (D-T9).
export const urlsDesVignettes = (conteneur) => [...conteneur.querySelectorAll('img.plat-vignette')].map((i) => i.getAttribute('src')).filter((u) => typeof u === 'string' && u.startsWith('blob:'));
```

  `recipeCard` : `el('div', { class: 'col', style: { alignItems: 'flex-end', gap: '.3rem' } }, vignettePlat(recipe), availabilityBadge(recipe), …` (le reste inchangé ;
  `null` est ignoré par `el`). Import : `import { HASH } from '../model/schema.js';`.
- [ ] **Step 4 : implémenter `meals.js`, `search.js`, `book.js`, `styles.css`.** `meals.js` : `vignettePlat` ajouté à l'import de `./components.js` ; dans la
  boucle de `renderMeal` :

```js
  for (const it of items) {
    // Lot F (§ 4.2) : une vignette à gauche du titre quand les octets sont ici ; sans photo, le DOM de la carte est celui d'avant le lot.
    const vignette = vignettePlat(it.recipe);
    const bloc = el('div', null, el('a', { href: `#/recipes/${it.recipe.id}?v=${it.recipe_version_id || ''}` }, el('strong', null, it.recipe.display_title || it.recipe.original_title)), ' ', versionBadge(it.version, it.recipe),
      // S8 : l'hôte d'un signet est RECALCULÉ depuis l'adresse, ici comme ailleurs — `source_label` stocké peut
      // venir d'une archive ou du serveur et nommer n'importe quel site (S7). C-2 : une fiche IA est « Créée avec l’IA », texte de
      // libelleSource rendu ici par t() (seul ce texte-là est une clé ; un libellé libre de la personne n'est jamais traduit).
      el('div', { class: 'muted', style: { fontSize: '.85rem' } }, it.recipe.origine === 'ia' ? t(libelleSource(it.recipe)) : (ctx.editionLabel(ctx.editionsById.get(it.recipe.edition_id)) || libelleSource(it.recipe))));
    const card = el('div', { class: 'card flat stack' },
      el('div', { class: 'row between top' },
        vignette ? el('div', { class: 'row top', style: { flex: '1', minWidth: '0' } }, vignette, bloc) : bloc,
        el('div', { class: 'row' },
          select(MEAL_ROLES.map((r) => ({ value: r, label: label('meal_role', r) })), it.role, (v) => { meal.items.find((x) => x.id === it.id).role = v; save(); }),
          el('input', { type: 'number', min: 1, value: it.servings || meal.servings, style: { width: '80px' }, title: t('Portions de cet élément'), onChange: (e) => { const x = meal.items.find((y) => y.id === it.id); x.servings = Number(e.target.value) || meal.servings; x.servings_custom = true; save(); } }),
          el('button', { class: `btn small ${it.locked ? 'active' : ''}`, title: t('Verrouiller ce plat : jamais remplacé automatiquement'), onClick: () => { meal.items.find((x) => x.id === it.id).locked = !it.locked; save(); } }, it.locked ? '🔒' : '🔓'),
          el('button', { class: 'btn small', disabled: it.locked, onClick: () => replaceItem(it) }, t('Remplacer')),
          el('button', { class: 'btn small danger', disabled: it.locked, onClick: async () => { if (await confirmDialog(t('Retirer « {r} » du repas ? Les autres éléments restent.', { r: it.recipe.original_title }), { okLabel: t('Retirer') })) { meal.items = meal.items.filter((x) => x.id !== it.id); save(); } } }, t('Retirer')))),
      !it.version ? el('div', { class: 'status warn' }, t('Référence d’index seulement : ingrédients et durées inconnus.')) : null);
    list.append(card);
  }
```

  (la boucle de `bd03e48` recopiée telle quelle, à deux différences près : la vignette, et le bloc de gauche nommé `bloc` pour être enveloppé ; si C,
  D ou E ont touché cette boucle, c'est leur forme qui est gardée, avec les deux mêmes différences). `search.js` : imports
  `urlsDesVignettes` (de `./components.js`) et `revoquerUrlDeBlob` (de `../core/blob-urls.js`) ; en tête de `render()` :

```js
  function render() {
    // Lot F (§ 4.2, D-T9) : les URL des vignettes de la génération précédente, relevées AVANT le vidage, révoquées APRÈS.
    const anciennes = urlsDesVignettes(results);
    results.replaceChildren();
    for (const u of anciennes) revoquerUrlDeBlob(u);
```

  `book.js` : mêmes imports (A-11 : `revoquerUrlDeBlob` rejoint la ligne existante `import { urlDeBlob } from '../core/blob-urls.js';`, l. 10) ; en tête de `drawList` : `const anciennes = urlsDesVignettes(list); list.replaceChildren(); for (const u of anciennes) revoquerUrlDeBlob(u);`.
  `styles.css` (après les règles `.photo-plat` du lot G) :

```css
/* Lot F (D-F9) : la vignette d'une carte de recette — 72 px, recadrée, coins 8 px ; née [hidden] (aucun display:none neuf, T-1). */
.plat-vignette { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line); flex: 0 0 auto; }
```

- [ ] **Step 5 : vert** (suite : tout vert **sauf l'épingle**, relevée au Step 6 ; Node, `--check`) ; `tests/theme.js` vert sans changement
  (inventaire T-1, T-2) ; le bloc « recipeCard : référence construite » vert en entier. Mesuré au rejeu : `❌ 5844/5845` (l'épingle seule) ; Node 204/204 ;
  `--check` 0 ; les négatives du bloc « cartes » vertes (R-F-10).
- [ ] **Step 6 : épingle relevée ; `sw.js` `VERSION = 'cuisine-os-v0.15.0-3'`** (aucun module neuf) ; relancer la suite. Mesuré : épingle **5844** (5827 + 17),
  `✅ 5845/5845`.
- [ ] **Step 7 : mutants de la tâche** (copie servie sur 8190 ; chacun doit rougir) : `vignettePlat` pose un `src` sans octets · garde `image/` retirée (un PDF
  dans un `<img>`) · `displayUrl` remplacé par `URL.createObjectURL(f.blob)` sans `typeAffichage` (la ligne `text/html`) · révocation retirée du `render()` de
  `search.js` · révocation faite AVANT `replaceChildren()` dans `search.js` (`encore`) · révocation retirée du `drawList` de `book.js` · `recipeCard` qui
  enveloppe toujours la colonne — `.col` posée dans une enveloppe, ou une enveloppe vide en tête de `.col`, même sans photo (« recipeCard : référence
  construite » : gabarit, badge en tête) · `recipeCard` qui change le reste du balisage quand la photo est là (un attribut de plus sur `.col`, avec
  photo seulement) (« recipeCard : référence construite » : balisage égal) · un `display: none` ajouté à `.plat-vignette` (« styles.css ») · une adresse
  `https://…` écrite en dur dans un `src:` de `photo-plat.js` (filet de source) · le mot du fournisseur ajouté dans un commentaire de `photo-web.js` (filet de source).
- [ ] **Step 8 : invisibles** sur les fichiers touchés : 0.
- [ ] **Step 9 : commit** `Cartes illustrees : vignette du plat dans recipeCard et les repas, revocation au redessin (lot F, tache 4)`.

---

### Task 5 : Import web → rapatriement, « Corriger » relu, régression

Spec § 9 tâche 5 ; § 4.3 points 1, 2 (déclenchement), 4 et 5 ; D-F3, D-F16 (« Corriger » et tout écrivain neuf), D-F18, D-F19, R-F-2, S-12 ; tests
§ 7.4 (import web, régression « Corriger », archive, capture — P-11) ; mutants § 7.5 rejoués sur l'état final. Les documents passent à la Clôture
(P-10). `sw.js` `-4`.

**Files:**
- Modify: `src/ui/import-web.js` (lot B ; l. 6-21 imports — deux lignes neuves après la l. 21 — ; l. 243-276 `enregistrerLecture` ; dans `renderImportWeb`
  (l. 282) : `etat` l. 286, `charger` l. 300-311, `enregistrer` l. 354-363, `zoneLue` l. 393-419, la ligne du mode l. 401)
- Modify: `src/ui/recipe-edit.js` (l. 14 import ; dans `save()`, l. 280, juste avant `assertVocabulaire(rec, 'recipes')` — l. 297 à `4cb99a0`, l. 285 à
  `bd03e48`, l. 341 à `35fb29c` (le lot D a posé `pageUpdates` entre la copie `rec`, l. 324, et elle) — : les trois champs de la photo repris de la fiche relue)
- Modify: tout écrivain (c) neuf HORS de `src/ui/recipe.js` relevé par le recensement du Step 0 (amendement nommé, même correction que ★ Favori ;
  ceux de `recipe.js` sont corrigés et testés à la tâche 3)
- Modify: `tests/lecture-web.js` (lot B : un bloc neuf avant la fin du `try` de `runLectureWebTests`, après « lot F — fabriquerLectureWeb » de la tâche 2),
  `tests/photo-plat.js` (un bloc au-dessus du repère de fin), `tests/tests.js` (épingle), `sw.js` (`VERSION` `-4`)

**Interfaces:**
- Consumes : tâche 2 (`candidatPhotoWeb`, `originePhotoAdmise`, `fabriquerLectureWeb(…, { photoAnnoncee })` → `photoWeb`) ; tâche 3 (`ligneAnnoncePhotoWeb`,
  `rapatrierPhotoWeb`, `attendreRecuperation`, `recuperationEnCours`, `poserPhotoPlat`, `reinitialiserPhotoPlat`, `renderRecipe(params, query, ctx, deps)`) ;
  lot B (`enregistrerLecture`, `renderImportWeb`, `relireResultat`, `reinitialiserLectureWeb`, `reinitialiserVol` de `src/ui/vol.js`, `cleLecture` de
  `src/domain/import-cible.js` — P-12 de B —, `TransitionRefusee` de `src/core/db.js`) ; lot A
  (`renderImportCible(params, query, ctx, deps)`, qui ouvre la variante web pour une fiche à adresse) ; `createPush` (`src/sync/push.js`),
  `creerTransportFactice` (`tests/transport-factice.js`), `createArchive`, `inspectArchive`, `applyArchive`, `verifyRestored` (`src/domain/backup.js`).
- Produces (`src/ui/import-web.js`) :

```js
export async function enregistrerLecture(importId, { repo = repoModule, remplacer = null, maintenant = horloge, choisir = chooseDialog, cle = null, ctx = null, fetch: fetchInjecte = undefined, enLigne = () => enLigneFlag, photoAnnoncee = null } = {})
  // → { issue: 'enregistre', recipeId, versionId } | { issue: 'annule' } | { issue: 'refuse', raison } | { issue: 'echec', raison: 'illisible' } (rendu du plan B
  //   rév. 2 inchangé : `cle`, le refus `lecture` et la clôture `cloture` de B gardés)
  // effet de plus : APRÈS la transaction réussie, si fab.photoWeb, rapatrierPhotoWeb(recipeId, { candidat: fab.photoWeb, ctx, repo, fetch, enLigne }) SANS await
```

  `renderImportWeb` : `etat.photoAnnoncee` (l'adresse annoncée, ou `null`), calculée par `charger()` ; `root.etatRouteWeb()` INCHANGÉ (B l'épingle par
  `deepEqual`). (`src/ui/recipe-edit.js`) : `save()` écrit `photo_sha256`, `photo_origin` (par `originePhotoAdmise`) et `photo_source_url` tels que la
  fiche RELUE les porte (clés absentes en base → absentes de l'écriture : P-6).

- [ ] **Step 0 : relevés (aucune écriture).** (1) Relire dans le code réel de B : `enregistrerLecture` (signature — au plan B rév. 2
  `{ repo, remplacer, maintenant, choisir, cle }` —, le refus `lecture`, la clôture `cloture` passée en `patch` FONCTION, les deux appels de
  `fabriquerLectureWeb` — la seconde avec `remplacer: false` —, la transaction, ce qu'elle rend ; `cleLecture`, importée de
  `src/domain/import-cible.js` depuis B), `renderImportWeb` (`etat`, `charger`, `enregistrer` — au plan B rév. 2 il passe `cle: cleLecture(L)` —,
  `zoneLue` : l'ordre des lignes « bandeau », « Selon la page », « mode »), la délégation de `renderImportCible` vers la variante web. (2) Relire `save()`
  de `src/ui/recipe-edit.js` (la copie `{ ...targetRecipe }` et l'appel d'`assertVocabulaire(rec, 'recipes')`). (3) Relire `createPush(…).envoyer()` et
  `creerTransportFactice({ serveur: true }).ligne(store, id)` (G a pu toucher l'envoi des lignes `files` : le test de capture n'affirme que la ligne
  `recipes`). (4) **Recensement D-F16 refait** sur la tête du lot E, pour toute écriture de `recipes` ajoutée par B, C, D ou E :

  ```bash
  python3 -I - <<'PY'
  import glob, re
  motifs = [r"save\(\s*'recipes'", r"\brecipes\s*:\s*\[", r"puts\s*:\s*\{[^}]*\brecipes\b", r"\.recipes\s*=", r"\brecipes\.push\(", r"saveBatch\(", r"transitionner\(", r"\.mutate\("]
  for f in sorted(glob.glob('src/**/*.js', recursive=True)):
      for i, l in enumerate(open(f, encoding='utf-8'), 1):
          if any(re.search(m, l) for m in motifs):
              print(f'{f}:{i}: {l.strip()[:200]}')
  PY
  ```

  Compléter `.superpowers/sdd/2026-10-19-plats-en-images/recensement-D-F16.md` (commencé à la tâche 3) : chaque ligne qui écrit `recipes` est (a)
  « fabrique sa fiche », (b) « relit la fiche juste avant » ou (c) « part d'une copie du RENDU ». Au prototype B : `import-web.js` l. 159 (création du
  signet, mur `absente: true`) = (a) ; l. 219 (`fabriquerLectureWeb` sur le signet relu) = (b) ; aucun (c) neuf. **Chaque (c) neuf de C, D ou E HORS
  de `src/ui/recipe.js`** (ceux de `recipe.js` sont corrigés et testés à la tâche 3, Step 9 : ne pas y revenir) est corrigé ICI comme ★ Favori (relire par `repo.get`, n'écrire que ses champs sur la fiche relue) et reçoit son test, écrit sur le gabarit du test
  « D-F16 : ★ Favori » de la tâche 3 : fiche rendue sans photo, `rapatrierPhotoWeb` aboutit, puis le geste de l'écrivain, et la fiche écrite porte
  encore `photo_sha256`, `photo_origin: 'web'` et `photo_source_url` (amendement nommé, spec § 12). **Lignes (R-F-11)** : les numéros cités par
  cette tâche — prototype B (`import-web.js` l. 6-21, 159, 200-224, 219, 231-351), `bd03e48` et `4cb99a0` (`recipe-edit.js` l. 14, 270 / 282,
  285 / 297) — sont relus sur la tête du lot E ; tout écart est un amendement nommé, pas un constat (R-C-7).
  **Relevé du rejeu (`35fb29c`)** : `enregistrerLecture` (l. 243-276) n'est plus la forme du plan B rév. 2 : depuis la ronde 1 de la tâche 5 de B, le signet et
  ses versions sont RELUS APRÈS le dialogue (`relire`, `fondement`, la question reposée si ce qui la fonde a changé), `fabriquerLectureWeb` est appelé UNE
  fois, après le choix (`remplacer: false` passé si « Ajouter sans remplacer »), et la fiche s'appelle `fiche.signet` (EI-6) ; `renderImportWeb` : `etat` porte
  déjà `lu` (la lecture relue UNE fois par chargement), `charger()` relit la ligne préférée et rejoue deux passes `marquerIllisible` (EI-7) ; `zoneLue` : la
  ligne du mode est la dernière de l'appel `el('div', { class: 'stack', dataset: { role: 'lecture' } }, …)` (l. 398-401) ; `save()` de `recipe-edit.js` : copie
  `{ ...targetRecipe }` l. 324, `assertVocabulaire(rec, 'recipes')` l. 341 ; `createPush(…).envoyer()` et `creerTransportFactice({ serveur: true }).ligne(store,
  id)` présents ; recensement D-F16 refait : aucun (c) neuf hors de `recipe.js` (Step 0 de la tâche 3).

- [ ] **Step 1 : tests rouges — `tests/lecture-web.js`** (lot B ; bloc neuf, avant la fin du `try` de `runLectureWebTests` ; `run`, `eq`, `ok`, `lire` du
  fichier ; aucun réseau) :

```js
    // === Lot F (spec plats-en-images § 4.3) : l'écran a_verifier ANNONCE l'essai, « Enregistrer » le déclenche APRÈS la transaction ; le texte ne
    // dépend jamais de l'image (I-F4) ; un appel ne part que pour l'adresse annoncée (S-12) ; « Ajouter sans remplacer » descend aussi (R-F-2).
    await run('lot F — import web : annonce, ordre, déclenchement, « Ajouter sans remplacer », échec, relecture (§ 4.3, I-F4, S-12, R-F-2)', () => withRepo(async (repo, db) => {
      const IC = await import('../src/ui/import-cible.js');
      const W = await import('../src/ui/import-web.js');
      const V = await import('../src/ui/vol.js');
      const PP = await import('../src/ui/photo-plat.js');
      const { renderRecipe } = await import('../src/ui/recipe.js');
      const srcWeb = await lire('../src/ui/import-web.js'); // lu AVANT de couper le réseau
      V.reinitialiserVol(); W.reinitialiserLectureWeb(); PP.reinitialiserPhotoPlat();
      const vraiFetch = globalThis.fetch; let reseau = 0;
      globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
      const vraiErreur = console.error; const journal = [];
      console.error = (...a) => { journal.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
      const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
      const mutate = db.mutate.bind(db);
      try {
        const NOW = '2026-10-19T12:00:00.000Z'; const DATE = '2026-10-19T00:00:00.000Z';
        const H = (c) => c.repeat(64);
        const IMG = 'https://cdn.site.test/puttanesca.jpg'; const IMG2 = 'https://cdn.site.test/autre.jpg';
        const SESSION = { access_token: 'jeton-photo-web-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
        const signet = (id, over = {}) => ({ id, edition_id: null, original_title: 'site.test', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: `https://site.test/${id}`, source_label: 'site.test', created_at: DATE, updated_at: DATE, ...over });
        const humaine = (rid) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }], provenance: { generated_by: 'manual' }, verification_state: 'verified', created_at: DATE, updated_at: DATE });
        const ctxDe = async () => {
          const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
          return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])), editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(), imports: await db.getAll('imports'), settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' }, sync: { user: { id: 'u1', email: 'a@exemple.invalid' }, auth: { jeton: async () => SESSION } }, conventionFor: () => null,
            dishesById: new Map(), cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: [], ingredientsById: new Map(), dishes: [], source_documents: [], source_pages: [], rediscovery_prefs: [], docsByRecipe: new Map(), scan_sessions: [] };
        };
        const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
        const PAGE = { url_finale: 'https://site.test/r', hote: 'site.test', titre_page: 'P', auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: NOW, autres_recettes: 0, texte_coupe: false };
        const RECETTE = { title: 'Pâtes puttanesca', servings: 4, prep_minutes: 20, cook_minutes: 20, total_minutes: 40, ingredients: [{ source_text: '250 g de spaghettis', uncertain: false }, { source_text: '1 boîte de tomates', uncertain: false }], steps: [{ text: 'Cuire.' }, { text: 'Servir.' }], notes: 'Un classique.', incomplete: false };
        const ld = (page = {}) => ({ source_kind: 'jsonld', page: { ...PAGE, ...page }, recette: RECETTE, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null });
        // L'image que la fonction rend : une PNG 800 × 600 en base64 (un seul btoa sur la chaîne binaire entière : la même chaîne que la tranche de 3 du serveur).
        const corpsPng = async (couleur) => {
          const toile = new OffscreenCanvas(800, 600); const cx = toile.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, 800, 600);
          const u8 = new Uint8Array(await (await toile.convertToBlob({ type: 'image/png' })).arrayBuffer());
          let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
          return { type: 'image/png', taille: u8.length, url_finale: IMG, octets: btoa(s) };
        };
        const IMAGE_A = await corpsPng('#3a7'); const IMAGE_B = await corpsPng('#a37');
        // Le fetch factice : chaque appel est noté { outil, url } et dans `evenements` ; une lecture répond par la file `lectures`, une image par la file
        // `images` (file vide : IMAGE_A).
        const appels = []; const evenements = []; const lectures = []; const images = [];
        const ff = async (url, options) => {
          const corps = JSON.parse(options.body);
          appels.push({ outil: corps.outil, url: corps.corps?.url }); evenements.push('fetch:' + corps.outil);
          if (corps.outil === 'lecture-web') return reponse(...(lectures.shift() || [200, ld()]));
          return reponse(...(images.shift() || [200, IMAGE_A]));
        };
        const postsImage = () => appels.filter((a) => a.outil === 'image-web');
        const espionner = () => { db.mutate = (o) => { evenements.push('mutate:' + [...Object.keys(o.puts || {}), ...Object.keys(o.conditions || {})].sort().join('+')); return mutate(o); }; };
        const navs = []; const dits = []; const choix = { suivant: [], appels: 0 };
        const choisir = async () => { choix.appels += 1; return choix.suivant.length ? choix.suivant.shift() : null; };
        const gestes = (deps = {}) => ({ repo, navigate: (x) => navs.push(x), toast: (m) => dits.push(m), fetch: ff, maintenant: () => NOW, enLigne: () => true, choisir, ...deps });
        const monter = async (id, deps = {}) => { const root = await IC.renderImportCible({ id }, {}, await ctxDe(), gestes(deps)); scene.append(root); return root; };
        const bouton = (root, texte) => [...root.querySelectorAll('button')].find((x) => x.textContent === texte) || null;
        const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
        const ligneDe = async (recipeId) => (await db.byIndex('imports', 'recipe_id', recipeId)).find((i) => !['enregistre', 'ignore'].includes(i.status)) || null;
        // Lire une fiche (la lecture rend `page`), puis attendre l'aperçu a_verifier rendu.
        const lireAvec = async (id, page = {}, deps = {}) => {
          scene.replaceChildren(); // l'écran précédent est détaché (B : il se désabonne à la notification suivante)
          lectures.push([200, ld(page)]);
          const root = await monter(id, deps);
          bouton(root, 'Lire la recette avec l’assistant').click();
          await attendre(async () => (await ligneDe(id))?.status === 'a_verifier' && root.etatRouteWeb().status === 'a_verifier', 'aperçu de ' + id);
          return root;
        };
        // « Enregistrer » qui navigue ; la descente éventuelle est attendue avant de continuer (aucune descente ne survit à la base jetable).
        const enregistrer = async (root, id) => { const n = navs.length; bouton(root, 'Enregistrer').click(); await attendre(() => navs.length > n, 'enregistré : ' + id); await PP.attendreRecuperation(id); };
        const ANNONCE = 'Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour.';
        const annonce = (root) => root.querySelector('[data-role="photo-web-annonce"]');
        const enFiche = async (id) => { const p = await renderRecipe({ id }, {}, await ctxDe(), { pickFiles: async () => [], toast: () => {}, fetch: ff, enLigne: () => true }); scene.append(p); return p; };

        // 1. Ordre (Review Focus 2, I-F4) : la transaction AVANT le premier POST image-web, puis UN POST, puis files, puis la photo sur la fiche.
        await db.mutate({ puts: { recipes: [signet('rc_o')] }, origin: 'device' });
        let root = await lireAvec('rc_o', { image_url: IMG });
        const ligneAnnonce = annonce(root);
        const mode = root.querySelector('[data-role="mode"]');
        eq([ligneAnnonce?.tagName, ligneAnnonce?.className, ligneAnnonce?.textContent, !!mode && !!ligneAnnonce && !!(mode.compareDocumentPosition(ligneAnnonce) & Node.DOCUMENT_POSITION_FOLLOWING)], ['SMALL', 'muted', ANNONCE, true],
          'écran a_verifier : small.muted « Après l’enregistrement, l’app essaiera de récupérer… » (un ESSAI et son coût), sous la ligne du mode');
        evenements.length = 0; espionner();
        try { await enregistrer(root, 'rc_o'); } finally { db.mutate = mutate; }
        const iTx = evenements.indexOf('mutate:imports+recipe_versions+recipes'); const iImg = evenements.indexOf('fetch:image-web');
        const iFiles = evenements.findIndex((e, i) => i > iImg && e === 'mutate:files');
        const iPhoto = evenements.findIndex((e, i) => i > iFiles && e === 'mutate:recipes');
        eq([iTx >= 0, iTx < iImg, iFiles > iImg, iPhoto > iFiles, evenements.filter((e) => e === 'fetch:image-web').length], [true, true, true, true, 1],
          'ordre : la transaction (recipes, recipe_versions, imports enregistre) est écrite AVANT le premier POST image-web, puis UN POST, puis files, puis la photo sur la fiche');
        const o = await db.get('recipes', 'rc_o');
        eq([o.availability, o.photo_origin, o.photo_source_url, /^[0-9a-f]{64}$/.test(o.photo_sha256 ?? ''), (await db.byIndex('imports', 'recipe_id', 'rc_o'))[0].status, postsImage().at(-1).url],
          ['available', 'web', IMG, true, 'enregistre', IMG], 'Enregistrer : la recette enregistrée, puis la photo web posée avec sa provenance ; l’import reste enregistre ; l’adresse demandée est l’annoncée');

        // 2. Sans candidat, aucune annonce et aucun POST : pas d'image, une photo de la personne, la même image web déjà là.
        await db.mutate({ puts: { recipes: [signet('rc_sans'), signet('rc_perso', { photo_sha256: H('a'), photo_origin: 'image' }), signet('rc_meme', { photo_sha256: H('b'), photo_origin: 'web', photo_source_url: IMG })] }, origin: 'device' });
        for (const [id, page, nom] of [['rc_sans', {}, 'sans image'], ['rc_perso', { image_url: IMG }, 'photo de la personne'], ['rc_meme', { image_url: IMG }, 'même image web déjà là']]) {
          const n = postsImage().length;
          root = await lireAvec(id, page);
          eq(annonce(root), null, `annonce absente (${nom})`);
          await enregistrer(root, id);
          eq(postsImage().length - n, 0, `${nom} : zéro POST image-web à l’enregistrement`);
        }
        const perso = await db.get('recipes', 'rc_perso');
        eq([perso.photo_sha256, perso.photo_origin], [H('a'), 'image'], 'une photo de la personne reste après l’enregistrement d’une lecture (I-F5)');

        // 3. S-12, les deux sens : un appel ne part que pour une adresse ANNONCÉE et encore candidate.
        await db.mutate({ puts: { recipes: [signet('rc_s1'), signet('rc_s2', { photo_sha256: H('c'), photo_origin: 'image' })] }, origin: 'device' });
        root = await lireAvec('rc_s1', { image_url: IMG });
        ok(!!annonce(root), 'S-12 : annonce affichée (rc_s1)');
        await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_s1')), photo_sha256: H('d'), photo_origin: 'image' }] }, origin: 'device' });
        let n = postsImage().length;
        await enregistrer(root, 'rc_s1');
        eq([postsImage().length - n, (await db.get('recipes', 'rc_s1')).photo_sha256], [0, H('d')], 'S-12 : annonce affichée, puis une photo posée dans un autre onglet avant « Enregistrer » → zéro POST, la photo reste');
        root = await lireAvec('rc_s2', { image_url: IMG });
        eq(annonce(root), null, 'S-12 : aucune annonce au rendu (fiche avec une photo de la personne)');
        await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_s2')), photo_sha256: null, photo_origin: null }] }, origin: 'device' });
        n = postsImage().length;
        await enregistrer(root, 'rc_s2');
        eq(postsImage().length - n, 0, 'S-12 : aucune annonce, puis photo retirée avant « Enregistrer » → zéro POST (rien n’a été annoncé)');

        // 4. TransitionRefusee : un autre onglet a enregistré juste avant → aucun POST image-web.
        await db.mutate({ puts: { recipes: [signet('rc_tr')] }, origin: 'device' });
        // La transition d'« Enregistrer » est la SEULE qui écrit une version (`puts.recipe_versions`) ; son `patch` est une FONCTION (`cloture`, plan B
        // rév. 2), jamais lue ici. L'autre onglet écrit `enregistre` juste avant ; la vraie transition refuse alors (TransitionRefusee). `courses`
        // prouve que la course a bien été simulée (sans lui, un faux repo qui ne se déclenche jamais laisserait l'enregistrement réussir).
        let courses = 0;
        const repoCourse = { ...repo, transitionner: async (store, key, opts) => {
          if (store === 'imports' && opts?.puts?.recipe_versions) { courses += 1; const l = await db.get('imports', key); await db.mutate({ puts: { imports: [{ ...l, status: 'enregistre' }] }, origin: 'device' }); }
          return repo.transitionner(store, key, opts);
        } };
        root = await lireAvec('rc_tr', { image_url: IMG }, { repo: repoCourse });
        ok(!!annonce(root), 'annonce affichée (rc_tr)');
        n = postsImage().length;
        bouton(root, 'Enregistrer').click();
        await attendre(() => root.etatRouteWeb().status !== 'a_verifier', 'écran redessiné après le refus');
        await PP.attendreRecuperation('rc_tr');
        eq([courses, postsImage().length - n, (await db.get('recipes', 'rc_tr')).photo_source_url ?? null, navs.some((x) => x.startsWith('/recipes/rc_tr'))], [1, 0, null, false],
          'TransitionRefusee à l’enregistrement (la course simulée UNE fois) → aucun POST image-web, rien d’écrit sur la fiche, aucune navigation');

        // 5. « Ajouter sans remplacer » (R-F-2, B-24) : la transaction sans put recipes, PUIS un POST ; réussite → les trois champs ; échec → fiche intacte.
        await db.mutate({ puts: { recipes: [signet('rc_aj', { availability: 'available', verification_state: 'verified', current_version_id: 'rv_rc_aj', original_title: 'Pâtes de Mamie' }),
          signet('rc_aj2', { availability: 'available', verification_state: 'verified', current_version_id: 'rv_rc_aj2', original_title: 'Pâtes de Papi' })], recipe_versions: [humaine('rc_aj'), humaine('rc_aj2')] }, origin: 'device' });
        root = await lireAvec('rc_aj', { image_url: IMG });
        ok(!!annonce(root), 'annonce affichée (rc_aj : une version écrite à la main)');
        const avantAj = await db.get('recipes', 'rc_aj');
        choix.suivant.push('ajouter'); evenements.length = 0; espionner();
        try { await enregistrer(root, 'rc_aj'); } finally { db.mutate = mutate; }
        const aj = await db.get('recipes', 'rc_aj');
        eq([evenements[0], evenements.indexOf('mutate:imports+recipe_versions') < evenements.indexOf('fetch:image-web'), evenements.filter((e) => e === 'fetch:image-web').length], ['mutate:imports+recipe_versions', true, 1],
          '« Ajouter sans remplacer » : la transaction n’a AUCUN put recipes (imports en condition, recipe_versions : B-24 inchangé), PUIS un POST image-web');
        eq([aj.current_version_id, aj.original_title, aj.photo_origin, aj.photo_source_url, /^[0-9a-f]{64}$/.test(aj.photo_sha256 ?? '')], [avantAj.current_version_id, 'Pâtes de Mamie', 'web', IMG, true],
          '« Ajouter sans remplacer », réussite : la version courante et le titre intacts, les trois champs de la photo écrits ENSEMBLE');
        root = await lireAvec('rc_aj2', { image_url: IMG });
        const avantAj2 = await db.get('recipes', 'rc_aj2');
        choix.suivant.push('ajouter'); images.push([502, { erreur: 'inaccessible' }]);
        n = postsImage().length;
        await enregistrer(root, 'rc_aj2');
        const pAj2 = await enFiche('rc_aj2');
        eq([postsImage().length - n, await db.get('recipes', 'rc_aj2'), pAj2.querySelector('[data-role="photo-web-etat"]')], [1, avantAj2, null],
          '« Ajouter sans remplacer », échec : un POST, puis la fiche INTACTE (aucune clé changée) et aucune ligne « non récupérée » (aucun candidat écrit)');
        pAj2.remove();

        // 6. « Annuler » du dialogue (B-13) : rien d'écrit, rien ne part.
        await db.mutate({ puts: { recipes: [signet('rc_an', { availability: 'available', verification_state: 'verified', current_version_id: 'rv_rc_an', original_title: 'Pâtes de Tata' })], recipe_versions: [humaine('rc_an')] }, origin: 'device' });
        root = await lireAvec('rc_an', { image_url: IMG });
        choix.suivant.push(null); choix.appels = 0; n = postsImage().length;
        bouton(root, 'Enregistrer').click();
        await attendre(() => choix.appels > 0 && !!bouton(root, 'Enregistrer') && !bouton(root, 'Enregistrer').disabled, 'dialogue fermé');
        await PP.attendreRecuperation('rc_an');
        eq([postsImage().length - n, (await ligneDe('rc_an')).status, PP.recuperationEnCours('rc_an')], [0, 'a_verifier', false], '« Annuler » du dialogue → zéro POST, l’import reste a_verifier');

        // 7. Échec du rapatriement (I-F4) : l'import reste enregistre, la version et availability intactes, la fiche dit « non récupérée ».
        await db.mutate({ puts: { recipes: [signet('rc_ec')] }, origin: 'device' });
        root = await lireAvec('rc_ec', { image_url: IMG });
        images.push([502, { erreur: 'inaccessible' }]); journal.length = 0; dits.length = 0;
        await enregistrer(root, 'rc_ec');
        const ec = await db.get('recipes', 'rc_ec');
        eq([(await db.byIndex('imports', 'recipe_id', 'rc_ec'))[0].status, ec.availability, ec.verification_state, !!(await db.get('recipe_versions', ec.current_version_id)), ec.photo_sha256 ?? null, ec.photo_source_url, journal.some((l) => l.includes('photo_web.echec'))],
          ['enregistre', 'available', 'to_verify', true, null, IMG, true], 'échec du rapatriement : import enregistre, version et availability intactes, photo_source_url gardé (rapatriement attendu), logError photo_web.echec');
        const pEc = await enFiche('rc_ec');
        eq([pEc.querySelector('[data-role="zone-photo-plat"]')?.textContent.includes('Photo du plat non récupérée.'), pEc.querySelector('[data-role="raison-photo-web"]'), dits], [true, null, ['Recette enregistrée']],
          'échec du rapatriement : la zone de la fiche dit « Photo du plat non récupérée. », AUCUNE raison (départ automatique) ; le seul toast est celui de l’enregistrement (aucun toast de l’image)');
        pEc.remove();

        // 8. Relecture (§ 4.3 point 4) : même image → rien ; autre image → un POST et la photo remplacée ; photo choisie à la main → rien (B-10, P-12).
        root = await lireAvec('rc_o', { image_url: IMG });
        eq(annonce(root), null, 'relecture, même image_url → aucune annonce');
        n = postsImage().length;
        await enregistrer(root, 'rc_o');
        eq(postsImage().length - n, 0, 'relecture, même image_url → aucun POST');
        const shaAvant = (await db.get('recipes', 'rc_o')).photo_sha256;
        root = await lireAvec('rc_o', { image_url: IMG2 });
        ok(!!annonce(root), 'relecture, autre image_url → annonce');
        images.push([200, IMAGE_B]); n = postsImage().length;
        await enregistrer(root, 'rc_o');
        const rel = await db.get('recipes', 'rc_o');
        eq([postsImage().length - n, postsImage().at(-1).url, rel.photo_sha256 !== shaAvant, rel.photo_origin, rel.photo_source_url], [1, IMG2, true, 'web', IMG2], 'relecture, autre image_url → un POST et la photo remplacée, avec SA provenance');
        const toile = new OffscreenCanvas(640, 480); const cx = toile.getContext('2d'); cx.fillStyle = '#36c'; cx.fillRect(0, 0, 640, 480);
        const mienne = new File([await toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], 'mienne.jpg', { type: 'image/jpeg' });
        eq((await PP.poserPhotoPlat('rc_o', mienne, { repo, origin: 'image' })).issue, 'ok', 'photo choisie à la main sur la photo web');
        const shaMienne = (await db.get('recipes', 'rc_o')).photo_sha256;
        root = await lireAvec('rc_o', { image_url: IMG2 });
        eq(annonce(root), null, 'B-10 : relecture de la même page après une photo choisie à la main → aucune annonce');
        n = postsImage().length;
        await enregistrer(root, 'rc_o');
        const apresMain = await db.get('recipes', 'rc_o');
        eq([postsImage().length - n, apresMain.photo_sha256, apresMain.photo_origin, apresMain.photo_source_url], [0, shaMienne, 'image', null], 'B-10 : zéro POST image-web, la photo de la personne intacte (I-F5)');

        // 9. Filets : aucun réseau ; image_url n'est jamais rendue (D-F11, test de source sur import-web.js).
        eq([reseau, appels.every((a) => a.outil === 'lecture-web' || a.outil === 'image-web')], [0, true], 'aucun appel réseau hors du fetch injecté ; seuls lecture-web et image-web');
        eq(srcWeb.split('\n').filter((l) => l.includes('image_url') && /textContent|\bt\(|\bel\(/.test(l)), [], 'D-F11 : image_url n’entre dans aucune ligne d’import-web.js qui porte textContent, t( ou el(');
      } finally {
        db.mutate = mutate; console.error = vraiErreur; globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); V.reinitialiserVol(); W.reinitialiserLectureWeb();
        (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
      }
    }));
```

- [ ] **Step 2 : tests rouges — `tests/photo-plat.js`, bloc « régression »** (au-dessus du repère de fin ; P-11 : la capture vit ici) :

```js
    // ===== Tâche 5 — régression (spec § 7.4 « Régression », § 3.1 ; P-11)
    await run('régression : « Corriger » relit la photo (D-F16, D-F19), archive aller-retour, capture et envoi', () => withRepo(async (repo, db) => {
      const PP = await import('../src/ui/photo-plat.js');
      const { renderRecipeEdit } = await import('../src/ui/recipe-edit.js');
      const { createArchive, inspectArchive, applyArchive, verifyRestored } = await import('../src/domain/backup.js');
      const { createPush } = await import('../src/sync/push.js');
      const { creerTransportFactice } = await import('./transport-factice.js');
      PP.reinitialiserPhotoPlat();
      const scene = nouvelleScene();
      const adresseAvant = location.href;
      const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
      try {
        const jpeg = await imageTest('c.jpg', '#c63', 640, 480); const sha = await sha256Hex(jpeg);
        await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
        const idsDe = async (rid) => new Set((await db.byIndex('recipe_versions', 'recipe_id', rid)).map((v) => v.id));
        // « Corriger » joué PAR l'éditeur : rendu, geste éventuel pendant l'édition, « Enregistrer une nouvelle version » ; l'adresse posée par la
        // navigation est rendue (motif de tests/import-cible.js, Review Focus 5 du lot A).
        const corriger = async (rid, pendantEdition = async () => {}) => {
          const ed = await renderRecipeEdit({ id: rid }, { kind: 'correction' }, await ctxPour(repo, db)); scene.append(ed);
          await pendantEdition();
          const avant = await idsDe(rid);
          bouton(ed, 'Enregistrer une nouvelle version').click();
          await attendre(async () => (await idsDe(rid)).size === avant.size + 1, 'version écrite (' + rid + ')');
          await tick(); history.replaceState(null, '', adresseAvant); ed.remove();
          return db.get('recipes', rid);
        };
        // 1. Une fiche à photo garde ses trois champs (garde de régression : verte avant le changement).
        await db.mutate({ puts: { recipes: [fiche('rc_k1', { source_url: 'https://site.test/k1', photo_sha256: sha, photo_origin: 'web', photo_source_url: 'https://cdn.test/k1.jpg' })], recipe_versions: [version('rc_k1')] }, origin: 'device' });
        const k1 = await corriger('rc_k1');
        eq([k1.photo_sha256, k1.photo_origin, k1.photo_source_url], [sha, 'web', 'https://cdn.test/k1.jpg'], '« Corriger » sur une fiche à photo : la fiche écrite garde photo_sha256, photo_origin, photo_source_url');
        // 2. D-F16 (rouge d'abord) : une photo écrite en base PENDANT l'édition (descente web, autre onglet) survit à « Enregistrer ».
        await db.mutate({ puts: { recipes: [fiche('rc_k2', { photo_source_url: 'https://cdn.test/k2.jpg' })], recipe_versions: [version('rc_k2')] }, origin: 'device' });
        const k2 = await corriger('rc_k2', async () => { await db.mutate({ puts: { recipes: [{ ...(await db.get('recipes', 'rc_k2')), photo_sha256: sha, photo_origin: 'web' }] }, origin: 'device' }); });
        eq([k2.photo_sha256, k2.photo_origin, k2.photo_source_url], [sha, 'web', 'https://cdn.test/k2.jpg'], 'D-F16 : éditeur rendu, puis une photo écrite en base, puis « Enregistrer » → la fiche écrite porte les trois champs de la BASE');
        // 3. D-F19 (rouge d'abord) : une origine hors liste relue se lit null, sans lever.
        await db.mutate({ puts: { recipes: [fiche('rc_k3', { photo_sha256: sha, photo_origin: 'appareil' })], recipe_versions: [version('rc_k3')] }, origin: 'device' });
        const k3 = await corriger('rc_k3');
        eq([k3.photo_sha256, k3.photo_origin], [sha, null], 'D-F19 : « Corriger » d’une fiche relue avec photo_origin « appareil » ne lève pas ; photo_origin null écrit, le pointeur gardé');
        // 4. P-6 : une fiche d'avant le lot ne gagne aucune clé de photo (garde de régression).
        await db.mutate({ puts: { recipes: [fiche('rc_k4')], recipe_versions: [version('rc_k4')] }, origin: 'device' });
        const k4 = await corriger('rc_k4');
        eq(['photo_sha256', 'photo_origin', 'photo_source_url'].map((k) => Object.hasOwn(k4, k)), [false, false, false], '« Corriger » d’une fiche d’avant le lot : aucune clé de photo ajoutée (P-6)');

        // 5. Archive aller-retour (§ 3.1) : une fiche à photo web voyage intacte, ses octets aussi, zéro écart.
        await withDatabase(async (source) => {
          await source.mutate({ puts: {
            files: [{ sha256: sha, mime: 'image/jpeg', blob: jpeg, size: jpeg.size, syncable: true, created_at: DATE, updated_at: DATE }],
            recipes: [fiche('rc_ar', { source_url: 'https://site.test/ar', photo_sha256: sha, photo_origin: 'web', photo_source_url: 'https://cdn.test/ar.jpg' })],
            recipe_versions: [version('rc_ar')],
          }, origin: 'device' });
          const inspection = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
          ok(inspection.ok, 'archive : la fixture est acceptée (' + (inspection.errors || []).join(' · ') + ')');
          await withDatabase(async (cible) => {
            await applyArchive(cible, inspection, { mode: 'replace' });
            const v = await verifyRestored(cible, inspection, { mode: 'replace' });
            const ar = await cible.get('recipes', 'rc_ar');
            eq([v.ok, v.diffs, ar.photo_sha256, ar.photo_origin, ar.photo_source_url, (await cible.get('files', sha))?.blob instanceof Blob], [true, [], sha, 'web', 'https://cdn.test/ar.jpg', true],
              'archive aller-retour d’une fiche à photo web : champs intacts, octets restaurés, verifyRestored zéro écart');
          });
        });

        // 6. La photo rapatriée voyage (P-11) : l'écriture de rapatrierPhotoWeb passe par la capture (une entrée recipes en file) et l'envoi porte les
        //    trois champs au serveur (transport factice arbitre, tests/transport-factice.js) ; les octets, eux, sont l'affaire du lot G.
        const png = await octetsDe(await imageTest('cap.png', '#3a7', 800, 600, 'image/png'));
        const fetchImage = async () => reponse(200, { type: 'image/png', taille: png.length, url_finale: 'https://cdn.test/cap.png', octets: base64De(png) });
        await db.mutate({ puts: { recipes: [fiche('rc_cap', { photo_source_url: 'https://cdn.test/cap.png' })] }, origin: 'device' });
        const sync = { user: { id: 'u1' }, auth: { jeton: async () => ({ access_token: 'jeton-capture', user: { id: 'u1' } }) } };
        const r = await PP.rapatrierPhotoWeb('rc_cap', { ctx: { sync }, repo, fetch: fetchImage, enLigne: () => true });
        const enFile = (await db.getAll('outbox')).filter((e) => e.store === 'recipes' && e.id === 'rc_cap').map((e) => e.op);
        const tf = creerTransportFactice({ serveur: true });
        await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
        const auServeur = tf.ligne('recipes', 'rc_cap')?.data;
        eq([r.issue, enFile, auServeur?.photo_sha256, auServeur?.photo_origin, auServeur?.photo_source_url], ['ok', ['put'], r.sha256, 'web', 'https://cdn.test/cap.png'],
          'capture : une entrée recipes (put, origine local) en file après le rapatriement ; l’envoi porte photo_sha256, photo_origin web et photo_source_url au serveur');
      } finally { globalThis.fetch = vraiFetch; scene.remove(); PP.reinitialiserPhotoPlat(); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
    }));
```

- [ ] **Step 3 : rouge lu.** Suite : le bloc « lot F — import web » rougit (aucune annonce : `ligneAnnoncePhotoWeb` n'est pas rendue ; aucun POST
  `image-web` : `enregistrerLecture` ne déclenche rien) ; dans le bloc « régression », le cas 2 (D-F16 : la photo écrite pendant l'édition est effacée
  par la copie) et le cas 3 (D-F19 : `ErreurVocabulaire` levée par `save()`, aucune version écrite, l'attente dépasse ses 3 s) rougissent ; les cas 1, 4,
  5 et 6 sont des gardes de régression, verts avant le changement (consigné). Noter les comptes dans `progress.md`.

- [ ] **Step 4 : implémenter `src/ui/import-web.js`** (lot B). Imports (une ligne chacun) :
  `import { candidatPhotoWeb } from '../domain/photo-web.js';` et `import { ligneAnnoncePhotoWeb, rapatrierPhotoWeb } from './photo-plat.js';` (après la l. 21 à `35fb29c`)
  (`cleLecture` et `TransitionRefusee`, qu'emploie la clôture, sont DÉJÀ importés par B : ne pas les dupliquer).
  `enregistrerLecture` (EI-6 : le corps RÉEL de B, `35fb29c` l. 243-276, ligne pour ligne ; lignes « Lot F » : la déstructuration, `photoAnnoncee` dans
  l'appel unique de `fabriquerLectureWeb`, le déclenchement — sur `fiche.signet.id`) :

```js
export async function enregistrerLecture(importId, { repo = repoModule, remplacer = null, maintenant = horloge, choisir = chooseDialog, cle = null, ctx = null, fetch: fetchInjecte = undefined, enLigne = () => enLigneFlag, photoAnnoncee = null } = {}) {
  const ligne = await repo.get('imports', importId);
  if (!ligne || ligne.kind !== 'web' || ligne.status !== 'a_verifier') return refus('statut');
  if (cle !== null && cleLecture(ligne) !== cle) return refus('lecture'); // la lecture affichée a été remplacée : rien d'écrit, l'écran se redessine
  const lu = relireResultat(ligne.resultat);
  if (!lu) { await marquerIllisible(repo, ligne); return { issue: 'echec', raison: 'illisible' }; }
  const relire = async () => {
    const signet = await repo.get('recipes', ligne.recipe_id);
    return signet ? { signet, versions: await repo.byIndex('recipe_versions', 'recipe_id', signet.id) } : null; // supprimé : jamais ressuscité
  };
  const fondement = (f) => JSON.stringify([f.signet.current_version_id ?? null, versionHumaine(f.versions)]);
  let fiche = await relire();
  if (!fiche) return refus('inconnu');
  let choix = remplacer;
  while (choix === null && versionHumaine(fiche.versions)) {
    // Défaut « non » (comme I-5 du lot A) : la première option est « Ajouter sans remplacer ».
    const avant = fondement(fiche);
    const r = await choisir(t('Remplacer par cette lecture ?'), [{ value: 'ajouter', label: t('Ajouter sans remplacer') }, { value: 'remplacer', label: t('Remplacer') }]);
    if (r !== 'ajouter' && r !== 'remplacer') return { issue: 'annule' };
    fiche = await relire();
    if (!fiche) return refus('inconnu');
    if (fondement(fiche) === avant) choix = r === 'remplacer'; // sinon la question est reposée (ou n'a plus lieu d'être)
  }
  // Lot F (§ 4.3 point 2, S-12) : l'adresse ANNONCÉE par l'écran voyage jusqu'au fabricant, qui ne rend `photoWeb` que si elle est encore candidate.
  const fab = fabriquerLectureWeb(lu.recette, { signet: fiche.signet, versions: fiche.versions, page: lu.page, sourceKind: lu.source_kind, importId: ligne.id, modele: modeleBorne(ligne.model), maintenant: maintenant(), photoAnnoncee, ...(choix === false ? { remplacer: false } : {}) });
  const cleLue = cleLecture(ligne);
  const cloture = (c) => { if (cleLecture(c) !== cleLue) throw new TransitionRefusee('imports', ligne.id, c.status); return { status: 'enregistre', reponse_brute: null, finished_at: maintenant() }; };
  try {
    await repo.transitionner('imports', ligne.id, { attendus: ['a_verifier'], patch: cloture, puts: { recipe_versions: [fab.version], ...(choix === false ? {} : { recipes: [fab.recipe] }) } });
  } catch (e) {
    if (estRefus(e)) return refus('transition'); // enregistré, ignoré ou relu par un autre onglet juste avant : rien d'écrit
    throw e;
  }
  // Lot F (§ 4.3 point 2, I-F4, R-F-2) : APRÈS la transaction réussie, et seulement alors — « Ajouter sans remplacer » compris —, la descente de
  // l'image annoncée part SANS être attendue ; elle ne lève jamais et n'écrit rien sur la version ni sur le journal. La fiche s'ouvre sur
  // « Récupération de la photo du plat… ».
  if (fab.photoWeb) rapatrierPhotoWeb(fiche.signet.id, { candidat: fab.photoWeb, ctx, repo, fetch: fetchInjecte, enLigne });
  return { issue: 'enregistre', recipeId: fiche.signet.id, versionId: fab.version.id };
}
```

  (le corps de B — `cle`, refus `lecture`, relecture APRÈS le dialogue, `cleLue` et `cloture` — est recopié tel que le code réel le porte, relevé au
  Step 0 ; les seules lignes neuves sont la déstructuration — `ctx`, `fetch`, `enLigne`, `photoAnnoncee` —, `photoAnnoncee` dans l'appel de
  `fabriquerLectureWeb` et le déclenchement). `renderImportWeb` :
  - `const etat = { ligne: null, lu: null, versions: [], occupe: false, photoAnnoncee: null };` (EI-7 : `lu` est de B)
  - `charger()` (EI-7 : la fonction de `35fb29c`, l. 300-311, avec les trois lignes « Lot F » ; l'annonce se calcule sur `lu`, déjà relue, et se pose dans
    la MÊME affectation que `ligne`, `lu` et `versions` — « posé d'UN coup ») :

```js
  async function charger() {
    const prefere = etat.ligne?.id ?? (typeof query?.import === 'string' ? query.import : null);
    let L = await ligneOuverte(prefere);
    let lu = lecture(L);
    // I-B2 : un résultat illisible n'est jamais rendu comme une lecture ; il est marqué echec(illisible) pour LA lecture relue (cleLecture, R-B-10).
    // Une autre lecture arrivée entre-temps (un autre onglet, une réception) est relue et jugée à son tour : deux passes au plus — au-delà, dessiner()
    // la montre comme un échec sans l'écrire (hors brief : jamais une levée sur une donnée hostile ; status reste celui de la base, a_verifier).
    // Ronde 1 : jamais pendant que CE document relance cette ligne (« Réessayer » d'une lecture illisible, relire) — le départ du vol l'efface déjà.
    for (let passe = 0; passe < 2 && L?.status === 'a_verifier' && !lu && volEnCours()?.importId !== L.id; passe += 1) { await marquerIllisible(repo, L); L = await ligneOuverte(prefere); lu = lecture(L); }
    const versions = await repo.byIndex('recipe_versions', 'recipe_id', recipe.id);
    // Lot F (§ 4.3 point 1) : l'image de la page est ANNONCÉE pour la fiche telle que la base la porte à ce rendu (jamais sur une photo de la
    // personne, jamais pour la même image) ; « Enregistrer » ne lancera un appel que pour CETTE adresse (S-12).
    const fiche = (await repo.get('recipes', recipe.id)) ?? recipe;
    etat.ligne = L; etat.lu = lu; etat.versions = versions; etat.photoAnnoncee = lu ? candidatPhotoWeb(fiche, lu.page.image_url) : null;
  }
```

  - `zoneLue(L)` : dans l'appel `el('div', { class: 'stack', dataset: { role: 'lecture' } }, …)`, après la ligne `el('div', { class: 'muted', dataset: { role:
    'mode' } }, …)` (l. 401 à `35fb29c`, la dernière de l'appel), un argument de plus : `etat.photoAnnoncee ? ligneAnnoncePhotoWeb() : null` (lot F : un ESSAI
    et son coût, jamais un résultat) ;
  - `enregistrer()` (l. 358 à `35fb29c`) : `r = await enregistrerLecture(L.id, { repo, maintenant, choisir, cle: cleLecture(L), ctx, fetch: fetchInjecte, enLigne, photoAnnoncee: etat.photoAnnoncee });`
    (`cle: cleLecture(L)` est celui du plan B rév. 2 : le retirer réintroduirait le mutant C23 de B).

- [ ] **Step 5 : implémenter `src/ui/recipe-edit.js`.** Import (l. 14) : `import { assertVocabulaire, originePhotoAdmise } from '../domain/vocabulaire.js';`. Dans `save()`,
  juste avant `assertVocabulaire(rec, 'recipes');` (l. 341 à `35fb29c`, après `pageUpdates` du lot D) :

```js
    // Lot F (D-F16, D-F19) : les trois champs de la photo du plat viennent de la fiche RELUE juste avant l'écriture — l'éditeur ne les édite pas, la
    // base fait foi : une photo posée pendant l'édition (descente web, autre onglet) survit ; une origine hors liste se lit null ; une clé absente
    // en base reste absente (P-6). Une fiche supprimée pendant l'édition garde la règle d'avant (sa copie : dette C4 du lot UX, hors lot).
    if (targetRecipe) {
      const enBase = (await repo.get('recipes', targetRecipe.id)) ?? targetRecipe;
      for (const champ of ['photo_sha256', 'photo_origin', 'photo_source_url']) {
        if (Object.hasOwn(enBase, champ)) rec[champ] = champ === 'photo_origin' ? originePhotoAdmise(enBase[champ]) : enBase[champ];
        else delete rec[champ];
      }
    }
```

  Puis chaque écrivain (c) neuf du recensement (Step 0), corrigé comme ★ Favori, avec son test.

- [ ] **Step 6 : vert** (suite : tout vert **sauf l'épingle**, relevée au Step 7, une seule erreur de console — favicon ; Node et `--check` verts et
  inchangés). Une AUTRE assertion existante de B
  (`tests/lecture-web.js`) qui rougit hors des amendements nommés (I-F9) : NEEDS_CONTEXT. Mesuré au rejeu : `❌ 5883/5884` (l'épingle seule) ; Node 204/204 ;
  `--check` 0 ; `tsc` 0.
- [ ] **Step 7 : épingle relevée ; SHELL/VERSION** : `sw.js` `VERSION = 'cuisine-os-v0.15.0-4'` (aucun module neuf : `SHELL` inchangé) ; relancer la suite.
  Mesuré : épingle **5883** (5844 + 39), `✅ 5884/5884` ; l'app réelle (`index.html`, Chrome sans tête dédié) se charge sans erreur de console.
- [ ] **Step 8 : mutants de la tâche** (copie du worktree servie à part sur 8190, `node <suite.cjs> 8190` ; chacun doit rougir) : rapatriement lancé AVANT la
  transaction d'« Enregistrer » (bloc « lot F — import web », « ordre ») · `photoAnnoncee` non transmise par `enregistrer()` (aucun POST : « ordre ») · appel
  lancé sans comparaison à l'adresse annoncée (`photoWeb = candidat`) (« S-12 ») · descente coupée sur « Ajouter sans remplacer » (`if (fab.photoWeb &&
  choix !== false)`) (« Ajouter sans remplacer ») · l'annonce rendue sans candidat (`ligneAnnoncePhotoWeb()` toujours) (« annonce absente ») ·
  « Corriger » qui garde les champs de la photo de sa copie (régression, cas 2) · « Corriger » qui recopie l'origine brute (cas 3) · « Corriger » qui pose
  les trois clés à `null` sur une fiche qui ne les porte pas (cas 4) · `cle: cleLecture(L)` retiré d'`enregistrer()` et `cloture` remplacée par un
  patch objet (les tests de B qui les tuent restent rouges sur ces mutants : F ne les a pas affaiblis) · le faux repo du cas 4 qui ne déclenche pas
  la course (`courses` à 0 : « TransitionRefusee »).
- [ ] **Step 9 : mutants § 7.5 rejoués sur l'état final** (toutes les tâches commises ; serveur : une copie ENTIÈRE du worktree par mutant dans le
  scratchpad, `node --test tools/*.test.mjs` lancé depuis la copie — P-22, procédure de la tâche 1, Step 10 ; client : copie servie sur 8190). Chacun
  doit rougir ; le test qui le tue est nommé ; la sortie lue est consignée dans le rapport :
  - serveur — `image/gif` dans `LIMITES_IMAGE.types` (« LIMITES_IMAGE : forme ») · `LIMITES_IMAGE.octets` remis à 5 Mio (« forme », u5) · `typeImageAdmis`
    qui admet `image/svg+xml` (« typeImageAdmis : table », u4) · signature non contrôlée (u4 bis) · WebP admis sur `RIFF` seul (« signatureImage : table »,
    u4 bis) · `imageUrlDe` sans `valideAdresse`, sans résolution, sans la garde `autresRecettes` (« imageUrlDe ») · image lue sur le premier `Recipe` (« lirePageHtml :
    page.image_url ») · `TRANCHE_BASE64 = 32768` (« versBase64 », « chaînage ») · `lire` appelé hors des minuteries (u6 bis (a), (b)) · minuterie du saut
    retirée aux en-têtes (u6 bis (a)) · `referer` ajouté (u2) · réservation après `telechargerImage` (« index.ts (lot F) ») · second `await fetch(` dans
    `telechargerImage` (« index.ts (lot F) ») · `corpsModele` laissé à `lu.corps` (u11) · `OUTILS` sans `'image-web'` (« OUTILS : cinq outils », « lot F : OUTILS
    porte les cinq outils de 0006 ») · `propre` remplacé par un accès direct dans `adresseDe` (« imageDe : formes », S-11) ;
  - client, domaine — `ORIGINES_PHOTO` remplacée par `PHOTO_ORIGINS` et recopie brute de l'origine (« vocabulaire (lot F) ») · `PHOTO_ORIGINS` sans `'web'`
    (« vocabulaire (lot F) », « rapatriement » cas 1) · `adresseImageAdmise` sans la règle ASCII, ou sans la borne après `lienSignet` (« adresseImageAdmise ») ·
    `candidatPhotoWeb` sans la règle `photo_origin !== 'web'` (« candidatPhotoWeb ») · `corpsMax` omis (« lireImageWeb : l’appel ») · `LIMITES_IMAGE_WEB.octets`
    à 5 Mio, `corpsReponse` sous le base64 de la borne (« LIMITES_IMAGE_WEB ») · `dims.type !== blob.type` retiré, plancher de 200 px retiré (« mur distant »,
    « rapatriement » cas 7) · `photo_source_url` écrit avant la descente d'une relecture (« fabriquerLectureWeb : photoWeb et photo_source_url »,
    « rapatriement » cas 6) · règle `ALPHABET` retirée de `lireOctetsBase64`, `type` par défaut quand le champ propre manque, Blob au type figé,
    `lireOctetsBase64` avant la borne de taille (« le 200 est une donnée hostile », chaînage Node ; R-F-8) ;
  - client, fiche — écriture sans garde des trois champs, `putFile` avant la garde (« rapatriement » cas 5) · comparaison d'adresses brute, garde départ/relue en brut,
    garde par `memeAdresseImage` seule (« rapatriement » cas 4 et 4 bis) · « Retirer » qui garde `photo_source_url` (« fiche », « Retirer » sur une photo
    web ; aussi « rapatriement » cas 8, « Ne pas récupérer ») · `poserPhotoPlat` qui ne remet pas `photo_source_url` à `null` (« fiche »,
    remplaçable à la main) · `monterPhotoPlat` qui lance un rapatriement au cas 5 (« fiche », I-F11) · raison dite après le départ automatique sur `quota`,
    « Réessayer » offert après une raison définitive, `non_connecte` d'une tape non gardé, « Connecte-toi… » rendu deux fois (« composant », « rapatriement »
    cas 8) · `lireImageWeb` par `fetch(url)` direct (« rapatriement », S-8) · `preparerPhotoLocale` pour l'image web (« rapatriement » cas 7) · `enVol` posé
    après le premier `await` (« rapatriement » cas 2) · `refresh()` après un geste (« fiche », D-F15) · ★ Favori sur la copie du rendu (« D-F16 : ★ Favori ») ·
    boutons allumés pendant une écriture, garde `occupe` retirée (« fiche », pendant une écriture) · état du fichier absent rendu deux fois (« pointeur sans
    octets ») ;
  - client, cartes et import web — `vignettePlat` qui pose un `src` sans octets ou ignore la règle d'affichage, révocation retirée d'un redessin ou faite AVANT le vidage (« cartes ») ·
    `recipeCard` qui enveloppe toujours la colonne, ou qui change le reste du balisage avec une photo (« recipeCard : référence construite ») · règle `.plat-vignette` changée (« styles.css ») ·
    `image_url` ou `photo_source_url` rendus (tests de source D-F11 des tâches 4 et 5) · rapatriement avant la transaction, appel sans annonce ou pour une autre
    adresse, « Corriger » sur sa copie (Step 8 ci-dessus).
- [ ] **Step 10 : invisibles** sur les fichiers touchés : 0.
- [ ] **Step 11 : commit** `Import web : annonce et rapatriement apres la transaction, Corriger relit la photo, regression archive et capture (lot F, tache 5)`.

---

### Clôture (contrôleur, hors tâche)

- **Revue finale de branche** (panel à trois lentilles : besoin, sécurité, faisabilité ; sur `git diff <tête du lot E>...plats-en-images`), vague de
  corrections (un commit par ronde, message ASCII), re-revue jusqu'à zéro constat Critical ou Important.
- **`/verify`** : suite `node .superpowers/sdd/2026-10-19-plats-en-images/suite.cjs 8094` (bilan `✅ N/N` lu, une seule erreur de console — favicon), `node --test
  tools/*.test.mjs`, `node tools/generer-migrations.mjs --check` (0), `tsc --strict` sur `index.ts` (0), scan de secrets (aucune clé, aucun jeton réel ; les
  sentinelles des tests seulement), invisibles en Python sur tout le diff (0), mutants : la liste de la tâche 5, Step 9, rejouée sur la tête de
  branche APRÈS les rondes (chacun rouge, sortie lue). « Vert conditionnel » seulement si la contrainte `outil` de `0006` à cinq outils est COLLÉE et prouvée par Neegan avec le lot B (sinon : vert du code, rouge
  nommé du déploiement).
- **Documents** (P-10) : `CLAUDE.md` (section du lot F : la photo du plat — zone, figure de tête, `photo-plat.js` ; `image-web` et `suivreRedirections` ;
  `PHOTO_ORIGINS`, `HASH`, `originePhotoAdmise` ; les invariants I-F1 à I-F11 en une ligne chacun ; versions `0.15.0` / `cuisine-os-v0.15.0-4` ou plus si les
  rondes ont ajouté), `STATE.md` (tête de branche, ce qui reste à Neegan), `docs/architecture.md` (« `photo_sha256` : pointeur souple » à côté de
  « `cover_sha256` : pointeur souple » ; `photo_source_url` : provenance ou rapatriement attendu, jamais rendu ; le cinquième outil de la fonction, qui
  n'atteint jamais le modèle ; la phrase de la l. 1200 « `OUTILS` n'en porte que quatre » à corriger ; `renderZoneCouverture` dans `components.js`, EI-5),
  spec § 12 « ce que la construction a amendé » (les rulings P-1 à P-19 de ce plan, les rulings R-F-7 à R-F-11 du chef d’orchestre — écarts de lettre R-F-8 (§ 7.4) et R-F-9 (I-F9, § 6.4 point 2) ; limite R-F-10 en § 11 —, chaque amendement nommé des Step 0 — noms
  de B, G, C, D, E relus —, le recensement D-F16, les corrections des rondes, et les adaptations, défauts et écarts du Départ — A-1 à A-11, D-1 à D-3,
  EI-1 à EI-7, sous-section « Rejeu sur 5ec092c (voie (b)) » —), plan coché.
- **Registre** : copier `.superpowers/sdd/2026-10-19-plats-en-images/` (progress, recensement D-F16, rapports, suite.cjs) dans
  `~/projects/mistu/.superpowers/sdd/` AVANT tout `git worktree remove`.
- **Redéploiement de la fonction** (D-F6, spec § 6.5 ; geste du contrôleur) seulement APRÈS que Neegan a collé et prouvé `0006` à cinq outils avec le lot B
  (le contrôleur relit le verdict 2.03 bis dans `supabase/proofs/RESULTATS-mitsu.md` d'abord) : `supabase functions deploy assistant --project-ref <ref du
  projet mitsu> --no-verify-jwt --use-api` ; version et `ezbr_sha256` consignés dans la section « Sondes `image-web` » de `RESULTATS-mitsu.md` ; sondes sans
  dépense S-F1 (`http://` → 422 `interdit`, `assistant_usage_jour` inchangé), S-F2 (`https://127.0.0.1/i.jpg` → 422), S-F3 (sans jeton → 401), S1-S9 (lot 4) et
  S13-S16 (lot B) rejouées ; puis les deux sondes payantes d'un appel chacune, zéro jeton : S-F4 (une image `https` publique vérifiée d'abord par `curl -sI` :
  `content-type: image/jpeg`, `content-length` ≤ 2 097 152 → 200, `Buffer.from(octets, 'base64').length === taille`, journal `image-web` 200 jetons `null`,
  durée notée ; un 403 anti-hotlink se note tel quel, une autre image est choisie, rien n'est contourné) et S-F5 (une page HTML → 422 `pas_une_image`).
- **Gestes de Neegan** (dépense dite à chaque pas, spec § 10) : (1) rien à coller pour F (`0006` à cinq outils vient du lot B) ; (2) fusion `--ff-only` dans
  l'ordre de la chaîne (A → B → G → C → D → E → F) puis `push`, sur son mot ; (3) preuve réelle sur le site public : première photo web réelle (deux appels :
  la lecture, puis l'image ; l'annonce, « Récupération… », l'image en tête avec « Image de la page {site} », le journal `lecture-web` 200 puis `image-web` 200,
  la durée depuis l'iPhone en réseau mobile, les vignettes dans « Liens web gardés », la recherche et un repas), échec dit (« non récupérée », « Réessayer » et
  sa ligne de coût, la raison après la tape, « Ne pas récupérer »), fiche sans dépense (« Photographier » depuis l'iPhone, « Choisir une image » qui remplace,
  « Retirer » lu « Retirer la photo du plat » par VoiceOver, les unités « Métrique » gardées), deux appareils (« Télécharger » à UN seul endroit, en tête),
  iPhone (étapes 3 et 5 depuis l'app installée) ; (4) trancher, s'il le veut, les trois points de la spec § 13 (rapatriement automatique, vignette 72 px,
  section après la préparation) : le plan construit les défauts.

---

## Pré-vol

### Rév. 1 -> rév. 2

Vingt-sept constats (trois lentilles : ordre, fantômes, faux-verts), chacun vérifié dans le code avant d'être tranché : prototype B `rejeu2`
(identique à `rejeu6` pour `tools/` et `supabase/`), plan B rév. 2, worktree `mistu-import` à `bd03e48` et `4cb99a0` (lecture seule), scripts
`_fantomes/n1.mjs`, `_fantomes/css-regex.mjs` et `_fauxvert/css-regex.mjs` rejoués (règle lue `""` avec le commentaire, les six déclarations
sans lui ; `indexOf('async function suivreRedirections(')` = -1 sur le bloc TS du plan). Aucun constat refusé en entier ; deux le sont en partie,
avec la raison.

1. **Important, ordre — T4, test CSS contre `styles.css`** : appliqué. Règle lue SANS commentaires (`replace(/\/\*[\s\S]*?\*\//g, '')`) dans un
   bloc à part « styles.css : la règle .plat-vignette » (P-21) ; le commentaire reste devant la règle ; le Step 2 dit que ce bloc rougit pour la
   bonne raison (« la règle .plat-vignette est trouvée » faux).
2. **Important, ordre — T3, SHELL après le « vert »** : appliqué. `sw.js` (`VERSION -2`, `SHELL` + `photo-plat.js`) passe au Step 9 avec `recipe.js` ;
   le Step 12 ne relève plus que l'épingle. Chaque Step « vert » (T2 Step 8, T3 Step 11, T4 Step 5, T5 Step 6) dit « tout vert sauf l'épingle ».
3. **Minor, ordre — T1 Step 0, R-F-1 à moitié** : appliqué. Le script cherche `assistant_reserver(uid, 'image-web'` (et non `2.03`), compare
   `OUTILS_0006` à la liste des cinq, vérifie la contrainte construite par `OUTILS_0006.map(`, l'absence de l'égalité à quatre, la présence d'un
   préfixe `OUTILS_0006.slice(0, …)`, et sort en 1 si un contrôle manque.
4. **Minor, ordre — liste « Tests de source admis »** : appliqué. `styles.css` (`.plat-vignette`) et `index.html` (`img-src`) ajoutés, ainsi que
   les déclarations d'`index.ts` cherchées par la tâche 1.
5. **Minor, ordre — version écrite en dur** : appliqué (voie « règle générale ») : `X.Y.Z` relevé → `X.(Y+1).0` et `cuisine-os-vX.(Y+1).0-N` ; le
   script des pins prend la version relevée en argument et cherche `X.Y.Z` et `vX\.Y\.Z`. Un écart est consigné, ce n'est pas un NEEDS_CONTEXT
   (la spec D-F6 dit « sinon le numéro suivant libre »).
6. **Minor, ordre — partage D-F16 entre T3 et T5** : appliqué. T3 : les écrivains (c) de `src/ui/recipe.js` (★ Favori et tout (c) neuf de C, D, E
   dans ce fichier), chacun avec son test sur le gabarit « D-F16 : ★ Favori », listés dans Files, Step 0, Step 9 et Step 13 ; T5 : tous les autres.
7. **Minor, ordre — T1 Steps 10-11** : appliqué. « sept fichiers » ; procédure P-22 : copie ENTIÈRE du worktree (`rsync`) dans le scratchpad, une
   par mutant, `node --test` lancé depuis la copie (les harnais importent `logique.js` par un chemin fixe, vérifié : seuls `INDEX_TS` et
   `LECTURE_WEB_JS` sont des variables) ; jamais une mutation dans le worktree. Même procédure à la T5, Step 9.
8. **Critical, fantômes — `'async function suivreRedirections('`** : appliqué. Les trois listes du Step 4 (boucle N-1, `deplacees`, test « index.ts
   (lot F) ») cherchent `'async function suivreRedirections<T>('` ; le générique est gardé (typage `tsc` des deux appelants) ; la boucle N-1 et
   `decl()` affirment `indexOf !== -1` : une aiguille absente ne passe plus en silence.
9. **Important, fantômes — T1 Step 8, `REDIRECTIONS` / `PageTelechargee` / `RefusPage`** : appliqué. Vérifié au prototype : l. 79-82 commentaire,
   l. 83-85 les trois déclarations, l. 86-130 la fonction. Le Step 8 et les Files disent « remplacer la FONCTION (l. 86-130), garder l. 79-85 ».
10. **Important, fantômes — T5, `enregistrerLecture` du plan B rév. 2** : appliqué. Vérifié (plan B rév. 2, l. 4705-4733 et 4802) : signature avec
    `cle = null`, refus `lecture`, `cleLue` et `cloture` (patch FONCTION), `enregistrer()` qui passe `cle: cleLecture(L)`. Produces, Step 0, code
    du Step 4 et appel d'`enregistrer()` alignés (seuls `ctx`, `fetch`, `enLigne`, `photoAnnoncee` et le déclenchement sont neufs ; P-7 amendé) ;
    le faux repo du test 4 détecte la transition d'« Enregistrer » par `opts?.puts?.recipe_versions` et compte la course (`courses` = 1). Les
    autres fonctions de B que F recopie (`telechargerPage`, `fabriquerLectureWeb`, `charger`) sont identiques au prototype dans le plan B rév. 2
    (vérifié).
11. **Important, fantômes — T4, regex CSS et commentaire** : doublon du 1 ; appliqué par la même correction.
12. **Important, fantômes — `OUTILS_0006` absent du plan B rév. 2** : appliqué en partie. Constat exact (le plan B rév. 2 garde
    `deepEqual(OUTILS_PASSERELLE, [...OUTILS_0004, 'lecture-web'])` et construit la contrainte depuis `OUTILS`, l. 1183-1185 au prototype). Dans le plan
    F : la précondition (2) le dit, nomme le ruling R-B-6 (NUIT.md : « chemin 1 », spec B rév. 4 et plan B rév. 3 en écriture), accepte les deux
    formes du préfixe (`slice(0, OUTILS.length)` ou `slice(0, 4)`, que la T1 amende alors en égalité, Step 4 point 4) et cherche le verdict par son
    texte. **Refusé en partie** : amender la spec et le plan B n'est pas du ressort de ce plan (c'est le geste du chef d'orchestre, déjà tranché
    par R-B-6 et en vol) ; et le numéro du verdict n'est pas imposé (R-B-6 dit « 2.03 bis », le constat proposait 2.04) : le Step 0 ne dépend plus
    du numéro.
13. **Minor, fantômes — numéros de ligne** : appliqué, avec la mesure refaite : `ORDRE_DU_FLUX` l. 741-742, boucle N-1 l. 749-752, `decl` l. 763 et
    `deplacees` l. 764 (et non 766 : mesuré sur `rejeu2`), test N-1 l. 747-768, `PAGE_TEXTE` l. 590 (et non 589), t3 l. 659 ; `import-cible.js`
    (domaine) l. 116 / 91 à `bd03e48`, l. 119 / 94 à `4cb99a0` ; `recipe-edit.js` l. 270 à `bd03e48`, l. 282 à `4cb99a0`.
14. **Critical, faux-verts — aiguille `suivreRedirections(` et motif de B** : appliqué (voir le 8) ; le motif de la boucle N-1 devient
    `/await (telechargerPage|telechargerImage|appelerAnthropic)\(/`.
15. **Critical, faux-verts — regex CSS, filet creux** : appliqué (voir le 1) ; `ok(regle.trim() !== '', …)` AVANT les assertions qui lisent
    `regle`, et le filet « ni display:none ni couleur en dur » exige une règle non vide.
16. **Important, faux-verts — `rc_z2` / `rc_z3` / `rc_z4` lisent un DOM périmé** : appliqué. Le départ automatique FINIT avant le montage
    (`garde(await auto(id))`, puis `monter(id)`) : le premier dessin lit l'échec gardé, aucune attente sur un rendu d'avant la descente ; `rc_z1`
    reste monté d'abord (il observe « Récupération… »). Second tueur ajouté à la T5 (`rc_ec`) : aucune `raison-photo-web` au montage. Mutant
    « `descendre` garde l'échec automatique avec `tape: true` » nommé (T3 Step 13).
17. **Minor, faux-verts — I-F11 attendu par deux `tick()`** : appliqué. `recuperationEnCours` lu juste après chaque montage (attendu `false`), puis
    `attendreRecuperation` des deux fiches AVANT d'affirmer zéro appel.
18. **Minor, faux-verts — vol posé avant tout await, vérifié après `await p2`** : appliqué. `recuperationEnCours('rc_r2')` est lu juste après
    `rapatrierPhotoWeb('rc_r2', …)`, sans await (attendu `true`).
19. **Minor, faux-verts — S-10, règle « refusées égales » non éprouvée** : appliqué. Cas 4 bis : la même adresse réécrite sous sa forme normalisée
    pendant une descente suspendue → `ok` ; `photo_source_url` `http://…` avec un candidat `https` → `ok`, provenance = le candidat ; deux mutants
    nommés (garde brute, `memeAdresseImage` seule).
20. **Minor, faux-verts — « Retirer » sur une fiche sans provenance** : appliqué. Le test « Retirer » porte sur une fiche dédiée à photo WEB
    (`rc_rw` : les trois champs posés, octets ici) ; la T5 Step 9 nomme les deux tueurs (« fiche », « Retirer » ; « rapatriement » cas 8).
21. **Minor, faux-verts — `recipeCard` sans photo, référence tautologique** : appliqué en rév. 2 (voie « référence relevée »), **remplacé en rév. 3 : R-F-7** (référence construite dans le test) : bloc « référence dorée »
    (P-20), `outerHTML` relevé au Step 0 de la T4 sur le code d'avant la tâche et épinglé en littéral ; la carte à pointeur hostile lui est comparée
    aussi. La voie « carte construite à la main » est écartée : elle recopierait `recipeCard`, que C, D ou E ont pu toucher.
22. **Minor, faux-verts — révocation filtrée sur `avant`** : appliqué. L'espion note `{ u, encore }` (l'URL encore sous un `img` du document) ; il
    est vidé juste avant chaque geste ; l'assertion compare l'ensemble EXACT et `encore` = 0 ; l'attente porte sur un fait (le nombre de
    révocations), plus sur un `tick()`.
23. **Minor, faux-verts — espion `atob` creux, règle ALPHABET jamais seule** : appliqué. Fixture `octets: 'A'.repeat(4 × ceil(2 097 153 / 3))` (un
    mutant « décoder puis borner » appelle `atob`) ; `'AAA AAAA'` de taille 5 rejeté dans la suite (`illisible`) et sous Node (`null`) ; trois
    mutants nommés (T2 Step 10, T5 Step 9).
24. **Minor, faux-verts — fixtures `__proto__` par `JSON.parse`** : appliqué en rév. 2, **remplacé en rév. 3 : R-F-8** (aucune pollution de prototype dans la suite navigateur). `Object.prototype.url` / `.image` (Node, `imageDe`) et
    `Object.prototype.type` (suite, `lireImageWeb`) pollués le temps de l'appel, rendus en `finally` ; mutants « accès direct » nommés.
25. **Minor, faux-verts — deux assertions tautologiques du test « index.ts (lot F) »** : appliqué. `ORDRE_DU_FLUX.includes(…)` et le « mutant 2 »
    construit dans le test sont retirés ; le second `await fetch(` est rejoué sur une COPIE (T1 Step 10) et tué par le compte de `await fetch(`.
26. **Minor, faux-verts — `'2.03' in preuve` toujours vrai, script sans code de sortie** : appliqué (voir le 3).
27. **Minor, faux-verts — identités de nœud constantes** : appliqué. « Télécharger » : le PREMIER ENFANT de la zone est comparé avant et après
    (la zone n'est pas redessinée) ; D-F15 : le premier enfant de `.recipe-body`, relevé après les « + », est comparé (le corps n'est pas
    redessiné).

### Rév. 2 -> rév. 3 (rulings R-F-7 à R-F-11 du chef d'orchestre)

Cinq rulings, chacun vérifié en lecture seule dans le worktree `mistu-import` (tête `4cb99a0` et le travail non commis d'un autre workflow, non
touché) et dans les documents du lot B (spec B rév. 4, prototype `rejeu2`) ; les blocs de code touchés passent `node --check` (JavaScript, sur des
copies dans le scratchpad du lot F) ou `ast.parse` (le script Python du Step 0 de la tâche 1). Tout le reste du plan rév. 2 est gardé tel quel, y
compris les dix constats réglés par sa vérification ; les blocs de code non touchés sont copiés à l'octet.

- **R-F-7 (Important, constat neuf de la vérification) — appliqué ; P-20 REFUSÉ.** Raison : `suite.cjs` (l. 22 du lanceur du lot A, relu) réduit
  les blancs puis coupe chaque échec à 400 caractères — le `outerHTML` « obtenu » n'est pas lisible dans le bilan, la référence dorée ne pouvait
  pas être relevée. Retour à la lettre de la spec § 7.4 : bloc « recipeCard : référence construite » (tâche 4, Step 1) — la carte à pointeur
  valide, rendue par le MÊME composant et privée de sa vignette, doit être exactement la carte sans photo (et celle à pointeur hostile) ; faits
  comparés : la vignette PREMIER enfant de `.col`, ses attributs (`img.plat-vignette`, `alt` vide, `loading="lazy"`, née cachée, sans `src`),
  l'égalité du reste du balisage, et un gabarit explicite (`.col` enfant direct de `.row.between.top`, elle-même enfant direct de la carte ; le
  badge en tête de `.col` ; aucune `img`) ; carte lue de façon synchrone dans `withRepo` (aucune lecture de la base de la personne). Retirés : le
  relevé du Step 0 de la tâche 4, `CARTE_DOREE` et toute copie d'« obtenu » pour une référence (l'« obtenu » de l'épingle du total, un nombre
  court et lisible, reste relevé comme dans tous les lots) ; P-20 réécrit en refus ; Files, Steps 0, 2, 5 et 7 de la tâche 4 et
  Step 9 de la tâche 5 renommés. Les mutants de la tâche 4 restent et doivent rougir : « enveloppe toujours la colonne » est précisé en ses deux
  formes (tuées par le gabarit et par le badge en tête) ; un mutant est ajouté pour l'égalité du balisage (un attribut de plus sur `.col`, avec
  photo seulement), pour que cette assertion ne soit pas creuse. Noms vérifiés : `recipeCard` (`a.item-link.card` > `div.row.between.top` >
  `div.col` > `availabilityBadge`, un `span.badge`), `el` (`hidden: true` → attribut `hidden=""`), `withRepo` (lie le dépôt à une base jetable).
- **R-F-8 — appliqué.** Le cas « type porté par le prototype » de « lireImageWeb : le 200 est une donnée hostile » (tâche 2) ne modifie plus
  `Object.prototype.type` ; contrainte globale ajoutée (« Bases jetables » : aucun test de la suite navigateur ne modifie un prototype natif, même
  sous `try/finally`). Le cas passe par la configuration de test déjà prévue pour `lireImageWeb` (P-3 : `config: SUPABASE.prod`, `fetch` factice,
  corps relu par `JSON.parse` dans `echanger`, relu dans `src/domain/passerelle.js`) : un 200 SANS champ propre `type` → `illisible`, et une PNG
  annoncée `image/png` → un Blob construit avec SON type explicite. Mutants nommés qu'il tue : « `type` par défaut quand le champ propre manque »
  (`lu('type') ?? 'image/jpeg'`) et « Blob au type figé » (`{ type: 'image/jpeg' }`). Le mutant « `lu(k)` remplacé par un accès direct `c[k]` »
  quitte les listes des tâches 2 et 5 : sur un corps relu par `JSON.parse`, aucun champ n'est hérité hors `Object.prototype` — mutant équivalent
  sans pollution ; la garde `Object.hasOwn` reste dans le code (S-11). La lettre de la spec § 7.4 (« objet à `__proto__` ») n'est pas reprise :
  une clé `__proto__` relue par `JSON.parse` est une clé PROPRE (constat 24 de la rév. 2) et ne tue aucun mutant simple. Hors du ruling, gardé :
  le cas `imageDe` de la suite NODE (`tools/assistant-lecture-web.test.mjs`) modifie `Object.prototype.url` / `.image` de façon synchrone, sans
  `await` entre la pose et le `finally` — ce n'est pas la suite navigateur.
- **R-F-9 — appliqué.** B (spec rév. 4 ; plan rév. 3 en cours, R-B-6) affirme `OUTILS` égal à `OUTILS_0006.slice(0, 4)` ; le Step 0 de la tâche 1
  admet les deux formes, `slice(0, 4)` et `slice(0, <alias>.length)`, sans NEEDS_CONTEXT (contrôle `forme in FORMES` ; toute autre forme manque :
  sortie 1) ; le Step 4, point 4, change l'une ou l'autre en `assert.equal(OUTILS_PASSERELLE.length, 5, …)` puis
  `assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0006, …)` (amendement nommé, I-F9). Mis à jour en concordance : précondition (2), I-F9 des
  contraintes, Files de la tâche 1. Écart de lettre avec la spec F rév. 3 (I-F9 « passe sans amendement » ; § 6.4 point 2
  `slice(0, OUTILS.length)`), tranché par le ruling et déjà relevé par la spec B rév. 4 (§ 13, point 1) : amendement nommé en spec § 12 à la
  clôture. Alias vérifié au prototype B (`import { OUTILS as OUTILS_PASSERELLE }`).
- **R-F-10 — appliqué.** Le bloc « cartes » garde ses négatives après `attendre(vHeic visible) ; tick ; tick` ; la limite est NOMMÉE dans le plan
  (paragraphe entre le Step 1 et le Step 2 de la tâche 4, et un commentaire à la ligne d'attente) : elle repose sur l'ordre des requêtes IndexedDB
  (`repo.getFile` = `db.get('files', sha)`, une transaction en lecture seule par appel, relu dans `src/model/repo.js` et `src/core/db.js`), ordre
  d'achèvement que la norme ne garantit pas ; consigne : un rouge intermittent sur ces négatives (comme un mutant qui y survit) est rejoué avant
  d'en faire un constat (R-B-15 du lot B, spec B rév. 4 § 11, même esprit).
- **R-F-11 — appliqué.** Les Step 0 des cinq tâches nomment les numéros qu'ils relisent (prototype B `rejeu2`, `bd03e48`, `4cb99a0`, plan G rév. 3)
  et disent que tout écart à la tête du lot E est un amendement nommé, pas un constat (R-C-7) ; l'en-tête « Références relues » le dit aussi.
  Constaté en relisant : dans l'arbre de travail actuel, `recipeCard` est déjà à la l. 137 de `src/ui/components.js` (l. 129 à `bd03e48`).

### Rejeu sur 5ec092c (voie (b))

Départ du 23 octobre 2026, contrôleur délégué (Opus 5.5), sans sous-agent, sans réseau réel, sans déploiement ; jamais le navigateur MCP (la suite par
`suite.cjs`, l'app par un Chrome sans tête dédié). Base : le worktree `/Users/neeganmac/projects/mistu-plats-en-images`, branche `plats-en-images` à
`35fb29c` (= `5ec092c` + la spec F commise), copié par `rsync` (sans `.git` ni `.superpowers`) dans le scratchpad du lot F (`depart/base`, `depart/rejeu`,
`depart/mut`), servi à part sur 8194, 8294 et 8394 ; le worktree n'a reçu AUCUNE écriture. Chaque bloc a été appliqué PAR INTENTION par des scripts Python
qui vérifient chaque ancre (présence et unicité) et refusent toute écriture hors des copies (`depart/outils/t1.py` à `t5.py`, `t1-d1.py`, `t2-fin.py`,
`t3-d2.py`, `t3-cycle.py`) ; les blocs du plan sont copiés À L'OCTET depuis ce fichier (aucune séquence « barre oblique inverse + u + hexa » retapée) ;
chaque fonction que le plan réécrit l'a été DEPUIS `35fb29c`. Journal des opérations : `depart/logs/rejeu-journal.txt` ; rapport :
`depart-rejeu-rapport.md` (même dossier que ce plan).

**Totaux mesurés** (lanceur `suite.cjs` sur la copie servie ; `node --test tools/*.test.mjs` ; `node tools/generer-migrations.mjs --check` ; `tsc` 5.6.3
`--strict` ; une seule erreur de console partout : le 404 de `/favicon.ico`) :

| État | Suite | Épingle | Node | `--check` | `tsc` | `APP_VERSION` / `sw.js` |
|---|---|---|---|---|---|---|
| Départ (`35fb29c`) | ✅ 5681/5681 | 5680 | 174/174 | 0 | 0 | `0.14.0` / `cuisine-os-v0.14.0-12` |
| T1, rouge (Step 5, `--test-timeout=10000`) | — | — | 174 : 142 ✓, 29 ✗, 3 annulés | — | — | — |
| T1, vert | ✅ 5681/5681 | 5680 | **203/203** | 0 | 0 | inchangés |
| T2, rouge (Step 6) | ❌ 5668/5703 | 5680 | 203/204 | — | — | — |
| T2, vert (Steps 8-9) | ❌ 5738/5739 (épingle) → ✅ **5739/5739** | **5738** | 204/204 | 0 | — | `0.15.0` / `-1` |
| T3, vert (Steps 11-12) | ❌ 5827/5828 (épingle) → ✅ **5828/5828** | **5827** | 204/204 | 0 | — | `-2` |
| T4, vert (Steps 5-6) | ❌ 5844/5845 (épingle) → ✅ **5845/5845** | **5844** | 204/204 | 0 | — | `-3` |
| T5, vert (Steps 6-7) | ❌ 5883/5884 (épingle) → ✅ **5884/5884** | **5883** | 204/204 | 0 | 0 | `-4` |

Entre deux tâches, seule l'épingle a rougi ; les lignes existantes amendées (A-5, EI-2, pins, P-9, I-F9) ont rougi exactement dans la tâche qui les amende ;
aucune autre assertion existante n'a rougi. `DB_VERSION` 4 et `ARCHIVE_FORMAT_VERSION` 1 inchangées ; aucune migration (`--check` 0 à chaque tâche).
Graphe des imports statiques depuis `src/app.js` : 85 modules, 0 cycle au départ ; 88 modules, 0 cycle à la fin (EI-5). L'app réelle (`index.html`,
`#/library`, `#/add`, `#/search`) se charge à la fin sans aucune erreur de console.

**Écarts d'intention** (chacun tranché en faveur du code commis ; une ligne de ruling R-F-12 et suivants par écart, à écrire par le chef d'orchestre) :

- **EI-1** (tâche 1, `supabase/functions/assistant/index.ts`) — Plan : extraire du prototype B une boucle `suivreRedirections` sans autre garde. Code commis :
  la vague finale de B (`ebbcf10`, défense en profondeur SSRF, test t13) refuse en 422 `interdit` une réponse SUIVIE malgré `redirect: 'manual'`
  (`r.redirected`), et nomme `ctlSaut` le contrôleur du saut. Tranché : la boucle partagée GARDE la garde `r.redirected` (elle vaut désormais pour
  `image-web` aussi) et les noms de B ; mutant M20 « garde retirée » rouge sur t13.
- **EI-2** (tâche 1, `tools/assistant-index.test.mjs`, t3) — Plan : amender la ligne à trois champs `[hote, titre_page, texte_coupe]` du prototype. Code
  commis : depuis sa ronde 1, B épingle l'objet `page` ENTIER (l. 672). Tranché : `image_url: 'https://cdn.test/og.jpg'` ajoutée en dernière clé de cet objet
  (même fait affirmé, plus strict).
- **EI-3** (tâche 3, `src/ui/photo-plat.js` `figurePhotoPlat`) — Plan : déplacer le `photoDuPlat` du plan G rév. 3 (erreurs relues en `Set` par
  `lireErreursFichiers`). Code commis : le `photoDuPlat` de G (ronde 1 de sa tâche 6) n'offre rien sans octets si ce qui arrivera ne s'affichera pas
  (`safeDisplayType` du `remote.mime`, sinon du `mime`) et relit les erreurs par `relireErreurs(ctxF)` (une définition, une `Map`). Tranché : la garde est
  recopiée, `relireErreurs` remplace la relecture locale, l'import de `lireErreursFichiers` disparaît.
- **EI-4** (tâche 3, `src/ui/photo-plat.js`) — Plan : `messageErreurImage` importée de `./livre-ajout.js`. Code commis : le lot E (D-E20) l'a déménagée dans
  `src/core/image.js` ; `livre-ajout.js` ne la ré-exporte que pour book.js et regroupement.js. Tranché : importée de `../core/image.js`.
- **EI-5** (tâches 3 et 5, `src/ui/components.js`, `src/ui/livre-ajout.js`, `src/ui/photo-plat.js`) — Plan : `photo-plat.js` lit `renderZoneCouverture` dans
  `livre-ajout.js`, et `import-web.js` importe `photo-plat.js` (tâche 5). Code commis : `livre-ajout.js` importe `./import-cible.js` depuis le lot E
  (`c647e4a`), qui importe `./import-web.js` depuis le lot B (`3ca8d19`) ; le graphe n'a AUCUN cycle à `35fb29c`, et B (D-B13 « sens unique ») comme E
  (D-E20, « un cycle ») les évitent exprès. Le plan tel quel ferme, à la tâche 5, le cycle import-web → photo-plat → livre-ajout → import-cible → import-web
  (mesuré : 1 composante cyclique ; suite verte et app chargée sans erreur quand même). Tranché : `renderZoneCouverture` est DÉPLACÉE dans `components.js`
  et ré-exportée par `livre-ajout.js` — le motif même de D-E20 (et de `lireBornee` / `signalDelai`, lot ISBN) ; 0 cycle ; suite et app vertes. À ratifier :
  le revers (garder la lettre du plan et accepter le cycle) ne change aucun test.
- **EI-6** (tâche 5, `src/ui/import-web.js` `enregistrerLecture`) — Plan : la forme du plan B rév. 2 (deux appels de `fabriquerLectureWeb`, le signet lu
  avant le dialogue). Code commis : la ronde 1 de la tâche 5 de B relit le signet et ses versions APRÈS le dialogue (`relire`, `fondement`, question
  reposée), appelle `fabriquerLectureWeb` une fois, et nomme la fiche `fiche.signet`. Tranché : le corps de B est gardé ligne pour ligne ; `photoAnnoncee`
  entre dans l'appel unique ; le déclenchement vise `fiche.signet.id`.
- **EI-7** (tâche 5, `renderImportWeb`) — Plan : `etat` sans `lu`, `charger()` qui relit le résultat pour l'annonce. Code commis : `etat.lu` (la lecture
  relue UNE fois par chargement, ronde 1 de B) et un `charger()` qui relit la ligne préférée et rejoue deux passes `marquerIllisible`. Tranché :
  `photoAnnoncee` est calculée sur `lu` et posée dans la même affectation que `ligne`, `lu` et `versions`.

**Défauts du plan** (indépendants des lots construits depuis ; corrigés au plus près, à ratifier) :

- **D-1** (tâche 1, u5, `tools/assistant-index.test.mjs`) — le flux de 2 Mio + 1 se FERMAIT dans le tirage qui suit le dernier octet : quand le lecteur
  franchit la borne, le flux est déjà clos et `reader.cancel()` n'appelle jamais `cancel()` — l'assertion `annule2 === true` ne pouvait pas être vraie
  (mesuré : rouge sur le code juste). Correction : la fermeture est différée d'un tirage (`finDemandee`) ; la borne exacte reste éprouvée (mutant « borne + 1 »
  de `lireCorpsBorne` rejoué : rouge, sans blocage).
- **D-2** (tâche 3, « rapatriement », cas 5) — `files` est adressé par l'empreinte : c1, c2 et c4 redescendaient la MÊME image que les cas 1 à 4 bis ; c2
  (« la ligne files du JPEG reste », `nf2 + 1`) était impossible, c1 et c4 (« aucune ligne files neuve ») vrais par construction — le mutant « `putFile`
  avant la garde » du Step 13 survivait (mesuré : seul le rouge permanent de c2). Correction : trois PNG distinctes (`pngC1`, `pngC2`, `pngC4`) ; le même
  mutant rougit alors c1 et c4.
- **D-3** (tâche 1, Step 5) — contre le code d'avant, u6, u6 bis, u7 et u11 attendent un `fetch` de l'image qui ne part jamais : `node --test` ne finit
  pas. Correction : le rouge se lit avec `--test-timeout=10000` (u7 et u6 bis (d) ont déjà leur `timeout`).

**Adaptations de forme** (même intention, autre forme du code commis) :

- **A-1** `supabase/functions/assistant/logique.js` l. 4-5 : le commentaire de B « OUTILS reste à quatre … » devenu faux est réécrit (cinq outils,
  `OUTILS_MODELE`).
- **A-2** `tools/generer-migrations.test.mjs` l. 1177-1178 : idem pour le commentaire d'`OUTILS_0006` ; préfixe l. 1188 de forme `slice(0, 4)` (R-F-9).
- **A-3** `src/model/schema.js` : `PHOTO_ORIGINS` et `HASH` après `VERIFICATION` (l. 149), `SOURCE_KINDS` de B séparant `AVAILABILITY` (l. 146) de
  `VERIFICATION`.
- **A-4** `src/domain/vocabulaire.js` : l'import garde `SOURCE_KINDS` (B) et `SORTES_IMPORT` (D) ; `photo_origin` après `source_kind` (l. 25).
- **A-5** `tests/lecture-web.js` l. 151 (« tout autre `eq` qui compare un `resultat.page` complet », Step 0 de la tâche 2) : `PAGE` y est l'entrée ET
  l'attendu — l'attendu devient `{ ...PAGE, image_url: null }`.
- **A-6** `src/domain/lecture-web.js` `fabriquerLectureWeb` : le corps RÉEL de B (l. 194-228 : vocabulaire de `source_kind` en tête, `incertains`, `lu_le`,
  copie `intact`) gardé ligne pour ligne, lignes « Lot F » ajoutées ; P-5 sur `{ ...intact, ...origine }` (cas prévu par le plan).
- **A-7** pins : quinze lignes relevées en Python à `35fb29c` (`tests/ajouter.js` 3806, 3808 ; `assistant-compte.js` 8 ; `classement.js` 2568 ;
  `creer-ia.js` 11 ; `passerelle.js` 765, 767 ; `recherche-web.js` 66, 69, 72 ; `sync-l3.js` 1867 ; `sync-l4.js` 514, 516, 3506, 3507), libellés du lot F
  et historique prolongé (convention du lot E).
- **A-8** `tests/tests.js` : l'appel du lot F se pose juste avant le thème (l. 236-238), soit après le bloc du lot D (l. 232-234) — celui du lot E est l. 217-219.
- **A-9** `src/ui/recipe.js` : imports que `photoDuPlat` lisait seule, relevés hors commentaires — lignes `../sync/mime.js` (l. 7) et `../core/blob-urls.js`
  (l. 8) entières, `vignettePage`, `gesteTelechargement`, `relireErreurs` de la ligne `./components.js` (l. 18).
- **A-10** `src/i18n/en.js` l. 528 : la valeur de G « Dish photo · {titre} » devient « Photo of the dish · {titre} » (cas prévu par le Step 10).
- **A-11** `src/ui/book.js` : `revoquerUrlDeBlob` rejoint la ligne existante `import { urlDeBlob } from '../core/blob-urls.js';` (l. 10, lot G).

**Fichiers rejoués** (39) : serveur — `supabase/functions/assistant/{lecture-web.js, logique.js, index.ts}` ; app — `src/model/schema.js`,
`src/domain/{vocabulaire.js, import-cible.js, passerelle.js, lecture-web.js}`, `src/domain/{base64.js, photo-web.js}` (neufs), `src/core/image.js`,
`src/ui/photo-plat.js` (neuf), `src/ui/{components.js, livre-ajout.js, recipe.js, meals.js, search.js, book.js, import-web.js, recipe-edit.js}`,
`src/i18n/en.js`, `styles.css`, `sw.js` ; tests — `tests/photo-plat.js` (neuf), `tests/{tests.js, import-cible.js, passerelle.js, lecture-web.js,
ajouter.js, creer-ia.js}` et les pins de `tests/{assistant-compte.js, classement.js, recherche-web.js, sync-l3.js, sync-l4.js}`,
`tools/{assistant-lecture-web, assistant-logique, assistant-index, generer-migrations}.test.mjs`. Vérifications sur les 39 : `python3 -I` invisibles
(U+200B-200D, U+2028/2029, U+202A-202E, U+2060, U+FEFF) **0** ; motifs de clés (Anthropic, JWT, `sb_secret_`, `sb_publishable_` réels) **0** ;
`node --check` **0 échec** ; chaque ligne de `35fb29c` qui porte une séquence « barre oblique inverse + u » retrouvée telle quelle **(0 perdue)** ; le
plan régénéré lui-même : invisibles 0.

**Mutants de la tâche 1** (Step 10, P-22 : copie entière, `node --test --test-timeout=10000` depuis la copie) : les 19 de la liste rougissent, chacun par au
moins un test nommé (`image/gif` → « LIMITES_IMAGE : forme », « typeImageAdmis : table », u4 ; 5 Mio → « forme », u5, u11 ; `svg+xml` → « typeImageAdmis »,
u4 ; WebP sur RIFF → « signatureImage », u4 ; signature retirée → u4 ; sans `valideAdresse` → « imageUrlDe », « lirePageHtml : page.image_url » ; sans
résolution → mêmes + u9 ; sans `autresRecettes` → « imageUrlDe », « lirePageHtml » ; premier Recipe → « lirePageHtml » ; `TRANCHE_BASE64 = 32768` →
« versBase64 », u5 ; `lire` hors du saut → u6 bis (a)-(d), u11, t5 ; minuterie retirée aux en-têtes → u6 bis (a), t5 ; `referer` → u2, t2 ;
`corpsModele = lu.corps` → u2 à u11, « index.ts (lot F) » ; `OUTILS` sans `image-web` → 17 tests dont « 0006 », u1-u11 ; `image-web` sans
`valideAdresse` → « lireDemande image-web », « lireDemandeUrl », u1 ; boucle propre → u10, « index.ts (lot F) », « index.ts : imports fermés… » ; second
`await fetch(` → « index.ts (lot F) », « index.ts : imports fermés… » ; `propre` → accès direct → « imageDe : formes »). Hors liste : M20 (EI-1) → t13.

**Ce qui reste au contrôleur** : (1) relire ce plan et le rapport, puis le commettre dans le worktree sous `docs/superpowers/plans/2026-10-19-plats-en-images.md`
(chemin par nom, message ASCII) ; (2) écrire les rulings R-F-12 et suivants (un par EI-1 à EI-7, et la ratification de D-1 à D-3) dans `rulings-F.md`,
puis spec § 12 à la clôture — EI-5 est le seul qui demande une décision de forme (déplacement ou cycle accepté) ; (3) poser le registre
`.superpowers/sdd/2026-10-19-plats-en-images/progress.md` (le relevé du Départ ci-dessus) et `recensement-D-F16.md` (Step 0 de la tâche 3 : aucun (c)
neuf) ; (4) les briefs (en-tête `entete.txt`), puis lancer la tâche 1.
