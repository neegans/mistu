# Confort de lecture et navigation mobile

31 octobre 2026. Demande explicite : capturer les écrans actuels, les inspecter puis ajuster l’interface. Base publiée0.32.10-1, commitf21bc2a. Cette demande autorise les ajustements ; aucune relecture personnelle de ce document n’est attribuée à Neegan.

## Constats observés avant modification

Captures fraîches de l’application locale, Chromium390×844, données fictives, sans compte ni appel extérieur. Les fichiers ouverts sont conservés dans `.superpowers/sdd/2026-10-31-ui-mobile-lecture/agent3/avant/` et `root/avant/`. Le premier cliché de dialogue pris pendant son animation a été rejeté puis repris sans animation.

1. Accueil : le point d’interrogation du titre tombe seul sur une ligne. Les exemples de recherche sont cliquables mais absents du parcours clavier.
2. Bibliothèque : première carte à585px, premier titre à818px, sous la navigation basse située à774px. L’image et les commandes occupent l’écran avant les noms des recettes.
3. Ajouter : les cartes verticales mesurent118–140px, avec28px entre deux ; quatre choix seulement sont visibles. Leurs icônes peuvent accompagner les textes à gauche.
4. Choix des pages : écran lisible, aides séparées et cibles photo44px ; conserver sa structure.
5. Ajouter un livre : Saisir à la main révèle les champs mais laisse l’utilisateur en haut, le titre étant vers731px. Le lien de retour ne mesure que17px de haut.
6. Fiche : Cuisiner, Modifier, Actions et le bilan occupent plusieurs rangées ; ingrédients éloignés. La préparation elle-même est lisible et ses minuteries repliées sont utiles.
7. Cuisine : les options de version, langue et écran allumé repoussent la première étape sous la barre Précédent/Suivant. Le bilan est chargé mais lisible, sans défaut bloquant observé après la capture stable.

## Ajustements retenus

Conserver les couleurs crème/olive, polices, cinq destinations, routes, traductions et règles métier. Pas de données culinaires ajoutées, de nouvelle page ni de nouveau fonctionnement serveur.

- Titres mobiles et sous-titres plus équilibrés ; retours d’en-tête avec cible44px. Ne pas réduire les textes de contenu pour gagner de la place.
- Bibliothèque mobile : cartes compactes avec image à côté du texte, titres visibles plus tôt. Conserver tri, présentation, filtres, sélection, contexte et ordre.
- Ajouter : cartes d’action horizontales, icônes existantes, espacement régulier. Aucune action retirée.
- Fiche : action principale claire, commandes secondaires regroupées ; accès direct « Lire la recette » qui déplace le focus et la vue vers son contenu, sans écrire ni changer de route/langue/version. Conserver traduction, avertissements, notes et tous les gestes.
- Cuisine : volet stable « Options de cuisson » initialement fermé pour version/langue/écran allumé. Terminer/Fiche, avertissements, ingrédients et étape restent accessibles ; aucune commande remontee lors d’une actualisation. L’ouverture du volet reste conservée pendant les gestes.
- Accueil : vrais boutons d’exemples au clavier ; saisie manuelle de livre : focus et défilement vers Titre dès le geste explicite, sans attendre le stockage ni voler le focus plus tard.

## Validation

Tests comportementaux rouges avant les nouveaux gestes ; régressions voisines et suite navigateur complète. Captures avant/après aux mêmes dimensions et sur les mêmes données, inspection des fichiers. Vérifier320/390px, ordinateur1280px, français/anglais, texte200%, navigation clavier, cibles44px et absence de débordement/masquage. La capture et l’automatisation ne prouvent pas VoiceOver ou la PWA sur un iPhone physique.

APP_VERSION0.32.11, livraison0.32.11-4 après gel ; DB6/archive7 inchangés. Mettre à jour le reçu et les mémoires. Publication selon l’autorisation de déploiement déjà donnée dans cette session, après validation.
