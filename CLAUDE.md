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

**Serveur APPLIQUÉ ET PROUVÉ — un seul projet, `mitsu` (13 octobre 2026, R33).** Neegan a révoqué D8 (un second
projet coûte 10 $ par mois sur l'organisation Pro) : **`mitsu`** (`https://ybdooerfeziiabsbfxtb.supabase.co`, Canada
Central) sert à la fois le site et le poste de travail. Collages joués par Neegan dans l'éditeur SQL entre 11 h 17 et
11 h 29 : `0001` sans la ligne `cron.schedule`, puis `cron.schedule` (tâche 1), adresses autorisées, preuve `0001`
(**76 verdicts, 0 faux**), `0002`, preuve `0002` (**11 verdicts, 0 faux**), retrait des deux adresses de preuve.
Sorties dans `supabase/proofs/RESULTATS-mitsu.md` — avec le piège du dialogue « Run and enable RLS » du tableau de
bord, qui ajoute un `alter table` **après** le `rollback` de la preuve : toujours « Run without RLS ». Crochet « Before
User Created » **ENABLED** (`public.before_user_created`, 15 h 13, `proofs/0001_hook.md`) ; fournisseurs : **Google
seul** (client OAuth du projet Google Cloud `cuisine-os-neegan`, écran de consentement External en statut Testing, deux
Test users), Email/Phone/Anonymous éteints, Confirm email allumé, contre-preuve par `GET /auth/v1/settings`
(`proofs/0001_providers.md`). `src/sync/config.js` : `prod` = `mitsu` pour l'hôte `neegans.github.io`, `dev` = `mitsu`
pour `localhost`/`127.0.0.1` — `localhost` reste donc autorisé sur le projet réel (conséquence assumée de R33 ; la
barrière reste la liste d'adresses). **Avant la première connexion réelle** : URL Configuration (Site URL
`https://neegans.github.io/mistu/` ; Redirect URLs `https://neegans.github.io/mistu/**`, `http://localhost:8080/**`,
`http://localhost:8081/**`), puis pousser. Le sous-domaine (D5) reste à faire : ajouter son hôte à `prod.hosts` avec
le CNAME. **Première connexion réelle réussie le 13 octobre à 15 h 33** (Mac, Chrome, site Pages) : « Connectée : <adresse autorisée> »,
« À envoyer : 0 » (`supabase/proofs/RESULTATS-mitsu.md`, dernière section). Reste la mesure iOS (§ 4.1) sur l'iPhone.

**Porte d'entrée livrée (13 octobre 2026, R34-R36, branche `porte-entree`).** Au démarrage, **si la synchronisation
est configurée sur cette adresse**, tant qu'aucun compte n'est connecté et que « Continuer sans compte » n'a pas été
choisi sur cet appareil, l'app s'ouvre sur un écran d'accueil plein (`src/ui/porte-entree.js` : « Kwe. », un bouton
« Connexion avec Google », un lien « Continuer sans compte ») à la place de la coquille ; ailleurs elle s'ouvre
directement sur la bibliothèque. Le choix vit dans `sync_state` (clé `porte_entree`, origine `device`), donc la porte
revient après « Effacer les données de cet appareil », et elle n'est évaluée qu'au démarrage. **R35** : le bouton
Google mémorise la route courante (`demarrerConnexion(auth)`), donc un lien profond survit au détour par le
fournisseur. **R36** : la phrase d'un retour refusé est désormais neutre — « La connexion a été refusée ou
annulée. » — parce qu'une annulation chez Google et une adresse hors liste arrivent toutes deux en `error=…`
(mesure d'un vrai refus d'adresse à faire en L3). Spec § 11, lignes R34-R36 ; suite 449/449 verte, 0 erreur
console ; `sw.js` `VERSION = 'cuisine-os-v0.2.0-7'`.

**Mesure iOS : à faire par Neegan, avant L3.** Spec § 4.1, dernier alinéa : une PWA installée a son propre conteneur
de stockage. Installer Cuisine OS sur l'écran d'accueil de l'iPhone, lancer « Activer la synchronisation » et
regarder **où atterrit le retour de Google** — dans l'app en plein écran, ou dans Safari. Consigner ici la version
d'iOS et le chemin constaté. Si le retour atterrit dans Safari, `signIn()` devra passer à `skipBrowserRedirect: true`
et ouvrir l'URL obtenue **sur le geste de la personne**. L3 a été construit **sans** cette mesure (elle ne touche
que le chemin du retour OAuth sur iOS, pas l'échange de données) : elle reste à faire **avant la première passe
réelle depuis l'iPhone**.

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
aussi (R31). La pastille, elle, est **livrée en L3** (voir la sous-section suivante).

### Synchronisation L3 livrée (13 octobre 2026)

