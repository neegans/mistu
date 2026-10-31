# Fiche recette lisible — réception du 31 octobre 2026

[Contrat de présentation](../specs/2026-10-31-fiche-lisible-design.md). Branche `correctif-fiche-lisible`, base publiée `f15665c` / 0.32.7-1. Livraison préparée **0.32.8-2**, APP_VERSION 0.32.8, DB6 et archive7 inchangés.

## Écrans et parcours observés

1. **Ouvrir la fiche — amélioré, encore long sur téléphone.** Description manquante et notes vides sont repliées. Description, durée et note réellement renseignées restent visibles. La photo et les fonctions existantes sont conservées.
2. **Lire les ingrédients — amélioré.** Quantité et nom partagent le même flux. Un seul bouton ouvre les sources et commandes de remplacement. Incertitudes visibles, coches conservées, aucune mutation des données.
3. **Lire la préparation — amélioré.** Les minuteries deviennent des lignes dépliables. Le choix d’une fourchette reste explicite ; le dépliage ne lance et n’enregistre rien. Les minuteries actives du mode cuisine sont inchangées.
4. **Choisir Français — état plus clair, traduction personnelle non réalisée.** Une absence totale donne un seul avis explicite et l’action existante de création. Une traduction partielle conserve ses manques locaux. Le français déjà affiché n’a plus de bouton redondant « Lire la version française » ; correction et candidat exact restent accessibles.

Captures avant : vraie application publique0.32.7-1. Captures après : vraie application locale0.32.8-2. Même recette de démonstration :8 ingrédients et5 étapes, sans photo ni compte. Captures enregistrées et ouvertes pour relecture. Elles ne représentent pas une modification de la recette Trinity bread de Neegan.

| Mesure sur la démonstration | Avant | Après |
| --- | --- | --- |
| Début des ingrédients, ordinateur1280px |1161px |887px |
| Début des ingrédients, téléphone390px |1410px |1091px |
| Ligne d’ingrédient, ordinateur |96–150px |37–68px |
| Ligne d’ingrédient, téléphone |114–192px |37–92px |
| Minuterie fermée |180–248px |46px |

**21/21 contrôles de parcours local** : détails/coches, notes, minuterie simple et fourchette, source conservée, français absent, largeurs320/390/768/1280 et texte agrandi200%. Aucun débordement, aucune erreur JavaScript, requête extérieure ou POST. Le bouton des détails annonce son ouverture et conserve le même champ coché ; les éléments masqués quittent le parcours clavier. Cette vérification ne constitue pas un audit d’accessibilité exhaustif.

## Tests et changements d’attentes

- Composants : rouge29/38, puis38/38. Options nouvelles facultatives ; voisins L0 cuisine159/159 et L7 commandes14/14 conservés.
- Fiche : rouge14/25, puis25/25 ; ajout du cas de détails entièrement vides, rouge25/26 puis26/26. Total **64 assertions nouvelles**.
- Voisins : langue27/27, lecture L6 28/28, repères35/35, notes I2 65/65. Les deux attentes du lien français redondant sont remplacées par l’absence de ce lien et la conservation du candidat exact dans la correction manuelle, sans appel. L’attente du badge vide est remplacée par un temps toujours inconnu dans les détails et l’absence de valeur inventée. Nombre d’assertions historiques conservé.
- Outils Node : **281/281**. Générateurs livraison/migrations conformes, syntaxe et diff propres, scan des secrets sans valeur interdite.
- Suite navigateur complète : **14625/14625**, épingle14624, soit64 assertions nouvelles. Reçu `artifacts/ci-navigateur/passage-RKMMBc/resultat.json`, Node24.22.2 / Chromium156.0.8078.4, zéro erreur inattendue,29 journaux injectés attendus. Serveur et navigateur fermés.

Le premier passage complet affichait14621/14625 : une ancienne épingle de version dans sync-l3, deux attentes d’avertissement local dans carnet et l’inventaire CSS fermé. Corrections relues indépendamment : version exacte0.32.8, source italienne toujours identique avec avis global explicite, seul sélecteur vide `.fiche-recette .reperes-badges:empty` ajouté à l’inventaire. Aucune assertion supprimée. Le second passage complet ci-dessus est vert ; aucune nouvelle modification produit entre ces deux passages.

Les premières attentes de test «10 minutes» ont été corrigées vers le formateur existant «10 min» avant le correctif produit ; les rouges causaux sont conservés séparément. L’essai visuel initial sans minuteries a été remplacé par une fixture utilisant le vrai parseur d’étapes avant la mesure publiée ici.

Preuves locales : `.superpowers/sdd/2026-10-31-fiche-lisible/` ; captures définitives dans `apres-local-2/`. Manifeste :216 ressources,3785141 octets, SHA256 `67cb99b7c1094aa516b5049dcfc64cac59b3f12ea683ed9cb65d739b1738d96c`.

## Mise à jour et limites

Les captures de Neegan montrent0.32.0-5, avec0.32.7-1 prête. Dans old5, « Vérifier la mise à jour » relit l’état local ; il n’active pas le worker en attente. La fermeture de tous les clients reste nécessaire. Sur Mac : conserver la saisie, quitter l’app installée si ouverte, puis quitter complètement Chrome avec⌘Q avant de rouvrir Mistu. Aucun effacement de stockage ni activation forcée ajouté.

Ce correctif ne prétend pas avoir traduit la recette personnelle, corrigé les groupes de ses anciens imports ou testé un téléphone physique. Les groupes historiques restent corrigés explicitement par nouvelle version. La fiche de démonstration reste longue avant les ingrédients sur téléphone et conserve un espace libre à droite lorsqu’elle n’a pas de photo ; ce correctif ne clôt pas une refonte complète de la fiche.
