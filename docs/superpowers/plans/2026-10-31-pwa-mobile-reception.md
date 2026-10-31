# Téléphone et PWA — réception des ajustements

31 octobre 2026. Base49385dd/public0.32.11-4. [Contrat](../specs/2026-10-31-pwa-mobile-design.md) · [Comparatif avec20 captures](../../audits/2026-10-31-pwa-mobile.md).

## Résultat

Menus simples réellement44px dans WebKit (88px avec texte200%), flèche native conservée ; listes multiples inchangées. Bilan focalisé sur son titre, défilement initial0. Bibliothèque : commandes secondaires repliées seulement en mobile, recherche directe, mêmes contrôles et même sélection. Repas : résumé portions/date factuel, organisation repliable, plats accessibles plus tôt ; paramètre de présentation local à l’adresse pour garder l’ouverture après refresh et rechargement, sans écriture métier. Titre/date des listes espacés. Cuisine : barre dans le flux en faible hauteur et quand le menu global y revient, double marge basse supprimée. Marges latérales env() et titres de paysage ajustés.

## Construction et tests

Nouvelles assertions : bilan27, bibliothèque28, repas42, navigation25, soit **122**. Épingle15084, total reçu **15085/15085** (+122 depuis14963).

- Bilan : rouge21/27 avant produit, puis27/27 ; ouverture et annulation conservent l’instantané, titre/focus corrects dans les deux modes de présentation.
- Bibliothèque : rouge19/28, puis28/28 dans WebKit et Chromium. Vrais contrôles conservés entre375/1280px, tri/liste/sélection/recherche opérants, snapshot inchangé.
- Repas : rouge15/37, puis37/37 ; refus de stockage injecté conserve la saisie. L’ordre final du volet est avant les plats, donc aucun ancien sélecteur de test n’est changé.
- Le premier essai de reprise par ancienne racine montée n’était pas représentatif du refresh réel : app.js détruit la racine avant le handler. Cette implémentation et ses témoins ont été retirés. Le parcours réel a reproduit le repli après sauvegarde. Raccord URL : rouge38/42 puis42/42 ; autres paramètres et origine conservés, changement d’adresse refusé hors vue/base/génération courante. Le scénario natif confirme ensuite la reprise.

Régressions : bilan87/87 (I2 cuisine65, L9 métier13, repli9) ; bibliothèque74/74 (L3 listes29, navigation45) ; repas172/172 (L8 17, L0/heure Toronto67, L1 88), puis L8/L0 relus après raccordURL. Le journal L1 de refus de compte est simulé et attendu. Thème81/81, carnet301/301. L’inventaire statique des éléments masqués dans le test de thème ajoute seulement les deux sélecteurs du volet mobile ; aucune assertion supprimée.

Outils Node **281/281**, outils CI **29/29**, générateurs conformes. Le premier appel des outils CI avait omis PLAYWRIGHT_BROWSERS_PATH :17 cas ne pouvaient pas lancer Chromium, reçu conservé ; relance avec le chemin déjà installé,29/29. La suite complète sous suffixe1 a été arrêtée volontairement avant la correction de reprise ; aucun succès ne lui est attribué.

Premier passage complet sous suffixe2 :15057/15060 (`artifacts/ci-navigateur/passage-8eM7g7/resultat.json`). Trois scénarios L9 tentaient de focaliser les contraintes à l’intérieur du nouveau volet fermé. Leur montage ouvre maintenant le résumé natif avant les gestes, comme le parcours utilisateur ; les assertions de focus et leur nombre restent inchangés. Reprise ciblée **35/35**, puis **15060/15060** (`artifacts/ci-navigateur/passage-wYWN8f/resultat.json`,20:29:37–20:33:23UTC), aucun échec ou erreur inattendue.

La revue indépendante découvre ensuite une couture du routeur : remplacer silencieusement l’adresse ne met pas à jour la copie interne de l’entrée active. Une sortie refusée après ouverture de l’organisation peut appeler deux fois la garde et retirer le paramètre d’ouverture. Le témoin utilise le vrai routeur et un historique contrôlé ; aucune perte de saisie n’est prouvée. Rouge causal **20/25**, puis **25/25** après notification silencieuse au routeur. Les navigations explicites avec remplacement restent gardées, même sur le même chemin ; arrêt, refresh, saisie et état étranger couverts. Régressions voisines **137/137** (navigation45, sorties40, alias/application52). Réception complète sous suffixe3 : **15085/15085**, `artifacts/ci-navigateur/passage-hUPWQh/resultat.json`,20:38:58–20:42:47UTC ; aucune erreur JavaScript, console inattendue, HTTP ou extérieure.

