# Réception — détection des mises à jour

Base :247b2e5, livraison0.32.0-5. [Contrat](../specs/2026-10-30-correctif-detection-mise-a-jour-design.md).

## Constat

La capture de Neegan à08 h43 montre encore les avis et actions de traduction sous Ingrédients : interface antérieure àfbbb76c. Le site sert bien les nouveaux octets, mais la vérification dans une fenêtre neuve ne prouvait pas la transition de sa fenêtre existante. La livraison exacte de cette fenêtre n’a pas été lue ; aucun réglage Chrome ni donnée privée n’a été modifié.

`verifier()` ne demandait aucune recherche de publication sur le réseau, y compris depuis le bouton « Vérifier la mise à jour ». Le bandeau était en outre caché sans attente connue. Un témoin contre le vrai contrôleur et un parcours avec deux vrais workers reproduisent trois vérifications sans requête vers `sw.js`, puis la découverte d’une attente par `registration.update()` explicite.

## Correction

- `rechercherMiseAJour()` séparée de la preuve locale : scope exact, promesse partagée, délai global30s, attente d’installation, état final relu ; erreur réseau/délai distincts d’une recherche réussie. Pas d’activation forcée.
- Surveillance unique dans l’application, visible/en ligne, cadence60s et retours focus/visibilité/réseau ; arrêt sur pagehide, reprise après retour BFCache.
- Réglages propose la recherche même sans attente, affiche la livraison de cette fenêtre et distingue la version prête. Le résultat reste monté malgré les actualisations du moteur. Le bandeau existant utilise aussi la recherche réseau.
- L’indication de recherche résiste aux observations intermédiaires du worker. Aucune navigation automatique, suppression de cache/données ou écriture métier.

## Vérifications

Core : rouge causal avant les nouvelles API, puis45/45 (+32). Interface : trois échecs causaux de recherche absente/localement limitée, puis deux échecs de libellé effacé pendant l’attente ;36/36 finaux (+19). Contre-relecture indépendante sans bloquant, core45/45 rejoué séparément.

Épingle globale11589 : **11590/11590** assertions locales réussies, +51 depuis11539, aucune suppression. Zéro erreur JavaScript/requête extérieure. Node271/271, générateurs/syntaxe/diff propres. Parcours de langue existant24 contrôles verts sur cette livraison.

Transitions réelles Chrome : **63/63 contrôles** finaux — historique0.32.0-3→6 (16), historique5→6 (15), recherche Réglages6→livraison fixture995 (16), retour réseau natif6→fixture995 (16). Témoin ancienne version15/15. Deux fenêtres contrôlées, worker B en attente, saisie et brouillon conservés, fermeture complète puis adoption naturelle et reprise hors ligne. L’écart entre langues et actions passe de616,19px à9,59px. Retour réseau `online` natif confirmé ; focus/visibilité couverts par tests unitaires, sans revendication d’événement natif. Captures relues, aucune erreur JavaScript ni requête extérieure.

La première suite complète a atteint10446 assertions avant la limite de180s du harnais, sans bilan final : elle n’est pas comptée comme une réussite. Même suite relancée avec une limite600s et terminée à11590/11590 ; aucune assertion retirée. Réception publique encore à exécuter. Aucun compte privé, appel payé ou essai physique iPhone/Safari revendiqué.

## Livraison

APP_VERSION0.32.0, livraison **0.32.0-6**. Manifeste208 fichiers /3 617 247 octets, SHA256 `3e3eae2f3622326fdb791171231160d483c0425d57638adf800f80954254be93`. DB6/archive7 inchangés, aucun SQL.

Une fenêtre qui utilise encore l’ancien code ne reçoit pas rétroactivement ce détecteur. Après conservation des saisies, fermer toutes les fenêtres Mistu puis rouvrir l’application permet l’activation naturelle. Le numéro de livraison est ensuite lisible dans Réglages, sans devoir partager les données de recettes.
