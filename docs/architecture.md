# Architecture — Cuisine OS V0

## Choix

- **PWA sans étape de build** : modules ES natifs, aucune dépendance npm. Un serveur statique suffit. Choix guidé par « éviter la surarchitecture » (spec §15) et par la possibilité de tout vérifier en ouvrant l'app.
- **Local-first** : IndexedDB comme base unique (un magasin par entité), blobs (photos, PDF) stockés dédupliqués par SHA-256 dans le magasin `files`. La sauvegarde complète (ZIP) est le mécanisme de durabilité et de transfert entre appareils. Un backend Supabase/Postgres pourra reprendre le même modèle plus tard; aucune synchronisation serveur n'est prétendue.
- **Déterministe avant IA** : unités, portions, courses, régimes, sauvegarde et recherche sont du code sans LLM. L'IA est une abstraction `LLMProvider` (aucun, compatible OpenAI, Anthropic) branchée uniquement sur l'extraction de pages et d'index; ses résultats sont toujours « à vérifier ».

## Carte des modules

```text
index.html, styles.css, manifest.webmanifest, sw.js
src/app.js                 coquille, navigation, routes
src/core/    db.js (IndexedDB), router.js (#/…), dom.js (el, dialogues), i18n.js (FR clé, EN dictionnaire), hash.js (SHA-256 + repli), zip.js (ZIP stored), ids.js, bus.js
src/model/   schema.js (magasins, relations, vocabulaires), seed.js (unités, conventions, ingrédients FR/EN, presets d'appareils), repo.js (accès, réglages, activité, fichiers)
src/domain/  quantity.js (fractions, plages, qualitatif), units.js (conventions, conversions, affichage), lines.js (analyse d'une ligne d'ingrédient), scaling.js,
             diet.js, grocery.js, search.js (langage naturel → pastilles; groupes), dishes.js (rapprochement, comparaison), pairing.js (accompagnements, résumé de repas),
             rediscover.js, timers.js, backup.js (archive, inspection isolée, restauration, vérification), exporters.js (JSON-LD, YAML Paprika, HTML), llm.js
src/ui/      state.js (cache), components.js, home, search, library, book, dish, recipe, recipe-edit, cook, import, meals, grocery, kitchen, settings, add
tests/       tests.js + index.html : tests du domaine ; backup.js : régressions IndexedDB dans des bases temporaires
```

## Modèle de données (magasins IndexedDB)

`books`, `book_editions` (ISBN, langue, `unit_convention_id`), `source_documents` (fichier, sha256, type), `source_pages` (page imprimée, position),
`scan_sessions`, `dishes` (libellés FR/EN embarqués), `dish_recipe_links` (proposé / confirmé / refusé), `recipes` (titre original, disponibilité, vérification, favori, pages sources, `current_version_id`),
`recipe_versions` (extraction / correction / adaptation / traduction / synthèse; ingrédients avec texte source, quantité, unité, identité proposée; étapes à identifiant stable; provenance avec instantané de convention),
`recipe_translations`, `ingredients` (identité neutre, libellés FR/EN, `contains` pour les régimes, équivalences documentées), `unit_definitions`, `unit_conventions` (révision),
`substitutions`, `appliances` (capacités), `cook_history` (version exacte, portions, quantités effectivement utilisées), `cook_sessions` (progression par identifiant d'étape),
`inventory`, `meals` (éléments avec rôle, portions, verrouillage), `meal_feedback`, `shopping_lists`, `library_activity`, `rediscovery_prefs`, `timer_launches`, `files`, `settings`.

Règles : identifiants stables préfixés; une correction crée une version (jamais de réécriture); l'historique référence la version et un instantané des quantités; les adaptations sont des versions, sans table concurrente.

## Sauvegarde

Archive ZIP « stored » : `manifest.json` (format `cuisine-os-archive` v1, décomptes, liste des fichiers avec SHA-256), `data/<magasin>.json`, `files/<sha256>.<ext>`, `README.txt`.
L’export lit tous les magasins dans une transaction IndexedDB commune, puis construit et hache l’archive en mémoire. Les fichiers sources sont rehachés avant export. Si des relations sont déjà incohérentes dans la bibliothèque, l’archive peut être conservée avec un avertissement visible ; elle sera refusée à la restauration tant que les incohérences ne sont pas résolues. Aucune donnée n’est supprimée ou réparée automatiquement.

L’inspection exige tous les magasins de données et les réglages, leurs décomptes et leurs empreintes. Elle refuse les clés absentes ou dupliquées, les chemins ZIP répétés, les entrées non déclarées, les fichiers corrompus et les relations connues cassées. Les chemins de relations dans le schéma peuvent traverser des objets et des tableaux. Il s’agit d’une validation de structure, de clés et de relations, pas d’un contrôle de tous les champs métier.

La restauration prépare les objets et fichiers avant toute écriture. La fusion et le remplacement utilisent une seule transaction ; en remplacement, les vidages font partie de cette transaction. Une exception synchrone ou une erreur IndexedDB annule les écritures du lot. En fusion, les fiches portant le même identifiant sont remplacées, les autres sont conservées ; les métadonnées locales des fichiers existants sont conservées et leurs octets sont réécrits depuis l’archive validée. Les réglages secrets sont ignorés à l’import ; en remplacement, les secrets locaux sont effacés avec les autres réglages.

La vérification relit un instantané commun et compare le contenu JSON complet des fiches importées, leurs clés, les relations déclarées, les tailles/types et empreintes des fichiers. En remplacement, les décomptes doivent aussi être identiques ; en fusion, des fiches supplémentaires sont permises. Le bilan reste visible et l’utilisateur recharge explicitement l’application. Les anciennes commandes sont désactivées pour éviter d’exporter un contexte périmé.

Le format reste v1 : les archives complètes produites précédemment restent lisibles si elles satisfont les contrôles renforcés. Les versions inconnues sont refusées. ZIP64 et les entrées compressées/chiffrées ne sont pas pris en charge ; les limites du ZIP standard sont contrôlées avant génération. Les archives et photos restent chargées en mémoire : les gros volumes et le quota sur iPhone restent à valider.

« Dernière archive générée » atteste seulement la génération et le déclenchement du téléchargement. Le navigateur ne confirme pas l’enregistrement dans Fichiers. Les scénarios automatisés ajoutés dans tests/backup.js utilisent exclusivement des bases temporaires cuisine-os-backup-test-* ; ils n’ont pas été exécutés pendant cette modification.

## Limites connues de V0

- Pas de synchronisation entre appareils : transférer par archive.
- Pas de reconnaissance vocale; minuterie confiée au système (Siri / raccourci).
- EPUB conservé mais non rendu; PDF affiché via le lecteur du navigateur, pages référencées à la main.
- Interface anglaise partielle (dictionnaire `src/i18n/en.js`).
- Adaptations Rapide / On se gâte / Meal prep, moteur de salubrité, planificateur multi-repas et synthèse : paliers V1–V1.5, non implémentés (indiqués comme tels dans l'interface).