**Où.** Branche `synchro-l3`, arbre `~/projects/mistu` (serveur `http://localhost:8080/`). Plan et registre :
`.superpowers/sdd/2026-10-13-synchronisation-l3-envoi-reception/` (`progress.md`, un brief, un rapport et une revue
par tâche ; dix tâches, chacune avec une ronde de corrections au plus). Décisions consignées en **spec § 11,
lignes R37 à R64** (dans le registre, elles s'appellent R-L3-1 à R-L3-29). `APP_VERSION = '0.3.0'`,
`sw.js VERSION = 'cuisine-os-v0.3.0-6'`, `SHELL` complet (67 entrées, huit modules de `src/sync/` de plus).

**Vague finale de corrections (13 octobre 2026, après `final-review.md` — rapport : `final-fix-report.md`).** Le
Critical et les cinq Important de la revue de branche sont corrigés, plus quatre mineurs : **R57** une suppression
est un **événement** — sa tombale porte `syncNow()` à l'instant du geste, jamais l'heure que le serveur possède
déjà (sans quoi `sync_push` la refusait en « conflit » et la suppression ne quittait **jamais** l'appareil), et le
**transport factice gagne un mode `serveur`** qui arbitre comme `app.sync_push` — c'est lui qui aurait attrapé ce
défaut tout seul · **R58** les lignes `files` **ne comptent plus** dans « À envoyer » ni dans la pastille : elles
n'entrent plus en file, l'envoi initial les écarte sans poser `backfill:files`, et `repo.init()` purge une fois
celles de L2 (**leurs octets sont L4** : le compteur que le parcours § 7.3 demande de regarder ne mentira plus) ·
**R59** `poserMoteur` ne fait plus avancer la génération de R32 (un démarrage hors ligne pouvait figer Réglages sur
« Vérification du compte… ») · **R60** `fileDe(db, userId)` : la file est filtrée par compte à l'envoi **et** dans
les compteurs (les gardes des gestes destructeurs comptent la file entière, et c'est dit sur place) · **R61** les
caractères de contrôle sont retirés **à l'écriture locale** (ils faisaient un conflit perpétuel) · **R62** une
tombale reçue obéit à I7 : plus ancienne que la fiche locale, elle ne l'efface plus en silence. Mineurs : la
pastille redevient muette à l'arrêt du moteur, une passe encore en vol ne repose plus de minuterie derrière
`arreter()`, l'en-tête de `reponses.js` et `docs/architecture.md` nomment les vraies clés, et l'assertion « un seul
vol » est épinglée sur un compte exact d'appels. **Deux compléments après re-revue** : la **restauration**
(`applyArchive`) nettoie elle aussi les caractères de contrôle — et `verifyRestored` compare la base à ce que la
restauration *promet* d'écrire, sinon le bilan d'une vieille archive passait au rouge ; et **R-L3-27** ferme les
deux dernières portes de la boucle — « Garder celle d'ici » nettoie la fiche restaurée, et `repo.init()` fait une
**passe unique** de nettoyage des fiches d'avant la vague (garde `sync_state.nettoyage_chaines`, `updated_at`
conservé, origine `device` : rien n'entre en file). **Deux derniers constats de la lentille correctness** :
**R63** un `put` dont la fiche n'existe plus ici est **retiré de la file sans aucun envoi** — en tombale, il
**écrivait au serveur** une ligne supprimée pour une fiche qu'il ne connaissait peut-être même pas (une suppression
locale explicite, elle, part toujours : R57 inchangé) ; et **R64** un conflit dont la version d'ici **repart** porte
`renvoye: true`, dit « **Version d'ici en cours de renvoi au serveur.** » (l'état réel : l'entrée est en file,
l'accusé personne ne l'a vu — I5), n'offre que « Ignorer », et se **range tout seul** dès que le serveur accuse
cette clé — lui offrir « Garder celle d'ailleurs » revenait à écraser ce qu'on vient d'envoyer par la version qui a
perdu ; **R-L3-30** ferme la course avec la réception (les deux gestes « Garder… » refusent un conflit `renvoye`
relu à l'exécution) **sauf** sur une tombale, où « Supprimer ici aussi » reste la décision que R62 a donnée à la
personne. Suite complète : **982/982 verts**, 0 erreur et 0 avertissement console, 0 réponse ≥ 400 ; `tests/backup.js` vert ;
`node --test tools` 40/40 ; `--check` 0.

**Ce qui marche** (éprouvé par la suite : **875 assertions vertes**, transport factice, bases temporaires, aucun
réseau) : l'**envoi** (file lue, dédoublonnée, relue, envoyée par lots de 500 / 900 Kio ; recul exponentiel,
dichotomie jusqu'à nommer la fiche fautive, quarantaine avec motif) · l'**envoi initial** de ce qui existait avant
la connexion (par marqueurs, reprenable) · la **réception** (pages par `server_seq`, curseur écrit dans la même
transaction, jamais reculé) · les **conflits** (I7 : plus récent gagne, égal + identique = rien, égal + différent =
à trancher ; « Garder celle d'ici » / « Garder celle d'ailleurs », purge à 30 jours) · la **pause de quota**
(l'envoi s'arrête, la réception continue ; seule « Envoyer maintenant » la lève) · le **moteur** (une passe à la
fois, déclencheurs, état figé observable) · **Réglages → Synchronisation** en entier (dernier échange, quarantaine,
conflits, progression, pause, horloge faussée, « Envoyer maintenant ») · la **pastille « N non envoyés »** dans
l'en-tête (avec un compte seulement) · la **vue recette** qui dit qu'une autre version a été créée ailleurs, sans
masquer aucune version · la **restauration d'archive horodatée** (fusion et remplacement) pour qu'une bibliothèque
restaurée reparte au serveur.

**Ce qui n'est PAS prouvé.** **Aucune passe réelle n'a été jouée contre `mitsu` avec un compte connecté.** Tout est
mesuré avec un transport factice : le vrai `sync_push`, la vraie lecture par `server_seq`, le vrai jeton et la vraie
latence n'ont jamais tourné. La **preuve sur appareils (spec § 7.3) reste à faire par Neegan**, dans cet ordre :
1) iPhone hors ligne → écrire une recette → voir le compteur « non envoyés » → remettre le réseau → la recette
arrive sur le Mac ; 2) la bibliothèque du Mac arrive **entièrement** sur l'iPhone ; 3) une suppression se propage ;
4) un conflit volontaire (la même fiche modifiée des deux côtés hors ligne) se tranche par « Garder celle d'ici ».
Tant que ce parcours n'est pas fait, « la synchronisation fonctionne » n'est pas une affirmation tenable.

