# Mistu — boutons photo et suggestions

Date : 1er novembre 2026. Document fourni par Neegan, relu contre le code `cd6dbc1` (livraison0.32.12-3). Périmètre précisé avant construction ; aucun correctif produit appliqué ou déployé par cette relecture.

## Résultat attendu

Sur iPhone, toucher « Photographier » doit ouvrir le choix de prise de photo. Le classement d’un livre doit distinguer les suggestions à ajouter des valeurs déjà retenues. Chaque commande doit produire un résultat visible ou expliquer son indisponibilité.

## Constats et limites

Les deux captures de Neegan montrent l’accueil d’un livre nouvellement ajouté et les familles de préparations/cuisines de sa fiche. Neegan rapporte que Photographier et l’ajout de suggestions ne réagissent pas. La version exécutée sur son téléphone n’apparaît pas dans les captures.

La branche main consultée indique une livraison 0.32.12-3. Son code confirme les points suivants :

| Point | Constat dans le code | Portée |
| --- | --- | --- |
| Accueil du livre | Toucher une carte place les boutons photo/import après les trois cartes. | Les commandes peuvent apparaître loin du choix touché, sous la zone visible. |
| Ouverture des photos | Dans `src/ui/book.js`, `lancer` attend `capturerEdition`, qui effectue une lecture IndexedDB, avant `pickFiles`. Le changement de couverture suit aussi cet ordre. | Piste de blocage du sélecteur sur Safari, à reproduire sur iPhone. La cause exacte n’est pas confirmée. |
| Suggestions de classement | Dans `src/ui/livre-sans-saisie.js`, les valeurs des listes sont rendues comme des boutons de retrait. L’étiquette « Suggestion de classement » décrit leur provenance. | Une suggestion présente dans les champs est déjà retenue dans le brouillon; sa présentation ne le dit pas clairement. |
| Bouton Ajouter | La commande lit seulement le champ de saisie manuelle. Si ce champ est vide, elle ne fait rien et ne l’explique pas. | Ce bouton ne sert pas à accepter les suggestions affichées au-dessus. |
| Deux croix | Le composant ajoute le texte « × » et `.chip.removable::after` en ajoute une seconde. | Doublon confirmé dans le code et visible dans la capture. |

WebKit documente des contraintes d’activation utilisateur et un cas où une ouverture de sélecteur différée reste silencieuse. Ces références étayent la piste technique; elles ne démontrent pas le comportement du téléphone de Neegan.

## Corrections proposées

### Photographier et importer

- Afficher les commandes de source immédiatement auprès du choix index/recette sélectionné et indiquer ce choix. Elles doivent rester accessibles au-dessus de la navigation basse, en défilant si nécessaire.
- Déclencher le sélecteur dans le geste utilisateur, sans attendre une lecture de base avant son ouverture. Préparer le contexte métier à l’avance ou employer un autre agencement qui conserve les gardes de compte, de base et de cycle d’édition.
- Revalider la portée avant toute conservation. Un changement de compte, une édition retirée ou une navigation pendant le choix ne doit pas rattacher les photos à une autre cible.
- Conserver les chemins caméra et photos/PDF, ainsi que l’annulation et la réouverture. Distinguer erreur de sélection, image refusée, erreur de conservation et changement de livre; le message actuel ne doit pas attribuer tous les échecs à un livre modifié.

### Suggestions et saisie manuelle

- Pour une valeur déjà présente dans les champs, afficher clairement « Ajoutée au brouillon » avec une seule commande de retrait. Conserver la provenance « Suggestion de classement » comme information secondaire.
- Si une proposition n’a pas encore été retenue, lui donner une action explicite « + Ajouter ». Après acceptation, la valeur apparaît une seule fois parmi les valeurs retenues.
- Identifier le champ libre par « Ajouter une autre catégorie ». Désactiver son bouton lorsqu’il est vide et expliquer les refus de valeur ou les doublons.
- Afficher une seule croix. Ne pas annoncer « Enregistré » avant la réussite de l’écriture correspondante. Le statut du brouillon reste distinct de l’enregistrement final de la fiche.
- Garder les dimensions existantes : origines, styles, familles de préparations, autres cuisines et mots-clés. Aucun changement de classification automatique ni nouveau schéma de données n’est nécessaire au périmètre proposé.

