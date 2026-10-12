# Cuisine OS — consignes pour les sessions d'agent

- Spécification de référence : `cuisine-os-spec-v3.md` (fournie par l'utilisateur). Architecture et limites : `docs/architecture.md`.
- Application PWA **sans étape de build** : modules ES natifs sous `src/`, aucune dépendance npm. Ne pas introduire de bundler sans demande explicite.
- Langue de référence du code et de l'interface : français. Les chaînes passent par `t('texte français')`; l'anglais vit dans `src/i18n/en.js`.
- Données : IndexedDB via `src/core/db.js`; le schéma est dans `src/model/schema.js`. Toute nouvelle entité doit y être déclarée (magasin + relations) pour être sauvegardée et vérifiée à la restauration. Incrémenter `DB_VERSION` en cas d'index nouveau.
- Principes non négociables issus de la spec : l'original n'est jamais réécrit (nouvelle `RecipeVersion`); aucune quantité, durée ou compatibilité inventée; les restrictions alimentaires ne sont jamais assouplies; les états d'interface reflètent des événements réels (pas de « sauvegardé » sans écriture, pas de « minuterie démarrée » sans confirmation).
- Après modification des fichiers, mettre à jour la liste `SHELL` de `sw.js` et incrémenter `VERSION`.
- Tests du domaine : `tests/index.html` (dans le navigateur). Ne pas affirmer qu'ils passent sans les avoir exécutés.
- Ne pas committer, pousser ou déployer sans demande explicite.

## État des travaux (mémoire de session, mise à jour le 8 septembre 2026)

**Repères.** La spec `cuisine-os-spec-v3.md` n'est pas dans le dépôt : elle arrive en pièce jointe de la tâche VibeForge; la redemander si elle manque. Aucun AGENTS.md. L'historique des conversations précédentes n'est pas disponible : seule cette section fait foi.

**Fait.** Application complète écrite en une session VibeForge (shell et réseau désactivés) : coquille PWA, noyau (IndexedDB, routeur, ZIP, SHA-256, i18n), modèle et amorçage, domaine (quantités, unités/conventions, lignes d'ingrédients, portions, régimes, courses, recherche FR/EN, plats/comparaison, accords/repas, Redécouvrir, minuteries, sauvegarde/restauration, exports, abstraction IA), 15 vues (`src/ui/`), `sw.js`, `tests/`, `README.md`, `PROJECT.md`, `docs/architecture.md`, `docs/raccourci-minuterie.md`. Aucun commit : tout est en modifications non validées sur `main`.

**Première exécution réelle, 8 septembre 2026.** Serveur lancé par Neegan (`python3 -m http.server 8080` depuis le dossier du projet, en arrière-plan). `tests/index.html` : **73/73 réussis**. L'app démarre; Aujourd'hui, Mes livres, Ma semaine, Ma cuisine et Réglages s'affichent sans erreur visible (rapport de Neegan sur Mac, navigateur non précisé). Vérification statique préalable : tous les imports nommés correspondent à un export existant, aucun import dynamique, liste `SHELL` de `sw.js` complète, drapeau `u` présent sur les trois regex `\p{M}`. Reste à dérouler avec de vraies données : livre → photos → index → recette → recherche → cuisine → sauvegarde → restauration dans une base vide.

**Risques repérés pendant l'écriture, à vérifier en priorité.**
- ~~`src/domain/units.js` et `src/ui/recipe.js` : repli des accents via `/\p{M}/gu`~~ Levé le 8 septembre : drapeau `u` présent, tests passés.
- `src/domain/search.js` : une recette sans `type` est exclue d'une recherche typée (« salade »); les références d'index ne remontent que si leur titre contient un mot de la demande, un libellé FR/EN d'un ingrédient demandé ou un mot du type.
- `src/ui/recipe-edit.js` : la vue la plus dense (analyse des lignes, IA facultative, sauvegarde de version); tester extraction, correction, adaptation et traduction.
- `src/domain/backup.js` : gate V0 = restaurer dans une base vide avec mêmes identifiants et empreintes; `verifyRestored` doit rapporter zéro écart.
- `src/domain/llm.js` : fournisseurs OpenAI-compatible et Anthropic écrits sans appel réel.
- `manifest.webmanifest` : icône SVG seulement, pas d'`apple-touch-icon` PNG (fichier binaire à ajouter).
- Dictionnaire anglais partiel (`src/i18n/en.js`).

**Décisions prises (ne pas rediscuter sans raison).** PWA sans build et local-first plutôt que Supabase pour V0; adaptations = `RecipeVersion` (pas de table à part); libellés FR/EN embarqués dans `dishes` et `ingredients`; `contains: null` = inconnu pour les régimes; conversions volume↔masse seulement par équivalence documentée par ingrédient; références d'index = `availability: reference_only` sans version; minuterie confiée au système, jamais à un compteur JS.

**En cours (8 septembre 2026).** Parcours V0 avec de vraies données sur Mac. Neegan a reçu les étapes 1 à 4 : Ajouter → « Ajouter un livre » (ISBN + « Identifier », ou titre à la main) → fiche livre → « Photographier des pages » (sur Mac : sélecteur de fichiers) → séance de scan → cocher la page d'index → « Index / table des matières » → lignes « Titre — 132 » → « Créer les références » → « Terminer la séance » → photos d'une recette → « Regrouper en recette » → saisie du titre, des ingrédients et des étapes → « Analyser les lignes » → cocher « Vérifié » → « Enregistrer la recette ». **Aucun retour reçu encore sur ces étapes.** Ensuite : recherche FR/EN, mode cuisine et minuterie, note « À refaire ? », sauvegarde ZIP puis restauration dans un autre navigateur (gate V0). Sans clé IA, les boutons « … avec l'assistant IA » restent grisés : normal.

**Suite prévue.** 1) Terminer le parcours V0 ci-dessus et corriger ce qui casse. 2) Valider capture iPhone/iPad et raccourci minuterie. 3) Deux livres FR/EN + un PDF + dix recettes cuisinées (spec §20). 4) Ensuite seulement : V1 (adaptations Rapide / On se gâte / Meal prep via `LLMProvider`, moteur de salubrité, lots congelés liés aux cuissons).

**Contexte de travail avec Neegan dans ce terminal.** Le shell est désactivé côté agent : Neegan exécute les commandes en les préfixant par `!` placé en tout premier caractère de la ligne. Donner des commandes sur une seule ligne, sans retour à la ligne. Les adresses `http://…` s'ouvrent dans le navigateur, pas dans zsh : proposer `! open http://localhost:8080/`. L'agent ne voit pas l'écran : demander le texte des pages (Cmd-A, Cmd-C) ou des cartes rouges d'erreur. Serveur local lancé en arrière-plan depuis le dossier du projet : `cd ~/projects/mistu && nohup python3 -m http.server 8080 > /dev/null 2>&1 &`; contrôle `curl -sS http://localhost:8080/tests/ | head -5`; arrêt `pkill -f "http.server 8080"`.


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
