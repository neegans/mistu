# Cuisine OS — consignes pour les sessions d'agent

- Spécification de référence : `cuisine-os-spec-v3.md` (fournie par l'utilisateur). Architecture et limites : `docs/architecture.md`.
- Application PWA **sans étape de build** : modules ES natifs sous `src/`, aucune dépendance npm. Ne pas introduire de bundler sans demande explicite.
- Langue de référence du code et de l'interface : français. Les chaînes passent par `t('texte français')`; l'anglais vit dans `src/i18n/en.js`.
- Données : IndexedDB via `src/core/db.js`; le schéma est dans `src/model/schema.js`. Toute nouvelle entité doit y être déclarée (magasin + relations) pour être sauvegardée et vérifiée à la restauration. Incrémenter `DB_VERSION` en cas d'index nouveau.
- Principes non négociables issus de la spec : l'original n'est jamais réécrit (nouvelle `RecipeVersion`); aucune quantité, durée ou compatibilité inventée; les restrictions alimentaires ne sont jamais assouplies; les états d'interface reflètent des événements réels (pas de « sauvegardé » sans écriture, pas de « minuterie démarrée » sans confirmation).
- Après modification des fichiers, mettre à jour la liste `SHELL` de `sw.js` et incrémenter `VERSION`.
- Tests du domaine : `tests/index.html` (dans le navigateur). Ne pas affirmer qu'ils passent sans les avoir exécutés.
- Ne pas committer, pousser ou déployer sans demande explicite.

## État des travaux (mémoire de session, mise à jour le 8 septembre 2026, complétée le 13 octobre 2026)

**Repères.** La spec `cuisine-os-spec-v3.md` n'est pas dans le dépôt : elle arrive en pièce jointe de la tâche VibeForge; la redemander si elle manque. Aucun AGENTS.md. L'historique des conversations précédentes n'est pas disponible : seule cette section fait foi.

**Fait.** Application complète écrite en une session VibeForge (shell et réseau désactivés) : coquille PWA, noyau (IndexedDB, routeur, ZIP, SHA-256, i18n), modèle et amorçage, domaine (quantités, unités/conventions, lignes d'ingrédients, portions, régimes, courses, recherche FR/EN, plats/comparaison, accords/repas, Redécouvrir, minuteries, sauvegarde/restauration, exports, abstraction IA), 15 vues (`src/ui/`), `sw.js`, `tests/`, `README.md`, `PROJECT.md`, `docs/architecture.md`, `docs/raccourci-minuterie.md`. Aucun commit : tout est en modifications non validées sur `main`.

**Première exécution réelle, 8 septembre 2026.** Serveur lancé par Neegan (`python3 -m http.server 8080` depuis le dossier du projet, en arrière-plan). `tests/index.html` : **73/73 réussis**. L'app démarre; Aujourd'hui, Mes livres, Ma semaine, Ma cuisine et Réglages s'affichent sans erreur visible (rapport de Neegan sur Mac, navigateur non précisé). Vérification statique préalable : tous les imports nommés correspondent à un export existant, aucun import dynamique, liste `SHELL` de `sw.js` complète, drapeau `u` présent sur les trois regex `\p{M}`. Reste à dérouler avec de vraies données : livre → photos → index → recette → recherche → cuisine → sauvegarde → restauration dans une base vide.

**Risques repérés pendant l'écriture, à vérifier en priorité.**
- ~~`src/domain/units.js` et `src/ui/recipe.js` : repli des accents via `/\p{M}/gu`~~ Levé le 8 septembre : drapeau `u` présent, tests passés.
- `src/domain/search.js` : une recette sans `type` est exclue d'une recherche typée (« salade »); les références d'index ne remontent que si leur titre contient un mot de la demande, un libellé FR/EN d'un ingrédient demandé ou un mot du type.
- `src/ui/recipe-edit.js` : la vue la plus dense (analyse des lignes, IA facultative, sauvegarde de version); tester extraction, correction, adaptation et traduction.
- `src/domain/backup.js` : gate V0 = restaurer dans une base vide avec mêmes identifiants et empreintes; `verifyRestored` doit rapporter zéro écart.
- `src/domain/llm.js` : fournisseurs OpenAI-compatible et Anthropic écrits sans appel réel.
- ~~`manifest.webmanifest` : icône SVG seulement, pas d'`apple-touch-icon` PNG (fichier binaire à ajouter).~~ Levé le 12 octobre : `icons/apple-touch-icon.png` (180 × 180, opaque) généré par `tools/make-apple-touch-icon.py` (Python standard, formes de `icons/apple-touch-icon.svg`, variante pleine sans coins arrondis), câblé dans `index.html`, le manifeste et `SHELL`. La vignette `qlmanage` avait été écartée : marge blanche visible.
- Dictionnaire anglais partiel (`src/i18n/en.js`).

**Décisions prises (ne pas rediscuter sans raison).** PWA sans build et local-first plutôt que Supabase pour V0; adaptations = `RecipeVersion` (pas de table à part); libellés FR/EN embarqués dans `dishes` et `ingredients`; `contains: null` = inconnu pour les régimes; conversions volume↔masse seulement par équivalence documentée par ingrédient; références d'index = `availability: reference_only` sans version; minuterie confiée au système, jamais à un compteur JS.

**En cours (8 septembre 2026).** Parcours V0 avec de vraies données sur Mac. Neegan a reçu les étapes 1 à 4 : Ajouter → « Ajouter un livre » (ISBN + « Identifier », ou titre à la main) → fiche livre → « Photographier des pages » (sur Mac : sélecteur de fichiers) → séance de scan → cocher la page d'index → « Index / table des matières » → lignes « Titre — 132 » → « Créer les références » → « Terminer la séance » → photos d'une recette → « Regrouper en recette » → saisie du titre, des ingrédients et des étapes → « Analyser les lignes » → cocher « Vérifié » → « Enregistrer la recette ». **Aucun retour reçu encore sur ces étapes.** Ensuite : recherche FR/EN, mode cuisine et minuterie, note « À refaire ? », sauvegarde ZIP puis restauration dans un autre navigateur (gate V0). Sans clé IA, les boutons « … avec l'assistant IA » restent grisés : normal.

**Suite prévue.** 1) Terminer le parcours V0 ci-dessus et corriger ce qui casse. 2) Valider capture iPhone/iPad et raccourci minuterie. 3) Deux livres FR/EN + un PDF + dix recettes cuisinées (spec §20). 4) Ensuite seulement : V1 (adaptations Rapide / On se gâte / Meal prep via `LLMProvider`, moteur de salubrité, lots congelés liés aux cuissons).

