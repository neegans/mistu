# Correctif de présentation de la fiche recette

31 octobre 2026. Suite au constat de Neegan sur ses captures de 11 h 43. Ce correctif reste dans les parcours de lecture et de traduction déjà demandés ; il ne crée pas de nouveau mécanisme de mise à jour ni de traduction automatique. Aucune relecture personnelle de ce document n’est attribuée à Neegan.

## Constat et références

Les captures montrent la livraison 0.32.0-5 avec 0.32.7-1 en attente. L’ancienne fenêtre ne peut pas recevoir un correctif de code sans être fermée. La version actuelle conserve cependant des défauts de présentation : description vide encombrante, source répétée sous chaque ingrédient, quantités séparées du nom par le retour flex, aides Siri occupant plusieurs lignes par minuterie.

Références : [maquettes fournies](../../lots/2026-10-28-interface-visuelle/), [L6](2026-10-29-l6-ingredients-groupes-traductions-design.md), [L7](2026-10-29-l7-cuisine-minuteurs-design.md), [plan directeur](../../lots/2026-10-29-plan-directeur-interface-fonctions.md). Conserver la palette, les colonnes ordinateur et les onglets téléphone. Aucun temps, niveau ou groupe d’ingrédients ne sera déduit d’une maquette ou d’un texte historique.

## Changements bornés

1. Afficher les descriptions et repères connus. Regrouper l’explication et l’action de complément lorsque la description manque dans un volet fermé. Ne pas afficher de badges vides « Niveau à estimer » et « Temps à estimer » sur la fiche.
2. Conserver une note personnelle renseignée près de la recette. Replier la section de notes lorsqu’elle est vide.
3. Garder quantité et nom d’ingrédient dans le même flux de texte. Regrouper l’accès aux textes source et aux commandes de remplacement sous un bouton « Afficher les détails des ingrédients », sans supprimer ces fonctions. Les incertitudes restent signalées.
4. Quand aucune traduction compatible n’est affichée, annoncer une fois que le texte original est affiché et proposer la création française existante. Éviter de répéter cette même phrase sous chaque passage. Une traduction partielle conserve les indications locales de manque et chaque segment conserve sa langue réelle.
5. Sur la fiche, chaque durée devient une ligne dépliable « Minuterie — durée ». Les commandes Siri/Raccourcis sont accessibles à l’ouverture et gardent leurs garanties. Aucun départ, aucune écriture et aucun choix de durée automatiques. Le mode cuisine et ses minuteries actives restent inchangés.

## Vérification attendue

Comparer des captures avant/après sur ordinateur et téléphone, avec données de démonstration identifiées. Tester absence de traduction, traduction partielle et complète, origine consultable, détails ingrédients au clavier, notes présentes/absentes, durée simple et fourchette. Vérifier que les quantités, étapes, traductions et versions restent identiques. Exécuter les suites concernées puis la suite de référence et les générateurs avant publication.

## Limites

Ce changement ne traduit pas la recette personnelle de Neegan à son insu. Les anciens titres importés comme aliments ne sont pas transformés automatiquement : L6 prévoit une correction explicite créant une nouvelle version. L’activation d’une mise à jour coordonnée entre plusieurs fenêtres serait un autre changement de protocole ; elle n’est pas ajoutée ici.
