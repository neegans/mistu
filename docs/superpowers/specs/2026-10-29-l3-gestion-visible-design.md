# L3 — Gestion visible et retour à sa recherche

**29 octobre 2026 — spec préparée avant construction.** Neegan demande « deploy avant », puis « et enchaine sur le restant des lots ».
Cette autorisation globale permet de préparer et poursuivre le plan ; ce texte n'est pas présenté comme déjà relu par Neegan.
Base inspectée le 29 octobre : correctifs urgents **0.23.2** `5412745`, intégrés à la branche L2 par `74af562`, puis code local L2 **0.24.0**, DB6/archive3, encore en réception et publication. Ce document ne prétend pas que L2 est déjà public ; le commit définitif sera épinglé au démarrage de L3. Aucun code L3 n'est livré par ce document.

Références : [plan directeur § 5 C07, 6, 7, 19–21](../../lots/2026-10-29-plan-directeur-interface-fonctions.md),
[L1](2026-10-29-l1-corbeille-individuelle-design.md), [L2](2026-10-29-l2-corbeille-livres-design.md),
[correctifs urgents 0.23.2](2026-10-29-correctifs-thermomix-fiabilite-design.md).

## 1. Résultat attendu et périmètre

Neegan retrouve Modifier et Actions sur les cartes et les fiches. Il peut mettre un contenu à la corbeille sans chercher dans
l'éditeur. Après consultation, correction ou retour arrière, il retrouve sa bibliothèque ou son livre avec la recherche, les filtres,
la vue et la position qu'il avait laissés. Une recette vérifiée reste modifiable.

L3 couvre les cartes et lignes de recette, les fiches recette/livre, la bibliothèque, les entrées vers les parcours déjà disponibles,
les filtres locaux, les compteurs, la vue grille/liste, le retour de navigation et une sélection multiple de recettes limitée aux
actions réellement construites. Il conserve la structure à cinq destinations et l'identité crème/olive. Les routes existantes restent valides.

L3 n'est pas une réécriture des éditeurs L4, des sources L5, de la traduction complète L6 ou de la cuisine L7. Il n'ajoute ni framework,
ni connecteur Cookidoo, ni moteur de recherche distant, ni purge. Aucun appel assistant ne part quand on ouvre un menu, change un filtre
ou revient à une liste. Le nom « français simple » ne désigne pas ici une traduction automatique qui sera livrée par L6.

## 2. Ce qui existe et les écarts observés

| Code inspecté | État réel | Travail L3 |
|---|---|---|
| `library.js::recettesTab` | Recherche, puce de source et limite de 60 cartes sont locales à chaque rendu ; les références d'index sont dans une vue séparée | Restaurer le contexte ; rendre recettes et références retrouvables depuis le même segment |
| `library.js::booksTab` | Après les livres, le segment ajoute les signets web et créations IA ; les partielles sont comptées avec les disponibles | Livres ne contient que les éditions ; compteurs distincts |
| `components.js::recipeCard` et `cartePlat` | Titre/provenance, photos et repères partagés ; la carte photo expose surtout Ajouter/Modifier photo | Actions de gestion communes, présentation compacte sans annonces répétées de champs facultatifs manquants |
| `recipe.js` | Le Corriger de tête disparaît pour une version vérifiée ; d'autres gestes restent dans un grand panneau replié | Modifier reste visible ; gestes principaux et sections nommées |
| `book.js` | Ajouts imbriqués dans Ajouter ; métadonnées modifiables dans un panneau ; filtres `mode/q/tout` recréés ; onglet sources non mémorisé | Entrées directes, ouverture du vrai formulaire existant, retour au bon onglet et au bon filtre |
| `router.js` et `app.js` | Routes par fragment ; `remplacerAdresse` écrase `history.state` avec `null` ; chaque rendu finit par `scrollTo(0,0)` | Distinguer navigation, retour et actualisation ; garder un état d'entrée d'historique |
| `search.js` | Requête/mode/cases déjà dans la route ; dernière recherche web et aperçus gardés en mémoire du module | Conserver ce contrat, ajouter le retour de position sans relancer une recherche payante |
| `state.js`, L1 puis L2 | Projections actives distinctes des maps historiques et gardes de cycle/compte | Les nouveaux accès réutilisent ces projections et commandes |

Ce sont des observations de lecture du code 0.24.0 local. Le parcours L2 a été mesuré en Chrome à 320/390/768/1280 px avec cache et rechargement hors ligne ; cela ne mesure pas encore L3, le clavier mobile physique ou le lecteur d'écran.

Points de faisabilité confirmés : `getSyncGeneration()` change à chaque pose d'état de session, pas à chaque remplacement de bibliothèque ; il ne constitue donc pas une identité durable de navigation. `searchDocs()` classe les références et les durées inconnues dans des groupes distincts : son mode `recipes` ne peut pas être réemployé tel quel pour la nouvelle liste qui doit inclure les références. Enfin, le catalogue local `appliances` n'établit pas à lui seul un besoin d'appareil dans chaque version de recette.

## 3. Actions communes sur cartes et fiches

### 3.1 Carte et ligne de recette

Le titre est un lien nommé vers la fiche ; les contrôles sont ses frères, jamais imbriqués dans ce lien. La photo personnelle reste
prioritaire selon le lecteur actuel. Sans photo, la carte garde une présentation textuelle compacte, sans grand cadre vide.