## Validation avant livraison

1. Ajouter un livre, choisir index, puis Photographier : le choix s’ouvre et le retour conserve l’intention index et la bonne édition. Rejouer avec recette et avec import de photos/PDF.
2. Annuler, puis rouvrir deux fois : boutons utilisables, aucune séance vide ni appel assistant lié à l’annulation.
3. Accepter un vrai JPEG de test : aperçu puis conservation et relecture après rechargement. Une panne d’écriture affiche un échec et un réessai.
4. Changer de compte, de base ou de cycle pendant le choix : aucun rattachement ou enregistrement dans une nouvelle portée.
5. Vérifier une valeur déjà retenue, une proposition encore disponible et une saisie manuelle : ajout unique, retrait effectif, champ vide désactivé, doublon expliqué. Enregistrer puis rouvrir la fiche pour vérifier les valeurs finales.
6. Contrôler une seule croix et l’accès aux commandes à 320 et 390 px, en français et en anglais.
7. Exécuter les contrôles du dépôt. Séparer les résultats automatisés de la réception physique sur iPhone/PWA : un événement `filechooser` simulé ne prouve pas l’ouverture de la caméra iOS.

## Précisions issues de la relecture du code

### Ouverture immédiate et garde de la cible

Le helper `pickFiles` ouvre déjà son input sans attente. Le raccord à corriger est celui de la vraie fiche livre, pour les pages d’index, les pages de recette et le remplacement de couverture. Les cartes d’accueil doivent rendre leurs commandes auprès du choix activé, avec un état explicite et des boutons natifs accessibles ; une simple couleur ne suffit pas à annoncer le choix.

Agencement à vérifier par les tests : démarrer `capturerEdition` pendant le geste, sans attendre sa résolution, gérer immédiatement son éventuel rejet, puis appeler `pickFiles` dans la même pile d’appel. Après réception des fichiers, utiliser cette capture exacte. Ne pas capturer de nouveau le compte ou le cycle après le choix : cela pourrait légitimer une autre cible. Une capture préparée au montage est une alternative seulement si elle garde les mêmes invariants.

La validité locale de la vue et de la tentative doit s’ajouter aux gardes transactionnelles déjà présentes. Vérifier aussi la navigation après retour du sélecteur, pendant le traitement de l’image et juste avant la conservation. Annuler ou remplacer une tentative invalide ses résultats tardifs. Une promesse de capture rejetée alors que le choix est encore ouvert ne doit produire aucune erreur non gérée.

Le signalement WebKit cité porte précisément sur un passage par `MessageChannel`. Il ne démontre pas que toute attente ou microtâche invalide le geste, ni qu’IndexedDB est la cause du défaut sur le téléphone de Neegan. Le test causal de notre raccord doit prouver l’ouverture demandée avant la résolution d’une capture volontairement suspendue ; la réception physique iPhone/PWA reste distincte.

### Trois états de classement à distinguer

1. **Valeur retenue** : présente dans `draft.fields`. Elle est déjà dans la saisie, qu’elle provienne d’une suggestion ou d’une modification manuelle. Afficher son état, sa provenance disponible et un seul retrait ; aucune action « Ajouter » pour cette même valeur.
2. **Proposition disponible** : présente dans `draft.proposals` parce que le champ a déjà été touché. Pour une catégorie de liste réellement absente, « + Ajouter » doit conserver les valeurs déjà retenues et les autres dimensions, ajouter une seule fois la proposition validée, puis actualiser l’état de cette proposition. Ne pas appliquer un remplacement de toute la liste sous un libellé d’ajout. Les conflits sur les champs simples, comme le titre, gardent leur décision explicite de remplacement.
3. **Information incertaine** : écartée par les validateurs et signalée « À vérifier ». Elle ne devient pas une suggestion acceptable uniquement pour alimenter le nouvel affichage. La validation et la classification automatique restent celles du domaine existant.

