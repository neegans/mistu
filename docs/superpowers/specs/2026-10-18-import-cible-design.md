# Lot A — « Importer une recette repérée » : journal d'import et import ciblé — spec (rév. 1)

Date : 18 octobre 2026. Base : `main` `57babc6`. Branche `import-cible`, worktree `~/projects/mistu-import` (serveur 8088).
Sources : audit `docs/audits/2026-10-18-import-livres-photos-web.md` ; dossier de passation de Neegan (`Mitsu_Claude_Code`, 18 oct :
cahier des besoins B3 et B8, plan § 3-4, maquette `mobile/04_import_recette_ciblee.png`) ; design approuvé en chat le 18 oct (journal en
tête d'Ajouter). Méthode : spec → revue adverse → plan → construction par sous-agents → `/verify` → fusion par Neegan.

## 0. Décisions (chacune renversable sans défaire le reste)

- **D-1 (Neegan)** Le journal d'import se voit en tête de la page **Ajouter** (section « Imports »), avec un rappel sur la fiche du livre.
- **D-2 (contrôleur, d'après le dossier)** Le lot A livre **le journal ET l'import ciblé** : toucher une recette « Repérée dans ton livre »
  ouvre un écran déjà rattaché à sa référence, photos réorganisables, photo du plat facultative, « Extraire et enregistrer ». Le journal
  seul n'aurait rien de visible ; l'import ciblé est son premier consommateur et le « plus petit lot utilisable » demandé. Coût si faux :
  scinder en A1 (journal) et A2 (écran) ne défait rien.
- **D-3** « Extraire et enregistrer » **enregistre sans passer par l'éditeur** : la recette reçoit sa version `extraction` dès que le résultat
  est validé ; la vérification ligne à ligne reste **offerte, jamais imposée** (« Corriger » ouvre l'éditeur existant). La compatibilité
  alimentaire ne se certifie toujours pas sur une ligne non vérifiée (règle N-8, inchangée).
- **D-4** Photo du plat : **manuelle et facultative** dans ce lot (photographier ou choisir ; remplacer ; retirer), rangée dans `files` et
  pointée par `recipes.photo_sha256`. Aucune récupération automatique (lot F).
- **D-5** **Aucun changement serveur.** La consigne d'extraction (côté app, `src/domain/llm.js`) gagne deux booléens `incomplete` et
  `missing_page`, `notes` est enfin lue, `max_tokens` passe de 4 000 à 8 000, `stop_reason` est lu (`max_tokens` → « lecture coupée »).
- **D-6** Discordance : si le titre lu ne ressemble pas au titre de la référence (ou si la page lue diffère de plus de 3), l'écran demande
  « Le texte lu s'intitule “X” ; la référence est “Y” (p. N). Rattacher quand même ? » **avant** d'écrire. Jamais de rattachement silencieux
  à une autre recette, jamais de création d'une seconde fiche depuis cet écran.
- **D-7** Le journal est **synchronisé** comme les autres magasins (texte seulement, réponse brute bornée à 64 Ko) et **archivé**. Sur un
  autre appareil, « Reprendre » n'est offert que si le résultat validé est présent ; les photos restent sur l'appareil d'origine (lot G).
- **D-8** L'ancienne voie « Scanner cette recette » → page Ajouter + clé `sessionStorage.cuisineos.pending_recipe` est **remplacée** par la
  route ciblée ; la clé disparaît. « Saisir à la main » reste.
- **D-9** La direction visuelle des maquettes (crème, olive, grandes photos) est **hors lot** : le thème « magazine » (papier, tomate, vert)
  reste ; la couleur d'accent est une décision à part. Les maquettes fixent les **gestes et les libellés**, pas le code.
- **D-10** L'ordre des lots suivants est revu en § 9 : **G (octets entre appareils) remonte** en parallèle de B.

## 1. Pour toi

Dans un livre, une recette « Repérée » se touche : l'écran s'ouvre déjà sur son titre, son livre et sa page. Tu photographies ses pages
ou tu les choisis, tu les remets dans l'ordre si besoin, tu ajoutes la photo du plat si le livre en a une, puis **« Extraire et
enregistrer »**. L'assistant lit, l'app enregistre : la recette devient disponible, avec ses pages d'origine et sa photo, et dit ce qui
reste incertain. Si tu fermes l'app en route, rien n'est perdu : la section **Imports** de la page Ajouter te montre ce qui est en
cours, à reprendre ou en échec, et un geste suffit. Une relance ne rappelle pas l'assistant si sa réponse est déjà là.

## 2. Invariants

- **I-1 Rien d'inventé.** Un champ absent ou illisible vaut `null` ou `uncertain` ; `incomplete` et `missing_page` sont montrés, jamais
  comblés. Le texte du modèle est une **donnée hostile** : validé champ par champ, borné, rendu en nœuds texte.
- **I-2 Une référence, une recette.** L'import ciblé écrit **dans** la fiche visée (même identifiant) ; il ne crée jamais de seconde fiche.
- **I-3 Le résultat vit dans le journal avant d'atteindre l'écran.** Toute réponse validée est écrite dans `imports` **avant** tout rendu ou
  toute écriture de recette. Une fermeture ne perd que ce qui n'était pas encore reçu.
- **I-4 Pas de promesse « exactement une fois ».** Une coupure entre la réponse du fournisseur et l'écriture locale laisse l'import
  `echec` raison `incertain` : l'écran dit que l'appel a peut-être abouti et que relancer coûtera un appel. Le quota est réservé côté
  serveur avant l'appel (lot passerelle) : ce lot n'y touche pas.
- **I-5 Une correction est une version.** Relancer un import sur une recette déjà `available` crée une nouvelle version `extraction`
  (`parent_version_id` = la courante) et ne touche jamais une version `correction` existante ; `current_version_id` ne change que si la
  personne le demande (« Remplacer par cette lecture »).
- **I-6 Images sources ≠ photo du plat.** Les pages (`source_page_ids`, `role: 'recette'`) servent à lire ; la photo du plat
  (`photo_sha256`) sert à illustrer. L'une n'alimente jamais l'autre dans ce lot.
- **I-7 Un seul import en vol par appareil**, un bouton verrouillé, un « Annuler » qui abandonne l'appel (le serveur journalise 499).
- **I-8 Les états de la recette ne changent pas de vocabulaire** : `availability` et `verification_state` restent ; « en cours »,
  « échec », « à reprendre » sont des états du **journal**.
- **I-9 Tout texte d'écran passe par `t()`** avec son entrée `en.js` ; aucun texte ne nomme le fournisseur ni la base.

## 3. Données

### 3.1 Magasin `imports` (neuf, `DB_VERSION 4`)

```
{ id: 'imp_…', kind: 'recette' | 'index',            // 'couverture' et 'web' réservés aux lots E et B
  edition_id, recipe_id,                             // la référence visée (recette) ; null pour un index
  scan_session_id, page_ids: [ 'pg_…' ],             // les photos, dans l'ordre de lecture
  photo_sha256: null | '…',                          // photo du plat choisie sur l'écran (posée sur la recette à l'enregistrement)
  status: 'a_lancer' | 'en_cours' | 'a_verifier' | 'enregistre' | 'echec' | 'ignore',
  erreur: null | { raison, extra },                  // raisons de la passerelle + 'interrompu' | 'incertain' | 'hors_ligne' | 'annule' | 'coupe' | 'illisible'
  resultat: null | { … sortie validée … },           // § 3.4
  reponse_brute: null | string,                      // ≤ 64 Ko (points de code), diagnostic seulement, jamais rendue
  appels: 0, model: null | string, duree_ms: null,
  device_id, created_at, updated_at, started_at, finished_at }
```
Index : `['edition_id','edition_id'], ['recipe_id','recipe_id'], ['status','status']`. Relations : `edition_id → book_editions`,
`recipe_id → recipes`, `scan_session_id → scan_sessions`, `page_ids[] → source_pages`. Synchronisé, archivé, hors `noDelete`.
Transitions : `a_lancer → en_cours → a_verifier | echec` ; `a_verifier → enregistre` ; `echec → en_cours` (relance) | `ignore` ;
`en_cours → echec(annule)` par « Annuler » ; `en_cours → echec(interrompu)` au démarrage pour les lignes de **cet** appareil.
Rétention : `enregistre` et `ignore` purgés à `init()` après 30 jours (origine `device`, hors file de synchro), comme les conflits.

### 3.2 Autres champs

| Magasin | Ajout | Sens |
|---|---|---|
| `source_pages` | `position` **modifiable** ; `role: 'recette' \| 'index' \| null` posé à l'enregistrement (en plus de `kind`, conservé pour l'existant) | ordre corrigé par la personne ; nature de la photo |
| `recipes` | `photo_sha256: null \| string` (pointeur souple, comme `cover_sha256`), `photo_origin: 'appareil' \| 'galerie' \| null` | photo du plat |
| lignes d'ingrédients (`recipe_versions.ingredients[]`) | `uncertain: boolean` | l'incertitude dite par le modèle survit |
| `recipe_versions.provenance` | `+ import_id`, `+ incomplete`, `+ missing_page` | d'où vient la version, et ses limites |

### 3.3 Vocabulaire validé à l'écriture

`db.mutate` (porte unique) refuse une fiche `recipes` dont `availability` ∉ `AVAILABILITY` ou `verification_state` ∉ `VERIFICATION`,
et une fiche `imports` dont `status` est hors liste (erreur nommée, aucune écriture). Les fiches reçues de la synchro ne sont pas
revalidées (comme aujourd'hui pour les chaînes de contrôle : règle à la réception = tolérance).

### 3.4 Sortie de l'extraction (contrat avec le modèle, côté app)

Schéma demandé (`PARSER_SYSTEM` amendé, `src/domain/llm.js`) :
```
{"title", "language", "servings", "prep_minutes", "cook_minutes",
 "ingredients":[{"source_text","uncertain"}], "steps":[{"text"}], "printed_page",
 "sub_recipes":[{"title","page_reference"}], "uncertain_fields":[string], "notes",
 "incomplete": boolean, "missing_page": boolean}
```
Règles ajoutées à la consigne : « Si une page semble manquer (étapes qui commencent au milieu, ingrédients sans étapes, renvoi à une page
absente), mets `missing_page: true` ; si la recette est visiblement partielle, `incomplete: true` ; une étape peut tenir sur plusieurs
lignes : garde-la entière. » `validateParsedRecipe` : bornes **strictes** (titre ≤ 200 points de code, ligne ≤ 300, étape ≤ 2 000, notes
≤ 2 000, ≤ 80 lignes, ≤ 60 étapes, entiers finis ≥ 0 pour portions/durées/page, booléens coercés, tableaux filtrés) ; `max_tokens` 8 000 ;
`stop_reason === 'max_tokens'` → `echec(coupe)` sans écrire de recette ; JSON illisible → `echec(illisible)` (réponse brute gardée).

### 3.5 Serveur : migration `0005_imports.sql`

Générée par `tools/generer-migrations.mjs` : la liste `SYNC_STORES_0003` (26) est **figée** dans `src/sync/tables.js` (dette nommée du lot
« assistant par le compte »), `0003` est rendue depuis elle et son empreinte SHA-256 épinglée ; `0005` est rendue, à ajout seul, pour les
magasins absents de `SYNC_STORES_0003` (ici `imports`), avec les quatre fonctions recréées sur les 27 magasins. Preuve
`supabase/proofs/0005_imports.sql` (table, RLS, `revoke anon`, colonnes générées `edition_id` / `recipe_id` / `status`, `sync_push` accepte
une ligne `imports`, `rollback;` dernier). `supabase/README.md` étape 11. **Ordre des gestes : `0005` collée avant le `push`** (sinon la
synchro met les lignes `imports` en quarantaine `refus`, bruyant mais non destructif).

## 4. Parcours

### 4.1 Entrée

- Fiche du livre (`src/ui/book.js`) : la ligne d'une recette `reference_only` sans `source_url` devient un lien vers
  `#/recipes/<id>/importer` ; le bouton « Scanner cette recette » disparaît, « Saisir à la main » reste.
- Fiche d'une référence (`src/ui/recipe.js`) : « Scanner cette recette » devient « Importer cette recette » → même route.
- Route neuve `route('/recipes/:id/importer', renderImportCible)` **avant** `/recipes/:id` dans `src/app.js` ; module neuf
  `src/ui/import-cible.js` (écran) + `src/domain/import-cible.js` (logique pure : modèle d'écran, fabrication de la version, discordance,
  transitions du journal). Une fiche qui n'est pas `reference_only` ou qui porte un `source_url` ouvre l'écran en mode « relecture »
  (I-5) ou renvoie à la fiche avec un toast, selon le cas (§ 4.4).

### 4.2 L'écran `#/recipes/<id>/importer`

1. **En-tête** : sur-titre « Importer une recette », titre de la référence, « {livre} · p. {n} », badge « Repérée dans ton livre ».
2. **Pages de la recette** : vignettes dans l'ordre de `position`, chacune avec son rang, son champ « p. imprimée », les boutons
   « Monter », « Descendre » (toujours présents, ≥ 44 px) et « Retirer » (nom accessible « Retirer la page {n} ») ; le glisser au toucher
   est un **plus** par-dessus, jamais le seul moyen. Sous les vignettes : « Photographier » et « Choisir des photos » (`pickFiles`,
   `multiple`, `capture: 'environment'`). Chaque ajout **persiste tout de suite** : une séance liée à l'import (`scan_sessions.status:
   'open'`, `source_documents`, `source_pages`, octets dans `files`) et `imports.page_ids` ; réordonner écrit `position` ; retirer détache
   la page de l'import (la ligne `source_pages` reste, l'octet aussi : règle actuelle).
3. **Photo du plat — facultatif** : « Prendre une photo », « Choisir une image », aperçu, « Remplacer », « Retirer » ; réduite par
   `reduireImage` (1 200 px, JPEG, 16 Mpx max) comme une couverture ; octets dans `files`, `imports.photo_sha256`.
4. **« Extraire et enregistrer »** (primaire, éteint sans page, sans session, hors ligne ou pendant un vol ; sous le bouton : « Les pages et
   la photo seront liées à cette recette. »). Pendant le vol : « Lecture des pages par l'assistant… », « Annuler ».
5. Sans session : la carte « Connecte-toi pour utiliser l'assistant. » (`carteConnexion(connecter, ctx)`), les photos s'ajoutent quand même.

### 4.3 Extraction et enregistrement

1. `imports` → `en_cours` (`started_at`, `appels + 1`). Appel unique : `PasserelleProvider.complete` avec les pages **dans l'ordre de
   `position`**, réduites par `pagePourEnvoi` (existant), `maxTokens: 8000`, `signal` d'un `AbortController` (nouveau paramètre de
   `complete`, propagé à `appelerAssistant`).
2. Réponse → `parseJsonLoose` + `validateParsedRecipe` → **écriture `imports.resultat` + `reponse_brute` + `model` + `duree_ms`,
   `status: 'a_verifier'`** (I-3). Échec → `status: 'echec'`, `erreur` (raison de la passerelle : `non_connecte`, `non_admis`, `quota`,
   `trop_de_demandes`, `trop_lourd`, `requete`, `serveur`, `delai`, `reseau` ; ou `annule`, `coupe`, `illisible`).
3. **Discordance** (D-6, `discordance(resultat, reference)` pure) : titre lu vs titre de la référence par `normalizeText` + Jaccard des
   mots ≥ 0,5 ou inclusion ; page lue vs `printed_page` à ± 3. Si discordance : dialogue « Rattacher quand même ? » / « Annuler » ;
   « Annuler » laisse l'import `a_verifier` (reprenable, le résultat n'est pas perdu).
4. **Fabrication** (`fabriquerExtraction(resultat, { reference, pages, edition, convention, importId, modele })`, pure, dans
   `src/domain/import-cible.js`, calquée sur `fabriquerRecetteIA`) : lignes par `parseIngredientLine` (avec `uncertain` du modèle,
   `verification_state: 'to_verify'`), étapes par `parseStepsBlock` sur le texte **par étape** (une étape du modèle = une étape, même
   multi-lignes), version `kind: 'extraction'`, `provenance { source_page_ids, source_document_id, generated_by: 'ai', model, edition_id,
   convention_snapshot, import_id, incomplete, missing_page }`, `verification_state: 'to_verify'` ; fiche : `availability` = `available`
   si lignes et étapes, `partial` sinon (`reference_only` conservé si rien) ; `incomplete` ou `missing_page` → `partial` au plus ;
   `original_title` **conservé** (celui de la référence ; le titre lu va dans `provenance.titre_lu`), `printed_page` posé si vide,
   `source_page_ids` = union, `photo_sha256`/`photo_origin` posés, `current_version_id` = la nouvelle version (sauf I-5), `ingredient_ids`.
5. **Une transaction** `repo.saveBatch({ recipes, recipe_versions, source_pages (role 'recette', printed_page), scan_sessions
   (recipe_ids, status 'done'), imports (status 'enregistre', finished_at) })`. Puis navigation vers la fiche, toast « Recette importée ».
6. **Fiche** (`src/ui/recipe.js`) : bandeau « Lue par l'assistant le {date} · {n} ligne(s) incertaine(s) » (ou « · page possiblement
   manquante », « · lecture incomplète »), état de vérification de la fiche enfin affiché (« Vérifiée » / « {n} lignes à vérifier »), photo
   du plat en tête quand `photo_sha256` a ses octets (sinon rien, pas de message), « Corriger » (éditeur existant) ; les lignes
   `uncertain` portent une puce « incertain » distincte de « à vérifier ».

### 4.4 Cas et textes

| Cas | Journal | Écran |
|---|---|---|
| Hors ligne au clic | rien n'est créé | « Tu es hors ligne. » (bouton éteint tant que `navigator.onLine` est faux) |
| Session absente | rien | carte « Connecte-toi pour utiliser l'assistant. » |
| Quota, trop lourd, serveur, délai, réseau, compte refusé | `echec(raison)` | textes existants de `texteEchecAssistant` / `texteRefusAssistant` + « Relancer » (sauf quota : « Chercher demain » n'existe pas ; « Relancer » reste, le serveur dira 429) |
| « Annuler » | `echec(annule)` | « Lecture annulée. » + « Relancer » |
| Réponse coupée (`max_tokens`) | `echec(coupe)` | « La lecture a été coupée : essaie avec moins de pages. » |
| JSON illisible | `echec(illisible)` | « L'assistant n'a pas répondu lisiblement. Réessaie. » (« Code : illisible ») |
| App fermée pendant le vol | `echec(interrompu)` au démarrage | « La lecture a été interrompue. Relance-la. » |
| Réponse reçue, écriture locale échouée (exception dans `db.mutate`) | `echec(incertain)` | « L'appel a peut-être abouti sans être enregistré ; relancer coûtera un appel. » |
| Discordance | reste `a_verifier` si refus | dialogue D-6 |
| Déjà `available` (relecture) | nouvelle version, `current_version_id` inchangé | « Cette recette a déjà un texte. La nouvelle lecture sera une version de plus. » + « Remplacer par cette lecture » (facultatif) |
| Signet (`source_url`) | — | toast « Un lien web s'importe au lot suivant. », retour fiche |

### 4.5 Reprise : la section « Imports »

Page Ajouter (`src/ui/add.js`), **avant** la grille, seulement si non vide : une ligne par import `en_cours`, `a_verifier`, `echec` et une
par séance `open` sans import (« Photos conservées : {n} page(s) · {livre} » → « Ouvrir la séance », ce qui absorbe « Séances à
reprendre »). Ligne : titre de la référence (ou « Index · {livre} »), âge (« il y a 2 h »), état, gestes : `en_cours` → « Annuler » ;
`a_verifier` → « Reprendre » (ouvre l'écran ciblé en relecture du résultat : discordance puis enregistrement, **sans appel**) ;
`echec` → « Relancer » (nouvel appel sur les mêmes pages ; si `resultat` existe déjà, « Reprendre » est offert en premier) et
« Ignorer » (`ignore`). Fiche du livre : « {n} import(s) à reprendre » → même liste filtrée. Autre appareil : « Photos sur un autre
appareil » ; « Reprendre » seulement si `resultat` est présent ; « Relancer » absent.

### 4.6 Ce qui disparaît

`sessionStorage.cuisineos.pending_recipe` (poseurs et lecteur) ; le bouton « Scanner cette recette » ; la case « Oui, rattacher » de
l'éditeur (`recipe-edit.js`) n'a plus de source : retirée. L'éditeur garde « Lire avec l'assistant IA » pour une recette sans référence
(« Regrouper en recette » depuis une séance) : ce chemin **écrit aussi dans le journal** (`kind: 'recette'`, `recipe_id: null` jusqu'à
l'enregistrement) pour ne plus perdre une lecture ; son remplissage de formulaire reste inchangé. Le panneau d'index écrit de même
(`kind: 'index'`, `resultat = { entries, uncertain }`) et son bouton est verrouillé pendant l'appel.

## 5. Textes (FR → EN, toutes par `t()`)

« Importer une recette » → "Import a recipe" · « Pages de la recette » → "Recipe pages" · « {n} photo(s) ajoutée(s) » → "{n} photo(s)
added" · « Monter » → "Move up" · « Descendre » → "Move down" · « Retirer la page {n} » → "Remove page {n}" · « Photographier » (existante)
· « Choisir des photos » → "Choose photos" · « Photo du plat » → "Dish photo" · « Facultatif » → "Optional" · « Ajoute la photo du livre,
s'il y en a une. » → "Add the book's photo, if there is one." · « Prendre une photo » → "Take a photo" · « Choisir une image » (existante)
· « Remplacer » → "Replace" · « Extraire et enregistrer » → "Extract and save" · « Les pages et la photo seront liées à cette recette. » →
"The pages and the photo will be linked to this recipe." · « Lecture des pages par l'assistant… » (existante) · « Recette importée » →
"Recipe imported" · « Lue par l'assistant le {d} » → "Read by the assistant on {d}" · « {n} ligne(s) incertaine(s) » → "{n} uncertain
line(s)" · « page possiblement manquante » → "page possibly missing" · « lecture incomplète » → "incomplete reading" · « Vérifiée » /
« {n} lignes à vérifier » → "Verified" / "{n} lines to check" · « Imports » → "Imports" · « Reprendre » → "Resume" · « Relancer » → "Retry"
· « Ignorer » → "Dismiss" · « Photos conservées : {n} page(s) » → "Photos kept: {n} page(s)" · « Photos sur un autre appareil » → "Photos
on another device" · « {n} import(s) à reprendre » → "{n} import(s) to resume" · les textes de § 4.4 et D-6. Les clés exactes font foi
dans `en.js` ; le plan les reprend.

## 6. Serveur

Aucun changement de la fonction `assistant` (outil `extraction`, borne 8 Mio, modèle forcé). Migration `0005`, preuve, README (§ 3.5).

## 7. Tests (suite navigateur, fixtures, `fetch` factice ; Node pour le générateur)

- **Schéma** : montée `DB_VERSION 3 → 4` sur une base peuplée (magasin et index créés, données intactes) ; `imports` dans `SYNC_STORES`,
  `ARCHIVE_DATA_STORES`, `RELATIONS` ; archive aller-retour avec une ligne `imports` ; validation du vocabulaire (écriture refusée,
  nommée, rien d'écrit).
- **Domaine pur** (`src/domain/import-cible.js`) : `modeleEcran` (ordre, Monter/Descendre aux bornes, retrait), `discordance` (titres
  proches / éloignés, page ± 3, accents et casse), `fabriquerExtraction` (version, provenance, `uncertain`, `partial` sur `incomplete`,
  titre de la référence conservé, étapes multi-lignes entières, `current_version_id` selon I-5), transitions de `imports` (table complète,
  transitions interdites refusées), `validateParsedRecipe` durci (chaque borne, booléens, `stop_reason`).
- **Écran** : route rendue pour une référence ; ajout de photos → séance et `imports.page_ids` écrits **avant** tout appel ; réordonner
  écrit `position` ; « Extraire et enregistrer » → **un** POST, pages dans l'ordre de `position`, résultat écrit dans `imports` **avant**
  la recette (ordre des `db.mutate` espionné) ; enregistrement en **une** transaction ; fiche : bandeau, puces, photo ; « Annuler » → abandon
  + `echec(annule)` + aucune recette écrite ; chaque raison de § 4.4 → texte et geste ; discordance → dialogue, refus → `a_verifier` ;
  double clic → un appel ; hors ligne → aucun appel ; session absente → carte, photos ajoutables ; signet → toast et retour.
- **Reprise** : section « Imports » absente quand vide, une ligne par état, « Reprendre » → écran prérempli **sans appel** et enregistrement
  possible ; « Relancer » → un appel, **aucune** page ni séance en double ; « Ignorer » ; redémarrage avec `en_cours` de cet appareil →
  `interrompu` ; ligne d'un autre appareil sans résultat → ni Reprendre ni Relancer ; purge à 30 jours.
- **Régression** : `pending_recipe` absent du source ; « Saisir à la main » intact ; « Regrouper en recette » écrit dans le journal ;
  panneau d'index verrouillé pendant l'appel ; tests existants de `tests/passerelle.js` adaptés (nouveau `maxTokens`, `signal`).
- **Générateur** : `SYNC_STORES_0003` figée (26 noms), empreinte de `0003` épinglée, `0005` rendue pour `imports` seul, `--check` 0, preuve
  `0005` : syntaxe pglast, `rollback` dernier ; test node du README (étape 11).
- Total épinglé relevé ; `sw.js` et `APP_VERSION 0.9.0` ; mutants rejoués sur copies (ordre journal → recette ; discordance ignorée ;
  `pending_recipe` réintroduit ; signal non propagé ; validation du vocabulaire retirée).

## 8. Hors périmètre (nommé pour ne pas y glisser)

Classement automatique d'un lot de photos (D) ; table des matières structurée et ordre proposé par le modèle (C) ; lecture d'une page web
(B) ; lecture de la couverture (E) ; récupération ou recadrage automatique de la photo du plat (F) ; octets entre appareils (G) ;
changement de thème ou de couleur d'accent (décision à part) ; quota visible dans l'app ; modèle autre que celui du serveur.

## 9. Suite B à G (ordre revu)

- **G remonte** : sans les octets, aucune photo prise sur l'iPhone n'est visible sur le Mac, et la preuve « deux appareils » du dossier
  est impossible. G ne dépend de rien ; il peut se construire **en parallèle de B** par un second sous-agent (fichiers disjoints : `src/sync/`
  + seau `pages` contre `supabase/functions/` + écran web). Ordre proposé : **A → (B ∥ G) → C → D → E → F**. E reste petit et peut
  s'intercaler.
- Dépendances réelles : C et D consomment le journal (A) ; D consomme l'appariement et `index_page_id` (C) ; F consomme B pour l'image
  web et `photo_sha256` (A) ; rien ne dépend de G sauf la preuve multi-appareils.

## 10. Preuve réelle préalable (geste de Neegan, avant la construction)

Sur le site public, connecté : Ajouter → « Photographier ou importer des pages » → une vraie page de recette → « Regrouper en recette »
→ « Lire avec l'assistant IA ». À noter : le **modèle** affiché dans Réglages → Assistant (« Modèle en service : … », c'est la valeur réelle
du secret `ASSISTANT_MODELE`, par défaut `claude-sonnet-5-5`), la **durée**, le texte obtenu contre la page (ingrédients, quantités,
unités, étapes), et ce qu'il reste après avoir quitté l'écran et rouvert l'app (attendu : rien, c'est ce que le lot corrige). Aucun agent
ne dépense d'appel à la place de Neegan. Si le résultat révèle une limite (JSON coupé à 4 000 jetons, lenteur, texte infidèle), la spec
est amendée **avant** le plan.

## 11. Risques et limites assumés

- Le décodage d'une photo d'iPhone de plusieurs dizaines de Mpx par `createImageBitmap` n'a jamais été mesuré ; `pagePourEnvoi` réduit à
  1 568 px mais décode d'abord l'original.
- 8 Mio par appel ≈ 8 à 10 pages réduites ; au-delà, 413 « trop lourde : choisis moins de pages ».
- Une ligne `imports` synchronisée avant que la fiche `recipes` le soit peut, sur un autre appareil, pointer un `recipe_id` encore absent :
  la section l'affiche avec « (référence pas encore reçue) », sans geste, jusqu'à la passe suivante.
- Le glisser au toucher n'est pas mesuré sur Safari ; Monter/Descendre sont le chemin garanti.
- La purge à 30 jours ne concerne que `enregistre` et `ignore` ; un `echec` reste jusqu'à un geste.

## 12. Ce que la construction a amendé

(à remplir par les rulings)