Contenu : titre, provenance courte, page imprimée lorsqu'elle est connue, disponibilité utile à l'action et durée connue. Les valeurs
manquantes Description/Niveau/Temps ne forment plus trois avertissements sur chaque carte. La variante compacte de `resumeReperes`
est explicite ; elle ne change ni l'éditeur, ni les détails de la fiche, ni les données enregistrées. Les origines IA/web/livre restent fidèles. Un lien vers le gestionnaire de photo ne copie pas l'URL `blob:` dans le contexte de navigation ; l'écran résout la photo depuis son identité persistée.

Un bouton **Actions** reste visible au toucher comme au clavier, nommé **Actions pour {titre}** pour les technologies d'assistance.
Il ouvre un panneau de commandes nommées. Le même modèle d'actions alimente cartes, lignes compactes et fiche ; les différences de
présentation ne créent pas de seconde règle d'éligibilité.

| Action | Cible réelle et condition |
|---|---|
| **Modifier** | Éditeur existant de la recette ; version affichée/courante transmise explicitement si elle existe, saisie de la référence sinon |
| **Ajouter aux favoris / Retirer des favoris** | Champ réel `favorite`, fusion conditionnée et garde L1/L2 ; retour seulement après écriture locale |
| **Gérer la photo** | Route photo existante ; aucun téléchargement ou appel assistant provoqué par l'ouverture du menu |
| **Informations et temps** | Route de repères existante ; corrections manuelles possibles et éventuel appel annoncé sur son écran |
| **Rattacher à un plat** | Parcours de rapprochement existant ; choix volontaire, jamais attribution automatique |
| **Mettre à la corbeille** | Commande L1 ou L2 adaptée à la cible ; aucune suppression physique |

Une carte active devenue retirée pendant l'attente ne garde pas une autorisation de mutation. Les commandes sont refusées par la garde,
le message explique de recharger la fiche et l'intention locale n'est pas transformée en restauration. Si la cible est déjà retirée au
rendu, la présentation de consultation propose la restauration prévue par L1/L2 et omet les écritures ordinaires. Un cycle invalide reste
consultable dans À vérifier. L'absence de capacité serveur connue donne le motif déjà défini par L1/L2, sans bouton qui ne pourrait que
répondre « Réessaie ».

### 3.1.1 Repères et propositions payées : contrats 0.23.2 conservés

Carte/liste : `lireReperes(recipe, versionCourante)` et `lireTemps(recipe, versionCourante)`. Fiche : les mêmes lecteurs avec la version **affichée**. Ni lecture directe du dernier `recipe.reperes.proposition`, ni choix d'une description par seule recette : l'enveloppe révision2 conserve les entrées par version et signature de source. Passer de l'original au TM7 puis revenir doit retrouver les deux descriptions sans appel ni écriture.

Une durée garde sa plage et sa provenance propres. Le symbole `≈` reste sur les seules estimations, même si un autre champ a été corrigé à la main. Le mode compact omet les emplacements facultatifs vides ; il ne transforme pas un repère périmé en valeur courante et ne retire pas les mentions de source dans la fiche. Rapide reste le prédicat du lecteur partagé : total courant complet, attentes confirmées et maximum de la plage ≤30 minutes.

Les menus pointent vers les écrans existants avec `v` et, s'il existe, l'identifiant exact du journal. Ils ne recréent pas un brouillon. La relecture cochée, Garder, Enregistrer mes corrections et l'abandon restent liés à la copie du journal réellement affichée (`attendu`), à la signature source et aux cycles capturés. Un retour de navigation ne coche pas une relecture, n'adopte pas une réponse reçue ailleurs et ne rebascule pas automatiquement un ancien cycle après restauration. Les valeurs non retouchées d'une proposition payée, le résultat précédent récupérable et les réponses associées à leur tour de questions sont conservés par les parcours actuels.

### 3.2 Fiche de recette

En tête : titre, source, version sélectionnée, état de disponibilité ; puis **Cuisiner**, **Modifier**, **Actions**.
Une version `verified` ne cache jamais Modifier. Modifier travaille sur la version effectivement affichée, conserve l'original et ouvre
le même éditeur avec les mêmes gardes que l'accès actuel. Le changement de libellé ne crée pas un nouveau type de version.

Cuisiner n'est proposé que lorsque le parcours de cuisine existant peut être lancé ; une référence sans contenu propose **Importer cette
recette** ou **Saisir à la main**, selon sa source. Une recette partielle reste dite partielle. Les contraintes de portions Thermomix et les
refus de nouvelles utilisations restent ceux du domaine. Une correction TM7 déclarée invalide demeure consultable/exportable comme document ; Cuisiner et Copier pour Cookidoo ne sont jamais réactivés par le nouveau menu. L'accès explicite à la version personnelle issue des étapes source reste disponible. Aucun simple bouton de carte ne fabrique une session pour un objet retiré.

Les portions, la version et la langue de lecture sont accessibles à proximité du contenu. Les gestes secondaires sont répartis en
sections nommées : **Sources**, **Mes notes**, **Mes photos**, **Versions**, **Mémoire culinaire**. Le menu garde les accès existants à
la traduction manuelle, aux variantes, à l'adaptation TM7, aux courses et aux exports quand ils sont disponibles. **Traduction** ouvre
la traduction de la version/langue choisie ; aucune mention de traduction intégrale automatique avant L6.

