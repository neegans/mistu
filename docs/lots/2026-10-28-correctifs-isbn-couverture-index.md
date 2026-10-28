# Mito / Cuisine OS — Correctifs d’import des livres et des index

**Date :** 28 octobre 2026  
**Nature :** brief de développement et de validation, à partir du retour de Neegan et des dix images jointes.  
**Statut :** comportements à construire ou à corriger; aucune modification de l’application n’est attestée par ce document.

## 1. Résultat recherché

L’ajout d’un livre doit demander le moins de saisie possible. Un ISBN ou une photo de couverture doit permettre d’identifier l’ouvrage, de compléter sa fiche grâce à une recherche Internet et de proposer des mots-clés et des types de cuisine modifiables.

L’index doit pouvoir être photographié en plusieurs fois, même s’il se trouve à la fin du livre et qu’il est organisé par ingrédients. Mito doit analyser toutes les pages ajoutées, réunir les occurrences d’une même recette et produire une liste unique triée par numéro de page croissant.

**Les trois demandes principales :**

1. Si la recherche par ISBN ne trouve pas le livre dans la bibliothèque ou le catalogue utilisé, lancer automatiquement une recherche Internet.
2. À partir d’une photo de couverture, identifier le livre, effectuer une recherche Internet et préremplir sa fiche, notamment les mots-clés et les types de cuisine.
3. Permettre l’ajout de plusieurs pages d’index et leur analyse commune, puis reconstruire la liste des recettes dans l’ordre du livre.

**Bug supplémentaire visible :** l’application affiche « Lecture coupée : lis moins de photos à la fois. » alors qu’une seule photo est sélectionnée.

## 2. Continuité avec le projet existant

