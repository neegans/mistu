# mistu — Cuisine OS

## Objectif

Une intelligence culinaire personnelle qui connaît mes livres, mes recettes, mes appareils, mes goûts, mon historique et mon inventaire (spec `cuisine-os-spec-v3.md`). Le premier palier (V0) : ajouter, retrouver, cuisiner et conserver ses données, avec provenance systématique.

## Utilisateurs

Neegan, usage personnel sur Mac, iPhone et iPad (PWA). iPhone : capture, courses et notes; iPad : cuisine; Mac : imports et corrections.

## Contraintes

- PWA sans build, local-first (IndexedDB), sauvegarde complète restaurable en ZIP.
- Distinguer toujours original, adaptation, notes personnelles et sources externes.
- IA optionnelle, jamais requise; ses sorties sont « à vérifier ».
- Aucune donnée inventée : quantités manquantes, conventions non confirmées et compatibilités inconnues restent visibles comme telles.

## Première petite tâche

Valider avec deux livres FR/EN, un PDF et une dizaine de recettes réellement cuisinées : ajout de livre, photos d'index → références, scan d'une recette → version structurée vérifiée, recherche FR/EN, mode cuisine avec minuterie système, note après cuisson, sauvegarde puis restauration dans une base vide.

## Critères de réussite

Section 23 de la spec (15 critères), en particulier : provenance conservée sur chaque résultat, restriction alimentaire jamais effacée, cinq recettes d'un plat comparables, restauration à l'identique, minuterie native honnête, Redécouvrir sans date inventée.

## Hors périmètre

Réseau social, marketplace, publication, reconnaissance du frigo, intégration de 50 appareils, moteur nutritionnel médical, multi-utilisateurs, numérisation des 70 livres avant validation.