**Dettes différées (assumées, nommées dans le registre).** Lectures **hors transaction** dans `appliquerPage`
(une édition faite pendant la page reçue est écrasée sans conflit — fenêtre entre deux `await` ; le remède exige un
`db.mutate` conditionnel, donc un lot à part) · `garderIci` tranche sur l'**instantané** du conflit, pas sur une
relecture · **500 `db.get` par lot** à la relecture des `put` (une lecture groupée serait mieux) · **bruit de
journal** quand la dichotomie découpe un gros lot · le **fil de `app.js`** (démarrage du moteur, pose de l'état)
reste hors test — jamais importé dans la suite, par décision : `app.js` lance l'application à l'import · la
**ré-entrance** d'un abonné de `onEtat` n'est pas gardée · `identiques` sur `files` doit comparer la liste blanche
des champs du serveur (**L4**, spec R56) · les **octets des fichiers** restent **L4**, la purge du serveur et
« Supprimer ma bibliothèque du serveur » **L5**.

**Faux rouge du montage de tests : corrigé (R-L3-17).** « Nettoyage de la base temporaire bloqué :
cuisine-os-backup-test-… » faisait échouer la suite au hasard, toujours loin de son vrai coupable. Deux causes :
`withDatabase` (`tests/backup.js`) traitait `deleteDatabase().onblocked` comme **terminal** alors qu'il est
informatif (la requête aboutit dès que la dernière connexion gênante se ferme) ; et une relecture de réglages
lancée par le bus que **personne n'attendait** rouvrait la base jetable juste après sa fermeture
(`Database.open()` rouvre dès que `idb` est nul). Désormais : attente de `onsuccess` bornée à 10 s (rejet au-delà,
en nommant la base) ; et la relecture venue du bus est différée d'un tour de boucle puis **abandonnée si plus
aucune base n'est ouverte** — en production les réglages sont toujours relus sur `settings` comme sur `change`
(`relectureEnCours()` rend la chaîne, pour qu'un test attende au lieu de deviner un délai).

### Page « Ajouter » et flux des livres livrés (14 octobre 2026)

**Où.** Branche `ajouter-livres-ux`, arbre `~/projects/mistu` (serveur `http://localhost:8080/`). Plan et registre :
`.superpowers/sdd/2026-10-14-ajouter-et-livres-ux/` (`progress.md`, un brief, un rapport et une revue par tâche ;
dix tâches, chacune avec au plus deux rondes de corrections). Spec :
`docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md` (rév. 2 ; § 15.2 « Ce que la construction a
amendé » : une ligne par ruling R-UX-1 à R-UX-16, puis la section « Vague finale de corrections » du 14 octobre —
C1-C10, S1-S13, F1-F13, T7/T9/T10, RF-I1 à RF-I4 — et les écarts assumés qui restent). `APP_VERSION = '0.4.0'`
(posée dès la tâche 1, R-UX-5, pin structurel `v0.4.0-\d+`), `sw.js VERSION = 'cuisine-os-v0.4.0-12'` (vague
finale), sept modules neufs dans `SHELL` (`puces.js`,
`livre-ajout.js`, `accueil-livre.js`, `signet.js`, `image.js`, `blob-urls.js`, `lien.js`) et `add.js` réécrit.

**Ce qui marche** (éprouvé par la suite, bases jetables, aucun réseau, gestes injectés) : la **grille** de cinq
cartes (Ajouter un livre, Photographier/importer des pages, Saisir une recette, Garder un lien web, Ajouter un lot
au congélateur — une carte sans geste câblé ne se rend pas) ; un **livre en deux pas** (ISBN scanné ou tapé → Open
Library puis Google Books en repli → fiche « à vérifier », ou saisie à la main directement) ; les **puces
« Cuisines »** partagées entre le livre et la fiche recette (choisies d'abord, puis existantes par fréquence, puis
la graine fermée de quinze cuisines, « Autre… » en texte libre, jamais dans un `<label>` depuis R-UX-8) ;
l'**accueil d'un livre ajouté** (photographier l'index ou une recette, aller à Mes livres) ; les **gestes de la
fiche** (+ Pages d'index, + Recette, reprendre une séance en cours) ; le **sélecteur avant scan** (« Ces pages vont
où ? », un livre imposé par `?edition` saute l'étape, R-UX-6) ; le **signet** (garder un lien web avec titre et
livre facultatif, adresse revalidée au rendu, hôte recalculé — jamais le `source_label` stocké, S7/R-UX-11) ; la
**couverture** (reçue par ISBN depuis Open Library, photographiée sinon, bornée avant décodage, re-encodée en
JPEG, pointeur souple `cover_sha256` sans relation d'archive, URL `blob:` révoquées, une réponse tardive appartient
à SA demande d'ISBN et ne peut plus écraser une couverture photographiée entre-temps — R-UX-12, R-UX-13, R-UX-14).

**Ce qui n'est PAS prouvé.** Aucun scan réel n'a été joué par la suite (bases jetables et gestes injectés
seulement) ; aucune photo de couverture réelle, aucun code-barres lu, aucune écriture dans la base de Neegan. La
couverture par ISBN est mesurée par `fetch` depuis GitHub Pages et depuis `localhost` (résultats ci-dessous),
jamais par un vrai scan. **Parcours réel à faire par Neegan** : ajouter un vrai livre par ISBN sur le Mac,
photographier son index depuis l'accueil, puis sur l'iPhone poser une couverture par photo et garder un lien web.

**Mesures réelles (tâches 9 et 10).** Open Library : 200 depuis `localhost` avec de vraies fiches (ISBN
`9780385533225` → « The Particular Sadness of Lemon Cake », ~500 ms). Couvertures `covers.openlibrary.org` : CORS
ouvert depuis Pages ET `localhost` (200, `image/jpeg`, 17 917 o) **mais sans `content-length`** — d'où la lecture
du corps **en flux**, coupée à 5 Mo (R-UX-12). `?default=false` ne garantit pas un 404 pour un ISBN absurde
(`0000000000000` → une image 192 × 262, inoffensive : la couverture n'est demandée qu'après identification Open
Library). Google Books : **429** sans clé — repli de métadonnées seulement, jamais de couverture.

**Dettes (assumées, nommées dans le registre).** Orphelins `files` jamais effacés (L4, aucun blob supprimé par ce
lot) — et **S13** : ce n'est pas rare, **toute identification Open Library qui aboutit écrit une ligne `files`**
(la couverture est ré-encodée et posée avant que la personne ait rien décidé), y compris quand un geste la rend
caduque pendant le ré-encodage (C1 laisse alors la ligne derrière lui, exprès) ; **RF-m13** : les fonctions de
couverture (`poserCouverture`, `recupererCouvertureParIsbn`, `renderZoneCouverture`, `messageErreurImage`) vivent
dans le module de ROUTE `livre-ajout.js` et sont importées par `book.js` — dette nommée, aucun déplacement dans la
vague finale ; **`app.js` reste hors test** par décision (il lance l'application à l'import) : la révocation des
URL `blob:` est désormais éprouvée au point d'appel de `renderLibrary` (RF-I2), jamais dans `app.js` ; `source_pages.sha256` reste une relation **latente**, jamais vérifiée à la restauration (même nature que
`cover_sha256`, pointeur souple assumé) ; les octets d'une couverture ne voyagent pas avant L4 (seule la ligne
`files` est reçue) ; D2 (pages scannées envoyées au serveur) reste ouvert ; `AbortSignal.timeout` exige Safari 16+
(repli non éprouvé) ; `displayUrl` (vignettes, PDF) crée encore des URL
`blob:` non suivies par `blob-urls.js` (pré-existant, hors lot). **Fermé le 14 octobre** : `meals.js` et
`exporters.js` recalculent l'hôte (S8, par `libelleSource` de `core/lien.js`) — S7 ne laissait plus que ces deux
surfaces ouvertes.

**Vague finale de corrections (14 octobre 2026).** Une seule vague, trois lentilles adverses plus la revue de
branche. Les dix constats de correctness (C1-C10), les onze de sécurité (S1-S13) et les faux-verts (F1-F13) sont
corrigés, avec les mineurs différés des tâches (T7, T9, T10) et la revue finale (RF-I1 à RF-I4). Les quatre
défauts qui changeaient ce que la personne OBTIENT : **C1** la garde d'une couverture distante n'était évaluée
qu'une fois, avant le ré-encodage — mesuré sur le code de `808aff8` : « ← Changer d'ISBN » puis « Saisir à la
main » pendant le ré-encodage laissaient quand même la couverture s'afficher sur la fiche saisie à la main ; un
compteur de génération, relu après chaque `await`, ferme la fenêtre (et « Saisir à la main » pendant
« Recherche… » n'hérite plus des champs de la réponse en vol) · **C3** deux identifications de suite affichaient
« Livre 1112 » sous « ISBN 2223 » · **C4** sur la fiche livre, « Enregistrer » les métadonnées effaçait la
couverture posée entre-temps (et réciproquement) : chaque geste relit l'édition · **C2** un livre anglais
identifié par Google Books était écrit `fr`. Côté sécurité : **S1** le corps JSON distant est lu en flux et coupé
à 256 Ko (`lireBornee`, la même fonction que pour les octets d'une couverture) · **S2/S6** le mur de pixels, abaissé
à **16 Mpx**, garde aussi le chemin LOCAL (une image de 400 Mpx choisie ici atteignait `createImageBitmap`) ·
**S3** `bookCover` n'affiche que des types image de la liste blanche · **D-T7** un mot de passe collé dans une
adresse n'est plus stocké (`username`/`password` retirés de l'href). Les tests attendent désormais un FAIT
(`etatRoute()` de la route) et plus un délai (F3/F4), le total d'assertions est **épinglé** (F2), et les deux
routes prennent un sac `{ repo, navigate, toast }` injecté — la charnière « Ajouter ce livre » → `?nouveau=1` est
enfin mesurée (RF-I1). Rapport : `.superpowers/sdd/2026-10-14-ajouter-et-livres-ux/final-fix-report.md`.

Suite complète après la vague finale (et son micro-correctif C3 bis) : **1378/1378 verts** (total épinglé dans `tests/tests.js` — F2), 0 erreur et
0 avertissement console (hors `apple-mobile-web-app-capable`, pré-existant et hors lot) ; `node --test
tools/*.test.mjs` 40/40 ; `node tools/generer-migrations.mjs --check` : 0. (Clôture de la tâche 10 : 1270/1270.)
Vérifié dans l'app réelle le 14 octobre, deux fois : à la clôture de la tâche 10 (service worker
`cuisine-os-v0.4.0-11`) puis **après la vague finale** (service worker `cuisine-os-v0.4.0-12` actif) —
`#/add` (les cinq cartes), `#/add/livre` (pas 1, champ ISBN ouvert, trois boutons), `#/add/signet` et `#/library`
s'affichent sans **aucune erreur de console** ni réponse ≥ 400 ; seul l'avertissement pré-existant
`apple-mobile-web-app-capable` subsiste (hors lot). Lecture seule : aucun clic de scan, aucune écriture dans la
base `cuisine-os`. La bibliothèque de ce navigateur partagé est encore **vide** (aucune fiche livre à ouvrir pour
l'instant — le parcours réel ci-dessus reste à faire).

### Identifier un livre, fiable (14-15 octobre 2026)

**Où.** Branche `isbn-fiable`, worktree `~/projects/mistu-isbn` (jamais `~/projects/mistu`), serveur de vérification
`http://localhost:8082/` (suite : `http://localhost:8082/tests/`). Spec :
`docs/superpowers/specs/2026-10-14-identifier-un-livre-fiable-design.md` (rév. 3 ; **§ 11.2** « Ce que la construction
a amendé » : P1-P3, R-ISBN-1 à R-ISBN-5, rondes de correction des tâches 2, 7 et 8, mesure D6). Plan :
`docs/superpowers/plans/2026-10-14-identifier-un-livre-fiable.md`. Registre :
`.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/` (`progress.md`, un brief, un rapport et une revue par tâche ;
lanceurs `suite.cjs` et `mesure.cjs`). Base : `main` `606fdd9` (lot UX fusionné, 1378/1378). Procédure de la clé
Google : `docs/google-books.md`.

**Ce qui marche** (éprouvé par la suite, `fetch`/attente/état en ligne/délais/clé injectés, aucun réseau) : un ISBN
mal tapé est refusé **avant** tout appel (`src/core/isbn.js` : contrôle ISBN-10/13, préfixe 978/979) ; `lookupIsbn` à
trois issues (trouvé / introuvable / indisponible avec motif délai, réseau, limite, serveur, et « hors ligne » posé
par la route) ; Open Library `search.json` d'abord, l'ancien `api/books` en filet sur un « rien », Google Books
**seulement avec une clé** et seulement après un « rien » ; une seule reprise sur un échec muet, jamais sur un 429 ou
un 5xx ; corps lu en flux et coupé à 256 Ko ; formes hostiles typées (titre chaîne non vide, contrôles et bidi
retirés) ; écran du pas 1 qui dit la vraie raison et offre **« Réessayer »** ; **Entrée = Identifier** ; une
identification à la fois (garde `recherche` + génération : une réponse tardive ou croisée n'écrit rien) ; l'édition
est écrite en ISBN-13 ou `null`, jamais une suite libre de chiffres ; **mots-clés du livre** (§ 12) : propositions
de la source étiquetées « Proposé par Open Library », puces au pas 2 et sur la fiche livre, les `tags` du livre
servent la recherche de toutes ses recettes (une référence de « Berber and Q » remonte sur « bbq »).

**Mesures réelles (15 octobre 2026, 04 h 29 UTC, `mesure.cjs`, Chrome sans tête, contexte neuf, réseau réel).** Open
Library a répondu à tout (aucune panne). Sortie lue ; extraits : des lignes entières sont omises sans marqueur, les
champs coupés à l'intérieur d'une ligne sont marqués « ... » :

```text
=== (1) 9781785035289 + Entree
  duree 513 ms ; pas 2 ; isbn 9781785035289 ; resultat null ; validation null
  champs : titre « Berber and Q » ; auteur « Josh Katz » ; editeur « Ebury Publishing » ; annee 2018 ; langue en (menu en)
  ecran : provenance "Renseigné par Open Library — vérifie et corrige." ; ...
  suggestions : "Proposé par Open Library" ["Barbecuing"]
  requetes : search.json 1 ; api/books 0 ; covers 1 ; googleapis 0 ; echecs 0
=== (2) « ← Changer d’ISBN », 9782890772816 + Identifier
  champs : titre « À la di Stasio » ; auteur « Josée Di Stasio » ; editeur « Flammarion Québec » ; annee 2004 ; langue fr (menu fr)
  suggestions : "Proposé par Open Library" ["Cooking","Cuisine"]
  requetes : search.json 1 ; api/books 0 ; covers 1 ; googleapis 0 ; echecs 0
=== (3) 9781785035280 (controle faux) + Identifier
  ecran : provenance null ; validation "Cet ISBN n’est pas valide, vérifie les chiffres." ; indisponible null ; bouton Reessayer false
  requetes : search.json 0 ; api/books 0 ; covers 0 ; googleapis 0 ; echecs 0
=== (4) hors ligne, 9780306406157 + Identifier
  resultat {"statut":"indisponible","motif":"horsligne","google":"non_appele"}
  ecran : ... indisponible "Tu es hors ligne." ; bouton Reessayer true
  requetes : search.json 0 ; api/books 0 ; covers 0 ; googleapis 0 ; echecs 0
=== (5) en ligne, « Reessayer »
  duree 511 ms ; pas 2 ; isbn 9780306406157
  champs : titre « Error-correction coding for digital communications » ; ... langue en (menu en)
  requetes : search.json 1 ; api/books 0 ; covers 1 ; googleapis 0 ; echecs 0
=== (6) edition anglaise 9780747532699 (Harry Potter and the Philosopher’s Stone, Bloomsbury 1997)
  champs : titre « Harry Potter and the Philosopher's Stone » ; auteur « J. K. Rowling » ; editeur « Alma Littera » ; annee 1997 ; langue fr (menu fr)
=== (6) edition anglaise 9780385533225 (The Particular Sadness of Lemon Cake, Doubleday 2010)
  champs : titre « The Particular Sadness of Lemon Cake » ; ... langue en (menu en)
```

Lecture : les deux ISBN du signalement sont trouvés en **une** requête `search.json` chacun, avec la langue juste
(`en` / `fr`) et la suggestion « Barbecuing » ; l'ISBN faux et le mode hors ligne ne font **aucune** requête ;
« Réessayer » remis en ligne trouve le livre. Les durées (≈ 200-510 ms) comptent un plancher de 200 ms du script.
**D6 confirmé** : une édition anglaise d'une œuvre traduite peut sortir `fr` (Harry Potter) avec l'éditeur d'une
autre édition (« Alma Littera ») — vraisemblablement les données de l'œuvre (inférence, non vérifiée chez Open
Library), la fiche reste « à vérifier » ; correction = lot suivant. Les
sujets d'Open Library contiennent aussi des étiquettes techniques (« Series:Harry_Potter », « Nyt:hardcover_fiction=… »)
filtrées depuis la vague finale (R-ISBN-6 : toute valeur à `:` ou `=` est écartée). La couverture de `9781785035289` répond 404 chez Open Library
(curl, `?default=false`) : pas de couverture, chemin attendu.

**Ce qui n'est PAS prouvé.** **Safari et l'iPhone** (aucun WebKit ici) ; **Google Books avec une clé** (case vide :
le chemin n'est éprouvé que par la suite) ; que Google **accepte un référent réduit à l'origine** (`strict-origin`)
et que Safari l'envoie — mesure décrite dans `docs/google-books.md` ; la **langue d'une édition bilingue** ou
traduite (D6 ci-dessus : la langue de l'œuvre gagne, « français d'abord ») ; les deux ISBN depuis le **site public**
(après fusion et `push`).

**Dettes (assumées, nommées dans le registre).** **S4d** : quitter la route pendant une recherche n'abandonne pas la
requête en vol (au plus 20 s ; sa réponse est muette par la génération — « Saisir à la main » et « ← Changer
d'ISBN », eux, l'abandonnent depuis R-ISBN-8) · **R-ISBN-9** : sur la fiche livre, `book.js` « Enregistrer » écrit
l'ISBN tapé sans validation ni borne (contourne S8, chemin préexistant, lot suivant) · les messages du pas 1
(« Recherche… », indisponible, validation) n'ont pas d'`aria-live` (accessibilité, hors spec) · le chemin réel du lecteur de code-barres
(`pickFiles` + `createImageBitmap`) reste hors suite (seul `codeBarresVersIsbn` est testé) · pas de suggestions
distantes sur la **fiche** livre (les sujets reçus ne sont pas stockés) · mineurs différés des revues de tâche, en une
ligne : tables de messages reconstruites à chaque appel du modèle, imports
temporairement inutilisés résorbés, duplication `identifier`/`nouvelleGeneration` et des deux IIFE de `book.js`,
quelques assertions encore faibles (`.some` au lieu d'un décompte, Entrée sans `defaultPrevented`) — liste exacte dans
`progress.md`.

**Versions** (à la clôture du lot ISBN ; depuis le 17 octobre, voir « Chercher sur le web avec l'assistant » ci-dessous).
`APP_VERSION = '0.4.1'` (pins `v0\.4\.1-\d+` dans `tests/ajouter.js` et `tests/sync-l3.js`),
`sw.js VERSION = 'cuisine-os-v0.4.1-12'` (vague /verify), `SHELL` + `./src/core/isbn.js` (seul module neuf), `GOOGLE_BOOKS = { key: '' }`
dans `src/sync/config.js`. Aucun schéma touché, `DB_VERSION` inchangée.

**Bilan (clôture, tâche 10).** Suite complète **1506/1506 verts** (total épinglé **1505** dans `tests/tests.js`), une
seule erreur de console : un 404 de `/favicon.ico` (mesuré par le contrôleur sur la base avant le lot ;
`tests/index.html` n'a pas de favicon). « 1506/1506 pour un total épinglé 1505 » n'est pas une coquille : l'assertion
du total compte les assertions qui la précèdent, et s'ajoute elle-même au bilan affiché ; `node --test tools/*.test.mjs` **40/40** ; `node
tools/generer-migrations.mjs --check` : **0** ; aucun U+2028/2029/202E ni caractère de contrôle dans les fichiers du
lot ; `grep -rn "AIza" src/` vide.

**Vague finale de corrections (15 octobre 2026, après la revue de branche — rapport `final-fix-report.md`).**
R-ISBN-6 (sujets techniques filtrés avant le plafond, troncatures par points de code), R-ISBN-7 (`inputmode`
retiré : le X d'un ISBN-10 reste tapable sur iPhone), R-ISBN-8 (« Saisir à la main » / « ← Changer d'ISBN »
abandonnent la requête en vol), garde `recherche` du lecteur de code-barres, deux ISBN-10 au contrôle faux testés ;
R-ISBN-9 et R-ISBN-10 consignés (spec § 11.2). Suite **1516/1516 verts** (total épinglé **1515**), même 404 de
`/favicon.ico` seul en console ; `tools` 40/40 ; `--check` 0.

**Vague /verify (15 octobre 2026 — rapport `verify-fix-report.md`, spec § 11.2 R-ISBN-12/13).** Trois lentilles
adverses (correctness, sécurité, faux-vert), une vague, chaque changement de comportement rouge d'abord : **C1**
« Saisir à la main » après « ← Changer d’ISBN » sous un autre ISBN (ou un invalide) ne montre plus les champs reçus
pour le premier livre ; sous le même ISBN, champs **et** étiquette « Renseigné par … » restent · **S1** une année reçue
au `toString` hostile ne fait plus lever `lookupIsbn` (et `identifier` a un `catch` filet : jamais d'écran muet) ·
**S2** un `tags` de livre qui n'est pas un tableau (archive, ligne reçue) ne fait plus tomber la recherche
(`tagsDe`, pur, dans `src/domain/search.js`) · **C3** « ISBN-13: 9781785035289 » collé est accepté (`maxlength` 32) ·
**C2** texte `pas_isbn` : « Ce numéro n’est pas un ISBN : il doit commencer par 978 ou 979. » · **C4** `google:
'trouve'` sur une fiche de Google Books · **C5** le lecteur de code-barres relit génération, pas et recherche après la
lecture · **S5** la couverture n'est jamais demandée sans ISBN-13 · **V1-V3** tests du chemin de production (vraie
`Response` en flux), de la borne exacte de 256 Kio et de la couverture comptée par ISBN. Suite **1537/1537 verts**
(total épinglé **1536**), même 404 de `/favicon.ico` seul en console ; `tools` 40/40 ; `--check` 0. **Parqués (lot
suivant)** : S3 (la couverture en vol n'est pas abandonnée au changement de génération), S4 (un mot-clé tapé n'est
pas nettoyé des Cc/Cf), C6 (le redessin à l'arrivée de la couverture perd une saisie en cours), C7 (`refTerms` reprend
les mots d'une exclusion), R-ISBN-11 (suggestion > 60 caractères hors plan de base muette au tap).

**Fusion.** Revue finale de branche puis `/verify` par le chef d'orchestre ; copier
`.superpowers/sdd/2026-10-14-identifier-un-livre-fiable/` dans `~/projects/mistu/.superpowers/sdd/` **avant** tout
`git worktree remove`. Si `main` a bougé depuis `606fdd9` : rebaser (les lignes de version et le total épinglé se
résolvent en faveur d'`isbn-fiable`). **Neegan fusionne par `!`** puis `git push` ; preuve sur le site public : les
deux ISBN, les suggestions, la recherche « bbq ».

### Chercher sur le web avec l'assistant (17 octobre 2026)

**Où.** Branche `recherche-web`, worktree `~/projects/mistu-web` (jamais `~/projects/mistu`), serveur de vérification
`http://localhost:8083/` (suite : `http://localhost:8083/tests/`). Spec :
`docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md` (rév. 2.1 ; **§ 11.2** « Ce que la construction a
amendé » : R-WEB-1 à R-WEB-10, tests durcis, fixtures corrigées, notes de couche, vague finale, vague `/verify`). Plan :
`docs/superpowers/plans/2026-10-17-chercher-sur-le-web.md`. Registre : `.superpowers/sdd/2026-10-17-chercher-sur-le-web/`
(`progress.md`, un brief et un rapport par tâche, les diffs revus ; lanceur `suite.cjs`). Base : `main` `e4e841b` (lot
ISBN fusionné, 1537/1537, total épinglé 1536). Neuf tâches, chacune avec au plus une ronde de corrections. Le site public
ne change qu'à la fusion et au `git push` de Neegan.

**Ce qui marche** (éprouvé par la suite : `fetch`, état en ligne, délais, fuseau et navigation injectés, réponses d'API
fixes, aucun réseau) : l'onglet « Web » de la recherche lance, **sur une tape seulement**, **un** appel à l'API Anthropic
avec l'outil de recherche web côté serveur (`web_search_20250305`, 3 recherches au plus, pays `CA`) ; sans assistant
configuré, ou avec un autre fournisseur qu'Anthropic, l'écran le dit avec « Réglages » et n'appelle rien ; **un seul vol
dans toute l'app** (une nouvelle tape abandonne la précédente, « Annuler » abandonne sans relancer, une réponse tardive
n'écrit rien) ; **rien d'inventé** : un lien ne s'affiche que si son adresse est égale à celle d'un résultat brut du
serveur, titre, hôte et date viennent du résultat, le texte de l'assistant ne donne que « pourquoi » (borné à 200) ;
5 liens au plus, les autres pages repliées sous « Autres pages trouvées ({n}) » ; l'avertissement « L’assistant ne
vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner. » toujours sous les liens ; des issues
distinctes (trouvé, rien, indisponible avec sa raison, « Code : {c} » sous le texte générique, « Réessayer » ou
« Chercher à nouveau ») ; une mémoire **vive** par demande (une nouvelle instance de la route retrouve les liens sans
second appel ; une puce touchée garde les liens et dit « La demande a changé depuis cette recherche. ») ; **« Garder ce
lien »** ouvre le signet prérempli (adresse telle quelle, jamais tronquée ; titre borné ; bannière « Adresse reçue :
vérifie-la avant d’enregistrer. » avec l'hôte que le formulaire enregistrera ; rien n'est écrit sans « Enregistrer ») ;
l'issue ne contient jamais la clé ni aucun texte d'un corps d'**erreur** (il sert au classement, pas à l'écran) ; d'une
réponse réussie, seuls les titres et dates des résultats (bornés, nettoyés) et le « pourquoi » de chaque lien (200 points
de code, Cc/Cf retirés) arrivent à l'écran. Les rulings, une ligne chacun (détail en spec § 11.2) :
- **R-WEB-1** `construireDemande` rend `q` et `filtres` nettoyés ; l'écran rappelle ce qui est parti, jamais la saisie brute.
- **R-WEB-2** la tape ne réanalyse le champ que s'il a changé : les filtres des listes et les puces retirées survivent.
- **R-WEB-3** un « trouvé » sans carte survivante à la revalidation du rendu se rend comme « rien ».
- **R-WEB-4** corps et en-têtes construits avant le `try` du réseau : une exception y est `interne`, jamais `reseau`.
- **R-WEB-5** clé hors `[\x21-\x7e]` → `cle_refusee` sans appel ; `chercherRecettesWeb(null)` ne lève pas ; abandon après un corps d'erreur → `annule`.
- **R-WEB-6** un 403 est lu comme le 400 : « web search … not enabled / disabled » → `recherche_desactivee`, sinon `cle_refusee`.
- **R-WEB-7** K1 pour `trouve` seulement ; les écrans sans « Réessayer » offrent « Chercher à nouveau » (pas d'impasse après une clé corrigée).
- **R-WEB-8** l'hôte de la bannière « Adresse reçue » vient de `signetModel` (même décision que l'enregistrement) ; une adresse d'espaces n'est pas « reçue ».
- **R-WEB-9** la tape met l'adresse à jour sans re-rendu (`remplacerAdresse`) : l'instance garde ses puces et son vol (sa réunion des restrictions est remplacée par R-WEB-10).
- **R-WEB-10** champ changé sans Entrée : la tape le relit ; seules survivent les puces des listes « + type » / « + restriction » (affichées moins l'analyse de l'ancien texte) ; exclusions, ingrédients et durées viennent du nouveau texte. Entrée, mode ou case (`run()`) réanalysent sans rien garder.

**Mesuré en réel (17 octobre 2026, site public).** Un appel réel avec la clé de Neegan, demande « puttanesca » : **un**
POST vers l'API Messages → 200, 2 recherches, 5 liens choisis + 13 autres pages, ≈ 20 s ; `page_age` vu en « 654 days
ago » et parfois « April 30, 2025 » (d'où le lot « Confort après preuve » ci-dessous).

**Ce qui n'est PAS prouvé.** Statut et corps exacts d'un compte sans recherche web (400 ou 403, texte du message), forme
réelle de `pause_turn` et de `refusal`, taille réelle du corps, coût réel ; **Safari et l'iPhone** (aucun WebKit ici) ;
`target="_blank"` et `navigator.onLine` depuis une PWA installée ; `AbortSignal.timeout` compte le temps **actif** : sur
une PWA iOS en arrière-plan, 45 s ne sont pas 45 s réelles.

**Dettes (assumées, nommées dans le registre).** Pays fixé à `CA` (spec R3) ; délai de 45 s (R6) ; classement du
400/403 « recherche web non activée » par le texte de `error.message` (R10 : un libellé changé retombe en `requete` ou
`cle_refusee`) ; `vues` purgées par `isConnected` : « pas encore monté » et « démonté » confondus (inatteignable
aujourd'hui) ; timers de `signalDelai` non annulables (inoffensif) ;
textes de garde dupliqués entre `renderWeb` et `renderIssue` ; une levée dans un redessin interrompt `notifier()` (rejet
non géré) ; `src/ui/search.js` passe de 100 à 249 lignes (l'écran web
pourra avoir son propre module) ; `issue()` relit `cfg.model` dans le `catch` externe (un getter qui lève à chaque accès
ferait lever ; `cfg` est du JSON simple) ; un `trouve` sans carte survivante (rendu `rien`) suit encore K1. Tests : défauts
(fuseau, `enLigne`, 45 s, 2 Mio, 64 Kio) non épinglés ; en-têtes avant le `try` et `ctl.abort()` en `finally` sans test
dédié ; branches `exclude`/`max_active` de `libellePuce` non épinglées ; chemin `filtres` de `borner` sans fixture Cf ;
pins de `VERSION` répétés dans trois suites ; `!includes('notice')` sur tout `pairing.js` fragile — liste exacte dans
`progress.md`.
**Reconstruction de l'écran pendant un vol** : une passe de synchronisation qui écrit (`cuisineos:refresh`, `doitRendreApresPasse` vaut vrai pour `/search`) ou un retour arrière dans l'historique reconstruit la route depuis l'adresse ; les puces ajoutées par les listes (R-WEB-10) n'y sont pas, l'écran du vol disparaît et une nouvelle tape repartirait sans elles (préexistant depuis R-WEB-2, plus rare que la tape, jusqu'à 45 s d'exposition) — remède = porter les puces de liste dans l'adresse (lot ultérieur).
**Nommées par `/verify`** (17 octobre, une ligne chacune, détail en spec § 11.2) :
- **V-F8** `page_age` et `recherches` ne sont pas typés par les tests (un nombre ou un objet à leur place n'est pas éprouvé).
- **V-F9** branches sans fixture : `server_tool_use` seul (sans bloc de résultats), `stop_reason: 'max_tokens'`, une page « autre » au titre vide.
- **V-F10** I-K (l'avertissement fixe sous les liens) n'est affirmé que sur un seul `trouve`.
- **V-F11** aucune fixture où la frappe REMPLACE un ingrédient en gardant une puce de liste (« saumon » → « truite »).
- **V-F13** `lire()` des tests de source ne vérifie pas `res.ok` (un 404 serait lu comme un source).
- **V-F14** `suite.cjs` lit n'importe quel `h2` de la page, et son code de sortie ignore la console.
- **V-C3** une prose qui met une accolade APRÈS le JSON `choix` le rend illisible → repli (liens sans « pourquoi »).
- **V-C4** les bornes 12 filtres / 80 points de code par filtre coupent la demande sans que les puces affichées le disent.
- **V-C5** `libellePuce` rend toujours le français (libellés `fr` des ingrédients), même en interface anglaise.
- **V-S3** un lien profond `#/search?q=…` peut préremplir le champ avec des espaces cachés (rien ne part sans tape).
- **V-S4** un vol en cours pour une AUTRE clé est invisible depuis l'écran courant ; I-I vaut par document (le module), pas par app (deux onglets = deux vols).
- **V-S5** un plafond de dépense atteint ou un crédit épuisé est classé `requete` (statut et corps réels à mesurer).
- **V-S6** « ce qui part » (I-C) compte aussi `Origin`, `User-Agent`, `Accept-Language` et les indices client du navigateur ; les requêtes de recherche rédigées par le modèle atteignent le fournisseur de recherche.
- **V-S7** fermé par cette vague (V-C2, `t()` sans motifs `$`).
- **V-S8** le titre d'une page est rendu dans un lien habillé en bouton (`a.btn`) ; les marques combinantes (Mn) ne sont pas retirées des titres.
- **V-S9** (préexistant) `AnthropicProvider.complete` part sans `redirect: 'error'` ni `credentials: 'omit'` ; « Tester » (Réglages) affiche le corps d'erreur brut.
- **V-S1 / V-S2** les deux murs hors code : plafond du workspace Anthropic et D5 (V-S1) ; préfixe « Selon l'assistant » devant le « pourquoi » et filtre déterministe par `DIET_TAGS` en suite (V-S2).

**Versions.** `APP_VERSION = '0.5.0'` (pins `v0\.5\.0-\d+` dans `tests/ajouter.js`, `tests/sync-l3.js` et
`tests/recherche-web.js`), `sw.js VERSION = 'cuisine-os-v0.5.0-11'` (vague `/verify` ; `-10` à la vague finale, `-9` à la clôture de la tâche 9), `SHELL` + `./src/core/bornes.js`
et `./src/domain/recherche-web.js` (deux modules neufs). Aucun schéma touché, aucune migration, aucun réglage neuf,
`DB_VERSION` inchangée ; CSP inchangée (`connect-src https:` couvre déjà `api.anthropic.com`).

**Bilan (clôture, tâche 9).** Suite complète **1753/1753 verts** (total épinglé **1752** dans `tests/tests.js` :
l'assertion du total s'ajoute elle-même au bilan affiché), une seule erreur de console : le 404 de `/favicon.ico`
(pré-existant, `tests/index.html` n'a pas de favicon) ; `node --test tools/*.test.mjs` **40/40** ; `node
tools/generer-migrations.mjs --check` : **0** ; aucun U+200B-200F, U+2028/2029 ni U+202E dans les fichiers touchés par
la tâche 9.

**Vague finale de corrections (17 octobre 2026, après la revue de branche — rapport `final-fix-report.md`).** Un
Important et quatre mineurs, rouge d'abord : **R-WEB-9** (ci-dessus ; la tape envoyait la demande SANS la restriction
choisie par « + restriction » quand le champ avait été tapé sans Entrée, et la puce disparaissait) · `signetModel`
compte le titre en **points de code**, comme `borner` (200 emoji préremplis n'étaient plus « trop longs ») · `run()`
passe par `requeteRoute` et le `navigate` injecté (une seule définition de l'adresse de recherche ; la dette nommée
ci-dessus est fermée) · `construireDemande(null)` ne lève plus · en-tête de `recherche-web.js` : le « pourquoi » borné
est I-H. **Vague 2** (re-revue, même jour) : la tape ré-instanciait encore la route par `navigate` — puces réunies
perdues à l'écran, vol masqué par un bouton rallumé (double facturation possible) ; elle passe désormais par
`remplacerAdresse` (sans re-rendu, testé avec un faux routeur qui ré-instancie comme `app.js`), et la réunion porte
aussi les durées. Suite complète **1765/1765 verts** (total épinglé **1764**), même 404 de `/favicon.ico` seul en
console ; `tools` 40/40 ; `--check` 0 ; `sw.js` alors à `-10`.

**Vague `/verify` (17 octobre 2026, trois lentilles — rapport `final-fix-report.md`, « Vague 3 »).** **R-WEB-10**
corrige R-WEB-9 : une demande neuve tapée sans Entrée héritait des contraintes de l'ancien texte (« soupe sans gluten
en 20 minutes » puis « gâteau au chocolat » partait avec « Soupe ; Sans gluten ; prêt en ≤ 20 min ») ; seules les
puces de liste survivent désormais · **V-C2** `t()` remplace par fonction (une valeur avec `$&` ou `$$` était
déformée) · **V-C6** un 200 sans corps lisible est `interne`, plus `reseau` · faux-verts V-F1 à V-F7 et V-F12 fermés,
chaque mutant rejoué sur une copie (survivant avant, tué après) · dettes nommées ci-dessus. Suite complète
**1778/1778 verts** (total épinglé **1777**), même 404 de `/favicon.ico` seul en console ; `tools` 40/40 ;
`--check` 0 ; `sw.js` `cuisine-os-v0.5.0-11`.

**Gestes de Neegan** (spec § 10 R2, hors code). 1) Créer la clé dans un **workspace Anthropic dédié à Cuisine OS, avec
un plafond de dépense mensuel**, puis l'entrer dans Réglages → Assistant IA. 2) **Ne pas entrer cette clé sur le site
public** (`neegans.github.io`) **tant que D5** (sous-domaine dédié) **n'est pas fait** : toute autre page Pages du compte
lit la même IndexedDB. 3) Après la revue finale et `/verify` : d'abord écarter le `STATE.md` non suivi de l'arbre principal (ce lot ajoute un
`STATE.md` suivi, et `git merge` refuserait d'écraser un fichier non suivi) : `! mv ~/projects/mistu/STATE.md ~/projects/mistu/STATE.avant-web.md` (le
nouveau le remplace ; l'ancien peut être effacé après lecture) ; puis fusionner par `!` (`cd ~/projects/mistu && git merge
--ff-only recherche-web`, ou rebaser si `main` a bougé depuis `e4e841b`), puis `! git -C ~/projects/mistu push origin main` (le dossier courant peut être un worktree). 4) **Preuve réelle** : faite
le 17 octobre sur le site public (« puttanesca », voir « Mesuré en réel ») ; reste l'iPhone (qui n'a que le site public :
après D5) : « saumon fenouil » → des liens, « Garder ce
lien » → signet prérempli ; noter la durée, le nombre de recherches affiché et, si observable, la forme du refus d'un
compte sans recherche web.

**Fusion.** Revue finale de branche puis `/verify` par le chef d'orchestre ; copier
`.superpowers/sdd/2026-10-17-chercher-sur-le-web/` dans `~/projects/mistu/.superpowers/sdd/` **avant** tout
`git worktree remove`. Avant la fusion, geste de Neegan dans l'arbre principal : `mv ~/projects/mistu/STATE.md ~/projects/mistu/STATE.avant-web.md`
(sinon « untracked working tree files would be overwritten: STATE.md »). Preuve sur le site public après le `push` : service worker `cuisine-os-v0.5.0-N` servi, onglet
Web → « Pour chercher sur le web, configure l’assistant IA … » sur un navigateur sans clé (0 requête).

#### Confort après preuve (17 octobre, soir)

**Quoi** (branche `confort-web`, worktree `~/projects/mistu-web`, base `main` `dc7444a`, registre `.superpowers/sdd/2026-10-17-confort-web/`, trois frictions vues par Neegan sur le lot web LIVE) : 1) Mes livres porte une section « Liens web gardés » (signets sans livre, le dernier gardé d'abord — `created_at`, `updated_at` en repli, sans horodatage en dernier —, même quand il n'y a aucun livre : « ← Mes livres » d'un signet ne ramène plus à une liste vide) ; 2) « Chercher à nouveau » est aussi sur la ligne de la mention K1 « La demande a changé depuis cette recherche. », avant les liens (le bouton du bas reste) ; 3) la date d'une page n'est montrée que sous une forme de liste blanche, mise en forme dans la langue de l'interface (`dateLisible`, pure, dans `recherche-web.js`) : « Mois jour, année » (« April 30, 2025 » → « 30 avril 2025 », refusée si le jour déborde, « Feb 30 ») ou ISO seule rendue en UTC (« 2025-04-30 » → « 30 avril 2025 », jamais la veille) ; tout le reste est masqué (« 654 days ago », « April 2025 », « 1 », « 12/04/2025 », RFC 1123 — ronde 1, « rien d'inventé »).
**Versions.** `APP_VERSION = '0.5.1'`, `sw.js VERSION = 'cuisine-os-v0.5.1-4'` (ronde 1 de revue ; `SHELL` inchangé, aucun module neuf), pins `v0\.5\.1-\d+` / `'0.5.1'` dans `tests/ajouter.js`, `tests/sync-l3.js` et `tests/recherche-web.js` ; suite **1796/1796** (total épinglé **1795**), seul le 404 de `/favicon.ico` en console ; `tools` 40/40 ; `--check` 0.
**Non prouvé.** Rien de nouveau côté réseau (aucun appel ni requête de plus). Les deux formes de `page_age` vues en réel le 17 octobre (« 654 days ago », « April 30, 2025 ») sont couvertes par la suite ; **Safari et l'iPhone** restent non prouvés (`Date.parse` d'une forme non ISO dépend du moteur : la vérification du jour refuse un débord, pas une lecture différente).

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
