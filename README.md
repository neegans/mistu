# Cuisine OS (mistu)

Système d'exploitation personnel pour la cuisine : livres, recettes, plats, versions, appareils, historique et inventaire, construit d'après `cuisine-os-spec-v3.md`. PWA locale (Mac, iPhone, iPad), sans étape de build ni dépendance.

## Démarrer

Servir le dossier avec n'importe quel serveur statique, puis ouvrir `http://localhost:8080/`.

```sh
python3 -m http.server 8080
# ou
npx serve .
```

- Le service worker et le hachage WebCrypto exigent `https://` ou `localhost`. Sur le réseau local en `http://`, l'app fonctionne (repli SHA-256 en JavaScript) mais sans cache hors connexion : pour installer la PWA sur iPhone/iPad, servir en HTTPS (tunnel ou certificat local).
- Version hébergée : `https://neegans.github.io/mistu/` (GitHub Pages, branche `main`, dépôt public `neegans/mistu`). Chaque `git push` sur `main` la met à jour en une minute environ. Les données restent dans IndexedDB de chaque appareil ; rien n'est envoyé à GitHub.
- Sur iOS, ajouter à l'écran d'accueil depuis Safari. L'icône d'écran d'accueil est `icons/apple-touch-icon.png` (180 × 180, opaque, pleine) ; elle se régénère avec `python3 -I tools/make-apple-touch-icon.py icons/apple-touch-icon.png` (formes identiques à `icons/apple-touch-icon.svg`, aucune dépendance).
- Tests du domaine et de sauvegarde : ouvrir `http://localhost:8080/tests/`. La suite de sauvegarde utilise uniquement des bases IndexedDB temporaires `cuisine-os-backup-test-*`, nettoyées en fin de scénario. Ces nouveaux tests n'ont **pas** été exécutés pendant cette modification (shell et réseau désactivés).

## Ce qui est construit (V0, avec des morceaux de V0.5)

| Parcours | Où |
| --- | --- |
| Ajouter un livre (ISBN → Open Library / Google Books → confirmer, ou saisie manuelle), convention de mesure par édition | Ajouter |
| Séance de scan continue : photos, PDF, EPUB conservés localement, miniatures numérotées, remplacement d'une page, séance reprenable | Ajouter → Importer |
| Entrées d'index → références « Repérée dans ton livre — page N », doublons ignorés | Importer, fiche livre |
| Saisie ou extraction d'une recette avec correction ciblée (quantités, unités ambiguës `oz`, identité d'ingrédient proposée à confirmer) | Nouvelle recette / Corriger |
| Recherche FR/EN en langage naturel → pastilles modifiables; modes Mes recettes / Mes livres / Web (non configuré) / Tout; groupes admissibles, à vérifier, références | Recherche |
| Fiche recette : Original / Ma version, portions (durées non multipliées), unités (original / métrique / US avec hypothèses), langue de lecture, remplacer un ingrédient, évaluation d'une restriction, exports | Fiche recette |
| Plats : rapprochements proposés par titre, confirmation/refus réversibles, comparaison de 2–3 recettes | Mes livres → Plats |
| Composer un repas : « Avec quoi on mange ça ? », propositions expliquées, ajouter/remplacer/retirer/verrouiller, résumé du temps et conflits de four, contraintes du repas, duo mémorisé | Ma semaine |
| Liste d'épicerie consolidée (même ingrédient et unité convertible seulement) | Fiche recette / repas |
| Mode cuisine : ingrédients + étape, quantités rappelées, plan commun pour deux recettes, minuterie système (Siri ou raccourci) avec états honnêtes, note « À refaire ? » | Commencer à cuisiner |
| Redécouvrir : fondé sur les consultations dans l'app, « À explorer » sans historique, Plus tard / Masquer | Aujourd'hui |
| Appareils par capacités, inventaire de lots (date limite saisie, pas calculée) | Ma cuisine |
| Sauvegarde ZIP complète, restauration validée en espace isolé puis vérifiée, réimport sans doublon; exports JSON-LD, YAML Paprika, copie HTML | Réglages |
| Assistant IA optionnel (compatible OpenAI ou Anthropic) pour lire pages et index; sorties toujours « à vérifier » | Réglages |

## Synchronisation entre appareils (en construction)

Le serveur (Supabase), la connexion Google et la capture des écritures sont posés (lots L1-L2) ; l'envoi et la réception, eux, n'existent pas encore : tant que `src/sync/config.js` est vide, Réglages affiche « Synchronisation non configurée sur cette adresse. » et rien ne quitte l'appareil. Spécification du lot : `docs/spec-compte-et-stockage-distant.md` ; conception amont et choix d'hébergement : `docs/compte-et-stockage-distant.md` ; application du serveur et preuves : `supabase/README.md`.

## Ce qui n'est pas là (et le dit dans l'interface)

Adaptations Rapide / On se gâte / Meal prep, moteur de salubrité, planificateur multi-repas, synthèse de recettes, reconnaissance vocale, échange de données entre appareils (envoi, réception, conflits, fichiers distants : lots L3 à L5), lecture d'EPUB. Voir `docs/architecture.md`.

## Vérifications à faire sur les appareils réels

1. Capture photo iPhone (`<input capture>`), sélection de fichiers iPad, dépôt PDF Mac.
2. Raccourci `CuisineOS-Minuterie` : `docs/raccourci-minuterie.md`.
3. Générer un ZIP, vérifier sa présence dans Téléchargements/Fichiers, puis le restaurer dans un autre navigateur avec une base vide. Conserver la bibliothèque d’origine pendant cette validation.
4. Import du YAML dans Paprika et lecture du JSON-LD dans l'application cible.
5. Appels IA avec une clé réelle (code écrit sans avoir pu l'exercer).


## Lot sauvegarde/restauration — à réviser et valider

- Export cohérent des magasins, contrôle des empreintes des sources et signalement des relations déjà incohérentes sans empêcher de conserver une copie.
- Inspection stricte avant restauration : magasins requis, structure des lignes et clés uniques, décomptes, empreintes, chemins ZIP et relations déclarées.
- Fusion/remplacement en une transaction : une erreur d’écriture annule tout le lot, y compris les vidages.
- Vérification du contenu des fiches et des fichiers après import ; bilan conservé à l’écran jusqu’au rechargement choisi par l’utilisateur.
- « Dernière archive générée » ne signifie pas que le téléchargement a été enregistré sur l’appareil.
- Régressions ajoutées : aller-retour IndexedDB/binaire, double import, archives invalides, secrets, erreurs synchrones et asynchrones avec annulation, contenu altéré et distinction fusion/remplacement. Aucun résultat d’exécution n’est revendiqué pour ces ajouts.

Les contrôles renforcés peuvent refuser une archive ancienne aux relations déjà cassées. Conserver le ZIP et le bilan ; aucune réparation ni suppression automatique n’est effectuée. Le ZIP reste entièrement en mémoire ; les volumes photo importants et un véritable manque d’espace doivent encore être vérifiés sur appareil.
