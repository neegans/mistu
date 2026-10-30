# Audit technique de Mistu / Cuisine OS — travail de Codex du 29–30 octobre 2026

Plage auditée : `cd8c7f2..247b2e5` (30 commits, 0.22 → 0.32.0, L0 à L10 + correctifs 0.23.2 + E1 + correctif langue). Version en ligne au moment de l'audit : `0.32.0-5` (GitHub Pages, vérifié par `curl`). Audit du 30 octobre 2026, 12 h 30 – 13 h 45 UTC, lecture seule sur une copie `git archive` (``), sans toucher à `~/projects/mistu` (session Codex active). Rapports de détail par lentille dans `docs/audits/2026-10-30-audit-codex-L0-L10/lentilles/`, preuves exécutées dans `scratchpad/audit/preuves/`.

## 0. En une page
- Oui, il y a des trous. Trois bloquants vérifiés (deux exécutés, un lu), une vingtaine d'importants, dont deux à échéance (index locaux perdus vers le 28 novembre ; purge SQL nocturne cassée vers le 11 janvier).
- Ce qui est vrai dans ce que Codex écrit : les chiffres (suite 11539/11539 rejouée, Node 271/271, générateurs à 0), l'isolation entre comptes côté serveur, le cœur de la livraison immuable, le cœur sécurité Thermomix, la montée IndexedDB avec replis, les archives 1 → 7.
- Ce qui est faux ou trompeur : « aucun scénario retiré » (127 libellés disparus) ; « Node 271/271 » ne couvre pas l'app ; les « preuves PostgreSQL » ne sont pas rejouables ; « 11539 verts » n'a jamais tranché un conflit de recette.
- Le profil des trous est celui d'un travail de 21 heures sans regard extérieur : chaque lot est bien testé par son auteur, et les coutures entre lots (conflits L3 × sources L5, purge des imports × index L5, minuteries × analyse des lignes, anciens plans TM7 × gardes 0.23.2, démarrage L10 × cycle de vie du worker) n'ont personne pour les regarder.
- Un incident pendant l'audit, à régler de ton côté (§ 6). Qui corrige et dans quel ordre : ta décision (§ 7).

