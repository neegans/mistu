# Confort tactile et lecture sur téléphone

31 octobre 2026. Demande « fait la meme chose pour la version mobile ». Base49385dd, public0.32.11-4. Les ajustements et leur publication sont autorisés par la demande et les instructions de cette session ; aucune relecture personnelle de cette spec n’est attribuée à Neegan.

## Constats frais

Audit réel WebKit tactile390×844/375×667, paysage667×375/844×390, texte200%, hauteur disponible400px ; profils jetables, données fictives, aucun compte/appel payé. Images ouvertes et conservées dans `.superpowers/sdd/2026-10-31-pwa-mobile/`. Ce sont des moteurs de navigateur, pas un iPhone physique ou son clavier natif.

- Les menus déroulants natifs livre/bilan mesurent23px dans WebKit malgré min-height44px. Les champs sont déjà à16px ; aucune affirmation de zoom iOS reproduit.
- Le bilan de cuisson à375×667 s’ouvre scrollTop110 avec son titre hors champ, parce que le focus initial va sur Annuler au bas du formulaire.
- En paysage la barre Suivant/Précédent78px et le menu global70px occupent38–40% de la hauteur. À texte200%, la barre cuisine reste fixe239px alors que le menu global revient déjà dans le flux. Le contenu demeure atteignable, mais l’espace de lecture est réduit.
- Avec de vraies variables CSS de zones sûres émulées dans Chromium844×390 (gauche/droite44px, bas21px), marque/titre commencent à16px et les liens de navigation à0px. Ces éléments ne respectent donc pas les marges latérales émises par le moteur. `viewport-fit=cover` est déjà présent. La [documentation WebKit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) indique la nécessité de ces marges pour ce mode.
- Bibliothèque : recherche et commandes consomment l’essentiel du petit écran. À375×667, premier titre584–610px et barre basse à597px : le titre est coupé au chargement.

## Changements retenus

Conserver le style crème/olive, toutes les destinations et les règles de données.

1. Menus déroulants natifs simples d’au moins44px dans WebKit, avec indicateur de sélection visible. Conserver les listes multiples.
2. Bilan de cuisson : focus initial sur son titre, visible en haut, plutôt que sur une action située après le formulaire. Annulation, enregistrement, retour du focus et protection de saisie conservés.
3. Cuisine : navigation dans le flux en paysage de faible hauteur et lorsque la coquille place déjà son menu dans le flux. Supprimer le double comptage éventuel de la marge sûre du bas après mesure. Aucune commande masquée.
4. Marges sûres latérales pour en-tête, contenu et navigation mobile ; maintenir le fond jusqu’aux bords. Titres proportionnés à la faible hauteur en paysage. Dialogues contrôlés séparément avant changement.
5. Si confirmé par la capture375px, regrouper les commandes de tri/présentation/sélection dans un volet mobile explicite, pour voir les recettes dès l’arrivée. Recherche et filtres restent directs ; sélection, tri, contexte et contrôles conservent leurs nœuds et leurs comportements. Vue ordinateur conservée.

6. Repas : conserver titre et résumé factuel portions/date, regrouper configuration et actions secondaires dans « Organisation du repas », pour rendre les plats accessibles plus tôt. Avertissements hors volet. Les contrôleurs existants restent montés ; le paramètre de présentation `organisation=ouverte` conserve son ouverture après une actualisation. Le toggle remplace seulement l’adresse de la même fiche, conserve les autres paramètres et ne déclenche ni navigation ni écriture métier. Le routeur synchronise silencieusement la présentation de son entrée active afin que « Rester » conserve cette adresse avec une seule garde ; une navigation explicite avec remplacement garde son contrat antérieur. Une nouvelle entrée depuis la liste reste fermée. Le titre et la date des listes de courses sont espacés.

## Réception

Preuves causales avant/après, mêmes données/tailles/moteurs ; vrais gestes tactiles, focus et défilement. Vérifier portrait375/390, paysage667/844, texte200%, français/anglais, ordinateur1280. WebKit et témoin Chromium pour les différences de rendu. Les marges CSS émulées ne prouvent pas la position physique d’une encoche. Ni caméra native, ni installation PWA, ni VoiceOver réellement testés.

Tests ciblés comportementaux avant les changements de focus/volet, régressions voisines, suite complète et outils requis. Captures dans un comparatif lisible. APP_VERSION0.32.12, livraison0.32.12-3 après gel ; DB6/archive7 inchangés. STATE/CLAUDE et reçu de publication mis à jour.