Ce document complète la [spécification Cuisine OS V3 du 7 septembre 2026](https://chatgpt.com/library?file_id=libfile_2abe302ed8688191854f2a76b6735d7e&account_id=personal).

Les principes à conserver sont la bibliothèque personnelle, les références livre/édition/page, les séances de scan reprenables et la distinction entre une recette simplement repérée dans un index et une recette dont le contenu complet a été numérisé.

**Évolution explicite :** pour l’identification et l’enrichissement d’un livre, le recours automatique au Web est maintenant demandé. Il doit être visible dans le parcours, sans imposer de recherche manuelle à l’utilisateur. Cette demande concerne l’import d’un livre; elle ne change pas les modes de recherche générale « Mes recettes / Mes livres / Web / Tout ».

La « bibliothèque » désigne ici celle de Mito et les catalogues qu’il utilise pour identifier les ouvrages.

## 3. Cas réel fourni : Trinity

| Élément | Ce qui est visible dans les pièces jointes |
| --- | --- |
| Livre sélectionné dans l’application | Trinity · Adam Byatt |
| Titre sur la quatrième de couverture | Trinity: The Cookbook |
| Auteur mentionné | Adam Byatt |
| ISBN imprimé | 978-1-83783-622-2 |
| ISBN normalisé | 9781837836222 — chiffre de contrôle valide |
| Domaine imprimé au dos | quadrille.com |
| Document photographié pour l’identification | Quatrième de couverture, avec résumé et code-barres |
| Pages d’index fournies | 310, 311, 312, 313, 314 et 315 |
| Organisation de l’index | Alphabétique, avec ingrédients, catégories, recettes et quelques renvois éditoriaux |
| Mise en page | Plusieurs colonnes, titres sur plusieurs lignes, plages de pages abrégées |

Neegan évoque quatre pages dans son message, mais les pièces jointes comprennent **six pages d’index distinctes**. Le parcours doit fonctionner avec quatre pages comme avec les six fournies, et permettre d’en ajouter ensuite.

La quatrième de couverture mentionne aussi **Trinity: The Repertoire**, un livret inclus. Le système doit distinguer le titre du livre principal du titre de ce complément.

Les données ci-dessus proviennent des images. L’année, l’édition détaillée et la classification culinaire restent à établir lors de la recherche bibliographique; elles ne doivent pas être inventées.

## 4. Recherche Internet de secours après lecture de l’ISBN

### Problème rapporté

Quand le livre n’est pas trouvé par le mécanisme actuel, le parcours ne propose pas le relais automatique attendu vers une recherche Internet.

### Comportement attendu

1. Lire l’ISBN depuis le code-barres ou accepter une saisie manuelle.
2. Normaliser les espaces et les tirets, puis vérifier le format et le chiffre de contrôle.
3. Rechercher l’édition dans la bibliothèque et le catalogue déjà utilisé.
4. En l’absence de correspondance fiable, lancer une recherche Internet ciblée sur l’ISBN exact.
5. Utiliser les résultats pour identifier l’édition et compléter les champs disponibles.
6. Présenter une fiche préremplie que l’utilisateur peut corriger puis enregistrer.
7. Si l’édition existe déjà, proposer d’ouvrir ou de compléter sa fiche, sans créer de doublon.

Un ISBN valide absent d’un catalogue doit déclencher une véritable recherche externe. Répéter le même appel au même catalogue ne constitue pas le comportement demandé.

### Règles de rapprochement

- Prioriser une correspondance sur l’ISBN exact, puis vérifier titre, auteur et édition.
- Privilégier les sources de l’éditeur, de l’auteur ou les notices bibliographiques identifiables.
- Une recherche titre + auteur peut compléter la recherche ISBN lorsque ces informations sont disponibles.
- Si plusieurs éditions restent possibles, présenter les candidates avec leurs différences pertinentes.
- Un ISBN invalide doit être corrigible; ne pas remplacer silencieusement un chiffre pour forcer une correspondance.
- Ne pas confondre le petit code-barres de prix présent à côté de l’EAN avec l’ISBN. La photo fournie contient ce cas.
- Conserver la source des métadonnées, leur date de récupération et les incertitudes.
- Préserver les corrections manuelles lors d’un enrichissement ultérieur.

### États à afficher

- « Recherche dans ta bibliothèque… »
- « Livre non trouvé dans le catalogue. Recherche sur Internet… »
- « Livre identifié — vérifie les informations. »
- « Plusieurs éditions possibles. »
- « Aucun résultat fiable. Tu peux compléter la fiche manuellement. »

En cas de problème réseau, conserver l’ISBN et le brouillon, puis permettre une reprise. L’échec du Web ne doit pas faire perdre la saisie.

## 5. Identification et préremplissage depuis une couverture

### Comportement attendu

1. Accepter une photo de la couverture, de la quatrième de couverture ou de la page de titre.
2. Détecter et corriger l’orientation pour la lecture.
3. Lire les indices disponibles : titre, auteur, ISBN, éditeur éventuel et résumé.
4. Rechercher le livre sur Internet à partir de ces indices.
5. Rapprocher le résultat de la bonne édition.
6. Préremplir les champs justifiés et proposer les catégories et mots-clés.
7. Permettre de modifier, retirer ou compléter chaque proposition avant l’enregistrement.

La photo doit déclencher le travail d’identification; elle ne doit pas servir uniquement d’image décorative dans la fiche.

### Champs à préremplir

| Champ | Règle |
| --- | --- |
| Titre et sous-titre | Respecter le livre principal et les informations de l’édition |
| Auteur ou chef | Lire la couverture et recouper avec la notice |
| ISBN | Conserver l’identifiant exact de l’édition identifiée |
| Éditeur, année, langue | Remplir seulement si l’information est établie |
| Image de couverture | Associer une image correspondant à l’édition, si disponible; conserver aussi la photo d’origine |
| Description courte | Résumer les informations trouvées, avec leur provenance |
| Types de cuisine | Propositions fondées sur la description et le contenu disponible |
| Mots-clés | Propositions modifiables, sans doublons |
| Provenance | Distinguer données lues sur la photo, données Web et suggestions de classification |

« Type de cuisine » peut désigner une tradition culinaire, un style ou une famille de préparations. Ces dimensions doivent rester distinguables : par exemple, origine géographique, cuisine de restaurant, pâtisserie, pains ou poissons/fruits de mer.

Pour Trinity, des mots-clés comme « cuisine de restaurant », « pains » ou « desserts » sont des pistes appuyées par le résumé ou l’index fourni. Une origine culinaire précise doit être vérifiée; la localisation londonienne du restaurant ne suffit pas à classer toutes les recettes du livre.

**Ne pas transformer les mots-clés du livre en garanties sur chaque recette.** Une couverture ou un titre ne permet pas de déterminer les ingrédients complets, les quantités, les temps ou la compatibilité alimentaire.

## 6. Un véritable parcours d’index à plusieurs pages

### Problème rapporté

Neegan ne trouve toujours pas l’option permettant d’ajouter plusieurs pages d’index au même ensemble.

Les captures montrent les boutons généraux « + Photographier » et « + Fichiers », ainsi qu’une action « Index / table des matières ». Elles ne suffisent pas à démontrer que l’ajout est techniquement impossible, mais elles montrent un parcours qui n’explicite pas le regroupement de plusieurs pages d’index.

### Parcours à fournir

1. Depuis le livre ou une séance de scan, choisir **Ajouter un index / une table des matières**.
2. Ajouter des photos successives ou plusieurs images depuis Fichiers.
3. Conserver toutes les pages dans le même ensemble lié à la même édition.
4. Afficher une miniature par image, avec son état et son numéro de page imprimé lorsqu’il est reconnu.
5. Permettre d’ajouter, retirer, remplacer, faire pivoter et réordonner les pages.
6. Afficher clairement **Ajouter une page d’index** et **Analyser les N pages**.
7. Traiter toutes les pages, puis présenter une seule liste consolidée.
8. Permettre d’ajouter plus tard une page manquante et de mettre à jour le même index.

L’ajout d’une photo ne doit ni remplacer la précédente ni créer une nouvelle séance sans action explicite.

Le mode « Index » doit être distinct du regroupement de plusieurs pages constituant **une recette complète**. Une sélection de pages d’index ne doit pas être importée par défaut comme une seule recette.

### Distinguer les numérotations

| Numéro | Exemple | Usage |
| --- | --- | --- |
| Position de la photo dans la séance | 1 | Ordre de capture ou d’affichage |
| Page imprimée de l’index | 310 | Provenance de l’entrée lue |
| Pages de la recette référencée | 116–119 | Emplacement de la recette dans le livre |

Le champ actuel « p. imprimée » doit avoir un libellé contextualisé. Pour une photo d’index, saisir 310 ne signifie pas que toutes les recettes de cette image se trouvent à la page 310.

## 7. Lecture et consolidation de l’index

### 7.1 Lire la structure entière

Le système doit reconnaître :

- les colonnes et leur ordre de lecture;
- les titres de recettes répartis sur plusieurs lignes;
- les rubriques d’ingrédients, comme « beef » ou « asparagus »;
- les catégories de plats, comme « desserts » ou « canapés »;
- les entrées de recettes autonomes, sans rubrique parente;
- les rubriques qui se poursuivent dans la colonne ou la page suivante;
- les renvois éditoriaux, les noms de personnes et les entrées ambiguës.

Exemple réel : la rubrique « desserts » commence au bas de la page 311 et continue au début de la page 312. Elle doit rester associée aux entrées qui suivent jusqu’à la prochaine rubrique.

Si une page manque, conserver les entrées lisibles et signaler que leur rubrique de rattachement peut être inconnue. Ne pas leur attribuer arbitrairement le dernier ingrédient détecté ailleurs.

### 7.2 Reconstruire les recettes et leurs associations

Une recette mentionnée sous plusieurs ingrédients doit donner **une seule référence de recette**, avec plusieurs associations issues de l’index.

Exemple :

> « roast chicken and pommes purée », pages 116–119, apparaît notamment sous « asparagus », « chicken », « cream », « mushrooms » et « potatoes ».

Résultat attendu : une référence unique, ses pages, ses occurrences sources et les associations explicitement présentes dans l’index.

Ces associations sont des **indices de recherche issus de l’index**, pas une liste complète d’ingrédients ni une recette numérisée.

### 7.3 Dédupliquer sans confondre les recettes

- Comparer au sein de la même édition le titre normalisé et les pages référencées.
- Neutraliser pour la comparaison les variations de casse, d’espacement, de retours à la ligne et de ponctuation typographique.
- Conserver le titre original lisible.
- Réunir les occurrences identiques en conservant toutes leurs sources et rubriques.
- Ne pas fusionner deux recettes uniquement parce qu’elles partagent une page.
- Ne pas fusionner automatiquement deux variantes de gougères à la page 41.
- Si un même titre possède des pages contradictoires, ouvrir un point à vérifier.
- Ne pas fusionner les recettes d’éditions ou de livres différents dans ce traitement.

Le réimport de la même photo ou la relance d’une analyse ne doit pas multiplier les recettes. Les corrections déjà validées doivent être préservées.

### 7.4 Interpréter les plages abrégées et trier numériquement

| Texte imprimé | Interprétation attendue |
| --- | --- |
| 24–6 | 24–26 |
| 98–101 | 98–101 |
| 116–19 | 116–119 |
| 187–90 | 187–190 |
| 200–2 | 200–202 |
| 279–80 | 279–280 |
| 300–1 | 300–301 |
| 114–15, 213 | Deux renvois : 114–115 et 213 |

Conserver aussi la notation originale pour pouvoir vérifier la lecture.

Le tri principal utilise le **numéro de début de la recette**, sous forme numérique. Il ne dépend ni de l’ordre alphabétique de l’index, ni de l’ordre des photos, ni d’un tri de chaînes de caractères.

Une plage 116–119 représente une seule référence couvrant plusieurs pages; elle ne doit pas créer quatre recettes. En cas de renvois discontinus, conserver chaque plage. Un numéro inconnu reste « à vérifier » et ne devient pas zéro.

À page de début égale, utiliser un ordre secondaire stable, par exemple le titre.

### 7.5 Écarter les entrées non culinaires de la liste des recettes

L’index fourni contient notamment :

- « Byatt, Vicki » : 36–38, 98, 100;
- « Camilla, Princess of Wales » : 98–101;
- « Charles, Prince of Wales » : 98–101;
- « royal visit » : 98–101;
- « equipment » : 123;
- « wine » : 114–115, 213.

Les noms de personnes, la visite royale et le matériel ne doivent pas créer de recettes. « wine » doit être classé ou vérifié comme renvoi thématique, sans créer une recette pour chaque numéro.

Conserver les éléments écartés dans un relevé consultable. En cas d’incertitude, les montrer séparément plutôt que les supprimer définitivement.

## 8. Extrait de résultat attendu pour Trinity

Ce tableau est un **échantillon de validation relevé dans les six photos**, et non l’inventaire exhaustif du livre. Il illustre le tri croissant et la conservation des titres d’origine.

| Pages de recette | Titre |
| --- | --- |
| 24–26 | Trinity bread |
| 27 | re-formed Trinity bread |
| 28–29 | baguettes |
| 30–32 | smoked salmon and garnishes |
| 34 | cured bass, blood orange, chilli and olive oil |
| 41 | Comté and truffle gougères |
| 41 | devilled egg gougères |
| 41 | pumpkin or squash gougères |
| 44 | canelés |
| 48–50 | milk and honey |
| 56–57 | raspberry tartlets, blackcurrant leaf crème mousseline |
| 90–91 | steamed turbot, courgette flower and fig leaf velouté |
| 94 | steamed fillet of sea bass, English asparagus, caviar and beurre blanc |
| 110 | semi-smoked salmon, beurre blanc, dulse, roe and pickled cucumber |
| 116–119 | roast chicken and pommes purée |
| 138–139 | blanquette of rabbit, prunes and pilaf rice |
| 187–190 | turbot with coco beans and tomato leaves |
| 200–202 | beef tartare, pickled mushrooms, bone marrow and Oscietra caviar |
| 276–278 | slow-cooked short rib, pommes duchesse and smoked bone marrow sauce |
| 279–280 | venison cooked on the bone, quince, walnut and sauce périgueux |
| 300–301 | Trinity mince pies |
| 306 | The Trinity |

L’application doit produire la liste complète des entrées culinaires identifiables dans les pages importées, avec les incertitudes restantes. Elle ne doit pas présenter cet échantillon comme la liste complète, ni inventer des recettes dans les intervalles sans entrée.

Chaque ligne reste au statut **« Repérée dans ton livre — pages X–Y »** tant que le contenu de la recette n’a pas été importé.

### Contradiction réelle à gérer

L’entrée « choux à la crème, hazelnuts and cacao sorbet » apparaît avec des renvois différents :

- page d’index 311, rubrique « chocolate » : **236–8**;
- page d’index 311, rubrique « choux pastry » : **40–1**;
- page d’index 312, notamment sous « hazelnuts » : **236–8**.

Le système doit montrer cette contradiction avec les extraits sources. Même si 236–238 est corroboré par plusieurs occurrences, le renvoi 40–41 ne doit pas être effacé silencieusement. La cause peut être une incohérence du livre; elle ne peut pas être attribuée automatiquement à l’OCR.

## 9. Bugs et observations à traiter

### B01 — Lecture interrompue sur une seule photo — priorité haute

**Observation :** dans `IMG_0630(1).png`, l’interface affiche « 1 page(s) sélectionnée(s) » et « Lecture coupée : lis moins de photos à la fois. ».

**Problème :** demander moins de photos n’offre aucune solution lorsque le lot contient déjà une seule photo. Une page d’index dense doit pouvoir être traitée.

**Correction attendue :**

- détecter qu’une extraction est incomplète;
- conserver les résultats déjà lus et les zones restant à analyser;
- reprendre automatiquement par page, colonne ou zone plus petite;
- vérifier la couverture de toutes les zones avant d’annoncer la fin;
- offrir une reprise ciblée si une zone échoue encore;
- ne jamais annoncer une indexation complète après une réponse tronquée.

**Diagnostic à mener :** limite de sortie, délai dépassé, réponse structurée incomplète, erreur réseau ou traitement du client. Les captures ne permettent pas d’identifier la cause technique.

### B02 — Ajout de plusieurs pages d’index introuvable — priorité haute

**Signalement utilisateur :** impossible de trouver le parcours permettant d’ajouter plusieurs pages d’index.

**Correction attendue :** rendre explicites le mode Index, l’accumulation des photos, le nombre de pages et l’analyse de l’ensemble. Vérifier que les boutons existants ajoutent réellement une page sans écraser les précédentes.

**Réception :** importer quatre pages, puis les six pages de Trinity, en une ou plusieurs séquences, et retrouver un seul index consolidé.

### B03 — Miniature tournée de 90° — priorité moyenne

**Observation :** le texte de la miniature est tourné dans les captures de séance.

**À vérifier :** orientation de l’image, traitement des métadonnées d’orientation, rendu de la miniature et orientation effectivement transmise à l’analyse. Le mauvais aperçu ne prouve pas à lui seul que la lecture utilise la même orientation.

**Correction attendue :** aperçu lisible, orientation cohérente avec l’extraction et commande de rotation manuelle accessible.

### B04 — États d’envoi apparemment contradictoires — priorité moyenne

**Observation :** `IMG_0629(1).png` affiche à la fois « 1 non envoyé » en haut et « 1/1 photos de cette séance envoyées au serveur ».

**Incertitude :** le premier compteur pourrait concerner une autre séance ou un autre type d’élément. La capture ne permet pas d’affirmer qu’un envoi a échoué.

**Correction attendue :** préciser la portée des compteurs et distinguer :

- conservé sur cet appareil;
- photo envoyée au serveur;
- analyse en attente ou en cours;
- analyse terminée, partielle ou en échec.

Si un autre élément reste à envoyer, permettre de l’identifier. Ne pas présenter « photo envoyée » comme synonyme d’« index analysé ».

### B05 — Lisibilité de l’en-tête sur mobile — point à vérifier

**Observation :** sur `IMG_0628(1).png`, le titre de l’application est rogné à gauche; la recherche occupe une grande partie de l’en-tête.

**Vérification attendue :** reproduire sur iPhone les états avec et sans badge d’envoi, vérifier le débordement horizontal et l’accès aux commandes pendant le défilement. Corriger le cadrage si le problème se reproduit.

La notification de conservation locale recouvre aussi temporairement une partie des commandes dans cette capture. Vérifier qu’elle ne bloque pas une action nécessaire.

## 10. Principes d’implémentation proposés

Cette section décrit une cible, à adapter au code existant. Le dépôt et les journaux d’exécution n’ont pas été inspectés.

### Traitement de l’ensemble

Analyser toutes les pages ne signifie pas envoyer toutes les photos dans une seule requête volumineuse. Le traitement peut être découpé, puis les résultats réunis dans un ensemble cohérent.

1. Conserver les images originales et leur rattachement au livre/édition.
2. Identifier les pages imprimées et préparer les images pour la lecture.
3. Lire les pages ou zones dans des traitements de taille maîtrisée.
4. Enregistrer les entrées brutes et leur provenance.
5. Raccorder les rubriques qui traversent colonnes et pages.
6. Normaliser les titres et les références de pages.
7. Classer recettes, rubriques, renvois éditoriaux et ambiguïtés.
8. Fusionner les doublons certains.
9. Produire la liste triée et une file de vérification ciblée.
10. Enregistrer sans écraser les corrections précédentes.

### Données à conserver

| Objet | Informations minimales |
| --- | --- |
| Livre / édition | Identifiant, ISBN, titre, auteur, métadonnées et sources |
| Ensemble d’index | Édition, scans inclus, état global, progression |
| Scan | Image originale, ordre de capture, page imprimée d’index, orientation |
| Zone de lecture | Scan parent, colonne ou position, état d’analyse |
| Occurrence d’index | Texte brut, titre, rubrique et type de rubrique, renvois bruts et interprétés, source |
| Référence de recette | Édition, titre original, pages de recette, disponibilité, vérification |
| Association d’index | Référence de recette, ingrédient/catégorie, occurrences justificatives |
| Point à vérifier | Nature du conflit, valeurs candidates, extraits et décision éventuelle |

Séparer les états de transfert et d’analyse. Conserver une progression par scan ou zone afin de reprendre un échec sans tout recommencer.

Un ajout ultérieur déclenche une mise à jour de l’ensemble. Un remplacement de photo doit permettre de réexaminer les occurrences concernées, sans conserver aveuglément des données devenues obsolètes.

## 11. Scénarios de réception

| Test | Action | Résultat attendu |
| --- | --- | --- |
| ISBN déjà présent | Scanner l’ISBN d’une édition existante | Fiche retrouvée; aucun doublon |
| ISBN absent du catalogue | Scanner 9781837836222 avec une recherche catalogue sans résultat | Recherche Internet automatique et visible |
| ISBN invalide | Modifier un chiffre | Correction proposée; aucun rapprochement silencieux |
| Code-barres secondaire | Lire le dos de Trinity | ISBN distingué du supplément de prix |
| Plusieurs éditions | Obtenir plusieurs notices plausibles | Choix explicite avant de rattacher les pages à une édition |
| Photo de couverture | Importer une couverture identifiable | Recherche Web, fiche préremplie, catégories et mots-clés modifiables |
| Quatrième de couverture | Importer le dos fourni de Trinity | Livre principal distingué de The Repertoire |
| Métadonnée inconnue | Aucune source fiable pour l’année | Champ laissé vide ou signalé à compléter |
| Index de quatre pages | Ajouter les photos une après l’autre | Les quatre restent dans le même ensemble |
| Index de six pages | Importer les pages 310–315 fournies | Toutes sont prises en compte; aucune limite à quatre |
| Ajout ultérieur | Analyser trois pages puis en ajouter trois | Mise à jour du même index sans doublons |
| Ordre mélangé | Importer 315, 310, 313, 311, 314, 312 | Même résultat final, trié par pages de recettes |
| Photo dupliquée | Réimporter une image | Aucun doublon de recette |
| Page dense unique | Analyser la page 310 seule | Lecture complète ou reprise ciblée; pas de conseil impossible « moins de photos » |
| Rubrique continuée | Analyser 311 et 312 | Continuité de « desserts » correctement comprise |
| Recette répétée | Lire toutes les occurrences du poulet p. 116–119 | Une référence, plusieurs associations et sources |
| Recettes sur la même page | Lire les variantes de gougères p. 41 | Variantes distinctes conservées |
| Plages abrégées | Lire 116–19 et 279–80 | 116–119 et 279–280; tri numérique correct |
| Renvois contradictoires | Lire l’entrée choux à la crème | Conflit 40–41 / 236–238 visible et vérifiable |
| Entrée éditoriale | Lire « royal visit » ou « equipment » | Aucune fausse recette créée |
| Réseau interrompu | Couper puis rétablir la connexion après capture | Photos conservées, envoi et analyse reprenables |
| Réponse tronquée | Interrompre une extraction | État partiel et reprise, sans validation complète fictive |
| Correction manuelle | Corriger une page puis relancer l’analyse | Correction conservée ou conflit présenté |
| États de séance | Observer transfert terminé et analyse en attente | Deux états compréhensibles et cohérents |
| Mobile | Tester portrait et paysage sur iPhone | Commandes accessibles, en-tête lisible, pas de débordement bloquant |

## 12. Ordre de travail recommandé

1. **Fiabiliser la lecture d’une page dense et l’ajout de plusieurs pages d’index.**
2. **Consolider, dédupliquer, traiter les conflits et trier les références par page.**
3. **Ajouter le relais Internet pour l’ISBN et la couverture, avec préremplissage.**
4. **Clarifier les compteurs, l’orientation des aperçus et la présentation mobile.**
5. **Valider le parcours complet avec les six pages de Trinity et les scénarios ci-dessus.**

La livraison est réussie lorsque Neegan peut identifier le livre avec un minimum de saisie, photographier tout son index et retrouver une liste de recettes ordonnée, sans perdre de pages ni devoir réparer manuellement les limites de lecture du système.

## Annexe — Pièces justificatives

| Fichier fourni | Contenu utilisé |
| --- | --- |
| IMG_0628(1).png | Séance de scan, photo conservée localement, 0/1 envoyé, miniature tournée, en-tête rogné |
| IMG_0629(1).png | 1/1 envoyé et badge « 1 non envoyé », commandes de capture |
| IMG_0630(1).png | Une page sélectionnée, action Index et erreur « Lecture coupée » |
| IMG_8E6158D0-6FBD-4EA4-B935-FC5EFB39D277.jpeg | Index, page 310 |
| IMG_39DC1E8B-8E75-4D0B-A07B-5C8589744777.jpeg | Index, page 311 |
| IMG_9A7ACAFE-53B4-42FE-A43D-D77231EF3FA0.jpeg | Index, page 312 |
| IMG_834EEA61-8F7E-48D1-BECE-EFDE365E1B88.jpeg | Index, page 313 |
| IMG_1513E7EB-EA23-47B1-B401-6346E81400AD.jpeg | Index, page 314 |
| IMG_0AFE7B2E-7378-4479-B590-B6F6E41158C1.jpeg | Index, page 315 |
| IMG_D12D65FF-5E57-457F-BE54-D3ED24DFFA55.jpeg | Quatrième de couverture, résumé, ISBN et mention du livret inclus |

**Périmètre de vérification :** lecture des pièces jointes et des sections pertinentes de la spécification antérieure. Les bugs sont distingués des hypothèses de diagnostic; les fonctionnalités décrites sont des exigences à implémenter et à tester.