**Contexte de travail avec Neegan dans ce terminal.** Le shell est désactivé côté agent : Neegan exécute les commandes en les préfixant par `!` placé en tout premier caractère de la ligne. Donner des commandes sur une seule ligne, sans retour à la ligne, et **sans caractères non ASCII** (le commit `a7f323f` a un message aux accents déformés en « √¥ » : rédiger les messages de commit sans accents). Les adresses `http://…` s'ouvrent dans le navigateur, pas dans zsh : proposer `! open http://localhost:8080/`. L'agent ne voit pas l'écran : demander le texte des pages (Cmd-A, Cmd-C) ou des cartes rouges d'erreur. Serveur local lancé en arrière-plan depuis le dossier du projet : `cd ~/projects/mistu && nohup python3 -m http.server 8080 > /dev/null 2>&1 &`; contrôle `curl -sS http://localhost:8080/tests/ | head -5`; arrêt `pkill -f "http.server 8080"`. **Depuis le 12 octobre**, une session d'agent avec shell lance aussi la suite elle-même par Playwright MCP (`browser_navigate` vers `http://localhost:8081/tests/?v=…`, puis `browser_evaluate` sur `#out h2` et `browser_console_messages` niveau `error`) : **purger le cache du navigateur par CDP (`Network.clearBrowserCache`) avant chaque passage**, parce que le paramètre `?v=` de la page ne se propage pas aux modules importés et qu'un `304 Not Modified` sur `tests/sync.js` fait passer une version périmée pour le résultat du jour.

### Compte et stockage distant — L1-L2 livrés (13 octobre 2026)

**Où.** Branche `compte-et-stockage-distant`, worktree `~/projects/mistu-sync` (jamais `~/projects/mistu`, l'arbre
principal servi sur 8080). Serveur de vérification : `python3 -m http.server 8081` depuis le worktree ; suite complète
`http://localhost:8081/tests/`. Spec du lot : `docs/spec-compte-et-stockage-distant.md` (**§ 11** : ce que la
construction a amendé — le brief disait § 10, déjà pris par « Traçabilité des revues »). Plan et journal : `.superpowers/sdd/2026-10-12-compte-et-stockage-l1-l2/` (`progress.md`, un rapport et une
revue par tâche).