L3 peut déplacer un contrôle et son panneau, pas modifier silencieusement la version sélectionnée, les portions ou la langue. Les
anciennes adresses avec `v`, `servings` ou langue restent interprétées par les lecteurs existants et leurs validations.

### 3.3 Livre et couverture

La fiche d'édition montre directement **Modifier le livre**, **Ajouter des pages d'index**, **Ajouter une recette**, **Actions**.
Modifier le livre ouvre et focalise le formulaire de métadonnées déjà présent. Il ne lance pas une identification ou un appel assistant ;
le nouvel éditeur organisé et les brouillons restent L4. Depuis une couverture de bibliothèque, le même bouton rejoint ce formulaire
par un paramètre de panneau validé, sans nouvelle entité ni duplication des champs.

Ajouter des pages d'index propose Photographier ou Choisir des photos/PDF en un niveau de choix. Le geste transmet l'édition et
l'intention `index` au parcours existant. Aucun sélecteur de fichier n'est ouvert automatiquement par un paramètre d'URL.
Ajouter une recette propose les sources déjà prises en charge, dont la saisie manuelle. Les séances se reprennent avec leur identifiant
exact ; la navigation ne recommence pas une lecture et ne paie pas une nouvelle extraction.

Les onglets **Recettes** et **Pages source** gardent leurs filtres et leur position propre. La couverture reçoit un accès Actions :
Modifier le livre, Ajouter des pages d'index, Ajouter une recette, puis la corbeille L2. Une édition retirée reste en consultation et
présente les commandes de restauration L2 ; la visibilité des boutons n'est jamais la seule protection de ses écritures.

## 4. Bibliothèque et filtres

### 4.1 Segments et présentation

Les destinations principales restent Aujourd'hui, Bibliothèque, Ma semaine, Ma cuisine, Ajouter. Le renommage Repas relève de L8.
La bibliothèque conserve **Recettes**, **Livres**, **Plats**, plus un accès permanent **Corbeille**. La corbeille doit conserver
Bibliothèque comme destination active de la navigation, y compris pour une route de groupe L2.

**Livres** ne contient que les éditions actives. Signets et créations IA sont retrouvables dans **Recettes**, avec les filtres de source.
Aucune ligne n'est déplacée ou réécrite pour cette présentation. **Recettes** contient aussi les références d'index : leur disponibilité
et leur page restent explicites, même sans photo. `?tab=a-importer` reste un lien compatible vers le préréglage des références de livres.
Les anciennes adresses `tab=books`, `tab=dishes` et `tab=recettes` restent valides ; une valeur inconnue donne la vue Recettes par défaut.

La barre d'outils rassemble recherche locale, filtres, tri, nombre de résultats, choix **Grille / Liste** et **Sélectionner**.
Grille et liste utilisent les mêmes résultats, le même ordre et les mêmes commandes. Le choix de présentation est mémorisé sur cet
appareil. Les photos ne sont chargées que pour les éléments rendus ; conserver la pagination progressive actuelle de 60 éléments.
Le retour à une limite déjà dépliée ne relance pas une lecture de tous les fichiers de la bibliothèque.

### 4.2 Filtres combinables

| Filtre | Définition et provenance |
|---|---|
| Recherche | Titres, livre et ingrédients de la version courante, en réutilisant les lecteurs actuels ; aucune requête distante |
| Source | Toutes, De mes livres (`edition_id`), Du web (adresse réellement portée), Avec l'assistant (`origine: ia`), Personnelles sans les précédentes origines ; une fiche peut relever du livre et du web |
| Livre | Identifiant d'édition, pas titre ; deux éditions de même nom restent distinctes. Une édition retirée en gardant ses recettes peut rester un filtre de source historique nommé comme tel |
| Disponibilité | Recette disponible, Recette partielle, Référence, État à vérifier ; valeurs inconnues jamais considérées disponibles |
| Favoris | Champ `favorite` actuel |
| À relire | État de vérification réel de la version courante ou de la référence ; aucun état inventé à partir de sa présence dans l'index |
| Déjà cuisinée | Historique réel de cuisson, pas statut d'une version proposée |
| Durée | Rapide partagé ou maximum choisi : total courant complet, attentes incluses confirmées, borne haute `max` de la plage ≤ maximum ; durée inconnue, périmée ou incomplète exclue, jamais zéro |
| Ingrédient | Identités d'ingrédients reconnues par la recherche métier existante ; pas d'inférence depuis une référence sans ingrédients |
| Appareil | Dans cette tranche, TM7 seulement si `lireThermomix(versionCourante)?.ok === true` confirme un plan lié à sa source ; pas de déduction depuis le titre, une température, des capacités du catalogue ou une autre variante. Les autres appareils restent absents du filtre tant que la liaison version→appareil n'est pas démontrée |

Les filtres se combinent par intersection ; l'état sélectionné est visible. Les valeurs au sein d'un même filtre à choix multiples se combinent par union (exemple : livres OU web), puis par intersection avec les autres filtres. Un identifiant d'édition devenu introuvable reste affiché comme filtre indisponible avec Effacer : il ne disparaît pas silencieusement pour élargir les résultats. Les options sans contrat de données fiable ne sont pas
affichées comme si elles fonctionnaient : notamment **À cuisiner bientôt** n'arrive qu'avec le modèle livré par L8. Les filtres de
durée et d'ingrédient ne promettent pas des connaissances absentes d'une référence d'index. Réutiliser le lecteur partagé de repères
et la recherche métier ; ne pas créer une seconde heuristique Rapide ou un second vocabulaire de disponibilités.

