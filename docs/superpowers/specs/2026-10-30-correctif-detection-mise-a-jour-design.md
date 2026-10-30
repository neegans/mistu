# Détection des mises à jour dans une fenêtre déjà ouverte

La capture de Neegan du30octobre à08 h43 montre encore les commandes de traduction sous Ingrédients, alors que la livraison0.32.0-5 les place sous les langues. La publication a été reçue dans des profils neufs ; cela ne prouve pas la transition d’une fenêtre déjà ouverte.

Le contrôle actuel `verifier()` interroge uniquement les workers déjà connus. Aucun `registration.update()` n’est demandé dans une session ouverte. Le bouton « Vérifier la mise à jour », caché sans attente connue, ne recherche donc pas une nouvelle publication. Le code en mémoire et le cache immuable restent anciens jusqu’à activation naturelle après fermeture de toutes les fenêtres contrôlées.

## Correction bornée

- Garder `verifier()` en lecture seule pour les preuves et diagnostics. Ajouter une recherche explicite, bornée et coalescée, qui demande `registration.update()` puis relit l’état ; une erreur réseau ne devient pas une preuve d’absence de mise à jour.
- Rechercher automatiquement au retour dans l’application, au retour réseau et périodiquement lorsqu’elle est visible et en ligne. Espacer les recherches et disposer les abonnements proprement. Aucune navigation, écriture métier ou activation forcée.
- Rendre la recherche manuelle disponible dans Réglages même sans worker en attente. Le contrôle existant du bandeau déclenche la même recherche. Expliquer l’état trouvé, sans déclarer une nouvelle livraison activée avant preuve.
- Conserver le travail et les gardes de fermeture existants. Aucun effacement de cache/données, `skipWaiting()` ou rechargement forcé des fenêtres.

## Réception

Tests causaux contre le vrai contrôleur : publication B non découverte par vérifications locales, découverte via recherche réseau ; coalescence, erreur/délai, retour visibilité/réseau et arrêt de surveillance. Parcours réel avec fenêtre A ouverte avant publication B, données/saisie conservées, puis fermeture des fenêtres et adoption B. Contrôle de la fiche recette et des commandes de langue après transition. Tests complets et manifeste généré avant publication autorisée dans la session.

Une fenêtre exécutant un ancien code ne reçoit pas rétroactivement ce nouveau détecteur. La fermeture/réouverture conservatrice reste nécessaire une première fois sur l’appareil de Neegan ; aucun accès à ses données privées ni modification de ses réglages Chrome.
