# Confort de lecture mobile — réception

31 octobre 2026. Demande de captures, inspection et ajustements UI/UX. Base `f21bc2a`, public 0.32.10-1 avant cette passe. [Contrat](../specs/2026-10-31-confort-lecture-mobile-design.md) · [Comparatif des huit écrans](../../audits/2026-10-31-confort-mobile.md).

## Résultat visible

- Accueil : titre équilibré, exemples accessibles au clavier ; recherche conservant une largeur utilisable avec le texte à 200 %.
- Bibliothèque : premier titre à 593 px au lieu de 818 px sur le même écran de 390 px. Les cartes reviennent sur une colonne de texte lorsque les caractères sont agrandis.
- Ajouter : six choix visibles au lieu de quatre à 390 px. Choix des pages conservé, déjà lisible.
- Livre : le geste de saisie manuelle révèle les champs et place le focus sur Titre avant le stockage ; son libellé reste visible. Aucun retour tardif du focus.
- Fiche : commandes alignées et accès direct Lire la recette, sans modifier langue, version, onglet, coches, route ni données.
- Cuisine : options repliées, contrôleurs conservés, avertissements visibles. Le premier paragraphe de la recette de démonstration se lit au-dessus de la navigation. Bilan conservé.

## Preuves

Tests comportementaux nouveaux : **20/20 lecture**, **39/39 entrées**, **27/27 cuisine**, soit **86 assertions**. Rouge causal : lecture 8 échecs sur 16, entrées 14 sur 39, cuisine 12 sur 25. Les quatre contrôles supplémentaires de reprise de lecture et les deux témoins de non-vol du focus en cuisine complètent ces séries. Les premiers oracles d’identité DOM comparés comme JSON ont été remplacés par une comparaison d’identité avant les rouges probants.

Régressions ciblées : entrées 163/163 (accueil, livre, photos), cuisine 125/125 (cuisine, écran allumé, voix), carnet 301/301, thème 81/81, fiche lisible 26/26. Ce sont des groupes de modules, pas un total de scénarios uniques additionné aux nouveaux tests. Outils Node **281/281**, outils CI **29/29**. Suite complète locale **14963/14963** sur 0.32.11-3, épingle14962 (+86), zéro erreur JavaScript, 29 journaux simulés attendus. Reçu `artifacts/ci-navigateur/passage-QLbMda/resultat.json`, 19:35:55–19:39:51UTC. La quatrième livraison ne change que la disposition CSS des boutons ; lecture20/20 et thème81/81 rejoués, parcours11/11 et captures390/1280 reçus. La CI du commit final est également verte, comme indiqué dans le reçu de publication ci-dessous.

Captures fraîches avant/après, profils jetables, mêmes données fictives. Dix-sept PNG conservés dans le comparatif. Matrice 320/390/1280 px, français/anglais, texte à 200 %. Vrais Tab, Entrée et Espace ; focus et défilement de la saisie manuelle mesurés. Parcours fiche/cuisine **11/11**, avec vrai clic Lire la recette, focus de région, ouverture des options et livraison exécutée 0.32.11-4. Zéro erreur JavaScript ni requête extérieure/POST dans ces parcours. Navigateurs fermés.

Revue indépendante : le premier style compact coupait le repli d’une photo illisible. Même composant, CSS avant/après, bouton de récupération entièrement visible et centre cliquable : **2 rouges**, puis **2/2 verts** après remise du repli à pleine largeur. Les photos décodées gardent leur vignette compacte. Aucun autre défaut confirmé après relecture.

## Itérations et limites

Le premier dialogue capturé pendant son animation a été rejeté puis repris stable. Deux essais de prévisualisation ont attendu un accueil indisponible avant régénération de la livraison ; ils ne constituent pas des captures reçues. La génération après gel a permis les parcours complets.

La livraison locale 0.32.11-1 a révélé une cascade d’affichage sur ordinateur, le libellé Titre coupé et la recherche trop étroite à 200 %. Retouches reçues sous 0.32.11-2. La troisième livraison corrige le repli photo illisible et la marge vide du groupe Modifier. Les cinq captures normales de la troisième sont identiques en octets à la deuxième ; les cas touchés sont rejoués, sans répéter inutilement toute la matrice. Un locator de la carte à 200 % ciblait six éléments : montage corrigé avec sélection du premier, reçu initial conservé.

La vérification complémentaire de la fiche à320px/texte200% a révélé des libellés secondaires qui se chevauchent. La quatrième livraison remplace les trois colonnes fixes par un groupe avec retour à la ligne ; les captures normales390/1280 sont reprises et inspectées. À320px/texte200% français et anglais, les quatre boutons occupent254px et ne débordent plus. En cuisine, options et ingrédients ouverts,24/24 contrôles et74/74 caractères non blancs de la première étape restent atteignables par défilement réel ; l’encombrement des deux barres à cet agrandissement est identique avec le CSS antérieur, sans régression attribuée à cette passe.

Aucun contenu personnel, compte privé, appel assistant payé, SQL ou changement serveur. Pas de certification VoiceOver, d’essai caméra native ni de PWA sur iPhone physique. Les avertissements de traduction et les champs secondaires du livre restent disponibles ; la fiche non traduite peut encore être longue, avec désormais un accès direct à sa lecture.

## Livraison

APP_VERSION **0.32.11**, livraison **0.32.11-4**, DB 6 / archive 7 inchangés. Manifeste **217 ressources**, **3 802 012 octets**, SHA256 `49c69f3c0b79099baed65401e457dacec3f8be0f54fb0a876922247000322617`. Code `1543b07051271560753f3294ab447cd29a947f08`, promu par avance rapide sur main. [Pages](https://github.com/neegans/mistu/actions/runs/41235645578) terminé à19:45:18UTC (15h45HAE). **472/472 fichiers publics conformes**, dont217 ressources et233 fichiers de tests : octets, SHA256 et MIME identiques au commit, alias et relectures conformes. Reçu `publication/fichiers-tBZOj1/publication-fichiers.json`, 19:46:07–19:46:12UTC.

**26/26 contrôles publics** : parcours fiche/cuisine11/11 (ordinateur et390px), accueil/bibliothèque/ajout/livre/lecture15/15 (390px), captures publiques inspectées. Livraison4 réellement exécutée ; vrais gestes clavier, focus et défilement, route et données conservées. Zéro erreur JavaScript/POST/requête extérieure ; le second parcours contrôle également console et HTTP. Données de démonstration, profils jetables, navigateurs fermés.

[CI du code publié](https://github.com/neegans/mistu/actions/runs/41235720538) **verte** :281/281 outils Node,29/29 outils CI et14963/14963 navigateur ; génération0.32.11-4 conforme. Suite Chromium terminée à19:52:08UTC, job124638963547 terminé à19:52:12UTC. Bilan extrait des journaux du job. La publication documentaire suivante ne modifie aucun octet produit/test/outillage.

Traces : `.superpowers/sdd/2026-10-31-ui-mobile-lecture/` (root, agent1, agent2, agent3). Les captures choisies pour la comparaison sont également suivies sous `docs/audits/2026-10-31-confort-mobile/`.