Tris livrés : **Modifiées récemment**, **Titre** ; dans un livre, **Page** reste disponible. Égalités départagées par identifiant stable.
Les dates absentes/invalides se rangent après les dates connues. Une modification de filtre ou de tri réinitialise la pagination et
la sélection multiple explicitement, sans reprendre des éléments devenus invisibles. **Effacer les filtres** apparaît seulement si
un filtre est actif ; il conserve le segment et le choix grille/liste.

Un résultat vide distingue bibliothèque vide, livre vide et absence de correspondance. Dans le dernier cas, proposer Effacer les
filtres, pas une invitation trompeuse à photographier l'index déjà présent. Les compteurs de livre séparent exactement les états
`available`, `partial`, `reference_only` et les états inconnus. Les liens web sans version ne deviennent pas des recettes disponibles.
Les mêmes définitions de disponibilité alimentent bibliothèque et fiche du livre ; le cycle effectif est appliqué avant le comptage actif. Le dialogue L2 garde ses catégories de conséquences, notamment déjà retirées/état invalide : comparer les catégories communes, pas assimiler son bilan de tout le groupe au nombre visible dans une liste filtrée. « État à vérifier » du filtre concerne une disponibilité inconnue d'une recette effectivement active ; un cycle L1/L2 invalide reste dans la consultation À vérifier de la corbeille, jamais réintroduit dans les résultats actifs.

Le filtre Appareil ne certifie ni propriété de l'appareil, ni faisabilité de l'ensemble de la recette, ni accessoires disponibles. Le profil TM7 existant est une liste fermée d'actions prises en charge, distincte des accessoires que Neegan possède. Aucun couvre-lames/éplucheur, Cutter, Sensor ou accessoire non pris en charge n'est ajouté par L3. Les accessoires rendus proviennent uniquement du plan validé ; aucune déduction à partir de « soupe », « vapeur » ou d'une température. `estThermomix()` seul n'est pas un test d'exécutabilité : il reconnaît aussi les documents TM7 invalidés.

## 5. Retrouver son contexte au retour — C07

### 5.1 Ce qui est conservé

Pour Bibliothèque : segment, texte de recherche, filtres, tri, grille/liste, limite dépliée, position et dernier élément ouvert.
Pour chaque édition : onglet Recettes/Pages source, recherche, filtre, tri, état déplié, position et dernier élément ouvert.
Pour Recherche : paramètres déjà présents dans l'adresse, filtres manuels en mémoire, position et résultat ouvert ; la mémoire Web
existante demeure la seule source des résultats/aperçus reçus. Une recette ouverte depuis la recherche retourne à cette recherche,
même si elle appartient aussi à un livre. Son lien de provenance reste un lien distinct vers le livre.

L'état de navigation ne contient ni copie de recette, ni photo, ni brouillon, ni résultat assistant. Il ne participe pas à la
synchronisation ni à l'archive. Les brouillons L4 auront un autre contrat. Les paramètres fonctionnels utiles sont dans le fragment
de route ; la position, le focus et les détails transitoires appartiennent à l'entrée d'historique de cet onglet.

### 5.2 Mécanisme et isolation

Introduire un petit module de contexte de navigation, proposé `src/ui/navigation-contexte.js`, autour du routeur existant.
Utiliser une clé d'entrée propre dans `history.state` et, pour survivre au rechargement de l'onglet, une mémoire `sessionStorage`
versionnée et bornée. `remplacerAdresse` doit préserver les autres clés de `history.state`, notamment celles ajoutées ultérieurement.
Les valeurs sont validées : routes internes connues, identifiants encodés, énumérations admises, texte et taille bornés, nombres finis.
Un stockage indisponible ou une mémoire ancienne/malformée donne les valeurs par défaut sans empêcher d'ouvrir la bibliothèque.

La mémoire est séparée par propriétaire **des données** (`ctx.proprietaireDonnees` / `sync_state.user_id`), base locale et époque de bibliothèque. `sync.user` seul n'est pas suffisant : une déconnexion peut laisser la base sous son propriétaire connu. Une époque locale de navigation versionnée, non synchronisée, survit au rechargement ; elle est invalidée explicitement après effacement ou remplacement réussi d'archive, avant de restaurer une vue. Ajouter ce raccord dans le parcours Réglages : le code actuel n'émet pas une génération de bibliothèque persistante. `getSyncGeneration()` et l'identité de `repo.db` restent des gardes **en vol** avant/après les attentes, pas une clé durable de `sessionStorage`. Une simple réception de données du même propriétaire recalcule les résultats sans effacer ses filtres. Changement de compte, effacement/remplacement
de bibliothèque ou garde de compte refusée invalident les anciens retours ; un filtre ou un identifiant du compte précédent ne fuit
pas vers la nouvelle vue. Aucune clé d'accès, session d'authentification ou donnée d'assistant n'est ajoutée à ce stockage.
Le module de navigation peut conserver la seule préférence cosmétique grille/liste dans `localStorage` (énumération validée), pour la retrouver après fermeture du navigateur ; recherches, filtres et origines restent dans `sessionStorage`. Ne pas écrire un nouveau champ dans `settings`, qui participe déjà aux données de l'application. Aucun magasin, index ou champ synchronisé nouveau.

