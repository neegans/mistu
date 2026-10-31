# Correctifs de l'audit L0–L10 — plan d'exécution pour Codex

> **Pour l'agent exécutant (Codex) :** exécuter les tâches une à une, dans l'ordre, avec le test rouge AVANT le code. Les cases `- [ ]` servent au suivi. Lire d'abord `docs/audits/2026-10-30-audit-codex-L0-L10/rapport-audit.md` (§ 0, § 2, § 3), puis la lentille citée par chaque tâche.

**But :** fermer les trois défauts bloquants et les défauts importants relevés par l'audit du 30 octobre 2026 sur `cd8c7f2..247b2e5`, sans rouvrir ce qui tient, et laisser derrière chaque correctif un test qui rougit si on le retire.

**Architecture :** aucun module neuf de grande taille ; des corrections ciblées dans `src/sync/`, `src/model/repo.js`, `src/domain/lines.js`, `src/ui/cook.js`, `src/demarrage.js`, `tools/service-worker.template.js`, une migration `0014` écrite mais NON appliquée, et des tests qui exercent les coutures entre lots (conflits × sources, purge × index, minuteries × analyse des lignes, démarrage × cycle de vie du worker).

**Pile :** PWA sans build (modules ES), IndexedDB, Supabase (PostgreSQL + PostgREST), suite navigateur `tests/index.html`, `node --test` pour `tools/`, générateurs `tools/generer-migrations.mjs` et `tools/generer-livraison.mjs`.

**Spec (la source des constats) :** `docs/audits/2026-10-30-audit-codex-L0-L10/rapport-audit.md` ; lentilles dans `docs/audits/2026-10-30-audit-codex-L0-L10/lentilles/` ; preuves exécutées dans `…/preuves/`.

**Note de version :** les `fichier:ligne` de l'audit et de ce plan sont ceux du commit `247b2e5`. Trois commits ont suivi (`7696ed6` détection des mises à jour depuis les fenêtres ouvertes, `90f1deb` traduction française guidée, `3063376` docs) et touchent `src/core/livraison.js`, `src/ui/mise-a-jour.js`, `src/app.js`, `src/ui/recipe.js`, `src/ui/settings.js`, `src/domain/*traduction*`, `tests/tests.js` : relocaliser par le NOM de la fonction ou l'extrait cité, pas par le numéro de ligne, et revérifier d'abord si `7696ed6` ferme déjà une partie de la tâche 6 (course `updatefound`) avant de la refaire. Ce lot n'a pas été audité.

## Contraintes globales (reprises d'`AGENTS.md`, qui fait foi)
- Rien d'inventé ; une réponse du modèle est une donnée hostile ; l'original d'une recette n'est jamais réécrit ; un état d'écran reflète un événement réel.
- Un test observe un comportement, jamais une chaîne du source. Chaque garde corrigée a un test qui rougit si on retire la garde, avec un MOTIF EXACT (modèle : `tests/correctifs-thermomix-securite.js:14`, aide `motif`), jamais un `refuse` qui accepte n'importe quelle exception.
- Textes d'écran par `t('texte français')` + entrée dans `src/i18n/en.js` ; un module `src/ui` neuf s'ajoute à `MODULES_NEUFS` de `tests/ajouter.js` ; un fichier de test neuf s'importe dans `tests/tests.js` et le total épinglé (`eq(results.length, N, …)`) est remis à la valeur mesurée, baisse expliquée.
- Livraison : si un fichier de la coquille change, monter le suffixe de livraison dans `index.html`, puis `node tools/generer-livraison.mjs` après gel du code ; `--check` à 0 avant tout commit de publication. `APP_VERSION` monte par lot ; `DB_VERSION` ne monte que pour une structure IndexedDB (aucune ici).
- **Jamais de `git push`, jamais de migration SQL appliquée, jamais de redéploiement de la fonction `assistant` : gestes de Neegan sur son « go » explicite, lot par lot.** Commits en ASCII, fichiers nommés un par un, jamais de réécriture d'historique.
- Suite de référence : `python3 -m http.server 8080` puis `http://localhost:8080/tests/` → « ✅ N/N tests réussis », seule erreur console admise : le 404 de `/favicon.ico` et les lignes `[cuisine-os] …` émises par `logError` dans des scénarios d'échec simulé. Outils : `node --test --test-concurrency=1 tools/*.test.mjs`, `node tools/generer-migrations.mjs --check`, `node tools/generer-livraison.mjs --check` (0).
- Découpage en lots publiables : **A** = tâches 1 à 5 (bloquants + sûreté en cuisine) → publication ; **B** = 6 et 7 (démarrage, worker) → publication ; **C** = 8 (SQL 0014, écrite seulement) → geste de Neegan ; **D** = 9 ; **E** = 10 ; **F** = 11 ; **G** = 12. Une branche par lot (`correctifs-audit-a`, `-b`, …), fusion en avance rapide sur « go ».

