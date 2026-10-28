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
- `src/domain/llm.js` : fournisseurs OpenAI-compatible et Anthropic écrits sans appel réel. (Premier appel réel mesuré le 17 octobre 2026, lot « Chercher sur le web » : `AnthropicProvider` via l'API Messages, voir cette section.) **Amendé le 18 octobre par le lot « La passerelle de l'assistant »** : `OpenAICompatibleProvider` est retiré et `AnthropicProvider` est remplacé par `PasserelleProvider` ; l'app n'appelle plus jamais Anthropic directement (voir « La passerelle de l'assistant »).
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

> **Amendé le 18 octobre par le lot « La passerelle de l'assistant »** (branche `passerelle-assistant`, non fusionnée) : l'app n'appelle plus l'API
> Anthropic ; le transport passe par la fonction `assistant` de `mitsu` avec la session de la personne (jamais de clé dans le navigateur) ; les
> raisons `cle_refusee` et `recherche_desactivee` n'existent plus, et la porte « Créer une recette avec ces critères » qui s'affichait sur cette
> dernière a disparu avec elle ; le délai client est de 135 s (et non plus 45 s). Ce qui suit décrit le lot tel qu'il était à sa clôture.

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
- **M3** à 390 px, après une tape sur le « Chercher à nouveau » de K1 (y 684-726), « Annuler » de l'écran du vol arrive à y 649-691 et x 33-117 : une bande de 7 px chevauche le haut à gauche de l'ancien bouton, une double tape précise pourrait annuler un appel facturé (mesuré le 17 octobre, non corrigé). **Fermé par la géométrie le 18 octobre** (lot « Refonte visuelle », R-VIS-8, non fusionné) : « Annuler » se range à droite pendant un vol, 0 recouvrement mesuré à 375, 390, 768 et 1512 px (Chrome sans tête).
- **Perf** un `Intl.DateTimeFormat` est construit par carte et par rendu (négligeable ; deux formateurs en cache suffiraient).

### L'assistant suit le compte (17-18 octobre 2026)

> **Amendé le 18 octobre par le lot « La passerelle de l'assistant »** (branche `passerelle-assistant`, non fusionnée) : la clé ne vit plus dans le
> navigateur ni dans Réglages (la section est à deux états, sans champ) ; une passe vide toute clé trouvée dans `assistant_config`, à chaque
> démarrage (sans garde à usage unique depuis la vague finale) ; le magasin et `assistant-config.js` restent (dette). Ce qui suit décrit le lot
> tel qu'il était à sa clôture.

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

> **Amendé le 18 octobre par le lot « La passerelle de l'assistant »** (branche `passerelle-assistant`, non fusionnée) : la création passe par la
> fonction `assistant` (outil `creation`), avec la session ; sans session, l'écran dit « Connecte-toi pour utiliser l’assistant. » ; plus de clé ni
> de fournisseur à choisir ; le délai client est de 135 s (et non plus 120 s). Ce qui suit décrit le lot tel qu'il était à sa clôture.

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
- Écran : sans demande mais avec une proposition en mémoire, K1 + « Créer à nouveau » s'affichent au-dessus d'un champ vide (formulation à revoir) ; la branche « incompatible » ne nomme pas les inconnues ; `provenance.creation.cree_le` vient de l'horloge brute, pas de `syncNow()` ; double tape sur « Annuler » non mesurée (M3 du lot web ; R-VIS-8 du lot « Refonte visuelle » range « Annuler » à droite ici aussi, épinglé dans une scène de `tests/theme.js`, non mesuré sur cet écran).
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
   `! cd ~/projects/mistu && git merge --ff-only creer-ia`, puis `! cd ~/projects/mistu && git merge --ff-only refonte-visuelle`
   (lot 3, « Refonte visuelle ») ; si `assistant-compte` a bougé
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

### Refonte visuelle « magazine » (18 octobre 2026)

**Pour toi.** L'app change d'habit, pas de gestes : papier ivoire, grands titres en serif (Georgia, police du système : rien à télécharger), une
seule couleur d'action — la tomate des boutons principaux, des liens, de l'onglet actif et de l'anneau de focus — et le vert gardé
pour les états (« Original », « ok », couvertures sans image). Mêmes écrans, mêmes boutons, mêmes textes ; à l'écran, « Annuler » se
range à droite pendant un vol (recherche web ou création en cours ; R-VIS-8, à confirmer), les segments des Réglages ne s'étirent plus,
la puce bascule cochée passe en vert, les coins des couvertures sont arrondis. Rien n'arrive sur le site public avant la fusion et ton
`push`.

**Où.** Branche `refonte-visuelle`, worktree `~/projects/mistu-look` (jamais `~/projects/mistu`), serveur de vérification
`http://localhost:8085/` (suite : `http://localhost:8085/tests/`). Spec : `docs/superpowers/specs/2026-10-18-refonte-visuelle-design.md`
(rév. 2, amendée à la clôture ; **§ 0** : décisions de nuit V-1 à V-6 ; **§ 2** : invariants T-1 à T-11 ; **§ 5** : dettes ; **§ 7** :
revue R1-R19 ; **§ 8** : rulings R-VIS-1 à R-VIS-14). Plan : `docs/superpowers/plans/2026-10-18-refonte-visuelle.md`. Registre, **hors
git** (`.superpowers/` est exclu par `.git/info/exclude`) : `.superpowers/sdd/2026-10-18-refonte-visuelle/` (`progress.md`, un brief,
des notes et un rapport par tâche, les diffs revus ; lanceur `suite.cjs` ; outil de preuve `preuve-visuelle.cjs`, page
`galerie.html`, résultats `resultats*.md` / `.json` et `captures/`). Base : pointe finale de `creer-ia` `237047a` (lot 2 ci-dessus,
**lui-même non fusionné** sur le lot 1 `ce9eb5d`, **lui-même non fusionné** sur `main` `66c5d19`) ; commit de départ `174415b` (spec et
plan rév. 2). Trois tâches de construction (T1 jetons, base et coquille ; T2 composants ; T3 galerie, preuve et retouches mesurées)
et cette clôture ; T1, T2 et T3 revues (conformes à la spec, qualité approuvée ; les points de documentation de la revue de T3 sont
repris ici et dans la spec) ; puis la **vague finale** après la revue finale de branche (brief `final-fix-wave.md`, rapport
`final-fix-report.md`, rulings R-VIS-13 et R-VIS-14).
**FINI dans le worktree, PAS fusionné, PAS poussé** ; re-revue ciblée et `/verify` : au chef d'orchestre. Fichiers du lot : `styles.css`
(260 → 317 lignes ; 315 à la clôture), `index.html` et `manifest.webmanifest` (deux lignes chacun), `sw.js` (`VERSION` seulement), `tests/theme.js`
(neuf), `tests/tests.js` (import, appel, total épinglé) ; **aucun fichier de `src/`** (`git diff --stat 237047a..HEAD`).

**Ce qui marche** (mesuré dans Chrome sans tête — la suite, et une preuve visuelle Playwright dédiée, jamais le navigateur MCP
partagé —, service worker bloqué, réseau externe coupé ; aucun appareil) :
- **Le thème est lu et mesuré par la suite** (`tests/theme.js`, 79 assertions — 69 à la clôture —, dernier bloc avant le total épinglé) : les 29 jetons de
  la spec § 3.1 et 6 alias dans `:root`, aucune couleur en dur ailleurs que `#fff` et `#222`, inventaire exact des `display: none` (les cinq
  d'origine), `[hidden]` imposé, `:focus-visible` tomate 2 px, mouvement réduit, `color-scheme: light`, `theme-color` et manifeste
  `#f8f5ef`, barre d'état `default` ; puis la feuille injectée dans une scène hors écran : cibles, rayons, focus, contraste rendu des
  composants, et les retouches R-VIS-3, 5, 6, 7, 8, 10, 11 ; depuis la vague finale, les règles qui portent le comportement (R-VIS-14 :
  `.status` après `.row`, `.row` en `wrap`, la mention K1 en `inline-flex`, `summary` du menu, `.cover-wrap`, `.toast` et
  `main.content` calés sur `--nav-h + --safe-b`), `h2` serif et `.mirror` sans, le contour tomate du champ focalisé et l'anneau des
  onglets bas rentré de 3 px.
- **Paires calculées** (recalculées à la vague finale sur la feuille de la vague, par la formule du test) : les **28** paires
  texte/fond de la spec § 3.6 sont ≥ 4,5 — minimum **4,62** (ambre sur accent-bg : `.cook .ingredients li.hit .est`, la 28e, qui
  valait 4,49 avec l'ancien `--warn` et manquait à la liste : R-VIS-13), puis 4,63 (gris sur action-bg) ; ambre sur warn-bg 5,00,
  sur papier 5,16, sur carte 5,52 ; papier sur accent-2 5,01, papier sur accent 6,38, tomate sur carte 5,76 ; contour des champs 3,43
  sur blanc et 3,16 sur papier (≥ 3). (À la clôture : 27 paires, minimum 4,63.)
- **Géométrie** (mesurée par les tâches 1 à 3 dans l'app réelle, contextes jetables, porte passée par « Continuer sans compte ») :
  barre haute **64 px** ; marque 44 px de haut, roue 44 × 44, pilule de recherche ≥ 44 × 44 (R-VIS-3) ; onglets bas 63 px ; pastille
  « Ajouter » 40 × 40 ; `.btn` ≥ 44, `.btn.small` 36 ; champs 16 px, 44 px de haut, contour `#8f8a80` (adresse du signet et clé de
  Réglages compris) ; à 1512 px, le panneau latéral démarre sous la barre (`--topbar-h`, 64 px).
- **Preuve visuelle** (relancée par la vague finale, `preuve-visuelle.cjs 8085` sans `--setcontent`, sur le thème servi après
  R-VIS-13, le 18 octobre à 14 h 08 UTC ; l'ancien `resultats.md` archivé en `resultats-t4.md`) : verdict **VERT, code de sortie 0** ; **40 lignes sur 40** — dix par largeur, à 375, 390, 768 et 1512 px : la
  porte, sept écrans (`#/`, `#/search?mode=web`, `#/library`, `#/add`, `#/recipes/creer`, `#/settings`, `#/kitchen`), la galerie et son
  dialogue modal — sans débordement, navigation, cibles, contraste, `[hidden]` et console : ok partout ; contraste **rendu** minimum
  **4,62** sur **1 760** nœuds texte (lu dans `resultats.json` ; la galerie montre désormais une ligne surlignée du mode cuisine avec
  sa quantité estimée, ambre sur accent-bg, et un titre web long) ; **M3** : 0 recouvrement entre « Chercher à nouveau » et « Annuler » aux
  quatre largeurs (« Annuler » à x 255-342 à 375 px, x 270-357 à 390 px) ; **M14** : focus au clavier réel, 20 cibles sur 20, anneau
  tomate entier ; 0 requête externe, 0 erreur console ; **136 captures**. Avant la vague : la tâche 3 (13 h 11 UTC, trois minutes avant
  `332d818`), puis la revue finale et le contrôleur sur `77e0218` (sans `--setcontent`) : identiques — 40/40, 136 captures, minimum
  4,67 sur 1 732 nœuds. Contre-preuves de l'outil : la même preuve sort ROUGE sur l'ancien thème (feuille de `174415b` forcée :
  40 lignes fautives sur 40, 331 fautes, `resultats-ancien-theme.md`), sur le thème de la tâche 2 (32 lignes fautives, 74 fautes,
  `resultats-t2.md`) et, pour la vague, sur la galerie avec l'ancien `--warn` forcé (copie servie à part, 390 px : code 1, 2 nœuds
  `span.est` à 4,49).
- **Mutants** (copies servies à part, comptés dans les rapports de tâche) : 14 sur 14 (tâche 1), 24 sur 24 plus deux témoins de faux
  rouge restés verts (tâche 2), 18 sur 18 (tâche 3) rougissent ; la revue de T1 en a fait rougir 11, celle de T2 10, et les cinq
  survivants de la revue de T2 (focus de `.btn.active`, décalage −3 px des segments, `.btn.primary` en gris, `.chip.removable` 32 px,
  `.search-bar input` 52 px) sont tués par les assertions de la tâche 3 ; la vague finale : **11 sur 11** sur la suite complète
  (copie servie sur 8191, témoin vert 2633/2633) — les cinq de R-VIS-14 (`.status` avant `.row`, `.row` en `nowrap`, `summary` en
  `block`, `.cover-wrap` en `static`, `.toast` à `12px`), l'ancien `--warn`, l'anneau des onglets sans −3 px, `main.content` décroché
  de `--nav-h`, `input:focus-visible` retirée, `.mirror` en serif, `h2` en sans.
- **Aucun test de comportement retouché** : `tests/tests.js` ne change que par l'import, l'appel du bloc thème et le total.

Les rulings, une ligne chacun (détail et « coût si faux » en spec § 8 ; chacun se renverse sans défaire le reste — R-VIS-2, R-VIS-5
et R-VIS-13 sont imposés par le contraste AA ; R-VIS-4 et R-VIS-8 sont les décisions de produit à confirmer) :
- **R-VIS-1** (pré-vol) `.status[hidden]` du lot 2 retirée, redondante avec `[hidden] { display: none !important }` ; inventaire = les cinq d'origine.
- **R-VIS-2** (pré-vol) `--accent-2: #55705a` : papier sur accent-2 4,33 → 5,01.
- **R-VIS-3** marque et pilule de recherche ≥ 44 px, comme la roue ; la barre garde 64 px ; seuil ±4 px de M3 accepté et nommé.
- **R-VIS-4** (**à confirmer**) sous 440 px, barre, marque et pilule se resserrent : libellé entier de 390 à 439 px (Chrome), coupé à 375 sans pastille et sous 768 avec.
- **R-VIS-5** l'auteur d'une couverture perd son opacité : 4,14 → 5,01 sur accent-2.
- **R-VIS-6** segments d'extrémité arrondis côté extérieur : l'anneau de focus n'est plus coupé aux coins.
- **R-VIS-7** `.cover { position: relative }` : une couverture avec image a ses coins arrondis, image à la même place (0,1 px).
- **R-VIS-8** (**placement à confirmer**, au regard de V-1) « Annuler » rangé à droite pendant un vol (recherche web, création IA) : ferme M3 du lot web par la géométrie.
- **R-VIS-9** segments de l'onglet Web sur deux lignes à 375/390 gardés (une ligne = segments de 38 px).
- **R-VIS-10** puce bascule cochée (capacités d'un appareil) en accent, par `:has(> input:checked)`.
- **R-VIS-11** `.field > .segmented { align-self: flex-start }` : plus de queue vide qui se lit comme un champ.
- **R-VIS-12** survol des boutons sous `@media (hover: hover)` (survol collant sur iOS).
- **R-VIS-13** (vague finale) `--warn: #8b5f10` (était `#8d6111`) : ambre sur accent-bg 4,49 → 4,62 (mode cuisine, `li.hit .est`) ; 28e paire.
- **R-VIS-14** (vague finale) les règles de T-1 qui portent le comportement sont épinglées par `tests/theme.js` ; une réécriture, même légitime, rougit (voulu).
- Retenu par la vague finale, sans numéro : `nav.tabs a:focus-visible { outline-offset: -3px }` (collé au bas de l'écran, l'anneau en sortait).

**Ce qui n'est PAS prouvé.**
- **Safari et l'iPhone** : rien de ce lot n'y a été vu (aucun WebKit ici), donc **à vérifier sur l'iPhone** : la **barre d'état
  `default`** (l'heure en noir sur l'ivoire ; l'app installée doit être **réinstallée** pour relire la balise ; avec `default`, la page
  ne passe plus sous la barre d'état : regarder qu'aucune bande vide ni marge double n'apparaît au-dessus de la barre haute, `--safe-t`
  n'est pas mesuré sur l'appareil) ; l'**onglet actif** (tomate + trait de 2 px ; les émojis des onglets ne prennent pas la couleur) ;
  le **survol collant** (R-VIS-12 n'est éprouvé que par la lecture de la feuille) ; la **marge de 3,4 px** du libellé de recherche à
  390 px (mesurée sous Chrome seulement : si Safari rend plus large, il se coupe) ; Georgia et les capitales des badges sur iOS.
- **320 px avec la pastille** : la barre haute mesure 341 px (21 px de débordement ; T-7 vise 375 et 390 ; ancien thème : 480).
  C'est le plancher de 44 px de la pilule de recherche (R-VIS-3) qui déborde ; et 320 px est la largeur d'un iPhone de 375 ou 390 px
  en mode « Agrandir l'affichage » (revue de T3) : si tu l'utilises, la barre déborde quand la pastille est visible.
- `::backdrop` + `var(--backdrop)` exige Safari 17.4 (sinon : dialogue sans voile, rien de caché) ; `:has()` (R-VIS-10) exige iOS
  15.4 (sinon : puce cochée neutre) ; aucun des deux n'est mesuré sur appareil.
- **R-VIS-8 est un crochet de style** sur une structure du JS (« `.status[role="status"]` suivie d'une `.row` », spec T-1 amendé) :
  l'assertion de `tests/theme.js` construit son propre DOM ; dans l'app, `role="status"` est gardé par les tests de comportement
  (`tests/recherche-web.js:383`, F20 ; `tests/creer-ia.js`, aide `statutVol` l. 554 et 1497), mais une rangée enveloppée ou une classe
  `.status` changée ne serait vue que par la preuve M3, hors git — qui ne joue que la recherche web : sur l'écran de création,
  R-VIS-8 n'est pas mesuré en vrai vol.
- Les huit écrans sont capturés dans des contextes jetables (aucune donnée de ta bibliothèque) : les variantes chargées
  (couvertures avec et sans image, badges, longs titres) ne sont vues que dans la galerie.
- L'anneau rentré des onglets bas (vague finale) est mesuré dans la scène de `tests/theme.js` et au Tab réel dans la galerie (contour
  extérieur 1 px à l'intérieur de l'onglet, 320 × 700 et 375 × 812), pas dans l'app.
- Le site public ne porte rien de ce lot (rien n'est poussé).

**Décisions de nuit V-1 à V-6 — à confirmer par Neegan** (spec § 0 ; prises sans toi, chacune renversable sans défaire le reste) :
- **V-1** un thème, pas une refonte des écrans : jetons, composants, coquille ; aucun bloc déplacé dans le DOM, aucune classe JS
  renommée, aucun flux ni texte changé — R-VIS-8 déplace pourtant « Annuler » à l'écran par la feuille : à trancher avec V-1.
- **V-2** direction 01 « magazine » : papier `#f8f5ef`, encre `#242821`, gris `#636860`, action tomate `#bc3026`, accent vert
  `#45604a`, titres serif système (Georgia), corps sans-serif système, rayon 12, aucune police externe, aucune image d'illustration.
- **V-3** la navigation garde sa structure (onglets bas sur mobile, panneau latéral ≥ 900 px) ; une barre haute « façon maquette »
  sur bureau reste une option.
- **V-4** le vert reste aux états, l'ambre aux avertissements, la brique aux dangers ; la tomate est l'action (boutons primaires,
  liens, actif, anneau de focus).
- **V-5** accessibilité mesurée : contrastes calculés ≥ 4,5, contour des champs ≥ 3:1, cibles ≥ 44 px, focus visible partout,
  mouvement réduit, `color-scheme: light`, champs ≥ 16 px (iOS ne zoome pas), `[hidden]` imposé.
- **V-6** preuve visuelle par un Playwright dédié, quatre largeurs, porte passée, galerie de toutes les variantes, captures.
- **R-VIS-8, à trancher avec V-1** (décision renversable, une ligne de `styles.css`) : « Annuler » rangé à droite pendant un vol.
  Raison mesurée (M3, vrai vol, API interceptée) : sans lui, le thème de la tâche 2 donnait **3 échecs à 390 px** (la largeur d'un
  iPhone 12 à 14) — le centre du bouton qui venait de lancer l'appel tombait dans « Annuler » — et l'ancien thème 3 à 375 px ; avec
  lui, 0 recouvrement aux quatre largeurs. Le retirer rouvre M3.
- **Barre d'état iOS** `default` au lieu de `black-translucent` (spec R6 : en `black-translucent`, iOS écrit l'heure en blanc sur
  l'ivoire, 1,09:1) — à vérifier sur l'iPhone, app réinstallée.
- **Titre d'une page trouvée sur plusieurs lignes** (onglet Web, `a.btn`, `src/ui/search.js:244`) : la pilule devient un **ovale**
  (309 × 88 px à 375, trois lignes, mesuré dans la galerie ; 275 × 88 dans l'app selon la revue finale). Garder, ou un rayon de 12 px
  pour ce cas : capture `captures/375-galerie-boutons.png` (revue finale, Lens 2 n° 3 : à te montrer, pas corrigé d'office).

**Dettes (assumées, une ligne chacune ; spec § 5).**
- Hors lot par décision : mode sombre, barre haute bureau, icônes SVG (les émojis ne prennent pas `color`), police de marque, CSS en ligne de `exporters.js`.
- `.chip.removable` est un `span` cliquable non focalisable ; la case à cocher de `kitchen.js:42` est cachée par un `display:none` en ligne ; pas d'`aria-current` sur l'onglet actif.
- `scrollIntoView({ behavior: 'smooth' })` ignore le mouvement réduit ; « − / + » des portions en 36 px.
- `src/ui/import.js:136` : style en ligne `font-size: .8rem` sur le champ « p. imprimée » (12,8 px : iOS zoome) — dette JS, hors thème.
- Sans assistant configuré, la seule action de `#/recipes/creer` et de l'onglet Web est un « Réglages » de 36 px (`.btn.small`), contre T-4 (« jamais seul sur un geste principal »).
- Segments hors recherche à 36-38 px (T-4 ne les vise pas).
- **Bug préexistant, hors lot** (revue de T3 ; pour un lot de comportement) : dans Réglages, `src/ui/settings.js:43-45` met des segments dans un `label.field` (`field()` rend un `<label>`) : toucher le libellé ou la zone vide du champ active la **première** option — R-UX-8 n'est pas appliqué là ; R-VIS-11 ne règle que l'apparence.
- `.btn.link:hover` et `.item-link:hover h3` restent hors `@media (hover: hover)`.
- `scroll-margin-top` de 72 px suppose une police racine de 16 px ; les assertions de focus dépendent de l'heuristique de Chromium : faux rouges possibles, jamais faux verts.
- R-VIS-4 n'est pas épinglé par la suite (la page de tests est large) : seule la preuve visuelle le mesure.
- R-VIS-8 dépend de la structure posée par `search.js` et `creer-ia.js` : si `role="status"` disparaît, les tests de comportement rougissent ; si la rangée est enveloppée ou `.status` renommée, seule la preuve M3 (hors git) le voit (revue de T3).
- Portée de R-VIS-8 : la règle vise **tous** les boutons non primaires de la rangée ; une future annonce suivie d'une `.row` à deux boutons non primaires ou plus les écarterait tous (un `:last-child` la bornerait).
- L'assertion groupée du contraste rendu de `tests/theme.js` ignore l'opacité (seule celle de l'auteur, R-VIS-5, la compose) ; le souligné tomate d'un segment d'extrémité suit la courbe (R-VIS-6, accepté).
- L'outil de preuve, la galerie, les résultats et les 136 captures vivent dans le registre, **hors git** : ils disparaissent avec le worktree si le registre n'est pas copié.
- Nommées par la revue finale, non corrigées : la liste blanche T-2 (`#fff`, `#222`) est comptée sans vérifier OÙ (une règle neuve `color: #fff` passerait) ; `--safe-t` ignoré par `aside.sidenav` (`top`/`height`) et par `scroll-margin-top` (sans effet en `default`, à refaire si la barre d'état repasse en `black-translucent`) ; titre web sur plusieurs lignes en pilule = ovale (décision ci-dessus).
- R-VIS-14 lit `.toast` et `main.content` par expressions sur les déclarations : une réécriture équivalente (`calc(var(--safe-b) + var(--nav-h) + 12px)`) rougit (voulu).
- Fermées par la vague finale : `.mirror` et `h2` épinglés ; `input:focus-visible` distingué de l'anneau global ; `li.hit .est` dans `PAIRES` et dans la galerie.

**Gestes de Neegan, dans cet ordre** (les trois lots non fusionnés ; la chaîne est linéaire, mesuré par
`git merge-base --is-ancestor` : `66c5d19` ⊂ `ce9eb5d` ⊂ `237047a` ⊂ `refonte-visuelle`) :
1. **Lot 1 d'abord** : coller `0003` sur `mitsu`, puis sa preuve à `0 faux` (gestes 1 et 2 de « L'assistant suit le compte ») —
   **avant tout `push`**.
2. Regarder les captures : `~/projects/mistu-look/.superpowers/sdd/2026-10-18-refonte-visuelle/captures/` (136 PNG nommés
   `<largeur>-<nom>.png`, 34 par largeur : huit écrans dont la porte, 18 sections de la galerie, 5 focus au clavier, 3 de M3) ; la
   galerie elle-même s'ouvre sur `http://localhost:8085/.superpowers/sdd/2026-10-18-refonte-visuelle/galerie.html`. Sur
   `375-accueil.png`, « Restaurer une sauvegarde » paraît survolé : la souris de Playwright est restée au point du clic (rapport de
   la tâche 3). L'ovale du titre web long : `375-galerie-boutons.png`.
3. Après la revue finale et `/verify` des trois lots par le chef d'orchestre, fusions `--ff-only` en chaîne :
   `! git -C ~/projects/mistu merge --ff-only assistant-compte`, puis `! git -C ~/projects/mistu merge --ff-only creer-ia`, puis
   `! git -C ~/projects/mistu merge --ff-only refonte-visuelle` (si une branche a bougé pendant une vague de revue, rebaser la suivante
   dessus d'abord) ; puis **un** `! git -C ~/projects/mistu push origin main`.
4. Suite publique : ouvrir `https://neegans.github.io/mistu/tests/` et lire le BILAN (après la vague finale : 2633/2633, total épinglé
   2632, plus le 404 de `/favicon.ico`) ; service worker `cuisine-os-v0.7.0-25`.
5. iPhone, app **réinstallée** depuis le site public : barre d'état lisible, onglet actif, porte « Kwe. », aucun survol collé après une
   tape, libellé « Qu’est-ce qu’on cuisine ? » ; dire si « Agrandir l'affichage » est activé (la barre déborde alors de 21 px
   avec la pastille) ; puis le geste 4 du lot 1 (connexion depuis l'app installée) et la preuve réelle du
   lot 2 (geste 5 de sa section).
6. Décisions : V-1 à V-6 (renverser V-3 ou V-4 au besoin), R-VIS-8 (« Annuler » à droite), R-VIS-4 (libellé coupé à 375 px) et l'ovale
   des titres web sur plusieurs lignes ; puis
   N-8/N-9 et les décisions de spec du lot 2 (borne de 240 min, etc.).
7. Faire tourner la clé Anthropic (elle a transité par un chat) et poser un plafond de dépense mensuel sur le workspace.
8. « clean » **seulement après** avoir copié les registres dans `~/projects/mistu/.superpowers/sdd/` :
   `2026-10-17-assistant-par-le-compte` (déjà là, `diff -rq` muet contre `~/projects/mistu-web` le 18 octobre),
   `2026-10-17-chercher-sur-le-web` et `2026-10-17-confort-web` (dans `~/projects/mistu-web` : déjà là, vérifiés identiques, `diff -rq`
   muet le 18 octobre — `git worktree remove` de `mistu-web` détruirait les originaux),
   `2026-10-18-creer-avec-l-ia` (copié par le contrôleur, `diff -rq` muet contre `~/projects/mistu-ia` le 18 octobre) et
   `2026-10-18-refonte-visuelle` **avec `captures/`** (une copie du contrôleur existe déjà, mais chaque rapport la périme : la
   recopier **en dernier**, après la revue finale, puis `diff -rq` muet) ; ensuite seulement `git worktree remove` de `mistu-look`,
   `mistu-ia` et `mistu-web`.

**Versions.** `APP_VERSION = '0.7.0'` et `DB_VERSION = 3` inchangées ; `sw.js VERSION = 'cuisine-os-v0.7.0-25'` (vague finale ; -24 à
la clôture, -21, -22, -23 aux tâches 1 à 3 ; la pointe du lot 2 était à -11 : suffixe monotone), `SHELL` inchangé (aucun module neuf : `tests/theme.js` est un
test). Aucun schéma, aucune migration ; CSP inchangée (`index.html` ne change que par `theme-color` et la barre d'état).

**Bilan (vague finale, 18 octobre 2026 — brief `final-fix-wave.md`, rapport `final-fix-report.md`).** Suite complète **2633/2633
verts** (total épinglé **2632** dans `tests/tests.js:210`, lu dans « obtenu » : l'assertion du total s'ajoute elle-même au bilan affiché ;
la vague ajoute 10 assertions au bloc thème, 69 → 79, sur l'épinglé de la clôture, 2622 ; départ du lot sur `237047a`, mesuré par le
contrôleur : 2554/2554, épinglé 2553), une seule erreur de console : le 404 de `/favicon.ico` (journal du serveur de la copie : 12
passages, 12 × `/favicon.ico`, rien d'autre) ; `node --test tools/*.test.mjs` **45/45** ; `node tools/generer-migrations.mjs --check` :
**0** ; cinq commits sur `174415b` (T1, T2, T3, clôture, vague finale) ; aucun caractère invisible dans les huit fichiers de la vague
(commande de la ligne 21 du plan du lot 1, extraite par script) ; scan des clés Anthropic (`git grep -nEi 'sk-ant-[0-9A-Za-z_-]{10,}'`) :
seules les quatre sentinelles de test du lot web (`…-sentinelle`) ; preuve visuelle relancée : code 0, 40/40, 136 captures, minimum
rendu 4,62 sur 1 760 nœuds ; mutants de la vague : 11 sur 11.

**Fusion.** Revue finale de branche puis `/verify` par le chef d'orchestre ; le registre (avec `captures/`) se copie **avant** tout
`git worktree remove` ; les gestes 1 et 2 du lot 1 **avant** tout `push`.

### La passerelle de l'assistant (18 octobre 2026)

**Pour toi.** Plus de clé à taper, à copier ni à synchroniser : tu te connectes et l'assistant marche, sur le Mac comme sur
l'iPhone, pour toute adresse admise de `mitsu` (la liste de la synchronisation, `private.allowed_users`). La clé Anthropic
est un secret du projet Supabase ; l'app n'appelle plus jamais `api.anthropic.com` : elle poste à la fonction `assistant`
avec ta session. Le serveur décide du modèle (`claude-sonnet-5-5`) et du quota : **60 appels par compte et par jour**
(jour UTC : le compte repart à zéro à 20 h à Montréal en heure d'été), modifiable sans redéployer par le secret
`ASSISTANT_QUOTA_JOUR`. Réglages → Assistant n'a plus aucun champ et ne dit rien avant la réponse du serveur : « Vérification de
l’assistant… », puis « L’assistant est actif pour {adresse}. » avec « Modèle en service : … Quota : 60 appels par jour. », ou
« Ce compte n’a pas accès à l’assistant. » seul, ou « Connecte-toi pour utiliser l’assistant. » avec « Se connecter », ou
« L’assistant est indisponible pour le moment. » seul. Sans compte, l'app reste entière ; la recherche web, la création et la
lecture de pages photographiées disent « Connecte-toi pour utiliser l’assistant. » et n'appellent rien. À chaque démarrage d'un
appareil, une passe vide toute clé ou tout fournisseur trouvé dans la configuration locale : la ligne vide part au compte et
l'efface aussi du serveur et des autres appareils. Les pages photographiées sont réduites (1568 px au plus) avant d'être envoyées. Inviter quelqu'un =
l'ajouter à la liste admise, comme pour la synchronisation ; c'est toi qui paies, et le plafond du workspace Anthropic reste
le mur. Rien n'arrive sur le site public avant ta fusion et ton `push` ; `0004` doit être collée avant le premier appel réel.

**Où.** Branche `passerelle-assistant`, worktree `~/projects/mistu-passerelle` (jamais `~/projects/mistu`), serveur de
vérification `http://localhost:8086/` (suite : `http://localhost:8086/tests/`). Spec :
`docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md` (rév. 2 ; **§ 9** : décisions tranchées le 18 octobre ;
**§ 10** : rulings). Plan : `docs/superpowers/plans/2026-10-18-passerelle-assistant.md`. Registre, **hors git** (`.superpowers/`
n'est pas suivi) : `.superpowers/sdd/2026-10-18-passerelle-assistant/` (`progress.md` avec les verdicts de revue, un brief et un
rapport par tâche, les paquets de revue `review-*.diff` ; lanceur `suite.cjs`). Base : `main` `cdbd6e0` ; 19 commits jusqu'à `2a2f838`
(spec, plan ×2, T1 ×2, T2 ×3, T3 ×2, T4 ×2, RESULTATS ×2 du contrôleur, T5a, T5b, vague finale ×2 : `f43e071` serveur, `2a2f838` app). Cinq
tâches, T1 à T5a relues (sonnet ou opus) avec au plus une ronde de corrections ; T5 découpée en 5a (restes parqués, `6d7ed21`), redéploiement
et sondes (contrôleur), 5b (ces documents) ; puis la revue finale de branche (opus : 0 Critical, 3 Important, 11 Minor) et sa **vague
finale** (F-1 à F-14, ci-dessous). **FINI dans le worktree, fonction DÉPLOYÉE sur `mitsu` (version 3, code `2a2f838`), `0004` COLLÉE
et PROUVÉE par Neegan (18 oct, 20 h 40 UTC, `0 faux sur 20`), PAS fusionné, PAS poussé** ; `/verify` : au chef d'orchestre. Fichiers :
- Serveur : `supabase/functions/assistant/{index.ts,logique.js,deno.json,deno.d.ts}` (`logique.js` est pur et tourne sous Node
  et Deno ; `deno.d.ts` ne sert qu'à `tsc`, jamais importé), `supabase/migrations/0004_assistant_journal.sql` (table
  `public.assistant_journal`, vue `public.assistant_usage_jour`, fonction `public.assistant_reserver`),
  `supabase/proofs/0004_assistant_journal.sql`, `supabase/README.md` (étape 10), `supabase/proofs/RESULTATS-mitsu.md`
  (section « Passerelle `assistant` »).
- App : `src/domain/passerelle.js` (neuf : `appelerAssistant`, `etatAssistant`, `echecDomaine`), `src/domain/llm.js`
  (`PasserelleProvider`, `pagePourEnvoi`), `src/domain/recherche-web.js` et `creation-ia.js` (transport seulement), `src/sync/auth.js`
  (`jeton()`), `src/ui/components.js` (`sessionAssistant`, `carteConnexion(connecter, ctx)`, `messageGardeRefusee`, `texteRefusAssistant`,
  `texteEchecAssistant`), `src/ui/settings.js` (section Assistant : sans session, ou avec session et un GET), `src/ui/search.js`, `creer-ia.js`,
  `import.js`, `recipe-edit.js` (gardes), `src/model/repo.js` (`effacerCleLocale`, passe à CHAQUE `init()`, sans garde ; `migrerConfigAssistant`
  exportée pour les tests), `src/app.js` (`installCapture` avant `repo.init()`), `src/i18n/en.js`.
- Tests : `tools/assistant-logique.test.mjs`, `tools/assistant-index.test.mjs`, `tools/faux/supabase.mjs`,
  `tools/generer-migrations.test.mjs` (blocs `0004`, preuve, `index.ts`, README), `tests/passerelle.js` (neuf),
  `tests/assistant-compte.js`, `tests/recherche-web.js`, `tests/creer-ia.js`, `tests/ajouter.js`.

**Ce qui marche, prouvé** (suite navigateur : `fetch` injecté, bases jetables, aucun réseau ; tests Node : faux `Deno`, faux
supabase-js, faux `fetch` ; fonction déployée : neuf sondes `curl` sans dépense — aucun appel réel à Anthropic n'a eu lieu) :
- **L'app n'appelle plus Anthropic.** `git grep -n -E "api\.anthropic\.com|x-api-key|anthropic-dangerous" -- src` est vide
  (relu à la clôture) ; un mutant « `passerelle.js` poste vers `api.anthropic.com` » rougit la suite (2748/2760, T3). Chaque
  appel (recherche web, création, lecture de pages, état de Réglages) part vers `/functions/v1/assistant` avec trois en-têtes
  (`content-type`, `apikey` publique, `authorization: Bearer <access_token>`), `redirect: 'error'`, `credentials: 'omit'` et un
  corps `{ outil, corps }` sans `model`. Sans session valide, aucun `fetch` ne part (`non_connecte`, sept formes de session,
  POST et GET) ; le jeton n'est dans aucun des 86 résultats contrôlés par `JSON.stringify`. Les statuts sont classés (R-PV-1,
  R-T3-4, R-T3-10, R-T3-13), un corps d'erreur n'est jamais rendu, et l'échec d'une lecture de pages garde la classification de la
  passerelle (« (60 appels) » pour un quota écrit, « Trop de demandes… » pour un 429 relayé, « La demande est trop lourde : choisis
  moins de pages. », « Code : … » borné à 40 points de code).
- **Les écrans.** Réglages n'a plus aucun champ (`git grep -n "type: 'password'" -- src/ui/settings.js` vide) et ses états
  sont éprouvés (sans session : une phrase, un bouton, aucun appel — ou, garde de compte refusée, le message de la garde sans bouton ;
  avec session : « Vérification de l’assistant… » SEUL pendant le `GET`, puis, sur un 200, « actif pour {adresse} » et le texte exact
  du modèle et du quota, sur `non_admis` « Ce compte n’a pas accès à l’assistant. » seul, sur un 401 « Connecte-toi… » avec « Se connecter »,
  sur toute autre issue ou sur un 200 sans modèle ni quota « L’assistant est indisponible pour le moment. » seul : « actif » n'est jamais
  dit avant ni sans un 200 lisible). Les quatre écrans qui appellent l'assistant (`search.js`, `creer-ia.js`,
  `import.js`, `recipe-edit.js`) montrent la carte « Connecte-toi pour utiliser l’assistant. » sans session et n'appellent rien ;
  la garde retirée de `search.js` rougit (2729/2742). Plus aucun texte d'écran ne nomme Anthropic
  (`git grep -n "Anthropic" -- src/ui src/i18n` vide).
- **La passe d'effacement** (une douzaine de cas, dont un de bout en bout contre le transport factice en mode `serveur`) : une ligne qui
  porte une clé ou un fournisseur est réécrite vide, d'origine `local`, avec UNE entrée d'outbox ; elle tourne à CHAQUE `init()`, sans
  garde (F-9) : une ligne-clé reçue après le premier démarrage est effacée au suivant ; absente, déjà vide ou incomplète (champs absents),
  elle n'écrit RIEN (mesuré au point d'écriture : 0 / 1 / 0 appels de `db.mutate`) ; la ligne vide gagne contre la clé sur le serveur
  factice et sur un second appareil ; hors production, la clé locale est effacée aussi, sans entrée de file ; sans compte (`getUserId`
  nul), l'entrée d'outbox existe avec `user_id` nul et part sous le premier compte qui se connecte (R-L3-24, F-13).
- **La logique de la fonction** (`logique.js`, 21 tests Node) : liste blanche des champs par outil (`system`, `messages`,
  `max_tokens` ; `tools` pour `recherche-web` seulement), modèle forcé, `max_tokens` ≤ 16 000, bornes en octets (512 Kio ;
  8 Mio pour `extraction`), CORS, relais des statuts (200, 400, 403, 413, 429 tels quels ; 529 → 503 ; le reste → 502 sans
  corps d'Anthropic), journal = compteurs seulement (aucune chaîne du corps ne s'y retrouve).
- **`index.ts`** (23 cas : a-p, puis q, q2, r, s à s4 de la vague finale ; lu par `stripTypeScriptTypes`, faux `Deno`, faux supabase-js,
  faux `fetch`, de vraies `Request`) : ordre des gardes, qui est appelé avec quelle clé (`is_allowed` par la clé publique,
  `assistant_reserver` par la clé secrète), borne AVANT lecture avec annulation du flux, abandon à 120 s exactes (119,999 s non abandonné),
  réponse bornée à 2 Mio d'octets, 429 sur `null`, 502 sur erreur de réservation, exception interne → 502 avec CORS, secrets relus à chaque
  requête, quota borné à l'int4 ; clés Supabase injectées lues sous toutes leurs formes (chaîne nue, liste, objet) avec leur préfixe, repli
  legacy, champ `cles` du `GET` (F-1) ; `GET` sans jeton / non admis refusés sans fetch ni réservation (F-10) ; abandon du client avant,
  pendant et pendant la lecture de la réponse → appel amont abandonné, journal 499, aucun corps (F-5).
- **Le SQL — syntaxe seulement** (pglast v8.6, rejoué par le contrôleur après T2, T5a et la vague finale) : `0004` = 12 instructions de premier
  niveau + 1 fonction plpgsql (dernière instruction `commit`), preuve = 24 instructions + 5 blocs `do` (dernière `rollback`),
  aucune erreur ; le SQL de `0004` hors commentaires est identique à celui de `1590ba8` (script). Ce n'est **pas** une
  exécution (voir « Non prouvé »).
- **Déploiement et sondes** (contrôleur, 18 octobre 2026). `~/.local/bin/supabase functions deploy assistant --project-ref
  ybdooerfeziiabsbfxtb --no-verify-jwt --use-api` depuis le worktree (bundle côté serveur, sans Docker ; aucun `config.toml`
  dans le dépôt) : **version 1** à 17 h 05 UTC (13 h 05 à Montréal, code `1590ba8`), **version 2** à 18 h 16 UTC (14 h 16, code
  `6d7ed21`, `ezbr_sha256 245fcab5…`), **version 3** à 19 h 19 UTC (15 h 19, code `2a2f838`, `ezbr_sha256 95034efd…`) ;
  `supabase functions list` : `ACTIVE`, `verify_jwt: false`, `import_map: true`. Neuf
  sondes `curl`, **identiques aux trois versions** (statuts, corps et CORS : 204/204/401/403/401/401/405/403/401, rejouées à 19 h 19 UTC
  sur la version 3), qui s'arrêtent toutes à une garde avant la réservation (aucune n'atteint
  Anthropic) : S1 `OPTIONS`, origine admise → 204 + `Access-Control-Allow-Origin` (et `Allow-Headers`, `Allow-Methods: POST,
  OPTIONS`, `Max-Age: 600`) · S2 `OPTIONS`, origine refusée → 204 **sans** Allow-Origin · S3 `POST` sans jeton → 401
  `non_connecte` · S4 `POST`, origine refusée → 403 `origine` · S5 jeton bidon + `apikey` publique → 401 `non_connecte`
  (donc `createClient` a reçu une clé publique valide — nouvelle ou legacy : cette sonde ne les distingue pas, le `GET` avec une session
  réelle le dira par `cles`) · S6 `GET`, jeton bidon → 401 · S7 `PUT` → 405 `methode` · S8 `POST`
  sans en-tête `Origin` → 403 `origine` · S9 clé publique en Bearer → 401 `non_connecte`. Détail et en-têtes :
  `supabase/proofs/RESULTATS-mitsu.md`, section « Passerelle `assistant` ». S10 (`content-length` mensonger de 9 000 000) a été
  refusée par la bordure Cloudflare (400, page HTML) avant la fonction : elle ne mesure pas notre borne, couverte par le
  test Node (cas f).

Les rulings, une ligne chacun (détail dans le registre `progress.md` et en spec § 10) :
- **R-PV-1** (pré-vol) la raison d'`appelerAssistant` est le champ `erreur` du corps quand il existe, sinon le statut (401 `non_connecte`, 403 `non_admis`, 429 `quota`, 413 `trop_lourd`, 400/422 `requete`, 504 `delai`, ≥ 500 `serveur`) ; les modules de domaine classent ensuite (413/422/400 → `requete`, 429 sans `erreur` → `trop_de_demandes`, 502/503 → `serveur`, 504 → `delai`).
- **R-PV-2** (pré-vol) T3 ajoute `etatAssistant({ fetch, session, config, signal })` : un `GET` que la fonction rend `{ modele, quotaJour, cles }` (`cles` ajouté par F-1 ; l'app n'en relit que les deux premiers), pour Réglages et pour une sonde sans dépense.
- **R-PV-3** (pré-vol) T3 retire `non_configure`, `non_pris_en_charge` et `cle_refusee` des modules de domaine ; T4 retire leurs textes et adapte les écrans.
- **R-T1-1** les bornes 512 Kio / 8 Mio se mesurent en OCTETS : `lireDemande` reçoit `octets` (lu par `index.ts`) ; sans lui, elle retombe sur `texte.length`.
- **R-T1-2** `ligneJournal` ne validait ni l'outil, ni le statut, ni `ownerId` (l'appelant les tient) ; relu en T2, durci par R-T1-6.
- **R-T1-3** le trailer `Co-Authored-By` est celui du modèle réel de l'implémenteur (convention du dépôt) ; jamais de réécriture d'historique.
- **R-T1-4** `max_uses` vaut `LIMITES.maxUses` (5) quand le client l'omet : plus de recherche web sans plafond.
- **R-T1-5** tests à mutants : prototype pollué (en `try/finally`) et épluchage imbriqué assertés.
- **R-T1-6** gardes de `ligneJournal` : outil dans `OUTILS` sinon `null`, statut entier, compteurs entiers sûrs ≥ 0, jour par `toISOString()`.
- **R-T1-7** `max_tokens` plafonné à 16 000 par le serveur ; modèle absent → 502 `serveur`.
- **R-T1-8** `corpsErreur` rend `{ ...extra, erreur }` : le champ `erreur` ne s'écrase pas.
- **R-T1-9** `decisionQuota` exige `appels ≥ 0`.
- **R-T2-1** la réservation est UNE fonction SQL atomique, `public.assistant_reserver(uuid, text, integer, integer)` (plpgsql, volatile, `security invoker`, `search_path` vide, verrou consultatif par compte, comptage du jour UTC, insertion « en vol » au statut 0, `execute` pour `service_role` seulement) ; `index.ts` fait un seul `rpc` : `null` → 429, erreur → 502.
- **R-T2-2** `lireCorpsBorne` (`content-length` d'abord, puis flux borné à 8 Mio, 413 avant tout parse) sert aussi à la réponse d'Anthropic (2 Mio d'octets).
- **R-T2-3** un `try/catch` global rend 502 `serveur` avec les en-têtes CORS : aucune exception ne sort sans `{ erreur }`.
- **R-T2-4** les secrets (`ASSISTANT_ORIGINES`, `ASSISTANT_MODELE`, `ASSISTANT_QUOTA_JOUR`) sont lus à chaque requête ; un quota invalide retombe sur 60.
- **R-T2-5** la mise à jour du journal ne pose que le statut, les jetons et la durée.
- **R-T2-6** preuve 1.09 : un `has_table_privilege` par privilège, reliés par `and` (une liste vaut OU) ; `set_config` en `perform` dans un bloc `do` ; README : jeton lu par `read -rs`, `ASSISTANT_ORIGINES` REMPLACE le défaut.
- **R-T2-7** `index.ts` est éprouvé sous Node par comportement (`stripTypeScriptTypes`, faux `Deno`, faux supabase-js, faux `fetch`), pas par épinglage de lignes.
- **R-T3-1** plomberie minimale des écrans : `auth.jeton()` (lecture locale ; un jeton expiré peut être rafraîchi par le réseau par supabase-js, l'attente est bornée à 2 s par `sessionAssistant`, R-T3-11) fournit la session aux cinq points d'appel ; textes et Réglages restent à T4 (`sessionCourante` écarté).
- **R-T3-2** la session est une DONNÉE `{ access_token, user? } | null` ; sans jeton non vide → `non_connecte` sans `fetch` ; le jeton n'apparaît dans aucun objet rendu.
- **R-T3-3** `cfg` disparaît des deux modules de domaine ; `non_configure`, `non_pris_en_charge` et `cle_refusee` n'existent plus ; le modèle d'une issue vient de `json.model` (≤ 80 points de code) ; les gardes « args null » rendent `non_connecte`.
- **R-T3-4** classement des statuts dans `passerelle.js` (champ `erreur` d'abord, puis statut) puis dans les modules de domaine ; les erreurs d'outil web restent telles quelles.
- **R-T3-5** `llm.js` : plus d'URL ni d'en-têtes Anthropic ; `AnthropicProvider` devient `PasserelleProvider` (`name` reste `'anthropic'`) ; `providerFrom(settings, { session })`.
- **R-T3-6** `tests/passerelle.js` : URL exacte, en-têtes exacts (jamais `x-api-key`), `redirect: 'error'`, `credentials: 'omit'`, corps `{ outil, corps }` ; mutant « poste vers `api.anthropic.com` » obligatoire.
- **R-T3-7** `APP_VERSION 0.8.0`, `sw.js` `-3`, `SHELL` + `./src/domain/passerelle.js`, pins de version déplacés.
- **R-T3-8** le lanceur `suite.cjs 8086` et `node --test tools/*.test.mjs` restent verts à chaque tâche.
- **R-T3-9** `sessionAssistant` rend `null` sans `ctx.sync.user` (compte refusé ou absent), sans appeler `jeton()`.
- **R-T3-10** un 403 sans champ `erreur` (Anthropic relayé) est `serveur`, jamais « compte non admis ».
- **R-T3-11** `sessionAssistant` est borné à 2 s (`Promise.race`, comme `demarrerSync`) ; `search.js` n'attend la session qu'en mode web.
- **R-T3-12** le balayage « le jeton est absent de chaque résultat » attend chaque résultat (`garde(await …)`) et compte exactement (86).
- **R-T3-13** `ecrite: true|false` sur tous les résultats : un 429 écrit par la passerelle → `quota`, un 429 relayé → `trop_de_demandes`.
- **R-T4-1** pas de `ctx.session` : l'écran lit la session par `sessionAssistant(ctx)` ; aucun champ `session` dans `state.js` ni `app.js`.
- **R-T4-2** Réglages → Assistant en deux états (sans session / avec session), première ligne = le but ; plus de champs fournisseur / modèle / URL / clé, ni Enregistrer, ni Tester, ni « Retirer… » ; amendé par F-4 : avec une session, « Vérification de l’assistant… » jusqu'à la réponse du `GET`, puis une seule des quatre sorties.
- **R-T4-3** passe d'effacement `effacerCleLocale()` dans `init()` : une ligne `assistant_config` qui porte une clé ou un fournisseur est réécrite vide, d'origine `local`, pour partir au compte ; amendé par F-9 : elle tourne à CHAQUE `init()`, il n'y a plus de garde `sync_state.cle_locale_effacee` (le « une fois » laissait passer une clé arrivée après le premier démarrage) ; l'idempotence tient à la ligne vide.
- **R-T4-4** textes exacts des gardes (« Connecte-toi… » + « Se connecter », `non_admis`, `quota`, 413 « La demande est trop lourde. » — « La demande est trop lourde : choisis moins de pages. » pour la lecture de pages, F-3), par `t()` avec leur entrée `en.js`.
- **R-T4-5** `OpenAICompatibleProvider` est retiré ; le magasin `assistant_config` et `assistant-config.js` restent (dette).
- **R-T4-6** tests par comportement (deux états de Réglages, passe d'effacement, quatre écrans à 0 appel) et mutant sur la garde de `search.js`.
- **R-T4-7** `sw.js` `-4` ; total épinglé relevé dans « obtenu ».
- **R-T4-8** même lanceur que T3 ; Node reste vert.
- **R-T4-9** `quota` nul → « Tu as atteint la limite du jour pour l’assistant. » sans nombre.
- **R-T4-10** à la bascule vers « Web » dans la même instance de `search.js`, la session est relue avant de rendre : pas de flash « Connecte-toi » pour une personne connectée.
- **R-T4-11** les textes « Une recherche / Une création = un appel à l’assistant, compté dans ton quota du jour. » : plus aucun texte d'écran ne nomme Anthropic.
- **T5a** (restes parqués, sans numéro R) : P-1 `jourDe` → `null` hors `AAAA-MM-JJ` ; P-2 défaut `max_tokens` = `min(4000, plafond)` ; P-3 preuve 2.04 reconnaît aussi `assistant_reserver` / `function` ; P-4 corps annulé quand `content-length` dépasse ; P-5 quota borné à l'int4 ; P-6 « isolat chaud » dit non prouvé ; P-7 `notify pgrst, 'reload schema';` au README ; P-8 commentaire READ COMMITTED dans `0004` ; P-10 « Code : … » borné à 40 points de code.

**Vague finale (revue finale de branche, 18 octobre 2026 — opus : 0 Critical, 3 Important I1-I3, 11 Minor M1-M11 ; rulings F-1 à F-14 du contrôleur, commits `f43e071` serveur et `2a2f838` app).** Une ligne chacun :
- **F-1** (I2) `cleDepuis(brut, prefixe)` lit les clés Supabase injectées sous toutes leurs formes (chaîne nue ou JSON, liste de chaînes ou d'objets `{ api_key }`, objet), à condition qu'elles portent LEUR préfixe (`sb_publishable_` / `sb_secret_`, profondeur 3) ; sinon repli sur les clés legacy ; le `GET` ajoute `cles: nouvelles | legacy | mixte` (repère non secret) ; la note de S5 de `RESULTATS-mitsu.md` est rectifiée (nouvelle ou legacy, la sonde ne les distingue pas).
- **F-2** (I3) `README.md` racine : plus de clé ni de fournisseur à configurer ; l'assistant est servi par le compte, la clé vit côté serveur.
- **F-3** (I1) les pages envoyées à l'assistant sont réduites avant l'envoi (`pagePourEnvoi` : 1568 px au plus, JPEG) ; la page stockée n'est jamais touchée ; une page indécodable n'est pas envoyée (« Code : indecodable ») ; le 413 d'une lecture de pages dit « La demande est trop lourde : choisis moins de pages. » (recherche et création gardent « La demande est trop lourde. »).
- **F-4** (M1) Réglages : « Vérification de l’assistant… » pendant le `GET` ; « actif pour X » seulement après un 200 lisible ; `non_admis` seul ; 401 → « Connecte-toi… » + « Se connecter » ; tout autre cas → « indisponible » seul.
- **F-5** (M2) `tentativeMs` client = 135 000 (passerelle, recherche web, création, extraction ; le GET d'état garde 15 s) : le serveur attend Anthropic 120 s plus ses étapes, l'idle de la plateforme est de 150 s ; côté serveur `req.signal` abandonne l'appel amont (« Annuler » arrête la dépense), journal **499**, aucun corps relayé, un client déjà parti n'appelle pas Anthropic.
- **F-6** (M3) une origine refusée (`erreur: origine`) est `serveur` côté app : une panne de configuration, pas un compte refusé.
- **F-7** (M4) `carteConnexion(connecter, ctx)` : si la garde de compte a refusé l'adresse (`ctx.sync.guard.ok === false`), la carte dit le message de la garde, sans « Se connecter » (plus de boucle OAuth) ; même règle dans Réglages ; les cinq écrans passent leur contexte.
- **F-8** (M5) `import.js` : la carte « Connecte-toi » se cache et se montre, jamais retirée ; `recipe-edit.js` : le bouton ne se rallume que si le fournisseur est configuré.
- **F-9** (M6) la passe d'effacement tourne à chaque `init()`, sans garde ; une ligne déjà vide, incomplète ou absente n'écrit rien ; geste facultatif au README (étape 10, point 7) pour vider côté serveur toute ligne qui porterait encore une clé.
- **F-10** (M8) harnais : `GET` sans jeton → 401, `GET` d'une session non admise → 403, sans fetch ni réservation.
- **F-11** (M9) test `jeton()` reformulé (un faux `getSession` ne prouve pas l'absence de réseau) ; R-T3-1 amendé : lecture locale, rafraîchissement possible par le réseau, attente bornée à 2 s.
- **F-12** (M10) preuve `0004`, verdict 1.09 : `USAGE` sur la séquence de `id` pour `service_role` (attendu `true` × 5) ; le SQL de `0004` est inchangé, `rollback;` reste dernier.
- **F-13** (M11) test de la passe d'effacement sans compte (`getUserId` nul) : l'entrée d'outbox existe avec `user_id` nul (R-L3-24).
- **F-14** README étape 10 : déploiement avec `--use-api`, origine locale d'exemple sur `:8086` ; section « Appareil perdu ou clé exposée » réécrite (plus de champ de clé : la rotation remplace le secret du projet, rien dans l'app).
- **F-15** (M7, parqué) double `JSON.parse` du corps (jusqu'à 8 Mio) : NON pris, dette ci-dessous.

**Ce qui n'est PAS prouvé.**
- **La preuve `0004`** : JOUÉE par Neegan le 18 octobre à 20 h 40 UTC (`Run without RLS`), `999 BILAN` = **`0 faux sur 20`**, tableau
  dans `RESULTATS-mitsu.md`. Les constructions jamais mesurées jusque-là (`pg_advisory_xact_lock(int, int)` avec `hashtext`,
  `set search_path = ''` avec objets qualifiés, `has_function_privilege` sur `(uuid,text,integer,integer)`, `unnest(coalesce(proconfig,
  '{}'))`, `'security_invoker=true' = any (reloptions)`, `has_sequence_privilege(…, 'usage, select, update')`) tiennent sur `mitsu` ;
  le verdict 1.09 (`service_role` garde ses droits, USAGE sur la séquence compris) est **vrai**. Sondes du contrôleur à 20 h 46-20 h 47 UTC
  (clé publique seule, aucune dépense) : S11 `PGRST202` dont l'indice nomme `assistant_reserver(p_octets, p_outil, p_owner, p_quota)`
  → le cache de schéma de PostgREST connaît la fonction (plus de 502 `PGRST202` à craindre) ; S12 avec les bons noms → 401 `42501`
  (`anon` refusé par la voie HTTP). **Reste non prouvé** : la concurrence elle-même (deux appels simultanés sous le verrou).
- **Aucun POST réel** : aucune ligne `assistant_journal` n'a été écrite ; aucun appel à Anthropic n'est passé par la fonction ;
  ni la validité du secret `ANTHROPIC_API_KEY` (sa pose est consignée par le contrôleur dans `RESULTATS-mitsu.md` ; aucune sonde ne
  l'exerce), ni la forme réelle d'une réponse relayée, ni la durée, les jetons et le coût d'un appel ne sont mesurés.
- **Une session réelle** : le `GET` → `{ modele, quotaJour, cles }` (seule la 401 d'un jeton bidon est mesurée, S6) ; le comportement
  de `is_allowed` pour une session non admise (403 `non_admis` réel) ; un secret changé pris par un isolat déjà chaud (dit
  non prouvé dans le README et dans `index.ts`).
- **La valeur de `cles` dans un `GET` réel** (F-1) : par quelle voie la plateforme sert les clés (`nouvelles`, `legacy` ou `mixte`) n'est
  pas constaté ; S5 prouve seulement qu'une clé publique valide est arrivée à `createClient`, pas laquelle. À lire dans la troisième sonde du
  README (étape 10), avec une session ouverte.
- **L'abandon du client → 499** (F-5) : prouvé sous Node seulement (vraie `Request` + signal, faux `fetch`). Que `req.signal` s'abaisse dans
  le runtime Supabase quand le navigateur coupe, que l'appel amont soit réellement abandonné, et que la ligne `assistant_journal` passe à 499 :
  à constater après une session réelle (couper une requête en vol, puis lire le statut dans `public.assistant_journal`). Une ligne 499 compte dans
  le quota (la réservation précède l'appel).
- **Le préflight d'un vrai navigateur** : S1 est un `OPTIONS` à la main (`curl`). L'app envoie `cache: 'no-store'` (options du
  lot ISBN) ; ces options pourraient ajouter au préflight des en-têtes que `Allow-Headers` ne liste pas (T3, inquiétude 3, non
  vérifié) : première chose à regarder si l'app échoue en `reseau` sur le site public. De même, la borne de 8 Mio de la
  fonction elle-même n'a jamais été atteinte en réel (S10 a été arrêtée avant elle).
- **L'ordre `installCapture` / `repo.init()` dans l'app réelle** : `app.js` n'est pas importable par la suite (il lance
  l'application à l'import) ; l'ordre n'est gardé que par un test de source et un mutant. Revue de T4 : correct et nécessaire
  (`installCapture` ne fait qu'assigner `db.onMutate` ; toutes les autres passes d'`init()` écrivent avec l'origine `device`,
  non capturée). À observer au premier démarrage réel : une entrée `assistant_config` dans « À envoyer » si une clé traînait.
- **Safari et l'iPhone** : connexion Google depuis l'app installée, session lue par `jeton()`, textes de Réglages et des gardes,
  `Promise.race` de 2 s sur `sessionAssistant` ; le délai client de 135 s compte le temps actif (PWA iOS en arrière-plan).
- **La lecture de pages en réel** (pages réduites à 1568 px en JPEG, en base64 ; la borne du serveur reste 8 Mio) : non mesurée, ni la taille
  réelle d'un envoi de plusieurs photos, ni le décodage d'une photo de téléphone de plusieurs dizaines de Mpx par `createImageBitmap`.

**Dettes (assumées, une ligne chacune ; spec § 8).**
- Retrait du magasin `assistant_config` (26 → 25, avec une migration) : `assistant-config.js`, le magasin et `getSettings().llm` restent (R-T4-5) ; le serveur garde la ligne vide.
- Quotas par jetons et non par appels ; relevé d'usage visible dans l'app (aujourd'hui : `public.assistant_usage_jour` dans l'éditeur SQL) ; streaming ; cache ; plusieurs modèles par outil.
- Un 403 relayé d'Anthropic (« recherche web non activée pour l'organisation ») est `serveur` et s'affiche comme une panne de service ; la porte « Créer une recette avec ces critères » qui s'affichait sur cette issue a disparu avec elle.
- `decisionQuota` (pur, testé sous Node) n'est plus importé par `index.ts` : la règle vit en SQL, dans `assistant_reserver` (deux copies de la règle, la référence testée et la réelle).
- Le test d'ordre de `app.js` est un test de texte source ; dérive d'horloge avant la première réponse serveur (la ligne vide de la passe d'effacement pourrait perdre face à la ligne du serveur si l'horloge de l'appareil retarde) ; un appareil en ancienne version qui réécrit sa clé : la passe d'effacement tournant à chaque démarrage (F-9), elle le rattrape au démarrage suivant d'un appareil à jour — mais la clé a transité par le serveur entre-temps (la révoquer chez le fournisseur reste le seul mur).
- Le `GET` n'est pas annoncé dans `Access-Control-Allow-Methods` (`POST, OPTIONS`) : à vérifier au premier `GET` d'un navigateur.
- `pause_turn` n'est pas géré (relayé tel quel) ; `getUser()` est un appel réseau par requête ; une ligne « en vol » (statut 0) compte dans le quota si la fonction plante ; `connect-src 'self' https:` couvre `*.supabase.co` mais n'a pas été resserrée.
- Réglages fait un `GET` (sans dépense) à chaque rendu avec session ; il peut dire « Connecte-toi » alors que Synchronisation dit « Connectée » si `jeton()` échoue ou dépasse 2 s (course de 2 s : la carte s'affiche à une personne connectée pendant un rafraîchissement lent) ; « Chercher à nouveau » reste offert sur `non_admis`, `quota` et « trop lourd » côté recherche (R-WEB-7).
- **F-15 / M7** : le corps de la demande (jusqu'à 8 Mio pour `extraction`) est analysé deux fois, `JSON.parse(texte)` dans `index.ts` pour lire l'outil, puis encore dans `lireDemande` ; non pris, à regrouper si le coût se mesure.
- `lireDemande` avec un plafond appelant < 1 donnerait `max_tokens` 0 : inatteignable, `index.ts` passe toujours 16 000.

**Gestes de Neegan, dans cet ordre.**
1. **FAIT le 18 octobre (20 h 40 UTC, BILAN `0 faux sur 20`, tableau consigné).** Éditeur SQL de `mitsu` : coller `supabase/migrations/0004_assistant_journal.sql` **entier** (un collage = une transaction ;
   attendu `Success. No rows returned`), puis, **collée seule**, `notify pgrst, 'reload schema';`, puis
   `supabase/proofs/0004_assistant_journal.sql` (rien à remplacer, aucune adresse à ajouter ; « Run without RLS »). Lire la
   ligne `999 BILAN` (`0 faux` = vert) et coller le tableau tel quel dans `supabase/proofs/RESULTATS-mitsu.md`, à la suite de
   « Preuve `0004_assistant_journal.sql` — à jouer ». Détail : `supabase/README.md`, étape 10, point 3.
2. Après la revue finale et `/verify` par le chef d'orchestre : `! git -C ~/projects/mistu merge --ff-only passerelle-assistant`
   (si `main` a bougé depuis `cdbd6e0`, rebaser d'abord ; les lignes de version et le total épinglé se résolvent en faveur de la
   branche), puis `! git -C ~/projects/mistu push origin main`. Ouvrir `https://neegans.github.io/mistu/tests/` et lire le BILAN
   (attendu : 2953/2953, total épinglé 2952, plus le 404 de `/favicon.ico`) ; service worker `cuisine-os-v0.8.0-6`.
3. **Preuve réelle** sur le site public, connecté (Mac, onglet Réseau ouvert) : onglet Web, « saumon fenouil » → **un** POST
   `/functions/v1/assistant` en 200, **zéro** requête vers `api.anthropic.com` ; Réglages dit « L’assistant est actif pour
   … » et « Modèle en service : claude-sonnet-5-5. Quota : 60 appels par jour. » ; puis, dans l'éditeur SQL,
   `select owner_id, jour, appels, jetons_entree, jetons_sortie from public.assistant_usage_jour;` montre la ligne. Au premier
   démarrage, regarder Réglages → Synchronisation : « À envoyer : 1 » (une entrée `assistant_config` dans l'outbox) si une clé
   traînait sur cet appareil ; c'est la seule observation de l'ordre `installCapture` / `init()` dans l'app réelle. Avec la session,
   la troisième sonde du README (étape 10) lit `cles` ; et, pour l'abandon (F-5), couper un appel en vol puis lire le statut 499 dans
   `public.assistant_journal`.
4. **iPhone** avec l'autre compte : ouvrir l'app, « Connexion avec Google », rien à configurer ; Réglages dit « actif », un
   appel d'assistant marche (la mesure iOS du retour OAuth, due depuis le 13 octobre, ne dépend pas de ce lot).
5. **Console Anthropic** : révoquer l'ancienne clé (elle a transité par un chat) et poser, ou vérifier, le plafond de dépense
   mensuel du workspace (rotation du secret : `supabase/README.md`, étape 10, point 6 ; « Appareil perdu ou clé exposée » pour l'ordre).
   Facultatif : le point 7 de la même étape (une commande SQL, jamais exécutée par le dépôt) vide côté serveur toute ligne de configuration
   qui porterait encore une clé.
6. « clean » **seulement après** avoir copié le registre `.superpowers/sdd/2026-10-18-passerelle-assistant/` dans
   `~/projects/mistu/.superpowers/sdd/` (il n'est pas dans git ; `diff -rq` muet) ; ensuite `git worktree remove` de
   `mistu-passerelle`. Les worktrees des lots précédents (STATE.md) restent à nettoyer selon leur propre liste.

**Versions.** `APP_VERSION = '0.8.0'` (était 0.7.0 ; pins `v0\.8\.0-\d+` / `'0.8.0'` dans `tests/ajouter.js`,
`tests/sync-l3.js`, `tests/recherche-web.js`, `tests/assistant-compte.js` et `tests/creer-ia.js`), `DB_VERSION = 3` (inchangée),
`sw.js VERSION = 'cuisine-os-v0.8.0-6'` (`-3` à T3, `-4` à T4, `-5` à T5a, `-6` à la vague finale ; T1 et T2 ne touchent pas la coquille), `SHELL` +
`./src/domain/passerelle.js` (seul module neuf). Aucun schéma IndexedDB ; la migration `0004` est côté serveur, à ajout seul
(`NOMS` et le générateur ne la connaissent pas). CSP inchangée.

**Bilan (vague finale, `2a2f838`, 18 octobre 2026).** Suite complète **2953/2953 verts** (total épinglé **2952** dans `tests/tests.js:215`, lu
dans « obtenu » : l'assertion du total s'ajoute elle-même au bilan affiché ; départ du lot sur `cdbd6e0` : 2633/2633, épinglé 2632 ; clôture
de T5a : 2910/2910, épinglé 2909 ; la vague ajoute 43 assertions), une seule erreur de console : le 404 de `/favicon.ico` (pré-existant ; aucune
requête externe pendant la suite) ; `node --test tools/*.test.mjs` **101/101** (45 à la base, 89 à la clôture de T5a) ; `node
tools/generer-migrations.mjs --check` : **0** ; `tsc` 5.6.3 `--strict` : **0** ; pglast v8.6 : `0004` 12 instructions (dernière `commit`), preuve
24 instructions + 5 blocs `do` (dernière `rollback`), aucune erreur ; `APP_VERSION 0.8.0`, `sw.js cuisine-os-v0.8.0-6` ; aucun caractère invisible
(Python) ni aucune clé (motifs Anthropic, JWT, Supabase) dans les fichiers de la vague. Méthode de la vague : test rouge d'abord — le harnais
serveur rejoué contre l'ancien `index.ts`, la suite neuve rejouée sur l'ancien `src/` copié hors dépôt (2897/2953, 56 assertions rouges), puis vert.
Mutants rejoués sur des copies (chacun rouge ; comptes dans les rapports de tâche) : T2 14 puis 17, T3 le mutant `api.anthropic.com` (12 échecs),
T4 la garde de `search.js` plus 19 autres puis 7, T5a 9 (revue), vague finale 12 sur `index.ts` (préfixe ignoré, `req.signal` jamais écouté, signal
déjà levé, override 499 retiré, corps relayé malgré 499, `cles` constant, GET avant `is_allowed`, GET sans contrôle du jeton ni `getUser`, profondeur
illimitée, préfixe public lu pour la clé secrète : tous tués). Tests de CARACTÈRE (verts avant, F-10 et F-13 : le chemin existait déjà).

**Fusion.** Revue finale de branche faite (opus) ; `/verify` par le chef d'orchestre ; le registre se copie **avant** tout
`git worktree remove` ; le geste 1 **avant** tout `push` (un code servi sans `0004` laisserait chaque appel d'assistant en
502 `serveur`, avant tout appel au fournisseur : README, étape 10).

### Importer une recette repérée : import ciblé et journal d'import (18-19 octobre 2026, lot A)

**Pour toi.** Dans un livre, une recette « Repérée dans ton livre » se touche : « Importer » (sous sa carte, sur la fiche du livre) ou
« Importer cette recette » (sur sa fiche) ouvre `#/recipes/<id>/importer`, déjà sur son titre, son livre et sa page. Tu photographies ses
pages (« Photographier ») ou tu les choisis (« Choisir des photos »), tu les remets dans l'ordre (« Monter la page {n} », « Descendre la page
{n} », « Retirer la page {n} »), tu ajoutes si tu veux la photo du plat (« Prendre une photo » ou « Choisir une image », facultatif), puis
**« Extraire et enregistrer »** : un appel à l'assistant, et la recette est écrite DANS la référence (même fiche, jamais une seconde), sans
passer par l'éditeur (D-3, confirmée par toi le 18 octobre). La fiche dit « Lue par l’assistant le {d} · {n} ligne(s) incertaine(s) » ; le
mode cuisine et les courses disent « Lue par l’assistant, non relue » tant que tu ne l'as pas vérifiée ; « Corriger » reste offert, jamais
imposé. Si le titre lu ne contient pas les mots de la référence, ou si la page lue s'écarte de plus de 3, l'app demande « Rattacher quand
même ? » AVANT d'écrire. Une fiche partielle offre « Relire les pages » : la relecture reprend en tête ses pages déjà lues (celles dont les
photos sont sur cet appareil) et, si la nouvelle lecture ne couvre plus toute la recette, demande « Remplacer par cette lecture ? ». Si tu
fermes l'app en route, rien de payé ne se perd : la section **« Imports »**, en tête de la page Ajouter, montre ce qui est à reprendre, en
cours ou en échec (« Reprendre », « Relancer », « Annuler », « Ignorer ») ; une lecture reçue s'enregistre sans rappeler l'assistant. Chaque
lecture compte dans ton quota (60 appels par jour) ; après « Annuler » ou une app fermée en plein vol, l'écran dit « L’appel a peut-être été
compté ; relancer en coûtera un autre. ». « Scanner cette recette » et la case « Oui, rattacher » ont disparu ; « Saisir à la main » reste.
Rien n'arrive sur le site public avant `0005`, ta fusion et ton `push` ; **aucune extraction réelle n'a encore eu lieu**.

**Où.** Branche `import-cible`, worktree `~/projects/mistu-import` (jamais `~/projects/mistu`), serveur de vérification `http://localhost:8088/`
(suite : `http://localhost:8088/tests/`). Audit d'origine : `docs/audits/2026-10-18-import-livres-photos-web.md` (lots A à G). Spec :
`docs/superpowers/specs/2026-10-18-import-cible-design.md` (rév. 3.1 ; **§ 0** : décisions D-1 à D-12 ; **§ 2** : invariants I-1 à I-10 ; **§ 12** :
rulings, de la revue de spec à la clôture du chef d'orchestre). Plan : `docs/superpowers/plans/2026-10-18-import-cible.md` (rév. 2, après un pré-vol à
trois lentilles : couverture, cohérence, faisabilité). Registre, **hors git** : `.superpowers/sdd/2026-10-18-import-cible/` (`progress.md`, le journal
du chef d'orchestre, arrêté à T3-R1 le 19 octobre à 00 h 06 ; un brief et un rapport par tâche avec leurs rondes ; `final-fix-report.md` pour la vague
finale ; `final-round-2-brief.md` et `final-round-2-report.md` pour la ronde finale 2 ; ni la revue finale de branche (26 constats) ni les re-revues
n'y ont de rapport ; lanceur strict `suite.cjs` ; `generer-fixture.cjs`, qui a produit l'archive figée ; déjà copié dans
`~/projects/mistu/.superpowers/sdd/2026-10-18-import-cible`, `diff -rq` muet le 19 octobre). Base : `main` `57babc6` ; 8 commits de spec, d'audit et
de plan jusqu'à `7fba2da`, puis 16 commits de construction jusqu'à `42ea30b` (T1 `acafd56` + `48566b6` ; T2 `3167352` + `1a35893` + `51d1b3b` ; T3
`be911d7` + `f5e5464` ; T4 `24e539b` + `47f61ed` + `f155c8c` ; T5 `e88f0b1` + `f8cfafa` ; T6 `bd03e48` + `4cb99a0` ; vague finale `bbb6cef` code,
`42ea30b` spec), puis la ronde finale 2 (`58bb49b` : 25 commits sur `57babc6`) et le commit de clôture de la spec (§ 12), jusqu'à `58bb49b` (dernier commit de code ; le commit de clôture qui pose ces documents le suit). Six
tâches menées par le workflow SDD : chacune un implémenteur (Claude Fable 5.1 de T1 à T5, sauf la ronde 1 de T5 ; Claude Opus 5.5 pour T5-R1
`f8cfafa`, T6, la vague finale et la ronde finale 2 : trailers `Co-Authored-By` des commits), une revue adverse à trois lentilles (spec, sécurité,
faux-vert, mutants rejoués sur des copies) et au plus deux rondes ; puis la revue finale de branche (26 constats : 6 Important, 20 Minor), sa **vague
finale** (VF-1 à VF-15), une re-revue et sa **ronde finale 2** (un Important : « Relire les pages » sans octets), la re-revue de celle-ci (PROPRE ; un
survivant nommé, M3) et la **clôture** du chef d'orchestre (spec § 12, 19 octobre, 17 h 40 : m9, m12 et m13 ratifiés, `hb-ignore` équivalent, VF-16,
VF-17). **FINI dans le worktree, PAS fusionné, PAS poussé, `0005` PAS collée** ; `/verify` FAIT le 19 octobre à 17 h 40 (suite 3694/3694, Node 125/125, `--check` 0, invisibles 0, scan de secrets : deux noms de clés dans des tests, aucune valeur). Fichiers :
- Données et primitives : `src/model/schema.js` (`DB_VERSION 4`, `STORES.imports`, `RELATIONS`, `MAGASINS_AJOUTES_APRES_V1`, `STATUTS_IMPORT`,
  `IMPORTS_TERMINES`), `src/core/db.js` (`conditions` de `mutate`, `TransitionRefusee`), `src/model/repo.js` (`transitionner`, `saveBatch(…, {
  conditions })`, `ajouterPages`, `ouvrirImport`, `battre`, `oublierBattement`, `marquerInterrompus`, purge à 30 jours, `issuesPourImage`),
  `src/domain/vocabulaire.js` (neuf : `assertVocabulaire`, `ErreurVocabulaire`), `src/domain/backup.js` (magasins ajoutés après le format 1),
  `src/ui/state.js` (`getData` charge `imports`, `ROUTES_DE_SAISIE`), `src/sync/tables.js` (`SYNC_STORES_0003` figée), `src/sync/clock.js`
  (`resetClock`, tests seulement), `src/sync/mime.js` (`displayUrl(fichier, creerUrl)`), `src/core/i18n.js` (`t()` en une passe).
- Domaine : `src/domain/import-cible.js` (neuf, pur), `src/domain/llm.js` (extraction amendée, `validateParsedRecipe` durci, `validerIndex`,
  `pagePourEnvoi` muré), `src/domain/lines.js` (`parseStepsBlock(…, { parParagraphe })`), `src/core/image.js` (`preparerPhotoLocale`),
  `src/domain/creation-ia.js` (appel d'`assertVocabulaire`).
- Écrans : `src/ui/import-cible.js` (neuf : l'écran, le vol, la plomberie du journal), `src/app.js` (route), `src/ui/add.js` (section
  « Imports », retrait de `#/add?edition=`), `src/ui/book.js`, `src/ui/recipe.js`, `src/ui/recipe-edit.js`, `src/ui/import.js`,
  `src/ui/cook.js`, `src/ui/grocery.js`, `src/ui/components.js` (`banniereLecture`, `estExtractionNonRelue`, puce « incertain »),
  `src/ui/signet.js`, `src/ui/livre-ajout.js`, `src/i18n/en.js`, `sw.js`.
- Serveur, en fichiers seulement : `supabase/migrations/0005_imports.sql` (GÉNÉRÉE), `supabase/proofs/0005_imports.sql`, `supabase/README.md`
  (étape 11), `supabase/proofs/RESULTATS-mitsu.md` (section « Preuve `0005_imports.sql` — à jouer »), `tools/generer-migrations.mjs`
  (`ajoutSeul`, quatrième cible `imports`) et son test. Aucun changement sous `supabase/functions/` (D-5).
- Tests : `tests/import-cible.js` (neuf), `tests/fixtures/archive-0.8.1-sans-imports.zip` (neuf), `tests/passerelle.js`, `tests/ajouter.js`,
  `tests/sync.js`, `tests/sync-l3.js`, `tests/assistant-compte.js`, `tests/backup.js` (`rewriteArchive` exportée), `tests/creer-ia.js`,
  `tests/recherche-web.js`, `tests/tests.js`.

**Décisions (spec § 0), une ligne chacune.**
- **D-1** (Neegan) le journal se voit en tête de la page Ajouter (section « Imports »), avec un rappel sur la fiche du livre.
- **D-2** le lot livre le journal ET l'import ciblé (le journal seul n'aurait rien de visible) ; coût si faux : scinder en A1 / A2.
- **D-3** (confirmée par Neegan, « oui go », 18 octobre) « Extraire et enregistrer » enregistre sans l'éditeur ; « Corriger » offert, jamais
  imposé ; aucune compatibilité certifiée sur une ligne non vérifiée (N-8) ; bandeau « Lue par l’assistant, non relue » en mode cuisine et courses.
- **D-4** photo du plat manuelle et facultative (octets dans `files`, `recipes.photo_sha256`) ; aucune récupération automatique (lot F).
- **D-5** aucun changement serveur : consigne d'extraction côté app (`incomplete`, `missing_page`, `notes` lue), `max_tokens` 6 000, `stop_reason` lu.
- **D-6** discordance : chaque mot distinctif du titre de la référence doit apparaître dans le titre lu (mots vides retirés, accents et casse
  ignorés) ; page à ± 3 ; titre lu nul → dialogue AVANT d'écrire ; jamais de rattachement silencieux ni de seconde fiche depuis cet écran.
- **D-7** journal synchronisé (réponse brute ≤ 16 000 points de code, effacée à l'enregistrement) et archivé ; une archive plus ancienne sans
  `imports` reste restaurable ; sur un autre appareil, « Reprendre » seulement si le résultat validé est là.
- **D-8** « Scanner cette recette » + `sessionStorage.cuisineos.pending_recipe` remplacés par la route ciblée ; « Oui, rattacher » retiré.
- **D-9** direction visuelle des maquettes hors lot : le thème « magazine » reste, les maquettes fixent les gestes et les libellés.
- **D-10** ordre des lots suivants : G remonte, en parallèle de B, fusions séquentielles (fichiers communs).
- **D-11** entrées : `reference_only` sans `source_url`, ou `partial` ; une `available` ou un signet n'a pas d'entrée (toast, retour fiche).
- **D-12** vocabulaire fermé vérifié par `assertVocabulaire` chez les FABRICANTS, jamais un mur dans `db.mutate` (restauration, réception et
  passes du démarrage restent tolérantes).

**Ce qui marche, prouvé** (suite navigateur : `fetch` injecté, bases jetables, aucun réseau ; tests Node du générateur ; **aucune extraction
réelle**, aucune passe contre `mitsu`) :
- **Le magasin et les archives.** Montée `DB_VERSION` 3 → 4 sur une base peuplée (fiches intactes champ pour champ, `imports` créé avec ses index
  `edition_id`, `recipe_id`, `status`) ; `imports` est le 27e magasin synchronisé, le dernier (K-9 : dans `STORES`, après `assistant_config` et avant
  `settings`, qui n'est pas synchronisé ; la réception le lit en dernier ; l'envoi initial, `tablesCandidates`, retire toujours `files` et retire
  `library_activity` tant que « Synchroniser mon historique » est éteint : en production, où `assistant_config` est comprise, 25 tables sans
  l'historique, le cas éprouvé par `tests/assistant-compte.js`, 26 avec, et `imports` en dernier), et il est archivé. Une archive RÉELLE d'avant le
  lot (`tests/fixtures/archive-0.8.1-sans-imports.zip`, 43 645 octets, produite par le code 0.8.1, sans `data/imports.json` ni `counts.imports`) passe
  l'inspection et se restaure en fusion et en remplacement (`imports` vaut `[]` ; la fusion garde une ligne locale, le remplacement la vide) ; une
  archive refaite au vol sans le fichier, sans son entrée et sans décompte aussi ; un aller-retour garde une ligne `imports` dont une page n'existe
  pas (pointeur souple) ; `data/recipes.json` absent → toujours refusée ; `createArchive` d'une base sans le magasin rend `imports: []`.
- **Une seule porte d'écriture conditionnée.** `db.mutate({ conditions })` lit, vérifie et écrit dans UNE transaction : condition fausse →
  `TransitionRefusee { store, key, statut }` et RIEN d'écrit, pas même les `puts` ; deux transitions entrelacées sur la même ligne : une seule
  écrit ; la capture d'outbox voit la fiche fusionnée ; formes refusées par `TypeError` (`attendus` vide ou non-chaîne, deux conditions sur la
  même fiche, patch qui change la clé) ; la garde K-6 (`noDelete`) tient aussi sur ce chemin ; le message de refus est borné (80 points de code).
  `repo.transitionner` nettoie les chaînes (R61), pose `updated_at = syncNow()`, émet un `change` par magasin touché et rend la fiche écrite.
  Test statique : `transitionner(` n'existe dans `src/` que dans `repo.js` ou sous la forme `repo.transitionner(` ; `db.transitionner` n'existe
  pas ; `MUTATING_METHODS` et son pin (`tests/sync.js:47`) inchangés.
- **L'extraction amendée** (`tests/passerelle.js`). Consigne envoyée : `"incomplete"`, `"missing_page"`, la phrase « garde-la entière » mot pour
  mot, plus de `"language"` ; `max_tokens` 6 000 ; un `signal` déjà levé → aucun POST ; `stop_reason: 'max_tokens'` → `coupe` (même sur un JSON
  entier) ; aucun JSON → `illisible` ; zéro ligne et zéro étape → `vide` ; table des bornes (juste au-dessus → `hors_bornes`, juste à la borne →
  acceptée, en points de code, après retrait des Cc/Cf) ; nombres impossibles (−1, NaN, `'12'`, au-delà de 999 portions, 1 440 minutes, page
  9 999) → `null` ; `"incomplete": "oui"` → faux ; deux appels sur la même instance ne se lisent pas l'un l'autre.
- **La discordance** (Review Focus 2). « Tarte aux poires » lue pour « Tarte aux pommes » → dialogue ; « Soupe à l’ail » pour « Soupe à
  l’oignon » → dialogue ; « Tarte aux pommes de ma grand-mère » → concordant ; page à plus de 3 → dialogue ; titre nul, ou référence sans mot
  distinctif → dialogue. « Rattacher » ne vaut que pour la lecture à laquelle la question a été posée : une autre lecture arrivée entre-temps
  redemande avec le nouveau titre (T4-R2).
- **L'écran ciblé.** Une visite sans photo n'écrit rien ; la première photo ouvre la ligne `a_lancer` et sa séance dans UNE transaction conditionnée
  (la ligne n'existe pas ; aucun import ouvert pour cette recette) ; les pages sont persistées AVANT tout appel ; Monter / Descendre (le focus suit la
  page) / Retirer réécrivent `page_ids` ; « p. imprimée » accepte 1..9999 et écrit `source_pages.printed_page` (`repo.save` : la ligne `imports` n'est
  pas touchée), sinon rien n'est écrit ; photo du plat (« Choisir une image » → `photo_origin: 'image'`, « Prendre une photo » → `'photo'`, Remplacer,
  Retirer) par le mur des couvertures (`preparerPhotoLocale` : 25 Mo, 16 Mpx, JPEG 1 200 px). « Extraire et enregistrer » : **un** POST, images dans
  l'ordre de `page_ids`, `appels` passe à 1 au départ du `fetch` (relu par le `fetch` factice), `a_verifier` écrit AVANT toute écriture de recette
  (ordre des `db.mutate` espionné), puis **une** transaction (`recipes`, `recipe_versions`, `source_pages` `kind: 'recipe'` et `position`,
  `scan_sessions` `done`, `imports` `enregistre` avec `reponse_brute: null`) ; la recette garde son `id` et son `original_title`. Review Focus 4 :
  « Annuler » → `fetch` abandonné, `echec(annule)` et la phrase I-4 ; la réponse tardive n'écrit que `reponse_brute`, aucune recette. Écriture
  `a_verifier` refusée une fois → `echec(incertain)` ; deux fois → la ligne reste `en_cours`, l'écran ne plante pas. Double clic → un POST ; hors
  ligne (basculé APRÈS le rendu) → bouton éteint, zéro POST ; sans session → carte « Connecte-toi », photos ajoutables ; un autre onglet qui
  enregistre avant le clic → rien d'écrit, ni toast ni navigation ; fiche supprimée entre-temps → rien d'écrit, « Recette introuvable. » ; écran
  quitté pendant le vol → recette enregistrée sans toast ni navigation. Une table raison → texte et geste couvre chaque raison de § 4.4.
- **I-5 : ce que tu as écrit n'est jamais masqué sans question.** Sur une `partial` dont une version non `ai` peut être courante (saisie à la
  main, `correction`), « Remplacer par cette lecture ? », défaut « Garder ma version » : la version lue est ajoutée sans devenir courante, la
  fiche ne reçoit que l'union des pages et la photo du plat ; une adaptation n'appelle pas la question (VF-7) ; « Relire les pages » lit la
  recette entière (pages déjà liées en tête, VF-1, octets présents seulement depuis la ronde finale 2).
- **La fiche, le mode cuisine, les courses, « Corriger ».** Bandeau « Lue par l’assistant le {d} · {n} ligne(s) incertaine(s) · page possiblement
  manquante · lecture incomplète » et « Incertain : … » coupé à 300 points de code, en nœud texte (une fixture `<img onerror>` reste du texte) ;
  état de la version AFFICHÉE (« Vérifiée », « 1 ligne à vérifier », « {n} lignes à vérifier ») ; puce « incertain » sur `uncertain === true`
  seulement ; photo du plat quand ses octets sont là et de type image ; étapes rendues en `white-space: pre-line`. Mode cuisine et courses :
  « Lue par l’assistant, non relue » pour une lecture à vérifier, absent après vérification. Review Focus 5 : « Corriger », une quantité
  retapée → cette ligne perd `uncertain`, les autres le gardent ; `incomplete`, `missing_page`, `import_id`, `titre_lu`, `lu_le` et
  `uncertain_fields` hérités ; étapes multi-lignes entières (mode « une étape par paragraphe ») ; une recette sans étape multi-ligne garde
  l'éditeur d'aujourd'hui.
- **La section « Imports » et la reprise.** Absente quand vide, avant la grille sinon, `?section=imports` → focus ; une ligne par état et par
  sorte (les 12 combinaisons), textes exacts et gestes affirmés ; « Reprendre » d'un `a_verifier` → résultat revalidé (hostile →
  `echec(illisible)`), enregistrement sans appel ; « Relancer » → un POST, aucune page ni séance en double ; « Ignorer » lié à la lecture
  dessinée ; ligne d'un autre appareil : « Photos sur un autre appareil », « Reprendre » seulement avec un résultat, jamais « Relancer » ; la
  séance d'un import ciblé quitte les rappels génériques et y revient après « Ignorer ». L'éditeur (« Extraire avec l'assistant IA » d'une
  recette neuve) et le panneau d'index écrivent dans le journal, relisent par `?import=` (revalidé), closent la lecture à l'enregistrement (liée
  à sa clé) ; un clic refusé (hors ligne, sans session, octets absents, vol tenu) n'écrit RIEN dans le journal.
- **Le démarrage** (Review Focus 3). Ligne `en_cours` de cet appareil, battement à −120 s → `echec(interrompu)` ; à −30 s → intacte ; battement
  rafraîchi entre la lecture et la transaction → intacte ; ligne d'un autre appareil : −2 min intacte, −11 min interrompue ; `enregistre` et
  `ignore` de 31 jours → supprimés avec une tombale en file (origine `local`), de 29 jours → intacts ; `echec` de 60 jours → intact ; une
  version qui pointe une ligne purgée reste. Le battement ne touche ni la ligne `imports`, ni l'outbox, ni `sync_conflicts`, et n'émet aucun `change`.
- **Le serveur — fichiers et syntaxe seulement.** `0003` garde son empreinte (`37f9f80d…`, épinglée, identique octet pour octet au fichier
  commité) alors que `SYNC_STORES` a 27 noms ; `0005` ne crée que `public.imports` (gabarit des 26 autres, trois colonnes générées `edition_id`,
  `recipe_id`, `status` avec leurs index, `revoke all … from anon`) et recrée les quatre fonctions avec les 27 noms (`required.imports = []`) ;
  `--check` rend 0 sur le dépôt et 1 sur une copie sans `0005`. Preuve `0005` : 35 verdicts, un compte de preuve, aucune lecture de la colonne
  `data` (listes blanches des lectures de `public.imports` et des réponses de `sync_push`, alias compris), `rollback;` dernier. pglast v8.6 :
  `0005` = 23 instructions + 4 fonctions plpgsql, preuve = 37 instructions + 2 blocs `do`, aucune erreur. Ce n'est **pas** une exécution.
- **La ronde finale 2** (re-revue de la vague, un Important, `src/ui/import-cible.js`). « Relire les pages » ne place plus en tête que les pages de la
  version courante dont les OCTETS sont sur cet appareil (`repo.getFile` rend un Blob) : sur un second appareil ou une PWA réinstallée (ligne
  `source_pages` reçue sans ses octets, R58), la relecture ne tombe plus dans l'impasse « Les photos de cette recette ne sont pas sur cet appareil. ».
  Et `decider()` porte une **garde I-5 de couverture** : quand les pages lues ne couvrent pas `provenance.source_page_ids` de la version courante
  (`pagesNonRelues(courante, lues)`, pure), l'écran pose « Remplacer par cette lecture ? » au lieu de rendre la nouvelle version courante d'office ;
  `current_version_id` ne bouge pas tant qu'elle n'est pas tranchée (« Garder ma version » → version ajoutée ; « Remplacer » → courante) ; même règle
  après « Retirer » d'une page placée en tête. Les pages « lues » sont celles de la nouvelle version (les pages de la ligne présentes ici) ; la phrase
  « Une version écrite à la main existe. … » n'est dite que lorsque c'est vrai. Tests rouges d'abord (a, b, c du brief : 8 rouges sur l'ancien code,
  dont l'impasse et la régression silencieuse reproduites) ; cinq mutants rouges sur copie, dont les deux exigés (« sans garde de couverture »,
  « `pagesDejaLiees` sans contrôle des octets »). Sa re-revue est PROPRE : trois mutants de plus, deux rouges, un survivant nommé (M3, sous « Tests »).

**Forme des primitives** (une ligne chacune ; détail dans `docs/architecture.md`, section du lot) :
- `db.mutate({ puts, deletes, clearStores, origin, payloads, conditions })`, `conditions = { [store]: [condition] }`, trois formes : `{ key,
  attendus, patch? }` (statut parmi `attendus` ; `patch` objet ou `(courant) => objet` ; sans patch, vérifiée seulement), `{ key, absente: true }`
  (une création n'écrase jamais), `{ index, valeur, exclus }` (aucune fiche de l'index à cette valeur n'a un statut exclu). Rend les fiches fusionnées.
- `repo.transitionner(store, key, { attendus, patch, puts, deletes, payloads, origin = 'local', autres })` → la fiche écrite ; `autres` = des
  conditions sur d'AUTRES magasins (jamais le sien, `TypeError`), passées telles quelles. `repo.saveBatch(batch, { origin, conditions })` :
  vérification seule (un `patch` lève `TypeError`).
- `repo.ajouterPages(files, { edition_id, session_id, import_id, import })` → `{ session, pages, docs, importId }`, sans navigation ni toast ;
  octets d'abord, ligne lue AVANT le premier `putFile` ; `import: { id, kind, recipe_id, edition_id, page_ids }` ouvre la ligne (`page_ids` =
  pages déjà liées, en tête) ; `import_id` ajoute EN FIN par patch-fonction. `repo.ouvrirImport({ kind, recipe_id, edition_id, scan_session_id,
  page_ids })` : une ligne `a_lancer` sur des pages déjà là, même mur (`nouvelleLigneImport`).
- `repo.battre(id, quand)` / `repo.oublierBattement(id)` : la ligne interne `battement:<id>` de `sync_state` (origine `device`).
  `repo.marquerInterrompus(maintenant)` et la purge (`purgerImportsAnciens`) tournent à CHAQUE `init()`, après `effacerCleLocale` et
  `purgerFilesEnFile` ; `BATTEMENT_MORT_MS` = 90 s, `VOL_MORT_MS` = 10 min, `RETENTION_IMPORTS_MS` = 30 jours.
- `lancerExtraction(importId, { ctx, repo, fetch, maintenant, enLigne, battementMs, lecture })` → `{ issue: 'refuse', raison: vol_tenu | inconnu
  | hors_ligne | non_connecte | sans_page | image | octets_absents | transition }` | `{ issue: 'echec', raison }` | `{ issue: 'a_verifier' }`,
  jamais une levée pour une raison attendue ; `lecture` = une lecture SANS référence (éditeur, panneau d'index), dont la ligne n'est écrite
  qu'après les gardes. `annulerVol(importId)` → `true` seulement si CE document tient ce vol. `tenirVol()` / `libererVol(jeton)` : le vol d'une
  lecture hors journal (« Corriger »). `DOCUMENT_ID`, `BATTEMENT_MS` (15 s), `volEnCours()`, `cleLecture(L)` (`[id, started_at, resultat]`).
- `lireDansLeJournal({ kind, importId, pageIds, editionId, sessionId, ctx })` → `{ importId, resultat, modele, cle, texte, connecte }` ;
  `relireDuJournal(importId, kind)` (revalide, hostile → `echec(illisible)`) ; `texteEchec` / `phraseEchec` / `texteRefus` : une phrase par raison.
- `fabriquerExtraction(resultat, { reference, versions, pages, pageIds, edition, convention, importId, modele, photo, maintenant, remplacer =
  true })` → `{ recipe, version, pageUpdates, remplacement }`, pure, appelle `assertVocabulaire` ; `remplacer: false` = la réponse « non » de I-5.
- `discordance(resultat, reference)` → `{ ok, raison: null | 'titre_nul' | 'titre' | 'page', titreLu, pageLue }` ; `motsDistinctifs`, `MOTS_VIDES`.
- `lignesImports(ctx, { maintenant, documentId, deviceId })` → `[{ id, kind, titre, etat, age, raison, gestes, cible, ailleurs, autreAppareil,
  referenceAbsente, pages }]` (l'écran traduit) ; `cibleReprise(ligne)` : recette ciblée → `/recipes/<id>/importer?import=<imp>`, recette sans
  référence → `/recipes/new?import=<imp>`, index → `/import?session=<s>&import=<imp>`, sinon `null` ; `importOuvert`, `IMPORTS_OUVERTS`,
  `KINDS_IMPORT` (`recette`, `index`), `seanceDUnImportCible`, `ageDepuis`, `dateReception`, `pagesNonRelues`, `TRANSITIONS`, `RAISONS_ECHEC`.
- `llm.js` : `extraireRecette(provider, images, { signal, maxTokens })` → `{ recette, stopReason, modele, texteBrut }` ; `extraireIndex(provider,
  images, { signal })` → `{ index: { entries, uncertain }, … }` ; `validateParsedRecipe`, `validerIndex` (exportées : une définition pour la
  réponse et pour un résultat relu) ; `ErreurExtraction(raison)` (`coupe | illisible | hors_bornes | vide`, `message === raison`) ;
  `BORNES_EXTRACTION`, `BORNES_NOMBRES`, `BORNES_INDEX`, `MAX_TOKENS_EXTRACTION` (6 000), `REPONSE_BRUTE_MAX` (16 000), `LIMITES_ENVOI` (50 Mo,
  50 Mpx). `PasserelleProvider.complete(messages, { maxTokens, signal })` pose `this.modele` et `this.stopReason` (remis à `null` avant l'appel).

**Textes d'écran** (tous par `t()`, une entrée `en.js` chacun ; aucun ne nomme le fournisseur ni la base) :
- Écran : « Importer une recette », « Repérée dans ton livre » / « Partiellement disponible », « Pages de la recette », « {n} photo ajoutée » /
  « {n} photos ajoutées », « p. imprimée », « Monter la page {n} », « Descendre la page {n} », « Retirer la page {n} », « Photographier »,
  « Choisir des photos », « Photo du plat », « Facultatif · Ajoute la photo du livre, s’il y en a une. », « Prendre une photo », « Choisir une
  image », « Remplacer », « Retirer », « Extraire et enregistrer » (« Relancer » sur un échec), « Les pages et la photo seront liées à cette
  recette. », « Retour à la fiche », pendant le vol « Lecture des pages par l’assistant… » puis la rangée « Annuler », « En cours sur un autre
  écran », « Lecture reçue le {d} », « Enregistrer cette lecture », « Changer les pages », « Recette importée », « Recette introuvable. »,
  « Cette recette a déjà son texte. », « Un lien web s’importe au lot suivant. », « Une lecture est déjà en cours : annule-la d’abord. »,
  « Les photos de cette recette ne sont pas sur cet appareil. », « Tu es hors ligne. ».
- Échecs (§ 4.4) : I-4, une seule phrase pour `annule` (« Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre. »),
  `interrompu` (« La lecture a été interrompue. L’appel… ») et `incertain` (« L’appel a peut-être été compté ; relancer en coûtera un autre. ») ;
  « La lecture a été coupée : essaie avec moins de pages. » ; « L’assistant n’a pas répondu lisiblement. Réessaie. » + « Code : illisible |
  hors_bornes » ; « Aucun ingrédient ni étape lus sur ces pages. » ; les raisons de la passerelle gardent `texteEchecAssistant`.
- Questions : « Le texte lu s’intitule “{x}” ; la référence est “{y}” (p. {n}). Rattacher quand même ? » (« (sans titre) » pour un titre nul) avec
  « Rattacher », « Garder la lecture sans l’enregistrer », « Changer les pages » ; « Remplacer par cette lecture ? » avec « Garder ma version »
  (primaire, défaut) et « Remplacer ».
- Fiche, cuisine, courses, éditeur : « Lue par l’assistant le {d} » (« Lue par l’assistant » sans date lisible), « {n} ligne(s) incertaine(s) »,
  « page possiblement manquante », « lecture incomplète », « Incertain : {t} », « incertain », « Vérifiée », « 1 ligne à vérifier », « {n} lignes
  à vérifier », « Lue par l’assistant, non relue », « Une étape par paragraphe (ligne vide entre deux étapes). ».
- Section : « Imports », « Reprendre », « Relancer », « Annuler », « Ignorer », « Ouvrir la séance », « il y a {n} min / h / j », « Index · {l} »,
  « Recette à regrouper · {l} », « Photos conservées : {n} page(s) », « Photos sur un autre appareil », « (référence pas encore reçue) » ; fiche du
  livre : « {n} import à reprendre » / « {n} imports à reprendre » → `#/add?section=imports`.

**Les rulings, par revue et par ronde** (détail en spec § 12 de la revue de spec à T5-R1, puis de VF-1 à la clôture ; T1-R1, T2, `required.imports` et
T6-R1 (cité une fois en passant) ne sont que dans les rapports de tâche et `progress.md` ; les décisions des rondes et de la vague sont à ratifier par
le chef d'orchestre, sauf mention ; la clôture en a ratifié quatre, dites plus bas) :
- **Revue de la spec, rév. 1 → 2** : **C1** archives antérieures → `MAGASINS_AJOUTES_APRES_V1` et archive figée ; **C2** Jaccard 0,5 → contenance
  de tous les mots distinctifs ; **I1** même phrase pour `interrompu`, `annule`, `incertain` ; **I2** « Reprendre » revalide ; **I3** pas d'entrée
  pour `available`, « Remplacer ? » défaut non ; **I4** « Corriger » hérite ; **I5** étapes construites directement ; **I6** transitions
  complétées ; **I7** cibles de « Reprendre » par sorte ; **I8** un import ouvert par recette, séance exclue ; **I9** `recipe_id` et `page_ids`
  pointeurs souples ; **I10** `assertVocabulaire` chez les fabricants ; **I11** « Annuler » par le document du vol, battement ; **I12**
  `stopReason`, 6 000 jetons ; **I13** `vide` → rien d'écrit ; **I14** D-3 soumise à Neegan ; **I15** purge par suppression `local` ; **I16**
  `ROUTES_DE_SAISIE`, structure R-VIS-8 ; **I17** photo du plat et réordonnancement gardés, relecture d'une `available` sortie.
- **Rév. 2 → 3** : **N1** une seule primitive (`conditions` de `db.mutate`) ; **N2** `MUTATING_METHODS` inchangé, portée `outbox` conditionnelle ;
  **N3** seule la séance de l'écran ciblé quitte les rappels ; **N4** garde I-5 sur toute version non `ai` ; **N5** « par paragraphe » seulement
  si une étape porte un saut de ligne ; m1-m10 (« À envoyer » monte à la purge, battement `device`, `?section=imports`, bouton hors de la
  carte, signatures, `reponse_illisible`, unités, § 1, mutant de la vague, `pre-line`).
- **Pré-vol, rév. 3.1 et plan rév. 2** : `imports` dernier synchronisé, avant `settings` ; pas de `db.transitionner` ; signatures `(provider,
  images, opts)` ; `REPONSE_BRUTE_MAX` ; possessifs dans les mots vides ; `...detectTimers(text)` ; `SYNC_STORES_0003` figée dès T1 ; filets i18n ;
  fixture d'archive réelle générée avant T1 ; `lancerExtraction` / `annulerVol` exportés pour T6 ; preuve § 10 souhaitée, non bloquante.
- **T1-R1** `saveBatch` conditionné refuse un patch ; garde `noDelete` sur le chemin conditionné ; `transitionner` rend la fiche et émet un
  `change` par magasin ; `attendus` validés ; refus borné ; un patch ne change pas la clé ; deux conditions sur une fiche refusées ;
  `payloads` relayé ; « Créer les références » cinquième fabricant ; `resetClock()` pour les tests.
- **T2** preuve `0005` : 35 verdicts, un seul compte de preuve, 2.02 compte les 27 synchronisées par leur nom ; jamais la colonne `data`
  (listes blanches des lectures, R1 ; des réponses `sync_push`, alias `t` compris, R2) ; `ajoutSeul` rend `0003` et `0005`.
- **`required.imports = []`** (constat 10 de T2, refusé deux fois par l'implémenteur, tranché par le chef d'orchestre) : `required` ne liste
  que les champs que l'app pose TOUJOURS ; `edition_id` est nul pour un index ou un « Regrouper en recette », un import `web` (lot B) n'aura pas
  de `scan_session_id` ; une relation d'archive tolère le nul ; coût si faux : une fiche sans séance passerait le serveur (défense en
  profondeur seulement, la forme est tenue par les fabricants) ; pas de `0006`.
- **T3-R1-a** `fabriquerExtraction({ remplacer })` porte le « non » de I-5 · **b** création de la ligne conditionnée (`absente` + index
  `recipe_id`), ligne lue avant le premier `putFile` · **c** Cc/Cf retirés des textes du modèle, `BORNES_NOMBRES` → `null` · **d** séparateurs
  `\p{P}`, référence sans mot distinctif = discordance · **e** `printed_page` de la fiche sur la PREMIÈRE page sans numéro seulement · **f**
  `RAISONS_ECHEC` sans `trop_lourd` (413 = `requete` + extra), `non_connecte` ratifié · **g** `extractIndexFromImages` rend `{ entries,
  uncertain }` (enveloppe retirée en T6-R1) · **h** `preparerPhotoLocale` : liste des images + HEIC, un PDF refusé · **i** `parseStepsBlock` ne
  normalise que CRLF · **j** `issuesPourImage` partagé ; refusé : `complete` qui rendrait `{ texte, stopReason, modele }`.
- **T4-R1-a** `a_verifier → echec(illisible)` RATIFIÉE (un seul cas : résultat relu invalide ; la seule écriture d'un simple montage) · **b**
  « Rattacher » lié à la lecture (`cleLecture`) · **c** fiche supprimée jamais ressuscitée · **d** `model` (≤ 80) et `photo_sha256` (64 hex)
  relus bornés · **e** `t()` en une passe · **f** toast et navigation seulement si l'écran est monté · **g** carte « Connecte-toi » seulement
  là où le primaire appelle · **h** « p. imprimée » 1..9999 · **i** « Importer » sous une `partial` seulement sans `source_url` · **j** réponse
  brute bornée en un seul lieu (`contexteDe`).
- **T4-R2-a** une réponse (« Rattacher », « Remplacer », « Garder ma version ») vaut pour la lecture pour laquelle la question a été POSÉE ; un
  redessin oublie la question d'une lecture remplacée.
- **T5-R1-a** fiche sans photo : rien d'ajouté (plus de « null ») · **b** une ligne enregistrée `verified` perd `uncertain` · **c** ligne vide
  interne d'une étape repliée en mode paragraphe · **d** une relecture IA depuis « Corriger » n'hérite rien ; `estExtractionNonRelue` = lecture
  de l'assistant à vérifier (`extraction` ou `correction`) · **e** `?v=` d'une autre recette ignoré · **f** `lu_le` hérité, date illisible
  jamais dite · **g** `banniereLecture(version, ligne)`, « Incertain » lu dans la ligne de CET import · **h** photo par `displayUrl(fichier,
  urlDeBlob)` ; non tranchés : une correction qui hérite `incomplete` ou `missing_page` garde la fiche `partial` ; une extraction enregistrée
  après sa lecture est datée de l'enregistrement.
- **T6-R1-a** une lecture sans référence relancée passe `a_verifier → a_lancer → en_cours` en UNE transaction, après les gardes · **b**
  `VOL_MORT_MS` = 10 min pour une ligne `en_cours` d'un autre appareil (90 s inchangées ici) · **c** passe `interrompu` rejouée à l'affichage
  de la section · **d** clôture (éditeur, panneau), « Ignorer » et revalidation liés à `cleLecture` · **e** `import_id` en version seulement
  quand la lecture posée est close ; `incomplete`, `missing_page`, `titre_lu` portés dès qu'une lecture a été posée · **f** `echec` sans page →
  pas de « Relancer » ; référence devenue `available` → « Ignorer » seul · **g** `BORNES_INDEX = { entrees: 500, incertains: 40, mentions: 80 }`
  · **h** un seul `modeleBorne` (chaîne vide → `null`).
- **VF-1** « Relire les pages » : pages de la version courante en tête de la ligne · **VF-2** battement hors de la ligne synchronisée
  (`battement:<id>` de `sync_state`, `transitionner({ autres })`) · **VF-3** éditeur « par paragraphe » dès qu'une lecture POSÉE porte une étape
  multi-ligne · **VF-4** le départ vaut pour les pages LUES, pages figées dès la pose du vol · **VF-5** clôture de l'écran ciblé liée à `cleLecture` ·
  **VF-6** « Reprendre » porte `?import=` ; ordre de préférence : ligne affichée, `?import=`, lecture reçue, cet appareil · **VF-7** I-5 ne compte que
  les versions non `ai` de `kind` `extraction` | `correction` · **VF-8** bandeau d'une LECTURE seulement, drapeaux montrés même sans `import_id` ·
  **VF-9** « Lecture reçue le {d} » = `started_at + duree_ms` (`dateReception`) · **VF-10** `provenance.uncertain_fields` (≤ 40 × 200), survit à la
  purge du journal · **VF-11** une définition d'« ouvert » (`importOuvert`) · **VF-12** `recent()` borné dans le futur (10 min), autre appareil jugé à
  l'heure corrigée (`getClockOffset`) · **VF-13** `pagePourEnvoi` muré AVANT le décodage (50 Mo, 50 Mpx → `trop_grande`) · **VF-14** « Extraire » de
  « Corriger » tient le vol du document (`tenirVol`) · **VF-15** l'écran rejoue la passe `interrompu` à l'affichage puis toutes les `BATTEMENT_MORT_MS +
  1 s` tant que sa ligne vole ailleurs ; la section une fois de plus. Refusés ou différés par la vague, puis RATIFIÉS tels quels à la clôture :
  « Ignorer » sur une référence absente (m9), une borne d'octets dans `ajouterPages` (m12), l'abandon de la relecture de « Corriger » au changement de
  route (m13).
- **RF2** (ronde finale 2) pages déjà liées en tête seulement si leurs octets sont ici ; garde I-5 de couverture (`pagesNonRelues`) dans
  `decider()` ; la phrase « Une version écrite à la main existe. … » seulement quand c'est vrai ; aucun texte neuf (« Garder ma version » réutilisé).
- **Clôture du chef d'orchestre** (spec § 12, 19 octobre, 17 h 40 ; écrite dans l'arbre de travail après `58bb49b`, non commise quand ces lignes ont
  été écrites : son commit mène la tête à `58bb49b` (dernier commit de code ; le commit de clôture qui pose ces documents le suit)) : m9, m12 et m13 RATIFIÉS ; `hb-ignore` déclaré équivalent (la condition en transaction relit le
  même battement) · **VF-16** (re-revue de la ronde finale 2, PROPRE) dettes de TEXTE, décision de produit pour Neegan (§ 5) : (a) la question I-5
  posée par la seule couverture vient sans phrase qui dise pourquoi (les pages non relues), (b) « Garder ma version » se lit mal quand la courante est
  une lecture de l'assistant ; aucune chaîne neuve n'était permise à la ronde · **VF-17** la couverture se mesure sur les pages de la NOUVELLE version
  (`source_page_ids` = `page_ids` présentes ici), plus strict que `ligne.page_ids` brut, jamais moins ; toute page de la courante non relue pose la
  question · survivant nommé **M3** (sous « Tests »).

**Tests.** `tests/import-cible.js` (neuf, `runImportCibleTests({ eq, ok })`, câblé dans `tests/tests.js` après `runPasserelleTests`) : montée 3 → 4,
`db.mutate` conditions, `repo.transitionner`, statique `transitionner(`, archive réelle 0.8.1, archives au vol (`rewriteArchive`), `createArchive`
sans le magasin, vocabulaire, domaine (transitions, discordance, ordre, âge ; `fabriquerExtraction`), `repo.ajouterPages`, `preparerPhotoLocale`,
`pagePourEnvoi`, l'écran (sous-blocs « écran — … »), fiche / cuisine / courses / « Corriger » (tâche 5), section « Imports » / reprise / journal /
démarrage (sous-blocs « tâche 6 — … »), statique de l'écran ; `tests/passerelle.js` porte l'extraction amendée et l'éditeur et le panneau d'index par
le journal (F-8 : « RIEN dans le journal » quand la session disparaît au clic). Filets i18n `MODULES_NEUFS` / `CHAINES_NEUVES_AILLEURS` : dans
`tests/ajouter.js` (pas `tests/creer-ia.js` comme le plan le disait), plus le détecteur `sansEntree` de `tests/creer-ia.js`, qui lit aussi
`src/ui/import-cible.js`. Tests de source de `tests/import-cible.js` : appelants d'`assertVocabulaire` (hors commentaires `//` et `/* */`, un compte
par fabricant), `SHELL` (`sw.js`), `transitionner(` (modules de `SHELL`), `Anthropic|Supabase` (l'écran), `pending_recipe` absent des modules de
`SHELL` (D-8 : « le `grep` reste »), `MODULES_NEUFS` qui contient l'écran ; plus les filets i18n, qui lisent les sources (`MODULES_NEUFS` /
`CHAINES_NEUVES_AILLEURS`, `sansEntree`) ; tout le reste par comportement. Lanceur `suite.cjs` strict depuis T4-R1 (l'ancien prenait un `h2` de la
scène de test pour le bilan et rendait `exit=0` sur une suite inachevée). **Mutants** (152 joués) : T1 6, T2 9, T3 28, T4 11, T5 17, T6 32, vague
finale 40 rouges sur 41 (`hb-ignore`, déclaré équivalent à la clôture), ronde finale 2 : 5 rouges sur 5, re-revue de la ronde finale 2 : 3, dont 2
rouges et **M3** survivant (`?.blob instanceof Blob` remplacé par la seule présence de la ligne `files` dans `pagesDejaLiees` : seule une ligne
`files` distante sans blob, fenêtre L2 avant R58, le tue ; pratiquement inatteignable pour les pages du lot A ; nommé à la clôture, ses sorties sont
restées dans le scratchpad du relecteur, pas dans le registre) ; sur des COPIES servies à part, sauf le premier de T1 et les cinq de T2-R1, joués EN
PLACE puis restaurés (`cmp`, `git checkout --`) : aujourd'hui interdit (mutations sur copie seulement). Ceux de la spec § 7 retrouvés dans les
rapports : archive sans `imports` refusée (T1), discordance ignorée et `signal` non relayé (T3), revalidation de « Reprendre » retirée (T4-R1 A, B),
`interrompu` malgré un battement récent (vague, I2b et hb-tx), relance qui reprend mal sa ligne (T6-R1 M17, M18), `pending_recipe` réintroduit (vague,
m15 : trois touchers d'« Importer » ne changent ni `sessionStorage` ni `localStorage` ; le `grep` reste), `assertVocabulaire` commenté (T1-R1 b, vague
m14). Non retrouvés dans le registre : « ordre journal → recette inversé », « `reparse()` perd `uncertain` » (seul son voisin « hérité par position »
est joué, T5-R1), « purge non capturée » (T6-R1 : « purge sans conditions » dit quasi équivalent) — à rejouer par le `/verify` de clôture.

**Ce qui n'est PAS prouvé.**
- **`0005` et sa preuve** : jamais jouées sur `mitsu` (syntaxe seulement). Constructions jamais mesurées : `attgenerated = 's'` avec
  `atttypid = 'text'::regtype`, `indexdef like …`, `count(*) filter (…)` en produit cartésien, `relname = any(array[…])`, `bool_and(data = …)`.
  « `store inconnu` → quarantaine `refus` » et la réception arrêtée sur `imports` sans `0005` : lecture du code, pas une mesure.
- **Aucune extraction réelle.** La preuve § 10 de la spec (une vraie page lue sur le site public : modèle, durée, fidélité, page dense) n'a
  jamais été faite ; que 6 000 jetons tiennent sous les 120 s du serveur, que le vrai modèle suive la consigne amendée (`incomplete`,
  `missing_page`, « garde-la entière »), les taux de `coupe`, `illisible`, `vide`, `hors_bornes` : inconnus.
- **Le 499 à « Annuler »** : prouvé sous Node seulement (lot passerelle, F-5) ; I-4 le dit (« peut-être compté »).
- **Deux appareils** : I-2 ne vaut que par appareil (le dernier qui enregistre gagne ; aucun verrou serveur) ; « Photos sur un autre appareil »,
  « Reprendre » d'un résultat reçu et la passe à 10 min d'un autre appareil sont prouvés sur fixtures ; aucune ligne `imports` n'a encore voyagé.
- **Safari et l'iPhone** : `capture`, focus après « Descendre », glisser au toucher (non fait : Monter / Descendre sont le chemin garanti),
  `createImageBitmap` d'une photo de 48 Mpx et HEIC, veille d'une PWA tuée puis relancée (battement, passe à l'affichage).
- Les horloges courtes des tests (battement 20 ms, veille 40 / 300 ms) : un faux rouge est possible sur une machine très chargée, jamais un faux vert.

**Dettes (assumées, une ligne chacune ; spec § 11 et § 12).**
- **m12** (vague, ratifiée à la clôture) : aucune borne d'octets dans `ajouterPages` — elle toucherait les PDF et EPUB de la séance générique,
  couramment au-delà de 50 Mo (décision de produit) ; le mur du décodage est dans `pagePourEnvoi` (50 Mo, 50 Mpx).
- **m13** (vague, ratifiée à la clôture) : la relecture de « Corriger » (hors journal) n'est pas abandonnée au changement de route (aucun crochet de
  sortie de route) ; le vol est tenu puis libéré à sa fin.
- **`hb-ignore`** : mutant déclaré équivalent à la clôture (la pré-lecture du battement dans `marquerInterrompus` n'est qu'une économie ; le mur est
  la condition relue en transaction).
- **M3** (survivant nommé, re-revue de la ronde finale 2) : `pagesDejaLiees` qui ne testerait que la présence de la ligne `files`, au lieu de `?.blob
  instanceof Blob`, resterait vert ; seule une ligne `files` distante sans blob (fenêtre L2, avant R58) le tue — pratiquement inatteignable pour les
  pages du lot A ; aucun test ne l'épingle.
- **`V1_SEULEMENT`** (`tests/sync.js`) incluait `imports` après T1 : FERMÉE en T1-R1 (filtre `MAGASINS_AJOUTES_APRES_V1` sur `V1_STORES` et
  `V1_SEULEMENT`, la base « v1 » vérifiée sans `imports`).
- **m9** : « Ignorer » n'est pas offert sur une ligne dont la référence n'est pas encore reçue (§ 4.5 « sans geste ») ; décision de produit, ratifiée
  à la clôture.
- **VF-16** (dettes de texte de la ronde finale 2 ; décision de produit pour Neegan, spec § 5) : la question posée par la seule couverture réutilise
  « Garder ma version » (aucun texte neuf permis à la ronde), qui se lit mal quand la courante est une lecture de l'assistant, et rien ne dit QUELLES
  pages ne sont pas relues. **VF-17**, portée : la couverture se mesure sur les pages de la nouvelle version ; toute page de la courante non relue
  pose la question (page pas encore reçue, sans octets, retirée, ou d'une autre `kind` : données anciennes, la question à chaque relecture) — coût si
  faux : une question de plus, jamais une perte silencieuse. Sur un second appareil, la p. 132 sans octets ne peut toujours pas être relue (lot G).
- `required.imports = []` est figé dans `sync_push` au collage (le changer ensuite = une `0006`) ; `0005` n'est pas figée : `SYNC_STORES_0005` +
  empreinte (`1af9e999…` si le fichier collé est celui du dépôt) au prochain lot qui touche le générateur.
- `TRANSITIONS` n'est pas un mur à l'exécution (`transitionPermise` n'est appelée nulle part dans `src/` ; le mur est `attendus`).
- Pas de borne `tailleJson(recette) ≤ 512 Kio` : une réponse hostile remplie à toutes les bornes finirait en quarantaine `refus` (bruyante,
  non destructive) ; deux extractions sur la MÊME instance de `PasserelleProvider` se liraient l'une l'autre (inatteignable : un vol par document).
- `cleLecture` sérialise `resultat` : une ligne ré-reçue du serveur aux clés JSON réordonnées change de clé → refus prudent (phrase, détachement,
  le second clic écrit sans elle).
- Résidu n° 6 de T6-R1 : un vol lancé sur B pour une ligne créée sur A peut être interrompu par A après 90 s (le battement interne n'est vu
  que sur B) ; conséquence : la phrase I-4, `reponse_brute` seule.
- n° 21 de T6-R1 : « Relancer » de la section, et les boutons de l'éditeur et du panneau, ne s'éteignent pas hors ligne ou sans session (un clic
  refusé n'écrit rien et dit pourquoi).
- Une ligne interne `battement:<id>` peut survivre à un onglet tué (effacée quand la ligne passe `interrompu` ici) ; la seconde passe de la
  section n'a lieu qu'une fois ; `appels` peut sous-compter d'un (ligne annulée entre l'écriture du compte et le départ du `fetch`).
- Une image refusée : l'éditeur et le panneau gardent « … Code : indecodable » (F-3 du lot passerelle), l'écran et la section disent le texte de
  l'image ; « Extraire » de « Corriger » d'une recette existante reste hors journal (exception I-3, à ratifier).
- `imports.photo_origin` : un champ de plus que § 3.1 (la fiche en a besoin), absent à la naissance de la ligne (posé avec la photo du plat), toléré
  par `required` vide ; le bloc « Repérée dans ton livre » de `recipe.js` dit encore « …ou scanne la recette. » ; la section se redessine depuis la
  base à chaque `change` d'`imports`, `scan_sessions` ou `recipes`.
- Constat 17 de T1 : « Supprimer ce livre » ne regarde pas `imports.edition_id` (relation d'archive dure) ; masqué en pratique (le bouton n'existe
  que sans recette ni page, et une ligne d'import naît sur des pages de ce livre) — non éprouvé.
- **I-2 aveugle à la sorte** : la condition de création (`{ index: 'recipe_id', valeur, exclus: IMPORTS_OUVERTS }`, `nouvelleLigneImport`) et la
  pré-vérification d'`ajouterPages` ne regardent que le statut ; l'écran ciblé ne retient que `kind === 'recette'` (`ligneOuverte`) et `ajouterPhotos`
  avale la `TransitionRefusee` sans toast. Une ligne `web` ou `couverture` ouverte sur la même `recipe_id` rendrait « Photographier » muet. Aucun
  client du lot A n'écrit une telle ligne (seulement `recette`, et `index` sans `recipe_id`) : à trancher au lot B (ci-dessous). Seul le statut
  inconnu est éprouvé non bloquant (`tests/import-cible.js`, statuts `zzz` et `null`).
- `imports` est chargé dans `getData` à chaque rendu (spec § 11, « à surveiller » ; `reponse_brute` bornée à 16 000 points de code et effacée à
  `enregistre`).
- Le commentaire de tête de `src/ui/import-cible.js` (« Tout ce que l'écran écrit passe par repo.transitionner ») est trop large : le numéro imprimé
  passe par `repo.save('source_pages', …)`, les octets par `repo.putFile` et `repo.ajouterPages`.

**Ce que les lots suivants attendent d'A** (chaîne **A → B → G → C → D → E → F** ; B et G peuvent se construire en parallèle mais fusionnent
l'un après l'autre : `sw.js`, `APP_VERSION`, `en.js`, `schema.js` et le total épinglé sont communs, spec § 9) :
- **Tous** : une seule porte d'écriture conditionnée (`db.mutate({ conditions })` + `repo.transitionner`, test statique) ; le journal comme langue
  commune (`STATUTS_IMPORT`, `TRANSITIONS`, `RAISONS_ECHEC`, `importOuvert`, `lignesImports`, `cibleReprise`) : une sorte neuve s'ajoute à
  `KINDS_IMPORT`, à `cibleReprise` et à `lignesImports`, et `required.imports` vide la laisse passer sans migration (si elle porte une `recipe_id`,
  I-2 la compte quelle que soit sa sorte : voir B) ; un magasin neuf va dans `MAGASINS_AJOUTES_APRES_V1` et dans une migration à ajout seul
  (`ajoutSeul` → `0006`), APRÈS avoir figé `SYNC_STORES_0005` et l'empreinte de `0005` collée ; un résultat du modèle se valide à l'écriture ET se
  revalide à la relecture (`validateParsedRecipe`, `validerIndex`).
- **B** (lecture d'une page web) : la sorte `web` réservée ; le toast « Un lien web s’importe au lot suivant. » de l'écran ciblé (signet) est la porte
  à remplacer ; une ligne sans `scan_session_id` (d'où `required` vide). **À trancher par B** : I-2 tient par STATUT, toutes sortes confondues
  (condition d'index `recipe_id` + `IMPORTS_OUVERTS`, pré-vérification d'`ajouterPages`), alors que `ligneOuverte` de l'écran ciblé ne retient que
  `kind === 'recette'` : une ligne `web` ouverte sur une référence rend « Photographier » muet sur cet écran. B choisit : une condition sensible à la
  sorte, ou montrer et reprendre la ligne `web` dans l'écran ciblé ; dans les deux cas, `ajouterPhotos` doit dire un refus au lieu de l'avaler.
- **G** (octets entre appareils) : conditionne la preuve « deux appareils » ; A dit aujourd'hui « Photos sur un autre appareil », refuse
  `octets_absents`, ne place en tête d'une relecture que les pages dont les octets sont ici (RF2) et n'offre « Reprendre » ailleurs qu'avec un
  résultat ; I-2 reste par appareil.
- **C** (table des matières structurée, ordre proposé) : consomme les lignes `kind: 'index'` (`resultat = { entries, uncertain }`, `validerIndex`,
  `BORNES_INDEX`) et le panneau d'index par le journal (`?import=`).
- **D** (classement automatique d'un lot de photos) : consomme le journal, `repo.ajouterPages` / `repo.ouvrirImport`, et l'appariement de C
  (`index_page_id`).
- **E** (couverture) : la sorte `couverture` réservée ; `preparerPhotoLocale` (le mur des couvertures, partagé).
- **F** (photo du plat automatique) : `recipes.photo_sha256` / `photo_origin` (A) et l'image web de B ; I-6 tient (pages ≠ photo du plat).

**Gestes de Neegan, dans cet ordre.**
1. **`0005` AVANT tout `push`** (`supabase/README.md`, étape 11) : dans l'éditeur SQL de `mitsu`, **d'abord** une adresse de preuve `exemple.invalid`
   dans `private.allowed_users` ; coller `supabase/migrations/0005_imports.sql` **entière** (attendu `Success. No rows returned`) ; puis, **collée
   seule**, `notify pgrst, 'reload schema';` ; puis `supabase/proofs/0005_imports.sql` (jetons remplacés : `A_UUID` par un `select
   gen_random_uuid();`, `A_EMAIL` par l'adresse de preuve, en minuscules ; « Run without RLS ») : lire la ligne `999 BILAN` (attendu : `0 faux sur
   35`, `ok` vrai) et coller le tableau tel quel dans `supabase/proofs/RESULTATS-mitsu.md`, section « Preuve `0005_imports.sql` — à jouer » (jetons
   remis, aucune adresse) ; retirer l'adresse de preuve ; relever `shasum -a 256 supabase/migrations/0005_imports.sql` (attendu `1af9e999…`). Sans
   `0005`, un client neuf mettrait ses lignes `imports` en quarantaine `refus` (bruyante, non destructive).
2. Après `/verify`, **d'abord écarter un fichier non suivi** de l'arbre principal : `docs/audits/2026-10-18-import-livres-photos-web.md` existe
   NON SUIVI dans `~/projects/mistu` (`git status` : `?? docs/audits/`), identique à celui de la branche, et `merge --ff-only` refuserait quand
   même (« untracked working tree files would be overwritten », mesuré sur un dépôt sonde ; même piège que `STATE.md` au lot web). Comparer :
   `! git -C ~/projects/mistu show import-cible:docs/audits/2026-10-18-import-livres-photos-web.md | cmp - ~/projects/mistu/docs/audits/2026-10-18-import-livres-photos-web.md`
   (muet ; s'il parle, ne pas fusionner), puis
   `! rm ~/projects/mistu/docs/audits/2026-10-18-import-livres-photos-web.md && rmdir ~/projects/mistu/docs/audits` (la fusion le ramène, suivi).
   Ensuite `! git -C ~/projects/mistu merge --ff-only import-cible` (`main` est encore `57babc6`, la base : avance rapide), puis
   `! git -C ~/projects/mistu push origin main`. Ouvrir `https://neegans.github.io/mistu/tests/` et lire le BILAN (attendu : 3694/3694, total
   épinglé 3693, plus le 404 de `/favicon.ico`) ; service worker `cuisine-os-v0.9.0-13`.
3. **Preuve réelle** sur le site public, connecté (Mac, onglet Réseau ouvert) : une recette « Repérée dans ton livre » → « Importer cette
   recette » → `#/recipes/<id>/importer` ; ses pages (photographiées ou choisies, remises dans l'ordre), la photo du plat si le livre en a une ;
   **« Extraire et enregistrer »** : c'est la **PREMIÈRE extraction réelle** jamais faite — noter le modèle (Réglages → Assistant), la durée, le
   texte obtenu contre la page et ce qui est dit incertain ; une page **dense** dit si 6 000 jetons tiennent sous les 120 s du serveur. Puis la
   section « Imports » de la page Ajouter : « Reprendre » (une lecture reçue s'enregistre sans appel), « Ignorer », « Annuler » pendant un vol
   (la phrase « L’appel a peut-être été compté… ») ; puis, dans l'éditeur SQL, `select jour, appels from public.assistant_usage_jour;`.
4. **iPhone** : la même route depuis l'app installée (« Photographier », focus après « Descendre », une photo pleine taille ; fermer l'app en
   plein vol et la rouvrir : « La lecture a été interrompue… » après 90 s).
5. **Décision de texte (VF-16, spec § 5)**, sans urgence : une phrase qui dise pourquoi « Remplacer par cette lecture ? » est posée quand la lecture
   ne couvre pas toutes les pages (lesquelles ne sont pas relues), et un libellé pour « Garder ma version » quand la courante est une lecture de
   l'assistant. Coût d'attendre : une question de plus, jamais une perte.
6. « clean » **en dernier** : le registre `.superpowers/sdd/2026-10-18-import-cible/` (hors git) est déjà copié dans
   `~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet le 19 octobre) ; le recopier si la clôture y ajoute quelque chose (`diff -rq` muet de
   nouveau), puis `git worktree remove` de `mistu-import`.

**Versions.** `APP_VERSION = '0.9.0'` (était 0.8.1 ; pins relevés dans `tests/ajouter.js`, `tests/sync-l3.js`, `tests/recherche-web.js`,
`tests/assistant-compte.js`, `tests/creer-ia.js`, `tests/passerelle.js`), `DB_VERSION = 4` (était 3 ; magasin `imports`), `sw.js VERSION =
'cuisine-os-v0.9.0-13'` (`-1` à T1, monotone à chaque tâche et ronde qui touche `src/`, `-12` à la vague finale, puis la ronde finale 2), `SHELL` +
`./src/domain/vocabulaire.js`, `./src/domain/import-cible.js`, `./src/ui/import-cible.js`. CSP inchangée. La migration `0005` est côté
serveur, GÉNÉRÉE (à ajout seul ; `0001`, `0002`, `0003` inchangées octet pour octet).

**Bilan (ronde finale 2, `58bb49b` (dernier commit de code ; le commit de clôture qui pose ces documents le suit), 19 octobre 2026, 19 h 45).** Suite complète **3694/3694** (total épinglé **3693** dans `tests/tests.js`, règle N−1 ;
départ du lot sur `7fba2da` : 3011/3011, épinglé 3010 ; T1 3072 puis 3088, T2 3088, T3 3244 puis 3284, T4 3424 puis 3443 et 3450, T5 3492
puis 3509, T6 3587 puis 3633, vague finale 3682, épinglé 3681), une seule erreur de console : le 404 de `/favicon.ico` (préexistant) ; `node
--test tools/*.test.mjs` **125/125** (101 au départ) ; `node tools/generer-migrations.mjs --check` : **0** ; pglast v8.6 : `0005` =
23 instructions et 4 fonctions, preuve = 37 instructions et 2 blocs `do`, aucune erreur ; empreintes `0003` `37f9f80d…` (épinglée), `0005`
`1af9e999…` (172 lignes, non épinglée) ; aucun caractère invisible ni insécable (Python `-I`) ni aucune clé (motifs Anthropic, JWT, Supabase, Google) dans les
fichiers touchés, à chaque ronde. Méthode : test rouge d'abord à chaque tâche et ronde (rouge lu, souvent rejoué sur une copie de l'ancien
code), puis vert ; mutants sur copies (six exceptions anciennes, dites sous « Tests »).

**Fusion.** `0005` collée et prouvée **avant** tout `push` ; `/verify` par le chef d'orchestre ; le fichier non suivi `docs/audits/…` de
`~/projects/mistu` s'écarte (`cmp` muet ; déjà écarté par le chef d’orchestre le 19 octobre, déplacé hors du dépôt) **avant** `merge --ff-only` ; le registre, déjà copié, se recopie s'il a bougé **avant** tout `git worktree
remove`. Rien sous `supabase/functions/` : la fonction `assistant` déployée (version 3) sert ce lot telle quelle.

### Recette web complète : outil `lecture-web`, JSON-LD puis modèle, « Garder et lire » (19-20 octobre 2026, lot B)

**Pour toi.** Un lien web gardé devient une vraie recette : ingrédients, étapes, portions, temps, avec le site et l'auteur. Sur la fiche d'un lien,
**« Lire la recette avec l’assistant »** ; dans l'onglet Web, sous « Voir la recette » · « Garder ce lien », un bouton **« Garder et lire »** garde le
lien (titre, adresse et repères de la carte) et lance la lecture d'un seul geste. C'est la fonction `assistant` qui télécharge la page (jamais ton
téléphone) : elle lit d'abord les données que le site publie pour les moteurs (JSON-LD `Recipe` : **aucun jeton dépensé**), et seulement sinon fait
lire le texte de la page par le modèle. L'écran `#/recipes/<id>/importer` montre ce qui a été lu — « Lue sur ricardocuisine.com — vérifie avant
d’enregistrer. », puis « Selon la page : {site} · {auteur} · {date} » et « Lue dans les données de la page : aucun jeton dépensé. » ou « Texte de la
page lu par l’assistant. » —, puis **« Enregistrer »** : la fiche du lien devient la recette (même fiche ; à la première lecture, son titre devient le
titre lu), toutes les lignes restent « à vérifier » (« Corriger » sur la fiche). L'hôte réel est toujours dit en premier ; le site et l'auteur que la
page déclare viennent après, étiquetés « Selon la page ». « Ouvrir le lien » reste sur toute fiche qui vient du web. Une adresse en `http:` n'est
jamais lue : la fiche n'a ni bouton de lecture ni « Réessayer », seulement « Ouvrir le lien » et la phrase du refus (l'onglet Web ne propose pas
« Garder et lire », l'écran web garde son bouton éteint). Si la page ne se lit pas (site injoignable ou qui refuse les robots, PDF, page trop lourde
ou vide), le lien reste un lien, l'écran et la fiche disent pourquoi, et « Réessayer » relance. Une fiche déjà lue offre « Relire la page avec
l’assistant » : une version que tu as ÉCRITE (saisie ou corrigée à la main) n'est jamais remplacée sans « Remplacer par cette lecture ? » (« Ajouter
sans remplacer » d'abord, présélectionné) ; une lecture ou une correction de l'assistant, même vérifiée, est remplacée comme version courante sans
question, l'ancienne restant dans l'historique (R-B-19). La même adresse gardée deux fois dit « Tu as déjà gardé cette adresse. » + « Ouvrir la
fiche », sans rien écrire. La section « Imports » d'Ajouter liste les lectures web (« {titre} — Lien web · {hôte} »), avec « Réessayer » même pour une
lecture lancée sur un autre appareil. Chaque lecture compte pour un appel dans ton quota du jour (60 par défaut ; le secret `ASSISTANT_QUOTA_JOUR` le
règle), même lue dans les données de la page ; un rendement « 750 ml » ou « 9x13 pan » donne des portions inconnues, jamais inventées (R-B-22). Rien
n'arrive sur le site public avant le lot A, `0006`, le redéploiement de la fonction, ta fusion et ton `push` ; **aucune lecture réelle n'a encore eu
lieu**.

**Où.** Branche `recette-web`, worktree `~/projects/mistu-recette-web` (jamais `~/projects/mistu`), serveur de vérification `http://localhost:8089/`
(suite : `http://localhost:8089/tests/`). Spec : `docs/superpowers/specs/2026-10-19-recette-web-design.md` (rév. 4 ; **§ 0** : décisions D-B1 à
D-B27 ; **§ 2** : invariants I-B1 à I-B11 ; **§ 12** : rulings, de la revue de spec à la clôture, R-B-22 bis compris ; **§ 13** : sept points, deux
ouverts avec leur défaut appliqué, puis, points 3 à 7, les dettes R-B-27). Plan : `docs/superpowers/plans/2026-10-19-recette-web.md` (rév. 3, rejouée
sur la tête finale du lot A par la voie (a), R-B-16). Registre, **hors git** : `.superpowers/sdd/2026-10-19-recette-web/` (`progress.md` ;
`cloture.md`, les gestes de clôture ; un brief et un rapport par tâche, avec leur ronde ; `final-fix-report.md` pour la vague finale ;
`ronde-finale-2-report.md` pour `51bad50` ; `rulings-chef.md`, les rulings R-B-17 à R-B-28 et R-B-22 bis ; `bilan-workflow.md`, les réserves des
rondes et les Minor de la revue finale ; `verify-51bad50.txt`, la mesure finale : suite 3997/3997, Node 172, épingle à `tests/tests.js:225`, `sw.js`
`-8`, `--check` 0, invisibles 0 ; lanceur strict `suite.cjs`). Base : la tête finale du lot A, `2b6a2fd` (branche `import-cible`, elle-même sur `main`
`57babc6`) : **B est EMPILÉ sur A** et fusionne après lui. Spec `37726df` et plan `e411779` (la base des tâches), puis 14 commits de construction
jusqu'à `ebbcf10` (T1 `f858203` + `270b10a` ; T2 `aec3d26` + `8df4f15` ; T3 `f2ed3da` + `d9fefd3` ; T4 `a4ea9ad` + `728945a` ; T5 `3ca8d19` +
`d927c8b` ; T6 `b44833f` + `9aeeee4` ; vague finale `d8163be` app, `ebbcf10` serveur), puis la ronde finale 2 (`51bad50` : R-B-22, R-B-23, `sw.js`
`-8`) : 15 commits de code sur `e411779`, jusqu'à `51bad50` (le dernier commit de code). Le suivent deux commits de spec, `7df269e` (rulings R-B-17 à
R-B-28 et amendements de clôture) et `76d88dd` (bilan des mutants vérifiable, R-B-22 bis, heure du Départ ; co-signé Claude Fable 5.1), puis le commit
de clôture qui pose ces documents. Six tâches menées par le workflow SDD : chacune un implémenteur (Claude Opus 5.5, trailers `Co-Authored-By` des
commits), une revue adverse à trois lentilles (spec, sécurité, faux-vert, mutants rejoués sur des copies) et une ronde, puis une re-revue PROPRE ;
puis la revue finale de branche (4 Important, 10 Minor), sa **vague finale**, la **ronde finale 2** et la **clôture** du chef d'orchestre (rulings
R-B-17 à R-B-28, puis R-B-22 bis). **FINI dans le worktree, PAS fusionné, PAS poussé, `0006` PAS collée, fonction `assistant` PAS redéployée** (la
version 3 du lot 4 sert toujours : le chemin `lecture-web` n'existe pas encore sur `mitsu`) ; `/verify` de clôture : au chef d'orchestre, sur la tête
finale. Fichiers :
- Serveur : `supabase/functions/assistant/lecture-web.js` (neuf, pur, FEUILLE sans import, Node et Deno), `logique.js` (`OUTILS` à quatre,
  `lireDemande` pour `lecture-web`, `CONSIGNE_LECTURE_WEB`, `neutraliser`, `corpsLectureModele`), `index.ts` (`hotesRefuses`, `telechargerPage`,
  `appelerAnthropic`, le bloc `lecture-web` de `traiter`), `supabase/migrations/0006_lecture_web.sql` (écrite à la main),
  `supabase/proofs/0006_lecture_web.sql`, `supabase/README.md` (étape 12), `supabase/proofs/RESULTATS-mitsu.md` (sections « Preuve
  `0006_lecture_web.sql` — à jouer » et « Sondes `lecture-web` »), `tools/generer-migrations.mjs` (deux commentaires : « la 0007 à venir »).
- Domaine : `src/domain/lecture-web.js` (neuf : `lirePage`, `retirerAdresses`, `lireLecture`, `relireResultat`, `lireRecetteWeb`, `fabriquerImportWeb`,
  `versionHumaine`, `fabriquerLectureWeb`), `src/core/lien.js` (`adresseNormalisee`, `doublonDAdresse`, `ADRESSE_MAX`), `src/domain/recherche-web.js`
  (`normaliserPourAdresse`, `porteUneAdresse` et `ficheDe` exportées, `reperesDe` neuve, `MOTIF_ADRESSE` ancré), `src/domain/import-cible.js`
  (`RAISONS_ECHEC` + six raisons, `versionEcrite`, `cleLecture` et `modeleBorne` déménagés ici, `KINDS_IMPORT` + `'web'`, `KINDS_PAGES`, `cibleReprise`
  et `lignesImports` pour le web), `src/domain/passerelle.js` (`RAISON_DE_ERREUR` + cinq raisons web), `src/domain/vocabulaire.js`
  (`recipes.source_kind`), `src/domain/llm.js` (commentaire : `ErreurExtraction('lien')`), `src/model/schema.js` (`APP_VERSION 0.10.0`, `SOURCE_KINDS`),
  `src/model/repo.js` (gardes `KINDS_PAGES` d'`ouvrirImport` et d'`ajouterPages`).
- Écrans : `src/ui/vol.js` (neuf, feuille : LE vol du document), `src/ui/import-web.js` (neuf : l'écran web, `demarrerLectureWeb`, `lancerLecture`,
  `annulerLecture`, `enregistrerLecture`, `texteEchecLecture`), `src/ui/import-cible.js` (son vol vient de `vol.js` ; délègue une fiche à `source_url` ;
  `texteRefus` dit `interdit`), `src/ui/recipe.js` (`blocSignet(recipe, ctx, …)`, `basculerSessionSignet`, bandeau web, « Ouvrir le lien »,
  relecture), `src/ui/search.js` (`garderEtLire`, seconde rangée), `src/ui/signet.js` (`reperes`, `doublon`, `signet_doublon`), `src/ui/components.js`
  (`ligneReperes`, déménagée de `search.js`), `src/ui/add.js` (lignes web de la section « Imports »), `src/i18n/en.js`, `sw.js`.
- Tests : `tests/lecture-web.js` (neuf), `tests/import-cible.js`, `tests/recherche-web.js`, `tests/ajouter.js`, `tests/passerelle.js`, pins de version
  (`tests/assistant-compte.js`, `tests/creer-ia.js`, `tests/sync-l3.js`), `tests/tests.js` ; Node : `tools/assistant-lecture-web.test.mjs` (neuf),
  `tools/lien.test.mjs` (neuf, vague finale), `tools/assistant-index.test.mjs`, `tools/assistant-logique.test.mjs`, `tools/generer-migrations.test.mjs`.

**Décisions (spec § 0), une ligne chacune.**
- **D-B1** outil neuf `lecture-web` : le client n'envoie que `{ url }` (https, ASCII visible, ≤ 2 048 points de code) ; la FONCTION télécharge (https
  seul ; IP littérales, `localhost`, `.local` / `.internal` / `.localhost`, hôte sans point, hôte de `SUPABASE_URL` refusés, ses sous-domaines et
  l'alias `<ref>.functions.supabase.co` aussi, R-B-26 et R-B-23 ; `redirect: 'manual'`, 3 sauts revalidés ; 15 s par saut, 30 s en tout ; 2 Mio ;
  `text/html` ou `application/xhtml+xml` ; aucun cookie ni identité, `User-Agent` qui nomme Mitsu) ; le mur contre un hôte qui résoudrait vers une
  adresse interne est TLS ; pas d'épinglage d'IP.
- **D-B2** JSON-LD d'abord : une `Recipe` LISIBLE → réponse sans modèle (`source_kind: 'jsonld'`, 0 jeton) ; sinon le texte principal (≤ 40 000 points
  de code, coupe dite) lu par le modèle du serveur avec une consigne SERVEUR (`CONSIGNE_LECTURE_WEB`), `max_tokens` 6 000 ; la fonction relaie, le
  client valide.
- **D-B3** réponse 200 `{ source_kind, page: { url_finale, hote, titre_page, auteur, site, lue_le, autres_recettes, texte_coupe }, recette, usage,
  stop_reason, model }` ; refus typés `interdit` 422, `inaccessible` 502, `pas_une_page` 422, `trop_lourde` 413, `vide` 422, `delai` 504 ; tout appel
  admis compte dans le quota (réservation avant tout téléchargement).
- **D-B4** une ligne `imports` `kind: 'web'` par lecture (`recipe_id` = le signet ; `edition_id`, `scan_session_id` nuls ; `page_ids: []`) ; mêmes
  statuts et transitions que le lot A ; création conditionnée en transaction ; l'adresse lue est celle du signet relu, jamais retapée.
- **D-B5** deux entrées : la fiche d'un signet (« Lire la recette avec l’assistant ») et l'onglet Web (« Garder et lire ») ; hors le journal, rien n'est
  écrit avant « Enregistrer » ; un échec laisse le signet `reference_only`.
- **D-B6** champs neufs sur `recipes` (JSON, sans index, `DB_VERSION` 4) : `source_author`, `source_site`, `source_fetched_at`, `source_kind`,
  `web_reperes`.
- **D-B7** doublon d'adresse NORMALISÉE (schéma et hôte en minuscules ; fragment, identifiants, `utm_*` / `fbclid` / `gclid` retirés ; barre finale
  indifférente) : dit, rien d'écrit, jamais de fusion.
- **D-B8** I-5 du lot A vaut ici : « Remplacer par cette lecture ? » sur une version écrite (critère amendé par R-B-19) ; « Ajouter sans remplacer »
  d'abord (R-B-12) ; la relecture d'une fiche lue par l'assistant remplace la version `ai` courante (l'ancienne reste).
- **D-B9** hors périmètre : image du plat (F), PDF, page derrière une connexion, traduction, nutrition ; plusieurs recettes : la première LISIBLE gagne,
  « D’autres recettes étaient sur cette page : ouvre-la. ».
- **D-B10** redéploiement par le chef d'orchestre APRÈS `0006` collée et prouvée par Neegan, AVANT tout `push` ; sondes S13-S16 sans dépense, S17-S18 un
  appel du quota chacune, sans dépense Anthropic ; S19 (R-B-22 bis, l'alias de R-B-23) sans réservation ni dépense.
- **D-B11** `APP_VERSION 0.10.0`, `sw.js` monotone, `DB_VERSION` 4 ; `0006` prise À LA MAIN par ce lot, contrainte `outil` à CINQ valeurs (`image-web`
  pour F) ; le générateur dit « la 0007 à venir » (amendé par R-B-28 : G rév. 4 n'a pas de migration).
- **D-B12** analyse HTML sans dépendance, par balayages LINÉAIRES (`indexOf` ; aucune regex sur le HTML entier hors `decoderEntites` et les espaces) ;
  borne temporelle sur trois pages hostiles de 2 Mio.
- **D-B13** trois modules clients neufs sans cycle (`src/domain/lecture-web.js`, `src/ui/import-web.js`, `src/ui/vol.js`) ; `import-cible.js` →
  `import-web.js` en sens unique ; `cleLecture` dans le domaine.
- **D-B14** raisons distinctes côté client : `interdit`, `inaccessible`, `pas_une_page`, `page_trop_lourde` (jamais `trop_lourde`), `page_vide` (le
  `vide` de l'extraction garde son nom), plus `lien`.
- **D-B15** la réponse 200 porte aussi `stop_reason`, `model`, `page.autres_recettes`, `page.texte_coupe`.
- **D-B16** `web_reperes` posé seulement s'il y a des repères : sans eux, un signet est octet pour octet celui d'avant.
- **D-B17** `edition_id` de l'import web nul, même pour un signet rangé dans un livre ; la section dit « Lien web · {hôte} ».
- **D-B18** relecture : « Relire la page avec l’assistant » sur une fiche à `source_url` en https qui a déjà une version.
- **D-B19** port explicite et identifiants dans l'adresse refusés (`interdit`, R-B-1).
- **D-B20** décodage : `charset` du `content-type`, sinon `<meta>` dans les 4 096 premiers octets, sinon UTF-8 ; un label inconnu vaut UTF-8.
- **D-B21** « Garder et lire » écrit le signet ET l'import dans UNE transaction conditionnée, puis lance ; un lancement raté laisse un `a_lancer`.
- **D-B22** le journal serveur porte le statut rendu (200, 422, 502, 413, 504, 499), jetons 0 / 0 pour un JSON-LD.
- **D-B23** `0006` à la main : `drop` puis `add constraint assistant_journal_outil_check` à cinq valeurs dans l'ordre `'recherche-web', 'creation',
  'extraction', 'lecture-web', 'image-web'` ; `OUTILS` reste à quatre.
- **D-B24** à la PREMIÈRE lecture, le titre de la fiche devient le titre lu (l'ancien dans `provenance.titre_signet`) ; à une relecture, il est gardé
  (R-B-3).
- **D-B25** une `Recipe` n'est « trouvée » que LISIBLE (au moins une ligne ou une étape) ; une chaîne d'instructions est DÉCOUPÉE (jamais tronquée) en
  étapes ≤ 2 000 ; listes relayées coupées à la borne + 1 (81 lignes, 61 étapes).
- **D-B26** budget dit : 120 s pour la requête, 30 s au plus pour le téléchargement (15 s par saut), le modèle hérite du reste ; un abandon par le budget
  pendant le téléchargement est 504 `delai`.
- **D-B27** lieux : branche `recette-web`, worktree `~/projects/mistu-recette-web`, port 8089, registre `2026-10-19-recette-web` ; base = la tête finale du
  lot A, rejeu par la voie (a) (R-B-7, R-B-16).

**Ce qui marche, prouvé** (suite navigateur : `fetch` injecté, bases jetables, aucun réseau ; tests Node : faux `Deno`, faux supabase-js, faux `fetch`,
vraies `Request`, minuteries simulées ; **aucune lecture réelle, aucune sonde contre `mitsu`, fonction non redéployée**) :
- **La page, côté serveur** (`lecture-web.js`, Node). `valideAdresse` : https seul ; ASCII visible exigé AVANT `new URL` ; ≤ 2 048 (le `href`
  normalisé aussi) ; ni port ni identifiants ; hôte à point ; ni IP (formes numériques que `URL` ramène à une IPv4, IPv6 entre crochets), ni
  `localhost`, ni `.local` / `.internal` / `.localhost`, ni un hôte refusé ou l'un de ses sous-domaines. `extraireBlocsJsonLd` (balayage par
  `indexOf`, bloc ≤ 512 Kio, `@graph` et tableaux aplatis, JSON illisible ignoré) ; `recetteDepuisJsonLd` (`HowToStep` / `HowToSection` sur deux
  niveaux de sections, `PROFONDEUR_ETAPES = 5` pour tableaux et objets : 11 000 sections imbriquées ne lèvent plus ; `recipeIngredient` chaîne ou
  tableau ; `totalTime` → `total_minutes` ; `description` → `notes` coupée AU MOT à 2 000 au plus — la vague a fermé l'erreur de un d'`auMot` ;
  `portionsDe` selon R-B-22 et R-B-22 bis ; `image` ignorée ; `Object.hasOwn` partout, aucune pollution de prototype) ; `textePrincipal` (scripts,
  styles, `noscript`, `svg`, `template`, commentaires retirés ; `<main>`, puis `<article>`, puis `<body>` ; `nav`, `header`, `footer`, `aside`
  retirés, `<form>` seulement dans `main` / `article` et jamais s'il vide la zone ; une balise commence par `<` + lettre, `/`, `!` ou `?` ; coupe
  nette à 40 000 et `coupe: true`) ; `decoderEntites` en une passe bornée (table fermée ; Cc, Cf, surrogates, U+2028 / U+2029, U+007F retirés ; `&#9;`
  à `&#13;` rendus en blancs). Borne temporelle : trois pages hostiles de 2 Mio sous 500 ms (47 à 185 ms mesurés) ; le balayage quadratique et la
  version par regex rougissent (62 à 94 s).
- **La consigne et le corps du modèle** (`logique.js`, Node) : `CONSIGNE_LECTURE_WEB` épinglée mot pour mot (« DONNÉE », `"missing_page": false`,
  « Autre recette : ») ; `corpsLectureModele` (modèle forcé, `max_tokens` 6 000, délimiteurs `<<<PAGE>>>` / `<<<FIN>>>`) ; `neutraliser` espace d'un coup
  toute suite de trois chevrons ou plus (cinq chevrons ne referment plus le bloc de données) ; `lireDemande` : liste blanche `{ url }`, 400 `forme`, 422
  `interdit` AVANT la réservation.
- **Le chemin `lecture-web` d'`index.ts`** (`tools/assistant-index.test.mjs`) : refus `interdit` sans réservation ni fetch (t1 ; l'hôte de `SUPABASE_URL`,
  t1bis) ; JSON-LD → UN fetch (la page : `redirect: 'manual'`, `credentials: 'omit'`, exactement `user-agent` / `accept` / `accept-language`, jamais
  `authorization`, `apikey`, `cookie`, `x-api-key`), aucun fetch Anthropic, 200 `jsonld`, journal 200 à 0 / 0, ordre `is_allowed` → `assistant_reserver` →
  fetch → `update` (t2) ; une `Recipe` illisible → le modèle (t2bis) ; sans JSON-LD → la page puis Anthropic avec le texte entre les délimiteurs, jamais le
  HTML ni le `<script>` (t3) ; page de 50 000 → 40 000 et `texte_coupe` (t3bis) ; 301, 302, 303, 307, 308 suivis et revalidés, corps du 3xx annulé ; cible
  en `http:`, IP, `localhost` ou hôte du projet → 422 après réservation ; `location` absente ou illisible → 502 au premier saut ; quatre sauts → 502 ; 300
  et 304 → 502 (t4) ; l'alias `<ref>.functions.supabase.co` refusé (t4 bis, R-B-23) ; 4xx, 5xx, DNS → 502 `inaccessible` ; 15 s par saut, 30 s en tout ;
  abandon du budget de 120 s → 504 `delai` pendant les en-têtes ET pendant la lecture du corps (t5, qui tue R-B-11 depuis `8df4f15`) ; `content-type`
  refusé → 422 `pas_une_page` (t6) ; 2 Mio + 1 → 413 `trop_lourde`, flux coupé (t7) ; moins de 40 points de code → 422 `vide`, dans l'unité exacte
  (t8) ; client parti → 499 (t9) ; jamais le corps d'une page dans une erreur ni au journal (t10) ; bornes relayées (t11) ; 429 et 400 d'Anthropic
  relayés, 500 → 502 (t12) ; réponse SUIVIE malgré `redirect: 'manual'` (`r.redirected`) → 422 `interdit`, corps jamais lu (t13, vague). Test de source
  réécrit (N-1, `tools/generer-migrations.test.mjs`) : l'ordre des POINTS D'APPEL de `traiter` (gardes → réservation → `await telechargerPage(` →
  `lirePageHtml(` → `await appelerAnthropic(` → `.update(`), deux `await fetch(`, trois imports, `Deno.createHttpClient` et `caCerts` absents ; mutant
  « réservation après le téléchargement » rouge, témoin « déclaration avant `traiter` » vert. `tsc` 5.6.3 `--strict` : 0.
- **`0006` et sa preuve — syntaxe seulement** (pglast v8.6) : `0006` = 4 instructions (`begin` … `commit`), preuve = 12 instructions + 2 blocs `do`
  (`rollback;` dernier), aucune erreur ; test croisé : la liste SQL de `0006` égale le littéral `OUTILS_0006` (cinq valeurs) et `OUTILS` égale
  `OUTILS_0006.slice(0, 4)` ; mutants « `0006` à quatre outils » et « à trois outils » rouges ; README (étape 12) et RESULTATS épinglés. Ce n'est **pas**
  une exécution (voir « Non prouvé »).
- **Le domaine client** (`tests/lecture-web.js`) : `lirePage` (chaque champ par `borner`, épinglé par un test de source ; l'hôte RECALCULÉ par
  `lienSignet`, jamais celui du serveur ; `auteur` et `site` à `null` s'ils portent une adresse ; `lue_le` en ISO UTC seulement ; `autres_recettes` entier
  sûr) ; `lireLecture` (`coupe`, `illisible`, `hors_bornes`, `vide`, `lien` ; `total_minutes` du JSON-LD seulement, `null` par le modèle ; `printed_page`
  et `missing_page` forcés) ; `retirerAdresses` (titre à adresse → `lien` ; dans une ligne, une étape ou les notes → « [adresse retirée] », ligne
  `uncertain`, une entrée « adresse retirée dans … » par champ, jamais doublée ; champ entier si l'adresse ne s'isole pas ; `hors_bornes` si le marqueur
  déborde ; relecture idempotente ; `MOTIF_ADRESSE` et `MOTIF_FRAGMENT_ADRESSE` ancrés par lookbehind, linéaires, 0 écart sur 1,3 million de chaînes
  aléatoires) ; `lireRecetteWeb` (UN POST `{ outil: 'lecture-web', corps: { url } }`, trois en-têtes ; sans session, aucun fetch ; table serveur →
  client) ; `fabriquerLectureWeb` (fiche recomposée dans le signet, provenance exacte avec `lu_le` et `uncertain_fields` ≤ 40 × 200, `remplacer: false` =
  signet intact, D-B24, vocabulaire) ; `adresseNormalisee` (requête filtrée paire par paire, jamais resérialisée ; barres finales par une boucle linéaire)
  et `doublonDAdresse` (borne `ADRESSE_MAX` 2 048) — leur durée affirmée sous Node (`tools/lien.test.mjs` : l'ancienne regex prenait 5,8 s).
- **Le vol partagé** : `src/ui/vol.js` porte LA variable de vol du document ; un vol web refuse une extraction photo (`vol_tenu`), et l'inverse ;
  `import-cible.js` ré-exporte `DOCUMENT_ID`, `BATTEMENT_MS` et `volEnCours` de `vol.js` (et `cleLecture`, du domaine), ses tests passent tels quels ;
  `reinitialiserImportCible` y reste une fonction locale qui appelle `reinitialiserVol` ; battement par la ligne interne `battement:<id>` de
  `sync_state` (`repo.battre`, R-B-17), la ligne `imports` jamais réécrite pendant le vol, la ligne interne effacée en fin de vol.
- **« Garder et lire », signet, doublon** : UNE transaction écrit le signet (titre et adresse du résultat, `web_reperes` des quatre repères revalidés)
  et l'import `a_lancer` ; puis un POST avec l'adresse du signet RELU en base (une fixture distingue la base et l'écran) ; doublon → `.status` + « Ouvrir
  la fiche », zéro écriture, zéro POST ; double tape → un signet, un POST ; un résultat en `http:` n'offre pas le bouton ; hors ligne → signet et import
  écrits, zéro POST ; une écriture impossible → « Le lien n’a pas pu être gardé. Réessaie. », journalisée, bouton rallumé ; deux `demarrerLectureWeb`
  entrelacés → UNE ligne, UN POST (mutant « conditions retirées » rouge) ; `TransitionRefusee` à la création → l'import ouvert est relu et repris ; un
  import ouvert d'une autre sorte → refus nommé `transition` ; le lancement non attendu ne rejette jamais (`echec(interne)` journalisé). Formulaire du
  signet : bannière `doublon-adresse` à la frappe, « Garder le lien » éteint, `signet_doublon` en seconde porte.
- **L'écran `#/recipes/<id>/importer`, variante web** : une fiche à `source_url` y passe toujours (sens unique ; le toast « lot suivant » a disparu) ;
  aperçu aux textes exacts, l'hôte réel d'abord puis « Selon la page : … » (ordre épinglé), balisage reçu rendu en TEXTE ; lecture reçue revalidée à
  chaque rendu, illisible → `echec(illisible)` gardé par `cleLecture`, deux passes au plus ; « Enregistrer » en UNE transaction (`imports` `enregistre` +
  `recipe_versions` + `recipes`, ordre journal → recette espionné), fiche et versions RELUES après le dialogue (fiche modifiée ou supprimée pendant la
  question : rien d'écrasé ni de ressuscité ; question reposée si son fondement change) ; dialogue « Ajouter sans remplacer » d'abord, fermé → rien
  d'écrit, « Ajouter sans remplacer » → aucun `put` `recipes` ; « Enregistrer », « Ignorer », « Relire la page » et `marquerIllisible` liés à la lecture
  AFFICHÉE (deux onglets : rien d'écrit) ; « Annuler » (fetch abandonné, `echec(annule)` ; réponse tardive : `reponse_brute` seule) ; « Réessayer » ;
  « Relire la page » (UNE transition `a_verifier → en_cours`) ; hors ligne après le rendu ; table raison → texte complète ; choix de ligne R-B-20 (ligne
  affichée, `?import=`, lecture reçue, cet appareil) ; abonnement pris après montage, retiré au démontage ; veille VF-15 transposée (vague) : une ligne
  `en_cours` d'un document mort passe `interrompu` à l'affichage, puis toutes les 91 s tant qu'elle vole ailleurs.
- **La fiche** : `blocSignet` en cinq états (aucun import, `a_lancer`, `en_cours`, `a_verifier`, `echec`), session lue AVANT le rendu
  (`sessionAssistant`, appliquée après : la carte « Connecte-toi » est rendue cachée et le bouton éteint, puis `basculerSessionSignet` les règle ;
  jamais de flash) ; `http:` → aucun bouton, texte `interdit` ; hors ligne au rendu et à la tape (rien d'écrit) ; `web_reperes` et provenance relus au
  rendu (`reperesDe`, `lirePage`) ; après « Enregistrer » : « Ouvrir le lien » dans les actions, « Relire la page avec l’assistant », bandeau « Lue
  sur {h} le {d} · {m} — vérifie. » lu dans la provenance de LA version affichée (une ancienne version garde son auteur), avant la bannière du lot A,
  qui s'applique telle quelle à la ligne relue par `relireResultat` (S-7 : une entrée à adresse n'est jamais dite).
- **La section « Imports »** : une ligne par lecture web ouverte, « {titre} — Lien web · {hôte} » (titre isolé dans un `<bdi>`) ; « Réessayer » aussi pour
  une ligne d'un AUTRE appareil (jamais « Photos sur un autre appareil »), qui devient celle de cet appareil (`device_id` réécrit au départ, R-B-8) ;
  branche web avant la règle `available`, exemptée du filtre « sans page » (P-10) ; « Reprendre » → `/recipes/<id>/importer?import=<imp>` (R-B-20) ;
  signet pas encore reçu → « (référence pas encore reçue) », sans geste ; ligne sans `recipe_id` → « Sans titre — Lien web », « Ignorer » seul ;
  `repo.ouvrirImport({ kind: 'web' })` et `repo.ajouterPages` sur une ligne web → `TypeError`, rien d'écrit (P-1) ; « Réessayer » d'un signet relu en
  `http:` → texte `interdit`, zéro écriture (`texteRefus`, P-13) ; démarrage : une ligne web `en_cours` au battement mort → `interrompu` ; purge à 30 jours
  inchangée.
- **La ronde finale 2** (`51bad50`, après la vague) : `portionsDe` ne prend un entier que d'un nombre nu, d'un intervalle ou d'un nombre accompagné
  d'un mot de portion, sinon `null` (R-B-22 ; précisé par R-B-22 bis : 1 à 9 999 aussi pour un nombre JSON, chaîne nettoyée puis NFC, mot de portion
  avant ou après) ; `hotesRefuses()` refuse aussi l'alias `<ref>.functions.supabase.co` (R-B-23, t4 bis) ; `sw.js` `cuisine-os-v0.10.0-8` ; Node
  167 → 172 (quatre tests `portionsDe`, t4 bis).

**Forme des primitives** (une ligne chacune ; détail dans `docs/architecture.md`, section du lot) :
- `lecture-web.js` (serveur) : `valideAdresse(url, { hotesRefuses })` → `{ ok: true, href, hote } | { ok: false, raison: 'interdit' }` ; `hoteAdmis(hostname,
  hotesRefuses)` ; `typeAdmis(contentType)` ; `lireCharset(contentType, octets)` ; `lirePageHtml({ html, urlFinale, contentType })` → `{ jsonld: { recette,
  autres } | null, texte, texte_coupe, page }` ; `LIMITES_LECTURE` (gelée : `url` 2 048, `redirections` 3, `delaiSautMs` 15 000, `delaiTotalMs` 30 000,
  `page` 2 Mio, `blocJsonLd` 512 Kio, `texte` 40 000, `texteMin` 40, `maxTokens` 6 000, `titrePage` 300, `auteur` 200, `site` 200, puis les six
  bornes de recette, `notes` 2 000, `titre` 200, `ligne` 300, `etape` 2 000, `lignes` 80, `etapes` 60, miroir épinglé de `BORNES_EXTRACTION`).
- `index.ts` (rien d'exporté) : `hotesRefuses()` (hôte de `SUPABASE_URL`, ses sous-domaines, l'alias `<ref>.functions.supabase.co`) ;
  `telechargerPage(href, { signal, hotesRefuses })` → `{ html, urlFinale, contentType } | { erreur, statut }` ; `appelerAnthropic(corps, ctl)` → `{ statut,
  corpsReponse, usage, json }`, UN point d'appel pour les quatre outils.
- `logique.js` : `OUTILS` (quatre, `lecture-web` dernier) ; `lireDemande(texte, { outil, modele, maxTokens, octets, hotesRefuses })` ;
  `CONSIGNE_LECTURE_WEB` ; `neutraliser(texte)` ; `corpsLectureModele({ modele, texte })`. Littéraux de test : `OUTILS_0004`, `OUTILS_0006`
  (`tools/generer-migrations.test.mjs`).
- `src/ui/vol.js` : `DOCUMENT_ID`, `BATTEMENT_MS` (15 s), `prendreVol(tenue)` (avant tout `await`), `libererVol(tenue)` (seulement SA tenue),
  `volEnCours()` → `{ importId } | null`, `volTenu(importId)`, `reinitialiserVol()` (tests) ; une tenue = `{ importId, controller, repo }`.
- `src/ui/import-web.js` : `demarrerLectureWeb({ recipe, adresse, titre, reperes, ctx }, deps)` → `{ issue: 'ok', recipeId, importId, lancement }` |
  `{ issue: 'doublon', recette }` | `{ issue: 'refuse', raison: 'adresse' | 'interdit' | 'transition' }` (`lancement` ne rejette jamais) ;
  `lancerLecture(importId, { ctx, repo, fetch, maintenant, enLigne, battementMs, relire, cle })` → `{ issue: 'refuse', raison: vol_tenu | inconnu | statut
  | hors_ligne | non_connecte | interdit | transition }` | `{ issue: 'echec', raison }` | `{ issue: 'a_verifier' }` (la forme de `lancerExtraction`) ;
  `annulerLecture(importId)` → `true` si CE document tient ce vol ; `enregistrerLecture(importId, { repo, remplacer, maintenant, choisir, cle })` →
  `enregistre | annule | echec | refuse (statut, lecture, inconnu, transition)` ; `texteEchecLecture(erreur)` → `{ texte, code }` (un `switch` de
  `t('…')` littéraux) ; `renderImportWeb(params, query, ctx, deps)` (`root.etatRouteWeb()` → `{ importId, status, vol, remplacement }`) ;
  `ouverteWeb(i, recipeId)` = `importOuvert(i) && i.kind === 'web' && i.recipe_id === recipeId` ; `ligneWebOuverte(imports, recipeId, { prefere, moi })`
  (ordre R-B-20) ; `ecouterLecture`, `enLigneLecture`, `abonnesLecture` (tests).
- `src/domain/lecture-web.js` : `lirePage(corps)`, `retirerAdresses(recette)`, `MOTIF_FRAGMENT_ADRESSE`, `lireLecture(corps)`, `relireResultat(resultat)`
  (→ `null` si illisible), `lireRecetteWeb({ url, session }, { fetch, signal, tentativeMs })` (ne lève jamais), `fabriquerImportWeb({ id, signet,
  deviceId })` (`deviceId` requis : `TypeError` s'il est oublié, `null` explicite admis), `versionHumaine(versions)` (= `some(versionEcrite)`, R-B-19),
  `fabriquerLectureWeb(recette, { signet, versions, page, sourceKind, importId, modele, maintenant, remplacer })` → `{ recipe, version, remplacement }` ;
  `LIMITES_PAGE`, `TITRE_FICHE_MAX` (300).
- `src/domain/import-cible.js` : `KINDS_IMPORT = ['recette', 'index', 'web']` (sortes LISTÉES) ; `KINDS_PAGES = ['recette', 'index']` (sortes à pages, lue
  par `repo.js`) ; `importOuvert` (une définition, R-B-18) ; `versionEcrite(v)` (R-B-19) ; `cleLecture`, `modeleBorne` ; `cibleReprise` web →
  `/recipes/<id>/importer?import=<imp>` (R-B-20) ; `RAISONS_ECHEC` + `interdit`, `inaccessible`, `pas_une_page`, `page_trop_lourde`, `page_vide`, `lien`.
- `src/core/lien.js` : `adresseNormalisee(href)` → `string | null`, `doublonDAdresse(recipes, href)`, `ADRESSE_MAX` (2 048 = `LIMITES_SIGNET.adresse`) ;
  `src/domain/recherche-web.js` : `reperesDe(lien)` → `{ presentation, temps_min, difficulte, ingredients } | null` ; `src/ui/signet.js` : `signetModel({
  …, doublon })`, `fabriquerSignet(m, { newId, langue, reperes })`, `enregistrerSignet(etat, { repo, langue, existantes })` (lève `signet_doublon`) ;
  `src/ui/search.js` : `garderEtLire(lien, { ctx, ...deps })` (délègue à `demarrerLectureWeb` : une seule porte) ; `src/ui/recipe.js` : `blocSignet(recipe,
  ctx, { lire, connecter, moi })`, `basculerSessionSignet(racine, session, enLigne)`, `renderRecipe(…, deps)` (`repo`, `navigate`, `toast`, `fetch`,
  `maintenant`, `enLigne`) ; `src/ui/components.js` : `ligneReperes(lien)`.

**Textes d'écran** (tous par `t()`, une entrée `en.js` chacun ; aucun ne nomme le fournisseur ni la base) :
- Fiche d'un lien : « Lire la recette avec l’assistant », « L’app n’a pas encore lu la page. », « Une lecture = un appel à l’assistant, compté dans ton
  quota du jour. », « Lecture de la page en cours… » + « Voir », « Lecture reçue : vérifie-la et enregistre. » + « Vérifier et enregistrer », « Contenu
  non récupéré : ouvre la page. » + « Ouvrir le lien » + « Réessayer », « Lors de la recherche, l’assistant disait : {p} », « Estimé par l’assistant :
  {r} » (existant) ; après lecture : « Lue sur {h} le {d} · {m} — vérifie. » (« Lue sur {h} · {m} — vérifie. » sans date lisible), {m} = « données de la
  page » ou « texte lu par l’assistant », « Selon la page : {s} », « Relire la page avec l’assistant ».
- Onglet Web : « Garder et lire » ; « Tu as déjà gardé cette adresse. » + « Ouvrir la fiche » (aussi au formulaire du signet).
- Écran : « Lire une recette web », « Fiche recette », « Lecture de la page par l’assistant… » puis « Annuler », « En cours sur un autre écran », « Lue
  sur {hote} — vérifie avant d’enregistrer. », « Selon la page : {s} » ou « Lue le {d} », « Lue dans les données de la page : aucun jeton dépensé. » ou
  « Texte de la page lu par l’assistant. », « La page était longue : la fin n’a pas été lue. », « D’autres recettes étaient sur cette page : ouvre-la. »,
  « Titre lu : {t} — ce sera le titre de la fiche. » ou « Titre lu : {t} », « préparation {p} min », « cuisson {c} min », « total {m} min », « Notes »,
  « Enregistrer », « Relire la page », « Ignorer », « Toutes les lignes restent à vérifier : « Corriger » sur la fiche. », « La lecture remplacera la
  version lue par l’assistant. » ou « Ta version écrite à la main n’est jamais remplacée sans question. », « Recette enregistrée » ; dialogue « Remplacer
  par cette lecture ? » : « Ajouter sans remplacer » (première, présélectionnée) puis « Remplacer ».
- Échecs (§ 4.4, `texteEchecLecture`) : « Cette adresse ne peut pas être lue par l’assistant : seule une page publique en https est admise. Ouvre-la
  toi-même. », « La page n’a pas pu être téléchargée (site injoignable, trop lent, ou qui refuse les robots). Ouvre-la toi-même. », « Cette adresse
  n’est pas une page web (PDF, image…) : l’assistant ne la lit pas. », « Cette page est trop lourde pour être lue. », « Aucun texte lisible sur cette page.
  Ouvre-la toi-même. », « La lecture a été coupée : la page est trop longue pour l’assistant. », « L’assistant n’a pas répondu lisiblement. Réessaie. »
  + « Code : … », « La recette de cette page dépasse ce que l’app peut lire (plus de 80 ingrédients ou 60 étapes, ou une ligne trop longue). Ouvre la
  page. » (JSON-LD), « Aucun ingrédient ni étape lus sur cette page. », « Le titre lu contenait une adresse web : lecture refusée. Ouvre la page. » ;
  `annule`, `interrompu`, `incertain` : les phrases I-4 du lot A (R-B-9) ; `transition` : « Une lecture est déjà en cours : annule-la d’abord. » (lot A,
  R-B-25) ; les raisons de la passerelle gardent `texteRefusAssistant` et `texteEchecAssistant`.
- Écrits DANS la lecture (par `t()`, donc dans la langue de l'interface au moment de lire) : « [adresse retirée] », « adresse retirée dans la ligne {n} »,
  « adresse retirée dans l’étape {n} », « adresse retirée dans les notes ». Section « Imports » : « Lien web · {h} », « Réessayer ».
- Retirés (source et `en.js`) : « L’app n’a pas lu la page : ouvre-la pour cuisiner. » et « Un lien web s’importe au lot suivant. ».

**Les rulings** (détail en spec § 12 ; R-B-17 à R-B-28, rendus par le chef d'orchestre pendant la construction et à la clôture, y sont portés par la
clôture ; les décisions des rondes sont dans les rapports de tâche) :
- **Revue de la spec, rév. 1 → 2** (70 constats, trois lentilles, une ligne chacun au § 12) : besoin B-1 à B-31 (`Recipe` lisible, titre lu, création
  conditionnée, `recipeYield` tableau, `totalTime`, `texte_coupe`, `vol.js`, signet `http:` sans bouton… ; B-22 refusé : les repères ne passent pas par
  « Garder ce lien ») ; sécurité S-1 à S-20 (Cc / Cf retirés côté client champ par champ, hôte recalculé d'abord puis « Selon la page », balayages
  linéaires et borne temporelle, S17-S18, `Object.assign` et `for…in` interdits, TLS dit, hôte de `SUPABASE_URL` refusé, critère de remplacement élargi —
  amendé depuis par R-B-19 —, listes à la borne + 1) ; faisabilité F-1 à F-19 (`lecture-web.js` feuille, `OUTILS_0004` figé, `remplacer: false`,
  `texteEchecLecture` en `switch`, `constraints` et `changes`).
- **R-B-1** port et identifiants refusés (défaut gardé) · **R-B-2** une adresse dans une étape, une ligne ou les notes est RETIRÉE et dite ; seul un
  titre à adresse refuse (`lien`) · **R-B-3** titre lu à la première lecture · **R-B-4** pas de second bouton « Garder et lire » au formulaire · **R-B-5**
  libellé « Lire la recette avec l’assistant » · **N-1** le test d'ordre des gardes épingle les points d'appel du flux, jamais les déclarations.
- **R-B-6** (= R-F-1) `0006` à cinq valeurs, `image-web` pour F ; `OUTILS` à quatre ; test croisé `OUTILS_0006` · **R-B-7** branche `recette-web`,
  worktree, 8089, base = la tête finale d'A · **R-B-8** une ligne web d'un autre appareil relancée ici prend le `device_id` d'ici · **R-B-9**
  `incertain` dit la phrase du lot A · **R-B-10** `marquerIllisible` gardé par `cleLecture` · **R-B-11** second `catch` de `telechargerPage`
  (survivant nommé à la rév. 4 ; tué par t5 depuis `8df4f15`, R-B-28) · **R-B-12** « Ajouter sans remplacer » d'abord · **R-B-13** emplacements réels
  (filets i18n dans `tests/ajouter.js`, `IMPORTS_OUVERTS` et `KINDS_PAGES` dans le domaine, marqueur de 17 points de code, docs à la clôture) ·
  **R-B-14** S17 au redéploiement, sans dépense Anthropic · **R-B-15** tests sensibles au temps acceptés, rejoués avant d'être un constat · **R-B-16**
  rejeu par la voie (a) sur la tête finale d'A.
- **P-1 à P-13** (plan rév. 2, dits par la spec rév. 4) : `IMPORTS_OUVERTS` du domaine et `KINDS_PAGES` ; filets i18n de `tests/ajouter.js` ; marqueur
  de 17 ; t4 `location: 'https://'` ; P-5 = R-B-8 ; « sorte réservée » → `couverture` ; placement des tests ; « 0007 » au générateur ; « Fiche recette »
  dans `en.js` ; ordre des règles de `lignesImports` ; P-11 = R-B-9 ; `cleLecture` dans le domaine et gestes liés à la lecture affichée ; `texteRefus`
  dit `interdit`.
- **R-B-17** (rejeu) le battement vit dans la ligne interne `battement:<id>` (`repo.battre`), jamais dans `imports` · **R-B-18** une définition
  d'« ouvert », `importOuvert` (aucun `!IMPORTS_TERMINES` neuf ; la substitution de sorte de T4 et T5 a disparu en T6) · **R-B-19** `versionHumaine`
  = VF-7 du lot A (`versionEcrite`) : une adaptation, une traduction ou une version `ai` n'appellent pas la question · **R-B-20** `cibleReprise` web
  porte `?import=` ; l'écran prend la ligne affichée, `?import=`, une lecture reçue, puis celle de cet appareil · **R-B-21** constat « SSRF » de la
  revue de sécurité automatique (`aec3d26`) RATIFIÉ comme résidu assumé : D-B1 et S-12 tiennent, rebinding DNS nommé ; coût si faux : un hôte public
  résolvant vers une adresse interne ne serait lu qu'avec un certificat valide pour cet hôte, que ce service n'a pas.
- **R-B-22** `portionsDe` : nombre nu, intervalle (`4-6`, `4 à 6` → 4) ou nombre + mot de portion (`portion(s)`, `personne(s)`, `part(s)`,
  `serving(s)`, `serves`, `pour`, `makes`, `yield(s)`), sinon `null` (`'750 ml'`, `'2 litres'`, `'9x13 pan'` → `null`) ; § 6.2 amendé · **R-B-22 bis**
  (ratifié après `51bad50`) borne 1..9 999 aussi pour un nombre JSON ; `nettoyerChaineJsonLd` puis NFC avant la grammaire (`4&nbsp;portions` → 4) ;
  mot de portion admis avant ou après ; intervalle inversé → borne basse (`6-4` → 4) ; borne nulle → `null` ; `00012 portions` → 12 ; rendent `null`,
  coût assumé : `Yield: 4`, `Serves 4 people`, `6 pers.`, `Pour 4 personnes.`, `4 to 6`, `4.0`, `12 cookies`, `1 loaf` ; sonde S19 au redéploiement ·
  **R-B-23** `hotesRefuses()` refuse aussi l'alias `<ref>.functions.supabase.co` (t4 bis) · **R-B-24** chaîne des versions ratifiée (`-1` à `-8` ;
  T3-R1 et T4-R1 ont touché `src/` sans +1, selon le brief de l'époque) ; règle pour G à F : TOUT commit qui touche `src/` ou `sw.js` incrémente
  `VERSION`, ronde comprise · **R-B-25** refus ratifiés sans code (forme de `traiter` gardée ; `autres_recettes` sans plafond ; `total_minutes` nul
  hors JSON-LD ; deux `propre` distincts ; refus `transition` dit par « Une lecture est déjà en cours… » ; AUCUNE phrase de quota sous « Garder et
  lire », I-B3 amendé ; `ligneOuverte` d'A intacte ; `etatRouteWeb().status` = statut de la base ; ligne sans `recipe_id` : « Ignorer » seul ;
  « annuler web par `annulerVol` » équivalent) · **R-B-26** écarts de construction ratifiés, le code fait foi (`neutraliser` par regex ; blancs de
  contrôle et CR ; deux niveaux de sections ; règle d'ouverture de balise et zones ; `href` ≤ 2 048 et sous-domaines refusés ; `deviceId` requis ;
  provenance `lu_le` + `uncertain_fields` ; `lue_le` en ISO UTC ; lookbehinds ; requête filtrée telle quelle ; `versionEcrite` exportée ; « Relire »
  en UNE transaction ; refus `transition` ; texte « Lue sur {h} · {m} — vérifie. » ; `modeleBorne` dans le domaine ; `charger()` saute une ligne que
  CE document relance ; table `volDe` ; `<bdi>` ; `ajouterPages` refuse une lecture web ; veille VF-15 ; `ADRESSE_MAX` ; `relireResultat` à la
  bannière ; `auMot` ; `r.redirected` → 422 ; garde `INDEX_TS`) · **R-B-27** dettes nommées (ci-dessous) · **R-B-28** docs de la spec : R-B-11 n'est
  plus un survivant ; § 7.5 : tous les mutants nommés (spec et plan : C1 à C24, B1 à B8, T6a à T6j) rouges, deux équivalents déclarés, aucun survivant
  (le compte « 65 nommés, 65 rouges » de `7df269e` est retiré par `76d88dd`) ; « 200 000 `<script>` » → « environ 58 000 » ; « G génère 0007 » → « le
  prochain lot qui ajoute un magasin génère `0007` et fige `0005` d'abord ».
- **Rondes de construction** (une par tâche ; détail dans les rapports du registre) : T1-R1 (22 constats regroupés, dont trois Critical : `HowToSection`
  en objets qui levait `RangeError`, `neutraliser` contourné par cinq chevrons, blancs de contrôle retirés) ; T2-R1 (5 Important : page entière dans t3,
  D-B26 pendant la lecture du corps, 303 et 308, preuve en blocs `exception`, README des sondes) ; T3-R1 (42 constats : relecture idempotente,
  `MOTIF_ADRESSE` quadratique, provenance `uncertain_fields`) ; T4-R1 (33 : une porte pour « Garder et lire », « ouvert » par `importOuvert`, « Relire »
  en une transaction, lancement sans rejet) ; T5-R1 (28 : relecture après le dialogue, abonnement après montage, provenance et repères revalidés au
  rendu) ; T6-R1 (19 : ligne sans `recipe_id`, `ajouterPages`, `<bdi>`). Revue finale de branche : 4 Important (veille VF-15 de l'écran web,
  `adresseNormalisee` quadratique, avertissements de l'aperçu et bannière du lot A non éprouvés), tous fermés par la vague ; 10 Minor (8 fermés par la vague,
  compte de son rapport ; `portionsDe` refusé par la vague puis tranché par R-B-22 à la ronde finale 2 ; deux de documentation, R-B-11 « survivant »
  et les chiffres de `cloture.md`, laissés à la clôture et fermés par `7df269e` et `cloture.md`).

**Tests.** `tests/lecture-web.js` (neuf, `runLectureWebTests({ eq, ok })`, câblé dans `tests/tests.js` après `runImportCibleTests`) : blocs « lien »,
« page », « lecture », « appel », « fabricants » (vocabulaire `source_kind` compris), « vol partagé », « démarrer, lancer, annuler », « écran et
fiche » (ouverture, aperçu, Enregistrer, relecture, version humaine, Annuler / Réessayer / Relire / Ignorer, veille, hors ligne, deux onglets, raison
→ texte, R-B-20, fiche) ; `tests/import-cible.js` (`lignesImports` web, `cibleReprise`, P-1, P-6, R-B-8, démarrage) ; `tests/recherche-web.js` (carte
à deux rangées, « Garder et lire ») ; `tests/ajouter.js` (signet, doublon, filets i18n `MODULES_NEUFS` / `CHAINES_NEUVES_AILLEURS`, `SHELL`) ;
`tests/passerelle.js` (raisons web, `RAISONS_ECHEC`). Node : `tools/assistant-lecture-web.test.mjs` (18 tests : 14 jusqu'à la vague, plus 4
`portionsDe` de la ronde finale 2, R-B-22 ; dont « borne temporelle » ; `LECTURE_WEB_JS` n'admet qu'un chemin absolu hors du dépôt et l'imprime),
`tools/assistant-logique.test.mjs`, `tools/assistant-index.test.mjs` (`INDEX_TS` gardé de même depuis la vague), `tools/generer-migrations.test.mjs`
(`0006`, preuve, README, RESULTATS, générateur, bloc `index.ts` et ordre du flux), `tools/lien.test.mjs` (neuf : la durée d'`adresseNormalisee` et du
doublon sur 100 000 barres, que Chrome ne peut pas voir). Tests de source : `borner(` des sept champs de `lirePage`, `assertVocabulaire(` (exactement
quatre dans `src/domain/lecture-web.js`), `Anthropic|Supabase` absent d'`import-web.js`, de `vol.js` et de `src/domain/lecture-web.js`, aucune
`const TEXTES_` dans `import-web.js`, sens unique (`import-web.js` et `vol.js` n'importent pas `import-cible.js`), « L’app n’a pas lu la page » et
« lot suivant » absents ; tout le reste par comportement. **Mutants** : tous ceux que nomment la spec § 7.5 et le plan (C1 à C24, B1 à B8, T6a à T6j)
sont rouges, aucun survivant (R-B-28 : R-B-11 tué par t5 ; la spec ne donne plus de nombre ; le plan en comptait 65 — § 7.5 en entier, ceux de § 7.1,
des tâches, du pré-vol et de la rév. 3 —, 64 rouges et R-B-11 survivant à la rév. 3) ; au total, 338 passages relevés dans les rapports du registre
hors ronde finale 2 — T1 11 puis 67 (ronde 1, passage final, les 11 compris), T2 13 puis 38, T3 13 puis 48, T4 14 puis 30, T5 21 puis 43, T6 18 puis
12, vague finale 21 (17 navigateur, 4 Node) —, 352 avec les 14 de la ronde finale 2 (14 sur 14 rouges, `ronde-finale-2-report.md`), tous rouges sauf
trois ÉQUIVALENTS nommés dans les rapports (R18b, la garde `id` d'`ouvertDe`, T4 ; M30r, la route du signet qui passe `existantes: []`, T4-R1 ;
« Annuler » web par `annulerVol`, T6 et T6-R1, R-B-25) — la spec (§ 7.5, R-B-28) n'en déclare que deux, M30r et `annulerVol` : R18b, déclaré
équivalent au rapport de la tâche 4 (l. 113), y manque — ; survivants d'un temps, tués ensuite : R-B-11 (T2, tué en T2-R1), R18f (T5, dit équivalent à
tort, tué en T5-R1), « titre non borné » (T4-R1). Tous sur des COPIES (servies à part, ou modules désignés par `LECTURE_WEB_JS` / `INDEX_TS`), jamais
en place.

**Ce qui n'est PAS prouvé.**
- **`0006` et sa preuve** : jamais jouées sur `mitsu` (syntaxe seulement, pglast) ; le nom `assistant_journal_outil_check` (celui que PostgreSQL donne à un
  `check` de colonne en ligne) n'est pas relu sur `mitsu` : un autre nom fait échouer le collage proprement, et la garde 0 de la preuve le nomme.
- **Le chemin `lecture-web` sous le vrai runtime** : la fonction n'est pas redéployée ; S13-S19 n'ont jamais été jouées. Que `redirect: 'manual'` rende
  un 3xx lisible (et non opaque) sous Supabase Edge, que `credentials: 'omit'` soit accepté par Deno, que `r.redirected` reste faux sur une réponse non
  suivie : S17 le dira. Que TLS arrête un hôte public qui résout vers une adresse interne, et que les isolats n'aient pas de réseau privé : non mesuré
  (R-B-21 ; rebinding DNS assumé).
- **Aucune lecture réelle** : ni le JSON-LD d'un vrai site (formes réelles de `recipeInstructions`, `recipeYield`, `author`), ni une lecture par le modèle
  (durée, jetons, coût, fidélité, taux de `coupe`, `illisible`, `hors_bornes`), ni le budget de 120 s (30 s de téléchargement, puis le modèle), ni un
  charset réel, ni les jetons de 40 000 points de code (10 à 15 k estimés).
- **Le 499 à « Annuler »** : prouvé sous Node seulement (t9 ; lot passerelle, F-5).
- **Deux appareils** : « Réessayer » d'une ligne d'un autre appareil, son `device_id` réécrit (R-B-8), la vivacité jugée à 10 min : fixtures seulement ;
  aucune ligne `imports` `web` n'a voyagé.
- **Safari et l'iPhone** : rien (aucun WebKit ici) ; le coût des motifs d'adresse et d'`adresseNormalisee` sous JavaScriptCore n'est pas mesuré (Chrome
  masque un retour arrière quadratique par son moteur linéaire de repli : la durée n'est affirmée que sous Node) ; le `<bdi>` n'a jamais été vu à l'œil.
- Les tests sensibles au temps (500 ms de la borne S-4, 200 ms de la borne des motifs, attentes de 3 s ; R-B-15) : un faux rouge est possible sur une
  machine chargée, jamais un faux vert.

**Dettes (assumées, une ligne chacune ; R-B-27, spec § 11 et § 13).**
- **Identité du vol** : les écritures de fin de vol et l'effacement du battement en `finally` (`oublierBattement`) ne vérifient ni `document_id_vol` ni
  `started_at`, dans les DEUX machines, A et B (PWA suspendue plus de 10 min, « Réessayer » sur un autre appareil, puis réveil).
- **Deux machines de vol** : `lancerLecture` recopie celle de `volUnique` du lot A, `annulerLecture` celle d'`annulerVol` (d'où le mutant équivalent) ;
  une correction d'un côté se reporte à la main de l'autre ; remède : une fin de vol commune dans `vol.js`.
- **Pureté du domaine** : `lienSignet` tire `src/core/lien.js`, et par lui des modules de domaine ; à déplacer dans un module feuille.
- **Fenêtre sans dialogue** entre la dernière relecture et la transaction d'`enregistrerLecture` (comme `decider()` du lot A) : `db.mutate` ne
  conditionne qu'un statut et une fiche n'en a pas (S-13) ; un titre, des cuisines ou un favori changés dans cette fenêtre seraient écrasés.
- La fiche n'écoute pas `online` / `offline` (le bouton peut rester allumé ; la tape le dit et n'écrit rien) ; `blocSignet` garde « Lecture de la page en
  cours… » tant que « Voir » n'a pas ouvert l'écran (qui lève la ligne) ou que la section « Imports » ne l'a pas fait.
- `r.redirected` sans comparaison de `r.url` (non mesurée sous le runtime : une normalisation d'URL donnerait de faux refus ; S17 le dira).
- **Décodage** : les références numériques 0x80 à 0x9F sont retirées comme Cc (« l&#146;huile » donne « lhuile », fréquent sur de vieux sites
  francophones) ; U+0085, U+2028, U+2029 retirés peuvent coller deux mots (S-10 à la lettre) ; `<!-->` avale jusqu'au `-->` suivant ; un `<` suivi d'une
  lettre dans une chaîne JSON-LD ouvre une balise jusqu'au `>` suivant (comme un navigateur).
- **Coûts et gardes de test** : la règle d'ouverture de balise fait passer la page de 2 Mio de `<` de 20-80 ms à 65-150 ms (linéaire, sous 500 ms,
  R-B-15) ; le DoS de regex est invisible dans Chrome et mesuré sous Node seulement, rien dans Safari ; `LECTURE_WEB_JS` et `INDEX_TS` ne refusent qu'un
  chemin du dépôt (« hors du scratchpad » n'est pas codable : son chemin change à chaque session).
- **Notification croisée** : l'écran photo ne se redessine pas à la pose ni à la fin d'un vol web, ni l'écran web pour un vol photo (`ecouterVol` non
  fait) ; le bouton s'éteint ou se rallume au redessin suivant, sans rien écrire de faux.
- **I-2 aveugle à la sorte** (passation du lot A) : le mur de création reste par statut, toutes sortes confondues ; B le rend sûr par la route (une fiche
  à `source_url` passe toujours par la variante web ; une ligne web ne naît que sur un signet) et par le refus nommé `transition` ; `ajouterPhotos` du
  lot A avale toujours une `TransitionRefusee` (atteignable seulement par une donnée reçue).
- **Données dans la langue de l'interface** : « [adresse retirée] », les entrées « adresse retirée dans … » et « La page était longue… » sont écrites dans
  la lecture par `t()` ; après un changement de langue, une relecture peut ajouter la phrase de coupe une seconde fois (plafond de 40 respecté).
- **Doublon d'adresse** lu dans l'instantané `ctx.recipes`, pas en transaction : deux « Garder et lire » de la même adresse depuis deux onglets font
  deux signets (un avertissement, pas un mur, D-B7) ; `URLSearchParams` n'est plus en jeu (requête filtrée telle quelle).
- **Spec § 11** : un JSON-LD peut mentir (dit « données de la page », hôte réel d'abord, tout « à vérifier ») ; pages rendues par JavaScript ou à
  consentement → `page_vide` ou une lecture à côté ; la coupe à 40 000 est dite, pas réparée ; bornes de recette en deux copies littérales
  (`LIMITES_LECTURE` serveur, `BORNES_EXTRACTION` client, chacune épinglée par sa suite) ; `MOTIF_ADRESSE` sur le contenu : faux positif (une étape perd
  un lien cité), faux négatif sur un hôte nu ; un HTML très mal formé est lu de travers (le modèle reçoit du bruit).
- **Spec § 13** (sept points) : deux ouverts, défaut appliqué, (1) `OUTILS_0006.slice(0, 4)` contre `slice(0, OUTILS.length)` de la spec F (la phrase
  I-F9 est à corriger chez F, ou B ne fige que le préfixe) ; (2) trois phrases propres au web (`coupe`, `vide`, `hors_bornes` d'un JSON-LD) gardées à
  côté de celles du lot A dans la section « Imports » ; les points 3 à 7 sont les dettes R-B-27 ci-dessus (identité du vol, deux machines de vol,
  pureté de `lienSignet`, fenêtre sans dialogue, `blocSignet` « Lecture de la page en cours… »).
- Hors périmètre (§ 8) : image du plat et `og:image` (F) ; `recipeCuisine`, `keywords`, `nutrition` ; plusieurs recettes d'une page ; épinglage d'IP ;
  `deno-dom` ; repères portés par « Garder ce lien » (B-22) ; exports sans `source_author` ; `web_reperes.presentation` non indexée ; quota visible dans
  l'app.

**Ce que les lots suivants attendent de B** (chaîne **A → B → G → C → D → E → F**, branches empilées, fusions dans l'ordre ; versions de chaîne : G
`0.11.0`, C `0.12.0`, D `0.13.0`, E `0.14.0`, F `0.15.0`) :
- **Tous** : LE vol du document est `src/ui/vol.js` (un écran neuf qui appelle l'assistant prend `prendreVol` / `libererVol`, jamais une variable à
  lui ; un vol tenu refuse tout autre appel du document) ; une sorte neuve s'ajoute à `KINDS_IMPORT` (sortes listées), à `cibleReprise` (avec
  `?import=`, R-B-20) et à `lignesImports`, et à `KINDS_PAGES` seulement si elle a des pages (`repo.ouvrirImport` et `repo.ajouterPages` la refusent
  sinon) ; « ouvert » = `importOuvert` (R-B-18), « version écrite » = `versionEcrite` (R-B-19), battement = ligne interne (R-B-17) ; R-B-24 : à partir
  de G, tout commit qui touche `src/` ou `sw.js` incrémente `VERSION`, ronde comprise (B ne l'a pas suivie partout : T3-R1 et T4-R1 ont touché `src/`
  sans +1, selon le brief de l'époque), et la ligne d'épingle, `tests/tests.js:225` (`eq(results.length, 3996, …)` à la tête de B), se réécrit
  à la main à la valeur mesurée ; un résultat du journal se revalide à la relecture (`relireResultat` pour le web).
- **G** (`0.11.0`, worktree sur la tête finale de B) : la spec G rév. 4 n'a AUCUNE migration ; le prochain lot qui ajoute un magasin synchronisé génère
  `0007` (le générateur le dit à ses deux mentions) et fige `0005` d'abord (`SYNC_STORES_0005` + empreinte épinglée, `tools/generer-migrations.mjs`
  l. 319-324) ; sinon son magasin entrerait dans `0005`, déjà collée.
- **C, D** (`0.12.0`, `0.13.0`) : le vol partagé ; `KINDS_PAGES` (D l'emploie pour le classement, R-D-11).
- **E** (`0.14.0`) : la sorte `couverture` reste réservée (l'assertion « sorte réservée » du lot A la vise désormais, P-6).
- **F** (`0.15.0`) : `image-web` est admise par la contrainte de `0006` dès ce lot (F n'écrit AUCUNE migration) ; `OUTILS` vaut aujourd'hui
  `OUTILS_0006.slice(0, 4)` : F ajoute `image-web` à `OUTILS` et le test passe à l'égalité (`OUTILS` = `OUTILS_0006`) ; § 13, point 1 : la phrase I-F9 de
  la spec F (« passe sans amendement ») est à corriger ; le champ `image` du JSON-LD est ignoré par B (F le prendra), comme `og:image`.
- **Le lot qui touchera au vol** : la garde d'identité du vol (R-B-27) pour les DEUX machines, et la factorisation `lancerLecture` / `volUnique`,
  `annulerLecture` / `annulerVol` dans `vol.js`.

**Gestes de Neegan, dans cet ordre.**
0. **Le lot A d'abord** (B est empilé sur A) : ses gestes 1 et 2 (section « Importer une recette repérée ») — `0005` collée et prouvée (`999 BILAN` :
   `0 faux sur 35`), adresse de preuve retirée, puis `! git -C ~/projects/mistu merge --ff-only import-cible` et `! git -C ~/projects/mistu push origin
   main`.
1. **`0006` AVANT le redéploiement et AVANT tout `push` du lot B** (`supabase/README.md`, étape 12) : dans l'éditeur SQL de `mitsu`, coller
   `supabase/migrations/0006_lecture_web.sql` **entière** (attendu `Success. No rows returned` ; si la contrainte porte un autre nom, rien n'est appliqué et
   la garde 0 de la preuve le dit) ; puis, **collée seule**, `notify pgrst, 'reload schema';` (le README la dit facultative : aucune table ni fonction
   neuve) ; puis `supabase/proofs/0006_lecture_web.sql` (rien à remplacer, aucune adresse ; « Run without RLS ») : lire la ligne `999 BILAN` (attendu
   `0 faux sur 10`, dont 1.01 « les cinq outils, dans l'ordre d'`OUTILS_0006` » et 2.031, « 2.03 bis » : `image-web` accepté par `assistant_reserver`
   après recompte) et coller le tableau tel quel dans `supabase/proofs/RESULTATS-mitsu.md`, section « Preuve `0006_lecture_web.sql` — à jouer » ;
   relever `shasum -a 256 supabase/migrations/0006_lecture_web.sql` (attendu `b2d4cf59…`). Sans dépense.
2. **Contrôleur, après le geste 1** : redéploiement `~/.local/bin/supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb
   --no-verify-jwt --use-api` depuis le worktree (la version suivante : `index.ts` et `lecture-web.js` ont changé depuis la version 3, en dernier dans
   `ebbcf10` et `51bad50` ; version et `ezbr_sha256` consignés) ; sondes sans dépense S13-S16 (`http://` → 422 `interdit` sans réservation,
   `https://127.0.0.1/` et `https://localhost/` → 422, sans jeton → 401), **S19** (R-B-23, R-B-22 bis :
   `https://ybdooerfeziiabsbfxtb.functions.supabase.co/` → 422 `interdit`, sans réservation ni dépense ; ni le README, étape 12, ni la table « Sondes
   `lecture-web` » de `RESULTATS-mitsu.md` n'ont encore sa ligne : l'y ajouter) et S1-S9 du lot 4, identiques. **2 bis — S17 et S18, au même
   redéploiement (R-B-14)**, un appel du quota chacune, sans dépense Anthropic : **S17, la sonde de redirection** (une adresse `https` en 301 ou 302
   vers une page à JSON-LD `Recipe` complet, vérifiée d'abord sans la fonction par `curl -sI -A 'Mitsu/0.10 (+https://neegans.github.io/mistu/)'`,
   puis `curl -s` sur la cible ; attendu 200 `jsonld`, `usage` 0 / 0, `page.url_finale` ≠ l'adresse envoyée, journal 200 à 0 / 0 — ou un refus propre
   et nommé ; une redirection opaque, 502 `inaccessible` sur une chaîne que `curl` suit, impose une ronde sur `telechargerPage` AVANT la fusion) ;
   S18, une adresse `https` qui redirige vers `http://` → 422 `interdit` (« non mesurée, couverte par t4 seulement » si aucun hôte public ne le fait).
   Session lue par `read -rs JETON`, jamais dans une commande. Résultats : section « Sondes `lecture-web` » de `RESULTATS-mitsu.md`.
3. Après `/verify` : `! git -C ~/projects/mistu merge --ff-only recette-web` (après le geste 0, `main` est la tête finale d'A, `2b6a2fd` : avance rapide),
   puis `! git -C ~/projects/mistu push origin main`. Ouvrir `https://neegans.github.io/mistu/tests/` et lire le BILAN (attendu : `3997/3997`,
   total épinglé `3996`, plus le 404 de `/favicon.ico`) ; service worker `cuisine-os-v0.10.0-8`.
4. **Première lecture réelle, JSON-LD** (un appel du quota, zéro jeton) : site public, connecté (Mac, onglet Réseau ouvert), onglet Web, « puttanesca »,
   « Garder et lire » sur une page d'un grand site de recettes québécois (ou « Lire la recette avec l’assistant » sur un lien déjà gardé) → **un** POST
   `/functions/v1/assistant` ; l'écran dit « Lue sur {hote} — vérifie avant d’enregistrer. » et « Lue dans les données de la page : aucun jeton
   dépensé. » ; « Enregistrer » ; la fiche porte le titre lu (pas l'hôte nu), « Selon la page : … » et « Ouvrir le lien » ; dans l'éditeur SQL,
   `select outil, statut, jetons_entree, jetons_sortie, duree_ms from public.assistant_journal order by id desc limit 3;` → une ligne `lecture-web`, 200,
   0, 0, puis `select jour, appels from public.assistant_usage_jour;`. Noter la durée.
5. **Deuxième lecture, par le modèle** (un appel et des jetons) : une page sans JSON-LD → « Texte de la page lu par l’assistant. » ; noter la durée, les
   jetons de la ligne du journal, le coût (console Anthropic), la fidélité des ingrédients et des étapes ; si « La page était longue… » s'affiche, noter si
   la recette a été lue entière.
6. **Trois refus dits** : un PDF → « Cette adresse n’est pas une page web… » ; `https://exemple.invalid/` → « La page n’a pas pu être téléchargée… », le
   signet reste un lien avec « Ouvrir le lien » ; le même lien gardé deux fois → « Tu as déjà gardé cette adresse. ».
7. **« Annuler »** pendant une lecture par le modèle → `assistant_journal.statut` 499 sur sa ligne (la mesure due depuis le lot 4).
8. **iPhone** : le parcours 4 depuis l'app installée (aucun WebKit ici).
9. « clean » **en dernier** : copier le registre `.superpowers/sdd/2026-10-19-recette-web/` (hors git) dans `~/projects/mistu/.superpowers/sdd/` (`diff
   -rq` muet), puis `git worktree remove` de `mistu-recette-web`.

**Versions.** `APP_VERSION = '0.10.0'` (était 0.9.0 ; pins relevés dans `tests/ajouter.js`, `tests/sync-l3.js`, `tests/recherche-web.js`,
`tests/assistant-compte.js`, `tests/creer-ia.js`, `tests/passerelle.js`), `DB_VERSION = 4` (inchangée : les champs neufs de `recipes` sont du JSON
sans index), `sw.js VERSION = 'cuisine-os-v0.10.0-8'` (chaîne R-B-24 : `-1` à T3, T3-R1 sans +1, `-2` à T4, T4-R1 sans +1 — deux rondes qui touchent `src/` sans
incrément, selon le brief de l'époque, avant la règle R-B-24 —, `-3` à T5, `-4` à T5-R1, `-5` à T6, `-6` à T6-R1, `-7` à la vague finale, `-8` à la
ronde finale 2 ; T1 et T2 ne touchent pas la coquille), `SHELL` + `./src/domain/lecture-web.js`, `./src/ui/import-web.js`, `./src/ui/vol.js`. CSP
inchangée (le client ne télécharge aucune page : la fonction le fait). La migration `0006` est côté serveur, écrite à la main (hors `NOMS` du
générateur et de `--check`, comme `0004`) ; `0001` à `0005` inchangées.

**Bilan (ronde finale 2, `51bad50`, 20 octobre 2026, 05 h 30).** Suite complète **`3997/3997`** (total épinglé **3996** dans
`tests/tests.js`, règle N−1 ; départ du lot sur `e411779` : 3694/3694, épinglé 3693 ; T1 et T2 3694, T3 3761 puis 3785, T4 3843 puis 3857, T5 3915
puis 3942, T6 3979 puis 3987, vague finale 3997, épinglé 3996), une seule erreur de console : le 404 de `/favicon.ico` (préexistant ; URL lue par une
sonde) ; `node --test tools/*.test.mjs` **172/172** sur `51bad50` (registre `verify-51bad50.txt` ; 39 index + 18 lecture-web + 26 logique + 80
générateur + 2 lien + 7 vendor ; 125 au départ, 144 après T1, 164 après T2, 167 à la vague, 5 de plus à la ronde finale 2 : quatre `portionsDe`,
R-B-22, et t4 bis, R-B-23) ; `node tools/generer-migrations.mjs --check` : **0** ; `tsc` 5.6.3 `--strict` : **0** ; pglast v8.6 : `0006` = 4
instructions, preuve = 12 instructions + 2 blocs `do`, aucune erreur ; empreintes `0006` `b2d4cf59…` (10 lignes), preuve `665968ad…` (114 lignes) ;
aucun caractère invisible ni insécable (Python `-I`) ni aucune clé (motifs Anthropic, JWT, Supabase, Google) dans les fichiers touchés, à chaque tâche
et ronde. Méthode : test rouge d'abord à chaque tâche et ronde (rouge lu, souvent rejoué sur une copie de l'ancien code), puis vert ; mutants sur
copies, jamais en place.

**Fusion.** Le lot A fusionné et poussé **d'abord** ; `0006` collée et prouvée **avant** le redéploiement et **avant** tout `push` du lot B (un code servi
sans `0006` : chaque lecture web répond 502 `serveur`, la réservation refusant l'outil ; rien d'autre ne change) ; la fonction redéployée et S13-S19
jouées **avant** la fusion (une redirection opaque à S17 = une ronde sur `telechargerPage` d'abord) ; `/verify` par le chef d'orchestre ; le registre
copié **avant** tout `git worktree remove`. Le lot G part de la tête finale de B ; le lot C de la tête finale de G (`1e4d68d`) ; le lot D de la tête
finale de C (`739e706`) ; le lot E de la tête finale de D (`619e6c0`) ; le lot F de la tête finale de E (`5ec092c`) — la chaîne A → F est complète.

### Les photos voyagent entre appareils : octets des fichiers (L4), archive, Storage, moteur, Réglages, écrans (20 octobre 2026, lot G)

**Pour toi.** Les photos de tes pages, tes couvertures et tes photos de plat suivent ton compte : prises sur le Mac, elles s'affichent sur l'iPhone
(et l'inverse), téléchargées à la demande ou toutes d'un coup, en qualité réduite par défaut (l'original reste sur l'appareil qui l'a prise ;
« Originale » est un réglage par appareil). Une page dont les octets manquent le dit et offre « Télécharger » ; un fichier refusé à l'envoi est
nommé par ta page ou ton livre, jamais par une empreinte. L'archive décrit ce qui manque et ne remplace jamais un original par une copie.

**Où.** Branche `photos-entre-appareils`, worktree `~/projects/mistu-photos-entre-appareils`, empilée sur la tête finale du lot B `cf91f09`
(chaîne A → B → G) ; spec `docs/superpowers/specs/2026-10-19-photos-entre-appareils-design.md` (rév. 4, commise `3601a52`, amendée à la clôture :
§ 11, § 12 R-G-7 à R-G-30, § 13) ; plan rejoué par intention `docs/superpowers/plans/2026-10-19-photos-entre-appareils.md` (`c227711`) ; registre
`.superpowers/sdd/2026-10-19-photos-entre-appareils/` (briefs, rapports, `bilan-workflow.md`, `rulings-chef.md`, `vague-finale-chef-report.md`,
`verify-*.txt` ; copie dans `~/projects/mistu/.superpowers/sdd/`). Serveur de vérification `python3 -m http.server 8090 --bind 127.0.0.1`.
**PAS fusionné, PAS poussé. Aucune migration, serveur `assistant` intact, `DB_VERSION` 4.**

**Ce qui marche (prouvé par la suite, 4403/4403 sur `222b3a5`, épingle 4402 ; Node 174/174 ; `--check` 0).**
- **Données `files`.** Une ligne porte un `remote` OBJET (`sha256`, `size`, `mime`, `quality`, `uploaded_at`, `owner`) validé par `remoteValide`
  (`src/sync/tables.js`), projetée au serveur sur `CHAMPS_FILES_SERVEUR` seulement (ni blob, ni `syncable`, ni `created_at`). UNE règle de fusion
  (`fusionnerFichier`, D-G16) pour toute écriture depuis une copie serveur (réception, ajustement, « Garder celle d'ailleurs », tombale), refaite sur
  la ligne RELUE dans la transaction : `conditionFichier` et la condition `{ key, fusion }` de `db.mutate` (R-G-17) — un blob arrivé entre la lecture
  et l'écriture n'est jamais effacé ; une ligne qui a bougé ici depuis n'est pas réécrite. Tombale `files` : le remote passe à `null`, ligne et blob
  restent (D-G15). Passe unique au démarrage : les anciens `remote: true` de L3 sont relus, `cursor:files` retiré.
- **Capture (D-G8).** Une ligne `files` n'entre en file QUE quand ses octets sont confirmés (remote valide de ce compte) ; une suppression locale de
  `files` n'est jamais capturée.
- **Archive (`src/domain/backup.js`).** `missing_files` pour les pages sans octets ici ; une copie est décrite par `bytes_*` (et ne porte JAMAIS la taille
  de l'original, R-G-25) ; l'original local n'est jamais remplacé (R-G-6, `decisionRestauration` prise sur la ligne relue) ; une page de
  `missing_files` garde les octets d'ici, en fusion comme en remplacement (R-G-19) ; `verifyRestored` compare à la décision prise ; `upload_quality`
  ne voyage pas (R-G-27).
- **Passe fichiers (`src/sync/fichiers.js`, `createFichiers`).** Storage injecté (`stockage` ; factice `tests/stockage-factice.js`) ; candidats =
  originaux ici, référencés, synchronisables, sans erreur, sans remote de ce compte (`candidatsEnvoi`) ; octets réduits (JPEG, côté maxi) ou tels quels
  (`octetsAEnvoyer` : originale, PDF/EPUB, image déjà petite, photo trop grande ou illisible) ; remote validé AVANT l'envoi ; « déjà présent » vérifié ;
  filet : des octets tels quels dont l'empreinte n'est pas la clé ne partent pas (R-G-25) ; téléchargement vérifié par les octets relus (retypés
  `remote.mime`) ; espace mesuré ; `LIMITES_FICHIERS` (20 fichiers ou 60 s par passe, 50 Mio) ; erreurs par fichier dans `sync_state`
  `file_error:<sha>` (motif + sens : `type`, `trop_gros`, `forme`, `illisible`, `verification`, …), `pause_fichiers` (seau plein) distincte de la pause L3,
  `renvoi_originale`, `telecharger_tout`.
- **Moteur (`src/sync/moteur.js`).** Phase « fichiers » après la réception, un snapshot par passe, vols tenus par `arreter` ; gestes `telecharger`,
  `telechargerTout`, `reessayerFichier`, `envoyerMaintenant` (tenu, R-G-21) ; recul `reculMs` (`clock.js`).
- **Réglages → Synchronisation (ensemble L4).** « Photos à envoyer », « pages à télécharger », espace mesuré, pause L3 sans palier, qualité d'envoi
  (par appareil, aide qui nomme ce qui part tel quel), fichiers refusés NOMMÉS (`nomFichier` : « Page 12 · Le livre », « Couverture · … »,
  « Photo du plat · … ») avec leur motif en phrase ; une ligne `files` en quarantaine ou en conflit est nommée de même (R-G-24) ; « Effacer les
  données » dit la perte des photos pas encore envoyées (R-G-28).
- **Écrans.** Couverture (`book.js`, `bookCover`), vignettes de pages (`import-cible.js`, `poserImage`), cadre PDF par état (`pdfFrame` : Télécharger,
  Réessayer, phrase de § 4.10), photo du plat (`recipe.js`, `photoDuPlat`), téléchargement sur une tape, phrase de séance abonnée. Affichage F-9 : le type
  du blob dans la liste blanche gagne (`typeAffichage`, `displayUrl`, `src/sync/mime.js`) — une copie JPEG reçue sous une ligne HEIC s'affiche ; une
  ligne hors liste aux octets JPEG aussi (gardes épinglées, R-G-26).

**Ce qui n'est PAS prouvé / dettes.** Rien n'est mesuré dans Safari ni sur l'iPhone ; aucun octet réel n'a été envoyé au bucket de `mitsu` par un
agent (la preuve § 10 « deux appareils » est le geste de Neegan) ; la forme réelle des erreurs du Storage (`statusCode` sous 400) vient de la lecture
du vendor, pas d'une mesure ; la vague finale `c42693f` a été faite inline par le chef d'orchestre, puis RE-REVUE à trois lentilles (correctness et faux-vert propres, sécurité
à corriger → ronde 2 `222b3a5` : R-G-31, R-G-24 bis, R-G-28 bis, avec sa re-revue ciblée ; R-G-30) ; dettes nommées R-G-29 (reprise après erreur passagère de « Télécharger toutes les pages »,
`conflit_renvoyer` sur `files`, `uid` nul sans compte connu, cache HTTP des octets privés, aperçu de la couverture sur le type brut, relecture du
snapshot à chaque rendu, `compterFichesSynchronisees` trop grand, toast transitoire sur deux tapes, trois copies de HASH, `nomFichier` et ses
`Map`) ; P1 survit avec la fixture HEIC (connu) ; G13 / G16 équivalents ; tests sensibles au temps (R-B-15 : un rouge se rejoue avant d'être un constat).

**Gestes de Neegan, dans l'ordre.** 1) Lots A puis B d'abord (leurs sections). 2) (fait le 20 octobre au soir : la vague a été relue à trois lentilles et complétée par la ronde 2 `222b3a5`). 3) `git merge --ff-only photos-entre-appareils`
par `!` (après la fusion de B), `git push`, suite publique `https://neegans.github.io/mistu/tests/` → 4403/4403 (épingle 4402, plus le 404 de
`/favicon.ico`), service worker `cuisine-os-v0.11.0-14`. 4) Preuve réelle § 10 : Mac et iPhone connectés au même compte, une recette avec photo et un
livre avec couverture sur le Mac → sur l'iPhone les images s'affichent (téléchargées), « Télécharger » puis récupération après interruption ;
Réglages → Synchronisation, ensemble L4 (photos à envoyer, pages à télécharger, espace) ; relever la forme réelle du « déjà présent » (geste 7) et le
mur de pixels iPhone (geste 8). 5) Trancher R-G-28 (refuser l'effacement tant que des photos restent à envoyer ?). 6) « clean » (worktrees, serveurs 8088-8094).

**Versions.** `APP_VERSION 0.11.0` ; `sw.js` `cuisine-os-v0.11.0-1` (T1) … `-11` (T6), `-12` (ronde 1 de T6), `-13` (vague finale), `-14` (ronde 2 de la vague) ; `DB_VERSION` 4 inchangée.

**Bilan.** Départ sur `cf91f09` (mesure = B : 3997/3997, épingle 3996, Node 172) ; rejeu du plan par intention (60 blocs sur 61 à l'octet, R-G-7 à
R-G-16) ; six tâches, une ronde chacune, re-revues propres : `84ab222`/`ea24d88` (T1 : données, projection, fusion, capture), `771a598`/`45114e7` (T2 :
archive), `5615211`/`8c3471c` (T3 : passe fichiers), `53bab70`/`63d7a3b` (T4 : moteur), `22b8bd1`/`2f1cd60` (T5 : Réglages), `9a7eaa7`/`bc3d844` (T6 :
écrans) ; revue finale à trois lentilles : 4 Important et 15 Minor ; vague finale `c42693f` (inline, R-G-30), re-revue à trois lentilles puis ronde 2
`222b3a5` (R-G-31 : une copie téléchargée ne prend jamais la taille de l'original ; R-G-24 bis ; R-G-28 bis) ; suite 3997 → 4403, Node 172 → 174.
Mutants : ceux du plan et des revues rejoués sur copies à chaque tâche et à chaque ronde (rapports du registre) ; vague : M1 à M10, 10 rouges sur 10 à
`33578a3` (M1 avait révélé un faux vert de fixture, corrigé ; `vague-finale-chef-report.md`) ; ronde 2 : `vague-ronde-2-report.md`. `/verify` mécanique : `verify-G-bc3d844.txt` (VERT) puis la tête finale. Rulings : R-G-7 à R-G-32 (spec § 12).

### Table des matières sur plusieurs pages : ordre proposé, tableau d'entrées, références liées à leur photo (19-21 octobre 2026, lot C)

**Pour toi.** Tu photographies la table des matières d'un livre (une, quatre ou cinq pages) et tu la lis en UNE fois avec l'assistant (un appel,
compté dans ton quota du jour). Il te rend les entrées photo par photo : l'app te propose l'ordre des photos d'après les numéros de page lus (tu
corriges en deux tapes et tu décides si cet ordre est enregistré ; rien d'autre n'est écrit à ce moment-là), puis un tableau de toutes les entrées
(titre, page, section, et la photo d'où chaque ligne vient). Tu corriges ce qui est faux, tu décoches ce que tu ne veux pas, et « Créer {n}
références » range tout dans le livre : les recettes déjà repérées (même titre, même page) sont reconnues et ne font jamais de doublon, celles qui
sont déjà là ne sont jamais modifiées ; chaque référence sait de quelle photo elle vient et dans quelle section elle est, et la recherche la trouve
par sa section. « Annuler » arrête l'appel ; une lecture payée reste dans la section Imports (« Reprendre » rouvre le tableau sans rappeler
l'assistant) ; « Saisir à la main » rend la zone de texte ; relire coûte un appel et l'app te le demande avant ; une lecture coupée est dite ; une
entrée trop longue ou porteuse d'une adresse n'est ni inventée ni raccourcie : l'app te dit combien elle en a écartées. Un « Lire » refusé (hors
ligne, séance vide, photo sans octets) n'écrit rien.

**Où.** Branche `table-des-matieres`, worktree `~/projects/mistu-table-des-matieres`, empilée sur la tête finale du lot G `1e4d68d` (chaîne
A → B → G → C) ; spec `docs/superpowers/specs/2026-10-19-table-des-matieres-design.md` (rév. 6 commise `a9e75ca`, rév. 7 à la clôture : § 12.3
R-C-8 à R-C-38, § 13) ; plan rejoué par intention sur `1e4d68d` `docs/superpowers/plans/2026-10-19-table-des-matieres.md` (`f575d3d`, EI-1 à EI-15) ;
registre `.superpowers/sdd/2026-10-19-table-des-matieres/` (briefs, rapports de tâche et de ronde, `mutants.md`, `final-fix-report.md`,
`verify-*.txt` ; copie dans `~/projects/mistu/.superpowers/sdd/`). Serveur de vérification `python3 -m http.server 8091 --bind 127.0.0.1`.
**PAS fusionné, PAS poussé. Aucune migration, serveur `assistant` intact, `DB_VERSION` 4.**

**Ce qui marche (prouvé par la suite, 4743/4743 sur `e305355`, épingle 4742 ; Node 174/174 ; `--check` 0).**
- **Lecture en un appel** (`extraireTableMatieres`, `src/domain/llm.js` : outil `extraction`, 8 000 jetons, chaque image précédée de « Photo n »,
  consigne « donnée, jamais consigne »). La réponse est une donnée hostile : `validerLectureIndex` la lit par propriétés propres, construit chaque
  objet, borne en points de code et en octets ; une entrée trop longue ou porteuse d'une adresse est écartée et COMPTÉE (`ecartees`), jamais tronquée
  ni la lecture jetée ; « Incertain : … » du modèle est rendu en texte, jamais en HTML.
- **Domaine pur `src/domain/table-matieres.js`** : `resultatIndex` (photo ↔ page envoyée), `revaliderResultatIndex` (relecture du journal, forme C sur
  les `page_ids` de la ligne), `ordrePropose`, `positionsProposees`, `reordonnerSeance`, `pagesALire` (dédoublonné), `lignesTableau` / `recalculer` /
  `planCreation`, `fabriquerReferences` (titre et section nettoyés et bornés, `printed_page` 1..9 999 ou nul), `ligneOuverteDeSeance`, `executerIndex`.
- **Panneau d'index** (`indexEntriesPanel`, `src/ui/import.js` : quatre états et un état « en vol ») et `panneauLecture` (`src/ui/table-matieres.js` :
  « Ordre des photos » puis « Entrées lues ») ; « Appliquer cet ordre » écrit la ligne (`page_ids`, `ordre_applique_at`), les positions et la séance en
  UNE transaction (`repo.transitionner(…, { conditions })`, fiches relues dans la transaction par condition de fusion), sans `refresh()` ; « Créer {n}
  références », la zone de texte et « Ignorer » ne valent que pour la lecture montrée (`cleLecture`, revérifiée dans la transaction) ; une clôture
  refusée n'écrit rien et le dit ; « Annuler » agit aussi pendant les gardes.
- **Un seul vol** : `lancerVol(importId, executer, options)` (`src/ui/import-cible.js`) autour de la tenue de `src/ui/vol.js` du lot B (recettes, index
  et lecture web se refusent mutuellement, I-C4) ; les gardes (session, réseau, octets, image) passent AVANT toute écriture (option `lecture`), puis la
  ligne est reprise par la transition de départ ou naît dans le vol par `repo.ouvrirImport` ; `appels + 1` au départ du fetch, `a_verifier` écrit avant
  tout rendu, battement par `repo.battre`, veille bornée ; `lancerExtraction` = `lancerVol` + l'exécutant de la sorte de la ligne.
- **Journal** : `imports{kind:'index'}.resultat` = `{ photos: [{ page_id, printed_page_range, entries }], ecartees, uncertain }`, relu par
  `relireDuJournal` (`VALIDEURS.index`) ; `ordre_applique_at` ; la section Imports et la fiche du livre reprennent la ligne ouverte de la séance
  (`?import=` gagne) ; un échec dit la phrase de l'index.
- **Champs neufs (données JSON, aucun index, aucune migration)** : `recipes.index_page_id` (pointeur souple), `raw_entry`, `index_uncertain`, `section`
  rempli et lu par `sectionLisible` (fiche livre, fiche référence, recherche) ; `source_pages.printed_page_range` (pages CITÉES), `role: 'index'` ;
  `printed_page` jamais écrit par C.
- **Textes** par `t()` (clés exactes dans `en.js`, filet T-C20 ; `MODULES_NEUFS` : `src/ui/table-matieres.js`) ; motifs d'adresse d'une seule
  définition dans `src/core/bornes.js` (R-C-8), lus aussi par la recherche et la lecture web.
- **Vague finale et ronde de clôture.** Titre, section et incertitudes ramenés à UNE ligne (`uneLigne`) avant les contrôles de longueur et d'adresse,
  l'adresse cherchée aussi sur la forme recollée (une entrée imprimée sur deux lignes ne fait plus de doublon à la relecture, une adresse coupée par un
  saut de ligne n'échappe plus à I-C2) ; le panneau d'index s'abonne au vol de son document (`ecouterVol`) : recréé pendant un vol, il se redessine à la
  fin, « Annuler » relit toujours ; depuis la section « Imports », un index en échec se reprend au panneau (« Reprendre », pages cochées) avec la phrase
  de l'index ; une relecture refusée ne rouvre jamais une ligne neuve ; positions, pages à lire et références limitées à la séance relue ; URL `blob:`
  révoquées ; un échec d'enregistrement de l'ordre qui n'est pas un refus est dit ; la zone de texte relit les références en base et coupe à toute fin de ligne (CR, VT, FF, NEL, U+2028, U+2029) ; lecture vide du lot A et titres faits d’invisibles épinglés (ronde de clôture `e305355`, re-revue propre).

**Ce qui n'est PAS prouvé / dettes.** Aucune lecture réelle : la preuve § 10 de la spec (une table de 3 à 5 photos : durée, coupe, fidélité, jetons)
est le geste de Neegan AVANT la fusion et peut amender `MAX_TOKENS_INDEX` ; rien n'est mesuré dans Safari ni sur l'iPhone ; dettes nommées R-C-18 (projection de la séance quand une photo retirée garde son créneau), R-C-26 (doublons de squelette et de clôture, recoupement défense en profondeur, `tests/sync.js` et `SHELL`, hors lot `buildDocs` et chaînes antérieures du panneau), R-C-27 (recherche : mot de section = mot de type, dette C7 élargie), R-C-28 (L4 d'« Ordre des photos »), R-C-36 (faux positif d'adresse après un point) ; tests sensibles au temps de la vague (R-B-15) ; équivalents déclarés (R-C-29, VF1b).

**Gestes de Neegan, dans l'ordre.** 1) Lots A, B puis G d'abord (leurs sections). 2) `git merge --ff-only table-des-matieres` par `!` (après la fusion
de G), `git push`, suite publique `https://neegans.github.io/mistu/tests/` → 4743/4743 (épingle 4742, plus le 404 de `/favicon.ico`), service
worker `cuisine-os-v0.12.0-12`. 3) Preuve réelle § 10, connecté : un livre, sa table des matières sur 3 à 5 photos, « Lire » → UN POST `/functions/v1/assistant`,
l'ordre proposé, le tableau, « Créer {n} références », les fiches liées à leur photo ; `select jour, appels from public.assistant_usage_jour;` ;
relever durée, coupe et jetons (§ 10 pas 5). 4) iPhone (le même parcours depuis l'app installée). 5) « clean » (worktrees, serveurs 8088-8094), après la
copie du registre.

**Versions.** `APP_VERSION 0.12.0` ; `sw.js` `cuisine-os-v0.12.0-1` (T1) … `-10` (ronde 1 de T5 ; T6 et sa ronde ne touchent pas `src/`), `-11` (vague finale), `-12` (ronde de clôture) ; `DB_VERSION` 4 inchangée.

**Bilan.** Départ sur `1e4d68d` (mesure = G : 4403/4403, épingle 4402, Node 174) ; rejeu du plan par intention (EI-1 à EI-15 → R-C-8 à R-C-14) ;
six tâches, une ronde chacune, re-revues propres : `f226931`/`569f01e` (T1 : vol partagé, validation, domaine), `a0708e2`/`7de1cd2` (T2 : créer les références), `3e8592a`/`199b5b9` (T3 : ordre proposé), `e541a43`/`70bf7d6` (T4 : panneau et tableau), `ed90e2c`/`4090ebe` (T5 : section), `7c519f8`/`401e96e` (T6 : filets, docs) ; revue finale à trois lentilles (la lentille faux-vert et la vague rejouées après une coupure réseau) : 6 Important et 18 Minor ; vague finale `0b9ba10` (VF-C1 à VF-C8, re-revue PROPRE) ; ronde de clôture `e305355` (R-C-24, re-revue PROPRE) ; suite 4403 → 4743, Node 174. Mutants : ceux du plan et des revues rejoués sur copies à chaque tâche et à chaque ronde (`mutants.md`, rapports) ; vague 37/39 (un équivalent, X4 durci) ; ronde de clôture 14/16 (I37 et VF1b équivalents). `/verify` mécanique : `verify-C-e305355.txt` (registre). Rulings : R-C-8 à R-C-38 (spec § 12.3).

### Un lot de recettes photographiées : classer, regrouper, lire une à une, apparier à la référence (19-22 octobre 2026, lot D)

**Pour toi.** Tu photographies plusieurs recettes d'un livre d'un coup, dans n'importe quel ordre, et « Classer ces photos avec l’assistant » (un
appel) te rend des groupes — une recette par bloc, ses pages dans l'ordre, son titre et sa page tels qu'imprimés ; une photo qui continue une recette
absente est mise de côté, une photo qui semble porter deux recettes est signalée et reste avec celle qui y commence. Tu corriges sans appel
(déplacer, nouvelle recette, retirer ; tes changements survivent à un rechargement), l'app te propose pour chaque recette la référence de ton index
(même titre ET même page : cochée ; un doute : rien de coché, la raison dite), puis « Lire ces recettes ({n} appels) » les lit une à la fois et la
section Imports montre où on en est (« 2 sur 3 lues », « Continuer la lecture »). « Reprendre » ouvre chaque lecture — dans sa référence, c'est
« Enregistrer cette lecture » qui la range ; une nouvelle recette s'ouvre dans l'éditeur —, en gardant les numéros des photos de la séance, ses
incertitudes, ses notes et ses limites ; fermer l'app en route perd la lecture en cours, qui a peut-être été comptée, et une erreur de service
arrête le lot pour ne pas dépenser en vain.

**Où.** Branche `recettes-en-lot`, worktree `~/projects/mistu-recettes-en-lot`, empilée sur la tête finale du lot C `739e706` (chaîne
A → B → G → C → D ; base `4db4d8e` = `739e706` + la spec) ; spec `docs/superpowers/specs/2026-10-19-recettes-en-lot-design.md` (rév. 5 : § 12.C posé à
la tâche 6 — rulings de plan, relecture de la tâche 1, écarts E-1 à E-29 et de construction, assertions amendées —,
complété par la vague et par la clôture : rulings R-D-20 à R-D-28) ; plan rejoué par intention
`docs/superpowers/plans/2026-10-19-recettes-en-lot.md` (`d42d4ab`, EI-1 à EI-13, rulings R-D-13 à R-D-19) ; registre
`.superpowers/sdd/2026-10-19-recettes-en-lot/` (briefs, rapports de tâche et de ronde, `t1-relecture.md`, `mutants.md` ; hors git, à copier dans
`~/projects/mistu/.superpowers/sdd/` avant tout `git worktree remove`). Serveur de vérification `python3 -m http.server 8092 --bind 127.0.0.1`.
Deux modules neufs : `src/domain/classement.js` (pur) et `src/ui/regroupement.js` (écrans) ; le panneau « Classement » se monte sous les miniatures de
la séance (`sessionView`, `src/ui/import.js`), la proposition de référence dans l'éditeur (`blocApparierLecture`), les blocs de lot dans la section
« Imports » d'Ajouter (`src/ui/add.js`). **PAS fusionné, PAS poussé. Aucune migration, serveur `assistant` intact, `DB_VERSION` 4.**

**Ce qui marche (prouvé par la suite, `✅ 5228/5228`, épingle 5227 après la vague finale, T-D1 à T-D22 plus les blocs de vérification, de ronde et
de la vague ; Node 174/174 ; `--check` 0 ; aucun réseau, bases jetables, `fetch` injecté).**
- **Classement en un appel** (`classerPhotos`, `src/domain/llm.js` : outil `extraction`, 2 000 jetons, 2 à 10 photos, « Photo n » avant chaque
  image) ; la réponse est une donnée hostile (`validerClassement` : propriétés propres, objets construits, numéros bornés, photo à deux nommants
  départagée par la tête — R-D-7 —, titre trop long ou porteur d'une adresse rendu nul sans jeter le classement payé) ; une règle des titres
  (`estTitreUneLigne` sur la forme pliée, `surUneLigne` = `uneLigne` de C puis `plierUneLigne`, R-D-13).
- **Panneau « Classement »** (`panneauClassement`, cinq états, abonné au bus) par le vol partagé `lancerVol` (options `attendus` / `accepte` ;
  `SORTES_EXTRACTION = ['recette', 'index']`) : « Annuler », « Reclasser » (confirmé, un appel), « Ignorer ce classement » (relu, gardé par sa clé) ;
  « Regrouper en recette » devient secondaire à deux photos cochées. Vague finale : le vol est lié aux pages comptées ; un classement en vol
  ailleurs dont le document est mort est levé (passe `interrompu` à l'affichage, puis la veille, comme l'écran ciblé) ; « Regrouper en recette »
  est retiré aussi sur une photo d'une lecture de recette ouverte de la séance (une ligne de lot pas encore lue ne se paie pas deux fois).
- **Écran de regroupement** : déplacer / nouvelle recette / retirer sans appel, brouillon gardé par la clé du classement (un brouillon hostile
  n'apporte rien, jamais un titre ; vague finale : il se restaure aussi après « Retirer » d'une photo classée — la couverture ne vaut que pour les
  pages présentes —, et des octets arrivés pendant que l'écran est monté rallument « Lire »), appariement proposé (`proposerAppariements`,
  `selecteurReferences`), « Lire ces recettes ({n} appels) » en UNE transaction (`creerLesLectures` : classement `enregistre`, lignes neuves
  `absente`, une condition d'index par référence cochée), lecture séquentielle (`lireLeLot` : `attendus: ['a_lancer']`, un lot par document,
  `suiteDuLot` à défaut fermé, `referenceALire` relue avant chaque lancement).
- **Imports** : blocs de lot (« Lot de {n} recettes · {l} », « {k} sur {n} lues », « Continuer la lecture ({r} appels) »), note de séance.
- **Enregistrer une lecture issue d'une séance (N-1)** : positions de la séance jamais réécrites, `role: 'recette'`, photo d'index de la fiche écartée
  des pages lues, de l'union et du bloc « Original », séance dans la même transaction par le sac `conditions` (garde élargie à `absente` / `index`,
  R-D-14) et `done` seulement quand plus aucune photo n'est sans rôle ; « En faire une nouvelle recette » sur toute discordance ; l'éditeur porte
  incertitudes, notes et limites et propose une référence (`rattacherLecture`, candidature rejouée dans la transaction).
- **Une fabrique** de ligne d'import (`ligneImportNeuve`, aussi pour la lecture web du lot B, R-D-15) ; `SORTES_IMPORT` ferme `imports.kind`.
- **Filet T-D20** (tâche 6, élargi en ronde 1) : chaque texte neuf de la spec § 5 avec son anglais, les clés réemployées (les trois phrases I-4 du
  lot A comprises), les deux modules dans `SHELL`, `regroupement.js` dans le filet i18n, ni fournisseur ni base nommés (toute casse),
  `src/ui/regroupement.js` n'écrit que par `repo.transitionner`, `repo.ouvrirImport` et `repo.marquerInterrompus` (la veille, vague finale) — tout
  accès sur `repo` ou sur l'espace de noms `repoModule`, `?.` et espaces compris ; `repoModule` pour `newId`, `deviceId` et `BATTEMENT_MORT_MS`
  seulement ; ni crochets, ni alias, ni déstructuration ; `repo.js` importé une seule fois, comme `repoModule`, et `db.js` pour `TransitionRefusee`
  seul (vague finale : ni import nommé, ni second espace de noms). Vu rouge sur copie : M-D1 et M-D2 (tâche 6) ; M-D3 `repo.save(`, M-D4
  `repoModule.save(` et six variantes, M-D5 « anthropic » en minuscules (ronde 1 ; M-D4, deux variantes et M-D5 passaient le filet de `4d4da15`) ;
  FV-ID1-import-nomme et FV-ID1-espace-renomme (vague finale ; verts sur `915df9f`). Faible (admis) : `repo` passé en argument à une fonction d'un
  autre module lui échappe.

**Ce qui n'est PAS prouvé.** Aucun classement réel ni aucune lecture réelle : la durée et la justesse d'un vrai classement, la taille réelle d'un
envoi (`octets`) et la borne réelle de 10 photos (413 de la passerelle, refus de la bordure ou succès), la photo partagée en vrai (mesure de R-D-1 :
dans quel groupe elle reste, « page possiblement manquante » sur l'autre), la lecture réelle de cinq recettes d'un lot ; rien dans Safari ni sur
l'iPhone (décodage de 5 à 10 photos par `createImageBitmap`) ; rien entre deux appareils.

**Dettes (assumées ; détail en spec § 12.C et dans les rapports).** Mutants (registre `mutants.md` : les 193 lignes de la table de la tâche 6 en 218
passes sur copies servies à part, puis les passes de la ronde 1 de T6) : **aucun survivant**. M132 à la lettre (le premier mur du cache de
`poserImage`) survivait par un trou de T-D13, qui lisait la miniature après des attentes : sans ce mur, chaque redessin laisse les miniatures vides
jusqu'à la réponse de `getFile` et relit chaque miniature dans IndexedDB ; T-D13 la relit désormais dès le redessin (ronde 1), M132 est rouge et les
deux murs restent (le second empêche deux URL pour une même empreinte en cas de course). T-D16 « Annuler » attend un fait borné (R-D-10, ronde 1) :
M53 et M84 rendent un bilan rouge au lieu de figer la suite. Écarts E-1 à E-29 du plan et écarts de construction des rondes (séance refusée sans
détacher l'éditeur, même règle sur l'écran ciblé, candidature rejouée par `autres`, `src/ui/import.js` touché en T5-R1, `referenceALire`,
`lotDeRecette`, « Continuer » qui dit un arrêt, miniatures par `displayUrl`, ligne `raison-reclasser`, R-D-19, texte « Coche au moins deux photos de
cette séance. ») : déclarés ; la revue finale de branche n'en a relevé qu'un, la règle « première page seulement » de l'éditeur appliquée à toute
saisie (constat 3), RATIFIÉ par la vague (rien d'inventé) — la ratification formelle des autres reste au chef d'orchestre, à la clôture. Limites
nommées par la vague (spec § 11) : I-D9 vaut par appareil (deux appareils peuvent consommer le même classement avant la synchro) ; une page d'un
GROUPE absente à l'écriture du brouillon puis revenue le fait encore refuser ; une adresse `#/recipes/new?pages=…` tapée relit une photo de lot ;
**une photo d'index rangée dans un groupe** est réécrite page de recette (décision de Neegan, spec § 13). Doublons nommés (`classerPhotos` /
`extraireTableMatieres`, `nu` / `sien` contre `objetNu` / `proprio`, sac de séance en deux copies, prédicat « lecture tenue » ×5), pages écrites
par copie hors transaction (lot A), séance par copie sur trois chemins (refusé, spec § 4.8.2 point 5), pas d'objet `R.rendu`, échelle des
raisons en deux copies, « Continuer » ne suit pas le réseau, « (n appels) » est un maximum (une ligne sans octets ici est refusée avant tout POST).

**Gestes de Neegan, dans l'ordre.** 1) Lots A, B, G puis C d'abord (leurs sections). 2) **Sonde R-D-8, AVANT la fusion de D** (aucun agent ne
dépense d'appel à ta place) : `http://127.0.0.1:8092` ajoutée le temps de la sonde à `ASSISTANT_ORIGINES` (elle remplace la valeur par défaut,
`supabase/README.md`), **et** `http://127.0.0.1:8092/**` ajoutée aux Redirect URLs de `mitsu` (Authentication → URL Configuration ; sans elle, le
retour de Google retombe sur la Site URL publique et la branche locale n'est jamais connectée), la branche servie localement, connecté : pas 1, 2, 7
et 8 de § 10 (classement réel de 5 photos : durée, groupes, `octets` dans `assistant_journal` ; une tentative à 10 photos ; la séance de 2 photos à
page partagée) ; mesures consignées en spec § 12 (elles peuvent amender `MAX_PHOTOS_CLASSEMENT`, `CLASSER_SYSTEM` ou rouvrir R-D-1 par une ronde) ;
l'origine ET l'adresse de retour retirées ensemble ensuite (une adresse `http` de développement ne reste jamais admise sur le projet réel). **Connecté,
la branche écrit dans ta vraie bibliothèque** : l'entrée `dev` de `src/sync/config.js` pointe `mitsu` ; la séance, ses photos (octets L4) et les
lignes `imports` du lot (`classement`, `recette` à champ `lot`), écrites par un code non fusionné, partent au serveur et arrivent sur les appareils
restés sur C avant la fusion de D. 3) **La preuve § 10 du lot A consignée**
(une extraction réelle : le lot D en lance cinq) — second mur avant la fusion. 4) `! git -C ~/projects/mistu merge --ff-only recettes-en-lot` (après
C), puis **un** `! git -C ~/projects/mistu push origin main` ; suite publique `https://neegans.github.io/mistu/tests/` → `5228/5228` (épingle 5227,
vague finale ; plus le 404 de `/favicon.ico`), service worker `cuisine-os-v0.13.0-11` (ou le suffixe d'une ronde ultérieure).
5) **Preuve § 10 complète sur le site public**, connecté (iPhone de préférence), pas 1 à 8 ; jetons avant et après (`select jour, appels,
jetons_entree, jetons_sortie from public.assistant_usage_jour;`). 6) **Trancher la photo d'index dans un groupe** (spec § 13 : la protéger, ou
garder D-D6 sans lui donner le numéro de la recette ; sans urgence, rien n'est perdu). 7) « clean » seulement après la copie du registre.

**Versions.** `APP_VERSION 0.13.0` (C : 0.12.0) ; `sw.js` `cuisine-os-v0.13.0-1` (T1) … `-10` (ronde 1 de T5 ; la ronde 2 de T5 et la tâche 6 ne
touchent pas `src/`), **`-11`** (vague finale), chaque commit qui touche `src/` incrémente (R-B-24) ; `SHELL` + `./src/domain/classement.js`,
`./src/ui/regroupement.js` ; `DB_VERSION` 4 inchangée.

**Bilan (tâche 6 et sa ronde 1).** Départ sur `4db4d8e` (mesure = C : 4743/4743, épingle 4742, Node 174) ; rejeu du plan par intention (EI-1 à EI-13 →
R-D-13 à R-D-19) ; six tâches. T1 à T5 revues à trois lentilles, chacune avec au moins une ronde : T1 `b5565a6`/`1ae60f0`, T2 `ad0c439`/`29cd797`, T3
`c7e826b`/`fd483bf`, T4 `fbf0b92`/`7494ee9`, T5 `18543f5`/`3645d41`/`356a1b2` ; T6 (filets, docs, total épinglé) `4d4da15`, revue à trois lentilles (3
Important, 12 Minor) puis sa ronde 1 (filet I-D1 élargi, T-D13 et T-D16 durcis, docs) ; sa re-revue est PROPRE (0 restant, 0 neuf). Suite 4743 →
**5217/5217** (épingle
**5216**, inchangée par la ronde 1 : assertions amendées, aucune ajoutée), Node 174/174, `--check` 0. Mutants : les 193 lignes de la table (171 de la
spec § 7, 16 du pré-vol, M-D1 et M-D2, quatre du rejeu) en 218 passes sur des copies servies à part (8192-8194, témoins verts) à la tâche 6 — 217
rouges, dont M53 et M84 qui figeaient la suite, et M132 survivant — ; à la ronde 1 (copies 8192-8194, témoins verts) : M132 et M132 sur les deux murs
rouges, M53 et M84 rouges avec bilan, MR-c3 rejoué sur la tête rouge, M-D3, M-D4 et ses six variantes, M-D5 rouges ; registre `mutants.md`.

**Vague finale (22 octobre 2026, revue finale de branche de `915df9f` : 2 Important, 13 Minor ; rapport `final-fix-report.md`).** Corrigés : le
brouillon après « Retirer » d'une photo classée (constat 1), deux attentes par ticks devenues des faits (2), « Regrouper en recette » sur une photo
de lot (4), octets arrivés pendant que l'écran est monté (5), la veille de l'état 2 (7), la borne de 10 `page_ids` (8), le vol lié aux pages
comptées (9), le filet I-D1 sur les imports (11), trois libellés de mutants (12-14), le registre à la lettre (15) ; ratifié : la règle
« première page seulement » de l'éditeur (3) ; nommé : I-D9 par appareil (6) ; porté à ta décision : la photo d'index dans un groupe (10, spec
§ 13). Suite **5228/5228** (épingle **5227**, +11), Node 174/174, `--check` 0, invisibles 0, `sw.js` `-11` ; rouge d'abord sur l'ancien `src/`
(❌ 5214/5225) ; mutants : 37 passes, toutes rouges (spec § 12.C). Re-revue de la vague PROPRE ; `/verify` et la copie du registre : clôture ci-dessous.

**Clôture (22 octobre 2026, 18 h 18, chef d'orchestre ; rulings R-D-20 à R-D-28, spec § 12.C « Clôture »).** Re-revue de la ronde 1 de T6 PROPRE ;
re-revue de la vague PROPRE (0 neuf) ; aucune ronde de clôture. Ratifiés en bloc (R-D-20) : E-1 à E-29, EI-1 à EI-13, les écarts de construction des
six tâches et de leurs rondes — dont `referenceALire`, `lotDeRecette`, « Continuer » qui dit un arrêt (T4-R1), la séance refusée sans détacher
l'éditeur (T5-R1, E-13 remplacé), `lecturePosee` sans `f.lecture` (E-9) — ; la spec rév. 5 aligne § 3.6, § 4.3, § 4.6, § 4.7 et § 5 sur le code
commis. Versions (R-D-21) : `sw.js` de `-1` à `-11` par commit qui touche `src/` (R-B-24), épingles 4899 → 5227, attendus du rejeu dépassés par les
rondes et les assertions de vérification (R-D-22) — la tête réelle fait foi. Mutants (R-D-23) : aucun survivant ; équivalents déclarés MT-redessin et
M-l ; huit mutants de T2 tombent par l'expiration d'une attente (rouge lent admis). Dettes (R-D-24) et limites (R-D-25, dont deux onglets qui
classent la même séance en même temps : deux appels, rien de perdu) nommées sans décision ; la photo d'index dans un groupe reste à toi (R-D-26,
§ 13). **Sonde R-D-8 (R-D-27)** : pendant la sonde, les autres appareils restent FERMÉS (ils tournent la version publique, qui ne connaît ni la sorte
`classement` ni le champ `lot`) et la séance porte des photos sans valeur ; après la fusion et le push, tous les appareils sur 0.13.0 avant le
premier classement réel d'une bibliothèque partagée (même règle que R-C-32). `/verify` mécanique de clôture sur `1046c64` (R-D-28, registre
`verify-D-1046c64.txt`) : suite 5228/5228, épingle 5227, Node 174/174, `--check` 0, `APP_VERSION 0.13.0`, `sw.js cuisine-os-v0.13.0-11`, `DB_VERSION`
4, secrets 0, invisibles 0. Tête de code `c90f527` ; tête finale = le commit de clôture qui pose ces documents ; registre copié dans
`~/projects/mistu/.superpowers/sdd/2026-10-19-recettes-en-lot/`. Prochain : Départ E sur cette tête (worktree `~/projects/mistu-couverture-lue`,
branche `couverture-lue`, serveur 8093, `APP_VERSION 0.14.0`).

### Un livre reconnu depuis sa couverture : lecture par l'assistant, rattrapage Open Library (19-23 octobre 2026, lot E)

**Pour toi.** Un livre dans les mains, pas d'ISBN sous la main : tu photographies la **couverture**. L'app garde la photo tout de suite, puis
l'assistant lit ce qui est imprimé — titre, auteur, éditeur — et le pas 2 d'« Ajouter un livre » s'ouvre déjà rempli, étiqueté « Lu sur la
couverture — vérifie. » ; ce qui ne se lit pas reste vide et le dit. Dans la foulée, l'app demande à Open Library si elle connaît ce titre de cet
auteur : si oui, un bandeau te propose sa fiche — et son ISBN seulement quand le livre n'a qu'une édition —, que tu prends d'un geste ou que tu
ignores. Puis « Ajouter ce livre », comme avant. Si la couverture ne se lit pas, si tu es hors ligne ou si le quota du jour est atteint, rien n'est
perdu : la couverture est posée, tu saisis le titre. Si tu quittes l'écran pendant la lecture, la section Imports de la page Ajouter te la rend
(« Reprendre »). Une seconde photo repart d'un nouveau livre : ce que la lecture avait rempli s'efface, ce que tu as tapé reste. Un livre vide se
supprime sans laisser de trace ; la sauvegarde écarte les traces orphelines. Le chemin par ISBN reste là, inchangé, et reste le plus sûr.

**Où.** Branche `couverture-lue`, worktree `~/projects/mistu-couverture-lue`, empilée sur la tête finale du lot D `619e6c0` (chaîne
A → B → G → C → D → E ; base `209de95` = `619e6c0` + la spec) ; spec `docs/superpowers/specs/2026-10-19-couverture-lue-design.md` (rév. 6 commise
`209de95`, rév. 7 à la clôture : § 12 « Rév. 6 → rév. 7 », rulings R-E-16 à R-E-39, écarts EI-1 à EI-17 ; § 13) ; plan rejoué par intention sur
`619e6c0` `docs/superpowers/plans/2026-10-19-couverture-lue.md` (`2bb855a`, tâches 1, 2, 3a, 3b, 4 = tâches 1 à 5 du registre) ; registre
`.superpowers/sdd/2026-10-19-couverture-lue/` (briefs, rapports de tâche et de ronde, `final-fix-report.md`, `verify-*.txt` ; hors git, copie dans
`~/projects/mistu/.superpowers/sdd/`). Serveur de vérification `python3 -m http.server 8093 --bind 127.0.0.1`. Un module neuf :
`src/domain/couverture.js`
(pur) ; la lecture et sa validation dans `src/domain/llm.js` ; le vol par la primitive partagée `lancerVol` (option `preparer` de `volUnique`, R-E-23) ;
l'écran dans `src/ui/livre-ajout.js` ; `repo.removeBatch` et `supprimerLivreVide` (`src/ui/book.js`) ; le filet de `createArchive`
(`src/domain/backup.js`) ;
la section Imports (`src/ui/add.js`). **PAS fusionné, PAS poussé. Aucune migration, serveur `assistant` intact, `DB_VERSION` 4.**

**Ce qui marche (prouvé par la suite, 5681/5681 sur `1e5e61b`, épingle 5680 ; Node 174/174 ; `--check` 0 ; aucun réseau, bases jetables, `fetch` et
`pickFiles` injectés).**
- **La couverture d'abord** (I-E2) : octets dans `files` (`poserCouverture`), ligne `imports` `kind: 'couverture'` `a_lancer` avec `cover_sha256`
  (fabrique unique `ligneImportNeuve`, R-E-21), puis seulement le `fetch` ; un échec, une coupure, un quota ne perdent jamais la photo.
- **Un clic = un appel** (I-E3) : un seul vol par document (`lancerVol`, partagé avec l'import ciblé, la table des matières, le classement et la
  lecture web) ; une ligne d'une autre sorte en vol est refusée `sorte` ; `appels + 1` au départ du `fetch` ; « Annuler » (499).
- **Une lecture validée** (I-E1 : donnée hostile lue champ par champ, bornée, Cc/Cf retirés, une ligne par `surUneLigne` (R-E-22), aucune adresse ;
  `hors_bornes` sur un dépassement ; un résultat revenu du journal est revalidé) remplit le pas 2 « Lu sur la couverture — vérifie. » ; les champs
  illisibles sont vides et nommés (`uncertain`).
- **Open Library** par titre ET auteur (`search.json`, `fields` fixés) ; ISBN, éditeur, année et langue proposés seulement pour une œuvre à UNE
  édition (`edition_count === 1` et un seul ISBN-13) ; « Utiliser ces renseignements » / « Ignorer » ; une requête par lecture appliquée, jamais sur
  un redessin ; le bandeau est posé par `majProposition()`, la saisie et le focus survivent.
- **« Ajouter ce livre »** ferme l'import dans la transaction du livre ; la section Imports reprend une lecture quittée (`?import=`, « Reprendre »),
  avec ses propres phrases (R-E-19) ; une couverture `a_lancer` d'un autre appareil n'offre que « Ignorer ».
- **Supprimer un livre vide sans orphelin** (`repo.removeBatch`, `supprimerLivreVide`, refus pendant `en_cours`) ; **la sauvegarde** écarte les traces
  de consultation orphelines et le dit dans le bilan `messagesArchive` du lot G (R-E-26) ; une archive ancienne à relation cassée se restaure.
- **Filets** : `MODULES_NEUFS` / `CHAINES_NEUVES_AILLEURS` (`tests/ajouter.js`), `SHELL` + `./src/domain/couverture.js`, S14 « ni fournisseur ni base »
  en toute casse (R-E-28), test statique « `repo.transitionner(` » du lot A vert (`const repo = r;`, R-E-16), seize pins de version à `0.14.0`.
- **Vague finale et ronde de clôture** (revue finale de branche de `6192422` : 3 Important, 11 Minor) : sans ISBN avant comme après, « Saisir à la
  main » garde les champs repris d'Open Library et leur étiquette ; « Identifier » ne remet une lecture qu'à la fiche trouvée — sur un ISBN
  introuvable ou une panne, la lecture et les champs repris restent, et la ligne « Aucune fiche… » le dit (ronde de clôture) ; les boutons du pas 1
  éteints par le vol d'une autre route se rallument à sa fin (un vol hors journal compte aussi) ; `online` ignoré pendant le vol de la route ; des
  octets arrivés après une reprise s'affichent sans redessin ; un geste sur la seule zone Couverture ne détache plus une lecture en vol ; la
  préparation finie après un changement de pas ne redessine que ses blocs ; deux faux-verts fermés (message du refus `octets_absents` / `image`,
  `cover_sha256` borné) ; des faits (`relecturesFaites`) à la place de ticks ; `lotDe` lit `BORNES_CLASSEMENT`. Ronde de clôture `784e7cf` (R-E-31) :
  après « Utiliser ces renseignements » sans ISBN, « Identifier » d'un ISBN introuvable ou en panne garde les champs repris et leur étiquette, et dit
  « Aucune fiche… » ; un vol hors journal éteint aussi les boutons du pas 1 ; une couverture relancée ici porte cet appareil (seconde assertion).
  Re-revue : les quatre points fermés, un faux-vert neuf (la garde `isbnDistant === null` sans assertion, RA5) → ronde de clôture 2, tests seuls
  (`1e5e61b`) : ISBN A trouvé puis ISBN B introuvable → rien de A ne reste ; RA5 rouge.

**Ce qui n'est PAS prouvé.** Aucune lecture réelle de couverture (§ 10 : durée, modèle, justesse de la consigne § 3.3 et de la table § 3.2, `uncertain`
réellement porté, jetons de sortie attendus sous 1 000) ; Open Library réel (fixtures remesurées par `curl` le 19 octobre, pas depuis) ; Safari et
iPhone (`createImageBitmap` sur une photo de 48 Mpx, « Photographier la couverture », appareil photo refermé sans photo) ; deux appareils.

**Dettes (assumées ; détail en spec § 12 et § 13).** Mutants : T1 24/24, T2 15/15, T3 29 joués (27 rouges, les deux survivants tués en T3-R1), T4
45/47 (N02, N28 équivalents), T5 26/26, vague 20/20, ronde de clôture 20/20 puis RA5 rouge sur les deux assertions neuves (`❌ 5679/5681`), RA1 et RA3
restent rouges, X1 du relecteur rouge ; témoins verts sur 8298 et 8398-8399 — aucun survivant ; équivalents nommés M03/M03b, N02, N28, R16 (cycle
évité), M16, P4, P7 (= T5r) ; deux mutants figeaient la suite (M01, MW d'un autre lot) : attente bornée, MW nommé. Dettes de code (R-E-35) : quatre
copies des gardes « sans vision » (`extraireRecette`, `extraireTableMatieres`, `classerPhotos`, `extraireCouverture`) ; `removeMany` non réécrit sur
`removeBatch` ; les deux temps de `supprimerLivreVide` non atomiques et la relecture « édition vide » hors transaction ; `scan_sessions.edition_id →
book_editions` non relu ; route sans crochet de sortie (m13 du lot A) ; `photographierCouverture` long ; double lecture montage + `relire()` ;
`lireSearch` (chemin ISBN) garde le défaut des demi-paires ; `BarcodeDetector` / `createImageBitmap` hors suite ; une couverture d'un autre appareil
dit « Photos sur un autre appareil » dans la section ; la passe `interrompu` n'est pas rejouée au montage d'un `?import=` `en_cours` ; un vol web ne
notifie pas (R-B-27) ; la relance d'une ligne en échec garde `reponse_brute`, `model`, `duree_ms` et `finished_at` (le remède rougit une assertion du
lot A, R-E-35). Limites nommées (§ 11, R-E-36) : la photo d'une couverture en attente n'est pas un pointeur L4 (**décision de Neegan**, R-E-37, § 13)
; la condition du temps 2 de D-E23 ne voit que les statuts connus ; une ligne au statut non-chaîne bloque la suppression d'un livre vide tant qu'elle
existe.

**Gestes de Neegan, dans l'ordre.** 1) Les lots A, B, G, C puis D d'abord (leurs sections : migrations, redéploiement, sondes, fusions, sonde R-D-8).
2) **Preuve réelle § 10 AVANT la fusion de E**, sur la branche servie localement, connecté : poser `ASSISTANT_ORIGINES` à
`https://neegans.github.io,http://localhost:8093` (LES DEUX origines, séparées par une virgule : la valeur posée remplace le défaut, et
`http://localhost:8093` seul couperait le site public), **et** `http://localhost:8093/**` aux Redirect URLs de `mitsu` (sans elle, le retour de Google
retombe sur la Site URL publique) ; jouer les sept points de § 10 (une vraie couverture : « À la di Stasio », puis « Berber and Q », une typographie
difficile, une anglaise à plusieurs éditions, hors ligne, « Annuler », rouvrir et supprimer puis archive restaurée) ; noter durée, modèle, champs lus
contre la couverture, `select owner_id, jour, appels, jetons_entree, jetons_sortie from public.assistant_usage_jour;` ; **retirer le port et l'adresse
de
retour ensuite**. Si le premier essai révèle une limite (titre pris pour l'auteur, `uncertain` jamais ou partout, langue fantaisiste), la consigne
§ 3.3 (module ET test littéral) et la table § 3.2 s'amendent par une ronde avant la fusion. Pendant la preuve, les autres appareils de la bibliothèque
restent fermés (la version publique ne connaît pas la sorte `couverture`, et la ligne de la preuve leur arrive par la synchronisation).
3) `! git -C ~/projects/mistu merge --ff-only couverture-lue` (après D), puis **un** `! git -C ~/projects/mistu push origin main` ; suite publique
`https://neegans.github.io/mistu/tests/` → `5681/5681` (épingle 5680 ; plus le 404 de `/favicon.ico`), service worker `cuisine-os-v0.14.0-12`. 4) Tous
les appareils sur
0.14.0 avant la première couverture lue d'une bibliothèque partagée (même règle que R-C-32 et R-D-27). 5) iPhone (§ 10 point 6 : l'appareil photo
s'ouvre, une photo de 12 Mpx passe, refermé sans photo il se rouvre et rien n'est écrit). 6) « clean » seulement après la copie du registre.

**Versions.** `APP_VERSION 0.14.0` (D : 0.13.0) ; `sw.js` `cuisine-os-v0.14.0-1` (T1) … `-10` (ronde 1 de T5), `-11` (vague), **`-12`** (ronde de
clôture `784e7cf`) ; chaque commit qui touche `src/` incrémente (R-B-24) ; chaque commit qui touche `src/` incrémente (R-B-24) ; `SHELL` +
`./src/domain/couverture.js` ; `DB_VERSION` 4 inchangée.

**Bilan.** Départ sur `209de95` (mesure = D : 5228/5228, épingle 5227, Node 174) ; rejeu du plan par intention (EI-1 à EI-17 → R-E-21 à R-E-29) ; cinq
tâches (1, 2, 3a, 3b, 4), chacune revue à trois lentilles avec une ronde et une re-revue PROPRE : T1 `a5a89dc`/`79f113b` (5326 → 5350), T2
`29f6ec7`/`804e947` (5404 → 5414), T3 `f170942`/`35dd837` (5446 → 5473), T4 `c647e4a`/`f5cf6c8` (5576 → 5618), T5 `8d447a0`/`6192422` (5641 → 5656) ;
revue finale de branche (3 Important, 11 Minor), vague `f814f13` + `8934f07` (5670/5670, épingle 5669, 20 mutants rouges), re-revue A_CORRIGER → ronde
de clôture `784e7cf` puis `1e5e61b` (tests seuls) (`sw.js -12`, épingle 5678 puis 5680, 5681/5681, mutants 20/20 puis RA5 rouge sur les deux
assertions neuves (`❌ 5679/5681`), RA1 et RA3 restent rouges, X1 du relecteur rouge ; témoins verts sur 8298 et 8398-8399), re-revue de la ronde 1
A_CORRIGER (quatre points fermés, un faux-vert neuf RA5) puis, après la ronde 2 tests seuls `1e5e61b`, **PROPRE** (0 restant, 0 neuf) ; suite 5228 →
**5681/5681** (épingle **5680**), Node 174/174, `--check` 0 ; clôture du chef d'orchestre : rulings R-E-30 à R-E-39, `/verify` VERT
(`verify-E-1e5e61b.txt`), registre copié.

### Les plats en images : photo du plat, rapatriement par la fonction, cartes illustrées (19-23 octobre 2026, lot F)

**Pour toi.** Chaque recette peut avoir SA photo du plat. Sur la fiche, une section « Photo du plat » — la même que la couverture d'un livre — te
laisse photographier, choisir (ce qui remplace la photo en place) ou retirer ; la photo s'affiche en tête de la fiche. Quand tu gardes et lis une
recette du web, l'app essaie aussi de récupérer l'image que la page affiche, par le serveur et jamais depuis ton téléphone, juste après
« Enregistrer » ; l'écran te dit avant que c'est un appel de plus de ton quota du jour (60), sans jeton. Si l'image ne vient pas, la recette est là
quand même, la section le dit en une ligne, et tu choisis : « Réessayer » (un appel de plus, dit sous le bouton), poser ta propre photo, ou « Ne pas
récupérer ». Une image venue du web porte la mention « Image de la page » suivie du site de la recette. Dans tes listes (recherche, Mes livres,
fiche d'un livre, plats, favoris, repas), une petite vignette montre les plats dont tu as la photo ; sans photo, rien ne change. Une photo que tu as
choisie reste toujours la tienne : une image du web ne la remplace jamais.

**Où.** Branche `plats-en-images`, worktree `~/projects/mistu-plats-en-images`, empilée sur la tête finale du lot E `5ec092c` (chaîne
A → B → G → C → D → E → F ; base `35fb29c` = `5ec092c` + la spec) ; spec `docs/superpowers/specs/2026-10-19-plats-en-images-design.md` (rév. 3 commise
`35fb29c`, rév. 4 à la clôture : § 12 « Rév. 3 → rév. 4 », rulings R-F-7 à R-F-29, écarts EI-1 à EI-7, défauts D-1 à D-3, adaptations A-1 à A-11 ;
§ 13) ; plan rejoué par intention sur `5ec092c` `docs/superpowers/plans/2026-10-19-plats-en-images.md` (`111f857`) ; registre
`.superpowers/sdd/2026-10-19-plats-en-images/` (briefs, rapports, `recensement-D-F16.md`, `final-fix-report.md`, `verify-*.txt` ; hors git, copie dans
`~/projects/mistu/.superpowers/sdd/`). Serveur de vérification `python3 -m http.server 8094 --bind 127.0.0.1`. Modules neufs :
`src/domain/photo-web.js`,
`src/domain/base64.js`, `src/ui/photo-plat.js` ; la fonction `assistant` gagne son cinquième outil `image-web` (`supabase/functions/assistant/`, une
seule boucle de redirections partagée avec `lecture-web`) ; `renderZoneCouverture` vit dans `src/ui/components.js` (R-F-12). **PAS fusionné, PAS poussé.
Aucune migration (`0006` du lot B porte déjà `image-web`), fonction `assistant` À REDÉPLOYER après la clôture (geste du chef d'orchestre, après la
`0006` collée et prouvée par Neegan), `DB_VERSION` 4.**

**Ce qui marche (prouvé par la suite, 5948/5948 sur `b65988f`, épingle 5947 ; Node 208/208 ; `--check` 0 ; `tsc` 5.6.3 `--strict` 0 ; aucun réseau,
bases jetables, `fetch` et `pickFiles` injectés).**
- **La photo du plat** sur la fiche (`src/ui/photo-plat.js`, zone « Photo du plat » = la zone de couverture des livres, figure de tête, «
  Photographier »,
  « Choisir une image », « Retirer ») ; `recipes.photo_sha256` pointeur souple vers `files`, `photo_origin` (`PHOTO_ORIGINS`), toute écriture par `repo`
  après relecture de la fiche (I-F1, D-F16 : ★ Favori et « Corriger » relus ; recensement : aucun autre écrivain par copie).
- **Le rapatriement par la fonction** (`image-web`, D-F3 : deux appels par recette web, annoncés ; `lireImageWeb`, base64 borné à 2 Mio, type lu dans la
  signature des octets, `https` seul, hôtes refusés et redirections bornées comme `lecture-web`) : « Récupération… », « Image de la page {site} »,
  échec dit en une ligne, « Réessayer » avec son coût, « Ne pas récupérer » ; une photo choisie n'est jamais remplacée par une image du web.
- **Les cartes illustrées** (`vignettePlat`, `recipeCard`, repas) : vignette 72 px à droite quand la photo est là, rien sinon ; URL de blob révoquées au
  redessin ; une lecture `files` par carte (limite § 11).
- **Import web → rapatriement** (`import-web.js` : annonce sur `lu`, `enregistrerLecture` déclenche sur `fiche.signet.id`) ; « Corriger » relu avant
  d'écrire (D-F16).
- **Filets** : `MODULES_NEUFS` / `CHAINES_NEUVES_AILLEURS`, `SHELL` + les trois modules, quinze pins à `0.15.0`, `OUTILS` = `OUTILS_0006` (cinq outils,
  R-F-9), tests Node de la fonction (208/208), `tsc` 0, aucun cycle d'imports (R-F-12).
- **Vague finale** (`b65988f`, revue finale de branche : 2 Important, 9 Minor ; R-F-21) : l'en-tête JPEG lu comme libjpeg (un faux SOF caché ne
  contourne plus le mur ≤ 16 Mpx), `TYPE_JSONLD` linéaire (page hostile de 2 Mio lue en 84 ms au lieu de 3,5 s), image de page dégénérée écartée et
  repli sur `og:image` quand l'image JSON-LD est refusée, garde « page de liste » élargie, « Enregistrer » écrit la fiche dans la transaction (une
  fiche supprimée n'est plus ressuscitée), zone sans « Récupération… » après une photo choisie, faux-vert « Réessayer hors ligne » fermé ; re-revue
  PROPRE.

**Ce qui n'est PAS prouvé.** Aucune image réelle rapatriée (§ 10 : sondes S-F1 à S-F5 après le redéploiement, première photo web réelle, durée en
réseau mobile, 403 anti-hotlink réel) ; la fonction n'est PAS redéployée ; Safari et iPhone (appareil photo, « Choisir une image », VoiceOver) ; deux
appareils (« Télécharger » en tête).

**Dettes (assumées ; détail en spec § 12 et § 13).** Mutants (R-F-24) : T1 19+1, T2 18, T4 12, T5 78, vague 22, tous rouges ; équivalents nommés
(quatre redondances de T1, deux de T3) ; négatives « cartes » = limite R-F-10 ; tests de temps du lot B joués seuls. Dettes de code (R-F-25) : `HASH`
double `HASH_FICHIER` ; commentaires périmés d'`index.ts` ; `PROFONDEUR_IMAGE` et le rognage d'`og:image` non épinglés ; `r.redirected` pour
`image-web` tenu par un test de source ; test de borne « 2 Mio de `<meta` » creux (son jumeau tient) ; une vue détachée sans avis jusqu'au prochain
montage ; une lecture `files` par carte ; autres champs de la fiche depuis la copie du rendu (C4, R-B-27) ; rien sous le vrai Deno, Safari, iPhone,
ImageIO. Limites (§ 11, R-F-26) : descente déjà en vol → essai annoncé abandonné sans phrase ; fiche supprimée entre relecture et « Enregistrer » →
refus `inconnu` ; JPEG corrompu refusé ; Recipe sans image avec vignette liée → pas d'`og:image` ; résidu SSRF de R-B-21 (R-F-19). Les trois choix de
la spec § 13 restent à toi (rapatriement automatique, vignette 72 px, place de la section) : le lot a construit les défauts.

**Gestes, dans l'ordre.** 1) Les lots A, B, G, C, D puis E d'abord (leurs sections). 2) **Rien à coller pour F** : la `0006` du lot B porte déjà
`image-web` ; le chef d'orchestre relit le verdict 2.031 dans `supabase/proofs/RESULTATS-mitsu.md`. 3) **Redéploiement de la fonction `assistant`**
(geste du chef d'orchestre, CLI 2.121.0 extraite, `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api`),
version et empreinte consignées dans « Sondes `image-web` » de `RESULTATS-mitsu.md` ; sondes sans dépense S-F1 (`http://` → 422 `interdit`),
S-F2 (`https://127.0.0.1/i.jpg` → 422), S-F3 (sans jeton → 401), S1-S9 et S13-S16 rejouées ; puis les deux sondes PAYANTES d'un appel chacune, zéro
jeton (S-F4 une image `https` publique vérifiée par `curl -sI`, S-F5 une page HTML → 422 `pas_une_image`) — avec la session de Neegan lue comme au
README, dépense dite à chaque pas. 4) `! git -C ~/projects/mistu merge --ff-only plats-en-images` (après E), puis **un** `! git -C ~/projects/mistu
push origin main` ; suite publique `https://neegans.github.io/mistu/tests/` → `5948/5948` (épingle 5947 ; plus le 404 de `/favicon.ico`), service worker
`cuisine-os-v0.15.0-9`. 5) **Preuve § 10 sur le site public** (Neegan, connecté) : première photo web réelle (deux appels : la lecture puis l'image ;
« Récupération… »,
l'image en tête avec « Image de la page {site} », journal `lecture-web` 200 puis `image-web` 200, durée depuis l'iPhone en réseau mobile, vignettes
dans « Liens web gardés », la recherche et un repas) ; un échec dit ; la fiche sans dépense (« Photographier », « Choisir une image », « Retirer » lu
par VoiceOver) ; deux appareils. 6) Tous les appareils sur 0.15.0 avant la première photo web d'une bibliothèque partagée (R-C-32). 7) Trancher, s'il
le veut, les trois points de la spec § 13 (rapatriement automatique, vignette 72 px, place de la section) : le lot construit les défauts. 8) « clean »
seulement après la copie du registre.

**Versions.** `APP_VERSION 0.15.0` (E : 0.14.0) ; `sw.js` `cuisine-os-v0.15.0-1` (T2) … `-8` (ronde 1 de T5), **`-9`** (vague finale) ; chaque commit
qui touche `src/` incrémente (R-B-24) ; la tâche 1 (serveur) ne
porte aucune version ; `SHELL` + `./src/domain/photo-web.js`, `./src/domain/base64.js`, `./src/ui/photo-plat.js` ; `DB_VERSION` 4 inchangée.

**Bilan.** Départ sur `35fb29c` (mesure = E : 5681/5681, épingle 5680, Node 174) ; rejeu du plan par intention (EI-1 à EI-7, D-1 à D-3, A-1 à A-11 →
R-F-12 à R-F-18) ; cinq tâches, chacune revue à trois lentilles avec une ronde et une re-revue PROPRE : T1 `2da429d`/`66c6eb4` (serveur, Node 203,
`tsc` 0), T2 `a2cafe0`/`68ce8fb` (5739 → 5751), T3 `09af72c`/`7cb1145` (5840 → 5860), T4 `d0d3161`/`58aa0c1` (5877 → 5882), T5 `a3b55c8`/`fb3b30c`
(5921 → 5936) ; revue finale de branche (2 Important, 9 Minor), vague `b65988f` (5948/5948, épingle 5947, 22 mutants rouges), re-revue PROPRE ; suite
5681 → **5948/5948** (épingle **5947**), Node 174 → 208/208, `--check` 0, `tsc` 0 ; clôture du chef d'orchestre : rulings R-F-19 à R-F-29, `/verify`
VERT (`verify-F-b65988f.txt`), registre copié.

### Aperçus des résultats web : l'outil `apercu-web`, `0007`, vignettes et ligne d'état de l'onglet Web (23-26 octobre 2026, lot UI-2)

**Pour toi.** Dans l'onglet Web, chaque résultat vient avec la photo de la page quand le site en publie une : juste après les liens, une ligne
« Photos en cours de récupération… », puis les photos arrivent d'un coup en tête des cartes (en grand : 4:3, toute la largeur de la carte) ; sans
photo nulle part, « Photos indisponibles pour cette recherche. » ; quota atteint, « Quota du jour atteint : photos indisponibles. ». C'est un second
appel de ton quota par recherche (deux au lieu d'un, dit avant la tape : « Une recherche = 2 appels à l’assistant (résultats, puis photos), comptés
dans ton quota du jour. »), zéro jeton, et jamais une page ni une image chargée depuis ton appareil : c'est la fonction qui télécharge, avec ses
hôtes refusés, ses redirections bornées et son `User-Agent`. Dans un même onglet, « Chercher à nouveau » ne repaie que les adresses neuves ; après
une panne, un simple redessin ne redemande rien, une nouvelle recherche redemande (deux onglets ou deux appareils paient chacun leurs photos).
Seules les adresses `https` sans identifiants partent. Rien n'est écrit dans ta
bibliothèque. Rien n'arrive sur le site public avant `0007` (collée et prouvée par toi), le redéploiement de la fonction (chef d'orchestre), la
fusion et le `push` ; **aucun aperçu réel n'a encore été rendu**.

**Où.** Branche `apercus-web`, worktree `~/projects/mistu-apercus` (jamais `~/projects/mistu`), serveur de vérification
`python3 -m http.server 8095 --bind 127.0.0.1` (suite : `node .superpowers/sdd/2026-10-23-apercus-web/suite.cjs 8095`). Base `f3672be` = `main`
`05c751f` + la spec « expérience carnet » (rév. 1 `0346a3b`, rév. 2 `20aa2fc`, rév. 2.1 `7633675`) + le « Go » de Neegan du 23 octobre (`f3672be`,
§ 13 : les sept défauts confirmés, dont les aperçus AUTOMATIQUES, D-UI-13). Spec : `docs/superpowers/specs/2026-10-23-experience-carnet-design.md`
(volet UI-2 : D-UI-12 à D-UI-14, I-UI-2, I-UI-5 à I-UI-7, § 4.6, § 6, § 7, § 10, § 11 ; § 12 sous-titre « Construction de UI-2 » : rulings de plan
P-UI2-1 à P-UI2-23, rulings du chef R-UI2-1 à R-UI2-17, écarts de construction E-UI2-1 à E-UI2-22). Plan : `docs/superpowers/plans/2026-10-23-apercus-web.md`
(rév. 2, commis `daca8b3`, la base des tâches). Registre, hors git : `.superpowers/sdd/2026-10-23-apercus-web/` (`progress.md`, un brief et un
rapport par tâche, `cloture.md`, `suite.cjs`). Les rulings du chef R-UI2-1 à R-UI2-17 (25 octobre, en tête des briefs) priment sur le plan : P-UI2-6
et P-UI2-7 sont amendés, P-UI2-10 renversé (voir « Ce qui marche »). Trois tâches : S1 serveur (`654e63d` puis sa ronde `c8b07f5`), S2 client
(`a1720bc` puis sa ronde `16dd810`), S3 docs (`99855cd` puis sa ronde 1, docs seuls) ; implémenteur Claude Fable 5.1 pour S1, S2 et leurs rondes, Claude Opus 5.5 pour S3 (la
limite de dépense mensuelle de Fable 5.1 a été atteinte dans la nuit du 25 au 26 octobre). Le volet UI-1 « Carnet » (thème, grille, fiches, icônes)
est l'autre branche, `experience-carnet`, sur la même base, en construction. **`/verify` VERT le 26 octobre (`ecfc19b`) ; FUSIONNÉ dans `main` et POUSSÉ le 27 octobre, AVANT `0007` (autorisation de Neegan, R-UI2-20 :
la version 4 refuse l'outil en 400 `requete` avant toute réservation, l'onglet Web dit « Photos indisponibles pour cette recherche. ») ; `0007` PAS collée,
fonction `assistant` PAS redéployée** (la version 4 du 23 octobre sert toujours : le chemin `apercu-web` n'existe pas encore sur `mitsu`).

**Ce qui marche, prouvé** (suite navigateur : `fetch` injecté, `chercher` et `apercus` factices, images fabriquées par canvas, aucun réseau, aucune
base ; tests Node : faux `Deno`, faux supabase-js, faux `fetch`, minuteries simulées ; **aucun appel réel, aucune sonde, fonction non redéployée**) :
- **Serveur** (`supabase/functions/assistant/`, sixième outil `apercu-web`, `OUTILS` = `OUTILS_0007`, sans modèle : `OUTILS_MODELE` inchangé) :
  `lireDemande` lit `{ urls }` (1 à 5 chaînes de 2 048 unités au plus, sinon 400 `requete` sans réservation, R-UI2-1), valide CHAQUE adresse par
  `valideAdresse` AVANT la réservation (`href` null = `interdit`), refuse 422 `interdit` sans réservation si aucune n'est admise ; `traiter` fait UNE
  réservation pour les cinq, pose un `AbortController` de 60 s (`LIMITES_APERCU.budgetMs`) relayé à chaque `suivreRedirections` et levé par le client
  parti (499, appel compté, même parti pendant la réservation), dédoublonne pour le TÉLÉCHARGEMENT seulement, lance `apercuDe` à deux adresses à la
  fois (`PARALLELISME_APERCU`, `enParallele` : résultats rangés à l'index de leur adresse) : `telechargerPage` → `lirePageHtml(...).page.image_url` (LA
  règle de F) → `telechargerImage(…, { max: LIMITES_APERCU.image })` (1 Mio ; le défaut d'`image-web` reste 2 Mio) → base64 dès réception ;
  `hotesRefuses` relayé aux trois (page, lecture, image) ; rend `{ apercus: [{ url (la chaîne reçue, dans l'ordre), image: { type, taille, octets } |
  null, raison: null | interdit | inaccessible | pas_de_recette | pas_d_image | image_trop_lourde | delai }] }`, une seule clé, jamais un corps
  d'erreur ; table des raisons par entrée `RAISON_PAGE` / `RAISON_IMAGE` (R-UI2-2) ; journal `apercu-web` 200 (499), jetons `null`.
  `0007_apercu_web.sql` (à la main : `drop` puis `add` de `assistant_journal_outil_check` à six valeurs, une transaction ; `shasum -a 256` =
  `70168ef8…`) et sa preuve (11 verdicts : 1.01 à six valeurs, 2.032 « 2.03 ter » `apercu-web`, 3.01 les cinq anciens ; BILAN attendu `0 faux sur 11`, avec un
  compte dans `auth.users` : sans compte, six verdicts sont sautés, `ok` NUL, et comptent comme faux depuis la vague finale — le BILAN ne peut plus être vert
  sans compte ; `f072ccce…`, était `312b9d6f…`) ; README étape 13 ; RESULTATS : « Preuve `0007_apercu_web.sql` — à jouer » et « Sondes `apercu-web` — à jouer (après `0007` et le
  redéploiement) » (S-A1 à S-A7) ; générateur « la 0008 à venir ». Tests Node : logique (OUTILS, LIMITES_APERCU, formes, validation par adresse,
  journal), index v1 à v9 plus v4 bis, v8 bis et v8 ter de la ronde (refus avant réservation, nominal, dédoublonnage, raisons par adresse, les trois
  relais de `hotesRefuses` vers l'hôte du projet, borne 1 Mio et cinq images sous 8 Mio, parallélisme 2, budget 60 s en vol et jamais commencée, 499
  avant le premier fetch et pendant l'image, 502 sur `0007` absente et 429 ; v2 affirme la longueur exacte du base64 et qu'aucune minuterie ne survit
  à la réponse), générateur (`0007`, preuve, README 13, RESULTATS, « 0008 », `OUTILS` = `OUTILS_0007`, `index.ts` UI-2 : `apercuDe` après `traiter`, N-1).
- **Domaine client** (`src/domain/apercu-web.js`, neuf ; `src/core/image.js`) : `lireApercusWeb({ urls, session }, { fetch, signal, tentativeMs 135 000,
  corpsMax 8 Mio })` : UN POST `{ outil: 'apercu-web', corps: { urls } }` par la passerelle (trois en-têtes, `redirect: 'error'`, `credentials: 'omit'`),
  sans session aucun fetch ; une adresse de plus de 2 048 unités n'est JAMAIS envoyée (elle vaut `interdit`, posé ici ; rien d'admis à envoyer →
  `adresse`, zéro fetch : R-UI2-1) ; le 200 est une donnée hostile : UNE clé par adresse DEMANDÉE dans l'ordre (absente → `illisible`, non demandée
  ignorée, la première entrée gagne), type dans la liste des couvertures (`COVER_INPUT_MIME`, R-UI2-15), taille bornée à 1 Mio AVANT tout décodage,
  base64 relu à la longueur exacte (`lireOctetsBase64`), puis LE mur de F sans ré-encodage (`preparerPhotoDistante(blob, { coteMin, reencoder: false })` :
  en-tête du même type que l'annonce, ≤ 16 Mpx, petit côté ≥ 200 px, `createImageBitmap` jamais appelé) sinon `image_refusee` ; décodage adresse par
  adresse ; échecs de l'appel entier classés (`quota` écrit, `trop_de_demandes`, `interdit`, `requete`, `non_connecte`, `non_admis`, `serveur`, `delai`,
  `reseau`, `interne`, `reponse_illisible`, `annule`) ; `tentativeMs` transmis à la passerelle ; ne lève jamais ; le jeton n'est dans aucun résultat.
- **Écran** (`src/ui/search.js`) : `Map(href → { blob, type } | { raison })` au niveau du module, à côté de `memoire` ; une vue CONNECTÉE qui rend un
  « trouvé » demande les adresses ABSENTES (0 appel sur la même liste ; un appel pour les trois adresses neuves sur cinq ; seules les adresses `https`
  sans identifiants, `adresseApercu`, la clé restant `lien.href` ; les entrées des liens disparus sont lâchées à chaque « trouvé » reçu, Blob compris,
  jamais sur une issue « rien » ni sur un échec ; `reinitialiserWeb()` vide tout) dans UN vol d'aperçus, abandonné par `lancer()`, « Annuler »,
  `reinitialiserWeb()`, et quand la dernière vue se déconnecte ALORS QUE la route (injectée par les tests) a quitté `/search` (ronde 1 de S2 : une reconstruction de `/search`,
  par `run()` ou `cuisineos:refresh`, laisse le vol au module et la nouvelle instance l'ADOPTE — deux appels, jamais trois) ; un résultat tardif d'un vol
  abandonné est muet ; un ÉCHEC de l'appel entier n'entre pas dans la Map : il est mémorisé pour l'ISSUE affichée (`echecApercus = { issue, raison }`,
  clé = l'identité de l'objet issue), lu par la ligne d'état ; un redessin de la même issue ne redemande rien, une nouvelle issue (« Chercher à
  nouveau », nouvelle tape) redemande les adresses absentes (R-UI2-6, qui amende P-UI2-6) ; au MONTAGE d'une vue rendue détachée (retour arrière,
  reconstruction), un `MutationObserver` vérifie UNE fois si son « trouvé » a des adresses absentes et les demande (R-UI2-7, qui amende P-UI2-7 ; une
  vue pas montée au tour de boucle suivant est réputée morte) ; les figures (`figure.apercu > img.plat-vignette.grande[alt=''][decoding=async]`, en
  TÊTE des cartes qui ont l'image) sont insérées en UNE fois (un seul redessin) ; `styles.css` porte `.plat-vignette.grande` (4:3, pleine largeur, rayon
  12 px) et `figure.apercu` (marge basse), jetons seuls, aucun style en ligne (R-UI2-9, qui renverse P-UI2-10 ; l'épingle de `tests/photo-plat.js`
  compte exactement deux sélecteurs, la règle 72 px inchangée) ; URL `blob:` recréées au rendu, révoquées par `remplacerEnRevoquant` et au changement
  de route, Blob gardés ; `img.onerror` → figure retirée, URL révoquée, entrée remplacée par `image_refusee` seulement si l'URL était encore vivante
  (P-UI2-8) ; ligne d'état `p.muted[data-role=etat-apercus]` sous « Demande envoyée » dans ses trois formes (une image posée gagne sur un état mixte) ;
  texte de garde « 2 appels » ; `deps.apercus` (défaut `lireApercusWeb` ; `null` quand `deps.chercher` est injecté seul : les tests de route d'avant le
  lot n'appellent rien) ; `deps.routeCourante`, injectée par TOUS les tests (son défaut, `currentPath` du routeur, n'est pas éprouvé : voir « Ce qui
  n'est PAS prouvé »).
- **Filets** : `MODULES_NEUFS` + `apercu-web.js`, `SHELL` + `./src/domain/apercu-web.js`, les quatre clés de § 5 dans `en.js` et l'ancienne garde
  retirée, test de source I-F3 étendu à `search.js` et `library.js` (S-16, R-UI2-5), épingle de `tests/photo-plat.js` à deux sélecteurs (R-UI2-9),
  `Anthropic|Supabase` absent du domaine, 15 lignes de pins à `0.16.0` (R-UI2-12) ; `tests/apercu-web.js` neuf (127 assertions, mesurées : 105 à la
  tâche, 22 à sa ronde ; le « 108 » du rapport de S2 en comptait trois écrites dans d'autres fichiers).

**Ce qui n'est PAS prouvé.** **`0007` et sa preuve** : jamais jouées sur `mitsu` (et, pglast étant absent de ce Mac, R-UI2-11, leur syntaxe n'est
vérifiée que par les tests de texte : le collage de Neegan est la preuve). **Le chemin `apercu-web` sous le vrai runtime** : la fonction n'est pas
redéployée ; S-A1 à S-A7 n'ont pas été jouées — la taille réelle de la réponse (K-5), la durée totale, le compte d'`image_trop_lourde` sur
« puttanesca » (décide si la borne passe de 1 à 2 Mio, B-M-6, R-UI2-4), la mémoire et le CPU de l'isolat au parallélisme 2 (« cinq pages hostiles de
2 Mio », S-A7, qui sera consignée « non jouée » à la Clôture s'il n'existe pas d'hôte public contrôlé, R-UI2-14), le 499 d'un client parti. **Aucun aperçu réel** dans l'app (preuve
§ 10 UI-2 : geste de Neegan après le push). **Le chemin `search.js` → `lireApercusWeb` de bout en bout** : prouvé depuis la vague finale par un
test qui monte l'écran SANS `deps.chercher` ni `deps.apercus` (faux `fetch` global : deux POST, `recherche-web` puis `apercu-web`, deux figures ; le
mutant « `apercus: apercusFn = null` » rougit), mais contre un faux `fetch` seulement. **La garde du vol par la route** : son défaut `currentPath` est
éprouvé depuis la vague finale (la route pilotée par `history.replaceState`, sans `deps.routeCourante` : les mutants R1 `() => '/'` et R1b
`() => '/search'` rougissent) ; l'ordre d'`app.js` (le hash change avant `replace(main, « Chargement… »)`, qui déconnecte la vue) reste lu dans le
source seulement (`app.js` hors suite). **Safari et l'iPhone** :
rien (une réponse de 7 Mio lue en texte puis décodée adresse par adresse ; cinq images décodées à leur taille pleine, jusqu'à 16 Mpx chacune :
`decoding="async"` déplace le décodage, il ne réduit pas la mémoire de pic ; l'`OffscreenCanvas` des tests n'est pas l'appareil). Le rendu de la
figure (4:3, pleine largeur) n'est vu par aucune preuve visuelle : seules les déclarations de la feuille sont épinglées (UI-1 habillera la carte).
**La re-revue de la ronde 1 de S2** (`16dd810`) n'était pas faite à l'écriture de ces documents (`progress.md`, 26 octobre : relancée par le chef
d'orchestre). Les tests sensibles au temps (v7 (b), v2 sur `process.getActiveResourcesInfo()`, les `attendre` de l'`onerror`, `portionsDe` du lot B
sous charge) : un rouge se rejoue avant d'être un constat (R-B-15, R-UI2-10).

**Dettes et limites (assumées, une ligne chacune ; spec § 11 UI-2 et § 12 sous-titre UI-2).**
- R-UI2-6 : l'échec de l'appel entier vit dans UN emplacement (`echecApercus`), pour l'issue affichée ; la clé est l'identité de l'objet issue, pas la
  `cle` de la demande (le même texte relancé donne la même `cle`) ; une `WeakMap` par issue a été refusée (M-6 : deux issues en échec à la fois sont
  inatteignables, `memoire` étant elle-même un emplacement unique).
- Mémoire des aperçus PAR DOCUMENT (la Map et `echecApercus` vivent dans le module de `search.js`, comme le vol de la recherche, V-S4) : deux onglets
  ou deux appareils paient chacun l'appel d'aperçus des mêmes liens.
- R-UI2-7 : le montage doit suivre le rendu dans la microtâche (le seul appelant, `app.js`, fait ainsi) ; une vue montée plus tard est réputée morte et
  son montage ne demande rien (une tape de plus pour les photos) — à ratifier.
- Garde du vol par la route (ronde 1 de S2) : « quitter la recherche » = la route a quitté `/search` ; un changement de MODE sur `/search` (Web → Mes
  recettes) pendant un vol le laisse finir (réservation faite : zéro appel de plus, au plus 60 s de serveur, le résultat attend dans la Map le retour
  en mode Web) — à ratifier.
- R-UI2-8 : après toute tape qui interrompt un vol d'aperçus puis « Annuler », le « trouvé » redessiné repose un vol (un appel de plus), à une vue
  comme à deux.
- R-UI2-1 : côté serveur, une chaîne de plus de 2 048 unités refuse tout l'appel (400) ; le client l'écarte avant (elle vaut `interdit`) ; si aucune
  adresse n'est admise à l'envoi : `adresse`, zéro fetch (cas limite tranché par S2).
- R-UI2-2 : la table des raisons par entrée est diagnostique (aucune raison affichée par carte) ; écart nommé (ronde 1 de S1, constats 3 et 13, à la
  décision du chef) : `apercuDe` dit `pas_d_image` dès que la page porte une `Recipe` lisible sans image et `jsonld.autres === 0`, alors que la garde
  « page de liste » de F compte `max(autres, Recipe − 1)` : une page de liste dont les vignettes sont des `Recipe` illisibles peut lire `pas_d_image`
  au lieu de `pas_de_recette` (remède : une ligne de `lecture-web.js`, lot F).
- La borne de pixels d'un aperçu (`pixelsMax` sous 16 Mpx, miroir serveur) : décision de Neegan OUVERTE (ronde 1 de S2, M-11 ; revue finale) — le
  plafond d'1 Mio ne borne pas la mémoire décodée : un PNG uni de 4 000 × 4 000 tient en ≈ 50 Kio, cinq figures gardent ≈ 5 × 64 Mio de bitmaps tant que
  la vue vit ; voie 1 : un `pixelsMax` propre aux aperçus (≈ 4 Mpx : une figure 4:3 pleine largeur demande ≈ 1,3 Mpx à DPR 3 sur 430 px) ; voie 2 : le
  risque accepté, chiffre à l'appui (spec § 11).
- Revue finale : sans ré-encodage, plus aucun décodage ne tranche avant le navigateur ; `structureRefusee` (`src/core/image.js`) refuse SANS décodage une
  image ANIMÉE (APNG : `acTL` avant le premier `IDAT` ; WebP : VP8X au drapeau 0x02) ou TRONQUÉE (PNG sans `IEND` final, JPEG sans FF D9 dans ses 16
  derniers octets, WebP dont la taille RIFF dépasse le fichier) → `image_refusee` ; un PNG dont le premier `IDAT` est au-delà des 256 Kio lus est refusé
  aussi (faux refus possible : des métadonnées énormes avant l'image) ; le même refus côté serveur (`apercuDe`) n'est PAS fait : ces octets transitent
  jusqu'au client, qui les refuse.
- Revue finale : quitter `/search` pendant le vol d'aperçus l'abandonne (499 compté : la réservation précède les téléchargements), et le RETOUR sur
  `/search` repaie les adresses abandonnées (un appel de plus, sans geste annoncé) ; l'abandon économise au plus 60 s de téléchargements serveur et jusqu'à
  7 Mio de réponse sur le réseau de l'appareil. Garder le vol envoyé (l'option préférée de la revue) change S-4 (§ 4.6) : décision de spec ouverte.
- Revue finale : aucun vol d'aperçus pendant une RECHERCHE en vol (l'ancien « trouvé » affiché en K1 après un geste de filtre va être remplacé) ; un
  « trouvé » sans aucune adresse https demandable ne pose ni demande ni ligne d'état (« rien tant que rien n'a été demandé », épinglé ; « indisponibles »
  serait l'autre lecture de § 4.6, à ratifier par le chef) ; quand TOUTES les figures tombent en `error`, la dernière redessine une fois et la ligne dit
  « Photos indisponibles pour cette recherche. ».
- Quota : 2 appels par recherche illustrée (30 par jour) ; vie privée : jusqu'à 10 téléchargements par recherche, soit au plus 40 requêtes signées
  `Mitsu/0.10 (+https://neegans.github.io/mistu/)` en comptant les redirections (3 sauts par page et par image : 4 requêtes chacune), vers des
  pages et des hôtes que la personne n'a pas choisis (§ 11, qui dit « 10 requêtes » : écart signalé au § 12 ; renversable vers une tape « Voir les
  photos (1 appel) », § 13 point 2) ;
  amplification : un appel du quota achète jusqu'à 10 téléchargements (15 Mio, 60 s), mêmes règles SSRF que B et F (résidu R-B-21).
- Une image au-delà de 1 Mio manque en silence (`image_trop_lourde`) ; une page sans `Recipe` ni `og:image` n'a pas d'aperçu ; un 403 anti-hotlink
  rend `inaccessible` ; deux copies de la borne 1 Mio (serveur `LIMITES_APERCU.image`, client `LIMITES_APERCU_WEB.octets`, plus le littéral `BORNE` du
  bloc « corpsMax » des tests), à bouger ensemble (R-UI2-4) ; `apercuDe` et `enParallele` déclarées après `traiter` (N-1, R-UI2-3) ; les figures
  arrivent 20 à 90 s après les résultats, en une fois (la liste descend d'un coup).
- Mutants : S1 21 rouges sur 21, sa ronde 9 mutants en 10 passages (8 rouges, MG équivalent) ; S2 33 rouges sur 33, sa ronde 14 passages (13 rouges,
  `X2b-figure` équivalent) ; équivalents déclarés : MG (le `catch` défensif d'`apercuDe`, non injectable depuis le harnais) et `X2b-figure` (le second
  mur de `figureApercu`, défense en profondeur sans chemin : la Map n'est écrite que par le `.then` filtré) ; revue de la tâche 3 (copies) : N6 (la
  garde d'entrée `if (signal.aborted)` d'`apercuDe` retirée : harnais 67/67) déclaré équivalent — « jamais commencée → `delai` sans fetch » (v7 (b))
  tient par le `fetch` qui refuse un signal déjà levé (contrat du runtime, que le faux `fetch` du harnais imite), la garde est une défense en
  profondeur ; R1 et R1b (le défaut de `deps.routeCourante` changé), survivants à la revue de S3, sont tués depuis la vague finale ; vague finale : 19
  mutants sur copies (17 navigateur, 2 Node) : 18 rouges, M2 (l'élagage de défense après l'écriture) équivalent déclaré.

**Gestes, dans l'ordre (dépense dite à chaque pas).** 0) **Chef d'orchestre, d'abord — FAIT le 26 octobre** (`cloture.md` du registre ; `/verify` VERT, `verify-UI2-ecfc19b.txt` ; spec § 12, R-UI2-18 à R-UI2-24) : re-revue de la ronde 1 de
S2 (`16dd810`), revue finale de branche et ses rondes, puis `/verify` sur la tête finale (« vert conditionnel » : vert du code, rouge nommé du
déploiement tant que `0007` n'est pas collée), AVANT `0007` et AVANT tout redéploiement ; une ronde qui touche le code change les mesures de cette
section (à relever). 1) **Neegan, `0007` après le geste 0, AVANT le redéploiement** (le `push` l'a précédé, R-UI2-20) (`supabase/README.md`, étape 13) :
coller `supabase/migrations/0007_apercu_web.sql` entière (attendu `Success. No rows returned`), relever
`shasum -a 256 supabase/migrations/0007_apercu_web.sql` (attendu `70168ef8…`), jouer `supabase/proofs/0007_apercu_web.sql` (« Run without RLS », rien à
remplacer) : `999 BILAN` = `0 faux sur 11`, AUCUNE ligne dont l'obtenu est « aucun compte : etape sautee » (sans compte dans `auth.users`, six
verdicts sont sautés, `ok` nul, et le BILAN dit `6 faux sur 11` depuis la vague finale) et 2.032 qui lit `id non nul` ; tableau collé dans `RESULTATS-mitsu.md`, section « Preuve
`0007_apercu_web.sql` — à jouer » ; la preuve `0006` devient historique (son 1.01 rougit, voulu). Sans dépense. 2) **Chef d'orchestre, après le
geste 1** (BILAN et 2.032 relus) : redéploiement `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api`
depuis le worktree, À LA TÊTE VÉRIFIÉE au geste 0 (version 5 attendue ; version et `ezbr_sha256` dans « Sondes `apercu-web` ») ; **recul** :
redéployer la version 4 depuis `0c7cbbd` (`lecture-web` + `image-web`, le code d'avant UI-2) ; sondes sans dépense S-A1, S-A2, S-A4, S1-S9, S13-S16,
S19, S-F1 à S-F3 et le `GET` d'état ; puis, un appel du quota chacune et zéro jeton : S17 et S18 (lot B, R-B-14), S-F4 (lot F : le succès
d'`image-web`, à reprouver sur la version 5, README étape 13 point 5), S-A3, S-A5 (« puttanesca »), S-A6 (page de liste), S-A7 (cinq pages hostiles,
si un hôte public contrôlé existe ; sinon « non jouée », R-UI2-14) ; la session de Neegan par le script d'attente du presse-papiers, jamais dans une
commande. Si S-A5 compte des `image_trop_lourde` : ronde « borne 2 Mio » (les deux constantes, le littéral `BORNE`, v5, le test du domaine) AVANT la
fusion, puis `/verify` et redéploiement de sa tête. 3) **FAIT le 27 octobre par le chef d'orchestre, AVANT `0007` (R-UI2-20)** : `git -C ~/projects/mistu merge --ff-only apercus-web` si
`main` est encore `05c751f` (avance rapide : suite publique `6097/6097`, épingle 6096, service worker `cuisine-os-v0.16.0-3`, ou les valeurs d'une
ronde ultérieure) ; sinon, UI-1 fusionné d'abord : un commit de fusion qui résout `sw.js` (union de `SHELL`, `VERSION` +1), `src/model/schema.js` et
les pins, `src/i18n/en.js` (union), `styles.css` (les règles `.plat-vignette.grande` et `figure.apercu` à côté de `.plat-vignette.petite`, épingle de
`tests/photo-plat.js` à trois sélecteurs), `tests/tests.js` (épingle remesurée) — spec § 9 — et où UI-2 est renuméroté `0.17.0` (I-UI-7 :
`schema.js`, les 15 pins, `sw.js`), total, épingle et `VERSION` remesurés sur l'arbre fusionné ; puis `! git -C ~/projects/mistu push origin main` ;
suite publique `https://neegans.github.io/mistu/tests/` → le total mesuré (plus le 404 de `/favicon.ico`). 4) **Preuve § 10 UI-2 sur le site public**,
connecté : « puttanesca » dans l'onglet Web → « Photos en cours de récupération… » puis des photos en tête des cartes, posées d'un coup ;
`select jour, appels from public.assistant_usage_jour;` : +2 par recherche ; `select outil, statut, jetons_entree, jetons_sortie, duree_ms from
public.assistant_journal order by id desc limit 2;` : une ligne `recherche-web` puis une ligne `apercu-web` ; « Chercher à nouveau » → au plus un appel
de plus ; une recherche dont les sites n'ont pas d'image → « Photos indisponibles pour cette recherche. ». 5) Tous les appareils sur 0.16.0 avant la
première recherche illustrée d'une bibliothèque partagée (0.17.0 si UI-1 a fusionné d'abord ; rien n'est écrit par ce lot : règle de confort,
R-C-32). 6) iPhone : le même parcours depuis l'app installée (durée en réseau mobile). 7) Décisions ouvertes, sans urgence — à ratifier par le chef
d'orchestre : E-UI2-2, E-UI2-13, E-UI2-14, E-UI2-16 ; à trancher par Neegan : la borne 1 ou 2 Mio (B-M-6), `PARALLELISME_APERCU` (S-2), le mode
automatique ou la tape « Voir les photos (1 appel) » (§ 13 point 2), la borne de pixels d'un aperçu, R-UI2-8. 8) « clean » seulement après la copie
du registre dans `~/projects/mistu/.superpowers/sdd/` (serveur 8095 arrêté, worktree `mistu-apercus` retiré ; la branche `experience-carnet` reste :
UI-1).

**Versions.** `APP_VERSION 0.16.0` (F : 0.15.0 ; I-UI-7 : le premier lot UI fusionné porte 0.16.0, le second 0.17.0) ; `sw.js`
`cuisine-os-v0.16.0-1` (tâche 2), `-2` (sa ronde 1), `-3` (vague finale), +1 par commit qui touche `src/`, `styles.css`, `index.html` ou `sw.js` (rondes comprises, R-B-24) ; `SHELL` +
`./src/domain/apercu-web.js` ; `DB_VERSION` 4 inchangée ; la migration `0007` est côté serveur, écrite à la main (hors `NOMS` et `--check`, comme
`0004` et `0006`) ; CSP inchangée (`img-src 'self' blob: data:` : aucune image externe chargée par le navigateur).

**Bilan.** Départ sur `daca8b3` (`f3672be` + le plan ; mesure = F : 5948/5948, épingle 5947, Node 208/208, `--check` 0, `tsc` 0) ; tâche 1 (serveur)
`654e63d` : Node 208 → 227/227, `tsc` 0, `--check` 0, suite inchangée, 21 mutants rouges sur 21 ; revue à trois lentilles (2 Important, 13 Minor) →
ronde 1 `c8b07f5` : Node 230/230 (v4 bis, v8 bis, v8 ter), 9 mutants (8 rouges, MG équivalent), re-revue PROPRE ; tâche 2 (client) `a1720bc` : suite
5948 → 6058/6058 (épingle 6057 ; +20 sur l'attendu 6037 du plan : les assertions des rulings R-UI2-1, R-UI2-6, R-UI2-7 et R-UI2-9), Node 230 inchangé,
33 mutants rouges sur 33 ; revue à trois lentilles (5 Important, 11 Minor) → ronde 1 `16dd810` : suite 6080/6080 (épingle 6079, +22), `sw.js -2`,
14 passages (13 rouges, `X2b-figure` équivalent), M-6 refusé ; sa re-revue : non faite à l'écriture ; tâche 3 : ces documents (`99855cd`), revue à
trois lentilles (2 Important, 13 Minor) → ronde 1 (docs seuls : ordre des gestes, garde par la route dite non prouvée, compte d'assertions remesuré,
N6 équivalent, une liste de décisions ; suite, Node et `--check` rejoués, inchangés). Mesure relue à la tête
`16dd810` par la tâche 3 (26 octobre) : suite `✅ 6080/6080` (épingle `tests/tests.js:255` = 6079 ; seule erreur console le 404 de `/favicon.ico`),
Node 230/230, `--check` 0, `tsc` 0. Revue finale de branche (4 Important, 9 Minor) → **vague finale** (26 octobre, Claude Opus 5.5, rapport
`final-fix-report.md` ; spec § 12, VF-UI2-1 à VF-UI2-13) : garde `vol` de `demanderApercus` (aucun vol d'aperçus pendant une recherche en vol, élagage
de défense après l'écriture), mur sans décodage des images animées ou tronquées, test du branchement par défaut (P4), test de la vraie route (R1, R1b,
retour qui repaie), redessin quand toutes les figures tombent, assertions synchrones `enVol`, ligne d'un « trouvé » sans adresse https épinglée,
preuve `0007` sans compte jamais verte (`ok` nul) et README / RESULTATS qui le disent, trois tests de source hors liste retirés ; refusés, dits :
la borne de pixels (décision de Neegan), garder le vol envoyé au changement de route (décision de spec, S-4), le refus côté serveur des images animées.
Suite `✅ 6097/6097` (épingle 6096, +17), seule erreur console le 404 de `/favicon.ico` ; Node 230/230 (sous une charge machine de 26 à 290, venue
d'autres sessions, les bornes de temps des lots B et F — `portionsDe`, « borne temporelle (S-4) », `imageOgDe` — rougissent ; rejouées seules : vertes,
R-B-15) ; mutants : 19 sur copies, 18 rouges, M2 équivalent ; `--check` 0 ; `sw.js cuisine-os-v0.16.0-3` ; rouge d'abord lu (`❌ 6086/6096`).
`/verify` de clôture : au chef d'orchestre.

### Expérience « carnet » : olive, grands titres, cartes-plat, bibliothèque sur les recettes (23-28 octobre 2026, lot UI-1)

**Pour toi.** L'app prend l'allure des maquettes sans changer un seul geste : papier crème, l'olive pour tout ce qui se touche (boutons pleins,
liens, onglet actif, anneau de focus), le vert gris gardé pour les états (« Original », ok, puce cochée), de grands titres serif, des icônes au
trait à la place des émojis de la navigation et de la page Ajouter. L'onglet « Bibliothèque » (ex-« Mes livres ») s'ouvre sur TES RECETTES en
grille : la photo quand tu l'as, un bloc de titre sinon (jamais de cadre vide), les filtres Toutes / De mes livres / Du web, « Ajouter une
recette », et en pied « Recettes de mes livres à importer » ; tes livres et tes plats sont les deux autres segments. Une fiche de recette met la
photo en regard du titre sur le Mac, en pleine largeur sur l'iPhone, puis Ingrédients et Préparation côte à côte (deux onglets sur l'iPhone) ;
« Commencer à cuisiner » reste le grand bouton, « Corriger » reste à côté tant que tu n'as pas relu, et le reste (portions, unités, versions,
« Adapter avec l'IA », repas, épicerie) se replie sous « Portions, versions et autres gestes ». Une fiche de livre montre la couverture, les
métadonnées et le sommaire à gauche, la liste compacte des recettes à droite (« Disponible », « À importer », « Importer », « Saisir à la main » sur
la ligne ; 8 lignes puis « Voir les {n} recettes » sur l'iPhone) ; ses menus s'appellent « Ajouter des recettes » et « Ajouter des pages de
sommaire ». « À importer » remplace « Repérée dans ton livre » dans les listes (la fiche garde la phrase), « Voir la page d'origine ↗ » remplace
« Ouvrir le lien ». Rien d'inventé : pas de photo sans octets, pas de durée ni de portions sans donnée, « vérifie » reste tant que tu n'as pas
relu. L'onglet Web ne change que de couleurs : les photos des résultats sont l'autre lot (UI-2, déjà fusionné et poussé le 27 octobre). Rien de ce
lot n'arrive sur le site public avant sa fusion et ton `push`.

**Où.** Branche `experience-carnet`, worktree `~/projects/mistu-carnet` (jamais `~/projects/mistu`), serveur `python3 -m http.server 8096 --bind
127.0.0.1` (suite : `http://127.0.0.1:8096/tests/`). Base : `main` `05c751f` + trois commits de docs, tête `f3672be` (spec rév. 2.1 et le « Go » de
Neegan sur les sept points de § 13). Spec : `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (rév. 2.1 ; § 0 : D-UI-1 à D-UI-14 ; § 2 :
I-UI-1 à I-UI-7 ; § 3 : jetons, typographie, composants ; § 4 : écrans ; § 5 : textes ; § 7 : tests ; § 12 « Construction UI-1 : rulings » : R-UI-P1
à P3, R-UI1-1, R-UI1-2, R-UI-1 à R-UI-60 ; § 13 : les sept défauts confirmés). Plan : `docs/superpowers/plans/2026-10-23-experience-carnet.md` (rév. 5, commis `ec0263d` ; six tâches). Registre, hors git
(`.superpowers/` exclu) : `.superpowers/sdd/2026-10-23-experience-carnet/` (`progress.md`, `cartographie.md`, les revues de la spec, un brief et un
rapport par tâche, lanceur `suite.cjs`, outil `preuve-visuelle.cjs`, `galerie.html`, `resultats*.md` / `.json`, `captures/`). Commits : T1 `8b5c6d2` + ronde `52718bd`
(jetons, `sectionPlain`, `pageHeader classeTitre`, `icones.js`, NAV « Bibliothèque », pins, `theme.js` amendé), T2 `bcb0f2a` + `a149609` (carte-plat, `grilleCartes`,
segment Recettes), T3 `bf86095` + `5b5c20b` (fiche recette), T4 `0d4b1ca` + `9411c35` (fiche livre), T5 `4c809d8` + `0fa52b4` (Aujourd'hui, Ajouter, import ciblé,
libellés), T6 `1d952fe` (filets, épingle) + `838fa41` (docs) + ronde `7c9d3f7`, vague finale `88e095a` (code et tests) et son commit de docs. **FINI, clôturé par le chef (R-UI-61 à R-UI-65), FUSIONNÉ dans `main`
par un commit de fusion et POUSSÉ le 28 octobre 2026** (arbre fusionné : suite 6375/6375, épingle 6374, Node 230/230, `--check` 0, `tsc` 0 ;
`sw.js cuisine-os-v0.17.0-11`) ; historique :
revue finale de branche faite (2 Important, 15 Minor) et sa vague (ci-dessous) ; re-revue et `/verify` : au chef d'orchestre ; fusion par un commit de fusion sur `main`, où UI-2 est déjà (`main` = `origin/main` = `1cb5dde`, 0.16.0 ; 17 fichiers en conflit, mesurés : R-UI-47, geste 2).
Fichiers du lot : `styles.css`, `index.html` (rien : `theme-color` inchangé), `sw.js` (`VERSION`, `SHELL` + `./src/ui/icones.js`), `src/app.js` (NAV),
`src/ui/icones.js` (neuf), `src/ui/components.js`, `library.js`, `recipe.js`, `book.js`, `home.js`, `add.js`, `accueil-livre.js`, `import-cible.js`,
`import-web.js`, `photo-plat.js`, `dish.js`, et par les états vides seulement `grocery.js`, `import.js`, `kitchen.js`, `meals.js`, `search.js` (un littéral,
R-UI-P1), `src/core/i18n.js` (`STATE_LABELS.availability.reference_only`, `t()` et `label()` sur clés propres), `src/i18n/en.js`, `src/model/schema.js`
(`APP_VERSION`) ; tests : `tests/carnet.js` (neuf), `tests/theme.js`, `tests/ajouter.js`, `tests/photo-plat.js`, `tests/creer-ia.js`, `tests/lecture-web.js`,
`tests/sync-l4.js`, `tests/import-cible.js`, `tests/table-matieres.js`, les pins de version (`tests/passerelle.js`, `tests/recherche-web.js`, `tests/sync-l3.js`, `tests/assistant-compte.js`,
`tests/classement.js`), `tests/tests.js`. **Aucun fichier sous `supabase/` ni `tools/`** (`git diff --stat f3672be..HEAD -- supabase/ tools/` vide), aucune
migration, aucun appel réel.

**Ce qui marche** (éprouvé par la suite — bases jetables, `matchMedia` factice, scènes hors écran, aucun réseau — et par la preuve visuelle,
Chrome sans tête, contextes jetables, données semées, jamais la bibliothèque de Neegan) :
- **Le thème** (T1, `tests/theme.js` amendé : une valeur, une paire, deux libellés) : `--action #4f6b2e`, `--action-2 #3e5424`, `--action-bg #e9eddf`,
  `--tap rgba(79,107,46,.15)` ; les 34 autres déclarations de `:root` (épinglées une à une), `theme-color` et le manifeste inchangés ; **29 paires** ≥ 4,5 (olive sur papier 5,55, sur carte
  5,95, sur `--paper-2` 5,14 — la 29e —, minimum 4,62 inchangé) ; inventaire des `display: none` = les cinq d'origine ; aucune couleur en dur ; `56px`
  sur `.btn.big` seul ; survols sous `@media (hover: hover)`.
- **Les composants** (T1, T2 ; `tests/carnet.js`) : `sectionPlain(title, ...children)` → `section.plain` (et `section()` reste `.card` : 54 appelants,
  17 modules) ; `pageHeader(…, { classeTitre })` ; `icone(nom)` → vingt-trois SVG au trait (`currentColor`, `aria-hidden`, nom inconnu → levée) ;
  `recipeCard(doc, { photoEnTete: true, fichier })` synchrone (image 4:3 quand `typeAffichage(fichier)` est une image, bloc titre sur `--paper-2`
  sinon, jamais de cadre vide, ligne « Du web · {h} · 35 min » / « De mon livre · {t} · 40 min », durée = `total_minutes`, sinon préparation + cuisson quand les DEUX sont connues : R-UI-15) ;
  `grilleCartes` 2 colonnes dès 360 px, 3 dès 900 px, bornée à 60 cartes et « Voir plus » (fixture de 70 : 60 lectures).
- **La bibliothèque** (T2) : `#/library` ouvre Recettes (`{}` → Recettes ; `?tab=books` et `?tab=dishes` restent valides) ; filtre local, puces
  calculées sur `edition_id` / `source_url`, tri par dernière modification (§ 13 point 5), signets dedans (carte sans photo, « Lien web »), références
  dehors ; « Ajouter une recette » en en-tête et sous la grille sous 760 px ; pied `?tab=a-importer` ; « Liens web gardés » et « Recettes créées
  avec l'IA » restent sous Livres, en `plain`.
- **La fiche recette** (T3) : `h1.titre-fiche`, repères dérivés (« 1 portion », rien sans durée, un seul nombre), « Voir la page d'origine ↗ » sur toute
  adresse lisible (http compris, I-B5), « Commencer à cuisiner » + « Corriger » visible tant que non vérifiée, `details[data-role=autres-gestes]`
  (tous les anciens boutons de `controls` et de la rangée, pas l'Export), `.two-col` ≥ 760 px, `segmented` Ingrédients / Préparation dessous
  (bascule par `hidden`, état dans l'instance, survit à `drawBody()`), `matchMedia` injecté dans ses deux états.
- **La fiche livre** (T4) : sous-titre « {auteur} · {éditeur} · {année} », menus renommés, `.two-col.livre` ≥ 900 px, « Sommaire », « Les recettes de ce
  livre » avec « {n} disponible(s) · {m} à importer », filtres, ligne compacte (vignette 48 px si octets, « Importer » et « Saisir à la main » seulement
  sur une référence ou une recette partielle sans adresse — règle du lot A, D-11 —, mêmes `href`), 8 lignes puis « Voir les {n} recettes » sous 900 px ; « Couverture », « Fichiers », « Pages d'index »
  restent `.card`.
- **Aujourd'hui, Ajouter, import ciblé, libellés** (T5) : `pageHeader` et `grilleCartes` sur Favoris et Dernières cuissons (date et « Refaire comme la
  dernière fois » hors du `<a>`), icônes au trait de la grille Ajouter et des états vides, « × » de retrait d'une page (≥ 44 px, même nom accessible),
  « À importer » (`availabilityBadge`, `STATE_LABELS.availability.reference_only`, compteurs, filtres) seulement pour `reference_only` sans `source_url`.
- **Les filets** (T6 et sa ronde 1, `tests/carnet.js`, 13 assertions dans le bloc T6 + 1 mesure dans le bloc T3) : les 31 textes de la table (27 de § 5
  UI-1, quatre hors table : R-UI-38) avec leur anglais exact ; les clés réemployées, dont « 1 portion » et « {n} portions » des repères (clés
  antérieures, « 1 serving » / « {n} servings » épinglés : R-UI-41) ; un inventaire CALCULÉ sur library.js, recipe.js, book.js, home.js, components.js —
  toute clé `t('…')` ou `t("…")` a son entrée `en.js`, hors 78 clés antérieures au lot figées (R-UI-45) — et `CHAINES_NEUVES_AILLEURS` à jour pour les
  textes de la table ; les emplois lus sans commentaires ; accueil-livre.js, import-web.js, import-cible.js, add.js, icones.js dans `MODULES_NEUFS` ;
  « + Recette », « + Pages d'index », « Ouvrir le lien », « Aller à Mes livres. » absentes d'`en.js`, des filets et de tout module de `SHELL` ; NAV
  « Bibliothèque » (source relu sans commentaires) ; les treize sélecteurs neufs présents comme jetons entiers, trois `.plat-vignette` ; `.reperes`
  mesuré à 1,05 rem (bloc T3). Trois assertions doublent des filets de T1 et T2 et le disent dans leur libellé (filets de clôture).
- **La preuve visuelle** (T6, rejouée par sa ronde 1 ; `preuve-visuelle.cjs 8096`, 28 octobre 2026, 05 h 42 UTC, en tête de `resultats.md`) : **VERT,
  code 0**, **70 lignes sur 70** (porte, treize routes et « bibliotheque-photos » à 375, 390, 768, 1512 ; galerie et dialogue modal ; à 320 px, les
  onglets de la galerie PUIS ceux de l'app sur `#/library`) ; `onglet` « Bibliothèque » sur une ligne sans débordement à 375, 390 et 768 dans l'app
  (actif sur les routes de la bibliothèque) et dans la galerie, à 320 dans la galerie (inactif, 68/68 px) et dans l'app (ACTIF, graisse 600, 71,8/71,8 px :
  sans aucune marge) ; contraste rendu minimum **4,62** sur **3 601** nœuds texte (`resultats.json`) ; M14 20 sur 20 (anneau olive) ; **174 captures** ;
  grille 2 colonnes à 375-768, 3 à 1512, 0 cadre vide avec 2 photos sur 10 cartes comme avec 9 ; réseau en liste blanche : **0** requête hors de
  l'origine servie. Contre-preuves : une olive pâle (`#9bb86a`) rougit la galerie (contraste), un libellé d'onglet allongé rougit la passe « etroit »
  (galerie, puis `app.js` d'une copie : seule l'app le voit, la galerie copiée reste verte), une requête vers un hôte inconnu (copie) rougit le verdict
  et nomme l'adresse. M3 (« Annuler » à droite) n'est PAS rejouée : l'app ne poste plus à `api.anthropic.com` et `search.js` n'a changé que d'un
  littéral, hors du vol (R-VIS-8 tenu par `tests/theme.js`).
- **Mutants** (copies servies à part ; comptes dans les rapports de tâche) : T1 26/26 (ronde 11/11), T2 43/43 (deux survivants tués par R-UI-8 ; ronde : 34 joués, 33 rouges, MA équivalent),
  T3 35/35 (deux survivants tués par R-UI-13, R-UI-14 ; ronde 18/18), T4 32/32 (ronde 28/28), T5 27/27 (ronde 38/38), T6 8 sur 8 (M-UI6-1 à
  M-UI6-8 ; M-UI6-6 vu rouge aussi par la preuve : `onglet KO`) ; ronde 1 de T6 : 7 sur 7 (X1 et X1b texte neuf sans anglais, X2 `.reperes-x`, X8
  `.reperes` à 1 rem, X9 emploi laissé en commentaire, X5 NAV en commentaire, X6 `t("Ouvrir le lien")`) — X1, X1b, X2, X8, X9 restaient VERTS sur
  `838fa41` (6216/6216) ; contre-preuves de l'outil : un hôte inconnu et l'onglet réel allongé rougissent la preuve.

Les rulings, une ligne chacun (détail en spec § 12 « Construction UI-1 : rulings ») : **R-UI-P1** `search.js:162` seule édition de `search.js` (`'loupe'` ; à la fusion, garder la ligne de UI-1 : `main` porte `'🔍'`) ·
**R-UI-P2** le sous-titre de la fiche reste `provenanceText` (§ 4.2 amendé) · **R-UI-P3** « Préparation » → « Method » pour le `segmented` (§ 5 amendé) — les trois
du pré-vol du plan (rév. 2, ratifiés rév. 3) · **R-UI1-1** la règle `.plat-vignette.grande` identique à UI-2 au caractère près, `.petite` ajoutée, l'épingle à
trois sélecteurs (fusion par union) · **R-UI1-2** les sources du test I-F3 (`tests/photo-plat.js:1327-1331`) à UI-2 seul — les deux du chef d'orchestre (plan
rév. 3) ; **R-UI-1** `theme.js` l. 45 et 48 « olive » · **R-UI-2** seule la roue du panneau au trait (D-2) · **R-UI-3** `header.stack h1 + p.muted` aussi sur les
en-têtes maison · **R-UI-4** (à trancher) trois `h1` de recette nus à l'échelle des pages (EI-T1-R1-a) · **R-UI-5** (à trancher) `.badge.ai` en olive, contre
D-UI-2 · **R-UI-6** (à ratifier) `extra` seulement s'il est donné · **R-UI-7** (à ratifier) génération dans `redessiner()` · **R-UI-8** (à ratifier) tests des survivants M7, M22 · **R-UI-9** (à
ratifier) « Rien à importer pour l’instant. » · **R-UI-10** (à ratifier) un écouteur `matchMedia` posé au montage · **R-UI-11** (tranché par R-UI-49, vague finale) les retours de `book.js` mènent à
Recettes · **R-UI-12** (ouvert) une référence sans adresse ni livre n'apparaît nulle part · **R-UI-13**, **R-UI-14** (à ratifier) tests des survivants M18, C1b ·
**R-UI-15** (à ratifier) une durée seulement avec préparation ET cuisson connues · **R-UI-16** (à ratifier) `display: contents` sur l'emplacement photo vide · **R-UI-17** (à ratifier) clé
« {n} portions · {d} » retirée · **R-UI-18** (à ratifier) `suiviFiche` · **R-UI-19** deux assertions dictées fausses (T4) · **R-UI-20** `suiviLivre` (remplacé par
R-UI-22, à ratifier avec lui) · **R-UI-21** (à ratifier) couverture ≤ 200 px · **R-UI-22** (à ratifier) `suivreLargeurAuMontage` · **R-UI-23** (à ratifier) Sommaire par position · **R-UI-24** (à ratifier) « Pages et fichiers
sources » seulement si utile · **R-UI-25** (à ratifier) titre de ligne compacte à 44 px · **R-UI-26** (à ratifier) une définition d'`estAImporter` / `aUneAdresse` · **R-UI-27** (à ratifier) fixture
`pgA` / `pgB` · **R-UI-28** (à ratifier) feuille lue avant le `fetch` remplacé · **R-UI-29** (à ratifier) compteur des livres par `estAImporter` · **R-UI-30** (à ratifier) empreintes par
`pointeurValide` · **R-UI-31** (à ratifier) focus rendu à la légende · **R-UI-32** (à ratifier) `STATE_LABELS.availability` lu par `dish.js` seul, un signet y dit « Lien web »
(D-UI-10 amendé) · **R-UI-33** clé orpheline « Repérée dans ton livre » retirée · **R-UI-34** (à ratifier) « Le numéro de page n’a pas pu être enregistré.
Réessaie. » · **R-UI-35** (à trancher) « référence sans livre » : badge « À importer » contre `estAImporter` ;
puis ceux de la tâche 6 : **R-UI-36** M3 non rejouée (session exigée ; `search.js` : un littéral seulement, hors du vol) · **R-UI-37** « Aller à Mes livres. » a quitté `en.js`
avec les trois chaînes de § 5 (même décision, D-UI-4 ; retirées par T1 à T5, T6 le vérifie : `en.js` intact) · **R-UI-38** quatre textes neufs que § 5 ne fixe pas : « Disponibles » → « Available », « Reprendre la séance » → « Resume the session », « {n} à importer » →
« {n} to import », « Page {n} · p. {p} » (identique), épinglés (« 1 portion » → « 1 serving » est une clé antérieure réemployée : R-UI-41) · **R-UI-39** la galerie monte les composants réels là où ce sont des fonctions (`recipeCard`, `grilleCartes`, `section`, `sectionPlain`, `pageHeader`,
`availabilityBadge`, `ligneCompacte`, `icone`) et l'outil attend `data-galerie-prete` ; les onglets (copie de `navLinks`), 7 bis et le reste de l'en-tête de
fiche sont du balisage écrit à la main (restreint par la ronde 1) · **R-UI-40** à 320 px seuls les onglets sont jugés, sur la galerie PUIS dans l'app sur `#/library`, l'onglet réel actif (ronde 1 ; la barre haute avec
pastille déborde de 21 px, connu, spec refonte § 11) · **R-UI-41** (à ratifier) « 1 portion » et « {n} portions », clés antérieures des repères, hors de la table des textes neufs et épinglées comme réemployées
(EI-T6-a, ronde 1) · **R-UI-42** (à ratifier) le repli `setContent` de l'outil part d'une page de même
origine (EI-T6-b) · **R-UI-43** (à ratifier) le 404 différé de `/favicon.ico` compté à part dans l'outil (EI-T6-c) · **R-UI-44** le plan vit à son chemin réel ; puis ceux de la ronde 1 de
T6 : **R-UI-45** (à ratifier) le filet i18n calculé sur tout le module (78 clés antérieures sans entrée, figées), les emplois lus sans commentaires,
les sélecteurs comparés comme jetons, `.reperes` mesuré · **R-UI-46** (à ratifier) l'outil de preuve en liste blanche du réseau (un hôte inconnu est
une faute nommée) · **R-UI-47** la fusion mesurée : 17 fichiers en conflit, chacun avec sa règle (geste 2) ; puis ceux de la vague finale, tous à
ratifier : **R-UI-48** Sommaire rangé par séance (`started_at`, sinon `captured_at` du document) puis position · **R-UI-49** (tranche R-UI-11) les retours du
livre mènent à `#/library?tab=books` · **R-UI-50** « Reprendre la séance » du Sommaire pour une séance de sommaire seulement · **R-UI-51** « Aucune recette ne
correspond. » · **R-UI-52** `pageAffichable` exportée, badge court dans la ligne compacte · **R-UI-53** `;` de `.plat-vignette.grande` · **R-UI-54** identifiants
de fiche encodés · **R-UI-55** titres de livre par `String()` · **R-UI-56** D-UI-2 épinglée sur `.badge.original` et `.status.ok` (`.badge.ai` : R-UI-5 reste à
trancher) · **R-UI-57** zone « photo » morte retirée de la règle `:has` · **R-UI-58** `clesT`, une lecture des clés i18n (trois formes) · **R-UI-59** la
recherche lue dans son rendu · **R-UI-60** le relevé des `emptyState` ratifié comme filet admis.

**Vague finale (28 octobre 2026 ; revue finale de branche de `7c9d3f7` : 2 Important, 15 Minor ; code `88e095a` ; rapport `final-fix-report.md` du
registre).** Les deux Important corrigés, rouge d'abord : le Sommaire rangeait par `position`, numérotée PAR SÉANCE (une page oubliée, photographiée
dans une seconde séance, s'intercalait en deuxième) → par séance puis position (R-UI-48) ; « Plus tard », « ← Bibliothèque » et la suppression d'un livre
menaient à Recettes, sans trace du livre → segment Livres (R-UI-49). Les Minor à moins de dix lignes aussi (R-UI-50 à R-UI-60) ; non faits, avec leur
raison : la couleur de `.badge.ai` (R-UI-5, décision de produit), l'extension d'I-F3 à `book.js` et `home.js` (au commit de fusion, R-UI1-2 : geste 2).
Rouge lu sur l'ancien code : `❌ 6212/6226`, 14 lignes aux sites visés. Mutants : `final-fix-report.md`.

**Ce qui n'est PAS prouvé.**
- **Safari et l'iPhone** : rien n'y a été vu (aucun WebKit ici) — Georgia et `clamp()` des titres, le `details` replié, la bascule Ingrédients /
  Préparation au toucher, les icônes SVG dans les onglets, « Bibliothèque » dans l'onglet avec « Agrandir l'affichage » (320 px : mesuré sous
  Chrome sur la galerie et dans l'app servie, onglet actif ; pas dans l'app installée), la grille à deux colonnes sur un vrai écran, `object-fit` des photos 4:3.
- **Ta bibliothèque** : la grille Recettes n'a été vue qu'avec des données semées (12 fiches, 2 puis 9 photos) ; avec tes photos réelles (rares :
  lot F) elle sera d'abord faite de blocs de titre (§ 11, § 13 point 5 : « photos d'abord » reste renversable).
- **La coquille** (`app.js`) reste hors suite : la NAV avec icônes et le libellé « Bibliothèque » ne sont mesurés que par la preuve visuelle (et un
  test de source).
- **R-VIS-8 en vrai vol** : M3 n'est pas rejouée (voir ci-dessus) ; la règle est tenue par `tests/theme.js` et `search.js` n'a changé que d'un littéral,
  l'icône de son état vide (R-UI-P1), hors du chemin du vol.
- **Le site public** ne porte rien du lot (rien n'est poussé) ; UI-2 est déjà dans `main` ; la fusion de UI-1 a 17 fichiers en conflit, mesurés
  (R-UI-47, geste 2).

**Dettes (assumées, une ligne chacune).**
- La galerie montre la ligne de source de la carte-plat telle que `recipeCard` la lit dans `doc.book` / `recipe.source_url` : si l'app passe par
  `ctx.editionLabel`, la galerie l'omet (visuel seulement).
- Les 174 captures et l'outil vivent hors git : ils disparaissent avec le worktree si le registre n'est pas copié (comme au lot refonte).
- Quatre textes neufs vivent hors de la table § 5 de la spec (« Disponibles », « Reprendre la séance », « {n} à importer », « Page {n} · p. {p} ») : épinglés
  par `tests/carnet.js` (R-UI-38) ; « 1 portion » (clé antérieure) y est épinglée comme réemployée (R-UI-41) ; deux autres hors table restent à ratifier
  (R-UI-9, R-UI-34).
- Le test NAV (`label: 'Bibliothèque'`) est un test de source (app.js hors suite, relu sans commentaires) : la preuve visuelle est la vraie mesure (l'onglet
  réel, à 320 px depuis la ronde 1).
- La galerie reste en partie une COPIE de balisage (onglets, 7 bis, repères, lien d'origine, rangée principale, `details`, `segmented`) : elle peut
  dériver du code sans rougir ; les vraies mesures sont les routes de l'app (R-UI-39). L'inventaire des 78 clés sans entrée ne fait qu'exempter : il
  s'amende à la main quand l'une gagne son anglais (rien ne rougit alors).
- ~~Liste compacte de la fiche livre : une référence montre sa page deux fois~~ fermée par la vague finale (R-UI-52 ; les captures `1512-fiche-livre.png`
  et `768-galerie-liste-compacte.png` du registre datent d'avant la vague).
- À 320 px, « Ma semaine » passe sur deux lignes dans son onglet (non jugé) ; à 375 px, le « ? » du titre d'Aujourd'hui reste seul sur sa ligne.
- « Ouvrir le lien » survit dans un commentaire (`components.js:77`) et des assertions négatives du bloc T3 (aucun `t()`).
- R-VIS-8 s'applique aussi au lien d'origine de la zone d'échec de l'écran d'import web ; la légende d'une vignette de l'import ciblé reste un bouton
  quand les pages sont figées.
- M16 (mesures à une largeur dans `tests/carnet.js`, la preuve couvre 320 à 1512) ; MA (défaut `window.matchMedia` non lié : équivalent dans Chrome).
- L'outil de preuve diffère de sa source du lot refonte par cinq retouches dites : M3 retirée (R-UI-36), repli `setContent` de même origine (R-UI-42),
  favicon compté à part (R-UI-43), réseau en liste blanche (R-UI-46), onglets réels de l'app à 320 px (R-UI-40).

**Gestes de Neegan, dans cet ordre.**
1. **UI-2** est fusionné et poussé depuis le 27 octobre (`main` = `origin/main` = `1cb5dde`) ; ses gestes restants (`0007` collée et prouvée, fonction
   redéployée, sondes, preuve § 10 UI-2) sont dans sa section et ne bloquent pas UI-1.
2. Après la revue finale et `/verify` du chef d'orchestre : fusion de `experience-carnet` par un **commit de fusion** (jamais `--ff-only` : UI-2 a
   bougé `main`). **17 fichiers en conflit, mesurés** (`git merge-tree --write-tree origin/main origin/experience-carnet` sur un clone du scratchpad,
   28 octobre ; R-UI-47), chacun résolu À LA MAIN et relu, jamais par script : `CLAUDE.md` et `docs/architecture.md` (les deux sections, UI-2 puis
   UI-1, au même ancrage : garder les deux) ; `STATE.md` (réécrire le titre et garder les paragraphes des deux lots) ; `src/i18n/en.js` (union des
   entrées, une clé écrite une fois) ; `src/model/schema.js` (`APP_VERSION 0.17.0`) ; `sw.js` (UNION de `SHELL` — `./src/ui/icones.js` ET
   `./src/domain/apercu-web.js` — et `VERSION` `cuisine-os-v0.17.0-11`, la branche étant à `-10` depuis la vague finale) ; `styles.css` (`.plat-vignette.grande`
   écrite une fois — identique au caractère près depuis R-UI-53 —, `figure.apercu` ET `.plat-vignette.petite` gardées : R-UI1-1) ; `tests/photo-plat.js` (la
   version à trois sélecteurs, ET `../src/ui/book.js` et `../src/ui/home.js` ajoutés à la liste des sources du test « CSP et sources (I-F3, I-F8, D-F11) »,
   vague finale) ; `tests/ajouter.js` (`MODULES_NEUFS` en union —
   `icones.js` ET le domaine des aperçus — et les pins 0.17.0) ; `tests/tests.js` (imports et appels de `apercu-web.js` ET de `carnet.js`, l'épingle
   remesurée après la fusion, règle N−1) ; les pins 0.17.0 de `tests/assistant-compte.js`, `classement.js`, `creer-ia.js`, `passerelle.js`,
   `recherche-web.js`, `sync-l3.js` et `sync-l4.js` (13 assertions + 1 commentaire en tout, I-UI-7). La spec et `search.js` fusionnent seuls : garder
   `'loupe'` (R-UI-P1 ; `main` porte `'🔍'`). Puis la suite et Node sur l'arbre fusionné ; puis `! git -C ~/projects/mistu push origin main`. Ouvrir
   `https://neegans.github.io/mistu/tests/` et lire le BILAN (attendu : la valeur remesurée, plus le 404 de `/favicon.ico`) ; service worker
   `cuisine-os-v0.17.0-11`. (Liste des 17 conflits remesurée après la vague finale sur `88e095a` : inchangée.)
3. **Preuve réelle § 10 UI-1** sur le site public : Bibliothèque → Recettes sur TA bibliothèque (dire si la grille, avec tes photos réelles,
   ressemble assez à la maquette ; sinon § 13 point 5), filtres, pied, « Ajouter une recette » ; une fiche de recette avec photo sur le Mac (deux
   colonnes) et sur l'iPhone (onglets, « Corriger » à côté) ; une fiche de livre (menus en tête, 8 lignes puis « Voir les {n} recettes ») ;
   Aujourd'hui ; Ajouter ; l'onglet « Bibliothèque » lisible sur l'iPhone, « Agrandir l'affichage » dit (repli « Carnet », § 13 point 3).
4. Regarder les captures : `~/projects/mistu-carnet/.superpowers/sdd/2026-10-23-experience-carnet/captures/` (174 PNG `<largeur>-<nom>.png`) ;
   la galerie : `http://127.0.0.1:8096/.superpowers/sdd/2026-10-23-experience-carnet/galerie.html` (serveur du worktree).
5. Les sept points de § 13 restent renversables (olive, « Cuisine OS », aperçus, « Bibliothèque », gestes repliés, tri, ordre des lots) ; chacun au
   prix dit dans sa ligne.
6. « clean » **seulement après** la copie du registre **avec `captures/`** dans `~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet) ; ensuite
   `git worktree remove` de `mistu-carnet`.

**Versions.** `APP_VERSION = '0.17.0'` (était 0.15.0 ; 0.16.0 = UI-2 ; pins `v0\.17\.0-\d+` / `'0.17.0'` : 13 assertions + 1 commentaire dans
`tests/ajouter.js`, `tests/passerelle.js`, `tests/recherche-web.js`, `tests/sync-l3.js`, `tests/sync-l4.js`, `tests/assistant-compte.js`,
`tests/creer-ia.js`, `tests/classement.js`), `DB_VERSION = 4` (inchangée), `sw.js VERSION = 'cuisine-os-v0.17.0-10'` (`-1` à T1, `-2` T2, `-3` sa ronde, `-4` T3,
`-5` sa ronde, `-6` T4, `-7` sa ronde, `-8` T5, `-9` sa ronde, `-10` la vague finale ; la ronde de T1 ne touchait que des tests ; T6 et sa ronde : aucun fichier de `src/`, aucune version), `SHELL` + `./src/ui/icones.js` (seul module
neuf). Aucun schéma, aucune migration, CSP inchangée, `theme-color` inchangé.

**Bilan (28 octobre 2026, vague finale `88e095a` ; avant elle : tête de code `0fa52b4`, filets `1d952fe`, ronde 1 de T6 `7c9d3f7`).** Suite complète **6226/6226** (épingle **6225** dans `tests/tests.js:255`,
règle N−1 ; départ du lot sur `f3672be` :
5948/5948, épingle 5947 ; T1 5989 puis 5993, T2 6037 puis 6049, T3 6081 puis 6093, T4 6131 puis 6151, T5 6182 puis 6204,
T6 6216, sa ronde 1 6218, vague finale 6226 : lus dans leurs rapports), une seule erreur de console : le 404 de `/favicon.ico`
(préexistant) ; `node --test tools/*.test.mjs` **208/208** (inchangé) ; `node tools/generer-migrations.mjs --check` **0** ; preuve visuelle VERT (70/70,
174 captures, contraste minimum 4,62 sur 3 601 nœuds, 0 requête hors origine ; contre-preuves rouges ; mutants M-UI6-1 à 8 et X1 à X9 de la ronde 1 rouges ; rejouée
après la vague par une COPIE de l'outil, sorties dans le scratchpad — les captures du registre datent d'avant la vague — : VERT, 70/70, 174 captures, 4,62 sur 3 601 nœuds ;
mutants de la vague : 28 sur 28 rouges, témoin vert) ; aucun caractère invisible (Python `-I`) ni aucune clé dans les fichiers touchés ; `git diff
--stat f3672be..HEAD -- supabase/ tools/` vide.

**Fusion.** Revue finale de branche puis `/verify` par le chef d'orchestre ; le registre (avec `captures/`) se copie **avant** tout `git worktree
remove` ; UI-2 a fusionné le premier (27 octobre) ; UI-1 entre par un commit de fusion (spec § 9). **Clôture du chef (28 octobre 2026)** :
rulings R-UI-61 à R-UI-65 (spec § 12) — ratifications, R-UI-4 (échelle de page ratifiée), R-UI-35 et R-UI-12 (proposition ratifiée, orpheline
inatteignable), R-UI-5 renvoyé à Neegan (§ 13 point 7), constats visuels nommés.

## La présentation du serveur (18 octobre 2026, lot borné après la passerelle)

**Contexte.** Lot 4 fusionné et poussé par Neegan (`main` = `3998f97`, Pages servi à 20 h 51 UTC, `cuisine-os-v0.8.0-6`) ; preuve
`0004` jouée (20/20) ; **première recherche réelle rendue sur le site public sans clé** (capture 16 h 54, Montréal). Neegan a alors
demandé « un résumé de chaque recette », précisé « comme une petite présentation faite par un serveur », plus « une ligne à part :
le temps estimé, la difficulté, le nombre d'ingrédients (en dehors du sel et poivre) ». Choix entre trois formes (recette complète
dans l'app / résumé dans la liste au même appel / les deux) : **option 2**, même appel, **serveur intact**. Classé **borné** : design
approuvé en chat, pas de spec ni de plan ; un brief (`.superpowers/sdd/2026-10-18-presentation-serveur/task-1-brief.md`), un
implémenteur (sonnet, TDD), une revue adverse (opus), une ronde de corrections, une re-revue. Worktree `~/projects/mistu-serveur`,
branche `presentation-serveur` (base `3998f97`), servi sur 8087.

**Ce qui change (spec « chercher sur le web », § 12).** L'assistant répond `{"choix":[{"url","presentation","temps_min","difficulte",
"ingredients"}]}` ; `pourquoi` a disparu partout. `presentation` = deux ou trois phrases dans la voix d'un serveur, bornée **au mot**
à 400 points de code par `bornerAuMot` (`src/core/bornes.js` : sauts de ligne → espace, mesure après `trim`, coupe à la dernière
espace de la moitié droite hors insécables, « … » ; `max` < 1 → `''`) — fin du « La recet » coupé en plein mot ; une présentation qui
porte une adresse web est **écartée** (`MOTIF_ADRESSE` : `https?://`, `www.`, `hôte/chemin` ; `MOTIF_HOTE` : hôte nu sur une liste fermée de domaines de premier niveau ; test sur le texte NFKC où U+3002/U+FF61 valent « . » et U+2215/U+2044 valent « / » ; faux positif connu et accepté : une phrase collée suivie de « Ca », « Le sel.Ca y est »). Repères typés : `temps_min` entier 1..1440, `difficulte` ∈
`facile | moyen | exigeant` (jetons français dans les deux langues, chaîne seulement), `ingredients` entier 1..99 ; tout le reste vaut
`null` ; lus par `Object.hasOwn` (y compris `url` et `choix`). Un choix ne survit toujours que s'il désigne exactement un résultat
(I-A) ; repli et `autres` portent les quatre champs à `null`. Écran : titre (lien), hôte · date, présentation en **nœud texte**, ligne
« Estimé par l’assistant : ≈ 15 min · facile · 7 ingrédients » (parties présentes, « ≈ 1 h 30 », « 1 ingrédient » ; bornes hautes
revalidées au rendu), rangée « Voir la recette » (`a`, `href` du résultat revalidé par `lienSignet`, `target=_blank`, `rel=noopener
noreferrer` ; clé `en.js` partagée « View recipe ») + « Garder ce lien ». Mention I-K : « L’assistant présente les plats et estime le
temps d’après les pages : il ne vérifie ni le temps, ni les ingrédients, ni les restrictions. Relis la page avant de cuisiner. » ; en
repli, l'ancienne phrase. Consigne `SYSTEM` fr/en : « n’affirme jamais qu’elle respecte une restriction ou une durée, dis ce que la
page annonce ; aucune adresse web dans le texte », **épinglée mot pour mot** par le test (sortie de `construireDemande`, pas le source).
`APP_VERSION 0.8.1`, `sw.js` `cuisine-os-v0.8.1-3`. `max_tokens` reste 4096.

**Revue adverse (opus) et rulings.** 0 Critical. I1 repères rendus comme une donnée de la page → préfixe « Estimé par l’assistant » +
mention étendue au temps ; I2 consigne qui poussait à affirmer une restriction, 400 points de code d'injection, adresse possible →
consigne renforcée + adresse écartée, **pas** de préfixe sur la présentation (la voix est le but) ; I3 faux-vert : `rel` du titre plus
épinglé → `[href, target, rel, texte]` ; I4 consigne non épinglée (gardes inversées, jetons anglais : verts) → épinglage littéral.
m1-m7 appliqués ; m8 ratifié (« View recipe », `difficulte` chaîne) ; m9 `docs/architecture.md` et parenthèses dans la spec. Re-revue :
13/13 réglés, 8 mutants rouges ; **ronde 2** sur ses résidus : hôte nu (`MOTIF_HOTE`, recommandation mesurée du relecteur : cinq hôtes
écartés, dix fragments honnêtes gardés), normalisations U+3002/U+FF61/U+2215/U+2044, tous les séparateurs de ligne → espace dans
`bornerAuMot` (U+2028/2029/0085, VT, FF), U+2007 hors des points de coupe. **Parqué** : coupe des graphèmes combinés (accents
combinants, drapeaux) ; courriels dans une présentation ; homoglyphes d'un autre alphabet (UTS #39, pas de table) ; qualité réelle
des présentations et des estimations (aucun appel réel pendant la construction).

**Chiffres.** Suite **3011/3011** (épinglé 3010 ; avant le lot 2953), Node 101/101, `--check` 0, mutants : 21 rejoués après la
ronde 1 et 9 après la ronde 2 par l'implémenteur, 8 par le relecteur, 1 par le contrôleur (`MOTIF_HOTE` ignoré → 3009/3011), tous
tués ; 0 invisible, 0 insécable littérale sur les fichiers du lot. Commits `d124de6` (tâche), `5ab689f` (ronde 1 ; son sujet porte un
accent, laissé tel quel : jamais réécrire l'historique), `778883c` (ronde 2), puis les docs du contrôleur.

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