Bornes de la mémoire version1 : au plus 80 entrées d'historique, 8 Kio par entrée et 512 Kio au total, éviction des entrées les moins récemment utilisées ; recherche ≤500 points de code, identifiants ≤200 caractères, liste de filtres admis seulement. Aucune sélection multiple, contexte de mutation ou fonction n'est sérialisée. L'échec de stockage rend le service volatil pour cet onglet, sans échec du geste métier.

Capture avant de quitter la vue ou de remplacer son contenu : identifiant de l'élément visible et décalage par rapport au haut,
position de repli et cible de focus connue. La restauration est effectuée seulement après le rendu courant, avec le garde de séquence
d'`app.js`. Elle ne peut pas déplacer une page qu'une navigation plus récente vient d'afficher. Les photos ont une géométrie réservée
ou l'ancre est réajustée de manière bornée ; aucun intervalle infini de restauration.

### 5.3 Règles de retour

| Situation | Comportement |
|---|---|
| Retour navigateur, geste arrière ou lien Retour de la fiche | Même entrée de liste et même contexte ; ancre restaurée lorsqu'elle existe |
| Actualisation après favori, photo, synchronisation ou changement de langue | Garder la recherche et la position ; recalculer les résultats avec les données actuelles |
| Après mise à la corbeille depuis une carte | Retirer la carte après transaction ; focus sur la suivante, sinon la précédente, sinon le titre de liste ; garder les filtres |
| Objet ou ancre disparus pendant la visite | Rester dans le contexte connu, repli vers le voisin/position bornée ; aucun rétablissement de l'objet |
| Nouvelle destination ouverte sans origine de navigation | Valeurs de route explicites, position initiale en haut ; retour de repli vers livre ou bibliothèque selon la fiche |
| Clic sur Bibliothèque dans la navigation principale | Reprendre le dernier contexte de cette bibliothèque ; les liens explicites Ajouter un livre gardent leur destination Livres |
| Rafraîchissement de l'onglet | Restaurer les paramètres et l'état de navigation admis ; les résultats Web volatils peuvent être absents, aucun appel automatique |
| Lien externe/direct, retour hostile ou compte différent | Ignorer la cible non admise ; repli interne déterministe |

Un paramètre « retour » n'est jamais une URL libre à suivre. La destination doit correspondre à une entrée interne de cet onglet,
avec le même propriétaire ; ouvrir une fiche dans un nouvel onglet conserve une destination de repli utile sans copier toute la mémoire.
Le lien Retour d'un éditeur conserve d'abord son comportement de protection de saisie ; L3 ne promet pas un brouillon durable avant L4. La chaîne liste→fiche→éditeur→fiche conserve l'origine de liste séparément du retour immédiat vers la fiche (version, langue et portions validées). Retour d'édition ne saute pas la fiche, et le lien de provenance vers le livre ne remplace pas cette origine. Un retour vers une édition retirée ouvre sa consultation L2, sans changer les cycles.

L3 doit distinguer `navigation`, `retour/avance`, `refresh` et `replace` dans le raccord routeur/app. Une entrée créée par changement de fragment reçoit une nouvelle clé, même si le navigateur a copié `history.state` ; un retour retrouve sa clé. `popstate` et `hashchange` d'un même geste sont dédupliqués. `remplacerAdresse()` préserve l'entrée et les clés étrangères, sans rendu supplémentaire. `history.scrollRestoration='manual'` n'est posé que lorsque la restauration applicative est installée. Les clics modifiés/nouvel onglet conservent le comportement natif du vrai lien et leur repli interne ; aucune interception générale ne les remplace par `navigate()`.

## 6. Sélection multiple de recettes

Après validation de la gestion individuelle, **Sélectionner** affiche des cases nommées et une barre avec le nombre exact.
La sélection est une liste d'identifiants de recettes actives avec leurs contextes capturés ; elle n'est ni un état de vérification
OCR, ni un modèle de groupe L2. Changer filtre, livre ou compte ferme la sélection avant toute nouvelle action. Sélectionner tout
indique sa portée réelle : **Sélectionner les {n} résultats affichés**, jamais toutes les pages sans le dire.

Actions de cette tranche : **Rattacher à un plat** existant, **Mettre à la corbeille**, **Annuler la sélection**.
Pas de collection arbitraire nouvelle ni de sélection multiple de livres ; chaque livre conserve son dialogue L2 de conséquences.
Pas de validation automatique de lignes d'index, suppression définitive ou consommation d'inventaire.

Le bilan de retrait montre le nombre exact avant de lancer les commandes. Chaque membre garde les bases recette/édition et le
propriétaire capturés ; un membre devenu périmé est refusé et signalé. L'interface distingue les succès, refus et membres non traités.
Elle n'annonce pas de transaction globale serveur : les commandes existantes restent conditionnées et synchronisées individuellement.
Un second clic ne relance pas des opérations déjà confirmées. En cas d'interruption, les gestes déjà écrits restent en corbeille et
restaurables ; le bilan local peut être recalculé à la reprise sans fabriquer une intention pour les éléments restants.

## 7. Interaction, accessibilité et petits écrans