## Points de vigilance (ce que les tests des tâches n'exercent pas et qui peut mordre)
1. Un appareil encore sur un cache `cuisine-os-v0.3x` qui reçoit le lot B : la purge des anciens caches (tâche 7) ne doit jamais effacer le cache COURANT ni le cache `meta` → test ajouté en tâche 7.
2. La purge des imports (tâche 2) sur un appareil où des fragments ont DÉJÀ été effacés localement (si le lot A arrive après le 28 novembre) : l'exclusion n'y change rien ; la tâche 2 ajoute la relance de réception des `imports` gérés.
3. Un conflit de recette dont la version locale est NULLE (fiche supprimée ici pendant l'aller-retour) : le chemin `!conflit.local` de `garderIci` doit lui aussi passer par les conditions fusionnées → cas ajouté en tâche 1.
4. « 1 h 30 secondes » et « 1 h 30 g de beurre » doivent rester 3600 s après la tâche 4 → cas conservés dans la table de `tests/l0-cuisine.js`.
5. Sans `serviceWorker` (Firefox privé, `http://` sur une IP du réseau local), la tâche 6 ouvre l'app en ligne : vérifier que `repo.init()` et la porte d'entrée se comportent comme avant L10 → scénario ajouté en tâche 6.

---

### Tâche 1 : Conflits de recette tranchables (B1) et purge des vieux conflits

**Fichiers :**
- Modifier : `src/sync/conflits.js:22-36` (`protectionSources`, `protectionContenu`), `:183-190` (`purgerAnciens`)
- Modifier : `tests/correctifs-imports-sync.js:164-166`
- Créer : `tests/audit-conflits.js` ; importer dans `tests/tests.js` ; total épinglé

**Interfaces :**
- Produit : `fusionnerConditions(a, b)` (exportée de `src/sync/conflits.js`, pure) : rend `{ [store]: Condition[] }` ; pour deux conditions de même `store` et même `key` (ou deux `toutes:true`), rend UNE condition dont `fusion`/`verifier` appelle les deux dans l'ordre (a puis b) ; sinon concatène.

- [x] **Étape 1 : écrire les tests rouges** dans `tests/audit-conflits.js` (fixture `withDatabase` de `tests/backup.js`, aucune capture) :
  - `audit B1 : garderIci tranche un conflit recipes` : fiche `recipes` `{id:'r1', title:'Ici', edition_id:null, updated_at}` + `sync_state` `user_id:'u1'` + conflit `{id:'recipes:r1', store:'recipes', record_id:'r1', kind:'donnees', user_id:'u1', local:{…title:'Ici'}, server:{data:{…title:'Ailleurs'}, updated_at}, at}` → `eq(await garderIci(db, conflit), true)` ; `eq((await db.get('recipes','r1')).title, 'Ici')` ; `eq(await db.get('sync_conflicts','recipes:r1'), undefined)`.
  - `audit B1 : garderAilleurs tranche un conflit recipes` : même fixture → `true`, titre `'Ailleurs'`.
  - `audit B1 : conflit recipes sans version locale` : `local:null` → `garderIci` rend `true` et la fiche est une tombale (absente de `recipes`).
  - `audit B1 : conflit imports Thermomix` : ligne `imports` `kind:'thermomix'` au statut `a_verifier` + conflit `kind:'donnees'` → `garderAilleurs` rend `true`.
  - `audit B1 : fusionnerConditions compose deux gardes de même clé` : deux conditions `sync_state/user_id` dont la seconde lève → la condition fusionnée lève avec le message de la seconde ; deux `outbox` `toutes:true` → un seul élément, les deux `verifier` appelés (compteur).
  - `audit B1 : purgerAnciens avec deux conflits anciens` : deux conflits `books` `kind:'donnees'` datés 2020 → `eq(await purgerAnciens(db, Date.now()), 2)` et aucun conflit restant.
- [x] **Étape 2 : lancer la suite, constater les rouges** : les quatre premiers lèvent `TypeError: Deux conditions sur la même fiche sync_state/user_id` (voir `docs/audits/…/preuves/conflits-typeerror.json`).
- [x] **Étape 3 : implémenter `fusionnerConditions(a, b)`** dans `src/sync/conflits.js` et l'utiliser dans `protectionContenu` (à la place de la concaténation `[...(conditions[store]||[]), ...cs]`) et dans `purgerAnciens` (accumuler par `fusionnerConditions(conditions, garde)`). Pour `sync_conflicts`, les clés diffèrent (un conflit chacune) : concaténation naturelle.
- [x] **Étape 4 : remplacer le refus « n'importe quelle exception »** de `tests/correctifs-imports-sync.js:164-166` par `eq(refus?.message, 'Compte du conflit changé', …)`.
- [x] **Étape 5 : suite complète verte**, total épinglé remis à la valeur mesurée.
- [x] **Étape 6 : commit** `fix(sync): fusionner les conditions des conflits, trancher les conflits de recette (audit B1)`.

### Tâche 2 : La purge des imports à 30 jours épargne les lignes gérées (B2)

**Fichiers :**
- Créer : `src/domain/imports-geres.js` — `export function estImportGere(ligne)` : vrai si `ligne.index_storage`, `ligne.source_capture`, `ligne.index_call`, `ligne.translation_call`, `ligne.translation_capture` existe, ou `ligne.kind === 'traduction'` (marqueurs serveur : `supabase/migrations/0010_sources_index.sql:915-917`, `0011_ingredients_traductions.sql:421-424`).
- Modifier : `src/model/repo.js:180-194` (`purgerImportsAnciens`) ; `src/sync/pull.js` (relance ciblée, voir étape 4)
- Créer : `tests/audit-purge-imports.js` ; importer dans `tests/tests.js`

- [x] **Étape 1 : tests rouges** (fixture `withRepo` de la suite, horloge injectée 40 jours plus tard) :
  - `audit B2 : un fragment d'index enregistre n'est pas purgé` : manifeste `index_storage.role:'page_manifest'` + fragment `role:'result_fragment'` (forme de `src/domain/index-stockage.js:135-142`), `status:'enregistre'`, `updated_at` à −40 j ; un import ordinaire `kind:'recette'` `status:'ignore'` −40 j → après `purgerImportsAnciens(maintenant)` : les deux lignes gérées existent, l'ordinaire n'existe plus, `outbox` ne contient aucune entrée `op:'delete'` pour les gérées.
  - `audit B2 : un journal de traduction n'est pas purgé` : ligne `kind:'traduction'` `status:'enregistre'` −40 j → conservée.
  - `audit B2 : estImportGere` : table de 8 lignes (6 vraies, 2 fausses dont `kind:'recette'` et `kind:'index'` sans `index_storage`).
- [x] **Étape 2 : rouge constaté** (lignes gérées supprimées).
- [x] **Étape 3 : implémenter** `estImportGere` et filtrer `vieilles` dans `purgerImportsAnciens` : `if (estImportGere(ligne)) continue;`.
- [x] **Étape 4 : réparation des appareils déjà touchés** : à `repo.init()`, une passe unique (garde `sync_state` clé `reparation_imports_geres`, origine `device`) retire de la file les entrées `op:'delete'` en quarantaine `last_error:'forme'` dont le `payload` est un import géré, puis remet le curseur `cursor:imports` à `0` pour que la prochaine réception ramène les lignes du serveur (les fiches locales plus récentes gagnent par I7). Test : fixture avec une telle entrée + curseur à 50 → après `init()` : entrée retirée, curseur 0, garde posée ; second `init()` : rien ne bouge.
- [x] **Étape 5 : suite verte, commit** `fix(imports): epargner les lignes gerees a la purge de 30 jours et relancer leur reception (audit B2)`.

### Tâche 3 : Un conflit de cycle n'est jamais écrasé (B3)

**Fichiers :**
- Modifier : `src/sync/push.js:133-138` (écriture de `effets.conflits`), `src/sync/reponses.js:64-67`, `src/sync/outbox.js:60` (instantané)
- Modifier : `tests/l1-corbeille-sync.js` (ajout d'un scénario)

- [x] **Étape 1 : tests rouges** dans `tests/l1-corbeille-sync.js` (transport factice en mode `serveur`, fixtures existantes du fichier) :
  - `audit B3 : un refus cycle ne remplace pas le conflit existant` : conflit `recipes:r9` `kind:'cycle'` déjà présent avec `local.title:'Edite hors ligne'` ; le serveur rejette le `put` en `cycle` → après `appliquerReponse`, `(await db.get('sync_conflicts','recipes:r9')).local.title` vaut encore `'Edite hors ligne'`.
  - `audit B3 : le put de recipes emporte un instantane` : après `repo.save` d'une recette, l'entrée `outbox` `store:'recipes'` porte `snapshot` égal à la fiche écrite.
  - `audit B3 : sans conflit existant, le refus cycle journalise l'instantane` : pas de conflit préalable, `fichesLocales[k]` déjà remplacé par la copie serveur → le conflit créé a `local` = `snapshot` de l'entrée.
- [x] **Étape 2 : rouge constaté.**
- [x] **Étape 3 : implémenter** : (a) `outbox.js:60` ajoute `'recipes'` et `'book_editions'` à la liste des magasins dont le `put` emporte `snapshot` ; (b) `reponses.js:66` : `local: entree.snapshot ?? fichesLocales[k] ?? null` (l'entrée se retrouve par `seqs[0]`) ; (c) `push.js:136` : ne garder dans `puts.sync_conflicts` que les conflits dont `await db.get('sync_conflicts', c.id)` est absent OU dont le `kind` existant n'est pas `cycle` — relecture dans la transaction par une condition `sync_conflicts: [{ key: c.id, fusion: courant => courant?.kind === 'cycle' ? courant : nouveau }]` (même mécanique que `push.js:121`).
- [x] **Étape 4 : suite verte, commit** `fix(sync): conserver le conflit de cycle et l'instantane du put refuse (audit B3)`.

### Tâche 4 : Minuteries « 1 h 30 à 180 °C » (sûreté)

**Fichiers :**
- Modifier : `src/domain/lines.js:106-107` (`finAbregee`, `minutesApresHeure`)
- Modifier : `tests/l0-cuisine.js:56-58` (table des cas)

- [x] **Étape 1 : cas rouges ajoutés à la table** : `['Cuire 1 h 30 à 180 °C', [5400]]`, `['Laisser 2 h 15 au four', [8100]]`, `['Mijoter 1 h 15 dans le bouillon', [4500]]`, `['Cuire 1 h 30 - puis servir', [5400]]` ; cas CONSERVÉS tels quels : `['Attendre 1 h 30 secondes', [3600, 30]]`, `['Repos 1 h 30 g de beurre', [3600]]`, `['Repos 1 h 30.', [5400]]`.
- [x] **Étape 2 : rouge constaté** (`preuves/lines-1h30.txt` : 3600 et 7200).
- [x] **Étape 3 : implémenter** : un nombre de 1 à 59 après l'unité d'heure vaut des minutes sauf s'il est suivi d'une unité explicite autre que minute (`g|kg|ml|cl|l|secondes?|seconds?|secs?|s`, insensible à la casse, frontière de mot) ou d'un chiffre/décimale : remplacer `finAbregee` par un « lookahead » négatif sur ces unités ; borne `(?:[0-5]?\d)` ; garder la branche `\s*${minute}`.
- [x] **Étape 4 : suite verte, commit** `fix(minuteries): lire les minutes apres les heures devant une preposition (audit 3.1)`.

### Tâche 5 : Retour des avertissements « Avant de commencer » en cuisine

**Fichiers :**
- Créer : `src/domain/cuisine-avertissements.js` — `export function avertissementsAvantCuisson(items)` : `items = [{ recipe, version }]` → `string[]` ; une ligne par étape dont un minuteur a `seconds >= 3600` (`${titre} — ${t('étape')} ${position} : ${label}`) ou dont le texte contient `la veille|overnight|toute une nuit|\b\d+\s*h(eures)?\s+de\s+(repos|marinade)|réfrigérer\s+\d+\s*h` (règle d'origine, `docs/audits/…/lentilles/code-review-verifie.md` n° 4).
- Modifier : `src/ui/cook.js:46` (conteneur `avertissements`, `data-role="avertissements-cuisine"`) : avant la première étape faite, un bloc `card warn` `data-role="avant-de-commencer"` avec `strong` `t('Avant de commencer')` et une liste.
- Modifier : `tests/l7-cuisine-ecran.js` ; créer un bloc dans `tests/l0-cuisine.js` pour la fonction pure ; `tests/ajouter.js` si un texte neuf.

- [x] **Étape 1 : tests rouges** : (pure) étape « laisser mariner toute une nuit » → 1 ligne ; minuteur 3600 → 1 ligne ; recette sans attente → `[]` ; (écran) séance sur une version avec « toute une nuit » → `root.querySelector('[data-role="avant-de-commencer"]')` présent avec le titre de la recette ; après une étape marquée faite → absent.
- [x] **Étape 2 : rouge constaté. Étape 3 : implémenter. Étape 4 : suite verte, livraison (`cook.js` est dans la coquille : suffixe + générateur).**
- [x] **Étape 5 : commit** `feat(cuisine): remettre les avertissements avant de commencer (audit 3.1)`.

### Tâche 6 : Démarrage sans worker et après publication (livraison I1, 3.1)

**Fichiers :**
- Modifier : `src/demarrage.js:29-31` (`presenter`), `:49-52` (décision)
- Modifier : `tests/l10-demarrage.js`

- [x] **Étape 1 : tests rouges** (fixtures du fichier : `serviceWorker` factice, `MessageChannel` factice) :
  - `audit I1 : updatefound pendant la verification` : le faux `registration` émet `updatefound` puis `statechange` pendant `controle.verifier()` → `demarrerApplication(...)` finit en `etat:'montee'` (une seconde vérification bornée est faite avant tout écran de choix).
  - `audit 3.1 : sans serviceWorker` : `serviceWorker: undefined` → `etat:'montee'`, mode `en_ligne_non_verifiee`, et `app.textContent` ne contient pas `Reprendre le démarrage`.
  - `audit 3.1 : sw.js introuvable` : `register` rejette → même issue que sans serviceWorker, plus une ligne discrète `data-role="demarrage-non-verifie"` (texte : « Mistu s’ouvre en ligne. L’installation hors ligne sera réessayée au prochain lancement. ») conservée dans `#app` après montage.
- [x] **Étape 2 : rouge constaté** (`preuves/sonde-demarrage.txt`).
- [x] **Étape 3 : implémenter** : (a) après `controle.verifier()`, si `observation.etat === 'inconnue'` et `raison === 'worker_change'`, attendre `attendreInstallation` à nouveau (même `delai`) puis `verifier()` une seconde fois avant de décider ; (b) si `!serviceWorker?.register` ou si `register` rejette : `monter('en_ligne_non_verifiee')` directement, avec la ligne discrète ; (c) l'écran de choix ne reste que pour `controlee` incomplet ; (d) les textes : deux langues codées en dur (`navigator.language` commence par `en` → anglais), parce que `t()` n'est pas chargé à cette frontière — le dire en commentaire.
- [x] **Étape 4 : suite verte, livraison, commit** `fix(demarrage): ouvrir en ligne sans worker et revérifier apres updatefound (audit I1)`.

### Tâche 7 : Worker : stockage persistant, échec visible, anciens caches purgés (livraison I2, I3, I5)

**Fichiers :**
- Modifier : `tools/service-worker.template.js` (`install`, `activate`), régénérer `sw.js` par le générateur (jamais à la main)
- Modifier : `src/core/livraison.js` (exposer `observation.echec = { raison } | null`), `src/demarrage.js` (afficher la raison sur l'écran de choix), `src/app.js` (après admission : `navigator.storage?.persist?.()` une fois ; résultat dans `sync_state` clé `stockage_persistant` `{ value: boolean, at }`), `src/ui/settings.js` (Diagnostic : ligne « Stockage protégé contre l’éviction : oui/non/inconnu »)
- Tests : `tools/livraison-worker.test.mjs`, `tests/l10-demarrage.js`, `tests/l10-diagnostic.js`

- [x] **Étape 1 : tests rouges** :
  - (worker, Node) `audit I2 : activate purge les caches cuisine-os-v* etrangers` : caches `cuisine-os-v0.31.0-1`, `cuisine-os-v0.32.0-5` (courant), `cuisine-os-meta` → après `activate`, seuls le courant et `meta` restent.
  - (worker, Node) `audit I5 : un echec d'installation est signale` : `recevoir` lève `shell_invalid` → `clients.matchAll()` reçoivent `{ type:'livraison_echec', raison:'shell_invalid' }` et le cache partiel est supprimé (comportement actuel conservé).
  - (app) `audit I5 : l'echec est lisible` : message `livraison_echec` reçu → `controle.verifier()` rend `observation.echec.raison === 'shell_invalid'` et l'écran de choix contient « Installation hors ligne impossible (shell_invalid). ».
  - (app) `audit I3 : persist demande une fois` : `navigator.storage.persist` factice compté → 1 appel sur deux démarrages ; `sync_state.stockage_persistant.value === true`.
  - (diagnostic) la ligne « Stockage protégé » reflète `sync_state`.
- [x] **Étape 2 : rouge. Étape 3 : implémenter (activate : `caches.keys()` → supprimer tout nom commençant par `cuisine-os-v` différent de `c.cache`, jamais `c.meta`).**
- [x] **Étape 4 : `node --test` vert, suite verte, `generer-livraison` (le worker change : suffixe), commit** `feat(livraison): stockage persistant, echec d'installation visible, purge des anciens caches (audit I2 I3 I5)`.

### Tâche 8 : Migration `0014_maintenance_et_bornes.sql` — ÉCRITE, JAMAIS APPLIQUÉE

**Fichiers :**
- Créer : `tools/maintenance-sql.mjs` (générateur, même gabarit que `tools/traductions-sql.mjs`), `supabase/migrations/0014_maintenance_et_bornes.sql` (généré), `supabase/proofs/0014_maintenance.sql`, `tools/prover-purge-tombales.mjs`
- Modifier : `tools/generer-migrations.mjs` (+ `0014`), `tools/generer-migrations.test.mjs`, `supabase/README.md` (étape 15 : procédure 0009→0014, correction de « cinq migrations générées »), `supabase/proofs/RESULTATS-mitsu.md` (sections 0011, 0012, 0013 à compléter par le postflight — geste de Neegan)
- Lentille : `docs/audits/…/lentilles/sql-rls.md` (I-1 à I-4, M-2, M-3)

- [x] **Étape 1 : prouveur rouge** `tools/prover-purge-tombales.mjs` : sur un PostgreSQL jetable 0001→0013, pour chacun de `recipe_versions`, `cook_sessions`, `timer_launches`, `inventory`, `book_editions`, `recipes` (avec `lifecycle_id`) : insérer sous un compte admis une ligne, la tombaliser avec `data` non vide et `deleted_at` à −91 jours, puis `select public.purge_tombstones()` sous `postgres` sans JWT → attendu après 0014 : retour ≥ 6 et `data = '{}'` partout ; avant 0014 : exception 42501 ou `check_violation`.
- [x] **Étape 2 : écrire 0014** :
  - (I-1) en tête des fonctions de déclencheur `l1_guard_recipe`, `l2_guard_write`, `l5_guard_write`, `l6_guard_version` (déclencheur `l6_version_guard`), `l6_guard_journal` (`imports_l6_guard`), `l7_guard_cooking` (`l7_cooking_guard`) et `l8_guard_inventory` (`l8_inventory_guard`) : `if tg_op='UPDATE' and current_setting('app.maintenance',true)='on' and new.data='{}'::jsonb and old.deleted_at is not null and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.purge_tombstones()'::regprocedure) then return new; end if;` — `l1_guard_recipe` et `l2_guard_write` sont RÉÉCRITES EN ENTIER (plus de `regexp_replace`, M-2), corps = celui de 0010 + les trois clauses de 0011/0012/0013 + celle-ci.
  - (I-3) `l2_lock_rows(rows jsonb)` : `if jsonb_array_length(rows) > 500 or (select count(distinct id) …) > 2000 then raise exception 'trop de lignes' using errcode='22023'; end if;`.
  - (I-2) `public.admin_purge_owner(uid uuid)` `security definer`, `set search_path=''`, `revoke … from public, anon, authenticated`, `grant execute … to service_role` : pose `app.purge='on'` et `app.l1_purge_all='on'` puis exécute les mêmes `delete` que `sync_purge_all` pour `uid`, y compris les deux tables privées L5 ; README : « Supprimer un compte = `select public.admin_purge_owner('…')` dans l'éditeur SQL, PUIS Delete user ».
  - (M-3) `on delete cascade` vers `auth.users` sur les deux tables privées L5 ; `cron.schedule('cuisine-os-transferts', '30 4 * * *', 'select public.l5_cleanup_transfers()')`.
- [x] **Étape 3 : `node tools/generer-migrations.mjs --check` à 0, `node --test` vert (empreintes 0001–0013 inchangées, 0014 ajoutée), prouveur vert sur la base jetable.**
- [x] **Étape 4 : commit** `feat(sql): migration 0014 maintenance, bornes et purge de compte (audit SQL I-1 I-2 I-3 M-2 M-3) - NON appliquee`. Dire dans `STATE.md` : « 0014 écrite, non appliquée : geste de Neegan, après son postflight de 0011–0013 ».

### Tâche 9 : Synchronisation — portes de sortie et robustesse (synchro B1–B6, backfill)

**Fichiers :** `src/sync/outbox.js:112-114`, `src/sync/push.js:365-378`, `src/domain/backup.js:237-241,556-580`, `src/sync/pull.js:206-224`, `src/core/db.js:238`, `src/ui/cook.js:30`, `src/domain/cuisine-persistance.js:55-57`, `src/sync/backfill.js:190-205` ; tests `tests/l2-sync-reprise.js`, `tests/l5-archives.js`, `tests/l7-sync.js`, `tests/sync-l3.js`. Lentille : `docs/audits/…/lentilles/synchro.md` § B.

- [x] **9.1 Commandes protégées** : test rouge `audit synchro B2 : abandonner une commande protegee en quarantaine` → `abandonnerEnvoi` accepte une entrée protégée quarantinée `last_error:'forme'` APRÈS confirmation (`confirm` injecté rend `true`), écrit un conflit documentaire `kind` de la commande avec sa copie, et libère les entrées retenues de même cible. Implémenter dans `outbox.js:112` + `push.js:365-378` (un refus HTTP du lot d'une commande protégée crée le conflit documentaire au lieu d'une quarantaine muette).
- [x] **9.2 Archive d'avant un retrait** : test rouge → `inspectArchive` sur une archive antérieure au retrait d'une recette rend `{ refus:'retrait_posterieur', recettes:[id] }` et Réglages affiche « Cette archive est antérieure à un retrait : restaure-la après avoir vidé l'appareil, ou choisis « Fusionner sans les recettes retirées ». » avec ce second geste câblé (`applyArchive({ mode:'fusion', exclure: ids })`).
- [x] **9.3 Fiche invalide** : test rouge → `createArchive` avec une fiche invalide écrit l'archive SANS cette fiche et `inspectArchive` liste `exclues:[{store,id,motif}]` ; Réglages dit « 1 fiche exclue (motif) ».
- [x] **9.4 Fiches à cycle** : test rouge dans `tests/sync-l3.js` → une fiche `recipes` qui porte un cycle et dont `updated_at` est égal mais `data` différente fait un conflit `kind:'donnees'` (pas de tranchage muet) ; implémenter dans `pull.js:206-224` en rappelant `decider` quand `resultat.conflit` est faux et que les cycles sont égaux.
- [x] **9.5 VersionError** : test rouge → `Database.open()` qui reçoit `VersionError` émet `versionchange_bloquee` et `src/app.js` affiche le bandeau « Une version plus récente est ouverte dans un autre onglet. Recharge cette page. » (`data-role="bandeau-version"`).
- [x] **9.6 Horloges** : `cook.js:30` et `cuisine-persistance.js:55-57` passent par `syncNow()` ; test : horloge locale avancée de 1 h → `created_at` suit `syncNow`.
- [x] **9.7 Envoi initial** : test rouge → pour un morceau de 500 lignes de `recipe_versions`, les conditions ne portent que sur les parents RÉFÉRENCÉS par le morceau (`recipe_id` des lignes), pas sur tout `recipes` ; mesure : nombre de conditions ≤ lignes + parents référencés + 1.
- [x] **Chaque sous-tâche : suite verte, commit séparé** (`fix(sync): …`).

### Tâche 10 : Thermomix — réparer les anciens plans, garder le travail payé, fermer TMX/VIS restants

**Fichiers :** `src/domain/thermomix.js` (`:36-42`, `:102`, `:187-191`, `:221-246`, `:288-304`, `:311-338`, `:458-470`), `src/domain/thermomix-parcours.js:185,256,269`, `src/domain/reperes.js:25-28,129-135,146-170`, `src/domain/reperes-parcours.js:122,167,173`, `src/ui/thermomix.js:47,247`, `src/ui/thermomix-garde.js:6`, `src/ui/photo-gestion.js:127` ; tests `tests/correctifs-thermomix-securite.js`, `tests/i3-thermomix.js`, `tests/correctifs-reperes.js`, `tests/visuel-reperes.js:17`. Lentille : `docs/audits/…/lentilles/thermomix.md`.

- [x] **10.1 Anciens plans (Important)** : test rouge `audit TM7 : un plan conserve avant 0.23.2 devient a_revoir, pas invalide` : une `RecipeVersion` TM7 conservée avec eau 3000 g → `lireThermomix(version)` rend `{ ok:false, etat:'a_revoir', motifs:['eau_vapeur'] }` ; la cuisson, la copie et les repas restent possibles sur l'ORIGINAL (`cuisine-persistance.js:22`, `meals.js:214`, `grocery.js:60` acceptent `a_revoir` en basculant sur la version parente) et la fiche offre « Revoir les réglages Thermomix » qui ouvre la route TM7 préremplie avec les blocs à corriger (`ui/thermomix.js:247` : plus de conseil « sélectionne toutes ses étapes »). Jamais un plan `a_revoir` présenté comme validé.
- [x] **10.2 Réponse payée refusée conservée** : test rouge → une réponse refusée par `capacite` garde `reponse_brute` et `motif` sur la ligne d'import (`resultat:null` inchangé), l'écran dit le motif EXACT (table motif → phrase, plus de « Vérifie la sélection… » générique, `ui/thermomix.js:47`) et offre « Voir la réponse reçue » (texte seul).
- [x] **10.3 Gardes sans test discriminant** : ajouter dans `tests/correctifs-thermomix-securite.js` : eau cumulée 1200 + 2×600 → `'capacite'` ; vapeur à vitesse 3 → `'vitesse'` ; Varoma hors vapeur → `'accessoire'` ; accessoire couteau/fouet avec panier chargé → `'capacite'` (TMX-3 : les accessoires contrôlent tous les contenants, `thermomix.js:187-191,288-289`).
- [x] **10.4 Filtre de mots** : `<` et `>` autorisés dans questions/refus ; frontières `\b` sur `cap|lid|gobelet|bouchon` ; « sans risque » toléré dans un REFUS prudent ; tests : les trois phrases de la lentille (« retirer du liquide pour respecter la capacité du bol », « mixer la soupe… chaude ») restent refusées, « vitesse >2 » accepté.
- [x] **10.5 TMX-7, TMX-8, VIS-9** : `ref` (`i1…iN`) envoyées dans `source.ingredients` (`thermomix-parcours.js:185`) ; longueur d'étape mesurée AVANT « Garder » avec motif `etape_trop_longue` ; la recette n'est envoyée qu'une fois (signature = SHA-256, pas le JSON entier, `reperes-parcours.js:122`).
- [x] **10.6 Repères** : fourchettes « mijoter/enfourner », « 1 h 30 » (après tâche 4) ; `temps` nul avec `references:[]` accepté ; « végétarien » autorisé en saisie manuelle et en réponse (`reperes.js:28`) ; `visuel-reperes.js:17` passe au motif exact ; VIS-7 confirmation avant de remplacer une photo de cuisson (`photo-gestion.js`) ; VIS-8 nettoyage `\p{Cc}\p{Cf}` à la saisie.
- [x] **Chaque sous-tâche : suite verte, commit séparé** (`fix(thermomix): …`, `fix(reperes): …`).

### Tâche 11 : Produit — accueil, motifs visibles, conflits lisibles, textes

**Fichiers :** `src/ui/home.js`, `src/ui/actions-contenu.js:171`, `src/ui/corbeille.js:57-67`, `src/ui/cook.js:56`, `src/ui/settings.js:93,224,290-291,914-940,1138-1193`, `src/ui/kitchen.js:12,22`, `src/ui/coquille.js:14`, `src/app.js` (`/import` nu), `src/i18n/en.js`, `tests/ajouter.js` ; tests `tests/l3-navigation.js`, `tests/l9-*.js`, `tests/i2-*.js`. Lentille : `docs/audits/…/lentilles/produit.md`.

- [x] **11.1 Accueil** : test rouge → `renderHome` montre, quand ils existent, « Prochain repas » (le premier `meals` à venir, lien `/meals/:id`), « Courses » (liste du jour, lien `/lists/:id`), « Brouillons sur cet appareil » (lien vers `/add` section), « Import interrompu » (lien `/add`) ; rien de tout cela sans donnée (aucune section vide).
- [x] **11.2 Motifs visibles** : test rouge → une action désactivée rend le motif dans un `small` sous le bouton (`data-role="motif-action"`), pas seulement en `title` ; « Vérifier la disponibilité » hors ligne affiche « Tu es hors ligne : impossible de vérifier pour l'instant. ».
- [x] **11.3 Cuisine en erreur** : `cook.js:56` offre « Rouvrir la séance » (`navigate` sur la même route) et « Fiche ».
- [x] **11.4 Conflits lisibles** : test rouge → un conflit `donnees` sur `recipes` affiche une comparaison champ par champ (titre, portions, nombre de lignes, dernière modification) des deux copies, le JSON restant sous `details` « Détails techniques ».
- [x] **11.5 Textes** : Synchronisation : noms de magasins → libellés (`t('Recettes')`, `t('Livres')`, … table `LIBELLES_MAGASINS`) ; « Données sur cet appareil » : « Base locale v6 · archives v7 » devient « Ta bibliothèque sur cet appareil » + compte par type ; Diagnostic : première ligne « À envoyer si Mistu se comporte mal : ce diagnostic ne contient aucune recette. » ; Ma cuisine > Appareils : onglet par défaut « Inventaire », première ligne « Tes appareils, pour adapter les recettes. », toutes les chaînes traduites, `kitchen.js` ajouté à `CHAINES_NEUVES_AILLEURS` ; onglet « Ma semaine » → « Repas » ; marque « Mistu » partout (`coquille.js:31`, `settings.js:105`).
- [x] **11.6 `/import` nu** : redirige vers `/add` (test de navigation).
- [x] **Suite verte, commits par sous-tâche** (`feat(accueil): …`, `fix(ui): …`).

### Tâche 12 : Tests, preuves et méthode

**Fichiers :** `tests/l1-corbeille-domaine.js:9`, `tests/l2-corbeille-domaine.js`, `tests/l5-archives.js:9`, `tests/correctifs-reperes.js:8` (≈ 109 sites), `tests/l5-index-stockage.js`, `tools/prouver.sh` (nouveau), `supabase/README.md`, `.github/workflows/ci.yml` (nouveau), `STATE.md`. Lentille : `docs/audits/…/lentilles/tests.md`.

- [ ] **12.1 Refus exacts** : remplacer chaque `ok(await refuse(fn))` par `eq(await motif(fn), '<code>')` avec le code réel lu dans le `throw` du code testé (`e.raison ?? e.code ?? e.message`) ; aucun total en baisse.
- [ ] **12.2 Bornes jamais atteintes** : tests rouges → 65 fragments → `too_large` ; résultat > 4 Mio → `too_large` ; `absente:true` isolée au niveau dépôt (retirer la branche de `lireCondition`, `repo.js:434`, rougit).
- [ ] **12.3 PostgreSQL jetable scripté** : `tools/prouver.sh` crée une base locale (port 55439, `L1_PROOF_LOCAL=1`), applique 0001→0014, lance tous les `tools/prover-*.mjs` et imprime un bilan ; `supabase/README.md` § « Rejouer les preuves » ; `node --test` ne change pas.
- [ ] **12.4 CI** : `.github/workflows/ci.yml` sur `pull_request` et `push` vers `main` : `node --test --test-concurrency=1 tools/*.test.mjs`, `node tools/generer-migrations.mjs --check`, `node tools/generer-livraison.mjs --check`, suite navigateur en Chromium sans tête (serveur statique + Playwright, lecture de `#out h2`, échec si ≠ « ✅ N/N »), scan `git grep -nE 'sk-ant-|sbp_|eyJ[A-Za-z0-9_-]{30,}\.'` (hors sentinelles de test). Aucun secret dans le workflow.
- [ ] **12.5 STATE.md** : remplacer « aucun scénario retiré » par le relevé exact (127 libellés disparus, 22 scénarios `supprimerLivreVide` devenus `corbeille_requise`, 54 attentes changées) ; en tête : « Correctifs de l'audit du 30 oct. : lot A/B/… livré ».
- [ ] **Commits** `test: …`, `ci: …`, `docs(state): …`.

---

## Auto-revue (faite par l'auteur du plan)
- Couverture : B1 → T1 ; B2 → T2 ; B3 → T3 ; 3.1 (minuteries, Avant de commencer, démarrage sans SW, backfill) → T4, T5, T6, T9.7 ; 3.2 (SQL I-1 à I-4, M-2, M-3) → T8 ; 3.3 (synchro B1–B6) → T9 ; 3.4 (livraison I1–I5) → T6, T7 (I4 → T12.4 CI ; I6 à mesurer, hors plan) ; 3.5 (Thermomix) → T10 ; 3.6 (produit) → T11 ; 3.7 (tests) → T12 ; 5 (processus) → T12.4 + contraintes globales. Non couverts volontairement : `pull.js:207` et `cycle.js:26` (mineurs), i18n des clés dynamiques (mineur), livraison M1–M6 (moyens) — à reprendre après le lot G.
- Noms : `fusionnerConditions` (T1), `estImportGere` (T2), `avertissementsAvantCuisson` (T5), `admin_purge_owner` (T8), `LIBELLES_MAGASINS` (T11) ne sont utilisés que par leur tâche.
- Proportion : le plan décide (fichiers, noms, cas, motifs) et laisse les corps à l'exécutant.
