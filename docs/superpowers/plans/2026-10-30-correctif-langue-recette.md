# Réception du correctif des boutons de langue

Base : 7fb583c, livraison publique 0.32.0-3. [Contrat](../specs/2026-10-30-correctif-langue-recette-design.md).

## Défauts reproduits et correction

Une fiche anglaise sans traduction française gardait son texte source après sélection de Français. L’explication et les liens de traduction étaient sous les informations de tête, dans Ingrédients, et masqués en Préparation sur mobile. Ce n’était pas une absence de callback : l’interface ne rendait pas compréhensible le résultat du clic.

L’état et les actions se trouvent maintenant sous les boutons de langue. L’original, la langue déjà originale, l’absence de traduction et les candidates concurrentes sont explicités. Le coût est calculé dans la préparation avant lancement ; aucune promesse d’un seul appel pour une longue recette. Les titres et étapes traduits existants restent affichés par la projection commune.

Langue et candidate sont conservées dans l’adresse sans remonter la fiche ni perdre le focus. Un changement de version enlève la candidate liée à l’ancienne version, en conservant la langue. La revue technique a fait reproduire ce défaut avant correction.

Avec assistant=1, la préparation et le lancement de la traduction précèdent les champs. Annuler, réessayer la conservation et récupérer une réponse suivent l’état réel du contrôleur. Aucun appel automatique au changement de langue, à l’ouverture de l’éditeur ou à la préparation du coût.

## Preuves locales

- Fiche : 13 échecs causaux avant déplacement/conservation, puis un échec causal du changement de version ; **24/24** contrôles finaux.
- Éditeur : 7 échecs causaux avant correction, puis **26/26** ; parcours L6 **18/18**, conservation brute L10 **13/13**. Lecture commune L6 **28/28**.
- Vraie application Chrome, bases synthétiques isolées : **24 contrôles**, largeurs1280/390/320, sans débordement ; état près des boutons, Préparation mobile, actualisation, rechargement réseau réellement coupé, entrée assistant, Modifier, Actions, cuisson, saisie de cuisson et bascule d’une traduction existante. Captures relues. Aucun compte privé, requête extérieure ni appel payé.
- Outils Node **271/271**, générateurs, syntaxe des modules modifiés et diff propres.
- Première suite complète de mesure : toutes les assertions métier réussies, seule l’ancienne épingle de total est rouge. Épingle finale11538 : +35 assertions depuis11503, dont24 fiche et11 éditeur ; aucun scénario supprimé. Suite complète finale **11539/11539**, zéro erreur JavaScript et requête extérieure.

## Livraison

APP_VERSION0.32.0, livraison **0.32.0-5** ; le suffixe4 était une génération de travail locale, jamais publiée. Manifeste208 fichiers /3 608 736 octets, SHA256 `48b6b6b1cebfcc672d4ba04c6d91c676fe311679f824ac61e94f3b37e87d93b2`.

DB6/archive7 inchangés, aucun SQL. Revue technique indépendante de la fiche et contribution séparée sur l’éditeur. Les données privées de Trinity bread n’ont pas été lues ; les preuves utilisent une recette synthétique correspondant au cas sans traduction. Aucun essai physique iPhone/Safari ni appel assistant payé revendiqué. Publication et réception publique terminées : code **fbbb76c0f52713f427d8a071ca9ea3bd6eb70e4e**, avance rapide de main, GitHub Pages construit le30octobre à **12:17:36 UTC (08 h17 HAE)**. **235 fichiers publics identiques**, empreintes et MIME conformes ; **11539/11539 tests publics**, zéro erreur JavaScript/requête extérieure. Les **24 contrôles du parcours réel** passent aussi publiquement, dont rechargement hors ligne, traduction existante et commandes principales. Captures publiques relues.