Actions n'apparaît pas seulement au survol et ne dépend pas d'un balayage. Cibles tactiles d'au moins 44 px, nom accessible sans
ambiguïté, indication d'ouverture, fermeture Échap et retour du focus vers le déclencheur s'il existe. Aucun rôle ARIA `menu` si
le composant ne met pas en œuvre son clavier complet ; un dialogue de commandes avec boutons/liens et navigation Tab convient.

Le panneau conserve un titre et un bouton Fermer/Annuler explicite. Le retrait ordinaire d'une recette ne rajoute pas une succession
de confirmations ; le dialogue de conséquences d'un livre reste celui de L2. Pendant une écriture, le bouton concerné est désactivé,
le succès vient du résultat de la transaction, et l'erreur ne ferme pas un formulaire récupérable.

Les filtres ont des libellés, les boutons d'état `aria-pressed`, les onglets leurs relations et leur clavier. Une mise à jour de
résultats annonce un nombre sobre dans une zone de statut ; elle ne déplace pas le focus pendant la frappe. Avec texte à 200 %,
les actions se replient en lignes sans masquer l'action principale. La liste compacte ne réduit pas la taille des cibles tactiles.
Respecter la réduction du mouvement ; le retour à l'ancre ne dépend pas d'une animation et ne déclenche pas un long défilement fluide.

## 8. Gardes, modèle et intégration L1/L2

Les cartes et menus lisent l'état effectif de L2 : retrait propre prioritaire, édition gardant ses recettes, retrait avec le livre,
exception de restauration individuelle liée au jeton courant. Aucun test local limité à `recipe.trashed_at` ne réintroduit une
recette retirée avec son édition. Les maps historiques restent exhaustives pour provenance et accès depuis un ancien repas.

Les nouveaux points d'entrée utilisent les commandes de domaine et les contextes du dépôt, pris avant dialogue/choix de fichier/
attente. Favori, lien vers un Plat, photo et retrait ne changent que leurs champs ; aucune réécriture de la fiche depuis un snapshot
de carte. Les gardes source/version/compte/cycle restent actives même si une action était visible au montage.

L3 n'ajoute aucun format métier ni migration serveur. DB et archive restent celles de L2 ; les états de navigation anciens sont
ignorables et leur absence ne modifie aucune recette. Version applicative cible après L2 : **0.25.0**, cache initial
`cuisine-os-v0.25.0-1` ; le responsable de livraison confirme la séquence à la construction. Ajouter les modules au précache et
les nouveaux textes à `t()`/anglais ; tout nouveau module d'affichage entre dans `MODULES_NEUFS`.

## 9. Trois volets de construction et interface commune

Avant toute écriture parallèle, figer les signatures ci-dessous avec des tests de contrat courts. Les trois volets peuvent alors avancer sur des fichiers distincts ; la réception finale assemble leurs points d'intégration. Aucun agent ne modifie les fichiers d'un autre volet pour contourner une API absente.

| Volet / propriétaire | Fichiers possédés | Livrable et dépendances |
|---|---|---|
| **A — Navigation et retour** | nouveau `ui/navigation-contexte.js`, `core/router.js`, `app.js`, `ui/coquille.js`, raccord d'invalidation dans `ui/settings.js`, tests de navigation | Entrées d'historique, mémoire bornée, propriétaire/époque, capture/restauration d'ancre et focus, origine validée. Tests avec vues fictives pour avancer sans B/C. Ne change aucune mutation métier des écrans |
| **B — Collections, filtres et sélection** | nouveau `domain/bibliotheque.js`, `ui/library.js`, `ui/book.js`, tests filtres/listes/livre | Résultats actifs, compteurs distincts, filtres combinés, tri, grille/liste, pagination, sélection bornée. Intègre le contexte A et les fabriques/actions C. Possède tout `book.js`, y compris le raccord des boutons d'en-tête fournis par C |
| **C — Actions et fiche** | nouveau `ui/actions-contenu.js`, éventuel domaine de commandes groupées, `ui/components.js`, `ui/recipe.js`, `ui/reperes-affichage.js`, raccords de Retour dans `ui/recipe-edit.js`, `ui/reperes.js`, `ui/thermomix.js`, `ui/photo-gestion.js`, `ui/import-cible.js`, `ui/import.js`, `ui/search.js` ; tests de commandes et fiche | Modèle commun d'actions, menus, Modifier visible, repères compacts, vraie version affichée, commandes individuelles et groupées, propagation des liens A dans les parcours existants. Aucun changement des validateurs TM7, calculs de repères ou règles d'appel payé |

Le responsable d'intégration possède `styles.css`, `src/i18n/en.js`, `MODULES_NEUFS`, `tests/tests.js`, version/cache, STATE et publication. Les volets transmettent leurs classes, textes et tests ; leur intégration est séquentielle. Pas de nouvelle migration SQL ou DB pour L3.

### 9.1 Interface navigation fournie par A

