# Audit intégrité des données et synchronisation — Mistu / Cuisine OS, commit 247b2e5 (lots L0–L10, 0.22 → 0.32.0)

Copie lue : `` (chemins relatifs à cette racine). Aucun réseau, aucun git, lecture seule hors `rapports/synchro/`.
Méthode : lecture du code (schéma, `core/db.js`, `model/repo.js`, `sync/*`, `domain/backup.js`, domaines neufs), recoupement avec les
migrations SQL 0008–0013, lecture des tests nommés ; un script Node (`rapports/synchro/_check-schema.mjs`) compare `schema.js` ↔ `tables.js` ↔ `create table`.
Ce qui est marqué **inférence** n'a pas été exécuté : c'est un scénario déduit du code, pas une preuve au navigateur.

## Verdict

Le socle tient : porte unique `db.mutate`, conditions relues DANS la transaction, capture d'outbox dans la même transaction, « plus récent gagne »
et tombales datées du geste, archive 1→7 tolérante. Mais deux trous réels, créés par la rencontre de mécanismes anciens et de règles neuves :

1. **BLOQUANT (différé, se déclenche vers le 28–29 novembre 2026)** — la purge à 30 jours du journal `imports` (ancienne, `repo.init`) supprime
   localement les fragments/manifestes d'index L5 et les journaux de traduction L6, que le serveur **refuse** de supprimer : divergence
   local/serveur, index irrécupérable sur l'appareil, archive créée ensuite refusée à l'inspection, N envois en quarantaine permanente.
2. **BLOQUANT (perte de saisie)** — un conflit de cycle `recipes:<id>` journalisé à la réception (qui porte la copie des modifications hors
   ligne) est **écrasé** par le conflit de même identifiant journalisé à l'envoi suivant, dont la copie « locale » est déjà la version serveur :
   les modifications hors ligne faites sur une recette retirée ailleurs peuvent disparaître sans trace.

Puis six constats importants (archive d'avant un retrait non restaurable, commandes protégées sans porte de sortie, une fiche invalide bloque
toute sauvegarde, invariant « égal + différent = conflit » abandonné sur les fiches à cycle, vieil onglet gelé après la montée de version,
horloges brutes des minuteurs) et des constats mineurs. Le détail suit, question par question en fin de rapport.

---

## A. Constats bloquants

### A1. Purge à 30 jours vs lignes `imports` gérées (L5 index, L6 traduction) — divergence et archive non restaurable

- `src/model/repo.js:179-194` — `purgerImportsAnciens` : toute ligne `imports` au statut `enregistre`/`ignore` dont `updated_at` a plus de
  30 jours est SUPPRIMÉE, origine `local` (tombale capturée, envoyée au serveur). Aucune exclusion par sorte ni par champ réservé :
  ```js
  for (const statut of IMPORTS_TERMINES) for (const ligne of await db.byIndex('imports', 'status', statut)) {
    if (Number.isFinite(quand) && maintenant - quand > RETENTION_IMPORTS_MS) vieilles.push(ligne);
  ```