« Ajoutée au brouillon » désigne la présence dans la saisie. L’état de sauvegarde du brouillon doit indiquer séparément une écriture en cours ou refusée ; l’ajout final à la bibliothèque reste une autre opération. Ne pas perdre la provenance des autres valeurs lors d’un ajout ou retrait.

La saisie libre garde les bornes existantes :80 points de code par valeur,20 valeurs par liste et dédoublonnage normalisé. Un champ vide ne déclenche aucun geste. Une valeur déjà présente, une limite atteinte ou un refus de validation produit une explication locale et conserve le texte utile à corriger. Employer un libellé adapté pour les mots-clés, tout en gardant « Ajouter une autre catégorie » pour les catégories.

Le dédoublonnage reste propre à chaque liste. Le champ `cuisines` contient déjà l’union des trois facettes : ne pas supprimer une origine ou un style au seul motif qu’il apparaît aussi parmi les cuisines. Le composant historique `puces.js` a d’autres limites ; sa réutilisation ne doit pas changer les bornes I2. L’ancien parcours couverture possède ses propres suggestions non choisies et reste distinct des valeurs préremplies du formulaire I2.

### Réception complémentaire

- Fiche livre réelle, capture suspendue : vérifier que le choix de fichiers est demandé avant toute résolution, pour index, recette et couverture ; le contrôle doit échouer avec l’ordre actuel.
- Tester aussi un rejet de capture pendant le sélecteur, les résultats tardifs de deux tentatives et la navigation entre sélection et transaction.
- Tester des propositions réellement présentes dans `draft.proposals`, sans modifier le comportement des suggestions incertaines ; l’ajout d’une catégorie ne remplace aucune autre valeur ou dimension.
- Champ vide, doublon avec accents/casse, limite atteinte et refus de stockage : résultat visible, texte conservé si une correction reste nécessaire, aucun faux succès.
- Vérifier la croix rendue, y compris le pseudo-élément CSS, et les noms accessibles des commandes. La seule recherche d’une chaîne dans le code ne prouve pas ce résultat.

## Mise en œuvre

Écrire d’abord les tests de comportement qui reproduisent les défauts. Conserver les écritures par le dépôt et les traductions par `t()`. Suivre les règles de version et de génération de livraison de `AGENTS.md`. Aucun SQL ni changement de fonction assistant prévu.

La règle de revue applicable est : « Spec d’abord (`docs/superpowers/specs/AAAA-MM-JJ-<lot>-design.md`), relue par Neegan, puis construction en petites tâches testées ». La présente fiche constitue le périmètre à relire, sans attribuer d’approbation à Neegan.

## Références

- [Consignes du dépôt](https://github.com/neegans/mistu/blob/main/AGENTS.md)
- [Accueil du livre](https://github.com/neegans/mistu/blob/main/src/ui/accueil-livre.js)
- [Déclenchement des photos depuis le livre](https://github.com/neegans/mistu/blob/main/src/ui/book.js)
- [Gardes du contexte d’édition](https://github.com/neegans/mistu/blob/main/src/ui/recette-garde.js)
- [Listes de classement et ajout manuel](https://github.com/neegans/mistu/blob/main/src/ui/livre-sans-saisie.js)
- [Style des étiquettes](https://github.com/neegans/mistu/blob/main/styles.css)
- [Activation utilisateur dans WebKit](https://webkit.org/blog/13862/the-user-activation-api/)
- [Signalement WebKit sur un sélecteur différé](https://bugs.webkit.org/show_bug.cgi?id=328902)