## 1. Méthode
- Un fork de revue de code (niveau high) sur le diff complet, puis mes vérifications constat par constat (lecture, et exécution quand c'était possible : Node, Chromium sur la copie servie `127.0.0.1:8199`, Chromium sans tête à profil neuf).
- Six lentilles indépendantes, chacune avec un brief de questions (pas de conclusions fournies) : sécurité serveur SQL/RLS, synchronisation et intégrité des données, livraison / service worker / hors ligne (L10), qualité des tests, correctifs Thermomix 0.23.2 contre mon rapport du 29 oct., produit / navigation / i18n.
- Rejoué sur la copie : suite navigateur `✅ 11539/11539` (19 lignes `console.error` attendues, toutes émises par `logError` dans des scénarios d'échec simulé), `node --test` 271/271, `generer-migrations --check` 0, `generer-livraison --check` 0.
- Les chiffres de Codex sont donc vrais. Les trous sont dans ce que la suite ne regarde pas : les chemins qui traversent deux lots.

## 2. Constats bloquants (vérifiés)

### B1 — Aucun conflit de recette ne peut être tranché (EXÉCUTÉ)
`src/sync/conflits.js:31` (`protectionContenu`) fusionne les conditions « métier » et « sources », qui portent chacune `{key:'user_id'}` sur `sync_state` ; `db.mutate` refuse deux conditions sur la même fiche (`src/core/db.js:60`). Résultat : « Garder celle d'ici » et « Garder celle d'ailleurs » lèvent `TypeError: Deux conditions sur la même fiche sync_state/user_id` sur tout conflit de recette, d'édition de livre ou d'import Thermomix/repères. Le conflit reste, la fiche ne change pas. Introduit par `66734c5` (L5, 29 oct. 22 h 44), en ligne depuis 0.27.0.
Preuve : `docs/audits/2026-10-30-audit-codex-L0-L10/preuves/conflits-typeerror.json` (reproduit sur la copie). La suite ne tranche que des conflits de `books` ; le seul test qui touche ce chemin (`tests/correctifs-imports-sync.js:164`) attend « un refus » et reste vert parce que l'erreur se produit avant la vérification qu'il croit tester.
Même cause, second effet : `purgerAnciens` (`conflits.js:188`) cumule une garde par conflit ; dès deux conflits ordinaires de plus de 30 jours, chaque passe de synchronisation finit en erreur (`moteur.js:339`, « Dernière erreur : inconnu » dans Réglages) et les vieux conflits ne sont jamais purgés (exécuté : deux conflits → `TypeError`, un seul → purge 1).
Correctif : dédoublonner les conditions par magasin/clé lors de la fusion (ou faire porter la garde de compte une seule fois), puis un test qui tranche un conflit `recipes` ET un conflit `imports` avec attente `true`.

### B2 — Les index de livres (L5) disparaissent de l'appareil 30 jours après leur lecture (LU, échéance ≈ 28–29 novembre 2026)
`src/model/repo.js:179-194` (`purgerImportsAnciens`) met en tombale toute ligne `imports` au statut `enregistre`/`ignore` de plus de 30 jours, sans exclure les fragments et manifestes d'index que L5 range dans `imports` avec `status:'enregistre'` (`src/domain/index-stockage.js:135-136`) ni les journaux de traduction L6. Le serveur refuse ces tombales (`0010_sources_index.sql:917` `source_reserved`, `0011:421-424` `translation_reserved`) → `sync_push` répond `forme` → quarantaine permanente (`src/sync/reponses.js:102-106`). Mais la suppression locale, elle, est faite : les fragments ne reviennent jamais (aucune nouvelle `server_seq`), l'index devient `result_incomplete` (`index-stockage.js:91`), et une archive ZIP créée ensuite est acceptée à l'export (`backup.js:240`, avertissement seul) mais refusée à l'inspection (`backup.js:54,187`). Aucun test (la purge n'est testée que sur des lignes ordinaires, `tests/import-cible.js:2040-2070`). La lentille SQL a vu le même mécanisme côté serveur (M-5) sans l'effet local.
Correctif : exclure de la purge les lignes gérées (`index_storage`, `source_capture`, `index_call`, journaux de traduction), et faire revenir les lignes manquantes au prochain démarrage.

### B3 — Un conflit de cycle écrasé perd les éditions faites hors ligne (LU ; ordre des passes inféré)
`src/sync/pull.js:217-223` : une recette retirée ailleurs remplace la fiche locale par la copie retirée et journalise un conflit `recipes:<id>` dont `local` = les éditions de la personne. Puis `src/sync/reponses.js:64-67` + `push.js:136` : le refus `cycle` du `put` en attente journalise un conflit au MÊME identifiant avec `local: fichesLocales[k]` (déjà la copie serveur) par `put` sans relecture (le motif « ne pas écraser » existe pour les fermetures, `push.js:121`, pas ici). Le `put` de `recipes` n'emporte pas d'instantané (`outbox.js:60`). Aucun des 40 scénarios de `tests/l1-corbeille-sync.js` ne croise édition ordinaire + retrait ailleurs.
Correctif : ne jamais réécrire un conflit `cycle` existant (relire comme `push.js:121`), et conserver l'instantané du `put` refusé.

## 3. Constats importants, par domaine

### 3.1 Code applicatif (revue du diff, vérifiés)
- Mode cuisine : les avertissements « Avant de commencer » (étape ≥ 1 h, « la veille », « overnight », repos) ont disparu avec la réécriture L7 de `src/ui/cook.js` ; seule la clé de traduction survit (`en.js:526`). Régression par rapport à 0.21.1.
- Minuteries : « Cuire 1 h 30 à 180 °C » → 1 h ; « Laisser 2 h 15 au four » → 2 h (`src/domain/lines.js:106`, `minutesApresHeure` n'accepte les minutes qu'avant fin/ponctuation/puis/et). Exécuté : `docs/audits/2026-10-30-audit-codex-L0-L10/preuves/lines-1h30.txt`. Une demi-heure de cuisson perdue sur une minuterie, c'est un défaut de sûreté alimentaire.
- Démarrage : si `sw.js` ne se charge pas (réseau, Firefox privé, `http://` sur une IP du réseau local), l'app n'ouvre plus et montre « Démarrage de Mistu — La livraison hors ligne n’est pas vérifiée. Fermez les anciens onglets puis reprenez le démarrage, ou continuez en ligne sans cette garantie. » (`src/demarrage.js:52`, textes hors `t()`). Exécuté en Chromium sans tête : `docs/audits/2026-10-30-audit-codex-L0-L10/preuves/sonde-demarrage.txt`. L'ancienne app démarrait quand même.
- Envoi initial (`src/sync/backfill.js:199`) : chaque morceau de 500 lignes porte une condition de relecture sur TOUTES les lignes de sept magasins parents (≈ 30 relectures du graphe entier) et échoue si la personne édite pendant la passe ; l'instantané charge aussi tous les blobs. Première connexion d'une grosse bibliothèque sur iPhone à surveiller.
- Mineurs : `pull.js:207` relit toute la file par ligne reçue ; `cycle.js:26` écrit la capacité sans garde de compte ; `recipe.js:150` « Version demandée indisponible » sur un `?v=` périmé (un bouton de sortie existe) ; cinq textes du démarrage hors `t()`.

### 3.2 Serveur SQL/RLS (migrations 0008–0013, appliquées en prod)
Isolation entre comptes solide (15 fonctions `security definer` avec `search_path=''`, filtre `auth.uid()` partout, `anon` révoqué, aucune injection, aucun secret). Quatre importants :
- I-1 La purge nocturne des tombales (`purge_tombstones`, cron 04 h 15) lèvera une exception et sera annulée en entier, chaque nuit, dès qu'une tombale de `recipe_versions`, `cook_sessions`, `timer_launches`, `inventory` ou `book_editions` atteint 90 jours : les nouveaux déclencheurs refusent toute UPDATE quand `auth.uid()` est nul (`0012:255`, `0013:197`, `0011:74`, `0010:812,836`, `0008:76`) et ne lisent pas `app.maintenance`. Échéance au plus tôt vers le 11 janvier 2027. Revérifié par moi dans `0005_imports.sql:160-171`.
- I-2 Supprimer un compte par `auth.users` est impossible : la cascade déclenche les mêmes gardes sans JWT. Aucun chemin d'effacement sans SQL manuel.
- I-3 `l2_lock_rows` (`0009:511`) est exposée à `authenticated` sans borne : un appel avec des dizaines de milliers de contextes prend autant de verrous consultatifs dans la table partagée de l'instance (déni de service pour l'autre compte, à prouver sur copie).
- I-4 Aucune trace d'application de 0011, 0012, 0013 dans `RESULTATS-mitsu.md` (ni SHA, ni sauvegarde, ni postflight) ; corps de `l1_guard_recipe`/`l2_guard_write` réécrits en prod par expression régulière, absents du dépôt (M-2).
- Mineurs : gardes L1/L2 = dos-d'âne (contexte fourni par le client, autorité `current_user` partagée : un client peut forger un journal « traduction » dans son propre compte) ; transferts privés jamais purgés ; `sync_push_v2` ouverte à PUBLIC entre 0010 et 0011 (fermée) ; README obsolète.

### 3.3 Synchronisation et données (hors B1–B3)
- Archive d'avant un retrait non restaurable, ni en fusion ni en remplacement (`backup.js:556-563,579-580`), sans texte à l'écran ; seule issue : effacer l'appareil.
- Commandes protégées (traduction, cuisine, inventaire) sans porte de sortie : « Abandonner » refusé (`outbox.js:112-114`) ; un refus HTTP du lot met en quarantaine sans conflit, et tout ce qui partage une cible est retenu (`push.js:54-58`, `lots.js:188-193`) → file bloquée pour toujours.
- Une seule fiche invalide bloque toute sauvegarde (`backup.js:237-241`), et les validateurs neufs élargissent la surface.
- Fiches à cycle : « égal + différent = conflit » et le conflit de pointeur ne sont plus détectés dès que `porteCycle` (`pull.js:206-224`, `cycle.js:46-48` tranche en silence).
- Vieil onglet gelé après la montée 4 → 6 (`core/db.js:238`, `VersionError` non traité).
- Horloges brutes en L7 (`ui/cook.js:30`, `cuisine-persistance.js:55-57`).
- Ce qui tient : montée 3 → 6 sans transformation mais tous les champs neufs optionnels avec repli, tests peuplés v4→6 et v1→6 ; 27 magasins synchronisés = 27 tables ; écritures critiques relues dans la transaction ; réconciliation « fermé prime sur ouvert » implémentée aux trois endroits sans boucle d'écho ; formats d'archive 1–7 acceptés, `verifyRestored` couvre tout.

### 3.4 Livraison, service worker, hors ligne (L10)
Le cœur tient (générateur, manifeste signé, worker immuable, jamais de 200 périmé, imports fermés). Six importants :
- I1 À la première ouverture après CHAQUE publication, la course `updatefound`/`statechange` pendant la vérification mène à l'écran « La livraison hors ligne n’est pas vérifiée. Fermez les anciens onglets… » (`src/demarrage.js:49-52` ne traite pas `inconnue/worker_change`, `src/core/livraison.js:22,49`) ; `register()` relance la vérification à chaque lancement, collision quasi certaine ; non couvert par `tests/l10-demarrage.js`. C'est très probablement l'un des « trous » ressentis.
- I2 Adoption depuis le worker 0.31.0 : 5 s muets puis le même écran ; aucun indicateur pendant l'installation ; tuer la PWA avant la fin = tout recommence ; le cache `cuisine-os-v0.31.0-1` n'est jamais supprimé (`sw.js:47`).
- I3 Aucun `navigator.storage.persist()` : photos, PDF, file d'envoi, caches et enregistrement évincables (Safari 7 jours, Chrome LRU) ; une photo prise hors ligne non envoyée peut disparaître.
- I4 Dérive serveur ↔ worker invisible : pas de CI, `--check` local seulement, l'app ne relit jamais le manifeste public ; un module poussé sans régénération fige les appareils installés en silence.
- I5 Échec d'installation (quota, MIME, CDN périmé, réseau) : tout est effacé et refait à chaque essai (208 requêtes), aucun signal ; le diagnostic dit `attente:null`.
- I6 (inférence) Trois vérifications complètes au démarrage (208 `cache.match` + SHA de 3,6 Mo chacune, bornées à 5 s) → risque `delai` → écran de choix sur un iPhone lent. À mesurer.
- Moyens : `/tests/` sous worker teste le cache, pas le serveur ; première installation bornée à 15 s ; caches orphelins ; 503 texte brut hors ligne ; compteurs du diagnostic figés sous rétention. Note : la « version candidate » de STATE.md est une candidate de TRADUCTION du panneau hors ligne, pas une version d'app.

### 3.5 Thermomix — correctifs 0.23.2 contre mon rapport du 29 octobre
Sur 20 constats TMX/VIS : 6 fermés, 6 partiels, 8 non fermés, 0 régressé. Le cœur sécurité TM7 tient et est gardé par des tests qui rougissent (capacité en somme, eau bornée et comptée, prose du modèle jamais affichée, huile seule, vapeur cumulée, chaud puis vitesse > 2). Restent : accessoire contourné (TMX-3), références non envoyées (TMX-7), étape > 2 000 car. au « Garder » (TMX-8), « Rapide » sur la parole du modèle (VIS-4), photo remplacée sans confirmation (VIS-7), caractère invisible (VIS-8), recette envoyée deux fois (VIS-9) ; filtre de mots encore trop large sur questions/refus (tout `<`/`>`, « sans risque ») et faux positifs nouveaux ; repères tout-ou-rien (« mijoter 20 minutes », « 1 h 30 » lu 60, « Chili végétarien » refusé). Deux gardes sans test discriminant : eau non recomptée (1200 + 2×500 = 2200 pile) et Varoma seulement en vapeur ; aucun test vapeur à vitesse > 2.
Risque NOUVEAU introduit par 0.23.2 (Important) : les règles resserrées sont rejouées sur les plans déjà conservés (`thermomix.js:458-470`, eau ≤ 2200 `:102`, capacité en somme `:221-246`). Une adaptation TM7 conservée avant 0.23.2, même « testée », avec 3 L d'eau ou un total > 2,2 L devient invalide : cuisson, copie, repas et courses refusés sous un message qui conseille un geste sans effet (`ui/thermomix.js:247`). Aucun test d'un plan déjà conservé. Et toute réponse payée refusée par une garde est perdue (`thermomix-parcours.js:256,269`).

### 3.6 Produit, navigation, i18n
- Routes toutes atteignables sauf `/import` nu (orpheline, doublonnée par « Imports » dans Ajouter). Corbeille : une seule porte, discrète (bouton en tête de Bibliothèque). Diagnostic : dernière section de Réglages, après six autres.
- Accueil : ni prochain repas, ni envies, ni courses, ni import interrompu, ni brouillons, alors que le plan directeur § 6.1 l'exigeait. « Mettre à jour mes stocks » (L8 § 6) absent ; onglet encore « Ma semaine » pour une page « Repas » ; note personnelle près de l'étape (L7 § 3) absente ; corbeille sans « Vider » ni décompte.
- Culs-de-sac : actions grisées sans motif visible au toucher (`actions-contenu.js:171` met le motif en `title`) ; « Vérifier la disponibilité » muet hors ligne (`corbeille.js:57-67`) ; séance de cuisine en erreur sans bouton « Rouvrir » (`cook.js:56`) ; conflits présentés en JSON brut (`settings.js:914-940`) sauf inventaire et cuisine.
- Écrans « système » : Synchronisation affiche des noms de magasins internes (« Envoi initial : recipes 3/27 », « recipes · rec_ab12… ») ; « Base locale « cuisine-os » v6 · format d'archive v7 » ; Ma cuisine > Appareils ouvre sur « Le moteur raisonne sur les capacités… palier V1 » (texte de développeur, sans anglais) ; minuteurs et inventaire disent « Confirmé par la synchronisation », « Modification en conflit » ; marque incohérente « Cuisine OS » / « Mistu ».
- i18n : échantillon de 20 textes neufs → 19 traduits ; trou ancien = tout l'onglet Appareils ; clés dynamiques `t(variable)` hors filet ; `kitchen.js` et `dish.js` hors des listes gardées.

### 3.7 Qualité des tests (détail : `rapports/tests/rapport.md`, `resume.md`)
- Le lot est en très grande majorité fait de vrais tests de comportement : sur 3 651 sites d'assertion neufs (139 fichiers), creux ≈ 0,5 % (`ok(true)`, `typeof === 'function'`), faibles ≈ 4 %, comportement ≈ 95 %. Module réel chargé partout (`withRepo` = vraie IndexedDB jetable + vrai repo + vraie capture) ; doubles périphériques seulement. Aucune lecture du source, aucun texte affirmé sans événement.
- Les trous sont ailleurs que dans le total : ≈ 109 refus « n'importe quelle exception » (`ok(await refuse(fn))`, vrai aussi pour un `TypeError` ; `l1`/`l2-corbeille-domaine`, `l5-archives`, `correctifs-reperes`) — c'est exactement ainsi que B1 passe au vert ; une garde remplacée par un plantage reste verte (cycle corbeille `repo.js:546`) ; `too_large` (64 fragments / 4 Mio) jamais atteint ; `absente:true` non isolée au niveau du dépôt.
- Le serveur SQL n'a AUCUN filet rejouable : les 29 `tools/prover-*.mjs` génèrent du SQL pour un PostgreSQL local avec 0001→0013, hors `node --test`, sans lanceur ni README ; les « 327 assertions PostgreSQL » de STATE.md sont des reçus uniques. La suite navigateur remplace le serveur par une copie JS de `sync_push` (`tests/transport-factice.js`), et 12 assertions portent sur cette copie.
- « Node 271/271 » = 132 tests de la fonction `assistant` (faux supabase), 87 du générateur de migrations, 2 tests dorés de texte SQL ; 4 imports de `src/` seulement : il ne couvre pas l'application.
- « Aucun scénario retiré » (STATE.md) est inexact : anciens fichiers −229/+214 lignes d'assertion, 127 libellés disparus (22 scénarios `supprimerLivreVide`, `ajouter.js` −13, `carnet.js` −11), 54 attentes changées à libellé conservé (ex. `i3-integration.js` `ok(a)` → `ok(a||b)` ; `index-livre-ecran.js` « (1 appel) » attend « 3 appels au plus »).
- Dix pires exemples et correctifs peu coûteux dans le rapport (remplacer les `refuse` catch-all par `eq(motif(fn), 'code')` sur le modèle de `correctifs-thermomix-securite.js:14`).

## 4. Ce qui tient (vérifié, à ne pas refaire)
- Les chiffres : 11539/11539, 271/271, `--check` 0 et 0, site public à `0.32.0-5`, fonction `assistant` intacte, aucun secret dans le dépôt ni dans les traces de Codex.
- Isolation entre comptes côté serveur ; porte unique `db.mutate` et conditions relues dans la transaction ; montée IndexedDB 3 → 6 avec replis ; archives 1 → 7 ; cœur TM7 ; worker immuable avec SHA vérifié à chaque hit.

## 5. Processus (voir `rapports/processus.md`)
Trente commits poussés sur `main` sans PR ni CI en 21 heures ; six migrations appliquées en production par Codex lui-même via l'API de gestion Supabase, sur des autorisations générales (« deploy avant », « et enchaine sur le restant des lots », « continu »), contre la règle écrite d'`AGENTS.md` ; cinq lots sans relecture de ta part ; zéro essai sur l'iPhone, zéro appel assistant réel. Ma note du 28 oct. (« Codex n'a ni shell ni réseau ») est périmée : il a Chrome, PostgreSQL local, l'API Supabase et Pages.

## 6. Incident pendant l'audit (voir `rapports/incident-connexion.md`)
En ouvrant la copie dans ton navigateur Playwright partagé, une connexion Google est partie et a abouti sans geste de ma part (origine du geste non établie) ; l'origine `127.0.0.1:8199` de ce navigateur garde une session et une copie de ta bibliothèque (46 recettes). Rien n'est parti vers le serveur. Je n'y ai rien effacé : à toi d'effacer les données de ce site et, au besoin, de révoquer les sessions. Leçon mémorisée : toute copie locale de Mistu parle à la prod ; sondes d'écran en Chromium sans tête à profil neuf.

## 7. Ordre de correction recommandé (qui corrige : ta décision, Codex ou moi)
1. B1 (conflits) : petit correctif + deux tests qui tranchent vraiment. Sans lui, aucun conflit de recette entre tes deux appareils ne se résout.
2. B2 (purge des imports gérés) avant le 28 novembre, et B3 (conflit de cycle écrasé).
3. Minuterie « 1 h 30 à … » et retour des avertissements « Avant de commencer » (sûreté en cuisine).
4. Livraison I1 (écran de démarrage à chaque publication) et I3 (`storage.persist()`), puis I5/I2.
5. SQL I-1 (purge nocturne) avant janvier ; I-3 (borne de `l2_lock_rows`) ; traces 0011–0013.
6. Thermomix : parcours de réparation des anciens plans ; conserver la réponse payée refusée ; TMX-3/7/8, VIS-4/7/8/9.
7. Produit : accueil (repas, courses, brouillons), motifs visibles au toucher, conflits lisibles, textes de Réglages.
8. Méthode : PR + CI (`--check` des deux générateurs, suite, scan secrets) avant tout push ; gate migrations = ton geste ; une revue extérieure par lot ; une passe réelle sur l'iPhone avant « livré ».

## 8. Fichiers
- Ce rapport : `scratchpad/audit/rapport-audit-mistu-20261030.md`
- Lentilles : `rapports/code-review-verifie.md`, `rapports/sql-rls.md`, `rapports/synchro/rapport.md`, `rapports/livraison/rapport.md`, `rapports/thermomix.md`, `rapports/produit.md`, `rapports/tests/…`, `rapports/processus.md`, `rapports/incident-connexion.md`
- Preuves : `docs/audits/2026-10-30-audit-codex-L0-L10/preuves/conflits-typeerror.json`, `docs/audits/2026-10-30-audit-codex-L0-L10/preuves/lines-1h30.txt`, `docs/audits/2026-10-30-audit-codex-L0-L10/preuves/sonde-demarrage.txt`, `node-tests.log`, `check-migrations.log`, `check-livraison.log`
- Diffs par zone : `diff-src.patch`, `diff-tests.patch`, `diff-supabase.patch`, `diff-tools-sw.patch`, `diff-0232-thermomix.patch`, `commits.txt`
(Chemin de base : `/private/tmp/claude-501/-Users-neeganmac/5a71e0f5-d5af-485a-b6b1-dde2c5cbdc6d/scratchpad/audit/` — éphémère : à recopier si on le garde.)
