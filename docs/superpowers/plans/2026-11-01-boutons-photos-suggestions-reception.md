# Boutons photo et suggestions — réception

1er novembre 2026. Base publique `cd6dbc1`, branche `boutons-photos-suggestions`. [Spec acceptée](../specs/2026-11-01-boutons-photos-suggestions-design.md) · [Captures inspectées](../../audits/2026-11-01-boutons-photos.md).

## Résultat fonctionnel

Le sélecteur est déclenché directement dans le geste, sans attendre IndexedDB : livre/index/recette/couverture, formulaire I2, photo du plat, photos des cuissons, ajouts et remplacements de sources. La capture métier commence avant l’ouverture et reste la même jusqu’à la transaction ; compte, base, cycle et vue sont revalidés. Une nouvelle tentative invalide un travail actif, sans supprimer une sélection déjà en attente de réessai si le nouveau choix est annulé.

La fiche livre distingue refus du sélecteur, image illisible, changement de portée et stockage refusé. Après un refus de stockage, les fichiers restent disponibles pour un réessai. Une erreur de notification ou de navigation après un commit n’est plus prise pour un échec de conservation et ne peut plus proposer de créer une seconde séance.

Les commandes photo suivent la carte sélectionnée ; boutons natifs et état annoncé. Les catégories retenues disent « Ajoutée au brouillon », les propositions restantes ont un ajout individuel et la saisie manuelle un libellé distinct. Une seule croix, cibles 44 px, état de sauvegarde réel, doublons et limites expliqués. Les listes, facettes, union des cuisines et provenances sont conservées. Aucun changement de classification automatique, schéma, SQL ou fonction assistant.

## Tests ciblés

| Module | Assertions finales | Preuve avant correction |
| --- | ---: | --- |
| Accueil livre | 30 | 14/30 |
| Ouverture livre | 42 | 24/42, vraie lecture de compte suspendue |
| Conservation livre | 33 | 24/31 avant le réessai ; deux témoins d’annulation ajoutés |
| Gardes livre | 11 | 10/11, ancienne préparation réappliquée après annulation suivante |
| Présentation après commit | 8 | 1/4, seconde séance et seconde page après réessai indu |
| Photos annexes | 45 | 33/42 puis 43/45 sur une tentative tardive |
| Sources et import ciblé | 60 | 39/48 puis douze voisins de confirmation/transaction |
| Suggestions et geste I2 | 60 | 16/43 au premier rouge ; quatre rouges précis sur le geste I2 ; garde d’union éprouvée par mutant |

Total ajouté : **289 assertions**, sans retrait d’assertion historique. Épingle15373, bilan complet reçu **15374/15374**. Aucun ancien test retiré.

Régressions ciblées : sources L5 51/51, import ciblé 712/712 ; remplacement photo 75/75, cuisine 65/65, helper 43/43 ; I2 historique 57/57, conservation 65/65, confort des entrées 39/39. Les deux écarts Carnet initiaux venaient du placement de l’état photo : corrigés dans le produit en plaçant le message dans l’en-tête et en ne lui donnant un style d’avertissement qu’en présence d’un message. Assertions Carnet inchangées.

## Réception visuelle et réelle

Accueil FR/EN à 320/390 px, clavier Entrée/Espace puis Tab. Suggestions : 40/40 contrôles, huit PNG ouverts ; ajout de deux propositions, retrait, sauvegarde finale et nouveau formulaire relu, provenance exacte. Première inspection 36/36 insuffisante : les mentions inline étaient collées, défaut visuel corrigé puis mesuré dans le reçu final.

Application réelle Chromium tactile 390 × 844, **25/25** sur 0.32.13-2 : deux annulations puis choix sur quatre entrées, quatre JPEG décodés/conservés, rechargement hors ligne et identité exécutée vérifiée. Six PNG ouverts ; zéro erreur JavaScript/console/HTTP, POST ou requête extérieure. La première passe sur 0.32.13-1 pendant le changement de livraison n’est pas comptée comme verte (23/25).

Complément WebKit27.2 : ouverture/annulation du livre **42/42**, sans erreur JavaScript/console, POST ou requête extérieure. La présentation système est neutralisée dans ce test ; il atteste le raccord du consommateur et du helper.