- `lireContexteListe({route, query, portee})` rend uniquement des valeurs validées et des valeurs par défaut ; `portee` associe propriétaire des données, base et époque. La fonction ne lit pas de recette et n'émet pas de réseau.
- `memoriserListe({cleEntree, route, portee, filtres, tri, presentation, limite, ancre})` prend l'état visible ; `ancre` contient identifiant stable, décalage, position de repli et rôle de focus admis. Retour d'échec de stockage contrôlé, jamais une exception de mutation métier.
- `lienAvecOrigine(cibleInterne, {cleEntree, repli})` conserve un vrai `href` et ajoute un identifiant opaque d'origine. Aucun URL libre de retour ; paramètres métier existants (`v`, `servings`, `locale`, `import`, `session`) conservés et validés par leurs lecteurs.
- `retourConnu({query, portee, repli})` rend un descripteur `{href, cleEntree?, libelle}` vers une entrée admissible, sinon le repli interne. La protection de saisie reste propriétaire de la décision de quitter.
- `restaurerVue({racine, cleEntree, portee, estCourante})` ne s'exécute qu'après insertion du rendu ; `estCourante` inclut `renderSeq`, génération de session et identité de base. Ajustement d'ancre borné, annulé dès qu'une nouvelle navigation ou un geste de défilement utilisateur survient.
- Une ouverture explicite de panneau peut déclarer un champ `data-nav-ouverture="focus"`. Cette cible prend la priorité sur l'ancre de liste : après montage, elle est amenée dans le viewport puis focalisée sous les mêmes gardes. Le marqueur est consommé après réussite. Le formulaire ne programme pas un focus concurrent avant la restauration de navigation.
- `invaliderNavigation({motif})` détruit origines, ancrages et sélection locale à l'événement autorisé : changement réel de propriétaire, bibliothèque effacée/remplacée, garde de compte refusée. Un simple favori ne le déclenche pas.

Les noms proposés sont à figer avant implémentation, leur sémantique est obligatoire. La coquille consomme l'API A ; les écrans B/C ne manipulent pas directement `history.state` ou `sessionStorage`.

### 9.2 Interface données fournie par B

`projeterBibliotheque(ctx, etatValide)` est pure et rend `{items, total, compteurs, filtresIndisponibles}` avant la tranche de pagination. Chaque item porte `recipe`, version courante résolue par le lecteur existant, provenance, disponibilité, état effectif et repères lus ; ce n'est pas une copie destinée à être sauvegardée. Une version étrangère est rejetée. Le tri stable précède la pagination ; grille/liste et compteurs consomment la même projection.

B réutilise `recettesActives`, `documentsActifs`, `editionsActives` et `recetteActiveDansContexte` de `state.js`, et `lireEtatRecette` de L2. Les maps historiques ne sont pas filtrées en place. Un livre retiré en `keep_recipes` n'est pas une couverture active, mais ses recettes actives restent sélectionnables et filtrables par cette provenance. Une exception individuelle n'est valide que pour le jeton courant du livre.

La recherche locale universelle garde ses groupes existants. B peut réutiliser normalisation, résolution d'ingrédients et lecteurs de temps ; il ne transforme pas `searchDocs(mode:'recipes')` en filtre de bibliothèque qui perdrait les références. La bibliothèque à recherche vide montre aussi les références, et ses filtres stricts de durée/ingrédient ne les classent pas comme connues.

### 9.3 Interface actions fournie par C

`actionsRecette({recipe, version, ctx, origine})` et `actionsLivre({edition, ctx, origine})` rendent des descripteurs à identifiants stables : libellé, nom accessible, `href` ou commande, éligibilité et motif éventuel. Les fabriques de panneau les rendent sans lien imbriqué ; B peut les poser sur carte, ligne et couverture. C fournit aussi le modèle des boutons directs du livre, B effectue seul leur insertion dans `book.js`.

Les captures de mutation (`capturerRecette`, `capturerEdition`, `capturerProprietaire`) sont prises depuis l'objet affiché avant dialogue/attente, distinctes de l'origine de navigation. Un favori fixe la valeur voulue en fusionnant la fiche courante ; il ne rebascule pas aveuglément la dernière valeur ni ne sauvegarde le snapshot complet. Le rattachement à un Plat vérifie la présence de la cible et les liens déjà existants dans la transaction, avec garde du compte et de chaque recette ; aucun Plat recréé implicitement.

Les commandes de retrait sont `mettreALaCorbeille`/`restaurerRecette` ou les commandes de `corbeille-livres.js`. Leur contrôle final de signature peut passer par `commanderCycleRecette(...,{verifierCourante})`. Le moteur de sélection multiple reçoit les **captures affichées**, produit un résultat par identifiant et s'arrête au changement de portée ; B affiche ces résultats sans prétendre à l'atomicité serveur. Rattacher plusieurs recettes à un Plat peut utiliser une transaction locale unique avec toutes les gardes ; cela ne change pas le contrat réseau.

### 9.4 Ordre d'assemblage

1. Reproductions rouges C07, Modifier vérifié, disponibilité inconnue et retour compte précédent ; figer API A/B/C et les fixtures de cycles L2.
2. A livre ses primitives et B sa projection pure ; C livre ses descripteurs/commandes et la variante compacte des repères.
3. B intègre les listes/livre ; C les fiches et raccords de Retour ; le responsable intègre CSS/i18n. Garder un seul propriétaire par fichier.
4. Valider la gestion individuelle, puis brancher la sélection B sur le moteur C ; mesurer les retours réels et les arrivées tardives d'images.
5. Suite complète, réception sur le vrai cache, preuve hors ligne, rapport et publication selon l'autorisation applicable. Le parcours public L2 reste prioritaire si sa construction Pages devient disponible pendant cette préparation.

## 10. Réception