- `src/domain/index-stockage.js:135-136` — les fragments de résultat d'index sont des lignes `imports` `{ kind:'index', status:'enregistre',
  resultat:null, index_storage:{ role:'result_fragment' … } }`, jamais réécrites après leur création (leur `updated_at` reste celui de la lecture).
  Le manifeste (`role:'page_manifest'`) est, lui, réécrit à chaque décision d'application (`src/domain/index-application.js:318`,
  `index_decisions`, `index_decision_revision`) : son `updated_at` avance, pas celui des fragments.
- `supabase/migrations/0010_sources_index.sql:915-918` — côté serveur, une ligne `imports` qui porte `index_storage`, `source_capture` ou
  `index_call` est « managed » et **toute suppression est refusée** : `raise check_violation using message='source_reserved'`. Même règle L6 :
  `0011_ingredients_traductions.sql:421-424` (`kind='traduction'` ou `translation_*` → `translation_reserved` sur DELETE).
- `supabase/migrations/0009_corbeille_livres.sql:266-269` — dans `sync_push`, une `check_violation` d'un trigger devient `bad := 'forme'` ;
  côté client `src/sync/reponses.js:102-106` → `quarantaine` motif `forme`, permanente.

Scénario concret (chronologie réelle du propriétaire) : lectures d'index L5 faites les 29–30 octobre ; vers le 28–29 novembre, au premier
démarrage de la journée, `repo.init()` supprime localement les fragments (30 j, jamais réécrits) mais garde le manifeste (réécrit depuis).
Effets pour la personne :
1. le résultat d'index n'est plus reconstructible sur cet appareil (`src/domain/index-stockage.js:91` → `result_incomplete`) : « reprendre
   l'application d'un index » échoue ;
2. une sauvegarde ZIP créée après coup est **acceptée à l'export** (`src/domain/backup.js:240-241` : `checkRelations` n'y est qu'un avertissement,
   la relation `imports.index_storage.fragments[].id → imports` manque) mais **refusée à l'inspection** sur tout appareil
   (`backup.js:54` `validerStockageIndex(stores.imports)` strict → « Preuve de source invalide : result_incomplete » ; `backup.js:187` erreur de
   relation) : cette sauvegarde ne se restaure nulle part ;
3. N tombales partent au serveur, N refus `forme`, N entrées en quarantaine (« À envoyer » ne redescend plus, geste requis sur chacune) ;
   le serveur et les autres appareils gardent les lignes, cet appareil ne les reverra jamais (curseur déjà passé) ;
4. 30 jours plus tard, même chose pour le manifeste s'il n'est plus touché, et pour chaque journal de traduction L6 clos.
Les tests ne couvrent que des lignes ordinaires (`tests/import-cible.js:2040-2070`) ; aucun test ne pose un fragment d'index ou un journal
`traduction` vieux de 31 jours.
Suggestion (une ligne) : exclure de `purgerImportsAnciens` toute ligne « gérée » (`porteSourcesL5` de `backup.js:46-47`, `kind==='traduction'`,
champs `translation_*`), et poser un test « fragment de 31 jours intact ».

### A2. Conflit de cycle écrasé : la copie des modifications hors ligne peut se perdre

- `src/sync/pull.js:206-224` — à la réception d'une recette (ou édition) dont le cycle diffère, `fusionCycle` remplace la fiche locale par la
  copie serveur (`src/sync/cycle.js:43-48` : `meme` faux → `row: overlay.row`) et journalise un conflit **à identifiant fixe** avec la copie locale :
  ```js
  conflits.push({id:`${table}:${ligne.id}`,store:table,record_id:ligne.id,local:locale,server:ligne,…,kind:'cycle'});
  ```
- `src/sync/reponses.js:64-67` — à l'envoi, un refus `cycle` journalise un conflit **au même identifiant** avec `local: fichesLocales[k]`, c'est-à-dire
  la fiche telle qu'elle est en base AU MOMENT DE L'ENVOI ; `src/sync/push.js:135,144` l'écrit par `puts.sync_conflicts` → `put` IndexedDB :
  l'entrée précédente est remplacée, sans lecture préalable (contrairement aux clôtures d'import, `push.js:121`, qui relisent `sync_conflicts`).

Scénario (**inférence** sur l'ordre des passes, lu pour l'écrasement) : B modifie hors ligne la recette R (entrée `put` en file, contexte
`expected_cycle_id: null`) ; A retire R. B revient en ligne : (1) une première passe échoue au réseau → l'entrée reçoit `next_try_at` (recul) ;
(2) une passe déclenchée entre-temps (`online`, `visibilitychange`, `change` : `src/sync/moteur.js:507-512`) trouve une file sans entrée prête
(`push.js:57` `prete(e)`), l'envoi « réussit » à vide, la réception s'exécute : R est remplacée par la copie retirée, le conflit `recipes:R`
porte les modifications de B ; (3) la passe de reprise envoie le `put` : `elementDe` relit la fiche (désormais la copie retirée), le serveur
refuse `cycle` (`0008_corbeille_recettes.sql:161`, `expected_cycle_id` ≠ `lifecycle_id`), le client écrit `recipes:R` avec
`local` = copie retirée. Les modifications de B n'existent plus nulle part (l'entrée `put` de `recipes` n'emporte pas de `snapshot`,
`src/sync/outbox.js:60`). Même issue dès que le `put` est retenu en passe 1 (`attendParent`, `attendLivre`, `lots.js:190-193`).
Aucun des 40 scénarios de `tests/l1-corbeille-sync.js` ne croise « édition ordinaire hors ligne » et « retrait ailleurs » ; ils croisent
commandes de cycle entre elles.
Suggestion : à l'envoi, ne jamais écraser un conflit `cycle` existant dont `local` diffère (relire `sync_conflicts` comme pour les clôtures),
ou clé de conflit par `seq`/`operation_id` ; au mieux, emporter un `snapshot` dans l'entrée `put` de `recipes`.

---

## B. Constats importants

### B1. Une sauvegarde faite AVANT un retrait ne se restaure plus, ni en fusion ni en remplacement (par conception, non dit)
- `src/domain/backup.js:556-563` `conflitsCycles` : une recette présente dans l'archive avec un cycle différent de la base
  (`!memeCycleRecette`), ou absente de l'archive mais protégée en base (`mode==='replace' && protege`), est un conflit ;
  `backup.js:579-580` → `ErreurCycleArchive`, restauration refusée en bloc. Idem éditions (`549-555`).
- Scénario : sauvegarde le 1er du mois ; retrait puis restauration d'UNE recette le 10 (elle porte désormais `lifecycle_id`) ; restauration de
  l'archive le 20 (pour récupérer autre chose) → refus « cycles de recette différents ». Seule issue : « Effacer les données de cet appareil »
  puis restaurer dans une base vide, après quoi la réception ramène les cycles serveur et journalise un conflit par recette concernée
  (`sync_push_v2` refuse `archive_import` au cycle différent, `0008:160`).
- Effet : la personne perd l'usage de ses archives anciennes dès qu'elle utilise la corbeille. Test `tests/l1-corbeille-archive.js`
  « cycle divergent refuse tout en … » le confirme comme voulu.
- Suggestion : à l'écran de restauration, nommer les recettes en écart et offrir « restaurer tout sauf celles-ci » (fusion partielle).

### B2. Commandes protégées (traduction, cuisine, inventaire) sans porte de sortie en quarantaine
- `src/sync/outbox.js:112-114` — `retirerEnvoi` rend `false` pour `translation_apply`, `cooking_apply`, `inventory_change` et les phases de
  journal de traduction : « Abandonner cet envoi » est impossible. `reprendreEnvoi` (l. 106) reste le seul geste.
- `src/sync/push.js:365-378` — un refus HTTP du lot entier (`erreur.type==='refus'`, 4xx sans liste `rejected`) met l'entrée en quarantaine
  `refus` SANS conflit journalisé ; les écrans de comparaison ne traitent que les commandes `lifecycle_blocked` adossées à un conflit
  (`src/domain/comparaison-sources.js:26`, `comparaison-cuisine.js`, `comparaison-inventaire.js` — **inférence** pour les deux derniers,
  construits sur le même motif).
- `src/sync/push.js:54-58` — dès qu'une commande protégée existe, `lireFile` rend TOUTE la file (quarantaine comprise) et
  `src/sync/lots.js:188-193` retient (`cycle en attente`) tout ce qui partage une cible avec elle.
- Scénario : une `cooking_apply` refusée par un 400 (schéma PostgREST périmé, bug serveur, fonction renommée) → quarantaine `refus`, « Réessayer »
  reproduit le refus, rien ne l'enlève ; la séance de cuisson, ses minuteurs et toute écriture liée à ces recettes attendent pour toujours.
- Suggestion : offrir « Abandonner » sur une commande protégée en quarantaine `refus` (avec copie conservée dans `sync_conflicts`), ou convertir
  un `refus` HTTP sur commande isolée en conflit de sa sorte pour ouvrir la comparaison.

### B3. Une seule fiche invalide bloque TOUTE sauvegarde de l'appareil
- `src/domain/backup.js:237-241` — `createArchive` : `validateRows` puis `throw new Error('Bibliothèque incohérente …')`. Les validateurs
  neufs (`142-147` : traductions, cuisine, inventaire ; `129-137` : formats de source) élargissent la surface : une ligne reçue du serveur ou
  d'un autre appareil (client plus récent, archive bricolée, fiche abîmée) rend l'export impossible, sans geste de contournement.
- Effet : la personne qui veut justement sauvegarder avant une opération risquée ne le peut plus ; aucune « sauvegarde partielle » n'existe.
- Suggestion : exporter en excluant les fiches invalides nommées (comme les traces orphelines, `l. 230-236`), et les lister dans le bilan.

### B4. Fiches à cycle : « égal + différent = conflit » abandonné, conflit de pointeur jamais détecté
- `src/sync/pull.js:206-224` — pour `recipes`/`book_editions`, dès que la fiche locale OU reçue porte un cycle (`porteCycle` : toute recette
  déjà retirée puis restaurée, toute édition déjà retirée), le chemin `fusionCycle` remplace `decider` et fait `continue` AVANT
  `conflitDePointeur` (l. 254-257). `src/sync/cycle.js:46-48` : même cycle → la copie locale ne gagne que si `updated_at` est strictement
  plus grand ; à instant égal et contenu différent, la copie serveur remplace la locale **sans journal** (`conflit` n'est vrai que si les
  cycles diffèrent).
- Effet : pour toute recette restaurée un jour, deux adaptations parallèles (A et B) ne produisent plus le conflit `version` : le pointeur
  `current_version_id` du dernier arrivé gagne en silence (les versions restent en base, mais personne n'est prévenu) ; un désaccord à
  instant égal est tranché sans la personne. Les autres recettes gardent l'arbitrage I7 complet (`pull.js:53-78`).
- Suggestion : dans la branche cycle, quand `meme` est vrai, retomber sur `decider` (+ `conflitDePointeur`) pour le contenu.

### B5. Montée de version : un vieil onglet reste gelé jusqu'au rechargement, ses écritures en cours sont perdues
- `src/core/db.js:238` — `onversionchange` ferme la connexion ; le code ancien rouvre avec son `DB_VERSION` (4 ou 5) → `VersionError`
  (prouvé par `tests/l1-corbeille-domaine.js:170` « ancien code DB4 ne réouvre pas la base DB5 »). Aucun `VersionError` n'est traité dans
  `src` (grep vide) : l'écran générique « Une erreur est survenue / Recharger » (`src/app.js:140`) s'affiche à la prochaine écriture.
- Scénario : deux onglets (Mac) ou une PWA iPhone laissée ouverte pendant que Safari met à jour le service worker ; une cuisson ou un import
  en cours dans l'onglet ancien échoue à sa prochaine écriture. Pas de perte en base (tout est transactionnel), mais perte de l'état d'écran
  non encore écrit.
- Suggestion : sur `versionchange`, afficher un bandeau « nouvelle version, recharger » et bloquer les écritures proprement.

### B6. Horloges brutes dans la cuisine et les minuteurs (L7)
- `src/ui/cook.js:30` — le service de cuisine reçoit `maintenant = () => new Date().toISOString()` (heure brute) ; `src/domain/cuisine-persistance.js:55-57`
  pose `created_at`, `requested_at` des lancements de minuteur avec cette heure, alors que `updated_at` vient de `syncNow()`
  (`src/model/repo.js:895`) ; `timerAffiche` calcule le temps restant avec `Date.parse(maintenant())`.
- Effet (**inférence**) : `created_at > updated_at` possible sur un appareil en retard ; un minuteur lancé sur A (horloge +3 min) lu sur B affiche
  3 minutes de moins ; le tri des lancements (`lireMinuteurs`, par `created_at`) peut s'inverser entre appareils. Aucune corruption, mais un
  « état d'écran » qui ne vient pas d'un fait partagé (contrat du projet).
- Autres horloges brutes relevées (sans effet d'arbitrage) : `src/domain/corbeille.js:4`, `corbeille-livres.js:15` (`at`/`trashed_at` : format
  seul vérifié côté serveur, arbitrage par identifiant de cycle), `src/sync/reponses.js:29`, `pull.js:146,222,269` (`at` des conflits, purge par
  `Date.now()` cohérente), `src/domain/index-application.js:302` (`committed_at` d'un reçu local ; le serveur fabrique le sien, `0010:551`).
- Suggestion : injecter `syncNow` dans `creerServiceCuisine`/`creerServiceInventaire` ; calculer « restant » depuis l'heure corrigée.

---

## C. Constats mineurs ou par conception (à dire à la personne)

- **C1. Pas de « Vider la corbeille », pas de suppression définitive, jamais.** Spec L1 l. 22 et 65, L2 l. 27 : purge hors périmètre.
  De plus `src/model/repo.js:1072-1075` (`suppression_interdite` si `lifecycle_id` posé) et `0008:76` : une recette restaurée ne peut plus
  être supprimée par le chemin générique ; aucune chaîne d'interface ne nomme `suppression_interdite` (grep `src/ui`, `src/i18n` vide) → la
  personne verrait un code d'erreur brut. La corbeille et le serveur grossissent sans borne.
- **C2. Brouillons (L4), progression d'index, réponses brutes de traduction : locaux, hors archive, effacés par « Effacer cet appareil ».**
  `sync_state` clés `editor_draft:v1:` (`src/domain/brouillons-format.js:5`), `lecture-index:` / `index_application:v1:` (`repo.js:136`,
  spec L5 l. 195) ; `backup.js:33` (README de l'archive) ; `repo.js:1084` `clearDevice` vide tout sauf `device_id`. Dit à l'écran :
  « Ce brouillon se modifie sur l'appareil qui l'a créé » (`src/i18n/en.js:1487`), avertissement d'effacement (`591`, `599-600`). Cohérent.
- **C3. `putFile` local sans condition** (`src/model/repo.js:1146-1162`) : `existing` lu puis `put` sans fusion ; un `remote` posé par une
  réception entre les deux est écrasé → la photo repart au serveur (pas de perte, un envoi de plus). Les chemins `remote` et `recettes` sont
  conditionnés (l. 1142-1144, 1153).
- **C4. Deux onglets au premier lancement** : `ensureDeviceId` (`repo.js:54-64`) non conditionné → deux identités, la dernière écrite gagne,
  l'autre onglet garde la sienne en mémoire ; les imports Thermomix/repères jugent alors « autre appareil » (`repo.js:155`). Rare, se résout au
  rechargement.
- **C5. Rescan complet au changement de `DB_VERSION`** : `horodaterAnciennesFiches` (`repo.js:313-329`) garde sur `DB_VERSION` → au premier
  démarrage après 4→6, `getAll` sur les 27 magasins, `files` et ses blobs compris. **Inférence** : WebKit matérialise les blobs IndexedDB
  paresseusement ; coût en temps plus qu'en mémoire.
- **C6. Passes O(n²) avec commandes protégées** : `lots.js:181-197` filtre la file entière pour chaque entrée ; `pull.js:140` relit toutes les
  `recipe_versions` pour chaque recette reçue. **Inférence** : lenteur sur une grosse file (application d'index de 1 200 entrées), pas d'erreur.
- **C7. Réconciliation 0.23.2 § 6 : locale seulement.** Le serveur arbitre toujours par date (`0009:258-263`) ; un ancien client peut rouvrir
  une ligne (dit dans la spec). Lu et cohérent côté client, voir D5.

---

## D. Réponses aux dix questions (ce qui tient, ce qui ne tient pas)

### D1. Montée DB_VERSION sur base peuplée
- Dans cette livraison la base passe de **4 à 6** (diff `schema.js` : `DB_VERSION = 4` → `6`), pas de 3 à 6. Les deux crans n'ajoutent que
  deux index locaux (`recipes.trashed_at`, `book_editions.trashed_at`, `schema.js:14,20`). Aucun nouveau magasin.
- `src/core/db.js:226-236` — `onupgradeneeded` crée magasins et index manquants, **ne transforme aucune fiche**. C'est tenable parce que tous
  les champs neufs sont optionnels et lus avec repli : `lireCycleRecette` (`domain/cycle-recette.js:7`, absent → `active`),
  `lireStructureIngredients` (`domain/structure-ingredients.js:37`, absent → `legacy`), `estLigneCuisine` (`domain/cuisine-format.js:44`,
  absent → chemin `legacy` de `projeterSessionCuisine`), `estLotProtege` (`domain/inventaire-format.js:18`, absent → `adoption_requise`),
  traductions `alignment_format` 1 (`domain/lecture-recette.js:17`). `horodaterAnciennesFiches` (`repo.js:313-329`) complète `updated_at`.
- Tests sur base peuplée : `tests/l1-corbeille-domaine.js:166-175` (base v4 d'un magasin, une fiche → v6, « conserve les données sans
  réécriture », vieux code refusé) ; `tests/sync.js:285-330` (v1 → version courante par `repo.init()`, fiches comparées champ à champ).
  Pas de test nommé 5→6, mais 4→6 traverse les deux crans. Tient, sous réserve de B5 (vieil onglet).

### D2. Magasins, SYNC_STORES, archive, relations, tables serveur
- Script `rapports/synchro/_check-schema.mjs` (exécuté) : 31 STORES, 27 SYNC_STORES, 25 archivés ; **aucun SYNC_STORE sans table** ;
  une table serveur hors schéma (`assistant_journal`, serveur seul, voulu) ; hors archive : `files` (exporté à part), `settings`,
  `assistant_config`, `outbox`, `sync_state`, `sync_conflicts` (voulu) ; `appliances` sans relation (préexistant).
  `LOCAL_ONLY_INDEXES` (`sync/tables.js:11`) exclut les deux index de corbeille des colonnes SQL : cohérent avec 0008/0009 (champs dans `data`).
- Les six migrations n'ajoutent aucune table publique (seulement `private.mistu_source_transfers*`, `0010:587-597`) : tout le neuf vit dans des
  champs réservés de magasins existants. Tient.

### D3. Corbeille vs tombales vs purge
- Retrait = commande immuable `lifecycle` (`repo.js:683-721`, `sync/cycle.js`), jamais une tombale ; le serveur arbitre par identifiant de
  cycle, pas par date (`0008:135-154`). Une modification hors ligne sur B d'une fiche retirée sur A : B adopte le retrait, sa copie va au
  journal `cycle` (`pull.js:217-223`, écran `src/ui/settings.js:936-945` « Ta copie est conservée », pas de remise en activité) — **sauf A2**.
- Enfants (versions, traductions, liens) modifiés sur B sous une recette retirée : refusés `cycle` par `l1_guard_recipe` (`0008:92-96`) ;
  copie conservée (les versions emportent un `snapshot`, `outbox.js:60`).
- Archive avec fiches en corbeille : format 7 les porte (`backup.js:333-334` refuse seulement formats 1/2) ; cycles divergents → refus (B1).
- « Vider la corbeille » : n'existe pas (C1). `sync_purge_all` (`0010:945-957`) = effacement du compte, distinct.
- `purgerImportsAnciens` (journal) : A1.

### D4. Écritures conditionnées : atomiques
- `src/core/db.js:109-177` — une transaction `readwrite` multi-magasins : lectures (`get`/`getAll`) puis vérification et écriture DANS le rappel
  `onsuccess`, capture d'outbox dans la même transaction, `tx.abort()` sur refus. `repo.transitionner` (`1009-1031`), `saveBatch` (`777-792`),
  `protegerMutationRecettes` (`442-666` : lectures préparatoires puis **re-vérification par `fusion` dans la transaction** des cycles, parents,
  propriétaire `sync_state.user_id`, sources), `ajouterPages` (`1310-1313`, séance relue et comparée en JSON), `muterCuisine`/`appliquer`
  (`domain/cuisine-persistance.js:59-69`), `muterInventaire` (`859-871`), `marquerInterrompus` (`148-172`, battement relu). Deux onglets :
  couverts par ces relectures ; deux appareils : par le serveur (verrous `pg_advisory_xact_lock`, `0008:122`, `l2_lock_owner`).
- Exceptions non conditionnées : C3 (`putFile` local), C4 (`ensureDeviceId`). Tient.

### D5. Réconciliation 0.23.2 § 6
- Implémentée dans `src/sync/imports-clos.js` (rang `enregistre`=2 > `ignore`=1 > ouvert=0, identité `kind`/`id`/`recipe_id`, sortes
  `thermomix`/`reperes` seulement) et appelée aux trois endroits annoncés : réception `pull.js:194-203`, réponses d'envoi `push.js:97-123`,
  résolutions `conflits.js:38-40` (`fermetureImportProtegee`). Copie perdante journalisée `import_cloture`, clé par empreinte du contenu
  (`imports-clos.js:27-31`), exclue de la purge des conflits (`conflits.js:187`) et des gestes (`garderIci`/`garderAilleurs` refusent).
- Pas de boucle d'écho : renvoi seulement si la copie locale gagne ET que la date distante est ≥ locale, avec `updated_at = max(syncNow, distante + 1 ms)`
  (`imports-clos.js:34-35`) ; l'écho revient de même rang → `preparerFermetureImport` rend `null` → `identiques` → `ignorer`.
- Le serveur reste « date la plus récente » (`0009:258-263`) : un ancien client peut rouvrir (C7, assumé par la spec). Tient.

### D6. Bornes, troncatures, dichotomie
- Outbox : 500 éléments / 900 Kio par lot, 512 Kio par élément (`lots.js:20`) ; un élément trop gros part seul (`lots.js:207-208`) et le
  serveur le refuse `taille` (`0009:231`) → quarantaine nommée, « Abandonner » possible pour un `put` ordinaire — **pas pour une commande
  protégée** (B2). Dichotomie sur `refus` seulement (`push.js:365-388`). Index : 600 entrées par appel, 1 200 à la fusion de moitiés
  (`domain/index-livre.js:16`, spec L5 § 6.4) ; résultat ≤ 4 Mio en ≤ 64 fragments de 256 Kio (`index-stockage.js:7,131-141`, dichotomie sur la
  taille d'enveloppe avec réserve pour 128 reçus, l. 21-27). Photos/PDF : octets par le stockage (`sync/fichiers.js`), jamais dans l'outbox ;
  `remote` borné à 4 Kio (`tables.js:44`). Une grosse fiche ordinaire ne bloque pas la file « pour toujours » ; une commande protégée refusée, si (B2).

### D7. L7 cuisson/minuteurs, L8 inventaire, L4 brouillons
- Synchronisés : `cook_sessions`, `timer_launches`, `cook_history`, `inventory` (dans SYNC_STORES) par commandes `cooking_apply` /
  `inventory_change` (`sync/commandes-cuisine.js`, `commandes-inventaire.js`), capacités serveur vérifiées avant envoi (`push.js:394-401`,
  `0012:291`, `0013:231`). Conflits : une ligne cuisine/inventaire reçue remplace la locale seulement sans commande en attente
  (`pull.js:176-192`) ; avec commande, l'intention locale reste et la comparaison tranche (`repo.js:906-921`, `874-883`). Archivés et vérifiés
  (`backup.js:144-147, 587-592, 689-696`).
- Locaux : brouillons, progression d'index, réponses de traduction (C2), dits à l'écran et dans le README de l'archive. Tient, sous B6.

### D8. Traductions versionnées (L6)
- `current_version_id` n'est touché par aucun module de traduction (grep `src/domain/*traduction*`, `depot-traductions.js`,
  `versions-structurees.js` : vide). Une traduction est une ligne `recipe_translations` liée à `recipe_version_id` ; la lecture
  (`domain/lecture-recette.js:24-72`) projette l'original ET la traduction, garde `original`/`originalLocale` par segment ; exports et cuisine
  passent par `projeterLectureRecette` (`ui/cook.js:74,110`, `ui/recipe.js:395-412`). Une traduction ne masque pas l'original. Tient.

### D9. Archives 1→7
- `SUPPORTED_ARCHIVE_VERSIONS = [1..7]` (`schema.js:10`) ; refus explicite d'une archive trop ancienne pour son contenu (`backup.js:328-334`) ;
  `verifyRestored` compare tous les magasins archivés y compris les champs réservés normalisés (`backup.js:661-739`) ; `missing_files`
  déclarés et comptés (`351-358`, `summary.files_distants`). Tient — **sauf A1** (archive refusée après purge) et **B3** (export impossible sur
  fiche invalide) ; et `createArchive` n'avertit que sur les relations (`240`) alors que l'inspection les refuse : une archive peut être
  produite sans être restaurable.

### D10. Horloges
- Écritures synchronisées horodatées par `syncNow()` (plancher monotone, `sync/clock.js:14-18`) dans `save`, `saveBatch`, `transitionner`,
  `muter*`, `commanderCycle*`, tombales (`outbox.js:76`), clôtures (`imports-clos.js:35`). Brutes : B6 (cuisine) et les cas sans effet listés là.

---

## E. Preuves et limites de cet audit
- Script : `rapports/synchro/_check-schema.mjs` (sortie reproduite en D2). Tests Node de la copie : 271/271 verts (`audit/node-tests.log`) —
  ils ne couvrent ni les scénarios A1/A2 ni les suites navigateur (`tests/index.html`), non exécutables ici.
- Non lu en profondeur : `sync/fichiers.js` (416 l., lot G antérieur), `domain/transferts-source.js`, `ui/index-livre.js`, les triggers L7/L8
  SQL ligne à ligne (lus par grep ciblé). Rien n'y contredit les constats ci-dessus, mais ils peuvent en cacher d'autres.
- Vérifications recommandées avant correctif (navigateur) : (1) poser un fragment `index_storage` daté de 31 jours, lancer `repo.init()`, puis
  `inspectArchive(createArchive())` ; (2) deux moteurs, édition hors ligne sur B + retrait sur A, forcer une passe de réception avant l'envoi
  du `put`, relire `sync_conflicts['recipes:<id>'].local` après l'accusé.