Aucun iPhone physique, caméra iOS, permission Safari, installation standalone ou VoiceOver testé. Un `filechooser` automatisé ne démontre pas les restrictions d’activation de l’appareil. Les tests suspendent volontairement les lectures pour prouver l’ordre de nos propres appels.

Reçus locaux : `.superpowers/sdd/2026-11-01-boutons-photos/{root,agent1}/` et `.superpowers/sdd/2026-11-01-boutons-photos-suggestions/{agent2,agent3}/`. Bases jetables, sans compte personnel ni appel assistant payé.

## Vérifications complètes et livraison

Outils Node **281/281**, outils CI **29/29** ; générateurs migrations et livraison conformes. Premier passage navigateur interrompu sur une console inattendue de la fixture L6 : `import_cible.enregistrer / ErreurVersionStructuree`, reçu `artifacts/ci-navigateur/passage-xwsywe`. Aucun succès complet attribué à ce passage. Le cas photo avec course attendait le bouton initial encore actif pendant la confirmation, puis fermait la base trop tôt. Le rejeu isolé reproduit les 22 assertions vertes suivies de `parent_invalide`. Même délai contrôlé de 120 ms : ancienne attente → base changée/console ; attente du bouton réellement rerendu → base stable/aucune console. Correction limitée à l’attente de `tests/l6-complements-groupes.js`, 22/22 sans interception ensuite ; assertions et liste des consoles admises inchangées. Le passage suivant termine **15371/15373** : seul défaut de scénario restant, L5 annulation attendait encore une confirmation avant le sélecteur et renvoyait une sélection vide. Son bloc interrompu explique le décalage de l’épingle. Le nouveau contrat impose le choix dans le geste, puis la confirmation avant écriture. Le test choisit donc un fichier puis refuse la confirmation : assertion d’ordre mise à jour (un sélecteur au lieu de zéro), comparaison intégrale du journal conservée, aucun retrait d’assertion. L’annulation du sélecteur sans confirmation est couverte séparément par les nouveaux tests de sources. Dernier passage complet **15374/15374**, `artifacts/ci-navigateur/passage-XbtdLd/resultat.json`, aucune erreur JavaScript, console inattendue, HTTP ou extérieure ; 29 journaux simulés attendus. Les 13 assertions L5 sont à nouveau exécutées, le total revient exactement à l’épingle prévue.

APP_VERSION **0.32.13**, livraison **0.32.13-2**, DB6/archive7 inchangés. Manifeste217 fichiers/3825440 octets, SHA256 `72f9bbd34ed1b72e49eeac389b9d66eedd9f1ad8cb0103dce071f165707a4a07`. Code `e910b69ef7b3524db4d2adfd52036e5b0eb01328` promu par avance rapide et poussé sur main. [GitHub Pages](https://github.com/neegans/mistu/actions/runs/41321503688) réussi le 1er novembre à15:30:23UTC (10h30HNE).


## Réception publique

**472/472 fichiers contrôlés identiques** : octets/SHA256/MIME conformes, dont217 ressources de livraison,243 fichiers de tests, rapport et sept PNG ; deux alias et quatre relectures conformes. Comparaison15:31:00–15:31:03UTC, reçu `publication/fichiers-3lTVju/publication-fichiers.json`. Cet inventaire cible les sept captures du présent lot ; celui du lot précédent en comptait vingt. Les444 chemins du reçuG restent présents.

Parcours public **25/25**, livraison exécutée0.32.13-2 et empreinte72f9bbd3… confirmées. Quatre JPEG conservés puis relus hors ligne ; trace de12 ouvertures,8 annulations synthétiques et4 événements change avec fichiers. Six PNG publics ouverts et inspectés. Zéro erreur JavaScript/console/HTTP, POST ou requête extérieure ; navigateur fermé. Reçu `agent1/public-0.32.13-2/resultat.json`. Aucun essai caméra/PWA physique ajouté à cette réception.

La [CI du commit exact publié](https://github.com/neegans/mistu/actions/runs/41321504183) est **verte** :281/281 outils Node,29/29 outils CI, **15374/15374 navigateur** et manifeste conforme. Bilan navigateur à15:35:10UTC, job124892546435 terminé à15:35:15UTC, run confirmé à15:35:16UTC. Reçu CI `passage-FREbWo`. La mise à jour finale des documents ne change aucun octet de la livraison.