**Livré — L1 (serveur, en fichiers).** `src/sync/tables.js` (schéma serveur dérivé du schéma local),
`src/sync/mime.js` (liste blanche fermée), migrations **générées** `supabase/migrations/0001_tables_et_regles.sql` et
`0002_stockage.sql` par `tools/generer-migrations.mjs` (`--check` garde la concordance), preuves SQL écrites
(`supabase/proofs/0001_tables_et_regles.sql`, `0002_stockage.sql`, gabarits `0001_hook.md` et `0001_providers.md`),
procédure d'application pas à pas dans `supabase/README.md`.

**Livré — L2 (client).** `DB_VERSION 2` avec les trois magasins internes (`outbox`, `sync_state`, `sync_conflicts`),
hors archive et hors puces ; `db.mutate` = porte unique d'écriture (`MUTATING_METHODS`, test statique) ;
`repo.clearDevice()` ; capture des écritures active (`src/sync/outbox.js`) ; `src/sync/clock.js` ;
`src/sync/config.js` ; `src/sync/auth.js` (connexion Google PKCE, retour sans `code` dans l'historique, garde de
compte, « Changer de compte sur cet appareil ») ; Réglages → section « Synchronisation » (ensemble L2) ; durcissement
(CSP + `referrer` sur `index.html` et `tests/index.html`, cadres `sandbox`, fin de `window.open`, blobs retypés,
`logError` unique) ; `src/vendor/supabase-2.117.3.umd.js` vérifié deux fois ; service worker corrigé (aucune mise en
cache d'une requête avec paramètres). `SHELL` complet et `VERSION = 'cuisine-os-v0.2.0-2'`, `APP_VERSION = '0.2.0'`.

**Vague finale de corrections (13 octobre 2026, après la revue de branche `final-review.md`).** Six constats
Important corrigés, un tranché par Neegan : **R25** `server_seq` posée par le serveur à chaque écriture (la valeur
d'un client est ignorée ; verdicts 6.10-6.11 de la preuve) · **R24** « Effacer les données de cet appareil » n'est
plus refusé pour file non vide **sans compte** · **R26** amorçage horodaté + passe unique sur les fiches d'avant le
lot (garde `sync_state.stamp_updated_at`) et **montée `DB_VERSION` 1 → 2 sur base peuplée réellement testée** ·
**R27** décocher « Synchroniser mon historique » vide la file de ses entrées `library_activity` · **R28**
`demarrerSync({ auth, delaiMs })` borne le démarrage et rattrape l'affichage si le résultat arrive tard · **R29**
(décision de Neegan) I6 précisé en spec § 11 : aucune adresse ni clé dans le dépôt, prénom et domaine assumés
publics, rien n'est retiré. Les deux gestes destructeurs (`changerDeCompte`, `effacerDonnees`) sont désormais des
fonctions exportées à dépendances injectées, et testées.

**Vague des résidus `/verify` (13 octobre 2026).** Trois lentilles adverses indépendantes (correctness, sécurité,
faux-vert) ont relu la branche après la revue finale ; leurs six constats sont corrigés : **R31** le remplacement
d'une archive est refusé dès qu'une entrée d'outbox existe, connecté ou non, la file relue au moment du geste
(`restaurerArchive`, spec § 5.2) · **R32** compteur de générations dans `state.js` : un résultat tardif du démarrage
n'écrase jamais un état posé depuis par `auth.onChange`, et un travail tardif qui échoue lève l'attente
(`sync_boot_failed`) au lieu de figer « Vérification du compte… » · **S1** `config.js` passe à une **liste blanche
d'hôtes** (plus de repli silencieux sur `prod`) · **S2** la tombale `deleted_at` est **figée** par
`touch_server_seq` hors `app.sync_push` (preuve 0001, verdicts 6.12-6.14) · **F1** `--dir <chemin>` au générateur,
et `--check` enfin éprouvé par `spawnSync` sur une copie altérée · **F2/F3** le test des écritures directes vérifie
qu'il a lu `SHELL` (51 modules), et la comparaison d'empreintes de `verifier-vendor.mjs` est une fonction pure
exportée (`comparerEmpreintes`, 4 tests). Mineurs : horloge remise à 0 en `finally`, stub de `console.error` du test
R28 en `try/finally`, amorçage des 96 références par une origine que la capture ignore. Registre des décisions :
spec **§ 11** (R1 à R32, plus S1 et S2).
Suite complète : **422/422 verts**, 0 erreur console (13 octobre 2026, `http://localhost:8081/tests/?v=vert-residus`) ;
outils `node --test tools/*.test.mjs` : **40/40**, `node tools/generer-migrations.mjs --check` : **0**.
`sw.js` : `VERSION = 'cuisine-os-v0.2.0-3'` (aucun module neuf : `SHELL` inchangé).

**Preuves SQL : NON JOUÉES.** La tâche 5 du plan est **parquée** : elle demande un projet Supabase qui n'existe pas
encore. Geste de Neegan : créer le projet de développement **`mistu-dev`** (D8, région Canada), puis suivre
`supabase/README.md` étape par étape (coller `0001` sans sa dernière ligne, activer `pg_cron`, coller la ligne
`cron.schedule`, taper les adresses autorisées, jouer la preuve `0001`, coller `0002`, jouer la preuve `0002`,
brancher le crochet « Before User Created », fermer les autres fournisseurs) et **coller les sorties** dans
`supabase/proofs/RESULTATS-mistu-dev.md` (à créer ; sans adresses, sans clés). Tant que ce fichier n'existe pas,
aucune ligne de `0001`/`0002` n'a jamais été exécutée par personne : le serveur est écrit, pas éprouvé. Le projet
réel `mistu` vient **après**, et seulement si `mistu-dev` est vert.

**Mesure iOS : à faire par Neegan, avant L3.** Spec § 4.1, dernier alinéa : une PWA installée a son propre conteneur
de stockage. Installer Cuisine OS sur l'écran d'accueil de l'iPhone, lancer « Activer la synchronisation » et
regarder **où atterrit le retour de Google** — dans l'app en plein écran, ou dans Safari. Consigner ici la version
d'iOS et le chemin constaté. Si le retour atterrit dans Safari, `signIn()` devra passer à `skipBrowserRedirect: true`
et ouvrir l'URL obtenue **sur le geste de la personne**. Cette mesure conditionne L3.

**`src/sync/config.js` : à remplir.** Trois champs par entrée : **`url`**, **`anonKey`** et **`hosts`**. `prod` est
vide (`url: ''`, `anonKey: ''`, `hosts: []`) ; `dev` n'a que ses hôtes (`localhost`, `127.0.0.1`). Y mettre l'URL du
projet et la clé **`anon`** — publiques par conception, commitées. **Jamais `service_role`**, nulle part. Depuis S1,
`hosts` est une **liste blanche** : `currentConfig(hostname)` ne rend une entrée que si l'hôte y figure (comparaison
exacte, en minuscules), donc **l'hôte du sous-domaine (D5) s'ajoute dans `prod.hosts` en même temps que l'URL et la
clé** — sans quoi la synchronisation restera désactivée là-bas. Tant qu'une entrée est vide ou l'hôte inconnu,
`currentConfig()` renvoie `null` et Réglages affiche « Synchronisation non configurée sur cette adresse. » :
c'est exactement ce que l'app montre aujourd'hui, sur les deux origines.

**Origine dédiée (D5) : pas faite.** Tous les sites GitHub Pages du compte partagent l'origine
`neegans.github.io`, donc `localStorage`, IndexedDB et caches. Décision prise : un sous-domaine d'un domaine de
Neegan, par CNAME vers GitHub Pages. **Reste à faire : nommer le sous-domaine** (Neegan), poser le fichier `CNAME`,
forcer HTTPS, puis faire suivre `redirectTo`, Site URL et Redirect URLs de Supabase, les origines du client OAuth
Google, `manifest.webmanifest` et `SHELL`, et réinstaller l'icône iPhone. **Aucune connexion réelle depuis
`neegans.github.io`** tant que le CNAME n'est pas actif.

**Dettes différées (assumées, à reprendre en L3).** Pastille « N non envoyés » dans l'en-tête ; dans `tests/sync.js`,
les stubs qui remplacent `console.error` **dans la section « Connexion »** ne sont toujours pas posés en
`try/finally` (un échec en cours de bloc laisserait le stub en place) — ceux des blocs R28 et R32 le sont depuis la
vague des résidus ; le `catch` de `getSession` d'`auth.js` n'est pas testé. **Mesuré le 13 octobre** : les **411**
chaînes `t()` de `src/ui` sans entrée dans `src/i18n/en.js` sont **toutes antérieures** au lot — les 31 chaînes
ajoutées par le lot sont traduites ; les deux seules qui manquaient (`t('Code : {c}')` et `t('Recharger')`) sont
posées. Le pluriel de « N envois en attente » est corrigé (R27/R24, vague finale), celui du refus de remplacement
aussi (R31).

## Premier lot de fiabilisation — 8 septembre 2026, à réviser

À la suite d’un audit statique, l’utilisateur a autorisé le premier lot consacré à la sauvegarde/restauration. Modifications effectuées uniquement via MCP vibeforge_files, avec écritures conditionnées au SHA-256 ; aucun shell, réseau, build, test exécuté, commit ou déploiement.

- db.js : instantané multi-magasins dans une transaction de lecture ; vidages et écritures groupés, annulation explicite sur exception synchrone, attente de la fin réelle après erreur asynchrone.
- schema.js / backup.js : relations imbriquées/tableaux complétées, validation stricte des archives, restauration atomique, comparaison du contenu JSON et des fichiers, règles distinctes fusion/remplacement. En fusion, les métadonnées locales des fichiers existants sont préservées.
- zip.js : contrôles de limites ZIP standard, en-têtes, tailles et chemins dupliqués.
- settings.js / i18n : archive « générée » sans prétendre connaître la fin du téléchargement ; bilan de restauration conservé, commandes obsolètes désactivées jusqu’au rechargement explicite.
- tests/backup.js ajouté et intégré à tests/tests.js : bases temporaires exclusivement, aller-retour, réimport, corruption/archives invalides, annulation sur DataCloneError et ConstraintError, comparaison du contenu et des secrets. Ces tests sont écrits mais **non exécutés** ; le résultat 73/73 cité plus haut précède ce lot et ne le valide pas.
- sw.js : version du cache incrémentée, modules de production déjà présents dans SHELL ; tests chargés à la demande.

Cas ancien repéré : supprimer un livre vide peut laisser une activité/préférence orpheline. Ce lot ne répare pas ces données automatiquement. L’export conserve une copie en signalant les relations incohérentes ; la restauration est refusée jusqu’à résolution. Les gros ZIP restent en mémoire et un quota réellement épuisé reste à vérifier sur appareil.

Suite immédiate : révision utilisateur, exécution de tests/ dans le navigateur puis essai ZIP dans un autre navigateur à base vide, en conservant la bibliothèque source. Les défauts culinaires et les améliorations iPhone identifiés par l’audit restent dans les lots suivants.

## Hébergement — 12 octobre 2026

Objectif de Neegan : utiliser Cuisine OS comme application de capture installée sur l’écran d’accueil de l’iPhone (PWA), donc servie en HTTPS.

- Premier commit du code : `d9ba34e` (57 fichiers), par Neegan via `!`. Dépôt **public** `neegans/mistu` créé avec `gh repo create --public --push` ; GitHub Pages activé sur `main` / racine ; site `https://neegans.github.io/mistu/`, statut `built` confirmé par `gh api`. Commits signés `neegan@oraquan.com` (adresse publique, choix assumé).
- Ajouts : `.nojekyll`, `icons/apple-touch-icon.svg` + `.png`, `tools/make-apple-touch-icon.py` (générateur du PNG, hors `SHELL` : ce n'est pas un fichier de l'app), lien `apple-touch-icon`, entrée PNG dans le manifeste, `SHELL` et `VERSION` (`-3`) de `sw.js`.
- Le site n’a pas de backend : les scans et recettes restent dans IndexedDB de l’appareil. `https://neegans.github.io` est une origine distincte de `localhost:8080` : bibliothèque vide au premier lancement, à remplir par restauration d’un ZIP (AirDrop depuis le Mac). Ce transfert constitue aussi le gate V0 sur un second appareil.
- Mise à jour de l’app installée : `git push` sur `main`, puis relancer l’app (service worker réseau d’abord ; un `VERSION` incrémenté purge l’ancien cache).
- `https://neegans.github.io/mistu/tests/` exécute la suite complète, y compris le lot sauvegarde ; aucun résultat reçu à la date de cette note.
