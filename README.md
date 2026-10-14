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
- Tests du domaine et de sauvegarde : ouvrir `http://localhost:8080/tests/`. La suite de sauvegarde utilise uniquement des bases IndexedDB temporaires `cuisine-os-backup-test-*`, nettoyées en fin de scénario. La suite complète (domaine, sauvegarde, synchronisation, page « Ajouter ») est **exécutée à chaque lot** : le dernier compte vert est noté dans `CLAUDE.md`. Elle n'écrit jamais dans la bibliothèque du navigateur.

## Ce qui est construit (V0, avec des morceaux de V0.5)

« Ajouter » ouvre une grille de cinq cartes (un livre, des pages, une recette tapée, un lien web, un lot au
congélateur). Un livre se crée en deux pas : ISBN scanné ou tapé (Open Library, puis Google Books en repli), sinon
saisie directe, puis une fiche à vérifier avant d'ajouter. Un lien web se garde comme référence dans la
bibliothèque — l'app ne le lit pas, elle se contente de le retrouver plus tard.

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
| Synchronisation des fiches entre appareils (compte Google) : file d'envoi, réception, conflits à trancher, quarantaine, « Envoyer maintenant », pastille « N non envoyés »; les photos restent locales (L4) | Réglages, en-tête |

## Synchronisation entre appareils

Au premier lancement, **si la synchronisation est configurée sur cette adresse** et qu'aucun compte n'est connecté, l'app accueille avec « Kwe. », **un bouton « Connexion avec Google »** et, dessous, **un lien « Continuer sans compte »** ; ce lien ouvre la bibliothèque locale et ne redemande plus rien sur cet appareil (l'écran revient après « Effacer les données de cet appareil »). Ailleurs — adresse sans configuration — l'app s'ouvre directement sur la bibliothèque.

Avec un compte connecté (comptes Google de la liste autorisée seulement), **les fiches — livres, recettes, versions, repas, courses… — voyagent entre tes appareils dès que tu es connecté ; les photos elles-mêmes, pas encore (lot L4)**. Ce qui est écrit hors ligne attend dans une file et part au retour du réseau ; ce qui arrive d'un autre appareil est écrit ici ; quand la même fiche a changé des deux côtés à la même heure, Réglages te demande laquelle garder — rien n'est fusionné en cachette. Pour les photos et les PDF, et pour un appareil sans compte, le transfert reste l'archive ZIP.

Sans compte, rien ne change : « Continuer sans compte » ouvre la bibliothèque locale et aucune donnée ne quitte l'appareil. Le serveur est le projet Supabase `mitsu` (Canada), nommé dans `src/sync/config.js` pour `neegans.github.io` et `localhost`. Spécification du lot : `docs/spec-compte-et-stockage-distant.md` ; conception amont et choix d'hébergement : `docs/compte-et-stockage-distant.md` ; application du serveur et preuves : `supabase/README.md` ; carte des modules : `docs/architecture.md`, section « Synchronisation (L3) ».

**Pas encore mesuré sur deux appareils** : la synchronisation est éprouvée par la suite de tests (transport simulé, aucun réseau), pas par un aller-retour réel entre l'iPhone et le Mac. Ce parcours est la prochaine vérification (voir « Vérifications à faire sur les appareils réels »).

## Ce qui n'est pas là (et le dit dans l'interface)

Adaptations Rapide / On se gâte / Meal prep, moteur de salubrité, planificateur multi-repas, synthèse de recettes, reconnaissance vocale, lecture d'EPUB ; côté synchronisation : les octets des photos et des PDF (lot L4), la purge du serveur et « Supprimer ma bibliothèque du serveur » (lot L5). Voir `docs/architecture.md`.

## Vérifications à faire sur les appareils réels

1. Capture photo iPhone (`<input capture>`), sélection de fichiers iPad, dépôt PDF Mac.
2. Raccourci `CuisineOS-Minuterie` : `docs/raccourci-minuterie.md`.
3. Générer un ZIP, vérifier sa présence dans Téléchargements/Fichiers, puis le restaurer dans un autre navigateur avec une base vide. Conserver la bibliothèque d’origine pendant cette validation.
4. Import du YAML dans Paprika et lecture du JSON-LD dans l'application cible.
5. Appels IA avec une clé réelle (code écrit sans avoir pu l'exercer).
6. **Synchronisation, aller-retour réel entre deux appareils** (spec § 7.3) : iPhone hors ligne → écrire une recette → voir le compteur « non envoyés » → remettre le réseau → la recette arrive sur le Mac ; la bibliothèque du Mac arrive entièrement sur l'iPhone ; une suppression se propage ; un conflit volontaire (la même fiche modifiée des deux côtés hors ligne) se tranche par « Garder celle d'ici ».


## Lot sauvegarde/restauration — à réviser et valider

- Export cohérent des magasins, contrôle des empreintes des sources et signalement des relations déjà incohérentes sans empêcher de conserver une copie.
- Inspection stricte avant restauration : magasins requis, structure des lignes et clés uniques, décomptes, empreintes, chemins ZIP et relations déclarées.
- Fusion/remplacement en une transaction : une erreur d’écriture annule tout le lot, y compris les vidages.
- Vérification du contenu des fiches et des fichiers après import ; bilan conservé à l’écran jusqu’au rechargement choisi par l’utilisateur.
- « Dernière archive générée » ne signifie pas que le téléchargement a été enregistré sur l’appareil.
- Régressions ajoutées : aller-retour IndexedDB/binaire, double import, archives invalides, secrets, erreurs synchrones et asynchrones avec annulation, contenu altéré et distinction fusion/remplacement. Aucun résultat d’exécution n’est revendiqué pour ces ajouts.

Les contrôles renforcés peuvent refuser une archive ancienne aux relations déjà cassées. Conserver le ZIP et le bilan ; aucune réparation ni suppression automatique n’est effectuée. Le ZIP reste entièrement en mémoire ; les volumes photo importants et un véritable manque d’espace doivent encore être vérifiés sur appareil.
