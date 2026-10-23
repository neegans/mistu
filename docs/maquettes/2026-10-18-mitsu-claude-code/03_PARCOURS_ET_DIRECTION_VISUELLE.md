# Mitsu — Parcours utilisateur et direction visuelle

Les maquettes exploratoires du dossier `maquettes/` proposent une direction à adapter à Mitsu. Elles ne constituent ni une application implémentée ni une preuve du fonctionnement de l’importation. Les titres, recettes, quantités, pages et nombres affichés sont fictifs.

## 1. Intention générale

Mitsu doit évoquer un carnet de cuisine personnel : chaleureux, lisible et facile à enrichir. Le parcours principal transforme un livre photographié ou une recette web sauvegardée en contenu consultable dans l’application, avec une intervention minimale de l’utilisateur.

La direction visuelle associe un fond crème, des accents olive et des tons naturels. Une typographie avec empattements caractérise les titres; une police sans empattements facilite la lecture des commandes, métadonnées et étapes. Garder une hiérarchie simple et des espaces généreux.

L’interface parle de livres, de recettes, de photos et d’importation. Les termes de mise en œuvre tels que « database », modèle, schéma ou passerelle n’ont pas leur place dans ce parcours.

## 2. Références fournies

Les sept images fournies représentent les écrans suivants :

| Fichier | Intention de l’écran |
| --- | --- |
| `maquettes/web/01_bibliotheque.png` | Bibliothèque sur ordinateur : livres, recettes et points d’entrée pour ajouter du contenu. |
| `maquettes/web/02_import_livre.png` | Importation d’un livre : couverture, pages de table des matières et progression compréhensible. |
| `maquettes/web/03_recette_enregistree.png` | Lecture d’une recette enregistrée : illustration éventuelle, source, ingrédients et étapes. |
| `maquettes/mobile/01_bibliotheque.png` | Accès mobile aux livres et recettes, avec une action d’ajout facilement accessible. |
| `maquettes/mobile/02_import_livre.png` | Capture mobile de la couverture et ajout de plusieurs pages de table des matières. |
| `maquettes/mobile/03_recette_enregistree.png` | Consultation mobile d’une recette, pensée pour cuisiner et faire défiler les étapes. |
| `maquettes/mobile/04_import_recette_ciblee.png` | Importation du contenu d’une recette déjà répertoriée dans un livre. |

Les formats de référence sont 1 440 × 1 024 px sur ordinateur et 390 × 844 px sur mobile. Ces dimensions cadrent les maquettes : elles ne limitent ni la hauteur des écrans réels ni le défilement.

## 3. Ajouter un livre

L’utilisateur choisit « Ajouter un livre », photographie sa couverture ou sélectionne une image. Mitsu propose automatiquement les renseignements qu’il peut lire. Les champs restent modifiables, sans obliger à ressaisir des informations déjà reconnues.

L’étape suivante accepte plusieurs photos de la table des matières en une seule opération. Chaque vignette permet une prévisualisation, une suppression et un changement de position. Mitsu propose l’ordre lorsque les indices le permettent; l’utilisateur peut le corriger.

Après extraction, la table des matières présente les sections, les recettes et les pages disponibles. Une entrée sans texte de recette est indiquée « À importer ». Ce libellé désigne ici une référence existante, et non une recette entièrement enregistrée. Les numéros de page du livre restent distincts des positions des photos.

## 4. Importer une recette déjà répertoriée

**C’est la précision prioritaire donnée par l’utilisateur : toucher une recette « À importer » ouvre l’importation de cette recette précise.** Son titre, son livre et son numéro de page éventuel sont déjà connus. Le parcours conserve cette association jusqu’à l’enregistrement.

L’écran propose deux zones distinctes :

- **Pages de la recette** : prendre une ou plusieurs photos avec l’appareil photo, choisir des images existantes, ajouter d’autres pages, supprimer une image et réorganiser les pages.
- **Photo du plat — facultatif** : photographier le plat ou une illustration du livre, choisir une image, puis la remplacer ou la retirer au besoin.

La photo du plat n’est pas confondue avec les pages contenant les ingrédients et les instructions. Si une illustration pertinente figure déjà dans une page importée, Mitsu peut ultérieurement proposer de l’en extraire par recadrage. Cette suggestion doit rester corrigeable et ne doit jamais bloquer l’extraction du texte.

L’action principale, « Extraire et enregistrer », lance le traitement des pages dans leur ordre courant. Le résultat complète la recette ciblée : il ne crée pas une seconde fiche. Mitsu extrait automatiquement le contenu; il demande une intervention seulement lorsqu’une ambiguïté, une erreur ou une information essentielle manquante le justifie. La correction manuelle reste accessible.

Une progression visible confirme que l’opération continue. En cas d’échec ou d’extraction incomplète, l’utilisateur comprend ce qui manque et peut relancer le traitement sans perdre les éléments déjà conservés.

## 5. Lire une recette et comprendre son état

La fiche enregistrée présente le titre, la provenance, la photo éventuelle, les portions, les durées présentes, les ingrédients et les étapes. L’absence de photo n’empêche pas l’accès au contenu.

L’état du traitement appartient au journal d’importation : en attente, en cours, réussi ou échoué, selon les conventions retenues dans le projet. Il ne faut pas créer un vocabulaire concurrent pour les recettes. Une recette ne devient « Disponible » qu’après un enregistrement réussi du contenu requis; une extraction incomplète conserve un état approprié et une indication claire.

## 6. Adaptation et accessibilité

Prévoir une interface responsive à partir de 320 px de largeur, sans réduire excessivement les caractères pour reproduire une composition. Les écrans défilent naturellement. Les principales cibles tactiles mesurent au moins 44 × 44 px; les contrastes, libellés et états de focus doivent rester lisibles.

Le réordonnancement fonctionne au toucher et au clavier. Le glisser-déposer doit avoir une alternative, par exemple « Monter » et « Descendre ». Les boutons de suppression disposent de noms accessibles explicites. Les états ne reposent pas uniquement sur la couleur.

## 7. Limites des maquettes

Les images générées peuvent contenir des erreurs de texte, de statut ou de cohérence. Les exigences de ce document et les données réelles priment. Une vignette supplémentaire ou décorative ne doit pas être interprétée comme une cinquième page réelle de table des matières. Les miniatures illustrent une organisation visuelle, pas une extraction OCR vérifiée.

Ne pas intégrer les maquettes comme des captures d’écran tenant lieu d’interface, ni utiliser leurs photos ou leur contenu culinaire fictif comme des recettes réelles. Traduire la direction retenue en composants accessibles, reliés aux véritables données et au parcours d’importation décrit ici.