Le premier passage complet sous suffixe3 s’arrête sans bilan à20:36:35UTC sur `import_cible.decider {name: ErreurCycleRecette}` ; la fermeture du navigateur est la conséquence de cet arrêt immédiat (`passage-e44EAP`). Aucun ajout à la liste des erreurs admises. Import ciblé **712/712**, puis nouveau test de navigation suivi de l’import **737/737**, sans console/JavaScript/réseau extérieur : incident non reproduit, cause non attribuée à ce stade. La suite complète inchangée, relancée sans autres essais navigateur en parallèle, donne ensuite15085/15085. Outils Node **281/281** et outils CI **29/29** rejoués sous suffixe3.

La contre-épreuve suivante identifie une attente insuffisante dans `tests/l6-complements-groupes.js` : le test quitte sa base dès la clôture de l’import, avant le montage du bilan photo. Une suspension servie uniquement par le harnais (120ms, aucun produit modifié) reproduit exactement la console, avec `compte_change` et pile de la capture photo après changement de base, malgré22/22 assertions. La même suspension et une attente du véritable `[data-role=bilan-import]` donnent22/22 sans console ni changement de base prématuré. Cette attente est ajoutée au test, sans changer ses assertions : fichier suivi22/22 avec la même suspension, puis22/22 natif sans instrumentation, aucune erreur console/JavaScript/extérieure. Le passage complet15085/15085 précède cette ultime correction de montage ; la CI recevra le commit exact.

## Captures et gestes

Toutes les images acceptées sont ouvertes ; les20 images du comparatif sont copiées sans transformation. WebKit27.2 et Chromium156, données fictives, profils jetables ; aucun compte ou appel payé.

- WebKit repas/bibliothèque/courses/inventaire/réglages :375×667 et390×844. Premier titre584→524px, premier plat1102→364px. Scénario1 :9/10 à chaque taille, seul rouge sur le volet refermé après enregistrement. Reprise2 : **10/10 à chaque taille**, avec vraie sauvegarde puis nouvelle racine, origine conservée, fermeture propre, vrai rechargement et données identiques.
- Livre/photo/Actions/bilan : matrice375×667/400, texte200%,22PNG relus. Chromium29/29. WebKit brut27/29 : deux attentes supposaient à tort que le bouton tapé recevait le focus. Qualification2/2 sur la vraie app2 : MAIN était déjà actif à l’entrée exacte de showModal et Annuler lui restitue le focus. Le test comportemental avec focus explicite du déclencheur reste vert. Les reçus bruts sont conservés.
- Cuisine : **72/72** sur six profils WebKit. Paysage667/844, portraits375/390, texte200%, marge basse34px simulée. Barre78px en paysage et239px à texte200% maintenant dans le flux ; écart entre barres38,14→4,14px avec zone basse. Un PNG portrait incomplet est rejeté et exclu du comparatif ; les PNG retenus sont relus.
- Marges latérales : Chromium844×390, véritables variables env() émulées par CDP, gauche/droite44px et bas21px. **8 échecs avant**, **8/8 après** pour marque/titres/première et dernière destinations, deux écrans. Cette émulation ne prouve pas une encoche physique.
- Témoins complémentaires sous suffixe2 : ordinateur1280px en français **3/3**, téléphone375px en anglais **4/4**, quatre captures ouvertes. Commandes directes sur ordinateur, « Meal settings » et « Display and selection » lisibles sur mobile ; aucun débordement.
- Parcours natif final sous suffixe3 : **14/14**, sept PNG ouverts sur WebKit375×667. « Rester » affiche exactement un dialogue et conserve les mêmes racine, champ, valeur, volet, URL, origine et history.state, sans écriture implicite ; la sauvegarde puis le vrai rechargement conservent ensuite les données et l’ouverture. Aucun débordement ou erreur JavaScript/console/HTTP/POST/externe. Reçu `agent3/final-garde3-375x667/resultat.json`.

Zéro exception JavaScript, POST ou requête extérieure dans les parcours reçus ; les parcours agent1/agent3 contrôlent aussi console et HTTP. Navigateurs fermés après chaque réception. Les harnais sont sous `.superpowers/sdd/2026-10-31-pwa-mobile/` ; erreurs de montage isolées (nom de magasin, dépôt incomplet, commande CDP corrigée) conservées et distinguées des défauts produit.

## Limites

Aucun iPhone physique, clavier iOS, caméra native, installation standalone ou VoiceOver testé. Texte200% est une augmentation CSS, pas le zoom natif Safari. Les champs Date peuvent encore tronquer leur valeur à cet agrandissement ; le formulaire reste défilable. Courses, inventaire et réglages conservent des sections longues. Les menus agrandis occupent davantage de place sur ces écrans : aucun gain de compacité n’y est revendiqué.

## Livraison

APP_VERSION0.32.12, livraison **0.32.12-3**, DB6/archive7 inchangés. Manifeste217 ressources/3808036 octets, SHA256 `8704ec34ccc86ff12efd0b641533e57a2bbd165c08a7b75aeb1072d3df4fa944`. Aucun SQL ou déploiement assistant. Promotion et réception publique à compléter après validation finale.
