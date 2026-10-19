# Lot A — « Importer une recette repérée » : journal d'import et import ciblé — spec (rév. 3.1)

Date : 18 octobre 2026. Base : `main` `57babc6`. Branche `import-cible`, worktree `~/projects/mistu-import` (serveur 8088).
Sources : audit `docs/audits/2026-10-18-import-livres-photos-web.md` ; dossier de passation de Neegan (`Mitsu_Claude_Code`, 18 oct :
cahier des besoins B3 et B8, plan § 3-4, maquette `mobile/04_import_recette_ciblee.png`) ; design approuvé en chat le 18 oct (journal en
tête d'Ajouter). Rév. 2 : après la revue adverse de la rév. 1 (2 Critical, 17 Important, mineurs). Rév. 3 : après la re-revue de la rév. 2 (N1-N5, m1-m10) ; les rulings sont en § 12.
Méthode : spec → revue adverse → plan → construction par sous-agents → `/verify` → fusion par Neegan.

## 0. Décisions (chacune renversable sans défaire le reste)

- **D-1 (Neegan)** Le journal d'import se voit en tête de la page **Ajouter** (section « Imports »), avec un rappel sur la fiche du livre.
- **D-2 (contrôleur, d'après le dossier B3)** Le lot A livre **le journal ET l'import ciblé** : toucher une recette « Repérée dans ton
  livre » ouvre un écran déjà rattaché à sa référence, photos réorganisables, photo du plat facultative, « Extraire et enregistrer ». Le
  journal seul n'aurait rien de visible ; l'écran est le « plus petit lot utilisable » demandé. Coût si faux : scinder en A1 / A2.
- **D-3 (dossier B3 et § 3 du plan de Neegan : « Mitsu extrait automatiquement le contenu ; il demande une intervention seulement
  lorsqu'une ambiguïté … le justifie » ; « ne pas imposer la confirmation manuelle de chaque ligne lisible » — à CONFIRMER par Neegan,
  revue I14)** « Extraire et enregistrer » **enregistre sans passer par l'éditeur**. La vérification ligne à ligne reste **offerte, jamais
  imposée** (« Corriger »). La compatibilité alimentaire ne se certifie toujours pas sur une ligne non vérifiée (N-8). **Le mode cuisine et
  la liste de courses portent le bandeau « Lue par l'assistant, non relue »** tant que la version courante est une extraction non vérifiée.
- **D-4 (dossier B3 : zone « Photo du plat — facultatif »)** Photo du plat **manuelle et facultative** : photographier ou choisir ;
  remplacer ; retirer. Rangée dans `files`, pointée par `recipes.photo_sha256`. Aucune récupération automatique (lot F).
- **D-5** **Aucun changement serveur.** La consigne d'extraction (côté app) gagne `incomplete` et `missing_page`, `notes` est lue,
  `max_tokens` passe de 4 000 à **6 000** (une sortie plus longue frôlerait l'abandon serveur à 120 s ; la preuve § 10 mesure), `stop_reason`
  est lu.
- **D-6** Discordance : le titre lu doit **contenir chaque mot distinctif** du titre de la référence (mots vides retirés, accents et casse
  ignorés) ; sinon, ou si la page lue diffère de plus de 3, ou si le titre lu est nul : dialogue **avant** d'écrire. Jamais de rattachement
  silencieux, jamais de seconde fiche depuis cet écran.
- **D-7** Le journal est **synchronisé** (texte ; réponse brute bornée à 16 000 points de code, effacée à l'enregistrement) et **archivé** ; une archive plus
  ancienne sans `imports` reste restaurable. Sur un autre appareil, « Reprendre » n'est offert que si le résultat validé est présent.
- **D-8** La voie « Scanner cette recette » → Ajouter + `sessionStorage.cuisineos.pending_recipe` est **remplacée** par la route ciblée ;
  la clé et la case « Oui, rattacher » disparaissent ; « Saisir à la main » reste.
- **D-9** Direction visuelle des maquettes (crème, olive, grandes photos) : **hors lot** ; le thème « magazine » reste ; les maquettes fixent
  les **gestes et les libellés**.
- **D-10** Ordre des lots suivants (§ 9) : **G remonte**, en parallèle de B (fusions séquentielles : les deux touchent `sw.js`, `APP_VERSION`,
  `en.js`, `schema.js` et le total épinglé).
- **D-11 (rév. 2)** Entrées de l'écran : une recette `reference_only` sans `source_url`, ou `partial` (import à refaire). Une recette
  `available` n'a pas d'entrée dans ce lot (la « relecture » d'une recette complète est hors périmètre : I-5 s'y réduit).
- **D-12 (rév. 2)** Validation du vocabulaire : une fonction de domaine partagée (`assertVocabulaire`) appelée par les **fabricants** de fiches
  (import ciblé, création IA, signet, éditeur), jamais un mur dans `db.mutate` (la restauration, la réception et les passes du démarrage
  restent tolérantes).

## 1. Pour toi

Dans un livre, une recette « Repérée » se touche : l'écran s'ouvre déjà sur son titre, son livre et sa page. Tu photographies ses pages
ou tu les choisis, tu les remets dans l'ordre si besoin, tu ajoutes la photo du plat si le livre en a une, puis **« Extraire et
enregistrer »**. L'assistant lit, l'app enregistre : la recette devient disponible, avec ses pages d'origine et sa photo, et dit ce qui
reste incertain. Si tu fermes l'app en route, les photos, l'ordre et la lecture déjà reçue sont gardés : la section **Imports** de la
page Ajouter montre ce qui est en cours, à reprendre ou en échec, et un geste suffit. Une lecture reçue et gardée « à vérifier »
s'enregistre sans rappeler l'assistant.

## 2. Invariants

- **I-1 Rien d'inventé.** Un champ absent ou illisible vaut `null` ou `uncertain` ; `incomplete` et `missing_page` sont montrés, jamais
  comblés. Le texte du modèle est une **donnée hostile** : validé champ par champ, borné (un dépassement **refuse** le résultat, raison
  `hors_bornes`), rendu en nœuds texte. Un résultat **revenu du journal** (synchro, archive) est **revalidé** avant tout usage (I2).
- **I-2 Une référence, une recette.** L'import ciblé écrit **dans** la fiche visée (même identifiant) ; il ne crée jamais de seconde fiche.
  **Un seul import non terminé par `recipe_id`** : entrer dans l'écran reprend l'import ouvert s'il existe (I8).
- **I-3 Le résultat vit dans le journal avant d'atteindre l'écran.** Toute réponse validée est écrite dans `imports` **avant** tout rendu ou
  toute écriture de recette.
- **I-4 Pas de promesse « exactement une fois ».** Tout état où un appel a pu partir sans que sa réponse soit enregistrée (`interrompu`,
  `annule`, `incertain`) est dit avec la même phrase : « L'appel a peut-être été compté ; relancer en coûtera un autre. » (I1).
- **I-5 Une correction est une version, et ce que la personne a écrit n'est jamais masqué sans question.** Sur une recette `partial`, une
  nouvelle lecture crée une version `extraction` (parent = la courante) ; elle devient courante **sauf** si une version **non produite par
  l'assistant** existe (`generated_by !== 'ai'` : saisie à la main ou `correction`), auquel cas l'écran demande « Remplacer par cette
  lecture ? » ; sur « non », la version est ajoutée sans devenir courante, et la fiche reçoit quand même l'union des pages, `kind: 'recipe'`
  sur les pages et la photo du plat (ce que l'écran a promis), rien d'autre (I3, N4).
- **I-6 Images sources ≠ photo du plat.** Pages (`source_page_ids`, `kind: 'recipe'`) pour lire ; photo du plat (`photo_sha256`) pour
  illustrer. L'une n'alimente jamais l'autre dans ce lot.
- **I-7 Un seul import en vol par document** (onglet), tenu par une variable de module ; « Annuler » n'est offert que par le document qui
  tient le vol ; ailleurs, la ligne dit « En cours sur un autre écran » (I11).
- **I-8 Les états de la recette ne changent pas de vocabulaire** : `availability` et `verification_state` restent ; « en cours », « échec »,
  « à reprendre » sont des états du **journal**.
- **I-9 Tout texte d'écran passe par `t()`** avec son entrée `en.js` ; aucun texte ne nomme le fournisseur ni la base.
- **I-10 Toute écriture qui touche une ligne du journal est conditionnée** (`conditions` de `db.mutate`, § 3.6) : lue, vérifiée et écrite
  dans la même transaction que tout ce qui l'accompagne (recette, pages, séance) ; une condition fausse annule la transaction entière,
  nommée, sans écriture (I11, N1).

## 3. Données

### 3.1 Magasin `imports` (neuf, `DB_VERSION 4`, **dernier magasin synchronisé** : déclaré dans `STORES` juste après `assistant_config` et avant `settings`, pour garder l'ordre de réception, K-9)

```
{ id: 'imp_…', kind: 'recette' | 'index',            // 'couverture' et 'web' réservés aux lots E et B
  edition_id, recipe_id,                             // la référence visée ; null pour un index ou un « Regrouper en recette »
  scan_session_id, page_ids: [ 'pg_…' ],             // les photos, DANS L'ORDRE DE LECTURE (seule source de vérité de l'ordre)
  photo_sha256: null | '…',                          // photo du plat choisie sur l'écran (posée sur la recette à l'enregistrement)
  status: 'a_lancer' | 'en_cours' | 'a_verifier' | 'enregistre' | 'echec' | 'ignore',
  erreur: null | { raison, extra },                  // raisons § 4.4
  resultat: null | { … sortie validée, § 3.4 … },
  reponse_brute: null | string,                      // ≤ 16 000 points de code (une sortie de 6 000 jetons peut dépasser : coupée, m7), diagnostic, jamais rendue, null à `enregistre`
  appels: 0, model: null, duree_ms: null,
  device_id, document_id_vol: null | string,          // le document (onglet) qui tient le vol, et son battement
  battement_at: null | iso,
  created_at, updated_at, started_at, finished_at }
```
Index : `edition_id`, `recipe_id`, `status`. Relations d'archive : `edition_id → book_editions`, `scan_session_id → scan_sessions` ;
**`recipe_id` et `page_ids[]` sont des pointeurs souples** (hors `RELATIONS`, comme `cover_sha256`) : une page retirée ou une recette
supprimée ne bloquent pas une archive ; la fabrication ignore une page absente. Taille : résultat ≤ 6 000 jetons de sortie, réponse brute
≤ 16 000 points de code : sous la borne de 512 Kio par élément de `sync_push`.

**Transitions** (toutes par `repo.transitionner`, I-10) :
`a_lancer → en_cours | ignore` · `en_cours → a_verifier | echec` · `a_verifier → enregistre | a_lancer (changer les pages) | ignore` ·
`echec → en_cours (relancer) | a_lancer (changer les pages) | ignore` · `en_cours → echec(annule)` par le document qui tient le vol ·
`en_cours → echec(interrompu)` au démarrage, **pour les lignes de cet appareil seulement** (le battement, d'origine `device`, n'est pas visible ailleurs) et **seulement si `battement_at` a plus de 90 s** (le vol bat toutes les 15 s, écriture d'origine
`device` : jamais en file de synchro, m2) · `a_verifier → echec(illisible)` (T4-R1, ratifiée) pour **un seul cas** : un `resultat` relu du
journal (synchro, archive) qui ne passe plus `validateParsedRecipe` — au montage de l'écran ciblé ou au clic « Enregistrer cette lecture » (I-1,
§ 4.5) ; le résultat est effacé (`resultat: null`), rien n'atteint l'écran, et c'est la **seule écriture qu'un simple montage de l'écran peut
faire** (origine `local` : elle part en file, comme toute transition du journal) · aucune autre.
Une réponse qui arrive après un `annule`/`interrompu` tente `echec → a_verifier`, qui n'existe pas : elle est **écrite dans
`reponse_brute` seulement** (diagnostic), l'état reste `echec` ; c'est le prix assumé de I-4.

**Rétention** : à `enregistre`, `reponse_brute` passe à `null` ; après 30 jours, `enregistre` et `ignore` sont **supprimés** à `init()`
par une suppression **d'origine `local`** (tombale synchronisée, R57) : la ligne disparaît aussi du serveur et des autres appareils ; ce
jour-là, « À envoyer » et la pastille montent d'autant sans geste de la personne (m1, assumé).
`provenance.import_id` est un **pointeur souple** (une version survit à son import).

### 3.2 Autres champs

| Magasin | Ajout | Sens |
|---|---|---|
| `source_pages` | `position` réécrite à l'enregistrement depuis l'ordre de `page_ids` ; `kind: 'recipe'` posé comme aujourd'hui (pas de champ `role`) ; `printed_page` de la page gardé, et une page SANS numéro ne reçoit celui de la fiche que si elle est la **première** de l'ordre (T3 ronde 1 : la deuxième photo d'une recette p. 132 est la p. 133, rien d'inventé) | l'ordre choisi ; nature de la photo |
| `recipes` | `photo_sha256: null \| string` (pointeur souple), `photo_origin: 'photo' \| 'image' \| null` (le geste touché) | photo du plat |
| lignes d'ingrédients | `uncertain: boolean` | l'incertitude dite par le modèle |
| `recipe_versions.provenance` | `import_id` (souple), `incomplete`, `missing_page`, `titre_lu` | d'où vient la version et ses limites |

### 3.3 Vocabulaire (D-12)

`assertVocabulaire(fiche, magasin)` (`src/domain/vocabulaire.js`, pur) : pour `recipes`, `availability` **présent et** ∉ `AVAILABILITY` ou
`verification_state` **présent et** ∉ `VERIFICATION` → lève, nommée ; champ absent **ou `null`** toléré (`null` vaut absent : fiche
ancienne, chemin adaptation — ronde 1 de la tâche 1). Pour `imports`, `status` ∉ liste → lève. Appelée par `fabriquerExtraction`,
`fabriquerRecetteIA`, `fabriquerSignet`, le `save()` de l'éditeur et « Créer les références » du panneau d'index (`src/ui/import.js`,
cinquième fabricant, ronde 1) ; un test de source épingle les appelants, hors commentaire.

### 3.4 Sortie de l'extraction (contrat avec le modèle, côté app)

Schéma demandé (`PARSER_SYSTEM` amendé) : comme aujourd'hui plus `"incomplete": boolean, "missing_page": boolean`, et la consigne : « Si
une page semble manquer (étapes qui commencent au milieu, ingrédients sans étapes, renvoi à une page absente), `missing_page: true` ; si la
recette est visiblement partielle, `incomplete: true` ; une étape peut tenir sur plusieurs lignes : garde-la entière dans un seul `text`. »
`validateParsedRecipe` (durci, exporté, testé) : titre ≤ 200 points de code, ligne ≤ 300, étape ≤ 2 000, notes ≤ 2 000, ≤ 80 lignes, ≤ 60
étapes, `sub_recipes` ≤ 20 × (titre ≤ 200, renvoi ≤ 40), `uncertain_fields` ≤ 40 × 200, entiers finis ≥ 0 pour portions, durées, page,
booléens coercés ; **tout dépassement refuse** (`hors_bornes`). `language` n'est plus demandé (jamais utilisé). `uncertain_fields` est gardé
dans `resultat` et affiché dans le bandeau de la fiche (« Incertain : … », borné à 300 points de code).
`PasserelleProvider.complete(messages, { maxTokens, signal })` : `signal` relayé à `appelerAssistant` (qui l'accepte déjà) ; après l'appel
`this.modele` (existant) **et `this.stopReason`** sont posés ; `extraireRecette(provider, images, { signal, maxTokens })` → `{ recette, stopReason, modele }` et `extraireIndex(provider, images, { signal })` →
`{ index: { entries, uncertain }, stopReason, modele }` ; `extractRecipeFromImages(provider, images)` et `extractIndexFromImages(provider, images)`
(ordre **existant** des arguments) restent des enveloppes compatibles (m5) jusqu'à ce que leurs appelants passent au journal (tâches 4 et 6).
`REPONSE_BRUTE_MAX = 16000` (points de code) borne la réponse brute gardée dans le journal. `stopReason === 'max_tokens'` → `echec(coupe)` ; aucun JSON → `echec(illisible)` ;
zéro ligne **et** zéro étape → `echec(vide)` : rien n'est écrit sur la recette (I13).

### 3.5 Serveur : migration `0005_imports.sql`

Générée par `tools/generer-migrations.mjs` : `SYNC_STORES_0003` (26 noms) **figée** dans `src/sync/tables.js`, `0003` rendue depuis elle,
son empreinte SHA-256 épinglée ; `0005` rendue, à ajout seul, pour les magasins absents de `SYNC_STORES_0003` (ici `imports`), avec les
quatre fonctions recréées sur les 27 magasins. Preuve `supabase/proofs/0005_imports.sql` (table, RLS, `revoke anon`, colonnes générées
`edition_id` / `recipe_id` / `status`, `sync_push` accepte une ligne `imports`, `rollback;` dernier). `supabase/README.md` étape 11.
**`0005` collée avant le `push`** (sinon quarantaine `refus`, bruyante, non destructive).

### 3.6 Deux primitives neuves (N1, N2)

- **`db.mutate` gagne `conditions`** : `db.mutate({ puts, deletes, clearStores, origin, payloads, conditions })` où
  `conditions = { [store]: [{ key, attendus: [...statuts], patch }] }` ; `patch` est un objet ou une fonction `(courant) => objet`. **Deux formes de
  plus (T3 ronde 1)** : `{ key, absente: true }` (la fiche n'existe pas : une création n'écrase jamais une ligne, quel que soit son statut, I-10) et
  `{ index, valeur, exclus: [...statuts] }` (aucune fiche de l'index à cette valeur n'a un statut exclu : un seul import ouvert par `recipe_id`, I-2 ;
  refus nommé `TransitionRefusee { store, key: 'index=valeur', statut }`). Dans la **même
  transaction readwrite** que les `puts`/`deletes` : chaque fiche conditionnée est lue (`get` dans la transaction, ou `index.getAll(valeur)`), `status ∈ attendus` est
  vérifié, la fiche fusionnée `{ ...courant, ...patch(courant) }` est ajoutée aux `puts`, puis `onMutate` est appelé **de façon synchrone** dans le
  rappel de la dernière lecture (capture d'outbox, portée `outbox` ouverte seulement si la base la possède : les bases de test `TEST_STORES`
  n'en ont pas), puis tout est écrit ; une condition fausse → `transaction.abort()` et `TransitionRefusee { store, key, statut }` : **rien**
  n'est écrit. `MUTATING_METHODS` est inchangé (c'est toujours `mutate`), le pin de `tests/sync.js:47` ne bouge pas.
- **`repo.transitionner(store, key, { attendus, patch, puts = {}, deletes = {}, origin = 'local' })`** : enveloppe de `repo` qui nettoie les
  chaînes (`nettoyerChaines`, R61 : un `resultat` ou une `reponse_brute` du modèle porte des caractères de contrôle), pose `updated_at =
  syncNow()` sur chaque fiche écrite, appelle `db.mutate` avec la condition, puis `emit('change')`. **Tous** les écrans passent par elle (jamais
  `db.mutate` direct) ; `repo.saveBatch(batch, { conditions })` l'étend au cas sans patch.
- **`repo.ajouterPages(files, { edition_id, session_id, import_id, import })`** : comme `startScanSession` **sans navigation ni toast**, octets par
  `putFile` avant, puis **un** `repo.transitionner('imports', import_id, { attendus: ['a_lancer', 'a_verifier', 'echec'], patch: (c) => ({
  page_ids: [...c.page_ids, ...nouveaux] }), puts: { source_documents, source_pages, scan_sessions } })` (sans `import_id` : `saveBatch`
  simple, chemin existant). `startScanSession` l'appelle. **T3 ronde 1** : la ligne du journal est lue **avant** le premier `putFile` (un import
  terminé, en vol, inconnu, déjà créé ou doublé refuse sans laisser d'octets orphelins ; la condition en transaction reste le mur) ; `import_id`
  sans `session_id` reprend le `scan_session_id` de la ligne, une séance qui n'est pas la sienne refuse (`TypeError`) ; `import: {…}` (première
  photo) écrit par un `saveBatch` **conditionné** (`absente` + `index recipe_id / exclus = statuts ouverts`) ; `import_id` et `import` ensemble, ou un
  `kind` hors `recette | index` → `TypeError`.

### 3.7 Archives (C1)

`MAGASINS_AJOUTES_APRES_V1 = ['imports']` dans `schema.js` : à l'inspection et à la restauration d'une archive de format 1, un magasin de
cette liste **absent** de l'archive vaut `[]` ; décomptes et empreintes ne l'exigent pas. Un client **plus ancien** qui lit une archive
plus récente la refuse déjà (« Description de magasin absente ou inconnue », « Décompte de magasin inconnu : imports ») : le README le dit
(« mets l'app à jour »). Test sur une archive **figée** sans
`imports` (fixture).

## 4. Parcours

### 4.1 Entrées

- Fiche du livre (`src/ui/book.js`) : la carte d'une recette `reference_only` sans `source_url` (ou `partial`) garde son lien vers la
  **fiche** ; **sous** la carte (hors du `<a>` : `recipeCard` met `extra` à l'intérieur, m4), une rangée porte **« Importer »** (`.btn.small`) →
  `#/recipes/<id>/importer` et « Saisir à la main » ; « Scanner cette recette » disparaît.
- Fiche d'une référence (`src/ui/recipe.js`) : « Scanner cette recette » devient **« Importer cette recette »** (primaire) → même route ;
  une fiche `partial` offre « Relire les pages » (secondaire) → même route.
- Route `route('/recipes/:id/importer', renderImportCible)` dans `src/app.js` (regex ancrée : l'ordre n'importe pas) ; ajoutée à
  `ROUTES_DE_SAISIE` (`src/ui/state.js`) : une passe de synchro ne reconstruit pas l'écran en plein vol (I16). Modules neufs
  `src/ui/import-cible.js` (écran) et `src/domain/import-cible.js` (pur), tous deux dans `SHELL`. `getData` charge `imports`.
- Une fiche `available`, ou un signet : toast « Cette recette a déjà son texte. » / « Un lien web s'importe au lot suivant. », retour fiche.
- À l'ouverture, l'écran **reprend l'import non terminé** de cette recette s'il existe (`a_lancer`, `a_verifier`, `echec`, `en_cours`),
  sinon en crée un `a_lancer` à la première photo (pas avant : une visite sans photo n'écrit rien). **Seule la séance créée par l'écran ciblé**
  (import `kind: 'recette'` **avec** `recipe_id`, non terminé) est exclue des rappels génériques (« Séances à reprendre », « Séance en
  cours » de la fiche livre, « Photos conservées ») ; elle y réapparaît si l'import passe à `ignore`. Les séances où « Regrouper en recette »
  ou le panneau d'index ont écrit un import restent visibles (N3).

### 4.2 L'écran `#/recipes/<id>/importer`

1. **En-tête** : sur-titre « Importer une recette », titre de la référence, « {livre} · p. {n} », badge d'état.
2. **Pages de la recette** : vignettes dans l'ordre de `page_ids`, chacune avec son rang, son champ « p. imprimée », « Monter la page {n} »,
   « Descendre la page {n} » (toujours présents, ≥ 44 px, le focus suit la page déplacée), « Retirer la page {n} » ; le glisser au toucher
   est un plus. Sous les vignettes : « Photographier » (`capture: 'environment'`) et « Choisir des photos » (**sans** `capture`). Chaque
   ajout passe par `repo.ajouterPages` : **persistant avant tout appel**. Réordonner réécrit `page_ids` (transition sur place, même statut).
   Retirer détache la page de l'import (la ligne `source_pages` et l'octet restent, règle actuelle).
3. **Photo du plat — facultatif** : « Prendre une photo », « Choisir une image », aperçu (`urlDeBlob`, type sûr), « Remplacer », « Retirer » ;
   passe par le **même mur qu'une couverture** (`preparerPhotoLocale` extraite de `poserCouverture` dans `src/core/image.js` : 25 Mo, 16 Mpx,
   JPEG 1 200 px) ; octets dans `files`, `imports.photo_sha256`.
4. **« Extraire et enregistrer »** (primaire, jamais seul : « Retour à la fiche » à côté ; éteint sans page, sans session, hors ligne —
   écoute `online`/`offline` — ou pendant un vol ; sous le bouton : « Les pages et la photo seront liées à cette recette. »). Pendant le vol :
   `.status[role="status"]` « Lecture des pages par l'assistant… » suivie d'une `.row` avec « Annuler » (structure R-VIS-8).
5. Sans session : la carte « Connecte-toi pour utiliser l'assistant. » ; les photos s'ajoutent quand même.
6. Mode `a_verifier` (résultat déjà là) : l'écran montre « Lecture reçue le {d} » et le bouton devient **« Enregistrer cette lecture »**
   (sans appel) ; « Changer les pages » → `a_lancer`.

### 4.3 Extraction et enregistrement

1. Garde : session, en ligne, au moins une page ; `imports` `a_lancer | echec → en_cours` (`started_at`, `document_id_vol`, `battement_at`) ;
   `appels + 1` **au moment où le `fetch` part** (pas avant). Appel unique : `PasserelleProvider.complete`, pages dans l'ordre de `page_ids`,
   réduites par `pagePourEnvoi`, `maxTokens: 6000`, `signal`. Battement toutes les 15 s (`battement_at`, même statut, origine `device` : hors file).
2. Réponse → `validateParsedRecipe` → **`repo.transitionner('imports', id, { attendus: ['en_cours'], patch: { status: 'a_verifier', resultat, reponse_brute (coupée à 16 000 points de code), model, duree_ms } })`** (I-3).
   Échec → `en_cours → echec` avec `erreur`. Écriture locale impossible après une réponse (exception) → tentative `echec(incertain)` ; si
   elle échoue aussi, la ligne reste `en_cours` et deviendra `interrompu` au démarrage (même phrase, I-4).
3. **Discordance** (`discordance(resultat, reference)`, pure) : mots du titre de la référence (`normalizeText`, puis découpage sur espaces et **toute ponctuation** `\p{P}` — apostrophes, traits d'union et tirets Unicode, points, virgules, parenthèses, guillemets ; T3 ronde 1, superset des quatre classes de la rév. 3), mots vides retirés
   (liste fermée fr/en : le, la, les, l, de, du, des, d, au, aux, à, et, en, un, une, ma, mon, mes, ta, ton, tes, sa, son, ses, notre, nos, votre,
   vos, leur, leurs, the, of, and, with, a, an, my, your, our) ; **chaque** mot restant doit
   apparaître dans les mots du titre lu ; page lue vs `printed_page` à ± 3 quand les deux sont connues ; titre lu nul → discordance ; une référence **sans
   mot distinctif** (titre vide, fait de mots vides, absente) → discordance `titre` aussi (T3 ronde 1 : jamais une concordance par vérité vide).
   Dialogue : « Le texte lu s'intitule “X” ; la référence est “Y” (p. N). Rattacher quand même ? » / « Rattacher » / « Garder la lecture sans
   l'enregistrer » (reste `a_verifier`) / « Changer les pages » (`a_lancer`). Table de paires voisines dans les tests (pommes/poires,
   oignon/ail, « Tarte aux pommes » / « Tarte aux pommes de ma grand-mère » = concordant).
4. **Fabrication** (`fabriquerExtraction(resultat, { reference, versions, pages, pageIds, edition, convention, importId, modele, photo, maintenant })`,
   pure, qui appelle elle-même `assertVocabulaire`) : lignes par `parseIngredientLine` + `uncertain` + `verification_state: 'to_verify'` ; **étapes
   construites directement** (`{ id, position: i + 1, text, ...detectTimers(text) }`, sauts de ligne gardés : pas de `parseStepsBlock`) ; `notes` du
   modèle → `version.notes` ; version `kind: 'extraction'`, `parent_version_id`
   = la courante s'il y en a une, `provenance { source_page_ids, source_document_id, generated_by: 'ai', model, edition_id,
   convention_snapshot, import_id, incomplete, missing_page, titre_lu }`, `verification_state: 'to_verify'` ; fiche : `original_title`
   conservé, `printed_page` posé si vide, `source_page_ids` = union, `photo_sha256` / `photo_origin`, `availability` = `available` si lignes
   et étapes, `partial` sinon, et `partial` au plus si `incomplete` ou `missing_page` ; `verification_state` = celui de la version ;
   `current_version_id` → la nouvelle (sauf I-5 : option `remplacer: false` du fabricant — la fiche rendue ne reçoit alors que l'union des pages et la
   photo du plat, tout le reste intact, la version fabriquée quand même ; T3 ronde 1, la recomposition n'est jamais refaite à l'écran). La référence est
   **relue** juste avant la transaction (leçon C4) ; `assertVocabulaire`.
5. **Une transaction** : `repo.transitionner('imports', id, { attendus: ['a_verifier'], patch: { status: 'enregistre', reponse_brute: null,
   finished_at }, puts: { recipes, recipe_versions, source_pages (kind 'recipe', position, printed_page), scan_sessions (recipe_ids, status
   'done') } })` ; une condition fausse (import déjà enregistré par un autre onglet) n'écrit rien et l'écran se redessine. Puis fiche, toast
   « Recette importée ».
6. **Fiche** : bandeau « Lue par l'assistant le {d} · {n} ligne(s) incertaine(s) » (+ « page possiblement manquante », « lecture
   incomplète », « Incertain : … ») ; état de vérification **de la version affichée** (« Vérifiée » / « {n} lignes à vérifier ») ; photo du
   plat quand ses octets sont là ; « Corriger » ; puce « incertain » sur les lignes concernées. **Mode cuisine et courses** : bandeau « Lue par
   l'assistant, non relue » tant que la version courante est une `extraction` à `to_verify` (D-3).
7. **« Corriger » hérite** (I4, N5) : quand la version de départ a **au moins une étape qui contient un saut de ligne**, l'éditeur passe en
   mode « une étape par paragraphe » : étapes jointes par une ligne vide, aide « Une étape par paragraphe (ligne vide entre deux étapes). »,
   aperçu et `save()` par `parseStepsBlock(texte, { parParagraphe: true })` (option neuve) ; sinon rien ne change (une étape par ligne ou par
   paragraphe, aide actuelle). `reparse()` recopie `uncertain` d'une ligne dont le `source_text` n'a pas changé ; la version `correction` hérite
   `incomplete`, `missing_page`, `import_id`, `titre_lu` de sa parente ; le bandeau de la fiche lit la **version affichée** ; le texte d'une
   étape est rendu en `white-space: pre-line` sur la fiche et en mode cuisine (m10).

### 4.4 Cas et textes

| Cas | Journal | Écran |
|---|---|---|
| Hors ligne | rien | « Tu es hors ligne. » (bouton éteint, écoute `online`/`offline`) |
| Session absente | rien | carte « Connecte-toi pour utiliser l'assistant. » |
| `non_admis`, `quota`, `trop_de_demandes`, `trop_lourd` (413 : `requete` + extra), `requete`, `serveur`, `delai`, `reseau`, `interne`, `reponse_illisible` | `echec(raison)` | textes existants (`texteRefusAssistant` / `texteEchecAssistant`) + « Relancer » (éteint hors ligne ou sans session) |
| « Annuler » (document qui tient le vol) | `echec(annule)` | « Lecture annulée. L'appel a peut-être été compté ; relancer en coûtera un autre. » |
| Réponse coupée | `echec(coupe)` | « La lecture a été coupée : essaie avec moins de pages. » |
| JSON illisible / hors bornes / vide | `echec(illisible \| hors_bornes \| vide)` | « L'assistant n'a pas répondu lisiblement. Réessaie. » (« Code : … ») ; `vide` : « Aucun ingrédient ni étape lus sur ces pages. » |
| App fermée pendant le vol | `echec(interrompu)` au démarrage (battement > 90 s) | « La lecture a été interrompue. L'appel a peut-être été compté ; relancer en coûtera un autre. » |
| Réponse reçue, écriture impossible | `echec(incertain)` | même phrase |
| Discordance | reste `a_verifier` si refus | dialogue § 4.3.3 |
| `partial` avec version `correction` | `a_verifier` → dialogue | « Remplacer par cette lecture ? » (défaut non : la version est ajoutée, la fiche ne change pas) |
| `available` / signet | — | toasts § 4.1 |
| En cours sur un autre document | — | « En cours sur un autre écran », sans « Annuler » |

### 4.5 Reprise : la section « Imports »

Page Ajouter, **avant** la grille, seulement si non vide : une ligne par import `a_lancer`, `en_cours`, `a_verifier`, `echec`, et une par
séance `open` **sans import** (« Photos conservées : {n} page(s) · {livre} » → « Ouvrir la séance »). Ligne : titre de la référence
(ou « Index · {livre} », ou « Recette à regrouper · {livre} »), âge (« il y a {n} min / h / j »), état, gestes (`.btn`, ≥ 44 px) :
`a_lancer` → « Reprendre » (écran, photos en place) · `en_cours` → « Annuler » si ce document tient le vol, sinon « En cours sur un autre
écran » · `a_verifier` → « Reprendre » (écran en mode « Enregistrer cette lecture », **résultat revalidé**, sans appel) · `echec` →
« Relancer » et « Ignorer » · tous → « Ignorer » sauf `en_cours`. **Cibles de « Reprendre » par sorte** : `kind: 'recette'` avec
`recipe_id` → `#/recipes/<id>/importer` ; `kind: 'recette'` sans `recipe_id` (« Regrouper en recette ») → `#/recipes/new?import=<imp>`,
éditeur prérempli depuis `resultat` ; `kind: 'index'` → `#/import?session=…&import=<imp>`, panneau d'index prérempli. Fiche du livre :
« {n} import(s) à reprendre » → `#/add?section=imports` (la section est rendue en premier et reçoit le focus ; `parseHash` ne porte pas d'ancre, m3). Autre appareil : « Photos sur un autre appareil » ; « Reprendre »
seulement si `resultat` ; « Relancer » absent ; `recipe_id` pas encore reçu → « (référence pas encore reçue) », sans geste.

### 4.6 Ce qui change ailleurs

`pending_recipe` disparaît (poseurs et lecteur) ; « Oui, rattacher » disparaît ; le chemin `#/add?edition=` (R-UX-16) perd son dernier
appelant et est retiré. L'éditeur garde « Extraire avec l'assistant IA » pour une recette sans référence : il écrit dans le journal
(`kind: 'recette'`, `recipe_id: null`) et relit par `?import=` ; le panneau d'index écrit de même (`kind: 'index'`, `resultat = { entries,
uncertain }`), son bouton est verrouillé pendant l'appel.

## 5. Textes (FR → EN, toutes par `t()` ; les clés exactes font foi dans `en.js`)

« Importer une recette » · « Importer cette recette » · « Importer » · « Relire les pages » · « Pages de la recette » · « {n} photo(s)
ajoutée(s) » · « Monter la page {n} » · « Descendre la page {n} » · « Retirer la page {n} » · « Choisir des photos » · « Photo du plat » ·
« Facultatif » · « Ajoute la photo du livre, s'il y en a une. » · « Prendre une photo » · « Remplacer » · « Extraire et enregistrer » ·
« Enregistrer cette lecture » · « Changer les pages » · « Retour à la fiche » · « Les pages et la photo seront liées à cette recette. » ·
« Lecture des pages par l'assistant… » (entrée `en.js` à ajouter) · « Lecture reçue le {d} » · « Recette importée » · « Lue par l'assistant
le {d} » · « {n} ligne(s) incertaine(s) » · « page possiblement manquante » · « lecture incomplète » · « Incertain : {t} » · « incertain » ·
« Vérifiée » · « {n} lignes à vérifier » · « Lue par l'assistant, non relue » · « Imports » · « Reprendre » · « Relancer » · « Ignorer » ·
« Ouvrir la séance » · « Photos conservées : {n} page(s) » · « Index · {l} » · « Recette à regrouper · {l} » · « il y a {n} min » / « h » /
« j » · « En cours sur un autre écran » · « Photos sur un autre appareil » · « (référence pas encore reçue) » · « {n} import(s) à
reprendre » · « Cette recette a déjà son texte. » · « Un lien web s'importe au lot suivant. » · les textes de § 4.3.3 et § 4.4.

## 6. Serveur

Aucun changement de la fonction `assistant`. Migration `0005`, preuve, README (§ 3.5).

## 7. Tests (suite navigateur, fixtures, `fetch` factice ; Node pour le générateur)

- **Schéma** : montée `DB_VERSION 3 → 4` sur une base peuplée ; `imports` dernier de `STORES`, dans `SYNC_STORES`, `ARCHIVE_DATA_STORES`,
  relations déclarées (et **pas** `recipe_id` ni `page_ids`) ; archive aller-retour avec une ligne `imports` ; **archive figée sans `imports`
  restaurée** (C1) ; `assertVocabulaire` (refus nommé, absent toléré) et test de source de ses appelants (faible, admis : un mutant « appel commenté » est rejoué à la vague finale, m9).
- **Primitives** : `db.mutate({ conditions })` (une transaction : condition fausse → aucune écriture, même des `puts` ; outbox capturée sur succès ;
  course simulée par deux appels entrelacés ; `TransitionRefusee` nommée, pas le rejet générique d'une transaction annulée) et `repo.transitionner`
  (nettoyage, `updated_at`, `change`) ; un test statique : `transitionner(` n'existe que dans `repo.js` et, ailleurs, sous la forme `repo.transitionner(` ; `repo.ajouterPages` (une transaction pour les lignes, ordre de `page_ids`, pas de navigation).
- **Domaine pur** : `modeleEcran` (ordre, bornes de Monter/Descendre, retrait, focus cible) ; `discordance` (table : pommes/poires,
  oignon/ail, variantes concordantes, titre nul, page ± 3, accents et casse) ; `fabriquerExtraction` (version, provenance, `uncertain`,
  étapes entières, `partial` sur `incomplete`, titre conservé, I-5 avec et sans `correction`, page absente ignorée) ; transitions (table
  complète, interdites refusées) ; `validateParsedRecipe` (chaque borne → `hors_bornes`, `vide`, booléens) ; `parseStepsBlock` par
  paragraphe ; héritage de `reparse()`.
- **Écran** : route pour une `reference_only` et une `partial` ; `available` et signet → toast ; photos → séance et `page_ids` écrits
  **avant** tout appel ; réordonner → `page_ids` ; « Extraire et enregistrer » → **un** POST, pages dans l'ordre, `appels` incrémenté au
  départ du `fetch` ; `a_verifier` écrit **avant** la recette (ordre des écritures espionné) ; enregistrement en **une** transaction ; fiche :
  bandeau, puces, photo ; « Annuler » → abandon + `echec(annule)` + aucune recette ; chaque raison de § 4.4 → texte et geste ; discordance →
  dialogue et ses trois sorties ; double clic → un appel ; hors ligne (état basculé **après** le rendu) → aucun appel ; session absente →
  carte, photos ajoutables ; second import sur la même recette → le premier est repris ; séance de l'import absente des rappels génériques ;
  R-VIS-8 (structure) ; `ROUTES_DE_SAISIE`.
- **Reprise** : section absente quand vide ; une ligne par état et par sorte avec sa cible ; « Reprendre » sur `a_verifier` → écran, résultat
  **revalidé** (un `resultat` hostile injecté → `echec(illisible)`), enregistrement sans appel ; « Relancer » → un appel, **aucune** page ni
  séance en double ; « Ignorer » ; démarrage : `en_cours` battement > 90 s → `interrompu`, battement récent → intact ; ligne d'un autre
  appareil : ni Reprendre sans résultat, ni Relancer ; `incertain` ; purge à 30 jours = suppression capturée (outbox `delete`).
- **Mode cuisine et courses** : bandeau D-3 présent pour une extraction non relue, absent après « Vérifié » ou sur une `correction`.
- **Régression** : `pending_recipe` et `?edition` absents du source ; « Saisir à la main » intact ; « Regrouper en recette » et le panneau
  d'index écrivent dans le journal et relisent par `?import=` ; `tests/passerelle.js` adaptés (`maxTokens` 6000, `signal`, `stopReason`).
- **Générateur** : `SYNC_STORES_0003` figée, empreinte de `0003`, `0005` pour `imports` seul, `--check` 0, preuve `0005` (pglast, `rollback`
  dernier), README étape 11 (test node).
- **Versions** : `APP_VERSION 0.9.0`, `sw.js` et `SHELL` (+ 2 modules + `vocabulaire.js`), total épinglé. **Mutants** sur copies : ordre
  journal → recette inversé ; discordance ignorée ; `pending_recipe` réintroduit ; `signal` non relayé ; revalidation de « Reprendre »
  retirée ; archive sans `imports` refusée ; `reparse()` perd `uncertain` ; `interrompu` posé malgré un battement récent ; relance qui
  duplique les pages ; purge non capturée.

## 8. Hors périmètre (nommé pour ne pas y glisser)

Classement automatique d'un lot de photos (D) ; table des matières structurée et ordre proposé par le modèle (C) ; lecture d'une page web
(B) ; lecture de la couverture (E) ; récupération ou recadrage automatique de la photo du plat (F) ; octets entre appareils (G) ; relecture
d'une recette `available` ; thème ou couleur d'accent ; quota visible dans l'app ; autre modèle que celui du serveur.

## 9. Suite B à G (ordre revu)

**A → (B ∥ G) → C → D → E → F.** G ne dépend de rien et conditionne la preuve « deux appareils » ; B et G se construisent en parallèle par
deux sous-agents mais **fusionnent l'un après l'autre** (fichiers communs : `sw.js`, `APP_VERSION`, `en.js`, `schema.js`, total épinglé).
C et D consomment le journal ; D consomme l'appariement et `index_page_id` (C) ; F consomme B (image web) et `photo_sha256` (A) ; E est
petit et s'intercale.

## 10. Preuve réelle préalable (geste de Neegan, avant la construction)

Sur le site public, connecté : Ajouter → « Photographier ou importer des pages » → une vraie page de recette → « Regrouper en recette »
→ **« Extraire avec l'assistant IA »**. À noter : le **modèle** de Réglages → Assistant (« Modèle en service : … », valeur réelle du secret
`ASSISTANT_MODELE`, défaut `claude-sonnet-5-5`), la **durée**, le texte obtenu contre la page, et ce qu'il reste après fermeture et
réouverture (attendu : rien, c'est ce que le lot corrige). Une page **dense** (longue liste, étapes longues) dit si 6 000 jetons tiennent
sous les 120 s du serveur. Aucun agent ne dépense d'appel à la place de Neegan. Si le résultat révèle une limite, la spec s'amende
**avant** le plan.

## 11. Risques et limites assumés

- `createImageBitmap` sur une photo d'iPhone de plusieurs dizaines de Mpx n'est pas mesuré ; 8 Mio par appel ≈ 8 à 10 pages réduites.
- Deux appareils qui importent la **même** référence : le dernier qui enregistre gagne (`source_page_ids` et `photo_sha256` de l'autre
  perdus, puis conflit de pointeur sur la fiche) ; I-2 ne vaut que par appareil tant que `imports` ne porte pas de verrou serveur.
- « Le serveur journalise 499 » à « Annuler » n'est prouvé que sous Node (lot passerelle, F-5).
- Le glisser au toucher n'est pas mesuré sur Safari ; Monter/Descendre sont le chemin garanti.
- Charger `imports` dans `getData` à chaque rendu : `reponse_brute` est effacée à `enregistre` et bornée à 16 000 points de code ; à surveiller.
- Un `echec` reste jusqu'à un geste (pas de purge) ; `interrompu` par battement : un onglet figé plus de 90 s sans réponse est tenu pour mort.

## 12. Ce que la revue a amendé (rév. 1 → rév. 2)

- **C1** archives antérieures → § 3.7 `MAGASINS_AJOUTES_APRES_V1`, fixture figée.
- **C2** Jaccard 0,5 → D-6 et § 4.3.3 : contenance de tous les mots distinctifs, mots vides retirés, table de paires voisines.
- **I1** → I-4 et § 4.4 : même phrase pour `interrompu`, `annule`, `incertain`.
- **I2** → I-1 et § 4.5 : « Reprendre » revalide.
- **I3** → D-11 et I-5 : pas d'entrée pour `available` ; sur `partial` avec `correction`, « Remplacer ? » défaut non ; état affiché = version affichée.
- **I4** → § 4.3.7 : héritage de `uncertain`, `incomplete`, `missing_page`, étapes par paragraphe.
- **I5** → § 4.3.4 : étapes construites directement.
- **I6** → § 3.1 : transitions `a_verifier → ignore | a_lancer`, `a_lancer → ignore` ; `a_lancer` listé ; branche « `echec` avec résultat » retirée.
- **I7** → § 4.5 : cibles de « Reprendre » par sorte.
- **I8** → I-2 et § 4.1 : un import ouvert par recette, séance exclue des rappels.
- **I9** → § 3.1 : `page_ids` et `recipe_id` pointeurs souples.
- **I10** → D-12 : `assertVocabulaire` chez les fabricants, pas dans `db.mutate`.
- **I11** → I-7, I-10, § 3.6 : `db.transitionner`, battement, « Annuler » par le document du vol.
- **I12** → D-5, § 3.4 : `stopReason` posé par `complete`, 6 000 jetons, mesure en § 10.
- **I13** → § 3.4 : `vide` → rien d'écrit.
- **I14** → D-3 sourcée au dossier, soumise à Neegan, bandeau en mode cuisine et courses.
- **I15** → § 3.1 : purge par suppression `local` (tombale), `import_id` souple.
- **I16** → § 4.1-4.2 : `ROUTES_DE_SAISIE`, structure R-VIS-8.
- **I17** → D-2, D-4 : photo du plat et réordonnancement sont dans le cahier B3 de Neegan (gardés) ; relecture d'`available` sortie (D-11).
**Rév. 2 → rév. 3 (re-revue).** **N1** → I-10, § 3.6, § 4.3.5 : une seule primitive (`conditions` de `db.mutate`), `repo.transitionner` enveloppe,
enregistrement et `ajouterPages` conditionnés. **N2** → § 3.6 : `MUTATING_METHODS` inchangé, nettoyage et `syncNow` dans `repo`, portée `outbox`
conditionnelle. **N3** → § 4.1 : seule la séance de l'écran ciblé est exclue, réapparition sur `ignore`. **N4** → I-5 : garde sur toute version non
`ai`, chemin « non » pose pages et photo. **N5** → § 4.3.7 : paragraphe seulement si une étape porte un saut de ligne, aide et aperçu alignés.
m1 « À envoyer » monte ; m2 battement `device` ; m3 `?section=imports` ; m4 bouton hors carte ; m5 signatures ; m6 `reponse_illisible` ; m7 unités ;
m8 § 1 reformulé ; m9 mutant à la vague finale ; m10 `pre-line`.
**Rév. 3 → rév. 3.1 (pré-vol du plan, trois lentilles).** Position de `imports` précisée (dernier synchronisé, avant `settings`) ; `db.transitionner`
n'existe pas : `db.mutate({ conditions })` + `repo.transitionner` partout ; signatures `(provider, images, opts)` et retour `{ index: { entries,
uncertain } }` ; `REPONSE_BRUTE_MAX` ; possessifs dans les mots vides ; `...detectTimers(text)` ; signature complète de `fabriquerExtraction` (qui appelle
`assertVocabulaire`) ; messages réels d'un ancien client ; passe `interrompu` limitée à cet appareil.
- Mineurs (rév. 2) : bornes → refus `hors_bornes` ; `titre_lu` en § 3.2 ; `role` abandonné (`kind` seul) ; ordre = `page_ids` ; `repo.ajouterPages` ;
  « Choisir » sans `capture` ; `preparerPhotoLocale` ; `getData` ; textes complétés ; « Extraire avec l'assistant IA » ; vocabulaire mort retiré ;
  `appels` au départ du `fetch` ; accessibilité ; fiche du livre (bouton, pas de lien imbriqué) ; `#/add#imports` ; titre nul ; 16 000 points
  de code et 512 Kio ; relecture avant `saveBatch` ; `imports` dernier ; B ∥ G avec fusions séquentielles ; 499 non prouvé ; deux appareils ;
  R-UX-16 retiré ; `SHELL` ; hors ligne basculé après le rendu ; mutants ajoutés.
**Tâche 3, ronde 1 (revue adverse, trois lentilles — rapport `task-3-report.md` § Ronde 1).** **T3-R1-a** `fabriquerExtraction(…, { remplacer })`
porte le « non » de I-5 (§ 4.3.4) · **T3-R1-b** la création d'une ligne du journal est conditionnée (`absente` + index `recipe_id` ; § 3.6) et la ligne
est lue avant le premier `putFile` · **T3-R1-c** Cc/Cf retirés des textes du modèle (recette et index), `BORNES_NOMBRES` (999 / 1 440 / 9 999 → `null`) ·
**T3-R1-d** séparateurs = `\p{P}` et référence sans mot distinctif = discordance (§ 4.3.3) · **T3-R1-e** `printed_page` de la fiche sur la première page
sans numéro seulement (§ 3.2) · **T3-R1-f** `RAISONS_ECHEC` sans `trop_lourd` (413 = `requete` + extra), `non_connecte` ratifié · **T3-R1-g**
`extractIndexFromImages` rend `{ entries, uncertain }` (ce que le panneau d'index lit ; brief T6 amendé) · **T3-R1-h** `preparerPhotoLocale` : liste des
images (`COVER_INPUT_MIME` + HEIC), un PDF est refusé par `type` · **T3-R1-i** `parseStepsBlock` ne normalise que CRLF · **T3-R1-j** `issuesPourImage`
(repo) partagé avec `replacePage`, entrée `en.js` · refusé : rendre `{ texte, stopReason, modele }` par `complete` (le brief fixe `this.stopReason`) —
remise à zéro des deux champs avant l'appel et test « deux appels sur la même instance » à la place.
**Tâche 4, ronde 1 (revue adverse, trois lentilles — rapport `task-4-report.md` § Ronde 1).** **T4-R1-a** `a_verifier → echec(illisible)` ratifiée
(§ 3.1 ; table `TRANSITIONS` + test de domaine) : résultat relu invalide au montage ou au clic, résultat effacé, la seule écriture d'une visite ·
**T4-R1-b** « Rattacher » (D-6) vaut pour LA lecture à laquelle il a été répondu (clé = ligne, `started_at`, `resultat`) : une lecture arrivée d'un
autre onglet entre-temps redemande la discordance · **T4-R1-c** une fiche supprimée entre le rendu et « Enregistrer cette lecture » n'est jamais
ressuscitée par la copie du contexte : rien n'est écrit, « Recette introuvable. », retour à la bibliothèque · **T4-R1-d** `model` et `photo_sha256`
relus du journal sont bornés avant la fiche (≤ 80 points de code ; empreinte hexadécimale de 64) · **T4-R1-e** `t()` remplace en une passe (une valeur
insérée n'est jamais relue comme un gabarit) · **T4-R1-f** le toast « Recette importée » et la navigation n'ont lieu que si l'écran est encore monté
(une lecture arrivée après avoir quitté l'écran n'arrache pas la personne à sa saisie ; la recette est enregistrée quand même) · **T4-R1-g** la carte
« Connecte-toi » n'est rendue que là où le primaire appelle l'assistant (jamais en `a_verifier`) · **T4-R1-h** « p. imprimée » : `1..9999` seulement ;
une saisie illisible n'écrit rien et le champ reprend la valeur courante · **T4-R1-i** la fiche du livre offre « Importer » sous une `partial`
seulement sans `source_url` (même règle que « Relire les pages ») · **T4-R1-j** la réponse brute n'est bornée qu'en un lieu (`contexteDe`, llm.js) ;
l'écran l'écrit telle quelle · tests ajoutés : I-1 hostile au montage et au clic, octets absents et page indécodable, battement par les APPELS,
« autre onglet » entre la relecture et la transaction (ni toast ni navigation), vol tenu pour un autre import, écran quitté pendant le vol, pages
figées en `a_verifier` et en `en_cours`, `appels` écrit séparément et relu par le `fetch`, rejets non gérés, signet devenu `partial` ·
différé (à ratifier) : ligne `en_cours` dont `document_id_vol` est ce document sans vol tenu (après deux écritures impossibles) : « En cours sur un
autre écran » sans geste jusqu'à la passe `interrompu` de la tâche 6.
**Tâche 4, ronde 2 (résidu mesuré de T4-R1-b — rapport `task-4-report.md` § Ronde 2).** **T4-R2-a** la réponse à une question (« Rattacher »,
« Remplacer », « Garder ma version ») vaut pour la lecture pour laquelle la question a été **posée** (clé mémorisée à la pose), jamais pour la ligne
relue au clic : « Rattacher » cliqué après l'arrivée d'une autre lecture redemande la discordance avec le nouveau titre (D-6) ; « Remplacer » cliqué
après l'arrivée d'une autre lecture repose la question (I-5 : rien ne devient courant sans avoir été vu) ; un redessin entre l'arrivée et le clic
oublie la question de l'ancienne lecture (plus de panneau ni d'ancien titre ; « Enregistrer cette lecture » la redemande) · toujours différé (à
ratifier, même raison) : la ligne `en_cours` tenue par ce document sans vol.