| ID | Scénario et preuve attendue |
|---|---|
| L3-01 | Depuis une carte, ouvrir Modifier puis enregistrer une correction ; source et original conservés, version exacte |
| L3-02 | Recette vérifiée, partielle, référence, web et IA : actions adaptées ; Modifier ne disparaît pas à cause de `verified` |
| L3-03 | Retrait depuis carte → carte disparue, bon focus, corbeille trouvable → restauration complète ; aucun faux succès |
| L3-04 | Menu ouvert avant retrait/restauration ou changement de compte : favorite/photo/lien/commande périmés refusés |
| L3-05 | Livre actif, retiré en gardant ses recettes, retiré avec recettes, recette restaurée seule : mêmes éligibilités que L2 |
| L3-06 | Livres contient uniquement les éditions ; Recettes retrouve signets, IA et références sans perte d'objet |
| L3-07 | Disponibles/partielles/références/inconnues comptées séparément ; mêmes nombres dans bibliothèque, livre et bilan L2 |
| L3-08 | Combiner texte/source/livre/favori/durée ; inconnue ≠ zéro, états actifs visibles, remise à zéro exacte |
| L3-09 | Grille/liste donne mêmes identifiants et ordre ; 120+ résultats, Voir plus, images chargées seulement pour les éléments rendus |
| L3-10 | Bibliothèque filtrée et défilée → fiche → retour navigateur et lien Retour : filtre, limite, ancre et focus conservés |
| L3-11 | Livre filtré, onglet Sources, page dépliée → fiche/import → retour : bonne édition, bon onglet, séance exacte |
| L3-12 | Actualisation après favori, synchronisation et changement de langue : contexte gardé, résultats recalculés, aucune ancienne vue tardive |
| L3-13 | Rechargement, nouvelle entrée directe, mémoire refusée/malformée, ancien format : repli sans erreur ni navigation externe |
| L3-14 | Changement de propriétaire ou remplacement d'archive : aucune recherche, ancre, sélection ou cible de l'ancien compte réutilisée |
| L3-15 | Recherche Web → fiche → retour : réponse en mémoire réutilisée ; après rechargement sans réponse, aucun appel payant automatique |
| L3-16 | Sélection multiple avec un membre périmé et interruption : bilan exact par membre, commandes durables, aucun doublon ni succès global fictif |
| L3-17 | Clavier et tactile : Actions accessible, Échap/fermeture, focus après retrait, filtres annoncés sans perdre la frappe |
| L3-18 | 320/390/768/900/1280 px, texte 200 %, réduction du mouvement : aucune action inaccessible ni débordement ; captures avec données réelles de fixture |
| L3-19 | Original↔TM7 : descriptions propres aux deux signatures conservées ; correction d'une seule durée garde les autres plages/≈ ; carte compacte sans appel ni écriture |
| L3-20 | Proposition A affichée/cochée, B reçue ailleurs : Retour/Actions/Garder ne valident pas B ; ancien journal conservé et actualisation explicite requise |
| L3-21 | Appareil TM7 : plan valide de la version courante accepté, document invalidé/autre variante/mention libre exclus ; aucun accessoire inféré |
| L3-22 | Déconnexion avec données encore sous u1, rechargement, remplacement d'archive et nouvelle connexion u2 : portée correcte, aucune fuite d'origine et aucun filtre effacé sur simple réception du même compte |
| L3-23 | Retour/avance produit un seul rendu malgré popstate+hashchange ; replace garde les clés étrangères ; Ctrl/Cmd-clic et lien nouvel onglet fonctionnent avec repli sûr |
| L3-24 | Sélection de 60 éléments parmi 120+, filtre changé ou retrait parent reçu pendant dialogue : pas de membres invisibles réutilisés ; bilan partiel unique et exact |
| L3-25 | Sur un livre long, Modifier le livre ouvre le formulaire et montre réellement son premier champ focalisé sur mobile et ordinateur ; aucun retour en haut ultérieur ne le masque |

Tests comportementaux ciblés rouges puis verts, bases jetables et requêtes injectées ; suite navigateur complète avec épingle
mesurée, outils Node, générateur inchangé, syntaxe/diff/cache. Pour les retours et le défilement, utiliser un vrai navigateur avec
plus d'une page de cartes, navigation arrière/avant, arrivée tardive d'images et changement de largeur ; un test de fonction pure ne
prouve pas le focus ou la position finale. Vérifier aussi deux onglets et une actualisation reçue pendant un menu ouvert.

Une largeur émulée ne prouve pas Safari/iPhone, le clavier mobile ou le lecteur d'écran. Le rapport final nomme les essais réellement
exécutés et ceux restant physiques. Aucun gain de temps chiffré ne sera annoncé avant comparaison avec un parcours de référence.

## 11. Décisions et état

Les choix ci-dessus découlent du plan et des capacités existantes : garder les cinq destinations, exposer les opérations réelles,
séparer Livres et Recettes, préserver le contexte par onglet et réutiliser les cycles de L1/L2. Aucune préférence utilisateur nouvelle
ne bloque la préparation de cette spec. Les options dépendant de L4/L6/L8 restent absentes tant que leur contrat n'est pas construit.
Les exports L2 inspectés sont précisés ci-dessous. Leur commit de livraison sera réépinglé au démarrage ; une évolution de signature se traite dans le raccord partagé, jamais par une seconde logique de cycle dans L3. La présente révision est une revue technique interne, pas une approbation utilisateur inventée.
