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
- `src/domain/llm.js` : fournisseurs OpenAI-compatible et Anthropic écrits sans appel réel. (Premier appel réel mesuré le 17 octobre 2026, lot « Chercher sur le web » : `AnthropicProvider` via l'API Messages, voir cette section.)
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
- **Ajouté le 18 octobre par le lot « Créer une recette avec l'assistant »** (branche `creer-ia`, non fusionnée) : un bouton « Créer une recette avec ces critères » (`data-role="creer-depuis-web"`) sur « rien », sous les liens d'un « trouvé » et sur « recherche web désactivée » ; il relit le champ (`relireChamp`) puis ouvre `#/recipes/creer` avec `q` et les puces affichées, **sans aucun appel** (voir cette section plus bas).

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
`DB_VERSION` inchangée ; CSP inchangée (`connect-src https:` couvre déjà `api.anthropic.com`). Ligne historique du lot
web : **amendé les 17-18 octobre** — la configuration de l'assistant (clé comprise) suit désormais le compte, voir
« L'assistant suit le compte » ci-dessous (`APP_VERSION 0.6.0`, `DB_VERSION 3`).

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
un plafond de dépense mensuel**, puis l'entrer dans Réglages → Assistant IA. 2) ~~Ne pas entrer cette clé sur le site
public (`neegans.github.io`) tant que D5 (sous-domaine dédié) n'est pas fait : toute autre page Pages du compte lit la
même IndexedDB.~~ **Geste RETIRÉ le 17 octobre** (spec assistant-par-le-compte § 1, décision de Neegan) : le site public
est la seule origine de l'iPhone, et le but du lot « L'assistant suit le compte » est justement d'y déposer la clé ; D5 reste recommandé, le
plafond du workspace reste le mur. 3) Après la revue finale et `/verify` : d'abord écarter le `STATE.md` non suivi de l'arbre principal (ce lot ajoute un
`STATE.md` suivi, et `git merge` refuserait d'écraser un fichier non suivi) : `! mv ~/projects/mistu/STATE.md ~/projects/mistu/STATE.avant-web.md` (le
nouveau le remplace ; l'ancien peut être effacé après lecture) ; puis fusionner par `!` (`cd ~/projects/mistu && git merge
--ff-only recherche-web`, ou rebaser si `main` a bougé depuis `e4e841b`), puis `! git -C ~/projects/mistu push origin main` (le dossier courant peut être un worktree). 4) **Preuve réelle** : faite
le 17 octobre sur le site public (« puttanesca », voir « Mesuré en réel ») ; reste l'iPhone (qui n'a que le site public) :
« saumon fenouil » → des liens, « Garder ce
lien » → signet prérempli ; noter la durée, le nombre de recherches affiché et, si observable, la forme du refus d'un
compte sans recherche web.

**Fusion.** Revue finale de branche puis `/verify` par le chef d'orchestre ; copier
`.superpowers/sdd/2026-10-17-chercher-sur-le-web/` dans `~/projects/mistu/.superpowers/sdd/` **avant** tout
`git worktree remove`. Avant la fusion, geste de Neegan dans l'arbre principal : `mv ~/projects/mistu/STATE.md ~/projects/mistu/STATE.avant-web.md`
(sinon « untracked working tree files would be overwritten: STATE.md »). Preuve sur le site public après le `push` : service worker `cuisine-os-v0.5.0-N` servi, onglet
Web → « Pour chercher sur le web, configure l’assistant IA … » sur un navigateur sans clé (0 requête).

#### Confort après preuve (17 octobre, soir)

**Quoi** (branche `confort-web`, worktree `~/projects/mistu-web`, base `main` `dc7444a`, registre `.superpowers/sdd/2026-10-17-confort-web/`, trois frictions vues par Neegan sur le lot web LIVE) : 1) Mes livres porte une section « Liens web gardés » (signets sans livre, le dernier gardé d'abord — `created_at`, `updated_at` en repli, sans horodatage en dernier —, même quand il n'y a aucun livre : « ← Mes livres » d'un signet ne ramène plus à une liste vide) ; 2) « Chercher à nouveau » est aussi sur la ligne de la mention K1 « La demande a changé depuis cette recherche. », avant les liens (le bouton du bas reste) ; 3) la date d'une page n'est montrée que sous une forme de liste blanche, mise en forme dans la langue de l'interface (`dateLisible`, pure, dans `recherche-web.js`, sans `Date.parse`) : « Mois jour, année » avec un mois anglais d'une liste fermée (« April 30, 2025 » → « 30 avril 2025 », « Sept. 5, 2025 », casse libre ; refusée si la date déborde, « Feb 30 », « Feb 29, 2025 ») ou ISO seule (« 2025-04-30 » → « 30 avril 2025 », jamais la veille), construite et rendue en UTC ; tout le reste est masqué (« 654 days ago », « April 2025 », « 1 », « 12/04/2025 », RFC 1123, « Mayhem 5, 2025 », « April 30, 0025 », « Avril 30, 2025 » — rondes 1-2, « rien d'inventé »).
**Versions.** `APP_VERSION = '0.5.1'`, `sw.js VERSION = 'cuisine-os-v0.5.1-6'` (vague finale de revue ; `SHELL` inchangé, aucun module neuf), pins `v0\.5\.1-\d+` / `'0.5.1'` dans `tests/ajouter.js`, `tests/sync-l3.js` et `tests/recherche-web.js` ; suite **1802/1802** (total épinglé **1801**), seul le 404 de `/favicon.ico` en console ; `tools` 40/40 ; `--check` 0.
**Non prouvé.** Rien de nouveau côté réseau (aucun appel ni requête de plus). Les deux formes de `page_age` vues en réel le 17 octobre (« 654 days ago », « April 30, 2025 ») sont couvertes par la suite ; `dateLisible` n'utilise aucun `Date.parse` (liste fermée des mois anglais, date construite par `Date.UTC`, rendue par `Intl.DateTimeFormat` en `timeZone: 'UTC'` — ronde 2) ; le rendu de cette sortie sur **Safari et l'iPhone** reste non mesuré.
**Dettes (nommées par la revue de branche, 17 octobre).**
- **M2** « Liens web gardés » filtre sur `!edition_id` brut alors que la fiche recette résout l'édition : un signet dont l'édition manque sur l'appareil n'apparaît nulle part (rare, transitoire de synchronisation).
- **F2** la construction UTC de `dateLisible` n'est épinglée par les tests que pour les machines à l'est d'UTC, et le formatage `timeZone: 'UTC'` que pour celles à l'ouest (la suite tourne en America/Toronto).
- **M3** à 390 px, après une tape sur le « Chercher à nouveau » de K1 (y 684-726), « Annuler » de l'écran du vol arrive à y 649-691 et x 33-117 : une bande de 7 px chevauche le haut à gauche de l'ancien bouton, une double tape précise pourrait annuler un appel facturé (mesuré le 17 octobre, non corrigé).
- **Perf** un `Intl.DateTimeFormat` est construit par carte et par rendu (négligeable ; deux formateurs en cache suffiraient).

### L'assistant suit le compte (17-18 octobre 2026)

**Où.** Branche `assistant-compte`, worktree `~/projects/mistu-web` (jamais `~/projects/mistu`), serveur de vérification
`http://localhost:8083/` (suite : `http://localhost:8083/tests/`). Spec :
`docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md` (rév. 2 ; **§ 12** : revues S1-S14 et F1-F15, puis
les **rulings de construction R-CPT-1 à R-CPT-7**) ; spec parente amendée : `docs/spec-compte-et-stockage-distant.md`
§ 11, **R65** ; spec web § 11.2 : I-C et geste R2 amendés. Plan : `docs/superpowers/plans/2026-10-17-assistant-par-le-compte.md`.
Registre : `.superpowers/sdd/2026-10-17-assistant-par-le-compte/` (`progress.md`, un brief et un rapport par tâche, les
diffs revus ; lanceur `suite.cjs`). Base : `main` `66c5d19` (lot confort ; `origin/main` = `66c5d19`, lu par
`git ls-remote` le 18 octobre). Neuf tâches, chacune avec au plus une ronde de corrections, puis une vague finale de
corrections après la revue de branche (`final-fix-wave.md`, rapport `final-fix-report.md`). **FINI dans le worktree,
PAS fusionné, PAS poussé** ; le site public ne change qu'à la fusion et au `git push` de Neegan, **après** `0003`.

**Pourquoi.** Le 17 octobre au soir, l'iPhone disait « configure l'assistant IA » alors que la clé était entrée sur le
Mac : elle vivait dans `settings.llm`, que la synchronisation ne porte pas (spec parente § 3.1). Décision de Neegan :
la même clé partout, par son compte.

**Ce qui marche** (éprouvé par la suite : bases jetables, transport factice en mode `serveur`, prédicats et gestes
injectés, aucun réseau) : la configuration vit dans le magasin **`assistant_config`** (une ligne `llm`), plus dans
`settings` (`getSetting('llm')` et `setSetting('llm', …)` lèvent) ; elle est normalisée à l'écriture locale et à la
lecture (`src/domain/assistant-config.js`, seul module neuf), jamais à la réception ; sur un hôte de production
(`SUPABASE.prod.hosts`), elle est capturée, envoyée (envoi initial compris) et reçue comme les autres magasins synchronisés —
**jamais** hors production (`localhost`, `127.0.0.1`) ; **jamais de conflit à trancher** (à instant égal, la version du
compte gagne sans écran ; aucune entrée `sync_conflicts`, ni à la réception ni à l'envoi) ; **jamais de suppression
locale** (garde `noDelete` dans `db.mutate`) : « Aucun » écrit une ligne vide, n'écrit rien sans configuration ici, et
demande « Retirer l'assistant de tous tes appareils ? » sur **tout hôte de production**, où cette ligne part toujours à
un compte, celui d'aujourd'hui ou le premier qui se connectera ici (R-CPT-7) ; une **passe unique**
copie l'ancien `settings.llm` avec son horodatage d'origine (repli 1970) puis l'efface ; une archive ZIP ne porte jamais
la configuration (une archive fabriquée qui la porte est refusée), une restauration en fusion ou en remplacement la
garde ; « Effacer les données de cet appareil » la vide ici seulement ; Réglages → Assistant IA dit en quatre textes ce
qui se passe sur cet appareil (adresse de développement / sans compte / appareil lié déconnecté / connecté), toujours
suivis de « Elle n’est jamais incluse dans les sauvegardes ZIP. » ; une URL de base refusée est dite, ni enregistrée ni
testée ; « Tester » part de la configuration normalisée ; `occupeParAssistant` rend vrai tant que le focus est dans la
section (le câblage dans `suivreMoteurDeLaPage` est lu au source, non exercé). Serveur, en fichiers : migration **à ajout seul**
`supabase/migrations/0003_assistant_config.sql` (table du même gabarit, `revoke all … from anon`, quatre fonctions
recréées avec les 26 noms ; `0001` et `0002` inchangées, empreintes épinglées) et sa preuve
`supabase/proofs/0003_assistant_config.sql` (clés factices, `data` jamais affichée) ; procédure : `supabase/README.md`,
étape 8 bis. Les rulings, une ligne chacun (détail en spec § 12) :
- **R-CPT-1** le prédicat `configSuitLeCompte` (injecté dans `installCapture`, `createPull`, `envoiInitial`) vaut `() => false` par défaut ; `src/app.js` passe `configAssistantSuitLeCompte()` (vrai ssi l'hôte est dans `SUPABASE.prod.hosts`).
- **R-CPT-2** la fixture `withRepo` pose la capture en production (`configSuitLeCompte: () => true`) ; les tests hors production passent par `withDatabase` et un `installCapture` explicite.
- **R-CPT-3** une `base_url` de plus de 500 points de code est tronquée, pas rejetée.
- **R-CPT-4** `https` partout, `http` pour la boucle locale seulement (`localhost`, `127.0.0.1`, `[::1]`), jamais d'identifiants ; `openai_compatible` à URL fournie mais refusée → configuration entière à `none` (jamais de repli vers OpenAI), refus dit sans rien écrire ; une telle configuration n'est pas copiée par la passe unique (à retaper).
- **R-CPT-5** (remplacé par R-CPT-7) la confirmation « Retirer… » ssi `suitLeCompte() && (sync.user || lie)` (`lie` = `sync_state.user_id` présent) : faux pour un appareil jamais lié.
- **R-CPT-6** procédure « appareil perdu » : attendre l'expiration des jetons d'accès avant de remettre l'adresse (ci-dessous).
- **R-CPT-7** (revue finale, C-1 ; remplace R-CPT-5) la confirmation « Retirer… » sur tout hôte de production : `partiraAuCompte = suitLeCompte()`. Écrite déconnectée, la ligne vide est capturée avec `user_id: null` et `fileDe` la fait partir sous le premier compte qui se connecte ici (R-L3-24) : avec « `sync.user || lie` », un appareil jamais lié effaçait la clé de tous les appareils sans question (sonde de la revue finale). Texte K-10 (b) en production : « Sans compte, la configuration reste sur cet appareil jusqu’à ta première connexion, puis elle suit ton compte. » Coût si faux : une question de plus sur un appareil de production qui ne se connectera jamais.

**Ce qui n'est PAS prouvé.**
- **La passe réelle contre `mitsu`** avec `0003` collée, puis sa preuve (verdicts 0.01 à 7.05, ligne `999 BILAN`) :
  **aucune n'a tourné**. Quatre tournures de la preuve n'ont jamais été mesurées sur `mitsu` (relues dans le fichier
  après la ronde 1 de la tâche 8, qui a remplacé `f::regprocedure` et `regexp_match`) : `to_regprocedure(f)` sur une
  colonne `text` issue de `values` (6.01-6.04), `split_part(split_part(…, 'array[', 2), ']', 1)` sur
  `pg_get_functiondef` (mêmes verdicts), `has_table_privilege` avec une liste de privilèges séparés par des virgules
  (2.02), `current_setting(nom, true)` sur des réglages de journaux (7.01-7.05, protégé par un bloc `exception`). Une
  erreur de syntaxe annulerait le collage entier sans rien appliquer (« un collage = une transaction »,
  `supabase/README.md`) ; une erreur de sémantique dans la preuve se lit dans le BILAN (verdict rouge), pas dans la migration. Seule la **syntaxe**
  est vérifiée, hors ligne, par l'analyseur PostgreSQL embarqué de pglast v8.6 : `parse_sql` sur les instructions de
  premier niveau (`0003` 20 instructions, preuve `0003` 48 ; témoins `0001` 253, `0002` 7, preuve `0001` 85 ; aucune
  erreur) — il traite un corps `$$…$$` comme une chaîne opaque —, puis `pglast.parse_plpgsql` sur les corps PL/pgSQL
  (les 4 fonctions de `0003` et les 4 blocs `do` de sa preuve ; témoins : 8 fonctions de `0001`, 8 blocs `do` de sa
  preuve ; aucune erreur ; remesuré à la vague finale, et un `thn` dans `sync_push` comme un `valuez` dans un bloc `do`,
  posés sur des copies, passent `parse_sql` et sont refusés par `parse_plpgsql`) : ce n'est **pas** une exécution, la
  sémantique (noms, signatures, privilèges) ne se prouve que par la passe réelle.
- **iPhone / Safari** : rien de mesuré sur appareil (connexion Google, clé déposée, lecture sur un second appareil).
- **Chemin « nouveau client, ancien serveur »** (code servi alors que `0003` n'est pas collée) : non mesuré, ni en
  factice ni contre PostgREST (le transport factice n'arbitre pas `store inconnu`) ; le 400 est une inférence (spec
  § 6.4) ; éprouvés seulement : les briques génériques L3 (dichotomie → quarantaine `refus`, `inconnu` → recul,
  `tests/sync-l3.js`) et l'ordre « `assistant_config` lu en dernier » (`tests/assistant-compte.js` ≈ l. 281-293) —
  d'où l'ordre des gestes : `0003` **avant** le `push`.
- **État (c) de K-10** (appareil lié, sans session) : inobservable sur `localhost` ; vérifié par prédicat injecté
  seulement.
- **K-12** : le câblage `occupe: () => archiveOperation || occupeParAssistant()` dans `suivreMoteurDeLaPage` est lu au
  source ; seul `occupeParAssistant` est éprouvé (focus réel), pas la page entière sous une passe.
- **Appels réels des fournisseurs** : l'intro de Réglages → Assistant IA a perdu, en se raccourcissant, la phrase « Les
  appels distants n’ont pas été exercés lors du développement : à valider avec une clé réelle. » Elle reste vraie hors
  de la recherche web : aucun appel réel de « Tester », de l'extraction ni du fournisseur compatible OpenAI n'est
  consigné (seul l'appel de la recherche web à l'API Messages l'est, le 17 octobre). C'est dit ici, plus à l'écran.

**Dettes (assumées, une ligne chacune ; plus celles de la spec § 9).**
- `envoyes` (compteur du moteur) compte un refus `conflit` sur `assistant_config` retiré **sans** réécriture.
- Format d'horodatage PostgREST (`+00:00`, microsecondes) contre le factice (ISO `Z`) : un faux conflit « instant égal » reste possible sur les 25 autres tables (note L3 connue) ; pour `assistant_config`, la comparaison passe par des `Date.parse` finis.
- TOCTOU de `fichesLocales` (lecture puis écriture en deux transactions) : dette L3 connue, inchangée.
- Ramenage du serveur à +5 min (`sync_push` : un `updated_at` au-delà de `now() + 5 minutes` est ramené à `now()`, rendu en `adjusted`) face au plancher monotone `floorIso` de `syncNow()` : question de spec parente, non tranchée ici.
- La CSP `connect-src 'self' https:` n'autorise pas un serveur local en `http://localhost:<port>` (R-CPT-4) : une configuration Ollama est gardée mais inerte, et le message de refus propose quand même `http://localhost`.
- Horodatage d'origine de la ligne migrée = celui de `settings.llm`, écrit par `nowIso()` (horloge brute de l'appareil, sans le décalage serveur de `syncNow()`) : une horloge en avance peut faire gagner une vieille clé ; 1970 si illisible.
- Passe unique : lectures hors transaction (`db.get` puis un `db.mutate`) — course théorique entre deux onglets qui monteraient la base en même temps.
- Une `base_url` qui n'est pas une chaîne compte comme fournie, donc refusée (configuration à `none`) : strict, assumé.
- Le défaut sans argument de `configAssistantSuitLeCompte()` (`globalThis.location?.hostname`) ne se simule pas dans le navigateur : la suite éprouve les valeurs à hôte explicite ; l'assertion K-10 compare `texteAssistant` par défaut à `configAssistantSuitLeCompte()` (la même fonction des deux côtés), donc elle éprouve le CÂBLAGE de `texteAssistant` vers ce prédicat, PAS la valeur du défaut (un défaut codé en dur `'neegans.github.io'` survivrait sur localhost). Sur localhost, elle ne tue que le mutant `suitLeCompte = () => true` ; le mutant `() => false` (en production : texte « adresse de développement » et aucune confirmation) ne l'est que par la suite servie sur le site public (geste 3).
- `SECRET_SETTING_KEYS` reste une liste, pas une liste de motifs (spec parente § 6.5).
- `0003` est rendue depuis le `SYNC_STORES` vivant (spec § 6.2) : dès qu'un 27e magasin arrivera, son texte généré changera alors qu'elle sera appliquée (le test `nouvelles` / `deepEqual(['assistant_config'])` de `tools/generer-migrations.test.mjs` le dira). **Geste suivant**, après le collage par Neegan : figer `SYNC_STORES_0003` et épingler l'empreinte SHA-256 de `0003` (logique F11), au prochain lot qui touche le générateur (le README le dit à la fin de l'étape 8 bis).
- Le filet « jamais `data` affichée » du test de la preuve est une liste blanche de formes (ronde 1 de la tâche 8) : toute nouvelle forme légitime devra y être ajoutée explicitement.
- La garde du test node « toute lecture sous `postgres` est bornée à A/B » (4.06) ne détecte que la forme canonique `from public.assistant_config` : un `join`, une virgule ou le nom sans schéma passent ; une borne équivalente (`owner_id = 'A_UUID' or …`) la ferait rougir à tort.
- Le durcissement 6.01-6.05 de la preuve (`to_regprocedure`, `split_part`) n'a pas de test node dédié (lu construction par construction par la revue finale).
- Le test node du README vérifie l'ORDRE des mentions de la procédure « appareil perdu », pas l'existence d'une étape séparée par geste.
- **C-3** `avait` (« une configuration existe ici ») est pris au rendu, pas relu au clic : avec K-12, une clé reçue pendant que le focus est dans la section fait répondre « Rien à retirer : aucun assistant n’est configuré ici. » à tort (rien n'est écrit).
- **S-1** la confirmation « Retirer l’assistant de tous tes appareils ? » ne dit pas à l'écran que la clé reste valide chez le fournisseur (c'est dit ici et dans le README seulement).
- **F-4** `ok(typeof S.occupeParAssistant === 'function', …)` est creux (vert dès que l'export existe) et compte dans le total épinglé : gardé, libellé « non éprouvé ».

**Gestes de Neegan, dans cet ordre.**
1. Éditeur SQL de `mitsu` : coller `supabase/migrations/0003_assistant_config.sql` **entier** (un collage = une
   transaction ; si une lecture de la table rend 404 ensuite : `notify pgrst, 'reload schema';`).
2. Preuve : deux adresses `…@exemple.invalid` dans `private.allowed_users` ; les quatre jetons `A_UUID`, `B_UUID`,
   `A_EMAIL`, `B_EMAIL` remplacés ; coller `supabase/proofs/0003_assistant_config.sql` ; « Run without RLS » ; lire la
   ligne `999 BILAN` (`0 faux` = vert) ; consigner les verdicts dans `supabase/proofs/RESULTATS-mitsu.md` (section
   préparée ; **jamais** une valeur de `data`) ; retirer les deux adresses. Détail : `supabase/README.md`, étape 8 bis.
3. **Seulement après** : copier `.superpowers/sdd/2026-10-17-assistant-par-le-compte/` dans
   `~/projects/mistu/.superpowers/sdd/`, puis fusion par `!` (`cd ~/projects/mistu && git merge --ff-only
   assistant-compte`, ou rebaser si `main` a bougé depuis `66c5d19`), puis `! git -C ~/projects/mistu push origin main`,
   Pages. Un code servi avant `0003` mettrait la configuration en quarantaine `refus` (non destructif mais bruyant ;
   après `0003` : Réglages → Synchronisation → « Réessayer » sur cette entrée). **Après le push** : ouvrir
   `https://neegans.github.io/mistu/tests/` et lire le BILAN (seule la suite servie sur le site public tue le mutant
   `() => false` du défaut de `texteAssistant`, voir les dettes).
4. Appareils : sur le Mac, site public, Réglages → Assistant IA montre la configuration existante (passe unique) et
   « La configuration de l’assistant suit ton compte sur tes appareils connectés. » ; « Envoyer maintenant » force
   l'envoi. Sur l'iPhone : « Connexion avec Google » depuis l'app installée (mesure iOS due depuis le 13 octobre : où
   atterrit le retour ; elle ne dépend pas de ce lot : avant la fusion, ou au plus tard ici), puis vérifier que la clé
   déposée sur le Mac apparaît.
5. Hygiène : faire tourner la clé Anthropic (elle a transité par un chat) et poser un plafond de dépense mensuel sur le
   workspace.

**Appareil perdu ou clé exposée** (le texte qui fait foi : `supabase/README.md`, section du même nom ; spec § 7,
R-CPT-6). « Aucun » dans Réglages ne révoque rien. Dans cet ordre : 1) retirer l'adresse de `private.allowed_users`
(toute lecture et tout envoi refusés dès la requête suivante, même avec une session ouverte) ; 2) fermer toutes les
sessions du compte (tableau de bord → Authentication → Users) ; 3) révoquer l'ancienne clé dans la console Anthropic,
**sans attendre** ; 4) **attendre l'expiration des jetons d'accès** : la durée « JWT expiry » du projet, 3600 s par
défaut, comptée depuis la fermeture des sessions (fermer les sessions révoque les jetons de rafraîchissement, pas un
jeton d'accès déjà émis ; l'adresse remise trop tôt, l'appareil perdu recevrait la nouvelle clé) — l'emplacement
« Authentication → Settings » de ce réglage n'a **pas** été vérifié dans le tableau de bord ; 5) remettre l'adresse,
reconnecter les appareils gardés, entrer la nouvelle clé **une fois** ; sur chaque appareil gardé, recharger Réglages et
vérifier que la clé reçue est la nouvelle **avant tout « Enregistrer »** (dernier qui écrit gagne : un « Enregistrer »
avec l'ancienne clé en mémoire la renverrait partout).

**Versions.** `APP_VERSION = '0.6.0'` (pins `v0\.6\.0-\d+` / `'0.6.0'` dans `tests/ajouter.js`, `tests/sync-l3.js` et
`tests/recherche-web.js`), `DB_VERSION = 3` (était 2), `sw.js VERSION = 'cuisine-os-v0.6.0-10'` (vague finale, qui
touche `src/ui/settings.js` et `src/i18n/en.js` ; six commits de ronde avaient touché `src/` sans incrément —
`7f4758c`, `ccb295c`, `1a8d9c2`, `af7c458`, `860364c`, `ef2e7fa` — ; l'incrément de la clôture de la tâche 9 les
couvrait tous, et rien n'a été servi entre : `origin/main` = `66c5d19`), `SHELL` + `./src/domain/assistant-config.js`
(seul module neuf). `SYNC_STORES` 25 → 26 (`assistant_config` dernier ; `SYNC_STORES_0001` = les 25 de `0001`, figés) ;
`assistant_config` hors `ARCHIVE_DATA_STORES`, `noDelete: true`. CSP inchangée.

**Bilan (vague finale, 18 octobre 2026 — rapport `final-fix-report.md`).** Suite complète **1967/1967 verts** (total
épinglé **1966** dans `tests/tests.js`, lu dans « obtenu » ; la vague ajoute une assertion, F-2 ; départ du lot,
remesuré sur `66c5d19` : 1802/1802, épinglé 1801), une seule erreur de console : le 404 de `/favicon.ico`
(pré-existant ; lu dans le journal du serveur de la copie) ; `node --test tools/*.test.mjs` **45/45** (40 au départ) ;
`node tools/generer-migrations.mjs --check` : **0** (trois fichiers) ; `shasum -a 256` : `0001` =
`e90ff35ec7c031f63dfb903e6885103ed7e42202866f59359ce019d00b85ee51`, `0002` =
`2e90d2b1beb7270601f83c7408b1a2a2be32c800772f14f454960b233a2d5944` (égales aux valeurs épinglées), `0003` commitée =
`37f9f80d62cf82457b177f35979892ce7deeaf2067567a506228e145ad8efd39` (à relire après le collage, fin de l'étape 8 bis) ;
aucun caractère invisible (U+200B-200F, U+2028/2029, U+202A-202E, U+2060-2064, U+2066-2069, U+FEFF) dans les fichiers
touchés par la vague (commande de la ligne 21 du plan, extraite par script) ; scan des clés Anthropic (`git grep -nEi
'sk-ant-[0-9A-Za-z_-]{10,}'`) : aucune clé réelle — seules les quatre sentinelles de test du lot web (`…-sentinelle`,
`tests/recherche-web.js` et le plan web, déjà présentes sur `66c5d19`) ; les seules clés des lignes touchées par la
vague sont des `sk-factice-…` déjà présentes. **Mutants**, rejoués sur des copies servies à part (8093 : l'arbre de la
vague ; 8094 : `af14717`) : l'ancienne condition R-CPT-5 rougit exactement les deux cas retournés (1965/1967) ; l'ancien
texte K-10 (b) rougit K-10 (b) (1966/1967) ; une restauration qui viderait la bibliothèque avant de refuser une archive
portant `assistant_config` passait la suite de `af14717` sans un rouge et rougit l'assertion F-2 (1966/1967). Le cas
« production + connectée + appareil pas encore lié », ajouté à la clôture de la tâche 9 sous R-CPT-5, reste attendu à 1
sous R-CPT-7.

**Fusion.** Revue finale de branche puis `/verify` par le chef d'orchestre ; le registre se copie **avant** tout
`git worktree remove` ; les gestes 1 et 2 ci-dessus **avant** la fusion.

### Créer une recette avec l'assistant (18 octobre 2026)

**Pour toi.** Tu décris ce que tu veux, l'assistant propose UNE recette, tu la gardes ou pas. Rien n'est écrit sans
« Garder cette recette » ; une recette gardée dit partout « Créée avec l'IA · non testée » jusqu'à ce que tu la marques
testée après l'avoir cuisinée, et « Adapter avec l'IA » en demande une variante sans toucher l'original.

**Où.** Branche `creer-ia`, worktree `~/projects/mistu-ia` (jamais `~/projects/mistu`), serveur de vérification
`http://localhost:8084/` (suite : `http://localhost:8084/tests/`). Spec :
`docs/superpowers/specs/2026-10-18-creer-avec-l-ia-design.md` (rév. 2, amendée à la clôture puis à la vague finale ; **§ 0** :
décisions de nuit N-1 à N-10 ; **§ 10** : gestes et décisions à confirmer ; **§ 11** : rulings R-CRE-1 à R-CRE-15). Plan :
`docs/superpowers/plans/2026-10-18-creer-avec-l-ia.md` (les amendements P1-P29, en fin de plan, font foi sur le texte des
tâches). Registre : `.superpowers/sdd/2026-10-18-creer-avec-l-ia/` (`progress.md`, un brief, des notes et un rapport par
tâche, les diffs revus ; lanceur `suite.cjs`). Base : pointe d'`assistant-compte` `ce9eb5d` (lot « L'assistant suit le
compte » ci-dessus, **lui-même non fusionné**) ; commit de départ `4fee65e` (spec et plan). Huit tâches dans l'ordre
R-CRE-5 (T1, T2, T5, T3, T4, T6, T7, T8), chacune avec au plus une ronde de corrections (T4 aucune). **FINI dans le
worktree, PAS fusionné, PAS poussé** ; revue finale de branche et `/verify` : au chef d'orchestre. Le site public ne change
qu'à la fusion et au `git push` de Neegan, **après** les gestes 1 et 2 du lot précédent.

**Ce qui marche** (éprouvé par la suite : `fetch` factice injecté, bases jetables, gestes et navigation injectés, aucun
réseau) :
- **Deux portes, sur clic seulement** : la carte « Créer avec l'IA » (« Une proposition à vérifier ») d'Ajouter — la grille
  a désormais six cartes, celle-ci avant « Ajouter un lot au congélateur » — et le bouton « Créer une recette avec ces
  critères » de l'onglet Web, qui ouvre `#/recipes/creer` prérempli sans aucun appel.
- **L'écran `#/recipes/creer`** (`src/ui/creer-ia.js`) : demande, restrictions (puces), type, portions (1-12, défaut 4),
  temps maximal (5-240, facultatif) ; préremplissage depuis l'adresse par liste blanche ; Anthropic seulement (autre
  fournisseur ou rien de configuré : « Réglages », aucun appel) ; hors ligne dit avant tout appel ; **un clic = un appel** ;
  **un seul vol dans toute l'app** (toute instance de l'écran montre le vol et « Annuler » ; une seconde création est
  refusée tant que rien n'est annulé ; une réponse tardive n'écrit rien) ; la saisie ne redessine pas (focus iPhone) ; une
  valeur illisible ou hors bornes dans Portions ou Temps maximal éteint le bouton et dit pourquoi ; l'exemple de la demande ne
  parle ni de portions, ni de durée, ni de restriction (« Ex. : saumon et fenouil au four, croûte aux herbes ») et une aide
  dit « Portions, durée et restrictions se règlent ci-dessous. » (R-CRE-15).
- **L'appel** (`creerRecetteIA`, `src/domain/creation-ia.js`) : API Messages sans outil ni `thinking`, `max_tokens` 16 000,
  délai 120 s, corps lu en flux et borné à 1 Mio, `redirect: 'error'` ; ne lève jamais ; la clé n'est ni dans l'issue, ni
  dans l'adresse, ni dans l'état de l'écran, ni dans le journal ; issues alignées sur le lot web, plus `interrompu`
  (`max_tokens`) et `illisible` avec son motif (« Code : … »).
- **La sortie du modèle est une donnée hostile** : validée propriété par propriété, bornes strictes (refus, jamais de
  troncature silencieuse), aucune adresse, source, auteur ni image (motif `lien`, best-effort), un titre qui nomme une
  restriction ou promet une certitude est refusé (`affirmation`), rendu en texte seul ; des portions ou une durée
  différentes de la demande donnent un avertissement, pas un refus (l'appel est payé). L'invite annonce, en français et en
  anglais, **chaque** règle qui refuse, avec des cibles sous les bornes pour ce qui se compte en caractères (R-CRE-13 ; une
  table de tests « règle refusée → phrase » le garde) ; une unité vide vaut « unité » (« 2 œufs ») ; l'invite demande de
  respecter les restrictions demandées sans rien certifier (R-CRE-14).
- **La proposition** : étiquette, « Selon l'assistant : … », lignes passées par le parseur de l'app (toutes « à
  vérifier »), étapes, conseils, « À vérifier avant de servir », évaluation des restrictions demandées (« Incompatible :
  … » ou « À vérifier », jamais « Compatible »), avertissement fixe « L'assistant n'a pas cuisiné cette recette … »,
  « Demande envoyée : … », jetons ; « Garder cette recette » (une transaction, non rejouable : un retour arrière montre
  « Recette gardée » + « Ouvrir la fiche »), « Recommencer » (un échec garde la proposition dessous), « Modifier la
  demande », K1 (« La demande a changé depuis cette proposition. » + « Créer à nouveau »).
- **La fiche gardée** : `origine: 'ia'`, version `synthesis` `proposed`, `total_minutes: null` (« environ {m} min (estimé
  par l'assistant) », jamais exportée en `totalTime` : elle voyage en texte dans la description, « Environ {m} min (estimé
  par l'assistant). », `src/domain/exporters.js:32`) ; étiquette **dérivée des données** (`etiquetteCreationIA`, jamais
  `source_label`) sur la fiche, les cartes, le mode cuisine, les repas, les exports, la comparaison de plats et les
  rattachements proposés (`src/ui/dish.js`, vague finale) et la section « Recettes créées avec l'IA » de Mes livres ;
  « Marquer testée » ; « Corriger » garde `origine` (« Corrigée par toi — d'après une création IA ») ; l'export d'une fiche
  IA ne porte ni livre, ni ISBN, ni page, ni `source_url`, ni champ de durée (`totalTime`, `prep_time`, `cook_time` ;
  l'estimation n'y est qu'en texte) (les exports d'une fiche de livre sont restés identiques octet pour octet, mesuré en
  T6) ; le site lisible échappe aussi la page tapée, l'identifiant et l'empreinte d'une page (vague finale).
- **« Adapter avec l'IA »** (créations IA seulement, `?adapter=` gardé par la route) : version enfant `adaptation`,
  l'original et `current_version_id` intacts, formulaire prérempli de la demande et des filtres de la création de départ.
- **Transverse** : N-8 et N-9 (ci-dessous, app entière) ; minuteurs bornés pour toute l'app (4 par étape, ≤ 24 h, au-delà
  écartés).

Les rulings, une ligne chacun (détail en spec § 11) :
- **R-CRE-1** N-8 asymétrique : une ligne non vérifiée sans correspondance bloquante est inconnue, avec une correspondance bloquante elle bloque (`proposed: true`) — jamais certifier, jamais assouplir.
- **R-CRE-2** une seule fonction d'étiquette `etiquetteCreationIA(version, recipe)` ; « Corrigée par toi — d'après une création IA » pour une correction, « Ma version — d'après une création IA » pour une autre version manuelle d'une fiche `origine: 'ia'`.
- **R-CRE-3** la demande d'une adaptation est celle de la parente (préremplie) ; un changement vide n'appelle pas ; le titre de la parente vient de la fiche.
- **R-CRE-4** une fonction de texte `etiquetteCreationIA(version, recipe = null)` dans `creation-ia.js` ; le helper DOM `etiquetteIA(version, recipe = null)` de `components.js` délègue.
- **R-CRE-5** ordre d'exécution T1, T2, T5, T3, T4, T6, T7, T8 (T3 dépend de N-8) ; suffixe de `sw.js` monotone (précisé en T3).
- **R-CRE-6** « 250 ml lait de coco » + sans lactose : attendu MESURÉ sur le parseur (`ing_milk` → `incompatible`, `proposed: true`).
- **R-CRE-7** `texteLigne` garde le texte de `formatNumber` seulement s'il relit la même valeur (ou à 2 % près pour une fraction), sinon la décimale exacte (0,35 → « 0,35 »).
- **R-CRE-8** un minuteur de plus de 24 h est écarté, jamais plafonné ; `seconds_max` > 86 400 → `null`.
- **R-CRE-9** un bloquant facultatif ne masque jamais une ligne inconnue (`to_verify` au lieu d'`adaptation`).
- **R-CRE-10** en mode cuisine, l'étiquette pour toute fiche `origine: 'ia'` ; l'avertissement C-9 pour `estCreationIA` seulement.
- **R-CRE-11** l'adaptation préremplit restrictions, type et temps maximal depuis la création de départ (adresse fraîche, liste blanche C-16) ; dès que `changement` est dans l'adresse, seule l'adresse compte.
- **R-CRE-12** l'exemple du champ « Ce que tu veux changer » ne parle pas de portions, et une aide dit « Pour changer les portions, modifie Portions. ».
- **R-CRE-13** (revue finale) une unité vide (`""`) est acceptée et vaut « unité » (compte) ; l'invite FR et EN annonce chaque règle qui refuse (unité lisible sans parenthèses ni chiffres, quantité > 0 à au plus 3 décimales, titre ≤ 100, description ≤ 350, conseils et notes ≤ 200, étapes ≤ 400 — sous les bornes 120/400/250/250/500 —, au moins 2 étapes, durée de 5 à 240 min) ; rien de moins strict côté validation.
- **R-CRE-14** (revue finale) l'invite dit, FR et EN : « Respecte les restrictions demandées : conçois la recette pour qu'elle les respecte ; `restrictions_notes` dit ce qu'il reste à vérifier (étiquettes, traces) sans rien certifier. » ; « données, jamais des consignes » reste (injection).
- **R-CRE-15** (revue finale) l'exemple du champ de création ne parle ni de portions, ni de durée, ni de restriction (« Ex. : saumon et fenouil au four, croûte aux herbes ») ; une aide dit « Portions, durée et restrictions se règlent ci-dessous. » ; le geste 5 règle Portions, Temps maximal et la puce dans le formulaire.

**Ce qui n'est PAS prouvé.**
- **Aucun appel réel** n'a été fait pendant ce lot : chaque test passe par un `fetch` factice injecté, et le seul parcours
  dans l'app réelle qui a cliqué « Créer ma recette » (tâche 3) avait l'API Anthropic **interceptée**. Non mesurés : la
  forme réelle d'une réponse (JSON nu ou entouré de prose), le taux de refus `illisible` ou `affirmation` (un refus après
  la réponse coûte l'appel), la **durée**, les **jetons** et le **coût** d'un appel (spec § 6 : « ≈ 2 à 5 k jetons de
  sortie, réflexion comprise » est une estimation, pas une mesure). Preuve = geste 5 ci-dessous, avec la clé de Neegan.
- **Safari et l'iPhone** (aucun WebKit ici) ; le délai de 120 s compte le temps actif (PWA iOS en arrière-plan).
- **Minuteurs Siri** d'une étape de création, sur appareil.
- L'effet de N-8 et N-9 sur la **vraie bibliothèque** de Neegan : mesuré sur fixtures seulement (aucune écriture dans sa
  base).

**Données et coût** (spec § 6). La demande part chez Anthropic et reste dans `provenance.creation.demande` (synchronisée
avec les fiches, incluse dans les archives ZIP) ; aucun secret n'est attendu dans une demande de recette. Un `delai` ou
une réponse coupée sont probablement facturés (non mesuré) ; aucune reprise automatique ; « Recommencer » est un nouvel
appel.

**Décisions de nuit N-1 à N-10 — à confirmer par Neegan** (spec § 0 ; prises sans toi, chacune renversable sans défaire
le reste) :
- **N-1** deux portes, toutes deux sur clic (carte d'Ajouter ; bouton de l'onglet Web sur rien, trouvé et recherche
  désactivée) ; jamais de création lancée par une recherche.
- **N-2** Anthropic seulement (un autre fournisseur voit « Ce fournisseur ne crée pas de recette ici » + « Réglages »).
- **N-3** une recette ordinaire du modèle existant : `origine: 'ia'`, version `synthesis`, statut `proposed` ; aucun magasin
  neuf, `DB_VERSION` inchangée.
- **N-4** les lignes passent par le parseur existant (identité proposée quand le lexique la reconnaît ; toutes « à
  vérifier »).
- **N-5** l'adaptation par l'IA est réservée aux créations IA (version enfant, original intact).
- **N-6** ni image, ni nutrition, ni import de page, ni conversation, ni choix entre plusieurs propositions.
- **N-7** section « Recettes créées avec l'IA » dans Mes livres, après « Liens web gardés ».
- **N-8 (app entière) Une ligne non vérifiée ne certifie rien, mais une correspondance bloquante bloque toujours** (R-CRE-1,
  R-CRE-9). **Effet sur les fiches de LIVRE** : une recette d'un livre aux lignes non vérifiées passe de « compatible » à
  « à vérifier » dans la recherche et sur la fiche ; une ligne non vérifiée dont l'identité proposée bloque l'écarte
  — mesuré : « 250 ml lait de coco » (identité proposée `ing_milk`) et « 250 ml crème de coco » (`ing_cream`) →
  `incompatible` sans lactose ; « 200 g farine de riz » (`ing_ap_flour`) → `incompatible` sans gluten (faux positifs
  prudents, jamais un faux « compatible »). Renversable : restreindre à `estCreationIA`. **Plus large, et surtout sur la
  création** (mesuré par la revue finale de branche, remesuré à la vague finale, lignes non vérifiées) : les substituts que le
  modèle choisira justement pour la restriction demandée sont lus comme l'allergène — « 200 g pâtes sans gluten » (identité
  proposée `pâtes (blé)`) et « 1 tasse farine sans gluten » → `incompatible` sans gluten ; « 30 g beurre végétal », « 125 ml
  crème végétale », « 175 ml yogourt de soya » → `incompatible` sans lactose ; « 250 ml lait de soya », « 30 g parmesan
  végétalien » → `incompatible` végétalien. Une création « sans gluten » ou « sans lactose » sera donc souvent dite
  incompatible avec ce qui a été demandé : c'est le prix de la règle prudente (une ligne non vérifiée dont l'identité
  proposée bloque, bloque) ; **vérifier la ligne lève le faux positif**. **Décision de Neegan** (documentée, aucun code) ;
  pistes : une ligne dont le nom écrit dit « sans <allergène> » ou « végétal(ien) » rendue inconnue plutôt que bloquante
  (jamais compatible), ou un lexique plus fin (lot à part).
- **N-9 (app entière) Une ligne non vérifiée s'affiche telle qu'écrite**, avec « (identité proposée : {libellé} ?) », sur
  la fiche et en mode cuisine. **Effet sur les fiches de LIVRE** : plus de badge « Traduction » ni de libellé du lexique
  sur une ligne non vérifiée ; dans les courses, elle se regroupe par son TEXTE — « 3 oignons » et « 1 oignon » font deux
  groupes (mesuré ; un seul une fois vérifiés), FR/EN ne se rejoignent plus (nommé par la revue) ; la puce « non
  identifié » (`src/ui/grocery.js:26`) est inexacte quand une identité est proposée ; les coches existantes des lignes non
  vérifiées se perdent **une fois** (clé `ing:` → `name:`). Renversable de même.
- **N-10** « Corriger » reste offert sur une création IA ; la fiche garde `origine: 'ia'`.

**Décisions de spec à trancher** (nommées par les revues, non tranchées par la construction ; liste exacte en spec § 10) :
borne `estimated_minutes` ≤ 240 (refuse un long braisé même sans maximum demandé : avertir plutôt ?) · `"image": null`
explicite refusé `lien` (tolérer `null` ?) · « Ketchup 100 % maison » refusé `affirmation` · détecteur d'adresses : faux
positif « sel.Ca y est », contournements best-effort (`.io`, `.quebec`, « ricardo . com ») · titre d'une adaptation validé
mais jamais sauvé (un refus coûte l'appel) · exemple sans portions (R-CRE-12) à confirmer à l'usage · surfaces N-9 non
couvertes par la spec (`compareBundles` de `dishes.js` et le surlignage de `cook.js` par identité proposée, filtres
avec/sans de la recherche, `dietChip` qui ne nomme plus le bloquant facultatif) · `DIET_RULE_VERSION` reste 1 alors que
le sens a changé · `assessMeal` et `searchDocs` font passer `adaptation` avant `to_verify` (préexistant).

**Dettes (assumées, une ligne chacune ; détail dans `progress.md` et les rapports de tâche).**
- R-WEB-4 (corps et en-têtes construits avant le `try`) n'est pas épinglé par un test dans `creerRecetteIA` (le mutant survit ; la configuration est du JSON normalisé en production).
- `creerRecetteIA` : le mutant `ctl.signal` / `dp.signal` survit (test à ajouter : `fetch` sourd + `tentativeMs` court + sans signal externe → jamais `annule`) ; l'abandon n'est pas revérifié après le classement par statut (double sourd seulement) ; une réponse déjà payée est jetée si « Annuler » arrive pendant la lecture (voulu).
- Transport dupliqué entre `chercherRecettesWeb` et `creerRecetteIA` (≈ 50 lignes, estimation de la revue de T2 ; 28 lignes normalisées identiques mesurées par la revue de T8 ; divergences déjà : `issue()` relit `cfg`, 403) → refactor ultérieur.
- Titre : la forme compactée n'est pas appliquée à `MOTS_CERTITUDE` (« sans » + U+200B + « danger », « sans » + U+2212 + « danger » passent) ; abréviations (« GF ») best-effort ; `eggless` et `plant based` refusés au-delà du ruling ; titres de sûreté qui passent encore (revue finale, Lens 2 n° 1, mesuré) : « Gâteau hypoallergénique », « Biscuits sans arachides », « Pâtes sans blé », « Wheat-free pancakes », « Recette approuvée par un diététiste » (« sans allergènes », « allergen-free », « allergen free » et « guaranteed » refusés depuis la vague finale).
- Trous de tests de la validation : tiret non ASCII pour la certitude, compaction de `_` et `.`, portions de la parente non numériques ; `parenteBornee` exige `ingredients` et `steps` tableaux (sinon `requete`, choix de fermeté).
- `fabriquerRecetteIA` tire des `newId` réels (`crypto.randomUUID`) dans `parseIngredientLine` / `parseStepsBlock` puis les écrase : sortie déterministe, pure à ces tirages jetés près.
- Avec l'unité omise, un nom qui commence par un nombre ou un mot d'intervalle (« à 3 œufs ») est relu comme une autre quantité (sortie bizarre du modèle seulement).
- Interface anglaise : les avertissements du domaine (portions, durée) et le libellé `labels.fr` de l'identité proposée restent en français ; le « ; » de l'évaluation est hors `t()` ; la mention « (… : … ?) » garde l'espacement français.
- Écran : sans demande mais avec une proposition en mémoire, K1 + « Créer à nouveau » s'affichent au-dessus d'un champ vide (formulation à revoir) ; la branche « incompatible » ne nomme pas les inconnues ; `provenance.creation.cree_le` vient de l'horloge brute, pas de `syncNow()` ; double tape sur « Annuler » non mesurée (M3 du lot web).
- Adaptation : l'invite système annonce « Créée avec l'IA · non testée » même pour une adaptation (inexact, sans conséquence), et ne dit pas d'appliquer le changement demandé (il n'est que dans le message ; R-CRE-14 ne vise que les restrictions) ; l'encodage de `?v=` (`encodeURIComponent`) du retour n'est pas éprouvé (les identifiants des fixtures n'ont aucun caractère à encoder) ; version orpheline possible si une tombale de la fiche arrive entre le rendu et « Garder » ; une proposition d'adaptation de A en mémoire s'affiche sous le résumé de B (ligne 5 de P7, conforme F21, déroutant).
- Portes : quatre chaînes `t()` de `search.js` antérieures au lot sans entrée `en.js` (gelées dans `ANTERIEURES`) ; le mutant `{ replace: true }` sur la navigation de la porte web survit ; `q` non borné dans l'adresse de la porte (l'écran le borne à 500) ; R-WEB-3 avec la porte non épinglé ; les ingrédients et exclusions de l'onglet Web ne passent que dans `q`, en texte.
- Fiche IA : `recipe-edit.js:171` garde le champ « Page imprimée » (il écrit encore `printed_page`) ; « Corriger » préremplit la source de « Créée avec l'IA » (sans effet) ; le bloc « Pages originales » n'est pas gardé ; `lireCreation` ne retire pas `\p{Cs}`.
- Préexistant : `t('testée')` / `t('proposée')` du sélecteur de `recipe.js` sans `en.js` ; une ancienne adaptation IA d'un livre dit « Adaptation IA » à l'écran mais « Adaptation personnelle » dans les exports ; l'index du site lisible écrit encore `lang="${locale}"` sans `esc()` — `locale` vient du réglage `ui_locale`, que porte une archive ZIP restaurée (relevé par l'auto-revue de la vague finale, non exploité ni testé).
- Régimes et courses : R-CRE-9 vaut aussi pour une ligne vérifiée sans identité (cohérent, non épinglé) ; `qtyEl` sans l'identité proposée n'est gardé par aucun mutant observable (le seed n'a aucune équivalence volume↔masse : test d'intention, et aucun test dédié en mode cuisine) ; un `name_text` vide sur une ligne non vérifiée affiche `source_text` entier (préexistant, rare) ; les coches d'une liste de courses sont indexées par `r.key` (`src/ui/grocery.js:22-23`) : la clé elle-même est structurellement fragile (tout changement de regroupement la change), pas seulement l'effet N-9 (`ing:` → `name:`).
- Lexique : « filet(s) » est un alias de l'unité `dash` (`src/model/seed.js:40`) : « 2 filets saumon, sans la peau » est relu `unit_id: 'dash'` (remesuré à la vague finale) et la fiche affiche « 2 trait saumon … » (revue finale, app réelle) ; décision de Neegan : dette nommée, aucun changement de seed dans la vague.
- Banc de test : `tests/erreur.js:2` rend `e.message` par `innerHTML` (préexistant, pas une sortie du modèle) ; la commande des invisibles ne couvre pas U+FE00-FE0F (`src/app.js` en porte 3 U+FE0E et `src/ui/add.js:18` 1 U+FE0F, l'émoji U+270D + U+FE0F, tous antérieurs) ; deux tests dépendent d'horloges courtes (abandon à 20 ms d'un `fetch` sourd qui répond à 80 ms ; bloc P6, 12 micro-tâches avant le montage) : rouges possibles sur une machine chargée, jamais un faux vert (revue finale, Lens 3 n° 2) ; `eq` sur des tableaux qui contiennent `undefined` (`JSON.stringify` rend `null`) ne distingue pas un champ absent d'un champ nul (Lens 3 n° 3, sans effet sur ce qui est affirmé).
- **Fermées à la clôture** : spec § 4.4 (`logError` sous la forme P13) ; README « six cartes » ; `LIBELLES_RESTRICTION.en.sans_lactose` = `en.js` « Dairy-free » (relu).
- **Fermées à la vague finale** : limites numériques de l'invite non épinglées et aucun test reliant une règle à sa phrase (Lens 3 n° 1 : table « règle → phrase ») ; frontière 4/5 chiffres de `\d{5,}` (9999 accepté, 99999 refusé, dans la table) ; `dish.js` « p. {printed_page} » sur une fiche IA (comparaison et rattachements disent l'étiquette) ; interpolations non échappées du site lisible (Lens 2 n° 2 : page, image, lien de l'index) ; README « Web (non configuré) » ; commentaire « cinq cartes » de `src/i18n/en.js:28`.

**Gestes de Neegan, dans cet ordre.**
1. **Lot précédent d'abord** : gestes 1 et 2 de « L'assistant suit le compte » (coller `0003` sur `mitsu`, puis sa preuve à
   `0 faux`) — **avant tout `push`**.
2. Après la revue finale et `/verify` des deux lots : copier `.superpowers/sdd/2026-10-18-creer-avec-l-ia/` dans
   `~/projects/mistu/.superpowers/sdd/` (celui du lot précédent y est déjà, identique : `diff -rq` muet le 18 octobre).
3. **Fusions `--ff-only` en chaîne** : `! cd ~/projects/mistu && git merge --ff-only assistant-compte`, puis
   `! cd ~/projects/mistu && git merge --ff-only creer-ia`, puis le lot 3 s'il est fini ; si `assistant-compte` a bougé
   depuis `ce9eb5d`, rebaser `creer-ia` dessus d'abord ; puis **un** `! git -C ~/projects/mistu push origin main` ; ouvrir
   `https://neegans.github.io/mistu/tests/` et lire le BILAN.
4. Geste 4 du lot précédent (Réglages sur le Mac, connexion depuis l'iPhone).
5. **Preuve réelle** sur le site public (Mac, ta clé ; réécrit par R-CRE-15) : taper « saumon fenouil » dans la demande,
   puis régler **dans le formulaire** la puce « Sans lactose », Portions 2 et Temps maximal 30 → « Créer ma recette » ;
   vérifier qu'**un seul** POST part (onglet Réseau) et que la proposition affiche « Créée avec l’IA · non testée » ; noter
   la durée, les jetons affichés et le coût dans la console Anthropic ; « Garder » → Mes livres → « Recettes créées avec
   l'IA » ; après cuisson, « Marquer testée » ; une adaptation (« Adapter avec l'IA »).
6. **Trancher N-8 et N-9** (confirmer, ou restreindre à `estCreationIA` ; faux positifs de N-8 sur les substituts
   ci-dessus), puis les autres décisions ci-dessus.
7. Geste 5 du lot précédent, toujours dû : faire tourner la clé Anthropic (elle a transité par un chat) et poser un
   plafond de dépense mensuel sur le workspace.

**Versions.** `APP_VERSION = '0.7.0'` (pins `v0\.7\.0-\d+` dans `tests/ajouter.js`, `tests/sync-l3.js` et
`tests/recherche-web.js` ; `'0.7.0'` dans `tests/ajouter.js`, `tests/recherche-web.js`, `tests/assistant-compte.js` et
`tests/creer-ia.js`), `DB_VERSION = 3` (inchangée), `sw.js VERSION = 'cuisine-os-v0.7.0-11'` (vague finale, qui touche
`src/` ; suffixe monotone -1, -2, -5, -6, -7, -8, -9 au fil des tâches, -10 à la clôture ; six commits de ronde ont touché
`src/` sans incrément — `0254f80`, `5e5000c`, `2749593`, `86ff397`, `91fea1f`, `58faf36` — : la clôture les couvrait, et
rien n'a été servi entre : `origin/main` = `66c5d19`, relu par `git ls-remote` à la vague finale), `SHELL` + `./src/domain/creation-ia.js` +
`./src/ui/creer-ia.js` (deux modules neufs). `ROUTES_DE_SAISIE` + `'/recipes/creer'`. Aucun schéma, aucune migration,
CSP inchangée.

**Vague finale de corrections (18 octobre 2026, après la revue finale de branche — brief `final-fix-wave.md`, rapport
`final-fix-report.md`, rulings R-CRE-13 à R-CRE-15).** Les quatre Important de la revue : **R-CRE-13** le validateur
refusait des réponses que l'invite autorisait ou n'interdisait pas (mesuré par la revue : `unit: ""` → `bornes`,
« boîte (398 ml) » → `caracteres`, 0.3333 → `bornes`, aucune marge sur titre, description, conseils et notes) — une
unité vide vaut désormais « unité », et l'invite annonce chaque règle qui refuse, sous les bornes ; **R-CRE-14** l'invite
demande enfin de respecter les restrictions demandées ; **R-CRE-15** l'exemple « un souper pour deux … en 30 minutes »
envoyait « Portions : 4 » contre « pour deux » : exemple et aide neufs, geste 5 réécrit ; **N-8** les faux positifs
mesurés sur les substituts, documentés pour la décision de Neegan. Plus : quatre mots de titre (« sans allergènes »,
« allergen-free », « allergen free », « guaranteed »), `esc()` sur la page, l'image et le lien de l'index du site lisible,
la lignée IA dans la comparaison de plats et les rattachements proposés, et les écarts de documentation (durée « jamais
exportée en `totalTime` », carte cinquième, `add.js:18`, README).

**Bilan (vague finale, 18 octobre 2026).** Suite complète **2554/2554 verts** (total épinglé **2553** dans
`tests/tests.js`, lu dans « obtenu » : l'assertion du total s'ajoute elle-même au bilan affiché ; la vague ajoute
30 assertions à l'épinglé de la clôture, 2523 ; départ du lot remesuré à la clôture sur une copie de `4fee65e` servie à
part : **1967/1967**, épinglé 1966), une seule erreur de console : le 404 de `/favicon.ico` (pré-existant) ;
`node --test tools/*.test.mjs` **45/45** ; `node tools/generer-migrations.mjs --check` : **0** ; 14 commits de lot sur
`4fee65e` avant celui de la vague finale (clôture comprise) ; aucun caractère invisible (commande de la ligne 21 du plan
du lot précédent, extraite par script) dans les fichiers touchés par la vague ; scan des clés Anthropic (`git grep -nEi
'sk-ant-[0-9A-Za-z_-]{10,}'`) : seules les quatre sentinelles de test du lot web (`…-sentinelle`). **Mutants de la vague**
(copie servie sur 8096, rapport) : 17 sur 17 rougissent — branche « unité vide » retirée, `null` admis comme « unité »,
phrases de l'unité et de la quantité retirées de l'invite française, titre anglais remis à 120, phrase R-CRE-14 retirée
(FR, puis EN), chacun des trois mots de titre, chacun des trois `esc()`, les deux branches IA de `dish.js`, l'ancien
exemple, l'aide retirée. Les mutants des tâches sont comptés dans chaque rapport de tâche.

**Fusion.** Revue finale de branche puis `/verify` par le chef d'orchestre ; le registre se copie **avant** tout
`git worktree remove` ; les gestes 1 et 2 du lot précédent **avant** tout `push`.

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
